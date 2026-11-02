/**
 * v8 Phase 22 step 22.3 — **the filter's STATE and its CACHE, with no DOM in sight.**
 *
 * Two objects, and the split is the point:
 *
 * - **`FilterState`** is what the owner has ticked: an include set, an exclude set, a three-state cycle, and a
 *   change list. It knows nothing about presets.
 * - **`FacetIndex`** is what the library contains: `name → Set<FacetKey>` plus `FacetKey → count`, computed once
 *   per library change by calling `computeFacets()` (`preset-facets.ts`, the ONE predicate owner) over every
 *   preset. It knows nothing about what is ticked.
 *
 * The filtering itself is `index.filter(names, state.query())` — one line, and the only place the two meet.
 *
 * ## ⚠️ The rules whose violation is silent
 *
 * 1. **`onChange(cb)` returns an unsubscribe and the subscribers are a LIST, not a slot** (invariant 15). Two
 *    views subscribe today — the grid and the Reel tab's picker — and a slot would have let the second one
 *    silently replace the first, leaving a live view that never updates again.
 * 2. **The counts are LIBRARY-WIDE and computed at rebuild, never per click** (`22.D6`, the owner's decision
 *    against the recommendation). A chip therefore keeps saying `19` while the current result is empty, which is
 *    exactly why `22.5`'s empty state has to name the culprit: the numbers cannot.
 * 3. **`rebuild()` must run wherever `PresetManager` changes** — import, bundle import, rename, delete, settle.
 *    An index built once at boot answers from the old library with no error of any kind: a newly imported
 *    preset's tile matches NOTHING and vanishes the moment any chip is ticked.
 * 4. **A rename must reach the index.** The index is keyed by NAME, and a name is a primary key in five owners;
 *    a tile whose `dataset.preset` moved on while the index still holds the old key looks up `undefined`,
 *    matches nothing and disappears from every filtered view. `renameKey()` is the cheap path and it is exactly
 *    equivalent to a `rebuild()` because a rename cannot change a preset's BODY.
 * 5. **`suspend()`/`restore()` is the ONE owner of the rename handoff.** The search box IS the rename field, so
 *    entering rename mode has to drop the filter; restoring it by re-reading the chips would lose every
 *    exclusion (a chip's DOM has no third state to read back) and would fire the change list twice.
 * 6. **The cycle is `any → include → exclude → any`** (`22.D1`). A two-state control makes exclusion
 *    unreachable, and exclusion is the half that answers *"show me everything that is NOT a warp"*.
 * 7. **`activeKeys()` returns catalogue order, never insertion order.** The summary row prints these, and
 *    insertion order would reshuffle the row every time the owner ticked a chip — a UI that appears to move its
 *    own contents at random.
 * 8. **`filter()` returns a NEW array.** Its input is the panel's own `presetNames`, which `prependPreset` and
 *    `applySort` mutate in place and hold by reference; filtering in place would reorder the library.
 *
 * ⚠️ **No DOM, no `lit`, no imports beyond `preset-facets.ts`** — so this module stays loadable by a checker
 * under Node, which strips types only. **Every field is declared** rather than written as a constructor
 * parameter property: that syntax throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` under Node while `tsc --noEmit`
 * stays green, which is `reel-model.ts`'s rule and the same trap here.
 *
 * ⚠️ **Nothing here is debounced and nothing needs to be.** Measured basis: 274 presets × the catalogue computed
 * once is microseconds, and a filter change is one `Set` test per tile. A debounce would add a state machine
 * whose only job is to make a fast thing feel slower.
 */

import type { FacetKey, FilterQuery } from '../../presets/preset-facets.ts';
import type { UnifiedPreset } from '../../presets/types.ts';
import { ALL_FACETS, FACET_LABELS, FACET_GROUPS, FACET_GROUP_OF, computeFacets, matchesFilter } from '../../presets/preset-facets.ts';

/** ⚠️ Three states, cycled in this order — see rule 6. `'any'` is the absence of an opinion, not a third set. */
export type FacetChipState = 'any' | 'include' | 'exclude';

