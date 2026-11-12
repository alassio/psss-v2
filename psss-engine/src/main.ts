import './ui/layout.css';
import { resolveFigureType } from './generators/figure-types.ts';
import { detectBackend } from './core/compute-backend.ts';
import { BOX_FOLD_DEFAULT_LIMIT, CHANNEL_DRIVERS } from './core/deform-limits.ts';
import { FRACTAL_FOLD_DEFAULT_LIMIT, FRACTAL_FOLD_DEFAULT_SCALE } from './core/fractal-fold.ts';
import { createDefaultConfig } from './core/config.ts';
import { compileProgram, TRAIL_SANITISE_GLSL, DIAG_SENTINEL, DIAG_SENTINEL_THRESHOLD } from './core/gl-program.ts';
import { PresetManager } from './presets/manager.ts';
// The version-suffix rule, shared with the import path rather than reimplemented — see `renamePreset`.
import { nextVersionedName } from './ui/synthesis-lab/export.ts';
import { LissajousGenerator } from './generators/lissajous.ts';
import type { GeneratorState, RenderMode, ChannelDriver } from './core/interfaces.ts';
import { ATTRACTOR_PRESETS } from './generators/attractors.ts';
import { HDRParticleRenderer } from './renderers/hdr-particle.ts';
import { RibbonRenderer, type RibbonMode } from './renderers/ribbon-renderer.ts';
import { NeonLineRenderer } from './renderers/neon-line-renderer.ts';
import { ElectricDischarge, DISCHARGE_DEFAULTS } from './post-processors/electric-discharge.ts';
import { SYM3D_DEFAULTS, type Sym3dConfig } from './core/symmetry-groups.ts';
import { TranslationMapProcessor, type TransMapConfig } from './post-processors/trans-map.ts';
import { TransMapForceField } from './post-processors/trans-map-force.ts';
import { DepthFieldPass } from './post-processors/depth-field.ts';
import { buildChainPlan, chainFromOverlay, chainSignature, cloneChain, describePlan, hasLayerFor, isLegacyExpressible, isStyleActive, makeLayer, normaliseChain } from './post-processors/trans-map-chain.ts';
import { BloomProcessor } from './post-processors/bloom.ts';
import { ToneMapProcessor } from './post-processors/tone-map.ts';
// ⚠️ `paletteMappingToInt` is deliberately NOT imported here any more (21.4c). Every site that used it is
// now routed through `applyPaletteSelection`, and importing it again would let a fourth site re-derive the
// uniform int from one of the two sources — invariant 17's "nothing may write the resolved value afterwards".
import { FILM_LOOKS, CUSTOMIZE_FILM_LOOK } from './renderers/film-looks.ts';
import type { FilmLookParams, PaletteMapping } from './renderers/film-looks.ts';
import {
  resolvePaletteSelection, lookPaletteForAdoption, PALETTE_UNSET, INDEX_SWATCH_POS,
  type PaletteSelection,
} from './renderers/palette-selection.ts';
import type { GPUTarget, AttractorParams } from './core/interfaces.ts';
import type { UnifiedPreset, OverlayState, PhysarumConfig, FluidAdvectionConfig, BuoyancyConfig, SparkConfig, VolumeRenderConfig, LiquidSurfaceConfig, CohesionConfig, LiquidFieldConfig, DyeFieldConfig, MaterialConfig, ProceduralFlowConfig, FluidFeedbackConfig, CrystalRenderConfig, TransMapLayer, TransMapStyle, ForceGateSource, SinMagicParams, SplatShear } from './presets/types.ts';
import { PhysarumProcessor, PHYSARUM_TRAIL_COLOUR_AUTO, PHYSARUM_TRAIL_COLOUR_PRESET } from './generators/physarum.ts';
import { getPaletteLUT, MATERIAL_RAMP_PREFIX } from './presets/palettes.ts';
// v8 Step 15.7 — the dye's `'temperature'` source indexes the LIVE material's ramp, the same precedence the
// splat path uses, rather than introducing a second colour vocabulary for one field.
import { getColourRampData } from './generators/colour-ramps.ts';
// ⚠️ **`resolveModeAgainstMaterial` is IMPORTED, not declared here — v8 22.1 moved it** (see the pointer
// comment where it used to live). `materialRequestedRenderMode` is deliberately NOT imported: this file only
// ever mentioned it in prose, and an unused import would have read as a call site to the next reader.
import { DEFAULT_BUOYANCY_CONFIG, DEFAULT_COHESION_CONFIG, DEFAULT_DYE_CONFIG, DEFAULT_LIQUID_CONFIG, DEFAULT_LIQUID_FIELD_CONFIG, DEFAULT_SPARK_CONFIG, DEFAULT_VOLUME_CONFIG, materialAutoEnablesFireBehaviour, resolveModeAgainstMaterial } from './generators/material-presets.ts';
import { DEFAULT_CRYSTAL_CONFIG } from './crystal/crystal-config.ts';
import { FluidAdvectionProcessor } from './post-processors/fluid-advection.ts';
import { DyeFieldProcessor } from './post-processors/dye-field.ts';
import { DEFAULT_PROCEDURAL_FLOW, cloneFlowConfig } from './post-processors/flow-archetypes.ts';
import { defaultIfsParams, cloneIfsParams } from './post-processors/ifs-presets.ts';
import { SynthesisLabPanel, isTabId } from './ui/synthesis-lab/panel.ts';
import type { VisualFxControls } from './ui/synthesis-lab/tabs/visual-fx.ts';
// 2026-10-31 — `readFigure` is the ONE owner of a wave slot's `silent` rule; see `getLiveWaveLevels`.
import { readFigure } from './ui/synthesis-lab/composer-model.ts';
import {
  MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT, SPEED_MIN, SPEED_MAX,
  PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX, MAX_TRAIL_DECAY,
} from './ui/synthesis-lab/tabs/visual-fx.ts';
import { computePresetStatistics } from './exploration/preset-stats.ts';
import { PerfGuard } from './exploration/perf-guard.ts';
import { PerfHud } from './ui/perf-hud.ts';
import { PerfRun, perfTestReel } from './ui/perf-run.ts';
import { stripDeploymentAssignment } from './presets/deployment-format.ts';
import { PreviewGridPanel } from './ui/preview-grid/panel.ts';
import { GridTileRenderer } from './ui/preview-grid/grid-tile-renderer.ts';
import type { PresetFilterModel } from './ui/preview-grid/filter-model.ts';
import { FacetIndex, FilterState } from './ui/preview-grid/filter-model.ts';
// v8 Phase 19 — the Reel. `reel-model.ts` is pure (zero imports) and owns every timing figure; the runner
// below owns nothing but the clock reading and the GL wiring.
import {
  ReelStore,
  createLocalStoragePersistence,
  extractDeploymentReels,
  REEL_DEPLOYMENT_FILE,
  REEL_DEPLOYMENT_GLOBAL,
} from './presets/reel-store.ts';
import type { ReelControls } from './ui/synthesis-lab/tabs/reel.ts';
import { ReelCursor, resolveReel, transitionMix, type Reel, type ReelTransition, type ResolvedReel } from './exploration/reel-model.ts';
import { ReelCrossfade } from './post-processors/reel-crossfade.ts';

/**
 * Build-time literal substituted by Vite's `define` (`vite.config.ts`): `false` under `npm run dev`, `true`
 * in the deployable `npm run build` output.
 *
 * Declared here rather than in a `.d.ts` on purpose — `deadcheck` enumerates its corpus from `src`, so a file
 * added for the build's convenience moves a shipped checker's count in the direction that reads like an engine
 * regression. A module-scoped `declare const` emits nothing and needs no file.
 */
declare const __PSSS_STANDALONE__: boolean;

/**
 * The WebView2 host channel (v8 Phase 20) — `window.chrome.webview`, injected by a WebView2 host and
 * **absent everywhere else**.
 *
 * ⚠️ **Every call site must tolerate its absence**, and that is not defensive coding: `?screensaver=1` is a
 * query parameter precisely so the mode is reachable from `npm run dev` and from an ordinary browser (20.10's
 * Playwright spec is the only machine instrument this phase has), and in both of those `chrome.webview` is
 * undefined. A host-only channel would make the mode untestable, which is how a deployment-only path ships
 * broken. ⚠️ **It is also the reason the two posters below need no mode gate** — in a browser they are a
 * no-op, so the browser's behaviour stays byte-identical without a `screensaver` test in front of them.
 *
 * Two messages exist, and they are NOT symmetric: `psss-exit` is the screensaver asking to be closed
 * (20.1's `requestScreensaverExit`), `psss-fatal` is the page reporting that it cannot run at all
 * (a missing `psss_presets.json`, which reaches a screensaver as a black screen with no diagnosis).
 */
function postToHost(message: { type: 'psss-exit' | 'psss-fatal'; [k: string]: unknown }): void {
  const host = (window as unknown as { chrome?: { webview?: { postMessage?: (m: unknown) => void } } })
    .chrome?.webview;
  // `try` because `postMessage` throws on a value it cannot structurally clone, and a throw on the FATAL
  // path would replace the engine's own diagnosis with an unrelated one. Both payloads here are plain
  // strings, so this cannot fire today — it guards the next payload, not this one.
  try {
    host?.postMessage?.(message);
  } catch (err) {
    console.warn('[host] postMessage failed', err);
  }
}

/**
 * Non-finite trap at the GL UPLOAD BOUNDARY — opt-in via `?gldiag=1`, installed before anything
 * else touches the context.
 *
 * ⚠️ **This exists because a three-stage probe located the fault to "GPU-side" and then STOPPED
 * DISCRIMINATING.** The 2026-08-22 pass on `Chain Flow Split` + material Fire read
 * `texB nan=4096 | texA nan=4096 | cpu none (arrays 7/8)` on 14 consecutive probes: decisive that
 * the particle draw poisons `texB` in the same frame the decay blit sanitised it, and decisive that
 * no array `getState()` publishes is to blame. Silent on WHICH of the ~15 scalar uniforms or ~11
 * derived attribute buffers that draw uploads carried the NaN — and reading them one at a time is
 * exactly the method that had already been wrong twice (invariant 21's lesson: add a stage, do not
 * reinterpret the reading you have).
 *
 * Wrapping the context is what makes this a STAGE rather than another guess. It covers every
 * `uniform*` and `bufferData`/`bufferSubData` call in the entire engine — including the ones no
 * audit read, which is the whole point, since a site you did not think to check is precisely where
 * the fault has been hiding. A per-site `Number.isFinite` sprinkle would have needed 26 edits and
 * still only covered the sites I guessed at.
 *
 * ⚠️ **Records ONCE per distinct (method, callsite) pair, and the KEY IS THE WHOLE POINT — getting it
 * wrong is what made the 2026-08-22 logs unreadable.** The key used to include
 * `detail.split(' ')[0]`, which for `bufferData` is the CHANGING COUNT (`"12/99000"`), so it differed
 * every frame, `seen` never hit, and the "once per call site" contract silently did not hold: the trap
 * logged at 60 Hz and buried the first report — the only one that names a producer before downstream
 * state is poisoned. Uniform reports happened to begin with the literal `arg`/`index` and so deduped
 * correctly, which is why the defect looked like "some sites are noisy" rather than like a bug here.
 * **Key on identity (method + callsite) only; put the varying part in the VALUE.**
 *
 * Nothing is printed. Each entry accumulates a count and its worst-seen detail into a record the
 * capture in `probeTrail` emits once, so an upload fault arrives correlated with the stage reads from
 * the same frames instead of interleaved with them. The trimmed stack frame is what turns "some
 * uniform is NaN" into a file and a line.
 *
 * ⚠️ **Opt-in, and it must stay that way.** This intercepts two of the hottest calls in the frame
 * and scans every uploaded array — `bufferData` on 9000 particles × 11 buffers is ~300k float
 * tests per frame. It is a diagnostic, not a mode to leave on. Do not "tidy" it into an
 * always-on assertion, and do not extend it to `texImage2D` without measuring first.
 */
interface UploadFault {
  method: string;
  site: string;
  /** How many distinct calls from this site carried a non-finite value. */
  frames: number;
  /** The detail string of the worst call seen, by `worstSeverity`. */
  worst: string;
  /** Bad-entry count for a buffer upload, 1 for a scalar uniform. Decides which `worst` is kept. */
  worstSeverity: number;
}
/** Keyed by `method|site` — see the dedup note above. Read by the capture, never printed directly. */
const glUploadFaults = new Map<string, UploadFault>();

/**
 * A fresh all-zero 4×4 wave table — the "no preset loaded" fallback for `getTransMapWaveTables`.
 *
 * A function rather than a constant on purpose: the accessor hands its tables over BY REFERENCE, and a shared
 * constant would be the one table a caller could mutate without touching preset data, i.e. the one place the
 * by-reference contract would appear safe to break.
 */
const zeroSinMagic = (): SinMagicParams => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

function installGlUploadTrap(gl: WebGL2RenderingContext): void {
  if (new URLSearchParams(window.location.search).get('gldiag') !== '1') return;
  const g = gl as unknown as Record<string, (...a: unknown[]) => unknown>;

  // The call site, three frames up: 0 is the Error line, 1 is this helper, 2 is the wrapper, so 3 is
  // the engine code that actually made the upload. Trimmed because a full stack per report drowns
  // the one line that identifies the producer.
  const site = (): string => {
    const lines = (new Error().stack ?? '').split('\n');
    return (lines[4] ?? lines[3] ?? '?').trim();
  };

  const report = (method: string, detail: string, severity: number): void => {
    const where = site();
    // ⚠️ Identity ONLY — no part of `detail` belongs in this key (see the note above).
    const key = `${method}|${where}`;
    const prev = glUploadFaults.get(key);
    if (!prev) {
      glUploadFaults.set(key, { method, site: where, frames: 1, worst: detail, worstSeverity: severity });
      // ONE line per call site, immediately: an upload fault can precede the first anomaly the stage
      // probe can see (a NaN uniform on a draw whose pixels are off-crop), and a capture that never
      // triggers would otherwise discard it. Bounded by the map, so this cannot flood.
      console.error(
        `[GLDIAG] NON-FINITE UPLOAD — ${method}(${detail})\n    at ${where}\n`
        + '    ⚠️ This value reached the GPU. A NaN scalar poisons every texel the draw covers (frame-WIDE); '
        + 'a NaN in an attribute buffer poisons only the instances that read it. Once per call site; the '
        + 'running count and worst case appear in the [GLDIAG] capture block.',
      );
      return;
    }
    prev.frames++;
    // Keep the WORST detail, not the first: for a buffer upload the count of bad entries is what says whether
    // this is one stray particle or a whole poisoned array, and it can grow after the first frame — "1/27000
    // non-finite" and "27000/27000 non-finite" from the same line are different bugs.
    if (severity > prev.worstSeverity) {
      prev.worstSeverity = severity;
      prev.worst = detail;
    }
  };

  for (const method of ['uniform1f', 'uniform2f', 'uniform3f', 'uniform4f'] as const) {
    const orig = g[method]!;
    g[method] = function (this: unknown, loc: unknown, ...vals: unknown[]) {
      for (let i = 0; i < vals.length; i++) {
        if (typeof vals[i] === 'number' && !Number.isFinite(vals[i] as number)) {
          report(method, `arg ${i} = ${String(vals[i])}, all = [${vals.join(', ')}]`, 1);
          break;
        }
      }
      return orig.call(this, loc, ...vals);
    };
  }

  for (const method of ['uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'uniformMatrix3fv', 'uniformMatrix4fv'] as const) {
    const orig = g[method] as ((...a: unknown[]) => unknown) | undefined;
    if (!orig) continue;
    g[method] = function (this: unknown, ...args: unknown[]) {
      const data = args[method.startsWith('uniformMatrix') ? 2 : 1];
      if (data && typeof (data as ArrayLike<number>).length === 'number') {
        const arr = data as ArrayLike<number>;
        for (let i = 0; i < arr.length; i++) {
          if (!Number.isFinite(arr[i]!)) { report(method, `index ${i} = ${String(arr[i])} of ${arr.length}`, 1); break; }
        }
      }
      return orig.call(this, ...args);
    };
  }

  for (const method of ['bufferData', 'bufferSubData'] as const) {
    const orig = g[method]!;
    g[method] = function (this: unknown, ...args: unknown[]) {
      // `bufferData(target, data, usage)` vs `bufferSubData(target, offset, data)`.
      const data = args[method === 'bufferData' ? 1 : 2];
      if (data instanceof Float32Array) {
        let bad = 0;
        let first = -1;
        for (let i = 0; i < data.length; i++) {
          if (!Number.isFinite(data[i]!)) { bad++; if (first < 0) first = i; }
        }
        // Severity is the BAD-ENTRY COUNT, so `worst` keeps the most poisoned upload from this site rather
        // than the first one seen.
        if (bad > 0) report(method, `${bad}/${data.length} non-finite, first at index ${first} = ${String(data[first])}`, bad);
      }
      return orig.call(this, ...args);
    };
  }

  console.warn('[GLDIAG] non-finite UPLOAD trap installed (uniforms + buffer uploads). Reports once per '
    + 'call site. This scans every uploaded array and costs real frame time — diagnostic only.');
}

/*
 * v8 22.1 (2026-09-24) — **`resolveModeAgainstMaterial()` and `materialRequestedRenderMode()` MOVED to
 * `generators/material-presets.ts`, imported at the top of this file. They are UNCHANGED; only their home
 * moved, and this file still holds every one of their call sites.**
 *
 * ⚠️ **The move was forced by `22.1`, and the only alternative was a SECOND owner.** Phase 22's facet
 * predicate (`presets/preset-facets.ts`) must resolve the render mode the way the frame does, and it is
 * imported by `checks/facetcheck.mjs` under Node — where **`main.ts` cannot be imported at all**, because
 * importing it boots the engine. So the rule either moved to a pure module or got hand-written a third time
 * (`coveragecheck` already keeps one re-implementation and says so in its own header). **Duplicating the one
 * rule whose single ownership the moved header was written to defend would have hollowed out the phase that
 * needed it.**
 *
 * ⚠️ **This file must keep declaring NEITHER function.** `fieldcheck` asserts their shape in
 * `material-presets.ts` AND asserts that `main.ts` declares no copy, because a re-added local one would
 * shadow the import silently and `tsc` would not say a word.
 */

/**
 * Has the liquid surface been authored away from its defaults?
 *
 * ## Why an export gate needs this and `volumeRender`'s equivalent gate does not (yet)
 *
 * ⚠️ **A GATE THAT DECLINES TO EMIT A BLOCK DOES NOT MERELY OMIT IT — IT DESTROYS IT**, because
 * `panel.ts`'s Export and Snapshot handlers both do `copy.overlay = visualFxControls.getSnapshot()`, i.e.
 * they REPLACE the overlay wholesale rather than merging into it. So one gate breaks all three of the
 * operations the user named in a single stroke, and a Snapshot is the worst of the three: it writes the
 * lossy copy back into the history the user is expected to restore from.
 *
 * `currentRenderMode === 'liquid'` alone was that gate. Leave the mode for one moment — pick `star` in the
 * dropdown to compare, take a snapshot, come back — and eleven authored liquid fields are gone from the
 * working preset with nothing on screen to say so. The mode itself round-trips (`renderMode` is emitted
 * UNCONDITIONALLY), so the two can only ever disagree in this one direction: **mode present, block missing,
 * unrecoverable.**
 *
 * The mode test is kept as the FIRST clause rather than replaced, because it is what keeps a liquid preset
 * whose fields happen to sit at their defaults from exporting as a preset with no liquid block at all.
 *
 * ⚠️ **Byte-identical for every existing export.** A non-liquid preset that never touched the section has
 * `currentLiquid` deep-equal to `DEFAULT_LIQUID_CONFIG` — `applyOverlayConfigBlocks` re-applies the
 * defaults UNDERNEATH every preset's block, so the live object cannot drift — and emits nothing, exactly as
 * before. Verified against the library: 359 of 360 presets author no `liquid` block.
 *
 * ⚠️ **`volumeRender` directly above has the IDENTICAL exposure and is deliberately left alone** — it is
 * outside the reported scope, and `mode === 'volume'` is authored by 0 of 360 presets, so nothing can be
 * losing anything today. If a volume preset is ever authored, this is the shape to copy.
 */
function isLiquidAuthored(live: LiquidSurfaceConfig): boolean {
  return (Object.keys(DEFAULT_LIQUID_CONFIG) as (keyof LiquidSurfaceConfig)[])
    .some(k => live[k] !== DEFAULT_LIQUID_CONFIG[k]);
}

/**
 * Fill the store's ONE deployment reel layer from the ONE source that wins (v8 Phase 19.11).
 *
 * ⚠️ **THE ONLY PLACE THE TWO SOURCES ARE RESOLVED, AND THE ORDER IS `psss_reels.json` FIRST** — invariant 17:
 * two sources need one resolution order, written down once, with nothing writing the resolved value afterwards.
 * Both load paths call this and neither may call `adoptDeploymentReelFile`/`adoptDeploymentReels` itself;
 * calling both in either order makes the second silently win, and the reels are the last thing anybody looks at.
 *
 * ⚠️ **A MISSING REEL FILE IS NOT AN ERROR, WHICH IS THE ONE PLACE THIS IS *NOT* SYMMETRIC WITH THE PRESET
 * FILE.** A missing `psss_presets.json` throws, because the deployment bundle contains no presets at all and
 * the alternative is a black canvas that reports nothing. `BUILT_IN_REELS` travels *inside* the bundle, so a
 * deployment with no reel file still plays — it plays the three built-ins. Making this throw "for symmetry"
 * would turn a working page into a broken one over an optional file. It warns, once, and says which file.
 *
 * ⚠️ **A reel file that fails its shape test is reported and then IGNORED** — `sanitiseReelFile` returns
 * `null`, and the fallback is deliberately NOT consulted in that case: a present-but-broken file is a
 * deployment mistake to be fixed, and quietly playing something else is how it stays unnoticed.
 */
function adoptDeploymentReelSource(
  store: ReelStore,
  reelFile: unknown,
  legacyKeyReels: unknown,
  standalone: boolean,
): void {
  if (reelFile !== undefined && reelFile !== null) {
    const adopted = store.adoptDeploymentReelFile(reelFile);
    if (adopted) {
      const main = adopted.mainReelName === null ? '' : `, main reel "${adopted.mainReelName}"`;
      const bad = adopted.rejected === 0 ? '' : `, ${adopted.rejected} unreadable`;
      console.log(`Loaded ${adopted.reels} deployment reel(s) from ${REEL_DEPLOYMENT_FILE}${main}${bad}`);
      return;
    }
    console.warn(`[reels] ${REEL_DEPLOYMENT_FILE} loaded but is not a reel file — ignoring it`);
    return;
  }
  const legacy = store.adoptDeploymentReels(legacyKeyReels);
  if (legacy > 0) {
    console.warn(`[reels] ${legacy} reel(s) read from the deprecated __reels key — move them to ${REEL_DEPLOYMENT_FILE}`);
  } else if (standalone) {
    console.warn(`[reels] no ${REEL_DEPLOYMENT_FILE} beside index.html — playing the built-in reels`);
  }
}

/**
 * The dev server's half of the pair: `psss_reels.json` from `public/`, or `undefined` if there is none.
 *
 * ⚠️ **OPTIONAL IN DEV, AND `public/psss_reels.json` DOES NOT EXIST IN THE TREE.** That is deliberate:
 * committing one would make it a second source of truth against `BUILT_IN_REELS`, and the two would drift with
 * nothing between them. The fetch is here so that a developer *testing* a deployment reel file can drop it into
 * `public/` and see exactly what the deployment does — a one-sided load path is the difference that only shows
 * up after a build.
 *
 * ⚠️ **`resp.ok` IS NOT THE TEST — a dev server can answer a missing path with `index.html` at status 200.**
 * The `JSON.parse` is what rejects that, and it is inside the `try` for exactly that reason: HTML, a 404 body
 * and a half-written file all land in the `catch` and all mean the same thing here, which is "there is no reel
 * file". ⚠️ **`undefined` therefore means "no file", never "a bad file"** — a bad file that PARSES is reported
 * by the caller instead, and the difference is the whole reason a broken deployment file is not silent.
 *
 * The assignment prefix is stripped exactly as the preset loader strips its own, so the same file works from
 * `public/` in dev and beside `index.html` in a deployment. Plain JSON with no prefix parses too, which costs
 * nothing and is what a hand-written file tends to be.
 */
async function fetchDevReelFile(): Promise<unknown> {
  try {
    const resp = await fetch(`/${REEL_DEPLOYMENT_FILE}`);
    if (!resp.ok) return undefined;
    const text = await resp.text();
    return JSON.parse(stripDeploymentAssignment(text));
  } catch {
    return undefined;
  }
}

/**
 * The render-resolution cap, in backing-store pixels — the whole visual budget of one frame.
 *
 * ⚠️ **This is a DEVICE property, not a preset property, and it must never become one.** Nothing here is
 * exported, persisted, interpolated by the Mixer or written to `overlay`: two machines showing the same
 * preset are expected to render it at different backing-store sizes, exactly as the panel and full screen
 * already do. A preset that carried a resolution would be a preset that looked right on one screen only.
 *
 * **Why a cap on PIXELS and not a scale.** Every full-canvas pass in the chain — the two ping-pong
 * attachments, the post FBO, bloom's five levels, the tone map, the depth field, and on the `liquid` path an
 * R32F plus an RGBA16F cleared every frame — costs in proportion to the pixel COUNT, and so does the
 * accumulate pass, whose splat radius scales with `(w + h)` (see `SCREEN_SPACE_*` in `hdr-particle.ts`) and
 * therefore covers a constant FRACTION of the canvas however large it is. A fixed scale would leave a 4:3
 * window and an ultrawide one at wildly different costs; a pixel budget is the quantity the GPU actually
 * charges for. Measured 2026-09-25: the CPU half of the frame is ~9.0 ms at 50 000 particles and does NOT
 * move with canvas size (8.93 ms at 1920×2000 vs 9.03 ms at 5120×2160), so at 60 Hz everything above this
 * line is the GPU's alone — which is why the remedy is here and not in the generator.
 *
 * ⚠️ **The look is preserved in the RELATIVE sense only, and that is already true of this engine.** Because
 * the splat radius, the liquid kernel and `liquidDensityReference()` all derive from the live `w`/`h`, a
 * smaller backing store reproduces the same figure at the same proportions rather than a cropped or
 * thinner one — the same invariance that lets a half-window panel and a full-screen presentation of one
 * preset look alike. What IS lost is detail: the result is upscaled by the compositor, since
 * `.left-panel canvas` is `width: 100%; height: 100%` in `layout.css` and the backing store has always been
 * free to differ from it. **Judge that on a low-accumulation preset (`Cylinder`, `Quader`, `Pipes`)** — a
 * dense liquid hides a resolution change that a sparse figure shows.
 *
 * **The number — 2 Mpx, and it is an OWNER DECISION taken against browser readings, not a derivation.** It
 * shipped at 4 Mpx for one sitting; that was a figure reasoned from the pass inventory above, and the first
 * live reading falsified the estimate it rested on. Two findings settled it, both 2026-09-25 on a 5120×2160
 * monitor:
 *
 *   1. ⚠️ **THE VIEWPORT IS NOT THE MONITOR, AND THE FIRST ESTIMATE WAS 2.7× TOO HIGH.** The engine rendered
 *      at DPR 1 when this was measured, so on a desktop at 150 % scaling `window.innerWidth/innerHeight` came
 *      back **2859×1440 = 4.12 Mpx** where the panel's spec sheet says 11.06 Mpx. A 4 Mpx budget therefore did
 *      essentially nothing on the machine it was chosen for. **Never size this from a monitor
 *      specification** — the log line in `resolveRenderSize` prints the only numbers that count.
 *
 *      ⚠️ **THE DPR-1 HALF OF THAT IS NO LONGER TRUE, and the 4.12 Mpx is kept only as the basis the decision
 *      was taken against.** Later the same day `resolveRenderSize` became DPR-aware, so the same machine now
 *      offers **4289×2160 = 9.26 Mpx** and the budget binds far harder. **The decision survives the change
 *      because both bases resolve to the same ~2.00 Mpx backing store here** (4.12 × 0.485² and 9.26 × 0.465²
 *      both land on the budget — that is what a pixel ceiling does), but a fresh reading must be compared to
 *      9.26, never to 4.12. Two figures wearing the same words.
 *   1a. ⚠️ **AND THE BUDGET TURNED OUT TO BUY MORE THAN SMOOTHNESS: below 10 fps the animation runs in real
 *      SLOW MOTION**, because `drawFrameBody` clamps the simulation step to 100 ms. Confirmed 2026-09-25 by an
 *      owner reading of `Boiling Milk` at `?renderscale=1` — 2 fps, and the figure advancing at 0.20× real
 *      time. Keeping the frame under 100 ms is therefore a CORRECTNESS property of the animation's speed, not a
 *      comfort one, and it was not known when this constant was chosen. Full derivation at that clamp.
 *   2. `?renderscale=0.5` made `Lava Flow` (2 500 particles, `splat`, `material.splatRadius` 4.5) *"clearly
 *      more smooth"* — which localises its cost to FILL rather than to the per-particle CPU loop, since at
 *      2 500 particles that loop is ~20× cheaper than the 50 000 the 9.0 ms was measured at. A preset can be
 *      fill-bound at a low particle count because the splat base scales with the canvas.
 *
 * At 2 Mpx a 1920×1080 **device** surface still resolves to 1:1 through the deadband, and the cut arrives at
 * 1440p and above: 2560×1440 → 1.84×, 2859×1440 → 2.06×, 3840×2160 → 4.15×. ⚠️ **Those rows are DEVICE pixels,
 * which equal CSS pixels only at DPR 1** — they were measured before the DPR change and are unchanged for a
 * DPR-1 screen, but a 1920×1080 window at DPR 2 is a 3840×2160 surface and takes the 4K row. ⚠️ **The 4K row
 * really is below 1080p and that is the budget working as specified, not a bug** — a pixel ceiling means the
 * largest surfaces give up the most, which is the only shape that makes the cost constant across machines.
 * Any `?renderscale=` value in (0, 1] pins the scale as a fraction of the DEVICE surface, so **`?renderscale=1`
 * is now native resolution rather than the pre-budget behaviour** — that one is `1/devicePixelRatio`. Tune THIS
 * constant, never add a second owner.
 *
 * ⚠️ **THE DPR CHANGE COSTS THE SCREENSAVER 2.25× THE FILL, ON THE HARDWARE LEAST ABLE TO PAY, AND THAT IS
 * ACCEPTED RATHER THAN UNNOTICED.** Measured 2026-09-25: a 1280×1024 panel at 150 % scaling is an 853×683 CSS
 * viewport (`layout.css` names this same configuration for a different defect), which the budget does not reach
 * at all — so it used to draw 0.58 Mpx and now draws its native 1.31 Mpx. **That is the budget working as
 * specified: 1.31 is under 2.0, so by the only rule that owns this question it is affordable.** Giving the
 * screensaver a budget of its own would be the second owner this comment forbids. ⚠️ **What it needs instead is
 * a reading on the `.scr` path**, which is the one route where the machine may be old and nobody is watching
 * the console — and where the old behaviour was never a decision, only an accident of ignoring DPR.
 */
const RENDER_PIXEL_BUDGET = 2_000_000;

/**
 * The deadband: a budget-derived scale ABOVE this is discarded and the canvas renders 1:1.
 *
 * ⚠️ **A cap that engages slightly is all cost and no benefit, and it took a live reading to see it.**
 * Measured 2026-09-25 on the owner's machine, at the 4 Mpx budget this shipped with for one sitting: a
 * 2859×1440 viewport is 4.12 Mpx, 3 % over THAT budget, and the bare `sqrt` rule resolved it to 0.986 — a
 * resample of every frame, a non-integer relationship between the backing store and the CSS box, and 1.03× off
 * the fill. **The budget has since moved to 2 Mpx, so that exact viewport no longer reaches the rule — but
 * every viewport just over whatever the budget IS does.** A ceiling on a cost that only matters in multiples
 * must decline to act rather than act imperceptibly. 0.90 is the smallest scale whose
 * fill saving (1.23×) exceeds the tolerance of the frame-time measurements this was derived from; anything
 * milder cannot be told from noise, which is the definition of not worth a visible change.
 *
 * ⚠️ **The `?renderscale=` override is NOT subject to this** — it is the instrument used to settle the
 * budget, and a hatch that silently refused a mild value would misreport the thing it exists to measure.
 */
const RENDER_SCALE_DEADBAND = 0.9;

/** `?renderscale=` — a pinned scale in (0, 1], or `null` for "obey `RENDER_PIXEL_BUDGET`". */
function readRenderScaleOverride(): number | null {
  const raw = new URLSearchParams(window.location.search).get('renderscale');
  if (raw === null) return null;
  const value = Number(raw);
  // A malformed value falls back to the budget rather than to 1: the query string is a diagnostic hatch,
  // and silently rendering at full resolution is the one outcome that would look like the flag working.
  if (!Number.isFinite(value) || value <= 0 || value > 1) return null;
  return value;
}

/**
 * The device-pixel ratio, **the basis the budget and `?renderscale=` are both measured against**.
 *
 * ⚠️ **This is deliberately NOT capped, unlike the four small Lab canvases.** `field-frame-canvas.ts`,
 * `score-canvas.ts` and `composer.ts` all take `Math.min(devicePixelRatio, 2)` because a 2D overlay gains
 * nothing past 2× and pays linearly. Here `RENDER_PIXEL_BUDGET` is already an absolute ceiling on the product,
 * so a DPR of 3 cannot cost anything: it raises the *ideal* surface, the budget clamps the *actual* one, and a
 * second cap would only stop a small window on a dense screen from spending headroom the budget says is free.
 *
 * ⚠️ **A DPR change is picked up only because it arrives with a resize.** Browser zoom and dragging a window
 * between monitors of different densities both fire `resize`, which is what calls `resizeAll()`. There is no
 * `matchMedia('(resolution: …)')` listener and there should not be one until something is seen to need it —
 * `resizeAll()` rebuilds every FBO and so clears the accumulated trail, which is a visible flash.
 */
function readDevicePixelRatio(): number {
  const raw = window.devicePixelRatio;
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

/** Memo for the log line below — the resolved size, so a no-op resize says nothing. */
let lastRenderSizeLogged = '';

/**
 * CSS size in, backing-store size out — **the ONE place the render scale is applied**, called from the
 * initial sizing and from `resizeAll()`, which are together the only owners of `canvas.width/height`.
 *
 * ⚠️ **THREE sizes exist here and confusing any two of them is the whole trap.** The CSS box (what
 * `layout.css` stretches the canvas to), the DEVICE surface (`css × devicePixelRatio`, the real pixels the
 * compositor will light), and the BACKING STORE (what we actually draw, `canvas.width/height`). The budget is
 * spent against the DEVICE surface, because that is the sharpest output that could ever be displayed; the
 * backing store is what the budget can afford of it. **Before 2026-09-25 this function had no notion of the
 * device surface at all** — it rendered CSS pixels, so on a 150 %-scaled desktop every frame was upscaled 1.5×
 * before the budget even applied, and raising the budget past the CSS pixel count bought nothing. Four small
 * Lab canvases were DPR-aware; the main one, alone, was not.
 *
 * ⚠️ **Even dimensions, on EVERY path now.** Bloom builds five successively halved levels, so an odd size
 * rounds at every level and the smallest ones drift off the aspect ratio. This used to be applied only when
 * the cap bit, leaving the uncapped path free to hand bloom an odd size; the rounding costs at most one pixel
 * and is cheaper than auditing six mip chains, so there is no reason for the asymmetry.
 *
 * ⚠️ **Never returns 0.** A window collapsed to nothing would otherwise produce a 0-wide FBO, which fails
 * `checkFramebufferStatus` (invariant 5) — a throw from a resize, not from anything the user can see.
 */
function resolveRenderSize(cssW: number, cssH: number): { w: number; h: number; scale: number } {
  const cw = Math.max(1, Math.floor(cssW));
  const ch = Math.max(1, Math.floor(cssH));
  const dpr = readDevicePixelRatio();
  const dw = Math.max(1, Math.round(cw * dpr));
  const dh = Math.max(1, Math.round(ch * dpr));
  const override = readRenderScaleOverride();
  // The deadband applies to the BUDGET rule only — see `RENDER_SCALE_DEADBAND` for why the override is exempt.
  const scale = override ?? (() => {
    const wanted = Math.sqrt(RENDER_PIXEL_BUDGET / (dw * dh));
    return wanted > RENDER_SCALE_DEADBAND ? 1 : wanted;
  })();
  // ⚠️ **FLOOR, not round — a ceiling may never round UP past the thing it is capping.** With `Math.round`
  // an odd device width came back one pixel WIDER than the device surface (measured 2026-09-25: a 4289 px
  // surface resolved to a 4290 px backing store, and the log line read "9.27 of 9.26 Mpx", a fraction above
  // 1). Harmless on screen, but it made the instrument print nonsense, and the same rounding can push the
  // budget path marginally OVER `RENDER_PIXEL_BUDGET` — the one direction a cap must never go. Flooring costs
  // at most one pixel per axis, the same as the even-rounding it is part of.
  const even = (v: number) => Math.max(2, Math.floor((v * Math.min(scale, 1)) / 2) * 2);
  const w = even(dw);
  const h = even(dh);
  // One line per distinct resolved size. All three sizes are printed because none of them can be read off the
  // screen and every wrong estimate so far came from guessing one from another: the CSS box is below the
  // monitor's physical width on a scaled desktop, and the backing store is below both whenever the cap bites.
  // The memo advances whether or not the line prints, so that returning to a previously logged size after an
  // uninteresting one in between stays silent rather than repeating itself.
  const key = `${w}x${h}`;
  const changed = lastRenderSizeLogged !== key;
  lastRenderSizeLogged = key;
  if (changed && (w !== cw || h !== ch)) {
    console.log(
      `Render scale ${scale.toFixed(3)}${override !== null ? ' (?renderscale)' : ''}: `
      + `${cw}x${ch} CSS px at DPR ${dpr} = ${dw}x${dh} device -> ${w}x${h} backing store `
      + `(${((w * h) / 1e6).toFixed(2)} of ${((dw * dh) / 1e6).toFixed(2)} Mpx)`,
    );
  }
  return { w, h, scale };
}

async function init() {
  const config = createDefaultConfig();

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');
  const appLayout = document.getElementById('app-layout')!;
  const rightPanel = document.getElementById('right-panel')!;

  // Panel mode: 'grid' | 'lab' | 'fullscreen'
  type PanelMode = 'grid' | 'lab' | 'fullscreen';
  let panelMode: PanelMode = 'grid';
  let preFullscreenMode: 'grid' | 'lab' = 'grid';

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  // The fullscreen preset-name label
  //
  // In full screen there is no grid, no tile caption and no panel, so the one thing a viewer cannot find out is
  // WHICH preset is on screen — and under a reel that changes every few seconds. Moving the mouse names it
  // bottom-right for `FS_LABEL_HOLD_MS` and it fades out again. **The mouse is the affordance because it is the
  // only input here that does not already mean something else**: a click leaves full screen and every key is a
  // shortcut, so either would have had to be taken away from what it does now.
  //
  // ⚠️ **`pointer-events: none` is load-bearing, for the same reason it is on the reel's black overlay**: the
  // label sits over the bottom-right corner OF THE CANVAS, and a canvas click is the only way out of full screen
  // on a page with no keyboard focus. Without it that corner would be dead and the symptom would be "fullscreen
  // sometimes won't exit".
  //
  // ⚠️ **Declared here, thousands of lines before it is revealed, because `applyPresetChange` refreshes it** and
  // the startup apply runs long before the reel block — a `const` declared next to the reveal would still be in
  // its temporal dead zone and would throw on load. It is a `body` child, so it inherits the page font and, like
  // the black overlay, sits INSIDE the fullscreen element (`documentElement`).
  //
  // ⚠️ **z-index 9998, one BELOW the reel's black overlay**: a `black` transition is meant to take the whole
  // screen down, and a name burning through the blackout would read as a compositing bug.
  //
  // ⚠️ **Hidden is `opacity: 0`, never `display: none`** — changing `display` and `opacity` in one frame does not
  // animate, so a `display` toggle would silently cost the fade in both directions.
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  const FS_LABEL_HOLD_MS = 3200;
  const fsPresetLabel = document.createElement('div');
  // An `id`, like `#canvas` / `#app-layout` / `#right-panel`, so a spec has a stable hook that is part of the
  // app's own DOM — never a `data-testid`, and never "the last div in `body`", which the black overlay also is.
  fsPresetLabel.id = 'fullscreen-preset-name';
  fsPresetLabel.style.cssText = 'position:fixed;right:3vw;bottom:4vh;z-index:9998;max-width:70vw;'
    + 'text-align:right;color:#fff;font-size:clamp(26px,3.2vw,58px);font-weight:600;line-height:1.15;'
    + 'text-shadow:0 2px 14px rgba(0,0,0,0.9),0 0 4px rgba(0,0,0,0.85);'
    + 'pointer-events:none;opacity:0;transition:opacity 500ms ease';
  document.body.appendChild(fsPresetLabel);
  /**
   * The pending hide, and — deliberately — the label's own "is it up" flag: there is no second boolean to fall
   * out of step with it. Non-null means the label is showing.
   */
  let fsLabelTimer: number | null = null;

  /** Take it down now. Idempotent, and the only place the timer is cleared. */
  function hideFullscreenPresetLabel(): void {
    if (fsLabelTimer !== null) {
      clearTimeout(fsLabelTimer);
      fsLabelTimer = null;
    }
    fsPresetLabel.style.opacity = '0';
  }

  /**
   * Name the preset on screen and start (or extend) the hold.
   *
   * Nothing happens outside full screen, and nothing happens before a preset has been applied — an empty label
   * fading in and out would be worse than no label.
   *
   * ⚠️ **Both writes are conditional because a `mousemove` fires hundreds of times a second**: assigning the
   * same `textContent` and the same `opacity` on every one of them is a style recalculation per pointer sample,
   * during the one mode where the frame budget is entirely the animation's.
   */
  function revealFullscreenPresetLabel(): void {
    if (panelMode !== 'fullscreen') return;
    const name = lastAppliedPresetName;
    if (!name) return;
    if (fsPresetLabel.textContent !== name) fsPresetLabel.textContent = name;
    if (fsPresetLabel.style.opacity !== '1') fsPresetLabel.style.opacity = '1';
    if (fsLabelTimer !== null) clearTimeout(fsLabelTimer);
    fsLabelTimer = window.setTimeout(() => {
      fsLabelTimer = null;
      fsPresetLabel.style.opacity = '0';
    }, FS_LABEL_HOLD_MS);
  }

  /**
   * Keep a label that is already up truthful when the preset changes underneath it — a reel switch or an arrow
   * key, both of which are reachable in full screen (`psss-engine-v2_how_to_use_it.md` §4.1). Called from `applyPresetChange`, which is the ONE
   * place that knows the applied name changed; invariant 13's "does this readout still show what it names".
   *
   * ⚠️ **The text only — the hold is NOT restarted.** The label's few seconds belong to the mouse move that
   * asked for it; a reel that reset the clock on every switch would leave the name up for as long as it was
   * playing.
   */
  function refreshFullscreenPresetLabel(): void {
    if (fsLabelTimer === null) return;
    if (panelMode !== 'fullscreen' || !lastAppliedPresetName) {
      hideFullscreenPresetLabel();
      return;
    }
    fsPresetLabel.textContent = lastAppliedPresetName;
  }

  /**
   * The canvas's own CSS box — **the ONE quantity the backing store has to agree with, measured rather
   * than reconstructed** (2026-10-15).
   *
   * ⚠️ **THE BACKING STORE'S ASPECT MUST MATCH *THIS* BOX, BECAUSE THE COMPOSITOR STRETCHES ONE INTO THE
   * OTHER.** When they disagree the browser distorts the frame and no GL code is wrong about anything —
   * which is why the symptom reads as "the figure has the wrong proportions" with a clean console. Measured
   * on a fullscreen round trip at 1600×900: the backing store came back from full screen at **1520×900**
   * inside an **800×900** box, a 1.9× horizontal squash that survived until the next window resize.
   *
   * ⚠️ **It replaced a THREE-SOURCE reconstruction, and each source was wrong in its own way.** The old
   * `getCanvasWidth()` returned `window.innerWidth` in full screen and `canvas.parentElement.clientWidth`
   * otherwise, and the height was always `window.innerHeight`:
   *
   *   - `window.innerWidth` is the box's FUTURE value, not its current one. `.app-layout` transitions
   *     `grid-template-columns` for 0.3 s (`layout.css`), so on the way INTO full screen it was right early
   *     — and on the way OUT the panel branch read a box that was still almost full width, leaving the
   *     stale aspect above. **That asymmetry is exactly why a reel in the screensaver never showed it**: a
   *     presentation only ever ENTERS the fullscreen layout, so it never reads an animating element.
   *   - `window.innerHeight` is not the canvas's height at all under the `max-width: 999px` breakpoint,
   *     where `layout.css` stacks the panes `1fr 1fr` and the canvas is HALF the viewport height. That one
   *     was latent: the squash was vertical, 2×, on every window narrower than 1000 CSS px.
   *
   * ⚠️ **Measuring the box makes a SETTLE OBSERVATION mandatory rather than optional** — see the
   * `transitionend` listener beside the `resize` one. Reading the live box is only ever right for the
   * instant it was read, so something has to read it again when the layout stops moving. The old
   * `innerWidth` guess was a way of not needing that, and the 350 ms timer in `setPanelMode` was the price.
   *
   * ⚠️ **`clientWidth`/`clientHeight` and not `getBoundingClientRect()`**: the rect is fractional, and a
   * fractional CSS width cannot be matched by an integer backing store anyway — rounding it here would only
   * move the rounding, while `clientWidth` is the integer the layout already settled on.
   *
   * The `window.inner*` fallback is reachable only when the canvas has NO layout box (a `display: none`
   * ancestor), in which case nothing is on screen and one non-zero size is as good as another. It exists so
   * that a collapsed box cannot produce a 2×2 FBO, never as a second opinion about the real size.
   */
  function getCanvasCssSize(): { w: number; h: number } {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w >= 1 && h >= 1) return { w, h };
    return { w: window.innerWidth, h: window.innerHeight };
  }

  // Through `resolveRenderSize`, exactly as `resizeAll()` does — the two sizing sites must agree, or the
  // first frame is drawn at one resolution and every later one at another.
  {
    const css = getCanvasCssSize();
    const size = resolveRenderSize(css.w, css.h);
    canvas.width = size.w;
    canvas.height = size.h;
    config.canvas.width = size.w;
    config.canvas.height = size.h;
  }

  const backend = await detectBackend(canvas);
  config.renderer.backend = backend.type;
  const gl = (backend as unknown as { gl: WebGL2RenderingContext }).gl;
  installGlUploadTrap(gl);

  const presetManager = new PresetManager();

  /**
   * v8 Phase 19 — the reel library. Constructed BEFORE the preset load because both load branches below hand
   * it their deployment reels, and `adoptDeploymentReels` must run before anything reads the store.
   *
   * ⚠️ **`createLocalStoragePersistence()` may legitimately return `null`** (private mode, a sandboxed iframe,
   * a storage policy) and the store treats that as "this session only" rather than as an error — the Reel tab's
   * status line says so. Do not "fix" it with a throw.
   */
  const reelStore = new ReelStore(createLocalStoragePersistence());

  // ⚠️ **TWO LIBRARY SOURCES, ONE PER ARTEFACT, AND THE CHOICE IS MADE AT BUILD TIME — never at runtime.**
  //
  // `__PSSS_STANDALONE__` is a literal substituted by Vite's `define` (`vite.config.ts`), so exactly ONE of
  // these branches survives into any given bundle and the other is eliminated. That is what lets the
  // deployment build ship no built-in presets at all: the `import()` below is unreachable there, so
  // `presets/library.ts` and the seven preset modules it pulls in never enter the graph.
  //
  //   dev (`npm run dev`)          → the legacy JSON is FETCHED and composed with the built-in TS groups.
  //   deployment (`npm run build`) → the whole composed library arrives as ONE external file, and there are
  //                                  no built-in presets. `scripts/export-library.mjs` wrote that file from
  //                                  the SAME `loadLibrary()` the dev branch below calls, which is the only
  //                                  reason the deployed library cannot differ in content, count or ORDER.
  //
  // ⚠️ **The deployment file is `g_psss_presets={…}` — a script, not JSON, exactly as the legacy engine's
  // preset file is** (`psss-original/index.html` loads it with a plain `<script src>`). `fetch` is
  // unavailable under `file://`, so a global assigned by a sibling `<script>` is the ONLY transport that
  // works from disk; that tag carries `defer`, which is what keeps it ahead of the engine's own script.
  //
  // ⚠️ **THE REEL LIBRARY IS EXTERNALISED THE SAME WAY, IN ITS OWN FILE** (v8 Phase 19.11): `psss_reels.json`,
  // a `<script defer>` assigning `g_psss_reels`, written by the same `scripts/export-library.mjs`. It is the
  // deployment's editable answer to *what plays by itself*, including WHICH reel autostarts. Two deliberate
  // asymmetries with the preset file, each of which reads as a bug from the other side:
  //   - **it is optional** — `BUILT_IN_REELS` ships inside the bundle, so a missing reel file costs the
  //     deployment its own reels and nothing else, where a missing preset file costs it everything;
  //   - **it is not a preset-file key** — the deprecated `__reels` key is still READ (below) so an older or
  //     hand-edited preset file keeps working, but the exporter no longer writes it, because one deployment
  //     carrying its reel list in two places is invariant 17 made physical.
  //
  // ⚠️ **`loadAll` migrates whatever it is handed** — `MigrationLayer.migrate` branches on
  // `metadata.version === 2` and its v2 arm is idempotent (it clones, and only fills fields that are
  // `undefined`), so re-loading an already-migrated preset is a no-op. That is what makes one external file
  // able to carry the engine-format library AND still accept a hand-edited legacy file dropped in its place.
  if (__PSSS_STANDALONE__) {
    const raw = (globalThis as unknown as { g_psss_presets?: Record<string, unknown> }).g_psss_presets;
    // A hard failure rather than an empty library: with no presets the engine boots to a black canvas and
    // reports nothing, which reads as a broken build instead of a missing file next to the HTML.
    if (!raw) {
      // ⚠️ **A CHANNEL, then the SAME throw** (v8 Phase 20.1). A screensaver host gets a black full-screen
      // window and no diagnosis out of this throw, because there is no console to read and no chrome to close
      // the window with; `psss-fatal` lets it log the reason and exit 1 instead of sitting there. The throw
      // itself is deliberately unchanged — in a browser `postToHost` is a no-op, so this path stays
      // byte-identical to what it was, message included.
      const message = 'psss_presets.json did not load — all four deployment files must sit side by side';
      postToHost({ type: 'psss-fatal', message });
      throw new Error(message);
    }
    // ⚠️ **BEFORE `loadAll`, and it MUTATES `raw`.** The reserved `__reels` key is a sibling of the presets in
    // the same object (see `REEL_LIBRARY_KEY`'s write-up for why it cannot be a second global), so leaving it in
    // place makes `loadAll` migrate it into a preset literally named `__reels` — a black tile in the grid that
    // nothing explains. This call and the one in the dev branch below are the SAME two lines against two
    // different objects, because the two load paths share no code.
    //
    // ⚠️ **The RETURNED value is now a fallback, not the source** (v8 Phase 19.11): the exporter writes the
    // reels to `psss_reels.json` and stops writing the key, so the extraction here defends a hand-edited or
    // older preset file. The deletion half is unconditional and stays.
    const legacyReels = extractDeploymentReels(raw);
    adoptDeploymentReelSource(reelStore, (globalThis as unknown as Record<string, unknown>)[REEL_DEPLOYMENT_GLOBAL], legacyReels, true);
    presetManager.loadAll(raw);
    console.log(`Loaded ${presetManager.count()} presets`);
  } else {
    try {
      const resp = await fetch('/psss_presets.json');
      const text = await resp.text();
      // ONE owner for the strip (`presets/deployment-format.ts`), shared with the reel loader above and
      // with both Import paths. Four hand-written copies of this regex was three too many.
      const rawPresets = JSON.parse(stripDeploymentAssignment(text)) as Record<string, unknown>;
      // The dev half of the pair above. `public/psss_presets.json` carries no `__reels` key today, so this is a
      // no-op in dev — kept anyway, because a developer testing a deployment reel file by dropping it into
      // `public/` must see the same behaviour the deployment gives, and a one-sided extraction is exactly the
      // kind of difference that only shows up after a build.
      adoptDeploymentReelSource(reelStore, await fetchDevReelFile(), extractDeploymentReels(rawPresets), false);
      const { loadLibrary } = await import('./presets/library.ts');
      const orphans = loadLibrary(presetManager, rawPresets);
      // ⚠️ Logs the WHOLE library, not the interleave — `loadLibrary` is one call and the count is taken
      // after it, so this figure is directly comparable with the deployment build's own line above.
      console.log(`Loaded ${presetManager.count()} presets`);
      if (orphans > 0) console.warn(`[presets] ${orphans} refined/variant preset(s) had no matching original`);
    } catch (e) {
      console.warn('Could not load legacy presets:', e);
    }
  }

  // Pick the default preset
  // D4: `presetManager.list()` already returns a fresh array, but this ONE array reference used to be handed
  // to BOTH panels and to `currentPresetIndex`, while `previewGrid.prependPreset` mutated it with `unshift`.
  // Consequences: the Lab's deck dropdowns (built once at `init()`) missed the new preset, the Lab REJECTED
  // its name as a duplicate because it saw the mutated list, and `currentPresetIndex` silently shifted by one
  // so arrow-key navigation jumped.
  //
  // `PresetManager` is the authoritative owner. Each consumer gets its own array, and `refreshPresetNames()`
  // re-reads from the manager after an import so nobody diverges.
  let presetNames = presetManager.list();
  /*
   * The STARTUP preset (owner, 2026-11-10: *"start with a random preset chosen from the grid"*), resolved in ONE place:
   *   1. `?preset=<name>` names it (a shareable link), when the library has it;
   *   2. ⚠️ under AUTOMATION (`navigator.webdriver`, true for every Playwright run — the suite, `uicheck`,
   *      `democheck`, `capture-ui`) the deterministic `config.defaultPreset`, because specs assert on the boot
   *      preset and the manual's screenshots are byte-deterministic — a random boot would make both flaky;
   *   3. otherwise a RANDOM preset from the grid's own list.
   * ⚠️ It only CHOOSES the name — the preset still goes through the one startup path (invariant 23).
   */
  const bootParam = new URLSearchParams(window.location.search).get('preset');
  const automated = typeof navigator !== 'undefined' && navigator.webdriver === true;
  const presetName = bootParam !== null && presetManager.has(bootParam)
    ? bootParam
    : automated
      ? (presetManager.has(config.defaultPreset) ? config.defaultPreset : (presetNames[0] ?? 'default'))
      : (presetNames.length > 0
        ? presetNames[Math.floor(Math.random() * presetNames.length)]!
        : config.defaultPreset);
  let preset = presetManager.getWorkingCopy(presetName);

  // Generator
  const generator = new LissajousGenerator();
  initGenerator(generator, preset, canvas.width, canvas.height);

  // Renderers
  const renderer = new HDRParticleRenderer();
  initRenderer(renderer, backend, preset, canvas.width, canvas.height);

  const ribbonRenderer = new RibbonRenderer();
  ribbonRenderer.init(backend as never, {
    mode: preset?.renderer.mode ?? 'star',
    glow: preset?.renderer.glow ?? 2.0,
    decayFactor: preset?.renderer.decayFactor ?? 0.86,
    blurRadius: preset?.renderer.blurRadius ?? 0,
    depthSize: 0,
    streaks: 0,
  });
  ribbonRenderer.resize(canvas.width, canvas.height);
  // 'off' | 'hybrid' | 'streaks' | 'adaptive'
  let ribbonState: 'off' | RibbonMode = 'off';
  /**
   * 27.6 — the splat shear convention, mirrored here so Export, Snapshot and `reapplyRendererState` all
   * read ONE resolved value. Default `'tangent'` equals the pre-27.6 behaviour, which is what lets the
   * apply site use `?? 'tangent'` and still be byte-identical on a preset that omits the key.
   */
  let splatShear: SplatShear = 'tangent';
  let ribbonWidth = 3.0;

  const neonLineRenderer = new NeonLineRenderer();
  neonLineRenderer.init(backend as never, {
    mode: preset?.renderer.mode ?? 'star',
    glow: preset?.renderer.glow ?? 2.0,
    decayFactor: preset?.renderer.decayFactor ?? 0.86,
    blurRadius: preset?.renderer.blurRadius ?? 0,
    depthSize: 0,
    streaks: 0,
  });
  neonLineRenderer.resize(canvas.width, canvas.height);
  let linesEnabled = false;
  /*
   * v8 Phase 40 — **Electric Discharge**: its own pass and buffers (`electric-discharge.ts`), applied to
   * `presentSource` between the reel cross-fade and Bloom. ⚠️ ONE reader of the preset (`readDischarge`) for both
   * apply paths, so `applyPresetChange` and `resetOverlays` cannot drift apart on a default (the `lineWidth`
   * 1.5-vs-2.0 lesson below).
   */
  const electricDischarge = new ElectricDischarge();
  electricDischarge.init(gl);
  type DischargeState = { enabled: boolean; intensity: number; filament: number; crackle: number; branching: number };
  const readDischarge = (ov: OverlayState | undefined): DischargeState => ({
    enabled: ov?.dischargeEnabled ?? false,
    intensity: ov?.dischargeIntensity ?? DISCHARGE_DEFAULTS.intensity,
    filament: ov?.dischargeFilament ?? DISCHARGE_DEFAULTS.filament,
    crackle: ov?.dischargeCrackle ?? DISCHARGE_DEFAULTS.crackle,
    branching: ov?.dischargeBranching ?? DISCHARGE_DEFAULTS.branching,
  });
  let discharge: DischargeState = readDischarge(undefined);
  /*
   * ⚠️⚠️ **ELECTRIC DISCHARGE IS COUPLED TO NEON LINES (owner 2026-11-05).** The effect tears the GLOW already on
   * screen into filaments, and only the neon lines supply one: on a crisp point or ribbon figure it can only thin and
   * dim the lines (measured `p58-lines-dependence.mjs`; a self-made halo was tried and reverted). So enabling the
   * discharge enables the lines (`setDischarge`), and lines OFF ⇒ discharge OFF — enforced HERE, the ONE owner,
   * called after EVERY write of `linesEnabled` (both apply paths, both setters, the ribbon setter and the ribbon
   * key). A writer that skips it leaves a discharge over no lines, which is the state the owner rejected.
   */
  const coupleDischargeToLines = (): void => {
    if (!linesEnabled && discharge.enabled) discharge = { ...discharge, enabled: false };
  };
  /**
   * Fallback for a preset that declares no `overlay.lineWidth` (D5).
   *
   * Named because the two overlay-apply paths disagreed on it: `applyPresetChange` used `?? 1.5` and
   * `resetOverlays` used `?? 2.0`, so the same preset got a different neon line width depending on
   * whether you SELECTED it or RESET to it. Same class of drift as `DEFAULT_ATTRACTOR_BLEND` below —
   * both were bare literals repeated at the two sites, which is precisely how they diverged unnoticed.
   */
  const DEFAULT_LINE_WIDTH = 2.0;
  let neonLineWidth = DEFAULT_LINE_WIDTH;

  // Ping-pong FBOs for trail accumulation
  let fboState = createPingPongFBOs(gl, canvas.width, canvas.height);

  // TranslationMap processor
  const transMap = new TranslationMapProcessor();
  initTransMap(transMap, gl, preset, canvas.width, canvas.height);

  // TransMap Force Field processor
  const transMapForce = new TransMapForceField();
  transMapForce.init(gl, canvas.width, canvas.height);

  /**
   * The per-pixel depth field TransMap style 11 reads (v8 Step 14.7). Constructed and `init`ed unconditionally
   * — the FBO is 4 MB at 1080p and the alternative is a lazy init inside the frame loop — but `render()` is
   * called ONLY when `transMap.needsDepth()` is true, which is **1 of 359 shipped presets** — `Sphere II`, since
   * 2026-08-28. ⚠️ It was 0 of 364 for the whole of Phase 14, so *"nothing to regress"* no longer holds: a change
   * to this pass now has a shipped preset to be judged on. Re-measure rather than trusting either figure.
   *
   * ⚠️ **The texture is handed over EVERY frame, and `null` when depth is not needed** (invariant 3: a flag must
   * die with its resource). Caching the handle on chain change instead would survive a `resize()`, which
   * reallocates the target — a use-after-delete whose symptom is a sampler reading freed memory, not a throw.
   */
  const depthField = new DepthFieldPass();
  depthField.init(gl, canvas.width, canvas.height);

  /**
   * Diameter, in PIXELS, of the disc each particle splats into the depth field.
   *
   * ⚠️ **Deliberately much wider than any particle, and it is not a quality/cost trade.** Depth is a modulation
   * field sampled at the warp's DESTINATION uv, so a gap between splats reads as background — i.e. FAR — inside
   * the figure, and a near strand would then get the far multiplier in the holes between its own particles. That
   * presents as flicker along a strand, not as a soft field. `MAX` blending means over-covering costs nothing
   * but fill rate, so err wide.
   *
   * ⚠️ **A pixel constant, so a preview tile would have to scale it by `SCREEN_SPACE_TILE_SCALE`** — decide by
   * UNIT, not by field name. Tiles do not run this pass at all today.
   */
  const DEPTH_SPLAT_PX = 24;

  /**
   * The analytic force sampler for TransMap styles 0-3 **and style 10** — hoisted so the per-frame install is
   * an identity assignment rather than a fresh closure. `setAnalyticSampler` is called every frame from the
   * force block; an inline arrow there would allocate one closure per frame (invariant 8 is about the RATE),
   * and it would also defeat any future identity check inside the processor.
   *
   * ⚠️ **The two closed-form sources SUM here, and this scratch buffer is why the sum is written out longhand.**
   * `sampleVortexOffset` writes the same `out` the caller handed in, so calling it second would OVERWRITE the
   * static contribution rather than add to it — the silent shape of invariant 6's "both passes must upload".
   * A vortex layer added to a wave-shift preset would have deleted the wave force, which reads as the wave
   * force being broken by an unrelated control.
   */
  const vortexForceOut = new Float64Array(2);
  const staticForceSampler = (x: number, y: number, out: Float64Array): void => {
    transMap.sampleStaticOffset(x, y, out);
    transMap.sampleVortexOffset(x, y, vortexForceOut);
    out[0] = out[0]! + vortexForceOut[0]!;
    out[1] = out[1]! + vortexForceOut[1]!;
  };

  // Bloom and tone map are initialised from HARDCODED literals, deliberately — NOT from
  // `preset.postProcessors.bloom` / `.toneMap`.
  //
  // Both are thereafter driven only by `applyFilmLook` / `applyCustomParam`, i.e. from
  // `FilmLookParams` (ADR 007: film looks are the single grading source). That makes the preset's own
  // `postProcessors.bloom` and `.toneMap` blocks inert — see the `@deprecated` notes on them in
  // `presets/types.ts`. Anything wanting to change grading must go through `overlay.filmLook` or
  // `overlay.customFilmLookParams`; three controls wrote to the preset blocks instead and silently did
  // nothing for months (defects EX1, EX2).
  const bloom = new BloomProcessor();
  bloom.init(gl, { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5, levels: 5 });
  bloom.resize(canvas.width, canvas.height);

  const toneMap = new ToneMapProcessor();
  toneMap.init(gl, { enabled: false, curve: 'none', exposure: 1.0, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1], saturation: 1.0, vignette: 0.0 });
  toneMap.resize(canvas.width, canvas.height);

  // Film look state
  let currentFilmLook = 'Legacy';
  let customFilmLookParams: FilmLookParams = { ...FILM_LOOKS['Legacy']! };

  /**
   * v8 Step 21.4c — the overlay's palette override, and the last selection it resolved to.
   *
   * ⚠️ **`undefined` means "not overridden" and is NOT `'none'`.** `'none'` overrides a film look's palette
   * with no palette at all; `undefined` lets the look's own choice through. The dropdown stores
   * `PALETTE_UNSET` (`''`) for the first of those, which `resolvePaletteSelection` folds back to
   * `undefined` — that distinction is the whole reason the export gate for these two fields has to be
   * value-based rather than mode-based.
   *
   * `livePaletteSelection` is a CACHE OF THE LAST RESOLUTION, written only by `applyPaletteSelection()`.
   * It exists for the UI's label and readouts (`21.4e`/`21.4f`), which must describe what the pipeline
   * actually did rather than re-deriving it — invariant 25's shape, and invariant 17's ban on a second
   * reader resolving the pair for itself. **Never assign to it anywhere else.**
   */
  let overlayPalette: string | undefined;
  let overlayPaletteMapping: PaletteMapping | undefined;
  /**
   * v8 `26.4` — the live palette hue rotation, in TURNS, read as `?? 0`.
   *
   * ⚠️ **It is pushed through `applyPaletteSelection()` and nowhere else**, which is the same discipline
   * the palette NAME is already held to: three call sites push the palette, and if each resolved its own
   * rotation they would be three independent `??` chains — invariant 17's exact shape, and the reason its
   * write-up says *grepping the readers exonerated the buggy file*.
   */
  let overlayPaletteHueShift = 0;
  let livePaletteSelection: PaletteSelection = resolvePaletteSelection(undefined, customFilmLookParams);

  // Attractor state
  let currentAttractorIndex = -1; // -1 = none
  /**
   * Fallback blend for a preset that declares an `attractorIndex` but no `attractorBlend` (D5).
   *
   * The two overlay-apply paths disagreed here too — `applyPresetChange` used `?? 0` and
   * `resetOverlays` `?? 0.6` — so such a preset showed its attractor at full strength via one path and
   * INVISIBLY (blend 0) via the other. Only reachable when the index is >= 0, since `setAttractor(null)`
   * ignores the blend entirely; 0.6 is kept as the value both the module initialiser and `resetOverlays`
   * already used, so a partly-declared attractor is visible rather than silently inert.
   */
  const DEFAULT_ATTRACTOR_BLEND = 0.6;
  let currentBlend = DEFAULT_ATTRACTOR_BLEND;

  // Extra FBO for post-processing output (bloom writes here)
  let postFBO = createPostFBO(gl, canvas.width, canvas.height);

  // The decay pass — ONE program per variant (plain / blurred) that copies the trail AND applies the decay
  // (M6, 2026-11-12; it used to be a copy pass followed by a blended fade quad — two full-screen passes).
  const decayProgram = createDecayProgram(gl, false);
  const decayVao = createQuadVAO(gl, decayProgram, 'aPos');
  const decayBlurProgram = createDecayProgram(gl, true);
  const decayBlurVao = createQuadVAO(gl, decayBlurProgram, 'aPos');

  // Blit program (copy FBO to screen)
  const blitProgram = createBlitProgram(gl);
  const blitVao = createBlitQuad(gl, blitProgram);


  // Uniform locations for the three fixed full-screen programs above, resolved once (triage H6).
  // The render loop queried these by name on every frame — up to five per frame across the decay,
  // fade and blit passes. A location belongs to the linked program and cannot change while it lives,
  // and all three programs are `const`: created here, never disposed, never re-linked. So unlike the
  // renderer and post-processor objects (which are rebuilt by dispose+init on a film-look change)
  // there is no invalidation case to reason about here at all.
  const uDecayTex = gl.getUniformLocation(decayProgram, 'uTex');
  const uDecayFade = gl.getUniformLocation(decayProgram, 'uFade');
  const uDecayBlurTex = gl.getUniformLocation(decayBlurProgram, 'uTex');
  const uDecayBlurFade = gl.getUniformLocation(decayBlurProgram, 'uFade');
  const uDecayBlurTexelSize = gl.getUniformLocation(decayBlurProgram, 'uTexelSize');
  const uBlitTex = gl.getUniformLocation(blitProgram, 'uTex');

  // Opt-in GL error drain — `?gldiag=1`. Read once at init; see `reportGlErrors()` for why it is not
  // always-on and why a URL parameter rather than a build flag.
  const glDiagEnabled = new URLSearchParams(window.location.search).get('gldiag') === '1';
  if (glDiagEnabled) {
    console.warn('[GLDIAG] per-frame gl.getError() drain ENABLED (?gldiag=1). This flushes the GL pipeline '
      + 'every frame and costs frame time — it is a diagnostic, not a mode to leave on.');
    // Arm the trail guard's diagnostic release value on the two programs that carry `sanitiseTrail` here, so
    // a guard TRIP becomes distinguishable from a buffer nothing ever drew into (see `TRAIL_SANITISE_GLSL`).
    //
    // Set ONCE rather than per frame: both programs are `const`, created above and never disposed or
    // re-linked, so a uniform set here holds for the session. TransMap's two copies of the guard cannot use
    // this treatment — its programs are rebuilt on a chain or resize change — so they are armed per pass
    // instead, via `setDiagSentinel()` below.
    for (const p of [blitProgram, decayProgram, decayBlurProgram]) {
      gl.useProgram(p);
      gl.uniform1f(gl.getUniformLocation(p, 'uDiagSentinel'), DIAG_SENTINEL);
    }
    gl.useProgram(null);
    // TransMap's own two copies of the guard. ONE call, even though its programs are relinked on every chain
    // and resize change: this sets a FIELD on the processor, which re-uploads it per pass, and the processor
    // object itself is `const` — `reinitTransMap()` does `dispose()` + `initTransMap()` on this same instance.
    // The field deliberately survives `dispose()` for exactly this reason (see `setDiagSentinel`).
    transMap.setDiagSentinel(DIAG_SENTINEL);
  }

  let trailDecay = preset?.renderer.decayFactor ?? 0.86;
  let blurEnabled = (preset?.renderer.blurRadius ?? 0) > 0;
  let speedFactor = preset?.overlay?.speedFactor ?? 1.0;
  // Figure Scale — multiplier on the generator's uniform canvas fit. Preset-intrinsic, like speedFactor.
  let figureScale = preset?.overlay?.figureScale ?? 1.0;
  generator.setViewScale(figureScale);
  // Particle Size — global multiplier on every particle path's base size. Preset-intrinsic, like the two
  // above. Handed to the renderer in the group below, beside the other renderer config.
  let particleSizeScale = preset?.overlay?.particleSize ?? 1.0;
  // E30 dihedral symmetry. `1` is OFF, so all 177 legacy presets (none of which carry an `overlay`
  // block) are unaffected until someone moves the slider.
  let symmetryFold = preset?.overlay?.symmetryFold ?? 1;
  let symmetryMirror = preset?.overlay?.symmetryMirror ?? true;
  generator.setSymmetry(symmetryFold, symmetryMirror);
  /*
   * v8 Phase 42 — **3-D Symmetry**: ONE reader and ONE adoption function for every path (the startup preset here,
   * `applyPresetChange`, the Reset path; the live setter writes through `setSym3d`). ⚠️ A model-space operator has
   * FOUR adoption paths and missing one is silent — `adoptTwist`'s header — so none of them transcribes the defaults.
   */
  const readSym3d = (ov: OverlayState | undefined): Sym3dConfig => ({
    layout: ov?.sym3dLayout ?? SYM3D_DEFAULTS.layout,
    positions: ov?.sym3dPositions ?? SYM3D_DEFAULTS.positions,
    on: ov?.sym3dOn ?? SYM3D_DEFAULTS.on,
    local: ov?.sym3dLocal ?? SYM3D_DEFAULTS.local,
    radius: ov?.sym3dRadius ?? SYM3D_DEFAULTS.radius,
    mirrors: ov?.sym3dMirrors ?? SYM3D_DEFAULTS.mirrors,
    facing: ov?.sym3dFacing ?? SYM3D_DEFAULTS.facing,
  });
  let sym3d: Sym3dConfig = readSym3d(preset?.overlay);
  function adoptSym3d(ov: OverlayState | undefined): void {
    sym3d = readSym3d(ov);
    generator.setSymmetry3d(sym3d);
  }
  generator.setSymmetry3d(sym3d);
  /** The export block: value-GATED on the layout, so a preset that never used 3-D Symmetry exports the same bytes. */
  const sym3dExport = (): Partial<OverlayState> => (sym3d.layout !== 'off' ? {
    sym3dLayout: sym3d.layout, sym3dLocal: sym3d.local, sym3dRadius: sym3d.radius, sym3dMirrors: sym3d.mirrors,
    sym3dFacing: sym3d.facing,
    ...(sym3d.layout === 'ring' || sym3d.layout === 'sphere' ? { sym3dPositions: sym3d.positions } : { sym3dOn: sym3d.on }),
  } : {});
  /*
   * v8 `30.1` (`E129a`) — the twist triple, adopted and handed over at **exactly the four sites
   * `setSymmetry` is handed over at**, and that parity is the design rather than a coincidence.
   *
   * ⚠️ **A MODEL-SPACE OPERATOR HAS FOUR ADOPTION PATHS AND MISSING ONE IS SILENT**: the initial preset
   * here, `applyPresetChange`, the Reset path, and the live setter. `adoptTwist()` exists so the four read
   * one function rather than three transcriptions of one rule — *three enumerations of one list make a
   * missing entry structurally invisible*, and `symmetryFold` is the proof that four hand-written copies is
   * what the alternative looks like.
   *
   * ⚠️ **FOUR PATHS AND NOT FIVE, AND THE REASON IS WORTH STATING SO NOBODY ADDS A RE-HAND THAT IS NOT
   * NEEDED.** `generator` is a `const` constructed once; `initGenerator()` calls `generator.init(config)`
   * rather than replacing the object, and `init()` does not touch `twist` (it is a field initialiser, like
   * `symmetryFold`). **So the twist survives a re-init and no `reapplyRendererState()`-style re-hand is
   * owed** — which is the opposite of the renderer's uniform locations, and the distinction is whether the
   * owning object is rebuilt or merely re-initialised.
   */
  const twist: [number, number, number] = [0, 0, 0];
  function adoptTwist(ov: OverlayState | undefined): void {
    twist[0] = ov?.twistX ?? 0;
    twist[1] = ov?.twistY ?? 0;
    twist[2] = ov?.twistZ ?? 0;
    generator.setTwist(0, twist[0]!);
    generator.setTwist(1, twist[1]!);
    generator.setTwist(2, twist[2]!);
  }
  adoptTwist(preset?.overlay);

  /*
   * v8 `32.1`/`32.2` (`E129b`) — Barr taper and bend, adopted at the same sites and for the same reason
   * as the twist: `setTaper`/`setBend` take one axis each, so a module-level array is the only way a
   * re-init can restore all three without the apply path knowing which of them changed.
   */
  const taper: [number, number, number] = [0, 0, 0];
  const bend: [number, number, number] = [0, 0, 0];
  function adoptTaperBend(ov: OverlayState | undefined): void {
    taper[0] = ov?.taperX ?? 0;
    taper[1] = ov?.taperY ?? 0;
    taper[2] = ov?.taperZ ?? 0;
    bend[0] = ov?.bendX ?? 0;
    bend[1] = ov?.bendY ?? 0;
    bend[2] = ov?.bendZ ?? 0;
    for (const ax of [0, 1, 2] as const) {
      generator.setTaper(ax, taper[ax]!);
      generator.setBend(ax, bend[ax]!);
    }
  }
  adoptTaperBend(preset?.overlay);

  /*
   * v8 `33.2`/`33.3` — `Sharpness` and `Travel`, adopted at the same sites and for the same reason as the
   * twist: `init()` does not touch either field, so they survive a re-init and no `reapplyRendererState()`
   * re-hand is owed — but **every apply path must still revert them**, or a Reset leaves the live value
   * standing over the new preset.
   *
   * ⚠️ **`sharpness` is a SCALAR and `travel` a TRIPLE, and they are adopted together deliberately**: they
   * are the two figure terms this phase adds, they share one UI group, and one call site cannot leave the
   * other stale. The generator clamps and snaps both, so the module copies are re-read from it afterwards
   * — `32.14`'s rule, so the panel and the engine cannot disagree.
   */
  /*
   * ⚠️⚠️ **v8 `34.D11`: THE `?? sharpness` BACKFILL LIVES HERE AND NOWHERE ELSE, AND THIS IS THE MOST
   * IMPORTANT LINE IN PHASE 34.**
   *
   * The shipped `overlay.sharpness` is GLOBAL across all three wave levels, so a preset carrying
   * `sharpness: 1` facets everything. Per-level bases make it one level of three — so the two new keys MUST
   * read `?? sharpness`, **never `?? 0`.** With `?? 0`, **exactly six presets change appearance in
   * silence**: `Quader Faceted` (1), `Cylinder Chamfered` (0.5), `Pipes Mitred` (0.85),
   * `Quader Star Eight` (1), `Quader Star Twelve` (1), `Pipes Star Twenty` (1) — **three of them the
   * owner's finetuned star exports**, which `33.6`'s replacement rests on and which the project records as
   * authoritative over any refinement rule, and five of them at the maximum so the regression would be at
   * full amplitude rather than marginal. `deformcheck` §N measures that, because `tsc` cannot.
   *
   * ⚠️ **ONE PLACE, and the two reasons are both load-bearing.** (1) There are **TWO `init()` call sites**
   * for the generator — here and `ui/preview-grid/grid-tile-renderer.ts` — and a backfill written twice is
   * the defect the preview grid already paid for once, when it forwarded `setViewScale` and `setSymmetry`
   * and nothing else for four phases. The tile renderer therefore resolves the SAME expression, and
   * `deformcheck` §N asserts the two agree rather than trusting them to. (2) A backfill inside the
   * generator's own getter would make `getSharpnessLevels()` disagree with what a preset carries, and the
   * Visual FX panel reads the generator back after every set (`32.14`'s rule).
   *
   * ⚠️ **Consequence to accept knowingly: there is no absent-key spelling of "Body only".** Omitting
   * `sharpnessStructure` means *follow Body*, which is why the export gate's **all three or none** rule is
   * load-bearing rather than cosmetic — if it ever emits one of the three alone, every Body-only preset
   * silently becomes uniform.
   */
  const sharpnessLevels: [number, number, number] = [0, 0, 0];
  const travel: [number, number, number] = [0, 0, 0];
  /*
   * v8 `34.2`/`34.3`/`34.4` — the twenty-four remaining figure-operator copies, adopted at the same site and
   * for the same reason as `travel`: `init()` does not touch any of them, so they survive a re-init and no
   * `reapplyRendererState()` re-hand is owed — but **every apply path must still revert them**, or a Reset
   * leaves the live value standing over the new preset.
   *
   * ⚠️ **Every copy is re-read FROM THE GENERATOR after the set**, because the setters clamp and (for the
   * bases and the signed depths) SNAP. `32.14`: a snap the panel cannot show is a snap that does not exist.
   */
  let sharpnessDepth = 0, sharpnessRate = 0;
  const travelDepth: [number, number, number] = [0, 0, 0];
  const travelRate: [number, number, number] = [0, 0, 0];
  const offset: [number, number, number] = [0, 0, 0];
  const offsetDepth: [number, number, number] = [0, 0, 0];
  const offsetRate: [number, number, number] = [0, 0, 0];
  const grow: [number, number, number] = [0, 0, 0];
  const growDepth: [number, number, number] = [0, 0, 0];
  const growRate: [number, number, number] = [0, 0, 0];
  /** Copy a generator read-back triple into a module-level mirror. One helper, ten call sites. */
  function mirror(dst: [number, number, number], src: readonly [number, number, number]): void {
    dst[0] = src[0]; dst[1] = src[1]; dst[2] = src[2];
  }
  function adoptFigureBasis(ov: OverlayState | undefined): void {
    // ⚠️ `?? sharpness`, NEVER `?? 0` — see this block's header and `34.D11`.
    const body = ov?.sharpness ?? 0;
    generator.setSharpnessLevels(body, ov?.sharpnessStructure ?? body, ov?.sharpnessDetail ?? body);
    mirror(sharpnessLevels, generator.getSharpnessLevels() as [number, number, number]);
    generator.setSharpnessBreath(ov?.sharpnessDepth ?? 0, ov?.sharpnessRate ?? 0);
    sharpnessDepth = generator.getSharpnessDepth();
    sharpnessRate = generator.getSharpnessRate();
    const TRAVEL = ['travelX', 'travelY', 'travelZ'] as const;
    const TRAVEL_D = ['travelDepthX', 'travelDepthY', 'travelDepthZ'] as const;
    const TRAVEL_R = ['travelRateX', 'travelRateY', 'travelRateZ'] as const;
    const OFFSET = ['offsetX', 'offsetY', 'offsetZ'] as const;
    const OFFSET_D = ['offsetDepthX', 'offsetDepthY', 'offsetDepthZ'] as const;
    const OFFSET_R = ['offsetRateX', 'offsetRateY', 'offsetRateZ'] as const;
    const GROW = ['growX', 'growY', 'growZ'] as const;
    const GROW_D = ['growDepthX', 'growDepthY', 'growDepthZ'] as const;
    const GROW_R = ['growRateX', 'growRateY', 'growRateZ'] as const;
    for (const ax of [0, 1, 2] as const) {
      generator.setTravel(ax, ov?.[TRAVEL[ax]] ?? 0);
      generator.setTravelDepth(ax, ov?.[TRAVEL_D[ax]] ?? 0);
      generator.setTravelRate(ax, ov?.[TRAVEL_R[ax]] ?? 0);
      generator.setOffset(ax, ov?.[OFFSET[ax]] ?? 0);
      generator.setOffsetDepth(ax, ov?.[OFFSET_D[ax]] ?? 0);
      generator.setOffsetRate(ax, ov?.[OFFSET_R[ax]] ?? 0);
      // ⚠️ `?? 0` and NOT `?? 1` — `grow` is a ramp COEFFICIENT and 0 is its identity (`GROW_FLOOR`).
      generator.setGrow(ax, ov?.[GROW[ax]] ?? 0);
      generator.setGrowDepth(ax, ov?.[GROW_D[ax]] ?? 0);
      generator.setGrowRate(ax, ov?.[GROW_R[ax]] ?? 0);
    }
    mirror(travel, generator.getTravel() as [number, number, number]);
    mirror(travelDepth, generator.getTravelDepth() as [number, number, number]);
    mirror(travelRate, generator.getTravelRate() as [number, number, number]);
    mirror(offset, generator.getOffset() as [number, number, number]);
    mirror(offsetDepth, generator.getOffsetDepth() as [number, number, number]);
    mirror(offsetRate, generator.getOffsetRate() as [number, number, number]);
    mirror(grow, generator.getGrow() as [number, number, number]);
    mirror(growDepth, generator.getGrowDepth() as [number, number, number]);
    mirror(growRate, generator.getGrowRate() as [number, number, number]);
  }
  adoptFigureBasis(preset?.overlay);

  /*
   * v8 `33.4` — which foliation the escape flow follows. **Its own adopter rather than a clause in
   * `adoptFigureBasis`**, because it is an ATTRACTOR property and that function owns figure terms: folding
   * them together would put one call site in charge of two unrelated subsystems and make the next reader
   * guess which.
   *
   * ⚠️ Default `'contour'` is the shipped behaviour, so every preset authored before this phase is
   * unchanged and the key stays out of their exports.
   */
  let escapeFlowMode: 'contour' | 'ray' = 'contour';
  function adoptEscapeFlow(ov: OverlayState | undefined): void {
    escapeFlowMode = ov?.escapeFlow ?? 'contour';
    generator.setEscapeFlow(escapeFlowMode);
  }
  adoptEscapeFlow(preset?.overlay);

  /*
   * v8 `32.7` (`E133`) — the 3D inversion. **ONE state object rather than three loose scalars**, for
   * `boxFold`'s reason: the three are meaningless apart and `setInversion` takes all three at once, so a
   * single call site cannot leave two of them stale.
   */
  const inversion = { amount: 0, radius: 1 };
  function adoptInversion(ov: OverlayState | undefined): void {
    inversion.amount = ov?.invertAmount ?? 0;
    inversion.radius = ov?.invertRadius ?? 1;
    generator.setInversion(inversion.amount, inversion.radius);
  }
  adoptInversion(preset?.overlay);

  /*
   * v8 `30.2` (`E130`) — the box-fold, adopted at the same four sites for the same reason. **One state
   * object rather than four loose scalars**, because the four are meaningless apart and `setBoxFold` takes
   * them together: a shape that cannot leave three of them stale.
   */
  const boxFold = { iterations: 0, limit: BOX_FOLD_DEFAULT_LIMIT, scale: 1 };
  function adoptBoxFold(ov: OverlayState | undefined): void {
    boxFold.iterations = ov?.boxFoldIterations ?? 0;
    boxFold.limit = ov?.boxFoldLimit ?? BOX_FOLD_DEFAULT_LIMIT;
    boxFold.scale = ov?.boxFoldScale ?? 1;
    handBoxFold();
  }
  function handBoxFold(): void {
    generator.setBoxFold(boxFold.iterations, boxFold.limit, boxFold.scale);
    // Read the CLAMPED values back, so the UI and every export carry what the engine is actually using
    // rather than what the caller asked for. `setTwist` does the same, one axis at a time.
    const live = generator.getBoxFold();
    boxFold.iterations = live.iterations; boxFold.limit = live.limit;
    boxFold.scale = live.scale;
  }
  adoptBoxFold(preset?.overlay);

  /*
   * v8 Phase 38 — the Fractal Fold, adopted on both apply paths for the box fold's reason (one state object, one
   * hand-off, the engine's CLAMPED and SNAPPED values read back so the panel and every export carry what runs).
   * Defaults are `core/fractal-fold.ts`' constants — the same values `SCALAR_IDENTITIES` pins.
   */
  const fractalFold = {
    iterations: 0, limit: FRACTAL_FOLD_DEFAULT_LIMIT, scale: FRACTAL_FOLD_DEFAULT_SCALE,
    limitDepth: 0, limitRate: 0, scaleDepth: 0, scaleRate: 0,
  };
  function adoptFractalFold(ov: OverlayState | undefined): void {
    fractalFold.iterations = ov?.fractalFoldIterations ?? 0;
    fractalFold.limit = ov?.fractalFoldLimit ?? FRACTAL_FOLD_DEFAULT_LIMIT;
    fractalFold.scale = ov?.fractalFoldScale ?? FRACTAL_FOLD_DEFAULT_SCALE;
    fractalFold.limitDepth = ov?.fractalFoldLimitDepth ?? 0;
    fractalFold.limitRate = ov?.fractalFoldLimitRate ?? 0;
    fractalFold.scaleDepth = ov?.fractalFoldScaleDepth ?? 0;
    fractalFold.scaleRate = ov?.fractalFoldScaleRate ?? 0;
    handFractalFold();
  }
  function handFractalFold(): void {
    generator.setFractalFold(fractalFold.iterations, fractalFold.limit, fractalFold.scale);
    generator.setFractalFoldBreath(fractalFold.limitDepth, fractalFold.limitRate,
      fractalFold.scaleDepth, fractalFold.scaleRate);
    Object.assign(fractalFold, generator.getFractalFold());
  }
  adoptFractalFold(preset?.overlay);
  /** The export, gated on the ITERATION COUNT (the operator's own gate) — ONE helper for BOTH export sites. */
  const fractalFoldExport = (): Partial<OverlayState> => (fractalFold.iterations > 0 ? {
    fractalFoldIterations: fractalFold.iterations, fractalFoldLimit: fractalFold.limit,
    fractalFoldScale: fractalFold.scale,
    ...(fractalFold.limitDepth !== 0 ? { fractalFoldLimitDepth: fractalFold.limitDepth, fractalFoldLimitRate: fractalFold.limitRate } : {}),
    ...(fractalFold.scaleDepth !== 0 ? { fractalFoldScaleDepth: fractalFold.scaleDepth, fractalFoldScaleRate: fractalFold.scaleRate } : {}),
  } : {});


  /*
   * v8 `31.2` (`E112`/`E113`/`E137`) — per-particle appearance, adopted at the same four sites. **One state
   * object**, the box-fold's and the plate's shape: `setChannels` takes the driver and the three amounts
   * together, so none of the four can be left stale.
   *
   * ⚠️ **THE DRIVER IS VALIDATED AGAINST THE ONE ENUMERATION RATHER THAN CAST**, because an import is not
   * a typed value: `preset.overlay.channelDriver` arrives from JSON. A bad word falling through to `index`
   * silently is the better failure than one reaching the generator's `switch` — where `default` IS `index`,
   * so the result would be the same picture with no record of why.
   */
  const channels = { driver: 'index' as ChannelDriver, size: 0, alpha: 0, light: 0 };
  function adoptChannels(ov: OverlayState | undefined): void {
    const d = ov?.channelDriver;
    channels.driver = (d !== undefined && CHANNEL_DRIVERS.includes(d)) ? d : 'index';
    channels.size = ov?.channelSize ?? 0;
    channels.alpha = ov?.channelAlpha ?? 0;
    channels.light = ov?.channelLight ?? 0;
    handChannels();
  }
  function handChannels(): void {
    generator.setChannels(channels.driver, channels.size, channels.alpha, channels.light);
    // The clamped values back, as `handBoxFold` does.
    const live = generator.getChannels();
    channels.driver = live.driver; channels.size = live.size;
    channels.alpha = live.alpha; channels.light = live.light;
  }
  adoptChannels(preset?.overlay);

  /*
   * v8 `31.4` (`E132`) — the 4D rotation, adopted at the same
   * four sites as every operator before them. **Held here as well as in the generator because the export
   * gates read THIS copy and `generator` publishes no overlay** — `adoptCurveBias`' own reason.
   */
  const deform4d = { wScale: 0, xw: 0, yw: 0, zw: 0, winding: 3 };
  function adoptDeform4d(ov: OverlayState | undefined): void {
    deform4d.wScale = ov?.wScale ?? 0;
    deform4d.xw = ov?.wXW ?? 0;
    deform4d.yw = ov?.wYW ?? 0;
    deform4d.zw = ov?.wZW ?? 0;
    deform4d.winding = ov?.wWinding ?? 3;
    handDeform4d();
  }
  function handDeform4d(): void {
    generator.setWRotation(deform4d.wScale, deform4d.xw, deform4d.yw, deform4d.zw, deform4d.winding);
    // The clamped values back, as every `hand*` here does. ⚠️ Only `wScale` is clamped in the generator;
    // the three angles WRAP and are returned verbatim, which is `setPaletteHueShift`'s own contract.
    const live = generator.getWRotation();
    deform4d.wScale = live.scale; deform4d.xw = live.xw;
    deform4d.yw = live.yw; deform4d.zw = live.zw; deform4d.winding = live.winding;
  }
  adoptDeform4d(preset?.overlay);

  // Curl noise runtime state
  const DEFAULT_CURL = { enabled: false, turbulence: 0, scale: 1.0, evolutionSpeed: 0.5 };
  const currentCurl = { ...(preset?.overlay?.curlNoise ?? DEFAULT_CURL) };
  generator.setCurlNoise(currentCurl);

  // Physarum network runtime state
  const DEFAULT_PHYSARUM: PhysarumConfig = {
    blend: 0, sensorAngle: 30, sensorDistance: 20,
    turnSpeed: 45, decayRate: 0.2, depositAmount: 0.05,
    showTrail: true, trailOpacity: 0.8, trailColour: PHYSARUM_TRAIL_COLOUR_PRESET,
  };
  const currentPhysarum: PhysarumConfig = { ...DEFAULT_PHYSARUM };
  const physarumProcessor = new PhysarumProcessor();
  if (gl) physarumProcessor.init(gl);

  // Fluid advection runtime state
  const DEFAULT_FLUID: FluidAdvectionConfig = { blend: 0, returnForce: 0.5 };
  const currentFluid: FluidAdvectionConfig = { ...DEFAULT_FLUID };
  const fluidProcessor = new FluidAdvectionProcessor();
  if (gl) fluidProcessor.init(gl);
  // Previous-frame screen positions for computing per-particle velocity splats
  let fluidPrevPositions: Float32Array | null = null;
  // EMA-smoothed per-particle velocities to prevent frame-to-frame sign oscillation
  let fluidSmoothedVel: Float32Array | null = null;
  // Scratch UV buffers, reused across frames (D8). Every consumer takes an explicit `count` and is
  // index-bounded, so these are allowed to be LONGER than the live particle count — see the
  // grow-only note in the fluid block below.
  let fluidUVs: Float32Array | null = null;
  let fluidVelUVs: Float32Array | null = null;
  // `fluidVelUVs` is only written for indices whose velocity could be computed. On a grow, the new
  // tail holds stale values from a previous, larger figure, so the used range is zeroed per frame.
  let fluidPrevCount = 0;

  /*
   * v8 Step 15.7 (E90) — the advected dye field.
   *
   * ⚠️ **`init(gl)` HERE ALLOCATES ONLY A 1×1 FALLBACK TEXTURE; the field's 8 objects are allocated lazily by
   * the processor on its first active frame.** That split is triage G14's finding turned into a rule: the
   * deleted dye field allocated 13 GL objects the moment its config was set, for passes that were never
   * called. No preset in the library authors an `overlay.dye` block, so eager allocation here would cost every
   * session 8 objects for a subsystem that draws nothing.
   *
   * ⚠️ **A SEPARATE PROCESSOR FROM `fluidProcessor`, and not a fifth concern inside it.** The dye BORROWS that
   * one's velocity texture (`getVelocityTexture()`) and owns nothing of the sim. The previous dye code was
   * invisible for three months precisely because it sat among four live subsystems in that file that all
   * looked alike; the deletion's own note required its own render pass.
   */
  const currentDye: DyeFieldConfig = { ...DEFAULT_DYE_CONFIG, ...(preset?.overlay?.dye ?? {}) };
  const dyeProcessor = new DyeFieldProcessor();
  if (gl) dyeProcessor.init(gl);
  /**
   * Grow-only scratch for the per-particle dye colours (invariant 8 — this is a per-frame path).
   *
   * ⚠️ **Not shared with any other scratch buffer.** `subsetPos` and the fluid UV buffers are rewritten by
   * their own consumers within the same frame, so a shared buffer would have two writers per frame and the
   * loser's data would depend on call order — the kind of coupling that reads as a colour flicker.
   */
  let dyeColours = new Float32Array(0);

  // Scratch for `drawParticleSubset` and `fillSparkIndices` (H5), grow-only for the same reason as the
  // fluid buffers above. Unlike those, nothing here is INTEGRATED state — every entry is rewritten from
  // `state` before use and read back through `subarray(0, n)` — so a stale tail is unobservable and no
  // per-frame zeroing is needed. That is also why growing may reallocate freely: there is nothing to
  // preserve, in contrast to `LissajousGenerator.setParticleCount()`, where reallocating to zeros would
  // disturb the figure.
  let subsetPos = new Float32Array(0);
  let subsetCol = new Float32Array(0);
  let subsetDep = new Float32Array(0);
  let subsetVel = new Float32Array(0);
  let subsetFrozen = new Uint8Array(0);
  let sparkIdx = new Int32Array(0);

  // Render mode runtime state (separate from preset so it can be changed live without full reinit)
  // Seeded from what the renderer ACTUALLY initialised to at boot, not from the preset's request.
  //
  // `initRenderer` already ran above, and `initVolume`/`initLiquid` fall back to 'star' when
  // `EXT_color_buffer_float` is missing (ADR 010). Reading `preset.renderer.mode` here would therefore
  // start the session advertising a mode that was never active — the boot-time half of R10, which
  // `reconcileRenderMode()` cannot cover because it is declared later. Identical to the old expression
  // whenever the requested mode is supported.
  let currentRenderMode: RenderMode = renderer.getActiveRenderMode();
  let previousRenderMode: RenderMode = currentRenderMode;
  // Name of the preset the last `applyPresetChange` ran for, so a re-apply of the SAME preset can be
  // told from a genuine switch. See the render-mode resolution in `applyPresetChange`.
  let lastAppliedPresetName: string | null = preset?.metadata.name ?? null;

  // Material runtime state
  // ⚠️ Annotated with the TOP-LEVEL `MaterialConfig` import rather than an inline `import(...)` type since
  // 22.1: the resolver that used to be this file's only other user of the named import moved out, and an
  // unused type import is a `tsc` error under `noUnusedLocals`. Same type, one spelling.
  let currentMaterial: MaterialConfig | null = preset?.overlay?.material ?? null;
  if (currentMaterial && currentMaterial.preset !== 'None') {
    generator.setMaterialConfig(currentMaterial);
  }

  // Buoyancy, spark, volume runtime state
  let currentBuoyancy: BuoyancyConfig = { ...(preset?.overlay?.buoyancy ?? DEFAULT_BUOYANCY_CONFIG) };
  let currentSpark: SparkConfig = { ...(preset?.overlay?.sparks ?? DEFAULT_SPARK_CONFIG) };
  let currentVolume: VolumeRenderConfig = { ...(preset?.overlay?.volumeRender ?? DEFAULT_VOLUME_CONFIG) };
  /**
   * v8 Step 15.1 — the liquid surface's live config.
   *
   * ⚠️ **DEFAULTS FIRST, then the preset's block on top — `currentCrystal`'s pattern, not
   * `currentVolume`'s.** A spread of the preset block alone leaves any field the export predates
   * `undefined`, and an `undefined` reaching `gl.uniform1f` is NaN — after which the threshold comparison
   * is false everywhere and the surface is simply absent (invariant 14). Phase 15 adds fields to this block
   * in steps 15.2–15.7, so exports written between now and then WILL be short.
   */
  let currentLiquid: LiquidSurfaceConfig = { ...DEFAULT_LIQUID_CONFIG, ...(preset?.overlay?.liquid ?? {}) };

  /**
   * v8 28.2 (`28.D8`) — **THE ONE OWNER OF "IS THE DYE ON SCREEN". Invariant 17.**
   *
   * Two sources now decide one thing, so they must resolve in ONE order with nothing writing the result
   * afterwards. **Declared here because this is the first point at which all three inputs exist**
   * (`currentDye`, `currentRenderMode`, `currentLiquid`) — moving it earlier would read an undeclared
   * binding, and moving it into the frame body would build a closure per frame (invariant 8 watches the
   * allocation RATE, not the time).
   *
   * ⚠️ **THE `liquid` REFUSAL IS NOT AN OPTIMISATION.** In `liquid` mode with `tintSource === 'dye'` the
   * surface fragment ALREADY composites the wake in its `cover <= 0.0` branch, with the identical
   * algebra and the identical constant. Running the overlay as well would draw it TWICE, compositing to
   * `1 - (1-a)^2` instead of `a` — a brightened, over-saturated wake that reads as the dye being too
   * strong rather than as a double draw.
   *
   * ⚠️ **RE-DERIVED PER CALL, NEVER LATCHED.** `renderMode` and `tintSource` both change live, and a
   * cached flag would survive a mode switch — the one event this function exists to notice.
   *
   * ⚠️ **`isActive()` tests `enabled && opacity > 0`, which is NOT the gate the velocity field uses.**
   * That one is `enabled` ALONE, deliberately, so an `opacity: 0` dye does not silently stop a field the
   * liquid pool also needs. **Do not unify them.**
   */
  const dyeHidesFigure = (): boolean =>
    dyeProcessor.isActive() && (currentDye.showFigure ?? true) === false;

  /**
   * Does the iso surface draw this frame? **In `liquid` mode the surface IS the figure**, so hiding the
   * figure hides it — which is also what lets the question below have a correct answer.
   */
  const liquidSurfaceDraws = (): boolean =>
    currentRenderMode === 'liquid' && !dyeHidesFigure();

  /**
   * v8 28.2 (`28.D8`) — should the STANDALONE overlay pass run?
   *
   * ⚠️ **THE REFUSAL IS CONDITIONAL ON THE SURFACE ACTUALLY DRAWING, AND THE FIRST BUILD GOT THIS WRONG
   * (owner report 2026-10-19).** It refused whenever `renderMode === 'liquid' && tintSource === 'dye'`,
   * which is right *while the surface draws* — that fragment composites the identical wake in its own
   * `cover <= 0.0` branch, so running both gives `1 - (1-a)^2` instead of `a`. But with the figure hidden
   * the surface does **not** draw, so there is nothing to double, and refusing left the only dye path for
   * that preset switched off.
   *
   * ⚠️ **THE REAL DEFECT WAS ONE PREDICATE ANSWERING TWO QUESTIONS — invariant 17's shape, built by hand.**
   * *"Is the dye on screen at all?"* (which decides whether hiding the figure is safe) and *"should the
   * overlay pass run?"* (which prevents a double draw) have DIFFERENT answers in exactly one
   * configuration: `liquid` + `tintSource: 'dye'`. The symptom was a control that did nothing at all on
   * the owner's own preset, which is invariant 13's harder shape — the box moved the right field and the
   * output channel could not show it.
   */
  const dyeOverlayActive = (): boolean =>
    dyeProcessor.isActive() && !(liquidSurfaceDraws() && currentLiquid.tintSource === 'dye');
  /**
   * v8 Step 15.4 — cohesion. Defaults first, same as `currentLiquid` and for the same reason (invariant 14).
   *
   * ⚠️ **Unlike `currentLiquid` this is NOT gated on the render mode** — it displaces `positions`, so it is
   * live in all seven modes. Do not "tidy" it into the liquid block on the strength of them being one phase.
   */
  let currentCohesion: CohesionConfig = { ...DEFAULT_COHESION_CONFIG, ...(preset?.overlay?.cohesion ?? {}) };
  /**
   * v8 Step 15.5 — the liquid FIELD pool (relationship B: the figure stirs a liquid). Defaults first, for
   * invariant 14's reason exactly as above.
   *
   * ⚠️ **Its own overlay block, not a field inside `overlay.liquid`, and the reason is the same one that
   * gave cohesion its own: it publishes a second PARTICLE POPULATION, so it is live in all seven render
   * modes.** `overlay.liquid` is read only by the `liquid` render mode's fullscreen pass; this pool is
   * drawn by whatever renderer is active. Sharing a block would have gated the pool on a render mode it
   * does not depend on.
   */
  let currentLiquidField: LiquidFieldConfig = { ...DEFAULT_LIQUID_FIELD_CONFIG, ...(preset?.overlay?.liquidField ?? {}) };
  // v8 Phase 8a — Faceted Crystal
  // Defaults FIRST, then the preset's block on top. A Phase 8a-era export carries only the 8a
  // subset of `overlay.crystal` (no birthRule, no lifecycle timings), so spreading it alone would
  // leave those fields undefined and the lifecycle would compute NaN durations. Merging keeps
  // 8a presets working, reinterprets their `freezeCap` as pool occupancy, and supplies the 8a-3
  // `poolSize` they cannot carry (data-delta §8).
  let currentCrystal: CrystalRenderConfig = { ...DEFAULT_CRYSTAL_CONFIG, ...(preset?.overlay?.crystal ?? {}) };
  renderer.setCrystalConfig(currentCrystal);
  // T023: the generator drives the pool from inside its own update(); it no-ops while
  // `enabled` is false, so the config is forwarded unconditionally here and at every change site.
  generator.setCrystalConfig(currentCrystal);

  /**
   * Hand `currentSpark` to BOTH owners: the generator (which spawns and integrates the sparks) and the
   * renderer (which now sizes them from `sparks.splatRadius`).
   *
   * ⚠️ **A helper rather than two calls, because `generator.setSparkConfig` has SIX call sites** — the init
   * path, the overlay-apply branch, three material-swap branches and the `VisualFxControls` setter. Adding a
   * second line at each is exactly the shape `DEFAULT_LINE_WIDTH`/`DEFAULT_ATTRACTOR_BLEND` record: the two
   * halves drift, and here the drift is silent, because a missed site leaves sparks drawing at the previous
   * preset's radius rather than throwing.
   *
   * ⚠️ **`null` when sparks are DISABLED.** The radius must not describe a population the generator has
   * stopped publishing (invariant 3's shape), and `enabled` alone is the whole inertness gate for sparks —
   * see `lissajous.ts`'s `getState()`.
   */
  function applySparkConfig(): void {
    generator.setSparkConfig(currentSpark);
    renderer.setSparkRadius(currentSpark.enabled ? currentSpark.splatRadius : null);
  }

  /**
   * The resolved palette as 256 RGBA bytes, memoised by NAME — for `dye.colourSource === 'palette'`.
   *
   * ⚠️ **`getPaletteLUT()` DOES NOT CACHE: it allocates a fresh 1 KB `Uint8Array` and evaluates 256 cosines
   * (or walks a gradient) on every call.** The dye resolver runs once per frame, so calling it straight
   * would be 60 allocations and 15 360 cosines a second for a value that changes only on a user edit or a
   * preset change — invariant 8's shape, where the cost arrives as a periodic hitch rather than as an
   * error. ⚠️ **ONE slot is enough and a `Map` would be the wrong shape**: there is exactly one live
   * palette at a time, so a map would only accumulate every palette the session ever selected.
   *
   * ⚠️ **Keyed on the RESOLVED name (`livePaletteSelection.name`), never on `overlayPalette` or on the film
   * look's field.** The pair has two sources and `palette-selection.ts` is their one resolver (invariant
   * 17); keying on either half would make the memo stale in exactly the case where the other half won.
   * `''` is the "nothing resolved" key and is also `PALETTE_UNSET`, so it can never collide with a name.
   */
  let dyePaletteLutName = '\u0000';
  let dyePaletteLut: Uint8Array | null = null;
  function dyePaletteRamp(): Uint8Array | null {
    const name = livePaletteSelection.name;
    if (name !== dyePaletteLutName) {
      dyePaletteLutName = name;
      // ⚠️ The same three-case test `resolvePhysarumTrailLut()` makes, for the same reason: `'none'` is a
      // real palette VALUE meaning "no palette" (3 of the 15 named looks carry it) and `PALETTE_UNSET` is
      // "not overridden" — neither is a name to look up, and `getPaletteLUT` would return `null` for both
      // anyway. Stated rather than relied on, because a future prefix rule could make `'none'` resolve.
      dyePaletteLut = (name && name !== 'none' && name !== PALETTE_UNSET) ? getPaletteLUT(name) : null;
    }
    return dyePaletteLut;
  }

  /**
   * v8 28.4 (`28.D2`) — the LUT for `dye.colourSource === 'ramp'`: the dye's own gradient, memoised by name.
   *
   * ⚠️ **IT MUST NOT CONSULT `currentMaterial.colourRamp`, AND THAT IS THE WHOLE POINT OF THE MEMBER.**
   * `'depth'` and `'temperature'` both borrow the material's ramp; if this did too it would be `'depth'`
   * with extra steps. The five pre-28 sources span fully-linked to flat-independent but none is both
   * INDEPENDENT and VARYING, which is the gap this closes — and it matters most in exactly the case 28.5
   * creates, a figure-free dye with no material, where `'depth'` paints everything the hardcoded ice ramp.
   *
   * ⚠️ **Resolved through `getPaletteLUT()`, so the whole palette namespace is reachable** (`Classic: `,
   * `Material: `, `Cycle: ` and the bare cosine names) — the same function and therefore the same
   * vocabulary the Colour Palette dropdown offers, rather than a second, smaller colour language.
   * **Degrades to `null`, which the caller turns into `'depth'`'s own ramp and NEVER into black.**
   */
  let dyeOwnLutName = '\u0000';
  let dyeOwnLut: Uint8Array | null = null;
  function dyeOwnRamp(): Uint8Array | null {
    const name = currentDye.ramp ?? DEFAULT_DYE_CONFIG.ramp ?? '';
    if (name !== dyeOwnLutName) {
      dyeOwnLutName = name;
      dyeOwnLut = (name && name !== 'none' && name !== PALETTE_UNSET) ? getPaletteLUT(name) : null;
    }
    return dyeOwnLut;
  }

  /**
   * v8 Step 15.7 — fill `dyeColours` with the RGB each of the first `count` particles will deposit.
   *
   * ⚠️ **Count the branches below rather than this sentence** — and ⚠️ **every source that reads generator
   * state FALLS BACK TO `state.colors`, never to a literal, because a source that silently deposits BLACK is
   * invariant 13's harder form: the control moves exactly the right thing while the output channel cannot
   * show it.** A dye field is the surface's ALBEDO (see `dye-field.ts`), so black dye is a black body —
   * indistinguishable from the field being off, which is precisely the reading that would send the diagnosis
   * to the wrong control.
   *
   * - `'temperature'` needs `state.temperatures`, which **only a live material fills**. With no material
   *   selected the array is absent, so this source would deposit black on the majority of presets.
   * - `'velocity'` needs `state.velocities`, always present, mapped through the figure's own colour so the
   *   dye stays recognisably the preset's rather than an imposed hue: fast particles deposit their colour
   *   brightened, slow ones deposit it dimmed. ⚠️ **The normaliser is a fixed reference speed, not a
   *   per-frame max** — a per-frame max is a moving scale, so a figure slowing down would BRIGHTEN as its own
   *   maximum fell, which reads as the decay control misbehaving rather than as a normalisation choice.
   * - `'fixed'` needs nothing and always works, which is why it is the one source with no fallback path.
   * - `'depth'` and `'palette'` (2026-10-15) share ONE branch and ONE coordinate — see the block comment
   *   there, which owns why the palette is read here at all and why the two are not two loops.
   *
   * ⚠️ **`state.colors` is indexed by the SAME `i` as `positions`, so no offset arithmetic is needed here** —
   * and `count` is the caller's `waveCount`, which is the published index of the first tail slot, so every
   * index read is on the curve. Do not "simplify" this to `state.count` (see the call site).
   */
  function resolveDyeColours(state: GeneratorState, count: number): void {
    if (dyeColours.length < count * 3) dyeColours = new Float32Array(count * 3);
    const out = dyeColours;
    const src = currentDye.colourSource;
    const temps = state.temperatures;
    // ⚠️ Length-tested, not merely non-null: `getState()` publishes grow-only reused scratch, so an array can
    // be present and SHORTER than the live count (invariant 7). A short read would be `undefined`, and
    // `undefined * anything` is NaN — which in the dye's feedback loop is permanent (invariant 20).
    const haveTemps = !!temps && temps.length >= count;
    if (src === 'fixed') {
      const [r, g, b] = currentDye.fixedColour;
      for (let i = 0; i < count; i++) { out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b; }
      return;
    }
    // ⚠️ **`'depth'` IS THE ONE SOURCE THAT BOTH VARIES AND NEEDS NO MATERIAL, which is why it is the default
    // and why the list would be broken without it — see `DyeFieldConfig.colourSource`'s own note for the
    // measurement.** The surface reads `rgb / a`, so a spatially CONSTANT deposit makes every slider inert;
    // depth gives the near and far halves of the figure different colours, and the flow then smears them into
    // each other. That mixing is the only thing here no per-frame statistic can reproduce.
    //
    // Indexed through the material's ramp where there is one and `'ice'` otherwise — ⚠️ **deliberately the
    // SAME one-line precedence `'temperature'` uses three branches below.** `'ice'` is the material-free
    // default because it is the widest-range ramp of the seven — a near/far split needs two visibly
    // different ends, which is the whole point of this source.
    // ⚠️ `state.depths` is normalised to [0,1] by the generator (`lissajous.ts:1052` clamps it), so this needs
    // no range fit — but it IS length-tested like every other array here, `getState()` publishing grow-only
    // scratch (invariant 7).
    //
    /*
     * ⚠️ **`'palette'` (2026-10-15) SHARES THIS BRANCH, AND SHARING IT IS THE DESIGN RATHER THAN A SAVING.**
     * The member is `'depth'` with a different ramp: the coordinate is what makes a dye source work at all
     * (the surface reads `rgb / a`, so only a deposit that VARIES across the figure survives the quotient),
     * so a second loop would be a second place for that property to be got wrong. **The two differ in the
     * ramp and in the rotation, and in nothing else.**
     *
     * ⚠️ **THE COMMENT THAT STOOD HERE SAID THE PALETTE WAS DELIBERATELY OUT OF REACH, AND IT WAS RIGHT
     * ABOUT THE REASON AND WRONG ABOUT THE REMEDY.** It read: *"deliberately NOT the film look's palette.
     * The palette lives in the renderer, not here, so reaching it would make this a second resolver for a
     * setting that already has one (invariant 17)."* The hazard is real — but invariant 17 forbids a second
     * RESOLUTION, not a second READER, and `livePaletteSelection` exists precisely so that a reader can have
     * the resolved answer without re-deriving it. So this branch reads the cache that
     * `applyPaletteSelection()` alone writes, and re-derives nothing: no `??` chain over
     * `overlay.palette` / `FilmLookParams.palette`, and no test of which of the two won.
     * **`palettecheck` §F bans `main.ts` from reading a palette SOURCE, and this still does not.**
     *
     * ⚠️ **AND IT WAS WRONG ABOUT THE CONSEQUENCE, WHICH IS THE PART THAT COST A REPORT.** With the palette
     * unreachable here it is unreachable from the whole `tintSource: 'dye'` picture — the surface's palette
     * branch is `uTintSource == 1`, `uRamp` is `liquid.surfaceRamp`, and `colourMix` is forced to 0 for dye
     * — so "the palette does not reach the dye resolver" was in fact "the palette controls nothing in this
     * mode". Owner report, 2026-10-15. ⚠️ **A reachability note is not an impact note**: the question is
     * never only *may this file read X*, it is *what else could have read X if this file does not*.
     *
     * ⚠️ **The rotation is applied in TEXELS with an explicit identity at 0, mirroring the shader's own
     * `uPaletteHueShift == 0.0 ? rampAt : fract(rampAt + shift)`** — and the guard is load-bearing here for
     * a reason the shader does not have: this coordinate REACHES 1.0 exactly (a particle at the far plane),
     * where a `fract()` would wrap the far end of the ramp onto the near end and swap the two colours the
     * near/far split exists to separate. The integer modulo keeps shift 0 a bit-exact identity.
     */
    /*
     * v8 28.4 — `'ramp'` JOINS THIS BRANCH RATHER THAN GETTING ONE OF ITS OWN, because it shares the
     * coordinate: ⚠️ **the shared coordinate IS the design.** `rgb / a` is scale-invariant, so only a
     * deposit that varies ACROSS the figure survives the quotient — which is why `'fixed'` reads flat and
     * why a new source had to be a RAMP over a coordinate rather than another constant.
     */
    /*
     * v8 28.16 — ⚠️ **THE GATE GAINED `mapping === 'index' ||` AND THAT IS `28.D19`, NOT A TIDY-UP.**
     * Under the index coordinate no depth is read, so requiring `state.depths` would make the new mapping
     * fall through to the undimmed-colours path on any frame where depths are short — a
     * configuration-dependent inertness, which is the worst kind to debug.
     */
    const dyeMapping = currentDye.mapping ?? DEFAULT_DYE_CONFIG.mapping ?? 'depth';
    if ((src === 'depth' || src === 'palette' || src === 'ramp')
        && (dyeMapping === 'index' || state.depths.length >= count)) {
      const pal = src === 'palette' ? dyePaletteRamp() : src === 'ramp' ? dyeOwnRamp() : null;
      // The degrade: `'depth'`'s own ramp, never black (see `DyeFieldConfig.colourSource`). Reached by
      // `'none'`, by an unset palette, and by a name `getPaletteLUT` does not know — so an un-palettable
      // preset looks like ordinary depth dye rather than like a hole in the figure.
      const ramp = pal ?? getColourRampData(currentMaterial?.colourRamp ?? 'ice');
      // v8 28.4. ⚠️ **`pal` is now EITHER the figure's palette OR the dye's own ramp, and both honour the
      // 26.4 hue rotation** — `26.4`'s rule is *the same consumers, from the same one place*, and a new
      // LUT reader that skipped it would make `Warmth` move every colour in the frame except this one.
      const shift = pal ? overlayPaletteHueShift : 0;
      const shiftTexels = shift === 0 ? 0 : Math.round(shift * 256);
      /*
       * v8 28.16 — the coordinate selector. ⚠️ **TWO END RULES, ONE TEXEL LOOKUP (`28.D18`).**
       *
       * `depth` is byte-identical to the single expression this replaced, including its clamp: depth
       * reaches 1.0 EXACTLY at the far plane, and the integer texel modulo below keeps hue shift 0 a
       * bit-exact identity *precisely so a `fract()` cannot wrap the far end onto the near end and swap
       * the two colours the near/far split exists to separate.*
       *
       * `index` WRAPS, because cycle counts above 1 are its normal case — the same reason the figure's
       * own LUT branch wraps rather than clamping, and the same `turns` quantity.
       */
      const cyc = Math.max(1, currentDye.cycles ?? DEFAULT_DYE_CONFIG.cycles ?? 1);
      for (let i = 0; i < count; i++) {
        let t: number;
        if (dyeMapping === 'index') {
          const turns = (count > 1 ? i / count : 0) * cyc;
          t = turns - Math.floor(turns);
        } else {
          t = Math.min(1, Math.max(0, state.depths[i]!));
        }
        const base = Math.min(255, Math.max(0, Math.round(t * 255)));
        const idx = (shiftTexels === 0 ? base : (((base + shiftTexels) % 256) + 256) % 256) * 4;
        out[i * 3] = ramp[idx]! / 255;
        out[i * 3 + 1] = ramp[idx + 1]! / 255;
        out[i * 3 + 2] = ramp[idx + 2]! / 255;
      }
      return;
    }
    if (src === 'temperature' && haveTemps) {
      // The material's own ramp, so a Fire material deposits fire-coloured dye — the same precedence the
      // splat path uses (`material.colourRamp` by temperature), rather than a second colour vocabulary.
      const ramp = getColourRampData(currentMaterial?.colourRamp ?? 'fire');
      for (let i = 0; i < count; i++) {
        const t = Math.min(1, Math.max(0, temps![i]!));
        const idx = Math.min(255, Math.max(0, Math.round(t * 255))) * 4;
        out[i * 3] = ramp[idx]! / 255;
        out[i * 3 + 1] = ramp[idx + 1]! / 255;
        out[i * 3 + 2] = ramp[idx + 2]! / 255;
      }
      return;
    }
    if (src === 'velocity' && state.velocities.length >= count) {
      // DYE_SPEED_REF: the speed at which a particle deposits its colour at full strength. Fixed rather than
      // per-frame for the reason in this function's doc.
      const REF = 6.0;
      for (let i = 0; i < count; i++) {
        const s = Math.min(1, Math.abs(state.velocities[i]!) / REF);
        // 0.35 floor, so a momentarily stationary particle deposits a dim version of its colour rather than
        // nothing — a hard 0 would punch holes in the wake at every wave reversal point.
        const k = 0.35 + 0.65 * s;
        out[i * 3] = (state.colors[i * 3] ?? 1) * k;
        out[i * 3 + 1] = (state.colors[i * 3 + 1] ?? 1) * k;
        out[i * 3 + 2] = (state.colors[i * 3 + 2] ?? 1) * k;
      }
      return;
    }
    /*
     * The shared fallback for the state-reading sources: the figure's own per-particle colour, undimmed.
     *
     * ⚠️ **v8 28.15 (`28.D16`) — `colourSource: 'figure'` REACHES THIS BY FALLING THROUGH, AND THAT IS
     * INTENTIONAL RATHER THAN LUCKY.** It matches no branch above, so it lands here and costs no new code:
     * the owner asked for a control over a path that already existed. **The one failure mode of a
     * fall-through is a branch added ABOVE it that captures the value**, so `fieldcheck` asserts that
     * `'figure'` still arrives here. It also remains the DEGRADE for `temperature` with no temperatures
     * and `velocity` with no velocities — one owner, three reasons to reach it.
     */
    for (let i = 0; i < count; i++) {
      out[i * 3] = state.colors[i * 3] ?? 1;
      out[i * 3 + 1] = state.colors[i * 3 + 1] ?? 1;
      out[i * 3 + 2] = state.colors[i * 3 + 2] ?? 1;
    }
  }

  function computeFlameExpansion(): number {
    if (currentBuoyancy.enabled) return 1.5 + (currentBuoyancy.turbulence ?? 0) * 2.0;
    // `?? 0` still guards the `currentMaterial === null` case; `velocityStretch` itself is a required
    // `MaterialConfig` field, so no cast is needed to reach it (triage I2).
    const vs = currentMaterial?.velocityStretch ?? 0;
    return vs > 0 ? 1.0 : 0;
  }


  generator.setBuoyancyConfig(currentBuoyancy);
  renderer.setFlameExpansion(computeFlameExpansion());
  renderer.setSmokeParams(currentBuoyancy.enabled ? (currentBuoyancy.smokeThreshold ?? 0.25) : 0, currentBuoyancy.smokeOpacity ?? 0.4);
  applySparkConfig();
  renderer.setVolumeConfig(currentVolume);
  renderer.setLiquidConfig(currentLiquid);
  generator.setCohesionConfig(currentCohesion);
  /*
   * v8 Step 15.5 — the liquid field pool's INIT-TIME hand-off, and it belongs in this block for
   * invariant 23's reason rather than for symmetry with the line above it.
   *
   * `currentLiquidField` is seeded from `preset?.overlay?.liquidField` at its declaration, but the generator
   * holds the config by REFERENCE and is only handed it by `setLiquidFieldConfig`. Without this line a preset
   * that authors the block as the STARTUP default would reach the generator only on the next preset change —
   * i.e. a refresh would show a different picture from clicking the same preset, which is invariant 23's
   * reported symptom verbatim.
   *
   * ⚠️ **No `applyFluidFeedbackState()` here, and that is not an omission: it is a `const` arrow declared
   * ~200 lines BELOW this statement, so a call here is a TDZ throw at module init** — and a throw here does
   * not merely warn, it ends `init()` before the render loop is ever armed (invariant 22's shape one stage
   * earlier). The derive is reached instead through `applyOverlayConfigBlocks`, which the startup preset goes
   * through via `applyPresetChange` — the ONE apply path invariant 23 requires.
   */
  generator.setLiquidFieldConfig(currentLiquidField);
  /*
   * v8 Step 15.7 — the dye field's INIT-TIME hand-off, here for the same invariant-23 reason as the pool's
   * above: `currentDye` is seeded from `preset?.overlay?.dye` at its declaration, but the processor holds its
   * own copy and only `setConfig` gives it one. Without this line a preset authoring the block as the STARTUP
   * default would reach the processor only on the next preset change.
   *
   * ⚠️ **No `dyeProcessor.step()` or texture hand-off here — the frame loop owns both**, and calling them at
   * init would allocate the field before the first frame has decided whether it is needed (the lazy-allocation
   * rule this subsystem was rebuilt under; see `DyeFieldProcessor.init`).
   */
  dyeProcessor.setConfig(currentDye);
  renderer.setParticleSize(particleSizeScale);

  // TransMap live state (chain + enabled + ifsParams)
  let currentTransMapEnabled = preset?.postProcessors.transMap.enabled ?? false;
  /**
   * The live LAYER CHAIN — replaces the single `currentTransMapStyle` scalar this file used to carry.
   *
   * ⚠️ **One source of truth, deliberately.** Keeping a `currentTransMapStyle` alongside the chain would
   * put the same fact in two places at eleven sites (`applyFluidFeedbackState`, the fluid-texture handoff,
   * `reinitTransMap`, both overlay-apply paths, three UI setters, three `getSnapshot()` gates) — and the
   * comment on `transMapFractalFade()` already records what that shape costs here: an expression written
   * out at two sites let an index/blend divergence live at both. Every "is style N active" question now
   * goes through `chainHasStyle()`, and the legacy dropdown reads `primaryTransMapStyle()`.
   *
   * ⚠️ **`chainHasStyle` means CONTRIBUTING (enabled AND weight > 0), not merely present.** It must match
   * `buildChainPlan()`'s filter exactly, or a side effect outlives the pass it belongs to — which is how a
   * weight-0 style-6 layer kept overriding `trailDecay`. Where the question is instead "does the chain carry
   * a configuration for this style", the export gates use `chainHasLayerFor()`.
   *
   * Seeded through `chainFromOverlay()`, which for all 177 legacy presets and all 7 engine presets with a
   * live style yields the one-layer chain their single `style` describes. It must be derived the SAME way
   * `initTransMap` derives it a few lines earlier, or the live state and the GPU pass disagree from frame
   * one — the same class of divergence `reinitTransMap`'s header documents.
   */
  let currentTransMapChain: TransMapLayer[] = chainFromOverlay(
    preset?.overlay,
    preset?.postProcessors.transMap.style ?? 0,
    preset?.postProcessors.transMap.ifsParams,
  );
  let currentIfsParams = cloneIfsParams(preset?.postProcessors.transMap.ifsParams ?? defaultIfsParams());

  /** Is `style` present in the chain AND enabled — the only sanctioned form of the old `=== N` test. */
  const chainHasStyle = (style: number): boolean => isStyleActive(currentTransMapChain, style);

  /**
   * Which trail FBO this frame's particles are drawn into — v8 Step 14.6's whole mechanism.
   *
   * The frame is a permutation of three passes over ONE ping-pong pair, and only the particle target moves:
   * the decay pass always reads `texA` and writes `fboB`, and the warp always reads `texB` and writes `fboA`.
   * Warp-last draws the particles into `fboB` (so the warp then displaces them); warp-first draws them into
   * `fboA` **after** the warp has already run, so they land undisplaced on a warped history. No new
   * allocation, no extra pass — see `overlay.transMapBeforeParticles`.
   *
   * ⚠️ **Every site that binds the particle target goes through this, and the draw now binds EXPLICITLY.**
   * The target used to be inherited — *"FBO-B is still bound from step 1"* — which is exactly the assumption
   * a permutation breaks, and it would have broken SILENTLY: the particles would have gone on landing in
   * `fboB`, which the warp had already consumed, so they would be blitted to the screen one frame late and
   * unwarped rather than not at all. Four sites bind it (the draw head, the physarum overlay and the force
   * field's two restores after `renderFlowField`/`readback`); the two `clear` sites at startup and in
   * `resizeAll` clear BOTH buffers and are indifferent to the order.
   */
  const particleFbo = (): WebGLFramebuffer =>
    currentTransMapBeforeParticles ? fboState.fboA : fboState.fboB;

  /**
   * The warp pass — read `texB`, write `fboA` — as ONE callable, because Step 14.6 runs it at one of two
   * points in the frame and a second copy is how the two would drift.
   *
   * The chain fades proportionally to the attractor blend, PER LAYER: the processor exempts its style-6
   * layer, whose warp source is the attractor's own motion. See `transMapFractalFade()` and
   * `setFractalFade()`. The two used to be multiplied together into one `setMix()` argument here, which
   * cannot express a chain holding both an exempt and a faded layer.
   *
   * ⚠️ **The `else` branch is not optional and is not a tidiness blit.** With TransMap disabled `fboA` is
   * still what step 4 reads, so skipping the copy would leave it holding the PREVIOUS frame's content — the
   * trail would freeze rather than merely go unwarped. It is also what makes the two orders agree when the
   * warp is off: `beforeParticles` with no warp must be byte-identical to `beforeParticles` false, and it is,
   * because copy-then-draw-into-`fboA` and draw-into-`fboB`-then-copy produce the same pixels.
   *
   * Extracted verbatim from step 3; nothing here is order-dependent beyond reading `texB` and writing `fboA`,
   * which both orders preserve.
   *
   * ⚠️ **`state` is a PARAMETER, not a closure read, and that is not a style choice.** This function is declared
   * outside `drawFrameBody`, where `state` is a per-frame `const` — so the depth pass below could not reach it
   * otherwise, and hoisting `state` to a top-level `let` to make it visible would add a 51st frame-scoped
   * variable to the set that makes `main.ts` undecomposable (triage J4).
   */
  function runTransMapPass(state: GeneratorState, dtMs: number): void {
    const fade = transMapFractalFade();
    /*
     * v8 `32.8` (`E127`) — **the blur pyramid, handed in as the PREVIOUS frame's.**
     *
     * ⚠⚠ **IT CANNOT BE THIS FRAME'S AND THAT IS THE ARCHITECTURE, NOT A SHORTCUT.** `bloom.apply()`
     * runs LATER in this same function (stage 8) than `transMap.apply()` (stage 7), so at this point the
     * pyramid still holds the previous frame. MilkDrop's `GetBlur1/2/3` is the same: it is a feedback
     * system and so is this engine. One frame at 60 Hz is invisible except on a very fast figure, where
     * the refraction follows where the figure *was* — which the tooltip states, because otherwise it
     * reads as a bug on exactly the presets that show it most.
     *
     * ⚠ **RE-SET EVERY FRAME RATHER THAN CACHED**: the mips are reallocated on a canvas resize, so a held
     * handle would be stale. `null` while bloom is off is the normal case and the processor falls back to
     * `density` for it.
     */
    /*
     * ⚠⚠ **v8 `32.8` BOUND A BLOOM MIP HERE FOR THE BLUR REFRACTION SOURCES, AND `32.12` REMOVED IT
     * WITH THEM** (owner, 2026-10-26: *"not visible and therefore not adding value at all"*). Two real
     * defects were found and fixed before the cut and neither saved it: this line bound `'mid'`
     * UNCONDITIONALLY, so all three members read one texture and were byte-identical, and the sources
     * were separately under-driven by the pyramid's own geometry. **Correctness was never the binding
     * constraint — the fourth time this phase pair has shown that.**
     */
    if (chainHasStyle(6) && fluidProcessor.isActive()) {
      transMap.setFluidVelocityTexture(fluidProcessor.getVelocityTexture());
      transMap.setFluidFeedbackParams(currentFluidFeedback.amplify, currentFluidFeedback.glowBoost);
    }
    // ⚠️ **Step 14.7's depth source, and the ONE site that produces it — both 14.6 orders reach it through
    // here.** Two copies (one per order) is the drift `runTransMapPass` itself exists to prevent, and the
    // asymmetry would be invisible: under `beforeParticles` the missing one would leave depth holding the
    // PREVIOUS frame's geometry, which on a slow-moving figure looks entirely correct.
    //
    // ⚠️ The handover is unconditional in BOTH directions (invariant 3): `null` when the chain does not read
    // depth, so a style-11 layer deleted mid-session cannot leave the processor sampling a live-looking handle
    // it no longer has a reason to trust. `render()` costs one `state.count` point draw and is skipped entirely
    // when `needsDepth()` is false — 358 of 359 shipped presets, `Sphere II` being the one that pays it.
    if (transMap.needsDepth()) {
      // ⚠️ **`dt` is in MILLISECONDS here and the band smoothing is specified in SECONDS** (invariant 10 — the
      // units of the argument, not the plausibility of the name). Passing `dt` unconverted would make τ 250
      // frames instead of 0.25 s and the fit would never catch up with the figure at all.
      depthField.render(state, DEPTH_SPLAT_PX, dtMs * 0.001);
      transMap.setDepthTexture(depthField.getTexture());
      // ⚠️ **The band travels with the texture, from the one site that produces both** (Step 14.7b). It is the
      // figure's own p2..p98 depth extent, measured inside `render()` over the slots that actually splat, and it
      // is what `depthRange: 'figure'` remaps to 0..1 — the fix for a figure occupying a thin slice of a scale
      // that is normalised over the CANVAS. Setting it anywhere else would let it fall one frame out of step
      // with the geometry it describes, and consecutive bands differ by ~0.0002, so that would never be seen.
      const band = depthField.getBand();
      transMap.setDepthBand(band.lo, band.hi);
    } else {
      transMap.setDepthTexture(null);
    }
    transMap.setMix(currentTransMapWarpMix);
    // Outside the style-6 branch above, which is the entire point of the 2026-08-20 change: dispersion applies
    // to the summed chain offset, so a Wave Shift or Procedural Flow chain gets it too. Unconditional rather
    // than gated on `isEnabled()` for the same reason `setMix` is — the processor owns that test.
    transMap.setDispersion(currentTransMapDispersion);
    transMap.setFractalFade(fade);
    if (transMap.isEnabled()) {
      perfHud?.begin('warp');
      transMap.apply(fboState.texB, fboState.fboA, currentIfsParams, elapsedTime, currentProceduralFlow);
      perfHud?.end('warp');
    } else {
      // No TransMap — just copy B to A
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboState.fboA);
      gl.viewport(0, 0, fboState.width, fboState.height);
      gl.disable(gl.BLEND);
      gl.useProgram(blitProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fboState.texB);
      gl.uniform1i(uBlitTex, 0);
      gl.bindVertexArray(blitVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }
  }

  /**
   * Is a layer for `style` PRESENT, whatever its mute flag or weight — the export/serialisation predicate.
   *
   * A muted or weight-0 layer must keep its tuning: mute exists to A/B a layer without losing its settings,
   * so gating the `proceduralFlow` / `fluidFeedback` / `ifsParams` blocks on activity would drop the very
   * values the user is toggling, and re-importing that export would silently reset them to defaults.
   */
  const chainHasLayerFor = (style: number): boolean => hasLayerFor(currentTransMapChain, style);

  /**
   * The style the legacy `Style` dropdown and a legacy-expressible export show: the chain's FIRST layer.
   *
   * For a one-layer chain — every preset, and every session that never adds a layer — this is exactly the
   * old `currentTransMapStyle`. For a longer chain it is the first layer, which is what the collapsed
   * one-layer view in the Visual FX tab displays.
   */
  const primaryTransMapStyle = (): TransMapStyle =>
    currentTransMapChain[0]?.style ?? 0;
  let currentTransMapWarpMix = 1.0;
  /**
   * v8 Step 14.6 — run the warp BEFORE the particle draw. See `overlay.transMapBeforeParticles` for the
   * rendering consequence and how to grade it.
   *
   * ⚠️ **This is the ONE local the whole frame reads, and that is invariant 17's remedy applied up front.**
   * The flag has two sources — `overlay.transMapBeforeParticles` and the preset's own
   * `postProcessors.transMap.beforeParticles` — resolved overlay-first at both apply sites, exactly as
   * `currentTransMapEnabled` is. The four load-bearing `fboB` binds in `drawFrameBody` all go through
   * `particleFbo()` below rather than re-testing the pair, so no reader can resolve it in a different order.
   */
  let currentTransMapBeforeParticles = preset?.postProcessors.transMap.beforeParticles ?? false;
  /** Chain-level chromatic dispersion, 0..0.5. See `overlay.transMapDispersion`. */
  let currentTransMapDispersion = 0;
  let currentTransMapForceBlend = 0;
  let currentTransMapForceReturn = 1.5;
  let currentTransMapForceSparks = false;
  /** v8 Step 14.4 — particle-attribute force gate. See `overlay.transMapForceGateBy`. */
  let currentForceGateBy: ForceGateSource = 'none';
  let currentForceGateAmount = 0;
  let currentForceGateInvert = false;
  let currentForceGateHalfLife = 2.0;
  /**
   * Push the four gate scalars into the force field. Called from the frame loop rather than from each
   * setter, for the same reason `setAnalyticSampler` is: `prepareGate()` has to run every frame anyway
   * (it reads live per-particle state), so a separate assign-on-entry site would be a second place that
   * can disagree — the shape that let style 6's overrides leak.
   */
  const applyForceGateState = (): void => {
    transMapForce.setGate(
      currentForceGateBy, currentForceGateAmount, currentForceGateInvert, currentForceGateHalfLife,
    );
  };
  let currentProceduralFlow: ProceduralFlowConfig = cloneFlowConfig(DEFAULT_PROCEDURAL_FLOW);
  const DEFAULT_FLUID_FEEDBACK: FluidFeedbackConfig = { persist: 0.96, amplify: 1.0, dispersion: 0.0, fieldDecay: 0.985, glowBoost: 0.0 };
  const currentFluidFeedback: FluidFeedbackConfig = { ...DEFAULT_FLUID_FEEDBACK };

  /**
   * Re-derive the three pieces of state that TransMap style 6 (Fluid Feedback) OVERRIDES.
   *
   * ## Why this is one function instead of six inline assignments
   *
   * Style 6 does not only change how the warp is drawn — it also hijacks `trailDecay` (its `persist`
   * parameter replaces the preset's `decayFactor`) and switches the 512² fluid velocity simulation on
   * via `setForceFieldActive`, because the warp source IS that velocity field. Those two side effects
   * were written inline at six sites, every one of them keyed on `currentTransMapStyle === 6` ALONE:
   * `applyPresetChange` ×2, the overlay-apply path ×2, `setTransMapStyle`, `setFluidFeedback` and
   * `resetOverlays` ×2.
   *
   * ⚠️ **The style is only half of the condition.** A style selection means nothing while the
   * TransMap checkbox is off: the warp itself is correctly gated (`transMap.isEnabled()` before
   * `transMap.apply`, and `currentTransMapEnabled` before the force field), so the *picture* was right
   * — but `trailDecay` feeds the per-frame fade pass unconditionally, so touching the Style dropdown
   * with TransMap DISABLED visibly changed the animation's trail length. Reported 2026-08-12 as "when
   * selecting a transmap dropdown the animation changes even though transmap is disabled".
   *
   * ⚠️ **And every site only ever set the override, never restored it.** `setFieldDecay` had no
   * `else` branch anywhere in the file, so leaving style 6 left the velocity field permanently on the
   * preset's `fieldDecay` instead of the processor's own 0.985 default; and `setTransMapEnabled`
   * touched neither field, so toggling the checkbox could not repair the leak either. Deriving BOTH
   * directions from the two flags — rather than assigning on entry and hoping for a matching exit —
   * is what makes the state impossible to leak: any caller that changes either flag calls this, and
   * the result depends only on the flags, not on the order they were reached in.
   */
  /**
   * # The accumulation ceiling an ADDITIVE material's trail may reach — v8, 2026-09-04
   *
   * ⚠️ **THIS IS THE ONE NUMBER, AND IT IS A MEASURED BAND'S UPPER EDGE, NOT A TASTE SETTING.** Under
   * `blendMode: 'additive'` the splat pass blends `ONE, ONE` while the fade pass multiplies the trail by
   * `trailDecay`, so a repeatedly-revisited pixel converges to `increment / (1 - trailDecay)`. The quantity
   * that decides whether that steady state is usable is
   *
   *     accumulation index = material.emissionIntensity / (1 - trailDecay)
   *
   * and the four browser-CONFIRMED additive demos (`Material Fire` 16.7, `Material Plasma` 21.0,
   * `Material Ember` 22.7, `Material Liquid Light` 25.0 — the 2026-08-21 review set, closed 2026-08-23)
   * bracket the accepted range. **25.0 is the largest index a user has signed off on.**
   *
   * ## Why a cap is needed at all: `decayFactor` CHANGES MEANING with `blendMode`
   *
   * Legacy `MotionBlur 8` migrates to `decayFactor = 8 / 8.1 = 0.9876543` (`presets/migration.ts:198`), and
   * **70 presets carry exactly that value**. On the alpha-blended star path it is free — a pixel self-limits
   * at 1. Applying an additive material to one of them makes the same field mean a **81x** trail gain. Same
   * `number`, different meaning: invariant 10's units error wearing a preset field's clothes. Measured over
   * the **136** material-free presets, the index maxes out at **170.1** (Plasma), **145.8** (Fire),
   * **121.5** (Liquid Light), **275.4** (Ember) — 5-11x outside the confirmed band, with **58, 58, 57 and
   * 69** presets respectively past 25.0.
   *
   * ## What the failure actually IS — and the metric that misled the first reading
   *
   * ⚠️ **"THE PIXEL IS CLIPPED" CANNOT DISCRIMINATE, BECAUSE ALL FOUR ACCEPTED DEMOS CLIP TOO** (core HDR
   * 39.8 / 30.1 / 64.0 / 27.3 against `acesToneMap`'s 99 % pin at x = 6.42). A splat core is MEANT to clip.
   * The first population count taken for this report — *"76-79 % of presets are past the pin"* — measured
   * that non-discriminating property and had to be withdrawn. **Calibrate a brightness metric against the
   * configurations that were ACCEPTED before quoting a population.** What goes wrong past the band is that
   * ACES output above x = 6.42 is *independent of its input*, so every such pixel grades to the same ceiling
   * colour from the `gain` vector: the defect is a **loss of variation**, not excess luminance. That is
   * precisely why the user's report says the two obvious sliders do not help.
   *
   * ⚠️ **THE 6.42 ABOVE IS THE CURVE THIS READING WAS TAKEN AGAINST AND IS NO LONGER THE LIVE PIN —
   * re-deriving it and getting a different number is the instrument moving, not a regression.** 27.1
   * replaced the single-rational fit, and `ACES_EXPOSURE_BIAS` (2026-10-21) restored the stop that swap
   * dropped; measured, the 99 % pin is **8.02** today (it was 16.04 between 27.1 and that constant). The
   * figure is left as written because it records what was measured then, and **the argument is unchanged at
   * either value**: all four accepted cores (39.8 / 30.1 / 64.0 / 27.3) still sit well past the pin, which
   * is the whole of why clipping cannot discriminate. **Do not restate this paragraph's numbers against a
   * new curve — re-measure and say which curve.**
   *
   * ## Why ONE derived constant and not a four-material table
   *
   * The four confirmed decays (0.90 / 0.88 / 0.85 / 0.94) look like four independent facts. They are four
   * solutions of one equation, so the cap is **solved for, never tabulated**:
   *
   *     cap = 1 - emissionIntensity / MAX_MATERIAL_ACCUM_INDEX
   *
   * ⚠️ **A TABLE WOULD HAVE SHIPPED WRONG ON THE FIRST ENTRY I CHECKED.** Hard-coding *"Fire = 0.88"* from
   * its demo's `decayFactor` ignores that the same demo overrides `emissionIntensity` 1.8 -> 2, so Fire's
   * correct cap is **0.92**. A table encodes a SOLUTION and goes stale the moment a bundle field moves; the
   * derive re-solves. It also **tracks the user's own `emissionIntensity` slider**, which is the one lever
   * they actually have — a table cannot.
   *
   * Verified properties, all measured over the library before this shipped:
   *
   *   * **All four confirmed demos are UNTOUCHED** — authored 0.90/0.88/0.85/0.94 against derived caps
   *     0.9160/0.9200/0.8640/0.9400, and `Math.min` only ever lowers. Not one accepted look moves.
   *   * **Index max collapses to exactly 25.0** across all 136 material-free presets, for every additive
   *     material. 0 remain over.
   *   * ⚠️ **0 presets get DARKER on a once-hit pixel**, which is the whole reason this lever and not the
   *     algebraically-equivalent ones. Lowering `emissionIntensity` scales a single-visit pixel as hard as
   *     an accumulated one; the measured attempt at that shape on `exposure` darkened **19** presets. Only
   *     the accumulation term is touched here.
   *
   * ## Rejected alternatives — each already falsified, do not re-propose
   *
   *   * **Lower `emissionIntensity`** — algebraically identical, but its slider is `min 0.5, step 0.1` and
   *     the solve wants 0.309: UNREACHABLE, so invariant 13. Rejected twice before this.
   *   * **Lower `exposure`** — the 19-preset darkening above.
   *   * **Raise `bloomThreshold` / lower `glow`** — both exonerated in the 2026-08-23 post-mortem: bloom
   *     runs BEFORE exposure so exposure can never reach it, and `glow` is inverted in the shader and is a
   *     shape control.
   *   * ⚠️ **Reuse `MAX_TILE_DECAY = 0.96`** (`ui/preview-grid/grid-tile-renderer.ts:979`) — that constant
   *     is the live PRECEDENT for this fix, same problem and same shape, and it is **why a preview tile
   *     looks correct while the main view whites out.** But it is too LOOSE to reuse: 0.96 still leaves the
   *     index at 52.5 / 45.0 / 37.5 / 85.0, every one outside the confirmed band. It works for tiles
   *     because a 256x192 tile has far less overlap, not because 0.96 is the right ceiling.
   *
   * ⚠️ **ALPHA MATERIALS ARE EXEMPT AND THE EXEMPTION IS THE POINT** — an alpha-composited pixel is bounded
   * by construction, so there is no accumulation to cap and clamping one would shorten trails for no reason.
   * `blendMode` is the whole test. Four of the nine materials are additive (Plasma, Fire, Ember, Liquid
   * Light, Liquid — five, counting `Liquid`, which shares Liquid Light's numbers).
   */
  const MAX_MATERIAL_ACCUM_INDEX = 25.0;
  /**
   * Solve the ceiling for the live material. `null` — no cap — for no material and for every alpha material.
   *
   * ⚠️ **Reads `currentMaterial`, so it is a DERIVE and not a stored value** (this function's own reason for
   * existing). ⚠️ **The `emissionIntensity <= 0` guard is not defensive noise:** at 0 the solve gives
   * `cap = 1`, which is a `Math.min` that can never bite — correct, but only by accident, and a negative
   * value would produce a cap above 1 and read as *"the clamp is off at some settings"*.
   */
  const materialTrailDecayCap = (): number | null => {
    const m = currentMaterial;
    if (!m || m.preset === 'None' || m.blendMode !== 'additive') return null;
    if (!(m.emissionIntensity > 0)) return null;
    return 1 - m.emissionIntensity / MAX_MATERIAL_ACCUM_INDEX;
  };

  const applyFluidFeedbackState = (): void => {
    // ⚠️ `chainHasStyle(6)`, not `=== 6`: a chain can carry style 6 alongside other layers, and a MUTED
    // style-6 layer must give `trailDecay` and the velocity field back exactly as removing it would.
    // `isStyleActive()` tests `enabled` AND `weight > 0`, so mute and weight-0 are both covered by
    // construction — and they MUST be: this is the reported bug. With a predicate that ignored weight,
    // dragging a style-6 layer to 0 removed its warp (the plan excluded it) while leaving `trailDecay`
    // pinned to `persist` and the 512² velocity sim running, so the effect never fully went away.
    const active = currentTransMapEnabled && chainHasStyle(6);
    trailDecay = active ? currentFluidFeedback.persist : (preset?.renderer.decayFactor ?? 0.86);
    /*
     * The additive-material accumulation ceiling, applied to BOTH arms above — see
     * `MAX_MATERIAL_ACCUM_INDEX`'s block for the band it comes from and the four alternatives it replaced.
     *
     * ⚠️ **DERIVED HERE, and this function's header is the reason.** Every earlier owner of a `trailDecay`
     * override assigned it on entry and restored it nowhere, which is how style 6 leaked a trail length into
     * presets that had never selected it. A cap assigned at `setMaterialConfig` would have exactly that
     * shape — worse, because clearing a material would leave the library's 70 `0.9876543` presets pinned at
     * a shortened trail with no control naming the cause. Depending only on the flags means the state cannot
     * leak whichever order the material and the TransMap chain were touched in.
     *
     * ⚠️ **STYLE 6'S `persist` IS CAPPED TOO, DELIBERATELY.** Its default is 0.96 and its slider reaches
     * higher, so exempting it would leave the one path that can still reach a 100x+ index — and style 6 with
     * a material is a reachable combination. This is the one place a style-6 look can move, and it moves
     * only where the index was already past every confirmed demo.
     *
     * ⚠️ **`Math.min`, so this can only ever SHORTEN a trail, never lengthen one.** A cap above the live
     * value must be a no-op: that is what keeps all four confirmed demos byte-identical (their authored
     * decays sit below their own derived caps) and what makes this idempotent along with the rest of the
     * function.
     */
    const decayCap = materialTrailDecayCap();
    if (decayCap !== null) trailDecay = Math.min(trailDecay, decayCap);
    fluidProcessor.setForceFieldActive(active);

    /*
     * v8 Step 15.5 — the liquid pool is a THIRD reason the velocity field must run, joining
     * `config.blend > 0` and style 6's force field. `isActive()` ORs all three, so the pool gets a live
     * field with no TransMap layer and no advection blend at all.
     *
     * ⚠️ **DERIVED HERE rather than assigned at the pool's own setter, which is this function's whole
     * reason for existing** (see its header: every earlier site set an override and none restored it).
     * `setPoolActive` has exactly one caller — this line — so the field cannot be left running by a pool
     * that has since been switched off, whichever order the two flags were touched in.
     *
     * ⚠️ **`enabled` alone, NOT `poolSize > 0` as well.** The generator's gate tests both, so a
     * zero-size pool publishes nothing — but a field that is allocated and stepping is exactly what a
     * `Pool Size` drag from 0 needs to find already warmed. Gating on the size would restart the
     * simulation from a dead field at the first stop of every drag, which reads as the pool being
     * inert at low sizes.
     */
    const poolOn = currentLiquidField.enabled;
    fluidProcessor.setPoolActive(poolOn);

    /*
     * v8 Step 15.7 — the dye field is a FOURTH reason the velocity field must run, and it is derived here
     * for the same reason the pool is: this function is the single owner, so the field cannot be left
     * running by a dye that has since been switched off, in whichever order the flags were touched.
     *
     * ⚠️ **REPORTED BY THE USER 2026-09-03: with `Dye Field` on and `Liquid Field` OFF, `Advection` was
     * inert at every value.** Nothing else about the dye was wrong — it deposited, decayed, tinted and
     * drew its wake. `dyeProcessor.step()` advects along `fluidProcessor.getVelocityTexture()`, and with
     * none of the other three sources asserted that texture is ALLOCATED BUT NEVER STEPPED, so the dye
     * honestly smeared along a field of zeros. **Invariant 13 arriving through a gate one stage UPSTREAM
     * of the feature — 15.7's fifth cause of reading inert, and the fifth to sit in a file the dye does
     * not own.** See `fluid-advection.ts`'s `dyeActive` for why no existing flag could express it.
     *
     * ⚠️ **`enabled` alone, NOT `dyeProcessor.isActive()` (which also tests `opacity > 0`)** — the pool's
     * rule verbatim, and for its reason: a field that is already stepping is what an `Opacity` drag from 0
     * needs to find warmed, where gating on the amount would restart it from a dead field at every stop
     * of the drag and read as the dye being inert at low opacity.
     */
    fluidProcessor.setDyeActive(currentDye.enabled);

    /*
     * ⚠️ **`fieldDecay` NOW HAS TWO SOURCES AND THE PRECEDENCE IS STATED HERE, ONCE (invariant 17).**
     * Style 6's `currentFluidFeedback.fieldDecay` WINS over the pool's own `Field Decay`. It is the
     * narrower claim: style 6 is a warp whose whole appearance is the field's persistence, so a pool
     * silently overriding it would change a shipped TransMap preset's look. The pool's control then
     * applies exactly when style 6 is not asserting one — which is every preset that has a pool and no
     * fluid-feedback layer, i.e. all of them today.
     *
     * The third arm is the processor's own default, restoring the pre-15.5 behaviour when neither owner
     * is live. All three arms are evaluated from the flags, never assigned on entry.
     */
    fluidProcessor.setFieldDecay(
      active ? currentFluidFeedback.fieldDecay
        : poolOn ? currentLiquidField.fieldDecay
          : DEFAULT_FLUID_FEEDBACK.fieldDecay,
    );

    /*
     * The pool's velocity SOURCE, handed over as a closure on the same derived flag.
     *
     * ⚠️ **`null` when the pool is off, and that is invariant 3's shape rather than an optimisation.** A
     * latched sampler would keep reading a processor whose textures `dispose()` has deleted; handing the
     * generator `null` makes the pool stand still, which is the one behaviour a torn-down field can
     * honestly produce. The generator re-reads this every frame from the setter rather than caching a
     * bound method, so a `reinitFluid` cannot leave a stale reference behind.
     *
     * ⚠️ The sampler reads the PREVIOUS frame's field (this runs before `step()` in the draw order), and
     * that is deliberate — a one-frame-old velocity is invisible at 60 Hz, while sampling after the step
     * would put the pool's read inside the same frame's write and make the order load-bearing.
     */
    generator.setLiquidFieldSample(
      poolOn ? (u, v, channel) => fluidProcessor.sampleVelocity(u, v, channel) : null,
    );
  };

  console.log(`PSSS Engine initialized (${backend.type}) — Preset: "${presetName}" — ${preset?.generators.particleCount ?? 0} particles`);

  // Animation loop
  let lastTime = 0;
  // D16: reset by `applyPresetChange` (see `resetElapsedTime`).
  //
  // This accumulated monotonically for the whole session and is scaled by `speedFactor`, so a preset's
  // procedural-flow and TransMap appearance depended on how long the app had been open and what speed every
  // PREVIOUS preset ran at — the same preset never looked the same twice across sessions. After a few hours
  // the float also loses meaningful precision. `resetCurlTime()` already existed for exactly this concern on
  // the curl-noise side; this is the same fix for the flow/TransMap side.
  let elapsedTime = 0;
  let currentPresetIndex = presetNames.indexOf(presetName);
  const target: GPUTarget = { width: canvas.width, height: canvas.height, handle: null };
  let evoTileRenderer: GridTileRenderer;
  let perfGuard: PerfGuard;
  /** v8 performance pass — the `?perf=1` overlay, or null (the default: it costs nothing when off). */
  let perfHud: PerfHud | null = null;
  /** `?reel=2` — the performance test reel's recorder (`ui/perf-run.ts`); null otherwise. */
  let perfRun: PerfRun | null = null;

  /**
   * How much of the TransMap effect survives the active attractor blend — `1.0` = full, `0.0` = off.
   *
   * Inherited from legacy `psss.js:3734` (`transMapFade = 1.0 - gFractalBlend`) and deliberate: TransMap
   * warps the accumulated TRAIL BUFFER, so at blend 1.0 there is no wave figure left to warp — the
   * particles are following the attractor's own field, and warping the image on top of it fights the
   * structure rather than adding to it. Scales the particle coupling (the Force Field's `fractalFade`
   * argument) and the pixel warp alike.
   *
   * ⚠️ **The style-6 exemption is no longer applied here — it moved into the processor** (`setFractalFade`
   * + `layerWeights()`), and the `scope` argument went with it. A chain can hold style 5 AND style 6 at
   * once, needing 5 faded and 6 exempt in the SAME frame, which a single per-call scalar cannot express;
   * only the processor knows which layers are live. The exemption itself is unchanged: Fluid Feedback's
   * displacement is seeded from `state.positions` — the attractor's OWN motion at blend 1.0 — so it is
   * the one style whose warp source is the thing being warped.
   *
   * ⚠️ **The force path never exempted anything and still does not**: an escape-time particle steps
   * ~**0.54 px/frame** while `applyIfsForces` clamps at **8 px/frame**, so a force field here pushes ~15×
   * harder than the field it is meant to follow and tears the particle off its iso-contour. That is why
   * this returns the raw fade and both consumers now use the same value — the warp's per-layer exemption
   * is applied downstream, so there is no longer a wrong argument to pass.
   *
   * ⚠️ **Asks the GENERATOR, not this file's `currentAttractorIndex >= 0`.** Both call sites used to test
   * the index, which silently exempted the whole `preset.fractal` path: `applyPresetChange` sets
   * `currentAttractorIndex = -1` for a `fractal:` block while setting `currentBlend` from it
   * (`main.ts:1305`), so a preset-declared attractor got the FULL warp where the identical blend picked
   * from the Visual FX dropdown got `1 - blend`. `Julia Burn Rivers` (blend 0.6) is the one preset in
   * that state; its own `postProcessors.transMap` is disabled, which is why nothing showed it.
   *
   * ⚠️ **`currentBlend > 0` is NOT a valid substitute, and trying it first is how this was found.** Both
   * overlay-apply paths assign `currentBlend = ov?.attractorBlend ?? DEFAULT_ATTRACTOR_BLEND` — 0.6 —
   * **before** testing the index (`main.ts:1418`, `main.ts:1959`), so with no attractor selected
   * `currentBlend` is 0.6, not 0, and keying off it would fade TransMap to 40 % on a plain preset that
   * has no attractor at all. Only `LissajousGenerator` knows whether one is live, because only it holds
   * the `attractorState`/`attractorParams` pair that `update()` itself gates on.
   *
   * ⚠️ **Derived in ONE place on purpose.** The expression was written out at two sites — the pixel warp
   * and the Force Field — which is exactly the shape that let the index/blend divergence live at both.
   * Add a third consumer by calling this, not by re-deriving it.
   */
  function transMapFractalFade(): number {
    const blend = generator.getEffectiveAttractorBlend();
    if (blend <= 0) return 1.0;
    return Math.max(0, 1.0 - blend);
  }

  /**
   * The render loop's re-arm wrapper. **`drawFrame` is the only thing that schedules the next frame**, so
   * this is what keeps a single bad frame from being terminal.
   *
   * ⚠️ **Before this existed, `requestAnimationFrame(drawFrame)` was the LAST STATEMENT of `drawFrame` and
   * was not inside a `finally`** (the only other rAF in the file is the initial kick in `init()`). So ANY
   * exception thrown anywhere in the ~520 lines of the frame body stopped the loop permanently — the canvas
   * froze on its last painted frame and no control, preset change or tab switch could restart it. That is
   * the structural half of the 2026-08-21 report "the preview turns black and doesn't recover any more":
   * whatever throws, the *unrecoverability* is this, not the thrower.
   *
   * The catch logs ONCE per distinct message rather than every frame. A throwing frame body at 60 fps would
   * otherwise emit 60 identical console lines a second, which buries the first occurrence — and the first
   * occurrence is the only one with a useful stack. Re-arming regardless is deliberate: a transient fault
   * (one frame's bad state, a lost-then-restored resource) then self-heals, and a permanent one still
   * reports itself instead of presenting as a dead canvas with an empty console.
   *
   * ⚠️ This does NOT make an exception harmless — GL state set before the throw is left as-is, so a frame
   * that dies mid-chain can leave a stray binding for the next one. It converts a permanent failure into a
   * visible, diagnosable one; it is not a licence to leave the underlying throw unfixed.
   */
  let lastFrameErrorMessage: string | null = null;
  function drawFrame(time: number) {
    try {
      drawFrameBody(time);
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (msg !== lastFrameErrorMessage) {
        lastFrameErrorMessage = msg;
        console.error('drawFrame threw — the loop will re-arm; this is logged once per distinct error:', err);
      }
    } finally {
      if (glDiagEnabled) {
        reportGlErrors();
        // After the error drain, so a readPixels failure cannot be mistaken for a frame error.
        try { probeTrail(time); } catch { /* the probe must never be able to break the frame */ }
      }
      requestAnimationFrame(drawFrame);
    }
  }

  /**
   * Per-frame `gl.getError()` drain, opt-in via `?gldiag=1`.
   *
   * ⚠️ **Until this existed there was NO `gl.getError()` call anywhere in `src/`** — grep-confirmed, 0 sites
   * across 68 files. That is not a cosmetic gap. **ANGLE (the D3D11 translator every Windows Chromium build
   * uses) responds to an invalid draw by DROPPING IT and setting an error code, not by throwing**: no
   * exception, no console line, no visible signal at all beyond the missing pixels. This project has already
   * lost a sitting to exactly that — a vertex buffer one array shorter than its instanced draw count
   * (`state.lifetimes`, invariant 6) turned the whole preview black with a completely clean console, and it
   * was found by reading rather than by any diagnostic.
   *
   * So a black frame with no console output was, until now, INDISTINGUISHABLE from a black frame that is
   * genuinely being drawn black. That ambiguity is the whole reason this exists: it splits one report into two
   * different bugs. It is what the 2026-08-22 report needs, where the loop is provably alive (rAF is in a
   * `finally`, nothing throws, `PerfGuard` keeps sampling and reports fps RECOVERING to 115.6) and the frame
   * is nevertheless black.
   *
   * **Off by default, and deliberately not a debug build flag.** `getError()` forces a pipeline flush and
   * synchronises CPU with GPU, which is exactly the cost the rest of this file is written to avoid — it cannot
   * be always-on. A URL parameter (rather than a rebuild) is the point: the bug reproduces in a browser
   * session on a specific preset, so the diagnostic has to be reachable without leaving that session.
   *
   * Logs each distinct code ONCE. The error queue is drained in a loop because GL keeps up to one code per
   * category and `getError()` pops one at a time — reading a single code can leave others queued, and a
   * stale queue makes the NEXT frame's report a lie.
   */
  const GL_ERROR_NAMES: Record<number, string> = {
    0x0500: 'INVALID_ENUM',
    0x0501: 'INVALID_VALUE',
    0x0502: 'INVALID_OPERATION',
    0x0505: 'OUT_OF_MEMORY',
    0x0506: 'INVALID_FRAMEBUFFER_OPERATION',
    0x9242: 'CONTEXT_LOST_WEBGL',
  };
  const reportedGlErrors = new Set<number>();
  function reportGlErrors(): void {
    for (let guard = 0; guard < 32; guard++) {
      const code = gl.getError();
      if (code === gl.NO_ERROR) return;
      if (reportedGlErrors.has(code)) continue;
      reportedGlErrors.add(code);
      const name = GL_ERROR_NAMES[code] ?? `0x${code.toString(16)}`;
      console.error(
        `[GLDIAG] gl.getError() = ${name} (${code}). ⚠️ ANGLE DROPS the offending draw silently, so this is `
        + 'very likely the cause of a black or partially missing frame. Logged once per distinct code; '
        + 'reproduce with the diagnostic on from a clean reload to see the FIRST code rather than a later one.',
      );
    }
    console.error('[GLDIAG] gl.getError() still returning errors after 32 drains — giving up this frame.');
  }

  /**
   * `?gldiag=1`'s trail diagnostic: sample every stage that carries the trail, classify each, and emit ONE
   * structured record when something first goes wrong.
   *
   * ⚠️ **A black frame has at least SIX distinct causes and they are indistinguishable on screen.** Reading the
   * code cannot separate them, because each produces the same pixels and (per `reportGlErrors`) the same empty
   * console. Only a per-stage measurement can:
   *
   * | what the record shows | what it means |
   * |---|---|
   * | `nan` / `inf` > 0 | a non-finite texel reached that stage. The stage it FIRST appears in names the producer. |
   * | `trip` > 0 | `sanitiseTrail()` fired: the value was non-finite and the guard released it. **The guard is working and the producer is still upstream** — the trip count is the only evidence containment is masking a live fault. |
   * | all-zero, `maxLum 0` | nothing was DRAWN into it. Either the draw was dropped (read the `glErrors` field) or every fragment discarded. |
   * | `maxAbs` climbing frame over frame | an unbounded runaway. **This is the one shape the pre-2026-08-23 probe could not see at all** — see `ring` below. |
   * | `maxLum` huge but finite | the trail is fine and the fault is DOWNSTREAM. ⚠️ `acesToneMap` is a rational function: at Inf it is Inf/Inf = **NaN**, and it sits on the SCREEN path, outside anything the decay-blit sanitiser reaches. |
   * | `maxLum` ordinary at every stage | not a trail problem; look at the blit target, the viewport, a binding. |
   *
   * ⚠️ **Six stages, in write order, because a probe that reads only the ENDPOINTS cannot localise a producer
   * BETWEEN them (invariant 21).** This read `texA` alone until 2026-08-22 and `texB`+`texA` until 2026-08-23;
   * the pair returned `nan=4096` at both ends for 14 consecutive probes, which was decisive that the trail was
   * poisoned and silent on by what — every stage between them was unmeasured. The stages:
   *
   * | # | stage | what a first appearance HERE means |
   * |---|---|---|
   * | 1 | `texB` | post-decay-blit AND post-particle-draw. The blit output was sanitised, so a fault here is the PARTICLE DRAW or the CPU state feeding it. |
   * | 2 | `bandB` | style 9's half-res blurred base. It SUMS taps of the raw trail, so it reaches a higher magnitude than anything upstream — the first place a half-float overflow shows on a Band Split chain. |
   * | 3 | `scratch` | the two-pass chain's intermediate (echo→warp or warp→echo). Isolates one chain pass from the other. |
   * | 4 | `texA` | post-TransMap, the chain's output. A fault appearing first here is the warp or echo pass itself. |
   * | 5 | `post` | bloom's output. Bloom's bright-pass MULTIPLIES, so a large-but-finite `texA` can overflow here. |
   * | 6 | `screen` | after the tone map. A fault first appearing here is the GRADING — `acesToneMap` above. |
   *
   * A stage absent from the current chain reports `absent`, never a clean reading: an unscanned stage is not a
   * clean one, and reporting two of eight arrays as "cpu clean" is precisely how the 2026-08-22 pass went wrong.
   *
   * ⚠️ **A frame-wide count is only WEAK evidence of a bad uniform, and treating it as strong evidence cost a
   * sitting.** The reasoning was: a bad particle poisons the texels it covers, a bad scalar poisons all of them,
   * so `nan == total` means a uniform. The missing premise is COVERAGE — the crop is 64×64 at the CENTRE of the
   * figure and a few thousand overlapping splats cover it completely, so one bad particle attribute in a dense
   * draw produces `nan == total` too. It discriminates only against the crop's own healthy `lit` counts, which
   * is why `ring` keeps the pre-onset frames: compare against those, not against intuition.
   *
   * ⚠️ **Every scan measures MAGNITUDE, not just finiteness, and that gap is why two sittings failed.** The old
   * scan tested `Number.isFinite` and nothing else. All these buffers are RGBA16F, whose max finite magnitude
   * is 65504 — so an integrated CPU value ramping toward 1e5 is *perfectly finite on the CPU* and reports `cpu
   * none`, while overflowing to Inf the instant it is drawn. That is the one shape consistent with every reading
   * so far (`cpu none (arrays 7/8)` beside `texB nan=4096`), and a boolean probe is structurally unable to see
   * it. `maxAbs` in the ring buffer makes a ramp visible BEFORE onset, which is the only way to tell a cause
   * from its symptom.
   *
   * Cost: the per-frame path is a CPU-only scan of arrays already in memory (no `readPixels`, no GL sync). The
   * six-stage read runs at 1 Hz while healthy and per-frame only AFTER the trigger, so the expensive part
   * cannot perturb the timing of the run-up it is trying to observe. A full-canvas read is ~31 MB and stalls
   * hard (see `trans-map-force.ts`); a 64×64 crop classifies just as well, since none of the six failures above
   * is localised to a corner.
   */
  const GLDIAG_CROP = 64;
  /** Frames of dense six-stage sampling after the trigger, then the record is emitted and the probe goes quiet. */
  const GLDIAG_CAPTURE_FRAMES = 30;
  /** Pre-onset history. 64 entries at ~10-frame spacing covers ~10 s at 60 fps — enough to show a ramp. */
  const GLDIAG_RING = 64;
  const GLDIAG_RING_STRIDE = 10;
  /**
   * A CPU magnitude above this is treated as an anomaly — for the BOUNDED arrays only.
   *
   * ⚠️ **`positions` is deliberately excluded, and the 2026-08-23 capture run is why.** The threshold was
   * originally applied to the aggregate maximum over every array, justified against the half-float ceiling
   * (65504) on the reasoning that a value this large is one doubling from overflowing the texture it is drawn
   * into. That is an invariant-10 units error: it is true of `colors` and `temperatures`, which ARE texel
   * values, and false of `positions`, which are SCREEN PIXELS fed to a vertex shader and never sampled as a
   * texel. Worse, `positions` is the one array with no legitimate bound at all — `proj = perspZ / q` at
   * `lissajous.ts:952` diverges as `q -> 0+`, so a particle grazing the camera plane projects to 1e7 px
   * perfectly correctly and is simply drawn off-screen. The capture consequently triggered on `positions=1.2e5`
   * on the STARTUP preset with no material, burned its one-shot on a non-defect, and never reached the
   * configuration under investigation.
   *
   * Every remaining array is bounded by construction, so one threshold covers them all with room to spare:
   * `colors` clamps to 0..1 (`lissajous.ts:975`), `depths` and `velocities` to 0..1, `velocityDirs` is
   * normalised, and `temperatures` converges to `heatGain` (<= 1) since M4 made the steady state equal the
   * driver. Anything here above 1e3 is therefore already far outside its design range.
   *
   * `positions` is still measured — see `GLDIAG_OFFSCREEN_LIMIT`, which asks the question that actually
   * matters about a coordinate.
   */
  const GLDIAG_MAG_LIMIT = 1e3;
  /**
   * The `positions` test, replacing the magnitude one: the fraction of particles projecting OUTSIDE the canvas.
   *
   * A coordinate's magnitude is not a defect; a coordinate that is not on screen is the only thing about it the
   * frame can see. This measures the difference directly, and it is what distinguishes the two black-frame
   * causes that every previous probe conflated: a trail decaying with nothing drawn into it (population
   * off-screen -> this fires) from a lit trail the grading ate (population on-screen -> the `darkScreen`
   * trigger fires instead).
   *
   * 0.98 rather than 1.0 because several presets legitimately park a minority of particles off-screen every
   * frame via `CULL_SENTINEL`, and a figure larger than the viewport is a design choice, not a fault.
   */
  const GLDIAG_OFFSCREEN_LIMIT = 0.98;
  let glDiagLastProbe = 0;
  let glDiagBuf: Float32Array | null = null;
  /**
   * The 8-bit read buffer, for the SCREEN stage only — and it is a separate buffer because the default
   * framebuffer is a different FORMAT, not merely a different size.
   *
   * ⚠️ `readPixels(..., gl.RGBA, gl.FLOAT, ...)` against the default framebuffer is an **INVALID_OPERATION**:
   * the drawing buffer is RGBA8 unorm, and only the five off-screen stages are RGBA16F. Reading it as float
   * would have set an error code, returned nothing usable, and — since `reportGlErrors` runs BEFORE the probe
   * in `drawFrame`'s `finally` — surfaced one frame late, attributed to the render rather than to the probe.
   */
  let glDiagBuf8: Uint8Array | null = null;

  /**
   * Pre-onset history: the cheap CPU sample, kept in PREALLOCATED parallel arrays.
   *
   * ⚠️ Parallel typed arrays rather than an array of record objects, because this is written on every frame
   * the diagnostic is on and invariant 8 is about the allocation RATE, not its cost — 58 MB/s reached a user
   * as "a jitter every few seconds", i.e. a GC pause, and a probe that induces a GC pause while measuring a
   * timing-dependent failure is measuring itself. The record objects are built ONCE, at emit time.
   */
  const glDiagRingFrame = new Float64Array(GLDIAG_RING);
  const glDiagRingCpuMax = new Float64Array(GLDIAG_RING);
  const glDiagRingCpuBad = new Float64Array(GLDIAG_RING);
  const glDiagRingCpuName: string[] = new Array(GLDIAG_RING).fill('');
  /**
   * The pre-onset history for the OFF-SCREEN fraction and the `positions` magnitude behind it.
   *
   * ⚠️ Tracked separately rather than folded into `glDiagRingCpuMax`, because `positions` was removed from that
   * aggregate — without these two the ring would hold no pre-onset series for the trigger that fires most
   * often, and a ring's whole purpose is to say whether the onset was a RAMP or a STEP.
   */
  const glDiagRingOffscreen = new Float64Array(GLDIAG_RING);
  const glDiagRingPosMax = new Float64Array(GLDIAG_RING);
  let glDiagRingHead = 0;
  let glDiagRingCount = 0;
  let glDiagFrame = 0;
  /**
   * `watch` = cheap CPU scan every frame + a 1 Hz stage read. `capture` = dense per-frame stage reads.
   * `done` = emitted once and permanently silent.
   *
   * ⚠️ **`done` is terminal on purpose.** The failure being investigated does not recover, so every frame
   * after onset carries the same reading — and it was 60 identical lines a second that made the previous two
   * sittings' logs unreadable. The ONE record covers the frames on either side of onset, which are the only
   * frames that distinguish a cause from its symptom.
   */
  let glDiagPhase: 'watch' | 'capture' | 'done' = 'watch';
  /**
   * Frames of grace after a re-arm before the probe may trigger again — `PerfGuard.SETTLE_FRAMES`' reasoning,
   * for the same reason. A preset switch reallocates buffers, disposes and re-inits the generator and re-warms
   * the trail, so the frames straight after it are unrepresentative: the trail is legitimately empty and
   * `positions` legitimately holds one frame of pre-projection model coordinates.
   */
  const GLDIAG_SETTLE_FRAMES = 90;
  let glDiagSettle = 0;
  /**
   * Re-arm the one-shot, so a capture can reach a configuration the user has to NAVIGATE to.
   *
   * ⚠️ **The 2026-08-23 capture run is the whole reason this exists, and its failure was in the trigger, not in
   * the probe.** `'done'` was terminal, and the probe fired at frame 259 — about 4 seconds in, on the startup
   * preset with no material — then went permanently silent. So the run under investigation (`Chain Flow Split`
   * + Fire, both reachable only by clicking) could not be observed at all: the record came back with
   * `"preset":"Aurora Borealis","material":"None"`. A one-shot is right for controlling log VOLUME and wrong for
   * a bug the reporter must first navigate to; re-arming on the two navigation events reconciles the two.
   *
   * ⚠️ Still one shot PER CONFIGURATION, not a re-enable of continuous logging. Each re-arm buys exactly one
   * more record, and only a deliberate preset or material change can buy it — nothing here re-arms on a timer,
   * so a single failing configuration cannot emit twice however long it runs.
   *
   * The ring is deliberately NOT cleared: its pre-onset history is what distinguishes a ramp from a step, and
   * discarding it on the very event that starts the interesting run would throw away the run-up. Frame numbers
   * are continuous across a re-arm, so the ring stays readable.
   */
  function glDiagRearm(reason: string): void {
    if (!glDiagEnabled) return;
    glDiagPhase = 'watch';
    glDiagCaptureLeft = 0;
    glDiagCapture.length = 0;
    glDiagTrigger = '';
    glDiagSettle = GLDIAG_SETTLE_FRAMES;
    glDiagLastProbe = 0;
    console.warn(`[GLDIAG] re-armed (${reason}) — watching for one more capture after a `
      + `${GLDIAG_SETTLE_FRAMES}-frame settle.`);
  }
  let glDiagCaptureLeft = 0;
  let glDiagTrigger = '';
  let glDiagTriggerFrame = 0;
  const glDiagCapture: unknown[] = [];

  /** One buffer's crop, classified. Kept separate from the verdict so every stage read uses identical arithmetic. */
  function glDiagScan(fbo: WebGLFramebuffer, x: number, y: number, w: number, h: number) {
    if (!glDiagBuf || glDiagBuf.length !== w * h * 4) glDiagBuf = new Float32Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.FLOAT, glDiagBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let nan = 0, inf = 0, trip = 0, nonZero = 0, maxLum = 0, maxAlpha = 0, maxAbs = 0;
    for (let i = 0; i < glDiagBuf.length; i += 4) {
      const r = glDiagBuf[i]!, g = glDiagBuf[i + 1]!, b = glDiagBuf[i + 2]!, a = glDiagBuf[i + 3]!;
      // NaN first: it fails every comparison, so a magnitude test cannot see it (invariant 20).
      if (!(r === r) || !(g === g) || !(b === b) || !(a === a)) { nan++; continue; }
      if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(a)) { inf++; continue; }
      // A guard TRIP — `sanitiseTrail` released this texel to the diagnostic sentinel. Counted before the
      // luminance maths because a sentinel is a marker, not a colour: letting -2048 into `maxAbs` would
      // report the guard's own release value as the runaway it was released for.
      //
      // Threshold, never equality: these buffers filter LINEAR, so a tap between texels returns a sentinel
      // already blended toward its neighbours. Unreachable when the sentinel is 0 (every shipped path).
      if (r < DIAG_SENTINEL_THRESHOLD || g < DIAG_SENTINEL_THRESHOLD || b < DIAG_SENTINEL_THRESHOLD) { trip++; continue; }
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > 0) nonZero++;
      if (lum > maxLum) maxLum = lum;
      if (a > maxAlpha) maxAlpha = a;
      // Tracked separately from `maxLum` because luminance is a WEIGHTED SUM and can hide a single blown
      // channel: 0.0722 * b means a blue-only runaway reads 14x smaller in `maxLum` than it is. A half-float
      // overflow is per channel, so the bound that matters is the largest channel, not the perceived one.
      const m = Math.max(Math.abs(r), Math.abs(g), Math.abs(b), Math.abs(a));
      if (m > maxAbs) maxAbs = m;
    }
    return { nan, inf, trip, nonZero, maxLum, maxAlpha, maxAbs, total: glDiagBuf.length / 4 };
  }

  /**
   * The SCREEN stage — the default framebuffer, read as 8-bit unorm.
   *
   * Returns the same shape as `glDiagScan` so the record's six stages are directly comparable, but three of
   * its fields are STRUCTURALLY zero here and that is information rather than a gap: an 8-bit unorm buffer
   * cannot hold a NaN, an Inf or a negative sentinel. So `screen` answers exactly one question — did anything
   * survive the grading — and `lit == 0` here while `texA.lit > 0` upstream is the signature of a
   * GRADING failure (⚠️ `acesToneMap` is a rational function and is NaN at Inf, on this path), not of a
   * poisoned trail.
   *
   * `maxLum`/`maxAbs` are normalised to 0..1 so a reader can compare them against the HDR stages without
   * mentally dividing by 255.
   */
  function glDiagScanScreen(x: number, y: number, w: number, h: number) {
    if (!glDiagBuf8 || glDiagBuf8.length !== w * h * 4) glDiagBuf8 = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, glDiagBuf8);
    let nonZero = 0, maxLum = 0, maxAbs = 0, maxAlpha = 0;
    for (let i = 0; i < glDiagBuf8.length; i += 4) {
      const r = glDiagBuf8[i]! / 255, g = glDiagBuf8[i + 1]! / 255, b = glDiagBuf8[i + 2]! / 255;
      const a = glDiagBuf8[i + 3]! / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum > 0) nonZero++;
      if (lum > maxLum) maxLum = lum;
      if (a > maxAlpha) maxAlpha = a;
      const m = Math.max(r, g, b, a);
      if (m > maxAbs) maxAbs = m;
    }
    return { nan: 0, inf: 0, trip: 0, nonZero, maxLum, maxAlpha, maxAbs, total: glDiagBuf8.length / 4 };
  }

  /**
   * Scan the published CPU state over the LIVE range: non-finite counts AND per-array magnitudes.
   *
   * ⚠️ `state.count` is the only trustworthy length (invariant 7) — `getState()` publishes grow-only reused
   * scratch, so scanning `.length` would report stale tail values as live defects.
   *
   * ⚠️ **The MAGNITUDES are the addition of 2026-08-23 and they are the point of this function now.** A
   * finiteness-only scan reported `cpu none` on every probe of the `Chain Flow Split` + Fire failure while
   * `texB` came back `nan=4096` — a pairing that reads as "the CPU is innocent, the GPU is guilty" and is
   * exactly wrong if the cause is a CPU value RAMPING. These arrays are float64-backed on the CPU but every
   * buffer they are drawn into is RGBA16F (max finite magnitude 65504), so a value at 1e5 is finite here and
   * Inf there. `temperatures` is integrated (`temp = temp * coolFactor + heat`, `generators/material.ts`) and
   * so is the prime candidate; `colors` is what a material writes from it.
   *
   * Cheap enough for EVERY frame, unlike the texture reads: no `readPixels`, no GL sync, just a pass over
   * arrays already in memory. That is what makes a pre-onset ring buffer possible.
   */
  interface CpuScan {
    bad: string;
    firstIdx: number;
    scanned: string;
    /** Largest absolute value seen in each scanned array, by name. */
    mags: Record<string, number>;
    /**
     * The largest of `mags` over the BOUNDED arrays, and which one it came from — the ring buffer's sample.
     * ⚠️ Excludes `positions` and `lifetimes`; both are legitimately unbounded. See `GLDIAG_MAG_LIMIT`.
     */
    maxAbs: number;
    maxAbsName: string;
    nonFinite: number;
    /** `positions`' own magnitude, reported but never thresholded — context for `offscreen`, not a test. */
    posMax: number;
    /** Fraction of particles whose projected x/y falls outside the canvas. The real `positions` test. */
    offscreen: number;
  }
  function glDiagScanCpu(): CpuScan {
    const st = generator.getState();
    const n = st.count;
    // ⚠️ EVERY per-slot float array, not just positions/temperatures. The 2026-08-22 probe reported
    // `nanPos=0 nanTemp=0` and that was read as "CPU state is clean" — but it covered 2 of the 6 float
    // arrays `getState()` publishes, and a material writes `colors`. An UNSCANNED array is not a clean
    // one, so the log now names what it looked at (`scanned`) as well as what it found.
    //
    // Stride matters: `velocityDirs` is 2 per slot, `positions`/`colors` are 3, the rest are 1. Scanning a
    // stride-2 array at stride 3 walks past `n * 2` into stale scratch (invariant 7) and invents defects.
    const arrays: Array<[string, Float32Array | undefined, number]> = [
      ['positions', st.positions, 3],
      ['colors', st.colors, 3],
      ['depths', st.depths, 1],
      ['velocities', st.velocities, 1],
      ['temperatures', st.temperatures, 1],
      ['lifetimes', st.lifetimes, 1],
      ['velocityDirs', st.velocityDirs, 2],
      ['growth', st.growth, 1],
    ];
    const bad: string[] = [];
    const scanned: string[] = [];
    const mags: Record<string, number> = {};
    let firstIdx = -1;
    let nonFinite = 0;
    let maxAbs = 0;
    let maxAbsName = 'none';
    for (const [name, arr, stride] of arrays) {
      if (!arr) continue;
      scanned.push(name);
      // Bounded by the array's own length as well as by `count`: `lifetimes` is the one array not
      // extended to `totalCount` (invariant 6), so `n * stride` can exceed it.
      const lim = Math.min(n * stride, arr.length);
      let count = 0;
      let mag = 0;
      for (let i = 0; i < lim; i++) {
        const v = arr[i]!;
        if (!Number.isFinite(v)) {
          count++;
          if (firstIdx < 0) firstIdx = Math.floor(i / stride);
          // `continue` so a non-finite entry cannot become this array's magnitude — Inf would swallow every
          // real value and NaN would silently lose every comparison, leaving `mag` looking healthy.
          continue;
        }
        const a = Math.abs(v);
        if (a > mag) mag = a;
      }
      mags[name] = mag;
      nonFinite += count;
      // ⚠️ `lifetimes` AND `positions` are EXCLUDED from the aggregate maximum, and both exclusions are
      // load-bearing rather than fussy — each one, left in, fires the trigger on a healthy frame.
      //
      // `lifetimes` is an unbounded age in SECONDS (per the force-gate rules), so it climbs past any threshold
      // in a long session as a matter of design; including it made the trigger fire on every run after ~8
      // minutes and report the healthiest array in the set as the anomaly.
      //
      // `positions` is a SCREEN COORDINATE downstream of `proj = perspZ / q`, which diverges as `q -> 0+`. A
      // particle grazing the camera plane therefore reaches 1e7 px correctly, and that is precisely what burned
      // the 2026-08-23 capture's one shot on the startup preset. See `GLDIAG_MAG_LIMIT` for the units error,
      // and `offscreen` below for the test that replaces it.
      //
      // Both are still scanned for FINITENESS above, which is the only way either can actually be wrong.
      if (name !== 'lifetimes' && name !== 'positions' && mag > maxAbs) { maxAbs = mag; maxAbsName = name; }
      if (count > 0) bad.push(`${name}=${count}`);
    }
    // The `positions` test proper: how much of the population is actually ON SCREEN.
    //
    // ⚠️ A separate pass because this is PER PARTICLE over the x/y pair, not per element — the loop above
    // walks a flat array and cannot pair them. Counting elements outside the canvas instead would score a
    // particle at (x on screen, y off screen) as half-culled, which is not a state that exists.
    //
    // Only x and y: z is a depth, tested nowhere against the viewport. Read from `positions` AFTER projection,
    // which is what this array holds by the time `getState()` publishes it — a pre-projection model coordinate
    // would make this measure nothing at all.
    let offscreenCount = 0;
    const pos = st.positions;
    if (pos) {
      const lim = Math.min(n * 3, pos.length);
      for (let i = 0; i < lim; i += 3) {
        const px = pos[i]!, py = pos[i + 1]!;
        // `!(a && b)` rather than `a || b` so a NaN coordinate counts as off-screen: every comparison with NaN
        // is false, so a NaN would otherwise satisfy neither bound and be scored as on-screen (invariant 20's
        // "a chained clamp is transparent to NaN", in miniature).
        if (!(px >= 0 && px < canvas.width && py >= 0 && py < canvas.height)) offscreenCount++;
      }
    }

    return {
      bad: bad.length > 0 ? bad.join(' ') : 'none',
      firstIdx,
      scanned: `${scanned.length}/${arrays.length}`,
      mags,
      maxAbs,
      maxAbsName,
      nonFinite,
      posMax: mags['positions'] ?? 0,
      offscreen: n > 0 ? offscreenCount / n : 0,
    };
  }

  /** One stage's reading, plus the coverage note that keeps `absent` from reading as clean. */
  type StageScan = ReturnType<typeof glDiagScan> | { absent: string };

  /**
   * Read all six trail-carrying stages, in the order the frame WRITES them.
   *
   * ⚠️ The write order is what makes this localising rather than merely thorough: a non-finite value or a
   * runaway magnitude appearing FIRST at stage N names stage N's producer, and no single-stage reading can
   * say that (invariant 21). A stage the current chain does not build reports `absent` with the reason.
   */
  function glDiagReadStages(): Record<string, StageScan> {
    const w = Math.min(GLDIAG_CROP, fboState.width);
    const h = Math.min(GLDIAG_CROP, fboState.height);
    const x = Math.max(0, (fboState.width - w) >> 1);
    const y = Math.max(0, (fboState.height - h) >> 1);

    const stages: Record<string, StageScan> = {};
    stages['1_texB'] = glDiagScan(fboState.fboB, x, y, w, h);

    // ⚠️ Both intermediates derive their crop from their OWN reported size. The band target is HALF
    // resolution, so reusing the rectangle above would `readPixels` outside the attachment and return
    // undefined content — indistinguishable from a real defect, and it would have been read as one.
    const band = transMap.getDiagBandStage();
    stages['2_bandB'] = band
      ? glDiagScan(
          band.fbo,
          Math.max(0, (band.width - Math.min(GLDIAG_CROP, band.width)) >> 1),
          Math.max(0, (band.height - Math.min(GLDIAG_CROP, band.height)) >> 1),
          Math.min(GLDIAG_CROP, band.width),
          Math.min(GLDIAG_CROP, band.height),
        )
      : { absent: 'no Band Split (style 9) layer in the chain — NOT scanned, so not known clean' };

    const scratch = transMap.getDiagScratchStage();
    stages['3_scratch'] = scratch
      ? glDiagScan(
          scratch.fbo,
          Math.max(0, (scratch.width - Math.min(GLDIAG_CROP, scratch.width)) >> 1),
          Math.max(0, (scratch.height - Math.min(GLDIAG_CROP, scratch.height)) >> 1),
          Math.min(GLDIAG_CROP, scratch.width),
          Math.min(GLDIAG_CROP, scratch.height),
        )
      : { absent: 'single-pass chain — no warp+echo intermediate exists to scan' };

    stages['4_texA'] = glDiagScan(fboState.fboA, x, y, w, h);
    // Bloom's target holds the PREVIOUS frame's composite unless bloom ran this frame, so it is reported as
    // absent when bloom is off rather than scanned — a stale buffer is a lie, not a measurement.
    stages['5_post'] = bloom.isEnabled()
      ? glDiagScan(postFBO.fbo, x, y, w, h)
      : { absent: 'bloom disabled — postFBO holds no current frame' };
    // Last, and 8-bit: see `glDiagScanScreen`. Read AFTER the off-screen stages so its framebuffer bind
    // (to `null`) is the state the frame is left in anyway.
    stages['6_screen'] = glDiagScanScreen(
      Math.max(0, (canvas.width - Math.min(GLDIAG_CROP, canvas.width)) >> 1),
      Math.max(0, (canvas.height - Math.min(GLDIAG_CROP, canvas.height)) >> 1),
      Math.min(GLDIAG_CROP, canvas.width),
      Math.min(GLDIAG_CROP, canvas.height),
    );
    return stages;
  }

  /** Non-finite, tripped, or magnitude beyond the half-float danger line — the per-stage anomaly test. */
  function glDiagStageBad(s: StageScan): boolean {
    if ('absent' in s) return false;
    return s.nan > 0 || s.inf > 0 || s.trip > 0 || s.maxAbs > GLDIAG_MAG_LIMIT;
  }

  /**
   * Name the FIRST stage in write order that is bad, and say what that stage's producer is. This sentence is
   * the deliverable of the whole diagnostic — everything else in the record is the evidence for it.
   */
  function glDiagVerdict(stages: Record<string, StageScan>, cpu: CpuScan): string {
    if (cpu.bad !== 'none') {
      // Checked before any stage: CPU state is INTEGRATED, so it is a cause and every texture is its symptom.
      // No GPU-side guard can clear it and it re-enters the draw every frame — the only shape that explains
      // "doesn't recover" with a clean `getError`.
      return `NON-FINITE CPU STATE — ${cpu.bad} (first bad slot ${cpu.firstIdx}). Fix the producer that `
        + 'writes that array; every stage reading below is downstream of this.';
    }
    if (cpu.maxAbs > GLDIAG_MAG_LIMIT) {
      // The blind spot that cost two sittings: finite on the CPU, Inf the instant it is drawn into RGBA16F.
      //
      // ⚠️ This branch is now reachable ONLY from the bounded arrays (`GLDIAG_MAG_LIMIT` excludes `positions`
      // and `lifetimes`), and the half-float claim below is true of exactly those: `colors` and `temperatures`
      // are texel values. It was previously reached by `positions` too, where the same sentence is a units
      // error — a screen coordinate is a vertex input, never sampled as a texel, so it cannot overflow a
      // texture no matter how large it grows.
      return `CPU MAGNITUDE RUNAWAY — ${cpu.maxAbsName} reached ${cpu.maxAbs.toExponential(3)}, far outside its `
        + `design range (every array tested here is bounded by construction: colours and depths clamp to 0..1, `
        + `temperatures converge to heatGain). It is still FINITE on the CPU, and this array is drawn as a `
        + `TEXEL — so past 65504 it becomes Inf in an RGBA16F target while a finiteness-only probe still `
        + 'reports `cpu none`. Read the RING below: a rising series confirms an integrator with no bound, a '
        + 'step confirms a single event.';
    }
    if (cpu.offscreen > GLDIAG_OFFSCREEN_LIMIT) {
      // The cause the 2026-08-23 capture actually showed, and the one no previous reading could name: every
      // stage finite, no guard trip, no bad upload, and the trail simply DECAYING because nothing new was
      // drawn into it. This is a geometry fault, not a pipeline fault, and the six-stage table cannot see it —
      // every stage it reads is downstream of the draw that never happened.
      return `${(cpu.offscreen * 100).toFixed(1)}% OF PARTICLES ARE OFF SCREEN — nothing is being drawn into `
        + `the trail, so it fades to black and cannot recover (positions reach ${cpu.posMax.toExponential(2)} `
        + `px against a ${canvas.width}x${canvas.height} canvas). ⚠️ This is a GEOMETRY fault: every stage `
        + 'below will read finite and clean, because they are all downstream of a draw that contributed '
        + 'nothing. Look at the projection (`proj = perspZ / q` diverges as q -> 0+, and the q > 0 guard '
        + 'rejects behind-camera but not GRAZING), and at the additive writes into `positions` — the '
        + 'attractor blend, displacement, physarum/fire offsets and cluster force all accumulate in place. '
        + 'The RING says which: a rising series means an integrator, a step means the pose crossed the camera.';
    }
    const order = ['1_texB', '2_bandB', '3_scratch', '4_texA', '5_post', '6_screen'];
    const blame: Record<string, string> = {
      '1_texB': 'the PARTICLE DRAW or the state feeding it — the decay blit that wrote this buffer was '
        + 'sanitised, so whatever drew on top of it introduced this. Read the [GLDIAG] NON-FINITE UPLOAD '
        + 'lines and the `uploads` block: they name the file and line of the offending uniform or buffer.',
      '2_bandB': 'the BAND SPLIT BLUR (style 9). It SUMS taps of the raw trail, so it reaches a higher '
        + 'magnitude than anything upstream — this is where a half-float overflow appears first if the trail '
        + 'itself is merely large. Compare `1_texB.maxAbs` against this stage\'s: a jump of roughly the tap '
        + 'count means summation, an identical value means it inherited the fault.',
      '3_scratch': 'the FIRST of the two chain passes (warp+echo), before the second one ran.',
      '4_texA': 'the WARP or ECHO pass itself. ⚠️ Both terminate in `sanitiseTrail`, so a nonzero `trip` here '
        + 'means the guard FIRED and is masking a live producer rather than that the pass is clean.',
      '5_post': 'BLOOM. Its bright-pass multiplies, so a large-but-finite texA can overflow here.',
      '6_screen': 'the GRADING. ⚠️ `acesToneMap` is a RATIONAL function and is NaN at Inf, and it runs here — '
        + 'downstream of every trail guard, which cannot reach it.',
    };
    for (const key of order) {
      const s = stages[key];
      if (s && glDiagStageBad(s)) return `FIRST BAD STAGE = ${key} → ${blame[key]}`;
    }
    // Nothing is non-finite anywhere. The remaining question is whether the frame is black because the trail
    // is empty or because the grading ate it — which is precisely the pair the sentinel and this stage split.
    const a = stages['4_texA'];
    const screen = stages['6_screen'];
    if (a && !('absent' in a) && screen && !('absent' in screen)) {
      if (a.nonZero > 0 && screen.nonZero === 0) {
        return 'ALL STAGES FINITE, but the trail is lit and the SCREEN is black — the fault is in the '
          + 'grading, the blit or the viewport, not in the trail. Compare texA.maxLum against the film '
          + 'look\'s exposure below.';
      }
      if (a.nonZero === 0) {
        return 'ALL STAGES FINITE and texA is EMPTY — nothing drew into the trail. ⚠️ Now unambiguous, '
          + 'because a guard trip would have shown as `trip > 0` instead (the sentinel). Read the [GLDIAG] '
          + 'gl.getError() line: ANGLE drops an invalid draw silently.';
      }
    }
    return 'no anomaly at any stage — the trigger fired on a condition that has since cleared, or the '
      + 'failure is not in this pipeline.';
  }

  /**
   * The frame hook. Cheap every frame, expensive only after the trigger, and silent forever after one emit.
   */
  function probeTrail(time: number): void {
    if (glDiagPhase === 'done') return;
    glDiagFrame++;
    // ⚠️ Counted but not SAMPLED during the settle: the ring must not be fed the reallocation frames after a
    // preset switch, since `positions` holds one frame of pre-projection model coordinates there and the trail
    // is legitimately empty — exactly the two readings that look like the fault being hunted.
    if (glDiagSettle > 0) { glDiagSettle--; return; }

    // The per-frame half: a CPU-only pass over arrays already in memory. No `readPixels`, no GL sync — this
    // is what makes a pre-onset history affordable, and the history is the only thing that can show a RAMP.
    const cpu = glDiagScanCpu();
    if (glDiagFrame % GLDIAG_RING_STRIDE === 0) {
      glDiagRingFrame[glDiagRingHead] = glDiagFrame;
      glDiagRingCpuMax[glDiagRingHead] = cpu.maxAbs;
      glDiagRingCpuBad[glDiagRingHead] = cpu.nonFinite;
      glDiagRingCpuName[glDiagRingHead] = cpu.maxAbsName;
      glDiagRingOffscreen[glDiagRingHead] = cpu.offscreen;
      glDiagRingPosMax[glDiagRingHead] = cpu.posMax;
      glDiagRingHead = (glDiagRingHead + 1) % GLDIAG_RING;
      if (glDiagRingCount < GLDIAG_RING) glDiagRingCount++;
    }

    if (glDiagPhase === 'watch') {
      // Stage reads stay at the pre-2026-08-23 rate of 1 Hz while healthy. ⚠️ Deliberate: six `readPixels`
      // per frame would stall the pipeline hard enough to change the timing of the run-up being observed, and
      // a diagnostic that perturbs its own subject is worse than none.
      const cpuAnomaly = cpu.bad !== 'none' || cpu.maxAbs > GLDIAG_MAG_LIMIT
        || cpu.offscreen > GLDIAG_OFFSCREEN_LIMIT;
      if (!cpuAnomaly && time - glDiagLastProbe < 1000) return;
      glDiagLastProbe = time;
      const stages = glDiagReadStages();
      const anyStageBad = Object.values(stages).some(glDiagStageBad);
      // The dark-screen trigger: the trail is lit and the screen is not. Nothing else in this probe can see
      // a purely DOWNSTREAM failure, since every value it reads is finite and ordinary.
      const texA = stages['4_texA'];
      const screen = stages['6_screen'];
      const darkScreen = texA !== undefined && !('absent' in texA) && texA.nonZero > 0
        && screen !== undefined && !('absent' in screen) && screen.nonZero === 0;

      if (!cpuAnomaly && !anyStageBad && !darkScreen) return;
      glDiagPhase = 'capture';
      glDiagCaptureLeft = GLDIAG_CAPTURE_FRAMES;
      glDiagTriggerFrame = glDiagFrame;
      glDiagTrigger = cpu.bad !== 'none' ? `non-finite CPU state (${cpu.bad})`
        : cpu.maxAbs > GLDIAG_MAG_LIMIT ? `CPU magnitude ${cpu.maxAbsName}=${cpu.maxAbs.toExponential(3)} > ${GLDIAG_MAG_LIMIT}`
        : cpu.offscreen > GLDIAG_OFFSCREEN_LIMIT ? `${(cpu.offscreen * 100).toFixed(1)}% of particles off screen (positions reach ${cpu.posMax.toExponential(2)} px)`
        : anyStageBad ? 'a stage reported non-finite, tripped or oversized texels'
        : 'the trail is lit but the screen is black';
      console.warn(`[GLDIAG] TRIGGER at frame ${glDiagFrame}: ${glDiagTrigger}. Capturing `
        + `${GLDIAG_CAPTURE_FRAMES} frames, then emitting ONE record. No further output until then.`);
      // Fall through so the triggering frame is capture entry 0 — it is the most informative one in the set.
    }

    const stages = glDiagReadStages();
    glDiagCapture.push({ frame: glDiagFrame, sinceTrigger: glDiagFrame - glDiagTriggerFrame, stages, cpu });
    glDiagCaptureLeft--;
    if (glDiagCaptureLeft > 0) return;

    // Emit. ONE record, built here rather than accumulated, so nothing above allocates per frame.
    const ring: Array<{
      frame: number; cpuMax: number; cpuBad: number; worst: string; offscreen: number; posMax: number;
    }> = [];
    for (let i = 0; i < glDiagRingCount; i++) {
      const idx = (glDiagRingHead - glDiagRingCount + i + GLDIAG_RING * 2) % GLDIAG_RING;
      ring.push({
        frame: glDiagRingFrame[idx]!,
        cpuMax: glDiagRingCpuMax[idx]!,
        cpuBad: glDiagRingCpuBad[idx]!,
        worst: glDiagRingCpuName[idx]!,
        offscreen: glDiagRingOffscreen[idx]!,
        posMax: glDiagRingPosMax[idx]!,
      });
    }
    // Widened index, as `reapplyRendererState()` does it: `currentFilmLook` is a runtime string (dropdown
    // value, preset field, keyboard shortcut) while `FILM_LOOKS` is declared with `satisfies` and so has a
    // precise key type. `undefined` is fine here — every consumer below reads through `?? null`.
    const look: FilmLookParams | undefined = currentFilmLook === CUSTOMIZE_FILM_LOOK
      ? customFilmLookParams
      : (FILM_LOOKS as Record<string, FilmLookParams | undefined>)[currentFilmLook];
    const record = {
      verdict: glDiagVerdict(stages, glDiagScanCpu()),
      trigger: glDiagTrigger,
      triggerFrame: glDiagTriggerFrame,
      context: {
        preset: presetNames[currentPresetIndex] ?? '?',
        material: currentMaterial?.preset ?? 'None',
        heatGain: currentMaterial?.heatGain ?? null,
        thermalLag: currentMaterial?.thermalLag ?? null,
        // ⚠️ The OVERLAY chain, which is the live one. The preset's own `postProcessors.transMap` block can
        // disagree with it and nothing writes back (invariant 17) — reading that half instead is what once
        // made a chain preview with no warp at all.
        chain: currentTransMapChain
          .filter(l => l.enabled)
          .map(l => ({ style: l.style, weight: l.weight, bandSplit: l.bandSplit ?? null })),
        warpMix: currentTransMapWarpMix,
        dispersion: currentTransMapDispersion,
        renderMode: currentRenderMode,
        particles: generator.getState().count,
        trailDecay,
        filmLook: currentFilmLook,
        bloom: bloom.isEnabled(),
        toneMap: toneMap.isEnabled(),
        toneCurve: look?.toneMapCurve ?? null,
        exposure: look?.exposure ?? null,
        canvas: `${canvas.width}x${canvas.height}`,
      },
      // Empty means no non-finite value crossed the GL upload boundary — which EXONERATES every uniform and
      // every attribute buffer in the engine, and is therefore a positive finding rather than a blank.
      uploads: [...glUploadFaults.values()],
      ring,
      capture: glDiagCapture,
    };

    // ⚠️ **Printed as a compact TABLE, not as the pretty JSON of `record`, and that is the point of the whole
    // exercise rather than a formatting preference.** 30 frames x 6 stages x 8 fields at `JSON.stringify(_, _,
    // 1)` is ~2000 lines — i.e. exactly the "logs are huge and difficult to analyse" problem this replaces,
    // just arriving in one message instead of thousands. One line per frame is ~40 lines and fits in a paste.
    //
    // The full structured record still exists on `window.__gldiag` for anything that wants to read it
    // programmatically, so nothing is lost by not printing it.
    const cell = (s: StageScan | undefined): string => {
      if (!s) return 'n/a';
      if ('absent' in s) return 'absent';
      return `${s.nan}/${s.inf}/${s.trip} lit${s.nonZero} mx${s.maxAbs.toExponential(1)}`;
    };
    const lines: string[] = [];
    lines.push(`[GLDIAG] CAPTURE COMPLETE`);
    lines.push(`VERDICT: ${record.verdict}`);
    lines.push(`TRIGGER: ${record.trigger} (frame ${record.triggerFrame})`);
    lines.push(`CONTEXT: ${JSON.stringify(record.context)}`);
    lines.push(record.uploads.length === 0
      ? 'UPLOADS: none — no non-finite value crossed the GL upload boundary all session. This EXONERATES '
        + 'every uniform and every attribute buffer, and is a finding, not a blank.'
      : `UPLOADS: ${record.uploads.length} site(s)`);
    for (const u of record.uploads) {
      lines.push(`  ${u.method} x${u.frames} — ${u.worst}\n    at ${u.site}`);
    }
    lines.push('RING (pre-onset history, ~every 10th frame — a RISING series means an unbounded integrator, '
      + 'a step means a single event). Format frame:off%/posMax/boundedMax:');
    lines.push('  ' + ring.map(r => `${r.frame}:${(r.offscreen * 100).toFixed(0)}%/`
      + `${r.posMax.toExponential(1)}/${r.cpuMax.toExponential(1)}${r.cpuBad > 0 ? `!${r.cpuBad}` : ''}`).join(' '));
    lines.push(`  worst BOUNDED array over the window: ${ring.length > 0 ? ring[ring.length - 1]!.worst : 'n/a'}`
      + ' (positions and lifetimes are excluded from that maximum by design — they are unbounded)');
    lines.push('CAPTURE — one line per frame. Cells are nan/inf/trip lit<count> mx<maxAbs>. Stage order is '
      + 'WRITE order, so the leftmost bad cell names the producer. ⚠️ If every stage is clean, read the CPU '
      + 'column instead: an all-clean table with off% at 100 means the draw contributed nothing, and the '
      + 'stages are all downstream of it:');
    lines.push('  frm | texB | bandB | scratch | texA | post | screen | off% | cpu');
    for (const e of glDiagCapture as Array<{ sinceTrigger: number; stages: Record<string, StageScan>; cpu: CpuScan }>) {
      lines.push(`  ${String(e.sinceTrigger).padStart(3)} | ${cell(e.stages['1_texB'])} | `
        + `${cell(e.stages['2_bandB'])} | ${cell(e.stages['3_scratch'])} | ${cell(e.stages['4_texA'])} | `
        + `${cell(e.stages['5_post'])} | ${cell(e.stages['6_screen'])} | `
        + `${(e.cpu.offscreen * 100).toFixed(0)} | `
        + `${e.cpu.maxAbsName}=${e.cpu.maxAbs.toExponential(2)} pos=${e.cpu.posMax.toExponential(2)}`
        + `${e.cpu.nonFinite > 0 ? ` BAD:${e.cpu.bad}` : ''}`);
    }
    lines.push('Paste this whole block. The structured form is `window.__gldiag`.');
    console.warn(lines.join('\n'));
    (window as unknown as Record<string, unknown>)['__gldiag'] = record;
    glDiagPhase = 'done';
  }

  function drawFrameBody(time: number) {
    /*
     * ⚠️ **THE 100 ms CLAMP MAKES THE ANIMATION GENUINELY SLOW BELOW 10 fps, AND THAT IS NOT A CADENCE
     * EFFECT.** Confirmed by owner reading 2026-09-25: `Boiling Milk` at `?renderscale=1` (9.26 Mpx, 50 000
     * particles, `liquid`) ran at about 2 fps and the figure advanced at *"0.5 second per update"*. Per frame
     * the simulation advances `min(frameTime, 100)` ms, so the real-time factor is `100 / frameTime` once a
     * frame exceeds 100 ms: 1.00× at 20 fps, 1.00× at 10 fps, 0.50× at 5 fps, **0.20× at 2 fps**.
     * `lissajous.ts`'s `correction = min(dt / 16.667, 6.0)` caps at exactly the same 100 ms, so the two agree
     * and neither bites at 16–50 ms.
     *
     * ⚠️ **This corrects an analysis, not just a gap.** Asked in this same sitting why a preset looked *"slowed
     * down on the big fullscreen view"*, the phase advance was checked, found time-proportional, and the answer
     * given was that the figure is never actually slower and only the presentation cadence varies. **That holds
     * only under 100 ms**; above it the clamp converts a fill problem into a visibly slower animation, which is
     * a different symptom with a different cause and reads to a user as the preset being wrong.
     *
     * ⚠️ **Do NOT raise or remove the clamp to fix this.** It exists so a backgrounded tab, a breakpoint or a
     * GPU hitch cannot hand a forward-Euler integrator a multi-second step (invariant 12: such integrators
     * diverge, and the remedy is to reseed rather than to clamp harder). The remedy is upstream — keep the
     * frame under 100 ms, which is what `RENDER_PIXEL_BUDGET` is for. **The budget therefore buys correctness
     * of the animation's SPEED on a big surface, not only comfort**; that is the stronger reason for it and it
     * was not known when the constant was chosen.
     */
    const dt = lastTime === 0 ? 16.667 : Math.min(time - lastTime, 100);
    // The UNCLAMPED interval, for the `?perf=1` overlay only: the clamp above is for the animation's speed, and a
    // reading through it can never show a frame longer than 100 ms — a preset switch that freezes for a second
    // read as 100 ms, and every p95 was capped there.
    const rawFrameMs = lastTime === 0 ? 16.667 : time - lastTime;
    lastTime = time;
    elapsedTime += dt * speedFactor * 0.001;

    /*
     * The reel clock, FIRST in the frame (v8 Phase 19).
     *
     * ⚠️ **It is given `time`, not `dt`, and it works in ABSOLUTE deadlines.** `dt` above is clamped to 100 ms
     * and, in `elapsedTime`, multiplied by `speedFactor` — either would make a reel's "20 seconds" mean
     * something other than twenty seconds: the clamp stretches every hold by however long the tab was in the
     * background, and the speed factor would tie the schedule to a per-preset appearance control. A reel's
     * timing is wall-clock by definition, so it reads the rAF timestamp directly.
     *
     * ⚠️ **FIRST, because it both switches the preset and sets `reelFreezeWeight`, which Step 3b reads later in
     * THIS frame.** Ticking it after the present would apply the freeze weight one frame late — invisible at
     * the plateau and visible as a one-frame flash of the un-frozen incoming preset at the start of it.
     */
    reelTick(time);

    // Step 1: Decay pass — read FBO-A, write the DECAYED trail to FBO-B (with optional blur), in ONE pass.
    //
    // ⚠️ **M6 (2026-11-12): this was two full-screen passes** — a copy of FBO-A into FBO-B, then a black quad at
    // alpha `a = 1 − decayFactor` blended `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` over it. The decay program writes the
    // result of that blend directly (`createDecayProgram`):
    //
    //     rgb' = rgb · (1 − a)          a' = a·a + alpha · (1 − a)
    //
    // so one full-resolution write and blend is saved per frame, on every preset. The only difference is that the
    // copy is no longer rounded to the trail's format before the fade is applied (rounding level).
    //
    // ⚠️ **BLENDING MUST BE OFF FOR THIS DRAW** — it writes the whole result; under ANY enabled blend function it
    // would combine with FBO-B's previous contents. And the old pass's history still applies to what FOLLOWS: it
    // used to leave `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` enabled, a later draw has been found relying on inherited
    // state before (`Miracle Frost`'s crystal flood, when the fade inherited an additive function), so that exact
    // state is RESTORED after the draw — Step 2 receives the GL state it always received. `blendcheck` holds both.
    perfHud?.begin('trail');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboState.fboB);
    gl.viewport(0, 0, fboState.width, fboState.height);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboState.texA);
    if (blurEnabled) {
      gl.useProgram(decayBlurProgram);
      gl.uniform1i(uDecayBlurTex, 0);
      gl.uniform1f(uDecayBlurFade, 1.0 - trailDecay);
      gl.uniform2f(uDecayBlurTexelSize, 1.0 / fboState.width, 1.0 / fboState.height);
      gl.bindVertexArray(decayBlurVao);
    } else {
      gl.useProgram(decayProgram);
      gl.uniform1i(uDecayTex, 0);
      gl.uniform1f(uDecayFade, 1.0 - trailDecay);
      gl.bindVertexArray(decayVao);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    // The state the two-pass form left behind (see above) — re-asserted, never inherited.
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    perfHud?.end('trail');

    // Step 2: Render new particles into FBO-B
    // FBO-B is still bound from step 1
    // v8 Phase 8a-2 (T020): the crystal lifecycle now runs INSIDE generator.update(), where
    // velocities/temperatures are current and `modelPos` still holds this frame's model space.
    // The Phase 8a debug driver used to nucleate here, between update() and getState(), which
    // published every freeze one frame late — a visible flicker. Nothing to do from here now.
    perfHud?.begin('figure');
    generator.update(dt * speedFactor);
    perfHud?.end('figure');

    // Apply force field to sparks if enabled
    if (currentTransMapForceSparks && currentTransMapForceBlend > 0 && currentTransMapEnabled && transMapForce.isActive()) {
      const sparkPool = generator.getSparkPool();
      if (sparkPool) {
        sparkPool.applyForceField(
          (x, y) => transMapForce.sampleForce(x, y),
          currentTransMapForceBlend,
          dt * speedFactor,
        );
      }
    }

    /*
     * v8 `15.6-salvage` A (2026-09-03) — the sparks ride the LIQUID velocity field, so an ember shed by the
     * curve is then carried by the wake the curve itself stirred. This is what cut Step 15.6 left to build:
     * `SparkPool` already IS relationship (C)'s emitter (velocity-thresholded, wave particles only, with
     * lifetime/gravity/drag), and the one behaviour it lacked was any coupling to 15.5's field.
     *
     * ⚠️ **A SECOND, INDEPENDENTLY GATED CALL — NOT A WIDENING OF THE TransMap FORCE ABOVE.** The two fields
     * are separate subsystems with separate enable conditions, and either may run without the other. Folding
     * them into one call site would make the TransMap gate (`currentTransMapForceSparks && blend > 0 &&
     * enabled && isActive()`) suppress the liquid coupling for every preset with no style-6 layer — which is
     * all of them today — and that failure is invisible: sparks would still spawn, still fall, still draw.
     *
     * ⚠️ **GATED ON `currentLiquidField.enabled`, THE SAME DERIVED FLAG `applyFluidFeedbackState()` USES AS
     * `poolOn` — deliberately NOT on `poolSize > 0`.** Reading `enabled` alone matches that function's own
     * documented choice, so the coupling and the field's activation cannot disagree; and it means a preset can
     * couple its sparks to the wake with `Pool Size` at 0, i.e. take relationship (B)'s FIELD without (B)'s
     * second population. That combination has no other expression in the UI.
     *
     * ⚠️ **The sampler is re-resolved through `fluidProcessor` per frame rather than latched**, for invariant
     * 3's reason and exactly as `setLiquidFieldSample` does: a `reinitFluid` or a torn-down float target must
     * leave the sparks standing on their own ballistics, never reading deleted textures. `isActive()` is tested
     * because the pool flag is what MADE it active — if the processor refused to initialise, the flag is still
     * true while the readback buffer holds nothing.
     */
    if (currentLiquidField.enabled && fluidProcessor.isActive()) {
      const sparkPool = generator.getSparkPool();
      if (sparkPool) {
        sparkPool.applyFieldFlow(
          (u, v, channel) => fluidProcessor.sampleVelocity(u, v, channel),
          currentLiquidField.fieldCoupling,
          dt * speedFactor,
          canvas.width,
          canvas.height,
        );
      }
    }

    const state = generator.getState();

    // Fluid advection: seed from particle motion each frame, then step solver, then advect
    if (fluidProcessor.isActive()) {
      const w = canvas.width, h = canvas.height;
      // v8 Phase 8a-3: exclude the trailing crystal block. Its length changes every frame, and the
      // three arrays below are reallocated (and `fluidSmoothedVel`'s EMA reset) whenever `n`
      // changes — so including crystals would reset the smoothing every frame and reintroduce the
      // velocity-field jitter the EMA exists to suppress. Excluding them also means the field is
      // seeded purely by the figure and the sparks, as it was before this feature.
      //
      // ⚠️ **v8 15.5 excludes the LIQUID POOL for a reason that is NOT a cost or a smoothing concern:
      // seeding the field from the population the field MOVES would close the feedback loop the step
      // deliberately leaves open.** A pool particle's whole velocity comes from `sampleVelocity()`, so
      // feeding its displacement back in as a source makes the field amplify its own output — and with
      // no pressure projection to bound divergence (Step 15.5 forbids adding one), the result is a
      // runaway that reads as the pool tearing itself into a few permanent jets. The figure drives the
      // field; the field drives the pool; the pool drives nothing. One direction, by design.
      //
      // ⚠️ It also keeps `advectParticles` below off the pool, which matters for a second, independent
      // reason: that call owns ONE particle-indexed offset pair and rewrites `state.positions` in place.
      // The pool's own integrator owns those slots (`getState()` re-copies them from `LiquidPool` every
      // frame), so a second owner would fight it — and since the write is discarded next frame, the
      // symptom would be a one-frame-stale jitter rather than an obviously wrong position.
      //
      // Both tail blocks are subtracted together because the pool is INSERTED before the crystals, so
      // `[wave][sparks]` is the contiguous prefix that remains.
      const n = Math.max(0, state.count - (state.crystalCount ?? 0) - (state.liquidCount ?? 0));

      // Build UV positions and EMA-smoothed velocity vectors from frame-to-frame displacement.
      // prevPositions must be saved from the pre-advection wave positions (not post-advection),
      // otherwise the fluid field reads its own output as input next frame — feedback jitter.
      // EMA smoothing (factor 0.3) prevents the velocity field from flipping sign every frame
      // at wave reversal points, which caused visible jitter in the TransMap pixel warp.
      //
      // ⚠️ All four buffers are GROW-ONLY (D8), and that is a CORRECTNESS fix, not just an allocation
      // one. They were keyed on `length !== n * 2`, and `n` counts wave particles PLUS sparks — a pool
      // whose `activeCount` moves as sparks spawn and expire, i.e. on most frames. Every such change
      // reallocated `fluidSmoothedVel` to zeros, discarding the EMA history for all ~20 000 particles
      // and reintroducing exactly the reversal-point jitter the EMA exists to suppress. Growing and
      // COPYING preserves each existing slot's history, so a single spark spawning no longer disturbs
      // the whole figure. Every consumer takes an explicit `count` and is index-bounded
      // (`seedFromParticles` and `advectParticles` both `subarray(0, count * …)`), so a buffer longer
      // than the live count is safe.
      if (!fluidUVs || fluidUVs.length < n * 2) {
        fluidUVs = new Float32Array(n * 2);
        fluidVelUVs = new Float32Array(n * 2);
      }
      const uvs = fluidUVs;
      const velUVs = fluidVelUVs!;
      if (!fluidSmoothedVel || fluidSmoothedVel.length < n * 2) {
        const grown = new Float32Array(n * 2);
        if (fluidSmoothedVel) grown.set(fluidSmoothedVel);
        fluidSmoothedVel = grown;
      }
      if (!fluidPrevPositions || fluidPrevPositions.length < n * 3) {
        const grown = new Float32Array(n * 3);
        if (fluidPrevPositions) grown.set(fluidPrevPositions);
        fluidPrevPositions = grown;
      }
      // Slots that appeared this frame have no history. Zeroing them makes the displacement they
      // compute exceed the teleport guard below (`dMag < 900`), so they contribute zero velocity for
      // exactly one frame — which is what a full reallocation used to do to EVERY slot. Without this,
      // a new slot would difference against whatever a previous, larger figure left in the buffer.
      if (n > fluidPrevCount) {
        fluidPrevPositions.fill(0, fluidPrevCount * 3, n * 3);
        fluidSmoothedVel.fill(0, fluidPrevCount * 2, n * 2);
      }
      fluidPrevCount = n;
      const emaAlpha = 0.3;
      const edgeMargin = 0.03;
      for (let i = 0; i < n; i++) {
        const px = state.positions[i * 3]!;
        const py = state.positions[i * 3 + 1]!;
        const u = px / w;
        const v = py / h;
        uvs[i * 2]     = u;
        uvs[i * 2 + 1] = v;
        // No `length === n * 3` guard here any more: under grow-only buffers that test is FALSE
        // whenever the figure has ever been larger, which would silently stop seeding the field and
        // leave `velUVs` holding last frame's values. `fluidPrevPositions` is now guaranteed allocated
        // to at least `n * 3` above, and a slot with no history reads zeros and is rejected by the
        // teleport guard below — so the branch is unconditional and `velUVs` is always written for
        // every index the consumer will read.
        const dx = px - fluidPrevPositions[i * 3]!;
        const dy = py - fluidPrevPositions[i * 3 + 1]!;
        const dMag = dx * dx + dy * dy;
        const rawVx = dMag < 900 ? (dx / w) * 0.08 : 0;
        const rawVy = dMag < 900 ? (dy / h) * 0.08 : 0;
        fluidSmoothedVel[i * 2]     = fluidSmoothedVel[i * 2]! * (1 - emaAlpha) + rawVx * emaAlpha;
        fluidSmoothedVel[i * 2 + 1] = fluidSmoothedVel[i * 2 + 1]! * (1 - emaAlpha) + rawVy * emaAlpha;
        // Fade velocity to zero near edges so no energy accumulates at borders
        const ef = Math.min(u, 1 - u, v, 1 - v) / edgeMargin;
        const fade = ef < 1 ? ef * ef : 1;
        velUVs[i * 2]     = fluidSmoothedVel[i * 2]! * fade;
        velUVs[i * 2 + 1] = fluidSmoothedVel[i * 2 + 1]! * fade;
      }

      // Save pure wave positions before advection — these become prevPositions next frame.
      // Allocated (and grown) above; `set` into a longer target is fine.
      fluidPrevPositions.set(state.positions.subarray(0, n * 3));

      // Splat particle velocities into fluid field, then evolve
      fluidProcessor.seedFromParticles(uvs, velUVs, n);
      fluidProcessor.step(dt * speedFactor * 0.001);

      // Accumulate fluid velocity into persistent offsets and apply to uvs in-place
      // Only displace particles when blend > 0 (field may be active solely for TransMap style 6)
      if (fluidProcessor.getBlend() > 0) {
        // `dt` is passed so offset decay is frame-rate independent — see advectParticles. Speed-factored
        // to match `step()` above: slowing the animation must slow the field's return too, or a low
        // Animation Speed would snap particles home while the flow itself crawled.
        fluidProcessor.advectParticles(uvs, n, dt * speedFactor);
        // A crystal's screen position is authoritative — it is projected from a model-space
        // position by the pool, using the figure's own rotation — so this screen-space overwrite
        // must never touch one, or the fluid field would drag the ice off the figure. `n` already
        // excludes the crystal block, so this mask test is belt-and-braces; it is kept because it
        // is the guard that states the invariant, and it costs one hoisted null check when off.
        const fz = state.frozen;
        for (let i = 0; i < n; i++) {
          if (fz && fz[i] === 1) continue;
          state.positions[i * 3]     = uvs[i * 2]! * w;
          state.positions[i * 3 + 1] = uvs[i * 2 + 1]! * h;
        }
      }
    }

    /*
     * ======================= v8 Step 15.7 (E90) — THE ADVECTED DYE FIELD =======================
     *
     * Deposit this frame's particle colours into the field, then advect and decay it by the same velocity
     * field the figure stirs, then hand the result to the renderer. Three calls, unconditional in the sense
     * that matters: they are here from the first commit, which is exactly what triage G14's deletion note
     * required of any rebuild (*"its calls in the frame loop from the first commit, not as dormant methods"*).
     *
     * ⚠️ **PLACED HERE — AFTER `fluidProcessor.step()`, BEFORE THE DRAW — AND THE ORDER IS LOAD-BEARING IN
     * BOTH DIRECTIONS.** After the step, so the dye advects along THIS frame's velocity field rather than
     * last frame's (a one-frame lag would put the dye slightly upstream of the wake that made it, which reads
     * as the coupling being weak rather than as being late). Before the draw, so the liquid surface samples a
     * field that already contains this frame's deposit — otherwise the newest dye is one frame behind the
     * particles that laid it down, and at a low decay that is invisible while at a high one it is a flicker.
     *
     * ⚠️ **`setDyeTexture` IS CALLED IN BOTH DIRECTIONS, EVERY FRAME, OUTSIDE ANY `enabled` GATE** —
     * invariant 3, and the same contract `transMap.setFluidVelocityTexture(...)` follows. A texture handed
     * over once and never withdrawn leaves the renderer holding a handle whose owner may have deleted it, and
     * a `'dye'` tint would then sample freed memory instead of degrading to `'ramp'`. `getDyeTexture()`
     * returns `null` when the field is not running, which is precisely what drives that degrade.
     */
    if (dyeProcessor.isActive()) {
      // ⚠️ `state.waveCount` — the CURVE, excluding sparks, the liquid pool and the crystals. The dye is the
      // FIGURE's trace: including the pool would have the field seeded by the population it moves (15.5's
      // one-direction rule), and including crystals would deposit at authoritative model-space projections
      // that never move, i.e. a permanent bright dot per crystal.
      const dyeCount = Math.max(0, Math.min(state.waveCount ?? state.count, state.count));
      if (dyeCount > 0) {
        resolveDyeColours(state, dyeCount);
        dyeProcessor.inject(state.positions, dyeColours, dyeCount, canvas.width, canvas.height);
      }
      // ⚠️ `getVelocityTexture()` is re-read per frame rather than latched, for the same invariant-3 reason
      // as the handoff below: a `reinitFluid` replaces that texture, and a latched handle would advect
      // against a deleted one. A `null` here leaves the dye standing and still decaying, which is honest.
      dyeProcessor.step(fluidProcessor.getVelocityTexture());
      // ⚠️ **The FBO the dye passes bound must be restored before the draw.** `inject`/`step` both save and
      // restore the framebuffer binding and the viewport themselves, so nothing is needed here — stated
      // because the TransMap flow-field call below DOES need an explicit restore, and the asymmetry is a
      // property of who saves, not an omission at one of the two sites.
    }
    renderer.setDyeTexture(dyeProcessor.getDyeTexture());

    // TransMap Force Field: apply displacement forces to particles.
    //
    // Which force path a chain supports is `transMap.getForceModes()`'s decision, NOT this file's (I9).
    // This block used to re-derive it from `currentTransMapStyle` — `=== 4` to choose `applyIfsForces`,
    // `=== 5` to refresh the flow texture — duplicating the partition `init()`/`apply()` already branch
    // on, in a second file. That is how style 6 came to fall through to the texture path with no
    // displacement texture of its own; see `getForceModes()` for why 6 is a real exclusion.
    //
    // ⚠️ **The old three-member enum became a SET, and any combination of members can be true at once.** A
    // chain holding style 4 AND a field style feeds both paths, which is correct: each function ADDS into
    // `state.positions`, they were never mutually exclusive, and `'ifs' | 'texture' | 'none'` simply had
    // no way to say "both". The order matters only in that `applyIfsForces` must not read a position the
    // field path has already moved this frame — it does not, since both read and write the same array
    // additively.
    //
    // ⚠️ **`texture` and `analytic` are two SOURCES of one force pass, not two passes.** Styles 0-3 moved
    // from `texture` to `analytic` on 2026-08-20 (the 1D rewrite deleted the canvas-sized texture they were
    // read back from), and `sampleForce` sums both sources internally. So the source setters are per-source
    // and `applyForces` is called once, below — not once per source, which would double-count a chain
    // holding both a static layer and the flow layer.
    if (currentTransMapForceBlend > 0 && currentTransMapEnabled) {
      const fractalFade = transMapFractalFade();
      const forceModes = transMap.getForceModes();
      // v8 Step 14.4 — build this frame's per-particle gate BEFORE either force call, and once for both:
      // they are two sources of one displacement (see the note above), so a gate built per call would be
      // built twice from the same state. Inside the blend gate because it reads `state.count` per particle
      // and there is nothing to gate when the force is off.
      applyForceGateState();
      transMapForce.prepareGate(state);
      if (forceModes.ifs) {
        // IFS: CPU-direct per-particle force, no texture readback needed
        transMapForce.applyIfsForces(
          state.positions,
          state.count,
          currentTransMapForceBlend,
          currentTransMapForceReturn,
          dt * speedFactor,
          fractalFade,
          currentIfsParams,
          // LIVE guard: the loop runs over all of `state.count`, which now includes the crystal
          // block. A crystal's screen position is projected from model space by the pool and is
          // authoritative — shoving it here would detach the ice from the figure.
          state.frozen,
        );
      }
      // ⚠️ **The analytic source is installed and cleared on the SAME discipline as the texture one**, and
      // for the same reason: the processor's `active` flag is derived from both sources, and the spark force
      // path above gates on `isActive()` alone. A sampler left installed after the last static layer was
      // removed would keep sparks — and `applyForces` — reading a field the chain no longer contains, which
      // is invariant 3's shape (a flag outliving its resource). Both setters recompute `active` from both
      // fields, so the order of these two blocks does not matter.
      //
      // The closure is hoisted (`staticForceSampler`) rather than written inline: this runs every frame.
      transMapForce.setAnalyticSampler(forceModes.analytic ? staticForceSampler : null);

      if (forceModes.texture) {
        // Refresh the source texture first so the force field reads this frame's data. Self-gated on
        // the chain inside the processor; the return value reports whether it actually drew, since that
        // is what changes the FBO binding we have to restore.
        if (transMap.renderFlowField(elapsedTime, currentProceduralFlow)) {
          // Restore the trail binding (renderFlowField changes the bound FBO).
          // ⚠️ `particleFbo()` rather than `fboState.fboB`: this and its sibling below are two of the four
          // sites that name the particle target, and a hard-coded `fboB` here would be a second resolution of
          // Step 14.6's flag (invariant 17). They are belt-and-braces since 14.6 — the draw head now binds
          // explicitly and nothing draws between here and there — and they are kept for the same reason the
          // fade pass re-asserts its blend function: a restore that states the invariant costs one call.
          gl.bindFramebuffer(gl.FRAMEBUFFER, particleFbo());
          gl.viewport(0, 0, fboState.width, fboState.height);
        }
        const dispTex = transMap.getDisplacementTexture();
        transMapForce.setFlowTexture(dispTex);
        transMapForce.readback();
        // Restore the trail binding after readback (readback uses a temp FBO). See the note above.
        gl.bindFramebuffer(gl.FRAMEBUFFER, particleFbo());
        gl.viewport(0, 0, fboState.width, fboState.height);
      } else {
        // No texture path — a styles-0-3-only chain, a style-6-only one, or an IFS-only one. Must still
        // clear the source, NOT merely skip: `setFlowTexture(null)` is what drops the texture out of
        // `active`, and leaving it after `5 -> 6` would keep sparks sampling the last flow field's stale
        // `rgbaBuffer` — with the readback no longer running, forever.
        //
        // ⚠️ Reached for an IFS-ONLY chain too, which is why this is `else` on `forceModes.texture` and
        // not on "neither mode". Style 4 drives particles from `applyIfsForces` and never populates
        // `rgbaBuffer`, so the same stale-spark leak applies there.
        transMapForce.setFlowTexture(null);
      }

      // ⚠️ **One call for BOTH field sources, gated on either.** It used to live inside the texture branch,
      // which was correct while `texture` meant "any field style"; with styles 0-3 moved to `analytic` that
      // nesting would have left the static force path computing a field nothing ever applied — the silent
      // half of the I9 duplication `getForceModes()` exists to prevent. `sampleForce` sums the two sources
      // internally, so a static+flow chain needs exactly this one pass.
      if (forceModes.texture || forceModes.analytic) {
        transMapForce.applyForces(
          state.positions,
          state.count,
          currentTransMapForceBlend,
          currentTransMapForceReturn,
          dt * speedFactor,
          fractalFade,
          // LIVE guard: the loop runs over all of `state.count`, which now includes the crystal
          // block. A crystal's screen position is projected from model space by the pool and is
          // authoritative — shoving it here would detach the ice from the figure.
          state.frozen,
        );
      }
    }

    // ⚠️ **Step 14.6: the warp runs HERE when `beforeParticles` is set — between the decay and the draw.**
    // It reads `texB` (the faded trail) and writes `fboA`, which the draw below then targets, so this frame's
    // particles land on a warped history without being warped themselves. Placed after the force field so a
    // chain using both still applies this frame's field to the particles before they are drawn.
    if (currentTransMapBeforeParticles) runTransMapPass(state, dt);

    // Bind the particle target EXPLICITLY. It used to be inherited from the decay pass, which is the one
    // assumption a pass permutation breaks — and it would break silently: the particles would keep landing in
    // `fboB` after the warp had already consumed it, so they would reach the screen one frame late and
    // unwarped rather than not at all. `particleFbo()` is the single resolver; see its header.
    gl.bindFramebuffer(gl.FRAMEBUFFER, particleFbo());
    gl.viewport(0, 0, fboState.width, fboState.height);
    gl.enable(gl.BLEND);

    /**
     * Draw an explicit subset of `state` as particles.
     *
     * Extracted from the ribbon-hybrid path because two OTHER paths need it and silently lacked it:
     * `NeonLineRenderer` draws only trail geometry and never a single particle, and the ribbon point
     * pass ran for `hybrid` alone. So with neon on — or ribbons in streaks/adaptive — the spark block
     * had NO draw path at all and sparks simply vanished, even though the pool was simulating them.
     *
     * Sparks are the case that matters: they are screen-space embers with no useful trajectory, so no
     * trajectory renderer will ever draw them, yet they must still appear.
     */
    /*
     * H5 — the five per-frame gather buffers are hoisted into the grow-only `subset*` scratch above, and
     * `fillSparkIndices()` no longer builds a boxed `number[]` per frame.
     *
     * ⚠️ The triage row framed this as allocation TIME, and that is negligible: measured against a
     * persistent-scratch equivalent, the five allocations cost **0.002-0.040 ms** at realistic spark
     * counts, against a 16.7 ms frame. What is real is GC churn — with the crystal pass, 53 KB/frame at
     * 600 crystals + 500 sparks rising to 189 KB/frame at 2000 + 2000, i.e. **3.1-11.1 MB/s** of garbage
     * that arrives as an unpredictable hitch rather than as per-frame cost. Do not re-derive this item
     * from "allocation is slow".
     *
     * `idx` stays `ArrayLike<number>` because the two callers supply different shapes and neither should
     * be forced to convert: `fillSparkIndices()` fills a dense `Int32Array` scratch, while
     * `ribbonRenderer.getPointIndices()` returns its own persistent `number[]`. Hence the explicit `n` —
     * a grow-only scratch is longer than its live prefix, so `idx.length` is not the count.
     */
    const drawParticleSubset = (idx: ArrayLike<number>, n: number): void => {
      if (n === 0) return;
      if (subsetPos.length < n * 3) {
        subsetPos = new Float32Array(n * 3);
        subsetCol = new Float32Array(n * 3);
      }
      if (subsetDep.length < n) {
        subsetDep = new Float32Array(n);
        subsetVel = new Float32Array(n);
      }
      // Carry the crystal mask so the additive point pass can never redraw a slot the crystal pass
      // already drew — that would put a glowing dot inside its own faceted ice.
      const wantFrozen = state.frozen !== undefined;
      if (wantFrozen && subsetFrozen.length < n) subsetFrozen = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const pi = idx[i]!;
        subsetPos[i * 3] = state.positions[pi * 3]!;
        subsetPos[i * 3 + 1] = state.positions[pi * 3 + 1]!;
        subsetPos[i * 3 + 2] = state.positions[pi * 3 + 2]!;
        subsetCol[i * 3] = state.colors[pi * 3]!;
        subsetCol[i * 3 + 1] = state.colors[pi * 3 + 1]!;
        subsetCol[i * 3 + 2] = state.colors[pi * 3 + 2]!;
        subsetDep[i] = state.depths[pi]!;
        subsetVel[i] = state.velocities[pi]!;
        if (wantFrozen) subsetFrozen[i] = state.frozen![pi]!;
      }
      gl.blendFunc(renderer.isAdditiveBlend() ? gl.ONE : gl.SRC_ALPHA,
                   renderer.isAdditiveBlend() ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      // Sliced to exactly `n`, not passed whole. A scratch buffer keeps the high-water mark of every
      // earlier frame, and uploading that would both waste bandwidth and hand the renderer arrays whose
      // length disagrees with `count` — the shape its own `array.length < state.count` guards test.
      perfHud?.begin('particles');
      renderer.render({
        positions: subsetPos.subarray(0, n * 3), colors: subsetCol.subarray(0, n * 3),
        depths: subsetDep.subarray(0, n), velocities: subsetVel.subarray(0, n), count: n,
        ...(wantFrozen ? { frozen: subsetFrozen.subarray(0, n) } : {}),
      }, target);
      perfHud?.end('particles');
    };

    /**
     * Fill `sparkIdx` with the spark block `[waveCount, count - crystalCount)` and return its length.
     * Zero when sparks are off.
     *
     * Returns a count rather than the array so the caller cannot read a stale reference: `sparkIdx` is
     * reassigned when it grows, so it must be read AFTER this runs, not captured as an argument
     * alongside the call.
     */
    const fillSparkIndices = (): number => {
      const wave = state.waveCount ?? state.count;
      // ⚠️ **v8 15.5 — THIS SITE DELIBERATELY DOES *NOT* SUBTRACT `liquidCount`, WHICH IS THE OPPOSITE
      // DECISION FROM THE SHADER'S `uSparkLast` FOR THE SAME-LOOKING EXPRESSION.** The discriminator is
      // what the index means to its consumer:
      //
      // - `uSparkLast` bounds a range over the PUBLISHED arrays, where `gl_InstanceID` is a slot index, so
      //   a range that reached into the pool would size pool particles as sparks. It subtracts both.
      // - This range is a GATHER LIST for `drawParticleSubset`, whose job is "draw every drawable slot no
      //   trajectory renderer covers". Neon and ribbon now exclude BOTH tail blocks, so the pool is one of
      //   the blocks nothing else draws — subtracting it here would leave it invisible under neon and under
      //   ribbon streaks/adaptive, while the point path still showed it. Invariant 13's shape, arriving as
      //   a population that exists, simulates and is simply never drawn.
      //
      // The gather is also why widening the range cannot mis-size anything: `drawParticleSubset` builds a
      // COMPACTED sub-state carrying no `waveCount`, so `sparkOn` is false and every slot draws at the
      // material radius. The name is therefore narrower than the range — read the comment, not the name.
      const end = state.count - (state.crystalCount ?? 0);
      if (end <= wave) return 0;
      const n = end - wave;
      if (sparkIdx.length < n) sparkIdx = new Int32Array(n);
      for (let i = 0; i < n; i++) sparkIdx[i] = wave + i;
      return n;
    };

    /** `drawParticleSubset` over the spark block. Two-step so the grown `sparkIdx` is read, not a stale one. */
    const drawSparkSubset = (): void => {
      const n = fillSparkIndices();
      drawParticleSubset(sparkIdx, n);
    };

    // Draw the crystals BEFORE the renderer branch below.
    //
    // The branch is neon-lines OR ribbons OR the particle renderer, and the crystal pass lives
    // inside HDRParticleRenderer.render() — so enabling ribbon or neon mode used to bypass it
    // entirely and crystals silently disappeared. Drawing here covers all three paths.
    //
    // Crystal-first also preserves the intended occlusion order (ice blocks the glow behind it),
    // and is safe because every branch sets its own blendFunc before drawing. Neon and ribbon are
    // trajectory renderers and now exclude the crystal block outright (`state.crystalCount`) — a
    // crystal has no trajectory. Self-guarded: free when crystal is disabled or the pool is empty.
    /*
     * v8 28.5 (`28.D3`, `28.D9`, `28.D11`) — hand the renderer this frame's curve cull.
     *
     * ⚠️ **THE FORCE-TRUE LIVES HERE AND NOWHERE ELSE.** `showFigure` is honoured only while the dye is
     * actually on screen, so a preset cannot author a hidden figure with no dye and reach a black frame
     * with nothing to explain it. ⚠️ **The UI row is NOT disabled when that happens** — rows disabled
     * behind a gate is a standing never-re-propose; the stored value is what you set BEFORE the gate.
     *
     * ⚠️ **Written EVERY FRAME, which is why there is NO `reapplyRendererState()` entry for it** — unlike
     * `setSplatShear`, which is handed over once and therefore must be re-handed after a rebuild. The
     * threshold is derived from `state.waveCount`, per-frame data, so **the per-frame write IS the
     * re-hand**; a second one in `reapplyRendererState` would be a duplicate owner of one value.
     *
     * ⚠️ **0 is the identity** — no index is below 0, so every pre-28 preset is byte-identical.
     */
    renderer.setHideCurve(dyeHidesFigure() ? (state.waveCount ?? 0) : 0);

    /*
     * v8 28.1 (`28.D6`) — **THE DYE OVERLAY. ITS POSITION IN THIS FUNCTION IS THE DECISION.**
     *
     * ⚠️ **HERE, BEFORE THE CRYSTAL PASS AND THE RENDERER BRANCH, so the dye is a BACKGROUND.** ⚠️ **NOT
     * the physarum overlay's slot below**, which sits on the far side of the renderer branch and
     * therefore VEILS the figure — with `'over'` blending that difference is plainly visible, because
     * the composite attenuates its destination by `(1 - a)`.
     *
     * ⚠️ **`particleFbo()`, never `fboState.fboB`** — the same rule the physarum overlay carries: Step
     * 14.6 can move the particle target, and hard-coding `fboB` would send the dye into the buffer the
     * warp had already consumed, so it would vanish entirely under `beforeParticles`.
     *
     * ⚠️ **It is therefore WARPED by TransMap and TRAILED by the decay pass, both by construction**
     * (`28.D12`): Stage 7 reads the whole image, and anything in the ping-pong is read by the next
     * frame's decay pass. Neither is adjustable from here — moving the pass to escape the trail would
     * lose the warp and the grading with it.
     */
    if (dyeOverlayActive()) {
      dyeProcessor.renderOverlay(particleFbo(), canvas.width, canvas.height);
    }

    renderer.renderCrystalOnly(state);

    if (linesEnabled) {
      // Draw neon lines additively into trail buffer (fboB is bound)
      gl.blendFunc(gl.ONE, gl.ONE);
      /*
       * v8 28.5 — ⚠️ **THE TRAJECTORY RENDERERS NEED THEIR OWN ANSWER: the cull uniform cannot reach
       * them.** It lives in `hdr-particle.ts` only, and neon draws its own program over its own
       * geometry. Neon draws TRAIL GEOMETRY of the curve and nothing else, so hiding the curve means
       * skipping the whole call.
       *
       * ⚠️ **`drawSparkSubset()` BELOW MUST STILL RUN**, and that is the defect this call site already
       * carries a warning about: neon never draws a single particle, so sparks had no draw path here at
       * all and *vanished whenever neon was enabled*. Skipping the sparks too would re-make it.
       */
      perfHud?.begin('lines');
      if (!dyeHidesFigure()) neonLineRenderer.render(state, target);
      perfHud?.end('lines');
      // Neon draws trail geometry ONLY — never a single particle. Sparks therefore had no draw path
      // here at all and vanished whenever neon was enabled, despite the pool still simulating them.
      drawSparkSubset();
    } else if (ribbonState !== 'off') {
      // Draw ribbons (additive)
      gl.blendFunc(gl.ONE, gl.ONE);
      ribbonRenderer.setAttractorBlend(currentAttractorIndex >= 0 ? currentBlend : 0);
      // v8 28.5 — the ribbon pass is the curve's trajectory, so a hidden curve skips it. See the neon
      // branch above for why the spark draws below must survive this.
      perfHud?.begin('ribbons');
      if (!dyeHidesFigure()) ribbonRenderer.render(state, target);
      perfHud?.end('ribbons');

      // Draw everything the ribbon pass did NOT: the non-ribboned wave particles in hybrid mode,
      // and in EVERY mode the spark block (screen-space embers with no trajectory, so no ribbon
      // renderer will ever draw them). The point pass previously ran for `hybrid` only, which is why
      // sparks vanished under streaks and adaptive.
      if (ribbonState === 'hybrid' && !dyeHidesFigure()) {
        const pts = ribbonRenderer.getPointIndices();
        drawParticleSubset(pts, pts.length);
      } else {
        /*
         * v8 28.5 — ⚠️ **THIS BRANCH NOW ALSO SERVES HIDDEN-CURVE HYBRID, and that is why the condition
         * above gained `&& !hideCurve` rather than the subset draw gaining a guard.** The hybrid subset
         * is `getPointIndices()` — the non-ribboned WAVE particles, i.e. curve geometry, which must go
         * with the rest of the figure. ⚠️ **It cannot be fixed by the cull uniform either: that subset is
         * re-packed ZERO-BASED, so `render()` deliberately suppresses the cull for it** (see its own
         * note). Falling through to the spark-only draw is the one path that hides the curve and keeps
         * the embers.
         */
        drawSparkSubset();
      }
    } else {
      if (renderer.isAdditiveBlend()) {
        gl.blendFunc(gl.ONE, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      // ⚠️ `dt * 0.001` — `dt` here is MILLISECONDS and the renderer's smoother is specified in SECONDS
      // (v8 15.1b, `LIQUID_REF_TAU_SECONDS`). Unconverted, τ becomes 250 frames and the liquid density
      // reference never catches the figure, which reads as the smoothing being inert rather than as a units
      // error — the same load-bearing conversion `depthField.render(…, dtMs * 0.001)` carries at line 753.
      // NOT speed-factored: this is real wall-clock smoothing of a measurement, not simulation time.
      perfHud?.begin('particles');
      renderer.render(state, target, dt * 0.001);
      perfHud?.end('particles');
    }

    // Physarum trail overlay — updateTrail was already called inside generator.update()
    // at the same model-space UVs used for sensing, so deposit and sensing share one coordinate space.
    // ⚠️ `particleFbo()`, not `fboState.fboB`: the overlay is part of the particle draw and must follow it
    // into whichever buffer Step 14.6 put it in. Hard-coding `fboB` would send the physarum trail into the
    // buffer the warp had already consumed, so it would vanish entirely under `beforeParticles`.
    if (physarumProcessor.isActive() && currentPhysarum.showTrail) {
      physarumProcessor.renderOverlay(gl, particleFbo(), canvas.width, canvas.height);
    }

    // Step 3: TransMap — read FBO-B, write to FBO-A (pixel warping).
    // ⚠️ SKIPPED HERE when the warp runs first (Step 14.6) — it already ran above, before the draw.
    if (!currentTransMapBeforeParticles) runTransMapPass(state, dt);

    /*
     * Step 3b: the reel cross-fade (v8 Phase 19, S2).
     *
     * ⚠️ **PRE-BLOOM, PRE-GRADE, AND THAT IS THE WHOLE DESIGN.** The freeze was captured from `fboState.texA`,
     * so mixing here means the frozen outgoing figure goes through bloom, tone map and the film look together
     * with the live incoming one — a single graded image, not two graded images added. Mixing after the grade
     * makes the overlap visibly brighter than either side, which reads as a bloom bug.
     *
     * ⚠️ **`presentSource` exists because there are THREE present branches below and one of them named
     * `fboState.texA` literally.** Any future branch must read this variable: a branch that goes back to
     * `fboState.texA` loses the cross-fade on exactly the presets that reach it — the low-grading ones
     * (`inertGrading()` turns bloom and the tone map off), which are also the ones a transition is judged on.
     *
     * `hasCapture()` is tested rather than assumed, so a failed capture (a shader compile, an incomplete FBO,
     * a canvas resize mid-transition) degrades to a hard cut instead of to a black frame.
     */
    let presentSource = fboState.texA;
    if (reelFreezeWeight > 0 && reelCrossfade?.hasCapture()) {
      presentSource = reelCrossfade.mix(presentSource, reelFreezeWeight, canvas.width, canvas.height);
    }
    /*
     * v8 Phase 40 — Electric Discharge, PRE-BLOOM so its filaments glow and grade with the rest. ⚠️ A BRANCH: off,
     * `presentSource` is not touched, so every preset without the effect is bitwise what it was. It reads
     * `presentSource` (not `fboState.texA`) for the cross-fade's reason above, and never writes the trail.
     */
    if (discharge.enabled) {
      perfHud?.begin('discharge');
      presentSource = electricDischarge.apply(presentSource, canvas.width, canvas.height, discharge, elapsedTime);
      perfHud?.end('discharge');
    }

    // Step 4: Post-processing (bloom + tone map) or direct blit
    if (bloom.isEnabled() || toneMap.isEnabled()) {
      let srcTex = presentSource;

      // ⚠️ G5 (2026-11-12): with bloom AND the grade on, the glow is added INSIDE the grade (`ToneMap.apply`'s
      // `bloomTex`, bloom's own composite formula) — the composite's full-resolution half-float write into `postFBO`
      // and the grade's read of it are skipped. Under `?gldiag=1` the old path stays: its probe scans `postFBO`.
      const fuseGlow = bloom.isEnabled() && toneMap.isEnabled() && !glDiagEnabled;
      let glowTex: WebGLTexture | null = null;
      if (fuseGlow) {
        perfHud?.begin('glow');
        if (bloom.buildPyramid(srcTex)) glowTex = bloom.glowTexture();
        perfHud?.end('glow');
      } else if (bloom.isEnabled()) {
        // Bloom composites scene + bloom → postFBO
        perfHud?.begin('glow');
        bloom.apply(srcTex, postFBO.fbo);
        perfHud?.end('glow');
        srcTex = postFBO.tex;
      }

      if (toneMap.isEnabled()) {
        // Tone map to screen (adding the glow itself when fused)
        perfHud?.begin('grade');
        toneMap.apply(srcTex, null, glowTex, glowTex ? bloom.glowIntensity() : 0);
        perfHud?.end('grade');
      } else {
        // Blit post-processed to screen
        perfHud?.begin('present');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.disable(gl.BLEND);
        gl.useProgram(blitProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srcTex);
        gl.uniform1i(uBlitTex, 0);
        gl.bindVertexArray(blitVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        perfHud?.end('present');
      }
    } else {
      // Legacy path: direct blit FBO-A to screen — ⚠️ `presentSource`, NOT `fboState.texA`. See Step 3b above.
      perfHud?.begin('present');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(blitProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, presentSource);
      gl.uniform1i(uBlitTex, 0);
      gl.bindVertexArray(blitVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      perfHud?.end('present');
    }

    // Performance guard + Evolution tile rendering + Preview grid tiles
    //
    // ⚠️ **Two readings of the guard, and they are not interchangeable** (2026-09-24). `tilesFrozen()` is level
    // 2 and skips the tick entirely — the old boolean's whole behaviour, now reserved for below 15 fps.
    // `tileThrottle()` is level 1 and divides each grid's STEADY budget, so the grids keep filling and keep
    // animating slowly instead of stopping dead mid-warm-up. Freezing a warming tile is what produced "the
    // previews never start animating": a frozen tile has no warm-up left to finish.
    perfGuard.tick(time);
    {
      // ⚠️ v8 performance pass (owner, 2026-11-10): level 2 no longer SKIPS the tick — it passes `Infinity`, the
      // renderers' FIRST-IMAGES-ONLY mode (no animation, but every tile still reaches an image). Skipping it is what
      // left a slow machine's grid blank or frozen mid-warm-up. Each renderer also scales its own animation budget
      // by the main loop's measured headroom (`GridTileRenderer.tick`), so this guard is the coarse tier only.
      const tileThrottle = perfGuard.tilesFrozen() ? Number.POSITIVE_INFINITY : perfGuard.tileThrottle();
      perfHud?.begin('tiles');
      evoTileRenderer.tick(dt, tileThrottle);
      historyTileRenderer.tick(dt, tileThrottle);
      reelTileRenderer.tick(dt, tileThrottle);
      previewGrid.tick(dt, tileThrottle);
      perfHud?.end('tiles');
      perfHud?.frame(rawFrameMs);
      perfRun?.frame(time, rawFrameMs);
    }
    // ⚠️ NO `requestAnimationFrame` here. The re-arm lives in `drawFrame`'s `finally` — see the note there.
    // Re-adding one here would double the frame rate AND restore the "one throw kills the canvas" failure for
    // every line above it.
  }

  // Clear FBOs initially
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboState.fboA);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboState.fboB);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  /**
   * v8 Step 21.4a/21.4c — **the ONE place the resolved palette selection reaches the pipeline.**
   *
   * Three call sites push the palette today (`applyFilmLook`, `applyCustomParam`, `reapplyRendererState`)
   * and each used to read `look.palette` / `look.paletteMapping` directly. With the overlay as a second
   * source that would be three independent `??` chains — invariant 17's exact shape, and the reason its
   * write-up says *grepping the readers exonerated the buggy file*: every one of those three would have
   * looked right. So they all call this, and this calls the resolver once.
   *
   * ⚠️ **Four consumers, and the `index` mapping splits them 3 + 1.** The renderer, the ribbon and the neon
   * line renderers get `shaderPalette`, which is `'none'` under `index`; the GENERATOR gets `indexPalette`,
   * which is non-null only under `index`. That split is decided inside `resolvePaletteSelection` and must
   * not be re-derived here — if a caller ever hands the renderer the resolved NAME while the generator also
   * has an index palette, both colour systems run and the LUT wins, which looks like a correct picture of
   * the wrong palette.
   *
   * ⚠️ **`fp` is the film look that is LIVE, not `customFilmLookParams` unconditionally.** Under a named
   * look `applyCustomParam`'s early return leaves patched fields in `customFilmLookParams` that are not
   * applied, so reading it here would resurrect a patch the rest of the engine ignored.
   */
  function applyPaletteSelection(fp: { palette: string; paletteMapping: PaletteMapping }): void {
    const sel = resolvePaletteSelection(
      { palette: overlayPalette, paletteMapping: overlayPaletteMapping },
      fp,
    );
    livePaletteSelection = sel;
    renderer.setFilmLook({ palette: sel.shaderPalette, paletteMapping: sel.shaderMappingInt });
    for (const tr of [ribbonRenderer, neonLineRenderer]) {
      tr.setPalette(sel.shaderPalette);
      tr.setPaletteMapping(sel.mapping);
    }
    generator.setIndexPalette(sel.indexPalette);
    /*
     * v8 `26.4` — the rotation goes to the same four consumers, from the same one place.
     *
     * ⚠️ **IT IS APPLIED TO THE RESOLVED SELECTION AND NEVER BY RE-DERIVING WHICH PALETTE WON** (`26.D5`,
     * and `palettecheck` §F bans `main.ts` from reading a palette source). The rotation does not change
     * WHICH palette is in force, only where it is sampled — so it is pushed unconditionally, exactly as
     * the mapping is, and the `index` split above decides who actually reads it.
     *
     * ⚠️ **The ribbon/neon path and the point shader must receive the SAME number** or `hybrid` mode
     * shows a seam rather than a wrong colour — see `TrajectoryPalette.setHueShift`.
     */
    renderer.setPaletteHueShift(overlayPaletteHueShift);
    for (const tr of [ribbonRenderer, neonLineRenderer]) tr.setHueShift(overlayPaletteHueShift);
    generator.setIndexHueShift(overlayPaletteHueShift);
  }

  /**
   * The film look that is LIVE — the `fp` argument `applyPaletteSelection()` must be given when the caller
   * is a UI setter rather than `applyFilmLook` itself.
   *
   * ⚠️ **`customFilmLookParams` is NOT the answer under a named look.** It is a SEED for Customize, and
   * `applyCustomParam`'s early return means it can hold patched fields the engine never applied. Reading it
   * unconditionally would make an overlay-palette edit resurrect one of those patches — a change to control A
   * moving the thing control B names, with nothing in between to blame.
   */
  function liveFilmLookParams(): FilmLookParams {
    if (currentFilmLook === CUSTOMIZE_FILM_LOOK) return customFilmLookParams;
    return (FILM_LOOKS as Record<string, FilmLookParams | undefined>)[currentFilmLook]
      ?? customFilmLookParams;
  }

  /*
   * v8 Step 21.4c — the overlay palette pair's two WRITERS, hoisted out of `visualFxControls` by `21.4g`
   * so the look-adoption below can share them instead of re-implementing the preset write.
   *
   * ⚠️ **`''` (`PALETTE_UNSET`) and `undefined` are the SAME state and `'none'` is a different one.** The
   * setters normalise `''` back to `undefined` because `resolvePaletteSelection` tests the MAPPING with `??`
   * alone (there is no sentinel for a mapping — the union has no empty member) and would treat `''` as a
   * mapping named "". Both directions of that normalisation live here and nowhere else.
   *
   * ⚠️ **Deleting the key rather than storing `undefined`**, because `exactOptionalPropertyTypes` is on and
   * because an export gate that tests `ov.palette !== undefined` would otherwise emit `"palette": undefined`
   * — which `JSON.stringify` drops from an object but not from the Snapshot's structured clone. The gate is
   * value-based for the same reason the format rule says a mode-only gate is a defect.
   */
  function applyOverlayPalette(name: string): void {
    overlayPalette = name === PALETTE_UNSET ? undefined : name;
    if (preset) {
      if (!preset.overlay) preset.overlay = {};
      if (overlayPalette === undefined) delete preset.overlay.palette;
      else preset.overlay.palette = overlayPalette;
    }
    applyPaletteSelection(liveFilmLookParams());
    // The trail LUT resolver reads the RESOLVED palette, so this override is one of its four documented
    // inputs — see `applyPhysarumTrailColour`. ⚠️ **Order: the resolution first.** Reversed, the trail would
    // be handed the PREVIOUS selection and an `'(Auto)'` trail would lag one edit behind the figure.
    applyPhysarumTrailColour();
  }

  function applyOverlayPaletteMapping(m: PaletteMapping | ''): void {
    overlayPaletteMapping = m === '' ? undefined : m;
    if (preset) {
      if (!preset.overlay) preset.overlay = {};
      if (overlayPaletteMapping === undefined) delete preset.overlay.paletteMapping;
      else preset.overlay.paletteMapping = overlayPaletteMapping;
    }
    applyPaletteSelection(liveFilmLookParams());
    // NOT an input to the trail resolver: the mapping decides how a particle picks a texel, not what the
    // ramp contains (the same asymmetry `applyCustomParam` documents).
  }

  /**
   * # v8 Step 21.4g — *choosing a film look chooses its palette*
   *
   * The owner's rule, verbatim in intent: there is **one** palette area, a film look (or a material that
   * brings one) **sets** the palette there, and the user can still override it afterwards. So this is the
   * materialisation step — it writes the live look's pair into the override, where every reader already
   * looks, and the UI's single `Palette` row then shows the palette that is actually in force.
   *
   * ## Why it is NOT inside `applyFilmLook`, which would be the obvious place
   *
   * ⚠️ **Only a USER choosing a look may materialise.** `applyFilmLook` is also the preset-load path
   * (`applyPresetChange`) and the Lab-Reset/revert path, and on those two the look is not a choice — it is
   * what the preset already says. Materialising there would write `overlay.palette` +
   * `overlay.paletteMapping` into **every** preset the moment it loaded, so every Export and every Snapshot
   * would gain two fields the preset never authored, pinning it against any look picked later and making
   * `MigrationLayer.adoptIndexPalette`'s idempotence exit (which tests exactly those two fields) fire on
   * bodies it was written to adopt. It would also be invariant 17's forbidden shape for real: writing a
   * resolved value back over a source, on a path that runs before the user has done anything.
   *
   * The three call sites are therefore the three ways a user picks a look: the Visual FX `Look` dropdown
   * (`visualFxControls.setFilmLook`), the number-key shortcut, and a material's `presentation.filmLook`
   * (which reaches `setFilmLook` from the Materials tab). **Order: after `applyFilmLook`**, which is what
   * re-seeds `customFilmLookParams` from a named bundle — before it, `liveFilmLookParams()` still describes
   * the look being replaced. `palettecheck` §H asserts both halves, because a call moved one line up reads
   * as a working feature that adopts the wrong palette.
   *
   * ## ⚠️ "Sets the palette" only where the look HAS one
   *
   * Three of the bundles (`Legacy`, `Legacy Graded`, `Cinematic`) carry `palette: 'none'`, which means *this
   * bundle makes no colour decision* — and `Customize` inherits that word whenever it is seeded from one of
   * them. Adopting it would overwrite the preset's own palette with "there is no palette", so
   * `lookPaletteForAdoption` returns `null` in that case and this function returns without writing. Owner
   * report and the full reasoning: that function's header.
   *
   * ## Accepted cost
   *
   * Two writes ⇒ `applyPaletteSelection()` runs twice and `applyPhysarumTrailColour()` once. That is a
   * dropdown handler, not a frame path, and the alternative is a third copy of the preset-write logic —
   * i.e. a second owner of the thing `21.4c` made one. Left as two calls deliberately.
   */
  function adoptLookPalette(): void {
    const pair = lookPaletteForAdoption(liveFilmLookParams());
    // ⚠️ **`null` means the look carries no palette, and then this function must write NOTHING** — not
    // `'none'`, not `PALETTE_UNSET`. Either write would erase the preset's own selection, which is the
    // defect the owner reported on 2026-09-19 (`Spiritual` losing `Cycle: Indigo` + `index` the moment
    // `Legacy Graded` or `Customize` was picked). `lookPaletteForAdoption`'s header owns the reasoning; the
    // early return is the whole fix and it must stay ABOVE both writes, because they are a pair.
    if (!pair) return;
    applyOverlayPalette(pair.palette);
    applyOverlayPaletteMapping(pair.paletteMapping);
  }

  // Apply a film look to all rendering subsystems
  function applyFilmLook(name: string): void {
    let look: FilmLookParams;
    if (name === CUSTOMIZE_FILM_LOOK) {
      look = customFilmLookParams;
      currentFilmLook = CUSTOMIZE_FILM_LOOK;
    } else {
      // `name` is a runtime string (dropdown value, preset field, keyboard shortcut), so the index is
      // widened deliberately here and the `if (!named)` below is the real guard. FILM_LOOKS is declared
      // with `satisfies` so its KEY type stays precise — ⚠️ **its one compile-checked caller,
      // `ArchetypeDef.filmLook`, was deleted with the Archetypes tab on 2026-10-04, so the `satisfies`
      // now protects only future authoring sites. Keep it:** replacing it with a `Record<string, …>`
      // annotation is the change that silently re-accepts a look name that can never be found.
      const named = (FILM_LOOKS as Record<string, FilmLookParams | undefined>)[name];
      if (!named) return;
      look = named;
      currentFilmLook = name;
      // Seed customFilmLookParams from this named bundle so Customize starts from here
      customFilmLookParams = { ...named };
    }

    renderer.setFilmLook({
      glow: look.glow,
      depthSize: look.depthSize,
      depthBrightness: look.depthBrightness,
      depthDof: look.depthDof,
      depthColorShift: look.depthColorShift,
      lightingMode: look.lightingMode,
      lightDir: look.lightDir,
      rimPower: look.rimPower,
      // `palette`/`paletteMapping` are deliberately ABSENT from this payload. They have two sources as of
      // `21.4c`, so they go through `applyPaletteSelection()` below — which also reaches the two trajectory
      // renderers and the generator, the other three consumers.
    });

    // The palette, for all four consumers at once.
    //
    // ⚠️ Until 21.4c this was `renderer.setFilmLook({palette})` plus a hand-written loop over the two
    // trajectory renderers, because `setFilmLook` reaches `HDRParticleRenderer` alone and ribbon/neon
    // therefore dropped the palette silently — invisible in ribbon `hybrid` mode (200 ribbons, everything
    // else drawn by the palette-aware point pass) but total in `streaks`/`adaptive` and in neon, which
    // ribbon/line EVERY particle, so the film look looked ignored while bloom, exposure and tone-map kept
    // responding. Reported 2026-08-06. That loop now lives in `applyPaletteSelection` with the generator
    // beside it, so a fifth consumer is added in one place.
    applyPaletteSelection(look);

    bloom.dispose();
    bloom.init(gl, {
      enabled: look.bloomEnabled,
      threshold: look.bloomThreshold,
      intensity: look.bloomIntensity,
      radius: 5,
      levels: 5,
    });
    bloom.resize(canvas.width, canvas.height);

    toneMap.dispose();
    toneMap.init(gl, {
      enabled: look.toneMapEnabled,
      curve: look.toneMapCurve,
      exposure: look.exposure,
      lift: look.lift,
      gamma: look.gamma,
      gain: look.gain,
      saturation: look.saturation,
      vignette: look.vignette,
    });
    toneMap.resize(canvas.width, canvas.height);

    // v8 Step 9.3 — the film look's palette is one of `'(Auto)'`'s four inputs, so a look change must
    // re-resolve the physarum trail LUT. Placed AFTER `customFilmLookParams` has been reseeded above,
    // which is what the resolver reads. Inert on every other `trailColour` value.
    applyPhysarumTrailColour();

    // `debug`, like the three sibling action traces below (preset change, panel mode). These fire on every
    // user interaction and record that a control WORKED — useful for reconstructing what a reporter did, and
    // pure volume next to a fault. Verbose level keeps them.
    console.debug(`Film Look: "${name}"`);
  }

  /**
   * v8 Step 9.3 — resolve `currentPhysarum.trailColour` to a LUT and hand it to the processor.
   *
   * ⚠️ **THE ONE READER, per invariant 17.** `PhysarumProcessor.setTrailLut()` takes bytes or null and
   * knows nothing about palettes, materials or `'(Auto)'`; the processor cannot see the film look or the
   * material at all. **Do not add a second resolution inside `physarum.ts` — a setting with two sources
   * needs every reader to resolve them in the same order, and one reader satisfies that by construction.**
   *
   * ⚠️ **`'(Auto)'`'s order MIRRORS the engine's existing `palette > material ramp > preset colour`
   * precedence and is not a new one.** It is deliberately the same one-line shape `buildDyeColours()` uses
   * for its `'depth'`/`'temperature'` sources (`currentMaterial?.colourRamp ?? …`), with the palette tried
   * first because that is where the precedence puts it. A DIFFERENT order here would be invariant 17's
   * defect even though every individual branch reads a correct value.
   *
   * ⚠️ **Reads `livePaletteSelection.name` — the RESOLVED palette, not a source.** Until 2026-09-18 this read
   * `customFilmLookParams.palette`, which was the live palette while the film look was the only source. `21.4a`
   * gave the palette a SECOND source (`overlay.palette`) and left this reader behind: selecting a palette in
   * Visual FX → Colour Palette moved the figure and not the trail, and an `'(Auto)'` trail kept the look's
   * palette — invariant 17's exact shape, *two sources ⇒ every reader resolves them in the same order*, and
   * the second reader 21.4a missed (the preview grid was the first). **The resolution is `resolvePaletteSelection`'s
   * alone; this function may not re-derive it and may not read either source directly.**
   *
   * ⚠️ **`sel.name`, never `sel.shaderPalette`.** Under the `index` mapping `shaderPalette` is `'none'` by
   * construction — that is how the LUT path is switched off for the three shader consumers — so reading it
   * here would blank the trail's palette branch on every `index` body while the figure was visibly palette-
   * coloured. `name` is the resolved NAME and is mapping-independent, which is also why the MAPPING is still
   * not an input to this resolver (`setOverlayPaletteMapping` says so from the other side).
   *
   * ⚠️ **`livePaletteSelection` is only as fresh as the last `applyPaletteSelection()`**, so every call site
   * that pushes a palette must be followed by `applyPhysarumTrailColour()` — the ORDER matters and it is
   * `applyPaletteSelection()` first. The two `9.3` comments elsewhere in this file that assert *no call here*
   * are claims about that order, not omissions.
   *
   * ⚠️ **`'none'` is a real palette value and must fall THROUGH to the material ramp, not resolve to a
   * black LUT** — 3 of the 15 named looks are `palette: 'none'`, so treating it as a name would make
   * `'(Auto)'` blank the trail on exactly the looks most likely to be active.
   *
   * Degrades to the fixed orange (`null`), never to black, in every unresolvable case — the rule the dye's
   * own `'dye'` source follows.
   */
  function resolvePhysarumTrailLut(): Uint8Array | null {
    const choice = currentPhysarum.trailColour ?? PHYSARUM_TRAIL_COLOUR_PRESET;
    if (choice === PHYSARUM_TRAIL_COLOUR_PRESET) return null;
    if (choice !== PHYSARUM_TRAIL_COLOUR_AUTO) return getPaletteLUT(choice);

    const palette = livePaletteSelection.name;
    if (palette && palette !== 'none' && palette !== PALETTE_UNSET) {
      const lut = getPaletteLUT(palette);
      if (lut) return lut;
    }
    // The material's ramp reached through `getPaletteLUT` rather than `getColourRampData` directly, so this
    // function has ONE lookup path and the prefix rule stays in `palettes.ts` where it is owned.
    if (currentMaterial && currentMaterial.preset !== 'None') {
      return getPaletteLUT(`${MATERIAL_RAMP_PREFIX}${currentMaterial.colourRamp}`);
    }
    return null;
  }

  /**
   * Push the resolved trail LUT — the ONE call site pattern, so no caller resolves anything itself.
   *
   * ⚠️ **Must be re-run whenever an INPUT to the resolver moves, not only when `trailColour` does**, or
   * `'(Auto)'` silently describes the previous film look / material. The four inputs are `trailColour`
   * itself, **the resolved palette selection** (which since `21.4a` has two sources — the film look and
   * `overlay.palette`, folded together by `applyPaletteSelection()`), the material, and the preset (which
   * can change all three at once).
   *
   * ⚠️ **Reading the RESOLVED value made one of those call sites safer, not riskier.** Under a named look
   * `applyCustomParam`'s early return leaves a palette patch in `customFilmLookParams` unapplied; the old
   * reader would have honoured it here alone, and the resolved cache cannot, because nothing wrote it.
   */
  function applyPhysarumTrailColour(): void {
    physarumProcessor.setTrailLut(resolvePhysarumTrailLut());
  }

  // Apply a single param change in Customize mode — uses lightweight setParams to avoid GPU realloc
  function applyCustomParam(patch: Partial<FilmLookParams>): void {
    Object.assign(customFilmLookParams, patch);
    if (currentFilmLook !== CUSTOMIZE_FILM_LOOK) return;

    // Renderer params (always lightweight)
    const r: Parameters<typeof renderer.setFilmLook>[0] = {};
    if (patch.glow !== undefined) r.glow = patch.glow;
    if (patch.depthSize !== undefined) r.depthSize = patch.depthSize;
    if (patch.depthBrightness !== undefined) r.depthBrightness = patch.depthBrightness;
    if (patch.depthDof !== undefined) r.depthDof = patch.depthDof;
    if (patch.depthColorShift !== undefined) r.depthColorShift = patch.depthColorShift;
    if (patch.lightingMode !== undefined) r.lightingMode = patch.lightingMode;
    if (patch.lightDir !== undefined) r.lightDir = patch.lightDir;
    if (patch.rimPower !== undefined) r.rimPower = patch.rimPower;
    if (Object.keys(r).length > 0) renderer.setFilmLook(r);

    // The palette goes through the ONE resolver (21.4c), not into `r` above: `customFilmLookParams` is only
    // one of its two sources, and an `overlay.palette` override must keep winning over a Customize edit.
    // Same forwarding as `applyFilmLook` — without it, editing Palette in Customize mode changed the point
    // pass only and appeared to do nothing under streaks/adaptive/neon.
    if (patch.palette !== undefined || patch.paletteMapping !== undefined) {
      applyPaletteSelection(customFilmLookParams);
    }

    // v8 Step 9.3 — `palette` only. `paletteMapping` is deliberately NOT an input: the resolver takes the
    // palette's NAME and builds a 256-entry LUT from it, so how the renderer maps a particle onto that ramp
    // cannot change the ramp. Gated because this function runs on every Customize slider drag.
    //
    // ⚠️ **Sits BELOW the `currentFilmLook !== CUSTOMIZE_FILM_LOOK` early return, deliberately.** Under a
    // named look that return makes a palette patch inert for every OTHER consumer while `Object.assign` has
    // already written it into `customFilmLookParams` — so calling from above the return would make the
    // physarum trail the one thing that honoured a patch nothing else does. Invariant 25's shape.
    if (patch.palette !== undefined) applyPhysarumTrailColour();

    // Bloom: if enabled/levels changed, full reinit; otherwise just setParams
    if (patch.bloomEnabled !== undefined) {
      bloom.dispose();
      bloom.init(gl, {
        enabled: customFilmLookParams.bloomEnabled,
        threshold: customFilmLookParams.bloomThreshold,
        intensity: customFilmLookParams.bloomIntensity,
        radius: 5,
        levels: 5,
      });
      bloom.resize(canvas.width, canvas.height);
    } else if (patch.bloomThreshold !== undefined || patch.bloomIntensity !== undefined) {
      bloom.setParams(customFilmLookParams.bloomThreshold, customFilmLookParams.bloomIntensity);
    }

    // ToneMap: if enabled changed, full reinit; curve change also needs reinit (shader select)
    if (patch.toneMapEnabled !== undefined || patch.toneMapCurve !== undefined) {
      toneMap.dispose();
      toneMap.init(gl, {
        enabled: customFilmLookParams.toneMapEnabled,
        curve: customFilmLookParams.toneMapCurve,
        exposure: customFilmLookParams.exposure,
        lift: customFilmLookParams.lift,
        gamma: customFilmLookParams.gamma,
        gain: customFilmLookParams.gain,
        saturation: customFilmLookParams.saturation,
        vignette: customFilmLookParams.vignette,
      });
      toneMap.resize(canvas.width, canvas.height);
    } else {
      const t: Parameters<typeof toneMap.setParams>[0] = {};
      if (patch.exposure !== undefined) t.exposure = patch.exposure;
      if (patch.lift !== undefined) t.lift = patch.lift;
      if (patch.gamma !== undefined) t.gamma = patch.gamma;
      if (patch.gain !== undefined) t.gain = patch.gain;
      if (patch.saturation !== undefined) t.saturation = patch.saturation;
      if (patch.vignette !== undefined) t.vignette = patch.vignette;
      if (Object.keys(t).length > 0) toneMap.setParams(t);
    }
  }

  /**
   * Adopt the render mode the renderer actually ended up in.
   *
   * `initVolume`/`initLiquid` fall back to `'star'` when `EXT_color_buffer_float` is unavailable —
   * correct per ADR 010, but it left `currentRenderMode` (and therefore the Visual FX dropdown, which
   * reads it through `getRenderMode`) advertising a mode that was never active (R10).
   *
   * Also clears the stale `overlay.renderMode`, or the unsupported mode would be re-requested on every
   * subsequent re-apply and re-fail — and would travel into exports as if it had worked.
   */
  function reconcileRenderMode(): void {
    const active = renderer.getActiveRenderMode();
    if (active === currentRenderMode) return;
    console.warn(
      `PSSS: render mode "${currentRenderMode}" unavailable on this device; using "${active}"`,
    );
    currentRenderMode = active;
    if (preset?.overlay?.renderMode !== undefined) preset.overlay.renderMode = active;
    notifyExternalChange();
  }

  /**
   * Re-hand every piece of live state that `renderer.dispose()` throws away and `init()` cannot restore.
   *
   * ## Why this exists (2026-08-12, browser regression report)
   *
   * `dispose()` nulls `materialConfig`, `rampTexture`, `smokeRampTexture` and `paletteTexture`, while
   * `initRenderer()` forwards only the six `preset.renderer` fields. So a fresh renderer knows nothing
   * about the active material, palette, volume settings, flame expansion or smoke parameters — and the
   * splat draw gate is `renderMode === 'splat' && … && this.materialConfig`, so with a null material the
   * splat pass **draws nothing at all**.
   *
   * That made any render-mode round-trip through the Visual FX dropdown one-way: pick `star` (or
   * or `volume`) on a Fire preset and come back to `splat`, and the figure stays black
   * forever — the material could not be recovered from the UI. Reported as three separate failures
   * (`splat → star → splat`, `volume → splat`, and the retired `log-density → back`); all three were this
   * one defect.
   *
   * **PRE-EXISTING, not a triage-I2 regression.** `setRenderMode` contains zero re-hand calls in every
   * backup back to `backup_20260808_*`; `this.materialConfig = null` and the `materialConfig` draw gate
   * are both present unchanged in `backup_20260812_sitting18`. I2 (typing the stashed GL handles) is what
   * prompted the browser check that surfaced it, not what caused it.
   *
   * ## Why centralised rather than per-site
   *
   * Two of the nine `dispose()` sites already did this **partially** — and one of them carried a comment
   * asserting it was done "at every other dispose+init site", which was false: four sites re-handed
   * nothing whatsoever. Same failure shape, and same remedy, as `applyFluidFeedbackState()`: derive the
   * post-init state in one place so a new call site cannot silently omit half of it.
   *
   * **Go through `reinitRenderer()` rather than calling `dispose()` + `initRenderer()` by hand**, and if
   * you add renderer state that `dispose()` clears, add its re-hand here.
   *
   * Only the RENDERER's half of the film look is re-applied — `bloom` and `toneMap` were never disposed,
   * so `applyFilmLook()`'s dispose+init of those two would be pure waste on a mode change. What is
   * genuinely lost is `setFilmLook()`'s uniforms plus `paletteTexture`, which `setPalette()` rebuilds.
   */
  function reapplyRendererState(): void {
    const look: FilmLookParams = currentFilmLook === CUSTOMIZE_FILM_LOOK
      ? customFilmLookParams
      : ((FILM_LOOKS as Record<string, FilmLookParams | undefined>)[currentFilmLook]
         ?? customFilmLookParams);
    renderer.setFilmLook({
      glow: look.glow,
      depthSize: look.depthSize,
      depthBrightness: look.depthBrightness,
      depthDof: look.depthDof,
      depthColorShift: look.depthColorShift,
      lightingMode: look.lightingMode,
      lightDir: look.lightDir,
      rimPower: look.rimPower,
      // The palette is re-handed by `applyPaletteSelection()` below — `dispose()` deleted `paletteTexture`,
      // so this IS one of the invariant-2 re-hands, not belt-and-braces. It must go through the resolver
      // like the other two sites (21.4c): re-handing `look.palette` here would quietly drop an
      // `overlay.palette` override on every render-mode change, which reads as "the mode change reset my
      // colours".
    });
    applyPaletteSelection(look);
    renderer.setMaterialConfig(currentMaterial);
    renderer.setCrystalConfig(currentCrystal);
    renderer.setVolumeConfig(currentVolume);
    // v8 Step 15.1. `dispose()` deletes the liquid ramp texture AND nulls its cache key, so the config must
    // be re-handed or the surface samples a ramp nobody chose (invariant 2 — every renderer field that
    // `dispose()` clears belongs in this function, and this one clears a texture, not just a number).
    renderer.setLiquidConfig(currentLiquid);
    renderer.setFlameExpansion(computeFlameExpansion());
    renderer.setSmokeParams(
      currentBuoyancy.enabled ? (currentBuoyancy.smokeThreshold ?? 0.25) : 0,
      currentBuoyancy.smokeOpacity ?? 0.4,
    );
    // `particleSize` survives `dispose()` (it is a plain number, not a handle), so this is belt-and-braces
    // by the letter of invariant 2 — but the rule is "re-hand everything", not "re-hand what you have
    // measured as lost": the field is one edit away from being reset in `init()` from a `RendererConfig`,
    // and a size that silently returns to 1x on a mode change is exactly the class of defect this function
    // was created to make unrepresentable.
    renderer.setParticleSize(particleSizeScale);
    // ⚠️ 27.6 — REQUIRED here by invariant 2, not belt-and-braces. `splatShearFixed` is a plain boolean on
    // the renderer and survives `dispose()`, but `reinitRenderer()` builds a NEW renderer whose field starts
    // at its initialiser, so without this line a render-mode change silently reverts the nib look to the
    // default and the control reads as having forgotten itself.
    renderer.setSplatShear(splatShear === 'fixed');
    // ⚠️ REQUIRED here, not belt-and-braces: `dispose()` resets `sparkRadius` to null, so without this a
    // render-mode change would silently revert sparks to the material's radius until the next spark edit —
    // the invariant-2 failure this function exists to make unrepresentable.
    renderer.setSparkRadius(currentSpark.enabled ? currentSpark.splatRadius : null);
    /*
     * v8 Step 15.7. ⚠️ **REQUIRED here, not belt-and-braces: `dispose()` NULLS `dyeTexture`** (it does not
     * delete it — the texture is `DyeFieldProcessor`'s, merely borrowed by the renderer). Without this line a
     * render-mode change, a film look or a preset switch would leave the renderer holding `null`, so
     * `tintSource: 'dye'` would degrade to `'ramp'` and STAY degraded for the rest of the session — the exact
     * invariant-2 failure this function exists to make unrepresentable, and one that reads as the user having
     * chosen `'ramp'` rather than as a lost hand-off.
     *
     * ⚠️ **This function is the SINGLE OWNER of the post-dispose re-handing.** The frame loop's own per-frame
     * call cannot stand in for it: `reinitRenderer` can be followed by a draw within the same frame.
     */
    renderer.setDyeTexture(dyeProcessor.getDyeTexture());
  }

  /**
   * Swap the renderer to `mode`: dispose, re-init against a synthetic preset, re-hand all live state.
   *
   * `base` defaults to the module-level `preset`; `resetOverlays` passes its own incoming preset, which
   * is not yet the same object. Returns silently with the renderer disposed when there is no preset at
   * all — the same behaviour every hand-written site had.
   *
   * Callers still own `currentRenderMode` and the `reconcileRenderMode()` decision, because only some of
   * them care whether the renderer refused the mode (ADR 010's `'star'` fallback).
   */
  function reinitRenderer(
    mode: RenderMode,
    base: UnifiedPreset | undefined = preset,
  ): void {
    renderer.dispose();
    if (!base) return;
    const syntheticPreset = { ...base, renderer: { ...base.renderer, mode } };
    initRenderer(renderer, backend, syntheticPreset, canvas.width, canvas.height);
    reapplyRendererState();
  }

  /**
   * Rebuild the TransMap pass from the LIVE overlay state: dispose, then re-init against a synthetic
   * preset whose `postProcessors.transMap` carries `currentTransMapEnabled` / the chain's primary style /
   * `currentIfsParams` rather than whatever the preset happens to have stored (triage I8) — **and pass
   * `currentTransMapChain` as the 6th argument, which is the field that actually decides what runs.**
   *
   * ⚠️ The synthetic `style` is now only a FALLBACK: `initTransMap` prefers the explicit chain, so the two
   * cannot disagree. It is still set because `TransMapConfig.style` is not optional and a `-1` there would
   * be a lie in a serialised-looking field.
   *
   * TransMap's enabled flag, chain and IFS transforms are owned by the Visual FX tab, not by the preset,
   * so every re-init that is NOT a preset change has to override those three — and this 15-line synthetic
   * construction was written out at **six** sites: the overlay-apply branch of `applyPresetChange`, the
   * three `VisualFxControls` setters (`setTransMapEnabled`, `setTransMapStyle`, `setIfsParams`), the
   * grid-click path, and inline in `resizeAll()`. `resizeAll()` is the one that shows why this matters:
   * its duplicate was already the *repair* for an earlier drift, where the window-resize copy passed the
   * raw preset and so silently reverted TransMap to the preset's stored style on every resize.
   *
   * ⚠️ **This is duplication only — there is no B17-shaped re-handing gap behind it.** Unlike
   * `renderer.dispose()`, which nulls four pieces of live state that `initRenderer` does not forward,
   * `TranslationMapProcessor` has exactly three live setters (`setMix`, `setTrailDecay`, `setFieldDecay`)
   * and all three are re-issued from the frame loop every frame, so nothing needs re-handing after a
   * dispose+init. The value here is that a seventh site cannot get the override wrong.
   *
   * **Two sites deliberately keep the raw `initTransMap(…, preset, …)` and must not be converted:** the
   * one-time init at startup (the three live fields are seeded *from* the preset a few lines earlier, so
   * they agree by construction) and the preset-change path, where the incoming preset's own stored block
   * IS authoritative and the overlay branch below it re-runs this helper only if the overlay overrides it.
   *
   * Diverges from `reinitRenderer` in one respect: it returns **without** disposing when there is no
   * preset. TransMap is inited unconditionally at startup — as a disabled pass-through when there is no
   * preset — so disposing without re-initing would leave the pass uninitialised with nothing to repair it.
   */
  function reinitTransMap(
    base: UnifiedPreset | undefined = preset,
    w: number = canvas.width,
    h: number = canvas.height,
  ): void {
    if (!base) return;
    transMap.dispose();
    initTransMap(transMap, gl, liveTransMapPreset(base), w, h, currentTransMapChain);
  }

  /**
   * The synthetic preset the paragraphs above describe — **the ONE owner of the three overlay overrides**,
   * shared by `reinitTransMap()` and `setTransMapWaveTables()` (v8 21.12).
   *
   * ⚠️ **A second caller is exactly the drift `reinitTransMap` was written to stop**, so it is factored here
   * rather than copied: the setter needs the same three overrides to build a config, and a copy that omitted
   * `enabled` would rebuild the static field against the preset's stored flag instead of the live one.
   */
  function liveTransMapPreset(base: UnifiedPreset): UnifiedPreset {
    return {
      ...base,
      postProcessors: {
        ...base.postProcessors,
        transMap: {
          ...base.postProcessors.transMap,
          enabled: currentTransMapEnabled,
          style: primaryTransMapStyle(),
          ...(chainHasLayerFor(4) ? { ifsParams: currentIfsParams } : {}),
        },
      },
    };
  }

  /**
   * Install a new chain without the dispose+init cycle `reinitTransMap()` performs.
   *
   * ⚠️ **This is the path every chain EDIT takes, and using `reinitTransMap()` instead would be a visible
   * regression rather than merely slow.** A dispose+init relinks two shaders, re-uploads a canvas-sized
   * RGBA32F displacement texture (~33 MB at 4K) and — the part that shows — constructs a fresh
   * `ProceduralFlowGenerator`, restarting its noise phase from zero. Dragging a layer's weight slider
   * would make the flow field jump on every mouse move. `setChain()` keys each resource on its own
   * predicate and rebuilds only what actually changed; a single static layer's weight rebuilds nothing.
   *
   * `applyFluidFeedbackState()` runs after, because adding or muting a style-6 layer changes `trailDecay`
   * and the velocity field exactly as the Style dropdown did.
   */
  function applyChainChange(chain: readonly TransMapLayer[]): void {
    currentTransMapChain = normaliseChain(chain);
    transMap.setChain(currentTransMapChain);
    applyFluidFeedbackState();
    transMapForce.resetOffsets();
  }

  /**
   * Re-read the preset list from its owner after the library changes (D4).
   *
   * Called after an import. `PresetManager` is authoritative; this keeps `presetNames` and
   * `currentPresetIndex` consistent with it instead of relying on a shared array being mutated in place.
   */
  const refreshPresetNames = (activeName?: string): void => {
    presetNames = presetManager.list();
    if (activeName) currentPresetIndex = presetNames.indexOf(activeName);
  };

  /**
   * Apply the six generator/renderer-config overlay blocks — physarum, fluid, buoyancy, sparks, volume
   * and crystal — from a preset's `overlay`, resetting each to its `DEFAULT_*` when absent.
   *
   * Was seven until the dye field was deleted 2026-08-12 (triage G14): `overlay.dye` is still accepted on
   * import for format compatibility but nothing consumes it, so nothing here applies it.
   *
   * ## Why this is shared (D5)
   *
   * `applyPresetChange` and `VisualFxControls.resetOverlays` are two ~160-line paths doing the same job
   * for the same reason: both answer "make the live overlay state match this preset". They were written
   * separately and had already drifted in two places that a reader could not see without diffing them —
   * `lineWidth` defaulted to 1.5 in one and 2.0 in the other, and `attractorBlend` to 0 versus 0.6, so a
   * preset declaring an attractor index but no blend rendered its attractor via one path and not at all
   * via the other. Both are now named constants (`DEFAULT_LINE_WIDTH`, `DEFAULT_ATTRACTOR_BLEND`).
   *
   * Only the part that was genuinely IDENTICAL is extracted. The two callers keep what legitimately
   * differs, and the differences are real, not accidental:
   *
   * - **Material auto-switch.** `applyPresetChange` switches INTO splat when a material arrives and back
   *   out when it leaves; `resetOverlays` only reverts, because it must not fight a live Materials-tab
   *   choice. Left with the callers.
   * - **`perfGuard.reset()`** belongs to `applyPresetChange` alone: it exists because a preset SWITCH
   *   reallocates buffers and re-warms trails, so the next frames are unrepresentatively slow. A Reset
   *   inside the Lab does not reallocate and must not clear the guard's window.
   * - **`ov` nullability.** `applyPresetChange` has already defaulted it to `{}`; `resetOverlays` passes
   *   a possibly-undefined one. Normalised in the signature so neither caller needs `ov?.` at all —
   *   that inconsistency was the single largest source of textual noise when diffing the two.
   */
  function applyOverlayConfigBlocks(ov: NonNullable<UnifiedPreset['overlay']> | undefined): void {
    const o = ov ?? {};

    const physCfg = o.physarum ?? DEFAULT_PHYSARUM;
    Object.assign(currentPhysarum, physCfg);
    // ⚠️ **v8 9.3 — INVARIANT 14, and `Object.assign` above is exactly the mechanism it warns about.**
    // `trailColour` is OPTIONAL, so a preset written before this step (all 361 of them, and every export on
    // disk) has no such key and `Object.assign` leaves the PREVIOUS session value standing — a trail that
    // keeps a palette chosen for the preset before it. The `?? DEFAULT` on `physCfg` cannot help: the block
    // itself is present, only the field is absent. **A field added to an existing block needs this line even
    // though nothing about the block's own default changed.**
    currentPhysarum.trailColour = physCfg.trailColour ?? PHYSARUM_TRAIL_COLOUR_PRESET;
    physarumProcessor.setConfig({ ...currentPhysarum });
    applyPhysarumTrailColour();
    generator.setPhysarumProcessor(
      currentPhysarum.blend > 0 ? physarumProcessor : null,
      currentPhysarum,
    );

    const fluidCfg = o.fluidAdvection ?? DEFAULT_FLUID;
    Object.assign(currentFluid, fluidCfg);
    fluidProcessor.setConfig({ ...currentFluid });

    const buoCfg = o.buoyancy ?? DEFAULT_BUOYANCY_CONFIG;
    Object.assign(currentBuoyancy, buoCfg);
    generator.setBuoyancyConfig(currentBuoyancy);
    renderer.setFlameExpansion(computeFlameExpansion());
    renderer.setSmokeParams(buoCfg.enabled ? (buoCfg.smokeThreshold ?? 0.25) : 0, buoCfg.smokeOpacity ?? 0.4);

    const spkCfg = o.sparks ?? DEFAULT_SPARK_CONFIG;
    Object.assign(currentSpark, spkCfg);
    applySparkConfig();

    const volCfg = o.volumeRender ?? DEFAULT_VOLUME_CONFIG;
    Object.assign(currentVolume, volCfg);
    renderer.setVolumeConfig(currentVolume);

    // v8 Step 15.1. ⚠️ **Defaults are re-applied UNDERNEATH the preset's block, not merely `Object.assign`ed
    // over the live object** — a preset carrying a partial `liquid` block would otherwise inherit the
    // previous preset's values for the missing fields, which is invariant 14's exact shape and is how
    // `Object.assign(currentVolume, volCfg)` above stays correct only because `volCfg` is always complete.
    Object.assign(currentLiquid, DEFAULT_LIQUID_CONFIG, o.liquid ?? {});
    renderer.setLiquidConfig(currentLiquid);

    // v8 Step 15.4 — cohesion, same defaults-underneath merge as `liquid` directly above.
    //
    // ⚠️ **The ON/OFF state FOLLOWS THE PRESET and is not sticky, which is the crystal rule below rather than
    // the crystal EXCEPTION.** A preset shipping no `cohesion` block is making no statement about cohesion,
    // and the safe reading of that is `strength: 0` — the alternative was measured against the library and is
    // unacceptable: 359 of 360 presets carry no block, so a sticky strength would leave every preset selected
    // after a beaded one dissolved into droplets, with nothing in its own definition to explain why.
    Object.assign(currentCohesion, DEFAULT_COHESION_CONFIG, o.cohesion ?? {});
    generator.setCohesionConfig(currentCohesion);

    // v8 Step 15.5 — the liquid FIELD pool, same defaults-underneath merge and the same non-sticky
    // `enabled` as cohesion above, for the identical library reason (no shipped preset carries the block,
    // so a sticky pool would follow the user out of the one preset that turned it on).
    //
    // ⚠️ **`setLiquidFieldConfig` FIRST, THEN `applyFluidFeedbackState()`, and the order is load-bearing in
    // one direction only**: that function derives `setPoolActive`, `fieldDecay` and the sampler closure from
    // `currentLiquidField`, so it must observe the NEW block. Reversed, a preset that switches the pool on
    // gets its particles published with the velocity field still inactive and no sampler installed — the
    // pool would stand in a heap at its seed positions for exactly one preset change, which reads as the
    // seed pattern being wrong rather than as an ordering fault.
    //
    // ⚠️ **THE DERIVE LIVES HERE, INSIDE THE MERGE, AND NOT AT THE TWO CALLERS — because at BOTH of them it
    // already runs TOO EARLY.** Measured: `applyPresetChange` calls `applyFluidFeedbackState()` above its own
    // `applyOverlayConfigBlocks(ov)`, and the Reset/grid path does the same. So a call placed at either caller
    // observes the PREVIOUS preset's `liquidField` and produces exactly the heap-at-seed-positions symptom
    // described above. Putting it at the end of this block makes the ordering a property of the merge rather
    // than of each caller's statement order — the same "one owner, derived not assigned" discipline
    // `applyFluidFeedbackState()` itself exists for. It is idempotent, so the callers' earlier calls (which
    // are there for style 6) stay correct and are not removed.
    Object.assign(currentLiquidField, DEFAULT_LIQUID_FIELD_CONFIG, o.liquidField ?? {});
    generator.setLiquidFieldConfig(currentLiquidField);
    applyFluidFeedbackState();

    /*
     * v8 Step 15.7 — the dye field, same defaults-underneath merge and the same NON-STICKY `enabled` as
     * cohesion and the pool above, for the identical library reason: no shipped preset carries the block, so a
     * sticky field would follow the user out of the one preset that turned it on and re-tint every liquid
     * preset selected after it.
     *
     * ⚠️ **THE FIELD'S CONTENTS ARE HISTORY AND MUST NOT SURVIVE A PRESET SWITCH — `reset()`, exactly as
     * `generator.resetFrozen()` does for the crystal pool for the same stated reason (D-09).** The dye holds an
     * integrated trace of where the PREVIOUS figure has been, so without this the new preset's surface would
     * be tinted by a wake belonging to a figure that is no longer on screen, fading over the decay's ~20
     * frames. That reads as the new preset having wrong colours, which names neither the dye nor the switch.
     *
     * ⚠️ **`setConfig` BEFORE `reset()` is not load-bearing but the pairing is**: `reset()` only clears texels,
     * so a config left stale would advect the cleared field with the previous preset's strength for one frame.
     *
     * ⚠️ **AND `applyFluidFeedbackState()` AGAIN AT THE END, for the pool's reason one block up, VERBATIM** —
     * it now also derives `setDyeActive` from `currentDye`, so it must observe the NEW block. Without this a
     * preset authoring a dye but no pool activated no velocity field and its `Advection` was inert (reported
     * 2026-09-03). The liquidField block's own call above cannot cover it: it runs BEFORE this merge and would
     * observe the previous preset's dye. **Two consecutive blocks each ending in the same idempotent derive is
     * the correct shape here, not a duplicate to tidy away** — each one is the barrier for its own merge, and
     * a single call moved after both would put the pool's sampler installation one block later than the
     * measurement above says it may be.
     */
    Object.assign(currentDye, DEFAULT_DYE_CONFIG, o.dye ?? {});
    dyeProcessor.setConfig(currentDye);
    dyeProcessor.reset();
    applyFluidFeedbackState();

    // Crystal: TUNING persists across preset changes (T008/D-02/RF-02,
    // `domain.md#r12`), so hand-tuned shape/size/lifecycle values survive a switch. 8a used
    // `?? DEFAULT_CRYSTAL_CONFIG`, which silently DISABLED the feature on every switch because no preset
    // carried the block at the time.
    //
    // But `enabled` must NOT be sticky. Once the showcase presets started shipping a crystal block,
    // selecting one turned crystals on and every subsequent preset INHERITED them — the Phase 6 fire
    // presets appeared with ice they never asked for. A preset shipping no crystal block is making no
    // statement about crystals, and the safe reading of that is "off", exactly as every other overlay
    // already behaves via `?? DEFAULT`. So: params persist, the ON/OFF state follows the preset.
    if (o.crystal) {
      Object.assign(currentCrystal, o.crystal);
    } else {
      currentCrystal.enabled = false;
    }
    // The null-then-set forces a ramp re-upload. `initSplat` now seeds the crystal ramp from the live
    // config, so this is belt-and-braces rather than load-bearing — but it is kept because
    // `setCrystalConfig` only re-uploads on a ramp NAME change, and `currentCrystal` is the same object
    // reference the renderer already holds, so the comparison would be against itself.
    renderer.setCrystalConfig(null);
    renderer.setCrystalConfig(currentCrystal);
    // Re-hand the config after the generator was disposed and re-inited, then drop the whole pool: every
    // crystal, and all growth/age/lifetime history with it. The POOL CONTENTS are HISTORY, not
    // parameters (D-09) — they cannot interpolate in the Mixer and must not survive a preset switch.
    // Without the reset, a slot recycled on the new preset would inherit an age past its lifetime and
    // melt on frame 1, which reads as "crystals never form".
    generator.setCrystalConfig(currentCrystal);
    generator.resetFrozen();
  }

  /**
   * Hand the generator the preset's OWN `fractal` attractor, if it has one. Returns whether it did.
   *
   * ⚠️ **EXTRACTED (v8 16.18 / E109) BECAUSE A SECOND CALLER APPEARED, NOT FOR TIDINESS.** `applyPresetChange`
   * has always applied `preset.fractal` here; the bypass RESTORE needs the identical five lines, because the
   * whole-overlay apply path it routes through (`resetOverlays`) has never known about `p.fractal` at all — it
   * reads `overlay.attractorIndex`, which is `-1` for a fractal preset, so it hands the generator `null`.
   *
   * ⚠️ **THAT IS A PRE-EXISTING `resetOverlays` DEFECT AND IT IS DELIBERATELY NOT FIXED HERE.** A Lab Reset on
   * the one library preset carrying a `fractal` block (measured: **1 of 399**, `FIRE_PRESETS:Julia Burn Rivers`)
   * loses its attractor today. Repairing that means changing a shipped path's behaviour, which is not this
   * step's scope — so the bypass calls this helper itself after the restore, and the defect keeps exactly the
   * blast radius it already had. **State the basis with the figure: 1 of 399 on `composercheck`'s own count.**
   */
  function applyPresetFractalAttractor(p: UnifiedPreset): boolean {
    if (!p.fractal) return false;
    generator.setAttractor({
      type: p.fractal.type as AttractorParams['type'],
      params: p.fractal.params,
      blend: p.fractal.blend,
      bounds: p.fractal.bounds,
    });
    currentAttractorIndex = -1;
    currentBlend = p.fractal.blend;
    return true;
  }

  /*
   * =================================================================================================
   * v8 16.18 (E109) — the Composer's two PREVIEW BYPASS switches: "don't apply Visual FX" and
   * "don't apply Materials".
   * =================================================================================================
   *
   * **The ask:** *"checkboxes to enable/disable application of the Materials to the main preview and for Visual
   * Fx to the main preview (if disabled only keep film look setting enabled)"* — so the user can look at the
   * bare Lissajous figure they are composing without deleting the decoration that hides it.
   *
   * ⚠️ **IT IS A RE-APPLY, NOT A PER-FRAME BYPASS FLAG, AND NOTHING IN THE FRAME LOOP READS THESE BOOLEANS.**
   * The engine already owns a path that applies a WHOLE overlay to live state — `resetOverlays` — so *FX off* is
   * that path called with a stripped overlay and *FX on* is it called with the authored one. **D5 exists because
   * two ~160-line apply paths had already drifted in two invisible places** (`lineWidth` 1.5 vs 2.0,
   * `attractorBlend` 0 vs 0.6), and the plan names a third hand-written path as the defect this step is most
   * likely to add. So this code writes NO assignments of its own: it builds an `OverlayState` and hands it over.
   *
   * ⚠️ **`bypassApplying` IS THE RE-ENTRANCY GUARD AND IT IS LOAD-BEARING IN TWO DIRECTIONS.** `resetOverlays`
   * ends in `notifyExternalChange()`, and one subscriber is `ComposerTab.adoptExternalFigure()`, which calls
   * `resetMutes()` and rebuilds every row body — so an unguarded bypass click would **wipe the user's 16.17
   * level mutes and replace the checkbox they just clicked**, on every click. It also stops the re-neutralise
   * hook at the end of `resetOverlays` from recursing into itself.
   *
   * ⚠️ **"OMITTING A KEY NEUTRALISES IT" IS FALSE FOR THREE KEYS, AND THE PLAN ASSERTED OTHERWISE.** Measured
   * against `resetOverlays`' own `??` fallbacks: `transMapEnabled` falls back to
   * `p.postProcessors.transMap.enabled` (**264 of 399 presets author `true`**), `attractorBlend` falls back to
   * `DEFAULT_ATTRACTOR_BLEND` = **0.6, not 0** — the very drift D5 records — and `renderMode` falls back to
   * `p.renderer.mode`. Those three are written EXPLICITLY below. Every other effect really is neutral by
   * omission (`ribbonMode` → `'off'`, `curlNoise` → `DEFAULT_CURL`, and all ten nested blocks →
   * `DEFAULT_*`/`enabled: false` inside `applyOverlayConfigBlocks`), which is what makes the stripped overlay
   * short enough to read.
   *
   * ⚠️ **EXPORT, SNAPSHOT AND THE MIXER MUST BE BYTE-IDENTICAL WITH EITHER BOX TICKED — THE PLAN'S ONE HARD
   * ASSERTION — AND A RE-APPLY DESIGN BREAKS IT BY CONSTRUCTION UNLESS SOMETHING FREEZES THE REPORT.**
   * `getSnapshot()` reads LIVE state, so with the effects genuinely switched off in the engine it would export
   * the neutralised overlay, and Snapshot would write that loss into the history the user restores from — the
   * same ending as the export-gate defect in invariant 17. So the authored overlay is CAPTURED the moment the
   * first box is ticked and `getSnapshot()` returns that capture verbatim while either box is on. **The report
   * is frozen; only the pixels change.**
   *
   * ⚠️ **THE COROLLARY IS THAT VISUAL FX AND MATERIALS KEEP SHOWING THE AUTHORED VALUES, AND THAT IS CORRECT
   * RATHER THAN A STALE READOUT** — the frozen capture is the source of truth for every surface, and the engine
   * is temporarily running something else. It is also why these setters do NOT notify: a resync would make those
   * tabs display the neutralised state, i.e. disagree with the export. **The cost is stated in the UI: an edit
   * made on those tabs while a box is ticked does not survive unticking it.**
   */
  const PLAIN_BYPASS_MODES: ReadonlySet<RenderMode> = new Set<RenderMode>(['pixel', 'blend', 'star']);
  let bypassVisualFx = false;
  let bypassMaterials = false;
  /**
   * v8 `26.8` / `26.D1` — `Strip to figure`: show the bare curve with every atmospheric effect off.
   *
   * ⚠️ **A THIRD BYPASS FLAG, NOT A WRITE TO `workingPreset` (`26.8`).** It reuses the mechanism Phase 16's
   * two Preview-only switches already ship, so **Export, Snapshot and the Mixer stay byte-identical with the
   * strip on or off** — which is the same hard assertion `16.18` makes, and it is why this is a flag rather
   * than an edit. It also means the strip **holds with the Lab closed**, because the bypass is applied
   * engine-side.
   *
   * ⚠️ **IT IS THE ONE SURVIVING PIECE OF THE ARCHETYPES TAB** (`26.D1`). The tab was removed as obsolete,
   * but its DIAGNOSTIC half had no other surface in the engine — "show me the bare curve with nothing on it"
   * is a dozen toggles across five Visual FX sections — and the manual used to tell readers to reach for the
   * `Wire Frame` archetype to do it.
   */
  let bypassStrip = false;
  /** The overlay as it was when the first box was ticked. Non-null EXACTLY while a bypass is live. */
  let bypassAuthoredOverlay: OverlayState | null = null;
  let bypassApplying = false;

  /**
   * The overlay fields a bypass PRESERVES, read from LIVE state rather than from the frozen capture.
   *
   * ⚠️ **LIVE AND NOT CAPTURED, BECAUSE A RE-APPLY MUST NOT REWIND A CONTROL THE USER IS STILL USING.** Ticking
   * the Materials box re-applies the whole overlay, so if these came from the capture, a Materials click would
   * snap `speedFactor` back to the authored value — and 16.19 puts a Speed slider on the very same tab, two rows
   * above. Sourcing them live makes every re-apply idempotent for the preserved set.
   *
   * **The set is the owner's, stated as a scope rather than derived:** Film Look, all of Framing & Timing,
   * — since Phases 30 to 32 — **every model-space deformation and every per-particle channel**, and — since
   * Phase 34 — **the four figure operators and all 31 of their keys** (`Sharpness` per level with `Temper`,
   * `Travel` with `Stretch`, `Offset` with `Sway`, `Grow` with `Flare`), via `figureOperatorKeys()`.
   * Rotation is absent because it is not an overlay field at all — it lives on the generator and no apply path
   * touches it, so it survives for free.
   *
   * ⚠️ **THE DEFORMATION HALF IS A SEPARATE DECISION FROM THE GRADE HALF AND IT IS A LOAD-BEARING ONE.** The
   * bypass strips BY OMISSION, so a key that is not named here is neutralised. **The Visual FX deformation
   * operators and the per-particle channels are deliberately NOT named (owner, 2026-11-10)**: `Apply Visual FX`
   * off promises no Visual FX at all, and keeping them made the Fractal Fold (and every other deformation) keep
   * running under it. **A NEW VISUAL FX operator must stay out of this function; a new COMPOSER figure operator
   * joins `figureOperatorKeys()`.**
   *
   * ⚠️ **AND IT IS WHY THE EXPORT STAYS BYTE-IDENTICAL EITHER WAY.** `getSnapshot()`'s bypass branch returns
   * `{ ...bypassAuthoredOverlay, ...livePreservedOverlay() }`, so a key here is reported LIVE and every other
   * key from the frozen capture. Omitting a deformation from this function would make the bypass neutralise it
   * *and* keep the authored value in the export — consistent, but then the picture and the export disagree.
   * **This sentence has been stale once already** (it named only the grade and Framing & Timing while three
   * phases of deformation were added below it) — re-read the body, never this paragraph.
   */
  /**
   * v8 `34.5` — **the ONE owner of the four figure-operator export gates** (`Sharpness`+`Temper`,
   * `Travel`+`Stretch`, `Offset`+`Sway`, `Grow`+`Flare`), called from BOTH export sites.
   *
   * ⚠️⚠️ **IT IS A SHARED FUNCTION RATHER THAN TWO COPIES, AND THAT IS A DELIBERATE DEPARTURE FROM THE
   * SURROUNDING BLOCKS.** Every neighbouring operator writes its gate twice — once in
   * `livePreservedOverlay()` and once in `getSnapshot()`'s plain branch — each copy carrying a comment
   * saying *two copies of one rule, and 16.18's byte-identity assertion is what catches a drift*. That is
   * affordable for a three-key triple. **It is not affordable for thirty-one keys over four gates with a
   * nested depth/rate sub-gate in each**, and the failure mode is the one `16.18` found by RUNNING: this
   * function is spread OVER the frozen capture, so a key emitted on one side and not the other is *added*
   * rather than matched, and the bypassed export gains keys the authored one does not have. **One owner
   * removes the drift instead of detecting it.**
   *
   * ⚠️ **ALL THREE SHARPNESS LEVELS OR NONE** — there is no absent-key spelling of *Body only* once the two
   * new bases read `?? sharpness`, so emitting one of the three alone would make every Body-only preset
   * silently uniform on reload. **That rule is load-bearing, not cosmetic.**
   *
   * ⚠️ **THE DEPTH/RATE SUB-GATE IS INSIDE THE BASE GATE ON PURPOSE:** a rate with no depth is inert
   * (`resolveOp` skips the modulator entirely at depth 0), so emitting it alone would put a dead key into
   * every export. **An export is mostly runtime-default noise already; diff programmatically against the
   * default constants rather than by eye.**
   *
   * ⚠️ **The sharpness gate reads the DEPTH too, not only the three bases**, because `Temper` over a base of
   * 0 is a real figure: it breathes up from pure sine. Gating on the bases alone would destroy that
   * preset's only authored value — a gate DESTROYING a block rather than omitting a noise key, which is
   * invariant 17's ending.
   */
  function figureOperatorKeys(): OverlayState {
    const nz = (v: readonly number[]): boolean => v[0] !== 0 || v[1] !== 0 || v[2] !== 0;
    return {
      ...(sharpnessLevels[0] !== 0 || sharpnessLevels[1] !== 0 || sharpnessLevels[2] !== 0
        || sharpnessDepth !== 0
        ? {
          sharpness: sharpnessLevels[0],
          sharpnessStructure: sharpnessLevels[1],
          sharpnessDetail: sharpnessLevels[2],
          ...(sharpnessDepth !== 0 ? { sharpnessDepth, sharpnessRate } : {}),
        }
        : {}),
      ...(nz(travel) || nz(travelDepth)
        ? {
          travelX: travel[0], travelY: travel[1], travelZ: travel[2],
          ...(nz(travelDepth) ? {
            travelDepthX: travelDepth[0], travelDepthY: travelDepth[1], travelDepthZ: travelDepth[2],
            travelRateX: travelRate[0], travelRateY: travelRate[1], travelRateZ: travelRate[2],
          } : {}),
        }
        : {}),
      ...(nz(offset) || nz(offsetDepth)
        ? {
          offsetX: offset[0], offsetY: offset[1], offsetZ: offset[2],
          ...(nz(offsetDepth) ? {
            offsetDepthX: offsetDepth[0], offsetDepthY: offsetDepth[1], offsetDepthZ: offsetDepth[2],
            offsetRateX: offsetRate[0], offsetRateY: offsetRate[1], offsetRateZ: offsetRate[2],
          } : {}),
        }
        : {}),
      ...(nz(grow) || nz(growDepth)
        ? {
          growX: grow[0], growY: grow[1], growZ: grow[2],
          ...(nz(growDepth) ? {
            growDepthX: growDepth[0], growDepthY: growDepth[1], growDepthZ: growDepth[2],
            growRateX: growRate[0], growRateY: growRate[1], growRateZ: growRate[2],
          } : {}),
        }
        : {}),
    };
  }

  function livePreservedOverlay(): OverlayState {
    return {
      filmLook: currentFilmLook,
      ...(currentFilmLook === CUSTOMIZE_FILM_LOOK
        ? { customFilmLookParams: { ...customFilmLookParams } }
        : {}),
      speedFactor,
      figureScale,
      /*
       * ⚠️ **THESE THREE ARE IDENTITY-GATED WITH EXACTLY THE GATES `getSnapshot()`'s PLAIN BRANCH USES, AND
       * EMITTING THEM UNCONDITIONALLY WAS A LIVE DEFECT — THE BYPASSED EXPORT GAINED THREE KEYS THE AUTHORED ONE
       * DOES NOT HAVE** (found by the Phase 17 suite BY RUNNING, 2026-09-09; two failing tests — steps 106f and
       * 106g — one cause). **16.18's one hard assertion is that Export, Snapshot and the Mixer are BYTE-IDENTICAL
       * with either box ticked**, and this function is spread OVER the frozen capture, so an unconditional key
       * is *added* rather than matched: `particleSize` at the identity 1.0, plus `symmetryFold`/`symmetryMirror`
       * at fold 1, where all three are inert and the plain branch deliberately omits them.
       *
       * ⚠️ **THE GATES BELONG HERE, IN THE ONE OWNER OF THE PRESERVED SET — NOT IN A NORMALISER AT THE READER.**
       * Widening the comparison to ignore these keys would have turned the test green over a live violation of
       * the very rule it exists to measure (*a net figure conceals a repair*). ⚠️ **AND `symmetryFold`/`Mirror`
       * SHARE ONE GATE RATHER THAN HAVING ONE EACH, because `symmetryMirror` has no meaning without a fold** —
       * per-BLOCK, not per-field, exactly as E30 wrote it. **If the plain branch's gates ever change, these must
       * change with them: two copies of one rule, and the byte-identity assertion is what catches a drift.**
       */
      ...(particleSizeScale !== 1.0 ? { particleSize: particleSizeScale } : {}),
      /*
       * v8 `33.2`/`33.3`/`34.2`/`34.3`/`34.4` — the four figure operators and all 31 of their keys, gated by
       * **`figureOperatorKeys()`, the ONE owner shared with `getSnapshot()`'s plain branch.** Read its header
       * before changing a gate: the sharpness gate reads the DEPTH as well as the three bases, the
       * depth/rate sub-gates sit INSIDE their base gates, and all three sharpness levels are emitted or none.
       *
       * PRESERVED by a bypass for the deformers' reason: these describe the FIGURE, not the atmosphere, and
       * `Strip to figure` exists to show the bare curve — a faceted, grown, offset curve still being that
       * curve. See this function's own header.
       */
      ...figureOperatorKeys(),
      // v8 33.4 — a VALUE gate, not a block gate: `'contour'` is the shipped behaviour, so emitting it
      // would put an inert key into all 300 exports. This is the per-KEY categorical case `27.6`'s
      // comment names, not one of the four block rules.
      ...(escapeFlowMode !== 'contour' ? { escapeFlow: escapeFlowMode } : {}),
      /*
       * ⚠️⚠️ **THE VISUAL FX DEFORMATION OPERATORS AND THE PER-PARTICLE CHANNELS ARE NOT HERE, AND THAT IS THE RULE
       * (owner, 2026-11-10).** `Apply Visual FX` off promises *no Visual FX at all*, and Symmetry, 3-D Symmetry, Twist,
       * Taper, Bend, Fold, Inversion, the Fractal Fold, the 4D rotation and the channels are Visual FX controls — they
       * used to be preserved here ("a deformation describes the FIGURE"), which left them running under the bypass
       * and contradicted the manual. Absent from this function, the bypass neutralises them BY OMISSION and the
       * export takes them from the frozen capture, so Export / Snapshot / the Mixer stay byte-identical either way.
       * **The Composer's own figure operators (`figureOperatorKeys()`) stay**: they ARE the figure.
       */
      /*
       * v8 Step 21.4c — the palette override JOINS THE PRESERVED SET, identity-gated on `!== undefined` exactly
       * as the plain branch gates it. **This widens the owner's stated scope ("Film Look, and all of Framing &
       * Timing") by one pair, and the reason is that the pair belongs to the FILM LOOK half of that scope in
       * everything but its position in the tab.** `overlay.palette` overrides `FilmLookParams.palette`; the look
       * itself is preserved here precisely so a bypass does not restyle the grade, and dropping the override
       * would restyle it anyway — the look's own palette would come back, and under `paletteMapping: 'index'`
       * the colour SOURCE would flip from the index law to depth. A preview switch that changes the figure's
       * colours cannot be used to compare anything.
       *
       * ⚠️ **AND WITHOUT THIS THE TWO BRANCHES OF `bypassOverlay` WOULD DISAGREE FOR NO REASON**: the
       * Materials-only branch spreads `...authored` and would keep the palette, while the FX branch rebuilds
       * from this function alone and would drop it. The palette is not a Visual FX effect and not a material
       * property, so an asymmetry between those two boxes could only be an accident of which branch was written
       * from what.
       *
       * ⚠️ Gated `!== undefined` and NOT for truthiness: `'none'` is an authored override meaning "no palette",
       * and it is the one value a truthy gate would silently turn back into "inherit the look's palette". The
       * two-copies-of-one-rule warning above covers these two lines as well.
       */
      ...(overlayPalette !== undefined ? { palette: overlayPalette } : {}),
      ...(overlayPaletteMapping !== undefined ? { paletteMapping: overlayPaletteMapping } : {}),
    };
  }

  /**
   * The overlay to hand the shared apply path, given the frozen capture and the two flags.
   *
   * ⚠️ **THE RENDER MODE GOES THROUGH `resolveModeAgainstMaterial()`, THE ONE OWNER, AND THIS ADDS NO FOURTH
   * HAND-WRITTEN `preset !== 'None'` TEST.** `splat` with no material draws NOTHING, so a materials-off that
   * left the mode at `splat` produces a **black preview** — exactly the failure this checkbox would be blamed
   * for (**84 of 399 presets carry a live material**).
   *
   * ⚠️ **MATERIALS-OFF FORCES `star`, WHICH IS THE OWNER'S EXPLICIT OVERRIDE OF THE PLAN AND OF MY OWN
   * RECOMMENDATION** (the plan says *"let that one resolver decide"*). **Its consequence, stated rather than
   * argued: 2 of 399 presets lose an authored iso-surface** (`VARIANT_PRESETS:Flower Power II`,
   * `VARIANT_PRESETS:Boiling Milk` — material-live AND liquid-ish), because `liquid` is the one mode a material
   * does not override.
   *
   * ⚠️ **AND IT IS FORCED ONLY WHERE A MATERIAL WAS ACTUALLY LIVE.** Unconditional `star` would rewrite the
   * authored mode of the **33 of 399** presets carrying a non-star mode with NO material at all — presets the
   * Materials box is not bypassing anything on. **Two figures, two bases; do not conflate 84 with 33.**
   *
   * ⚠️ **FX-OFF FLATTENS ONLY THE THREE MODES THAT *ARE* EFFECTS.** `volume`, `liquid` and `splat` each depend
   * on a subsystem this switch has just neutralised, so they become `star`; `pixel`/`blend`/`star` are plain
   * particle draws and are left alone. **The set is NAMED, not inferred from the union** — `src/` has ZERO
   * `switch` on `RenderMode`, so a new mode joins neither list silently. (It held four members until
   * `log-density` was retired on 2026-09-19; **count it, do not quote a size.**)
   */
  /**
   * v8 `26.8` — the stripped overlay: the figure, and nothing else.
   *
   * ⚠️ **IT STRIPS BY OMISSION PLUS THE THREE KEYS OMISSION DOES NOT NEUTRALISE**, exactly as the Visual FX
   * bypass does — `attractorIndex`/`attractorBlend`/`transMapEnabled` default to ON-ish values, so leaving
   * them out would leave an attractor and a warp running.
   *
   * ⚠️ **`pixel` MODE AND NO MATERIAL ARE ONE DECISION, NOT TWO.** `splat` with no material draws NOTHING,
   * so a strip that forced `pixel` while leaving a material live, or cleared the material while leaving
   * `splat`, is a black frame either way. The material is withheld and the mode forced in the same place.
   *
   * ⚠️ **IT MUST NOT TOUCH SPEED (`26.8`).** `speedFactor` 0 is the `Speed` row at its floor and the user
   * composes the two; a speed clause here would put two owners on one `overlay` key. `livePreservedOverlay()`
   * is spread in precisely so speed, the figure scale and the live grade survive.
   *
   * ⚠️ **AND THE GRADE IS FORCED TO `Legacy` WITH BLOOM OFF**, which is the one place the strip overrides
   * something `livePreservedOverlay()` preserves — a bloom-heavy look hides the curve, which is the whole
   * thing the strip exists to show. The spread order below is what makes that win.
   */
  function strippedOverlay(): OverlayState {
    const live = livePreservedOverlay();
    return {
      /*
       * Speed and figure scale survive; the grade is then overridden below.
       *
       * ⚠️ **SPREAD, NOT COPIED FIELD BY FIELD, BECAUSE `exactOptionalPropertyTypes` IS ON.** Naming
       * `speedFactor: live.speedFactor` makes the type `number | undefined`, which is NOT assignable to an
       * optional `number` under that flag — and the distinction is real rather than pedantic: an explicit
       * `undefined` is a key that EXISTS, while an absent key is the identity. Spreading only the two keys
       * keeps "absent stays absent".
       */
      ...(live.speedFactor !== undefined ? { speedFactor: live.speedFactor } : {}),
      ...(live.figureScale !== undefined ? { figureScale: live.figureScale } : {}),
      filmLook: 'Legacy',
      renderMode: 'pixel',
      // The three that omission does not neutralise.
      attractorIndex: -1,
      attractorBlend: 0,
      transMapEnabled: false,
      transMapBeforeParticles: false,
    };
  }

  function bypassOverlay(authored: OverlayState, p: UnifiedPreset): OverlayState {
    // ⚠️ **THE STRIP WINS OVER BOTH OTHER FLAGS**, because it is a strict superset of what they withhold:
    // asking for the bare curve while also asking to bypass materials cannot mean anything weaker.
    if (bypassStrip) return strippedOverlay();
    const authoredMaterial = authored.material ?? null;
    const materialWasLive = !!authoredMaterial && authoredMaterial.preset !== 'None';
    const authoredMode: RenderMode = authored.renderMode ?? p.renderer.mode ?? 'star';
    const requested: RenderMode = bypassVisualFx && !PLAIN_BYPASS_MODES.has(authoredMode) ? 'star' : authoredMode;
    const mode: RenderMode = bypassMaterials && materialWasLive
      ? 'star'
      : resolveModeAgainstMaterial(requested, bypassMaterials ? null : authoredMaterial);

    const kept: OverlayState = bypassVisualFx
      ? {
          ...livePreservedOverlay(),
          // The three keys omission does NOT neutralise — see the block header.
          attractorIndex: -1,
          attractorBlend: 0,
          transMapEnabled: false,
          transMapBeforeParticles: false,
        }
      // Materials-only: everything Visual FX authored stays, and only the material is withheld.
      : { ...authored, ...livePreservedOverlay() };

    if (!bypassMaterials && authoredMaterial) kept.material = authoredMaterial;
    else delete kept.material;
    kept.renderMode = mode;
    return kept;
  }

  /**
   * Bring the engine into line with the two flags. **Idempotent, and a no-op when neither box has ever been
   * ticked** — which is what makes it safe to call unconditionally from both apply paths.
   *
   * ⚠️ **CALLED FROM `applyPresetChange` AND FROM `resetOverlays`, NOT FROM THE TAB (invariant 23).** Both paths
   * re-apply the incoming preset's overlay unconditionally, so a preset load with a box ticked would otherwise
   * leave the checkbox silently lying about the picture. Doing it ENGINE-SIDE rather than from the Composer's
   * `onExternalChange` is the stronger placement: the bypass must hold with the Lab closed and with the Composer
   * tab never built, and neither of those has a subscriber.
   *
   * ⚠️ **THE SURVIVING SCOPE OF *"holds with the Lab closed"* IS NARROWER THAN IT READS, SINCE 2026-09-10: A
   * GENUINE PRESET SWITCH NOW CLEARS BOTH FLAGS** (`applyPresetChange`'s tail, owner's ruling). What still holds
   * across the closed Lab is a bypass over the SAME preset — every Sliders/Randomiser/Mixer re-apply, a Reset, a
   * keyboard shortcut. **The engine-side placement is what makes the CLEAR work too**, and for the same reason it
   * made the hold work: neither event is guaranteed a Composer subscriber, so a tab-side owner would have missed
   * both. **Do not read the clear as evidence this belongs in the tab.**
   */
  function applyBypassToEngine(): void {
    if (!preset) return;
    const anyOn = bypassVisualFx || bypassMaterials || bypassStrip;
    if (!anyOn && !bypassAuthoredOverlay) return;
    // ⚠️ The capture goes through `getSnapshot()` itself rather than re-deriving the overlay — one owner of what
    // the live state IS, including all four of its distinct export gates, which must NOT be unified or copied.
    if (!bypassAuthoredOverlay) bypassAuthoredOverlay = visualFxControls.getSnapshot();
    const authored = bypassAuthoredOverlay;
    const synthetic = anyOn ? bypassOverlay(authored, preset) : { ...authored, ...livePreservedOverlay() };
    bypassApplying = true;
    try {
      // ⚠️ **THE SHARED PATH, INVOKED RATHER THAN RE-IMPLEMENTED.** The spread is read-only for `resetOverlays`
      // (it reads `p.postProcessors.transMap.*`, `p.renderer.mode`, and forwards `p` to `reinitRenderer` /
      // `reinitTransMap`, which build their own synthetic presets from it) and it never assigns `preset = p`.
      visualFxControls.resetOverlays({ ...preset, overlay: synthetic });
    } finally {
      bypassApplying = false;
    }
    if (!anyOn) {
      bypassAuthoredOverlay = null;
      // ⚠️ The shared path cannot restore a `preset.fractal` attractor — see `applyPresetFractalAttractor`.
      applyPresetFractalAttractor(preset);
    }
  }

  // --- Shared preset-change logic ---
  function applyPresetChange(newPreset: UnifiedPreset): void {
    preset = newPreset;
    // Inert unless `?gldiag=1`. See `glDiagRearm` — a one-shot that fires on the startup preset can never
    // observe a configuration the reporter has to click their way to.
    glDiagRearm(`preset -> ${newPreset.metadata.name}`);
    // ⚠️ **Step 14.7b: the depth band is eased over ~0.25 s, so a preset change must SNAP it** — otherwise the
    // new figure's parallax slides into place from the old figure's band, which is a visible glide on exactly the
    // action a user takes to compare two presets. The pass cannot detect this itself: a legitimate per-frame band
    // delta from ordinary motion reaches 0.19, so no magnitude threshold separates the two (see `smoothDepthBand`).
    // Placed in `applyPresetChange` because it is the ONE apply path (invariant 23) — the startup preset included.
    depthField.resetBand();
    generator.dispose();
    initGenerator(generator, preset, canvas.width, canvas.height);
    // Reset attractor state: use the preset's own fractal config (not leftover UI state)
    // ⚠️ **The `if` half moved into `applyPresetFractalAttractor` (v8 16.18) because the bypass restore needs
    // the identical five lines — an EXTRACTION with two callers, not a tidy-up.** The `else` half stays here:
    // clearing the attractor is what a preset change does and what a bypass restore must NOT do.
    if (!applyPresetFractalAttractor(preset)) {
      currentAttractorIndex = -1;
      currentBlend = 0;
      generator.setAttractor(null);
    }
    renderer.dispose();
    initRenderer(renderer, backend, preset, canvas.width, canvas.height);
    // Film look: from the overlay if the preset declares one, else RESET TO `Legacy`.
    //
    // This fell back to `currentFilmLook` until 2026-08-06, i.e. a preset with no `overlay.filmLook`
    // INHERITED whatever look happened to be active. **None of the 177 legacy presets can declare one**
    // — they are pre-v2 and have no `overlay` block at all — so switching between them never reset the
    // grade, and a look picked for one preset silently followed you through the whole library.
    //
    // Film look was the only overlay field behaving that way: `ribbonMode` falls back to `'off'`,
    // `lineWidth` to `1.5`, and `resetOverlays` already used `?? 'Legacy'` for this very field. So this
    // aligns the preset-change path with both the documented rule ("missing fields leave runtime state
    // unchanged" applies to VALUES within a declared block, not to whether a block applies at all) and
    // with the sibling reset path.
    //
    // Called once, not twice, to avoid a double GPU allocation (D-03) — hence seeding the custom params
    // BEFORE the call rather than applying a look and then patching it.
    const incomingFilmLook = preset.overlay?.filmLook ?? 'Legacy';
    if (incomingFilmLook === CUSTOMIZE_FILM_LOOK && preset.overlay?.customFilmLookParams) {
      Object.assign(customFilmLookParams, preset.overlay.customFilmLookParams);
    }
    // v8 Step 21.4c — the overlay's palette override, adopted BEFORE the look is applied because
    // `applyFilmLook` ends in `applyPaletteSelection()` and would otherwise resolve against the previous
    // preset's override. ⚠️ **Assigned unconditionally, `undefined` included** — a `??` fallback here would
    // make an override leak from one preset into the next, which is precisely the defect the `filmLook`
    // fallback above documents at length ("a look picked for one preset silently followed you through the
    // whole library"). There is no default to fall back TO: absent means "the film look decides".
    overlayPalette = preset.overlay?.palette;
    overlayPaletteMapping = preset.overlay?.paletteMapping;
    overlayPaletteHueShift = preset.overlay?.paletteHueShift ?? 0;
    applyFilmLook(incomingFilmLook);
    transMap.dispose();
    initTransMap(transMap, gl, preset, canvas.width, canvas.height);
    // `trailDecay` is NOT set from `preset.renderer.decayFactor` here — style 6 overrides it, so it is
    // derived once by `applyFluidFeedbackState()` below, after the overlay has settled both the style
    // and `currentFluidFeedback`. Assigning it here as well would put the decision in two places, which
    // is the defect this helper exists to remove.
    blurEnabled = preset.renderer.blurRadius > 0;
    speedFactor = preset.overlay?.speedFactor ?? 1.0;
    figureScale = preset.overlay?.figureScale ?? 1.0;
    generator.setViewScale(figureScale);
    particleSizeScale = preset.overlay?.particleSize ?? 1.0;
    renderer.setParticleSize(particleSizeScale);
    // 27.6 — the splat shear convention. Read as `?? 'tangent'`, which is the pre-27.6 behaviour, so a
    // preset without the key is byte-identical and the identity-gate rule in 27.D-land is satisfied by the
    // DEFAULT equalling the omitted value rather than by a normaliser at the reader.
    splatShear = preset.overlay?.splatShear ?? 'tangent';
    renderer.setSplatShear(splatShear === 'fixed');
    symmetryFold = preset.overlay?.symmetryFold ?? 1;
    symmetryMirror = preset.overlay?.symmetryMirror ?? true;
    generator.setSymmetry(symmetryFold, symmetryMirror);
    adoptSym3d(preset.overlay);   // v8 Phase 42 — the same path, the same obligation
    adoptTwist(preset.overlay);   // v8 30.1 — one of the four adoption paths; see adoptTwist's header
    adoptTaperBend(preset.overlay);   // v8 32.1/32.2 — the same path, the same obligation
    adoptFigureBasis(preset.overlay);   // v8 33.2/33.3 - Sharpness and Travel, same path
    adoptEscapeFlow(preset.overlay);   // v8 33.4 - the escape foliation, same obligation
    adoptInversion(preset.overlay);   // v8 32.7 — ditto
    adoptBoxFold(preset.overlay); // v8 30.2 — same four paths
    adoptFractalFold(preset.overlay); // v8 Phase 38 — the same path, the same obligation
    adoptChannels(preset.overlay);  // v8 31.2 — the per-particle channels, same four paths
    adoptDeform4d(preset.overlay);  // v8 31.3 + 31.4 — the fold and the 4D rotation, same four paths
    const newCurl = preset.overlay?.curlNoise ?? DEFAULT_CURL;
    currentCurl.enabled = newCurl.enabled;
    currentCurl.turbulence = newCurl.turbulence;
    currentCurl.scale = newCurl.scale;
    currentCurl.evolutionSpeed = newCurl.evolutionSpeed;
    generator.setCurlNoise({ ...currentCurl });
    generator.resetCurlTime();
    // D16: reset the flow/TransMap clock alongside the curl one. Both drive procedural appearance from
    // accumulated time, and leaving this running meant a preset's look depended on session uptime and on the
    // speedFactor of every preset shown before it.
    elapsedTime = 0;
    generator.setPhysarumProcessor(
      currentPhysarum.blend > 0 ? physarumProcessor : null,
      currentPhysarum,
    );
    // Reset fluid offsets and prev positions on preset change. `fluidPrevCount = 0` is what makes the
    // grow-only buffers (D8) still forget history across a preset change: the buffers themselves may be
    // reused, but every slot is re-zeroed on the next frame's grow check.
    fluidProcessor.resetOffsets(0);
    fluidPrevPositions = null;
    fluidSmoothedVel = null;
    fluidUVs = null;
    fluidVelUVs = null;
    fluidPrevCount = 0;
    // Render mode: an explicit overlay value wins; otherwise KEEP the live mode when this is the SAME
    // preset being re-applied, and only fall back to the preset's own mode on a genuine switch.
    //
    // This was `preset.renderer.mode ?? 'star'` unconditionally, so ANY re-apply of the working preset
    // discarded a live Render Mode choice — and re-applies are common: every Sliders/Randomiser/Mixer
    // move rebuilds the preset and emits. Symptom: pick Blend, nudge the Glow slider, and you are
    // silently back in star mode where `uGlow` is ignored, making Glow look broken. Reported 2026-08-06.
    //
    // Keying on the NAME rather than on object identity is deliberate. `main.ts`'s `preset` and the Lab's
    // `state.workingPreset` are DIFFERENT OBJECTS — `labPanel.init` deep-copies at startup and they only
    // converge after a grid click — so neither an identity test nor writing the overlay from
    // `setRenderMode` is reliable. The name is the one thing both copies agree on.
    //
    // Consequence, and it matches how film look and the crystal config behave: render mode is user-owned
    // live state that survives editing a preset, and is replaced when you actually change preset.
    const isSamePreset = preset.metadata.name === lastAppliedPresetName;
    currentRenderMode = preset.overlay?.renderMode
      ?? (isSamePreset ? currentRenderMode : (preset.renderer.mode ?? 'star'));
    lastAppliedPresetName = preset.metadata.name;
    // The fullscreen name label reads that field, so this is where it learns the name moved (a reel switch, an
    // arrow key). A no-op unless the label is currently up — see its declaration near the panel-mode state.
    refreshFullscreenPresetLabel();
    previousRenderMode = currentRenderMode;
    currentTransMapEnabled = preset.postProcessors.transMap.enabled;
    // v8 Step 14.6 — resolved overlay-first, exactly as `currentTransMapEnabled` is at its overlay site below
    // (invariant 17, `fieldcheck` §I). Reset from the PRESET here rather than left alone, so a preset with no
    // opinion loads as warp-last rather than inheriting the previous preset's order.
    currentTransMapBeforeParticles = preset.overlay?.transMapBeforeParticles
      ?? preset.postProcessors.transMap.beforeParticles;
    // Derived the same way `initTransMap(…, preset, …)` above derived it, from the same preset — so the
    // live chain and the GPU pass agree without a second `setChain`. A preset carrying a multi-layer
    // `overlay.transMapChain` arrives here with that chain; every legacy preset with its single style.
    currentTransMapChain = chainFromOverlay(
      preset.overlay,
      preset.postProcessors.transMap.style,
      preset.postProcessors.transMap.ifsParams,
    );
    currentIfsParams = cloneIfsParams(preset.postProcessors.transMap.ifsParams ?? defaultIfsParams());
    ribbonRenderer.setGlow(preset.renderer.glow);
    neonLineRenderer.setGlow(preset.renderer.glow);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboState.fboA);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboState.fboB);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Reset ALL overlay state to defaults first, then apply preset's overlay values.
    // This ensures no state leaks between presets regardless of which fields are present.
    const ov = preset.overlay ?? {};

    // --- Visual FX: ribbon, lines, attractor ---
    ribbonState = ov.ribbonMode ?? 'off';
    if (ribbonState !== 'off') {
      ribbonRenderer.setMode(ribbonState as RibbonMode);
    }
    ribbonWidth = ov.ribbonWidth ?? 3.0;
    ribbonRenderer.setRibbonWidth(ribbonWidth);
    linesEnabled = (ribbonState === 'off') ? (ov.linesEnabled ?? false) : false;
    neonLineWidth = ov.lineWidth ?? DEFAULT_LINE_WIDTH;
    neonLineRenderer.setLineWidth(neonLineWidth);
    // v8 Phase 40 — a new preset starts its discharge from an empty buffer, never from the last one's filaments.
    discharge = readDischarge(ov);
    coupleDischargeToLines();
    electricDischarge.reset();

    // Attractor: preset.fractal (handled above) takes priority; overlay attractor is additive
    if (!preset.fractal) {
      const newIdx = ov.attractorIndex ?? -1;
      const newBlend = ov.attractorBlend ?? DEFAULT_ATTRACTOR_BLEND;
      currentBlend = newBlend;
      currentAttractorIndex = newIdx;
      if (newIdx < 0) {
        generator.setAttractor(null);
      } else {
        const ap = ATTRACTOR_PRESETS[newIdx];
        if (ap) {
          generator.setAttractor({
            type: ap.type,
            params: ap.params,
            blend: newBlend,
            bounds: ap.bounds,
            ...(ap.maxIter !== undefined ? { maxIter: ap.maxIter } : {}),
          });
        }
      }
    }

    // Film look is applied ONCE, further up, from `incomingFilmLook`. A second
    // `applyFilmLook(CUSTOMIZE_FILM_LOOK)` used to sit here and was redundant — the block above already
    // seeds `customFilmLookParams` and applies the look — so it re-ran the renderer/bloom/toneMap
    // dispose+init cycle a second time on every preset change carrying a Customize look, which is
    // exactly the double GPU allocation D-03 exists to avoid.

    // Render mode: re-init the renderer if the effective mode differs from what `initRenderer` was given.
    //
    // Compared against `preset.renderer.mode` — the mode the earlier `initRenderer` call actually used —
    // NOT against `currentRenderMode`. Those were the same thing until 2026-08-06; now `currentRenderMode`
    // is resolved from `overlay.renderMode` further up, so comparing against it would always be equal and
    // the renderer would keep the preset's authored mode while every other consumer used the overlay's.
    if (currentRenderMode !== (preset.renderer.mode ?? 'star')) {
      // The state re-handed here is the state as it stands NOW — the material block below and
      // `applyOverlayConfigBlocks` both re-hand again once they have settled the incoming preset's
      // values, so this is not the authoritative apply. It exists so the window between the two is
      // never a renderer with no material at all.
      reinitRenderer(currentRenderMode);
    }
    // Adopt the mode the renderer actually ended up in — either call above may have fallen back to 'star'
    // for want of `EXT_color_buffer_float` (ADR 010). Without this, `currentRenderMode` and the Visual FX
    // dropdown advertise a mode that is not being drawn (R10). This covers the common case: an unsupported
    // mode arrives from a PRESET far more often than from the dropdown.
    reconcileRenderMode();

    // TransMap: reset to preset's base postProcessors values (already inited above at line 584-585)
    // Only re-init if overlay overrides the base transMap config.
    // `transMapChain` joins the three existing triggers: an import whose only TransMap divergence is a
    // multi-layer chain must still re-init, and it carries no `transMapStyle` at all.
    if (ov.transMapEnabled !== undefined || ov.transMapStyle !== undefined || ov.ifsParams !== undefined || ov.transMapChain !== undefined) {
      currentTransMapEnabled = ov.transMapEnabled ?? preset.postProcessors.transMap.enabled;
      currentTransMapChain = chainFromOverlay(ov, preset.postProcessors.transMap.style, preset.postProcessors.transMap.ifsParams);
      currentIfsParams = cloneIfsParams(ov.ifsParams ?? preset.postProcessors.transMap.ifsParams ?? defaultIfsParams());
      reinitTransMap();
    }

    // Warp mix, force field, procedural flow — always reset from overlay
    // v8 Step 14.6 — resolved overlay-first here too; the preset-side value was already read above, and this
    // is the site that lets an EXPORT's order win over the preset block it travels beside (invariant 17).
    currentTransMapBeforeParticles = ov.transMapBeforeParticles ?? preset.postProcessors.transMap.beforeParticles;
    currentTransMapWarpMix = ov.transMapWarpMix ?? 1.0;
    currentTransMapForceBlend = ov.transMapForceBlend ?? 0;
    currentTransMapForceReturn = ov.transMapForceReturn ?? 1.5;
    currentTransMapForceSparks = ov.transMapForceSparks ?? false;
    // v8 Step 14.4 — reset from the overlay on the same discipline as the three above, so a preset without
    // a gate loads as ungated rather than inheriting the previous preset's.
    currentForceGateBy = ov.transMapForceGateBy ?? 'none';
    currentForceGateAmount = ov.transMapForceGateAmount ?? 0;
    currentForceGateInvert = ov.transMapForceGateInvert ?? false;
    currentForceGateHalfLife = ov.transMapForceGateHalfLife ?? 2.0;
    if (ov.fluidFeedback) Object.assign(currentFluidFeedback, ov.fluidFeedback);
    // ⚠️ **Resolution order: the flat key wins, then the legacy nested one, then 0.** Read AFTER the
    // `Object.assign` above so `currentFluidFeedback.dispersion` is the incoming preset's value and not the
    // previous preset's — the exact stale-inheritance shape invariant 14 is about, just reached through a
    // sibling field instead of a missing key. An export written before 2026-08-20 carries dispersion only
    // under `fluidFeedback`, so dropping the second clause would silently zero those files' fringing.
    currentTransMapDispersion = ov.transMapDispersion ?? ov.fluidFeedback?.dispersion ?? 0;
    // Derived here, and only here, for this whole function: both flags and `currentFluidFeedback` are
    // now final. This also supplies the `trailDecay` assignment removed from the top of the function.
    applyFluidFeedbackState();
    if (ov.proceduralFlow) {
      Object.assign(currentProceduralFlow, cloneFlowConfig(ov.proceduralFlow));
    } else {
      Object.assign(currentProceduralFlow, cloneFlowConfig(DEFAULT_PROCEDURAL_FLOW));
    }
    transMapForce.resetOffsets();

    // --- Processors: always reset to defaults, then apply preset values ---
    // --- Material ---
    // Kept HERE, not in `applyOverlayConfigBlocks`: this path switches INTO splat as well as out of it,
    // whereas `resetOverlays` only reverts. And it must run BEFORE the shared blocks, because the
    // buoyancy/crystal calls below hand configs to `renderer`, which the branch here may dispose and
    // re-init — forwarding them first would send them to a renderer that is about to be replaced.
    //
    // ⚠️ **The switch INTO splat goes through `resolveModeAgainstMaterial`, which EXEMPTS `liquid`** — see
    // that function's header for the user report and the measurement. Before 2026-09-01 this branch tested
    // `currentRenderMode !== 'splat'` directly, so a preset carrying both `overlay.renderMode: 'liquid'`
    // and a material had its correctly-resolved liquid mode overwritten ~60 lines after the resolution at
    // the top of this function, on every single apply. The tile did it the other way round and was right.
    //
    // ⚠️ **v8 9.3: this path gets NO `applyPhysarumTrailColour()` call, and that is a claim about ORDER, not
    // about the material being irrelevant.** `applyOverlayConfigBlocks(ov)` twelve lines below ends the
    // physarum block with that call, and it runs AFTER this assignment — so the resolver already sees the
    // incoming material. Recorded here rather than relied on silently, exactly as `setMaterialConfig`'s decay
    // cap records the same incidental coverage: moving this assignment below the shared blocks would leave
    // `'(Auto)'` resolving against the OUTGOING preset's material, and nothing would fail — one preset's
    // trail would simply carry the previous one's ramp.
    currentMaterial = ov.material ?? null;
    generator.setMaterialConfig(currentMaterial);
    renderer.setMaterialConfig(currentMaterial);
    const modeWithMaterial = resolveModeAgainstMaterial(currentRenderMode, currentMaterial);
    if (modeWithMaterial !== currentRenderMode) {
      previousRenderMode = currentRenderMode;
      currentRenderMode = modeWithMaterial;
      reinitRenderer(modeWithMaterial);
    } else if ((!currentMaterial || currentMaterial.preset === 'None') && currentRenderMode === 'splat') {
      const fallback = previousRenderMode !== 'splat' ? previousRenderMode : 'star';
      currentRenderMode = fallback;
      reinitRenderer(fallback);
    }

    // Physarum, fluid, buoyancy, sparks, volume, crystal — shared with `resetOverlays` (D5).
    applyOverlayConfigBlocks(ov);

    // A preset switch reallocates buffers, recompiles programs and re-warms trails, so the next few
    // frames are unrepresentatively slow. Clear the PerfGuard window and release any latch, otherwise
    // the switch itself can trip the guard and freeze every tile grid — and a heavy preset can never
    // recover, because recovery requires the frame rate the preset itself prevents. NOT shared: a Lab
    // Reset reallocates nothing and must not clear the guard's measurement window.
    perfGuard?.reset();

    /*
     * v8 16.18 (E109) — re-neutralise, because this path has just applied the INCOMING preset's overlay in full.
     *
     * ⚠️ **THE CAPTURE IS DROPPED FIRST, AND THAT ORDER IS THE WHOLE CORRECTNESS OF THE FEATURE ACROSS A PRESET
     * CHANGE.** The capture is *"what THIS preset authored"*; carried across a switch it would export the
     * previous preset's decoration over the new preset's figure, and Snapshot would write that into history.
     * `applyBypassToEngine()` re-captures from live state on the next line, so the report always describes the
     * preset on screen.
     *
     * ⚠️ **BEFORE `notifyExternalChange()`, so every subscriber sees the settled state ONCE.** After it, the two
     * checkboxes would resync against the authored overlay and then be corrected a moment later — the tab would
     * flicker its own controls on every preset change.
     *
     * ⚠️ **A GENUINE PRESET SWITCH SWITCHES BOTH BOXES BACK ON — OWNER'S RULING 2026-09-10, REVERSING E109'S
     * SHIPPED DECISION** (*"whenever a new preset is selected, those two checkboxes should be enabled again"*).
     * E109 held the flags engine-side so that they SURVIVED a load, and the user report is what that costs: you
     * bypass the effects to look at one figure, go back to the Grid, pick another preset, and the new preset is
     * silently drawn neutralised while nothing on screen says so unless the Composer tab happens to be open.
     * **Reported as two symptoms — the boxes staying unticked and *"the preset does not show correctly in the
     * preview"* — which are ONE cause: the bypass is a re-apply, so a live bypass rewrites the incoming
     * preset's mode and drops its material.** `04`'s step 106h asserted the OLD behaviour and is inverted.
     *
     * ⚠️ **GATED ON `isSamePreset`, WHICH IS THE EXISTING DISCRIMINATOR AND NOT A NEW ONE (see its declaration
     * ~190 lines above) — UNGATED, EVERY SLIDER DRAG WOULD UNTICK THE BOXES.** Every Sliders/Randomiser/Mixer
     * move rebuilds the working preset and emits `preset-changed`, so `applyPresetChange` runs constantly with
     * the SAME preset; clearing there is a control silently undoing a different control's state — E109's own
     * `bypassApplying` trap in the other direction. **`lastAppliedPresetName` has already been overwritten by
     * this point, so read `isSamePreset`, never re-derive the comparison here.**
     *
     * ⚠️ **CLEARING THE FLAGS *AND* THE CAPTURE MAKES `applyBypassToEngine()` AN EARLY RETURN, WHICH IS THE
     * POINT: the incoming preset's overlay has already been applied IN FULL above.** Clearing only the flags
     * would leave the capture non-null and send it down the RESTORE branch, re-applying the OUTGOING preset's
     * authored overlay over the new figure — the export-carries-the-wrong-decoration defect this block's first
     * paragraph exists to prevent, arriving through the pixels instead.
     */
    if (!isSamePreset) {
      bypassVisualFx = false;
      bypassMaterials = false;
    }
    bypassAuthoredOverlay = null;
    applyBypassToEngine();

    notifyExternalChange();
  }

  // --- Synthesis Lab integration ---
  const allPresets = presetNames.map(n => presetManager.getWorkingCopy(n)).filter(Boolean) as UnifiedPreset[];
  const presetStats = computePresetStatistics(allPresets);

  // GridTileRenderers for evolution and history tiles (created before labPanel)
  evoTileRenderer = new GridTileRenderer(gl);
  evoTileRenderer.init();
  const historyTileRenderer = new GridTileRenderer(gl);
  historyTileRenderer.init();
  /*
   * A THIRD tile renderer, for the Reel tab — ⚠️ **ONE instance serving BOTH of its panes.**
   *
   * `STEADY_BUDGET_MS` is per-instance, so a fourth instance would be another 10 ms of a 16.7 ms frame with
   * nothing arbitrating between them (`perfGuard`'s gate above turns them all off together; it does not divide
   * a budget). The Reel tab therefore namespaces its slot keys — `reel-strip-<i>` and `reel-browse-<name>` —
   * rather than taking a second renderer. See the write-up at the top of `tabs/reel.ts`.
   */
  const reelTileRenderer = new GridTileRenderer(gl);
  reelTileRenderer.init();

  // VisualFxControls — bridge between the Visual FX Lab tab and the render-loop state
  //
  // A LIST, not a single slot. Two tabs now subscribe (Visual FX and Materials), and the previous
  // single-slot assignment meant whichever registered last silently won: the other tab then went
  // stale on every external change (preset switch, keyboard shortcut) while still on screen.
  const externalChangeCallbacks: Array<() => void> = [];
  const notifyExternalChange = (): void => {
    for (const cb of externalChangeCallbacks) cb();
  };
  const visualFxControls: VisualFxControls = {
    getSplatShear: () => splatShear,
    setSplatShear: (v) => {
      // ⚠️ Narrowed here rather than trusted: this arrives from a DOM select's string value, and the
      // renderer takes a boolean, so an unexpected string must land on the DEFAULT rather than on `fixed`.
      splatShear = v === 'fixed' ? 'fixed' : 'tangent';
      renderer.setSplatShear(splatShear === 'fixed');
    },
    getRibbonState: () => ribbonState,
    setRibbonState: (mode) => {
      ribbonState = mode;
      if (mode !== 'off') {
        ribbonRenderer.setMode(mode as RibbonMode);
        linesEnabled = false;
        coupleDischargeToLines();
      }
    },
    getRibbonWidth: () => ribbonWidth,
    setRibbonWidth: (w) => { ribbonWidth = w; ribbonRenderer.setRibbonWidth(w); },
    getLinesEnabled: () => linesEnabled,
    setLinesEnabled: (on) => { linesEnabled = on; if (on) { ribbonState = 'off'; } coupleDischargeToLines(); },
    getDischarge: () => ({ ...discharge }),
    setDischarge: (patch) => {
      const wasOn = discharge.enabled;
      discharge = { ...discharge, ...patch };
      // Coupled (see `coupleDischargeToLines`): switching the discharge ON switches the neon lines on, which in
      // turn ends ribbons — the same exclusion `setLinesEnabled` applies.
      if (discharge.enabled && !linesEnabled) { linesEnabled = true; ribbonState = 'off'; }
      // Switched ON: start from an empty buffer, so stale filaments from the last time it was on do not flash.
      if (!wasOn && discharge.enabled) electricDischarge.reset();
    },
    getLineWidth: () => neonLineWidth,
    setLineWidth: (w) => { neonLineWidth = w; neonLineRenderer.setLineWidth(w); },
    getFilmLook: () => currentFilmLook,
    // ⚠️ 21.4g — `adoptLookPalette()` is what makes "choosing a look chooses its palette" true, and it
    // belongs HERE rather than in `applyFilmLook` because this setter is only ever reached from a user
    // choosing a look (this tab's `Look` row, or a material's `presentation.filmLook` from the Materials
    // tab). See `adoptLookPalette`'s header for what materialising on the load path would cost.
    /*
     * ⚠️⚠️ **`Customize` IS NOT A LOOK CHOICE AND MUST ADOPT NOTHING — owner requirement, 2026-10-31,
     * verbatim in intent: *"switching from an authored film look to Customize should not have any effect on
     * the settings; the look remains identical and nothing can go black."*** Picking `Customize` only makes
     * the live bundle EDITABLE — `applyFilmLook` deliberately does not re-seed on that branch — so there is
     * no new colour decision to materialise. Adopting there wrote the SEED bundle's palette pair over
     * `overlay.palette` / `overlay.paletteMapping`, i.e. over the preset's own authored selection, and
     * because the destination is the preset body it was unrecoverable: re-picking the original look adopts
     * the same pair again, so only a reload brought it back.
     *
     * **Measured on `Warp Split Shapes` (2026-10-31, the report that found this):** authored
     * `Cycle: Storm`/`index` → picking `Customize` wrote `Teal & Orange`'s own `Sunset`/`depth`, and the
     * frame went from mean 7.31 / sd 7.57 to mean 5.40 / **sd 0.50** — the figure gone, because `Sunset` is
     * a cosine palette sitting at ≈(0, 0, 0.06) where that figure's depth coordinate concentrates. ⚠️ **The
     * grading sliders cannot recover a black ramp — they multiply zero**, which is why it read as a dead
     * pipeline rather than as a palette change.
     *
     * ⚠️ **This is the 2026-09-19 owner report one case wider.** That fix covered only the bundles whose
     * `palette` is `'none'` (`lookPaletteForAdoption` returns `null`); a `Customize` seeded from a CARRIER
     * still destroyed the override. For a NAMED look the adoption stays — that is 21.4g's rule and
     * `palettecheck` §H asserts it over every carrier × authored pair.
     *
     * ⚠️ **The Materials two-step path is unaffected and strictly better off:** `applyPresentation` sends
     * `filmLook: 'Customize'`, patches `customFilmLookParams`, then calls `adoptLookPalette()` ITSELF — so
     * the set's own palette still wins, and the write this gate removes was the STALE one that §H's own
     * header describes (the previous preset's Customize state, captured between the two calls).
     */
    setFilmLook: (name) => {
      applyFilmLook(name);
      if (name !== CUSTOMIZE_FILM_LOOK) adoptLookPalette();
    },
    getCustomFilmLookParams: () => ({ ...customFilmLookParams }),
    setCustomFilmLookParam: (patch: Partial<FilmLookParams>) => { applyCustomParam(patch); },
    /*
     * v8 Step 21.4c — the overlay palette pair; the bodies are `applyOverlayPalette` /
     * `applyOverlayPaletteMapping`, hoisted next to `applyFilmLook` by `21.4g` so that the look-adoption
     * path shares them rather than owning a second copy of the preset write.
     *
     * ⚠️ **NO GETTERS — and their absence is the 21.4g design, not an omission.** There is one palette
     * control now and it displays the RESOLVED selection (`getPaletteSelection()`), so a getter returning the
     * raw stored override would be a second, subtly different answer to "which palette is showing" — the two
     * would agree in every state except the one that matters (a preset loaded but not yet touched, where the
     * override is absent and the look supplies the palette). That is invariant 17's shape in the readout.
     */
    setOverlayPalette: (name) => { applyOverlayPalette(name); },
    setOverlayPaletteMapping: (m) => { applyOverlayPaletteMapping(m); },
    // 21.4g — exposed for the two-step look path only (a material's `presentation`); see the interface
    // comment in `visual-fx.ts` for why re-adopting after `setCustomFilmLookParam` is required and why
    // this must never be reached from a slider.
    adoptLookPalette: () => { adoptLookPalette(); },
    getPaletteSelection: () => livePaletteSelection,
    /*
     * v8 Step 21.4e — `Index Cycles` (`colorFreq`) and `Colour Drift` (`colorShift`), per channel.
     *
     * ⚠️ **BOTH WRITES ARE REQUIRED, for `setRotationSpeed`'s reason**: the generator is what draws this
     * frame, `preset.generators` is what Export, the Mixer, the Randomiser and `preset-stats` read. Writing
     * only one is invariant 13 in one direction or the other.
     *
     * ⚠️ **Written to `generators`, not to a new `overlay` field.** Both vectors already have four mutating
     * consumers each (`interpolate`, `evolution-ops`, `randomize`, `preset-stats`), so an overlay twin would
     * be two sources of truth for one number and all four would have to learn which wins (invariant 17) — the
     * same call `setParticleCount` and `setRotationSpeed` already made.
     *
     * No clamp: both are rates the law tolerates at any magnitude, and the law's own `clamp(…, 0, 255)`
     * bounds the OUTPUT. The tracks' ranges are therefore the only limit, and they are cosmetic by the
     * *Slider tracks* rule — stated here so nobody adds a second clamp expecting one to already exist.
     */
    getIndexCycles: () => generator.getColorFreq(),
    setIndexCycles: (channel, v) => {
      const next = generator.getColorFreq();
      next[channel] = v;
      generator.setColorFreq(next);
      if (preset) preset.generators.colorFreq = next;
    },
    getColourDrift: () => generator.getColorShift(),
    setColourDrift: (channel, v) => {
      const next = generator.getColorShift();
      next[channel] = v;
      generator.setColorShift(next);
      if (preset) preset.generators.colorShift = next;
    },
    // The instant is `INDEX_SWATCH_POS` and is applied HERE rather than passed in — invariant 28 forbids making
    // it a caller's parameter, and the interface accordingly has no `pos` argument to forward.
    sampleIndexColours: (n) => generator.sampleIndexColours(n, INDEX_SWATCH_POS),
    getAttractorIndex: () => currentAttractorIndex,
    setAttractorIndex: (idx) => {
      currentAttractorIndex = idx;
      if (idx < 0) {
        generator.setAttractor(null);
      } else {
        const ap = ATTRACTOR_PRESETS[idx];
        if (ap) {
          generator.setAttractor({
            type: ap.type,
            params: ap.params,
            blend: currentBlend,
            bounds: ap.bounds,
            ...(ap.maxIter !== undefined ? { maxIter: ap.maxIter } : {}),
          });
        }
      }
    },
    getAttractorBlend: () => currentBlend,
    setAttractorBlend: (v) => {
      currentBlend = v;
      if (currentAttractorIndex >= 0) generator.setAttractorBlend(v);
    },
    getSpeedFactor: () => speedFactor,
    // ⚠️ **Floor 0.1 -> 0.01 (2026-08-20), and it is the load-bearing half of that change.** The request was
    // for a slower slider; the slider's own `min` is cosmetic, this clamp is what the engine obeys, so a
    // UI-only edit would have moved the handle below 0.1 and changed nothing (invariant 13). Nothing divides
    // by `speedFactor` — it is a dt multiplier only (`dt * speedFactor`, and `dtScale` for the attractors,
    // which already documents a working 0.1) — so a smaller floor cannot produce a division blow-up, and 0
    // stays excluded because a hard stop is the Pause button's job, not this slider's.
    setSpeedFactor: (v) => { speedFactor = Math.max(SPEED_MIN, Math.min(SPEED_MAX, v)); },
    getFigureScale: () => figureScale,
    setFigureScale: (v) => {
      figureScale = Math.max(0.2, Math.min(5.0, v));
      generator.setViewScale(figureScale);
    },
    /**
     * Particle Size — the global multiplier on every particle path's own base size.
     *
     * ⚠️ **The clamp shares `PARTICLE_SIZE_MIN`/`MAX` with the slider's own track**, rather than repeating
     * two literals here: a range `min` is cosmetic and the engine's clamp is what moves, so two numbers
     * that can drift are invariant 13 waiting to happen (`SPEED_MIN` above is the same pattern).
     *
     * Unlike `setFigureScale`, this hands the value to the RENDERER, not the generator — it scales
     * `gl_PointSize`/the splat quad, never the particle's position.
     */
    getParticleSize: () => particleSizeScale,
    setParticleSize: (v) => {
      particleSizeScale = Math.max(PARTICLE_SIZE_MIN, Math.min(PARTICLE_SIZE_MAX, v));
      renderer.setParticleSize(particleSizeScale);
    },
    /**
     * The pixel figure printed beside the multiplier. Delegated to the renderer, which is the only object
     * that can see the render mode, the canvas size, the live material's `splatRadius` and the hardware
     * point-size ceiling at once (invariant 17: one resolver, not two).
     */
    getParticlePixelEstimate: () => renderer.estimateParticlePixels(),
    /**
     * X/Y/Z rotation speed, in the STORED unit (degrees/second). The slider converts to RPM for display —
     * see `core/rotation-track.ts`, which owns the unit, the sign convention and the curve.
     *
     * ⚠️ **Reads from the GENERATOR, not from `preset.generators.rotation`**, the same choice and the same
     * reason as `getParticleCount` below it: the generator holds what is actually being animated, it is what
     * clamps, and `main.ts`'s `preset` and the Lab's `state.workingPreset` are different objects that only
     * converge on a grid click. Reading the preset would show a stale number after a Randomiser mutation or
     * a Sliders-tab `Depth` move, both of which write the generator through a re-init.
     */
    getRotationSpeed: () => generator.getRotationSpeed(),
    /**
     * Writes BOTH the generator (so it takes effect this frame) and `preset.generators.rotation` (so it
     * survives Export, is interpolated by the Mixer and is what `Depth` multiplies against) — the same
     * arrangement `setParticleCount` uses, and for the reason spelled out there: `rotation` already has
     * seven mutating consumers, so an `overlay` twin would create two sources of truth for one number and
     * every one of them would have to learn which wins (invariant 17).
     *
     * ⚠️ **Not via `initGenerator()`**, which resets `pos` to 0 and re-reads `angle` — a drag would snap the
     * figure back to its opening pose on every step. `setRotationSpeed` changes a RATE and leaves the
     * current pose alone, which is what makes the three sliders continuous to drag.
     *
     * The generator clamps, so read the clamped value back rather than storing the requested one: otherwise
     * an out-of-range import would export a value the engine never used.
     */
    setRotationSpeed: (axis, v) => {
      const next = generator.getRotationSpeed();
      next[axis] = v;
      generator.setRotationSpeed(next);
      if (preset) preset.generators.rotation = generator.getRotationSpeed();
    },
    getSym3d: () => ({ ...sym3d }),
    getSym3dCopies: () => generator.getSymmetry3dCopies(),
    setSym3d: (patch) => {
      sym3d = { ...sym3d, ...patch };
      generator.setSymmetry3d(sym3d);
    },
    getSymmetryFold: () => symmetryFold,
    setSymmetryFold: (v) => {
      symmetryFold = Math.max(1, Math.min(12, Math.round(v)));
      generator.setSymmetry(symmetryFold, symmetryMirror);
    },
    /*
     * v8 `30.1` — the live twist. Per-axis `set`, because the UI control is a `tripletRow` whose three
     * sliders each write only their own axis (`30.D6`), exactly as `setRotationSpeed` is shaped.
     *
     * ⚠️ **The clamp lives in the GENERATOR's setter, not here**, so a value arriving from an import that
     * never passed a slider is bounded by the same constant the track is drawn from
     * (`TWIST_MAX_TURNS`). This reads the clamped value back so the UI cannot show a number the engine
     * is not using.
     */
    /*
     * v8 `30.2` — the live box-fold. One getter for the whole operator and one setter per field, because
     * the UI has four separate rows while the generator takes the four together: each setter writes its
     * own field into the shared object and re-hands the lot.
     */
    getBoxFold: () => ({ ...boxFold }),
    setBoxFoldIterations: (v: number) => { boxFold.iterations = v; handBoxFold(); },
    setBoxFoldLimit: (v: number) => { boxFold.limit = v; handBoxFold(); },
    setBoxFoldScale: (v: number) => { boxFold.scale = v; handBoxFold(); },
    getFractalFold: () => ({ ...fractalFold }),
    setFractalFold: (patch) => { Object.assign(fractalFold, patch); handFractalFold(); },
    /*
     * v8 `31.2` — the live per-particle channels. One getter for the whole operator and one setter per
     * field, the box-fold's shape. ⚠️ **The driver's setter takes a `ChannelDriver`, not a string**, so the
     * UI cannot hand it a word the enumeration does not contain — the validation above is for IMPORTS,
     * which are the only untyped source.
     */
    getChannels: () => ({ ...channels }),
    setChannelDriver: (d: ChannelDriver) => { channels.driver = d; handChannels(); },
    setChannelSize: (v: number) => { channels.size = v; handChannels(); },
    setChannelAlpha: (v: number) => { channels.alpha = v; handChannels(); },
    setChannelLight: (v: number) => { channels.light = v; handChannels(); },
    /*
     * v8 `31.3` + `31.4` — the live fold and 4D pose. One getter for the pair and one setter per field,
     * the box-fold's shape: each writes its own field into the shared object and re-hands the lot.
     */
    getDeform4d: () => ({ ...deform4d }),
    setWScale: (v: number) => { deform4d.wScale = v; handDeform4d(); },
    setWAngle: (plane: 'xw' | 'yw' | 'zw', v: number) => { deform4d[plane] = v; handDeform4d(); },
    setWWinding: (v: number) => { deform4d.winding = v; handDeform4d(); },
    getTwist: () => [twist[0]!, twist[1]!, twist[2]!] as [number, number, number],
    setTwist: (axis: 0 | 1 | 2, v: number) => {
      generator.setTwist(axis, v);
      twist[axis] = generator.getTwist()[axis]!;
    },
    /*
     * v8 `32.1`/`32.2` (`E129b`) — the LIVE setters, which are the fourth adoption path.
     *
     * ⚠️ **The module array is written back from the GENERATOR, never from the argument** — the generator
     * clamps and snaps (`TAPER_MAX`, `BEND_MAX_RATE`, `TWIST_SNAP`), so reading back is what keeps the
     * exported value equal to the one actually in force. `setTwist` above does the same, and the reason is
     * the same: an export that disagrees with the picture is the defect.
     */
    getTaper: () => [taper[0]!, taper[1]!, taper[2]!] as [number, number, number],
    setTaper: (axis: 0 | 1 | 2, v: number) => {
      generator.setTaper(axis, v);
      taper[axis] = generator.getTaper()[axis]!;
    },
    getBend: () => [bend[0]!, bend[1]!, bend[2]!] as [number, number, number],
    setBend: (axis: 0 | 1 | 2, v: number) => {
      generator.setBend(axis, v);
      bend[axis] = generator.getBend()[axis]!;
    },
    /*
     * v8 `33.2`/`33.3` — the basis and the sweep. **Read back from the generator like their siblings**,
     * because both setters clamp and `setTravel` additionally SNAPS: `32.14` is the whole reason this
     * read-back exists at all, and a value the panel shows but the engine does not hold is the defect it
     * named. The sharpness levels do not snap (they are one-sided) but they still clamp, so they read back
     * too; `34.4`'s signed DEPTHS snap, and its RATES raise a non-zero value to `OP_RATE_MIN`.
     */
    /*
     * v8 `34.4` — ⚠️ **`Sharpness` IS A TRIPLET NOW AND THE SETTER TAKES AN AXIS INDEX, but the three cells
     * are wave LEVELS rather than axes** (`34.D11`). The widget is `tripletRow` either way, which is what
     * `34.D12` is satisfied by for free: Visual FX has no slot model and no `silent` notion, so a per-level
     * cell is unconditionally visible by construction and there is nothing to hide.
     *
     * ⚠️ **The generator takes all three at once** (`setSharpnessLevels`), so a per-cell write re-sends the
     * mirror's other two. That is deliberate: the three resolve together through the `?? sharpness` backfill
     * at adopt time and a per-level generator setter would let a caller leave one of them holding the
     * previous preset's value — the defect `setChannels`' single-call shape exists to prevent.
     */
    // ⚠️ `as` may not be preceded by a line break — the grammar forbids it and the error is a parse error
    // three lines away, so the tuple cast stays on one line however long that line is.
    getSharpnessLevels: () => [sharpnessLevels[0]!, sharpnessLevels[1]!, sharpnessLevels[2]!] as [number, number, number],
    setSharpnessLevels: (axis: 0 | 1 | 2, v: number) => {
      const next: [number, number, number] = [sharpnessLevels[0]!, sharpnessLevels[1]!, sharpnessLevels[2]!];
      next[axis] = v;
      generator.setSharpnessLevels(next[0], next[1], next[2]);
      mirror(sharpnessLevels, generator.getSharpnessLevels() as [number, number, number]);
    },
    /*
     * v8 2026-10-31 (owner) — **which wave LEVELS are live, for the `Sharpness` triplet's per-cell gate.**
     * Reported on `Quader Square Spring`: no Detail slot, Detail cell operable — invariant 13's harder form,
     * a control that moves the right field over an output that cannot show it.
     *
     * ⚠️⚠️ **`readFigure()` IS THE ONE OWNER OF `silent` AND THAT IS THE WHOLE REASON THIS LIVES HERE
     * RATHER THAN IN THE TAB.** The rule is `size + pulse === 0` per axis — **never `FM.Base === 0`**, which
     * is a live slot that merely does not travel — and `composer-model.ts` already holds it for the Composer.
     * A second copy in `visual-fx.ts` would be two answers to one question (invariant 17), and the Composer
     * is the module `CLAUDE.md` names as the only reader of `generators.waves`, so the read belongs to it.
     *
     * ⚠️ **`preset` is the LIVE working body**, so a Composer edit that silences a slot reaches the gate on
     * the next sync with no extra plumbing. **Absent preset ⇒ all three live**: a startup frame must not
     * disable a control, and `applyPresetChange` re-syncs the panel immediately afterwards.
     */
    getLiveWaveLevels: () => {
      if (!preset) return [true, true, true] as [boolean, boolean, boolean];
      const slots = readFigure(preset).slots;
      return [!slots[0].silent, !slots[1].silent, !slots[2].silent] as [boolean, boolean, boolean];
    },
    /*
     * v8 `34.4` — `Temper`. ⚠️ **ONE depth and ONE rate for all three levels**, so the setter takes the pair
     * and the generator holds one of each. A per-level pair was not built and must not be added unasked: the
     * specification defends the asymmetry on its own terms (*"all three levels breathe on one cycle"*).
     */
    getSharpnessDepth: () => sharpnessDepth,
    getSharpnessRate: () => sharpnessRate,
    setSharpnessBreath: (depth: number, rate: number) => {
      generator.setSharpnessBreath(depth, rate);
      sharpnessDepth = generator.getSharpnessDepth();
      sharpnessRate = generator.getSharpnessRate();
    },
    /*
     * v8 `33.4`/`33.5` — the foliation, and whether the escape driver is usable at all.
     *
     * ⚠️ **`escapeFieldLive()` is the GENERATOR's answer, not a second derivation here.** The Lab hides
     * the `Escape` driver option on it (`33.D17`) and the generator falls back to `index` on the same
     * predicate, so the two cannot disagree about whether the channel has data — which is the whole
     * failure mode a hidden option is meant to prevent.
     */
    /*
     * ⚠️ **`getEscapeFlow`/`setEscapeFlow` WERE REMOVED HERE ON 2026-11-01 with the Visual FX `Flow`
     * row** (owner: the field-lines flow has no visual case, and it was the only reason the pair
     * existed). ⚠️⚠️ **`escapeFlowMode` ITSELF STAYS AND IS STILL LOAD-BEARING: `adoptEscapeFlow()`
     * reads it from the preset, hands it to the generator, and the export gate above emits it — so an
     * imported `'ray'` body still renders as rays and still round-trips.** Deleting the variable is the
     * change that would silently drop that, and it is NOT what was asked for.
     */
    escapeFieldLive: () => generator.escapeFieldLive(),
    getTravel: () => [travel[0]!, travel[1]!, travel[2]!] as [number, number, number],
    setTravel: (axis: 0 | 1 | 2, v: number) => {
      generator.setTravel(axis, v);
      travel[axis] = generator.getTravel()[axis]!;
    },
    /*
     * v8 `34.2`/`34.3`/`34.4` — the eight remaining per-axis triples, all read back from the generator for
     * the clamp's and the dead zone's sake (`32.14`).
     *
     * ⚠️ **`getZExtent`/`getPerspectiveCullDepth` are PASS-THROUGHS to the generator and must stay so.** They
     * feed the `Offset` row's Z readout, which is CANVAS-dependent (invariant 27): both quantities move with
     * the window, so the panel has to ask every time it paints and may never cache across a resize. **A
     * mirrored copy here would be a second owner of a canvas-derived number.**
     */
    getTravelDepth: () => [travelDepth[0]!, travelDepth[1]!, travelDepth[2]!] as [number, number, number],
    setTravelDepth: (axis: 0 | 1 | 2, v: number) => {
      generator.setTravelDepth(axis, v);
      travelDepth[axis] = generator.getTravelDepth()[axis]!;
    },
    getTravelRate: () => [travelRate[0]!, travelRate[1]!, travelRate[2]!] as [number, number, number],
    setTravelRate: (axis: 0 | 1 | 2, v: number) => {
      generator.setTravelRate(axis, v);
      travelRate[axis] = generator.getTravelRate()[axis]!;
    },
    getOffset: () => [offset[0]!, offset[1]!, offset[2]!] as [number, number, number],
    setOffset: (axis: 0 | 1 | 2, v: number) => {
      generator.setOffset(axis, v);
      offset[axis] = generator.getOffset()[axis]!;
    },
    getOffsetDepth: () => [offsetDepth[0]!, offsetDepth[1]!, offsetDepth[2]!] as [number, number, number],
    setOffsetDepth: (axis: 0 | 1 | 2, v: number) => {
      generator.setOffsetDepth(axis, v);
      offsetDepth[axis] = generator.getOffsetDepth()[axis]!;
    },
    getOffsetRate: () => [offsetRate[0]!, offsetRate[1]!, offsetRate[2]!] as [number, number, number],
    setOffsetRate: (axis: 0 | 1 | 2, v: number) => {
      generator.setOffsetRate(axis, v);
      offsetRate[axis] = generator.getOffsetRate()[axis]!;
    },
    getGrow: () => [grow[0]!, grow[1]!, grow[2]!] as [number, number, number],
    setGrow: (axis: 0 | 1 | 2, v: number) => {
      generator.setGrow(axis, v);
      grow[axis] = generator.getGrow()[axis]!;
    },
    getGrowDepth: () => [growDepth[0]!, growDepth[1]!, growDepth[2]!] as [number, number, number],
    setGrowDepth: (axis: 0 | 1 | 2, v: number) => {
      generator.setGrowDepth(axis, v);
      growDepth[axis] = generator.getGrowDepth()[axis]!;
    },
    getGrowRate: () => [growRate[0]!, growRate[1]!, growRate[2]!] as [number, number, number],
    setGrowRate: (axis: 0 | 1 | 2, v: number) => {
      generator.setGrowRate(axis, v);
      growRate[axis] = generator.getGrowRate()[axis]!;
    },
    getZExtent: () => generator.getZExtent() as [number, number],
    getPerspectiveCullDepth: () => generator.getPerspectiveCullDepth(),
    /*
     * v8 `32.7` (`E133`) — all three at once, like `setBoxFold`, and read back from the generator for the
     * clamp's sake.
     */
    getInversion: () => ({ ...inversion }),
    setInversion: (amount: number, radius: number) => {
      generator.setInversion(amount, radius);
      const live = generator.getInversion();
      inversion.amount = live.amount;
      inversion.radius = live.radius;
    },
    getSymmetryMirror: () => symmetryMirror,
    setSymmetryMirror: (v) => {
      symmetryMirror = v;
      generator.setSymmetry(symmetryFold, symmetryMirror);
    },
    // Particle Number. Reads from the GENERATOR, not from `preset.generators.particleCount`, because the
    // generator holds what is actually being drawn — it clamps, and `main.ts`'s `preset` and the Lab's
    // `state.workingPreset` are different objects that only converge on a grid click.
    getParticleCount: () => generator.getParticleCount(),
    setParticleCount: (v) => {
      const n = Math.max(MIN_PARTICLE_COUNT, Math.min(MAX_PARTICLE_COUNT, Math.round(v)));
      // Written to `preset.generators`, NOT to a new `overlay` field, and this is the one control in the
      // Visual FX tab that behaves that way. `particleCount` already lives in `generators` and already
      // has six mutating consumers — Mixer interpolation, Randomiser jitter, Evolution crossover,
      // Archetype patches, the Sliders tab's Density multiplier and `preset-stats` — so an `overlay`
      // twin would create two sources of truth for one number, and every one of those six would have to
      // learn which wins. Consequence, and it is the correct one: this survives Export, is interpolated
      // by the Mixer, and is what Density multiplies against.
      if (preset) preset.generators.particleCount = n;
      // Resized in place rather than via `dispose()` + `initGenerator()`. That pattern is right for the
      // renderer (`setRenderMode`), where a mode change means different programs and FBOs, but wrong
      // here: `LissajousGenerator.init()` resets `pos` to 0 and re-reads `angle`, so a drag would snap
      // the figure back to its opening pose on every step. See `setParticleCount` there for what is
      // preserved and what is deliberately dropped.
      generator.setParticleCount(n);
    },
    /*
     * v8 16.3 (E94) — the Composer's wave-table door. The first read/write surface onto the Lissajous curve
     * in the whole UI.
     *
     * ⚠️ **THE GETTER DEEP-COPIES, and a shallow copy here would be a silent aliasing defect.**
     * `WaveConfig.axes[].am` and `.fm` are nested objects, so `[...waves]` or `waves.map(w => ({...w}))`
     * would hand the Lab live references into `preset.generators.waves`. The Composer would then mutate the
     * engine's own preset in place — every edit applied before `setWaves()` was called, `Reset` with nothing
     * to restore, and the Mixer's `a`/`b` endpoints quietly moving. `structuredClone` is the whole fix, and
     * it is cheap: three waves of three axes, on a stepper click rather than per frame.
     *
     * ⚠️ **IT READS THE PRESET, NOT THE GENERATOR — the opposite of `getParticleCount` directly above, and
     * the difference is deliberate.** `getParticleCount` reads the generator because the generator CLAMPS,
     * so the preset can hold a value the engine never used. Nothing clamps a wave: `setWaves()` is a pure
     * copy of the table. And the generator's copy is lossy in the other direction — `buildWaveTable()` pads
     * it to `MAX_WAVES` and renames the fields to `amp`/`freq`, so reading it back would hand the Composer
     * three slots for a preset that authored fewer, in a spelling the model does not use. **The authored
     * table is the truth here; the generator's is a derived form.**
     */
    getWaves: () => structuredClone(preset?.generators.waves ?? []),
    /**
     * ⚠️ **BOTH WRITES ARE REQUIRED AND THEY ANSWER DIFFERENT QUESTIONS.** `preset.generators.waves` is what
     * Export, the Mixer and a snapshot read; `generator.setWaves()` is what this frame draws. Writing only
     * the preset makes every Composer control inert until the next preset change; writing only the generator
     * makes every edit vanish on Export — the shape invariant 13 names, in both directions at once.
     *
     * ⚠️ **NOT VIA `initGenerator()`, and this file already says so twice about `pos`.** `init()` sets
     * `this.pos = 0` and re-reads `config.angle`, so routing a stepper click through it would snap the figure
     * back to its opening pose on every click — discarding the phase the user is watching in order to show
     * them a change to it. `setWaves()` exists for exactly this, following `setRotationSpeed` and
     * `setParticleCount`.
     *
     * ⚠️ **AND IT DOES NOT CLEAR THE TRAIL — an owner decision, not an oversight.** A wave edit changes where
     * particles are, so the accumulated trail is briefly a picture of two different figures; clearing it
     * would be defensible. It is deliberately not done, because on a high-`decayFactor` preset the wash-out
     * IS the feedback the user is reading, and a clear on every stepper click would strobe the whole canvas.
     */
    setWaves: (waves) => {
      const copy = structuredClone(waves);
      if (preset) preset.generators.waves = copy;
      generator.setWaves(copy);
    },
    /*
     * v8 `36.11` — the curve type's three doors, each the sibling of a `waves` one above.
     *
     * ⚠️ **`structuredClone` ON THE WAY IN, exactly as `setWaves` does** — without it the Lab's object and
     * the engine's are the same reference, and the tab would be editing engine state behind the setter's
     * back with nothing for a `Reset` to restore.
     *
     * ⚠️⚠️ **NO `initGenerator()` ON ANY OF THEM, INCLUDING THE TYPE.** That is the whole point of the
     * seam being a branch inside `update()` (`36.D5`): a type switch is a different figure SOURCE, not a
     * different generator, so it needs no re-init — and a re-init would reset `pos`, which is also the
     * breathing clock, snapping every modulated parameter back to its base.
     */
    getFigureType: () => resolveFigureType(preset?.generators.type, preset?.generators ?? {}).type,
    setFigureType: (type) => {
      if (preset) preset.generators.type = type;
      generator.setFigureType(type);
    },
    getLSystem: () => (preset?.generators.lsystem !== undefined
      ? structuredClone(preset.generators.lsystem) : null),
    setLSystem: (config) => {
      const copy = config === null ? null : structuredClone(config);
      if (preset) {
        // ⚠️ `delete` rather than writing `undefined`: an explicit `undefined` would serialise as a key in
        // some paths and `36.2`'s round-trip clause asserts the block's ABSENCE round-trips too.
        if (copy === null) delete preset.generators.lsystem;
        else preset.generators.lsystem = copy;
      }
      generator.setLSystem(copy);
    },
    getWaveSpeed: () => preset?.generators.waveSpeed ?? 0.05,
    /**
     * ⚠️ **`waveSpeed` IS BAKED AT `init()` (`config.waveSpeed`) AND HAS NO IN-PLACE SETTER, so this one
     * control genuinely needs a re-init — the opposite of every sibling above.** That is why it writes the
     * preset and then calls `initGenerator()`: there is no `setWaveSpeed()` on the generator to call.
     *
     * ⚠️ **The cost is the `pos` reset those siblings exist to avoid**, so the Composer treats this as a
     * distinct control with its own note rather than as one more row — the figure DOES jump to its opening
     * pose here, and the inline copy says so instead of leaving the user to discover it. **Do not "fix" this
     * by adding a generator setter unasked:** `pos` accumulates `waveSpeed` per frame, so changing the rate
     * mid-sweep without resetting is a behaviour question about the modulators, not a plumbing one.
     */
    setWaveSpeed: (v) => {
      if (preset) preset.generators.waveSpeed = v;
      initGenerator(generator, preset, canvas.width, canvas.height);
    },
    /*
     * Trail Decay — added 2026-09-04 with the material presentation blocks.
     *
     * ⚠️ **THIS EXISTS BECAUSE A PRESENTATION BLOCK MAY NOT AUTHOR A VALUE THE USER CANNOT THEN CHANGE.**
     * `MaterialPresentation.decayFactor` writes `preset.renderer.decayFactor`, and grepping for its readers
     * found no Visual FX or Materials row that writes it — only the Sliders tab's `Glow` multiplier, which
     * moves it as one of four coupled effects, and style 6's `persist`, which overrides it. So authoring it
     * from a material bundle without this pair would have shipped invariant 13's shape in its purest form: a
     * value the engine sets on your behalf, visibly changes the picture, and offers no control that names it.
     *
     * ⚠️ **The write goes to the PRESET FIELD and then re-derives, never to `trailDecay` directly.**
     * `applyFluidFeedbackState()` recomputes `trailDecay` from `preset.renderer.decayFactor` on every call, so
     * a direct assignment would survive only until the next material or TransMap touch — the leak that
     * function's header documents. Calling it here also means the additive cap and style 6's override are both
     * re-applied in the one owner rather than re-implemented at this site.
     */
    getDecayFactor: () => preset?.renderer.decayFactor ?? 0.86,
    setDecayFactor: (v) => {
      // The engine's own bound, shared with the slider's range rather than duplicated (the CLAUDE.md track
      // rule: a range `min` is cosmetic, the clamp is what moves). 0.99 and not 1.0 — at 1.0 the fade pass
      // draws nothing and any NaN or Inf in the trail is reproduced forever with no decay to drain it.
      const d = Math.max(0, Math.min(MAX_TRAIL_DECAY, v));
      if (preset) preset.renderer.decayFactor = d;
      applyFluidFeedbackState();
    },
    getCurlEnabled: () => currentCurl.enabled,
    setCurlEnabled: (on) => { currentCurl.enabled = on; generator.setCurlNoise({ ...currentCurl }); },
    getCurlTurbulence: () => currentCurl.turbulence,
    setCurlTurbulence: (v) => { currentCurl.turbulence = Math.max(0, Math.min(1, v)); generator.setCurlNoise({ ...currentCurl }); },
    getCurlScale: () => currentCurl.scale,
    setCurlScale: (v) => { currentCurl.scale = Math.max(0.1, Math.min(10, v)); generator.setCurlNoise({ ...currentCurl }); },
    getCurlEvolutionSpeed: () => currentCurl.evolutionSpeed,
    setCurlEvolutionSpeed: (v) => { currentCurl.evolutionSpeed = Math.max(0, Math.min(2, v)); generator.setCurlNoise({ ...currentCurl }); },
    getRenderMode: () => currentRenderMode,
    setRenderMode: (mode) => {
      currentRenderMode = mode;
      // Record it on the live preset's overlay as well as in the local variable.
      //
      // `applyPresetChange` sets `currentRenderMode = preset.renderer.mode` unconditionally, and only
      // restores a user choice if `overlay.renderMode` is present. So without this line ANY re-apply of
      // the working preset silently reverted the mode — including a Sliders-tab move, which re-applies
      // its captured baseline. Symptom: pick Blend, nudge the Glow slider, and you are back in star mode
      // where `uGlow` is ignored, so Glow appears broken. Reported 2026-08-06.
      //
      // Writing the overlay rather than `renderer.mode` keeps the preset's authored mode intact and uses
      // the channel `applyPresetChange` already checks.
      if (preset) {
        if (!preset.overlay) preset.overlay = {};
        preset.overlay.renderMode = mode;
      }
      // `reinitRenderer` re-hands the material, crystal, volume, film-look and smoke state that
      // `dispose()` clears. Without it this setter was a ONE-WAY trip on any preset with a material:
      // `dispose()` nulls `materialConfig`, the splat draw gate requires it, and nothing here ever put it
      // back — so `splat → star → splat` (and `volume → back`) left a permanently black
      // figure with no way to recover from the UI. Reported 2026-08-12.
      reinitRenderer(mode);
      if (preset) {
        // The renderer may have REFUSED this mode: volume and liquid both need
        // `EXT_color_buffer_float` and silently fall back to 'star' without it (ADR 010). Adopt whatever
        // is actually active, so the dropdown stops claiming a mode that is not being drawn (R10).
        reconcileRenderMode();
      }
    },
    getTransMapEnabled: () => currentTransMapEnabled,
    setTransMapEnabled: (on) => {
      currentTransMapEnabled = on;
      // Toggling the checkbox must re-derive the style-6 overrides in BOTH directions: enabling with
      // style 6 already selected has to install them, and disabling has to give `trailDecay` and the
      // velocity field back. Previously this setter touched neither, so the leaked state left behind by
      // a Style change was not repairable from the UI at all.
      applyFluidFeedbackState();
      reinitTransMap();
    },
    /**
     * The legacy single-style accessors, kept because the `Style` dropdown IS still the one-layer view.
     *
     * `set` REPLACES the whole chain with one layer of that style — which is what the dropdown means, and
     * what it did before chains existed. It deliberately does not preserve other layers: the dropdown is
     * only shown when the chain has exactly one layer (`setTransMapChain` drives the multi-layer view), so
     * there is nothing to preserve. Editing a longer chain goes through `setTransMapChain`.
     */
    getTransMapStyle: () => primaryTransMapStyle(),
    setTransMapStyle: (style) => {
      currentTransMapChain = [makeLayer(style)];
      // ⚠️ Gated on `currentTransMapEnabled` inside the helper. This site is the reported bug: picking a
      // style while TransMap was DISABLED still rewrote `trailDecay`, which visibly changed the trail
      // length of an animation the TransMap was not touching.
      applyFluidFeedbackState();
      reinitTransMap();
    },
    getTransMapChain: () => cloneChain(currentTransMapChain),
    /**
     * ⚠️ **Copies in BOTH directions, for the same reason as `getIfsParams`** (I12): the layer rows mutate
     * their layer objects in place from the weight slider, so handing out the live array would let a
     * snapshot keep changing after it was taken, and adopting the caller's array would make the row
     * widgets co-owners of engine state.
     *
     * Routes through `applyChainChange`, NOT `reinitTransMap` — see that function for why a dispose+init
     * here would visibly restart the procedural-flow noise phase on every weight drag.
     */
    setTransMapChain: (chain) => { applyChainChange(chain); },
    /**
     * ⚠️ **`currentTransMapEnabled` is part of the answer, not a separate question.** `describePlan` derives
     * its text from the chain ALONE (by design — it is a pure function of a `ChainPlan`), but `apply()`
     * short-circuits on `!this.enabled` at its FIRST line, before the plan is consulted. So the one control
     * whose entire purpose is to explain the executed pipeline was printing a full `trail → [warp: … ,
     * time-warp] → bloom` while nothing at all ran. Reported as *"I added Time Warp and played with the
     * sliders, but nothing visibly happens"* on `Rose`, which carries `TransMapFilter: false` and therefore
     * loads with Enable OFF — one of **60 of the 177** presets that do.
     *
     * The readout is where this belongs: the layer rows and their sliders are all individually correct, so
     * there is no single row a note could sit on, and invariant 13's question ("does this control still move
     * the thing it names") is answered for the whole section at once by the stage list going empty.
     */
    getTransMapPipelineDescription: () => (currentTransMapEnabled
      ? describePlan(buildChainPlan(currentTransMapChain))
      : 'trail → bloom  (TransMap disabled — tick Enable above)'),
    // The PRESET's shared zoom centre, read straight off the live preset — the fallback a layer with no
    // `zoomCenter` of its own inherits. No setter: this is preset data, not overlay state.
    // Reads `preset` at CALL time, not at closure time — it is a `let` that a preset change reassigns, so a
    // captured value would pin the fallback to whatever was loaded at startup.
    getTransMapZoomCenterX: () => preset?.postProcessors?.transMap?.zoomCenter?.x ?? 50,
    getTransMapZoomCenterY: () => preset?.postProcessors?.transMap?.zoomCenter?.y ?? 50,
    // The preset's own wave tables, for the static-field readout (T2). Same rules as the zoom centre above:
    // read at CALL time off the live `preset`, and no setter — `sinMagicParams` has no overlay counterpart.
    //
    // ⚠️ **Handed over BY REFERENCE, and the reader must not write through it.** `preset` is the working copy,
    // so a mutation here would edit the loaded preset from a panel that shows no editor for it and would then
    // reach Export and Snapshot. The consumer measures and formats; it never assigns. A copy per call was
    // rejected because the readout runs on every chain edit and a 4×4 clone per keystroke buys nothing that
    // reviewing the one caller does not.
    //
    // The fallback builds a FRESH zero table rather than sharing one module constant, so the "do not write
    // through it" rule above cannot be broken from the one path where writing would look harmless.
    getTransMapWaveTables: () => ({
      table1: preset?.postProcessors?.transMap?.sinMagicParams ?? zeroSinMagic(),
      table2: preset?.postProcessors?.transMap?.sinMagicParams2 ?? zeroSinMagic(),
    }),
    /**
     * **Write the preset's wave tables and rebuild the static field** — the Transmap tab's term rows (21.12).
     *
     * ⚠️ **The rebuild may NOT go through `reinitTransMap()`**, even though that is the shorter call. A
     * dispose+init constructs a fresh `ProceduralFlowGenerator`, restarting its noise phase from zero, so a
     * chain carrying a flow layer would jump on every keystroke in a term row — the same reason
     * `applyChainChange` exists (see its header).
     *
     * ⚠️ **And it may not go through `applyChainChange()` either, which passes NO config**: `lastConfig` would
     * keep the OLD tables, the static signature would not move, `rebuildStaticField` would be skipped and the
     * field on screen would be the one from before the edit — with every control showing the new numbers. That
     * is why the config is built here, from `buildTransMapConfig(liveTransMapPreset(...))`, AFTER the write.
     *
     * ⚠️ **Deep-copied on the way in** (the `cloneIfsParams` rule two blocks down): the caller's rows own
     * mutable arrays, and storing them by reference would let a later keystroke edit the preset — and Export
     * and Snapshot with it — with no assignment anywhere in sight.
     *
     * Returns silently with no preset loaded: there is no table to write and nothing on screen to rebuild.
     */
    setTransMapWaveTables: (table1: SinMagicParams, table2: SinMagicParams): void => {
      if (!preset) return;
      const copy = (t: SinMagicParams): SinMagicParams =>
        [[...t[0]], [...t[1]], [...t[2]], [...t[3]]];
      preset.postProcessors.transMap.sinMagicParams = copy(table1);
      preset.postProcessors.transMap.sinMagicParams2 = copy(table2);
      transMap.setChain(
        currentTransMapChain,
        buildTransMapConfig(liveTransMapPreset(preset), canvas.width, canvas.height, currentTransMapChain),
      );
    },
    // ⚠️ **`canvas.width/height`, not `clientWidth` and not `window.inner*`.** These are the backing-store
    // dimensions every pass is sized to (`config.canvas.*`, the FBOs and `initTransMap` all take them), and
    // the static field's magnitude scales with `min(w, h)` of exactly that buffer. The canvas is NARROWER than
    // the viewport here, so reading the window would overstate the scale the readout divides by.
    // Read at call time: a resize reassigns both.
    getFrameSize: () => ({ width: canvas.width, height: canvas.height }),
    /**
     * ⚠️ **Copies in BOTH directions, and both are load-bearing** (triage I12 — see `cloneIfsParams` for
     * why a spread is not a copy here). Copying only on the way out would still let a caller's own array
     * become live state; copying only on the way in would still hand the live transforms to the row
     * sliders, which mutate them in place. Together they make `currentIfsParams` exclusively owned, so
     * neither `IFS_PRESETS`, a preset's own `ifsParams`, nor an already-emitted snapshot is reachable
     * through it. `commit()` needs no change — it mutates its own copy and hands it back through the setter.
     */
    getIfsParams: () => cloneIfsParams(currentIfsParams),
    setIfsParams: (params) => {
      currentIfsParams = cloneIfsParams(params);
      transMapForce.resetOffsets();
      // Gated on the chain CONTAINING style 4: the transforms are only read by the IFS program, so
      // rebuilding the pass for a chain without that layer would dispose and re-link a program that
      // cannot have changed.
      if (chainHasLayerFor(4)) reinitTransMap();
    },
    getTransMapWarpMix: () => currentTransMapWarpMix,
    setTransMapWarpMix: (v) => {
      currentTransMapWarpMix = Math.max(0, Math.min(1, v));
    },
    getTransMapDispersion: () => currentTransMapDispersion,
    setTransMapDispersion: (v) => {
      currentTransMapDispersion = Math.max(0, Math.min(0.5, v));
    },
    // v8 Step 14.6 — no re-init: the order is read fresh by the frame loop every frame, and the two passes it
    // permutes own no resource that depends on which runs first.
    getTransMapBeforeParticles: () => currentTransMapBeforeParticles,
    setTransMapBeforeParticles: (on) => {
      currentTransMapBeforeParticles = on;
    },
    getTransMapForceBlend: () => currentTransMapForceBlend,
    setTransMapForceBlend: (v) => {
      currentTransMapForceBlend = Math.max(0, Math.min(1, v));
    },
    getTransMapForceReturn: () => currentTransMapForceReturn,
    setTransMapForceReturn: (v) => {
      currentTransMapForceReturn = Math.max(0, Math.min(10, v));
    },
    getTransMapForceSparks: () => currentTransMapForceSparks,
    setTransMapForceSparks: (on) => {
      currentTransMapForceSparks = on;
    },
    getForceGateBy: () => currentForceGateBy,
    setForceGateBy: (v) => {
      currentForceGateBy = v;
    },
    getForceGateAmount: () => currentForceGateAmount,
    setForceGateAmount: (v) => {
      currentForceGateAmount = Math.max(0, Math.min(1, v));
    },
    getForceGateInvert: () => currentForceGateInvert,
    setForceGateInvert: (on) => {
      currentForceGateInvert = on;
    },
    getForceGateHalfLife: () => currentForceGateHalfLife,
    setForceGateHalfLife: (v) => {
      // ⚠️ Clamped to the SLIDER's own range, and the floor must not be lower than it (invariant 13's
      // inverse — a clamp tighter than the range makes the bottom of the track inert). `setGate` floors at
      // 0.05 for a different reason: it guards the `exp` against a hand-edited import.
      currentForceGateHalfLife = Math.max(0.1, Math.min(20, v));
    },
    getFluidFeedback: () => ({ ...currentFluidFeedback }),
    setFluidFeedback: (cfg: Partial<typeof currentFluidFeedback>) => {
      Object.assign(currentFluidFeedback, cfg);
      currentFluidFeedback.persist = Math.max(0.90, Math.min(0.99, currentFluidFeedback.persist));
      currentFluidFeedback.amplify = Math.max(1, Math.min(10, currentFluidFeedback.amplify));
      currentFluidFeedback.dispersion = Math.max(0, Math.min(0.5, currentFluidFeedback.dispersion));
      currentFluidFeedback.fieldDecay = Math.max(0.95, Math.min(0.999, currentFluidFeedback.fieldDecay));
      currentFluidFeedback.glowBoost = Math.max(0, Math.min(2, currentFluidFeedback.glowBoost));
      applyFluidFeedbackState();
    },
    /**
     * ⚠️ **`direction` is a nested `[number, number]` and must be copied explicitly** (triage I12).
     *
     * The archetype dropdown calls `setProceduralFlowConfig({ ...arch.config, archetype })`, a shallow
     * spread of a `FLOW_ARCHETYPES` entry — so with a plain `Object.assign` the live
     * `currentProceduralFlow.direction` became the SAME array object as the module's literal. One
     * in-place write would then rewrite `FLOW_ARCHETYPES` for the rest of the session, and "Fire Rise"
     * would permanently mean something else. The Direction slider happens to assign a fresh array today,
     * which is the only reason this never fired — a latent defect, not a live one, and the fix belongs
     * here rather than in the one caller that currently gets it right by accident.
     */
    getProceduralFlowConfig: () => cloneFlowConfig(currentProceduralFlow),
    setProceduralFlowConfig: (config) => {
      Object.assign(currentProceduralFlow, config);
      if (config.direction) currentProceduralFlow.direction = [config.direction[0], config.direction[1]];
    },
    getSnapshot: (): OverlayState => {
      /*
       * v8 16.18 (E109) — while a preview bypass is live, the report is the FROZEN CAPTURE, not live state.
       *
       * ⚠️ **THIS IS THE ONE HARD ASSERTION OF 16.18: EXPORT, SNAPSHOT AND THE MIXER MUST BE BYTE-IDENTICAL WITH
       * EITHER BOX TICKED.** The bypass is implemented as a real re-apply, so the effects genuinely are off in
       * the engine — and this function reads live state, so without this branch a tick would export the
       * neutralised overlay. `panel.ts` REPLACES `copy.overlay` with the return value rather than merging into
       * it, so the loss is total, and **Snapshot is the worst of the three because it writes the loss into the
       * history the user restores from** (invariant 17's export-gate ending, reached from a different direction).
       *
       * ⚠️ **A COPY, NOT THE CAPTURE ITSELF** — two `panel.ts` call sites assign this straight onto a preset
       * copy, and one caller mutating it would corrupt the state the un-tick restores from. Nested blocks are
       * shallow-shared, which is the same exposure every branch below already has and is why the capture is
       * taken from this very function (its per-block clones are already the owner of that).
       *
       * ⚠️ **THE PRESERVED SET IS RE-READ LIVE**, so a Speed or Film Look change made while a box is ticked is
       * reported — those are the fields a bypass never neutralised, and reporting the capture's copies of them
       * would make the export disagree with the picture in the one direction the freeze is not protecting.
       */
      if (bypassAuthoredOverlay && (bypassVisualFx || bypassMaterials)) {
        return { ...bypassAuthoredOverlay, ...livePreservedOverlay() };
      }
      const snap: OverlayState = {
        ribbonMode: ribbonState,
        // 27.6 — written unconditionally like `ribbonMode` beside it. ⚠️ A VALUE-BASED gate would be wrong
        // here and the four distinct export-gate rules are why: this is a per-KEY categorical, not a block,
        // so there is nothing to destroy by omitting it and nothing to reconstruct by writing it. Omitting
        // it on the default would make Export and Snapshot disagree with the live state for any preset the
        // user had switched back to `tangent` deliberately.
        splatShear,
        ribbonWidth,
        linesEnabled,
        lineWidth: neonLineWidth,
        /*
         * v8 Phase 40 — VALUE-GATED like the palette pair: written only while the effect is on or an amount was
         * moved off its default, so a preset that never used it exports exactly the bytes it always did.
         */
        ...(discharge.enabled || discharge.intensity !== DISCHARGE_DEFAULTS.intensity
          || discharge.filament !== DISCHARGE_DEFAULTS.filament || discharge.crackle !== DISCHARGE_DEFAULTS.crackle
          || discharge.branching !== DISCHARGE_DEFAULTS.branching ? {
            dischargeEnabled: discharge.enabled,
            dischargeIntensity: discharge.intensity,
            dischargeFilament: discharge.filament,
            dischargeCrackle: discharge.crackle,
            dischargeBranching: discharge.branching,
          } : {}),
        filmLook: currentFilmLook,
        /*
         * v8 Step 21.4c — the palette override, **VALUE-GATED on `!== undefined`.**
         *
         * ⚠️ **This is NOT a fifth member of the four block gates below and must not be counted with them.**
         * Those four are per-BLOCK rules over nested objects (`liquid`, `cohesion`, `liquidField`, `dye`); this
         * is a pair of flat optional scalars whose gate is the definition of the field, not a judgement about
         * when its contents are inert. The four-rule enumeration stays at four.
         *
         * `undefined` here means "no override — inherit the film look's palette", and `resolvePaletteSelection`
         * is the one reader that folds it back. So the gate is not an identity gate in the
         * `particleSize !== 1.0` sense: there is no inert VALUE to suppress, there is a state that has no key.
         * ⚠️ **`'none'` is a real authored value and must be emitted** — it means "this preset has no palette
         * even though its look has one", and emitting nothing instead would make the preset inherit on the next
         * load, i.e. a gate DESTROYING the block rather than omitting a noise key (invariant 17's ending, and
         * `panel.ts` REPLACES `copy.overlay` with this object). A truthy test is the whole defect in one
         * character.
         *
         * ⚠️ **Two fields, two gates, unlike `symmetryFold`/`symmetryMirror` one block down.** They are
         * independently authorable and neither is meaningless without the other: a preset may take the look's
         * palette and re-map it (`paletteMapping` alone), or pick a palette and keep the look's mapping
         * (`palette` alone). Sharing one gate would drop whichever half was authored by itself.
         *
         * ⚠️ These two lines are duplicated in `livePreservedOverlay()` and the pair is what the 16.18
         * byte-identity assertion measures — change both or neither.
         */
        ...(overlayPalette !== undefined ? { palette: overlayPalette } : {}),
        ...(overlayPaletteMapping !== undefined ? { paletteMapping: overlayPaletteMapping } : {}),
        attractorIndex: currentAttractorIndex,
        attractorBlend: currentBlend,
        renderMode: currentRenderMode,
        transMapEnabled: currentTransMapEnabled,
        // ⚠️ **`transMapStyle` is emitted ALWAYS, chain or no chain, and that is the whole compatibility
        // contract.** It is what an older build, `interpolate.ts` and the preview grid read; a chain-aware
        // reader prefers `transMapChain` when present (`chainFromOverlay()`), so a multi-layer export
        // degrades to its first layer in an old reader rather than to nothing.
        transMapStyle: primaryTransMapStyle(),
        // The array appears ONLY when the chain says more than the scalar can — see
        // `isLegacyExpressible()`. A single full-weight layer is exactly `transMapStyle: n`, so a session
        // that never touches the layer list produces a BYTE-IDENTICAL export, and no new key enters any
        // of the 177 presets. Deep-copied, since the rows mutate layers in place (I12).
        ...(isLegacyExpressible(currentTransMapChain) ? {} : { transMapChain: cloneChain(currentTransMapChain) }),
        // Per-transform copy for the same reason as `getIfsParams` — an array spread shares the
        // transform objects, and the row sliders write them in place, so a snapshot taken now would
        // keep changing as the user kept dragging (I12).
        //
        // These three per-style blocks are gated on the chain CONTAINING their style rather than on it
        // BEING that style. A 0+5 chain needs its `proceduralFlow` tuning in the export just as a
        // style-5-only session did; omitting it because the primary style is 0 would silently reset the
        // flow parameters on import.
        ...(chainHasLayerFor(4) ? { ifsParams: cloneIfsParams(currentIfsParams) } : {}),
        ...(currentTransMapWarpMix < 1.0 ? { transMapWarpMix: currentTransMapWarpMix } : {}),
        // v8 Step 14.6 — emitted only when true, so an export from a session that never touched the order is
        // byte-identical to a pre-14.6 one and no new key enters any of the 177 presets. `false` is both the
        // default and the value every existing preset carries, so writing it would be pure noise.
        ...(currentTransMapBeforeParticles ? { transMapBeforeParticles: true } : {}),
        // Emitted only when nonzero (0 is the default and the value on all 177 presets), so this key does not
        // appear in an export until the user moves the slider — an export is mostly runtime-default noise
        // otherwise. NOT gated on `chainHasLayerFor(6)` like `fluidFeedback` below: that is what it used to be
        // bound to, and gating it that way would drop the value from exactly the styles-0-3 chains this change
        // exists to serve.
        ...(currentTransMapDispersion > 0 ? { transMapDispersion: currentTransMapDispersion } : {}),
        ...(currentTransMapForceBlend > 0 ? { transMapForceBlend: currentTransMapForceBlend } : {}),
        ...(currentTransMapForceReturn !== 1.5 ? { transMapForceReturn: currentTransMapForceReturn } : {}),
        ...(currentTransMapForceSparks ? { transMapForceSparks: true } : {}),
        // v8 Step 14.4 — the gate, emitted only when it is actually gating. `'none'` and amount 0 are BOTH
        // today's behaviour, so either alone makes the other three keys noise; gating all four on the pair
        // keeps an ungated export byte-identical to a pre-14.4 one. `halfLife` rides along only for `'age'`,
        // the one source that reads it, and only when it differs from the default.
        ...(currentForceGateBy !== 'none' && currentForceGateAmount > 0
          ? {
              transMapForceGateBy: currentForceGateBy,
              transMapForceGateAmount: currentForceGateAmount,
              ...(currentForceGateInvert ? { transMapForceGateInvert: true } : {}),
              ...(currentForceGateBy === 'age' && currentForceGateHalfLife !== 2.0
                ? { transMapForceGateHalfLife: currentForceGateHalfLife }
                : {}),
            }
          : {}),
        // `direction` copied explicitly — see `getProceduralFlowConfig` (I12).
        ...(chainHasLayerFor(5) ? { proceduralFlow: cloneFlowConfig(currentProceduralFlow) } : {}),
        ...(chainHasLayerFor(6) ? { fluidFeedback: { ...currentFluidFeedback } } : {}),
        curlNoise: { ...currentCurl },
        speedFactor,
        figureScale,
        // Emitted only when it is not the identity, unlike the two above — 1.0 is exactly the historical
        // hardcoded size, so an untouched export stays byte-identical to a pre-2026-08-29 one.
        ...(particleSizeScale !== 1.0 ? { particleSize: particleSizeScale } : {}),
        // E30: emitted only when the operator is actually doing something. Fold 1 is the identity, so
        // writing it would put an inert key into every export — and `symmetryMirror` has no meaning at
        // all without a fold, which is why both are gated on the same condition rather than separately.
        ...(symmetryFold > 1 ? { symmetryFold, symmetryMirror } : {}),
        ...sym3dExport(),   // v8 Phase 42 — the same gate at both export sites
        // v8 30.1 — emitted only when the operator is actually doing something, so an export from a session
        // that never touched it is byte-identical to a pre-30.1 one and no new key enters any of the 284
        // presets. ⚠️ **ONE GATE FOR THE TRIPLE** — see the bypass branch, which carries the same test and
        // must change with this one. Two copies of one rule; the byte-identity assertion catches a drift.
        ...(twist.some(v => v !== 0) ? { twistX: twist[0], twistY: twist[1], twistZ: twist[2] } : {}),
        // v8 33.2/33.3/34.2/34.3/34.4 — ⚠️ **ONE SHARED OWNER rather than two copies of four gates.** See
        // `figureOperatorKeys()`: the bypass branch and this branch now call the same function, which is
        // the strongest available form of 16.18's byte-identity requirement — there is nothing left to
        // drift. Thirty-one keys over four gates; two hand-written copies of that would not have stayed
        // equal, and the twist/taper/fold/channel pairs above are the shape that proves it (each is two
        // copies of one rule, each carrying a comment saying so).
        ...figureOperatorKeys(),
        // v8 33.4 — the same value gate as the bypass branch. TWO COPIES OF ONE RULE.
        ...(escapeFlowMode !== 'contour' ? { escapeFlow: escapeFlowMode } : {}),
      /*
       * v8 `32.1`/`32.2` — ⚠️ **ONE GATE OVER THE WHOLE SIX-TUPLE, not one per operator**, because the
       * generator's own gate is the six-tuple: a taper with every bend at 0 still runs the stage. Two
       * gates here would emit three inert keys whenever only the other operator was in use.
       */
      ...(taper.some(v => v !== 0) || bend.some(v => v !== 0)
        ? {
          taperX: taper[0], taperY: taper[1], taperZ: taper[2],
          bendX: bend[0], bendY: bend[1], bendZ: bend[2],
        }
        : {}),
      // v8 32.7 — gated on the AMOUNT, which is the operator's own gate. The radius is meaningless at
      // amount 0, so emitting it there would put an inert key in every export.
      ...(inversion.amount > 0
        ? { invertAmount: inversion.amount, invertRadius: inversion.radius }
        : {}),
        // v8 30.2 — gated on the iteration count, the operator's own gate. ⚠️ **Two copies of one rule**
        // with the bypass branch above; 16.18's byte-identity assertion is what catches a drift.
        ...(boxFold.iterations > 0 ? {
          boxFoldIterations: boxFold.iterations, boxFoldLimit: boxFold.limit,
          boxFoldScale: boxFold.scale,
        } : {}),
        ...fractalFoldExport(),   // v8 Phase 38 — the same gate at both export sites
        // v8 31.2 — gated on the three AMOUNTS, the operator's own gate. ⚠️ **Two copies of one rule** with
        // the bypass branch above, exactly as the plate's pair and the fold's pair are.
        ...(channels.size !== 0 || channels.alpha !== 0 || channels.light !== 0 ? {
          channelDriver: channels.driver, channelSize: channels.size,
          channelAlpha: channels.alpha, channelLight: channels.light,
        } : {}),
        // v8 31.3 + 31.4 — the boolean gates itself; the rotation gates on `wScale` alone, never on the
        // angles. ⚠️ **Two copies of each rule** with the bypass branch above.
        ...(deform4d.wScale > 0 ? {
          wScale: deform4d.wScale, wXW: deform4d.xw, wYW: deform4d.yw, wZW: deform4d.zw,
          wWinding: deform4d.winding,
        } : {}),
        /*
         * v8 Step 9.3 — `trailColour` is the one field of this block that is IDENTITY-GATED, so an export
         * from a session that never touched it is byte-identical to a pre-9.3 one and no new key enters any
         * of the 361 presets. Same shape as `particleSize` and `symmetryFold` above.
         *
         * ⚠️ **The block itself stays UNGATED, and the gate is on the FIELD — the two are not the same
         * decision.** `physarum` is emitted whole because `panel.ts` REPLACES `copy.overlay` with this
         * object; a block-level gate would DESTROY the other eight fields rather than omit one. That is
         * `isLiquidAuthored`'s lesson applied before it could cost anything: the four overlay export gates
         * are deliberately not unified, and this is a fifth rule for a fifth reason.
         *
         * ⚠️ **Omitting the key is safe here only because `applyOverlayConfigBlocks` normalises it back to
         * `'(Preset)'` on import (invariant 14).** Without that line the omission would mean "inherit the
         * live session value", which is the opposite of what this gate claims.
         */
        physarum: (() => {
          const { trailColour, ...rest } = currentPhysarum;
          return trailColour === PHYSARUM_TRAIL_COLOUR_PRESET || trailColour === undefined
            ? rest
            : { ...rest, trailColour };
        })(),
        fluidAdvection: { ...currentFluid },
        ...(currentMaterial && currentMaterial.preset !== 'None' ? { material: { ...currentMaterial } } : {}),
        ...(currentBuoyancy.enabled ? { buoyancy: { ...currentBuoyancy } } : {}),
        ...(currentSpark.enabled ? { sparks: { ...currentSpark } } : {}),
        ...(currentRenderMode === 'volume' ? { volumeRender: { ...currentVolume } } : {}),
        // ⚠️ **`|| isLiquidAuthored(...)`, not the mode alone — a gate DESTROYS the block it declines to
        // emit**, because `panel.ts` REPLACES `copy.overlay` with this object rather than merging into it.
        // See `isLiquidAuthored`'s header for the user report; the short form is that leaving the mode for
        // one moment used to erase eleven authored fields from the working preset silently, and a Snapshot
        // wrote that loss into the history the user restores from. Still byte-identical for every existing
        // export: 359 of 360 presets leave `currentLiquid` deep-equal to its defaults.
        ...(currentRenderMode === 'liquid' || isLiquidAuthored(currentLiquid)
          ? { liquid: { ...currentLiquid } }
          : {}),
        // v8 15.4. ⚠️ **Gated on `strength > 0`, NOT on the render mode** — cohesion moves `positions`, so a
        // beaded `star`-mode preset is a legitimate authored look and gating on `liquid` would silently drop
        // its defining parameter from its own export. Same shape as `particleSize`'s identity gate: the block
        // appears exactly when it is doing something, so no existing export gains a key.
        ...(currentCohesion.strength > 0 ? { cohesion: { ...currentCohesion } } : {}),
        // v8 15.5. ⚠️ **Gated on `enabled && poolSize > 0`, and NOT on the render mode**, for cohesion's reason
        // one step further: the pool is published into `positions` and drawn by whichever renderer is live, so
        // a stirred `star`-mode preset is a legitimate authored look. The condition is the SAME PAIR the
        // generator's own publication gate tests (`lissajous.ts`'s `getState()`), which is what makes the
        // export and the picture agree: a block that publishes no particles would be an inert key, and a
        // particle that draws with no block would vanish on re-import.
        //
        // ⚠️ **`enabled` alone would NOT do here, and that is the opposite decision from
        // `applyFluidFeedbackState()`'s `setPoolActive`** — deliberately. There the flag must stay true across a
        // `Pool Size` drag through 0 so the velocity field stays warm; here the question is whether the export
        // describes anything, and an `enabled` pool of size 0 describes nothing. Same two fields, two different
        // questions; read the comment at each site rather than making them match.
        ...(currentLiquidField.enabled && currentLiquidField.poolSize > 0
          ? { liquidField: { ...currentLiquidField } }
          : {}),
        /*
         * v8 15.7 — the dye field. ⚠️ **Gated on `enabled && opacity > 0`, which is a VALUE-BASED gate of the
         * same shape as `liquidField`'s and deliberately NOT on the render mode.**
         *
         * A mode gate here would be the defect `isLiquidAuthored` exists to prevent: `panel.ts` REPLACES
         * `copy.overlay` with this object rather than merging into it, so a gate DESTROYS the block it declines
         * to emit — and Snapshot writes that loss into the history the user restores from. The dye field runs in
         * every render mode (it deposits and advects regardless; only the `'dye'` TINT SOURCE is liquid-only), so
         * a mode gate would additionally be wrong on the facts.
         *
         * ⚠️ **`opacity > 0` and not `enabled` alone**, because at opacity 0 the field deposits nothing and the
         * block describes nothing — the same question `liquidField`'s `poolSize > 0` answers, and NOT the
         * question `applyFluidFeedbackState`'s `poolOn` answers. ⚠️ **Do not unify the four overlay gates**:
         * there are now four distinct rules (`liquid` by mode-or-authored, `cohesion` by `strength > 0`,
         * `liquidField` by `enabled && poolSize > 0`, `dye` by `enabled && opacity > 0`) and each is derived
         * from what its own block means. `volumeRender` has the identical mode-gate exposure and is left alone.
         *
         * ⚠️ **The FIELD'S CONTENTS are excluded and that is not an omission** — parameters only, exactly as
         * `crystal` excludes the frozen-particle set below. An integrated texture is history: it cannot
         * interpolate in the Mixer and it must not survive a preset switch (`applyOverlayConfigBlocks` calls
         * `dyeProcessor.reset()` for that reason).
         */
        ...(currentDye.enabled && currentDye.opacity > 0 ? { dye: { ...currentDye } } : {}),
        // Crystal: render PARAMETERS only. The frozen-particle set is deliberately excluded —
        // it is history rather than parameters and would break Mixer/Randomiser purity.
        ...(currentCrystal.enabled ? { crystal: { ...currentCrystal } } : {}),
      };
      if (currentFilmLook === CUSTOMIZE_FILM_LOOK) {
        snap.customFilmLookParams = { ...customFilmLookParams };
      }
      return snap;
    },
    getFilmLookNames: () => [...Object.keys(FILM_LOOKS), CUSTOMIZE_FILM_LOOK],
    getAttractorPresetNames: () => ATTRACTOR_PRESETS.map(p => p.name),
    // D17: returns an UNSUBSCRIBE function. Callbacks were previously pushed with no way to remove them, so a
    // disposed tab stayed subscribed for the session's lifetime — a leak that grows with every tab switch, and
    // worse than a leak: the dead tab's handler kept running and writing to DOM elements that had been
    // replaced, on every preset change.
    onExternalChange: (cb) => {
      externalChangeCallbacks.push(cb);
      return () => {
        const i = externalChangeCallbacks.indexOf(cb);
        if (i >= 0) externalChangeCallbacks.splice(i, 1);
      };
    },
    // T013: Physarum controls
    getPhysarumConfig: () => ({ ...currentPhysarum }),
    setPhysarumBlend: (v) => {
      currentPhysarum.blend = Math.max(0, Math.min(1, v));
      physarumProcessor.setConfig({ ...currentPhysarum });
      generator.setPhysarumProcessor(currentPhysarum.blend > 0 ? physarumProcessor : null, currentPhysarum);
    },
    setPhysarumSensorAngle: (v) => {
      currentPhysarum.sensorAngle = Math.max(5, Math.min(90, v));
      physarumProcessor.setConfig({ ...currentPhysarum });
    },
    setPhysarumSensorDistance: (v) => {
      currentPhysarum.sensorDistance = Math.max(5, Math.min(50, v));
      physarumProcessor.setConfig({ ...currentPhysarum });
    },
    setPhysarumTurnSpeed: (v) => {
      currentPhysarum.turnSpeed = Math.max(5, Math.min(90, v));
      physarumProcessor.setConfig({ ...currentPhysarum });
    },
    setPhysarumDecayRate: (v) => {
      currentPhysarum.decayRate = Math.max(0.01, Math.min(0.5, v));
      physarumProcessor.setConfig({ ...currentPhysarum });
    },
    setPhysarumDepositAmount: (v) => {
      currentPhysarum.depositAmount = Math.max(0.01, Math.min(1, v));
      physarumProcessor.setConfig({ ...currentPhysarum });
    },
    setPhysarumShowTrail: (on) => {
      currentPhysarum.showTrail = on;
      physarumProcessor.setConfig({ ...currentPhysarum });
    },
    setPhysarumTrailOpacity: (v) => {
      currentPhysarum.trailOpacity = Math.max(0, Math.min(1, v));
      physarumProcessor.setConfig({ ...currentPhysarum });
    },
    // v8 Step 9.3. No clamp or validation here on purpose: the value space is a palette NAME, and
    // `resolvePhysarumTrailLut` already degrades an unknown one to `null` — i.e. to the legacy orange, never
    // to black. `setConfig` is called for symmetry with its eight siblings (the processor stores the string
    // and does not read it); the LUT upload is what actually moves the screen, and it is the second call.
    setPhysarumTrailColour: (name) => {
      currentPhysarum.trailColour = name;
      physarumProcessor.setConfig({ ...currentPhysarum });
      applyPhysarumTrailColour();
    },
    // T014: Fluid advection controls
    getFluidAdvectionConfig: () => ({ ...currentFluid }),
    setFluidBlend: (v) => {
      currentFluid.blend = Math.max(0, Math.min(1, v));
      fluidProcessor.setConfig({ ...currentFluid });
    },
    setFluidReturnForce: (v) => {
      currentFluid.returnForce = Math.max(0, Math.min(5, v));
      fluidProcessor.setConfig({ ...currentFluid });
    },
    getMaterialConfig: () => currentMaterial,
    setMaterialConfig: (config) => {
      const wasNone = !currentMaterial || currentMaterial.preset === 'None';
      const isNone = !config || config.preset === 'None';
      const prevPreset = currentMaterial?.preset ?? 'None';
      // v8 9.3 — the material RAMP is the second half of `'(Auto)'`'s material input, and it is editable
      // without the preset changing (the Materials tab has its own Colour Ramp dropdown). Captured here,
      // beside `prevPreset`, because `currentMaterial` is overwritten below.
      const prevRamp = currentMaterial?.colourRamp ?? '';
      // Inert unless `?gldiag=1`. Guarded on an ACTUAL change of material: this setter also runs on every
      // slider move within the Materials tab, and re-arming on each of those would restart the settle
      // continuously and mean the probe never got to watch anything.
      if ((config?.preset ?? 'None') !== prevPreset) {
        glDiagRearm(`material ${prevPreset} -> ${config?.preset ?? 'None'}`);
      }
      currentMaterial = config;
      generator.setMaterialConfig(config);
      renderer.setMaterialConfig(config);
      renderer.setFlameExpansion(computeFlameExpansion());
      /*
       * ⚠️ **THIS CALL IS THE WIRING THE ADDITIVE DECAY CAP NEEDED, AND ITS ABSENCE WAS THE WHOLE GAP.**
       * `applyFluidFeedbackState()` derives `trailDecay` — now including `materialTrailDecayCap()`, which
       * reads `currentMaterial` — and before 2026-09-04 this setter was the ONE material writer that never
       * called it. So without this line the cap would be correct on a preset switch and dead on the path a
       * user actually takes (picking a material from the Materials tab), which is the single most likely way
       * to reach the over-bright state in the first place.
       *
       * ⚠️ **It must sit AFTER `currentMaterial = config`** (the derive reads it) and it covers all four
       * exits below — arrival, material-to-material swap, clear, and the no-branch case of a slider move
       * within the same material. **That last one is not incidental: `emissionIntensity` is the cap's
       * numerator, so a drag on that slider MUST re-solve the ceiling**, and a call placed inside any of the
       * three branches would miss exactly that case. Idempotent, so being reached on every slider move costs
       * a few scalar assignments.
       *
       * ⚠️ **The two other material writers (`applyPresetChange`, the Reset/grid path) are ALREADY covered
       * and deliberately get no new call** — both assign `currentMaterial` before `applyOverlayConfigBlocks`,
       * which ends in that function's two derives. **That coverage is real but INCIDENTAL, so it is recorded
       * here rather than relied on silently:** a future edit that moved the material assignment below
       * `applyOverlayConfigBlocks` would leave the cap deriving from the OUTGOING preset's material, and
       * nothing would fail — the trail would simply be the wrong length for one preset. Same ordering trap
       * the pool's own comment measures, one block up.
       */
      applyFluidFeedbackState();
      /*
       * v8 Step 9.3 — the material is one of `'(Auto)'`'s four inputs, and this is the path a user actually
       * takes to change it. Placed AFTER `currentMaterial = config` for the same reason the derive above is:
       * the resolver reads that variable.
       *
       * ⚠️ **Gated on `preset` OR `colourRamp`, not on `preset` alone.** `'(Auto)'` falls back to
       * `Material: <colourRamp>`, and the Materials tab can change the ramp while the preset stands — so a
       * preset-only gate would leave the trail on the previous ramp with the material's own particles
       * already recoloured. It cannot be ungated either: this setter runs on EVERY Materials slider move,
       * and `getPaletteLUT` allocates a fresh 1 KB `Uint8Array` per call for cosine and gradient palettes
       * (`generateCosinePaletteLUT` / `generateGradientLUT` — only `getColourRampData` caches), which a
       * per-drag `texImage2D` would turn into invariant 8's allocation RATE rather than a one-off cost.
       */
      if ((config?.preset ?? 'None') !== prevPreset || (config?.colourRamp ?? '') !== prevRamp) {
        applyPhysarumTrailColour();
      }
      // Auto-switch render mode — through `resolveModeAgainstMaterial`, the one owner of the rule, so
      // selecting a material from the Materials tab while the `liquid` mode is live no longer silently
      // replaces it (2026-09-01; see that function's header). This was the second of the three disagreeing
      // readers, and it is the site that lets a session reach the state the user's export files are in:
      // `liquid` + a material, which `getSnapshot()` then had to be taught not to throw away.
      const autoMode = resolveModeAgainstMaterial(currentRenderMode, config);
      if (!isNone && wasNone) {
        previousRenderMode = currentRenderMode;
        if (autoMode !== currentRenderMode) {
          currentRenderMode = autoMode;
          // `reinitRenderer` re-hands the material AND the crystal config. The crystal half was added
          // here by hand first: a fresh renderer starts with no crystal config, which made selecting Ice
          // appear to do nothing — Ice auto-enables crystals on the OLD renderer, this branch then
          // replaced it, and `renderCrystalOnly()` early-returns on the null config, so the pool
          // nucleated correctly and nothing was ever drawn. `currentMaterial` is already `config` here,
          // so the helper's `setMaterialConfig(currentMaterial)` is the same call this used to make.
          reinitRenderer(autoMode);
        }
        // Re-enable buoyancy and sparks with defaults — but ONLY for hot materials.
        //
        // v8 Phase 8a-3: `materialAutoEnablesFireBehaviour()` excludes the cold materials (Ice).
        // Buoyancy lift is strictly upward and temperature-proportional, sparks eject embers, and
        // enabling buoyancy sets a non-zero smokeThreshold which routes the coldest particles
        // through the hardcoded 'fire-smoke' ramp — three hot-gas cues that would defeat the whole
        // point of the Ice rework. Cold materials get their look from the crystal pass instead.
        // Both sections keep their independent Enable checkboxes, so Ice + buoyancy stays reachable
        // by hand.
        const autoFire = !!config && materialAutoEnablesFireBehaviour(config.preset);
        Object.assign(currentBuoyancy, { ...DEFAULT_BUOYANCY_CONFIG, enabled: autoFire });
        generator.setBuoyancyConfig(currentBuoyancy);
        renderer.setFlameExpansion(computeFlameExpansion());
        renderer.setSmokeParams(
          currentBuoyancy.enabled ? (currentBuoyancy.smokeThreshold ?? 0.25) : 0,
          currentBuoyancy.smokeOpacity ?? 0.4,
        );
        Object.assign(currentSpark, { ...DEFAULT_SPARK_CONFIG, enabled: autoFire });
        applySparkConfig();
      } else if (!isNone && !wasNone && config && config.preset !== prevPreset) {
        // v8 Phase 8a-3: material-to-material swap. Previously this branch did not exist, because
        // every non-None material got the same fire behaviour and there was nothing to change.
        // Now that cold materials suppress it, crossing the hot/cold boundary has to re-decide:
        // Ice → Fire must get buoyancy and sparks back, and Fire → Ice must give them up. Only a
        // change in the auto-fire verdict re-applies defaults, so re-selecting within the same
        // temperature class still preserves whatever the user has hand-tuned.
        //
        // ⚠️ **v8 15.9 ADDED THE MODE TO THIS BRANCH, AND ITS ABSENCE WOULD HAVE BEEN INVARIANT 13
        // EXACTLY: `Fire` → `Liquid` would have left the user in `splat`, where the new material draws
        // as ordinary sprites and its whole point — the merged surface — is simply not what is on
        // screen.** The `wasNone` branch above switches the mode because it is the arrival path; before
        // 15.9 a material-to-material swap could not change the mode (all eight wanted `splat`), so this
        // branch legitimately had no mode code and adding a ninth answer is what made the omission a
        // defect. ⚠️ **This is the second half of `materialRequestedRenderMode()`'s consumer set: adding
        // a material that requests a mode means auditing EVERY branch that switches materials, not only
        // the one that turns them on.** `previousRenderMode` is updated so the clear-branch revert has
        // somewhere to go, and it is NOT updated when the mode is unchanged — an equal-mode swap must
        // not overwrite the user's pre-material mode.
        const swapMode = resolveModeAgainstMaterial(currentRenderMode, config);
        if (swapMode !== currentRenderMode) {
          previousRenderMode = currentRenderMode;
          currentRenderMode = swapMode;
          reinitRenderer(swapMode);
        }
        const wantsFire = materialAutoEnablesFireBehaviour(config.preset);
        if (wantsFire !== materialAutoEnablesFireBehaviour(prevPreset)) {
          Object.assign(currentBuoyancy, { ...DEFAULT_BUOYANCY_CONFIG, enabled: wantsFire });
          generator.setBuoyancyConfig(currentBuoyancy);
          renderer.setFlameExpansion(computeFlameExpansion());
          renderer.setSmokeParams(
            currentBuoyancy.enabled ? (currentBuoyancy.smokeThreshold ?? 0.25) : 0,
            currentBuoyancy.smokeOpacity ?? 0.4,
          );
          Object.assign(currentSpark, { ...DEFAULT_SPARK_CONFIG, enabled: wantsFire });
          applySparkConfig();
        }
      } else if (isNone && !wasNone) {
        // Disable buoyancy and sparks — they displace particles off-screen without material
        Object.assign(currentBuoyancy, DEFAULT_BUOYANCY_CONFIG);
        generator.setBuoyancyConfig(currentBuoyancy);
        renderer.setFlameExpansion(computeFlameExpansion());
        renderer.setSmokeParams(0, currentBuoyancy.smokeOpacity ?? 0.4);
        Object.assign(currentSpark, DEFAULT_SPARK_CONFIG);
        applySparkConfig();
        // Revert render mode — splat without material shows nothing, so fall back.
        //
        // ⚠️ **v8 15.9: `liquid` IS REVERTED HERE TOO, AND ONLY HERE, AND ONLY WHEN THE DEPARTING
        // MATERIAL IS `Liquid`.** The distinction is load-bearing and getting it wrong re-opens the
        // 2026-09-01 defect. `splat` reverts on the MODE alone because splat with no material draws
        // nothing — the mode is unusable, so whoever left it there, leaving is right. `liquid` with no
        // material is the opposite: it is a shipped authored look (five library presets are exactly
        // that), so reverting on the mode alone would kick a user out of `liquid` the moment they
        // cleared an unrelated material. **The right question is not "is this a mode a material
        // auto-switched into" but "did the material that REQUESTED this mode just leave"** — and this is
        // the one branch that can ask it, `prevPreset` being in scope. The other two revert sites
        // (`applyPresetChange`, `resetOverlays`) cannot see the departing material and MUST keep testing
        // `splat` only. See `materialRequestedRenderMode()`'s header.
        // ⚠️ **`previousRenderMode !== 'liquid'` IS THE SECOND HALF OF THE TEST AND IT IS NOT
        // REDUNDANT.** `previousRenderMode` is assigned on every material ARRIVAL, including the arrival
        // that changed no mode — so a user already in `liquid` who selects `Liquid` (legal: the
        // exemption makes it a no-op switch) has `previousRenderMode === 'liquid'`. Without this half,
        // clearing the material would then revert a mode the material never switched them into, and the
        // fallback would be `star` because the guard below refuses to return to the mode being left.
        // **The user authored `liquid` themselves; nothing may take it away** — which is the
        // 2026-09-01 rule restated for the revert direction.
        const revertingLiquid =
          currentRenderMode === 'liquid' && prevPreset === 'Liquid' && previousRenderMode !== 'liquid';
        if (currentRenderMode === 'splat' || revertingLiquid) {
          // Excludes the mode being left as well as `splat`: returning to it would be no revert at all,
          // and `splat` with no material draws nothing.
          const fallback =
            previousRenderMode !== 'splat' && previousRenderMode !== currentRenderMode
              ? previousRenderMode
              : 'star';
          currentRenderMode = fallback;
          // Was `applyFilmLook(currentFilmLook)` + `setCrystalConfig(currentCrystal)` by hand.
          // `reinitRenderer` does both — the film-look half without bloom's and toneMap's dispose+init,
          // which were never disposed here and so were pure waste.
          reinitRenderer(fallback);
        }
      }
      notifyExternalChange();
    },
    getBuoyancyConfig: () => ({ ...currentBuoyancy }),
    setBuoyancyConfig: (config) => {
      currentBuoyancy = { ...config };
      generator.setBuoyancyConfig(currentBuoyancy);
      renderer.setFlameExpansion(computeFlameExpansion());
      renderer.setSmokeParams(config.enabled ? (config.smokeThreshold ?? 0.25) : 0, config.smokeOpacity ?? 0.4);
    },
    getSparkConfig: () => ({ ...currentSpark }),
    setSparkConfig: (config) => {
      currentSpark = { ...config };
      applySparkConfig();
    },
    getVolumeConfig: () => ({ ...currentVolume }),
    setVolumeConfig: (config) => {
      currentVolume = { ...config };
      renderer.setVolumeConfig(currentVolume);
    },
    getLiquidConfig: () => ({ ...currentLiquid }),
    setLiquidConfig: (config) => {
      currentLiquid = { ...config };
      renderer.setLiquidConfig(currentLiquid);
    },
    // v8 15.4. Note the owner: the GENERATOR, not the renderer — cohesion is a displacement of `positions`
    // and has no renderer half at all, which is why it survives a render-mode change untouched.
    getCohesionConfig: () => ({ ...currentCohesion }),
    setCohesionConfig: (config) => {
      currentCohesion = { ...config };
      generator.setCohesionConfig(currentCohesion);
    },
    /*
     * v8 15.5 — the liquid field pool. TWO owners, unlike every setter above it, and the second one is the
     * whole reason this pair cannot be written as a one-liner.
     *
     * ⚠️ **`applyFluidFeedbackState()` MUST run after the generator hand-off, and it is not optional at any
     * of the five controls.** Three pieces of state live outside the config object — whether the 512² field is
     * simulated at all (`setPoolActive`), whether its CPU readback happens, and `fieldDecay`'s precedence
     * against style 6 — and all three are DERIVED from `currentLiquidField` there rather than assigned here.
     * That function's own header records what the alternative cost: every earlier site set an override and
     * none restored it, so the state leaked. Omitting the call would make `Enable` switch the pool on with a
     * dead field behind it — a pool that publishes particles, draws them, and never moves. **Invariant 13's
     * shape reached through GL-adjacent state that no checker and no type can see.**
     *
     * ⚠️ **`currentLiquidField` is REASSIGNED here (`= { ...config }`) while `applyOverlayConfigBlocks` mutates
     * it in place (`Object.assign`), and both are correct because `setLiquidFieldConfig` re-hands the object
     * every time.** The generator stores the REFERENCE (`lissajous.ts:1637`), so a reassignment that skipped
     * the hand-off would leave it reading the previous object — which is exactly why the call below is on the
     * next line rather than conditional on anything.
     */
    getLiquidFieldConfig: () => ({ ...currentLiquidField }),
    setLiquidFieldConfig: (config) => {
      currentLiquidField = { ...config };
      generator.setLiquidFieldConfig(currentLiquidField);
      applyFluidFeedbackState();
    },
    /*
     * v8 15.7 — the dye field. TWO owners, exactly like `liquidField` above — ⚠️ **AND THIS COMMENT USED TO
     * SAY "ONE owner … there is no derived state to re-run", WHICH WAS THE DEFECT, IN PROSE.** `dyeProcessor`
     * owns the config and `isActive()` is indeed computed from it every call, never latched; but the dye also
     * needs the 512² VELOCITY field simulated so `step()` has something to advect along, and that is
     * `fluidProcessor`'s state, derived in `applyFluidFeedbackState()` from `currentDye.enabled`. Reported
     * 2026-09-03: with the pool off, `Advection` was inert at every value and nothing errored.
     *
     * ⚠️ **The reasoning that produced the wrong count is worth keeping, because it generalises:** I counted
     * who owns the CONFIG, not what the feature CONSUMES. The dye's second owner is invisible from this block
     * — it is a processor this setter never names, reached only through `dyeProcessor.step()`'s argument.
     * **Ask what a feature READS, not what this call writes.** `liquidField`'s note below is the same lesson
     * already written down once, for a dependency that happened to be easier to see.
     *
     * ⚠️ **`currentDye` is a `const` and is MUTATED in place** (`Object.assign`), not reassigned — the same
     * discipline `applyOverlayConfigBlocks` uses on it, so there is one shape for this block rather than the
     * two `liquidField` carries. Safe because `setConfig` COPIES (`{ ...cfg }`), so the processor never holds
     * this object by reference.
     *
     * ⚠️ **NO `reset()` here, and that is the difference from the preset-change path.** Dragging a slider must
     * not erase the wake the user is looking at — the field's contents are only stale when the FIGURE changes,
     * which is the preset path's concern. Turning `enabled` off then on is likewise a resume, not a clear;
     * the decay handles the rest.
     */
    getDyeConfig: () => ({ ...currentDye }),
    setDyeConfig: (config) => {
      Object.assign(currentDye, config);
      dyeProcessor.setConfig(currentDye);
      applyFluidFeedbackState();
      /*
       * ⚠️ **THE PRESET WRITE IS HALF OF A TWO-PART FIX AND EITHER HALF ALONE IS INERT** (2026-10-16, owner
       * report). Every other Visual FX setter is live-only: it moves `current*` and the engine, and leaves
       * `preset.overlay` alone. That is invisible until something RE-APPLIES the overlay — and the Sliders
       * tab does, on every `input` event, through `setWorkingPreset` → `preset-changed` →
       * `applyPresetChange` → `applyOverlayConfigBlocks`, which restores the preset's authored block. So a
       * `Dye Colour` chosen here was discarded by a drag of ANY slider, and `colourSource` went back to
       * whatever the body authors. **Measured on `Dye Wake`: mean dye chromaticity fell from
       * `0.795, 0.111, 0.094` (the palette's red) to `0.345, 0.332, 0.322` — the figure's own colours —
       * which the owner read as "it falls back to the original colour".** Reported against the `Warmth`
       * slider and reproduced identically with `Density`, so it was never a `Warmth` defect.
       *
       * ⚠️ **THE OTHER HALF IS IN `sliders.ts`'s `applyAllSliders()`, AND THIS WRITE ALONE MEASURABLY DOES
       * NOT FIX IT.** That function spreads the baseline's overlay OVER the live one and then `continue`s on
       * any slider-owned key the baseline declares — and `dye` is slider-owned since `26.5`. With only this
       * write, the symptom became ORDER-DEPENDENT rather than fixed: it survived when the Sliders tab was
       * entered *after* the edit (its baseline is captured on tab entry, so it captured the new value) and
       * reverted when the tab had been entered first. **Both halves measured, in both orders, before either
       * shipped** — and the order-dependence is why "it works now" was not evidence.
       *
       * ⚠️ **INVISIBLE TO EXPORT, SNAPSHOT AND THE MIXER, which is what makes it safe** — `panel.ts`
       * REPLACES `copy.overlay` with `visualFxControls.getSnapshot()` on both the export and the snapshot
       * path, and `23.D5` requires a Mixer lock to capture `getSnapshot()` rather than `state.workingPreset`.
       * So all three already read live state by a different route and none of them can see this key. **Check
       * that before extending this write to another block**: the reason it is safe is a property of those
       * three consumers, not of the write.
       *
       * ⚠️ **The six sibling block setters (`liquid`, `curlNoise`, `sparks`, `material`, `cohesion`,
       * `liquidField`) STILL LOSE A LIVE EDIT THE SAME WAY, and `liquid` is the one that matters most** —
       * `Tint Source` lives in it, so setting `Tint Source` from the dropdown and dragging any slider puts
       * the authored value back (demonstrated: `Ramp` → `Dye` on `Dye Wake`). They are deliberately NOT
       * fixed here: for the three keys that are NOT slider-owned the blocker is the spread ORDER rather than
       * the `continue`, so the remedy is a different one and wants its own calibration.
       */
      if (preset) {
        if (!preset.overlay) preset.overlay = {};
        preset.overlay.dye = { ...currentDye };
      }
    },
    // v8 Phase 8a — Faceted Crystal
    getCrystalConfig: () => currentCrystal,
    setCrystalConfig: (config) => {
      currentCrystal = { ...config };
      renderer.setCrystalConfig(currentCrystal);
      // Hand the pool its parameters. Nucleation is pulled once per frame from inside
      // generator.update() — nothing is pushed from here. The pool no-ops on `enabled: false`, so
      // the config can be forwarded unconditionally. A changed `poolSize` is picked up by the
      // pool's own capacity check, which drops the contents (correct: they are history).
      generator.setCrystalConfig(currentCrystal);
      if (!currentCrystal.enabled) {
        // Disabling must fully restore pre-feature behaviour, so drop every crystal: with the pool
        // empty, getState() stops publishing `frozen`/`growth`/`crystalCount` entirely and every
        // renderer falls back to its pre-feature path.
        generator.resetFrozen();
      }
    },
    getFrozenFraction: () => generator.getFrozenFraction(),
    getCrystalCapacity: () => generator.getCrystalCapacity(),
    resetOverlays: (p) => {
      const ov = p.overlay;
      // Ribbon
      ribbonState = ov?.ribbonMode ?? 'off';
      ribbonWidth = ov?.ribbonWidth ?? 3.0;
      if (ribbonState !== 'off') {
        ribbonRenderer.setMode(ribbonState as RibbonMode);
        linesEnabled = false;
      } else {
        linesEnabled = ov?.linesEnabled ?? false;
      }
      ribbonRenderer.setRibbonWidth(ribbonWidth);
      neonLineWidth = ov?.lineWidth ?? DEFAULT_LINE_WIDTH;
      neonLineRenderer.setLineWidth(neonLineWidth);
      discharge = readDischarge(ov);
      coupleDischargeToLines();
      electricDischarge.reset();
      // Film look
      const filmName = ov?.filmLook ?? 'Legacy';
      if (filmName === CUSTOMIZE_FILM_LOOK && ov?.customFilmLookParams) {
        Object.assign(customFilmLookParams, ov.customFilmLookParams);
      }
      // 21.4c — set before `applyFilmLook`, for the same reason and in the same order as
      // `applyPresetChange`'s copy. ⚠️ This path is REVERT-ONLY, and these two fields are still assigned
      // unconditionally: a Lab Reset that left a palette the user had chosen in the tab would be reverting
      // everything except the one control whose absence means "not overridden".
      overlayPalette = ov?.palette;
      overlayPaletteMapping = ov?.paletteMapping;
      overlayPaletteHueShift = ov?.paletteHueShift ?? 0;
      applyFilmLook(filmName);
      // Attractor
      currentAttractorIndex = ov?.attractorIndex ?? -1;
      currentBlend = ov?.attractorBlend ?? DEFAULT_ATTRACTOR_BLEND;
      if (currentAttractorIndex < 0) {
        generator.setAttractor(null);
      } else {
        const ap = ATTRACTOR_PRESETS[currentAttractorIndex];
        if (ap) {
          generator.setAttractor({
            type: ap.type,
            params: ap.params,
            blend: currentBlend,
            bounds: ap.bounds,
            ...(ap.maxIter !== undefined ? { maxIter: ap.maxIter } : {}),
          });
        }
      }
      // Render mode (from preset or overlay)
      const newMode = ov?.renderMode ?? p.renderer.mode ?? 'star';
      if (newMode !== currentRenderMode) {
        currentRenderMode = newMode;
        // `p`, not `preset`: a Reset re-applies its own entry preset, which is not yet the live one.
        // Same non-authoritative note as in `applyPresetChange` — the material branch and
        // `applyOverlayConfigBlocks` below both re-hand again once they have settled.
        reinitRenderer(newMode, p);
      }
      // TransMap (from preset or overlay)
      const tmEnabled = ov?.transMapEnabled ?? p.postProcessors.transMap.enabled;
      const tmChain = chainFromOverlay(ov, p.postProcessors.transMap.style, p.postProcessors.transMap.ifsParams);
      const tmIfs = ov?.ifsParams ?? p.postProcessors.transMap.ifsParams ?? defaultIfsParams();
      // Compared by SHAPE, not by identity: `chainFromOverlay` returns a fresh array every call (I12), so
      // `!==` would be true on every Reset and re-init the pass — including the flow generator, whose
      // noise phase would restart. `chainSignature()` is the same equality the UI's dirty check uses.
      if (tmEnabled !== currentTransMapEnabled || chainSignature(tmChain) !== chainSignature(currentTransMapChain)) {
        currentTransMapEnabled = tmEnabled;
        currentTransMapChain = tmChain;
        currentIfsParams = cloneIfsParams(tmIfs);
        // `p`, not the module-level `preset`: the clicked preset is not the live one yet, exactly as with
        // `reinitRenderer(newMode, p)` above. The three live fields have just been assigned from it.
        reinitTransMap(p);
        transMapForce.resetOffsets();
      } else {
        currentIfsParams = cloneIfsParams(tmIfs);
        transMapForce.resetOffsets();
      }
      // v8 Step 14.6 — overlay-first, and RESET rather than preserved, for the same reason the gate below is:
      // a grid click or a Reset must not leave the previous preset's pass order in place. Outside the
      // `chainSignature` branch above because it needs no re-init: the order is read fresh by the frame loop.
      currentTransMapBeforeParticles = ov?.transMapBeforeParticles ?? p.postProcessors.transMap.beforeParticles;
      // Warp mix and force field
      currentTransMapWarpMix = ov?.transMapWarpMix ?? 1.0;
      currentTransMapForceBlend = ov?.transMapForceBlend ?? 0;
      currentTransMapForceReturn = ov?.transMapForceReturn ?? 1.5;
      currentTransMapForceSparks = ov?.transMapForceSparks ?? false;
      // v8 Step 14.4 — same four resets as the other load path. This one RESETS rather than preserves for
      // the same reason dispersion does below: a grid-click must not inherit the previous preset's gate.
      currentForceGateBy = ov?.transMapForceGateBy ?? 'none';
      currentForceGateAmount = ov?.transMapForceGateAmount ?? 0;
      currentForceGateInvert = ov?.transMapForceGateInvert ?? false;
      currentForceGateHalfLife = ov?.transMapForceGateHalfLife ?? 2.0;
      if (ov?.fluidFeedback) Object.assign(currentFluidFeedback, ov.fluidFeedback); else Object.assign(currentFluidFeedback, DEFAULT_FLUID_FEEDBACK);
      // Same resolution order as the other load path, and read AFTER the assign above for the same reason.
      // ⚠️ This path RESETS rather than preserves (note the `else` above): a grid-click must not inherit the
      // previous preset's fringing, which is the asymmetry the flow/fluid reset already has here.
      currentTransMapDispersion = ov?.transMapDispersion ?? ov?.fluidFeedback?.dispersion ?? 0;
      applyFluidFeedbackState();
      if (ov?.proceduralFlow) {
        Object.assign(currentProceduralFlow, cloneFlowConfig(ov.proceduralFlow));
      } else {
        Object.assign(currentProceduralFlow, cloneFlowConfig(DEFAULT_PROCEDURAL_FLOW));
      }
      // Curl noise
      const curlCfg = ov?.curlNoise ?? DEFAULT_CURL;
      currentCurl.enabled = curlCfg.enabled;
      currentCurl.turbulence = curlCfg.turbulence;
      currentCurl.scale = curlCfg.scale;
      currentCurl.evolutionSpeed = curlCfg.evolutionSpeed;
      generator.setCurlNoise({ ...currentCurl });
      generator.resetCurlTime();
      // Speed
      speedFactor = ov?.speedFactor ?? 1.0;
      figureScale = ov?.figureScale ?? 1.0;
      generator.setViewScale(figureScale);
      particleSizeScale = ov?.particleSize ?? 1.0;
      renderer.setParticleSize(particleSizeScale);
      symmetryFold = ov?.symmetryFold ?? 1;
      symmetryMirror = ov?.symmetryMirror ?? true;
      generator.setSymmetry(symmetryFold, symmetryMirror);
      adoptSym3d(ov);   // v8 Phase 42 — a Reset must REVERT it too
      adoptTaperBend(ov);   // v8 32.1/32.2 — a Reset must REVERT these too
      adoptFigureBasis(ov);   // v8 33.2/33.3 - and the basis and the sweep with them
      adoptEscapeFlow(ov);   // v8 33.4 - a Reset must revert the foliation too
      adoptInversion(ov);   // v8 32.7 — ditto
      adoptTwist(ov);   // v8 30.1 — a Reset must REVERT the deformation, not leave the live one standing
      adoptFractalFold(ov); // v8 Phase 38 — a Reset must REVERT it too
      adoptBoxFold(ov); // v8 30.2 — same
      adoptChannels(ov);  // v8 31.2 — and the per-particle channels with it
      adoptDeform4d(ov);  // v8 31.3 + 31.4 — a Reset reverts the fold and the 4D pose too
      // Material. NOT shared with `applyPresetChange` (D5): that path also switches INTO splat when a
      // material arrives, whereas a Reset must only ever revert — switching in here would fight a live
      // Materials-tab choice. Runs BEFORE the shared blocks for the same reason as there: the branch may
      // dispose and re-init `renderer`, and the shared blocks forward configs to it.
      // ⚠️ **v8 9.3: no `applyPhysarumTrailColour()` here either, and for the same ORDER reason as
      // `applyPresetChange`'s** — `applyOverlayConfigBlocks(ov)` below ends the physarum block with that call
      // and runs after this assignment. The two material writers that DO need their own call are
      // `setMaterialConfig` (no shared-block call follows it) and nothing else.
      const matCfg = ov?.material ?? null;
      const wasActive = currentMaterial && currentMaterial.preset !== 'None';
      currentMaterial = matCfg;
      generator.setMaterialConfig(matCfg);
      renderer.setMaterialConfig(matCfg);
      // If material is being cleared and we were in splat mode from auto-switch, revert
      const matIsNone = !matCfg || matCfg.preset === 'None';
      if (matIsNone && wasActive && currentRenderMode === 'splat') {
        currentRenderMode = previousRenderMode !== 'splat' ? previousRenderMode : 'star';
        // The old code built its synthetic preset from `p` but GATED on `preset` — so with no live preset
        // it disposed the renderer and never re-inited it. `p` is always defined here.
        reinitRenderer(currentRenderMode, p);
      }

      // Physarum, fluid, buoyancy, sparks, volume, crystal — shared with `applyPresetChange` (D5).
      applyOverlayConfigBlocks(ov);

      // Fluid PARTICLE STATE, on top of the shared config apply. Not shared: `applyPresetChange` clears
      // these in its own generator-reset block further up, whereas a Reset has no such block.
      fluidProcessor.resetOffsets(0);
      fluidPrevPositions = null;
      fluidSmoothedVel = null;
      fluidUVs = null;
      fluidVelUVs = null;
      fluidPrevCount = 0;

      /*
       * v8 16.18 (E109) — the two hooks this path needs, and BOTH are gated on the same re-entrancy flag.
       *
       * ⚠️ **`applyBypassToEngine()` CALLS THIS FUNCTION, so without the guard the first line would recurse
       * and the second would fire a resync in the middle of it.** With the guard, an OUTSIDE call (a Lab
       * Reset, a grid click) re-neutralises exactly as `applyPresetChange` does, and a bypass-driven call
       * does neither.
       *
       * ⚠️ **SUPPRESSING THE NOTIFY IS NOT AN OPTIMISATION — IT IS THE ONLY THING PROTECTING 16.17's LEVEL
       * MUTES.** `ComposerTab` subscribes to `onExternalChange` with `adoptExternalFigure()`, which calls
       * `resetMutes()` and rebuilds all three row bodies. A bypass click routed through here unguarded would
       * therefore switch every muted level back on and replace the checkbox mid-click, every click. The
       * bypass changes NO figure and NO authored value, so there is nothing for a subscriber to resync to.
       */
      if (!bypassApplying) {
        applyBypassToEngine();
        // Notify Visual FX tab to refresh its UI
        notifyExternalChange();
      }
    },
    /*
     * ---- v8 16.18 (E109) — the two preview bypass switches ----
     *
     * ⚠️ **SETTERS THAT DO NOT NOTIFY, DELIBERATELY** — see the block header above `PLAIN_BYPASS_MODES`. A
     * resync would make Visual FX and Materials display the NEUTRALISED state, i.e. disagree with what Export
     * and Snapshot now report, and it would also re-enter the Composer and wipe its level mutes.
     *
     * ⚠️ **NEITHER WRITES `workingPreset` OR ANY PRESET FIELD.** They are view state over the ENGINE; that is
     * the opposite of 16.17's mute, which IS written into the preset, and the two families of checkbox sit on
     * one tab — hence the separate section, the separate styling and the copy that names the difference.
     */
    getBypassVisualFx: () => bypassVisualFx,
    setBypassVisualFx: (on) => { bypassVisualFx = on; applyBypassToEngine(); },
    getBypassMaterials: () => bypassMaterials,
    setBypassMaterials: (on) => { bypassMaterials = on; applyBypassToEngine(); },
    // v8 26.8 - through the SAME one owner as the other two, never a second path: that is what makes the
    // strip survive a Sliders re-apply, a Randomiser press and a Lab Reset without the toggle lying.
    setStripToFigure: (on) => { bypassStrip = on; applyBypassToEngine(); },
  };

  /**
   * v8 Phase 17.2 — `?testhook=1`: a READ-ONLY introspection channel for the Playwright suite.
   *
   * ⚠️ **IT EXISTS BECAUSE OF A MEASURED ABSENCE, NOT FOR CONVENIENCE: the only global the engine publishes is
   * `window.__gldiag`, so the ~42 test-plan steps about what the FIGURE does had NO machine-readable channel at
   * all.** Everything those steps need is a top-level `let` inside this IIFE, reachable from nowhere else — which
   * is also why this cannot live in a separate file: `drawFrame()` closes over ~50 of them and triage J4 is a
   * deliberate WON'T-FIX precisely because a split must invent a state owner first. **This function is not that
   * owner and must not become one.**
   *
   * ⚠️ **IT INHERITS `?gldiag=1`'s RULES VERBATIM, AND THEY ARE THE REASON THE STEP NEEDED APPROVAL AT ALL:
   * opt-in via ONE URL guard, absent from every shipped path, NEVER made always-on and NEVER "tidied away" into
   * an unconditional assignment.** An always-live hook is a second surface onto engine state, and a WRITABLE one
   * would be a second apply path — the exact shape invariant 23 forbids. Hence the two hard properties below.
   *
   * ⚠️ **PROPERTY 1 — EVERY MEMBER IS A GETTER OVER LIVE STATE, AND NOTHING HERE WRITES ANYTHING.** No setter, no
   * `applyPresetChange`, no `setWaves`, not even a clock nudge. A harness that could *drive* the engine from here
   * would be testing a path no user can reach, and the suite's whole claim is that it exercises the real one — so
   * every mutation in every spec goes through the DOM, exactly as Phase 1's steps do.
   *
   * ⚠️ **PROPERTY 2 — IT IS A SNAPSHOT-ON-READ, NOT A CACHED OBJECT.** `read()` is invoked per call, so a spec
   * that samples twice across a `waitForTimeout` sees two different readings. A frozen object assigned once at
   * init would report the boot frame forever and **every "did it move?" assertion would pass over a dead loop** —
   * the frozen-figure defect Phase 1 already had to defend against with a two-sample canvas signature, arriving
   * here as a property of the instrument instead.
   *
   * ⚠️ **`pos` IS THE LOAD-BEARING FIELD AND IT IS THE ONE THING NO PIXEL COMPARISON CAN SUBSTITUTE FOR.** It
   * advances iff `generator.update()` ran, so it separates *"the figure is being edited"* from *"the figure is
   * running"* — and invariant 22's defect (a throw ending the loop for a session) leaves a picture that still
   * looks plausible. **`renderMode` is the RESOLVED mode** (`resolveModeAgainstMaterial`'s output as the frame
   * actually used it, via the same `currentRenderMode` the draw reads), not `preset.renderer.mode`: invariant 17
   * is that two sources must resolve in one order, and a hook publishing the authored value would let a spec
   * "confirm" a mode the frame never drew.
   *
   * ⚠️ **THE BYPASS FLAGS ARE PUBLISHED BESIDE `snapshotIsFrozen`, WHICH IS THE PAIR THAT MAKES E109 TESTABLE.**
   * The step's one hard assertion is that Export/Snapshot/Mixer stay byte-identical while a box is ticked, i.e.
   * that the *report* is frozen while the *pixels* change. One boolean cannot express that; a spec needs to see
   * the flag on AND the capture non-null in the same reading.
   */
  function installTestHook(): void {
    if (new URLSearchParams(window.location.search).get('testhook') !== '1') return;

    console.warn('[TESTHOOK] read-only introspection ENABLED (?testhook=1). window.__psss exposes live engine '
      + 'state for the Playwright suite. It is a diagnostic surface, not a shipped API — nothing here writes.');

    const read = () => ({
      // --- the integration clock: the ONE field that says the loop is alive ---
      pos: generator.getPos(),
      elapsedTime,
      speedFactor,

      // --- resolved presentation, AFTER `resolveModeAgainstMaterial` ---
      renderMode: currentRenderMode,
      material: currentMaterial?.preset ?? null,
      filmLook: currentFilmLook,

      // --- E109's two flags, plus the capture that proves the report is frozen ---
      bypassVisualFx,
      bypassMaterials,
      snapshotIsFrozen: bypassAuthoredOverlay !== null,

      // --- identity and framing (invariant 26/27: canvas size is an INPUT to the subject) ---
      presetName: lastAppliedPresetName,
      figureScale,
      symmetryFold,
      symmetryMirror,
      canvas: { width: canvas.width, height: canvas.height },

      // --- population, as the engine counts it (invariant 7: `count` is the only trustworthy length) ---
      particleCount: generator.getState().count,

      // ⚠️ Surfaced so a harness failure can be told from an engine failure — Phase 1's most expensive
      // instrument defect was a timeout that read exactly like a renderer crash. `null` means the frame loop
      // has thrown nothing since boot.
      lastFrameError: lastFrameErrorMessage,
    });

    // ⚠️ A GETTER, not an assigned object — see property 2. `Object.defineProperty` rather than a plain
    // assignment so the shape cannot be mistaken for a mutable handle a spec might try to write through.
    Object.defineProperty(window, '__psss', { get: read, configurable: true });
  }

  /**
   * Add every preset of an imported BUNDLE to the library, then refresh the UI once.
   *
   * ⚠️ **Deliberately does NOT apply or navigate to any of them, and that is the whole point of having a
   * separate path.** `onImportPreset` ends in `setWorkingPresetExternal` + `setActivePreset` +
   * `scrollToActive`, which is right for one preset and wrong 177 times over: it would re-init the
   * generators, the renderer and TransMap once per entry, and thrash `GridTileRenderer`'s slots through 177
   * prepend-and-navigate cycles. A bundle restore is a LIBRARY operation, so the rendered preset is left
   * exactly as it was — changing it would also desync the grid highlight from what is actually on screen.
   *
   * `prependPreset` per entry is still needed (each one owns a tile), but it only builds a DOM node and
   * observes it; slots stay viewport-driven and lazy, so no renderer state is touched here.
   *
   * Declared as a hoisted `function` so both panel configs can name it before `previewGrid` exists — it is
   * only ever called from a click handler, long after both are constructed.
   */
  function applyImportedBundle(entries: { name: string; preset: UnifiedPreset }[]): void {
    // ⚠️ Resolve the active preset to a NAME before the library grows, and re-find it by name afterwards.
    // `refreshPresetNames()` rebuilds `presetNames` from `PresetManager`, so an index captured across that
    // rebuild is only still correct if nothing was inserted ahead of it — which today is true (a `Map`
    // appends) but is not a property this function should depend on. A name survives any ordering.
    const activeName = presetNames[currentPresetIndex] ?? '';

    for (const { name, preset } of entries) {
      presetManager.importSingle(name, preset);
      previewGrid.prependPreset(name);
    }
    // Once, not per entry — and it must run after the loop, since `prependPreset` mutates the GRID's own
    // array while `presetNames` here is a separate copy (the D4 split).
    refreshPresetNames(activeName);
    // Keep the highlight on whatever is actually rendering; the active preset is untouched above.
    previewGrid.setActivePreset(activeName);
    console.debug(`Imported ${entries.length} presets from a bundle; library is now ${presetManager.count()}.`);
  }

  /**
   * Rename a library preset, updating EVERY owner of the old name.
   *
   * ⚠️ **A preset name is a primary key in five places, and this is the only function that can see all of
   * them.** `PresetManager.library` (+ its order map), the grid's `tileElements`/`tileCanvases`,
   * `GridTileRenderer.activeSlots`, `preset.metadata.name`, and the two live `main.ts` holders below. Missing
   * one does not throw: it produces a preset the library knows under a name some other map does not, which is
   * exactly the shape of the 2026-08-20 frozen-tile bug (`acquireSlot` returns early on a name it already has,
   * so two canvases split one identity and one stops animating).
   *
   * ⚠️ **`lastAppliedPresetName` is the non-obvious one.** It gates render-mode persistence at the
   * `isSamePreset` test — a preset renamed while it is the active one would compare unequal to itself on the
   * next apply, silently discarding the live render mode and reverting to `preset.renderer.mode`. That reads
   * as "renaming a preset changed how it draws".
   *
   * Returns the name actually applied, which may carry a ` v<n>` suffix, or `null` if `from` is not a library
   * preset. The suffix is resolved HERE rather than in either panel, so both entry points get the same rule —
   * the same `nextVersionedName` the import path uses, measured over the composed library's 247 names
   * (re-measured 2026-09-19, EIGHTH settle batch — see `export.ts`' `VERSION_SUFFIX_RE` for the basis).
   */
  function renamePreset(from: string, to: string): string | null {
    if (!presetManager.has(from)) return null;
    const wanted = to.trim();
    if (!wanted) return null;
    if (wanted === from) return from;

    // Its own name must not count as taken, or renaming `X` while `X v2` exists would skip a free name.
    const taken = new Set(
      presetManager.list().map((n) => n.toLowerCase()).filter((n) => n !== from.toLowerCase()),
    );
    const finalName = taken.has(wanted.toLowerCase()) ? nextVersionedName(wanted, taken) : wanted;

    // `PresetManager` first — it owns the library entry, the order index (which the rename PRESERVES, so the
    // preset does not move under an order sort) and the `metadata.name` copy.
    if (!presetManager.rename(from, finalName)) return null;

    // The grid re-keys its two maps and releases/re-acquires the renderer slot, in that order.
    previewGrid.renameTile(from, finalName);

    // Both live holders. `presetNames` is rebuilt from the owner rather than patched, so its ORDER comes from
    // `PresetManager` and cannot drift from the library.
    const wasActive = presetNames[currentPresetIndex] === from;
    refreshPresetNames(wasActive ? finalName : presetNames[currentPresetIndex]);
    // See the ⚠️ above: skipping this silently resets the render mode on the next apply.
    if (lastAppliedPresetName === from) lastAppliedPresetName = finalName;

    // The Lab's working copy carries its own `metadata.name`; leave a preset it is not showing alone.
    const labState = labPanel.getState();
    const working = labState.workingPreset;
    if (working && working.metadata.name === from) {
      // `setWorkingPresetExternal` would emit `preset-changed` and re-init the generators, the renderer and
      // TransMap for what is only an identity change — so the name is written directly into the existing
      // working copy instead. That copy is already a mutable deep clone (`getWorkingCopy`), never the frozen
      // library entry. ⚠️ `has`, not `getWorkingCopy`: this is an existence test, and the first spelling
      // deep-cloned a whole preset per rename purely to discard it.
      if (presetManager.has(finalName)) working.metadata.name = finalName;
    }

    if (wasActive) previewGrid.setActivePreset(finalName);
    console.debug(`Renamed preset "${from}" -> "${finalName}".`);
    return finalName;
  }

  /**
   * Apply the STARTUP preset's `overlay` block, by running the same path a grid click runs.
   *
   * ⚠️ **Without this the default preset loads HALF-APPLIED, and it looks like stale data rather than a
   * missing call.** `applyPresetChange` is the only reader of the `overlay` block, and until 2026-08-27 it
   * had exactly one caller — the Lab's `onPresetChanged` — so the preset chosen at `config.defaultPreset`
   * got its `generators`, `renderer` and `postProcessors` (via `initGenerator`/`initRenderer`/`initTransMap`)
   * and **none** of its overlay: `currentFilmLook` stayed at the bare `'Legacy'` literal, `renderMode` came
   * from `preset.renderer.mode` instead of `overlay.renderMode`, and `currentMaterial` was read into a
   * variable at startup but never handed to the generator or renderer.
   *
   * Reported as *"a page refresh shows a different preset config than selecting it in the grid — how did the
   * old config survive?"*. Nothing survived: there is no `localStorage`/`sessionStorage` anywhere in `src/`.
   * The two paths simply read different halves of the preset, which is **invariant 17 reached through a
   * missing call rather than a mis-ordered resolution**.
   *
   * ⚠️ **Invisible for the entire life of the engine, and structurally so: none of the 177 legacy presets
   * carries an `overlay` block at all**, so for the whole original library the two paths agree by
   * construction. It became reachable only when a SETTLED refined preset — which carries a full overlay —
   * became the default. It would reappear for any other settled preset named in `config.defaultPreset`.
   *
   * ⚠️ **Called here, not at `initRenderer`, and not by duplicating the overlay logic.** A second apply
   * implementation is how `DEFAULT_LINE_WIDTH` and `DEFAULT_ATTRACTOR_BLEND` came to disagree between their
   * two sites (see their write-ups above); this reuses the one path so the two can never drift again. The
   * position is the earliest one that is safe: every callee (`applyFilmLook`, `applyOverlayConfigBlocks`,
   * `reinitRenderer`, `reinitTransMap`, `applyFluidFeedbackState`) and every processor it touches is
   * constructed above, `perfGuard` is already `?.`-guarded for exactly this pre-construction window, and
   * `notifyExternalChange` has no subscribers yet — the two tabs read live state when they are BUILT, a few
   * lines below, so they see the applied values without needing the notification.
   *
   * ⚠️ **`lastAppliedPresetName` must be cleared first.** It is seeded from the startup preset at its
   * declaration, so leaving it set would make the `isSamePreset` test true and keep the live render mode
   * instead of adopting `overlay.renderMode` — the preset would still load in the wrong mode, which is the
   * bug this fixes, minus the film look.
   *
   * The cost is one redundant dispose+init of the generator, renderer and TransMap, paid once at startup.
   * Accepted rather than optimised away: the alternative is a partial init above plus a divergent second
   * path here, which is the defect. It is not measurable against page load.
   */
  if (preset) {
    lastAppliedPresetName = null;
    applyPresetChange(preset);
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  // The reel runner (v8 Phase 19)
  //
  // ⚠️ **Read `research_paper_psss_fractal_v8.md` → *Phase 19* → 19.4/19.5 before editing.** The division of
  // labour is fixed and each part is silent when it moves: **the runner ARMS a transition, `applyPresetChange`
  // is what CAPTURES the outgoing frame, and the frame loop RELEASES the capture.** Every timing figure lives
  // in `reel-model.ts` and none is duplicated here.
  //
  // ⚠️ **`black` uses NO GL AT ALL — it is a DOM overlay.** That is a measured decision, not a shortcut: there
  // are three present branches (bloom+tonemap, bloom+blit, direct blit) and a gain uniform would have had to be
  // threaded into each one differently, with two of them having no program of their own to carry it. One `div`
  // with an `opacity` is uniformly correct across all three, costs nothing when idle, and cannot be forgotten by
  // a fourth branch. `document.documentElement.requestFullscreen()` is what makes it work in full screen — the
  // overlay is a `body` child, so it is INSIDE the fullscreen element. Fullscreening the canvas instead would
  // put the overlay behind it and S1 would silently do nothing.
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════

  /** The reel being played, already resolved against the library, or `null` when nothing is playing. */
  let reelPlaying: ResolvedReel | null = null;
  let reelCursor: ReelCursor | null = null;
  let reelTransition: ReelTransition = 'fade';
  let reelHoldMs = 20000;
  /** Absolute rAF timestamp at which the current preset's hold began. */
  let reelPassStart = 0;
  /** Absolute rAF timestamp at which the current transition began, or 0 when none is running. */
  let reelTransitionStart = 0;
  /** Whether the incoming preset has already been applied within THIS transition. */
  let reelApplied = false;
  /** Read by Step 3b in `drawFrameBody`. 0 means the cross-fade is bypassed entirely. */
  let reelFreezeWeight = 0;
  let reelCrossfade: ReelCrossfade | null = null;
  /**
   * The preset to put back when the reel stops.
   *
   * ⚠️ **The runner drives `applyPresetChange` DIRECTLY and never `setWorkingPresetExternal`.** The Lab's
   * `workingPreset` is what the user is editing; a reel that overwrote it would silently discard an in-progress
   * edit in Sliders or the Composer and re-seed every tab's baseline eight times a minute. The cost of not
   * touching it is that the engine and the Lab diverge while a reel plays, which is why this field exists —
   * stopping puts the user's own preset back on screen.
   */
  let reelReturnPreset: UnifiedPreset | null = null;
  const reelPlayListeners: ((playing: boolean) => void)[] = [];

  /**
   * The S1 overlay. Created once, `display: none` until a `black` transition needs it.
   *
   * ⚠️ `pointer-events: none` is load-bearing — without it the overlay swallows the canvas click that is the
   * only way out of full screen on a machine with no keyboard focus in the document.
   */
  const reelBlackOverlay = document.createElement('div');
  reelBlackOverlay.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;'
    + 'pointer-events:none;z-index:9999;display:none';
  document.body.appendChild(reelBlackOverlay);

  function reelIsPlaying(): boolean {
    return reelPlaying !== null;
  }

  function notifyReelPlayState(): void {
    const playing = reelIsPlaying();
    // A copy: a listener may unsubscribe from inside its own callback (a tab disposing).
    for (const cb of [...reelPlayListeners]) cb(playing);
  }

  function setReelBlack(alpha: number): void {
    if (alpha <= 0) {
      if (reelBlackOverlay.style.display !== 'none') {
        reelBlackOverlay.style.display = 'none';
        reelBlackOverlay.style.opacity = '0';
      }
      return;
    }
    if (reelBlackOverlay.style.display === 'none') reelBlackOverlay.style.display = '';
    reelBlackOverlay.style.opacity = String(alpha);
  }

  /**
   * Freeze the presented frame for an S2 cross-fade.
   *
   * ⚠️ **Called BEFORE `applyPresetChange`, which clears both trail buffers.** A capture taken afterwards
   * freezes black, and the symptom is a transition that looks like the plateau is simply too long — not like an
   * ordering error. `REEL_APPLY_AT_MS.fade` is 0, so the two land in the same frame and the order here is the
   * only thing separating them.
   *
   * A `false` return is a supported outcome, not an error: the transition degrades to a hard cut because
   * `hasCapture()` stays false and Step 3b skips the mix.
   */
  function reelCaptureFreeze(): void {
    if (!reelCrossfade) reelCrossfade = new ReelCrossfade(gl);
    reelCrossfade.capture(fboState.texA, canvas.width, canvas.height);
  }

  function reelAdvance(): void {
    if (!reelPlaying || !reelCursor) return;
    const index = reelCursor.next();
    const name = reelPlaying.order[index];
    if (name === undefined) return;
    const p = presetManager.getWorkingCopy(name);
    if (!p) return;
    applyPresetChange(p);
    // ⚠️ Per switch, not per session. `PerfGuard` averages over a window, and a preset change is a legitimate
    // spike (a full generator/renderer/TransMap re-init) — without this, a reel of heavy presets trips the guard
    // on the third switch and every tile in the Lab stops animating for the rest of the session.
    perfGuard.reset();
  }

  function reelEndTransition(now: number): void {
    reelTransitionStart = 0;
    reelApplied = false;
    reelPassStart = now;
    reelFreezeWeight = 0;
    setReelBlack(0);
    // Frees two canvas-sized RGBA16F textures' worth of *content*, not the allocation — `dispose()` is for
    // teardown. Holding the capture between transitions would keep a stale frame that a resize could then mix.
    reelCrossfade?.releaseCapture();
  }

  /** The per-frame clock. `now` is the rAF timestamp — see the note at the call site in `drawFrameBody`. */
  function reelTick(now: number): void {
    if (!reelPlaying) return;

    if (reelTransitionStart === 0) {
      if (now - reelPassStart < reelHoldMs) return;
      reelTransitionStart = now;
      reelApplied = false;
      // ⚠️ The capture happens HERE, before the `applied` branch below can run in this same tick.
      if (reelTransition === 'fade') reelCaptureFreeze();
    }

    const mix = transitionMix(reelTransition, now - reelTransitionStart);
    if (mix.applied && !reelApplied) {
      reelApplied = true;
      reelAdvance();
    }
    // Two channels, one moved per mode, both released to their identity by `transitionMix` at `done`.
    setReelBlack(1 - mix.outputGain);
    reelFreezeWeight = mix.freezeWeight;
    if (mix.done) reelEndTransition(now);
  }

  /**
   * Start playing a reel.
   *
   * `wantFullscreen` is false for the deployment autostart and true for the tab's Play button, and the
   * difference is not cosmetic: ⚠️ **`requestFullscreen` is rejected outside a user gesture**, and a REJECTION
   * here would leave the reel playing with the Lab still open — the Play button's gesture is what makes the ask
   * sound. ⚠️ **The autostart asking for nothing here does NOT mean it stays in a window (19.12a):**
   * `startPresentation` owns both its layout and its own gesture-less ask, and owns the refusal too.
   */
  function reelStart(reel: Reel, wantFullscreen: boolean): void {
    const resolved = resolveReel(reel, (n) => presetManager.has(n));
    if (resolved.order.length === 0) return;
    if (resolved.skipped.length > 0) {
      console.warn(`[reel] "${reel.name}": ${resolved.skipped.length} preset(s) not in this library, skipped`);
    }

    // Stop first, so a Play over a running reel cannot leave the previous cursor and capture alive.
    if (reelPlaying) reelStop(false);

    reelPlaying = resolved;
    reelTransition = reel.transition;
    reelHoldMs = reel.playSeconds * 1000;
    reelCursor = new ReelCursor(resolved.order.length, reel.playMode);
    reelReturnPreset = labPanel.getState().workingPreset;
    reelPassStart = performance.now();
    reelTransitionStart = 0;
    reelApplied = false;
    reelFreezeWeight = 0;
    reelAdvance();
    notifyReelPlayState();

    if (wantFullscreen && !document.fullscreenElement) {
      // Same shape as the canvas-click handler (D18): the panel mode follows the browser, never the request.
      const entering = document.documentElement.requestFullscreen?.();
      if (entering) {
        entering.then(() => setPanelMode('fullscreen')).catch(() => {
          console.warn('PSSS: fullscreen request was rejected; the reel is playing in', panelMode);
        });
      } else {
        setPanelMode('fullscreen');
      }
    }
  }

  /**
   * Stop playing.
   *
   * `leaveFullscreen` is false only for the internal restart path above. ⚠️ **Re-entrant by design**: exiting
   * full screen fires `fullscreenchange`, whose handler calls this again — the `reelPlaying` test at the top is
   * what makes the second call a no-op rather than a second `exitFullscreen`.
   */
  function reelStop(leaveFullscreen = true): void {
    if (!reelPlaying) return;
    reelPlaying = null;
    reelCursor = null;
    reelTransitionStart = 0;
    reelApplied = false;
    reelFreezeWeight = 0;
    setReelBlack(0);
    reelCrossfade?.releaseCapture();

    const restore = reelReturnPreset;
    reelReturnPreset = null;
    if (restore) applyPresetChange(restore);

    if (leaveFullscreen && document.fullscreenElement) {
      const exiting = document.exitFullscreen?.();
      if (exiting) exiting.catch(() => { /* the fullscreenchange listener is the fallback */ });
    }
    notifyReelPlayState();
  }

  const reelControls: ReelControls = {
    play: (reel: Reel) => reelStart(reel, true),
    stop: () => reelStop(),
    isPlaying: reelIsPlaying,
    onPlayStateChange: (cb: (playing: boolean) => void) => {
      // ⚠️ A LIST with a per-subscriber unsubscribe (invariant 15), not a slot. The Reel tab is disposed and
      // rebuilt with the panel, so a slot would leave a dead callback writing into a detached button.
      reelPlayListeners.push(cb);
      return () => {
        const i = reelPlayListeners.indexOf(cb);
        if (i >= 0) reelPlayListeners.splice(i, 1);
      };
    },
  };

  /**
   * v8 Phase 22 — **the facet filter's ONE state and ONE cache, shared by both views** (`22.D3`).
   *
   * ⚠️ **Owned HERE and handed down, not built by the grid.** The Lab panel is constructed and `init`-ed before
   * `new PreviewGridPanel` below, and the Reel tab's picker is built inside that `init` — so the grid's copy does
   * not exist yet at the moment the other view needs it. Two instances would filter two lists that look like one:
   * the chips in the Reel tab would move and the grid would not, with nothing anywhere reporting a fault.
   *
   * ⚠️ **`getPresetNames`/`getPreset` are the same `presetManager` closures both panels get**, so the index is
   * built over the authoritative library rather than over either panel's snapshot array.
   */
  const presetFilter: PresetFilterModel = {
    state: new FilterState(),
    index: new FacetIndex(
      () => presetManager.list(),
      (name: string) => presetManager.getWorkingCopy(name),
    ),
  };

  const labPanel = new SynthesisLabPanel({
    canvas,
    // Own copy — see the D4 note at `presetNames`.
    presetNames: [...presetNames],
    // The authoritative list, re-read on every call. The array above is a snapshot; this is not.
    getPresetNames: () => presetManager.list(),
    getPreset: (name: string) => presetManager.getWorkingCopy(name),
    stats: presetStats,
    onPresetChanged: (newPreset: UnifiedPreset) => {
      applyPresetChange(newPreset);
    },
    onImportPreset: (name: string, imported: UnifiedPreset) => {
      presetManager.importSingle(name, imported);
      previewGrid.prependPreset(name);
      // D4: re-read the authoritative list from PresetManager. `prependPreset` mutates the GRID's own array
      // now, so without this the local `presetNames` and `currentPresetIndex` would not know the new preset
      // exists — which is what made the Lab reject an imported name as a duplicate and made arrow-key
      // navigation jump by one.
      refreshPresetNames(name);
      // Apply the imported preset and navigate to it in the grid.
      // `setWorkingPresetExternal` emits `preset-changed`, which the Lab panel forwards to
      // `onPresetChanged` → `applyPresetChange`. Calling `applyPresetChange` here as well applied the
      // preset twice — two full generator/renderer/TransMap re-inits per import.
      const p = presetManager.getWorkingCopy(name);
      if (p) {
        currentPresetIndex = presetNames.indexOf(name);
        labPanel.getState().setWorkingPresetExternal(p);
      }
      setPanelMode('grid');
      previewGrid.setActivePreset(name);
      previewGrid.scrollToActive();
    },
    onImportBundle: applyImportedBundle,
    onRenamePreset: renamePreset,
    onGridClick: () => setPanelMode('grid'),
    evoTileRenderer,
    historyTileRenderer,
    visualFxControls,
    reelTileRenderer,
    reelStore,
    reelControls,
    presetFilter,
  });

  if (preset) labPanel.init(preset, rightPanel);

  // --- Preview Grid panel ---
  const previewGrid = new PreviewGridPanel({
    // Own copy — see the D4 note at `presetNames`. `prependPreset` mutates THIS array, which is now the
    // grid's alone rather than shared with the Lab and with `currentPresetIndex`.
    presetNames: [...presetNames],
    // The authoritative list, re-read on every call. The array above is a snapshot; this is not.
    getPresetNames: () => presetManager.list(),
    /*
     * The header's Play button (owner, 2026-10-10), which replaces the autostart the browser deployment
     * used to do by itself.
     *
     * ⚠️ **`reelControls.play` — the SAME owner the Reel tab's Play button uses**, so the two cannot
     * diverge. The reel is resolved at PLAY time (`reelStart` skips names this library does not have)
     * and `mainReelName()` owns which reel counts as the main one, so neither is decided here.
     */
    playMainReel: () => {
      const main = reelStore.mainReel();
      if (!main) { console.warn('[reel] Play: no main reel to play'); return; }
      reelControls.play(main);
    },
    getPreset: (name: string) => presetManager.getWorkingCopy(name),
    gl,
    onSelect: (name: string) => {
      const p = presetManager.getWorkingCopy(name);
      if (!p) return;
      currentPresetIndex = presetNames.indexOf(name);
      previewGrid.setActivePreset(name);
      // Applies the preset via the emit → Lab listener → onPresetChanged → applyPresetChange. See the
      // note on the Lab's onImportPreset above: calling applyPresetChange here too ran it twice.
      labPanel.getState().setWorkingPresetExternal(p);
      console.debug(`Preset: "${name}"`);
    },
    onLabClick: () => setPanelMode('lab'),
    presetsFilename: 'psss_presets',
    onImportPreset: (name: string, imported: UnifiedPreset) => {
      presetManager.importSingle(name, imported);
      previewGrid.prependPreset(name);
      // D4: re-read the authoritative list from PresetManager. `prependPreset` mutates the GRID's own array
      // now, so without this the local `presetNames` and `currentPresetIndex` would not know the new preset
      // exists — which is what made the Lab reject an imported name as a duplicate and made arrow-key
      // navigation jump by one.
      refreshPresetNames(name);
      const p = presetManager.getWorkingCopy(name);
      if (p) {
        currentPresetIndex = presetNames.indexOf(name);
        // Single apply, via the emit — see the note on the Lab's onImportPreset above.
        labPanel.getState().setWorkingPresetExternal(p);
      }
      previewGrid.setActivePreset(name);
      previewGrid.scrollToActive();
    },
    onImportBundle: applyImportedBundle,
    onRenamePreset: renamePreset,
    // Sorting is a VIEW: `list(mode)` returns a fresh array and never reorders the library. That matters
    // because insertion order is what puts each `"<Original> new"` refined preset beside its original, and
    // alphabetical order splits 9 of those 177 pairs — a sort that rewrote the library would destroy the
    // adjacency with no way back.
    getSortedPresetNames: (sort) => presetManager.list(sort),
    presetFilter,
  });
  previewGrid.init(rightPanel);
  previewGrid.setActivePreset(presetName);

  /**
   * The single resize routine. Every path that changes the canvas size calls this.
   *
   * There used to be two near-identical copies — one inside `setPanelMode` and one in the `window`
   * resize handler — and they had DRIFTED: the window copy omitted `neonLineRenderer.resize()`,
   * `physarumProcessor.resize()` and `fluidProcessor.resize()`, and it passed the RAW preset to
   * `initTransMap` instead of a synthetic one carrying live overlay state. So resizing the browser
   * window left the neon renderer with stale dimensions (its NDC conversion divides by `uResolution`,
   * so lines were drawn off the figure) and silently reverted TransMap to the preset's stored style —
   * while a panel-mode change did both correctly. Two copies of a 20-line sequence is how that
   * happened; one copy is the fix.
   *
   * ⚠️ The two field-simulation omissions were NOT part of that defect, though this comment used to
   * claim they left "both field simulations at the old resolution". They have no resolution to be stale
   * at: both run at a fixed 512² and observe nothing about the canvas, so the *drifted* copy was
   * accidentally the correct one. Both `resize()` methods were deleted in triage H12; see the doc
   * comments left in their place.
   */
  function resizeAll(): void {
    // ⚠️ **`w`/`h` are BACKING-STORE pixels from here down, not CSS pixels** — `resolveRenderSize` applies
    // the render scale, and every call below (the generator, the renderer, both FBO sets, bloom, the tone
    // map, TransMap, the depth field) is sized in the units the GL passes actually use. Anything that wants
    // the on-screen size must read the canvas's CSS box, never these two.
    const css = getCanvasCssSize();
    const { w, h } = resolveRenderSize(css.w, css.h);
    /*
     * ⚠️ **THE NO-OP GUARD IS WHAT MAKES OBSERVING THE LAYOUT AFFORDABLE** (2026-10-15), and it is a
     * correctness property rather than a saving. Everything inside it destroys and rebuilds both FBO sets,
     * which **clears the accumulated trail** — a visible flash, documented at `readDevicePixelRatio`. This
     * function now has four callers (the `resize` event, the `transitionend` settle, and `setPanelMode`
     * twice), and three of them routinely fire at a size that has not changed: a grid↔lab switch keeps the
     * canvas exactly as it was, and the settle normally confirms what the 350 ms timer already applied.
     * Unguarded, every one of those would flash the trail for nothing.
     *
     * ⚠️ **`previewGrid.reconcileSlots()` stays OUTSIDE it, and that is the one call that must.** It follows
     * the RIGHT panel, not the canvas: a grid↔lab switch changes the canvas size by zero and is exactly the
     * case where the grid has just become visible, and `reconcileSlots()` *returns immediately while the
     * grid is hidden* — so the call that is needed most is the one the guard would always skip.
     */
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;
      config.canvas.width = w;
      config.canvas.height = h;
      generator.resize(w, h);
      renderer.resize(w, h);
      ribbonRenderer.resize(w, h);
      neonLineRenderer.resize(w, h);
      destroyFBOs(gl, fboState);
      fboState = createPingPongFBOs(gl, w, h);
      destroyPostFBO(gl, postFBO);
      postFBO = createPostFBO(gl, w, h);
      bloom.resize(w, h);
      toneMap.resize(w, h);
      // Synthetic preset, not `preset` — TransMap's enabled/style/ifsParams are LIVE overlay state owned by
      // the Visual FX tab, so re-initialising from the preset's stored block would discard whatever the user
      // currently has selected. That override is the whole reason `reinitTransMap` exists (triage I8): this
      // site's hand-written copy WAS the repair for a resize path that passed the raw preset and silently
      // reverted the style, so it is the one duplicate most worth not having.
      reinitTransMap(preset, w, h);
      // The depth field is a full-canvas target, so it DOES resize — unlike physarum and fluid below, which are
      // fixed 512². Its own `resize()` reallocates and re-tests the FBO rather than re-`init`ing, so the program
      // and VAO survive; and it clears the `failed` latch, so a resolution that a driver refused `R16F` at does
      // not condemn the next one.
      depthField.resize(w, h);
      // ⚠️ **`transMapForce` follows the canvas here** (fixed 2026-11-12; found 2026-10-15). Its `readback()` reads
      // `width × height` of the live displacement texture and `sampleForce()` scales every lookup by them, so
      // without this, after any resize — entering FULLSCREEN is one — the 9 presets with `transMapForceBlend > 0`
      // read a stale rectangle (undefined data, no GL error) and pushed the wrong part of the figure, silently.
      transMapForce.resize(w, h);
    }
    // ⚠️ **The grid's slots are repaired here, and a resize is the case that needs it** (2026-09-25): the tile
    // track is `repeat(auto-fill, minmax(200px, 1fr))`, so a wider window grows the tile COUNT and acquires a
    // burst of new slots — the one situation where the renderer can hit its hard ceiling and leave an on-screen
    // tile without one. An `IntersectionObserver` reports intersection CHANGES, so a tile that stayed on screen
    // throughout has no event left to fire and would stay frozen for the life of the tab. `reconcileSlots()` is
    // a `Map.has` per visible tile and returns immediately when the grid is hidden.
    previewGrid.reconcileSlots();
    // ⚠️ `physarumProcessor.resize()` and `fluidProcessor.resize()` used to be called here. Deleted
    // 2026-08-12 (triage H12) — both simulations run at fixed 512² and are resolution-independent by
    // construction, so both methods were `dispose(); init(gl);` rebuilding 9 programs / 9 textures /
    // 9 FBOs / 6 VAOs into a byte-identical state, while CLEARING the accumulated velocity and trail
    // fields. Nothing here needs to notify them of a canvas change. See the doc comments where the two
    // methods used to be, in `physarum.ts` and `fluid-advection.ts`.
  }

  // --- Panel mode management ---
  function setPanelMode(mode: PanelMode): void {
    const prev = panelMode;
    if (mode === 'fullscreen' && prev !== 'fullscreen') {
      preFullscreenMode = prev as 'grid' | 'lab';
    }
    panelMode = mode;

    // The name label belongs to full screen alone. Left up, it would hang over the grid or the Lab for its
    // remaining seconds — and `revealFullscreenPresetLabel` cannot catch that, since leaving is not a mouse move.
    if (mode !== 'fullscreen') hideFullscreenPresetLabel();

    appLayout.classList.toggle('fullscreen', mode === 'fullscreen');

    if (mode === 'grid') {
      previewGrid.show();
      labPanel.hideInPanel();
    } else if (mode === 'lab') {
      previewGrid.hide();
      labPanel.showInPanel();
    } else {
      previewGrid.hide();
      labPanel.hideInPanel();
    }

    /*
     * Resize for the box as it is NOW, and again after the CSS transition.
     *
     * ⚠️ **THE 350 ms TIMER IS NO LONGER THE INSTRUMENT THAT GETS THE FINAL SIZE RIGHT — the
     * `transitionend` listener beside the `resize` one is** (2026-10-15). It is kept because a transition
     * that never runs fires no event, and there are three such cases: the `max-width: 999px` breakpoint
     * changes `grid-template-rows`, which `layout.css` does not transition; a toggle that lands on the
     * columns the layout already has starts no transition at all; and `prefers-reduced-motion` or a
     * zero-duration override would remove it. So this is the FALLBACK and the event is the answer —
     * the reverse of how the two used to be related.
     *
     * ⚠️ **It used to be the only repair, and the margin was 50 ms over a 300 ms transition.** Landing
     * early left the backing store at a mid-transition width with nothing to correct it, which is the
     * squash `getCanvasCssSize()` documents. ⚠️ **And it is `resizeAll`'s no-op guard that makes having
     * both cheap** — whichever of the two arrives second now costs one `resolveRenderSize` instead of a
     * full FBO rebuild and a cleared trail.
     *
     * `scrollToActive()` stays on the timer rather than moving to the event: it is about the grid's scroll
     * position, not about the canvas, and it must run exactly once per toggle.
     */
    resizeAll();
    setTimeout(() => {
      resizeAll();
      if (prev === 'fullscreen' && mode === 'grid') {
        previewGrid.scrollToActive();
      }
    }, 350);

    console.debug(`Panel mode: ${prev} → ${mode}`);
  }

  // Start in grid mode
  labPanel.hideInPanel();

  perfGuard = new PerfGuard();
  // `?reel=2` (the performance test reel) needs the overlay's capture window, so it implies `?perf=1`.
  const perfTestRun = new URLSearchParams(window.location.search).get('reel') === '2';
  if (new URLSearchParams(window.location.search).get('perf') === '1' || perfTestRun) {
    perfHud = new PerfHud(gl, {
      tiles: () => [
        { label: 'grid', stats: previewGrid.getTileStats() },
        { label: 'reel', stats: reelTileRenderer.getStats() },
        { label: 'evo', stats: evoTileRenderer.getStats() },
        { label: 'hist', stats: historyTileRenderer.getStats() },
      ],
      main: () => ({ guardLevel: perfGuard.level(), canvasW: canvas.width, canvasH: canvas.height }),
    });
    if (perfTestRun) {
      perfRun = new PerfRun(perfHud, {
        presetName: () => lastAppliedPresetName,
        canvas: () => ({ w: canvas.width, h: canvas.height }),
        guardLevel: () => perfGuard.level(),
        onDone: () => reelStop(),
      });
    }
  }

  installTestHook();

  // Start animation loop
  requestAnimationFrame(drawFrame);

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  // The autostart's PRESENTATION, and the one way out of it (v8 Phase 19.12, extended by 19.12a)
  //
  // The deployed page opens presenting: the main reel plays with the grid and the Lab hidden and the canvas
  // filling the window, and a click or key press hands the page over to the normal UI showing the Preview Grid.
  // Before 2026-09-14 the autostart played *inside the page*, next to a full preview grid, and the deployment's
  // own front door therefore looked like an editor that happened to be cycling.
  //
  // ⚠️ **It asks for REAL full screen on load, and the ask is EXPECTED to fail** — 19.12a, the owner's call,
  // reversing the standing "no `requestFullscreen` on autostart". `requestFullscreen` needs transient user
  // activation, which a fresh load does not have, so an ordinary tab rejects it and prints a console error of
  // its own that nothing here can suppress. It is asked anyway because the contexts where it SUCCEEDS are the
  // ones the deployment exists for: a kiosk (`--kiosk`, `--start-fullscreen`), a wrapper shell, or a page
  // already in full screen. There it costs one call and the screensaver needs no gesture at all.
  //
  // ⚠️ **When it is refused the presentation still runs, because `panelMode` is a LAYOUT** — no panel,
  // full-window canvas, complete without the browser. The one thing it cannot get by itself is the browser's
  // chrome out of the way, so **the first click is spent BUYING that** (`promotePresentation`) rather than
  // revealing the UI: a click IS a gesture, the reel keeps playing, and the NEXT click hands over. A key never
  // promotes — someone reaching for the keyboard is asking for the editor, not for a bigger picture.
  //
  // ⚠️ **At most ONE click is ever spent on the promotion** (`presentationPromoted`), so the UI stays reachable
  // in two clicks even where full screen is blocked outright by a permissions policy: a rejection arrives
  // asynchronously and cannot be waited for inside a gesture, so the FLAG bounds this, never the rejection.
  //
  // ⚠️ **Which is why it still needs an exit path of its own: `fullscreenchange` — the single funnel every
  // OTHER route out of full screen arrives through — cannot fire while nothing has entered**, and that is the
  // state the presentation starts in. `leavePresentation()` is its single owner, and since 19.12a it runs from
  // the `fullscreenchange` handler too, for the case where the promotion DID succeed and Escape follows. **Both
  // listeners are in the CAPTURE phase and `stopPropagation()`, so the input is CONSUMED**: otherwise the click
  // would also reach the canvas toggle underneath, which since 19.12a would fight the promotion by toggling
  // straight back out of it, and the key would reach the shortcut handler and change the film look or the
  // attractor of a preset whose name the user has not even seen yet. `preventDefault()` cannot do this — it
  // does not stop another listener.
  //
  // ⚠️ **`click`, not `pointerdown`**: stopping `pointerdown` does not stop the `click` that follows it, so the
  // canvas fullscreen toggle would still fire on the very gesture that was supposed to reveal the UI.
  //
  // ⚠️ **`mousemove` is deliberately NOT a wake-up** — it is the fullscreen name label's affordance (see its
  // declaration): moving the mouse tells you what is on screen, and only a click or a key takes the page over.
  //
  // Waking STOPS the reel, exactly as leaving full screen does everywhere else: `reelStop` puts the startup
  // preset back, and a reel still switching the figure every 20 seconds while someone browses the grid is no
  // longer a presentation — it is the dev-server behaviour the autostart gate exists to avoid.
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  let presenting = false;
  /** One click at most may be spent on the full-screen promotion — see the block comment above. */
  let presentationPromoted = false;

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  // `?screensaver=1` — the Windows screensaver host's input policy (v8 Phase 20.1)
  //
  // The host (`psss-engine/screensaver/`) opens this page inside a window that is ALREADY full screen, and a
  // screensaver's contract with Windows is that the FIRST input ends the session. The presentation above is
  // otherwise exactly right for that: reel playing, no panel, canvas filling the window. Only the input
  // policy differs, and it differs in every direction — so this mode changes the LISTENERS, never the layout.
  //
  // ⚠️ **A query parameter, not a build define, and that is the whole reason the mode is testable.** A define
  // would make it visible only inside the host, where this project has no instrument at all; `?screensaver=1`
  // is reachable from `npm run dev` and from an ordinary browser, so 20.10's Playwright spec can hold it.
  // It is the FIFTH such parameter (`gldiag`, `testhook`, `reel`, `tab`).
  //
  // ⚠️ **THE PROMOTION IS THE DEFECT THIS MODE EXISTS TO REMOVE.** Inside a host window that is already full
  // screen, `document.fullscreenElement` is **null** and a click IS a transient user activation, so
  // `requestFullscreen` SUCCEEDS and is a visual no-op — the first input is spent on it and the screensaver
  // ignores its first click. That is the F11-first case documented by Appendix A.4 of
  // `psss-engine-v2_how_it_works.md`; under a screensaver it is not a wrinkle but a bug, and it reads
  // to a user as "sometimes it does not exit".
  //
  // ⚠️ **Construction is NOT skipped** — the Lab and the Grid are still built and hidden, exactly as they are
  // today. A second init path is the hazard invariant 23 names, and the host's `/c` config mode needs the Lab
  // anyway: ONE boot path, one input policy switched.
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  const screensaver = new URLSearchParams(window.location.search).get('screensaver') === '1';
  /** Idempotent like `leavePresentation`'s `presenting` test — a click and a key can land in one frame. */
  let screensaverExitRequested = false;
  /**
   * The cursor position at the FIRST `mousemove`, and the path length walked since.
   *
   * ⚠️ **Two distinct reasons the first move must not exit, and one of them is not solved by a delay**:
   * Windows delivers a `WM_MOUSEMOVE` whenever the cursor merely happens to sit inside a newly created
   * window, with no motion and no click involved. That needs the first sample DISCARDED, which is what `null`
   * here means. The host's own ~700 ms grace period is the other remedy, for the mouse-up and drift of the
   * double-click that launched the `.scr` by hand. Conflating them yields a saver that ignores 700 ms of real
   * input *and still* exits instantly when the cursor was already centred.
   */
  let screensaverMoveFrom: { x: number; y: number } | null = null;
  let screensaverMovePath = 0;
  /** Cumulative path length, in CSS px, before a mouse move counts as intent. */
  const SCREENSAVER_MOVE_THRESHOLD_PX = 8;

  /**
   * The ONE funnel out of screensaver mode — the same single-owner shape as `leavePresentation()`, and for the
   * same reason, but the opposite verb.
   *
   * ⚠️ **It never calls `leavePresentation()`**: there is no grid to hand over to. The host owns the window,
   * so the page's whole job is to say "close me" and stop; anything else here would leave a screensaver
   * showing an editor that the user has no chrome to close.
   *
   * ⚠️ **The `console.debug` is not decoration — it is the browser-side instrument.** `chrome.webview` is
   * absent outside the host, so in a browser (and in 20.10's spec) this line is the only evidence the funnel
   * ran. Keep both channels.
   */
  function requestScreensaverExit(reason: string): void {
    if (screensaverExitRequested) return;
    screensaverExitRequested = true;
    postToHost({ type: 'psss-exit', reason });
    console.debug(`[screensaver] exit requested by ${reason}`);
  }

  function screensaverClick(e: MouseEvent): void {
    e.stopPropagation();
    requestScreensaverExit('a click');
  }

  function screensaverKey(e: KeyboardEvent): void {
    // Same bare-modifier exemption as `presentationKey`: Alt+Tab away from a screensaver should not be
    // reported as the user asking for it to end, and on some keyboard layouts the modifier arrives first.
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    e.stopPropagation();
    requestScreensaverExit(`the ${e.key} key`);
  }

  function screensaverMove(e: MouseEvent): void {
    if (screensaverMoveFrom === null) {
      screensaverMoveFrom = { x: e.clientX, y: e.clientY };
      return;
    }
    // PATH LENGTH, not displacement from the origin: a slow circle back to the start is intent, and a
    // displacement test would read it as none. Same threshold either way for a straight-line move.
    screensaverMovePath += Math.hypot(e.clientX - screensaverMoveFrom.x, e.clientY - screensaverMoveFrom.y);
    screensaverMoveFrom = { x: e.clientX, y: e.clientY };
    if (screensaverMovePath < SCREENSAVER_MOVE_THRESHOLD_PX) return;
    e.stopPropagation();
    requestScreensaverExit('a mouse move');
  }

  /**
   * Ask for real full screen from inside a gesture. Returns whether the caller's click was CONSUMED by the
   * request — i.e. whether this click bought full screen instead of revealing the UI.
   *
   * ⚠️ **`document.fullscreenElement` is the state, never a flag** (D18): where the load-time ask succeeded, or
   * the page was already in ELEMENT full screen, there is nothing to promote and a click means what it has always
   * meant. ⚠️ **Browser-level full screen is NOT that state** — F11, `--kiosk` / `--start-fullscreen`, and a page
   * embedded in a host window that is itself full screen all leave `fullscreenElement` **null**, so a promotion is
   * still owed there and the first click is spent on one that is a visual no-op (Appendix A.4 of
   * `psss-engine-v2_how_it_works.md` has a row saying so; the older
   * "F11 first ⇒ nothing to promote" wording in this comment was wrong, corrected 2026-09-14).
   */
  function promotePresentation(): boolean {
    if (presentationPromoted || document.fullscreenElement) return false;
    presentationPromoted = true;
    const entering = document.documentElement.requestFullscreen?.();
    // No Promise returned (older API surface): assume it worked, exactly as the canvas toggle does. If it did
    // not, the flag above is what makes the next click hand over instead of asking a second time.
    if (!entering) return true;
    entering.catch(() => { /* blocked outright — the next click hands over */ });
    return true;
  }

  function presentationClick(e: MouseEvent): void {
    e.stopPropagation();
    // ⚠️ **The promotion comes FIRST and returns early.** This click buys real full screen and the reel plays
    // on; only a click with nothing left to buy hands the page over.
    if (promotePresentation()) {
      console.debug('Reel autostart: presentation promoted to real full screen by a click');
      return;
    }
    leavePresentation('a click');
  }

  function presentationKey(e: KeyboardEvent): void {
    // A bare modifier is someone reaching for a browser shortcut (Ctrl+R, Alt+Tab), not someone asking for the
    // UI. Waking on it would make reloading the page look like it had lost the reel.
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    e.stopPropagation();
    leavePresentation(`the ${e.key} key`);
  }

  function startPresentation(): void {
    presenting = true;
    if (screensaver) {
      // ⚠️ **A DIFFERENT LISTENER SET, not the same one with a flag inside it** (20.1). `promotePresentation()`
      // has to be UNREACHABLE here, not merely unlikely, and the way to make it unreachable is for its only
      // caller — `presentationClick` — never to be installed. A flag inside the shared handler would leave the
      // promotion one edit away from coming back.
      window.addEventListener('click', screensaverClick, true);
      window.addEventListener('keydown', screensaverKey, true);
      window.addEventListener('mousemove', screensaverMove, true);
      // The layout is IDENTICAL to the normal presentation — this mode is the input policy and nothing else.
      setPanelMode('fullscreen');
      // ⚠️ **No `requestFullscreen`.** The host window is already full screen (D2), so the ask would succeed as
      // a visual no-op and cost the first input; in a browser it would fail and print an error that means
      // nothing here. Either way there is nothing to buy.
      console.debug('[screensaver] presenting — no fullscreen ask, and the next input ends the session');
      return;
    }
    window.addEventListener('click', presentationClick, true);
    window.addEventListener('keydown', presentationKey, true);
    // ⚠️ **Unconditionally, and BEFORE the ask** — the one place where the panel mode deliberately does not
    // follow the browser (D18). The presentation is this layout; real full screen is a bonus on top of it, so a
    // refusal may not be allowed to leave the page looking like an editor.
    setPanelMode('fullscreen');
    // The gesture-less ask (19.12a). ⚠️ **The `catch` is mandatory**: an unhandled rejection would be a SECOND
    // console error on top of the browser's own, and that one would read as a fault in the engine.
    const entering = document.documentElement.requestFullscreen?.();
    entering?.catch(() => {
      console.debug(
        'Reel autostart: full screen refused (a fresh load has no user gesture) — presenting in fullscreen panel'
        + ' mode instead, and the first click promotes it. Launch with --kiosk or --start-fullscreen to skip that.',
      );
    });
  }

  /**
   * Hand the page over to the normal UI. The single owner of leaving the presentation, and a no-op afterwards —
   * the flag is what makes a click that arrives during the same frame as a key press harmless.
   *
   * ⚠️ **The listeners are REMOVED here, not left guarded**, so that after waking there are no capture-phase
   * listeners swallowing anything: everything below this point behaves exactly as it does on a dev server.
   */
  function leavePresentation(reason: string): void {
    if (!presenting) return;
    // ⚠️ **Unreachable in screensaver mode, and guarded rather than trusted** (20.1): nothing enters full
    // screen there, so `fullscreenchange` cannot fire, and the installed listeners call
    // `requestScreensaverExit` instead of this. If a future route did reach it, handing the page over would
    // leave a screensaver showing the Preview Grid with no chrome to close it — worse than doing nothing.
    if (screensaver) return;
    presenting = false;
    window.removeEventListener('click', presentationClick, true);
    window.removeEventListener('keydown', presentationKey, true);
    // ⚠️ **Read the browser, never assume.** Until 19.12a there was no fullscreen element to exit and this was
    // a literal `false`, this function being the `fullscreenchange` fallback. A PROMOTED presentation does have
    // one, and it leaves the way every other route does — `reelStop`'s `exitFullscreen`, whose `fullscreenchange`
    // re-entry into this function is already a no-op because `presenting` is false by then.
    reelStop(document.fullscreenElement !== null);
    // `'grid'` rather than `preFullscreenMode`, which is equal to it by construction (the presentation starts
    // from the grid): the requirement is the Preview Grid, so say so rather than depend on the derivation.
    setPanelMode('grid');
    console.debug(`Reel autostart: presentation ended by ${reason}`);
  }

  /*
   * The main reel's autostart (v8 Phase 19).
   *
   * ⚠️ **GATED ON THE SCREENSAVER, NOT ON THE DEPLOYMENT BOUNDARY (owner, 2026-10-10).** It used to be gated
   * on `__PSSS_STANDALONE__` as well, on the reasoning that a deployed page is a thing people leave running
   * while the dev server is where presets are authored. The owner reversed that: **a browser deployment now
   * opens on the preview grid, exactly like `npm run dev`**, and the reel is started deliberately from the
   * grid header's **Play** button. Only the screensaver, whose entire purpose is unattended playback, still
   * plays by itself.
   *
   * `?reel=0` / `?reel=1` overrides either side. ⚠️ **`?reel=1` is now the ONLY way a browser reaches the
   * autostart path**, presentation and hidden UI included, which makes it the only way to exercise 19.12a's
   * promote-on-first-click behaviour without the screensaver host — so it is load-bearing for testing rather
   * than a convenience.
   *
   * ⚠️ **No fullscreen request here**: `startPresentation` owns it, along with the refusal an ordinary tab
   * answers with (19.12a) — asking in two places would mean two rejections and two fallbacks.
   */
  {
    const reelParam = new URLSearchParams(window.location.search).get('reel');
    // ⚠️ **`?screensaver=1` forces the autostart regardless of `__PSSS_STANDALONE__`** (20.1), so the whole mode
    // is reachable from `npm run dev`; a screensaver that needed a built artefact to show anything would be
    // testable only through the host. ⚠️ **And `?reel=0` still wins**, deliberately: it is the only way to load
    // the page in screensaver mode WITHOUT playback — the host's own `/c` config route (20.8) uses exactly that
    // — and a contradictory pair should resolve toward the debuggable side.
    /*
     * ⚠️ **THE BROWSER DEPLOYMENT NO LONGER AUTOSTARTS (owner, 2026-10-10) — `__PSSS_STANDALONE__` was
     * REMOVED from this expression.** Opening `index.html` from disk now shows the preview grid, exactly
     * as `npm run dev` does, and the main reel is started by the grid header's **Play** button instead.
     *
     * ⚠️ **THE SCREENSAVER STILL AUTOSTARTS, and that asymmetry is the point** — a screensaver that waited
     * for a click would be broken by definition, so `screensaver` stays. `?reel=1` also still forces it,
     * which is what keeps the whole presentation path (and 19.12a's promote-on-first-click behaviour)
     * reachable from a browser for testing.
     *
     * This REVERSES the standing "the deployment opens PRESENTING" decision. The presentation machinery
     * below is unchanged and is still reached by the screensaver and by `?reel=1`; nothing was deleted.
     */
    const autostart = reelParam === '1' ? true : reelParam === '0' ? false : screensaver;
    // `?reel=2` — the PERFORMANCE TEST REEL (`ui/perf-run.ts`): the same presentation path as `?reel=1`, with the
    // fixed measurement set instead of the main reel; `perfRun` (created with the overlay above) records it.
    if (reelParam === '2') {
      reelStart(perfTestReel(), false);
      if (reelIsPlaying()) startPresentation();
    } else if (autostart) {
      const main = reelStore.mainReel();
      if (main) {
        reelStart(main, false);
        // ⚠️ **Gated on the reel ACTUALLY playing.** `reelStart` returns silently when the reel resolves to
        // nothing (every name missing from this library), and hiding the UI to present a single still frame
        // would read as a hang on a page whose only affordance is a click nobody knows to make.
        if (reelIsPlaying()) startPresentation();
      } else {
        console.warn('[reel] autostart requested but the reel library is empty');
      }
    }
    /*
     * Lift `index.html`'s boot curtain — the screensaver's black-until-decided cover. **THE SECOND AND
     * LAST SITE OF `psss-screensaver-boot`**; the head of `index.html` carries the write-up, and this
     * removal is the only reason that cover can be a class instead of a duplicated `?screensaver=1`
     * rule.
     *
     * ⚠️ **UNCONDITIONAL, AND AFTER THE DECISION RATHER THAN INSIDE EITHER BRANCH.** By this line the
     * outcome is settled: if the page is presenting, `startPresentation()` has already added
     * `.fullscreen`, whose rules say the same two things the curtain did, so removing it changes
     * nothing at all; if it is not — `?screensaver=1&reel=0`, or a reel library that resolved to
     * nothing — the editor is legitimately what the user asked for and must become visible. A
     * `if (!autostart)` here would read as the safer form and would leave the presenting path relying
     * on `.fullscreen` and the curtain agreeing forever.
     *
     * ⚠️ **A throw upstream of this line leaves the screen black, and that is the correct failure in
     * this mode**: the fatal preset path posts `psss-fatal` and the host logs it and exits 1, so there
     * is nothing in the DOM this could have revealed.
     */
    document.documentElement.classList.remove('psss-screensaver-boot');
  }

  /*
   * `?tab=<TabId>` — open the Lab on a named tab (v8 Phase 20.8a, THE SECOND AND LAST OF THE PHASE'S TWO
   * `src/` CHANGES).
   *
   * It exists for the screensaver host's `/c` config route, which is *the Lab's Reel tab in a window* (D3) and
   * needs a way in: the engine had no "open tab X" entry point at all, and the honest fix is one parameter
   * rather than a host that clicks a button through `ExecuteScriptAsync`. `?tab=reel` is also testable from a
   * browser, where an injected click is not.
   *
   * ⚠️ **AFTER the autostart block, and it yields to a running presentation.** A presentation and an open Lab
   * are contradictory requests, and the presentation is the one with an input contract behind it; the host's
   * config route asks for `?reel=0&tab=reel`, which is exactly the pair that has no conflict. Silently
   * overriding either side would make the other one's parameter look broken.
   *
   * ⚠️ **Two failure modes, two different messages, both on the console.** An unknown SPELLING is a caller's
   * typo; a known spelling with no module behind it means a registration guard was false (`visualFxControls`
   * absent, or the Reel's own guard), and that is not the caller's fault at all.
   */
  {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam !== null) {
      if (presenting) {
        console.warn(`[tab] ?tab=${tabParam} ignored — the page is presenting; add ?reel=0 to open the Lab`);
      } else if (!isTabId(tabParam)) {
        console.warn(`[tab] ?tab=${tabParam} is not a tab id`);
      } else {
        // The panel mode FIRST: `setPanelMode('lab')` is what calls `showInPanel()`, and `showInPanel()` is
        // what `resume()`s the shown tab. Opening the tab into a hidden panel and then revealing it would
        // work too, but it would capture the tab-entry preset twice for no reason.
        setPanelMode('lab');
        if (labPanel.openTab(tabParam)) {
          console.debug(`[tab] opened the Lab on "${tabParam}"`);
        } else {
          console.warn(`[tab] "${tabParam}" is a tab id but no module is registered for it`);
        }
      }
    }
  }

  // Preset cycling and film look switching
  const filmLookNames = Object.keys(FILM_LOOKS);
  document.addEventListener('keydown', (e) => {
    // ⚠️ **Not in screensaver mode** (20.1). `screensaverKey` consumes the key capture-phase, so this handler
    // normally never sees it — but "normally" is not the standard here: a waking `r` cycling the ribbon mode on
    // the way out is exactly the failure 19.12's consumption clause was written for, and here the page is not
    // waking, it is dying. The mode owns the keyboard outright.
    if (screensaver) return;
    // Skip keyboard shortcuts when typing in search input
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      // v8 22.6 / 22.D11 — **the arrows walk what the grid is SHOWING**, which the grid publishes and nothing
      // else derives. ⚠️ **One publisher, every reader**: the filter's own logic stays in `filter-model.ts`, and
      // this block knows only "these names, in this order".
      //
      // ⚠️ **The selected preset may not be in the walk set.** A filter hides its tile without changing the
      // selection (22.6's stated behaviour), so the step cannot be an index into the visible list — it is a scan
      // outward from where we are through `presetNames` for the first VISIBLE name, which is the "nearest
      // visible neighbour" rule and collapses to the old `(i ± 1) % n` when nothing is filtered.
      //
      // ⚠️ **An EMPTY visible set falls back to the whole library rather than trapping the keys.** The grid can
      // be showing nothing at all (an exclusion that empties the result), and arrows that silently stopped
      // working would read as a broken keyboard, not as a filter.
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const walk = new Set(previewGrid.visibleNames());
      const total = presetNames.length;
      let idx = currentPresetIndex;
      for (let n = 0; n < total; n++) {
        idx = (idx + step + total) % total;
        if (walk.size === 0 || walk.has(presetNames[idx]!)) break;
      }
      currentPresetIndex = idx;
      const newName = presetNames[currentPresetIndex]!;
      const next = presetManager.getWorkingCopy(newName);
      if (next) {
        // Routes through the SAME path as a grid click. This block used to re-implement a subset of
        // `applyPresetChange` inline — generator, renderer, film look, TransMap, trail state, FBO
        // clears — and then call the Lab setter, whose emit reached `applyPresetChange` and redid all
        // of it. So arrow-key navigation paid for two full re-inits, and the inline version was the
        // one that got overwritten.
        //
        // That also silently disabled the ONLY attractor-preserving path in the app: the inline block
        // called `resumeAttractor` to carry attractor state across the switch, but
        // `applyPresetChange` then disposed the generator and called `setAttractor`, which allocates a
        // fresh state. The preservation never survived. Removed rather than reinstated, because
        // making it work would mean arrow keys behaving differently from every other preset change —
        // if attractor continuity is wanted, it belongs in `applyPresetChange` for all paths.
        labPanel.getState().setWorkingPresetExternal(next);
        previewGrid.setActivePreset(newName);
        console.debug(`Preset: "${newName}"`);
      }
    }

    // Number keys 1-6 switch film looks
    // Reaches only looks 1-9 of the 14 (E11): `e.key` is a single character for a plain digit press, so
    // `parseInt` can never yield 10 or more. The bound below is correct but partially unreachable. Left as
    // is deliberately — the alternative is a modifier or a two-key chord for the remaining five, and the
    // Visual FX dropdown already reaches all 14.
    const num = parseInt(e.key);
    if (num >= 1 && num <= filmLookNames.length) {
      applyFilmLook(filmLookNames[num - 1]!);
      // 21.4g — a key press IS a user choosing a look, so it adopts the palette exactly as the dropdown
      // does. ⚠️ Before `notifyExternalChange()`, so the tab re-reads a palette row that is already right.
      adoptLookPalette();
      notifyExternalChange();
    }

    // R cycles ribbon mode: off → hybrid → streaks → adaptive → off
    if (e.key === 'r' || e.key === 'R') {
      if (ribbonState === 'off') {
        ribbonState = 'hybrid';
        ribbonRenderer.setMode('hybrid');
      } else if (ribbonState === 'hybrid') {
        ribbonState = 'streaks';
        ribbonRenderer.setMode('streaks');
      } else if (ribbonState === 'streaks') {
        ribbonState = 'adaptive';
        ribbonRenderer.setMode('adaptive');
      } else {
        ribbonState = 'off';
      }
      if (ribbonState !== 'off') { linesEnabled = false; coupleDischargeToLines(); }
      notifyExternalChange();
      console.log(`Ribbon mode: ${ribbonState}`);
    }

    // A cycles attractor presets (off → preset 0 → preset 1 → ... → off)
    if (e.key === 'a' || e.key === 'A') {
      currentAttractorIndex++;
      if (currentAttractorIndex >= ATTRACTOR_PRESETS.length) {
        currentAttractorIndex = -1;
        generator.setAttractor(null);
        console.log('Attractor: off');
      } else {
        const ap = ATTRACTOR_PRESETS[currentAttractorIndex]!;
        generator.setAttractor({
          type: ap.type,
          params: ap.params,
          blend: currentBlend,
          bounds: ap.bounds,
          ...(ap.maxIter !== undefined ? { maxIter: ap.maxIter } : {}),
        });
        console.log(`Attractor: "${ap.name}" (blend=${currentBlend.toFixed(2)})`);
      }
      notifyExternalChange();
    }

    // +/- adjust attractor blend
    if ((e.key === '+' || e.key === '=') && currentAttractorIndex >= 0) {
      currentBlend = Math.min(1.0, currentBlend + 0.1);
      generator.setAttractorBlend(currentBlend);
      console.log(`Attractor blend: ${currentBlend.toFixed(2)}`);
      notifyExternalChange();
    }
    if (e.key === '-' && currentAttractorIndex >= 0) {
      currentBlend = Math.max(0.0, currentBlend - 0.1);
      generator.setAttractorBlend(currentBlend);
      console.log(`Attractor blend: ${currentBlend.toFixed(2)}`);
      notifyExternalChange();
    }

    // L toggles between grid and lab views (no-op in fullscreen)
    if (e.key === 'l' || e.key === 'L') {
      if (panelMode === 'grid') {
        setPanelMode('lab');
      } else if (panelMode === 'lab') {
        setPanelMode('grid');
      }
    }

    // Escape exits fullscreen (browser handles document.exitFullscreen,
    // fullscreenchange listener syncs panelMode)
  });

  // Fullscreen toggle on left canvas click.
  //
  // D18: both branches used to call `setPanelMode` unconditionally, immediately after asking the browser to
  // change fullscreen state. Those requests are PROMISES and can be REJECTED — a `requestFullscreen` outside
  // a user gesture, or blocked by permissions policy, resolves to nothing while `panelMode` has already been
  // set to 'fullscreen'. The UI then reports a state the browser is not in, and stays that way until the next
  // `fullscreenchange`.
  //
  // Now the panel mode follows the browser: `setPanelMode` runs only once the request has actually succeeded.
  // The `fullscreenchange` listener below still handles Escape and browser-chrome exits, so the two paths
  // agree rather than racing.
  canvas.addEventListener('click', () => {
    if (panelMode === 'fullscreen') {
      const exiting = document.exitFullscreen?.();
      if (exiting) {
        exiting.then(() => setPanelMode(preFullscreenMode)).catch(() => { /* stay in fullscreen */ });
      } else {
        // No Promise returned (older API surface) — fall back to the previous unconditional behaviour.
        setPanelMode(preFullscreenMode);
      }
    } else {
      const entering = document.documentElement.requestFullscreen?.();
      if (entering) {
        entering.then(() => setPanelMode('fullscreen')).catch(() => {
          console.warn('PSSS: fullscreen request was rejected; staying in', panelMode);
        });
      } else {
        setPanelMode('fullscreen');
      }
    }
  });

  // In full screen, a mouse move names the preset on screen for a few seconds — see the label's declaration up
  // with the panel-mode state for why the mouse, why bottom-right and why it cannot swallow the exit click.
  //
  // ⚠️ **On `window`, not on the canvas.** In full screen the canvas fills the window, but a pointer sitting over
  // the reel's black overlay during a `black` transition is over a `body` child, not the canvas, and a listener
  // on the canvas alone would go quiet for exactly as long as the blackout lasts. `revealFullscreenPresetLabel`
  // is the mode gate, so this costs a function call and a `panelMode` test outside full screen.
  //
  // ⚠️ **NOT INSTALLED in screensaver mode** (20.1, decision D6). A mouse move must END the session there, so
  // 19.12's affordance cannot survive: the label would flash for the fraction of a second between the move and
  // the host closing the window. The owner declined both replacements (a 3 s label on each reel advance, a
  // permanent corner label), so the label path is simply absent — the listener, not the label's `panelMode`
  // gate, is where that decision lives, because the gate would still be true.
  if (!screensaver) window.addEventListener('mousemove', revealFullscreenPresetLabel);

  // Sync panel mode when user exits fullscreen via Escape/browser controls
  document.addEventListener('fullscreenchange', () => {
    /*
     * ⚠️ **A PROMOTED presentation leaves through here too (19.12a), and it must go FIRST.** Escape and the
     * browser's own exit affordance never reach the presentation's capture-phase listeners, so without this the
     * presentation would survive its own full screen: reel stopped and grid back, yet two listeners still
     * swallowing the next click and key. `leavePresentation` is the single owner, so letting it do the stopping
     * and the panel mode makes both statements below no-ops on THIS route, rather than a second exit worded
     * slightly differently. It is a no-op itself on every other route, `presenting` being false.
     */
    if (!document.fullscreenElement) leavePresentation('leaving full screen');

    if (!document.fullscreenElement && panelMode === 'fullscreen') {
      setPanelMode(preFullscreenMode);
    }
    /*
     * ⚠️ **Leaving full screen STOPS the reel, and this listener is the only place that has to say so.**
     * Escape, the browser's own exit affordance, the canvas click and `reelStop`'s `exitFullscreen` all arrive
     * here, so one test covers four routes — and `reelStop` is a no-op when nothing is playing, which is what
     * makes its own exit not recurse.
     *
     * This is also what discharges the "ESC brings you back to the Reel tab" requirement without any code:
     * `setPanelMode(preFullscreenMode)` above re-shows the Lab, `showInPanel()` resumes the ACTIVE tab, and the
     * active tab is still the Reel — the tab was never switched away from.
     */
    if (!document.fullscreenElement) reelStop(false);
  });

  // Window resize uses the SAME routine as a panel-mode change — see `resizeAll`.
  window.addEventListener('resize', resizeAll);

  /*
   * ⚠️ **THE SETTLE, AND IT IS A PREREQUISITE OF MEASURING THE CANVAS RATHER THAN AN EXTRA**
   * (2026-10-15 — read `getCanvasCssSize()` first). A measured box is only ever right for the instant it
   * was read, and `.app-layout` animates `grid-template-columns` for 0.3 s on every panel-mode change
   * (`layout.css`), so without an event that fires when the animation stops, both sizing calls in
   * `setPanelMode` can land mid-flight and the backing store keeps a shape the box no longer has. That is
   * the preview⇄fullscreen squash, measured at 1520×900 inside an 800×900 box.
   *
   * ⚠️ **`transitionend`, NOT a `ResizeObserver`, and the reason is the trail.** An observer is the
   * strictly more correct instrument and would also replace the `resize` listener — but it fires on EVERY
   * box change, i.e. once per frame for the whole 300 ms animation, and each firing that resolves to a new
   * size destroys and rebuilds both FBO sets and clears the accumulated trail. That is ~18 flashes per
   * toggle where this is one. **Do not "upgrade" this to a `ResizeObserver`** unless the FBOs are first
   * taught to resize without discarding their contents.
   *
   * ⚠️ **Both guards are load-bearing.** `transitionend` BUBBLES, and the right panel's own descendants
   * (the Lab's tabs, the grid's tiles) carry transitions of their own — without the `target` test this
   * would fire on hovers and tab switches, and without the `propertyName` test it would fire again for
   * every other animated property on the layout itself.
   *
   * No `transitioncancel` companion: an interrupted transition is interrupted BY a new one, whose own
   * `transitionend` is the event that describes the state actually arrived at.
   */
  appLayout.addEventListener('transitionend', (e) => {
    if (e.target !== appLayout) return;
    if (e.propertyName !== 'grid-template-columns') return;
    resizeAll();
  });
}

function initGenerator(generator: LissajousGenerator, preset: UnifiedPreset | undefined, w: number, h: number): void {
  generator.init(
    {
      // ⚠️ v8 `36.1` — was the literal `'lissajous'`, hard-coded. One of only TWO `GeneratorConfig` call
      // sites, and both hard-coded it, which is what made `generators.type` dead for everything except
      // `migration.ts`' palette gate. Resolved at read time (`36.2`) and never written back.
      type: resolveFigureType(preset?.generators.type, preset?.generators ?? {}).type,
      particleCount: preset?.generators.particleCount ?? 500,
      // v8 `36.2` — forwarded whether or not it is the live type: the dormant block is authorial intent.
      ...(preset?.generators.lsystem !== undefined ? { lsystem: preset.generators.lsystem } : {}),
      waves: preset?.generators.waves ?? [],
      waveSpeed: preset?.generators.waveSpeed ?? 0.05,
      rotation: preset?.generators.rotation ?? [0, 0, 0],
      angle: preset?.generators.angle ?? [0, 0, 0],
      colorBase: preset?.generators.colorBase ?? [128, 128, 128],
      colorAmp: preset?.generators.colorAmp ?? [128, 128, 128],
      colorFreq: preset?.generators.colorFreq ?? [0.1, 0.1, 0.1],
      colorShift: preset?.generators.colorShift ?? [0.1, 0.1, 0.1],
      designResolution: preset?.metadata.designResolution ?? { width: 100, height: 100 },
    },
    { width: w, height: h }
  );
}

function initRenderer(renderer: HDRParticleRenderer, backend: unknown, preset: UnifiedPreset | undefined, w: number, h: number): void {
  renderer.init(backend as never, {
    mode: preset?.renderer.mode ?? 'star',
    glow: preset?.renderer.glow ?? 2.0,
    decayFactor: preset?.renderer.decayFactor ?? 0.86,
    blurRadius: preset?.renderer.blurRadius ?? 0,
    depthSize: preset?.renderer.depthSize ?? 0,
    streaks: preset?.renderer.streaks ?? 0,
  });
  renderer.resize(w, h);
}

/**
 * @param chain the LIVE chain to install, when the caller has one. Omitted by the two sites that
 *   deliberately hand over the raw preset (startup and the preset-change path) — there the preset's own
 *   `overlay.transMapChain` (or, for all 177 legacy presets, its single `style`) is authoritative, and
 *   `chainFromOverlay()` derives it.
 */
function initTransMap(transMap: TranslationMapProcessor, gl: WebGL2RenderingContext, preset: UnifiedPreset | undefined, w: number, h: number, chain?: readonly TransMapLayer[]): void {
  transMap.init(gl, buildTransMapConfig(preset, w, h, chain));
}

/**
 * **The ONE owner of the `TransMapConfig` literal** — the init path and every later rebuild read it here.
 *
 * ⚠️ **Factored out for `setTransMapWaveTables()` (v8 21.12), and the reason is a silent failure.**
 * `transMap.setChain(chain)` with no config leaves `lastConfig` holding the OLD wave tables, so a term edit
 * would assign the new tables to the preset, rebuild the static field from the stale ones, and render a field
 * that matches no control on screen. Any future caller that changes something `TransMapConfig` carries must
 * pass a config built HERE rather than assembling a second literal — two literals is how one of them comes to
 * miss a field, and neither `tsc` nor any checker can see the omission (every field is optional at the call
 * site by way of `??`).
 *
 * ⚠️ **It does NOT read the live `width`/`height` off anything global** — the caller passes them, because the
 * static field's gain solve is canvas-dependent and a rebuild at the wrong size is a magnitude change with no
 * other symptom.
 */
function buildTransMapConfig(preset: UnifiedPreset | undefined, w: number, h: number, chain?: readonly TransMapLayer[]): TransMapConfig {
  const pp = preset?.postProcessors.transMap;
  const effectiveChain = chain
    ? normaliseChain(chain)
    : chainFromOverlay(preset?.overlay, pp?.style ?? 0, pp?.ifsParams);
  return {
    enabled: pp?.enabled ?? false,
    style: pp?.style ?? 0,
    chain: effectiveChain,
    sinMagicParams: pp?.sinMagicParams ?? [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    sinMagicParams2: pp?.sinMagicParams2 ?? [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
    zoomCenterX: pp?.zoomCenter.x ?? 50,
    zoomCenterY: pp?.zoomCenter.y ?? 50,
    ...(pp?.ifsParams ? { ifsParams: pp.ifsParams } : {}),
    width: w,
    height: h,
  };
}

interface PingPongFBOs {
  fboA: WebGLFramebuffer;
  fboB: WebGLFramebuffer;
  texA: WebGLTexture;
  texB: WebGLTexture;
  width: number;
  height: number;
}

function createPingPongFBOs(gl: WebGL2RenderingContext, w: number, h: number): PingPongFBOs {
  const texA = createFBOTexture(gl, w, h);
  const texB = createFBOTexture(gl, w, h);
  const fboA = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);
  const fboB = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fboA, fboB, texA, texB, width: w, height: h };
}

function createFBOTexture(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function destroyFBOs(gl: WebGL2RenderingContext, state: PingPongFBOs): void {
  gl.deleteFramebuffer(state.fboA);
  gl.deleteFramebuffer(state.fboB);
  gl.deleteTexture(state.texA);
  gl.deleteTexture(state.texB);
}

interface PostFBO {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

function createPostFBO(gl: WebGL2RenderingContext, w: number, h: number): PostFBO {
  const tex = createFBOTexture(gl, w, h);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

function destroyPostFBO(gl: WebGL2RenderingContext, state: PostFBO): void {
  gl.deleteFramebuffer(state.fbo);
  gl.deleteTexture(state.tex);
}


/*
 * WHY THE TRAIL NEEDS A FINITENESS GUARD AT ALL — the derivation. The guard itself is
 * `TRAIL_SANITISE_GLSL` in `core/gl-program.ts`, imported at the top of this file; it MOVED there on
 * 2026-08-22 so TransMap's warp could use it too, and that file carries the rules for using it (highp
 * required, why the bound is 1e30, why alpha is included, why a guard is containment and not a fix).
 *
 * ⚠️ **This exists because the trail is a FEEDBACK LOOP and the fade pass MULTIPLIES.** Once a texel reaches
 * Inf or NaN, `dst * decayFactor` reproduces it forever: `Inf * 0.88 == Inf`, `NaN * 0.88 == NaN`. Nothing
 * else in the chain can release it either — bloom's bright-pass and the tone map both read the value rather
 * than replacing it, and both are INERT on the presets most exposed to this (`inertGrading()` gives
 * `bloom.enabled: false` and `toneMap.curve: 'none'`, so `mapped = clamp(hdr, 0, 1)` is the whole of it).
 * The only pre-existing release is the explicit FBO clear on a PRESET CHANGE — which is exactly why the
 * 2026-08-21 reports both end "does not go away" / "doesn't recover any more": a Lab CONTROL change clears
 * nothing, so the user's only escape was to switch preset.
 *
 * ⚠️ **The two decay blits below are NOT the whole of the trail's write surface, and assuming they were is
 * what left the 2026-08-21 NaN report open.** They write `texB`; TransMap writes `texA`, which is what the
 * screen path and the `?gldiag=1` probe both read. Since the decay blit sanitises on every single frame, a
 * NaN observed in `texA` on consecutive frames is being RE-CREATED downstream of the guard, not surviving
 * it — so "the guard is present" was never evidence that a NaN had to come from a source the guard could
 * see. Both writers are guarded as of 2026-08-22.
 */

/**
 * The decay pass's program (M6): the trail copy and the decay in ONE fragment — `blur` adds the 3x3 gaussian that
 * `SmoothFilter` asks for. `uFade` is `1 − decayFactor`; the output is exactly what the retired two-pass form's blend
 * produced (`rgb·(1−a)`, `a·a + alpha·(1−a)`). highp, as before: the finiteness guard's 1e30 bound is not
 * representable in mediump.
 */
function createDecayProgram(gl: WebGL2RenderingContext, blur: boolean): WebGLProgram {
  const vert = `#version 300 es
    in vec2 aPos;
    out vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;
  // sampleTrail, not texture: this is the trail feedback loop's one break point, so it is also where a diagnostic
  // sentinel must be scrubbed before it can be multiplied forever (core/gl-program.ts). No backticks in a GLSL
  // comment (invariant 18).
  const sample = blur ? `
      vec4 c = vec4(0.0);
      c += sampleTrail(uTex, vUv + vec2(-uTexelSize.x, -uTexelSize.y)) * 0.0625;
      c += sampleTrail(uTex, vUv + vec2(0.0, -uTexelSize.y)) * 0.125;
      c += sampleTrail(uTex, vUv + vec2(uTexelSize.x, -uTexelSize.y)) * 0.0625;
      c += sampleTrail(uTex, vUv + vec2(-uTexelSize.x, 0.0)) * 0.125;
      c += sampleTrail(uTex, vUv) * 0.25;
      c += sampleTrail(uTex, vUv + vec2(uTexelSize.x, 0.0)) * 0.125;
      c += sampleTrail(uTex, vUv + vec2(-uTexelSize.x, uTexelSize.y)) * 0.0625;
      c += sampleTrail(uTex, vUv + vec2(0.0, uTexelSize.y)) * 0.125;
      c += sampleTrail(uTex, vUv + vec2(uTexelSize.x, uTexelSize.y)) * 0.0625;
      c = sanitiseTrail(c);` : `
      vec4 c = sanitiseTrail(sampleTrail(uTex, vUv));`;
  const frag = `#version 300 es
    precision highp float;
    uniform sampler2D uTex;
    uniform float uFade;
    ${blur ? 'uniform vec2 uTexelSize;' : ''}
    in vec2 vUv;
    out vec4 fragColor;
    ${TRAIL_SANITISE_GLSL}
    void main() {${sample}
      // The retired fade quad, blended SRC_ALPHA, ONE_MINUS_SRC_ALPHA over the copy, written directly.
      fragColor = vec4(c.rgb * (1.0 - uFade), uFade * uFade + c.a * (1.0 - uFade));
    }`;
  return compileProgram(gl, vert, frag, blur ? 'Main decay (blur)' : 'Main decay');
}

function createBlitProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vert = `#version 300 es
    in vec2 aPos;
    out vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;
  // highp for the same reason as the blur blit — the guard's 1e30 bound is not representable in mediump.
  const frag = `#version 300 es
    precision highp float;
    uniform sampler2D uTex;
    in vec2 vUv;
    out vec4 fragColor;
    ${TRAIL_SANITISE_GLSL}
    // sampleTrail for the same reason as the blur blit above: the decay pass is the feedback loop's break
    // point, so it is where a diagnostic sentinel gets scrubbed. A no-op when uDiagSentinel is 0.0.
    // (No backticks here — invariant 18, as above.)
    void main() { fragColor = sanitiseTrail(sampleTrail(uTex, vUv)); }`;
  return compileProgram(gl, vert, frag, 'Main blit');
}

function createBlitQuad(gl: WebGL2RenderingContext, program: WebGLProgram): WebGLVertexArrayObject {
  return createQuadVAO(gl, program, 'aPos');
}

function createQuadVAO(gl: WebGL2RenderingContext, program: WebGLProgram, attrib: string): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, attrib);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

init().catch(console.error);
