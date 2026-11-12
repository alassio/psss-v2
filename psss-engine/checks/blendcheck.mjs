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
 *   1. The trail decay pass (since 2026-11-12 ONE fused pass) draws with blending disabled and restores the old
 *      fade's exit state after itself.
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

// ---- 1. the trail decay pass -----------------------------------------------------------------
// ⚠️ M6 (2026-11-12): the copy and the fade are ONE pass (`decayProgram` / `decayBlurProgram`), which writes the
// complete decayed trail. Its two state rules are the inverse of the old fade quad's and BOTH are silent when wrong:
//   (a) BLENDING DISABLED for its draw — under any enabled function the result combines with FBO-B's previous
//       contents (an additive leftover would integrate the trail to white, exactly the old defect's look);
//   (b) the old pass's EXIT state (`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`, enabled, FUNC_ADD) RESTORED after it, because a
//       later draw has been found relying on inherited state before.
const main = rd('src/main.ts');
const s0 = main.indexOf('// Step 1: Decay pass');
const s1 = s0 < 0 ? -1 : main.indexOf("perfHud?.end('trail')", s0);
if (s0 < 0 || s1 < 0) {
  fail('could not locate the decay pass (Step 1 … perfHud end) in main.ts');
} else {
  const step = main.slice(s0, s1);
  const drawAt = step.indexOf('gl.drawArrays(');
  const before = step.slice(0, drawAt), after = step.slice(drawAt);
  const usesDecay = /gl\.useProgram\(decayProgram\)/.test(step) && /gl\.useProgram\(decayBlurProgram\)/.test(step);
  const lastDisable = before.lastIndexOf('gl.disable(gl.BLEND)'), lastEnable = before.lastIndexOf('gl.enable(gl.BLEND)');
  if (!usesDecay || drawAt < 0) {
    fail('the decay pass does not draw through decayProgram / decayBlurProgram');
  } else if (lastDisable < 0 || lastEnable > lastDisable) {
    fail('the decay pass does not DISABLE blending before its draw — it writes the whole result, and under an '
       + 'inherited blend it would combine with FBO-B\'s previous contents');
  } else {
    pass('the decay pass draws with blending disabled (it writes the complete decayed trail)');
  }
  if (/gl\.enable\(gl\.BLEND\)/.test(after) && /gl\.blendEquation\(gl\.FUNC_ADD\)/.test(after)
      && /gl\.blendFunc\(gl\.SRC_ALPHA,\s*gl\.ONE_MINUS_SRC_ALPHA\)/.test(after)) {
    pass('and RESTORES the old exit state (SRC_ALPHA, ONE_MINUS_SRC_ALPHA, FUNC_ADD, enabled) for the passes after it');
  } else {
    fail('the decay pass does not restore SRC_ALPHA, ONE_MINUS_SRC_ALPHA / FUNC_ADD / enabled after its draw — the '
       + 'passes after it received that state from the retired fade quad and may depend on it');
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
