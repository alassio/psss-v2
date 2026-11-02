/**
 * @file v8 16.2 (E93) — the **Score**: a 2D diagram of the figure the Composer is editing.
 *
 * ⚠️ **THIS IS A DIAGRAM AND NOT A PREVIEW, AND THE DISTINCTION IS MEASURED RATHER THAN STYLISTIC.** The Lab
 * occupies half the screen (`index.html` + `layout.css`'s `grid-template-columns: 1fr 1fr`), so **the live,
 * full-quality, fully-graded render is already on screen at all times while the Composer is open.** A second
 * small render of the same thing would be strictly worse than what the user is already looking at, and would
 * cost a `GridTileRenderer`-sized budget to be worse. So the Score deliberately shows what the live view
 * CANNOT: the bare curve, in model space, with no rotation, no `uniformFit`, no material, no trail, no
 * grading — the mathematics rather than the picture.
 *
 * ⚠️ **ITS LABEL IS INLINE COPY AND IT IS LOAD-BEARING.** Calling this a *preview* would be invariant 25: the
 * user would read a diagram that deliberately omits rotation and grading as a faithful rendering, and then
 * diagnose the omissions as defects. The label states the omissions.
 *
 * ⚠️ **A FROZEN PLOT CANNOT SHOW BREATHING, and a large minority of library slots breathe** — an
 * `am.amplitude` or `fm.amplitude` makes the shape a function of time, so one instant is one of infinitely
 * many shapes. The answer is **not** an animation (that reintroduces the preview, plus a rAF loop this tab has
 * no business owning): it is a **second and third outline at SEARCHED instants**, which cost two extra
 * evaluations rather than a frame loop.
 *
 * ⚠️ **THIS PARAGRAPH USED TO SPECIFY A SINGLE FAINT PATH AT `pos + ½ period`, AND BOTH HALVES OF THAT WERE
 * DEFECTS — it is rewritten here rather than left standing beside its replacement, because a comment that
 * states a falsified mechanism is worse than no comment.** (a) The half-period offset was an **algebraic
 * identity**: it shifts every modulator's argument by `k · π`, and `sin(k · π) = 0` for EVERY integer `k`, so
 * the second path was drawn at the *same* modulator state as the first on **191 of 399 presets** while its
 * label announced a breathing range — see `chooseInstants` for the full write-up and the measurement.
 * (b) ⚠️ **Even a correct single ghost answers `"does anything breathe"` for TWO INDEPENDENT QUANTITIES with
 * ONE curve**, so a slot that pulses (`am.amplitude`) and a slot that wobbles (`fm.amplitude`) drew the same
 * picture and nothing on screen could say which — which is precisely what a user asked and the diagram could
 * not answer. **v8 16.10 (E101) therefore splits it into two NAMED curves** (`computeOverlayScores`, below):
 * cyan for the size extreme, amber for the winding extreme, white for `now`. The ghost is retired.
 */

import type { WaveConfig } from '../../core/interfaces.ts';
/*
 * v8 `34.1` — **the wave law is SHARED with the generator and this file no longer owns a copy of it.**
 *
 * ⚠️⚠️ **THAT IS A PRE-EXISTING DEFECT FIX, NOT A TIDY-UP.** Phase 33 added `Sharpness` (`33.2`) and
 * `Travel` (`33.3`) to `generators/lissajous.ts` and to nothing else, so from that day this file — the one
 * surface an author reads *while authoring* — drew a figure the engine does not render on any preset
 * carrying either value. Measured before the fix: this file contained **zero** occurrences of either word.
 * Nothing in the project asserted the two agreed, which is why the divergence arrived unannounced;
 * `composercheck` §R is now that assertion, and part of it is source-shaped (this file must hold no triangle
 * arithmetic and no sine-blend of its own).
 *
 * ⚠️ **`wave-law.ts` IMPORTS NOTHING AND MUST KEEP DOING SO**, because `composercheck` imports *this* file
 * under bare Node — which strips types but does not compile TypeScript. A transitive import reaching the DOM
 * or a GL type would make both files unloadable from a checker while `tsc --noEmit` stayed green.
 */
import { sumWaveAxes, applyTravel, applyGrow, applyOffset, DEFAULT_DESIGN_HALF_EXTENT } from '../../core/wave-law.ts';

/** `lissajous.ts`'s own constant. ⚠️ Its own `DEG`, re-derived rather than imported — see `evaluate`. */
const DEG = 180 / Math.PI;
const MAX_WAVES = 3;
const AXES = 3;

export type ScorePlane = 'xy' | 'xz' | 'yz';

/**
 * v8 `34.1` — **the figure operators the wave sum alone does not carry**, so the diagram can draw the figure
 * the ENGINE draws rather than the figure the waves alone describe.
 *
 * ⚠️⚠️ **THESE ARE `overlay` FIELDS AND NOT `generators.waves` FIELDS, WHICH IS THE WHOLE REASON THE
 * DIVERGENCE WAS INVISIBLE.** The Composer owns `generators.waves` and nothing else (`composercheck` §G),
 * so when `33.2`/`33.3` put `sharpness` and `travelX/Y/Z` in `overlay` the diagram's inputs did not change
 * and nothing failed. **A new figure operator landing in `overlay` is therefore a TWO-file edit** — the
 * generator and this bundle — and `composercheck` §R is what makes the second half fail loudly.
 *
 * ⚠️ **`halfExtent` IS A SEPARATE QUANTITY FROM `travel` AND BOTH ARE REQUIRED TO REPRODUCE THE ENGINE.**
 * `Travel` is authored as a fraction of the design HALF-extent, which the generator takes as
 * `min(designW, designH) * 0.5` from `metadata.designResolution`. A diagram that defaulted it would be right
 * on the 100×100 legacy bodies and silently wrong on every preset authoring its own box — invariant 27's
 * rule that a scale and its origin are two quantities, and that a preset cannot compensate for a
 * canvas-dependent error.
 */
