import type { WaveConfig, AttractorParams, RenderMode, ChannelDriver } from '../core/interfaces.ts';
import type { FilmLookParams, PaletteMapping } from '../renderers/film-looks.ts';

// ⚠️ **The `FilmLookParams` import above is TYPE-ONLY and creates no dependency edge** (triage I11).
//
// The row claimed a `presets → renderers` edge, in the wrong file (it named `migration.ts`, which imports
// nothing from `renderers/`). Both are false, and the second is false for a structural reason worth
// recording: `import type` is erased by the compiler, and `tsconfig.json` sets
// `verbatimModuleSyntax: true`, which makes that erasure guaranteed rather than incidental — a type-only
// import cannot silently become a value import, because dropping the `type` keyword is then required for
// any runtime use and is visible in review. So there is no runtime edge, no bundling edge, and no cycle;
// the only real edge is the compile-time one, and it points the correct way (a preset's `overlay` genuinely
// carries a `FilmLookParams`, so the type belongs where the data does).
//
// The stale `FilmLookName` import was here, not in `migration.ts`, and it is now gone: the dead
// `visualFx.filmLook` field it typed is declared `string` instead. See that field's note below.

export interface CurlNoiseConfig {
  enabled: boolean;
  turbulence: number;    // γ blend factor [0.0, 1.0]
  scale: number;         // spatial scale of noise field [0.1, 10.0]
  evolutionSpeed: number; // time evolution rate [0.0, 2.0]
}

export interface PhysarumConfig {
  blend:          number;   // 0.0–1.0; 0 = off (no-op fast path)
  sensorAngle:    number;   // degrees, 5–90; default 30
  sensorDistance: number;   // pixels (model-space scaled), 5–50; default 20
  turnSpeed:      number;   // degrees per step, 5–90; default 45
  decayRate:      number;   // per-frame trail decay, 0.01–0.5; default 0.05
  depositAmount:  number;   // per-particle per-frame deposit, 0.01–1.0; default 0.3
  showTrail:      boolean;  // render trail texture as screen overlay; default true
  trailOpacity:   number;   // overlay opacity, 0.0–1.0; default 0.35
  /**
   * The trail overlay's colour — v8 Step 9.3. Default `'(Preset)'`.
   *
   * ⚠️ **OPTIONAL, and read as `?? PHYSARUM_TRAIL_COLOUR_PRESET` — deliberately a flat scalar, per
   * invariant 14.** A nested block would need a `MigrationLayer` backfill because `Object.assign` copies
   * only PRESENT keys, so an old export would inherit whatever the live session had chosen; one optional
   * string cannot. Every export written before this step therefore reads back as `'(Preset)'`, which is the
   * pre-9.3 fixed orange **exactly** (`u_useLut = 0` computes the old expression, not an approximation of
   * it).
   *
   * Three kinds of value, and the string is a UNION of two vocabularies rather than an enum:
   * - `PHYSARUM_TRAIL_COLOUR_PRESET` (`'(Preset)'`) — the legacy orange. No LUT is uploaded at all.
   * - `PHYSARUM_TRAIL_COLOUR_AUTO` (`'(Auto)'`) — follow the figure: the film look's palette if it has one,
   *   else the active material's `colourRamp`, else the orange. ⚠️ **The resolution order is
   *   `resolvePhysarumTrailLut()`'s alone (invariant 17: ONE reader) and it deliberately MIRRORS the
   *   engine's own `palette > material ramp > preset colour` precedence** — not a new order.
   * - anything else — a palette name as `getPaletteLUT()` spells it, i.e. any of the 32 entries
   *   `getAllPaletteNames()` returns (12 cosine, 13 `Classic: `, 7 `Material: `). **Typed `string`, not a
   *   narrow union, because that is how `FilmLookParams.palette` is typed and this value goes to the same
   *   resolver** — a second, narrower spelling of one vocabulary is how the two drift apart.
   *
   * ⚠️ **An unresolvable name degrades to the orange, never to black** — the same rule the dye's `'dye'`
   * source follows. A hand-edited import naming a palette that does not exist must not blank the overlay.
   */
  trailColour?:   string;
}

export interface FluidAdvectionConfig {
  blend:       number;  // γ: 0.0–1.0; 0 = off (no-op fast path)
  returnForce: number;  // k spring constant, 0.0–5.0; default 1.0
}

export interface BuoyancyConfig {
  enabled: boolean;
  strength: number;      // 0–5, upward force per unit temperature
  returnForce: number;   // 0–5, exponential decay rate for offset
  turbulence: number;    // 0–1, lateral random perturbation
  maxOffset: number;     // pixels, safety cap
  curlOctaves: boolean;       // enable 3-octave simplex curl noise (default true)
  smokeThreshold: number;     // temperature below which particles become smoke (0-0.5)
  smokeOpacity: number;       // max opacity of smoke particles (0-1)
  smokeDissipation: number;   // per-frame smoke fade rate (0.9-1.0)
}

export interface SparkConfig {
  enabled: boolean;
  poolSize: number;           // 100–1000, pre-allocated pool
  threshold: number;          // 0–1, normalized velocity threshold for spawn
  // ⚠️ **The slider is `0.1 – 3.0` step 0.1 (`tabs/materials.ts`), NOT the 0.5–3.0 this comment claimed**,
  // and the multiplicand is the particle's own per-frame screen motion in px/s (`lissajous.ts`'
  // `frameMotion`), which varies ~140x across the library — so the same number is a different speed in
  // every preset. Eleven of fourteen shipped values sit at 0.1 or 0.4 after the 2026-09-17 re-fit, and
  // five of them are AT the floor rather than at a chosen value.
  ejectionSpeed: number;      // 0.1–3.0, multiplier on the particle's own screen speed at spawn
  gravity: number;            // 0–500, pixels/s²
  drag: number;               // 0–5, linear drag coefficient
  minLifetime: number;        // seconds
  maxLifetime: number;        // seconds
  coolingRate: number;        // 0–5, spark-specific cooling
  /**
   * Spark rendering radius in the SAME units as `MaterialConfig.splatRadius`, 1–8.
   *
   * ⚠️ **WIRED 2026-08-29 — it had zero readers for its whole prior existence, and the library's authored
   * values PROVE the intent it was not honouring.** Sparks are concatenated into the published particle
   * arrays (`lissajous.ts`'s `sparkBase = this.particleCount`), so they took the ordinary particle size
   * path and drew at the MATERIAL's radius.
   *
   * **Measured 2026-08-29 by brace-matching every `sparks:` block: 16 blocks, ALL 16 authoring this field,
   * at 2/3/4 px — against paired material radii of 3–14 px. 12 of the 16 are `enabled: true`.** So every
   * spark in the library was drawing **1.3×–7.0× too large** (1.5×–4.0× among the enabled ones; the 7.0×
   * worst case is `Smoke Cathedral`, whose sparks are off). Unanimously larger, never smaller, across five
   * separate preset files and three authors' sittings — which is what makes the authored numbers evidence
   * of INTENT rather than noise. A spark is meant to be a small bright fleck thrown off the body.
   *
   * ⚠️ **Consumed via `gl_InstanceID` against the slot partition, NOT via a per-instance attribute, and
   * that is a deliberate cost decision.** The splat VAO already carries ten per-instance buffers; an
   * eleventh would be uploaded every frame for a value that is piecewise-constant over exactly three
   * contiguous ranges, and would put a new buffer under invariant 6 (both passes sharing the VAO must
   * upload every per-instance buffer at the correct length — the defect that once turned the whole preview
   * black). `[wave][sparks][liquid][crystals]` is already published as
   * `waveCount`/`liquidCount`/`crystalCount`, so the shader selects the radius by index instead: three
   * uniforms, no buffer, no length to get wrong.
   *
   * ⚠️ **The neutral case is the EMPTY RANGE, so sparks-disabled is byte-identical by construction** —
   * with no sparks published, `waveCount === count - crystalCount - liquidCount` and the spark branch is
   * unreachable for every instance. That is what makes this change invisible on all 177 legacy presets (none
   * carries a `sparks` block) and on the 4 library presets whose sparks are authored but `enabled: false`.
   */
  splatRadius: number;
  maxSparksPerFrame: number;  // 1–20, spawn budget per frame
}

/**
 * The advected dye field — **LIVE since v8 Step 15.7 (2026-09-03). This block was import-compatibility
 * only for three weeks; it is now READ.**
 *
 * ⚠️ **DO NOT RE-DELETE IT ON THE STRENGTH OF THIS COMMENT'S HISTORY.** The previous dye field (2 RGBA16F
 * ping-pong textures, 2 FBOs, 3 programs and a four-control Visual FX section) was deleted 2026-08-12 as
 * triage **G14**, because `injectDye`/`advectDye`/`renderDyeOverlay` sat in `fluid-advection.ts` with **ZERO
 * callers anywhere in `src/`** — no dye was ever injected, advected or composited, while ticking `Enable`
 * really did allocate 13 GL objects to draw nothing. That deletion's own note set the terms for a rebuild:
 * *"build it as its own render pass with its calls in the frame loop from the first commit, not as dormant
 * methods."* **Both terms are met** — the owner is `post-processors/dye-field.ts` (`DyeFieldProcessor`) and
 * `main.ts` calls `inject()` and `step()` from the frame loop. So the reader test that condemned the first
 * version now passes; ⚠️ **`grep` for `DyeFieldProcessor` before believing otherwise.**
 *
 * ⚠️ **This type SURVIVED the deletion unchanged, which is why 15.7 needed no `MigrationLayer` backfill and
 * why a preset exported before 2026-08-12 imports straight into the live field.** Every field kept its
 * original name and meaning, with one range widening called out below. **Do not rename any of them** — that
 * compatibility is the whole reason the block was left on disk.
 *
 * ⚠️ **`opacity` is NOT an overlay composite opacity any more, despite being the same number.** The dye is
 * no longer a translucent overlay (that framing is what got `E57` cut): it enters the liquid surface as
 * `LiquidTintSource` `'dye'` and is the surface's **albedo**, so this scalar is now the per-particle DEPOSIT
 * WEIGHT — how much dye a splat lays down per frame. Higher values saturate the field faster rather than
 * making a layer more opaque. The old semantics had no readers, so nothing regressed.
 */
export interface DyeFieldConfig {
  enabled: boolean;
  /**
   * Multiplicative per-frame survival, 0.90–1.0 (1.0 = never fades).
   * ⚠️ **It is a SURVIVAL fraction, not a decay rate, in spite of the name** — 0.99 fades slowly and 0.90
   * fast. The name is kept for import compatibility (see the type's own warning); `dye-field.ts` clamps it
   * to [0,1] because a value above 1 in a feedback loop is unbounded gain, invariant 19's shape.
   */
  decayRate: number;
  /** 0–1 deposit weight per particle per frame — see the type's `opacity` warning; NOT a composite opacity. */
  opacity: number;
  /**
   * What colour each particle deposits.
   *
   * ⚠️ **`'depth'` was added 2026-09-03 (the third 15.7 defect round) because the OTHER FOUR CANNOT DELIVER
   * THE FEATURE'S POINT, and the reason is a property of the read rather than of any one source.** The surface
   * resolves the field as `rgb / a`, which is SCALE-INVARIANT — so a source that deposits ONE colour
   * everywhere makes the whole field return that one colour, and Amount, Decay, Radius and Advection are all
   * divided away. What the subsystem exists to show is two differently-coloured regions **mixing along the
   * flow**, and that needs the deposited colour to VARY ACROSS THE FIGURE. Of the sources available:
   *
   * - `'fixed'` — cannot vary, by construction. Self-evident and inert.
   * - `'temperature'` — varies genuinely, but **needs a live material** (`state.temperatures` is otherwise
   *   all-zero, so every particle deposits ramp index 0: one flat colour again).
   * - `'velocity'` — varies, but derives from `state.colors`, so it deposits **the figure's own colour dimmed**
   *   and reads as the figure going dark rather than as a new colour appearing.
   * - `'depth'` — varies, needs **no material**, and is the only one of the four with both properties.
   *
   * So `'depth'` is the neutral DEFAULT and the others are the interesting choices once the wake is legible.
   * ⚠️ **Do not "simplify" the list back to three: the omission is what made the feature read as inert across
   * three sittings.** `state.depths` is always populated by every generator, which is why this needs no
   * fallback path and no UI gating.
   *
   * ## `'palette'` (2026-10-15) — the fifth source, and it exists because the palette had NO reach here
   *
   * ⚠️ **UNDER `LiquidTintSource` `'dye'` THE PALETTE DROPDOWN CONTROLS NOTHING, AND ALL THREE ROUTES IT
   * COULD HAVE TAKEN ARE CLOSED BY DESIGN.** The surface's palette branch is `uTintSource == 1` only, so it
   * is not taken; `uRamp` resolves to `liquid.surfaceRamp` through `liquidRampName()`, never to a palette;
   * and `colourMix` is forced to 0 for dye (`hdr-particle.ts`, the `mixAmt` line) so the per-particle colour
   * field cannot carry one either. Reported by the owner as *"this cannot be controlled well via normal
   * palette selections"* — which was exactly right, and is a property of the pipeline rather than a defect
   * in any one file.
   *
   * ⚠️ **THERE WAS ONE PRE-EXISTING ROUTE AND IT IS NOT A SUBSTITUTE: `paletteMapping: 'index'` plus this
   * field set to `'velocity'`.** (⚠️ **Spelled "this field set to" on purpose, and the first draft of this
   * paragraph FAILED `facetcheck` §B by not doing so.** §B and `coveragecheck` §D both read this union out
   * of the DECLARATION with a text scan anchored on the field NAME followed by a colon, and the class they
   * consume the members with matches newlines — so one prose mention of the name-plus-colon ANYWHERE above
   * line 222 hands both checkers a vocabulary scraped out of this comment. The observed failure read
   * `declared ["velocity","velocity","depth","depth"]`. Name the field without its colon above the
   * declaration, here and in any future paragraph.) `index` is the one CPU-side mapping —
   * `palette-selection.ts` hands `a`/`b`
   * to `LissajousGenerator`, which writes `state.colors`, which `'velocity'` reads. So the palette did
   * reach the dye, through two unrelated dropdowns, speed-dimmed by the 0.35–1.0 factor, and only for that
   * one mapping out of seven. **Do not delete `'velocity'` on the strength of this member** — they measure
   * different quantities, and that path is what some authored bodies rely on.
   *
   * ⚠️ **IT IS `'depth'` WITH A DIFFERENT RAMP, DELIBERATELY, AND THE SHARED COORDINATE IS THE WHOLE
   * DESIGN.** `'depth'` is the default precisely because a near/far split is the one spatial variation that
   * needs no material, and the surface resolves the field as `rgb / a` — so a source that cannot vary
   * across the figure makes every dye slider inert (see the four bullets above). Reusing the depth
   * coordinate means this member inherits that property instead of having to re-establish it; what changes
   * is only WHICH ramp the coordinate indexes. **Do not re-coordinate it to the particle index** without
   * measuring the mixing: adjacent indices are adjacent in space, so an index ramp deposits a smooth
   * gradient along the curve and the two ends never meet to mix.
   *
   * ⚠️ **It DEGRADES to `'depth'`'s own ramp when no palette resolves**, which is the same shape as
   * `tintSource: 'material'` degrading to `'ramp'` and as `resolvePhysarumTrailLut()` degrading to the fixed
   * orange: three legitimate cases reach it (`'none'`, `PALETTE_UNSET`, and a name `getPaletteLUT` does not
   * know), and **the one answer it must never give is black** — the field is the surface's ALBEDO, so black
   * dye is a black body and is indistinguishable from the field being off.
   *
   * ⚠️ **The hue rotation (`overlay.paletteHueShift`, `Warmth`) applies here too.** `26.4`'s own note says
   * the rotation goes to "the same four consumers, from the same one place"; this is the FIFTH, and a
   * consumer that read the LUT unrotated would make `Warmth` move the figure and not the dye.
   */
  colourSource: 'temperature' | 'fixed' | 'velocity' | 'depth' | 'palette' | 'ramp' | 'figure';
  /*
   * ⚠️ **THE THREE v8 28 FIELDS BELOW ARE OPTIONAL WHILE THE SEVEN ABOVE ARE REQUIRED, AND THAT ASYMMETRY
   * IS DELIBERATE.** Invariant 14: *prefer flat scalars read as `?? default`*. Required would have been
   * defensible — `tsc` found all six authored blocks the moment they were added, which is the safety the
   * stricter type buys — but it would have meant editing six LIBRARY presets to write values that are
   * their own defaults, and a diff touching authored preset bodies to add a no-op is the shape under
   * which a real retune hides. **Optional also models the common case honestly: every pre-28 export has
   * these keys ABSENT, not set.**
   *
   * ⚠️ **SO EVERY READER MUST SPELL ITS OWN `??` DEFAULT, AND THE DEFAULT MUST EQUAL
   * `DEFAULT_DYE_CONFIG`'s.** The apply site spreads that constant first, so at RUNTIME the resolved
   * config always has all three — but the Mixer, the export gate and the checkers read authored blocks
   * directly, where they may be absent.
   */

