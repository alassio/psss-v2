import type { Renderer, GeneratorState, ComputeBackend, GPUTarget,  RendererConfig, RenderMode } from '../core/interfaces.ts';
import { compileProgram } from '../core/gl-program.ts';
import type { WebGL2Backend } from '../core/compute-backend.ts';
import type {
  MaterialConfig, VolumeRenderConfig, CrystalRenderConfig,
  LiquidSurfaceConfig, ColourRampName,
} from '../presets/types.ts';
import { getPaletteLUT } from '../presets/palettes.ts';
import { getColourRampData } from '../generators/colour-ramps.ts';
import { DEFAULT_LIQUID_CONFIG } from '../generators/material-presets.ts';
import { crystalShapeToIndex, crystalSizeFor, MAX_GROWTH_CEILING } from '../crystal/crystal-config.ts';
import {
  LIQUID_REF_TAU_SECONDS, LIQUID_THICKNESS_DEPTH,
  REFRACT_SPREAD, SPEC_EXPONENT, FRESNEL_EXPONENT, ABSORB_SCALE, DYE_SATURATION_K, DYE_HUE_GLSL, glslFloat,
  liquidDensityReference, measureIndexSpacing, smoothLiquidReference,
} from './liquid-reference.ts';

const VERT_SRC = `#version 300 es
precision highp float;
precision highp int;
in vec2 aPosition;
in vec3 aColor;
in float aDepth;
in float aVelocity;
in float aPointTemp;   // B14: temperature, so a film-look palette can be indexed by material heat
in float aPointAge;    // per-particle lifetime seconds, for palette mapping 5 (age)
/*
 * v8 31.2 (E112/E113/E137) -- the PACKED per-particle appearance channels: x = size, y = alpha,
 * z = lightness, each a MULTIPLIER whose neutral value is 1.0.
 *
 * NO BACKTICKS IN THIS COMMENT (invariant 18) -- one terminates the template literal and tsc then
 * reports the error at a column inside the GLSL rather than at the cause. It bit three times in
 * Phase 30.
 *
 * ONE vec3 RATHER THAN THREE FLOATS (31.D3): one buffer, one upload per pass, one invariant-6
 * obligation. ⚠️ The buffer is uploaded on EVERY frame whether the feature is on or not, with a
 * neutral all-ones pad when the generator publishes nothing -- an enabled attribute with no bound
 * data reads undefined values, which on some drivers is stale GPU memory rather than zero, and a
 * stale 0 here would mean an invisible figure rather than a wrong one.
 */
in vec3 aChannels;
uniform vec2 uResolution;
uniform float uGlow;
uniform float uDepthSize;
uniform float uDepthBrightness;
uniform float uDepthDof;
uniform int uRenderMode;
// Global particle size multiplier (overlay.particleSize). 1.0 = the historical hardcoded size.
uniform float uParticleSize;
// gl.ALIASED_POINT_SIZE_RANGE[1]. The hardware clamps gl_PointSize anyway; doing it here explicitly is
// what lets the UI print an honest pixel estimate beside the multiplier instead of a number the driver
// silently discards.
uniform float uMaxPointSize;
out vec3 vColor;
out float vDepth;
out float vVelocity;
out float vSize;
out float vPointTemp;
out float vPointPos;   // spatial field, mapping 4
out float vPointAge;   // cyclic age, mapping 5
out vec2 vChanAL;      // 31.2: the alpha and lightness multipliers, forwarded; size is applied here
/*
 * v8 28.5 (28.D9) -- the CURVE CULL. uHideBelowIndex is state.waveCount when the dye is drawing and the
 * preset asks for no figure, and 0 otherwise (0 is the identity: no index is < 0, so the branch is a
 * no-op and every pre-28 preset is byte-identical).
 *
 * ONE RULE IN TWO SHADERS, and SPLAT_VERT_SRC carries the identical branch against gl_InstanceID.
 * The asymmetry is forced rather than chosen: the point paths draw gl.drawArrays(POINTS, 0, solidCount)
 * and COULD have taken a first offset, but the splat path is gl.drawArraysInstanced(..., state.count)
 * and WebGL2 HAS NO baseInstance, so gl_InstanceID always starts at 0 and that path cannot be offset at
 * all. Offsetting one path and culling in the other is two mechanisms for one rule, which is exactly how
 * the two come to disagree -- so both cull.
 */
uniform int uHideBelowIndex;
void main() {
  // The degenerate position is OUTSIDE the clip volume on every axis, so the primitive is discarded before
  // rasterisation. Returning early rather than setting gl_PointSize to 0: a 0-size point is
  // implementation-defined on some drivers, while a clipped vertex is specified.
  if (gl_VertexID < uHideBelowIndex) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec2 ndc = (aPosition / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  float scaleFactor = (uResolution.x + uResolution.y) / (1024.0 + 768.0);
  float baseSize = (uRenderMode == 2) ? 5.0 : 3.0;
  float size = max(baseSize, baseSize * scaleFactor);

  // Global size multiplier, applied BEFORE the depth terms so the depth terms keep scaling the size
  // the user actually sees. (After them it would be identical arithmetically — both are multiplies —
  // but the clamp below is not, so the order fixes what the clamp truncates.)
  size *= uParticleSize;

  /*
   * v8 31.2 -- the PER-PARTICLE size multiplier, applied at exactly the same point as the global one and
   * for the same reason: everything downstream (both depth terms and the clamp) must keep scaling the
   * size the user actually sees.
   *
   * ⚠️ THE CLAMP BELOW IS WHAT MAKES THIS SAFE AND ALSO WHAT MAKES estimateParticlePixels() OWE A
   * MIRROR (31.D11): the driver's own gl_PointSize ceiling truncates the result, so a per-particle size
   * the estimator could not see would make the perf guard read a huge particle as a small one.
   */
  size *= aChannels.x;

  // Depth-aware size (near=large, far=small)
  if (uDepthSize > 0.0) {
    size *= 1.0 + uDepthSize * (1.0 - aDepth);
  }

  // Depth-of-field: out-of-focus particles get larger (softer)
  if (uDepthDof > 0.0) {
    float focusDepth = 0.5;
    float dofBlur = abs(aDepth - focusDepth) * uDepthDof;
    size *= 1.0 + dofBlur * 2.0;
  }

  size = clamp(size, 1.0, uMaxPointSize);
  gl_PointSize = size;
  vSize = size;
  vColor = aColor;
  vDepth = aDepth;
  vVelocity = aVelocity;
  vPointTemp = aPointTemp;
  // Mapping 4 (position): the SAME dual-axis field heatMode 'position' uses, so the two controls agree on
  // what "position" means. Model-space pixels, not NDC, for that reason.
  vPointPos = (sin(aPosition.x * 0.003) * 0.5 + 0.5) * (cos(aPosition.y * 0.004) * 0.5 + 0.5);
  // Mapping 5 (age): the same staggered 6-second cycle as heatMode 'age'.
  vPointAge = fract(aPointAge / 6.0);
  vChanAL = aChannels.yz;
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
precision highp int;
in vec3 vColor;
in float vDepth;
in float vVelocity;
in float vSize;
in float vPointTemp;   // B14: per-particle temperature, for uPaletteMapping == 3
in float vPointPos;    // spatial field, mapping 4
in float vPointAge;    // cyclic age, mapping 5
in vec2 vChanAL;       // 31.2: x = alpha multiplier, y = lightness multiplier. Neutral is (1, 1).
uniform float uGlow;
uniform float uDepthBrightness;
uniform float uDepthColorShift;
uniform int uRenderMode;
uniform int uLightingMode;
uniform vec3 uLightDir;
uniform float uRimPower;
uniform sampler2D uPaletteTex;
uniform int uPaletteEnabled;
// v8 26.4 — the hue rotation, as a sampling offset into the palette LUT, in TURNS. 0 = identity.
uniform float uPaletteHueShift;
uniform int uPaletteMapping; // 0=depth, 1=phase (vColor luminance), 2=velocity, 3=temperature
out vec4 fragColor;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float r = length(pc) * 2.0;
  float shape;

  if (uRenderMode == 2) {
    // Star / cross pattern, with uGlow driving the arm GEOMETRY (triage B11).
    //
    // Two revisions, and the first was not enough:
    //
    // v0 (original): this branch returned before ever reading uGlow, so glow -- and with it most of a film
    // look's character -- did nothing at all in star mode. Since modeInt maps everything except
    // pixel/blend to 2, star is the DEFAULT, so the 2026-08-06 re-authoring of all 14
    // FILM_LOOKS glow values was invisible in the mode most presets actually use.
    //
    // v1: raised the radial fade to an exponent, arm * pow(radial, 4/uGlow). Mathematically responsive but
    // VISUALLY NEGLIGIBLE, and reported as such: "B11 doesn't really show a difference". The reason is that
    // it only reshapes the profile INSIDE a fixed footprint -- the arm mask and the r=1 cutoff are both
    // untouched, so the cross keeps exactly the same size and thickness. A star sprite is only ~8 px at
    // 1920x1080 (baseSize 5.0 * scaleFactor 1.67), so Cinematic-vs-Legacy came to a max per-pixel change of
    // 0.073, spread over a handful of already-dim outer pixels. Additive accumulation buries that.
    //
    // v2 (this): glow scales the arm HALF-WIDTH as well, which changes the cross's actual geometry rather
    // than just its shading. Same case now moves 0.167 max per pixel and 0.709x total energy -- an
    // order-of-magnitude better signal. 0.18 is the historical half-width and the factor is glow/4, so
    // Legacy (glow 4.0) is armW = 0.18 exactly: still byte-identical to v0 for all 177 legacy presets,
    // verified over a 121x121 grid.
    //
    // Bound: cross_d = min(|x|,|y|) <= 0.5, so once armW approaches ~0.35 the mask lights most of the quad
    // and the cross stops reading as a cross. The shipped glow range tops out at Overexposed = 7.0, giving
    // armW 0.315 (82% of the quad) -- inside the bound, so no clamp is needed. ANY future film look with
    // glow above ~8 would need one.
    //
    // Direction matches the sphere path below: HIGHER uGlow = thicker, softer arms.
    float cross_d = min(abs(pc.x), abs(pc.y));
    float gStar = (uGlow > 0.0) ? uGlow : 4.0;
    float armW = 0.18 * (gStar / 4.0);
    float arm = 1.0 - smoothstep(0.0, armW, cross_d);
    float radial = 1.0 - smoothstep(0.3, 1.0, r);
    shape = arm * pow(radial, 4.0 / gStar);
  } else {
    // Soft sphere. HIGHER uGlow = MORE glow (bigger, softer halo).
    //
    // This was pow(falloff, uGlow) until 2026-08-06, which is INVERTED: falloff is in [0,1], so a
    // higher exponent makes it SMALLER. uGlow was therefore a falloff-SHARPNESS control wearing the name
    // "glow" — raising it tightened the particle to a hard dot. Measured halo radius went 0.99 at
    // uGlow 0.4 down to 0.41 at uGlow 10. Every film look was affected, backwards from its own name:
    // Void ("near-black, minimal") had the WIDEST halo and Overexposed the narrowest.
    //
    // Dividing inverts the sense. The 8.0 numerator keeps a wide usable spread — plain 1.0/uGlow
    // saturates, with everything above ~1.5 rendering identically. The 14 stored FILM_LOOKS values were
    // remapped by new = 8 / old in the same commit, so every named look renders EXACTLY as before;
    // only the direction of the control changed.
    if (uGlow > 0.0) {
      float falloff = 1.0 - smoothstep(0.0, 1.0, r);
      shape = pow(falloff, 8.0 / uGlow);
    } else {
      shape = (r < 0.7) ? 1.0 : 0.0;
    }
  }
  if (shape < 0.01) discard;

  vec3 color = vColor;

  // Palette remapping
  if (uPaletteEnabled == 1) {
    float palCoord;
    if (uPaletteMapping == 0) {
      palCoord = vDepth;
    } else if (uPaletteMapping == 1) {
      palCoord = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
    } else if (uPaletteMapping == 3) {
      // B14: material heat drives the palette coordinate. Requires an active material -- the CPU side
      // falls back to velocity when there is none, because temperatures[] would be all-zero and every
      // particle would sample index 0 (one flat colour).
      palCoord = vPointTemp;
    } else if (uPaletteMapping == 4) {
      palCoord = vPointPos;
    } else if (uPaletteMapping == 5) {
      palCoord = vPointAge;
    } else {
      palCoord = vVelocity;
    }
    // v8 26.4: rotate the palette by sampling it from a different place. fract of a negative is
    // POSITIVE in GLSL (x - floor(x)), so a leftward rotation wraps correctly with no branch.
    // ZERO MUST BE BYTE-IDENTICAL: the sampler is CLAMP_TO_EDGE and the CPU ribbon/neon path clamps to
    // reproduce it, so an unconditional fract() would change the top edge (fract(1.0) == 0.0) on every
    // palette preset even with no rotation. The branch keeps the identity exact and wraps only when a
    // rotation is actually asked for.
    float palC = uPaletteHueShift == 0.0 ? palCoord : fract(palCoord + uPaletteHueShift);
    color = texture(uPaletteTex, vec2(palC, 0.5)).rgb;
  }

  // Depth-based brightness (atmospheric extinction)
  float brightness = 1.0;
  if (uDepthBrightness > 0.0) {
    brightness = mix(1.0, 0.2, (1.0 - vDepth) * uDepthBrightness);
  }

  // Depth-based colour temperature shift (warm near, cool far)
  if (uDepthColorShift > 0.0) {
    float t = (1.0 - vDepth) * uDepthColorShift;
    color.r *= 1.0 + t * 0.1;
    color.b *= 1.0 + t * 0.2;
    color.g *= 1.0 - t * 0.05;
  }

  // Fake lighting on soft sphere
  float lighting = 1.0;
  if (uLightingMode > 0 && r < 1.0) {
    // Reconstruct sphere normal from point coord
    float z = sqrt(max(0.0, 1.0 - pc.x*pc.x*4.0 - pc.y*pc.y*4.0));
    vec3 normal = normalize(vec3(pc.x * 2.0, pc.y * 2.0, z));

    if (uLightingMode == 1 || uLightingMode == 3) {
      // Directional light
      float ndotl = max(0.0, dot(normal, normalize(uLightDir)));
      lighting = 0.3 + 0.7 * ndotl;
    }
    if (uLightingMode == 2 || uLightingMode == 3) {
      // Rim lighting
      float rim = pow(1.0 - max(0.0, normal.z), uRimPower);
      lighting += rim * 0.5;
    }
  }

  /*
   * v8 31.2 (E112/E113) -- the per-particle ALPHA and LIGHTNESS.
   *
   * ⚠️ PREMULTIPLICATION IS THE WHOLE TRAP HERE (invariant 9). This output is premultiplied: rgb
   * carries tintxalpha and the alpha channel carries alpha. So the multiplier has to be folded into ONE
   * value that both halves then read -- applying it to the alpha channel alone would leave rgb
   * unscaled, and the error distorts the FALLOFF rather than dimming the particle, which reads as a
   * halo and not as a mistake.
   *
   * ⚠️ THE CLAMP IS A NO-OP AT THE IDENTITY, which is what keeps this byte-identical with the
   * feature off: shape is already in [0, 1] on both branches above, so clamp(shape * 1.0) == shape.
   *
   * Lightness multiplies the RESOLVED colour, after the palette/ramp/preset precedence chain has
   * chosen a winner (31.D12) -- a channel that joined that chain would be a sixth colour source and
   * would fight the palette; modulating the winner is a modulation of whatever won.
   */
  float chanA = clamp(shape * vChanAL.x, 0.0, 1.0);
  fragColor = vec4(color * vChanAL.y * chanA * brightness * lighting, chanA);
}`;

const SPLAT_VERT_SRC = `#version 300 es
precision highp float;

// Per-vertex (quad template)
in vec2 aQuadPos;       // [-1,1] template positions

// Per-instance (particle data, divisor=1)
in vec2 aPosition;      // screen-space center
in float aTemperature;
in float aDepth;
in vec2 aVelocityDir;   // normalized velocity direction -- UNIT LENGTH, carries no speed
in float aSplatVelocity; // normalised SPEED [0,1], for palette mapping 2 (B14 follow-up)
in vec3 aColorSplat;     // the preset's own oscillating colour, for palette mapping 1 (phase)
in float aSplatAge;      // lifetime seconds, for palette mapping 5 (age)
in float aFrozen;       // v8 Phase 8a: 1.0 = frozen (crystal), 0.0 = live
in float aGrowth;       // v8 Phase 8a-2: crystal growth 0→1→0. Live particles are always 1.0.
// v8 31.2 -- the SECOND copy of the packed channel attribute, read by this program as VERT_SRC reads
// its own. x = size, y = alpha, z = lightness; neutral is 1.0. See VERT_SRC's declaration for why it
// is one vec3 and why it is uploaded unconditionally. NO BACKTICKS HERE EITHER (invariant 18).
in vec3 aSplatChannels;

uniform vec2 uResolution;
uniform float uSplatRadius;
uniform float uDepthSize;
uniform float uDepthDof;
uniform vec4 uFlameParams;  // x=expansion, y=velocityStretch, z=taperStrength, w=aspectBias
// v8 Phase 8a-2 increment (c): swelling ceiling for the crystal pass. 1.0 = no swelling.
uniform float uMaxGrowth;
// 27.6 — the shear convention. 0 = cross-axis from the path tangent, which is the pre-27.6 behaviour
// byte for byte; 1 = a fixed global cross-axis. See the derivation at the perp line below.
uniform float uSplatShearFixed;
/**
 * Global particle size multiplier (overlay.particleSize).
 *
 * ⚠️ A SEPARATE uniform rather than a pre-multiplied uSplatRadius, and that is load-bearing: the crystal
 * branch below derives crystalSize from the SAME baseSize, so folding the multiplier into uSplatRadius
 * would scale crystals too and make the Crystal Size slider's own readout wrong. renderCrystalOnly sets
 * this to 1.0 — the same neutral-reset pattern uMaxGrowth uses in the opposite direction.
 */
uniform float uParticleSize;
/**
 * Spark size override, consumed by INDEX rather than by a per-instance attribute.
 *
 * NO BACKTICKS IN THIS COMMENT (invariant 18) — one terminates the template literal and tsc reports the
 * error at a column inside the GLSL rather than at the cause. It cost a failed typecheck writing this note.
 *
 * uSparkRadius < 0.0 means "no spark override" and is the neutral state: the branch below is then
 * unreachable and every instance takes uSplatRadius, byte-identical to the pre-2026-08-29 code. It is
 * also unreachable whenever the spark range is EMPTY (uSparkFirst == uSparkLast), which is the case for
 * every preset with sparks disabled.
 *
 * ⚠️ The canonical slot order is [wave][sparks][liquid][crystals], so a spark is exactly
 * uSparkFirst <= id < uSparkLast. Both bounds come from the generator's published
 * waveCount/liquidCount/crystalCount partition — do NOT re-derive them from state.count here, because BOTH
 * trailing blocks change length every frame (crystals nucleate and melt, the pool follows Pool Size), so
 * the spark range's UPPER bound moves with both of them.
 *
 * ⚠️ v8 15.5: sparks are now a MIDDLE block, so uSparkLast must subtract the liquid block as well. Miss it
 * and every pool particle draws at the spark radius — 2-4 px authored against a material's 3-14 px — and
 * silently inherits the Spark Size control. See the CPU-side derivation for the general rule.
 *
 * ⚠️ Sparks are NEVER crystals (frozen is 0 across the whole spark range by construction), so this
 * override cannot collide with the crystal branch's own baseSize derivation further down.
 */
uniform float uSparkRadius;
uniform int uSparkFirst;
uniform int uSparkLast;

out float vTemperature;
out float vDepth;
out float vSplatVelocity;   // B14 follow-up: normalised speed, so mapping 2 differs from mapping 3
out vec3 vSplatColor;       // the PRESET's own colour, so mapping 1 (phase) has a real source
out float vSplatPos;        // spatial field, mapping 4
out float vSplatAge;        // cyclic age, mapping 5
out vec2 vLocalUV;
out float vFrozen;
out float vGrowth;      // v8 Phase 8a-2: forwarded so the crystal pass can also fade the alpha
out float vFacetAngle;  // quantised facet orientation, radians
out vec3 vTilt;         // 8a-5: xy = tilt axis, z = foreshortening amount (1 = face-on)
out float vEnergyScale; // 27.2: 1 / (the quad's area ratio against its unstretched self)
out vec2 vSplatChanAL;  // 31.2: alpha and lightness multipliers; the size is applied in this stage

// v8 28.5 (28.D9) -- the CURVE CULL, the SECOND of the two copies of one rule. See VERT_SRC's header for
// why both shaders carry it instead of this path taking a draw offset: WebGL2 has no baseInstance.
uniform int uHideBelowIndex;

void main() {
  // Degenerate clip position for a hidden curve instance. The quad is four vertices of ONE instance, so
  // collapsing gl_Position here removes the whole splat; no per-vertex work below is reached.
  if (gl_InstanceID < uHideBelowIndex) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float scaleFactor = (uResolution.x + uResolution.y) / (1024.0 + 768.0);
  // A spark draws at its OWN authored radius (sparks.splatRadius) rather than the material's. Selected by
  // slot index against the published [wave][sparks][liquid][crystals] partition — see uSparkRadius for why this is
  // not a per-instance attribute. Everything downstream (canvas scaling, the global multiplier, depth size,
  // DoF, flame aspect) then applies identically, so a spark is a SMALLER splat and not a special case.
  float radius = uSplatRadius;
  if (uSparkRadius >= 0.0 && gl_InstanceID >= uSparkFirst && gl_InstanceID < uSparkLast) {
    radius = uSparkRadius;
  }
  float baseSize = radius * scaleFactor * uParticleSize;

  /*
   * v8 31.2 -- the per-particle size, at the same point as the global multiplier.
   *
   * ⚠️ IT IS NOT ENERGY-COMPENSATED, AND THAT IS CORRECT RATHER THAN AN OVERSIGHT. 27.2's
   * vEnergyScale is 1/(widthBoost^2 * aspect) -- a ratio of STRETCH terms that does not contain
   * baseSize at all -- so a uniform per-particle scale leaves it untouched, exactly as uParticleSize
   * does. 30.D14's correction applies directly: a density change from a size change reaches the eye as
   * brightness and normalising it away would be normalising the feature away.
   */
  baseSize *= aSplatChannels.x;

  // Depth-aware sizing
  if (uDepthSize > 0.0) {
    baseSize *= 1.0 + uDepthSize * (1.0 - aDepth);
  }

  // Depth-of-field: out-of-focus particles get larger (softer). Same formula as the point path — it was
  // missing here, so Depth DoF was a control that moved nothing in Splat and Volume mode (invariant 13).
  if (uDepthDof > 0.0) {
    float dofBlur = abs(aDepth - 0.5) * uDepthDof;
    baseSize *= 1.0 + dofBlur * 2.0;
  }

  // Temperature-dependent aspect ratio
  float expansion = uFlameParams.x;
  float velocityStretch = uFlameParams.y;
  float taperStrength = uFlameParams.z;
  float blend = clamp(velocityStretch, 0.0, 1.0);

  // Flame expansion: cooler particles expand (scaled by blend)
  float coolness = 1.0 - aTemperature;
  float sizeMultiplier = 1.0 + expansion * coolness * coolness * blend;

  // Aspect ratio: smoothly interpolate from 1.0 (circular) toward flame aspect.
  //
  // M3: speed comes from aSplatVelocity, NOT from length(aVelocityDir).
  //
  // aVelocityDir is NORMALISED by the generator (lissajous.ts: sx /= sLen), so length() was always
  // exactly 1.0 and this expression collapsed to a step function of TEMPERATURE alone -- a fast
  // particle and a slow one at the same temperature received identical elongation. The control
  // named "velocity stretch" therefore did not track velocity at all.
  //
  // Same trap CLAUDE.md already records for the B14 palette mapping (aVelocityDir cannot serve
  // velocity, because length() is always 1). That was fixed for COLOUR by adding aSplatVelocity;
  // the SHAPE path was missed at the time and kept reading the unit vector.
  float flameAspect = 1.0;
  float speed = aSplatVelocity;
  if (aTemperature > 0.8) {
    flameAspect = 1.0 + speed * 0.3;
  } else if (aTemperature > 0.3) {
    flameAspect = 1.5 + speed * 1.2;
  }
  float aspect = mix(1.0, flameAspect, blend);

  // Widen perpendicular extent when stretched to maintain lateral overlap
  float widthBoost = 1.0 + blend * 0.5;
  float width = baseSize * sizeMultiplier * widthBoost;
  float height = width * aspect;

  /*
   * 27.2 — ENERGY NORMALISATION. The factor is computed HERE and applied in the fragment stage.
   *
   * Barr 1984: the determinant of the Jacobian is the local volume ratio. For an additively
   * accumulating renderer that makes luminance scale as 1/det J, so a quad that grows deposits more
   * light for the same particle. Measured before this step: at full stretch the quad grows by
   * widthBoost (1.5) in BOTH axes and then by aspect again in height, with nothing dividing the
   * intensity -- so a fast particle read as swelling and brightening rather than as moving fast,
   * which is exactly what Lasseter 1987 predicts for a stretch that does not conserve volume.
   *
   * The reference is the unstretched quad: at blend == 0, widthBoost == 1 and aspect == 1. So the
   * area ratio is widthBoost * widthBoost * aspect -- widthBoost twice because it scales width AND,
   * through width, height.
   *
   * WHAT IS DELIBERATELY NOT COMPENSATED, each for a stated reason:
   *
   * - taperFactor. It varies WITHIN the quad rather than scaling it, so it is not a single ratio.
   *   Folding an average into this term would be an approximation pretending to be an identity.
   *   The residual belongs in the measurement, not in this expression.
   * - The fragment falloff profile. Deposited light is the integral of the shape over the quad, not
   *   the quad's area, so this factor is the correct FORM and its constant is empirical. Calibrate
   *   against the final 8-bit output on a low-accumulation preset; do not derive it here.
   *
   * THE WIDENING IS KEPT. Its own comment above says why -- lateral overlap, i.e. streak continuity.
   * Removing it would trade a mass-reading artefact for a beading one. Two correct goals were in
   * tension and energy normalisation is what satisfies both.
   */
  vEnergyScale = 1.0 / max(1e-4, widthBoost * widthBoost * aspect);
  vSplatChanAL = aSplatChannels.yz;

  // Taper: smoothly blend in taper as velocityStretch increases
  float taperFactor = 1.0;
  if (taperStrength > 0.0) {
    float yNorm = aQuadPos.y * 0.5 + 0.5; // 0=base, 1=tip
    float fullTaper = mix(1.0, 0.3, yNorm * taperStrength);
    taperFactor = mix(1.0, fullTaper, blend);
  }

  // Local quad position with taper
  vec2 localPos = vec2(aQuadPos.x * width * 0.5 * taperFactor, aQuadPos.y * height * 0.5);

  // Rotation: smoothly blend between upward (no rotation) and velocity-aligned
  vec2 velDir = (length(aVelocityDir) > 0.01) ? normalize(aVelocityDir) : vec2(0.0, -1.0);
  // NO BACKTICKS IN THIS COMMENT (invariant 18): one terminates the template literal and tsc reports the
  // error far from here. It cost a failed verify writing this very note.
  //
  // ⚠️ **mix here can be EXACTLY the zero vector, and normalize(vec2(0.0)) is 0/0 -> NaN.** The guard on
  // velDir above does not cover it: the singularity is in the INTERPOLATION, not the input.
  //
  // mix((0,-1), velDir, b) == 0 requires velDir == (0, (1-b)/b), and velDir is unit length, so
  // (1-b)/b == 1 -- i.e. **blend exactly 0.5 with velDir exactly (0,+1)**. Both halves are reachable:
  // velocityStretch is 0.5 in the shipped Smoke material (every other material is 0.25/0.3/0.8/0.85/1.0,
  // measured), and a particle whose frame displacement is (0, dy) normalises to exactly (0,1) -- dx == 0 gives
  // nx == 0 with no rounding -- which the direction EMA in lissajous.ts then assigns VERBATIM on the first
  // frame (its prevX == 0 && prevY == 0 branch).
  //
  // A NaN here is not a local artefact: it flows into gl_Position, so the whole quad is discarded, and via
  // the additive draw into the trail buffer -- where the fade pass MULTIPLIES and can never remove it. The
  // decay blit's sanitiseTrail() is the backstop; this is the source fix.
  //
  // The fallback is the un-stretched upward direction, which is what blend 0 means, so a particle in the
  // singular configuration reads as "not velocity-aligned" for that frame rather than vanishing.
  vec2 dirRaw = mix(vec2(0.0, -1.0), velDir, blend);
  vec2 dir = (length(dirRaw) > 1e-5) ? normalize(dirRaw) : vec2(0.0, -1.0);
  /*
   * 27.6 — the SHEAR CONVENTION. Two of them, and only this pair of lines differs.
   *
   * uSplatShearFixed == 0 (default, and the pre-27.6 behaviour byte for byte): the quad's cross-axis is
   * the PATH TANGENT's perpendicular, so the mark keeps a constant apparent width whichever way the
   * particle travels. Hsu, Lee and Wiseman call this the RIBBON style.
   *
   * uSplatShearFixed == 1: the cross-axis is a FIXED global direction, so apparent width varies with
   * the direction of travel -- wide across the motion, narrow along it. They call this the SAUSAGE
   * style and describe the look as "drawn with a flat nibbed pen". Skeletal Strokes, UIST 1993.
   *
   * The VALUES are named 'tangent' and 'fixed' rather than 'ribbon' and 'sausage' deliberately:
   * ribbonMode is already a DIFFERENT feature in OverlayState (ribbons and lines, 178 presets), and a
   * second meaning for the word would be the name trap this project keeps paying for. The source terms
   * are recorded here instead, where they cost nothing.
   *
   * dir is still the one that carries the stretch, so the long axis is unchanged in both conventions.
   */
  vec2 perp = (uSplatShearFixed > 0.5) ? vec2(1.0, 0.0) : vec2(-dir.y, dir.x);
  vec2 rotated = perp * localPos.x + dir * localPos.y;

  // v8 Phase 8a: a frozen crystal is a rigid unstretched quad — no flame aspect, no taper,
  // no velocity alignment. Ice does not stream.
  //
  // v8 Phase 8a-2 (T021/RF-04): the quad also scales with aGrowth, so a nucleating crystal
  // physically grows into place and a melting one shrinks away.
  //
  // T030 (increment c): the clamp's upper bound is now uMaxGrowth, so a SWOLLEN crystal (growth up
  // to MAX_GROWTH_CEILING) actually gets a bigger quad. The max(1.0, uMaxGrowth) floor matters
  // because a uniform that was never explicitly set reads as 0.0, which would collapse every crystal
  // to zero size -- the floor makes an unset uniform behave exactly as the pre-swelling code did.
  //
  // RADIUS and ALPHA are DECOUPLED here (vGrowth below clamps at 1.0). Swelling must make a crystal
  // LARGER, not MORE OPAQUE: uIceOpacity is the user's single opacity control, and letting growth
  // 1.8 multiply alpha would silently drive a low Ice Opacity setting to full opacity as a crystal
  // swells.
  float growthScale = 1.0;
  if (aFrozen > 0.5) {
    growthScale = clamp(aGrowth, 0.0, max(1.0, uMaxGrowth));
    float crystalSize = baseSize * growthScale;
    vec2 crystalPos = vec2(aQuadPos.x * crystalSize * 0.5, aQuadPos.y * crystalSize * 0.5);

    // 8a-5: per-crystal 3D TILT. Foreshortens the quad along one axis as if the crystal were
    // rotated out of the screen plane, so silhouettes genuinely vary (a tilted hexagon reads as a
    // lozenge) without extra instances or a second draw call.
    //
    // Seeded from the BIRTH velocity direction, which the pool writes once at nucleation and never
    // rewrites, and whose slot index is stable. A per-frame or position-derived seed would make the
    // pose flicker every frame; a hash of gl_InstanceID would be worse still, because the crystal
    // pass DEPTH-SORTS, so a crystal's instance id changes as it moves through the sort order.
    float tiltSeed = fract(sin(dot(aVelocityDir, vec2(12.9898, 78.233))) * 43758.5453);
    // Keep some crystals near face-on: pure uniform tilt makes the whole population look squashed.
    float tiltAmt = 0.35 + 0.5 * tiltSeed;                 // 0.35 .. 0.85 foreshortening
    float tiltAxis = tiltSeed * 6.2831853;                  // which way it leans
    vec2 ta = vec2(cos(tiltAxis), sin(tiltAxis));
    // Squash along ta, leave the perpendicular axis intact: a pure orthographic tilt.
    float along = dot(crystalPos, ta);
    crystalPos -= ta * along * (1.0 - tiltAmt);

    rotated = crystalPos;
    vTilt = vec3(ta, tiltAmt);
    /*
     * 27.2 — THE CRYSTAL PAYS NO ENERGY COMPENSATION, because it received no stretch.
     *
     * ⚠️ Found 2026-10-19 while documenting 27.6, and it was a defect in 27.2's own first build.
     * vEnergyScale is assigned ~90 lines above from widthBoost and aspect, which is correct for a
     * stretched splat: that quad really was scaled by both. THIS branch then throws the stretched
     * quad away -- crystalSize is baseSize * growthScale, with no sizeMultiplier, no widthBoost
     * and no aspect ("a frozen crystal is a rigid unstretched quad", 8a) -- so without this line a
     * crystal is divided by an area ratio describing a quad it never had.
     *
     * ⚠️ NO BACKTICKS ANYWHERE IN THIS COMMENT, and that is invariant 18, not a style choice. The
     * first draft of this block quoted field names the way the TS comments do and TERMINATED THE
     * TEMPLATE LITERAL mid-shader. splatcheck caught it as a missing override 40 lines away.
     *
     * The magnitude is not marginal and the configuration is not exotic: several materials author
     * additive blending with velocityStretch 0.8-1.0, and at blend 1 with a warm particle
     * moving at unit speed the ratio is 1.5^2 * 2.7 ~= 6. Crystals would have rendered at a sixth
     * of their intensity *only when the material stretches*, which reads as a crystal-opacity bug.
     *
     * Same shape as the uMaxGrowth reset below the uniform writes (T030): the splat PROGRAM is
     * shared with the crystal pass, so anything the live path computes must be overridden here
     * rather than assumed. The uniform could not carry this -- it is per-INSTANCE, not per-draw.
     */
    vEnergyScale = 1.0;
    /*
     * v8 31.2 -- NEUTRALISED here for vEnergyScale's reason exactly: the frozen branch REBUILDS the quad,
     * so every per-INSTANCE value the live path derived must be re-set in this branch rather than
     * assumed. The generator already publishes (1, 1, 1) for every crystal slot, so this is belt and
     * braces -- but a per-instance value cannot be carried by a uniform, and this program is SHARED.
     */
    vSplatChanAL = vec2(1.0);
  }

  // Final screen position
  vec2 screenPos = aPosition + rotated;
  vec2 ndc = (screenPos / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);

  vTemperature = aTemperature;

  vSplatVelocity = aSplatVelocity;

  vSplatColor = aColorSplat;
  // Same formulas as the point path and as heatMode, so all three agree on position and age.
  vSplatPos = (sin(aPosition.x * 0.003) * 0.5 + 0.5) * (cos(aPosition.y * 0.004) * 0.5 + 0.5);
  vSplatAge = fract(aSplatAge / 6.0);
  vDepth = aDepth;
  vLocalUV = aQuadPos;
  vFrozen = aFrozen;
  // Alpha term only — capped at 1.0 so swelling never brightens. See the growthScale comment.
  vGrowth = min(growthScale, 1.0);

  // Facet orientation quantised to 6 directions (60 deg steps) — the visual cue that reads
  // as "crystal" rather than "sphere". Derived from the velocity direction the particle had
  // when it froze: correlates facets with the motion that formed the structure, so an arc of
  // frozen particles shares a coherent grain instead of looking randomly scattered.
  // (The alternative, hashing the particle index, gives an arbitrary orientation per particle
  // and reads as noise — see execution notes in actions.md.)
  float rawAngle = atan(velDir.y, velDir.x);
  float step6 = 3.14159265 / 3.0;             // 60 degrees
  vFacetAngle = floor(rawAngle / step6) * step6;
}`;

