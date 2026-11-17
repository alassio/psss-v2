/**
 * @file v8 Phase 41 (`41.S5`) — **the growth TIMELINE**: grow → hold → wither → rest → repeat, as a pure function of
 * the growth clock. The figure side (`figure.ts`) only ever sees the progress `g`; the clock lives in the generator.
 *
 * ⚠️⚠️ **IMPORTS NOTHING (`36.D2`)** — `figurecheck` drives it under bare Node.
 *
 * Owner decisions: a loop turns round by WITHERING (`41.D20`, growth run backwards — never a fade or a cut); `loopNew`
 * regrows from the NEXT seed each cycle (`41.D19`), the change landing at the start of a grow, when the figure is the
 * seed and nothing of it is visible; defaults 12 s / 4 s (`41.D23`).
 */

export type GrowthMode = 'off' | 'once' | 'loop' | 'loopNew';

/** Every mode, in the Composer dropdown's order. */
export const GROWTH_MODES: readonly GrowthMode[] = ['off', 'once', 'loop', 'loopNew'];

/** v8 `41.D23` — the defaults a new growing preset starts with, and the rows' ranges. */
export const GROWTH_DEFAULTS = { time: 12, pause: 4, taper: 0.6, seed: 1 } as const;
export const GROWTH_TIME_RANGE: readonly [number, number] = [2, 60];
export const GROWTH_PAUSE_RANGE: readonly [number, number] = [0, 30];
export const SEED_RANGE: readonly [number, number] = [0, 9999];
/**
 * v8 `41.S6` — the taper's floor: the thinnest tip keeps a fifth of the trunk's particle size, so the outermost twigs
 * stay visible (a floor of 0 would delete them at taper 1, reading as a pruned plant rather than a tapered one).
 */
export const TAPER_FLOOR = 0.2;

/** The smoothstep ease — zero slope at both ends, so a grow starts and finishes without a jolt. */
function ease(x: number): number {
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

/**
 * The growth state at clock `t` (seconds since the preset was applied).
 *
 * Returns `g = null` for `'off'` (the figure's OFF branch) and `cycle` — the number of completed grow-and-rest cycles,
 * which `loopNew` adds to the seed. ⚠️ A non-finite or non-positive time base degrades to the fully grown figure
 * (`g = 1`) rather than NaN: a figure stuck as a seed reads as a missing figure.
 */
export function growthProgress(
  mode: GrowthMode | undefined, t: number, growTime: number, pause: number,
): { g: number | null; cycle: number } {
  if (mode === undefined || mode === 'off') return { g: null, cycle: 0 };
  const T = Number.isFinite(growTime) && growTime > 0 ? growTime : 0;
  const P = Number.isFinite(pause) && pause > 0 ? pause : 0;
  if (T <= 0 || !Number.isFinite(t)) return { g: 1, cycle: 0 };
  const tt = t < 0 ? 0 : t;
  if (mode === 'once') return { g: tt >= T ? 1 : ease(tt / T), cycle: 0 };
  const L = 2 * T + 2 * P;
  const cycle = Math.floor(tt / L);
  const p = tt - cycle * L;
  let g: number;
  if (p < T) g = ease(p / T);                       // grow
  else if (p < T + P) g = 1;                        // hold, fully grown
  else if (p < 2 * T + P) g = ease(1 - (p - T - P) / T);   // wither, tips first
  else g = 0;                                       // rest as the seed
  return { g, cycle };
}

/** The seed a stochastic rule draws with at `cycle` (`41.D19`): the stored seed for every mode but `loopNew`. */
export function effectiveSeed(mode: GrowthMode | undefined, seed: number, cycle: number): number {
  const s = Number.isFinite(seed) ? Math.floor(seed) : 1;
  return mode === 'loopNew' ? s + cycle : s;
}