  fixedColour: [number, number, number];  // RGB 0-1
  /**
   * v8 28.4 (`28.D2`) — the dye's OWN gradient name, read only when `colourSource === 'ramp'`.
   *
   * ⚠️ **THIS MEMBER EXISTS BECAUSE NO OTHER SOURCE IS BOTH INDEPENDENT AND VARYING.** `'velocity'` reads
   * the figure's own `state.colors`; `'temperature'` and `'depth'` borrow `material.colourRamp` and fall
   * back to the hardcoded `'fire'` / `'ice'` with no material; `'palette'` reads the same palette the
   * figure uses; `'fixed'` is independent but FLAT, and 15.7 measured that flatness as having *"removed
   * the last variation"*. `'ramp'` is the missing combination, and it matters most in the case 28.5
   * creates: a figure-free dye with no material, where `'depth'` would paint everything ice-blue.
   *
   * ⚠️ **It MUST NOT read `material.colourRamp`** — if it did it would be `'depth'` with extra steps.
   * Resolved through `getPaletteLUT()`, so the whole palette namespace is reachable (`Classic: `,
   * `Material: `, `Cycle: ` and the bare cosine names). Degrades to `'depth'`'s own ramp and **never to
   * black**, the same rule `'palette'` follows.
   */
  ramp?: string;
  /**
   * v8 28.3 (`28.D1`) — how the dye OVERLAY composites, outside `liquid` mode. Owner decision: both.
   *
   * ⚠️ **THE TWO ARE NOT A BRIGHTNESS CHOICE, THEY ARE DIFFERENT STEADY STATES, and the algebra is the
   * reason the control exists.** Each frame the overlay composites into a buffer that then decays by
   * `k` (`renderer.decayFactor`), so for dye colour `C` at composite alpha `a` the fixed point is
   * `aC / (1 - (1-a)k)` under `'over'` but `aC / (1 - k)` under `'add'`. At `a = 1`, `k = 0.85` that is
   * **1.0x C against 6.67x C**. So `'over'` is SELF-LIMITING and cannot blow out, while under `'add'`
   * **Trail Decay becomes a brightness control for the dye** and climbs steeply toward `k = 1`.
   *
   * ⚠️ **`'over'` is the default and is byte-identical to the in-surface wake's own algebra**, so the 5
   * library presets whose dye is visible today keep their exact look and there is no seam between the two
   * paths. ⚠️ **`'over'` also ATTENUATES the destination by `(1-a)`** — the same term that bounds it — so
   * where the dye is dense it erases the figure's trail history. That is a look, not a defect, but it is
   * why a long-trail preset can appear to lose its trail inside the dye.
   */
  blendMode?: 'over' | 'add';
  /**
   * v8 28.5 (`28.D3`) — draw the wave figure, or hide it and keep only its stirring. Default `true`.
   *
   * ⚠️ **HIDING IS NOT A RENDER MODE.** `RenderMode` buys type safety and not enumeration coverage: there
   * is no exhaustive `switch`, the code is `if`-chains falling through to `star`, so a seventh member
   * would compile and silently render as `star` until every chain was visited. This is a DRAW
   * SUPPRESSION on the existing modes.
   *
   * ⚠️ **It hides the CURVE ONLY** — `[0, state.waveCount)` of the canonical `[wave][sparks][liquid]
   * [crystals]` partition. Sparks, the liquid pool and the crystals keep drawing, which is deliberate:
   * injection already reads `waveCount` and excludes the other three, so the hidden population is
   * exactly the stirring population.
   *
   * ⚠️ **THE READER FORCES IT TRUE WHENEVER THE DYE IS NOT DRAWING** (`dyeOverlayActive()`), so a preset
   * cannot author a hidden figure with no dye and reach a black frame with nothing on screen to explain
   * it. ⚠️ **The UI row is NOT disabled when that happens** — rows disabled behind a gate is a standing
   * never-re-propose; the stored value is what you set BEFORE ticking the gate.
   */
  showFigure?: boolean;
  /**
   * v8 28.16 (`28.D13`) — which coordinate the three RAMP sources index.
   *
   * ⚠️ **IT APPLIES TO `depth`, `palette` AND `ramp` ONLY** (`28.D17`). `temperature` is indexed BY
   * temperature, and `velocity` / `figure` / `fixed` read no ramp at all, so an index coordinate there
   * would be a control with nothing to move. The UI hides the row for those four.
   *
   * ⚠️ **TWO COORDINATES, TWO END RULES, ONE SHARED TEXEL LOOKUP (`28.D18`).** `depth` reaches 1.0
   * exactly — a particle at the far plane — so it uses an integer texel modulo with an exact identity at
   * hue shift 0, *precisely so a `fract()` cannot wrap the far end onto the near end and swap the two
   * colours the near/far split exists to separate.* `index` WRAPS on purpose, because cycle counts above
   * 1 are its normal case. **Do not unify the end handling; do not give `index` its own texel lookup.**
   */
  mapping?: 'depth' | 'index';
  /**
   * v8 28.16 — how many times the ramp repeats across the particle population under `mapping: 'index'`.
   *
   * `t = fract((i / count) * cycles)`. ⚠️ **A SINGLE SCALAR BY OWNER DECISION (`28.D13`)** — the
   * per-channel alternative mirrors the figure's own law and yields interference colours the ramp does not
   * contain, and it was offered and declined. The figure's route still provides it.
   *
   * ⚠️ **A WRAPPING RAMP WALK HAS A SEAM wherever the ramp's last colour meets its first, and that is
   * inherent rather than a defect** — the figure's LUT branch has it too. A cyclic gradient hides it; a
   * linear one does not. **Do not try to fix it by blending the ends.**
   *
   * ⚠️ **THE USABLE RANGE IS BOUNDED BY SPATIAL AVERAGING, NOT BY THIS FIELD.** The dye read is
   * `rgb / a`, a weighted MEAN of every deposit on a texel, so roughly `Dye Radius / index spacing`
   * consecutive particles are averaged together. Bands survive while one cycle spans many more particles
   * than that: `cycles << particleCount * spacing / radius`. A dense figure washes out at a setting a
   * sparse one bands cleanly at.
   */
  cycles?: number;
  /**
   * Splat radius in **CANVAS PIXELS**, 2–64.
   * ⚠️ **The range widened from the pre-deletion 1–8 and that is deliberate, not a drift** — the field is a
   * fixed 512², so at a 1024×768 canvas 8 px converts to about 5 field pixels: the old top of the range
   * deposited a near-invisible speck. Old exports carrying 1–8 still import and still work; they simply
   * lay down fine dye. The conversion divides by `min(w,h)`, never per-axis (invariant 26).
   */
  injectionRadius: number;
  /**
   * 0–2, how strongly the velocity field displaces dye per frame.
   * ⚠️ **It scales a UV DISPLACEMENT PER 60 Hz FRAME, not a velocity**, so no `dt` enters the advect shader —
   * `FluidAdvectionProcessor.sampleVelocity`'s doc owns that unit and `dye-field.ts` restates why.
   */
  advectionStrength: number;
}

// ⚠️ `DEFAULT_DYE_CONFIG` lives in `generators/material-presets.ts` beside every other overlay-block
// default, NOT here — `types.ts` declares no defaults at all and adding the first one would make the
// convention ambiguous for the next block.

/**
 * Volume render mode's own parameters. All three are READ (`hdr-particle.ts`'s volume pass).
 *
 * ⚠️ **A fourth field, `velocityStretch: number`, was DELETED on 2026-08-29 after measuring that it had
 * zero readers — and the reason it can never be wired as declared is a property of the PRIMITIVE, not an
 * oversight.** `renderVolume` draws `gl.POINTS`, whose `gl_PointSize` is a single SCALAR: a point sprite
 * has no axis, so "elongation along velocity" is not a thing the pass can express at any value. The volume
 * VAO carries only `aPosition`/`aTemperature`/`aDepth`/`aColor` — no velocity attribute of either kind —
 * so honouring the field would mean converting volume accumulation to instanced quads (a new primitive,
 * two new per-instance attributes, a new VAO). That is a feature proposal, not a wiring fix, and its reach
 * was measured at **zero**: no preset in the library authors a `volumeRender` block at all, and
 * `renderer.mode === 'volume'` in 0 of the 177 legacy presets.
 *
 * ⚠️ **`MaterialConfig.velocityStretch` IS LIVE and is a DIFFERENT FIELD — do not follow a grep hit here
 * to the conclusion that this one worked.** That one drives the splat quad's flame elongation via
 * `uFlameParams.y`, it interpolates in the Mixer, and the Materials tab has a slider for it. The shared
 * identifier is exactly why this field survived audits: searching for the name lands on a live
 * implementation. Disambiguate by the CALL SITE's surrounding context, never by the name.
 *
 * Removal is safe for imports: the field was optional in practice (every reader spread
 * `DEFAULT_VOLUME_CONFIG` first) and TypeScript ignores unknown keys in a JSON parse, so an older export
 * carrying `"velocityStretch": 0.5` inside its `volumeRender` block still loads — the key is simply
 * dropped, which is what already happened to its value on every frame.
 */
export interface VolumeRenderConfig {
  extinction: number;         // 0.1–10, Beer-Lambert extinction coefficient
  densityScale: number;       // 0.1–5, multiplier on accumulated density
  depthFade: number;          // 0–1, depth-based opacity reduction
}

/**
 * v8 Step 15.1 (E84) — the `liquid` render mode's own parameters.
 *
 * The mode accumulates a **Wyvill** density field `(1−r²)³` into an R32F target and thresholds it, so two
 * particles whose fields sum past the threshold **in the gap between them** become ONE closed shape with a
 * single outline. That is what additive splats structurally cannot do (two sprites get brighter, never
 * merge), and it is the whole basis of Phase 15.
 *
 * ⚠️ **`isoLevel` IS A RATIO, NOT A RAW THRESHOLD, and that is a derivation rather than a taste choice.**
 * The library's particle counts span 5× (legacy median 4000; engine liquid presets 10 000–20 000), so a raw
 * accumulated-weight threshold tuned at one end shows *nothing at all* at the other — invariant 25's shape,
 * a control confidently describing a surface that never formed. The shader therefore compares against a
 * measured density REFERENCE, whose full derivation, constants and measurements live in **ONE owner,
 * `renderers/liquid-reference.ts`** — read it before changing any of this. In outline:
 *
 * ```
 *   ∫(1−ρ²)³ dA over a disc of radius R  =  2πR²∫₀¹(1−u²)³u du  =  πR²/4      // area integral
 *   ∫(1−(x/R)²)³ dx over [−R,R]                                 =  32R/35     // LINE integral
 *   dMean  = N·πR²/(4·W·H)                    // the FRAME mean — now only a LOWER BOUND
 *   dLine  = (32/35)·R / spacing              // density ON the curve, `spacing` MEASURED per frame
 *   ref    = CALIBRATION · max(dLine, dMean, 1e-3)      // then EMA-smoothed, τ = 0.25 s
 *   thr    = isoLevel · ref
 * ```
 *
 * So **`isoLevel` 1.0 means "the surface forms at the typical half-eroded density"**, at any particle count,
 * any canvas and any `kernelWidth`. ⚠️ **THE FRAME MEAN ALONE WAS THE 15.1 DEFECT AND IS RETAINED ONLY AS A
 * FLOOR**: a Lissajous figure is a 1-D locus covering 1–19 % of the frame, so the ratio between on-curve and
 * frame-mean density is a per-preset number spanning two orders of magnitude — measured, the `isoLevel` at
 * which the surface half-erodes spread **21×** across 15 figures, i.e. one authored value could not mean one
 * look. It is 4.9× with the reference above. Reported as *"only very low levels of Iso Level make sense"*.
 *
 * ⚠️ **The `R` handed to the uniform must be the CLAMPED radius** (`ALIASED_POINT_SIZE_RANGE[1]`): a point
 * sprite that the driver shrank has a different `R` in the shader than the one the CPU requested, and the
 * derivation silently stops holding — invariant 10 at a boundary.
 *
 * ⚠️ **THE RAMP COORDINATE DIVIDES BY ITS OWN SCALE (`LIQUID_THICKNESS_DEPTH · ref`), NEVER BY `thr`.** 15.1
 * used `thickness = (d − thr)/thr`, which made Iso Level erode the silhouette AND drag every surviving texel
 * toward `thickness = 0` — near-black and transparent on the `liquid` ramp. The two losses multiplied:
 * measured over the old track, coverage fell 5× while total on-screen light fell **10×**, which is why the
 * report said "invisible" rather than "smaller".
 *
 * ⚠️ **`tintSource: 'ramp'` + `surfaceRamp` is the engine's EXISTING idiom for an authorable colour, and it
 * replaced a `Fixed` + colour-picker pair the spec had asked for.** `src/` contains no colour-input
 * primitive at all — every Visual FX control is a slider, a checkbox or a select — while `crystalRamp`
 * already establishes `ColourRampName` as how a subsystem names its own colour. It also gives a GRADIENT
 * indexed by density rather than one flat fill, which is what makes a blob read as a substance, and
 * `liquid` is already the library's most-used ramp (39 uses). ⚠️ **Both `tintSource` and `surfaceRamp` are
 * CATEGORICAL, so the Mixer must SNAP them at t=0.5** (invariant 16) — a lerp between two ramp names is not
 * a ramp.
 *
 * The other three sources reuse the engine's ONE precedence order (palette > material ramp > preset colour)
 * rather than inventing a fourth rule. ⚠️ **A material IS permitted in this mode and is NOT the splat
 * path**: liquid ignores `coreBrightness`/`haloStrength`/`velocityStretch` (there is no quad to shape) but
 * DOES read `colourRamp` by per-particle temperature under `tintSource: 'material'` — the inverse mistake,
 * assuming a material does nothing here, would make `LiquidLight`'s ramp look dead.
 */
export interface LiquidSurfaceConfig {
  /** Threshold in multiples of the measured density reference. Low = fat merged blobs, high = tight droplets. */
  isoLevel: number;
  /** Per-particle field radius multiplier. With `isoLevel`, sets how far apart two drops still merge. */
  kernelWidth: number;
  /** `smoothstep` half-width on the threshold. 0 = hard boundary (paint), 1 = feathered (mist). */
  edgeSoftness: number;
  /** Where the surface colour comes from. CATEGORICAL — the Mixer snaps it. */
  tintSource: LiquidTintSource;
  /** The ramp used when `tintSource` is `'ramp'`, indexed by normalised density. CATEGORICAL. */
  surfaceRamp: ColourRampName;
  /**
   * v8 Step 15.2 (E85). How far the surface's colour comes from the **particles that formed each pixel**
   * rather than from `tintSource`. 0 = pure `tintSource` (byte-identical to 15.1), 1 = pure per-particle
   * weighted mean. It **composes with** all four sources rather than being a fifth one — see the block
   * comment on `LiquidColourMixModel` for why.
   */
  colourMix: number;
  /** How two differently-coloured particles combine where they overlap. CATEGORICAL — the Mixer snaps it. */
  mixModel: LiquidColourMixModel;
  /**
   * v8 Step 15.3 (E86). Internal scatter depth — **crystal's `internalRefraction`, same name and same 0–1
   * range**, spent on the surface's own thickness rather than on a background sample. The block comment BELOW
   * this interface records why a background read was specified, measured and rejected.
   */
  refraction: number;
  /**
   * Specular glint strength. **Crystal's `specularStrength` range, 0–4** — taken from crystal rather than from
   * the step's own spec, which wrote 0–3 while instructing that the ranges be crystal's verbatim.
   */
  specular: number;
  /** Beer–Lambert absorption through the body, in nepers per unit thickness. 0 = no absorption. */
  thickness: number;
  /** Fresnel rim brightness. **Crystal's `edgeBrightness` range, 0–4.** */
  edgeBrightness: number;
}

/**
 * v8 Step 15.4 (E87) — **Cohesion.** Short-range attraction between nearby particles, integrated into a
 * persistent per-particle positional offset so the curve beads up into travelling droplets that collide and,
 * with the `liquid` iso-surface live, visibly fuse. This is where relationship (A) — *the figure IS the
 * liquid* — reaches its limit: the figure stops being a curve and becomes a population of drops.
 *
 * ⚠️ **THIS IS A GENERATOR BLOCK, NOT A RENDERER ONE, AND THAT IS WHY IT IS SEPARATE FROM `overlay.liquid`
 * RATHER THAN A FIELD INSIDE IT.** `LiquidSurfaceConfig` is read ONLY while `renderMode === 'liquid'` (both
 * `main.ts` and the tile renderer gate on that), whereas cohesion moves `positions` and so is visible in
 * every render mode — as beaded point sprites under `star`, as clumped splats under a material. Folding it
 * into the liquid block would have made three controls that work in seven modes disappear from six of them,
 * which is invariant 13's shape reached through a gate rather than through a wire.
 *
 * ⚠️ **`radius` IS IN SCREEN PIXELS, unlike `clusterForceRadius`, which is in MODEL units** — the stage runs
 * after the perspective projection, beside fire buoyancy, precisely so this unit is meaningful (invariant 10
 * at a subsystem boundary; the two fields would read as the same quantity from their names alone).
 *
 * All three fields interpolate **LINEARLY** in the Mixer, and `strength: 0` is the one neutral value — so a
 * geometric lerp could not reach it, exactly as for `colourMix` and 15.3's four material fields.
 */
export interface CohesionConfig {
  /**
   * How hard a particle is pulled toward the centre of mass of its neighbourhood. **0 = INERT and
   * byte-identical to 15.3** on every existing preset, which is what makes the whole step additive.
   */
  strength: number;
  /**
   * Neighbourhood radius in **SCREEN PIXELS**. This is the drop-SIZE control: measured on `Liquid Surface`
   * at 15 000 particles, r = 4 / 8 / 16 / 24 / 40 / 64 gives 101 / 173 / 103 / 66 / 30 / 4 connected blobs of
   * median 55 / 52 / 53 / 87 / 207 / 1085 px.
   */
  radius: number;
  /**
   * Spring rate back to the mathematical curve position, in the same unit `clusterForceReturn` and the force
   * gate's half-life speak (nepers per second).
   *
   * ⚠️ **THIS IS THE STEP'S CORRECTNESS CONDITION, NOT A REFINEMENT.** With no spring the drops keep
   * coalescing — measured at `strength: 1`, `radius: 24`, 90 s: mean offset plateaus at 47.9 px with the
   * population pinned against the internal cap — and the figure collapses toward a single ball, i.e. the
   * trajectory identity that every one of the 177 presets exists to express is simply gone. It also doubles
   * as a second drop-size control (median blob 51 → 171 px over 0.25 → 5) because a stiffer spring lets a
   * drop recruit only its immediate neighbours.
   */
  returnForce: number;
}

