/**
 * v8 `31.2` (`E112`/`E113`/`E137`) — **the per-particle channel drivers, and this list is the ONE
 * enumeration.**
 *
 * ⚠️ **IT LIVES HERE RATHER THAN IN `generators/lissajous.ts`, WHICH OWNS THE OPERATOR, because
 * `presets/types.ts` names it too and already imports this module** — putting it beside the implementation
 * would have pointed the preset format at the generator, which is the wrong direction for the one module
 * every other one reads.
 *
 * ⚠️ `RENDER_MODE_LABELS` is the precedent for what this buys and what it does not: a union buys type
 * safety, **not enumeration coverage.** Every reader must be an exhaustive map keyed by the union, never an
 * `if`-chain that falls through to a default — the shape that made the Time Warp source picker ship with
 * two of its three members.
 *
 * ⚠️ **`age` IS ABSENT ON PURPOSE AND IS NOT AN OMISSION TO FIX.** Nothing here gives a wave particle an
 * age: `pos` is a single global clock shared by every particle, and `lifetimes` exists only while a
 * material is live. An `age` driver would therefore be either globally flat — every particle identical, so
 * the channel is inert — or silently material-dependent.
 */
/**
 * What drives the per-particle size/alpha/lightness channels.
 *
 * v8 `33.5` — ⚠️⚠️ **`'escape'` IS THE FIRST MEMBER WHOSE DATA CAN BE ABSENT AT RUNTIME**, and the only
 * one that encodes a particle's position RELATIVE TO A FRACTAL SET rather than relative to its own index
 * or motion. It is populated only by the two escape-time attractor types, so:
 *   - the generator falls back to `'index'` when the array is short (resolved ONCE outside the loop);
 *   - the Lab HIDES the option unless an escape-time attractor is live (`33.D17`), rather than offering a
 *     control that reads inert — invariant 13's shape.
 *
 * ⚠️ **Adding a member here is caught by `CHANNEL_DRIVER_LABELS` (a total `Record`) and NOT by
 * `CHANNEL_DRIVERS` (a plain array the picker is built from).** That one-way gap is documented at the
 * label record and is why both must be edited together.
 */
export type ChannelDriver = 'index' | 'velocity' | 'depth' | 'colourPhase' | 'escape';

