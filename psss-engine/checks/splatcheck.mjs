#!/usr/bin/env node
/**
 * splatcheck — the Phase 27 properties, every one of which fails SILENTLY.
 *
 * Phase 27 changed three things in the splat/grading path and none of them can announce its own
 * breakage: a tone curve whose matrices can be transposed and still render, an energy factor whose
 * absence looks like a brightness choice, and a shear control that reverts on a renderer rebuild.
 * `tsc` sees inside none of them — two live in GLSL template literals and the third is a boolean
 * field whose loss is invisible until someone changes render mode and the look quietly goes back.
 *
 * ⚠️ **SECTION E IS CALIBRATION AND IT IS NOT OPTIONAL.** Every clause below is re-run against a
 * seeded copy of the source that breaks exactly the property it claims to measure, and a seed that
 * PASSES is reported as a failure of this file. `CLAUDE.md`'s rule, earned repeatedly in this tree:
 * *a measuring section's own basis has been the defect repeatedly — read a failure as a claim about
 * the checker until it is exonerated, and seeds do not protect the checker's own figures.*
 *
 * ⚠️ **THESE ARE TEXT ASSERTIONS OVER SOURCE, so a behaviour-neutral rename breaks them.** Read the
 * assertion before believing a red is a regression. Each clause names the defect it was written for.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const rd = (p) => readFileSync(join(SRC, p), 'utf8');

const TONE = rd('post-processors/tone-map.ts');
const HDR = rd('renderers/hdr-particle.ts');
const MAIN = rd('main.ts');
const RULES = rd('exploration/overlay-rules.ts');

let passed = 0;
const problems = [];
const ok = (name, detail) => { passed++; console.log(`  PASS  ${name}${detail ? `   ${detail}` : ''}`); };
const bad = (name, detail) => { problems.push(`${name} — ${detail}`); console.log(`  FAIL  ${name}   ${detail}`); };
const assert = (cond, name, detail) => (cond ? ok(name, detail) : bad(name, detail));

/** Pull a backtick-delimited `#version 300 es` shader body by the const that owns it. */
function shader(txt, constName) {
  const i = txt.indexOf(`const ${constName}`);
  if (i < 0) return '';
  const open = txt.indexOf('`', i);
  const close = txt.indexOf('`', open + 1);
  return open < 0 || close < 0 ? '' : txt.slice(open + 1, close);
}

/** Pull a function body out of TS by brace matching from its declaration. */
function fnBody(txt, decl) {
  const i = txt.indexOf(decl);
  if (i < 0) return '';
  let j = txt.indexOf('{', i);
  if (j < 0) return '';
  let depth = 0;
  for (let k = j; k < txt.length; k++) {
    if (txt[k] === '{') depth++;
    else if (txt[k] === '}') { depth--; if (depth === 0) return txt.slice(j, k + 1); }
  }
  return '';
}

/*
 * The clause set, as data, so section E can re-run every one of them against a seeded source.
 * Each entry: a name, the probe, and the seed that must break it.
 */
