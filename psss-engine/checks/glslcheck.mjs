// Guards the defect class that typecheck cannot see: a GLSL uniform/varying that is USED but never
// DECLARED. Shaders are template-literal strings, so tsc never parses them, and the failure only appears at
// runtime as a shader-compile error. This bit during B14 — `uSplatPaletteTex` was sampled but undeclared.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Resolve against THIS FILE's location so the checker works from `npm run` (cwd = package root)
// and from `node checks/x.mjs` alike.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SRC = join(HERE, '..', 'src') + '/';

/*
 * ⚠️ **THIS LIST IS THE CHECKER'S WHOLE SCOPE, AND A NEW SHADER FILE IS INVISIBLE UNTIL ADDED — A SILENT
 * COVERAGE GAP, NOT A FAILURE.** `dye-field.ts` shipped three shaders on 2026-09-03 (v8 15.7) and this
 * checker reported a contented `3 passed` over 41 shaders in 6 files without ever reading them. A
 * used-but-undeclared uniform there fails exactly as `uSplatPaletteTex` did: `tsc` cannot see inside a
 * template literal, `compileProgram()` throws nothing, and every draw becomes a silent no-op.
 *
 * ⚠️ **`physarum.ts` and `fluid-advection.ts` were added 2026-09-05 (v8 9.3), and ADDING THEM REQUIRED A
 * CHANGE TO THE USE-SCAN — listing them alone would have been a coverage gap that LOOKED closed.** Both name
 * their shader identifiers in snake_case (`u_trail`, `a_pos`, `v_uv`) while the seven original files use
 * camelCase (`uSplatPaletteTex`), and the scan below matched `[uav][A-Z]` only. So the two files would have
 * raised `totalShaders` by 15 while asserting NOTHING about them: `CLAUDE.md`'s anchor-that-matched-nothing
 * shape, which passes green forever. **The shader count moving is not evidence that coverage moved — check
 * that the scan's own pattern can reach the new file's naming convention.**
 *
 * ⚠️ **`post-processors/reel-crossfade.ts` was added 2026-09-12 (v8 Phase 19) and its identifiers WERE read
 * first, per the rule below: `uSrc`, `uFreeze`, `uWeight`, `vUv`, `aPos` — camelCase, so the existing
 * `[uav][A-Z]` use-scan reaches them and listing the file actually closes the gap rather than only raising
 * `totalShaders`. That check is the point of the paragraph above; do not skip it for the next file.
 *
 * **Add a file here in the same commit that adds its shaders**, and read its identifiers first.
 */
const FILES = [
  'renderers/hdr-particle.ts',
  'renderers/ribbon-renderer.ts',
  'renderers/neon-line-renderer.ts',
  'ui/preview-grid/grid-tile-renderer.ts',
  'post-processors/tone-map.ts',
  'post-processors/bloom.ts',
  'post-processors/dye-field.ts',
  'generators/physarum.ts',
  'post-processors/fluid-advection.ts',
  'post-processors/reel-crossfade.ts',
];

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

// Pull every `#version 300 es` shader body out of the template literals.
function shaders(txt) {
  const out = [];
  const re = /`(#version 300 es[\s\S]*?)`/g;
  let m;
  while ((m = re.exec(txt))) out.push(m[1]);
  return out;
}

// GLSL builtins and keywords that look like identifiers but need no declaration.
const BUILTIN = new Set([
  'gl_Position','gl_PointCoord','gl_PointSize','gl_FragCoord','gl_InstanceID','gl_VertexID','gl_FrontFacing',
  'texture','textureSize','mix','clamp','smoothstep','step','length','normalize','dot','cross','pow','exp',
  'log','log2','exp2','sqrt','inversesqrt','abs','sign','floor','ceil','fract','mod','min','max','round',
  'sin','cos','tan','asin','acos','atan','discard','return','if','else','for','while','break','continue',
  'void','main','float','int','uint','bool','vec2','vec3','vec4','ivec2','ivec3','ivec4','mat2','mat3','mat4',
  'sampler2D','in','out','uniform','const','precision','highp','mediump','lowp','true','false','layout',
  'dFdx','dFdy','fwidth','reflect','refract','faceforward','transpose','inverse','determinant','distance',
  'radians','degrees','sinh','cosh','tanh','isnan','isinf','trunc','modf','frexp','ldexp','packHalf2x16',
  'unpackHalf2x16','bitfieldReverse','findLSB','findMSB','struct','switch','case','default','do',
]);

