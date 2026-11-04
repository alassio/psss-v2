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
  dispose(): void;
}

/**
 * ⚠️ **`ForceField` WAS DELETED HERE BY v8 `36.17` (`36.D19`), AND THIS NOTE IS IN THE
 * `PostProcessor` DELETION'S OWN STYLE SO THE EXTENSION POINT IS NOT RE-INVENTED.**
 *
 * It declared `name`, `apply()` and `getSchema()` and had **ZERO implementations** — `grep -rn
 * "implements ForceField"` returned nothing, and `TransMapForceField`, the one class whose name
 * suggests it, does not implement it. The force fields the engine actually ships
 * (`TransMapForceField`, spark `applyForceField`, the crystal cluster force) are all wired
 * directly, because each needs a different signature and a different call site in the frame.
 *
 * **Deleted with `ParamSchema` and `ParamDef` for the reason this file already states eight lines
 * above: *a declared contract that nothing satisfies is worse than none — it tells the next author
 * to conform to a shape the code does not use.***
 */

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
 * ⚠️⚠️ **THE INDEX SIGNATURE'S JUSTIFICATION WAS REWRITTEN BY v8 `36.17`, AND THE OLD ONE WAS A TRAP.**
 * It read: *"a generator type other than `lissajous` may carry its own parameters, and `ParamSchema` is
 * how they are surfaced"* — i.e. it argued for keeping the very interface `36.D19` deletes, which is
 * why the paragraph had to change in the SAME edit. **Phase 36 answers the question it was speculating
 * about:** a second figure type carries its parameters in a **typed per-type config block**
 * (`LSystemConfig`) read by a **hand-written** section, not by a schema. ⚠️ **Do NOT build the
 * Composer's per-type sections from a schema** — every per-type section this product needs has
 * non-generic behaviour (a Score canvas, slot mute toggles, a ratio picker, derived readouts, a
 * rule-provenance line, per-rule track bounds), and all three slider instruments read hand-written
 * descriptors.
 *
 * The signature itself is RETAINED, for its other stated reason: it is what makes this interface open,
 * so adding a field here can never be a breaking change.
 */