export interface GeneratorState {
  positions: Float32Array;
  colors: Float32Array;
  depths: Float32Array;
  velocities: Float32Array;
  count: number;
  temperatures?: Float32Array;
  lifetimes?: Float32Array;
  materialTags?: Uint8Array;
  velocityDirs?: Float32Array;
  /**
   * v8 `31.2` (`E112`/`E113`/`E137`) - **per-particle appearance, THREE floats per slot, packed:
   * `[sizeMul, alphaMul, lightMul]`.**
   *
   * ⚠️ **ONE PACKED ATTRIBUTE RATHER THAN THREE** (`31.D3`): one new buffer against the nine already
   * bound, one upload per pass, one invariant-6 obligation. The three channels are driven by ONE shared
   * selector (`31.D4`), so the same particles are large, bright and opaque together - which reads as
   * structure rather than as noise.
   *
   * ⚠️ **ABSENT MEANS NEUTRAL, AND ABSENCE IS THE GATE.** All three amounts at 0 publishes nothing and
   * computes nothing, so a preset authored before `31.2` is bit-identical. Every consumer must then treat
   * all three multipliers as 1 - **never as 0**, which would be an invisible figure.
   *
   * ⚠️ **Length is `count * 3`, covering the tail blocks too.** Sparks, the liquid pool and crystals are
   * separate populations with no curve parameter, so they carry the neutral `(1, 1, 1)` - but they must
   * carry it, because both particle passes upload this buffer at the full instance length (invariant 6)
   * and a short one makes ANGLE drop the entire draw.
   */
  channels?: Float32Array;
  /**
   * Per-SLOT crystal flag: 1 = this slot is a crystal, 0 = it is a wave particle or a spark.
   * Absent means the crystal pool is empty and every renderer takes its existing paths unchanged.
   *
   * v8 Phase 8a-3 INVERTED the meaning of this field. It used to mark a wave particle that had
   * permanently stopped moving — freezing was a destructive CONVERSION, so each crystal was a
   * particle subtracted from the figure, which developed holes and frozen arc gaps. Freezing is now
   * BIRTH: `CrystalPool` owns its own slots and they are CONCATENATED after the wave particles, so
   * no wave particle is ever frozen and the figure always renders its full particle count.
   *
   * Canonical slot order is `[wave][sparks][liquid][crystals]`, so this mask is 1 across exactly one
   * contiguous TAIL range and 0 everywhere below it. Consumers use it for two things: the crystal
   * pass draws only the slots where it is 1, and the additive/material passes suppress exactly
   * those slots so nothing is drawn twice.
   *
   * Length is `count`.
   */
  frozen?: Uint8Array;
  /**
   * Per-slot crystal growth scalar, published on the same gate as `frozen`.
   *
   * 0 → 1 while a crystal nucleates, 1 while Solid, 1 → 0 while it melts. The crystal pass scales
   * BOTH the hexagon radius and the alpha by it, so this single scalar produces the fade-in and
   * the fade-out. Absent means no crystal is live; renderers must then treat growth as 1.
   *
   * Length is `count`. Non-crystal slots (wave particles, sparks and liquid-pool particles) carry the
   * neutral value 1.
   */
  growth?: Float32Array;
  /**
   * Length of the trailing crystal block, i.e. `count - crystalCount` is the index of the first
   * crystal slot. Absent (or 0) means there are no crystals.
   *
   * Published so trajectory consumers can exclude crystals CHEAPLY. Neon and ribbon rebuild their
   * entire trail history whenever the particle count changes; the crystal block length varies every
   * frame (crystals nucleate and melt continuously), so a consumer that walked all of `count` would
   * rebuild every frame and destroy every trail. Crystals have no trajectory to draw anyway — they
   * are drawn by the crystal pass alone.
   */
  crystalCount?: number;
  /**
   * v8 15.5 — length of the liquid-pool block, which sits between the sparks and the crystals:
   * `[wave][sparks][liquid][crystals]`. Absent (or 0) means no pool is running.
   *
   * ⚠️ **THE POOL IS THE FIRST TAIL BLOCK CONSUMERS MUST PARTITION IN BOTH DIRECTIONS, AND THE
   * DISCRIMINATOR IS "IS A POOL PARTICLE DRAWABLE HERE" — ANSWERED PER CONSUMER, NEVER ONCE.** A pool
   * particle is a real screen-space body, so unlike a crystal it *is* drawn by the ordinary point,
   * volume and splat paths and must be INCLUDED in their counts. But four kinds of consumer must
   * exclude it, and each for its own reason:
   * - the **trajectory** renderers (neon, ribbon), because a pool particle has no trajectory and
   *   their trail history is keyed on a stable count;
   * - the **fluid field's own seeding**, because seeding the field from the population the field
   *   moves closes a feedback loop the step deliberately leaves open;
   * - the **spark index range** (`uSparkFirst`/`uSparkLast`), because that range is `[waveCount,
   *   waveCount + sparkCount)` and a block inserted after it would otherwise be drawn at spark
   *   radius;
   * - the liquid **density reference**, because it measures spacing ALONG A CURVE and the pool is a
   *   cloud — feeding it pool indices would report a spacing that no curve has.
   *
   * ⚠️ Being INSERTED rather than appended is what keeps `crystalCount` a trailing-block length, which
   * every existing crystal consumer relies on. Do not reorder these two blocks.
   */
  liquidCount?: number;
  /**
   * Length of the LEADING wave-particle block, i.e. the index of the first spark slot.
   *
   * Canonical slot order is `[wave][sparks][liquid][crystals]`, and the wave block is the only part
   * with a FIXED length for a given preset — all three tail blocks vary as sparks, pool particles and
   * crystals are born, resized and die.
   *
   * Published for consumers needing a STABLE partition of the particle set. `RibbonRenderer` in hybrid
   * mode gives every Nth particle a ribbon, with the stride derived from the count; if that count
   * includes a varying tail, the stride changes frame to frame and the SELECTION itself churns, so
   * ribbons flicker between different particles. Deriving the stride from `waveCount` keeps it fixed.
   *
   * Absent means the whole array is wave particles.
   */
  waveCount?: number;
}

export interface Generator {
  readonly id: string;
  init(config: GeneratorConfig, canvasSize: CanvasSize): void;
  update(dt: number): void;
  getState(): GeneratorState;
  getSchema(): ParamSchema;
  dispose(): void;
}

export interface ForceField {
  readonly id: string;
  apply(positions: Float32Array, velocities: Float32Array, dt: number): void;
  getSchema(): ParamSchema;
  dispose(): void;
}

export interface Renderer {
  readonly id: string;
  init(backend: ComputeBackend, config: RendererConfig): void;
  /**
   * @param dtSeconds real frame delta in SECONDS, for renderers that carry temporally smoothed state — today
   *   only `liquid`'s density reference (v8 15.1b). ⚠️ **Optional so `NeonLineRenderer` and `RibbonRenderer`
   *   need no signature change, but a MISSING argument is not inert and that is the trap**: a smoother handed
   *   `dt = 0` snaps, i.e. it silently reverts to the unsmoothed behaviour whose per-frame jump measured
   *   99.29 % — invariant 13 arriving through a defaulted parameter. It therefore defaults to a nominal 60 Hz
   *   step rather than to 0, and `fieldcheck` §O asserts the real delta reaches the call site.
   */
  render(state: GeneratorState, target: GPUTarget, dtSeconds?: number): void;
  resize(width: number, height: number): void;
  getSchema(): ParamSchema;
  dispose(): void;
}

