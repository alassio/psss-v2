import { getColourRampData } from '../generators/colour-ramps.ts';
import type { ColourRampName } from './types.ts';
export interface CosinePalette {
  name: string;
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  d: [number, number, number];
}

/**
 * @deprecated Unused and NOT the engine's palette-mapping type — that one lives in `renderers/film-looks.ts`
 * and has a `temperature` member instead of `age`. Kept only because deleting an exported type is churn;
 * do not import it.
 */
export type PaletteMapping = 'depth' | 'phase' | 'velocity' | 'age';

// Quilez cosine palette formula: color(t) = a + b * cos(2π(c*t + d))
export function sampleCosinePalette(t: number, palette: CosinePalette): [number, number, number] {
  const TAU = Math.PI * 2;
  return [
    palette.a[0] + palette.b[0] * Math.cos(TAU * (palette.c[0] * t + palette.d[0])),
    palette.a[1] + palette.b[1] * Math.cos(TAU * (palette.c[1] * t + palette.d[1])),
    palette.a[2] + palette.b[2] * Math.cos(TAU * (palette.c[2] * t + palette.d[2])),
  ];
}

// Generate a 256-entry RGBA LUT texture from a cosine palette
export function generateCosinePaletteLUT(palette: CosinePalette): Uint8Array {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const [r, g, b] = sampleCosinePalette(t, palette);
    data[i * 4] = Math.max(0, Math.min(255, Math.round(r * 255)));
    data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
    data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
    data[i * 4 + 3] = 255;
  }
  return data;
}

// Generate a 256-entry RGBA LUT from linear gradient stops
export function generateGradientLUT(stops: [number, number, number, number][]): Uint8Array {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lower = stops[0]!;
    let upper = stops[stops.length - 1]!;
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s]![0] && t <= stops[s + 1]![0]) {
        lower = stops[s]!;
        upper = stops[s + 1]!;
        break;
      }
    }
    const range = upper[0] - lower[0];
    const f = range > 0 ? (t - lower[0]) / range : 0;
    data[i * 4] = Math.round(lower[1] + (upper[1] - lower[1]) * f);
    data[i * 4 + 1] = Math.round(lower[2] + (upper[2] - lower[2]) * f);
    data[i * 4 + 2] = Math.round(lower[3] + (upper[3] - lower[3]) * f);
    data[i * 4 + 3] = 255;
  }
  return data;
}

// 12 curated cosine palettes (per research paper Step 2.7)
export const COSINE_PALETTES: CosinePalette[] = [
  { name: 'Warm',       a: [0.5, 0.3, 0.2], b: [0.5, 0.3, 0.2], c: [1.0, 1.0, 1.0], d: [0.00, 0.10, 0.20] },
  { name: 'Cool',       a: [0.2, 0.3, 0.5], b: [0.2, 0.3, 0.5], c: [1.0, 1.0, 1.0], d: [0.20, 0.10, 0.00] },
  { name: 'Neon',       a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.00, 0.33, 0.67] },
  { name: 'Earth',      a: [0.5, 0.4, 0.3], b: [0.3, 0.3, 0.2], c: [1.0, 1.0, 1.0], d: [0.00, 0.05, 0.10] },
  { name: 'Prismatic',  a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [2.0, 1.0, 1.0], d: [0.50, 0.20, 0.25] },
  { name: 'Monochrome', a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.00, 0.00, 0.00] },
  { name: 'Sunset',     a: [0.5, 0.3, 0.3], b: [0.5, 0.4, 0.3], c: [1.0, 0.7, 0.4], d: [0.00, 0.15, 0.20] },
  { name: 'Ocean',      a: [0.2, 0.4, 0.5], b: [0.2, 0.3, 0.4], c: [1.0, 1.0, 1.0], d: [0.00, 0.25, 0.50] },
  { name: 'Fire',       a: [0.5, 0.2, 0.1], b: [0.5, 0.4, 0.2], c: [0.8, 0.8, 0.5], d: [0.00, 0.05, 0.15] },
  { name: 'Aurora',     a: [0.3, 0.5, 0.4], b: [0.3, 0.4, 0.4], c: [1.0, 1.2, 0.8], d: [0.10, 0.20, 0.30] },
  { name: 'Pastel',     a: [0.7, 0.7, 0.7], b: [0.2, 0.2, 0.2], c: [1.0, 1.0, 1.0], d: [0.00, 0.33, 0.67] },
  { name: 'Midnight',   a: [0.1, 0.1, 0.3], b: [0.3, 0.2, 0.5], c: [1.0, 1.0, 1.5], d: [0.20, 0.30, 0.40] },
];

