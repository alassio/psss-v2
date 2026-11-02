import type { UnifiedPreset } from './types.ts';

export const FLOW_PRESETS: Record<string, UnifiedPreset> = {
  'Rising Inferno': {
    metadata: { name: 'Rising Inferno', version: 2, designResolution: { width: 960, height: 720 }, tags: ['fire', 'flow', 'phase6c'] },
    generators: {
      type: 'lissajous', particleCount: 3000, waveSpeed: 0.08,
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
      colorBase: [220, 90, 20], colorAmp: [35, 80, 50], colorFreq: [0.1, 0.15, 0.2], colorShift: [0, 0.3, 0.6],
    },
    renderer: { mode: 'splat', glow: 3.0, decayFactor: 0.86, blurRadius: 2, depthSize: 0.3, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.5, intensity: 0.4, radius: 5 },
      toneMap: { curve: 'aces', exposure: 1.2, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    // Re-tuned in the browser 2026-08-12. Waves, colour, renderer, postProcessors, the style-5 flow
    // archetype and buoyancy are all unchanged. Three substantive edits:
    //
    // 1. **`splatRadius` 10 → 7** and **`speedFactor` 1.0 → 0.6.** Both make the rise legible: smaller
    //    particles keep the flow's filaments distinct instead of merging into a sheet, and the slower
    //    clock lets the `Fire Rise` field's upward drift be seen as motion rather than as churn.
    // 2. **Sparks OFF** — absent from the export, and `getSnapshot()` emits the block only when
    //    `enabled`, so this is a real authored state rather than a lost block. Fire is on
    //    `FIRE_BEHAVIOUR_MATERIALS`, so selecting it auto-enabled sparks; ejected embers fly on their
    //    own Newtonian arcs and cut across the coherent upward field that is this preset's whole
    //    subject. Written out as an explicit `enabled: false` rather than omitted, so a future change
    //    to `DEFAULT_SPARK_CONFIG` cannot silently re-enable it.
    overlay: {
      renderMode: 'splat',
      filmLook: 'Luminous',
      transMapEnabled: true,
      transMapStyle: 5,
      transMapForceBlend: 0.6,
      transMapForceReturn: 1.5,
      proceduralFlow: { strength: 0.4, scale: 1.2, curlAmount: 0.3, direction: [0, -1], radial: 0, evolutionSpeed: 1.2, archetype: 'Fire Rise' },
      speedFactor: 0.6,
      material: { preset: 'Fire', splatRadius: 7, coreBrightness: 2.0, haloStrength: 1.0, falloffExponent: 3.5, thermalLag: 0.04, emissionIntensity: 2.0, heatMode: 'velocity', heatGain: 1.0, blendMode: 'additive', colourRamp: 'fire', velocityStretch: 0.3 },
      buoyancy: { enabled: true, strength: 2.5, returnForce: 1.5, turbulence: 0.4, maxOffset: 200, curlOctaves: true, smokeThreshold: 0.25, smokeOpacity: 0.4, smokeDissipation: 0.95 },
      sparks: { enabled: false, poolSize: 500, threshold: 0.5, ejectionSpeed: 1.5, gravity: 250, drag: 1.2, minLifetime: 0.2, maxLifetime: 0.8, coolingRate: 3.0, splatRadius: 3, maxSparksPerFrame: 8 },
    },
  },

  'Smoke Cathedral': {
    metadata: { name: 'Smoke Cathedral', version: 2, designResolution: { width: 960, height: 720 }, tags: ['smoke', 'flow', 'phase6c'] },
    generators: {
      type: 'lissajous', particleCount: 2500, waveSpeed: 0.04,
      rotation: [0.08, 0.04, 0.01],
      waves: [
        { speed: 0.6, axes: [
          { phase: 0, am: { base: 250, amplitude: 80, frequency: 2.5 }, fm: { base: 4, amplitude: 3.0, frequency: 0.8 } },
          { phase: 18, am: { base: 200, amplitude: 60, frequency: 3.0 }, fm: { base: 3, amplitude: 2.0, frequency: 1.0 } },
          { phase: 36, am: { base: 100, amplitude: 30, frequency: 2.0 }, fm: { base: 2, amplitude: 1.5, frequency: 1.2 } },
        ] },
        { speed: 0.8, axes: [
          { phase: 27, am: { base: 180, amplitude: 50, frequency: 4.0 }, fm: { base: 6, amplitude: 2.0, frequency: 0.7 } },
          { phase: 54, am: { base: 150, amplitude: 40, frequency: 3.0 }, fm: { base: 4, amplitude: 1.5, frequency: 0.9 } },
          { phase: 9, am: { base: 70, amplitude: 20, frequency: 3.5 }, fm: { base: 2, amplitude: 1.0, frequency: 1.5 } },
        ] },
        { speed: 0.4, axes: [
          { phase: 45, am: { base: 120, amplitude: 30, frequency: 2.0 }, fm: { base: 5, amplitude: 1.5, frequency: 0.6 } },
          { phase: 14, am: { base: 180, amplitude: 70, frequency: 2.5 }, fm: { base: 3, amplitude: 2.5, frequency: 1.0 } },
          { phase: 21, am: { base: 60, amplitude: 15, frequency: 3.0 }, fm: { base: 2, amplitude: 0.8, frequency: 1.2 } },
        ] },
      ],
      colorBase: [120, 110, 100], colorAmp: [40, 40, 50], colorFreq: [0.05, 0.06, 0.08], colorShift: [0, 0.1, 0.2],
    },
    renderer: { mode: 'splat', glow: 1.5, decayFactor: 0.92, blurRadius: 4, depthSize: 0.4, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.7, intensity: 0.2, radius: 6 },
      toneMap: { curve: 'reinhard', exposure: 0.9, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1] },
    },
    overlay: {
      renderMode: 'splat',
      filmLook: 'Cinematic',
      transMapEnabled: true,
      transMapStyle: 5,
      transMapForceBlend: 0.3,
      transMapForceReturn: 1.0,
      proceduralFlow: { strength: 0.25, scale: 2.0, curlAmount: 0.6, direction: [0.3, -0.95], radial: 0, evolutionSpeed: 0.5, archetype: 'Smoke Drift' },
      speedFactor: 0.7,
      material: { preset: 'Smoke', splatRadius: 14, coreBrightness: 1.2, haloStrength: 0.8, falloffExponent: 2.0, thermalLag: 0.19, emissionIntensity: 1.5, heatMode: 'age', heatGain: 0.6, blendMode: 'alpha', colourRamp: 'smoke', velocityStretch: 0 },
      buoyancy: { enabled: true, strength: 1.5, returnForce: 0.8, turbulence: 0.6, maxOffset: 300, curlOctaves: true, smokeThreshold: 0.4, smokeOpacity: 0.7, smokeDissipation: 0.98 },
      sparks: { enabled: false, poolSize: 200, threshold: 0.8, ejectionSpeed: 0.5, gravity: 100, drag: 2.0, minLifetime: 0.5, maxLifetime: 2.0, coolingRate: 1.0, splatRadius: 2, maxSparksPerFrame: 3 },
    },
  },

  'Firestorm': {
    metadata: { name: 'Firestorm', version: 2, designResolution: { width: 960, height: 720 }, tags: ['fire', 'chaos', 'flow', 'phase6c'] },
    generators: {
      type: 'lissajous', particleCount: 4000, waveSpeed: 0.12,
      rotation: [0.22, 0.18, 0.1],
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
        { speed: 1.2, axes: [
          { phase: 22, am: { base: 150, amplitude: 60, frequency: 2.5 }, fm: { base: 3, amplitude: 2.0, frequency: 0.6 } },
          { phase: 63, am: { base: 180, amplitude: 70, frequency: 2.0 }, fm: { base: 4, amplitude: 1.5, frequency: 0.5 } },
          { phase: 14, am: { base: 80, amplitude: 30, frequency: 3.5 }, fm: { base: 2, amplitude: 1.0, frequency: 1.2 } },
        ] },
      ],
      colorBase: [180, 60, 10], colorAmp: [75, 100, 60], colorFreq: [0.14, 0.2, 0.28], colorShift: [0.2, 0.5, 0.8],
    },
    renderer: { mode: 'splat', glow: 5.0, decayFactor: 0.82, blurRadius: 3, depthSize: 0.5, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.3, intensity: 0.8, radius: 5 },
      toneMap: { curve: 'aces', exposure: 1.6, lift: [0,0,0], gamma: [1,0.95,0.9], gain: [1.2,1,0.8] },
    },
    // Re-tuned in the browser 2026-08-12 — the most heavily edited of the four, and every edit removes
    // motion or noise. Waves, colour, renderer, postProcessors, buoyancy and sparks are unchanged.
    // At its authored settings this preset stacked FOUR independent turbulence sources on top of a
    // `speedFactor` of 1.4, and the result was undifferentiated flicker. The tuning strips three of them
    // back and lets the flow field carry the chaos on its own:
    //
    // 1. **`curlNoise` disabled** (was turbulence 0.5 / scale 1.8). Curl noise and the style-5 flow
    //    field both displace particles from simplex-curl noise, so this was the same effect applied
    //    twice at different scales — the redundant one is the cheaper CPU-side copy.
    // 2. **`speedFactor` 1.4 → 0.5**, the single largest change.
    // 3. **The flow field is calmed and its archetype becomes `'Custom'`** — `strength` 0.7 → 0.47,
    //    `scale` 1.0 → 0.4, `curlAmount` 0.8 → 0.64. ⚠️ `'Custom'` is a real UI sentinel, not a lost
    //    name: `visual-fx.ts` returns it when the live config matches no archetype, and nothing looks
    //    it up at render time (`trans-map.ts` passes the config through verbatim), so it correctly
    //    records "hand-tuned away from Chaos". Do not "repair" it back to `'Chaos'` — that would
    //    restore the authored numbers and undo the edit.
    // 4. **`transMapForceBlend` 0.7 → 0.35** halves how hard the field pushes particles, while the new
    //    **`transMapWarpMix: 0.55`** cuts the image-space pixel warp that the force field is separate
    //    from. The two are independent controls over the same displacement texture, and both were at
    //    full strength.
    // 5. **The material softens** — `coreBrightness` 2.2 → 1.2, `haloStrength` 0.8 → 0.3,
    //    `velocityStretch` 0.4 → 0.14. With the motion slowed, long tapered flame kernels no longer
    //    match how far a particle actually travels per frame, so the embers become nearly circular.
    overlay: {
      renderMode: 'splat',
      filmLook: 'Plasma',
      transMapEnabled: true,
      transMapStyle: 5,
      transMapWarpMix: 0.55,
      transMapForceBlend: 0.35,
      transMapForceReturn: 2.0,
      proceduralFlow: { strength: 0.47, scale: 0.4, curlAmount: 0.64, direction: [0, 0], radial: 0, evolutionSpeed: 2.0, archetype: 'Custom' },
      curlNoise: { enabled: false, turbulence: 0.5, scale: 1.8, evolutionSpeed: 1.5 },
      speedFactor: 0.5,
      material: { preset: 'Ember', splatRadius: 7, coreBrightness: 1.2, haloStrength: 0.3, falloffExponent: 4.0, thermalLag: 0.024, emissionIntensity: 2.5, heatMode: 'velocity', heatGain: 1.5, blendMode: 'additive', colourRamp: 'fire', velocityStretch: 0.14 },
      buoyancy: { enabled: true, strength: 3.5, returnForce: 0.6, turbulence: 0.8, maxOffset: 350, curlOctaves: true, smokeThreshold: 0.2, smokeOpacity: 0.3, smokeDissipation: 0.93 },
      sparks: { enabled: true, poolSize: 800, threshold: 0.3, ejectionSpeed: 0.4, gravity: 350, drag: 0.8, minLifetime: 0.3, maxLifetime: 1.2, coolingRate: 2.0, splatRadius: 4, maxSparksPerFrame: 15 },
    },
  },

  'Lava Flow': {
    metadata: { name: 'Lava Flow', version: 2, designResolution: { width: 960, height: 720 }, tags: ['lava', 'flow', 'phase6c'] },
    generators: {
      type: 'lissajous', particleCount: 2500, waveSpeed: 0.05,
      rotation: [0.06, 0.03, 0],
      waves: [
        { speed: 0.7, axes: [
          { phase: 0, am: { base: 300, amplitude: 100, frequency: 2.0 }, fm: { base: 3, amplitude: 2.0, frequency: 0.6 } },
          { phase: 36, am: { base: 250, amplitude: 80, frequency: 2.5 }, fm: { base: 4, amplitude: 1.5, frequency: 0.8 } },
          { phase: 18, am: { base: 120, amplitude: 40, frequency: 3.0 }, fm: { base: 2, amplitude: 1.0, frequency: 1.0 } },
        ] },
        { speed: 0.9, axes: [
          { phase: 18, am: { base: 220, amplitude: 60, frequency: 3.5 }, fm: { base: 5, amplitude: 3.0, frequency: 1.0 } },
          { phase: 0, am: { base: 180, amplitude: 50, frequency: 2.0 }, fm: { base: 3, amplitude: 2.0, frequency: 0.7 } },
          { phase: 54, am: { base: 80, amplitude: 25, frequency: 4.0 }, fm: { base: 2, amplitude: 1.2, frequency: 1.2 } },
        ] },
        { speed: 0.4, axes: [
          { phase: 50, am: { base: 150, amplitude: 50, frequency: 2.5 }, fm: { base: 4, amplitude: 1.5, frequency: 0.5 } },
          { phase: 27, am: { base: 200, amplitude: 70, frequency: 1.5 }, fm: { base: 3, amplitude: 1.0, frequency: 0.8 } },
          { phase: 9, am: { base: 90, amplitude: 20, frequency: 3.0 }, fm: { base: 2, amplitude: 0.8, frequency: 1.0 } },
        ] },
      ],
      colorBase: [240, 80, 10], colorAmp: [15, 80, 60], colorFreq: [0.04, 0.08, 0.12], colorShift: [0, 0.15, 0.4],
    },
    renderer: { mode: 'splat', glow: 2.5, decayFactor: 0.9, blurRadius: 3, depthSize: 0.3, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.5, intensity: 0.35, radius: 5 },
      toneMap: { curve: 'aces', exposure: 1.1, lift: [0,0,0], gamma: [1,1,1], gain: [1.1,1,0.9] },
    },
    // Re-tuned in the browser 2026-08-12. Waves, colour, renderer, postProcessors, the `Ocean Current`
    // flow archetype, buoyancy and sparks are unchanged. Three substantive edits, all one idea — lava is
    // a DENSE, SLOW fluid, and at the authored settings it read as a sparse cloud of glowing blobs:
    //
    // 1. **`splatRadius` 12 → 4.5**, a 2.7x reduction. Small particles at 2 500 count give a
    //    fine-grained stream whose internal structure is visible; at 12 the splats overlapped into a few
    //    fat masses.
    // 2. **`haloStrength` 1.2 → 0.** The halo is the soft outer glow, and it is what turned each splat
    //    into a blob with no edge. Zero leaves only the core, so the flow has a defined surface —
    //    which is what makes it read as molten rock rather than as fire.
    // 3. **`speedFactor` 0.8 → 0.4**, halved. Viscosity is conveyed by nothing except how slowly the
    //    figure moves.
    //
    // Note (1) and (2) are compensated for free: `emissionIntensity`'s damping term is
    // `pow(refOverlap / (count * splatRadius^2 * 1e-4), 0.25)`, so cutting the radius RAISES delivered
    // brightness (clamped at 1.5x), which is why the authored 2.2 still reads correctly against a much
    // smaller sprite.
    overlay: {
      renderMode: 'splat',
      filmLook: 'Dramatic',
      transMapEnabled: true,
      transMapStyle: 5,
      transMapForceBlend: 0.4,
      transMapForceReturn: 1.2,
      proceduralFlow: { strength: 0.3, scale: 3.0, curlAmount: 0.7, direction: [0.7, -0.7], radial: 0.1, evolutionSpeed: 0.3, archetype: 'Ocean Current' },
      speedFactor: 0.4,
      material: { preset: 'LiquidLight', splatRadius: 4.5, coreBrightness: 1.8, haloStrength: 0, falloffExponent: 2.5, thermalLag: 0.109, emissionIntensity: 2.2, heatMode: 'velocity', heatGain: 1.2, blendMode: 'additive', colourRamp: 'liquid', velocityStretch: 0.2 },
      buoyancy: { enabled: true, strength: 1.0, returnForce: 2.0, turbulence: 0.3, maxOffset: 150, curlOctaves: true, smokeThreshold: 0.3, smokeOpacity: 0.5, smokeDissipation: 0.96 },
      sparks: { enabled: true, poolSize: 300, threshold: 0.6, ejectionSpeed: 0.1, gravity: 150, drag: 1.8, minLifetime: 0.4, maxLifetime: 1.5, coolingRate: 1.5, splatRadius: 3, maxSparksPerFrame: 5 },
    },
  },

  'Imploding Sun': {
    metadata: { name: 'Imploding Sun', version: 2, designResolution: { width: 960, height: 720 }, tags: ['plasma', 'implosion', 'flow', 'phase6c'] },
    generators: {
      type: 'lissajous', particleCount: 3500, waveSpeed: 0.09,
      rotation: [0.18, 0.12, 0.05],
      waves: [
        { speed: 1.0, axes: [
          { phase: 0, am: { base: 220, amplitude: 60, frequency: 2.0 }, fm: { base: 5, amplitude: 3.0, frequency: 0.5 } },
          { phase: 28, am: { base: 180, amplitude: 50, frequency: 2.5 }, fm: { base: 4, amplitude: 2.0, frequency: 0.7 } },
          { phase: 0, am: { base: 80, amplitude: 30, frequency: 3.0 }, fm: { base: 2, amplitude: 1.5, frequency: 1.5 } },
        ] },
        { speed: 1.6, axes: [
          { phase: 0, am: { base: 120, amplitude: 50, frequency: 4.0 }, fm: { base: 7, amplitude: 2.0, frequency: 1.0 } },
          { phase: 28, am: { base: 100, amplitude: 40, frequency: 3.0 }, fm: { base: 5, amplitude: 2.5, frequency: 1.2 } },
          { phase: 18, am: { base: 50, amplitude: 20, frequency: 5.0 }, fm: { base: 3, amplitude: 1.5, frequency: 2.0 } },
        ] },
        { speed: 0.6, axes: [
          { phase: 56, am: { base: 80, amplitude: 30, frequency: 2.5 }, fm: { base: 3, amplitude: 1.0, frequency: 0.8 } },
          { phase: 0, am: { base: 90, amplitude: 35, frequency: 3.0 }, fm: { base: 4, amplitude: 1.5, frequency: 0.6 } },
          { phase: 28, am: { base: 100, amplitude: 40, frequency: 2.0 }, fm: { base: 2, amplitude: 2.0, frequency: 0.6 } },
        ] },
      ],
      colorBase: [200, 120, 255], colorAmp: [55, 60, 0], colorFreq: [0.08, 0.12, 0.1], colorShift: [0.1, 0.4, 0.7],
    },
    renderer: { mode: 'splat', glow: 4.0, decayFactor: 0.84, blurRadius: 3, depthSize: 0.4, streaks: 0 },
    postProcessors: {
      transMap: { enabled: true, style: 5, beforeParticles: false, sinMagicParams: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], sinMagicParams2: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], zoomCenter: { x: 50, y: 50 } },
      bloom: { enabled: true, threshold: 0.35, intensity: 0.7, radius: 6 },
      toneMap: { curve: 'aces', exposure: 1.4, lift: [0,0,0], gamma: [1,1,1], gain: [1,1,1.1] },
    },
    // Re-tuned in the browser 2026-08-12 — by far the largest re-tune of the seven, and the only one that
    // changes the film look. Waves, colour, renderer, postProcessors, the `Implosion` flow archetype and
    // curl noise are unchanged. It was a blown-out white ball; every edit takes light out of it.
    //
    // 1. **`filmLook` Ethereal → Customize, for ONE field: `bloomEnabled` true → false.** The Customize
    //    block below is otherwise byte-identical to the `Ethereal` bundle (verified field by field), so
    //    this is not a re-grade — it is the only way to express "Ethereal without bloom", since a named
    //    bundle's params cannot be overridden and `applyFilmLook` applies them wholesale. Ethereal
    //    pairs the widest halo of the 15 looks (`glow: 6.4`) with `bloomThreshold: 0.4`, which on an
    //    imploding figure — where the whole population converges on one point — sends the centre past
    //    every threshold at once.
    //    ⚠️ Per CLAUDE.md, `filmLook: 'Customize'` REQUIRES `customFilmLookParams` to be carried, or the
    //    preset silently inherits whatever the live session had. All 21 fields are written out below.
    // 2. **Material gain cut 5.80x.** `coreBrightness` 2.5 → 0.5 and `emissionIntensity` 3.0 → 1.7 is an
    //    8.82x cut as authored, but `splatRadius` 11 → 4 raises the damping term
    //    `pow(refOverlap/overlap, 0.25)` from 0.986 to its 1.5 clamp, so 5.80x is what is actually
    //    delivered. Do not "restore" the authored numbers on the grounds that they look extreme — the
    //    small radius is what makes them correct.
    // 3. **`haloStrength` 1.5 → 0** removes the soft outer glow entirely, so converging particles no
    //    longer sum their halos into a solid disc, and **`velocityStretch` 0.3 → 1.0** goes fully
    //    flame-shaped: implosion is radial, so stretching along velocity draws the infall as streaks
    //    pointing at the centre rather than as dots. This is the one edit that ADDS structure.
    // 4. **`heatGain` 1.8 → 0.95.** Above 1.0 the steady state `driver * heatGain` clips, flattening the
    //    top of the ramp to one colour; 0.95 keeps the whole `liquid` ramp reachable.
    // 5. **`speedFactor` 1.1 → 0.4** and `thermalLag` 0.055 → 0.08 s, `falloffExponent` 3.0 → 2.5 — the
    //    slower clock needs slightly longer thermal memory for cooling to remain visible.
    // 6. **Buoyancy AND sparks OFF** — both absent from the export, both `enabled: true` as authored.
    //    Plasma is on `FIRE_BEHAVIOUR_MATERIALS`, so selecting it auto-enabled the pair, and both fight
    //    an implosion specifically: buoyancy lift is strictly upward while this figure's motion is
    //    inward, and sparks eject outward on their own arcs. Written out as explicit `enabled: false`
    //    rather than omitted, so a future default change cannot silently re-enable them.
    overlay: {
      renderMode: 'splat',
      filmLook: 'Customize',
      customFilmLookParams: {
        // `Ethereal`, verbatim, except `bloomEnabled` — see (1) above.
        glow: 6.4, depthSize: 0.4, depthBrightness: 0.4, depthDof: 0.8, depthColorShift: 0.3,
        lightingMode: 0, lightDir: [0, -1, 0.5], rimPower: 3.0,
        bloomEnabled: false, bloomThreshold: 0.4, bloomIntensity: 0.5,
        toneMapEnabled: true, toneMapCurve: 'reinhard', exposure: 1.1,
        lift: [0.02, 0.02, 0.03], gamma: [1.05, 1.05, 1.1], gain: [0.95, 0.95, 1],
        saturation: 0.85, vignette: 0.15, palette: 'Pastel', paletteMapping: 'depth',
      },
      transMapEnabled: true,
      transMapStyle: 5,
      transMapForceBlend: 0.8,
      transMapForceReturn: 2.5,
      proceduralFlow: { strength: 0.4, scale: 1.0, curlAmount: 0.2, direction: [0, 0], radial: -1.0, evolutionSpeed: 0.6, archetype: 'Implosion' },
      curlNoise: { enabled: true, turbulence: 0.3, scale: 1.2, evolutionSpeed: 0.8 },
      speedFactor: 0.4,
      material: { preset: 'Plasma', splatRadius: 4, coreBrightness: 0.5, haloStrength: 0, falloffExponent: 2.5, thermalLag: 0.08, emissionIntensity: 1.7, heatMode: 'velocity', heatGain: 0.95, blendMode: 'additive', colourRamp: 'liquid', velocityStretch: 1.0 },
      buoyancy: { enabled: false, strength: 1.5, returnForce: 3.0, turbulence: 0.3, maxOffset: 120, curlOctaves: true, smokeThreshold: 0.2, smokeOpacity: 0.3, smokeDissipation: 0.94 },
      sparks: { enabled: false, poolSize: 600, threshold: 0.4, ejectionSpeed: 2.0, gravity: 200, drag: 1.0, minLifetime: 0.2, maxLifetime: 1.0, coolingRate: 2.5, splatRadius: 3, maxSparksPerFrame: 12 },
    },
  },
};
