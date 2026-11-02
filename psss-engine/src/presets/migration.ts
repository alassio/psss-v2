import type { WaveConfig } from '../core/interfaces.ts';
import type { UnifiedPreset, SinMagicParams } from './types.ts';
// Value import, not a type: the crystal backfill below iterates the defaults so a newly added field
// cannot be forgotten. `crystal-config.ts` imports only types, so there is no cycle.
import { DEFAULT_CRYSTAL_CONFIG } from '../crystal/crystal-config.ts';
import { defaultIfsParams } from '../post-processors/ifs-presets.ts';
// v8 Step 21.4d — the adoption's two dependencies. `cyclePaletteForPair` is the reverse lookup over the nine
// `Cycle:` palettes (one enumeration, in `palettes.ts`); `FILM_LOOKS` is needed because **the adoption is
// unsafe on a preset whose look already supplies a palette** — see `adoptIndexPalette`. Neither module imports
// anything under `presets/` except `types.ts`, so there is no cycle.
import { cyclePaletteForPair } from './palettes.ts';
import { FILM_LOOKS, type FilmLookParams } from '../renderers/film-looks.ts';
import type { RenderMode } from '../core/interfaces.ts';

interface LegacyAmFm {
  Base?: number;
  Amp?: number;
  Freq?: number;
}

interface LegacyAxisWave {
  Phase?: number;
  Am?: LegacyAmFm;
  Fm?: LegacyAmFm;
}

interface LegacyPreset {
  ParticleCount?: number;
  MotionBlur?: number;
  SmoothFilter?: boolean | number;
  RenderMode?: number;
  TransMapFilter?: boolean | number;
  /**
   * The legacy pass order, and **the field that actually carries it in the JSON** — present on all 177
   * entries. Legacy `TransMapMode = { tmmApplyBefore: 0, tmmApplyAfter: 1 }`, read at `psss.js:3739-3782`:
   * mode 0 ran `gWorld.doWorld()` (the particle draw) AFTER `transMapPass()`, so the warp precedes the
   * draw — the engine's `beforeParticles: true`. Mode 1 drew first, so the newest particles are warped
   * along with the trail — `beforeParticles: false`.
   */
  TransMapMode?: number;
  TransMapStyle?: number;
  /**
   * ⚠️ **Occurs ZERO times in `public/psss_presets.json`** and was the only field this layer read until
   * 2026-09-18, which is why every one of the 177 legacy presets migrated to `beforeParticles: false` —
   * accidentally right for the 107 on mode 1 and wrong for the 70 on mode 0, of which **15 have
   * `TransMapFilter` on and are therefore the only ones that look different.** Kept as the EXPLICIT
   * override — it wins over `TransMapMode` below.
   *
   * ⚠️ **NOTHING IN THE TREE WRITES IT ANY MORE (2026-09-19).** Its one writer was `pass-order-pins.ts`'
   * `withPassOrder()`, deleted when the fifth refined-preset settle batch emptied the pin list; the field
   * survives purely as an override a hand-edited legacy JSON can set. **So do not read "it has a writer"
   * as the reason the branch below exists** — the reason is that `!== undefined` must beat `??` on a
   * `boolean | number` field, which `fieldcheck` §U asserts. The deleted file is in `CLAUDE_old.md`.
   */
  TransMapBefore?: boolean | number;
  Width?: number;
  Height?: number;
  ZoomCenterX?: number;
  ZoomCenterY?: number;
  WaveSpeed?: number;
  Rotation?: number[];
  Angle?: number[];
  SinMagicParams?: number[][];
  SinMagicParams2?: number[][];
  Waves?: LegacyAxisWave[][];
  ColorBase?: number[];
  ColorAmp?: number[];
  ColorFreq?: number[];
  ColorShift?: number[];
  VisualFx?: {
    Glow?: number;
    DepthSize?: number;
    Streaks?: number;
    Palette?: string;
    PaletteMapping?: string;
    SpeedCorrection?: boolean;
    SpeedFactor?: number;
  };
  Fractal?: {
    Type?: string;
    Params?: number[];
    Blend?: number;
    Bounds?: number[];
  };
  metadata?: { version?: number };
}

