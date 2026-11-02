// Guards the defect that turned the preview black: in a multi-sampler GLSL program, EVERY sampler must be
// explicitly assigned a texture unit. An unassigned sampler defaults to unit 0, colliding with whatever else
// lives there — and some drivers resolve the whole draw to black rather than ignoring the unused sampler.
//
// Neither tsc nor the build can see this: samplers are declared in template-literal strings and assigned via
// gl.uniform1i at runtime.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Resolve against THIS FILE's location so the checker works from `npm run` (cwd = package root)
// and from `node checks/x.mjs` alike.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SRC = join(HERE, '..', 'src') + '/';
const hdr = readFileSync(SRC + 'renderers/hdr-particle.ts', 'utf8');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

const progs = {
  point: [hdr.indexOf('const FRAG_SRC'), hdr.indexOf('const SPLAT_VERT_SRC')],
  splat: [hdr.indexOf('const SPLAT_FRAG_SRC'), hdr.indexOf('const VOLUME_ACCUM_VERT')],
  volume: [hdr.indexOf('const VOLUME_ACCUM_FRAG'), hdr.indexOf('const VOLUME_RESOLVE')],
};

console.log('=== Samplers per program, and whether each is assigned a unit ===\n');
for (const [name, [a, b]] of Object.entries(progs)) {
  const src = hdr.slice(a, b);
  const samplers = [...src.matchAll(/uniform sampler2D (\w+)/g)].map(m => m[1]);
  if (!samplers.length) continue;
  console.log(`  ${name}: ${samplers.join(', ')}`);
  for (const s of samplers) {
    // The CPU must call getUniformLocation for it AND uniform1i it somewhere.
    const located = new RegExp(`getUniformLocation\\([^)]*'${s}'\\)`).test(hdr);
    chk(`    ${name}.${s} has its location queried`, located);
  }
  if (samplers.length > 1) {
    console.log(`    (${samplers.length} samplers -> an unassigned one defaulting to unit 0 would collide)`);
  }
}

console.log('\n=== The specific regression: splat palette sampler must be assigned UNCONDITIONALLY ===');
// The uniform handle is `this.splatUSplatPaletteTex`; it was `sp14.__uSplatPaletteTex` until triage I2
// typed the whole `__`-prefixed stash as private fields. This assertion is about the bind/assign pair
// sitting OUTSIDE the palOn branch, not about how the location is stored, so match the call loosely on
// the uniform NAME and keep the structural part strict.
const splatBind = /gl\.activeTexture\(gl\.TEXTURE3\);\s*\n\s*gl\.bindTexture\(gl\.TEXTURE_2D, palOn === 1 \? this\.paletteTexture : this\.rampTexture\);\s*\n\s*gl\.uniform1i\([^,]*SplatPaletteTex[^,]*, 3\);/.test(hdr);
chk('uSplatPaletteTex is bound and assigned outside any palOn branch', splatBind,
  'inside the branch it defaulted to unit 0, on top of uRampTex -> black draw');
chk('a texture is always bound to unit 3 (ramp as stand-in when no palette)', /palOn === 1 \? this\.paletteTexture : this\.rampTexture/.test(hdr),
  'an incomplete texture unit also samples black');
chk('the active unit is restored to 0 afterwards', /gl\.uniform1i\([^,]*SplatPaletteTex[^,]*, 3\);\s*\n[\s\S]{0,400}?gl\.activeTexture\(gl\.TEXTURE0\);/.test(hdr),
  'activeTexture is global GL state; later passes bind by unit');

console.log('\n=== Unit allocation is collision-free in the splat program ===');
const units = { 0: 'uRampTex', 1: 'uSmokeRampTex', 2: 'uCrystalRampTex', 3: 'uSplatPaletteTex' };
for (const [u, nm] of Object.entries(units)) {
  chk(`unit ${u} -> ${nm}`, new RegExp(`__?u?${nm.slice(1)}[^,]*, ${u}\\)`).test(hdr) || new RegExp(`uniform1i\\([^,]*${nm.slice(1)}[^,]*, ${u}\\)`).test(hdr),
    'each sampler on its own unit');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
