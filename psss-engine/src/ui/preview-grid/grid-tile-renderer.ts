import type { UnifiedPreset, FluidFeedbackConfig, LiquidTintSource } from '../../presets/types.ts';
import { resolveFigureType } from '../../generators/figure-types.ts';
import { compileProgram } from '../../core/gl-program.ts';
import type { MaterialConfig } from '../../presets/types.ts';
import { LissajousGenerator } from '../../generators/lissajous.ts';
import { TranslationMapProcessor } from '../../post-processors/trans-map.ts';
import { chainFromOverlay, isStyleActive } from '../../post-processors/trans-map-chain.ts';
import { getColourRampData } from '../../generators/colour-ramps.ts';
import { DEFAULT_LIQUID_CONFIG } from '../../generators/material-presets.ts';
// v8 33 — the fold's default limit, so a tile's fold matches the main view's rather than a local guess.
import { BOX_FOLD_DEFAULT_LIMIT } from '../../core/deform-limits.ts';
// v8 15.1b — the ONE owner of the liquid density reference, shared with `HDRParticleRenderer` so a tile
// cannot drift from the view it previews.
import {
  LIQUID_REF_TAU_SECONDS, LIQUID_THICKNESS_DEPTH,
  REFRACT_SPREAD, SPEC_EXPONENT, FRESNEL_EXPONENT, ABSORB_SCALE, glslFloat,
  liquidDensityReference, measureIndexSpacing, smoothLiquidReference,
} from '../../renderers/liquid-reference.ts';
import type { FilmLookParams } from '../../renderers/film-looks.ts';
import { FILM_LOOKS, CUSTOMIZE_FILM_LOOK } from '../../renderers/film-looks.ts';
import { getPaletteLUT } from '../../presets/palettes.ts';
import { SYM3D_DEFAULTS } from '../../core/symmetry-groups.ts';
// v8 Step 21.4c — the ONE owner of "which palette, mapped how". See `tilePaletteFor`'s header for why this
// reader may not keep its own `??` chain now that the palette has two sources.
import {
  resolvePaletteSelection, PALETTE_UNSET, type IndexPaletteSource,
} from '../../renderers/palette-selection.ts';

const TILE_W = 256;
const TILE_H = 192;

/**
 * Hard ceiling on concurrent slots, and the argument for why it is no longer 32 (H16).
 *
 * Must exceed the number of tiles the observer can report as intersecting at once, or trailing tiles
 * find an empty pool and evict a tile the user is watching. The grid is
 * `auto-fill, minmax(200px, 1fr)` with a 100px `rootMargin`, inside a panel that is HALF the window
 * width (`.app-layout` is `1fr 1fr`), so the count is `cols x rows` where
 * `cols = floor((panelW - 16 + 8) / 208)` and rows span the scroll viewport plus 100px of margin on
 * each side. Worst case over all scroll offsets is `floor(H/pitch) + 2` — both partial edge rows:
 *
 *   1024x768    2 cols   12 tiles      1920x1200   4 cols    32 tiles
 *   1600x900    3 cols   18 tiles      2560x1440   6 cols    60 tiles
 *   1920x1080   4 cols   28 tiles      3440x1440   8 cols    80 tiles
 *   1680x1050   4 cols   32 tiles      3840x2160   9 cols   126 tiles
 *
 * ⚠️ **So 32 was not a comfortable margin, it was exactly the 1080p-class worst case** — and the
 * triage row's "roughly a 1200x1000 viewport" understates it, because the grid gets half the window:
 * the band is entered at 1680x1050, and a 1440p monitor wants 60. Beyond the cap `acquireSlot` evicts
 * the least-recently-acquired slot, and `releaseSlot` does not clear the canvas, so those tiles freeze
 * on their last painted frame — a contiguous band of dead tiles rather than slow ones.
 *
 * ⚠️ **The row's stated cost is the part that does not survive: raising this is now nearly FREE,
 * because slots are allocated LAZILY.** The row says 768 KB of GPU memory per slot — true per pair,
 * but it assumed the old eager `init()` loop, which built all `MAX_SLOTS` pairs up front. There are
 * **three** `GridTileRenderer` instances (preview grid, Evolution, History), so that was 3 x 32 pairs
 * = **72 MB allocated unconditionally**, of which Evolution can only ever use 9 (`TILE_COUNT`) and
 * History 10 (`HISTORY_MAX`) — **33.8 MB permanently unreachable**. `init()` now allocates nothing and
 * `ensureSlot()` builds a pair on first use, so cost tracks the actual high-water mark: 23.3 MB total
 * at 1024x768 and 35.3 MB at 1080p, both *below* the old figure, with 128 available to a 4K window
 * that genuinely wants 126.
 *
 * The row's other stated cost — lower per-tile refresh rate, `STEADY_BUDGET_MS` being shared — is real
 * and is accepted, because the alternative is worse: at 1440p/60 tiles the budget gives every tile
 * ~8 fps, against 32 tiles at 15 fps and **28 frozen**. A slow tile still identifies its preset; a
 * frozen one is indistinguishable from a broken renderer. That trade is the whole reason the cap
 * throttles rather than refuses.
 */
const MAX_SLOTS = 128;

// Floor for the adaptive cap: never shrink below a plausible viewport's worth,
// since starving visible tiles is worse than a slightly long tick.
const MIN_SLOT_CAP = 12;

// Headroom above the observed on-screen tile count. The cap must never fall
// below what is actually visible: every acquire beyond it evicts a tile the user
// is looking at, which then freezes on its last painted frame (releaseSlot does
// not clear the canvas) — a contiguous band of dead tiles.
const VISIBLE_SLOT_HEADROOM = 4;

/**
 * Entries kept in `phaseCache` — one `number` per preset NAME, so the whole structure is a few kB at the
 * library's full size and this bound exists to stop an unbounded session (repeated imports, renames) rather
 * than to save memory. Twice `MAX_SLOTS`, i.e. deliberately larger than any viewport's worth of tiles: the
 * cache's purpose is to survive a Grid/Lab toggle of a FULL grid, so a bound at the slot count would evict
 * precisely the entries about to be re-acquired.
 */
const PHASE_CACHE_MAX = MAX_SLOTS * 2;

/**
 * Tile:main-canvas ratio for parameters authored in ABSOLUTE SCREEN PIXELS.
 *
 * Same formula and same reference as the splat radius uniform below — `(w+h) / (1024+768)` — so every
 * pixel-denominated quantity in a tile is reduced by one consistent factor (0.25) instead of each site
 * inventing its own.
 *
 * ## Which fields qualify, and why most do not
 *
 * Sparks are spawned AFTER the perspective projection (`lissajous.ts`: the spawn loop reads
 * `this.positions` once it holds screen coordinates), and buoyancy offsets are likewise added to
 * projected positions. So spark physics runs in the pixel space of whatever canvas it is drawn into,
 * and only the terms carrying a LENGTH unit are canvas-dependent:
 *
 * | field | unit | scaled |
 * |---|---|---|
 * | `buoyancy.maxOffset` | px | ✅ |
 * | `sparks.gravity` | px/s² | ✅ — length/time², so linear in the length scale |
 * | `sparks.ejectionSpeed` | dimensionless | ❌ multiplies `dx * 30`, a delta ALREADY in tile pixels |
 * | `sparks.drag`, `coolingRate` | 1/s | ❌ |
 * | `sparks.threshold` | normalised [0,1] | ❌ `velocities[]` is divided by its own per-frame EMA max |
 * | `sparks.minLifetime`/`maxLifetime` | s | ❌ |
 *
 * `ejectionSpeed` is the trap: it looks like a velocity and reads like one in the UI, but it is a
 * multiplier on a per-frame positional delta that the projection has already reduced. Scaling it would
 * make tile sparks 4x too slow *on top of* the correct `gravity` reduction, so they would barely leave
 * the figure. Verified by unit rather than by name — see the table.
 *
 * ⚠️ This REPLACES `TILE_H / (designResolution.height ?? 720)`, which was wrong twice over. That divisor
 * is in authored MODEL units, not pixels, so it was a unit mismatch: it gave 0.27 for a 960x720 preset
 * but 1.92 for a legacy 100x100 one and 2.4 for `Miracle Frost` (80x80) — i.e. it AMPLIFIED buoyancy in
 * a tile for every preset authored small, which is all 177 legacy ones. And its `?? 720` fallback
 * contradicted the real default of `{100, 100}` used by both `LissajousGenerator` and line 307 below.
 */
const SCREEN_SPACE_TILE_SCALE = (TILE_W + TILE_H) / (1024.0 + 768.0);

const PARTICLE_DIVISOR = 4;
/**
 * Hard ceiling on a tile's particle count, applied AFTER the divisor.
 *
 * Per-tile CPU cost is linear in particle count, and the library's heaviest presets reach 20 000
 * (5 000 after the divisor) — 5x the typical tile. That single tile could consume the entire per-frame
 * math budget, starving every other tile. A tile is 256x192, where 2 000 particles is already dense.
 */
const MAX_TILE_PARTICLES = 2000;
const TARGET_FPS = 15;

/**
 * The nominal 60 Hz step, and **the reference every budget and compensation below is calibrated at.**
 *
 * ⚠️ **`FRAME_SKIP` is no longer the GATE — it is a reference value (2026-09-24).** It used to be both, as
 * `if (this.frameCount % FRAME_SKIP !== 0) return`, and that made the tile cadence a FRAME COUNT hard-wired
 * to a 60 Hz display: on a 120 Hz panel four frames elapse in 33.4 ms, so the grids stepped **30 times a
 * second against a declared `TARGET_FPS` of 15** — exactly double the intended work, for smoothness nobody
 * asked for. Measured on the built artefact (ANGLE / AMD Radeon 8060S, 119.5 Hz): the grids cost the main
 * thread 4.4–7.3 ms per frame, and on `Cylinder` — the cheapest preset in the library — the grid's 7.33 ms
 * stood against the main loop's own 3.37 ms, i.e. **the previews cost more than twice the animation they
 * preview** (119 → 80 fps). It arrived as p50 8.4 ms with p95 25.1 ms and **24.7 % of frames over 16.7 ms**,
 * which is 1 frame in 4 — `FRAME_SKIP` itself, printing its own name in the frame-time distribution.
 *
 * The gate is now `SlotState.sinceStepMs` against `TILE_STEP_INTERVAL_MS`, per slot, so the cadence honours
 * `TARGET_FPS` at any refresh rate — and, being per slot rather than per grid, it no longer forces every
 * tile's step onto the same frame, which is what made the grid's cost arrive as a hitch.
 *
 * ⚠️ **What `FRAME_SKIP` still names is the step the COMPENSATIONS were derived at**, and every
 * one of them had to be retied to the step actually taken (`this.stepFrames`), because each is silent when
 * wrong in a different way:
 *
 * | site | reading | wrong ⇒ |
 * |---|---|---|
 * | `effectiveDecay` (trail, and the fluid field's) | main-loop frames of decay the step spans | trail length drifts from the main view |
 * | `uBrightness` (via `trailBrightnessFor`) | the light that holds the SHIPPED accumulation | tiles dim or blown out |
 * | `splatBrightnessFor` | both of the above at once | the D15 "almost black" report, returning |
 * | `VEL_SCALE` | the step's positional delta is `stepFrames`× a frame's | the fluid field over- or under-reads motion |
 *
 * ⚠️ **`stepFrames` is 8 on a 120 Hz panel, not 4, and that is CORRECT rather than a doubling of the
 * compensation.** The main view decays once per main-loop frame, so in 66.7 ms it has decayed eight times at
 * 120 Hz and four at 60 Hz; a tile matching it must do the same. Tile appearance therefore varies with
 * refresh rate exactly as far as the main view's own already does — the parity the compensations exist to
 * hold is per-FRAME, and it is now held at both rates instead of only at 60 Hz.
 */
const FRAME_SKIP = Math.round(60 / TARGET_FPS);
/** The 60 Hz frame `MATH_WARM_BUDGET_MS`, `GL_WARM_BUDGET_MS` and `STEADY_BUDGET_MS` were all sized against. */
const NOMINAL_FRAME_MS = 1000 / 60;
/** Wall-clock target for one tile step. `TARGET_FPS` finally means what it says. */
const TILE_STEP_INTERVAL_MS = 1000 / TARGET_FPS;
/**
 * Clamp on the measured step, in main-loop frames.
 *
 * The lower bound is 1 (a single tick can never span less). The upper bound catches the case the
 * compensations cannot survive: a background tab, a debugger pause or a 1-second stall would otherwise
 * report a step of hundreds of frames, and `decay^300` is a black tile with `uBrightness = 300` painted into
 * it. 16 is two 120 Hz steps' worth — generous for a real display, far below any stall.
 */
const MAX_STEP_FRAMES = 16;

// Mini fluid sim grid size (CPU-side, only for style 6 tiles)
const FLUID_GRID = 64;

// Pure-math generator updates before a tile's first render. This exists only to
// step off frame 0, where presets with `Am.Base == 0` evaluate to
// sin(0)*amp == 0 for every particle and collapse to a single dot at the origin.
// It is deliberately small: the AM/FM modulators have a median period of ~7200
// frames, so no realistic warm-up "develops" the pattern — the tile animates
// through it live, which is the point of the simulation. Measured: 44% of the
// 177 presets are already well-spread at frame 0 and 62% by frame 50.
const MATH_WARM_FRAMES = 40;

/**
 * How many of `MATH_WARM_FRAMES` are spent as REAL `update()` calls; the rest is jumped analytically
 * (2026-09-25, the 56-tile grid).
 *
 * ⚠️ **`MATH_WARM_FRAMES` MUST STAY A LINE-START `const` WITH THE VALUE 40** — `reelcheck` §B reads it as text
 * (the module cannot be imported under Node) and asserts it equals `REEL_WARM_FRAMES`, and `aestheticcheck`
 * carries its own independent copy of the number. **The total warm-up is unchanged and remains 40 frames of
 * phase; only its COST changed**, from 40 particle loops per tile to 2.
 *
 * ⚠️ **MEASURED, 2026-09-25, and the equivalence was measured before the saving was** — the order matters,
 * because a cheaper warm-up that lands on a different figure is not a warm-up. Over all 177 library presets at
 * tile particle counts, `advancePhase(38)` + 2 real updates reproduces 40 real updates **bit-exactly**
 * (worst relative position difference 0.00e+0, rotating and non-rotating presets alike; the first draft, which
 * moved `pos` without the pose, was off by 1.39 of the figure's extent on `Dancing Rays` — see
 * `LissajousGenerator.advancePhase()`). The saving, over 56 presets x 3 reps in Node: **681.8 ms -> 34.7 ms**
 * of CPU for the whole fill (12.18 -> 0.62 ms per tile, **19.7x**). Against this file's 4.0 ms-per-frame math
 * duty that is the difference between ~170 frames of warm-up (2.8 s at 60 Hz) and ~9 frames (0.15 s), before
 * the GL warm-up, which this change does not touch. **Re-measure rather than quoting these: the ratio is a
 * property of the two paths, the absolute figures are a property of the machine.**
 *
 * ⚠️ **It cannot be 0, and 1 is not enough either.** `LissajousGenerator.advancePhase()` moves `pos` and
 * nothing else, so `prevPositions` still holds the `init()` state: the FIRST real update after a jump
 * differences the jumped figure against the un-jumped one, which is a displacement across an ARBITRARY phase
 * gap reported as one frame's motion. Positions are bounded, so the bogus value is bounded too — but the
 * quantity it stands in for is tiny (one frame at `waveSpeed ~ 0.05`), so the ratio is large and
 * direction-scrambled. The second update makes `prevPositions` a genuine one-frame-old copy, so `velocities`,
 * `frameMotion` and every consumer of them (velocity stretch, the force gate, spark ejection) see the same
 * magnitudes a 40-real-frame warm-up would have produced BY THE TIME THE TILE IS ALLOWED TO PAINT — which is
 * the property that matters, since `tick`'s steady pass skips any slot with `mathWarmRemaining > 0`.
 * **Raising this is safe and only costs time; lowering it to 1 puts that scrambled velocity in the first
 * frame the user sees.**
 *
 * ⚠️ **The first update's bogus delta is NOT new and is not a regression** — it is update #1 of the 40 this
 * replaces, which differenced the frame-0 figure against a zeroed `prevPositions` and fed the same kind of
 * value to the same integrators. What changed is only how many CORRECT updates follow it before the tile is
 * displayed: 39 then, 1 now. That is the honest cost of the ~13x saving, and it is why the number is 2 rather
 * than the 1 the velocity delta strictly requires.
 *
 * ⚠️ **The budgeted `advanceMathWarmup()` machinery is deliberately KEPT** rather than deleted along with the
 * frames it used to spend: it is the only thing that stops N tiles acquired in one burst from taking their
 * settle updates in a single frame, and it still owns the per-slot chunk calibration. With 2 frames per tile
 * it now drains almost immediately — that is the improvement, not a reason to remove the valve.
 */
const MATH_WARM_SETTLE_FRAMES = 2;

// Per-tick time slices (ms). Warm-up is work the user is waiting on, so it
// gets a budget rather than a fixed render count: fast machines fill the grid
// quickly, slow ones degrade instead of both crawling at a fixed rate.
//
// The math slice is spent EVERY frame (it touches no GL), so it is kept small:
// 4ms of a 16.7ms frame, but at 60/s that is 4x the throughput of the old 8ms
// spent only on every 4th frame. The GL slices below are spent once per
// tile STEP (~67ms) since they issue draw calls.
//
/**
 * ⚠️ **THE THREE FIGURES ARE AUTHORED AT 60 Hz AND SPENT AS A DUTY CYCLE (2026-09-24).** They are kept
 * exactly as written, but nothing reads them directly any more: each is divided by the interval it was
 * authored over to give a FRACTION OF EVERY FRAME, and `frameSliceMs()` turns that back into milliseconds
 * against the frame actually being rendered.
 *
 * ## Why an absolute per-step slice was the *hitch*, not merely the cost
 *
 * `STEADY_BUDGET_MS` is 60 % of a 60 Hz frame, which is a throttle. On a 119.5 Hz panel the frame is 8.36 ms,
 * so the same 10 ms is **120 % of it** — the budget could no longer be exceeded, because spending it in full
 * had already dropped a frame. Measured on `Cylinder`: p50 8.4 ms with **p95 25.1 ms and 24.7 % of frames over
 * 16.7 ms**, i.e. a v-synced stream of good frames with a three-frame hitch punched through it on every tile
 * step. `MATH_WARM_BUDGET_MS` is the worse one because it is spent on EVERY frame rather than every fourth:
 * 4 ms of 8.36 is 48 % of each frame during a grid fill, which is why the grids drag hardest exactly while
 * the user is scrolling.
 *
 * ## Why a duty cycle and not just a smaller slice — this was MEASURED, not reasoned
 *
 * The first attempt kept the per-step lump and scaled it to the frame (10 ms → 5.0 ms at 119.5 Hz). It fixed
 * the hitch — `Cylinder` 79.7 → 104.2 fps, grid cost 7.33 → 1.86 ms/frame, p95 25.1 → 16.7 ms, nothing over
 * 33 ms — **and quietly halved the previews' own frame rate**, because per-tile rate is
 * `budget x steps-per-second ÷ tiles`, so shrinking the budget and the step rate together cut tile throughput
 * to a QUARTER. Sampled at 10 Hz, newly revealed tiles changed on 32 of 51 samples ≈ 6.4 fps against the
 * declared `TARGET_FPS` of 15. ⚠️ **That is the same complaint from the other end** — "the previews are not
 * animating smoothly" — so trading it for the main view's smoothness fixes half a report by causing the
 * other half.
 *
 * Spending the SAME ms per second, spread evenly over the frames of a step instead of dumped into one of
 * them, has neither cost: `STEADY_BUDGET_MS / TILE_STEP_INTERVAL_MS` = 15 % of every frame is 150 ms per
 * second at **any** refresh rate, which is exactly what the 60 Hz design spent, and 15 % of a frame cannot
 * drop one. ⚠️ **Nothing about a tile's appearance depends on WHICH frame of the step it is rendered on** —
 * only on how many main-loop frames its own step spanned, which `stepFrames` still answers — so the spreading
 * is free. Per-tile rate comes back to the gate's ceiling of `TARGET_FPS`, and total cost halves against what
 * shipped.
 */
const MATH_WARM_BUDGET_MS = 4.0;
const GL_WARM_BUDGET_MS = 12.0;

// Steady-state (already-warm) tiles also need a ceiling. Each one costs a
// render plus a synchronous readPixels, so without a budget total frame cost
// grows linearly with slot count — the dominant risk on integrated GPUs where
// a readback is far more expensive than on discrete hardware. Tiles that do not
// fit are skipped this tick and picked up on the next via a rotating cursor, so
// they lose frame rate rather than stopping.
const STEADY_BUDGET_MS = 10.0;

/**
 * The three budgets above, expressed as the fraction of EVERY frame that reproduces their authored
 * throughput — the only form anything reads them in. `frameSliceMs()` turns one back into milliseconds.
 *
 * ⚠️ **The two divisors are different and neither is interchangeable**, because the two budgets were spent
 * at different cadences: the math slice was already per-FRAME (so its divisor is the nominal frame and the
 * conversion is a no-op at 60 Hz), while the GL slices were spent once per tile STEP (so theirs is the step
 * interval, and the conversion divides by four). Dividing the math slice by the step interval would quadruple
 * it; dividing a GL slice by the frame would quadruple the grid's whole cost.
 *
 * Each product is refresh-rate-invariant in ms per second, which is the property that matters:
 * `duty x frameMs x framesPerSecond === duty x 1000`. At 60 Hz: 240, 180 and 150 ms/s — byte-identical to
 * what the absolute figures spent there.
 */
const MATH_WARM_DUTY = MATH_WARM_BUDGET_MS / NOMINAL_FRAME_MS;
const GL_WARM_DUTY = GL_WARM_BUDGET_MS / TILE_STEP_INTERVAL_MS;
const STEADY_DUTY = STEADY_BUDGET_MS / TILE_STEP_INTERVAL_MS;

// A tile costs a render plus a synchronous readback. Measure that per-tile cost
// and cap concurrent slots so the steady pass fits its budget rather than
// growing without bound on slow GPUs. Aim below the full budget for headroom.
//
// ⚠️ **Still the ABSOLUTE 8.0 ms, and that is not an oversight** (2026-09-24). The cap asks "how many tiles
// can one STEP afford", and a step's total spend is unchanged by the duty rewrite —
// `STEADY_DUTY x frameMs x framesPerStep === STEADY_BUDGET_MS` at any refresh rate, which is the whole point
// of spreading it. Making this frame-relative as well would apply the conversion twice and shrink the slot
// cap fourfold on a 120 Hz display, evicting tiles the machine can comfortably afford — and eviction is
// permanent for the life of the tab (see `MAX_SLOTS`).
const STEADY_COST_TARGET_MS = STEADY_BUDGET_MS * 0.8;

// Ceiling on pre-paid trail accumulation. Aims at ~50% of steady-state trail
// brightness (enough to read the shape), not the ~95% the old 120 targeted.
const GL_WARM_FRAMES_MAX = 10;

// Full-pipeline renders before a tile is handed over to live animation. A trail
// preset rendered once is just faint specks, so a few frames of accumulation
// make it recognisable while scanning the grid — but only a few: the trail
// finishes building live, and pre-paying for it is what made tiles arrive one
// after another. Low-decay presets need essentially none.
function warmupFramesFor(decay: number): number {
  if (!(decay > 0) || decay >= 1) return GL_WARM_FRAMES_MAX;
  return Math.max(2, Math.min(GL_WARM_FRAMES_MAX, Math.ceil(Math.log(0.5) / Math.log(decay))));
}