/**
 * Legacy `RenderMode` integer -> engine mode name.
 *
 * ⚠️ **This map is a DELIBERATE SUBSET of `RenderMode` and its value type must NOT be widened to it.** Its
 * domain is the legacy `RenderMode` INTEGER, so it can only ever hold modes a legacy file is able to
 * REQUEST — which is fixed forever at these five, legacy being frozen since September 2023. Every mode the
 * engine has added since is unreachable here by construction: `splat` arrived with Phase 6B materials (E7)
 * and a preset reaches it only through `overlay.renderMode` or by selecting a material, which
 * force-switches to it. **Do not "complete" this map by inventing an index for a post-legacy mode** — an
 * invented index is a mapping no legacy file can produce, so nothing would ever exercise it and nothing
 * would ever contradict it.
 *
 * ⚠️ **Stated as a rule rather than as a COUNT on purpose** (v8 Step 15.0): this comment used to read
 * *"only five of the engine's six modes"*, which is a figure that goes stale every time `RenderMode` gains
 * a member and then reads as an omission here rather than as a stale sentence.
 */
const RENDER_MODES: Record<number, 'pixel' | 'blend' | 'star' | 'volume'> = {
  0: 'pixel',
  1: 'blend',
  2: 'star',
  // ⚠️ **3 WAS `'log-density'`, RETIRED 2026-09-19 — AND THE ROW MUST STAY, POINTING SOMEWHERE ELSE.**
  // The integer is what a LEGACY FILE carries, so an import can still hand us a 3 long after the mode is
  // gone; deleting the row would leave `RENDER_MODES[3]` `undefined` and the mode would fall to whatever
  // the caller's `??` says, silently. `'star'` is not an arbitrary landing place: it is the fallback the
  // renderer ITSELF used for this mode whenever `EXT_color_buffer_float` was missing, so a 3 resolves
  // today exactly as it already did on such a context. **0 of the 177 legacy presets key it** (histogram
  // 10×1, 167×2), so no shipped body moved.
  3: 'star',
  4: 'volume',
};

const DEFAULT_SIN_MAGIC: SinMagicParams = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

/**
 * The render modes on which the per-particle colour law **reaches the screen** — v8 Step 21.4d.
 *
 * ⚠️ **NAMED, not derived from `RenderMode`, and the exclusions are three different reasons rather than one.**
 * `splat` is drawn from a material's colour ramp, `liquid` is tinted by the iso surface, and `volume` accumulates
 * density — in all three the figure's own `state.colors` is either overwritten or unused, so naming a palette
 * for such a preset would put a control in the UI that cannot move the picture (invariant 13). `src/` has ZERO
 * `switch` on `RenderMode`, so a new mode joins neither this set nor the exclusions silently — it simply is
 * not a colour path until someone says so here. **The member count is not quoted: count the union.**
 */
const INDEX_COLOUR_MODES: ReadonlySet<RenderMode> = new Set<RenderMode>(['pixel', 'blend', 'star']);