// `PostProcessor` was declared here and deleted on 2026-08-06. It had ZERO implementations: all six
// live post-processors take a raw `WebGL2RenderingContext` rather than a `ComputeBackend`, have
// mutually incompatible `apply()`/`resize()` shapes — `FluidAdvectionProcessor` has no `apply()` at
// all and a zero-argument `resize()`, because it is a simulation rather than a filter — and none
// implements `getSchema()`. Its only referrers were `core/pipeline.ts` and `core/registry.ts`, both
// themselves unreferenced, so all three went together. A declared contract that nothing satisfies is
// worse than none: it tells the next author to conform to a shape the code does not use.
//
// `ComputeBackend` below is NOT in that category — `detectBackend()` is called from `main.ts` and
// `WebGL2Backend` is imported by all three renderers.

export interface ComputeBackend {
  readonly type: 'webgpu' | 'webgl2';
  readonly device: GPUDevice | null;
  readonly gl: WebGL2RenderingContext | null;
  createTexture(desc: TextureDescriptor): GPUTextureHandle;
  createBuffer(desc: BufferDescriptor): GPUBufferHandle;
  createPipeline(desc: PipelineDescriptor): GPUPipelineHandle;
  submit(commands: GPUCommandList): void;
  onContextLost(callback: () => void): void;
  dispose(): void;
}

export interface GPUTarget {
  readonly width: number;
  readonly height: number;
  readonly handle: GPUTextureHandle;
}

export type GPUTextureHandle = unknown;
export type GPUBufferHandle = unknown;
export type GPUPipelineHandle = unknown;
export type GPUCommandList = unknown;

export interface TextureDescriptor {
  width: number;
  height: number;
  format: 'rgba16float' | 'rgba8unorm' | 'r32float';
  usage: number;
}

export interface BufferDescriptor {
  size: number;
  usage: number;
  data?: ArrayBuffer;
}

export interface PipelineDescriptor {
  vertex: string;
  fragment: string;
  blend?: BlendDescriptor;
}

export interface BlendDescriptor {
  src: 'one' | 'src-alpha';
  dst: 'one' | 'one-minus-src-alpha' | 'zero';
}

export interface ParamSchema {
  params: ParamDef[];
}

export interface ParamDef {
  key: string;
  type: 'number' | 'boolean' | 'select' | 'color';
  label: string;
  category: string;
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean | string;
  options?: { value: string; label: string }[];
}

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * The config object handed to `Generator.init()`.
 *
 * ## The optional fields below are declared, not reached through casts (triage I2)
 *
 * `LissajousGenerator.init()` read `waveSpeed`, `rotation`, `angle`, `designResolution` and the four
 * `color*` arrays through `(config as unknown as { … })` — five casts for fields that
 * `UnifiedPreset.generators` and `UnifiedPreset.metadata` already declare properly. The casts existed
 * only because this interface stopped at `type`/`particleCount`/`waves`/`attractor` and left the rest to
 * the index signature, so a real field was indistinguishable from a typo.
 *
 * Declaring them is a closed change: there is exactly ONE implementor (`LissajousGenerator`) and TWO
 * call sites (`main.ts` `initGenerator`, `grid-tile-renderer.ts`), both of which already pass this exact
 * shape. Any future generator may ignore any of them — they are all optional.
 *
 * ⚠️ **`designResolution` is the one field that does NOT come from `generators`.** It lives in
 * `UnifiedPreset.metadata`, and both call sites lift it across by hand. Do not "fix" that by moving the
 * field: `metadata` is where the migration layer defaults it (100×100 for all 177 legacy presets).
 *
 * The `[key: string]: unknown` index signature is retained deliberately — a generator type other than
 * `lissajous` may carry its own parameters, and `ParamSchema` is how they are surfaced. It is what makes
 * this interface open, so adding a field here can never be a breaking change.
 */
export interface GeneratorConfig {
  type: string;
  particleCount: number;
  waves?: WaveConfig[];
  attractor?: AttractorParams;
  /** Wave phase advance per unit time. Default 0.05 when absent. */
  waveSpeed?: number;
  /** Rotation SPEED per axis, degrees/second — accumulated every frame. */
  rotation?: number[];
  /** INITIAL orientation per axis, degrees — a one-off starting pose, distinct from `rotation`. */
  angle?: number[];
  /** Authored design box, lifted from `UnifiedPreset.metadata`; drives `figScale`. */
  designResolution?: { width: number; height: number };
  colorBase?: number[];
  colorAmp?: number[];
  colorFreq?: number[];
  colorShift?: number[];
  [key: string]: unknown;
}

