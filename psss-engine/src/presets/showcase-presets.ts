import type { UnifiedPreset } from './types.ts';

/**
 * v8 Phase 8 showcase presets — three curated examples demonstrating the material, crystal and
 * Fire-Ice features end to end.
 *
 * These are deliberately separate from `FIRE_PRESETS` (Phase 6) and `FLOW_PRESETS`: they exercise the
 * Phase 8 crystal pipeline and the Open Point 7 heat rework, so they double as regression fixtures.
 * Merged into the library in `main.ts` alongside the other built-ins.
 *
 * ## Why the numbers look the way they do
 *
 * **Ramp coverage is the temperature range.** `vTemperature` indexes the colour ramp DIRECTLY as its
 * UV coordinate, so a preset's steady-state temperature span *is* the fraction of its ramp that gets
 * sampled. After the Open Point 7 fix 3b, steady state is `driver * heatGain`, where the velocity
 * driver is `0.05 + 0.95*linear(normalised)` (E3 — this header documented the OLD
 * `0.3 + 0.7*sqrt` driver long after it was replaced).
 *
 * The rebalance (Open Point 7) changed both terms: the floor 0.3 -> 0.05 and the curve sqrt -> LINEAR.
 * Ramp coverage went from ~70 % to ~95 %, so the `velocity` mode now reaches genuinely cold values on
 * its own. ⚠️ That OBSOLETES the stated reason for `Spectrum Bloom` using `heatMode: 'age'` — 'only
 * position and age reach 0' is no longer true. The preset still works and is unchanged; only the
 * justification is stale, so do not treat `age` as required if re-tuning it
 * `Spectrum Bloom` below uses `age`, and is the only one of the three that spans a full ramp.
 */