let totalShaders = 0, problems = [];
for (const f of FILES) {
  const txt = readFileSync(SRC + f, 'utf8');
  for (const sh of shaders(txt)) {
    totalShaders++;
    /*
     * Strip COMMENTS ONCE, and derive BOTH the declarations and the uses from the stripped source.
     *
     * A comment that merely MENTIONS uIceOpacity is not a use, and counting it produced a false
     * positive on this check's first run — which is why the stripping was introduced.
     *
     * ⚠️ **BUT IT WAS ONLY APPLIED TO THE USES, AND THAT ASYMMETRY WAS ITSELF A DEFECT. Found by
     * Phase 27.2, 2026-10-18.** The declared-set pattern begins `\b(?:uniform|in|out|const)\s+`, so
     * the ordinary English word **"in"** inside a comment starts a match: in
     * `// see the derivation in SPLAT_VERT_SRC`, `in` is the keyword, `SPLAT_VERT_SRC` is taken as the
     * type, and the capture group then swallows the FIRST WORD AFTER THE COMMENT. When the next line
     * was `uniform float uCoreBrightness;` the regex captured `uniform` as a declared NAME and
     * consumed the keyword, so the real declaration could never match — and the check reported
     * **"uses uCoreBrightness but never declares it"** about a line declaring it eleven characters
     * later.
     *
     * ⚠️ **A prose word in a comment poisoned a text scan and the symptom pointed at an innocent
     * identifier.** `CLAUDE.md` records the same shape in `facetcheck` §B, where a field name
     * followed by a colon inside the very comment warning about it did the same thing. **The fix is
     * structural rather than a reword: a declaration cannot live in a comment, so the declared set
     * must never be read from one.**
     */
    const code = sh.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

    // Declared names: uniforms, ins, outs, and locals — all from `code`, never from `sh`.
    const declared = new Set();
    for (const m of code.matchAll(/\b(?:uniform|in|out|const)\s+(?:lowp\s+|mediump\s+|highp\s+)?\w+\s+(\w+)/g)) declared.add(m[1]);
    for (const m of code.matchAll(/^\s*(?:lowp\s+|mediump\s+|highp\s+)?(?:float|int|uint|bool|vec[234]|ivec[234]|mat[234])\s+(\w+)\s*[=;]/gm)) declared.add(m[1]);
    // also `for (int i = ...)` and multi-declarations
    for (const m of code.matchAll(/for\s*\(\s*\w+\s+(\w+)/g)) declared.add(m[1]);
    for (const m of code.matchAll(/\b(?:float|int|vec[234])\s+(\w+)\s*,\s*(\w+)/g)) { declared.add(m[1]); declared.add(m[2]); }
    // Names that LOOK like engine identifiers and are used. TWO conventions, because the engine has two:
    // camelCase (`uSplatPaletteTex`, the seven original files) and snake_case (`u_trail`, `a_pos`, `v_uv` —
    // `physarum.ts` and `fluid-advection.ts`). ⚠️ **The snake_case alternative is what makes those two files
    // actually checked; without it they are read, counted and scanned for nothing.**
    for (const m of code.matchAll(/\b([uav](?:[A-Z]|_)\w*)\b/g)) {
      const name = m[1];
      if (BUILTIN.has(name) || declared.has(name)) continue;
      problems.push(`${f}: uses ${name} but never declares it`);
    }
  }
}

console.log(`Scanned ${totalShaders} GLSL shaders across ${FILES.length} files\n`);
const uniq = [...new Set(problems)];
chk('every u*/a*/v* identifier used in a shader is also declared', uniq.length === 0,
  uniq.length ? uniq.slice(0, 6).join(' | ') : 'no undeclared identifiers');

// ---------------------------------------------------------------------------
// A boolean SELECT must not be written as an arithmetic mix (2026-08-23).
//
// ⚠️ This is not a style rule. `mix(x, y, bvecN)` selects; `mix(x, y, vecN(bvecN))` computes
// `x*(1-a) + y*a`, and `NaN * 0.0 == NaN` — so casting the bvec made `sanitiseTrail()` return the very NaN it
// had just detected. Invariant 20's containment was inert for its entire existence, in all four copies at
// once, and the `?gldiag=1` capture that found it reported `nan = 4096/4096` with `trip = 0` on every stage
// because a guard whose release value is NaN cannot be distinguished from no guard at all.
//
// It is a TEXT GREP over one file, and deliberately narrow: it asserts the shape of the three selects in
// `TRAIL_SANITISE_GLSL`, which is where the defect was and where a future edit is most likely to reintroduce
// it (the cast LOOKS like a required type conversion, and both spellings compile).
const GUARD = readFileSync(SRC + 'core/gl-program.ts', 'utf8');
const guardCode = GUARD.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const arithSelects = [...guardCode.matchAll(/mix\s*\([^;]*?vec[234]\s*\(\s*(nan|huge|mark)\s*\)/g)].map(m => m[1]);
chk('TRAIL_SANITISE_GLSL selects with a bvec, never a vec(bvec) cast — NaN*0.0 is NaN',
  arithSelects.length === 0,
  arithSelects.length ? `arithmetic mix on: ${arithSelects.join(', ')} — the guard returns NaN` : 'all 3 selects are boolean');
// The three selects must still BE there: a `mix(..., bvecN)` deleted outright would also pass the test above.
const boolSelects = [...guardCode.matchAll(/mix\s*\([^;]*?,\s*(nan|huge|mark)\s*\)/g)].map(m => m[1]);
chk('all 3 boolean selects are present (nan, huge, mark)',
  ['nan', 'huge', 'mark'].every(n => boolSelects.includes(n)),
  `found: ${boolSelects.join(', ') || 'none'}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
