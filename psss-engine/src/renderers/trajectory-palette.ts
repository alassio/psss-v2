import { getPaletteLUT } from '../presets/palettes.ts';
import type { PaletteMapping } from './film-looks.ts';

/**
 * CPU-side palette lookup shared by the two TRAJECTORY renderers (ribbon and neon).
 *
 * ## Why this exists
 *
 * `applyFilmLook()` routes `palette`/`paletteMapping` through `renderer.setFilmLook()`, which is
 * `HDRParticleRenderer` only. Ribbon and neon received nothing but `setGlow()`, and their shaders had
 * no palette uniforms at all — so they emitted the preset's own `state.colors` unchanged and the
 * palette was silently ignored.
 *
 * That was invisible in `hybrid` mode, where only `HYBRID_RIBBON_COUNT` (200) particles get ribbons and
 * every other particle still goes through the palette-aware point pass. In `streaks` and `adaptive`
 * EVERY wave particle gets a ribbon, and neon draws every trajectory as a line, so the palette
 * disappeared from essentially the whole image while bloom/tone-map/exposure kept responding — which
 * reads as "the film look is ignored and some default ramp is used". Reported 2026-08-06.
 *
 * ## Why on the CPU rather than in the shaders
 *
 * Both renderers already resolve per-vertex colour on the CPU while building geometry, and both store
 * colour per history sample. A GPU path would need the LUT uploaded as a texture in each renderer plus
 * `depth`/`velocity` plumbed through as new vertex attributes and carried in the ring buffers anyway.
 * Sampling here reuses the existing `r`/`g`/`b` fields and adds no uniforms, no attributes, no texture.
 *
 * The mapping MUST match `hdr-particle.ts`'s fragment shader, or ribbons and points would disagree in
 * `hybrid` mode where both draw parts of the same figure:
 *
 * ```glsl
 * if (uPaletteMapping == 0)      palCoord = vDepth;
 * else if (uPaletteMapping == 1) palCoord = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
 * else                           palCoord = vVelocity;
 * color = texture(uPaletteTex, vec2(palCoord, 0.5)).rgb;
 * ```
 */
export class TrajectoryPalette {
  private lut: Uint8Array | null = null;
  private mapping: PaletteMapping = 'depth';
  /** v8 26.4 — turns. 0 keeps the clamp semantics below byte-identical. */
  private hueShift = 0;

  /**
   * `'none'`/`''`/an unknown name all disable the palette, matching `HDRParticleRenderer.setPalette`.
   *
   * ⚠️ **Under the `index` mapping (`21.4a`) this must be given `'none'`, and `palette-selection.ts`'s
   * `shaderPalette` is the field that guarantees it.** With no LUT, `resolve()` passes the particle's own
   * `r`/`g`/`b` straight through — and those ARE the index mapping's output, because the generator writes it
   * into `state.colors`. So the correct behaviour here is to do nothing, and it is reached by being given
   * nothing. Handing this the resolved palette NAME instead would make ribbons and neon lines sample a LUT
   * the point pass is not sampling: a seam in `hybrid` mode, and a wholly different colour in
   * `streaks`/`adaptive`.
   */
  setPalette(name: string): void {
    this.lut = (name === 'none' || name === '') ? null : getPaletteLUT(name);
  }

  setMapping(mapping: PaletteMapping): void {
    this.mapping = mapping;
  }

  /**
   * v8 `26.4` — the palette hue rotation, in TURNS, mirroring `HDRParticleRenderer.setPaletteHueShift`.
   *
   * ⚠️ **THIS CLASS AND THE POINT SHADER MUST AGREE EXACTLY OR `hybrid` MODE SHOWS A SEAM**, which is the
   * hazard this file's header already documents for the palette NAME and which applies identically to the
   * rotation: ribbons and points are drawn side by side from the same figure, so any mismatch is visible as
   * a line rather than as a wrong colour. The shader branches on `shift == 0.0` to keep the identity
   * byte-exact under `CLAMP_TO_EDGE`; `resolve()` below branches the same way for the same reason.
   */
  setHueShift(turns: number): void {
    this.hueShift = Number.isFinite(turns) ? turns : 0;
  }

  get enabled(): boolean {
    return this.lut !== null;
  }

  /**
   * Resolve one particle's colour, writing into `out` rather than returning a new object: this runs
   * once per sample per particle per frame, so allocating here would be millions of short-lived
   * objects per second.
   *
   * `r`/`g`/`b` are the particle's own colour, needed both as the pass-through when no palette is
   * active and as the `phase` mapping's input.
   */
  resolve(
    out: { r: number; g: number; b: number },
    r: number, g: number, b: number,
    depth: number, velocity: number,
  ): void {
    const lut = this.lut;
    if (!lut) {
      out.r = r; out.g = g; out.b = b;
      return;
    }

    let coord: number;
    if (this.mapping === 'depth') coord = depth;
    else if (this.mapping === 'phase') coord = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    else coord = velocity;

    // The GL texture is CLAMP_TO_EDGE, so clamping the coord reproduces its edge behaviour. Written as
    // `!(coord >= 0)` so NaN lands on 0 — `phase` is derived from colour and cannot be NaN, but
    // `depth`/`velocity` come from the generator.
    if (!(coord >= 0)) coord = 0;
    else if (coord > 1) coord = 1;

    /*
     * v8 `26.4` — the hue rotation, applied AFTER the clamp and only when non-zero.
     *
     * ⚠️ **THE ORDER AND THE GUARD ARE BOTH LOAD-BEARING.** After the clamp, `coord` is in `[0, 1]`, so
     * `coord + shift - floor(...)` wraps over exactly one period and matches the shader's
     * `fract(palCoord + uPaletteHueShift)` term for term. **And zero short-circuits**, because an
     * unconditional wrap would turn the clamped `1` into `0` and so change the top edge on every palette
     * preset that carries no rotation — the identity has to be byte-exact, here and in the shader.
     */
    if (this.hueShift !== 0) {
      const shifted = coord + this.hueShift;
      coord = shifted - Math.floor(shifted);
    }

    // ROUND, not truncate. With LINEAR filtering the shader samples at `coord * 256` in texel space and
    // lands on the nearest texel centre; truncating picks the texel below and is off by one for the
    // upper half of every texel. `Prismatic` moves up to 7/255 per texel, so that showed up as a
    // visible 0.027 channel error against the point pass — which matters because ribbon `hybrid` draws
    // ribbons and points side by side from the same figure and any mismatch is a seam.
    // Nearest-sampling is otherwise indistinguishable from LINEAR at texel centres and avoids
    // interpolating on every sample.
    const i = Math.round(coord * 255) * 4;
    // LUT is RGBA8; these renderers work in 0–1 floats, as `state.colors` already does.
    out.r = lut[i]! / 255;
    out.g = lut[i + 1]! / 255;
    out.b = lut[i + 2]! / 255;
  }
}
