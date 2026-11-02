// Guards the defect that blacked the preview: two draw passes SHARE splatVao, so every enabled attribute in
// that VAO is read by BOTH draws. If one pass forgets to upload a buffer, that draw reads the other pass's
// data — and since the two passes have very different instance counts, it reads out of bounds. Undefined
// behaviour; in practice it took the whole frame black.
//
// Invisible to tsc and to the build: it is a runtime data-length mismatch, not a type error.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Resolve against THIS FILE's location so the checker works from `npm run` (cwd = package root)
// and from `node checks/x.mjs` alike.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SRC = join(HERE, '..', 'src') + '/';
const hdr = readFileSync(SRC + 'renderers/hdr-particle.ts', 'utf8');
const lines = hdr.split('\n');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

// 1. Which per-instance attributes does splatVao enable? Read the init block.
const initStart = hdr.indexOf('private initSplat(');
const initEnd = hdr.indexOf('private ', initStart + 20);
const init = hdr.slice(initStart, initEnd);
const attribs = [...init.matchAll(/getAttribLocation\(this\.splatProgram, '(\w+)'\)/g)].map(m => m[1]);
const divisored = [...init.matchAll(/vertexAttribDivisor\((\w+), 1\)/g)].map(m => m[1]);

console.log(`splatVao enables ${attribs.length} attributes:\n  ${attribs.join(', ')}\n`);
console.log(`per-instance (divisor 1): ${divisored.length}\n`);

// 2. Map each attribute to the buffer field it is bound to, then check BOTH draw passes upload it.
// The nine splat buffers are private FIELDS on the renderer (`this.splatXxxBuffer`). They were stashed
// on the VAO as `(this.splatVao as any).__xxxBuffer` until triage I2 typed them; that stash is what let
// three of them go missing from dispose()'s release list unnoticed. This check is about WHICH passes
// upload each buffer, not about how the handle is stored, so match on the field name.
const buffers = [...init.matchAll(/^\s*this\.(splat\w+Buffer) = /gm)].map(m => m[1]);
console.log(`splat VAO buffer fields: ${buffers.join(', ')}\n`);
if (buffers.length < 9) {
  chk('all nine splat buffer fields are assigned in initSplat', false,
    `found ${buffers.length} — has the assignment style changed?`);
}

function bodyOf(name) {
  const a = hdr.indexOf(`private ${name}(`);
  if (a < 0) return '';
  // next `private ` at the same indent
  const b = hdr.indexOf('\n  private ', a + 10);
  return hdr.slice(a, b > a ? b : hdr.length);
}
const splatBody = bodyOf('renderSplat');
const crystalBody = bodyOf('renderCrystalPass');

// PER-INSTANCE buffers only. `splatQuadBuffer` backs `aQuadPos`, which is `divisor 0` (per-VERTEX) and
// STATIC_DRAW — the same 4-vertex template for every instance and every pass, correctly uploaded once at
// init. Requiring a per-pass re-upload of it was a false positive on this check's first run.
const PER_VERTEX = new Set(['splatQuadBuffer']);
console.log('=== Every PER-INSTANCE VAO buffer must be uploaded by BOTH passes ===');
for (const b of buffers) {
  if (PER_VERTEX.has(b)) { console.log(`  skip  ${b} — per-vertex, static, uploaded once at init`); continue; }
  const inSplat = splatBody.includes(b);
  const inCrystal = crystalBody.includes(b);
  chk(`${b} uploaded by renderSplat AND renderCrystalPass`, inSplat && inCrystal,
    `splat:${inSplat ? 'yes' : 'NO'} crystal:${inCrystal ? 'yes' : 'NO'}`);
}
// the temperature buffer is a direct field rather than VAO-stashed
chk('temperatureBuffer uploaded by both passes',
  splatBody.includes('temperatureBuffer') && crystalBody.includes('temperatureBuffer'));

console.log('\n=== The three B14/B16 attributes specifically ===');
for (const [attr, buf] of [['aSplatVelocity', 'splatVelBuffer'], ['aColorSplat', 'splatColBuffer'], ['aSplatAge', 'splatAgeBuffer']]) {
  chk(`${attr} -> ${buf} fed in the crystal pass`, crystalBody.includes(buf),
    'the crystal pass draws far fewer instances, so a stale longer buffer is read out of range');
}

console.log('\n=== Crystal-pass uploads must be sized to ITS OWN instance count (n), not state.count ===');
const crystalUploads = [...crystalBody.matchAll(/bufferData\(gl\.ARRAY_BUFFER, ([^,]+),/g)].map(m => m[1].trim());
const badSize = crystalUploads.filter(u => u.includes('state.count'));
chk('no crystal-pass upload uses state.count', badSize.length === 0,
  badSize.length ? badSize.join(', ') : 'all sized to n or a local');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