interface FluidSimState {
  prevPositions: Float32Array;   // previous frame's 2D positions (count×2)
  smoothedVel: Float32Array;     // EMA-smoothed velocities (count×2)
  velGrid: Float32Array;         // FLUID_GRID × FLUID_GRID × 2 (RG)
  blurGrid: Float32Array;        // scratch for box blur
  velTexture: WebGLTexture;      // 64×64 RG16F uploaded each frame
  feedbackConfig: FluidFeedbackConfig;
  initialized: boolean;          // false until first frame computes prev positions
}

interface SlotState {
  index: number;
  presetName: string;
  generator: LissajousGenerator;
  canvas: HTMLCanvasElement;
  transMap: TranslationMapProcessor;
  decayFactor: number;
  blurEnabled: boolean;
  renderMode: number; // 0=pixel, 1=blend, 2=star, 3=splat(material), 4=liquid (v8 Step 15.1)
  mathWarmRemaining: number;
  /** Measured updates-per-ms for this slot; 0 until calibrated. See advanceMathWarmup. */
  mathWarmChunk: number;  // pure-math generator updates, no GL
  /**
   * Frames of wave phase this slot's generator has been advanced by since `init()` — **a continuity hint for
   * the next acquire of the same preset, nothing else reads it** (2026-09-25). Written back to `phaseCache` on
   * release so that re-opening the grid resumes each tile where it left off instead of restarting every figure
   * at frame 40.
   *
   * ⚠️ **It is a count of FRAMES, not a copy of `pos`**, and that is the load-bearing choice: `pos` is the
   * generator's private integration clock and `LissajousGenerator` exposes no way to assign it (by design —
   * see `getPos()`), so a cached absolute phase could only be restored by a second writer of that clock.
   * Frames are the one unit both sides already speak, and `advancePhase()` converts them with the
   * generator's own `waveSpeed`, which is where the conversion belongs — a preset whose `waveSpeed` changed
   * between the release and the acquire therefore resumes at the right NUMBER OF FRAMES rather than at a
   * stale phase. **It cannot go stale in a way that matters: the worst a wrong count does is start a figure
   * at a different point of a cycle it is already animating through.**
   */
  phaseFrames: number;
  warmupRemaining: number;    // full-pipeline renders (builds trail history)
  needsBlit: boolean;         // rendered since last blit — skip readback if not
  /**
   * Wall-clock ms since this slot last rendered — **the cadence gate, per slot** (see `tick`). A tile is
   * eligible once this reaches `TILE_STEP_INTERVAL_MS`; the budget then decides whether it gets its turn.
   *
   * ⚠️ **Seeded to `TILE_STEP_INTERVAL_MS`, not 0.** A new slot must be eligible on the frame after its math
   * warm-up drains, or its first visible frame is a whole interval late — and "how long until a scrolled-in
   * tile animates" is the measured complaint this whole change exists for.
   */
  sinceStepMs: number;
  rampTexture: WebGLTexture | null;
  materialConfig: MaterialConfig | null;
  /**
   * Tile particle count ÷ preset particle count, the one term of the additive-splat brightness
   * compensation that IS a snapshot of the preset. **0 means "no compensation"** (alpha material, or no
   * material at all) and yields exactly 1.0. The compensation itself is resolved per draw, because its
   * other term is the measured step — see `splatBrightnessFor()`.
   */
  splatCountRatio: number;
  /**
   * Global particle size multiplier, `overlay.particleSize ?? 1`. A flat overlay scalar with no preset-block
   * twin, so unlike `beforeParticles` there is only one source to read — but it is still resolved at slot
   * construction rather than per frame, for the same reason as every other field here: the slot is the tile's
   * snapshot of the preset.
   */
  particleSize: number;
  /** D16: film-look palette LUT, 256x1 RGBA8. null when the look declares palette 'none'. */
  paletteTexture: WebGLTexture | null;
  /**
   * v8 `26.4` — this preset's palette hue rotation, in TURNS.
   *
   * ⚠️ **PER SLOT, NOT PER RENDERER, AND THAT IS THE WHOLE REASON THE TILES WERE IN SCOPE** (owner,
   * 2026-10-06). A tile draws **its own** preset, not the working one, so the rotation has to travel with
   * the slot the way the palette texture does. A renderer-wide uniform would paint every tile with the
   * working preset's rotation — which is the shape of defect that makes a tile disagree with the main
   * view and sends the next reader looking in the grading chain.
   */
  paletteHueShift: number;
  /** D16: pre-resolved paletteMapping int — 3 and 5 are already degraded. See tilePaletteMapping(). */
  paletteMapping: number;
  fluidSim: FluidSimState | null;
  /**
   * v8 Step 14.6 — run the warp BEFORE the particle draw. Resolved `overlay.transMapBeforeParticles ??
   * postProcessors.transMap.beforeParticles`, in that order, exactly as `main.ts` does (`fieldcheck` §I).
   *
   * ⚠️ The tile shows this FAITHFULLY and it costs nothing: it is a permutation of the three passes the tile
   * already runs over its own ping-pong pair, with no extra allocation and no extra draw. Reading only the
   * preset half would be the reported `transMapEnabled` defect again — a Lab session writes the overlay and
   * never writes back, so an exported warp-first preset would preview warp-last.
   */
  beforeParticles: boolean;
  /**
   * v8 Step 15.1 — the liquid config, `null` unless `renderMode === 4`.
   *
   * ⚠️ **NONE of the three takes `SCREEN_SPACE_TILE_SCALE` — and `kernelWidth` is the one that looks like it
   * should, which is why the decision is recorded here and measured by `fieldcheck` §O.** Decide by UNIT:
   * Kernel Width is a DIMENSIONLESS MULTIPLIER on a base sprite size that `scaleFactor = (w+h)/(1024+768)`
   * has already reduced — the same category as `particleSize`, which this file's point-size shader documents
   * as unscaled for exactly that reason. It is NOT `splatRadius`, which arrives from a material config in
   * absolute pixels and therefore does take the factor.
   *
   * ⚠️ At a 256x192 tile `scaleFactor` and `SCREEN_SPACE_TILE_SCALE` are THE SAME NUMBER (0.25), so applying
   * both is a silent squaring, and the failure is not a proportional one: the shipped floor is
   * `max(1.0, ...)`, so the sprite PINS AT 1 px for every Kernel Width from 0.5 to 2.0. Measured tile/main
   * coverage ratio over kw 0.5/1/2/4: **0.75 / 0.97 / 1.00 / 1.00 unscaled, against 0.75 / 0.40 / 0.22 / 0.31
   * doubly scaled** — i.e. the control would be inert over two thirds of its travel while the tile still drew
   * something plausible (invariant 13, hidden behind a clamp rather than behind a zero).
   *
   * Iso Level is a RATIO against the field's own frame mean, and the mean is recomputed from the tile's own
   * count and area — so it self-corrects and needs no factor at all. `edgeSoftness` is likewise a fraction of
   * the threshold.
   */
  liquid: TileLiquidState | null;
}

/**
 * A liquid slot's pre-resolved state. Everything here is fixed at slot construction, like the rest of
 * `SlotState`: the slot is the tile's snapshot of the preset.
 */
interface TileLiquidState {
  /** A dimensionless multiplier, deliberately NOT tile-scaled — see `SlotState.liquid` for the measurement. */
  kernelWidth: number;
  /** A ratio; deliberately unscaled. */
  isoLevel: number;
  edgeSoftness: number;
  /**
   * The slot's own temporally smoothed density reference (v8 15.1b), in the field's units. **MUTABLE — the
   * one field of this interface that is not a construction-time snapshot**, and it has to be per slot: the
   * grid renders up to 128 figures through ONE shared R32F texture, so a single shared history would mix
   * every liquid preset's density together and each tile would then chase the others.
   *
   * 0 means "no history", so the first rendered tile-frame SNAPS. A tile that eased up from 0 would spend its
   * first quarter-second with a near-zero threshold, i.e. flooded solid, which is the worst possible first
   * impression of a preset in a grid.
   */
  refSmoothed: number;
  /** 0 = preset (uTint), 1 = palette, 2/3 = ramp. Pre-resolved exactly as the main renderer resolves it. */
  tintSource: number;
  /**
   * v8 Step 15.2. Weight of the per-particle accumulated colour against whatever `tintSource` resolved,
   * 0..1. 0 is an exact algebraic identity with 15.1 (`mix(tint, mixed, 0.0)`), which is what makes the
   * whole step neutral at that value regardless of what the colour target holds.
   */
  colourMix: number;
  /**
   * 0 = 'light' (the weighted mean), 1 = 'pigment' (Beer-Lambert deepening). Pre-resolved to an INT here
   * exactly as `tintSource` is — the render path uploads it with `uniform1i` and must not carry a string
   * comparison per frame.
   */
  mixModel: number;
  /**
   * v8 Step 15.3. The surface material's four controls, carried verbatim: they are plain magnitudes with no
   * unit to convert and no tile factor to apply (`refraction` and `thickness` scale a ratio, `specular` and
   * `edgeBrightness` scale a normal-derived term), so **the tile's job here is to NOT transform them** — the
   * one dimensional quantity in the whole term set is the dispersion offset, and that rides `radius`, which
   * the tile derives through its own `scaleFactor`.
   */
  refraction: number;
  specular: number;
  thickness: number;
  edgeBrightness: number;
  /**
   * 256x1 RGBA8 LUT of the RESOLVED ramp name — its own texture, never `slot.rampTexture`.
   *
   * A liquid slot with `tintSource: 'material'` and a live material resolves to the material's ramp, which
   * IS `slot.rampTexture`'s content; but with `'ramp'` it resolves to `surfaceRamp`, which no other texture
   * on the slot holds. Sharing would make the liquid's colour change when a material was selected, which is
   * the same reasoning the main renderer's separate `liquidRampTex` carries.
   */
  rampTexture: WebGLTexture | null;
}

/**
 * Brightness compensation for the ADDITIVE splat path (D15, 2026-08-12).
 *
 * A tile lost light two ways that nothing compensated, so material presets rendered ~13x darker than
 * the main view — `Julia Burn Rivers` measured a mean frame luminance of 10/255 against 159/255 and was
 * reported as "almost black, you only notice something is moving".
 *
 *  1. `PARTICLE_DIVISOR` cuts the count to 1/4. In the splat path the sprite radius is ALSO scaled by
 *     `SCREEN_SPACE_TILE_SCALE`, so the sprite-area ratio is S^2 = 0.0625 — exactly the tile/main frame
 *     area ratio. The two cancel, leaving the per-frame luminance ratio equal to the COUNT ratio, 0.25,
 *     with nothing recovering it.
 *  2. A tile renders one frame per `FRAME_SKIP` and fades by `decay^FRAME_SKIP`, so steady-state trail
 *     gain is `1/(1 - d^SKIP)` where the main view gets `1/(1 - d)` — 1.99x against 6.25x at d = 0.84.
 *
 * Hence `B = (1 - d^SKIP) / ((1 - d) * countRatio)`, which restores steady-state parity exactly.
 *
 * ⚠️ THREE constraints, each of which makes a wider fix wrong:
 *
 * - **ADDITIVE ONLY.** The derivation assumes light SUMS. `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` converges to
 *   a weighted average bounded at 1.0 instead, so a 13x lift there does not brighten the trail — it
 *   drives `a` to 1.0 and makes every particle fully opaque, which is the old `Miracle Frost` solid-white
 *   failure. The main renderer's own M1 overlap compensation is gated on `uIsAdditive` for the same
 *   reason. Alpha materials (Ice, Fog, Smoke, Organic) therefore get exactly 1.0.
 * - **The NON-splat path is deliberately untouched.** Modes 0/1/2 keep a FIXED `gl_PointSize` (3.0/5.0)
 *   in both renderers, so their sprite-area ratio is 1.0 and does NOT cancel the 16x frame-area ratio;
 *   measured against the same metric they are ~5x too BRIGHT, not too dark, even before
 *   `uBrightness = FRAME_SKIP`. That has been the accepted appearance of 167 of the 177 legacy presets
 *   (star mode) for the life of the grid, and "correcting" it would restyle the entire library on the
 *   strength of one metric. Out of scope.
 * - **CAPPED at FRAME_SKIP * PARTICLE_DIVISOR.** Above that, `countRatio` has dropped below 1/4 because
 *   `MAX_TILE_PARTICLES` truncated the count (a 20 000-particle preset keeps only 1/10), so the figure is
 *   genuinely SPARSER — and brightness cannot recover lost structure. Exact compensation there is 34.4x,
 *   which trades a faithfully dim curve for bright scattered dots. The cap accepts the dimmer, honest one.
 *
 * Measured mean 8-bit output, tile vs main: `Julia Burn Rivers` 10 -> 100 (main 159), `Ember Storm`
 * 12 -> 94 (main 179), `Hopf Fire Ring` 22 -> 163 (main 220). The residual gap is bloom and film-look
 * exposure, which tiles omit by decision C7 and this does not attempt to replace.
 */
function maxSplatBrightness(stepFrames: number): number {
  return stepFrames * PARTICLE_DIVISOR;
}

/**
 * ⚠️ **Resolved PER DRAW from a stored count ratio, not once at `acquireSlot` (2026-09-24).**
 *
 * Both terms of the derivation above contain the step: `d^SKIP` is the trail gain and the cap is this
 * expression's own `d -> 1` limit at an untruncated count (`4 * (1 - d^N)/(1 - d) -> 4N`). Once the step
 * became the MEASURED one, a figure frozen at acquire time was a figure computed for a display the user
 * might not have: on a 120 Hz panel the step spans 8 frames, and holding the 4-frame compensation would
 * leave every additive material tile a factor `1 + d^4` — **1.66x at d = 0.9** — too dim. That is a
 * fraction of the 13x D15 measured, but it is the same defect returning, and it would have read as "the
 * material previews look a bit dark on this machine", which nothing in the grid can attribute.
 *
 * Cost is one `Math.pow` per splat draw, against a draw that already uploads a ramp and a palette.
 *
 * @param countRatio tile count ÷ preset count, or 0 for the alpha-material case (brightness 1.0). Stored on
 *   the slot because the two counts are a snapshot of the preset and the step is not.
 */
function splatBrightnessFor(decay: number, countRatio: number, stepFrames: number): number {
  if (!(countRatio > 0)) return 1.0;
  // decay 0 is legitimate (MotionBlur 0): both gains are 1, so this reduces to 1/countRatio.
  const exact = (1 - Math.pow(decay, stepFrames)) / ((1 - decay) * countRatio);
  if (!Number.isFinite(exact) || exact <= 1) return 1.0;
  return Math.min(maxSplatBrightness(stepFrames), exact);
}

/**
 * The step's worth of light for the NON-splat paths — the `uBrightness` uniform, so modes 0/1/2. (The liquid
 * SURFACE pass takes no brightness at all: it occludes, so its output is bounded at 1.0 by construction and a
 * lift would only clip the tint. See the note above its shader.)
 *
 * ⚠️ **ANCHORED AT `FRAME_SKIP`, NOT AT ONE FRAME, AND THAT IS THE WHOLE POINT (2026-09-24).** It was the bare
 * `FRAME_SKIP`, and retying it to the measured step would have been a silent restyling of the library on a
 * high-refresh display. A tile's steady-state accumulation is `B / (1 - d^N)`, which is independent of
 * CADENCE but not of `N` — so with `B = N` the shipped look survives a change of refresh rate only while `N`
 * is fixed. At `N = 8` the bare form gives **1.21x the shipped trail brightness at d = 0.9 and 1.88x at
 * d = 0.5**, and the low figure is the dangerous one: a low-decay preset barely accumulates, so the deposit
 * IS the frame, and doubling it doubles the tile's brightness outright. `Cylinder`, `Quader` and `Pipes` are
 * exactly that shape, which is why they are the presets CLAUDE.md names for judging a grading change.
 *
 * **Measured over the library by importing the six preset groups (240 deduped keys, every one of which carries
 * a `decayFactor`): the bare form changes ALL 240** — 77 by ≥ 1.5x, 75 by 1.2–1.5x, 88 by 1.05–1.2x, and none
 * by less. The extremes are `Cylinder` and `Galaxy` at `decayFactor` 0, where the ratio is exactly 2.00x (no
 * trail at all, so the deposit IS the frame), and the 0.96-clamped presets — `Miracle Frost`,
 * `Who Needs A Fractal` — at 1.08x.
 *
 * ⚠️ **In 8-BIT OUTPUT that HDR ratio mostly does not survive the tone map, and the A/B says so**: swapping
 * this function for the bare multiplier moved the tile's mean luminance by +3 % on `Cylinder`, −5 % on `Quader`
 * and +12 % on `Pipes`, against a run-to-run spread of ~5 %. Reinhard is already saturating these sprites
 * (tile peak 255 on all three), so doubling the light behind a clipped pixel changes nothing. **That is a
 * reason to prefer the exact form, not a reason to shrug**: the compression is a property of THESE presets'
 * peaks, the correction costs one `Math.pow`, and a measurement that cannot resolve an error is not evidence
 * the error is absent — see the tile/main ratios it CAN resolve, 1.56x / 2.09x / 2.30x.
 *
 * Solving `B / (1 - d^N) = FRAME_SKIP / (1 - d^FRAME_SKIP)` gives the form below — the shipped steady state,
 * held invariant under any step. ⚠️ **Identity at `N = FRAME_SKIP` by construction**, so a 60 Hz machine is
 * byte-identical to what shipped, and the `d -> 1` limit is `N` — the bare form is recovered exactly where it
 * was right, which is how you can tell this generalises the old figure rather than replacing it.
 *
 * ⚠️ **Parity with the MAIN VIEW is deliberately NOT the target here**, and that distinction is the reason
 * this is a separate function from `splatBrightnessFor` rather than a shared one. The exact main-view parity
 * `B = (1 - d^N)/(1 - d)` is available and is what the splat path uses — but on these paths `gl_PointSize` is
 * FIXED in both renderers, so the sprite-area ratio does not cancel the 16x frame-area ratio and the tiles
 * are already ~5x brighter than the main view BY DECISION (see `maxSplatBrightness`: "the accepted appearance
 * of 167 of the 177 legacy presets"). Anchoring at main-view parity would therefore dim every one of them by
 * ~5x — a library-wide restyling wearing the clothes of a bug fix. **Hold the accepted look; do not re-derive
 * it.**
 */
function trailBrightnessFor(decay: number, stepFrames: number): number {
  if (stepFrames === FRAME_SKIP) return FRAME_SKIP;
  const ref = 1 - Math.pow(decay, FRAME_SKIP);
  // decay 0 makes both gains 1 and the ratio 1, so this returns FRAME_SKIP — the shipped figure. The guard is
  // for decay EXACTLY 1, which `MAX_TILE_DECAY` already prevents but which would otherwise divide by zero and
  // upload a NaN uniform: a NaN brightness is a black tile with nothing in the console to say why.
  if (!(ref > 0)) return stepFrames;
  const b = FRAME_SKIP * ((1 - Math.pow(decay, stepFrames)) / ref);
  return Number.isFinite(b) ? b : stepFrames;
}

/**
 * Resolve a preset's film-look palette for the tile (D16, 2026-08-12).
 *
 * Tiles used to ignore film looks entirely, so a material preset was drawn in its material RAMP while
 * the main view drew it in the look's PALETTE — reported as "the colors are wrong". Two axes diverged,
 * not one: the colour SOURCE and the palette INDEX. `Julia Burn Rivers` cycles red-magenta-violet-orange
 * -blue in the main view (`Neon` palette, `phase` mapping) and violet-violet-cyan-green in the tile
 * (`liquid` ramp, temperature-indexed), so forwarding the LUT alone would have fixed only half of it.
 *
 * `lut` is null when there is no palette to apply, which is the common case:
 *  - no `overlay` block at all ⇒ film look defaults to `Legacy`, whose palette is 'none';
 *  - `Legacy` and `Cinematic` are the only two named bundles with palette 'none', and they are the only
 *    two that PRESERVE a preset's own oscillating colorBase/colorAmp/colorFreq.
 * So all 177 legacy presets are unaffected by construction — the same property the main renderer relies
 * on. Grading (exposure, saturation, bloom, vignette, DoF) is still omitted per C7; this changes hue
 * only, which is what was asked for.
 *
 * ## v8 Step 21.4c/21.4e — the THIRD reader, and why it now goes through `resolvePaletteSelection`
 *
 * ⚠️ **This function used to be a second `??` chain over the film look alone, and `21.4c` gave the palette a
 * SECOND source (`overlay.palette` / `overlay.paletteMapping`).** Invariant 17 is the rule — *two sources ⇒
 * every reader resolves them in the same order* — and `palette-selection.ts`'s header states the consequence
 * plainly: *there is no second `??` chain anywhere*. Left as it was, an overlay palette would have been
 * invisible here, and the tile would have drawn the film look's palette while the main view drew the
 * overlay's. That is **the very defect D16 was written to fix**, reopened from the other end and with the
 * same symptom — "the colors are wrong" — so it would have read as a regression in D16 rather than as a
 * missing read in 21.4c.
 *
 * ⚠️ **The `index` mapping is CPU-side, so it returns NO LUT and an `indexPalette` instead.** Both halves
 * matter and neither is optional:
 *
 *  - no LUT, because the tile shader's `paletteCoord()` ends in `return temp;` rather than in a velocity
 *    fallback — so an unmatched mapping int here selects the TEMPERATURE coordinate, and on a tile with no
 *    material `temperatures[]` is absent, which is one flat colour across the whole figure. The guard is
 *    `resolvePaletteSelection`'s `shaderPalette === 'none'`, read rather than re-derived.
 *  - an `indexPalette`, because the tile runs a REAL `LissajousGenerator` (unlike its trail, its crystals and
 *    its splat radius, which are the genuine C7 trades). Handing it the same `a`/`b` the main view gets costs
 *    one call and no GL state, and withholding it would make the tile draw the preset's own quadruple while
 *    the main view drew the palette's — a colour SOURCE divergence, which C7 does not cover.
 */
function tilePaletteFor(preset: UnifiedPreset): {
  lut: Uint8Array | null;
  mapping: number;
  indexPalette: IndexPaletteSource | null;
} {
  const lookName = preset.overlay?.filmLook ?? 'Legacy';
  // A partial: `customFilmLookParams` is Partial<FilmLookParams>, and an unknown bundle name yields
  // undefined rather than throwing — an imported preset can legitimately name a look this build lacks.
  const look: Partial<Pick<FilmLookParams, 'palette' | 'paletteMapping'>> | undefined =
    lookName === CUSTOMIZE_FILM_LOOK
      ? preset.overlay?.customFilmLookParams
      : FILM_LOOKS[lookName as keyof typeof FILM_LOOKS];
  // The resolver wants a COMPLETE film-look pair or `undefined`; a partial `customFilmLookParams` may carry
  // neither field. Defaulted here rather than inside the resolver, because `'none'`/`'depth'` are this
  // reader's fallbacks for an ABSENT look, not the resolver's rule for an absent field.
  const sel = resolvePaletteSelection(
    { palette: preset.overlay?.palette, paletteMapping: preset.overlay?.paletteMapping },
    look ? { palette: look.palette ?? 'none', paletteMapping: look.paletteMapping ?? 'depth' } : undefined,
  );
  if (sel.indexPalette !== null || sel.mapping === 'index') {
    // `index` with no resolvable palette is the majority case and is not a gap: the generator's own
    // `colorBase`/`colorAmp` ARE the colour, and they were already forwarded at `init()`.
    return { lut: null, mapping: 0, indexPalette: sel.indexPalette };
  }
  if (sel.shaderPalette === 'none' || sel.shaderPalette === PALETTE_UNSET) {
    return { lut: null, mapping: 0, indexPalette: null };
  }
  const lut = getPaletteLUT(sel.shaderPalette);
  if (!lut) return { lut: null, mapping: 0, indexPalette: null };

  // Degrade the two mappings the tile cannot serve, CPU-side so the shader never branches on them:
  //  - `temperature` (3) needs temperatures[], which only exists while a material is running; without
  //    one every particle would sample LUT index 0 and the figure would take a single flat colour. The
  //    main renderer degrades it to `velocity` for exactly this reason, and the guard has to live in
  //    both places because a preset can declare mapping 3 with no material.
  //  - `age` (5) needs state.lifetimes, the ONE GeneratorState array not extended to `count`. Uploading
  //    it raw under-sizes the buffer and ANGLE then DROPS THE WHOLE DRAW with no JS exception — a black
  //    tile. Degraded to temperature, which is the nearest quantity the tile does carry.
  let mapping = sel.shaderMappingInt;
  const hasMaterial = !!(preset.overlay?.material?.preset && preset.overlay.material.preset !== 'None');
  if (mapping === 5) mapping = 3;
  if (mapping === 3 && !hasMaterial) mapping = 2;
  return { lut, mapping, indexPalette: null };
}

