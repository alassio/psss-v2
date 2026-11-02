export interface EngineConfig {
  canvas: {
    width: number;
    height: number;
    dpr: number;
  };
  renderer: {
    backend: 'webgpu' | 'webgl2';
  };
  visualFx: VisualFxConfig;
  speedFactor: number;
  defaultPreset: string;
}

export interface VisualFxConfig {
  glow: number;
  depthSize: number;
  streaks: number;
  palette: string;
  paletteMapping: 'depth' | 'phase';
  filmLook: FilmLookName;
}

/**
 * @deprecated NOT a valid film-look identifier. Use `keyof typeof FILM_LOOKS` instead.
 *
 * **None of these six values is a key of `FILM_LOOKS`**, which is keyed `'Legacy'`, `'Luminous'`,
 * `'Cinematic'`, `'Neon'`, `'Ethereal'`, `'Dramatic'`, `'Vintage'`, `'Glacier'`, `'Plasma'`,
 * `'Monochrome'`, `'Teal & Orange'`, `'Holographic'`, `'Void'`, `'Overexposed'`. So a lookup by one of
 * these names can only ever miss.
 *
 * This is why all ten archetypes failed to change the grade (defect EX2): `ArchetypeDef.filmLook` was
 * typed with this union, so `'luminous'` type-checked while `FILM_LOOKS['luminous']` was `undefined`.
 * It was retyped as `keyof typeof FILM_LOOKS`, which makes a wrong name a compile error — and the
 * Archetypes tab was then removed entirely on 2026-10-04, so ⚠️ **that type no longer exists and
 * `keyof typeof FILM_LOOKS` has no compile-checked AUTHORING caller left** (`film-looks.ts`'s
 * `satisfies` says the same from the other end). The lesson survives its own example: the names here
 * can only ever miss, so do not resurrect this union to type a look field.
 *
 * **No longer exported anywhere outside this file** — triage I11 retyped `UnifiedPreset.visualFx.filmLook`
 * as `string`, which was this type's last cross-module use. It survives only to type `EngineConfig` and
 * `FilmLookDefinition` below, both of which are themselves reachable from nothing but
 * `createDefaultConfig()`. Do not import it. The `FilmLookName` list here is also stale in a second way:
 * `FILM_LOOKS` has carried a fifteenth key, `'Legacy Graded'`, since 2026-08-10.
 */
export type FilmLookName = 'clean' | 'luminous' | 'cinematic' | 'neon' | 'ethereal' | 'dramatic';

export interface FilmLookDefinition {
  name: FilmLookName;
  label: string;
  params: {
    decayFactor: number;
    blurRadius: number;
    bloomEnabled: boolean;
    bloomThreshold: number;
    bloomIntensity: number;
    toneMapCurve: 'aces' | 'reinhard' | 'none';
    exposure: number;
    lift: [number, number, number];
    gamma: [number, number, number];
    gain: [number, number, number];
    depthBrightness: number;
    depthTemperature: number;
  };
}

export function createDefaultConfig(): EngineConfig {
  return {
    canvas: {
      width: 800,
      height: 600,
      // ⚠️ **NOTHING READS THIS, and it must not become the DPR the renderer sizes against.** The real owner
      // is `readDevicePixelRatio()` in `main.ts`, called from `resolveRenderSize()` on every resize; this
      // field is sampled once when the config is built and would silently go stale on a browser zoom or a
      // move between monitors of different densities. Kept because it is part of the exported config shape.
      dpr: window.devicePixelRatio || 1,
    },
    renderer: {
      backend: 'webgl2',
    },
    visualFx: {
      glow: 2.0,
      depthSize: 0.0,
      streaks: 0.0,
      palette: 'none',
      paletteMapping: 'depth',
      filmLook: 'clean',
    },
    speedFactor: 1.0,
    defaultPreset: 'Aurora Borealis',
  };
}
