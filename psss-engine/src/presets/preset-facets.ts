/**
 * v8 Phase 22 step 22.1 — **THE ONE PREDICATE OWNER for "what does this preset's frame actually do".**
 *
 * The library has exactly one way in: a substring of the name. Measured 2026-09-24 over 274 presets, a
 * generous multi-keyword search reaches **0 of the 14** `Ribbon Rendering` presets, **0 of 9** `Neon Lines`,
 * **0 of 9** force-field and **29 of 84** carrying a material, against **9 of 10** attractor presets. That
 * last figure is the diagnosis: names describe **subjects**, and the owner's question is about
 * **construction**. This module is the second axis, and nothing else in the codebase may answer it.
 *
 * ## The rule this module exists for (`22.D4`, and it is the whole phase)
 *
 * **A facet means WHAT THE FRAME DOES, and every facet reads its own ACTIVATION SCALAR.** Never
 * `'x' in overlay`, never a boolean sub-field of a default block. ⚠️ **An export is mostly runtime-default
 * noise**, so a preset that never touched a feature still carries its entire default block, and the naive
 * predicate fails by reporting a HUGE number:
 *
 * | the naive predicate | reports | the honest one | reports |
 * |---|---|---|---|
 * | `overlay.physarum` present | **179** | `physarum.blend > 0` | **2** |
 * | `physarum.showTrail === true` | **178** | — | — |
 * | `overlay.attractorBlend > 0` | **179** | `attractorIndex >= 0` | **10** |
 * | `overlay.sparks` present | 23 | `sparks.enabled` | 19 |
 * | `overlay.crystals` — **the field is `crystal`, SINGULAR** | **0** | `overlay.crystal.enabled` | 8 |
 *
 * ⚠️ **176 of the 179 physarum blocks are byte-identical to each other** and `showTrail` defaults to `true`
 * inside them; `attractorBlend` defaults non-zero while `main.ts` hands the generator `null` whenever
 * `attractorIndex < 0`. ⚠️ **A wrong predicate reads as a UI BUG, not a predicate bug** — the filter selects
 * two thirds of the library and the natural reaction is to go and look at the drawer. ⚠️ **And the
 * singular/plural row is the other failure direction: zero, silently, with no type error**, because
 * `OverlayState` is an interface of optional fields and a typo is just an absent one.
 *
 * ⚠️ **THERE IS NO UNIFORM ACTIVATION RULE.** It is `blend`, `enabled`, `strength`, an index, a resolved
 * mode or a `!== 'None'` test depending on the feature — which is the entire argument for one owner here
 * plus `checks/facetcheck.mjs` asserting the **distribution** against seeded defects. **A grep-shaped
 * checker cannot see any of this.**
 *
 * ## The other rules whose violation is silent
 *
 * 1. **Authored-but-inert does NOT match** (`22.D4a`). `Particle Swarm II` names an attractor at
 *    `attractorBlend: 0`; `Fluid II` carries a `liquid` block outside `liquid` mode; four presets carry a
 *    non-`Wave Shift` style with `enabled: false`; three author a warp pass order with the warp off. None of
 *    them matches. A facet answers *"will I see this"*. ⚠️ **There is no "authored but inert" marker in the
 *    UI** — the opposite reading ("it is authored, so show it") is equally natural and silently gives
 *    different answers, which is why it is stated here and in every affected facet's `tip`.
 * 2. **Two-source fields resolve through their OWNER, once** (invariant 17):
 *    `resolveModeAgainstMaterial()` for the mode (a material overrides every mode **except `liquid`**),
 *    `chainFromOverlay()` + `isStyleActive()`/`isInertModifier()` for which styles are live (**the chain wins
 *    if non-empty, else the single resolved scalar** — never read `overlay.transMapStyle` alone), and
 *    `resolvePaletteSelection()` for palette and mapping (**arity 2**, and **the film-look half carries the
 *    majority of both fields**). **Nothing here writes a resolved value back.**
 * 3. **Read the SINGULAR `overlay.crystal`.** See the table above.
 * 4. **Compute on the MIGRATED body only** — a `UnifiedPreset` as `PresetManager` holds it, never a raw JSON
 *    body and never a partial.
 * 5. **No `time`, no canvas size, no renderer state.** A facet is a property of the preset. A function that
 *    read a live subsystem could not be used by the grid, the Reel tab and a Node checker alike, which is the
 *    whole point of the module.
 *
 * ## Why this file is import-clean
 *
 * ⚠️ **`facetcheck.mjs` imports this module under Node, which strips types ONLY.** `reel-model.ts`'s rule
 * applies verbatim: **a constructor parameter property throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` while
 * `tsc --noEmit` stays green**, so there are no classes here at all — plain functions and plain data. Every
 * value import below is a pure module with no side effects, verified by importing this file under Node.
 *
 * ⚠️ **`resolveModeAgainstMaterial()` LIVED IN `main.ts` UNTIL 22.1 AND HAD TO MOVE**, because `main.ts`
 * cannot be imported under Node — importing it boots the engine. Rule 2 was therefore unsatisfiable as
 * specified, and the only alternative was a second hand-written copy of the exact rule invariant 17 exists
 * to forbid. See the relocation banner in `generators/material-presets.ts`. **Do not give it a fourth home.**
 *
 * ## Two deliberate deviations from the plan's `22.0`, both flagged to the owner
 *
 * ⚠️ **(a) The `Colour Palette` and `Film Look` value lists are derived from the ENGINE'S REGISTRIES, not
 * from what the library happens to use.** `22.0` counts 29 palette values (the 28 used plus `No palette`) and
 * 9 film looks, and `22.D7` says "today NO value in the catalogue has a zero count". But `FACET_GROUPS` is
 * static module data and a library-derived list cannot be static — and `22.D7`'s own reasoning is that **the
 * drawer is a map of what the engine can do, not of what this library happens to contain**, with the further
 * instruction that the zero-count path "must not be implemented as a special case that is never exercised".
 * Deriving from `getAllPaletteNames()` (41) and `FILM_LOOKS` (15) satisfies both and EXERCISES the greyed
 * zero on day one. The consequence is a larger drawer, which is why `22.0` already requires the facet search.
 *
 * ⚠️ **(b) `FACET_LABELS` is DERIVED from `FACET_GROUPS`, not authored beside it.** `22.1` asks for
 * `FACET_LABELS: Record<FacetKey, string>` "so `tsc` forces a label for a new member"; making `label` a
 * REQUIRED field on `FacetDef` forces it more directly and leaves **one** authored list instead of two with
 * no compiler between them, which is the `TEST_HOOK_KEYS` shape the plan warns about elsewhere in the same
 * step. The export still exists with the specified type and is still asserted in both directions by
 * `facetcheck` §B — against the derivation rather than against a second copy.
 */

import type { UnifiedPreset, OverlayState, CrystalShape, LiquidSeedPattern, LiquidTintSource, ForceGateSource, DyeFieldConfig } from './types.ts';
import type { RenderMode, FigureType } from '../core/interfaces.ts';
import { resolveFigureType } from '../generators/figure-types.ts';
// ⚠️ Every one of these is a pure module. `material-presets.ts` owns the mode resolution since 22.1;
// `trans-map-chain.ts` owns which styles are live; `palette-selection.ts` owns the palette's two sources.
// **Importing a resolution rather than re-deriving it is rule 2, and it is the rule this phase turns on.**
import { resolveModeAgainstMaterial, MATERIAL_PRESETS } from '../generators/material-presets.ts';
import { TRANS_MAP_STYLES, chainFromOverlay, isStyleActive, isInertModifier, buildChainPlan } from '../post-processors/trans-map-chain.ts';
import { resolvePaletteSelection, PALETTE_MAPPING_ORDER, PALETTE_MAPPING_LABELS } from '../renderers/palette-selection.ts';
import type { PaletteMapping } from '../renderers/film-looks.ts';
import { FILM_LOOKS, CUSTOMIZE_FILM_LOOK } from '../renderers/film-looks.ts';
import { getAllPaletteNames } from './palettes.ts';
import { CRYSTAL_SHAPES } from '../crystal/crystal-config.ts';
import { ATTRACTOR_PRESETS } from '../generators/attractors.ts';
import { STRAND_CAPABLE } from '../generators/attractor-strand.ts';

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// KEYS
// ════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The 21 boolean facets, as a CLOSED union so `tsc` names every site when one is added.
 *
 * ⚠️ **21, and the plan's basis table says "the 22 boolean feature facets" — that is a DIFFERENT SET, not a
 * missing row.** The basis histogram counted `Ribbon Rendering ≠ off` as one boolean; `22.0`'s catalogue makes
 * ribbon an ENUMERATION with four values, `off` included, because "which ribbon mode" is the useful query and
 * "any ribbon at all" is its union. **Two measurements wearing the same words** — `facetcheck` §G prints the
 * coverage histogram over the 21 and says so, rather than reproducing a figure at the other basis.
 */
