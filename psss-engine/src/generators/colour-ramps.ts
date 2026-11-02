import type { ColourRampName } from '../presets/types.ts';

interface ControlPoint {
  t: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function buildRampFromPoints(points: ControlPoint[]): Uint8Array {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = 0;
    for (let p = 0; p < points.length - 1; p++) {
      if (t >= points[p]!.t) lo = p;
    }
    const hi = Math.min(lo + 1, points.length - 1);
    const range = points[hi]!.t - points[lo]!.t;
    const f = range > 0 ? (t - points[lo]!.t) / range : 0;
    data[i * 4] = Math.round(lerp(points[lo]!.r, points[hi]!.r, f));
    data[i * 4 + 1] = Math.round(lerp(points[lo]!.g, points[hi]!.g, f));
    data[i * 4 + 2] = Math.round(lerp(points[lo]!.b, points[hi]!.b, f));
    data[i * 4 + 3] = Math.round(lerp(points[lo]!.a, points[hi]!.a, f));
  }
  return data;
}

const FIRE_POINTS: ControlPoint[] = [
  { t: 0.00, r: 0, g: 0, b: 0, a: 0 },
  { t: 0.15, r: 40, g: 0, b: 0, a: 128 },
  { t: 0.35, r: 200, g: 50, b: 0, a: 200 },
  { t: 0.55, r: 255, g: 150, b: 0, a: 240 },
  { t: 0.75, r: 255, g: 220, b: 80, a: 255 },
  { t: 1.00, r: 255, g: 255, b: 220, a: 255 },
];

/**
 * Ice.
 *
 * The low end was originally near-black — `(0,0,20)` at t=0 and `(0,20,80)` at t=0.20, i.e. luminance
 * below 21/255 across the whole bottom fifth. Harmless while the `Ice` MATERIAL saturated at
 * temperature 1.0 and only ever sampled the bright end, but the Open Point 7 fix 3b made Ice genuinely
 * cold (`heatGain: 0.3` → steady state `0.09 .. 0.30`), moving the material entirely INTO that black
 * zone. Combined with `blendMode: 'alpha'` — whose `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` lets a dark pixel
 * REPLACE what is behind it — wave particles crossing a bright crystal painted black over it. Reported
 * as "snakes looking for a way through the ice".
 *
 * The dark end is therefore lifted to a visible deep blue: cold ice still reads dark and cold, but can
 * no longer occlude the crystals it flows across. Everything from t >= 0.45 up is UNCHANGED, so
 * consumers that sample the bright half are unaffected.
 *
 * Alpha is lifted off zero at t=0 too — a fully transparent cold end made the coldest particles vanish
 * outright instead of reading as faint ice.
 *
 * ✅ **DECIDED 2026-08-12 (triage K4): the RGB lift STAYS.** K4 asked whether B15 had made it redundant,
 * on the reasoning that B15 fixed the actual cause (folding the ramp's authored alpha into alpha-blend
 * materials) so the earlier partial fix could be reverted. Measured, and the premise is wrong twice:
 *
 * - **It is not redundant.** The two fixes act on different factors of the same composite. B15 governs
 *   `a` — how much of the crystal survives — and the lift governs the luminance that replaces the rest.
 *   Reverting RGB while keeping B15 still costs a mean **9.0 %** of crystal brightness under cold ice
 *   across `Ice`'s real temperature range (0.04–0.80 at `heatGain: 0.8`), peaking at **-0.098** at
 *   t=0.20. The snakes get dimmer, not gone.
 * - **The lift is not only the material's.** The CRYSTAL pass samples this same ramp at
 *   `clamp(0.25 + refract, 0, 1)`, so its floor is t=0.25 — **inside** the lifted segment, not above it.
 *   Reverting would darken every crystal interior by up to **-0.144** luminance at low refraction. The
 *   header line above ("everything from t >= 0.45 up is UNCHANGED, so consumers that sample the bright
 *   half are unaffected") is therefore true but does not cover this consumer, which samples the dark
 *   half. Crystal appearance was tuned after the lift, so a revert would silently re-tune it.
 *
 * K4 also mis-scopes the change as RGB-only: alpha at t=0.00 and t=0.20 was lifted in the same edit
 * (0→40, 128→140), for the separate reason in the paragraph above. Any future revert must decide about
 * both, and the alpha half is what B15 made load-bearing.
 */