export const SHOWCASE_PRESETS: Record<string, UnifiedPreset> = {

  /**
   * 1) MATERIAL, NO CRYSTALS, MAXIMUM COLOUR-RAMP COVERAGE.
   *
   * `heatMode: 'age'` with `heatGain: 1.0` gives a steady-state span of the full `0.00 .. 1.00`, so
   * every entry of the ramp is sampled — the only heat mode that can, because the velocity driver's
   * 0.3 floor blocks the bottom third. Age also cycles per particle on a staggered 6s period, so the
   * whole ramp is swept continuously rather than being a static gradient across the figure.
   *
   * `fire-phase` is chosen over `fire` because it traverses the widest hue range, making the coverage
   * visible rather than merely measurable. Crystals are absent (no `crystal` block at all), which is
   * the point of this preset.
   */
  'Spectrum Bloom': {
    metadata: { name: 'Spectrum Bloom', version: 2, designResolution: { width: 960, height: 720 }, tags: ['material', 'showcase', 'phase8'] },
    generators: {
      type: 'lissajous', particleCount: 9000, waveSpeed: 0.06,
      // MILD TUMBLE for variation over time. The previous [0.4, 0.7, 0.2] is 8-30 MINUTES per
      // revolution, i.e. effectively static — the fire/ice cycle repeated against an unchanging pose.
      // Three mutually prime-ish rates give a slow non-repeating tumble: ~60 s, ~41 s and ~90 s per
      // revolution, so the figure never presents the same orientation twice within a viewing session
      // while staying slow enough not to compete with the heat cycle itself.
      rotation: [6.0, 8.8, 4.0],
      waves: [
        { speed: 1.0, axes: [
          { phase: 0, am: { base: 210, amplitude: 60, frequency: 2.0 }, fm: { base: 2, amplitude: 0.5, frequency: 0.3 } },
          { phase: 90, am: { base: 210, amplitude: 60, frequency: 3.0 }, fm: { base: 3, amplitude: 0.5, frequency: 0.4 } },
          { phase: 45, am: { base: 120, amplitude: 40, frequency: 2.0 }, fm: { base: 2, amplitude: 0.4, frequency: 0.2 } },
        ] },
        { speed: 1.0, axes: [
          { phase: 30, am: { base: 90, amplitude: 40, frequency: 5.0 }, fm: { base: 5, amplitude: 1.0, frequency: 0.5 } },
          { phase: 60, am: { base: 90, amplitude: 40, frequency: 4.0 }, fm: { base: 4, amplitude: 1.0, frequency: 0.6 } },
          { phase: 0, am: { base: 60, amplitude: 25, frequency: 3.0 }, fm: { base: 3, amplitude: 0.8, frequency: 0.4 } },
        ] },
        { speed: 1.0, axes: [
          { phase: 15, am: { base: 40, amplitude: 20, frequency: 7.0 }, fm: { base: 7, amplitude: 1.5, frequency: 0.8 } },
          { phase: 75, am: { base: 40, amplitude: 20, frequency: 6.0 }, fm: { base: 6, amplitude: 1.5, frequency: 0.7 } },
          { phase: 30, am: { base: 30, amplitude: 15, frequency: 5.0 }, fm: { base: 5, amplitude: 1.0, frequency: 0.5 } },
        ] },
      ],
      colorBase: [140, 120, 160], colorAmp: [80, 90, 90], colorFreq: [0.08, 0.11, 0.14], colorShift: [0, 0.33, 0.66],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.88, blurRadius: 2, depthSize: 0.4, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.55, intensity: 0.35, radius: 5 },
      toneMap: { curve: 'aces', exposure: 1.05, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    overlay: {
      renderMode: 'splat',
      // BLOOM IS SET HERE, NOT IN `postProcessors.bloom`.
      //
      // `applyFilmLook()` re-initialises the bloom pass from the FILM LOOK's own params, so a preset's
      // `postProcessors.bloom` block is overwritten on load and has no effect. The only way for a
      // preset to control its own bloom is `filmLook: 'Customize'` plus `customFilmLookParams`, which
      // `applyPresetChange` seeds before applying. (First pass used the named looks and bloomed hard:
      // Luminous is threshold 0.60 / intensity 0.40 and Glacier 0.45 / 0.55, both amplified further by
      // a high `emissionIntensity`.)
      filmLook: 'Customize',
      customFilmLookParams: {
        // Luminous, with bloom roughly halved and exposure trimmed. The point of this preset is RAMP
        // COLOUR, and heavy bloom washes hues toward white — exactly what must not happen here.
        // Re-tuned in the browser 2026-08-12: `glow` 3.0 → 1.0, `depthSize` 0.5 → 0.15 and
        // `bloomIntensity` 0.18 → 0.10. All three sharpen, for the reason the block already gives —
        // this preset is about RAMP COLOUR, and every soft-optics term dilutes a hue toward white.
        // `glow` is the reciprocal of a falloff exponent (`pow(falloff, 8.0/glow)`), so 1.0 is the
        // CRISPEST setting of the three, well below `Void`'s 1.5; combined with `haloStrength: 0` below
        // it makes each particle a near-hard dot of one ramp colour.
        glow: 1.0, depthSize: 0.15, depthBrightness: 0.3, depthDof: 0.0, depthColorShift: 0.0,
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3.0,
        bloomEnabled: true, bloomThreshold: 0.80, bloomIntensity: 0.10,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 1.0,
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        saturation: 1.15, vignette: 0.0, palette: 'none', paletteMapping: 'depth',
      },
      // Re-tuned 2026-08-12: 1.5x FASTER, against the other six presets in this pass which all slowed
      // down. The subject here is the `age`-driven sweep through `fire-phase`, whose period is a fixed
      // 6 s staggered per particle — that cycle is what must be watched, not the figure's motion, so a
      // faster clock shows more of the ramp per unit time.
      speedFactor: 1.5,
      // heatGain 1.0 + age mode => steady state spans the driver's full [0,1]. Raising heatGain above
      // 1.0 would only clip the top; it is the ONE value that gives complete coverage without clipping.
      //
      // Re-tuned 2026-08-12 — `splatRadius` 13 → 5, `coreBrightness` 1.9 → 0.9, `haloStrength` 1.3 → 0.
      // At 9 000 particles a radius of 13 overlapped heavily, and additive blending SUMS overlapping
      // splats, so neighbouring particles at different points of the ramp added into white — destroying
      // the exact thing this preset exists to show. Small radius + no halo keeps each particle's ramp
      // colour its own. Note the brightness cut is partly self-compensating: shrinking the radius raises
      // `emissionIntensity`'s damping term `pow(refOverlap/overlap, 0.25)`, which is why 2.2 still reads
      // correctly.
      material: {
        preset: 'Plasma', splatRadius: 5, coreBrightness: 0.9, haloStrength: 0, falloffExponent: 3.0,
        thermalLag: 0.062, emissionIntensity: 2.2,
        heatMode: 'age', heatGain: 1.0, blendMode: 'additive', colourRamp: 'fire-phase', velocityStretch: 0.25,
      },
      // No buoyancy: upward lift would sort particles by temperature vertically, which reads as a
      // gradient rather than as the whole ramp being swept per particle.
      buoyancy: { enabled: false, strength: 0, returnForce: 2.0, turbulence: 0.3, maxOffset: 200, curlOctaves: true, smokeThreshold: 0, smokeOpacity: 0.4, smokeDissipation: 0.95 },
      sparks: { enabled: false, poolSize: 500, threshold: 0.6, ejectionSpeed: 1.2, gravity: 200, drag: 1.5, minLifetime: 0.3, maxLifetime: 1.0, coolingRate: 2.0, splatRadius: 3, maxSparksPerFrame: 5 },
      // CRYSTALS, added deliberately after they arrived here BY ACCIDENT.
      //
      // A leak made `enabled` sticky across preset changes, so selecting a crystal preset first left
      // them on here — and the result was better than either preset designed for it: the age-driven
      // heat cycle races the figure through fire, ice forms in the cooled wake, then the cycle brings
      // the heat back around and wipes it out. Worth keeping on purpose. (The leak itself is fixed:
      // a preset with no crystal block now forces `enabled: false`.)
      //
      // The whole lifecycle is sized to the 6 s `age` period. A particle's driver is
      // `max(0, 1 - age/3)`, so it is genuinely cold for ages 3..6 s — a 3 s window. `crystalLifetime`
      // is 4 s, deliberately LONGER than that window, so ice is normally destroyed by the RETURNING
      // HEAT rather than by old age: the chase is the point, and a shorter lifetime would make crystals
      // expire on their own before the fire arrived.
      crystal: {
        enabled: true,
        // Sized to this figure (~680 model units): 12 gives ~25 px, about the same width as a material
        // particle, so ice reads as part of the same population rather than looming over it.
        shape: 'dendrite', crystalSize: 12,
        facetSharpness: 0.88, specularStrength: 1.6, iceOpacity: 0.8, edgeBrightness: 1.3,
        internalRefraction: 0.32, crystalRamp: 'ice',
        poolSize: 700, freezeCap: 0.5,
        // `meltThreshold` and `coldFraction` are both RELATIVE (normalised to the population's own
        // per-frame heat min/max), so these read as percentiles regardless of the absolute range.
        // With `age`, half the population sits at the cold floor, so 0.30 nucleates well inside the
        // cooled group, and 0.45 melts once a particle has climbed back into the warmer half.
        birthRule: 'cold', slowFraction: 0.3, coldFraction: 0.30, nucleationBudget: 6,
        nucleationTime: 0.4, crystalLifetime: 4, meltTime: 0.5, meltThreshold: 0.45,
        // Mild obstacle so the fire visibly parts around the ice it is about to destroy.
        clusterForce: -0.35, clusterForceRadius: 36, clusterForceReturn: 2.5,
        latticeSnap: 0, latticeCell: 10, symmetryFold: false,
        growthEnabled: true, accretionRadius: 12, stickingProbability: 0.3,
        growthAnisotropy: 0.35, maxGrowth: 1.7, accretionBudget: 5,
      },
    },
  },

  /**
   * 2) MIRACLE + ICE CRYSTALS.
   *
   * **These values are Rico's own hand-tuned export, transcribed verbatim.** Three of my earlier
   * attempts were rejected, and the diff against his version shows why — I had guessed wrong on every
   * decision that actually mattered:
   *
   * - **TransMap style 3 was DISABLED in mine.** Miracle's legacy entry carries `TransMapStyle: 3`
   *   with hand-authored `SinMagicParams`, and that zoom-combined warp is where most of the preset's
   *   character lives. Dropping it left a bare curve.
   * - **`filmLook: 'Legacy'` with bloom OFF**, not a bloom-reduced Customize. Legacy applies no
   *   post-processing at all, which is what keeps the ice readable.
   * - **`renderMode: 'splat'` plus an `Ice` MATERIAL** (alpha blending; `heatGain` was 0.3 when this
   *   was written and is now the recalibrated Ice default of 0.8), not bare
   *   star mode. I had reasoned that a material would compete with the crystal pass; in fact the soft
   *   alpha-blended ice *supports* the hard facets.
   * - **Neon lines ON.** The trajectory overlay is part of the look, not an optional extra.
   * - `decayFactor: 0.9877` (Miracle's real `MotionBlur: 8` value), not my 0.9 — much longer trails.
   *
   * ⚠️ **HISTORICAL — the crystal numbers this paragraph once recommended CAUSED A DEFECT and were
   * replaced on 2026-08-09.** It used to describe "a much larger pool (970) fed by a much SMALLER
   * per-frame budget (2)" and "a stronger, snappier obstacle force (-0.6 / return 3.5)". That obstacle
   * force is exactly what made this preset flood the screen with flat single-colour areas:
   * `clusterForce: -0.6` at `clusterForceRadius: 80` displaced every live particle by ~43 screen px
   * per frame, with an influence radius LARGER than the figure's own half-extent (~60 model units), so
   * one crystal deformed the whole figure. See the crystal block below for the full account.
   *
   * Shipped now, from Rico's verified working export: `poolSize 600`, `nucleationBudget 8`,
   * `clusterForce 0`, `clusterForceRadius 40`, `clusterForceReturn 1.5`. `accretionRadius: 12` is
   * unchanged and was always right.
   *
   * **Do not "restore" the old numbers from this paragraph.**
   *
   * Note `birthRule: 'slow'` here works *with* a material present, so `cold` would also be available.
   */
  'Miracle Frost': {
    // 80x80 is Miracle's own legacy Width/Height, and it is load-bearing: the generator scales every
    // AM base/amplitude by the canvas-to-design ratio, so this field is the UNIT the amplitudes below
    // are written in. Using 960x720 (copied from the other showcase presets) shrank the figure ~12x.
    //
    // Since 2026-08-06 that factor is UNIFORM — `min(w/designW, h/designH)`, the smaller axis governs —
    // and is applied at projection time rather than baked into the amplitudes. So the authored aspect
    // ratio now survives any canvas shape, and `overlay.figureScale` is the per-preset control for
    // reclaiming the space the uniform fit letterboxes.
    metadata: { name: 'Miracle Frost', version: 2, designResolution: { width: 80, height: 80 }, tags: ['crystal', 'showcase', 'phase8'] },
    generators: {
      // 20 000, matching Rico's own working export.
      //
      // ⚠️ I reduced this to 6 000 on 2026-08-09 on the theory that neon line density scaled with
      // particle count and was causing a white-out. **Rico's export DISPROVES that**: his working
      // configuration — base `Miracle` + neon + Ice material + crystals, which he confirmed looks
      // right — carries `particleCount: 20000` too. The count was never the problem.
      //
      // The actual difference was `clusterForce` (see the crystal block below).
      type: 'lissajous', particleCount: 20000, waveSpeed: 0.05,
      rotation: [0, 0, 0], angle: [0, 0, 0],
      waves: [
        { speed: 0.05, axes: [
          { phase: 90, am: { base: 0, amplitude: 40, frequency: 1 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
          { phase: 0,  am: { base: 0, amplitude: 40, frequency: 2 }, fm: { base: 1, amplitude: 0, frequency: 0 } },
          { phase: 0,  am: { base: 0, amplitude: 0,  frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
        { speed: 0.05, axes: [
          { phase: 30, am: { base: 0, amplitude: 20, frequency: 3 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
          { phase: 0,  am: { base: 0, amplitude: 20, frequency: 4 }, fm: { base: 3, amplitude: 0, frequency: 0 } },
          { phase: 0,  am: { base: 0, amplitude: 0,  frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
        { speed: 0.05, axes: [
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
      ],
      colorBase: [32, 64, 128], colorAmp: [64, 64, 128], colorFreq: [0.01, 0.02, 0.03], colorShift: [0.5, 0.23, 0.3],
    },
    // decayFactor is Miracle's MotionBlur: 8 -> 0.98765..., giving the long trails the look depends on.
    renderer: { mode: 'star', glow: 2, decayFactor: 0.9876543209876544, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      // TransMap style 3 (zoom combined) with Miracle's own SinMagicParams — the single biggest
      // contributor to the preset's character, and the thing my earlier versions omitted entirely.
      transMap: {
        enabled: true, style: 3, beforeParticles: false,
        sinMagicParams: [[20, 10, 5, 2.5], [-1, -2, -3, -4], [20, 10, 5, 2.5], [1, 2, 3, 4]],
        sinMagicParams2: [[-0.2, 0, 0, 0], [0.5, 0, 0, 0], [-0.2, 0, 0, 0], [-0.5, 0, 0, 0]],
        zoomCenter: { x: 50, y: 50 },
      },
      bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
      toneMap: { curve: 'none', exposure: 1, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
    },
    overlay: {
      ribbonMode: 'off',
      ribbonWidth: 3,
      // Neon lines are part of the look here, not an optional overlay.
      linesEnabled: true,
      lineWidth: 1.5,
      // Legacy == no post-processing. Bloom stays off, which is what keeps the ice legible.
      filmLook: 'Legacy',
      attractorIndex: -1,
      attractorBlend: 0,
      renderMode: 'splat',
      transMapEnabled: true,
      transMapStyle: 3,
      curlNoise: { enabled: false, turbulence: 0, scale: 1, evolutionSpeed: 0.5 },
      speedFactor: 1,
      physarum: { blend: 0, sensorAngle: 30, sensorDistance: 20, turnSpeed: 45, decayRate: 0.2, depositAmount: 0.05, showTrail: true, trailOpacity: 0.8 },
      fluidAdvection: { blend: 0, returnForce: 0.5 },
      // An ICE material alongside the crystals: soft alpha-blended cold glow supporting the hard
      // faceted pass.
      //
      material: {
        // The recalibrated `Ice` default, verbatim — this preset needs NO material override, and this
        // block exists only because `overlay.material` has no "inherit the default" form: `main.ts`
        // applies it with `Object.assign`, so an ABSENT block lets the live session's material leak in.
        // Re-sync these values if the Ice default is ever retuned.
        //
        // Dropping the old `heatGain: 0.3` was correct and is kept: that pinned the population at
        // temperature 0.09..0.30 — the bottom third of the ice ramp, where the authored alpha is
        // lowest, so B15 cut its opacity 36-67 %. At the default 0.8 the ramp is properly used and the
        // ice shows real blue-to-cyan variation.
        //
        // ⚠️ `emissionIntensity` was briefly overridden to 0.6 on 2026-08-09 and REVERTED the same day.
        // Both the override and its stated reason were wrong. Three diagnoses were made for the
        // "flat white areas" symptom before the real one:
        //   1. crystal coverage      — falsified: it still flooded at `poolSize: 50` (max ~33 crystals)
        //   2. a leaked blend state  — real bug, fix kept, but it did not stop the flooding
        //   3. `particleCount` 20000 — falsified: Rico's WORKING export carries 20 000 as well
        // The actual cause was `clusterForce` (see the crystal block below). Per-particle brightness was
        // never involved, so the default 1.7 is correct.
        preset: 'Ice', splatRadius: 11, coreBrightness: 1.3, haloStrength: 0.5, falloffExponent: 3,
        thermalLag: 0.7, emissionIntensity: 1.7,
        heatMode: 'velocity', heatGain: 0.8, blendMode: 'alpha', colourRamp: 'ice', velocityStretch: 0,
      },
      crystal: {
        // ⚠️ These are RICO'S OWN WORKING EXPORT values (2026-08-09), and they differ from the
        // previous set in exactly the way that matters.
        //
        // He reported that base `Miracle` + neon + Ice material + crystals looks right, while the
        // shipped `Miracle Frost` did not — then exported the working configuration. A field-by-field
        // diff found only **7** differences, and one of them explains the whole thing:
        //
        //     clusterForce        -0.6  ->  0      (OFF)
        //     clusterForceRadius  80    ->  40
        //     clusterForceReturn  3.5   ->  1.5
        //
        // `clusterForce` is the ONLY crystal control that changes the LISSAJOUS FIGURE rather than
        // just adding to the image. Negative means "obstacle": every live wave particle within the
        // radius is pushed AWAY from every crystal, every frame.
        //
        // At the old values the peak displacement was `|force| * radius * 0.10` = **4.8 model units
        // per frame — 43 screen pixels at this preset's figScale of 9.0**. And the radius itself was
        // the real problem: 80 model units against a figure whose half-extent is only ~60, i.e. **a
        // single crystal influenced the entire figure**, times ~640 crystals. The curve was being
        // continuously shredded and the displaced particles smeared across the frame. That is what
        // "completely different from before" was.
        //
        // Also changed, and much less consequential: `poolSize` 970 -> 600 and `nucleationBudget`
        // 2 -> 8, which together fill a smaller pool faster (capacity 396 in 0.8 s rather than 640 in
        // 5.3 s).
        //
        // ⚠️ Do NOT reintroduce a non-zero `clusterForce` here without checking `clusterForceRadius`
        // against the figure's own extent. A radius comparable to the figure size makes every crystal
        // a global force, which no amount of tuning elsewhere can compensate for.
        enabled: true,
        shape: 'dendrite', crystalSize: 22,
        facetSharpness: 0.85, specularStrength: 1.5, iceOpacity: 0.8, edgeBrightness: 1.2,
        internalRefraction: 0.3, crystalRamp: 'ice',
        poolSize: 600, freezeCap: 0.6,
        birthRule: 'slow', slowFraction: 0.3, coldFraction: 0.25, nucleationBudget: 8,
        nucleationTime: 0.5, crystalLifetime: 8, meltTime: 1, meltThreshold: 0.8,
        clusterForce: 0, clusterForceRadius: 40, clusterForceReturn: 1.5,
        latticeSnap: 0, latticeCell: 10, symmetryFold: false,
        growthEnabled: true, accretionRadius: 12, stickingProbability: 0.35,
        growthAnisotropy: 0.3, maxGrowth: 1.8, accretionBudget: 8,
      },
    },
  },

  /**
   * 3) THE FIRE-ICE BATTLE.
   *
   * The target preset the roadmap named from the start: *"blue-white crystals grow across the particle
   * field while orange fire streams melt holes through them."* Every piece has to cooperate:
   *
   * - `material: Fire` supplies `temperatures[]`, WITHOUT which `birthRule: 'cold'` silently degrades
   *   to `slow` and there is no duel at all — just fire with incidental ice.
   * - `birthRule: 'cold'` nucleates crystals among the COLDEST particles, so ice forms in the fire's
   *   cool margins rather than uniformly. This is the half of the duel that needs heat to be a real
   *   distribution — the Open Point 7 fix 3b is what makes it reliable.
   * - `meltThreshold: 0.42` sits INSIDE Fire's post-3b `[0.30 .. 1.00]` steady-state range, so hot
   *   particles genuinely destroy nearby ice. Set it above 1.0 and nothing ever melts early; below
   *   0.30 and every crystal dies on its first frame (the exact failure that produced "crystals never
   *   appear" during 8a-2).
   * - Short `crystalLifetime` with a fast `meltTime` keeps the battle churning rather than settling.
   * - `clusterForce` is POSITIVE here: fire streams are drawn TOWARD the ice they are melting, which
   *   concentrates the fight instead of letting the two phases drift apart.
   */
  'Fire and Ice': {
    metadata: { name: 'Fire and Ice', version: 2, designResolution: { width: 960, height: 720 }, tags: ['fire', 'crystal', 'showcase', 'phase8'] },
    generators: {
      type: 'lissajous', particleCount: 7000, waveSpeed: 0.09,
      rotation: [0.2, 0.5, 0.1],
      waves: [
        { speed: 1.0, axes: [
          { phase: 0,  am: { base: 190, amplitude: 70, frequency: 3.0 }, fm: { base: 4, amplitude: 1.5, frequency: 0.6 } },
          { phase: 90, am: { base: 150, amplitude: 55, frequency: 2.0 }, fm: { base: 3, amplitude: 1.2, frequency: 0.5 } },
          { phase: 45, am: { base: 110, amplitude: 45, frequency: 2.0 }, fm: { base: 2, amplitude: 1.0, frequency: 0.4 } },
        ] },
        { speed: 1.0, axes: [
          { phase: 36, am: { base: 110, amplitude: 50, frequency: 5.0 }, fm: { base: 6, amplitude: 2.0, frequency: 0.9 } },
          { phase: 18, am: { base: 130, amplitude: 60, frequency: 4.0 }, fm: { base: 5, amplitude: 1.8, frequency: 0.7 } },
          { phase: 0,  am: { base: 70,  amplitude: 30, frequency: 3.0 }, fm: { base: 3, amplitude: 1.2, frequency: 0.5 } },
        ] },
        { speed: 1.0, axes: [
          { phase: 54, am: { base: 60, amplitude: 30, frequency: 7.0 }, fm: { base: 8, amplitude: 2.5, frequency: 1.2 } },
          { phase: 27, am: { base: 60, amplitude: 30, frequency: 6.0 }, fm: { base: 7, amplitude: 2.2, frequency: 1.0 } },
          { phase: 63, am: { base: 40, amplitude: 20, frequency: 5.0 }, fm: { base: 4, amplitude: 1.5, frequency: 0.8 } },
        ] },
      ],
      // Warm base so the live figure reads as fire even before the material's ramp is applied.
      colorBase: [190, 90, 40], colorAmp: [60, 70, 50], colorFreq: [0.09, 0.13, 0.17], colorShift: [0, 0.28, 0.55],
    },
    renderer: { mode: 'splat', glow: 2.2, decayFactor: 0.87, blurRadius: 2, depthSize: 0.35, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.5, intensity: 0.4, radius: 6 },
      toneMap: { curve: 'aces', exposure: 1.1, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    overlay: {
      renderMode: 'splat',
      // Not a cold film look: the ice must read cold against WARM surroundings, so grading the whole
      // frame blue (Glacier) would flatten the very contrast this preset is about.
      // BLOOM IS SET HERE, NOT IN `postProcessors.bloom`.
      //
      // `applyFilmLook()` re-initialises the bloom pass from the FILM LOOK's own params, so a preset's
      // `postProcessors.bloom` block is overwritten on load and has no effect. The only way for a
      // preset to control its own bloom is `filmLook: 'Customize'` plus `customFilmLookParams`, which
      // `applyPresetChange` seeds before applying. (First pass used the named looks and bloomed hard:
      // Luminous is threshold 0.60 / intensity 0.40 and Glacier 0.45 / 0.55, both amplified further by
      // a high `emissionIntensity`.)
      filmLook: 'Customize',
      customFilmLookParams: {
        // Luminous with bloom reduced. Restrained bloom matters most here: the duel is a CONTRAST
        // between hard cold facets and soft hot glow, and heavy bloom bleeds the fire over the ice
        // until both read as one bright mass.
        glow: 3.0, depthSize: 0.5, depthBrightness: 0.3, depthDof: 0.0, depthColorShift: 0.0,
        lightingMode: 0, lightDir: [0.5, -0.7, 0.3], rimPower: 3.0,
        // Threshold raised to 0.85 so ONLY the hot cores bloom. Bloom triggers on luminance, and the
        // material gain below is what decides how much of the ramp clears it.
        bloomEnabled: true, bloomThreshold: 0.85, bloomIntensity: 0.22,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 1.0,
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
        // Saturation up: with the gain reduced, the ramp's hues must carry the look.
        saturation: 1.3, vignette: 0.0, palette: 'none', paletteMapping: 'depth',
      },
      speedFactor: 1.0,
      material: {
        // BRIGHTNESS GAIN CUT FROM 5.28x TO 1.10x.
        //
        // `coreBrightness 2.2 * emissionIntensity 2.4` = 5.28, and the fire ramp's luminance already
        // reaches 0.99 at the top — so even the COLDEST fire particle landed at luminance 1.10 against
        // a 0.78 bloom threshold. 100 % of the temperature range bloomed, every frame, which is both
        // the constant white and the reason no colour variation was visible: everything was clipped
        // past the top of the ramp before it could be seen. At 1.10x gain with threshold 0.85 only the
        // hottest ~38 % blooms, so hot cores glow while cooler fire keeps its orange and deep red.
        // Re-tuned 2026-08-12: `splatRadius` 11 → 7 and `haloStrength` 1.2 → 0. Both serve the CONTRAST
        // this preset is built on — hard cold facets against soft hot glow. The halo was the softest
        // thing in the frame and it bled fire over the ice, which is the same failure the reduced bloom
        // above already guards against; removing it does at the particle level what
        // `bloomThreshold: 0.85` does at the frame level. The smaller radius keeps fire particles
        // subordinate to the 14 px prisms (see `crystalSize` below, sized deliberately at ~1.7x a fire
        // particle) rather than competing with them.
        preset: 'Fire', splatRadius: 7, coreBrightness: 1.0, haloStrength: 0, falloffExponent: 3.5,
        // THERMAL MEMORY, so cooling is VISIBLE before ice appears.
        //
        // Fire ships `dissipation: 0.93`, which with `coolingRate: 1.5` gives a heat half-life of 2.4
        // FRAMES (0.04 s). Temperature was therefore just instantaneous velocity with no history: a
        // particle dipped at a curve cusp, a crystal was born, and it sped straight back up — so there
        // was no cooling trajectory to watch and crystals appeared out of nowhere. `thermalLag: 1.048`
        // gives a ~1 s half-life, so a slowing particle visibly darkens down the ramp for about a
        // second before it is cold enough to nucleate.
        //
        // Safe to change ONLY because steady state is `driver * heatGain` regardless of the cooling
        // parameter, so raising thermal memory alters neither the temperature range nor the saturation
        // risk. Before that fix this would have pinned every particle at 1.0.
        //
        // The value was `dissipation: 0.995` + `coolingRate: 0.6` before Batch M merged the pair into
        // `thermalLag` (seconds); 1.048 s is the exact equivalent, so this preset is unchanged.
        // Note it is now also frame-rate independent — the old pair gave a ~2.4x shorter half-life at
        // 144 Hz, which for THIS preset meant crystals nucleating visibly sooner on a fast monitor.
        thermalLag: 1.048, emissionIntensity: 1.1,
        heatMode: 'velocity', heatGain: 1.0, blendMode: 'additive', colourRamp: 'fire', velocityStretch: 0.5,
      },
      // smokeThreshold 0.25 -> 0.10. The smoke pass draws anything below it with the DIM `fire-smoke`
      // ramp instead of the fire ramp, and with the linear heat curve the population is far colder:
      // 0.25 would route ~38 % of the figure into grey smoke, hiding exactly the cool fire colours the
      // curve change unlocked. At 0.10 only the genuinely coldest ~10 % smoke.
      buoyancy: { enabled: true, strength: 2.2, returnForce: 1.6, turbulence: 0.45, maxOffset: 220, curlOctaves: true, smokeThreshold: 0.10, smokeOpacity: 0.4, smokeDissipation: 0.95 },
      sparks: { enabled: true, poolSize: 600, threshold: 0.55, ejectionSpeed: 0.1, gravity: 240, drag: 1.3, minLifetime: 0.25, maxLifetime: 0.9, coolingRate: 2.5, splatRadius: 3, maxSparksPerFrame: 8 },
      crystal: {
        enabled: true,
        // Prism: a hard mineral shard reads as a distinct SUBSTANCE against soft additive flame,
        // where a soft-edged shape would blend into it.
        // 26 -> 14. Effective on-screen width is `crystalSize * SHAPE_SIZE_COMPENSATION(prism=1.36)
        // * scaleFactor(0.94) * 2`, so 26 rendered ~66 px wide against ~19 px fire particles — 3.2x,
        // which dominated the frame. 14 gives ~36 px, i.e. ~1.7x a fire particle: clearly a distinct
        // body, still subordinate to the figure.
        shape: 'prism', crystalSize: 14,
        facetSharpness: 0.95, specularStrength: 2.2, iceOpacity: 0.85, edgeBrightness: 1.6,
        internalRefraction: 0.4, crystalRamp: 'ice',
        poolSize: 450, freezeCap: 0.42,
        // THE DUEL: nucleate among the coldest fifth. Requires the material above.
        // Budget cut 10 -> 3. With thermal memory the coldest 20 % is now a STABLE set rather than a
        // per-frame churn, so a high budget would freeze that whole region in a couple of frames — ice
        // appearing in a burst is precisely the "out of the blue" complaint. A small budget lets the
        // figure be seen cooling for a second before crystals accumulate in the cooled region.
        birthRule: 'cold', slowFraction: 0.3, coldFraction: 0.20, nucleationBudget: 3,
        // Slower form time so a crystal fades in as the region finishes cooling, rather than snapping.
        // `meltTime` 0.9 → 0.45 (browser, 2026-08-12): melting is the half of the duel the fire WINS,
        // and at 0.9 s a crystal lingered so long after being hit that the fire had already moved on —
        // so cause and effect came apart. Halving it keeps destruction legibly tied to the stream that
        // caused it. Deliberately still 0.45 s rather than instant: a hard pop would read as a
        // rendering glitch, not as ice melting. `nucleationTime` is untouched, so formation stays slower
        // than destruction — ice accumulates gradually and dies quickly, which is the asymmetry that
        // makes the fire feel like the aggressor.
        nucleationTime: 0.8, crystalLifetime: 6, meltTime: 0.45,
        // RE-SOLVED for the LINEAR heat curve (the sqrt curve was what kept the figure permanently
        // hot). Measured on this preset's own wave set: the coldest 20 % — what `coldFraction` selects
        // — now sit at temp <= 0.19, and the population is genuinely spread rather than bunched high.
        // At 0.30 the safe zone is the coldest ~51 % while ~49 % of particles are hot enough to melt
        // ice on contact: both halves of the duel are active, and neither dominates.
        meltThreshold: 0.30,
        // POSITIVE: fire is drawn toward the ice, concentrating the battle.
        clusterForce: 0.4, clusterForceRadius: 38, clusterForceReturn: 2.0,
        latticeSnap: 0, latticeCell: 10, symmetryFold: false,
        growthEnabled: true, accretionRadius: 13, stickingProbability: 0.4,
        growthAnisotropy: 0.35, maxGrowth: 1.9, accretionBudget: 6,
      },
    },
  },
};
