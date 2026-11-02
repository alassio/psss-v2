import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId } from '../../../exploration/state.ts';
import type { UnifiedPreset } from '../../../presets/types.ts';
import type { VisualFxControls } from './visual-fx.ts';
import type {
  MaterialConfig, MaterialPresetName, BuoyancyConfig, SparkConfig,
  CrystalRenderConfig, CrystalBirthRule, ColourRampName,
} from '../../../presets/types.ts';
import {
  MATERIAL_PRESETS, getMaterialPreset, getMaterialPresentation, DEFAULT_MATERIAL_CONFIG,
  DEFAULT_BUOYANCY_CONFIG, DEFAULT_SPARK_CONFIG, ICE_CRYSTAL_DEFAULTS, materialAutoEnablesCrystals,
} from '../../../generators/material-presets.ts';
import { DEFAULT_CRYSTAL_CONFIG, CRYSTAL_SHAPES, MAX_GROWTH_CEILING } from '../../../crystal/crystal-config.ts';
// Pool bounds, so the occupancy readout's denominator matches the capacity the pool actually
// allocates rather than the raw (unvalidated) config value.
import { MIN_CRYSTAL_POOL, MAX_CRYSTAL_POOL } from '../../../crystal/crystal-pool.ts';
import { MATERIAL_TIPS } from '../tooltips.ts';
import { makeCollapsible, type Collapsible } from '../collapsible.ts';

/**
 * v8 Phase 8a-3 — row descriptors for `buildFireSection()`.
 *
 * `slider` is the original (and still the only) shape used by Buoyancy and Sparks, so those two
 * call sites are unchanged. The other three kinds exist for the Crystals section, which needs
 * dropdowns (Birth Rule, Colour Ramp), sub-headers, static hints, and two hand-built rows
 * (the rule-dependent percentile slider and the pool-occupancy readout).
 */
/**
 * ⚠️ `title` is the hover tooltip and OPTIONAL on all three interactive kinds: the builder falls back to
 * `MATERIAL_TIPS[def.key]` (or `[def.label]` for a header), so a def normally carries no `title` at all and
 * the text lives in the one table. Set it only where a shared table cannot state it.
 */
type FireRowDef =
  | { kind?: 'slider'; key: string; label: string; min: number; max: number; step: number; format?: (v: number) => string; title?: string }
  | { kind: 'select'; key: string; label: string; options: readonly string[]; title?: string }
  | { kind: 'header'; label: string; title?: string }
  | { kind: 'note'; label: string; indent?: boolean }
  | { kind: 'custom'; build: () => HTMLElement };

/** Integer-stepped sliders (pool capacity, per-frame budget) read badly as "8.00". */
const fmtInt = (v: number): string => String(Math.round(v));

/**
 * Crystal pool capacity — the hard ceiling on how many crystals can ever exist, and therefore the
 * first thing you reach for when tuning density. Mirrors the spark pool slider's range, since a
 * crystal is an additive pooled body just like a spark.
 *
 * Bounds come from `CrystalPool`'s own clamp constants rather than repeating 50/2000 (triage I5), so no
 * reachable slider value can request a capacity the pool would silently clamp away.
 */
const CRYSTAL_POOL_SLIDER: FireRowDef = {
  key: 'poolSize', label: 'Pool Size',
  min: MIN_CRYSTAL_POOL, max: MAX_CRYSTAL_POOL, step: 10, format: fmtInt,
};

/**
 * Lifecycle: how many crystals appear per frame, how long they last, the two ramp durations, then
 * the heat at which one gives way early. The percentile slider is NOT here — it is rule-dependent
 * and gets a hand-built row so its label and target field can follow `birthRule`.
 */
const CRYSTAL_LIFECYCLE_SLIDERS: FireRowDef[] = [
  { key: 'nucleationBudget', label: 'Nucleation/Frame', min: 1, max: 40, step: 1, format: fmtInt },
  { key: 'crystalLifetime', label: 'Lifetime (s)', min: 1, max: 60, step: 0.5 },
  { key: 'nucleationTime', label: 'Form Time (s)', min: 0.1, max: 2, step: 0.05 },
  { key: 'meltTime', label: 'Melt Time (s)', min: 0.1, max: 3, step: 0.05 },
  { key: 'meltThreshold', label: 'Melt Heat', min: 0, max: 1, step: 0.01 },
];

/**
 * Population soft target, as a fraction of the POOL (8a-3), not of the figure. Nucleation halts
 * above `freezeCap * 1.1`; melting is never gated, so the population self-corrects back down.
 *
 * Keeps the predecessor Crystal tab's **"Freeze Cap"** label verbatim. It is the label the phase
 * brief names as a required control, and it matches the `overlay.crystal.freezeCap` field name — so
 * a value seen in an export or in the docs traces straight back to the control that wrote it.
 */
const CRYSTAL_CAP_SLIDER: FireRowDef = { key: 'freezeCap', label: 'Freeze Cap', min: 0, max: 1, step: 0.01 };

/** Render params, ordered by impact on the look. */
const CRYSTAL_RENDER_SLIDERS: FireRowDef[] = [
  // Size leads the group: it is the control that makes a shape judgeable at all, and it is
  // per-shape compensated (SHAPE_SIZE_COMPENSATION) so switching shape does not also change weight.
  { key: 'crystalSize', label: 'Crystal Size', min: 2, max: 96, step: 1 },
  { key: 'iceOpacity', label: 'Ice Opacity', min: 0, max: 1, step: 0.01 },
  { key: 'specularStrength', label: 'Specular', min: 0, max: 4, step: 0.05 },
  { key: 'facetSharpness', label: 'Facet Sharp', min: 0, max: 1, step: 0.01 },
  { key: 'edgeBrightness', label: 'Edge Bright', min: 0, max: 4, step: 0.05 },
  { key: 'internalRefraction', label: 'Refraction', min: 0, max: 1, step: 0.01 },
];

/**
 * Growth (v8 Phase 8a-2 increment c) — the FOURTH sub-group, after Birth / Lifecycle / Appearance.
 *
 * Ordered by what you reach for first when tuning a cluster: how far a particle has to be to stick,
 * how often it does, how directional the result is, how much a crystal thickens, and finally the
 * per-frame rate limit. Ranges mirror the documented field ranges in `CrystalRenderConfig`.
 *
 * `growthEnabled` is NOT here — it is a boolean and `FireRowDef` has no checkbox kind (the section's
 * only checkbox is the hard-wired 'Enable' one, already bound to `enabled`). It gets a `custom` row
 * instead of a sixth row kind existing for one control.
 */
/**
 * v8 Phase 8b.2 — cluster force field. Deliberately NOT part of CRYSTAL_GROWTH_SLIDERS: those are
 * hidden behind `growthEnabled`, and the cluster force works with growth off (any crystal exerts it,
 * accreted or not).
 */
const CRYSTAL_FORCE_SLIDERS: FireRowDef[] = [
  // Signed: negative deflects particles around the ice, positive draws them toward it.
  { key: 'clusterForce', label: 'Cluster Force', min: -1, max: 1, step: 0.01 },
  { key: 'clusterForceRadius', label: 'Force Radius', min: 4, max: 120, step: 1, format: fmtInt },
  { key: 'clusterForceReturn', label: 'Return Force', min: 0, max: 10, step: 0.1 },
];

/**
 * v8 Phase 8b.1 — hex lattice. Part of the Growth group (both only matter while accreting), but
 * `symmetryFold` is a boolean so it gets a hand-built row like `growthEnabled`.
 */