export interface WaveOps {
  /**
   * `overlay.sharpness` — the **Body level**, 0 = sine, 1 = triangle. ⚠️ Absent means 0, which is
   * BIT-IDENTICAL to `sin`.
   *
   * ⚠️ **v8 `34.4`: `sharpnessStructure`/`sharpnessDetail` DEFAULT TO THIS VALUE, never to 0** (`34.D11`).
   * The caller may pass them explicitly; a caller that passes only `sharpness` gets the shipped global
   * behaviour, which is exactly what the six presets carrying that key mean by it.
   */
  sharpness?: number;
  /** v8 `34.4` — wave level 1. ⚠️ **Absent means *follow `sharpness`*, NOT 0.** */
  sharpnessStructure?: number;
  /** v8 `34.4` — wave level 2. ⚠️ **Absent means *follow `sharpness`*, NOT 0.** */
  sharpnessDetail?: number;
  /** `overlay.travelX/Y/Z`, in design half-extents. ⚠️ Absent means the stage does not run at all. */
  travel?: readonly [number, number, number];
  /**
   * v8 `34.2` — `overlay.offsetX/Y/Z`, in design half-extents, the same unit as `travel` (`34.D3`).
   * ⚠️ Absent means the stage does not run at all.
   *
   * ⚠️ **The Score auto-fits its box, so an offset alone moves the drawn curve and then the fit moves it
   * back** — which is correct rather than a bug: the diagram's subject is the CURVE, and the engine's own
   * reason for the operator is that the ROTATION is taken about the origin, which no still diagram shows.
   * It is passed through anyway because it composes with `grow` and `travel`, where it is visible.
   */
  offset?: readonly [number, number, number];
  /**
   * v8 `34.3` — `overlay.growX/Y/Z`, the amplitude RAMP COEFFICIENT.
   * ⚠️⚠️ **0 IS THE IDENTITY, NOT 1** — see `GROW_FLOOR` in `core/deform-limits.ts`.
   */
  grow?: readonly [number, number, number];
  /** `min(designW, designH) * 0.5`. ⚠️ Absent means the generator's own `?? 100` design box. */
  halfExtent?: number;
}

/**
 * The identity bundle — no sharpness, no travel.
 *
 * ⚠️ **ITS EXISTENCE IS WHAT KEEPS EVERY PRE-`34.1` CALLER BYTE-IDENTICAL, AND `composercheck` §R ASSERTS
 * THAT RATHER THAN TRUSTING IT.** `sharpness: 0` is a BRANCH in `sumWaveAxes` and not a zero weight, so the
 * identity is bit-exact including at `-0`; `travel` absent means the per-axis gate never runs.
 */
const NO_OPS: WaveOps = {};

/**
 * Every plane, in the order the UI draws them. ⚠️ **`PLANES.length` is the row width — do not hardcode 3.**
 *
 * ⚠️ **THERE IS NO `DEFAULT_PLANE` AND NO SELECTED PLANE ANY MORE (v8 16.9 / E100), AND THE CONSTANT'S REMOVAL
 * IS RECORDED HERE BECAUSE WHAT IT CARRIED WAS A DECISION AND NOT A GUESS.** It read *"three equal panes would
 * spend two thirds of the space on the least informative views"*, and that reasoning was not WRONG — it was
 * priced in the wrong currency. It is still true that most library presets put their structure in XY. What it
 * did not price is that a *chip selecting a plane* sat next to controls that write **all three axes**, so it
 * read as their scope: the owner reported exactly that confusion, on a control that was working. ⚠️ **And the
 * chips made invariant 29 worse rather than better — `composercheck` §K measures 11 / 11 / 10 distinct drawn
 * curves of 16 in XY / XZ / YZ against 16 of 16 in 3D, so in any single plane several picks are visually
 * identical, and a user who sees no change with a plane label in front of them has been handed an explanation
 * that is wrong.** Space is cheap; a wrong explanation is not.
 *
 * ⚠️ **DO NOT RESURRECT IT AS A DEFAULT PARAMETER ON `computeScore` — `plane` MUST STAY REQUIRED.** A default
 * argument does not count towards `Function.length`, so `computeScore(waves, plane = 'xy')` would report arity
 * **1** and trip `composercheck` §I's arity clause, whose message records that the arity was last wrong when a
 * caller passed a value it should not have. A caller that can omit the plane will omit it.
 */
export const PLANES: readonly ScorePlane[] = ['xy', 'xz', 'yz'];

/** Human captions, one per `PLANES` entry. Kept beside the list so an added plane cannot ship unlabelled. */
export const PLANE_LABELS: Readonly<Record<ScorePlane, string>> = { xy: 'X / Y', xz: 'X / Z', yz: 'Y / Z' };

/**
 * Which two model axes a plane projects, in draw order — the horizontal one first.
 *
 * ⚠️ **EXPORTED AND SHARED SINCE v8 16.20 (E111) BECAUSE THE FLATNESS CAPTION MUST NAME AXES, AND A SECOND COPY
 * OF THIS MAPPING IS THE `ratioBase` SHAPE IN A THIRD QUANTITY.** `evaluate` held it as an inline ternary and
 * `composercheck` held its own `PLANE_AXES` literal; a caption derived from a third copy could disagree with the
 * curve it sits under — the pane would say *"no Z size"* while drawing X against Y. **One owner, imported by
 * both the drawing and the copy.** The order matters as much as the membership: it is the order `evaluate`
 * writes its pairs in, so a swapped entry silently transposes a pane rather than blanking it.
 */
export const PLANE_AXIS_INDEX: Readonly<Record<ScorePlane, readonly [number, number]>> = {
  xy: [0, 1], xz: [0, 2], yz: [1, 2],
};

/**
 * How many points the diagram plots.
 *
 * ⚠️ **DELIBERATELY NOT `preset.generators.particleCount`, which runs to 50 000.** The Score draws a *path*,
 * so its sampling requirement is set by the highest winding number it must resolve, not by the figure's
 * density — and plotting 50 000 line segments into a ~300 px box every time a stepper is clicked would be an
 * allocation and raster cost with no visible return (invariant 8 is about RATE, and a stepper can be clicked
 * as fast as a key repeats).
 *
 * ⚠️ **BUT IT CANNOT BE A SMALL CONSTANT EITHER, and that is the Nyquist trap.** The library's windings reach
 * **8000** (measured; re-derived by `composercheck` §C on every run). At 2000 samples a winding of 8000 aliases
 * into a *different, plausible-looking* closed curve — the diagram would be confidently wrong rather than
 * obviously broken, which is the worst failure a diagnostic can have. So the count is derived from the
 * figure's own maximum winding at `≥ 8` samples per cycle, clamped to a raster-sane ceiling, and when the
 * ceiling binds the caller is told so it can say `undersampled` instead of lying.
 */
export const SCORE_MIN_SAMPLES = 720;
export const SCORE_MAX_SAMPLES = 24000;
export const SCORE_SAMPLES_PER_CYCLE = 8;

export interface ScoreResult {
  /** Flat `[x0,y0, x1,y1, …]` in model units, already projected onto the plane. */
  path: Float32Array;
  /** The same curve with every modulator at its opposite phase, or `null` when nothing breathes. */
  ghost: Float32Array | null;
  /** Half-extent actually used to fit the box, in model units. Reported so the label can state the scale. */
  extent: number;
  /** ⚠️ True when the winding needed more samples than the ceiling allows — the label MUST say so. */
  undersampled: boolean;
  /** Max |winding| over the live axes, which is what sets the sample requirement. */
  maxWinding: number;
}