const SPLAT_FRAG_SRC = `#version 300 es
precision highp float;

in float vTemperature;
in float vDepth;
in float vSplatVelocity;
in vec3 vSplatColor;
in float vSplatPos;
in float vSplatAge;
in vec2 vLocalUV;
in float vFrozen;
in float vGrowth;
in float vFacetAngle;
in vec3 vTilt;
in vec2 vSplatChanAL;   // 31.2: x = alpha multiplier, y = lightness. Neutral (1, 1).
in float vEnergyScale;  // 27.2: see the derivation in SPLAT_VERT_SRC

uniform float uCoreBrightness;
uniform float uHaloStrength;
uniform float uFalloffExponent;
// Film-look glow, folded into the material's own falloff (triage B12).
//
// The splat program had NO uGlow at all, so the Visual FX Glow slider and every film look's glow value were
// inert while a material was active -- the one place users most expect glow to matter.
//
// Combined MULTIPLICATIVELY rather than replacing uFalloffExponent, because the two have OPPOSITE senses and
// unifying them naively would recreate the 2026-08-06 inversion bug: MaterialConfig.falloffExponent is
// honestly named (higher = TIGHTER), whereas FilmLookParams.glow is the reciprocal of an exponent
// (higher = SOFTER). So the effective exponent is uFalloffExponent * (4.0 / uGlow): a higher glow divides
// the exponent down and widens the halo, while the material keeps full control of the base curve.
// Normalised on 4.0 = Legacy's glow, so the factor is exactly 1.0 there and every existing splat preset
// renders unchanged unless it declares a non-Legacy film look.
uniform float uGlow;
uniform float uEmissionIntensity;
uniform float uParticleCount;
uniform float uSplatRadius;
uniform float uIsAdditive;
uniform vec4 uFlameParams;  // x=expansion, y=velocityStretch, z=taperStrength, w=unused
uniform sampler2D uRampTex;
uniform sampler2D uSmokeRampTex;
// B14: the film-look palette, which OVERRIDES the material ramp when enabled.
//
// The splat shader previously had no palette code at all, so selecting a material discarded the film look's
// colour -- silently, because choosing a material force-switches the render mode to splat. Colour now has one
// precedence order across every pass: palette > material ramp > preset colour.
//
// Mapping 3 (temperature) is what makes the two systems compose rather than compete: material heat becomes
// the palette's INPUT, so the material keeps the physics and the film look owns the colour.
uniform sampler2D uSplatPaletteTex;
uniform int uSplatPaletteEnabled;
uniform int uSplatPaletteMapping;   // 0=depth, 1=phase, 2=velocity, 3=temperature
uniform float uSmokeThreshold;
uniform float uSmokeOpacity;
// Pass table:
//   0 = smoke   (alpha, classified by vTemperature <= uSmokeThreshold)
//   1 = flame   (additive, classified by vTemperature > uSmokeThreshold)
//   2 = direct  (additive, no temperature split)
//   3 = crystal (alpha-OCCLUDING, classified by vFrozen — v8 Phase 8a)
// Note pass 3 uses a completely different classifier from 0/1: it keys on the frozen flag,
// not on temperature, and is unrelated to uSmokeThreshold.
uniform int uRenderPass;
// v8 Phase 8a crystal params
uniform float uFacetSharpness;
uniform int uCrystalShape;   // 8a-4: 0=hexagon 1=plate 2=dendrite 3=prism
uniform float uSpecularStrength;
uniform float uIceOpacity;
uniform float uEdgeBrightness;
uniform float uInternalRefraction;
uniform sampler2D uCrystalRampTex;

out vec4 fragColor;

// Signed distance to a regular hexagon, used for the hard-edged crystal kernel.
// Positive outside, negative inside.
float hexSDF(vec2 p, float r) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773503); // (-sqrt(3)/2, 1/2, 1/sqrt(3))
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

// ---- v8 Phase 8a-4: crystal silhouettes ------------------------------------------------------
//
// Four shapes, one shared facet/specular/refraction model, selected by uCrystalShape
// (0=hexagon 1=plate 2=dendrite 3=prism). All are 6-fold so they agree with the hex facet
// quantisation below AND with the six axes growthAnisotropy biases accretion along.
//
// The g parameter is the crystal's growth [0..1+]. plate and dendrite use it to gain internal
// structure as they grow, which is the fix for the 8a-3 finding that growth read as inflation: a
// scale-invariant shape can only ever get bigger, so accretion looked like a pile of ice cubes.

// Capsule/segment distance — the dendrite arm primitive.
float segSDF(vec2 p, vec2 a, vec2 b, float rad) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - rad;
}

/**
 * Stellar dendrite: a 6-fold star of tapered spines with side-branches that extend as g rises.
 *
 * Built by folding the plane into ONE 30-degree wedge and drawing a single arm, which the fold then
 * mirrors into all twelve half-sectors. Folding rather than looping six times keeps this at a fixed
 * ~20 ALU ops instead of scaling with arm count.
 */
float dendriteSDF(vec2 p, float r, float g) {
  // Fold to a 60-degree sector, then mirror to 30 — one arm becomes six.
  float a = atan(p.y, p.x);
  float sector = 1.04719755; // pi/3
  a = mod(a + sector * 0.5, sector) - sector * 0.5;
  float rad = length(p);
  vec2 q = vec2(cos(a), abs(sin(a))) * rad;

  // Main spine along +x. Thin, and tapering outward via the radius term.
  float armLen = r * (0.75 + 0.45 * clamp(g, 0.0, 1.0));
  float spine = segSDF(q, vec2(r * 0.06, 0.0), vec2(armLen, 0.0), r * 0.15);

  // Two side-branches per arm, angled 60 degrees off the spine. Their length grows with g, so a
  // young crystal is a plain 6-pointed star and a mature one is a full snowflake.
  float bg = clamp((g - 0.35) / 0.65, 0.0, 1.0);
  float bl = r * 0.34 * bg;
  float d = spine;
  if (bl > 0.001) {
    vec2 dir = vec2(0.5, 0.8660254); // 60 degrees
    vec2 b1 = vec2(armLen * 0.42, 0.0);
    vec2 b2 = vec2(armLen * 0.68, 0.0);
    d = min(d, segSDF(q, b1, b1 + dir * bl, r * 0.085));
    d = min(d, segSDF(q, b2, b2 + dir * bl * 0.72, r * 0.07));
  }

  // Small solid hexagonal core, so the centre never looks like six disconnected sticks.
  return min(d, hexSDF(p, r * 0.2));
}

/**
 * Hexagonal plate: the hexagon squashed on one axis so it reads as a thin flat plate seen at an
 * angle rather than a solid cube. Concentric growth rings are added in the shading term, not here.
 */
float plateSDF(vec2 p, float r) {
  return hexSDF(vec2(p.x, p.y * 2.35), r);
}

/**
 * Bergkristall prism: an elongated hexagonal column with a pointed termination. Reads as a quartz
 * shard rather than snow — the strongest departure from the hexagon.
 */
float prismSDF(vec2 p, float r) {
  // Elongate along y, then cut a point by intersecting with two slanted half-planes at the tip.
  float body = hexSDF(vec2(p.x * 1.9, p.y * 0.72), r);
  float tipY = r * 1.15;
  float taper = (abs(p.x) * 1.7 + (p.y - tipY * 0.35)) - r * 0.62;
  return max(body, taper);
}

/** Shape dispatch. uCrystalShape: 0=hexagon 1=plate 2=dendrite 3=prism. */
float crystalSDF(vec2 p, float r, float g, int shape) {
  if (shape == 1) return plateSDF(p, r);
  if (shape == 2) return dendriteSDF(p, r, g);
  if (shape == 3) return prismSDF(p, r);
  return hexSDF(p, r);
}

void main() {
  // ---- v8 Phase 8a: crystal pass -------------------------------------------------------
  // Runs BEFORE the additive passes and is alpha-composited, so frozen crystals OCCLUDE the
  // glow behind them instead of adding to it. This is the whole point of the pass: everything
  // else in psss adds light.
  if (uRenderPass == 3) {
    if (vFrozen < 0.5) discard;

    // Rotate into the particle's quantised facet frame, so the hexagon and its shading share
    // one orientation and neighbouring frozen particles show a coherent grain.
    float ca = cos(vFacetAngle);
    float sa = sin(vFacetAngle);
    vec2 fp = vec2(vLocalUV.x * ca - vLocalUV.y * sa, vLocalUV.x * sa + vLocalUV.y * ca);

    // 8a-4: shape is selectable. vGrowth drives internal structure for plate/dendrite, so a
    // growing crystal gains detail instead of merely scaling up.
    float d = crystalSDF(fp, 0.72, vGrowth, uCrystalShape);
    // HARD alpha cutoff, not a radial falloff. facetSharpness=1 → a single-pixel edge.
    float aa = mix(0.28, 0.015, clamp(uFacetSharpness, 0.0, 1.0));
    float body = 1.0 - smoothstep(-aa, aa, d);
    if (body < 0.01) discard;

    // ---- 8a-5: real 3D surface, replacing the old flat shading ------------------------------
    //
    // The previous model read as "a group of 2D areas" for three compounding reasons, all fixed
    // here: the normal's Z was the CONSTANT 0.55 (so every facet on every crystal faced the same
    // way), the only orientation was an in-plane rotation (so no crystal ever tilted toward or away
    // from the camera), and both shading terms were purely radial (so every crystal wore the same
    // concentric bullseye regardless of pose).

    // 1. BEVELLED NORMAL from the SDF. The gradient gives the true in-plane surface direction for
    //    whatever shape is active; near the rim the surface turns to face outward, in the middle it
    //    faces the viewer. That bevel profile is what gives a solid its rounded-edge read.
    vec2 grad = vec2(dFdx(d), dFdy(d));
    vec2 gdir = (length(grad) > 1e-6) ? normalize(grad) : vec2(0.0, -1.0);
    // How far into the body we are: 0 at the silhouette, 1 deep inside.
    float depthIn = clamp(-d / 0.30, 0.0, 1.0);
    // Bevel: rim normals lean outward (xy-dominant), interior normals point at the camera (+z).
    vec3 nrm = normalize(vec3(gdir * (1.0 - depthIn), 0.25 + 0.95 * depthIn));

    // 2. PER-FACET QUANTISATION, applied to the real normal rather than replacing it. Snapping the
    //    in-plane component to 6 sectors keeps the faceted look; blending by facetSharpness lets the
    //    user choose between smooth bevel and hard facets.
    float facetPhase = atan(nrm.y, nrm.x);
    float step6 = 3.14159265 / 3.0;
    float faceIdx = floor(facetPhase / step6);
    vec2 faceDir = vec2(cos((faceIdx + 0.5) * step6), sin((faceIdx + 0.5) * step6));
    vec3 facetN = normalize(vec3(faceDir * (1.0 - depthIn), 0.25 + 0.95 * depthIn));
    nrm = normalize(mix(nrm, facetN, clamp(uFacetSharpness, 0.0, 1.0)));

    // 3. TILT the normal by the crystal's own 3D pose, so two crystals side by side genuinely catch
    //    the light differently. vTilt.xy is the lean axis, vTilt.z the foreshortening (1 = face-on).
    //    Without this every crystal shares one lighting solution, which is most of the flat read.
    float lean = 1.0 - clamp(vTilt.z, 0.0, 1.0);
    nrm = normalize(nrm + vec3(vTilt.xy * lean * 1.25, 0.0));

    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 lightDir = normalize(vec3(0.4, -0.7, 0.6));
    // Secondary fill from the opposite side, so faces turned away from the key light are shaped
    // rather than black — a single light on a translucent solid reads as a flat silhouette.
    vec3 fillDir = normalize(vec3(-0.5, 0.35, 0.4));

    float ndl = max(dot(nrm, lightDir), 0.0);
    float ndf = max(dot(nrm, fillDir), 0.0);
    // Diffuse TERRACING: quantising the diffuse response into steps is the cue that says "flat
    // faces meeting at angles". A smooth ramp would read as a sphere however good the normal is.
    float diffuse = ndl * 0.75 + ndf * 0.3;
    float terraced = floor(diffuse * 4.0) / 4.0;
    diffuse = mix(diffuse, terraced, clamp(uFacetSharpness, 0.0, 1.0) * 0.7);

    // Blinn-Phong specular on the real normal, so the glint MOVES with pose instead of sitting at a
    // fixed spot on every crystal.
    vec3 halfV = normalize(lightDir + viewDir);
    float spec = pow(max(dot(nrm, halfV), 0.0), 42.0) * uSpecularStrength;

    // 4. FRESNEL — ice's most recognisable property: bright at grazing angles, clear face-on. This
    //    is what separates "glassy solid" from "flat white blob", and it was absent entirely.
    float fresnel = pow(1.0 - clamp(dot(nrm, viewDir), 0.0, 1.0), 3.0);

    // Edge/rim highlight along the silhouette — now Fresnel-weighted, so it brightens where the
    // surface actually turns away rather than uniformly around the outline.
    float edge = (1.0 - smoothstep(0.0, 0.16, abs(d))) * uEdgeBrightness * (0.45 + 0.55 * fresnel);

    // 5. INTERIOR as light travelling THROUGH the body: thickness-based, not radial distance. A
    //    thicker path scatters more, and the crystal's own depth in the scene modulates it.
    float thickness = depthIn * clamp(vTilt.z, 0.35, 1.0);
    float refract = thickness * (0.35 + 0.65 * vDepth) * uInternalRefraction;

    // 8a-4 plate: concentric growth rings. These are what make swelling legible on a plate — the
    // rings read as a growth history, where a plain scaled hexagon shows none.
    if (uCrystalShape == 1) {
      float rings = 0.5 + 0.5 * cos(length(fp) * (26.0 + 30.0 * clamp(vGrowth, 0.0, 1.0)));
      refract += rings * 0.35 * uInternalRefraction;
    }

    vec3 iceCol = texture(uCrystalRampTex, vec2(clamp(0.25 + refract, 0.0, 1.0), 0.5)).rgb;

    // Composition: shaded body + through-body scatter + white specular + Fresnel rim.
    //
    // Diffuse now MODULATES the body instead of the old flat 0.55 constant, which is what makes one
    // crystal's faces differ from another's. The Fresnel term is deliberately white-biased: ice
    // reflects the sky, so grazing angles go colourless while the interior keeps the ramp's blue.
    vec3 body3 = iceCol * (0.30 + 0.85 * diffuse);
    vec3 scatter = iceCol * refract * 1.15;
    vec3 rim = mix(iceCol, vec3(1.0), 0.65) * edge;
    vec3 sky = vec3(0.72, 0.85, 1.0) * fresnel * 0.55;
    vec3 col = body3 + scatter + vec3(spec) + rim + sky;

    // Premultiplied alpha: paired with blendFunc(ONE, ONE_MINUS_SRC_ALPHA) by the caller.
    //
    // T021/RF-04: vGrowth scales the alpha as well as the hexagon radius (done in the vertex
    // stage). Radius alone would make a new crystal pop in at full opacity as a tiny hard dot and
    // a melting one vanish abruptly at its last frame; the two together read as ice forming and
    // giving way. One scalar, both effects — which is the whole reason growth is a float.
    //
    // T030: vGrowth is capped at 1.0 in the vertex stage, so SWELLING past 1.0 grows the hexagon
    // without also forcing the alpha to full — Ice Opacity keeps meaning what it says.
    // 8a-5: Fresnel also lifts OPACITY at grazing angles. Real glass is near-transparent face-on and
    // near-opaque edge-on; a uniform alpha is a large part of why the old crystals read as flat
    // cut-outs. Scaled by uIceOpacity so the user's control still bounds the maximum.
    float alpha = clamp(body * uIceOpacity * vGrowth * (0.78 + 0.42 * fresnel), 0.0, 1.0);
    fragColor = vec4(col * alpha, alpha);
    return;
  }

  // A frozen particle is drawn ONLY by the crystal pass. Suppressing it in every other pass
  // implements the "crystal overrides material" rule and prevents any double-draw.
  if (vFrozen > 0.5) discard;

  // Pass-based particle classification
  if (uRenderPass == 0) {
    // Smoke pass: only render particles below threshold
    if (vTemperature > uSmokeThreshold) discard;
  } else if (uRenderPass == 1) {
    // Flame pass: only render particles above threshold
    if (vTemperature <= uSmokeThreshold) discard;
  }
  // uRenderPass == 2: render all (direct mode, no split)

  float velocityStretch = uFlameParams.y;
  float blend = clamp(velocityStretch, 0.0, 1.0);

  // Circular shape (core + halo, respects user parameters)
  float r = length(vLocalUV);
  float coreZone = smoothstep(0.3, 0.25, r);
  // Effective falloff = material exponent scaled by the film look's glow (see uGlow above).
  float gSplat = (uGlow > 0.0) ? uGlow : 4.0;
  float effFalloff = uFalloffExponent * (4.0 / gSplat);
  float haloFalloff = exp(-effFalloff * max(0.0, r - 0.3) * max(0.0, r - 0.3));
  float circularShape = mix(haloFalloff * uHaloStrength, uCoreBrightness, coreZone);
  circularShape *= step(r, 1.0);

  // Flame kernel shape (tapered directional)
  vec2 q = vLocalUV;
  q.y += 0.2 * blend;
  float widthMask = mix(0.8, 0.2, clamp(q.y * 0.5 + 0.5, 0.0, 1.0));
  float radial = abs(q.x) / widthMask;
  float body = 1.0 - smoothstep(0.4, 1.0, radial);
  float vertical = smoothstep(-1.0, -0.3, q.y) * (1.0 - smoothstep(0.4, 1.0, q.y));
  float flameKernel = body * vertical;
  // Scale flame kernel by user parameters for consistency
  float flameShape = flameKernel * mix(uHaloStrength, uCoreBrightness, smoothstep(0.5, 0.0, r));

  // Blend between circular and flame based on velocityStretch
  float shape = mix(circularShape, flameShape, blend);

  if (shape < 0.01) discard;
  /*
   * v8 31.2 -- the per-particle ALPHA, folded into shape so BOTH output paths below inherit it and
   * premultiplication cannot break (invariant 9): every output here is tint*shape in rgb with shape in
   * alpha, so scaling shape scales both halves by construction. Applied AFTER the discard, so the
   * threshold still tests the particle's own geometry rather than its channel.
   * The clamp is a no-op at the identity, which is what keeps the feature-off path byte-identical.
   */
  shape = clamp(shape * vSplatChanAL.x, 0.0, 1.0);

  /*
   * 27.2 — apply the energy normalisation. TWO things about this are deliberate.
   *
   * (1) AFTER THE DISCARD, and that ordering is the whole point. The test above is a FOOTPRINT test:
   * it decides which fragments the splat covers. Scaling shape before it would push dim fragments
   * under the threshold and SHRINK the visible footprint, so a change meant to correct brightness
   * would quietly also change geometry -- and the two would be inseparable when judging the result.
   * Applied here the footprint is bit-identical to before this step and only intensity moves.
   *
   * (2) GATED ON uIsAdditive, for the same reason the alpha construction further down is gated, and
   * the reason is that the correction only MEANS anything in one of the two modes:
   *   ONE, ONE                       -> shape is deposited light. Energy is the conserved quantity,
   *                                     det J is its law, and this factor is that law. Alpha is not
   *                                     read by the GPU here, so nothing else moves.
   *   SRC_ALPHA, ONE_MINUS_SRC_ALPHA -> the splat is an OCCLUDER, not an emitter. outA is built from
   *                                     shape, so scaling it would make a stretched particle more
   *                                     TRANSPARENT -- a different quantity, not derivable from det J,
   *                                     and a bigger occluder legitimately occludes more.
   *
   * SO THE ARTEFACT SURVIVES ON ALPHA-BLEND MATERIALS AND THAT IS A STATED LIMIT, NOT AN OVERSIGHT.
   * The additive set (Plasma, Fire, Ember, LiquidLight per the note below) is corrected; the
   * alpha-blend set keeps its pre-27.2 behaviour, where a stretched splat covers more area at the
   * same opacity. Correcting that is a coverage question and wants its own derivation.
   */
  if (uIsAdditive > 0.5) shape *= vEnergyScale;

  vec4 rampColor = texture(uRampTex, vec2(vTemperature, 0.5));

  // B14: film-look palette override. RGB ONLY -- alpha stays with the material ramp, because opacity is a
  // separate concern (B15 folds rampColor.a into output alpha for alpha-blend materials, and palettes carry
  // no meaningful alpha). So a palette recolours a material without changing how solid it is.
  //
  // The splat shader previously had no palette code at all, so selecting a material discarded the film
  // look's colour -- silently, because choosing a material force-switches the render mode to splat. Colour
  // now has ONE precedence order across every pass: palette > material ramp > preset colour.
  //
  // Mapping 3 (temperature) is what makes the two systems compose instead of compete: material heat becomes
  // the palette's INPUT, so the material keeps the physics and the film look owns the colour.
  if (uSplatPaletteEnabled == 1) {
    float palCoord;
    // Each mapping needs its OWN source, or they collapse onto each other and the control looks dead.
    // The first cut of this had velocity fall through to vTemperature and derived phase from
    // rampColor.rgb -- which is ITSELF temperature-indexed -- so three of the four options produced the
    // same picture. Reported as: changing the map values seems not really to have an effect.
    if (uSplatPaletteMapping == 0) palCoord = vDepth;
    else if (uSplatPaletteMapping == 1) palCoord = dot(vSplatColor, vec3(0.2126, 0.7152, 0.0722));
    else if (uSplatPaletteMapping == 2) palCoord = vSplatVelocity;
    else if (uSplatPaletteMapping == 4) palCoord = vSplatPos;
    else if (uSplatPaletteMapping == 5) palCoord = vSplatAge;
    else palCoord = vTemperature;
    rampColor.rgb = texture(uSplatPaletteTex, vec2(clamp(palCoord, 0.0, 1.0), 0.5)).rgb;
  }

  if (uRenderPass == 0) {
    // Smoke pass: blend from grey smoke ramp toward fire ramp near the threshold
    float smokeT = vTemperature / max(0.01, uSmokeThreshold);
    vec4 smokeRamp = texture(uSmokeRampTex, vec2(smokeT, 0.5));
    // Cross-fade: near threshold (smokeT→1) blend toward fire ramp for smooth transition
    vec3 smokeColor = mix(smokeRamp.rgb, rampColor.rgb, smokeT * smokeT);
    float coolness = 1.0 - smokeT;
    float smokeAlpha = shape * uSmokeOpacity * coolness;
    // 31.2: lightness multiplies the resolved colour (31.D12). The alpha channel already carries it
    // through shape, so this must NOT also scale smokeAlpha -- that would apply it twice.
    fragColor = vec4(smokeColor * vSplatChanAL.y * smokeAlpha, smokeAlpha);
  } else {
    // Flame or direct: full brightness with fire ramp
    // M1: overlap compensation, NORMALISED to a reference scene.
    //
    // The purpose is real and must be kept: additive blending sums every overlapping splat, so a
    // 20 000-particle preset would blow out to flat white without damping. But the old form was
    //
    //     intensity /= max(1.0, sqrt(count * radius^2 * 1e-4))
    //
    // which is an ABSOLUTE divisor, and it made uEmissionIntensity unpredictable: an authored 2.0
    // delivered 2.00 at 500 particles, 0.45 at 2 000 and 0.14 at 20 000 -- a 14x swing from one
    // value, coupled to BOTH particleCount and splatRadius. A material preset therefore could not
    // carry a meaningful emissionIntensity at all, because the same material landed differently on
    // every preset it was applied to. That is the specific reason a preset could not simply use the
    // default material unmodified.
    //
    // Normalising against a REFERENCE scene makes the authored number honest at the common case and
    // turns the divisor into a relative correction: scenes denser than the reference are damped,
    // sparser ones are lifted, and at the reference the authored value passes through EXACTLY.
    //
    // The reference is 4 000 particles at radius 10 -- the LIBRARY MEDIAN, measured from
    // psss_presets.json rather than assumed. 4 000 is the single most common value (75 of the 177
    // presets) and closest to the count-weighted mean, so emissionIntensity 2.0 now means 2.0 for
    // the most common case. (My first pass used 2 000, the config default, which is only the
    // p10 of the real distribution and would have left most presets under-delivering.)
    //
    // ⚠️ The EXPONENT is 0.25, not the old 0.5, and that is the load-bearing half of this fix.
    //
    // Re-normalising alone achieves nothing measurable, because multiplying by a constant CANNOT
    // change a ratio: sqrt(ref/ov) = sqrt(ref) * (1/sqrt(ov)), and sqrt(ref) is constant, so every
    // scene-to-scene ratio is bit-identical to the old form. Measured across 8 realistic scenes the
    // spread stayed at exactly 6.40x -- the authored number became honest AT the reference and
    // remained just as unpredictable away from it. Weakening the exponent is what actually
    // compresses the range:
    //
    //     exponent   spread   delivered band (authored 2.0)
    //     0.50        6.40x   0.31x .. 2.00x     <- re-normalise only, no real improvement
    //     0.35        3.67x   0.44x .. 1.62x
    //     0.25        2.53x   0.56x .. 1.41x     <- chosen
    //     0.00        1.00x   1.00x .. 1.00x     <- no damping at all; a dense scene blows out
    //
    // 0.25 keeps a 40x density change damped to 0.40x (so overload protection survives) while
    // holding the authored value within 0.56x..1.41x instead of 0.07x..0.45x. Exponent 0 was
    // rejected: it removes the protection entirely, which is the failure this whole mechanism exists
    // to prevent.
    //
    // The lift is CLAMPED to 1.5x, so a very sparse scene cannot be multiplied up until it clips on
    // its own -- the opposite failure, and one the old form could never produce since max(1.0, ...)
    // only ever divided.
    float intensity = uEmissionIntensity;
    if (uIsAdditive > 0.5) {
      float overlap = uParticleCount * uSplatRadius * uSplatRadius * 0.0001;
      float refOverlap = 4000.0 * 10.0 * 10.0 * 0.0001;   // library median scene = 40.0
      intensity *= min(1.5, pow(refOverlap / max(0.0001, overlap), 0.25));
    }

    // Temperature-based emission: smoothly fade in as blend increases
    float emissionCurve = mix(1.0, mix(0.7, 1.0, vTemperature), blend);

    // Output alpha: geometry alone in ADDITIVE mode, geometry x RAMP alpha in ALPHA mode (triage B15).
    //
    // Every colour ramp authors a deliberate alpha curve -- fire runs 0 -> 128 -> 200 -> 255, ice is
    // lifted off zero at the cold end on purpose -- but the main renderer read only rampColor.rgb and
    // took its alpha from shape. So that authored curve reached nothing, and the preview-grid tile
    // shader (which DOES multiply by rampColor.a) rendered the same material at a different opacity
    // from the main view.
    //
    // Gated on uIsAdditive because the two modes use the alpha channel completely differently:
    //   ONE, ONE                        -> the GPU never reads alpha; dst += src.rgb. Multiplying here
    //                                      would change nothing, so additive materials (Plasma, Fire,
    //                                      Ember, LiquidLight) are provably untouched by this.
    //   SRC_ALPHA, ONE_MINUS_SRC_ALPHA  -> alpha decides how much of the destination survives, so the
    //                                      ramp's curve becomes load-bearing exactly as authored.
    //
    // Why it matters beyond consistency: this is the real cause of the "snakes looking for a way
    // through the ice" defect. A cold Ice particle was fully OPAQUE (alpha = shape), so it replaced the
    // bright crystal behind it. That was treated by lifting the ice ramp's RGB off near-black, which
    // only softened it -- a cold particle still knocked a 0.85 crystal down to 0.18. With the ramp's own
    // alpha (0.157 at t=0) the crystal survives at 0.745. Cause, not symptom.
    float outA = (uIsAdditive > 0.5) ? shape : clamp(shape * rampColor.a, 0.0, 1.0);
    // 31.2: lightness on the resolved ramp colour, after precedence (31.D12). shape and outA
    // already carry the alpha channel, so only the rgb term is touched here.
    fragColor = vec4(rampColor.rgb * vSplatChanAL.y * shape * intensity * emissionCurve, outA);
  }
}`;

const VOLUME_ACCUM_VERT_SRC = `#version 300 es
precision highp float;
in vec2 aPosition;
in float aTemperature;
in float aDepth;
in vec3 aColor;
uniform vec2 uResolution;
uniform float uSplatRadius;
uniform float uDepthFade;
// Global particle size multiplier (overlay.particleSize). Volume's base radius is the LARGEST in the
// engine (splatRadius * 1.5, with a hardcoded 16.0 fallback when no material is running), so this is the
// mode the control was asked for.
uniform float uParticleSize;
// Depth Size / Depth DoF: both were absent from this program, which made the two Customize controls inert
// in Volume mode (invariant 13). Same formulas as the point path so all three programs agree.
uniform float uDepthSize;
uniform float uDepthDof;
uniform float uMaxPointSize;
out float vTemperature;
out float vDepthFade;
out vec3 vColor;
void main() {
  vec2 ndc = (aPosition / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  float scaleFactor = (uResolution.x + uResolution.y) / (1024.0 + 768.0);
  float size = uSplatRadius * scaleFactor * uParticleSize;
  if (uDepthSize > 0.0) {
    size *= 1.0 + uDepthSize * (1.0 - aDepth);
  }
  if (uDepthDof > 0.0) {
    float dofBlur = abs(aDepth - 0.5) * uDepthDof;
    size *= 1.0 + dofBlur * 2.0;
  }
  gl_PointSize = clamp(size, 1.0, uMaxPointSize);
  vTemperature = aTemperature;
  vDepthFade = 1.0 - aDepth * uDepthFade;
  vColor = aColor;
}`;

const VOLUME_ACCUM_FRAG_SRC = `#version 300 es
precision highp float;
in float vTemperature;
in float vDepthFade;
in vec3 vColor;
uniform float uDensityScale;
uniform float uUseRamp;
uniform sampler2D uRampTex;
out vec4 fragColor;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float r = length(pc) * 2.0;
  if (r > 1.0) discard;
  float gaussian = exp(-4.0 * r * r);
  float density = gaussian * uDensityScale * vDepthFade;
  // Colour source, mirroring the precedence table: material ramp when a material is running,
  // otherwise the preset's own oscillating colour. Volume was ramp-ONLY, and with no material
  // the temperature array is all zeros, so every particle sampled the ramp at t=0 -- which is
  // transparent BLACK on all seven ramps. Density accumulated correctly and was then shaded to
  // nothing: a black frame with full alpha, and no error anywhere.
  vec3 tint = (uUseRamp > 0.5) ? texture(uRampTex, vec2(vTemperature, 0.5)).rgb : vColor;
  fragColor = vec4(tint * density, density);
}`;