/**
 * The nine `Cycle:` palettes — plan `21.4b`, decided in `21.D3`.
 *
 * ## These are not new colours. They are the colours the artwork was already using.
 *
 * `lissajous.ts`'s per-particle colour law is, with `DEG = 180/π` and `cStep = 360/particleCount`:
 *
 * ```
 * n = i·cStep ;  val[c] = clamp(colorBase[c] + sin(n·colorFreq[c]/DEG + pos·colorShift[c]) · colorAmp[c], 0, 255) / 255
 * ```
 *
 * and `360/DEG = 2π` exactly, so with `t = i/count` that is `a + b·sin(2π·freq·t + pos·shift)` with
 * **`a = colorBase/255`, `b = colorAmp/255`** — Quilez's cosine palette, evaluated over the normalised
 * particle index instead of a scene quantity, with an animated per-channel phase. The legacy colour law
 * **is** a cosine palette; what was missing was a *mapping* that says so (`'index'`, `21.4a`).
 *
 * The quadruple splits into a **colour** (`base`, `amp`) and two **rates** (`colorFreq`, `colorShift`).
 * Only the colour belongs in a palette — the rates stay per-preset fields and become the mapping's two
 * controls (`21.4e`). Over the presets where the law reaches the screen, the (`base`, `amp`) pair takes
 * **14** distinct values, of which **9 are shared** between presets and 5 are singletons. These are the
 * nine. The five singletons are deliberately NOT named: each is a hue no other preset shares, so a name
 * for it would be vocabulary no new preset would ever pick. They keep `palette: 'none'`, read their
 * `a`/`b` from their own quadruple — bit-identically, since that is the same code path with the palette
 * absent — and are labelled honestly by `21.4f`.
 *
 * ⚠️ **`a` and `b` are authored as explicit `/255` divisions and must stay that way.** `Cycle: Neutral`'s
 * `128/255 = 0.50196…` is NOT `Monochrome`'s `0.5`: the difference reaches **1 LSB** in the 8-bit output,
 * invisible to the eye and fatal to `palettecheck`'s byte-identity parity test. `Monochrome` may not be
 * reused for the presets on pair 1 for exactly that reason, and rounding any of these to two decimals
 * would break the same test. `Cycle: Storm`'s `32.5/255` is not an authoring error either — that pair is
 * genuinely non-integer in the library.
 *
 * ⚠️ **The clamp is part of each palette's identity, not a safety net.** The law clamps each channel
 * *before* dividing, and of the nine, 3 clamp low and 5 clamp high. `Cycle: Shadowed` is pure black for
 * half its cycle **because** of the clamp — remove it and the gradient's *shape* changes, not its
 * brightness (invariant 9's signature, and the reason a visual review would pass it).
 *
 * ## Why `c = 1` and `d = 0` on every entry
 *
 * `c` and `d` are the cosine family's rate and phase, and under the `index` mapping they come from the
 * preset's own `colorFreq`/`colorShift` instead — so they are meaningless here. They are still authored,
 * at the curated family's own convention, because a `Cycle:` palette must remain a legal choice on the
 * other six mappings: `getPaletteLUT` bakes one of these into a 256-entry LUT like any other cosine
 * palette, and leaving `c`/`d` undefined would make the nine a second-class family and the orthogonality
 * this step buys fictional. ⚠️ **A `Cycle:` palette on `depth` is therefore a different picture from the
 * same palette on `index`** — `sin` is `cos(x − π/2)`, so the index law's phase at `pos = 0` is
 * `d = −0.25`, not 0. That is a documented consequence of the convention, not a defect: the LUT path has
 * no per-particle rates to read and no per-frame phase, so it cannot reproduce the index picture anyway
 * (which is also why `index` must NEVER be "optimised" into a LUT — see `21.4a`).
 */
export const CYCLE_PALETTE_PREFIX = 'Cycle: ';