/**
 * `lissajous.ts`'s `calcWaveParam`, re-implemented.
 *
 * ⚠️ **THE DUPLICATION IS DELIBERATE AND NARROW: this file must not import the generator.** The Score runs in
 * the UI on a preset object, with no GL context, no canvas size and no `GeneratorState` — instantiating a
 * `LissajousGenerator` to plot a diagram would allocate its whole particle buffer set for a 300 px picture,
 * and `init()` would reset `pos`, which is the very thing `setWaves()` exists to avoid. What it must NOT do
 * is drift: `composercheck` §D asserts the phase arithmetic against a literal re-implementation of the same
 * expression for exactly this reason, so a change to the generator's formula fails a checker rather than
 * silently making the diagram describe a figure the engine no longer draws.
 */
const modulate = (base: number, amplitude: number, frequency: number, time: number): number =>
  base + Math.sin(time * frequency / DEG) * amplitude;

/**
 * Evaluate the curve at one instant, projecting onto `plane`.
 *
 * ⚠️ **THE INNER EXPRESSION IS `sin((n + phase) · fm) · am` — the phase is INSIDE the multiplication.** This
 * is the derivation the whole phase rests on: the effective shift is `phase × winding`, not `phase`. Writing
 * it as `sin(n · fm + phase)` here would produce a diagram that disagrees with the engine on every winding
 * but 1, and it would disagree *plausibly* — a shifted curve, not a broken one.
 *
 * ⚠️ **`fm` IS DIVIDED BY `DEG` AND `am` IS NOT.** The generator does exactly this, and the asymmetry is the
 * units error invariant 10 warns about: `n` sweeps 0→360 in *degrees* while `Math.sin` wants radians, so the
 * conversion belongs on the frequency and nowhere else. Applying it to the amplitude too would shrink the
 * figure by 57× — and, since the Score auto-fits its box, **the diagram would look completely correct.**
 *
 * ⚠️⚠️ **v8 `34.1`: THE SUM AND THE SECULAR TERM ARE NOW `core/wave-law.ts`'s, AND THE INNER EXPRESSION
 * ABOVE IS NO LONGER WRITTEN HERE.** `sumWaveAxes` owns `sin((n + phase) · fm) · am`, the three-case basis
 * branch and the accumulation order; `applyTravel` owns the per-axis-gated secular term. **The two
 * paragraphs above are kept because they state the traps the shared function must not be edited out of**,
 * not because this file still performs the arithmetic — re-read them in `wave-law.ts` before touching it.
 *
 * ⚠️ **`i / samples` IS THE SAME NORMALISED FRACTION THE GENERATOR FEEDS `applyTravel` AS `i * invCount`.**
 * The counts differ by more than an order of magnitude (50 000 particles against a few thousand diagram
 * samples), and the fraction is the only quantity the two share — feeding an INDEX would make the diagram's
 * sweep shorter than the engine's by exactly the ratio of the counts, which auto-fitting would then hide.
 */
function evaluate(
  waves: readonly WaveConfig[], time: number, samples: number, plane: ScorePlane, ops: WaveOps,
): Float32Array {
  const out = new Float32Array(samples * 2);
  const am: number[][] = [], fm: number[][] = [], ph: number[][] = [];

  for (let t = 0; t < MAX_WAVES; t++) {
    am.push([0, 0, 0]); fm.push([0, 0, 0]); ph.push([0, 0, 0]);
    const wave = waves[t];
    if (!wave) continue;
    for (let q = 0; q < AXES; q++) {
      const axis = wave.axes[q]!;
      am[t]![q] = modulate(axis.am.base ?? 0, axis.am.amplitude ?? 0, axis.am.frequency ?? 0, time);
      fm[t]![q] = modulate(axis.fm.base ?? 0, axis.fm.amplitude ?? 0, axis.fm.frequency ?? 0, time) / DEG;
      ph[t]![q] = axis.phase ?? 0;
    }
  }

  const cStep = 360 / samples;
  const [ia, ib] = PLANE_AXIS_INDEX[plane];
  /*
   * v8 `34.4` — ⚠️ **the three wave LEVELS, with the `?? sharpness` backfill (`34.D11`) resolved HERE.**
   * This is the third site that expression lives at (the other two are `main.ts`'s `adoptFigureBasis()` and
   * the preview grid's tile renderer), and the reason is the same each time: the caller hands over an
   * `overlay`-shaped bundle in which an absent LEVEL means *follow Body*, and the shared wave law must not
   * know what an absent key means. **`?? 0` here would draw a smooth diagram over a faceted figure on the
   * six presets that carry only the global key** — which is `33.2`'s divergence again, one level down.
   */
  const body = ops.sharpness ?? 0;
  const sharp: readonly number[] = [body, ops.sharpnessStructure ?? body, ops.sharpnessDetail ?? body];
  const travel = ops.travel;
  // ⚠️ The whole-triple gate, resolved ONCE: `applyTravel` re-tests each axis, which is the load-bearing
  // half, but a figure with no travel at all must not pay a call per sample.
  const hasTravel = travel !== undefined && (travel[0] !== 0 || travel[1] !== 0 || travel[2] !== 0);
  const offset = ops.offset;
  const hasOffset = offset !== undefined && (offset[0] !== 0 || offset[1] !== 0 || offset[2] !== 0);
  const grow = ops.grow;
  const hasGrow = grow !== undefined && (grow[0] !== 0 || grow[1] !== 0 || grow[2] !== 0);
  const halfExtent = ops.halfExtent ?? DEFAULT_DESIGN_HALF_EXTENT;
  const invSamples = samples > 0 ? 1 / samples : 0;
  // ⚠️ One hoisted scratch, not a fresh `[0, 0, 0]` per sample: at the 24 000-sample ceiling, and with a
  // redraw on every keystroke, that was an allocation rate rather than an allocation (invariant 8).
  const v: number[] = [0, 0, 0];

  for (let i = 0; i < samples; i++) {
    const n = i * cStep;
    const tau = i * invSamples;
    sumWaveAxes(v, n, am, fm, ph, sharp);
    /*
     * ⚠️⚠️ **THE STAGE ORDER IS THE GENERATOR'S AND IT IS A CONTRACT FOR THE FIRST OF THE THREE.** `Grow`
     * scales the WAVE SUM ALONE, so it must run before the two additive stages or it would ramp the
     * translation too; `applyTravel` and `applyOffset` commute exactly, so their order is free. **If this
     * sequence ever disagrees with `lissajous.ts`'s, `composercheck` §R goes red** — which is the whole
     * reason §R exists.
     */
    if (hasGrow) applyGrow(v, tau, grow);
    if (hasTravel) applyTravel(v, tau, travel, halfExtent);
    if (hasOffset) applyOffset(v, offset, halfExtent);
    out[i * 2] = v[ia]!;
    out[i * 2 + 1] = v[ib]!;
  }
  return out;
}

