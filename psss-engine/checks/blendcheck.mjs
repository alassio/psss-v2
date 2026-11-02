#!/usr/bin/env node
/**
 * blendcheck — every pass that DEPENDS on a specific blend function must SET it, not inherit it.
 *
 * The defect this exists for: the trail fade pass in `main.ts` draws black at
 * `alpha = 1 - decayFactor` and works only under `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`, where
 * `dst' = dst * decayFactor`. Under any additive function it silently becomes `dst' = dst` — a
 * complete no-op — and every lit pixel then integrates without bound and saturates to white in
 * ~50 frames.
 *
 * It set that state once and inherited it thereafter, which made it hostage to whichever blend
 * function the PREVIOUS frame's final draw happened to leave set. Enabling crystals (which leave
 * `ONE, ONE_MINUS_SRC_ALPHA`) or an additive material (`ONE, ONE`) broke it; an alpha material left
 * exactly the right state and masked the bug entirely.
 *
 * Neither `tsc` nor `vite build` can see this: it is runtime GL state, not types. And it is invisible
 * to `glslcheck`/`samplercheck`/`vaocheck`/`lencheck`, which look at shaders and buffers rather than
 * at state ordering.
 *
 * Two assertions:
 *   1. The fade pass sets `blendFunc` within a few lines of its own draw.
 *   2. Any method that sets a NON-default blend function and then draws also leaves `activeTexture`
 *      on unit 0 if it changed it — the sibling global-state leak, guarded here for the same reason.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(root, p), 'utf8');

let failures = 0;
const fail = m => { console.error(`  FAIL  ${m}`); failures++; };
const pass = m => console.log(`  PASS  ${m}`);

console.log('=== blendcheck: passes must set the blend state they depend on ===');

// ---- 1. the trail fade pass -----------------------------------------------------------------
const main = rd('src/main.ts');
const fadeIdx = main.indexOf('gl.useProgram(fadeProgram)');
if (fadeIdx < 0) {
  fail('could not locate the fade pass (gl.useProgram(fadeProgram)) in main.ts');
} else {
  // Look back a short window for the blendFunc that governs this draw.
  const before = main.slice(Math.max(0, fadeIdx - 1200), fadeIdx);
  const m = [...before.matchAll(/gl\.blendFunc\(([^)]*)\)/g)].pop();
  if (!m) {
    fail('the fade pass does not set blendFunc immediately before its draw — it would INHERIT '
       + 'whatever the previous pass left, and under an additive function the fade is a NO-OP');
  } else if (!/SRC_ALPHA\s*,\s*gl\.ONE_MINUS_SRC_ALPHA/.test(m[1])) {
    fail(`the fade pass sets blendFunc(${m[1].trim()}) — it REQUIRES SRC_ALPHA, ONE_MINUS_SRC_ALPHA, `
       + 'because dst\' = dst * decayFactor only holds for destination-scaling');
  } else {
    pass('the fade pass sets SRC_ALPHA, ONE_MINUS_SRC_ALPHA itself');
  }
  if (/gl\.blendEquation\(/.test(before)) {
    pass('and asserts blendEquation too (a leaked FUNC_REVERSE_SUBTRACT would also break it)');
  } else {
    console.log('  WARN  fade pass does not assert blendEquation; only relevant if some pass changes it');
  }
}

// ---- 2. activeTexture leaks ----------------------------------------------------------------
// Any method that calls activeTexture on a unit > 0 must return it to unit 0 before returning,
// because later passes bind textures assuming unit 0 is current.
const hdr = rd('src/renderers/hdr-particle.ts');
const methods = [];
{
  // Crude method split on two-space-indented `name(...) {` / `private name(...) {`
  const re = /\n  (?:private |public )?(\w+)\([^)]*\)[^{]*\{/g;
  let m, prev = null;
  while ((m = re.exec(hdr))) {
    if (prev) methods.push({ name: prev.name, body: hdr.slice(prev.start, m.index) });
    prev = { name: m[1], start: m.index };
  }
  if (prev) methods.push({ name: prev.name, body: hdr.slice(prev.start) });
}
let checked = 0;
for (const { name, body } of methods) {
  const units = [...body.matchAll(/gl\.activeTexture\(gl\.TEXTURE(\d+)\)/g)].map(x => Number(x[1]));
  if (units.length === 0 || Math.max(...units) === 0) continue;
  checked++;
  // The LAST activeTexture in the method must be unit 0.
  const last = units[units.length - 1];
  if (last !== 0) {
    fail(`${name}() leaves activeTexture on unit ${last}. activeTexture is GLOBAL state; a later pass `
       + 'that binds without selecting a unit would write into the wrong one');
  } else {
    pass(`${name}() restores activeTexture to unit 0`);
  }
}
if (checked === 0) fail('found no methods using activeTexture above unit 0 — the scan is broken');

console.log(failures === 0
  ? `\nblendcheck: OK (${checked} texture-unit users checked)`
  : `\nblendcheck: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