const CRYSTAL_LATTICE_SLIDERS: FireRowDef[] = [
  { key: 'latticeSnap', label: 'Lattice Snap', min: 0, max: 1, step: 0.01 },
  { key: 'latticeCell', label: 'Lattice Cell', min: 2, max: 40, step: 1, format: fmtInt },
];

const CRYSTAL_GROWTH_SLIDERS: FireRowDef[] = [
  { key: 'accretionRadius', label: 'Accretion Radius', min: 0, max: 40, step: 1, format: fmtInt },
  { key: 'stickingProbability', label: 'Sticking Prob.', min: 0, max: 1, step: 0.01 },
  { key: 'growthAnisotropy', label: 'Anisotropy', min: 0, max: 1, step: 0.01 },
  // 8a-4: ceiling raised 3 -> 6. The old range was tuned when growth alone drove apparent size;
  // now that Crystal Size sets the base, a wider swelling range is what differentiates a mature
  // crystal from a fresh one. Bound taken from the constant the two consumers clamp to, because when
  // this said 6 and both of them said 3, the top 60 % of the slider silently did nothing.
  { key: 'maxGrowth', label: 'Max Growth', min: 1, max: MAX_GROWTH_CEILING, step: 0.05 },
  { key: 'accretionBudget', label: 'Accretion/Frame', min: 1, max: 40, step: 1, format: fmtInt },
];

const CRYSTAL_BIRTH_RULES: CrystalBirthRule[] = ['slow', 'cold', 'random'];

const CRYSTAL_RAMPS: ColourRampName[] = ['ice', 'liquid', 'organic', 'fire', 'smoke'];

export class MaterialsTab implements TabModule {
  readonly id: TabId = 'materials' as TabId;
  private controls: VisualFxControls;
  /** Unsubscribe for `onExternalChange`; called in `dispose()` so a dead tab stops reacting (D17). */
  private unsubscribeExternal: (() => void) | null = null;
  private presetSelect: HTMLSelectElement | null = null;
  private heatModeSelect: HTMLSelectElement | null = null;
  private blendModeSelect: HTMLSelectElement | null = null;
  private sliders: Map<string, HTMLInputElement> = new Map();
  private labels: Map<string, HTMLElement> = new Map();
  /**
   * v8 `31.M` — the three groups, so the tab's sync path can update their activity badges.
   * ⚠️ `null` until the panel is built, because a sync can run before the body exists.
   */
  /**
   * v8 `31.M` — the three sections' GATED bodies, handed back by the shared builder.
   * ⚠️ Needed because a preset load changes the config WITHOUT clicking the checkbox, and the box's own
   * `change` listener does not fire for that — so `syncGroupBadges()` re-gates them.
   */
  private buoyancyBody: HTMLElement | null = null;
  private sparkBody: HTMLElement | null = null;
  private crystalBody: HTMLElement | null = null;
  private groups: { gMaterial: Collapsible; gFire: Collapsible; gCrystals: Collapsible } | null = null;
  private buoyancySection: HTMLElement | null = null;
  private sparkSection: HTMLElement | null = null;
  private buoyancySliders: Map<string, HTMLInputElement> = new Map();
  private buoyancyLabels: Map<string, HTMLElement> = new Map();
  private sparkSliders: Map<string, HTMLInputElement> = new Map();
  private sparkLabels: Map<string, HTMLElement> = new Map();
  private buoyancyEnabledCheck: HTMLInputElement | null = null;
  private sparkEnabledCheck: HTMLInputElement | null = null;

  // --- v8 Phase 8a-3: Crystals section (re-homed from the deleted Crystal tab) ---
  private crystalSliders: Map<string, HTMLInputElement> = new Map();
  private crystalLabels: Map<string, HTMLElement> = new Map();
  private crystalSelects: Map<string, HTMLSelectElement> = new Map();
  private crystalEnabledCheck: HTMLInputElement | null = null;
  // The rule-dependent percentile slider. One control, two possible target fields
  // (`slowFraction` / `coldFraction`) — see `crystalFractionKey()`.
  private crystalFractionRow: HTMLElement | null = null;
  private crystalFractionCaption: HTMLElement | null = null;
  private crystalFractionSlider: HTMLInputElement | null = null;
  private crystalFractionLabel: HTMLElement | null = null;
  private crystalColdHint: HTMLElement | null = null;
  private crystalReadout: HTMLElement | null = null;
  private crystalReadoutTimer: number | null = null;
  // --- increment (c) Growth sub-group ---
  private crystalGrowthCheck: HTMLInputElement | null = null;
  private crystalFoldCheck: HTMLInputElement | null = null;
  // The five growth sliders' rows, hidden while growth is off so the section does not present five
  // inert controls. Collected as rows (not sliders) because it is the whole row that hides.
  private crystalGrowthRows: HTMLElement[] = [];

  constructor(controls: VisualFxControls) {
    this.controls = controls;
  }

  init(container: HTMLElement, _state: ExplorationState): void {
    container.innerHTML = '';
    container.style.padding = '12px';
    container.style.overflowY = 'auto';

    // Material preset dropdown
    /*
     * v8 `31.M` — **THREE COLLAPSIBLE GROUPS, and the assembly at the end of this method decides the
     * on-screen order.** Every row is built where it always was and appended into its own container;
     * nothing moved. Owner instruction, 2026-10-25, after the same change to Visual FX.
     *
     * ⚠️⚠️ **LAYOUT ONLY — no control, handler, key, default or gate is touched, so Export, Import,
     * Snapshot, History and the Mixer see an identical preset structure.** The one thing that could break
     * that is deferring construction, and `makeCollapsible` does not: collapsing toggles `hidden`.
     *
     * ⚠️ **The order is measured, not taxonomic.** Over the 292-preset library: a material is active in
     * **86 (29.5 %)**, buoyancy in **22 (7.5 %)**, sparks in **19 (6.5 %)** and crystals in **8 (2.7 %)**
     * — and the crystal subsystem is by far the LARGEST region on the tab (~33 rows against Buoyancy's 7
     * and Sparks' 8). **The biggest region was the least used, which is the whole problem.**
     *
     * ⚠️ **`Material` stays OPEN because it is the only region with no on/off state** — picking `None` is
     * how this tab is turned off — so a collapsed default would hide the control that governs everything
     * else. **`Fire` groups Buoyancy and Sparks because ONE condition already governs both: they are
     * hidden entirely unless the material is a fire type** (`syncFireSections`), and grouping them makes
     * that shared precondition visible instead of implicit.
     */
    const gMaterial = makeCollapsible({
      text: 'Material', tip: MATERIAL_TIPS['Material group'], open: true,
    });
    const gFire = makeCollapsible({ text: 'Fire', tip: MATERIAL_TIPS['Fire group'] });
    const gCrystals = makeCollapsible({ text: 'Crystals', tip: MATERIAL_TIPS['Crystals group'] });
    this.groups = { gMaterial, gFire, gCrystals };

    const presetRow = this.buildRow('Material', MATERIAL_TIPS.material);
    const sel = document.createElement('select');
    sel.className = 'form-control form-control-sm';
    sel.style.maxWidth = '200px';
    const noneOpt = document.createElement('option');
    noneOpt.value = 'None';
    noneOpt.textContent = 'None';
    sel.appendChild(noneOpt);
    for (const p of MATERIAL_PRESETS) {
      const o = document.createElement('option');
      o.value = p.name;
      o.textContent = p.label;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      const name = sel.value as MaterialPresetName;
      if (name === 'None') {
        this.controls.setMaterialConfig(null);
        this.syncSlidersToConfig(DEFAULT_MATERIAL_CONFIG);
      } else {
        const cfg = getMaterialPreset(name);
        this.controls.setMaterialConfig(cfg);
        this.syncSlidersToConfig(cfg);
        // Ice auto-enables crystals; every OTHER material auto-DISABLES them.
        //
        // The disable half is the fix. Previously only the enable existed, so crystals selected by
        // Ice survived every later material switch — leaving hard, faceted, alpha-occluding ice
        // drawn over soft materials like Organic and LiquidLight, which have no mineral vocabulary
        // and read as visually wrong. Buoyancy and sparks were always re-decided on a hot/cold
        // crossing; crystals had only half that convention.
        //
        // Still a convention rather than a lock: the Crystals Enable checkbox is untouched, so
        // `Fire + crystals` stays reachable by hand. Only what a material SWITCH decides changes.
        if (materialAutoEnablesCrystals(name)) {
          this.patchCrystal(ICE_CRYSTAL_DEFAULTS);
        } else {
          this.patchCrystal({ enabled: false });
        }
        this.syncCrystalSection();
        this.applyPresentation(name);
      }
      this.updateFireSectionsVisibility();
      this.syncFireSections();
    });
    presetRow.appendChild(sel);
    gMaterial.body.appendChild(presetRow);
    this.presetSelect = sel;

