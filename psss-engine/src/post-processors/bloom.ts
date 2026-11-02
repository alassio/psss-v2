import { compileProgram } from '../core/gl-program.ts';

export interface BloomConfig {
  enabled: boolean;
  threshold: number;
  intensity: number;
  radius: number;
  levels: number;
}

export class BloomProcessor {
  private gl: WebGL2RenderingContext | null = null;
  private width = 0;
  private height = 0;
  private enabled = false;
  private threshold = 0.8;
  private intensity = 0.3;
  private levels = 5;

  private brightPassProgram: WebGLProgram | null = null;
  private downsampleProgram: WebGLProgram | null = null;
  private upsampleProgram: WebGLProgram | null = null;
  private compositeProgram: WebGLProgram | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;

  private mipTextures: WebGLTexture[] = [];

  /**
   * v8 `32.8` (`E127`) — **the pyramid, readable by the warp.** Three NAMED levels out of the five, so a
   * caller cannot depend on `levels` being 5.
   *
   * ⚠️ **RETURNS `null` RATHER THAN THROWING OR PICKING A NEIGHBOUR when the level is absent**, which is
   * the normal state in two cases the caller must handle: before the first `resize()` (`mipTextures` is
   * empty and `apply()` already returns early on it), and while bloom is DISABLED. The caller binds a 1×1
   * fallback — invariant 4, and invariant 3's flag-dies-with-its-resource, because a true "read the blur"
   * flag over an absent texture blacks a whole multi-sampler draw rather than just dropping one term.
   *
   * ⚠️ **The mips are reallocated on a resize, so a caller must NOT cache the handle across one** — the
   * same rule as the Reel's capture being dropped on a size change. Call this per frame; it is a bounds
   * check and an array read.
   */
  /*
   * ⚠ **v8 `32.8` ADDED `blurTexture()` AND `blurFootprint()` HERE AND `32.12` REMOVED THEM** when the
   * owner cut the blur refraction sources on visual review. The pyramid is private again, which is the
   * state the study described as *"your bloom is a fixed stage that nothing upstream can sample"*.
   * **If it is ever exposed again, the two facts worth carrying over are that the chain starts at HALF
   * resolution (so a footprint compensation is needed) and that it is built in stage 8, AFTER the warp
   * that would read it — so a reader gets the PREVIOUS frame.**
   */
  private mipFBOs: WebGLFramebuffer[] = [];
  private mipWidths: number[] = [];
  private mipHeights: number[] = [];

  // Uniform locations, resolved once in `init()`. `apply()` used to query all ten of these on every
  // frame — and two of them TWICE PER MIP LEVEL, inside the downsample and upsample loops, so the
  // per-frame count scaled with `levels` (5 by default → 20 of the 24 total queries). A location is a
  // property of the linked program and cannot change while the program lives, so re-querying it is
  // pure overhead; each call is also a string lookup across the JS/driver boundary, which is exactly
  // the kind of work that does not show up in a GPU profile.
  private uBrightScene: WebGLUniformLocation | null = null;
  private uBrightThreshold: WebGLUniformLocation | null = null;
  private uDownSrc: WebGLUniformLocation | null = null;
  private uDownSrcSize: WebGLUniformLocation | null = null;
  private uUpSrc: WebGLUniformLocation | null = null;
  private uUpSrcSize: WebGLUniformLocation | null = null;
  private uCompScene: WebGLUniformLocation | null = null;
  private uCompBloom: WebGLUniformLocation | null = null;
  private uCompIntensity: WebGLUniformLocation | null = null;

