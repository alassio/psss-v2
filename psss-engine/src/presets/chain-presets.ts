import type { UnifiedPreset } from './types.ts';

/**
 * Presets whose subject is the TRANSMAP LAYER CHAIN — the multi-layer form the engine gained on 2026-08-18,
 * plus the per-layer `staticField` and the chain-level dispersion that followed it.
 *
 * ## Why this is a separate group rather than an entry in `FLOW_PRESETS` or the curated JSON
 *
 * ⚠️ **The curated `public/psss_presets.json` CANNOT hold one of these, and that is a hard limit, not a
 * preference.** That file is in the legacy Delphi format — `ParticleCount`, `TransMapStyle`, `MotionBlur` —
 * and its whole vocabulary for the TransMap is a single integer `TransMapStyle`. A chain is a list of layers
 * with per-layer weights and a `staticField` block; there is no legacy spelling for any of that, which is the
 * same reason `isLegacyExpressible()` forces `transMapChain` out into an export's `overlay`. Adding
 * `Fluid Cosmos` to the JSON would have silently reduced it to `TransMapStyle: 0` — the preset's own default
 * table, with none of its tuning — so the entry would load, render, and look nothing like the preset.
 *
 * These also read differently from the three existing built-in groups: `FIRE_PRESETS` and `FLOW_PRESETS` are
 * about the material and buoyancy pipelines, and `SHOWCASE_PRESETS` doubles as the Phase 8 crystal/heat
 * regression fixture. None of them exercises a chain, so folding a chain preset into one would make the
 * group's name stop describing its contents. Merged into the library in `main.ts` after those three.
 *
 * ⚠️ **Both halves of every dual-source field are written consistently here — deliberately** (invariant 17).
 * `renderMode`/`renderer.mode` and `transMapEnabled`/`postProcessors.transMap.enabled` each have two homes,
 * and the Lab writes only the overlay. An export therefore carries them DISAGREEING, which is exactly the
 * 2026-08-20 defect where a preview tile read the preset half and previewed no warp at all. A hand-authored
 * preset has no excuse for shipping that split, so `enabled: true` and `style: 0` appear in both places, and
 * `transMapStyle` mirrors the chain's first layer. Do not "de-duplicate" one of the pair away.
 *
 * ## ⚠️ The last two presets exist to TEST A DIAGNOSIS, not to demonstrate a feature
 *
 * `Refraction Bloom` and `Band Split Crawl` were authored 2026-08-21 after the Phase 14 browser pass reported
 * styles 7 and 9 as *"not that prominently visible"*. The diagnosis was that **both operators are conditioned
 * on the image the engine already produces** — refraction needs a steep density gradient, band split needs a
 * strong warp to split — and that no shipped preset supplies either input, so the operators were being judged
 * on their weakest case. These two supply the input deliberately, which makes them the falsification test for
 * that diagnosis: if the effects are still mild here, the cause is the operator and not the preset library.
 *
 * ⚠️ **Both therefore break the house rule about judging on a LOW-accumulation preset** (`Cylinder`, `Quader`,
 * `Pipes`). That rule exists so a particle-shape or grading change is not hidden by accumulation — but the
 * height field style 7 reads *is* accumulated alpha, so obeying it here would remove the operator's input.
 * `decayFactor` is high in both on purpose. Do not "fix" it toward the usual rule.
 */
