/**
 * @file v8 `36.1` + `36.2` — **the figure-type registry, and the read-time resolution that makes
 * `generators.type` load-bearing for the first time.**
 *
 * ⚠️⚠️ **IMPORTS NOTHING AT RUNTIME (`36.D2`).** Its one import is `import type`, which Node's
 * type-stripping erases — verified the same way `core/deform-limits.ts`'s is. Reachable from
 * `score-canvas.ts`, which `composercheck` loads under bare Node; no `enum`, no constructor
 * parameter property.
 *
 * ⚠️ **`FigureType` AND `FigureMotion` ARE DECLARED IN `core/interfaces.ts`, NOT HERE** — that file's
 * own rule, stated at `ChannelDriver`: a union named by `presets/types.ts` belongs in the module every
 * other one imports, because the reverse points the preset format at the generator. **This file owns
 * the DATA; that file owns the TYPE.**
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS STEP CHANGES, AND WHY ITS FEATURE CONTENT IS ZERO
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️⚠️ **`generators.type` HAS EXACTLY ONE LIVE READER TODAY AND IT FAILS IN THE WORST DIRECTION.**
 * `presets/migration.ts:280` is `if (!g || g.type !== 'lissajous') return p;` — it gates
 * `adoptIndexPalette` on the type. Meanwhile `main.ts:8440` and `grid-tile-renderer.ts:1093` **hard-code
 * `type: 'lissajous'`** into the generator config. **So an unknown stored type today silently gets the
 * wave generator WITH ITS WAVE MIGRATION SKIPPED** — a second, worse failure than the one
 * `SPEC-figure-types` §3.3 designs against, because the figure still draws and only its palette
 * adoption is missing.
 *
 * **Measured 2026-10-31: all 339 presets stored `'lissajous'` and ZERO stored `'attractor'`**, so the
 * union's `'attractor'` member was unreachable. ⚠️ **THE REGRESSION SURFACE OF THIS STEP IS THE WHOLE
 * LIBRARY AND ITS FEATURE CONTENT IS NOTHING** — which is why `36.20` clause 2's bitwise-identity gate
 * over every preset *is* the step rather than a formality on top of it.
 *
 * ✅ `31.D1` named `generators.type` as the owed, separately-scoped change and said not to fix it
 * opportunistically. **This is that scoped change.**
 */

import type { FigureType, FigureMotion } from '../core/interfaces.ts';

export interface FigureTypeEntry {
  readonly key: FigureType;
  /** The UI label. ⚠️ Deliberately NOT the stored word for `'lissajous'`. */
  readonly label: string;
  /** One line, shown beside the dropdown so the choice explains itself (`36.11`). */
  readonly description: string;
  /** Which `generators` block holds this type's parameters (`36.2`). */
  readonly configKey: 'waves' | 'attractor' | 'lsystem';
  /** Offered in the picker? ⚠️ `'attractor'` is reserved and NOT selectable — see below. */
  readonly selectable: boolean;
  readonly motion: FigureMotion;
}

/**
 * ⚠️⚠️ **ONE ORDERED ARRAY IS THE OWNER; THE DROPDOWN, THE MIGRATION MAP, THE MIXER'S MEMBER LIST AND
 * EVERY CHECKER READ IT.** The recurring failure being designed out is a `Record<Type, Label>` that
 * `tsc` checks against a separate array that it does not compare — `RENDER_MODE_LABELS` is the one
 * `tsc`-enforced site in its own family for exactly this reason.
 */
