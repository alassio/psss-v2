export interface FilmLookParams {
  // Particle renderer
  /**
   * Glow amount: HIGHER = more glow (bigger, softer halo). 1.5–7.0 across the bundles below.
   *
   * The shader applies `pow(falloff, 8.0 / glow)`, so this is the RECIPROCAL of a falloff exponent.
   * Until 2026-08-06 the shader used `pow(falloff, glow)` directly, which is inverted — `falloff` is in
   * [0,1], so a higher exponent SHRINKS the halo. The control therefore did the opposite of its name.
   *
   * ## The values below were RE-AUTHORED on 2026-08-06, not remapped
   *
   * The shader fix originally shipped with the 14 values remapped `new = 8 / old`, so that "every named
   * look renders exactly as it always did". That preserved the *buggy* render: the pre-fix appearance was
   * itself backwards, so the remap locked in an ordering that contradicted every name. Measured halo
   * radius had `Void` ("near-black, sparse, specular-only") WIDEST at 0.870 and `Overexposed`
   * ("blown out") NARROWEST at 0.488 — the authored intent exactly reversed.
   *
   * The bundles are now authored directly against this field's real meaning, giving the rendered
   * ordering crisp → soft: Void < Monochrome < Vintage < Cinematic < Teal & Orange < Dramatic < Legacy
   * < Glacier < Luminous < Holographic < Neon < Plasma < Ethereal < Overexposed. Eight of the fourteen
   * land within 0.6 of the ORIGINAL pre-remap values, because those were written for the correct
   * semantics all along — this largely restores the author's intent rather than inventing a new one.
   *
   * **`Legacy` is pinned at 4.0** (an effective exponent of exactly 2.0) and must stay there: all 177
   * legacy presets carry `renderer.glow: 2.0`, and the ribbon/neon shaders are calibrated so that value
   * is the identity. Changing it would shift the entire preset library.
   *
   * `bloomIntensity` was trimmed on the four looks where glow and bloom both deliver "glow" and would
   * otherwise double-count (`Holographic` 0.65→0.45, `Neon` 0.8→0.55, `Plasma` 1.0→0.65,
   * `Overexposed` 1.2→0.8). No other grading field was touched — bloom threshold, exposure, saturation
   * and palettes were always name-consistent and are unchanged.
   *
   * Note the splat path's equivalent is honestly named `MaterialConfig.falloffExponent` and is NOT
   * inverted — only this field had the misleading name.
   */
  glow: number;
  depthSize: number;
  depthBrightness: number;
  depthDof: number;
  depthColorShift: number;
  lightingMode: number;  // 0=none, 1=directional, 2=rim, 3=both
  lightDir: [number, number, number];
  rimPower: number;

  // Bloom
  bloomEnabled: boolean;
  bloomThreshold: number;
  bloomIntensity: number;

  // Tone mapping
  toneMapEnabled: boolean;
  toneMapCurve: 'none' | 'aces' | 'reinhard';
  exposure: number;
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  saturation: number;
  vignette: number;

  // Palette
  palette: string;
  paletteMapping: PaletteMapping;
}

// 0=depth (near/far), 1=phase (color luminance), 2=velocity (speed)
/**
 * Which per-particle quantity indexes the palette LUT.
 *
 * `temperature` was added 2026-08-07 (triage B14) so that a material's heat becomes an INPUT to the palette
 * system rather than a parallel colour system. Before it, a material's `colourRamp` and a film look's
 * `palette` were mutually exclusive — the splat shader read the ramp and had no palette code at all, so
 * selecting a material silently discarded the film look's colour. See `CLAUDE.md` § colour sources.
 *
 * ⚠️ `temperature` requires an active material. Without one, `temperatures[]` is all-zero and every particle
 * would sample LUT index 0 — a single flat colour. `paletteMappingToInt` cannot know that, so the UI greys
 * the option out and `HDRParticleRenderer` falls back to `velocity`.
 *
 * `position` and `age` were added 2026-08-07 so this list covers the same quantities as
 * `MaterialConfig.heatMode` (velocity / position / age). The two controls are complementary, not duplicates:
 *
 * - **`heatMode`** decides what makes a particle HOT, and integrates over time — `temp = temp*cool + heat` —
 *   so temperature has thermal memory and lags behind the driving quantity.
 * - **`paletteMapping`** decides what indexes the palette, and is INSTANTANEOUS.
 *
 * So `heatMode: velocity` + `mapping: temperature` gives smeared, trailing colour, while `mapping: velocity`
 * gives crisp banding off the same input. Both are useful, and `temperature` remains the general bridge —
 * it is the only mapping that can express an integrated quantity.
 *
 * Unlike `temperature`, `position` and `age` need no material: both are derived directly in the shader from
 * data the generator always provides.
 *
 * Note `presets/palettes.ts` declares a SECOND, unrelated `PaletteMapping` with an `'age'` member. It has no
 * importers and is not this type; do not confuse them.
 *
 * `index` was added 2026-09-18 (plan `21.4a`) and is **the odd one out in every respect**: it is the only
 * mapping computed on the CPU, the only one that does not sample `uPaletteTex`, and the only one that
 * *replaces the source* of `state.colors` rather than recolouring what the generator produced. See
 * `palette-selection.ts`, which owns the resolution, and `PALETTE_MAPPING_OFF` below.
 */
