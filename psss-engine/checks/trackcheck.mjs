#!/usr/bin/env node
/**
 * trackcheck — a non-linear slider track can be WRONG while every value in it is a valid number.
 *
 * Why this is not covered by anything else. A `SliderSpec` is three independent numbers (`min`, `max`,
 * `step`) plus two functions (`toPos`, `fromPos`) that must be inverses, and `tsc` sees five `number`s and
 * two `(n: number) => number`s. Every failure mode below produced a control that LOOKED fine:
 *
 *   - a `step` too coarse for the curve makes values UNREACHABLE. Measured on the shipped cubic particle
 *     track at the pre-2026-08-20 `step: 0.001`: 44 of the 500 multiples of 100 could not be reached at
 *     all, so a drag aiming at 45 000 landed on 44 900. Nothing throws; the number simply never appears.
 *   - a `toPos`/`fromPos` pair that is not an exact inverse at the AUTHORED values means a preset load puts
 *     the handle somewhere a drag never would, and the first touch of the slider then jumps the value.
 *   - an endpoint that does not round-trip makes the documented range a lie (this is invariant 13 in
 *     miniature: the label says 0.01x and the engine gets 0.02x).
 *   - a `step` too FINE creates dead zones: at 0.0002 on the particle track, 135 consecutive positions all
 *     map to 200, so a keyboard arrow appears to do nothing 135 times in a row.
 *
 * ⚠️ **This checker MEASURES; it does not grep.** It imports the real mapping functions and the real
 * constants from `visual-fx.ts` and walks every stop of each track, so a behaviour-neutral rename cannot
 * break it and a behaviour-changing edit cannot slip past it. That makes it the exception among the sibling
 * checkers rather than the rule — do not "simplify" it into a text pattern.
 *
 * ⚠️ **The engine clamp is asserted against the SAME constant the UI uses.** `setSpeedFactor` clamps, and a
 * slider `min` below that clamp is an inert control, which is the defect class invariant 13 names. The two
 * sites now share `SPEED_MIN`/`SPEED_MAX`, and the assertion below checks the sharing rather than the value:
 * a hardcoded `0.1` reappearing in `main.ts` is exactly what it must catch.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(ROOT, p), 'utf8');
/**
 * ⚠️ Load-bearing, exactly as `deadcheck`'s own note says of its copy. The first draft of the
 * "nothing divides by speedFactor" assertion below FAILED against correct code: it matched
 * `// speedFactor of every preset shown before it.` at main.ts:1515, a comment. In a file this heavily
 * commented, any pattern aimed at arithmetic must see code only.
 */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const VFX = await import('../src/ui/synthesis-lab/tabs/visual-fx.ts');
const {
  SPEED_MIN, SPEED_MAX, SPEED_STEP, SPEED_TRACK,
  MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT, PARTICLE_SNAP, PARTICLE_STEP,
  particleCountToPos, posToParticleCount,
  PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX, PARTICLE_SIZE_STEP, PARTICLE_SIZE_TRACK,
  ISO_LEVEL_MIN, ISO_LEVEL_MAX, ISO_LEVEL_STEP, ISO_LEVEL_TRACK,
  KERNEL_WIDTH_MIN, KERNEL_WIDTH_MAX, KERNEL_WIDTH_STEP, KERNEL_WIDTH_TRACK,
  COHESION_RADIUS_MIN, COHESION_RADIUS_MAX, COHESION_RADIUS_STEP, COHESION_RADIUS_TRACK,
} = VFX;

/*
 * v8 `34.5` — the breathing RATE track, which is the ONE `toPos`/`fromPos` pair in `core/deform-limits.ts`.
 *
 * ⚠️ **It lives there rather than in `visual-fx.ts` because every other Phase 34 constant does, and the
 * four rows that read it are four DIFFERENT operators** — one track, one owner. The file is pure constants
 * and formatters, so importing it under Node is safe (no DOM, no classes, no enums).
 */
const DL = await import('../src/core/deform-limits.ts');
const { OP_RATE_MIN, OP_RATE_MAX, OP_RATE_STEP, OP_RATE_ZERO_BAND, OP_RATE_TRACK } = DL;

const ROT = await import('../src/core/rotation-track.ts');
const {
  ROT_MAX_RPM, ROT_MAX_DPS, ROT_STEP, DPS_PER_RPM,
  dpsToRpm, rpmToDps, rotationToPos, posToRotation, fmtRotationRpm,
} = ROT;

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

/**
 * What a native `<input type="range">` does to a value before anyone reads it back: clamp to [min,max] and
 * snap to the `min + k*step` grid. Every measurement here goes through this, because a track that is only
 * correct at unsanitised positions is not correct in a browser — the element is the thing the user drags.
 */
const sanitize = (raw, min, max, step) => {
  const k = Math.round((Math.max(min, Math.min(max, raw)) - min) / step);
  return Math.min(max, min + k * step);
};
/** Every position the handle can actually occupy, in order. */
const stops = (step) => {
  const n = Math.round(1 / step);
  return Array.from({ length: n + 1 }, (_, i) => sanitize(i * step, 0, 1, step));
};

// ---------------------------------------------------------------------------------------------------
console.log('\n=== A. Animation Speed: squared track, 0.01x-5.0x ===\n');
// ---------------------------------------------------------------------------------------------------

const sStops = stops(SPEED_STEP);
const sVals = sStops.map(SPEED_TRACK.fromPos);

chk('the endpoints are EXACT, so the documented range is the reachable range',
  sVals[0] === SPEED_MIN && sVals[sVals.length - 1] === SPEED_MAX,
  `pos 0 -> ${sVals[0]}x, pos 1 -> ${sVals[sVals.length - 1]}x (expect ${SPEED_MIN} / ${SPEED_MAX})`);

chk('monotonically non-decreasing — dragging right never slows the animation down',
  sVals.every((v, i) => i === 0 || v >= sVals[i - 1]));

// The values a preset can hand the slider. If any of these fails to round-trip, loading that preset puts the
// handle where a drag never would, and the first nudge jumps the speed.
const SPEED_AUTHORED = [0.01, 0.02, 0.05, 0.1, 0.4, 0.5, 0.6, 0.7, 0.75, 0.9, 1.0, 1.2, 1.5, 2.0, 3.0, 5.0];
const sRt = SPEED_AUTHORED.map(v => [v, SPEED_TRACK.fromPos(sanitize(SPEED_TRACK.toPos(v), 0, 1, SPEED_STEP))]);
const sBad = sRt.filter(([v, r]) => r !== v);
chk('every authored speed round-trips value -> position -> value EXACTLY',
  sBad.length === 0,
  sBad.length ? `broken: ${sBad.map(([v, r]) => `${v}->${r}`).join(', ')}`
              : `${SPEED_AUTHORED.length} values incl. all 9 in the shipped presets`);

// The point of the change: the slow end has to be usable, not merely present. A linear 0.01-5.0 track gives
// 0.01-0.10 just 1.8 % of the travel, which is the reason the curve came with the new min.
const slowShare = SPEED_TRACK.toPos(0.1);
const linearSlowShare = (0.1 - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
chk('the 0.01x-0.10x range gets a usable share of the travel (>10 %), which a linear track does not',
  slowShare > 0.10 && linearSlowShare < 0.03,
  `squared ${(slowShare * 100).toFixed(1)} % vs linear ${(linearSlowShare * 100).toFixed(1)} %`);

// 1.0x is the default and the no-op. On the old linear track it sat at 18.4 %; below the midpoint is right
// (most of the range is speed-up) but it must not be crushed against the left end either.
const unityPos = SPEED_TRACK.toPos(1.0);
chk('1.0x sits in the middle third of the track, so both directions are gestures of similar size',
  unityPos > 1 / 3 && unityPos < 0.5,
  `1.0x at ${(unityPos * 100).toFixed(1)} % of travel (was 18.4 % on the linear track)`);

chk('no stop maps to 0 or below — a slider must not be able to freeze the animation',
  sVals.every(v => v >= SPEED_MIN),
  `min over ${sVals.length} stops = ${Math.min(...sVals)}`);

// ---------------------------------------------------------------------------------------------------
console.log('\n=== B. the engine clamp and the slider agree (invariant 13) ===\n');
// ---------------------------------------------------------------------------------------------------

const mainTs = rd('src/main.ts');
const setSpeed = /setSpeedFactor:\s*\(v\)\s*=>\s*\{([^}]*)\}/.exec(mainTs);
chk('setSpeedFactor still exists and clamps', !!setSpeed && /Math\.max\s*\(/.test(setSpeed[1]),
  setSpeed ? `body: ${JSON.stringify(setSpeed[1].trim())}` : 'NOT FOUND');

// The failure this exists for: someone changes the slider's min and leaves the clamp, or vice versa. Sharing
// the constant makes that unrepresentable, so assert the SHARING.
chk('...using the same SPEED_MIN/SPEED_MAX the slider does, not its own literals',
  !!setSpeed && /SPEED_MIN/.test(setSpeed[1]) && /SPEED_MAX/.test(setSpeed[1]),
  'a literal 0.1 here with a 0.01 slider min = a handle that moves and a figure that does not');

chk('and main.ts imports them from the tab that defines the track',
  /import\s*\{[^}]*SPEED_MIN[^}]*SPEED_MAX[^}]*\}\s*from\s*'\.\/ui\/synthesis-lab\/tabs\/visual-fx\.ts'/.test(mainTs)
  || /import\s*\{[^}]*SPEED_MAX[^}]*SPEED_MIN[^}]*\}\s*from\s*'\.\/ui\/synthesis-lab\/tabs\/visual-fx\.ts'/.test(mainTs));

// `speedFactor` is a dt MULTIPLIER everywhere. If anything ever divides by it, 0.01 becomes a 100x
// amplification rather than a slowdown -- the units trap of invariant 10.
const divisors = [];
for (const f of ['src/main.ts', 'src/generators/lissajous.ts', 'src/generators/attractors.ts']) {
  const t = stripComments(rd(f));
  if (/\/\s*speedFactor\b/.test(t) || /\/\s*dtScale\b/.test(t)) divisors.push(f);
}
chk('nothing DIVIDES by speedFactor or dtScale, so a small value cannot amplify anything',
  divisors.length === 0, divisors.length ? `divides: ${divisors.join(', ')}` : 'multiplier only');

// ---------------------------------------------------------------------------------------------------
console.log('\n=== C. Particle Number: cubic track snapped to multiples of 100 ===\n');
// ---------------------------------------------------------------------------------------------------

const pStops = stops(PARTICLE_STEP);
const pVals = pStops.map(posToParticleCount);
const pSet = new Set(pVals);

chk('the endpoints are EXACT', pVals[0] === MIN_PARTICLE_COUNT && pVals[pVals.length - 1] === MAX_PARTICLE_COUNT,
  `${pVals[0]} .. ${pVals[pVals.length - 1]}`);

chk('monotonically non-decreasing', pVals.every((v, i) => i === 0 || v >= pVals[i - 1]));

chk('every count at or above 100 is a multiple of 100 (the request)',
  pVals.every(v => v < PARTICLE_SNAP || v % PARTICLE_SNAP === 0),
  `${pSet.size} distinct counts over ${pVals.length} stops`);

// The reachability failure the step was chosen for. This is the assertion that fails if `step` is loosened
// back to 0.001 -- and it fails LOUDLY, where the defect itself was silent.
const missing = [];
for (let m = PARTICLE_SNAP; m <= MAX_PARTICLE_COUNT; m += PARTICLE_SNAP) if (!pSet.has(m)) missing.push(m);
chk('and every one of the 500 multiples is REACHABLE — the step is fine enough for the curve',
  missing.length === 0,
  missing.length ? `${missing.length} unreachable, e.g. ${missing.slice(0, 5).join(', ')}`
                 : `all ${MAX_PARTICLE_COUNT / PARTICLE_SNAP} reachable (44 were not at step 0.001)`);

// ⚠️ The exception that must not be tidied away: two shipped presets live below 100.
chk('counts below 100 are NOT snapped, so Lonely Particle (1) and Alpha Particles (88) stay reachable',
  pSet.has(1) && pSet.has(88),
  'a blanket round-to-100 would rewrite both presets on the first drag');

// A step FINER than necessary is its own defect -- dead keyboard stops. 0.0002 puts 135 positions on 200.
let worstRun = 1, runVal = pVals[0], run = 1;
for (let i = 1; i < pVals.length; i++) {
  if (pVals[i] === pVals[i - 1]) { run++; if (run > worstRun) { worstRun = run; runVal = pVals[i]; } } else run = 1;
}
chk('no value swallows more than 60 consecutive stops (a keyboard arrow must not appear dead)',
  worstRun <= 60, `worst: ${worstRun} stops map to ${runVal}`);

const pRt = [1, 88, 300, 1000, 2000, 3200, 5000, 8000, 20000, 50000]
  .map(c => [c, posToParticleCount(sanitize(particleCountToPos(c), 0, 1, PARTICLE_STEP))]);
const pBad = pRt.filter(([c, r]) => r !== c);
chk('every library count that is already a multiple of 100 (or below it) round-trips exactly',
  pBad.length === 0,
  pBad.length ? `broken: ${pBad.map(([c, r]) => `${c}->${r}`).join(', ')}` : `${pRt.length} counts`);

// The one deliberate rewrite, asserted so it is a decision rather than a surprise.
const multipleRt = posToParticleCount(sanitize(particleCountToPos(4032), 0, 1, PARTICLE_STEP));
chk('`Multiple`\'s 4 032 snaps to 4 000 when dragged, and ONLY when dragged',
  multipleRt === 4000,
  'the getter reads the generator, so loading the preset still shows 4,032 until the handle moves');

// ---------------------------------------------------------------------------------------------------
console.log('\n=== D. settleOnRelease cannot change a value ===\n');
// ---------------------------------------------------------------------------------------------------

// The release handler re-places the handle at `toPos(value)`. If the element's own sanitisation of that
// position read back a different value, the cosmetic reposition would silently edit the setting -- so the
// handler compares and abandons. Assert both halves: the guard is present, and it is never needed.
const vfx = rd('src/ui/synthesis-lab/tabs/visual-fx.ts');
const settle = /input\.addEventListener\('change',\s*\(\)\s*=>\s*\{([\s\S]*?)\n {6}\}\);/.exec(
  vfx.slice(vfx.indexOf('if (c.settleOnRelease')));
chk('the release handler restores the old position when the canonical one reads back a different value',
  !!settle && /input\.value = before/.test(settle[1]) && /!==\s*v\)/.test(settle[1]),
  settle ? 'guard present' : 'HANDLER NOT FOUND');

for (const [name, track, step] of [
  ['speed', { toPos: SPEED_TRACK.toPos, fromPos: SPEED_TRACK.fromPos }, SPEED_STEP],
  ['particle', { toPos: particleCountToPos, fromPos: posToParticleCount }, PARTICLE_STEP],
]) {
  let changed = 0, moved = 0;
  for (const pos of stops(step)) {
    const v = track.fromPos(pos);
    const canon = sanitize(track.toPos(v), 0, 1, step);
    if (track.fromPos(canon) !== v) changed++;
    else if (canon !== pos) moved++;
  }
  chk(`...and over every ${name} stop it never needs to: the value survives the settle`,
    changed === 0, `${changed} value changes, ${moved} cosmetic handle moves`);
}

// ---------------------------------------------------------------------------------------------------
console.log('\n=== E. Rotation X/Y/Z: signed quartic track, +-10 RPM, centred on 0 ===\n');
// ---------------------------------------------------------------------------------------------------
//
// The three defect classes above all apply, plus two this track introduces and neither of the others has:
//
//   - it is SIGNED and centred, so 0 must be exactly reachable — it is the categorical default ("no
//     rotation") and the value 37 of the 177 legacy presets carry on all three axes. A curve with no exact
//     zero (the logarithmic `sliderMul` one) would make the default unreachable from the slider.
//   - it converts UNITS. `generators.rotation` is degrees/second and the slider is labelled RPM, so the
//     conversion is exactly the shape invariant 10 names: `tsc` sees two `number`s. The factor is asserted
//     against the integration it comes from rather than against a literal.

const ROT_AUTHORED = (() => {
  // Every authored rotation value in the project: the 177 in `public/psss_presets.json` plus every
  // `rotation:` literal in `src/presets/`. Collected rather than hardcoded — a new preset with a new speed
  // must be measured too, and a hardcoded list silently stops covering the library it was copied from.
  const set = new Set();
  const push = t => {
    const re = /rotation:\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(t))) for (const x of m[1].split(',')) {
      const v = parseFloat(x.trim());
      if (Number.isFinite(v)) set.add(v);
    }
  };
  for (const f of readdirSync(join(ROOT, 'src/presets')).filter(f => f.endsWith('.ts'))) push(rd(`src/presets/${f}`));
  // ⚠️ The JSON file is a JS assignment (`g_psss_presets = {...}`), not JSON — strip the prefix.
  const legacy = JSON.parse(rd('public/psss_presets.json').replace(/^[^{]*/, ''));
  for (const n of Object.keys(legacy)) for (const r of (legacy[n].Rotation ?? [])) if (Number.isFinite(r)) set.add(r);
  return [...set].sort((a, b) => a - b);
})();

// The signed track runs -1..+1, so its stops are twice the count and `sanitize` must be given the real min.
const rStops = (() => {
  const n = Math.round(2 / ROT_STEP);
  return Array.from({ length: n + 1 }, (_, i) => sanitize(-1 + i * ROT_STEP, -1, 1, ROT_STEP));
})();
const rVals = rStops.map(posToRotation);
const rSanitize = p => sanitize(p, -1, 1, ROT_STEP);

chk('the unit factor is the one the integration implies: 1 RPM = 6 deg/s',
  DPS_PER_RPM === 6 && rpmToDps(1) === -6 && dpsToRpm(-6) === 1,
  'update() does angle += speed*(dt/1000) and reads angle as DEGREES, so a turn is 360 units per 60 s');

// The endpoints in the DISPLAYED unit, because that is what the range claims: the label says +-10 rpm, and
// invariant 13 is exactly the case where the documented range is not the reachable one.
chk('the endpoints are exact in the displayed unit, so the advertised +-10 rpm range is the reachable one',
  dpsToRpm(rVals[0]) === -ROT_MAX_RPM && dpsToRpm(rVals[rVals.length - 1]) === ROT_MAX_RPM,
  `pos -1 -> ${dpsToRpm(rVals[0])} rpm, pos +1 -> ${dpsToRpm(rVals[rVals.length - 1])} rpm`);

chk('...and in the stored unit they are the clamp itself, so neither end is truncated by the generator',
  Math.abs(rVals[0]) === ROT_MAX_DPS && Math.abs(rVals[rVals.length - 1]) === ROT_MAX_DPS,
  `${rVals[0]} / ${rVals[rVals.length - 1]} deg/s (clamp +-${ROT_MAX_DPS})`);

// ⚠️ The SIGN is a rendering fact, not a preference: `project()` rotates CCW in a y-up frame and then negates
// both axes into the canvas's y-down frame, so a positive stored value renders CLOCKWISE. The requirement is
// "left of centre = clockwise", which is only true if the mapping inverts.
chk('the sign INVERTS, so left of centre is clockwise as the label claims',
  rotationToPos(6) < 0 && rotationToPos(-6) > 0 && dpsToRpm(6) === -1,
  'a positive stored rotation renders clockwise (rotate-Z is CCW in y-up; project() negates both axes)');

chk('0 is EXACTLY reachable — it is the categorical default and 37 legacy presets use it on every axis',
  rVals.includes(0) && posToRotation(0) === 0 && rotationToPos(0) === 0
  // ⚠️ `posToRotation(0) === 0` alone is NOT enough, and that was found by falsifying it: the expression
  // starts `Math.sign(p) * ...`, and `Math.sign(0)` is 0, so the whole product is 0 no matter what the curve
  // does. A bias applied AFTER the sign multiply passes the centre test and moves every other stop. So also
  // require that the CENTRE STOP is the one reading 0 and that the plateau is symmetric about it — a biased
  // curve slides the plateau off centre while leaving `posToRotation(0)` at exactly 0.
  // ⚠️ Do NOT test `posToRotation(+-ROT_STEP)` for a sign here: the sticky zero is 9.5% of the travel wide, so
  // one step from centre is legitimately still 0. That spelling FAILED against correct code, and because it
  // failed it made three later mutation runs report a catch they had not earned.
  && rVals[(rVals.length - 1) / 2] === 0
  && (() => {
    const neg = rVals.findIndex(v => v === 0);
    const pos = rVals.length - 1 - [...rVals].reverse().findIndex(v => v === 0);
    return Math.abs((rVals.length - 1) / 2 - neg) === Math.abs(pos - (rVals.length - 1) / 2);
  })(),
  'a bias after the sign multiply leaves the centre at 0 and slides the plateau off it');

// ⚠️ Asserted because nothing else could: the largest authored speed is 30 deg/s = 5 rpm, so NO library value
// exercises the range clamp and a mutation that deleted it passed the whole section. An imported preset can
// carry any number, and an unclamped position puts the handle off the track — where the browser silently
// clamps it to the end and the next `input` event writes a value the preset never had.
chk('an out-of-range speed parks the handle at the END rather than off the track',
  rotationToPos(600) === -1 && rotationToPos(-600) === 1
  && rotationToPos(ROT_MAX_DPS) === -1 && Math.abs(rotationToPos(ROT_MAX_DPS * 0.99)) < 1,
  `600 deg/s (100 rpm) -> pos ${rotationToPos(600)}; no authored value reaches the clamp, so only this sees it`);

chk('monotonically non-increasing in stored units, i.e. non-decreasing in RPM',
  rVals.every((v, i) => i === 0 || v <= rVals[i - 1]),
  'dragging right must never reverse the direction of the turn');

// The reason this track is quartic rather than linear. Measured, not asserted: if the curve is ever flattened
// the library's own values pile into the centre of the travel and the control becomes unusable for the presets
// that actually exist.
const medianPos = Math.abs(rotationToPos(0.5));   // 0.5 deg/s = the library's median non-zero component
const linearMedianPos = 0.5 / ROT_MAX_DPS;
chk('the library median (0.5 deg/s = 0.083 rpm) gets a usable share of the travel, which a linear track does not',
  medianPos > 0.25 && linearMedianPos < 0.02,
  `quartic ${(medianPos * 100).toFixed(1)} % of half-travel vs linear ${(linearMedianPos * 100).toFixed(1)} %`);