/**
 * The renderer's mode vocabulary — **the ONE enumeration**, extracted 2026-08-30 (v8 Step 15.0, E83).
 *
 * The union used to be written out **eleven times across five files** with no named type
 * (`interfaces.ts`, `main.ts` ×3, `presets/types.ts` ×2, `renderers/hdr-particle.ts` ×2,
 * `ui/synthesis-lab/tabs/visual-fx.ts` ×3), so a new mode has that many chances to miss a site and every
 * miss compiles, runs and is silently wrong. **Count the sites rather than quoting this sentence.** Add a mode HERE and `tsc` then names every site that must
 * handle it. Same shape, and the same reason, as `TRANS_MAP_STYLES` being the one style enumeration.
 *
 * ⚠️ **THE FURTHER SITES THAT ARE DELIBERATE SUBSETS MUST NOT BE WIDENED TO `RenderMode` — count them,
 * do not quote a total.** Each carries its own comment saying so, because the failure is silent in the
 * permissive direction: `RandomisableRenderMode` (`exploration/randomize.ts` — a VALUE array, so widening
 * it would make the Randomiser hand out `splat`, which is black without a material) and `RENDER_MODES`
 * (`presets/migration.ts`, the legacy INTEGER map, which no legacy file can key to a post-legacy mode).
 * ⚠️ **This sentence said "THREE" and named `PointRenderMode` (`exploration/archetype-defs.ts`) as the
 * third until 2026-10-04, when the Archetypes tab was removed and that file deleted** — a stated count is
 * exactly what a removal leaves wrong, which is why this one is now an instruction to count instead.
 */
/*
 * ⚠️ **`'log-density'` WAS THE FOURTH MEMBER AND WAS RETIRED BY THE OWNER ON 2026-09-19** (plan 21.8c/d,
 * decision 21.D6, which had deferred the call to the demos this phase would have had to author for it).
 * It cost an R32F FBO, two programs and a `resize()` branch, and **no shipped preset selected it** — 0 of
 * the 177 legacy bodies carry `RenderMode: 3` (the histogram is 10×1 and 167×2) and 0 composed bodies
 * carry `renderer.mode: 'log-density'`, so the removal changed no picture. **Its legacy INTEGER 3 still
 * exists and is now mapped to `'star'` by `presets/migration.ts` — an imported legacy file may still key
 * it, so that map may not simply lose the row.** The renderer's `modeInt` 3 is likewise reserved rather
 * than reused.
 */
export type RenderMode = 'pixel' | 'blend' | 'star' | 'splat' | 'volume' | 'liquid';

export interface RendererConfig {
  mode: RenderMode;
  glow: number;
  decayFactor: number;
  blurRadius: number;
  depthSize: number;
  streaks: number;
}

export interface WaveConfig {
  speed: number;
  axes: [AxisWave, AxisWave, AxisWave];
}

export interface AxisWave {
  phase: number;
  am: { base: number; amplitude: number; frequency: number };
  fm: { base: number; amplitude: number; frequency: number };
}

export interface AttractorParams {
  /**
   * ⚠️⚠️ **THE SLOT HOLDS "ALTERNATIVE FIGURE SOURCES", NOT "STRANGE ATTRACTORS", AND IT HAS SINCE
   * `julia` AND `mandelbrot` JOINED.** Neither is an attractor in any dynamical sense — they are
   * escape-time sets sampled over a window — so the union's name is a misnomer the engine already
   * tolerates. `33.D5` adds a third non-attractor on that precedent rather than building a parallel
   * figure-source mechanism, which buys the blend, the bounds crossfade, the normalisation, the preset
   * table and the `Attractor Type` facet for free.
   *
   * ⚠️⚠️ **ADDING A MEMBER HERE IS INVISIBLE TO `tsc` AT EVERY SITE EXCEPT `ATTRACTOR_FLATNESS`** —
   * measured 2026-10-28. `ATTRACTOR_HALF_EXTENT` is a `Partial<Record<...>>` so it enforces nothing, and
   * `isDiscreteMap` is an `if`-chain that falls through to `false`. That is the `TabId`/`RenderMode`
   * defect class, and `33.D6` closed the worst of it by making flatness a TOTAL `Record`.
   */
  type: 'clifford' | 'dejong' | 'lorenz' | 'rossler' | 'thomas' |
        'halvorsen' | 'aizawa' | 'nose-hoover' | 'julia' | 'mandelbrot';
  params: number[];
  blend: number;
  bounds: [number, number, number, number];
  maxIter?: number;
}