/**
 * The pair every view needs, so the two views share ONE of each (`22.D3`: same predicate, same model instance).
 *
 * ⚠️ **Owned ABOVE both views — `main.ts` builds it and hands it down.** The preview grid could have built its
 * own and lent it to the Reel tab, but the Lab panel is constructed FIRST, so the grid's copy does not exist yet
 * when the Reel tab is registered; the view that happens to be built first is not a sound owner of shared state.
 */
export interface PresetFilterModel {
  readonly state: FilterState;
  readonly index: FacetIndex;
}

/** The catalogue's own order, resolved once: `activeKeys()` prints in this order and so does the summary row. */
const CATALOGUE_ORDER: ReadonlyMap<FacetKey, number> = new Map(ALL_FACETS.map((f, i) => [f.key, i]));

/**
 * ⚠️ **The key is the fallback, never the empty string.** `FACET_LABELS` covers the catalogue in both directions
 * and `facetcheck` §B asserts it, so this `??` is unreachable today — but a missing label rendered as `''` gives
 * a nameless chip in the summary row, which is the one failure the owner could not report.
 */
function labelOf(key: FacetKey): string {
  return FACET_LABELS[key] ?? key;
}

/**
 * What the owner has ticked. Pure state plus a change list; it holds no presets and computes no counts.
 *
 * ⚠️ **Session only** (`22.D10`): there is deliberately no `localStorage` read or write anywhere in this file.
 * A filter that survives a reload is a filter the owner has forgotten they set, and the grid then opens looking
 * like a library that lost most of its presets.
 */
export class FilterState {
  private readonly includeSet: Set<FacetKey> = new Set();
  private readonly excludeSet: Set<FacetKey> = new Set();
  /** ⚠️ A LIST — invariant 15. `onChange` hands back the remover for exactly this entry. */
  private listeners: (() => void)[] = [];
  /**
   * The suspended sets, or `null` when the filter is live. ⚠️ **Holding the sets rather than a boolean** is what
   * makes `restore()` exact: a flag would need the chips to still carry their state, and a chip has no DOM
   * representation of `exclude` that can be read back.
   */
  private suspendedState: { include: FacetKey[]; exclude: FacetKey[] } | null = null;

  stateOf(key: FacetKey): FacetChipState {
    if (this.includeSet.has(key)) return 'include';
    if (this.excludeSet.has(key)) return 'exclude';
    return 'any';
  }

  /** `any → include → exclude → any`. Returns the state it moved TO, so a caller need not re-read it. */
  cycle(key: FacetKey): FacetChipState {
    const next: FacetChipState = this.stateOf(key) === 'any' ? 'include'
      : this.stateOf(key) === 'include' ? 'exclude' : 'any';
    this.setState(key, next);
    return next;
  }

  setState(key: FacetKey, state: FacetChipState): void {
    this.includeSet.delete(key);
    this.excludeSet.delete(key);
    if (state === 'include') this.includeSet.add(key);
    if (state === 'exclude') this.excludeSet.add(key);
    this.notify();
  }

  /** The summary row's `×` and the empty state's `Drop the last one` both land here. */
  drop(key: FacetKey): void {
    this.setState(key, 'any');
  }

  clear(): void {
    if (this.includeSet.size === 0 && this.excludeSet.size === 0) return;
    this.includeSet.clear();
    this.excludeSet.clear();
    this.notify();
  }

  isActive(): boolean {
    return this.includeSet.size + this.excludeSet.size > 0;
  }

  /** The number on the header's `Filter ▾ n` button (`22.D15`) — includes and excludes both count. */
  activeCount(): number {
    return this.includeSet.size + this.excludeSet.size;
  }

  /** Every ticked key in CATALOGUE order, includes before excludes — see rule 7. */
  activeKeys(): FacetKey[] {
    const byCatalogue = (a: FacetKey, b: FacetKey) =>
      (CATALOGUE_ORDER.get(a) ?? 0) - (CATALOGUE_ORDER.get(b) ?? 0);
    return [[...this.includeSet].sort(byCatalogue), [...this.excludeSet].sort(byCatalogue)].flat();
  }

  query(): FilterQuery {
    return { include: new Set(this.includeSet), exclude: new Set(this.excludeSet) };
  }