export class GridTileRenderer {
  private gl: WebGL2RenderingContext;

  // Particle shader
  private particleProgram: WebGLProgram | null = null;
  private particleVao: WebGLVertexArrayObject | null = null;
  private posBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private tempBuffer: WebGLBuffer | null = null;
  private depthBuffer: WebGLBuffer | null = null;
  private velBuffer: WebGLBuffer | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uGlow: WebGLUniformLocation | null = null;
  private uRenderMode: WebGLUniformLocation | null = null;
  private uBrightness: WebGLUniformLocation | null = null;
  private uSplatRadius: WebGLUniformLocation | null = null;
  private uParticleSize: WebGLUniformLocation | null = null;
  private uCoreBrightness: WebGLUniformLocation | null = null;
  private uHaloStrength: WebGLUniformLocation | null = null;
  private uFalloffExponent: WebGLUniformLocation | null = null;
  private uEmissionIntensity: WebGLUniformLocation | null = null;
  private uIsAdditive: WebGLUniformLocation | null = null;
  private uRampTex: WebGLUniformLocation | null = null;
  private uPaletteTex: WebGLUniformLocation | null = null;
  private uPaletteEnabled: WebGLUniformLocation | null = null;
  private uPaletteHueShift: WebGLUniformLocation | null = null;
  private uPaletteMapping: WebGLUniformLocation | null = null;

  // Decay shader (full-screen black quad with alpha)
  private fadeProgram: WebGLProgram | null = null;
  private fadeVao: WebGLVertexArrayObject | null = null;
  private uFadeAlpha: WebGLUniformLocation | null = null;

  // Blit shader (copy one FBO to another)
  private blitProgram: WebGLProgram | null = null;
  private blitVao: WebGLVertexArrayObject | null = null;

  // Blur blit shader (3x3 gaussian)
  private blurBlitProgram: WebGLProgram | null = null;
  private blurBlitVao: WebGLVertexArrayObject | null = null;

  // The blit/blur/tonemap uniform locations, resolved in `init()` (triage H6). All fourteen of the
  // PARTICLE program's uniforms were already cached there and these five were not — and they are the
  // ones that multiply hardest, since every site below is per TILE rather than per frame: up to 32
  // slots blit-and-tonemap in one `tick()`, so `uTonemapTex` alone was queried 32 times a frame.
  private uBlitTex: WebGLUniformLocation | null = null;
  private uBlurBlitTex: WebGLUniformLocation | null = null;
  private uBlurBlitTexelSize: WebGLUniformLocation | null = null;
  private uTonemapTex: WebGLUniformLocation | null = null;

  // Per-tile TransMap: each slot's TransMap applies within its viewport region
  // Since TranslationMapProcessor binds its own FBO target, we use per-slot mini FBOs
  private slotFboA: (WebGLFramebuffer | null)[] = [];
  private slotFboB: (WebGLFramebuffer | null)[] = [];
  private slotTexA: (WebGLTexture | null)[] = [];
  private slotTexB: (WebGLTexture | null)[] = [];

  // Readback FBO (RGBA8) — blit from RGBA16F to this before readPixels
  private readbackFbo: WebGLFramebuffer | null = null;
  private readbackTex: WebGLTexture | null = null;

  /**
   * 1x1 white stand-in, bound to any sampler unit a slot has no real texture for. Its purpose is to
   * keep the unit COMPLETE: an incomplete unit samples black, and in a multi-sampler program some
   * drivers resolve the entire draw to black rather than only the unused sampler. See renderParticles.
   */
  private fallbackTex: WebGLTexture | null = null;

  // Tonemap blit shader (HDR → LDR with Reinhard)
  private tonemapProgram: WebGLProgram | null = null;
  private tonemapVao: WebGLVertexArrayObject | null = null;

  /**
   * v8 Step 15.1 (E84) — the tile's iso-surface `liquid` path.
   *
   * ⚠️ **ONE shared 256x192 R32F scratch for the WHOLE GRID, not one per slot, and that is a fact about
   * the tick loop rather than an optimisation.** `renderSteadyTiles` walks slots SEQUENTIALLY in a single
   * loop, and the field is consumed by the surface pass within the same `renderSlotFullPipeline` call that
   * cleared and filled it — nothing survives to the next slot. So the cost is 256*192*4 = 192 KB total,
   * against 24.6 MB if it were per-slot at `MAX_SLOTS`. It is cleared at the top of each liquid slot's
   * field pass for exactly that reason: a stale field from the PREVIOUS SLOT would otherwise leak in, which
   * would read as one tile showing a ghost of another.
   *
   * ⚠️ **Allocated LAZILY on the first liquid slot** (`ensureLiquid()`), like `ensureSlot`, because the mode
   * is new and most libraries have no liquid preset at all — an eager allocation would bill every grid for
   * a feature no tile in it uses. On a context that refuses R32F, `liquidUnavailable` latches and every
   * liquid slot falls back to mode 2 (`star`) with ONE warning, never per tile per frame.
   */
  private liquidFbo: WebGLFramebuffer | null = null;
  private liquidTex: WebGLTexture | null = null;
  /**
   * v8 Step 15.2 — the tile's colour accumulation target, `RGB = Σ(colour·w)` / `A = Σw`, attached beside
   * `liquidTex` and written by the same draw. ⚠️ **SHARED across slots exactly as `liquidTex` is**, because
   * slots render SEQUENTIALLY in one loop and each clears the field at the top of its own pass — one 256×192
   * RGBA16F is 393 kB, against 50 MB if it were per-slot at `MAX_SLOTS`.
   */
  private liquidColorTex: WebGLTexture | null = null;
  private liquidAccProgram: WebGLProgram | null = null;
  private liquidAccVao: WebGLVertexArrayObject | null = null;
  private liquidAccPosBuffer: WebGLBuffer | null = null;
  /** v8 Step 15.2 — per-particle colours for the accumulation pass, at `layout(location = 1)`. */
  private liquidAccColorBuffer: WebGLBuffer | null = null;
  private liquidSurfProgram: WebGLProgram | null = null;
  private liquidSurfVao: WebGLVertexArrayObject | null = null;
  private uLiqAccResolution: WebGLUniformLocation | null = null;
  private uLiqAccSize: WebGLUniformLocation | null = null;
  private uLiqSurfDensity: WebGLUniformLocation | null = null;
  private uLiqSurfRamp: WebGLUniformLocation | null = null;
  private uLiqSurfPalette: WebGLUniformLocation | null = null;
  private uLiqSurfIsoRef: WebGLUniformLocation | null = null;
  private uLiqSurfThickRef: WebGLUniformLocation | null = null;
  private uLiqSurfSoftness: WebGLUniformLocation | null = null;
  private uLiqSurfTintSource: WebGLUniformLocation | null = null;
  private uLiqSurfPaletteEnabled: WebGLUniformLocation | null = null;
  private uLiqSurfResolution: WebGLUniformLocation | null = null;
  private uLiqSurfTint: WebGLUniformLocation | null = null;
  /** v8 Step 15.2 — the colour field sampler, the mix weight and the categorical mix model. */
  private uLiqSurfColor: WebGLUniformLocation | null = null;
  private uLiqSurfColourMix: WebGLUniformLocation | null = null;
  private uLiqSurfMixModel: WebGLUniformLocation | null = null;
  /** v8 Step 15.3 — the surface material's four controls plus the tile's own clamped sprite radius. */
  private uLiqSurfRefraction: WebGLUniformLocation | null = null;
  private uLiqSurfSpecular: WebGLUniformLocation | null = null;
  private uLiqSurfThickness: WebGLUniformLocation | null = null;
  private uLiqSurfEdgeBright: WebGLUniformLocation | null = null;
  private uLiqSurfRadius: WebGLUniformLocation | null = null;
  /** Latched refusal. Set once by `ensureLiquid()`; every liquid slot then renders as mode 2. */
  private liquidUnavailable = false;
  /**
   * The step the current tick advanced its generators by, in SECONDS — `tick`'s `effectiveDt * 0.001`.
   *
   * ⚠️ **A field rather than a parameter because `renderSlotFullPipeline` is called from THREE places** (the
   * steady pass and the warm-up loop's two levels) and only `tick` knows the step; threading it through would
   * be four signatures for one number. Its only consumer is the liquid reference's EMA (v8 15.1b).
   *
   * Initialised to the nominal `FRAME_SKIP` frames at 60 Hz rather than to 0, for the reason
   * `Renderer.render`'s own default documents: a 0 here would silently disable the smoothing, which reads as
   * the EMA doing nothing rather than as a missing value.
   */
  private lastEffectiveDtSeconds = (1 / 60) * FRAME_SKIP;

  /**
   * Main-loop frames one tile step spans, clamped to `[1, MAX_STEP_FRAMES]` — 4 at 60 Hz, 8 at 120 Hz.
   * Every compensation in this file reads THIS and not `FRAME_SKIP`; it is a field rather than a parameter
   * for the same reason `lastEffectiveDtSeconds` is — `renderSlotFullPipeline` has three callers and only
   * `tick` knows the step.
   *
   * ⚠️ **Derived from the frame interval, NOT from how long the tile actually waited** (2026-09-24). The two
   * differ whenever the budget starves a tile past its turn, and taking the real wait would make a starved
   * tile fade by `decay^24` — a trail cut to 8 % with 2.2× the steady brightness, i.e. bright dots with no
   * tail. The shipped behaviour for a starved tile is that it runs in SLOW MOTION with a correct trail
   * (its generator and its decay both advance only when it renders), and a nominal step is what preserves
   * that. The cadence gate alone caps a tile at `TARGET_FPS`; nothing needs to know it missed a turn.
   */
  private stepFrames = FRAME_SKIP;
  /**
   * EMA of the main loop's frame interval in ms, the basis every budget is rescaled against. Seeded at the
   * 60 Hz nominal so the first frames budget exactly as they did before this file measured anything.
   */
  private frameMsEma = NOMINAL_FRAME_MS;
  /** `PerfGuard`'s steady-cadence divisor for this tick. 1 unless level 1. See `tick`. */
  private throttle = 1;
  /**
   * Saturating wall-clock accumulator gating `blitToCanvases()`, and whether any slot has something to blit.
   *
   * ⚠️ **THE READBACK IS THE ONE THING THAT MUST NOT BE SPREAD ACROSS FRAMES, and this was MEASURED
   * (2026-09-24).** Rendering tiles a couple at a time on every frame — see `tick` — moved the grid's CPU cost
   * in the RIGHT direction for the cheap presets and the WRONG direction for the expensive ones: `Chemical`
   * 4.93 → 12.5 ms per frame, `Boiling Milk` 4.37 → 8.82, while tile smoothness came back to 50/50 distinct
   * sampled frames. The mechanism is that each blitted tile ends in a synchronous `readPixels`, so the FIRST
   * one of a frame waits for the main view's own queued GPU work to drain. That latency is per SYNC POINT and
   * does not divide: spreading the renders converted ~15 stalls a second into one on every frame, and the
   * heavier the main view's GPU queue the more each one costs — which is exactly backwards.
   *
   * So the renders spread and the readbacks batch. Each slot renders at most once per
   * `TILE_STEP_INTERVAL_MS` (its own `sinceStepMs` gate), so ONE blit per interval still catches every render
   * — no frame is discarded, and a tile's displayed rate is unchanged.
   *
   * ⚠️ **Saturating, and reset only by an actual blit.** Left to grow it would mean nothing; clamped but reset
   * on a bare timer it would fire a blit pass with nothing to read. Held at the interval it means "a render may
   * be shown as soon as there is one", which is what keeps a scrolled-in tile's FIRST frame prompt — measured
   * at 116–120 ms to first pixels, the number the whole change exists to protect.
   */
  private blitAccumMs = TILE_STEP_INTERVAL_MS;
  private blitPending = false;

  private freePool: number[] = [];
  private activeSlots: Map<string, SlotState> = new Map();

  // Readback scratch, both reused by every tile in `blitToCanvases` — see the note there. Every tile is
  // TILE_W x TILE_H, so one of each serves all of them.
  private pixelBuffer: Uint8Array;
  private tileImageData: ImageData | null = null;