export const CHAIN_PRESETS: Record<string, UnifiedPreset> = {

  /**
   * **Fluid Cosmos** — the reference example of a two-layer chain, and the library's first.
   *
   * ⚠️ **RENAMED 2026-09-21 from `Liquid Cosmos` (`21.3`, owner-approved), and the BODY IS UNTOUCHED.** The old
   * name was the sharpest collision in the library: *Liquid* with no `liquid` render mode, no liquid field and
   * no dye. Older documents and comments cite the old name — the whole applied set is tabulated in
   * `demo-presets.ts`'s header, which is the only place the nine old names are still written.
   *
   * Derived from a browser session on the legacy `Cosmos Energy` (2026-08-20), which supplies the figure
   * unchanged: a slow tight Lissajous knot on wave 0 only, with waves 1 and 2 all-zero. Everything that makes
   * this a distinct preset is the chain and its clock.
   *
   * ## The chain
   *
   * `[style 0 @ 1.0 + style 6 @ 0.03]`, and the weights are the whole point:
   *
   * - **Style 0 at full weight** carries a `Vertical Ripple` static field (`strength 0.68`, `detail 2.85`),
   *   so the warp has a standing shape of its own rather than the preset's flat `sinMagicParams` table.
   * - **Style 6 at 0.03** — three percent — is a fluid-feedback layer used as a PERTURBATION, not as the
   *   effect. At full weight the advection dominates and the ripple stops reading; at 0.03 it only unsettles
   *   the ripple's crests, which is what makes the surface look liquid instead of embossed. ⚠️ A weight this
   *   low is easy to mistake for a disabled layer and "tidy" up to something visible. It is load-bearing at
   *   exactly this magnitude, and it is also why the layer still allocates a velocity texture and a
   *   `FluidAdvectionProcessor` (`isStyleActive` is `enabled && weight > 0`).
   *
   * `drift: 0.001` is near the bottom of the track — a slow phase creep, not motion you watch directly. Note
   * that preview tiles pin `setDriftScale(0)`, so a tile shows this preset's field STILL while the main canvas
   * creeps; that is the documented tile rule, not a defect.
   *
   * ## Why the rest of the numbers
   *
   * - `transMapWarpMix: 0.16` — the global warp is mostly OFF. The chain's job here is to disturb the figure,
   *   and at higher mixes the knot smears into the field instead of sitting inside it.
   * - `transMapDispersion: 0.33` — chain-level chromatic fringing, the reason this preset wants `Legacy Graded`
   *   rather than plain `Legacy`: the fringes need a graded response to separate rather than clip.
   * - `speedFactor: 0.2` — a fifth of normal. Both the drift and the 3 % fluid layer are slow effects, and at
   *   1.0 the figure's own motion outruns them. This is the setting the 0.01 slider floor exists to reach.
   * - `fluidFeedback.amplify: 2.6` with `glowBoost: 0.15` compensates for the 0.03 weight — the layer's
   *   velocity field is scaled up so that three percent of it is still a legible amount of turbulence.
   *   `dispersion: 0` inside this block is deliberate and NOT a duplicate of the 0.33 above: the flat
   *   `transMapDispersion` key is the live one, and the nested key is read only as a legacy fallback, so
   *   setting both would say the same thing twice through two different code paths.
   * - `decayFactor: 0.37` and `blurRadius: 4` are `Cosmos Energy`'s own (legacy `MotionBlur 3`): a short trail.
   *   A long one would fill the ripple's troughs and flatten the whole effect.
   *
   * Every overlay key that equalled its runtime default was DROPPED from the session export rather than
   * copied in — `ribbonMode`, `linesEnabled`, `attractorIndex/Blend`, `figureScale`, and the inert
   * `curlNoise`/`physarum`/`fluidAdvection` blocks (all at blend 0 or `enabled: false`). An export is mostly
   * runtime-default noise; each key here was classified against its actual default constant first.
   */
  'Fluid Cosmos': {
    metadata: {
      name: 'Fluid Cosmos',
      version: 2,
      // 75x75 is `Cosmos Energy`'s authentic legacy design box — shared by 78 of the 177 curated presets —
      // and the figure's amplitudes are expressed in it. Not a placeholder: the uniform canvas fit scales by
      // `min(w/srcW, h/srcH)`, so changing it would rescale the knot.
      designResolution: { width: 75, height: 75 },
      tags: ['transmap', 'chain', 'static-field', 'dispersion'],
    },
    generators: {
      type: 'lissajous', particleCount: 16000, waveSpeed: 0.05,
      // No tumble and no initial pose — the figure is meant to hang still and let the chain move over it.
      rotation: [0, 0, 0],
      angle: [0, 0, 0],
      waves: [
        // Wave 0 carries the entire figure. `am.base` values are the legacy fractions of the 75-unit design
        // box, kept at full precision rather than rounded: they are the knot's proportions.
        { speed: 0.05, axes: [
          { phase: 90, am: { base: 16.479492, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 16, frequency: 1.0 } },
          { phase: 0, am: { base: 22.705078, amplitude: 0, frequency: 0 }, fm: { base: 1, amplitude: 16, frequency: 1.1 } },
          // The only axis with AM: a depth-axis oscillation at frequency 10 against fm amplitude 64, which is
          // what gives the knot its interior structure instead of a flat ring.
          { phase: 0, am: { base: 12.053572, amplitude: 21.428572, frequency: 10.0 }, fm: { base: 0, amplitude: 64, frequency: 1.0 } },
        ] },
        // Waves 1 and 2 are deliberately silent. `MAX_WAVE_CNT` is 3 and the generator reads all three, so
        // they are written out as explicit zeros rather than omitted.
        { speed: 0.05, axes: [
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
        { speed: 0.05, axes: [
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
      ],
      // Neutral grey base with full-swing amplitude and staggered phase shifts — the legacy rainbow sweep.
      // The palette comes from the film look, which takes precedence over these (palette > ramp > preset).
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [1, 1, 1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.3703703703703704, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      // `enabled: true` and `style: 0` MIRROR the overlay below — see the invariant 17 note in the file header.
      // `sinMagicParams` rows 2 and 3 are `Cosmos Energy`'s own table; the static field is summed with it, so
      // these are not dead values even though the field supplies the shape.
      transMap: {
        enabled: true, style: 0, beforeParticles: false,
        sinMagicParams: [[0,0,0,0],[0,0,0,0],[1,0,0,0],[8,0,0,0]],
        sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
        zoomCenter: { x: 50, y: 50 },
      },
      bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
      toneMap: { curve: 'none', exposure: 1.0, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    overlay: {
      renderMode: 'star',
      filmLook: 'Legacy Graded',
      transMapEnabled: true,
      // Mirrors `transMapChain[0].style`. `primaryTransMapStyle()` derives the same value from the chain, and
      // the legacy Style dropdown reads it — a disagreement here would show the wrong dropdown selection.
      transMapStyle: 0,
      transMapChain: [
        {
          style: 0, enabled: true, weight: 1.0,
          staticField: {
            pattern: 'Vertical Ripple', strength: 0.68, detail: 2.85, drift: 0.001,
            // `(Preset)` means the second pattern falls back to the preset's own `sinMagicParams` table
            // rather than a named archetype, so `strength2` scales that table rather than a second field.
            pattern2: '(Preset)', strength2: 0.5, zoomBias: 0,
          },
        },
        // 3 % — a perturbation of the ripple, not an effect in its own right. See the doc block above.
        { style: 6, enabled: true, weight: 0.03 },
      ],
      transMapWarpMix: 0.16,
      transMapDispersion: 0.33,
      fluidFeedback: { persist: 0.96, amplify: 2.6, dispersion: 0, fieldDecay: 0.985, glowBoost: 0.15 },
      speedFactor: 0.2,
    },
  },

  /**
   * **Refraction Bloom** — style 7 at the strength the operator was designed for.
   *
   * ## What this preset is FOR
   *
   * Style 7 displaces along the gradient of the trail's own accumulated density, so **the operator's amplitude
   * is a property of the IMAGE, not of the slider.** Where the frame is flat it does nothing by construction —
   * `refractOffset()` returns exactly `vec2(0)` at zero gradient. Every other style sloshes the whole frame and
   * is therefore visible on any preset; this one is visible only where the frame has structure to refract. That
   * is the whole reason it read as mild on the library: it was being asked to refract images that are mostly
   * empty space.
   *
   * So every choice below exists to manufacture a steep, moving alpha gradient:
   *
   * - **`particleCount: 24000`** — the highest in the library (`Fluid Cosmos` is 16000, the legacy maximum is
   *   8000). Particle count is the most direct control over density there is, and density IS the height field.
   * - **`decayFactor: 0.93`** — a long trail, deliberately against the low-accumulation house rule. The trail
   *   is the height field: a short trail means each frame's alpha is a thin scatter of splats with a noisy,
   *   near-zero mean gradient, which is precisely the "does nothing" case. Accumulation is what turns the
   *   figure into a *solid mass with edges*, and an edge is what a gradient operator needs.
   * - **`mode: 'star'` with `glow: 2.0`** — `star` writes `shape` into alpha (`hdr-particle.ts`'s
   *   `fragColor = vec4(..., shape)`), and its cross arms give each particle a wider alpha footprint than a
   *   point, so neighbouring particles' footprints overlap into continuous ridges instead of isolated spikes.
   *   ⚠️ Do not switch this to `pixel` to "sharpen" it: a one-texel-wide alpha spike has a gradient at only
   *   one texel and reads as stipple, not as a lens.
   * - **The figure is `Galaxy2`'s** (legacy, `MotionBlur 7`, 100×100 box) — a dense spiral whose arms sweep
   *   past each other, chosen because its density gradient is strong AND *moving*. A static gradient would
   *   give a static lens, which looks like a texture rather than an effect. `rotation: [0, 0, 0.1]` is its own
   *   slow Z tumble, kept: it is what sweeps the ridges across the frame.
   *
   * ## The chain, and why style 7 is ALONE on it
   *
   * `[style 7 @ 1.0]`, single layer, and that is a decision rather than minimalism:
   *
   * - **`fieldCount === 1`, so `uMaxOffset` takes the `NO_OFFSET_CLAMP` sentinel.** Adding any second field
   *   layer would switch on the `MAX_CHAIN_OFFSET_UV = 1.5` clamp on the *summed* offset, and since the point
   *   here is to see style 7 at full amplitude, a second layer would cap the very thing being demonstrated.
   * - **A second field layer would also mask the diagnosis.** If a static layer were sloshing the frame at the
   *   same time, "is style 7 prominent" becomes unanswerable — the observer cannot attribute what they see.
   *
   * `strength: 1.0` is the top of the slider, giving a peak displacement of `1.0 × 8% × min(w,h)` — the same
   * 8% target the static family is solved against, so this is a genuinely large warp, not a nudge.
   * `reach: 5.0` texels is the deliberate choice over a small value: at `0.5–1` the operator reads the fine
   * per-splat noise and looks like grain, while at 5 it reads the *shape of the arm* and produces the glassy
   * bulge the style exists for. ⚠️ `reach` is screen-space, so a preview tile scales it by
   * `SCREEN_SPACE_TILE_SCALE` (0.25) to 1.25 texels — the tile is therefore expected to look sharper and
   * busier than the canvas, which is the documented tile rule and not a defect.
   *
   * `source: 'density'` rather than `'luminance'`: alpha is coverage and is what the accumulation above was
   * built to shape, whereas luminance on a rainbow-swept preset tracks the colour cycle and would make the
   * lens wander for a reason unrelated to the figure's mass.
   *
   * `transMapWarpMix: 1.0` — full. `Fluid Cosmos` runs 0.16 because its chain is meant to *disturb* a figure;
   * here the refraction IS the subject.
   *
   * `transMapDispersion: 0.22` — moderate, and it earns its place: dispersion is proportional to the local
   * offset, so on this preset it fringes exactly the refracting ridges and nothing else, which reads as real
   * optical glass. ⚠️ Kept well below `Fluid Cosmos`'s 0.33 for a reason specific to style 7 — the dispersed
   * branch writes alpha from the GREEN tap, and alpha is style 7's own input next frame, so a very high value
   * feeds the operator a chromatically smeared height field. At 0.22 that coupling is present but small.
   *
   * ## How it should look
   *
   * A dense spiral knot that behaves like **blown glass**: the arms bulge the space immediately around
   * themselves, so the gaps between them appear to swell and pinch as the arms sweep past each other, while the
   * frame's empty corners stay perfectly, verifiably still. That stillness is the tell that this is style 7 and
   * not a whole-frame warp — and it is the property no other style in the library has.
   */
  'Refraction Bloom': {
    metadata: {
      name: 'Refraction Bloom',
      version: 2,
      // `Galaxy2`'s authentic legacy design box. The figure's `am.base: 30` is a fraction of THIS, so changing
      // it would rescale the spiral (the canvas fit is `min(w/srcW, h/srcH)`).
      designResolution: { width: 100, height: 100 },
      tags: ['transmap', 'chain', 'refraction', 'style7', 'phase14'],
    },
    generators: {
      type: 'lissajous', particleCount: 24000, waveSpeed: 0.05,
      // `Galaxy2`'s own slow Z tumble — load-bearing here, as it is what moves the density ridges.
      rotation: [0, 0, 0.1],
      angle: [0, 0, 0],
      waves: [
        // Wave 0 carries the whole figure, as in `Galaxy2`. The depth axis's `am.amplitude: 1800` against
        // `fm.frequency: 0.5` is what fans the spiral out in Z and gives the arms their interleaving.
        { speed: 0.05, axes: [
          { phase: 90, am: { base: 30, amplitude: 0, frequency: 0 }, fm: { base: 32, amplitude: 1, frequency: 2 } },
          { phase: 0, am: { base: 30, amplitude: 0, frequency: 0 }, fm: { base: 33, amplitude: 1, frequency: 2 } },
          { phase: 0, am: { base: 0, amplitude: 1800, frequency: 1 }, fm: { base: 0, amplitude: 2, frequency: 0.5 } },
        ] },
        // Waves 1 and 2 silent. Written as explicit zeros because the generator reads all `MAX_WAVE_CNT` = 3.
        { speed: 0.05, axes: [
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
        { speed: 0.05, axes: [
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
      ],
      // `Galaxy2`'s colour: a very slow sweep (`colorFreq` 0.1) so the figure holds one hue long enough for the
      // refraction to read as a distortion of a coherent object rather than as colour noise.
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.1, 0.2, 0.3],
    },
    // `decayFactor: 0.93` is the height field's build-up time — see the doc block. `blurRadius: 4` (legacy
    // `SmoothFilter`) additionally smooths the accumulated alpha, which SUPPRESSES per-splat gradient noise and
    // is therefore an ally of the operator rather than a cost.
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.93, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      // ⚠️ `style: 7` MIRRORS `overlay.transMapStyle` and the chain's only layer (invariant 17, file header).
      // Note this is the first entry in the library whose legacy `style` field is not legacy-expressible — a
      // JSON export reduces it, which is exactly why chain presets live in TS.
      transMap: {
        enabled: true, style: 7, beforeParticles: false,
        // `Galaxy2`'s own table. Inert here — no separable layer is in the chain to read it — but kept so the
        // preset degrades to the authentic figure rather than to zeros if a style 0-3 layer is ever added.
        sinMagicParams: [[0,0,0,0],[0,0,0,0],[1,0,0,0],[8,0,0,0]],
        sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
        zoomCenter: { x: 50, y: 50 },
      },
      bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
      toneMap: { curve: 'none', exposure: 1.0, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    overlay: {
      renderMode: 'star',
      // `Legacy Graded` for the same reason `Fluid Cosmos` uses it: the dispersion fringes need a graded
      // response to separate rather than clip to white at this density.
      filmLook: 'Legacy Graded',
      transMapEnabled: true,
      transMapStyle: 7,
      transMapChain: [
        // Single layer at full weight — see the `fieldCount === 1` argument in the doc block.
        {
          style: 7, enabled: true, weight: 1.0,
          refraction: { strength: 1.0, reach: 5.0, invert: false, source: 'density' },
        },
      ],
      transMapWarpMix: 1.0,
      transMapDispersion: 0.22,
      // Slower than default so the ridges sweep at the rate the lens can be READ at. At 1.0 the arms move
      // faster than the eye tracks the distortion and the effect reads as flicker.
      speedFactor: 0.45,
    },
  },

  /**
   * **Band Split Crawl** — style 9 given something worth splitting.
   *
   * ## What this preset is FOR
   *
   * Style 9 is a **modifier**: it contributes no offset of its own and instead recomposes another layer's warp,
   * freezing the low spatial frequencies where they were and letting only the high-frequency residual travel.
   * Its shader term is `fragColor.rgb += uBandAmount * (baseHere - baseThere)`, where the two samples are the
   * blurred frame at `vUv` and at `vUv + off`. **Both terms are driven by `off`.** So at small `off` the two
   * samples are nearly the same texel, their difference is nearly zero, and the operator is nearly a no-op —
   * *arithmetically*, not just perceptually. `isInertModifier()` already labels the `off == 0` case in the UI;
   * what it cannot label is the *weak-warp* case, which looks identical to a bug.
   *
   * That is the whole explanation for the mild browser verdict: style 9 was being layered onto warps far too
   * gentle to split. This preset therefore supplies a **violent** underlying warp — and then demonstrates that
   * the figure survives it, which is the operator's actual selling point.
   *
   * ## The chain
   *
   * `[style 0 @ 1.0 (Turbulent Weave, strength 1.0, detail 2.0) + style 9 @ 1.0]`:
   *
   * - **Style 9 needs a MULTI-harmonic archetype, and most of the list is not one.** The split isolates the
   *   warp's high-frequency residual, so a single-harmonic field gives the operator either everything to freeze
   *   or nothing to move. 9 of the 14 archetypes are single-harmonic (was 7 of 8 when this was chosen, and
   *   `Turbulent Weave` was then the only alternative at all). The layer's own comment carries the derivation
   *   and names which of the newer entries would also qualify.
   *
   * - **The style-0 layer is deliberately at maximum strength** with `transMapWarpMix: 0.85`. On its own this
   *   is a warp strong enough to destroy the figure's readability — smeared, unrecognisable. That is the
   *   point: the comparison the preset exists to make is *this warp with the band layer versus without it*.
   *   ⚠️ **To see what style 9 is doing, set Band Split to 0 and watch the figure fall apart.** That A/B is the
   *   demonstration; the preset is only the A side of it.
   * - **`drift: 0.35`** — a fast-moving field, far above `Fluid Cosmos`'s 0.001. A standing warp would let the
   *   frozen base and the crawling residual settle into a static pattern; the drift is what makes the surface
   *   *crawl* continuously while the composition holds.
   * - **`amount: 1.0`** — the maximum, which freezes the low-frequency base completely. Anything less lets the
   *   composition drift too, and the contrast between held mass and moving texture is exactly what is being
   *   shown.
   * - **`radius: 12.0` texels** — chosen at the LARGE end on purpose. The style's own tooltip records that
   *   large radii perceptually invert the effect: instead of fine crawl along each strand, whole tonal masses
   *   hold while sub-strands slide, which is the more legible of the two behaviours and the better answer to
   *   "is this visible". ⚠️ Screen-space, so a tile scales it to 3 texels — the tile shows the *fine-crawl*
   *   regime rather than this one. Expected, documented, not a defect.
   *
   * ⚠️ **`fieldCount` is 1, not 2** — the band layer contributes no offset and is deliberately excluded from
   * that count, so `uMaxOffset` still takes the no-clamp sentinel and the style-0 warp keeps its full range.
   * This is why a strong warp is even reachable here; adding a *second field* layer would clamp it to 1.5 UV.
   *
   * ## Why THIS figure
   *
   * `Hypno Penta` (legacy, 8000 particles, 100×100) — three nested waves at frequencies 2/3, 5/7 and 11/13
   * produce a figure that is **strongly structured at two separate spatial scales at once**: a broad pentagonal
   * envelope and a fine filigree inside it. A band-split operator's entire premise is that those two scales can
   * be treated differently, so a figure that *has* two scales is the one that shows it. On a single-scale
   * figure (a plain ring) there is no meaningful "composition versus texture" split to make.
   *
   * `rotation: [0, 0, 0]` — no tumble, which is unusual and deliberate: the composition must be visibly
   * STATIONARY for "the broad shape is holding still" to be legible. A rotating figure would supply its own
   * motion and the held-versus-crawling contrast would be lost.
   *
   * `decayFactor: 0.9` and 12000 particles give the filigree enough continuity to read as a surface — the
   * high-frequency residual has to *exist* before it can be the only thing moving.
   *
   * ## How it should look
   *
   * The pentagonal figure sits **rock-still and fully legible** while its entire surface boils — as though the
   * shape were a window onto moving water rather than an image being warped. Then, on setting Band Split to 0,
   * the same frame becomes an unreadable smear. That before/after is the operator's value proposition, and it
   * is a thing no other style in the library can do at any setting.
   */
  'Band Split Crawl': {
    metadata: {
      name: 'Band Split Crawl',
      version: 2,
      designResolution: { width: 100, height: 100 },
      tags: ['transmap', 'chain', 'band-split', 'style9', 'phase14'],
    },
    generators: {
      type: 'lissajous', particleCount: 12000, waveSpeed: 0.05,
      // No tumble — the composition must read as stationary. See the doc block.
      rotation: [0, 0, 0],
      angle: [0, 0, 0],
      waves: [
        // `Hypno Penta`'s three waves verbatim: frequencies 2/3, 5/7, 11/13 at halving amplitudes, which is
        // what produces structure at two clearly separated spatial scales.
        { speed: 0.05, axes: [
          { phase: 0, am: { base: 0, amplitude: 25, frequency: 2 }, fm: { base: 5, amplitude: 0, frequency: 0 } },
          { phase: 18, am: { base: 0, amplitude: 25, frequency: 3 }, fm: { base: 5, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
        { speed: 0.05, axes: [
          { phase: 0, am: { base: 12.5, amplitude: 12.5, frequency: 5 }, fm: { base: 25, amplitude: 0, frequency: 0 } },
          { phase: 3.6, am: { base: 12.5, amplitude: 12.5, frequency: 7 }, fm: { base: 25, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
        { speed: 0.05, axes: [
          { phase: 0, am: { base: 6.25, amplitude: 6.25, frequency: 11 }, fm: { base: 125, amplitude: 0, frequency: 0 } },
          { phase: 0.72, am: { base: 6.25, amplitude: 6.25, frequency: 13 }, fm: { base: 125, amplitude: 0, frequency: 0 } },
          { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
        ] },
      ],
      colorBase: [128, 128, 128], colorAmp: [128, 128, 128], colorFreq: [0.1, 0.1, 0.1], colorShift: [0.1, 0.2, 0.3],
    },
    renderer: { mode: 'star', glow: 2.0, decayFactor: 0.9, blurRadius: 4, depthSize: 0, streaks: 0 },
    postProcessors: {
      // `style: 0` mirrors `overlay.transMapStyle` and the chain's FIRST layer — the band layer is a modifier
      // and is not what a single-style reader should collapse to (invariant 17, file header).
      transMap: {
        enabled: true, style: 0, beforeParticles: false,
        // ⚠️ **Present for the LEGACY reader, not for this engine.** The chain's layer names an archetype, so
        // `resolveStaticWaves` takes the archetype branch and never reads this table — same as
        // `Refraction Bloom`. It is `Hypno Penta`'s own table, kept so a reader that collapses the chain to a
        // single style still gets a warp of the right character instead of a flat field.
        sinMagicParams: [[0,0,0,0],[0,0,0,0],[1,0,0,0],[8,0,0,0]],
        sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
        zoomCenter: { x: 50, y: 50 },
      },
      bloom: { enabled: false, threshold: 0.8, intensity: 0.3, radius: 5 },
      toneMap: { curve: 'none', exposure: 1.0, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    overlay: {
      renderMode: 'star',
      filmLook: 'Legacy Graded',
      transMapEnabled: true,
      transMapStyle: 0,
      transMapChain: [
        {
          style: 0, enabled: true, weight: 1.0,
          staticField: {
            // ⚠️ **This operator needs a MULTI-harmonic archetype**, and the choice is structural rather than
            // aesthetic. Style 9 isolates the HIGH-frequency residual of the warp, so the field must carry energy
            // at fine spatial frequencies — and 9 of the 14 archetypes are single-harmonic (`xAmp [1,0,0,0]`),
            // i.e. all their energy sits in ONE band. Handed one of those, the split has either everything to
            // freeze or nothing to move, and the operator looks broken while working perfectly. `Turbulent Weave`
            // is `[1, 0.5, 0.25, 0.125]` over `[1, 2, 4, 8]` on both axes, so it has real amplitude in every band
            // at once. `Fine Mesh` (freq 16) is fine-scale but still single-scale: it would move wholesale
            // rather than split.
            //
            // ⚠️ **It was the ONLY four-harmonic entry until 2026-09-23** and the sentence above used to say so.
            // Four of the six additions are multi-harmonic, and they are NOT interchangeable here:
            // `Harmonic Cascade` (1/2/3/4) and `Prime Comb` (2/3/5/7) would also drive the split, `Ember Cascade`
            // (1/8/16/14) would drive it hardest — but `Beat Swell` sits at ~0.1 cycles on every slot, i.e. four
            // harmonics all of them near DC, and would leave the operator with nothing in the fine band at all.
            // **"Multi-harmonic" is therefore not the test; "amplitude spread across BANDS" is.** This preset is
            // not retuned (21.D1): the choice stands, the reasoning is what was too narrow.
            //
            // `detail: 2.0` puts the four harmonics at 2 / 4 / 8 / 16 cycles across the axis — every one of them
            // a frequency the 177 legacy tables actually authored (x46, x47, x93, x13), and the top one exactly
            // `Fine Mesh`'s, which the module documents as "the densest lattice the library authors used". Not a
            // round number chosen for looks: past 16 the top octave has no provenance and buys no visible crawl.
            pattern: 'Turbulent Weave', strength: 1.0, detail: 2.0, drift: 0.35,
            // ⚠️ **No `pattern2`/`strength2`/`zoomBias`** — a style-0 layer has one table and no zoom term, so
            // those three keys would be fields nothing reads AND would force the chain out of legacy form on
            // export. `applyStaticFieldJump` deletes them for exactly this reason on any `style !== 3`.
          },
        },
        // The modifier. `weight` is present because `TransMapLayer` requires it and `buildChainPlan` filters on
        // `weight > 0`, but style 9 is `weightless` in `TRANS_MAP_STYLES` — the UI suppresses the slider rather
        // than shipping an inert control (invariant 13), and the shader reads `bandSplit.amount` instead.
        {
          style: 9, enabled: true, weight: 1.0,
          bandSplit: { amount: 1.0, radius: 12.0 },
        },
      ],
      // High but not 1.0: at full mix the style-0 field's own extremes dominate even the frozen base. 0.85 is
      // where the warp is violent enough to prove the point and the held composition still reads.
      transMapWarpMix: 0.85,
      // Zero, and that is a decision. Dispersion is proportional to the local offset, and this preset's offset
      // is large everywhere — any fringing would be extreme and would read as the subject, competing with the
      // band split for the observer's attention. This preset makes exactly one claim.
      transMapDispersion: 0,
      // The drift is fast; the figure's own motion is slowed so the crawl is what the eye follows.
      speedFactor: 0.35,
    },
  },
};