  /**
   * `22.D8`'s law, PRINTED — *any within a group, all across groups, exclusions always AND-NOT*.
   *
   * ⚠️ **Derived from the state, never a fixed sentence and never a switch.** The decision was that the drawer
   * explains the law by showing it on the owner's own selection; a static caption saying "OR within a group"
   * next to a selection that happens to have one chip per group teaches nothing, and a hard-coded sentence goes
   * stale the moment the grouping changes. It is also why `combinator` is a FIELD on `FacetGroup`.
   */
  describe(): string {
    if (!this.isActive()) return 'No filter — the whole library is shown.';
    const groups = new Map<string, FacetKey[]>();
    for (const key of this.activeKeys()) {
      if (this.excludeSet.has(key)) continue;
      const g = FACET_GROUP_OF.get(key) ?? 'ungrouped';
      groups.set(g, [...(groups.get(g) ?? []), key]);
    }
    const parts: string[] = [];
    for (const g of FACET_GROUPS) {
      const keys = groups.get(g.id);
      if (!keys || keys.length === 0) continue;
      const words = keys.map((k) => labelOf(k));
      parts.push(words.length === 1 ? words.join('') : `(${words.join(' or ')})`);
    }
    const excluded = [...this.excludeSet].map((k) => `not ${labelOf(k)}`);
    return [...parts, ...excluded].join(' and ');
  }

  /**
   * Hand the filter over for the duration of a rename, and take it back afterwards — rule 5.
   *
   * ⚠️ **`suspend()` NOTIFIES**, because the grid has to un-filter before the shared field becomes the rename
   * editor; `restore()` notifies for the same reason in reverse. ⚠️ **Both are idempotent**: `endRenameMode` is
   * reachable from a commit, an Escape and a `blur`, and the `blur` path is the one that fires twice.
   */
  suspend(): void {
    if (this.suspendedState !== null) return;
    this.suspendedState = { include: [...this.includeSet], exclude: [...this.excludeSet] };
    this.includeSet.clear();
    this.excludeSet.clear();
    this.notify();
  }

  restore(): void {
    const held = this.suspendedState;
    if (held === null) return;
    this.suspendedState = null;
    this.includeSet.clear();
    this.excludeSet.clear();
    for (const k of held.include) this.includeSet.add(k);
    for (const k of held.exclude) this.excludeSet.add(k);
    this.notify();
  }

  isSuspended(): boolean {
    return this.suspendedState !== null;
  }

  /** ⚠️ Returns the unsubscribe; a subscriber that never calls it in `dispose()` leaks (invariant 15). */
  onChange(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  private notify(): void {
    for (const l of [...this.listeners]) l();
  }
}

/**
 * The library's facets, computed once. ⚠️ **`22.D6`'s counts come from HERE** and are LIBRARY-WIDE.
 *
 * ⚠️ **`getPreset` and `getNames` are read at CALL time, never captured as arrays.** The panel's own
 * `presetNames` is mutated in place by `prependPreset` and reordered by `applySort`, and `PresetManager` is the
 * authoritative owner — a captured snapshot is the same defect as a stale index (rule 3) with a different cause.
 */
export class FacetIndex {
  private readonly getNames: () => string[];
  private readonly getPreset: (name: string) => UnifiedPreset | undefined;
  private byName: Map<string, ReadonlySet<FacetKey>> = new Map();
  private counts: Map<FacetKey, number> = new Map();
  private libraryTotal = 0;

  constructor(getNames: () => string[], getPreset: (name: string) => UnifiedPreset | undefined) {
    this.getNames = getNames;
    this.getPreset = getPreset;
    this.rebuild();
  }

  /** Call wherever the library changes — rule 3. Cheap enough to call unconditionally; see the header. */
  rebuild(): void {
    const names = this.getNames();
    this.byName = new Map();
    this.counts = new Map(ALL_FACETS.map((f) => [f.key, 0]));
    for (const name of names) {
      const preset = this.getPreset(name);
      if (!preset) continue;
      const facets = computeFacets(preset);
      this.byName.set(name, facets);
      for (const key of facets) this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    }
    this.libraryTotal = this.byName.size;
  }