  private frameCount = 0;
  private active = true;
  private steadyCursor = 0;
  private steadyRenderMs = 0;
  private steadyRendered = 0;
  private tileCostMs = 0;          // EMA of render+readback cost per tile
  private slotCap = MAX_SLOTS;     // adaptive ceiling on concurrent slots
  private peakConcurrentDemand = 0; // most tiles wanted at once (decays slowly)
  /**
   * `presetName -> frames of wave phase reached`, kept across releases so a Grid/Lab toggle or a scroll back
   * resumes each figure instead of re-warming it from frame 40 (2026-09-25). Insertion-ordered, so the first
   * key is the least recently written — see `rememberPhase()`.
   *
   * ⚠️ **A NUMBER PER NAME IS THE WHOLE ENTRY, AND CACHING THE GENERATOR INSTEAD WOULD BE A DEFECT.** A
   * retained `LissajousGenerator` carries the entire configured body of the preset it was built from, so every
   * path that can change what a name MEANS — the replace branch of `prependPreset`, `renameTile`, an import
   * that shadows a built-in, a Snapshot restore — would have to remember to invalidate it, and forgetting one
   * shows up as a tile animating the previous artwork under the new name. **A name is a primary key in five
   * owners**, and a cache keyed on it that holds configuration is a silent-failure surface; one holding only
   * "how far through its own cycle this was" cannot lie about anything the user can see. The cost of the
   * narrower form is stated where it is paid: the per-acquire generator ALLOCATION is not saved, only the
   * warm-up work.
   */
  private phaseCache: Map<string, number> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.pixelBuffer = new Uint8Array(TILE_W * TILE_H * 4);
  }

  init(): void {
    const gl = this.gl;

    // Slot INDICES are handed out eagerly; the GL objects behind them are built on first use by
    // `ensureSlot()`. See `MAX_SLOTS` for why: with three instances of this class and only one of them
    // able to want more than ten slots, eager allocation billed every window for the widest one.
    this.freePool = [];
    for (let i = MAX_SLOTS - 1; i >= 0; i--) {
      this.freePool.push(i);
    }

    // Readback FBO (RGBA8) for readPixels from float FBOs
    this.readbackTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.readbackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TILE_W, TILE_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.readbackFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.readbackFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.readbackTex, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.fallbackTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.fallbackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);

    // Particle shader
    this.particleProgram = this.compileParticleProgram(gl);
    this.uResolution = gl.getUniformLocation(this.particleProgram, 'uResolution');
    this.uGlow = gl.getUniformLocation(this.particleProgram, 'uGlow');
    this.uRenderMode = gl.getUniformLocation(this.particleProgram, 'uRenderMode');
    this.uBrightness = gl.getUniformLocation(this.particleProgram, 'uBrightness');
    this.uSplatRadius = gl.getUniformLocation(this.particleProgram, 'uSplatRadius');
    this.uParticleSize = gl.getUniformLocation(this.particleProgram, 'uParticleSize');
    this.uCoreBrightness = gl.getUniformLocation(this.particleProgram, 'uCoreBrightness');
    this.uHaloStrength = gl.getUniformLocation(this.particleProgram, 'uHaloStrength');
    this.uFalloffExponent = gl.getUniformLocation(this.particleProgram, 'uFalloffExponent');
    this.uEmissionIntensity = gl.getUniformLocation(this.particleProgram, 'uEmissionIntensity');
    this.uIsAdditive = gl.getUniformLocation(this.particleProgram, 'uIsAdditive');
    this.uPaletteTex = gl.getUniformLocation(this.particleProgram, 'uPaletteTex');
    this.uPaletteEnabled = gl.getUniformLocation(this.particleProgram, 'uPaletteEnabled');
    this.uPaletteHueShift = gl.getUniformLocation(this.particleProgram, 'uPaletteHueShift');
    this.uPaletteMapping = gl.getUniformLocation(this.particleProgram, 'uPaletteMapping');
    this.uRampTex = gl.getUniformLocation(this.particleProgram, 'uRampTex');

    this.particleVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.particleVao);
    this.posBuffer = gl.createBuffer()!;
    const aPos = gl.getAttribLocation(this.particleProgram, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this.colorBuffer = gl.createBuffer()!;
    const aCol = gl.getAttribLocation(this.particleProgram, 'aColor');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(aCol);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
    this.tempBuffer = gl.createBuffer()!;
    const aTemp = gl.getAttribLocation(this.particleProgram, 'aTemperature');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tempBuffer);
    gl.enableVertexAttribArray(aTemp);
    gl.vertexAttribPointer(aTemp, 1, gl.FLOAT, false, 0, 0);
    // D16: palette mapping sources. Both are REQUIRED GeneratorState fields, so unlike `lifetimes` they
    // are always present at full `count` length and need no padding. Every enabled attribute in this VAO
    // is read by every draw that binds it, so both are uploaded on EVERY renderParticles() call — not
    // only in splat mode — or a non-splat draw would read a stale, possibly short, buffer.
    this.depthBuffer = gl.createBuffer()!;
    const aDepth = gl.getAttribLocation(this.particleProgram, 'aDepth');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.depthBuffer);
    gl.enableVertexAttribArray(aDepth);
    gl.vertexAttribPointer(aDepth, 1, gl.FLOAT, false, 0, 0);
    this.velBuffer = gl.createBuffer()!;
    const aVel = gl.getAttribLocation(this.particleProgram, 'aVelocity');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuffer);
    gl.enableVertexAttribArray(aVel);
    gl.vertexAttribPointer(aVel, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Fade program
    this.fadeProgram = this.compileFadeProgram(gl);
    this.uFadeAlpha = gl.getUniformLocation(this.fadeProgram, 'uAlpha');
    this.fadeVao = this.createQuadVAO(gl, this.fadeProgram);

    // Blit program
    this.blitProgram = this.compileBlitProgram(gl);
    this.blitVao = this.createQuadVAO(gl, this.blitProgram);
    this.uBlitTex = gl.getUniformLocation(this.blitProgram, 'uTex');

    // Blur blit program
    this.blurBlitProgram = this.compileBlurBlitProgram(gl);
    this.blurBlitVao = this.createQuadVAO(gl, this.blurBlitProgram);
    this.uBlurBlitTex = gl.getUniformLocation(this.blurBlitProgram, 'uTex');
    this.uBlurBlitTexelSize = gl.getUniformLocation(this.blurBlitProgram, 'uTexelSize');

    // Tonemap blit program (HDR → LDR)
    this.tonemapProgram = this.compileTonemapProgram(gl);
    this.tonemapVao = this.createQuadVAO(gl, this.tonemapProgram);
    this.uTonemapTex = gl.getUniformLocation(this.tonemapProgram, 'uTex');
  }

  acquireSlot(presetName: string, preset: UnifiedPreset, canvas: HTMLCanvasElement): void {
    if (this.activeSlots.has(presetName)) return;

    // Track live demand so the cost-based cap can never starve the visible set.
    if (this.activeSlots.size + 1 > this.peakConcurrentDemand) {
      this.peakConcurrentDemand = this.activeSlots.size + 1;
    }

    // Evict when the pool is empty OR the adaptive cap is reached, so this tile
    // always gets a slot. Returning early here is what previously left tiles
    // permanently black, so the cap must throttle — never refuse. Map iteration
    // order is insertion order, so the first entry is least-recently acquired.
    //
    /**
     * ⚠️ **THE FLOOR IS RE-DERIVED HERE, NOT READ OFF `slotCap` (2026-09-25).** `slotCap` is recomputed only
     * from the blit — once per `TILE_STEP_INTERVAL_MS` — while demand ratchets on every acquire, so during a
     * burst (maximising the window, dragging it to a larger display, clearing a filter) the cap is a value
     * derived from a demand that no longer exists. On a 56-tile grid that window is where 40-odd tiles were
     * evicted at `MIN_SLOT_CAP + VISIBLE_SLOT_HEADROOM`, and **an evicted tile has no intersection change
     * left to fire, so it stays black for the life of the tab** — the whole reported symptom. Evaluating the
     * floor at the point of use costs two `Math` calls and makes the burst self-consistent.
     *
     * ⚠️ **`demandFloor()` can only ever RAISE the ceiling, so this cannot reintroduce an unbounded slot
     * count**: it is itself clamped to `MAX_SLOTS`, which is the hard ceiling the free pool enforces anyway.
     * What remains true is that the cost cap still governs how many tiles are *stepped* per frame — the
     * budget in `tick()` is the throttle, and this is only the question of who keeps a slot.
     */
    if (this.freePool.length === 0 || this.activeSlots.size >= Math.max(this.slotCap, this.demandFloor())) {
      const oldest = this.activeSlots.keys().next();
      if (oldest.done) return;
      this.releaseSlot(oldest.value);
    }

    const gl = this.gl;
    const index = this.freePool.pop()!;
    // Lazily build this slot's FBO pair. Must precede the FBO clear below, and precede anything that
    // binds `slotFboA/B[index]`.
    this.ensureSlot(index);

    const divisor = PARTICLE_DIVISOR;

    const generator = new LissajousGenerator();
    generator.init(
      {
        // ⚠️ v8 `36.1` — the SECOND of the two `GeneratorConfig` call sites, and `36.D16`/`33.21`'s
        // standing warning applies to everything added here: this renderer forwarded only
        // `setViewScale` and `setSymmetry` until Phase 33, so NINE operators were invisible in tiles for
        // four phases and no checker compares a tile to a main view.
        type: resolveFigureType(preset.generators.type, preset.generators).type,
        // ⚠️⚠️ v8 `36.16`/`36.D16` — **a figure type that is not forwarded here draws every `lsystem`
        // preset as a WAVE figure in its own thumbnail, and the main view cannot show that.** This is
        // `33.21`'s exact failure mode: the renderer forwarded only `setViewScale` and `setSymmetry`
        // until Phase 33, so NINE operators were invisible in tiles for four phases.
        ...(preset.generators.lsystem !== undefined ? { lsystem: preset.generators.lsystem } : {}),
        particleCount: Math.min(MAX_TILE_PARTICLES, Math.max(10, Math.round(preset.generators.particleCount / divisor))),
        waves: preset.generators.waves ?? [],
        waveSpeed: preset.generators.waveSpeed ?? 0.05,
        rotation: preset.generators.rotation ?? [0, 0, 0],
        angle: preset.generators.angle ?? [0, 0, 0],
        colorBase: preset.generators.colorBase ?? [128, 128, 128],
        colorAmp: preset.generators.colorAmp ?? [128, 128, 128],
        colorFreq: preset.generators.colorFreq ?? [0.1, 0.1, 0.1],
        colorShift: preset.generators.colorShift ?? [0.1, 0.1, 0.1],
        designResolution: preset.metadata.designResolution ?? { width: 100, height: 100 },
      },
      { width: TILE_W, height: TILE_H },
    );

    // Honour the preset's Figure Scale. Without this a tile would frame the figure differently from the
    // main preview — which is the whole point of the uniform canvas fit: framing should no longer depend
    // on the shape of the canvas it happens to be drawn into.
    generator.setViewScale(preset.overlay?.figureScale ?? 1.0);

    // E30 dihedral symmetry. Forwarded for the same reason as Figure Scale, and it is NOT a C7 fidelity
    // trade: the fold is a model-space operator inside the generator, so it costs one call and no GL
    // state, and a tile that showed an unfolded figure would be showing a different SHAPE rather than a
    // reduced-fidelity version of the same one — which is exactly the divergence C7 accepts for
    // crystals and trails, but here it is free to avoid.
    generator.setSymmetry(preset.overlay?.symmetryFold ?? 1, preset.overlay?.symmetryMirror ?? true);
    // v8 Phase 42 — 3-D Symmetry, forwarded beside the 2-D fold for the same reason: without it a tile would show a
    // different SHAPE (one copy instead of the solid's arrangement), not a reduced-fidelity version of the same one.
    generator.setSymmetry3d({
      layout: preset.overlay?.sym3dLayout ?? SYM3D_DEFAULTS.layout,
      positions: preset.overlay?.sym3dPositions ?? SYM3D_DEFAULTS.positions,
      on: preset.overlay?.sym3dOn ?? SYM3D_DEFAULTS.on,
      local: preset.overlay?.sym3dLocal ?? SYM3D_DEFAULTS.local,
      radius: preset.overlay?.sym3dRadius ?? SYM3D_DEFAULTS.radius,
      mirrors: preset.overlay?.sym3dMirrors ?? SYM3D_DEFAULTS.mirrors,
      facing: preset.overlay?.sym3dFacing ?? SYM3D_DEFAULTS.facing,
    });

    /*
     * ⚠️⚠️ **EVERY OTHER MODEL-SPACE OPERATOR, ADDED 2026-10-28 — AND THEIR ABSENCE WAS A DEFECT SPANNING
     * FOUR PHASES, NOT A FIDELITY TRADE.**
     *
     * Until this block the tile renderer forwarded `setViewScale` and `setSymmetry` and **nothing else**.
     * So every figure operator shipped since Phase 30 was invisible in the grid: the twist (`30.1`), the
     * box-fold (`30.2`), the per-particle channels (`31.2`), the 4D rotation (`31.4`), taper and bend
     * (`32.1`/`32.2`), the sphere inversion (`32.7`), and `33.2`/`33.3`'s basis and sweep. **`Pipes
     * Twist`, `Pipes Taper`, `Quader Hyperspin` and a dozen others have been drawing the WRONG FIGURE in
     * the grid since Phase 30**, and nothing went red because no checker compares a tile to a main view.
     *
     * ⚠️ **Found by the owner on `Sharpness`, which is the newest of the nine** — the grid showed smooth
     * sinusoids for a preset authored at `sharpness: 1`. One report, nine operators.
     *
     * ⚠️ **THE ARGUMENT FOR INCLUDING THEM IS ALREADY WRITTEN TWELVE LINES UP, FOR THE FOLD:** a tile that
     * shows an undeformed figure is *"showing a different SHAPE rather than a reduced-fidelity version of
     * the same one — which is exactly the divergence C7 accepts for crystals and trails, but here it is
     * free to avoid."* Every call below is model-space, costs no GL state and runs once per slot. **C7
     * covers GRADING (exposure, saturation, bloom, vignette, DoF); it has never covered the figure.**
     *
     * ⚠️ **`escapeFlow` is deliberately NOT here**: it only means anything with an escape-time attractor,
     * and tiles set no attractor at all — see the note below, which is a separate and undecided question.
     *
     * ⚠️⚠️ **v8 `34.5` — PHASE 34's FOUR OPERATORS WERE FORWARDED IN THE SAME EDIT THAT ADDED THEM, WHICH IS
     * THE POINT OF THIS PARAGRAPH EXISTING.** `Offset`, `Grow`, the three sharpness LEVELS and the four
     * breathing pairs all land below. **The ZEROS are the proof**: a preset with no operator must produce a
     * tile bit-identical to the pre-Phase-34 one, and a preset carrying one must produce a tile that differs
     * from the identity tile — measured both ways with a tile-like WARM-UP, because at frame 1 `Pipes`' first
     * slot contributes nothing and a zero difference is ambiguous until the phase has advanced.
     */
    const ov = preset.overlay;
    for (const ax of [0, 1, 2] as const) {
      generator.setTwist(ax, [ov?.twistX, ov?.twistY, ov?.twistZ][ax] ?? 0);
      generator.setTaper(ax, [ov?.taperX, ov?.taperY, ov?.taperZ][ax] ?? 0);
      generator.setBend(ax, [ov?.bendX, ov?.bendY, ov?.bendZ][ax] ?? 0);
      generator.setTravel(ax, [ov?.travelX, ov?.travelY, ov?.travelZ][ax] ?? 0);
      /*
       * v8 `34.2`/`34.3`/`34.4` — **the four new figure operators, forwarded in the SAME edit that added
       * them, which is the whole lesson of the paragraph above.** Nine triples; the three sharpness LEVELS
       * are not axes and are handled below, outside this loop.
       */
      generator.setTravelDepth(ax, [ov?.travelDepthX, ov?.travelDepthY, ov?.travelDepthZ][ax] ?? 0);
      generator.setTravelRate(ax, [ov?.travelRateX, ov?.travelRateY, ov?.travelRateZ][ax] ?? 0);
      generator.setOffset(ax, [ov?.offsetX, ov?.offsetY, ov?.offsetZ][ax] ?? 0);
      generator.setOffsetDepth(ax, [ov?.offsetDepthX, ov?.offsetDepthY, ov?.offsetDepthZ][ax] ?? 0);
      generator.setOffsetRate(ax, [ov?.offsetRateX, ov?.offsetRateY, ov?.offsetRateZ][ax] ?? 0);
      // ⚠️ `?? 0` and NEVER `?? 1` — `grow` is the amplitude ramp COEFFICIENT and 0 is its identity.
      generator.setGrow(ax, [ov?.growX, ov?.growY, ov?.growZ][ax] ?? 0);
      generator.setGrowDepth(ax, [ov?.growDepthX, ov?.growDepthY, ov?.growDepthZ][ax] ?? 0);
      generator.setGrowRate(ax, [ov?.growRateX, ov?.growRateY, ov?.growRateZ][ax] ?? 0);
    }
    generator.setInversion(ov?.invertAmount ?? 0, ov?.invertRadius ?? 1);
    generator.setBoxFold(
      ov?.boxFoldIterations ?? 0,
      ov?.boxFoldLimit ?? BOX_FOLD_DEFAULT_LIMIT,
      ov?.boxFoldScale ?? 1,
    );
    generator.setWRotation(ov?.wScale ?? 0, ov?.wXW ?? 0, ov?.wYW ?? 0, ov?.wZW ?? 0, ov?.wWinding ?? 3);
    generator.setChannels(
      ov?.channelDriver ?? 'index',
      ov?.channelSize ?? 0,
      ov?.channelAlpha ?? 0,
      ov?.channelLight ?? 0,
    );
    /*
     * v8 `33.2`, widened by `34.4`. ⚠️⚠️ **THE `?? sharpness` BACKFILL IS DUPLICATED HERE FROM
     * `main.ts`'s `adoptFigureBasis()` AND THE DUPLICATION IS FORCED, NOT CHOSEN.** This file is the SECOND
     * `init()` call site for the generator and it cannot reach `main.ts`'s closure, so the expression exists
     * twice with no compiler between the copies. **`deformcheck` §N closes that gap by measurement**: it
     * asserts that the tile path and the main path resolve the same three levels for a preset carrying only
     * the shipped global `sharpness` key, over all six carriers.
     *
     * ⚠️ **`?? 0` HERE WOULD CHANGE SIX TILES AND NOTHING WOULD SAY SO** — the preview grid is exactly where
     * the Phase 30-33 forwarding defect hid for four phases, and a backfill written twice is the same shape
     * of failure one level down.
     */
    const sharpBody = ov?.sharpness ?? 0;
    generator.setSharpnessLevels(
      sharpBody,
      ov?.sharpnessStructure ?? sharpBody,
      ov?.sharpnessDetail ?? sharpBody,
    );
    generator.setSharpnessBreath(ov?.sharpnessDepth ?? 0, ov?.sharpnessRate ?? 0);

    /*
     * ⚠️⚠️ **TILES STILL SET NO ATTRACTOR, AND THAT IS UNDOCUMENTED RATHER THAN DECIDED — stated here so
     * the next reader does not have to re-derive it.** The word "attractor" appeared NOWHERE in this file
     * before this comment, so there is no recorded reason; C7 names grading and never mentions the figure.
     *
     * The cost is real but it is NOT uniform, which is why this is a question rather than an edit:
     *   - `julia`/`mandelbrot` build a **512² escape grid**, measured at **23/147/67 ms**. Per tile, with
     *     up to 56 tiles, that is plainly out of the question.
     *   - `lorenz`/`clifford`/`dejong`/… integrate per-particle state — affordable, but it needs a warm-up
     *     and the warm-up budget above is already the thing that made *"56 tiles never finish"*.
     *   - `cylinderknot` (`33.6`) is a **closed-form function of the index**: no state, no grid, no warm-up.
     *     It is as cheap as the fold and would be free to include.
     * **So the honest position is that 38 attractor presets draw the wrong tile, three of them for no
     * reason at all.** Deciding this is the owner's; it is not smuggled in under a defect fix.
     */

    // Configure material simulation if preset has material overlay
    const matOverlay = preset.overlay?.material;
    let materialConfig: MaterialConfig | null = null;
    let rampTexture: WebGLTexture | null = null;

    if (matOverlay && matOverlay.preset && matOverlay.preset !== 'None') {
      materialConfig = matOverlay as MaterialConfig;
      generator.setMaterialConfig(materialConfig);

      // Configure buoyancy (scale offsets for tile resolution)
      if (preset.overlay?.buoyancy) {
        generator.setBuoyancyConfig({
          ...preset.overlay.buoyancy,
          maxOffset: preset.overlay.buoyancy.maxOffset * SCREEN_SPACE_TILE_SCALE,
        });
      }

      // Configure sparks: reduce the budget for tile cost, and scale the one field that is in
      // ABSOLUTE SCREEN PIXELS. See `SCREEN_SPACE_TILE_SCALE` for why only `gravity` qualifies.
      //
      // ⚠️ `splatRadius` is passed through UNSCALED and is not honoured by the tile shader — a DELIBERATE
      // fidelity gap (C7), recorded here so it does not read as the omission that `fieldcheck` §I exists to
      // catch. The main renderer sizes sparks from this field as of 2026-08-29; the tile draws one
      // `gl_PointSize` for every particle, so a tile shows sparks at the material's size. That is a
      // rendering difference, not a config-resolution one: the value IS read here and forwarded to the
      // generator, which is what §I asserts. Honouring it would need a `gl_VertexID` range test against the
      // published `[wave][sparks][liquid][crystals]` partition — cheap, but it belongs with a decision about tile
      // fidelity rather than with the field's own wiring.
      if (preset.overlay?.sparks) {
        generator.setSparkConfig({
          ...preset.overlay.sparks,
          maxSparksPerFrame: Math.max(2, Math.round(preset.overlay.sparks.maxSparksPerFrame / 2)),
          poolSize: Math.round(preset.overlay.sparks.poolSize / divisor),
          gravity: preset.overlay.sparks.gravity * SCREEN_SPACE_TILE_SCALE,
        });
      }

      // Create colour ramp texture for this slot
      rampTexture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, rampTexture);
      // Note the tile shader collapses the engine's SIX render modes into four branches (E12): `star`,
      // `star` and `volume` both render as mode 2. Consistent with the reduced-fidelity decision (C7)
      // but invisible in the UI, so a tile can legitimately look unlike its preset for that reason alone.
      const rampData = getColourRampData(matOverlay.colourRamp ?? 'fire');
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // D16: film-look palette LUT. Independent of whether a material is active — the point path takes
    // the palette too, exactly as pixel/blend/star do in the main renderer.
    const pal = tilePaletteFor(preset);
    // v8 Step 21.4a — the `index` mapping's CPU half. Unconditional, and `null` is the normal argument: it
    // means "the generator uses its own `colorBase`/`colorAmp`", which is what the six LUT mappings and every
    // legacy preset want. Gating the call on a non-null palette would leave a RE-USED slot carrying the
    // previous preset's index palette — but slots build a fresh `LissajousGenerator` above, so the reason
    // this is unconditional is the rule (invariant 4's shape: assign the channel every time), not a live bug.
    generator.setIndexPalette(pal.indexPalette);
    // v8 26.4 — read as `?? 0`, the identity, exactly as every other reader of this key must.
    const paletteHueShift = preset.overlay?.paletteHueShift ?? 0;
    let paletteTexture: WebGLTexture | null = null;
    if (pal.lut) {
      paletteTexture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pal.lut);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // Per-slot TransMap
    const transMap = new TranslationMapProcessor();
    const pp = preset.postProcessors.transMap;
    // The tile honours the preset's whole LAYER CHAIN, derived the one sanctioned way. For all 177 legacy
    // presets this is the single-layer chain their `style` describes, so tiles are unchanged; a preset or
    // import carrying `overlay.transMapChain` now previews as what it actually renders.
    //
    // ⚠️ No `SCREEN_SPACE_TILE_SCALE` factor on any of this — decide by UNIT, not by field name. A layer
    // weight is a dimensionless ratio and the chain's offset clamp is in UV, both of which are already
    // resolution-independent; `sinMagicParams` are scaled inside the processor by its own `min(w,h)/100`.
    //
    // ⚠️ **`staticField.detail` is NOT scaled either, and that was measured rather than assumed.** It reads as
    // a screen-space frequency, but `buildWave` computes `360 * i * freq / period` with `period = min(w,h)` —
    // cycles across a whole SHARED length scale, not per pixel — so detail 4 is four cells wide at any
    // resolution. Scaling it was tried: comparing the sampled UV offset field of a tile against 1024x768 at
    // matched aspect over 4 styles x 4 archetypes x 4 detail values, unscaled agreed to 2.9e-2 worst case while
    // multiplying by `SCREEN_SPACE_TILE_SCALE` (0.25) made it 7.6e-2 — 2.6x WORSE, i.e. the scale introduces the
    // error it looks like it corrects. `strength` likewise: it is solved as a fraction of `min(w,h)` inside
    // `solveGain`, so it is already a ratio. ⚠️ **The divisor used to be `n`, each axis's own pixel count, and
    // the conclusion above survived that change unaltered while the REASON changed**: with `n` the argument was
    // "cycles across the whole axis", which held per axis and hid the fact that the two axes disagreed with each
    // other by the canvas aspect (fixed 2026-08-28; see `static-field.ts` -> `buildWave`). A tile at matched
    // aspect could never have shown it — which is why the measurement above stayed valid and still missed it.
    const chain = chainFromOverlay(preset.overlay, pp?.style ?? 0, pp?.ifsParams);
    // ⚠️ **`overlay.transMapEnabled` WINS over `postProcessors.transMap.enabled`, and reading only the latter
    // was a reported bug** (2026-08-20): a preset enhanced in the Lab and exported carried
    // `postProcessors.transMap.enabled: false` next to `overlay.transMapEnabled: true`, because the Lab turns
    // the pass on through the overlay and never writes back to the preset block. So the import previewed with
    // NO warp at all — chain, staticField and dispersion were all resolved correctly and then gated off by a
    // flag from the wrong half of the file. It also fails the other way: an overlay that turns the pass OFF
    // was ignored, so a tile warped when the main canvas did not.
    //
    // This is the same `??` order `main.ts` uses at both of its sites (`applyOverlayConfigBlocks` and the
    // preset-click path), and it must stay that order: `undefined` means "the overlay has no opinion", which
    // is every one of the 177 legacy presets, and those must keep deferring to their preset block.
    const tmEnabled = preset.overlay?.transMapEnabled ?? pp?.enabled ?? false;
    transMap.init(gl, {
      enabled: tmEnabled,
      // From the CHAIN, not `pp.style`, so this cannot disagree with the layers actually installed. Inert
      // today — `init()` reads `config.style` only to synthesise a fallback layer when `chain` is empty, and
      // `chainFromOverlay` never returns an empty chain — but a wrong-but-unused value is exactly what the
      // `enabled` defect above was one release earlier.
      style: chain[0]?.style ?? pp?.style ?? 0,
      chain,
      sinMagicParams: pp?.sinMagicParams ?? [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
      sinMagicParams2: pp?.sinMagicParams2 ?? [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
      zoomCenterX: pp?.zoomCenter.x ?? 50,
      zoomCenterY: pp?.zoomCenter.y ?? 50,
      ...(pp?.ifsParams ? { ifsParams: pp.ifsParams } : {}),
      width: TILE_W,
      height: TILE_H,
    });

    // ⚠️ **Tiles do NOT drift, and this is the only thing that stops them.** `drift > 0` makes `apply()`
    // re-resolve every static layer's waves each frame, and `resolveStaticWaves` runs `solveGain` — 0.8 ms at
    // 1080p, less here but paid once per drifting tile per frame, against a budget that schedules whole tiles.
    // 177 thumbnails re-solving a gain nobody is watching for motion is exactly the per-frame cost the
    // budget-driven scheduler cannot absorb.
    //
    // A SCALE of 0, not a separate config flag: the layer keeps its authored `drift` value, so `staticField`
    // round-trips through a tile unchanged and a tile click hands the main canvas the drift the user set. A
    // flag that suppressed the field itself would make the tile stop previewing what it renders.
    transMap.setDriftScale(0);

    // ⚠️ **Styles 7 and 9 DO run in a tile, and their two screen-space parameters must be scaled.** Style 7's
    // `reach` is a gradient sample distance in TEXELS and style 9's `radius` is a blur radius in TEXELS, so a
    // 1-texel reach on a 256×192 tile spans 4× the fraction of the frame it spans at 1024×768 — the gradient
    // would be measured over a visibly coarser neighbourhood and a 4 px band split would cut a different
    // spatial FREQUENCY. Their siblings `strength` and `amount` are deliberately NOT scaled: `strength` is
    // gain-solved against the tile's own `min(w, h)` inside the processor and `amount` is a dimensionless
    // blend. Decide by UNIT, not by field name — the same test `staticField.detail` was measured against.
    //
    // Unlike drift this is not a fidelity reduction: both operators cost one pass the tile already runs plus,
    // for style 9, two half-res blurs of a 256×192 frame. No `readPixels` and no per-frame CPU work.
    //
    // ⚠️ **The four Phase-14 styles added after these two need NO entry here, and each for a DIFFERENT reason —
    // so do not read the absence as an oversight.** The unit test is what decides, not the field name:
    //
    // - **Style 8 (Time Warp)** — `amount` is a dimensionless lerp toward the previous frame, and its history
    //   target is allocated by the processor at the tile's own size. Self-scaling.
    // - **Style 10 (Vortex)** — `swirl` is gain-solved as a fraction of `min(w,h)` like `strength`, and `radius`
    //   and `centre` are NORMALISED (fractions of `min(w,h)`, not texels). Scaling `radius` would shrink the eye
    //   to a quarter of the tile's proportion — the same error `staticField.detail` was measured to have.
    // - **Style 11 (Depth Parallax)** — `amount`/`nearScale`/`farScale` are all dimensionless MULTIPLIERS, so
    //   nothing here would scale. It renders INERT in a tile instead, because a tile has no `DepthFieldPass` and
    //   `apply()`'s `depthLive` gate uploads `uParallaxAmount = 0` when no depth texture was handed over
    //   (invariant 3). That is reduced fidelity (C7, a won't-fix), not a defect: adding a per-tile depth target
    //   means an FBO and an extra draw per tile against a budget that schedules whole tiles, and the documented
    //   failure mode for exactly that is a 52 ms regression against a 16.7 ms frame. ⚠️ Measure the tile cost
    //   before enabling it — and note this makes style 11 the one style where the tile is HONESTLY different
    //   from the main view, so "the main view warps and the tile does not" localises here rather than to the
    //   `overlay.X ?? preset.Y` resolution above.
    transMap.setScreenSpaceScale(SCREEN_SPACE_TILE_SCALE);

    // Set warp mix from overlay if present
    if (preset.overlay?.transMapWarpMix != null) {
      transMap.setMix(preset.overlay.transMapWarpMix);
    }

    // Dispersion, with the same flat-key-then-legacy-nested resolution as `main.ts`. Tiles DO show it — unlike
    // drift, it costs one extra texture fetch in a pass that already runs, needs no per-frame CPU work, and is
    // a look rather than a motion, so a still thumbnail represents it faithfully. No `SCREEN_SPACE_TILE_SCALE`:
    // it scales the UV offset `off`, which is already resolution-independent — decide by UNIT, not field name.
    const disp = preset.overlay?.transMapDispersion ?? preset.overlay?.fluidFeedback?.dispersion ?? 0;
    if (disp > 0) transMap.setDispersion(disp);

    // Create mini fluid sim state for a tile whose chain has a CONTRIBUTING style-6 layer — `isStyleActive`,
    // not `=== 6`, so a 0+6 chain still gets its velocity field. Without one, `apply()` binds the 1x1 zero
    // fallback for the fluid sampler and the layer contributes nothing (invariants 3 and 4).
    //
    // ⚠️ `isStyleActive` (enabled AND weight > 0), not mere presence: this allocates a velocity texture, an
    // FBO and a `FluidAdvectionProcessor` per tile, and a muted or weight-0 layer is never sampled. Paying
    // that across 177 tiles for a layer contributing nothing is the kind of per-slot cost the budget-driven
    // scheduler cannot absorb.
    let fluidSim: FluidSimState | null = null;
    // `tmEnabled`, not `pp?.enabled`: an overlay-enabled 0+6 chain needs its velocity field, and without one
    // `apply()` binds the 1x1 zero fallback and the fluid layer contributes nothing (invariants 3 and 4).
    if (isStyleActive(chain, 6) && tmEnabled) {
      const particleCount = Math.min(MAX_TILE_PARTICLES, Math.max(10, Math.round(preset.generators.particleCount / PARTICLE_DIVISOR)));
      const velTex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, velTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, FLUID_GRID, FLUID_GRID, 0, gl.RG, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);

      const fbConfig: FluidFeedbackConfig = preset.overlay?.fluidFeedback ?? {
        persist: 0.96, amplify: 1.0, dispersion: 0.0, fieldDecay: 0.985, glowBoost: 0.0,
      };

      fluidSim = {
        prevPositions: new Float32Array(particleCount * 2),
        smoothedVel: new Float32Array(particleCount * 2),
        velGrid: new Float32Array(FLUID_GRID * FLUID_GRID * 2),
        blurGrid: new Float32Array(FLUID_GRID * FLUID_GRID * 2),
        velTexture: velTex,
        feedbackConfig: fbConfig,
        initialized: false,
      };
    }

    // Clear the slot's FBOs
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.slotFboA[index]!);
    gl.viewport(0, 0, TILE_W, TILE_H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.slotFboB[index]!);
    gl.viewport(0, 0, TILE_W, TILE_H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Same overlay-wins resolution as `tmEnabled` above and as `main.ts`'s two sites, and reachable for the
    // same reason: `getSnapshot()` emits `overlay.renderMode` from the LIVE mode while nothing ever writes
    // back to `preset.renderer.mode`, so any export made after touching the Visual FX dropdown carries the
    // two disagreeing. Reading only the preset block made such a tile preview the mode the file was authored
    // with instead of the one it renders. `volume` maps to 2 exactly as before — it is `'star'`'s fallback
    // here and is deliberately not a tile mode.
    const tileMode = preset.overlay?.renderMode ?? preset.renderer.mode ?? 'star';
    // ⚠️ **`liquid` is tested FIRST, ahead of the material test, and that ORDER is the whole wiring.** Every
    // other mode yields to a live material because the material's splat replaces the particle's shape; liquid
    // does not, because the material has no say in an iso-surface — it contributes only a colour ramp, which
    // `tintSource: 'material'` reads separately. Folded the other way, every liquid preset carrying a material
    // would preview as a splat, i.e. the mode would be invisible on exactly the presets the phase is for
    // (`LiquidLight` is the 2nd-most-used material in the library).
    //
    // ⚠️ **And it must NOT collapse into 2.** `star` and `volume` both map to 2 by the C7
    // reduced-fidelity decision, which is defensible because all three are additive point sprites that differ
    // in exposure. Liquid differs in KIND: it occludes, and a tile showing additive stars for it would be
    // showing a different image rather than a coarser one. Hence a FIFTH branch in the tile shader.
    let modeInt = tileMode === 'liquid' ? 4 : materialConfig ? 3 : (tileMode === 'pixel' ? 0 : tileMode === 'blend' ? 1 : 2);
    let liquid: TileLiquidState | null = null;
    if (modeInt === 4) {
      if (this.ensureLiquid()) {
        liquid = this.buildLiquidState(gl, preset, materialConfig, paletteTexture !== null);
      } else {
        // The refusal path: no R32F here, so fall back to the same mode `star` uses. One warning was already
        // logged by `ensureLiquid()`; this must not log per slot, and there are up to 128 of them.
        modeInt = 2;
      }
    }
    // CLAMP the trail decay for tiles.
    //
    // A tile renders one frame per FRAME_SKIP and compensates with `uBrightness = FRAME_SKIP`, so its
    // steady-state accumulation is `FRAME_SKIP / (1 - decay^FRAME_SKIP)`. At a typical 0.9 that is
    // ~12x a single frame, but `Miracle Frost` ships 0.9877 (legacy MotionBlur 8) which gives ~83x —
    // every pixel saturates and the tile renders solid white while the main preview, which renders
    // every frame without the brightness multiplier, looks correct. 0.96 caps accumulation at ~25x.
    //
    // ⚠️ This clamp is derived from `FRAME_SKIP` and is still exact, because `trailBrightnessFor` holds that
    // very expression invariant under the measured step — the ONE reason the anchoring is worth more than the
    // bare multiplier it replaced. A `B = N` form would make the saturation ceiling refresh-rate-dependent,
    // so this figure would be a cap on one machine and not on another, with nothing here to say which.
    const MAX_TILE_DECAY = 0.96;
    // ⚠️ **The `persist` override is style 6's, so it is gated on style 6 CONTRIBUTING** — the same
    // condition `applyFluidFeedbackState()` derives `trailDecay` from in `main.ts`, and for the same reason:
    // `persist` replaces the preset's `decayFactor` only while the fluid layer is actually being drawn.
    // Ungated, a preset carrying a `fluidFeedback` block took its trail length from it even with the layer
    // muted, at weight 0, or with the TransMap pass disabled outright — so the tile faded at a different
    // rate than the main preview showed for the same preset.
    const useFluidPersist = tmEnabled && isStyleActive(chain, 6);
    const rawDecay = (useFluidPersist ? preset.overlay?.fluidFeedback?.persist : undefined) ?? preset.renderer.decayFactor;
    const decay = Math.min(rawDecay, MAX_TILE_DECAY);

    /**
     * The warm-up's phase, taken ANALYTICALLY (2026-09-25). Resumes where this preset's previous slot left off
     * when the cache still holds it — a Grid/Lab toggle or a scroll back up therefore does not restart every
     * figure — and otherwise starts at `MATH_WARM_FRAMES`, which is exactly what the old loop delivered.
     *
     * ⚠️ **This must come AFTER every `generator.set*()` call above and BEFORE the slot is published.** After,
     * because `setSymmetry`/`setViewScale`/`setMaterialConfig` change what a given `pos` evaluates to, and a
     * jump taken before them would be a jump through the wrong figure (harmless today — nothing reads the
     * positions in between — but it is the kind of ordering that stops being harmless silently). Before,
     * because `mathWarmRemaining` below is sized on the assumption that the phase is already there.
     *
     * ⚠️ `MATH_WARM_SETTLE_FRAMES` is SUBTRACTED, not added on top: the two real updates the slot still owes
     * advance `pos` themselves, so the tile's first painted frame sits at the same phase as before this
     * change. Getting this backwards is invisible — 42 frames looks exactly like 40.
     *
     * ⚠️ **PHASE AND POSE are preserved bit-exactly; the INTEGRATED state is not, and that is the trade.** A
     * material tile's temperature field, its spark pool and its crystal pool now build over the tile's first
     * second on screen instead of arriving 40 frames settled — nothing else differs, which is the measurement
     * `MATH_WARM_SETTLE_FRAMES` records. The alternative is 40 particle loops per tile before anything can be
     * shown, which is what "56 tiles never finish" was made of. **A tile that looks wrong in a way that is
     * neither of those three localises elsewhere** — start with the `overlay.X ?? preset.Y` resolutions above,
     * not here.
     */
    const seedFrames = this.phaseCache.get(presetName) ?? MATH_WARM_FRAMES;
    generator.advancePhase(seedFrames - MATH_WARM_SETTLE_FRAMES);

    const slot: SlotState = {
      index,
      presetName,
      generator,
      canvas,
      transMap,
      decayFactor: decay,
      blurEnabled: preset.renderer.blurRadius > 0,
      renderMode: modeInt,
      mathWarmRemaining: MATH_WARM_SETTLE_FRAMES,
      mathWarmChunk: 0,
      // `seedFrames` less the two the slot still owes; `advanceMathWarmup` adds them back as it spends them,
      // so this field is the generator's true frame count at every instant, not only at release.
      phaseFrames: Math.max(0, seedFrames - MATH_WARM_SETTLE_FRAMES),
      warmupRemaining: warmupFramesFor(decay),
      needsBlit: false,
      sinceStepMs: TILE_STEP_INTERVAL_MS,
      rampTexture,
      materialConfig,
      // Additive materials only — an alpha material is bounded at 1.0 and would just go opaque, so it
      // stores 0 and `splatBrightnessFor` returns exactly 1.0 for it.
      splatCountRatio: materialConfig && materialConfig.blendMode !== 'alpha' && preset.generators.particleCount > 0
        ? Math.min(MAX_TILE_PARTICLES, Math.max(10, Math.round(preset.generators.particleCount / divisor)))
          / preset.generators.particleCount
        : 0,
      paletteTexture,
      paletteHueShift,
      // `tilePaletteFor` now always returns a record, and its `mapping` is already 0 when there is no LUT —
      // so the `?? 0` that used to cover the null case would today be dead, not defensive.
      paletteMapping: pal.mapping,
      fluidSim,
      // v8 Step 14.6 — the same `??` order as `tmEnabled` above and as `main.ts`'s two sites. `undefined`
      // means "the overlay has no opinion", which is every one of the 177 legacy presets, and those must keep
      // deferring to their preset block. See `SlotState.beforeParticles`.
      beforeParticles: preset.overlay?.transMapBeforeParticles ?? pp?.beforeParticles ?? false,
      particleSize: preset.overlay?.particleSize ?? 1.0,
      liquid,
    };
    this.activeSlots.set(presetName, slot);
  }

  /**
   * Does the renderer currently hold a slot for this name?
   *
   * ⚠️ **Exists so `panel.ts` can REPAIR a hole, and a hole is not hypothetical**: an `IntersectionObserver`
   * reports intersection CHANGES, so a tile that is still on screen but has lost its slot — evicted at the
   * hard `MAX_SLOTS` ceiling, or released by a path that then failed to re-acquire — has no event left to fire
   * and stays frozen for the life of the tab. See `PreviewGridPanel.reconcileSlots()`, the only caller.
   */
  hasSlot(presetName: string): boolean {
    return this.activeSlots.has(presetName);
  }

  /**
   * The number of slots the VISIBLE set is entitled to regardless of measured cost — `ceil(demand) + headroom`,
   * clamped to `[MIN_SLOT_CAP, MAX_SLOTS]`.
   *
   * ⚠️ **One expression, two readers, and that is the point (2026-09-25).** `updateSlotCap()` uses it as the
   * floor under the cost-derived cap; `acquireSlot()` uses it at the moment of eviction, where the cached
   * `slotCap` may be up to one `TILE_STEP_INTERVAL_MS` out of date and derived from a demand that has since
   * doubled. Two copies of this arithmetic drifting apart is exactly the defect the second reader was added to
   * fix, so **never inline it at either site**.
   */
  private demandFloor(): number {
    const demand = Math.ceil(this.peakConcurrentDemand) + VISIBLE_SLOT_HEADROOM;
    return Math.max(MIN_SLOT_CAP, Math.min(MAX_SLOTS, demand));
  }

  /**
   * Record how far through its cycle a released tile had got, bounded by an LRU eviction of the oldest entry.
   *
   * ⚠️ **`delete` before `set` is what makes the Map an LRU** — without it a re-written key keeps its original
   * insertion position and the eviction below drops the most-used entries first.
   */
  private rememberPhase(presetName: string, frames: number): void {
    if (!Number.isFinite(frames) || frames <= 0) return;
    this.phaseCache.delete(presetName);
    this.phaseCache.set(presetName, frames);
    while (this.phaseCache.size > PHASE_CACHE_MAX) {
      const oldest = this.phaseCache.keys().next();
      if (oldest.done) break;
      this.phaseCache.delete(oldest.value);
    }
  }

  releaseSlot(presetName: string): void {
    const slot = this.activeSlots.get(presetName);
    if (!slot) return;
    // Before the generator is disposed, so the hint survives the slot. A released tile is very often
    // re-acquired within seconds (Grid/Lab toggle, a scroll back, a filter cleared), and resuming its phase is
    // what makes that re-acquire free rather than a second full fill.
    this.rememberPhase(presetName, slot.phaseFrames);
    slot.generator.dispose();
    slot.transMap.dispose();
    if (slot.rampTexture) this.gl.deleteTexture(slot.rampTexture);
    if (slot.paletteTexture) this.gl.deleteTexture(slot.paletteTexture);
    if (slot.fluidSim) this.gl.deleteTexture(slot.fluidSim.velTexture);
    // v8 Step 15.1 — the liquid slot's own ramp LUT. A separate texture from `slot.rampTexture`, so it needs
    // its own release: a grid scrolling through liquid presets acquires and releases continuously, and one
    // leaked 1 KB LUT per acquire is unbounded over a session.
    if (slot.liquid?.rampTexture) this.gl.deleteTexture(slot.liquid.rampTexture);
    this.freePool.push(slot.index);
    this.activeSlots.delete(presetName);
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  /**
   * @param dt main-loop frame time in MILLISECONDS.
   * @param throttle `PerfGuard.tileThrottle()` — a divisor on the STEADY pass's BUDGET. 1 means untouched, and
   *   the parameter defaults to it so no caller is obliged to know about the guard.
   *
   *   ⚠️ **The throttle divides the BUDGET and must never divide the step INTERVAL.** Stepping less often is
   *   not a throttle, it is a different animation: every compensation here is per main-loop frame, so a step
   *   spanning 24 frames instead of 8 fades by `d^24` and deposits `uBrightness = 24` — at d = 0.9 that is a
   *   trail reduced to 8 % with 2.2x the steady brightness, i.e. bright dots with no tail. Shrinking the
   *   budget instead leaves every rendered frame byte-identical and simply renders fewer tiles per frame; the
   *   rotating `steadyCursor` spreads the shortfall, so tiles lose frame rate individually. That is the
   *   degradation this file already accepts on a large grid, reached by the same route.
   *
   *   ⚠️ **Warm-up is deliberately EXEMPT** — `GL_WARM_BUDGET_MS` and `advanceMathWarmup` are not divided.
   *   Filling the grid is work the user is WAITING on, and a throttled fill is the "the previews take seconds
   *   to appear" half of the complaint. Under load the grid fills at full speed and ANIMATES slowly; only the
   *   second of those is cosmetic.
   *
   *   ⚠️ **A per-frame reading, hence a parameter rather than a setter.** A setter would hold the last level
   *   the guard reported for as long as nobody called it again, which is precisely the state a latch may not
   *   have: `setActive(false)` on a hidden panel already stops `tick`, so a stale throttle would survive the
   *   panel being reopened.
   */
  tick(dt: number, throttle = 1): void {
    if (!this.active || this.activeSlots.size === 0) return;
    this.frameCount++;
    this.throttle = Math.max(1, throttle);

    // ONE stall-clamped reading of this frame, used by both the budget basis and the step accumulator, so the
    // two can never disagree about how long a frame is. The old code fed raw `dt * FRAME_SKIP` to the
    // generators with no clamp at all, so a one-second hitch advanced every tile by four seconds.
    const frameMs = Number.isFinite(dt) && dt > 0 ? Math.min(50, Math.max(1, dt)) : NOMINAL_FRAME_MS;
    // EMA over ~1/3 s so one janky frame cannot collapse every budget at once — the same reasoning
    // `updateSlotCap`'s EMA carries.
    this.frameMsEma = this.frameMsEma * 0.9 + frameMs * 0.1;
    this.blitAccumMs = Math.min(TILE_STEP_INTERVAL_MS, this.blitAccumMs + frameMs);

    // Math warm-up is plain arithmetic with no GL calls, so it runs EVERY frame
    // rather than behind the cadence gate — that gate exists to throttle
    // rendering. Metering it at 15/s instead of 60/s was what made tiles arrive
    // one after another: a tile is unshowable until its math completes, so a
    // 4x slower drain directly serialised the grid fill.
    this.advanceMathWarmup();

    // The nominal step, in both units — 4 frames / 66.7 ms at 60 Hz, 8 / 66.9 at 120 Hz. The frame COUNT
    // drives every per-frame compensation and the millisecond figure drives the generators, so both are
    // derived from `frameMsEma` and can never disagree: a tile whose motion and whose trail disagree reads
    // as the wrong trail LENGTH, never as the wrong step. See `stepFrames` for why the tile's REAL wait is
    // deliberately not used, and `MAX_STEP_FRAMES` for the stall clamp.
    this.stepFrames = Math.min(MAX_STEP_FRAMES, Math.max(1, Math.round(TILE_STEP_INTERVAL_MS / this.frameMsEma)));
    const effectiveDt = this.stepFrames * this.frameMsEma;
    // ⚠️ `* 0.001` — `dt` is MILLISECONDS here and the liquid reference's τ is in SECONDS. Unconverted it
    // becomes a step of hundreds of τ, so the EMA degenerates to a snap and the smoothing is silently absent.
    this.lastEffectiveDtSeconds = effectiveDt * 0.001;
    /**
     * How much wave PHASE one `update(effectiveDt)` buys, in frames — the conversion `SlotState.phaseFrames`
     * needs and the one thing this file has to know about the generator's clock (2026-09-25).
     *
     * ⚠️ **The `6` mirrors `LissajousGenerator.update`'s own `Math.min(dt / 16.667, 6.0)` stall clamp**, which
     * is why a 120 Hz machine's 8-frame step advances the figure by 6 and not 8. Dropping the clamp here would
     * make the counter run ahead of the phase it claims to describe — ~2 frames per step, unbounded over a
     * session. It is only a continuity hint, so the failure is cosmetic (a resumed tile starting at a slightly
     * different point of a cycle it is animating through anyway) — but a counter that is knowingly wrong is
     * not worth keeping, and the correct expression costs one `Math.min`.
     */
    const stepPhaseFrames = Math.min(6, effectiveDt / NOMINAL_FRAME_MS);

    // ── The cadence gate, PER SLOT (2026-09-24) ──
    //
    // It was one accumulator for the whole grid, which made every tile's step land on the same frame and so
    // made the grid's whole cost arrive as one lump — the hitch. Per slot, the gate does the one thing it is
    // for (no tile may exceed `TARGET_FPS`) and leaves WHICH frame a tile renders on to the budget below,
    // which is what spreads the cost. See the note above `MATH_WARM_BUDGET_MS`: nothing about a tile's
    // appearance depends on which frame of the step it renders on.
    const glPending = [];
    const due = [];
    for (const slot of this.activeSlots.values()) {
      if (slot.mathWarmRemaining > 0) continue;
      slot.sinceStepMs += frameMs;
      if (slot.warmupRemaining > 0) glPending.push(slot);
      else if (slot.sinceStepMs >= TILE_STEP_INTERVAL_MS) due.push(slot);
    }
    // ⚠️ Before any `getParameter`. On a 120 Hz panel most frames have nothing due, and two state queries plus
    // a `blitToCanvases()` walk on each of them is a cost with no render to pay for it.
    const wantBlit = this.blitPending && this.blitAccumMs >= TILE_STEP_INTERVAL_MS;
    if (glPending.length === 0 && due.length === 0 && !wantBlit) return;

    const gl = this.gl;
    // Save GL state
    const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const prevViewport = gl.getParameter(gl.VIEWPORT);

    // Phase 2: settled tiles — the live animation. Budgeted, and walked from a
    // rotating cursor so that when the budget cannot cover every tile the
    // shortfall is shared evenly instead of always starving the same tail.
    if (due.length > 0) {
      const t0 = performance.now();
      // The ONLY site the throttle reaches. `frameSliceMs` turns the duty cycle into this frame's slice; the
      // divisor is `PerfGuard`'s. The loop below still always renders one tile, so a throttle can slow the
      // grid but never stop it — which is the whole difference between level 1 and level 2.
      const deadline = t0 + this.frameSliceMs(STEADY_DUTY) / this.throttle;
      const start = this.steadyCursor % due.length;
      let rendered = 0;
      for (let i = 0; i < due.length; i++) {
        const slot = due[(start + i) % due.length]!;
        slot.sinceStepMs = 0;
        slot.generator.update(effectiveDt);
        slot.phaseFrames += stepPhaseFrames;
        this.renderSlotFullPipeline(slot);
        slot.needsBlit = true;
        this.blitPending = true;
        rendered++;
        // Always advance at least one tile, else a single over-budget tile
        // would deadlock progress at the cursor.
        if (performance.now() >= deadline) break;
      }
      this.steadyCursor = (start + rendered) % due.length;
      // ⚠️ `+=`, not `=`. The per-tile cost the slot cap is derived from is a render PLUS its readback, and
      // those now happen on different frames — so both halves accumulate until the blit that pairs with them.
      this.steadyRenderMs += performance.now() - t0;
      this.steadyRendered += rendered;
    }

    if (glPending.length > 0) {
      // NOT divided by the throttle — see `tick`'s warm-up exemption.
      const deadline = performance.now() + this.frameSliceMs(GL_WARM_DUTY);
      // One render per tile per pass, re-passing until the deadline. Every
      // warming tile therefore advances before any tile advances twice, so a
      // screenful brightens together instead of resolving front-to-back.
      let progressed = true;
      while (progressed && performance.now() < deadline) {
        progressed = false;
        for (const slot of glPending) {
          if (slot.warmupRemaining <= 0) continue;
          // Advance by effectiveDt, matching the steady pass. Stepping a single
          // frame here while renderSlotFullPipeline decays decayFactor^FRAME_SKIP
          // advanced the sim at 1/FRAME_SKIP the rate relative to trail decay, so
          // warm-up converged to a shorter trail than the tile then settles into.
          //
          // ⚠️ The gate is zeroed here too, so the first STEADY step of a tile that has just finished warming
          // is a full interval away rather than on the very next frame — a warm-up render is a step.
          slot.sinceStepMs = 0;
          slot.generator.update(effectiveDt);
          slot.phaseFrames += stepPhaseFrames;
          this.renderSlotFullPipeline(slot);
          slot.warmupRemaining--;
          slot.needsBlit = true;
          this.blitPending = true;
          progressed = true;
          if (performance.now() >= deadline) break;
        }
      }
    }

    // Blit all active slots to their canvases, ONE burst per step interval — see `blitAccumMs` for the
    // measurement that says why this is the one pass that may not be spread. Timed together with the steady
    // renders: the readback is the bulk of a tile's true cost, so the cap must be derived from both, not from
    // the render alone.
    if (this.blitPending && this.blitAccumMs >= TILE_STEP_INTERVAL_MS) {
      const tBlit = performance.now();
      this.blitToCanvases();
      this.blitPending = false;
      this.blitAccumMs = 0;
      if (this.steadyRendered > 0) {
        const total = this.steadyRenderMs + (performance.now() - tBlit);
        this.updateSlotCap(total / this.steadyRendered);
        this.steadyRendered = 0;
        this.steadyRenderMs = 0;
      }
    }

    // Restore GL state
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo as WebGLFramebuffer | null);
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
  }

  private renderSlotFullPipeline(slot: SlotState): void {
    const gl = this.gl;
    const { index, decayFactor, blurEnabled } = slot;
    const fboA = this.slotFboA[index]!;
    const fboB = this.slotFboB[index]!;
    const texA = this.slotTexA[index]!;
    const texB = this.slotTexB[index]!;
    const isMaterial = slot.renderMode === 3;

    // Step 1: Decay pass — read from texA, write to fboB (with optional blur)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
    gl.viewport(0, 0, TILE_W, TILE_H);
    gl.disable(gl.BLEND);

    if (blurEnabled || isMaterial) {
      // Material slots always get blur for bloom-like glow spread
      gl.useProgram(this.blurBlitProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform1i(this.uBlurBlitTex, 0);
      gl.uniform2f(this.uBlurBlitTexelSize, 1.0 / TILE_W, 1.0 / TILE_H);
      gl.bindVertexArray(this.blurBlitVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    } else {
      gl.useProgram(this.blitProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform1i(this.uBlitTex, 0);
      gl.bindVertexArray(this.blitVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    // Apply decay (semi-transparent black quad)
    // Adjust decay for the step: the tile renders one frame per `stepFrames` main-loop frames, so effective
    // retention = decayFactor^stepFrames per tile-frame. ⚠️ `this.stepFrames`, NOT `FRAME_SKIP` — the latter is
    // only the 60 Hz reference now, and using it here would make the trail 2x too long on a 120 Hz panel.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.fadeProgram);
    const effectiveDecay = Math.pow(decayFactor, this.stepFrames);
    gl.uniform1f(this.uFadeAlpha, 1.0 - effectiveDecay);
    gl.bindVertexArray(this.fadeVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    // Step 2: For a style-6 tile, compute the mini fluid sim and feed the velocity texture.
    //
    // ⚠️ MOVED AHEAD of the particle draw by Step 14.6, and it is order-INDEPENDENT: it seeds from
    // `generator.getState()` on the CPU and writes only its own velocity FBO, so it neither reads nor writes
    // the ping-pong pair. It has to run before the warp under either order (the warp samples the velocity
    // texture), and under warp-first the warp now precedes the draw — so the only position that serves both
    // orders is here.
    if (slot.fluidSim) {
      this.updateFluidSim(slot);
    }

    // Step 3: the two passes Step 14.6 permutes — warp (texB -> fboA) and the particle draw.
    //
    // ⚠️ **Both are bound EXPLICITLY, because the draw used to INHERIT `fboB` from the decay pass** and that
    // inheritance is the one assumption a permutation breaks. It would break silently: the particles would go
    // on landing in `fboB` after the warp had already consumed it, so they would reach the canvas one tile-frame
    // late and unwarped rather than not at all. `drawParticles()` binds its own target for exactly that reason.
    const runWarp = (): void => {
      if (slot.transMap.isEnabled()) {
        slot.transMap.apply(texB, fboA);
      } else {
        // No TransMap — copy B to A. Not optional: `fboA` is what the blit-out reads, so skipping it would
        // leave the tile showing the previous tile-frame. It is also what makes the two orders agree when the
        // warp is off, since copy-then-draw-into-A and draw-into-B-then-copy give the same pixels.
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
        gl.viewport(0, 0, TILE_W, TILE_H);
        gl.disable(gl.BLEND);
        gl.useProgram(this.blitProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texB);
        gl.uniform1i(this.uBlitTex, 0);
        gl.bindVertexArray(this.blitVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
      }
    };

    const drawParticles = (): void => {
      // v8 Step 15.1 — liquid replaces the particle draw entirely rather than adding to it. It is its own
      // two-pass pipeline (field, then surface) and it sets its own blend state, so it goes here, inside the
      // same 14.6 permutation slot the point/splat draw occupies: the warp must still be able to run either
      // before or after it, and the surface writes to the same target the point path would have.
      if (slot.renderMode === 4) {
        this.renderLiquidField(slot, slot.beforeParticles ? fboA : fboB, this.lastEffectiveDtSeconds);
        return;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, slot.beforeParticles ? fboA : fboB);
      gl.viewport(0, 0, TILE_W, TILE_H);
      // HONOUR the material's blendMode rather than always going additive. `Ice` — and any material set
      // to 'alpha' — is alpha-blended in the main renderer, where the result is BOUNDED at 1.0. Forcing
      // it additive here let a dense tile sum without bound, so `Miracle Frost` rendered solid white in
      // the grid while looking correct in the main preview: the tile additionally multiplies by
      // FRAME_SKIP and accumulates ~27 frames of trail. Matching the real blend mode is both more
      // faithful to the preset and what removes the saturation.
      gl.enable(gl.BLEND);
      if (slot.materialConfig?.blendMode === 'alpha') {
        // ONE (not SRC_ALPHA) because the shader emits PREMULTIPLIED colour — the same pairing the main
        // renderer uses. SRC_ALPHA would scale an already-premultiplied colour a second time.
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.blendFunc(gl.ONE, gl.ONE);
      }
      this.renderParticles(slot);
    };

    if (slot.beforeParticles) {
      runWarp();
      drawParticles();
    } else {
      drawParticles();
      runWarp();
    }

    // Step 2b: material bloom — DISABLED as a trail-buffer pass.
    //
    // This used to blur fboB into fboA and then additively blend it back onto fboB at 30 %, i.e. it
    // ADDED 30 % OF THE TRAIL BUFFER TO ITSELF every rendered frame. Combined with the fade pass that
    // makes the per-frame gain on existing content `decay^FRAME_SKIP * 1.3`, which DIVERGES for any
    // preset whose `decay^FRAME_SKIP` exceeds 1/1.3 = 0.769 — i.e. any `decayFactor` above ~0.936.
    // `Miracle Frost` ships 0.9877, giving a gain of 1.237 per frame: the tile drew the figure
    // correctly and then compounded it to solid white, which is exactly the reported symptom. Even my
    // 0.96 clamp was above the stability limit.
    //
    // The main renderer never had this problem because it blooms into a SEPARATE output FBO and never
    // writes the result back into the trail buffer. A tile has no spare FBO in its ping-pong pair, and
    // a tile is 256x192 where a 2px blur is barely perceptible anyway — so the honest fix is to drop
    // the pass rather than tune a feedback loop toward the edge of stability.
  }

  private updateFluidSim(slot: SlotState): void {
    const fs = slot.fluidSim!;
    const state = slot.generator.getState();
    const count = state.count;
    const positions = state.positions;
    const gl = this.gl;

    if (!fs.initialized) {
      // First frame: capture positions, skip velocity computation
      for (let i = 0; i < count && i * 2 < fs.prevPositions.length; i++) {
        fs.prevPositions[i * 2] = positions[i * 3]!;
        fs.prevPositions[i * 2 + 1] = positions[i * 3 + 1]!;
      }
      fs.initialized = true;
      return;
    }

    const gridSize = FLUID_GRID;
    const velGrid = fs.velGrid;
    const decay = fs.feedbackConfig.fieldDecay;

    // Decay existing field (compensate for the step: decay^stepFrames per tile-frame)
    const effectiveDecay = Math.pow(decay, this.stepFrames);
    for (let i = 0; i < gridSize * gridSize * 2; i++) {
      velGrid[i]! *= effectiveDecay;
    }

    // Compute velocities with EMA smoothing and scatter into grid
    // Match main loop's 0.08 velocity scale factor; compensate for the step
    // (position deltas are ~stepFrames× larger because we render every Nth frame)
    const VEL_SCALE = 0.08 / this.stepFrames;
    const EMA_FACTOR = 0.3;
    const edgeMargin = 0.03;
    const TELEPORT_THRESHOLD = 900;
    const maxParticles = Math.min(count, fs.prevPositions.length / 2);

    for (let i = 0; i < maxParticles; i++) {
      const px = positions[i * 3]!;
      const py = positions[i * 3 + 1]!;
      const prevX = fs.prevPositions[i * 2]!;
      const prevY = fs.prevPositions[i * 2 + 1]!;

      const dx = px - prevX;
      const dy = py - prevY;
      const dMag = dx * dx + dy * dy;

      // Teleport detection: zero velocity for large jumps (particle reinit)
      const rawVx = dMag < TELEPORT_THRESHOLD ? (dx / TILE_W) * VEL_SCALE : 0;
      const rawVy = dMag < TELEPORT_THRESHOLD ? (dy / TILE_H) * VEL_SCALE : 0;

      // EMA smoothing
      fs.smoothedVel[i * 2] = fs.smoothedVel[i * 2]! * (1 - EMA_FACTOR) + rawVx * EMA_FACTOR;
      fs.smoothedVel[i * 2 + 1] = fs.smoothedVel[i * 2 + 1]! * (1 - EMA_FACTOR) + rawVy * EMA_FACTOR;

      // Update prev positions
      fs.prevPositions[i * 2] = px;
      fs.prevPositions[i * 2 + 1] = py;

      // UV coordinates
      const u = px / TILE_W;
      const v = py / TILE_H;

      // Edge fade (same pattern as main loop)
      const ef = Math.min(u, 1 - u, v, 1 - v) / edgeMargin;
      const fade = ef < 1 ? ef * ef : 1;

      // Grid cell
      const gx = Math.floor(u * gridSize);
      const gy = Math.floor(v * gridSize);
      if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) continue;

      const idx = (gy * gridSize + gx) * 2;
      velGrid[idx] = velGrid[idx]! + fs.smoothedVel[i * 2]! * fade;
      velGrid[idx + 1] = velGrid[idx + 1]! + fs.smoothedVel[i * 2 + 1]! * fade;
    }

    // Single box-blur pass (3×3 kernel, boundary-aware)
    const blurGrid = fs.blurGrid;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let sx = 0, sy = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
              const ni = (ny * gridSize + nx) * 2;
              sx += velGrid[ni]!;
              sy += velGrid[ni + 1]!;
              cnt++;
            }
          }
        }
        const bi = (y * gridSize + x) * 2;
        blurGrid[bi] = sx / cnt;
        blurGrid[bi + 1] = sy / cnt;
      }
    }

    // Copy blurred result back
    velGrid.set(blurGrid);

    // Upload to RG16F texture
    gl.bindTexture(gl.TEXTURE_2D, fs.velTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FLUID_GRID, FLUID_GRID, gl.RG, gl.FLOAT, velGrid);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Feed to TransMap
    const cfg = fs.feedbackConfig;
    slot.transMap.setFluidVelocityTexture(fs.velTexture);
    // `cfg.dispersion` is deliberately NOT passed — dispersion is chain-level state now, set once from the
    // preset in `acquireSlot` rather than per frame from the fluid block (see `setFluidFeedbackParams`).
    slot.transMap.setFluidFeedbackParams(cfg.amplify, cfg.glowBoost);
  }

  private renderParticles(slot: SlotState): void {
    const gl = this.gl;
    const state = slot.generator.getState();
    const renderMode = slot.renderMode;

    const pos2d = new Float32Array(state.count * 2);
    for (let i = 0; i < state.count; i++) {
      pos2d[i * 2] = state.positions[i * 3]!;
      pos2d[i * 2 + 1] = state.positions[i * 3 + 1]!;
    }

    gl.useProgram(this.particleProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pos2d, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.colors, gl.DYNAMIC_DRAW);

    // Upload temperature data (zeros if no material)
    if (renderMode === 3 && state.temperatures && state.temperatures.length >= state.count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.tempBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, state.temperatures, gl.DYNAMIC_DRAW);
    } else {
      // Upload zeros so the attribute doesn't read garbage
      const zeros = new Float32Array(state.count);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.tempBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, zeros, gl.DYNAMIC_DRAW);
    }

    // D16: palette mapping sources. Uploaded unconditionally -- every enabled attribute in the VAO is
    // read by every draw that binds it, so a buffer left short from a previous, larger slot would
    // under-size this draw. ANGLE reports that and then silently DROPS THE WHOLE DRAW, giving a black
    // tile with no JS exception. Both fields are required on GeneratorState, so the length guard is
    // belt-and-braces rather than the padding `lifetimes` would need.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.depthBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      state.depths.length >= state.count ? state.depths : new Float32Array(state.count),
      gl.DYNAMIC_DRAW,
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      state.velocities.length >= state.count ? state.velocities : new Float32Array(state.count),
      gl.DYNAMIC_DRAW,
    );

    gl.uniform2f(this.uResolution, TILE_W, TILE_H);
    gl.uniform1f(this.uGlow, 2.0);
    gl.uniform1i(this.uRenderMode, renderMode);
    // The step's worth of light in one deposit, in the ONE form that keeps the shipped look at any refresh
    // rate. ⚠️ It reads the same `stepFrames` `effectiveDecay` just used — brightness and trail length
    // compensating for different steps is the defect — but NOT as a bare multiplier: see `trailBrightnessFor`,
    // which is anchored so that the tile's steady-state accumulation, not its per-deposit light, is what stays
    // invariant. The bare `this.stepFrames` that stood here is that function's `d -> 1` limit.
    gl.uniform1f(this.uBrightness, trailBrightnessFor(slot.decayFactor, this.stepFrames));
    // Written UNCONDITIONALLY, outside the splat branch below: it applies to all four size branches, and
    // an unset uniform reads 0.0 — which, with the shader's `max(1.0, ...)` floor, would silently pin every
    // tile in the grid to 1 px rather than merely losing the multiplier.
    gl.uniform1f(this.uParticleSize, slot.particleSize);

    // Material splat uniforms
    if (renderMode === 3 && slot.materialConfig) {
      const mc = slot.materialConfig;
      // Match the full renderer's scale formula: (w+h)/(1024+768) — shared with buoyancy/spark
      // gravity so the tile applies ONE factor to every pixel-denominated parameter.
      gl.uniform1f(this.uSplatRadius, mc.splatRadius * SCREEN_SPACE_TILE_SCALE);
      gl.uniform1f(this.uCoreBrightness, mc.coreBrightness);
      gl.uniform1f(this.uHaloStrength, mc.haloStrength);
      gl.uniform1f(this.uFalloffExponent, mc.falloffExponent);
      // Fold the additive brightness compensation into emission rather than adding a uniform: it is
      // dimensionally the same thing (an output multiplier) and the shader already reads this one.
      // 1.0 for alpha materials — see splatBrightnessFor().
      gl.uniform1f(
        this.uEmissionIntensity,
        mc.emissionIntensity * splatBrightnessFor(slot.decayFactor, slot.splatCountRatio, this.stepFrames),
      );
      // Must be set on EVERY splat draw, not just the alpha case: an unset uniform reads 0.0, which
      // would take the premultiply branch and re-introduce the attenuation for additive materials.
      gl.uniform1f(this.uIsAdditive, mc.blendMode === 'alpha' ? 0.0 : 1.0);
    }

    // BOTH samplers are assigned UNCONDITIONALLY, and a texture is always bound to each unit.
    //
    // This program has two sampler2Ds since D16, which changes the rules: an UNASSIGNED sampler defaults
    // to unit 0, colliding with uRampTex, and some drivers then resolve the whole draw to BLACK rather
    // than ignoring the unused sampler. An INCOMPLETE unit samples black for the same reason. The main
    // renderer hit exactly this — its palette assignment sat inside the `palOn` branch, so film look
    // `Legacy` blacked the preview the moment a material was selected. The single-sampler
    // bind-inside-the-branch pattern used before D16 was safe; it is not safe now. `fallbackTex` is a
    // 1x1 white texel so a slot with neither a ramp nor a palette still leaves both units complete.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, slot.rampTexture ?? this.fallbackTex);
    gl.uniform1i(this.uRampTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, slot.paletteTexture ?? this.fallbackTex);
    gl.uniform1i(this.uPaletteTex, 1);
    gl.uniform1i(this.uPaletteEnabled, slot.paletteTexture ? 1 : 0);
    gl.uniform1f(this.uPaletteHueShift, slot.paletteHueShift);
    gl.uniform1i(this.uPaletteMapping, slot.paletteMapping);
    // activeTexture is GLOBAL state and later passes (fade, blur, blit) bind by unit assuming 0.
    gl.activeTexture(gl.TEXTURE0);

    gl.bindVertexArray(this.particleVao);
    gl.drawArrays(gl.POINTS, 0, state.count);
    gl.bindVertexArray(null);
  }

  // Pure-math generator warm-up. No GL, so this is safe to run every frame.
  // Depth-first: a partially warmed tile cannot be displayed, so completing
  // tiles one at a time releases them into the render pool soonest. The
  // deadline caps what any single frame spends.
  private advanceMathWarmup(): void {
    // Spent on EVERY frame, which is what made the absolute reading hurt most: 4 ms is 24 % of a 60 Hz frame
    // but 48 % of a 119.5 Hz one. NOT divided by the throttle — see `tick`'s warm-up exemption.
    const deadline = performance.now() + this.frameSliceMs(MATH_WARM_DUTY);
    for (const slot of this.activeSlots.values()) {
      if (slot.mathWarmRemaining <= 0) continue;
      while (slot.mathWarmRemaining > 0) {
        // ADAPTIVE CHUNK, measured per slot rather than a fixed 50.
        //
        // A fixed `CHUNK = 50` checked the deadline only every 50 updates, and one update costs
        // roughly `particleCount` work — so a heavy tile (20 000 particles / 4 = 5 000) burned ~12 ms
        // in a single unbreakable chunk against a 4 ms budget, then `return`ed. With that tile early in
        // iteration order EVERY later tile was starved on every frame, so the whole grid appeared
        // frozen while the heavy tile alone advanced. Measuring the first small batch and sizing the
        // rest from it keeps any tile interruptible near the deadline.
        const batch = slot.mathWarmChunk > 0
          ? Math.min(slot.mathWarmChunk, slot.mathWarmRemaining)
          : Math.min(4, slot.mathWarmRemaining);
        const t0 = performance.now();
        for (let i = 0; i < batch; i++) slot.generator.update(16.667);
        const elapsed = performance.now() - t0;
        slot.mathWarmRemaining -= batch;
        // One `update(16.667)` is one frame of phase, so the counter and the argument agree by construction
        // here. The steady pass has to convert, and does so at its own site.
        slot.phaseFrames += batch;
        // Calibrate: aim each chunk at ~1 ms so the deadline is honoured within ~1 ms.
        if (slot.mathWarmChunk === 0 && elapsed > 0) {
          slot.mathWarmChunk = Math.max(1, Math.min(50, Math.floor(batch / elapsed)));
        }
        if (performance.now() >= deadline) return;
      }
    }
  }

  /**
   * This frame's slice of a duty cycle, in ms. See the note above `MATH_WARM_BUDGET_MS` for why the absolute
   * per-step reading was the defect and why a duty cycle is the fix.
   *
   * ⚠️ **The EMA, not the frame — deliberately.** Using `frameMs` would make the budget PROPORTIONAL TO ITS
   * OWN EFFECT: the grid's cost lands in the frame that measures it, so an expensive frame would grant the
   * next one a larger slice, which is positive feedback ending at the stall clamp. The EMA over ~1/3 s breaks
   * that loop, and it is seeded at `NOMINAL_FRAME_MS`, so a 60 Hz machine gets a budget whose product with
   * the frame rate is byte-identical to what this file shipped with.
   */
  private frameSliceMs(duty: number): number {
    return duty * this.frameMsEma;
  }

  // Derive the concurrent-slot ceiling from measured per-tile cost. EMA-smoothed
  // so one janky frame (GC, tab refocus, a compositor hiccup) cannot collapse
  // the cap; the cap only shrinks the pool, already-acquired slots are left
  // alone and drain naturally as tiles scroll out.
  private updateSlotCap(costPerTile: number): void {
    if (!(costPerTile > 0) || !Number.isFinite(costPerTile)) return;
    this.tileCostMs = this.tileCostMs === 0
      ? costPerTile
      : this.tileCostMs * 0.9 + costPerTile * 0.1;

    // Relax the demand high-water mark toward current usage, so shrinking the
    // window (or leaving the grid) eventually lets the cost-based cap apply
    // again instead of the peak ratcheting up permanently.
    if (this.peakConcurrentDemand > this.activeSlots.size) {
      this.peakConcurrentDemand -= (this.peakConcurrentDemand - this.activeSlots.size) * 0.01;
    }

    // ⚠️ The throttle is deliberately ABSENT here. The cap governs how many slots may EXIST, and evicting a
    // visible tile leaves it frozen on its last frame for as long as it stays on screen (`releaseSlot` does
    // not clear the canvas) — a permanent answer to a transient reading. The throttle costs frame rate; only
    // measured per-tile cost may cost a slot.
    const affordable = Math.floor(STEADY_COST_TARGET_MS / this.tileCostMs);
    // Demand floor: never cap below what is currently on screen, else acquiring
    // one visible tile evicts another and the grid thrashes. Cost only decides
    // how much headroom to keep beyond the visible set.
    //
    // ⚠️ `demandFloor()` rather than the expression it used to hold inline, because `acquireSlot` now asks the
    // same question at the moment of eviction — see the note there. This value is a SNAPSHOT taken once per
    // blit; the one that governs an eviction has to be live.
    this.slotCap = Math.max(this.demandFloor(), Math.min(MAX_SLOTS, affordable));
  }

  private blitToCanvases(): void {
    const gl = this.gl;

    for (const slot of this.activeSlots.values()) {
      // Only tiles that re-rendered this tick need a readback. readPixels is a
      // synchronous GPU→CPU stall, so skipping unchanged tiles is the main
      // saving: a tile the steady budget skipped keeps its last frame on canvas
      // instead of paying to re-read identical pixels.
      if (!slot.needsBlit) continue;
      slot.needsBlit = false;

      // Tonemap blit: RGBA16F → RGBA8 readback FBO (Reinhard prevents white saturation)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.readbackFbo);
      gl.viewport(0, 0, TILE_W, TILE_H);
      gl.disable(gl.BLEND);
      gl.useProgram(this.tonemapProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.slotTexA[slot.index]!);
      gl.uniform1i(this.uTonemapTex, 0);
      gl.bindVertexArray(this.tonemapVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);

      // Now readPixels from the RGBA8 readback FBO
      gl.readPixels(0, 0, TILE_W, TILE_H, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelBuffer);

      // Reuse ONE `ImageData` for every tile instead of allocating a fresh one per tile per tick.
      //
      // Every tile is exactly TILE_W x TILE_H, so a single buffer serves all of them, and the row loop
      // below overwrites all of it — there is no stale data to carry between tiles. The old code
      // allocated 196 KB per tile per tick (up to 32 of them, all immediately garbage) purely to have
      // somewhere to flip into. Lazily created so a renderer that never blits allocates nothing.
      //
      // ⚠️ `readPixels` deliberately still targets the `Uint8Array` staging buffer rather than
      // `imageData.data` directly. Reading straight in would remove this copy, but the WebGL2 spec pairs
      // `UNSIGNED_BYTE` readback with `Uint8Array`, and a rejected `Uint8ClampedArray` would raise
      // `INVALID_OPERATION` and leave the tile UNPAINTED — a silent blank tile, not an exception. Not
      // worth one memcpy of 196 KB.
      const imageData = this.tileImageData ?? (this.tileImageData = new ImageData(TILE_W, TILE_H));

      // GL's origin is bottom-left and the canvas's is top-left, so the rows arrive inverted.
      for (let r = 0; r < TILE_H; r++) {
        const srcRow = (TILE_H - 1 - r) * TILE_W * 4;
        const dstRow = r * TILE_W * 4;
        imageData.data.set(this.pixelBuffer.subarray(srcRow, srcRow + TILE_W * 4), dstRow);
      }

      const ctx = slot.canvas.getContext('2d');
      if (ctx) ctx.putImageData(imageData, 0, 0);
    }
  }

  dispose(): void {
    const gl = this.gl;
    for (const slot of this.activeSlots.values()) {
      slot.generator.dispose();
      slot.transMap.dispose();
      if (slot.rampTexture) gl.deleteTexture(slot.rampTexture);
      if (slot.paletteTexture) gl.deleteTexture(slot.paletteTexture);
      if (slot.fluidSim) gl.deleteTexture(slot.fluidSim.velTexture);
      if (slot.liquid?.rampTexture) gl.deleteTexture(slot.liquid.rampTexture);
    }
    this.activeSlots.clear();
    this.freePool = [];
    // Nothing leaks if this survives — it holds numbers, not handles — but `dispose()` means "this renderer
    // remembers nothing", and a phase resumed across a context loss would be a figure resuming out of a
    // renderer that no longer exists.
    this.phaseCache.clear();

    // Indexed to MAX_SLOTS with a null check per entry, NOT over the arrays' own length: since H16 made
    // allocation lazy these are SPARSE, so `length` is the high-water index and the entries below it may
    // be holes. Cleared afterwards so a hole and a released handle are the same thing to `ensureSlot()` —
    // otherwise a re-`init()` would see a truthy but DELETED framebuffer and skip rebuilding it.
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (this.slotFboA[i]) gl.deleteFramebuffer(this.slotFboA[i]!);
      if (this.slotFboB[i]) gl.deleteFramebuffer(this.slotFboB[i]!);
      if (this.slotTexA[i]) gl.deleteTexture(this.slotTexA[i]!);
      if (this.slotTexB[i]) gl.deleteTexture(this.slotTexB[i]!);
    }
    this.slotFboA = [];
    this.slotFboB = [];
    this.slotTexA = [];
    this.slotTexB = [];

    if (this.readbackFbo) gl.deleteFramebuffer(this.readbackFbo);
    if (this.readbackTex) gl.deleteTexture(this.readbackTex);
    if (this.particleProgram) gl.deleteProgram(this.particleProgram);
    if (this.particleVao) gl.deleteVertexArray(this.particleVao);
    if (this.posBuffer) gl.deleteBuffer(this.posBuffer);
    if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer);
    if (this.tempBuffer) gl.deleteBuffer(this.tempBuffer);
    if (this.depthBuffer) gl.deleteBuffer(this.depthBuffer);
    if (this.velBuffer) gl.deleteBuffer(this.velBuffer);
    if (this.fallbackTex) gl.deleteTexture(this.fallbackTex);
    if (this.fadeProgram) gl.deleteProgram(this.fadeProgram);
    if (this.fadeVao) gl.deleteVertexArray(this.fadeVao);
    if (this.blitProgram) gl.deleteProgram(this.blitProgram);
    if (this.blitVao) gl.deleteVertexArray(this.blitVao);
    if (this.blurBlitProgram) gl.deleteProgram(this.blurBlitProgram);
    if (this.blurBlitVao) gl.deleteVertexArray(this.blurBlitVao);
    if (this.tonemapProgram) gl.deleteProgram(this.tonemapProgram);
    if (this.tonemapVao) gl.deleteVertexArray(this.tonemapVao);

    // v8 Step 15.1 — the shared liquid scratch, deleted AND nulled (invariant 1): `init()` does not
    // reassign these, `ensureLiquid()` does, and it tests `this.liquidFbo` to decide whether it already ran.
    // A stale non-null handle after dispose would make it skip the rebuild and then draw into a dead FBO.
    if (this.liquidFbo) gl.deleteFramebuffer(this.liquidFbo);
    if (this.liquidTex) gl.deleteTexture(this.liquidTex);
    if (this.liquidColorTex) gl.deleteTexture(this.liquidColorTex);
    if (this.liquidAccProgram) gl.deleteProgram(this.liquidAccProgram);
    if (this.liquidAccVao) gl.deleteVertexArray(this.liquidAccVao);
    if (this.liquidAccPosBuffer) gl.deleteBuffer(this.liquidAccPosBuffer);
    if (this.liquidAccColorBuffer) gl.deleteBuffer(this.liquidAccColorBuffer);
    if (this.liquidSurfProgram) gl.deleteProgram(this.liquidSurfProgram);
    if (this.liquidSurfVao) gl.deleteVertexArray(this.liquidSurfVao);
    this.liquidFbo = null;
    this.liquidTex = null;
    this.liquidColorTex = null;
    this.liquidAccProgram = null;
    this.liquidAccVao = null;
    this.liquidAccPosBuffer = null;
    this.liquidAccColorBuffer = null;
    this.liquidSurfProgram = null;
    this.liquidSurfVao = null;
    this.uLiqAccResolution = null;
    this.uLiqAccSize = null;
    this.uLiqSurfDensity = null;
    this.uLiqSurfRamp = null;
    this.uLiqSurfPalette = null;
    this.uLiqSurfIsoRef = null;
    this.uLiqSurfThickRef = null;
    this.uLiqSurfSoftness = null;
    this.uLiqSurfTintSource = null;
    this.uLiqSurfPaletteEnabled = null;
    this.uLiqSurfResolution = null;
    this.uLiqSurfTint = null;
    this.uLiqSurfColor = null;
    this.uLiqSurfColourMix = null;
    this.uLiqSurfMixModel = null;
    this.uLiqSurfRefraction = null;
    this.uLiqSurfSpecular = null;
    this.uLiqSurfThickness = null;
    this.uLiqSurfEdgeBright = null;
    this.uLiqSurfRadius = null;
    // `liquidUnavailable` is deliberately NOT reset: it records a property of the GL CONTEXT (no
    // EXT_color_buffer_float), and the context outlives this object. Clearing it would make every
    // dispose()/init() cycle re-probe and re-warn on a machine that will never support the mode.
  }

  // --- v8 Step 15.1: the tile's liquid field ---

  /**
   * Build the ONE shared R32F field, its two programs and their VAOs, on first use. Returns false if this
   * context cannot do it, in which case the caller renders the slot as mode 2.
   *
   * ⚠️ **The refusal path is `initLiquid`'s in the main renderer and is not optional** (invariant 5): an
   * incomplete R32F FBO throws nothing and logs nothing, every draw into it merely sets
   * `INVALID_FRAMEBUFFER_OPERATION`, the field stays all zeros, the surface pass thresholds zero against a
   * positive threshold and discards everything — so the tile would be permanently BLANK with a clean console.
   * That is indistinguishable from "the preset draws nothing", which is why it warns once and falls back to a
   * mode that does draw.
   */
  private ensureLiquid(): boolean {
    if (this.liquidUnavailable) return false;
    if (this.liquidFbo && this.liquidAccProgram && this.liquidSurfProgram) return true;
    const gl = this.gl;

    if (!gl.getExtension('EXT_color_buffer_float')) {
      console.warn('PSSS: EXT_color_buffer_float not available; grid tiles render liquid presets as star');
      this.liquidUnavailable = true;
      return false;
    }

    this.liquidTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, TILE_W, TILE_H, 0, gl.RED, gl.FLOAT, null);
    // LINEAR, as the main renderer's field is, and for the same load-bearing reason: the surface pass takes
    // a 4-tap gradient of this texture, and NEAREST makes that gradient a staircase, which bands the shading.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // v8 Step 15.2's colour target. Created BEFORE the status check and torn down on the same failure path:
    // it is an attachment of the same FBO, so it can itself be the reason the FBO is incomplete, and a check
    // that ran before the second attachment would report COMPLETE for a framebuffer the draw then fails on.
    this.liquidColorTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.liquidColorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, TILE_W, TILE_H, 0, gl.RGBA, gl.HALF_FLOAT, null);
    // LINEAR, matching the density field: the surface pass reads both at the same uv, and two co-sampled
    // fields with different filters make the tint step where the silhouette does not.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.liquidFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.liquidFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.liquidTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.liquidColorTex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn(
        `PSSS: tile liquid field incomplete (0x${status.toString(16)}); grid tiles render liquid presets as star`,
      );
      gl.deleteFramebuffer(this.liquidFbo);
      gl.deleteTexture(this.liquidTex);
      gl.deleteTexture(this.liquidColorTex);
      this.liquidFbo = null;
      this.liquidTex = null;
      this.liquidColorTex = null;
      this.liquidUnavailable = true;
      return false;
    }

    // ⚠️ **Its OWN buffers and VAO, not `this.particleVao`.** The particle VAO has five enabled attributes
    // bound at the PARTICLE program's locations; a second program declaring its own attributes has no reason
    // to receive the same numbers, and a VAO/program location mismatch makes ANGLE silently DROP the whole
    // draw — a blank tile, no exception. Owning the VAO is what makes the pins below SAFE rather than a guess:
    // this program's `layout(location = …)` and the `vertexAttribPointer` indices are two spellings of the
    // same private numbering, written twenty lines apart in one function.
    //
    // ⚠️ **That is why the tile pins and the main renderer does NOT** (v8 15.2, `hdr-particle.ts`): there the
    // accumulation program borrows the MAIN program's VAO, so the numbers belong to the linker and have to be
    // read back with `getAttribLocation` rather than assumed. Same defect class, opposite correct answer —
    // the discriminator is who owns the VAO, not which spelling looks tidier.
    const ACC_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec3 aColor;