/*
 * v8 Step 15.3 (E86) — refraction, specular and thickness on the liquid surface. **Four controls, three of
 * them crystal's own names and ranges verbatim** (`internalRefraction` → `refraction`, `specularStrength` →
 * `specular`, `edgeBrightness`), because the crystal pass already proves this combination reads as a
 * material and a second vocabulary for one concept is how a user concludes the two subsystems are unrelated.
 *
 * ⚠️ **THE SPEC'S REFRACTION MECHANISM — "sample the trail buffer offset by the normal" — WAS MEASURED AND
 * REJECTED, AND THE SPEC CONTRADICTED ITSELF ABOUT IT.** The same step also mandates *"use the crystal
 * section's names and ranges verbatim"*, and crystal's `internalRefraction` samples **no background at all**:
 * it is `thickness · (0.35 + 0.65·vDepth) · uInternalRefraction` driving a ramp-index shift plus an internal
 * scatter term. Two different mechanisms under one name. Three measurements settled it for the background
 * form, and every one of them is a property of THIS engine rather than of refraction in general:
 *
 * 1. ⚠️ **The surface pass draws INTO the trail FBO, so sampling that texture is a GL feedback loop**
 *    (`renderLiquid` binds the caller's FBO; the tile binds `target`). Only the ping-pong complement is
 *    samplable, which means plumbing a scene texture through two render paths that do not currently receive
 *    one.
 * 2. ⚠️ **There is almost nothing behind the surface to bend.** The trail holds faded history, and at
 *    `Liquid Surface`'s `decayFactor 0.45` the residue is 0.0003 after 10 frames — a 5.8-frame life. The
 *    background behind the blob is essentially black, so a bend would be invisible against it.
 * 3. ⚠️ **A kernel-scale offset lands on the surface's OWN previous position, not on any background** —
 *    14.3's finding reproduced exactly. Per-frame rim displacement at a 300 px rim, 60 fps: `Liquid Surface`
 *    **0.000 px**, `Quader` 0.026, `Bermuda Twister` 0.087, `Cylinder` 0.262, against a ~2 px offset. Only
 *    `Rose` (30 °/s, 2.618 px) exceeds it. So the effect would have measured **inert on the demo preset the
 *    step is judged on**, which is Phase 14's *"not that prominently visible"* outcome by construction.
 *
 * What ships instead reads the **density field**, which is the one thing that certainly has structure here:
 * a thickness-driven ramp shift and internal scatter (crystal's own arithmetic), plus **chromatic dispersion
 * derived from the surface's own gradient** — R and B sampled at ±offset along the normal, which is a real
 * refractive cue and is visible against a black background because it is generated by the surface, not by
 * what is behind it.
 *
 * ⚠️ **THE DISPERSION OFFSET IS A FRACTION OF THE KERNEL RADIUS, NOT A TEXEL COUNT, AND THAT WAS MEASURED
 * BOTH WAYS — invariant 26's shape in a third guise.** A fixed texel offset is not scale-invariant: median
 * chromatic delta at 8 texels is **0.1006 at R = 6.08 px and exactly 0.0000 at R = 2.5 px**, because past the
 * kernel's own support both taps read the same clamped edge value and the difference vanishes. Expressed as
 * `REFRACT_SPREAD · R` it holds within 2.5× across a 6× kernel range (measured at frac 0.35 over
 * R = 2, 4, 6.08, 12: 0.104 / 0.092 / 0.072 / 0.045). **A displacement in an image-domain operator must be
 * expressed in the units of the structure it is displacing**, and here that structure is the kernel.
 *
 * ⚠️ **THE SPECULAR EXPONENT IS 16, NOT CRYSTAL'S 42, AND THE DIFFERENCE IS THE NORMAL RATHER THAN TASTE.**
 * Crystal's `pow(…, 42)` sits on a **faceted** normal that is piecewise constant, so a tight lobe produces
 * one glint per face. The liquid normal is a **smooth** central difference, where the same exponent lights
 * 17.26 % of the surface as a broad wash instead of a highlight. Measured fraction of surface pixels with
 * lobe > 0.25: pow 8 → 68.6 %, pow 16 → 45.2 %, pow 42 → 17.3 %, pow 64 → 11.5 %. ⚠️ **The naive reading of
 * that table is backwards** — a *smaller* lit fraction looks like a tighter highlight, but on a smooth normal
 * the lobe's own peak barely moves (0.999 → 0.988), so a high exponent does not sharpen the glint, it merely
 * dims the whole surface uniformly. 16 keeps a peak that reads as wet while `specular` still owns the
 * strength. **An exponent tuned against one normal does not transfer to a different one.**
 *
 * ⚠️ **THE RIM IS FRESNEL ON `dot(n, view)` AND ITS EXPONENT IS 3, ALSO MEASURED — but the annulus width is
 * the property that matters and it is regime-dependent.** Compared against the alternative signal
 * `(1 − thickness)^k`: on a dense curve the thickness form lights 91.9 % of the surface at k = 1, i.e. it
 * is not a rim at all but a global tint, while the geometric distance `(d − isoRef)/|∇d|` gives a stable
 * annulus (19.2 % of surface at 1 px, 35.3 % at 2 px) on **both** a dense curve and a sparse cloud
 * (25.2 % / 47.3 %). Fresnel `(1 − n·v)³` gives median 0.0001 and p99 0.156 — near-zero over the interior
 * and lifting only where the surface turns away, which is exactly the separation a rim needs. ⚠️ **`n.z`
 * carries `uThickRef · 0.5`, so `dot(n, view)` is already reference-normalised** — this term is
 * count-independent for free, and reintroducing a raw `|∇d|` anywhere in it would break that.
 *
 * ⚠️ **`thickness` (absorption) IS NOT A DUPLICATE OF 15.2's `pigment` MIX MODEL, and the distinction is
 * which quantity each one reads.** `pigment` deepens by `wSum`, the **weight sum of contributing
 * particles** — a colour-mixing statistic that says "many particles agreed here". Absorption is
 * `exp(−thickness · absorbDepth)` on the **density field's own thickness**, which is the surface's geometry
 * and exists at `colourMix = 0` with no colour target read at all. They coexist: measured on a dense curve
 * at `thickness = 1`, absorption leaves the median surface at 0.707 and the p99 core at 0.050 with
 * `ABSORB_SCALE = 3`. ⚠️ **The default is 0.5, i.e. half that**, because at 1.0 a thick core goes visibly
 * toward black and this value feeds the trail's feedback loop.
 *
 * ⚠️ **ALL FOUR DEFAULTS ARE CHOSEN SO THE STEP IS VISIBLE ON THE SHIPPED PRESET WITHOUT RE-AUTHORING IT** —
 * no Phase 15 step may retune a library preset, and 15.2's own finding was that a neutral default ships a
 * step nobody can see. Unlike 15.2 there is no algebraic-identity value to protect here: 15.2's
 * `colourMix = 0` had to stay byte-identical to 15.1 because it was the ONLY way to recover the previous
 * image, whereas this step's four controls each reach neutral independently (`refraction 0`, `specular 0`,
 * `thickness 0`, `edgeBrightness 0`), so `fieldcheck` §O asserts **all four zeros together restore the 15.2
 * image exactly** rather than any single one of them.
 *
 * The four derived constants live on `renderers/liquid-reference.ts` (`REFRACT_SPREAD`, `SPEC_EXPONENT`,
 * `FRESNEL_EXPONENT`, `ABSORB_SCALE`) beside the reference they are measured against.
 */

/**
 * v8 Step 15.2 (E85) — the "colour drops mixing" step. **What is accumulated is `Σ(colour·w)` and `Σw` in
 * one RGBA16F target beside the R32F density**, divided at threshold time, so the mixing happens in the
 * ACCUMULATION: two overlapping particles of different colour yield one blob whose overlap carries the
 * weighted average, with a transition band where their weights cross. That is ink-in-water, and it is
 * unreachable by any per-particle shading path — a fullscreen threshold pass has no per-particle identity
 * left (15.1 could only offer the figure's MEAN colour, resolved on the CPU).
 *
 * ⚠️ **`colourMix` COMPOSES WITH `tintSource`; IT IS NOT A FIFTH SOURCE VALUE, AND THAT WAS DECIDED BY
 * MEASUREMENT RATHER THAN BY TASTE.** The only liquid preset in the library authors `tintSource: 'ramp'`,
 * and **no Phase 15 step may re-author a library preset** — so a mutually-exclusive `'perParticle'` source
 * would have shipped INVISIBLE on every preset that exists, verifiable only by hand-driving a dropdown.
 * As a blend it reaches all four sources: `tint = mix(resolveSource(), weightedMean, colourMix)`.
 *
 * ⚠️ **THE STEP'S VISIBILITY DEPENDS ON A PROPERTY OF THE DATA THAT THE SPEC NEVER MEASURED, AND IT IS THE
 * FIRST THING TO RE-CHECK IF A FUTURE PRESET SHOWS NOTHING.** The legacy colour formula is
 * `base + sin(n·freq/DEG + pos·shift)·amp` with `n = i·360/N`, i.e. a SMOOTH function of the index — so the
 * mean colour delta between CONSECUTIVE particles on `Liquid Surface` is **2.9e-5**, utterly invisible. A
 * weighted average over a smooth sequence just returns the local value. The step is visible only where
 * pixels receive contributions from **DISTANT** indices, i.e. where the curve crosses itself or two far-apart
 * arcs pass within a kernel radius. Measured on the shipped preset at 1024×768, kw 1.52 (kernel Ø 12.16 px,
 * isoRef 1.073): **62.5 % of surface pixels have contributors spanning more than 0.5 % of the index range**,
 * median index spread **718**, p99 **7859** of 15 000 — so the figure is self-overlapping almost everywhere
 * and the premise holds comfortably. Per-pixel chroma range among contributors: median 0.0108, p99 0.0716,
 * against an 8-bit just-noticeable of ~0.0068 in the same RGB distance. **Deviation of the weighted mean
 * from 15.1's flat tint: median 0.0813 (~21/255), max 0.1186** — the step is a clear visible change, which
 * is why the default is 0.85 rather than 0.
 *
 * ⚠️ **SO THE SPEC'S TWO CLAIMS — "default 0.85" AND "neutral on every existing preset" — CANNOT BOTH HOLD**,
 * because a default merges into every preset that omits the block (`?? DEFAULT`). The default WINS and the
 * neutrality claim is narrowed to what it can actually be: `fieldcheck` §O asserts an **algebraic identity at
 * `colourMix = 0`**, not preset invariance. Stated plainly because the reverse reading — an assertion named
 * "neutral" that only holds at a value the default is not — is exactly the shape that makes a green checker
 * mean nothing (§N's own finding, and invariant 13's).
 *
 * - **`'light'`** — average in linear RGB, `Σ(c·w)/Σw`. Red + green → olive, red + blue → magenta. Matches
 *   the engine's additive/HDR character, every palette and every film look. The default, so an existing
 *   preset's *character* is unchanged even though its colour distribution is not.
 * - **`'pigment'`** — average subtractively, so red + green → dark brown and cyan + yellow → green: what
 *   actually reads as *liquid* colour rather than as coloured light. ⚠️ **It must composite BEFORE bloom**,
 *   or an additive pass downstream re-brightens the mix back toward `'light'` — which it does here by
 *   construction, the surface pass writing into the caller's FBO upstream of `bloom.ts`. ⚠️ **A subtractive
 *   path must clamp at its OWN output**: `acesToneMap` is a rational function and is **NaN at Inf**, it runs
 *   on the screen path, and it is downstream of and unreachable by `sanitiseTrail()` (invariant 20).
 */
export type LiquidColourMixModel = 'light' | 'pigment';

/**
 * `'preset'` = the particle's own oscillating colour; `'palette'` = the film look's LUT; `'material'` = the
 * live material's `colourRamp` by temperature; `'ramp'` = this config's own `surfaceRamp`, by density;
 * `'dye'` = v8 Step 15.7's advected dye field, sampled per pixel.
 *
 * The first three are the engine's one precedence order, named explicitly so the surface can pick a level
 * of it rather than always taking the winner — which is the whole reason this is a control and not a
 * hardcoded lookup.
 *
 * ⚠️ **v8 15.7 (E90): `'dye'` IS A FIFTH *SOURCE*, NOT A SIXTH BLEND — a user decision, and it is what keeps
 * 15.2's identity intact.** The surface resolves colour as `tint = mix(resolveSource(), weightedMean,
 * colourMix)`, so entering as a source leaves that expression's shape — and `colourMix == 0` being an exact
 * algebraic identity — untouched: dye becomes the base the per-particle mean is still blended over. The
 * rejected alternative was a second slider (`mix(tint, dye, dyeAmount)` after the existing mix), which would
 * have put two interacting colour controls in one section for a composition the four other sources do not get.
 *
 * ⚠️ **It is the ONE source with no fallback value of its own**, because it is the only one whose input is a
 * TEXTURE rather than a number the CPU already holds: with the dye field off or its GL resources refused,
 * `'dye'` must resolve to something. It degrades to `'ramp'`, exactly as `'material'` degrades to `'ramp'`
 * when no material is live — the same rule, the same site, so a reader does not have to learn a second one.
 */
export type LiquidTintSource = 'preset' | 'palette' | 'material' | 'ramp' | 'dye';

/**
 * v8 Step 15.5 (E88) — where the standing liquid starts out.
 *
 * ⚠️ **CATEGORICAL, so the Mixer must SNAP it at t = 0.5** (invariant 16) — and here the consequence is
 * sharper than for `tintSource`: an interpolated seed pattern is not merely meaningless, it does not exist,
 * because seeding happens ONCE and a crossfade that changed the value mid-run would re-place the whole pool
 * rather than blend it.
 */
export type LiquidSeedPattern = 'fill' | 'cloud' | 'blobs' | 'basin';

/**
 * v8 Step 15.5 (E88) — **Relationship (B): the figure SWIRLS THROUGH a liquid.** A second particle
 * population, seeded once as standing liquid and thereafter moved only by the velocity field the figure
 * already writes into `FluidAdvectionProcessor`. The curve stays a pure Lissajous figure; this is the
 * response to it.
 *
 * ⚠️ **THIS IS THE THIRD `overlay` BLOCK IN THE PHASE AND IT IS SEPARATE FROM BOTH OF THE OTHERS FOR TWO
 * DIFFERENT REASONS.** Not a field inside `overlay.liquid`, which is read only while `renderMode === 'liquid'`
 * — the pool is a particle population and draws in every mode. Not a field inside `overlay.cohesion` either,
 * even though that block is also generator-owned and also mode-independent: cohesion DISPLACES the existing
 * particles, this ADDS particles, so the two have different neutral states (`strength: 0` versus
 * `enabled: false`) and different costs when off. Folding them would make one gate govern two populations.
 *
 * ⚠️ **`enabled: false` MUST BE BYTE-IDENTICAL TO 15.4** — zero pool particles, `state.count` unchanged, no
 * new buffer uploads, and the field never activated on the pool's behalf. That is the step's own stated
 * requirement and it is what makes this additive over all 360 presets, none of which authors the block.
 *
 * ⚠️ **`fieldCoupling` IS NOT `fluidAdvection.blend` AND CANNOT BE IMPLEMENTED AS IT** — three separate
 * mechanisms forbid it, recorded at the head of `generators/liquid-pool.ts`. The short form: `blend > 0` also
 * gates `advectParticles`, which rewrites the WAVE figure's positions in place, so borrowing it would move
 * the curve as well as the pool and break relationship (B)'s defining property.
 *
 * All three scalars interpolate **LINEARLY** in the Mixer (`enabled` and `seedPattern` are categorical and
 * snap), taking the phase's linear total to twelve. ⚠️ **The asymmetric side splits per field exactly as
 * `interpolateCohesion`'s does, and for the same reason**: `enabled` and `fieldCoupling` fall toward their
 * neutral values so a crossfade into a preset with no pool fades the pool out, while `poolSize`,
 * `seedPattern` and `fieldDecay` are CARRIED — they are the *shape* of a pool that is fading, and lerping
 * `poolSize` toward a default would re-seed the population mid-crossfade.
 */
export interface LiquidFieldConfig {
  /**
   * The whole feature's gate. **Off by default, and off is byte-identical to 15.4.**
   *
   * ⚠️ **A PRECONDITION, SO IT IS STATED INLINE IN THE TAB AND NOT ONLY IN A TOOLTIP** (invariant 25): a
   * tooltip is discovered by someone who already suspects the control, which is not the person who has
   * concluded the feature is broken.
   */
  enabled: boolean;
  /** Pool particles. 0 is a second, equivalent off switch — the pool is skipped entirely at 0. */
  poolSize: number;
  /** Where the pool starts out. CATEGORICAL — the Mixer snaps it. */
  seedPattern: LiquidSeedPattern;
  /** How strongly the figure's velocity field carries the pool. 0 = a perfectly still pool. */
  fieldCoupling: number;
  /**
   * Per-frame persistence of the velocity field itself, 0.95–0.999. Low = the stir dies the instant the
   * figure passes; high = long-lived wakes and eddies.
   *
   * ⚠️ **This is the SAME field `Fluid Feedback` (TransMap style 6) decays, so the two are one resource with
   * two authors** — `applyFluidFeedbackState()` resolves the conflict with a stated precedence rather than
   * letting whichever ran last win, which is the assign-on-entry shape that function's own doc forbids.
   */
  fieldDecay: number;
}

export interface ProceduralFlowConfig {
  strength: number;
  scale: number;
  curlAmount: number;
  direction: [number, number];
  radial: number;
  evolutionSpeed: number;
  archetype: string;
}

/**
 * A TransMap style index — **the ONE spelling of this union in the codebase.**
 *
 * ⚠️ **This type exists because the union used to be written out LONGHAND at seven sites**
 * (`main.ts`'s `primaryTransMapStyle()`, `TransMapConfig.style`, `postProcessors.transMap.style`,
 * `overlay.transMapStyle`, `TransMapLayer.style`, and `get`/`setTransMapStyle` in `visual-fx.ts`, plus a
 * cast at the dropdown). Adding style 7 meant editing all seven, and **missing one is a `tsc` error only
 * if the missed site is assigned from a widened one** — several of them are independent, so a partial
 * edit compiles.
 *
 * Styles 0-6 are the original vocabulary; **7-11 are the Phase 14 image-domain operators, all now BUILT.**
 * The numbering is permanent and gap-free: these values are persisted in `overlay.transMapStyle` and in
 * every `transMapChain` entry of every export ever written, so a renumber would silently repoint saved
 * presets at a different effect.
 *
 * ⚠️ **12 IS RESERVED AND UNBUILT, and the union must stay WIDER than `TRANS_MAP_STYLES`** (`fieldcheck`
 * §J asserts it). The gap is what makes `normaliseChain` DROP an unknown style from an import instead of
 * installing an inert layer, and it is what stops the next style reusing a number some export already
 * holds. When 12 is built, reserve 13 in the same edit — the checker fails the moment the two are equal,
 * which is how this reservation was noticed to have run out when 14.3/14.5/14.7 landed together.
 *
 * ⚠️ **`MigrationLayer` deliberately clamps legacy data to `Math.min(style, 4)`** (`migration.ts`), and
 * that clamp must NOT be widened. Legacy Delphi presets predate styles 5-6 as well as 7-11; a
 * `TransMapStyle` of 7 in a legacy file would be data corruption, not a request.
 */
export type TransMapStyle = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/**
 * Which per-particle attribute gates the TransMap force field (v8 Step 14.4).
 *
 * ⚠️ **A UNION, not a free string**, and the four members are the four `GeneratorState` sources that exist —
 * `'none'`, `state.lifetimes`, `state.temperatures`, `state.depths`. Adding a fifth means adding a real
 * per-particle array, so this list is the honest enumeration of what the engine can gate on. Persisted in
 * `overlay.transMapForceGateBy`, so the SPELLINGS are permanent.
 */
export type ForceGateSource = 'none' | 'age' | 'temperature' | 'depth';