export interface GeneratorConfig {
  /**
   * ⚠️ **NARROWED FROM `string` BY `36.1`, AND THE NARROWING IS THE POINT OF THE STEP**: it is what
   * makes a typo at either of the two call sites (`main.ts`' `initGenerator`, `grid-tile-renderer.ts`)
   * a COMPILE ERROR instead of a figure that silently draws as waves.
   */
  type: FigureType;
  particleCount: number;
  waves?: WaveConfig[];
  attractor?: AttractorParams;
  /** v8 `36.2` — the self-similar curve block. Optional: a preset carries only what it uses. */
  lsystem?: LSystemConfig;
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

/**
 * v8 `36.1` — **every figure type the format can store.**
 *
 * ⚠️⚠️ **THE TYPE LIVES HERE AND THE REGISTRY LIVES IN `generators/figure-types.ts`, AND THAT SPLIT IS
 * THIS FILE'S OWN DOCUMENTED RULE RATHER THAN A PREFERENCE.** `ChannelDriver`'s header, a few hundred
 * lines up, states it: a union named by `presets/types.ts` belongs in the module every other one
 * imports, because *"putting it beside the implementation would have pointed the preset format at the
 * generator, which is the wrong direction."* `FigureType` is named by `presets/types.ts`,
 * `GeneratorConfig` below, the generator, the Composer and every checker — so the union is here and the
 * **data** (labels, descriptions, `selectable`, `motion`, the resolution order) is there, importing this.
 *
 * ⚠️ **`'lissajous'` IS THE STORED WORD AND IS KEPT FOR COMPATIBILITY** even though its UI label is
 * `Waves`: 339 presets and every legacy JSON carry the string. **A stored word printed in a UI, or a
 * label persisted to disk, is the defect** — `reel-store.ts`'s rule, generalised.
 *
 * ⚠️ `RENDER_MODE_LABELS`' lesson applies verbatim: a union buys type safety, **not enumeration
 * coverage.** `FIGURE_TYPE_BY_KEY` is the total `Record` that supplies the coverage.
 */
export type FigureType = 'lissajous' | 'attractor' | 'lsystem';

/**
 * Does the figure move on its own, with no modulation and no rotation?
 *
 * ⚠️⚠️ **THE ONE CAPABILITY DECLARATION THAT SHIPS (`36.D9`), AND IT SHIPS BECAUSE IT EARNS A READER IN
 * THIS PHASE.** `SPEC-figure-types` §1.5 proposes five; the other four are cut individually, because a
 * declared contract with no satisfier *"tells the next author to conform to a shape the code does not
 * use"* (the `PostProcessor` deletion note in this file) — the `ParamSchema` mistake that `36.17`
 * deletes three interfaces for.
 *
 * **What it guards, narrowed by measurement rather than taken from the spec:** velocity is derived at
 * `lissajous.ts:2787` from a **screen-space** delta of PROJECTED positions, so **rotation alone produces
 * a full `[0,1]` spread.** The freeze is reachable only on rotation `[0,0,0]` **and** no modulated
 * parameter — and **66 of 339 presets have zero rotation**, so the configuration exists. Readers: the
 * velocity-derived set (velocity-mapped heat, velocity stretch, slowness-keyed crystal birth,
 * threshold-keyed spark ejection). ⚠️ **Crystals are the dangerous one: slowness-keyed birth sees every
 * particle as slow and freezes the whole figure.** ⚠️ **Resolve it ONCE outside the particle loop.**
 */
export type FigureMotion = 'intrinsic' | 'static';

/**
 * v8 `36.3`/`36.D6` — **a static value plus a wobble, named ONCE.**
 *
 * `base` is the static value, `amplitude` the wobble SIZE, `frequency` the wobble RATE. This is the
 * owner's *"similarly parametrized way"* made concrete and it is the shape Phase 36's whole
 * parametrisation is built on.
 *
 * ⚠️⚠️ **IT EXISTED TWICE WITH NO COMPILER BETWEEN THE COPIES UNTIL THIS EDIT.** `AxisWave.am` and
 * `AxisWave.fm` were each the anonymous inline object `{ base: number; amplitude: number; frequency:
 * number }`, written out twice, with no name connecting them — the defect class this project keeps
 * correcting. **Naming it is the point; do not re-inline either copy.**
 *
 * ⚠️⚠️ **THE RENAME IS LOAD-BEARING AT EXACTLY ONE SITE AND THAT SITE MUST SURVIVE.**
 * `lissajous.ts:124-125` translates this shape into the generator's internal `{base, amp, freq}` **with
 * `?? 0` defaulting, so the translation IS the normaliser** — deleting or relocating it moves behaviour
 * on any preset with a missing field (`34.1`'s finding, still live). **Keep the translation; name the
 * type.**
 *
 * ⚠️⚠️ **`frequency` NAMES THE ROLE, NOT THE UNIT, AND THE TWO USERS READ IT ON DIFFERENT SCALES.** For
 * a wave slot it is the slot rate `AxisWave` has always used. For `LSystemConfig` it is read on Phase
 * 34's **`OP_RATE_*`** scale from `core/deform-limits.ts`, which already carries a measured zero band, a
 * `LIVE_FROM` and a track (`36.D6c`). **Two fields with one name and two scales is a trap, and the
 * resolution is that each consumer's own type declaration states its scale** — `LSystemConfig` does,
 * below. The alternative (reusing the slot scale) was refused because it would put a second rate
 * convention beside eleven breathing quantities that already share one.
 */
export interface ModulatedValue {
  base: number;
  amplitude: number;
  frequency: number;
}

export interface AxisWave {
  phase: number;
  am: ModulatedValue;
  fm: ModulatedValue;
}

/**
 * v8 `36.3` — **the self-similar curve type's parameters** (`generators.lsystem`).
 *
 * ⚠️⚠️ **FIVE PARAMETERS ARE TIME-MODULATED AND THE REST ARE STATIC (`36.D3`, owner).** The three
 * turtle angles, the continuous recursion and the zoom breathe; the rule and the centre do not.
 * **That is what makes the trail mean something on this type:** on a truly static figure the trail is a
 * no-op — the figure is already everywhere it will ever be — and **333 of 339 presets carry
 * `decayFactor > 0`** (median 0.85). So `36.D3` is what makes the owner's *"drive interesting
 * animations from those parameters"* reachable at all.
 *
 * ⚠️⚠️ **THE RATE UNIT IS `OP_RATE_*`, NOT THE WAVE-SLOT `frequency` SCALE** — see `ModulatedValue`.
 * ⚠️ **No new modulation law:** all five resolve through the shipped `resolveOp`/`opTriple`
 * (`lissajous.ts:1826`/`:1838`), which is `base + sin(time · rate / DEG) · depth` with a `depth === 0`
 * BRANCH for bit-exactness and a clamp on the RESOLVED value. ✅ **And the clock comes free:
 * `scaledTime = this.pos`, so the breathing rides the same accumulator the wave slots do and
 * `speedFactor` controls it with no new wiring.**
 *
 * ⚠️ **`shrink` IS ABSENT BY OWNER DECISION** (`36.Q4`, 2026-11-02, reversing `36.D12`) — it was
 * measured inert on every shipping rule. Do not re-add it; see `generators/lsystem/turtle.ts`.
 *
 * ⚠️ **`recursion`'s label is `Recursion`, NEVER `Depth`** (`36.D15`): Phase 34 made `Depth` mean
 * *breathing amplitude* across `sharpnessDepth`/`travelDepth*`/`growDepth*`/`offsetDepth*`, and a row
 * labelled `Depth` meaning recursion next to five rows whose wobble control is also called Depth is the
 * repeated-label hazard that invalidated two of Phase 32's six measurement passes.
 */
export interface LSystemConfig {
  /** The production system's key — a `RuleKey` from `generators/lsystem/rules.ts`. Categorical. */
  rule: string;
  /** Continuous recursion depth; lerped between its integer bracket (`36.6`). */
  recursion: ModulatedValue;
  /** Turtle yaw, about the `U` axis, in degrees. ⚠️ NOT the figure's orientation — that is `Rotation`. */
  yaw: ModulatedValue;
  /** Turtle pitch, about `L`. Hidden for a rule whose symbol set has no pitch symbols (DERIVED). */
  pitch: ModulatedValue;
  /** Turtle roll, about `H`. Hidden for a rule whose symbol set has no roll symbols (DERIVED). */
  roll: ModulatedValue;
  /**
   * The self-similar zoom. ⚠️ **Staged LAST (`36.D13`) and available only on a rule that declares an
   * inverse index map** — on a rule without one the index band is not contiguous, so a zoom would
   * select a scattered subset: *a picture, but not a zoom, i.e. a control that lies.*
   */
  descend: ModulatedValue;
  /** Blend toward the polyline's spline form. ⚠️ A BRANCH at 0, never a weight (`36.D10`). Static. */
  smoothness: number;
  /** The zoom's centre in figure space. Static (`36.D3`). */
  centre: number[];
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