  init(gl: WebGL2RenderingContext, config: BloomConfig): void {
    this.gl = gl;
    this.enabled = config.enabled;
    this.threshold = config.threshold;
    this.intensity = config.intensity;
    this.levels = config.levels;

    if (!config.enabled) return;

    this.brightPassProgram = compileProgram(gl, QUAD_VERT, BRIGHT_PASS_FRAG, 'Bloom bright pass');
    this.downsampleProgram = compileProgram(gl, QUAD_VERT, DOWNSAMPLE_FRAG, 'Bloom downsample');
    this.upsampleProgram = compileProgram(gl, QUAD_VERT, UPSAMPLE_FRAG, 'Bloom upsample');
    this.compositeProgram = compileProgram(gl, QUAD_VERT, COMPOSITE_FRAG, 'Bloom composite');
    this.quadVao = this.createQuad(gl);

    this.uBrightScene = gl.getUniformLocation(this.brightPassProgram, 'uScene');
    this.uBrightThreshold = gl.getUniformLocation(this.brightPassProgram, 'uThreshold');
    this.uDownSrc = gl.getUniformLocation(this.downsampleProgram, 'uSrc');
    this.uDownSrcSize = gl.getUniformLocation(this.downsampleProgram, 'uSrcSize');
    this.uUpSrc = gl.getUniformLocation(this.upsampleProgram, 'uSrc');
    this.uUpSrcSize = gl.getUniformLocation(this.upsampleProgram, 'uSrcSize');
    this.uCompScene = gl.getUniformLocation(this.compositeProgram, 'uScene');
    this.uCompBloom = gl.getUniformLocation(this.compositeProgram, 'uBloom');
    this.uCompIntensity = gl.getUniformLocation(this.compositeProgram, 'uIntensity');
  }