uniform vec2 uResolution;
uniform float uSize;
out vec3 vColor;
void main() {
  vec2 ndc = (aPosition / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = max(1.0, uSize);
  vColor = aColor;
}`;
    // WYVILL (1-r2)^3, verbatim from the main renderer. NOT a Gaussian: exp(-k*r2) is non-zero at the sprite
    // boundary, so each sprite would add a step at its own square edge. Compact support is also what makes
    // the pi*R^2/4 frame-mean integral exact rather than approximate.
    // NOTE: no backticks anywhere in this template literal — invariant 18.
    // v8 Step 15.2 — TWO outputs, verbatim in shape from the main renderer: outColor carries the numerator
    // and denominator of the weighted mean so the surface pass can divide them. `w` is computed ONCE and used
    // three times; a second spelling of (1-r2)^3 is what desynchronises the two.
    const ACC_FRAG = `#version 300 es
precision highp float;
in vec3 vColor;
layout(location = 0) out float outDensity;
layout(location = 1) out vec4 outColor;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float r2 = dot(pc, pc) * 4.0;
  float u = 1.0 - r2;
  float w = r2 < 1.0 ? u * u * u : 0.0;
  outDensity = w;
  outColor = vec4(vColor * w, w);
}`;
    this.liquidAccProgram = compileProgram(gl, ACC_VERT, ACC_FRAG, 'GridTile liquid accumulate');
    this.uLiqAccResolution = gl.getUniformLocation(this.liquidAccProgram, 'uResolution');
    this.uLiqAccSize = gl.getUniformLocation(this.liquidAccProgram, 'uSize');

    this.liquidAccVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.liquidAccVao);
    this.liquidAccPosBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.liquidAccPosBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // v8 Step 15.2. ⚠️ **BOTH attributes are enabled here and BOTH are uploaded every frame** — invariant 6:
    // an enabled attribute with no bound data reads undefined values, which on some drivers is stale GPU
    // memory rather than zero, so the colour field would carry whatever the last draw left behind.
    this.liquidAccColorBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.liquidAccColorBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const SURF_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
    // The threshold, the gradient and the tint — the main renderer's surface shader, reduced to what a
    // 256x192 tile can show. Two deliberate omissions, both C7 fidelity trades rather than oversights: no
    // `uBrightness = FRAME_SKIP` multiplier (this pass OCCLUDES, so its output is bounded at 1.0 by
    // construction and a brightness lift would only clip the tint), and the diffuse term is the same fixed
    // key light.
    //
    // ⚠️ The gradient steps in TEXEL units via `uResolution`, never in `vUv` (invariant 26) — `vUv`'s two
    // axes are TILE_W and TILE_H pixels per unit, and a tile is 4:3, so a `vUv` offset would tilt the
    // lighting by the tile aspect. That the tile aspect is fixed makes it a CONSTANT error, i.e. one that
    // would look deliberate.
    //
    // ⚠️ **`uThickRef` IS A SECOND, INDEPENDENT SCALE AND MUST NOT BE FOLDED BACK INTO `uIsoRef`** (v8 15.1b).
    // Both come from one density reference, but the threshold is `isoLevel ×` it while the ramp coordinate is
    // `LIQUID_THICKNESS_DEPTH ×` it — sharing one number is exactly the 15.1 defect: raising Iso Level then
    // eroded the silhouette AND dragged every survivor to `thickness = 0`, so the two losses multiplied and
    // the surface went dark rather than merely smaller.
    const SURF_FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uDensity;
uniform sampler2D uRamp;
uniform sampler2D uPalette;
uniform sampler2D uColorField;
uniform float uIsoRef;
uniform float uThickRef;
uniform float uSoftness;
uniform float uColourMix;
uniform int uTintSource;
uniform int uPaletteEnabled;
// v8 26.4 -- palette hue rotation in TURNS, mirroring the main renderer. No backticks in this comment.
uniform float uPaletteHueShift;
uniform int uMixModel;
uniform vec2 uResolution;
uniform vec3 uTint;
// v8 Step 15.3 — the surface material. 'uRadius' is the tile's OWN clamped sprite radius, so the dispersion
// offset is a fraction of the kernel the tile actually drew (see REFRACT_SPREAD).
uniform float uRefraction;
uniform float uSpecular;
uniform float uThickness;
uniform float uEdgeBright;
uniform float uRadius;
in vec2 vUv;
out vec4 fragColor;
float thicknessAt(vec2 uv) {
  return clamp((texture(uDensity, uv).r - uIsoRef) / max(uThickRef, 1e-6), 0.0, 1.0);
}
void main() {
  float d = texture(uDensity, vUv).r;
  float halfW = max(uSoftness, 0.0) * uIsoRef;
  float cover = halfW > 0.0
    ? smoothstep(uIsoRef - halfW, uIsoRef + halfW, d)
    : (d >= uIsoRef ? 1.0 : 0.0);
  if (cover <= 0.0) discard;
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));
  float dxp = texture(uDensity, vUv + vec2(texel.x, 0.0)).r;
  float dxm = texture(uDensity, vUv - vec2(texel.x, 0.0)).r;
  float dyp = texture(uDensity, vUv + vec2(0.0, texel.y)).r;
  float dym = texture(uDensity, vUv - vec2(0.0, texel.y)).r;
  vec3 n = normalize(vec3(-(dxp - dxm), -(dyp - dym), max(uThickRef, 1e-6) * 0.5));
  float thickness = thicknessAt(vUv);
  // v8 Step 15.3 — refraction deepens the ramp INDEX, so it is resolved before the tint, exactly as in the
  // main renderer. Under 'preset' there is no LUT to shift and it reaches the image through scatter only.
  float refract = thickness * clamp(uRefraction, 0.0, 1.0);
  float rampAt = clamp(thickness + refract, 0.0, 1.0);
  vec3 tint;
  if (uTintSource == 1 && uPaletteEnabled == 1) {
    // v8 26.4 -- rotated, and ZERO IS BYTE-IDENTICAL: the sampler is CLAMP_TO_EDGE, so an
    // unconditional wrap would move the top edge on every palette preset carrying no rotation.
    float rampC = uPaletteHueShift == 0.0 ? rampAt : fract(rampAt + uPaletteHueShift);
    tint = texture(uPalette, vec2(rampC, 0.5)).rgb;
  } else if (uTintSource == 2 || uTintSource == 3) {
    tint = texture(uRamp, vec2(clamp(rampAt, 0.01, 0.99), 0.5)).rgb;
  } else {
    tint = uTint;
  }
  // v8 Step 15.2 — the same arithmetic as the main renderer's surface shader, which is a REQUIREMENT rather
  // than a copy: a tile that mixed differently would make the grid a misleading preview of the very control
  // it is showing. Divisor is uColorField's OWN alpha, never d -- the two are the same sum in different
  // formats, and the own-alpha ratio keeps only their CORRELATED half-float error (measured: -0.53% against
  // -2.52% at 2048 contributors, growing with the count either way). Guarded because LINEAR filtering can
  // round numerator and denominator both to 0 at the rim, and 0/0 is NaN.
  vec4 cf = texture(uColorField, vUv);
  float wSum = cf.a;
  vec3 perParticle = wSum > 1e-6 ? cf.rgb / wSum : tint;
  vec3 mixed = perParticle;
  if (uMixModel == 1) {
    float layers = clamp(1.0 + 0.6 * log2(max(wSum, 1.0)), 1.0, 3.0);
    mixed = clamp(pow(clamp(perParticle, 0.0, 1.0), vec3(layers)), 0.0, 1.0);
  }
  // Source 4 (dye) is exempt -- see the long note at the main renderer's copy of this line. It is DEAD CODE
  // here, buildLiquidState() degrading dye to 3 by decision, and it is written anyway so the two shaders
  // (no backticks -- this comment is inside a template literal, invariant 18)
  // stay CHARACTER-IDENTICAL: this arithmetic is what the grid previews for the colourMix slider -- labelled
  // Figure Colour in the UI since 15.9a, and named here by its KEY because that is the stable half -- and a
  // tile that mixed differently would preview the wrong answer for the one control it is showing.
  float mixAmt = (uTintSource == 4) ? 0.0 : uColourMix;
  tint = mix(tint, mixed, clamp(mixAmt, 0.0, 1.0));
  vec3 lightDir = normalize(vec3(-0.35, -0.55, 0.75));
  float diff = 0.55 + 0.45 * clamp(dot(n, lightDir), 0.0, 1.0);
  vec3 col = tint * diff;
  // v8 Step 15.3 — the four material terms, in the main renderer's order and with its constants, which
  // 'fieldcheck' §O asserts CHARACTER-IDENTICALLY. The four constants are interpolated from
  // 'renderers/liquid-reference.ts' rather than transcribed, so there is exactly one copy of each digit.
  if (uRefraction > 0.0) {
    vec2 dispDir = n.xy * (${glslFloat(REFRACT_SPREAD)} * uRefraction * uRadius) * texel;
    float tR = thicknessAt(vUv + dispDir);
    float tB = thicknessAt(vUv - dispDir);
    vec3 disp = vec3(tR - thickness, 0.0, tB - thickness) * 0.5;
    col *= clamp(vec3(1.0) + disp, 0.0, 2.0);
  }
  col += tint * refract * 1.15;
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfV = normalize(lightDir + viewDir);
  col += vec3(pow(max(dot(n, halfV), 0.0), ${glslFloat(SPEC_EXPONENT)}) * max(uSpecular, 0.0));
  float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), ${glslFloat(FRESNEL_EXPONENT)});
  col += mix(tint, vec3(1.0), 0.6) * fres * max(uEdgeBright, 0.0);
  col *= exp(-thickness * max(uThickness, 0.0) * ${glslFloat(ABSORB_SCALE)});
  col = clamp(col, 0.0, 64.0);
  fragColor = vec4(col * cover, cover);
}`;
    this.liquidSurfProgram = compileProgram(gl, SURF_VERT, SURF_FRAG, 'GridTile liquid surface');
    this.uLiqSurfDensity = gl.getUniformLocation(this.liquidSurfProgram, 'uDensity');
    this.uLiqSurfRamp = gl.getUniformLocation(this.liquidSurfProgram, 'uRamp');
    this.uLiqSurfPalette = gl.getUniformLocation(this.liquidSurfProgram, 'uPalette');
    this.uLiqSurfIsoRef = gl.getUniformLocation(this.liquidSurfProgram, 'uIsoRef');
    this.uLiqSurfThickRef = gl.getUniformLocation(this.liquidSurfProgram, 'uThickRef');
    this.uLiqSurfSoftness = gl.getUniformLocation(this.liquidSurfProgram, 'uSoftness');
    this.uLiqSurfTintSource = gl.getUniformLocation(this.liquidSurfProgram, 'uTintSource');
    this.uLiqSurfPaletteEnabled = gl.getUniformLocation(this.liquidSurfProgram, 'uPaletteEnabled');
    this.uLiqSurfResolution = gl.getUniformLocation(this.liquidSurfProgram, 'uResolution');
    this.uLiqSurfTint = gl.getUniformLocation(this.liquidSurfProgram, 'uTint');
    this.uLiqSurfColor = gl.getUniformLocation(this.liquidSurfProgram, 'uColorField');
    this.uLiqSurfColourMix = gl.getUniformLocation(this.liquidSurfProgram, 'uColourMix');
    this.uLiqSurfMixModel = gl.getUniformLocation(this.liquidSurfProgram, 'uMixModel');
    // v8 Step 15.3
    this.uLiqSurfRefraction = gl.getUniformLocation(this.liquidSurfProgram, 'uRefraction');
    this.uLiqSurfSpecular = gl.getUniformLocation(this.liquidSurfProgram, 'uSpecular');
    this.uLiqSurfThickness = gl.getUniformLocation(this.liquidSurfProgram, 'uThickness');
    this.uLiqSurfEdgeBright = gl.getUniformLocation(this.liquidSurfProgram, 'uEdgeBright');
    this.uLiqSurfRadius = gl.getUniformLocation(this.liquidSurfProgram, 'uRadius');
    this.liquidSurfVao = this.createQuadVAO(gl, this.liquidSurfProgram);
    return true;
  }

  /**
   * Resolve a liquid slot's own snapshot of `overlay.liquid`.
   *
   * ⚠️ **The `?? DEFAULT` merge is per FIELD, not per block** (invariant 14): a preset carrying a partial
   * `liquid` block — which an older export or a hand-edited file can — must inherit the missing fields from
   * `DEFAULT_LIQUID_CONFIG`, not `undefined`. An `undefined` reaching `gl.uniform1f` becomes NaN, every
   * threshold comparison is then false, and the tile is blank with nothing logged.
   */
  private buildLiquidState(
    gl: WebGL2RenderingContext,
    preset: UnifiedPreset,
    materialConfig: MaterialConfig | null,
    paletteLive: boolean,
  ): TileLiquidState {
    const cfg = { ...DEFAULT_LIQUID_CONFIG, ...(preset.overlay?.liquid ?? {}) };

    // The same degradation the main renderer applies: `material` with no live material falls back to the
    // config's own `surfaceRamp` rather than to one flat colour, mirroring `paletteMapping === 3`.
    const materialActive = !!materialConfig && materialConfig.preset !== 'None';
    let effSource: LiquidTintSource = cfg.tintSource;
    if (effSource === 'material' && !materialActive) effSource = 'ramp';
    // ⚠️ **v8 Step 15.7 — `dye` DEGRADES TO `ramp` HERE ON PURPOSE: a tile runs NO dye field.** It would
    // fall through to 3 anyway, but stating it is the point — a silent fall-through reads as coverage.
    //
    // The measurement that rejected wiring one (2026-09-03, from this file's own constants and
    // `dye-field.ts`'s `DYE_SIZE = 512`): a 512² RGBA16F ping-pong pair is **4.00 MiB per slot**, i.e.
    // **5.3× the ENTIRE existing 768 KiB slot pair**, reaching **504 MiB at the 126 slots a 4K window
    // demands**; the advect pass alone is **5.33× the tile's own 256×192 fragment count** every rendered
    // tick, on top of a splat pass over ≤`MAX_TILE_PARTICLES`. `slotCap = floor(8.0 / tileCostMs)` halves
    // from 16 slots to 8 if per-tile cost merely reaches 1.0 ms, so the cost is paid in EVICTIONS, not fps.
    // Against that: **0 of 214** preset entries author `overlay.dye` or `tintSource: 'dye'`, so no library
    // tile would look different today. If tiles are ever wanted, use a REDUCED field (128² = 0.33× the
    // tile's fill, 0.25 MiB/slot, 32 MiB at 128 slots) — never 512². ⚠️ **The omission is stated in the
    // Dye Field section's inline hint ("preview tiles never dye"), which is where a user can see it.**
    if (effSource === 'dye') effSource = 'ramp';
    const tintSource = effSource === 'preset' ? 0 : effSource === 'palette' ? 1 : effSource === 'material' ? 2 : 3;
    // Palette chosen with no palette live falls to `preset` — what the shader's else-branch does anyway, but
    // resolving it here keeps the uniform honest for anything that reads it back.
    const resolved = (tintSource === 1 && !paletteLive) ? 0 : tintSource;

    let rampTexture: WebGLTexture | null = null;
    if (resolved === 2 || resolved === 3) {
      const name = resolved === 2 ? (materialConfig!.colourRamp) : cfg.surfaceRamp;
      rampTexture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, rampTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, getColourRampData(name));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    return {
      // ⚠️ No `SCREEN_SPACE_TILE_SCALE` on any of the three — all dimensionless, and the tile factor already
      // lives in `renderLiquidField`'s `scaleFactor`. See `SlotState.liquid` for the measurement that
      // rejected pre-scaling Kernel Width (the sprite pinned at the 1 px floor over half its range).
      kernelWidth: cfg.kernelWidth,
      isoLevel: cfg.isoLevel,
      edgeSoftness: cfg.edgeSoftness,
      refSmoothed: 0,
      tintSource: resolved,
      // v8 Step 15.2. Also dimensionless — a weight and a categorical — so neither takes a tile factor.
      colourMix: cfg.colourMix,
      mixModel: cfg.mixModel === 'pigment' ? 1 : 0,
      // v8 Step 15.3. Verbatim, for the same reason: four dimensionless magnitudes.
      refraction: cfg.refraction,
      specular: cfg.specular,
      thickness: cfg.thickness,
      edgeBrightness: cfg.edgeBrightness,
      rampTexture,
    };
  }

  /**
   * Accumulate the Wyvill field for one liquid slot and shade its surface into the currently bound FBO.
   *
   * ⚠️ **The field is CLEARED here, per slot, and that is required rather than tidy**: the R32F texture is
   * shared by the whole grid, so a field left by the previous slot in this tick would show through as a ghost
   * of another preset's figure.
   *
   * ⚠️ **`uIsoRef` is derived from the TILE's own count, area and index spacing**, which is exactly why Iso
   * Level needs no tile scaling: `liquidDensityReference()` re-derives the reference at 2000 particles over
   * 256x192 just as the main renderer does at 20 000 over 1920x1080, so the same authored ratio means the same
   * picture. The radius passed in must be the one the sprite actually drew at (`max(1.0, ...)` in the vertex
   * shader), or the normalisation quietly stops holding — invariant 10 at a subsystem boundary.
   *
   * ⚠️ **The reference arithmetic is NOT re-implemented here — `renderers/liquid-reference.ts` is its ONE
   * owner** (v8 15.1b). The tile previously carried its own copy of `dMean`, which is precisely the shape that
   * lets a tile drift from the view it previews: the on-curve term reads a MEASURED spacing, so a second
   * transcription would have two chances to disagree about the chain-break rule alone.
   *
   * @param dtSeconds the tile's own effective step in SECONDS. ⚠️ **`tick(dt)` receives MILLISECONDS and a
   *   tile renders one frame in `FRAME_SKIP`, so the caller passes `effectiveDt * 0.001` — the same product
   *   the generator is advanced by.** τ is wall-clock, so a tile smoothing at 1/4 the frame rate must see 4×
   *   the step or its reference lags four times as long as the main view's.
   */
  private renderLiquidField(slot: SlotState, target: WebGLFramebuffer, dtSeconds: number): void {
    const gl = this.gl;
    const liq = slot.liquid;
    if (!liq || !this.liquidFbo || !this.liquidTex || !this.liquidColorTex || !this.liquidAccProgram
        || !this.liquidAccVao || !this.liquidSurfProgram || !this.liquidSurfVao) return;

    const state = slot.generator.getState();
    // The crystal block is the TRAILING part of the published arrays and is drawn by its own pass in the
    // main renderer; a tile has no crystal pass, so excluding it here keeps the liquid field over the wave
    // and spark slots only — the same truncation `render()` does with `solidCount`.
    const solidCount = Math.max(0, state.count - (state.crystalCount ?? 0));
    if (solidCount === 0) return;
    /*
     * v8 `15.6-salvage` B (2026-09-03) — the population the density REFERENCE is measured over, EXCLUDING both
     * tail blocks. ⚠️ **A TILE MUST RESOLVE THIS THE SAME WAY `main.ts`/`hdr-particle.ts` DOES, or an authored
     * Iso Level means two different things in the two places** — which is the tile rule in `CLAUDE.md`, and it
     * is the whole reason `liquidDensityReference()` is a shared owner rather than two transcriptions.
     *
     * ⚠️ **This site was WORSE than the main renderer's: it passed `solidCount`, excluding NEITHER the sparks
     * nor the pool.** `measureIndexSpacing()` walks consecutive indices, so it ran across the wave→spark
     * boundary and through both tail blocks, whose adjacent indices hold unrelated positions — inflating `s`,
     * driving `(32/35)·R/s` down, and handing the threshold to the frame-mean lower bound. A tile shows a
     * preset with a `sparks` block the moment a material is authored into it, so this was reachable from the
     * library rather than only by hand.
     *
     * The fallback keeps the previous expression for a generator publishing no partition, where *"absent means
     * the whole array is wave particles"* and the two agree by construction.
     */
    const curveCount = state.waveCount !== undefined
      ? Math.min(state.waveCount, solidCount)
      : Math.max(0, solidCount - (state.liquidCount ?? 0));

    const pos2d = new Float32Array(solidCount * 2);
    for (let i = 0; i < solidCount; i++) {
      pos2d[i * 2] = state.positions[i * 3]!;
      pos2d[i * 2 + 1] = state.positions[i * 3 + 1]!;
    }
    // v8 Step 15.2. `state.colors` is grow-only reused scratch, so `.length` overstates the live population
    // (invariant 7) — the `subarray` keeps the upload the same length as the draw. The fallback matters for
    // more than tidiness: a buffer left SHORT by this draw is one ANGLE reports and then silently DROPS,
    // which here would take the density write down with it, both attachments coming from the one draw.
    const colors = state.colors.length >= solidCount * 3
      ? state.colors.subarray(0, solidCount * 3)
      : new Float32Array(solidCount * 3);

    // The main renderer's `liquidPointDiameter()`, term for term: base 8.0 (NOT star's 5.0 — metaballs merge
    // only where fields overlap, and a radius below the inter-particle spacing gives separate discs at every
    // Iso Level), times the canvas-scale factor, times the preset's particle size, times Kernel Width. Both
    // trailing factors are dimensionless and enter UNSCALED; `scaleFactor` is the only tile reduction, and it
    // is numerically identical to `SCREEN_SPACE_TILE_SCALE` at this tile size, which is exactly why a second
    // one would be invisible rather than obviously wrong — see `SlotState.liquid`.
    const scaleFactor = (TILE_W + TILE_H) / (1024.0 + 768.0);
    const diameter = Math.max(1.0, 8.0 * scaleFactor * slot.particleSize * liq.kernelWidth);
    const radius = diameter * 0.5;
    // ⚠️ The SPACING is measured in the TILE's own pixels and must not be scaled either — `state.positions`
    // here is already the tile generator's projection at 256x192, so the ratio `R/spacing` is dimensionless
    // and self-consistent. Converting it to main-view pixels would break exactly the property that makes an
    // authored Iso Level mean one thing in both places.
    // ⚠️ `curveCount`, not `solidCount` — see its derive above. BOTH arguments move together: the spacing and
    // the count are two terms of one reference (`max(onCurve, frameMean)`), so measuring the spacing over the
    // curve while counting the tail blocks would raise the frame-mean arm by the population the on-curve arm
    // was just told to ignore. Invariant 27's shape — a scale and its basis are two quantities.
    const spacing = measureIndexSpacing(state.positions, curveCount);
    const measuredRef = liquidDensityReference(curveCount, radius, TILE_W, TILE_H, spacing);
    liq.refSmoothed = liq.refSmoothed > 0
      ? smoothLiquidReference(liq.refSmoothed, measuredRef, dtSeconds, LIQUID_REF_TAU_SECONDS)
      : measuredRef;
    const densityRef = liq.refSmoothed;
    const isoRef = liq.isoLevel * densityRef;

    // 1. Field. Cleared to 0 — the surface pass discards below the threshold, so an unwritten texel must
    // read as "no liquid". The colour target's zero carries the same weight: its alpha IS the weight sum,
    // so a nonzero clear would put a denominator under pixels no particle touched.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.liquidFbo);
    // ⚠️ **v8 Step 15.2: `drawBuffers` MUST be set, listing BOTH attachments in attachment order.** A user
    // FBO's default draw-buffer state enables COLOR_ATTACHMENT0 only, so without this the `outColor` write is
    // discarded silently: the colour field stays at its clear value, `wSum` is 0 at every texel, the shader's
    // `perParticle` falls back to `tint`, and the tile renders byte-identical to 15.1 — invariant 13 arriving
    // through GL state, with every visible sign of a working feature. Per frame beside the bind, because
    // draw-buffer state is per-FRAMEBUFFER; for the same reason it needs no restore.
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, TILE_W, TILE_H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.liquidAccProgram);
    gl.uniform2f(this.uLiqAccResolution, TILE_W, TILE_H);
    gl.uniform1f(this.uLiqAccSize, diameter);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.liquidAccVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.liquidAccPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pos2d, gl.DYNAMIC_DRAW);
    // Both enabled attributes uploaded, every frame (invariant 6).
    gl.bindBuffer(gl.ARRAY_BUFFER, this.liquidAccColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, solidCount);
    gl.bindVertexArray(null);

    // 2. Surface into the slot's own trail buffer.
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, TILE_W, TILE_H);
    gl.useProgram(this.liquidSurfProgram);
    gl.uniform1f(this.uLiqSurfIsoRef, isoRef);
    // `densityRef` read a second time, never re-derived from `isoRef / isoLevel` — see the shader's own note
    // and `LIQUID_THICKNESS_DEPTH`: the ramp coordinate's scale is deliberately independent of the threshold,
    // and a second expression for one quantity is the drift `liquid-reference.ts` exists to prevent.
    gl.uniform1f(this.uLiqSurfThickRef, LIQUID_THICKNESS_DEPTH * densityRef);
    gl.uniform1f(this.uLiqSurfSoftness, liq.edgeSoftness);
    gl.uniform2f(this.uLiqSurfResolution, TILE_W, TILE_H);
    gl.uniform1i(this.uLiqSurfTintSource, liq.tintSource);
    gl.uniform1i(this.uLiqSurfPaletteEnabled, slot.paletteTexture ? 1 : 0);
    // v8 Step 15.2. Uploaded UNCONDITIONALLY, including at 0 where the shader's `mix` is an algebraic
    // identity — a gate here would leave the previous slot's value on a shared program, and the grid drives
    // up to 128 slots through this one program in a single loop.
    gl.uniform1f(this.uLiqSurfColourMix, liq.colourMix);
    gl.uniform1i(this.uLiqSurfMixModel, liq.mixModel);
    // v8 Step 15.3. All five unconditionally, for the same shared-program reason as `colourMix` above.
    gl.uniform1f(this.uLiqSurfRefraction, liq.refraction);
    gl.uniform1f(this.uLiqSurfSpecular, liq.specular);
    gl.uniform1f(this.uLiqSurfThickness, liq.thickness);
    gl.uniform1f(this.uLiqSurfEdgeBright, liq.edgeBrightness);
    // ⚠️ **The TILE's OWN radius, and it takes NO `SCREEN_SPACE_TILE_SCALE`** — `radius` above is already
    // derived through `scaleFactor`, and at 256x192 the two factors are the same number 0.25, so applying both
    // would silently SQUARE the reduction (v8 15.1's measured defect, where the `max(1.0, …)` floor then
    // pinned the sprite at 1 px across the whole Kernel Width track). The dispersion offset is a fraction of
    // the kernel the tile actually drew, so it scales with the tile for free.
    gl.uniform1f(this.uLiqSurfRadius, radius);

    // `preset` resolves to the figure's MEAN colour, because a fullscreen pass has no per-particle identity —
    // it is gone once the field is summed. Sampled on a stride so the cost does not scale with the count
    // (invariant 8: this runs every rendered tile-frame). Step 15.2's weighted accumulation replaces it.
    let cr = 0.6, cg = 0.8, cb = 1.0;
    if (liq.tintSource === 0 && state.colors.length >= solidCount * 3) {
      const stride = Math.max(1, Math.floor(solidCount / 128));
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let i = 0; i < solidCount; i += stride) {
        sr += state.colors[i * 3]!; sg += state.colors[i * 3 + 1]!; sb += state.colors[i * 3 + 2]!;
        n++;
      }
      if (n > 0 && (sr + sg + sb) > 1e-6) { cr = sr / n; cg = sg / n; cb = sb / n; }
    }
    gl.uniform3f(this.uLiqSurfTint, cr, cg, cb);

    // FOUR samplers since v8 15.2, so all four get a unit UNCONDITIONALLY and a real texture — never `null`
    // (invariant 4). `fallbackTex` is the 1x1 white texel the particle program already relies on for the same
    // reason: one unassigned `sampler2D` can resolve a whole multi-sampler draw to black.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
    gl.uniform1i(this.uLiqSurfDensity, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, liq.rampTexture ?? this.fallbackTex);
    gl.uniform1i(this.uLiqSurfRamp, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, slot.paletteTexture ?? this.fallbackTex);
    gl.uniform1i(this.uLiqSurfPalette, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.liquidColorTex ?? this.fallbackTex);
    gl.uniform1i(this.uLiqSurfColor, 3);
    // activeTexture is GLOBAL and later passes (fade, blur, blit) bind assuming unit 0 — `blendcheck` asserts
    // this per function, and it caught the identical omission in the main renderer's pass on its first run.
    // Draw-buffer state needs no such restore: it belongs to `liquidFbo`, not to the context.
    gl.activeTexture(gl.TEXTURE0);

    // PREMULTIPLIED source, hence ONE, ONE_MINUS_SRC_ALPHA. `SRC_ALPHA` would apply coverage twice, and
    // because coverage peaks in the blob interior the loss would distort the falloff rather than merely dim
    // it (invariant 9). This is the one tile path that OCCLUDES instead of adding light.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.liquidSurfVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  // --- Texture / FBO helpers ---

  /**
   * Build slot `index`'s ping-pong FBO pair if it does not exist yet (H16).
   *
   * Idempotent and called from `acquireSlot` before the slot is used. The arrays are SPARSE by index
   * rather than pushed in order, so a slot that is never reached costs nothing — which is the whole
   * point: `MAX_SLOTS` is sized for a 4K window while Evolution and History can only ever reach 9 and
   * 10 respectively.
   *
   * ⚠️ `dispose()` must iterate to `MAX_SLOTS` and null-check, not iterate the array length — a sparse
   * array's `length` is its high-water index, and the entries below it may be holes.
   *
   * Deliberately grow-only: a released slot keeps its pair. Freeing on release would delete and rebuild
   * a pair on every scroll, and the high-water mark is set by the window size, which changes rarely —
   * so the steady state is "one pair per slot the user's window has ever needed", not per slot live now.
   */
  private ensureSlot(index: number): void {
    if (this.slotFboA[index]) return;
    const gl = this.gl;
    const texA = this.createTileTexture(gl);
    const texB = this.createTileTexture(gl);
    const fboA = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);
    const fboB = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.slotTexA[index] = texA;
    this.slotTexB[index] = texB;
    this.slotFboA[index] = fboA;
    this.slotFboB[index] = fboB;
  }

  private createTileTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, TILE_W, TILE_H, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  // --- Shader compilation ---

  private compileParticleProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      precision highp float;
      precision highp int;
      in vec2 aPosition;
      in vec3 aColor;
      in float aTemperature;
      in float aDepth;
      in float aVelocity;
      uniform vec2 uResolution;
      uniform float uGlow;
      uniform int uRenderMode;
      uniform float uSplatRadius;
      // Global particle size multiplier (overlay.particleSize). Read here so a preset authored with a
      // non-default size PREVIEWS at that size — a tile that ignored it would show a different figure
      // density than the main view for the one control whose entire job is density (fieldcheck section I).
      // NOTE: no backticks anywhere in this template literal — invariant 18.
      uniform float uParticleSize;
      out vec3 vColor;
      out float vTemperature;
      out float vDepth;
      out float vVelocity;
      out float vPos;
      void main() {
        vec2 ndc = (aPosition / uResolution) * 2.0 - 1.0;
        ndc.y = -ndc.y;
        gl_Position = vec4(ndc, 0.0, 1.0);
        vDepth = aDepth;
        vVelocity = aVelocity;
        // Mapping 4 (position): the SAME dual-axis field the main splat shader and MaterialProcessor's
        // 'position' heat mode use. Reproduced verbatim, coefficients included — the two controls are
        // documented as meaning the same thing by the same word, so the formulas must not drift.
        vPos = (sin(aPosition.x * 0.003) * 0.5 + 0.5) * (cos(aPosition.y * 0.004) * 0.5 + 0.5);
        float baseSize;
        if (uRenderMode == 3) {
          // Splat mode: use material splatRadius (pre-scaled by CPU matching full renderer formula)
          baseSize = max(2.0, uSplatRadius);
        } else if (uRenderMode == 2) {
          baseSize = 5.0;
        } else {
          baseSize = 3.0;
        }
        // The global multiplier, applied to every branch. No SCREEN_SPACE_TILE_SCALE — decide by UNIT: it
        // is a dimensionless ratio, and uSplatRadius above already arrives pre-scaled by the CPU. The
        // 1.0 floor is the same one the main renderer's clamp carries; there is no upper clamp here
        // because a tile never queries ALIASED_POINT_SIZE_RANGE and the driver caps it either way.
        gl_PointSize = max(1.0, baseSize * uParticleSize);
        vColor = aColor;
        vTemperature = aTemperature;
      }`;
    const frag = `#version 300 es
      precision highp float;
      precision highp int;
      in vec3 vColor;
      in float vTemperature;
      uniform float uGlow;
      uniform int uRenderMode;
      uniform float uBrightness;
      uniform float uCoreBrightness;
      uniform float uHaloStrength;
      uniform float uFalloffExponent;
      uniform float uEmissionIntensity;
      uniform float uIsAdditive;
      uniform sampler2D uRampTex;
      uniform sampler2D uPaletteTex;
      uniform int uPaletteEnabled;