/**
 * How finely the two sampling instants are searched for over the slowest modulator's period.
 *
 * ⚠️ **A SEARCH, NOT A FORMULA, AND THE FORMULA IT REPLACES WAS PROVABLY A NO-OP.** See `chooseInstants`.
 * 48 steps is chosen against the measurement, not for roundness: it leaves 0 of 177 legacy presets blank and
 * 5 with a ghost on top of the path, where a half-period offset left 37 and 99.
 */
const SEARCH_STEPS = 48;

/**
 * How much figure exists at instant `time` — the sum of instantaneous amplitude over axes that can wind.
 *
 * ⚠️ **AN AXIS WITH A ZERO EFFECTIVE WINDING CONTRIBUTES A CONSTANT, NOT A CURVE, so it must not count
 * toward "how much figure is there".** `Argus` slot 0 is the witness: `fm.base = 0` with `fm.amplitude = 64`,
 * so its winding — and therefore its entire visible extent — exists only away from the modulator's zero
 * crossings. Weighing it by amplitude alone would rank every instant equally and the search would pick the
 * first one, which is exactly the instant that fails.
 */
function reachProxy(waves: readonly WaveConfig[], time: number): number {
  let total = 0;
  for (const wave of waves) {
    if (!wave) continue;
    for (const axis of wave.axes) {
      const am = modulate(axis.am.base ?? 0, axis.am.amplitude ?? 0, axis.am.frequency ?? 0, time);
      const fm = modulate(axis.fm.base ?? 0, axis.fm.amplitude ?? 0, axis.fm.frequency ?? 0, time);
      if (Math.abs(fm) > 1e-12) total += Math.abs(am);
    }
  }
  return total;
}

/**
 * Pick the two instants the diagram plots: the fullest one, and the emptiest one for the ghost.
 *
 * ⚠️ **THIS REPLACES A `time = 0` MAIN PATH AND A HALF-PERIOD GHOST, AND BOTH WERE PROVABLY DEGENERATE — a
 * user-reported defect, found on `Argus` showing a BLACK diagram, and it is invariant 13's harder form twice
 * over.** Two independent errors compounded, which is why the symptom did not look like either of them:
 *
 * 1. ⚠️ **AT `time = 0` EVERY MODULATOR IS EXACTLY ZERO**, since `modulate` is `base + sin(time · f/DEG) · a`.
 *    So a slot authoring `am.base = 0` with a nonzero `pulse` contributes **nothing at all**, and a slot
 *    authoring `fm.base = 0` with a nonzero `wobble` has **no winding**. `Argus` does both: its whole figure
 *    lives in its modulators, so the diagram drew float noise (extent `3.07e-12` against an authored reach of
 *    100) and rasterised to a near-empty box. **Measured: 40 of 177 legacy presets drew essentially nothing.**
 *    The file's own header already knew a frozen instant cannot show breathing — it did not follow through to
 *    the instant it had frozen being the one instant where nothing breathes.
 *
 * 2. ⚠️ **A HALF-PERIOD GHOST IS AN ALGEBRAIC IDENTITY, NOT AN OPPOSITE PHASE, AND IT COULD NEVER HAVE
 *    RESCUED (1).** The offset was `180 / slowest`, so every modulator's argument moved by `k · π` for
 *    integer `k` — and `sin(k · π) = 0` for **every** `k`, not just even ones. Measured: `sin(180/DEG)` is
 *    `1.2e-16`. So the ghost was drawn at the *same* modulator state as the main path on **99 of 177**
 *    presets — a second path exactly on top of the first, while the label confidently read
 *    *"faint path = breathing range"*. **The nearby correct-looking value is a QUARTER period**, which is
 *    the honest inversion for the slowest rate but still lands on a zero for every even multiple of it.
 *
 * ⚠️ **SO THE FIX IS A SEARCH RATHER THAN AN OFFSET: no closed form can invert modulators at different
 * rates.** `main` is the instant of greatest reach and `ghost` the least, both over the slowest modulator's
 * full period (which contains whole cycles of every faster one). That makes the ghost genuinely *the other
 * extreme* — the label becomes true rather than aspirational — and it is what the diagram needs anyway,
 * since a diagram exists to show the figure at its most legible, not at an arbitrary clock reading.
 *
 * ⚠️ **`ghost` IS `null` WHEN THE TWO EXTREMES COINCIDE, i.e. when nothing breathes** — and that test is on
 * the SEARCHED values, not on whether any `amplitude` is nonzero. A modulator whose rate is 0 has a nonzero
 * amplitude and never moves, so keying the ghost off the amplitude alone reproduces defect (2) in miniature:
 * a second path drawn on top of the first, announcing a breathing range that does not exist.
 */
function chooseInstants(waves: readonly WaveConfig[]): { main: number; ghost: number | null } {
  let slowest = Infinity;
  for (const wave of waves) {
    if (!wave) continue;
    for (const axis of wave.axes) {
      const pairs: ReadonlyArray<readonly [number, number]> = [
        [axis.am.amplitude ?? 0, axis.am.frequency ?? 0],
        [axis.fm.amplitude ?? 0, axis.fm.frequency ?? 0],
      ];
      for (const [amp, freq] of pairs) {
        // ⚠️ `amp === 0` means the modulator is inert whatever its rate is, and `freq === 0` means it never
        // moves whatever its amplitude is — both are the STRICT/EFFECTIVE distinction `composercheck` §E pins.
        if (amp === 0 || freq === 0) continue;
        slowest = Math.min(slowest, Math.abs(freq));
      }
    }
  }
  // Nothing modulates at all: `time` is irrelevant, so 0 is as good as any and there is no second path.
  if (!Number.isFinite(slowest)) return { main: 0, ghost: null };

  // `modulate` uses `sin(time · freq / DEG)`, so a FULL period in `time` is `360 / freq`.
  const period = 360 / slowest;
  let tMax = 0, vMax = -Infinity, tMin = 0, vMin = Infinity;
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const t = i * period / SEARCH_STEPS;
    const v = reachProxy(waves, t);
    if (v > vMax) { vMax = v; tMax = t; }
    if (v < vMin) { vMin = v; tMin = t; }
  }
  // ⚠️ Relative, never absolute: reach spans 8 to 800 across the library, so a fixed epsilon would call every
  // small figure static and every large one breathing.
  const breathes = vMax - vMin > Math.abs(vMax) * 1e-9;
  return { main: tMax, ghost: breathes ? tMin : null };
}