export interface UnifiedPreset {
  metadata: {
    name: string;
    version: 2;
    designResolution: { width: number; height: number };
    createdWith?: string;
    tags?: string[];
  };
  generators: {
    type: 'lissajous' | 'attractor';
    particleCount: number;
    waveSpeed: number;
    rotation: number[];
    angle?: number[];   // initial orientation in degrees (X, Y, Z)
    waves: WaveConfig[];
    colorBase: number[];
    colorAmp: number[];
    colorFreq: number[];
    colorShift: number[];
    attractor?: AttractorParams;
  };
  // A REQUIRED `fields: { active: string[] }` block sat here and was deleted on 2026-08-10 (triage G8).
  // It was written at 14 sites — `migration.ts` synthesised `{ active: [] }` for every legacy preset and
  // 13 hand-authored presets repeated the literal — and read at ZERO. It was reserved for the "Phase 4"
  // force-field registry that `src/fields/index.ts` stubbed and that was never built; the force fields
  // the engine actually shipped (`TransMapForceField`, spark `applyForceField`, the crystal cluster
  // force) are all wired directly rather than named in a preset. Being *required* was the harm: every
  // new preset literal had to carry a meaningless line, and JSON exports advertised a capability that
  // did not exist. Note no legacy JSON contains `"fields"`, so nothing on disk depended on it.
  renderer: {
    mode: RenderMode;
    glow: number;
    decayFactor: number;
    blurRadius: number;
    depthSize: number;
    streaks: number;
    /** @deprecated Use overlay.speedFactor instead. Kept for import compat only. */
    speedFactor?: number;
    /** @deprecated Use overlay.curlNoise instead. Kept for import compat only. */
    curlNoise?: CurlNoiseConfig;
  };
  postProcessors: {
    transMap: {
      enabled: boolean;
      style: TransMapStyle;
      /**
       * Run the warp BEFORE the particle draw. ⚠️ **Inert until v8 Step 14.6 wired it** — it was in the
       * format from the beginning and grep-confirmed never read, invariant 13's shape.
       *
       * ⚠️ Its live twin is `overlay.transMapBeforeParticles`, which WINS (invariant 17, `fieldcheck` §I).
       * The rendering consequence and how to judge it are documented there; do not duplicate the write-up.
       */
      beforeParticles: boolean;
      sinMagicParams: SinMagicParams;
      sinMagicParams2: SinMagicParams;
      zoomCenter: { x: number; y: number };
      ifsParams?: IfsTransform[];
    };
    /**
     * @deprecated NOT READ BY THE PIPELINE. Writing here has no visual effect.
     *
     * Grading is driven **solely** from `FilmLookParams` (ADR 007). `main.ts` initialises
     * `BloomProcessor` from a hardcoded literal and thereafter only ever sets it from a film look, so
     * this block is inert. It survives because all 177 presets and every export carry it — `migration`
     * synthesises it — and because `interpolate`/`evolution-ops`/`preset-stats` still read it.
     *
     * **To change bloom, write `overlay.customFilmLookParams.bloomEnabled` / `.bloomIntensity` with
     * `overlay.filmLook = 'Customize'`** — see `grading()` in `exploration/slider-mappings.ts`.
     *
     * Three things wrote here and silently did nothing until 2026-08-06: the `Glow` slider's bloom
     * half, `applyArchetype`, and the archetype patch fields (defects EX1, EX2). Two of the three are
     * gone — the Archetypes tab was removed 2026-10-04 — so do not grep for `applyArchetype`; the
     * history is kept because the TRAP is this block, not those callers.
     */
    bloom: {
      enabled: boolean;
      threshold: number;
      intensity: number;
      radius: number;
    };
    /**
     * @deprecated NOT READ BY THE PIPELINE. Writing here has no visual effect.
     *
     * Same story as `bloom` above: `ToneMapProcessor` is initialised from a hardcoded literal and then
     * only ever driven from `FilmLookParams`.
     *
     * **To change tone mapping, write `overlay.customFilmLookParams`** — and note `toneMapEnabled` must
     * be set too, since a preset on `Legacy` has it false and patching `exposure` alone changes nothing.
     *
     * The `Mood` slider wrote here and was therefore **entirely inert** until 2026-08-06 (defect EX1).
     * It now writes `overlay.customFilmLookParams` — `exposure` and `saturation`, not `gamma`.
     */
    toneMap: {
      curve: 'aces' | 'reinhard' | 'none';
      exposure: number;
      lift: [number, number, number];
      gamma: [number, number, number];
      gain: [number, number, number];
    };
  };
  /**
   * @deprecated NOT READ BY THE PIPELINE.
   *
   * A parallel grading channel that predates ADR 007. Nothing consumes it: palette and paletteMapping
   * are read from `FilmLookParams`. `applyArchetype` wrote to it until 2026-08-06, which is why
   * archetypes could not change the grade (that function no longer exists — the tab was removed
   * 2026-10-04 — but the dead channel it wrote to is still here, which is the point).
   *
   * **Use `overlay.filmLook`** (a real `FILM_LOOKS` key, applied at `main.ts:780`).
   *
   * `filmLook` was typed `FilmLookName` — six lowercase names, **none of which is a valid `FILM_LOOKS`
   * key** — until triage I11 dropped that import. It is `string` now, deliberately NOT
   * `keyof typeof FILM_LOOKS`: the only writer is `MigrationLayer` (which hardcodes the meaningless
   * `'clean'`), the only readers copy the block wholesale, and narrowing a dead field to a live union
   * would make it look validated. The one thing worth keeping is that no NEW code can reach for a
   * lowercase pseudo-name and have it type-check as a film look — importing `FilmLookName` was the route
   * by which that happened, and it is now gone from this file.
   */
  visualFx?: {
    palette: string;
    /**
     * ⚠️ Omits `velocity` and `temperature`, which the shader DOES implement (E8). Not worth widening,
     * because this whole `visualFx` block is dead — see the note above. The live type is
     * `PaletteMapping` in `renderers/film-looks.ts`, which carries all four.
     */
    paletteMapping: 'depth' | 'phase';
    filmLook: string;
  };
  fractal?: {
    type: string;
    params: number[];
    blend: number;
    bounds: [number, number, number, number];
  };
  overlay?: OverlayState;
}

export type HeatMode = 'velocity' | 'position' | 'age';
export type SplatBlendMode = 'additive' | 'alpha';
export type ColourRampName = 'fire' | 'ice' | 'liquid' | 'organic' | 'smoke' | 'fire-phase' | 'fire-smoke';
/**
 * ⚠️ THREE MEMBERS OF THIS UNION AND ONE `RenderMode` MEMBER ARE ALL CALLED SOME FORM OF "LIQUID",
 * and they are three different things — disambiguate by which one you are holding, never by the word:
 *
 * - `'LiquidLight'` — a **splat** material. Luminous fluid drawn as sprites. Unchanged since 2026-08-21.
 * - `'Liquid'` — a material that **requests the `liquid` render mode** (v8 step 15.9, 2026-09-04), so
 *   its deposits are drawn as ONE merged iso-surface rather than as separate sprites.
 * - `RenderMode`'s `'liquid'` — the iso-surface renderer itself, selectable under ANY material.
 * - (`ColourRampName`'s `'liquid'` is a fourth use of the word: a gradient all of the above can sample.)
 *
 * ⚠️ `'Liquid'` is the ONLY member whose selection changes the render mode to something other than
 * `splat`. That is resolved in `main.ts`'s `materialRequestedRenderMode()` / `resolveModeAgainstMaterial()`
 * pair — invariant 17's ONE owner. Do not add a second reader of this name that decides a mode.
 */
export type MaterialPresetName = 'None' | 'Plasma' | 'Fire' | 'Ember' | 'Smoke' | 'Fog' | 'Ice' | 'LiquidLight' | 'Organic' | 'Liquid';

export interface MaterialConfig {
  preset: MaterialPresetName;
  splatRadius: number;
  coreBrightness: number;
  haloStrength: number;
  falloffExponent: number;
  /**
   * M4 — thermal lag in SECONDS: how long a particle's temperature takes to travel half the way to
   * what its heat driver currently demands. Replaces the `coolingRate` + `dissipation` pair.
   *
   * Those two collapsed to a single scalar `coolFactor = dissipation^(1 + coolingRate*2)`, and since
   * the heat fix (steady state = driver * heatGain) that scalar controls ONLY lag — it no longer
   * affects the temperature RANGE at all. So they were two controls for one dimension, and the
   * mapping was many-to-one: (0.112, 0.93), (0.588, 0.96) and (3.921, 0.99) all give coolFactor
   * 0.9150 and a 0.130 s half-life. Identical materials, three different-looking configs.
   *
   * Expressed in seconds because that is the quantity anyone actually reasons about, and because it
   * is what a calibration solves for. Low = crisp, temperature tracks the driver almost instantly.
   * High = smeared, temperature lags and trails behind the motion.
   *
   * Converted to the per-frame factor at the point of use, so the behaviour is frame-rate
   * independent — which the old pair was NOT: both were per-frame constants.
   */
  thermalLag: number;
  emissionIntensity: number;
  heatMode: HeatMode;
  heatGain: number;
  blendMode: SplatBlendMode;
  colourRamp: ColourRampName;
  /**
   * Flame splat elongation along velocity, **0–1**.
   *
   * ⚠️ The range was documented as `0-3` until 2026-08-12. It never was: both shader stages compute
   * `blend = clamp(velocityStretch, 0, 1)` and use `blend` for everything, so 1.5 and 2.0 always
   * rendered exactly as 1.0. Batch M (M2) narrowed the slider 0–6 → 0–1 to match; the values were
   * CLAMPED rather than rescaled, because clamping is byte-identical output whereas rescaling would
   * have changed how six presets look.
   *
   * Also governs whether brightness varies with temperature at all — `emissionCurve` is
   * temperature-independent at 0.
   */
  velocityStretch: number;
}

export interface DLAConfig {
  enabled: boolean;
  preset: string;
  stickingProbability: number;
  temperatureModulation: boolean;
  anisotropy: number;
  anisotropyAngle: number;
  maxClusterSize: number;
  renderOpacity: number;
  renderColour: 'ice' | 'coral' | 'crystal' | 'temperature';
  seedPosition: 'center' | 'bottom' | 'random' | 'multi';
}

export interface RDConfig {
  enabled: boolean;
  preset: string;
  feedRate: number;
  killRate: number;
  diffusionU: number;
  diffusionV: number;
  stepsPerFrame: number;
  modulationStrength: number;
  modulationTarget: 'colour' | 'opacity' | 'size' | 'velocity' | 'all';
  renderOpacity: number;
  colourRamp: 'organic' | 'ice' | 'fire' | 'custom';
  particleSeeding?: boolean;
  seedRadius?: number;
  seedStrength?: number;
}

// IMPORT COMPATIBILITY ONLY — no implementation exists.
//
// The Growth tab, `GrowthCompositor`, `crystal-ornament.ts` and `lsystem-processor.ts` were removed
// in July 2026 when the first growth implementation was rejected as visually unconvincing.
// `src/growth/` (DLA + reaction-diffusion, 1 281 lines) was kept after that as source material for
// v8 Phase 8b, and was **deleted on 2026-08-06**: Phase 8b.1 shipped growth as the Crystals section
// of Materials (`CrystalPool.accrete()`) reusing only DLA's three *concepts* — stochastic sticking,
// temperature modulation, anisotropy — and explicitly rejecting its screen-space grid as the reason
// v7 growth looked detached. The 8b.4 RD demotion was decided against.
//
// These types survive so a preset exported before the cleanup still parses. Nothing reads them, and
// `RDConfig.modulationTarget` in particular never did. If a field-driven system is built later it
// should follow the crystal precedent — a separate render pass, not another positional nudge (R24).
export interface GrowthConfig {
  dla?: DLAConfig;
  reactionDiffusion?: RDConfig;
}

// v8 Phase 8a — Faceted Crystal. Frozen particles are drawn by a hexagonal, hard-edged,
// alpha-OCCLUDING pass instead of the usual soft additive splat, giving the engine a mineral
// vocabulary and its first irreversible per-particle state. Absent ⇒ feature fully inert.
//
// v8 Phase 8a-2 (feature 027) replaced the `arc`/`random`/`region` freeze-fraction debug driver
// with a real four-phase lifecycle. Nucleation now has a CAUSE, chosen by a birth rule:
//   'slow'   — nucleate among the slowest `slowFraction` of live particles (curve cusps)
//   'cold'   — nucleate among the coldest `coldFraction` (the Fire-Ice duel, needs a material)
//   'random' — uniform over live particles
export type CrystalBirthRule = 'slow' | 'cold' | 'random';

/**
 * Crystal silhouette (v8 Phase 8a-4). All four are 6-fold and share one facet/specular/refraction
 * model, so shape changes the outline and internal structure without changing the material read.
 *
 * `hexagon` was the only shape through 8a-3, and it made growth read as INFLATION rather than
 * accretion: every crystal was the same hexagon at a different size, so swelling merely scaled it up
 * and a cluster looked like a pile of ice cubes. It also masked the dendrites the pool was already
 * producing — `growthAnisotropy` biases accretion along six axes, but a fat symmetric hexagon fills
 * the gaps between arms and hides that structure.
 *
 * `plate` and `dendrite` are GROWTH-DRIVEN: their internal detail scales with `growth`, so a big
 * crystal earns its complexity instead of just being large.
 */
export type CrystalShape = 'hexagon' | 'plate' | 'dendrite' | 'prism';

export interface CrystalRenderConfig {
  enabled: boolean;             // master gate; false ⇒ crystal pass and lifecycle skipped entirely

  // --- Render params ---
  shape: CrystalShape;          // silhouette; 'hexagon' is the 8a-3 look, 'dendrite' is snowflake-like
  // 8a-4: crystals own their size. Before this they borrowed MaterialConfig.splatRadius, so with no
  // material they were pinned at 12px and could not be judged — and because the non-hexagon shapes
  // fill much less of their quad (measured: hexagon 44%, prism 24%, plate 19%, dendrite 17-36% by
  // growth), selecting one made crystals look SMALLER at an unchanged radius.
  crystalSize: number;          // 2–96 px quad radius, default 22
  facetSharpness: number;       // 0–1   hexagon edge hardness; 1 = fully hard alpha cutoff
  specularStrength: number;     // 0–4   facet glint intensity
  iceOpacity: number;           // 0–1   alpha of the occluding body
  edgeBrightness: number;       // 0–4   rim/edge highlight
  internalRefraction: number;   // 0–1   fake internal scatter depth
  crystalRamp: ColourRampName;  // colour ramp; 'ice' is the intended look

  // --- Population target ---
  // v8 Phase 8a-3: crystals are ADDITIVE pool slots, not converted wave particles, so the
  // population is bounded by a fixed pool exactly as sparks are. Nucleation only READS a wave
  // particle's model position — the particle keeps flowing untouched, so the figure never loses a
  // particle to a crystal and cannot develop holes.
  poolSize: number;             // 50–2000, default 600 — crystal slots; FIFO-oldest reuse when full
  // SOFT target, not a hard ceiling (D-06/RF-10): nucleation and accretion halt above
  // `freezeCap * 1.1`, while melting stays UNCONDITIONAL so the population self-corrects back
  // toward the target. A hard clamp made growth stall mid-formation, which reads as a bug.
  //
  // 8a-3: the denominator is now the POOL, not the figure — this is pool occupancy.
  freezeCap: number;            // 0–1, default 0.6 — crystal pool occupancy target

  // --- Birth (increment b) ---
  birthRule: CrystalBirthRule;  // default 'slow'
  slowFraction: number;         // 0–1, default 0.30 — nucleate among the slowest N%
  coldFraction: number;         // 0–1, default 0.25 — nucleate among the coldest N%
  nucleationBudget: number;     // 1–40, default 8 — max new crystals per frame

  // --- Lifecycle timings, seconds (increment b) ---
  nucleationTime: number;       // 0.1–2,  default 0.5 — growth 0 → 1 fade-in
  crystalLifetime: number;      // 1–60,   default 8   — jittered +-30% per particle
  meltTime: number;             // 0.1–3,  default 1.0 — growth 1 → 0 fade-out
  meltThreshold: number;        // 0–1,    default 0.8 — temperature above which a crystal melts early

  // --- Cluster force field (v8 Phase 8b.2) ---
  // The co-evolution the roadmap asked for and never received: live particles react to the frozen
  // structure instead of flowing straight through it as if it were not there. This is the only
  // crystal feature that changes the LISSAJOUS FIGURE rather than only adding to the image.
  //
  // Signed: negative = obstacle (particles deflect AROUND the ice), positive = accretion bias
  // (particles are drawn TOWARD it). 0 = off, and the whole stage is skipped.
  clusterForce: number;         // -1..1, default 0 (off)
  clusterForceRadius: number;   // 4–120 model units, influence range; default 40
  clusterForceReturn: number;   // 0–10, exponential decay pulling particles back; default 1.5

  // --- Lattice & symmetry (v8 Phase 8b.1) ---
  // The step that turns fuzzy dendrites into recognisable SNOWFLAKES. `growthAnisotropy` already
  // biases deposits along six axes, but only statistically: each arm grows independently by random
  // deposit, so arms are lumpy and asymmetric. Snapping to a hexagonal lattice adds crisp angular
  // joints; folding mirrors each deposit across the six sectors so all arms grow IDENTICALLY, which
  // is what the eye reads as a real snow crystal.
  //
  // Trades organic for formal, so it is opt-in per RF: some presets look better without it.
  latticeSnap: number;          // 0–1, hex-lattice snap strength; 0 = free positions
  latticeCell: number;          // 2–40 model units, lattice pitch; default 10
  symmetryFold: boolean;        // mirror each deposit into all 6 sectors; default false

  // --- Growth (increment c) ---
  growthEnabled: boolean;       // default false
  accretionRadius: number;      // 0–40 model-space units, default 12
  stickingProbability: number;  // 0–1, default 0.35
  growthAnisotropy: number;     // 0–1, default 0.3 — 6-fold directional bias
  maxGrowth: number;            // 1–6, default 1.8 — swelling ceiling (8a-4: was 1–3)
  accretionBudget: number;      // 1–40, default 8 — max accretions per frame
}

export interface FluidFeedbackConfig {
  persist: number;      // trail decay override (0.90–0.99), default 0.96
  amplify: number;      // velocity multiplier (1–10), default 1.0
  /**
   * ⚠️ **SUPERSEDED by `overlay.transMapDispersion` (2026-08-20) — kept for IMPORT COMPATIBILITY, in the
   * same class as `overlay.dye`: do not tidy it away.**
   *
   * Dispersion was never a fluid quantity. The shader spreads the R and B taps along the SUMMED chain
   * offset (`sOff + fOff + flOff`), so it modifies whatever warp is present; being reached only through a
   * style-6 layer was a bundling accident, not a design. It is now a chain-level control.
   *
   * Still read on import — see `main.ts`'s resolution order — because an export written before that date
   * carries the value here and nowhere else. Nothing WRITES it any more, and `getSnapshot()` emits the
   * flat key instead, so this drains out of the corpus without a `MigrationLayer` entry.
   */
  dispersion: number;   // chromatic RGB spread (0–0.5), default 0.0 — legacy home, see above
  fieldDecay: number;   // velocity field persistence per frame (0.95–0.999), default 0.985
  glowBoost: number;    // brightness gain in flow regions (0–2), default 0.0
}

