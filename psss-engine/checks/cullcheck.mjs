// The cull sentinel (`CULL_SENTINEL`, -10000) is the position written for a particle behind the camera.
// NOTHING TESTS FOR THE VALUE — every consumer relies on it being far enough off-screen that the
// consumer's OWN guard rejects it. That makes the magnitude load-bearing and completely invisible to tsc:
// lowering it toward the screen edge is a valid number, a valid type and a valid draw, and produces a
// stray bright dot or a line stitched across the figure.
//
// This checker asserts the two halves that keep it correct:
//   1. there is exactly ONE definition and no file re-inlines the literal;
//   2. the magnitude still clears every consumer guard, with the guards READ OUT OF THE SOURCE rather
//      than restated here — so raising a guard's multiplier without raising the sentinel fails.
//
// Added by triage I13, whose row was "the cull sentinel -10000 is a magic value with no consumer test".
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src') + '/';
const read = (p) => readFileSync(SRC + p, 'utf8');

const proj = read('core/projection.ts');
const gen = read('generators/lissajous.ts');
const pool = read('crystal/crystal-pool.ts');
const neon = read('renderers/neon-line-renderer.ts');
const ribbon = read('renderers/ribbon-renderer.ts');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

console.log('=== cullcheck: one definition, no re-inlined literals ===');

const defMatch = proj.match(/export const CULL_SENTINEL = (-?\d+)/);
chk('CULL_SENTINEL is defined in core/projection.ts', !!defMatch);
if (!defMatch) { console.log('\n0 passed, 1 failed'); process.exit(1); }
const SENTINEL = Math.abs(Number(defMatch[1]));
console.log(`  |CULL_SENTINEL| = ${SENTINEL}\n`);

// Both projecting files must reach it by import. A re-inlined literal is the defect this replaced: the
// value was duplicated across 8 sites in 2 files, so a change could be applied to one and not the other.
for (const [name, src] of [['generators/lissajous.ts', gen], ['crystal/crystal-pool.ts', pool]]) {
  chk(`${name} imports CULL_SENTINEL`, /import \{ CULL_SENTINEL \} from/.test(src));
  // Strip comments before looking for the literal — the doc comments legitimately mention it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const inlined = [...code.matchAll(/-10000*\b/g)].length;
  chk(`${name} has no re-inlined -10000 literal`, inlined === 0,
    inlined ? `${inlined} occurrence(s) — use the constant` : 'all sites use the constant');
}

console.log('\n=== The magnitude must clear every consumer guard ===');
console.log('  guards are parsed from source, so raising one without raising the sentinel FAILS\n');

// A guard is a fraction of the canvas diagonal. Evaluate each at the LARGEST canvas the engine is
// expected to run at; the sentinel has to beat all of them there, not merely at 1024x768.
const MAX_DIAG = Math.hypot(3840, 2160); // 4K, 4406 px

// 1. lissajous.ts velocity outlier cap — `diag * 0.1`, above which velocities[i] is zeroed. This is
//    what stops a culled particle registering as a huge frame-to-frame step, and is the reason no
//    `distance^2 > 900` test exists here despite older docs describing one.
const capM = gen.match(/const outlierCap = Math\.sqrt\([^)]*\)[^*]*\*\s*([\d.]+)/);
chk('lissajous.ts outlierCap multiplier is parseable', !!capM, capM ? `${capM[1]} * diag` : 'pattern drifted');
if (capM) {
  const g = MAX_DIAG * Number(capM[1]);
  chk(`sentinel clears the velocity outlier cap`, SENTINEL > g,
    `${SENTINEL} vs ${g.toFixed(0)} px (${(SENTINEL / g).toFixed(1)}x)`);
}

// 2/3. The two trajectory renderers' teleport ceilings. Both are `(diag * k) ** 2` compared against a
//      squared step, so the linear threshold is `diag * k`. Neon DROPS the segment; ribbon sets alpha=0.
for (const [name, src] of [['NeonLineRenderer', neon], ['RibbonRenderer', ribbon]]) {
  const ms = [...src.matchAll(/\(diag \* ([\d.]+)\) \*\* 2/g)].map(m => Number(m[1]));
  chk(`${name} teleport ceiling is parseable`, ms.length > 0,
    ms.length ? `diag * ${Math.max(...ms)}` : 'pattern drifted — is it still (diag * k) ** 2?');
  if (ms.length) {
    const g = MAX_DIAG * Math.max(...ms);
    chk(`sentinel clears ${name}'s teleport ceiling`, SENTINEL > g,
      `${SENTINEL} vs ${g.toFixed(0)} px (${(SENTINEL / g).toFixed(1)}x)`);
  }
}

// 4. The viewport itself — the TIGHTEST margin, and the one that scales with the user's monitor rather
//    than with a constant in this repo. Clip-space rejection is what discards the fragment.
chk('sentinel clears a 4K viewport diagonal', SENTINEL > MAX_DIAG,
  `${SENTINEL} vs ${MAX_DIAG.toFixed(0)} px (${(SENTINEL / MAX_DIAG).toFixed(2)}x) — an 8K canvas leaves only 1.13x`);

// 5. Depth is still written for a culled slot, so the crystal pass's back-to-front sort keeps a total
//    order. A slot skipped here would sort against a stale depth from a previous crystal.
chk('lissajous.ts still writes depth for a culled particle',
  /this\.positions\[idx \+ 2\] = z;[\s\S]{0,80}?\}\s*\n\s*\/\/ Depth normalized/.test(gen)
  || gen.includes('CULL_SENTINEL;\n        this.positions[idx + 2] = z;'),
  'a culled slot must keep a finite depth or the crystal sort loses its total order');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