/** How many samples this figure needs — see `SCORE_MAX_SAMPLES` for the aliasing argument. */
export function sampleCountFor(waves: readonly WaveConfig[]): { samples: number; maxWinding: number; undersampled: boolean } {
  let maxWinding = 0;
  for (const wave of waves) {
    if (!wave) continue;
    for (const axis of wave.axes) {
      // ⚠️ The requirement is set by the winding a VISIBLE axis carries, and a modulated winding can exceed
      // its base — so the bound must include `|base| + |amplitude|`, not just the base.
      const silent = (axis.am.base ?? 0) + (axis.am.amplitude ?? 0) === 0;
      if (silent) continue;
      maxWinding = Math.max(maxWinding, Math.abs(axis.fm.base ?? 0) + Math.abs(axis.fm.amplitude ?? 0));
    }
  }
  const want = Math.max(SCORE_MIN_SAMPLES, Math.ceil(maxWinding * SCORE_SAMPLES_PER_CYCLE));
  return { samples: Math.min(want, SCORE_MAX_SAMPLES), maxWinding, undersampled: want > SCORE_MAX_SAMPLES };
}

/**
 * Compute both paths. Pure — no canvas, no DOM, so it is testable and cheap to call on every edit.
 *
 * ⚠️ **THE SAMPLING INSTANTS ARE CHOSEN HERE AND ARE NOT A PARAMETER — deliberately, because a caller that
 * could pass `0` is a caller that WILL, and `0` is the one degenerate instant.** The previous signature took a
 * `time`, the tab passed `0` with a comment explaining that the ghost made it safe, and the ghost did not: see
 * `chooseInstants` for the two compounding defects and the measurements. Removing the parameter is what makes
 * the fix structural rather than a corrected call site.
 *
 * ⚠️⚠️ **v8 `34.1`: THIS FUNCTION TAKES NO `WaveOps` EITHER, AND THAT IS A DECISION WITH A COST.** Its one
 * caller is `ensureRatioScores`, the RATIO THUMBNAIL strip — an icon set built from synthesised unit waves
 * (`tileWaves`), whose job is to distinguish twenty *ratios* from one another and whose distinctness
 * `composercheck` §N and §O measure against the identity basis. So the thumbnails stay on the identity law.
 * **The stated limit: at `Sharpness = 1` the twenty icons still draw smooth curves while the figure is
 * faceted.** That is a different and much smaller claim than the one `34.1` fixes — a ratio icon does not
 * promise to be the figure — but it IS a claim, so it is written down rather than left to be rediscovered.
 * **The big Shape diagram is `computeOverlayScores`, and that one honours both operators.**
 */
export function computeScore(waves: readonly WaveConfig[], plane: ScorePlane): ScoreResult {
  const { samples, maxWinding, undersampled } = sampleCountFor(waves);
  const { main, ghost: ghostTime } = chooseInstants(waves);
  const path = evaluate(waves, main, samples, plane, NO_OPS);

  const ghost = ghostTime === null ? null : evaluate(waves, ghostTime, samples, plane, NO_OPS);

  let extent = 0;
  for (const arr of ghost ? [path, ghost] : [path]) {
    for (let i = 0; i < arr.length; i++) extent = Math.max(extent, Math.abs(arr[i]!));
  }
  return { path, ghost, extent, undersampled, maxWinding };
}

/**
 * Draw a computed Score into a 2D canvas.
 *
 * ⚠️ **THE BOX AUTO-FITS, WHICH MEANS THE DIAGRAM CANNOT SHOW ABSOLUTE SIZE — and the label must say so.**
 * Auto-fitting is right (an authored size of 800 and one of 8 both need to be visible, and the live render
 * already shows true scale), but it makes `size` look inert in the Score: doubling every axis's size changes
 * nothing here. That is invariant 13's harder form — the control moves exactly the right thing and the output
 * channel cannot represent it — so the readout prints the measured extent in model units beside the diagram.
 * **Do not "fix" this by fixing the scale; the extent readout is the fix.**
 *
 * ⚠️ **v8 16.14: THIS IS NOW THE RATIO THUMBNAILS' RENDERER AND NOTHING ELSE'S — grepped, two call sites, both
 * in `renderRatioRow`/`paintRatioBoxes`.** 16.9 moved the big Shape diagram to `drawOverlayScore`, which left
 * every constant here sized for a canvas that no longer calls it. **That is the whole of the illegibility the
 * owner reported, and it was NOT the colours:** at the shipped 22 px thumbnail, `pad = 10 * dpr` left a drawing
 * box of **2 px** — the figure got 9.1 % of the square, and the axes crosshair got the rest. Measured, both
 * DPRs: 22 px → 2/22 device px, 34 px → 14/34, 300 px → 280/300. **A length in an image-domain operator has to
 * be measured on the box it is drawn in (invariant 26); an absolute pad is only ever right at one size.** The
 * `Math.min` keeps the ≥ 167 px case byte-identical, so the documented `|| 300` fallback path is untouched.
 */
/**
 * The margin `drawScore` leaves around the figure, in DEVICE pixels.
 *
 * ⚠️ **EXPORTED SO `composercheck` §O CAN IMPORT AND MEASURE IT RATHER THAN GREP FOR THE EXPRESSION** —
 * `CLAUDE.md`: a source-shaped clause's remedy is to move the subject into the model, because a re-pointed regex
 * survives only until the next rename. The clause it serves asserts a RATIO (the figure gets ≥ 80 % of the
 * shorter side at every size the UI actually draws), never these two constants, so retuning them is not a
 * failure and shrinking the drawing box back to 9 % is.
 *
 * ⚠️ **ONE SHARED SCALE (`min(w,h)`), NOT ONE PAD PER AXIS — invariant 26.** A per-axis pad is anisotropic: it
 * would centre the figure differently horizontally and vertically, and the `1:1` circle is the row where that is
 * most visible. The `Math.min` against the old absolute value is what keeps every canvas ≥ 167 device px
 * byte-identical to its pre-16.14 rendering.
 */
export function scorePad(w: number, h: number, dpr: number): number {
  return Math.min(10 * dpr, Math.min(w, h) * 0.06);
}