/**
 * 27.6 — which cross-axis a material splat quad is sheared along.
 *
 * `'tangent'` takes it from the path tangent, so the mark keeps a constant apparent width whichever way
 * the particle travels. `'fixed'` uses a fixed global axis, so width varies with the direction of travel —
 * the flat-nib look. Hsu, Lee & Wiseman call the two RIBBON and SAUSAGE style (Skeletal Strokes, UIST 1993).
 *
 * ⚠️ **The values are NOT named `'ribbon'`/`'sausage'`, deliberately.** `ribbonMode` below is a different
 * feature on 178 presets, and a second meaning for that word is the name trap this tree keeps paying for.
 */
export type SplatShear = 'tangent' | 'fixed';

export interface OverlayState {
  splatShear?:           SplatShear;   // 27.6 — default 'tangent' equals pre-27.6 behaviour
  ribbonMode?:           'off' | 'hybrid' | 'streaks' | 'adaptive';
  ribbonWidth?:          number;
  linesEnabled?:         boolean;
  lineWidth?:            number;
  filmLook?:             string;
  customFilmLookParams?: FilmLookParams;
  /**
   * v8 Step 21.4c — the palette and its mapping, as **two flat optional scalars**.
   *
   * ## Why they are here and not left in `FilmLookParams`
   *
   * `palette` and `paletteMapping` live in `FilmLookParams` too, and that is their older home. But a film
   * look is a BUNDLE: assigning a palette to a preset through it forces `filmLook: 'Customize'`, which pins
   * the preset's whole grading, drops it out of the look dropdown, and inherits the *Materials* trap that a
   * block reproducing a look must author every one of its fields equal to `FILM_LOOKS`' own value or
   * silently inherit whatever was there before. Doing that to the 129 presets the `21.4d` migration adopts
   * would not be a migration, it would be a mass retune.
   *
   * With the palette on `overlay` instead, **every** palette becomes selectable per preset without touching
   * the grade — which is the other half of what "link the palettes rather than hide them behind placeholder
   * names" asked for. Palettes stop being reachable only through a look's name.
   *
   * ⚠️ **Two optional SCALARS, not a nested block** (invariant 14): a nested `overlay` block would need a
   * `MigrationLayer` backfill, two scalars read as `?? default` do not.
   *
   * ⚠️ **Resolved in ONE place — `resolvePaletteSelection()` in `renderers/palette-selection.ts`** — as
   * `ov.palette ?? fp.palette ?? 'none'` and `ov.paletteMapping ?? fp.paletteMapping ?? 'depth'`. Two
   * sources for one value is invariant 17's shape in full: every reader must resolve them in the SAME
   * order, and nothing may write the resolved value back afterwards. `undefined` means "not overridden" and
   * is therefore NOT interchangeable with `'none'`, which means "no palette" — the export gate has to be
   * value-based for that reason, since a gate DESTROYS a block rather than omitting a field.
   *
   * ⚠️ **Both are categorical, so the Mixer must SNAP them at t = 0.5** (invariant 16). Interpolating a
   * palette name is meaningless; interpolating a mapping is worse, because the int is what reaches the
   * shader and the intermediate values are other mappings.
   */
  palette?:              string;
  /**
   * The palette mapping — see `palette` above for the resolution order and the three invariants.
   *
   * ⚠️ `'index'` is the one member that does not reach a shader at all: it is computed by
   * `LissajousGenerator` and replaces the SOURCE of `state.colors`. See `21.4a` and `PALETTE_MAPPING_OFF`.
   */
  paletteMapping?:       PaletteMapping;
  /**
   * v8 `26.4` / `26.D5` — the `Warmth` row's hue rotation, as a **sampling offset into the resolved
   * palette's LUT**, in **TURNS**. `0` is the identity; the range is `[-0.5, +0.5]`, i.e. **±180°**
   * (owner, 2026-10-06).
   *
   * ⚠️ **AT ±180° THE TRAVEL IS NOT MONOTONIC IN "WARMTH", AND THAT WAS CHOSEN KNOWINGLY.** Both extremes
   * land on the palette's exact complement, so dragging right past ~0.75 brings the hue back around rather
   * than continuing to warm. **Nothing may assert monotonicity on this row** the way `slidercheck` does for
   * `Glow` — a clause like that would fail on correct code.
   *
   * ⚠️ **THE MAPPING IS EXACT AND IS NOT A CURVE: `turns = position − 0.5`.** `sliderMul(v) = 5^(2v−1)`, so
   * `log(m)/log(5) = 2v−1`, and a half-turn range makes the shift exactly the position's distance from
   * centre. **Do not re-derive it through `sliderMul` and a logarithm** — the arithmetic cancels, and the
   * cancellation is the reason the row can be written in one line.
   *
   * ⚠️ **A FLAT OPTIONAL SCALAR, NOT A BLOCK — invariant 14.** A nested `overlay` block needs a
   * `MigrationLayer` backfill; a flat scalar read as `?? 0` does not. Every reader must use that default.
   *
   * ⚠️ **IT IS A SAMPLING OFFSET, NOT A PER-PIXEL HSV CONVERSION (`26.D5`).** Palettes are 256-entry LUTs;
   * rotating one means reading it from a different place, which costs one `fract()`. An HSV round trip per
   * pixel would be a second colour system living beside the LUT.
   *
   * ⚠️ **STORED ON THE OVERRIDE, NEVER ON THE LOOK.** A film look SETS the palette only if it has one — 3
   * `'none'` bundles abstain and write nothing — so a rotation parked on the look would vanish whenever one
   * of those three was selected.
   *
   * ⚠️ **IT ROTATES THE PALETTE AND NOTHING ELSE.** The material ramp (`uRamp`) and the dye field are
   * separate tint sources and are deliberately NOT rotated: `Warmth` names the figure's colour, while a
   * material's ramp is part of the material's own identity.
   */
  paletteHueShift?:      number;
  attractorIndex?:       number;
  attractorBlend?:       number;
  renderMode?:           RenderMode;
  transMapEnabled?:      boolean;
  transMapStyle?:        TransMapStyle;
  /**
   * v8 Step 14.6 — the WARP RUNS BEFORE THE PARTICLE DRAW. Absent means `false`, i.e. today's order.
   *
   * ## What it changes, and why it is a rendering fact rather than a preference
   *
   * The frame is three passes over one ping-pong pair. Today:
   *
   *     decay  texA -> fboB        the trail, faded
   *     draw   particles -> fboB   this frame's particles, on top of the faded trail
   *     warp   texB  -> fboA       the whole thing displaced
   *
   * so **this frame's particles are warped on the frame they are born**, and the trail they leave is
   * re-warped on every subsequent frame. With this true the middle two swap:
   *
   *     decay  texA -> fboB
   *     warp   texB -> fboA        only the HISTORY is displaced
   *     draw   particles -> fboA   this frame's particles land undisplaced
   *
   * The visible difference is entirely about **what stays sharp**. Warp-last smears the figure itself: the
   * particles are the newest thing in the buffer and take the full offset, so a strong warp dissolves the
   * shape that is supposed to be reading as a figure. Warp-first leaves the figure crisp and warps only what
   * it has already deposited — the trail becomes a flowing wake behind a solid subject. That is the shape
   * every fluid/flow style was reaching for and could not express.
   *
   * ⚠️ **Judge it on a HIGH-accumulation preset, which INVERTS the usual rule.** The standing instruction is
   * to grade particle-shape and grading changes on a low-accumulation preset (`Cylinder`, `Quader`) so the
   * change is not hidden under 4000 particles of `MotionBlur 8`. This one is the opposite: with
   * `decayFactor` near 0 there is no history to warp, so the two orders converge to the same image and the
   * flag reads as inert. `decayFactor >= 0.8` holds on **225 of the 359** library presets (62.7 %,
   * re-measured 2026-08-30 against the real interleave, taking each legacy slot's refined body where the
   * pair has settled and its derived `MotionBlur/8.1` otherwise), so most of the library does show it — but
   * a low-accumulation preset is exactly the case that cannot.
   *
   * ⚠️ **A flat optional boolean read as `?? preset.postProcessors.transMap.beforeParticles`, deliberately
   * NOT a nested block** (invariant 14). The pair is the same shape as `transMapEnabled` /
   * `postProcessors.transMap.enabled` and is resolved overlay-first at every reader, `main.ts` and the
   * preview tile alike (invariant 17, `fieldcheck` §I). The preset-side field has existed since the format
   * was written and was **grep-confirmed NEVER READ** until this step — invariant 13's shape, and the
   * reason this is a wiring job rather than a new field.
   */
  transMapBeforeParticles?: boolean;
  ifsParams?:            IfsTransform[];
  curlNoise?:            CurlNoiseConfig;
  speedFactor?:          number;
  /**
   * Figure Scale — a multiplier on the uniform canvas fit. 0.2–5, default 1.
   *
   * PRESET-INTRINSIC, like `curlNoise` and `speedFactor`: it is part of how a preset is framed, not a
   * global rendering overlay, so it is carried through Mixer interpolation and saved per preset.
   *
   * Exists because the canvas fit became UNIFORM on 2026-08-06 — amplitudes are scaled by
   * `min(w/srcW, h/srcH)` so the authored aspect ratio survives any canvas shape. That is correct but
   * letterboxes on the long axis (75 % width at 1920×1080 from a 960×720 design), so this is how a
   * preset reclaims the space — or deliberately overfills to frame part of a large figure.
   */
  figureScale?:          number;
  /**
   * Particle Size — a global multiplier on every particle path's base size. 0.25–4, default 1.
   *
   * PRESET-INTRINSIC, like `figureScale` and `speedFactor`: how large a particle is belongs to the
   * preset's look, so it is carried through Mixer interpolation and saved per preset. A flat optional
   * scalar read as `?? 1` at every site, so an export written before 2026-08-29 needs no `MigrationLayer`
   * backfill (invariant 14).
   *
   * Exists because the base size was UNREACHABLE in five of the six render modes. The point path
   * hardcodes 3.0 (pixel/blend) and 5.0 (star), and volume falls back to a hardcoded
   * 16.0 when no material is running — so `MaterialConfig.splatRadius` was the only size control in the
   * engine, and it exists only while a material is active. Reported as *"if we have no material but
   * choose a different render mode than star, then we have no control over the size of a particle"*,
   * which was exactly right: invariant 13's shape reached through a MISSING control rather than a dead
   * one.
   *
   * ⚠️ **Crystals are OUT OF SCOPE and that is a decision, not an omission.** They carry their own
   * Crystal Size slider (`CrystalRenderConfig.crystalSize`, per-shape compensated by `crystalSizeFor`),
   * and a second multiplier on top would compound with it and make that slider's readout wrong. The
   * crystal pass shares the splat PROGRAM, so `renderCrystalOnly` writes 1.0 into the same uniform —
   * see the note there.
   *
   * ⚠️ **The point paths CLAMP to `ALIASED_POINT_SIZE_RANGE[1]`** (commonly 64) and the material splat
   * path does NOT, because it draws instanced quads and that limit is a point-sprite limit. So 4× is
   * reachable in full on splat and can saturate on star at a large canvas — which is why the slider's
   * readout prints an estimated pixel size beside the multiplier rather than the multiplier alone.
   */
  particleSize?:         number;
  /**
   * E30 — dihedral symmetry order (1–12). **1 means OFF**, and absent means 1.
   *
   * PRESET-INTRINSIC, like `figureScale` and `speedFactor`: an n-fold rosette is what the preset IS, not
   * a rendering overlay, so it is carried through Mixer interpolation and saved per preset.
   *
   * ⚠️ **Two scalars rather than a nested block, deliberately.** Every read site takes `?? 1` / `?? true`,
   * so an export written before E30 needs NO `MigrationLayer` backfill — unlike `overlay.crystal`, whose
   * nested block is applied with `Object.assign` and therefore silently inherits the live session's
   * values for any key the export omits. Do not "tidy" these into a `SymmetryConfig` object without
   * adding that backfill.
   *
   * ⚠️ Not to be confused with `CrystalRenderConfig.symmetryFold`, which is a BOOLEAN and mirrors
   * accreted crystal deposits into six sectors around a single cluster's seed. That one is crystal-local;
   * this one folds the whole figure.
   */
  symmetryFold?:         number;
  /** E30 — `true` = dihedral (each sector mirrored), `false` = cyclic. Absent means `true`. See `setSymmetry`. */
  symmetryMirror?:       boolean;
  /**
   * v8 `30.1` (`E129a`) — **Barr twist, per axis, in TURNS PER HALF-EXTENT of the design box.**
   *
   * `twistZ: 1.0` means a point at the far edge of the design box in z is rotated one full turn about the
   * z axis relative to a point at the centre. **The unit is DERIVED from the design box rather than picked**
   * (invariant 10), so the control means the same thing at every `figureScale` and on every canvas.
   *
   * ⚠️ **Each axis leaves its OWN driving axis untouched** — `twistZ` rotates `(x, y)` by a function of `z`
   * and never writes `z`. That is what makes all three depth-safe, and it is why this operator passed the
   * gate that removed `E133`.
   *
   * ⚠️ **`det J = 1` EXACTLY for each axis** (Barr: *the twisting transformation preserves the volume of the
   * original solid*), so **no energy compensation is owed and none may be added.**
   *
   * ⚠️ **THAT DOES NOT MEAN THE FRAME'S BRIGHTNESS IS UNCHANGED, and `30.D14` claimed it did.** Measured on
   * `Pipes` at Twist Z +0.50: mean luminance rose 93.9 -> 141.6 while near-clipped pixels FELL 7.52 % ->
   * 1.85 %. Winding the figure spreads it over more of the frame, so the same light lands on more pixels.
   * **A model-space volume ratio and a screen-space coverage statistic are two quantities** — see the
   * operator's own site in `lissajous.ts` for the correction in full.
   *
   * ⚠️ **THE COMPOSITION ORDER IS PART OF THE CONTRACT, NOT AN IMPLEMENTATION DETAIL** (`30.D6`): X, then Y,
   * then Z. Rotations do not commute, so two engines applying the same three numbers in a different order
   * draw different figures, and a preset is only portable if the order is fixed. It is fixed at the site.
   *
   * ⚠️ **It reads z, so it is bit-exactly NOTHING on a planar figure** — measured 2026-10-22: 61 of 277
   * preset bodies have a summed z amplitude of exactly 0. On those the control is correctly and invisibly
   * doing nothing, which is invariant 13's harder shape, so **the tooltip says the control needs depth.**
   *
   * Three flat scalars rather than a block, for `symmetryFold`'s reason exactly: every read takes `?? 0`,
   * so no `MigrationLayer` backfill is owed (invariant 14, `30.D11`).
   */
  twistX?:               number;
  twistY?:               number;
  twistZ?:               number;
  /**
   * v8 `32.1`/`32.2` (`E129b`) — **Barr taper and bend, the two members of the trio whose determinant is
   * NOT 1.** Triplets by `32.D4`, matching `twist` above.
   *
   * ⚠️⚠️ **THE DIFFERENCE FROM `twist` IS NOT THE GESTURE, IT IS THE ENERGY.** Barr's determinants:
   * twisting is exactly **1**, tapering is `r²` (unbounded as `r → 0`) and bending is `1 − k·z` (singular
   * at the centre of curvature). So `twist` shipped with no compensation and these two cannot: the
   * compensation is `32.3`, folded into `writeChannels`' size multiplier, and the clamps live in
   * `core/deform-limits.ts` where the derivation is.
   *
   * ⚠️ **ALL SIX ARE READ `?? 0`, so no `MigrationLayer` backfill is owed** — invariant 14, and
   * `30.D11`'s reason for `twist` applies unchanged.
   */
  taperX?:               number;
  taperY?:               number;
  taperZ?:               number;
  bendX?:                number;
  bendY?:                number;
  bendZ?:                number;
  /**
   * v8 `33.2` — **`Sharpness`: the generator's basis, from `sin` (0) to a triangle wave (1).**
   *
   * ⚠️⚠️ **IT IS NOT A DEFORMATION, AND THE DISTINCTION IS RECORDED IN TWO PLACES BECAUSE ONE WOULD ROT.**
   * Every sibling above is a map applied to a position after the wave sum; this changes the **function the
   * sum is made of**. So `facetcheck` §B carries it in `NOT_DEFORMATION` with that reason, and the
   * `Deformed` chip deliberately does not test it.
   *
   * ⚠️ **THE KNOT TYPE IS PROVABLY INVARIANT ALONG THIS WHOLE SLIDER** — Jones & Przytycki 1998 Thm 1.3
   * over a convex family containing both `cos` and the sawtooth. That is why `33.D2` was willing to make it
   * reachable on all 294 presets: it changes a figure's visual language and **cannot** change its topology.
   *
   * ⚠️ **0 must be BIT-IDENTICAL, not equal** — the generator branches on it rather than lerping, because
   * `x + 0·tri` silently turns `-0` into `+0`. See the evaluation loop.
   */
  sharpness?:            number;
  /**
   * v8 `34.4` (`34.D11`) — **`Sharpness` per wave LEVEL: `sharpness` is Body, these two are Structure and
   * Detail.** Levels, not axes — which is why `Sharpness` is the one operator of the four that gains 4 keys
   * rather than 9, and why a naive per-axis reading of `34.D11` gives 32 and is wrong.
   *
   * ⚠️⚠️ **BOTH ARE READ `?? sharpness`, NEVER `?? 0`, AND THAT IS THE MOST IMPORTANT SINGLE LINE IN THE
   * PHASE.** The shipped `overlay.sharpness` is GLOBAL across all three levels, so a preset carrying
   * `sharpness: 1` today facets everything. With `?? 0` it would facet one level of three and **six shipped
   * presets would change appearance in silence** — `Quader Faceted` (1), `Cylinder Chamfered` (0.5),
   * `Pipes Mitred` (0.85), `Quader Star Eight` (1), `Quader Star Twelve` (1), `Pipes Star Twenty` (1),
   * three of them the owner's finetuned star exports and five at the maximum. **The backfill lives in ONE
   * place, `adoptFigureBasis()` in `main.ts`**, because there are TWO `init()` call sites for the generator
   * and a backfill written twice is the defect the preview grid already paid for once.
   *
   * ⚠️ **CONSEQUENCE TO ACCEPT KNOWINGLY: there is NO absent-key spelling of "Body only".** Omitting
   * `sharpnessStructure` means *follow Body*, so a Body-only figure must author all three explicitly — which
   * is why the export gate's **all three or none** rule is load-bearing rather than cosmetic.
   *
   * ⚠️ **They take a CUSTOM mix law, not `lerp`** (`34.D14`). `SCALAR_IDENTITIES`' own header forbids a
   * scalar law whose default is not its identity, and `interpolatePreset` reads preset objects BEFORE
   * adoption — so with `lerp` and identity 0, at **t = 0** `Quader Faceted` would resolve to Body 1 /
   * Structure 0 / Detail 0 and the Mixer would de-facet two thirds of every pre-34 faceted preset at the
   * position where it claims to show deck A untouched. `mixSharpnessLevels` backfills each side first.
   *
   * ⚠️ **Inert where its level is silent, and the cell stays VISIBLE AND INERT (`34.D12`).** Measured:
   * **183 of 314 presets (58.3 %) have no live Detail slot-axis at all**, so on the majority of the library
   * the third cell does nothing. That is accepted, and it is why the tooltip states the PROPORTIONAL rule —
   * *a level's sharpness is visible in proportion to that level's share of the figure's amplitude budget* —
   * and never the "sharpen Body" shorthand, which is wrong for three of the six presets that carry the
   * control today (their Structure outweighs their Body, 28.5 against 13.0).
   */
  sharpnessStructure?:   number;
  sharpnessDetail?:      number;
  /**
   * v8 `34.4` — **`Temper`: the breathing of `Sharpness`. ONE depth and ONE rate for all three levels.**
   *
   * The asymmetry with every other operator in this phase is deliberate and is the specification's own:
   * *"all three levels breathe on one cycle"*. `sharpnessDepth` is SIGNED (a sign is the only way to put two
   * quantities in antiphase at one rate); `sharpnessRate` is one-sided with **0 meaning *never cycles***,
   * which is the operator's identity.
   *
   * ⚠️ **THE CLAMP PRODUCES A DWELL AND THE DWELL IS A FEATURE.** The RESOLVED value is held inside
   * `[0, SHARPNESS_MAX]`, so a swing that would pass either end stops there: the cycle is crystallise, hold,
   * melt, hold. **The readout says `(clipped)` while it does**, or the next reader removes the pause as a
   * stuck slider.
   *
   * ⚠️ **The rate inherits `generators.waveSpeed` AND `overlay.speedFactor`**, so the printed period moves
   * when either does. That is correct — all breathing in this engine does — and the readout says so.
   */
  sharpnessDepth?:       number;
  sharpnessRate?:        number;
  /**
   * v8 `34.3` — **`Grow`: the along-curve amplitude RAMP COEFFICIENT, per axis.**
   *
   * ⚠️⚠️ **`0` IS THE IDENTITY, NOT `1`.** The stroke's amplitude runs `am · (1 + k·τ)` from the first
   * particle to the last, so at `k = 0` the multiplier is exactly 1 for every particle. **A preset author or
   * a reader who sees the word "multiplier" and writes `1` scales every amplitude by `1 + τ`, doubling the
   * far end of every stroke in the library** — and `tsc` sees `number`, `OVERLAY_RULES` cannot express an
   * identity, and no instrument would say so. The full statement is on `GROW_FLOOR` in
   * `core/deform-limits.ts`, with `invertRadius: 1.0` three lines away in `SCALAR_IDENTITIES` as the
   * counter-example.
   *
   * `GROW_FLOOR = -1` is **structural**: at exactly −1 the amplitude reaches 0 at the end of the stroke (a
   * full taper to a point) and below it the amplitude goes negative, which is a phase inversion mid-stroke.
   *
   * ⚠️ **It scales the WAVE SUM ALONE, upstream of `Travel` and `Offset`** — `applyGrow`'s header owns that
   * contract. ⚠️ **It is NOT a member of the `Deformed` chip**, and that is a close call recorded in
   * `facetcheck` §B's `NOT_DEFORMATION.grow`: it changes what the sum is made of rather than mapping a point
   * after the sum, even though it changes the silhouette materially.
   */
  growX?:                number;
  growY?:                number;
  growZ?:                number;
  /**
   * v8 `34.4` — **`Flare`: the breathing of `Grow`, per axis** (`34.D11`). Signed; the resolved value is
   * clamped to `[GROW_FLOOR, GROW_MAX]`, so a swing below a full taper DWELLS at the taper.
   *
   * ⚠️ **Crossing zero is worth authoring**: zero is the identity, so the figure passes visibly through its
   * own unmodified shape, which is the one thing that makes the operator legible.
   */
  growDepthX?:           number;
  growDepthY?:           number;
  growDepthZ?:           number;
  growRateX?:            number;
  growRateY?:            number;
  growRateZ?:            number;
  /**
   * v8 `34.2` — **`Offset`: the DC translation term, per axis, in design HALF-EXTENTS** (`34.D3`, the unit
   * `travelX/Y/Z` already uses).
   *
   * ⚠️⚠️ **ITS ENTIRE VALUE IS IN THE MOTION, NOT IN THE POSITION.** The translation is exact — the
   * specification measures max deviation `0.00e+0` from a clean shift — but **the engine rotates about the
   * model origin, so every figure in the library spins IN PLACE.** An offset is the term the rotation is
   * taken about, and it turns that spin into an orbit: a ball opens into a torus with a hole at ~1 figure
   * radius and into a wide wreath at ~2.6.
   *
   * ⚠️ **Nothing auto-fits it, exactly as nothing auto-fits `Travel`, and on Z the two COMPOSE toward the
   * perspective divide** (`34.D9`). At 1440×900 on a 100×100 design box the `perspectiveFactor` clamp bites
   * at −2.47 half-extents and `project()` culls at −2.60, **so the hazard is reachable inside this range** —
   * `offsetZ: -2` alone sits at 77 % of the cull depth. The guard is a READOUT under the row, chosen over a
   * clamp by the owner, and it is canvas-dependent (invariant 27) so it is recomputed on resize and names
   * the window it describes. **A culled particle reads as a streak leaving the screen, never as a clamp.**
   *
   * ⚠️ **`mutate: frozen` (`34.D13`), and the reason is in the rule row rather than being an absence**: a
   * random offset breaks the centring every preset relies on and that every rotation is taken about, so the
   * Randomiser would routinely hand back figures spinning off-centre — which reads as the Randomiser being
   * broken rather than as variety.
   */
  offsetX?:              number;
  offsetY?:              number;
  offsetZ?:              number;
  /**
   * v8 `34.4` — **`Sway`: the breathing of `Offset`, per axis** (`34.D11`). Signed; the resolved value is
   * clamped to `[−OFFSET_MAX, OFFSET_MAX]`.
   *
   * ⚠️ **Three axes at three DIFFERENT rates is the whole of what `34.D11`'s per-axis reversal bought** — a
   * slow Lissajous wander rather than a straight-line shuttle. One rate per operator could not express it.
   */
  offsetDepthX?:         number;
  offsetDepthY?:         number;
  offsetDepthZ?:         number;
  offsetRateX?:          number;
  offsetRateY?:          number;
  offsetRateZ?:          number;
  /**
   * v8 `33.3` — **`Travel`: a secular (linear) term per axis**, as a fraction of the design half-extent
   * swept across the whole population. Triplet by `33.D7`, matching `twist`/`taper`/`bend`.
   *
   * ⚠️⚠️ **IT MAKES THE FIGURE OPEN — an arc with two free ends — and no other figure in the library is.**
   * That is the feature, and it is also the one visual risk `33.D1` chose to discover after building.
   * **No finite sum of sinusoids can produce a monotone ramp**, which is why one line reaches helices,
   * conical spirals and spherical spirals the generator cannot otherwise draw at any winding.
   *
   * ⚠️ **NOTHING AUTO-FITS IT.** `waveScale` is fixed from the design box at `init()` and no code measures
   * the curve's own extent, so `TRAVEL_MAX` is the only thing stopping a figure walking out of frame.
   * Flat scalars read as `?? 0`, so no `MigrationLayer` backfill is owed (invariant 14).
   */
  travelX?:              number;
  travelY?:              number;
  travelZ?:              number;
  /**
   * v8 `34.4` — **`Stretch`: the breathing of `Travel`, per axis** (`34.D11`). Signed; the resolved value is
   * clamped to `[−TRAVEL_MAX, TRAVEL_MAX]`, because the BASE already respects that bound and a breathing
   * term that escaped it would walk the figure out of frame with nothing to pull it back.
   *
   * ⚠️ **`travelY` HAS NO CARRIER IN THE LIBRARY AT ALL** (`travelX` 1 preset, `travelY` **0**, `travelZ` 2),
   * so `travelDepthY`/`travelRateY` are authorable, interpolated, exported and **invisible to `democheck`,
   * to the Mixer stride and to every preset-driven instrument.** The reachable-but-unused rule applies:
   * named here so the first author to use Y is not the one who finds the defect.
   */
  travelDepthX?:         number;
  travelDepthY?:         number;
  travelDepthZ?:         number;
  travelRateX?:          number;
  travelRateY?:          number;
  travelRateZ?:          number;
  /**
   * v8 `33.4` — **which foliation of the escape field the particles follow.**
   *
   * `'contour'` is the shipped behaviour: the step is `perp = (−g_y, g_x)/|∇|`, the level-set tangent, so
   * particles slide ALONG iso-contours. Because the smooth escape count is a monotone function of the
   * Douady–Hubbard potential, **those contours are its equipotentials.** `'ray'` follows `(g_x, g_y)/|∇|`
   * instead — the **orthogonal foliation**, radial filaments converging on the set's boundary.
   *
   * ⚠️⚠️ **`'ray'` IS NOT AN EXTERNAL-RAY TRACER AND MUST NOT BE DOCUMENTED AS ONE.** `buildEscapeGrid`
   * runs `blurGrid(grid, size, 3)` — three 3×3 passes — so the field is a low-pass of the potential and
   * its gradient lines diverge from true external rays by more than the 512² sampling alone implies. Two
   * independent research agents reached that conclusion separately. **It is a new visual family.**
   *
   * ⚠️ **Categorical, so the Mixer SNAPS it at t = 0.5** (`33.D11`, invariant 16). And it is inert for 9 of
   * the 11 attractor types, which is why the UI hides rather than offers it (`33.D17`).
   */
  escapeFlow?:           'contour' | 'ray';
  /**
   * v8 `32.7` (`E133`) — **the 3D spherical inversion, `p → p·R²/|p|²`.**
   *
   * ⚠️⚠️ **THE IMAGE-SPACE FORM OF THIS ALREADY SHIPS as TransMap style 12's `inverse` map**, where depth
   * has already been discarded by the projection. These fields are the PRE-projection stage, which
   * reorders which particles are in front — a different operation with the same formula.
   *
   * `invertAmount` is **the gate**: 0 is a bit-exact no-op and a lerp from identity, so every preset
   * authored before `32.7` is unchanged.
   *
   * ⚠️⚠️ **AN `invertShell` FIELD EXISTED FOR ONE DAY AND THE REASON IT WENT IS A MEASUREMENT.** It
   * restricted the map to `r > shell`, on the study's suggestion that protecting the core would protect
   * depth ordering. `32.6` measured it failing the depth discriminator on **31 bodies either way** — the
   * same as no shell — because a figure spanning the design extent has most of its particles outside it.
   * **The owner dropped the control and the field went with it: a field kept on a falsified rationale is
   * worse than no field.** The effective safety control is the amount lerp.
   */
  invertAmount?:         number;
  invertRadius?:         number;
  /**
   * v8 `30.2` (`E130`) — **iterated box-fold, the engine's first MANY-TO-ONE coordinate map.**
   *
   * `boxFoldIterations` is **the gate**: 0 means off and the operator is skipped entirely, so every preset
   * authored before `30.2` is bit-identical. 1–4 (`BOX_FOLD_MAX_ITERATIONS`). ⚠️ **The cap is Hart's
   * composition rule, not cost** — iteration is composition, so n folds multiply the Lipschitz bound
   * geometrically while costing about six arithmetic operations each. **Cheap in ALU is exactly the trap.**
   *
   * `boxFoldLimit` is the cell half-width as a **FRACTION of the design half-extent** (`min(designW,
   * designH) / 2`), never model units — so the control means the same thing whatever design box a preset
   * declares. Lower = tighter cell = more folding.
   *
   * `boxFoldScale` is the between-iteration scale. ⚠️ **Identity 1. Moving it CHANGES BRIGHTNESS and
   * nothing compensates that, which is correct rather than a defect**: `27.2` normalises the splat quad's
   * own area, not model-space density, and compressing a figure genuinely does put more particles in a
   * pixel.
   *
   * ⚠️⚠️ **THERE IS NO `boxFoldZ`, AND ITS ABSENCE IS A MEASURED RESULT RATHER THAN A SCOPE CUT.**
   * It was specified (`30.D1`), built, and removed when `30.10` measured **61-100 % of sampled depth
   * pairs inverting against the 10 % bound `30.D15` fixed in advance** -- across all 164 strong-z
   * bodies and every cell size and iteration count in the shipped range. **The cause is structural: a
   * reflection does not perturb an ordering, it reverses it wholesale for the reflected region**, so
   * no parameter makes it depth-safe. Same gate that removed `E133`. **Do not re-add it** (`30.D19`).
   *
   * ⚠️ **All four SNAP in the Mixer rather than interpolating** (`30.D12`) — there is no figure halfway
   * between one fold at one cell size and three folds at another, and a fold is a categorical operator for
   * the same reason `symmetryFold` is.
   */
  boxFoldIterations?:    number;
  boxFoldLimit?:         number;
  boxFoldScale?:         number;
  /**
   * v8 `31.2` (`E112`/`E113`/`E137`) — **per-particle appearance: ONE shared driver and THREE amounts.**
   *
   * `channelDriver` picks the ordered quantity (`31.D4`): `index` (position along the curve), `velocity`,
   * `depth` or `colourPhase` (where the particle sits in the colour cycle). ⚠️ **ONE driver for all three
   * channels is the design, not a simplification** — the same particles then end up large, bright and
   * opaque together, which the eye reads as structure rather than as three unrelated speckles. ⚠️ **There
   * is no `age` driver and that is deliberate: age is a GLOBAL clock in this engine, not a per-element
   * one**, so an `age` channel would be flat (inert) or silently material-dependent.
   *
   * `channelSize`, `channelAlpha` and `channelLight` are the amounts, ±1, applied as
   * `1 + amount·(2d − 1)`. ⚠️ **The DRIVER'S MIDPOINT is the identity, so the channel is symmetric about
   * it** — and the sign therefore carries real information: `+` makes the high-driver particles the
   * large/bright ones, `−` makes the low-driver ones, which are different pictures of one ordering.
   *
   * ⚠️ **ALL THREE AT 0 IS THE GATE: nothing is computed and nothing is published**, so a preset authored
   * before `31.2` is bit-identical and pays nothing per frame. The gate is the three AMOUNTS and never the
   * driver, which is why the driver is not an identity-gated key in its own right.
   *
   * ⚠️ **`channelLight` multiplies the RESOLVED colour, after the `palette > material ramp > preset
   * colour` precedence chain** (`31.D12`) — a channel inside that chain would be a sixth colour source
   * fighting the palette; modulating the winner modulates whatever won. And the study's own finding is why
   * `channelLight` is the one to reach for first: **lightness before hue** — chromatic variation is
   * largely invisible at a particle's spatial scale while intensity reads well.
   */
  channelDriver?:        ChannelDriver;
  channelSize?:          number;
  channelAlpha?:         number;
  channelLight?:         number;
  /**
   * v8 `31.4` (`E132`) — **the 4D ROTATION: the fourth-axis extent and the three `w` plane angles.**
   *
   * The fourth coordinate is the **curve parameter** (`31.D2`), lifted as
   * `w = (i / count − 0.5) · 2 · halfExtent · wScale` — the most on-identity choice available, since the
   * figure *is* a curve traced by a parameter. ⚠️ **It is what makes a lawful pass-through real: two
   * particles at the same `xyz` can differ in `w`, which no function of position can give.** A fourth
   * WAVE axis is a never-re-propose owner decision and this is not one.
   *
   * `wXW`, `wYW`, `wZW` are the three rotation angles in TURNS, in the three planes that involve `w`.
   * ⚠️ **`xy`/`xz`/`yz` are deliberately absent: those ARE the existing 3D `Rotation` control**, and a
   * second copy of it would be two controls for one quantity.
   *
   * The projection back to 3D is `p' = p · d / (d − w)`. ⚠️ **`det J` IS NOT 1: a 4D rotation preserves
   * 4-volume and the 3D projection does not**, so density — and therefore brightness — changes,
   * uncompensated and correctly. **Do not reach for `27.2`'s energy law: that normalises a splat quad's
   * area, not a projection's density** (`30.D14`, learned expensively).
   *
   * ⚠️ **`wScale` 0 IS THE GATE AND IT IS BIT-EXACT AT ANY ANGLE** — at `wScale` 0 every `w` is 0, so all
   * three rotations are identities on a zero coordinate and the divide is `d/d`. The angles are therefore
   * NOT part of the gate, which is the opposite of the twist's whole-triple gate and is forced by the
   * arithmetic rather than chosen.
   *
   * ⚠️ **It reorders depth too, and `31.9`'s record covers it: 45.0 % inversion with a 32.1 % image
   * change** at all three angles — against the seeded `boxFoldZ`'s 55.7 % with 0.0 %.
   */
  wScale?:               number;
  wXW?:                  number;
  wYW?:                  number;
  wZW?:                  number;
  /**
   * v8 `31.4` — **how many times `w` winds across the population. Integers 1-8, default 3.**
   *
   * ⚠️⚠️ **THE OPERATOR SHIPPED WITH `w` MONOTONE IN THE PARTICLE INDEX AND THAT MADE IT A 3D DEFORMATION
   * IN ALL BUT NAME** — the owner read it as "stretches it in one direction", correctly. A monotone `w` is
   * nearly a function of POSITION on every figure in the library (measured: 0.00-0.32 % of
   * far-apart-in-index pairs share a place), and rotating a coordinate that is a function of position
   * cannot produce the pass-through the operator exists for. **Winding makes `w` periodic, so successive
   * stretches of the curve are pushed in opposite directions and the strands cross.**
   *
   * ⚠️ **It EXTENDS `31.D2` rather than contradicting it: `w` is still a function of the curve parameter
   * alone**, which is the half of that decision carrying the lawfulness claim. Owner-approved.
   */
  wWinding?:             number;
  /**
   * Which NAMED film-look bundle the Sliders tab's Customize seed derives from.
   *
   * Bookkeeping for `grading()` in `exploration/slider-mappings.ts`. `Mood` and `Glow` have to switch a
   * preset to `Customize` to reach the grading channel at all, which destroys the record of which bundle
   * the user actually chose. This preserves it so the seed can be REBUILT from that bundle on every
   * apply — which is what keeps those sliders idempotent, the Sliders tab's core contract.
   *
   * Without it the seed was reused and re-multiplied on every `input` event, so a single drag compounded
   * `Mood`'s exposure to ×875 and the figure went irrecoverably flat white.
   */
  sliderBaseFilmLook?:   string;
  physarum?:             PhysarumConfig;
  fluidAdvection?:       FluidAdvectionConfig;
  material?:             MaterialConfig;
  buoyancy?:             BuoyancyConfig;
  sparks?:               SparkConfig;
  /**
   * v8 Step 15.7 (E90) — the advected dye field. ⚠️ **LIVE since 2026-09-03; this line read "accepted on
   * import, never applied" for three weeks and that is no longer true** (owner: `DyeFieldProcessor` in
   * `post-processors/dye-field.ts`, called from `main.ts`'s frame loop).
   *
   * ⚠️ **A nested block, so read it as `{ ...DEFAULT_DYE_CONFIG, ...(preset.overlay?.dye ?? {}) }`** —
   * spread-only leaves a later-added field `undefined`, and an `undefined` reaching `gl.uniform1f` computes
   * NaN (invariant 14). ⚠️ **And it needs a Mixer entry**: `interpolate.ts` assigns `result.overlay`
   * WHOLESALE, so a block it does not explicitly spread back is DROPPED and silently re-read as defaults.
   */
  dye?:                  DyeFieldConfig;
  volumeRender?:         VolumeRenderConfig;
  /**
   * v8 Step 15.1 — the `liquid` render mode's parameters. Read ONLY while `renderMode === 'liquid'`.
   *
   * ⚠️ **A nested block, so every reader must merge DEFAULTS FIRST and the preset's block on top**
   * (`{ ...DEFAULT_LIQUID_CONFIG, ...(preset.overlay?.liquid ?? {}) }`) — the pattern `currentCrystal` uses
   * and for the same reason: `Object.assign` copies only PRESENT keys, so a spread-only read leaves a field
   * added later `undefined`, and an `undefined` reaching `gl.uniform1f` makes the shader compute NaN
   * (invariant 14). ⚠️ **And it needs its own Mixer entry** — `interpolate.ts` assigns `result.overlay`
   * WHOLESALE, so a block it does not explicitly spread back is DROPPED and silently re-read as defaults,
   * which is already happening to `crystal`, `sparks`, `volumeRender` and `buoyancy`.
   */
  liquid?:               LiquidSurfaceConfig;
  /**
   * v8 Step 15.4 — cohesion between nearby particles. Read in EVERY render mode, unlike `liquid` above:
   * it displaces `positions`, so it is not gated on `renderMode`.
   *
   * ⚠️ Same two obligations as `liquid`: **merge DEFAULTS FIRST** (invariant 14 — a spread-only read leaves a
   * later-added field `undefined`, and `undefined` through this arithmetic is NaN in `positions`, which is
   * the one place a NaN cannot be caught downstream), and **give it its own Mixer entry in BOTH branches of
   * `interpolate.ts`** or a crossfade drops it and silently re-defaults it.
   */
  cohesion?:             CohesionConfig;
  /**
   * v8 Step 15.5 — the standing liquid pool the figure stirs. Read in EVERY render mode like `cohesion`,
   * since it publishes particles rather than configuring a renderer.
   *
   * ⚠️ Same two obligations as the two blocks above — **merge DEFAULTS FIRST** (invariant 14) and **its own
   * Mixer entry in BOTH branches of `interpolate.ts`** — plus a third that is specific to it: it is the only
   * `overlay` block that changes `state.count`, so a reader that merges it wrongly does not merely
   * misconfigure a pass, it changes the length of every published array.
   */
  liquidField?:          LiquidFieldConfig;
  transMapWarpMix?:       number;
  /**
   * Chromatic dispersion across the WHOLE warp chain — 0..0.5, default 0 (no fringing).
   *
   * The shader spreads the R and B taps to `off * (1 ± dispersion * 3)` where `off` is the summed chain
   * offset, so this is a modifier ON a displacement and not a colour operation: **where the warp is zero it
   * does nothing at all**, and its strength follows the local offset magnitude. That is what distinguishes it
   * from a lens-style aberration, which would be radial and independent of the motion.
   *
   * ⚠️ **Reached only through a style-6 layer until 2026-08-20** (`uDispersion` was uploaded as
   * `feedback ? fluidDispersion : 0`), which read as "a Fluid Feedback feature". It never was one — the
   * gate sat next to `uGlowBoost` and `edgeFade`, which ARE style-6 semantics and remain gated. Now global,
   * so styles 0-3 and Procedural Flow get it too.
   *
   * ⚠️ **A flat optional scalar read as `?? 0`, deliberately NOT a nested block** (invariant 14): a nested
   * `overlay` object needs a `MigrationLayer` backfill because `Object.assign` copies only PRESENT keys, so
   * an old export would inherit live session values. Its predecessor `FluidFeedbackConfig.dispersion` is
   * still read on import and is documented there.
   */
  transMapDispersion?:    number;
  transMapForceBlend?:    number;
  transMapForceReturn?:   number;
  transMapForceSparks?:   boolean;
  /**
   * PARTICLE-ATTRIBUTE FORCE GATING (v8 Step 14.4) — which per-particle attribute scales the force field.
   *
   * `'none'` is today's behaviour exactly: every particle is pushed identically. The other three make
   * susceptibility a per-particle property, so the figure can hold its shape where the gate is low while
   * the rest of the cloud streams — a look no single force STRENGTH produces, because strength moves the
   * whole population together.
   *
   * ⚠️ **Three flat scalars, not a nested block** (invariant 14): a nested `overlay` object needs a
   * `MigrationLayer` backfill, because `Object.assign` copies only PRESENT keys and an old export would
   * then inherit the live session's gate. Read as `?? 'none'` / `?? 0` / `?? false`, so every export ever
   * written parses to today's behaviour.
   *
   * ⚠️ **`'age'` and `'temperature'` need a live material.** `MaterialProcessor.update()` returns early on
   * `preset === 'None'`, so `state.lifetimes` is then ABSENT (gated on `isLive()` at the publish site since
   * 2026-09-20) while `state.temperatures` is still published FROZEN AT ZERO, because sparks and crystals
   * merge their own heat into it and need no material. The two words are not interchangeable: absent makes the
   * gate report itself inactive, frozen-at-zero makes it scale every force by a constant — which is inert in
   * the way invariant 13 means, a control that moves and changes nothing it names. The Visual FX rows are
   * DISABLED and labelled in that case rather than silently doing nothing. `'depth'` reads
   * `state.depths`, a REQUIRED field, so it is always available.
   */
  transMapForceGateBy?:     ForceGateSource;
  transMapForceGateAmount?: number;
  transMapForceGateInvert?: boolean;
  /**
   * Age half-life in SECONDS for `transMapForceGateBy === 'age'` — the age at which the gate has fallen to
   * 0.5. `state.lifetimes` is an unbounded accumulating age, so it needs a mapping into 0..1 and cannot be
   * used raw; `exp(-age * ln2 / halfLife)` is that mapping. Ignored by the other three sources.
   */
  transMapForceGateHalfLife?: number;
  fluidFeedback?:         FluidFeedbackConfig;
  proceduralFlow?:        ProceduralFlowConfig;
  /**
   * TransMap LAYER CHAIN — an ordered subset of the seven styles, replacing "exactly one style".
   *
   * ⚠️ **PURELY ADDITIVE, and that is load-bearing for invariant 14.** `transMapStyle` /
   * `transMapEnabled` / `ifsParams` / `proceduralFlow` / `fluidFeedback` keep their exact meaning and are
   * still the canonical spelling of a ONE-LAYER chain. Every read goes through `chainFromOverlay()` in
   * `trans-map-chain.ts`, which falls back to those scalars when this key is absent — so all 177 legacy
   * presets, the 7 engine presets with a live style, and every export ever written parse unchanged with
   * NO `MigrationLayer` backfill. `getSnapshot()` only emits this key when the chain has 2+ layers, so a
   * single-layer export is byte-identical to a pre-chain one.
   *
   * ⚠️ **At most one layer per style** — the chain is an ordered SUBSET, not a multiset. That keeps the
   * Visual FX tab's `flow.*` / `fluidFeedback.*` descriptor keys unique (a second flow layer would force
   * indexed keys and a rebuild of the descriptor table on every add/remove), and avoids a second
   * `ProceduralFlowGenerator` and a per-layer copy of the 32-number `sinMagicParams` tables.
   * `normaliseChain()` enforces it; max length is therefore 7 by construction.
   *
   * ORDER: only one boundary in this array is executable — where the style-4 ECHO layer sits relative to
   * the field layers. The field layers themselves SUM, and addition commutes, so reordering them is a
   * no-op. See `trans-map-chain.ts` and `DESIGN-transmap-chain.md` §2.3.
   */
  transMapChain?:         TransMapLayer[];
  growth?:                GrowthConfig;
  crystal?:               CrystalRenderConfig;
}