// v8 26.4 -- palette hue rotation in TURNS, mirroring the main renderer. No backticks in this comment.
uniform float uPaletteHueShift;
      uniform int uPaletteMapping;
      in float vDepth;
      in float vVelocity;
      in float vPos;
      out vec4 fragColor;

      // D16: film-look palette index, mirroring the main renderer's mappings (B14).
      //
      // WARNING: each mapping MUST read its own per-particle source. Collapsing any two makes the
      // corresponding film looks render identically, which reads as "the palette control does nothing"
      // -- the exact defect B14 hit in the main shader. In particular 'phase' takes the PRESET's
      // oscillating colour (vColor), never the ramp colour, which is already temperature-indexed and
      // would make phase a duplicate of temperature.
      //
      // Mapping 3 (temperature) and 5 (age) are pre-resolved on the CPU by tilePaletteMapping(), so
      // neither can arrive here: 3 is degraded to velocity when no material is running (temperatures[]
      // would be all-zero -> one flat colour) and 5 is degraded to 3, because 'age' needs
      // state.lifetimes -- the one GeneratorState array NOT extended to count, which would under-size
      // the buffer and make ANGLE silently DROP THE WHOLE DRAW (a black tile, no JS error).
      float paletteCoord(float temp) {
        if (uPaletteMapping == 0) return vDepth;
        if (uPaletteMapping == 1) return dot(vColor, vec3(0.2126, 0.7152, 0.0722));
        if (uPaletteMapping == 2) return vVelocity;
        if (uPaletteMapping == 4) return vPos;
        return temp;
      }

      vec3 palette(float temp) {
        // v8 26.4 -- the clamp comes FIRST so the wrap spans exactly one period, matching the main
        // renderer term for term; zero short-circuits to keep the identity byte-exact.
        float c = clamp(paletteCoord(temp), 0.0, 1.0);
        if (uPaletteHueShift != 0.0) c = fract(c + uPaletteHueShift);
        return texture(uPaletteTex, vec2(c, 0.5)).rgb;
      }

      void main() {
        vec2 pc = gl_PointCoord - 0.5;
        float r = length(pc) * 2.0;

        if (uRenderMode == 3) {
          // Material splat mode
          if (r > 1.0) discard;
          float core = smoothstep(0.5, 0.0, r) * uCoreBrightness;
          float halo = exp(-uFalloffExponent * r * r) * uHaloStrength;
          float shape = core + halo;
          vec4 rampColor = texture(uRampTex, vec2(clamp(vTemperature, 0.01, 0.99), 0.5));

          // D16: film-look palette override, RGB ONLY -- alpha stays with the material ramp, because
          // opacity is a separate concern and palettes carry no meaningful alpha. This is what gives the
          // tile the engine's one precedence order: palette > material ramp > preset colour.
          if (uPaletteEnabled == 1) rampColor.rgb = palette(vTemperature);
          vec3 col = rampColor.rgb * shape * uEmissionIntensity;
          // PREMULTIPLIED alpha, clamped. shape is core+halo and reaches ~1.5 for Ice, so emitting
          // it raw as alpha made an alpha-blended particle fully REPLACE the trail buffer and stamp a
          // dark ice colour over it — the tile went black. Clamping and premultiplying matches the main
          // renderer, which pairs this with ONE, ONE_MINUS_SRC_ALPHA so a particle composites over the
          // trail instead of erasing it.
          float a = clamp(shape * rampColor.a, 0.0, 1.0);
          // PREMULTIPLY ONLY IN ALPHA MODE (D15). Premultiplying is what makes ONE,
          // ONE_MINUS_SRC_ALPHA composite correctly -- but under ONE, ONE the GPU never reads alpha, so
          // scaling rgb by 'a' is pure, unintended attenuation: 'shape' is applied a SECOND time and the
          // ramp's authored alpha curve is applied where the main renderer explicitly does not apply it
          // (its 'outA' is gated on uIsAdditive for exactly this reason).
          //
          // The loss is shape- and temperature-dependent, so it also distorted the ramp rather than just
          // dimming it: cold particles, which have both a low 'shape' and a low ramp alpha, were
          // suppressed hardest. Measured on 'Julia Burn Rivers' (coreBrightness 0.5, 'liquid' ramp at
          // t~0.3) it cost 5.45x, against ~1.40x for the four fire presets -- which is why that one
          // preset read as "almost black" while the others merely looked dim.
          //
          // uIsAdditive is a float, not a bool, to match the main renderer's uniform convention.
          fragColor = (uIsAdditive > 0.5) ? vec4(col, a) : vec4(col * a, a);
        } else {
          float shape;
          if (uRenderMode == 2) {
            float cross_d = min(abs(pc.x), abs(pc.y));
            float arm = 1.0 - smoothstep(0.0, 0.18, cross_d);
            shape = arm * (1.0 - smoothstep(0.3, 1.0, r));
          } else if (uRenderMode == 1) {
            float falloff = 1.0 - smoothstep(0.0, 1.0, r);
            shape = pow(falloff, uGlow);
          } else {
            shape = (r < 0.7) ? 1.0 : 0.0;
          }
          if (shape < 0.01) discard;
          // The POINT path takes the palette too (main renderer: pixel/blend/star all do).
          // Inert for all 177 legacy presets -- they carry no overlay, so they default to film look
          // 'Legacy', which is palette 'none' and therefore disabled on the CPU side.
          vec3 base = (uPaletteEnabled == 1) ? palette(vTemperature) : vColor;
          fragColor = vec4(base * shape * uBrightness, shape * uBrightness);
        }
      }`;
    return compileProgram(gl, vert, frag, 'GridTile particle');
  }

  private compileFadeProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      in vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
    const frag = `#version 300 es
      precision lowp float;
      uniform float uAlpha;
      out vec4 fragColor;
      void main() { fragColor = vec4(0.0, 0.0, 0.0, uAlpha); }`;
    return compileProgram(gl, vert, frag, 'GridTile fade');
  }

  private compileBlitProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;
    const frag = `#version 300 es
      precision mediump float;
      uniform sampler2D uTex;
      in vec2 vUv;
      out vec4 fragColor;
      void main() { fragColor = texture(uTex, vUv); }`;
    return compileProgram(gl, vert, frag, 'GridTile blit');
  }

  private compileBlurBlitProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;
    const frag = `#version 300 es
      precision mediump float;
      uniform sampler2D uTex;
      uniform vec2 uTexelSize;
      in vec2 vUv;
      out vec4 fragColor;
      void main() {
        vec4 c = texture(uTex, vUv) * 4.0;
        c += texture(uTex, vUv + vec2(-uTexelSize.x, 0.0));
        c += texture(uTex, vUv + vec2( uTexelSize.x, 0.0));
        c += texture(uTex, vUv + vec2(0.0, -uTexelSize.y));
        c += texture(uTex, vUv + vec2(0.0,  uTexelSize.y));
        c += texture(uTex, vUv + vec2(-uTexelSize.x, -uTexelSize.y)) * 0.5;
        c += texture(uTex, vUv + vec2( uTexelSize.x, -uTexelSize.y)) * 0.5;
        c += texture(uTex, vUv + vec2(-uTexelSize.x,  uTexelSize.y)) * 0.5;
        c += texture(uTex, vUv + vec2( uTexelSize.x,  uTexelSize.y)) * 0.5;
        fragColor = c / 10.0;
      }`;
    return compileProgram(gl, vert, frag, 'GridTile blur blit');
  }

  private compileTonemapProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;
    const frag = `#version 300 es
      precision mediump float;
      uniform sampler2D uTex;
      in vec2 vUv;
      out vec4 fragColor;
      void main() {
        vec3 hdr = texture(uTex, vUv).rgb;
        // Exponential tonemapping: linear for low values, compresses highlights
        vec3 ldr = vec3(1.0) - exp(-hdr * 1.5);
        fragColor = vec4(ldr, 1.0);
      }`;
    return compileProgram(gl, vert, frag, 'GridTile tonemap');
  }

  private createQuadVAO(gl: WebGL2RenderingContext, program: WebGLProgram): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }
}