export class MigrationLayer {
  static migrate(name: string, raw: unknown): UnifiedPreset {
    const preset = raw as LegacyPreset;

    if (preset.metadata?.version === 2) {
      // D11: work on a COPY. Every backfill below writes into `p`, and several `delete` from it, so
      // operating on `raw` mutated the caller's object — an import silently rewrote the JSON it was handed,
      // and `renderer.curlNoise`/`speedFactor` were deleted from it outright. That makes `migrate` unsafe to
      // call twice on the same input and unsafe to call on anything the caller still needs, which is exactly
      // the sort of shared-mutable trap D4 documents elsewhere in this batch.
      //
      // `structuredClone` rather than a JSON round-trip: it is native, faster, and preserves `undefined` in
      // object values, which matters here because every backfill tests `=== undefined` to decide whether a
      // field is missing. A JSON round-trip DROPS undefined-valued keys, which would silently change which
      // fields get backfilled.
      const p = structuredClone(raw) as UnifiedPreset;
      // Migrate deprecated renderer.curlNoise / renderer.speedFactor into overlay
      if (p.renderer.curlNoise && !p.overlay?.curlNoise) {
        p.overlay = { ...p.overlay, curlNoise: p.renderer.curlNoise };
        delete p.renderer.curlNoise;
      }
      if (p.renderer.speedFactor !== undefined && !p.overlay?.speedFactor) {
        p.overlay = { ...p.overlay, speedFactor: p.renderer.speedFactor };
        delete p.renderer.speedFactor;
      }
      // Backfill Phase 6B buoyancy fields for older v2 exports
      if (p.overlay?.buoyancy) {
        const b = p.overlay.buoyancy as unknown as Record<string, unknown>;
        if (b.curlOctaves === undefined) b.curlOctaves = true;
        if (b.smokeThreshold === undefined) b.smokeThreshold = 0.25;
        if (b.smokeOpacity === undefined) b.smokeOpacity = 0.4;
        if (b.smokeDissipation === undefined) b.smokeDissipation = 0.95;
      }
      // Backfill Phase 6B material velocityStretch for older v2 exports
      if (p.overlay?.material) {
        const m = p.overlay.material as unknown as Record<string, unknown>;
        if (m.velocityStretch === undefined) m.velocityStretch = 1.5;

        // M4: coolingRate + dissipation -> thermalLag (seconds).
        //
        // REQUIRED, not cosmetic. Without it every previously exported material silently falls back
        // to the default lag and loses its thermal character — and the two old fields would sit in
        // the object unread, so the preset would look subtly wrong with nothing to point at.
        //
        // Inverts the old formula exactly: coolFactor = dissipation^(1 + coolingRate*2) was the
        // per-frame retention, so the half-life it implied is ln(0.5)/ln(coolFactor) frames, taken
        // at the 60 fps the old per-frame constants assumed.
        if (m.thermalLag === undefined) {
          const cr = typeof m.coolingRate === 'number' ? m.coolingRate : 0.5;
          const dis = typeof m.dissipation === 'number' ? m.dissipation : 0.98;
          // A malformed export could carry dissipation >= 1 (never decays) or <= 0; both make the
          // log undefined or negative. Fall back to the default rather than emitting NaN, which
          // would propagate into every temperature and blank the material.
          const safeDis = dis > 0 && dis < 1 ? dis : 0.98;
          const coolFactor = Math.pow(safeDis, 1 + Math.max(0, cr) * 2);
          m.thermalLag = coolFactor > 0 && coolFactor < 1
            ? Math.round((Math.log(0.5) / Math.log(coolFactor) / 60) * 1000) / 1000
            : 0.286;
        }
        delete m.coolingRate;
        delete m.dissipation;
      }
      // Backfill EVERY crystal field, for exports written before any of them existed.
      //
      // REQUIRED, not defensive. `main.ts` applies an imported block with
      // `Object.assign(currentCrystal, ov.crystal)`, which copies only the keys PRESENT in the
      // source — so a field missing from an older export silently inherits whatever the LIVE session
      // had. That leaks the current look into the imported preset, and `clusterForce` is the worst
      // case: it would go on deforming the figure at whatever value happened to be set, which reads
      // as the imported preset being broken.
      //
      // Derived from DEFAULT_CRYSTAL_CONFIG rather than hand-listed. A hand-written list covered only
      // the fields current when it was written (13 of 27), which is the same leak in slower motion:
      // every field added afterwards silently reintroduced it. Iterating the defaults means a new
      // field is backfilled the moment it is declared.
      if (p.overlay?.crystal) {
        const c = p.overlay.crystal as unknown as Record<string, unknown>;
        const defaults = DEFAULT_CRYSTAL_CONFIG as unknown as Record<string, unknown>;
        for (const key of Object.keys(defaults)) {
          if (c[key] === undefined) c[key] = defaults[key];
        }
      }
      return this.adoptIndexPalette(p);
    }

    return this.adoptIndexPalette(this.fromLegacy(name, preset));
  }

