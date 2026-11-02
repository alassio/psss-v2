//------------------------------------------------------------------------------
let gWidth = 1024;
let gHeight = 768;

//var gIntervalID;
var gRequestID;

var gWorld;
var gParSys;
var gCanvas;
var gTransMap;
var gTransMapStyle;
var gTransMapFilter;    // bool
var gTransMapMode;      // bool
var gTargetFps = 60;
var gLastFrameTime = 0;

var gPreset;

var gFxGlow = 2.0;
var gFxDepthSize = 0.0;
var gFxStreaks = 0.0;
var gFxPalette = 'none';
var gFxPaletteMapping = 'depth';
var gFxSpeedCorrection = false;
var gFxSpeedFactor = 1.0;

var gFractalType = 'clifford';
var gFractalParams = [-1.4, 1.6, 1.0, 0.7];
var gFractalBlend = 0.0;
var gFractalLock2D = false; // unused, kept for preset compat

var gViewMode = 'main';
var gActiveTiles = new Map();
var gPreviewObserver = null;
var gPreviewGridInitialized = false;
var gTileInitQueue = [];
var gTileInitTimer = null;

var gLabSnapshots = [];
var gLabLocks = { shape: false, color: false, motion: false, transmap: false };
var gLabDirty = false;
var gLabActiveTab = 'mixer';
var gArchetypeState = { activeArchetype: null, basePreset: null, sliderValues: [], workingPreset: null };
var gEvoState = { generation: 0, tiles: [], selected: [], seedPreset: null, active: false };

//------------------------------------------------------------------------------
const DEG = 180 / Math.PI;
const POINT3D_ZERO = [0, 0, 0];
const ANGLE3D_ZERO = [0, 0, 0];
const DEG2HZ = 180 / Math.PI / 360;
const MAX_WAVE_CNT = 3;
const AXIS_CNT = 3;
const AXIS_NAME = ["X", "Y", "Z"]
const MAX_SIN_MAGIC = 4;

const ParticleRenderMode = {
    rmDraw: 0,
    rmDrawMixMode: 1,
    rmDrawStars: 2
}

const TransMapStyle = {
    tmsWaved: 0,
    tmsWavedZoom: 1,
    tmsWavedZoomOverlay: 2,
    tmsWavedZoomCombined: 3
}

const TransMapMode = {
    tmmApplyBefore: 0,
    tmmApplyAfter: 1
}

function generatePalette(stops) {
    var data = new Uint8Array(1024);
    for (var i = 0; i < 256; i++) {
        var t = i / 255;
        var s0 = stops[0], s1 = stops[stops.length - 1];
        for (var s = 0; s < stops.length - 1; s++) {
            if (t >= stops[s][0] && t <= stops[s + 1][0]) {
                s0 = stops[s];
                s1 = stops[s + 1];
                break;
            }
        }
        var frac = (t - s0[0]) / (s1[0] - s0[0]);
        data[i * 4]     = Math.round(s0[1] + (s1[1] - s0[1]) * frac);
        data[i * 4 + 1] = Math.round(s0[2] + (s1[2] - s0[2]) * frac);
        data[i * 4 + 2] = Math.round(s0[3] + (s1[3] - s0[3]) * frac);
        data[i * 4 + 3] = 255;
    }
    return data;
}

const PALETTES = {
    fire: generatePalette([[0,0,0,0],[0.3,180,0,0],[0.6,255,140,0],[0.85,255,255,0],[1.0,255,255,255]]),
    ocean: generatePalette([[0,0,10,40],[0.4,0,80,120],[0.7,0,180,200],[1.0,200,255,255]]),
    aurora: generatePalette([[0,0,40,0],[0.25,0,180,80],[0.5,0,220,200],[0.75,120,0,200],[1.0,255,100,180]]),
    neon: generatePalette([[0,255,0,150],[0.25,0,50,255],[0.5,0,255,255],[0.75,0,255,50],[1.0,255,255,0]]),
    grayscale: generatePalette([[0,0,0,0],[1.0,255,255,255]]),
    sunset: generatePalette([[0,10,10,60],[0.25,80,0,120],[0.5,200,0,100],[0.75,255,120,0],[1.0,255,210,50]]),
    toxic: generatePalette([[0,0,0,0],[0.3,0,60,0],[0.55,0,180,0],[0.8,100,255,0],[1.0,220,255,220]]),
    thermal: generatePalette([[0,0,0,0],[0.2,0,0,120],[0.4,100,0,160],[0.6,200,0,0],[0.8,255,200,0],[1.0,255,255,255]]),
    cyberpunk: generatePalette([[0,40,0,80],[0.35,200,0,150],[0.65,255,50,200],[0.85,0,220,255],[1.0,240,240,255]]),
    ice: generatePalette([[0,255,255,255],[0.3,180,230,255],[0.55,100,160,210],[0.8,30,60,120],[1.0,5,5,30]]),
    ember: generatePalette([[0,0,0,0],[0.25,60,20,0],[0.5,180,80,0],[0.75,230,170,30],[1.0,255,240,200]]),
    galaxy: generatePalette([[0,15,0,40],[0.25,60,0,120],[0.5,180,0,160],[0.75,0,200,220],[1.0,240,240,255]]),
    candy: generatePalette([[0,255,150,200],[0.25,200,160,255],[0.5,150,200,255],[0.75,150,240,200],[1.0,255,255,180]])
};

//------------------------------------------------------------------------------
class PixelCanvas {
    #visCvs;
    visCtx;
    #bufCvs;
    #bufCtx;
    #buf2Cvs;
    #buf2Ctx;

    ImgData;

    brightness;
    blurradius;

    constructor(aCanvasElement, aWidth, aHeight) {
        this.#visCvs = aCanvasElement;
        this.#visCvs.width = aWidth;
        this.#visCvs.height = aHeight;
        this.visCtx = this.#visCvs.getContext('2d');

        this.#bufCvs = document.createElement('canvas');
        this.#bufCvs.width = aWidth;
        this.#bufCvs.height = aHeight;
        this.#bufCtx = this.#bufCvs.getContext('2d');

        this.#buf2Cvs = document.createElement('canvas');
        this.#buf2Cvs.width = aWidth;
        this.#buf2Cvs.height = aHeight;
        this.#buf2Ctx = this.#buf2Cvs.getContext('2d');

        this.brightness = 0.9999;
        this.blurradius = 4;

        this.width = aWidth;//$(this.#VisCvs).width();
        this.height = aHeight//$(this.#VisCvs).height();

        this.savedWidth = aWidth;
        this.savedHeight = aHeight;

        // ??? necessary
        this.visCtx.fillRect(0, 0, this.#visCvs.width, this.#visCvs.height);
    }

    vis2Data() {
        this.vis2Off();
        this.off2Data();
    }

    off2Data() {
        this.ImgData = this.#bufCtx.getImageData(0, 0, this.width, this.height);
    }

    data2Vis() {
        this.#buf2Ctx.putImageData(this.ImgData, 0, 0);
        this.visCtx.drawImage(this.#buf2Cvs, 0, 0, this.#visCvs.width, this.#visCvs.height);
    }

    vis2Off() {
        this.#bufCtx.filter = 'brightness(' + this.brightness + ') blur(' + this.blurradius + 'px)';
        this.#bufCtx.drawImage(this.#visCvs, 0, 0, this.width, this.height);
    }

    setPixel(x, y, c) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            var offset = 4 * (y * this.width + x);

            this.ImgData.data[offset] = c[0];
            this.ImgData.data[offset + 1] = c[1];
            this.ImgData.data[offset + 2] = c[2];
            this.ImgData.data[offset + 3] = c[3];
        }
    }

    getPixel(x, y) {
        var result = new Array(4);

        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            var offset = 4 * (y * this.width + x);

            result[0] = this.ImgData.data[offset];
            result[1] = this.ImgData.data[offset + 1];
            result[2] = this.ImgData.data[offset + 2];
            result[3] = this.ImgData.data[offset + 3];
        }

        return result;
    }

    mixPixel(x, y, c, aIntensity) {
        var cDst = this.getPixel(x, y);

        cDst[0] = cDst[0] + c[0] >> aIntensity;
        cDst[1] = cDst[1] + c[1] >> aIntensity;
        cDst[2] = cDst[2] + c[2] >> aIntensity;
        cDst[3] = cDst[3] + c[3] >> aIntensity;

        if (cDst[0] > 255) { cDst[0] = 255; }
        if (cDst[1] > 255) { cDst[1] = 255; }
        if (cDst[2] > 255) { cDst[2] = 255; }
        if (cDst[3] > 255) { cDst[3] = 255; }

        this.setPixel(x, y, cDst);
    }

    drawStar(x, y, c) {
        if (x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1) {
            this.mixPixel(x, y, c, 1);
            this.mixPixel(x + 1, y, c, 2);
            this.mixPixel(x - 1, y, c, 2);
            this.mixPixel(x, y + 1, c, 2);
            this.mixPixel(x, y - 1, c, 2);
        }
    }

    copyImageData() {
        var result = this.#bufCtx.createImageData(this.width, this.height);

        result.data.set(this.ImgData.data);

        return result;
    }

    resize(newWidth, newHeight) {
        this.#visCvs.width = newWidth;
        this.#visCvs.height = newHeight;

        this.#bufCvs.width = newWidth;
        this.#bufCvs.height = newHeight;

        this.#buf2Cvs.width = newWidth;
        this.#buf2Cvs.height = newHeight;

        this.width = newWidth;
        this.height = newHeight;

        this.ImgData = this.#bufCtx.getImageData(0, 0, newWidth, newHeight);
        this.visCtx.fillRect(0, 0, newWidth, newHeight);
    }
}

//------------------------------------------------------------------------------
// WebGL Shader Sources
const SHADER_DECAY_VERT = `
attribute vec2 aPosition;
varying vec2 vUV;
void main() {
    vUV = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const SHADER_DECAY_FRAG = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTexture;
uniform float uBrightness;
void main() {
    gl_FragColor = texture2D(uTexture, vUV) * uBrightness;
}`;

const SHADER_TRANSMAP_VERT = `
attribute vec2 aPosition;
varying vec2 vUV;
void main() {
    vUV = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const SHADER_TRANSMAP_FRAG = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uFrame;
uniform sampler2D uDisplacement;
uniform float uFade;
void main() {
    vec2 displaced = texture2D(uDisplacement, vUV).rg;
    vec2 coord = mix(vUV, displaced, uFade);
    gl_FragColor = texture2D(uFrame, coord);
}`;

const SHADER_PARTICLE_VERT = `
attribute vec2 aPosition;
attribute vec4 aColor;
attribute float aDepth;
attribute vec2 aVelocity;
attribute float aPaletteCoord;
attribute float aEndpoint;
uniform vec2 uResolution;
uniform float uPointSize;
uniform float uDepthSize;
uniform float uStreakStrength;
varying vec4 vColor;
varying float vPaletteCoord;
void main() {
    vec2 pos = aPosition;
    if (uStreakStrength > 0.0) {
        pos += aVelocity * (aEndpoint - 0.5) * uStreakStrength;
    }
    vec2 clip = (pos / uResolution) * 2.0 - 1.0;
    clip.y = -clip.y;
    gl_Position = vec4(clip, 0.0, 1.0);
    float depthScale = 1.0 + uDepthSize * (1.0 - aDepth);
    gl_PointSize = uPointSize * depthScale;
    vColor = aColor;
    vPaletteCoord = aPaletteCoord;
}`;

const SHADER_PARTICLE_FRAG = `
precision mediump float;
varying vec4 vColor;
varying float vPaletteCoord;
uniform int uRenderMode;
uniform float uGlow;
uniform float uPaletteMix;
uniform sampler2D uPalette;
void main() {
    vec2 pc = gl_PointCoord - 0.5;
    float r = length(pc) * 2.0;
    float shape;
    if (uRenderMode == 2) {
        float cross_d = min(abs(pc.x), abs(pc.y));
        float arm = 1.0 - smoothstep(0.0, 0.18, cross_d);
        shape = arm * (1.0 - smoothstep(0.3, 1.0, r));
    } else {
        if (uGlow > 0.0) {
            float falloff = 1.0 - smoothstep(0.0, 1.0, r);
            shape = pow(falloff, uGlow);
        } else {
            shape = (r < 0.7) ? 1.0 : 0.0;
        }
    }
    if (shape < 0.01) discard;
    vec4 color = vColor;
    if (uPaletteMix > 0.0) {
        vec4 palColor = texture2D(uPalette, vec2(vPaletteCoord, 0.5));
        color = mix(color, palColor, uPaletteMix);
    }
    gl_FragColor = color * shape;
}`;


//------------------------------------------------------------------------------
class WebGLRenderer {
    #canvas;
    #gl;
    #available;
    #decayProgram;
    #transMapProgram;
    #particleProgram;
    #fboA;
    #fboB;
    #texA;
    #texB;
    #displacementTex;
    #quadVBO;
    #positionVBO;
    #colorVBO;
    #depthVBO;
    #velocityVBO;
    #paletteCoordVBO;
    #endpointVBO;
    #paletteTex;
    #readFBO;
    #writeFBO;
    #readTex;
    #writeTex;
    width;
    height;
    brightness;
    blurradius;
    savedWidth;
    savedHeight;

    constructor(aCanvasElement, aWidth, aHeight) {
        this.#canvas = aCanvasElement;
        this.#canvas.width = aWidth;
        this.#canvas.height = aHeight;
        this.width = aWidth;
        this.height = aHeight;
        this.savedWidth = aWidth;
        this.savedHeight = aHeight;
        this.brightness = 0.9999;
        this.blurradius = 4;

        var gl = aCanvasElement.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
        if (!gl) {
            this.#available = false;
            return;
        }
        this.#gl = gl;
        this.#available = true;

        gl.getExtension('OES_texture_float');
        gl.getExtension('OES_texture_float_linear');

        this.#decayProgram = this.#createProgram(SHADER_DECAY_VERT, SHADER_DECAY_FRAG);
        this.#transMapProgram = this.#createProgram(SHADER_TRANSMAP_VERT, SHADER_TRANSMAP_FRAG);
        this.#particleProgram = this.#createProgram(SHADER_PARTICLE_VERT, SHADER_PARTICLE_FRAG);

        this.#quadVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

        this.#positionVBO = gl.createBuffer();
        this.#colorVBO = gl.createBuffer();
        this.#depthVBO = gl.createBuffer();
        this.#velocityVBO = gl.createBuffer();
        this.#paletteCoordVBO = gl.createBuffer();
        this.#endpointVBO = gl.createBuffer();

        this.#paletteTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.#paletteTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(1024));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.#setupFBOs(aWidth, aHeight);
        this.#displacementTex = gl.createTexture();
    }

    isAvailable() { return this.#available; }

    uploadPalette(paletteData) {
        var gl = this.#gl;
        gl.bindTexture(gl.TEXTURE_2D, this.#paletteTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, paletteData);
    }

    #createProgram(vertSrc, fragSrc) {
        var gl = this.#gl;
        var vert = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vert, vertSrc);
        gl.compileShader(vert);
        if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
            console.error('Vertex shader error:', gl.getShaderInfoLog(vert));
            return null;
        }

