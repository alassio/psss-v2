import type { IfsTransform } from '../presets/types.ts';

export interface IfsPreset {
  name: string;
  transforms: IfsTransform[];
}

/**
 * The fallback IFS transform used wherever style 4 is requested with no `ifsParams` — a gentle 15°
 * rotation at 0.95× that produces a slow spiral echo.
 *
 * ⚠️ **A FACTORY, not a shared constant, and that is the whole point.** This literal existed at seven
 * sites (four in `main.ts`, plus `trans-map.ts`, `migration.ts` and `visual-fx.ts`) and every one of
 * them feeds it into live, MUTABLE state: `currentIfsParams` is spread but its transform *objects* are
 * then written in place by the Visual FX sliders' `commit()`, and `migration.ts` assigns it straight
 * onto `preset.postProcessors.transMap.ifsParams`. A single exported `DEFAULT_IFS_PARAMS` array would
 * therefore be aliased into session state by the first caller and permanently rewritten by the first
 * slider drag — turning a de-duplication into a corruption bug (triage I12).
 *
 * Note `IFS_PRESETS[0]` (`Spiral`) happens to hold the same numbers. That is curated preset data that
 * coincides, not this default; do not collapse the two, or renaming or retuning `Spiral` would silently
 * change what an `ifsParams`-less style-4 preset renders.
 */
export function defaultIfsParams(): IfsTransform[] {
  return [{ angle: 15, scale: 0.95, tx: 0, ty: 0, weight: 1.0 }];
}

/**
 * Per-transform copy of an IFS param list — the ONE place `IfsTransform`'s nesting is handled (I12).
 *
 * ⚠️ **`[...params]` is not a copy of an `IfsTransform[]`; it is a copy of the pointers.** The Visual FX
 * row sliders mutate transforms IN PLACE (`commit()` does `entry[field] = value` on what the getter
 * returned), so a spread leaves every source the list was built from writable through live state.
 * `main.ts` had eight such spreads into a single `currentIfsParams`: the initial seed, a preset change,
 * an overlay apply, two grid-click branches, the boundary getter and setter, and `getSnapshot()`. Their
 * sources are a preset's `postProcessors.transMap.ifsParams`, an imported `overlay.ifsParams`, an
 * `IFS_PRESETS` entry, and an already-emitted snapshot — and one slider drag reached all of them.
 *
 * The measured symptom was retroactive snapshot mutation: a Snapshot taken at angle 300, after dragging
 * on to 42, read 42. The frozen preset LIBRARY was never at risk (`PresetManager` deep-freezes and
 * `structuredClone`s), which is why this survived unnoticed.
 *
 * Use this rather than a spread whenever an `IfsTransform[]` crosses an ownership boundary.
 */
export function cloneIfsParams(params: readonly IfsTransform[]): IfsTransform[] {
  return params.map(t => ({ ...t }));
}

export const IFS_PRESETS: IfsPreset[] = [
  {
    name: 'Spiral',
    transforms: [
      { angle: 15, scale: 0.95, tx: 0, ty: 0, weight: 1.0 },
    ],
  },
  {
    name: 'Zoom Tunnel',
    transforms: [
      { angle: 0, scale: 0.85, tx: 0, ty: 0, weight: 1.0 },
    ],
  },
  {
    name: 'Vortex',
    transforms: [
      { angle: 45, scale: 0.75, tx: 0, ty: 0, weight: 1.0 },
    ],
  },
  {
    name: 'Kaleidoscope',
    transforms: [
      { angle: 120, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
      { angle: 240, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
      { angle: 360, scale: 0.9, tx: 0, ty: 0, weight: 1.0 },
    ],
  },
  {
    name: 'Mirror',
    transforms: [
      { angle: 0, scale: 0.95, tx: 0.15, ty: 0, weight: 1.0 },
      { angle: 0, scale: 0.95, tx: -0.15, ty: 0, weight: 1.0 },
    ],
  },
  {
    name: 'Fern',
    transforms: [
      { angle: 5, scale: 0.9, tx: 0, ty: -0.1, weight: 1.0 },
      { angle: -75, scale: 0.4, tx: 0.2, ty: 0.15, weight: 0.6 },
    ],
  },
  {
    name: 'Double Helix',
    transforms: [
      { angle: 20, scale: 0.9, tx: 0.05, ty: 0, weight: 1.0 },
      { angle: -20, scale: 0.9, tx: -0.05, ty: 0, weight: 1.0 },
    ],
  },
  {
    name: 'Cascade',
    transforms: [
      { angle: 2, scale: 0.98, tx: 0, ty: 0.08, weight: 1.0 },
    ],
  },
  {
    name: 'Explosion',
    transforms: [
      { angle: 8, scale: 1.08, tx: 0, ty: 0, weight: 1.0 },
    ],
  },
  {
    name: 'Crystal',
    transforms: [
      { angle: 90, scale: 0.95, tx: 0, ty: 0, weight: 1.0 },
      { angle: 180, scale: 0.95, tx: 0, ty: 0, weight: 1.0 },
      { angle: 270, scale: 0.95, tx: 0, ty: 0, weight: 1.0 },
    ],
  },
];

export function getIfsPreset(name: string): IfsPreset | undefined {
  return IFS_PRESETS.find(p => p.name === name);
}