export type BooleanFacetKey =
  // 2. POPULATIONS
  | 'pop:sparks' | 'pop:crystals' | 'pop:buoyancy'
  // 3. PARTICLES & TRAILS
  | 'particles:neonLines' | 'particles:electricDischarge' | 'particles:symmetryFold' | 'particles:symmetry3d'
  // v8 Phase 30 — ONE key for all three model-space deformation operators (30.D18).
  | 'particles:deformed'
  // 4. MOTION & FIELDS
  | 'motion:curlNoise' | 'motion:cohesion' | 'motion:fluidAdvection' | 'motion:physarum'
  | 'motion:liquidField' | 'motion:dye' | 'motion:forceField' | 'motion:forceGate'
  // 5. TRANSLATION MAP
  | 'tm:enabled' | 'tm:chain2' | 'tm:warpFirst' | 'tm:dispersion' | 'tm:ifs'
  // 6. SURFACES
  | 'surface:liquid' | 'surface:volume'
  // 7. FIGURE
  // v8 33.3 — `Travel`'s own chip (33.D10). ⚠️ It is NOT a member of `particles:deformed` and
  // `facetcheck` §B carries the reason in `NOT_DEFORMATION`: this answers *is the figure a closed loop*,
  // which is a different question from *is the figure bent*.
  | 'figure:attractor' | 'figure:open'
  // v8 `36.15` — the self-similar curve figure type.
  | 'figure:curve';

/** The invented BAND keys (`22.D12`'s ⚙ marks) — closed unions, because their boundaries are authored here. */
export type TrailDecayBand = 'crisp' | 'medium' | 'long' | 'veryLong';
export type WindingBand = 'w1' | 'w2_4' | 'w5_16' | 'w17_64' | 'w65_256' | 'w257_1024' | 'wOver1024';
export type LiveWavesBand = '1' | '2' | '3';
export type DesignAspect = 'square' | 'landscape' | 'portrait';

/**
 * **Every facet key.** The derived families are template-literal types rather than closed unions because
 * their vocabularies are the ENGINE's enumerations, imported above — a hand-written copy here would be the
 * second list this whole module exists to prevent.
 *
 * ⚠️ **The suffix after the colon is always the BARE ENGINE WORD** (*Phase 19*'s rule: a label persisted, or
 * a stored word printed, is the defect). `'No material'`, `'No palette'` and `'No film look'` are the three
 * invented absence values, and each is spelled with the `none` sentinel its own subsystem already uses.
 */
export type FacetKey =
  | BooleanFacetKey
  | `material:${string}`
  | `crystalShape:${string}`
  | `mode:${string}`
  | `ribbon:${string}`
  | `trailDecay:${TrailDecayBand}`
  | `seedPattern:${string}`
  | `dyeColour:${string}`
  | `gateBy:${string}`
  | `tmStyle:${number}`
  | `tint:${string}`
  | `attractorType:${string}`
  | `liveWaves:${LiveWavesBand}`
  | `flat3d:${'flat' | '3d'}`
  | `winding:${WindingBand}`
  | `aspect:${DesignAspect}`
  | `palette:${string}`
  | `mapping:${string}`
  | `filmLook:${string}`;

export type FacetGroupId =
  | 'materials' | 'populations' | 'particles' | 'motion' | 'transmap' | 'surfaces' | 'figure' | 'colour';

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// THE RESOLVED RECORD — every two-source field answered ONCE, by its owner
// ════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * What a predicate is allowed to read. Built once per preset by `resolve()`, so no facet can accidentally
 * resolve a two-source field its own way.
 *
 * ⚠️ **`ov` is here as an escape hatch for the single-source scalars only.** Anything with two sources has a
 * resolved field on this record instead, and `facetcheck` is the instrument that says so: if a `tmStyle`
 * predicate ever reads `r.ov.transMapStyle`, the styles 8/9/11 vanish (13 presets) and **nothing else fails**.
 */
interface Resolved {
  readonly preset: UnifiedPreset;
  readonly ov: OverlayState;
  /** `overlay.material?.preset ?? 'None'`, the STORED word. */
  readonly materialName: string;
  /** `!!material && material.preset !== 'None'` — the discriminator of the 2026-09-01 defect. */
  readonly materialLive: boolean;
  /**
   * Through `resolveModeAgainstMaterial()`, and then through the `splat`-with-no-material fallback.
   *
   * ⚠️ **A material overrides every mode EXCEPT `liquid`**, and ⚠️ **`splat` surviving with no live material
   * draws NOTHING**, so `main.ts` falls back and the mode the frame really uses is `star`. **Measured
   * 2026-09-24: 0 of 274 presets are in that state**, so folding the fallback in changes no figure today — it
   * is here because `22.D4a` makes it the honest answer the moment one is authored, and because
   * `coveragecheck`'s `effectiveMode` already resolves it this way. **Two resolutions of one quantity that
   * disagree is the defect; agreeing at today's library is not evidence, the shared rule is.**
   */
  readonly mode: RenderMode;
  /** `overlay.transMapEnabled ?? postProcessors.transMap.enabled`, in that order. */
  readonly tmEnabled: boolean;
  /** Through `chainFromOverlay()` — the chain if non-empty, else the single resolved scalar as one layer. */
  readonly chainLength: number;
  /** Live styles: TransMap on, the layer contributes, and it is not a weightless modifier with nothing to modify. */
  readonly liveStyles: readonly number[];
  /**
   * Whether any chain layer can publish a force field at all, via `buildChainPlan()`.
   *
   * ⚠️ **`main.ts` gates the force pass on the blend and the checkbox ALONE, never on a style** (asserted by
   * `coveragecheck`), so the pass RUNS with no source — and pushes by zero. **Measured 2026-09-24: all 9
   * force-field presets have a live source, so this clause moves no figure today.** It is here because a
   * sourceless pass is exactly the authored-but-inert state `22.D4a` excludes, and because leaving it out
   * would make this the one facet that answers "the pass ran" instead of "the frame moved".
   */
  readonly anyForceMode: boolean;
  /** The attractor actually driving the figure, or `null`. ⚠️ See the `figure:attractor` row for why. */
  readonly attractorType: string | null;
  /**
   * v8 `36.15` — the RESOLVED figure type, which is what the `figure:curve` chip reads.
   *
   * ⚠️⚠️ **RESOLVED, never the stored string.** An unknown stored value resolves by `36.2`'s order, so
   * reading `generators.type` raw here would put a preset in no bucket at all while the engine happily
   * draws it — the chip would be absent rather than wrong, which is the harder failure to notice.
   */
  readonly figureType: FigureType;
  /** `resolvePaletteSelection().name` — ⚠️ the film-look half carries the majority. */
  readonly paletteName: string;
  /** `resolvePaletteSelection().mapping` — ⚠️ defaults to `'depth'`, so there is NO "unset" value. */
  readonly paletteMapping: PaletteMapping;
  /** `overlay.filmLook`, or `''` for none. Includes `'Customize'`, which is not a `FILM_LOOKS` key. */
  readonly filmLook: string;
  /** Per-slot liveness: a slot is live iff some axis has `size + pulse !== 0` (Phase 16's rule). */
  readonly liveSlots: number;
  /** True iff NO live slot has a live Z axis. */
  readonly flat: boolean;
  /** `max abs(fm.base)` over LIVE axes of LIVE slots. ⚠️ A silent axis's authored winding must not set the band. */
  readonly maxWinding: number;
  readonly aspect: DesignAspect;
}