        var frag = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(frag, fragSrc);
        gl.compileShader(frag);
        if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
            console.error('Fragment shader error:', gl.getShaderInfoLog(frag));
            return null;
        }

        var prog = gl.createProgram();
        gl.attachShader(prog, vert);
        gl.attachShader(prog, frag);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(prog));
            return null;
        }
        return prog;
    }

    #setupFBOs(w, h) {
        var gl = this.#gl;

        if (this.#texA) gl.deleteTexture(this.#texA);
        if (this.#texB) gl.deleteTexture(this.#texB);
        if (this.#fboA) gl.deleteFramebuffer(this.#fboA);
        if (this.#fboB) gl.deleteFramebuffer(this.#fboB);

        this.#texA = this.#createFrameTexture(w, h);
        this.#texB = this.#createFrameTexture(w, h);

        this.#fboA = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.#fboA);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.#texA, 0);

        this.#fboB = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.#fboB);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.#texB, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        this.#readTex = this.#texA;
        this.#writeTex = this.#texB;
        this.#readFBO = this.#fboA;
        this.#writeFBO = this.#fboB;
    }

    #createFrameTexture(w, h) {
        var gl = this.#gl;
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    resize(newWidth, newHeight) {
        this.#canvas.width = newWidth;
        this.#canvas.height = newHeight;
        this.width = newWidth;
        this.height = newHeight;
        this.#gl.viewport(0, 0, newWidth, newHeight);
        this.#setupFBOs(newWidth, newHeight);
    }

    decayPass() {
        var gl = this.#gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.#writeFBO);
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(this.#decayProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#readTex);
        gl.uniform1i(gl.getUniformLocation(this.#decayProgram, 'uTexture'), 0);
        gl.uniform1f(gl.getUniformLocation(this.#decayProgram, 'uBrightness'), this.brightness);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadVBO);
        var aPos = gl.getAttribLocation(this.#decayProgram, 'aPosition');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.disable(gl.BLEND);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        var tmpFBO = this.#readFBO;
        var tmpTex = this.#readTex;
        this.#readFBO = this.#writeFBO;
        this.#readTex = this.#writeTex;
        this.#writeFBO = tmpFBO;
        this.#writeTex = tmpTex;
    }

    uploadTransMap(transmapArray, width, height) {
        var gl = this.#gl;
        var data = new Float32Array(width * height * 2);
        for (var i = 0; i < width * height; i++) {
            var srcOffset = transmapArray[i];
            var srcX = srcOffset % width;
            var srcY = Math.floor(srcOffset / width);
            data[i * 2] = (srcX + 0.5) / width;
            data[i * 2 + 1] = (srcY + 0.5) / height;
        }

        gl.bindTexture(gl.TEXTURE_2D, this.#displacementTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, width, height, 0, gl.LUMINANCE_ALPHA, gl.FLOAT, null);

        var rgbaTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, rgbaTex);
        var rgbaData = new Float32Array(width * height * 4);
        for (var i = 0; i < width * height; i++) {
            rgbaData[i * 4] = data[i * 2];
            rgbaData[i * 4 + 1] = data[i * 2 + 1];
            rgbaData[i * 4 + 2] = 0;
            rgbaData[i * 4 + 3] = 1;
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, rgbaData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        if (this.#displacementTex) gl.deleteTexture(this.#displacementTex);
        this.#displacementTex = rgbaTex;
    }

    transMapPass(fade) {
        if (fade === undefined) fade = 1.0;
        var gl = this.#gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.#writeFBO);
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(this.#transMapProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#readTex);
        gl.uniform1i(gl.getUniformLocation(this.#transMapProgram, 'uFrame'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.#displacementTex);
        gl.uniform1i(gl.getUniformLocation(this.#transMapProgram, 'uDisplacement'), 1);
        gl.uniform1f(gl.getUniformLocation(this.#transMapProgram, 'uFade'), fade);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadVBO);
        var aPos = gl.getAttribLocation(this.#transMapProgram, 'aPosition');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.disable(gl.BLEND);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        var tmpFBO = this.#readFBO;
        var tmpTex = this.#readTex;
        this.#readFBO = this.#writeFBO;
        this.#readTex = this.#writeTex;
        this.#writeFBO = tmpFBO;
        this.#writeTex = tmpTex;
    }

    renderParticles(positions2d, colors, depths, velocities, paletteCoords, count, renderMode, streakActive) {
        var gl = this.#gl;
        var prog = this.#particleProgram;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.#readFBO);
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(prog);

        gl.uniform2f(gl.getUniformLocation(prog, 'uResolution'), this.width, this.height);
        gl.uniform1i(gl.getUniformLocation(prog, 'uRenderMode'), renderMode);

        var scaleFactor = (this.width + this.height) / (1024 + 768);
        var baseSize = (renderMode === 2) ? 5.0 : 3.0;
        var pointSize = Math.max(baseSize, baseSize * scaleFactor);
        gl.uniform1f(gl.getUniformLocation(prog, 'uPointSize'), pointSize);

        gl.uniform1f(gl.getUniformLocation(prog, 'uDepthSize'), gFxDepthSize);
        gl.uniform1f(gl.getUniformLocation(prog, 'uGlow'), gFxGlow);
        gl.uniform1f(gl.getUniformLocation(prog, 'uStreakStrength'), streakActive ? gFxStreaks : 0.0);
        gl.uniform1f(gl.getUniformLocation(prog, 'uPaletteMix'), gFxPalette !== 'none' ? 1.0 : 0.0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.#paletteTex);
        gl.uniform1i(gl.getUniformLocation(prog, 'uPalette'), 1);

        if (streakActive) {
            var n2 = count * 2;
            var posDouble = new Float32Array(n2 * 2);
            var colDouble = new Uint8Array(n2 * 4);
            var depDouble = new Float32Array(n2);
            var velDouble = new Float32Array(n2 * 2);
            var palDouble = new Float32Array(n2);
            var endDouble = new Float32Array(n2);
            for (var i = 0; i < count; i++) {
                var i2 = i * 2;
                posDouble[i2 * 2] = positions2d[i * 2];
                posDouble[i2 * 2 + 1] = positions2d[i * 2 + 1];
                posDouble[(i2 + 1) * 2] = positions2d[i * 2];
                posDouble[(i2 + 1) * 2 + 1] = positions2d[i * 2 + 1];
                colDouble[i2 * 4] = colors[i * 4];
                colDouble[i2 * 4 + 1] = colors[i * 4 + 1];
                colDouble[i2 * 4 + 2] = colors[i * 4 + 2];
                colDouble[i2 * 4 + 3] = colors[i * 4 + 3];
                colDouble[(i2 + 1) * 4] = colors[i * 4];
                colDouble[(i2 + 1) * 4 + 1] = colors[i * 4 + 1];
                colDouble[(i2 + 1) * 4 + 2] = colors[i * 4 + 2];
                colDouble[(i2 + 1) * 4 + 3] = colors[i * 4 + 3];
                depDouble[i2] = depths[i];
                depDouble[i2 + 1] = depths[i];
                velDouble[i2 * 2] = velocities[i * 2];
                velDouble[i2 * 2 + 1] = velocities[i * 2 + 1];
                velDouble[(i2 + 1) * 2] = velocities[i * 2];
                velDouble[(i2 + 1) * 2 + 1] = velocities[i * 2 + 1];
                palDouble[i2] = paletteCoords[i];
                palDouble[i2 + 1] = paletteCoords[i];
                endDouble[i2] = 0.0;
                endDouble[i2 + 1] = 1.0;
            }
            positions2d = posDouble;
            colors = colDouble;
            depths = depDouble;
            velocities = velDouble;
            paletteCoords = palDouble;
            count = n2;

            gl.bindBuffer(gl.ARRAY_BUFFER, this.#endpointVBO);
            gl.bufferData(gl.ARRAY_BUFFER, endDouble, gl.DYNAMIC_DRAW);
            var aEndLoc = gl.getAttribLocation(prog, 'aEndpoint');
            gl.enableVertexAttribArray(aEndLoc);
            gl.vertexAttribPointer(aEndLoc, 1, gl.FLOAT, false, 0, 0);
        } else {
            var aEndLoc = gl.getAttribLocation(prog, 'aEndpoint');
            if (aEndLoc >= 0) {
                gl.disableVertexAttribArray(aEndLoc);
                gl.vertexAttrib1f(aEndLoc, 0.5);
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.#positionVBO);
        gl.bufferData(gl.ARRAY_BUFFER, positions2d, gl.DYNAMIC_DRAW);
        var aPosLoc = gl.getAttribLocation(prog, 'aPosition');
        gl.enableVertexAttribArray(aPosLoc);
        gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.#colorVBO);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
        var aColLoc = gl.getAttribLocation(prog, 'aColor');
        gl.enableVertexAttribArray(aColLoc);
        gl.vertexAttribPointer(aColLoc, 4, gl.UNSIGNED_BYTE, true, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.#depthVBO);
        gl.bufferData(gl.ARRAY_BUFFER, depths, gl.DYNAMIC_DRAW);
        var aDepthLoc = gl.getAttribLocation(prog, 'aDepth');
        gl.enableVertexAttribArray(aDepthLoc);
        gl.vertexAttribPointer(aDepthLoc, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.#velocityVBO);
        gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.DYNAMIC_DRAW);
        var aVelLoc = gl.getAttribLocation(prog, 'aVelocity');
        gl.enableVertexAttribArray(aVelLoc);
        gl.vertexAttribPointer(aVelLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.#paletteCoordVBO);
        gl.bufferData(gl.ARRAY_BUFFER, paletteCoords, gl.DYNAMIC_DRAW);
        var aPalLoc = gl.getAttribLocation(prog, 'aPaletteCoord');
        gl.enableVertexAttribArray(aPalLoc);
        gl.vertexAttribPointer(aPalLoc, 1, gl.FLOAT, false, 0, 0);

        if (renderMode === 1) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
        } else {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }

        if (streakActive) {
            gl.drawArrays(gl.LINES, 0, count);
        } else {
            gl.drawArrays(gl.POINTS, 0, count);
        }
        gl.disable(gl.BLEND);
    }

    presentToScreen() {
        var gl = this.#gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.width, this.height);
        gl.useProgram(this.#decayProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.#readTex);
        gl.uniform1i(gl.getUniformLocation(this.#decayProgram, 'uTexture'), 0);
        gl.uniform1f(gl.getUniformLocation(this.#decayProgram, 'uBrightness'), 1.0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadVBO);
        var aPos = gl.getAttribLocation(this.#decayProgram, 'aPosition');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.disable(gl.BLEND);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

//------------------------------------------------------------------------------
class TranslationMap {
    width;
    height;
    #transmap;

    constructor(aWidth, aHeight) {
        this.width = aWidth;
        this.height = aHeight;
        this.#transmap = new Array(this.width * this.height).fill(0);
    }

    getMapArray() { return this.#transmap; }

    rollToRange(aValue, aMin, aMax) {
        var result = aValue;

        if (aValue < aMin) {
            result = aMin + (aMin - aValue) % (aMax - aMin);
        } else if (aValue > aMax) {
            result = aMax - (aValue - aMax) % (aMax - aMin);
        }

        return result;
    }

    restrictToRange(aValue, aMin, aMax) {
        var result = aValue;

        if (aValue < aMin) {
            result = aMin;
        } else if (aValue > aMax) {
            result = aMax;
        }

        return result;
    }

    zoomCoordinate(aReference, aCoordinate, aZoomFactor) {
        return Math.round(aReference + (aCoordinate - aReference) * aZoomFactor);
    }

    setTranslation(aSrcX, aSrcY, aDstX, aDstY) {
        aDstX = this.rollToRange(aDstX, 0, this.width - 1);
        aDstY = this.rollToRange(aDstY, 0, this.height - 1);

        this.#transmap[aSrcY * this.width + aSrcX] = (aDstY * this.width + aDstX);
    }

    applyTransMap(aSrcBuf, aDstBuf) {
        for (var n = 0; n < this.width * this.height; n++) {
            var srcAdr = this.#transmap[n] * 4;
            var dstAdr = n * 4;

            aDstBuf[dstAdr] = aSrcBuf[srcAdr];
            aDstBuf[dstAdr + 1] = aSrcBuf[srcAdr + 1];
            aDstBuf[dstAdr + 2] = aSrcBuf[srcAdr + 2];
            aDstBuf[dstAdr + 3] = aSrcBuf[srcAdr + 3];
        }
    }

    zoom(aCenterX, aCenterY, aZoomX, aZoomY) {
        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                var dX = this.zoomCoordinate(aCenterX, x, aZoomX);
                var dY = this.zoomCoordinate(aCenterY, y, aZoomY);

                this.setTranslation(x, y, dX, dY);
            }
        }
    }

    prepareWaveTrans(aXBuf, aYBuf, aParams) {
        for (var x = 0; x < this.width; x++) {
            var x1 = 0;

            for (var n = 0; n < MAX_SIN_MAGIC; n++) {
                aXBuf[x] += Math.sin(((360 * x * aParams[1][n]) / this.width) / DEG) * aParams[0][n];
            }
        }

        for (var y = 0; y < this.height; y++) {
            var y1 = 0;

            for (var n = 0; n < MAX_SIN_MAGIC; n++) {
                aYBuf[y] += Math.sin(((360 * y * aParams[3][n]) / this.height) / DEG) * aParams[2][n];
            }
        }
    }

    prepareWaveZoom(aXBuf, aYBuf, aParams) {
        for (var x = 0; x < this.width; x++) {
            for (var n = 0; n < MAX_SIN_MAGIC; n++) {
                aXBuf[x] += aParams[0][n] + Math.sin(((360 * x * aParams[1][n]) / this.width) / DEG) * aParams[0][n];
            }
        }

        for (var y = 0; y < this.height; y++) {
            for (var n = 0; n < MAX_SIN_MAGIC; n++) {
                aYBuf[y] += +aParams[2][n] + Math.sin(((360 * y * aParams[3][n]) / this.height) / DEG) * aParams[2][n];
            }
        }
    }

    sinMagic(aParams) {
        var wX = Array(this.width).fill(0);
        var wY = Array(this.height).fill(0);

        this.prepareWaveTrans(wX, wY, aParams);

        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                var x2 = Math.round(this.restrictToRange(x + wY[y], -100000, 100000));
                var y2 = Math.round(this.restrictToRange(y + wX[x], -100000, 100000));

                this.setTranslation(x, y, x2, y2);
            }
        }
    }

    sinMagicZoom(aParams, aCenterX, aCenterY, doOverlayXY) {
        var wX = Array(this.width).fill(0);
        var wY = Array(this.height).fill(0);

        this.prepareWaveTrans(wX, wY, aParams);

        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                var x2 = 0;
                var y2 = 0;

                if (doOverlayXY) {
                    x2 = this.zoomCoordinate(aCenterX, x, 1 - (wX[x] + wY[y]) / 2);
                    y2 = this.zoomCoordinate(aCenterY, y, 1 - (wX[x] + wY[y]) / 2);
                } else {
                    x2 = this.zoomCoordinate(aCenterX, x, 1 - wX[x]);
                    y2 = this.zoomCoordinate(aCenterY, y, 1 - wY[y]);
                }

                this.setTranslation(x, y, x2, y2);
            }
        }
    }

    sinMagicZoom2(aParams1, aParams2, aCenterX, aCenterY) {
        var wX = Array(this.width).fill(0);
        var wY = Array(this.height).fill(0);
        var w2X = Array(this.width).fill(0);
        var w2Y = Array(this.height).fill(0);

        this.prepareWaveTrans(wX, wY, aParams1);
        this.prepareWaveZoom(w2X, w2Y, aParams2);

        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                var x2 = this.zoomCoordinate(aCenterX, Math.round(x + wY[y]), 1 - (w2X[x] + w2Y[y]) / 2);
                var y2 = this.zoomCoordinate(aCenterY, Math.round(y + wX[x]), 1 - (w2X[x] + w2Y[y]) / 2);

                this.setTranslation(x, y, x2, y2);
            }
        }
    }
}

//------------------------------------------------------------------------------
class Util3d {

    static translatePoints(aSrcPointArray, aDstPointArray, aVector) {
        for (var n = 0; n < aSrcPointArray.length; n++) {
            var p = aSrcPointArray[n];

            aDstPointArray[n] = [p[0] + aVector[0], p[1] + aVector[1], p[2] + aVector[2]];
        }
    }

    static rotatePoints(aSrcPointArray, aDstPointArray, aAngle3d) {
        var sinWx = Math.sin(aAngle3d[0] / DEG);
        var cosWx = Math.cos(aAngle3d[0] / DEG);

        var sinWy = Math.sin(aAngle3d[1] / DEG);
        var cosWy = Math.cos(aAngle3d[1] / DEG);

        var sinWz = Math.sin(aAngle3d[2] / DEG);
        var cosWz = Math.cos(aAngle3d[2] / DEG);

        for (var n = 0; n < aSrcPointArray.length; n++) {
            var k;

            var p = aSrcPointArray[n];

            var x = p[0];
            var y = p[1];
            var z = p[2];

            // rot x
            k = y * cosWx - z * sinWx;
            z = y * sinWx + z * cosWx;
            y = k;

            // rot y
            k = x * cosWy + z * sinWy;
            z = -x * sinWy + z * cosWy;
            x = k;

            // rot z
            k = x * cosWz - y * sinWz;
            y = x * sinWz + y * cosWz;
            x = k;

            aDstPointArray[n] = [x, y, z];
        }
    }

    static projectPoints(aScrPointArray, aDstPointArray2d, aPerspectiveZ, aOrigin) {
        for (var n = 0; n < aScrPointArray.length; n++) {
            var p = aScrPointArray[n];

            var q = p[2] - aPerspectiveZ;

            if (q > 0) {
                q = aPerspectiveZ / q;
                aDstPointArray2d[n] = [Math.round(aOrigin[0] - p[0] * q), Math.round(aOrigin[1] - p[1] * q)]
            } else {
                aDstPointArray2d[n] = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
            }
        }
    }

    static angle3d(aX, aY, aZ) {
        return [aX, aY, aZ];
    }

    static addAngle3d(a1, a2) {
        var result;

        result = [a1[0] + a2[0],
        a1[1] + a2[1],
        a1[2] + a2[2]];

        return result;
    }

    static subAngle3d(a1, a2) {
        var result;

        result = [a1[0] - a2[0],
        a1[1] - a2[1],
        a1[2] - a2[2]];

        return result;
    }

    static mulAngle3d(a1, aFactor) {
        var result;

        result = [a1[0] * aFactor,
        a1[1] * aFactor,
        a1[2] * aFactor];

        return result;
    }

    static divAngle3d(aAngle, aDivider) {
        var result;

        result = [aAngle[0] / aDivider,
        aAngle[1] / aDivider,
        aAngle[2] / aDivider];

        return result;
    }

    static normalizeAngle(aAngle) {
        var result;

        if (aAngle >= 0) {
            result = aAngle - (Math.round(aAngle / 360) * 360);
        } else {
            result = 360 - (Math.abs(aAngle) - (Math.round(Math.acos(aAngle) / 360) * 360));
        }

        return result;
    }

    static normalizeAngle3d(aAngle) {
        var result;

        result = [this.normalizeAngle(aAngle[0]),
        this.normalizeAngle(aAngle[1]),
        this.normalizeAngle(aAngle[2])];

        return result;
    }


    static point3d(x, y, z) {
        return [x, y, z];
    }

    static addPoint3d(p1, p2) {
        var result;

        result = [p1[0] + p2[0],
        p1[1] + p2[1],
        p1[2] + p2[2]];

        return result;
    }

    static subPoint3d(p1, p2) {
        var result;

        result = [p1[0] - p2[0],
        p1[1] - p2[1],
        p1[2] - p2[2]];

        return result;
    }

    static mulPoint3d(aPoint, aFactor) {
        var result;

        result = [aPoint[0] / aFactor,
        aPoint[1] / aFactor,
        aPoint[2] / aFactor];

        return result;
    }

    static divPoint3d(aPoint, aDivider) {
        var result;

        result = [aPoint[0] / aDivider,
        aPoint[1] / aDivider,
        aPoint[2] / aDivider];

        return result;
    }

    static rotatePoint(aPoint, aAngle3d) {
        var result;

        var k;
        var x, y, z;
        var cosWx;
        var cosWy;
        var cosWz;
        var sinWx;
        var sinWy;
        var sinWz;

        x = aPoint[0];
        y = aPoint[1];
        z = aPoint[2];

        // rot x
        sinWx = Math.sin(aAngle3d[0]);
        cosWx = Math.cos(aAngle3d[0]);

        k = y * cosWx - z * sinWx;
        z = y * sinWx + z * cosWx;
        y = k;

        // rot y
        sinWy = Math.sin(aAngle3d[1]);
        cosWy = Math.cos(aAngle3d[1]);

        k = x * cosWy + z * sinWy;
        z = -x * sinWy + z * cosWy;
        x = k;

        // rot z
        sinWz = Math.sin(aAngle3d[2]);
        cosWz = Math.cos(aAngle3d[2]);

        k = x * cosWz - y * sinWz;
        y = x * sinWz + y * cosWz;
        x = k;

        result = [x, y, z];

        return result;
    }

}

//------------------------------------------------------------------------------
class World3d {
    origin;
    viewPos;
    viewAngle;
    perspectiveZ;
    #objects;

    canvas;

    constructor(aOrigin, aViewPos, aViewAngle, aPerspectiveZ, aCanvas) {
        this.origin = aOrigin;
        this.viewPos = aViewPos;
        this.viewAngle = aViewAngle;
        this.perspectiveZ = aPerspectiveZ;
        this.canvas = aCanvas;

        this.#objects = new Array();
    }

    count() {
        return this.#objects.length;
    }

    addObject(aObject) {
        this.#objects.push(aObject);
        aObject.world = this;
    }

    doWorld() {
        for (var n = 0; n < this.count(); n++) {
            this.#objects[n].doObject();
            this.#objects[n].transform();
            this.#objects[n].project();
            this.#objects[n].render();
        }
    }
}

//------------------------------------------------------------------------------
class Object3d {
    world;

    position = [0, 0, 0];
    angle = [0, 0, 0];

    constructor(aWorld) {
        this.world = aWorld;
    }

    doObject() { }
    transform() { }
    project() { }
    render() { }

}

//------------------------------------------------------------------------------
class ParticleSystem extends Object3d {
    _particles;
    #particlesTrans;
    #particles2d;
    #prevPositions2d;
    _colors;

    renderMode;

    #startTime;
    #lastDoObject;

    speed3d;
    rotationSpeed3d;

    constructor(aWorld, aParticleCount) {
        super(aWorld);

        this.allocateSystem(aParticleCount);

        this.renderMode = ParticleRenderMode.rmDraw;

        this.speed3d = POINT3D_ZERO;
        this.rotationSpeed3d = ANGLE3D_ZERO;

        this.#startTime = -1;
        this.#lastDoObject = -1;
    }

    allocateSystem(aParticleCount) {
        this._particles = new Array(aParticleCount);
        for (var n = 0; n < this._particles.length; n++) {
            this._particles[n] = [0.0, 0.0, 0.0];
        }

        this.#particlesTrans = new Array(aParticleCount);
        for (var n = 0; n < this.#particlesTrans.length; n++) {
            this.#particlesTrans[n] = [0.0, 0.0, 0.0];
        }

        this.#particles2d = new Array(aParticleCount);
        for (var n = 0; n < this.#particles2d.length; n++) {
            this.#particles2d[n] = [0, 0];
        }

        this._colors = new Array(aParticleCount);
        for (var n = 0; n < this._colors.length; n++) {
            this._colors[n] = [0, 0, 0, 0];
        }
    }

    clearSystem() {
        for (var n = 0; n < this._particles.length; n++) {
            this._particles[n] = [0.0, 0.0, 0.0];
        }
    }

    getElapsed() {
        var now = new Date();
        return now.getTime() - this.#startTime;
    }

    _getDelta() {
        if (this.#startTime < 0) return 16.667;
        var time = this.getElapsed();
        var d = time - this.#lastDoObject;
        return Math.min(Math.max(d, 0), 100);
    }

    doObject() {
        if (this.#startTime < 0) {
            var now = new Date();
            this.#startTime = now.getTime();
            this.#lastDoObject = this.#startTime;
        }

        var time;
        var delta;

        time = this.getElapsed();

        if (this.#lastDoObject < time) {
            delta = time - this.#lastDoObject;

            var rotInc = Util3d.divAngle3d(this.rotationSpeed3d, 1000 / delta);
            var posInc = Util3d.divPoint3d(this.speed3d, 1000 / delta);
            if (gFxSpeedFactor !== 1.0) {
                rotInc = [rotInc[0] * gFxSpeedFactor, rotInc[1] * gFxSpeedFactor, rotInc[2] * gFxSpeedFactor];
                posInc = [posInc[0] * gFxSpeedFactor, posInc[1] * gFxSpeedFactor, posInc[2] * gFxSpeedFactor];
            }
            this.angle = Util3d.addAngle3d(this.angle, rotInc);
            this.position = Util3d.addPoint3d(this.position, posInc);
        }

        this.#lastDoObject = time;
    }

    #getColor(n, depths) {
        var c = this._colors[n];
        if (gFxPalette !== 'none') {
            var palData = PALETTES[gFxPalette];
            var coord;
            if (gEscapeFlowEnabled && gEscapeFlowValues && gEscapeFlowValues[n] > 0) {
                coord = gEscapeFlowValues[n];
            } else {
                coord = (gFxPaletteMapping === 'phase') ? (n / this.#particles2d.length) : (depths ? depths[n] : 0);
            }
            var idx = Math.min(255, Math.max(0, Math.floor(coord * 255))) * 4;
            c = [palData[idx], palData[idx + 1], palData[idx + 2], 255];
        }
        return c;
    }

    #drawStreak(x, y, vx, vy, c) {
        var len = Math.sqrt(vx * vx + vy * vy);
        if (len < 1) {
            this.world.canvas.setPixel(x, y, c);
            return;
        }
        var steps = Math.min(Math.round(len * gFxStreaks), 20);
        var dx = (vx * gFxStreaks) / steps;
        var dy = (vy * gFxStreaks) / steps;
        var sx = x - dx * steps * 0.5;
        var sy = y - dy * steps * 0.5;
        for (var s = 0; s <= steps; s++) {
            this.world.canvas.setPixel(Math.round(sx + dx * s), Math.round(sy + dy * s), c);
        }
    }

    draw(depths, velocities) {
        var w = this.world.canvas.width;
        var h = this.world.canvas.height;
        var baseSz = Math.max(1, Math.round((w + h) / (1024 + 768)));

        for (var n = 0; n < this.#particles2d.length; n++) {
            var x = this.#particles2d[n][0];
            var y = this.#particles2d[n][1];
            var c = this.#getColor(n, depths);

            var sz = baseSz;
            if (depths && gFxDepthSize > 0) {
                sz = Math.max(1, Math.round(baseSz * (1.0 + gFxDepthSize * (1.0 - depths[n]))));
            }

            if (velocities && gFxStreaks > 0) {
                this.#drawStreak(x, y, velocities[n * 2], velocities[n * 2 + 1], c);
            } else if (sz <= 1) {
                this.world.canvas.setPixel(x, y, c);
            } else {
                for (var dy = 0; dy < sz; dy++) {
                    for (var dx = 0; dx < sz; dx++) {
                        this.world.canvas.setPixel(x + dx, y + dy, c);
                    }
                }
            }
        }
    }

    drawMixMode(depths, velocities) {
        var w = this.world.canvas.width;
        var h = this.world.canvas.height;
        var baseSz = Math.max(1, Math.round((w + h) / (1024 + 768)));

        for (var n = 0; n < this.#particles2d.length; n++) {
            var x = this.#particles2d[n][0];
            var y = this.#particles2d[n][1];
            var c = this.#getColor(n, depths);

            var sz = baseSz;
            if (depths && gFxDepthSize > 0) {
                sz = Math.max(1, Math.round(baseSz * (1.0 + gFxDepthSize * (1.0 - depths[n]))));
            }

            if (velocities && gFxStreaks > 0) {
                var len = Math.sqrt(velocities[n*2]*velocities[n*2] + velocities[n*2+1]*velocities[n*2+1]);
                var steps = Math.min(Math.round(len * gFxStreaks), 20);
                if (steps < 1) { this.world.canvas.mixPixel(x, y, c, 1); continue; }
                var ddx = (velocities[n*2] * gFxStreaks) / steps;
                var ddy = (velocities[n*2+1] * gFxStreaks) / steps;
                var sx = x - ddx * steps * 0.5;
                var sy = y - ddy * steps * 0.5;
                for (var s = 0; s <= steps; s++) {
                    this.world.canvas.mixPixel(Math.round(sx + ddx * s), Math.round(sy + ddy * s), c, 1);
                }
            } else if (sz <= 1) {
                this.world.canvas.mixPixel(x, y, c, 1);
            } else {
                for (var dy = 0; dy < sz; dy++) {
                    for (var dx = 0; dx < sz; dx++) {
                        this.world.canvas.mixPixel(x + dx, y + dy, c, 1);
                    }
                }
            }
        }
    }

    drawStars(depths, velocities) {
        var w = this.world.canvas.width;
        var h = this.world.canvas.height;
        var baseSz = Math.max(1, Math.round((w + h) / (1024 + 768)));

        for (var n = 0; n < this.#particles2d.length; n++) {
            var x = this.#particles2d[n][0];
            var y = this.#particles2d[n][1];
            var c = this.#getColor(n, depths);

            var sz = baseSz;
            if (depths && gFxDepthSize > 0) {
                sz = Math.max(1, Math.round(baseSz * (1.0 + gFxDepthSize * (1.0 - depths[n]))));
            }

            if (velocities && gFxStreaks > 0) {
                this.#drawStreak(x, y, velocities[n * 2], velocities[n * 2 + 1], c);
            } else {
                this.world.canvas.mixPixel(x, y, c, 0);
                for (var d = 1; d <= sz; d++) {
                    this.world.canvas.mixPixel(x - d, y, c, 1);
                    this.world.canvas.mixPixel(x + d, y, c, 1);
                    this.world.canvas.mixPixel(x, y - d, c, 1);
                    this.world.canvas.mixPixel(x, y + d, c, 1);
                }
            }
        }
    }

    //lightZ() {}

    makeTestCube(aSide, aColor) {
        var n;
        var p;

        p = Math.round(Math.pow(this._particles.length, 1 / 3) + 0.5) - 1;

        n = 0;

        for (var x = 0; x <= p; x++) {
            for (var y = 0; y <= p; y++) {
                for (var z = 0; z <= p; z++) {
                    if (n <= this._particles.length) {
                        this._particles[n] = [Math.round(x * aSide / p - aSide / 2),
                        Math.round(y * aSide / p - aSide / 2),
                        Math.round(z * aSide / p - aSide / 2)];

                        if (Array.isArray(aColor)) {
                            this._colors[n] = aColor;
                        } else {
                            this._colors[n] = [Math.round(Math.sin(x * 5 / DEG) * 255), Math.round(Math.sin(y * 5.1 / DEG) * 255), Math.round(Math.sin(z * 5.2 / DEG) * 255), 255];
                        }
                    }
                    n++;
                }
            }
        }
    }

    transform() {
        var angle = this.angle;
        Util3d.rotatePoints(this._particles, this.#particlesTrans, Util3d.subAngle3d(angle, this.world.viewAngle));
        var tmpPos = Util3d.rotatePoint(Util3d.subPoint3d(this.position, this.world.viewPos), Util3d.subAngle3d(ANGLE3D_ZERO, this.world.viewAngle));
        Util3d.translatePoints(this.#particlesTrans, this.#particlesTrans, tmpPos);
    }

    project() {
        Util3d.projectPoints(this.#particlesTrans, this.#particles2d, this.world.perspectiveZ, this.world.origin);
    }

    render() {
        if (this.world.canvas instanceof WebGLRenderer) {
            var count = this.#particles2d.length;
            var positions = new Float32Array(count * 2);
            var colors = new Uint8Array(count * 4);
            var depths = new Float32Array(count);
            var velocities = new Float32Array(count * 2);
            var paletteCoords = new Float32Array(count);
            var pz = this.world.perspectiveZ;
            var depthRange = -pz * 2;
            var hasPrev = this.#prevPositions2d !== null && this.#prevPositions2d !== undefined;
            for (var n = 0; n < count; n++) {
                var px = this.#particles2d[n][0];
                var py = this.#particles2d[n][1];
                positions[n * 2] = px;
                positions[n * 2 + 1] = py;
                colors[n * 4] = this._colors[n][0];
                colors[n * 4 + 1] = this._colors[n][1];
                colors[n * 4 + 2] = this._colors[n][2];
                colors[n * 4 + 3] = this._colors[n][3];
                var z = this.#particlesTrans[n][2];
                var d = (z - pz) / depthRange;
                depths[n] = Math.max(0.0, Math.min(1.0, d));
                if (hasPrev) {
                    var vx = px - this.#prevPositions2d[n * 2];
                    var vy = py - this.#prevPositions2d[n * 2 + 1];
                    if (gEscapeFlowEnabled && (vx * vx + vy * vy) > 900) {
                        vx = 0; vy = 0;
                    }
                    velocities[n * 2] = vx;
                    velocities[n * 2 + 1] = vy;
                }
                if (gEscapeFlowEnabled && gEscapeFlowValues && gEscapeFlowValues[n] > 0) {
                    paletteCoords[n] = gEscapeFlowValues[n];
                } else {
                    paletteCoords[n] = (gFxPaletteMapping === 'phase') ? (n / count) : depths[n];
                }
            }
            if (!this.#prevPositions2d) this.#prevPositions2d = new Float32Array(count * 2);
            this.#prevPositions2d.set(positions);
            var streakActive = gFxStreaks > 0 && hasPrev;
            this.world.canvas.renderParticles(positions, colors, depths, velocities, paletteCoords, count, this.renderMode, streakActive);
            return;
        }

        var count2d = this.#particles2d.length;
        var depths2d = null;
        var velocities2d = null;
        var pz2 = this.world.perspectiveZ;
        var depthRange2 = -pz2 * 2;

        if (gFxDepthSize > 0 || gFxPalette !== 'none') {
            depths2d = new Float32Array(count2d);
            for (var n = 0; n < count2d; n++) {
                var z2 = this.#particlesTrans[n][2];
                depths2d[n] = Math.max(0.0, Math.min(1.0, (z2 - pz2) / depthRange2));
            }
        }

        if (gFxStreaks > 0) {
            var hasPrev2d = this.#prevPositions2d !== null && this.#prevPositions2d !== undefined;
            velocities2d = new Float32Array(count2d * 2);
            if (hasPrev2d) {
                for (var n = 0; n < count2d; n++) {
                    var svx = this.#particles2d[n][0] - this.#prevPositions2d[n * 2];
                    var svy = this.#particles2d[n][1] - this.#prevPositions2d[n * 2 + 1];
                    if (gEscapeFlowEnabled && (svx * svx + svy * svy) > 900) {
                        svx = 0; svy = 0;
                    }
                    velocities2d[n * 2] = svx;
                    velocities2d[n * 2 + 1] = svy;
                }
            }
            if (!this.#prevPositions2d) this.#prevPositions2d = new Float32Array(count2d * 2);
            for (var n = 0; n < count2d; n++) {
                this.#prevPositions2d[n * 2] = this.#particles2d[n][0];
                this.#prevPositions2d[n * 2 + 1] = this.#particles2d[n][1];
            }
        }

        switch (this.renderMode) {
            case ParticleRenderMode.rmDraw:
                this.draw(depths2d, velocities2d);
                break;

            case ParticleRenderMode.rmDrawMixMode:
                this.drawMixMode(depths2d, velocities2d);
                break;

            case ParticleRenderMode.rmDrawStars:
                this.drawStars(depths2d, velocities2d);
                break;
        }
    }

    applyPreset(aPreset) {
        this.rotationSpeed3d = aPreset.Rotation;
        this.waveSpeed = aPreset.WaveSpeed;

        for (var n = 0; n < MAX_WAVE_CNT; n++) {
            for (var i = 0; i < AXIS_CNT; i++) {
                this.waves[n][i].phase = aPreset.Waves[n][i].Phase;
                this.waves[n][i].am.base = aPreset.Waves[n][i].Am.Base;
                this.waves[n][i].am.amp = aPreset.Waves[n][i].Am.Amp;
                this.waves[n][i].am.freq = aPreset.Waves[n][i].Am.Freq;
                this.waves[n][i].fm.base = aPreset.Waves[n][i].Fm.Base;
                this.waves[n][i].fm.amp = aPreset.Waves[n][i].Fm.Amp;
                this.waves[n][i].fm.freq = aPreset.Waves[n][i].Fm.Freq;
            }
        }

        this.scaleWaves(aPreset.Width, aPreset.Height);

        this.colorBase = aPreset.ColorBase;
        this.colorAmp = aPreset.ColorAmp;
        this.colorFreq = aPreset.ColorFreq;
        this.colorShift = aPreset.ColorShift;

        this.renderMode = aPreset.RenderMode;
    }
}

class WaveParam {
    base;
    amp;
    freq;

    constructor() {
        this.base = 0;
        this.amp = 0;
        this.freq = 0;
    }
}

class Wave {
    phase;
    am; // WaveParam
    fm; // WaveParam

    constructor() {
        this.phase = 0;
        this.am = new WaveParam();
        this.fm = new WaveParam();
    }

    static waveArray() {
        return [[new Wave(), new Wave(), new Wave()],
        [new Wave(), new Wave(), new Wave()],
        [new Wave(), new Wave(), new Wave()]];
    }
}

class SinMagicParams {
    xAmp;
    xFreq;
    yAmp;
    yFreq;

    constructor() {
        xAmp = [0, 0, 0, 0];
        xFreq = [0, 0, 0, 0];
        yAmp = [0, 0, 0, 0];
        yFreq = [0, 0, 0, 0];
    }
}

class WaveConfig {
    name;
    particleCount;
    motionBlur;
    smoothFilter;
    transMapFilter;
    renderMode;

    transMapMode;
    transMapStyle;
    zoomCenterX;
    zoomCenterY;

    waveSpeed;
    pos;

    colorBase;
    colorAmp;
    colorFreq;
    colorShift;

    waveX;
    waveY;
    waveZ;

    startAngle;
    rotAngle;

    transSinMagic;

    width;
    height;

    constructor() {
        waveX = [new Wave(), new Wave(), new Wave()];
        waveY = [new Wave(), new Wave(), new Wave()];
        waveZ = [new Wave(), new Wave(), new Wave()];

        transSinMagic = [new SinMagicParams(), new SinMagicParams()];
    }
}

class ParticleWaves extends ParticleSystem {
    waves;
    pos;
    waveSpeed;

    colorBase;
    colorAmp;
    colorFreq;
    colorShift;

    _attractorState;

    constructor(aWorld, aParticleCount) {
        super(aWorld, aParticleCount);

        this.waves = [[new Wave(), new Wave(), new Wave()],
        [new Wave(), new Wave(), new Wave()],
        [new Wave(), new Wave(), new Wave()]];

        this.pos = 0;
        this._attractorState = new Float64Array(aParticleCount * 2);
        this.initAttractorState();
    }

    initAttractorState() {
        for (var i = 0; i < this._attractorState.length; i += 2) {
            this._attractorState[i] = (Math.random() - 0.5) * 0.2;
            this._attractorState[i + 1] = (Math.random() - 0.5) * 0.2;
        }
    }

    scaleWavesByFactor(aScalefactor) {
        for (var n = 0; n < MAX_WAVE_CNT; n++) {
            for (var i = 0; i < AXIS_CNT; i++) {
                this.waves[n][i].am.base *= aScalefactor;
                this.waves[n][i].am.amp *= aScalefactor;
            }
        }
    }

    scaleWaves(aSrcWidth, aScrHeight) {
        var w = this.world.canvas.width;
        var h = this.world.canvas.height;

        var zScr = (aSrcWidth + aScrHeight) / 2;
        var zDst = (w + h) / 2;

        for (var n = 0; n < MAX_WAVE_CNT; n++) {
            this.waves[n][0].am.base = (this.waves[n][0].am.base * w) / aSrcWidth;
            this.waves[n][0].am.amp = (this.waves[n][0].am.amp * w) / aSrcWidth;

            this.waves[n][1].am.base = (this.waves[n][1].am.base * h) / aScrHeight;
            this.waves[n][1].am.amp = (this.waves[n][1].am.amp * h) / aScrHeight;

            this.waves[n][2].am.base = (this.waves[n][2].am.base * zDst) / zScr;
            this.waves[n][2].am.amp = (this.waves[n][2].am.amp * zDst) / zScr;
        }
    }

    calcWaveParam(aWaveParam, aTime) {
        return aWaveParam.base + Math.sin(aTime * aWaveParam.freq / DEG) * aWaveParam.amp;
    }

    calcWave(aParticleArray, aWaveIndex, aAxis, aStep, aAM, aFM, aPH) {
        if (aAM[aWaveIndex][aAxis] != 0) { }
        var n = 0;

        for (var t = 0; t <= aParticleArray.length - 1; t++) {
            var p = aParticleArray[t];

            var v = Math.sin((n + aPH[aWaveIndex][aAxis]) * aFM[aWaveIndex][aAxis]) * aAM[aWaveIndex][aAxis];

            p[aAxis] += v;

            aParticleArray[t] = p;

            n += aStep;
        }
    }

    calcColorComponent(aColorArray, aBitShift, aBase, aAmplitude, aFrequency, aShift, aPosition, aStep) {
        var n = 0;

        for (var t = 0; t <= aColorArray.length - 1; t++) {
            var c = Math.round(aBase + Math.sin(n * aFrequency / DEG + aPosition * aShift) * aAmplitude);

            if (c < 0) { c = 0 };
            if (c > 255) { c = 255 };

            aColorArray[t] = aColorArray[t] | (c << aBitShift);

            n += aStep;
        }
    }

    doObject() {
        var am = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        var fm = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        var ph = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

        var scaledTime = this.pos;

        for (var t = 0; t < MAX_WAVE_CNT; t++) {
            for (var q = 0; q < AXIS_CNT; q++) {
                am[t][q] = this.calcWaveParam(this.waves[t][q].am, scaledTime);
                fm[t][q] = this.calcWaveParam(this.waves[t][q].fm, scaledTime) / DEG;
                ph[t][q] = this.waves[t][q].phase;
            }
        }

        var cStep = 360 / this._particles.length;

        // waves
        this.clearSystem();  // is necessary because we only calc waves if we know that a result<>0 will come out

        for (var t = 0; t < MAX_WAVE_CNT; t++) {
            for (var q = 0; q < AXIS_CNT; q++) {
                this.calcWave(this._particles, t, q, cStep, am, fm, ph);
            }
        }

        // attractor blend
        var fracBlend = this._fractalBlendOverride !== undefined ? this._fractalBlendOverride : gFractalBlend;
        if (fracBlend > 0) {
            var fracType = this._fractalTypeOverride || gFractalType;
            var fracParams = this._fractalParamsOverride || gFractalParams;
            var w = this.world.canvas.width;
            var h = this.world.canvas.height;
            var scaleX, scaleY;
            if (fracType === 'lorenz2d') {
                scaleX = w / 50; scaleY = h / 50;
            } else if (fracType === 'rossler') {
                scaleX = w / 40; scaleY = h / 40;
            } else if (fracType === 'thomas') {
                scaleX = w / 6; scaleY = h / 6;
            } else if (fracType === 'halvorsen') {
                scaleX = w / 20; scaleY = h / 20;
            } else if (fracType === 'aizawa') {
                scaleX = w / 4; scaleY = h / 4;
            } else if (fracType === 'nosehoover') {
                scaleX = w / 8; scaleY = h / 8;
            } else if (fracType === 'julia') {
                scaleX = w / 2.8; scaleY = h / 2.8;
            } else if (fracType === 'mandelbrot') {
                var bw = gEscapeFlowGridBounds[2] - gEscapeFlowGridBounds[0];
                var bh = gEscapeFlowGridBounds[3] - gEscapeFlowGridBounds[1];
                scaleX = w / (bw * 1.1); scaleY = h / (bh * 1.1);
            } else {
                scaleX = w / 4; scaleY = h / 4;
            }
            var invBlend = 1.0 - fracBlend;
            for (var i = 0; i < this._particles.length; i++) {
                var si = i * 2;
                var ax = this._attractorState[si];
                var ay = this._attractorState[si + 1];
                var nxy, nxyz;
                if (fracType === 'clifford') {
                    nxy = cliffordIterate(ax, ay, fracParams);
                    this._attractorState[si] = nxy[0];
                    this._attractorState[si + 1] = nxy[1];
                } else if (fracType === 'dejong') {
                    nxy = dejongIterate(ax, ay, fracParams);
                    this._attractorState[si] = nxy[0];
                    this._attractorState[si + 1] = nxy[1];
                } else if (fracType === 'julia' || fracType === 'mandelbrot') {
                    if (gEscapeFlowEnabled && gEscapeFlowGrid) {
                        nxy = escapeFlowIterate(ax, ay, fracParams, fracType);
                        if (gEscapeFlowValues) {
                            var ev = sampleEscapeGrid(nxy[0], nxy[1]);
                            if (ev > gEscapeFlowMinEsc && ev < gEscapeFlowMaxEsc) {
                                var logMin = Math.log(gEscapeFlowMinEsc + 1);
                                var logMax = Math.log(gEscapeFlowMaxEsc + 1);
                                var logVal = Math.log(ev + 1);
                                gEscapeFlowValues[i] = (logVal - logMin) / (logMax - logMin);
                            } else {
                                gEscapeFlowValues[i] = 0;
                            }
                        }
                    } else {
                        nxy = juliaIterate(ax, ay, fracParams);
                    }
                    this._attractorState[si] = nxy[0];
                    this._attractorState[si + 1] = nxy[1];
                } else if (fracType === 'rossler') {
                    var rz = gLorenzZState ? gLorenzZState[i] || 0.1 : 0.1;
                    nxyz = rosslerIterate(ax, ay, rz, fracParams);
                    this._attractorState[si] = nxyz[0];
                    this._attractorState[si + 1] = nxyz[1];
                    if (gLorenzZState) gLorenzZState[i] = nxyz[2];
                } else if (fracType === 'thomas') {
                    var tz = gLorenzZState ? gLorenzZState[i] || 1.0 : 1.0;
                    nxyz = thomasIterate(ax, ay, tz, fracParams);
                    this._attractorState[si] = nxyz[0];
                    this._attractorState[si + 1] = nxyz[1];
                    if (gLorenzZState) gLorenzZState[i] = nxyz[2];
                } else if (fracType === 'halvorsen') {
                    var hz = gLorenzZState ? gLorenzZState[i] || -5.0 : -5.0;
                    nxyz = halvorsenIterate(ax, ay, hz, fracParams);
                    this._attractorState[si] = nxyz[0];
                    this._attractorState[si + 1] = nxyz[1];
                    if (gLorenzZState) gLorenzZState[i] = nxyz[2];
                } else if (fracType === 'aizawa') {
                    var az = gLorenzZState ? gLorenzZState[i] || 0.5 : 0.5;
                    nxyz = aizawaIterate(ax, ay, az, fracParams);
                    this._attractorState[si] = nxyz[0];
                    this._attractorState[si + 1] = nxyz[1];
                    if (gLorenzZState) gLorenzZState[i] = nxyz[2];
                } else if (fracType === 'nosehoover') {
                    var nz = gLorenzZState ? gLorenzZState[i] || 0.0 : 0.0;
                    nxyz = nosehooverIterate(ax, ay, nz, fracParams);
                    this._attractorState[si] = nxyz[0];
                    this._attractorState[si + 1] = nxyz[1];
                    if (gLorenzZState) gLorenzZState[i] = nxyz[2];
                } else {
                    var lz = gLorenzZState ? gLorenzZState[i] || 25 : 25;
                    nxyz = lorenz2dIterate(ax, ay, lz, fracParams);
                    this._attractorState[si] = nxyz[0];
                    this._attractorState[si + 1] = nxyz[1];
                    if (gLorenzZState) gLorenzZState[i] = nxyz[2];
                }
                var ax2 = this._attractorState[si];
                var ay2 = this._attractorState[si + 1];
                if (fracType === 'mandelbrot') {
                    ax2 -= (gEscapeFlowGridBounds[0] + gEscapeFlowGridBounds[2]) * 0.5;
                    ay2 -= (gEscapeFlowGridBounds[1] + gEscapeFlowGridBounds[3]) * 0.5;
                }
                var attractX = ax2 * scaleX;
                var attractY = ay2 * scaleY;
                this._particles[i][0] = invBlend * this._particles[i][0] + fracBlend * attractX;
                this._particles[i][1] = invBlend * this._particles[i][1] + fracBlend * attractY;
                if (gLorenzZState) {
                    var scaleZ = h / 4;
                    var zVal = gLorenzZState[i];
                    if (fracType === 'lorenz2d') zVal = (zVal - 25) * scaleZ / 30;
                    else if (fracType === 'rossler') zVal = (zVal - 10) * scaleZ / 30;
                    else zVal = zVal * scaleZ / 3;
                    this._particles[i][2] = invBlend * this._particles[i][2] + fracBlend * zVal;
                } else if (gEscapeFlowEnabled && gEscapeFlowValues && gEscapeFlowValues[i] > 0) {
                    var ezVal = (gEscapeFlowValues[i] - 0.5) * h;
                    this._particles[i][2] = invBlend * this._particles[i][2] + fracBlend * ezVal;
                } else {
                    this._particles[i][2] = invBlend * this._particles[i][2];
                }
            }
        }

        // colors
        var n = 0;
        var useEscapeColor = gEscapeFlowEnabled && gEscapeFlowValues && (gFractalType === 'julia' || gFractalType === 'mandelbrot') && gFractalBlend > 0;
        for (var t = 0; t <= this._particles.length - 1; t++) {
            var c = [0, 0, 0, 255];
            var colorCoord = n;
            if (useEscapeColor && gEscapeFlowValues[t] > 0) {
                colorCoord = gEscapeFlowValues[t] * 720;
            }

            for (var i = 0; i <= 2; i++) {
                c[i] = Math.round(this.colorBase[i] + Math.sin(colorCoord * this.colorFreq[i] / DEG + this.pos * this.colorShift[i]) * this.colorAmp[i]);

                if (c[i] < 0) { c[i] = 0; }
                if (c[i] > 255) { c[i] = 255; }
            }

            this._colors[t] = c;

            n += cStep;
        }

        var correction = gFxSpeedCorrection ? Math.min(this._getDelta() / 16.667, 6.0) : 1.0;
        this.pos += this.waveSpeed * gFxSpeedFactor * correction;

        super.doObject();
    }

}

//------------------------------------------------------------------------------
// Fractal Attractor Iteration Functions
//------------------------------------------------------------------------------

function cliffordIterate(x, y, params) {
    var a = params[0], b = params[1], c = params[2], d = params[3];
    var nx = Math.sin(a * y) + c * Math.cos(a * x);
    var ny = Math.sin(b * x) + d * Math.cos(b * y);
    if (!isFinite(nx) || !isFinite(ny)) return [0, 0];
    if (nx > 2) nx = 2; else if (nx < -2) nx = -2;
    if (ny > 2) ny = 2; else if (ny < -2) ny = -2;
    return [nx, ny];
}

function dejongIterate(x, y, params) {
    var a = params[0], b = params[1], c = params[2], d = params[3];
    var nx = Math.sin(a * y) - Math.cos(b * x);
    var ny = Math.sin(c * x) - Math.cos(d * y);
    if (!isFinite(nx) || !isFinite(ny)) return [0, 0];
    if (nx > 2) nx = 2; else if (nx < -2) nx = -2;
    if (ny > 2) ny = 2; else if (ny < -2) ny = -2;
    return [nx, ny];
}

function juliaIterate(x, y, params) {
    var cRe = params[0], cIm = params[1], escapeR = params[2];
    var nx = x * x - y * y + cRe;
    var ny = 2 * x * y + cIm;
    if (nx * nx + ny * ny > escapeR * escapeR) {
        nx = (Math.random() - 0.5) * 3.0;
        ny = (Math.random() - 0.5) * 3.0;
    }
    if (!isFinite(nx) || !isFinite(ny)) return [0, 0];
    if (nx > 2) nx = 2; else if (nx < -2) nx = -2;
    if (ny > 2) ny = 2; else if (ny < -2) ny = -2;
    return [nx, ny];
}

var gEscapeFlowEnabled = true;
var gEscapeFlowGrid = null;
var gEscapeFlowGridSize = 512;
var gEscapeFlowGridBounds = [-2, -2, 2, 2];
var gEscapeFlowMaxIter = 256;
var gEscapeFlowValues = null;
var gEscapeFlowTargetIter = 0;
var gEscapeFlowMinEsc = 2;
var gEscapeFlowMaxEsc = 256;

function smoothEscapeJulia(x, y, cRe, cIm, maxIter) {
    var zx = x, zy = y;
    for (var i = 0; i < maxIter; i++) {
        var zx2 = zx * zx, zy2 = zy * zy;
        if (zx2 + zy2 > 256) {
            return i - Math.log2(Math.log2(zx2 + zy2)) + 4;
        }
        zy = 2 * zx * zy + cIm;
        zx = zx2 - zy2 + cRe;
    }
    return maxIter;
}

function smoothEscapeMandelbrot(cRe, cIm, maxIter) {
    var zx = 0, zy = 0;
    for (var i = 0; i < maxIter; i++) {
        var zx2 = zx * zx, zy2 = zy * zy;
        if (zx2 + zy2 > 256) {
            return i - Math.log2(Math.log2(zx2 + zy2)) + 4;
        }
        zy = 2 * zx * zy + cIm;
        zx = zx2 - zy2 + cRe;
    }
    return maxIter;
}

function computeAdaptiveMaxIter(bounds) {
    var bw = bounds[2] - bounds[0];
    var bh = bounds[3] - bounds[1];
    var span = Math.max(bw, bh);
    if (span > 2.0) return 256;
    if (span > 0.5) return 400;
    if (span > 0.1) return 600;
    if (span > 0.01) return 800;
    return 1000;
}

function blurGrid(grid, size, passes) {
    var tmp = new Float32Array(size * size);
    for (var p = 0; p < passes; p++) {
        for (var y = 1; y < size - 1; y++) {
            for (var x = 1; x < size - 1; x++) {
                var idx = y * size + x;
                tmp[idx] = (
                    grid[idx - size - 1] + grid[idx - size] + grid[idx - size + 1] +
                    grid[idx - 1] + grid[idx] * 4 + grid[idx + 1] +
                    grid[idx + size - 1] + grid[idx + size] + grid[idx + size + 1]
                ) / 12.0;
            }
        }
        for (var y = 1; y < size - 1; y++) {
            for (var x = 1; x < size - 1; x++) {
                grid[y * size + x] = tmp[y * size + x];
            }
        }
    }
}

function buildEscapeFlowGrid(fracType, params) {
    var size = gEscapeFlowGridSize;
    var grid = new Float32Array(size * size);
    if (fracType !== 'mandelbrot') {
        gEscapeFlowGridBounds = [-2, -2, 2, 2];
    }
    var bounds = gEscapeFlowGridBounds;
    var maxIter = computeAdaptiveMaxIter(bounds);
    gEscapeFlowMaxIter = maxIter;
    var dx = (bounds[2] - bounds[0]) / size;
    var dy = (bounds[3] - bounds[1]) / size;
    for (var gy = 0; gy < size; gy++) {
        var py = bounds[1] + (gy + 0.5) * dy;
        for (var gx = 0; gx < size; gx++) {
            var px = bounds[0] + (gx + 0.5) * dx;
            if (fracType === 'julia') {
                grid[gy * size + gx] = smoothEscapeJulia(px, py, params[0], params[1], maxIter);
            } else {
                grid[gy * size + gx] = smoothEscapeMandelbrot(px, py, maxIter);
            }
        }
    }

    blurGrid(grid, size, 3);

    var minEsc = maxIter, maxEsc = 0;
    var sum = 0, count = 0;
    for (var i = 0; i < grid.length; i++) {
        var v = grid[i];
        if (v > 2 && v < maxIter - 1) {
            sum += v;
            count++;
            if (v < minEsc) minEsc = v;
            if (v > maxEsc) maxEsc = v;
        }
    }
    gEscapeFlowTargetIter = count > 0 ? sum / count : maxIter * 0.5;
    gEscapeFlowMinEsc = count > 0 ? minEsc : 2;
    gEscapeFlowMaxEsc = count > 0 ? maxEsc : maxIter;

    return grid;
}

function sampleEscapeGrid(x, y) {
    var bounds = gEscapeFlowGridBounds;
    var size = gEscapeFlowGridSize;
    var fx = (x - bounds[0]) / (bounds[2] - bounds[0]) * size - 0.5;
    var fy = (y - bounds[1]) / (bounds[3] - bounds[1]) * size - 0.5;
    var ix = Math.floor(fx), iy = Math.floor(fy);
    if (ix < 0 || ix >= size - 1 || iy < 0 || iy >= size - 1) return -1;
    var tx = fx - ix, ty = fy - iy;
    var idx = iy * size + ix;
    var v00 = gEscapeFlowGrid[idx];
    var v10 = gEscapeFlowGrid[idx + 1];
    var v01 = gEscapeFlowGrid[idx + size];
    var v11 = gEscapeFlowGrid[idx + size + 1];
    return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
}

function escapeFlowIterate(x, y, params, fracType) {
    var bounds = gEscapeFlowGridBounds;
    var bw = bounds[2] - bounds[0], bh = bounds[3] - bounds[1];
    var maxIter = gEscapeFlowMaxIter;
    var gridPixel = Math.max(bw, bh) / gEscapeFlowGridSize;
    var eps = gridPixel * 1.5;

    var iterHere = sampleEscapeGrid(x, y);
    if (iterHere < 0 || iterHere <= 2 || iterHere >= maxIter - 2) {
        return [bounds[0] + Math.random() * bw, bounds[1] + Math.random() * bh];
    }

    var iterR = sampleEscapeGrid(x + eps, y);
    var iterL = sampleEscapeGrid(x - eps, y);
    var iterU = sampleEscapeGrid(x, y + eps);
    var iterD = sampleEscapeGrid(x, y - eps);
    if (iterR < 0) iterR = iterHere;
    if (iterL < 0) iterL = iterHere;
    if (iterU < 0) iterU = iterHere;
    if (iterD < 0) iterD = iterHere;

    var gx = (iterR - iterL) / (2 * eps);
    var gy = (iterU - iterD) / (2 * eps);

    var gradMag = Math.sqrt(gx * gx + gy * gy);
    if (gradMag < 1e-8) {
        return [bounds[0] + Math.random() * bw, bounds[1] + Math.random() * bh];
    }
    var perpX = -gy / gradMag;
    var perpY = gx / gradMag;

    var speed = gridPixel * 0.4;
    var nx = x + perpX * speed;
    var ny = y + perpY * speed;

    if (!isFinite(nx) || !isFinite(ny)) {
        return [bounds[0] + Math.random() * bw, bounds[1] + Math.random() * bh];
    }

    if (nx < bounds[0] || nx > bounds[2] || ny < bounds[1] || ny > bounds[3]) {
        return [bounds[0] + Math.random() * bw, bounds[1] + Math.random() * bh];
    }

    var newIter = sampleEscapeGrid(nx, ny);
    if (newIter < 0 || newIter <= 2 || newIter >= maxIter - 2) {
        return [bounds[0] + Math.random() * bw, bounds[1] + Math.random() * bh];
    }

    return [nx, ny];
}

function lorenz2dIterate(x, y, z, params) {
    var sigma = params[0], rho = params[1], beta = params[2], dt = params[3];
    var dx = sigma * (y - x);
    var dy = x * (rho - z) - y;
    var dz = x * y - beta * z;
    var nx = x + dx * dt;
    var ny = y + dy * dt;
    var nz = z + dz * dt;
    if (!isFinite(nx) || !isFinite(ny) || !isFinite(nz)) return [0, 0, 0];
    if (nx > 50) nx = 50; else if (nx < -50) nx = -50;
    if (ny > 50) ny = 50; else if (ny < -50) ny = -50;
    if (nz > 80) nz = 80; else if (nz < -10) nz = -10;
    return [nx, ny, nz];
}

function rosslerIterate(x, y, z, params) {
    var a = params[0], b = params[1], c = params[2], dt = params[3];
    var dx = -y - z;
    var dy = x + a * y;
    var dz = b + z * (x - c);
    var nx = x + dx * dt;
    var ny = y + dy * dt;
    var nz = z + dz * dt;
    if (!isFinite(nx) || !isFinite(ny) || !isFinite(nz)) return [0, 0, 0];
    if (nx > 40) nx = 40; else if (nx < -40) nx = -40;
    if (ny > 40) ny = 40; else if (ny < -40) ny = -40;
    if (nz > 60) nz = 60; else if (nz < -5) nz = -5;
    return [nx, ny, nz];
}

function thomasIterate(x, y, z, params) {
    var b = params[0], dt = params[1];
    var dx = Math.sin(y) - b * x;
    var dy = Math.sin(z) - b * y;
    var dz = Math.sin(x) - b * z;
    var nx = x + dx * dt;
    var ny = y + dy * dt;
    var nz = z + dz * dt;
    if (!isFinite(nx) || !isFinite(ny) || !isFinite(nz)) return [0, 0, 0];
    if (nx > 6) nx = 6; else if (nx < -6) nx = -6;
    if (ny > 6) ny = 6; else if (ny < -6) ny = -6;
    if (nz > 6) nz = 6; else if (nz < -6) nz = -6;
    return [nx, ny, nz];
}

function halvorsenIterate(x, y, z, params) {
    var a = params[0], dt = params[1];
    var dx = -a * x - 4 * y - 4 * z - y * y;
    var dy = -a * y - 4 * z - 4 * x - z * z;
    var dz = -a * z - 4 * x - 4 * y - x * x;
    var nx = x + dx * dt;
    var ny = y + dy * dt;
    var nz = z + dz * dt;
    if (!isFinite(nx) || !isFinite(ny) || !isFinite(nz)) return [0, 0, 0];
    if (nx > 20) nx = 20; else if (nx < -20) nx = -20;
    if (ny > 20) ny = 20; else if (ny < -20) ny = -20;
    if (nz > 20) nz = 20; else if (nz < -20) nz = -20;
    return [nx, ny, nz];
}

function aizawaIterate(x, y, z, params) {
    var a = params[0], b = params[1], c = params[2], dt = params[3];
    var d = 3.5, e = 0.25, f = 0.1;
    var dx = (z - b) * x - d * y;
    var dy = d * x + (z - b) * y;
    var dz = c + a * z - z * z * z / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
    var nx = x + dx * dt;
    var ny = y + dy * dt;
    var nz = z + dz * dt;
    if (!isFinite(nx) || !isFinite(ny) || !isFinite(nz)) return [0, 0, 0];
    if (nx > 4) nx = 4; else if (nx < -4) nx = -4;
    if (ny > 4) ny = 4; else if (ny < -4) ny = -4;
    if (nz > 4) nz = 4; else if (nz < -4) nz = -4;
    return [nx, ny, nz];
}

function nosehooverIterate(x, y, z, params) {
    var a = params[0], dt = params[1];
    var dx = y;
    var dy = -x + y * z;
    var dz = a - y * y;
    var nx = x + dx * dt;
    var ny = y + dy * dt;
    var nz = z + dz * dt;
    if (!isFinite(nx) || !isFinite(ny) || !isFinite(nz)) return [0, 0, 0];
    if (nx > 10) nx = 10; else if (nx < -10) nx = -10;
    if (ny > 10) ny = 10; else if (ny < -10) ny = -10;
    if (nz > 10) nz = 10; else if (nz < -10) nz = -10;
    return [nx, ny, nz];
}

var gLorenzZState = null;

function resetAttractorState() {
    if (gParSys) {
        gParSys.initAttractorState();
    }
    var n = gParSys ? gParSys._particles.length : 1000;
    var type = gFractalType;
    if ((type === 'julia' || type === 'mandelbrot') && gEscapeFlowEnabled) {
        gEscapeFlowValues = new Float32Array(n);
        var eb = gEscapeFlowGridBounds;
        var ebw = eb[2] - eb[0], ebh = eb[3] - eb[1];
        if (gParSys) for (var i = 0; i < gParSys._attractorState.length; i += 2) {
            gParSys._attractorState[i] = eb[0] + Math.random() * ebw;
            gParSys._attractorState[i + 1] = eb[1] + Math.random() * ebh;
        }
    }
    if (type === 'lorenz2d' || type === 'rossler' || type === 'thomas' || type === 'halvorsen' || type === 'aizawa' || type === 'nosehoover') {
        gLorenzZState = new Float64Array(n);
        if (type === 'lorenz2d') {
            for (var i = 0; i < n; i++) gLorenzZState[i] = (Math.random() - 0.5) * 0.2 + 25;
            if (gParSys) for (var i = 0; i < gParSys._attractorState.length; i += 2) {
                gParSys._attractorState[i] = (Math.random() - 0.5) * 2.0;
                gParSys._attractorState[i + 1] = (Math.random() - 0.5) * 2.0;
            }
        } else if (type === 'rossler') {
            for (var i = 0; i < n; i++) gLorenzZState[i] = (Math.random() - 0.5) * 4.0;
            if (gParSys) for (var i = 0; i < gParSys._attractorState.length; i += 2) {
                gParSys._attractorState[i] = (Math.random() - 0.5) * 20.0;
                gParSys._attractorState[i + 1] = (Math.random() - 0.5) * 20.0;
            }
        } else if (type === 'thomas') {
            for (var i = 0; i < n; i++) gLorenzZState[i] = (Math.random() - 0.5) * 4.0;
            if (gParSys) for (var i = 0; i < gParSys._attractorState.length; i += 2) {
                gParSys._attractorState[i] = (Math.random() - 0.5) * 4.0;
                gParSys._attractorState[i + 1] = (Math.random() - 0.5) * 4.0;
            }
        } else if (type === 'halvorsen') {
            for (var i = 0; i < n; i++) gLorenzZState[i] = (Math.random() - 0.5) * 4.0 - 5;
            if (gParSys) for (var i = 0; i < gParSys._attractorState.length; i += 2) {
                gParSys._attractorState[i] = (Math.random() - 0.5) * 8.0 - 2;
                gParSys._attractorState[i + 1] = (Math.random() - 0.5) * 8.0 - 2;
            }
        } else if (type === 'aizawa') {
            for (var i = 0; i < n; i++) gLorenzZState[i] = (Math.random() - 0.5) * 1.0;
            if (gParSys) for (var i = 0; i < gParSys._attractorState.length; i += 2) {
                gParSys._attractorState[i] = (Math.random() - 0.5) * 2.0;
                gParSys._attractorState[i + 1] = (Math.random() - 0.5) * 2.0;
            }
        } else if (type === 'nosehoover') {
            for (var i = 0; i < n; i++) gLorenzZState[i] = (Math.random() - 0.5) * 3.0;
            if (gParSys) for (var i = 0; i < gParSys._attractorState.length; i += 2) {
                gParSys._attractorState[i] = (Math.random() - 0.5) * 4.0;
                gParSys._attractorState[i + 1] = (Math.random() - 0.5) * 4.0;
            }
        }
    }
}

function randomizeAttractor() {
    var type = gFractalType;
    if (type === 'clifford') {
        gFractalParams = [
            (Math.random() * 4.0) - 2.0,
            (Math.random() * 4.0) - 2.0,
            (Math.random() * 2.0) + 0.5,
            (Math.random() * 2.0) + 0.5
        ];
    } else if (type === 'dejong') {
        gFractalParams = [
            (Math.random() * 2 * Math.PI) - Math.PI,
            (Math.random() * 2 * Math.PI) - Math.PI,
            (Math.random() * 2 * Math.PI) - Math.PI,
            (Math.random() * 2 * Math.PI) - Math.PI
        ];
    } else if (type === 'julia') {
        gFractalParams = [
            -1.0 + Math.random() * 1.5,
            -0.5 + Math.random() * 1.3,
            1.8 + Math.random() * 1.2,
            0
        ];
    } else if (type === 'mandelbrot') {
        gFractalParams = [
            -2.0 + Math.random() * 2.5,
            -1.5 + Math.random() * 3.0,
            2.0 + Math.random() * 1.5,
            0
        ];
    } else if (type === 'rossler') {
        gFractalParams = [
            0.1 + Math.random() * 0.3,
            0.1 + Math.random() * 0.3,
            3 + Math.random() * 12,
            0.01 + Math.random() * 0.03
        ];
    } else if (type === 'thomas') {
        gFractalParams = [
            0.15 + Math.random() * 0.1,
            0.02 + Math.random() * 0.06,
            0, 0
        ];
    } else if (type === 'halvorsen') {
        gFractalParams = [
            1.2 + Math.random() * 1.0,
            0.002 + Math.random() * 0.015,
            0, 0
        ];
    } else if (type === 'aizawa') {
        gFractalParams = [
            0.7 + Math.random() * 0.5,
            0.3 + Math.random() * 0.8,
            0.3 + Math.random() * 0.8,
            0.005 + Math.random() * 0.03
        ];
    } else if (type === 'nosehoover') {
        gFractalParams = [
            1.0 + Math.random() * 1.2,
            0.02 + Math.random() * 0.06,
            0, 0
        ];
    } else {
        gFractalParams = [
            8 + Math.random() * 6,
            20 + Math.random() * 15,
            2 + Math.random() * 2,
            0.005 + Math.random() * 0.01
        ];
    }
    var sliders = ['#rngFracA', '#rngFracB', '#rngFracC', '#rngFracD'];
    var labels = ['#lblFracA', '#lblFracB', '#lblFracC', '#lblFracD'];
    for (var i = 0; i < 4; i++) {
        $(sliders[i]).val(gFractalParams[i]);
        var prec = (type === 'lorenz2d' && i === 3) ? 3 : 2;
        $(labels[i]).text(gFractalParams[i].toFixed(prec));
    }
    if (gEscapeFlowEnabled && (type === 'julia' || type === 'mandelbrot')) {
        gEscapeFlowGrid = buildEscapeFlowGrid(type, gFractalParams);
    }
    resetAttractorState();
}

function sendFractalToEvolution() {
    var syntheticPreset = JSON.parse(JSON.stringify(gPreset));
    syntheticPreset.AttractorType = gFractalType;
    syntheticPreset.AttractorParams = gFractalParams.slice();
    syntheticPreset.AttractorBlend = gFractalBlend > 0 ? gFractalBlend : 0.8;
    switchLabTab('evolution');
    initEvolution(syntheticPreset);
}

//------------------------------------------------------------------------------
function testCube() {
    var cv = new PixelCanvas($("#world").get(0), 1024, 768);

    var world = new World3d([cv.width / 2, cv.height / 2], POINT3D_ZERO, ANGLE3D_ZERO, -(cv.width + cv.height) / 2, cv);
    var pSys = new ParticleSystem(world, 10000);
    pSys.rotationSpeed3d = [5, 5, 5];

    pSys.renderMode = ParticleRenderMode.rmDrawStars
    world.addObject(pSys);

    pSys.makeTestCube(200, null);

    intervalID = setInterval(function () {
        cv.vis2Data();
        world.doWorld();
        cv.data2Vis();
    }, 10)
}

function selectPreset(aName) {
    gPreset = JSON.parse(JSON.stringify(g_psss_presets[aName]));  // deep copy preset

    applyPreset();
}

var gUseWebGL = false;

function applyPreset() {
    if (gUseWebGL) {
        gCanvas = new WebGLRenderer($("#world").get(0), gWidth, gHeight);
        if (gFxPalette !== 'none') {
            gCanvas.uploadPalette(PALETTES[gFxPalette]);
        }
    } else {
        gCanvas = new PixelCanvas($("#world").get(0), gWidth, gHeight);
    }
    gTransMap = new TranslationMap(gWidth, gHeight);

    gWorld = new World3d([gCanvas.width / 2, gCanvas.height / 2], POINT3D_ZERO, ANGLE3D_ZERO, -(gCanvas.width + gCanvas.height) / 2, gCanvas);

    gParSys = new ParticleWaves(gWorld, gPreset.ParticleCount * 5);

    gCanvas.brightness = gPreset.MotionBlur / 8.1;
    gCanvas.blurradius = gPreset.SmoothFilter ? 1 : 0;

    gParSys.applyPreset(gPreset);

    if (gFractalBlend > 0) {
        resetAttractorState();
    }

    gTransMapStyle = gPreset.TransMapStyle;
    gTransMapFilter = gPreset.TransMapFilter;
    gTransMapMode = gPreset.TransMapMode;

    calcTransMap();

    gWorld.addObject(gParSys);

    if(gRequestID) {
        window.cancelAnimationFrame(gRequestID);
        gRequestID=undefined;
    }
    gRequestID=window.requestAnimationFrame(drawFrame);
}

//------------------------------------------------------------------------------
// Lab Panel: Evolution Gallery
//------------------------------------------------------------------------------

function EvoTile(canvas, preset, label, lineage) {
    this.canvas = canvas;
    this.preset = JSON.parse(JSON.stringify(preset));
    this.preset.ParticleCount = Math.max(100, Math.round(this.preset.ParticleCount / 4));
    this.label = label || '';
    this.lineage = lineage || [];
    this.pixelCanvas = null;
    this.world = null;
    this.parSys = null;
    this.transMap = null;
    this.requestID = null;
    this.selected = false;
    this.lastFrameTime = 0;
}

EvoTile.prototype.init = function () {
    var cv = this.canvas;
    var w = cv.width;
    var h = cv.height;
    var p = this.preset;

    this.pixelCanvas = new PixelCanvas(cv, w, h);
    this.pixelCanvas.brightness = p.MotionBlur / 8.1;
    this.pixelCanvas.blurradius = p.SmoothFilter ? 1 : 0;

    this.transMap = new TranslationMap(w, h);
    this.calcTileTransMap();

    this.world = new World3d(
        [w / 2, h / 2], POINT3D_ZERO, ANGLE3D_ZERO,
        -(w + h) / 2, this.pixelCanvas
    );

    this.parSys = new ParticleWaves(this.world, p.ParticleCount * 5);
    this.parSys.applyPreset(p);
    if (p.AttractorParams) {
        this.parSys._fractalTypeOverride = p.AttractorType || 'clifford';
        this.parSys._fractalParamsOverride = p.AttractorParams.slice();
        this.parSys._fractalBlendOverride = p.AttractorBlend !== undefined ? p.AttractorBlend : 0.8;
    }
    this.world.addObject(this.parSys);
};

EvoTile.prototype.calcTileTransMap = function () {
    var p = this.preset;
    var w = this.transMap.width;
    var h = this.transMap.height;
    var rawParams = p.SinMagicParams || [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    var rawParams2 = p.SinMagicParams2 || [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    var style = p.TransMapStyle || 0;
    var cx = (p.ZoomCenterX || 50) * w / 100;
    var cy = (p.ZoomCenterY || 50) * h / 100;

    switch (style) {
        case TransMapStyle.tmsWaved: {
            var sinMagic = JSON.parse(JSON.stringify(rawParams));
            for (var n = 0; n < MAX_SIN_MAGIC; n++) {
                sinMagic[0][n] = (sinMagic[0][n] * w) / 100;
                sinMagic[2][n] = (sinMagic[2][n] * h) / 100;
            }
            this.transMap.sinMagic(sinMagic);
            break;
        }
        case TransMapStyle.tmsWavedZoom:
            this.transMap.sinMagicZoom(rawParams, cx, cy, false);
            break;
        case TransMapStyle.tmsWavedZoomOverlay:
            this.transMap.sinMagicZoom(rawParams, cx, cy, true);
            break;
        case TransMapStyle.tmsWavedZoomCombined:
            this.transMap.sinMagicZoom2(rawParams, rawParams2, cx, cy);
            break;
    }
};

EvoTile.prototype.start = function () {
    var self = this;
    function frame(ts) {
        var elapsed = ts - self.lastFrameTime;
        if (elapsed < 66) { // ~15fps
            self.requestID = window.requestAnimationFrame(frame);
            return;
        }
        self.lastFrameTime = ts;
        self.drawFrame();
        self.requestID = window.requestAnimationFrame(frame);
    }
    this.requestID = window.requestAnimationFrame(frame);
};

EvoTile.prototype.stop = function () {
    if (this.requestID) {
        window.cancelAnimationFrame(this.requestID);
        this.requestID = null;
    }
};

EvoTile.prototype.destroy = function () {
    this.stop();
    this.pixelCanvas = null;
    this.world = null;
    this.parSys = null;
    this.transMap = null;
};

EvoTile.prototype.drawFrame = function () {
    if (!this.pixelCanvas || !this.world) return;
    this.pixelCanvas.vis2Data();
    var p = this.preset;
    if (p.TransMapFilter) {
        if (p.TransMapMode) {
            var idSrc = this.pixelCanvas.copyImageData();
            this.transMap.applyTransMap(idSrc.data, this.pixelCanvas.ImgData.data);
            this.world.doWorld();
        } else {
            this.world.doWorld();
            var idSrc2 = this.pixelCanvas.copyImageData();
            this.transMap.applyTransMap(idSrc2.data, this.pixelCanvas.ImgData.data);
        }
    } else {
        this.world.doWorld();
    }
    this.pixelCanvas.data2Vis();
};

function mutatePreset(preset) {
    var result = JSON.parse(JSON.stringify(preset));
    var sigma = 0.10;

    function gaussRand() {
        var u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function jitter(val, min, max) {
        var nv = val + val * gaussRand() * sigma;
        if (nv < min) nv = min;
        if (nv > max) nv = max;
        return nv;
    }

    // Jitter (100%)
    for (var n = 0; n < MAX_WAVE_CNT; n++) {
        for (var i = 0; i < AXIS_CNT; i++) {
            result.Waves[n][i].Phase = jitter(result.Waves[n][i].Phase, 0, 360);
            result.Waves[n][i].Am.Base = jitter(result.Waves[n][i].Am.Base, 0, 100);
            result.Waves[n][i].Am.Amp = jitter(result.Waves[n][i].Am.Amp, 0, 100);
            result.Waves[n][i].Am.Freq = jitter(result.Waves[n][i].Am.Freq, 0, 50);
            result.Waves[n][i].Fm.Base = jitter(result.Waves[n][i].Fm.Base, 0, 1000);
            result.Waves[n][i].Fm.Amp = jitter(result.Waves[n][i].Fm.Amp, 0, 500);
            result.Waves[n][i].Fm.Freq = jitter(result.Waves[n][i].Fm.Freq, 0, 50);
        }
    }
    for (var c = 0; c < 3; c++) {
        result.ColorBase[c] = jitter(result.ColorBase[c], 0, 255);
        result.ColorAmp[c] = jitter(result.ColorAmp[c], 0, 255);
    }
    result.WaveSpeed = jitter(result.WaveSpeed, 0.001, 0.5);

    // Wave swap (30%)
    if (Math.random() < 0.3) {
        var wn = Math.floor(Math.random() * MAX_WAVE_CNT);
        var axA = Math.floor(Math.random() * AXIS_CNT);
        var axB = (axA + 1 + Math.floor(Math.random() * 2)) % AXIS_CNT;
        var tmp = result.Waves[wn][axA];
        result.Waves[wn][axA] = result.Waves[wn][axB];
        result.Waves[wn][axB] = tmp;
    }

    // Style jump (10%)
    if (Math.random() < 0.1) {
        result.TransMapStyle = Math.floor(Math.random() * 4);
    }

    // Frequency doubling/halving (15%)
    if (Math.random() < 0.15) {
        var wn2 = Math.floor(Math.random() * MAX_WAVE_CNT);
        var ax2 = Math.floor(Math.random() * AXIS_CNT);
        if (Math.random() < 0.5) {
            result.Waves[wn2][ax2].Fm.Base *= 2;
        } else {
            result.Waves[wn2][ax2].Fm.Base = Math.max(1, result.Waves[wn2][ax2].Fm.Base / 2);
        }
    }

    // Phase rotation (20%)
    if (Math.random() < 0.2) {
        var wn3 = Math.floor(Math.random() * MAX_WAVE_CNT);
        var offset = [30, 60, 90][Math.floor(Math.random() * 3)];
        for (var ax3 = 0; ax3 < AXIS_CNT; ax3++) {
            result.Waves[wn3][ax3].Phase = (result.Waves[wn3][ax3].Phase + offset) % 360;
        }
    }

    // Attractor parameter mutation (when present)
    if (result.AttractorParams) {
        var atSigma = 0.15;
        var atTypes = ['clifford', 'dejong', 'lorenz2d'];
        var atRanges = {
            clifford: [[-3,3],[-3,3],[-3,3],[-3,3]],
            dejong: [[-3.14159,3.14159],[-3.14159,3.14159],[-3.14159,3.14159],[-3.14159,3.14159]],
            lorenz2d: [[1,20],[10,40],[0.5,5],[0.001,0.03]],
            julia: [[-2,2],[-2,2],[1.5,4],[0,0]],
            mandelbrot: [[-2.5,1],[-2,2],[2,4],[0,0]],
            rossler: [[0.1,0.5],[0.1,0.5],[2,18],[0.005,0.05]],
            thomas: [[0.1,0.3],[0.01,0.1],[0,0],[0,0]],
            halvorsen: [[1.0,2.5],[0.001,0.02],[0,0],[0,0]],
            aizawa: [[0.5,1.5],[0.1,1.5],[0.1,1.5],[0.005,0.05]],
            nosehoover: [[1.0,2.5],[0.01,0.1],[0,0],[0,0]]
        };
        var ranges = atRanges[result.AttractorType || 'clifford'];
        for (var ai = 0; ai < 4; ai++) {
            var av = result.AttractorParams[ai];
            av = av + av * gaussRand() * atSigma;
            if (av < ranges[ai][0]) av = ranges[ai][0];
            if (av > ranges[ai][1]) av = ranges[ai][1];
            result.AttractorParams[ai] = av;
        }
        if (Math.random() < 0.1) {
            var newType = atTypes[Math.floor(Math.random() * atTypes.length)];
            if (newType !== result.AttractorType) {
                result.AttractorType = newType;
                var newRanges = atRanges[newType];
                for (var ri = 0; ri < 4; ri++) {
                    result.AttractorParams[ri] = newRanges[ri][0] + Math.random() * (newRanges[ri][1] - newRanges[ri][0]);
                }
            }
        }
    }

    return result;
}

function crossoverPresets(parentA, parentB, t) {
    var child = JSON.parse(JSON.stringify(parentA));
    // Interpolation for non-wave fields
    child.WaveSpeed = parentA.WaveSpeed + (parentB.WaveSpeed - parentA.WaveSpeed) * t;
    child.MotionBlur = Math.round(parentA.MotionBlur + (parentB.MotionBlur - parentA.MotionBlur) * t);
    for (var c = 0; c < 3; c++) {
        child.ColorBase[c] = Math.round(parentA.ColorBase[c] + (parentB.ColorBase[c] - parentA.ColorBase[c]) * t);
        child.ColorAmp[c] = Math.round(parentA.ColorAmp[c] + (parentB.ColorAmp[c] - parentA.ColorAmp[c]) * t);
        child.ColorFreq[c] = parentA.ColorFreq[c] + (parentB.ColorFreq[c] - parentA.ColorFreq[c]) * t;
        child.Rotation[c] = parentA.Rotation[c] + (parentB.Rotation[c] - parentA.Rotation[c]) * t;
    }
    // Wave-level crossover: randomly pick each wave from parent A or B
    for (var n = 0; n < MAX_WAVE_CNT; n++) {
        if (Math.random() > 0.5) {
            child.Waves[n] = JSON.parse(JSON.stringify(parentB.Waves[n]));
        }
    }
    // TransMap from one parent randomly
    if (Math.random() > 0.5) {
        child.TransMapFilter = parentB.TransMapFilter;
        child.TransMapStyle = parentB.TransMapStyle;
        if (parentB.SinMagicParams) child.SinMagicParams = JSON.parse(JSON.stringify(parentB.SinMagicParams));
        if (parentB.SinMagicParams2) child.SinMagicParams2 = JSON.parse(JSON.stringify(parentB.SinMagicParams2));
    }
    // Attractor crossover
    var atParent = (parentA.AttractorParams || parentB.AttractorParams) ?
        (Math.random() > 0.5 ? parentB : parentA) : null;
    if (atParent && atParent.AttractorParams) {
        child.AttractorType = atParent.AttractorType;
        child.AttractorParams = atParent.AttractorParams.slice();
        child.AttractorBlend = parentA.AttractorBlend !== undefined && parentB.AttractorBlend !== undefined ?
            parentA.AttractorBlend + (parentB.AttractorBlend - parentA.AttractorBlend) * t :
            (atParent.AttractorBlend || 0.8);
    }
    return child;
}

function initEvolution(seedPreset) {
    destroyEvolution();
    gEvoState.seedPreset = JSON.parse(JSON.stringify(seedPreset));
    gEvoState.generation = 1;
    gEvoState.selected = [];
    gEvoState.tiles = [];

    var labels = ['A','B','C','D','E','F','G','H','I'];
    var tileDivs = document.querySelectorAll('#pnlEvoGrid .evo-tile');

    for (var i = 0; i < 9; i++) {
        var mutated = mutatePreset(seedPreset);
        var canvas = tileDivs[i].querySelector('canvas');
        var tile = new EvoTile(canvas, mutated, labels[i], ['Seed']);
        tile.init();
        tile.start();
        gEvoState.tiles.push(tile);
        tileDivs[i].classList.remove('selected');
    }

    gEvoState.active = true;
    document.getElementById('pnlMainView').style.display = 'none';
    document.getElementById('pnlEvoGrid').style.display = 'grid';
    updateEvoUI();
}

function breedGeneration() {
    if (gEvoState.selected.length === 0) return;

    var parents = gEvoState.selected.map(function (idx) {
        return gEvoState.tiles[idx].preset;
    });
    var parentLabels = gEvoState.selected.map(function (idx) {
        return 'G' + gEvoState.generation + '.' + gEvoState.tiles[idx].label;
    });

    var offspring = [];
    var labels = ['A','B','C','D','E','F','G','H','I'];

    if (parents.length === 1) {
        for (var i = 0; i < 9; i++) {
            offspring.push(mutatePreset(parents[0]));
        }
    } else if (parents.length === 2) {
        // 3 interpolations + 3 wave crossovers + 3 random mix
        for (var t = 0; t < 3; t++) {
            var interp = crossoverPresets(parents[0], parents[1], 0.33 + t * 0.17);
            offspring.push(mutatePreset(interp));
        }
        for (var w = 0; w < 3; w++) {
            var xo = crossoverPresets(parents[0], parents[1], 0.5);
            offspring.push(mutatePreset(xo));
        }
        for (var r = 0; r < 3; r++) {
            var mix = crossoverPresets(parents[Math.random() > 0.5 ? 0 : 1], parents[Math.random() > 0.5 ? 0 : 1], Math.random());
            offspring.push(mutatePreset(mix));
        }
    } else {
        // 3 parents: pairwise + three-way + random
        offspring.push(mutatePreset(crossoverPresets(parents[0], parents[1], 0.5)));
        offspring.push(mutatePreset(crossoverPresets(parents[1], parents[2], 0.5)));
        offspring.push(mutatePreset(crossoverPresets(parents[0], parents[2], 0.5)));
        for (var tw = 0; tw < 3; tw++) {
            var base = crossoverPresets(parents[0], parents[1], 0.33);
            var threeway = crossoverPresets(base, parents[2], 0.33);
            offspring.push(mutatePreset(threeway));
        }
        for (var rx = 0; rx < 3; rx++) {
            var rp = parents[Math.floor(Math.random() * 3)];
            var rp2 = parents[Math.floor(Math.random() * 3)];
            offspring.push(mutatePreset(crossoverPresets(rp, rp2, Math.random())));
        }
    }

    // Stop old tiles
    for (var s = 0; s < gEvoState.tiles.length; s++) {
        gEvoState.tiles[s].destroy();
    }

    gEvoState.generation++;
    gEvoState.selected = [];
    gEvoState.tiles = [];

    var tileDivs = document.querySelectorAll('#pnlEvoGrid .evo-tile');
    for (var j = 0; j < 9; j++) {
        var canvas = tileDivs[j].querySelector('canvas');
        var tile = new EvoTile(canvas, offspring[j], labels[j], parentLabels);
        tile.init();
        tile.start();
        gEvoState.tiles.push(tile);
        tileDivs[j].classList.remove('selected');
    }

    updateEvoUI();
}

function pauseEvolution() {
    for (var i = 0; i < gEvoState.tiles.length; i++) {
        gEvoState.tiles[i].stop();
    }
}

function destroyEvolution() {
    for (var i = 0; i < gEvoState.tiles.length; i++) {
        gEvoState.tiles[i].destroy();
    }
    gEvoState.tiles = [];
}

function hideEvoGrid() {
    document.getElementById('pnlEvoGrid').style.display = 'none';
    document.getElementById('pnlMainView').style.display = '';
}

function resumeEvolution() {
    if (gEvoState.tiles.length === 0) return;
    document.getElementById('pnlMainView').style.display = 'none';
    document.getElementById('pnlEvoGrid').style.display = 'grid';
    for (var i = 0; i < gEvoState.tiles.length; i++) {
        gEvoState.tiles[i].start();
    }
}

function evoSelectTile(index) {
    if (index < 0 || index >= gEvoState.tiles.length) return;
    var tile = gEvoState.tiles[index];
    var tileDiv = document.querySelectorAll('#pnlEvoGrid .evo-tile')[index];

    if (tile.selected) {
        tile.selected = false;
        tileDiv.classList.remove('selected');
        gEvoState.selected = gEvoState.selected.filter(function (i) { return i !== index; });
    } else {
        if (gEvoState.selected.length >= 3) return;
        tile.selected = true;
        tileDiv.classList.add('selected');
        gEvoState.selected.push(index);
    }
    updateEvoUI();
}

function updateEvoUI() {
    document.getElementById('lblEvoGeneration').textContent = gEvoState.generation;
    document.getElementById('lblEvoSelected').textContent = gEvoState.selected.length;
    var breedBtn = document.getElementById('cmdEvoBreed');
    if (breedBtn) breedBtn.disabled = gEvoState.selected.length === 0;

    var lineageText = '';
    if (gEvoState.selected.length > 0) {
        var lastIdx = gEvoState.selected[gEvoState.selected.length - 1];
        var tile = gEvoState.tiles[lastIdx];
        if (tile) lineageText = tile.label + ': ' + tile.lineage.join(' > ');
    }
    document.getElementById('lblEvoLineage').textContent = lineageText;
}

//------------------------------------------------------------------------------
// Lab Panel: Tabs, Morphing Slider Board, Interpolation, Randomization, Snapshots, Export
//------------------------------------------------------------------------------

function switchLabTab(tabId) {
    var prevTab = gLabActiveTab;
    gLabActiveTab = tabId;
    $('.lab-tab-content').hide();
    $('.lab-tab').removeClass('active');
    $('#tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)).show();
    $('.lab-tab[data-tab="' + tabId + '"]').addClass('active');

    if (prevTab === 'evolution' && tabId !== 'evolution') {
        pauseEvolution();
        hideEvoGrid();
        gEvoState.active = false;
        if (!gRequestID) {
            gRequestID = window.requestAnimationFrame(drawFrame);
        }
    }

    if (tabId === 'evolution' && prevTab !== 'evolution') {
        gLabDirty = false;
        $('#lblLabDirty').hide();
        if (gRequestID) {
            window.cancelAnimationFrame(gRequestID);
            gRequestID = undefined;
        }
        if (gEvoState.tiles.length > 0) {
            gEvoState.active = true;
            resumeEvolution();
        } else {
            document.getElementById('pnlMainView').style.display = 'none';
            document.getElementById('pnlEvoGrid').style.display = 'grid';
            gEvoState.active = true;
        }
    }
}

// --- Archetype Templates ---

var ARCHETYPES = [
    {
        id: 'flowing-ribbon', label: 'Flowing Ribbon',
        basePresets: ['Asymetry', 'Barrock', 'Birth Of Venus', 'Bermuda Twister'],
        lockedParams: { TransMapFilter: true, TransMapStyle: 0, RenderMode: 2 },
        sliders: [
            { id: 'flow-intensity', label: 'Flow Intensity',
              forward: function(p, v) { if (p.SinMagicParams) for (var i=0;i<4;i++) for (var j=0;j<4;j++) p.SinMagicParams[i][j] *= (0.2 + v * 1.8); },
              reverse: function(p) { if (!p.SinMagicParams) return 0.3; var s=0; for (var i=0;i<4;i++) for (var j=0;j<4;j++) s+=Math.abs(p.SinMagicParams[i][j]); return Math.min(1, s/50); }
            },
            { id: 'trail-length', label: 'Trail Length',
              forward: function(p, v) { p.MotionBlur = Math.round(4 + 4 * v); },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.MotionBlur - 4) / 4)); }
            },
            { id: 'wave-width', label: 'Wave Width',
              forward: function(p, v) { for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++) p.Waves[n][i].Am.Base = 10 + 50 * v; },
              reverse: function(p) { var s=0,c=0; for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++){s+=p.Waves[n][i].Am.Base;c++;} return Math.min(1,Math.max(0,(s/c-10)/50)); }
            },
            { id: 'drift-speed', label: 'Drift Speed',
              forward: function(p, v) { p.WaveSpeed = 0.01 + 0.09 * v; },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.WaveSpeed - 0.01) / 0.09)); }
            },
            { id: 'color-mood', label: 'Color Mood',
              forward: function(p, v) { p.ColorBase[0]=Math.round(50+200*v); p.ColorBase[2]=Math.round(250-200*v); p.ColorBase[1]=Math.round(80+80*(1-Math.abs(v-0.5)*2)); },
              reverse: function(p) { var r=p.ColorBase[0]||0,b=p.ColorBase[2]||0; return (r+b===0)?0.5:Math.min(1,Math.max(0,r/(r+b))); }
            }
        ]
    },
    {
        id: 'organic-cloud', label: 'Organic Cloud',
        basePresets: ['Aliens DNA', 'Andromeda', 'Aurora Borealis II', 'Behind A Glass Window'],
        lockedParams: { RenderMode: 2 },
        sliders: [
            { id: 'complexity', label: 'Complexity',
              forward: function(p, v) { for (var n=1;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++) { p.Waves[n][i].Fm.Base = p.Waves[n][i].Fm.Base * (0.3 + v * 1.4); p.Waves[n][i].Am.Amp *= (v > 0.3 ? 1 : 0); } },
              reverse: function(p) { var s=0; for (var n=1;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++) s+=p.Waves[n][i].Fm.Base; return Math.min(1, s/600); }
            },
            { id: 'breathing', label: 'Breathing',
              forward: function(p, v) { for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++) p.Waves[n][i].Am.Amp = 50 * v; },
              reverse: function(p) { var s=0,c=0; for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++){s+=p.Waves[n][i].Am.Amp;c++;} return Math.min(1,(s/c)/50); }
            },
            { id: 'density', label: 'Density',
              forward: function(p, v) { p.ParticleCount = Math.round((1000 + 7000 * v) / 100) * 100; },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.ParticleCount - 1000) / 7000)); }
            },
            { id: 'speed', label: 'Speed',
              forward: function(p, v) { p.WaveSpeed = 0.01 + 0.14 * v; },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.WaveSpeed - 0.01) / 0.14)); }
            },
            { id: 'vibrancy', label: 'Color Vibrancy',
              forward: function(p, v) { for (var c=0;c<3;c++) p.ColorAmp[c] = Math.round(50 + 150 * v); },
              reverse: function(p) { var s=0; for (var c=0;c<3;c++) s+=p.ColorAmp[c]; return Math.min(1,Math.max(0,(s/3-50)/150)); }
            }
        ]
    },
    {
        id: 'vortex-tunnel', label: 'Vortex Tunnel',
        basePresets: ['Dancing Elphes', 'Eternal Fire', 'Flight Into Energy', 'Hades On Fire'],
        lockedParams: { TransMapFilter: true, RenderMode: 2 },
        sliders: [
            { id: 'tunnel-depth', label: 'Tunnel Depth',
              forward: function(p, v) { for (var n=0;n<MAX_WAVE_CNT;n++) p.Waves[n][2].Am.Base = 10 + 70 * v; },
              reverse: function(p) { var s=0; for (var n=0;n<MAX_WAVE_CNT;n++) s+=p.Waves[n][2].Am.Base; return Math.min(1,Math.max(0,(s/MAX_WAVE_CNT-10)/70)); }
            },
            { id: 'spiral-tightness', label: 'Spiral Tightness',
              forward: function(p, v) { for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++) p.Waves[n][i].Fm.Base = 50 + 250 * v; },
              reverse: function(p) { var s=0,c=0; for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++){s+=p.Waves[n][i].Fm.Base;c++;} return Math.min(1,Math.max(0,(s/c-50)/250)); }
            },
            { id: 'zoom-intensity', label: 'Zoom Intensity',
              forward: function(p, v) { if (p.SinMagicParams) for (var i=0;i<4;i++) for (var j=0;j<4;j++) p.SinMagicParams[i][j] *= (0.3 + v * 1.7); },
              reverse: function(p) { if (!p.SinMagicParams) return 0.3; var s=0; for (var i=0;i<4;i++) for (var j=0;j<4;j++) s+=Math.abs(p.SinMagicParams[i][j]); return Math.min(1,s/80); }
            },
            { id: 'speed', label: 'Speed',
              forward: function(p, v) { p.WaveSpeed = 0.02 + 0.10 * v; },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.WaveSpeed - 0.02) / 0.10)); }
            },
            { id: 'glow', label: 'Glow',
              forward: function(p, v) { p.MotionBlur = Math.round(5 + 3 * v); },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.MotionBlur - 5) / 3)); }
            }
        ]
    },
    {
        id: 'geometric-clean', label: 'Geometric',
        basePresets: ['Alpha Particles', 'Argus', 'Birds Flying', 'Bors dream'],
        lockedParams: { TransMapFilter: false, RenderMode: 2 },
        sliders: [
            { id: 'figure-size', label: 'Figure Size',
              forward: function(p, v) { for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++) p.Waves[n][i].Am.Base = 10 + 60 * v; },
              reverse: function(p) { var s=0,c=0; for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<AXIS_CNT;i++){s+=p.Waves[n][i].Am.Base;c++;} return Math.min(1,Math.max(0,(s/c-10)/60)); }
            },
            { id: 'symmetry', label: 'Symmetry',
              forward: function(p, v) { var step=90*v; for (var n=0;n<MAX_WAVE_CNT;n++){p.Waves[n][1].Phase=p.Waves[n][0].Phase+step; p.Waves[n][2].Phase=p.Waves[n][0].Phase+step*2;} },
              reverse: function(p) { var d=0,c=0; for (var n=0;n<MAX_WAVE_CNT;n++){d+=Math.abs(((p.Waves[n][1].Phase-p.Waves[n][0].Phase)%360+360)%360-90);c++;} return Math.max(0,1-d/(c*90)); }
            },
            { id: 'dot-count', label: 'Dot Count',
              forward: function(p, v) { p.ParticleCount = Math.round((500 + 4500 * v) / 100) * 100; },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.ParticleCount - 500) / 4500)); }
            },
            { id: 'rotation', label: 'Rotation',
              forward: function(p, v) { for (var r=0;r<3;r++) p.Rotation[r] = 3 * v; },
              reverse: function(p) { var m=Math.max(Math.abs(p.Rotation[0]),Math.abs(p.Rotation[1]),Math.abs(p.Rotation[2])); return Math.min(1,m/3); }
            },
            { id: 'color-shift', label: 'Color Shift',
              forward: function(p, v) { for (var c=0;c<3;c++) p.ColorFreq[c] = 5 * v; },
              reverse: function(p) { var s=0; for (var c=0;c<3;c++) s+=p.ColorFreq[c]; return Math.min(1,(s/3)/5); }
            }
        ]
    },
    {
        id: 'warped-surface', label: 'Warped Surface',
        basePresets: ['Anima Electrica', 'Blue Planes', 'Borg Cube'],
        lockedParams: { TransMapFilter: true, RenderMode: 2 },
        sliders: [
            { id: 'warp-strength', label: 'Warp Strength',
              forward: function(p, v) { if (p.SinMagicParams) for (var i=0;i<4;i++) for (var j=0;j<4;j++) p.SinMagicParams[i][j] *= (0.2 + v * 1.8); },
              reverse: function(p) { if (!p.SinMagicParams) return 0.3; var s=0; for (var i=0;i<4;i++) for (var j=0;j<4;j++) s+=Math.abs(p.SinMagicParams[i][j]); return Math.min(1,s/60); }
            },
            { id: 'surface-scale', label: 'Surface Scale',
              forward: function(p, v) { for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<2;i++) p.Waves[n][i].Am.Base = 15 + 45 * v; },
              reverse: function(p) { var s=0,c=0; for (var n=0;n<MAX_WAVE_CNT;n++) for (var i=0;i<2;i++){s+=p.Waves[n][i].Am.Base;c++;} return Math.min(1,Math.max(0,(s/c-15)/45)); }
            },
            { id: 'distortion-style', label: 'Distort Style',
              forward: function(p, v) { p.TransMapStyle = v < 0.33 ? 1 : v < 0.66 ? 2 : 3; },
              reverse: function(p) { return p.TransMapStyle === 1 ? 0.15 : p.TransMapStyle === 2 ? 0.5 : 0.85; }
            },
            { id: 'density', label: 'Density',
              forward: function(p, v) { p.ParticleCount = Math.round((1000 + 5000 * v) / 100) * 100; },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.ParticleCount - 1000) / 5000)); }
            },
            { id: 'speed', label: 'Speed',
              forward: function(p, v) { p.WaveSpeed = 0.02 + 0.08 * v; },
              reverse: function(p) { return Math.min(1, Math.max(0, (p.WaveSpeed - 0.02) / 0.08)); }
            }
        ]
    }
];

