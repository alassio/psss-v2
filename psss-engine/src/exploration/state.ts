import type { UnifiedPreset } from '../presets/types.ts';

/**
 * The category a lock, a Mixer fader and a Randomiser chip all answer to.
 *
 * ⚠️ **`'material'` IS THE SEVENTH MEMBER (v8 `24.D3`, 2026-10-05), AND IT IS THE ONE EDIT HERE THAT MOVES
 * TWO TABS AT ONCE.** `CATEGORY_LOCKS` in `overlay-rules.ts` is the ordered list and carries a compile proof
 * that it covers this union, so adding a member there is enforced; everything else follows from that array.
 * ⚠️ The ORDER is not here — this union is a set and `'material'` is written last by convention only. Read
 * `CATEGORY_LOCKS` for the UI order, where `'material'` sits **before** `'visual'`.
 *
 * ⚠️ **The scope of each member is the `group` column of `OVERLAY_RULES`, which is the ONE place it is
 * written** — nine keys changed group in `24.1`, so a reading of "what does `visual` hold" older than
 * 2026-10-05 is stale. Do not retype or relocate the `categoryLocks` `Set` below (23.D4): four readers share
 * it and none of them would fail to compile.
 */
export type CategoryLock = 'shape' | 'color' | 'motion' | 'transmap' | 'attractor' | 'visual' | 'material';
// v8 Phase 8a-3: the 'crystal' tab was folded into 'materials' as a third behavioural section
// beside Buoyancy and Sparks, dropping the Lab from 9 tabs to 8. v8 Phase 16 then added 'composer'
// LAST (after Materials, an owner decision), bringing it back to nine — a different ninth tab.
// v8 Phase 19 adds 'reel' after the Composer. ⚠️ **That reverses the Composer's "never move the tab off
// LAST" decision, by the owner's instruction** ("the requirements for the Reel tab (after Composer)"), so
// a reader who knows only the Phase 16 rule will read the Reel's position as a violation of it.
//
// ⚠️ **ADDING A MEMBER HERE IS INVISIBLE TO `tsc` AT EVERY CONSUMER.** Dispatch is a
// `Map<TabId, TabModule>` and the tab bar is built from `TAB_DEFS`, so nothing forces a new id to be
// registered, rendered, or given a container — a tab can exist in the type and simply not be in the
// Lab. There is no `switch` over `TabId` anywhere to make an omission an error (the same shape
// `RenderMode` documents: naming a union buys type safety, NOT enumeration coverage). The one thing
// that does catch it is `tipcheck`, whose `TAB_FILES` list requires an entry per id.
//
// ⚠️ **REMOVING a member is invisible in the same way, and in one MORE place: `tipcheck`'s `TAB_FILES`
// and `UI_FILES` both name a tab by FILE PATH, and a path that no longer exists makes the checker throw
// on `read()` rather than report a finding.** `'archetypes'` was removed on 2026-10-04 (owner: "we remove
// Archetypes now, they have become obsolete") and that is three lists plus two `TAB_TIPS` keys, none of
// which `tsc` can see — `TAB_TIPS` is a `Record<string, string>` and an orphaned entry only fails
// `tipcheck` §H's unread-entry direction. **Count the lists before removing the next one.**
export type TabId = 'mixer' | 'randomiser' | 'sliders' | 'evolution' | 'history' | 'visual-fx' | 'materials' | 'composer' | 'transmap' | 'reel';

export interface HistoryEntry {
  preset: UnifiedPreset;
  timestamp: number;
  label: string;
}

type EventType = 'preset-changed' | 'history-changed' | 'tab-switch' | 'locks-changed';
type Listener = (data?: unknown) => void;

export const HISTORY_MAX = 10;

export class ExplorationState {
  workingPreset: UnifiedPreset | null = null;
  deckA: UnifiedPreset | null = null;
  deckB: UnifiedPreset | null = null;
  categoryLocks: Set<CategoryLock> = new Set();
  lockedValues: Map<CategoryLock, UnifiedPreset> = new Map();
  // History is now explicit-only: only grows via pushSnapshot(), never auto-populated.
  history: HistoryEntry[] = [];
  activeTab: TabId = 'mixer';

  // `crossfaderPosition`, `evolutionSeeds` and `evolutionGeneration` were fields here and were deleted
  // on 2026-08-10 (triage G7). All three were WRITE-ONLY — 7 assignments between `mixer.ts` and
  // `evolution.ts`, zero reads anywhere — because each tab already owns the authoritative copy (the
  // crossfader's own `input.value`, and `EvolutionTab.generation`). Two reasons not to reinstate them
  // as "shared state": they were never a source of truth, so any future reader would have consumed a
  // mirror that a tab could forget to update; and `evolutionGeneration = this.generation` assigned the
  // tab's live array BY REFERENCE, so a reader would have seen it mutate under it. Cross-tab handoff of
  // an evolution seed already works without them — `seedFromExternal(preset)` passes the preset
  // directly. Anything genuinely shared belongs behind a method with an event, like `pushSnapshot()`.