export interface IfsTransform {
  angle: number;   // rotation in degrees, applied around UV centre (0–360)
  scale: number;   // scale factor (0.1–2.0)
  tx: number;      // UV translation X (-0.5 to +0.5)
  ty: number;      // UV translation Y (-0.5 to +0.5)
  weight: number;  // blend weight (0.0–1.0), normalized at runtime
}

/**
 * The warp wave's basis function — the shape `buildWave`/`buildZoomWave` substitute for `Math.sin`.
 *
 * ⚠️ **THREE OF THESE LEAVE Jones–Przytycki's family F and may therefore NEVER be offered to the FIGURE
 * generator**: `trapezoid` and `square` fail *"strictly decreasing on (0, 1/2)"* and `sawtooth` is not even.
 * **The warp has no knot to preserve, which is the whole reason it may use them** — the figure's `Sharpness`
 * is confined to F because membership in F is exactly what makes the knot type invariant, and F is convex,
 * which is why the figure gets a slider and this gets a selector. `SPEC-transmap-wave-shapes.md` §2.1.
 *
 * ⚠️ **`spike` is MEASURED-AND-REJECTED, not overlooked** (`35.D2`): concentration 2.2 against sine's 2.6 and
 * visually indistinguishable in every render. It is the obvious sixth candidate and will be proposed again.
 *
 * ⚠️ Declared HERE rather than in `static-field.ts` — beside `TimeWarpSource`, `CrystalShape` and every other
 * per-layer union — because `static-field.ts` imports this file and a union declared there would make the
 * import a cycle. The ARRAY and both `Record`s live in `static-field.ts`, which is `CrystalShape`'s shape
 * exactly (`CRYSTAL_SHAPES` in `crystal-config.ts`, `CRYSTAL_SHAPE_LABELS` in `preset-facets.ts`).
 */