function selectArchetype(index) {
    gArchetypeState.activeArchetype = index;
    var arch = ARCHETYPES[index];

    $('.archetype-btn').removeClass('active');
    $('.archetype-btn[data-idx="' + index + '"]').addClass('active');

    var sel = document.getElementById('selArchetypeBase');
    sel.innerHTML = '';
    for (var i = 0; i < arch.basePresets.length; i++) {
        var opt = document.createElement('option');
        opt.value = arch.basePresets[i];
        opt.textContent = arch.basePresets[i];
        sel.appendChild(opt);
    }

    selectArchetypeBase(arch.basePresets[0]);
}

function selectArchetypeBase(presetName) {
    if (!g_psss_presets[presetName]) return;
    var arch = ARCHETYPES[gArchetypeState.activeArchetype];
    gArchetypeState.basePreset = presetName;
    gArchetypeState.workingPreset = JSON.parse(JSON.stringify(g_psss_presets[presetName]));

    var lp = arch.lockedParams;
    for (var key in lp) {
        if (lp.hasOwnProperty(key)) gArchetypeState.workingPreset[key] = lp[key];
    }

    gPreset = JSON.parse(JSON.stringify(gArchetypeState.workingPreset));
    applyPresetLive(gPreset);

    gArchetypeState.sliderValues = [];
    for (var i = 0; i < arch.sliders.length; i++) {
        gArchetypeState.sliderValues.push(arch.sliders[i].reverse(gArchetypeState.workingPreset));
    }

    renderArchetypeSliders();
}

