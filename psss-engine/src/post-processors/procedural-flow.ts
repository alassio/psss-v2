import { compileProgram } from '../core/gl-program.ts';
import { GLSL_SIMPLEX3D_CURL2D } from '../core/glsl-noise.ts';
import type { ProceduralFlowConfig } from '../presets/types.ts';

/**
 * TransMap style 5 — Procedural Flow. Renders a full-resolution RG displacement field that the warp shader
 * consumes as a UV offset (`trans-map.ts`: `texture(uFlowField, vUv).rg`).
 *
 * ## ASPECT — why the shader works in `q` and not in `vUv` (fixed 2026-08-28)
 *
 * ⚠️ **`vUv` spans [0,1] on BOTH axes whatever the canvas shape, so it is NOT an isotropic space**: one unit
 * of `vUv.x` is `w` pixels while one unit of `vUv.y` is `h`. Two consequences, both measured, both silent:
 *
 * - Sampling noise at `vUv * uScale` stretched every cell by exactly the canvas aspect. At `uScale` 3, cells
 *   were 320×345 px at 960×1036 (near-square) but 640×400 at 1920×1200 — a **1.60× horizontal stretch across
 *   the preview → fullscreen toggle**, and 2.37× at 2560×1080.
 * - The "radial" term's screen-space **magnitude** varied with direction: at 1920×1200 a point on the
 *   horizontal axis was displaced 192 px against 120 px on the vertical, a **1.60× ratio** (2.37× at
 *   2560×1080, 1.08× even at the near-square 960×1036). So "expand" pushed harder sideways than vertically.
 *
 * ⚠️ **The radial term's DIRECTION was already correct, and asserting otherwise was an invariant-10 error in
 * this very comment.** The first version of it claimed a true 45° screen direction came out at 57.99°; that
 * figure was measured by mapping a screen direction into the shader's `pos` space and reading the angle
 * *there*, ignoring that the UV output divides by `w`/`h` again and cancels the squash exactly. Measured
 * end-to-end, the old code put a 45° input at 45.00° on screen at every canvas shape. **The defect was
 * purely in the magnitude** — which is why "check the units of the RESULT, not the plausibility of the
 * expression" applies to a doc comment exactly as it does to the code it describes.
 *
 * `q = vUv * uResolution / min(w,h)` is pixels over one shared length scale, so its two axes carry the same
 * units. ⚠️ **`min(w,h)` is not a free choice — it is already this subsystem's length scale** (`solveGain`'s
 * target fraction, style 0's `fit`, `vortexOffset`'s `minDim`), so this makes style 5 consistent with its
 * siblings rather than introducing a second convention.
 *
 * ⚠️ **The divide by `aspect` at the END is load-bearing and is NOT the same correction applied twice.** The
 * output is consumed as a UV offset while everything computed in `q` is in units of `min(w,h)`; without that
 * divide an isotropic vector still lands as unequal PIXEL displacement per axis. Correcting the input alone
 * fixes the field's *shape* and leaves its *displacement* stretched — a partial fix, which is the worst
 * outcome to debug because it looks like the fix did not work rather than like a second bug.
 *
 * ⚠️ **At a square canvas `aspect == vec2(1.0)` and all three sites are arithmetic identities**, so the
 * shipped FLOW and DEMO presets are byte-identical at 1:1. Invariant 24's rule applies — correct ONCE per
 * quantity and say where; the three sites are input domain, radial direction and output units, which are
 * three distinct quantities, not one correction repeated.
 *
 * ⚠️ **This was found by INSPECTION while fixing the same defect in styles 0–3** (`static-field.ts` →
 * `buildWave`), not from a report. Nothing had reported it: an anisotropic noise field reads as authored
 * character, so it can only be caught by checking the units, never by looking at the frame.
 */
export class ProceduralFlowGenerator {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private fbo: WebGLFramebuffer | null = null;
  private texture: WebGLTexture | null = null;
  private width = 0;
  private height = 0;

  // Uniform locations, resolved once in `init()` — `render()` queried all six on every frame, and it
  // runs once per frame for the whole of TransMap style 5 (triage H6). Note `resize()` re-creates only
  // the FBO and texture, deliberately leaving the program alone, so these survive it; the program's
  // only other lifecycle point is `dispose()`, after which `render()` early-returns.
  private uTime: WebGLUniformLocation | null = null;
  private uStrength: WebGLUniformLocation | null = null;
  private uScale: WebGLUniformLocation | null = null;
  private uCurlAmount: WebGLUniformLocation | null = null;
  private uDirection: WebGLUniformLocation | null = null;
  private uRadial: WebGLUniformLocation | null = null;
  // ⚠️ Uploaded from `this.width/height`, which `resize()` updates — NOT captured at init. The aspect
  // correction in the shader is a function of the LIVE canvas shape, and a stale value would reintroduce
  // exactly the stretch it exists to remove, silently, on the preview -> fullscreen toggle that reported it.
  private uResolution: WebGLUniformLocation | null = null;