// The round trip the requirement names in so many words: "preset values for rotation are correctly translated
// back and forth to the correct slider values".
const rRt = ROT_AUTHORED.map(v => [v, posToRotation(rSanitize(rotationToPos(v)))]);
const rBad = rRt.filter(([v, r]) => Math.abs(r - v) > 1e-9);
const rWorstRpm = Math.max(0, ...rRt.map(([v, r]) => Math.abs(r - v) / DPS_PER_RPM));
chk('most authored rotations round-trip EXACTLY, and none by more than 0.002 rpm',
  rBad.length <= 6 && rWorstRpm < 0.002,
  `${ROT_AUTHORED.length - rBad.length}/${ROT_AUTHORED.length} exact, worst error ${rWorstRpm.toFixed(6)} rpm`
  + (rBad.length ? ` (e.g. ${rBad.slice(0, 4).map(([v, r]) => `${v}->${r}`).join(', ')})` : ''));

// ⚠️ The assertion that actually answers the requirement, and the reason the previous one is not enough: an
// error tolerance is only meaningful against the precision the user SEES, and that precision is adaptive. So
// compare the LABELS -- if no authored speed's readout changes across a round trip, then no preset displays a
// different number after being loaded and resynced, whatever the residue in the stored value.
const rLblChanged = rRt.filter(([v, r]) => fmtRotationRpm(v) !== fmtRotationRpm(r));
chk('...and NO authored rotation\'s READOUT changes across the round trip, at either precision',
  rLblChanged.length === 0,
  `${rLblChanged.length} of ${rRt.length} would show a different number after a load`
  + (rLblChanged.length ? `: ${rLblChanged.slice(0, 3).map(([v, , ]) => v).join(', ')}` : ''));

// ⚠️ The property that actually delivers "back and forth" over a SESSION, and the one an exact-round-trip
// count cannot give: a preset change resyncs the whole tab by design, so the value goes through the track
// repeatedly. If the map were not idempotent, every resync would move it a little further.
const rNonIdem = rVals.filter(v => Math.abs(posToRotation(rSanitize(rotationToPos(v))) - v) > 1e-9);
chk('...and the map is IDEMPOTENT at every stop, so repeated resyncs cannot make it creep',
  rNonIdem.length === 0,
  `${rNonIdem.length} of ${rVals.length} stops drift on a second pass`);

// A step too FINE is its own defect (section C's dead-keyboard-stop argument). The zero plateau is excluded:
// it is deliberate and is asserted separately below.
let rWorst = 0, rWorstVal = null, rRun = 1;
for (let i = 1; i < rVals.length; i++) {
  if (rVals[i] === rVals[i - 1]) { rRun++; if (rVals[i] !== 0 && rRun > rWorst) { rWorst = rRun; rWorstVal = rVals[i]; } }
  else rRun = 1;
}
chk('no non-zero speed swallows more than 60 consecutive stops, the same ceiling the particle track uses',
  rWorst <= 60, `worst: ${rWorst} stops map to ${rWorstVal} deg/s`);

// The sticky zero is deliberate -- 0 is categorical and easy return to it is the point -- but it must not eat
// the slow speeds the whole quartic curve exists to expose.
const zeroShare = rVals.filter(v => v === 0).length / rVals.length;
chk('the sticky zero is present but small: 5-15 % of the travel, not enough to swallow a usable speed',
  zeroShare > 0.05 && zeroShare < 0.15,
  `${(zeroShare * 100).toFixed(1)} % of the full track; the slowest non-zero speed is `
  + `${Math.min(...rVals.filter(v => v !== 0).map(Math.abs))} deg/s`);

// Invariant 13, the reason this module exists rather than three literals in the tab: a slider range is
// cosmetic and the GENERATOR's clamp is what the render loop obeys.
const liss = stripComments(rd('src/generators/lissajous.ts'));
chk('the generator clamps rotation with the SAME constant the track defines, not its own literal',
  /ROT_MAX_DPS/.test(liss) && /import\s*\{[^}]*ROT_MAX_DPS[^}]*\}\s*from\s*'\.\.\/core\/rotation-track\.ts'/.test(liss),
  'a literal 60 here with a different slider max = a handle that moves and a figure that does not');

