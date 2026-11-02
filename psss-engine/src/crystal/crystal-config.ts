import type { CrystalRenderConfig, CrystalShape } from '../presets/types.ts';

/**
 * Selectable crystal silhouettes, in UI order. Single source of truth for the Materials-tab
 * dropdown, so adding a shape here surfaces it without touching the UI.
 */
export const CRYSTAL_SHAPES: CrystalShape[] = ['hexagon', 'plate', 'dendrite', 'prism'];

/**
 * Shape name → the `uCrystalShape` int the crystal fragment shader branches on.
 *
 * Kept adjacent to CRYSTAL_SHAPES because the mapping is a contract with `crystalSDF()` in
 * `hdr-particle.ts`: an unknown name must fall back to 0 (hexagon) rather than leave the uniform
 * stale from the previous crystal, which would silently draw the wrong shape.
 */
/**
 * Per-shape radius multiplier, so one Crystal Size setting gives comparable visual weight across
 * shapes and switching shape is a fair A/B rather than also changing apparent size.
 *
 * Derived from measured quad fill coverage (SDF sampled on a 181x181 grid over the [-1,1] quad):
 * hexagon 44.3%, prism 24.1%, plate 18.9%, dendrite 17.5% (growth 0.05) rising to 36.1% (growth 1.0).
 * The factors are roughly sqrt(hexagonArea / shapeArea) — matching linear extent, not area, because
 * that is what the eye reads as "size" for a spiky shape. Dendrite is compensated for its MATURE
 * coverage rather than its minimum, so a fully grown snowflake sits close to hexagon weight instead
 * of overshooting it.
 */
export const SHAPE_SIZE_COMPENSATION: Record<CrystalShape, number> = {
  hexagon: 1.0,
  plate: 1.53,
  dendrite: 1.11,
  prism: 1.36,
};

export function crystalSizeFor(config: Pick<CrystalRenderConfig, 'crystalSize' | 'shape'>): number {
  const base = config.crystalSize > 0 ? config.crystalSize : DEFAULT_CRYSTAL_CONFIG.crystalSize;
  return base * (SHAPE_SIZE_COMPENSATION[config.shape] ?? 1.0);
}

/**
 * Upper bound for `maxGrowth`, shared by the two places that clamp it: the swelling branch of
 * `CrystalPool.advance()` and the crystal pass's `uMaxGrowth` uniform.
 *
 * Both clamped independently to a hardcoded 3 while the type, the default and the Materials-tab
 * slider all declared 1–6 — so the top 60 % of the slider did nothing. 8a-4 widened the range once
 * `crystalSize` made apparent size independent of growth; these two sites were missed. Defined once
 * here so the UI bound and the enforcement bound cannot drift apart again.
 */
export const MAX_GROWTH_CEILING = 6;

export function crystalShapeToIndex(shape: CrystalShape | undefined): number {
  switch (shape) {
    case 'plate':    return 1;
    case 'dendrite': return 2;
    case 'prism':    return 3;
    default:         return 0;
  }
}

/**
 * v8 Phase 8a / 8a-2 — Faceted Crystal.
 *
 * `enabled: false` is the ONLY inertness gate: with it false the lifecycle update early-returns
 * and the crystal pass never runs, so output is pixel-identical to a build without this feature.
 * (Phase 8a additionally relied on `freezeFraction: 0`; that debug driver is gone — nucleation is
 * now driven by the birth rule, so a non-zero fraction is no longer a second way in.)
 */
export const DEFAULT_CRYSTAL_CONFIG: CrystalRenderConfig = {
  enabled: false,

  // Render params — tuned as a starting point for the go/no-go gate, not as final values.
  //
  // 8a-4: `dendrite`, not the historical `hexagon`. The 8a-3 gate passed on hexagons but flagged them
  // as reading like ice cubes, and as INFLATING rather than branching when they grow. Dendrite arms
  // emerge with `growth` and align with the same 6-fold axes `growthAnisotropy` already biases
  // accretion along, so cluster geometry and crystal geometry finally agree.
  shape: 'dendrite',
  // 22, not the old borrowed 12: the shapes that replaced the solid hexagon fill far less of their
  // quad, so the same radius reads noticeably smaller. See SHAPE_SIZE_COMPENSATION.
  crystalSize: 22,
  facetSharpness: 0.85,
  specularStrength: 1.5,
  iceOpacity: 0.8,
  edgeBrightness: 1.2,
  internalRefraction: 0.3,
  crystalRamp: 'ice',

  // v8 Phase 8a-3 — crystals are ADDITIVE pool slots (see `crystal-pool.ts`), so the population is
  // bounded by a fixed pool like sparks. `freezeCap` is pool OCCUPANCY: nucleation halts above
  // freezeCap * 1.1, melting is never gated.
  poolSize: 600,
  freezeCap: 0.6,

  // Birth (increment b).
  birthRule: 'slow',
  slowFraction: 0.30,
  coldFraction: 0.25,
  nucleationBudget: 8,

  // Lifecycle timings, seconds (increment b).
  nucleationTime: 0.5,
  crystalLifetime: 8,
  meltTime: 1.0,
  meltThreshold: 0.8,

  // Cluster force field (8b.2). Off by default: it changes the figure itself, so it must never
  // engage without being asked for.
  clusterForce: 0,
  clusterForceRadius: 40,
  clusterForceReturn: 1.5,

  // Lattice & symmetry (8b.1). Off by default: it makes clusters formal rather than organic, which
  // is a deliberate aesthetic choice and not universally an improvement.
  latticeSnap: 0,
  latticeCell: 10,
  symmetryFold: false,

  // Growth (increment c).
  growthEnabled: false,
  accretionRadius: 12,
  stickingProbability: 0.35,
  growthAnisotropy: 0.3,
  maxGrowth: 1.8,
  accretionBudget: 8,
};