export function drawScore(canvas: HTMLCanvasElement, score: ScoreResult): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 300;
  const cssH = canvas.clientHeight || 220;
  // ⚠️ Assign only on CHANGE: writing `canvas.width` clears the canvas and reallocates its backing store, so
  // an unconditional assignment turns every redraw into an allocation (invariant 8 is about rate).
  const wantW = Math.round(cssW * dpr), wantH = Math.round(cssH * dpr);
  if (canvas.width !== wantW) canvas.width = wantW;
  if (canvas.height !== wantH) canvas.height = wantH;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pad = scorePad(canvas.width, canvas.height, dpr);
  const boxW = canvas.width - pad * 2, boxH = canvas.height - pad * 2;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  // ⚠️ `extent === 0` is a real state — an all-silent figure — and dividing by it would put every point at
  // NaN, which Canvas 2D silently declines to draw. A blank diagram would then read as "the Score is broken"
  // rather than "this figure has no size", so the caller draws its own empty-state copy instead.
  const s = score.extent > 0 ? Math.min(boxW, boxH) / (2 * score.extent) : 0;

  // Axes, faint — the diagram is in model space with the origin at the centre, and nothing else says so.
  // ⚠️ Fainter than `drawOverlayScore`'s 0.10 ON PURPOSE: at thumbnail size the crosshair occupies a far larger
  // FRACTION of the square, and at 0.10 it competed with the curve it exists to give a frame of reference to.
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(pad, cy); ctx.lineTo(canvas.width - pad, cy);
  ctx.moveTo(cx, pad); ctx.lineTo(cx, canvas.height - pad);
  ctx.stroke();

  if (s === 0) return;

  const stroke = (arr: Float32Array, style: string, width: number): void => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width * dpr;
    ctx.beginPath();
    for (let i = 0; i < arr.length / 2; i++) {
      // ⚠️ Y is NEGATED: model space is Y-up, canvas space is Y-down. Omitting this mirrors the diagram
      // vertically, which on a symmetric figure — most of the library — is INVISIBLE, and on an asymmetric one
      // reads as a phase error in the engine.
      const px = cx + arr[i * 2]! * s;
      const py = cy - arr[i * 2 + 1]! * s;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    // The curve closes iff the winding is an integer; closing the path unconditionally would DRAW the seam
    // shut and hide exactly what the `closes` badge is about.
    ctx.stroke();
  };

  // ⚠️ Round joins and caps at thumbnail size: a 1.9 px stroke on a 34 px square meets itself at sharp angles on
  // every high-winding row, and mitred joins there produce stray spikes that read as figure geometry.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Ghost first, so the live path reads on top of it.
  if (score.ghost) stroke(score.ghost, THUMB_STYLES.ghost.style, THUMB_STYLES.ghost.width);
  stroke(score.path, THUMB_STYLES.path.style, THUMB_STYLES.path.width);
}

/**
 * ⚠️ **A SECOND, SEPARATE STYLE BLOCK, AND THE SEPARATION IS THE POINT: `OVERLAY_STYLES` IS A LEGEND CONTRACT
 * `composercheck` §N PINS PER KEY AGAINST `panel.css`, AND THESE COLOURS HAVE NO LEGEND.** Brightening the
 * thumbnails by editing `OVERLAY_STYLES` would have recoloured the three captioned curves of the Shape diagram
 * and failed that clause — correctly. The thumbnails are a monochrome icon set: one curve, no families to
 * distinguish, so white is available to them in a way it is not to a captioned pane.
 *
 * ⚠️ **`ghost` IS UNREACHABLE AT A PIXEL TODAY AND IS STILL STYLED HERE — deliberately.** §N pins the
 * arithmetic (`ensureRatioScores` authors `amplitude: 0`, so `chooseInstants` returns `ghost: null` for all
 * twenty rows); a seed that gained a modulator would put this stroke on screen, and it must not then be the one
 * colour nobody chose. **Do not delete it as dead — the clause that keeps it dead is in the checker, not here.**
 */
const THUMB_STYLES = {
  ghost: { style: 'rgba(150,190,255,0.34)', width: 1.6 },
  path: { style: 'rgba(255,255,255,1)', width: 1.9 },
} as const;

/* ==== v8 16.9 / 16.10 (E100 / E101) — the three-plane overlay decomposition ==============================
 *
 * ⚠️ **THIS IS A NEW EXPORT AND NOT AN EXTENDED `computeScore`, AND THE REASON IS AN ASSERTION: `composercheck`
 * §I pins `computeScore.length === 2`.** That clause exists because the previous signature took a `time`, the
 * tab passed `0`, and `0` is the one instant at which every modulator collapses to its base (invariant 28).
 * **Widening `computeScore` with a `time`, a plane array or an `extent` would re-open exactly the door that
 * assertion closed**, so the overlay work gets its own entry point and `computeScore` keeps its arity and its
 * caller (the ratio thumbnails, which need one plane and no overlays).
 */

/** The three curves a single pane can draw. `null` means that family provably does not move — see `spread`. */
export interface OverlayCurves {
  /** The figure at the instant of greatest reach. Always present. */
  now: Float32Array;
  /** The instant whose AM sum differs most from `now` — what `Pulse` does. `null` when nothing pulses. */
  size: Float32Array | null;
  /** The instant whose FM sum differs most from `now` — what `Wobble` does. `null` when nothing wobbles. */
  winding: Float32Array | null;
}

export interface OverlayScore {
  xy: OverlayCurves;
  xz: OverlayCurves;
  yz: OverlayCurves;
  /**
   * ⚠️ **ONE extent for all NINE curves, and it is the load-bearing property of both steps rather than a
   * convenience.** `drawScore`/`drawOverlayScore` fit their box to whatever extent they are handed, so a
   * per-pane or per-curve fit would (a) draw a slot with 110.851 model units of Z reach and none in XY at the
   * same apparent size in all three panes — the readout defect invariant 29 names — and (b) renormalise the
   * pulse away entirely, since the whole point of the cyan curve is that it is a *different size* from white.
   */
  extent: number;
  undersampled: boolean;
  maxWinding: number;
  /** True when the figure has no size at all in any plane — the caller draws its own empty-state copy. */
  silent: boolean;
}

/** Σ instantaneous |AM| over axes that can actually wind at `time` — the pulse family's reach at `time`. */
function amSum(waves: readonly WaveConfig[], time: number): number {
  let total = 0;
  for (const wave of waves) {
    if (!wave) continue;
    for (const axis of wave.axes) {
      const fm = modulate(axis.fm.base ?? 0, axis.fm.amplitude ?? 0, axis.fm.frequency ?? 0, time);
      // ⚠️ Same weighting as `reachProxy`, and for the same reason: an axis whose EFFECTIVE winding is zero
      // contributes a constant offset rather than a curve, so counting its amplitude would rank every instant
      // alike and the argmax would pick index 0 — which is the one instant that fails (invariant 28).
      if (Math.abs(fm) > 1e-12) total += Math.abs(modulate(axis.am.base ?? 0, axis.am.amplitude ?? 0, axis.am.frequency ?? 0, time));
    }
  }
  return total;
}