const ICE_POINTS: ControlPoint[] = [
  { t: 0.00, r: 10, g: 25, b: 60, a: 40 },
  { t: 0.20, r: 30, g: 70, b: 130, a: 140 },
  { t: 0.45, r: 0, g: 100, b: 180, a: 200 },
  { t: 0.65, r: 80, g: 180, b: 220, a: 240 },
  { t: 0.85, r: 180, g: 220, b: 255, a: 255 },
  { t: 1.00, r: 240, g: 250, b: 255, a: 255 },
];

const LIQUID_POINTS: ControlPoint[] = [
  { t: 0.00, r: 20, g: 0, b: 40, a: 0 },
  { t: 0.20, r: 80, g: 0, b: 120, a: 150 },
  { t: 0.40, r: 120, g: 0, b: 200, a: 200 },
  { t: 0.60, r: 0, g: 150, b: 200, a: 230 },
  { t: 0.80, r: 0, g: 220, b: 100, a: 255 },
  { t: 1.00, r: 150, g: 255, b: 200, a: 255 },
];

const SMOKE_POINTS: ControlPoint[] = [
  { t: 0.00, r: 10, g: 10, b: 12, a: 0 },
  { t: 0.20, r: 40, g: 40, b: 45, a: 140 },
  { t: 0.40, r: 80, g: 80, b: 85, a: 190 },
  { t: 0.60, r: 130, g: 130, b: 135, a: 220 },
  { t: 0.80, r: 180, g: 178, b: 175, a: 240 },
  { t: 1.00, r: 230, g: 228, b: 225, a: 255 },
];

const FIRE_PHASE_POINTS: ControlPoint[] = [
  { t: 0.00, r: 0, g: 0, b: 0, a: 0 },
  { t: 0.10, r: 20, g: 20, b: 22, a: 40 },
  { t: 0.20, r: 40, g: 40, b: 45, a: 100 },
  { t: 0.30, r: 80, g: 20, b: 5, a: 160 },
  { t: 0.50, r: 180, g: 30, b: 0, a: 210 },
  { t: 0.70, r: 255, g: 100, b: 0, a: 240 },
  { t: 0.85, r: 255, g: 200, b: 50, a: 250 },
  { t: 0.95, r: 255, g: 240, b: 180, a: 255 },
  { t: 1.00, r: 255, g: 255, b: 240, a: 255 },
];

const ORGANIC_POINTS: ControlPoint[] = [
  { t: 0.00, r: 0, g: 10, b: 0, a: 0 },
  { t: 0.20, r: 20, g: 50, b: 0, a: 130 },
  { t: 0.40, r: 80, g: 100, b: 0, a: 180 },
  { t: 0.60, r: 180, g: 140, b: 20, a: 220 },
  { t: 0.80, r: 220, g: 200, b: 40, a: 245 },
  { t: 1.00, r: 180, g: 255, b: 80, a: 255 },
];

const FIRE_SMOKE_POINTS: ControlPoint[] = [
  { t: 0.00, r: 0, g: 0, b: 0, a: 0 },         // dead/invisible
  { t: 0.08, r: 30, g: 25, b: 20, a: 30 },      // near-transparent dark
  { t: 0.20, r: 60, g: 50, b: 40, a: 100 },     // dark brown smoke
  { t: 0.35, r: 90, g: 65, b: 45, a: 160 },     // medium brown
  { t: 0.50, r: 140, g: 40, b: 10, a: 200 },    // dark red/maroon transition
  { t: 0.65, r: 200, g: 80, b: 10, a: 230 },    // orange-red
  { t: 0.80, r: 255, g: 160, b: 30, a: 245 },   // bright orange
  { t: 0.90, r: 255, g: 220, b: 100, a: 255 },  // yellow
  { t: 1.00, r: 255, g: 250, b: 220, a: 255 },  // white-hot core
];

const rampCache = new Map<ColourRampName, Uint8Array>();

export function getColourRampData(name: ColourRampName): Uint8Array {
  let data = rampCache.get(name);
  if (data) return data;

  switch (name) {
    case 'fire':   data = buildRampFromPoints(FIRE_POINTS); break;
    case 'ice':    data = buildRampFromPoints(ICE_POINTS); break;
    case 'liquid': data = buildRampFromPoints(LIQUID_POINTS); break;
    case 'organic': data = buildRampFromPoints(ORGANIC_POINTS); break;
    case 'smoke':      data = buildRampFromPoints(SMOKE_POINTS); break;
    case 'fire-phase': data = buildRampFromPoints(FIRE_PHASE_POINTS); break;
    case 'fire-smoke': data = buildRampFromPoints(FIRE_SMOKE_POINTS); break;
  }
  rampCache.set(name, data);
  return data;
}
