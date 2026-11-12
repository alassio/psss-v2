// The decisive check: every per-instance buffer uploaded for a draw of N instances must hold >= N elements.
// ANGLE reports a short buffer as
//   GL_INVALID_OPERATION: Vertex buffer is not big enough for the draw call
// and DROPS THE WHOLE DRAW — a black frame, with no exception thrown in JS. Neither tsc nor the build can see
// this: it is a runtime length mismatch between a typed array and a draw count.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Resolve against THIS FILE's location so the checker works from `npm run` (cwd = package root)
// and from `node checks/x.mjs` alike.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SRC = join(HERE, '..', 'src') + '/';
const hdr = readFileSync(SRC + 'renderers/hdr-particle.ts', 'utf8');
const gen = readFileSync(SRC + 'generators/lissajous.ts', 'utf8');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

console.log('=== Which GeneratorState arrays does lissajous.ts extend to totalCount? ===\n');
// The concatenating branch rebuilds arrays at totalCount. Anything NOT rebuilt stays at particleCount.
const concat = gen.slice(gen.indexOf('const totalCount'), gen.indexOf('count: totalCount,'));
const extended = [];
for (const name of ['positions', 'colors', 'depths', 'velocities', 'velocityDirs', 'temps', 'lifetimes']) {
  const re = new RegExp(`${name} = new Float32Array\\(totalCount`);
  if (re.test(concat)) extended.push(name);
}
console.log('  extended to totalCount:', extended.join(', '));
const notExtended = ['positions', 'colors', 'depths', 'velocities', 'velocityDirs', 'temps', 'lifetimes']
  .filter(n => !extended.includes(n));
console.log('  NOT extended        :', notExtended.join(', ') || '(none)');
console.log();
chk('lifetimes is NOT extended (so consumers must pad it)', notExtended.includes('lifetimes'),
  'it is published straight from MaterialProcessor at particleCount length');