/** Σ instantaneous |FM| over axes that are audible at `time` — the wobble family's reach at `time`. */
function fmSum(waves: readonly WaveConfig[], time: number): number {
  let total = 0;
  for (const wave of waves) {
    if (!wave) continue;
    for (const axis of wave.axes) {
      const am = modulate(axis.am.base ?? 0, axis.am.amplitude ?? 0, axis.am.frequency ?? 0, time);
      // ⚠️ The mirror weighting: a winding on a silent axis moves nothing visible, so it must not decide which
      // instant is "the winding extreme". Silence is an AMPLITUDE of zero, never `fm.base === 0` — 96 audible
      // slots in the library wind entirely via their modulator.
      if (Math.abs(am) > 1e-12) total += Math.abs(modulate(axis.fm.base ?? 0, axis.fm.amplitude ?? 0, axis.fm.frequency ?? 0, time));
    }
  }
  return total;
}

/** The slowest live modulator rate, or `null` when nothing modulates. Shared by both searches. */
function slowestLiveRate(waves: readonly WaveConfig[]): number | null {
  let slowest = Infinity;
  for (const wave of waves) {
    if (!wave) continue;
    for (const axis of wave.axes) {
      const pairs: ReadonlyArray<readonly [number, number]> = [
        [axis.am.amplitude ?? 0, axis.am.frequency ?? 0],
        [axis.fm.amplitude ?? 0, axis.fm.frequency ?? 0],
      ];
      for (const [amp, freq] of pairs) {
        if (amp === 0 || freq === 0) continue;
        slowest = Math.min(slowest, Math.abs(freq));
      }
    }
  }
  return Number.isFinite(slowest) ? slowest : null;
}

/**
 * Pick the three instants a row plots: greatest reach, greatest AM departure, greatest FM departure.
 *
 * ⚠️ **`now` USES `reachProxy`'s ARGMAX, BYTE-FOR-BYTE THE SAME RULE AS `computeScore`** — so slot *k*'s own
 * white curve and slot *k*'s contribution to the combined row are the *same* instant. Two rules here would let
 * the two rows disagree about the figure while both looked entirely plausible, which is the worst failure shape
 * a diagnostic can have; `composercheck` §N asserts the agreement rather than trusting this comment.
 *
 * ⚠️ **A FAMILY'S INSTANT IS `null` WHEN THE SEARCHED SPREAD IS ZERO, AND THE TEST IS ON THE SEARCHED VALUES
 * WITH A RELATIVE EPSILON.** Keying the cyan curve off `am.amplitude !== 0` instead would reproduce the retired
 * ghost's defect in miniature: a modulator with a nonzero amplitude and a rate of **0** never moves, so a second
 * curve would be drawn exactly on top of the first while the legend announced a range that does not exist.
 * Relative, never absolute, because reach spans 8 to 800 across the library — a fixed epsilon would call every
 * small figure static and every large one breathing.
 */
function chooseOverlayInstants(waves: readonly WaveConfig[]): { now: number; size: number | null; winding: number | null } {
  const slowest = slowestLiveRate(waves);
  if (slowest === null) return { now: 0, size: null, winding: null };

  const period = 360 / slowest;
  const times: number[] = [];
  for (let i = 0; i < SEARCH_STEPS; i++) times.push(i * period / SEARCH_STEPS);

  let now = 0, reachMax = -Infinity;
  for (const t of times) {
    const v = reachProxy(waves, t);
    if (v > reachMax) { reachMax = v; now = t; }
  }

  const pick = (f: (w: readonly WaveConfig[], t: number) => number): number | null => {
    const ref = f(waves, now);
    let best: number | null = null, bestDelta = 0, scale = Math.abs(ref);
    for (const t of times) {
      const v = f(waves, t);
      scale = Math.max(scale, Math.abs(v));
      const d = Math.abs(v - ref);
      if (d > bestDelta) { bestDelta = d; best = t; }
    }
    return bestDelta > scale * 1e-9 ? best : null;
  };

  return { now, size: pick(amSum), winding: pick(fmSum) };
}

/**
 * Compute the three planes × up to three curves for one slot, or for the combined figure.
 *
 * `slot === null` means the combined figure — every wave. Otherwise only wave `slot` contributes, which is what
 * makes a per-row diagram answer *"what does THIS wave do"* rather than *"what does the figure look like"*.
 *
 * ⚠️ **Pure, and takes NO `time` — for the same structural reason `computeScore` does not:** a caller that can
 * name the instant is a caller that can name `0`. The instants are searched here and nowhere else.
 *
 * ⚠️⚠️ **v8 `34.1`: `ops` IS A THIRD PARAMETER WITH A DEFAULT, AND THE DEFAULT IS NOT A WAY OF SMUGGLING IT
 * PAST §N'S ARITY CLAUSE.** A defaulted parameter does not count towards `Function.length`, so
 * `computeOverlayScores.length` is still **2** — which on its own would leave that clause reading like a
 * guarantee about a signature it can no longer see. So §N's clause was WIDENED in the same commit: it now
 * reads the declared parameter list out of this file and asserts that there are exactly three names, that
 * none of them is `time`, that the first two carry no default, and that the third is `ops` and does. **The
 * property the arity clause protects is "no call site can freeze the instant", not "the arity is two"** —
 * and `ops` cannot name an instant: `sharpness` is time-independent and `travel` is `frac × halfExtent`,
 * also time-independent. The default exists so that the twenty ratio thumbnails and every existing clause
 * stay byte-identical; §R asserts that identity rather than assuming it.
 */
export function computeOverlayScores(
  waves: readonly WaveConfig[], slot: number | null, ops: WaveOps = NO_OPS,
): OverlayScore {
  const subject: readonly WaveConfig[] = slot === null
    ? waves
    : (waves[slot] ? [waves[slot]!] : []);

  const { samples, maxWinding, undersampled } = sampleCountFor(subject);
  const { now, size, winding } = chooseOverlayInstants(subject);

  const build = (plane: ScorePlane): OverlayCurves => ({
    now: evaluate(subject, now, samples, plane, ops),
    size: size === null ? null : evaluate(subject, size, samples, plane, ops),
    winding: winding === null ? null : evaluate(subject, winding, samples, plane, ops),
  });

  const xy = build('xy'), xz = build('xz'), yz = build('yz');

  let extent = 0;
  for (const pane of [xy, xz, yz]) extent = Math.max(extent, paneExtent(pane));
  return { xy, xz, yz, extent, undersampled, maxWinding, silent: extent <= 0 };
}

