import type { ProceduralFlowConfig } from '../presets/types.ts';

export interface FlowArchetype {
  name: string;
  config: Omit<ProceduralFlowConfig, 'archetype'>;
}

export const FLOW_ARCHETYPES: FlowArchetype[] = [
  {
    name: 'Fire Rise',
    config: { strength: 0.4, scale: 1.2, curlAmount: 0.3, direction: [0, -1], radial: 0, evolutionSpeed: 1.2 },
  },
  {
    name: 'Smoke Drift',
    config: { strength: 0.25, scale: 2.0, curlAmount: 0.6, direction: [0.3, -0.95], radial: 0, evolutionSpeed: 0.5 },
  },
  {
    name: 'Vortex',
    config: { strength: 0.5, scale: 1.5, curlAmount: 0.9, direction: [0, 0], radial: 0, evolutionSpeed: 0.8 },
  },
  {
    name: 'Expansion',
    config: { strength: 0.35, scale: 1.0, curlAmount: 0.2, direction: [0, 0], radial: 1.0, evolutionSpeed: 0.6 },
  },
  {
    name: 'Implosion',
    config: { strength: 0.4, scale: 1.0, curlAmount: 0.2, direction: [0, 0], radial: -1.0, evolutionSpeed: 0.6 },
  },
  {
    name: 'Wind Shear',
    config: { strength: 0.5, scale: 0.8, curlAmount: 0.4, direction: [1, 0], radial: 0, evolutionSpeed: 1.0 },
  },
  {
    name: 'Thermal Column',
    config: { strength: 0.6, scale: 1.8, curlAmount: 0.5, direction: [0, -1], radial: -0.3, evolutionSpeed: 1.5 },
  },
  {
    name: 'Ocean Current',
    config: { strength: 0.3, scale: 3.0, curlAmount: 0.7, direction: [0.7, -0.7], radial: 0.1, evolutionSpeed: 0.3 },
  },
  {
    name: 'Chaos',
    config: { strength: 0.7, scale: 1.0, curlAmount: 0.8, direction: [0, 0], radial: 0, evolutionSpeed: 2.0 },
  },
  {
    name: 'Gentle Drift',
    config: { strength: 0.15, scale: 2.5, curlAmount: 0.5, direction: [0, -1], radial: 0, evolutionSpeed: 0.4 },
  },
  {
    name: 'Strong Expansion',
    config: { strength: 0.8, scale: 0.7, curlAmount: 0.1, direction: [0, 0], radial: 1.0, evolutionSpeed: 0.4 },
  },
  {
    name: 'Strong Implosion',
    config: { strength: 0.9, scale: 0.7, curlAmount: 0.1, direction: [0, 0], radial: -1.0, evolutionSpeed: 0.4 },
  },
];

/**
 * The live default for a fresh flow layer.
 *
 * ⚠️ **ITS `archetype` SAYS `Gentle Drift` AND ITS VALUES ARE NOT GENTLE DRIFT'S — three of the six
 * differ** (`strength` 0.3 vs 0.15, `scale` 1.5 vs 2.5, `evolutionSpeed` 0.8 vs 0.4; `curlAmount`,
 * `direction` and `radial` do match). So the dropdown reads *Gentle Drift* over a field that is
 * stronger, coarser and twice as fast, and **re-selecting that archetype CHANGES the flow** rather than
 * confirming it. Measured 2026-10-10 by comparing the two literals.
 *
 * ⚠️ **Read the values, never the name.** Two `demo-presets.ts` comments describe this object as
 * "`DEFAULT_PROCEDURAL_FLOW` (`Gentle Drift`)", which is the label and not the numbers — neither comment
 * is wrong about what it was establishing (that the LIVE global config was what the owner judged), but
 * neither one's parenthesis can be used to look up what that config actually was.
 *
 * Left as-is deliberately: three values moving is a visual change to every preset that carries a
 * style-5 layer without authoring `overlay.proceduralFlow`, so this is a report, not a repair.
 */
export const DEFAULT_PROCEDURAL_FLOW: ProceduralFlowConfig = {
  strength: 0.3,
  scale: 1.5,
  curlAmount: 0.5,
  direction: [0, -1],
  radial: 0,
  evolutionSpeed: 0.8,
  archetype: 'Gentle Drift',
};

export function getFlowArchetype(name: string): FlowArchetype | undefined {
  return FLOW_ARCHETYPES.find(a => a.name === name);
}

/**
 * Deep copy of a flow config — the ONE place `direction`'s nesting is handled (triage I12).
 *
 * `ProceduralFlowConfig` is six scalars and one `[number, number]`, so every `{ ...config }` in the
 * codebase is a copy of the scalars and an ALIAS of the array. There were seven such spreads writing
 * into `main.ts`'s single live `currentProceduralFlow` — two seeding it from `DEFAULT_PROCEDURAL_FLOW`,
 * two from an imported `overlay.proceduralFlow`, one from a `FLOW_ARCHETYPES` entry via the dropdown,
 * plus the boundary getter and `getSnapshot()`. Any one in-place write to `direction` would then reach
 * back into whichever of those it was last seeded from: the module default, an archetype literal, or an
 * already-emitted snapshot.
 *
 * ⚠️ **Use this instead of a spread whenever a `ProceduralFlowConfig` crosses an ownership boundary.**
 * No current caller writes `direction` in place — the Direction slider assigns a fresh array — so this
 * closes a latent hazard rather than a live defect, and the point of centralising it is that a future
 * writer cannot reopen it by adding a seventh spread.
 */
export function cloneFlowConfig(config: ProceduralFlowConfig): ProceduralFlowConfig {
  return { ...config, direction: [config.direction[0], config.direction[1]] };
}