export type WarpShape = 'sine' | 'triangle' | 'trapezoid' | 'square' | 'sawtooth';

/**
 * Per-layer settings for the styles 0-3 displacement field — the archetype, and the three scalars that
 * position it. Resolved by `resolveStaticWaves()` in `post-processors/static-field.ts`; read that file's
 * header before changing anything here.
 *
 * ⚠️ **Every field is OPTIONAL and read as `?? default` (invariant 14).** `Object.assign` copies only
 * PRESENT keys, so an old export must inherit the DEFAULTS, not live session values — which is also why
 * these are flat scalars rather than a nested block needing a `MigrationLayer` backfill.
 *
 * ⚠️ **`pattern: '(Preset)'` + `drift: 0` is the identity configuration** and the default for all 190
 * shipped presets. It routes straight to `postProcessors.transMap.sinMagicParams` at the amplitudes the
 * author wrote, so nothing renders differently until a control is touched.
 */
export interface StaticFieldConfig {
  /** An archetype name, `'(Preset)'` (the preset's own table) or `'(Custom)'`. See `patternNames()`. */
  pattern?: string;
  /**
   * Warp amount, and **it means two different things on the two branches of `resolveStaticWaves`** — which is
   * one stored field with one user-facing word, deliberately (v8 21.13).
   *
   * - On an **archetype**: normalised, peak displacement `strength * 8%` of `min(w,h)` in every style, so the
   *   number is canvas-relative. **The track reaches ±16** (`STATIC_FIELD_STRENGTH_MAX`) rather than the 1.0 it
   *   shipped with or the 2.0 of 21.13, because the identifiable library tables need up to 12.20 to be
   *   reproduced from the dropdown at all. ⚠️ **Widened 2026-09-25 on a QUARTIC track, so the range grew and the
   *   resolution did not shrink** — `STATIC_FIELD_STRENGTH_TRACK` quantises to a flat 0.01 in this unit. Nothing
   *   clamps a stored value against the bound, so a preset may legally hold any number and always could.
   * - On `(Preset)`: a **relative** gain, `strength / 0.5`, on the author's own amplitudes — so **0.5 is the
   *   authored field unchanged** and 16 means a 32× gain. That parity is `fieldcheck` §A's oracle and is what
   *   keeps every shipped preset byte-identical; do not unify the two branches' ranges.
   *
   * ⚠️ **SIGNED since 2026-09-22** (`STATIC_FIELD_STRENGTH_MIN = -MAX`): a negative value inverts the field,
   * every offset the same size and the opposite direction. **It needed no arithmetic anywhere** — the archetype
   * branch multiplies a positive solved gain by `strength` and the `(Preset)` branch divides by 0.5, so the sign
   * passes through both and the response stays linear across 0. **0 is therefore an interior point, not an end
   * stop**, and it is the only value at which the two branches agree. Interpolation was already correct
   * (`interpolate.ts` lerps it as a plain scalar), so no Mixer or migration work followed.
   */
  strength?: number;
  /** Frequency multiplier — cells across the axis. Perceptually logarithmic; 0.25..16 is the useful band. */
  detail?: number;
  /** Radians per second of field phase advance. 0 = the standing lattice, and the pre-2026-08-20 behaviour. */
  drift?: number;
  /**
   * Style 3 only — the ZOOM table's archetype. Style 3 is a shift composed with a zoom from two
   * INDEPENDENT tables (`params1` shifts, `params2` zooms), not two detail levels of one field, so this is
   * a second transformation rather than a refinement of `pattern`.
   */
  pattern2?: string;
  /** Style 3 only — the zoom table's strength. */
  strength2?: number;
  /**
   * Style 3 only — the DC term in `computeSinMagicZoom2`'s zoom wave (`params2[0][n] + sin(...) * ...`).
   * Nonzero biases the zoom off 1.0 into a steady contraction or expansion; `Voyager` is a flat 0.90.
   */
  zoomBias?: number;
  /**
   * The SHIFT tables' wave shape, in BOTH regimes — archetype and `(Preset)` alike (`35.D2` decision 1).
   *
   * ⚠️ **That is the OPPOSITE of `detail`'s treatment**, which is inert on `(Preset)` by design, and the
   * asymmetry is deliberate rather than an oversight: a shape is a transformation OF the author's own table,
   * where `detail` would be a rescaling of frequencies the author chose. The named risk (`35.D2`) is that a
   * table's frequencies were authored for sine, which the notice line says out loud.
   *
   * ⚠️⚠️ **`shapeMix: 0` AND `shape: 'sine'` are BOTH the identity, deliberately** — it gives the wave
   * builder two independent ways to take the fast path, and it means **a user who picks a shape and leaves
   * the mix at 0 sees nothing.** That is the phase's most likely first-use confusion and the fix is the
   * notice line, NOT making a shape pick imply a non-zero mix. **Do not couple these two fields.**
   */
  shape?: WarpShape;
  /** 0..1 blend from `Math.sin` toward `shape`. **0 is the identity and so is `shape: 'sine'`** — see above. */
  shapeMix?: number;
  /**
   * Style 3 only — the ZOOM table's wave shape.
   *
   * ⚠️⚠️ **This pair exists because there are TWO FUNCTIONS, not because one function has two parameter
   * pairs.** The shift tables go through `buildWave`; style 3's zoom tables do not go through it at all —
   * they use `buildZoomWave`, a separate function carrying a DC bias term. **Twelve call sites across two
   * functions, and a shape applied to one function and not the other is a style-dependent divergence no
   * `tsc` can see.** (The spec's *"four call sites, two parameter pairs"* is falsified; `PHASE35-KEYS.md`
   * §3.2 has the site table.)
   */
  shape2?: WarpShape;
  /** Style 3 only — the zoom table's shape mix. 0 is the identity, as is `shape2: 'sine'`. */
  shapeMix2?: number;
  /**
   * The X SHIFT wave's sampling direction, **in DEGREES, and the range is `±WAVE_ANGLE_MAX` (±90)**.
   *
   * 0 is the identity: the wave is indexed by the screen column, exactly as it was before `35.3`. At a
   * non-zero angle the index becomes `frameCentreX + (x − fx)·cos a + (y − fy)·sin a`, i.e. the wave is
   * sampled along a rotated axis through the FRAME CENTRE — never the zoom centre, which is a different
   * quantity in this subsystem (`uStaticCentre`, styles 1–3's radial scaling) and has never touched the
   * wave's phase.
   *
   * ⚠️⚠️ **±90, NEVER 0–360, and there are TWO independent reasons — record both.** (1)
   * `(angle + 180°, −amplitude)` is **bit-identical**, because every occurrence of a frequency in
   * `buildWave` is linear in the sine's argument, so a full-circle track would offer every distinct field
   * TWICE — the exact symmetry this phase rejected, re-introduced in the UI. (2) ±90 has **no wrap, so the
   * shortest path IS the lerp**, which is what makes `blendLayerBlocks()`'s plain `mix()` correct; on a
   * 0–360 track a lerp from 350° to 10° sweeps the long way round. **A later reader who finds only the UI
   * reason may widen the range and silently break the Mixer.**
   *
   * ⚠️ **The nearest precedent in this same file is 0–360 and is a SIBLING BLOCK of the same layer type:**
   * `IfsTransform.angle` is *"rotation in degrees, applied around UV centre (0–360)"* and hangs off
   * `TransMapLayer.ifsParams`. Two `angle` quantities on one layer with two ranges — **do not harmonise
   * them in the direction you notice first.**
   */
  angleX?: number;
  /**
   * The Y SHIFT wave's sampling direction, in DEGREES, ±90 — **measured from its baked-in +90°**.
   *
   * ⚠️ **The quarter turn is baked in, not stored**, so `angleX = angleY = 0` is exactly today's orthogonal
   * pair and the default is the identity. `angleY = −90` makes the Y wave PARALLEL to the X wave, which is
   * the one-directional field `35.D4`'s surviving claim is about (0.994 from the orthogonal pair against
   * 0.498 for the two closest shipped archetypes).
   */
  angleY?: number;
  /**
   * Style 3 only — the ZOOM X wave's sampling direction, in DEGREES, ±90.
   *
   * ⚠️⚠️ **This pair exists for the same reason `shape2`/`shapeMix2` do: there are TWO FUNCTIONS.** The
   * shift tables go through `buildWave`, style 3's zoom tables through `buildZoomWave`. A rotation applied
   * to one builder and not the other is a style-dependent divergence no `tsc` can see.
   */
  angleX2?: number;
  /** Style 3 only — the ZOOM Y wave's sampling direction, in DEGREES, ±90, from its baked-in +90°. */
  angleY2?: number;
}