const VOLUME_RESOLVE_VERT_SRC = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const VOLUME_RESOLVE_FRAG_SRC = `#version 300 es
precision highp float;
uniform sampler2D uDensityTex;
uniform float uExtinction;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec4 accum = texture(uDensityTex, vUv);
  float density = accum.a;
  float opacity = 1.0 - exp(-uExtinction * density);
  vec3 color = density > 0.001 ? accum.rgb / density : vec3(0.0);
  // PREMULTIPLIED output -- renderVolume must therefore blend ONE, ONE_MINUS_SRC_ALPHA, and NOT
  // SRC_ALPHA, ONE_MINUS_SRC_ALPHA, which would apply opacity a second time. Measured cost of the
  // squared factor: a flat 16% of luminance at density 0.6, and 74% at density 0.1 -- worst in the
  // thin regions that are precisely where volumetric smoke reads as volumetric.
  fragColor = vec4(color * opacity, opacity);
}`;

// `FLAME_RESOLVE_VERT_SRC`/`FLAME_RESOLVE_FRAG_SRC` were declared here and deleted on 2026-08-10
// (triage G2). They belonged to an abandoned half-res accumulate-then-resolve flame pipeline: Phase 6B
// shipped `splat` as DIRECT additive rendering to the main FBO (see `renderSplat`), so nothing ever
// bound `flameAccumFBO` as a draw target and nothing ever sampled `flameAccumTex`. The program was
// still compiled at every splat-mode `init()` and had ZERO draw calls. If half-res accumulation is
// ever wanted, note why it was dropped: resolving through an extended-Reinhard curve inside the
// renderer double-tone-maps against the real `toneMap` post-processor, and the smoke/flame two-pass
// compositing needs the main FBO's destination alpha.

/**
 * H5 — the two fields of `renderCrystalPass`'s packed depth-sort key. See that method for the
 * derivation and the three verified preconditions.
 *
 * ⚠️ These two are a PAIR and their product must stay under `Number.MAX_SAFE_INTEGER`. At the shipped
 * values the largest key is 4.50e15 against a 9.01e15 ceiling — but raising `CRYSTAL_INDEX_BASE` by one
 * bit takes it to 9.01e15, exactly AT the limit, where keys stop being exactly representable and the
 * sort silently loses its total order (two crystals compare equal and paint in arbitrary order). If a
 * wider index is ever needed, narrow the depth quantisation by the same number of bits.
 */
const CRYSTAL_DEPTH_QUANT = 4294967295; // 2^32 - 1, the depth field's full range
const CRYSTAL_INDEX_BASE = 1048576; // 2^20, bounds the particle index — ~19x MAX_PARTICLE_COUNT + tails

export class HDRParticleRenderer implements Renderer {
  readonly id = 'hdr-particle';

  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private posBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private depthBuffer: WebGLBuffer | null = null;
  private velocityBuffer: WebGLBuffer | null = null;
  /** B14: per-particle temperature for the point path, so a palette can be indexed by material heat. */
  private pointTempBuffer: WebGLBuffer | null = null;
  /** Zero-filled scratch used when no material is active, so the attribute is never fed garbage. */
  private pointTempZeros: Float32Array = new Float32Array(0);
  /** Per-particle lifetime for the point path (palette mapping 5). */
  private pointAgeBuffer: WebGLBuffer | null = null;
  /**
   * Synthetic ages, used when no material is running.
   *
   * `lifetimes[]` is owned by `MaterialProcessor` and only exists while a material is active — but unlike
   * TEMPERATURE, age needs no material to be meaningful, so rather than degrading the mapping we synthesise
   * a staggered per-particle phase. Each particle gets a fixed offset by index, matching the
   * `(i / count) * 6.0` stagger `heatMode: 'age'` applies, and the shader adds the elapsed cycle.
   */
  private pointAgeSynth: Float32Array = new Float32Array(0);
  private pointAgeClock = 0;
  /**
   * v8 `31.2` (`E112`/`E113`/`E137`) — **the packed channel array for THIS frame, or a neutral all-ones pad
   * of the right length. Both particle passes call it; neither may skip it.**
   *
   * ⚠️ **IT NEVER RETURNS A SHORT ARRAY AND NEVER RETURNS `null`, and both halves of that are the point.**
   * Invariant 6: two passes sharing a VAO must both upload every per-instance buffer, at the correct size —
   * a vertex buffer shorter than its draw call makes ANGLE drop the whole draw with nothing logged. And an
   * enabled attribute with no bound data reads undefined values, which on some drivers is stale GPU memory.
   * **So there is no off path here: when the generator publishes nothing, this returns ones.**
   *
   * ⚠️ **ONES, NOT ZEROS — the three values are MULTIPLIERS.** A zero pad is an invisible figure, which is
   * the worst shape of defect this engine has: a black frame that logs nothing. `growthAttrBuf` makes the
   * same choice for the same reason.
   *
   * ⚠️ **The length test is `length < count * 3`, not `!channels`** (invariant 6's own wording): the
   * generator publishes a `subarray` of grow-only scratch, so a well-formed but SHORT array is the
   * reachable case, and `!channels` would wave it through.
   */
  private resolveChannels(state: GeneratorState): Float32Array {
    const need = state.count * 3;
    const src = state.channels;
    if (src && src.length >= need) {
      // The readout's minimum, taken over the WAVE block only: the tail populations carry the neutral 1 by
      // construction, so including them would pin the minimum at 1 the moment a single spark existed.
      const wave = (state.waveCount ?? state.count) * 3;
      let lo = 1;
      for (let i = 0; i < wave; i += 3) if (src[i]! < lo) lo = src[i]!;
      this.channelSizeMin = lo;
      return src.subarray(0, need);
    }
    this.channelSizeMin = 1;
    if (this.channelPad.length < need) {
      this.channelPad = new Float32Array(need);
      this.channelPad.fill(1);
    } else {
      // The pad is grow-only and the crystal pass fills its own prefix, so a stale value from a previous
      // frame is reachable in the range this call is about to publish. Re-filling is the cheap half of the
      // rule invariant 7 states for every piece of reused scratch.
      this.channelPad.fill(1, 0, need);
    }
    // A SHORT published array is still data: copy what there is rather than discarding it, so a transient
    // one-frame length mismatch degrades to "part of the figure is neutral" rather than to all of it.
    if (src) this.channelPad.set(src.subarray(0, Math.min(src.length, need)));
    return this.channelPad.subarray(0, need);
  }

  /** Zero-padded copy of `state.lifetimes`, sized to `state.count` for the splat draw. See renderSplat. */
  private splatAgePad: Float32Array = new Float32Array(0);
  /**
   * XY-interleaved copy of the solid population's positions, owned by `packSolidPos2d()` and shared by
   * `render()`'s point path and `renderVolume()`.
   *
   * ⚠️ **This was a `new Float32Array(solidCount * 2)` inside BOTH callers — 400 KB per frame at 50 000
   * particles on EVERY preset, and 800 KB on the volume path, which packed it twice.** At 60 fps that is
   * 24 MB/s of pure garbage: invariant 8's signature, and half the magnitude of the 58 MB/s case that
   * reached the owner as *"a jitter effect every few seconds"*. The two scratch fields above were already
   * cached against exactly this, with a comment saying so; this one had been missed.
   *
   * Exact-size rather than grow-only, matching `pointTempZeros`: `bufferData` uploads the WHOLE array, so a
   * buffer left long by a bigger previous frame would upload a stale tail as real geometry. Both callers
   * derive the same `state.count − crystalCount`, so the length test reallocates on a genuine count change
   * and never thrashes between two sizes within one frame.
   */
  private solidPos2d: Float32Array = new Float32Array(0);
  /** The splat path's own copy of the same thing, at `state.count`. See `packSplatPos2d()` for why it is not shared. */
  private splatPos2d: Float32Array = new Float32Array(0);

  private uResolution: WebGLUniformLocation | null = null;
  private uGlow: WebGLUniformLocation | null = null;
  private uDepthSize: WebGLUniformLocation | null = null;
  private uDepthBrightness: WebGLUniformLocation | null = null;
  private uDepthDof: WebGLUniformLocation | null = null;
  private uDepthColorShift: WebGLUniformLocation | null = null;
  private uRenderMode: WebGLUniformLocation | null = null;
  private uParticleSize: WebGLUniformLocation | null = null;
  /*
   * v8 28.5 -- the curve-cull uniform, one location per program, plus the CPU-side count.
   *
   * ⚠️ **`hideBelowIndex` is a plain number, so it SURVIVES `dispose()` while the uniform locations do
   * not — invariant 2's shape exactly.** `reapplyRendererState()` must re-hand it after
   * `reinitRenderer()`, or a render-mode change silently brings the hidden figure back.
   */
  private uHideBelowIndex: WebGLUniformLocation | null = null;
  private splatUHideBelowIndex: WebGLUniformLocation | null = null;
  private hideBelowIndex = 0;
  private uMaxPointSize: WebGLUniformLocation | null = null;
  private uLightingMode: WebGLUniformLocation | null = null;
  private uLightDir: WebGLUniformLocation | null = null;
  private uRimPower: WebGLUniformLocation | null = null;
  private uPaletteTex: WebGLUniformLocation | null = null;
  private uPaletteEnabled: WebGLUniformLocation | null = null;
  private uPaletteHueShift: WebGLUniformLocation | null = null;
  private uLiquidSurfPaletteHueShift: WebGLUniformLocation | null = null;
  /** v8 26.4 — turns. Set by `setPaletteHueShift`, uploaded to both LUT-sampling programs. */
  private paletteHueShift = 0;
  private uPaletteMapping: WebGLUniformLocation | null = null;

  private paletteTexture: WebGLTexture | null = null;
  private paletteEnabled = false;
  private paletteMapping = 0; // 0=depth, 1=phase

  // Splat mode resources (created only when renderMode === 'splat')
  private splatProgram: WebGLProgram | null = null;
  private splatVao: WebGLVertexArrayObject | null = null;
  private temperatureBuffer: WebGLBuffer | null = null;
  private rampTexture: WebGLTexture | null = null;
  private smokeRampTexture: WebGLTexture | null = null;
  // v8 Phase 8a — Faceted Crystal
  private crystalRampTexture: WebGLTexture | null = null;
  private crystalConfig: CrystalRenderConfig | null = null;
  private frozenSortIdx: Int32Array = new Int32Array(0);
  // H5 — per-frame scratch for the crystal pass, hoisted out of `renderCrystalPass()`. Grow-only and
  // read back through `subarray(0, n)`, so a shrinking crystal population never reallocates. See the
  // note on `renderCrystalPass` for what was and was not actually costing here.
  private crystalSortKeys: Float64Array = new Float64Array(0);
  private crystalPos: Float32Array = new Float32Array(0);
  private crystalDep: Float32Array = new Float32Array(0);
  private crystalVel: Float32Array = new Float32Array(0);
  private crystalFrz: Float32Array = new Float32Array(0);
  private crystalGro: Float32Array = new Float32Array(0);
  /** Zero-filled filler for the three B14/B16 palette attributes the crystal branch never reads. */
  private crystalZeros1: Float32Array = new Float32Array(0);
  private crystalZeros3: Float32Array = new Float32Array(0);
  private frozenAttrBuf: Float32Array = new Float32Array(0);
  // v8 Phase 8a-2 (T021): the live/material splat pass's companion aGrowth array, held all-ones.
  // Cached rather than allocated per frame; it only ever changes length when state.count does.
  private growthAttrBuf: Float32Array = new Float32Array(0);
  private splatUResolution: WebGLUniformLocation | null = null;
  private splatUSplatRadius: WebGLUniformLocation | null = null;
  private splatUDepthSize: WebGLUniformLocation | null = null;
  private splatUDepthDof: WebGLUniformLocation | null = null;
  private splatUParticleSize: WebGLUniformLocation | null = null;
  private splatUSparkRadius: WebGLUniformLocation | null = null;
  private splatUSparkFirst: WebGLUniformLocation | null = null;
  private splatUSparkLast: WebGLUniformLocation | null = null;
  private splatUFlameExpansion: WebGLUniformLocation | null = null;
  private splatUCoreBrightness: WebGLUniformLocation | null = null;
  private splatUHaloStrength: WebGLUniformLocation | null = null;
  private splatUFalloffExponent: WebGLUniformLocation | null = null;
  /** Film-look glow inside the splat program — see the `uGlow` note in the splat fragment shader (B12). */
  private splatUGlow: WebGLUniformLocation | null = null;
  private splatUEmissionIntensity: WebGLUniformLocation | null = null;
  private splatURampTex: WebGLUniformLocation | null = null;
  private splatUParticleCount: WebGLUniformLocation | null = null;
  private splatUIsAdditive: WebGLUniformLocation | null = null;
  /**
   * The 15 splat uniforms and 13 VAO buffers that were stashed as `__`-prefixed properties on the
   * `WebGLProgram` / `WebGLVertexArrayObject` objects themselves, reached through `as any` (triage I2).
   *
   * They sat *alongside* the 13 properly-declared `splatU*` fields above, so the same program's uniforms
   * were addressed two different ways in one file — new ones landed in whichever style the surrounding
   * lines used. The stash also survives `dispose()` structurally (the property lives on the GL object,
   * which is then deleted), so nothing ever told you a handle had been dropped.
   *
   * ⚠️ **The cost was a real leak, not just style.** `dispose()` released 6 of `splatVao`'s 9 buffers:
   * `splatVelBuffer`, `splatColBuffer` and `splatAgeBuffer` — the three added by B14 — were never
   * deleted, so each ran `dispose()` + `init()` leaked three buffers. That path runs on *every* render
   * mode, film look and TransMap change. With the handles declared here, the release list is checkable
   * against the declaration list by eye; under `as any` it was not, which is why the omission survived.
   */
  private splatUSplatPaletteTex: WebGLUniformLocation | null = null;
  private splatUSplatPaletteEnabled: WebGLUniformLocation | null = null;
  private splatUSplatPaletteMapping: WebGLUniformLocation | null = null;
  private splatUSmokeThreshold: WebGLUniformLocation | null = null;
  private splatUSmokeOpacity: WebGLUniformLocation | null = null;
  private splatURenderPass: WebGLUniformLocation | null = null;
  private splatUSmokeRampTex: WebGLUniformLocation | null = null;
  private splatUFacetSharpness: WebGLUniformLocation | null = null;
  private splatUCrystalShape: WebGLUniformLocation | null = null;
  private splatUSpecularStrength: WebGLUniformLocation | null = null;
  private splatUIceOpacity: WebGLUniformLocation | null = null;
  private splatUEdgeBrightness: WebGLUniformLocation | null = null;
  private splatUInternalRefraction: WebGLUniformLocation | null = null;
  private splatUCrystalRampTex: WebGLUniformLocation | null = null;
  private splatUMaxGrowth: WebGLUniformLocation | null = null;
  private splatUSplatShearFixed: WebGLUniformLocation | null = null;
  // splatVao's nine per-instance/per-vertex buffers. `quadBuffer` is the one per-VERTEX buffer here
  // (divisor 0, STATIC_DRAW, uploaded once at init); the other eight are per-instance.
  private splatPosBuffer: WebGLBuffer | null = null;
  private splatDepthBuffer: WebGLBuffer | null = null;
  private splatQuadBuffer: WebGLBuffer | null = null;
  private splatVelDirBuffer: WebGLBuffer | null = null;
  private splatVelBuffer: WebGLBuffer | null = null;
  private splatColBuffer: WebGLBuffer | null = null;
  private splatAgeBuffer: WebGLBuffer | null = null;
  /*
   * v8 `31.2` — the two packed-channel buffers, one per VAO.
   *
   * ⚠️ **TWO BUFFERS FOR ONE FEATURE, because there are two VAOs and a VAO owns its attribute bindings.**
   * `channelsBuffer` lives in `this.vao` (the point path, and the liquid accumulation that shares it);
   * `splatChannelsBuffer` lives in `splatVao` (the material splat AND the crystal pass, which shares that
   * program — invariant 6's two-passes-one-VAO case, and the pass that got it wrong in Phase 8a turned the
   * whole preview black).
   *
   * ⚠️ **`channelPad` IS ALL ONES, NEVER ZEROS.** It is what both paths upload when the generator
   * publishes nothing, and a zero pad would mean size 0, alpha 0 and lightness 0 — an invisible figure
   * with no error anywhere. `growthAttrBuf` makes the same choice for the same reason, one field over.
   */
  private channelsBuffer: WebGLBuffer | null = null;
  private splatChannelsBuffer: WebGLBuffer | null = null;
  private channelPad: Float32Array = new Float32Array(0);
  /**
   * v8 `31.2` — the SMALLEST per-particle size multiplier in the last resolved frame. 1 when the feature
   * is off. Read only by `estimateParticlePixels()`; see there for why it is the minimum and not the mean.
   *
   * ⚠️ **MEASURED FROM THE PUBLISHED DATA RATHER THAN HANDED DOWN FROM THE AMOUNT**, which is what keeps it
   * honest: the amount is a bound on what the generator MIGHT produce, this is what it did produce — and
   * it needs no second owner, no new setter and nothing to keep in step.
   */
  private channelSizeMin = 1;
  private splatFrozenBuffer: WebGLBuffer | null = null;
  private splatGrowthBuffer: WebGLBuffer | null = null;
  private maxPointSize = 64.0;
  private materialConfig: MaterialConfig | null = null;

  /**
   * 1×1 opaque-black stand-in for ANY sampler that has no texture to bind this frame (invariant 4).
   *
   * ⚠️ **CREATED UNCONDITIONALLY IN `init()`, AND THAT IS THE FIX RATHER THAN THE STYLE.** It used to be
   * `normalizeFrameFallbackTex`, built inside `initLogDensity` for that pass's `uFrame` sampler — so it
   * existed ONLY in `log-density` mode, while `renderLiquid` already read it for two samplers of its own
   * (`uRamp`/`uPalette` and the 15.7 dye field). In every liquid preset without a dye texture the fallback
   * was therefore `null`, which is exactly the incomplete-unit defect invariant 4 names: a sampler that IS
   * assigned a unit and IS sampled unconditionally, with nothing bound, can make some drivers resolve the
   * WHOLE multi-sampler draw to black rather than only that sampler. Retiring `log-density` (21.8c/d,
   * owner 2026-09-19) would have deleted the only creation site, so the relocation was forced — but the
   * defect was live before the retirement and is not caused by it.
   *
   * Black is not a placeholder value, it is the honest one: every reader composites additively, so a black
   * stand-in contributes nothing.
   */
  private fallbackBlackTex: WebGLTexture | null = null;

  /* ----------------------------------------------------------------------------------------------
   * v8 Step 15.1 (E84) — iso-surface `liquid` resources (created only when renderMode === 'liquid')
   * ----------------------------------------------------------------------------------------------
   *
   * Deliberately a set of handles of its own rather than a reuse of the retired `log-density` pair, even
   * though both accumulated into an R32F target. That mode's normalise pass divided by `solidCount * 0.01`
   * and its base size 2.0 was exempt from canvas scaling — a divisor and an exemption that were EXPOSURE
   * calibration for a pass which COUNTED fragments, so thresholding it would have silently changed a
   * shipped mode's look. (`liquid` also accumulates a smooth kernel where that pass wrote a flat 1.0, so
   * even the accumulation shaders differed.) **The reasoning is kept as history**: it is the argument for
   * why an accumulate-then-resolve mode needs its own pair, and the next such mode will need it again.
   */
  private liquidFBO: WebGLFramebuffer | null = null;
  private liquidTex: WebGLTexture | null = null;
  /**
   * v8 Step 15.2 (E85). The SECOND accumulation target, written by the same draw as `liquidTex` via
   * `gl.drawBuffers` — `RGB = Σ(colour·w)`, `A = Σw`, so the surface pass recovers each pixel's
   * weighted-mean particle colour as `RGB/A`.
   *
   * ⚠️ **`A` DUPLICATES `liquidTex` AND THAT IS NOT REDUNDANCY.** The two targets have different formats
   * (R32F vs RGBA16F), so `Σw` computed in half precision does not equal the R32F sum; dividing the RGBA16F
   * numerator by the R32F denominator leaves a per-pixel gain that GROWS with the contributor count, i.e.
   * is largest exactly in the blob interior where the mixing is supposed to be smoothest.
   *
   * ⚠️ **What the own-alpha form buys is CORRELATED error, not exact cancellation — my first version of this
   * comment claimed the latter and it is false.** Half float stalls a numerator term `c·w` at a different
   * accumulation step from its own denominator term `w`, so a bias survives either way; the ratio is better
   * because both sums stall at the *same steps*, so it keeps only their difference. Measured over
   * Wyvill-distributed weights: mean relative bias at 2048 contributors (`Σw ≈ 513`) is **−0.53 %**
   * own-alpha against **−2.52 %** cross-format, a factor of **4.7**, both under one 8-bit step below a few
   * hundred contributors. Monotone in the count either way, which is what makes the worse form read as a
   * brightness gradient rather than as noise.
   *
   * ⚠️ **RGBA16F, not RGBA32F, and the choice is bounded by measurement rather than taste.** `Σ(colour·w)`
   * is at most `Σw` (colours are ≤ 1), and the densest measured pixel on the library's liquid figures
   * carries a `Σw` of order 10²; half float is exact to 2048 and finite to 65504, so there is no overflow
   * path here — whereas `liquidTex` stays R32F because its `Σw` is the quantity the THRESHOLD is compared
   * against and 15.1b's reference arithmetic is derived in full precision.
   */
  private liquidColorTex: WebGLTexture | null = null;
  /** Accumulates the Wyvill field. Point sprites, additive, into `liquidTex` + `liquidColorTex`. */
  private liquidAccumProgram: WebGLProgram | null = null;
  /** Thresholds `liquidTex` and shades the surface. Fullscreen quad. */
  private liquidSurfaceProgram: WebGLProgram | null = null;
  private liquidSurfaceVao: WebGLVertexArrayObject | null = null;
  private liquidQuadBuffer: WebGLBuffer | null = null;
  /**
   * 256×1 LUT for `tintSource: 'ramp'`, and the reason it exists as its OWN texture rather than borrowing
   * `rampTexture`: that one is the MATERIAL's ramp (always `'fire'` at init, re-uploaded by
   * `setMaterialConfig`), and `tintSource: 'ramp'` is explicitly the source that does not depend on a
   * material being live. Sharing it would make the liquid's colour change when a material was selected.
   */
  private liquidRampTex: WebGLTexture | null = null;
  /** The ramp name currently UPLOADED, so `setLiquidConfig` re-uploads only on a change — as `setCrystalConfig` does. */
  private liquidRampUploaded: ColourRampName | null = null;
  private uLiquidAccResolution: WebGLUniformLocation | null = null;
  private uLiquidAccSize: WebGLUniformLocation | null = null;
  private uLiquidAccMaxPointSize: WebGLUniformLocation | null = null;
  private uLiquidSurfDensity: WebGLUniformLocation | null = null;
  private uLiquidSurfRamp: WebGLUniformLocation | null = null;
  private uLiquidSurfPalette: WebGLUniformLocation | null = null;
  private uLiquidSurfIsoRef: WebGLUniformLocation | null = null;
  private uLiquidSurfThickRef: WebGLUniformLocation | null = null;
  private uLiquidSurfSoftness: WebGLUniformLocation | null = null;
  private uLiquidSurfTintSource: WebGLUniformLocation | null = null;
  private uLiquidSurfPaletteEnabled: WebGLUniformLocation | null = null;
  private uLiquidSurfResolution: WebGLUniformLocation | null = null;
  private uLiquidSurfTint: WebGLUniformLocation | null = null;
  /** v8 Step 15.2. `Σ(colour·w)` / `Σw` sampler, the mix weight, and the categorical mix model. */
  private uLiquidSurfColor: WebGLUniformLocation | null = null;
  private uLiquidSurfColourMix: WebGLUniformLocation | null = null;
  private uLiquidSurfMixModel: WebGLUniformLocation | null = null;
  /** v8 Step 15.7. The advected dye field's sampler — see `setDyeTexture` for who owns the texture. */
  private uLiquidSurfDye: WebGLUniformLocation | null = null;
  /**
   * v8 Step 15.7, added 2026-09-03 with the scale-invariance fix. Converts the dye field's ACCUMULATED
   * WEIGHT into a saturation, which is the only way Dye Amount and Dye Decay reach the screen at all — the
   * `rgb / a` hue read divides both of them out. Derived, not tuned: see the shader's own block.
   */
  private uLiquidSurfDyeSatK: WebGLUniformLocation | null = null;
  /**
   * v8 Step 15.7. The dye field, **OWNED BY `DyeFieldProcessor` AND MERELY BORROWED HERE.**
   *
   * ⚠️ **THIS RENDERER MUST NOT DELETE IT IN `dispose()`** — it did not create it. `dispose()` nulls the
   * reference only, exactly as the palette texture handed in by `setPaletteTexture` is treated. Deleting a
   * borrowed handle is invariant 1 inverted: the OWNER's non-null field would then name a freed object and
   * every one of its draws would be a silent no-op.
   *
   * ⚠️ **And it must be re-handed after a `dispose()`/`init()` round trip** — a render-mode change, a film
   * look or a preset switch takes that path, and this field is nulled by it. `reapplyRendererState()` in
   * `main.ts` is the single owner of that re-handing (invariant 2), which is why it is not restored here.
   */
  private dyeTexture: WebGLTexture | null = null;
  /**
   * v8 Step 15.3. The surface material's four controls, plus the CLAMPED sprite radius the chromatic
   * dispersion offset is a fraction of — see `REFRACT_SPREAD` for why that is a kernel fraction and not a
   * texel count.
   */
  private uLiquidSurfRefraction: WebGLUniformLocation | null = null;
  private uLiquidSurfSpecular: WebGLUniformLocation | null = null;
  private uLiquidSurfThickness: WebGLUniformLocation | null = null;
  private uLiquidSurfEdgeBright: WebGLUniformLocation | null = null;
  private uLiquidSurfRadius: WebGLUniformLocation | null = null;
  /**
   * The live config. ⚠️ **Never null and never partially populated** — `main.ts` merges
   * `DEFAULT_LIQUID_CONFIG` first (invariant 14), and this field is seeded with the defaults so a renderer
   * that is never told about liquid still uploads finite uniforms rather than `undefined` → NaN.
   */
  private liquidConfig: LiquidSurfaceConfig = { ...DEFAULT_LIQUID_CONFIG };
  /**
   * The temporally smoothed density reference (v8 15.1b). `0` means "no history", so the first frame after a
   * discontinuity SNAPS instead of gliding up from nothing — a reference of 0 would put the threshold at 0
   * and flood the frame for a quarter of a second.
   */
  private liquidRefSmoothed = 0;

  // Volume render resources
  private volumeAccumFBO: WebGLFramebuffer | null = null;
  private volumeAccumTex: WebGLTexture | null = null;
  private volumeAccumProgram: WebGLProgram | null = null;
  private volumeResolveProgram: WebGLProgram | null = null;
  private volumeResolveVao: WebGLVertexArrayObject | null = null;
  private volumeAccumVao: WebGLVertexArrayObject | null = null;
  private volumeUResolution: WebGLUniformLocation | null = null;
  private volumeUSplatRadius: WebGLUniformLocation | null = null;
  private volumeUDepthFade: WebGLUniformLocation | null = null;
  private volumeUDensityScale: WebGLUniformLocation | null = null;
  private volumeURampTex: WebGLUniformLocation | null = null;
  private volumeUUseRamp: WebGLUniformLocation | null = null;
  private volumeUDensityTex: WebGLUniformLocation | null = null;
  private volumeUExtinction: WebGLUniformLocation | null = null;
  private volumeUParticleSize: WebGLUniformLocation | null = null;
  private volumeUDepthSize: WebGLUniformLocation | null = null;
  private volumeUDepthDof: WebGLUniformLocation | null = null;
  private volumeUMaxPointSize: WebGLUniformLocation | null = null;
  // The five volume VAO buffers, formerly `__`-stashed on the VAO objects (triage I2).
  private volumeAccumPosBuffer: WebGLBuffer | null = null;
  private volumeAccumTempBuffer: WebGLBuffer | null = null;
  private volumeAccumDepthBuffer: WebGLBuffer | null = null;
  private volumeAccumColorBuffer: WebGLBuffer | null = null;
  private volumeResolveQuadBuffer: WebGLBuffer | null = null;
  private volumeConfig: VolumeRenderConfig = { extinction: 3.0, densityScale: 1.0, depthFade: 0.3 };

  private width = 800;
  private height = 600;
  private glow = 2.0;
  private depthSize = 0.0;
  private flameExpansion = 0.0;
  private smokeThreshold = 0.25;
  private smokeOpacity = 0.4;
  private depthBrightness = 0.0;
  private depthDof = 0.0;
  private depthColorShift = 0.0;
  /**
   * Global particle size multiplier — `overlay.particleSize`, 0.25–4, default 1.
   *
   * ⚠️ **Written by `setParticleSize()` only, and `dispose()` does NOT clear it**, unlike the film-look
   * fields: `reinitRenderer` re-hands it through `reapplyRendererState` regardless, and a field that
   * survives a dispose cannot be the invariant-1 shape (a stale HANDLE) because it is a plain number.
   *
   * Applies to every PARTICLE path — point (pixel/blend/star), volume accumulation, the liquid kernel and the
   * material splat quads — and deliberately NOT to crystals, which keep their own Crystal Size slider.
   * `renderCrystalOnly` therefore writes 1.0 into the shared splat program's `uParticleSize`.
   */
  private particleSize = 1.0;
  /**
   * 27.6 — which cross-axis the splat quad is sheared along. `false` is the pre-27.6 behaviour.
   *
   * ⚠️ **Written by `setSplatShear()` only, and like `particleSize` it must be re-handed by
   * `reapplyRendererState()` after a `reinitRenderer()`** — invariant 2. It is a plain boolean, so it
   * cannot be the invariant-1 shape (a stale HANDLE), but a renderer rebuilt without it reverts the
   * look silently, which is the failure this project keeps paying for.
   */
  private splatShearFixed = false;
  /**
   * `sparks.splatRadius` — the size a SPARK draws at, in the same units as `MaterialConfig.splatRadius`.
   *
   * ⚠️ **`null` is the neutral state and means "size sparks exactly like everything else", which is the
   * pre-2026-08-29 behaviour byte-for-byte.** It is what `dispose()` restores and what the field holds
   * until `setSparkRadius()` is called, so a renderer that is never told about sparks cannot accidentally
   * resize them. `renderSplat` uploads `-1.0` for it, the shader's own sentinel.
   *
   * ⚠️ **Set to `null` when sparks are DISABLED, not to the authored radius.** The generator stops
   * publishing spark slots the instant the toggle goes off, so the range would be empty anyway and the
   * value inert — but keeping the two in agreement means the uniform never describes a population that is
   * not there, which is the shape invariant 3 warns about (a flag outliving its resource).
   */
  private sparkRadius: number | null = null;
  private lightingMode = 0;
  private lightDir: [number, number, number] = [0.5, -0.7, 0.3];
  private rimPower = 3.0;
  private renderMode: RenderMode = 'star';

  init(backend: ComputeBackend, config: RendererConfig): void {
    const glBackend = backend as unknown as WebGL2Backend;
    this.gl = glBackend.gl;
    this.glow = config.glow;
    this.depthSize = config.depthSize;
    this.renderMode = config.mode;

    const gl = this.gl;
    this.program = compileProgram(gl, VERT_SRC, FRAG_SRC, 'HDRParticle point');

    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
    this.uGlow = gl.getUniformLocation(this.program, 'uGlow');
    this.uDepthSize = gl.getUniformLocation(this.program, 'uDepthSize');
    this.uDepthBrightness = gl.getUniformLocation(this.program, 'uDepthBrightness');
    this.uDepthDof = gl.getUniformLocation(this.program, 'uDepthDof');
    this.uDepthColorShift = gl.getUniformLocation(this.program, 'uDepthColorShift');
    this.uRenderMode = gl.getUniformLocation(this.program, 'uRenderMode');
    this.uParticleSize = gl.getUniformLocation(this.program, 'uParticleSize');
    this.uHideBelowIndex = gl.getUniformLocation(this.program, 'uHideBelowIndex');
    this.uMaxPointSize = gl.getUniformLocation(this.program, 'uMaxPointSize');
    this.uLightingMode = gl.getUniformLocation(this.program, 'uLightingMode');
    this.uLightDir = gl.getUniformLocation(this.program, 'uLightDir');
    this.uRimPower = gl.getUniformLocation(this.program, 'uRimPower');
    this.uPaletteTex = gl.getUniformLocation(this.program, 'uPaletteTex');
    this.uPaletteEnabled = gl.getUniformLocation(this.program, 'uPaletteEnabled');
    this.uPaletteHueShift = gl.getUniformLocation(this.program, 'uPaletteHueShift');
    this.uPaletteMapping = gl.getUniformLocation(this.program, 'uPaletteMapping');

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.posBuffer = gl.createBuffer();
    const aPosition = gl.getAttribLocation(this.program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    this.colorBuffer = gl.createBuffer();
    const aColor = gl.getAttribLocation(this.program, 'aColor');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

    this.depthBuffer = gl.createBuffer();
    const aDepth = gl.getAttribLocation(this.program, 'aDepth');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.depthBuffer);
    gl.enableVertexAttribArray(aDepth);
    gl.vertexAttribPointer(aDepth, 1, gl.FLOAT, false, 0, 0);

    this.velocityBuffer = gl.createBuffer();
    const aVelocity = gl.getAttribLocation(this.program, 'aVelocity');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.velocityBuffer);
    gl.enableVertexAttribArray(aVelocity);
    gl.vertexAttribPointer(aVelocity, 1, gl.FLOAT, false, 0, 0);