chk('...and the clamp is symmetric, so the negative half of the track is not silently dead',
  /Math\.max\s*\(\s*-ROT_MAX_DPS\s*,\s*Math\.min\s*\(\s*ROT_MAX_DPS/.test(liss),
  'clamping to [0, MAX] would make every counter-clockwise position render as standing still');

chk('ROT_MAX_DPS is DERIVED from the RPM range rather than written twice',
  ROT_MAX_DPS === ROT_MAX_RPM * DPS_PER_RPM && /ROT_MAX_RPM\s*\*\s*DPS_PER_RPM/.test(rd('src/core/rotation-track.ts')),
  `${ROT_MAX_RPM} rpm = ${ROT_MAX_DPS} deg/s`);

// `setRotationSpeed` sets a RATE. Re-initialising the generator would reset `pos` and re-read `angle`, so the
// figure would snap back to its opening pose on every `input` event of a drag -- the same trap
// `setParticleCount` documents. Assert the setter exists and that the write path does not go through init.
const setRot = /setRotationSpeed:\s*\(axis,\s*v\)\s*=>\s*\{([\s\S]*?)\n {4}\},/.exec(stripComments(mainTs));
chk('main.ts wires setRotationSpeed per AXIS and writes the generator directly, never via initGenerator',
  !!setRot && /generator\.setRotationSpeed\(/.test(setRot[1]) && !/initGenerator/.test(setRot[1]),
  setRot ? 'rate-only write' : 'SETTER NOT FOUND');

chk('...and mirrors it to preset.generators.rotation, so it survives Export and the Mixer',
  !!setRot && /preset\.generators\.rotation\s*=/.test(setRot[1]),
  'the same both-sites choice setParticleCount makes; an overlay twin would be a second source of truth');

chk('...reading the CLAMPED value back rather than storing the requested one',
  !!setRot && /preset\.generators\.rotation\s*=\s*generator\.getRotationSpeed\(\)/.test(setRot[1]),
  'otherwise an out-of-range import exports a speed the engine never used');

// A 0 that printed "0.00 cw" would claim a direction for a figure that is not turning -- the same reason
// `fmtSymmetryFold` prints `Off` at fold 1.
chk('the readout names the DIRECTION and prints Off at 0, since a signed zero implies a turn',
  fmtRotationRpm(0) === 'Off' && /cw/.test(fmtRotationRpm(6)) && /ccw/.test(fmtRotationRpm(-6))
  && fmtRotationRpm(6) !== fmtRotationRpm(-6),
  `0 -> "${fmtRotationRpm(0)}", +6 deg/s -> "${fmtRotationRpm(6)}", -6 deg/s -> "${fmtRotationRpm(-6)}"`);

// ⚠️ This one FAILED against a fixed `toFixed(2)` and the failure was a real UI defect, not a strict test:
// RPM is a coarse unit for this library (the slowest authored speed is 0.0017 rpm, one turn per 10 minutes),
// so two decimals collapsed the authored speeds to 21 labels and printed the two slowest as `-0.00 cw` — a
// readout asserting zero for a figure that is turning. The precision is adaptive because of this measurement.
//
// ⚠️ **The basis is the speeds the TRACK can represent, not the raw authored ones, and that distinction was
// itself a measured correction (2026-08-27).** An authored-basis version failed at 34 labels for 35 speeds
// when `Bors dream` settled with a rotation Z of 1.29 deg/s, because the library ALSO contains 1.285714 (a
// repeating decimal from the legacy JSON) and both print `-0.21 cw`. That is not a readout defect: the header
// records 1.285714 -> 1.29 as one of the six values the 0.01 deg/s grid cannot hold, so the two speeds are
// the SAME position on the track and a shared label is the correct, consistent readout. Demanding a distinct
// label for each would force 3 decimals everywhere and make the label CHANGE on a round trip
// (`-0.214 cw` -> `-0.215 cw`) — trading a harmless shared label for a readout that moves when nothing did,
// i.e. breaking the exact-round-trip property this whole track exists to guarantee.
//
// ⚠️ Calibrated so the relaxation cannot hide the original defect: over the 34 track-representable speeds,
// a fixed `toFixed(2)` still reports 23/34, `toFixed(1)` 11/34, and a threshold at 0.01 rather than 0.1
// reports 27/34. All three fail, so the assertion still catches every formatter regression it was written for.
const rNz = ROT_AUTHORED.filter(v => v !== 0);
const rTrack = [...new Set(rNz.map(v => posToRotation(rSanitize(rotationToPos(v)))))].filter(v => v !== 0);
chk('every speed the track can REPRESENT gets its own label, so two reachable values cannot read identically',
  new Set(rTrack.map(fmtRotationRpm)).size === rTrack.length,
  `${new Set(rTrack.map(fmtRotationRpm)).size} labels for ${rTrack.length} representable speeds`
  + ` (${rNz.length} authored, so ${rNz.length - rTrack.length} collapse onto a shared track position)`);

chk('...and no non-zero speed prints as a signed zero, which would claim the figure is standing still',
  rNz.every(v => !/^[+−]0\.0*\s/.test(fmtRotationRpm(v))),
  (() => {
    // The SLOWEST is the smallest MAGNITUDE, not the most negative -- `Math.min` would report the -1 that is
    // the library's only counter-clockwise value and skip the 0.01 the assertion is actually about.
    const s = rNz.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
    return `slowest authored: ${s} deg/s -> "${fmtRotationRpm(s)}"`;
  })());

// The triplet row is a new control KIND, and the registry's whole point is that a control cannot be built
// without also being synced (the "built but not synced" class the descriptor table replaced).
const vfxT = rd('src/ui/synthesis-lab/tabs/visual-fx.ts');
chk('the triplet row is registered in the descriptor table, so syncFromControls re-reads it',
  /case 'triplet':/.test(vfxT) && /this\.controlList\.push\(c\)/.test(vfxT.slice(vfxT.indexOf('private tripletRow'))),
  'a control that builds but never syncs shows stale values after a preset change');

chk('...and its sync restores BOTH the handle and the value label',
  (() => {
    const m = /case 'triplet':\s*\{([\s\S]*?)\n {6}\}/.exec(vfxT);
    return !!m && /el\.value =/.test(m[1]) && /lbl\.textContent =/.test(m[1]);
  })(),
  'Ribbon Width and Neon Line Width were both this defect before the table');

// ⚠️ Each handler must write only ITS OWN axis. Rebuilding the whole vec3 from the three DOM elements (what
// `rgbRow` does) would take the other two axes from stale handle positions rather than from the engine, so a
// clamped axis would be silently re-written on its sibling's drag.
chk('...and each slider writes only its own axis, never a vec3 rebuilt from the three elements',
  (() => {
    const body = vfxT.slice(vfxT.indexOf('private tripletRow'), vfxT.indexOf('private cpSet'));
    return /c\.set\(axis, v\)/.test(body) && !/parseFloat\(inputs\[0\]/.test(body);
  })(),
  'a rebuild-from-DOM re-writes the sibling axes from their handles instead of from the engine');

// ---------------------------------------------------------------------------------------------------
console.log('\n=== F. Particle Size: logarithmic track, 0.25x-4x, identity at the centre ===\n');
// ---------------------------------------------------------------------------------------------------
//
// A fourth curve shape, and it brings one failure mode the other three do not have: on a LOG track the
// interesting values are the OCTAVES (half, unity, double), and whether they exist at all is decided by
// `1/STEP` being a multiple of the octave count. `0.02` — the first draft, and a perfectly reasonable round
// number — gives 51 all-distinct stops and yet cannot reach 0.5x or 2.0x, because 50 is not a multiple of 4.
// Nothing about that is visible in a browser: the handle moves, the label reads 0.51x, and the value the user
// aimed at simply does not exist. Section C's argument for the particle track, in the multiplicative unit.

const zStops = stops(PARTICLE_SIZE_STEP);
const zVals = zStops.map(PARTICLE_SIZE_TRACK.fromPos);
const zSet = new Set(zVals);
const zSan = p => sanitize(p, 0, 1, PARTICLE_SIZE_STEP);

chk('the endpoints are EXACT, so the documented 0.25x-4x range is the reachable one',
  zVals[0] === PARTICLE_SIZE_MIN && zVals[zVals.length - 1] === PARTICLE_SIZE_MAX,
  `pos 0 -> ${zVals[0]}x, pos 1 -> ${zVals[zVals.length - 1]}x`);

chk('monotonically non-decreasing — dragging right never shrinks the particles',
  zVals.every((v, i) => i === 0 || v >= zVals[i - 1]));

// The property the log curve was chosen FOR, and the one a squared or cubic track cannot give: 1.00x is the
// no-op and must sit at the exact centre, so halving costs the same gesture as doubling.
chk('1.00x is the exact CENTRE stop, so halving and doubling are gestures of identical size',
  PARTICLE_SIZE_TRACK.toPos(1.0) === 0.5 && zVals[(zVals.length - 1) / 2] === 1.0,
  `toPos(1.00x) = ${PARTICLE_SIZE_TRACK.toPos(1.0)}, centre stop = ${zVals[(zVals.length - 1) / 2]}x`);

// ⚠️ The assertion the STEP was measured for. It FAILS at the first-draft 0.0125 -> 0.02 (0.5x and 2.0x both
// vanish, nearest stops 0.51x and 2.06x) and at 0.025 (which reaches the octaves but only with 41 stops).
chk('every OCTAVE is reachable — 0.25x / 0.50x / 1.00x / 2.00x / 4.00x all EXIST on the track',
  [0.25, 0.5, 1.0, 2.0, 4.0].every(v => zSet.has(v)),
  `missing: ${[0.25, 0.5, 1.0, 2.0, 4.0].filter(v => !zSet.has(v)).join(', ') || 'none'}`
  + ` (step 0.02 loses 0.5 and 2.0 — 1/step must be a multiple of the 4 octaves)`);

// The collision half of the same trade-off: quantising to 2 decimals in the STORED unit means a step too FINE
// puts two positions on one value. At 0.01, 101 stops give only 99 distinct values.
chk('...and no two stops collide on the 2-decimal grid, so no position is a duplicate of its neighbour',
  zSet.size === zVals.length,
  `${zSet.size} distinct over ${zVals.length} stops (0.01 gives 99/101)`);

chk('no stop maps to 0 or below — a multiplier of 0 would make every particle invisible',
  zVals.every(v => v >= PARTICLE_SIZE_MIN),
  `min over ${zVals.length} stops = ${Math.min(...zVals)}`);

// Section D's property, for this track: a preset change resyncs the whole tab, so the map runs repeatedly.
const zNonIdem = zVals.filter(v => PARTICLE_SIZE_TRACK.fromPos(zSan(PARTICLE_SIZE_TRACK.toPos(v))) !== v);
chk('the map is IDEMPOTENT at every stop, so repeated resyncs cannot make the size creep',
  zNonIdem.length === 0,
  `${zNonIdem.length} of ${zVals.length} stops drift on a second pass`);

// The shrink half has to be usable, which is the same argument section A makes for slow speeds — and it is why
// this is not a linear 0.25-4 range. On a linear track 0.25x-1.00x is 20 % of the travel; on the log track it
// is exactly half, by construction.
const shrinkShare = PARTICLE_SIZE_TRACK.toPos(1.0);
const linearShrinkShare = (1.0 - PARTICLE_SIZE_MIN) / (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN);
chk('the SHRINK half gets half the travel, which a linear 0.25-4 range would not',
  shrinkShare === 0.5 && linearShrinkShare < 0.25,
  `log ${(shrinkShare * 100).toFixed(1)} % vs linear ${(linearShrinkShare * 100).toFixed(1)} %`);

// ---------------------------------------------------------------------------------------------------
console.log('\n=== G. Particle Size: the engine clamp, the renderer and the readout ===\n');
// ---------------------------------------------------------------------------------------------------

// Section B's assertion for the new control. Same reasoning: the range `min` is cosmetic and this clamp is what
// moves, so assert the SHARING rather than the numbers.
const setPSize = /setParticleSize:\s*\(v\)\s*=>\s*\{([\s\S]*?)\n {4}\},/.exec(stripComments(mainTs));
chk('main.ts wires setParticleSize and clamps with the SAME constants the track defines',
  !!setPSize && /PARTICLE_SIZE_MIN/.test(setPSize[1]) && /PARTICLE_SIZE_MAX/.test(setPSize[1]),
  setPSize ? `body: ${JSON.stringify(setPSize[1].trim())}` : 'SETTER NOT FOUND');

chk('...and hands the value to the RENDERER, or the handle moves and the particles do not (invariant 13)',
  !!setPSize && /renderer\.setParticleSize\(/.test(setPSize[1]));

chk('...importing the constants from the tab that owns the track',
  /import\s*\{[\s\S]*?PARTICLE_SIZE_MIN[\s\S]*?PARTICLE_SIZE_MAX[\s\S]*?\}\s*from\s*'\.\/ui\/synthesis-lab\/tabs\/visual-fx\.ts'/
    .test(mainTs));

// ⚠️ The multiplier reaches four shader programs in this file and one more in the tile renderer. A program that
// declares the uniform but never gets a `uniform1f` reads 0.0, which the `max(1.0, ...)` floors would silently
// pin to 1 px — a whole render mode stuck at the smallest possible particle with no error anywhere. `glslcheck`
// catches the reverse (used but undeclared) and cannot catch this: an unwritten uniform is valid GLSL.
//
// ⚠️ **THE FLOOR WAS 4 WHILE THERE WERE FIVE SITES, AND IS NOW AT ZERO MARGIN.** `log-density`'s accumulate
// program was retired on 2026-09-19 and took its write with it, so the measured count fell 5 → 4 with the
// assertion untouched — a shrink this line could not see. The floor is DERIVED from the named list below, so
// adding a program means naming it here; do not raise the number without adding a name.
const PS_PROGRAMS = ['point', 'splat (live/material)', 'splat (crystal, neutral 1.0)', 'volume'];
const hdr = stripComments(rd('src/renderers/hdr-particle.ts'));
const psWrites = (hdr.match(/gl\.uniform1f\(\s*this\.\w*[Pp]articleSize\w*\s*,/g) ?? []).length;
chk('every program that DECLARES uParticleSize also gets a per-frame write (an unwritten uniform reads 0.0)',
  psWrites === PS_PROGRAMS.length,
  `${psWrites} uniform1f sites in hdr-particle.ts against ${PS_PROGRAMS.length} named passes `
  + `(${PS_PROGRAMS.join(' / ')}) — a MISMATCH in either direction is the finding, and an extra site is a pass `
  + 'nobody listed rather than a bug');

// ⚠️ Crystals are OUT OF SCOPE by decision (2026-08-29): they have their own Crystal Size slider and a second
// multiplier on top would make its readout wrong. The splat PROGRAM is shared, so the exclusion is a neutral
// 1.0 written on the crystal pass — and that write is load-bearing, not defensive: without it the pass inherits
// whatever `renderSplat` left behind, making the result depend on draw order.
const crystalOnly = hdr.slice(hdr.indexOf('renderCrystalOnly'));
chk('renderCrystalOnly writes a NEUTRAL 1.0, so crystals are excluded regardless of draw order',
  /gl\.uniform1f\(\s*this\.splatUParticleSize\s*,\s*1\.0\s*\)/.test(crystalOnly),
  'crystals keep their own Crystal Size slider; stacking a second multiplier would make its readout wrong');

// Invariant 17: the readout's pixel figure has five inputs (mode, canvas, material presence, splatRadius, the
// hardware ceiling) and the tab owns none of them. A second copy of the arithmetic in the tab is exactly the
// two-resolvers shape that made a preview tile show no warp.
chk('the pixel estimate is asked of the RENDERER, never recomputed in the tab (invariant 17)',
  /estimateParticlePixels\(\)\s*:\s*number/.test(hdr) || /estimateParticlePixels\(\)/.test(hdr),
  'the tab cannot see mode, canvas, material and ALIASED_POINT_SIZE_RANGE at once');

const vfxP = stripComments(rd('src/ui/synthesis-lab/tabs/visual-fx.ts'));
chk('...and the tab reads it at FORMAT time, so a mode change updates the number without moving the handle',
  /getParticlePixelEstimate\(\)/.test(vfxP)
  && /this\.syncKey\('particleSize'\)/.test(vfxP),
  'without the resync the row keeps printing the previous mode\'s estimate — invariant 25\'s shape');

/*
 * ⚠️ **RE-BASED 2026-10-05 FOR PHASE 23.2, AND THE OLD CLAUSE IS WORTH READING BEFORE THE NEW ONE.** It
 * counted MENTIONS of `particleSize` in `interpolate.ts` and wanted three or more, because the key had to
 * appear in both hand-written `result.overlay` literals and in its own derivation. A mention count is the
 * weakest instrument in this file — it cannot tell a write from a comment, and `stripComments` is the only
 * reason it was not pure noise. Phase 23.2 made both literals one table-driven owner, so the count fell to
 * one and the clause failed on a change that removed the whole class of defect it was watching for.
 *
 * The new form asserts the three facts that now have to hold together, each exact: the key's LAW is
 * geometric, it has an IDENTITY (`Record<KeysWithLaw<…>>` means a scalar law without one does not compile),
 * and it is on the ADDED allowlist, which is the honest consequence of being emitted unconditionally.
 */
const interp = stripComments(rd('src/exploration/interpolate.ts'));
const interpRules = stripComments(rd('src/exploration/overlay-rules.ts'));
/*
 * ⚠️ **RE-BASED AGAIN 2026-10-06 FOR PHASE 24, AND ONE HALF OF THIS FAILURE WAS A REAL PROPERTY CHANGE**,
 * which is why it is worth separating the two halves here rather than relaxing the pattern:
 *
 *  - **`group` moved from `'visual'` to `'shape'` (24.1), deliberately.** `particleSize` and `figureScale`
 *    describe the figure's SIZE, so a user locking `shape` to hold the figure still while randomising the
 *    look had the size move anyway, and a user locking `visual` to hold the look had the size frozen. That
 *    was one of nine group moves, and the clause asserting the old group is EXACTLY the instrument that was
 *    supposed to notice — it did. The new group is asserted just as exactly.
 *  - **The entry gained a third column (`mutate`) and is now multi-line**, so the trailing ` }` this pattern
 *    closed on moved. That half is a claim about the checker and nothing else.
 *
 * The law (`geometric`), the identity and the allowlist are unchanged and still pinned exactly.
 */
chk('the Mixer resolves particleSize through ONE owner: a geometric law, an identity, and the ADDED allowlist',
  /particleSize: \{\s*group: 'shape', law: \{ kind: 'geometric' \},/.test(interpRules)
  && /const SCALAR_IDENTITIES: Record<KeysWithLaw<'lerp' \| 'geometric'>, number> = \{[\s\S]{0,200}?particleSize: 1\.0,/
    .test(interp)
  // ⚠️ **MEMBERSHIP, NOT THE WHOLE LIST — narrowed 2026-10-22 and the narrowing is the point.** This read
  // /UNCONDITIONAL_KEYS = \['curlNoise', 'speedFactor', 'figureScale', 'particleSize'\]/, i.e. it pinned the
  // allowlist's exact four members as a literal. **That asserts a FIGURE where the clause means a RULE**:
  // this section is about `particleSize` resolving through one owner, and it went red when Phase 30 added
  // four re-derived entries that have nothing to do with particle size. A clause that fails whenever a
  // DIFFERENT key joins a shared list is measuring the list's length, not the agreement it names.
  && /UNCONDITIONAL_KEYS = \[[\s\S]{0,1600}?'particleSize'/.test(interpRules),
  'before 2026-10-05 a key absent from either of two overlay literals was dropped at every t; the literals '
  + 'are gone, and what replaces this clause is that the law, the identity and the allowlist agree');

// ⚠️ GEOMETRIC, matching the log track. A linear lerp between 0.25x and 4x would cross 1.00x at t=0.29 and
// spend most of the crossfade above 2x — inconsistent with the handle it moves.
chk('...GEOMETRICALLY, matching the log track: halfway between 0.25x and 4x is 1.00x, not 2.125x',
  /Math\.exp\(\s*inv\s*\*\s*Math\.log\(/.test(interp),
  'a linear lerp would cross unity at t=0.29 and read as lopsided');

// fieldcheck section I's rule, for this field: a tile must show what the main view shows.
const tile = stripComments(rd('src/ui/preview-grid/grid-tile-renderer.ts'));
chk('a preview tile reads overlay.particleSize and applies it, so the grid shows what the main view shows',
  /particleSize:\s*preset\.overlay\?\.particleSize\s*\?\?\s*1\.0/.test(tile)
  && /gl\.uniform1f\(this\.uParticleSize,\s*slot\.particleSize\)/.test(tile)
  && /baseSize\s*\*\s*uParticleSize/.test(rd('src/ui/preview-grid/grid-tile-renderer.ts')),
  'the one control whose whole job is particle size must not be the one a tile ignores');

// ---------------------------------------------------------------------------------------------------
/*
 * ============ THE SLIDER SPECS' UNIT CONVENTION ============
 *
 * ⚠️ **EVERY CLAUSE IN THIS FILE TESTS THE TRACK FUNCTIONS. NONE TESTED WHAT THE CALL SITES DECLARE — and
 * two real, reported defects lived in that gap on one day (2026-10-19).**
 *
 * **A tracked slider's `min`/`max` are in the unit the ELEMENT consumes, which for a tracked control is
 * the POSITION domain** (`0..1` unsigned, `-1..1` signed); `fromPos` maps that onto the real value range.
 * Three call sites passed VALUE constants instead, and because the element then clamps every position
 * into the value range and `fromPos` clamps the result to the track's end, their travel was mostly dead:
 *
 *     Iso Level        declared 0.0625..4   reachable 0.0811..4    max at 23.8 % of travel
 *     Kernel Width     declared 0.5..16     reachable 2.83..16     max at  3.2 %
 *     Cohesion Radius  declared 4..64       reachable 64..64       STUCK, one value only
 *
 * ⚠️ **AND THE FIRST FIX FOR THAT WAS ITSELF A DEFECT, WHICH IS WHY THIS CLAUSE GUARDS THE CONVENTION AND
 * NOT A WIRING.** Deriving the element bounds from `toPos(c.min)`/`toPos(c.max)` is correct ONLY where the
 * spec states values — three sites of nine — and everywhere else it collapsed the element onto `toPos` of
 * a position: `speedFactor` to `0..0.4454` (top value 1 instead of 5), `colourDrift` to `±0.7598` (±1
 * instead of ±3), and `particleCount` / `figureScale` jammed at their left end, which is how it was
 * reported. **The defect was never the widget: it was TWO CONVENTIONS sharing one signature, and no type
 * distinguished them.**
 *
 * So the assertion is: **every tracked call site declares a POSITION domain, and `fromPos` of its two ends
 * spans a real value range.** That is checkable, it is what actually matters, and it would have caught
 * both defects — the value-constant sites because `fromPos(4)..fromPos(64)` collapses, and the derived
 * bounds because `fromPos(toPos(0))..fromPos(toPos(1))` collapses too.
 *
 * It is a TEXT scan over one file for the declarations plus a live call into each track, deliberately: the
 * quantity is what the call site says, which no import can reach.
 */
console.log('\n=== G2. the slider SPECS: a tracked control declares its bounds in POSITION units ===\n');

// Pull every tracked call site's declared bounds out of the source.
const trackedSites = [...vfx.matchAll(
  /key: '([^']+)',[\s\S]{0,480}?min: *(-?[\w.]+), *max: *(-?[\w.]+),[\s\S]{0,460}?toPos: *([\w.]+)/g,
)].map(m => ({ key: m[1], min: m[2], max: m[3], toPos: m[4] }));

chk('every tracked slider call site is found by the scan (a silent 0 here would assert nothing)',
  trackedSites.length >= 8, `${trackedSites.length} tracked sites: ${trackedSites.map(t => t.key).join(', ')}`);

// ⚠️ The guard that would have caught the ORIGINAL defect: a tracked site may not pass a value constant.
// Every position domain is one of these three literals; a named constant or any other number is the smell.
const POS_BOUNDS = new Set(['0', '1', '-1']);
const valueConstantSites = trackedSites.filter(t => !POS_BOUNDS.has(t.min) || !POS_BOUNDS.has(t.max));
chk('NO tracked call site declares its bounds as a value constant — positions only',
  valueConstantSites.length === 0,
  valueConstantSites.length
    ? valueConstantSites.map(t => `${t.key} declares ${t.min}..${t.max}`).join('; ')
      + ' — these are VALUES, so the element clamps every position into the value range and the travel dies'
    : `all ${trackedSites.length} sites declare 0/1/-1 bounds`);

// And the live half: the declared domain must map through fromPos onto a real range, not a collapsed one.
const TRACK_BY_NAME = {
  'SPEED_TRACK.toPos': VFX.SPEED_TRACK, 'ISO_LEVEL_TRACK.toPos': VFX.ISO_LEVEL_TRACK,
  'KERNEL_WIDTH_TRACK.toPos': VFX.KERNEL_WIDTH_TRACK, 'COHESION_RADIUS_TRACK.toPos': VFX.COHESION_RADIUS_TRACK,
  'CYCLES_TRACK.toPos': VFX.CYCLES_TRACK, 'COLOUR_DRIFT_TRACK.toPos': VFX.COLOUR_DRIFT_TRACK,
  // v8 `34.5` — four tracked call sites share this one (`Temper Rate`, `Stretch Rate`, `Sway Rate`,
  // `Flare Rate`), so §G2's "maps onto a REAL value range" half now covers all four at once.
  'OP_RATE_TRACK.toPos': DL.OP_RATE_TRACK,
};
const collapsed = [];
const spans = [];
for (const t of trackedSites) {
  const tr = TRACK_BY_NAME[t.toPos];
  if (!tr) continue;                       // a track local to its call site; §H covers the exported ones
  const lo = parseFloat(t.min), hi = parseFloat(t.max);
  const vLo = tr.fromPos(lo), vHi = tr.fromPos(hi);
  spans.push(`${t.key} -> ${vLo}..${vHi}`);
  if (!(Math.abs(vHi - vLo) > 1e-9)) collapsed.push(`${t.key} collapses to ${vLo}`);
}
chk('...and each declared domain maps through fromPos onto a REAL value range, never a collapsed one',
  collapsed.length === 0 && spans.length >= 5,
  collapsed.length ? collapsed.join('; ')
    : `${spans.length} exported tracks checked: ${spans.join(', ')}`);

// The widgets take the spec's bounds verbatim, which is only honest while ONE convention holds.
chk('all three widgets pass the spec bounds through verbatim, which the single convention is what permits',
  (vfx.match(/input\.min = String\(c\.min\);/g) ?? []).length === 3
  && (vfx.match(/input\.max = String\(c\.max\);/g) ?? []).length === 3
  && !/String\(Math\.min\(lo, hi\)\)/.test(vfx),
  'a widget deriving bounds from `toPos` is the 2026-10-19 over-correction: right for three sites of nine '
  + 'and wrong for the rest. ⚠️ Keep the widget dumb and hold the CALL SITES to one unit instead');

console.log('\n=== H. Liquid Surface: Iso Level and Kernel Width, both logarithmic (v8 Step 15.1) ===\n');
// ---------------------------------------------------------------------------------------------------
//
// Two more log tracks, and they are here because section F's octave-reachability rule is what SET THEIR
// RANGES — and in Iso Level's case it invalidated the phase plan's proposed one. `log2(20/0.2) = 6.6438…` is
// not an integer, so on 0.2–20 no step can put the interesting values on the grid: measured over 11 candidate
// steps, every one missed at least one of 2.5, 5 and 10. That is not a tuning failure, it is arithmetic, and
// the range had to move to a whole octave count. The assertions below are what makes that permanent:
// widening either range back to a fractional octave count fails here rather than in a browser, where the
// symptom is only that a typed-in default silently becomes a slightly different number.
//
// ⚠️ **ISO LEVEL'S RANGE MOVED AGAIN AT 15.1b (0.25–16 → 0.0625–4) AND ITS QUANTISER HAD TO MOVE WITH IT — a
// quantiser is part of a track, not of its display, and this section did not assert that until it broke.** The
// reference the ratio is against changed (frame mean → on-curve, `renderers/liquid-reference.ts`), which slides
// every authored value down by one to two orders of magnitude. At the new 0.0625 anchor the inherited
// 2-decimal quantiser measures **100 of 121 stops distinct, worst gap 14.29 %, and the 0.125 anchor missed**
// (`round(0.125*100)/100 = 0.13`) — so the four assertions below (anchors exist, no collisions, worst gap,
// idempotence) each fail on it, which is the calibration for this whole block. FOUR decimals is the first
// exact one. `DECIMALS` is per-track for that reason and is not a shared constant.

for (const [label, TRACK, MIN, MAX, STEP, octaves, anchors, DECIMALS] of [
  ['Iso Level', ISO_LEVEL_TRACK, ISO_LEVEL_MIN, ISO_LEVEL_MAX, ISO_LEVEL_STEP, 6,
    [0.0625, 0.125, 0.25, 0.5, 1, 2, 4], 4],
  // ⚠️ **WIDENED TO 5 OCTAVES ON 2026-10-19 (0.5-16.0), AND BOTH NUMBERS ON THIS LINE HAD TO MOVE.** The
  // octave count is not a free parameter — it is `log2(MAX/MIN)` — and the anchors are the powers of two the
  // range now spans. ⚠️ **The assertion that earns its keep here is the authored-values one further down:**
  // with the range widened but `STEP` left at `1/90`, ten of the sixteen distinct authored kernelWidth values
  // in the library fall off the grid, and nothing else in this file would have said so.
  ['Kernel Width', KERNEL_WIDTH_TRACK, KERNEL_WIDTH_MIN, KERNEL_WIDTH_MAX, KERNEL_WIDTH_STEP, 5,
    [0.5, 1, 2, 4, 8, 16], 2],
  // v8 Step 15.4 — Cohesion Radius, the third log track and the FIRST one whose unit is absolute PIXELS
  // rather than a dimensionless ratio. That does not change any assertion in this loop (the octave rule is a
  // property of the range, not of the unit), and it is exactly why it can share the loop — but it does change
  // the DECIMALS, since a 1-decimal pixel readout is a different precision decision from a 4-decimal ratio.
  ['Cohesion Radius', COHESION_RADIUS_TRACK, COHESION_RADIUS_MIN, COHESION_RADIUS_MAX, COHESION_RADIUS_STEP, 4,
    [4, 8, 16, 32, 64], 1],
]) {
  const st = stops(STEP);
  const vals = st.map(TRACK.fromPos);
  const set = new Set(vals);
  const san = p => sanitize(p, 0, 1, STEP);

  chk(`${label}: the endpoints are EXACT, so the documented range is the reachable one`,
    vals[0] === MIN && vals[vals.length - 1] === MAX,
    `pos 0 -> ${vals[0]}, pos 1 -> ${vals[vals.length - 1]}`);

  chk(`${label}: monotonically non-decreasing`,
    vals.every((v, i) => i === 0 || v >= vals[i - 1]));

  // The range's own precondition. Asserted on the RANGE rather than on the step, because the step is the
  // free parameter and the octave count is not — this is the assertion that rejects 0.2–20.
  chk(`${label}: the range spans a WHOLE number of octaves, without which no step can reach the anchors`,
    Math.abs(Math.log2(MAX / MIN) - octaves) < 1e-12,
    `log2(${MAX}/${MIN}) = ${Math.log2(MAX / MIN)} (the plan's 0.2-20 gives 6.6438..., which is why it was replaced)`);

  chk(`${label}: ...and 1/STEP is a multiple of the octave count, so every octave lands on a stop`,
    Math.round(1 / STEP) % octaves === 0,
    `1/STEP = ${Math.round(1 / STEP)}, octaves = ${octaves}`);

  chk(`${label}: every anchor EXISTS on the track`,
    anchors.every(v => set.has(v)),
    `missing: ${anchors.filter(v => !set.has(v)).join(', ') || 'none'}`);

  // The collision half of the same trade-off (section F): quantising in the STORED unit means a step too fine,
  // OR a quantiser too coarse for the range's bottom decade, puts two positions on one value — a dead region
  // of travel. ⚠️ **A RANGE CHANGE CAN BREAK THIS WITHOUT THE STEP MOVING AT ALL**, which is exactly what
  // 0.25–16 → 0.0625–4 did on the inherited 2-decimal quantiser (100/121).
  //
  // ⚠️ **The HEADROOM is reported rather than asserted, and that was a measured correction.** A first draft
  // added a separate `bottom gap >= 4 grid units` assertion and it FAILED ON CORRECT CODE: Kernel Width's
  // bottom gap is 0.51 − 0.50 = exactly ONE grid unit at 2 decimals, i.e. it sits precisely on the collision
  // boundary and has shipped that way with all 91 stops distinct. The threshold of 4 was picked, not derived
  // — `CLAUDE.md`'s own rule, committed while writing the section that states it. It is also REDUNDANT: the
  // 2-decimal Iso Level defect independently fails three of the assertions in this loop (this one at 100/121,
  // `every anchor EXISTS` on 0.125 -> 0.13, and the worst-gap ceiling at 14.29 % > 8 %), so nothing needs a
  // fourth. What the ratio is genuinely good for is telling a future range change how much room is left, so
  // it is printed: Iso Level 22.0x, Kernel Width 1.0x — the second cannot absorb a lower `min` at all.
  const grid = Math.pow(10, -DECIMALS);
  chk(`${label}: no two stops collide on the ${DECIMALS}-decimal grid`,
    set.size === vals.length,
    `${set.size} distinct over ${vals.length} stops; bottom gap ${(vals[1] - vals[0]).toExponential(3)} `
    + `= ${((vals[1] - vals[0]) / grid).toFixed(1)}x the grid of ${grid.toFixed(DECIMALS)} `
    + `(1.0x is the boundary; at 2 decimals Iso Level is BELOW it)`);

  // ⚠️ The RESOLUTION half, and it is not implied by any assertion above — it was found by calibration.
  // `STEP = 1/6` passes exact endpoints, whole octaves, the multiple rule, every anchor AND stop distinctness,
  // because 7 stops that are exactly the 7 octaves satisfy all of them. It is still a defect: the finest
  // adjustment the handle can make is then a FACTOR OF TWO, so there is no fine-tuning of a threshold whose
  // whole job is fine-tuning. A relative ceiling is the right form because the track is geometric — an
  // absolute one would be far too loose at 16 and unsatisfiable at 0.25.
  const worstGap = Math.max(...vals.slice(1).map((v, i) => v / vals[i] - 1));
  chk(`${label}: the worst step-to-step JUMP stays under 8%, or the handle cannot fine-tune`,
    worstGap < 0.08,
    `worst gap ${(worstGap * 100).toFixed(2)}% over ${vals.length} stops at STEP = 1/${Math.round(1 / STEP)} (1/${octaves} passes every other assertion here at 100%)`);

  chk(`${label}: the map is IDEMPOTENT at every stop, so a preset resync cannot make the value creep`,
    vals.every(v => TRACK.fromPos(san(TRACK.toPos(v))) === v));

  chk(`${label}: no stop reaches 0 — a zero would make the threshold or the kernel degenerate`,
    vals.every(v => v >= MIN) && MIN > 0,
    `min over ${vals.length} stops = ${Math.min(...vals)}`);
}

// ⚠️ **THE READOUT MUST SEPARATE WHAT THE TRACK CAN REPRESENT — the same property section D asserts for the
// Rotation sliders, reached from the opposite direction.** There the defect was too MANY decimals (a label that
// changed on a round trip); here it is too FEW: over Iso Level's 121 stops the inherited `toFixed(2)` prints
// only **100 distinct labels**, so the bottom octave reads `0.06 / 0.07 / 0.07 / 0.07 / 0.08 …` and several
// distinct handle positions show the same number — a readout that stops being one exactly where the useful
// range now lives. `toFixed(3)` gives 121/121, and that measurement is why `fmtIsoLevel` is exported: the
// assertion runs the REAL formatter, not a transcription of it.
const isoVals = stops(ISO_LEVEL_STEP).map(ISO_LEVEL_TRACK.fromPos);
const isoLabels = new Set(isoVals.map(VFX.fmtIsoLevel));
chk('Iso Level: every stop the handle can occupy gets its OWN label, so no drag reads as inert',
  isoLabels.size === isoVals.length,
  `${isoLabels.size} labels over ${isoVals.length} stops`
  + ` (the inherited toFixed(2) gives ${new Set(isoVals.map(v => v.toFixed(2))).size}, which is the calibration)`);

// ⚠️ **THE DEFAULT MUST BE REPRESENTABLE, and this is the assertion that changed the shipped default TWICE.**
// A log track lands exactly only on powers of two times its `min`, so at 15.1's 0.25 anchor the plan's
// `isoLevel: 2.5` quantised to 2.46 and the default became 2.0 for that reason and not by taste. At 15.1b the
// reference moved (frame mean → on-curve, `renderers/liquid-reference.ts`), which slides every ratio down by
// 1–2 orders of magnitude, so the range became 0.0625–4 and **1.0 is the new default — exactly reachable, and
// derived from `CALIBRATION` rather than chosen: the calibration constant is what folds "isoLevel 1.0 = the
// typical half-eroded surface" into the reference itself.**
//
// ⚠️ The witnesses had to move with the range: 5 and 10 are now OUTSIDE it, so quantising them reports the
// clamp (4) and says nothing about the grid. The live witness is the 2-decimal quantiser's own failure at the
// new anchor — `0.125 -> 0.13` — which is a value the track must hold and a coarser grid cannot.
const MAT = await import('../src/generators/material-presets.ts');
const dl = MAT.DEFAULT_LIQUID_CONFIG;
const isoStops = new Set(isoVals);
const kwStops = new Set(stops(KERNEL_WIDTH_STEP).map(KERNEL_WIDTH_TRACK.fromPos));
// ⚠️ The round trip must go through `sanitize`, or the assertion's own witness is wrong: `toPos(2.5)` is
// 0.55374..., which `fromPos` inverts back to exactly 2.5 — a position no handle can occupy. The 2.46 only
// appears once the position is snapped to the `min + k*step` grid the element enforces, which is the whole
// reason `sanitize` exists in this file. (Printing the unsnapped value made 2.5 look reachable.)
const isoRound = v => ISO_LEVEL_TRACK.fromPos(sanitize(ISO_LEVEL_TRACK.toPos(v), 0, 1, ISO_LEVEL_STEP));
chk('the shipped isoLevel default is REACHABLE on its own track',
  isoStops.has(dl.isoLevel),
  `default ${dl.isoLevel}; 15.1's plan value 2.5 still quantises to ${isoRound(2.5)}, and a 2-decimal`
  + ` quantiser would hold 0.125 as ${(Math.round(0.125 * 100) / 100)} — outside the track`);
chk('...and so is the kernelWidth default',
  kwStops.has(dl.kernelWidth), `default ${dl.kernelWidth}`);
chk('...and edgeSoftness sits inside its linear 0-1 range', dl.edgeSoftness >= 0 && dl.edgeSoftness <= 1,
  `default ${dl.edgeSoftness}`);

// ⚠️ **AN AUTHORED PRESET VALUE THE TRACK CANNOT REPRESENT IS THE SAME DEFECT AS AN UNREACHABLE DEFAULT, and
// it has one more failure mode: a centre-restore can never return to it.** The default is one value and is
// checked above; a preset is the case that MULTIPLIES, since every liquid preset added from here on authors
// its own pair. `Liquid Surface` is the only one today, and its `isoLevel` moved 3.03 -> 0.8409 at 15.1b as a
// MECHANICAL consequence of the reference change (the exact conversion lands on 0.8358, which is not a stop;
// 0.8409 is the nearest one, +0.61 %) — so this assertion is what says the snapping was done rather than the
// raw conversion pasted in.
const DEMO = await import('../src/presets/demo-presets.ts');
const liqPresets = Object.entries(DEMO.DEMO_PRESETS)
  .filter(([, p]) => p.overlay?.liquid)
  .map(([name, p]) => [name, p.overlay.liquid]);
chk('every authored liquid preset uses values BOTH tracks can represent, or its handle jumps on first touch',
  liqPresets.length > 0
  && liqPresets.every(([, l]) => isoStops.has(l.isoLevel) && kwStops.has(l.kernelWidth)),
  liqPresets.map(([n, l]) => `${n}: iso ${l.isoLevel} ${isoStops.has(l.isoLevel) ? 'ok' : 'UNREACHABLE'},`
    + ` kw ${l.kernelWidth} ${kwStops.has(l.kernelWidth) ? 'ok' : 'UNREACHABLE'}`).join('; ')
  || 'no liquid preset found — the DEMO group is where they live');

// Section B/G's assertion for the new pair: the Mixer drops any overlay block it does not NAME, at BOTH of its
// construction sites — `crystal`, `sparks`, `volumeRender` and `buoyancy` are already silently reverted that
// way. And the two ratios must interpolate GEOMETRICALLY, matching the log handles: on the 15.1b range the
// midpoint of Iso 0.125 and 2 is 0.5 (the slider midpoint), not the arithmetic 1.0625.
chk('the Mixer names overlay.liquid in BOTH construction sites, or a crossfade reverts it to defaults',
  (interp.match(/liquid/g) ?? []).length >= 3,
  `${(interp.match(/liquid/g) ?? []).length} mentions; the snapshot-restore branch is the one that gets forgotten`);
const liqFn = /function interpolateLiquid[\s\S]*?\n\}/.exec(interp);
chk('...interpolating isoLevel and kernelWidth GEOMETRICALLY, matching their log tracks',
  !!liqFn && (liqFn[0].match(/Math\.exp\(/g) ?? []).length >= 2,
  'a linear lerp would put the midpoint of 0.125 and 2 at 1.0625, nowhere near the handle\'s centre');
chk('...and SNAPPING the two categoricals at t=0.5 (invariant 16)',
  !!liqFn && /tintSource:\s*t\s*<\s*0\.5/.test(liqFn[0]) && /surfaceRamp:\s*t\s*<\s*0\.5/.test(liqFn[0]),
  'a mixed ramp name is not a ramp name');

// ---------------------------------------------------------------------------------------------------
console.log('\n=== I. Cohesion: the radius track, its readout, and its Mixer entry (v8 Step 15.4) ===\n');
// ---------------------------------------------------------------------------------------------------
//
// The track's own arithmetic is asserted in §H's loop above (octaves, anchors, collisions, worst gap,
// idempotence), because those properties belong to the range and not to the unit. What is here is everything
// that is SPECIFIC to this control: its readout's precision, its default's reachability, and the two Mixer
// sites — plus the one property no other log track in this file has, which is that its two SIBLING sliders are
// deliberately LINEAR and must stay so.
//
// ⚠️ **THE READOUT'S DECIMAL COUNT WAS MEASURED, NOT PICKED, AND `toFixed(0)` IS THE CALIBRATION.** Cohesion
// Radius is a PIXEL count, so a whole-pixel label is the natural first choice and is wrong for the same reason
// Iso Level's `toFixed(2)` was: over the 121 stops it prints only **57 distinct labels**, so the bottom two
// octaves read `4 / 4 / 4 / 5 / 5 / 5 …` and roughly half of every drag looks inert. This is the third time
// that defect has been found by running the real formatter over the real stops, which is why `fmtCohesionRadius`
// is exported exactly as `fmtIsoLevel` and `fmtRotationRpm` are.
const cohVals = stops(COHESION_RADIUS_STEP).map(COHESION_RADIUS_TRACK.fromPos);
const cohLabels = new Set(cohVals.map(VFX.fmtCohesionRadius));
chk('Cohesion Radius: every stop gets its OWN label, so no drag reads as inert',
  cohLabels.size === cohVals.length,
  `${cohLabels.size} labels over ${cohVals.length} stops`
  + ` (a whole-pixel toFixed(0) gives ${new Set(cohVals.map(v => v.toFixed(0))).size}, which is the calibration)`);

// The default's reachability, the same property §H asserts for `isoLevel` — and it bites here for a reason
// specific to a pixel track: 16 is a natural default to TYPE, and on a 4 px anchor it happens to be exactly a
// power of two and therefore exactly reachable. A default of, say, 20 would not be (the nearest stop is 19.9),
// and the handle would jump on first touch with nothing on screen to explain it.
const cohStops = new Set(cohVals);
const dc = MAT.DEFAULT_COHESION_CONFIG;
chk('the shipped cohesion radius default is REACHABLE on its own track',
  cohStops.has(dc.radius),
  `default ${dc.radius}; a plausible 20 would quantise to `
  + `${COHESION_RADIUS_TRACK.fromPos(sanitize(COHESION_RADIUS_TRACK.toPos(20), 0, 1, COHESION_RADIUS_STEP))}`);
// ⚠️ **`strength: 0` IS THE DECISION, not a placeholder, and it is the only default here that a browser pass
// cannot verify — an inert feature and a broken one look identical.** It is 0 because cohesion is read in
// EVERY render mode, so any non-zero default would restyle all 360 presets including the 177 legacy ones whose
// whole purpose is parity with `psss.js`.
chk('...and cohesion ships INERT, so no existing preset changes appearance',
  dc.strength === 0, `strength default ${dc.strength}`);
chk('...with a returnForce inside its linear 0-5 range',
  dc.returnForce > 0 && dc.returnForce <= 5,
  `default ${dc.returnForce} — 0 is reachable but degenerate (offsets creep to the internal cap)`);

// ⚠️ **RE-BASED 2026-10-05 FOR PHASE 23.2**, like the `particleSize` clause above and for the same reason:
// the two construction sites are one table-driven owner now, so "names it in BOTH" is discharged by the
// architecture rather than loosened. The sentence it replaced is the finding Phase 23 went on to measure
// over the library — a crossfade with `visual` locked silently reverted the block to defaults, exactly as
// `crystal`/`sparks`/`volumeRender`/`buoyancy` did at EVERY t — and the generic locked restore below is what
// now covers the branch "that gets forgotten".
// ⚠️ **Re-based 2026-10-06 for `24.1`'s third column — a claim about the checker, unlike the `particleSize`
// clause above, whose GROUP genuinely moved.** `cohesion` stays `visual`: it is a field-system block, not the
// figure's size. Pinned past the law and up to the comma so the law is still asserted exactly.
chk('the Mixer resolves overlay.cohesion through ONE owner, with a generic locked restore behind it',
  /cohesion: \{ group: 'visual', law: \{ kind: 'custom', owner: 'interpolateCohesion' \}, mutate: \{/.test(interpRules)
  && /interpolateCohesion: \(a, b, t, inv\) => interpolateCohesion\(a\.overlay\?\.cohesion, b\.overlay\?\.cohesion, t, inv\),/
    .test(interp)
  && /if \(held\) copyKey\(out, held, key\);/.test(interp),
  'a rule whose owner is not in CUSTOM_MIXERS does not compile, and the locked branch copies whatever the '
  + 'held snapshot carries — so neither half can be forgotten for one block any more');
const cohFn = /function interpolateCohesion[\s\S]*?\n\}/.exec(interp);
// ⚠️ **LINEAR, and this is the assertion that must NOT be "made consistent" with the two log fields above.**
// `radius` sits on a log track, which is the shape that argues for a geometric lerp — but 15.3's rule decides
// it: 0 is `strength`'s neutral value, a geometric lerp cannot reach 0 at all, and keeping all three linear is
// what makes the one-sided case below arrive at a genuine zero rather than at an asymptote.
chk('...interpolating all three fields LINEARLY, so strength can actually reach 0',
  !!cohFn
  && ['strength', 'radius', 'returnForce']
    .every(f => new RegExp(`${f}: inv \\* a\\.${f} \\+ t \\* b\\.${f}`).test(cohFn[0]))
  && !/Math\.exp\(/.test(cohFn[0] ?? ''),
  `in ${(cohFn?.[0] ?? '').length} chars — a geometric lerp on strength could never reach its neutral value`);
// ⚠️ **THE ASYMMETRIC CASE IS THE OPPOSITE OF `interpolateLiquid`'S AND THE DIFFERENCE IS LOAD-BEARING.**
// `liquid` CARRIES the present side, because an absent block there means "not in the liquid mode, parameters
// undefined". An absent `cohesion` means something exact instead: `main.ts` emits it only when `strength > 0`,
// so absent IS `strength: 0`. Carrying it would leave the figure fully beaded at t = 1 on a preset the user can
// see is not beaded, which reads as the crossfade failing to finish rather than as a Mixer bug.
chk('...and a ONE-SIDED crossfade fades strength toward 0 rather than carrying it (unlike liquid)',
  !!cohFn && /strength: t \* b!\.strength/.test(cohFn[0]) && /strength: inv \* a\.strength/.test(cohFn[0]),
  'absent means strength 0 here, not "undefined" — main.ts gates the export on strength > 0');
// The geometry is carried on that same one-sided path, and that is not an inconsistency: at strength 0 these
// two are unread, so lerping them toward DEFAULT_COHESION_CONFIG would resize the drops on the way out.
chk('...while carrying radius and returnForce, which are unread at strength 0',
  !!cohFn && /radius: b!\.radius/.test(cohFn[0]) && /radius: a\.radius/.test(cohFn[0]),
  'lerping the geometry toward a default would change the drop SIZE while the beading fades');

// Invariant 13's half that no track assertion covers: the three sliders must reach the engine. Asserted on the
// descriptor's own `set`, because a `SliderSpec` whose `set` writes a local is a perfectly typed dead control.
const vfxTxt = stripComments(rd('src/ui/synthesis-lab/tabs/visual-fx.ts'));
for (const f of ['strength', 'radius', 'returnForce']) {
  chk(`the cohesion.${f} slider writes through setCohesionConfig (invariant 13)`,
    new RegExp(`key: 'cohesion\\.${f}'[\\s\\S]{0,400}?setCohesionConfig\\(\\{ \\.\\.\\.this\\.controls`
      + `\\.getCohesionConfig\\(\\), ${f}: v \\}\\)`).test(vfxTxt),
    'a beading control that moves nothing reads as "cohesion is subtle", not as a defect');
}

// ---------------------------------------------------------------------------------------------------
console.log('\n=== J. Index Cycles: logarithmic track with a sticky categorical zero (v8 Step 21.4e) ===\n');
// ---------------------------------------------------------------------------------------------------
//
// `generators.colorFreq`, per channel: how many colour cycles the legacy law completes around the particle
// index. Two properties no earlier track in this file has BOTH of:
//
//   - the range spans **six decades** (0.002 … 2016, a ratio of about a million), so a fixed decimal grid
//     cannot serve it: three decimals collapse the bottom decade to a handful of values and four decimals
//     at the top are meaningless. The quantisation is therefore in SIGNIFICANT FIGURES, which is a grid
//     whose spacing changes along the track — the readout has to be checked on the same grid or the label
//     and the value disagree, invisibly, in the middle of a drag.
//   - 0 is CATEGORICAL, not "very slow": every particle takes the same colour and the figure becomes one
//     hue. A logarithmic map has no zero at all, so it is reached by a dead BAND at the bottom of the
//     travel, and the band boundary has to be an exact stop or the smallest authored value is unreachable.
//
// ⚠️ **The authored values are taken by COMPOSING the library, not by grepping `src/presets/`.** A settled
// refinement replaces a legacy key in place, so a grep basis undercounts exactly the entries most recently
// touched — and `21.4d`'s adoption means the bodies that matter here are produced by the MIGRATION and
// appear in no source file at all.
const { PresetManager: PM } = await import('../src/presets/manager.ts');
const { loadLibrary: LL } = await import('../src/presets/library.ts');
const rawTxt = rd('public/psss_presets.json');
const mgrT = new PM();
LL(mgrT, JSON.parse(rawTxt.slice(rawTxt.indexOf('{')).replace(/;\s*$/, '')));
const BODIES = mgrT.list().map((n) => mgrT.get(n));

const {
  CYCLES_MIN, CYCLES_MAX, CYCLES_STEP, CYCLES_TRACK, fmtIndexCycles,
  COLOUR_DRIFT_MAX, COLOUR_DRIFT_STEP, COLOUR_DRIFT_TRACK, fmtColourDrift,
} = VFX;

/** Every authored component of one generator vector, deduped, ascending. */
const authoredVec = (field) => {
  const s = new Set();
  for (const p of BODIES) for (const v of (p.generators?.[field] ?? [])) if (Number.isFinite(v)) s.add(v);
  return [...s].sort((a, b) => a - b);
};
const CYCLES_AUTHORED = authoredVec('colorFreq');
const DRIFT_AUTHORED = authoredVec('colorShift');

const cStops = stops(CYCLES_STEP);
const cVals = cStops.map(CYCLES_TRACK.fromPos);
const cSan = (pos) => sanitize(pos, 0, 1, CYCLES_STEP);

chk('the endpoints are EXACT: the top is CYCLES_MAX and the bottom stop is the categorical 0',
  cVals[cVals.length - 1] === CYCLES_MAX && cVals[0] === 0,
  `[${cVals[0]}, ${cVals[cVals.length - 1]}] over ${cVals.length} stops, range ${CYCLES_MIN}..${CYCLES_MAX}`);
// ⚠️ The band boundary must itself be a stop, or `toPos(CYCLES_MIN)` lands INSIDE the dead zone and the
// smallest authored value cannot be reached by dragging at all — reachability, not resolution, and the two
// are separate properties (the *Slider tracks* rule).
chk('...and CYCLES_MIN round-trips through the band boundary, so the smallest authored value is ON the track',
  CYCLES_TRACK.fromPos(cSan(CYCLES_TRACK.toPos(CYCLES_MIN))) === CYCLES_MIN,
  `toPos(${CYCLES_MIN}) = ${CYCLES_TRACK.toPos(CYCLES_MIN)}, which must be an exact multiple of the step `
  + `(${CYCLES_TRACK.toPos(CYCLES_MIN) / CYCLES_STEP})`);
chk('monotonically non-decreasing', cVals.every((v, i) => i === 0 || v >= cVals[i - 1]));
// A NaN from an imported preset must park on the zero stop rather than producing NaN as a handle position,
// which the element silently reads as its `min`.
chk('...and a NaN, a negative and an out-of-range value all sanitise rather than escaping',
  CYCLES_TRACK.toPos(NaN) === 0 && CYCLES_TRACK.toPos(-5) === 0
  && CYCLES_TRACK.fromPos(2) === CYCLES_MAX && CYCLES_TRACK.fromPos(NaN) === 0
  && CYCLES_TRACK.fromPos(-1) === 0,
  'the element clamps its own position, but `fromPos` is also called with a stored value on a preset load');
/*
 * REACHABILITY over the authored library — and ⚠️ **two round trips wear the same words here.** Without the
 * element's position grid, `fromPos(toPos(v))` is exact for all 34; through the grid a real `<input>` applies,
 * 4 are. The FIRST figure is the one that is easy to measure and the one that means nothing in a browser, so
 * both are asserted, and the loose one is stated as a BOUND rather than as a count: nearest-stop snapping can
 * move a value by at most half the local gap, and this track's worst gap anywhere is 0.79 %.
 *
 * ⚠️ **Exactness through the grid is unattainable and must not be "fixed".** It would need a stop whose
 * exponential lands on each authored number, and a step fine enough for that is the dead-run defect at the top
 * of this file. What makes the inexactness HARMLESS is the clause two below — a resync never writes back — and
 * that is the assertion to protect.
 */
const cRt = CYCLES_AUTHORED.map((v) => [v, CYCLES_TRACK.fromPos(cSan(CYCLES_TRACK.toPos(v)))]);
const cExact = cRt.filter(([v, r]) => r === v).length;
chk(`all ${CYCLES_AUTHORED.length} authored colorFreq components round-trip exactly through the CURVE`,
  CYCLES_AUTHORED.every((v) => CYCLES_TRACK.fromPos(CYCLES_TRACK.toPos(v)) === v),
  `spanning ${CYCLES_AUTHORED[0]} … ${CYCLES_AUTHORED[CYCLES_AUTHORED.length - 1]} — this is the four-sig-fig `
  + 'grid doing its job, and it is NOT evidence about a drag');
const cDev = Math.max(...cRt.map(([v, r]) => (v === 0 ? 0 : Math.abs(r - v) / v)));
chk(`...and through the ELEMENT's position grid, ${cExact} are exact and the rest move by at most half a gap`,
  cDev <= 0.0079 / 2 + 1e-9,
  `worst relative deviation ${(cDev * 100).toFixed(3)} % against a worst adjacent gap of 0.79 %. A value moving `
  + 'FURTHER than half a gap means the snap is not landing on the nearest stop — a `toPos`/`fromPos` pair that '
  + 'is not an inverse, which is invisible in the exact count above');
/*
 * ⚠️ **The clause that makes the two clauses above harmless, and it belongs to BOTH tracks.** `syncControl`'s
 * `triplet` branch may write the handle from `toPos(stored)` and the readout from `fmt(stored)` — the STORED
 * value, never `fromPos` of the snapped handle — and it may not call `c.set`. If it did either, every preset
 * load would quantise 30 of the 34 authored `colorFreq` components and 12 of the 30 `colorShift` ones INTO the
 * preset, and Export would stop being byte-identical to what was imported. Source-shaped because it is a
 * statement about which value the sync READS, and no arithmetic over the track can see it.
 */
{
  const m = /case 'triplet': \{[\s\S]*?\n      \}/.exec(stripComments(rd('src/ui/synthesis-lab/tabs/visual-fx.ts')));
  const body = m ? m[0] : '';
  /*
   * ⚠️ **v8 `34.4` RE-POINTED, NOT WIDENED, AND THE RED THAT CAUSED IT WAS THE CLAUSE WORKING.**
   * `TripletSpec.fmt` gained a second parameter (`axis`), because three of Phase 34's rows print `(clipped)`
   * and cannot know whether a cell is clipped without knowing which cell it is. The old pattern demanded the
   * literal `c.fmt(raw)` and went RED on a behaviour-NEUTRAL signature change — read a red here as a claim
   * about the ANCHOR until the anchor is exonerated.
   *
   * ⚠️ **`c\.fmt\(raw[,)]` keeps the property the clause is actually about: the readout is given the STORED
   * value.** It still refuses `c.fmt(c.fromPos(...))` and still refuses a formatter fed the snapped handle,
   * which is the whole point — a wider pattern such as `c\.fmt\(` would pass over exactly that defect.
   */
  chk('a RESYNC writes handle and readout from the STORED value and never calls the setter',
    !!body && /c\.toPos \? c\.toPos\(raw\) : raw/.test(body) && /c\.fmt\(raw[,)]/.test(body)
    && !/c\.set\(/.test(body),
    body ? 'so a load cannot rewrite an authored value the position grid cannot hold — only a deliberate drag '
      + 'of that channel moves it' : 'the `case \'triplet\'` branch was not found — this clause is measuring '
      + 'nothing, which is worse than a missing one');
}
chk('...and the range COVERS them, at both ends',
  CYCLES_AUTHORED.every((v) => v === 0 || (v >= CYCLES_MIN && v <= CYCLES_MAX)),
  `authored max ${CYCLES_AUTHORED[CYCLES_AUTHORED.length - 1]} vs CYCLES_MAX ${CYCLES_MAX}; a `
  + 'range `min` is cosmetic but a range that EXCLUDES an authored value silently rewrites it');
// The readout must be 1:1 over the stops, on the SAME grid the track quantises to. A coarser label makes a
// drag read inert; `fmtIndexCycles`' header records the measured `toFixed(3)` failure this replaced.
const cLabels = new Map();
for (const v of cVals) {
  const l = fmtIndexCycles(v);
  if (!cLabels.has(l)) cLabels.set(l, new Set());
  cLabels.get(l).add(v);
}
const cCollisions = [...cLabels].filter(([, vs]) => vs.size > 1);
chk(`the readout is 1:1 over the stops — ${new Set(cVals).size} distinct values, ${cLabels.size} labels`,
  cCollisions.length === 0,
  cCollisions.length
    ? `${cCollisions.length} label(s) cover >1 value: ${cCollisions.slice(0, 3).map(([l, vs]) => `${l}←${[...vs].slice(0, 3).join('/')}`).join(', ')}`
    : 'four significant figures, the same grid `fromPos` quantises to — a label that cannot distinguish two '
    + 'stops makes the difference between them invisible while it is real');
chk('...and `Flat` is printed at 0 and NOWHERE else',
  fmtIndexCycles(0) === 'Flat' && cVals.filter((v) => fmtIndexCycles(v) === 'Flat').every((v) => v === 0),
  '0 is categorical here — one hue for the whole figure — and `0.000` would read as "a very slow cycle"');
// Dead runs: a step too FINE is as much a defect as one too coarse, and it presents as a keyboard arrow
// doing nothing N times in a row.
let cRun = 1, cWorst = 0, cWorstVal = 0;
for (let i = 1; i < cVals.length; i++) {
  if (cVals[i] === cVals[i - 1] && cVals[i] !== 0) {
    cRun++; if (cRun > cWorst) { cWorst = cRun; cWorstVal = cVals[i]; }
  } else cRun = 1;
}
chk('...and the worst NON-ZERO dead run is inside the 60-stop house ceiling',
  cWorst <= 60, `${cWorst} stops at ${cWorstVal}`);
// The sticky zero is deliberate and bounded: it must be big enough to hit and small enough not to eat the
// bottom decade. Reported with its share of the travel rather than asserted against a literal band constant,
// because the band is what MAKES the zero reachable and its size is the trade.
const cZeroShare = cVals.filter((v) => v === 0).length / cVals.length;
chk('...and the categorical zero occupies a small but hittable share of the travel',
  cZeroShare > 0.005 && cZeroShare < 0.06, `${(cZeroShare * 100).toFixed(1)} % of the stops`);
chk('IDEMPOTENT at every stop — a resync cannot make a value creep',
  cVals.every((v) => CYCLES_TRACK.fromPos(cSan(CYCLES_TRACK.toPos(v))) === v),
  'a preset load calls `toPos`, a drag calls `fromPos`; a non-idempotent pair drifts once per resync');
// Invariant 13's half no track assertion covers: the control must reach the engine AND the preset.
chk('the Cycles slider writes BOTH the generator and `preset.generators.colorFreq` (invariant 13)',
  /setIndexCycles:\s*\(channel, v\)\s*=>\s*\{[\s\S]{0,300}?generator\.setColorFreq\(next\);[\s\S]{0,200}?preset\.generators\.colorFreq = next;/
    .test(stripComments(rd('src/main.ts'))),
  'the generator draws this frame; `preset.generators` is what Export, the Mixer, the Randomiser and '
  + '`preset-stats` read. Writing one only is invariant 13 in one direction or the other, and both directions '
  + 'look correct from the slider');
chk('...and the descriptor itself is wired to that setter',
  /key: 'indexCycles'[\s\S]{0,400}?this\.controls\.setIndexCycles\(i, v\)/.test(stripComments(rd('src/ui/synthesis-lab/tabs/visual-fx.ts'))),
  'a `SliderSpec` whose `set` writes a local is a perfectly typed dead control');

// ---------------------------------------------------------------------------------------------------
console.log('\n=== K. Colour Drift: signed quartic track, +-3, centred on a sticky 0 (v8 Step 21.4e) ===\n');
// ---------------------------------------------------------------------------------------------------
//
// `generators.colorShift`, per channel: radians of phase per `pos` unit. Everything section E says about a
// signed centred track applies, plus one property that is this quantity's alone:
//
// ⚠️ **the SIGN is a direction in time.** `colorShift` multiplies `pos`, so `−s` runs the hue sweep backwards
// — a visibly different animation, and the library authors exactly one negative channel. A track that folded
// the sign (an absolute-value curve, the obvious "simplification") would make that one preset unrepresentable
// while every measurement above still passed.
const dStops = (() => {
  const n = Math.round(2 / COLOUR_DRIFT_STEP);
  return Array.from({ length: n + 1 }, (_, i) => sanitize(-1 + i * COLOUR_DRIFT_STEP, -1, 1, COLOUR_DRIFT_STEP));
})();
const dVals = dStops.map(COLOUR_DRIFT_TRACK.fromPos);
const dSan = (pos) => sanitize(pos, -1, 1, COLOUR_DRIFT_STEP);

chk('the endpoints are EXACTLY +-COLOUR_DRIFT_MAX',
  dVals[0] === -COLOUR_DRIFT_MAX && dVals[dVals.length - 1] === COLOUR_DRIFT_MAX,
  `[${dVals[0]}, ${dVals[dVals.length - 1]}] over ${dVals.length} stops`);
chk('monotonically non-decreasing across the whole signed travel',
  dVals.every((v, i) => i === 0 || v >= dVals[i - 1]));
// 0 must be EXACTLY reachable and the two halves symmetric — 26 authored channels are 0 and it is the
// categorical "this channel does not move" state.
chk('0 is exactly reachable, at the centre, and the curve is ODD',
  dVals.includes(0) && COLOUR_DRIFT_TRACK.fromPos(0) === 0 && COLOUR_DRIFT_TRACK.toPos(0) === 0
  && [0.001, 0.1, 0.7, 1, 2.5, 3].every((v) => COLOUR_DRIFT_TRACK.toPos(-v) === -COLOUR_DRIFT_TRACK.toPos(v))
  && [0.25, 0.5, 0.9].every((p) => COLOUR_DRIFT_TRACK.fromPos(-p) === -COLOUR_DRIFT_TRACK.fromPos(p)),
  '⚠️ `fromPos(0) === 0` alone is not enough — section E records why: `sign(0)` is 0, so the expression can '
  + 'be zero at the centre while the SET of stops contains no zero. Both are asserted');
/*
 * ⚠️ **This clause CAUGHT a live defect on its first run (2026-09-18) and the seed below is that defect.**
 * `fromPos` quantised the SIGNED value with `Math.round`, which breaks ties toward +∞: a magnitude landing on
 * an exact half-grid rounded UP on the right of centre and DOWN on the left, so `fromPos(±0.5)` gave
 * `0.188 / −0.187`. One LSB of the last printed decimal, on a hue-drift rate — nothing to see in the figure,
 * nothing for `tsc`, and no other clause in this section could reach it: the endpoints, the monotonicity, the
 * 1:1 readout, the dead runs and the idempotence are all satisfied by an asymmetric track.
 */
{
  const signedRound = (pos) => {
    const p = Math.max(-1, Math.min(1, pos));
    const raw = Math.sign(p) * COLOUR_DRIFT_MAX * Math.pow(Math.abs(p), 4);
    return Number((Math.round(raw / 0.001) * 0.001).toFixed(3));
  };
  const broken = [0.25, 0.5, 0.9, 0.123, 0.777].filter((p) => signedRound(-p) !== -signedRound(p));
  chk('CALIB: quantising the SIGNED value instead of the magnitude breaks the oddness, and is caught',
    broken.length > 0,
    `the pre-fix expression is asymmetric at ${broken.length} of 5 probes (e.g. ±0.5 → `
    + `${signedRound(0.5)} / ${signedRound(-0.5)}). A seed that failed to reproduce would mean the clause `
    + 'above is passing for a reason other than the fix');
}
chk('...and a NaN or an out-of-range magnitude sanitises rather than escaping',
  COLOUR_DRIFT_TRACK.toPos(NaN) === 0 && COLOUR_DRIFT_TRACK.fromPos(NaN) === 0
  && COLOUR_DRIFT_TRACK.toPos(99) === 1 && COLOUR_DRIFT_TRACK.toPos(-99) === -1);
/*
 * ⚠️ **The same two round trips as §J, and here the LOOSE bound has to be in the stored unit, not relative.**
 * A quartic is nearly flat at the centre and steep at the end, so the stop spacing runs from ~1e-5 near 0 to
 * 0.008 at ±3: a relative tolerance would be absurdly tight at one end and vacuous at the other, while "half
 * the local gap" is one rule that holds everywhere. The worst deviation is at the authored `2`, which is the
 * steepest part of the track carrying an authored value — so this bound is measured where it is loosest, which
 * is the only place a wrong `toPos`/`fromPos` pair would be caught.
 */
const dRt = DRIFT_AUTHORED.map((v) => [v, COLOUR_DRIFT_TRACK.fromPos(dSan(COLOUR_DRIFT_TRACK.toPos(v)))]);
const dExact = dRt.filter(([v, r]) => r === v);
chk(`${DRIFT_AUTHORED.length - 1} of ${DRIFT_AUTHORED.length} authored colorShift components round-trip `
  + 'exactly through the CURVE',
  DRIFT_AUTHORED.filter((v) => COLOUR_DRIFT_TRACK.fromPos(COLOUR_DRIFT_TRACK.toPos(v)) === v).length
    === DRIFT_AUTHORED.length - 1,
  'the one exception is the authored `0.1001`, which is not a multiple of the 0.001 grid — and this figure, like '
  + '§J\'s, says nothing about a drag');
{
  // Half the local gap at each value's own stop: the general form of "it landed on the nearest stop".
  const worst = dRt.reduce((acc, [v, r]) => {
    const p = dSan(COLOUR_DRIFT_TRACK.toPos(v));
    const gap = Math.max(
      Math.abs(COLOUR_DRIFT_TRACK.fromPos(p + COLOUR_DRIFT_STEP) - r),
      Math.abs(r - COLOUR_DRIFT_TRACK.fromPos(p - COLOUR_DRIFT_STEP)),
    );
    const dev = Math.abs(r - v);
    return dev / Math.max(gap, 1e-12) > acc.ratio ? { ratio: dev / Math.max(gap, 1e-12), v, r, dev } : acc;
  }, { ratio: 0, v: 0, r: 0, dev: 0 });
  chk(`...and through the ELEMENT's position grid, ${dExact.length} are exact and the rest land on the NEAREST stop`,
    worst.ratio <= 0.5 + 1e-9,
    `worst offender ${worst.v} → ${worst.r} (deviation ${worst.dev.toFixed(4)}), which is `
    + `${worst.ratio.toFixed(3)} of the gap at that point; the bound is 0.5. ⚠️ A deviation EXCEEDING half a gap `
    + 'is the real defect class — the pair is not an inverse — and the exact count above cannot see it');
}
chk('...and the range COVERS every authored magnitude, sign included',
  DRIFT_AUTHORED.every((v) => Math.abs(v) <= COLOUR_DRIFT_MAX)
  && DRIFT_AUTHORED.some((v) => v < 0),
  `authored ${DRIFT_AUTHORED[0]} … ${DRIFT_AUTHORED[DRIFT_AUTHORED.length - 1]} against +-${COLOUR_DRIFT_MAX}; `
  + `${DRIFT_AUTHORED.filter((v) => v < 0).length} negative component(s) — if that count is ever 0, this `
  + 'clause stops witnessing the signedness and the SIGN assertion above is the only one left');
const dLabels = new Map();
for (const v of dVals) {
  const l = fmtColourDrift(v);
  if (!dLabels.has(l)) dLabels.set(l, new Set());
  dLabels.get(l).add(v);
}
const dCollisions = [...dLabels].filter(([, vs]) => vs.size > 1);
chk(`the readout is 1:1 over the stops — ${new Set(dVals).size} distinct values, ${dLabels.size} labels`,
  dCollisions.length === 0,
  dCollisions.length
    ? `${dCollisions.length} collision(s): ${dCollisions.slice(0, 3).map(([l, vs]) => `${l}←${[...vs].slice(0, 3).join('/')}`).join(', ')}`
    : 'at two decimals these collapse to about 780 labels — two thirds of every drag reading as inert');
chk('...and `Off` is printed at 0 and NOWHERE else, with the sign carried on the magnitude',
  fmtColourDrift(0) === 'Off' && dVals.filter((v) => fmtColourDrift(v) === 'Off').every((v) => v === 0)
  && fmtColourDrift(-0.7) === '-0.700' && fmtColourDrift(0.7) === '0.700',
  '0 is categorical: the channel\'s hue does not move at all');
let dRun = 1, dWorst = 0, dWorstVal = 0;
for (let i = 1; i < dVals.length; i++) {
  if (dVals[i] === dVals[i - 1] && dVals[i] !== 0) {
    dRun++; if (dRun > dWorst) { dWorst = dRun; dWorstVal = dVals[i]; }
  } else dRun = 1;
}
chk('...and the worst NON-ZERO dead run is inside the 60-stop house ceiling',
  dWorst <= 60,
  `${dWorst} stops at ${dWorstVal}. ⚠️ COLOUR_DRIFT_STEP is 0.001 and NOT 0.0005 for exactly this reason — `
  + 'the finer step doubles this run past the ceiling and buys no value the grid can hold');
chk('IDEMPOTENT at every stop',
  dVals.every((v) => COLOUR_DRIFT_TRACK.fromPos(dSan(COLOUR_DRIFT_TRACK.toPos(v))) === v));
chk('the Drift slider writes BOTH the generator and `preset.generators.colorShift` (invariant 13)',
  /setColourDrift:\s*\(channel, v\)\s*=>\s*\{[\s\S]{0,300}?generator\.setColorShift\(next\);[\s\S]{0,200}?preset\.generators\.colorShift = next;/
    .test(stripComments(rd('src/main.ts'))),
  'both writes are required, for `setIndexCycles`\' reason');
chk('...and the descriptor itself is wired to that setter',
  /key: 'colourDrift'[\s\S]{0,400}?this\.controls\.setColourDrift\(i, v\)/.test(stripComments(rd('src/ui/synthesis-lab/tabs/visual-fx.ts'))));
/*
 * ⚠️ **The two tracks are in DIFFERENT UNITS and the asymmetry is in the law, not in the UI.** `colorFreq` is
 * divided by `DEG` inside `writeColourAt()` and `colorShift` is not — the same asymmetry the Composer's
 * `FM.Base` note names. Asserted on the SOURCE of the law, because getting it backwards in either track would
 * scale a control by 57 and still produce a plausible picture.
 */
const lissTxt = stripComments(rd('src/generators/lissajous.ts'));
/*
 * ⚠️ **RE-BASED 2026-10-06 FOR v8 `26.4`, AND THIS FAILURE WAS A CLAIM ABOUT THE CHECKER.** The clause pinned
 * the WHOLE `Math.sin(...)` argument, closing on `this.colorShift[c]!)`, so it broke the moment the law gained
 * a THIRD term — `26.4`'s hue rotation, `+ hueRad` — on a change that touched neither unit. **The property is
 * untouched: `colorFreq` is still divided by `DEG` and `colorShift` is still not.** The two units are now
 * asserted SEPARATELY, so a further term cannot break a clause that has no opinion about it, while getting
 * either unit backwards still fails.
 *
 * ⚠️ **The old form is kept readable above rather than deleted**, because a clause that fails on edits it
 * asserts nothing about is the weakest kind of instrument and this is the second time this file has met one.
 */
chk('the colour law divides colorFreq by DEG',
  /\(n \* this\.colorFreq\[c\]!\) \/ DEG/.test(lissTxt),
  'a control scaled by 180/π still moves the right thing and still looks plausible — invariant 10, where the '
  + 'units of the RESULT are what must be checked rather than the plausibility of the expression');
chk('...and does NOT divide colorShift',
  /pos \* this\.colorShift\[c\]!/.test(lissTxt)
  && !/this\.colorShift\[c\]!\s*\/\s*DEG/.test(lissTxt),
  'the asymmetry is in the LAW, not in the UI — the same one the `FM.Base` note in the Composer names');

// ---------------------------------------------------------------------------------------------------
console.log('\n=== L. 21.4e\'s gate: the distinct VECTORS, the export round trip, and the two named presets ===\n');
// ---------------------------------------------------------------------------------------------------
//
// §J and §K measure COMPONENTS, which is what a slider moves. The step's gate is stated over VECTORS, and the
// difference is not cosmetic: a vector is what a preset actually authors, so a component census can report
// everything representable while a particular preset is unreachable as a whole. Both are measured.
//
// ⚠️ **The plan's figures are 20 cycle vectors and 15 drift vectors and they are HISTORICAL.** Five library
// batches and the `" warpfirst"` deletion have landed since; the counts below are re-measured and the gate is
// "every distinct vector", never "20 of them". Do no arithmetic against the plan's numbers — a difference here
// is a BASIS difference, not an event.
const vectorSet = (field) => {
  const m = new Map();
  for (const p of BODIES) {
    const v = p.generators?.[field];
    if (Array.isArray(v) && v.length === 3) m.set(JSON.stringify(v), p.metadata.name);
  }
  return m;
};
const CYC_VECTORS = vectorSet('colorFreq');
const DRIFT_VECTORS = vectorSet('colorShift');

const cycUnreachable = [...CYC_VECTORS].filter(([k]) => {
  const vec = JSON.parse(k);
  return vec.some((v) => v !== 0 && (v < CYCLES_MIN || v > CYCLES_MAX));
});
const driftUnreachable = [...DRIFT_VECTORS].filter(([k]) =>
  JSON.parse(k).some((v) => Math.abs(v) > COLOUR_DRIFT_MAX));
chk(`all ${CYC_VECTORS.size} distinct cycle vectors and ${DRIFT_VECTORS.size} distinct drift vectors sit inside `
  + 'their tracks',
  cycUnreachable.length === 0 && driftUnreachable.length === 0,
  cycUnreachable.length || driftUnreachable.length
    ? `outside: ${[...cycUnreachable, ...driftUnreachable].map(([k, n]) => `${n} ${k}`).join(', ')}`
    : 'a component outside the range is silently REWRITTEN by the first drag of any channel in the vector');
// The gate's other half: "round-trips through export". The export path is `deepCopy` + an `overlay` snapshot and
// `JSON.stringify(preset, null, 2)`; the import path is `MigrationLayer.migrate`. `generators` is not gated by
// either — which is the claim being tested, since 21.4d put a MIGRATION between an export and its re-import.
const { MigrationLayer } = await import('../src/presets/migration.ts');
{
  const broken = [];
  for (const name of mgrT.list()) {
    const body = mgrT.get(name);
    const back = MigrationLayer.migrate(name, JSON.parse(JSON.stringify(body, null, 2)));
    for (const f of ['colorFreq', 'colorShift']) {
      if (JSON.stringify(back.generators?.[f]) !== JSON.stringify(body.generators?.[f])) broken.push(`${name}.${f}`);
    }
  }
  chk(`both vectors survive export → re-import on all ${mgrT.list().length} composed bodies`,
    broken.length === 0,
    broken.length ? `${broken.length} changed: ${broken.slice(0, 5).join(', ')}`
      : '⚠️ 21.4d put a MIGRATION between an export and its re-import, and that migration READS this exact pair '
      + '(`colorBase`/`colorAmp`) to adopt a palette. A rule that also normalised the RATES would rewrite a '
      + 'preset on a round trip through the disk, which no in-memory test sees');
}
// The two presets the gate names by hand, because each is an endpoint of one track and nothing else is.
const multiple = mgrT.list().includes('Multiple') ? mgrT.get('Multiple') : null;
chk('`Multiple` authors 2016 and the track\'s top IS that value, so its handle sits at pos 1',
  !!multiple && (multiple.generators?.colorFreq ?? []).includes(CYCLES_MAX)
  && CYCLES_TRACK.toPos(CYCLES_MAX) === 1 && CYCLES_TRACK.fromPos(1) === CYCLES_MAX,
  multiple ? `colorFreq ${JSON.stringify(multiple.generators?.colorFreq)} against CYCLES_MAX ${CYCLES_MAX} — the `
    + 'range was DERIVED from this preset, so if it is ever retuned the top of the track is the thing to re-derive'
    : '⚠️ `Multiple` is absent from the library — this clause is measuring nothing, and the gate names it');
const radar = mgrT.list().includes('Radar') ? mgrT.get('Radar') : null;
chk('`Radar` authors an all-zero drift, and all three channels read `Off`',
  !!radar && (radar.generators?.colorShift ?? [1]).every((v) => v === 0)
  && (radar.generators?.colorShift ?? []).every((v) => fmtColourDrift(v) === 'Off'),
  radar ? `colorShift ${JSON.stringify(radar.generators?.colorShift)} — a static index gradient, which is a `
    + 'STATE and not a slow one' : '⚠️ `Radar` is absent — the gate names it');
// …and the period row must print NOTHING there. Source-shaped: `driftPeriod()` is private, and the rule is about
// which of two elements is shown rather than about a number.
{
  const t = stripComments(rd('src/ui/synthesis-lab/tabs/visual-fx.ts'));
  chk('...and the period readout REFUSES on an all-zero drift rather than printing a period',
    /if \(shift !== 0 && Number\.isFinite\(shift\)\) rates\.push/.test(t)
    && /if \(rates\.length === 0\) return null;/.test(t)
    && /show\(this\.indexStaticNote, period === null\);/.test(t),
    '§18\'s rule — print nothing where no period exists. ⚠️ The refusal is on a zero RATE and never on a zero '
    + 'amplitude: a flat channel is a different inertness and the swatch strip already names it');
}

// ---------------------------------------------------------------------------------------------------
console.log('\n=== M. the static field: Strength on a signed quartic to ±16, Detail, and the exported Drift track '
  + '(v8 21.12/21.13, 21.13 REVERSED 2026-09-25) ===\n');
// ---------------------------------------------------------------------------------------------------
//
// ⚠️ **Three tracks moved into a NEW tab in 21.12, and a relocation is the one event that disarms a checker
// without failing it** — `fieldcheck` §G proved that in the same sitting: its negated assertion about
// `setStaticField` kept passing after the function it names had left the file it was pointed at. So every
// clause here is measured against the constants and against the TAB's source, never `visual-fx.ts`.
//
// ⚠️ **What is new here and nowhere else: the RANGE is quoted back to the user in PROSE.** The identification
// line prints "matching it needs Strength 1.37" and "the Detail slider only reaches 0.25 to 8", so the track
// and the sentence are two views of one pair of numbers — the defect *Slider tracks* warns about ("readout
// precision included"), except the readout is a paragraph rather than a label, so no glance at the panel
// catches a disagreement.
{
  const {
    STATIC_FIELD_STRENGTH_MAX, STATIC_FIELD_STRENGTH_MIN, STATIC_FIELD_DEFAULTS,
    STATIC_FIELD_STRENGTH_STEP, STATIC_FIELD_STRENGTH_GRID, STATIC_FIELD_STRENGTH_TRACK,
    STATIC_FIELD_DETAIL_MIN, STATIC_FIELD_DETAIL_MAX, STATIC_FIELD_DETAIL_STEP,
    identifyArchetype,
  } = await import('../src/post-processors/static-field.ts');
  const { chainFromOverlay, isSeparableStyle } = await import('../src/post-processors/trans-map-chain.ts');
  const { DRIFT_TRACK } = VFX;
  const TAB = stripComments(rd('src/ui/synthesis-lab/tabs/transmap.ts'));
  const VTAB = stripComments(rd('src/ui/synthesis-lab/tabs/visual-fx.ts'));
  const FM = stripComments(rd('src/ui/synthesis-lab/field-measure.ts'));
  const onGrid = (v, min, max, step) => v >= min - 1e-12 && v <= max + 1e-12
    && Math.abs(min + Math.round((v - min) / step) * step - v) < 1e-9;

  /*
   * ---- the Strength track: SIGNED since 2026-09-22, CURVED and ±16 since 2026-09-25 ----------------------
   *
   * ⚠️ **A signed track broke the assumption the first draft of this section rested on — that 0 is an end stop —
   * and the CURVE broke the one the second draft rested on: that the stops are `min + k·step` in the VALUE.** They
   * are not. Position and value are now different units, so every clause below has to say which one it is in, and
   * the old `sStops` array (401 evenly spaced values) would have measured a track that no longer exists while
   * passing on any curve at all. That is the calibration rule in *Verify*: **a measuring section's own basis has
   * been the defect repeatedly.**
   *
   * ⚠️ **What replaced 21.13's resolution argument is a MEASUREMENT of the value grid, not a promise.** 21.13
   * refused a wider top because a LINEAR widening halves the resolution where the library sits. On this track the
   * curve carries the range and `STATIC_FIELD_STRENGTH_GRID` carries the resolution, so the two are independent —
   * and the clause that proves it is "381 of the old track's 401 values are still reachable" below. Read a failure
   * there as the widening having cost something after all.
   *
   * ⚠️ **FOUR handles now carry this one track, in TWO tab files, and the source-shaped clauses read BOTH.** The
   * header above says every clause is measured against the tab's own source rather than `visual-fx.ts` — that was
   * written when three tracks had just moved INTO this tab, and it is now too narrow: `CLAUDE.md` records that
   * `tipcheck` §C/§D read `visual-fx.ts` alone and cannot see the Transmap tab, and the mirror of that gap is a
   * clause reading `transmap.ts` alone while two more copies of the row live elsewhere. Both files, counted
   * separately, with the count in the message.
   *
   * ⚠️ **CALIBRATED against five seeded defects, 2026-09-25 — and one of the seeds found a real one, which is the
   * reason this paragraph exists rather than a claim that the section is sound.** Each seed was applied to `src/`,
   * measured, and reverted (`diff -q` verified):
   *
   *   `CURVE` 4 → 2 .................. 1 clause (the 381/401 survival)
   *   `GRID` 0.01 → 0.001 ............ 5 clauses, which was **TOO FEW**: the parity point and the authored
   *                                    round trip stayed GREEN through a change to the grid they measure,
   *                                    because `fromPos` carried a literal `toFixed(2)` and re-coarsened every
   *                                    value back. **That is a defect in `src/`, found by the seed and fixed**
   *                                    (`STATIC_FIELD_STRENGTH_DECIMALS`); the same seed now trips 7, parity
   *                                    and the authored set among them.
   *   `MAX` 16 → 4 ................... 4 clauses, incl. the library-reachability pair the widening is FOR
   *   `slider()`'s `spec.toPos ? 0` .. 1 clause, and only its own — the signed-row bug this section was
   *                                    extended to catch
   *   one resync `toPos` dropped ..... 1 clause, and only its own
   *
   * The two source-shaped seeds landing on exactly one clause each is the property to keep: a grep that fires on
   * an unrelated edit is worse than no grep. **Re-seed after any change to the pair — a curve or a grid change
   * moves what every measured clause below is measuring.**
   */
  const T = STATIC_FIELD_STRENGTH_TRACK;
  const SFSRC = stripComments(rd('src/post-processors/static-field.ts'));
  const sPos = [];
  for (let k = -Math.round(1 / STATIC_FIELD_STRENGTH_STEP); k <= Math.round(1 / STATIC_FIELD_STRENGTH_STEP); k++) {
    sPos.push(k * STATIC_FIELD_STRENGTH_STEP);
  }
  const sVals = sPos.map((p) => T.fromPos(p));
  const sReach = new Set(sVals);
  // The grid the `<input>` itself applies before `fromPos` ever runs. Leaving it out is how a round-trip clause
  // measures the pair instead of the control — the mistake the Drift block below records at length.
  const sSnap = (pos) => Math.round(pos / STATIC_FIELD_STRENGTH_STEP) * STATIC_FIELD_STRENGTH_STEP;
  const sTrip = (v) => T.fromPos(sSnap(T.toPos(v)));

  // -- source-shaped: the value bounds must appear in NEITHER tab, because the track owns them now ----------
  const trackRows = (src) => (src.match(/STATIC_FIELD_STRENGTH_TRACK/g) ?? []).length;
  chk('Strength: the two Transmap rows read the shared TRACK, and the tab names no value bound at all',
    (TAB.match(/toPos: STATIC_FIELD_STRENGTH_TRACK\.toPos, fromPos: STATIC_FIELD_STRENGTH_TRACK\.fromPos/g) ?? []).length === 2
    && (TAB.match(/min: -1, max: 1, step: STATIC_FIELD_STRENGTH_STEP/g) ?? []).length === 2
    && !/STATIC_FIELD_STRENGTH_(MAX|MIN)/.test(TAB),
    `${trackRows(TAB)} references to the track in transmap.ts. ⚠️ TWO rows carry it (Strength and Zoom Strength), `
    + 'built in different functions ~230 lines apart, so one of them diverging is the asymmetry nothing else can '
    + 'see. ⚠️ A surviving `max: STATIC_FIELD_STRENGTH_MAX` on a MAPPED row is now WORSE than a drifted bound: it '
    + 'would be read as a POSITION of 16 and clamp the handle to a sixteenth of its travel');
  chk('...and the two Visual FX rows read the same track OBJECT, which is the copy a Transmap-only clause misses',
    (VTAB.match(/map: STATIC_FIELD_STRENGTH_TRACK/g) ?? []).length === 2
    && !/STATIC_FIELD_STRENGTH_(MAX|MIN)/.test(VTAB),
    `${trackRows(VTAB)} references in visual-fx.ts. Four handles, one curve: a second curve in one tab would be `
    + 'two controls wearing one name, and the two tabs are never open at the same time');
  chk('...and BOTH Visual FX rows apply toPos on the RESYNC, which is the only direction a preset load takes',
    (VTAB.match(/STATIC_FIELD_STRENGTH_TRACK\.toPos\)/g) ?? []).length === 2,
    'a missed toPos in updateStaticRows is silent on every drag and wrong on every load: the stored 0.5 would be '
    + 'written as a POSITION and park the handle at 87% of the track, with the label beside it still reading 0.50');
  chk('...and the EXPONENT lives in ONE named constant, used at both ends of the pair and nameable in neither tab',
    (SFSRC.match(/STATIC_FIELD_STRENGTH_CURVE/g) ?? []).length === 3
    && !/Math\.pow\([^;]*STATIC_FIELD_STRENGTH/.test(TAB + VTAB),
    '3 references expected: the declaration plus toPos and fromPos. ⚠️ A bare "no Math.pow in the tabs" clause was '
    + 'written first and FAILED ON CORRECT CODE — COLOUR_DRIFT_TRACK is itself a quartic and lives in '
    + 'visual-fx.ts, so the naive grep condemned the file that owns a different track. What actually makes a '
    + 'restated Strength curve unrepresentable is the clause above it: the curve needs the MAX to normalise, and '
    + 'neither tab may name it');
  chk('...and the Transmap slider helper takes its bounds from the CALLER, never a hardcoded 0..1 for mapped rows',
    /input\.min = String\(spec\.min\)/.test(TAB) && /input\.max = String\(spec\.max\)/.test(TAB),
    'this was `spec.toPos ? 0 : spec.min` until 2026-09-25 — a latent bug whose only possible victim is a SIGNED '
    + 'mapped track: the negative half would vanish on this tab alone, with the Visual FX copy still reaching it');

  // -- the bounds themselves --------------------------------------------------------------------------------
  chk('...and BOTH endpoints are EXACTLY reachable, so the range quoted in prose is two values and not two limits',
    T.fromPos(1) === STATIC_FIELD_STRENGTH_MAX && T.fromPos(-1) === STATIC_FIELD_STRENGTH_MIN,
    `endpoints ${T.fromPos(-1)} .. ${T.fromPos(1)} vs ${STATIC_FIELD_STRENGTH_MIN} .. ${STATIC_FIELD_STRENGTH_MAX} `
    + '— the identification line prints "Strength ±16" from the MAX alone, so an unreachable end would make that '
    + 'sentence false. A quartic is exact at both ends BY CONSTRUCTION, so a failure here means the quantiser');
  chk('...and the range is SYMMETRIC, derived from MAX rather than written twice',
    STATIC_FIELD_STRENGTH_MIN === -STATIC_FIELD_STRENGTH_MAX
    && /STATIC_FIELD_STRENGTH_MIN = -STATIC_FIELD_STRENGTH_MAX/.test(SFSRC),
    `${STATIC_FIELD_STRENGTH_MIN} vs -${STATIC_FIELD_STRENGTH_MAX}. A second literal is how the two halves come to `
    + 'have different reach, and the readout tests Math.abs(needed) against ONE threshold — so an asymmetric track '
    + 'would make it call an unreachable inverted match "within range"');
  chk('...and the curve is an ODD function at every stop, which a signed track of a DIRECTION has to be',
    sPos.every((p) => T.fromPos(-p) === -T.fromPos(p) || (T.fromPos(p) === 0 && T.fromPos(-p) === 0)),
    'COLOUR_DRIFT_TRACK records what breaks this: Math.round on a SIGNED value breaks ties toward +Inf, so a '
    + 'magnitude landing on a half-grid goes one way right of centre and the other way left — 1 LSB of the last '
    + 'printed decimal, invisible in the figure and invisible to tsc');
  chk('...and 0 is reachable and INTERIOR, because it is the identity and no longer an end stop',
    T.fromPos(0) === 0 && sReach.has(0) && sVals[0] !== 0 && sVals.at(-1) !== 0,
    'a curve that straddled 0 would put "no warp" out of reach by hand on a control whose whole purpose is size');
  {
    const sticky = sVals.filter((v) => v === 0).length;
    chk('...and the sticky zero is a MEASURED band rather than a dead third of the travel',
      sticky > 1 && sticky / sVals.length < 0.2,
      `${sticky} of ${sVals.length} positions (${(100 * sticky / sVals.length).toFixed(1)}%) quantise to 0. On a `
      + 'curve 0 is a BAND, not a stop, and that is kept for DRIFT_TRACK\'s reason: the identity is the value a '
      + 'user returns to. A LARGE span would be the dead-zone defect instead');
  }

  // -- resolution: the property 21.13 said a widening would cost ---------------------------------------------
  {
    const old = [];
    for (let k = -200; k <= 200; k++) old.push(Number((k * 0.01).toFixed(2)));
    const survive = old.filter((v) => sReach.has(v));
    const lost = old.filter((v) => !sReach.has(v)).map(Math.abs);
    const floor = Math.min(...lost);
    chk('...and RESOLUTION did not pay for the RANGE: 381 of the old ±2 track\'s 401 values are still reachable',
      survive.length === 381 && floor === 1.48
      && old.filter((v) => Math.abs(v) <= 1.47).every((v) => sReach.has(v)),
      `${survive.length}/401 survive; smallest magnitude now unreachable ${floor}. ⚠️ **This clause IS the reversal `
      + 'of 21.13** — that decision refused a wider top because a linear widening halves the resolution where the '
      + 'library sits, and the answer is that a quartic track with a flat 0.01 VALUE grid loses nothing below '
      + '±1.47. A drop here means the widening started costing what 21.13 feared. Re-derive, do not edit the 381');
    chk('...and the value grid IS the old step, in the STORED unit, so every reachable value is also printable',
      STATIC_FIELD_STRENGTH_GRID === 0.01 && sVals.every((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9),
      `grid ${STATIC_FIELD_STRENGTH_GRID}. Quantising POSITION instead would make which values exist depend on the `
      + 'curve — the trap core/rotation-track.ts documents');
    // ⚠️ **This clause was written BEFORE the one below and is the reason it exists.** Seeding GRID = 0.001
    // (2026-09-25) failed here and NOWHERE ELSE that mattered: the quantiser's `toFixed` carried a literal 2,
    // so the grid was written twice and the finer value never reached a user. The grep is the instrument that a
    // measurement cannot be, because every measurement here runs through the SAME quantiser.
    chk('...and its DECIMAL COUNT is derived from that grid rather than written a second time in the quantiser',
      /toFixed\(STATIC_FIELD_STRENGTH_DECIMALS\)/.test(SFSRC)
      && !/STATIC_FIELD_STRENGTH_GRID\)\s*\.?\s*toFixed\(\d/.test(SFSRC.replace(/\s*\n\s*/g, '')),
      'a literal toFixed(2) beside a named GRID is two owners of one quantity: the coarser of the pair wins '
      + 'silently, so a grid change reads as applied while the reachable set does not move. Derived, the seeded '
      + 'grid change now breaks the parity and authored round-trip clauses the way it should have');
  }
  chk('...and VALUES and LABELS are 1:1 over the stops, so no drag anywhere reads as inert',
    new Set(sVals).size === new Set(sVals.map((v) => v.toFixed(2))).size,
    `${new Set(sVals).size} values, ${new Set(sVals.map((v) => v.toFixed(2))).size} labels. They agree BY `
    + 'CONSTRUCTION here (a 0.01 grid printed at 2 decimals) — which is the reason the readout precision was left '
    + 'alone when the range moved, and the assertion that the two choices still match');
  {
    let run = 1, worst = 0, at = null;
    for (let i = 1; i < sVals.length; i++) {
      if (sVals[i] === sVals[i - 1]) run++;
      else { if (sVals[i - 1] !== 0 && run > worst) { worst = run; at = sVals[i - 1]; } run = 1; }
    }
    chk('...and the worst NON-ZERO dead run is inside the 60-stop house ceiling',
      worst <= 60,
      `${worst} stops at value ${at}. The bottom of a quartic is where the position grid outruns the value grid; a `
      + 'longer run than this would be a stretch of travel that visibly does nothing');
  }
  chk('...and value -> position -> value is EXACT at every stop, THROUGH the element\'s own position grid',
    sVals.every((v) => sTrip(v) === v),
    'this is the preset-load direction and the one that has to be exact: a pair that is not an inverse here means '
    + 'a load places the handle somewhere a drag never would, and the first touch then jumps the value');

  // -- the values the LIBRARY holds, and the ones the panel QUOTES -------------------------------------------
  {
    const authored = new Set();
    for (const name of mgrT.list()) {
      const p = mgrT.get(name);
      const tm = p?.postProcessors?.transMap;
      for (const L of chainFromOverlay(p.overlay, tm?.style ?? 0, tm?.ifsParams)) {
        if (!isSeparableStyle(L.style) || !L.staticField) continue;
        for (const k of ['strength', 'strength2']) {
          if (typeof L.staticField[k] === 'number') authored.add(L.staticField[k]);
        }
      }
    }
    const bad = [...authored].filter((v) => sTrip(v) !== v);
    chk('...and EVERY strength the composed library authors round-trips exactly through that grid',
      authored.size > 8 && bad.length === 0,
      `${authored.size} distinct authored values, ${bad.length} off the track: ${JSON.stringify(bad)}. ⚠️ An `
      + 'EMPTY authored set would be a false pass, so the size is asserted too. This is the half a curved track '
      + 'usually cannot have — CYCLES_TRACK manages 4 of 34 and COLOUR_DRIFT_TRACK 18 of 30 — and it holds here '
      + 'only because a 0.01 value grid is coarse enough to absorb the position snap');
  }
  chk('...and the PARITY point is reachable, which is the one value that must be exact',
    sReach.has(STATIC_FIELD_DEFAULTS.strength) && sTrip(STATIC_FIELD_DEFAULTS.strength) === STATIC_FIELD_DEFAULTS.strength,
    `default ${STATIC_FIELD_DEFAULTS.strength} -> ${sTrip(STATIC_FIELD_DEFAULTS.strength)} — fieldcheck section A `
    + 'asserts it reproduces an authored table byte-for-byte, so a track that could not land on it would put that '
    + 'parity out of reach by hand');
  chk('...and 1.00 (the ORIGINAL ceiling) is exact, while 2.00 (21.13\'s) lands one grid cell off — the measured price',
    sReach.has(1) && sTrip(1) === 1
    && !sReach.has(2) && Math.abs(sTrip(2) - 2) <= STATIC_FIELD_STRENGTH_GRID + 1e-9,
    `1 -> ${sTrip(1)}, 2 -> ${sTrip(2)}. ⚠️ **This clause asserts a known imperfection rather than a clean bill, `
    + 'and that is deliberate** — the first draft asserted 2.00 was exact and FAILED, because 2.00 is one of the '
    + '20 values above 1.47 the curve gave up. It is harmless for a reason that has to be stated rather than '
    + 'assumed: no preset in the composed library authors a strength above 1.0 (the clause above measures that), a '
    + 'resync writes the handle from the STORED value and never calls the setter, and the readout prints the value '
    + 'it is GIVEN — so a 2.00 in an imported preset still reads 2.00 and only a deliberate drag moves it. If this '
    + 'ever fails the other way (2.00 exact again) the curve or the grid changed: re-derive, do not delete');
  /*
   * -- REACHABILITY of the values the panel actually quotes -------------------------------------------------
   *
   * ⚠️ **This is the clause the widening was FOR, and it is a measurement of the library rather than of the
   * curve.** The identification line prints "matching it needs Strength N" for every body whose terms an
   * archetype reproduces; before 2026-09-25 eight of those N were beyond the track and the sentence had to say so.
   * The assertion is therefore in two halves that fail differently: every N is now inside the range, AND the
   * nearest value the track can actually reach is close enough to N that setting it reproduces the field.
   *
   * ⚠️ **The tolerance is DERIVED, not picked** (*CLAUDE.md*: never pick one that passes). Half a value grid cell
   * is the best any quantiser can do, and above 1.47 one notch exceeds one cell, so the bound is
   * `max(GRID/2, 2% of N)` — a relative term because the curve's notches grow with the value. Measured worst
   * ratio 0.92 of that bound, at `Material Ice`: tight enough that a coarser grid, a different exponent or a
   * larger MAX would all break it. **The 2% is the number to re-derive if this fails**, not the thing to raise.
   */
  {
    const { measureStaticField } = await import('../src/ui/synthesis-lab/field-measure.ts');
    const needs = [];
    for (const name of mgrT.list()) {
      const p = mgrT.get(name);
      const tm = p?.postProcessors?.transMap;
      if (!tm || !Array.isArray(tm.sinMagicParams) || tm.sinMagicParams.length !== 4) continue;
      const layer = chainFromOverlay(p.overlay, tm.style ?? 0, tm.ifsParams).find((L) => isSeparableStyle(L.style));
      if (!layer || layer.style === 3) continue;
      const id = identifyArchetype(tm.sinMagicParams);
      if (!id) continue;
      const t2 = tm.sinMagicParams2 ?? tm.sinMagicParams;
      const cur = measureStaticField(layer, tm.sinMagicParams, t2, 1920, 1080, 960, 540);
      const probe = { ...layer, staticField: { ...layer.staticField, pattern: id.archetype.name, detail: id.detail, strength: 1 } };
      const unit = measureStaticField(probe, tm.sinMagicParams, t2, 1920, 1080, 960, 540);
      if (!cur || !unit || !cur.peak || !unit.peak) continue;
      needs.push([name, cur.peak / unit.peak]);
    }
    const beyond = needs.filter(([, n]) => n > STATIC_FIELD_STRENGTH_MAX).map(([n]) => n);
    chk('...and every Strength the library NEEDS is now inside the range, which is what the widening bought',
      needs.length > 100 && beyond.length === 0,
      `${needs.length} measurable bodies, ${beyond.length} still beyond ${STATIC_FIELD_STRENGTH_MAX}: `
      + `${JSON.stringify(beyond)}. At the old ceiling of 2.0 this list had EIGHT names on it, Inside Athlon at `
      + '12.20 the worst. ⚠️ A non-empty list is not automatically a regression — a NEW archetype can relabel a '
      + 'body onto a shape that needs more — so read it as a claim about the archetype set first. ⚠️ This count '
      + 'is measured at 1920x1080 ALONE and is therefore ONE MORE than the 139 in STATIC_FIELD_STRENGTH_MAX\'s '
      + 'note, which is the intersection over five canvas shapes: two measurements wearing the same word, and '
      + 'the ceiling was chosen against the INTERSECTION because that is what has to be canvas-proof');
    let worstRatio = 0, worstMsg = '';
    for (const [name, n] of needs) {
      let d = Infinity;
      for (const v of sReach) if (Math.abs(v - n) < d) d = Math.abs(v - n);
      const ratio = d / Math.max(STATIC_FIELD_STRENGTH_GRID / 2, 0.02 * n);
      if (ratio > worstRatio) { worstRatio = ratio; worstMsg = `${name} needs ${n.toFixed(3)}, nearest off by ${d.toFixed(4)}`; }
    }
    chk('...and the nearest REACHABLE value is within half a grid cell or 2% of it, so the number is settable',
      worstRatio <= 1,
      `worst ${worstRatio.toFixed(2)} of the derived bound (${worstMsg}). A sentence naming a value the slider `
      + 'cannot reach is invariant 13 with the label replaced by a paragraph — and above 1.47 one notch exceeds '
      + 'one grid cell, so "on the grid" stopped being the right test when the track was curved');
  }

  // The prose prints `needed.toFixed(2)`; the track's VALUE grid is 0.01. Two independent choices, asserted equal
  // rather than assumed — and the bound above is what "settable" means once one notch can exceed one grid cell.
  chk('...and the identification line PRECISION equals the value grid, so the numbers it quotes read as settable',
    /needed\.toFixed\(2\)/.test(FM) && STATIC_FIELD_STRENGTH_GRID === 0.01
    && /min: -1, max: 1, step: STATIC_FIELD_STRENGTH_STEP/.test(TAB),
    'a sentence naming a value the slider cannot reach is invariant 13 with the label replaced by a paragraph');
  chk('...and the readout prints 2 decimals, so the handle and the sentence agree digit for digit',
    /fmt: v => v\.toFixed\(2\)/.test(TAB));
  chk('...and the quoted MAXIMUM is formatted adaptively, so a whole-number bound does not print two dead decimals',
    /max\.toFixed\(max % 1 === 0 \? 0 : 2\)/.test(FM),
    'the same idiom `detail` uses four lines above it. A hard toFixed(2) would print "±16.00" on the one figure in '
    + 'that sentence which is a LIMIT rather than a measurement');

  // ---- the Detail track, measured over the COMPOSED library ---------------------------------------------
  //
  // ⚠️ **The two halves of the track rule came out OPPOSITE here, and that is the finding.** `identifyArchetype`
  // derives `detail` as a continuous RATIO of frequencies, so it is precisely the class of value a bounded grid
  // can fail to represent — and the resolution half is spotless while the range half is not. A checker that
  // tested "the track is fine" as one property would have reported either a false pass or a false alarm.
  const hits = [];
  for (const name of mgrT.list()) {
    const p = mgrT.get(name);
    const tm = p?.postProcessors?.transMap;
    if (!tm) continue;
    const table = tm.sinMagicParams;
    if (!Array.isArray(table) || table.length !== 4) continue;
    if (!chainFromOverlay(p.overlay, tm.style ?? 0, tm.ifsParams).some((L) => isSeparableStyle(L.style))) continue;
    const id = identifyArchetype(table);
    if (id) hits.push([name, id.archetype.name, id.detail]);
  }
  chk('Detail: the library basis is non-trivial, so the two measurements below are not vacuous',
    hits.length > 50,
    `${hits.length} identifiable tables over ${mgrT.list().length} composed bodies. ⚠️ Do NOT reconcile this `
    + 'with the 63 in STATIC_FIELD_STRENGTH_MAX\'s note, nor with a legacy-JSON count: three bases, and '
    + 'CLAUDE.md forbids arithmetic across them. A grep or raw-JSON basis MISSES the settled refinements');
  const offGrid = hits.filter(([, , d]) => d >= STATIC_FIELD_DETAIL_MIN && d <= STATIC_FIELD_DETAIL_MAX
    && !onGrid(d, STATIC_FIELD_DETAIL_MIN, STATIC_FIELD_DETAIL_MAX, STATIC_FIELD_DETAIL_STEP));
  chk('...RESOLUTION: every in-range ratio the library produces lands exactly on the 0.05 grid',
    offGrid.length === 0,
    `off-grid: ${JSON.stringify(offGrid)}. The archetype frequencies are 1/4/6/8/16 and +-0.5 (2026-09-24), and `
    + 'the authored ones are integers or halves, so every ratio that occurs is a multiple of 0.05 — a NEW '
    + 'archetype with a frequency coprime to those would break this, and it would read as "the pattern looks '
    + 'slightly wrong", not as a track bug. ⚠️ The 2026-09-24 pair is the reason this enumeration is worth '
    + 'keeping current: 0.5 HALVES every ratio it wins, and it wins wherever the authored frequency is below '
    + '1/sqrt(2) — so it moved five bodies from 0.5 to 1.0, TOWARDS the grid, and a third the same way would not');
  // ⚠️ **Detail's range decision is UNCHANGED by Strength's reversal on 2026-09-25, and the two are not the same
  // question.** Strength was widened because a CURVE let the range grow without touching the resolution; the same
  // move would work here arithmetically, and it was not asked for. **Do not read the reversal as a precedent** —
  // and if it is ever re-opened, note that Detail's tail is THREE bodies whose terms already render correctly,
  // against Strength's eight that the dropdown could not reproduce at all.
  const outOfRange = hits.filter(([, , d]) => d < STATIC_FIELD_DETAIL_MIN || d > STATIC_FIELD_DETAIL_MAX)
    .map(([n, a, d]) => `${n} (${a}) ${d}`).sort();
  chk('...REACHABILITY: the ratios OUTSIDE the range are exactly the three known ones',
    outOfRange.length === 3
    && outOfRange.every((r) => /^(Lost In Another Sky|Lost In Another Sky II|Vertical Attraction) /.test(r)),
    `${JSON.stringify(outOfRange)}. ⚠️ **An EMPTY list is a FAILURE here, not a clean bill** — it would mean the `
    + 'warning below is prose nothing can reach. ⚠️ A WIDENED track is the other way this fails, and widening '
    + 'was considered and rejected: covering 12.5 costs 25x the resolution where the library actually sits');
  chk('...and the track reads the SHARED bounds, so the warning cannot drift from the slider',
    /min: STATIC_FIELD_DETAIL_MIN, max: STATIC_FIELD_DETAIL_MAX, step: STATIC_FIELD_DETAIL_STEP/.test(TAB),
    'a hand-typed 0.25/8 in the tab is how the sentence comes to name a range the control does not have');

  // ...and the sentence actually FIRES on them. Measured through the real function rather than grepped: the
  // clause is appended at FOUR return sites and a miss at one of them is invisible to a text scan.
  const { describeTermIdentity } = await import('../src/ui/synthesis-lab/field-measure.ts');
  const say = (name) => {
    const p = mgrT.get(name);
    const tm = p.postProcessors.transMap;
    const layer = chainFromOverlay(p.overlay, tm.style ?? 0, tm.ifsParams)
      .find((L) => isSeparableStyle(L.style));
    return describeTermIdentity(layer, tm.sinMagicParams, tm.sinMagicParams2 ?? tm.sinMagicParams,
      1920, 1080, 960, 540);
  };
  const WARN = /Detail slider only reaches/;
  const warned = outOfRange.map((r) => r.replace(/ \(.*$/, '')).filter((n) => WARN.test(say(n)));
  chk('...and describeTermIdentity WARNS on every one of them, at whichever return site it takes',
    outOfRange.length > 0 && warned.length === outOfRange.length,
    `warned on ${warned.length} of ${outOfRange.length}. The clause is appended at FOUR returns (style 3, the `
    + 'degenerate-peak early return, and both Strength branches) — one missed append is invisible to a grep '
    + 'and surfaces only as a preset whose warning never appears');
  const falsePos = hits.filter(([, , d]) => d >= STATIC_FIELD_DETAIL_MIN && d <= STATIC_FIELD_DETAIL_MAX)
    .filter(([n]) => WARN.test(say(n))).map(([n]) => n);
  chk('...and stays SILENT on the in-range ones, so the warning is a measurement and not decoration',
    falsePos.length === 0,
    `false positives: ${JSON.stringify(falsePos.slice(0, 6))} — a clause that always fires says nothing, and `
    + 'this is the half that fails if the bound comparison is ever written the wrong way round');

  /*
   * ---- the SIGN, measured end to end (2026-09-22) --------------------------------------------------------
   *
   * ⚠️ **This is the only instrument for the signed half, and it has to be a MEASUREMENT because the quantity
   * the panel shows is a magnitude.** `measureStaticField` returns a peak; a peak cannot be negative; so the
   * sign in the sentence comes from `identifyArchetype().scale` alone and a lost sign would be invisible in every
   * figure the tab prints — invariant 13's harder half, where the control moves the right thing and the output
   * channel cannot report the result. A grep for a minus sign would pass on code that computed it and dropped it.
   *
   * ⚠️ **The basis is four library bodies and an EMPTY list is a FAILURE**, exactly as for the Detail warning:
   * it would mean the inversion wording is prose nothing reaches. Measured against the pre-change copy in
   * `backup_20260922_transmap_confirmed/`: the widening GAINED three of them and RELABELLED nothing over
   * all 246 separable bodies, so an inverted match here is a new answer and never a moved one.
   *
   * ⚠️ **The FOURTH name, `Eternal Fire`, arrived on 2026-09-24 with the `Distant Lense` archetype, and it is a
   * GAIN and not a relabel — which is the distinction this clause exists to force.** Re-derived exactly as the
   * paragraph above instructs, by importing BOTH `static-field.ts` modules (live, and the pre-change copy in
   * `backup_20260924_phase22_confirmed/`) and diffing `identifyArchetype` over every composed body: 268
   * identifications unchanged, **1 gained** (`Eternal Fire`, previously matched by nothing, now `Distant Lense`
   * at `scale -1`), **5 relabelled** (`Flare`, `Quasar`, `Space The Final Frontier`, `Sphere`, `Sphere II`, all
   * `Coarse Swell × 0.5` → `Macrolense × 1`) and **0 lost**. ⚠️ **None of the five relabels belongs in THIS list:
   * every one keeps its POSITIVE scale, so the sign set grew by exactly the one body whose amplitudes are also
   * negative.** A future archetype could add to this list the other way — by relabelling a body that is already
   * here — and the count alone cannot tell the two apart: re-run the diff, never just widen the regex.
   */
  {
    const inverted = [], positive = [];
    for (const name of mgrT.list()) {
      const p = mgrT.get(name);
      const tm = p?.postProcessors?.transMap;
      if (!tm) continue;
      const table = tm.sinMagicParams;
      if (!Array.isArray(table) || table.length !== 4) continue;
      if (!chainFromOverlay(p.overlay, tm.style ?? 0, tm.ifsParams).some((L) => isSeparableStyle(L.style))) continue;
      const id = identifyArchetype(table);
      if (!id) continue;
      (id.scale < 0 ? inverted : positive).push(name);
    }
    const INV = /INVERTED/;
    chk('the SIGN: a negative shared scalar is reachable from the library at all, so the wording is not dead prose',
      inverted.length === 4
      && inverted.every((n) => /^(Eternal Fire|First Contact|Montezuma Looks at You|Rippled Rays Of Light)$/.test(n)),
      `${JSON.stringify(inverted)}. ⚠️ An EMPTY list fails: before 2026-09-22 identifyArchetype rejected scale < 0 `
      + 'outright, so this set IS the change. A LONGER one is not automatically wrong — read it as a claim about a '
      + 'new archetype or a settled preset, and re-derive from the backup copy rather than editing the names here');
    chk('...and describeTermIdentity SAYS so on every one of them, not only signs a number',
      inverted.length > 0 && inverted.every((n) => INV.test(say(n))),
      `${inverted.filter((n) => INV.test(say(n))).length} of ${inverted.length}. The clause is attached to the `
      + 'SHAPE half of the sentence deliberately, so it reaches the style-3 and degenerate-peak returns that quote '
      + 'no Strength at all — asserting it through the real function is what covers those two');
    chk('...and the quoted Strength is NEGATIVE there, which is the half no figure in the tab can show',
      inverted.every((n) => /matches it\)|needs Strength -/.test(say(n)) && /-\d+\.\d\d/.test(say(n))),
      `${JSON.stringify(inverted.map((n) => say(n).slice(-60)))} — a positive number under the word INVERTED is the `
      + 'failure to catch: it would tell the user to set a Strength that draws the mirror image of what they have');
    chk('...and stays SILENT on the positive matches, so the word is a measurement and not decoration',
      positive.length > 40 && !positive.some((n) => INV.test(say(n))),
      `${positive.filter((n) => INV.test(say(n))).length} false positives over ${positive.length} positive matches `
      + '— this is the half that fails if the sign comparison is ever written the wrong way round');
  }

  // ---- the Drift track, EXPORTED since 21.12 because its only consumer moved ----------------------------
  const D_STEP = 0.005;
  const dPos = stops(D_STEP);
  const sticky = dPos.filter((q) => DRIFT_TRACK.fromPos(q) === 0).length;
  /*
   * ⚠️ **TWO ROUND TRIPS WEAR THE SAME WORDS AND ONLY ONE OF THEM IS THE PROPERTY.** The first draft of this
   * clause tested position -> value -> position and FAILED on correct code — recorded because that is the
   * mistake, not a footnote to it:
   *
   *   - **value -> position -> value** is what a preset load does (stored value, handle placed, value kept) and
   *     it is the documented claim. **Exact, 0 error at every stop.**
   *   - **position -> value -> position** is what a DRAG does, and it cannot be exact: `fromPos` quantises to a
   *     0.001 value grid while the handle sits on a 0.005 position grid, and `dp/dv = 1/(2·sqrt(v))` diverges at
   *     the bottom — so one value step spans several position steps there. Measured: 6 non-sticky stops exceed
   *     half a gap, all inside the bottom 8 % of travel, worst 1.32 gaps at 0.001 cells/s. Sub-pixel on a
   *     300 px slider, and every value it touches is slower than one cell per 166 s.
   *
   * So the strict test goes on the first and a BOUNDED one on the second, with the bottom of travel exempted by
   * measurement rather than by taste. Asserting half a gap on the drag direction would have condemned a track
   * whose only sin is having a coarser value grid than position grid where nobody can see it.
   */
  chk('Drift: value -> position -> value is EXACT at every stop (the preset-load direction)',
    dPos.every((q) => DRIFT_TRACK.fromPos(DRIFT_TRACK.toPos(DRIFT_TRACK.fromPos(q))) === DRIFT_TRACK.fromPos(q)),
    `${dPos.length} stops, ${sticky} of them sticky. A pair that is not an inverse HERE means a preset load `
    + 'places the handle somewhere a drag never would, and the first touch then jumps the value');
  {
    const drag = dPos.filter((q) => q > 0.1 && DRIFT_TRACK.fromPos(q) !== 0);
    const worst = Math.max(...drag.map((q) => Math.abs(DRIFT_TRACK.toPos(DRIFT_TRACK.fromPos(q)) - q)));
    chk('...and position -> value -> position settles inside half a gap above the bottom tenth of travel',
      worst <= 0.5 * D_STEP + 1e-9,
      `worst ${(worst / D_STEP).toFixed(2)} gaps over ${drag.length} stops. ⚠️ The 0.1 floor is MEASURED, not `
      + 'chosen: below it the 0.001 value grid is coarser than the 0.005 position grid and the deviation is '
      + 'geometric, not a defect. A failure ABOVE it is real — it would mean the quantiser is losing a step '
      + 'where a drag can see it');
  }
  chk('...and the curve is monotone, so the handle never moves the value backwards',
    dPos.every((q, i) => i === 0 || DRIFT_TRACK.fromPos(q) >= DRIFT_TRACK.fromPos(dPos[i - 1])));
  chk('...and the documented midpoints still hold (the curve is what a rename cannot break)',
    DRIFT_TRACK.fromPos(0.5) === 0.25 && DRIFT_TRACK.fromPos(0.25) === 0.063,
    `50% -> ${DRIFT_TRACK.fromPos(0.5)} cells/s (one cell per 4 s), 25% -> ${DRIFT_TRACK.fromPos(0.25)}`);
  chk('...and the sticky zero is a SMALL bottom span, not a dead third of the travel',
    sticky >= 2 && sticky / dPos.length < 0.06,
    `${sticky} of ${dPos.length} positions (${(100 * sticky / dPos.length).toFixed(1)}%) quantise to 0 — kept `
    + 'deliberately, because 0 is the categorical "standing lattice" every shipped preset uses and the values '
    + 'it swallows are slower than one cell per 1000 s. A LARGE span would be the dead-zone defect instead');
  chk('...and the Transmap tab IMPORTS the curve rather than restating it',
    /DRIFT_TRACK\.toPos/.test(TAB) && /DRIFT_TRACK\.fromPos/.test(TAB)
    && !/Math\.sqrt\(Math\.max\(0, Math\.min\(1,/.test(TAB),
    'a differently-shaped row is visible, a drifted curve is not — the copy is the thing to prevent');
  chk('...and the readout names the UNIT, because drift genuinely IS cells per second (DRIFT_RATE = 2pi)',
    /cells\/s/.test(TAB),
    'the one quantity on that tab with a natural unit would otherwise wear none');

  /*
   * ---- the four ANGLE handles, v8 `35.4` — and THIS FILE is the instrument, not `slidercheck` -----------
   *
   * ⚠️⚠️ **`WAVE_ANGLE_MAX` HAD NO READER IN `src/` AT ALL UNTIL THESE ROWS EXISTED, AND NOTHING WOULD HAVE
   * REPORTED IT.** `interpolate.ts` and `types.ts` cite it in PROSE; `deadcheck` polices named DELETIONS, not
   * unused exports. That is `35.1`'s `WARP_SHAPES` situation in a second symbol, and the slider track is the
   * live reader — so the clauses below are also what keeps the constant connected to anything.
   *
   * ⚠️⚠️ **THE TRACK IS LINEAR AND IT STILL NEEDED MEASURING — IN A BROWSER, WHICH IS WHERE THE DEFECT WAS,
   * AND NOTHING IN THIS FILE COULD HAVE FOUND IT.** The first draft used `step = 1 / WAVE_ANGLE_MAX`, every
   * clause here was green, and **+90° was unreachable in Chromium**: dragged to the end of the travel the
   * readout said `89°`. **A form control's stepping is evaluated in base-10 `Decimal`, and the allowed
   * values are `min + k·step` that are ≤ max with NO clamping** — in exact decimal
   * `-1 + 180 × 0.011111111111111112` is `1.00000000000000016`, so `k = 180` is refused and the last stop is
   * `k = 179`. ⚠️⚠️ **In IEEE doubles that expression is exactly `1`, so the model below reported the track
   * as perfect.** That is *Verify*'s rule — **a measuring section's own basis has been the defect
   * repeatedly** — with the basis being the ARITHMETIC: `sanitize()` above does `Math.min(max, …)`, i.e. it
   * clamps where the element refuses, and it computes in doubles where the element computes in decimal.
   * ⚠️ **Every other track in this file has a decimal-exact step** (`0.001`, `0.005`, `0.01`) whose grid
   * closes on `max` in both arithmetics, which is why the shared helper has never been wrong before and is
   * left alone — but a NEW track must be checked in DECIMAL, which the first clause below now does.
   *
   * ⚠️ **The remedy is a step that is a negative POWER OF TWO**, exact in binary and in decimal alike, with
   * the exponent derived from `WAVE_ANGLE_MAX` so the increment stays at or under one degree per stop. The
   * grid is then FINER than the stored unit — 257 stops over 181 degrees — so the properties to measure
   * change shape: not "one stop per degree" but **every whole degree reachable, with a bounded dead run.**
   *
   * ⚠️ **0 must be exactly reachable because `waveAxisMap` BRANCHES on `angleDeg === 0`** (a rotation BY zero
   * is not the same thing, `cos(90°)` being `6.12e-17`), so a stop that printed `0°` over a rotated field
   * would lose `35.2`/`35.3`'s whole bit-identity contract to a slider.
   *
   * ⚠️ **CALIBRATED against five seeded defects, 2026-10-29, each applied to `src/`, measured and reverted
   * (`diff -q` verified) — and TWO of them got past a draft, which is why there are thirteen clauses:**
   *
   *   `step = 1 / WAVE_ANGLE_MAX` ........... **0 clauses in the FIRST draft, and it was a REAL DEFECT** —
   *                                           found by a browser, not here. Re-seeded against the rewritten
   *                                           block it now fires **4**, and the one that matters reports
   *                                           *top allowed k = 179 of 180, lands on max: false* and
   *                                           *endpoints -90 .. 89*. It is the only one of the thirteen
   *                                           that models the element's own arithmetic.
   *   `fromPos`' `Math.round` removed ....... 2 clauses (whole degrees; the readout round trip)
   *   the ZOOM pair deleted from `visual-fx.ts` alone .... **0 clauses in the first draft.** The factory,
   *                                           the import and all four `setRange` calls survive a deleted
   *                                           pair, so *"the file mentions the track"* sees a missing
   *                                           EDITOR and not a missing ROW. Hence the call-site count,
   *                                           which now fires alone — exactly the discrimination to keep.
   *   a VALUE bound (`-WAVE_ANGLE_MAX`) on the tracked row .. 2 clauses, both of them its own
   *   one resync `toPos` dropped ............ 1 clause, and only its own
   *
   * **Re-seed after any change to the pair or the step** — a quantiser or a grid change moves what every
   * measured clause below is measuring.
   *
   * ⚠️ **NOTHING CLAMPS A STORED ANGLE AND NO CLAUSE HERE MAY ASSERT ONE** — `35.D2` and `PHASE35-KEYS.md`
   * §9.1 forbid refusing a degenerate orientation, so `toPos` clamps the HANDLE only and an imported 120°
   * keeps rendering at 120° until the user drags. The range is what a control spans, not a validator.
   */
  {
    const { WAVE_ANGLE_MAX, WAVE_ANGLE_STEP, WAVE_ANGLE_TRACK, WAVE_QUARTER_TURN } =
      await import('../src/post-processors/static-field.ts');
    const A = WAVE_ANGLE_TRACK;
    const STOPS = Math.round(2 / WAVE_ANGLE_STEP);

    /*
     * ⚠️⚠️ **THE ELEMENT'S OWN GRID, IN EXACT DECIMAL AND WITH NO CLAMP — the model the shared `sanitize()`
     * is not.** `step` is read as the DECIMAL STRING the attribute carries (`String(step)`, which is what
     * `input.step = …` writes) and the arithmetic is `BigInt` over that scale, because that is what a form
     * control does. A stop is allowed only where `min + k·step ≤ max`; the element does not pull an
     * overshooting stop back to `max`, it refuses it, and the top of the travel becomes `k - 1`.
     */
    const decimalGrid = (minStr, maxStr, stepStr) => {
      const parse = (s) => {
        const neg = s.startsWith('-');
        const [i, f = ''] = (neg ? s.slice(1) : s).split('.');
        return { n: (neg ? -1n : 1n) * BigInt(i + f), scale: f.length };
      };
      const mn = parse(minStr), mx = parse(maxStr), st = parse(stepStr);
      const scale = Math.max(mn.scale, mx.scale, st.scale);
      const up = (p) => p.n * 10n ** BigInt(scale - p.scale);
      const [MN, MX, ST] = [up(mn), up(mx), up(st)];
      let k = 0n;
      while (MN + (k + 1n) * ST <= MX) k++;
      return { topK: Number(k), topHitsMax: MN + k * ST === MX, scale };
    };
    const grid = decimalGrid('-1', '1', String(WAVE_ANGLE_STEP));
    chk('Angle: the element\'s DECIMAL grid closes exactly on max, so +90 is reachable at all',
      grid.topK === STOPS && grid.topHitsMax,
      `top allowed k = ${grid.topK} of ${STOPS}, lands on max: ${grid.topHitsMax} (step string `
      + `"${String(WAVE_ANGLE_STEP)}", decimal scale ${grid.scale}). ⚠️⚠️ **MEASURED IN A BROWSER FIRST:** `
      + 'with step = 1/90 this read topK 179 and the slider\'s top was 89 degrees, while every '
      + 'double-precision clause below stayed green. A form control steps in base-10 Decimal and REFUSES an '
      + 'overshooting stop rather than clamping it — so a step that is not exact in DECIMAL silently '
      + 'shortens the travel at the far end only');
    chk('...and the step is a negative POWER OF TWO, derived from the range rather than written',
      Number.isInteger(1 / WAVE_ANGLE_STEP) && Number.isInteger(Math.log2(1 / WAVE_ANGLE_STEP))
      && 1 / WAVE_ANGLE_STEP === 2 ** Math.ceil(Math.log2(WAVE_ANGLE_MAX)) && WAVE_ANGLE_MAX === 90,
      `step ${WAVE_ANGLE_STEP} = 1/${1 / WAVE_ANGLE_STEP}, range +-${WAVE_ANGLE_MAX}. A power of two is `
      + 'exact in BOTH arithmetics, and deriving the exponent from the range is *Slider tracks*\' rule that '
      + 'widening a range must move 1/STEP with it — at +-180 the exponent would go to 8 on its own');

    // Every position the element can occupy, built on the DECIMAL grid above rather than through the shared
    // `sanitize()`, which clamps to max and computes in doubles.
    const aPos = [];
    for (let k = 0; k <= grid.topK; k++) aPos.push(-1 + k * WAVE_ANGLE_STEP);
    const aVals = aPos.map(A.fromPos);
    const aSet = new Set(aVals);
    const missing = [];
    for (let d = -WAVE_ANGLE_MAX; d <= WAVE_ANGLE_MAX; d++) if (!aSet.has(d)) missing.push(d);
    let run = 1, worstRun = 1;
    for (let i = 1; i < aVals.length; i++) {
      if (aVals[i] === aVals[i - 1]) { run++; worstRun = Math.max(worstRun, run); } else run = 1;
    }

    chk(`Angle: every value is a WHOLE DEGREE and every whole degree in range is reachable (${aPos.length} stops)`,
      aVals.every((v) => Number.isInteger(v)) && missing.length === 0
      && aSet.size === 2 * WAVE_ANGLE_MAX + 1,
      `${aSet.size} distinct values over ${aPos.length} stops, ${missing.length} unreachable degrees, `
      + `${aVals.filter((v) => !Number.isInteger(v)).length} non-integers. ⚠️ REACHABILITY and RESOLUTION `
      + 'are separate properties and the first passes green on a useless track — this clause is the '
      + 'reachability half, and the dead-run clause below is the other');
    chk('...and the worst dead run is 2 stops, far inside the 60-stop house ceiling',
      worstRun <= 4,
      `worst ${worstRun} consecutive stops mapping to one degree (increment `
      + `${(WAVE_ANGLE_MAX * WAVE_ANGLE_STEP).toFixed(6)} deg/stop). The grid is FINER than the stored unit `
      + 'by design, which is the price of a decimal-exact step: at 0.001 on the particle track 135 '
      + 'consecutive positions mapped to one value and a keyboard arrow appeared dead 135 times running');
    chk('...and BOTH ENDPOINTS and 0 are EXACTLY representable, which is what the identity arm requires',
      A.fromPos(-1) === -WAVE_ANGLE_MAX && A.fromPos(1) === WAVE_ANGLE_MAX
      && aVals[0] === -WAVE_ANGLE_MAX && aVals[aVals.length - 1] === WAVE_ANGLE_MAX
      && aSet.has(0) && Object.is(A.fromPos(0), 0)
      && Object.is(aVals[grid.topK / 2], 0),
      `endpoints ${aVals[0]} .. ${aVals[aVals.length - 1]}, mid stop -> ${aVals[grid.topK / 2]}. `
      + 'Object.is catches -0, which prints as 0 and compares equal but is a different stored number');
    chk('...and value -> position -> value is EXACT at every whole degree (the preset-load direction)',
      [...aSet].every((v) => A.fromPos(A.toPos(v)) === v),
      `${aSet.size} of ${aSet.size} expected. A pair that is not an inverse HERE means a preset load places `
      + 'the handle somewhere a drag never would, and the first touch then jumps the value');
    chk('...and the READOUT round-trips: the degrees printed are the degrees stored, digit for digit',
      aVals.every((v) => Number(`${Math.round(v)}`) === v)
      && (TAB.match(/\$\{Math\.round\(v\)\}°/g) ?? []).length === 1
      && /\$\{Math\.round\(v\)\}°/.test(VTAB),
      'the readout is `${Math.round(v)}°` in both tabs and fromPos already rounds, so the two cannot '
      + 'disagree by construction — asserted rather than argued, because a toFixed(1) here would print a '
      + 'tenth of a degree the track cannot store (an authored value a track cannot express is a defect)');
    chk('...and the curve is ODD, so the two halves of a SIGNED direction have equal reach',
      aPos.every((p) => A.fromPos(-p) === -A.fromPos(p)),
      'COLOUR_DRIFT_TRACK records what breaks this: Math.round on a signed value breaks ties toward +Inf. '
      + 'Here every stop is a whole degree so there are no ties — a failure would mean the grid moved');
    chk('...and a NON-FINITE value or position falls to 0 in BOTH directions of the pair',
      A.fromPos(NaN) === 0 && A.fromPos(undefined) === 0
      && A.toPos(NaN) === 0 && A.toPos(Infinity) === 0 && A.toPos(-Infinity) === 0,
      `fromPos(NaN) -> ${A.fromPos(NaN)}, toPos(Infinity) -> ${A.toPos(Infinity)}. ⚠️ **0 and not the end `
      + 'stop, which is `STATIC_FIELD_STRENGTH_TRACK`\'s own answer and AGREES WITH THE ENGINE**: '
      + '`waveAxisMap` is NaN-safe BY SHAPE and sends a non-finite angle down the IDENTITY arm, so the field '
      + 'really is the unrotated one and 0 is the honest handle position. Clamping Infinity to +-1 instead '
      + 'would park the handle at 90 degrees over a field rendering at 0 — the readout form of invariant 13');

    // -- source-shaped: FOUR handles in TWO tab files, which is the gap a one-file clause misses -----------
    //
    // ⚠️ `32.15`'s finding verbatim, and `35.4`'s whole shape: `visual-fx.ts` carries its own complete
    // static-field editor beside the Transmap tab's pane, so rows added to one editor only leave the four
    // angles unreachable from the other — with `tsc` green, because a row that does not exist type-checks.
    const angleRows = (src) => (src.match(/WAVE_ANGLE_TRACK/g) ?? []).length;
    chk('...and BOTH editors build the rows from the shared TRACK, naming no value bound at all',
      /WAVE_ANGLE_TRACK\.fromPos/.test(TAB) && /WAVE_ANGLE_TRACK\.toPos/.test(TAB)
      && /WAVE_ANGLE_TRACK\.fromPos/.test(VTAB) && /WAVE_ANGLE_TRACK\.toPos/.test(VTAB)
      && !/WAVE_ANGLE_MAX/.test(TAB + VTAB),
      `${angleRows(TAB)} references in transmap.ts, ${angleRows(VTAB)} in visual-fx.ts. ⚠️ A surviving `
      + '`max: WAVE_ANGLE_MAX` on a tracked row would be read as a POSITION of 90 and clamp the handle to a '
      + 'ninetieth of its travel — the trap the Strength row records, in a track whose range is 90x its '
      + 'position range');
    /*
     * ⚠️⚠️ **THE CALL SITES ARE COUNTED, AND THAT CLAUSE EXISTS BECAUSE A SEED GOT PAST THE ONE ABOVE.**
     * Deleting the ZOOM pair from `visual-fx.ts` alone (2026-10-29) left every clause green: the row factory
     * was still there, the track was still imported, and the four resync `setRange` calls were still written
     * — they query by marker class and a missing marker is not an error by design (style 0 has no centre
     * rows). **So "the file mentions the track" cannot see a missing PAIR**, only a missing editor. Two call
     * sites per file is the shift pair and the zoom pair, named so a future reader knows what the 2 is.
     */
    chk('...and each editor makes TWO calls to its row factory — the shift pair AND the zoom pair',
      (TAB.match(/this\.anglePairRow\(/g) ?? []).length === 2
      && (VTAB.match(/this\.staticAnglePair\(/g) ?? []).length === 2,
      `transmap.ts ${(TAB.match(/this\.anglePairRow\(/g) ?? []).length}, visual-fx.ts `
      + `${(VTAB.match(/this\.staticAnglePair\(/g) ?? []).length}; 2 each. ⚠️ The resync below cannot see `
      + 'this: it queries by MARKER CLASS and a missing marker is legitimately absent on styles that have '
      + 'no such row, so a deleted pair leaves four `setRange` calls quietly finding nothing');
    chk('...and both pass POSITIONS (+-1) and the element\'s step is the derived one, in both files',
      (TAB.match(/String\(WAVE_ANGLE_STEP\)/g) ?? []).length === 1
      && (VTAB.match(/String\(WAVE_ANGLE_STEP\)/g) ?? []).length === 1
      && /input\.min = String\(-1\)/.test(TAB) && /input\.min = '-1'/.test(VTAB),
      'one shared row factory per file, each covering BOTH cells of BOTH pairs — so four handles are two '
      + 'call sites and a divergence between the shift and zoom pairs is not expressible');
    chk('...and each editor resyncs all FOUR angles THROUGH toPos, which is the only direction a load takes',
      (VTAB.match(/WAVE_ANGLE_TRACK\.toPos\)/g) ?? []).length === 4
      && /for \(const sl of this\.sliders\)/.test(TAB),
      `${(VTAB.match(/WAVE_ANGLE_TRACK\.toPos\)/g) ?? []).length} of 4 resync calls in visual-fx.ts. The `
      + 'Transmap tab needs none: its row registers each cell in `this.sliders` with its own `toPos`, so '
      + '`sync()` repaints it with no per-control branch (16.17 — the closures ARE the enumeration)');
    chk('...and the quarter turn has ONE owner, read by the sampler AND by the notice predicate',
      WAVE_QUARTER_TURN === 90 && /quarterTurn \? WAVE_QUARTER_TURN : 0/.test(SFSRC)
      && /WAVE_QUARTER_TURN/.test(FM) && !/WAVE_ANGLE_MAX/.test(FM),
      'the Y wave\'s baked-in +90 and the range limit are TWO QUANTITIES WEARING ONE NUMBER. The parallel '
      + 'test asks about `angleY + the quarter turn`, so a second hand-typed 90 there would describe a '
      + 'geometry the sampler does not index — and widening the range to +-120 would re-aim it silently');

    // -- the AUTHORED set: every angle the library stores must be exactly settable --------------------------
    //
    // ⚠️ **The basis is the COMPOSED library** (`mgrT`), for *Refined legacy presets*' reason: a settled
    // refinement replaces its legacy key in place, so a grep or raw-JSON basis undercounts exactly the
    // bodies most recently touched. ⚠️ **An EMPTY set is not a pass** — it would mean the clause is vacuous,
    // which it was the day the rows were written (no shipped preset carried a non-zero angle), so the
    // sentinel says so rather than quoting a count that will move with the next demo.
    {
      const authored = new Set();
      for (const name of mgrT.list()) {
        const p = mgrT.get(name);
        const tm = p?.postProcessors?.transMap;
        if (!tm) continue;
        // ⚠️ `chainFromOverlay`, not `overlay.transMapChain` — the same resolver the Detail block above uses
        // and the one the engine uses. A direct read of the overlay key misses every layer the legacy
        // single-style path produces, which is most of the library.
        for (const L of chainFromOverlay(p.overlay, tm.style ?? 0, tm.ifsParams)) {
          const s = L?.staticField;
          if (!s) continue;
          for (const k of ['angleX', 'angleY', 'angleX2', 'angleY2']) {
            if (Number.isFinite(s[k])) authored.add(s[k]);
          }
        }
      }
      const off = [...authored].filter((v) => !aSet.has(v));
      chk(`Angle: every angle the library AUTHORS is exactly settable (${authored.size} distinct)`,
        off.length === 0,
        authored.size === 0
          ? '⚠️ VACUOUS TODAY: no shipped preset carries a non-zero angle, so this clause is a tripwire for '
            + 'the first one that does rather than a measurement. Read a future failure as a claim about the '
            + 'PRESET first — an authored 28.5 is unreachable on a 1-degree grid, which is the defect '
            + '*Slider tracks* names, and the answer is the preset or the step, never a wider readout'
          : `off-grid: ${JSON.stringify(off)} against 181 whole degrees from -90 to 90. An authored value the `
            + 'track cannot represent is a defect — and the symptom is that touching the slider silently '
            + 'moves the field, which no figure in the panel can show');
    }
  }
}

// ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------
console.log('\n=== N. the breathing RATE: geometric with a sticky zero, shared by four rows (v8 34.4) ===\n');
// ---------------------------------------------------------------------------------------------------
/*
 * ⚠️⚠️ **FOUR ROWS, ONE TRACK, AND THE TRACK IS THE ONLY `toPos`/`fromPos` PAIR IN `deform-limits.ts`** —
 * so a defect here is a defect in `Temper Rate`, `Stretch Rate`, `Sway Rate` and `Flare Rate` at once, and
 * the first three of those are triplets. That is the leverage and it is the risk together.
 *
 * ⚠️ **GEOMETRIC BECAUSE OF THE OCTAVE RULE: the span is 150x (7.2 octaves), so halving a period must cost
 * the same travel as doubling it.** A linear track over 0.4 … 60 would spend 99 % of its throw above 1 s.
 *
 * ⚠️ **STICKY ZERO BECAUSE `0` IS THE IDENTITY AND A PURE LOG MAP HAS NO ZERO AT ALL** (`ln 0 = -Inf`).
 * `modulatorSeconds` returns `null` at rate 0, which is the "never cycles" state. The precedent is §J's
 * `CYCLES_TRACK` and §K's `COLOUR_DRIFT_TRACK`, both of which quantise the bottom few per cent to exactly 0.
 */
{
  const oSan = (p) => sanitize(p, 0, 1, OP_RATE_STEP);
  const oStops = stops(OP_RATE_STEP);
  const oVals = oStops.map(OP_RATE_TRACK.fromPos);

  chk('the endpoints are exact: position 0 is rate 0 and position 1 is OP_RATE_MAX',
    OP_RATE_TRACK.fromPos(0) === 0 && OP_RATE_TRACK.fromPos(1) === OP_RATE_MAX,
    `0 -> ${OP_RATE_TRACK.fromPos(0)}, 1 -> ${OP_RATE_TRACK.fromPos(1)} (OP_RATE_MAX ${OP_RATE_MAX}). `
    + 'An endpoint that does not round-trip makes the documented range a lie');

  const sticky = oVals.filter((v) => v === 0).length;
  chk('...and the sticky zero is a SMALL bottom span, reachable but not a dead third of the travel',
    sticky >= 2 && sticky / oVals.length < 0.06,
    `${sticky} of ${oVals.length} positions (${(100 * sticky / oVals.length).toFixed(1)} %) quantise to `
    + `exactly 0, against an OP_RATE_ZERO_BAND of ${(OP_RATE_ZERO_BAND * 100).toFixed(0)} %. ⚠ A zero that `
    + 'needs more than one stop is deliberate (the identity must be aimable); a LARGE span would be the '
    + 'dead-run defect at the top of this file');

  chk('...and the first NON-ZERO stop is OP_RATE_MIN, never something below it',
    (() => {
      const firstLive = oVals.find((v) => v > 0);
      return firstLive !== undefined && Math.abs(firstLive - OP_RATE_MIN) < 1e-12;
    })(),
    `first non-zero stop ${oVals.find((v) => v > 0)} against OP_RATE_MIN ${OP_RATE_MIN}. ⚠ A stop BELOW the `
    + 'floor would be a rate the readout calls effectively static while the track still offers it, which is '
    + 'invariant 13 in miniature');

  chk('...and the track is MONOTONE, so the handle never moves the rate backwards',
    oVals.every((v, i) => i === 0 || v >= oVals[i - 1]),
    'a non-monotone curve means a drag that speeds the breathing up and then slows it down inside one gesture');

  /*
   * ⚠️ **THE OCTAVE RULE, MEASURED RATHER THAN ASSERTED: equal travel must buy equal RATIO.** Over the live
   * part of the track every adjacent pair of stops must have the same ratio to within float rounding. That
   * is what "geometric" means operationally, and a track that merely *looked* exponential would fail it.
   */
  const live = oVals.filter((v) => v > 0);
  const ratios = live.slice(1).map((v, i) => v / live[i]);
  const rLo = Math.min(...ratios), rHi = Math.max(...ratios);
  chk('...and equal travel buys equal RATIO — the octave rule, measured over every live stop',
    rHi / rLo - 1 < 1e-9,
    `adjacent-stop ratio spans ${rLo.toFixed(6)} .. ${rHi.toFixed(6)} over ${ratios.length} pairs `
    + `(${(Math.log2(OP_RATE_MAX / OP_RATE_MIN)).toFixed(1)} octaves). ⚠ A LINEAR track would span a factor `
    + 'of 150 here, which is the defect this clause exists to refuse');

  /*
   * ⚠️ **ROUND-TRIP THROUGH THE ELEMENT'S OWN GRID, not through the curve alone** — a track that is only
   * correct at unsanitised positions is not correct in a browser, which is this file's opening rule.
   */
  let worstRel = 0;
  for (const v of live) {
    const back = OP_RATE_TRACK.fromPos(oSan(OP_RATE_TRACK.toPos(v)));
    worstRel = Math.max(worstRel, Math.abs(back - v) / v);
  }
  chk('...and every live stop round-trips through the ELEMENT\'s position grid to itself',
    worstRel < 1e-9,
    `worst relative deviation ${worstRel.toExponential(2)} over ${live.length} stops. A value that does not `
    + 'round-trip puts the handle where a drag never would, and the first touch then jumps the rate');
  chk('...and a stored 0 puts the handle at the hard LEFT, where a drag can return to it',
    OP_RATE_TRACK.toPos(0) === 0 && OP_RATE_TRACK.fromPos(oSan(OP_RATE_TRACK.toPos(0))) === 0,
    'a centre-off control the user cannot return to its identity is a control with no off — and here the '
    + 'identity is `never cycles`, which is the state 314 of 314 presets are in today');

  /*
   * ⚠️ **AND THE READOUT MUST BE 1:1 OVER THE STOPS**, on the same grid the track quantises to: a coarser
   * label makes a drag read inert, which is §J's measured `toFixed(3)` failure in a second subject. The
   * readout is `periodPhrase(modulatorSeconds(rate, waveSpeed))`, so it is measured at the library's
   * reference `waveSpeed` of 0.05 — stated, because the number moves with the preset.
   */
  const { modulatorSeconds, periodPhrase } = await import('../src/ui/synthesis-lab/composer-model.ts');
  const labels = new Map();
  for (const v of live) {
    const sec = modulatorSeconds(v, 0.05);
    const l = sec === null ? 'Off' : periodPhrase({ seconds: sec, repeats: true });
    if (!labels.has(l)) labels.set(l, new Set());
    labels.get(l).add(v);
  }
  const collided = [...labels.values()].filter((set) => set.size > 1).length;
  chk('...and the readout distinguishes at least four fifths of the live stops at waveSpeed 0.05',
    labels.size >= live.length * 0.8,
    `${labels.size} distinct labels over ${live.length} live stops (${collided} label(s) shared by more than `
    + 'one stop). ⚠ The bound is four fifths rather than all of them because `periodPhrase` rounds to one '
    + 'decimal above 1 s and the track is 150x: at the slow end two adjacent stops genuinely round together, '
    + 'and tightening the ROUNDING would retitle two other tabs (both spellings are asserted by '
    + '`tests/04-preview-only-and-readouts.spec.ts`)');

  /*
   * ⚠️⚠️ **THE RANGE IS DERIVED FROM `modulatorSeconds` AND THE DERIVATION IS RE-RUN HERE RATHER THAN
   * QUOTED.** `OP_RATE_MAX` is *a 2-second cycle at the library's median `waveSpeed` of 0.05* and
   * `OP_RATE_MIN` *a 300-second one*. If either constant moves without its reason moving, this clause says so.
   */
  chk('the two bounds ARE the periods their headers claim, at the reference waveSpeed of 0.05',
    Math.abs(modulatorSeconds(OP_RATE_MAX, 0.05) - 2) < 1e-9
    && Math.abs(modulatorSeconds(OP_RATE_MIN, 0.05) - 300) < 1e-9,
    `OP_RATE_MAX ${OP_RATE_MAX} -> ${modulatorSeconds(OP_RATE_MAX, 0.05)} s, OP_RATE_MIN ${OP_RATE_MIN} -> `
    + `${modulatorSeconds(OP_RATE_MIN, 0.05)} s. ⚠ The reference waveSpeed is the library's MEDIAN and the `
    + 'figure travels with the number: p25 = median = p75 = 0.05 over 310 authored literals, which is what '
    + 'makes one reference honest rather than a pick');

  /*
   * ⚠️ **AND THE FOUR CALL SITES MUST DECLARE POSITIONS, which §G2 already asserts generically — this clause
   * names them, so a row that quietly stopped using the shared track would be visible as a COUNT.**
   */
  /*
   * ⚠️⚠️ **CALIBRATION, AND THE SEED IS THE DEFECT THIS SECTION ACTUALLY FOUND.** The track's first draft
   * anchored the geometric map at the zero band's TOP rather than one step above it, which made
   * `OP_RATE_MIN` — the slowest rate both headers and the readout describe — **unreachable by a drag**: the
   * first live stop landed at 0.4104. Re-run here so the reachability clause above cannot be weakened back
   * into a clause about the curve alone.
   */
  chk('CALIB: the PRE-FIX anchor made OP_RATE_MIN unreachable, and the clause above sees it',
    (() => {
      const preFix = (pos) => {
        if (pos <= OP_RATE_ZERO_BAND) return 0;
        const u = (pos - OP_RATE_ZERO_BAND) / (1 - OP_RATE_ZERO_BAND);
        return OP_RATE_MIN * Math.pow(OP_RATE_MAX / OP_RATE_MIN, Math.max(0, Math.min(1, u)));
      };
      const first = oStops.map(preFix).find((v) => v > 0);
      return first !== undefined && Math.abs(first - OP_RATE_MIN) > 1e-6;
    })(),
    'the pre-fix map gave a first live stop of 0.4104 against a documented floor of 0.4 — reachability and '
    + 'resolution are separate properties and the first one passes green on a useless track. A seed that '
    + 'failed to reproduce would mean the clause above is passing for a reason other than the fix');

  const rateSites = (vfx.match(/toPos: OP_RATE_TRACK\.toPos/g) ?? []).length;
  chk('all four breathing-rate rows read the SHARED track rather than restating the curve',
    rateSites === 4 && !/Math\.pow\(OP_RATE_MAX/.test(vfx),
    `${rateSites} call site(s) found; 4 expected (Temper Rate, Stretch Rate, Sway Rate, Flare Rate). ⚠ A `
    + 'restated curve is the copy this file exists to prevent: a differently-SHAPED row is visible, a '
    + 'drifted one is not');
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  trackcheck: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