export const CYCLE_PALETTES: CosinePalette[] = [
  // name                        a = colorBase/255                   b = colorAmp/255
  { name: 'Cycle: Neutral',    a: [128/255, 128/255, 128/255], b: [128/255, 128/255, 128/255], c: [1, 1, 1], d: [0, 0, 0] },
  { name: 'Cycle: Deep Blue',  a: [ 32/255,  64/255, 128/255], b: [ 64/255,  64/255, 128/255], c: [1, 1, 1], d: [0, 0, 0] },
  { name: 'Cycle: Embers',     a: [ 21/255,  21/255,  21/255], b: [ 64/255,  32/255,  32/255], c: [1, 1, 1], d: [0, 0, 0] },
  { name: 'Cycle: Solar',      a: [224/255,  96/255,  32/255], b: [ 32/255,  96/255,  32/255], c: [1, 1, 1], d: [0, 0, 0] },
  { name: 'Cycle: Shadowed',   a: [      0,       0,       0], b: [128/255, 128/255, 128/255], c: [1, 1, 1], d: [0, 0, 0] },
  { name: 'Cycle: Starfield',  a: [ 64/255,  64/255, 128/255], b: [ 64/255,  64/255, 128/255], c: [1, 1, 1], d: [0, 0, 0] },
  { name: 'Cycle: Azure',      a: [128/255, 128/255, 255/255], b: [ 64/255, 128/255,       0], c: [1, 1, 1], d: [0, 0, 0] },
  { name: 'Cycle: Storm',      a: [32.5/255, 75/255, 200/255], b: [32.5/255, 75/255,  56/255], c: [1, 1, 1], d: [0, 0, 0] },
  { name: 'Cycle: Indigo',     a: [ 48/255,  32/255, 128/255], b: [ 64/255,  64/255, 128/255], c: [1, 1, 1], d: [0, 0, 0] },
];

/**
 * The `a`/`b` pair the **`index`** mapping sources from a palette, or `null` if the palette has none.
 *
 * Only the two cosine families carry `a`/`b` at all — the `Classic:` gradients are stop lists and the
 * `Material:` ramps are baked byte arrays, so for those the index mapping falls back to sampling their LUT
 * across the population (`LissajousGenerator.setIndexPalette`, `kind: 'lut'`). This function is therefore
 * the *discriminator*, not a total lookup: a `null` return is a legitimate answer, not a failure.
 *
 * ⚠️ **Returned in the 0–255 domain**, pre-multiplied by 255, because the generator's colour law runs
 * there and must stay byte-identical for a preset whose pair the migration adopted. `(x/255)*255 === x`
 * exactly for every integer in ±255 and for 32.5, so the round trip through the authored `/255` divisions
 * above is lossless — verified before this path was written, since a 1-LSB error here reads as "the
 * migration changed my preset's colours".
 */
export function getIndexPaletteAB(name: string): { base: [number, number, number]; amp: [number, number, number] } | null {
  const cycle = CYCLE_PALETTES.find(p => p.name === name);
  const cosine = cycle ?? COSINE_PALETTES.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!cosine) return null;
  return {
    base: [cosine.a[0] * 255, cosine.a[1] * 255, cosine.a[2] * 255],
    amp: [cosine.b[0] * 255, cosine.b[1] * 255, cosine.b[2] * 255],
  };
}

/**
 * The REVERSE of `getIndexPaletteAB` over the nine — v8 Step 21.4d's whole lookup table, as a function.
 *
 * `MigrationLayer` calls this with a legacy body's `(colorBase, colorAmp)` and adopts the palette it names.
 * **A `null` return is the normal answer for five of the library's pairs and is not an error** (`21.D3`: a
 * singleton hue is deliberately unnamed).
 *
 * ⚠️ **EXACT equality, component by component, and never a tolerance.** The nine pairs are what the artwork
 * authored, so a match is an identity rather than a similarity, and `21.D3` measured the near-miss that a
 * tolerance would swallow: `Water Ice Crystal` differs from `Cycle: Azure` in `amp[1]` alone (64 vs 128) —
 * a 0.25 swing in green, visible, and exactly the difference a "these two look the same" argument hides.
 * `Number.EPSILON` would not reach it, but a hand-picked 1/255 would, and a tolerance here would silently
 * REPAINT a preset the migration is supposed to leave alone.
 *
 * ⚠️ **Derived from `CYCLE_PALETTES`, so the nine are enumerated ONCE.** A hand-written table here would be
 * a second declaration of the same nine pairs with no compiler between them, which is the defect the
 * *Working method* rule about three enumerations of one list names: a tenth palette would join the dropdown
 * and silently not be adopted.
 *
 * ⚠️ **Compares in the 0–255 domain** rather than dividing the preset's values, because that is the domain
 * the legacy field is stored in and `x/255*255 === x` holds for every component the library authors
 * (integers and `32.5`) — the same round trip `getIndexPaletteAB`'s header verifies. Comparing in the 0–1
 * domain would introduce the one rounding step this function must not have.
 */