export type PaletteMapping = 'depth' | 'phase' | 'velocity' | 'temperature' | 'position' | 'age' | 'index';

/**
 * The int handed to `uPaletteMapping` when no LUT mapping is in effect.
 *
 * ⚠️ **Negative on purpose, and the renderer tests for it.** The fragment shader's mapping chain ends in a
 * bare `else { palCoord = vVelocity; }` — the *Render modes* trap, one level down — so ANY int outside
 * 0–5 silently selects the velocity mapping rather than doing nothing. `index` must therefore never be
 * expressed as "some int the chain does not match": it is expressed as the palette being OFF, and this
 * constant is the second, independent guard that says so on the uniform path (`hdr-particle.ts` disables
 * the palette when it sees a negative mapping). `palette-selection.ts` also hands the renderer
 * `palette: 'none'` in the same case — two guards, deliberately, because the one thing that must not
 * happen is the shader overwriting the CPU's own answer with a plausible-looking different picture.
 */
export const PALETTE_MAPPING_OFF = -1;

export function paletteMappingToInt(m: PaletteMapping): number {
  switch (m) {
    case 'depth': return 0;
    case 'phase': return 1;
    case 'velocity': return 2;
    case 'temperature': return 3;
    case 'position': return 4;
    case 'age': return 5;
    // NOT 6. There is no shader branch for `index` and there must never be one.
    case 'index': return PALETTE_MAPPING_OFF;
  }
}

/**
 * The named film-look bundles. ⚠️ **Count the keys; do not quote a total.** This line read "The 14"
 * while the object had carried a fifteenth, `'Legacy Graded'`, since 2026-08-10 — and `config.ts`'s
 * `FilmLookName` comment had already recorded that the fifteenth existed, so the two sites disagreed
 * with each other in the file tree for seven weeks with no instrument between them.
 *
 * Declared with `satisfies` rather than `: Record<string, FilmLookParams>` so that
 * `keyof typeof FILM_LOOKS` is the ACTUAL names instead of `string`. With a `Record<string, ...>`
 * annotation the key type degenerates to `string` and a wrong name is accepted silently, which is
 * exactly how all ten archetypes came to name looks that could never be found (defect EX2/C4).
 *
 * ⚠️ **`ArchetypeDef.filmLook` was the one compile-checked caller this bought, and it was deleted with
 * the Archetypes tab on 2026-10-04 — so `satisfies` currently protects NOTHING that exists.** It stays
 * anyway, and this paragraph is why: every other use is `Object.keys(FILM_LOOKS)` at runtime or a cast
 * (`grid-tile-renderer.ts`), none of which would notice the widening, so the day someone authors a look
 * name in a typed field again the annotation decides whether `tsc` catches it. **Do not "simplify" this
 * to an annotation on the grounds that nothing depends on it.**
 */