  private listeners: Map<EventType, Listener[]> = new Map();

  on(event: EventType, listener: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
  }

  off(event: EventType, listener: Listener): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    const idx = arr.indexOf(listener);
    if (idx >= 0) arr.splice(idx, 1);
  }

  private emit(event: EventType, data?: unknown): void {
    const arr = this.listeners.get(event);
    if (arr) for (const fn of arr) fn(data);
  }

  setWorkingPreset(preset: UnifiedPreset, _source: string): void {
    this.workingPreset = preset;
    this.emit('preset-changed', preset);
  }

  /**
   * Adopt a preset chosen OUTSIDE the Lab — a grid click, an import, arrow-key navigation.
   *
   * Named `setWorkingPresetSilent` until 2026-08-06, which was actively misleading: its body was
   * byte-identical to `setWorkingPreset` and it **emitted `preset-changed` like everything else**.
   * Callers took the name at face value and applied the preset themselves as well, so every grid
   * click and every import ran the full generator/renderer/TransMap re-init TWICE.
   *
   * The emit is not incidental — it is the mechanism by which `SlidersTab` and `RandomiserTab`
   * re-capture their baselines. Making this genuinely silent would leave those tabs multiplying
   * against a stale preset, so the emit stays and the redundant caller-side apply is what goes.
   */
  setWorkingPresetExternal(preset: UnifiedPreset): void {
    this.workingPreset = preset;
    this.emit('preset-changed', preset);
  }

  /**
   * Explicit snapshot: user-triggered via the Snapshot button.
   *
   * `presetOverride` allows callers to inject a copy with overlay fields without mutating
   * `workingPreset`.
   *
   * ⚠️ **`label` IS THE SNAPSHOT'S DISPLAYED NAME AND MUST START WITH THE PRESET'S NAME** (owner,
   * 2026-10-11). The History tab renders it as the tile's caption, where every other tile grid in the UI
   * captions by preset name — so a label that omits it produces a grid of tiles with no way to tell which
   * preset each one came from. Both current callers compose it: the Snapshot button appends the clock
   * time (the only thing separating two snapshots of ONE preset, which is the normal case), and the
   * Sliders tab appends `— Sliders baked` so the caption still says what happened.
   *
   * ⚠️ **It is composed at the CALL SITE, not here, and that is deliberate** — only the caller knows
   * whether it has a reason to add. This comment is the one place that says the rule, because a third
   * caller passing a bare reason would look perfectly reasonable and `tsc` cannot see it.
   */
  pushSnapshot(label: string, presetOverride?: UnifiedPreset): void {
    if (!this.workingPreset) return;
    const entry: HistoryEntry = {
      preset: deepCopy(presetOverride ?? this.workingPreset),
      timestamp: Date.now(),
      label,
    };
    if (this.history.length >= HISTORY_MAX) {
      this.history.shift();
    }
    this.history.push(entry);
    this.emit('history-changed', this.history);
  }

  clearHistory(): void {
    this.history = [];
    this.emit('history-changed', this.history);
  }

  restoreFromHistory(index: number): void {
    if (index < 0 || index >= this.history.length) return;
    const entry = this.history[index]!;
    this.workingPreset = deepCopy(entry.preset);
    this.emit('preset-changed', this.workingPreset);
  }

  setTab(tab: TabId): void {
    this.activeTab = tab;
    this.emit('tab-switch', tab);
  }

  lockWithSnapshot(category: CategoryLock, snapshot: UnifiedPreset): void {
    this.categoryLocks.add(category);
    this.lockedValues.set(category, deepCopy(snapshot));
    this.emit('locks-changed', [...this.categoryLocks]);
  }

  unlockCategory(category: CategoryLock): void {
    this.categoryLocks.delete(category);
    this.lockedValues.delete(category);
    this.emit('locks-changed', [...this.categoryLocks]);
  }

  toggleLock(category: CategoryLock): void {
    if (this.categoryLocks.has(category)) {
      this.categoryLocks.delete(category);
      this.lockedValues.delete(category);
    } else {
      this.categoryLocks.add(category);
    }
    this.emit('locks-changed', [...this.categoryLocks]);
  }

  isLocked(category: CategoryLock): boolean {
    return this.categoryLocks.has(category);
  }
}

export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