  /**
   * # v8 Step 21.4d — adopt a `Cycle:` palette for a body whose colour law IS one
   *
   * One lookup keyed on the exact `(colorBase, colorAmp)` pair (`cyclePaletteForPair`), writing
   * `overlay.palette` + `overlay.paletteMapping: 'index'`. `21.D3`'s algebra is what makes this free: the
   * legacy per-particle law **is** Quilez's cosine palette with `a = base/255`, `b = amp/255`, so a preset
   * whose pair a `Cycle:` palette carries renders **bit-identically** under `index` — the same numbers reach
   * the same law from a different field. Nothing is retuned and **no preset file is edited**, which is the
   * only way the 58-odd bodies in the read-only `public/psss_presets.json` could ever gain a palette.
   *
   * ⚠️ **CALLED ON BOTH RETURN PATHS OF `migrate` AND THAT IS A REQUIREMENT, NOT TIDINESS.** The v2 branch
   * covers every TS body and every export; `fromLegacy` covers the JSON. A version-2 export of an adopted
   * preset already carries the name and takes the idempotence exit below, so the two paths are not
   * alternatives — dropping either one would make adoption depend on which file a preset happens to live in.
   *
   * ## The three conditions, each of which has its own failure mode
   *
   * ⚠️ **1. IDEMPOTENT — a body that already states either field is left ENTIRELY alone.** An export writes
   * the resolved name, so a re-import must not re-derive it; and a user who chose `palette: 'none'` or a
   * different mapping by hand has said something this table must not overrule. The test is on **both** fields
   * together rather than per field, because a body carrying only `paletteMapping: 'index'` (which is what the
   * unnamed pairs below get) would otherwise have a palette name grafted onto it on the next import.
   *
   * ⚠️ **2. A PALETTE MAY NOT ALREADY OWN THE COLOUR — and this is the condition that makes the difference
   * between a lossless migration and a mass restyle.** `index` switches the shader's palette OFF
   * (`resolvePaletteSelection`, both guards), so adopting on a preset whose film look supplies a palette would
   * replace a LUT-mapped picture with the generator's colours. Measured over the composed library on
   * 2026-09-18: **120 bodies carry a matching pair AND resolve a palette from their look** — a fifth of the
   * library, every one of them a visible change. The look's palette is read exactly as `main.ts` reads it
   * (`'Customize'` → `overlay.customFilmLookParams`, otherwise the bundle, defaulting to `Legacy`).
   *
   * ⚠️ **3. THE COLOUR LAW MUST REACH THE SCREEN** (`INDEX_COLOUR_MODES`, plus the ribbon/neon paths, which
   * draw from `state.colors` whatever the mode). This one costs no bytes either way — the picture is identical
   * with or without it — so it is an HONESTY condition, and `21.D3` states it as one: on the 8 palette-free
   * `liquid`/`volume`/`splat` bodies the material ramp or the iso tint owns the colour, and *"a `Cycle:`
   * assignment would be a lie"*. They keep the `None` label `21.4f` gives them.
   *
   * ⚠️ **`colorBase`/`colorAmp` ARE NEVER DELETED.** They stay the source for the unnamed pairs, they are what
   * `21.4e`'s two rate controls sit beside, and deleting a legacy field would breach the standing rule against
   * modifying legacy data. Two sources for one resolved value therefore exist for good — invariant 17 in full,
   * with `resolvePaletteSelection` as the one named owner.
   *
   * ⚠️ **A pair that matches nothing still gets the MAPPING.** Five library pairs are singleton hues `21.D3`
   * deliberately refused to name; under `index` with no palette the generator reads the preset's own quadruple,
   * so this is again bit-identical, and it is what lets `21.4f` label them `Preset colour (index)` instead of
   * the outright false `None`. **`palette` is left UNSET rather than written as `'none'`**: `undefined` means
   * "inherit", `'none'` means "no palette", and on these bodies the two resolve identically today (the look
   * supplies nothing — condition 2 guarantees it), so writing the stronger word would be the migration
   * inventing an override the preset never authored, and would pin the preset against any look the user picks
   * later. **The gate counts these as "left on `'none'`" because that is what they RESOLVE to.**
   *
   * Returns the same object it was given, mutated — the caller already owns a copy (`structuredClone` in the
   * v2 branch, a fresh literal in `fromLegacy`), so there is nothing here that could reach the caller's input.
   */
  private static adoptIndexPalette(p: UnifiedPreset): UnifiedPreset {
    // 1. Idempotence, first and cheapest.
    if (p.overlay?.palette !== undefined || p.overlay?.paletteMapping !== undefined) return p;

    const g = p.generators;
    if (!g || g.type !== 'lissajous') return p;

    // 3. Does the law reach the screen? (Checked before 2, because it is the cheaper of the two.)
    const ov = p.overlay;
    const materialLive = !!ov?.material && ov.material.preset !== 'None';
    // A live material takes the mode to `splat` or `liquid` (`materialRequestedRenderMode`, main.ts) — never
    // to a colour path — so it is enough to know that one is live; this deliberately does NOT re-implement
    // `resolveModeAgainstMaterial`, which would be a second owner of that rule.
    const mode: RenderMode = ov?.renderMode ?? p.renderer?.mode ?? 'star';
    const ribbonLive = (ov?.ribbonMode !== undefined && ov.ribbonMode !== 'off') || ov?.linesEnabled === true;
    if (!ribbonLive && (materialLive || !INDEX_COLOUR_MODES.has(mode))) return p;

    // 2. Does a palette already own the colour?
    const looks = FILM_LOOKS as unknown as Record<string, FilmLookParams>;
    const lookName = ov?.filmLook;
    const lookPalette = lookName === 'Customize'
      ? (ov?.customFilmLookParams?.palette ?? 'none')
      : (looks[lookName ?? 'Legacy']?.palette ?? 'none');
    if (lookPalette !== 'none') return p;

    const name = cyclePaletteForPair(g.colorBase, g.colorAmp);
    p.overlay = {
      ...p.overlay,
      ...(name !== null ? { palette: name } : {}),
      paletteMapping: 'index',
    };
    return p;
  }