export const FILM_LOOKS = {
  'Legacy': {
    glow: 4,
    depthSize: 0.0,
    depthBrightness: 0.0,
    depthDof: 0.0,
    depthColorShift: 0.0,
    lightingMode: 0,
    lightDir: [0.5, -0.7, 0.3],
    rimPower: 3.0,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.0,
    toneMapEnabled: false,
    toneMapCurve: 'none',
    exposure: 1.0,
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    saturation: 1.0,
    vignette: 0.0,
    palette: 'none',
    paletteMapping: 'depth',
  },

  /**
   * `Legacy` plus a grading pass — same particle shape, same colour, just not under-exposed.
   *
   * ## Why this exists
   *
   * Measured 2026-08-10: a figure pixel in `star` mode at `glow: 2.0` reaches a steady-state value of
   * only **0.139–0.365**, because alpha compositing is BOUNDED by the sprite's own `shape` (mean 0.373)
   * — `v = s²/(1 - d^K(1-s))` can never exceed `s`. Under `Legacy` that value goes straight to the
   * screen (no tone map, exposure 1.0), i.e. 8-bit **35–93 of 255**. All 177 legacy presets therefore
   * render into the bottom third of the available range. That is under-exposure, not clipping — the
   * opposite of what the `star` headroom note in `CLAUDE.md` (triage B13) might lead you to expect,
   * which is about `star` being hot relative to `blend`, not about it being bright in absolute terms.
   *
   * With `exposure: 1.4` + ACES those same three values land at **74 / 129 / 159**, roughly double,
   * with no clipping even on the 94 presets at `MotionBlur 8` — ACES rolls off rather than clamping.
   *
   * ## ⚠️ The three tone-map fields are ONE atomic change; any subset is inert
   *
   * `exposure` is a uniform inside the tone-map fragment shader (`hdr *= uExposure`), and the whole
   * post-processing pass is gated on `bloom.isEnabled() || toneMap.isEnabled()` (`main.ts:641`) —
   * otherwise the frame is blitted straight to screen. So raising `exposure` on a bundle with
   * `toneMapEnabled: false` changes NOTHING. Do not "tune" this bundle by touching `exposure` alone,
   * and do not add an exposure control to `Legacy` itself for the same reason.
   *
   * ## Why a separate bundle rather than re-tuning `Legacy`
   *
   * `Legacy` is the parity reference: it is the `?? 'Legacy'` fallback for every preset with no
   * `overlay` block (`main.ts:907`) — which is all 177 — and its `glow: 4.0` is the identity for the
   * `renderer.glow: 2.0` those presets carry. Editing it would restyle the entire library at once and
   * destroy the A/B reference needed to judge or revert this. Keeping both means the change is
   * per-preset, selectable, and reversible by deleting one object.
   *
   * Everything except the four grading fields is copied from `Legacy` verbatim — `glow: 4.0` keeps the
   * sprite geometry byte-identical, and `palette: 'none'` keeps each preset's own oscillating
   * `colorBase`/`colorAmp`/`colorFreq`. Only 2 of the other 14 bundles are `palette: 'none'`
   * (`Legacy` and `Cinematic`); every other one REPLACES the preset's authored colour, which is why
   * none of them was usable as "the same look, just brighter".
   *
   * `bloomThreshold: 0.6` is deliberately high so bloom touches only the brightest cores rather than
   * lifting the whole frame — the 94 high-accumulation presets would otherwise wash out.
   *
   * ⚠️ Still UNVERIFIED IN A BROWSER. The values above come from transcribing the tone-map and point
   * shaders, not from observation. Judge it on `Cylinder` (`MotionBlur 0`, so no trail accumulation)
   * and against `Rose` (`MotionBlur 8`, the worst case) before promoting it to a default.
   */
  'Legacy Graded': {
    glow: 4,
    depthSize: 0.0,
    depthBrightness: 0.0,
    depthDof: 0.0,
    depthColorShift: 0.0,
    lightingMode: 0,
    lightDir: [0.5, -0.7, 0.3],
    rimPower: 3.0,
    bloomEnabled: true,
    bloomThreshold: 0.6,
    bloomIntensity: 0.3,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 1.4,
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    saturation: 1.0,
    vignette: 0.0,
    palette: 'none',
    paletteMapping: 'depth',
  },

  'Luminous': {
    glow: 4.8,
    depthSize: 0.5,
    depthBrightness: 0.3,
    depthDof: 0.0,
    depthColorShift: 0.0,
    lightingMode: 0,
    lightDir: [0.5, -0.7, 0.3],
    rimPower: 3.0,
    bloomEnabled: true,
    bloomThreshold: 0.6,
    bloomIntensity: 0.4,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 1.2,
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    saturation: 1.1,
    vignette: 0.0,
    palette: 'Warm',
    paletteMapping: 'depth',
  },

  'Cinematic': {
    glow: 3.0,
    depthSize: 0.8,
    depthBrightness: 0.6,
    depthDof: 0.4,
    depthColorShift: 0.5,
    lightingMode: 1,
    lightDir: [0.5, -0.7, 0.3],
    rimPower: 3.0,
    bloomEnabled: true,
    bloomThreshold: 0.5,
    bloomIntensity: 0.6,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 1.4,
    lift: [0.0, 0.0, 0.02],
    gamma: [1.0, 0.98, 0.95],
    gain: [1.0, 1.0, 1.0],
    saturation: 1.0,
    vignette: 0.3,
    palette: 'none',
    paletteMapping: 'depth',
  },

  'Neon': {
    glow: 5.4,
    depthSize: 0.3,
    depthBrightness: 0.0,
    depthDof: 0.0,
    depthColorShift: 0.0,
    lightingMode: 2,
    lightDir: [0.0, 0.0, 1.0],
    rimPower: 2.5,
    bloomEnabled: true,
    bloomThreshold: 0.3,
    bloomIntensity: 0.55,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 1.5,
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1.1, 1.1, 1.1],
    saturation: 1.4,
    vignette: 0.2,
    palette: 'Neon',
    paletteMapping: 'phase',
  },

  'Ethereal': {
    glow: 6.4,
    depthSize: 0.4,
    depthBrightness: 0.4,
    depthDof: 0.8,
    depthColorShift: 0.3,
    lightingMode: 0,
    lightDir: [0.0, -1.0, 0.5],
    rimPower: 3.0,
    bloomEnabled: true,
    bloomThreshold: 0.4,
    bloomIntensity: 0.5,
    toneMapEnabled: true,
    toneMapCurve: 'reinhard',
    exposure: 1.1,
    lift: [0.02, 0.02, 0.03],
    gamma: [1.05, 1.05, 1.1],
    gain: [0.95, 0.95, 1.0],
    saturation: 0.85,
    vignette: 0.15,
    palette: 'Pastel',
    paletteMapping: 'depth',
  },

  'Dramatic': {
    glow: 3.4,
    depthSize: 0.7,
    depthBrightness: 0.8,
    depthDof: 0.2,
    depthColorShift: 0.6,
    lightingMode: 3,
    lightDir: [0.7, -0.5, 0.2],
    rimPower: 2.0,
    bloomEnabled: true,
    bloomThreshold: 0.7,
    bloomIntensity: 0.7,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 1.6,
    lift: [0, 0, 0],
    gamma: [0.9, 0.9, 0.9],
    gain: [1.2, 1.1, 1.0],
    saturation: 1.2,
    vignette: 0.4,
    palette: 'Prismatic',
    paletteMapping: 'velocity',
  },

  // -- New bundles --

  // Desaturated, crushed blacks, cool shadows — classic film negative feel
  'Vintage': {
    glow: 2.6,
    depthSize: 0.6,
    depthBrightness: 0.5,
    depthDof: 0.3,
    depthColorShift: 0.2,
    lightingMode: 1,
    lightDir: [0.3, -0.8, 0.4],
    rimPower: 4.0,
    bloomEnabled: true,
    bloomThreshold: 0.75,
    bloomIntensity: 0.25,
    toneMapEnabled: true,
    toneMapCurve: 'reinhard',
    exposure: 1.0,
    lift: [0.02, 0.01, 0.0],
    gamma: [1.1, 1.05, 0.95],
    gain: [0.9, 0.88, 0.85],
    saturation: 0.65,
    vignette: 0.5,
    palette: 'Earth',
    paletteMapping: 'depth',
  },

  // Cold tones, high bloom, deep DoF — icy minimalist
  'Glacier': {
    glow: 4.4,
    depthSize: 0.9,
    depthBrightness: 0.7,
    depthDof: 0.9,
    depthColorShift: 0.2,
    lightingMode: 2,
    lightDir: [0.0, 0.0, 1.0],
    rimPower: 5.0,
    bloomEnabled: true,
    bloomThreshold: 0.45,
    bloomIntensity: 0.55,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 0.9,
    lift: [0.0, 0.02, 0.05],
    gamma: [1.0, 1.05, 1.1],
    gain: [0.85, 0.95, 1.1],
    saturation: 0.75,
    vignette: 0.25,
    palette: 'Cool',
    paletteMapping: 'depth',
  },

  // Acid green/magenta shift, extreme saturation, velocity-mapped — psychedelic
  'Plasma': {
    glow: 6.0,
    depthSize: 0.2,
    depthBrightness: 0.0,
    depthDof: 0.0,
    depthColorShift: 0.8,
    lightingMode: 2,
    lightDir: [0.0, 0.0, 1.0],
    rimPower: 1.5,
    bloomEnabled: true,
    bloomThreshold: 0.25,
    bloomIntensity: 0.65,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 2.0,
    lift: [0, 0, 0],
    gamma: [0.8, 0.8, 0.8],
    gain: [1.3, 0.9, 1.4],
    saturation: 2.0,
    vignette: 0.0,
    palette: 'Neon',
    paletteMapping: 'velocity',
  },

  // Strict monochrome, no palette, rim lighting only — wire-sculpture look
  'Monochrome': {
    glow: 2.0,
    depthSize: 1.0,
    depthBrightness: 0.9,
    depthDof: 0.0,
    depthColorShift: 0.0,
    lightingMode: 2,
    lightDir: [0.0, 0.0, 1.0],
    rimPower: 3.5,
    bloomEnabled: false,
    bloomThreshold: 0.8,
    bloomIntensity: 0.0,
    toneMapEnabled: true,
    toneMapCurve: 'reinhard',
    exposure: 1.3,
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    saturation: 0.0,
    vignette: 0.35,
    palette: 'Monochrome',
    paletteMapping: 'depth',
  },

  // Teal-orange split-tone, high contrast, cinematic warmth
  'Teal & Orange': {
    glow: 3.2,
    depthSize: 0.5,
    depthBrightness: 0.4,
    depthDof: 0.1,
    depthColorShift: 0.4,
    lightingMode: 3,
    lightDir: [0.6, -0.6, 0.3],
    rimPower: 2.5,
    bloomEnabled: true,
    bloomThreshold: 0.6,
    bloomIntensity: 0.45,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 1.3,
    lift: [0.0, 0.02, 0.04],
    gamma: [0.95, 1.0, 1.05],
    gain: [1.15, 1.0, 0.85],
    saturation: 1.1,
    vignette: 0.3,
    palette: 'Sunset',
    paletteMapping: 'depth',
  },

  // Holographic iridescent — phase-mapped Aurora palette, dual lighting
  'Holographic': {
    glow: 5.0,
    depthSize: 0.3,
    depthBrightness: 0.2,
    depthDof: 0.5,
    depthColorShift: 1.0,
    lightingMode: 3,
    lightDir: [0.4, -0.6, 0.7],
    rimPower: 1.8,
    bloomEnabled: true,
    bloomThreshold: 0.35,
    bloomIntensity: 0.45,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 1.4,
    lift: [0.01, 0.01, 0.02],
    gamma: [1.0, 1.0, 1.05],
    gain: [1.0, 1.05, 1.1],
    saturation: 1.5,
    vignette: 0.1,
    palette: 'Aurora',
    paletteMapping: 'phase',
  },

  // Black void with sparse specular stars — void / deep space aesthetic
  'Void': {
    glow: 1.5,
    depthSize: 1.0,
    depthBrightness: 1.0,
    depthDof: 0.6,
    depthColorShift: 0.0,
    lightingMode: 2,
    lightDir: [0.0, -1.0, 0.0],
    rimPower: 6.0,
    bloomEnabled: true,
    bloomThreshold: 0.85,
    bloomIntensity: 0.9,
    toneMapEnabled: true,
    toneMapCurve: 'aces',
    exposure: 0.7,
    lift: [0, 0, 0],
    gamma: [0.8, 0.8, 1.0],
    gain: [0.8, 0.85, 1.2],
    saturation: 0.5,
    vignette: 0.6,
    palette: 'Midnight',
    paletteMapping: 'depth',
  },

  // Warm amber + high exposure + no vignette — sun-bleached, overexposed film
  'Overexposed': {
    glow: 7.0,
    depthSize: 0.0,
    depthBrightness: 0.0,
    depthDof: 0.0,
    depthColorShift: 0.0,
    lightingMode: 0,
    lightDir: [0.5, -0.7, 0.3],
    rimPower: 3.0,
    bloomEnabled: true,
    bloomThreshold: 0.2,
    bloomIntensity: 0.8,
    toneMapEnabled: true,
    toneMapCurve: 'reinhard',
    exposure: 2.5,
    lift: [0.04, 0.03, 0.0],
    gamma: [1.2, 1.1, 0.9],
    gain: [1.1, 1.0, 0.8],
    saturation: 0.8,
    vignette: 0.0,
    palette: 'Warm',
    paletteMapping: 'phase',
  },
} satisfies Record<string, FilmLookParams>;

export const CUSTOMIZE_FILM_LOOK = 'Customize';

export function getFilmLookNames(): string[] {
  return [...Object.keys(FILM_LOOKS), CUSTOMIZE_FILM_LOOK];
}