  /**
   * Index ONE preset, replacing its entry if it already has one.
   *
   * ⚠️ **Not an optimisation but a requirement on the bundle path**: importing a 177-preset bundle calls
   * `prependPreset` once per entry, and a full `rebuild()` there would recompute the whole library 177 times —
   * on the one path that exists specifically to avoid per-entry library work. ⚠️ **The old counts must be
   * subtracted before the new ones are added**, or re-importing a name inflates every facet it carries and the
   * chip numbers drift upward with nothing to correct them.
   */
  add(name: string): void {
    const preset = this.getPreset(name);
    if (!preset) return;
    this.removeName(name);
    const facets = computeFacets(preset);
    this.byName.set(name, facets);
    for (const key of facets) this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.libraryTotal = this.byName.size;
  }

  /** Drop one preset from the cache, counts included. */
  removeName(name: string): void {
    const old = this.byName.get(name);
    if (!old) return;
    for (const key of old) this.counts.set(key, Math.max(0, (this.counts.get(key) ?? 0) - 1));
    this.byName.delete(name);
    this.libraryTotal = this.byName.size;
  }

  /**
   * Re-key one preset after a rename — rule 4. ⚠️ **Not an optimisation over `rebuild()` but an equivalence**:
   * a rename cannot change a preset's body, so its facet set is the same set under a new key. If that ever
   * stops being true (a facet reading the NAME), this method must become a `rebuild()` and not a second
   * derivation.
   */
  renameKey(from: string, to: string): void {
    const facets = this.byName.get(from);
    if (!facets) return;
    this.byName.delete(from);
    this.byName.set(to, facets);
  }

  facetsOf(name: string): ReadonlySet<FacetKey> {
    return this.byName.get(name) ?? EMPTY_FACETS;
  }

  /** ⚠️ Library-wide and static (`22.D6`) — this number does NOT narrow as chips are ticked. */
  count(key: FacetKey): number {
    return this.counts.get(key) ?? 0;
  }

  /** The `m / N` readout's denominator, from the index rather than from a second `list()` call. */
  total(): number {
    return this.libraryTotal;
  }

  matches(name: string, query: FilterQuery): boolean {
    return matchesFilter(this.facetsOf(name), query);
  }

  /** ⚠️ A NEW array, in the ORDER GIVEN — rule 8. The caller's order is the display order (`22.6`). */
  filter(names: readonly string[], query: FilterQuery): string[] {
    return names.filter((n) => this.matches(n, query));
  }
}

const EMPTY_FACETS: ReadonlySet<FacetKey> = new Set();

/** `22.5`'s subject, measured rather than guessed. `recovered` is how many presets come back if `key` is dropped. */
export interface EmptyDiagnosis {
  readonly activeCount: number;
  readonly bestDrop: { readonly key: FacetKey; readonly label: string; readonly recovered: number } | null;
}

/**
 * Which single active chip is costing the most — for the empty state's *"drop the last one"* sentence.
 *
 * ⚠️ **A REAL EVALUATION, not a heuristic** (`22.5`): each active key is dropped in turn and the result is
 * re-counted against the cached index. A plausible shortcut — *"blame the chip with the lowest library-wide
 * count"* — is wrong whenever two chips are jointly impossible, which is the case the owner will actually hit:
 * `Fire` and `Ice` both count 12, and neither count says a word about their intersection.
 *
 * ⚠️ **It answers `null` when NO single drop recovers anything**, and the empty state must say so rather than
 * naming an arbitrary chip: with three mutually exclusive chips ticked, dropping any one of them still leaves
 * an empty result, and a UI that offers a useless action is worse than one that offers `Clear all`.
 */
export function diagnoseEmpty(index: FacetIndex, names: readonly string[], state: FilterState): EmptyDiagnosis {
  const active = state.activeKeys();
  let best: { key: FacetKey; label: string; recovered: number } | null = null;
  for (const key of active) {
    const trial = new FilterState();
    for (const k of active) if (k !== key) trial.setState(k, state.stateOf(k));
    const recovered = index.filter(names, trial.query()).length;
    if (recovered > 0 && (best === null || recovered > best.recovered)) {
      best = { key, label: labelOf(key), recovered };
    }
  }
  return { activeCount: active.length, bestDrop: best };
}