    // Heat mode selector
    const heatRow = this.buildRow('Heat Mode', MATERIAL_TIPS.heatMode);
    const heatSel = document.createElement('select');
    heatSel.className = 'form-control form-control-sm';
    heatSel.style.maxWidth = '150px';
    (['velocity', 'position', 'age'] as const).forEach(mode => {
      const o = document.createElement('option');
      o.value = mode;
      o.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      heatSel.appendChild(o);
    });
    heatSel.addEventListener('change', () => this.patchConfig({ heatMode: heatSel.value as 'velocity' | 'position' | 'age' }));
    heatRow.appendChild(heatSel);
    gMaterial.body.appendChild(heatRow);
    this.heatModeSelect = heatSel;

    // Blend mode selector
    const blendRow = this.buildRow('Blend Mode', MATERIAL_TIPS.blendMode);
    const blendSel = document.createElement('select');
    blendSel.className = 'form-control form-control-sm';
    blendSel.style.maxWidth = '150px';
    (['additive', 'alpha'] as const).forEach(mode => {
      const o = document.createElement('option');
      o.value = mode;
      o.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      blendSel.appendChild(o);
    });
    blendSel.addEventListener('change', () => this.patchConfig({ blendMode: blendSel.value as 'additive' | 'alpha' }));
    blendRow.appendChild(blendSel);
    gMaterial.body.appendChild(blendRow);
    this.blendModeSelect = blendSel;

    // Parameter sliders
    const sliderDefs: Array<{ key: keyof MaterialConfig; label: string; min: number; max: number; step: number }> = [
      { key: 'splatRadius', label: 'Splat Radius', min: 2, max: 64, step: 0.5 },
      { key: 'coreBrightness', label: 'Core Brightness', min: 0.5, max: 6, step: 0.1 },
      { key: 'haloStrength', label: 'Halo Strength', min: 0, max: 4, step: 0.1 },
      { key: 'falloffExponent', label: 'Falloff', min: 1, max: 16, step: 0.5 },
      // M4: one control replaces Cooling Rate + Dissipation, which only ever produced a single
      // scalar between them. Seconds, log-ish spread: 0.01 = temperature tracks the driver almost
      // instantly, 2.0 = heavily smeared and trailing.
      { key: 'thermalLag', label: 'Thermal Lag (s)', min: 0.01, max: 2, step: 0.01 },
      { key: 'emissionIntensity', label: 'Emission', min: 0.5, max: 10, step: 0.1 },
      { key: 'heatGain', label: 'Heat Gain', min: 0.1, max: 10, step: 0.1 },
      { key: 'velocityStretch', label: 'Velocity Stretch', min: 0, max: 1, step: 0.02 },  // M2: was 0-6. Both shader stages do clamp(velocityStretch, 0, 1) and use nothing else,
      // so five sixths of the old slider was inert -- dragging 1 -> 6 changed nothing at all.
    ];