/**
 * ⚠️ **The slot-silence test is `size + pulse`, and `FM.Base` is NOT** — Phase 16's rule, and a `Live Waves`
 * facet that tested `fm.base` would call a live flat circle silent. `size` is `am.base` and `pulse` is
 * `am.amplitude`; `composer-model.ts` is the owner of that naming and of `silent: size + pulse === 0`.
 */
function axisLive(ax: { am?: { base?: number; amplitude?: number } } | undefined): boolean {
  if (!ax) return false;
  return ((ax.am?.base ?? 0) + (ax.am?.amplitude ?? 0)) !== 0;
}

function resolve(preset: UnifiedPreset): Resolved {
  const ov: OverlayState = preset.overlay ?? {};
  const tm = preset.postProcessors?.transMap;
  const materialName = ov.material?.preset ?? 'None';
  const materialLive = !!ov.material && ov.material.preset !== 'None';
  // ⚠️ The REQUESTED mode is itself two-source (`overlay.renderMode ?? renderer.mode`), and only then does
  // the material get a say. Reversing those two is the 2026-09-01 user report.
  const requested: RenderMode = ov.renderMode ?? preset.renderer?.mode ?? 'star';
  const resolvedMode = resolveModeAgainstMaterial(requested, ov.material ?? null);
  const mode: RenderMode = resolvedMode === 'splat' && !materialLive ? 'star' : resolvedMode;

  const tmEnabled = ov.transMapEnabled ?? tm?.enabled ?? false;
  const chain = chainFromOverlay(ov, tm?.style ?? 0, tm?.ifsParams);
  const liveStyles = TRANS_MAP_STYLES
    .map((m) => m.style)
    .filter((s) => tmEnabled && isStyleActive(chain, s) && !isInertModifier(chain, s));
  // ⚠️ `TransMapProcessor.getForceModes()` is a method on a GL-owning class and cannot be imported here, so
  // these three lines are a re-implementation — the SAME one `coveragecheck` §B carries and asserts the source
  // shape of. **Do not let them drift: if `buildChainPlan`'s shape moves, both copies must move together.**
  const plan = tmEnabled ? buildChainPlan(chain) : null;
  const anyForceMode = !!plan
    && (plan.echoLayer !== null || plan.flowLayer !== null
      || plan.staticStyles.length > 0 || plan.vortexLayer !== null);

  // ⚠️ ARITY 2, and the second argument is the LIVE film-look params — the half that carries the majority of
  // both fields. Passing only the first is the defect corrected in the phase's own measured basis.
  const sel = resolvePaletteSelection(
    { palette: ov.palette, paletteMapping: ov.paletteMapping },
    ov.customFilmLookParams,
  );

  const waves = preset.generators?.waves ?? [];
  let liveSlots = 0;
  let flat = true;
  let maxWinding = 0;
  for (const slot of waves) {
    const axes = slot?.axes ?? [];
    const live = axes.some(axisLive);
    if (!live) continue;
    liveSlots++;
    if (axisLive(axes[2])) flat = false;
    for (const ax of axes) {
      if (!axisLive(ax)) continue;
      maxWinding = Math.max(maxWinding, Math.abs(ax?.fm?.base ?? 0));
    }
  }

  /*
   * ⚠️ **THE ATTRACTOR IS GATED ON ITS BLEND BY THE GENERATOR ITSELF** — `lissajous.ts`'s
   * `if (this.attractorState && this.attractorParams && this.attractorBlend > 0)`. At blend 0 the figure is
   * pure waves and the named attractor is invisible.
   *
   * ⚠️ **This CONTRADICTS the plan's `22.0`, which specifies `(attractorIndex ?? -1) >= 0` and counts 10.**
   * The measured answer is **9**: `Particle Swarm II` names Aizawa at `attractorBlend: 0`, which is the very
   * preset `22.D4a` gives as its example of authored-but-inert. A DECISION outranks a predicate line, the
   * engine outranks both, and this is the third defect of the same class in that step — after the plural
   * `crystals` and `.params.type`, all three being "a field path that reads plausibly and answers wrongly".
   * `Aizawa` therefore counts **2, not 3**, and the plan's line is corrected to match.
   *
   * ⚠️ An out-of-range index resolves to no params and the generator likewise draws pure waves, so the range
   * test is part of the predicate and not a defensive nicety.
   */
  const ai = ov.attractorIndex ?? -1;
  const attractorLive = ai >= 0 && ai < ATTRACTOR_PRESETS.length && (ov.attractorBlend ?? 0) > 0;
  const attractorType = attractorLive ? (ATTRACTOR_PRESETS[ai]?.type ?? null) : null;

  const dr = preset.metadata?.designResolution;
  // ⚠️ The field is `designResolution`, NOT `designedFor` — a `metadata.designedFor` read returns nothing on
  // all 274 and the facet would be silently uniform.
  const ratio = dr && dr.height > 0 ? dr.width / dr.height : 1;
  const aspect: DesignAspect = ratio > 1.05 ? 'landscape' : ratio < 0.95 ? 'portrait' : 'square';

  return {
    preset, ov, materialName, materialLive, mode, tmEnabled,
    chainLength: chain.length, liveStyles, anyForceMode, attractorType,
    figureType: resolveFigureType(preset.generators?.type, preset.generators ?? {}).type,
    paletteName: sel.name, paletteMapping: sel.mapping,
    filmLook: ov.filmLook ?? '',
    liveSlots, flat, maxWinding, aspect,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// LABEL VOCABULARIES — one `Record<Union, string>` each, so `tsc` forces a label for a new member
// ════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ **A SECOND COPY OF `visual-fx.ts`'s `RENDER_MODE_LABELS`, AND DELIBERATELY SO.** That one lives in a
 * `lit` UI module this file may not import (rule: no side effects, Node must load it). The defence is
 * `facetcheck` §C, which matches these strings against the literals in `visual-fx.ts` — **a text grep, so a
 * behaviour-neutral rename breaks it: read the assertion before believing a failure is a regression.**
 */
export const MODE_LABELS: Record<RenderMode, string> = {
  pixel: 'Pixel', blend: 'Blend', star: 'Star', splat: 'Splat', volume: 'Volume', liquid: 'Liquid',
};
export const RIBBON_LABELS: Record<'off' | 'hybrid' | 'streaks' | 'adaptive', string> = {
  off: 'No ribbons', hybrid: 'Hybrid', streaks: 'Streaks', adaptive: 'Adaptive',
};
export const CRYSTAL_SHAPE_LABELS: Record<CrystalShape, string> = {
  hexagon: 'Hexagon', plate: 'Plate', dendrite: 'Dendrite', prism: 'Prism',
};
export const SEED_PATTERN_LABELS: Record<LiquidSeedPattern, string> = {
  fill: 'Fill', cloud: 'Cloud', blobs: 'Blobs', basin: 'Basin',
};
/**
 * ⚠️ **THE `Tint Source` DROPDOWN'S OWN FIVE LABELS, COPIED VERBATIM** — including `Material Ramp`, which is
 * NOT the stored word `material`. These were `Preset colour` / `Colour ramp` / `Dye field` until `facetcheck`
 * §C reported them as inventions: under the row heading `Tint Source` the Lab's shorter words are unambiguous,
 * and 22.D12 is the decision that the drawer speaks the Lab's vocabulary rather than a friendlier one of its own.
 */
export const TINT_LABELS: Record<LiquidTintSource, string> = {
  preset: 'Preset', palette: 'Palette', material: 'Material Ramp', ramp: 'Ramp', dye: 'Dye',
};
/** ⚠️ `'none'` is excluded from the facet values — a live gate cannot be gated by nothing. */
export const GATE_BY_LABELS: Record<ForceGateSource, string> = {
  none: 'Ungated', age: 'Age', temperature: 'Temperature', depth: 'Depth',
};
/**
 * ⚠️ **THE ENGINE'S OWN RECORD, RE-EXPORTED AND NOT A SECOND COPY.** `PALETTE_MAPPING_LABELS` lives in
 * `palette-selection.ts`, which is a pure module this file already imports, so there is no reason to restate it
 * — unlike `MODE_LABELS`, which has to be a second copy because its original is in a `lit` component. Its
 * `temperature` entry carries the precondition *(needs a material)* inline, which is `CLAUDE.md`'s rule for a
 * precondition and is therefore kept: a chip that drops it would be the only place in the UI that hides it.
 */
export const MAPPING_LABELS: Record<PaletteMapping, string> = PALETTE_MAPPING_LABELS;
export const DECAY_LABELS: Record<TrailDecayBand, string> = {
  crisp: 'Crisp', medium: 'Medium', long: 'Long', veryLong: 'Very long',
};
export const WINDING_LABELS: Record<WindingBand, string> = {
  w1: '1', w2_4: '2–4', w5_16: '5–16', w17_64: '17–64', w65_256: '65–256',
  w257_1024: '257–1024', wOver1024: 'over 1024',
};
export const ASPECT_LABELS: Record<DesignAspect, string> = {
  square: 'Square', landscape: 'Landscape', portrait: 'Portrait',
};
/**
 * ⚠️ `fixed` is `Fixed` — the Dye Field section's own word, not the expansion `Fixed colour` (see `TINT_LABELS`).
 *
 * ⚠️ **KEYED OFF `DyeFieldConfig['colourSource']` SINCE 2026-10-15, NOT OFF A HAND-COPIED UNION.** This was
 * the one label record of the six below whose key type was a second spelling of the union rather than the
 * union itself, which is why `facetcheck` §B's text scan was the ONLY instrument that could see this
 * vocabulary grow. With the indexed access type, `tsc` sees it too — §B still earns its place, because it is
 * what catches the key type being pointed back at a copy.
 */
export const DYE_COLOUR_LABELS: Record<DyeFieldConfig['colourSource'], string> = {
  temperature: 'Temperature', fixed: 'Fixed', velocity: 'Velocity', depth: 'Depth',
  // ⚠️ `Palette` is the word the Visual FX select shows and the word the Colour Palette section is titled
  // with — §C holds these labels to the SHIPPED words, so the two must stay spelled alike.
  palette: 'Palette',
  // v8 28.4. ⚠️ **`tsc` DEMANDED THIS ENTRY, which is the indexed-access key type earning its keep exactly
  // as the 2026-10-15 note above predicted** — before that change only `facetcheck` §B's text scan could
  // see this vocabulary grow, and a sixth source would have shipped with no label and no error.
  // `Ramp` is the word the Visual FX select shows; §C holds these to the shipped spelling.
  ramp: 'Ramp',
  // v8 28.15 — the undimmed read of the figure's own per-particle colours. ⚠️ **`Figure` rather than
  // `Preset`**: the liquid `Tint Source` uses `Preset` for the same idea, but in a DYE row that word would
  // read as "the dye's preset". The manual already calls this quantity *the figure's own colours*.
  figure: 'Figure',
};

/*
 * THE VALUE ORDERS — ⚠️ **`Object.keys()` of the record above, never a second hand-written list.**
 *
 * Four of these vocabularies are unions declared in `types.ts` with **NO runtime array** (`LiquidSeedPattern`,
 * `LiquidTintSource`, `ForceGateSource`, the inline `ribbonMode` union, and dye's inline `colourSource`), so
 * there is nothing importable to enumerate. The `Record<Union, string>` above IS the enumeration and `tsc`
 * forces it to be total — which is a stronger guarantee than a `const` array, since an array can silently miss
 * a member. ⚠️ **`facetcheck` §B closes the remaining gap in the other direction**, matching each of these
 * key sets against the **type declaration text** in `types.ts` — the pattern `coveragecheck` already uses for
 * `RenderMode`, and the only instrument that can see a union that GREW.
 */
export const MODE_ORDER = Object.keys(MODE_LABELS) as RenderMode[];
export const RIBBON_ORDER = Object.keys(RIBBON_LABELS) as ('off' | 'hybrid' | 'streaks' | 'adaptive')[];
export const SEED_PATTERN_ORDER = Object.keys(SEED_PATTERN_LABELS) as LiquidSeedPattern[];
export const TINT_ORDER = Object.keys(TINT_LABELS) as LiquidTintSource[];
export const DYE_COLOUR_ORDER = Object.keys(DYE_COLOUR_LABELS) as DyeFieldConfig['colourSource'][];
/** ⚠️ **`'none'` is DROPPED here, not absent from the record** — a live gate cannot be gated by nothing, and
 *  keeping the record total is what makes `tsc` demand a label if a fifth source is ever added. */
export const GATE_BY_ORDER = (Object.keys(GATE_BY_LABELS) as ForceGateSource[]).filter((v) => v !== 'none');
/** `crystal-config.ts` DOES export a runtime array, so this one is the engine's own and not a local copy. */
export const CRYSTAL_SHAPE_ORDER: readonly CrystalShape[] = CRYSTAL_SHAPES;

/**
 * The `Trail Decay` bands (⚙ invented, `22.D12`). ⚠️ **The boundaries are from the measured distribution, not
 * from round numbers** — 36 / 80 / 77 / 81 over 274 on 2026-09-24, which is why there are four and not three.
 */
const DECAY_BANDS: { band: TrailDecayBand; lo: number; hi: number }[] = [
  { band: 'crisp', lo: -Infinity, hi: 0.5 },
  { band: 'medium', lo: 0.5, hi: 0.85 },
  { band: 'long', lo: 0.85, hi: 0.97 },
  { band: 'veryLong', lo: 0.97, hi: Infinity },
];
function decayBand(v: number): TrailDecayBand {
  for (const b of DECAY_BANDS) if (v >= b.lo && v < b.hi) return b.band;
  return 'veryLong';
}

/**
 * The `Winding` bands (⚙). ⚠️ **`FM.Base` may not reach the UI as a number** (`22.D2`) — the measured range is
 * 0 to 8000 with a median of 32, so a slider or a readout would be useless and these octave-ish bands are the
 * only usable shape. Derived from the measured quantiles: 60 / 11 / 42 / 53 / 75 / 27 / 6.
 */
const WINDING_BANDS: { band: WindingBand; hi: number }[] = [
  { band: 'w1', hi: 1 }, { band: 'w2_4', hi: 4 }, { band: 'w5_16', hi: 16 },
  { band: 'w17_64', hi: 64 }, { band: 'w65_256', hi: 256 }, { band: 'w257_1024', hi: 1024 },
  { band: 'wOver1024', hi: Infinity },
];
function windingBand(v: number): WindingBand {
  for (const b of WINDING_BANDS) if (v <= b.hi) return b.band;
  return 'wOver1024';
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// THE CATALOGUE
// ════════════════════════════════════════════════════════════════════════════════════════════════════

export interface FacetDef {
  readonly key: FacetKey;
  /** `22.D12`: the SHIPPED section heading verbatim where one exists, an ⚙ invention where none does. */
  readonly label: string;
  /**
   * ⚠️ **A facet's tooltip is where its ACTIVATION SCALAR is explained in user words** (`22.8`), because
   * `22.D4`'s frame rule has an equally natural opposite reading. `tooltips.ts` is still the one owner of the
   * `title` attribute; this is the source text it registers, so the words live beside the predicate that
   * earns them and cannot drift from it silently.
   */
  readonly tip: string;
  readonly test: (r: Resolved) => boolean;
}

/** A row in the drawer: one boolean chip, or a named enumeration with its own chips. */
export type FacetRow =
  | { readonly kind: 'boolean'; readonly facet: FacetDef }
  | { readonly kind: 'enum'; readonly id: string; readonly label: string; readonly tip: string; readonly values: readonly FacetDef[] };

export interface FacetGroup {
  readonly id: FacetGroupId;
  readonly label: string;
  /**
   * ⚠️ **`22.D8`: a FIELD with one legal value today, never an `if` in the predicate.** The law that ships is
   * *any within a group, all across groups*, printed in the drawer head in words with no switch. Making the
   * combinator per-group data is what lets a later phase vary it without rewriting `matchesFilter`.
   */
  readonly combinator: 'any';
  readonly defaultOpen: boolean;
  readonly rows: readonly FacetRow[];
}

const bool = (key: BooleanFacetKey, label: string, tip: string, test: (r: Resolved) => boolean): FacetRow =>
  ({ kind: 'boolean', facet: { key, label, tip, test } });

/**
 * ⚠️ **ONE helper for "the force pass moves particles", shared by the facet, the gate and `Gate By`.** Three
 * copies of a three-clause predicate is how one of them silently loses a clause — the same argument as
 * `ratioBase`/`applyRatio` in the Composer.
 */
const forceFieldLive = (r: Resolved): boolean =>
  r.tmEnabled && (r.ov.transMapForceBlend ?? 0) > 0 && r.anyForceMode;

/**
 * **1. `MATERIALS`** — one enumeration, `overlay.material?.preset ?? 'None'`. ⚠️ Block-present and
 * `preset !== 'None'` agree at 84 in this library **by luck, not by rule**, so the predicate is the
 * `!== 'None'` test and not the presence one.
 */
const MATERIALS_GROUP: FacetGroup = {
  id: 'materials', label: 'Materials', combinator: 'any', defaultOpen: true,
  rows: [{
    kind: 'enum', id: 'material', label: 'Material',
    tip: 'Which material bundle the preset applies. A material overrides the render mode for every mode except Liquid.',
    values: [
      {
        key: 'material:None', label: 'No material',
        tip: 'Presets with no material at all — 190 of 274 when this was measured, so this is the library\'s default state, not an edge case.',
        test: (r) => !r.materialLive,
      },
      ...MATERIAL_PRESETS.map((m): FacetDef => ({
        key: `material:${m.name}` as FacetKey,
        label: m.label,
        tip: `Presets whose material is ${m.label}. A material block present but set to None does not count.`,
        test: (r) => r.materialLive && r.materialName === m.name,
      })),
    ],
  }],
};

/**
 * **2. `POPULATIONS`** — its own group under `MATERIALS` (`22.D13`), because sparks, crystals and buoyancy are
 * usually *enabled by* a material but are separate pools with their own `enabled` flags, and four presets
 * carry a block with the flag off. Folding them into `MATERIALS` would imply they are material properties,
 * which is how the `22.D4` class of misreading starts.
 */
const POPULATIONS_GROUP: FacetGroup = {
  id: 'populations', label: 'Populations', combinator: 'any', defaultOpen: true,
  rows: [
    bool('pop:sparks', 'Sparks',
      'Presets that emit sparks. Reads the pool\'s own `enabled` flag — a preset can carry spark settings without using them.',
      (r) => r.ov.sparks?.enabled === true),
    bool('pop:crystals', 'Crystals',
      'Presets that freeze crystals. Reads the pool\'s own `enabled` flag, not the presence of the block.',
      (r) => r.ov.crystal?.enabled === true),
    bool('pop:buoyancy', 'Buoyancy',
      'Presets with buoyant smoke. Reads the block\'s `enabled` flag — four presets in the library carry the block with it off.',
      (r) => r.ov.buoyancy?.enabled === true),
    {
      kind: 'enum', id: 'crystalShape', label: 'Crystal Shape',
      tip: 'Only meaningful on presets that actually freeze crystals, so these values are counted over those alone.',
      values: CRYSTAL_SHAPE_ORDER.map((s): FacetDef => ({
        key: `crystalShape:${s}` as FacetKey,
        label: CRYSTAL_SHAPE_LABELS[s],
        tip: `Presets whose crystals are ${CRYSTAL_SHAPE_LABELS[s].toLowerCase()}s. Requires crystals to be enabled.`,
        test: (r) => r.ov.crystal?.enabled === true && r.ov.crystal.shape === s,
      })),
    },
  ],
};

/** **3. `PARTICLES & TRAILS`** — how the points themselves are drawn and how long they persist. */
const PARTICLES_GROUP: FacetGroup = {
  id: 'particles', label: 'Particles & Trails', combinator: 'any', defaultOpen: true,
  rows: [
    {
      kind: 'enum', id: 'mode', label: 'Render Mode',
      tip: 'The mode the frame actually draws in, after a live material has had its say — a material overrides every mode except Liquid.',
      values: MODE_ORDER.map((m): FacetDef => ({
        key: `mode:${m}` as FacetKey,
        label: MODE_LABELS[m],
        tip: `Presets that resolve to the ${MODE_LABELS[m]} render mode, which is not always the mode the preset asks for.`,
        test: (r) => r.mode === m,
      })),
    },
    {
      kind: 'enum', id: 'ribbon', label: 'Ribbon Rendering',
      tip: 'Whether consecutive particles are joined into ribbons, and how.',
      values: RIBBON_ORDER.map((v): FacetDef => ({
        key: `ribbon:${v}` as FacetKey,
        label: RIBBON_LABELS[v],
        tip: v === 'off'
          ? 'Presets that draw separate particles rather than ribbons — the large majority.'
          : `Presets whose ribbon mode is ${RIBBON_LABELS[v]}.`,
        test: (r) => (r.ov.ribbonMode ?? 'off') === v,
      })),
    },
    bool('particles:neonLines', 'Neon Lines',
      'Presets whose particles each draw their recent path as a glowing trail. Reads `linesEnabled`; none of these is findable by name.',
      (r) => r.ov.linesEnabled === true),
    bool('particles:electricDischarge', 'Electric Discharge',
      'Presets with crackling, forking filaments of light around the figure. Reads `dischargeEnabled`.',
      (r) => r.ov.dischargeEnabled === true),
    {
      kind: 'enum', id: 'trailDecay', label: 'Trail Decay',
      tip: 'How long the trail persists, as four bands over the decay factor. The band boundaries come from the library\'s own measured distribution.',
      values: DECAY_BANDS.map(({ band }): FacetDef => ({
        key: `trailDecay:${band}` as FacetKey,
        label: DECAY_LABELS[band],
        tip: `Presets whose trail decay falls in the ${DECAY_LABELS[band].toLowerCase()} band.`,
        test: (r) => decayBand(r.preset.renderer?.decayFactor ?? 0) === band,
      })),
    },
    bool('particles:symmetryFold', 'Symmetry fold',
      'Presets that mirror the figure around a fold. A fold of 1 is no fold, so it does not count.',
      (r) => (r.ov.symmetryFold ?? 1) > 1),
    // v8 Phase 42 — the group, never Off, is the activation (a facet predicate reads an ACTIVATION scalar, 22's rule).
    bool('particles:symmetry3d', '3-D Symmetry',
      'Presets that repeat the figure in 3-D around the centre — on a ring, a sphere or a solid.',
      (r) => (r.ov.sym3dLayout ?? 'off') !== 'off'),
  ],
};

/**
 * **4. `MOTION & FIELDS`** — the six field systems plus the force pass. ⚠️ **Every one of these has a
 * DIFFERENT activation scalar** (`enabled`, `blend`, `strength`), which is `22.D4`'s point stated as data.
 */
const MOTION_GROUP: FacetGroup = {
  id: 'motion', label: 'Motion & Fields', combinator: 'any', defaultOpen: false,
  rows: [
    bool('particles:deformed', 'Deformed',
      'Presets whose figure is bent in model space before it is projected — a twist, a taper, a bend, a '
      + 'box-fold, a sphere inversion or a four-dimensional rotation. ⚠️ **Reads each operator\'s own '
      + 'ACTIVATION SCALAR, never the presence of a key**: every one of them is gated on a value (the twist, '
      + 'taper and bend on any axis non-zero, the fold on its iteration COUNT, the inversion on its AMOUNT, '
      + 'the 4D rotation on its EXTENT), so a preset can carry a cell size, a fold scale, an inversion radius '
      + 'or three 4D angles and deform nothing at all. ⚠️ **ONE row for all of them by `30.D18`** — a chip '
      + 'per operator would be six predicates to keep correct behind a handful of presets, and this answers '
      + 'the question a user actually has: *which presets bend their figure*. '
      + '⚠️⚠️ **THIS PREDICATE HAS BEEN WRONG ONCE AND THE WAY IT WENT WRONG IS THE REASON TO RE-COUNT '
      + 'RATHER THAN READ: Phase 32 added taper, bend and inversion and NONE of them was added here**, so '
      + 'from 2026-10-26 to 2026-10-27 `Pipes Taper` and `Pipes Bend` shipped as demos of an operator the '
      + '*Deformed* chip could not find — measured over the composed library, 4 matched against 6 genuinely '
      + 'deformed. **No checker saw it:** `facetcheck` measures the DISTRIBUTION, the registries and the '
      + 'filter law, and not one clause asks *does this predicate name every operator the engine has*. The '
      + 'manual already claimed the chip filtered to both demos, so the prose was right and the code was '
      + 'wrong. **Adding a model-space operator is a TWO-file edit and this is the second file** — re-count '
      + 'the clauses below against the `Deformation` section of Visual FX, never against this sentence. '
      + '⚠️ **Phase 34\'s `Offset` and `Grow` are DELIBERATELY ABSENT and their reasons are recorded in '
      + '`facetcheck` §B\'s `NOT_DEFORMATION`, which is the one place a decision of that kind lives:** an '
      + 'offset is an exact rigid translation (every real member here maps a point AS A FUNCTION of '
      + 'position), and a grow scales the wave sum by a function of the particle INDEX. `Grow` is the close '
      + 'call — it changes the silhouette materially — and if it is ever wanted findable the answer is a '
      + 'chip of its own, never a widening of this one. ⚠️ **This sentence cannot satisfy the coverage scan '
      + 'either way**: §B slices the predicate from `(r) =>` onward, so the tip is outside its corpus, which '
      + 'is exactly how an old tip once named a dropped operator while the code named nothing.',
      (r) => (r.ov.twistX ?? 0) !== 0 || (r.ov.twistY ?? 0) !== 0 || (r.ov.twistZ ?? 0) !== 0
        || (r.ov.boxFoldIterations ?? 0) > 0
        || (r.ov.fractalFoldIterations ?? 0) > 0   // v8 Phase 38 — in the SAME edit as the operator (`38.D12`)
        // v8 31.4 — the EXTENT is the activation scalar, never the three angles: at extent 0 the stage is
        // skipped, so a preset carrying three authored angles deforms nothing at all. This is `22.D4`'s
        // point in its sharpest form yet — four keys, and only one of them says whether anything happens.
        || (r.ov.wScale ?? 0) > 0
        /*
         * v8 `32.1`/`32.2`/`32.7`, added 2026-10-27. ⚠️ **Taper and bend are tested PER AXIS and signed,
         * exactly like the twist above** — `32.D4` made them triplets, so a one-axis taper is a real
         * deformation and `.some()`-style reasoning over a single scalar would miss it. ⚠️ **The inversion
         * is gated on the AMOUNT and not the radius**, which is its own export gate's rule verbatim: the
         * radius is meaningless at amount 0, so a preset carrying a radius inverts nothing.
         */
        || (r.ov.taperX ?? 0) !== 0 || (r.ov.taperY ?? 0) !== 0 || (r.ov.taperZ ?? 0) !== 0
        || (r.ov.bendX ?? 0) !== 0 || (r.ov.bendY ?? 0) !== 0 || (r.ov.bendZ ?? 0) !== 0
        || (r.ov.invertAmount ?? 0) > 0),
    bool('motion:curlNoise', 'Curl Noise',
      'Presets stirred by curl noise. Reads the block\'s `enabled` flag.',
      (r) => r.ov.curlNoise?.enabled === true),
    bool('motion:cohesion', 'Cohesion',
      'Presets whose particles pull towards their neighbours. Reads `strength` above zero — the block has no enable flag.',
      (r) => (r.ov.cohesion?.strength ?? 0) > 0),
    bool('motion:fluidAdvection', 'Fluid Advection',
      'Presets carried by a fluid velocity field. Reads `blend` above zero.',
      (r) => (r.ov.fluidAdvection?.blend ?? 0) > 0),
    bool('motion:physarum', 'Physarum Network',
      'Presets whose Physarum blend is above zero — a preset can carry a full set of Physarum settings without using any of them, and most of the library does.',
      (r) => (r.ov.physarum?.blend ?? 0) > 0),
    bool('motion:liquidField', 'Liquid Field',
      'Presets running the liquid particle field. Reads the block\'s `enabled` flag.',
      (r) => r.ov.liquidField?.enabled === true),
    {
      kind: 'enum', id: 'seedPattern', label: 'Seed Pattern',
      tip: 'How the liquid field is seeded. Counted only over presets whose liquid field is enabled.',
      values: SEED_PATTERN_ORDER.map((v): FacetDef => ({
        key: `seedPattern:${v}` as FacetKey,
        label: SEED_PATTERN_LABELS[v],
        tip: `Liquid-field presets seeded with the ${SEED_PATTERN_LABELS[v].toLowerCase()} pattern.`,
        test: (r) => r.ov.liquidField?.enabled === true && r.ov.liquidField.seedPattern === v,
      })),
    },
    bool('motion:dye', 'Dye Field',
      'Presets that inject dye into an advected field. Reads `enabled` and a non-zero opacity, matching what the processor itself treats as active.',
      (r) => r.ov.dye?.enabled === true && (r.ov.dye.opacity ?? 0) > 0),
    {
      kind: 'enum', id: 'dyeColour', label: 'Dye Colour',
      tip: 'Where the dye takes its colour from. Counted only over presets whose dye field is live.',
      values: DYE_COLOUR_ORDER.map((v): FacetDef => ({
        key: `dyeColour:${v}` as FacetKey,
        label: DYE_COLOUR_LABELS[v],
        tip: `Live-dye presets whose dye colour comes from ${v === 'fixed' ? 'a fixed colour' : v}.`,
        test: (r) => r.ov.dye?.enabled === true && (r.ov.dye.opacity ?? 0) > 0 && r.ov.dye.colourSource === v,
      })),
    },
    bool('motion:forceField', 'Force Field',
      'Presets nudged by a force read out of the Translation Map. Needs the warp enabled, a non-zero force blend AND a chain layer that can publish a field — a blend with no such layer moves nothing.',
      (r) => forceFieldLive(r)),
    bool('motion:forceGate', 'Force Gate',
      'Presets whose force field is scaled per particle. The gate is a lerp from 1, so an amount of zero is identical to ungated and does not count.',
      (r) => forceFieldLive(r) && (r.ov.transMapForceGateAmount ?? 0) > 0
        && (r.ov.transMapForceGateBy ?? 'none') !== 'none'),
    {
      kind: 'enum', id: 'gateBy', label: 'Gate By',
      tip: 'Which per-particle quantity scales the force. Counted only over presets whose gate is live.',
      values: GATE_BY_ORDER.map((v): FacetDef => ({
        key: `gateBy:${v}` as FacetKey,
        label: GATE_BY_LABELS[v],
        tip: `Gated presets whose gate reads particle ${v}.`,
        test: (r) => forceFieldLive(r)
          && (r.ov.transMapForceGateAmount ?? 0) > 0 && r.ov.transMapForceGateBy === v,
      })),
    },
  ],
};

/**
 * **5. `TRANSLATION MAP`** — ⚠️ **`Style` is the UNION of the resolved scalar and every chain layer**, through
 * `chainFromOverlay()`. Reading `overlay.transMapStyle` alone loses styles 8, 9 and 11 entirely, which is 13
 * presets, and **nothing else in the codebase would fail**.
 */
const TRANSMAP_GROUP: FacetGroup = {
  id: 'transmap', label: 'Translation Map', combinator: 'any', defaultOpen: true,
  rows: [
    bool('tm:enabled', 'Translation Map',
      'Presets that warp the image. This is the one facet above 60% of the library — the warp is the engine\'s most-used feature, not a predicate mistake.',
      (r) => r.tmEnabled),
    {
      kind: 'enum', id: 'tmStyle', label: 'Style',
      tip: 'Which warp styles are live, across the single style and every layer of a chain. A style authored with its layer muted does not count.',
      values: TRANS_MAP_STYLES.map((m): FacetDef => ({
        key: `tmStyle:${m.style}` as FacetKey,
        label: m.name,
        tip: `Presets running the ${m.name} warp style, whether as the single style or as a chain layer.`,
        test: (r) => r.liveStyles.includes(m.style),
      })),
    },
    bool('tm:chain2', 'Chain of 2+',
      'Presets whose warp is a chain of two or more layers rather than a single style.',
      (r) => r.tmEnabled && r.chainLength >= 2),
    bool('tm:warpFirst', 'Warp first',
      'Presets that warp before drawing particles instead of after. Three further presets author this pass order for a warp that never runs, and those do not count.',
      (r) => r.tmEnabled && r.ov.transMapBeforeParticles === true),
    bool('tm:dispersion', 'Dispersion',
      'Presets that split the warp per colour channel. Needs the warp enabled as well as a non-zero dispersion.',
      (r) => r.tmEnabled && (r.ov.transMapDispersion ?? 0) > 0),
    bool('tm:ifs', 'IFS Transforms',
      'Presets running the Fractal Feedback style, the only consumer of the IFS transform list. Six presets author the list; four run the style.',
      (r) => r.liveStyles.includes(4)),
  ],
};

/**
 * **6. `SURFACES`** — the two modes that render a surface rather than points. ⚠️ **`Liquid Surface` needs the
 * block AND the resolved mode**: one library preset carries the block outside `liquid` mode, and a
 * presence-only predicate would claim it draws a surface it does not draw.
 */
const SURFACES_GROUP: FacetGroup = {
  id: 'surfaces', label: 'Surfaces', combinator: 'any', defaultOpen: false,
  rows: [
    bool('surface:liquid', 'Liquid Surface',
      'Presets that draw a liquid iso-surface. Needs the liquid block AND the resolved render mode to be Liquid — one preset carries the block without the mode.',
      (r) => !!r.ov.liquid && r.mode === 'liquid'),
    {
      kind: 'enum', id: 'tint', label: 'Tint Source',
      tip: 'Where the iso-surface takes its colour from. Counted only over presets whose surface actually renders.',
      values: TINT_ORDER.map((v): FacetDef => ({
        key: `tint:${v}` as FacetKey,
        label: TINT_LABELS[v],
        tip: `Liquid-surface presets tinted from ${TINT_LABELS[v].toLowerCase()}.`,
        test: (r) => !!r.ov.liquid && r.mode === 'liquid' && r.ov.liquid.tintSource === v,
      })),
    },
    bool('surface:volume', 'Volume Render',
      'Presets that resolve to the Volume render mode.',
      (r) => r.mode === 'volume'),
  ],
};

/**
 * **7. `FIGURE`** — ⚠️ **in scope by `22.D2` even though it is outside the 09-24 brief's two families**,
 * because these partition the library better than any feature facet and need no new resolution logic.
 */
const FIGURE_GROUP: FacetGroup = {
  id: 'figure', label: 'Figure', combinator: 'any', defaultOpen: false,
  rows: [
    /*
     * v8 `36.15` — **the self-similar curve chip, HAND-WRITTEN because nothing would demand it.**
     *
     * ⚠️⚠️ **`facetcheck` §B's FAMILY SCAN IS STRUCTURALLY BLIND TO THIS ONE, AND THAT IS `36.D1`'s COST
     * ARRIVING CONCRETELY.** §B scans the `shape` group of `OVERLAY_RULES` and holds the `Deformed`
     * predicate to it — which is exactly what caught Phase 32's three missing operators. But this figure
     * type lives in `generators.lsystem`, a NON-`overlay` block, so §B does not see it at all: there is
     * no registry entry for the scan to miss.
     *
     * ⚠️⚠️ **AND `32.15` IS THE PRECEDENT FOR WHAT HAPPENS NEXT IF THIS IS FORGOTTEN.** Phase 32 added
     * taper, bend and inversion and gave none of them a clause in `particles:deformed`, so two demos
     * shipped as presets the one chip that finds them COULD NOT — 4 matched against 6 genuinely
     * deformed, with `verify` GREEN, and the MANUAL already claiming the chip found them. **A missing
     * clause reads exactly like a correct predicate over a shorter list.** `figurecheck` §E asserts the
     * registry against this catalogue in both directions, with a seed, because that is the only
     * instrument that can.
     *
     * ⚠️ **It is NOT a widening of `particles:deformed`**, and the rule for that chip says why: every
     * member of it maps a point AFTER the figure is produced, and a figure type PRODUCES it. The
     * `NOT_DEFORMATION` table owes no entry for a non-`overlay` key, so the exemption is recorded here
     * instead.
     */
    bool('figure:curve', 'Self-similar curve',
      'Presets whose figure is a self-similar curve — a space-filling or branching stroke built by '
      + 'repeating a rule — rather than a sum of sine waves. ⚠️ **Reads the RESOLVED figure type, never '
      + 'the stored string**: an unknown stored value resolves to a real type by the load order, so a '
      + 'raw read would leave such a preset in no bucket while the engine draws it happily.',
      (r) => r.figureType === 'lsystem'),
    bool('figure:attractor', 'Attractor',
      'Presets whose figure is driven by a strange attractor rather than by sine waves alone. Needs a named attractor AND a non-zero blend — one preset names one at zero, and its figure is pure waves.',
      (r) => r.attractorType !== null),
    {
      kind: 'enum', id: 'attractorType', label: 'Attractor Type',
      tip: 'Which attractor family. Counted only over presets whose attractor actually drives the figure.',
      values: [...new Set(ATTRACTOR_PRESETS.map((a) => a.type))].map((t): FacetDef => ({
        key: `attractorType:${t}` as FacetKey,
        label: t[0]!.toUpperCase() + t.slice(1),
        tip: `Attractor presets of the ${t} family.`,
        // ⚠️ `.type` is a SIBLING of `params`, which is a `number[]` — `params.type` reads nothing at all and
        // the facet would be silently empty on every preset. Corrected in the plan's 22.0 on 2026-09-24. The
        // blend gate lives in `resolve()`, which is why this reads the RESOLVED type and not the index.
        test: (r) => r.attractorType === t,
      })),
    },
    {
      kind: 'enum', id: 'liveWaves', label: 'Live Waves',
      tip: 'How many of the three wave slots actually contribute. A slot is silent only when its size and pulse are both zero, never because its winding is zero.',
      values: (['1', '2', '3'] as LiveWavesBand[]).map((n): FacetDef => ({
        key: `liveWaves:${n}` as FacetKey,
        label: n === '1' ? '1 slot' : `${n} slots`,
        tip: `Presets whose figure is built from ${n} live wave slot${n === '1' ? '' : 's'}.`,
        test: (r) => String(r.liveSlots) === n,
      })),
    },
    bool('figure:open', 'Open figure',
      'Presets whose figure does not close into a loop — a secular `Travel` term sweeps it along an axis as '
      + 'it is drawn, or an attractor is drawn as a STRAND (one trajectory, two free ends; v8 Phase 37, `37.D10`), '
      + 'so it is an arc with two free ends. ⚠️ **Its own chip by `33.D10` rather than a clause '
      + 'in `Deformed`**: *which presets are not a closed loop* is a different question from *which presets '
      + 'bend their figure*, and `30.D18`\'s *one row answers the question a user has* cuts that way here. '
      + '⚠️ **Reads the three ACTIVATION SCALARS and nothing else** — the stage tests all three against 0 '
      + 'and skips the add entirely, so there is no companion field a preset could carry inertly. '
      + '⚠️ The Randomiser can reach this from a closed preset (`travel*` is signed and centre-off), which '
      + 'is the loudest thing it can do to a figure and the reason this chip is worth its own row.',
      (r) => (r.ov.travelX ?? 0) !== 0 || (r.ov.travelY ?? 0) !== 0 || (r.ov.travelZ ?? 0) !== 0
        // v8 Phase 37 (`37.D10`) — a strand on a LIVE attractor whose type can draw one; a strand layout on a map or
        // an escape field draws the cloud, which is closed in the chip's sense, so it is not counted.
        // ⚠️ `attractorType` is a widened `string` on this record, so the TOTAL table is read through a lookup that
        // answers `false` for a word it does not hold rather than through a cast that would hide a new member.
        || (r.ov.attractorLayout === 'strand' && r.attractorType !== null
          && Object.entries(STRAND_CAPABLE).some(([t, ok]) => ok && t === r.attractorType))),
    {
      kind: 'enum', id: 'flat3d', label: 'Flat / 3D',
      tip: 'Whether any live slot drives the Z axis. A flat figure lives in one plane however it is rotated.',
      values: [
        { key: 'flat3d:flat' as FacetKey, label: 'Flat', tip: 'Presets where no live wave slot has a live Z axis.', test: (r: Resolved) => r.flat },
        { key: 'flat3d:3d' as FacetKey, label: '3D', tip: 'Presets where at least one live wave slot drives Z.', test: (r: Resolved) => !r.flat },
      ],
    },
    {
      kind: 'enum', id: 'winding', label: 'Winding',
      tip: 'How many times the figure winds, as bands over the largest winding number on a live axis. The measured range is 0 to 8000, so a number would be useless here.',
      values: WINDING_BANDS.map(({ band }): FacetDef => ({
        key: `winding:${band}` as FacetKey,
        label: WINDING_LABELS[band],
        tip: `Presets whose largest live winding number is ${WINDING_LABELS[band]}.`,
        test: (r) => windingBand(r.maxWinding) === band,
      })),
    },
    {
      kind: 'enum', id: 'aspect', label: 'Design aspect',
      tip: 'The canvas shape the preset was authored at. Most of the library is square.',
      values: (['square', 'landscape', 'portrait'] as DesignAspect[]).map((a): FacetDef => ({
        key: `aspect:${a}` as FacetKey,
        label: ASPECT_LABELS[a],
        tip: `Presets authored at a ${ASPECT_LABELS[a].toLowerCase()} design resolution.`,
        test: (r) => r.aspect === a,
      })),
    },
  ],
};

/**
 * **8. `COLOUR & GRADE`** — ⚠️ **all three enumerations go through a resolver, and two of them have two
 * sources.** `resolvePaletteSelection()` resolves `overlay.palette ?? customFilmLookParams.palette ?? 'none'`
 * and the mapping likewise; reading the overlay half alone reports palette `none` on 160 presets instead of 47.
 * ⚠️ **There is no "unset" mapping** — the resolver defaults to `'depth'`, so the Depth count includes presets
 * that never chose it, and the tooltip says so.
 */
const COLOUR_GROUP: FacetGroup = {
  id: 'colour', label: 'Colour & Grade', combinator: 'any', defaultOpen: false,
  rows: [
    {
      kind: 'enum', id: 'palette', label: 'Colour Palette',
      tip: 'The palette the frame resolves to, from the preset\'s own choice or from its film look — the film look carries the majority.',
      values: [
        {
          key: 'palette:none' as FacetKey, label: 'No palette',
          tip: 'Presets that resolve to no palette at all, taking their colour from the wave colour fields.',
          test: (r: Resolved) => !r.paletteName || r.paletteName === 'none',
        },
        ...getAllPaletteNames().map(([name, label]): FacetDef => ({
          key: `palette:${name}` as FacetKey,
          label: label || name,
          tip: `Presets that resolve to the ${label || name} palette, whether chosen directly or inherited from a film look.`,
          test: (r) => r.paletteName === name,
        })),
      ],
    },
    {
      kind: 'enum', id: 'mapping', label: 'Palette Mapping',
      tip: 'Which particle quantity indexes the palette. There is no unset value — the engine defaults to Depth, so Depth includes presets that never chose it.',
      values: PALETTE_MAPPING_ORDER.map((m): FacetDef => ({
        key: `mapping:${m}` as FacetKey,
        label: MAPPING_LABELS[m],
        tip: `Presets whose palette is indexed by ${MAPPING_LABELS[m].toLowerCase()}.`,
        test: (r) => r.paletteMapping === m,
      })),
    },
    {
      kind: 'enum', id: 'filmLook', label: 'Film Look',
      tip: 'The grading bundle the preset names. Customize means the preset authors its own grading values rather than naming a look.',
      values: [
        {
          key: 'filmLook:none' as FacetKey, label: 'No film look',
          tip: 'Presets that name no film look at all.',
          test: (r: Resolved) => r.filmLook === '',
        },
        {
          key: `filmLook:${CUSTOMIZE_FILM_LOOK}` as FacetKey, label: CUSTOMIZE_FILM_LOOK,
          tip: 'Presets that author their own grading values instead of naming a look — the large majority of the library.',
          test: (r: Resolved) => r.filmLook === CUSTOMIZE_FILM_LOOK,
        },
        ...Object.keys(FILM_LOOKS).map((n): FacetDef => ({
          key: `filmLook:${n}` as FacetKey,
          label: n,
          tip: `Presets graded with the ${n} film look.`,
          test: (r) => r.filmLook === n,
        })),
      ],
    },
  ],
};

/**
 * **The catalogue, and `22.0`'s only executable copy — do not let a second list grow.**
 *
 * ⚠️ **Groups 1–3 and 5 open by default; 4, 6, 7 and 8 collapse and NAME their contents on the collapsed
 * row** (`22.0`). The `Colour Palette` group is the long one, and it is the reason the drawer's facet search
 * is a requirement rather than a nicety.
 */
export const FACET_GROUPS: readonly FacetGroup[] = [
  MATERIALS_GROUP, POPULATIONS_GROUP, PARTICLES_GROUP, MOTION_GROUP,
  TRANSMAP_GROUP, SURFACES_GROUP, FIGURE_GROUP, COLOUR_GROUP,
];

/** Every `FacetDef` in display order, flattened once. */
export const ALL_FACETS: readonly FacetDef[] = FACET_GROUPS.flatMap((g) =>
  g.rows.flatMap((row) => (row.kind === 'boolean' ? [row.facet] : [...row.values])));

/**
 * `Record<FacetKey, string>`, DERIVED from the catalogue above (see the header's deviation (b)). ⚠️ **There is
 * exactly one authored label per facet and it lives on the `FacetDef`**, so this map cannot fall out of step
 * with the catalogue; `facetcheck` §B asserts totality in both directions and label uniqueness anyway,
 * because a *derivation* can still be wrong and a duplicate label is a UI defect either way.
 */
export const FACET_LABELS: Record<FacetKey, string> =
  Object.fromEntries(ALL_FACETS.map((f) => [f.key, f.label])) as Record<FacetKey, string>;

/** Which group a key belongs to — the grouping `matchesFilter` applies the OR within. */
export const FACET_GROUP_OF: ReadonlyMap<FacetKey, FacetGroupId> = new Map(
  FACET_GROUPS.flatMap((g) =>
    g.rows.flatMap((row) => (row.kind === 'boolean' ? [row.facet] : [...row.values]))
      .map((f) => [f.key, g.id] as const)),
);

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// THE TWO ENTRY POINTS
// ════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * **The whole predicate: one preset in, its facet keys out.** ⚠️ **Nothing else in the codebase may test a
 * preset for a feature** — that is the rule the phase exists to establish, and the reason the Reel tab's own
 * name-substring filter is folded into this model rather than left beside it (`22.7`).
 *
 * ⚠️ **`preset` must be MIGRATED** — a `UnifiedPreset` as `PresetManager` holds it, never a raw JSON body.
 */
export function computeFacets(preset: UnifiedPreset): Set<FacetKey> {
  const r = resolve(preset);
  const out = new Set<FacetKey>();
  for (const f of ALL_FACETS) if (f.test(r)) out.add(f.key);
  return out;
}

export interface FilterQuery {
  readonly include: ReadonlySet<FacetKey>;
  readonly exclude: ReadonlySet<FacetKey>;
}

/**
 * **The ONLY place the filter law lives**: OR within a group, AND across groups, exclusions always AND-NOT
 * (`22.D8`). An empty query matches everything.
 *
 * ⚠️ **Exclusion is never part of the group's OR** — `－Smoke` removes its members from the result whatever
 * else is ticked in `MATERIALS`, and it is tested FIRST so that a key which is somehow both included and
 * excluded matches NOTHING. That last state is one the UI cannot produce (a chip has one state at a time) but
 * the model must still answer, which is why `facetcheck` §F asserts it.
 */
export function matchesFilter(facets: ReadonlySet<FacetKey>, filter: FilterQuery): boolean {
  for (const key of filter.exclude) if (facets.has(key)) return false;
  if (filter.include.size === 0) return true;
  // One pass over the includes, bucketed by group; a group with any include must be satisfied by at least one.
  const satisfied = new Map<FacetGroupId, boolean>();
  for (const key of filter.include) {
    const g = FACET_GROUP_OF.get(key);
    // ⚠️ An unknown key cannot be silently ignored: that would WIDEN the result, which is the direction a
    // filter defect hides in. It is its own one-key group and therefore an unsatisfiable requirement.
    if (g === undefined) return false;
    if (facets.has(key)) satisfied.set(g, true);
    else if (!satisfied.has(g)) satisfied.set(g, false);
  }
  for (const ok of satisfied.values()) if (!ok) return false;
  return true;
}