function renderArchetypeSliders() {
    var arch = ARCHETYPES[gArchetypeState.activeArchetype];
    var container = document.getElementById('pnlArchetypeSliders');
    container.innerHTML = '';
    for (var i = 0; i < arch.sliders.length; i++) {
        var row = document.createElement('div');
        row.className = 'archetype-slider-row';
        row.dataset.idx = i;
        row.innerHTML = '<span class="arch-label">' + arch.sliders[i].label + '</span>' +
            '<input type="range" min="0" max="1" step="0.01" value="' + gArchetypeState.sliderValues[i].toFixed(2) + '">' +
            '<span class="arch-val">' + gArchetypeState.sliderValues[i].toFixed(2) + '</span>';
        container.appendChild(row);
    }
}

function applyArchetypeSlider(sliderIdx, value) {
    var arch = ARCHETYPES[gArchetypeState.activeArchetype];
    gArchetypeState.sliderValues[sliderIdx] = value;
    gArchetypeState.workingPreset = JSON.parse(JSON.stringify(g_psss_presets[gArchetypeState.basePreset]));
    var lp = arch.lockedParams;
    for (var key in lp) {
        if (lp.hasOwnProperty(key)) gArchetypeState.workingPreset[key] = lp[key];
    }
    for (var i = 0; i < arch.sliders.length; i++) {
        arch.sliders[i].forward(gArchetypeState.workingPreset, gArchetypeState.sliderValues[i]);
    }
    gPreset = JSON.parse(JSON.stringify(gArchetypeState.workingPreset));
    applyPresetLive(gPreset);
}