  init(gl: WebGL2RenderingContext, width: number, height: number): void {
    this.gl = gl;
    this.width = width;
    this.height = height;

    this.program = this.createProgram(gl);
    this.vao = this.createQuad(gl);
    this.createFBO(gl, width, height);

    this.uTime = gl.getUniformLocation(this.program, 'uTime');
    this.uStrength = gl.getUniformLocation(this.program, 'uStrength');
    this.uScale = gl.getUniformLocation(this.program, 'uScale');
    this.uCurlAmount = gl.getUniformLocation(this.program, 'uCurlAmount');
    this.uDirection = gl.getUniformLocation(this.program, 'uDirection');
    this.uRadial = gl.getUniformLocation(this.program, 'uRadial');
    this.uResolution = gl.getUniformLocation(this.program, 'uResolution');
  }

  render(time: number, config: ProceduralFlowConfig): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.fbo) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);

    gl.uniform1f(this.uTime, time * config.evolutionSpeed);
    gl.uniform1f(this.uStrength, config.strength);
    gl.uniform1f(this.uScale, config.scale);
    gl.uniform1f(this.uCurlAmount, config.curlAmount);
    gl.uniform2f(this.uDirection, config.direction[0], config.direction[1]);
    gl.uniform1f(this.uRadial, config.radial);
    // Read from the fields `resize()` writes, so the aspect correction tracks the live canvas.
    gl.uniform2f(this.uResolution, this.width, this.height);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  getTexture(): WebGLTexture | null {
    return this.texture;
  }

  resize(width: number, height: number): void {
    if (!this.gl) return;
    this.width = width;
    this.height = height;
    if (this.fbo) {
      this.gl.deleteFramebuffer(this.fbo);
      this.fbo = null;
    }
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
    this.createFBO(this.gl, width, height);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.texture) gl.deleteTexture(this.texture);
    this.program = null;
    this.vao = null;
    this.fbo = null;
    this.texture = null;
    this.gl = null;
    // Invariant 1: a deleted program's uniform locations are dangling handles, and `init()` is what
    // reassigns them. `render()` early-returns on a null program, so these are belt-and-braces — but a
    // location surviving its program is the shape that has cost sittings elsewhere.
    this.uTime = null;
    this.uStrength = null;
    this.uScale = null;
    this.uCurlAmount = null;
    this.uDirection = null;
    this.uRadial = null;
    this.uResolution = null;
  }

  private createFBO(gl: WebGL2RenderingContext, w: number, h: number): void {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private createQuad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program!, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private createProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vert = `#version 300 es
      in vec2 aPos;
      out vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`;

    // Fragment shader with inline simplex3D + curl2D
    const frag = `#version 300 es
      precision highp float;
      uniform float uTime;
      uniform float uStrength;
      uniform float uScale;
      uniform float uCurlAmount;
      uniform vec2 uDirection;
      uniform float uRadial;
      uniform vec2 uResolution;
      in vec2 vUv;
      out vec4 fragDisplacement;

${GLSL_SIMPLEX3D_CURL2D}

      // Everything below works in q, an ISOTROPIC space, never in vUv. Three correction sites, three
      // different quantities: input domain, radial direction, output units. See the ASPECT block in this
      // class's doc comment for the measurements and for why none of the three is redundant.
      void main() {
        float minDim = max(min(uResolution.x, uResolution.y), 1.0);
        vec2 aspect = uResolution / minDim;              // (1,1) when square
        vec2 q = vUv * aspect;                           // pixels / min(w,h): same units on both axes

        vec2 pos = (q - 0.5 * aspect) * 2.0;             // centred, ISOTROPIC (was (vUv - 0.5) * 2.0)
        vec3 noiseCoord = vec3(q * uScale, uTime);

        // Curl component (divergence-free). The gradient is taken w.r.t. the isotropic domain, so the result
        // is an isotropic vector too.
        vec2 curlDisp = curl2D(noiseCoord) * 0.1;

        // Directional component. uDirection is authored as a screen direction, so it is already isotropic.
        vec2 dirDisp = uDirection * 0.1;

        // Radial component (positive = expand, negative = implode)
        vec2 radialDir = length(pos) > 0.001 ? normalize(pos) : vec2(0.0);
        vec2 radialDisp = radialDir * uRadial * 0.1;

        // Blend curl vs directional+radial
        vec2 structured = dirDisp + radialDisp;
        vec2 displacement = mix(structured, curlDisp, uCurlAmount);

        // Apply strength, then convert the isotropic vector to the UV offset the warp expects.
        fragDisplacement = vec4(displacement * uStrength / aspect, 0.0, 1.0);
      }`;

    return compileProgram(gl, vert, frag, 'ProceduralFlow');
  }
}