console.log('\n=== Every per-instance upload in renderSplat must be sized to state.count ===');
function bodyOf(name) {
  const a = hdr.indexOf(`private ${name}(`);
  const b = hdr.indexOf('\n  private ', a + 10);
  return hdr.slice(a, b > a ? b : hdr.length);
}
const splat = bodyOf('renderSplat');
// Extract `bufferData(gl.ARRAY_BUFFER, <expr>, ...)` and judge each expression.
const uploads = [...splat.matchAll(/bufferData\(gl\.ARRAY_BUFFER, ([^,]+),/g)].map(m => m[1].trim());
const SAFE = [
  /^pos2d$/,                       // built at state.count * 2
  /^temperatures$/,                // `state.temperatures ?? new Float32Array(state.count)`
  /^state\.velocities$/,           // extended to totalCount
  /^state\.colors$/,               // extended to totalCount
  /^state\.depths$/,               // extended to totalCount
  /^velDirs$/,                     // `state.velocityDirs ?? new Float32Array(state.count * 2)`
  /^this\.frozenAttrBuf$/,         // resized against state.count
  /^this\.growthAttrBuf$/,         // resized against state.count
  /^splatAges$/,                   // padded to state.count (this fix)
  /*
   * v8 31.2 — the packed per-particle channels. ⚠️ **AN ALLOWLIST ENTRY THAT IS NOT RE-DERIVED IS A
   * LICENCE, NOT A CHECK**, so the derivation is here and the three clauses below ASSERT it rather than
   * trusting this line: `resolveChannels()` returns `subarray(0, state.count * 3)` on both of its paths —
   * the published-array path and the neutral-pad path — so the expression cannot be short by construction.
   * **This entry records that the clause below is what makes it safe.**
   */
  /^this\.resolveChannels\(state\)$/,
  /*
   * M7 (2026-11-12) — `fitTo(a, len)` is `a.length > len ? a.subarray(0, len) : a`: it NEVER returns fewer elements
   * than `a` had up to `len`, so an upload that was count-safe as `state.X` stays count-safe as `fitTo(state.X, …)`
   * (and stops uploading the grow-only scratch's stale tail). ⚠️ The regex above stops at the first comma, so these
   * see `fitTo(state.X`; the clause after the loop asserts `fitTo`'s definition, so this entry is DERIVED, not trusted.
   */
  /^fitTo\(state\.(depths|velocities|colors|temperatures|velocityDirs)$/,
];
for (const u of uploads) {
  const ok = SAFE.some(re => re.test(u));
  chk(`upload "${u}" is sized to state.count`, ok,
    ok ? '' : 'VERIFY: could this be shorter than state.count?');
}
// The derivation the `fitTo` allowlist entry rests on: it only ever TRIMS (M7).
chk('fitTo only trims: `a.length > len ? a.subarray(0, len) : a` (so a fitTo upload is never shorter than its source)',
  /function fitTo\(a: Float32Array, len: number\): Float32Array \{\s*return a\.length > len \? a\.subarray\(0, len\) : a;\s*\}/.test(hdr),
  'a fitTo that could return fewer than min(a.length, len) elements would make every upload it wraps short — ANGLE then drops the draw');

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * v8 31.2 — the packed channel buffer: the newest instance of this file's whole subject
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **THE SAFE-LIST ABOVE ADMITTED `this.resolveChannels(state)` ON A DERIVATION, AND THESE CLAUSES ARE
 * WHAT MAKE THAT ADMISSION A CHECK.** The grep can only see the call; what matters is what the callee
 * returns, and there are three distinct ways to get it wrong — a short return, a truthy-but-short input
 * waved through, and a ZERO pad where the neutral value is 1.
 */
console.log('\n=== v8 31.2: the packed channel buffer is sized AND neutral on every path ===\n');
{
  const res = bodyOf('resolveChannels');
  chk('resolveChannels bounds BOTH returns by state.count * 3',
    /const need = state\.count \* 3;/.test(res)
    && (res.match(/subarray\(0, need\)/g) || []).length >= 2,
    'the published-array path and the neutral-pad path are two separate returns, and only one of them '
    + 'being bounded is the shape a reader skims past — both must be, or the feature-on case and the '
    + 'feature-off case have different lengths and exactly one of them drops the draw');

  chk('...and it treats a truthy-but-SHORT published array like a missing one (invariant 6\'s wording)',
    /src && src\.length >= need/.test(res) && !/if \(!state\.channels\)/.test(res),
    'the generator publishes a subarray of GROW-ONLY scratch, so a well-formed short array is the '
    + 'reachable case and `!channels` would wave it through — the same defect the point path\'s '
    + '`!ages || ages.length < state.count` test exists for');

  chk('...and the neutral pad is filled with ONES, never zeros',
    /this\.channelPad\.fill\(1\)/.test(res) && /this\.channelPad\.fill\(1, 0, need\)/.test(res),
    '⚠️ these three floats are MULTIPLIERS (size, alpha, lightness), so the neutral value is 1. A zero '
    + 'pad is the correct LENGTH and an invisible figure — a black frame that logs nothing, which is the '
    + 'worst failure shape in this engine. The other pads in this file are zeros because their consumers '
    + 'read them additively; copying that choice here is the mistake this clause catches');

  chk('...and the pad is re-filled on REUSE, not only on growth (invariant 7)',
    /} else \{[\s\S]{0,400}?this\.channelPad\.fill\(1, 0, need\);/.test(res),
    'the pad is grow-only scratch and the crystal pass writes its own prefix into it, so a stale value '
    + 'from a larger previous frame is reachable inside the range this call publishes');

  // ⚠️ INVARIANT 6 IN ITS EXACT WORDING: two passes sharing a VAO must BOTH upload every per-instance
  // buffer. The crystal pass shares `splatVao`, so it is the third upload site and the easiest to forget.
  const crystalBody = bodyOf('renderCrystalPass');
  // ⚠️ M7 (2026-11-12): the POINT pass uploads `channels` (= `resolveChannels(state)`, which still runs every frame)
  // and SKIPS the upload only while the GPU copy is already the all-ones pad at >= state.count — guarded by
  // `pointChannelOnesLen < state.count`. Its VAO is shared only with the liquid accumulation, which draws <= that
  // count right after, so the buffer is correct for every draw either way.
  chk('all THREE passes upload the channel buffer (point, splat, crystal)',
    /const channels = this\.resolveChannels\(state\);/.test(hdr)
    && (hdr.match(/this\.channelsBuffer\);\s*\r?\n\s*gl\.bufferData\(gl\.ARRAY_BUFFER, channels, gl\.DYNAMIC_DRAW\)/g) ?? []).length === 2
    && /this\.pointChannelOnesLen < state\.count/.test(hdr)
    &&/this\.splatChannelsBuffer\);\s*\n\s*gl\.bufferData\(gl\.ARRAY_BUFFER, this\.resolveChannels\(state\)/.test(hdr)
    && /this\.splatChannelsBuffer\);\s*\n\s*gl\.bufferData\(gl\.ARRAY_BUFFER, this\.channelPad\.subarray\(0, n \* 3\)/.test(crystalBody),
    'the crystal pass SHARES splatVao, so every enabled attribute in that VAO is read by its draw too — '
    + 'and it draws `n` crystals rather than state.count, so it needs its OWN shorter upload. Leaving '
    + 'the material pass\'s longer array bound is what turned the whole preview black in Phase 8a');

  chk('...and the crystal pass uses the ONES pad rather than the crystalZeros3 buffer beside it',
    !/splatChannelsBuffer\);\s*\n\s*gl\.bufferData\(gl\.ARRAY_BUFFER, this\.crystalZeros3/.test(crystalBody),
    'the three palette attributes two lines above it DO take crystalZeros3, correctly — they are read by '
    + 'a branch the crystal path never takes, so zeros are merely a length. Reusing that buffer here '
    + 'would set every crystal to size 0, and the asymmetry is invisible to a reader skimming the block');
}

console.log('\n=== The specific bug: splat age must be padded, not passed raw ===');
chk('splat does NOT upload state.lifetimes raw', !/bufferData\(gl\.ARRAY_BUFFER, state\.lifetimes/.test(splat),
  'raw upload is particleCount long while the draw is state.count -> short buffer -> dropped draw');
chk('splat pads via splatAgePad', /this\.splatAgePad/.test(splat));
chk('the pad is resized against state.count', /this\.splatAgePad\.length !== state\.count/.test(hdr));

console.log('\n=== The point path has the same trap ===');
const point = hdr.slice(hdr.indexOf('render(state: GeneratorState'), hdr.indexOf('private renderVolume'));
chk('point treats a SHORT lifetimes array like a missing one',
  /!ages \|\| ages\.length < state\.count/.test(hdr),
  'a truthy-but-short array would otherwise pass the `!ages` guard');

console.log('\n=== Crystal pass: uploads sized to its own n, not state.count ===');
const crystal = bodyOf('renderCrystalPass');
const cUploads = [...crystal.matchAll(/bufferData\(gl\.ARRAY_BUFFER, ([^,]+),/g)].map(m => m[1].trim());
const bad = cUploads.filter(u => /state\.(count|lifetimes|colors|velocities)/.test(u));
chk('no crystal upload uses a state.* array directly', bad.length === 0, bad.join(', ') || 'all local/n-sized');

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * NeonLineRenderer — the GPU-built trails (2026-11-05): the history TEXTURE must cover every slot the draw reads
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **This section's subject was the CPU vertex prefix — the zero-margin invariant-6 relationship between
 * `vertexFloats` and `indexCount` — until the quads moved into the vertex shader.** There is no vertex buffer
 * any more, so that hazard is gone, and the section now holds the hazards the new design HAS, each silent:
 *   - the draw reads `count × 7` instances through `texelFetch` from a texture of `TRAIL × planeRows × TEX_W`
 *     texels; a slot beyond the texture reads ZERO, which is a degenerate quad at the origin with a live alpha
 *     (a bright dot), not an error;
 *   - `TEX_W` and the trail length are written in TypeScript AND in GLSL, with no compiler between the copies;
 *   - the per-frame upload must be the plane written THIS frame, or every trail lags or tears by one sample.
 * The equivalence with the CPU renderer it replaced (291 800 quads, 0 mismatches, corners within 1.2e-4 px,
 * calibrated by a seeded off-by-one head) is the private probe `equivalence.mjs` (not published).
 */
console.log('\n=== NeonLineRenderer: the history texture covers every slot the draw reads ===\n');
/*
 * ⚠️ **Every clause below reads the COMMENT-STRIPPED source** — a doc comment naming a thing it warns about is a
 * false failure for an ABSENCE clause and a false pass for a PRESENCE one.
 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const neonRaw = readFileSync(SRC + 'renderers/neon-line-renderer.ts', 'utf8');
const neon = stripComments(neonRaw);
const tsNum = (name) => { const m = neon.match(new RegExp(`const ${name} = (\\d+)`)); return m ? Number(m[1]) : NaN; };
const glNum = (name) => { const m = neonRaw.match(new RegExp(`const int ${name} = (\\d+);`)); return m ? Number(m[1]) : NaN; };
const TRAIL = tsNum('TRAIL_LENGTH'), TEXW = tsNum('TEX_W');
chk('TRAIL_LENGTH and TEX_W agree between the TypeScript and the GLSL copies',
  Number.isFinite(TRAIL) && TRAIL === glNum('TRAIL') && Number.isFinite(TEXW) && TEXW === glNum('TEX_W'),
  `TS TRAIL_LENGTH=${TRAIL} TEX_W=${TEXW} · GLSL TRAIL=${glNum('TRAIL')} TEX_W=${glNum('TEX_W')} — no compiler `
  + 'compares these, and a mismatch reads samples from the wrong row');
chk('TEX_W is even and within the WebGL2 MAX_TEXTURE_SIZE floor (2048)',
  TEXW % 2 === 0 && TEXW <= 2048, 'odd would split a sample across rows; above 2048 a conforming GPU may refuse the texture');

if (Number.isFinite(TRAIL) && Number.isFinite(TEXW)) {
  /*
   * MEASURED: replay the capacity arithmetic (`ensureHistoryCapacity`) over a randomised history of counts and
   * assert the texture always holds every slot the draw reads. The rows and the doubling are copied from the
   * renderer's own expressions below, which the source clauses then hold in place.
   */
  let broken = 0, cases = 0;
  for (let seed = 1; seed <= 400; seed++) {
    let rnd = (seed * 2654435761) % 2147483647;
    const next = () => ((rnd = (rnd * 48271) % 2147483647) / 2147483647);
    let cap = 0, rows = 0;
    for (let step = 0; step < 30; step++) {
      const count = Math.floor(next() * 200000);
      if (count > cap) { cap = Math.max(count, cap * 2, 1024); rows = Math.ceil((2 * cap) / TEXW); }
      cases++;
      if (2 * count > rows * TEXW) broken++;
    }
  }
  chk('the texture holds every slot the draw reads, for every count sequence (measured, 12 000 cases)',
    broken === 0 && cases === 12000, `${broken} broken of ${cases}`);
  let seededBroken = 0;
  for (let count = 1000; count < 200000; count += 997) { const rows = Math.floor((2 * count) / TEXW); if (2 * count > rows * TEXW) seededBroken++; }
  chk('CALIB: rows computed with floor instead of ceil leaves slots outside the texture',
    seededBroken > 0, `${seededBroken} counts would read past the texture — a bright dot at the origin, not an error`);
}

chk('the capacity arithmetic in the renderer is the replayed one (ceil, doubling, a floor of 1024)',
  /const cap = Math\.max\(slots, this\.capacitySlots \* 2, 1024\);/.test(neon)
  && /const rows = Math\.ceil\(\(2 \* cap\) \/ TEX_W\);/.test(neon),
  'if the renderer drifts from the expressions replayed above, the measured clause is about a different design');
chk('the draw is bounded by the SEEDED slots, never by the capacity',
  /const count = Math\.min\(trajectoryCount\(state\), this\.historySlots\);/.test(neon)
  && /drawArraysInstanced\(gl\.TRIANGLE_STRIP, 0, 4, count \* SEGMENTS_PER_PARTICLE\)/.test(neon),
  'drawing up to the capacity would read never-seeded slots: zero samples, i.e. dots at the origin');
chk('the per-frame upload is the plane written THIS frame (the one before the advanced head)',
  /const plane = \(this\.historyHead \+ TRAIL_LENGTH - 1\) % TRAIL_LENGTH;/.test(neon),
  'uploading the head itself would ship the OLDEST plane and leave the newest sample on the CPU');
chk('a reallocation, a re-seed or a newly seeded slot forces a WHOLE-texture upload',
  (neon.match(/this\.fullUpload = true;/g) ?? []).length >= 3,
  'a seeded ring written on the CPU but never uploaded would draw the previous occupant\'s trail');
chk('the texture and its capacity die together in dispose() (invariants 1 and 3)',
  /this\.histTexture = null;/.test(neon.slice(neon.indexOf('dispose()')))
  && /this\.capacitySlots = 0;/.test(neon.slice(neon.indexOf('dispose()'))),
  'a live capacity over a fresh texture would skip the allocation and upload into nothing');
chk('the sampler unit is assigned every render and activeTexture is restored to unit 0 (invariant 4)',
  /gl\.uniform1i\(this\.uHist, HIST_UNIT\);/.test(neon) && /gl\.activeTexture\(gl\.TEXTURE0\);/.test(neon),
  'a sampler left on unit 0, or a unit left active, is the multi-sampler black frame');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
