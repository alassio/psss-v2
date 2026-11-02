import type { UnifiedPreset } from './types.ts';
import { MigrationLayer } from './migration.ts';

/**
 * How {@link PresetManager.list} orders its result.
 *
 * `order` is LIBRARY ORDER: the built-ins in the sequence `loadAll` received them, then every import in
 * arrival sequence. `name` is alphabetical. Both directions exist for both keys, which is the whole
 * vocabulary — persisted nowhere, so these spellings are free to change.
 */
export type PresetSortMode = 'order-asc' | 'order-desc' | 'name-asc' | 'name-desc';

export const PRESET_SORT_MODES: readonly PresetSortMode[] = [
  'order-asc', 'order-desc', 'name-asc', 'name-desc',
];

/**
 * The name comparator, shared so the grid and the manager cannot disagree.
 *
 * ⚠️ `numeric: true` and `sensitivity: 'base'` are both load-bearing, not polish. Without `numeric`,
 * `Galaxy2` sorts before `Galaxy` under a plain lexicographic compare in some locales and `X v10` sorts
 * before `X v2` always — and this library MINTS ` v<n>` names, so that second case is one an import can
 * produce. Without `sensitivity: 'base'` case decides an order, while the four name-keyed maps downstream
 * treat case as significant and a reader does not: two names differing only in case would sort far apart.
 */