const CLAUSES = [
  // ── A. 27.1 — the fit itself ───────────────────────────────────────────────────────────────────
  {
    name: 'A1: the published AP1 input/output matrices are both present',
    why: 'a revert to the single-rational fit renders perfectly and only the highlights differ',
    probe: (s) => s.TONE.includes('ACES_IN_MAT') && s.TONE.includes('ACES_OUT_MAT')
      && s.TONE.includes('0.59719') && s.TONE.includes('1.60475'),
    seed: (s) => ({ ...s, TONE: s.TONE.replace('0.59719', '0.99999') }),
  },
  {
    name: 'A2: the superseded single-rational constants are ABSENT',
    why: 'both fits compile and both look plausible, so the old one coming back is invisible',
    probe: (s) => !/float\s+a\s*=\s*2\.51/.test(s.TONE),
    seed: (s) => ({ ...s, TONE: s.TONE.replace('vec3 rrtAndOdtFit', 'float a = 2.51;\nvec3 rrtAndOdtFit') }),
  },
  {
    name: 'A3: the RRT+ODT polynomial keeps its published coefficients',
    why: 'a mistyped coefficient shifts every highlight and throws nothing',
    probe: (s) => s.TONE.includes('0.0245786') && s.TONE.includes('0.983729')
      && s.TONE.includes('0.000090537') && s.TONE.includes('0.238081'),
    seed: (s) => ({ ...s, TONE: s.TONE.replace('0.0245786', '0.0245787') }),
  },
  {
    /*
     * ⚠️ THE SHARPEST CLAUSE IN THIS FILE, and it exists because the mistake is SILENT AND PLAUSIBLE.
     * HLSL fills `float3x3` by ROWS and `mul(M, v)` is row-dot-vector; GLSL's `mat3` fills COLUMNS.
     * Copying the published rows straight into `mat3(...)` therefore applies the TRANSPOSE — a
     * believable colour shift with no error anywhere. The test is positional: in COLUMN order the
     * second number of the input matrix is 0.07600; in ROW order it would be 0.35458.
     */
    name: 'A4: the matrices are written COLUMN-wise, not transposed',
    why: 'the transpose renders fine and merely shifts colour — the defect has no error message',
    probe: (s) => {
      const m = s.TONE.match(/ACES_IN_MAT\s*=\s*mat3\(([^)]*)\)/);
      if (!m) return false;
      const n = m[1].split(',').map((x) => x.trim());
      return n[1] === '0.07600' && n[3] === '0.35458';
    },
    seed: (s) => ({
      ...s,
      TONE: s.TONE.replace(/ACES_IN_MAT\s*=\s*mat3\([^)]*\)/,
        'ACES_IN_MAT = mat3(\n  0.59719, 0.35458, 0.04823,\n  0.07600, 0.90834, 0.01566,\n  0.02840, 0.13383, 0.83777)'),
    }),
  },

  // ── B. 27.1 — the NaN guard (27.D10) ──────────────────────────────────────────────────────────
  {
    name: 'B1: the NaN test is the portable not(equal(x, x)) pair, not isnan()',
    why: 'gl-program.ts records isnan() as permitted to be unreliable under finite-math assumptions',
    probe: (s) => /not\s*\(\s*equal\s*\(\s*x\s*,\s*x\s*\)\s*\)/.test(s.TONE),
    seed: (s) => ({ ...s, TONE: s.TONE.replace(/not\s*\(\s*equal\s*\(\s*x\s*,\s*x\s*\)\s*\)/, 'bvec3(isnan(x))') }),
  },
  {
    name: 'B2: the select is the bvec overload — no vec3(not(...)) cast anywhere',
    why: 'invariant 20: mix(a, b, vec3(bvec3)) blends arithmetically and is a NO-OP for NaN',
    probe: (s) => !/vec[234]\s*\(\s*not\s*\(/.test(s.TONE),
    seed: (s) => ({ ...s, TONE: s.TONE.replace('not(equal(x, x))', 'vec3(not(equal(x, x)))') }),
  },
  {
    name: 'B3: the input clamp runs BEFORE the rational step, not after',
    why: 'the pre-27.1 clamp ran after the division, which cannot recover Inf/Inf — the whole point',
    probe: (s) => {
      const body = s.TONE.slice(s.TONE.indexOf('vec3 acesToneMap'));
      const end = body.indexOf('\n}');
      const fn = body.slice(0, end < 0 ? body.length : end);
      const c = fn.indexOf('ACES_IN_CEIL');
      const r = fn.indexOf('rrtAndOdtFit');
      return c >= 0 && r >= 0 && c < r;
    },
    seed: (s) => ({
      ...s,
      TONE: s.TONE.replace(
        '  x = clamp(x, 0.0, ACES_IN_CEIL);           // and this catches Inf\n  x = ACES_IN_MAT * x;\n  x = rrtAndOdtFit(x);',
        '  x = ACES_IN_MAT * x;\n  x = rrtAndOdtFit(x);\n  x = clamp(x, 0.0, ACES_IN_CEIL);'),
    }),
  },

  // ── C. 27.2 — the energy factor ───────────────────────────────────────────────────────────────
  {
    /*
     * ⚠️ The plan's own wording for 27.2 said "both shader stages or neither", written on the
     * assumption that both SIZE the quad. They do not: SPLAT_VERT_SRC sizes and SPLAT_FRAG_SRC
     * shapes, so the real property is a PAIR — the vertex computes the factor, the fragment applies
     * it — and a checker asserting "the same term twice" would have been asserting a fiction.
     */
    name: 'C1: the vertex stage derives vEnergyScale from widthBoost and aspect',
    why: 'without it the fragment multiplies by an undeclared-or-stale varying and nothing throws',
    probe: (s) => {
      const v = shader(s.HDR, 'SPLAT_VERT_SRC');
      return /vEnergyScale\s*=\s*1\.0\s*\/\s*max\([^)]*widthBoost\s*\*\s*widthBoost\s*\*\s*aspect/.test(v);
    },
    // ⚠️ The first version of this seed replaced the phrase 'widthBoost * widthBoost * aspect', whose
    // FIRST occurrence is in the explanatory comment above the assignment — so it mutated prose, left the
    // code intact, and section E caught the clause as uncalibrated. Anchor on the assignment.
    seed: (s) => ({
      ...s,
      HDR: s.HDR.replace(
        'vEnergyScale = 1.0 / max(1e-4, widthBoost * widthBoost * aspect);',
        'vEnergyScale = 1.0 / max(1e-4, widthBoost * aspect);'),
    }),
  },
  {
    name: 'C2: the varying is declared out in the vertex stage and in in the fragment stage',
    why: 'one half alone is a link error in GL but silent in tsc, and GL logs nothing on a no-op link',
    probe: (s) => shader(s.HDR, 'SPLAT_VERT_SRC').includes('out float vEnergyScale')
      && shader(s.HDR, 'SPLAT_FRAG_SRC').includes('in float vEnergyScale'),
    seed: (s) => ({ ...s, HDR: s.HDR.replace('in float vEnergyScale;', '// removed by seed') }),
  },
  {
    name: 'C3: the fragment GATES the factor on uIsAdditive',
    why: 'ungated it scales outA too, so an alpha-blend splat becomes more TRANSPARENT when stretched — a different quantity',
    probe: (s) => /if\s*\(\s*uIsAdditive\s*>\s*0\.5\s*\)\s*shape\s*\*=\s*vEnergyScale/.test(shader(s.HDR, 'SPLAT_FRAG_SRC')),
    seed: (s) => ({ ...s, HDR: s.HDR.replace('if (uIsAdditive > 0.5) shape *= vEnergyScale;', 'shape *= vEnergyScale;') }),
  },
  {
    name: 'C4: the factor is applied AFTER the discard test, so the footprint is unchanged',
    why: 'applied before it, dim fragments drop under the threshold and the splat silently SHRINKS — a geometry change wearing a brightness change’s clothes',
    probe: (s) => {
      const f = shader(s.HDR, 'SPLAT_FRAG_SRC');
      const d = f.indexOf('if (shape < 0.01) discard;');
      const a = f.indexOf('shape *= vEnergyScale');
      return d >= 0 && a >= 0 && d < a;
    },
    // ⚠️ The first version INSERTED a second copy before the discard and failed to delete the real one,
    // so the later occurrence still satisfied d < a and the clause passed on a seeded defect. MOVE it.
    seed: (s) => {
      // THREE repairs, each recorded because this file caught every one of them in itself:
      //  (1) the first seed INSERTED a copy and failed to delete the original, so the later
      //      occurrence still satisfied d < a and the clause passed on a seeded defect;
      //  (2) a newline escape lost a backslash level in transit and wrote a REAL newline into a
      //      string literal, which is a syntax error — hence String.fromCharCode throughout;
      //  (3) THE SOURCE FILE IS CRLF. A bare-newline match found nothing, so the delete was a no-op,
      //      and anchoring the insert on the discard line hit its FIRST FILE-WIDE occurrence, which
      //      is in a different shader entirely. Both endings are tried, and the insert anchors on the
      //      unique float-shape statement instead.
      const NL = String.fromCharCode(10);
      const CR = String.fromCharCode(13);
      const line = '  if (uIsAdditive > 0.5) shape *= vEnergyScale;';
      const anchor = 'float shape = mix(circularShape, flameShape, blend);';
      const stripped = s.HDR.includes(line + CR + NL)
        ? s.HDR.replace(line + CR + NL, '')
        : s.HDR.replace(line + NL, '');
      if (stripped === s.HDR) return { ...s };   // nothing removed -> section E reports it uncalibrated
      return { ...s, HDR: stripped.replace(anchor, anchor + NL + line) };
    },
  },

  {
    /*
     * ⚠️ THIS CLAUSE EXISTS BECAUSE 27.2's FIRST BUILD HAD THE DEFECT, found 2026-10-19 while
     * documenting 27.6 — and no clause above could have caught it, because every one of them reads
     * the LIVE path and the defect was in the path that overrides it. The crystal branch rebuilds
     * the quad from `baseSize` alone, so a crystal receives neither widthBoost nor aspect; without
     * the override it is still divided by their product. Reachable on several shipped materials
     * (additive, velocityStretch 0.8-1.0) at roughly a sixth of the intended intensity, and it
     * would read as a crystal-opacity bug rather than as an energy-normalisation one.
     *
     * The probe is POSITIONAL on purpose: `rotated = crystalPos;` occurs only in the frozen branch,
     * so requiring the override to follow it asserts the override is INSIDE that branch. A bare
     * "the file contains vEnergyScale = 1.0" would also pass with the line at top level, which
     * would silently disable the whole of 27.2.
     */
    name: 'C5: the crystal branch overrides vEnergyScale to 1.0 — it received no stretch',
    why: 'without it a crystal is divided by an area ratio describing a quad it never had, and only when the material stretches',
    probe: (s) => {
      const v = shader(s.HDR, 'SPLAT_VERT_SRC');
      const r = v.indexOf('rotated = crystalPos;');
      const o = v.indexOf('vEnergyScale = 1.0;');
      return r >= 0 && o > r;
    },
    seed: (s) => ({ ...s, HDR: s.HDR.replace('vEnergyScale = 1.0;', '// removed by seed') }),
  },

  // ── D. 27.6 — the shear control ───────────────────────────────────────────────────────────────
  {
    name: 'D1: the perp line branches on uSplatShearFixed, and the uniform is declared',
    why: 'a dropped branch leaves the control live in the UI and inert in the picture — invariant 13',
    probe: (s) => {
      const v = shader(s.HDR, 'SPLAT_VERT_SRC');
      return v.includes('uniform float uSplatShearFixed')
        && /vec2 perp\s*=\s*\(\s*uSplatShearFixed\s*>\s*0\.5\s*\)\s*\?/.test(v);
    },
    seed: (s) => ({ ...s, HDR: s.HDR.replace(/vec2 perp\s*=\s*\(\s*uSplatShearFixed[^;]*;/, 'vec2 perp = vec2(-dir.y, dir.x);') }),
  },
  {
    /*
     * ⚠️ THE ONE PROPERTY IN THIS FILE THAT NO COMPILER AND NO OTHER CHECKER CAN SEE. The renderer's
     * `splatShearFixed` is a plain boolean, so it survives `dispose()` — but `reinitRenderer()` builds
     * a NEW renderer whose field starts at its initialiser. Without the re-hand, a render-mode change
     * reverts the nib look and the control reads as having forgotten itself. Invariant 2.
     */
    name: 'D2: reapplyRendererState re-hands setSplatShear (invariant 2)',
    why: 'a renderer rebuilt without it silently reverts the look on a render-mode change',
    probe: (s) => fnBody(s.MAIN, 'function reapplyRendererState').includes('setSplatShear'),
    seed: (s) => ({
      ...s,
      MAIN: s.MAIN.replace("    renderer.setSplatShear(splatShear === 'fixed');\n", '', 1),
    }),
  },
  {
    name: 'D3: splatShear has an overlay rule whose law is snap, not lerp',
    why: 'invariant 16 — the Mixer must SNAP a categorical at t=0.5; a blended two-way choice is meaningless',
    probe: (s) => /splatShear:\s*\{[^}]*law:\s*\{\s*kind:\s*'snap'\s*\}/.test(s.RULES),
    seed: (s) => ({ ...s, RULES: s.RULES.replace(/(splatShear:\s*\{[^}]*law:\s*\{\s*kind:\s*')snap('\s*\})/, "$1lerp$2") }),
  },
  {
    name: 'D4: the apply site defaults to tangent, so a preset omitting the key is unchanged',
    why: 'a default of fixed would silently restyle every material preset in the library',
    probe: (s) => /splatShear\s*=\s*preset\.overlay\?\.splatShear\s*\?\?\s*'tangent'/.test(s.MAIN),
    seed: (s) => ({ ...s, MAIN: s.MAIN.replace("preset.overlay?.splatShear ?? 'tangent'", "preset.overlay?.splatShear ?? 'fixed'") }),
  },
  {
    name: 'D5: the export path writes splatShear',
    why: 'omitted, Export and Snapshot disagree with the live state for any preset switched back deliberately',
    probe: (s) => /^\s*splatShear,\s*$/m.test(s.MAIN),
    seed: (s) => ({ ...s, MAIN: s.MAIN.replace(/^(\s*)splatShear,\s*$/m, '$1// removed by seed') }),
  },
];

const SOURCES = { TONE, HDR, MAIN, RULES };

console.log('\n=== A–D. the Phase 27 properties ===\n');
for (const c of CLAUSES) assert(c.probe(SOURCES), c.name, c.why);

/*
 * ⚠️ SECTION E — every clause above re-run against a source seeded to break exactly what it claims
 * to measure. A seed that PASSES means the clause is asserting something other than what it says,
 * and is reported as a failure of THIS FILE rather than of the engine.
 */
console.log('\n=== E. CALIBRATION — every clause seeded and shown to FAIL (a seed that passes is a FAIL) ===\n');
let calibrated = 0;
for (const c of CLAUSES) {
  let seeded;
  try { seeded = c.seed(SOURCES); } catch (e) {
    bad(`CALIB ${c.name}`, `the seed itself threw: ${e.message}`);
    continue;
  }
  const changed = Object.keys(SOURCES).some((k) => seeded[k] !== SOURCES[k]);
  if (!changed) {
    bad(`CALIB ${c.name}`, 'the seed changed NOTHING — it no longer matches the source, so this clause is uncalibrated');
    continue;
  }
  if (c.probe(seeded)) {
    bad(`CALIB ${c.name}`, 'the seeded defect PASSED — the clause does not measure what it claims');
  } else {
    calibrated++;
    console.log(`  CALIB  ${c.name}   seeded defect caught`);
  }
}

console.log('');
if (problems.length > 0) {
  console.log(`splatcheck FAILED — ${problems.length} problem(s):\n`);
  for (const p of problems) console.log(`  ${p}`);
  console.log('\n⚠️  Read the assertion before believing this is a regression: these are TEXT assertions over');
  console.log('   source, so a behaviour-neutral rename breaks them. Each clause names its own defect.');
  process.exit(1);
}
console.log(`PASS  splatcheck: ${passed} passed, 0 failed, ${calibrated} calibrated`);