function syncArchetypeFromCurrent() {
    var maxFM = 0, hasTransMap = gPreset.TransMapFilter, tmStyle = gPreset.TransMapStyle || 0;
    var maxZ = 0;
    for (var n = 0; n < MAX_WAVE_CNT; n++) {
        for (var i = 0; i < AXIS_CNT; i++) {
            maxFM = Math.max(maxFM, gPreset.Waves[n][i].Fm.Base);
            if (i === 2) maxZ = Math.max(maxZ, gPreset.Waves[n][i].Am.Base);
        }
    }
    var bestIdx = 0;
    if (hasTransMap && tmStyle >= 1 && maxZ > 20) bestIdx = 2;
    else if (hasTransMap && tmStyle === 0 && maxFM < 100) bestIdx = 0;
    else if (!hasTransMap && maxFM < 50) bestIdx = 3;
    else if (maxFM > 100) bestIdx = 1;
    else if (hasTransMap && tmStyle >= 1) bestIdx = 4;

    selectArchetype(bestIdx);
    var arch = ARCHETYPES[bestIdx];
    gArchetypeState.workingPreset = JSON.parse(JSON.stringify(gPreset));
    gArchetypeState.sliderValues = [];
    for (var s = 0; s < arch.sliders.length; s++) {
        gArchetypeState.sliderValues.push(arch.sliders[s].reverse(gPreset));
    }
    renderArchetypeSliders();
}