  /**
   * ⚠️ `init()` does NOT build the mip chain — `resize()` is what calls `rebuildMips()`, so an
   * `init()` without a following `resize()` leaves `mipTextures` empty and `apply()` silently returns
   * without drawing anything (triage I14). That is a real trap rather than a theoretical one: bloom is
   * re-created by dispose+init on every film-look change, and all four such sites in `main.ts`
   * (`:171`, `:838`, `:894`) do pair the two calls — but nothing in the type system says they must, and
   * the failure mode is "bloom quietly stopped working", with no exception and no GL error.
   *
   * The two are deliberately kept separate because they have different lifetimes: programs survive a
   * canvas resize, the mip pyramid does not. `resize()` is therefore also the canvas-resize hook
   * (`main.ts:1976`), so folding the mip build into `init()` would not remove the need for it.
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (!this.enabled) return;
    this.rebuildMips();
  }

  apply(sceneTex: WebGLTexture, outputFBO: WebGLFramebuffer | null): void {
    const gl = this.gl;
    if (!gl || !this.enabled || this.mipTextures.length === 0) return;

    // Step 1: Bright pass — extract luminance > threshold into mip[0]
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.mipFBOs[0]!);
    gl.viewport(0, 0, this.mipWidths[0]!, this.mipHeights[0]!);
    gl.disable(gl.BLEND);
    gl.useProgram(this.brightPassProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(this.uBrightScene, 0);
    gl.uniform1f(this.uBrightThreshold, this.threshold);
    this.drawQuad();

    // Step 2: Progressive downsample
    gl.useProgram(this.downsampleProgram);
    for (let i = 1; i < this.levels; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.mipFBOs[i]!);
      gl.viewport(0, 0, this.mipWidths[i]!, this.mipHeights[i]!);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.mipTextures[i - 1]!);
      gl.uniform1i(this.uDownSrc, 0);
      gl.uniform2f(this.uDownSrcSize, this.mipWidths[i - 1]!, this.mipHeights[i - 1]!);
      this.drawQuad();
    }

    // Step 3: Progressive upsample with additive accumulation
    gl.useProgram(this.upsampleProgram);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.levels - 2; i >= 0; i--) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.mipFBOs[i]!);
      gl.viewport(0, 0, this.mipWidths[i]!, this.mipHeights[i]!);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.mipTextures[i + 1]!);
      gl.uniform1i(this.uUpSrc, 0);
      gl.uniform2f(this.uUpSrcSize, this.mipWidths[i + 1]!, this.mipHeights[i + 1]!);
      this.drawQuad();
    }
    gl.disable(gl.BLEND);

    // Step 4: Composite — scene + bloom * intensity → output
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.compositeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(this.uCompScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.mipTextures[0]!);
    gl.uniform1i(this.uCompBloom, 1);
    gl.uniform1f(this.uCompIntensity, this.intensity);
    this.drawQuad();

    // Restore unit 0 — `activeTexture` is global GL state and this method leaves it on unit 1.
    // Defensive, not a fix: every current consumer downstream (`toneMap.apply`, and both blit paths in
    // `main.ts`) selects its own unit before binding, so nothing reads the leak today. It is the same
    // rule `blendcheck` enforces on `hdr-particle.ts`, and the reason it exists there is that the
    // obligation is invisible at the call site — a future pass that binds without selecting a unit
    // would write into unit 1 and sample black, with no GL error.
    gl.activeTexture(gl.TEXTURE0);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setParams(threshold: number, intensity: number): void {
    this.threshold = threshold;
    this.intensity = intensity;
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const tex of this.mipTextures) gl.deleteTexture(tex);
    for (const fbo of this.mipFBOs) gl.deleteFramebuffer(fbo);
    if (this.brightPassProgram) gl.deleteProgram(this.brightPassProgram);
    if (this.downsampleProgram) gl.deleteProgram(this.downsampleProgram);
    if (this.upsampleProgram) gl.deleteProgram(this.upsampleProgram);
    if (this.compositeProgram) gl.deleteProgram(this.compositeProgram);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
    this.mipTextures = [];
    this.mipFBOs = [];
  }

  private rebuildMips(): void {
    const gl = this.gl!;
    for (const tex of this.mipTextures) gl.deleteTexture(tex);
    for (const fbo of this.mipFBOs) gl.deleteFramebuffer(fbo);
    this.mipTextures = [];
    this.mipFBOs = [];
    this.mipWidths = [];
    this.mipHeights = [];

    let w = Math.floor(this.width / 2);
    let h = Math.floor(this.height / 2);

    for (let i = 0; i < this.levels; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

      this.mipTextures.push(tex);
      this.mipFBOs.push(fbo);
      this.mipWidths.push(w);
      this.mipHeights.push(h);

      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private drawQuad(): void {
    const gl = this.gl!;
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private createQuad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

}

const QUAD_VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const BRIGHT_PASS_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform float uThreshold;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec4 c = texture(uScene, vUv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float contribution = max(0.0, lum - uThreshold) / max(lum, 0.001);
  fragColor = vec4(c.rgb * contribution, 1.0);
}`;

// 13-tap bilinear downsample (approximates Karis average on first pass)
const DOWNSAMPLE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSrcSize;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec2 texel = 1.0 / uSrcSize;
  vec4 sum = vec4(0.0);
  sum += texture(uSrc, vUv) * 0.25;
  sum += texture(uSrc, vUv + vec2(-texel.x, -texel.y)) * 0.0625;
  sum += texture(uSrc, vUv + vec2( texel.x, -texel.y)) * 0.0625;
  sum += texture(uSrc, vUv + vec2(-texel.x,  texel.y)) * 0.0625;
  sum += texture(uSrc, vUv + vec2( texel.x,  texel.y)) * 0.0625;
  sum += texture(uSrc, vUv + vec2(-texel.x, 0.0)) * 0.125;
  sum += texture(uSrc, vUv + vec2( texel.x, 0.0)) * 0.125;
  sum += texture(uSrc, vUv + vec2(0.0, -texel.y)) * 0.125;
  sum += texture(uSrc, vUv + vec2(0.0,  texel.y)) * 0.125;
  fragColor = sum;
}`;

// 3x3 tent filter upsample
const UPSAMPLE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSrcSize;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec2 texel = 1.0 / uSrcSize;
  vec4 sum = vec4(0.0);
  sum += texture(uSrc, vUv + vec2(-texel.x, -texel.y)) * (1.0/16.0);
  sum += texture(uSrc, vUv + vec2(0.0, -texel.y))      * (2.0/16.0);
  sum += texture(uSrc, vUv + vec2( texel.x, -texel.y)) * (1.0/16.0);
  sum += texture(uSrc, vUv + vec2(-texel.x, 0.0))      * (2.0/16.0);
  sum += texture(uSrc, vUv)                             * (4.0/16.0);
  sum += texture(uSrc, vUv + vec2( texel.x, 0.0))      * (2.0/16.0);
  sum += texture(uSrc, vUv + vec2(-texel.x,  texel.y)) * (1.0/16.0);
  sum += texture(uSrc, vUv + vec2(0.0,  texel.y))      * (2.0/16.0);
  sum += texture(uSrc, vUv + vec2( texel.x,  texel.y)) * (1.0/16.0);
  fragColor = sum;
}`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uIntensity;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  fragColor = vec4(scene + bloom * uIntensity, 1.0);
}`;