export const FIGURE_TYPES: readonly FigureTypeEntry[] = [
  {
    key: 'lissajous',
    label: 'Waves',
    description: 'Three composable Fourier waves per axis — the engine\'s original figure.',
    configKey: 'waves',
    selectable: true,
    motion: 'intrinsic',
  },
  {
    key: 'lsystem',
    label: 'Self-similar curve',
    description: 'A space-filling or branching curve, animated by three turtle angles and a continuous recursion.',
    configKey: 'lsystem',
    selectable: true,
    motion: 'static',
  },
  {
    /*
     * ⚠️⚠️ **RESERVED AND DELIBERATELY NOT SELECTABLE (`36.D8`).** Two reasons, and the second is
     * measured:
     *
     * 1. The legacy `attractorBlend` path is still live, so offering this would create **two routes to
     *    one figure** — the pattern this project corrects rather than adds.
     * 2. **0 of 339 presets store it**, so promoting it would create a configuration no preset has ever
     *    exercised — `CLAUDE.md`'s *"enumerate the reachable-but-unused configurations"* rule, applied
     *    in the direction of not creating one.
     *
     * **Its entry exists so `tsc` names every site**, which is the whole point of a total `Record`. The
     * picker filters on `selectable`; nothing else needs to know it is special.
     */
    key: 'attractor',
    label: 'Attractor',
    description: 'An alternative figure source. Reserved — reachable today through the Attractor blend.',
    configKey: 'attractor',
    selectable: false,
    motion: 'intrinsic',
  },
];

/**
 * ⚠️ **The totality half of the one-owner guarantee**: `Record<FigureType, …>` makes adding a
 * `FigureType` member without an entry a compile error. Built FROM the array so the two cannot disagree.
 */
export const FIGURE_TYPE_BY_KEY: Record<FigureType, FigureTypeEntry> = (() => {
  const out = {} as Record<FigureType, FigureTypeEntry>;
  for (const e of FIGURE_TYPES) out[e.key] = e;
  return out;
})();

/** The type a preset gets when it stores nothing, or stores something unrecognisable with no fallback. */
export const DEFAULT_FIGURE_TYPE: FigureType = 'lissajous';

/** The outcome of resolving a stored type, with the reason — so the UI can explain itself (`36.2`). */
export interface FigureTypeResolution {
  readonly type: FigureType;
  /**
   * Set when the stored value was not a known type. ⚠️ **A one-line NOTICE, never a throw and never an
   * empty frame** — `36.2`'s requirement, and `reel-store.ts`'s precedent that the optional half of a
   * deployment *warns* while the fatal half *fails*.
   */
  readonly notice: string | null;
}

/**
 * `36.2` — resolve a stored type **at read time, never by rewriting the preset.**
 *
 * The order, and all three branches are reachable:
 *   1. a known type → use it
 *   2. else a config block for a known type is present → use that type, and surface a notice
 *   3. else the default with defaults
 *
 * ⚠️⚠️ **THIS IS AN INTERPRETATION, NOT A MIGRATION, AND THE PRECEDENT IS IN THE FILE BEING EDITED.**
 * `presets/types.ts:801`–`:808` records a REQUIRED `fields: { active: string[] }` block that
 * `migration.ts` synthesised for every legacy preset, that was written at 14 sites, read at ZERO, and
 * was deleted — *"Being required was the harm."* **Interpret on load; write only what the author
 * changed.**
 *
 * ⚠️⚠️ **STEP 2 WORKS ONLY BECAUSE SWITCHING IS NON-DESTRUCTIVE, AND THAT SENTENCE BELONGS NEXT TO THE
 * RULE:** a type switch leaves every other block untouched — not zeroed, not omitted, not normalised —
 * so a dormant block is evidence of authorial intent rather than residue. **Someone who "tidies"
 * dormant blocks on save breaks forward compatibility without touching any code that mentions it.**
 */
export function resolveFigureType(
  storedType: unknown,
  blocks: { readonly [k: string]: unknown },
): FigureTypeResolution {
  if (typeof storedType === 'string' && storedType in FIGURE_TYPE_BY_KEY) {
    return { type: storedType as FigureType, notice: null };
  }
  const stored = typeof storedType === 'string' && storedType.length > 0 ? storedType : '(absent)';
  // Step 2: an unknown type with a recognisable block. Ordered by `FIGURE_TYPES` so the answer is
  // deterministic rather than dependent on object key order.
  for (const e of FIGURE_TYPES) {
    if (blocks[e.configKey] !== undefined) {
      return {
        type: e.key,
        notice: `Unknown figure type "${stored}" — showing ${e.label}, which this preset also carries.`,
      };
    }
  }
  return {
    type: DEFAULT_FIGURE_TYPE,
    notice: `Unknown figure type "${stored}" — showing ${FIGURE_TYPE_BY_KEY[DEFAULT_FIGURE_TYPE].label} defaults.`,
  };
}