function interpolatePreset(presetA, presetB, t, locks) {
    var result = JSON.parse(JSON.stringify(presetA));
    var tB = t;
    var tA = 1.0 - t;

    function lerp(a, b) { return a + (b - a) * tB; }
    function snap(a, b) { return tB < 0.5 ? a : b; }

    if (!locks.shape) {
        result.ParticleCount = Math.round(lerp(presetA.ParticleCount, presetB.ParticleCount) / 100) * 100;
        if (result.ParticleCount < 1) result.ParticleCount = 1;
        for (var n = 0; n < MAX_WAVE_CNT; n++) {
            for (var i = 0; i < AXIS_CNT; i++) {
                result.Waves[n][i].Phase = lerp(presetA.Waves[n][i].Phase, presetB.Waves[n][i].Phase);
                result.Waves[n][i].Am.Base = lerp(presetA.Waves[n][i].Am.Base, presetB.Waves[n][i].Am.Base);
                result.Waves[n][i].Am.Amp = lerp(presetA.Waves[n][i].Am.Amp, presetB.Waves[n][i].Am.Amp);
                result.Waves[n][i].Am.Freq = lerp(presetA.Waves[n][i].Am.Freq, presetB.Waves[n][i].Am.Freq);
                result.Waves[n][i].Fm.Base = lerp(presetA.Waves[n][i].Fm.Base, presetB.Waves[n][i].Fm.Base);
                result.Waves[n][i].Fm.Amp = lerp(presetA.Waves[n][i].Fm.Amp, presetB.Waves[n][i].Fm.Amp);
                result.Waves[n][i].Fm.Freq = lerp(presetA.Waves[n][i].Fm.Freq, presetB.Waves[n][i].Fm.Freq);
            }
        }
    }

    if (!locks.color) {
        for (var c = 0; c < 3; c++) {
            result.ColorBase[c] = lerp(presetA.ColorBase[c], presetB.ColorBase[c]);
            result.ColorAmp[c] = lerp(presetA.ColorAmp[c], presetB.ColorAmp[c]);
            result.ColorFreq[c] = lerp(presetA.ColorFreq[c], presetB.ColorFreq[c]);
            result.ColorShift[c] = lerp(presetA.ColorShift[c], presetB.ColorShift[c]);
        }
    }

    if (!locks.motion) {
        result.WaveSpeed = lerp(presetA.WaveSpeed, presetB.WaveSpeed);
        for (var r = 0; r < 3; r++) {
            result.Rotation[r] = lerp(presetA.Rotation[r], presetB.Rotation[r]);
        }
    }

    if (!locks.transmap) {
        result.TransMapFilter = snap(presetA.TransMapFilter, presetB.TransMapFilter);
        result.TransMapStyle = snap(presetA.TransMapStyle, presetB.TransMapStyle);
        result.TransMapMode = snap(presetA.TransMapMode, presetB.TransMapMode);
        result.ZoomCenterX = lerp(presetA.ZoomCenterX || 50, presetB.ZoomCenterX || 50);
        result.ZoomCenterY = lerp(presetA.ZoomCenterY || 50, presetB.ZoomCenterY || 50);
        if (presetA.SinMagicParams && presetB.SinMagicParams) {
            for (var si = 0; si < 4; si++) {
                for (var sj = 0; sj < 4; sj++) {
                    result.SinMagicParams[si][sj] = lerp(presetA.SinMagicParams[si][sj], presetB.SinMagicParams[si][sj]);
                }
            }
        }
        if (presetA.SinMagicParams2 && presetB.SinMagicParams2) {
            for (var si2 = 0; si2 < 4; si2++) {
                for (var sj2 = 0; sj2 < 4; sj2++) {
                    result.SinMagicParams2[si2][sj2] = lerp(presetA.SinMagicParams2[si2][sj2], presetB.SinMagicParams2[si2][sj2]);
                }
            }
        }
    }

    result.RenderMode = snap(presetA.RenderMode, presetB.RenderMode);
    result.MotionBlur = Math.round(lerp(presetA.MotionBlur, presetB.MotionBlur));
    result.SmoothFilter = snap(presetA.SmoothFilter, presetB.SmoothFilter);

    return result;
}

function applyPresetLive(preset) {
    var needFullRebuild = false;
    if (gParSys && gPreset) {
        var curCount = gPreset.ParticleCount;
        var curMode = gPreset.RenderMode;
        if (preset.ParticleCount !== curCount || preset.RenderMode !== curMode) {
            needFullRebuild = true;
        }
    } else {
        needFullRebuild = true;
    }

    gPreset = preset;

    if (needFullRebuild) {
        applyPreset();
        return;
    }

    gCanvas.brightness = preset.MotionBlur / 8.1;
    gCanvas.blurradius = preset.SmoothFilter ? 1 : 0;

    gParSys.applyPreset(preset);

    gTransMapStyle = preset.TransMapStyle;
    gTransMapFilter = preset.TransMapFilter;
    gTransMapMode = preset.TransMapMode;

    calcTransMap();
}

function randomizePreset(preset, intensity) {
    var result = JSON.parse(JSON.stringify(preset));
    var sigma = intensity === 'subtle' ? 0.05 : intensity === 'medium' ? 0.20 : 0.50;

    function gaussRand() {
        var u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function jitter(val, min, max) {
        var offset = val * gaussRand() * sigma;
        var nv = val + offset;
        if (nv < min) nv = min;
        if (nv > max) nv = max;
        return nv;
    }

    if (!gLabLocks.shape) {
        for (var n = 0; n < MAX_WAVE_CNT; n++) {
            for (var i = 0; i < AXIS_CNT; i++) {
                result.Waves[n][i].Phase = jitter(result.Waves[n][i].Phase, 0, 360);
                result.Waves[n][i].Am.Base = jitter(result.Waves[n][i].Am.Base, 0, 100);
                result.Waves[n][i].Am.Amp = jitter(result.Waves[n][i].Am.Amp, 0, 100);
                result.Waves[n][i].Am.Freq = jitter(result.Waves[n][i].Am.Freq, 0, 50);
                result.Waves[n][i].Fm.Base = jitter(result.Waves[n][i].Fm.Base, 0, 1000);
                result.Waves[n][i].Fm.Amp = jitter(result.Waves[n][i].Fm.Amp, 0, 500);
                result.Waves[n][i].Fm.Freq = jitter(result.Waves[n][i].Fm.Freq, 0, 50);
            }
        }
    }

    if (!gLabLocks.color) {
        for (var c = 0; c < 3; c++) {
            result.ColorBase[c] = jitter(result.ColorBase[c], 0, 255);
            result.ColorAmp[c] = jitter(result.ColorAmp[c], 0, 255);
            result.ColorFreq[c] = jitter(result.ColorFreq[c], 0, 10);
            result.ColorShift[c] = jitter(result.ColorShift[c], 0, 5);
        }
    }

    if (!gLabLocks.motion) {
        result.WaveSpeed = jitter(result.WaveSpeed, 0.001, 0.5);
        for (var r = 0; r < 3; r++) {
            result.Rotation[r] = jitter(result.Rotation[r], 0, 5);
        }
    }

    result.MotionBlur = Math.round(jitter(result.MotionBlur, 0, 8));

    if (!gLabLocks.transmap) {
        if (result.SinMagicParams) {
            for (var si = 0; si < 4; si++) {
                for (var sj = 0; sj < 4; sj++) {
                    result.SinMagicParams[si][sj] = jitter(result.SinMagicParams[si][sj], -100, 100);
                }
            }
        }
        if (result.SinMagicParams2) {
            for (var si2 = 0; si2 < 4; si2++) {
                for (var sj2 = 0; sj2 < 4; sj2++) {
                    result.SinMagicParams2[si2][sj2] = jitter(result.SinMagicParams2[si2][sj2], -100, 100);
                }
            }
        }

        if (intensity === 'wild') {
            if (Math.random() < 0.2) result.TransMapFilter = !result.TransMapFilter;
            if (Math.random() < 0.1) result.TransMapStyle = Math.floor(Math.random() * 4);
        }
    }

    return result;
}

function captureSnapshot() {
    var sourceCanvas = document.getElementById('world');
    var sourcePreset = gPreset;

    if (gEvoState.active && gEvoState.tiles.length > 0) {
        var tileIdx = gEvoState.selected.length > 0 ? gEvoState.selected[gEvoState.selected.length - 1] : 0;
        var evoTile = gEvoState.tiles[tileIdx];
        if (evoTile) {
            sourceCanvas = evoTile.canvas;
            sourcePreset = evoTile.preset;
            sourcePreset = JSON.parse(JSON.stringify(sourcePreset));
            sourcePreset.ParticleCount = sourcePreset.ParticleCount * 4;
        }
    }

    var thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 150;
    thumbCanvas.height = 112;
    var ctx = thumbCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, 150, 112);
    var thumbnail = thumbCanvas.toDataURL('image/png', 0.5);

    var snapshot = {
        preset: JSON.parse(JSON.stringify(sourcePreset)),
        thumbnail: thumbnail,
        labState: {
            activeTab: gLabActiveTab,
            mixer: {
                deckA: $('#selLabDeckA').val(),
                deckB: $('#selLabDeckB').val(),
                crossfade: parseFloat($('#rngLabCrossfade').val()),
                locks: JSON.parse(JSON.stringify(gLabLocks))
            },
            randomizer: {
                locks: JSON.parse(JSON.stringify(gLabLocks))
            },
            styles: {
                archetypeId: gArchetypeState.activeArchetype !== null ? ARCHETYPES[gArchetypeState.activeArchetype].id : null,
                basePreset: gArchetypeState.basePreset,
                sliderValues: gArchetypeState.sliderValues.slice()
            },
            evolution: {
                selectedTile: gEvoState.selected.length > 0 ? gEvoState.selected[gEvoState.selected.length - 1] : -1,
                generation: gEvoState.generation
            },
            dirty: gLabDirty
        },
        fractalState: {
            type: gFractalType,
            params: gFractalParams.slice(),
            blend: gFractalBlend
        }
    };

    gLabSnapshots.push(snapshot);
    if (gLabSnapshots.length > 10) {
        gLabSnapshots.shift();
    }

    renderLabHistory();
}

function restoreSnapshot(index) {
    if (index < 0 || index >= gLabSnapshots.length) return;
    var snap = gLabSnapshots[index];
    gPreset = JSON.parse(JSON.stringify(snap.preset));
    applyPreset();
    displayPreset();

    if (snap.labState) {
        // New multi-tab format
        if (snap.labState.activeTab) {
            var restoreTab = snap.labState.activeTab === 'evolution' ? 'mixer' : snap.labState.activeTab;
            switchLabTab(restoreTab);

            if (snap.labState.mixer) {
                $('#selLabDeckA').val(snap.labState.mixer.deckA);
                $('#selLabDeckB').val(snap.labState.mixer.deckB);
                $('#rngLabCrossfade').val(snap.labState.mixer.crossfade);
                $('#lblLabCrossfade').text(Math.round(snap.labState.mixer.crossfade * 100) + '%');
                gLabLocks = JSON.parse(JSON.stringify(snap.labState.mixer.locks));
                $('#chkLabLockShape').prop('checked', gLabLocks.shape);
                $('#chkLabLockColor').prop('checked', gLabLocks.color);
                $('#chkLabLockMotion').prop('checked', gLabLocks.motion);
                $('#chkLabLockTransmap').prop('checked', gLabLocks.transmap);
            }

            if (snap.labState.styles && snap.labState.styles.archetypeId) {
                for (var ai = 0; ai < ARCHETYPES.length; ai++) {
                    if (ARCHETYPES[ai].id === snap.labState.styles.archetypeId) {
                        gArchetypeState.activeArchetype = ai;
                        $('.archetype-btn').removeClass('active');
                        $('.archetype-btn[data-idx="' + ai + '"]').addClass('active');
                        var arch = ARCHETYPES[ai];
                        var sel = document.getElementById('selArchetypeBase');
                        sel.innerHTML = '';
                        for (var bi = 0; bi < arch.basePresets.length; bi++) {
                            var opt = document.createElement('option');
                            opt.value = arch.basePresets[bi];
                            opt.textContent = arch.basePresets[bi];
                            sel.appendChild(opt);
                        }
                        if (snap.labState.styles.basePreset) {
                            $('#selArchetypeBase').val(snap.labState.styles.basePreset);
                            gArchetypeState.basePreset = snap.labState.styles.basePreset;
                        }
                        gArchetypeState.workingPreset = JSON.parse(JSON.stringify(snap.preset));
                        if (snap.labState.styles.sliderValues) {
                            gArchetypeState.sliderValues = snap.labState.styles.sliderValues.slice();
                        } else {
                            gArchetypeState.sliderValues = [];
                            for (var ri = 0; ri < arch.sliders.length; ri++) {
                                gArchetypeState.sliderValues.push(arch.sliders[ri].reverse(gPreset));
                            }
                        }
                        renderArchetypeSliders();
                        break;
                    }
                }
            } else if (snap.labState.sliderboard) {
                syncArchetypeFromCurrent();
            }
        } else {
            // Legacy format (feature 008)
            $('#selLabDeckA').val(snap.labState.deckA);
            $('#selLabDeckB').val(snap.labState.deckB);
            $('#rngLabCrossfade').val(snap.labState.crossfade);
            $('#lblLabCrossfade').text(Math.round(snap.labState.crossfade * 100) + '%');
            gLabLocks = JSON.parse(JSON.stringify(snap.labState.locks));
            $('#chkLabLockShape').prop('checked', gLabLocks.shape);
            $('#chkLabLockColor').prop('checked', gLabLocks.color);
            $('#chkLabLockMotion').prop('checked', gLabLocks.motion);
            $('#chkLabLockTransmap').prop('checked', gLabLocks.transmap);
            switchLabTab('mixer');
        }

        gLabDirty = snap.labState.dirty;
        $('#lblLabDirty').toggle(gLabDirty);
    }

    if (snap.fractalState) {
        gFractalType = snap.fractalState.type;
        gFractalParams = snap.fractalState.params.slice();
        gFractalBlend = snap.fractalState.blend;
        $('#selFractalType').val(gFractalType);
        var sliders = ['#rngFracA', '#rngFracB', '#rngFracC', '#rngFracD'];
        var labels = ['#lblFracA', '#lblFracB', '#lblFracC', '#lblFracD'];
        for (var fi = 0; fi < 4; fi++) {
            $(sliders[fi]).val(gFractalParams[fi]);
            var prec = (gFractalType === 'lorenz2d' && fi === 3) ? 3 : 2;
            $(labels[fi]).text(gFractalParams[fi].toFixed(prec));
        }
        $('#rngFracBlend').val(Math.round(gFractalBlend * 100));
        $('#lblFracBlend').text(Math.round(gFractalBlend * 100) + '%');
        $('#pnlJuliaPreset').toggle(gFractalType === 'julia');
        $('#pnlMandelbrotPreset').toggle(gFractalType === 'mandelbrot');
        if (gFractalType === 'julia' || gFractalType === 'mandelbrot') {
            gEscapeFlowGrid = buildEscapeFlowGrid(gFractalType, gFractalParams);
        }
        resetAttractorState();
    }
}

function applyVisualFxToUI() {
    $('#chkFxGlow').prop('checked', gFxGlow > 0);
    $('#rngFxGlow').val(gFxGlow || 2.0);
    $('#lblFxGlow').text((gFxGlow || 2.0).toFixed(1));
    $('#chkFxDepthSize').prop('checked', gFxDepthSize > 0);
    $('#rngFxDepthSize').val(gFxDepthSize);
    $('#lblFxDepthSize').text(gFxDepthSize.toFixed(2));
    $('#chkFxStreaks').prop('checked', gFxStreaks > 0);
    $('#rngFxStreaks').val(gFxStreaks);
    $('#lblFxStreaks').text(gFxStreaks.toFixed(2));
    $('#selFxPalette').val(gFxPalette);
    $('#selFxPaletteMap').val(gFxPaletteMapping);
    $('#chkFxSpeedCorr').prop('checked', gFxSpeedCorrection);
    $('#chkFxSpeedFactor').prop('checked', gFxSpeedFactor !== 1.0);
    $('#rngFxSpeedFactor').val(gFxSpeedFactor);
    $('#lblFxSpeedFactor').text(gFxSpeedFactor.toFixed(1));
    if (gFxPalette !== 'none' && gCanvas instanceof WebGLRenderer) {
        gCanvas.uploadPalette(PALETTES[gFxPalette]);
    }
}