  private static fromLegacy(name: string, raw: LegacyPreset): UnifiedPreset {
    const motionBlur = Math.max(0, Math.min(8, raw.MotionBlur ?? 7));
    const renderModeIndex = raw.RenderMode ?? 2;

    const preset: UnifiedPreset = {
      metadata: {
        name,
        version: 2,
        designResolution: {
          width: raw.Width ?? 100,
          height: raw.Height ?? 100,
        },
      },
      generators: {
        type: 'lissajous',
        particleCount: (raw.ParticleCount ?? 100) * 5,
        waveSpeed: raw.WaveSpeed ?? 0.05,
        rotation: raw.Rotation ?? [0, 0, 0],
        angle: raw.Angle ?? [0, 0, 0],
        waves: this.migrateWaves(raw.Waves ?? [], raw.WaveSpeed ?? 0.05),
        colorBase: raw.ColorBase ?? [128, 128, 128],
        colorAmp: raw.ColorAmp ?? [128, 128, 128],
        colorFreq: raw.ColorFreq ?? [0.1, 0.1, 0.1],
        colorShift: raw.ColorShift ?? [0.1, 0.1, 0.1],
      },
      renderer: {
        mode: RENDER_MODES[renderModeIndex] ?? 'star',
        glow: raw.VisualFx?.Glow ?? 2.0,
        // 8.1, not 8: MotionBlur maxes at 8, and dividing by exactly 8 would give decayFactor 1.0 — a trail
        // that never fades, since the fade pass multiplies by `1 - decayFactor` (E9). The 0.1 margin leaves
        // the longest legacy trail at 0.9877, which still decays, just very slowly.
        decayFactor: motionBlur / 8.1,
        blurRadius: raw.SmoothFilter ? 4.0 : 0.0,
        depthSize: raw.VisualFx?.DepthSize ?? 0.0,
        streaks: raw.VisualFx?.Streaks ?? 0.0,
      },
      postProcessors: {
        transMap: {
          enabled: !!raw.TransMapFilter,
          style: Math.min(raw.TransMapStyle ?? 0, 4) as 0 | 1 | 2 | 3 | 4,
          // ⚠️ **`TransMapBefore` first, `TransMapMode` second, and the direction is `=== 0`.** Read off
          // BOTH loops rather than off either one's comment (invariant 24): legacy `tmmApplyBefore = 0`
          // puts `gWorld.doWorld()` after `transMapPass()`, which is the engine's warp-then-draw, i.e.
          // `beforeParticles: true`; `tmmApplyAfter = 1` is draw-then-warp, i.e. `false`. Inverted exactly
          // once, HERE, and nowhere else in the chain.
          //
          // The `!== undefined` guard is not defensive padding: `TransMapBefore` is absent from all 177
          // legacy entries, so it exists purely as an explicit override. ⚠️ **Its one in-tree writer was
          // `pass-order-pins.ts`, which held the last raw anchors at warp-last and was DELETED 2026-09-19
          // when the fifth settle batch emptied its list** — every one of the fifteen now authors its own
          // `beforeParticles`. The guard still matters: on a `boolean | number` field a `??` or a `||` reads
          // an explicit `false` as absent, so the override would be ignored exactly when it is used.
          beforeParticles: raw.TransMapBefore !== undefined
            ? !!raw.TransMapBefore
            : raw.TransMapMode === 0,
          sinMagicParams: this.migrateSinMagic(raw.SinMagicParams, name, 'SinMagicParams'),
          sinMagicParams2: this.migrateSinMagic(raw.SinMagicParams2, name, 'SinMagicParams2'),
          zoomCenter: { x: raw.ZoomCenterX ?? 50, y: raw.ZoomCenterY ?? 50 },
        },
        bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
        toneMap: {
          curve: 'none',
          exposure: 1.0,
          lift: [0, 0, 0],
          gamma: [1, 1, 1],
          gain: [1, 1, 1],
        },
      },
    };

    // Inject ifsParams default when style 4 is requested but no params provided
    if (preset.postProcessors.transMap.style === 4 && !preset.postProcessors.transMap.ifsParams) {
      preset.postProcessors.transMap.ifsParams = defaultIfsParams();
    }

    if (raw.VisualFx?.Palette && raw.VisualFx.Palette !== 'none') {
      preset.visualFx = {
        palette: raw.VisualFx.Palette,
        paletteMapping: (raw.VisualFx.PaletteMapping as 'depth' | 'phase') ?? 'depth',
        filmLook: 'clean',
      };
    }

    if (raw.Fractal?.Type) {
      preset.fractal = {
        type: raw.Fractal.Type,
        params: raw.Fractal.Params ?? [],
        blend: raw.Fractal.Blend ?? 0,
        bounds: (raw.Fractal.Bounds ?? [-2, -2, 2, 2]) as [number, number, number, number],
      };
    }

    // Migrate legacy VisualFx speed into overlay
    const legacySpeed = raw.VisualFx?.SpeedFactor;
    if (legacySpeed !== undefined && legacySpeed !== 1.0) {
      preset.overlay = { ...preset.overlay, speedFactor: legacySpeed };
    }

    return preset;
  }

