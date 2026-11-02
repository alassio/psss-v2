import type { UnifiedPreset } from './types.ts';

export const FIRE_PRESETS: Record<string, UnifiedPreset> = {
  'Lissajous Flame': {
    metadata: { name: 'Lissajous Flame', version: 2, designResolution: { width: 960, height: 720 }, tags: ['fire', 'phase6'] },
    generators: {
      type: 'lissajous', particleCount: 2000, waveSpeed: 0.08,
      rotation: [0.15, 0.08, 0],
      waves: [
        { speed: 1.0, axes: [
          { phase: 0, am: { base: 200, amplitude: 50, frequency: 3.0 }, fm: { base: 5, amplitude: 2.0, frequency: 1.0 } },
          { phase: 18, am: { base: 150, amplitude: 40, frequency: 4.0 }, fm: { base: 3, amplitude: 1.5, frequency: 0.8 } },
          { phase: 0, am: { base: 80, amplitude: 20, frequency: 2.0 }, fm: { base: 1, amplitude: 1.0, frequency: 0.5 } },
        ] },
        { speed: 1.3, axes: [
          { phase: 36, am: { base: 180, amplitude: 30, frequency: 5.0 }, fm: { base: 7, amplitude: 1.5, frequency: 1.2 } },
          { phase: 9, am: { base: 120, amplitude: 50, frequency: 3.5 }, fm: { base: 4, amplitude: 2.0, frequency: 0.7 } },
          { phase: 18, am: { base: 60, amplitude: 15, frequency: 2.5 }, fm: { base: 2, amplitude: 1.0, frequency: 1.0 } },
        ] },
        { speed: 0.7, axes: [
          { phase: 54, am: { base: 100, amplitude: 40, frequency: 4.0 }, fm: { base: 3, amplitude: 2.5, frequency: 1.5 } },
          { phase: 0, am: { base: 200, amplitude: 60, frequency: 2.0 }, fm: { base: 5, amplitude: 1.0, frequency: 0.5 } },
          { phase: 45, am: { base: 50, amplitude: 10, frequency: 3.0 }, fm: { base: 1, amplitude: 0.5, frequency: 1.0 } },
        ] },
      ],
      colorBase: [200, 80, 20], colorAmp: [55, 80, 40], colorFreq: [0.1, 0.15, 0.2], colorShift: [0, 0.3, 0.6],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.86, blurRadius: 2, depthSize: 0.3, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.6, intensity: 0.3, radius: 5 },
      toneMap: { curve: 'aces', exposure: 1.0, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    // Re-tuned in the browser 2026-08-10 from an exported working preset. Only the SPARKS and the film
    // look changed; the wave, colour, renderer and `material`/`buoyancy` blocks are unchanged.
    //
    // The spark change is one coherent edit, not five: embers now DRIFT rather than being SHOT. Ejection
    // speed drops 5× (1.5 → 0.3) and drag rises 2.5× (1.2 → 3.0), so a spark decelerates almost at once
    // instead of carrying its launch velocity; lower gravity (250 → 150) then lets it hang in the rising
    // flame rather than falling straight out of frame. Spending far less distance per spark is what pays
    // for 3.25× the spawn rate (8 → 26/frame) — the look is many short-lived embers in the flame body
    // instead of few long ballistic arcs. `poolSize` 500 → 200 is consistent with that: lifetimes are
    // unchanged at 0.2–0.8 s, and a shorter travel distance means fewer sparks are alive at once, so the
    // extra 300 slots were headroom that could never be filled.
    //
    // ⚠️ `maxSparksPerFrame: 26` is inside the UI's Budget/Frame range (1–40) but is well above the
    // 1–8 the other four fire presets use. It is affordable only BECAUSE of the physics above; raising
    // ejection speed or lowering drag again without also cutting the budget would flood the frame.
    overlay: {
      renderMode: 'splat',
      // ⚠️ Was 'Luminous' (glow 4.8, soft bloom, ACES). 'Legacy' means NO post-processing and glow
      // pinned at 4.0 — i.e. this preset now shows the raw splat/material output, which is where its
      // hand-tuned `coreBrightness`/`haloStrength`/`emissionIntensity` read exactly as authored rather
      // than through a grade. Present in the exported working preset, so carried through deliberately.
      filmLook: 'Legacy',
      speedFactor: 1.0,
      material: { preset: 'Fire', splatRadius: 10, coreBrightness: 2.0, haloStrength: 1.0, falloffExponent: 3.5, thermalLag: 0.04, emissionIntensity: 2.0, heatMode: 'velocity', heatGain: 1.0, blendMode: 'additive', colourRamp: 'fire', velocityStretch: 0.4 },
      buoyancy: { enabled: true, strength: 2.0, returnForce: 1.5, turbulence: 0.4, maxOffset: 200, curlOctaves: true, smokeThreshold: 0.25, smokeOpacity: 0.4, smokeDissipation: 0.95 },
      sparks: { enabled: true, poolSize: 200, threshold: 0.5, ejectionSpeed: 0.1, gravity: 150, drag: 3.0, minLifetime: 0.2, maxLifetime: 0.8, coolingRate: 3.0, splatRadius: 3, maxSparksPerFrame: 26 },
    },
  },

  'Attractor Fire Cloud': {
    metadata: { name: 'Attractor Fire Cloud', version: 2, designResolution: { width: 960, height: 720 }, tags: ['fire', 'attractor', 'phase6'] },
    generators: {
      type: 'lissajous', particleCount: 3000, waveSpeed: 0.05,
      rotation: [0.12, 0.06, 0.02],
      waves: [
        { speed: 0.8, axes: [
          { phase: 0, am: { base: 250, amplitude: 80, frequency: 2.5 }, fm: { base: 4, amplitude: 3.0, frequency: 0.8 } },
          { phase: 18, am: { base: 200, amplitude: 60, frequency: 3.0 }, fm: { base: 3, amplitude: 2.0, frequency: 1.0 } },
          { phase: 36, am: { base: 100, amplitude: 30, frequency: 2.0 }, fm: { base: 2, amplitude: 1.5, frequency: 1.2 } },
        ] },
        { speed: 1.1, axes: [
          { phase: 27, am: { base: 180, amplitude: 50, frequency: 4.0 }, fm: { base: 6, amplitude: 2.0, frequency: 0.7 } },
          { phase: 54, am: { base: 150, amplitude: 40, frequency: 3.0 }, fm: { base: 4, amplitude: 1.5, frequency: 0.9 } },
          { phase: 9, am: { base: 70, amplitude: 20, frequency: 3.5 }, fm: { base: 2, amplitude: 1.0, frequency: 1.5 } },
        ] },
        { speed: 0.6, axes: [
          { phase: 45, am: { base: 120, amplitude: 30, frequency: 2.0 }, fm: { base: 5, amplitude: 1.5, frequency: 0.6 } },
          { phase: 14, am: { base: 180, amplitude: 70, frequency: 2.5 }, fm: { base: 3, amplitude: 2.5, frequency: 1.0 } },
          { phase: 21, am: { base: 60, amplitude: 15, frequency: 3.0 }, fm: { base: 2, amplitude: 0.8, frequency: 1.2 } },
        ] },
      ],
      colorBase: [180, 60, 10], colorAmp: [75, 100, 50], colorFreq: [0.08, 0.12, 0.18], colorShift: [0.1, 0.4, 0.7],
    },
    renderer: { mode: 'splat', glow: 5.0, decayFactor: 0.88, blurRadius: 3, depthSize: 0.4, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.3, intensity: 0.8, radius: 5 },
      toneMap: { curve: 'aces', exposure: 1.6, lift: [0,0,0], gamma: [1,1,1], gain: [1.1,1,0.9] },
    },
    // Re-tuned in the browser 2026-08-10 from an exported working preset. The wave, colour, renderer and
    // `material` blocks are unchanged (`material` moved from `blendMode: 'alpha'` back to `'additive'`
    // between two exports, i.e. the authored value was re-confirmed, not changed).
    //
    // The attractor is the substance of this edit: Clifford Fern (index 2) → **Rössler Spiral** (index 7)
    // at a blend of 0.7 rather than 0.4. Clifford is a 2D discrete map — a static filigree sheet — whereas
    // Rössler is a continuous 3D ODE iterated with small dt, so particles trace a spiralling band with
    // real Z extent. That is what makes this a "fire cloud" rather than a fire pattern, and the higher
    // blend hands more authority to the attractor and less to the Lissajous figure. `speedFactor` back to
    // 1.0 goes with it: 0.8 was slowing the whole animation to keep the discrete map legible.
    //
    // ⚠️ Buoyancy and sparks are DELIBERATELY at their defaults, not un-tuned leftovers. Measured against
    // `DEFAULT_BUOYANCY_CONFIG`/`DEFAULT_SPARK_CONFIG`, 15 of the 17 values are byte-equal to the default
    // and only two are hand-set (`smokeThreshold` 0.18, `poolSize` 400) — which is the signature of the
    // material dropdown having re-applied the bundle: selecting `Ember` (on `FIRE_BEHAVIOUR_MATERIALS`)
    // resets both blocks to `{...DEFAULT_*, enabled: true}`, and only those two were touched afterwards.
    // They are written out in full anyway, because a preset must fully determine its own look — relying on
    // the defaults would silently re-tune this preset if a default ever changed.
    overlay: {
      renderMode: 'splat',
      // ⚠️ Was 'Dramatic' (glow 3.4, vignette, Prismatic palette, velocity-mapped). 'Legacy' is no
      // post-processing at all, so the Ember material's own ramp and `emissionIntensity` now read as
      // authored instead of through a grade — and the Prismatic palette no longer overrides the fire ramp.
      filmLook: 'Legacy',
      attractorIndex: 7,
      attractorBlend: 0.7,
      // ⚠️ Newly ADDED 2026-08-13 (previously absent ⇒ the `?? 1.0` default at `main.ts:228`). The V7 rework
      // normalises every attractor to `ATTRACTOR_DESIGN_FRACTION` (0.45) of the design box, which is the
      // MEDIAN wave half-extent over the library — so a blend-1.0 attractor is median-sized by construction.
      // At `attractorBlend: 0.7` most of this preset's position comes from Rössler rather than from its own
      // waves, whose authored half-extent (am.base up to 250 in a 960×720 box) is well above that median, so
      // the neutral scale reads small here. 2.5× by browser observation; it is a per-preset framing choice,
      // NOT a correction to the rework.
      //
      // ⚠️ RE-FRAMED 2.5 → 1.4 on 2026-09-20, and this is NOT a retune of the preset. The ODE seeding and
      // centring fix in `attractors.ts` (written up in `demo-presets.ts` under `Lorenz Twin Lobes`) reaches
      // exactly three presets in the library and this is one of them: particles now start ON the Rössler
      // band instead of drifting onto it, and the band's measured z centre (+0.50 of the half-extent) is
      // subtracted, so the same 2.5 that framed the old undersized figure now throws 41 % of the particles
      // off screen. 1.4 restores the appearance that was authored — 81×90 % of the frame at 2.0 % clipped,
      // against the 84×90 % at 9.7 % this preset actually shipped. **The appearance is the authored intent;
      // the number was only ever its proxy.**
      figureScale: 1.4,
      speedFactor: 1.0,
      material: { preset: 'Ember', splatRadius: 6, coreBrightness: 1.8, haloStrength: 0.6, falloffExponent: 5.0, thermalLag: 0.047, emissionIntensity: 2.0, heatMode: 'velocity', heatGain: 0.8, blendMode: 'additive', colourRamp: 'fire', velocityStretch: 0.2 },
      buoyancy: { enabled: true, strength: 1.5, returnForce: 2.0, turbulence: 0.3, maxOffset: 200, curlOctaves: true, smokeThreshold: 0.18, smokeOpacity: 0.4, smokeDissipation: 0.95 },
      sparks: { enabled: true, poolSize: 400, threshold: 0.6, ejectionSpeed: 0.1, gravity: 200, drag: 1.5, minLifetime: 0.3, maxLifetime: 1.0, coolingRate: 2.0, splatRadius: 3, maxSparksPerFrame: 5 },
    },
  },

  'Julia Burn Rivers': {
    metadata: { name: 'Julia Burn Rivers', version: 2, designResolution: { width: 960, height: 720 }, tags: ['fire', 'fractal', 'phase6'] },
    generators: {
      type: 'lissajous', particleCount: 2500, waveSpeed: 0.06,
      rotation: [0.1, 0.05, 0],
      waves: [
        { speed: 0.9, axes: [
          { phase: 0, am: { base: 300, amplitude: 100, frequency: 2.0 }, fm: { base: 3, amplitude: 2.0, frequency: 0.6 } },
          { phase: 36, am: { base: 250, amplitude: 80, frequency: 2.5 }, fm: { base: 4, amplitude: 1.5, frequency: 0.8 } },
          { phase: 18, am: { base: 120, amplitude: 40, frequency: 3.0 }, fm: { base: 2, amplitude: 1.0, frequency: 1.0 } },
        ] },
        { speed: 1.2, axes: [
          { phase: 18, am: { base: 220, amplitude: 60, frequency: 3.5 }, fm: { base: 5, amplitude: 3.0, frequency: 1.0 } },
          { phase: 0, am: { base: 180, amplitude: 50, frequency: 2.0 }, fm: { base: 3, amplitude: 2.0, frequency: 0.7 } },
          { phase: 54, am: { base: 80, amplitude: 25, frequency: 4.0 }, fm: { base: 2, amplitude: 1.2, frequency: 1.2 } },
        ] },
        { speed: 0.5, axes: [
          { phase: 50, am: { base: 150, amplitude: 50, frequency: 2.5 }, fm: { base: 4, amplitude: 1.5, frequency: 0.5 } },
          { phase: 27, am: { base: 200, amplitude: 70, frequency: 1.5 }, fm: { base: 3, amplitude: 1.0, frequency: 0.8 } },
          { phase: 9, am: { base: 90, amplitude: 20, frequency: 3.0 }, fm: { base: 2, amplitude: 0.8, frequency: 1.0 } },
        ] },
      ],
      colorBase: [220, 100, 30], colorAmp: [35, 60, 50], colorFreq: [0.06, 0.1, 0.15], colorShift: [0, 0.2, 0.5],
    },
    renderer: { mode: 'splat', glow: 3.0, decayFactor: 0.84, blurRadius: 2, depthSize: 0.5, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.5, intensity: 0.4, radius: 5 },
      toneMap: { curve: 'reinhard', exposure: 1.0, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    fractal: { type: 'julia', params: [-0.7, 0.27015, 2.0, 0], blend: 0.6, bounds: [-2, -2, 2, 2] },
    // Re-tuned in the browser 2026-08-10 from an exported working preset. The wave, colour, renderer,
    // fractal and postProcessor blocks are unchanged; every change is in `overlay`.
    //
    // Four substantive edits:
    //
    // 1. **The material is now nearly invisible on its own** — `coreBrightness` 1.5 → 0.5 and
    //    `haloStrength` 1.0 → 0.1. Combined with `bloomThreshold: 0.1` below, the visible image is
    //    almost entirely BLOOM rather than direct splat output: dim cores are lifted by the bloom pass
    //    instead of being drawn bright. ⚠️ Raising either value back without also raising the bloom
    //    threshold would double-count and blow the figure out.
    // 2. **Buoyancy is OFF** (the block is absent from the export, and `getSnapshot()` emits it only
    //    when `enabled`). Plasma is on `FIRE_BEHAVIOUR_MATERIALS`, so selecting it auto-enables
    //    buoyancy — this preset deliberately turns it back off, so the Julia escape-flow field is the
    //    only thing moving particles. Written out explicitly as `enabled: false` rather than omitted,
    //    so a future default change cannot silently switch it on.
    // 3. **Sparks are ON** (were `enabled: false`) as slow drifting embers: `gravity` 200 → 290, so they
    //    fall rather than fountain, with `poolSize` 500 → 350. ⚠️ **`ejectionSpeed` is 0.1 and no longer
    //    carries that intent** — it was 1.2 → 0.7 here, re-based to the track floor 2026-09-17 when the
    //    stale-delta fix multiplied the base speed by ~24× (`lissajous.ts`' `frameMotion`). This preset
    //    runs neither buoyancy nor cohesion, so it is one of the three whose embers were EXACTLY still
    //    before that fix: 0.7 was never a drift rate, it was a multiplier on zero. **The floor now binds
    //    it at ~2× the arc the gravity asks for; the slider cannot express the value this preset wants.**
    // 4. **`figureScale`** was `0.798` — the figure scaled to ~80% to fit the Julia flow field inside the
    //    frame. ⚠️ **Superseded: it is now `1.0`** (2026-08-13), because that 20 % reduction was compensating
    //    for the pre-V7 attractor over-scaling, which was 10.97× for julia on a legacy design box. Read at
    //    `main.ts:228` via `generator.setViewScale()`, defaulting to 1.0 when absent.
    //
    // ⚠️ `filmLook` is **Customize**, seeded from `Neon` — so `customFilmLookParams` MUST be carried,
    // or the preset falls back to whatever the live session had. Only three fields differ from the
    // `Neon` bundle: `glow` 5.4 → 2.5 (much tighter particles), `bloomThreshold` 0.3 → 0.1 (see 1
    // above) and `bloomIntensity` 0.55 → 0.2. Everything else is `Neon` verbatim, including
    // `palette: 'Neon'` with `paletteMapping: 'phase'`.
    overlay: {
      renderMode: 'splat',
      filmLook: 'Customize',
      customFilmLookParams: {
        glow: 2.5, depthSize: 0.2, depthBrightness: 0, depthDof: 0, depthColorShift: 0,
        lightingMode: 2, lightDir: [0, 0, 1], rimPower: 2.5,
        bloomEnabled: true, bloomThreshold: 0.1, bloomIntensity: 0.2,
        toneMapEnabled: true, toneMapCurve: 'aces', exposure: 1.5,
        lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1.1, 1.1, 1.1],
        saturation: 1.4, vignette: 0.2, palette: 'Neon', paletteMapping: 'phase',
      },
      // ⚠️ Was `0.7982596905316156`, hand-tuned in the browser on 2026-08-10 to fit the Julia flow field in
      // frame — i.e. tuned AGAINST the pre-V7 attractor scaling, which was 10.97× oversize for julia. The V7
      // rework normalises every attractor to `ATTRACTOR_DESIGN_FRACTION` of the design box, so the ~20 %
      // reduction is now compensating for an error that no longer exists. Reset to the neutral 1.0 by
      // browser observation 2026-08-13. Written explicitly rather than omitted so the preset fully
      // determines its own look.
      figureScale: 1.0,
      speedFactor: 0.9,
      material: { preset: 'Plasma', splatRadius: 12, coreBrightness: 0.5, haloStrength: 0.1, falloffExponent: 2.5, thermalLag: 0.062, emissionIntensity: 2.0, heatMode: 'velocity', heatGain: 0.8, blendMode: 'additive', colourRamp: 'liquid', velocityStretch: 0.3 },
      buoyancy: { enabled: false, strength: 1.2, returnForce: 2.5, turbulence: 0.2, maxOffset: 150, curlOctaves: true, smokeThreshold: 0.25, smokeOpacity: 0.4, smokeDissipation: 0.95 },
      sparks: { enabled: true, poolSize: 350, threshold: 0.6, ejectionSpeed: 0.1, gravity: 290, drag: 1.5, minLifetime: 0.3, maxLifetime: 1.0, coolingRate: 2.0, splatRadius: 3, maxSparksPerFrame: 5 },
    },
  },

  'Hopf Fire Ring': {
    metadata: { name: 'Hopf Fire Ring', version: 2, designResolution: { width: 960, height: 720 }, tags: ['fire', 'ring', 'phase6'] },
    generators: {
      type: 'lissajous', particleCount: 1800, waveSpeed: 0.07,
      rotation: [0.18, 0.12, 0.05],
      waves: [
        { speed: 1.0, axes: [
          { phase: 0, am: { base: 220, amplitude: 60, frequency: 2.0 }, fm: { base: 5, amplitude: 3.0, frequency: 0.5 } },
          { phase: 28, am: { base: 180, amplitude: 50, frequency: 2.5 }, fm: { base: 4, amplitude: 2.0, frequency: 0.7 } },
          { phase: 0, am: { base: 80, amplitude: 30, frequency: 3.0 }, fm: { base: 2, amplitude: 1.5, frequency: 1.5 } },
        ] },
        { speed: 2.0, axes: [
          { phase: 0, am: { base: 120, amplitude: 50, frequency: 4.0 }, fm: { base: 7, amplitude: 2.0, frequency: 1.0 } },
          { phase: 28, am: { base: 100, amplitude: 40, frequency: 3.0 }, fm: { base: 5, amplitude: 2.5, frequency: 1.2 } },
          { phase: 18, am: { base: 50, amplitude: 20, frequency: 5.0 }, fm: { base: 3, amplitude: 1.5, frequency: 2.0 } },
        ] },
        { speed: 0.5, axes: [
          { phase: 56, am: { base: 80, amplitude: 30, frequency: 2.5 }, fm: { base: 3, amplitude: 1.0, frequency: 0.8 } },
          { phase: 0, am: { base: 90, amplitude: 35, frequency: 3.0 }, fm: { base: 4, amplitude: 1.5, frequency: 0.6 } },
          { phase: 28, am: { base: 100, amplitude: 40, frequency: 2.0 }, fm: { base: 2, amplitude: 2.0, frequency: 0.6 } },
        ] },
      ],
      colorBase: [240, 120, 40], colorAmp: [15, 60, 80], colorFreq: [0.05, 0.08, 0.12], colorShift: [0, 0.1, 0.3],
    },
    renderer: { mode: 'splat', glow: 2.0, decayFactor: 0.78, blurRadius: 2, depthSize: 0.2, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 4, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 }, ifsParams: [{ angle: 25, scale: 0.82, tx: 0, ty: 0, weight: 1.0 }] },
      bloom: { enabled: true, threshold: 0.6, intensity: 0.3, radius: 5 },
      toneMap: { curve: 'aces', exposure: 0.9, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    // Re-tuned in the browser 2026-08-10 from an exported working preset. The wave, colour, renderer and
    // postProcessor blocks are unchanged, as is the whole style-4 IFS setup (enabled, style, transform).
    // The spark block is byte-identical to what was authored. Three substantive edits, all in `overlay`:
    //
    // 1. **The particles are much smaller and dimmer** — `splatRadius` 10 → 3 and `coreBrightness`
    //    2.0 → 0.5. This is a fine-grained ring of embers rather than a few fat blobs.
    // 2. **`filmLook` Ethereal → Overexposed**, which is what pays for (1): exposure 2.5 (the highest
    //    of the 14 bundles) and `bloomThreshold` 0.2 lift those small dim splats back into view. The
    //    two edits are one change — reverting either alone gives either an invisible figure or a blown
    //    out one. Note `Overexposed` uses the `reinhard` curve, which compresses hard at low input, so
    //    its effective brightness is well below what exposure 2.5 suggests.
    // 3. **Buoyancy is OFF** (absent from the export; `getSnapshot()` emits the block only when
    //    `enabled`). Fire is on `FIRE_BEHAVIOUR_MATERIALS` so selecting it auto-enables buoyancy — this
    //    preset turns it back off so the ring holds its shape instead of drifting upward, leaving the
    //    IFS feedback and the sparks as the only motion beyond the waves. Written out explicitly as
    //    `enabled: false` rather than omitted, so a future default change cannot silently re-enable it.
    overlay: {
      renderMode: 'splat',
      filmLook: 'Overexposed',
      transMapEnabled: true,
      transMapStyle: 4,
      ifsParams: [{ angle: 25, scale: 0.82, tx: 0, ty: 0, weight: 1.0 }],
      speedFactor: 1.2,
      material: { preset: 'Fire', splatRadius: 3, coreBrightness: 0.5, haloStrength: 1.0, falloffExponent: 3.5, thermalLag: 0.04, emissionIntensity: 2.0, heatMode: 'velocity', heatGain: 1.0, blendMode: 'additive', colourRamp: 'fire', velocityStretch: 0.4 },
      buoyancy: { enabled: false, strength: 1.0, returnForce: 3.0, turbulence: 0.15, maxOffset: 100, curlOctaves: true, smokeThreshold: 0.25, smokeOpacity: 0.4, smokeDissipation: 0.95 },
      sparks: { enabled: true, poolSize: 300, threshold: 0.7, ejectionSpeed: 0.1, gravity: 150, drag: 2.0, minLifetime: 0.2, maxLifetime: 0.6, coolingRate: 4.0, splatRadius: 2, maxSparksPerFrame: 4 },
    },
  },

  'Ember Storm': {
    metadata: { name: 'Ember Storm', version: 2, designResolution: { width: 960, height: 720 }, tags: ['fire', 'storm', 'phase6'] },
    generators: {
      type: 'lissajous', particleCount: 4000, waveSpeed: 0.1,
      rotation: [0.2, 0.15, 0.08],
      waves: [
        { speed: 1.5, axes: [
          { phase: 0, am: { base: 300, amplitude: 120, frequency: 3.5 }, fm: { base: 4, amplitude: 4.0, frequency: 1.2 } },
          { phase: 18, am: { base: 280, amplitude: 100, frequency: 3.0 }, fm: { base: 5, amplitude: 3.0, frequency: 1.0 } },
          { phase: 36, am: { base: 150, amplitude: 50, frequency: 2.5 }, fm: { base: 3, amplitude: 2.0, frequency: 0.8 } },
        ] },
        { speed: 2.0, axes: [
          { phase: 45, am: { base: 200, amplitude: 80, frequency: 4.0 }, fm: { base: 7, amplitude: 3.0, frequency: 1.5 } },
          { phase: 9, am: { base: 220, amplitude: 90, frequency: 3.5 }, fm: { base: 5, amplitude: 2.5, frequency: 1.2 } },
          { phase: 27, am: { base: 100, amplitude: 40, frequency: 3.0 }, fm: { base: 3, amplitude: 1.5, frequency: 1.0 } },
        ] },
        { speed: 0.8, axes: [
          { phase: 22, am: { base: 150, amplitude: 60, frequency: 2.5 }, fm: { base: 3, amplitude: 2.0, frequency: 0.6 } },
          { phase: 63, am: { base: 180, amplitude: 70, frequency: 2.0 }, fm: { base: 4, amplitude: 1.5, frequency: 0.5 } },
          { phase: 14, am: { base: 80, amplitude: 30, frequency: 3.5 }, fm: { base: 2, amplitude: 1.0, frequency: 1.2 } },
        ] },
      ],
      colorBase: [160, 50, 10], colorAmp: [95, 100, 60], colorFreq: [0.12, 0.18, 0.25], colorShift: [0.2, 0.5, 0.8],
    },
    renderer: { mode: 'splat', glow: 6.0, decayFactor: 0.85, blurRadius: 4, depthSize: 0.6, streaks: 0 },
    postProcessors: {
      transMap: { enabled: false, style: 0, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.25, intensity: 0.9, radius: 5 },
      toneMap: { curve: 'aces', exposure: 1.8, lift: [0,0,0], gamma: [1,0.95,0.9], gain: [1.2,1,0.8] },
    },
    // Re-tuned in the browser 2026-08-12, completing the set — this was the one preset left untouched by
    // the 2026-08-10 pass. Waves, colour, renderer and postProcessors are unchanged; buoyancy, sparks and
    // curl noise are byte-identical. Two substantive edits, and they work in opposite directions:
    //
    // 1. **`speedFactor` 1.5 → 0.75, a HALVING.** At 1.5 the storm churned faster than any individual
    //    ember could be followed, so 4 000 particles read as one flickering mass. This is the largest
    //    single change and the one the others are in service of.
    // 2. **`heatGain` 0.8 → 1.0**, which is what pays for (1). Slowing the figure lowers the velocity
    //    driver, and since steady-state temperature is exactly `driver * heatGain` (the `heatScale`
    //    fix), halving the speed would otherwise have made the whole population colder and pushed it
    //    down the fire ramp into dull red. 1.0 restores the peak, so the embers stay hot while moving
    //    slowly enough to be seen individually.
    overlay: {
      renderMode: 'splat',
      filmLook: 'Plasma',
      curlNoise: { enabled: true, turbulence: 0.6, scale: 2.0, evolutionSpeed: 1.2 },
      speedFactor: 0.75,
      material: { preset: 'Ember', splatRadius: 6, coreBrightness: 1.8, haloStrength: 0.6, falloffExponent: 5.0, thermalLag: 0.047, emissionIntensity: 2.0, heatMode: 'velocity', heatGain: 1.0, blendMode: 'additive', colourRamp: 'fire', velocityStretch: 0.2 },
      buoyancy: { enabled: true, strength: 3.0, returnForce: 0.8, turbulence: 0.7, maxOffset: 300, curlOctaves: true, smokeThreshold: 0.25, smokeOpacity: 0.4, smokeDissipation: 0.95 },
      sparks: { enabled: true, poolSize: 500, threshold: 0.3, ejectionSpeed: 0.4, gravity: 300, drag: 0.8, minLifetime: 0.4, maxLifetime: 1.5, coolingRate: 1.5, splatRadius: 4, maxSparksPerFrame: 15 },
    },
  },
};