function exportPresetAsFile() {
    var exportData = JSON.parse(JSON.stringify(gPreset));
    exportData.Name = exportData.Name || 'Lab Export ' + new Date().toISOString().slice(0, 16).replace('T', ' ');

    exportData.VisualFx = {
        Glow: gFxGlow,
        DepthSize: gFxDepthSize,
        Streaks: gFxStreaks,
        Palette: gFxPalette,
        PaletteMapping: gFxPaletteMapping,
        SpeedCorrection: gFxSpeedCorrection,
        SpeedFactor: gFxSpeedFactor
    };

    if (gFractalBlend > 0) {
        exportData.Fractal = {
            Type: gFractalType,
            Params: gFractalParams.slice(),
            Blend: gFractalBlend
        };
        if (gFractalType === 'mandelbrot') {
            exportData.Fractal.Bounds = gEscapeFlowGridBounds.slice();
        }
    }

    var json = JSON.stringify(exportData, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'psss_preset_' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportAllPresets() {
    var json = JSON.stringify(g_psss_presets, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'psss_presets_exported.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importPresetFromFile(fileContent) {
    var data;
    try {
        data = JSON.parse(fileContent);
    } catch (e) {
        alert('Invalid file: not valid JSON.\n' + e.message);
        return;
    }

    if (data.Waves && data.ColorBase && data.ParticleCount) {
        importSinglePreset(data);
    } else {
        var keys = Object.keys(data);
        if (keys.length > 0 && data[keys[0]] && data[keys[0]].Waves) {
            importPresetCollection(data, keys);
        } else {
            alert('Invalid preset file: missing required fields (Waves, ColorBase, ParticleCount)');
        }
    }
}

function importSinglePreset(data) {
    var defaultName = data.Name || data.name || 'Imported Preset';
    var name = prompt('Name this preset:', defaultName);
    if (!name) return;

    if (g_psss_presets[name]) {
        var overwrite = confirm('A preset named "' + name + '" already exists. Overwrite?');
        if (!overwrite) {
            name = name + ' (2)';
        }
    }

    if (data.VisualFx) {
        var fx = data.VisualFx;
        gFxGlow = fx.Glow !== undefined ? fx.Glow : 2.0;
        gFxDepthSize = fx.DepthSize !== undefined ? fx.DepthSize : 0.0;
        gFxStreaks = fx.Streaks !== undefined ? fx.Streaks : 0.0;
        gFxPalette = fx.Palette || 'none';
        gFxPaletteMapping = fx.PaletteMapping || 'depth';
        gFxSpeedCorrection = fx.SpeedCorrection !== undefined ? fx.SpeedCorrection : false;
        gFxSpeedFactor = fx.SpeedFactor !== undefined ? fx.SpeedFactor : 1.0;
        applyVisualFxToUI();
    }

    if (data.Fractal) {
        var fr = data.Fractal;
        gFractalType = fr.Type || 'clifford';
        var importedParams = fr.Params ? fr.Params.slice() : [-1.4, 1.6, 1.0, 0.7];
        gFractalBlend = fr.Blend !== undefined ? fr.Blend : 0.0;
        if (fr.Bounds && gFractalType === 'mandelbrot') {
            gEscapeFlowGridBounds = fr.Bounds.slice();
        }
        $('#selFractalType').val(gFractalType).trigger('change');
        gFractalParams = importedParams;
        var sliders = ['#rngFracA', '#rngFracB', '#rngFracC', '#rngFracD'];
        var labels = ['#lblFracA', '#lblFracB', '#lblFracC', '#lblFracD'];
        for (var si = 0; si < 4; si++) {
            $(sliders[si]).val(gFractalParams[si]);
            $(labels[si]).text(gFractalParams[si].toFixed(2));
        }
        if (gEscapeFlowEnabled && (gFractalType === 'julia' || gFractalType === 'mandelbrot')) {
            gEscapeFlowGrid = buildEscapeFlowGrid(gFractalType, gFractalParams);
        }
        resetAttractorState();
        $('#rngFracBlend').val(Math.round(gFractalBlend * 100));
        $('#lblFracBlend').text(Math.round(gFractalBlend * 100) + '%');
        if (fr.Bounds && gFractalType === 'mandelbrot') {
            var presetKey = 'full';
            for (var k in mandelbrotPresets) {
                var b = mandelbrotPresets[k].bounds;
                if (b[0] === fr.Bounds[0] && b[1] === fr.Bounds[1] && b[2] === fr.Bounds[2] && b[3] === fr.Bounds[3]) {
                    presetKey = k; break;
                }
            }
            $('#selMandelbrotPreset').val(presetKey);
        }
    } else {
        gFractalBlend = 0.0;
        $('#rngFracBlend').val(0);
        $('#lblFracBlend').text('0%');
    }

    g_psss_presets[name] = data;
    addPresetToDropdowns(name);
    $('#lstParticlePresets').val(name);
    selectPreset(name);
    displayPreset();
}

function importPresetCollection(data, keys) {
    var count = keys.length;
    if (!confirm('Import ' + count + ' presets?')) return;

    var added = 0;
    for (var i = 0; i < keys.length; i++) {
        var name = keys[i];
        var preset = data[name];
        if (!preset.Waves || !preset.ColorBase || !preset.ParticleCount) continue;
        if (g_psss_presets[name]) continue;
        g_psss_presets[name] = preset;
        addPresetToDropdowns(name);
        added++;
    }
    alert(added + ' presets imported (' + (count - added) + ' skipped as duplicates).');
}

function addPresetToDropdowns(name) {
    $('#lstParticlePresets').append($('<option>').val(name).text(name));
    $('#selLabDeckA').append($('<option>').val(name).text(name));
    $('#selLabDeckB').append($('<option>').val(name).text(name));
}

function renderLabHistory() {
    var container = document.getElementById('pnlLabHistory');
    container.innerHTML = '';
    for (var i = 0; i < gLabSnapshots.length; i++) {
        var img = document.createElement('img');
        img.src = gLabSnapshots[i].thumbnail;
        img.className = 'lab-thumb';
        img.title = 'Snapshot ' + (i + 1);
        img.dataset.index = i;
        img.addEventListener('click', function () {
            restoreSnapshot(parseInt(this.dataset.index));
        });
        container.appendChild(img);
    }
}

//------------------------------------------------------------------------------

function drawFrame(timestamp) {
    var frameInterval = 1000 / gTargetFps;
    var elapsed = timestamp - gLastFrameTime;

    if (elapsed < frameInterval) {
        gRequestID = window.requestAnimationFrame(drawFrame);
        return;
    }
    gLastFrameTime = timestamp - (elapsed % frameInterval);

    var transMapActive = gTransMapFilter;
    var transMapFade = 1.0;
    if (transMapActive && gEscapeFlowEnabled && gFractalBlend > 0) {
        transMapFade = 1.0 - gFractalBlend;
        if (transMapFade < 0.01) transMapActive = false;
    }

    if (gCanvas instanceof WebGLRenderer) {
        gCanvas.decayPass();

        if (gTransMapMode == TransMapMode.tmmApplyAfter) {
            gWorld.doWorld();
        }

        if (transMapActive) {
            gCanvas.transMapPass(transMapFade);
        }

        if (gTransMapMode == TransMapMode.tmmApplyBefore) {
            gWorld.doWorld();
        }

        gCanvas.presentToScreen();
    } else {
        gCanvas.vis2Data();

        if (gTransMapMode == TransMapMode.tmmApplyAfter) {
            gWorld.doWorld();
        }

        if (transMapActive) {
            var idSrc = gCanvas.copyImageData();
            gTransMap.applyTransMap(idSrc.data, gCanvas.ImgData.data);
            if (transMapFade < 1.0) {
                var dst = gCanvas.ImgData.data;
                var src = idSrc.data;
                var invFade = 1.0 - transMapFade;
                for (var p = 0; p < dst.length; p += 4) {
                    dst[p]     = Math.round(dst[p] * transMapFade + src[p] * invFade);
                    dst[p + 1] = Math.round(dst[p + 1] * transMapFade + src[p + 1] * invFade);
                    dst[p + 2] = Math.round(dst[p + 2] * transMapFade + src[p + 2] * invFade);
                }
            }
        }

        if (gTransMapMode == TransMapMode.tmmApplyBefore) {
            gWorld.doWorld();
        }

        gCanvas.data2Vis();
    }

    gRequestID = window.requestAnimationFrame(drawFrame);
}

function calcTransMap() {
    switch (gTransMapStyle) {
        case TransMapStyle.tmsWaved: {
            var sinMagic = JSON.parse(JSON.stringify(gPreset.SinMagicParams));  // deep copy preset

            for (n = 0; n < MAX_SIN_MAGIC; n++) {
                sinMagic[0][n] = (sinMagic[0][n] * gWidth) / 100;
                sinMagic[2][n] = (sinMagic[2][n] * gHeight) / 100;
            }

            gTransMap.sinMagic(sinMagic);
            break;
        }

        case TransMapStyle.tmsWavedZoom:
            gTransMap.sinMagicZoom(gPreset.SinMagicParams, (gPreset.ZoomCenterX * gWidth) / 100, (gPreset.ZoomCenterY * gHeight) / 100, false);
            break;

        case TransMapStyle.tmsWavedZoomOverlay:
            gTransMap.sinMagicZoom(gPreset.SinMagicParams, (gPreset.ZoomCenterX * gWidth) / 100, (gPreset.ZoomCenterY * gHeight) / 100, true);
            break;

        case TransMapStyle.tmsWavedZoomCombined:
            gTransMap.sinMagicZoom2(gPreset.SinMagicParams, gPreset.SinMagicParams2, (gPreset.ZoomCenterX * gWidth) / 100, (gPreset.ZoomCenterY * gHeight) / 100);
            break;
    }

    if (gCanvas instanceof WebGLRenderer) {
        gCanvas.uploadTransMap(gTransMap.getMapArray(), gWidth, gHeight);
    }
}

function get1stFromName(aInputName) {
    var idx1 = aInputName.indexOf("_");
    var idx2 = aInputName.indexOf("_", idx1 + 1);

    var result;

    if (idx2 >= 0) {
        result = parseInt(aInputName.substr(idx1 + 1, idx2 - idx1 - 1));
    } else {
        result = parseInt(aInputName.substr(idx1 + 1,));
    }

    return result;
}

function get2ndFromName(aInputName) {
    var idx1 = aInputName.indexOf("_");
    var idx2 = aInputName.indexOf("_", idx1 + 1);

    return parseInt(aInputName.substr(idx2 + 1));
}

function getAxisAsNrFromName(aInputName) {
    var idx1 = aInputName.indexOf("_");
    var idx2 = aInputName.indexOf("_", idx1 + 1);

    var result = -1;

    switch (aInputName.substr(idx2 + 1)) {
        case "X":
            result = 0;
            break;

        case "Y":
            result = 1;
            break;

        case "Z":
            result = 2;
            break;
    }

    return result;
}

function displayPreset() {
    $("#txtParticleCount").val(gPreset.ParticleCount);

    $("#txtBlur").val(gCanvas.blurradius);
    $("#txtBrightness").val(gCanvas.brightness);

    for (var n = 1; n <= 3; n++) {
        $("#txtAngle_" + n).val(gParSys.angle[n - 1]);
    }

    for (var n = 1; n <= 3; n++) {
        $("#txtRotation_" + n).val(gParSys.rotationSpeed3d[n - 1]);
    }

    // colors
    for (var n = 1; n <= 3; n++) {
        $("#txtColorBase_" + n).val(gParSys.colorBase[n - 1]);
    }

    for (var n = 1; n <= 3; n++) {
        $("#txtColorAmp_" + n).val(gParSys.colorAmp[n - 1]);
    }

    for (var n = 1; n <= 3; n++) {
        $("#txtColorFreq_" + n).val(gParSys.colorFreq[n - 1]);
    }

    for (var n = 1; n <= 3; n++) {
        $("#txtColorShift_" + n).val(gParSys.colorShift[n - 1]);
    }

    // waves
    for (var n = 0; n < MAX_WAVE_CNT; n++) {
        for (var i = 0; i < AXIS_CNT; i++) {
            var waveAxisStr = "_" + (n + 1).toString() + "_" + AXIS_NAME[i];

            $("#txtWavePhase" + waveAxisStr).val(gParSys.waves[n][i].phase);
            $("#txtWaveBaseAM" + waveAxisStr).val(gParSys.waves[n][i].am.base);
            $("#txtWaveAmpAM" + waveAxisStr).val(gParSys.waves[n][i].am.amp);
            $("#txtWaveFreqAM" + waveAxisStr).val(gParSys.waves[n][i].am.freq);
            $("#txtWaveBaseFM" + waveAxisStr).val(gParSys.waves[n][i].fm.base);
            $("#txtWaveAmpFM" + waveAxisStr).val(gParSys.waves[n][i].fm.amp);
            $("#txtWaveFreqFM" + waveAxisStr).val(gParSys.waves[n][i].fm.freq);
        }
    }

    // transmaps
    $("#lstTransMapStyle").val(gPreset.TransMapStyle);

    $("#chkTransMapFilter").prop("checked", gTransMapFilter);
    $("#chkTransMapMode").prop("checked", gTransMapMode == TransMapMode.tmmApplyBefore);

    $("#txtTransMapCenterX").val(gPreset.ZoomCenterX);
    $("#txtTransMapCenterY").val(gPreset.ZoomCenterY);

    for (var n = 0; n < MAX_SIN_MAGIC; n++) {
        var waveStr = "_" + (n + 1).toString();

        $("#txtXAmp_1" + waveStr).val(gPreset.SinMagicParams[0][n]);
        $("#txtXFreq_1" + waveStr).val(gPreset.SinMagicParams[1][n]);
        $("#txtYAmp_1" + waveStr).val(gPreset.SinMagicParams[2][n]);
        $("#txtYFreq_1" + waveStr).val(gPreset.SinMagicParams[3][n]);

        $("#txtXAmp_2" + waveStr).val(gPreset.SinMagicParams2[0][n]);
        $("#txtXFreq_2" + waveStr).val(gPreset.SinMagicParams2[1][n]);
        $("#txtYAmp_2" + waveStr).val(gPreset.SinMagicParams2[2][n]);
        $("#txtYFreq_2" + waveStr).val(gPreset.SinMagicParams2[3][n]);
    }
}


//------------------------------------------------------------------------------
// Preview All Tile Grid
//------------------------------------------------------------------------------

var TILE_WIDTH = 256;
var TILE_HEIGHT = 192;
var TILE_FPS = 15;

function createTileShell(presetName) {
    var div = document.createElement('div');
    div.className = 'preview-tile';
    div.dataset.preset = presetName;

    var canvas = document.createElement('canvas');
    canvas.width = TILE_WIDTH;
    canvas.height = TILE_HEIGHT;
    div.appendChild(canvas);

    var label = document.createElement('span');
    label.className = 'tile-label';
    label.textContent = presetName;
    label.title = presetName;
    div.appendChild(label);

    return div;
}

function createTilePipeline(presetName, canvas) {
    var preset = JSON.parse(JSON.stringify(g_psss_presets[presetName]));

    var pixCanvas = new PixelCanvas(canvas, TILE_WIDTH, TILE_HEIGHT);
    var transMap = new TranslationMap(TILE_WIDTH, TILE_HEIGHT);

    var world = new World3d(
        [TILE_WIDTH / 2, TILE_HEIGHT / 2],
        POINT3D_ZERO, ANGLE3D_ZERO,
        -(TILE_WIDTH + TILE_HEIGHT) / 2,
        pixCanvas
    );

    var tileParticleCount = Math.max(100, Math.round(preset.ParticleCount / 4));
    var parSys = new ParticleWaves(world, tileParticleCount * 5);
    pixCanvas.brightness = preset.MotionBlur / 8.1;
    pixCanvas.blurradius = preset.SmoothFilter ? 1 : 0;
    parSys.applyPreset(preset);

    var transMapStyle = preset.TransMapStyle;
    var transMapFilter = preset.TransMapFilter;
    var transMapMode = preset.TransMapMode;

    switch (transMapStyle) {
        case TransMapStyle.tmsWaved: {
            var sinMagic = JSON.parse(JSON.stringify(preset.SinMagicParams));
            for (var n = 0; n < MAX_SIN_MAGIC; n++) {
                sinMagic[0][n] = (sinMagic[0][n] * TILE_WIDTH) / 100;
                sinMagic[2][n] = (sinMagic[2][n] * TILE_HEIGHT) / 100;
            }
            transMap.sinMagic(sinMagic);
            break;
        }
        case TransMapStyle.tmsWavedZoom:
            transMap.sinMagicZoom(preset.SinMagicParams, (preset.ZoomCenterX * TILE_WIDTH) / 100, (preset.ZoomCenterY * TILE_HEIGHT) / 100, false);
            break;
        case TransMapStyle.tmsWavedZoomOverlay:
            transMap.sinMagicZoom(preset.SinMagicParams, (preset.ZoomCenterX * TILE_WIDTH) / 100, (preset.ZoomCenterY * TILE_HEIGHT) / 100, true);
            break;
        case TransMapStyle.tmsWavedZoomCombined:
            transMap.sinMagicZoom2(preset.SinMagicParams, preset.SinMagicParams2, (preset.ZoomCenterX * TILE_WIDTH) / 100, (preset.ZoomCenterY * TILE_HEIGHT) / 100);
            break;
    }

    world.addObject(parSys);

    var tileInstance = {
        preset: preset,
        canvas: pixCanvas,
        transMap: transMap,
        world: world,
        parSys: parSys,
        transMapFilter: transMapFilter,
        transMapMode: transMapMode,
        requestID: null,
        lastFrameTime: 0
    };

    function tileDrawFrame(timestamp) {
        var frameInterval = 1000 / TILE_FPS;
        var elapsed = timestamp - tileInstance.lastFrameTime;

        if (elapsed < frameInterval) {
            tileInstance.requestID = window.requestAnimationFrame(tileDrawFrame);
            return;
        }
        tileInstance.lastFrameTime = timestamp - (elapsed % frameInterval);

        pixCanvas.vis2Data();

        if (tileInstance.transMapMode == TransMapMode.tmmApplyAfter) {
            world.doWorld();
        }

        if (tileInstance.transMapFilter) {
            var idSrc = pixCanvas.copyImageData();
            transMap.applyTransMap(idSrc.data, pixCanvas.ImgData.data);
        }

        if (tileInstance.transMapMode == TransMapMode.tmmApplyBefore) {
            world.doWorld();
        }

        pixCanvas.data2Vis();

        tileInstance.requestID = window.requestAnimationFrame(tileDrawFrame);
    }

    tileInstance.requestID = window.requestAnimationFrame(tileDrawFrame);
    return tileInstance;
}

function destroyTilePipeline(presetName) {
    var tile = gActiveTiles.get(presetName);
    if (tile) {
        if (tile.requestID) {
            window.cancelAnimationFrame(tile.requestID);
            tile.requestID = null;
        }
        tile.canvas = null;
        tile.transMap = null;
        tile.world = null;
        tile.parSys = null;
        gActiveTiles.delete(presetName);
    }
}

function processInitQueue() {
    if (gTileInitQueue.length === 0) {
        gTileInitTimer = null;
        return;
    }

    var batch = gTileInitQueue.splice(0, 4);
    for (var i = 0; i < batch.length; i++) {
        var entry = batch[i];
        if (!gActiveTiles.has(entry.name)) {
            var instance = createTilePipeline(entry.name, entry.canvas);
            gActiveTiles.set(entry.name, instance);
        }
    }

    gTileInitTimer = setTimeout(processInitQueue, 50);
}

function initPreviewGrid() {
    var container = document.getElementById('pnlPreviewAll');
    container.innerHTML = '';

    var names = Object.keys(g_psss_presets);
    for (var i = 0; i < names.length; i++) {
        var shell = createTileShell(names[i]);
        container.appendChild(shell);
    }

    gPreviewObserver = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var presetName = entry.target.dataset.preset;
            var canvas = entry.target.querySelector('canvas');

            if (entry.isIntersecting) {
                if (!gActiveTiles.has(presetName)) {
                    gTileInitQueue.push({ name: presetName, canvas: canvas });
                }
            } else {
                var queueIdx = gTileInitQueue.findIndex(function (q) { return q.name === presetName; });
                if (queueIdx >= 0) gTileInitQueue.splice(queueIdx, 1);
                destroyTilePipeline(presetName);
            }
        }

        if (gTileInitQueue.length > 0 && !gTileInitTimer) {
            processInitQueue();
        }
    }, { root: container, rootMargin: '100px', threshold: 0 });

    var tiles = container.querySelectorAll('.preview-tile');
    for (var i = 0; i < tiles.length; i++) {
        gPreviewObserver.observe(tiles[i]);
    }

    gPreviewGridInitialized = true;
}