/**
 * One entry in `overlay.transMapChain`. See that field for the compatibility contract.
 *
 * The three per-style config blocks are mutually exclusive by `style`, and each is OPTIONAL: an absent
 * block means "use the engine default", which is what keeps a hand-written `{ style: 5, enabled: true,
 * weight: 1 }` valid.
 *
 * ⚠️ **`staticField` is per-layer; the raw `sinMagicParams` tables remain SHARED.** This corrected a
 * comment that used to sit here claiming per-layer static config was deliberately excluded because
 * "styles 0-3 deriving different fields from the SAME tables is what makes a 0+1 chain interesting". That
 * premise was measured false: two static layers reading one table produce fields whose nodal lines land in
 * the SAME places, so a 0+2 chain gained very little. Per-layer archetypes are what make chaining styles
 * 0-3 worth having. The 32-number tables are still not duplicated per layer — `staticField` is seven
 * scalars and resolves to the tables at runtime, so an export stays small.
 */
export interface TransMapLayer {
  style: TransMapStyle;
  /** Per-layer mute. A false layer keeps its settings but contributes nothing — for A/B in the UI. */
  enabled: boolean;
  /**
   * 0..1, multiplied into the global `transMapWarpMix` (and, for style 4, into the echo opacity).
   *
   * ⚠️ **Forced to 1 for a `weightless` style** (`StyleMeta.weightless` — style 9, Band Split), whose UI row
   * has no weight slider because a recomposition of the whole frame has no per-layer share. `normaliseChain`
   * pins it rather than trusting the file: `buildChainPlan` drops any layer at `weight <= 0`, so a 0 from a
   * hand-edited import would remove the layer from the pipeline with no control able to bring it back.
   */
  weight: number;
  /** Styles 1-3 only. Absent = fall back to the shared `postProcessors.transMap.zoomCenter`. */
  zoomCenter?: { x: number; y: number };
  staticField?: StaticFieldConfig;         // styles 0-3
  ifsParams?: IfsTransform[];              // style 4
  proceduralFlow?: ProceduralFlowConfig;   // style 5
  fluidFeedback?: FluidFeedbackConfig;     // style 6
  refraction?: RefractionConfig;           // style 7
  timeWarp?: TimeWarpConfig;               // style 8
  bandSplit?: BandSplitConfig;             // style 9
  vortex?: VortexConfig;                   // style 10
  conformal?: ConformalConfig;             // style 12
  parallax?: ParallaxConfig;               // style 11
}

/**
 * Style 7 — Density Refraction. Displaces along the gradient of the trail's OWN accumulated alpha.
 *
 * ⚠️ **Every field OPTIONAL and read as `?? default` (invariant 14)** — flat scalars in a per-layer block,
 * exactly as `StaticFieldConfig` is, so an export written before this style needs no `MigrationLayer`
 * backfill.
 */
export interface RefractionConfig {
  /**
   * 0..1 gain. Peak displacement is `strength × 8%` of `min(w,h)` — **the same target
   * `STATIC_FIELD_TARGET_FRACTION` sets for styles 0-3**, so "0.5" means the same visible amount here as
   * there, and it means it identically at 600p, 1080p and in a 180 px preview tile.
   */
  strength?: number;
  /**
   * Gradient sample distance in TEXELS of the full-resolution frame. Larger = softer, glassier.
   *
   * ⚠️ **A screen-space unit, so a preview tile scales it by `SCREEN_SPACE_TILE_SCALE`** — decide by UNIT,
   * not by field name. 4 texels on a 1080p canvas and 4 texels on a 180 px tile are not the same *distance*
   * across the figure.
   */
  reach?: number;
  /** Displace TOWARD density rather than away — pinch instead of bulge. */
  invert?: boolean;
  /**
   * What the height field is read from. `'density'` is the accumulated coverage in alpha; `'luminance'` is
   * the RGB luma, which follows the bright core rather than the coverage — visibly different on a
   * palette-mapped preset.
   */
  /**
   * What the height field is read from. `'density'` is the accumulated coverage in alpha; `'luminance'` is
   * the RGB luma, which follows the bright core rather than the coverage — visibly different on a
   * palette-mapped preset.
   *
   * ⚠⚠ **v8 `32.8` ADDED THREE BLUR LEVELS HERE AND `32.12` REMOVED THEM ON THE OWNER'S VISUAL
   * REVIEW (2026-10-26): *"not visible and therefore not adding value at all"*.** They read a level of
   * bloom's pyramid, so the lens would have been built from a chosen SCALE of the image's structure.
   *
   * ⚠⚠ **TWO REAL DEFECTS WERE FOUND AND FIXED BEFORE IT WAS CUT, AND NEITHER SAVED IT — WHICH IS
   * PHASE 31'S FINDING ARRIVING A FOURTH TIME: correctness was never the binding constraint.** The level
   * was never wired (every member read one texture, so all three were byte-identical), and the sources
   * were under-driven because `m / (1 + m)` saturates for a sharp field and stays linear for a blurred
   * one. After both fixes the levels differed MONOTONICALLY and still only at 1.0-1.7x a noise floor
   * that could not be driven below ~10, because the warp is a feedback loop.
   *
   * ⚠ **DO NOT RE-PROPOSE IT WITHOUT A NEW MECHANISM.** The gain compensation and the level wiring are
   * the obvious fixes and both were tried. What is left is the normalisation: `m / (1 + m)` is what makes
   * `Reach` behave as softness, and it is also what flattens the difference a blur is supposed to make.
   */
  source?: 'density' | 'luminance';
}

/**
 * Style 8 — Time Warp. Blends each pixel against an OLDER frame, by an amount that varies per pixel, so
 * different parts of one figure appear to run at different speeds.
 *
 * ⚠️ **A `modifier`, NOT the second `colour` style its spec assumed, and that choice is load-bearing.** As a
 * colour style it would have been a second pass alongside style 4's echo, which turns the chain's two
 * executable arrangements into six and needs two scratch intermediates — a derivation `echoRunsFirst()` and
 * `needsScratch` would then owe, and the spec explicitly left unpaid. Expressed as a modifier the temporal
 * blend happens INSIDE the warp pass, lerping against a history texture exactly as Band Split lerps against a
 * blurred one, so `COLOUR_STYLES` still has exactly one member and nothing above it has to be re-derived.
 *
 * ⚠️ **Its "one frame of history is free" premise was FALSIFIED.** The warp pass renders into `fboA` and
 * `texA` is that FBO's own colour attachment, so sampling `texA` as history is a framebuffer feedback loop —
 * undefined in WebGL2 and silent on ANGLE, i.e. invariant 20's failure shape rather than an error. It needs a
 * real third full-resolution `RGBA16F` (~8 MB at 1080p), allocated only when a style-8 layer is present and
 * released when it goes, like the echo scratch.
 *
 * ⚠️ **Every field OPTIONAL and read as `?? default` (invariant 14).**
 */
/**
 * v8 `30.5` (`E126`) — **what varies `Time Warp`'s lag per pixel. A NAMED UNION, and the name is the fix.**
 *
 * ⚠️ **IT EXISTS BECAUSE THE UPLOAD SITE USED TO READ THIS SET AS A TERNARY** — `source === 'density' ? 1
 * : 0` — which type-checks perfectly for any number of members and **silently maps every new one to
 * `'field'`**. That is the `RenderMode` lesson verbatim: *a union buys type safety, not enumeration
 * coverage.* Naming the union lets `trans-map.ts` hold a `Record<TimeWarpSource, number>`, so **a fourth
 * member is a compile error at the one place that has to know about it.** `deformcheck` §D asserts the
 * ternary has not come back.
 */
export type TimeWarpSource = 'field' | 'density' | 'coordinate';

export interface TimeWarpConfig {
  /**
   * 0..1. **0 is byte-identical to today** — the shader lerps by `amount × perPixelWeight`, so a zero amount
   * makes the history tap contribute nothing and the third target is never even allocated.
   */
  amount?: number;
  /**
   * What varies the lag per pixel — the reason this is not just a global frame blend.
   *
   * `'field'` weights by the magnitude of the summed chain offset, so the parts of the figure the warp is
   * pushing hardest are also the parts that lag: motion and smear coincide, which is what reads as
   * "different speeds" rather than "a soft frame". `'density'` weights by the trail's accumulated alpha
   * instead, so the dense core lags and sparse arcs stay crisp — the inverse of a global blur.
   */
  source?: TimeWarpSource;
  /**
   * v8 `30.5` (`E126`) — which coordinate drives the lag under `source: 'coordinate'`. Unread otherwise.
   *
   * `'x'` and `'y'` give the classic slit-scan shear — one edge of the frame showing a smeared past and
   * the other showing now. `'radial'` lags by distance from the centre, so the figure trails its own halo.
   */
  axis?: 'x' | 'y' | 'radial';
  /**
   * v8 `30.5` — slides WHICH end of the axis lags, −1..1, 0 = the plain ramp. Unread unless
   * `source: 'coordinate'`.
   */
  bias?: number;
}

/**
 * Style 9 — Band Split. Warps only the HIGH-FREQUENCY residual, so the figure holds its shape and position
 * while its surface texture crawls.
 *
 * ⚠️ **A `modifier`, not a field**: it contributes no offset of its own and is inert without an active field
 * layer (`isInertModifier()`, which the UI surfaces rather than leaving silent).
 */
export interface BandSplitConfig {
  /** 0..1. **0 is today's behaviour exactly**; 1 freezes the low-frequency base and warps only the detail. */
  amount?: number;
  /**
   * The split frequency, as a blur radius in TEXELS of the full-resolution frame — where "composition" ends
   * and "texture" begins. Screen-space, so tiles scale it by `SCREEN_SPACE_TILE_SCALE`.
   */
  radius?: number;
}

/**
 * Style 10 — Vortex / Angular Field. Coherent rotation about a placeable eye.
 *
 * ⚠️ **The one field style that is NOT separable, and that is its whole implementation cost.** Styles 0-3 pack
 * as `wX(x) + wY(y)` into two texture rows precisely because that replaced a 31.6 MB canvas-sized `RGBA32F`
 * texture. A tangential field is irreducibly 2D, so this one is an ANALYTIC shader term with no texture at
 * all — cheaper on the GPU, but it does not join the archetype list and does not go through `solveGain()`.
 * It therefore carries its own closed-form gain solve against the same 8 %-of-`min(w,h)` target
 * (`vortexGain()`), or `swirl` would mean something different here than on every other style.
 *
 * ⚠️ **It closes the one gap in the audit that was MEASURED rather than asserted**: the static archetypes
 * summed reach a tangential fraction of 0.431 against 1.000 for a true swirl, so no combination of styles
 * 0-9 produces coherent rotation. (Measured in Phase 14 over the 8 archetypes shipping then; the list reached
 * 14 on 2026-09-23 and the conclusion is structural rather than a count — every archetype is a SEPARABLE sum
 * of sines, which is why the tangential fraction is low, so an addition cannot raise it.) Graded ⭐⭐ medium and ranked below cheaper items on purpose — it is the
 * fifth field system terminating in the FIRST output channel, which is exactly what the output-channel
 * discriminator was written to catch. An honest coverage fix, not an expansion of what the engine can do.
 *
 * ⚠️ **Every field OPTIONAL and read as `?? default` (invariant 14).**
 */
/**
 * v8 `30.4` (`E125`) — **the conformal warp's settings. Style 12.**
 *
 * A conformal map is angle-preserving: locally every small shape is rotated and scaled but **never
 * sheared**, which is why the distortion reads as *lawful* rather than as the picture being pushed around.
 *
 * ⚠️ **IT IS APPLIED AS A DISPLACEMENT, `off = f(z) − z`, NOT AS A COORDINATE REPLACEMENT** (`30.D10`).
 * That is what lets it sum into the chain and makes `weight`/`Chain Mix` 0 the exact identity. **Accepted
 * cost, stated rather than hidden: at an intermediate weight the result is a partial displacement and is
 * therefore NOT conformal** — angles are preserved only at full weight. The alternative (a
 * coordinate-replacement style like `Fractal Feedback`) cannot be mixed at all.
 *
 * ⚠️ **The complex plane is normalised on `min(w, h)`** (invariant 26) about the resolved centre, so the
 * map means the same thing at every aspect ratio. A per-axis normalisation would make a circle an ellipse
 * and the "angle-preserving" claim false in the one place it is the whole point.
 */
export interface ConformalConfig {
  /**
   * Which analytic function. ⚠️ **`power` is `z^n` with INTEGER n only (`30.D16`)** — a fractional exponent
   * puts a BRANCH CUT along one ray, i.e. a hard radial discontinuity in the warp. The owner chose to keep
   * this member clean and to take the deliberate seam from `logPolar`, whose branch is the logarithm's own.
   */
  map?: 'power' | 'inverse' | 'logPolar' | 'mobius';
  /** `z^n`'s exponent, integer 2–8. Angles about the centre are multiplied by n, giving n petals. */
  power?: number;
  /**
   * The point the map operates about, in UV. ⚠️ **Resolves `centre` → the layer's own `zoomCenter` → the
   * shared default, which is the vortex eye's precedence exactly** (`30.D13`) — so a user who set a chain's
   * zoom centre and then added a conformal layer gets the point they were already looking at, and there is
   * no second rule for "the point this layer operates about".
   */
  centre?: { x: number; y: number };
  /**
   * Möbius `(az + b) / (cz + d)` with **`d` normalised to 1** (`30.D7`), so six scalars rather than eight.
   *
   * ⚠️ **The normalisation removes a redundant degree of freedom**: scaling all four parameters leaves the
   * map unchanged, so the raw form lets two different settings produce one image — which makes the Mixer
   * and the Randomiser waste moves on duplicates. **A Möbius authored elsewhere in raw `a,b,c,d` form must
   * be divided through by `d` on import.**
   */
  mobius?: { aRe: number; aIm: number; bRe: number; bIm: number; cRe: number; cIm: number };
}

export interface VortexConfig {
  /**
   * −1..1 signed gain; negative reverses the sense of the turn. Peak tangential displacement at |1| is
   * **`8%` of `min(w,h)`** — the same `STATIC_FIELD_TARGET_FRACTION` target styles 0-3 use, so 0.5 means the
   * same visible amount here as there, at 600p, at 1080p and in a preview tile.
   */
  swirl?: number;
  /**
   * Falloff extent in NORMALISED units (fraction of the frame's smaller axis).
   *
   * ⚠️ **A resolution-INDEPENDENT unit, so a preview tile must NOT scale it by `SCREEN_SPACE_TILE_SCALE`** —
   * decide by UNIT, not by field name. `RefractionConfig.reach` and `BandSplitConfig.radius` are in texels
   * and therefore do scale; this one is already a fraction.
   */
  radius?: number;
  /** Eye position in normalised UV. Absent = frame centre. Mirrors the per-layer `zoomCenter` pattern. */
  centre?: { x: number; y: number };
  /**
   * `'gaussian'` is contained — a local twist that dies away. `'inverse'` is long-range (`1/(1+r²)`) and
   * reads as the whole frame slowly stirring, like liquid in a glass.
   */
  falloff?: 'gaussian' | 'inverse';
}

/**
 * Style 11 — Depth-Aware Parallax. Scales the SUMMED warp offset by each pixel's depth.
 *
 * ⚠️ **A `modifier` like Band Split, not a field** — it contributes no offset of its own and multiplies
 * whatever the chain already produces, so it is inert with no active field layer and the UI must say so
 * (`isInertModifier()`, invariant 13). Hence also `weightless`: a per-layer weight on a multiplier would be
 * indistinguishable from turning the amount down, i.e. an inert second control.
 *
 * ⚠️ **This is the only style that reads a channel the post chain did not previously have.** The trail is
 * `RGBA16F` with RGB = colour and A = accumulated coverage, both spoken for, so depth arrives in a SEPARATE
 * `R16F` target that all three particle renderers write. That plumbing — not the shader term — is the cost,
 * and six invariants converge on it (1, 2, 3, 4, 5, 6); see `DepthTarget` in `depth-target.ts`.
 */
export interface ParallaxConfig {
  /** 0..1 master amount. **0 is byte-identical to today**, so adding the layer changes nothing until touched. */
  amount?: number;
  /** Displacement multiplier for the NEAREST depth. > 1 exaggerates the foreground. */
  nearScale?: number;
  /** Displacement multiplier for the FARTHEST depth. < 1 makes the background hold still. */
  farScale?: number;
  /**
   * `'linear'` interpolates near→far evenly. `'squared'` compresses the far field and exaggerates the near,
   * which reads as looking through rippled glass at something distant.
   */
  curve?: 'linear' | 'squared';
  /**
   * WHAT THE 0…1 DEPTH SCALE IS MEASURED AGAINST — the fix for a figure that occupies only a thin slice of it.
   *
   * ⚠️ **`depths[i] = (z − perspZ)/(canvasW + canvasH)`, so the denominator is the CANVAS and the numerator is
   * the FIGURE, and the two are unrelated.** A legacy figure (authored against a Canvas 2D renderer with no
   * depth channel) therefore lands in a narrow band around 0.5 and `Near`/`Far` cannot compensate — they scale
   * the whole mapped interval, so contrast WITHIN the figure stays proportional to the span. Measured across
   * the 93 legacy presets that are narrow but not flat (0.02 < span < 0.45), at `Near 0.5/Far 2.0` where a
   * full-range figure gives a 4.00× near:far ratio: median **1.30× as authored, 4.00× under `'figure'`**.
   *
   * - `'figure'` (default) — fit the figure's own measured band to 0…1 each frame.
   * - `'canvas'` — the raw normalisation, **byte-identical to the pre-2026-08-28 behaviour**. Kept reachable
   *   exactly, which is why this is categorical and not a slider position.
   * - `'manual'` — use `rangeFrom`/`rangeTo`. What `'figure'` deliberately gives up: a FIXED frame of
   *   reference, so a figure turning edge-on reads as turning edge-on instead of having its collapsing band
   *   silently re-expanded every frame.
   */
  depthRange?: 'figure' | 'canvas' | 'manual';
  /**
   * Manual band start, in RAW depth units (0 = far, 1 = near — the TEXTURE convention, per invariant 24).
   * Read only when `depthRange === 'manual'`. May exceed the figure's real band to exaggerate separation, or
   * sit inside it to isolate a slab and let the rest hold.
   */
  rangeFrom?: number;
  /** Manual band end, same units as `rangeFrom`. ⚠️ `rangeTo === rangeFrom` is a degenerate band and falls back to the raw scale rather than dividing. */
  rangeTo?: number;
}

// Re-export FilmLookParams so callers only need to import from this file
export type { FilmLookParams };

export type SinMagicParams = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];
