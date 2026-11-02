# How the Particle System Screensaver Works

A comprehensive technical and creative guide to the PSSS_JS engine — understanding its algorithms, configuration, rendering pipeline, and the art of designing new visual systems.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Mathematical Foundation: Parametric Lissajous Curves](#2-mathematical-foundation-parametric-lissajous-curves)
3. [The Wave Engine: How Particles Move](#3-the-wave-engine-how-particles-move)
4. [Color System: How Particles Are Colored](#4-color-system-how-particles-are-colored)
5. [3D Transform Pipeline](#5-3d-transform-pipeline)
6. [Rendering Pipeline](#6-rendering-pipeline)
7. [TranslationMap: Pixel Distortion Effects](#7-translationmap-pixel-distortion-effects)
8. [Visual FX System](#8-visual-fx-system)
9. [Curl Noise Turbulence](#9-curl-noise-turbulence)
10. [Configuration Reference](#10-configuration-reference)
11. [Analysis of Existing Presets](#11-analysis-of-existing-presets)
12. [Designing New Systems](#12-designing-new-systems)
13. [Lab Panel: Interactive Exploration Tools](#13-lab-panel-interactive-exploration-tools)
14. [Fractal Attractor System](#14-fractal-attractor-system)
15. [Related Literature and Resources](#15-related-literature-and-resources)

---

## 1. System Overview

PSSS_JS renders thousands of particles whose positions are computed from parametric sine wave equations in 3D space. Each frame:

1. **Compute positions** — 3 waves per axis (X, Y, Z) sum into each particle's 3D position
2. **Compute colors** — per-particle color oscillates via sine functions
3. **3D transform** — rotate and translate the point cloud
4. **Perspective project** — flatten 3D to 2D screen coordinates
5. **Render** — draw particles as pixels/glowing orbs onto the canvas
6. **Post-process** — apply motion blur (brightness decay) and optional pixel distortion (TranslationMap)
7. **Advance time** — increment the global position counter to evolve the pattern

The entire visual diversity (177 presets producing wildly different animations) emerges from varying ~30 numeric parameters in a single, elegant mathematical model.

---

## 2. Mathematical Foundation: Parametric Lissajous Curves

### 2D Lissajous Figures

A classic 2D Lissajous curve is defined by:

```
x(t) = A_x * sin(f_x * t + φ_x)
y(t) = A_y * sin(f_y * t + φ_y)
```

Where:
- `A` = amplitude (controls size/spread)
- `f` = frequency (controls winding density)
- `φ` = phase (controls starting angle/orientation)
- `t` = parameter swept over a range (e.g., 0° to 360°)

The ratio `f_x : f_y` determines the figure's topology:
- **1:1** → ellipse/circle (depending on phase)
- **1:2** → figure-eight / bow-tie
- **2:3** → trefoil-like patterns
- **Irrational ratios** → the curve never closes, filling a rectangular region

### 3D Extension (Lissajous Knots)

PSSS extends this to three axes:

```
x(t) = A_x * sin(f_x * t + φ_x)
y(t) = A_y * sin(f_y * t + φ_y)
z(t) = A_z * sin(f_z * t + φ_z)
```

This produces 3D curves that, when projected to 2D via perspective, create depth illusion. The projection of a 3D Lissajous curve onto any coordinate plane yields a 2D Lissajous figure.

### Superposition of Multiple Waves

PSSS goes further by **superimposing 3 independent waves per axis**:

```
x(t) = Wave1_x(t) + Wave2_x(t) + Wave3_x(t)
y(t) = Wave1_y(t) + Wave2_y(t) + Wave3_y(t)
z(t) = Wave1_z(t) + Wave2_z(t) + Wave3_z(t)
```

This is analogous to **additive synthesis** in audio: combining simple harmonics produces complex timbres. Similarly, combining simple sine curves produces complex spatial patterns.

### Time-Varying Parameters (AM/FM)

The key innovation that makes PSSS patterns *evolve over time* rather than being static curves is **modulation**:

- **Amplitude Modulation (AM):** The amplitude itself oscillates over time: `A(time) = A_base + sin(time * A_freq) * A_amp`
- **Frequency Modulation (FM):** The frequency oscillates over time: `F(time) = F_base + sin(time * F_freq) * F_amp`

This is borrowed directly from FM synthesis in electronic music, where modulating the frequency of a carrier wave produces rich harmonic spectra. In PSSS, FM creates *twisting* — the curve winds tighter and looser over time. AM creates *breathing* — the pattern expands and contracts.

---

## 3. The Wave Engine: How Particles Move

### Per-Frame Computation

Each frame, `ParticleWaves.doObject()` executes:

```
For each wave w (0, 1, 2):
    For each axis a (X, Y, Z):
        AM[w][a] = wave[w][a].am.base + sin(time * wave[w][a].am.freq / DEG) * wave[w][a].am.amp
        FM[w][a] = (wave[w][a].fm.base + sin(time * wave[w][a].fm.freq / DEG) * wave[w][a].fm.amp) / DEG
        PH[w][a] = wave[w][a].phase

step = 360 / particleCount

Clear all positions to [0, 0, 0]

For each wave w (0, 1, 2):
    For each axis a (X, Y, Z):
        For each particle t (index 0 to N-1):
            n = t * step
            position[t][a] += sin((n + PH[w][a]) * FM[w][a]) * AM[w][a]

time += waveSpeed * speedFactor * correction
```

### Key Insight: Particles as Curve Samples

The N particles are **evenly-spaced samples along the parametric curve**. Each particle `t` sits at angular position `t * 360/N` degrees on the wave. This means:

- All particles collectively trace out the same curve at any instant
- The curve itself evolves over time (because AM/FM change)
- The density of particles creates the visual impression of a continuous ribbon, cloud, or structure

### Example: "Quantum Mathematic" (Default Preset)

```
Wave 1 X: Phase=90°, AM=(15, 15, freq=1), FM=(1, 0, 0)    ← constant frequency, breathing amplitude
Wave 1 Y: Phase=0°,  AM=(15, 15, freq=2), FM=(1, 0, 0)    ← similar but faster breathing
Wave 2 X: Phase=7.5°, AM=(6, 6, freq=1.5), FM=(32, 6, 5)  ← high FM base = many windings, FM modulated!
Wave 2 Y: Phase=0°,  AM=(6, 6, freq=1.8), FM=(32, 6, 6)   ← creates dynamic texture overlay
```

Wave 1 produces a slow-breathing elliptical orbit (like a basic Lissajous).
Wave 2 adds a high-frequency detail layer with FM modulation that twists dynamically.
Wave 3 is zeroed out (not all presets use all 3 waves).

The visual result: a smooth organic shape that breathes and rotates, with fine internal structure from the FM of wave 2.

### Understanding FM's Visual Effect

The FM base value directly controls how many "loops" the curve makes:

| FM base | Visual effect |
|---------|--------------|
| 1 | Simple oval/circle (one revolution) |
| 2–4 | Figure-8 or clover patterns |
| 8–16 | Dense winding, creates ribbon/tube shapes |
| 32–64 | Very fine texture, cloud-like when combined with other waves |
| >100 | Near-random point distribution (quasi-noise) |

When FM amplitude > 0, the winding count oscillates over time, making the curve twist and untwist.

### Understanding AM's Visual Effect

| AM configuration | Visual effect |
|-----------------|--------------|
| Base > 0, Amp = 0 | Fixed size — curve spread is constant |
| Base = 0, Amp > 0 | Pulsing from zero — pattern appears and vanishes |
| Base > 0, Amp > 0 | Breathing — pattern expands/contracts around baseline |
| High AM freq | Fast pulsing (strobe-like) |
| Low AM freq | Slow, meditative expansion/contraction |

### Phase Offset Between Axes

The phase difference between X and Y axes determines the curve's orientation:
- **Phase X = 0, Phase Y = 0:** collapsed to a diagonal line
- **Phase X = 90, Phase Y = 0:** circular/elliptical (quadrature)
- **Other values:** tilted ellipses, rotated figures

---

## 4. Color System: How Particles Are Colored

### Per-Particle Color Formula

```
For each particle t at angular position n = t * step:
    For each channel (R, G, B):
        color[ch] = colorBase[ch] + sin(n * colorFreq[ch] / DEG + time * colorShift[ch]) * colorAmp[ch]
        clamp to [0, 255]
```

### Parameters Explained

| Parameter | Effect |
|-----------|--------|
| `colorBase` [R,G,B] | DC offset — the "average" color of all particles |
| `colorAmp` [R,G,B] | How much color varies across particles (0 = uniform, 128 = full range) |
| `colorFreq` [R,G,B] | How quickly color cycles across the particle array. Low freq = smooth gradient, high freq = many bands |
| `colorShift` [R,G,B] | How fast color animates over time. This is the `time * shift` term — higher values = faster color cycling |

### Examples of Color Configurations

**All white particles (no color variation):**
```
Base=[255, 255, 255], Amp=[0, 0, 0], Freq=[0, 0, 0], Shift=[0, 0, 0]
```

**Rainbow gradient along the curve (static):**
```
Base=[128, 128, 128], Amp=[128, 128, 128], Freq=[1.0, 0.7, 0.3], Shift=[0, 0, 0]
```

**Slowly cycling colors (typical):**
```
Base=[128, 128, 128], Amp=[128, 128, 128], Freq=[0.2, 0.3, 0.1], Shift=[0.5, 0.11, 0.13]
```
The different shift values per channel ensure the color doesn't just cycle through hue uniformly — instead, the RGB channels drift at different rates, creating unexpected color combinations over time.

**Monochrome blue with sparkle:**
```
Base=[64, 64, 128], Amp=[64, 64, 128], Freq=[0.1, 0.3, 0.2], Shift=[0.2, 0.3, 0.1]
```
Higher blue base and amplitude mean the palette stays blue-dominated while other channels add subtle variation.

### Color Palette Overlay (Visual FX)

The FX system can override per-particle colors with a pre-defined palette gradient. The particle's position in the gradient is mapped by either:
- **Depth:** particles further from camera sample one end of the palette, closer particles sample the other
- **Phase:** particle index determines palette position (creates bands of color along the curve)

---

## 5. 3D Transform Pipeline

After computing 3D positions, each frame applies:

### Step 1: Rotation

Particles are rotated by Euler angles (X → Y → Z order):
```
effectiveAngle = object.angle - world.viewAngle
rotatedPositions = rotatePoints(particles, effectiveAngle)
```

The rotation angle accumulates over time: `angle += rotationSpeed * delta/1000 * speedFactor`

| Rotation speed | Visual effect |
|---------------|--------------|
| [0, 0, 0] | No rotation — pattern only evolves via wave time |
| [0, 0, 0.5] | Slow Z-axis spin — the most common preset choice |
| [0.5, 0.5, 0.5] | Tumbling in all axes — more chaotic/3D feel |
| High values | Fast spin — patterns streak and blur |

### Step 2: Perspective Projection

```
For each particle at (x, y, z):
    q = z - perspectiveZ          // perspectiveZ ≈ -(width+height)/2
    if q > 0:
        factor = perspectiveZ / q
        screenX = originX - x * factor
        screenY = originY - y * factor
    else:
        off-screen (behind camera)
```

Particles with larger Z appear smaller and more central; particles with smaller Z appear larger and more peripheral. This creates the 3D depth illusion.

The `perspectiveZ` value controls field of view:
- More negative = wider FOV, more dramatic depth
- Less negative = narrower FOV, more telephoto/flat

---

## 6. Rendering Pipeline

### Frame Loop

```
Each frame at target FPS:
    1. Decay pass (motion blur)
    2. If TransMapMode == After:  compute + render particles
    3. If TransMapFilter:         apply pixel distortion
    4. If TransMapMode == Before: compute + render particles
    5. Present to screen
```

### Motion Blur (Brightness Decay)

The "motion blur" in PSSS is achieved by **not clearing the canvas each frame**. Instead, the previous frame is multiplied by a brightness factor < 1.0:

```
brightness = MotionBlur / 8.1    (typically 8/8.1 ≈ 0.988)
```

Each pixel decays by ~1.2% per frame. A particle trail persists for roughly `1 / (1 - brightness)` frames before becoming invisible. At brightness 0.988, trails last ~80 frames (about 1.3 seconds at 60fps).

| MotionBlur value | Brightness | Trail length | Visual effect |
|------------------|-----------|--------------|---------------|
| 8 | 0.988 | Very long | Smooth, flowing trails |
| 6 | 0.741 | Medium | Visible but fading trails |
| 4 | 0.494 | Short | Quick-fading dots |
| 0 | 0 | None | Black background, only current frame visible |

### Render Modes

**rmDraw (0) — Pixel:** Direct pixel write. Sharp, clean particles.

**rmDrawMixMode (1) — Blend:** Additive blending. Overlapping particles accumulate brightness, creating a glowing appearance. The formula: `pixel = existing + new >> intensity`. This means particles in dense regions glow brighter.

**rmDrawStars (2) — Star:** 5-pixel cross pattern (center at half-brightness, four cardinal neighbors at quarter-brightness). Creates larger, brighter particles with a star-like shape. Used by 167 of 177 presets — it's the standard "look" of PSSS.

**Log-Density (3):** WebGL2-only mode. Instead of drawing each particle directly, accumulates a hit count in a R32F floating-point FBO (one float per pixel). After all particles are drawn, a log-normalization pass converts the raw counts to HDR luminance: `L = log(1 + count) / log(1 + maxCount)`. This is then mapped to the trail FBO through the standard film-look pipeline.

The effect is most visible in high-density regions (where many particles overlap the same pixel): star and blend modes clip or saturate at such densities, while log-density reveals fine internal structure because the logarithm separates even very dense regions. The visual character resembles a long-exposure photograph — sparse regions are dim, dense filaments are luminous, and the dynamic range is naturally compressed.

Log-density is selected via `renderer.mode = "log-density"` in the preset or via the Render Mode control in the Visual FX tab.

### WebGL Rendering

The WebGL renderer achieves the same visual result using GPU acceleration:
- Decay pass: full-screen quad with brightness uniform
- Particles: point sprites with configurable fragment shader (glow falloff, star cross pattern)
- TransMap: displacement texture lookup in fragment shader
- Ping-pong FBOs swap read/write each frame to accumulate trails

The fragment shader shapes each particle:
```glsl
// Soft glow (rmDraw, rmDrawMixMode):
float falloff = 1.0 - smoothstep(0.0, 1.0, r);
shape = pow(falloff, uGlow);   // uGlow controls softness (default 2.0)

// Star cross (rmDrawStars):
float cross_d = min(abs(pc.x), abs(pc.y));
float arm = 1.0 - smoothstep(0.0, 0.18, cross_d);
shape = arm * (1.0 - smoothstep(0.3, 1.0, r));
```

---

## 7. TranslationMap: Pixel Distortion Effects

The TranslationMap is a **pre-computed lookup table** that maps each destination pixel to a source pixel. Applied once per frame, it creates spatial distortion effects that warp the accumulated particle trails.

### How It Works

```
For each pixel (x, y) in the image:
    (srcX, srcY) = translationMap[x][y]
    destination[x][y] = source[srcX][srcY]
```

Because the map is pre-computed (not recomputed each frame), the same distortion is applied every frame, causing particle trails to flow along the distortion field.

### Five TransMap Styles

**Style 0: Wave Shift (`tmsWaved`)**
Displaces pixels by sine waves:
```
x' = x + waveY[y]
y' = y + waveX[x]
```
Where `waveX` and `waveY` are computed from up to 4 harmonics:
```
wave[coord] = Σ(h=0..3) sin(360 * coord * freq[h] / dimension / DEG) * amp[h]
```

Creates: flowing, river-like distortion. Particle trails curve and swirl.

**Style 1: Wave Zoom (`tmsWavedZoom`)**
Zooms each pixel from a center point, with the zoom factor modulated by sine of the pixel's distance from center:
```
zoomFactor = Σ(h=0..3) sin(360 * ownAxis * freq[h] / dimension / DEG) * amp[h]
factor = max(0.5, (1.0 + zoomFactor * 0.01))
```

Creates: radial zoom/breathing effects centered on (ZoomCenterX, ZoomCenterY).

**Style 2: Wave Zoom Overlay (`tmsWavedZoomOverlay`)**
Like Wave Zoom but averages the zoom factors from both axes:
```
factor = avg(xFactor, yFactor)
```

Creates: more symmetric radial effects, vortex-like.

**Style 3: Wave Zoom Combined (`tmsWavedZoomCombined`)**
Uses two sets of SinMagicParams — the first set shifts, the second zooms:
```
shift = SinMagicParams1 → wave shift displacement
zoom = SinMagicParams2 → wave zoom factor
Apply both together
```

Creates: the most complex distortions, combining flowing movement with zooming.

**Style 4: IFS Fractal Feedback (WebGL2 only)**
Applies one or more affine transforms to the entire trail buffer each frame via a GPU shader. Unlike styles 0–3 (which use a pre-computed displacement texture), this operates directly in UV space:

```glsl
// For each active transform (up to 6):
vec2 srcUv = rot * (vUv - 0.5) * scale + 0.5 + translation;
result += weight * texture(uFrame, srcUv);
finalColor = mix(original, result, uMix);
```

Each transform is defined by:
- `angle` (0–360°) — rotation around UV center
- `scale` (0.1–2.0×) — uniform scale around UV center
- `tx`/`ty` (−0.5 to +0.5) — UV translation after rotation/scale
- `weight` (0–1, normalized across all transforms at runtime)

Creates: self-similar echo trails that replicate and rotate the particle structure. A single transform with scale < 1 produces a spiraling contraction (the default: 15°, 0.95×). Multiple transforms with different angles and translations produce branching, fern-like, or kaleidoscopic structures.

Unlike styles 0–3, the IFS Fractal Feedback mode does not use `sinMagicParams`. The transforms are stored separately in `ifsParams` and are configurable via the IFS Transforms editor in the Visual FX tab (shown only when style 4 is active). Up to 6 transforms are supported; if `ifsParams` is absent, a single default transform is used.

### SinMagicParams Structure

```
params[0] = xAmplitude[4]    (4 harmonics for X displacement)
params[1] = xFrequency[4]    (frequencies for those harmonics)
params[2] = yAmplitude[4]    (4 harmonics for Y displacement)
params[3] = yFrequency[4]    (frequencies for those harmonics)
```

Amplitudes are specified as percentage of screen dimension (scaled by `dimension/100` at runtime).

### TransMapMode: Before vs After

- **Mode 0 (tmmApplyBefore):** Particles are drawn AFTER distortion. The distortion warps the existing trails, but new particles appear undistorted.
- **Mode 1 (tmmApplyAfter):** Particles are drawn BEFORE distortion. Everything (including just-drawn particles) gets warped. Creates a stronger flow effect.

### Example: How TransMap Creates "Vortex" Effects

"Time Vortex II" uses Style 3 (Combined) with:
- First SinMagicParams: wave shift that pulls pixels toward center
- Second SinMagicParams: zoom that pushes outward
- Combined effect: spiral — particles appear to flow in circular paths

---

## 8. Visual FX System

The FX system provides global overlays that enhance visuals. All overlay settings are exposed in the **Visual FX** Lab tab and can optionally be baked into a preset export via the `overlay` block.

### Soft Glow (uGlow)

Controls the radial falloff curve of each particle in the fragment shader:
- `glow = 0.5`: very soft, wide halo
- `glow = 2.0` (default): natural soft edge
- `glow = 3.0`: tight center, minimal halo

### Depth Size (uDepthSize)

Scales particle size based on Z-depth. Particles closer to camera appear larger:
```
size = baseSize * (1.0 + depthSize * (1.0 - normalizedDepth))
```

### Velocity Streaks

Computes per-particle velocity from frame-to-frame position difference, then offsets particle rendering along the velocity vector. In WebGL, draws `gl.LINES` instead of `gl.POINTS`; in Canvas 2D, draws pixel-lines along the velocity direction.

### Color Palettes

Replaces per-particle color with a gradient texture lookup. 25 built-in palettes: 12 cosine palettes (Warm, Cool, Neon, Earth, Prismatic, Monochrome, Sunset, Ocean, Fire, Aurora, Pastel, Midnight) and 13 legacy gradient palettes (fire, ocean, aurora, neon, grayscale, sunset, toxic, thermal, cyberpunk, ice, ember, galaxy, candy). Mapping modes: depth (near/far), phase (particle index), velocity (speed).

### Speed Correction

Fixes the historical inconsistency where wave advance was frame-coupled (`pos += waveSpeed` per frame) while rotation was time-based. When enabled:
```
correction = delta / 16.667    (normalized to 60fps reference)
pos += waveSpeed * speedFactor * correction
```

### Speed Factor

A global multiplier (0.1–5.0) applied to all time-dependent elements: wave advance, rotation, and position movement. Allows slowing down or speeding up any preset without editing its parameters.

### Film Looks

Film Looks are curated named bundles that atomically set all post-processing parameters across three subsystems:

| Subsystem | Parameters |
|-----------|-----------|
| Particle renderer | `glow`, `depthSize`, `depthBrightness`, `depthDof`, `depthColorShift`, `lightingMode`, `lightDir`, `rimPower`, `palette`, `paletteMapping` |
| Bloom processor | `bloomEnabled`, `bloomThreshold`, `bloomIntensity` |
| Tone-map processor | `toneMapEnabled`, `toneMapCurve` (none/ACES/Reinhard), `exposure`, `lift[RGB]`, `gamma[RGB]`, `gain[RGB]`, `saturation`, `vignette` |

`paletteMapping` has **six** members — `depth`, `phase`, `velocity`, `temperature`, `position`, `age`.
`temperature` is what lets a material and a film look compose instead of compete (material heat becomes the
palette's input), and it is the only one that needs an active material: without one every particle would
sample LUT index 0.

Applying a named bundle calls `bloom.dispose()+init()` and `toneMap.dispose()+init()` once. **15 named bundles** are provided:

| Name | Character |
|------|-----------|
| Legacy | No post-processing |
| Luminous | Soft bloom, ACES, warm palette |
| Cinematic | Deep DoF, directional lighting, blue shadows, vignette |
| Neon | Heavy bloom, rim lighting, neon palette, high saturation |
| Ethereal | Max glow, Reinhard, pastel, phase-mapped |
| Dramatic | All-axis lighting, strong vignette, prismatic velocity-mapped palette |
| Vintage | Desaturated, warm sepia, heavy vignette, Reinhard |
| Glacier | Cold blue, max DoF, rim lighting, icy minimalist |
| Plasma | Extreme saturation (2×), max bloom (1.0), velocity neon palette |
| Monochrome | Greyscale (saturation=0), rim lighting only |
| Teal & Orange | Split-tone grade: warm highs, teal-blue lows |
| Holographic | Phase-mapped Aurora palette, full colour-shift, dual lighting |
| Void | Near-black exposure (0.7), specular-only bloom, Midnight palette |
| Overexposed | Exposure 2.5×, low bloom threshold (0.2), warm phase palette |
| Legacy Graded | `Legacy`'s shape and colour, graded: ACES + exposure 1.4 + restrained bloom (added 2026-08-10) |

**`Legacy` is pinned at `glow: 4.0`** — all 177 legacy presets carry `renderer.glow: 2.0` and the
ribbon/neon shaders use `max(1.0, 2.0/uGlow)` so that value is the identity, so changing `Legacy` shifts
the whole preset library. `Legacy Graded` exists for that reason: `star` mode is under-exposed in
**absolute** terms (a figure pixel reaches only 8-bit 35–93 of 255 under `Legacy`), but `Legacy` is the
`?? 'Legacy'` fallback for every preset with no `overlay` block, so it cannot be retuned without restyling
everything at once and destroying the A/B reference. Note the three tone-map fields are **one atomic
change**: `exposure` is a uniform *inside* the tone-map shader and the whole post pass is gated on
`bloom.isEnabled() || toneMap.isEnabled()`, so raising `exposure` on a bundle with `toneMapEnabled: false`
changes nothing at all.

**Customize mode** — Selecting "Customize" expands an in-place sub-panel with 20 of the 21 individual
parameters grouped into four sections (Particles, Palette, Bloom, Tone Map) — `lightDir` has no control and
is settable only by a named bundle or by hand-editing an exported preset. Switching from any named bundle to Customize seeds all fields from that bundle. Individual parameter changes use lightweight `setParams()` calls; only toggling `enabled` or changing `toneMapCurve` triggers a full `dispose()+init()`.

When `filmLook = "Customize"` is included in an export, the full `customFilmLookParams` object is serialised alongside it, ensuring exact reproduction on import.

### Ribbon Rendering

Four modes control how particle trails are rendered:
- **Off** — standard point sprites
- **Hybrid** — particle points with additional ribbon geometry connecting sequential particles
- **Streaks** — elongated streak sprites aligned to velocity
- **Adaptive** — automatically selects between Hybrid and Streaks based on particle speed

Ribbon Width controls the ribbon geometry line width (0.5–20 px).

### Neon Lines

Draws neon glow lines connecting sequential particles. Mutually exclusive with Ribbon (enabling one disables the other). Line Width controls stroke width (0.5–10 px).

### Attractor Overlay

Blends any of 41 named attractor presets (across 10 types) with the current Lissajous particle positions. The Attractor Blend slider (0–1) interpolates from pure Lissajous (0) to pure attractor (1). See section 14 for full attractor documentation.

---

## 9. Curl Noise Turbulence

Curl noise is a divergence-free turbulence field applied CPU-side to particle positions each frame, after attractor blending but before the 3D rotation and perspective projection. Because it is divergence-free, it produces smooth swirling motion without particles bunching or spreading apart — particles flow as if through an incompressible fluid.

### How It Works

The field is built from simplex noise evaluated in 4D (3 spatial dimensions + time):

```
function curlNoise3D(x, y, z, t, scale):
    // Evaluate noise partial derivatives at (x,y,z,t)*scale
    // to produce a curl vector field
    dx = ∂N/∂y(xz) - ∂N/∂z(xy)    // x component of curl
    dy = ∂N/∂z(yx) - ∂N/∂x(yz)    // y component of curl
    dz = ∂N/∂x(zy) - ∂N/∂y(zx)    // z component of curl
    return (dx, dy, dz)             // divergence-free by construction
```

The result is a smooth vector field in which every particle is displaced each frame:

```
dispScale = (canvasWidth + canvasHeight) * 0.05 * turbulence
position[i] += curlNoise3D(position[i], time, scale) * dispScale
time += dt * 0.001 * evolutionSpeed
```

### Parameters

| Parameter | Range | Effect |
|-----------|-------|--------|
| `enabled` | bool | Master on/off switch |
| `turbulence` (γ) | 0–1 | Blend factor — how strongly curl displaces particles. 0 = no effect, 1 = maximum displacement (~5% of canvas per frame) |
| `scale` | 0.1–10 | Spatial frequency of the noise field. Low values = large smooth swirls; high values = fine turbulent detail |
| `evolutionSpeed` | 0–2 | How fast the noise field drifts over time. 0 = frozen (static curl), 1 = natural drift, 2 = fast evolution |

### Interaction with Other Systems

Curl noise is applied **after** attractor blending, so it perturbs whichever blend of wave + attractor positions is already computed. It stacks independently — you can run full attractor blend (1.0) and still add curl noise on top for organic turbulence. It is applied **before** 3D rotation, so the noise field exists in model space and rotates with the particle cloud.

Curl noise settings are persisted in the preset's `renderer.curlNoise` block (not in `OverlayState`) and are restored on preset load.

---

## 10. Configuration Reference

### Preset Parameters (Complete List)

| Parameter | Type | Range | Default behavior |
|-----------|------|-------|-----------------|
| `ParticleCount` | int | 1–8000 | Multiplied by 5 at runtime. More particles = denser curve sampling |
| `MotionBlur` | int | 0–8 | Divided by 8.1 for brightness. Higher = longer trails |
| `SmoothFilter` | bool | — | Adds 1px blur to decay pass. Smooths pixelation |
| `RenderMode` | 0/1/2 | — | Draw/Mix/Stars. 95% of presets use Stars (2) |
| `TransMapFilter` | bool | — | Enable/disable pixel distortion |
| `TransMapStyle` | 0–4 | — | Wave Shift/Wave Zoom/Zoom Overlay/Zoom Combined/IFS Fractal Feedback |
| `TransMapMode` | 0/1 | — | Before/After particle rendering |
| `ZoomCenterX/Y` | 0–100 | — | Center point for zoom styles (percentage) |
| `SinMagicParams` | [4][4] | — | TransMap wave parameters (4 rows × 4 harmonics) |
| `SinMagicParams2` | [4][4] | — | Second set for Combined style |
| `WaveSpeed` | float | 0.005–0.5 | How fast the pattern evolves. 0.05 is typical |
| `Rotation` | [rx,ry,rz] | — | Degrees per second on each axis |
| `ColorBase` | [R,G,B] | 0–255 | Average color |
| `ColorAmp` | [R,G,B] | 0–255 | Color variation range |
| `ColorFreq` | [R,G,B] | — | Color gradient frequency |
| `ColorShift` | [R,G,B] | — | Color animation speed |
| `Waves` | [3][3] | — | 3 waves × 3 axes, each with Phase + AM + FM |

### Wave Parameter Structure

Each wave on each axis has:
```
Phase:    float (degrees) — fixed angular offset
AM.Base:  float — baseline amplitude
AM.Amp:   float — amplitude of the amplitude modulation
AM.Freq:  float — frequency of the amplitude modulation
FM.Base:  float — baseline frequency (winding count)
FM.Amp:   float — amplitude of frequency modulation
FM.Freq:  float — frequency of the frequency modulation
```

---

## 11. Analysis of Existing Presets

### Statistics (177 Presets)

| Metric | Value |
|--------|-------|
| Total presets | 177 |
| Using Stars render mode | 167 (94%) |
| Using Mix render mode | 10 (6%) |
| Using TransMap distortion | 117 (66%) |
| With rotation | 140 (79%) |
| With FM modulation | 145 (82%) |
| With animated color (ColorShift) | 176 (99%) |
| Particle count range | 1 to 8,000 (×5 = 5 to 40,000 actual) |
| WaveSpeed range | 0.005 to 0.5 (median: 0.05) |

### TransMap Style Distribution

| Style | Count | Percentage |
|-------|-------|-----------|
| Wave Shift (0) | 120 | 68% |
| Wave Zoom (1) | 5 | 3% |
| Wave Zoom Overlay (2) | 33 | 19% |
| Wave Zoom Combined (3) | 19 | 11% |

### Archetype Analysis

**Archetype 1: Flowing Ribbons** (e.g., "Living Blue", "Deep Thought")
- Low particle count (4000–6000)
- Low wave speed (0.005–0.01) — very slow evolution
- 1–2 waves with moderate FM base (8–32), low FM modulation
- Wave Shift TransMap — trails flow along sine displacement
- Z-axis rotation only

**Archetype 2: Organic Cloudforms** (e.g., "Ghosts", "Fogs Of Another World")
- High particle count (4000–8000)
- High FM base on multiple waves (8, 32, 64) — dense point distribution
- All 3 waves active — complex superposition
- Minimal rotation — evolution purely from wave time
- High wave speed for "Ghosts" (0.5) makes the form change rapidly

**Archetype 3: Geometric Machinery** (e.g., "Quantum Mathematic", "Alpha Particles")
- Low particle count for "Alpha Particles" (88 × 5 = 440) — discrete dots
- Phase offset of 90° between X and Y — creates elliptical/circular base
- Strong FM with modulation — creates dynamic internal structure
- Moderate rotation on all axes

**Archetype 4: Vortex/Tunnel** (e.g., "Time Vortex II", "Aliens DNA")
- Combined or Zoom TransMap style — creates radial flow
- Strong Z-axis amplitude (particles spread in depth) + zoom TransMap = tunnel illusion
- Z-axis rotation with TransMap creates spiral motion
- Often use AM modulation (breathing) on the Z amplitude

**Archetype 5: Minimal/Abstract** (e.g., "Alpha Particles")
- Very low particle count (88) — each dot visible individually
- No TransMap — clean, geometric
- Single wave with FM modulation — creates recognizable mathematical figures
- No smooth filter — sharp pixels, retro aesthetic

### Detailed Preset Walkthrough: "Aliens DNA"

```
Particles: 3200 (x5 = 16000)
MotionBlur: 8 (long trails)
RenderMode: Stars
TransMap: WaveZoom, centered at (50%, 50%)
WaveSpeed: 0.05
Rotation: Z-axis only at 0.2°/sec

Wave 1: AM oscillates (0→15, 0→25 on X/Y), FM fixed at 5
         → Basic shape that breathes in/out
Wave 2: AM oscillates at freq=10, FM fixed at 25
         → Adds medium-detail structure that pulses
Wave 3: AM oscillates at freq=15, FM fixed at 625(!)
         → FM=625 means 625 windings — effectively noise/texture
         → Very small amplitude (1.875) keeps it subtle
```

The result: a DNA-helix-like structure that breathes and rotates, with fine internal texture from the ultra-high-frequency Wave 3, all under a gentle radial zoom distortion.

---

## 12. Designing New Systems

### General Approach

1. **Start with one wave** on X and Y with a phase offset of 90°. Set FM.Base to 1–4 for a recognizable Lissajous figure.
2. **Add rotation** (Z-axis, 0.2–0.5°/sec) to reveal the 3D structure.
3. **Add AM** to make it breathe. Start with AM.Amp = AM.Base (oscillates from 0 to 2×base).
4. **Add FM modulation** to make it twist. Start with FM.Amp = FM.Base/4.
5. **Add a second wave** with higher FM for detail. Keep its amplitude lower than Wave 1.
6. **Add TransMap** for flow. Wave Shift with small amplitude (1–3%) creates subtle motion.
7. **Tune color** — start with Base=[128,128,128], Amp=[128,128,128], diverse Freq and Shift values.

### Design Principles

**Contrast creates interest:**
- Combine a slow-evolving large wave (low FM, high AM) with a fast-evolving small wave (high FM, modulated)
- Use different AM frequencies on different axes (asymmetric breathing)
- Different ColorShift rates per channel create unexpected color progressions

**Less is more:**
- Most striking presets use only 1–2 waves (not all 3)
- Zero out unused waves completely (not just low amplitude)
- A single strong design element (e.g., one dramatic FM modulation) beats many weak ones

**Depth and dimensionality:**
- Z-axis amplitude gives depth. Without it, the pattern is flat (2D)
- Moderate Z amplitude (50–100% of X/Y) = subtle depth
- Very large Z amplitude + small X/Y = tunnel/corridor effect

**Motion blur is your friend:**
- Always use MotionBlur = 8 unless you specifically want short trails
- Short trails (MotionBlur 4–6) work for fast-moving, discrete particle effects
- Long trails turn individual dots into flowing ribbons

**TransMap amplifies everything:**
- Even tiny TransMap amplitudes (0.2–1.0) create dramatic effects because they accumulate over the trail
- Start with Wave Shift style (simplest to control)
- Use only 1 harmonic at first (set harmonics 2–4 to zero)

### Recipe: Meditative Slow-Flow

```json
{
  "ParticleCount": 4000,
  "MotionBlur": 8,
  "SmoothFilter": true,
  "RenderMode": 2,
  "TransMapFilter": true,
  "TransMapStyle": 0,
  "TransMapMode": 1,
  "WaveSpeed": 0.01,
  "Rotation": [0, 0, 0.3],
  "ColorBase": [80, 60, 120],
  "ColorAmp": [80, 80, 130],
  "ColorFreq": [0.15, 0.2, 0.08],
  "ColorShift": [0.05, 0.08, 0.03],
  "SinMagicParams": [[-0.5, 0, 0, 0], [1.0, 0, 0, 0], [-0.8, 0, 0, 0], [0.7, 0, 0, 0]],
  "Waves": [
    [{"Phase": 90, "Am": {"Base": 20, "Amp": 10, "Freq": 0.5}, "Fm": {"Base": 4, "Amp": 2, "Freq": 0.3}},
     {"Phase": 0, "Am": {"Base": 25, "Amp": 12, "Freq": 0.7}, "Fm": {"Base": 4, "Amp": 2, "Freq": 0.4}},
     {"Phase": 0, "Am": {"Base": 15, "Amp": 8, "Freq": 0.6}, "Fm": {"Base": 2, "Amp": 1, "Freq": 0.2}}],
    [{"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}},
     {"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}},
     {"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}}],
    [{"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}},
     {"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}},
     {"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}}]
  ]
}
```

Design intent: Single wave with low FM (creates a smooth trefoil), slow AM (gentle breathing), slow wave speed (meditative pace), subtle TransMap (trails drift), blue-purple color palette.

### Recipe: Energetic Particle Storm

```json
{
  "ParticleCount": 6000,
  "MotionBlur": 7,
  "SmoothFilter": true,
  "RenderMode": 2,
  "TransMapFilter": true,
  "TransMapStyle": 2,
  "TransMapMode": 1,
  "WaveSpeed": 0.07,
  "Rotation": [0.3, 0.5, 0.8],
  "ColorBase": [128, 128, 128],
  "ColorAmp": [128, 128, 128],
  "ColorFreq": [0.3, 0.5, 0.2],
  "ColorShift": [0.3, 0.15, 0.4],
  "Waves": [
    [{"Phase": 90, "Am": {"Base": 30, "Amp": 15, "Freq": 2}, "Fm": {"Base": 8, "Amp": 4, "Freq": 3}},
     {"Phase": 0, "Am": {"Base": 35, "Amp": 18, "Freq": 2.5}, "Fm": {"Base": 8, "Amp": 5, "Freq": 4}},
     {"Phase": 45, "Am": {"Base": 25, "Amp": 25, "Freq": 1.5}, "Fm": {"Base": 4, "Amp": 2, "Freq": 2}}],
    [{"Phase": 30, "Am": {"Base": 10, "Amp": 10, "Freq": 5}, "Fm": {"Base": 32, "Amp": 8, "Freq": 7}},
     {"Phase": 60, "Am": {"Base": 12, "Amp": 12, "Freq": 6}, "Fm": {"Base": 32, "Amp": 10, "Freq": 8}},
     {"Phase": 0, "Am": {"Base": 8, "Amp": 8, "Freq": 4}, "Fm": {"Base": 16, "Amp": 4, "Freq": 5}}],
    [{"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}},
     {"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}},
     {"Phase": 0, "Am": {"Base": 0, "Amp": 0, "Freq": 0}, "Fm": {"Base": 0, "Amp": 0, "Freq": 0}}]
  ]
}
```

Design intent: Two waves — Wave 1 for large-scale structure with moderate FM (8), Wave 2 for fine detail with high FM (32). Fast rotation on all axes tumbles the form. Wave Zoom Overlay TransMap creates radial pulse. Higher wave speed keeps it dynamic.

### Testing Methodology

1. **Start in Edit mode** — open the settings panel to see all parameters live
2. **Begin from a known preset** — pick one in the same archetype, modify from there
3. **Change one parameter family at a time** — adjust all Wave 1 FM values, observe, then move to Wave 2
4. **Use Speed Factor** — slow down to 0.3 to see the structure clearly, then speed back up
5. **Toggle TransMap** — disable it first to see the raw particle shape, then add distortion
6. **Watch for at least 30 seconds** — AM/FM modulation creates cycles. A pattern that looks boring at t=0 may be beautiful at t=15s when the modulations align
7. **Test both renderers** — toggle WebGL on/off to verify the effect works in both
8. **Try fullscreen** — some effects only "click" at higher resolution where individual particles resolve as soft orbs

### Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Pattern looks like random noise | FM values too high. Reduce FM.Base to < 16 |
| Pattern is static/boring | Add AM modulation (set AM.Amp > 0) or increase WaveSpeed |
| Particles bunch at center | AM values too low. Increase AM.Base |
| Everything is one color | Increase ColorAmp and use diverse ColorFreq values |
| TransMap makes it unrecognizable | Reduce SinMagicParams amplitudes by 50% |
| Pattern collapses to a line | Need phase offset between X and Y (set Phase to 90° on Wave 1 X) |
| Too chaotic, no structure | Reduce to 1 wave. Zero out waves 2 and 3 |

---

## 13. Lab Panel: Interactive Exploration Tools

The Lab panel provides seven complementary tools for discovering new particle system configurations without manual parameter tuning. It appears as a side panel to the right of the live preview, allowing real-time adjustment while watching the full animation.

### 13.1 Interpolation Mixer

A DJ-style crossfader blends between two presets (Deck A and Deck B). All numeric parameters interpolate linearly; discrete parameters (RenderMode, TransMapStyle, booleans) snap at the 50% threshold. Category locks allow freezing specific parameter groups (Shape, Color, Motion, TransMap) during crossfading.

### 13.2 Randomizer

Applies Gaussian noise (Box-Muller transform) to the currently displayed preset at three intensity levels:
- **Subtle** (sigma = 0.05): gentle variations, same character
- **Medium** (sigma = 0.20): noticeable changes, may shift character
- **Wild** (sigma = 0.50): dramatic mutations, plus chance to flip booleans and shift discrete enums

Respects category locks — locked parameters are excluded from mutation.

### 13.3 Archetype Styles

Five data-driven visual archetypes derived from statistical analysis of the 177 preset library:

| Archetype | Character | Defining Traits |
|-----------|-----------|-----------------|
| **Flowing Ribbon** | Smooth flowing trails | Wave Shift TransMap, low FM modulation |
| **Organic Cloud** | Chaotic multi-harmonic forms | High FM depth, multiple active waves |
| **Vortex Tunnel** | Deep 3D tunnel/vortex effects | Zoom TransMap, strong Z-axis amplitude |
| **Geometric** | Clean mathematical Lissajous figures | No TransMap, low FM, pure parametric curves |
| **Warped Surface** | Flat shapes with strong distortion | Zoom TransMap, flat Z-axis |

Each archetype provides:
- 3–5 curated base presets from the library
- 3–5 domain-specific sliders with plain-language labels
- Locked structural parameters that maintain the archetype's identity
- "Send to Mixer" / "Send to Evolution" buttons to bridge into other tools

### 13.4 Genetic Evolution Gallery

Inspired by Karl Sims' evolutionary art. A 3x3 grid of live mini particle systems replaces the main canvas when active. Each tile runs an independent Canvas 2D rendering pipeline at reduced scale (256x192, particles/4, 15fps).

Workflow:
1. **Seed** from the current preset or a random one ("Surprise Me")
2. **Select** 1–3 favorites by clicking tiles
3. **Breed** to produce the next generation via crossover + mutation
4. **Repeat** until convergence on a desired aesthetic

Breeding strategies:
- **1 parent**: 9 jittered mutations
- **2 parents**: interpolation + wave-level crossover + random mix
- **3 parents**: pairwise + three-way average + random crossover

Mutation strategies (applied probabilistically to each offspring):
- Jitter (100%): Gaussian noise sigma=10% on all numeric params
- Wave swap (30%): exchange entire Wave config between axes
- Style jump (10%): random TransMapStyle or RenderMode change
- Frequency doubling/halving (15%): FM.Base ×2 or ÷2
- Phase rotation (20%): shift all phases by 30/60/90 degrees

### 13.5 Visual FX Tab

Exposes the global rendering overlay controls as a Lab tab so they can be explored live alongside other Lab tools:
- **Film Look** — select from 15 named bundles or Customize. Switching to Customize seeds 20 individual fields from the previously selected bundle and expands an in-place panel of sliders and dropdowns.
- **Attractor** — select any of 41 named attractor presets across 10 attractor types, with a blend slider (0–1).
- **Ribbon Mode** — Off / Hybrid / Streaks / Adaptive + width slider.
- **Neon Lines** — enable/disable + width slider. Mutually exclusive with Ribbon (enabling one disables the other).
- **Render Mode** — switch between Pixel, Blend, Star, Log-Density, Splat and Volume. Log-Density produces sharper high-density structures (see section 6); Splat is the material/flame-body pipeline; Volume is a 2-pass Beer-Lambert resolve.
- **Translation Map** — enable/disable the TransMap, change style (0=Wave Shift through 6=Fluid Feedback), configure IFS Transforms when style 4 is active, a flow archetype when style 5 is active, and the fluid-feedback panel when style 6 is active (see section 7). Plus a Force Field sub-section (Warp Mix, Force Blend, Return Force, Force Affects Sparks) that couples the displacement to the particles rather than only to the image.
- **Curl Noise** — enable/disable and configure turbulence intensity, spatial scale, and evolution speed (see section 9).
- **Animation Speed** — slider from 0.1× to 5.0× controlling `overlay.speedFactor` (it lived in `renderer.speedFactor` until it moved to the overlay; old exports auto-migrate). Syncs automatically whenever a preset is loaded.
- **Figure Scale** — 0.2×–5.0× on the logarithmic `sliderMul` curve, shared with the Sliders tab so the two feel identical.
- **Particle Number** — 1–50 000 on a **cubic** track, so 1–2 000 gets 34 % of the travel while 20 000–50 000 is compressed into the top 26 %. The one Visual FX control that does **not** write `overlay`: it writes `preset.generators.particleCount`, which already has six mutating consumers, so an overlay twin would create two sources of truth. It resizes the generator **in place** — `dispose()` + `init()` would reset the animation clock and snap the figure back to its opening pose on every step of a drag.
- **Physarum Network**, **Fluid Advection**, **Dye Field** and **Volume Render** — see their own sections.

All overlay settings remain independent of the working preset during Lab exploration. They are baked in when you click **Export** or **Snapshot** — both inject the current overlay state (including render mode, TransMap settings, and curl noise) into a deep copy before serialising.

### 13.6 Shared Controls

All tabs share:
- **Snapshot** — captures the current preset + current overlay state as a live-animated tile entry (max 10, FIFO). Clicking restores the exact preset and overlay.
- **Export Preset** — downloads the current working preset + current overlay as a JSON file. If Film Look is set to Customize, all 21 `customFilmLookParams` fields are included (⚠️ a `filmLook: 'Customize'` preset **requires** them — without the block it inherits whatever the live session happened to have, so it looks right for whoever exported it and wrong for everyone else).
- **Import** — loads a JSON preset file and adds it to the library and Preview Grid.

---

## 14. Fractal Attractor System

The Fractal Attractor System extends PSSS beyond pure parametric Lissajous curves by introducing chaotic dynamical systems and escape-time fractals. Particles can be driven partially or fully by attractor dynamics, blended smoothly with their wave-engine positions to produce hybrid organic-mathematical forms.

### 14.1 Concept: Blending Two Worlds

The core idea is **continuous interpolation** between two fundamentally different particle motion paradigms:

```
finalPosition[i] = (1 - blend) * wavePosition[i] + blend * attractorPosition[i]
```

At `blend = 0`, the system behaves as a traditional PSSS Lissajous particle system. At `blend = 1.0`, particles are driven entirely by attractor dynamics. Intermediate values create hybrid forms where mathematical order (Lissajous curves) dissolves into chaotic or fractal structure.

This is controlled by the `gFractalBlend` parameter (0–1), exposed as a percentage slider in the Lab → Fractal tab.

### 14.2 Attractor Categories

PSSS implements 10 attractor types spanning three mathematical categories:

#### Category 1: Discrete Maps (Clifford, De Jong)

2D iterated maps of the form:
```
Clifford:   x' = sin(a*y) + c*cos(a*x)
            y' = sin(b*x) + d*cos(b*y)

De Jong:    x' = sin(a*y) - cos(b*x)
            y' = sin(c*x) - cos(d*y)
```

Each particle maintains its own state `(ax, ay)` and iterates once per frame. The attractor's basin of attraction concentrates particles into characteristic fractal dust patterns. Parameters (a, b, c, d) control the topology — small changes produce dramatically different structures.

| Parameter range | Visual character |
|----------------|-----------------|
| a, b near ±1.4 | Dense, symmetric butterfly shapes |
| a, b near ±2.5 | Sparser, more geometric |
| c, d = 0 | Collapsed to curves |
| c, d = ±0.7 | Maximum spread |

#### Category 2: Continuous ODE Attractors (Lorenz, Rössler, Thomas, Halvorsen, Aizawa, Nosé-Hoover)

3D ordinary differential equation systems integrated with small timestep `dt`:

```
Lorenz:      dx/dt = σ(y - x),  dy/dt = x(ρ - z) - y,  dz/dt = xy - βz
Rössler:     dx/dt = -(y + z),  dy/dt = x + ay,         dz/dt = b + z(x - c)
Thomas:      dx/dt = sin(y) - bx,  dy/dt = sin(z) - by, dz/dt = sin(x) - bz
Halvorsen:   dx/dt = -ax - 4y - 4z - y²,  (cyclic permutations)
Aizawa:      Complex 6-term system producing toroidal chaos
Nosé-Hoover: dx/dt = y,  dy/dt = -x + yz,  dz/dt = a(1 - y²)
```

These produce smooth, continuous particle trajectories (unlike the discrete maps which "jump"). Each particle carries a hidden Z-state (`gLorenzZState[]`) since the screen only shows X-Y projection of the 3D attractor.

**Key design choice:** The Z component is tracked per-particle but only used to provide depth information (for 3D rotation and perspective). When blended, the attractor's 3D Z-state is used as the Z coordinate in the standard 3D transform pipeline — enabling rotation to reveal 3D structure of the chaotic attractor.

| Attractor | Visual character | Best dt |
|-----------|-----------------|---------|
| Lorenz | Butterfly wings, dramatic figure-8 | 0.005–0.02 |
| Rössler | Funnel-spiral into folded band | 0.01–0.03 |
| Thomas | Smooth cyclic triple-symmetric flow | 0.03–0.08 |
| Halvorsen | Tight triangular knot | 0.003–0.01 |
| Aizawa | Donut/torus with chaotic eruptions | 0.005–0.02 |
| Nosé-Hoover | Spherical shell dynamics | 0.02–0.08 |

#### Category 3: Escape-Time Fractals (Julia, Mandelbrot)

These are fundamentally different from categories 1 and 2. The Julia and Mandelbrot sets are NOT iterated per frame as dynamical systems — instead, they define a **scalar field** (the escape time) whose topology drives particle flow.

##### The Problem with Direct Iteration

Naively iterating `z² + c` per frame produces discrete jumps that rapidly diverge to infinity. Unlike Clifford/De Jong (bounded attractors) or Lorenz (bounded ODE), the complex quadratic map has no stable basin for most points. Directly iterating would produce meaningless noise.

##### The Solution: Escape-Speed Field Flow

Instead of treating the fractal as a dynamical system, PSSS treats it as a **landscape**:

1. Pre-compute a scalar field (escape time) over a 2D grid
2. Compute the gradient of that field
3. Move particles **perpendicular to the gradient** (along iso-contours)

This is analogous to fluid particles flowing along contour lines of a topographic map — they follow the "level curves" of the fractal boundary, never crossing them.

### 14.3 Escape-Speed Field Flow: Algorithm Detail

#### Step 1: Smooth Escape Time Computation

For Julia set iteration `z → z² + c` (c fixed), compute the smooth escape count at each grid point:

```
function smoothEscapeJulia(x, y, cRe, cIm, maxIter):
    z = (x, y)          // start at the grid point
    for i = 0 to maxIter:
        if |z|² > 256:   // bailout radius² = 256 (radius = 16)
            return i - log₂(log₂(|z|²)) + 4    // smooth fractional iteration count
        z = z² + c
    return maxIter       // inside the set
```

For Mandelbrot set, the grid point IS the `c` value and `z` starts at origin:

```
function smoothEscapeMandelbrot(cRe, cIm, maxIter):
    z = (0, 0)
    for i = 0 to maxIter:
        if |z|² > 256:
            return i - log₂(log₂(|z|²)) + 4
        z = z² + c       // c = (cRe, cIm) is the grid point
    return maxIter
```

The smooth formula `i - log₂(log₂(|z|²)) + 4` (Douady-Hubbard potential) eliminates banding artifacts by providing a continuous fractional escape count between integer iterations.

**Why bailout radius 256?** Using radius 16 (squared = 256) instead of the minimum 2 ensures `log₂(log₂(|z|²))` is well-defined and the smooth iteration count transitions cleanly between integer values.

#### Step 2: Grid Computation with Adaptive Resolution

The escape field is computed on a 512×512 grid covering the view bounds:

```
grid = new Float32Array(512 * 512)
bounds = [xMin, yMin, xMax, yMax]    // e.g., [-2, -2, 2, 2] for full Julia
maxIter = computeAdaptiveMaxIter(bounds)

for each grid cell (gx, gy):
    px = bounds[0] + (gx + 0.5) * dx
    py = bounds[1] + (gy + 0.5) * dy
    grid[gy * 512 + gx] = smoothEscape(px, py, maxIter)
```

**Adaptive max iterations** scale with zoom depth:

| Bounds span | Max iterations | Rationale |
|------------|---------------|-----------|
| > 2.0 (full set) | 256 | Coarse detail sufficient |
| > 0.5 | 400 | Medium detail |
| > 0.1 | 600 | Fine filaments |
| > 0.01 | 800 | Deep zoom |
| ≤ 0.01 | 1000 | Maximum precision |

Deeper zooms require more iterations because the boundary becomes increasingly intricate — shallow iteration counts miss fine filaments and produce noisy flat regions where the algorithm cannot distinguish "inside" from "slow escape."

#### Step 3: Grid Blur (Noise Reduction)

The raw grid contains noise from the discrete sampling. Three passes of weighted box blur smooth the field while preserving gradient direction:

```
kernel (3×3, weighted):
    [1  1  1]
    [1  4  1]  / 12
    [1  1  1]
```

The center-weighted kernel smooths noise without destroying the gradient field structure. Three passes approximate a Gaussian blur of σ ≈ 1.5 grid cells.

#### Step 4: Boundary Statistics

After blurring, the algorithm finds the actual min/max escape values of the **boundary region** (excluding interior points at `maxIter` and exterior points at ≤ 2):

```
for each grid cell:
    if value > 2 AND value < maxIter - 1:    // boundary region only
        update min, max, mean
```

These statistics (`gEscapeFlowMinEsc`, `gEscapeFlowMaxEsc`) are used for log-normalization of per-particle values (see section 13.5).

#### Step 5: Bilinear Interpolation

Particle positions fall between grid cells. Bilinear interpolation provides smooth sub-cell sampling:

```
function sampleEscapeGrid(x, y):
    fx = (x - bounds[0]) / (bounds[2] - bounds[0]) * 512 - 0.5
    fy = (y - bounds[1]) / (bounds[3] - bounds[1]) * 512 - 0.5
    ix, iy = floor(fx), floor(fy)
    if out of bounds: return -1    // signals "reinitialize this particle"
    tx, ty = fractional parts
    return bilinear(v00, v10, v01, v11, tx, ty)
```

#### Step 6: Flow Iteration (Per Particle, Per Frame)

Each frame, every particle at position `(x, y)` is advanced:

```
function escapeFlowIterate(x, y):
    gridPixel = max(boundsWidth, boundsHeight) / 512
    eps = gridPixel * 1.5    // finite difference step

    iterHere = sampleEscapeGrid(x, y)
    if invalid (< 2, >= maxIter-2, out of bounds):
        return randomPointInBounds()    // reinitialize

    // Central difference gradient
    gx = (sample(x+eps, y) - sample(x-eps, y)) / (2*eps)
    gy = (sample(x, y+eps) - sample(x, y-eps)) / (2*eps)

    gradMag = sqrt(gx² + gy²)
    if gradMag < 1e-8:
        return randomPointInBounds()    // flat region, reinitialize

    // Perpendicular to gradient = tangent to iso-contour
    perpX = -gy / gradMag
    perpY =  gx / gradMag

    speed = gridPixel * 0.4
    return (x + perpX * speed, y + perpY * speed)
```

**Key design decisions:**
- **No restoring force.** Earlier iterations included a force pulling particles back toward a target contour level. This caused all particles to collapse to a single thin line over time. Without it, each particle stays on its own iso-contour permanently, preserving depth and variety.
- **Speed proportional to grid pixel.** This ensures consistent visual motion regardless of zoom level — particles always move ~0.4 cells per frame.
- **Central differences for gradient.** More stable than one-sided differences; `eps = 1.5 * gridPixel` samples across roughly 3 cells for robust gradient estimation.
- **Reinitialize on invalid.** Particles that drift outside bounds, into the set interior, or into gradient-flat regions are teleported to a random valid position — no death/respawn animation.

### 14.4 Mandelbrot Zoom Regions

Unlike Julia sets (which always view the same [-2, 2] × [-2, 2] domain with different `c` parameters), the Mandelbrot set reveals different structures depending on the viewing window. PSSS includes 11 preset zoom regions:

| Preset | Region | Visual Character |
|--------|--------|-----------------|
| Full Set | [-2.5, -1.5] → [1.0, 1.5] | Complete Mandelbrot, familiar cardioid |
| Seahorse Valley | [-0.78, -0.16] → [-0.73, -0.12] | Spiraling seahorse tails |
| Elephant Valley | [0.25, -0.05] → [0.40, 0.05] | Thick elephant-trunk spirals |
| Antenna Tip | [-1.80, -0.05] → [-1.74, 0.05] | Thin spike detail |
| Double Spiral | [-0.088, 0.654] → [-0.062, 0.676] | Tight dual logarithmic spirals |
| Mini-brot | [-1.790, -0.005] → [-1.775, 0.005] | Self-similar copy of the full set |
| Needle | [-0.752, 0.038] → [-0.740, 0.048] | Fine linear filament |
| Scepter Valley | [-0.110, 0.920] → [-0.090, 0.940] | Ornate branching structures |
| Lightning | [-0.198, 1.020] → [-0.170, 1.043] | Jagged branching fractal |
| Starfish | [-0.380, 0.660] → [-0.360, 0.680] | Five-fold symmetric structure |
| Spiral Galaxy | [-0.760, 0.078] → [-0.740, 0.095] | Dense spiral arms |

When a Mandelbrot region is selected, the view automatically scales and centers to fit the region, unlike other attractors which share a fixed coordinate space.

### 14.5 Z-Depth from Escape Values

For Julia and Mandelbrot attractors, escape values provide natural Z-depth information:

```
Per particle i:
    ev = sampleEscapeGrid(ax, ay)    // raw escape value at particle position
    if ev in boundary region (between minEsc and maxEsc):
        // Log normalization against actual boundary statistics
        logMin = log(minEsc + 1)
        logMax = log(maxEsc + 1)
        logVal = log(ev + 1)
        normalizedValue = (logVal - logMin) / (logMax - logMin)    // [0, 1]

    Z-coordinate = (normalizedValue - 0.5) * canvasHeight
```

**Why log normalization?** The raw escape count distribution is heavily skewed — most boundary values cluster near `minEsc` with a long tail toward `maxEsc`. Dividing raw escape by `maxIter` (as done initially) squashes 90% of particles near Z=0 with only extreme outliers reaching depth. Log normalization stretches the distribution, producing visible depth variation across the full fractal boundary.

The Z range spans the full canvas height, so particles form a visible 3D relief when the view is rotated (the original Lissajous rotation still applies to fractal particles).

### 14.6 Color Mapping from Escape Values

In non-fractal mode, particle color oscillates based on particle index:
```
colorCoord = index * step    // angular position along the curve
```

In fractal mode, the escape value replaces the index:
```
if escape-flow active and particle has valid escape value:
    colorCoord = escapeValue * 720    // maps [0,1] escape to [0°, 720°] for color sines
```

This means particle color corresponds to its iso-contour level — producing smooth color bands that follow the fractal boundary structure. Particles on the same contour line share the same color, creating visually coherent flow ribbons.

When a Color Palette (Visual FX) is active, the escape value (0–1) directly indexes the palette gradient, overriding the sine-based color system. This works in both Canvas2D (via `getColor`) and WebGL (via `paletteCoords` uniform array).

### 14.7 TranslationMap Fade During Fractal Blend

TranslationMap is a screen-space pixel distortion — it warps the accumulated image buffer regardless of particle positions. When fractal blend increases, the TransMap progressively loses meaning (it was designed for Lissajous ribbon trails) and can distort the fractal structure in unwanted ways.

The solution: **fade TransMap proportionally to fractal blend**:

```
transMapFade = 1.0 - gFractalBlend
if transMapFade < 0.01: disable TransMap entirely
```

Implementation differs by renderer:

**WebGL:** The displacement shader interpolates between undistorted and displaced UV:
```glsl
uniform float uFade;
void main() {
    vec2 displaced = texture2D(uDisplacement, vUV).rg;
    vec2 coord = mix(vUV, displaced, uFade);    // fade from full displacement to identity
    gl_FragColor = texture2D(uFrame, coord);
}
```

**Canvas 2D:** After applying the TransMap lookup, blend the result with the pre-distortion image:
```
for each pixel p:
    dst[p] = dst[p] * transMapFade + src[p] * (1.0 - transMapFade)
```

At `blend = 0` (pure Lissajous): TransMap at full strength.
At `blend = 0.5`: TransMap at 50% — subtle warping overlaid on fractal flow.
At `blend = 1.0`: TransMap disabled — pure fractal field flow.

### 14.8 Velocity Streak Teleport Clamping

The Velocity Streaks FX computes per-particle velocity from frame-to-frame position difference. When escape-flow particles are reinitialized (teleported to a random position), the resulting velocity vector spans the entire screen — creating random bright lines across the view.

The fix is magnitude clamping:
```
vx = currentX - previousX
vy = currentY - previousY
if (vx*vx + vy*vy) > 900:    // threshold: ~30px teleport distance
    vx = 0; vy = 0           // zero velocity — no streak rendered
```

This cleanly distinguishes normal flow motion (small velocities) from teleportation artifacts (huge velocities), allowing Velocity Streaks to work correctly with fractal attractors.

### 14.9 Julia Set Parameter Presets

Julia sets are parameterized by the complex constant `c = cRe + cIm*i`. Different values produce dramatically different fractal topologies:

| Preset | c value | Character |
|--------|---------|-----------|
| Dendrite | -0.7 + 0.27015i | Tree-like branching |
| Spiral Galaxy | -0.8 + 0.156i | Spiral arms with dense core |
| Sea-Horse | 0.285 + 0.01i | Seahorse-tail spirals |
| Douady Rabbit | -0.4 + 0.6i | Three-lobed rabbit shape |
| Fractal Dust | -0.835 - 0.2321i | Disconnected Cantor dust |
| San Marco | 0.0 + 0.66i | Cathedral dome structure |
| Lightning | 0.0 - 0.66i | Jagged electrical discharge |
| Siegel Disk | -0.391 - 0.587i | Smooth spiral flow regions |
| Pinwheel | -0.1 - 0.65i | Rotating pinwheel arms |
| Snowflake | -0.1 + 0.65i | Six-fold symmetric crystal |
| Electric | -0.12 - 0.65i | Electrical arcs |
| Swirl | 0.36 + 0.36i | Dense rotating swirl |
| Firework | -0.55 - 0.55i | Explosive radial pattern |
| Neuron | 0.0 + 0.67i | Dendrite-like neural branching |
| Basilica | 0.0 - 0.67i | Gothic arch structures |

The third parameter (default 2.0) is unused but stored for UI consistency with 4-slider layout.

### 14.10 Interaction with 3D Rotation

When fractal blend > 0, the 3D rotation from the base preset still applies. The attractor-driven X/Y positions are treated as the raw 3D coordinates (with Z from escape value), then passed through the standard transform pipeline:

1. Blend wave position with attractor position
2. Apply 3D rotation (Euler angles accumulating over time)
3. Apply perspective projection

This means a Julia set with a rotating base preset will spin in 3D, revealing the Z-depth relief created by the escape value. The combination of fractal boundary structure + 3D rotation + perspective creates a compelling sense of a fractal "landscape" rather than a flat 2D rendering.

For Mandelbrot zoom regions, the view is automatically centered and scaled to fit:
```
// Center compensation
ax -= (bounds[0] + bounds[2]) * 0.5
ay -= (bounds[1] + bounds[3]) * 0.5

// Dynamic scaling to fill canvas
scaleX = canvasWidth / (boundsWidth * 1.1)
scaleY = canvasHeight / (boundsHeight * 1.1)
```

### 14.11 Export/Import of Fractal State

The preset export system preserves fractal state in a backwards-compatible format:

```json
{
  "Fractal": {
    "Type": "mandelbrot",
    "Params": [-0.5, 0, 2.5, 0],
    "Blend": 0.85,
    "Bounds": [-0.78, -0.16, -0.73, -0.12]
  }
}
```

- `Bounds` is only included when `Type === 'mandelbrot'` (Julia always uses [-2, 2]²)
- On import, if the `Fractal` object is missing, `blend` defaults to 0 (pure Lissajous)
- The escape grid is rebuilt from the imported type/params/bounds
- UI elements (sliders, dropdowns, labels) are synced via `applyVisualFxToUI()` and the fractal type change handler

---

## 15. Related Literature and Resources

### Mathematical Foundations

1. **Lissajous Curves** — https://en.wikipedia.org/wiki/Lissajous_curve
   The 2D parametric equations (`x = A sin(at + d), y = B sin(bt)`) that form the mathematical basis of PSSS's particle motion. Frequency ratios control pattern complexity.

2. **Lissajous Knots** — https://en.wikipedia.org/wiki/Lissajous_knot
   The 3D generalization directly relevant to PSSS's 3-axis wave system. Proves that projections of 3D Lissajous curves onto coordinate planes yield 2D Lissajous figures.

3. **Frequency Modulation Synthesis** — https://en.wikipedia.org/wiki/Frequency_modulation_synthesis
   Core foundation for PSSS's FM modulation. The equation `A sin(ωc*t + β*sin(ωm*t))` shows how modulating one sine's frequency with another creates complex harmonic spectra — directly analogous to how FM parameters create organic motion from simple sinusoids.

### Creative Coding References

4. **Nature of Code: Oscillation** (Daniel Shiffman) — https://natureofcode.com/oscillation/
   Practical tutorial on combining independent oscillators per axis to create Lissajous-like motion and complex patterns through additive synthesis.

5. **The Coding Train: Lissajous Curve Table** — https://thecodingtrain.com/challenges/116-lissajous-curve-table
   Visual demonstration of how frequency ratios determine curve topology. Shows the table structure where row/column indices represent frequencies.

6. **The Book of Shaders: Shaping Functions** — https://thebookofshaders.com/05/
   Explains how sin, pow, smoothstep create visual effects. Documents techniques for animating displacement fields — the shader equivalent of PSSS's TranslationMap.

### Screensaver Art and Generative Systems

7. **MilkDrop Preset Authoring Guide** (Ryan Geiss) — https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html
   The closest published analog to PSSS's TranslationMap system. Documents per-pixel warp mesh displacement and the two-pass rendering pipeline (warp shader + composite) that mirrors PSSS's approach.

8. **Electric Sheep** (Scott Draves) — https://electricsheep.org/
   Collaborative evolutionary generative screensaver. Uses genetic algorithms to evolve abstract animations. Shares PSSS's DNA as a mathematically-driven screen art system.

9. **Fractal Flames** — https://en.wikipedia.org/wiki/Fractal_flame
   The mathematical technique behind Electric Sheep: iterated function systems with log-density display and gamma correction — the same brightness-accumulation-and-decay approach PSSS uses for particle trail rendering.

10. **XScreenSaver** — https://en.wikipedia.org/wiki/XScreenSaver
    Historical context for the screensaver-as-art-platform tradition. Jamie Zawinski's 240+ "display hacks" collection since 1992.

### Flow and Displacement

11. **Flow Fields** (Tyler Hobbs, 2020) — https://tylerxhobbs.com/essays/2020/flow-fields
    Related displacement technique where mathematical functions drive per-pixel directional fields. While using Perlin noise rather than pure sinusoids, the concept of a 2D lookup grid controlling pixel displacement is architecturally identical to PSSS's TranslationMap.

12. **Processing.org Sine Wave Example** — https://processing.org/examples/sinewave.html
    Canonical minimal implementation of animated sine waves in creative coding. Shows the `theta += 0.02` phase advancement approach that parallels PSSS's `pos += waveSpeed`.

### Fractal and Attractor References

13. **Strange Attractors** — https://en.wikipedia.org/wiki/Attractor#Strange_attractor
    Foundational concept for the Clifford, De Jong, Lorenz, and Rössler attractor types in PSSS. Chaotic systems with bounded trajectories that never repeat.

14. **Clifford Attractor** (Clifford Pickover) — https://paulbourke.net/fractals/clifford/
    The iterated function `x' = sin(ay) + c*cos(ax), y' = sin(bx) + d*cos(by)` used directly in PSSS's Clifford attractor. Paul Bourke's page documents the parameter-dependent morphology.

15. **Julia Sets** — https://en.wikipedia.org/wiki/Julia_set
    The filled Julia set for `z² + c`: the mathematical foundation of PSSS's escape-time fractal rendering. The boundary (where escape time transitions) is where the most visually interesting particle flow occurs.

16. **Mandelbrot Set** — https://en.wikipedia.org/wiki/Mandelbrot_set
    The parameter space complement to Julia sets. Each point `c` in the Mandelbrot set corresponds to a connected Julia set; PSSS's zoom regions target the boundary where this connectivity transitions.

17. **Smooth Iteration Count (Douady-Hubbard Potential)** — https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Continuous_(smooth)_coloring
    The algorithm `i - log₂(log₂(|z|²)) + 4` used by PSSS to eliminate banding in escape-time computation, providing continuous fractional iteration counts for smooth gradient fields.

18. **Lorenz System** — https://en.wikipedia.org/wiki/Lorenz_system
    The 3-ODE system (σ, ρ, β) producing the butterfly attractor. PSSS integrates this with small dt, projecting 3D state to 2D while preserving Z for depth.

### Key Mathematical Concepts Summary

| PSSS Component | Mathematical Foundation | Relationship |
|---|---|---|
| 3 waves × 3 axes | Additive synthesis / Fourier decomposition | Complex shapes from simple harmonics |
| FM modulation | FM synthesis (Chowning, 1973) | Complex spectra from carrier+modulator |
| AM modulation | Amplitude envelope / ring modulation | Time-varying intensity |
| TranslationMap | Displacement mapping / flow fields | Per-pixel spatial warping |
| Brightness decay | Exponential decay / IIR filter | Temporal smoothing (motion blur) |
| Perspective projection | Pinhole camera model | 3D → 2D with depth cues |
| Multiple particles on curve | Uniform sampling of parametric domain | Curve visualization via point cloud |
| Clifford/De Jong attractors | Iterated function systems | Discrete chaotic maps → fractal dust |
| Lorenz/Rössler/Thomas | Continuous ODE integration | 3D chaotic trajectories |
| Julia/Mandelbrot flow | Escape-time field gradient | Iso-contour following in scalar field |
| Fractal blend | Linear interpolation of position vectors | Smooth transition between paradigms |
| Smooth escape count | Douady-Hubbard potential | Banding-free fractional iteration |
| Log normalization | Logarithmic rescaling of skewed distributions | Uniform depth/color from exponential data |

---

## Appendix: Quick Reference Card

```
THE PSSS EQUATION (per particle, per axis, per frame):

    position[axis] = Σ(w=0..2) sin((index*step + phase_w) * FM_w(time)) * AM_w(time)

    where:
        step = 360° / particleCount
        AM_w(time) = am.base + sin(time * am.freq / DEG) * am.amp
        FM_w(time) = (fm.base + sin(time * fm.freq / DEG) * fm.amp) / DEG
        time += waveSpeed * speedFactor * correction    (each frame)

    Then: rotate → translate → project → render → decay → distort


THE FRACTAL BLEND (per particle, per frame):

    wavePos = standard Lissajous computation above
    attPos  = attractor iteration (type-dependent)
    finalPos = (1 - blend) * wavePos + blend * attPos

    For escape-time fractals (Julia/Mandelbrot):
        attPos = escapeFlowIterate(currentPos)     // follow iso-contours
        Z      = logNormalize(escapeValue) * height // depth from escape time
        color  = escapeValue * 720                  // color from escape time

    TransMap fades as:  transMapFade = 1.0 - fractalBlend
```

The extraordinary visual richness — from flowing alien DNA helices to pulsing quantum clouds to fractal boundary rivers — emerges from varying the ~30 Lissajous parameters, 10 attractor types with their own parameter spaces, and the continuous blend between these two worlds.