function showPreviewAll() {
    gViewMode = 'previewAll';

    if (gEvoState.active) {
        destroyEvolution();
        hideEvoGrid();
        gEvoState.active = false;
    }
    $('#pnlLabControls').hide();
    $('#pnlVisualFx').hide();
    document.getElementById('pnlLabWrapper').style.display = 'none';
    document.getElementById('rngFps').parentElement.style.display = 'none';
    $("#pnlSettings").hide();
    $("#cmdPreviewAll").text('Preview Single');

    var container = document.getElementById('pnlPreviewAll');
    container.style.display = 'grid';

    if (!gPreviewGridInitialized) {
        initPreviewGrid();
    }

    var selectedPreset = $("#lstParticlePresets").val();
    if (selectedPreset) {
        var tile = container.querySelector('.preview-tile[data-preset="' + selectedPreset + '"]');
        if (tile) {
            tile.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
    }

    if (gRequestID) {
        window.cancelAnimationFrame(gRequestID);
        gRequestID = undefined;
    }
}

function hidePreviewAll() {
    var container = document.getElementById('pnlPreviewAll');
    container.style.display = 'none';

    if (gTileInitTimer) {
        clearTimeout(gTileInitTimer);
        gTileInitTimer = null;
    }
    gTileInitQueue = [];

    gActiveTiles.forEach(function (tile, name) {
        destroyTilePipeline(name);
    });

    if (gPreviewObserver) {
        gPreviewObserver.disconnect();
        gPreviewObserver = null;
        gPreviewGridInitialized = false;
    }

    document.getElementById('pnlLabWrapper').style.display = 'flex';
    document.getElementById('rngFps').parentElement.style.display = '';
    $("#cmdPreviewAll").text('Preview All');

    if (!gRequestID) {
        gRequestID = window.requestAnimationFrame(drawFrame);
    }
}

//------------------------------------------------------------------------------

function start() {
    var testCanvas = document.createElement('canvas');
    var testGL = testCanvas.getContext('webgl');
    if (testGL) {
        gUseWebGL = true;
        console.log('PSSS: WebGL renderer active');
    } else {
        gUseWebGL = false;
        console.log('PSSS: Canvas 2D renderer (WebGL unavailable)');
    }

    $("#cmdToggleSettings").click(function () {
        if (gViewMode === 'previewAll') {
            hidePreviewAll();
            gViewMode = 'main';
        }
        $("#pnlSettings").toggle();
    });

    $("#cmdPreviewAll").click(function () {
        if (gViewMode === 'main') {
            showPreviewAll();
        } else if (gViewMode === 'previewAll') {
            hidePreviewAll();
            gViewMode = 'main';
        }
    });

    $("#pnlPreviewAll").on('click', '.preview-tile', function () {
        var presetName = $(this).data('preset');
        hidePreviewAll();
        gViewMode = 'previewFullscreen';
        $("#lstParticlePresets").val(presetName);
        selectPreset(presetName);
        displayPreset();

        var worldEl = $('#world')[0];
        if (worldEl.requestFullscreen) {
            worldEl.requestFullscreen();
        } else if (worldEl.webkitRequestFullscreen) {
            worldEl.webkitRequestFullscreen();
        } else if (worldEl.msRequestFullscreen) {
            worldEl.msRequestFullscreen();
        }
    });

    $.each(g_psss_presets, function (actName, actPreset) {
        $("#lstParticlePresets").append(
            $('<option></option>').val(actName).html(actName)
        );
    });

    $("#lstParticlePresets").change(function () {
        var selVal = $(this).val();

        if (selVal) {
            selectPreset(selVal);

            displayPreset();
        }
    });

    $("#txtParticleCount").change(function () {
        var v = parseInt($(this).val());

        gPreset.ParticleCount=v;

        applyPreset();
    });

    // display filter
    $("#txtBlur").change(function () {
        gCanvas.blurradius = parseFloat($("#txtBlur").val());
    });

    $("#txtBrightness").change(function () {
        gCanvas.brightness = parseFloat($("#txtBrightness").val());
    });

    // angle 
    $(".txtAngle").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var axis = get1stFromName(name) - 1;

        gParSys.angle[axis] = v;
    });

    $(".txtRotation").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var axis = get1stFromName(name) - 1;

        gParSys.rotationSpeed3d[axis] = v;
    });

    // colors
    $(".colorBase").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var i = name.substr(name.length - 1) - 1;
        gParSys.colorBase[i] = v;
    });

    $(".colorAmp").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var i = name.substr(name.length - 1) - 1;
        gParSys.colorAmp[i] = v;
    });

    $(".colorFreq").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var i = name.substr(name.length - 1) - 1;
        gParSys.colorFreq[i] = v;
    });

    $(".colorShift").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var i = name.substr(name.length - 1) - 1;
        gParSys.colorShift[i] = v;
    });

    // waves
    $(".wavePhase").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var waveNr = get1stFromName(name) - 1;
        var waveAxis = getAxisAsNrFromName(name);

        gParSys.waves[waveNr][waveAxis].phase = v;
    });

    $(".cmdWaveZero").click(function () {
        var name = $(this).attr('name');

        var waveNr = get1stFromName(name) - 1;
        var waveAxis = getAxisAsNrFromName(name);

        gParSys.waves[waveNr][waveAxis].phase = 0;
        gParSys.waves[waveNr][waveAxis].am.base = 0;
        gParSys.waves[waveNr][waveAxis].am.amp = 0;
        gParSys.waves[waveNr][waveAxis].am.freq = 0;
        gParSys.waves[waveNr][waveAxis].fm.base = 0;
        gParSys.waves[waveNr][waveAxis].fm.amp = 0;
        gParSys.waves[waveNr][waveAxis].fm.freq = 0;

        displayPreset();
    });

    $(".waveBaseAM").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var waveNr = get1stFromName(name) - 1;
        var waveAxis = getAxisAsNrFromName(name);

        gParSys.waves[waveNr][waveAxis].am.base = v;
    });

    $(".waveBaseFM").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var waveNr = get1stFromName(name) - 1;
        var waveAxis = getAxisAsNrFromName(name);

        gParSys.waves[waveNr][waveAxis].fm.base = v;
    });

    $(".waveAmpAM").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var waveNr = get1stFromName(name) - 1;
        var waveAxis = getAxisAsNrFromName(name);

        gParSys.waves[waveNr][waveAxis].am.amp = v;
    });

    $(".waveAmpFM").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var waveNr = get1stFromName(name) - 1;
        var waveAxis = getAxisAsNrFromName(name);

        gParSys.waves[waveNr][waveAxis].fm.amp = v;
    });

    $(".waveFreqAM").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var waveNr = get1stFromName(name) - 1;
        var waveAxis = getAxisAsNrFromName(name);

        gParSys.waves[waveNr][waveAxis].am.freq = v;
    });

    $(".waveFreqFM").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var waveNr = get1stFromName(name) - 1;
        var waveAxis = getAxisAsNrFromName(name);

        gParSys.waves[waveNr][waveAxis].fm.freq = v;
    });

    // transmaps
    $("#lstTransMapStyle").change(function () {
        var v = parseInt($(this).val());

        gTransMapStyle = v;

        calcTransMap();
    });


    $("#chkTransMapFilter").change(function () {
        gTransMapFilter = $("#chkTransMapFilter").is(':checked');
    });

    $("#chkTransMapMode").change(function () {
        gTransMapMode = $("#chkTransMapMode").is(':checked') ? TransMapMode.tmmApplyBefore : TransMapMode.tmmApplyAfter;
    });

    $("#txtTransMapCenterX").change(function () {
        var v = parseFloat($(this).val());

        gPreset.ZoomCenterX = v;

        calcTransMap();
    });

    $("#txtTransMapCenterY").change(function () {
        var v = parseFloat($(this).val());

        gPreset.ZoomCenterY = v;

        calcTransMap();
    });

    $("#chkTransMapMode").change(function () {
        gTransMapMode = $("#chkTransMapMode").is(':checked') ? TransMapMode.tmmApplyBefore : TransMapMode.tmmApplyAfter;
    });

    $(".txtTransXAmp").change(function () {
        var name = $(this).attr('name');
        var v = parseFloat($(this).val());

        var trMapNr = get1stFromName(name);
        var waveNr = get2ndFromName(name) - 1;

        switch (trMapNr) {
            case 1:
                gPreset.SinMagicParams[0][waveNr] = v;
                break;

            case 2:
                gPreset.SinMagicParams2[0][waveNr] = v;
                break;
        }

        calcTransMap();
    });

    $(".txtTransXFreq").change(function () {
        var name = $(this).attr('name');
        var v = $(this).val();

        var trMapNr = get1stFromName(name);
        var waveNr = get2ndFromName(name) - 1;

        switch (trMapNr) {
            case 1:
                gPreset.SinMagicParams[1][waveNr] = v;
                break;

            case 2:
                gPreset.SinMagicParams2[1][waveNr] = v;
                break;
        }

        calcTransMap();
    });

    $(".txtTransYAmp").change(function () {
        var name = $(this).attr('name');
        var v = $(this).val();

        var trMapNr = get1stFromName(name);
        var waveNr = get2ndFromName(name) - 1;

        switch (trMapNr) {
            case 1:
                gPreset.SinMagicParams[2][waveNr] = v;
                break;

            case 2:
                gPreset.SinMagicParams2[2][waveNr] = v;
                break;
        }

        calcTransMap();
    });

    $(".txtTransYFreq").change(function () {
        var name = $(this).attr('name');
        var v = $(this).val();

        var trMapNr = get1stFromName(name);
        var waveNr = get2ndFromName(name) - 1;

        switch (trMapNr) {
            case 1:
                gPreset.SinMagicParams[3][waveNr] = v;
                break;

            case 2:
                gPreset.SinMagicParams2[3][waveNr] = v;
                break;
        }

        calcTransMap();
    });

    //
    $("#world").data("fullscreen",false);

    var gLabVisibleBeforeFs = false;
    var gVisualFxVisibleBeforeFs = false;

    document.addEventListener('fullscreenchange', function () {
        if (document.fullscreenElement) {
            gLabVisibleBeforeFs = $('#pnlLabControls').is(':visible');
            gVisualFxVisibleBeforeFs = $('#pnlVisualFx').is(':visible');
            $('#pnlLabControls').hide();
            $('#pnlVisualFx').hide();
            var savedW = gWidth;
            var savedH = gHeight;
            gWidth = window.innerWidth;
            gHeight = window.innerHeight;
            $("#world").css({ width: gWidth + 'px', height: gHeight + 'px' });
            $('#world').css({
                position: "absolute",
                marginLeft: 0, marginTop: 0,
                top: 0, left: 0
            });
            applyPreset();
            gCanvas.savedWidth = savedW;
            gCanvas.savedHeight = savedH;
            $("#world").data("fullscreen", true);
        } else {
            gWidth = gCanvas.savedWidth;
            gHeight = gCanvas.savedHeight;
            $('#world').css({
                position: "relative",
                width: '100%',
                height: 'auto',
                marginLeft: '',
                marginTop: '',
                top: '',
                left: ''
            });
            applyPreset();
            $("#world").data("fullscreen", false);

            if (gViewMode === 'previewFullscreen') {
                showPreviewAll();
            } else {
                gViewMode = 'main';
            }

            if (gLabVisibleBeforeFs) {
                $('#pnlLabControls').show();
            }
            if (gVisualFxVisibleBeforeFs) {
                $('#pnlVisualFx').show();
            }
        }
    });

    $("#world").get(0).addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        console.warn('PSSS: WebGL context lost');
        if (gRequestID) {
            window.cancelAnimationFrame(gRequestID);
            gRequestID = undefined;
        }
    });

    $("#world").get(0).addEventListener('webglcontextrestored', function () {
        console.log('PSSS: WebGL context restored, reinitializing');
        applyPreset();
    });

    $("#world").click(function () {
        if(!$("#world").data("fullscreen")) {
            if ($('#world')[0].requestFullscreen) {
                $('#world')[0].requestFullscreen();
            } else if ($('#world')[0].webkitRequestFullscreen) {
                $('#world')[0].webkitRequestFullscreen();
            } else if ($('#world')[0].msRequestFullscreen) {
                $('#world')[0].msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    });

    //
    $("#rngFps").on('input', function () {
        gTargetFps = parseInt($(this).val());
        $("#lblFps").text(gTargetFps);
    });

    var fxControls = [
        { chk: '#chkFxGlow', rng: '#rngFxGlow', lbl: '#lblFxGlow', glob: 'gFxGlow' },
        { chk: '#chkFxDepthSize', rng: '#rngFxDepthSize', lbl: '#lblFxDepthSize', glob: 'gFxDepthSize' },
        { chk: '#chkFxStreaks', rng: '#rngFxStreaks', lbl: '#lblFxStreaks', glob: 'gFxStreaks' }
    ];

    fxControls.forEach(function (ctrl) {
        $(ctrl.rng).on('input', function () {
            var val = parseFloat($(this).val());
            $(ctrl.lbl).text(val.toFixed(ctrl.glob === 'gFxGlow' ? 1 : 2));
            if ($(ctrl.chk).is(':checked')) {
                window[ctrl.glob] = val;
            }
        });

        $(ctrl.chk).on('change', function () {
            if ($(this).is(':checked')) {
                window[ctrl.glob] = parseFloat($(ctrl.rng).val());
            } else {
                window[ctrl.glob] = 0;
            }
        });
    });

    $('#selFxPalette').on('change', function () {
        gFxPalette = $(this).val();
        if (gFxPalette !== 'none' && gCanvas instanceof WebGLRenderer) {
            gCanvas.uploadPalette(PALETTES[gFxPalette]);
        }
    });

    $('#selFxPaletteMap').on('change', function () {
        gFxPaletteMapping = $(this).val();
    });

    $('#chkFxSpeedCorr').on('change', function () {
        gFxSpeedCorrection = $(this).is(':checked');
    });

    $('#rngFxSpeedFactor').on('input', function () {
        var val = parseFloat($(this).val());
        $('#lblFxSpeedFactor').text(val.toFixed(1));
        gFxSpeedFactor = val;
    });

    $('#chkFxSpeedFactor').on('change', function () {
        if ($(this).is(':checked')) {
            gFxSpeedFactor = parseFloat($('#rngFxSpeedFactor').val());
        } else {
            gFxSpeedFactor = 1.0;
        }
    });

    // Lab panel — open/close
    $('#cmdLab').click(function () {
        $('#pnlVisualFx').hide();
        var isVisible = $('#pnlLabControls').is(':visible');
        if (!isVisible) {
            switchLabTab(gLabActiveTab || 'mixer');
            if (!gLabActiveTab || gLabActiveTab === 'mixer') {
                var currentPreset = $('#lstParticlePresets').val();
                if (currentPreset) {
                    $('#selLabDeckA').val(currentPreset);
                }
                $('#rngLabCrossfade').val(0);
                $('#lblLabCrossfade').text('0%');
                gLabDirty = false;
                $('#lblLabDirty').hide();
            }
        } else {
            if (gEvoState.active) {
                pauseEvolution();
                hideEvoGrid();
                gEvoState.active = false;
                if (!gRequestID) {
                    gRequestID = window.requestAnimationFrame(drawFrame);
                }
            }
        }
        $('#pnlLabControls').toggle();
    });

    $('#cmdVisualFx').off('click').click(function () {
        $('#pnlLabControls').hide();
        $('#pnlVisualFx').toggle();
    });

    // Lab — Tab switching
    $('.lab-tab').on('click', function () {
        switchLabTab($(this).data('tab'));
    });

    // Lab — Mixer: populate decks
    $.each(g_psss_presets, function (name) {
        $('#selLabDeckA').append($('<option>').val(name).text(name));
        $('#selLabDeckB').append($('<option>').val(name).text(name));
    });

    var labPresetKeys = Object.keys(g_psss_presets);
    if (labPresetKeys.length > 1) {
        $('#selLabDeckA').val(labPresetKeys[0]);
        $('#selLabDeckB').val(labPresetKeys[1]);
    }

    function labApplyMix() {
        var nameA = $('#selLabDeckA').val();
        var nameB = $('#selLabDeckB').val();
        if (!nameA || !nameB) return;
        var presetA = JSON.parse(JSON.stringify(g_psss_presets[nameA]));
        var presetB = JSON.parse(JSON.stringify(g_psss_presets[nameB]));
        var t = parseFloat($('#rngLabCrossfade').val());
        var blended = interpolatePreset(presetA, presetB, t, gLabLocks);
        applyPresetLive(blended);
    }

    $('#rngLabCrossfade').on('input', function () {
        var val = parseFloat($(this).val());
        $('#lblLabCrossfade').text(Math.round(val * 100) + '%');
        gLabDirty = false;
        $('#lblLabDirty').hide();
        labApplyMix();
    });

    $('#selLabDeckA, #selLabDeckB').on('change', function () {
        $('#rngLabCrossfade').val(0);
        $('#lblLabCrossfade').text('0%');
        gLabDirty = false;
        $('#lblLabDirty').hide();
        labApplyMix();
    });

    $('#chkLabLockShape').on('change', function () { gLabLocks.shape = $(this).is(':checked'); });
    $('#chkLabLockColor').on('change', function () { gLabLocks.color = $(this).is(':checked'); });
    $('#chkLabLockMotion').on('change', function () { gLabLocks.motion = $(this).is(':checked'); });
    $('#chkLabLockTransmap').on('change', function () { gLabLocks.transmap = $(this).is(':checked'); });

    // Lab — Randomizer tab locks
    $('#chkRandLockShape').on('change', function () { gLabLocks.shape = $(this).is(':checked'); });
    $('#chkRandLockColor').on('change', function () { gLabLocks.color = $(this).is(':checked'); });
    $('#chkRandLockMotion').on('change', function () { gLabLocks.motion = $(this).is(':checked'); });
    $('#chkRandLockTransmap').on('change', function () { gLabLocks.transmap = $(this).is(':checked'); });

    $('#cmdLabRandSubtle').click(function () {
        gPreset = randomizePreset(gPreset, 'subtle');
        gLabDirty = true;
        $('#lblLabDirty').show();
        applyPresetLive(gPreset);
    });
    $('#cmdLabRandMedium').click(function () {
        gPreset = randomizePreset(gPreset, 'medium');
        gLabDirty = true;
        $('#lblLabDirty').show();
        applyPresetLive(gPreset);
    });
    $('#cmdLabRandWild').click(function () {
        gPreset = randomizePreset(gPreset, 'wild');
        gLabDirty = true;
        $('#lblLabDirty').show();
        applyPresetLive(gPreset);
    });

    // Lab — Styles (Archetype Templates): selector clicks
    $('#pnlArchetypeSelector').on('click', '.archetype-btn', function () {
        selectArchetype(parseInt($(this).data('idx')));
    });

    $('#selArchetypeBase').on('change', function () {
        selectArchetypeBase($(this).val());
    });

    // Lab — Styles: slider input (event delegation for dynamically created sliders)
    $('#pnlArchetypeSliders').on('input', 'input[type="range"]', function () {
        var row = $(this).closest('.archetype-slider-row');
        var idx = parseInt(row.data('idx'));
        var val = parseFloat($(this).val());
        row.find('.arch-val').text(val.toFixed(2));
        applyArchetypeSlider(idx, val);
    });

    // Lab — Styles: Send to buttons
    $('#cmdSendToMixer').click(function () {
        switchLabTab('mixer');
        var currentPreset = $('#lstParticlePresets').val();
        if (currentPreset) {
            $('#selLabDeckA').val(currentPreset);
        }
        $('#rngLabCrossfade').val(0);
        $('#lblLabCrossfade').text('0%');
    });

    $('#cmdSendToEvolution').click(function () {
        if (gArchetypeState.workingPreset) {
            initEvolution(gArchetypeState.workingPreset);
        }
    });

    // Lab — Styles: Sync from current
    $('#cmdSyncStyles').click(function () {
        syncArchetypeFromCurrent();
    });

    // Lab — Sync buttons
    $('#cmdSyncMixer').click(function () {
        var currentPreset = $('#lstParticlePresets').val();
        if (currentPreset) {
            $('#selLabDeckA').val(currentPreset);
        }
        $('#rngLabCrossfade').val(0);
        $('#lblLabCrossfade').text('0%');
        gLabDirty = false;
        $('#lblLabDirty').hide();
    });

    $('#cmdSyncRandomizer').click(function () {
        gLabDirty = false;
        $('#lblLabDirty').hide();
    });

    // Lab — Snapshot & Export
    // Lab — Evolution handlers
    $('#cmdEvoSeedCurrent').click(function () {
        initEvolution(gPreset);
    });

    $('#cmdEvoSurprise').click(function () {
        var keys = Object.keys(g_psss_presets);
        var randomKey = keys[Math.floor(Math.random() * keys.length)];
        initEvolution(g_psss_presets[randomKey]);
    });

    $('#cmdEvoBreed').click(function () {
        breedGeneration();
    });

    $('#cmdEvoReset').click(function () {
        if (gEvoState.seedPreset) {
            initEvolution(gEvoState.seedPreset);
        }
    });

    $('#pnlEvoGrid').on('click', '.evo-tile', function (e) {
        var idx = parseInt($(this).data('idx'));
        if (e.shiftKey) {
            // Shift+click: preview tile full-size
            if (gEvoState.tiles[idx]) {
                var previewPreset = JSON.parse(JSON.stringify(gEvoState.tiles[idx].preset));
                previewPreset.ParticleCount = previewPreset.ParticleCount * 4;
                gPreset = previewPreset;
                applyPreset();
                displayPreset();
            }
        } else {
            evoSelectTile(idx);
        }
    });

    // Lab — Fractal Tab
    var fracSliderRanges = {
        clifford: { min: -3.0, max: 3.0, defaults: [-1.4, 1.6, 1.0, 0.7] },
        dejong: { min: -3.14159, max: 3.14159, defaults: [1.4, -2.3, 2.4, -2.1] },
        lorenz2d: { mins: [1, 10, 0.5, 0.001], maxs: [20, 40, 5, 0.03], defaults: [10, 28, 2.667, 0.01] },
        julia: { mins: [-2, -2, 1.5, 0], maxs: [2, 2, 4, 0], defaults: [-0.7, 0.27015, 2.0, 0] },
        rossler: { mins: [0.1, 0.1, 2, 0.005], maxs: [0.5, 0.5, 18, 0.05], defaults: [0.2, 0.2, 5.7, 0.02] },
        thomas: { mins: [0.1, 0.01, 0, 0], maxs: [0.3, 0.1, 0, 0], defaults: [0.208186, 0.05, 0, 0] },
        halvorsen: { mins: [1.0, 0.001, 0, 0], maxs: [2.5, 0.02, 0, 0], defaults: [1.89, 0.005, 0, 0] },
        aizawa: { mins: [0.5, 0.1, 0.1, 0.005], maxs: [1.5, 1.5, 1.5, 0.05], defaults: [0.95, 0.7, 0.6, 0.01] },
        nosehoover: { mins: [1.0, 0.01, 0, 0], maxs: [2.5, 0.1, 0, 0], defaults: [1.5, 0.05, 0, 0] },
        mandelbrot: { mins: [-2.5, -2, 2, 0], maxs: [1, 2, 4, 0], defaults: [-0.5, 0, 2.5, 0] }
    };

    var juliaPresets = {
        dendrite: { name: 'Dendrite', params: [-0.7, 0.27015, 2.0, 0] },
        spiral: { name: 'Spiral Galaxy', params: [-0.8, 0.156, 2.0, 0] },
        seahorse: { name: 'Sea-Horse', params: [0.285, 0.01, 2.0, 0] },
        rabbit: { name: 'Douady Rabbit', params: [-0.4, 0.6, 2.0, 0] },
        dust: { name: 'Fractal Dust', params: [-0.835, -0.2321, 2.0, 0] },
        sanmarco: { name: 'San Marco', params: [0.0, 0.66, 2.0, 0] },
        lightning: { name: 'Lightning', params: [0.0, -0.66, 2.0, 0] },
        siegel: { name: 'Siegel Disk', params: [-0.391, -0.587, 2.0, 0] },
        pinwheel: { name: 'Pinwheel', params: [-0.1, -0.65, 2.0, 0] },
        snowflake: { name: 'Snowflake', params: [-0.1, 0.65, 2.0, 0] },
        electric: { name: 'Electric', params: [-0.12, -0.65, 2.0, 0] },
        swirl: { name: 'Swirl', params: [0.36, 0.36, 2.0, 0] },
        firework: { name: 'Firework', params: [-0.55, -0.55, 2.0, 0] },
        neuron: { name: 'Neuron', params: [0.0, 0.67, 2.0, 0] },
        basilica: { name: 'Basilica', params: [0.0, -0.67, 2.0, 0] }
    };

    var mandelbrotPresets = {
        full:      { name: 'Full Set',       bounds: [-2.5, -1.5, 1.0, 1.5] },
        seahorse:  { name: 'Seahorse Valley', bounds: [-0.78, -0.16, -0.73, -0.12] },
        elephant:  { name: 'Elephant Valley', bounds: [0.25, -0.05, 0.40, 0.05] },
        antenna:   { name: 'Antenna Tip',    bounds: [-1.80, -0.05, -1.74, 0.05] },
        spirals:   { name: 'Double Spiral',  bounds: [-0.088, 0.654, -0.062, 0.676] },
        minibrot:  { name: 'Mini-brot',      bounds: [-1.790, -0.005, -1.775, 0.005] },
        needle:    { name: 'Needle',         bounds: [-0.752, 0.038, -0.740, 0.048] },
        scepter:   { name: 'Scepter Valley', bounds: [-0.110, 0.920, -0.090, 0.940] },
        lightning: { name: 'Lightning',      bounds: [-0.198, 1.020, -0.170, 1.043] },
        starfish:  { name: 'Starfish',       bounds: [-0.380, 0.660, -0.360, 0.680] },
        galaxy:    { name: 'Spiral Galaxy',  bounds: [-0.760, 0.078, -0.740, 0.095] }
    };

    function updateFracSliderRanges() {
        var type = gFractalType;
        var cfg = fracSliderRanges[type];
        var sliders = ['#rngFracA', '#rngFracB', '#rngFracC', '#rngFracD'];
        var labels = ['#lblFracA', '#lblFracB', '#lblFracC', '#lblFracD'];
        var sliderDivs = [null, null, '#pnlFracSliderC', '#pnlFracSliderD'];
        for (var i = 0; i < 4; i++) {
            if (cfg.mins) {
                $(sliders[i]).attr('min', cfg.mins[i]).attr('max', cfg.maxs[i]);
                $(sliders[i]).attr('step', (cfg.maxs[i] - cfg.mins[i] < 0.5) ? '0.001' : '0.01');
            } else {
                $(sliders[i]).attr('min', cfg.min).attr('max', cfg.max).attr('step', '0.01');
            }
            $(sliders[i]).val(gFractalParams[i]);
            var prec = (cfg.mins && (cfg.maxs[i] - cfg.mins[i] < 0.5)) ? 3 : 2;
            $(labels[i]).text(gFractalParams[i].toFixed(prec));
        }
        var usesC = !cfg.mins || cfg.maxs[2] !== 0;
        var usesD = !cfg.mins || cfg.maxs[3] !== 0;
        $('#pnlFracSliderC').toggle(usesC);
        $('#pnlFracSliderD').toggle(usesD && type !== 'julia' && type !== 'mandelbrot');
        $('#pnlJuliaPreset').toggle(type === 'julia');
        $('#pnlMandelbrotPreset').toggle(type === 'mandelbrot');
    }

    $('#selFractalType').on('change', function () {
        gFractalType = this.value;
        var cfg = fracSliderRanges[gFractalType];
        gFractalParams = cfg.defaults.slice();
        updateFracSliderRanges();
        if (gFractalType === 'mandelbrot') {
            gEscapeFlowGridBounds = mandelbrotPresets.full.bounds.slice();
            $('#selMandelbrotPreset').val('full');
        }
        if (gEscapeFlowEnabled && (gFractalType === 'julia' || gFractalType === 'mandelbrot')) {
            gEscapeFlowGrid = buildEscapeFlowGrid(gFractalType, gFractalParams);
        }
        resetAttractorState();
    });

    $('#selJuliaPreset').on('change', function () {
        var preset = juliaPresets[this.value];
        if (preset) {
            gFractalParams = preset.params.slice();
            var sliders = ['#rngFracA', '#rngFracB', '#rngFracC', '#rngFracD'];
            var labels = ['#lblFracA', '#lblFracB', '#lblFracC', '#lblFracD'];
            for (var i = 0; i < 4; i++) {
                $(sliders[i]).val(gFractalParams[i]);
                $(labels[i]).text(gFractalParams[i].toFixed(2));
            }
            if (gEscapeFlowEnabled) {
                gEscapeFlowGrid = buildEscapeFlowGrid('julia', gFractalParams);
            }
            resetAttractorState();
        }
    });

    $('#selMandelbrotPreset').on('change', function () {
        var preset = mandelbrotPresets[this.value];
        if (preset) {
            gEscapeFlowGridBounds = preset.bounds.slice();
            if (gEscapeFlowEnabled) {
                gEscapeFlowGrid = buildEscapeFlowGrid('mandelbrot', gFractalParams);
            }
            resetAttractorState();
        }
    });

    function rebuildEscapeGridIfNeeded() {
        if (gEscapeFlowEnabled && (gFractalType === 'julia' || gFractalType === 'mandelbrot')) {
            gEscapeFlowGrid = buildEscapeFlowGrid(gFractalType, gFractalParams);
        }
    }

    $('#rngFracA').on('input', function () {
        gFractalParams[0] = parseFloat(this.value);
        $('#lblFracA').text(gFractalParams[0].toFixed(gFractalType === 'lorenz2d' ? 1 : 2));
        rebuildEscapeGridIfNeeded();
        resetAttractorState();
    });
    $('#rngFracB').on('input', function () {
        gFractalParams[1] = parseFloat(this.value);
        $('#lblFracB').text(gFractalParams[1].toFixed(gFractalType === 'lorenz2d' ? 1 : 2));
        rebuildEscapeGridIfNeeded();
        resetAttractorState();
    });
    $('#rngFracC').on('input', function () {
        gFractalParams[2] = parseFloat(this.value);
        $('#lblFracC').text(gFractalParams[2].toFixed(gFractalType === 'lorenz2d' ? 1 : 2));
        resetAttractorState();
    });
    $('#rngFracD').on('input', function () {
        gFractalParams[3] = parseFloat(this.value);
        var prec = (gFractalType === 'lorenz2d' && 3 === 3) ? 3 : 2;
        $('#lblFracD').text(gFractalParams[3].toFixed(prec));
        resetAttractorState();
    });

    $('#rngFracBlend').on('input', function () {
        gFractalBlend = parseInt(this.value) / 100;
        $('#lblFracBlend').text(parseInt(this.value) + '%');
    });

    $('#cmdFracRandomize').click(function () {
        randomizeAttractor();
    });

    $('#cmdFracToEvolution').click(function () {
        sendFractalToEvolution();
    });

    // Lab — Snapshot & Export
    $('#cmdLabSnapshot').click(function () {
        captureSnapshot();
    });

    $('#cmdLabExport').click(function () {
        exportPresetAsFile();
    });

    // Import/Export Presets (top-level toolbar)
    $('#cmdImportPreset').click(function () {
        $('#fileImportPreset').val('');
        $('#fileImportPreset').click();
    });

    $('#fileImportPreset').on('change', function () {
        var file = this.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            importPresetFromFile(e.target.result);
        };
        reader.readAsText(file);
    });

    $('#cmdExportPresets').click(function () {
        exportAllPresets();
    });

    $("#pnlSettings").toggle();
    var defSelect='Quantum Mathematic';
    $("#lstParticlePresets").val(defSelect);
    selectPreset(defSelect);
    displayPreset();
}

//------------------------------------------------------------------------------
window.onload = function () {
    start();
};