    // B14: temperature attribute for the point path. Always enabled and always uploaded — an enabled
    // attribute with no bound data reads undefined values, which on some drivers is stale GPU memory
    // rather than zero.
    this.pointTempBuffer = gl.createBuffer();
    const aPointTemp = gl.getAttribLocation(this.program, 'aPointTemp');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointTempBuffer);
    gl.enableVertexAttribArray(aPointTemp);
    gl.vertexAttribPointer(aPointTemp, 1, gl.FLOAT, false, 0, 0);

    this.pointAgeBuffer = gl.createBuffer();
    const aPointAge = gl.getAttribLocation(this.program, 'aPointAge');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointAgeBuffer);
    gl.enableVertexAttribArray(aPointAge);
    gl.vertexAttribPointer(aPointAge, 1, gl.FLOAT, false, 0, 0);

    /*
     * v8 `31.2` — the packed per-particle channels, `vec3`, PER-VERTEX (no divisor: this path draws
     * `gl.drawArrays(POINTS, …)`, not instanced quads).
     *
     * ⚠️ **ADDING AN ENABLED ATTRIBUTE TO `this.vao` IS NOT FREE, because the liquid accumulation program
     * SHARES this VAO** — and it reads its attribute locations off `this.program` at init time precisely
     * so the two cannot disagree. That derivation still holds here: whatever the linker gives `aChannels`
     * is a location the liquid shader does not declare, so its array is simply an enabled one it ignores.
     * **What makes that safe is that the buffer always has data** — see the upload site, which runs every
     * frame whether the feature is on or off.
     */
    this.channelsBuffer = gl.createBuffer();
    const aChannels = gl.getAttribLocation(this.program, 'aChannels');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.channelsBuffer);
    gl.enableVertexAttribArray(aChannels);
    gl.vertexAttribPointer(aChannels, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // The 1×1 black sampler stand-in — see the field doc. UNCONDITIONAL and before every mode-gated
    // init below, because two of them read it and a mode-gated creation is what left it null in `liquid`.
    // NEAREST + CLAMP_TO_EDGE so the texture is complete without a mip chain.
    this.fallbackBlackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fallbackBlackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Splat resources (only when mode is splat)
    if (config.mode === 'splat') {
      this.initSplat(gl);
    }

    // Volume resources (only when mode is volume)
    if (config.mode === 'volume') {
      this.initSplat(gl); // volume reuses splat VAO for accumulation
      this.initVolume(gl);
    }

    // v8 Step 15.1: liquid resources (only when mode is liquid). ⚠️ It reuses `this.vao` for the
    // accumulation draw — the positions are the same six buffers the point path already uploads — so it
    // needs no VAO of its own, only the R32F target and the fullscreen surface pass. Placed BEFORE the
    // unconditional `initSplat` below so that `initLiquid`'s fallback to `'star'` is decided while
    // `this.renderMode` is still what the caller asked for.
    if (config.mode === 'liquid') {
      this.initLiquid(gl);
    }

    // v8 Phase 8a: the crystal pass is drawn with the splat program, but crystal must work in
    // EVERY render mode (most presets use 'star'), so ensure the program exists even when the
    // mode would not otherwise create it. Cheap: initSplat allocates a program, a VAO and
    // per-instance buffers — no FBO and no texture beyond two 256x1 ramps.
    if (!this.splatProgram) {
      this.initSplat(gl);
    }

    // Query hardware point size limit
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
    if (range) this.maxPointSize = range[1] ?? 64.0;
  }

  private initSplat(gl: WebGL2RenderingContext): void {
    this.splatProgram = compileProgram(gl, SPLAT_VERT_SRC, SPLAT_FRAG_SRC, 'HDRParticle splat');

    this.splatUResolution = gl.getUniformLocation(this.splatProgram, 'uResolution');
    this.splatUSplatRadius = gl.getUniformLocation(this.splatProgram, 'uSplatRadius');
    this.splatUDepthSize = gl.getUniformLocation(this.splatProgram, 'uDepthSize');
    this.splatUDepthDof = gl.getUniformLocation(this.splatProgram, 'uDepthDof');
    this.splatUParticleSize = gl.getUniformLocation(this.splatProgram, 'uParticleSize');
    this.splatUHideBelowIndex = gl.getUniformLocation(this.splatProgram, 'uHideBelowIndex');
    this.splatUSparkRadius = gl.getUniformLocation(this.splatProgram, 'uSparkRadius');
    this.splatUSparkFirst = gl.getUniformLocation(this.splatProgram, 'uSparkFirst');
    this.splatUSparkLast = gl.getUniformLocation(this.splatProgram, 'uSparkLast');
    this.splatUFlameExpansion = gl.getUniformLocation(this.splatProgram, 'uFlameParams');
    this.splatUCoreBrightness = gl.getUniformLocation(this.splatProgram, 'uCoreBrightness');
    this.splatUHaloStrength = gl.getUniformLocation(this.splatProgram, 'uHaloStrength');
    this.splatUFalloffExponent = gl.getUniformLocation(this.splatProgram, 'uFalloffExponent');
    this.splatUGlow = gl.getUniformLocation(this.splatProgram, 'uGlow');
    // B14: film-look palette inside the splat program.
    this.splatUSplatPaletteTex = gl.getUniformLocation(this.splatProgram, 'uSplatPaletteTex');
    this.splatUSplatPaletteEnabled = gl.getUniformLocation(this.splatProgram, 'uSplatPaletteEnabled');
    this.splatUSplatPaletteMapping = gl.getUniformLocation(this.splatProgram, 'uSplatPaletteMapping');
    this.splatUEmissionIntensity = gl.getUniformLocation(this.splatProgram, 'uEmissionIntensity');
    this.splatURampTex = gl.getUniformLocation(this.splatProgram, 'uRampTex');
    this.splatUParticleCount = gl.getUniformLocation(this.splatProgram, 'uParticleCount');
    this.splatUIsAdditive = gl.getUniformLocation(this.splatProgram, 'uIsAdditive');

    // Smoke uniforms
    this.splatUSmokeThreshold = gl.getUniformLocation(this.splatProgram, 'uSmokeThreshold');
    this.splatUSmokeOpacity = gl.getUniformLocation(this.splatProgram, 'uSmokeOpacity');
    this.splatURenderPass = gl.getUniformLocation(this.splatProgram, 'uRenderPass');
    this.splatUSmokeRampTex = gl.getUniformLocation(this.splatProgram, 'uSmokeRampTex');

    // v8 Phase 8a crystal uniforms
    this.splatUFacetSharpness = gl.getUniformLocation(this.splatProgram, 'uFacetSharpness');
    this.splatUCrystalShape = gl.getUniformLocation(this.splatProgram, 'uCrystalShape');
    this.splatUSpecularStrength = gl.getUniformLocation(this.splatProgram, 'uSpecularStrength');
    this.splatUIceOpacity = gl.getUniformLocation(this.splatProgram, 'uIceOpacity');
    this.splatUEdgeBrightness = gl.getUniformLocation(this.splatProgram, 'uEdgeBrightness');
    this.splatUInternalRefraction = gl.getUniformLocation(this.splatProgram, 'uInternalRefraction');
    this.splatUCrystalRampTex = gl.getUniformLocation(this.splatProgram, 'uCrystalRampTex');
    // v8 Phase 8a-2 increment (c) — swelling ceiling. The splat program is SHARED with the live and
    // material passes, so this must be set on every path that uses it (see renderSplat), not just
    // the crystal pass: a leftover 1.8 would be harmless there (the branch is gated on aFrozen) but
    // an unset 0.0 reaching the crystal pass would not be.
    this.splatUMaxGrowth = gl.getUniformLocation(this.splatProgram, 'uMaxGrowth');
    this.splatUSplatShearFixed = gl.getUniformLocation(this.splatProgram, 'uSplatShearFixed');

    this.splatVao = gl.createVertexArray();
    gl.bindVertexArray(this.splatVao);

    // Static quad template (TRIANGLE_STRIP: BL, BR, TL, TR)
    const quadBuffer = gl.createBuffer()!;
    const quadData = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
    const aQuadPos = gl.getAttribLocation(this.splatProgram, 'aQuadPos');
    gl.enableVertexAttribArray(aQuadPos);
    gl.vertexAttribPointer(aQuadPos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aQuadPos, 0); // per-vertex

    // Per-instance position buffer
    const splatPosBuffer = gl.createBuffer()!;
    const aPosition = gl.getAttribLocation(this.splatProgram, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, splatPosBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPosition, 1); // per-instance

    // Per-instance temperature buffer
    this.temperatureBuffer = gl.createBuffer()!;
    const aTemp = gl.getAttribLocation(this.splatProgram, 'aTemperature');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.temperatureBuffer);
    gl.enableVertexAttribArray(aTemp);
    gl.vertexAttribPointer(aTemp, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aTemp, 1); // per-instance

    // Per-instance depth buffer
    const splatDepthBuffer = gl.createBuffer()!;
    const aDepth = gl.getAttribLocation(this.splatProgram, 'aDepth');
    gl.bindBuffer(gl.ARRAY_BUFFER, splatDepthBuffer);
    gl.enableVertexAttribArray(aDepth);
    gl.vertexAttribPointer(aDepth, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aDepth, 1); // per-instance

    // Per-instance velocity direction buffer
    const velDirBuffer = gl.createBuffer()!;
    const aVelDir = gl.getAttribLocation(this.splatProgram, 'aVelocityDir');
    gl.bindBuffer(gl.ARRAY_BUFFER, velDirBuffer);
    gl.enableVertexAttribArray(aVelDir);
    gl.vertexAttribPointer(aVelDir, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aVelDir, 1); // per-instance

    // B14 follow-up: normalised SPEED and the preset's own COLOUR, as separate per-instance attributes.
    //
    // Needed because `aVelocityDir` is unit-length (the generator normalises it), so it carries direction
    // only and cannot serve palette mapping 2. And mapping 1 (phase) needs the preset's oscillating colour;
    // deriving it from the already-temperature-indexed ramp made phase a duplicate of temperature.
    const splatVelBuffer = gl.createBuffer()!;
    const aSplatVel = gl.getAttribLocation(this.splatProgram, 'aSplatVelocity');
    gl.bindBuffer(gl.ARRAY_BUFFER, splatVelBuffer);
    gl.enableVertexAttribArray(aSplatVel);
    gl.vertexAttribPointer(aSplatVel, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aSplatVel, 1);

    const splatColBuffer = gl.createBuffer()!;
    const aSplatCol = gl.getAttribLocation(this.splatProgram, 'aColorSplat');
    gl.bindBuffer(gl.ARRAY_BUFFER, splatColBuffer);
    gl.enableVertexAttribArray(aSplatCol);
    gl.vertexAttribPointer(aSplatCol, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aSplatCol, 1);

    const splatAgeBuffer = gl.createBuffer()!;
    const aSplatAge = gl.getAttribLocation(this.splatProgram, 'aSplatAge');
    gl.bindBuffer(gl.ARRAY_BUFFER, splatAgeBuffer);
    gl.enableVertexAttribArray(aSplatAge);
    gl.vertexAttribPointer(aSplatAge, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aSplatAge, 1);

    // Per-instance frozen flag buffer (v8 Phase 8a). Float rather than int so it uses the same
    // vertexAttribPointer path as every other per-instance attribute here.
    const frozenBuffer = gl.createBuffer()!;
    const aFrozen = gl.getAttribLocation(this.splatProgram, 'aFrozen');
    gl.bindBuffer(gl.ARRAY_BUFFER, frozenBuffer);
    gl.enableVertexAttribArray(aFrozen);
    gl.vertexAttribPointer(aFrozen, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aFrozen, 1); // per-instance

    // Per-instance crystal growth buffer (v8 Phase 8a-2, T021). Mirrors the frozen buffer above.
    // Like it, this MUST be re-uploaded at full instance length every frame in every pass: the
    // crystal pass writes a short array sized to the frozen count, so a pass that skips its own
    // upload would read stale or out-of-range values.
    const growthBuffer = gl.createBuffer()!;
    const aGrowth = gl.getAttribLocation(this.splatProgram, 'aGrowth');
    gl.bindBuffer(gl.ARRAY_BUFFER, growthBuffer);
    gl.enableVertexAttribArray(aGrowth);
    gl.vertexAttribPointer(aGrowth, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aGrowth, 1); // per-instance

    // v8 31.2 — the packed channels, PER-INSTANCE here (divisor 1) because this path draws one quad per
    // particle. ⚠️ **The crystal pass shares this VAO, so it must upload this buffer too** — at its own
    // shorter length and filled with ONES, not the zeros it writes into the palette attributes. See its
    // upload site: zeros here would be size 0 and the ice would vanish.
    const splatChannelsBuffer = gl.createBuffer()!;
    const aSplatChannels = gl.getAttribLocation(this.splatProgram, 'aSplatChannels');
    gl.bindBuffer(gl.ARRAY_BUFFER, splatChannelsBuffer);
    gl.enableVertexAttribArray(aSplatChannels);
    gl.vertexAttribPointer(aSplatChannels, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aSplatChannels, 1); // per-instance

    gl.bindVertexArray(null);

    // Store buffer refs. Every one of these nine MUST also appear in dispose()'s release list — three
    // of them did not until 2026-08-12, which leaked a buffer per render-mode/film-look/TransMap change.
    this.splatPosBuffer = splatPosBuffer;
    this.splatDepthBuffer = splatDepthBuffer;
    this.splatQuadBuffer = quadBuffer;
    this.splatVelDirBuffer = velDirBuffer;
    this.splatVelBuffer = splatVelBuffer;
    this.splatColBuffer = splatColBuffer;
    this.splatAgeBuffer = splatAgeBuffer;
    this.splatFrozenBuffer = frozenBuffer;
    this.splatGrowthBuffer = growthBuffer;
    this.splatChannelsBuffer = splatChannelsBuffer;   // v8 31.2 — and in dispose()'s release list

    // Colour ramp texture
    this.rampTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
    const rampData = getColourRampData('fire');
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Smoke ramp texture (warm brown-grey, transitions smoothly toward fire colors)
    this.smokeRampTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.smokeRampTexture);
    const smokeRampData = getColourRampData('fire-smoke');
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, smokeRampData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // v8 Phase 8a crystal ramp (swapped by setCrystalConfig; 'ice' is the default look).
    // RF-02: seed from the LIVE config rather than a hardcoded 'ice'. dispose() nulls
    // crystalRampTexture but deliberately leaves crystalConfig populated, so a
    // dispose()/init() round-trip (preset switch via arrow keys, Visual FX render-mode change,
    // material auto-switch) would otherwise silently revert a non-'ice' ramp to ice while
    // getCrystalConfig() still reported the chosen one — state and render disagreeing, which
    // is the exact defect class RF-02 exists to eliminate. Fixing it here covers every
    // dispose()/init() path at once instead of requiring a re-set call after each.
    this.crystalRampTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.crystalRampTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      getColourRampData(this.crystalConfig?.crystalRamp ?? 'ice'));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  setFlameExpansion(value: number): void {
    this.flameExpansion = value;
  }

  setSmokeParams(threshold: number, opacity: number): void {
    this.smokeThreshold = threshold;
    this.smokeOpacity = opacity;
  }

  /**
   * v8 Phase 8a — Faceted Crystal. Passing a config with `enabled: false` (or null) leaves the
   * crystal pass switched off, so output stays pixel-identical to a build without the feature.
   */
  setCrystalConfig(config: CrystalRenderConfig | null): void {
    const rampChanged =
      config != null && this.crystalConfig?.crystalRamp !== config.crystalRamp;
    this.crystalConfig = config;
    if (config && rampChanged && this.crystalRampTexture && this.gl) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.crystalRampTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        getColourRampData(config.crystalRamp));
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  /**
   * Draw frozen particles as faceted, alpha-occluding crystal.
   *
   * Called BEFORE the additive/material passes so crystals occlude the glow behind them.
   * Frozen particles are sorted back-to-front by the existing per-particle `depths` array —
   * the pipeline has no depth buffer (Z is discarded once particles reach the 2D trail
   * buffer), so painting order is the only way to get correct overlap.
   */
  /**
   * Draw only the frozen crystals, without the additive particle pass.
   *
   * `render()` already calls the crystal pass internally, but `main.ts` routes through an
   * if/else-if/else chain: neon lines OR ribbons OR this renderer. When ribbon or neon mode is
   * active, `render()` is never reached and crystals would silently disappear. This entry point
   * lets those branches draw the crystals themselves.
   *
   * Self-guarded: no-ops when crystal is disabled, when nothing is frozen, or when the splat
   * program is unavailable — so calling it unconditionally is safe and free.
   */
  renderCrystalOnly(state: GeneratorState): void {
    if (!this.gl) return;
    this.renderCrystalPass(state);
  }

  /**
   * H5 — the per-frame allocations here are hoisted into grow-only scratch fields, and the depth sort
   * no longer boxes.
   *
   * ⚠️ **The triage row named allocation TIME as the cost, and that half is negligible.** Measured
   * against a persistent-scratch equivalent, the eight `new Float32Array` calls below cost
   * **0.000–0.003 ms** at 600–2000 crystals — against a 16.7 ms frame. Do not re-derive this item from
   * "allocation is slow"; it is not, and a future reader chasing that framing will find nothing.
   *
   * Two costs the row did not mention are real:
   *
   * - **GC churn.** 53 KB/frame at 600 crystals + 500 sparks and 189 KB/frame at 2000 + 2000, i.e.
   *   **3.1–11.1 MB/s** of garbage whose collection lands as an unpredictable hitch rather than as
   *   per-frame time. This is what the scratch fields address; they are read back through
   *   `subarray(0, n)`, so a shrinking population reuses the buffer instead of reallocating.
   * - **The depth sort**, which is the only measurable *time* in this function. `Array.prototype.slice`
   *   produced a **boxed** JS array and `sort()` then called a JS comparator once per comparison:
   *   0.058 ms at 600 crystals and 0.251 ms at 2000. Both gone below.
   *
   * The sort is now comparator-free, over a `Float64Array` of packed keys:
   * `key = (2^32-1 - round(depth * (2^32-1))) * 2^20 + index`. The high field inverts depth so a plain
   * ascending numeric sort yields the back-to-front order this pass needs; the low 20 bits carry the
   * index, recovered with `% 2^20`. Measured **3.5–3.7×** (0.058 → 0.016 ms, 0.251 → 0.072 ms).
   *
   * Three preconditions, all verified rather than assumed — this is exact, not an approximation:
   * - `depths[i]` is in **[0,1]** at every writer (`lissajous.ts` clamps it, the spark pad is 0.5, and
   *   `CrystalPool` clamps explicitly), so the quantisation cannot overflow its field.
   * - The largest key is `(2^32-1) * 2^20 + 2^20-1` = 4.50e15, inside `Number.MAX_SAFE_INTEGER`
   *   (9.01e15), so every key is an exact integer and the decode round-trips — checked over 200 000
   *   random (depth, index) pairs with zero failures.
   * - 2^20 = 1 048 576 bounds the index, against a hard ceiling of `MAX_PARTICLE_COUNT` (50 000) plus
   *   the spark and crystal blocks (≤ 2000 each) — a factor of ~19 in hand.
   * - Depth resolution is the **full 32 bits**, well finer than the `Float32Array` the values come from,
   *   so the resulting order is bit-identical to the old comparator's. Verified: zero depth-sequence
   *   mismatches against the boxed sort at both populations.
   */
  private renderCrystalPass(state: GeneratorState): void {
    const gl = this.gl!;
    const cfg = this.crystalConfig;
    const frozen = state.frozen;
    if (!cfg || !cfg.enabled || !frozen || !this.splatProgram || !this.splatVao) return;

    // Collect frozen indices.
    if (this.frozenSortIdx.length < state.count) this.frozenSortIdx = new Int32Array(state.count);
    let n = 0;
    for (let i = 0; i < state.count; i++) if (frozen[i] === 1) this.frozenSortIdx[n++] = i;
    if (n === 0) return;

    // Sort back-to-front. depths are normalised [0,1]; larger = further from camera, so the packed key
    // inverts depth, making a plain ascending numeric sort paint far crystals first.
    const depths = state.depths;
    if (this.crystalSortKeys.length < n) this.crystalSortKeys = new Float64Array(n);
    const keys = this.crystalSortKeys.subarray(0, n);
    for (let k = 0; k < n; k++) {
      const i = this.frozenSortIdx[k]!;
      // Clamped LOCALLY even though every writer already clamps to [0,1] (see the note above). The
      // packing means a rogue depth is no longer merely mis-ordered: it would overflow into the index
      // field and decode to the wrong particle. NaN is the case that matters most — it fails both
      // comparisons below and so lands on 0, whereas `Math.round(NaN)` would make the whole key NaN and
      // `NaN % CRYSTAL_INDEX_BASE` would index nothing, filling the attribute buffers with NaN and
      // dropping the draw. The old comparator degraded to a merely wrong paint order, so this guard is
      // what keeps the failure mode no worse than it was.
      const raw = depths[i]!;
      const d = raw >= 0 ? (raw <= 1 ? raw : 1) : 0;
      keys[k] = (CRYSTAL_DEPTH_QUANT - Math.round(d * CRYSTAL_DEPTH_QUANT)) * CRYSTAL_INDEX_BASE + i;
    }
    keys.sort();

    // Build per-instance arrays in sorted order.
    if (this.crystalPos.length < n * 2) {
      this.crystalPos = new Float32Array(n * 2);
      this.crystalVel = new Float32Array(n * 2);
    }
    if (this.crystalDep.length < n) {
      this.crystalDep = new Float32Array(n);
      this.crystalFrz = new Float32Array(n);
      this.crystalGro = new Float32Array(n);
    }
    const pos = this.crystalPos.subarray(0, n * 2);
    const dep = this.crystalDep.subarray(0, n);
    const vel = this.crystalVel.subarray(0, n * 2);
    const frz = this.crystalFrz.subarray(0, n);
    // T021: growth MUST be built inside this same SORTED loop, keyed by the index decoded from keys[k].
    // Filling it in raw particle-index order while every other attribute is depth-sorted would give each
    // crystal another crystal's growth value — the crystals would still pulse and fade, so it looks
    // alive, but size/alpha would be decorrelated from actual age and it is invisible by eye.
    const gro = this.crystalGro.subarray(0, n);
    const srcVel = state.velocityDirs;
    const srcGrowth = state.growth;
    for (let k = 0; k < n; k++) {
      const i = keys[k]! % CRYSTAL_INDEX_BASE;
      pos[k * 2] = state.positions[i * 3]!;
      pos[k * 2 + 1] = state.positions[i * 3 + 1]!;
      dep[k] = depths[i] ?? 0.5;
      if (srcVel) {
        vel[k * 2] = srcVel[i * 2] ?? 0;
        vel[k * 2 + 1] = srcVel[i * 2 + 1] ?? -1;
      } else {
        vel[k * 2] = 0;
        vel[k * 2 + 1] = -1;
      }
      frz[k] = 1;
      // Absent growth means no lifecycle is running (an externally frozen particle, or a build
      // before 8a-2): fall back to 1 so the crystal draws at full size rather than vanishing.
      gro[k] = srcGrowth ? (srcGrowth[i] ?? 1) : 1;
    }

    gl.useProgram(this.splatProgram);
    gl.bindVertexArray(this.splatVao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatDepthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, dep, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVelDirBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vel, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatFrozenBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, frz, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatGrowthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, gro, gl.DYNAMIC_DRAW);
    // Temperature is unused by the crystal branch but the attribute must be fed.
    // Shares `crystalZeros1` with the two palette attributes below — all four want the same n zeros,
    // and nothing in this pass ever writes into it, so one buffer serves them all.
    if (this.crystalZeros1.length < n) this.crystalZeros1 = new Float32Array(n);
    const zeros1 = this.crystalZeros1.subarray(0, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.temperatureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, zeros1, gl.DYNAMIC_DRAW);

    // Same for the three B14/B16 palette attributes. The crystal pass SHARES splatVao, so every enabled
    // attribute in that VAO is read by this draw too — and this pass draws only `n` crystals, far fewer than
    // the material pass's `state.count`. Leaving them at the material pass's length made the crystal draw
    // read past the end of its own data.
    //
    // This is what turned the whole preview BLACK on selecting a material: the crystal pass runs BEFORE the
    // material passes in `main.ts`, and an out-of-range attribute fetch is undefined behaviour that took the
    // draw — and the frame — with it. My first fix chased a sampler-unit collision, which was a real latent
    // bug but not this one.
    //
    // The crystal branch does not read any of these varyings, so zeros are correct; they only have to be
    // present and correctly sized.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVelBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, zeros1, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatAgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, zeros1, gl.DYNAMIC_DRAW);
    if (this.crystalZeros3.length < n * 3) this.crystalZeros3 = new Float32Array(n * 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatColBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.crystalZeros3.subarray(0, n * 3), gl.DYNAMIC_DRAW);

    /*
     * v8 `31.2` — the packed channels, at THIS pass's own length. ⚠️⚠️ **ONES, NOT THE `crystalZeros3`
     * BUFFER THE THREE LINES ABOVE USE, AND THE ASYMMETRY IS THE WHOLE POINT.** Those three attributes are
     * read by a branch the crystal path never takes, so zeros are merely a correct length. **These are
     * MULTIPLIERS**: a zero would be size 0, alpha 0 and lightness 0 — every crystal invisible, with no
     * error and nothing in the console. The neutral value of a multiplier is 1.
     *
     * The length rule is the one the B14 attributes already carry: this pass draws `n` crystals, far fewer
     * than the material pass's `state.count`, and leaving a longer array bound made the crystal draw read
     * past the end of its own data and took the whole frame with it.
     */
    if (this.channelPad.length < n * 3) {
      this.channelPad = new Float32Array(n * 3);
      this.channelPad.fill(1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatChannelsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.channelPad.subarray(0, n * 3), gl.DYNAMIC_DRAW);

    // 8a-4: crystals size themselves from their OWN crystalSize, per-shape compensated, instead of
    // borrowing MaterialConfig.splatRadius. Borrowing meant crystals could not be resized at all
    // without a material active, and left every shape pinned to one radius despite filling very
    // different fractions of the quad.
    // NOT clamped to maxPointSize. That limit is ALIASED_POINT_SIZE_RANGE (commonly 64), which
    // applies to gl_PointSize point sprites; the crystal pass draws instanced TRIANGLE_STRIP quads
    // (see drawArraysInstanced below) whose size is ordinary vertex maths with no such ceiling.
    // Clamping here would silently cap the Crystal Size slider at 64 on most GPUs.
    const radius = crystalSizeFor(cfg);
    gl.uniform2f(this.splatUResolution, this.width, this.height);
    gl.uniform1f(this.splatUSplatRadius, radius);
    gl.uniform1f(this.splatUDepthSize, this.depthSize);
    gl.uniform1f(this.splatUDepthDof, this.depthDof);
    // ⚠️ NEUTRAL 1.0, not `this.particleSize` — crystals are OUT OF SCOPE for the global multiplier by
    // design (2026-08-29), because they have their own Crystal Size slider and stacking a second
    // multiplier on top would make that slider's readout wrong. The splat PROGRAM is shared with the
    // material pass, which sets the live value, so writing it here is load-bearing rather than
    // defensive: the two passes must not depend on draw order. Same shape as `uMaxGrowth` in reverse.
    gl.uniform1f(this.splatUParticleSize, 1.0);
    // v8 28.5. ⚠️ **RESET TO 0, for the same reason T030 resets `uMaxGrowth` here: the splat PROGRAM is
    // shared with the crystal pass.** A crystal is NOT part of the curve (28.D3 keeps crystals drawing
    // when the figure is hidden), but crystal instance ids start at 0 in their own draw — so inheriting
    // the figure's `hideBelowIndex` would cull the first `waveCount` CRYSTALS, i.e. all of them at any
    // realistic curve size. 0 is the identity.
    gl.uniform1i(this.splatUHideBelowIndex, 0);
    // ⚠️ DISABLE the spark size override, and this write is load-bearing for the same shared-program reason
    // as `uParticleSize` above — but with a sharper failure mode. This pass draws a COMPACTED crystal array,
    // so `gl_InstanceID` here is a crystal index, NOT a slot index in the published `[wave][sparks][liquid][crystals]`
    // arrays: whatever spark range the material pass last uploaded would select an arbitrary set of CRYSTALS
    // and draw them at the spark radius. Without this the two passes depend on draw order, and the symptom
    // would be a handful of crystals randomly shrinking on exactly the presets that have sparks.
    gl.uniform1f(this.splatUSparkRadius, -1.0);
    gl.uniform4f(this.splatUFlameExpansion, 0, 0, 0, 0); // no flame shaping for ice

    gl.uniform1i(this.splatURenderPass, 3);
    gl.uniform1f(this.splatUFacetSharpness, cfg.facetSharpness);
    gl.uniform1i(this.splatUCrystalShape, crystalShapeToIndex(cfg.shape));
    gl.uniform1f(this.splatUSpecularStrength, cfg.specularStrength);
    gl.uniform1f(this.splatUIceOpacity, cfg.iceOpacity);
    gl.uniform1f(this.splatUEdgeBrightness, cfg.edgeBrightness);
    gl.uniform1f(this.splatUInternalRefraction, cfg.internalRefraction);
    // T030: the vertex-stage growth clamp's upper bound. Only above 1 while growth is enabled, so a
    // build with growth off is pixel-identical to the pre-swelling code. maxGrowth is clamped
    // rather than trusted: overlay.crystal is a plain JSON block with no import validation, and a
    // swollen quad is a fill-rate cost. Ceiling shared with the pool — see MAX_GROWTH_CEILING.
    const maxGrowth = cfg.growthEnabled === true
      ? Math.max(1, Math.min(MAX_GROWTH_CEILING, cfg.maxGrowth))
      : 1;
    gl.uniform1f(this.splatUMaxGrowth, maxGrowth);
    // 27.6: the splat program is shared, so pin the shear convention to the default here for the same
    // draw-order independence uMaxGrowth is reset for above. A crystal overrides `rotated` outright and
    // never reads `perp`, so this is defensive rather than load-bearing.
    gl.uniform1f(this.splatUSplatShearFixed, 0.0);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.crystalRampTexture);
    gl.uniform1i(this.splatUCrystalRampTex, 2);

    // Premultiplied-alpha compositing — the crystal OCCLUDES rather than adds.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);

    // Restore the active texture unit. `activeTexture` is GLOBAL state, and this method left it on
    // unit 2 (the crystal ramp) — the exact hazard the palette bind a few hundred lines below already
    // documents and guards against. Every later pass that binds "the" texture without first selecting
    // a unit would have written into unit 2 instead of unit 0.
    //
    // Harmless for neon and ribbon, which have no samplers at all, which is why this survived: the
    // symptom needed a sampler-using pass to run after crystals in the same frame.
    gl.activeTexture(gl.TEXTURE0);
  }

  setMaterialConfig(config: MaterialConfig | null): void {
    this.materialConfig = config;
    if (config && this.rampTexture && this.gl) {
      const gl = this.gl;
      const rampData = getColourRampData(config.colourRamp);
      gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rampData);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  setVolumeConfig(config: VolumeRenderConfig): void {
    this.volumeConfig = config;
  }

  private initVolume(gl: WebGL2RenderingContext): void {
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      console.warn('PSSS: EXT_color_buffer_float not available; volume mode disabled');
      this.renderMode = 'star';
      return;
    }

    // RGBA16F accumulation FBO
    this.volumeAccumTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.volumeAccumTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.volumeAccumFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.volumeAccumFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.volumeAccumTex, 0);
    // Same completeness test as `initLiquid` and for the same reason: an incomplete FBO raises no
    // exception, so every accumulation draw would silently no-op and the resolve pass would sample zeros —
    // a black frame with no error anywhere. RGBA16F is far more widely renderable than R32F, so this is a
    // guard rather than an expected path, but the failure mode is too quiet to leave untested.
    const volStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (volStatus !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn(
        `PSSS: RGBA16F volume framebuffer incomplete (0x${volStatus.toString(16)}); volume mode disabled, falling back to star`,
      );
      gl.deleteFramebuffer(this.volumeAccumFBO);
      gl.deleteTexture(this.volumeAccumTex);
      this.volumeAccumFBO = null;
      this.volumeAccumTex = null;
      this.renderMode = 'star';
      return;
    }

    // Accumulation program
    this.volumeAccumProgram = compileProgram(gl, VOLUME_ACCUM_VERT_SRC, VOLUME_ACCUM_FRAG_SRC, 'HDRParticle volume accumulate');
    this.volumeUResolution = gl.getUniformLocation(this.volumeAccumProgram, 'uResolution');
    this.volumeUSplatRadius = gl.getUniformLocation(this.volumeAccumProgram, 'uSplatRadius');
    this.volumeUDepthFade = gl.getUniformLocation(this.volumeAccumProgram, 'uDepthFade');
    this.volumeUDensityScale = gl.getUniformLocation(this.volumeAccumProgram, 'uDensityScale');
    this.volumeURampTex = gl.getUniformLocation(this.volumeAccumProgram, 'uRampTex');
    this.volumeUUseRamp = gl.getUniformLocation(this.volumeAccumProgram, 'uUseRamp');
    this.volumeUParticleSize = gl.getUniformLocation(this.volumeAccumProgram, 'uParticleSize');
    this.volumeUDepthSize = gl.getUniformLocation(this.volumeAccumProgram, 'uDepthSize');
    this.volumeUDepthDof = gl.getUniformLocation(this.volumeAccumProgram, 'uDepthDof');
    this.volumeUMaxPointSize = gl.getUniformLocation(this.volumeAccumProgram, 'uMaxPointSize');

    // Accumulation VAO (reuses splat data buffers for position/temperature/depth)
    this.volumeAccumVao = gl.createVertexArray();
    gl.bindVertexArray(this.volumeAccumVao);

    const accumPosBuffer = gl.createBuffer();
    const aPos = gl.getAttribLocation(this.volumeAccumProgram, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, accumPosBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const accumTempBuffer = gl.createBuffer();
    const aTemp = gl.getAttribLocation(this.volumeAccumProgram, 'aTemperature');
    gl.bindBuffer(gl.ARRAY_BUFFER, accumTempBuffer);
    gl.enableVertexAttribArray(aTemp);
    gl.vertexAttribPointer(aTemp, 1, gl.FLOAT, false, 0, 0);

    const accumDepthBuffer = gl.createBuffer();
    const aDepth = gl.getAttribLocation(this.volumeAccumProgram, 'aDepth');
    gl.bindBuffer(gl.ARRAY_BUFFER, accumDepthBuffer);
    gl.enableVertexAttribArray(aDepth);
    gl.vertexAttribPointer(aDepth, 1, gl.FLOAT, false, 0, 0);

    const accumColorBuffer = gl.createBuffer();
    const aColor = gl.getAttribLocation(this.volumeAccumProgram, 'aColor');
    gl.bindBuffer(gl.ARRAY_BUFFER, accumColorBuffer);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    this.volumeAccumPosBuffer = accumPosBuffer;
    this.volumeAccumTempBuffer = accumTempBuffer;
    this.volumeAccumDepthBuffer = accumDepthBuffer;
    this.volumeAccumColorBuffer = accumColorBuffer;

    // Resolve program (full-screen quad)
    this.volumeResolveProgram = compileProgram(gl, VOLUME_RESOLVE_VERT_SRC, VOLUME_RESOLVE_FRAG_SRC, 'HDRParticle volume resolve');
    this.volumeUDensityTex = gl.getUniformLocation(this.volumeResolveProgram, 'uDensityTex');
    this.volumeUExtinction = gl.getUniformLocation(this.volumeResolveProgram, 'uExtinction');
    this.volumeResolveVao = gl.createVertexArray();
    gl.bindVertexArray(this.volumeResolveVao);
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPosLoc = gl.getAttribLocation(this.volumeResolveProgram, 'aPos');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.volumeResolveQuadBuffer = quadBuf;
  }

  /**
   * v8 Step 15.1 — accumulate the density field, then draw its iso-surface.
   *
   * Same three-step shape as `renderVolume`: save the caller's FBO, clear and accumulate
   * additively into the R32F target, restore, composite one fullscreen quad.
   *
   * ⚠️ **`uIsoRef` IS RESOLVED HERE, ON THE CPU, AND THAT IS THE WHOLE COUNT-INDEPENDENCE PROPERTY.**
   * `isoLevel` is a RATIO against a density reference, not an absolute threshold, because the library
   * runs legacy presets at a median 4000 particles against liquid presets at 10 000–20 000: a raw
   * threshold tuned at one shows nothing at the other (invariant 25's shape).
   *
   *     uIsoRef = isoLevel · liquidDensityReference(N, R, W, H, spacing)
   *
   * ⚠️ **THE REFERENCE IS `renderers/liquid-reference.ts`, WHICH IS THE ONE OWNER, AND 15.1's FRAME MEAN IS
   * NOW ONLY ITS LOWER BOUND.** The frame mean is count-independent but is not a property of the FIGURE —
   * a Lissajous curve occupies 1–19 % of the frame, so the same authored `isoLevel` meant "solid" on a dense
   * curve and "shredded" on a dot cloud (measured 21× spread, reduced to 4.9×). That file carries the
   * derivation, the measurements and the reason the frame mean is retained rather than replaced.
   *
   * ⚠️ **`R` MUST BE THE CLAMPED RADIUS** — the driver's `gl_PointSize` ceiling is what the shader actually
   * drew, so an unclamped R here would overstate both terms of the reference and the surface would quietly
   * vanish (invariant 10 at a subsystem boundary). `liquidPointDiameter()` owns that clamp and is the only
   * source for every site.
   *
   * @param dtSeconds real frame delta, for the reference's temporal smoothing. ⚠️ **Seconds, and `render()`
   *   is handed milliseconds** — see `LIQUID_REF_TAU_SECONDS`.
   *
   * ⚠️ **v8 15.5 SPLIT THIS FUNCTION'S ONE COUNT INTO TWO, BECAUSE THE SINGLE `solidCount` WAS SERVING THREE
   * ROLES THAT ONLY AGREE WHILE EVERY PARTICLE LIES ON THE CURVE.** With a liquid pool running they diverge:
   * - `drawCount` — how many points to accumulate. INCLUDES the pool; a pool particle is a body and the whole
   *   point of the step is that it is part of the surface.
   * - `curveCount` — the population the density REFERENCE and the tint mean are measured over. EXCLUDES
   *   **BOTH** tail blocks, and that exclusion is the load-bearing half. `measureIndexSpacing()` measures the
   *   distance between CONSECUTIVE INDICES, which is a meaningful length only for a 1-D locus; the pool is a
   *   Halton cloud and a spark is a ballistic ember, so including either reports a spacing no curve has,
   *   collapses `(32/35)·R/spacing` toward zero and hands the threshold to the frame-mean lower bound — i.e.
   *   15.1b's dot-cloud path, on a figure that is still a curve. Effect of getting this wrong is the same 21×
   *   spread 15.1b exists to remove, reading as *"Iso Level went back to being unusable the moment I enabled
   *   the pool"* — or, for the spark half, *the moment I selected a material*.
   *
   * ⚠️ **15.5 EXCLUDED ONLY THE POOL AND THAT WAS A DEFECT UNTIL 2026-09-03 (`15.6-salvage` B): SPARKS ARE A
   * MIDDLE BLOCK, SO A TRAILING SUBTRACTION CANNOT REACH THEM.** The corrected expression reads `waveCount`
   * — the published index of the first tail slot — rather than subtracting a second length. See the derive
   * site in `render()` for why that is one name instead of a fourth spelling of the partition.
   *
   * ⚠️ **This is exactly `CLAUDE.md`'s three-enumerations rule: one name for three quantities made the
   * distinction structurally invisible** — and the 15.5 fix corrected the quantity ONE BLOCK AT A TIME, which
   * is the *"correct once per QUANTITY, not once per file"* clause of invariant 26 failing in miniature.
   * Both counts still exclude crystals, which draw in their own pass.
   */
  private renderLiquid(state: GeneratorState, drawCount: number, curveCount: number, dtSeconds: number): void {
    const gl = this.gl!;
    if (!this.liquidFBO || !this.liquidAccumProgram || !this.liquidSurfaceProgram || !this.liquidSurfaceVao
        || !this.liquidTex || !this.liquidColorTex) return;

    const cfg = this.liquidConfig;
    const diameter = this.liquidPointDiameter();
    const radius = diameter * 0.5;
    // ⚠️ Resolved ONCE into a local and read twice. `isoRef` moves with Iso Level; `thickRef` deliberately
    // does not, so dividing `isoRef` back down by `isoLevel` to recover the reference would be a second
    // expression for one quantity — exactly the drift `liquidPointDiameter()` exists to prevent.
    const densityRef = this.resolveLiquidReference(state, curveCount, radius, dtSeconds);
    const isoRef = cfg.isoLevel * densityRef;

    const currentFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    // 1. Clear the field. ⚠️ Clearing to 0 is the correct empty value here and not merely a convention:
    // the surface pass discards below the threshold, so an unwritten texel must read as "no liquid". The
    // colour target's zero is equally load-bearing — its alpha IS the weight sum, so a nonzero clear would
    // put a denominator under pixels no particle touched.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.liquidFBO);
    // ⚠️ **v8 Step 15.2: `drawBuffers` MUST be set, and it must list BOTH attachments in ATTACHMENT ORDER.**
    // The default draw-buffer state for a user FBO enables COLOR_ATTACHMENT0 only, so without this the
    // `outColor` write is discarded silently — the colour field stays at its clear value, `wSum` is 0
    // everywhere, `perParticle` falls back to `tint` at every pixel, and the whole step renders as
    // byte-identical to 15.1. That is invariant 13's shape arriving through GL STATE: the uniforms upload,
    // the slider moves, the shader runs, and nothing changes. It is set per frame beside the bind rather
    // than once at init because draw-buffer state is per-FRAMEBUFFER and this FBO is not the only one the
    // frame touches — `gldiag`'s probe and any future pass that rebinds it would otherwise inherit it.
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 2. Accumulate. Reuses `this.vao`, whose `aPosition` and `aColor` buffers `render()` has already
    // uploaded — hence the interpolated `layout(location = …)` numbers in the accumulation vertex shader,
    // read off the main program so they cannot disagree with the VAO.
    gl.useProgram(this.liquidAccumProgram);
    gl.uniform2f(this.uLiquidAccResolution, this.width, this.height);
    gl.uniform1f(this.uLiquidAccSize, diameter);
    gl.uniform1f(this.uLiquidAccMaxPointSize, this.maxPointSize);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.vao);
    // ⚠️ `drawCount`, not `curveCount` — the pool must be part of the accumulated field. Drawing `curveCount`
    // here would leave the pool invisible in `liquid` mode while it still displaced nothing and coloured
    // nothing, i.e. the ONE render mode the step exists for would be the one that ignores it.
    gl.drawArrays(gl.POINTS, 0, drawCount);
    gl.bindVertexArray(null);

    // 3. Surface pass into the caller's FBO.
    gl.bindFramebuffer(gl.FRAMEBUFFER, currentFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.liquidSurfaceProgram);
    gl.uniform1f(this.uLiquidSurfIsoRef, isoRef);
    // ⚠️ The thickness scale is a fixed multiple of the REFERENCE, deliberately not of `isoRef` — see
    // `LIQUID_THICKNESS_DEPTH`. Recovered iso 8 from 0.222 to 0.295 of the track's peak light and iso 16 from
    // 0.101 to 0.174 in the measurement that motivated the split.
    gl.uniform1f(this.uLiquidSurfThickRef, LIQUID_THICKNESS_DEPTH * densityRef);
    gl.uniform1f(this.uLiquidSurfSoftness, cfg.edgeSoftness);
    gl.uniform2f(this.uLiquidSurfResolution, this.width, this.height);
    // v8 Step 15.2. ⚠️ `colourMix` is uploaded even at 0, where the shader's `mix` makes it an algebraic
    // identity — never gated behind an `if`, which is what leaves a stale uniform from the previous preset.
    gl.uniform1f(this.uLiquidSurfColourMix, cfg.colourMix);
    gl.uniform1i(this.uLiquidSurfMixModel, cfg.mixModel === 'pigment' ? 1 : 0);
    // v8 Step 15.3. All five unconditionally, for the same stale-uniform reason as `colourMix`: a preset that
    // omits `liquid` inherits `DEFAULT_LIQUID_CONFIG` per field (invariant 14), so there is always a value to
    // send, and gating any of them on "is it non-zero" would leave the previous preset's number in place.
    gl.uniform1f(this.uLiquidSurfRefraction, cfg.refraction);
    gl.uniform1f(this.uLiquidSurfSpecular, cfg.specular);
    gl.uniform1f(this.uLiquidSurfThickness, cfg.thickness);
    gl.uniform1f(this.uLiquidSurfEdgeBright, cfg.edgeBrightness);
    // ⚠️ **The CLAMPED radius, the same local the density reference above is measured from.** The dispersion
    // offset is `REFRACT_SPREAD · uRadius` texels, so an unclamped value would offset by a kernel the hardware
    // never drew — 1.576× too far at 3840×2160, kw 3, which is `liquidPointDiameter()`'s whole reason to be a
    // single owner. A fourth transcription of that arithmetic is exactly what desyncs the two.
    gl.uniform1f(this.uLiquidSurfRadius, radius);

    // 'preset' resolves to the figure's own mean colour. A fullscreen pass cannot read per-particle
    // colour, and the alternatives are worse than a mean: index 0 of `state.colors` is one arbitrary
    // particle, and a hardcoded blue would make the mode ignore the preset entirely. Sampled on a stride
    // so the cost does not scale with 20 000 particles (invariant 8 — this runs every frame).
    // ⚠️ `curveCount`: the FIGURE's mean, excluding the pool. Including it would be circular — the pool's own
    // colour is itself the figure's mean (`lissajous.ts` fills it that way), so the pool would be voting for the
    // answer, and with a large pool the mean would be dominated by that echo rather than by the curve.
    let cr = 0.6, cg = 0.8, cb = 1.0;
    if (state.colors.length >= curveCount * 3 && curveCount > 0) {
      const stride = Math.max(1, Math.floor(curveCount / 256));
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let i = 0; i < curveCount; i += stride) {
        sr += state.colors[i * 3]!; sg += state.colors[i * 3 + 1]!; sb += state.colors[i * 3 + 2]!;
        n++;
      }
      if (n > 0 && (sr + sg + sb) > 1e-6) { cr = sr / n; cg = sg / n; cb = sb / n; }
    }
    gl.uniform3f(this.uLiquidSurfTint, cr, cg, cb);

    // `material` follows the LIVE material's ramp so `LiquidLight` looks like `LiquidLight`; with no
    // material it degrades to the config's own `surfaceRamp` rather than to one flat colour — the same
    // choice `paletteMapping === 3` makes on the point path.
    const materialActive = !!this.materialConfig && this.materialConfig.preset !== 'None';
    // v8 Step 15.7. ⚠️ **`'dye'` DEGRADES TO `'ramp'` BY THE SAME RULE AND AT THE SAME SITE AS `'material'`,
    // and that is the whole reason it was accepted as a fifth SOURCE rather than a second blend.** It is the
    // one source whose input is a TEXTURE the CPU does not hold, so it is the one source that can be
    // unavailable: the field off, or `EXT_color_buffer_float` refused. ⚠️ **The test is "did the owner hand
    // us a texture", never a copy of the config's `enabled` flag** — a flag that outlives its resource is
    // invariant 3, and `DyeFieldProcessor.getDyeTexture()` already returns its 1×1 transparent-black stand-in
    // when inactive, so a bound-but-empty field would resolve through the shader's own per-pixel fallback
    // instead. Both degrade paths therefore land on the SAME ramp read, deliberately (see the shader).
    const dyeActive = !!this.dyeTexture;
    const effSource =
      (cfg.tintSource === 'material' && !materialActive) ? 'ramp'
      : (cfg.tintSource === 'dye' && !dyeActive) ? 'ramp'
      : cfg.tintSource;
    const srcInt =
      effSource === 'preset' ? 0
      : effSource === 'palette' ? 1
      : effSource === 'material' ? 2
      : effSource === 'dye' ? 4
      : 3;
    gl.uniform1i(this.uLiquidSurfTintSource, srcInt);
    gl.uniform1i(this.uLiquidSurfPaletteEnabled, this.paletteLutActive() && this.paletteTexture ? 1 : 0);
    gl.uniform1f(this.uLiquidSurfPaletteHueShift, this.paletteHueShift);

    // The ramp name can change without an init (a material switch under `tintSource: 'material'`), so
    // reconcile the upload here rather than only in `setLiquidConfig` — otherwise picking a material shows
    // the previous ramp until something else re-inits. Re-uploads ONLY on a name change.
    this.syncLiquidRamp();

    // ⚠️ FIVE samplers since 15.7, so all five get a unit UNCONDITIONALLY and all five get a real texture
    // bound — never `null` (invariant 4). An unassigned sampler in a multi-sampler program can resolve the
    // WHOLE draw black on some drivers, which is indistinguishable from "the threshold rejected everything".
    // ⚠️ **`uDye`'s unit is assigned and bound EVEN WHEN THE SOURCE IS NOT `'dye'`** — that is not redundant
    // work, it is the invariant: the sampler exists in the program whatever `uTintSource` says, and a driver
    // is under no obligation to prove the branch is dead before it validates the unit.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
    gl.uniform1i(this.uLiquidSurfDensity, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.liquidRampTex ?? this.rampTexture);
    gl.uniform1i(this.uLiquidSurfRamp, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture ?? this.fallbackBlackTex);
    gl.uniform1i(this.uLiquidSurfPalette, 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.liquidColorTex);
    gl.uniform1i(this.uLiquidSurfColor, 3);

    // v8 Step 15.7. `fallbackBlackTex` is the 1×1 stand-in when no dye field has been handed over —
    // the same fallback the palette slot two units up uses, so there is one idiom and not two. ⚠️ It is
    // created in `init()` unconditionally; until 2026-09-19 it was built by `initLogDensity`, so in every
    // liquid preset without a dye field BOTH of these binds were `null` (invariant 4). See its field doc.
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.dyeTexture ?? this.fallbackBlackTex);
    gl.uniform1i(this.uLiquidSurfDye, 4);
    // ⚠️ Set UNCONDITIONALLY beside the sampler, exactly like the unit assignment above: a 0 here pins the
    // surface to the ramp fallback at every alpha, which is indistinguishable from the field being off.
    gl.uniform1f(this.uLiquidSurfDyeSatK, DYE_SATURATION_K);

    // ⚠️ **PREMULTIPLIED SOURCE, hence `ONE, ONE_MINUS_SRC_ALPHA` and not `SRC_ALPHA, …`** — the shader
    // already multiplied by coverage, so `SRC_ALPHA` would apply it twice, and because coverage peaks in
    // the blob interior the loss would be density-dependent: a distorted falloff, not a uniform dimming
    // (invariant 9, which this file has now hit twice).
    //
    // This is the ONE particle path that OCCLUDES rather than adding light, which is the entire point of
    // the mode: additive splats can only get brighter, never become one shape.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.liquidSurfaceVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    // Leave the blend function as this engine's shared default. A leaked blend func has reached a browser
    // before, and `checks/blendcheck.mjs` exists because of it.
    gl.blendFunc(gl.ONE, gl.ONE);
    // And restore unit 0. Five samplers means this pass leaves unit 4 current, and `activeTexture` is
    // GLOBAL: any later pass that binds a texture without first selecting a unit would write into unit 4.
    //
    // ⚠️ **The draw-buffer state set above needs NO restore, and that is a property rather than an
    // omission: draw-buffer state is per-FRAMEBUFFER**, so enabling attachment 1 on `liquidFBO` cannot
    // affect the caller's FBO or the default framebuffer. It is re-set every frame beside the bind for the
    // converse reason — anything else that binds `liquidFBO` inherits whatever it was left as.
    // `render()` also restores after returning from here — this is not redundant, it is the rule that each
    // pass leaves the unit it found, which is what `blendcheck` asserts per function (and it caught exactly
    // this omission on the first run).
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Re-upload `liquidRampTex` only when the resolved ramp NAME changes. A 256-byte upload per frame would
   *  be a per-frame allocation and a needless stall (invariant 8 is about rates, not single costs). */
  private syncLiquidRamp(): void {
    const gl = this.gl;
    if (!gl || !this.liquidRampTex) return;
    const want = this.liquidRampName();
    if (want === this.liquidRampUploaded) return;
    this.liquidRampUploaded = want;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.liquidRampTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, getColourRampData(want));
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * v8 Step 15.1. ⚠️ **The config object is REPLACED, not mutated, and the ramp is reconciled** — a
   * `tintSource` or `surfaceRamp` change must reach the GPU without an init, and `syncLiquidRamp` is a
   * no-op when the name is unchanged so calling it per-set is free.
   */
  setLiquidConfig(config: LiquidSurfaceConfig): void {
    // ⚠️ A `kernelWidth` change moves `R`, which is BOTH terms of the density reference, so the smoothed
    // history is about a radius that no longer applies — glide it and dragging the Kernel Width slider
    // makes the surface hunt for a quarter-second after every move. `isoLevel` alone does NOT need this
    // (it multiplies the reference rather than defining it), but the config arrives whole and comparing
    // one field to decide would be a second place for the reference's basis to be described.
    if (config.kernelWidth !== this.liquidConfig.kernelWidth) this.resetLiquidReference();
    this.liquidConfig = { ...config };
    this.syncLiquidRamp();
  }

  getLiquidConfig(): LiquidSurfaceConfig {
    return { ...this.liquidConfig };
  }

  /**
   * v8 Step 15.7. Hand over `DyeFieldProcessor`'s field, or `null` to release it.
   *
   * ⚠️ **CALLED UNCONDITIONALLY IN BOTH DIRECTIONS, every frame the dye state is resolved** — the same
   * contract `transMap.setFluidVelocityTexture(fluidProcessor.getVelocityTexture())` follows at
   * `main.ts:857`, and for invariant 3's reason: a texture handed over once and never withdrawn leaves this
   * renderer holding a handle its owner may have deleted, and a `'dye'` tint would then sample freed memory
   * rather than degrading to `'ramp'`. **Do not make the call site conditional on `dye.enabled`.**
   *
   * ⚠️ **NOT deleted by `dispose()`** — see the `dyeTexture` field's own warning. It is borrowed.
   */
  setDyeTexture(tex: WebGLTexture | null): void {
    this.dyeTexture = tex;
  }

  /**
   * Copy the first `count` particles' X and Y into `out`, dropping Z. **The one owner of that packing**, which
   * existed as THREE hand-written copies of the same loop — the file's own three-enumerations lesson: nothing
   * here or in `checks/` would have caught two of them drifting apart.
   */
  private static packXY(out: Float32Array, state: GeneratorState, count: number): Float32Array {
    for (let i = 0; i < count; i++) {
      out[i * 2] = state.positions[i * 3]!;
      out[i * 2 + 1] = state.positions[i * 3 + 1]!;
    }
    return out;
  }

  /**
   * The point/volume paths' XY, packed into the cached `solidPos2d`.
   *
   * ⚠️ **It REFILLS on every call rather than trusting the frame's earlier one.** `renderVolume()` today runs
   * only from `render()`, which has already packed the identical array a few hundred lines below — but a
   * shared buffer whose contents depend on its caller having run first is a stale-geometry defect waiting for
   * the second call site to appear, and it would be **silent**: last frame's positions draw as a perfectly
   * plausible figure. The refill is about 0.05 ms at 50 000 particles, against the 400 KB it no longer
   * allocates.
   */
  private packSolidPos2d(state: GeneratorState, solidCount: number): Float32Array {
    if (this.solidPos2d.length !== solidCount * 2) this.solidPos2d = new Float32Array(solidCount * 2);
    return HDRParticleRenderer.packXY(this.solidPos2d, state, solidCount);
  }

  /**
   * The splat path's XY, packed into the cached `splatPos2d`.
   *
   * ⚠️ **A SECOND buffer, and it must stay separate from `solidPos2d`.** This path draws `state.count` while
   * `render()` packs `state.count − crystalCount`, and `render()` runs first every frame — so one shared
   * exact-size buffer would reallocate TWICE PER FRAME on any preset that has crystals, turning the fix into
   * a worse version of the defect. Two buffers cost one extra allocation per count change and nothing else.
   */
  private packSplatPos2d(state: GeneratorState): Float32Array {
    if (this.splatPos2d.length !== state.count * 2) this.splatPos2d = new Float32Array(state.count * 2);
    return HDRParticleRenderer.packXY(this.splatPos2d, state, state.count);
  }

  private renderVolume(state: GeneratorState): void {
    const gl = this.gl!;
    if (!this.volumeAccumFBO || !this.volumeAccumProgram || !this.volumeResolveProgram || !this.volumeAccumVao || !this.volumeResolveVao || !this.volumeAccumTex) return;

    const config = this.volumeConfig;
    const materialConfig = this.materialConfig;
    const splatRadius = materialConfig ? materialConfig.splatRadius : 16.0;

    // Volume's colour source. `splat` gates its whole draw on `this.materialConfig` and falls through
    // to the point path without one; volume gated only on the FBO, so it drew unconditionally and
    // shaded every particle from a ramp indexed by an all-zero `temperatures[]` -- black. Rather than
    // refuse the mode, fall back to the preset's own oscillating colour, which is what the point,
    // ribbon and neon passes use: Beer-Lambert extinction is a geometry concern, so volume is
    // meaningful with no material.
    //
    // ⚠️ Test `preset !== 'None'` and not merely non-null. `VisualFxControls.setMaterialConfig`
    // forwards a real config object whose `preset` is the string `'None'` -- it does not pass null --
    // and `MaterialProcessor.update()` returns early on exactly that value, leaving `temperatures[]`
    // zero-filled. A truthiness test therefore reports a material as active when none is running.
    const materialActive = !!materialConfig && materialConfig.preset !== 'None';

    // v8 Phase 8a-3: the volume accumulation shader has no frozen attribute, so a crystal slot
    // cannot be discarded there and would be drawn twice — once as a smoke blob, once as faceted
    // ice. Crystals are the trailing block, so truncating the draw excludes them exactly.
    //
    // ⚠️ v8 15.5: this deliberately still INCLUDES the liquid-pool block, so it needs no change — and that is
    // the ANSWER here rather than an oversight. Subtracting `liquidCount` too would be the easy symmetry and it
    // is wrong: a pool particle is a real screen-space body with a real position and speed, so it belongs in
    // every pass that draws bodies. The blocks that must be excluded are excluded for reasons specific to the
    // consumer (see `GeneratorState.liquidCount`), and "it is a tail block" is not one of them.
    const solidCount = state.count - (state.crystalCount ?? 0);

    const pos2d = this.packSolidPos2d(state, solidCount);
    const temperatures = state.temperatures ?? new Float32Array(solidCount);
    // Sized to `solidCount`, not `state.count`: every enabled attribute in a VAO is read by every
    // draw that binds it, and a buffer left short by a previous larger frame under-sizes this draw --
    // which ANGLE reports and then silently DROPS, giving a black frame with no JS exception.
    const colors = state.colors.length >= solidCount * 3
      ? state.colors.subarray(0, solidCount * 3)
      : new Float32Array(solidCount * 3);

    const currentFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

    // 1. Clear accumulation FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.volumeAccumFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 2. Accumulate density (additive blend into RGBA16F)
    gl.useProgram(this.volumeAccumProgram);
    gl.uniform2f(this.volumeUResolution, this.width, this.height);
    gl.uniform1f(this.volumeUSplatRadius, Math.min(splatRadius * 1.5, this.maxPointSize));
    gl.uniform1f(this.volumeUDepthFade, config.depthFade);
    gl.uniform1f(this.volumeUDensityScale, config.densityScale);
    gl.uniform1f(this.volumeUUseRamp, materialActive ? 1.0 : 0.0);
    // The global multiplier and the two depth terms stay on the GPU side. The radius above keeps its own
    // CPU clamp so a multiplier of 1.0 is byte-identical to the pre-2026-08-29 behaviour; the shader's
    // final clamp is what the hardware did silently anyway.
    gl.uniform1f(this.volumeUParticleSize, this.particleSize);
    gl.uniform1f(this.volumeUDepthSize, this.depthSize);
    gl.uniform1f(this.volumeUDepthDof, this.depthDof);
    gl.uniform1f(this.volumeUMaxPointSize, this.maxPointSize);

    // Bind the ramp UNCONDITIONALLY even when the shader will not sample it. `uRampTex` is this
    // program's only sampler so an unassigned unit would be benign here, but leaving a sampler
    // unassigned is the hazard that has now blacked this engine's output three times (B14, B17, D16)
    // and the rule is cheaper to keep than to reason about per program.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
    gl.uniform1i(this.volumeURampTex, 0);

    // Upload data
    gl.bindVertexArray(this.volumeAccumVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.volumeAccumPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pos2d, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.volumeAccumTempBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, temperatures, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.volumeAccumDepthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.depths, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.volumeAccumColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, solidCount);
    gl.bindVertexArray(null);

    // 3. Resolve pass (Beer-Lambert absorption)
    gl.bindFramebuffer(gl.FRAMEBUFFER, currentFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.volumeResolveProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.volumeAccumTex);
    gl.uniform1i(this.volumeUDensityTex, 0);
    gl.uniform1f(this.volumeUExtinction, config.extinction);

    // `ONE`, not `SRC_ALPHA`: the resolve shader already emits premultiplied `color * opacity`, so
    // `SRC_ALPHA` applied the factor twice. See the shader source for the measured cost.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.volumeResolveVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /**
   * v8 Step 15.1 (E84) — the iso-surface `liquid` mode.
   *
   * ⚠️ **The refusal path is documented HERE because this is now its only owner — `log-density`'s longer
   * write-up went out with that mode on 2026-09-19 — and it is NOT optional**:
   * `EXT_color_buffer_float` → `checkFramebufferStatus` → set `this.renderMode = 'star'` and **return
   * early**. An incomplete R32F FBO throws nothing and logs nothing; every draw into it merely sets
   * `INVALID_FRAMEBUFFER_OPERATION`, so `liquidTex` stays all zeros, the surface pass thresholds zero
   * against a positive threshold, discards every fragment, and the frame decays to black and STAYS there
   * (invariant 5). Returning early rather than leaving the mode set with null handles is also what makes
   * `getActiveRenderMode()` → `reconcileRenderMode()` correct the dropdown, so the UI stops advertising a
   * mode nothing is drawing (invariant 3's shape, and R10).
   */
  private initLiquid(gl: WebGL2RenderingContext): void {
    // ⚠️ **`liquidRefSmoothed` OUTLIVES `dispose()`** — it is a plain number, not a GL handle, so invariant 1's
    // null sweep does not touch it and a `reinitRenderer` would resume smoothing from the PREVIOUS preset's
    // density. Drop it here rather than in `dispose()`, so the reset happens on the path that also rebuilds
    // the field's own basis (a new canvas size, a new count, a new radius).
    this.resetLiquidReference();
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      console.warn('PSSS: EXT_color_buffer_float not available; liquid mode disabled, falling back to star');
      this.renderMode = 'star';
      return;
    }

    this.liquidTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.width, this.height, 0, gl.RED, gl.FLOAT, null);
    // ⚠️ **LINEAR, unlike the retired log-density target's NEAREST, and load-bearing rather than cosmetic.** The
    // surface pass takes a 4-tap GRADIENT of this field for the normal; with NEAREST the taps land on
    // piecewise-constant texels, so the gradient is a staircase and the shading bands. The field itself is
    // smooth (that is what the Wyvill kernel buys), so filtering it costs nothing.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    /*
     * v8 Step 15.2's colour target. ⚠️ **It is created BEFORE `checkFramebufferStatus` and torn down on the
     * same failure path**, because it is attached to the same FBO: an RGBA16F attachment can be the reason
     * the FBO is incomplete (a context with `EXT_color_buffer_float` still need not support every format at
     * every attachment point in combination), and a status check that ran before the second attachment would
     * report COMPLETE for a framebuffer the draw then fails on — invariant 5's shape, one attachment later.
     */
    this.liquidColorTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.liquidColorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    // LINEAR for the same reason `liquidTex` is: the surface pass reads this at the fragment's own uv, and a
    // NEAREST colour field against a LINEAR density field would make the tint step on texel boundaries the
    // silhouette does not step on — two fields sampled from one uv must filter alike.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.liquidFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.liquidFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.liquidTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.liquidColorTex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn(
        `PSSS: liquid framebuffer incomplete (0x${status.toString(16)}); liquid mode disabled, falling back to star`,
      );
      gl.deleteFramebuffer(this.liquidFBO);
      gl.deleteTexture(this.liquidTex);
      gl.deleteTexture(this.liquidColorTex);
      this.liquidFBO = null;
      this.liquidTex = null;
      this.liquidColorTex = null;
      this.renderMode = 'star';
      return;
    }

    /*
     * ⚠️ **THE ATTRIBUTE LOCATIONS ARE READ OFF THE MAIN PROGRAM AND INTERPOLATED IN — they are not
     * hardcoded, and 15.1's pinned `layout(location = 0)` was replaced rather than extended.** This program
     * shares `this.vao`, whose six buffers were bound at whatever locations the linker gave the MAIN
     * program, via `getAttribLocation`. 15.1 got away with pinning `0` because it had one attribute and
     * `aPosition` happens to land there; 15.2 needs `aColor` too, and a *second* pinned number would be a
     * guess about a linker's private numbering that no checker and no `tsc` can see. A VAO/program location
     * mismatch makes ANGLE **silently drop the whole draw**: a black frame, no exception, and
     * `gl.getError()` empty unless `?gldiag=1` is on — the exact failure 15.1's comment predicted for this
     * step. Deriving both numbers from `this.program` makes the agreement structural: whatever the linker
     * chose for the VAO is what this shader declares, by construction.
     *
     * ⚠️ **`initLiquid` is called from `init()` AFTER the main program links and after `this.vao` is
     * built** (`:1418` sits below the `getAttribLocation` block at `:1352`), so these lookups are valid
     * here. Moving this call earlier would return `-1` for both and silently produce a shader declaring
     * `location = -1`, hence the guard below.
     *
     * ⚠️ **Base size 8.0, not star's 5.0, and it is a REQUIREMENT of the feature**: metaballs merge only
     * where their fields OVERLAP, so a radius below the typical inter-particle spacing produces separate
     * discs at every Iso Level and the mode reads as a worse `star`. It is canvas-scaled like the point
     * paths (the retired log-density mode's exemption was exposure calibration for a fragment-COUNTING pass and did not
     * apply: this pass is thresholded against its own frame mean, so a size change moves the mean too).
     *
     * ⚠️ **`gl_PointSize` is CLAMPED here and the CPU must pass the SAME clamped radius into `uIsoRef`.**
     * The frame-mean derivation is `dMean = N·πR²/(4·W·H)`, so if the driver shrinks the sprite the shader's
     * R is not the CPU's R and the normalisation quietly stops holding — invariant 10 at a subsystem
     * boundary. `liquidPointRadius()` is the ONE owner of that arithmetic and both sites call it.
     */
    // ⚠️ `this.program` is typed nullable but is assigned before this point in `init()`; the guard below
    // covers both it and a `-1` lookup in one test, so the two cannot drift apart.
    const locPosition = this.program ? gl.getAttribLocation(this.program, 'aPosition') : -1;
    const locColor = this.program ? gl.getAttribLocation(this.program, 'aColor') : -1;
    if (locPosition < 0 || locColor < 0) {
      // Unreachable while `initLiquid` runs after the VAO is built, and it is a hard failure rather than a
      // fallback for the reason above: a shader declaring `location = -1` compiles, links, draws, and
      // renders nothing.
      throw new Error(
        `HDRParticle liquid: main program attribute locations unavailable (aPosition ${locPosition}, aColor ${locColor})`,
      );
    }
    const LIQUID_ACC_VERT = `#version 300 es
precision highp float;
layout(location = ${locPosition}) in vec2 aPosition;
layout(location = ${locColor}) in vec3 aColor;
uniform vec2 uResolution;
uniform float uSize;
uniform float uMaxPointSize;
out vec3 vColor;
void main() {
  vec2 ndc = (aPosition / uResolution) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = clamp(uSize, 1.0, uMaxPointSize);
  vColor = aColor;
}`;
    /*
     * ⚠️ **WYVILL `(1−r²)³`, NOT A GAUSSIAN, and this is not a style preference.** `exp(-k·r²)` is non-zero
     * at the sprite boundary r = 1, so every sprite contributes a small STEP discontinuity at its own square
     * edge — and at high Iso Level sensitivity that reads as visible square tiles around each particle.
     * `(1−r²)³` has exact compact support and C¹ continuity at the boundary, which is also what makes the
     * `πR²/4` integral in `LiquidSurfaceConfig` exact rather than an approximation.
     *
     * `gl_PointCoord` runs 0..1 across the sprite, so `pc` is ±0.5 and `dot(pc,pc)*4.0` is r² on 0..1 at
     * the inscribed circle — the same `r = length(pc) * 2.0` convention every other fragment shader in this
     * file uses, squared to avoid the `sqrt`.
     */
    /*
     * ⚠️ **v8 Step 15.2: TWO outputs from ONE draw, and the second one is the whole step.** `outColor`
     * carries `(colour·w, w)` — the numerator and the denominator of the weighted mean, co-accumulated so
     * the surface pass can divide them. Writing them from the same fragment is not an optimisation: a
     * separate colour pass would need its own draw, its own blend state and its own guarantee that the two
     * passes saw the same sprite footprint, and any disagreement between them would show up as a coloured
     * fringe exactly at the silhouette (the one edge this mode exists to produce).
     *
     * ⚠️ **`w` IS COMPUTED ONCE AND USED THREE TIMES.** A second spelling of `(1−r²)³` in the colour term
     * is what desynchronises the numerator from the denominator; §O asserts the single owner.
     *
     * ⚠️ **The `r2 < 1.0` reject writes ZERO to BOTH targets rather than discarding.** `discard` would work
     * for `outDensity` (0 is the additive identity) but it is the more fragile spelling here: with two
     * targets, a `discard` that a future edit moves above one of the two assignments silently drops that
     * target's contribution for the sprite's corner fragments only — a ~21 % footprint error visible as a
     * faint square halo, i.e. precisely the artefact the Wyvill kernel was chosen to avoid.
     */
    const LIQUID_ACC_FRAG = `#version 300 es
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
    this.liquidAccumProgram = compileProgram(gl, LIQUID_ACC_VERT, LIQUID_ACC_FRAG, 'HDRParticle liquid accumulate');
    this.uLiquidAccResolution = gl.getUniformLocation(this.liquidAccumProgram, 'uResolution');
    this.uLiquidAccSize = gl.getUniformLocation(this.liquidAccumProgram, 'uSize');
    this.uLiquidAccMaxPointSize = gl.getUniformLocation(this.liquidAccumProgram, 'uMaxPointSize');

    const LIQUID_SURF_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
    /*
     * The threshold, the 4-tap gradient and the tint.
     *
     * `uIsoRef` already carries `isoLevel * max(dMean, 1e-3)` — the CPU resolves the ratio into an absolute
     * threshold, because `dMean` needs `solidCount` and the clamped radius, neither of which the shader can
     * see. So `uIsoRef` is in the texture's own units and the comparison here is a plain one.
     *
     * ⚠️ **The gradient is taken in TEXEL steps via `uResolution`, i.e. ONE shared length scale** — not in
     * `vUv`, whose two axes are `w` and `h` pixels per unit (invariant 26). A `vUv`-space offset would make
     * the normal's x and y components disagree by the canvas aspect, which reads as lighting that tilts when
     * the window is resized.
     *
     * ⚠️ **Premultiplied output paired with `ONE, ONE_MINUS_SRC_ALPHA`** — `colour * alpha` under
     * `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` would apply the coverage TWICE, and because coverage is highest in
     * the blob interior the loss would be density-dependent: it would distort the surface's falloff rather
     * than merely dim it (invariant 9, found twice before in this file).
     *
     * ⚠️ **Alpha is the whole point of the mode: this pass OCCLUDES.** Every other particle path is additive
     * light, which is exactly why they cannot produce a boundary. `discard` outside the surface keeps the
     * background untouched.
     *
     * ⚠️ **`uThickRef` IS A SEPARATE UNIFORM FROM `uIsoRef` AND THE SEPARATION IS THE FIX (15.1b).** 15.1
     * wrote `thickness = (d − uIsoRef)/uIsoRef`, dividing the ramp coordinate by the very threshold it is
     * offset by — so raising Iso Level did TWO things at once: it eroded the silhouette (intended) and dragged
     * every surviving texel's ramp coordinate toward 0 (not intended), which on the `liquid` ramp is
     * `(20,0,40)` at alpha 0, i.e. near-black and transparent. Measured on `Liquid Surface` at 1280×960 over
     * Iso Level 0.25 → 16: coverage fell 5× while TOTAL ON-SCREEN LIGHT fell **10×** (1.000 → 0.101), with
     * mean thickness 0.991 → 0.542 and mean ramp luminance 0.873 → 0.441. That second, unintended factor is
     * why the report said *"thinning out until invisible"* — the surface at Iso Level 8 is still ONE connected
     * blob covering 36 % of the figure, it had merely gone dark. Decoupled, the useful travel on the track
     * goes from 34 % to 62 % on the worst of 15 figures.
     */
    const LIQUID_SURF_FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uDensity;
uniform sampler2D uRamp;
uniform sampler2D uPalette;
uniform sampler2D uColorField;
// v8 Step 15.7. The advected dye field (RGBA16F, 512^2, premultiplied: rgb = sum(colour*w), a = sum(w)).
// ⚠️ **ALWAYS BOUND, never null** -- a 1x1 transparent black when the field is off (invariant 4), which is
// also what makes the per-pixel fallback below a data test rather than a second flag.
uniform sampler2D uDye;
// The dye's alpha->saturation constant. 0.0 would pin the surface to the ramp fallback everywhere, so it is
// a real dependency of the dye source and not a tuning knob (see the tint block).
uniform float uDyeSatK;
uniform float uIsoRef;
uniform float uThickRef;
uniform float uSoftness;
uniform float uColourMix;
uniform int uTintSource;
uniform int uPaletteEnabled;
// v8 26.4 — the hue rotation, as a sampling offset into the palette LUT, in TURNS. 0 = identity.
uniform float uPaletteHueShift;
uniform int uMixModel;
uniform vec2 uResolution;
uniform vec3 uTint;
// v8 Step 15.3. uRadius is the CLAMPED sprite radius in pixels, so the dispersion offset is a fraction of
// the kernel rather than a texel count -- see REFRACT_SPREAD for the measurement that forced that.
uniform float uRefraction;
uniform float uSpecular;
uniform float uThickness;
uniform float uEdgeBright;
uniform float uRadius;
in vec2 vUv;
out vec4 fragColor;

// v8 Step 15.3. The thickness at an arbitrary uv, in the same units as 'thickness' below -- the one place
// the dispersion taps read, so the two chromatic samples cannot drift from the centre sample's formula.
float thicknessAt(vec2 uv) {
  return clamp((texture(uDensity, uv).r - uIsoRef) / max(uThickRef, 1e-6), 0.0, 1.0);
}

// v8 Step 15.7 wake pass, MOVED OUT 2026-10-19 by 28.1 (28.D10). The quotient is now interpolated from
// DYE_HUE_GLSL in liquid-reference.ts, which is its ONE owner, because Phase 28 added a FOURTH reader in a
// different file (post-processors/dye-field.ts' standalone overlay) and a retyped copy across a module
// boundary is invisible to every compiler and to any grep over one file. Read that constant's header
// before touching this line; the 1e-6 guard's reason lives there.
${DYE_HUE_GLSL}

void main() {
  float d = texture(uDensity, vUv).r;
  // Coverage: 0 outside, 1 well inside. uSoftness is a FRACTION of the threshold, so the feather scales
  // with the threshold instead of being an absolute density width that means different things per preset.
  float halfW = max(uSoftness, 0.0) * uIsoRef;
  float cover = halfW > 0.0
    ? smoothstep(uIsoRef - halfW, uIsoRef + halfW, d)
    : (d >= uIsoRef ? 1.0 : 0.0);

  /*
   * ======================= v8 Step 15.7 -- THE WAKE, i.e. dye OUTSIDE the surface =======================
   *
   * ⚠️ **THIS PASS USED TO DISCARD EVERY FRAGMENT THE FIGURE DOES NOT CURRENTLY COVER, WHICH MADE THE DYE
   * FIELD STRUCTURALLY INCAPABLE OF DELIVERING THE ONE THING IT IS FOR.** The dye's whole value is colour
   * left BEHIND -- where the figure HAS BEEN -- and there is no density there by definition, so the only dye
   * that could ever reach the screen was the dye inside the current silhouette. That is exactly the report
   * this fix answers: *"enabling it or disabling it only changes the color of the figure"*. It was not a
   * defect in any file of the dye pipeline, all of which were correct; it was the surface's own early
   * return, one pass downstream. ⚠️ **Ask what early return sits between a readout's inputs and the screen**
   * (invariant 25's shape, arriving on an image instead of on a readout).
   *
   * ⚠️ **This is a new OUTPUT CHANNEL, not a sixth field.** CLAUDE.md's discriminator for this phase is
   * whether a step adds a channel or another smooth positional nudge; before this, dye terminated in the
   * SAME channel as the surface's tint (one albedo, inside one silhouette) and so could only ever restate
   * what the tint already said. Composited outside the iso surface it occupies screen area the figure does
   * not, which is the first thing in the dye's history that the figure cannot also do.
   *
   * ⚠️ **THE WAKE'S OPACITY IS 'dyeA' -- THE SAME SATURATION THE BODY'S TINT USES, DELIBERATELY NOT A NEW
   * CONTROL.** One quantity with two uses, so Dye Amount and Dye Decay move the wake and the body together
   * and cannot be set to disagree. A separate Wake Opacity would need a Mixer entry, an export gate, a
   * migration default, a slider track and a tooltip to say a second time what these two sliders already say
   * -- and it would introduce the one state this feature must not have, a saturated body trailing no wake.
   *
   * ⚠️ **GATED ON 'uTintSource == 4' AND NOTHING ELSE, so every other source is BYTE-IDENTICAL to before:**
   * 'dyeA' is 0, the discard below is the old unconditional one, and the composite at the end collapses to
   * 'vec4(col * cover, cover)' algebraically. The CPU already forces the source to 'ramp' (3) when no field
   * texture was handed over, so this branch cannot run against the 1x1 stand-in.
   *
   * ⚠️ **The dye is read HERE rather than in the tint chain because the wake needs it BEFORE the discard**,
   * and it is read ONCE for both uses -- the cost is the same texture fetch the tint branch used to make on
   * its own, moved earlier, not an added one.
   */
  float dyeA = 0.0;
  vec4 dyeS = vec4(0.0);
  if (uTintSource == 4) {
    dyeS = texture(uDye, vUv);
    dyeA = clamp(1.0 - exp(-max(dyeS.a, 0.0) * uDyeSatK), 0.0, 1.0);
  }

  /*
   * ⚠️ **The wake-only fragment RETURNS EARLY rather than falling through with cover = 0, and that is a
   * performance property rather than a style one:** everything below this point (the 4-tap gradient, three
   * dispersion taps, the specular lobe, Beer-Lambert) is multiplied by 'cover' and therefore contributes
   * exactly nothing here, while the wake can cover most of the frame. Falling through would pay the full
   * surface cost per wake pixel at every resolution.
   *
   * ⚠️ **It uses the SAME 'wakeA = (1 - cover) * dyeA' the composite at the end uses, evaluated at
   * cover = 0.** That agreement is what stops a seam: an independently-written 'alpha = dyeA' here would
   * step against a feathered edge's '(1 - cover) * dyeA' one texel away, which reads as a transparent ring
   * around the figure -- visible precisely at the soft edges the mode exists to produce.
   *
   * The fallback colour is unreachable (dyeA > 0 implies dyeS.a > 0), and it is black rather than the ramp
   * because there is no surface here to fall back to -- a ramp read outside the body would paint the
   * background in the surface's own colour at alpha 0, which is invariant 21's "release to a representable
   * sentinel" read backwards.
   */
  if (cover <= 0.0) {
    if (dyeA <= 0.0) discard;
    fragColor = vec4(dyeHueOf(dyeS, vec3(0.0)) * dyeA, dyeA);
    return;
  }

  // 4-tap central difference in TEXEL units, giving the surface normal. Spent here for a cheap diffuse
  // term; step 15.3 spends the same normal on refraction and specular.
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));
  float dxp = texture(uDensity, vUv + vec2(texel.x, 0.0)).r;
  float dxm = texture(uDensity, vUv - vec2(texel.x, 0.0)).r;
  float dyp = texture(uDensity, vUv + vec2(0.0, texel.y)).r;
  float dym = texture(uDensity, vUv - vec2(0.0, texel.y)).r;
  // Gradient points INTO the blob (density rises inward), so negate for an outward normal. Scaled by the
  // threshold so the normal's magnitude is a ratio and does not depend on the particle count.
  vec3 n = normalize(vec3(-(dxp - dxm), -(dyp - dym), max(uThickRef, 1e-6) * 0.5));

  // The ramp/thickness coordinate: the rim is thin, the interior thick. Offset by the threshold (only
  // surviving texels are shaded) but divided by uThickRef, a FIXED multiple of the density reference that
  // does NOT move with Iso Level -- see the block comment above for why sharing one uniform here made the
  // surviving surface go dark as well as small. The normal's z term takes the same scale for the same
  // reason: it is a ratio that must stay count-independent without tracking the threshold.
  //
  // ⚠️ **Through thicknessAt(), not inline, so the centre sample and 15.3's two dispersion taps cannot
  // drift apart** -- a second copy of this formula is exactly what would make the chromatic offset measure a
  // different quantity from the value it is offset around. The re-fetch of an already-read texel is free.
  float thickness = thicknessAt(vUv);

  /*
   * v8 Step 15.3. INTERNAL REFRACTION as light travelling THROUGH the body -- crystal's own arithmetic
   * ('hdr-particle.ts''s splat pass: 'thickness * (0.35 + 0.65*depth) * uInternalRefraction'), reduced to
   * the two terms that exist here. There is no per-fragment depth on a fullscreen pass, so the depth factor
   * is dropped rather than faked; 'thickness' carries the same "how much body did the light cross" meaning.
   *
   * ⚠️ **IT SHIFTS THE RAMP INDEX, WHICH IS WHY IT IS COMPUTED BEFORE THE TINT RESOLVES AND NOT AFTER.**
   * The ramp is the surface's colour-by-depth LUT, so deepening the index is what makes a thick region read
   * as seen-through rather than merely as darker -- the same reason crystal indexes '0.25 + refract'. Under
   * 'tintSource: 'preset'' there is no LUT to shift, so refraction reaches that source through the scatter
   * and dispersion terms below only; that is a property of the source, not a gap.
   */
  float refract = thickness * clamp(uRefraction, 0.0, 1.0);

  // The FIVE tint sources. 'preset' resolves on the CPU to the figure's MEAN colour and arrives as uTint,
  // while 'palette', 'material' and 'ramp' all index a 256x1 LUT by thickness -- deepened by 'refract'.
  // 'dye' (4, v8 Step 15.7) is the only one that is a per-pixel TEXTURE READ of a field with its own history.
  float rampAt = clamp(thickness + refract, 0.0, 1.0);
  vec3 tint;
  if (uTintSource == 1 && uPaletteEnabled == 1) {
    // v8 26.4 — rotated, because this branch IS the palette. The uRamp branch below is the MATERIAL's
    // own ramp and is deliberately left alone: Warmth names the figure's colour, not the material's.
    float rampC = uPaletteHueShift == 0.0 ? rampAt : fract(rampAt + uPaletteHueShift);
    tint = texture(uPalette, vec2(rampC, 0.5)).rgb;
  } else if (uTintSource == 2 || uTintSource == 3) {
    tint = texture(uRamp, vec2(clamp(rampAt, 0.01, 0.99), 0.5)).rgb;
  } else if (uTintSource == 4) {
    /*
     * v8 Step 15.7 -- THE ADVECTED DYE FIELD AS THE SURFACE'S ALBEDO.
     *
     * The field is premultiplied by its own deposit weight, so the colour is 'rgb / a' -- the identical
     * weighted-mean form 15.2's uColorField uses, and identical for the identical reason: dividing by any
     * OTHER sum leaves a residual gain that grows with the contributor count (see the uColorField block
     * below for the measurement). ⚠️ **The divisor is uDye's OWN alpha, never d and never cf.a.**
     *
     * ⚠️ **THE PER-PIXEL FALLBACK IS WHAT MAKES THIS SOURCE USABLE AT ALL, and it is a RAMP read rather
     * than a flat colour.** A dye field is sparse by construction: it only holds colour where the figure has
     * BEEN, so on the first frames after enabling -- and permanently in any region the figure never visits --
     * a texel's weight is 0. Tinting those texels black would make the surface read as holes punched in the
     * blob (the field is the ALBEDO here, so 0 albedo is a black body, not an absent overlay). Falling back
     * to the same 'ramp' read the CPU-side degrade uses means an un-dyed region looks like an ordinary liquid
     * surface and the dye adds colour where it exists. So the two degrade paths -- field-off on the CPU and
     * field-empty-here on the GPU -- resolve to the SAME value, which is why there is one look and not two.
     *
     * ⚠️ **The field is LINEAR-filtered, so this guard is not merely about sparsity**: an edge texel can
     * interpolate a numerator and a denominator that both round to 0 in half float, and 0/0 is NaN. NaN
     * reaches acesToneMap, which is rational and NaN at Inf, on the screen path past every sanitiseTrail()
     * (invariant 20). The threshold is the same 1e-6 uColorField uses.
     *
     * ⚠️ **The dye is NOT indexed by 'rampAt' and that is deliberate**: it is a spatial field, addressed by
     * where the fragment IS, so refraction cannot deepen it the way it deepens a LUT index. Refraction still
     * reaches this source through the dispersion, scatter and absorption terms below -- the same property
     * 'preset' has, and for the same reason (no LUT to shift).
     */
    // dyeS and its saturation were resolved BEFORE the discard, because the wake needs them there. Read
    // again here and the two could disagree; the wake branch above documents why that seams.
    vec3 rampFallback = texture(uRamp, vec2(clamp(rampAt, 0.01, 0.99), 0.5)).rgb;
    /*
     * ⚠️ **THE QUOTIENT IS SCALE-INVARIANT, SO IT ALONE MAKES EVERY SLIDER INERT — the alpha must reach the
     * screen as well as the hue.** Fixed 2026-09-03 on a user report of *"none of the sliders seems to have an
     * effect"*, which was exactly right and is a DIFFERENT defect from the two fixed earlier the same day.
     * NO BACKTICKS IN THIS COMMENT -- invariant 18 bit this exact block once already; a backtick here
     * terminates the enclosing template literal and tsc reports it hundreds of lines away.
     *
     * The quotient rgb/a divides out precisely what Dye Amount, Dye Decay, Dye Radius and every overlapping deposit
     * change: measured, all four returned the identical colour at every value (steady-state alpha spans ~8 to
     * ~660 across the visited region and the quotient discards all of it). So the hue comes from the quotient
     * and the DENSITY comes from the alpha, as an exponential saturation toward the dye colour.
     *
     * uDyeSatK = 0.02 is DERIVED, not picked: steady-state alpha is amount * n / (1 - decay), so the shipped
     * defaults (amount 0.5, decay 0.985) land at 0.487 -- near mid-range, leaving both directions visible --
     * while the slider extremes reach 0.010 (amount 0.05, decay 0.90) and 1.000 (amount 1.0, decay 0.999).
     * A larger k saturates the default and would make the top half of both tracks inert; a smaller one wastes
     * the bottom half. ⚠️ **This is the same trap invariant 13's harder form describes, one level deeper: the
     * control moved the field, the field reached the shader, the shader READ it -- and the arithmetic then
     * normalised the change away. ASK WHAT THE READ CAN REPRESENT, not merely whether the value arrives.**
     *
     * Mixing FROM the ramp fallback means a thin or new deposit reads as a faint tint over an ordinary liquid
     * surface and a saturated one as the dye colour outright, so the two degrade paths still agree at a = 0
     * (invariant 21's release-to-a-representable-value rule: the guard's own trip stays visible).
     */
    tint = mix(rampFallback, dyeHueOf(dyeS, rampFallback), dyeA);
  } else {
    // 'preset', and the fallback when Palette is chosen with no palette live -- which mirrors what the
    // point path does in the same situation rather than drawing an unlit blob.
    tint = uTint;
  }

  /*
   * v8 Step 15.2. The per-pixel WEIGHTED MEAN of the colours of the particles that formed this pixel:
   * sum(colour*w) / sum(w), both co-accumulated by the same draw into uColorField. This COMPOSES with all
   * four sources above rather than being a fifth one -- uColourMix 0 is the 15.1 image exactly.
   *
   * ⚠️ **The divisor is uColorField's OWN alpha, never d from uDensity.** They are the same sum in
   * different precisions (RGBA16F vs R32F), so mixing them leaves a residual gain that GROWS with the
   * contributor count -- i.e. it is largest in the blob interior, exactly where the mixing is meant to be
   * smoothest. ⚠️ **And the reason the own-alpha form is better is NOT that it cancels exactly -- I wrote
   * that first and it is false.** Half float stalls a numerator term (c*w) at a different point from its
   * own denominator term (w), so a bias survives either way; what makes it small is that both sums stall
   * at the SAME accumulation steps, so the errors are CORRELATED and the ratio keeps only their difference.
   * Measured over Wyvill-distributed weights: mean relative bias at 2048 contributors (Sum(w) ~ 513) is
   * -0.53% own-alpha against -2.52% cross-format, a factor of 4.7, and both are below one 8-bit step until
   * a few hundred contributors. Small, but monotone in the count, which is the shape that reads as a
   * brightness gradient rather than as noise.
   *
   * ⚠️ **wSum > 0 is guaranteed here by cover > 0 and is STILL guarded**, because the guard is not
   * about the density test: uColorField is LINEAR-filtered, so a fragment at the very edge of the surface
   * can interpolate a numerator and a denominator that both round to 0 in half float. 0/0 is NaN, and NaN
   * reaches acesToneMap -- which is RATIONAL, is NaN at Inf, runs on the screen path, and is unreachable
   * by sanitiseTrail() (invariant 20). One frame of that spreads frame-wide via the band blur.
   */
  vec4 cf = texture(uColorField, vUv);
  float wSum = cf.a;
  vec3 perParticle = wSum > 1e-6 ? cf.rgb / wSum : tint;

  /*
   * Two mix models. Both are functions of perParticle and wSum, and ⚠️ **THAT IS A HARD LIMIT OF ONE
   * ACCUMULATION TARGET, NOT A SIMPLIFICATION -- do not read 'pigment' as Kubelka-Munk.** The only per-pixel
   * statistic an additive pass can leave behind is the weighted ARITHMETIC MEAN of the contributors'
   * colours; the product of transmittances that real subtractive mixing needs would require accumulating
   * sum(w*log c) instead, and the two cannot share the three RGB channels (A is already sum(w)). So
   * hue-shifting subtractive mixing -- yellow over blue reading GREEN -- is **not reachable here at all**,
   * and a future step wanting it must add a second colour target, not tune this branch.
   *
   * What the two models therefore are:
   *  - 'light' (0): the weighted mean itself. Overlaps blend toward the lighter constituent and, with many
   *    contributors of differing hue, toward WHITE. This is what every other path in this engine does and
   *    what the palettes and film looks were tuned against, hence the default.
   *  - 'pigment' (1): the same mean, then BEER-LAMBERT deepened by the overlap depth -- c^n, i.e. the mean
   *    transmittance seen through n stacked layers. Overlaps read as denser and darker instead of paler,
   *    which is the visible signature that separates pigment from light (subtractive tends to black, additive
   *    to white). ⚠️ **It is an IDENTITY at wSum <= 1** (a single-contributor pixel has an exponent of 1),
   *    so the model changes the OVERLAPS and leaves the thin rim alone -- which is what makes it read as a
   *    material property rather than as a brightness slider.
   *
   * ⚠️ **pow's base is clamped to >= 0 and the RESULT is clamped too.** pow(x, y) is undefined for x < 0
   * in GLSL and this value feeds the trail's feedback loop, where one NaN is inescapable by the fade pass
   * (it MULTIPLIES) and reaches acesToneMap, which is rational and NaN at Inf -- past every guard
   * sanitiseTrail() covers (invariant 20). Clamping at this operator's own output is the rule.
   */
  vec3 mixed = perParticle;
  if (uMixModel == 1) {
    float layers = clamp(1.0 + 0.6 * log2(max(wSum, 1.0)), 1.0, 3.0);
    mixed = clamp(pow(clamp(perParticle, 0.0, 1.0), vec3(layers)), 0.0, 1.0);
  }

  /*
   * ⚠️ **mix, so uColourMix == 0.0 is tint EXACTLY** -- an algebraic identity, which is what makes
   * 15.1's image recoverable rather than approximately recoverable. §O asserts that identity; it does NOT
   * assert preset neutrality, because the default is 0.85 and a default merges into every preset that
   * omits the block.
   *
   * ⚠️ **NO BACKTICKS ANYWHERE BELOW, ON PURPOSE — one of them terminated this template literal and tsc
   * reported nine errors far from the cause (invariant 18). This comment lives INSIDE the GLSL string.**
   *
   * ⚠️ **dye (source 4) IS EXEMPT, AND THAT EXEMPTION IS THE WHOLE REASON THE SOURCE IS USABLE AT ITS OWN
   * DEFAULT** -- fixed 2026-09-03 on a user report of *"no visible change at all"* against a field that was
   * working end to end. At the shipped colourMix of 0.85 this line REPLACED 85 % of the dye with the
   * instantaneous per-particle mean, so the feature shipped 15 % visible and read as inert. **The two
   * quantities are not alternatives to be balanced: "mixed" is what the particles ARE this frame, and the dye
   * is what passed through this pixel EARLIER. Blending the first over the second discards exactly the
   * history that made dye worth adding as a fifth source rather than as another statistic.**
   *
   * ⚠️ **The exemption is here rather than in the CPU's srcInt resolve, because the other four sources must
   * keep the identical behaviour** -- and it is a mixAmt of 0 rather than a skipped statement so the
   * mix() stays one expression with one clamp (a second assignment to tint in a branch is how two
   * paths come to disagree about whether the clamp ran).
   *
   * ⚠️ **THIS IS NOT INVARIANT 13's ORDINARY SHAPE.** The control moved the right field, the field reached
   * the GPU, and the shader read it -- a downstream operator then overwrote the result. **When a new source
   * lands in a slot that an existing operator consumes, check what that operator does to it**; three
   * sittings of readings exonerated the dye pipeline one file at a time because every file was correct.
   */
  float mixAmt = (uTintSource == 4) ? 0.0 : uColourMix;
  tint = mix(tint, mixed, clamp(mixAmt, 0.0, 1.0));

  // Diffuse from a fixed head-on-ish light. Deliberately mild: the SILHOUETTE is the feature of 15.1, and a
  // strong key light would read as embossing rather than as a body of liquid.
  vec3 lightDir = normalize(vec3(-0.35, -0.55, 0.75));
  float diff = 0.55 + 0.45 * clamp(dot(n, lightDir), 0.0, 1.0);
  vec3 col = tint * diff;

  /*
   * ============================ v8 Step 15.3 -- surface MATERIAL ============================
   *
   * Four terms, all functions of the density field and the normal already computed above. Every one is a
   * LERP-FROM-NEUTRAL or a pure multiplier by its own control, so all four at 0 restore the 15.2 image
   * exactly -- which is what 'fieldcheck' §O asserts, rather than any single control's neutrality.
   *
   * ⚠️ **THE SPEC'S "sample the trail buffer offset by the normal" IS NOT WHAT THIS DOES, AND THE THREE
   * MEASUREMENTS THAT REJECTED IT ARE IN THE BLOCK COMMENT UNDER 'LiquidSurfaceConfig' ('presets/types.ts').**
   * In short: this pass
   * WRITES the trail, so reading it is a GL feedback loop; the trail behind the blob is essentially black
   * (residue 0.0003 after 10 frames at the demo preset's decay 0.45); and a kernel-scale offset lands on the
   * surface's own previous position on 4 of 5 representative presets (0.000 px/frame on the demo preset
   * itself) -- 14.3's finding exactly. So the refractive cue is generated FROM THE SURFACE, which has
   * structure, instead of from a background that does not. The same step also mandates crystal's vocabulary
   * verbatim, and crystal's 'internalRefraction' samples no background either; that half is honoured.
   */

  // 1. CHROMATIC DISPERSION. R and B sampled at +/- the normal's in-plane direction, G left at the centre:
  //    the classic three-tap dispersion, and the reason a refractive edge reads as refractive rather than as
  //    merely bright. ⚠️ **The offset is REFRACT_SPREAD * uRadius / resolution -- a fraction of the KERNEL,
  //    never a texel count** (invariant 26's shape: a fixed texel offset measures 0.1006 at R = 6.08 px and
  //    exactly 0.0000 at R = 2.5 px, because past the kernel's support both taps read the same value). The
  //    density texture is CLAMP_TO_EDGE, so a tap off the surface is a defined, monotone read.
  if (uRefraction > 0.0) {
    vec2 dispDir = n.xy * (${glslFloat(REFRACT_SPREAD)} * uRefraction * uRadius) * texel;
    float tR = thicknessAt(vUv + dispDir);
    float tB = thicknessAt(vUv - dispDir);
    // Applied as a per-channel GAIN around the centre thickness, so a flat interior (tR == tB == thickness)
    // is an exact identity and only a thickness GRADIENT tints. Halved because the two taps straddle the
    // centre, so the full delta would double-count the local slope.
    vec3 disp = vec3(tR - thickness, 0.0, tB - thickness) * 0.5;
    col *= clamp(vec3(1.0) + disp, 0.0, 2.0);
  }

  // 2. INTERNAL SCATTER -- crystal's 'iceCol * refract * 1.15', on this surface's own tint. Additive, so it
  //    lifts a thick body the way light bouncing inside one does; 'refract' is already thickness-weighted,
  //    so the thin rim is untouched.
  col += tint * refract * 1.15;

  // 3. SPECULAR. Blinn-Phong on the real normal, so the glint tracks the surface's curvature instead of
  //    sitting at a fixed screen position. ⚠️ **SPEC_EXPONENT is 16, not crystal's 42** -- crystal's normal
  //    is FACETED (piecewise constant, one glint per face) while this one is a smooth central difference, on
  //    which 42 lights 17 % of the surface as a dim wash rather than sharpening anything (the lobe's peak
  //    moves only 0.999 -> 0.988 across the whole exponent range). See SPEC_EXPONENT.
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfV = normalize(lightDir + viewDir);
  col += vec3(pow(max(dot(n, halfV), 0.0), ${glslFloat(SPEC_EXPONENT)}) * max(uSpecular, 0.0));

  // 4. FRESNEL RIM -- bright where the surface turns away, clear face-on: the property that separates a body
  //    of liquid from a flat filled region. ⚠️ **The signal is dot(n, view), NOT 1 - thickness**: the latter
  //    lights 91.9 % of a dense curve's surface (a global tint, not a rim) and its width swings with the
  //    figure's density regime, while n.z already carries uThickRef * 0.5 and so is reference-normalised --
  //    count-independent for free. White-biased like crystal's, since a specular rim reflects the light
  //    rather than the body.
  float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), ${glslFloat(FRESNEL_EXPONENT)});
  col += mix(tint, vec3(1.0), 0.6) * fres * max(uEdgeBright, 0.0);

  /*
   * 5. BEER-LAMBERT ABSORPTION through the body. ⚠️ **THIS IS NOT 15.2's 'pigment' MODEL BY ANOTHER NAME**:
   *    'pigment' exponentiates by 'wSum', the weight sum of contributing PARTICLES (a colour-mixing
   *    statistic), while this multiplies by 'exp(-thickness * k)' on the density field's own GEOMETRY -- it
   *    exists at colourMix 0 with no colour target sampled at all. They compose deliberately.
   *
   *    ⚠️ **Applied LAST, so it attenuates the body AND the terms above it, which is the physical order**:
   *    scatter and rim are light that left the surface, and light leaving a thick body is what gets
   *    absorbed. Ordering it before them would let a thick core keep a full-strength rim, i.e. exactly the
   *    "flat region with a bright outline" this step exists to stop.
   */
  col *= exp(-thickness * max(uThickness, 0.0) * ${glslFloat(ABSORB_SCALE)});

  // Clamped at this operator's own output: the value feeds the trail's FEEDBACK LOOP, where the fade pass
  // MULTIPLIES and so cannot escape a non-finite texel, and acesToneMap downstream is rational and NaN at
  // Inf (invariant 20). 'pow' above is guarded by its 'max(…, 0.0)' base for the same reason.
  col = clamp(col, 0.0, 64.0);

  /*
   * v8 Step 15.7 wake pass -- the composite. ⚠️ **PREMULTIPLIED THROUGHOUT, and the two contributions are
   * added in premultiplied form rather than mix()ed**, which is what makes them compose correctly under the
   * pass's ONE, ONE_MINUS_SRC_ALPHA blend: 'col * cover' is the surface's own premultiplied colour and
   * 'wake * wakeA' is the wake's, and the alphas add to exactly the coverage the two together occlude.
   *
   * ⚠️ **wakeA = (1 - cover) * dyeA, so the wake fills only what the surface LEAVES.** That factor is the
   * whole reason the wake does not brighten the body: at cover = 1 it is 0, so a fully covered pixel is
   * byte-identical to before this step. It is also why the feathered edge is continuous -- the wake fades in
   * exactly as the surface fades out, and the early-return branch above evaluates the same expression at
   * cover = 0 rather than a second one that agrees only approximately.
   *
   * ⚠️ **The alpha SUM is clamped to 1.** cover + (1 - cover) * dyeA is already <= 1 for dyeA <= 1, so the
   * clamp is not arithmetic insurance -- it is invariant 20's rule applied at this operator's own output,
   * because this value goes into the trail's feedback loop where the fade pass MULTIPLIES and cannot escape
   * a non-finite texel.
   *
   * ⚠️ **At every source but dye this is 'vec4(col * cover, cover)' EXACTLY** -- dyeA is 0, so wakeA is 0 and
   * both added terms vanish. An algebraic identity, not a close approximation, which is what makes the four
   * pre-15.7 sources unchanged rather than nearly unchanged (the same property colourMix 0 has).
   */
  float wakeA = (1.0 - cover) * dyeA;
  vec3 wake = dyeHueOf(dyeS, vec3(0.0));
  fragColor = vec4(col * cover + wake * wakeA, clamp(cover + wakeA, 0.0, 1.0));
}`;
    this.liquidSurfaceProgram = compileProgram(gl, LIQUID_SURF_VERT, LIQUID_SURF_FRAG, 'HDRParticle liquid surface');
    this.uLiquidSurfDensity = gl.getUniformLocation(this.liquidSurfaceProgram, 'uDensity');
    this.uLiquidSurfRamp = gl.getUniformLocation(this.liquidSurfaceProgram, 'uRamp');
    this.uLiquidSurfPalette = gl.getUniformLocation(this.liquidSurfaceProgram, 'uPalette');
    this.uLiquidSurfIsoRef = gl.getUniformLocation(this.liquidSurfaceProgram, 'uIsoRef');
    this.uLiquidSurfThickRef = gl.getUniformLocation(this.liquidSurfaceProgram, 'uThickRef');
    this.uLiquidSurfSoftness = gl.getUniformLocation(this.liquidSurfaceProgram, 'uSoftness');
    this.uLiquidSurfTintSource = gl.getUniformLocation(this.liquidSurfaceProgram, 'uTintSource');
    this.uLiquidSurfPaletteEnabled = gl.getUniformLocation(this.liquidSurfaceProgram, 'uPaletteEnabled');
    this.uLiquidSurfPaletteHueShift = gl.getUniformLocation(this.liquidSurfaceProgram, 'uPaletteHueShift');
    this.uLiquidSurfResolution = gl.getUniformLocation(this.liquidSurfaceProgram, 'uResolution');
    this.uLiquidSurfTint = gl.getUniformLocation(this.liquidSurfaceProgram, 'uTint');
    this.uLiquidSurfColor = gl.getUniformLocation(this.liquidSurfaceProgram, 'uColorField');
    this.uLiquidSurfDye = gl.getUniformLocation(this.liquidSurfaceProgram, 'uDye');
    this.uLiquidSurfDyeSatK = gl.getUniformLocation(this.liquidSurfaceProgram, 'uDyeSatK');
    this.uLiquidSurfColourMix = gl.getUniformLocation(this.liquidSurfaceProgram, 'uColourMix');
    this.uLiquidSurfMixModel = gl.getUniformLocation(this.liquidSurfaceProgram, 'uMixModel');
    // v8 Step 15.3 — the surface material's five.
    this.uLiquidSurfRefraction = gl.getUniformLocation(this.liquidSurfaceProgram, 'uRefraction');
    this.uLiquidSurfSpecular = gl.getUniformLocation(this.liquidSurfaceProgram, 'uSpecular');
    this.uLiquidSurfThickness = gl.getUniformLocation(this.liquidSurfaceProgram, 'uThickness');
    this.uLiquidSurfEdgeBright = gl.getUniformLocation(this.liquidSurfaceProgram, 'uEdgeBright');
    this.uLiquidSurfRadius = gl.getUniformLocation(this.liquidSurfaceProgram, 'uRadius');

    // Seeded from the LIVE config, not from a hardcoded name — the same RF-02 fix `initSplat` carries for
    // the crystal ramp. `dispose()` nulls this texture but deliberately leaves `liquidConfig` populated, so
    // a dispose()/init() round-trip (a render-mode change, a film look, a preset switch) would otherwise
    // revert a chosen ramp to the default while `getLiquidConfig()` still reported the chosen one.
    this.liquidRampTex = gl.createTexture();
    this.liquidRampUploaded = this.liquidRampName();
    gl.bindTexture(gl.TEXTURE_2D, this.liquidRampTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      getColourRampData(this.liquidRampUploaded));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.liquidSurfaceVao = gl.createVertexArray();
    gl.bindVertexArray(this.liquidSurfaceVao);
    this.liquidQuadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.liquidQuadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPosLiquid = gl.getAttribLocation(this.liquidSurfaceProgram, 'aPos');
    gl.enableVertexAttribArray(aPosLiquid);
    gl.vertexAttribPointer(aPosLiquid, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /**
   * The ramp the surface samples, resolved from `tintSource`.
   *
   * ⚠️ **`'preset'` and `'material'` are pre-resolved to a RAMP in step 15.1 because a fullscreen pass has
   * no per-particle identity to read** — the particle colours are gone once the field is accumulated. Step
   * 15.2 replaces this with weighted per-particle accumulation (`Σ(colour·w)/Σw`), which is exactly the
   * "colour drops mixing" the phase is aiming at; until then `'material'` at least follows the live
   * material's own ramp, so `LiquidLight` looks like `LiquidLight`, and `'preset'` falls back to the
   * config's `surfaceRamp`.
   */
  private liquidRampName(): ColourRampName {
    if (this.liquidConfig.tintSource === 'material' && this.materialConfig && this.materialConfig.preset !== 'None') {
      return this.materialConfig.colourRamp;
    }
    return this.liquidConfig.surfaceRamp;
  }

  /**
   * The liquid sprite's radius in PIXELS, after the hardware clamp — **the ONE owner of this arithmetic**.
   *
   * Two callers need the identical number and they fail differently when it drifts: the accumulation pass
   * needs the DIAMETER for `gl_PointSize`, and `uIsoRef` needs the RADIUS for `dMean = N·πR²/(4·W·H)`. A
   * second copy of the clamp is how the frame-mean normalisation silently stops holding at a large canvas
   * (invariant 10 at a boundary), so both go through here — and so does `estimateParticlePixels()`.
   */
  private liquidPointDiameter(): number {
    const scaleFactor = (this.width + this.height) / (1024.0 + 768.0);
    const requested = 8.0 * scaleFactor * this.particleSize * this.liquidConfig.kernelWidth;
    return Math.min(Math.max(requested, 1.0), this.maxPointSize);
  }

  /**
   * v8 15.1b — the smoothed density reference for this frame. Measure, then EMA.
   *
   * ⚠️ **THE SMOOTHING IS JUDGED IN `1/isoRef`, THE QUANTITY THE SHADER ACTUALLY CONSUMES, NOT IN THE
   * REFERENCE** — 14.7b shipped exactly that mistake (a correct measurement of the wrong quantity, invariant
   * 10) and its remedy is applied here before the defect could ship: unsmoothed, the worst per-frame jump in
   * `1/isoRef` is 99.29 % on `Waves`, which is a visible pulse of the whole surface; at τ = 0.25 s it is
   * ≤ 1.15 %. See `LIQUID_REF_TAU_SECONDS`.
   *
   * ⚠️ **DISCONTINUITIES ARE RESET ON KNOWN EVENTS ONLY** (`resetLiquidReference`, called from the places
   * that KNOW: init, resize, config change). A magnitude threshold was measured and rejected for the depth
   * band on the identical grounds — a legitimate per-frame delta from fast motion is as large as a real
   * discontinuity, so any threshold either never fires or fires constantly.
   */
  private resolveLiquidReference(
    state: GeneratorState,
    /**
     * ⚠️ **`curveCount`, and the PARAMETER NAME is the fix rather than a tidy-up (`15.6-salvage` B,
     * 2026-09-03).** It was called `solidCount`, which is a DIFFERENT published quantity — and the tile's
     * transcription of this function read that name literally and passed the actual `solidCount`, excluding
     * neither tail block. A wrong name on a shared quantity is how two consumers of one owner disagree while
     * both look correct at their own call site.
     *
     * Feeds BOTH terms of the reference — the on-curve arm's spacing and the frame-mean arm's population — so
     * the two cannot be split: counting the tail blocks in one arm while excluding them from the other would
     * raise the very lower bound the exclusion exists to stay above.
     */
    curveCount: number,
    radius: number,
    dtSeconds: number,
  ): number {
    const spacing = measureIndexSpacing(state.positions, curveCount);
    const measured = liquidDensityReference(curveCount, radius, this.width, this.height, spacing);
    this.liquidRefSmoothed = this.liquidRefSmoothed > 0
      ? smoothLiquidReference(this.liquidRefSmoothed, measured, dtSeconds, LIQUID_REF_TAU_SECONDS)
      : measured;
    return this.liquidRefSmoothed;
  }

  /**
   * Drops the reference's history, so the next frame snaps rather than gliding. ⚠️ **Called on the events
   * that CHANGE the reference's own basis** — a resize changes `W·H` and the clamped radius, a Kernel Width
   * or Particle Size change moves `R`, and a preset change replaces the figure outright. Gliding across one
   * of those is the artefact, not the fix.
   */
  private resetLiquidReference(): void {
    this.liquidRefSmoothed = 0;
  }

  /**
   * @param dtSeconds real frame delta in SECONDS. ⚠️ **The default is a nominal 60 Hz step, NOT 0** — a
   *   caller that forgets it gets slightly wrong smoothing, where 0 would disable the smoothing entirely and
   *   read as "the EMA does nothing" (invariant 13 through a default). `main.ts` passes `dtMs * 0.001`.
   */
  render(state: GeneratorState, _target: GPUTarget, dtSeconds: number = 1 / 60): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) return;

    // v8 Phase 8a-2: the crystal pass is NOT called here any more. main.ts now calls
    // renderCrystalOnly() once before its neon/ribbon/particle branch, so that crystals appear in
    // every render mode rather than only in the branch that reaches this method. Calling it here as
    // well would draw the same quads twice and, because they are alpha-composited, visibly darken
    // and over-saturate them.

    // v8 Phase 8a-3: a crystal is drawn ONLY by the crystal pass, and crystals occupy the trailing
    // block of the concatenated arrays — so the point paths (pixel/blend/star) simply
    // do not draw that far.
    //
    // 8a instead zeroed a frozen particle's colour and relied on additive blending to make it
    // contribute nothing. That is not sound here: with a palette film look active the fragment
    // shader REPLACES vColor from the palette LUT (uPaletteEnabled branch), so a zeroed colour is
    // resurrected as a full-brightness dot on top of the ice. Truncating the draw cannot be
    // defeated by any shader path.
    const solidCount = state.count - (state.crystalCount ?? 0);
    /*
     * v8 15.5, CORRECTED 2026-09-03 (`15.6-salvage` B). The population lying ON THE CURVE. Used ONLY where a
     * statistic of the figure is wanted (`renderLiquid`'s density reference and tint mean); every DRAW below
     * uses `solidCount` and so includes both tail blocks. See `renderLiquid`'s header for the split by consumer.
     *
     * ⚠️ **THIS WAS `solidCount − liquidCount`, WHICH EXCLUDED THE POOL AND LEFT THE SPARKS IN — AND THE SPARK
     * BLOCK IS THE ONE THAT CORRUPTS THE MEASUREMENT WORSE, BECAUSE IT IS A *MIDDLE* BLOCK.** Canonical order
     * is `[wave][sparks][liquid][crystals]`, so subtracting only the trailing pool leaves a range that runs
     * `[0, waveCount + sparkCount)`: `measureIndexSpacing()` then walks straight across the wave→spark boundary
     * and onward through the sparks, where indices are adjacent but positions are unrelated BALLISTIC EMBERS.
     * That is exactly the *"bridging two unrelated segments of the curve"* error that function's own header
     * warns about for culled slots, arriving through a second door — and it inflates `s`, which drives
     * `(32/35)·R/s` DOWN and hands the threshold to the frame-mean lower bound. 15.1b's dot-cloud path, on a
     * figure that is still a curve, i.e. the 21× Iso Level spread 15.1b exists to remove, returning as soon as
     * a material turns sparks on.
     *
     * ⚠️ **`waveCount` IS THE RIGHT SOURCE RATHER THAN A SECOND SUBTRACTION, and that is the three-enumerations
     * rule.** `solidCount − liquidCount − sparkCount` would be a fourth hand-written spelling of the partition
     * (and `sparkCount` is not even published), whereas `waveCount` IS the published index of the first tail
     * slot — one name for the quantity, defined by the producer. `Math.min` guards a generator that publishes a
     * `waveCount` above the drawable range; the fallback keeps the pre-2026-09-03 expression for a generator
     * that publishes no partition at all, where *"absent means the whole array is wave particles"*.
     */
    const curveCount = state.waveCount !== undefined
      ? Math.min(state.waveCount, solidCount)
      : solidCount - (state.liquidCount ?? 0);

    // Upload position data as 2D (skip Z for now, used only for depth)
    const pos2d = this.packSolidPos2d(state, solidCount);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pos2d, gl.DYNAMIC_DRAW);

    // The remaining per-slot buffers are uploaded at full length — a buffer longer than the draw
    // count is harmless, and this keeps the common (no-crystal) path a straight bufferData of the
    // generator's own arrays with no copy.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.colors, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.depthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.depths, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.velocityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.velocities, gl.DYNAMIC_DRAW);

    // B14: temperatures, or zeros when no material is running. The zero buffer is cached and only
    // reallocated when the count changes, so a preset with no material allocates once rather than
    // every frame.
    let temps = state.temperatures;
    if (!temps) {
      if (this.pointTempZeros.length !== state.count) this.pointTempZeros = new Float32Array(state.count);
      temps = this.pointTempZeros;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointTempBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, temps, gl.DYNAMIC_DRAW);

    // Ages. Prefer the material's real lifetimes; otherwise synthesise a staggered phase so mapping 5 works
    // WITHOUT a material — unlike temperature, age needs no material to mean something.
    // Same length trap as the splat path: `state.lifetimes` is only `particleCount` long while the point
    // path draws `state.count`. Treat a SHORT array exactly like a missing one.
    let ages = state.lifetimes;
    if (!ages || ages.length < state.count) {
      if (this.pointAgeSynth.length !== state.count) {
        this.pointAgeSynth = new Float32Array(state.count);
        for (let i = 0; i < state.count; i++) this.pointAgeSynth[i] = (i / Math.max(1, state.count)) * 6.0;
      }
      // Advance a local clock so the cycle animates. One frame at 60fps; exactness does not matter here,
      // and taking dt would mean threading it into render() for a cosmetic mapping.
      this.pointAgeClock += 1 / 60;
      const base = this.pointAgeClock;
      for (let i = 0; i < state.count; i++) {
        this.pointAgeSynth[i] = ((i / Math.max(1, state.count)) * 6.0 + base) % 6.0;
      }
      ages = this.pointAgeSynth;
    }
    // (the synth branch above already sizes to state.count, so no further padding is needed)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointAgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, ages, gl.DYNAMIC_DRAW);

    // v8 31.2 — the packed channels, EVERY FRAME whether the feature is on or not. See `resolveChannels`.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.channelsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.resolveChannels(state), gl.DYNAMIC_DRAW);

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, this.width, this.height);
    gl.uniform1f(this.uGlow, this.glow);
    gl.uniform1f(this.uDepthSize, this.depthSize);
    gl.uniform1f(this.uDepthBrightness, this.depthBrightness);
    gl.uniform1f(this.uDepthDof, this.depthDof);
    gl.uniform1f(this.uDepthColorShift, this.depthColorShift);
    gl.uniform1f(this.uParticleSize, this.particleSize);
    // v8 28.5. Written UNCONDITIONALLY, like every other uniform here: gating it on "is the figure
    // hidden" is what leaves the previous preset's value in place after a switch.
    /*
     * v8 28.5 -- THE CULL IS SUPPRESSED FOR A SUBSET DRAW, and the discriminator is already published.
     *
     * ⚠️ **`drawParticleSubset()` in main.ts re-packs a ZERO-BASED copy of an arbitrary index list and
     * calls this method with `count: n` and NO `waveCount`.** In that draw `gl_VertexID` is a subset
     * offset, not a slot index, so applying the curve threshold there would cull the first `waveCount`
     * entries OF THE SUBSET -- and the spark block is drawn through exactly that path, so every spark
     * would vanish whenever the figure was hidden. That is the same defect the two call sites already
     * carry a warning about (*sparks had no draw path at all and vanished whenever neon was enabled*),
     * arriving through a third door.
     *
     * **A subset has no slot partition, therefore it has no curve block, therefore nothing is culled.**
     * `state.waveCount === undefined` is that fact, not a proxy for it, and it is the same test
     * `curveCount` below already uses. ⚠️ **Ribbon-hybrid's point subset IS curve geometry and is
     * therefore NOT covered by this** -- main.ts must skip that draw itself when the figure is hidden.
     */
    const hideBelow = state.waveCount !== undefined ? this.hideBelowIndex : 0;
    gl.uniform1i(this.uHideBelowIndex, hideBelow);
    gl.uniform1f(this.uMaxPointSize, this.maxPointSize);
    // ⚠️ **3 IS A RETIRED VALUE AND MUST NOT BE REUSED.** It was `log-density`, retired 2026-09-19; the
    // shaders only ever branched on `== 2`, so 3 reached them as "not star" and a new mode given 3 would
    // inherit that meaning silently. Both shaders read this uniform and neither enumerates it.
    const modeInt = this.renderMode === 'pixel' ? 0 : this.renderMode === 'blend' ? 1 : 2;
    gl.uniform1i(this.uRenderMode, modeInt);
    gl.uniform1i(this.uLightingMode, this.lightingMode);
    gl.uniform3f(this.uLightDir, this.lightDir[0], this.lightDir[1], this.lightDir[2]);
    gl.uniform1f(this.uRimPower, this.rimPower);
    gl.uniform1i(this.uPaletteEnabled, this.paletteLutActive() ? 1 : 0);
    gl.uniform1f(this.uPaletteHueShift, this.paletteHueShift);
    // `temperature` (3) is the ONLY mapping that needs a material. Without one `temperatures[]` is absent and
    // every particle would sample LUT index 0 — one flat colour across the whole figure. Degrade to
    // `velocity` (2) instead, which is always available. The UI labels the option accordingly, but a preset
    // can also carry mapping 3 with no material, so the guard has to live here.
    //
    // `position` (4) and `age` (5) deliberately have NO such guard: position is computed from `aPosition`,
    // and the renderer synthesises a staggered age phase when `state.lifetimes` is absent, so both work
    // without a material.
    //
    // ⚠️ **THIS DEGRADE IS STILL INERT AND THAT IS A KNOWN OPEN DEFECT (2026-09-20), NOT A WORKING GUARD.**
    // `MaterialProcessor.init()` is unconditional, so `state.temperatures` is published for every preset —
    // frozen at ZERO with no material, never absent — and `!state.temperatures` is therefore false in exactly
    // the case the guard exists for: mapping 3 with no material still samples LUT index 0 for every particle,
    // one flat colour. `state.lifetimes` had the identical defect and was fixed at the publish site in
    // `lissajous.ts`' `getState()`; **`temperatures` could not take the same fix**, because sparks and crystals
    // merge their own heat into the tail array and need no material, so gating it there would drop the spark
    // block's heat from the splat ramp. The repair belongs here or in the merge, and it is a separate decision.
    //
    // ⚠️ **MEASURED, because the obvious reason to defer it turned out to be false: the shipped library's
    // exposure is ZERO bodies.** Resolving every preset through `resolvePaletteSelection` with its own live
    // look (`Customize` → `overlay.customFilmLookParams`) gives 138 of 270 with a live palette LUT and **0**
    // that resolve to mapping 3 with no material authored; the legacy JSON bodies cannot contribute one either,
    // since `migration.ts` only ever writes `'depth' | 'phase'`. So this defect is reachable **only from the
    // Lab** — a user picking `Map: Temperature` with no material — which is what makes the fix cheap whenever
    // it is taken, and also why no preset review could ever have caught it. `fieldcheck` §V states the
    // asymmetry; the preview grid's own copy of this guard reads the AUTHORED material and is correct today.
    const effMapping = (this.paletteMapping === 3 && !state.temperatures) ? 2 : this.paletteMapping;
    gl.uniform1i(this.uPaletteMapping, effMapping);

    // Bind palette LUT texture to unit 1
    if (this.paletteLutActive() && this.paletteTexture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
      gl.uniform1i(this.uPaletteTex, 1);
    }

    if (this.renderMode === 'volume' && this.volumeAccumFBO) {
      /*
       * v8 28.5 — ⚠️ **VOLUME IS THE THIRD MODE AND IT NEEDED THE SAME ANSWER AS `liquid`, NOT THE CULL.**
       * Found 2026-10-19 while fixing the neon/ribbon spark report: this pass has its OWN
       * `volumeAccumProgram`, so `uHideBelowIndex` — which lives only in `VERT_SRC` and `SPLAT_VERT_SRC` —
       * cannot reach it. **Without this guard `Show Figure` was silently inert in volume mode**: the box
       * moved the right field and no output channel could show it (invariant 13's harder shape, for the
       * second time in this step).
       *
       * **Skipping is the right remedy rather than a third copy of the cull.** Volume ray-marches the
       * figure's own accumulated density, exactly as `liquid` reconstructs a surface from it — in both
       * modes the pass IS the figure, so there is no "figure minus the curve" left to draw. A third
       * transcription of the index rule would be a third place for it to disagree.
       *
       * ⚠️ **`fullState` for the same reason as `liquid`'s**: this branch returns unconditionally, so a
       * SUBSET draw (the spark block, via neon or ribbon) must never be suppressed by the figure's cull.
       */
      const fullStateVol = state.waveCount !== undefined;
      if (!fullStateVol || this.hideBelowIndex <= 0) this.renderVolume(state);
      return;
    }

    if (this.renderMode === 'splat' && this.splatProgram && this.splatVao && this.materialConfig) {
      this.renderSplat(state);
      return;
    }

    // v8 Step 15.1. Gated on the HANDLES as well as the mode, exactly as volume is: on a
    // context without `EXT_color_buffer_float`, or with an incomplete R32F FBO, `initLiquid` sets
    // `renderMode = 'star'` and returns, but a `setRenderMode('liquid')` arriving later must not walk into
    // a null program either (invariant 3 — a mode is a flag, and it has to die with its resources).
    if (this.renderMode === 'liquid' && this.liquidFBO && this.liquidAccumProgram && this.liquidSurfaceProgram
        && this.liquidSurfaceVao && this.liquidTex && this.liquidColorTex) {
      /*
       * v8 28.5 — ⚠️ **IN `liquid` MODE A HIDDEN CURVE HIDES THE WHOLE SURFACE, and that is the honest
       * reading rather than a shortcut.** The iso surface IS the figure here: it is reconstructed from the
       * accumulated density of `drawCount`, so "hide the curve but keep the pool" has no meaning — the
       * pool's contribution is not a separable set of pixels, it is part of one reconstructed silhouette.
       * Culling by index inside the accumulation would carve a hole in a surface that merges ACROSS its
       * inputs, which is the one thing the mode exists to do.
       *
       * ⚠️ **The cull uniform cannot reach this pass anyway** — it is declared in `VERT_SRC` and
       * `SPLAT_VERT_SRC`, and the accumulation runs `liquidAccumProgram`.
       *
       * So the result of `showFigure: false` in `liquid` mode is: the dye overlay, the crystals (drawn
       * before this branch) and nothing else. Reachable only with `tintSource !== 'dye'`, because
       * `dyeOverlayActive()` refuses the overlay when the surface is already compositing the wake — so
       * this combination cannot produce an empty frame while the dye is the tint source.
       */
      /*
       * ⚠️ **`fullState` IS LOAD-BEARING AND LEAVING IT OUT COST A REPORTED DEFECT (owner, 2026-10-19):
       * "ribbon or neon lines ... also disable sparks".**
       *
       * This branch RETURNS unconditionally, so suppressing `renderLiquid` suppresses the whole draw. With
       * neon or ribbon enabled the spark block arrives here as a SUBSET — `drawParticleSubset()` re-packs an
       * explicit index list and passes no `waveCount` — and the figure's cull was swallowing it, so hiding
       * the figure also hid the embers.
       *
       * **A subset is an explicit index list, never a figure to reconstruct, so the figure's cull must not
       * reach it.** `state.waveCount === undefined` is the same discriminator `render()` uses for the
       * vertex cull a few lines above; using the identical test rather than a second spelling is what keeps
       * the two from disagreeing. ⚠️ **It also preserves the pre-28 behaviour for subsets exactly** — they
       * still go through `renderLiquid`, as they always did.
       *
       * ⚠️ **This is the THIRD door the "sparks vanish" defect has come through** (neon drawing only trail
       * geometry, the ribbon point pass running for `hybrid` alone, and now a figure cull inside an
       * early-returning branch). **The population that no trajectory renderer will ever draw is the one
       * that keeps getting lost: check it explicitly whenever this branch changes.**
       */
      const fullState = state.waveCount !== undefined;
      if (!fullState || this.hideBelowIndex <= 0) {
        this.renderLiquid(state, solidCount, curveCount, dtSeconds);
      }
      gl.activeTexture(gl.TEXTURE0);
      return;
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, solidCount);
    gl.bindVertexArray(null);

    // Restore the active texture unit before returning. The palette bind above selects unit 1 and,
    // on the point path, nothing put it back — so `render()` returned with unit 1 current and any
    // later pass that binds a texture without first selecting a unit wrote into unit 1 instead of 0.
    //
    // Found by `checks/blendcheck.mjs` while guarding the crystal pass's version of the same leak,
    // not by observation: the point path has a single sampler, so the wrong unit is usually benign
    // and only surfaces once another pass runs afterwards in the same frame.
    gl.activeTexture(gl.TEXTURE0);
  }

  private renderSplat(state: GeneratorState): void {
    const gl = this.gl!;
    const config = this.materialConfig!;

    const pos2d = this.packSplatPos2d(state);

    const temperatures = state.temperatures ?? new Float32Array(state.count);

    gl.useProgram(this.splatProgram);
    gl.bindVertexArray(this.splatVao);

    // Upload per-instance position data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatPosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pos2d, gl.DYNAMIC_DRAW);

    // Upload per-instance temperature data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.temperatureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, temperatures, gl.DYNAMIC_DRAW);

    // Upload per-instance depth data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatDepthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.depths, gl.DYNAMIC_DRAW);

    // Upload per-instance velocity direction data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVelDirBuffer);
    const velDirs = state.velocityDirs ?? new Float32Array(state.count * 2);
    gl.bufferData(gl.ARRAY_BUFFER, velDirs, gl.DYNAMIC_DRAW);

    // B14 follow-up: speed and preset colour, for palette mappings 2 and 1 respectively. Always uploaded —
    // an enabled attribute with no bound data reads undefined values, which on some drivers is stale GPU
    // memory rather than zero.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVelBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.velocities, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatColBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.colors, gl.DYNAMIC_DRAW);
    // Ages: the material's real lifetimes if present.
    //
    // ⚠️ MUST be padded to `state.count`. `state.lifetimes` comes straight from `MaterialProcessor` and is
    // only `particleCount` long — unlike `positions`/`colors`/`depths`/`velocities`/`temperatures`, which
    // `lissajous.ts` extends to `totalCount` (wave + sparks + crystals) in its concatenating branch.
    // `lifetimes` was never extended because nothing consumed it per-instance until now.
    //
    // Uploading the short array made the draw fail with
    //   GL_INVALID_OPERATION: Vertex buffer is not big enough for the draw call
    // and ANGLE drops the whole draw — which is why selecting any material turned the preview BLACK.
    // Sparks and crystals have no meaningful age here, so the pad is zeros.
    let splatAges = state.lifetimes;
    if (!splatAges || splatAges.length < state.count) {
      if (this.splatAgePad.length !== state.count) this.splatAgePad = new Float32Array(state.count);
      else this.splatAgePad.fill(0);
      if (splatAges) this.splatAgePad.set(splatAges.subarray(0, Math.min(splatAges.length, state.count)));
      splatAges = this.splatAgePad;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatAgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, splatAges, gl.DYNAMIC_DRAW);

    // v8 Phase 8a: feed the frozen flag so the shader can discard frozen particles here — they
    // belong to the crystal pass. The buffer must be written every frame regardless, otherwise
    // it retains whatever the crystal pass last uploaded (a shorter, all-ones array).
    if (this.frozenAttrBuf.length !== state.count) this.frozenAttrBuf = new Float32Array(state.count);
    const srcFrozen = state.frozen;
    if (srcFrozen && this.crystalConfig?.enabled) {
      for (let i = 0; i < state.count; i++) this.frozenAttrBuf[i] = srcFrozen[i] === 1 ? 1 : 0;
    } else {
      this.frozenAttrBuf.fill(0);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatFrozenBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.frozenAttrBuf, gl.DYNAMIC_DRAW);

    // v8 Phase 8a-2 (T021): the same every-frame rule applies to aGrowth. The crystal pass leaves
    // behind a shorter array sized to the frozen count, so instances past that point would read
    // stale or out-of-range data and flicker. Live particles are never scaled by growth (the
    // vertex shader only applies it under aFrozen > 0.5), so all-ones is the correct content —
    // this pass just has to own the buffer's length.
    if (this.growthAttrBuf.length !== state.count) {
      this.growthAttrBuf = new Float32Array(state.count);
      this.growthAttrBuf.fill(1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatGrowthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.growthAttrBuf, gl.DYNAMIC_DRAW);

    // v8 31.2 — the second of the two per-pass uploads invariant 6 requires. ⚠️ **Both passes, at the
    // correct size, or ANGLE drops the whole draw** — the defect that turned the preview black when
    // `lifetimes` arrived here one block short.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatChannelsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.resolveChannels(state), gl.DYNAMIC_DRAW);

    // Set uniforms
    gl.uniform2f(this.splatUResolution, this.width, this.height);
    const clampedRadius = Math.min(config.splatRadius, this.maxPointSize);
    gl.uniform1f(this.splatUSplatRadius, clampedRadius);
    gl.uniform1f(this.splatUDepthSize, this.depthSize);
    gl.uniform1f(this.splatUDepthDof, this.depthDof);
    // The global multiplier is applied INSIDE the shader, after `clampedRadius`, and is deliberately NOT
    // folded into the radius above: `clampedRadius` caps at `maxPointSize`, a POINT-path limit that does
    // not apply to this pass at all (it draws instanced quads, see the note at the crystal pass), so
    // multiplying first would truncate the user's own control against a limit that is not real here.
    gl.uniform1f(this.splatUParticleSize, this.particleSize);
    // v8 28.5 -- the subset rule, see render()'s own note. renderSplat is reached from render() with the
    // same `state`, so the identical test is correct here and a second spelling of it is not.
    gl.uniform1i(this.splatUHideBelowIndex, state.waveCount !== undefined ? this.hideBelowIndex : 0);

    // Spark size override (sparks.splatRadius), selected in the shader by slot index.
    //
    // The range is derived from the generator's PUBLISHED partition, never re-derived from state.count: the
    // crystal block's length changes every frame, so the spark range's upper bound moves with it. When either
    // bound is missing the range collapses to empty and the shader's branch is unreachable — the same
    // byte-identical fallback as `sparkRadius === null`.
    //
    // ⚠️ NOT clamped against `maxPointSize`, for the reason `clampedRadius` above documents in reverse: this
    // pass draws instanced quads, so the point-size ceiling is not a real limit here. The authored range is
    // 1–8 anyway, an order of magnitude below any ceiling.
    // ⚠️ **v8 15.5: THE UPPER BOUND MUST SUBTRACT `liquidCount` AS WELL, AND THIS IS THE ONE SITE THE INSERTED
    // BLOCK BREAKS RATHER THAN MERELY TOUCHES.** The range was `[waveCount, count − crystalCount)`, which was
    // exactly the spark block only because sparks were the sole block between the two; a liquid block inserted
    // before the crystals WIDENS it to `[sparks][liquid]`, so every pool particle would be drawn at
    // `sparks.splatRadius` — typically 2–4 px against a material's 3–14 px, i.e. the pool would render 1.3×–7×
    // too small and, worse, would silently inherit the spark size CONTROL. The defect is invisible without a
    // fire material *and* sparks enabled *and* a pool, so no single-feature browser pass reaches it.
    //
    // ⚠️ The rule that avoids this class generally: **derive a MIDDLE block's bounds from both of its
    // neighbours, never from one end of the array.** `sparkLast` is the FIRST liquid index by construction.
    const sparkFirst = state.waveCount ?? 0;
    const sparkLast = state.count - (state.crystalCount ?? 0) - (state.liquidCount ?? 0);
    const sparkOn = this.sparkRadius !== null && state.waveCount !== undefined && sparkLast > sparkFirst;
    gl.uniform1f(this.splatUSparkRadius, sparkOn ? this.sparkRadius! : -1.0);
    gl.uniform1i(this.splatUSparkFirst, sparkFirst);
    gl.uniform1i(this.splatUSparkLast, sparkLast);

    // uFlameParams: vec4(expansion, velocityStretch, taperStrength, 0)
    const velocityStretch = config.velocityStretch ?? 0;
    const taperStrength = Math.min(velocityStretch, 1.0) * 0.7;
    gl.uniform4f(this.splatUFlameExpansion, this.flameExpansion, velocityStretch, taperStrength, 0);

    gl.uniform1f(this.splatUCoreBrightness, config.coreBrightness);
    gl.uniform1f(this.splatUHaloStrength, config.haloStrength);
    gl.uniform1f(this.splatUFalloffExponent, config.falloffExponent);
    // `this.glow` is the film look's value, kept current by `setFilmLook`. Forwarded here so a material
    // preset and a film look compose instead of the film look being ignored (B12).
    gl.uniform1f(this.splatUGlow, this.glow);
    gl.uniform1f(this.splatUEmissionIntensity, config.emissionIntensity);
    // v8 Phase 8a-3: EXCLUDE the trailing crystal block. This uniform is only used as the additive
    // overlap-compensation divisor (intensity /= sqrt(uParticleCount * r^2 * 1e-4)), and a crystal
    // slot is discarded by the fragment shader (vFrozen > 0.5) so it contributes no additive
    // energy to compensate for. Counting them would dim every LIVE particle purely because ice
    // exists, and — because the crystal block length changes every frame as slots nucleate and melt
    // — would make the whole figure's brightness breathe at the nucleation rate. Same exclusion as
    // the volume path (and as the retired log-density divisor, which is where the rule was first stated).
    //
    // ⚠️ v8 15.5 INCLUDES the liquid pool here, and the discriminator is the sentence above rather than the
    // block's position: this divisor compensates for additive OVERLAP, so its population is exactly the set of
    // slots that deposit energy — a pool particle does, a crystal does not. Excluding the pool would let a
    // 4 000-particle pool double the deposited energy with no compensation at all, which on a fire material
    // clips straight through ACES's knee (the mode where `gain` owns the saturated colour and no exposure value
    // recovers it). The count changes when `Pool Size` moves, which is correct: the overlap really did change.
    gl.uniform1f(this.splatUParticleCount, state.count - (state.crystalCount ?? 0));
    const isAdditive = config.blendMode === 'additive' ? 1.0 : 0.0;
    gl.uniform1f(this.splatUIsAdditive, isAdditive);
    gl.uniform1f(this.splatUSplatShearFixed, this.splatShearFixed ? 1.0 : 0.0);
    // T030: the splat PROGRAM is shared with the crystal pass, which sets uMaxGrowth to the swelling
    // ceiling. Reset it to the neutral 1.0 here so the live/material pass never depends on whatever
    // the crystal pass left behind. The growth branch is gated on aFrozen > 0.5 and live particles
    // carry growth 1.0, so this is defensive rather than load-bearing — but it keeps the two passes
    // independent of draw order.
    gl.uniform1f(this.splatUMaxGrowth, 1.0);

    // Bind ramp textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture);
    gl.uniform1i(this.splatURampTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.smokeRampTexture);
    gl.uniform1i(this.splatUSmokeRampTex, 1);

    // B14: the film-look palette, on unit 3 — 0/1/2 are the material, smoke and crystal ramps.
    //
    // `paletteEnabled` is the SAME flag the point path uses, and `paletteTexture` the same texture, so a
    // film look now colours materials and plain particles from one source. `mapping` is forwarded raw;
    // the fallback for an unavailable mapping lives in the shader.
    {
      // ⚠️ `paletteLutActive()`, not `paletteEnabled` — the splat shader's own mapping chain has the same
      // `else` fall-through to velocity as the point path's, so the `index` mapping has to be excluded on
      // BOTH passes. A splat preset is exactly where the miss would be least visible: the material ramp is
      // still colouring the sprite, so the wrong answer looks like a material, not like a defect.
      const palOn = this.paletteLutActive() && this.paletteTexture ? 1 : 0;
      gl.uniform1i(this.splatUSplatPaletteEnabled, palOn);
      gl.uniform1i(this.splatUSplatPaletteMapping, this.paletteMapping);

      // The sampler is pointed at unit 3 UNCONDITIONALLY, and a texture is always bound there.
      //
      // Two reasons this must not be inside the `palOn` branch:
      //
      // 1. A sampler that is never assigned defaults to unit **0**, which holds the MATERIAL RAMP. Two
      //    samplers reading one unit with different filtering is undefined behaviour in GL, and in practice
      //    some drivers resolve the whole draw to BLACK rather than just ignoring the unused sampler. That is
      //    the regression this replaced: selecting a material turned the preview black, because the palette
      //    was disabled (film look `Legacy`) so the sampler stayed on unit 0 alongside `uRampTex`.
      // 2. Sampling an INCOMPLETE texture unit also yields black. Binding the ramp as a harmless stand-in
      //    when there is no palette keeps unit 3 complete either way; the shader still gates on
      //    `uSplatPaletteEnabled`, so the stand-in is never read.
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, palOn === 1 ? this.paletteTexture : this.rampTexture);
      gl.uniform1i(this.splatUSplatPaletteTex, 3);

      // Leave the active unit where the rest of this method expects it. `activeTexture` is global GL state,
      // and the crystal pass and smoke pass both bind by unit afterwards.
      gl.activeTexture(gl.TEXTURE0);
    }

    const uSmokeThreshold = this.splatUSmokeThreshold;
    const uSmokeOpacity = this.splatUSmokeOpacity;
    const uRenderPass = this.splatURenderPass;

    if (this.smokeThreshold > 0) {
      // Pass 1: Smoke (alpha-blended behind flame, premultiplied)
      gl.uniform1f(uSmokeThreshold, this.smokeThreshold);
      gl.uniform1f(uSmokeOpacity, this.smokeOpacity);
      gl.uniform1i(uRenderPass, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, state.count);
    }

    {
      // Pass 2: Flame — direct additive draw (same pipeline as legacy mode)
      gl.uniform1f(uSmokeThreshold, this.smokeThreshold);
      gl.uniform1f(uSmokeOpacity, this.smokeOpacity);
      gl.uniform1i(uRenderPass, this.smokeThreshold > 0 ? 1 : 2);
      gl.enable(gl.BLEND);
      if (config.blendMode === 'alpha') {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.blendFunc(gl.ONE, gl.ONE);
      }
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, state.count);
      gl.bindVertexArray(null);
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.renderMode === 'volume' && this.volumeAccumTex && this.gl) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.volumeAccumTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    if (this.renderMode === 'liquid' && this.liquidTex && this.gl) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);
      // ⚠️ **v8 Step 15.2: the colour target is resized in the SAME branch, and a miss here is silent.** The
      // two are attachments of one FBO, so a size disagreement makes it INCOMPLETE — after which every draw
      // sets `INVALID_FRAMEBUFFER_OPERATION`, the field stays at its clear value, and the surface vanishes
      // for the rest of the session on a mere window resize. Invariant 5's failure mode, reached without any
      // init path running (`checkFramebufferStatus` is not re-tested here, so nothing would report it).
      if (this.liquidColorTex) {
        gl.bindTexture(gl.TEXTURE_2D, this.liquidColorTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      }
      gl.bindTexture(gl.TEXTURE_2D, null);
      // No `uIsoRef` bookkeeping is needed on resize, and that is a PROPERTY rather than an oversight: the
      // threshold is recomputed every frame from `W·H` and the clamped radius, so it tracks the new canvas
      // by construction. A cached absolute threshold is exactly what would have made the surface vanish on
      // a fullscreen toggle.
      //
      // ⚠️ **The SMOOTHED reference is a different matter and must be dropped here** (v8 15.1b): a resize
      // changes `scaleFactor`, hence `R`, hence BOTH terms of the reference, and it changes the pixel
      // spacing of the projected curve as well. Gliding across it makes a fullscreen toggle dissolve and
      // re-form the surface over a quarter-second. A KNOWN EVENT, exactly as 14.7b's band reset is — never
      // a magnitude threshold, which cannot separate a resize from fast motion.
      this.resetLiquidReference();
    }
    // A third branch reallocated a half-res `flameAccumTex` here; deleted 2026-08-10 with the rest of
    // the dead flame-accumulation pipeline (triage G2/G3). Note the two surviving branches gate on
    // `renderMode` as well as on the texture handle, which the flame one did NOT — it reallocated in
    // every render mode, since the handle outlived any mode switch that did not go through `dispose()`.
  }

  isAdditiveBlend(): boolean {
    return this.renderMode === 'blend';
  }

  /**
   * The mode actually in force, which is not always the mode that was requested.
   *
   * `initVolume` and `initLiquid` both fall back to `'star'` when `EXT_color_buffer_float` is missing.
   * That fallback is correct by ADR 010 (warn and continue rather than fail), but it happens INSIDE the
   * renderer, so `main.ts`'s `currentRenderMode` — which is what the Visual FX dropdown displays — kept
   * showing the mode the user picked while something else was being drawn (R10). Callers should re-read
   * this after `init()` and reconcile.
   */
  getActiveRenderMode(): RenderMode {
    return this.renderMode;
  }

  setFilmLook(params: {
    glow?: number;
    depthSize?: number;
    depthBrightness?: number;
    depthDof?: number;
    depthColorShift?: number;
    lightingMode?: number;
    lightDir?: [number, number, number];
    rimPower?: number;
    palette?: string;
    paletteMapping?: number;
  }): void {
    if (params.glow !== undefined) this.glow = params.glow;
    if (params.depthSize !== undefined) this.depthSize = params.depthSize;
    if (params.depthBrightness !== undefined) this.depthBrightness = params.depthBrightness;
    if (params.depthDof !== undefined) this.depthDof = params.depthDof;
    if (params.depthColorShift !== undefined) this.depthColorShift = params.depthColorShift;
    if (params.lightingMode !== undefined) this.lightingMode = params.lightingMode;
    if (params.lightDir !== undefined) this.lightDir = params.lightDir;
    if (params.rimPower !== undefined) this.rimPower = params.rimPower;
    if (params.palette !== undefined) this.setPalette(params.palette);
    if (params.paletteMapping !== undefined) this.paletteMapping = params.paletteMapping;
  }

  /**
   * v8 Step 21.4a — the SECOND of the two guards that keep the `index` mapping out of the shader.
   *
   * ⚠️ **Independent of the first on purpose.** `palette-selection.ts` hands this renderer `'none'` in the
   * same breath as a negative mapping int, so `paletteEnabled` is already false by the time this is read —
   * but the two travel through different setters (`setPalette` and a bare field assignment) and nothing
   * between them is compiled against the other. If either ever arrives alone, the fragment shader's mapping
   * chain ends in `else { palCoord = vVelocity; }` and an unmatched int silently selects the VELOCITY
   * mapping, overwriting the CPU's per-particle colour with a different picture that looks entirely
   * plausible. So the negative int also disables the palette here, on its own authority.
   */
  private paletteLutActive(): boolean {
    return this.paletteEnabled && this.paletteMapping >= 0;
  }

  /**
   * The global particle size multiplier (`overlay.particleSize`).
   *
   * ⚠️ **The RANGE clamp lives at the caller** (`main.ts`'s `setParticleSize`, sharing
   * `PARTICLE_SIZE_MIN`/`MAX` with the slider — see the `SPEED_MIN` note in `visual-fx.ts` for why the two
   * numbers must be one constant). This method guards only FINITENESS, because a non-finite multiplier
   * reaches `gl_PointSize` and an out-of-range one merely looks wrong: a NaN uniform is the shape
   * invariant 21 records as reading `nan == total`, i.e. indistinguishable from a whole bad field.
   *
   * Not part of `Renderer` — `core/interfaces.ts` declares none of this class's config setters, and
   * `main.ts` holds the concrete type.
   */
  /**
   * 27.6 — pick the splat shear convention. `fixed` gives the flat-nib look, the default gives constant
   * apparent width. Takes a boolean rather than the `'tangent' | 'fixed'` union so the renderer carries no
   * preset vocabulary; `main.ts` owns the mapping, as it does for every other overlay field.
   */
  /**
   * v8 28.5 (`28.D3`) — hide the first `n` particles, i.e. the curve block, leaving sparks, the liquid
   * pool and the crystals drawing.
   *
   * ⚠️ **`main.ts` owns the DECISION and passes 0 when the figure is shown or the dye is not drawing**
   * (`28.D11` — the engine forces the figure back on rather than trusting the preset, so a hidden figure
   * with no dye cannot reach a black frame). This setter only stores it.
   *
   * ⚠️ **It must be re-handed by `reapplyRendererState()`** — the field is a plain number and survives
   * `dispose()`, but a renderer built by `reinitRenderer()` starts at its initialiser, so without the
   * re-hand a render-mode change silently brings the figure back (invariant 2).
   */
  setHideCurve(n: number): void {
    this.hideBelowIndex = Math.max(0, Math.floor(n));
  }

  setSplatShear(fixed: boolean): void {
    this.splatShearFixed = fixed === true;
  }

  setParticleSize(scale: number): void {
    const next = Number.isFinite(scale) && scale > 0 ? scale : 1.0;
    // `particleSize` is a factor of `liquidPointDiameter()`, so it moves `R` and therefore the whole density
    // reference. Same known-event reset as `resize` and a `kernelWidth` change (v8 15.1b).
    if (next !== this.particleSize) this.resetLiquidReference();
    this.particleSize = next;
  }

  /**
   * `sparks.splatRadius` — the radius sparks draw at, or `null` to size them like ordinary particles.
   *
   * ⚠️ **Pass `null` when sparks are DISABLED**, not the authored radius: see the `sparkRadius` field for
   * why the uniform must not describe a population that is not published. `main.ts` calls this from the same
   * places it calls `generator.setSparkConfig`, and `reapplyRendererState` re-hands it after every
   * `reinitRenderer` (invariant 2).
   *
   * Guards finiteness and positivity for the same reason `setParticleSize` does — this value reaches a quad's
   * vertex positions, so a NaN would discard the geometry silently rather than draw something wrong.
   */
  setSparkRadius(radius: number | null): void {
    this.sparkRadius = (radius !== null && Number.isFinite(radius) && radius > 0) ? radius : null;
  }

  /**
   * The size in SCREEN PIXELS the current settings actually produce, for the Particle Size readout.
   *
   * ⚠️ **This is a TRANSCRIPTION of the four vertex shaders' size arithmetic and must be kept in step with
   * them.** That duplication is deliberate and is the lesser of two evils: the alternative is a
   * `readPixels`-based measurement of a quantity that only exists inside the vertex stage, and a UI readout
   * cannot afford a pipeline flush per frame. It lives HERE, next to the shaders, rather than in the tab —
   * which is the invariant-17 half that does matter, since the tab cannot see mode, canvas, material and the
   * hardware ceiling at once.
   *
   * At a NEUTRAL pose, deliberately: the depth terms are per-particle (`aDepth`), so there is no single pixel
   * size once Depth Size or Depth DoF is non-zero. The readout is the size of a particle at depth 1.0 — the
   * far plane, where `1.0 - aDepth` is 0 and the depth-size term vanishes — which is the smallest a particle
   * gets and the one value the user can reason about. Stating a mid-depth average would be a number no
   * particle ever has.
   *
   * The splat path is NOT clamped, matching the shader: it draws instanced quads, and
   * `ALIASED_POINT_SIZE_RANGE` is a point-sprite limit.
   *
   * ⚠️⚠️ **v8 `31.2`: IT REPORTS THE PER-PARTICLE SIZE CHANNEL'S *MINIMUM*, AND THAT FOLLOWS THIS METHOD'S
   * OWN EXISTING RULE RATHER THAN `31.D11`'s.** The channel makes the size per-particle, exactly as `aDepth`
   * already does — so there is no single pixel size once it is on, and the paragraph above has already
   * settled what to print in that situation: the SMALLEST a particle gets, *the one value the user can
   * reason about*, because a mean would be a number no particle ever has.
   *
   * ⚠️ **`31.D11` SAID THE PERF GUARD WOULD GO BLIND OTHERWISE, AND THAT PREMISE IS FALSE — recorded rather
   * than implemented around.** `exploration/perf-guard.ts` contains neither `particleSize` nor `pixel`: it
   * measures FRAME TIME, and the only consumer of this method is the Particle Size row's readout
   * (`getParticlePixelEstimate`, one call site). **So the obligation is a readout obligation, and the
   * decision's reasoning does not survive re-derivation even though its instruction does.**
   *
   * ⚠️ **Describes a WAVE PARTICLE. Since 2026-08-29 a spark is a second population at its own size**
   * (`sparks.splatRadius`, typically 2–4 against a material's 7–24), so on a sparks-enabled preset there are
   * two sizes on screen and this reports the majority one. **Do not "fix" that by blending them**: the
   * readout sits under the global Particle Size slider and answers "how big is the figure's particle", the
   * spark size has its own slider and its own readout in the Materials tab, and a weighted mean would be a
   * number neither population ever has — the same reason this method reports depth 1.0 rather than a
   * mid-depth average.
   */
  estimateParticlePixels(): number {
    const scaleFactor = (this.width + this.height) / (1024.0 + 768.0);
    const materialActive = !!this.materialConfig && this.materialConfig.preset !== 'None';

    if (this.renderMode === 'volume') {
      // Volume's radius is `splatRadius * 1.5`, CPU-clamped to maxPointSize before the shader sees it, with a
      // hardcoded 16.0 when no material is running — the largest base size in the engine, and the case that
      // prompted this control.
      const splatRadius = this.materialConfig ? this.materialConfig.splatRadius : 16.0;
      const radius = Math.min(splatRadius * 1.5, this.maxPointSize);
      return Math.min(radius * scaleFactor * this.particleSize * this.channelSizeMin, this.maxPointSize);
    }

    // `render()` falls THROUGH to the point path at the star size when splat mode has no material config —
    // so a splat estimate is only honest while one is live.
    if (this.renderMode === 'splat' && this.splatProgram && this.splatVao && materialActive) {
      const clampedRadius = Math.min(this.materialConfig!.splatRadius, this.maxPointSize);
      // The flame/width shaping (`sizeMultiplier`, `widthBoost`) is temperature- and velocity-dependent and so
      // has no single value; this is the un-shaped quad width, which is what `uSplatRadius` names.
      return clampedRadius * scaleFactor * this.particleSize * this.channelSizeMin;
    }

    // v8 Step 15.1. ⚠️ **DELEGATED, not transcribed.** This method is a hand copy of the vertex shaders'
    // size arithmetic and a fourth copy of the liquid clamp is precisely what would desync `uIsoRef` from
    // the drawn sprite; `liquidPointDiameter()` is the single owner, and both the readout and the
    // normalisation read it. Note the liquid sprite carries Kernel Width as well as `particleSize`, so the
    // reported pixel size legitimately moves with a control the other modes do not have.
    if (this.renderMode === 'liquid') {
      return this.liquidPointDiameter();
    }

    const baseSize = this.renderMode === 'pixel' || this.renderMode === 'blend' ? 3.0 : 5.0;
    // ⚠️ The channel multiplies AFTER the `max(baseSize, …)` floor and BEFORE the clamp, which is the
    // order the vertex shader uses (`size *= aChannels.x` sits above `clamp(size, 1.0, uMaxPointSize)`).
    // Applying it inside the `max` would make the floor per-particle, which the shader's is not.
    const size = Math.max(baseSize, baseSize * scaleFactor) * this.particleSize * this.channelSizeMin;
    return Math.min(Math.max(size, 1.0), this.maxPointSize);
  }

  /**
   * v8 `26.4` — the palette hue rotation, in TURNS, uploaded to BOTH programs that sample the LUT.
   *
   * ⚠️ **NOT CLAMPED HERE.** The range is the `Warmth` row's to own (`[-0.5, 0.5]` = ±180°), and the
   * shader's `fract()` makes anything outside it wrap rather than break — so clamping here would
   * silently disagree with a Mixer blend that lerped two shifts, or with an imported preset.
   */
  setPaletteHueShift(turns: number): void {
    this.paletteHueShift = Number.isFinite(turns) ? turns : 0;
  }

  setPalette(name: string): void {
    const gl = this.gl;
    if (!gl) return;

    if (name === 'none' || name === '') {
      this.paletteEnabled = false;
      return;
    }

    const lut = getPaletteLUT(name);
    if (!lut) {
      this.paletteEnabled = false;
      return;
    }

    if (!this.paletteTexture) {
      this.paletteTexture = gl.createTexture();
    }

    gl.bindTexture(gl.TEXTURE_2D, this.paletteTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.paletteEnabled = true;
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.posBuffer) gl.deleteBuffer(this.posBuffer);
    if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer);
    if (this.depthBuffer) gl.deleteBuffer(this.depthBuffer);
    if (this.velocityBuffer) gl.deleteBuffer(this.velocityBuffer);
    if (this.pointTempBuffer) gl.deleteBuffer(this.pointTempBuffer);
    if (this.pointAgeBuffer) gl.deleteBuffer(this.pointAgeBuffer);
    if (this.channelsBuffer) gl.deleteBuffer(this.channelsBuffer);   // v8 31.2
    if (this.paletteTexture) gl.deleteTexture(this.paletteTexture);
    this.paletteTexture = null;
    // ⚠️ The FLAG must die with the TEXTURE. `uPaletteEnabled` is set from `paletteEnabled` alone, while
    // the unit-1 bind is gated on `paletteEnabled && paletteTexture` — so leaving the flag true after
    // deleting the texture makes the shader take its palette branch and sample a sampler that was never
    // assigned a unit. An unassigned `sampler2D` defaults to unit 0, and nothing is bound there either on
    // the point path, so `texture()` returns BLACK and every particle is recoloured to black: an
    // invisible figure, in every render mode, for any preset with a palette film look. `main.ts` now
    // re-applies the film look after each dispose+init, which rebuilds the texture — but the renderer
    // must not depend on the caller to keep its own two halves consistent.
    this.paletteEnabled = false;
    if (this.fallbackBlackTex) gl.deleteTexture(this.fallbackBlackTex);
    this.fallbackBlackTex = null;
    // v8 Step 15.1 liquid resources. ⚠️ Every handle deleted here is also NULLED (invariant 1) — `init()`
    // only reassigns them when `config.mode === 'liquid'`, so a dispose()+init() into any other mode would
    // otherwise leave `render()`'s handle guard satisfied by deleted objects.
    //
    // ⚠️ `liquidRampUploaded` is nulled too, and that pairing is load-bearing: it is a CACHE KEY for a
    // texture that no longer exists, so leaving it set would make `syncLiquidRamp()` return early after the
    // next init and the surface would sample whatever the newly created texture happened to be seeded with.
    // `liquidConfig` is deliberately NOT reset — it is authored state, not a GL resource.
    if (this.liquidFBO) gl.deleteFramebuffer(this.liquidFBO);
    if (this.liquidTex) gl.deleteTexture(this.liquidTex);
    if (this.liquidColorTex) gl.deleteTexture(this.liquidColorTex);
    if (this.liquidAccumProgram) gl.deleteProgram(this.liquidAccumProgram);
    if (this.liquidSurfaceProgram) gl.deleteProgram(this.liquidSurfaceProgram);
    if (this.liquidQuadBuffer) gl.deleteBuffer(this.liquidQuadBuffer);
    if (this.liquidSurfaceVao) gl.deleteVertexArray(this.liquidSurfaceVao);
    if (this.liquidRampTex) gl.deleteTexture(this.liquidRampTex);
    this.liquidFBO = null; this.liquidTex = null; this.liquidColorTex = null;
    this.liquidAccumProgram = null; this.liquidSurfaceProgram = null;
    this.liquidQuadBuffer = null; this.liquidSurfaceVao = null;
    this.liquidRampTex = null; this.liquidRampUploaded = null;
    this.uLiquidAccResolution = null; this.uLiquidAccSize = null; this.uLiquidAccMaxPointSize = null;
    this.uLiquidSurfDensity = null; this.uLiquidSurfRamp = null; this.uLiquidSurfPalette = null;
    this.uLiquidSurfIsoRef = null; this.uLiquidSurfSoftness = null; this.uLiquidSurfTintSource = null;
    this.uPaletteHueShift = null; this.uLiquidSurfPaletteHueShift = null;
    this.uLiquidSurfPaletteEnabled = null; this.uLiquidSurfResolution = null; this.uLiquidSurfTint = null;
    // `uLiquidSurfThickRef` was MISSING from this list until 15.2 (15.1b added the uniform and not its null).
    // Harmless in practice — every location is re-looked-up in `initLiquid` — but invariant 1 is stated over
    // the whole set precisely so "harmless in practice" is not a judgement anyone has to make per handle.
    this.uLiquidSurfThickRef = null;
    this.uLiquidSurfColor = null; this.uLiquidSurfColourMix = null; this.uLiquidSurfMixModel = null;
    this.uLiquidSurfRefraction = null; this.uLiquidSurfSpecular = null; this.uLiquidSurfThickness = null;
    this.uLiquidSurfEdgeBright = null; this.uLiquidSurfRadius = null;
    // v8 Step 15.7. ⚠️ **`uLiquidSurfDye` is nulled; `dyeTexture` is nulled WITHOUT being deleted.** The
    // texture is `DyeFieldProcessor`'s, borrowed through `setDyeTexture` — deleting it here would leave the
    // owner's own non-null field naming a freed object, every subsequent dye pass a silent no-op, and the
    // cause one file away from the symptom. Nulling the reference is still required: `render()` tests it to
    // decide the `'dye'` → `'ramp'` degrade, and `reapplyRendererState()` re-hands it after an init
    // (invariant 2 — the re-handing has ONE owner and it is not this method).
    this.uLiquidSurfDye = null; this.uLiquidSurfDyeSatK = null; this.dyeTexture = null;
    // Volume resources
    if (this.volumeAccumFBO) gl.deleteFramebuffer(this.volumeAccumFBO);
    if (this.volumeAccumTex) gl.deleteTexture(this.volumeAccumTex);
    if (this.volumeAccumProgram) gl.deleteProgram(this.volumeAccumProgram);
    if (this.volumeResolveProgram) gl.deleteProgram(this.volumeResolveProgram);
    if (this.volumeAccumVao) {
      if (this.volumeAccumPosBuffer) gl.deleteBuffer(this.volumeAccumPosBuffer);
      if (this.volumeAccumTempBuffer) gl.deleteBuffer(this.volumeAccumTempBuffer);
      if (this.volumeAccumDepthBuffer) gl.deleteBuffer(this.volumeAccumDepthBuffer);
      if (this.volumeAccumColorBuffer) gl.deleteBuffer(this.volumeAccumColorBuffer);
      gl.deleteVertexArray(this.volumeAccumVao);
    }
    if (this.volumeResolveVao) {
      if (this.volumeResolveQuadBuffer) gl.deleteBuffer(this.volumeResolveQuadBuffer);
      gl.deleteVertexArray(this.volumeResolveVao);
    }
    this.volumeAccumPosBuffer = null; this.volumeAccumTempBuffer = null;
    this.volumeAccumDepthBuffer = null; this.volumeAccumColorBuffer = null;
    this.volumeResolveQuadBuffer = null;
    this.volumeAccumFBO = null; this.volumeAccumTex = null;
    this.volumeAccumProgram = null; this.volumeResolveProgram = null;
    this.volumeAccumVao = null; this.volumeResolveVao = null;
    // Splat resources
    if (this.splatProgram) gl.deleteProgram(this.splatProgram);
    if (this.splatVao) {
      // ⚠️ ALL NINE of initSplat()'s buffers, and this list must stay complete: dispose()+init() runs on
      // every render mode, film look and TransMap change, so a buffer left behind leaks on each one.
      //
      // The three B14 buffers — splatVel, splatCol, splatAge — were MISSING here until 2026-08-12 (triage
      // I2). They were reachable only as `(this.splatVao as any).__splatVelBuffer` etc., so the release
      // list could not be checked against the allocation list by eye; typing the nine handles as fields
      // is what surfaced the omission.
      const splatBuffers = [
        this.splatPosBuffer, this.splatDepthBuffer, this.splatQuadBuffer, this.splatVelDirBuffer,
        this.splatVelBuffer, this.splatColBuffer, this.splatAgeBuffer, this.splatChannelsBuffer,
        this.splatFrozenBuffer, this.splatGrowthBuffer,
      ];
      for (const b of splatBuffers) if (b) gl.deleteBuffer(b);
      gl.deleteVertexArray(this.splatVao);
    }
    this.splatPosBuffer = null; this.splatDepthBuffer = null; this.splatQuadBuffer = null;
    this.splatVelDirBuffer = null; this.splatVelBuffer = null; this.splatColBuffer = null;
    this.splatAgeBuffer = null; this.splatFrozenBuffer = null; this.splatGrowthBuffer = null;
    this.splatChannelsBuffer = null;   // v8 31.2 — invariant 1: null every deleted handle
    if (this.temperatureBuffer) gl.deleteBuffer(this.temperatureBuffer);
    if (this.rampTexture) gl.deleteTexture(this.rampTexture);
    if (this.smokeRampTexture) gl.deleteTexture(this.smokeRampTexture);
    if (this.crystalRampTexture) gl.deleteTexture(this.crystalRampTexture);
    this.crystalRampTexture = null;
    this.splatProgram = null; this.splatVao = null;
    this.temperatureBuffer = null; this.rampTexture = null; this.smokeRampTexture = null;
    this.pointTempBuffer = null; this.pointTempZeros = new Float32Array(0);
    this.pointAgeBuffer = null; this.pointAgeSynth = new Float32Array(0);
    // v8 31.2 — invariant 1: null every deleted handle, and drop the pad with the buffer it fed.
    this.channelsBuffer = null; this.channelPad = new Float32Array(0); this.channelSizeMin = 1;
    this.solidPos2d = new Float32Array(0);
    this.splatPos2d = new Float32Array(0);
    this.splatAgePad = new Float32Array(0);
    this.materialConfig = null;
    // Back to the neutral "size sparks like everything else". Unlike `particleSize` this one IS reset, and the
    // asymmetry is deliberate: `null` here is the pre-feature behaviour, so a renderer re-initialised without
    // its spark config being re-handed draws the ORIGINAL sizes rather than a stale radius from the previous
    // preset. `reapplyRendererState` re-hands it immediately (invariant 2), so the reset is never observable
    // in a working flow — it is the failure mode that differs.
    this.sparkRadius = null;
  }
}