export function cyclePaletteForPair(
  base: readonly number[] | undefined,
  amp: readonly number[] | undefined,
): string | null {
  if (!base || !amp || base.length < 3 || amp.length < 3) return null;
  for (const p of CYCLE_PALETTES) {
    let hit = true;
    // Locals rather than four indexed reads: `noUncheckedIndexedAccess` is on, and a `!` on each would be
    // four assertions where the length was already tested once above.
    for (let c = 0; c < 3; c++) {
      const pa = p.a[c] ?? NaN, pb = p.b[c] ?? NaN, ba = base[c] ?? NaN, am = amp[c] ?? NaN;
      if (pa * 255 !== ba || pb * 255 !== am) { hit = false; break; }
    }
    if (hit) return p.name;
  }
  return null;
}

// 13 legacy gradient palettes (backward-compatible with existing presets)
export const LEGACY_PALETTES: { name: string; stops: [number, number, number, number][] }[] = [
  { name: 'fire',     stops: [[0,0,0,0],[0.3,180,0,0],[0.6,255,140,0],[0.85,255,255,0],[1.0,255,255,255]] },
  { name: 'ocean',    stops: [[0,0,10,40],[0.4,0,80,120],[0.7,0,180,200],[1.0,200,255,255]] },
  { name: 'aurora',   stops: [[0,0,40,0],[0.25,0,180,80],[0.5,0,220,200],[0.75,120,0,200],[1.0,255,100,180]] },
  { name: 'neon',     stops: [[0,255,0,150],[0.25,0,50,255],[0.5,0,255,255],[0.75,0,255,50],[1.0,255,255,0]] },
  { name: 'grayscale', stops: [[0,0,0,0],[1.0,255,255,255]] },
  { name: 'sunset',   stops: [[0,10,10,60],[0.25,80,0,120],[0.5,200,0,100],[0.75,255,120,0],[1.0,255,210,50]] },
  { name: 'toxic',    stops: [[0,0,0,0],[0.3,0,60,0],[0.55,0,180,0],[0.8,100,255,0],[1.0,220,255,220]] },
  { name: 'thermal',  stops: [[0,0,0,0],[0.2,0,0,120],[0.4,100,0,160],[0.6,200,0,0],[0.8,255,200,0],[1.0,255,255,255]] },
  { name: 'cyberpunk', stops: [[0,40,0,80],[0.35,200,0,150],[0.65,255,50,200],[0.85,0,220,255],[1.0,240,240,255]] },
  { name: 'ice',      stops: [[0,255,255,255],[0.3,180,230,255],[0.55,100,160,210],[0.8,30,60,120],[1.0,5,5,30]] },
  { name: 'ember',    stops: [[0,0,0,0],[0.25,60,20,0],[0.5,180,80,0],[0.75,230,170,30],[1.0,255,240,200]] },
  { name: 'galaxy',   stops: [[0,15,0,40],[0.25,60,0,120],[0.5,180,0,160],[0.75,0,200,220],[1.0,240,240,255]] },
  { name: 'candy',    stops: [[0,255,150,200],[0.25,200,160,255],[0.5,150,200,255],[0.75,150,240,200],[1.0,255,255,180]] },
];

/**
 * Prefix that selects a LEGACY gradient palette explicitly.
 *
 * Required for disambiguation, not decoration: 5 of the 13 legacy names (`fire`, `ocean`, `aurora`,
 * `neon`, `sunset`) also exist as cosine palettes, and the cosine lookup below is case-insensitive
 * and runs first — so a bare `"fire"` can only ever resolve to the cosine one. Without the prefix
 * those 5 gradients are unreachable by name at all.
 */
export const LEGACY_PALETTE_PREFIX = 'Classic: ';