export function comparePresetNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export class PresetManager {
  private library = new Map<string, UnifiedPreset>();
  /**
   * Name → library-order index, the ONLY record of import order.
   *
   * ⚠️ **Why a side map rather than a `metadata.libraryOrder` field, which was the first design.** Three
   * independent reasons, and the first is the decisive one:
   *   1. an `Export All` file is a verified BYTE-IDENTICAL fixed point (939 249 bytes, measured across a
   *      full export→import→re-export cycle on all 177 legacy presets). A new metadata field would appear
   *      in every export, change that byte count and invalidate `public/legacy_presets_original_177.json`
   *      — the reference bundle whose whole purpose is to be a faithful copy.
   *   2. it would then travel INSIDE an exported preset, so re-importing a bundle would carry stale order
   *      numbers and interleave itself among the built-ins. The import would have to overwrite them
   *      anyway, making the stored value a lie in the only case it is ever read from a file.
   *   3. `MigrationLayer` would need a backfill for a field that is pure runtime bookkeeping.
   *
   * ⚠️ `library` is a `Map`, so its own insertion order already *is* import order — but `rename()` must
   * preserve a preset's POSITION, and re-keying a `Map` appends. So the index has to be explicit
   * regardless of how the entries happen to be stored.
   */
  private order = new Map<string, number>();
  /** Next free library-order index. Monotonic — never reused, so an import always sorts after the library. */
  private nextOrder = 0;

  /**
   * Freeze a preset and everything reachable from it (D12).
   *
   * `Object.freeze` alone is shallow, so `preset.renderer.glow = 5` still succeeded and silently corrupted
   * the shared library entry. Walks plain objects and arrays; typed arrays are frozen at the reference level
   * only, since freezing them does not prevent element writes anyway — but no preset field is a typed array.
   */
  private static deepFreezeValue<T>(v: T, seen: WeakSet<object>): T {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return v;
    seen.add(v as object);
    for (const key of Object.keys(v as Record<string, unknown>)) {
      PresetManager.deepFreezeValue((v as Record<string, unknown>)[key], seen);
    }
    return Object.freeze(v);
  }

  /** Deep-freeze entry point — see `deepFreezeValue`. */
  private static deepFreeze(p: UnifiedPreset): UnifiedPreset {
    return PresetManager.deepFreezeValue(p, new WeakSet<object>());
  }

  loadAll(rawPresets: Record<string, unknown>): void {
    for (const [name, raw] of Object.entries(rawPresets)) {
      const migrated = MigrationLayer.migrate(name, raw);
      // D12: `Object.freeze` is SHALLOW. It stops `preset.renderer = {...}` but not
      // `preset.renderer.glow = 5` — every nested object stays writable. That is safe only because callers
      // use `getWorkingCopy()`; the moment something mutates a nested field of a `get()` result it corrupts
      // the shared library entry for every later reader, with no error.
      //
      // Frozen deeply rather than removing the freeze, because the intent (an immutable library) is right —
      // it just was not being enforced past the first level.
      const frozen = PresetManager.deepFreeze(migrated);
      this.library.set(name, frozen);
      // Assigned only for a name not already present, so a re-`loadAll` of an existing name keeps its slot.
      if (!this.order.has(name)) this.order.set(name, this.nextOrder++);
    }
  }

  get(name: string): UnifiedPreset | undefined {
    return this.library.get(name);
  }

  getWorkingCopy(name: string): UnifiedPreset | undefined {
    const preset = this.library.get(name);
    if (!preset) return undefined;
    return structuredClone(preset);
  }

  has(name: string): boolean {
    return this.library.has(name);
  }

  /**
   * The library's names, optionally sorted.
   *
   * ⚠️ **Called with no argument this returns INSERTION order, exactly as it always has**, and that is not
   * merely for compatibility: `main.ts` interleaves each `"<Original> new"` refined preset immediately after
   * its original in the single object handed to `loadAll`, and insertion order is the only thing that puts
   * the two side by side. A default of anything else would silently break the pairwise comparison the
   * refined set exists for. So sorting is opt-in, per caller.
   *
   * ⚠️ **This returns a fresh array and NEVER reorders `library`.** Sorting is a VIEW. Measured reason:
   * alphabetical order splits 9 of the 177 original/refined pairs — `Aurora Borealis II` lands between
   * `Aurora Borealis` and `Aurora Borealis new`, and `Fluid` ends up 5 entries from `Fluid new` — so a sort
   * that rewrote the library would destroy the adjacency permanently, with no way back.
   */
  list(sort?: PresetSortMode): string[] {
    const names = [...this.library.keys()];
    if (!sort || sort === 'order-asc') {
      // `order-asc` IS insertion order for an untouched library, but sort it explicitly rather than
      // returning the `Map`'s sequence: `rename()` re-keys, which appends, so the two diverge after a
      // rename. The order map is authoritative; the `Map`'s own sequence is not.
      return names.sort((a, b) => (this.order.get(a) ?? 0) - (this.order.get(b) ?? 0));
    }
    switch (sort) {
      case 'order-desc': return names.sort((a, b) => (this.order.get(b) ?? 0) - (this.order.get(a) ?? 0));
      case 'name-asc': return names.sort(comparePresetNames);
      case 'name-desc': return names.sort((a, b) => comparePresetNames(b, a));
    }
  }

  /** A preset's library-order index, or `undefined` if it is not in the library. Read by tests and checkers. */
  orderOf(name: string): number | undefined {
    return this.order.get(name);
  }

  /**
   * Rename a preset in place, KEEPING its library-order position.
   *
   * ⚠️ **A rename is a primary-key change, not a label edit.** The name is the key of
   * `PresetManager.library`, the grid's `tileElements`/`tileCanvases`, `GridTileRenderer.activeSlots`, and it
   * is copied into `preset.metadata.name`. This method owns exactly two of those — the library entry and the
   * metadata copy — and every other owner must be updated by the caller. `main.ts`'s `renamePreset` is the
   * one place that does all of it; nothing else should call this directly.
   *
   * ⚠️ **`metadata.name` must be rewritten, not just the map key.** It is a genuine second copy of the
   * identity: `main.ts:2575` compares `preset.metadata.name` against `lastAppliedPresetName` to decide
   * whether render mode survives, and `exportPresetJSON` names the downloaded FILE from it. Leaving it stale
   * gives a preset that exports under its old name — invariant 17's shape (two sources, resolved
   * inconsistently).
   *
   * The library is deep-frozen (D12), so the entry is rebuilt rather than mutated: `frozen.metadata.name = x`
   * fails SILENTLY in sloppy mode. Returns `false` if `from` is absent or `to` is already taken by a
   * DIFFERENT preset; a case-only rename of a preset to itself is allowed and is not a conflict.
   */
  rename(from: string, to: string): boolean {
    const preset = this.library.get(from);
    if (!preset) return false;
    const trimmed = to.trim();
    if (!trimmed) return false;
    // A pure no-op, including a case-only change back to the same name.
    if (trimmed === from) return true;
    // Case-insensitive, matching the import gate: `activeSlots` would treat `cosmos` and `Cosmos` as two
    // slots for what a reader sees as one name. Comparing against `from` too, so `cylinder` -> `Cylinder`
    // is a legitimate recase rather than a self-collision.
    const lower = trimmed.toLowerCase();
    if (lower !== from.toLowerCase()) {
      for (const existing of this.library.keys()) {
        if (existing.toLowerCase() === lower) return false;
      }
    }

    const position = this.order.get(from) ?? this.nextOrder++;
    // structuredClone before writing: the library entry is deep-frozen, so an in-place assignment to
    // `metadata.name` is a silent no-op in non-strict contexts rather than an error.
    const renamed = structuredClone(preset);
    renamed.metadata.name = trimmed;

    this.library.delete(from);
    this.order.delete(from);
    this.library.set(trimmed, PresetManager.deepFreeze(renamed));
    // The SAME index the old name held, so a rename never moves a preset in `order-asc`/`order-desc`.
    this.order.set(trimmed, position);
    return true;
  }

  count(): number {
    return this.library.size;
  }

  export(preset: UnifiedPreset): string {
    return JSON.stringify(preset, null, 2);
  }

  importSingle(name: string, raw: unknown): UnifiedPreset {
    const migrated = MigrationLayer.migrate(name, raw);
    const frozen = PresetManager.deepFreeze(migrated);
    this.library.set(name, frozen);
    // An import gets the next free index, so it sorts AFTER everything already in the library under
    // `order-asc` and first under `order-desc`. ⚠️ Assigned here, from the manager's own counter, and
    // never read from the imported file: a bundle's entries were exported with the order they had in the
    // library they came FROM, which says nothing about this one.
    if (!this.order.has(name)) this.order.set(name, this.nextOrder++);
    return frozen;
  }
}