  private static migrateWaves(legacyWaves: LegacyAxisWave[][], globalSpeed: number): WaveConfig[] {
    const waves: WaveConfig[] = [];

    for (let w = 0; w < 3; w++) {
      const waveAxes = legacyWaves[w];
      if (!waveAxes) {
        waves.push(this.defaultWave(globalSpeed));
        continue;
      }

      waves.push({
        speed: globalSpeed,
        axes: [
          this.migrateAxis(waveAxes[0]),
          this.migrateAxis(waveAxes[1]),
          this.migrateAxis(waveAxes[2]),
        ],
      });
    }

    return waves;
  }

  private static migrateAxis(axis?: LegacyAxisWave): { phase: number; am: { base: number; amplitude: number; frequency: number }; fm: { base: number; amplitude: number; frequency: number } } {
    if (!axis) {
      return {
        phase: 0,
        am: { base: 0, amplitude: 0, frequency: 0 },
        fm: { base: 0, amplitude: 0, frequency: 0 },
      };
    }
    return {
      phase: axis.Phase ?? 0,
      am: {
        base: axis.Am?.Base ?? 0,
        amplitude: axis.Am?.Amp ?? 0,
        frequency: axis.Am?.Freq ?? 0,
      },
      fm: {
        base: axis.Fm?.Base ?? 0,
        amplitude: axis.Fm?.Amp ?? 0,
        frequency: axis.Fm?.Freq ?? 0,
      },
    };
  }

  private static defaultWave(speed: number): WaveConfig {
    return {
      speed,
      axes: [
        { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
      ],
    };
  }

  /**
   * D13: warn when a malformed block silently disables the TranslationMap.
   *
   * `DEFAULT_SIN_MAGIC` is all zeros, so `computeSinMagic` yields zero displacement everywhere and styles 0-3
   * render exactly as if TransMap were switched off. **120 of the 177 legacy presets use style 0**, so this
   * matters often and is invisible when it happens — the preset just looks flat, with nothing logged.
   *
   * The fallback itself is correct (a preset should still load); only the silence was wrong.
   */
  private static migrateSinMagic(raw?: number[][], presetName = '?', field = 'SinMagicParams'): SinMagicParams {
    if (!raw || raw.length < 4) {
      // `undefined` is normal — many presets simply omit the block — so only a PRESENT but malformed value
      // is worth reporting.
      if (raw !== undefined) {
        console.warn(
          `PSSS: preset "${presetName}" has a malformed ${field} (expected 4 rows, got ${raw.length}); ` +
          `TransMap styles 0-3 will be inert for it`,
        );
      }
      return DEFAULT_SIN_MAGIC;
    }

    return [
      this.toQuad(raw[0]),
      this.toQuad(raw[1]),
      this.toQuad(raw[2]),
      this.toQuad(raw[3]),
    ];
  }

  private static toQuad(arr?: number[]): [number, number, number, number] {
    if (!arr || arr.length < 4) return [0, 0, 0, 0];
    return [arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0, arr[3] ?? 0];
  }
}