export function getPaletteLUT(name: string): Uint8Array | null {
  // Material ramps, reachable as palettes since B14. Checked first and by exact prefix, so a ramp named
  // `fire` cannot be shadowed by the cosine palette of the same name.
  if (name.startsWith(MATERIAL_RAMP_PREFIX)) {
    const bare = name.slice(MATERIAL_RAMP_PREFIX.length);
    return (MATERIAL_RAMP_NAMES as readonly string[]).includes(bare)
      ? getColourRampData(bare as ColourRampName)
      : null;
  }

  // An explicit `Classic: ` prefix bypasses the cosine table entirely, so a colliding name still
  // reaches its gradient. Tested before the cosine lookup because the prefix is unambiguous.
  if (name.startsWith(LEGACY_PALETTE_PREFIX)) {
    const bare = name.slice(LEGACY_PALETTE_PREFIX.length);
    const prefixed = LEGACY_PALETTES.find(p => p.name === bare);
    return prefixed ? generateGradientLUT(prefixed.stops) : null;
  }

  // The nine `Cycle:` palettes (21.4b). Matched on the FULL stored name, which carries the prefix, so
  // this needs no slice and cannot collide — but it is tested before the cosine table for the same reason
  // the two prefixes above are: the cosine lookup is case-insensitive and would happily claim a name it
  // was never given. A `Cycle:` palette reaching this function is being used on one of the SIX LUT
  // mappings, where `c`/`d` apply; under `index` it never gets here at all, because the index path reads
  // `getIndexPaletteAB` and the shader's palette is switched off entirely.
  const cyclePal = CYCLE_PALETTES.find(p => p.name === name);
  if (cyclePal) return generateCosinePaletteLUT(cyclePal);

  // Check cosine palettes first
  const cosine = COSINE_PALETTES.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (cosine) return generateCosinePaletteLUT(cosine);

  // Unprefixed legacy names still resolve, for presets written before the prefix existed. Only the 8
  // non-colliding ones can reach here; the other 5 were always shadowed by the cosine table.
  const legacy = LEGACY_PALETTES.find(p => p.name === name);
  if (legacy) return generateGradientLUT(legacy.stops);

  return null;
}

/**
 * Every selectable palette, as `[storedValue, displayLabel]` pairs for a `<select>`.
 *
 * Legacy entries carry LEGACY_PALETTE_PREFIX in the stored value so `getPaletteLUT` routes past the
 * cosine table, and in the label so the two `Fire`s are distinguishable in the dropdown.
 *
 * This function previously returned bare strings and had **no callers** — the Visual FX palette
 * dropdown was a hardcoded literal of the 12 cosine names, which is why all 13 gradients were
 * unreachable from the UI.
 */
export function getAllPaletteNames(): [string, string][] {
  return [
    ...COSINE_PALETTES.map(p => [p.name, `Cosine · ${p.name}`] as [string, string]),
    // The nine `Cycle:` entries sit immediately after the bare cosine family — they ARE cosine palettes,
    // differing only in where their `t` comes from — and before `Classic:`, whose tail is lowercase
    // because it mirrors identifiers that subsystem owns. Label drops the stored prefix and re-adds it as
    // the group word, exactly as the two families below do: a LABEL may never be what gets stored.
    ...CYCLE_PALETTES.map(p => [
      p.name, `Cycle · ${p.name.slice(CYCLE_PALETTE_PREFIX.length)}`,
    ] as [string, string]),
    ...LEGACY_PALETTES.map(p => {
      const value = `${LEGACY_PALETTE_PREFIX}${p.name}`;
      return [value, `Classic · ${p.name}`] as [string, string];
    }),
    ...MATERIAL_RAMP_NAMES.map(n => [`${MATERIAL_RAMP_PREFIX}${n}`, `Material · ${n}`] as [string, string]),
  ];
}

/**
 * The material colour ramps, exposed as selectable palettes (triage B14).
 *
 * Ramps and palettes were always the same data type — both `Uint8Array(256 * 4)` RGBA8 — but lived in two
 * registries, so a ramp could not be chosen as a film-look palette and `material.colourRamp` had no UI
 * control at all (it was fixed by whichever material preset was active; only `crystalRamp` had a selector).
 * Merging them gives one list for the figure and its overlays, with crystals keeping their own.
 *
 * Prefixed for the same reason as the legacy palettes: `fire`, `ice`, `smoke` and `organic` all collide with
 * cosine or legacy names, and the cosine lookup runs first and is case-insensitive. Without a prefix those
 * ramps would be unreachable.
 *
 * ⚠️ Only the RGB is used. Ramp ALPHA is not carried into the palette path — opacity is a separate concern
 * (see `CLAUDE.md` § colour sources, and B15). A palette therefore recolours a material without changing
 * how solid it is.
 */
export const MATERIAL_RAMP_PREFIX = 'Material: ';
const MATERIAL_RAMP_NAMES = ['fire', 'ice', 'liquid', 'organic', 'smoke', 'fire-phase', 'fire-smoke'] as const;
