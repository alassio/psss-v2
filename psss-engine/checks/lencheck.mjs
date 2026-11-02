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
];
for (const u of uploads) {
  const ok = SAFE.some(re => re.test(u));
  chk(`upload "${u}" is sized to state.count`, ok,
    ok ? '' : 'VERIFY: could this be shorter than state.count?');
}

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
  chk('all THREE passes upload the channel buffer (point, splat, crystal)',
    /this\.channelsBuffer\);\s*\n\s*gl\.bufferData\(gl\.ARRAY_BUFFER, this\.resolveChannels\(state\)/.test(hdr)
    && /this\.splatChannelsBuffer\);\s*\n\s*gl\.bufferData\(gl\.ARRAY_BUFFER, this\.resolveChannels\(state\)/.test(hdr)
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
 * NeonLineRenderer — the invariant-6 relationship that became ZERO-MARGIN on 2026-09-24
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **Why this section exists, and why it is not in the file it is about.** Until 2026-09-24 the neon
 * pass allocated both geometry arrays at the FULL worst case every frame and uploaded them whole, so its
 * vertex buffer was over-sized by however many segments had been skipped. That margin was accidental —
 * nothing asserted it — but it meant the invariant-6 hazard this whole file exists for could not bite.
 * The D1 performance fix replaced it with a ranged upload sized to exactly the written prefix, which is
 * correct by a DERIVATION rather than by a margin: `vertexFloats` and `indexCount` are incremented by the
 * same loop iteration, so the largest index the draw can read is exactly one less than the number of
 * vertices uploaded. **A margin is visible to a reader; a derivation is not.** Neon had no section here
 * at all before, so the file scanned two of the three paths that do this and reported green.
 *
 * The measured clause below is the one that matters: it replays the counter arithmetic over randomised
 * SKIP patterns, because every way of getting this wrong is a counter that moves on a skip when the other
 * does not — which is the defect the renderer's own comment records as "every subsequent segment's indices
 * point 4 vertices too far ... the figure appears partly missing". A grep for the upload call cannot see
 * it; only replaying the two counters against each other can.
 */
console.log('\n=== NeonLineRenderer: the vertex prefix must cover every index the draw reads ===\n');
/*
 * ⚠️ **Every clause below reads the COMMENT-STRIPPED source, and the first run of this section is why.**
 * The `baseVert` clause failed on the renderer's own explanatory comment, which names the variable in order
 * to say it was removed — a doc comment legitimately mentioning the thing it warns about, exactly the trap
 * `cullcheck` records for the `-10000` literal. For an ABSENCE clause that is a false failure; for the
 * PRESENCE clauses it would be worse, a false pass, since a call named only in a comment would satisfy them.
 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const neon = stripComments(readFileSync(SRC + 'renderers/neon-line-renderer.ts', 'utf8'));
const neonNum = (name) => {
  const m = neon.match(new RegExp(`const ${name} = (\\d+)`));
  return m ? Number(m[1]) : NaN;
};
// Parsed, never transcribed — a constant changed in the renderer must move this test, not break it.
const VPS = neonNum('VERTS_PER_SEGMENT');
const IPS = neonNum('INDICES_PER_SEGMENT');
const FPV = neonNum('FLOATS_PER_VERTEX');
chk('the three geometry constants are parseable from the renderer',
  Number.isFinite(VPS) && Number.isFinite(IPS) && Number.isFinite(FPV),
  `VERTS_PER_SEGMENT=${VPS} INDICES_PER_SEGMENT=${IPS} FLOATS_PER_VERTEX=${FPV}`);

if (Number.isFinite(VPS) && Number.isFinite(IPS) && Number.isFinite(FPV)) {
  // MEASURED: replay the counters over random skip patterns. `written` counts the segments that emitted
  // geometry; a skip must advance NEITHER counter.
  let worstSlack = Infinity, cases = 0, broken = 0;
  for (let seed = 1; seed <= 400; seed++) {
    let rnd = seed * 2654435761 % 2147483647;
    const next = () => ((rnd = (rnd * 48271) % 2147483647) / 2147483647);
    const segments = 1 + Math.floor(next() * 500);
    let vertexFloats = 0, indexCount = 0;
    for (let s = 0; s < segments; s++) {
      if (next() < 0.35) continue;                 // the frozen / teleport skip
      vertexFloats += VPS * FPV;                   // four vertices written
      indexCount += IPS;                           // ...and their indices consumed
    }
    if (indexCount === 0) continue;
    cases++;
    // The index pattern's j-th segment addresses vertices [4j, 4j+3], so the largest index read is:
    const maxIndexRead = (indexCount / IPS) * VPS - 1;
    const verticesUploaded = vertexFloats / FPV;
    const slack = verticesUploaded - 1 - maxIndexRead;
    if (slack < 0) broken++;
    worstSlack = Math.min(worstSlack, slack);
  }
  chk('the prefix covers the draw for every skip pattern (measured, 400 randomised cases)',
    broken === 0 && cases > 300,
    `${cases} cases, worst slack ${worstSlack} vertices — 0 is CORRECT here and is the zero margin: `
    + 'a negative slack is the dropped draw, a positive one would mean an index is never reached');

  /*
   * CALIBRATION. The clause above asserts a NON-NEGATIVE slack over arithmetic this file supplies itself, so
   * on its own it proves only that the arithmetic is self-consistent — it would read green against a replay
   * that could not go wrong. Seeding the historical defect (a skip that consumes indices without writing
   * vertices) shows the slack actually goes negative, i.e. that the clause has something to catch.
   */
  let seededWorst = Infinity;
  for (let seed = 1; seed <= 50; seed++) {
    let rnd = seed * 2654435761 % 2147483647;
    const next = () => ((rnd = (rnd * 48271) % 2147483647) / 2147483647);
    let vertexFloats = 0, indexCount = 0;
    for (let s = 0; s < 200; s++) {
      if (next() < 0.35) { indexCount += IPS; continue; }   // ← the seeded desync
      vertexFloats += VPS * FPV;
      indexCount += IPS;
    }
    seededWorst = Math.min(seededWorst, vertexFloats / FPV - 1 - ((indexCount / IPS) * VPS - 1));
  }
  chk('CALIB: a skip that advances only the index cursor drives the slack NEGATIVE',
    seededWorst < 0,
    `worst seeded slack ${seededWorst} vertices — the draw would read that many vertices past the upload, `
    + 'which ANGLE answers by dropping the whole draw with a clean console');

  // SOURCE-SHAPED, and these three catch what the arithmetic cannot: that the SHIPPED code still derives
  // both counters from one loop rather than from two.
  chk('`buildGeometry` returns the written prefix, not a fresh array',
    /return \{ vertexFloats: vIdx, indexCount: iIdx \};/.test(neon),
    'a return of `{ vertices, indices }` is the pre-D1 shape — 19 MB/frame of upload and a full-worst-case alloc');
  chk('the index count advances by the CONSTANT, in the same iteration as the vertex writes',
    /iIdx \+= INDICES_PER_SEGMENT;/.test(neon),
    'if these two counters ever come from different loops the derivation above stops holding');
  chk('no `baseVert` variable has come back',
    !/baseVert/.test(neon),
    '⚠️ `baseVert` was the per-frame index cursor, and advancing it on a skip desynchronised it from the '
    + 'vertex cursor. The constant index pattern removed the variable and with it the way to get it wrong; '
    + 'a re-added one is that hazard restored, and it reads as a partly-missing figure, not as an error');
  chk('the vertex upload is the RANGED form, bounded by the returned prefix',
    /bufferData\(gl\.ARRAY_BUFFER, this\.vertexScratch, gl\.DYNAMIC_DRAW, 0, vertexFloats\)/.test(neon),
    'uploading `this.vertexScratch` whole would be correct but re-transfers the unwritten tail; uploading '
    + 'a DIFFERENT length is the short buffer ANGLE drops');
  chk('the index pattern is uploaded whole, and only when the capacity changed',
    /this\.geometryDirty/.test(neon)
    && /bufferData\(gl\.ELEMENT_ARRAY_BUFFER, this\.indexPattern, gl\.STATIC_DRAW\)/.test(neon),
    'the element buffer must stay at FULL capacity — it is indexed by `indexCount`, which is a per-frame '
    + 'count into a constant pattern, so shortening it to the prefix would be the one real way to break this');
  chk('the geometry capacity dies with the arrays it describes (invariant 3, CPU form)',
    /this\.geometryCapacity = 0;/.test(neon.slice(neon.indexOf('dispose()'))),
    'a live capacity over a zero-length scratch makes `ensureGeometryCapacity` skip the rebuild, and a '
    + 'Float32Array store out of range is a silent no-op rather than a throw');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