    for (const def of sliderDefs) {
      const row = this.buildRow(def.label, MATERIAL_TIPS[def.key]);
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(def.min);
      slider.max = String(def.max);
      slider.step = String(def.step);
      slider.value = String(DEFAULT_MATERIAL_CONFIG[def.key]);
      slider.style.flex = '1';
      const lbl = document.createElement('span');
      lbl.textContent = Number(slider.value).toFixed(2);
      lbl.style.minWidth = '40px';
      lbl.style.textAlign = 'right';
      lbl.style.fontSize = '11px';
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        lbl.textContent = v.toFixed(2);
        this.patchConfig({ [def.key]: v } as Partial<MaterialConfig>);
      });
      row.appendChild(slider);
      row.appendChild(lbl);
      gMaterial.body.appendChild(row);
      this.sliders.set(def.key, slider);
      this.labels.set(def.key, lbl);
    }

    // --- Buoyancy section ---
    this.buoyancySection = this.buildFireSection(gFire.body, 'Buoyancy', [
      { key: 'strength', label: 'Strength', min: 0, max: 10, step: 0.1 },
      { key: 'returnForce', label: 'Return Force', min: 0, max: 10, step: 0.1 },
      { key: 'turbulence', label: 'Turbulence', min: 0, max: 2, step: 0.01 },
      { key: 'maxOffset', label: 'Max Offset', min: 10, max: 500, step: 10 },
      { key: 'smokeThreshold', label: 'Smoke Threshold', min: 0, max: 0.5, step: 0.01 },
      { key: 'smokeOpacity', label: 'Smoke Opacity', min: 0, max: 1, step: 0.05 },
      { key: 'smokeDissipation', label: 'Dissipation', min: 0.9, max: 1, step: 0.005 },
    ], DEFAULT_BUOYANCY_CONFIG, this.buoyancySliders, this.buoyancyLabels,
      (patch) => {
        const cfg = this.controls.getBuoyancyConfig();
        this.controls.setBuoyancyConfig({ ...cfg, ...patch });
      },
      (enabled) => {
        const cfg = this.controls.getBuoyancyConfig();
        this.controls.setBuoyancyConfig({ ...cfg, enabled });
      },
      (check) => { this.buoyancyEnabledCheck = check; },
      (body) => { this.buoyancyBody = body; },
    );

    // --- Spark section ---
    this.sparkSection = this.buildFireSection(gFire.body, 'Sparks', [
      { key: 'poolSize', label: 'Pool Size', min: 50, max: 2000, step: 50 },
      { key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.05 },
      { key: 'ejectionSpeed', label: 'Ejection Speed', min: 0.1, max: 3, step: 0.1 },
      { key: 'gravity', label: 'Gravity', min: 0, max: 1000, step: 10 },
      { key: 'drag', label: 'Drag', min: 0, max: 10, step: 0.1 },
      { key: 'maxLifetime', label: 'Lifetime', min: 0.1, max: 6, step: 0.1 },
      { key: 'coolingRate', label: 'Cooling', min: 0, max: 10, step: 0.1 },
      // WIRED 2026-08-29. The field was authored in all 16 library `sparks` blocks and read by nothing, so
      // sparks drew at the MATERIAL's radius — 1.3x-7.0x too large everywhere. Range is the authored 1-8
      // widened by one step at the top; the engine applies it unclamped (the splat pass draws quads, so the
      // point-size ceiling does not bite), which is why no engine-side clamp needs mirroring here (invariant 13).
      // ⚠️ An EXPLICIT `title`, not a `MATERIAL_TIPS` entry, and that is load-bearing: tips resolve as
      // `def.title ?? MATERIAL_TIPS[def.key]`, and the key `splatRadius` is ALREADY taken by the material's
      // own Splat Radius row. Without this the spark row would silently show the material's tooltip — a
      // description of a different control, which reads as correct and so would never be reported.
      {
        key: 'splatRadius', label: 'Spark Size', min: 1, max: 10, step: 0.5,
        title: 'Size of a spark in pixels, independent of the material’s own Splat Radius. Sparks are '
          + 'authored small (2–4) against material radii of 3–14, so they read as flecks thrown off the '
          + 'body rather than as more of it.',
      },
      { key: 'maxSparksPerFrame', label: 'Budget/Frame', min: 1, max: 40, step: 1 },
    ], DEFAULT_SPARK_CONFIG, this.sparkSliders, this.sparkLabels,
      (patch) => {
        const cfg = this.controls.getSparkConfig();
        this.controls.setSparkConfig({ ...cfg, ...patch });
      },
      (enabled) => {
        const cfg = this.controls.getSparkConfig();
        this.controls.setSparkConfig({ ...cfg, enabled });
      },
      (check) => { this.sparkEnabledCheck = check; },
      (body) => { this.sparkBody = body; },
    );

    // --- Crystals section (v8 Phase 8a-3) ---
    // Deliberately NOT gated on an active material (decision D-A): crystals work with any material
    // or with none, so this section is always visible — unlike Buoyancy/Sparks, which displace
    // particles meaninglessly without heat.
    this.buildCrystalSection(gCrystals.body);

    /*
     * v8 `31.M` — **THE ASSEMBLY. The single place this tab's order is decided**: Material, Fire,
     * Crystals — least-used last, which is the same rule the Visual FX groups follow.
     */
    container.append(gMaterial.wrap, gFire.wrap, gCrystals.wrap);

    this.updateFireSectionsVisibility();

    // Resync on EXTERNAL change, not just on tab entry. `activate()` alone is not enough: a preset
    // switch (keyboard arrows, Preview Grid click, Mixer/Randomiser output) rewrites `overlay.crystal`
    // and the material config while this tab is already on screen, and without this every crystal and
    // material control would keep displaying the previous preset's values until the tab was left and
    // re-entered. The growth sliders are the most visible case, since their rows also HIDE on
    // `growthEnabled`, so a stale read leaves five controls shown for a config that has growth off.
    this.unsubscribeExternal = this.controls.onExternalChange(() => {
      this.syncUIToCurrentConfig();
      this.updateFireSectionsVisibility();
      this.syncFireSections();
      this.syncCrystalSection();
    });
  }

  activate(): void {
    this.syncUIToCurrentConfig();
    this.updateFireSectionsVisibility();
    this.syncFireSections();
    this.syncCrystalSection();
    // Poll the pool occupancy while the tab is visible — the lifecycle nucleates and melts every
    // frame, so a one-shot read would go stale immediately. `TabRegistry.show()` can call
    // activate() twice in a row for an already-visible tab, so clear before arming or the first
    // interval leaks and never stops.
    this.deactivate();
    this.crystalReadoutTimer = window.setInterval(() => this.updateCrystalReadout(), 250);
  }

  deactivate(): void {
    if (this.crystalReadoutTimer !== null) {
      window.clearInterval(this.crystalReadoutTimer);
      this.crystalReadoutTimer = null;
    }
  }

  reset(_entryPreset: UnifiedPreset): void {
    this.syncUIToCurrentConfig();
    this.syncCrystalSection();
  }

  dispose(): void {
    // D17: drop the external-change subscription. Without it the disposed tab kept reacting to every preset
    // change and writing into DOM elements that had been replaced.
    this.unsubscribeExternal?.();
    this.unsubscribeExternal = null;
    this.deactivate();
    this.sliders.clear();
    this.labels.clear();
    this.buoyancySliders.clear();
    this.buoyancyLabels.clear();
    this.sparkSliders.clear();
    this.sparkLabels.clear();
    this.crystalSliders.clear();
    this.crystalLabels.clear();
    this.crystalSelects.clear();
    this.crystalGrowthRows = [];
  }

  private syncUIToCurrentConfig(): void {
    const cfg = this.controls.getMaterialConfig();
    if (this.presetSelect) {
      this.presetSelect.value = cfg?.preset ?? 'None';
    }
    this.syncSlidersToConfig(cfg ?? DEFAULT_MATERIAL_CONFIG);
  }

  private syncSlidersToConfig(cfg: MaterialConfig): void {
    for (const [key, slider] of this.sliders) {
      const val = cfg[key as keyof MaterialConfig];
      if (typeof val === 'number') {
        slider.value = String(val);
        const lbl = this.labels.get(key);
        if (lbl) lbl.textContent = val.toFixed(2);
      }
    }
    if (this.heatModeSelect) this.heatModeSelect.value = cfg.heatMode;
    if (this.blendModeSelect) this.blendModeSelect.value = cfg.blendMode;
  }

  private patchConfig(patch: Partial<MaterialConfig>): void {
    const current = this.controls.getMaterialConfig();
    if (!current || current.preset === 'None') return;
    const updated: MaterialConfig = { ...current, ...patch };
    this.controls.setMaterialConfig(updated);
  }

  /**
   * Label + control row. `tip` defaults to `MATERIAL_TIPS[label]`, so the ~12 HAND-BUILT rows here (Enable
   * Growth, Symmetry Fold, Slow Fraction, the three top-level dropdowns…) are tooltipped without a second
   * argument — the descriptor-driven rows pass their `def.key`'s entry explicitly instead, since a key and a
   * label are not the same string.
   */
  /**
   * One label-and-control row.
   *
   * ⚠️⚠️ **`aria` EXISTS BECAUSE THIS TAB SET NO ACCESSIBLE NAME ON ANY CONTROL** — the same gap the
   * Visual FX tab carried until `31.U2`. A screen reader read every slider and select here unnamed, and
   * `CLAUDE.md`'s rule for a spec (*select on the `aria-label`, never on position*) could not be
   * followed, because there was nothing to select on.
   *
   * ⚠️ **THREE SECTIONS LABEL THEIR CHECKBOX JUST `Enable`** (Buoyancy, Sparks, Crystals). On screen the
   * section header disambiguates them; a screen reader and a selector get neither — and the section
   * builder emits that row from ONE place, so the name has to come from the caller that knows which
   * section it is building. **A table keyed by label could not do it: the label is what collides.**
   *
   * ⚠️ **It renames nothing a user sees**, and applies only where the control has no name of its own.
   *
   * ⚠️ **The control is appended by the CALLER after this returns, so the name is applied on the next
   * microtask.** A `MutationObserver` would be the general answer and is far more machinery than the
   * problem; every caller appends synchronously in the same statement block, so one microtask suffices.
   */
  private buildRow(label: string, tip?: string, aria?: string): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.marginBottom = '6px';
    const resolved = tip ?? MATERIAL_TIPS[label];
    if (resolved) row.title = resolved;
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.minWidth = '110px';
    lbl.style.fontSize = '12px';
    lbl.style.color = '#ccc';
    queueMicrotask(() => {
      const named = row.querySelector<HTMLElement>('input,select');
      if (named && !named.getAttribute('aria-label')) {
        named.setAttribute('aria-label', aria ?? label);
      }
    });
    row.appendChild(lbl);
    return row;
  }

  /**
   * Generic "title + enable checkbox + labelled control rows" section builder.
   *
   * v8 Phase 8a-3 extended it from sliders-only to the `FireRowDef` union so the Crystals section
   * can add dropdowns, sub-headers, hints and two hand-built rows. Every extension is OPTIONAL:
   * a def with no `kind` is a slider formatted with `toFixed(2)`, exactly as before, so the
   * Buoyancy and Sparks call sites behave identically.
   */
  private buildFireSection(
    container: HTMLElement,
    title: string,
    defs: FireRowDef[],
    defaults: object,
    slidersMap: Map<string, HTMLInputElement>,
    labelsMap: Map<string, HTMLElement>,
    onSliderChange: (patch: Record<string, number>) => void,
    onEnabledChange: (enabled: boolean) => void,
    storeCheck: (check: HTMLInputElement) => void,
    storeBody: (body: HTMLElement) => void,
    onSelectChange?: (patch: Record<string, string>) => void,
    selectsMap?: Map<string, HTMLSelectElement>,
  ): HTMLElement {
    const section = document.createElement('div');
    section.style.marginTop = '16px';
    section.style.borderTop = '1px solid #333';
    section.style.paddingTop = '8px';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:12px;font-weight:600;color:#aaa;margin-bottom:8px;';
    titleEl.textContent = title;
    const titleTip = MATERIAL_TIPS[title];
    if (titleTip) titleEl.title = titleTip;
    section.appendChild(titleEl);

    // The Enable row is shared by all three sections, so its tooltip has to name the section it belongs to —
    // a single `MATERIAL_TIPS['Enable']` would say "turns this on" three times and explain nothing.
    const enableRow = this.buildRow('Enable', `Master switch for the ${title} section. Everything below is inert until it is ticked.`, `Enable ${title}`);
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = false;
    check.addEventListener('change', () => onEnabledChange(check.checked));
    storeCheck(check);
    enableRow.appendChild(check);
    section.appendChild(enableRow);

    /*
     * v8 `31.M` — **the section's BODY, gated on its own `Enable`.**
     *
     * ⚠️ **ALL THREE SECTIONS GET THIS FROM ONE PLACE, which is why the builder being shared is the whole
     * reason this change is small**: Buoyancy's 7 rows, Sparks' 8 and the crystal subsystem's ~33 are
     * gated by the same four lines. Owner instruction, 2026-10-25.
     *
     * ⚠️ **The title and the `Enable` row stay OUTSIDE the body**, so an off section still says what it
     * is and its switch is always reachable. **A gate whose own switch is inside it locks the door from
     * the inside** — the reason `Deformation` got a collapsible head instead of a predicate.
     *
     * ⚠️ **Gating hides; it never defers construction.** `display: none` stops a row being SEEN, not
     * working, so every row below still exports, still snapshots and still takes a Reset.
     */
    const body = document.createElement('div');
    body.hidden = !check.checked;
    /*
     * ⚠️ **THE BADGE IS REFRESHED HERE, AND LEAVING IT OUT WAS A DEFECT THE GATE ITSELF CONCEALED.**
     * `uicheck` caught it: the box was genuinely checked, the body revealed itself — and the head still
     * read `0`. The reason is that **`setCrystalConfig`/`setBuoyancyConfig`/`setSparkConfig` do NOT call
     * `notifyExternalChange()`** (deliberately: this tab is the writer, and a notify would echo), so the
     * `onExternalChange` subscriber that owns every other resync never runs for a click in this tab.
     * `body.hidden` worked anyway *because this listener sets it locally*, which is exactly why the
     * missing half was invisible — **the visible effect of the gate is not evidence the config-reading
     * half ran.** It is appended to this one listener rather than to each caller's `onEnabledChange`,
     * because all three sections are built from here and three copies is how one of them goes stale.
     */
    check.addEventListener('change', () => {
      body.hidden = !check.checked;
      this.syncGroupBadges();
    });
    section.appendChild(body);
    // ⚠️ Handed back so `syncGroupBadges()` can re-gate it when a PRESET changes the config without the
    // checkbox being clicked — the `change` listener above does not fire for that.
    storeBody(body);

    const defaultsRec = defaults as Record<string, unknown>;

    for (const def of defs) {
      if (def.kind === 'header') {
        const hdr = document.createElement('div');
        hdr.textContent = def.label;
        hdr.style.cssText = 'font-size:12px;color:#7ec8e3;margin:10px 0 6px 0;font-weight:600;';
        const hdrTip = def.title ?? MATERIAL_TIPS[def.label];
        if (hdrTip) hdr.title = hdrTip;
        body.appendChild(hdr);
        continue;
      }

      if (def.kind === 'note') {
        const note = document.createElement('div');
        note.textContent = def.label;
        note.style.cssText = def.indent
          ? 'font-size:10px;color:#666;margin:0 0 6px 118px;line-height:1.4;'
          : 'font-size:11px;color:#777;margin:0 0 10px 0;line-height:1.4;';
        body.appendChild(note);
        continue;
      }

      if (def.kind === 'custom') {
        body.appendChild(def.build());
        continue;
      }

      if (def.kind === 'select') {
        const row = this.buildRow(def.label, def.title ?? MATERIAL_TIPS[def.key]);
        const sel = document.createElement('select');
        sel.className = 'form-control form-control-sm';
        sel.style.maxWidth = '160px';
        for (const opt of def.options) {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          sel.appendChild(o);
        }
        sel.value = String(defaultsRec[def.key] ?? def.options[0] ?? '');
        sel.addEventListener('change', () => onSelectChange?.({ [def.key]: sel.value }));
        row.appendChild(sel);
        body.appendChild(row);
        selectsMap?.set(def.key, sel);
        continue;
      }

      // Default: slider.
      const format = def.format ?? ((v: number) => v.toFixed(2));
      const row = this.buildRow(def.label, def.title ?? MATERIAL_TIPS[def.key]);
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(def.min);
      slider.max = String(def.max);
      slider.step = String(def.step);
      slider.value = String(defaultsRec[def.key] ?? 0);
      slider.style.flex = '1';
      const lbl = document.createElement('span');
      lbl.textContent = format(Number(slider.value));
      lbl.style.minWidth = '40px';
      lbl.style.textAlign = 'right';
      lbl.style.fontSize = '11px';
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        lbl.textContent = format(v);
        onSliderChange({ [def.key]: v });
      });
      row.appendChild(slider);
      row.appendChild(lbl);
      body.appendChild(row);
      slidersMap.set(def.key, slider);
      labelsMap.set(def.key, lbl);
    }

    container.appendChild(section);
    return section;
  }

  private updateFireSectionsVisibility(): void {
    const cfg = this.controls.getMaterialConfig();
    const isFireType = cfg && cfg.preset !== 'None';
    if (this.buoyancySection) this.buoyancySection.style.display = isFireType ? '' : 'none';
    if (this.sparkSection) this.sparkSection.style.display = isFireType ? '' : 'none';
  }

  /**
   * v8 `31.M` — **the three activity badges. ONE owner for every number.**
   *
   * ⚠️ **It counts ACTIVE SUBSYSTEMS, not changed settings** — see `makeCollapsible`, where the choice
   * and its reason are recorded. `Material` counts 1 when a material is selected at all, because that
   * select IS the subsystem: picking `None` is how the tab is turned off.
   *
   * ⚠️ **Each predicate is the subsystem's own activation scalar**: a material's is its `preset` being
   * anything other than the STRING `'None'` (invariant 18: the inactive state is that string, not
   * absence), while buoyancy, sparks and crystals each use `enabled`.
   *
   * ⚠️ **The gated bodies are ALSO re-synced here**, because a config can change without the checkbox
   * being clicked — loading a preset is the common case, and the `change` listener on the box does not
   * fire for that. **A gate driven only by its own click handler is a gate that lies after an import.**
   */
  private syncGroupBadges(): void {
    if (!this.groups) return;
    const on = (b: boolean) => (b ? 1 : 0);
    const cfg = this.controls.getMaterialConfig();
    const buo = this.controls.getBuoyancyConfig();
    const spk = this.controls.getSparkConfig();
    const cry = this.controls.getCrystalConfig();
    this.groups.gMaterial.setCount(on(!!cfg?.preset && cfg.preset !== 'None'));
    this.groups.gFire.setCount(on(buo.enabled) + on(spk.enabled));
    this.groups.gCrystals.setCount(on(cry?.enabled === true));
    if (this.buoyancyBody) this.buoyancyBody.hidden = !buo.enabled;
    if (this.sparkBody) this.sparkBody.hidden = !spk.enabled;
    if (this.crystalBody) this.crystalBody.hidden = cry?.enabled !== true;
  }

  private syncFireSections(): void {
    this.syncGroupBadges();
    const buoCfg = this.controls.getBuoyancyConfig();
    if (this.buoyancyEnabledCheck) this.buoyancyEnabledCheck.checked = buoCfg.enabled;
    for (const [key, slider] of this.buoyancySliders) {
      const val = buoCfg[key as keyof BuoyancyConfig];
      if (typeof val === 'number') {
        slider.value = String(val);
        const lbl = this.buoyancyLabels.get(key);
        if (lbl) lbl.textContent = val.toFixed(2);
      }
    }

    const spkCfg = this.controls.getSparkConfig();
    if (this.sparkEnabledCheck) this.sparkEnabledCheck.checked = spkCfg.enabled;
    for (const [key, slider] of this.sparkSliders) {
      const val = spkCfg[key as keyof SparkConfig];
      if (typeof val === 'number') {
        slider.value = String(val);
        const lbl = this.sparkLabels.get(key);
        if (lbl) lbl.textContent = val.toFixed(2);
      }
    }
  }

  // =====================================================================================
  // v8 Phase 8a-3 — Crystals. Re-homed verbatim from the deleted Crystal tab; every control
  // drives the same `overlay.crystal` field through the same getCrystalConfig/setCrystalConfig
  // surface on `VisualFxControls`. No new plumbing.
  // =====================================================================================

  private buildCrystalSection(container: HTMLElement): void {
    const cfg = this.currentCrystalConfig();

    const defs: FireRowDef[] = [
      // ⚠️ Seven notes lived in this array before the 2026-08-28 tooltip pass. Four remain: one orientation
      // line (below) plus three PRECONDITIONS — a control that is an exact no-op until something else is
      // true. Per `tooltips.ts` a precondition stays INLINE, because a hover is discovered only by someone
      // who already suspects the control, which is not the person who has concluded the feature is broken.
      // Everything else those notes said is now the TOOLTIP on the control it described.
      { kind: 'note', label: 'Crystals are ADDED beside the figure as hard, faceted, occluding ice — the figure never loses a particle.' },

      // ---- Birth ----
      { kind: 'header', label: 'Birth' },
      // Pool capacity first: it bounds everything below it.
      CRYSTAL_POOL_SLIDER,
      { kind: 'select', key: 'birthRule', label: 'Birth Rule', options: CRYSTAL_BIRTH_RULES },
      // `cold` reads `temperatures[]`, which only exists while a material is active. The lifecycle
      // silently degrades to `slow` in that case (a deliberate choice, not a bug) — say so here so
      // "cold does nothing on this preset" is self-explanatory.
      { kind: 'custom', build: () => this.buildCrystalColdHint() },
      // Rule-dependent percentile slider. `slowFraction` and `coldFraction` are separate fields so
      // each rule keeps its own tuning across a rule switch; only the active one is shown.
      { kind: 'custom', build: () => this.buildCrystalFractionRow(cfg) },
      // Pool occupancy readout — the only way to see the soft cap and the turnover rate at work.
      { kind: 'custom', build: () => this.buildCrystalReadout() },

      // ---- Lifecycle ----
      { kind: 'header', label: 'Lifecycle' },
      ...CRYSTAL_LIFECYCLE_SLIDERS,
      // Population soft target, as a fraction of the pool. Kept next to the lifecycle sliders
      // because together they set the turnover rate.
      CRYSTAL_CAP_SLIDER,

      // ---- Appearance ----
      { kind: 'header', label: 'Appearance' },
      // Shape first: it changes the silhouette the sliders below then tune.
      { kind: 'select', key: 'shape', label: 'Shape', options: CRYSTAL_SHAPES },
      ...CRYSTAL_RENDER_SLIDERS,
      { kind: 'select', key: 'crystalRamp', label: 'Colour Ramp', options: CRYSTAL_RAMPS },

      // ---- Cluster force field (8b.2) ----
      // The only crystal control that changes the LISSAJOUS FIGURE rather than just adding to the
      // image, so it sits in its own group and is off by default (`clusterForce: 0`).
      { kind: 'header', label: 'Cluster Force' },
      ...CRYSTAL_FORCE_SLIDERS,
      { kind: 'note', label: 'Only crystals that have substantially formed exert force, so the field does not flicker with the lifecycle.', indent: true },

      // ---- Growth (increment c) ----
      // Fourth sub-group, and the only one with its own enable gate: `growthEnabled` defaults to
      // false, so accretion, the spatial hash and swelling are all inert until switched on here.
      { kind: 'header', label: 'Growth' },
      { kind: 'custom', build: () => this.buildCrystalGrowthToggle() },
      // Growth has TWO prerequisites, and neither is visible from this sub-group alone: the section's
      // own Enable (above) and a non-empty pool of crystals that have finished forming. Accretion
      // deposits ONTO Solid crystals, so on an empty pool — or in the first `Form Time` seconds after
      // enabling — it is correctly a no-op, which without this note reads as a broken control.
      { kind: 'note', label: 'Needs Crystals enabled AND crystals that have already formed: deposits land on existing Solid crystals, so an empty pool grows nothing.', indent: true },
      ...CRYSTAL_GROWTH_SLIDERS,

      // ---- Lattice & symmetry (8b.1) ----
      // Inside the Growth group because both only act on ACCRETED deposits — with growth off there
      // are no deposits to snap or mirror.
      { kind: 'custom', build: () => this.buildCrystalFoldToggle() },
      ...CRYSTAL_LATTICE_SLIDERS,
      { kind: 'note', label: 'Lattice Snap and Symmetry Fold act only on ACCRETED deposits, so both need Growth on.', indent: true },
    ];

    this.buildFireSection(
      container, 'Crystals', defs, cfg,
      this.crystalSliders, this.crystalLabels,
      (patch) => this.patchCrystal(patch as Partial<CrystalRenderConfig>),
      (enabled) => this.patchCrystal({ enabled }),
      (check) => { this.crystalEnabledCheck = check; },
      (body) => { this.crystalBody = body; },
      (patch) => {
        this.patchCrystal(patch as unknown as Partial<CrystalRenderConfig>);
        // The percentile row's label, bound field and visibility all follow the rule.
        if ('birthRule' in patch) this.syncCrystalFractionRow();
      },
      this.crystalSelects,
    );

    // `buildFireSection` hands back sliders, not rows, so the row is recovered from the slider's
    // parent. Done once here rather than per sync: the DOM is static after init.
    this.crystalGrowthRows = [];
    // 8b.1: the lattice sliders share this gate. They act ONLY on accreted deposits, so with growth
    // off they are inert — leaving them visible advertises two controls that cannot do anything.
    for (const def of [...CRYSTAL_GROWTH_SLIDERS, ...CRYSTAL_LATTICE_SLIDERS]) {
      if (def.kind !== undefined && def.kind !== 'slider') continue;
      const row = this.crystalSliders.get(def.key)?.parentElement;
      if (row) this.crystalGrowthRows.push(row as HTMLElement);
    }

    this.syncCrystalFractionRow();
    this.syncCrystalGrowthRows();
  }

  /**
   * `growthEnabled`'s checkbox. Hand-built because `FireRowDef` has no checkbox kind and the
   * section's single built-in checkbox is already bound to `enabled` — adding a sixth row kind for
   * one control would be worse than this.
   */
  private buildCrystalGrowthToggle(): HTMLElement {
    const row = this.buildRow('Enable Growth');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = this.currentCrystalConfig().growthEnabled === true;
    check.addEventListener('change', () => {
      this.patchCrystal({ growthEnabled: check.checked });
      this.syncCrystalGrowthRows();
    });
    this.crystalGrowthCheck = check;
    row.appendChild(check);
    return row;
  }

  /**
   * v8 Phase 8b.1 — `symmetryFold`'s checkbox. Hand-built for the same reason as `growthEnabled`'s:
   * `FireRowDef` has no checkbox kind.
   */
  private buildCrystalFoldToggle(): HTMLElement {
    const row = this.buildRow('Symmetry Fold');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = this.currentCrystalConfig().symmetryFold === true;
    check.addEventListener('change', () => {
      this.patchCrystal({ symmetryFold: check.checked });
    });
    this.crystalFoldCheck = check;
    row.appendChild(check);
    return row;
  }

  /** Hide the five growth sliders while growth is off — they are inert in that state. */
  private syncCrystalGrowthRows(): void {
    const on = this.currentCrystalConfig().growthEnabled === true;
    for (const row of this.crystalGrowthRows) row.style.display = on ? 'flex' : 'none';
  }

  private buildCrystalColdHint(): HTMLElement {
    const hint = document.createElement('div');
    hint.textContent = 'cold needs an active material; without one it behaves as slow.';
    hint.style.cssText = 'font-size:10px;color:#666;margin:0 0 6px 118px;';
    this.crystalColdHint = hint;
    return hint;
  }

  private buildCrystalFractionRow(cfg: CrystalRenderConfig): HTMLElement {
    const row = this.buildRow('Slow Fraction');
    this.crystalFractionCaption = row.firstElementChild as HTMLElement;
    const key = cfg.birthRule === 'cold' ? 'coldFraction' : 'slowFraction';
    const initial = cfg[key];
    const frac = document.createElement('input');
    frac.type = 'range';
    frac.min = '0';
    frac.max = '1';
    frac.step = '0.01';
    frac.value = String(initial);
    frac.style.flex = '1';
    const val = document.createElement('span');
    val.textContent = initial.toFixed(2);
    val.style.cssText = 'font-size:11px;color:#999;min-width:40px;text-align:right;';
    frac.addEventListener('input', () => {
      const v = parseFloat(frac.value);
      val.textContent = v.toFixed(2);
      this.patchCrystal({ [this.crystalFractionKey()]: v } as Partial<CrystalRenderConfig>);
    });
    row.appendChild(frac);
    row.appendChild(val);
    this.crystalFractionRow = row;
    this.crystalFractionSlider = frac;
    this.crystalFractionLabel = val;
    return row;
  }

  private buildCrystalReadout(): HTMLElement {
    const readout = document.createElement('div');
    readout.style.cssText = 'font-size:11px;color:#777;margin:2px 0 10px 118px;';
    readout.textContent = 'pool: 0%';
    this.crystalReadout = readout;
    return readout;
  }

  private currentCrystalConfig(): CrystalRenderConfig {
    return this.controls.getCrystalConfig?.() ?? { ...DEFAULT_CRYSTAL_CONFIG };
  }

  private patchCrystal(patch: Partial<CrystalRenderConfig>): void {
    this.controls.setCrystalConfig({ ...this.currentCrystalConfig(), ...patch });
  }

  /**
   * Apply a material's PRESENTATION defaults — film look, palette, grading, trail decay and the
   * buoyancy / spark / crystal blocks. See `MaterialPresentation` for the whole design and its evidence.
   *
   * ## The contract, in the user's own terms
   *
   * *"we want changes to be applied whenever we select a material type in the dropdown, then all related
   * settings shall apply and later they can be changed again individually in the corresponding controls."*
   * So: applied on EVERY selection (not only on arrival from `None`), and applied as ordinary writes through
   * the same setters the UI uses, so nothing here is a lock.
   *
   * ⚠️ **CALLED FROM THE DROPDOWN HANDLER ONLY, WHICH IS WHY IT LIVES HERE AND NOT IN `setMaterialConfig`.**
   * That distinction is the whole reason a shipped preset cannot be restyled by this feature.
   * `setMaterialConfig` also runs on **every slider move** within this tab, and it is the path
   * `applyPresetChange` takes when a preset authors `overlay.material` — so putting this there would
   * (a) re-assert the bundle's palette on every drag of Splat Radius, undoing any grading the user had just
   * chosen, and (b) OVERWRITE the authored film look of all ~84 material-carrying library presets at load
   * time, which is a silent library-wide restyle of exactly the kind CLAUDE.md's material-bundle notes exist
   * to prevent. A dropdown `change` event is a deliberate user act on one live session; a preset load is not.
   *
   * ⚠️ **AFTER `patchCrystal`, deliberately.** The handler's own Ice/not-Ice decision runs first and this may
   * then override it, which is the ordering that lets a future bundle (Organic is the expected one) author
   * crystals for a material `materialAutoEnablesCrystals()` says nothing about. For `Fire` the two agree.
   *
   * ⚠️ **NO explicit UI re-sync call, and that is not an omission.** Every setter used here ends in
   * `notifyExternalChange()`, and both this tab and Visual FX already subscribe via `onExternalChange` — so
   * the handles and labels follow. Adding a manual sync would be the second write path invariant 2 forbids.
   */
  private applyPresentation(name: MaterialPresetName): void {
    const p = getMaterialPresentation(name);
    if (!p) return;

    /*
     * ⚠️ **THE FILM LOOK MUST BE SET BEFORE ITS PARAMS, AND THE ORDER IS LOAD-BEARING RATHER THAN TIDY.**
     * `applyCustomParam` (`main.ts`) returns early unless the live look is already `Customize`, so a params
     * patch sent first would be written into `customFilmLookParams` and **never reach the GPU** — the exact
     * shape of the original report, a control that changes state nothing draws from. And `applyFilmLook`
     * RESEEDS `customFilmLookParams` from the named bundle it switches to, so it would also discard the patch.
     */
    if (p.filmLook) this.controls.setFilmLook(p.filmLook);
    if (p.customFilmLookParams) this.controls.setCustomFilmLookParam(p.customFilmLookParams);

    /*
     * ⚠️ **21.4g — THE ADOPTION MUST RUN AGAIN HERE, AFTER THE PARAMS, OR THE PRESENTATION LOSES ITS OWN
     * PALETTE.** Since 21.4g there is one palette area and choosing a look *writes* the look's pair into
     * `overlay.palette` / `overlay.paletteMapping`, which WIN over the `customFilmLookParams` half. Every
     * presentation set says `filmLook: 'Customize'`, and `applyFilmLook('Customize')` does **not** re-seed —
     * it adopts whatever Customize state the previous preset left. So `setFilmLook` two lines up materialises
     * a *stale* palette, and the four sets' own pairs (`Material: fire` / `temperature` and friends, patched
     * on the line above) would then resolve as losers: a material picked from the dropdown would keep the
     * previous preset's colours while every other field of the set applied. Re-adopting closes the window.
     *
     * ⚠️ **Guarded on `customFilmLookParams`, not on the palette field.** A set that patches params at all
     * has changed the live look after the adoption ran, so the adoption is stale whether or not the patch
     * names a palette; re-reading the live look is correct in both cases, and testing for `palette` would
     * make the fix depend on a field the format already requires to be complete (manual A.2).
     *
     * ⚠️ **Idempotent when there is nothing to fix** — for a set naming a real film look and no params, this
     * re-reads the same bundle `setFilmLook` just adopted. Cost is one extra palette resolve in a dropdown
     * handler; see `adoptLookPalette`'s "accepted cost" note in `main.ts`.
     *
     * ⚠️ **Since 2026-09-19 a re-adopt over a look that carries NO palette writes nothing at all**, so a
     * future set that patches params without naming a palette keeps whatever the preset had — which is the
     * intended answer, not a missed patch. All four sets today name a palette (`psss-engine-v2_how_it_works.md` §8.4), so nothing here
     * changes; the guard above stays on `customFilmLookParams` for the reason stated, and the abstain decision
     * lives in `lookPaletteForAdoption()`, never in this call site.
     */
    if (p.customFilmLookParams) this.controls.adoptLookPalette();
    if (p.decayFactor !== undefined) this.controls.setDecayFactor(p.decayFactor);

    /*
     * ⚠️ **MERGED OVER THE LIVE CONFIG, NOT OVER THE MODULE DEFAULT.** `Fire`'s block happens to state all
     * nine buoyancy and all eleven spark fields, so for Fire the two are identical — but a later bundle that
     * states three fields must leave the other six where the user had them, which is what makes this a
     * DEFAULT SET rather than a reset. `setMaterialConfig`'s own hot/cold re-decision has already run by now
     * and assigns `DEFAULT_*_CONFIG` wholesale on a temperature crossing; this lands on top of that result,
     * so an authored bundle wins over the generic default and a non-crossing swap keeps hand-tuned values.
     */
    if (p.buoyancy) this.controls.setBuoyancyConfig({ ...this.controls.getBuoyancyConfig(), ...p.buoyancy });
    if (p.sparks) this.controls.setSparkConfig({ ...this.controls.getSparkConfig(), ...p.sparks });
    if (p.crystals) this.patchCrystal(p.crystals);

    // The two sections this may have just rewritten, plus the crystal one. Their handles are owned by THIS
    // tab, so `onExternalChange` reaches them only if this tab happens to be the visible one — and it always
    // is here (the user just used its dropdown), but syncing explicitly costs nothing and does not depend on
    // that being true. The `syncFireSections()` in the dropdown handler covers the first two; the crystal
    // section needs its own call because `patchCrystal` may have overridden the handler's decision above.
    this.syncCrystalSection();
  }

  /** Which config field the single percentile slider writes to, given the active rule. */
  private crystalFractionKey(): 'slowFraction' | 'coldFraction' {
    return this.currentCrystalConfig().birthRule === 'cold' ? 'coldFraction' : 'slowFraction';
  }

  /**
   * Point the percentile row at the active rule: label text, bound value, and visibility.
   * `random` selects uniformly over live particles and has no percentile, so the row is hidden
   * rather than shown inert.
   */
  private syncCrystalFractionRow(): void {
    const cfg = this.currentCrystalConfig();
    const rule = cfg.birthRule;
    const show = rule === 'slow' || rule === 'cold';
    if (this.crystalFractionRow) this.crystalFractionRow.style.display = show ? 'flex' : 'none';
    if (this.crystalColdHint) this.crystalColdHint.style.display = rule === 'cold' ? 'block' : 'none';
    if (!show) return;
    if (this.crystalFractionCaption) {
      this.crystalFractionCaption.textContent = rule === 'cold' ? 'Cold Fraction' : 'Slow Fraction';
    }
    const v = rule === 'cold' ? cfg.coldFraction : cfg.slowFraction;
    if (this.crystalFractionSlider) this.crystalFractionSlider.value = String(v);
    if (this.crystalFractionLabel) this.crystalFractionLabel.textContent = v.toFixed(2);
  }

  private updateCrystalReadout(): void {
    if (!this.crystalReadout) return;
    // 8a-3: the denominator is the crystal POOL, so this reads as "how full is the pool" and is
    // directly comparable to the Freeze Cap slider.
    //
    // ⚠️ **The capacity comes from the POOL, not from `overlay.crystal.poolSize`** (triage I5). This
    // re-derived it in the UI by re-applying `CrystalPool`'s own
    // `clamp(floor(poolSize), MIN_CRYSTAL_POOL, MAX_CRYSTAL_POOL)`, which was correct but was a second
    // copy of the clamp. `poolSize` arrives from an imported preset with no validation, so the two
    // copies drifting apart prints a count against a capacity that was never allocated — e.g.
    // "30% (1500 / 5000)" when only 2000 slots exist. `getFrozenFraction()` divides by the real
    // allocation, so the numerator and denominator now come from the same place by construction.
    const frac = this.controls.getFrozenFraction?.() ?? 0;
    const cap = this.controls.getCrystalCapacity?.() ?? 0;
    this.crystalReadout.textContent = `pool: ${(frac * 100).toFixed(0)}% (${Math.round(frac * cap)} / ${cap})`;
  }

  private syncCrystalSection(): void {
    const cfg = this.currentCrystalConfig();
    if (this.crystalEnabledCheck) this.crystalEnabledCheck.checked = cfg.enabled;
    if (this.crystalGrowthCheck) this.crystalGrowthCheck.checked = cfg.growthEnabled === true;
    if (this.crystalFoldCheck) this.crystalFoldCheck.checked = cfg.symmetryFold === true;
    for (const [key, sel] of this.crystalSelects) {
      const val = cfg[key as keyof CrystalRenderConfig];
      if (typeof val === 'string') sel.value = val;
    }
    // CRYSTAL_GROWTH_SLIDERS must be in this list or the growth sliders silently stop resyncing on
    // preset change / import / Reset.
    const allSliders: FireRowDef[] = [
      CRYSTAL_POOL_SLIDER, ...CRYSTAL_LIFECYCLE_SLIDERS, CRYSTAL_CAP_SLIDER,
      ...CRYSTAL_RENDER_SLIDERS, ...CRYSTAL_GROWTH_SLIDERS,
      // 8b.1 / 8b.2 — same rule as the comment above: a slider group omitted here silently stops
      // resyncing on preset change, import and Reset, so its knob keeps showing a stale value.
      ...CRYSTAL_LATTICE_SLIDERS, ...CRYSTAL_FORCE_SLIDERS,
    ];
    for (const def of allSliders) {
      if (def.kind !== undefined && def.kind !== 'slider') continue;
      const slider = this.crystalSliders.get(def.key);
      const lbl = this.crystalLabels.get(def.key);
      const val = cfg[def.key as keyof CrystalRenderConfig];
      if (typeof val !== 'number') continue;
      if (slider) slider.value = String(val);
      if (lbl) lbl.textContent = (def.format ?? ((v: number) => v.toFixed(2)))(val);
    }
    this.syncCrystalFractionRow();
    this.syncCrystalGrowthRows();
    this.updateCrystalReadout();
  }
}