/**
 * The largest |coordinate| any curve of ONE pane reaches — v8 16.20 (E111).
 *
 * ⚠️ **THIS IS A PER-PANE QUANTITY AND `OverlayScore.silent` IS A FIGURE-WIDE ONE; THE GAP BETWEEN THEM IS THE
 * DEFECT 16.20(a) EXISTS TO CLOSE, AND IT IS A READOUT DEFECT RATHER THAN A GEOMETRY ONE.** `silent` is
 * `extent <= 0` over all nine curves, so a slot with real X/Y size and no Z at all is `silent: false` while its
 * XZ and YZ panes draw two faint axis lines and nothing else — honest, and reading as broken. **Measured over
 * the whole library: 30 of 3759 drawn panes are flat inside a row that is NOT silent** (22 XY, 4 XZ, 4 YZ), so
 * the empty state is rare enough that nobody would report it and common enough to be met.
 *
 * ⚠️ **RE-MEASURED 2026-09-17 over the library as it now composes: 21 of 3540** (17 XY, 2 XZ, 2 YZ). **The
 * conclusion is unchanged and so is the load-bearing half — still 0 of them has a live axis** (see
 * `composer.ts`'s caption note), so the caption still may not name a cause. ⚠️ **Do NOT read 30 → 21 as an event
 * this sub-phase caused: 3759 is TWO library bases old** (313 presets, then 303, now 295), and the refined-preset
 * review keeps replacing legacy bodies with hand-tuned ones that light an axis the legacy body left at a winding
 * of 0. **Both numbers move with every settle batch, in the same direction, for a reason that has nothing to do
 * with this function** — re-run the census (`computeOverlayScores` over every preset × `[null, …waves.keys()]` ×
 * 3 planes) rather than adjusting either figure, and never reconcile the two by subtraction.
 *
 * ⚠️ **IT MUST BE THE SAME TEST `drawOverlayScore` BAILS ON, WHICH IS WHY IT IS `> 0` AND NOT AN EPSILON.** That
 * function returns early on `!(extent > 0)` after drawing the axes; a caption keyed on a tolerance would either
 * caption a pane that drew a curve or draw nothing under a pane that claimed a shape. **The two tests are one
 * predicate expressed twice — if either moves, move both.**
 *
 * ⚠️ **AND IT MEASURES THE MAX ACROSS ALL THREE CURVES, NOT `now` ALONE.** A row whose entire XZ presence lives
 * in its pulse extreme has `now` flat and `size` real; captioning it *"flat here"* would contradict the cyan
 * curve visibly drawn on top of the words.
 */
export function paneExtent(curves: OverlayCurves): number {
  let e = 0;
  for (const arr of [curves.now, curves.size, curves.winding]) {
    if (!arr) continue;
    for (let i = 0; i < arr.length; i++) e = Math.max(e, Math.abs(arr[i]!));
  }
  return e;
}

/**
 * ⚠️ **THE THREE COLOURS ARE A CONTRACT WITH THE LEGEND, NOT A PALETTE CHOICE.** The tab prints one legend for
 * the whole tab — `white = now`, `cyan = size extreme`, `amber = winding extreme` — so a colour changed here
 * without changing the legend produces a diagram that is confidently mislabelled, which is worse than an ugly
 * one. Draw order is amber → cyan → white so `now` reads on top of both extremes.
 */
const OVERLAY_STYLES = {
  winding: { style: 'rgba(224,168,72,0.75)', width: 1 },
  size: { style: 'rgba(96,214,224,0.75)', width: 1 },
  now: { style: 'rgba(235,242,255,0.95)', width: 1.25 },
} as const;

/**
 * Draw one pane of an overlay row at an extent supplied by the CALLER.
 *
 * ⚠️ **THE EXTENT IS A PARAMETER PRECISELY BECAUSE IT MUST BE SHARED, and `OverlayScore.extent` is its ONE
 * owner** — every pane of a row is drawn at the same number. Do not "improve" this by fitting each pane to its
 * own contents: `drawScore`'s own header already records why (auto-fitting means doubling every size changes
 * nothing on screen, invariant 13's harder form), and here it would additionally erase the very difference the
 * cyan curve exists to show.
 */
export function drawOverlayScore(canvas: HTMLCanvasElement, curves: OverlayCurves, extent: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 120;
  const cssH = canvas.clientHeight || 120;
  // ⚠️ Assign only on CHANGE — writing `canvas.width` reallocates the backing store, and a per-slot row draws
  // three of these on every keystroke (invariant 8 is about RATE).
  const wantW = Math.round(cssW * dpr), wantH = Math.round(cssH * dpr);
  if (canvas.width !== wantW) canvas.width = wantW;
  if (canvas.height !== wantH) canvas.height = wantH;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pad = 5 * dpr;
  const boxW = canvas.width - pad * 2, boxH = canvas.height - pad * 2;
  const cx = canvas.width / 2, cy = canvas.height / 2;

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(pad, cy); ctx.lineTo(canvas.width - pad, cy);
  ctx.moveTo(cx, pad); ctx.lineTo(cx, canvas.height - pad);
  ctx.stroke();

  // ⚠️ `extent === 0` is a real state (an all-silent figure) and dividing by it puts every point at NaN, which
  // Canvas 2D silently declines to draw — so a blank pane would read as "the diagram is broken". The axes above
  // are still drawn, and the caller owns the empty-state copy.
  if (!(extent > 0)) return;
  const s = Math.min(boxW, boxH) / (2 * extent);

  const stroke = (arr: Float32Array, style: string, width: number): void => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width * dpr;
    ctx.beginPath();
    for (let i = 0; i < arr.length / 2; i++) {
      // ⚠️ Y NEGATED — model space is Y-up, canvas Y-down. On the library's many symmetric figures omitting
      // this is INVISIBLE, and on an asymmetric one it reads as a phase error in the engine.
      const px = cx + arr[i * 2]! * s;
      const py = cy - arr[i * 2 + 1]! * s;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    // Never `closePath()` — the curve closes iff the winding is an integer, and drawing the seam shut would
    // hide exactly what the `closes` / `open` badge is about (v8 16.13).
    ctx.stroke();
  };

  if (curves.winding) stroke(curves.winding, OVERLAY_STYLES.winding.style, OVERLAY_STYLES.winding.width);
  if (curves.size) stroke(curves.size, OVERLAY_STYLES.size.style, OVERLAY_STYLES.size.width);
  stroke(curves.now, OVERLAY_STYLES.now.style, OVERLAY_STYLES.now.width);
}
