#!/usr/bin/env node
/**
 * composercheck — v8 16.1 (E92). The Composer's figure model must be LOSSLESS, and nothing else can see it.
 *
 * ⚠️ **WHY THIS CHECKER EXISTS AT ALL, stated as the failure it prevents.** A control set that drops or fuses
 * one of an `AxisWave`'s seven numbers is invisible to `tsc` (every field is a `number`), invisible to the
 * other twelve checkers (none reads `generators.waves`), **and invisible to a browser pass** — the figure
 * still renders, it is just no longer the figure that was authored. The user finds it when a preset they
 * saved comes back different. That is the most expensive place in this project to find anything, which is why
 * the phase ships this file BEFORE the tab and ships no UI with it.
 *
 * ⚠️ **THIS CHECKER MEASURES; IT DOES NOT GREP.** It imports the real model and the real library — the legacy
 * JSON through `MigrationLayer` plus all seven TS groups — and round-trips every wave slot in it. So a
 * behaviour-neutral rename cannot break it and a behaviour-changing edit cannot slip past it. It joins
 * `aestheticcheck`, `fieldcheck` and `trackcheck` as the fourth measuring checker; ⚠️ **do not "simplify" any
 * of the four into a text pattern.**
 *
 * ⚠️ **EVERY PROPERTY BELOW IS SEEDED, AND THE SEEDS ARE THE POINT.** `CLAUDE.md` records twelve occasions
 * where a measuring section's own basis was the defect — every time failing or passing on correct code — and
 * two where a `braceBody` anchor matched nothing and so asserted nothing forever. So each property here runs
 * twice: once on the real model (expect PASS) and once on a deliberately broken copy of the same logic
 * (expect FAIL). A property whose seed does not fail is reported as **CALIBRATION FAIL**, because an
 * assertion that cannot fail is worse than a missing one — it occupies the slot the real check would take.
 *
 * ⚠️ **AND THE SEEDS ARE THE DESIGNS THAT WERE ACTUALLY PROPOSED**, not invented strawmen:
 * `PSSS_UI_extension_ideas.md` §3.1b's fused `reach = am.base + am.amplitude`, its twist-only phase row, and
 * a writer that normalises `waves` to `MAX_WAVES`. Each was a real candidate; each is now a seed.
 *
 * ⚠️ **Property 2 IS NOT THE ONE THE PHASE PLAN SPECIFIED, and the correction was a measurement.** The plan
 * asked for "`waves.length` survives the round trip". Measured over the whole library, **`waves.length` is 3
 * for every single preset** — the raw legacy JSON authors three, and every TS group authors three — so that
 * assertion is trivially true and would have passed forever while asserting nothing. It is the
 * anchor-that-matched-nothing shape arriving through the data rather than through a regex. What actually
 * varies is which slots are LIVE (1, 2 or 3), so property 2 asserts the length claim against **synthesised**
 * short presets (which is where it can fail) and adds the claim that matters on real data: a silent slot
 * stays silent, and a live one stays live.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const M = await import('../src/ui/synthesis-lab/composer-model.ts');
// ⚠️ **`tierOf`, `simpleOf`, `applySimple`, `twistOf` and `repairFigure` ARE GONE (16.15) AND §E ASSERTS THEIR
// ABSENCE FROM `M` — so they must NOT be destructured here.** A destructured missing export is `undefined`, not
// an error, so this import would have kept "working" while every clause reading one silently no-op'd.
const {
  readFigure, writeFigure, applyStack, seedFigure,
  // v8 16.17 (E108) — the mute projection and the blank cell both `Clear` and the projection are built from.
  applyMutes, blankAxisCell, closesAt,
  ratioBase, applyRatio, RATIO_TILES, RATIO_NAMED, RATIO_ROWS, phaseForTarget, wrap360,
  modulatorSeconds, rateForSeconds, breathePercent, amplitudeForPercent, POS_PER_SECOND,
  MAX_WAVES, AXES, SLOT_LABELS, AXIS_LABELS, SEED_SIZE, SEED_WINDING, SEED_PARTICLE_COUNT, SEED_WAVE_SPEED,
} = M;

const { MigrationLayer } = await import('../src/presets/migration.ts');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

/**
 * ⚠️ **A SEEDED DEFECT MUST BE SHOWN TO FAIL, or the property it calibrates is decorative.** `seed` runs a
 * broken oracle over the same data and asserts it produces at least one violation. A seed that passes is a
 * CALIBRATION FAIL and exits non-zero exactly like a real failure — the checker is claiming it cannot see the
 * thing it was written to see.
 */
const seed = (n, violations, why) => {
  const ok = violations > 0;
  console.log(`  ${ok ? 'CALIB' : 'CALIBRATION FAIL'}  ${n} — seeded defect ${ok ? `caught (${violations} violations)` : 'NOT CAUGHT'}${ok ? '' : '   ' + why}`);
  ok ? pass++ : fail++;
};

// ---------------------------------------------------------------------------------------------------
// The library, collected by IMPORTING the modules. ⚠️ Never by grepping indentation, and never by arithmetic
// on a figure quoted in a document — `CLAUDE.md`'s preset-format row records the union moving in both
// directions for basis reasons alone. The BASIS here is stated with the figure the checker prints: every
// object reachable from the seven TS groups or the legacy JSON that carries `generators.waves`, deduped by
// nothing (a preset counted twice would only make the round trip stricter).
// ---------------------------------------------------------------------------------------------------
const rawJson = readFileSync(join(ROOT, 'public', 'psss_presets.json'), 'utf8');
// ⚠️ `public/psss_presets.json` is NOT plain JSON — it opens `g_psss_presets={`, so `JSON.parse` throws until
// the assignment prefix is sliced off and a trailing `;` stripped.
const LEGACY = JSON.parse(rawJson.slice(rawJson.indexOf('{')).replace(/;\s*$/, ''));

const presets = [];
for (const name of Object.keys(LEGACY)) presets.push([`legacy:${name}`, MigrationLayer.migrate(name, LEGACY[name])]);

for (const [mod, key] of [
  ['../src/presets/refined-presets.ts', 'REFINED_PRESETS'],
  ['../src/presets/demo-presets.ts', 'DEMO_PRESETS'],
  ['../src/presets/fire-presets.ts', 'FIRE_PRESETS'],
  ['../src/presets/flow-presets.ts', 'FLOW_PRESETS'],
  ['../src/presets/showcase-presets.ts', 'SHOWCASE_PRESETS'],
  ['../src/presets/variant-presets.ts', 'VARIANT_PRESETS'],
  ['../src/presets/chain-presets.ts', 'CHAIN_PRESETS'],
]) {
  const group = (await import(mod))[key];
  // ⚠️ `variant-presets.ts` NESTS its preset under a `.preset` key while the other six do not, so a naive
  // walk scores that group 0. `MATERIAL_PRESETS` taught the same lesson from the other direction (it is an
  // ARRAY, not a keyed object) — hence both shapes are handled here rather than assumed.
  for (const entry of (Array.isArray(group) ? group : Object.values(group))) {
    const p = entry?.preset ?? entry;
    if (p?.generators?.waves) presets.push([`${key}:${p.metadata?.name ?? '?'}`, p]);
  }
}

const slots = [];
for (const [name, p] of presets) {
  (p.generators.waves ?? []).forEach((w, i) => slots.push({ name, i, wave: w }));
}
const isLive = w => w.axes.some(a => (a.am.base ?? 0) + (a.am.amplitude ?? 0) !== 0);
const liveSlots = slots.filter(s => isLive(s.wave));

console.log(`\ncomposercheck — basis: ${presets.length} preset objects carrying generators.waves `
  + `(legacy JSON via MigrationLayer + 7 TS groups), ${slots.length} wave slots, ${liveSlots.length} live\n`);

const clone = o => structuredClone(o);
/** Deep field-by-field equality over an `AxisWave`, so a comparison cannot pass on key order or on NaN. */
const axisEq = (a, b) =>
  a.phase === b.phase
  && a.am.base === b.am.base && a.am.amplitude === b.am.amplitude && a.am.frequency === b.am.frequency
  && a.fm.base === b.fm.base && a.fm.amplitude === b.fm.amplitude && a.fm.frequency === b.fm.frequency;
const waveEq = (a, b) => a.axes.every((ax, i) => axisEq(ax, b.axes[i]));

// ===================================================================================================
console.log('§A — property 1: the round trip is an IDENTITY on every wave slot in the library');
// ===================================================================================================
// ⚠️ This is the property the whole step exists for. `readFigure` → `writeFigure` with no edit in between
// must return a byte-for-byte equal `generators.waves`. It is asserted per FIELD (`axisEq`), not by
// JSON.stringify: a stringify comparison would pass on a model that silently reordered or coerced, and
// `-0 === 0` is exactly the kind of difference that reaches the screen as nothing and reaches a diff as noise.
let rtBad = 0, rtFirst = '';
for (const [name, p] of presets) {
  const before = clone(p.generators.waves);
  const copy = clone(p);
  writeFigure(copy, readFigure(copy));
  const after = copy.generators.waves;
  const same = after.length === before.length && before.every((w, i) => waveEq(w, after[i]));
  if (!same) { rtBad++; if (!rtFirst) rtFirst = name; }
}
chk(`readFigure → writeFigure is an identity on all ${presets.length} presets`, rtBad === 0,
  rtBad ? `${rtBad} presets differ, first ${rtFirst}` : '');

// ⚠️ **THE SEED IS §3.1b's OWN PROPOSAL: fuse `am.base` and `am.amplitude` into one `reach` control.** It
// looks harmless — the sum is what the eye sees at the peak — and it is lossy the moment BOTH are nonzero,
// because two numbers cannot come back out of one. Reconstructing as `reach/2` each is the charitable
// version and it still corrupts every such slot. The count printed here IS the measurement that killed the
// design; do not quote it from prose, it is re-derived on every run.
let fusedBad = 0;
for (const s of liveSlots) {
  for (const ax of s.wave.axes) {
    const reach = (ax.am.base ?? 0) + (ax.am.amplitude ?? 0);
    const back = { base: reach / 2, amplitude: reach / 2 };
    if (back.base !== (ax.am.base ?? 0) || back.amplitude !== (ax.am.amplitude ?? 0)) fusedBad++;
  }
}
seed('fused `reach = am.base + am.amplitude` (§3.1b)', fusedBad,
  'if a fused amplitude round-trips, the identity assertion above is not testing amplitude at all');

// ⚠️ A second, narrower seed: a writer that keeps the seven fields but drops `am.frequency`. This is the
// shape a hand-written setter produces when it is written from the PRESET spelling — `amplitude`/`frequency`
// against the internal `amp`/`freq` — and `CLAUDE.md` records that exact trap as silent because both types
// are plain `number`s. It must be caught by field, not by shape.
let dropFreqBad = 0;
for (const s of slots) for (const ax of s.wave.axes) if ((ax.am.frequency ?? 0) !== 0) dropFreqBad++;
seed('a writer that drops `am.frequency` (the amp/amplitude spelling trap)', dropFreqBad,
  'no library slot carries an am.frequency — then the identity check cannot see that field');

// ===================================================================================================
console.log('\n§B — property 2: slot COUNT and slot LIVENESS both survive');
// ===================================================================================================
// ⚠️ **`waves.length` IS 3 FOR EVERY PRESET IN THE LIBRARY — measured, not assumed — so asserting it on real
// data asserts nothing.** The plan's version of this property would have passed forever. The claim is
// therefore split in two: the length claim is tested against SYNTHESISED one- and two-slot presets (the only
// place it can fail), and the claim with teeth on real data is that liveness is preserved.
const lenHist = {};
for (const [, p] of presets) { const n = p.generators.waves.length; lenHist[n] = (lenHist[n] ?? 0) + 1; }
console.log(`         measured waves.length histogram over the library: ${JSON.stringify(lenHist)}`);
chk('the library authors exactly MAX_WAVES slots everywhere (so the length claim needs synthetic data)',
  Object.keys(lenHist).length === 1 && Number(Object.keys(lenHist)[0]) === MAX_WAVES,
  'if this ever moves, property 2 gains real-data teeth and this note is stale');

// ⚠️ **THE PAD-TO-THREE DEFECT, tested on the only data that can expose it.** `lissajous.ts` pads its
// internal table to `MAX_WAVES` because `update()` loops unconditionally — a fact `buildWaveTable` documents
// — and a writer that echoed that pad back into the preset would silently give every short preset three
// slots. Nothing in the shipped library is short, so this is a property no browser pass and no real preset
// could ever exercise. It is asserted here because the day someone authors a one-wave preset by hand is the
// day it would start corrupting them.
const short = [1, 2].map(n => {
  const base = clone(presets.find(([, p]) => p.generators.waves.length === MAX_WAVES)[1]);
  base.generators.waves = base.generators.waves.slice(0, n);
  return [n, base];
});
let padBad = 0;
for (const [n, p] of short) {
  writeFigure(p, readFigure(p));
  if (p.generators.waves.length !== n) padBad++;
}
chk('a 1-slot and a 2-slot preset keep their slot count (no pad to MAX_WAVES)', padBad === 0,
  padBad ? `${padBad} of 2 synthesised short presets were padded` : '');

// The seed: the writer as it would look if it emitted MAX_WAVES unconditionally.
let padSeedBad = 0;
for (const [n] of short) if (MAX_WAVES !== n) padSeedBad++;
seed('a writer emitting MAX_WAVES unconditionally', padSeedBad,
  'if MAX_WAVES equalled the short lengths the pad defect would be unobservable here');

// Liveness — the real-data half. ⚠️ Silence is `size + pulse === 0` and NEVER `winding === 0`: 162 audible
// slots in the library wind entirely through `wobble` with `fm.base` 0 on all three axes (`Pipes`' first wave
// is the witness), so a model that read silence off the winding would mislabel the liveliest rows there are.
let liveBad = 0;
for (const [name, p] of presets) {
  const copy = clone(p);
  const model = readFigure(copy);
  for (let w = 0; w < copy.generators.waves.length; w++) {
    if (model.slots[w].silent === isLive(copy.generators.waves[w])) liveBad++;
  }
}
chk('every slot\'s `silent` flag agrees with `size + pulse === 0` on real data', liveBad === 0,
  liveBad ? `${liveBad} slots disagree` : '');

let windSeedBad = 0;
for (const s of liveSlots) if (s.wave.axes.every(a => (a.fm.base ?? 0) === 0)) windSeedBad++;
seed('silence read off `winding === 0` instead of the amplitude', windSeedBad,
  'no audible slot has an all-zero winding — then the silence rule cannot be distinguished from the winding');

// ===================================================================================================
console.log('\n§C — property 3: every authored value is REPRESENTABLE by the controls that will edit it');
// ===================================================================================================
// ⚠️ **AN AUTHORED VALUE A CONTROL CANNOT REACH IS A DEFECT** — the slider-track rule, applied to a stepper.
// The maxima are re-measured here rather than hardcoded from a document, because `CLAUDE.md`'s first rule
// about figures is that arithmetic on a quoted one is how they drift.
let maxWinding = 0, maxSize = 0, maxPulse = 0, maxWobble = 0, maxRate = 0, maxPhase = 0;
const nonIntWinding = new Set();
for (const s of slots) for (const a of s.wave.axes) {
  maxWinding = Math.max(maxWinding, Math.abs(a.fm.base ?? 0));
  maxSize = Math.max(maxSize, Math.abs(a.am.base ?? 0));
  maxPulse = Math.max(maxPulse, Math.abs(a.am.amplitude ?? 0));
  maxWobble = Math.max(maxWobble, Math.abs(a.fm.amplitude ?? 0));
  maxRate = Math.max(maxRate, Math.abs(a.am.frequency ?? 0), Math.abs(a.fm.frequency ?? 0));
  maxPhase = Math.max(maxPhase, Math.abs(a.phase ?? 0));
  if (!Number.isInteger(a.fm.base ?? 0)) nonIntWinding.add(a.fm.base);
}
console.log(`         measured maxima: |winding| ${maxWinding}  |size| ${maxSize}  |pulse| ${maxPulse}  `
  + `|wobble| ${maxWobble}  |rate| ${maxRate}  |phase| ${maxPhase}`);
console.log(`         non-integer windings in the whole library: ${[...nonIntWinding].sort((a, b) => a - b).join(', ') || '(none)'}`);

// ⚠️ **THE WINDING CONTROL IS AN INTEGER STEPPER AND NOT A SLIDER, and that is forced by this distribution,
// not chosen for taste.** The authored values run from a fraction to five figures across a few dozen distinct
// numbers, so no linear range has usable resolution at the bottom and no log range lands on integers. ⚠️
// `trackcheck` will not vet a stepper — it walks `SliderSpec` stops — so the representability claim for this
// control has no other owner and must live here.
/*
 * ⚠️ **RE-BASED 2026-10-07: THE `< 5` CEILING WAS A BASIS, NOT A PROPERTY, AND IT WENT STALE THE MOMENT THREE
 * PRESETS WERE ADDED.** The argument this clause carries — a stepper rather than a slider — rests on the
 * SPREAD (no linear range resolves the small end, no log range lands on integers) and on non-integers
 * existing at all. **It does not rest on how MANY there are**, so an upper bound could only ever fail on a
 * library change it has no opinion about. The count is printed instead, which is what a reader needs.
 */
chk('the winding distribution defeats a slider range (so a stepper is the only honest control)',
  maxWinding >= 1000 && nonIntWinding.size > 0,
  `spread 0…${maxWinding} with ${nonIntWinding.size} non-integer values — a log track cannot hit integers, `
  + 'a linear one cannot resolve the small end');

// ⚠️ **THE NON-INTEGER WINDINGS ARE THE `closes` BADGE'S ONLY REAL WITNESSES.** Every other slot in the
// library closes, so if `closes` were hardcoded `true` this is the only data that would notice.
let closesBad = 0, openSeen = 0;
for (const s of slots) {
  const cells = readFigure({ generators: { waves: [s.wave], particleCount: 0 } }).slots[0].axes;
  for (let a = 0; a < AXES; a++) {
    const expect = Number.isInteger(s.wave.axes[a].fm.base ?? 0);
    if (cells[a].closes !== expect) closesBad++;
    if (!expect) openSeen++;
  }
}
chk('`closes` matches integrality on every axis, including the open ones', closesBad === 0 && openSeen > 0,
  `${closesBad} mismatches over ${slots.length * AXES} axes, ${openSeen} genuinely open`);
seed('`closes` hardcoded true', openSeen,
  'with no open winding in the library, a hardcoded `closes` would be indistinguishable from the real one');

// ===================================================================================================
console.log('\n§D — property 4: the DERIVED readouts are the engine\'s own arithmetic, not a plausible guess');
// ===================================================================================================
// ⚠️ **`phase` IS MULTIPLIED BY THE WINDING NUMBER.** `lissajous.ts`'s inner line is `sin((n + phase) · fm) ·
// am` — **not** `sin(n · fm + phase)` — so the shift the engine applies is `phase × winding mod 360`. This is
// asserted against a literal re-implementation of the engine's expression rather than against the model's own
// helper, because a checker that calls the code it is checking asserts only self-consistency.
const DEG = 180 / Math.PI;
let phBad = 0, phDiffers = 0, phCancelled = 0;
for (const s of slots) {
  const cells = readFigure({ generators: { waves: [s.wave], particleCount: 0 } }).slots[0].axes;
  for (let a = 0; a < AXES; a++) {
    const ph = s.wave.axes[a].phase ?? 0, fm = s.wave.axes[a].fm.base ?? 0;
    const want = ((ph * fm) % 360 + 360) % 360;
    if (Math.abs(cells[a].effectivePhase - want) > 1e-9) phBad++;
    if (ph !== 0 && Math.abs(want - ((ph % 360) + 360) % 360) > 1e-9) phDiffers++;
    if (ph !== 0 && Math.abs(want) < 1e-9) phCancelled++;
  }
}
chk('`effectivePhase` === `phase × winding mod 360` on every axis', phBad === 0, `${phBad} mismatches`);
console.log(`         ${phDiffers} axes where the effective shift DIFFERS from the authored degrees; `
  + `${phCancelled} where the engine cancels a nonzero phase to exactly 0°`);

// ⚠️ **THE SEED IS THE DEFECT THAT IS IN THE SHIPPED CODE RIGHT NOW.** `Sliders`' `Symmetry` treats the phase
// as an absolute shift (`slider-mappings.ts`), which is wrong at every winding but 1. It is out of scope by
// instruction — but seeding it here means the Composer cannot quietly inherit it, and the count below is the
// measurement of how wrong it is.
seed('`effectivePhase` computed as an ABSOLUTE shift (the live `Sliders` Symmetry defect)', phDiffers,
  'if the two agreed everywhere, the winding multiplication would be unobservable and this readout pointless');
chk('...and the cancelled-to-zero axes exist, so the readout tells the user something nothing else can',
  phCancelled > 0, `${phCancelled} axes where a nonzero authored phase produces no shift at all`);

// The `windingMultiple` readout: a slot's winding relative to the Body slot's. Asserted on the presets where
// it is defined, and asserted to be ABSENT (null) rather than 0 or NaN where the Body slot has no winding —
// a NaN in a readout reaches the screen as "NaN" and reads as a crash.
let multBad = 0, multDefined = 0;
for (const [, p] of presets) {
  const model = readFigure(clone(p));
  const bodyW = Math.max(...p.generators.waves[0].axes.map(a => Math.abs(a.fm.base ?? 0)));
  for (let w = 0; w < MAX_WAVES; w++) {
    const own = Math.max(...(p.generators.waves[w]?.axes ?? []).map(a => Math.abs(a.fm.base ?? 0)), 0);
    const got = model.slots[w].windingMultiple;
    if (bodyW > 0 && own > 0) {
      multDefined++;
      if (!Number.isFinite(got) || Math.abs(got - own / bodyW) > 1e-9) multBad++;
    } else if (got !== null) multBad++;
  }
}
chk('`windingMultiple` is the Body-relative ratio, and NULL rather than NaN where undefined', multBad === 0,
  `${multBad} bad of ${multDefined} defined`);

// ===================================================================================================
console.log('\n§E — property 5: ONE CONTROL SET, and no PROJECTION between a control and its stored field');
// ===================================================================================================
/*
 * ⚠️ **§E IS REWRITTEN FOR 16.15 (E106) AND ITS OLD SUBJECT NO LONGER EXISTS — RETIRED WITH ITS REASON HERE,
 * NEVER SILENTLY RE-POINTED.** It used to prove the SIMPLE tier's eight controls could rebuild a slot exactly,
 * that a `full` slot carried a stated reason it could not be demoted, and that the strict modulator clause was
 * not equivalent to the effective one. All three were true and all three are now **unfalsifiable**, because
 * `tierOf`, `simpleOf` and `applySimple` are deleted: **a dead assertion is one nobody can fail**, which is
 * worse than a missing one — it occupies the slot the real check would take. What replaces them is the property
 * the deletion BOUGHT, which the old section could not state: **there is no projection at all.**
 *
 * ⚠️ **THE TOTAL THIS FILE PRINTS MAY FALL, AND A FALLING TOTAL IS NOT LOST COVERAGE HERE.** The old clauses
 * measured a mechanism; the mechanism is gone. **Never read a checker's total as a coverage figure across a
 * deletion — re-run it and read the SECTIONS.**
 *
 * ⚠️ **WHAT THE OLD SECTION MEASURED, KEPT BECAUSE THE MEASUREMENTS ARE NOT RE-DERIVABLE FROM THE CODE THAT
 * REMAINS:** §3.1b's twist-only phase row was lossy on most live slots (an offset alone cannot express an
 * absolute X shift); a shared cross-axis size clause collapsed the tier's coverage to single digits; and a
 * handful of live slots carry a nonzero modulator RATE against a zero amplitude, so an "effective" clause
 * would have dropped an unread rate. The first two are preserved as SEEDS below, because both are projections
 * and the projection class is exactly what this section now owns.
 */

/*
 * ⚠️ **THE ENUMERATION FIRST: `RAW` IS THE THIRD COPY OF ONE LIST AND THAT IS WHY IT IS ASSERTED AND NOT
 * TRUSTED.** `AxisCell`'s stored fields, `writeAxis`'s mapping and the tab's seven rows are three enumerations
 * of one set — `CLAUDE.md`'s *three enumerations of one list make a missing entry structurally invisible*. An
 * eighth stored field added to the model with no row would be invisible to `tsc` (nothing indexes the set) and
 * to every clause below (they iterate `RAW`), so the set is pinned against the model's OWN cell shape here.
 */
const RAW = ['winding', 'size', 'pulse', 'pulseRate', 'wobble', 'wobbleRate', 'phase'];
const DERIVED = ['closes', 'effectivePhase', 'silent'];
const sampleCell = readFigure({ generators: { waves: [slots[0].wave], particleCount: 0 } }).slots[0].axes[0];
const cellKeys = Object.keys(sampleCell);
chk('`AxisCell` holds exactly the seven stored fields plus three derived readouts — the set the tab must cover',
  cellKeys.length === RAW.length + DERIVED.length
  && RAW.every(f => cellKeys.includes(f)) && DERIVED.every(f => cellKeys.includes(f)),
  `${cellKeys.length} keys: ${cellKeys.join(', ')}`);
seed('an eighth stored field added to the model with no control and no entry in this list',
  Object.keys({ ...sampleCell, skew: 0 }).length === RAW.length + DERIVED.length ? 0 : 1,
  'if the key count were not pinned, a new stored field would join `AxisWave` with nothing asserting it is editable');

/*
 * ⚠️ **THE PROPERTY THE DELETION BOUGHT: EDITING ONE FIELD CHANGES ONE FIELD.** This is what a projection
 * cannot promise and what 21 direct inputs give for free — so it is asserted over every axis of every slot in
 * the library, one field at a time, through the real `readFigure`/`writeFigure` pair. **`applySimple` failed
 * this by construction** (it wrote all four modulator fields to 0 on all three axes whatever it was asked to
 * change), which is why §J measured a five-figure data-loss exposure: the loss was never a bug in the
 * projection, it was the projection.
 *
 * ⚠️ **THE SENTINEL IS `+ 7.25` AND THE FRACTION IS DELIBERATE — it makes this clause carry 16.13's
 * no-rounding property as well.** A writer that snapped a winding would come back `+7`, not `+7.25`, and fail
 * here rather than in §M alone. **Do not "tidy" the sentinel to an integer.**
 */
const rawCells = (wave) => readFigure({ generators: { waves: [wave], particleCount: 0 } }).slots[0].axes;
let editBad = 0, editCount = 0, editFirst = '';
for (const s of slots) {
  const src0 = rawCells(s.wave);
  for (let a = 0; a < AXES; a++) {
    for (const f of RAW) {
      const p = { generators: { waves: [clone(s.wave)], particleCount: 0, waveSpeed: 0.05 } };
      const m = readFigure(p);
      const want = m.slots[0].axes[a][f] + 7.25;
      m.slots[0].axes[a][f] = want;
      writeFigure(p, m);
      const got = rawCells(p.generators.waves[0]);
      editCount++;
      // The edited field must land EXACTLY, and every other raw field on every other axis must be untouched.
      const ok = got[a][f] === want && [0, 1, 2].every(b => RAW.every(g =>
        (b === a && g === f) || got[b][g] === src0[b][g]));
      if (!ok) { editBad++; if (!editFirst) editFirst = `${s.name}[${s.i}] ${AXIS_LABELS[a]}.${f}`; }
    }
  }
}
chk('a one-field edit writes exactly that field — no projection, no collateral zeroing', editBad === 0,
  editBad ? `${editBad} of ${editCount} single-field edits leaked, first ${editFirst}`
    : `${editCount} single-field edits over ${slots.length} slots x ${AXES} axes x ${RAW.length} fields`);

/*
 * ⚠️ **SEED ONE: THE DELETED `applySimple`, RE-IMPLEMENTED HERE AS THE WRITER IT USED TO BE.** This is the
 * shipped predecessor rather than a strawman, which is what `CLAUDE.md` asks of a seed: it wrote
 * `pulse`/`pulseRate`/`wobble`/`wobbleRate` to 0 on all three axes and derived Y's phase from X's. If it
 * produced no violations the clause above would be measuring nothing, because the library would carry no
 * modulator for a projection to lose.
 */
const projectSimple = (cells) => {
  const phaseX = cells[0].phase, twistDelta = cells[1].phase - cells[0].phase;
  const zFollows = cells[2].phase === cells[0].phase;
  return cells.map((c, a) => ({
    ...c,
    pulse: 0, pulseRate: 0, wobble: 0, wobbleRate: 0,
    phase: a === 0 ? phaseX : a === 1 ? phaseX + twistDelta : (zFollows ? phaseX : 0),
  }));
};
let projBad = 0;
for (const s of slots) {
  const before = rawCells(s.wave);
  const after = projectSimple(before);
  for (let a = 0; a < AXES; a++) for (const f of RAW) if (after[a][f] !== before[a][f]) projBad++;
}
seed('the deleted `applySimple` projection as the writer (16.15\'s own predecessor)', projBad,
  'if no library slot carried a modulator or an independent Z phase, the projection would have been lossless '
  + 'and its deletion would buy nothing');

/*
 * ⚠️ **SEED TWO: §3.1b's TWIST-ONLY PHASE ROW, KEPT AS AN INDEPENDENT PROJECTION SHAPE.** It loses no
 * modulator at all — only the absolute X phase — so a section seeded ONLY with `applySimple` would not
 * distinguish a writer that fixed the modulators and kept a derived phase. **A clause that can only fail when
 * a sibling seed already has reports on nothing**; two projections, two seeds.
 */
let twistOnlyBad = 0;
for (const s of liveSlots) if ((s.wave.axes[0].phase ?? 0) !== 0) twistOnlyBad++;
seed('a twist-only phase row with no absolute `phase X` (§3.1b) — a projection that loses no modulator',
  twistOnlyBad,
  'if no live slot had a nonzero X phase, a delta-only row would be lossless and the absolute control redundant');

/*
 * ⚠️ **AND THE RETIRED SYMBOLS MUST BE *GONE*, NOT RENAMED — no measured clause above can see a surviving
 * second surface.** A projection still exported is a projection a future call site can reach, and the whole
 * argument for 16.15 is that the data-loss class is now UNREACHABLE rather than guarded. Asserted against the
 * model's real export table (imported, not grepped) so a rename cannot satisfy it.
 */
const retiredExports = ['tierOf', 'twistOf', 'simpleOf', 'applySimple', 'repairFigure'];
const absent = (table) => retiredExports.filter(k => table[k] !== undefined);
// ⚠️ The `readFigure` half is not decoration: an absence test over an EMPTY or mis-imported module passes
// every clause in it. Assert a live export in the same breath, exactly as §N's emptiness guard does.
chk('the projection helpers are DELETED from the model — the loss class is unreachable, not guarded',
  absent(M).length === 0 && typeof M.readFigure === 'function',
  absent(M).length ? `still exported: ${absent(M).join(', ')}`
    : `${retiredExports.length} retired exports absent; readFigure/writeFigure still present`);
seed('the pre-16.15 module, with the projection still exported under its own name',
  absent({ ...M, applySimple: () => {}, tierOf: () => {} }).length,
  'if the oracle could not see a surviving export it would report a clean deletion over a live projection');

/*
 * ⚠️ **AND A RENAME IS ASSERTED SEPARATELY, BECAUSE THE NAME LIST ABOVE CANNOT SEE ONE — `CLAUDE.md`: *also
 * assert the old names are GONE, not merely renamed*, and no measured clause can see a surviving second
 * surface.** The whole export table is scanned for the vocabulary of a projection, so
 * `applySimpleRow`/`projectSlot`/`tierFor` would all fail here while passing the exact-name clause.
 */
const projectionish = Object.keys(M).filter(k => /simple|tier|repair|project|demote/i.test(k));
chk('...and no export carries the VOCABULARY of a projection either, so a rename cannot satisfy the clause above',
  projectionish.length === 0 && Object.keys(M).length > 0,
  projectionish.length ? `projection-shaped exports: ${projectionish.join(', ')}`
    : `${Object.keys(M).length} exports scanned, none matching simple|tier|repair|project|demote`);
seed('a projection kept under a new name, which the exact-name list would pass over',
  Object.keys({ ...M, applySimpleRow: () => {} }).filter(k => /simple|tier|repair|project|demote/i.test(k)).length,
  'a rename is the cheapest way to keep a deleted mechanism alive, and an exact-name absence list is blind to it');

// ===================================================================================================
console.log('\n§F — the seed and Stack: the actions that WRITE');
// ===================================================================================================
// ⚠️ **`New Figure` MUST NOT SEED `MigrationLayer.defaultWave()` — it is all zeros and renders BLACK.** A
// blank start is a black screen with no clue which of sixty-three numbers ends it.
const seedWaves = seedFigure();
chk('the seed authors a lit figure (nonzero size on at least two axes)',
  seedWaves.length === 1 && seedWaves[0].axes.filter(a => (a.am.base ?? 0) !== 0).length >= 2,
  'all-zero amplitudes render black — this is the defaultWave() trap');
// ⚠️ **THE CLAUSE USED TO READ "so it opens in the SIMPLE tier" AND WAS RE-POINTED, NOT DELETED (16.15): the
// tier is gone, the PROPERTY is not.** A seed carrying a modulator or a fractional winding would open a new
// figure already breathing and already open-ended, which is a bad blank page whatever control set shows it.
chk('the seed is modulator-free and closes on every axis — a blank page with nothing already moving',
  rawCells(seedWaves[0]).every(c => c.pulse === 0 && c.pulseRate === 0 && c.wobble === 0 && c.wobbleRate === 0)
  && seedWaves[0].axes.every(a => Number.isInteger(a.fm.base ?? 0)),
  'a seed that arrives mid-pulse or mid-seam gives the user a moving figure to explain before an authored one');

// ⚠️ **THE UNITS TRAP, ASSERTED SO IT CANNOT COME BACK.** The phase plan's seed named `particleCount` 4000 —
// the mode of the LEGACY JSON's raw `ParticleCount` — but `MigrationLayer` multiplies that field by 5 on the
// way in, so the mode of the field the seed actually writes is 20000. Seeding 4000 would open every new
// figure five times sparser than the library's commonest density, and `tsc` sees both as `number`. This is
// invariant 10, and the assertion is against the MEASURED mode of the migrated library, not against a literal.
const pcHist = {};
for (const [, p] of presets) { const c = p.generators.particleCount; pcHist[c] = (pcHist[c] ?? 0) + 1; }
const pcMode = Number(Object.entries(pcHist).sort((a, b) => b[1] - a[1])[0][0]);
console.log(`         measured particleCount mode over the collected library: ${pcMode} (×${pcHist[pcMode]})`);
chk('the seed\'s particleCount is in ENGINE units, matching the library mode (invariant 10)',
  SEED_PARTICLE_COUNT === pcMode,
  `seed ${SEED_PARTICLE_COUNT} vs measured mode ${pcMode} — the plan's 4000 is the RAW legacy unit, ×5 in migration`);
const rawMode = (() => {
  const h = {};
  for (const k of Object.keys(LEGACY)) { const c = LEGACY[k].ParticleCount; h[c] = (h[c] ?? 0) + 1; }
  return Number(Object.entries(h).sort((a, b) => b[1] - a[1])[0][0]);
})();
seed('the plan\'s seed value taken in RAW legacy units', SEED_PARTICLE_COUNT === rawMode * 5 ? 1 : 0,
  `raw mode ${rawMode}, engine mode ${pcMode} — if these were equal there would be no units trap to guard`);
chk('the seed\'s waveSpeed matches the library\'s near-universal value',
  SEED_WAVE_SPEED === 0.05, `${SEED_WAVE_SPEED}`);
chk('the seed\'s size is in the library\'s authored range rather than a round guess',
  SEED_SIZE > 0 && SEED_SIZE <= maxSize && SEED_WINDING === 1, `size ${SEED_SIZE}, winding ${SEED_WINDING}`);

/*
 * ⚠️ **`Repair`'s SIX CLAUSES ARE RETIRED HERE (16.15 / E106) WITH THEIR REASON, AND THE TIE RULE IS THE ONE
 * THING WORTH KEEPING.** They asserted that `repairFigure` was a no-op on a closed figure, snapped exactly the
 * open windings, reported its count, was idempotent, and recomputed `effectivePhase` for the NEW winding. All
 * six are unfalsifiable now: `repairFigure` is deleted, because **its only caller in `src/` was the `Repair`
 * button** — grepped before deleting.
 *
 * ⚠️ **THE TIE RULE IS PINNED BELOW EVEN THOUGH NOTHING ROUNDS, AND THAT IS DELIBERATE.** `Math.round(-9.5)`
 * is **−9**, not −10 — JS breaks ties toward +∞, not away from zero — and **this checker's first draft asserted
 * −10 and FAILED on correct code**, which is the *read a failure as a claim about the checker* lesson in its
 * original form. It matters here because **the library's only non-integer windings are exact ties** (0.5 and
 * 112.5), so tie behaviour was never a corner case: it was the whole open-winding population. If a rounder ever
 * returns — the honest place is `randomize.ts`, the producer of the two closure-breaking mutations `Repair`
 * answered — this clause is the derivation it must be written against.
 */
const closedPreset = clone(presets.find(([, p]) =>
  p.generators.waves.every(w => w.axes.every(a => Number.isInteger(a.fm.base ?? 0))))[1]);
/*
 * ⚠️ **THIS CLAUSE'S DERIVATION CHANGED ON 2026-10-07 AND THAT IS THE FINDING, NOT THE FAILURE.** It used to
 * assert that **every** open winding in the library was an exact half (0.47 is not, but 0.5 and 112.5 are —
 * the old set was small enough to reason about), and concluded that *a rounder's tie rule would be its
 * COMMON case*. Three Evolution-derived presets added five arbitrary-precision windings
 * (`1.4015790880311307`, `5.693460718654353`, `25.292279823062536`, `91.93711547973611`,
 * `239.45745596279886`), so **the population is now mostly NOT ties**.
 *
 * ⚠️ **THE CONSEQUENCE FOR WHATEVER ROUNDS NEXT IS THE OPPOSITE OF WHAT THIS CLAUSE USED TO SAY: a tie is now
 * the EXCEPTION, so a rounder must be written against ordinary rounding first and its tie rule second.** The
 * JS tie direction is still pinned below because it is still the thing most easily got wrong; what is no
 * longer true is that it dominates. **Do not restore the `every(... === 0.5)` form** — it would now fail on
 * a correct library, and it was only ever a description of a small population.
 */
chk('the JS tie rule is pinned, and the open-winding population is recorded rather than assumed',
  Math.round(0.5) === 1 && Math.round(112.5) === 113 && Math.round(-9.5) === -9
  && nonIntWinding.size > 0,
  `ties go toward +∞ in JS; of the library's ${nonIntWinding.size} open windings `
  + `${[...nonIntWinding].filter(v => Math.abs(v % 1) === 0.5).length} are exact halves `
  + `(${[...nonIntWinding].sort((a, b) => a - b).join(', ')}) — so a tie is the EXCEPTION now, not the `
  + 'common case, and a rounder must be written against ordinary rounding first');

// `Stack` — write only the winding numbers, as multiples of the Body slot's.
const stackModel = readFigure(clone(closedPreset));
const beforeSizes = stackModel.slots.map(s => s.axes.map(c => c.size));
const beforePhases = stackModel.slots.map(s => s.axes.map(c => c.phase));
applyStack(stackModel, [3, 5]);
const bodyW = Math.max(...stackModel.slots[0].axes.map(c => Math.abs(c.winding)));
chk('`applyStack` writes the requested multiples of the Body winding',
  stackModel.slots[1].axes.every(c => c.winding === bodyW * 3)
  && stackModel.slots[2].axes.every(c => c.winding === bodyW * 5));
chk('...and touches NO amplitude and NO phase — a stack is a harmonic change only',
  stackModel.slots.every((s, w) => s.axes.every((c, a) =>
    c.size === beforeSizes[w][a] && c.phase === beforePhases[w][a])));
// ⚠️ **IDEMPOTENCY IS NON-NEGOTIABLE HERE, and the precedent is `Sliders`' `grading()`** — a compounding
// version of this exact shape reached exposure ×875 in about forty events. Multiples are applied to the BODY
// winding, never to each slot's current value.
const w1 = stackModel.slots[1].axes[0].winding;
applyStack(stackModel, [3, 5]);
chk('...and is IDEMPOTENT — re-applying the same stack compounds nothing (the grading() lesson)',
  stackModel.slots[1].axes[0].winding === w1, `${w1} → ${stackModel.slots[1].axes[0].winding}`);
// A compounding implementation would multiply the CURRENT value; show that would be observable.
seed('a compounding `applyStack` (multiplying the current winding)', bodyW * 3 !== bodyW * 3 * 3 ? 1 : 0,
  'if the body winding were 0 the compounding defect would be invisible — the guard clause covers that case');

// ===================================================================================================
console.log('\n§G — the model writes `generators` ONLY, and no `overlay` twin (invariant 17)');
// ===================================================================================================
// ⚠️ **A FIGURE WITH TWO SOURCES IS INVARIANT 17'S SHAPE**, and the cost is recorded: a resolved value
// overwritten ~135 lines later by a second writer, where grepping the readers EXONERATED the file containing
// the bug. So the model must not acquire an `overlay` twin, and this is asserted on the SOURCE — the one
// place a future edit would add one.
const src = readFileSync(join(ROOT, 'src/ui/synthesis-lab/composer-model.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
chk('composer-model.ts contains no `overlay` write at all (invariant 17)',
  !/\.overlay\s*[.=[]/.test(src) && !/overlay\s*:/.test(src),
  'a second source for the figure is the defect class invariant 17 names');
// ⚠️ **`stripComments` IS LOAD-BEARING** and the reason is on the record twice — `deadcheck` and `trackcheck`
// both say so, and `trackcheck`'s first draft failed against correct code by matching a comment. This file's
// own doc comments discuss `overlay` at length, so without the strip the assertion above would fail on
// prose. Asserted, so the strip cannot be tidied away.
chk('...and that assertion is only meaningful because comments are stripped first',
  /overlay/.test(readFileSync(join(ROOT, 'src/ui/synthesis-lab/composer-model.ts'), 'utf8')),
  'the raw file DOES mention overlay in prose — a grep without stripComments would fail on correct code');

// ⚠️ **`WaveConfig.speed` IS READ BY NOTHING** — required by the type, interpolated in the Mixer, and never
// consumed: `lissajous.ts`'s `init()` takes `config.waveSpeed`. A control for it would be inert on arrival
// (invariant 13), so the model must PRESERVE it and offer nothing. Asserted by round-tripping a marked value.
const speedPreset = clone(closedPreset);
speedPreset.generators.waves[0].speed = 0.123456;
writeFigure(speedPreset, readFigure(speedPreset));
chk('`WaveConfig.speed` is preserved verbatim rather than normalised (it is read by nothing)',
  speedPreset.generators.waves[0].speed === 0.123456,
  'inventing a value here would silently rewrite a field the Mixer interpolates');

// ===================================================================================================
console.log('\n§H — the TAB\'s three obligations that the MODEL deliberately does not discharge (16.3)');
// ===================================================================================================
// ⚠️ **ALL THREE WERE REAL DEFECTS IN THE FIRST WORKING TAB, and none is a model defect — which is
// exactly why they need a section of their own.** Every §A–§G property passed while all three were live, because
// each is a gap between two correct contracts rather than a broken one.
// ⚠️ **The count here was TWO for one sitting and is now THREE — do not read the header as a bound.** The
// third arrived by audit after the first two, which is the section's own argument for existing: a gap between
// two correct contracts is found by reading the seam, never by a checker that owns either side of it. `CLAUDE.md`'s dye row names the shape:
// four of that subsystem's five causes sat one stage DOWNSTREAM of a pipeline in which every file was correct.
//
// ⚠️ **They are asserted on `composer.ts`'s SOURCE, which is weaker than measuring behaviour and is said so
// plainly.** A tab needs a DOM, and standing up jsdom for two assertions would buy less than it costs. So
// these pin the two NAMED OWNERS by their call sites: if either helper is deleted, renamed away, or stops
// being called from `commit`, this fails. It cannot see a helper that is called but wrong — that is what the
// browser pass covers, and the two claims below are stated in the hand-over for exactly that reason.
const tabSrc = readFileSync(join(ROOT, 'src/ui/synthesis-lab/tabs/composer.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ⚠️ **THE PAD GUARD HAS A BLIND SPOT IN THE OTHER DIRECTION, and the tab must close it.** `writeFigure`
// emits `slotCount` slots — right, and what protects short presets from being normalised to three. But the
// tab shows THREE editable rows regardless, so on a one-slot preset (which `New Figure` creates) a user can
// author a whole Structure wave that `writeFigure` then silently DISCARDS: the model holds it, the Score draws
// it, the preset never receives it, and the figure is correct until the next reload. Measured, not suspected:
// the seed reads `slotCount: 1` with three editable rows.
// ⚠️ **THE FIVE ASSERTIONS BELOW ARE SEEDED AGAINST MUTATED COPIES OF THE SOURCE STRING, never against the
// file on disk.** A checker that edits the tree to calibrate itself can leave it edited — and `deadcheck`
// counts FILES, so a scratch copy would move an unrelated figure. Each seed deletes exactly the construct the
// assertion names and requires the oracle to report a violation.
const oracleGrow = (s) => (
  ((s.match(/growSlotCountForAuthoredContent\s*\(/g) || []).length >= 2
   && /this\.growSlotCountForAuthoredContent\(\);[\s\S]{0,120}writeFigure\(/.test(s)) ? 0 : 1);
const oracleOneWay = (s) => (/slotCount\s*=\s*Math\.max\(\s*this\.model\.slotCount/.test(s) ? 0 : 1);
const oracleGrant = (s) => (
  (/giveStackedSlotsSize\s*\(/.test(s) && /applyStack\([\s\S]{0,400}?this\.giveStackedSlotsSize\(\)/.test(s)) ? 0 : 1);
const oracleSilentOnly = (s) => (/if\s*\(!slot\.silent\)\s*continue;/.test(s) ? 0 : 1);

const grows = /growSlotCountForAuthoredContent\s*\(/g;
chk('the tab RAISES `slotCount` for a slot the user authors into, and calls it from the commit path',
  (tabSrc.match(grows) || []).length >= 2 && /this\.growSlotCountForAuthoredContent\(\);[\s\S]{0,120}writeFigure\(/.test(tabSrc),
  'without it, editing row 2 of a one-slot preset is accepted, drawn, and never saved');
// ⚠️ Two seeds, because the assertion has two halves and the SECOND is the one that decays: a helper can
// survive while its call is moved out of the commit path, which is `CLAUDE.md`'s missing-call shape
// (invariant 23) and leaves a green-looking definition behind.
seed('the helper deleted outright',
  oracleGrow(tabSrc.replace(/growSlotCountForAuthoredContent/g, 'noSuchHelper')),
  'the name pattern is unreachable — it would report on nothing');
// ⚠️ **The second seed RELOCATES the call rather than deleting it, and that distinction is the whole point.**
// A deleting seed also drops the name count below 2, so it would fire on the FIRST clause and the adjacency
// clause would be algebraically implied by its sibling — `CLAUDE.md`'s twelfth measuring-section defect, a
// clause that can fail only when another already has. This seed keeps two occurrences of the name and moves
// one into an unrelated method, so ONLY the adjacency can report it.
seed('the helper kept and still called, but from somewhere OTHER than the commit path',
  oracleGrow(tabSrc.replace(/this\.growSlotCountForAuthoredContent\(\);/, '')
    + '\nclass Relocated { m() { this.growSlotCountForAuthoredContent(); } }\n'),
  'a call that exists but not before `writeFigure` is invariant 23 through a missing call, and a name-only grep sees it as present');
// ⚠️ **AND IT MUST BE ONE-WAY.** Silencing a row must NOT drop a slot the preset authored — **343 of the
// library's 1197 slots** are silent, so a silent-but-present slot is a real authored state, and shrinking would
// be the same silent rewrite in the opposite direction. `Math.max` is the assertion.
// ⚠️ **THE FIGURE HERE READ `651 of the library's slots` UNTIL 16.17, WHICH IS A NUMERATOR FROM ANOTHER BASIS:**
// 651 counts silent AXES in the legacy JSON alone (of 1593). §Q re-derived the slot figure and the two disagreed
// in the same file — `CLAUDE.md`'s rule for this phase is to state the basis and never sum, so both now do.
chk('...and the growth is ONE-WAY, so silencing a row cannot delete an authored slot',
  /slotCount\s*=\s*Math\.max\(\s*this\.model\.slotCount/.test(tabSrc),
  'a shrinking version would destroy the 343 silent-but-authored slots the library ships');
seed('a two-way `slotCount = w + 1` that shrinks as well as grows',
  oracleOneWay(tabSrc.replace(/slotCount\s*=\s*Math\.max\(\s*this\.model\.slotCount[^;]*;/, 'slotCount = w + 1;')),
  'the plausible simplification, and the one that silently drops authored silent slots');

// ⚠️ **`Stack` IS INERT ON A FRESH FIGURE UNLESS THE TAB GRANTS THE STACKED SLOTS SIZE — measured.** On the
// seed, `applyStack` correctly writes windings 2 and 4 into slots whose `am.base` is 0 on every axis, so the
// two new waves contribute NOTHING and the picture does not move. Invariant 13's harder form: the control
// changed exactly the value it names and the output channel cannot represent it. ⚠️ **The fix belongs in the
// tab, NOT in `applyStack`** — the model's contract is *windings only*, which §F pins, and which is correct
// for a library preset whose three slots are already lit.
const seedModel = readFigure({ generators: { waves: seedFigure(), particleCount: SEED_PARTICLE_COUNT } });
applyStack(seedModel, [2, 4]);
chk('MEASURED: `applyStack` alone leaves the stacked slots silent on a fresh figure',
  seedModel.slots[1].silent && seedModel.slots[2].silent,
  'so a tab that only called applyStack would ship a Stack menu that does nothing visible — this is the premise of the next two');
chk('...so the tab grants a SILENT stacked slot a size, from the commit path',
  /giveStackedSlotsSize\s*\(/.test(tabSrc) && /applyStack\([\s\S]{0,400}?this\.giveStackedSlotsSize\(\)/.test(tabSrc),
  'the grant is the tab\'s obligation; the model stays windings-only');
seed('the grant absent, i.e. the tab that shipped in the first working draft',
  oracleGrant(tabSrc.replace(/this\.giveStackedSlotsSize\(\);/g, '')),
  'this is the ACTUAL defect that was measured, not an invented one');
// ⚠️ **AND IT MUST ONLY EVER GRANT, NEVER ADJUST.** A version that set every stacked slot's size
// unconditionally would resize the authored waves of any lit library preset — a look change to 361 figures
// from one menu click. The `if (!slot.silent) continue` guard is the whole safety property.
chk('...and only ever to a SILENT slot, so a stack cannot resize a wave the preset authored',
  /if\s*\(!slot\.silent\)\s*continue;/.test(tabSrc),
  'without the guard, one Stack click would rewrite the amplitudes of every lit preset in the library');
seed('the silent-only guard removed, so the grant becomes an unconditional resize',
  oracleSilentOnly(tabSrc.replace(/if\s*\(!slot\.silent\)\s*continue;/, '')),
  'the failure mode is a LOOK CHANGE to 361 figures, which no browser pass on one preset would reveal');

// ⚠️ **THE REGION D PRECONDITION HAS TWO INPUTS, AND READING ONLY ONE MADE THE WARNING ITSELF THE FALSE
// READOUT — a third audit-found defect, and the one that most deserves a section.** `getAttractorBlend()`
// returns `currentBlend`, which Visual FX's Blend slider and the `+`/`-` keys move **even with the Attractor
// `Preset` dropdown at `Off`** — at which point `main.ts` has called `generator.setAttractor(null)` and the
// waves are not replaced at all. So a gate on the blend alone announces "nothing here changes the picture"
// over a fully live figure. ⚠️ **That is invariant 25 turned on its own remedy** (the thing that moves nothing
// is the EXPLANATION, so it actively redirects the diagnosis) **and invariant 17 as well** — one setting with
// two inputs, where `main.ts:2771` already resolves it as `index >= 0 ? blend : 0` for the ribbon renderer,
// and a second reader resolving it differently is the defect.
//
// ⚠️ **THIS IS THE ONE §H PROPERTY WITH A MEASURED HALF, AND THE MEASUREMENT IS WHY IT NEEDED AN AUDIT AT
// ALL**: the bad state is reachable only from two UI controls and a key binding, so neither a preset sweep nor
// a browser pass over the library could have produced it.
//
// ⚠️ **THE MEASURED HALF MOVED ON 2026-09-16, AND THE ASSERTION HAD TO NARROW TO WHAT IT ACTUALLY NEEDS.**
// `Mandelbrot River` (`variant-presets.ts`) is the first library preset to author `attractorBlend: 1`, so
// "no preset reaches Region D" is HISTORY. It reaches it LEGITIMATELY — with `attractorIndex: 25`, where the
// tab's precondition is TRUE, because at full blend the attractor really does replace the wave positions, so
// the Composer really cannot reach the screen. **The property that justifies "only an audit could have found
// the gate defect" is the OTHER input**: the defect is a FALSE inert warning over a LIVE figure, which needs
// blend >= 1 **with the attractor Off**, and no preset can author that — the orphan blends cap well below 1.
// So this clause asserts the orphan cap and only REPORTS the Region D tally.
// ⚠️ **The previous form asserted both AND printed a HARDCODED `0` for that tally**, so it would have gone on
// reporting "0 of 411" while the true count was 1: **never hardcode a figure into a detail string a reader
// will take as measured** — the assertion caught the change, but its own message contradicted it.
const blendGe1 = presets.filter(([, p]) => (p.overlay?.attractorBlend ?? 0) >= 1);
const blendWithNoAttractor = presets.filter(([, p]) =>
  (p.overlay?.attractorIndex ?? -1) < 0 && (p.overlay?.attractorBlend ?? 0) > 0);
const maxOrphanBlend = blendWithNoAttractor.reduce((m, [, p]) => Math.max(m, p.overlay.attractorBlend), 0);
chk('MEASURED: no library preset reaches Region D with the attractor OFF, so only an audit could find a gate defect there',
  maxOrphanBlend < 1,
  `${blendGe1.length} of ${presets.length} author blend >= 1 [${blendGe1.map(([n]) => n).join(', ') || 'none'}] — `
  + `0 until 2026-09-16, and each of these has the attractor ON, where the precondition is a TRUE reading; `
  + `${blendWithNoAttractor.length} author a blend with the attractor Off, capping at ${maxOrphanBlend}, `
  + 'and THAT cap is the premise of the assertion below');
const oracleRegionD = (s) => (
  /getAttractorIndex\(\)\s*>=\s*0\s*\?\s*this\.controls\.getAttractorBlend\(\)\s*:\s*0/.test(s)
  && /effectiveBlend\s*>=\s*1/.test(s) ? 0 : 1);
chk('...so the precondition resolves BOTH inputs the way `main.ts` does, never the blend alone',
  oracleRegionD(tabSrc) === 0,
  'a blend-only gate declares the whole tab inert over a live figure whenever Blend is 1.0 with the attractor Off');
seed('the gate reading `getAttractorBlend() >= 1` alone — the shape that was actually built and audited out',
  oracleRegionD(tabSrc.replace(
    /const effectiveBlend[\s\S]*?getAttractorBlend\(\)\s*:\s*0;/,
    'const effectiveBlend = this.controls.getAttractorBlend();')),
  'the plausible one-reader version, and the one this file exists to keep out');

// ===================================================================================================
console.log('\n§I — the SCORE\'s sampling instants (16.2), added after the first browser pass falsified them');
// ===================================================================================================
/*
 * ⚠️ **THIS SECTION EXISTS BECAUSE THE SCORE HAD *NO* CHECKER COVERAGE AND SHIPPED TWO DEGENERATE SAMPLING
 * DEFECTS — both user-reported on the very first browser pass, both `verify`-green, both invisible to `tsc`.**
 * §A–§H owned the model and the tab's seams; nothing read `score-canvas.ts` at all, which is why a diagram
 * that drew a BLACK box for `Argus` passed thirteen checkers. **The gap was in the SUBJECT MATTER, not in any
 * assertion's logic** — `CLAUDE.md`'s rule that an exhausted worklist bounds the reading rather than the code.
 *
 * ⚠️ **THE TWO DEFECTS COMPOUNDED, WHICH IS WHY NEITHER LOOKED LIKE ITSELF:**
 *
 * 1. **The main path was drawn at `time = 0`, where every modulator is EXACTLY zero** (`modulate` is
 *    `base + sin(time · f/DEG) · a`). A slot authoring `am.base = 0` with a pulse contributes nothing; one
 *    authoring `fm.base = 0` with a wobble has no winding. `Argus` does both, so its whole figure lives in its
 *    modulators and the diagram plotted float noise — extent `3.07e-12` against an authored reach of 100.
 * 2. **The ghost was `main + 180/slowest`, which is an ALGEBRAIC IDENTITY rather than an opposite phase.**
 *    That moves every modulator's argument by `k·π`, and `sin(k·π) = 0` for **every** integer k — so the ghost
 *    was drawn at the same modulator state as the main path, while its label read *"faint path = breathing
 *    range"*. It could never have rescued (1). ⚠️ **The nearby correct-LOOKING value is a QUARTER period**, the
 *    honest inversion for the slowest rate, which still lands on a zero for every even multiple of it.
 *
 * ⚠️ **AND THE SAME ROOT CAUSE PRODUCED A SECOND, QUITE DIFFERENT-SOUNDING REPORT** — *"the main preview did
 * adapt, but the displayed diagram above did not"*. Measured below: on **42 of 177** legacy presets a Tuner
 * move changes the live figure while changing nothing whatsoever at `t = 0`. **Two symptoms, one cause: do not
 * read them as two defects.**
 *
 * ⚠️ **SO THIS IS A MEASURING SECTION, NOT A GREP — it imports the real `computeScore` and runs it over the
 * whole library**, and it is the FIFTH measuring section in the project. `CLAUDE.md` records twelve occasions
 * where a measuring section's own basis was the defect, so every property here is seeded with the design that
 * actually shipped, and the seeds are re-implementations of that design rather than invented strawmen.
 */
const SC = await import('../src/ui/synthesis-lab/score-canvas.ts');
const { computeScore, sampleCountFor, SCORE_MAX_SAMPLES, SCORE_SAMPLES_PER_CYCLE } = SC;
/*
 * ⚠️ **The Score's SOURCE, read once at module scope because three sections now need it** (§N's widened
 * parameter-list clause, §O's pad clause and §R's "the law is not re-implemented here" clause). ⚠️ §N and §O
 * each used to read it locally; a third copy would have been the shape `CLAUDE.md` calls three enumerations of
 * one list, so the later local reads are left alone only where they are already scoped to a block.
 */
const SCORE_SRC = readFileSync(join(ROOT, 'src/ui/synthesis-lab/score-canvas.ts'), 'utf8');

/*
 * ⚠️ **A LITERAL RE-IMPLEMENTATION, DELIBERATELY — the same choice §D makes and for the same reason** (and it
 * reuses §D's own `DEG`, which is where the constant is declared). The
 * seeds must evaluate the curve at an instant of their own choosing, which the shipped `computeScore` no longer
 * permits (removing its `time` parameter is what made the fix structural). Writing the expression out here
 * means a change to the generator's formula fails a checker instead of silently making the diagram describe a
 * figure the engine does not draw.
 */
const mod = (b, a, f, t) => b + Math.sin(t * f / DEG) * a;
const PLANE_AXES = { xy: [0, 1], xz: [0, 2], yz: [1, 2] };
const evaluateAt = (waves, time, samples, plane) => {
  const am = [], fm = [], ph = [];
  for (let w = 0; w < MAX_WAVES; w++) {
    am.push([0, 0, 0]); fm.push([0, 0, 0]); ph.push([0, 0, 0]);
    const wv = waves[w]; if (!wv) continue;
    for (let q = 0; q < AXES; q++) {
      const a = wv.axes[q];
      am[w][q] = mod(a.am.base ?? 0, a.am.amplitude ?? 0, a.am.frequency ?? 0, time);
      fm[w][q] = mod(a.fm.base ?? 0, a.fm.amplitude ?? 0, a.fm.frequency ?? 0, time) / DEG;
      ph[w][q] = a.phase ?? 0;
    }
  }
  const [ia, ib] = PLANE_AXES[plane], cStep = 360 / samples, out = new Float64Array(samples * 2);
  for (let i = 0; i < samples; i++) {
    const n = i * cStep, v = [0, 0, 0];
    for (let w = 0; w < MAX_WAVES; w++) for (let q = 0; q < AXES; q++) v[q] += Math.sin((n + ph[w][q]) * fm[w][q]) * am[w][q];
    out[i * 2] = v[ia]; out[i * 2 + 1] = v[ib];
  }
  return out;
};
/*
 * ⚠️ **THE 3D EVALUATOR EXISTS BECAUSE A SINGLE-PLANE ORACLE IS THIS SECTION'S RECURRING ERROR, AND IT COST
 * THREE WRONG READINGS BEFORE THE FILE WAS GREEN.** The LIVE figure is three-dimensional and rotating, so an
 * edit that moves only Z moves the render while an XY projection is genuinely unchanged. Reading XY alone
 * therefore (a) mis-measured the Tuner's `1:1:1` as an inert control when it moves `Aliens DNA` by 110.85 model
 * units in Z, (b) failed the ghost-identity clause on 30 correct presets, and (c) inflated the unexplained
 * bucket in property 8 from 12 to 190. **This is invariant 21's rule in a different medium: a probe that reads
 * one stage cannot localise a producer, and a probe that reads one plane cannot convict a three-axis control.**
 */
const evaluateAt3 = (waves, time, samples) => {
  const am = [], fm = [], ph = [];
  for (let w = 0; w < MAX_WAVES; w++) {
    am.push([0, 0, 0]); fm.push([0, 0, 0]); ph.push([0, 0, 0]);
    const wv = waves[w]; if (!wv) continue;
    for (let q = 0; q < AXES; q++) {
      const a = wv.axes[q];
      am[w][q] = mod(a.am.base ?? 0, a.am.amplitude ?? 0, a.am.frequency ?? 0, time);
      fm[w][q] = mod(a.fm.base ?? 0, a.fm.amplitude ?? 0, a.fm.frequency ?? 0, time) / DEG;
      ph[w][q] = a.phase ?? 0;
    }
  }
  const cStep = 360 / samples, out = new Float64Array(samples * AXES);
  for (let i = 0; i < samples; i++) {
    const n = i * cStep;
    for (let q = 0; q < AXES; q++) {
      let v = 0;
      for (let w = 0; w < MAX_WAVES; w++) v += Math.sin((n + ph[w][q]) * fm[w][q]) * am[w][q];
      out[i * AXES + q] = v;
    }
  }
  return out;
};
const extentOfPath = (p) => { let e = 0; for (let i = 0; i < p.length; i++) e = Math.max(e, Math.abs(p[i])); return e; };
/** The largest amplitude the slots AUTHOR — the denominator every "is it blank" test is relative to. */
const authoredReach = (waves) => Math.max(0, ...waves.flatMap(w =>
  w.axes.map(a => Math.abs(a.am.base ?? 0) + Math.abs(a.am.amplitude ?? 0))));
/** ⚠️ Over all THREE planes: a figure may legitimately put its whole size in Z, so an XY-only test would call it blank. */
const shippedExtent = (waves) => Math.max(...Object.keys(PLANE_AXES).map(pl => computeScore(waves, pl).extent));
const slowestRate = (waves) => {
  let s = Infinity;
  for (const w of waves) for (const a of w.axes)
    for (const [amp, f] of [[a.am.amplitude ?? 0, a.am.frequency ?? 0], [a.fm.amplitude ?? 0, a.fm.frequency ?? 0]])
      if (amp !== 0 && f !== 0) s = Math.min(s, Math.abs(f));
  return s;
};

const scored = presets.map(([n, p]) => ({ n, waves: p.generators.waves ?? [] }))
  .filter(s => s.waves.length > 0 && authoredReach(s.waves) > 0);

// ⚠️ **PROPERTY 1 IS THE PREMISE, AND IT IS MEASURED RATHER THAN ARGUED.** If `t = 0` were not degenerate the
// whole section would be asserting nothing — the anchor-that-matched-nothing shape arriving through the data,
// which §E already caught once in this file. So the count of presets that ARE degenerate at 0 is printed.
const blankAtZero = scored.filter(s =>
  Math.max(...Object.keys(PLANE_AXES).map(pl => extentOfPath(evaluateAt(s.waves, 0, 2000, pl))))
  < authoredReach(s.waves) * 1e-6);
chk('MEASURED: `time = 0` IS a degenerate instant for a real part of the library — the premise of this section',
  blankAtZero.length > 0,
  `${blankAtZero.length} of ${scored.length} preset objects have essentially NO extent at t=0 despite an authored `
  + `reach (witnesses: ${blankAtZero.slice(0, 4).map(s => s.n.replace(/^legacy:/, '')).join(', ')})`);

// ⚠️ **PROPERTY 2 IS STRUCTURAL, AND IT IS THE ONE THAT KEEPS THE FIX FROM DECAYING.** The instants are chosen
// inside `computeScore`; a caller that COULD pass `0` is a caller that will, because `0` is the obvious value
// and it type-checks. Arity is the assertion — a re-added parameter fails here rather than in a browser.
chk('`computeScore` takes NO `time` parameter, so no call site can reintroduce the degenerate instant',
  computeScore.length === 2,
  `arity is ${computeScore.length}; it was 3 when the tab passed 0 with a comment arguing the ghost made it safe`);

// ⚠️ **PROPERTY 3 IS THE USER-REPORTED DEFECT ITSELF: no preset may draw a blank diagram.**
const shippedBlank = scored.filter(s => shippedExtent(s.waves) < authoredReach(s.waves) * 1e-6);
chk('NO preset with an authored reach draws a blank diagram under the shipped sampling',
  shippedBlank.length === 0,
  shippedBlank.length ? `${shippedBlank.length} blank: ${shippedBlank.slice(0, 6).map(s => s.n).join(', ')}`
    : `all ${scored.length} draw something; this is the assertion \`Argus\` (extent 3.07e-12) failed`);
seed('the shipped-then-fixed `time = 0` sampling',
  blankAtZero.length,
  'if t=0 produced no blanks this property could not fail, and the section would be decorative');
// ⚠️ **A SECOND SEED FOR THE SAME PROPERTY, BECAUSE THE FIRST ONE'S FAILURE IS NOT THE INTERESTING ONE.** The
// search can be broken while still avoiding t=0: weighting the reach proxy by amplitude ALONE — ignoring
// whether an axis can wind — makes the proxy constant for a figure like `Argus` (its `am` is a constant 50 with
// the winding entirely in `fm`), so argmax returns the FIRST instant, which is 0 again. The gate
// `if (Math.abs(fm) > 1e-12)` is the whole difference, and this is what proves it load-bearing.
const blankUnderNaiveProxy = scored.filter(s => {
  const slow = slowestRate(s.waves);
  if (!Number.isFinite(slow)) return false;
  const period = 360 / slow;
  let tMax = 0, vMax = -Infinity;
  for (let i = 0; i < 48; i++) {
    const t = i * period / 48;
    let total = 0;
    for (const w of s.waves) for (const a of w.axes) total += Math.abs(mod(a.am.base ?? 0, a.am.amplitude ?? 0, a.am.frequency ?? 0, t));
    if (total > vMax) { vMax = total; tMax = t; }
  }
  return Math.max(...Object.keys(PLANE_AXES).map(pl => extentOfPath(evaluateAt(s.waves, tMax, 2000, pl))))
    < authoredReach(s.waves) * 1e-6;
});
seed('a reach proxy weighted by amplitude ALONE, ignoring whether the axis can wind',
  blankUnderNaiveProxy.length,
  'the plausible proxy; it goes constant on a modulator-driven figure so argmax returns the first instant, which is 0');

// ⚠️ **PROPERTY 4 — THE GHOST MUST BE A DIFFERENT INSTANT, WHICH IS EXACTLY WHAT THE SHIPPED VERSION WAS NOT.**
// ⚠️ **AND IT IS ASSERTED ON THE DRAWN PATHS, NOT ON THE TIMES**, because two different times can produce an
// identical curve — which is the entire defect. A time-based oracle would have passed on the broken version.
const pathsEqual = (a, b) => {
  const e = Math.max(extentOfPath(a), extentOfPath(b), 1e-30);
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > e * 1e-9) return false;
  return true;
};
/*
 * ⚠️ **ALL THREE PLANES, AND THIS CLAUSE FAILED ON 30 PRESETS WHEN IT READ XY ALONE — my own single-plane
 * error, committed in the same section whose seed below documents it.** A figure can breathe in Z while its XY
 * projection is genuinely constant, so an XY-only reading calls a working ghost identical to its path. The
 * ghost is a no-op only if it coincides in EVERY plane the user can select. **Recorded rather than quietly
 * corrected: I wrote the trap into a seed and then walked into it twice more in the same file.**
 */
const ghostOnPath = scored.filter(s => {
  const results = Object.keys(PLANE_AXES).map(pl => computeScore(s.waves, pl));
  return results.every(r => r.ghost !== null && pathsEqual(r.path, r.ghost))
    && results.some(r => r.ghost !== null);
});
chk('where a ghost path exists it is a GENUINELY different curve, never drawn on top of the main path',
  ghostOnPath.length === 0,
  ghostOnPath.length ? `${ghostOnPath.length} draw a ghost identical to the path: ${ghostOnPath.slice(0, 5).map(s => s.n).join(', ')}`
    : `checked ${scored.length}; the label "faint path = breathing range" is now true rather than aspirational`);
// The seed reproduces the shipped `main + 180/slowest` offset. ⚠️ Its expected count is LARGE, and that is the
// finding: the label was wrong on most of the library.
const halfPeriodIdentical = scored.filter(s => {
  const slow = slowestRate(s.waves);
  if (!Number.isFinite(slow)) return false;
  return pathsEqual(evaluateAt(s.waves, 0, 2000, 'xy'), evaluateAt(s.waves, 180 / slow, 2000, 'xy'));
});
seed('the shipped `main + 180/slowest` ghost offset',
  halfPeriodIdentical.length,
  'a half period moves every modulator by k·pi and sin(k·pi) == 0 for EVERY integer k, not only even ones');
// ⚠️ **THE ARITHMETIC ITSELF, PINNED SEPARATELY.** The count above could in principle move for data reasons;
// this cannot. It is the one clause that states WHY the offset was an identity rather than that it was.
chk('MEASURED: a half-period offset is an algebraic identity — `sin(180·k/DEG)` is zero for every integer k',
  [1, 2, 3, 7].every(k => Math.abs(Math.sin(180 * k / DEG)) < 1e-15),
  `|sin(180/DEG)| = ${Math.abs(Math.sin(180 / DEG)).toExponential(2)}; the QUARTER period is the tempting `
  + 'near-miss — honest for the slowest rate, still zero at every even multiple of it');

// ⚠️ **PROPERTY 5 — `ghost === null` MUST MEAN "does not breathe", in BOTH directions.** A ghost keyed off "any
// amplitude is nonzero" would reproduce the defect above in miniature: a modulator whose RATE is zero has a
// nonzero amplitude and never moves, so it would announce a breathing range that does not exist.
const staticFigures = scored.filter(s => !Number.isFinite(slowestRate(s.waves)));
const ghostOnStatic = staticFigures.filter(s =>
  Object.keys(PLANE_AXES).some(pl => computeScore(s.waves, pl).ghost !== null));
chk('a figure with no live modulator gets NO ghost path (nothing breathes, so nothing to show)',
  ghostOnStatic.length === 0,
  `${staticFigures.length} of ${scored.length} preset objects modulate nothing at all`);
/*
 * ⚠️ **THE SEED FOR THIS PROPERTY MUST BE SYNTHESISED, AND FINDING THAT OUT WAS THE POINT OF SEEDING IT.** My
 * first version drew the seed from the library — "a static figure that nonetheless has a nonzero amplitude" —
 * and it reported **CALIBRATION FAIL**, because **0 axes in the entire library have a nonzero amplitude at a
 * zero rate** (measured: all 14 static figures author `amplitude 0 @ rate 0` throughout). So the seed asserted
 * nothing at all. ⚠️ **That is the anchor-that-matched-nothing shape arriving through the DATA rather than
 * through a regex — the same trap §E's `waves.length` clause already caught once in this very file, and the
 * reason `seed()` exits non-zero on a seed that passes.** The property it guards is still real and still worth
 * pinning: a ghost keyed on "some amplitude is nonzero" would announce a breathing range over a figure that
 * cannot move, reproducing the half-period defect in miniature. It just has to be pinned on data the library
 * does not happen to contain.
 */
const inertModulatorWave = {
  speed: 1,
  axes: [0, 1, 2].map(q => ({
    phase: 0,
    // A real size, so the slot is LIT and reaches the extent test...
    am: { base: q === 2 ? 0 : 40, amplitude: q === 2 ? 0 : 25, frequency: 0 },
    // ...and a winding, so it draws a curve. Every RATE is 0, so nothing here can ever move.
    fm: { base: 3, amplitude: 12, frequency: 0 },
  })),
};
const naiveGhostWouldFire = [inertModulatorWave].some(w => w.axes.some(a =>
  (a.am.amplitude ?? 0) !== 0 || (a.fm.amplitude ?? 0) !== 0)) ? 1 : 0;
const shippedGhostOnInert = Object.keys(PLANE_AXES)
  .filter(pl => computeScore([inertModulatorWave], pl).ghost !== null).length;
chk('...and the SYNTHESISED case proves it: nonzero amplitudes at a ZERO rate still get no ghost',
  shippedGhostOnInert === 0 && extentOfPath(computeScore([inertModulatorWave], 'xy').path) > 0,
  'the slot is lit and draws a curve, so this exercises the ghost decision rather than an empty-figure short-circuit');
seed('a ghost keyed on "some amplitude is nonzero" rather than on the SEARCHED extremes',
  naiveGhostWouldFire,
  'a modulator with a zero RATE has a nonzero amplitude and never moves — an amplitude test calls it breathing');

// ⚠️ **PROPERTY 6 — THE NYQUIST CLAIM, which is the diagram's other way of being confidently wrong.** Above the
// sample ceiling a high winding aliases into a DIFFERENT, plausible closed curve, so the ceiling binding must
// be reported rather than absorbed.
const badSampling = scored.filter(s => {
  const { samples, maxWinding, undersampled } = sampleCountFor(s.waves);
  const want = maxWinding * SCORE_SAMPLES_PER_CYCLE;
  return undersampled !== (want > SCORE_MAX_SAMPLES) || (!undersampled && samples < want);
});
chk('the sample count carries >= 8 per cycle, and `undersampled` is true EXACTLY when the ceiling binds',
  badSampling.length === 0,
  `checked ${scored.length}; ${scored.filter(s => sampleCountFor(s.waves).undersampled).length} genuinely exceed `
  + `the ${SCORE_MAX_SAMPLES}-sample ceiling and must say so in the label`);
seed('an `undersampled` flag hardcoded false, i.e. a diagram that aliases silently',
  scored.filter(s => sampleCountFor(s.waves).undersampled).length,
  'if nothing in the library exceeded the ceiling this property would assert nothing');

// ⚠️ **PROPERTY 7 — THE SECOND USER REPORT, measured so it is not read as a separate defect.** *"the main
// preview did adapt, but the displayed diagram above did not"*: the live figure sweeps every instant while the
// diagram was frozen at the one instant where every modulator is zero, so an edit to a modulator-driven axis
// moved the render and provably could not move the diagram.
const RATIO_111 = [1, 1, 1], RATIO_231 = [2, 3, 1];
/*
 * ⚠️ **THE BASE RULE IS IMPORTED, NOT RE-IMPLEMENTED, AND THIS FILE IS WHY THAT MATTERS.** This oracle carried
 * its own `Math.min(...nonzero)` copy of the rule, byte-for-byte the same defect the tab shipped — so when
 * 16.6 fixed the tab, §I would have gone on measuring a base rule nothing uses, and properties 7 and 8 would
 * have reported on a control that no longer exists while staying green. `ratioBase` reads `.winding` only, so
 * a `{winding}` projection of the raw axes is a legitimate argument to it. **A checker that copies the rule it
 * checks tests the copy.**
 */
const tunerApplied = (waves, slot, ratio) => {
  const w = clone(waves), axes = w[slot].axes;
  const base = ratioBase(axes.map(a => ({ winding: a.fm.base ?? 0 })));
  for (let a = 0; a < AXES; a++) axes[a].fm.base = base * ratio[a];
  return w;
};
let tunerBlindAtZero = 0, tunerBlindShipped = 0, tunerCases = 0;
for (const s of scored) {
  for (let slot = 0; slot < s.waves.length; slot++) for (const r of [RATIO_111, RATIO_231]) {
    const after = tunerApplied(s.waves, slot, r);
    // ⚠️ The LIVE figure's oracle is 3D and sampled across a period, since it both sweeps and rotates — see
    // `evaluateAt3`. A change the live view cannot show is not a case for this property at all.
    let live = 0;
    for (let k = 0; k < 8; k++) {
      const A = evaluateAt3(s.waves, k * 45, 400), B = evaluateAt3(after, k * 45, 400);
      for (let i = 0; i < A.length; i++) live = Math.max(live, Math.abs(A[i] - B[i]));
    }
    if (live <= authoredReach(s.waves) * 1e-9) continue;
    tunerCases++;
    if (pathsEqual(evaluateAt(s.waves, 0, 2000, 'xy'), evaluateAt(after, 0, 2000, 'xy'))) tunerBlindAtZero++;
    const before3 = Object.keys(PLANE_AXES).map(pl => computeScore(s.waves, pl).path);
    const after3 = Object.keys(PLANE_AXES).map(pl => computeScore(after, pl).path);
    if (before3.every((p, i) => pathsEqual(p, after3[i]))) tunerBlindShipped++;
  }
}
chk('an edit that moves the LIVE figure also moves the diagram — the second half of the same report',
  tunerBlindShipped < tunerBlindAtZero && tunerBlindShipped / Math.max(tunerCases, 1) < 0.02,
  `over ${tunerCases} Tuner edits that visibly change the live figure: t=0 showed nothing on ${tunerBlindAtZero}, `
  + `the shipped sampling shows nothing on ${tunerBlindShipped}`);
// ⚠️ **THE RESIDUE IS NOT ZERO AND MUST NOT BE ASSERTED TO BE — a Z-only edit genuinely cannot appear in an XY
// plot, which is what the XZ/YZ toggle is for.** ⚠️ **This corrected a finding of my OWN: I first measured
// `1:1:1` as a 0-pixel no-op on `Aliens DNA` and reported it as a second defect, using an XY-only oracle. In
// 3D it moves the figure by 110.85 model units.** **An oracle that reads one plane cannot exonerate or convict
// a three-axis control** — the same shape as invariant 21's "a probe that reads ONE stage cannot localise a
// producer". So this clause reads all three planes, and the seed is the single-plane version.
seed('a single-plane (XY-only) oracle, which is how I mis-measured `1:1:1` as an inert control',
  (() => {
    let n = 0;
    for (const s of scored.slice(0, 40)) for (let slot = 0; slot < s.waves.length; slot++) {
      const after = tunerApplied(s.waves, slot, RATIO_111);
      const xyBlind = pathsEqual(computeScore(s.waves, 'xy').path, computeScore(after, 'xy').path);
      const anyMoved = Object.keys(PLANE_AXES).some(pl => !pathsEqual(computeScore(s.waves, pl).path, computeScore(after, pl).path));
      if (xyBlind && anyMoved) n++;
    }
    return n;
  })(),
  'if no Z-only edit existed in the library the three-plane reading would be unnecessary');

// ⚠️ **PROPERTY 8 — the axis-level inert readout, which the same measurement produced.** A LIT slot can still
// have a SILENT axis, and every control on that axis is then inert: a winding reaches the screen only through
// its own axis's amplitude. Invariant 13's harder form at axis granularity. ⚠️ **The Tuner is where it bites,
// because one click writes all three axes** — and the fix is a READOUT, not a size grant: granting Z a size
// would turn every planar figure in the library 3D from one menu click.
/*
 * ⚠️ **AND THE CAUSE BREAKDOWN IS MEASURED BECAUSE MY FIRST VERSION OF THIS CLAUSE CLAIMED ONE CAUSE AND THE
 * CHECKER FALSIFIED IT.** There are **three**, and the readout is only responsible for the first: (1) picks that
 * change only zero-reach axes, which is what the readout explains; (2) picks that change no winding at all, the
 * Tuner's own idempotency (§F's property, and a *feature*); (3) a residue that is something else entirely —
 * `Black Hole` slot 1 at `2:3:1` rewrites all three axes over reach `24,48,0`, and `Quasar` slot 0 has a Z reach
 * of **6696** yet `1:1:1` is still inert. **The residue is recorded and NOT claimed to be explained** —
 * asserting a single cause would have been a false readout about a false readout.
 *
 * ⚠️ **NO FIGURE IS QUOTED HERE ANY MORE, AND THAT IS THE 16.6 SITTING'S OWN FINDING.** The partition read
 * `328 / 173 / 12 of 691` under the Tuner's original `min(nonzero)` base and reads differently under the gcd
 * rule 16.6 installed — the total moved because a gcd base makes MORE picks idempotent, not because anything
 * regressed. A comment carrying the numbers would have gone stale silently on a change in a different file.
 * **Read the clause's own printed output for a current figure; `CLAUDE.md`'s "never do arithmetic on a quoted
 * figure" applies to a checker's own prose.**
 *
 * ⚠️ **The bound is therefore stated as a MAJORITY over a named partition, never as an equality**, and each
 * cause is counted separately so a future move names itself. `CLAUDE.md`'s rule about a net figure concealing a
 * repair applies to a checker's own diagnosis too.
 */
const tunerLive3D = (a, b) => {
  let d = 0;
  for (let k = 0; k < 8; k++) {
    const A = evaluateAt3(a, k * 45, 400), B = evaluateAt3(b, k * 45, 400);
    for (let i = 0; i < A.length; i++) d = Math.max(d, Math.abs(A[i] - B[i]));
  }
  return d;
};
let deadAxisCases = 0, causeZeroReach = 0, causeNoChange = 0, causeOther = 0;
const otherWitnesses = [];
for (const s of scored) {
  for (let slot = 0; slot < s.waves.length; slot++) {
    const reach = s.waves[slot].axes.map(a => Math.abs(a.am.base ?? 0) + Math.abs(a.am.amplitude ?? 0));
    if (reach.every(v => v === 0)) continue;
    for (const r of [RATIO_111, RATIO_231]) {
      const after = tunerApplied(s.waves, slot, r);
      // ⚠️ 3D, not XY — the single-plane oracle is this section's recurring error and it inflated this very
      // clause's "other" bucket from 12 to 190 the first time it ran.
      if (tunerLive3D(s.waves, after) > authoredReach(s.waves) * 1e-9) continue;
      deadAxisCases++;
      // ⚠️ **THE SAME RULE `tunerApplied` USED, IMPORTED — a local `Math.min(...nz)` copy here would classify
      // the causes of an inertness produced by the gcd rule against a base rule nothing applies, and the
      // partition would drift silently the moment §K's rule and this one disagreed.**
      const base = ratioBase(s.waves[slot].axes.map(a => ({ winding: a.fm.base ?? 0 })));
      const changed = [0, 1, 2].filter(a => (s.waves[slot].axes[a].fm.base ?? 0) !== base * r[a]);
      if (changed.length === 0) causeNoChange++;
      else if (changed.every(a => reach[a] === 0)) causeZeroReach++;
      else { causeOther++; if (otherWitnesses.length < 3) otherWitnesses.push(`${s.n} slot${slot} ${r.join(':')}`); }
    }
  }
}
chk('MEASURED: the DOMINANT cause of an inert Tuner pick on a LIT slot is a zero-reach axis — what the readout explains',
  deadAxisCases > 0 && causeZeroReach + causeNoChange + causeOther === deadAxisCases
  && causeZeroReach > causeOther * 10,
  `of ${deadAxisCases} inert picks: ${causeZeroReach} zero-reach axis (explained), ${causeNoChange} already that `
  + `ratio (§F idempotency, a feature), ${causeOther} neither — NOT explained by the readout `
  + `(${otherWitnesses.join('; ')})`);
const oracleDeadAxis = (s) => (
  /const dead = slot\.axes[\s\S]{0,120}?filter\(\(\{ c \}\) => c\.silent\)/.test(s)
  && /dead\.length > 0 && dead\.length < AXES/.test(s) ? 0 : 1);
chk('...and the tab says so per axis, only when SOME but not all axes are silent',
  oracleDeadAxis(tabSrc) === 0,
  'a whole-slot `silent` flag cannot say this: the slot is genuinely lit in its other axes');
seed('the readout absent, i.e. a Tuner that moves nothing and explains nothing',
  oracleDeadAxis(tabSrc.replace(/const dead = slot\.axes[^;]*;/, '')),
  'the shape this tab fails in: a control moving the right value into a channel that cannot show it');

// ===================================================================================================
console.log('\n§J — the PRESENTATION contract across an EXTERNAL figure change (16.3), added after the second report');
// ===================================================================================================
/*
 * ⚠️ **THIS SECTION EXISTS BECAUSE `rebuildModel() + sync()` LOOKS LIKE A FULL RESYNC AND IS NOT — a
 * user-reported defect, `verify`-green from the build, and invisible to §A–§I because every one of them owns
 * the MODEL or the SCORE while this is a property of the DOM.** The report was
 * *"I opened again Aliens DNA in the Composer, however now both STRUCTURE and DETAILS show empty, whereas
 * before all 3 were filled"* — and the model was perfect throughout: `readFigure` on `Aliens DNA` returns
 * three lit `full` slots. What was stale was the row BODY.
 *
 * The mechanism, in one line: **`sync()` writes values into the inputs that exist and cannot create the ones
 * that do not.** `renderSlotBody` early-returns for a silent slot, appending `empty — nothing authored here` and
 * NO inputs at all — so a row that was silent under the outgoing preset keeps that placeholder over a fully lit
 * incoming figure, and `sync()` has nothing to write into. (16.17 deleted the `+ give it size` button that used
 * to sit under that copy; **the early return, and therefore this whole section's subject, is unchanged** — which
 * is exactly what the clauses below were written to guarantee across that rewrite.)
 *
 * ⚠️ **THE SECOND HALF IS WORSE AND WAS NOT REPORTED, ONLY MEASURED: a stale `tierOverride` (and a stale
 * simple BODY) WAS A SILENT DATA-LOSS PATH, AND 16.15 MADE IT UNREACHABLE RATHER THAN GUARDED.** The eight
 * simple controls could not hold a pulse, a wobble or a Z phase, so the moment one of them was edited
 * `applySimple` **zeroed all four modulator fields on all three axes** — exactly the lossy demotion the
 * `Simplify` button REFUSED to perform. Reached not through a wrong clause but through a presentation that
 * outlived the figure it described: **restoring the data and not the presentation.**
 *
 * ⚠️ **ITS FOUR CLAUSES ARE RETIRED HERE (16.15 / E106), AND THE REASON IS THE ONE THIS FILE OPENS WITH — a
 * dead assertion is one nobody can fail.** The tier is gone at the owner's instruction: every row now shows all
 * seven fields on all three axes, so `applySimple` (the only writer that could zero a field the user never
 * touched), `simpleOf`, `tierOf` and `tierOverride` are all deleted. The retired clauses measured
 * `litSimpleRow`, `demotionTriples`/`overrideTriples`, `worstLoss` and `applySimple`'s destructiveness.
 *
 * ⚠️ **THE MEASUREMENT IS KEPT AS PROSE BECAUSE IT IS THE ARGUMENT FOR THE DELETION, NOT A LOST CHECK:** over
 * the 399-preset basis this file printed WHEN IT WAS TAKEN, **92 982 ordered (A → B, row) triples** put simple controls over a row
 * whose data needs the full set, of which a much smaller subset needed a deliberate `Simplify` click — the wide
 * basis being the real exposure because the BODIES were not rebuilt either. **Two bases, stated, never summed**
 * (my own first probe used the narrow one and the figures were 3.4× apart). ⚠️ **AND THE BASIS ITSELF HAS MOVED
 * SINCE — this file prints 419 today (2026-09-19), not 399** — so the triple count is frozen at the basis it was
 * taken on and **may not be renormalised to the live one**: the settle batches that moved it deleted whole preset
 * OBJECTS, and which ones they were decides how many triples went with them. Re-run the probe or quote the pair. What replaces the four clauses is
 * §E's headline property, which the tiered design could not have stated: **a one-field edit writes exactly that
 * field — no projection, no collateral zeroing.** The class is now unreachable; do not re-add a projection
 * writer, and if one ever returns, §E is where its non-destructiveness is asserted.
 *
 * ⚠️ **THE STALE-BODY HALF STAYS LIVE and is the reason this section survives at all.** `renderSlotBody` still
 * early-returns on a silent slot, so the placeholder-over-a-lit-figure defect is still reachable — and 16.17
 * will REPLACE that placeholder with a per-level checkbox, at which point these clauses are what stops the
 * rebuild obligation being dropped in the rewrite.
 *
 * ⚠️ **`reset()` ALREADY HAD THE RULE RIGHT, IN A COMMENT, SINCE THE BUILD.** So this was never a missing
 * insight — it was one behaviour with two entry points where only one was complete, and the incomplete one is
 * the path a user takes constantly (`init()` runs ONCE per tab: `TabRegistry.show()` guards it with
 * `initialized`, so every later show calls only `activate()` → `sync()`). **A rule written into one entry
 * point's comment is not enforced at the other; that is what a checker is for.**
 */
/**
 * The brace-matched body of one declaration in an arbitrary source string. Returns `''` when the anchor misses.
 *
 * ⚠️ **THE `src` PARAMETER WAS ADDED BY §N'S SECOND SITTING AND THE REASON IS THE FINDING: this helper closed over
 * `tabSrc`, so every source-shaped clause in the file could only ever read ONE file** — and a user-facing string
 * turned out to live in `composer-model.ts` (`tierOf`'s reasons). A helper that silently fixes its own corpus
 * makes *"which files does this section read"* unanswerable at the call site. **`bodyOfTab` still means "in the
 * tab" and every existing call site is unchanged.**
 *
 * ⚠️ **AND THE FIRST `{` AFTER A TS DECLARATION IS NOT ALWAYS THE BODY — IT CAN BE THE RETURN TYPE.** The naive
 * version returned `tierOf`'s annotation `{ tier: FigureTier; reasons: string[] }` — 39 chars — and nothing else,
 * so a clause reading it saw ZERO string literals. **It had been correct for eleven sittings only because every anchor in
 * this file returns `void` or `HTMLElement`** — the defect was latent in the instrument, unreachable from the one
 * file it could read, and it surfaced on the first call that pointed it somewhere new. A brace that OPENS A TYPE
 * sits immediately after `:`, `|`, `&`, `<`, `,` or `(`; the body's brace does not. ⚠️ **What caught it was the
 * clause's own `tierCopy.length > 0` emptiness guard, not the assertion** — an absence test over an empty corpus
 * would have reported PASS, which is `CLAUDE.md`'s *anchor that matched nothing* in a new disguise: here the
 * anchor matched and the EXTRACTOR missed. **Assert a corpus is non-empty even when the anchor is known present.**
 *
 * ⚠️ **`>` IS NOT IN THE TYPE-POSITION SET AND THE NEAR-MISS IS WORTH THE LINE:** a brace after `>` closes a
 * generic (`): Foo<Bar> {`) or an arrow (`=> {`), and in BOTH cases the brace is the body. Listing `>` there
 * would skip the real body of any generic-returning function — the same failure this fix is for, one signature
 * shape along. A type brace opens after `:`, `|`, `&`, `<`, `,` or `(` and after nothing else.
 */
const bodyOfSrc = (src, decl) => {
  const start = src.indexOf(decl);
  if (start < 0) return '';
  /** The index one past the `}` matching the `{` at `i`, or -1 when unbalanced. */
  const close = (i) => {
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) return i + 1;
    }
    return -1;
  };
  for (let i = src.indexOf('{', start); i >= 0; i = src.indexOf('{', i)) {
    let j = i - 1;
    while (j >= 0 && /\s/.test(src[j])) j--;
    const prev = src[j];
    // A type-position brace (return type, union member, generic argument, destructured parameter) — skip it whole.
    const typeBrace = ':|&<,('.includes(prev);
    if (!typeBrace) {
      const end = close(i);
      return end < 0 ? src.slice(i) : src.slice(i, end);
    }
    const skip = close(i);
    if (skip < 0) return '';
    i = skip;
  }
  return '';
};
const bodyOfTab = (decl) => bodyOfSrc(tabSrc, decl);

// ⚠️ **ANCHOR HEALTH FIRST — `CLAUDE.md` records TWO `braceBody` anchors that matched nothing and so asserted
// nothing forever, passing green on whatever the file said.** Both bodies below are the subject of every
// clause in this section, so an empty one must fail HERE rather than silently exonerate the file.
const adoptBody = bodyOfTab('private adoptExternalFigure(): void');
const resetBody = bodyOfTab('reset(entryPreset: UnifiedPreset): void');
chk('ANCHOR: both entry points that replace the figure wholesale are locatable in the source',
  adoptBody.length > 0 && resetBody.length > 0,
  `adoptExternalFigure ${adoptBody.length} chars, reset ${resetBody.length} chars — an empty body would assert nothing`);

/*
 * ⚠️ **THE MEASURED PREMISE, and it is why a browser pass on one preset could not have found this
 * systematically.** The defect needs a PAIR: an outgoing preset whose row w is silent (or simple) and an
 * incoming one whose row w is not. So it is invisible on a single load and invisible on a reload of the same
 * preset — the user hit it by loading `New Figure` and then `Aliens DNA`, which is the shortest path to it.
 */
const rowFacts = presets.map(([n, p]) => {
  const m = readFigure(p);
  return { n, rows: m.slots.map(s => ({ silent: s.silent })) };
});
const withSilentRow = rowFacts.filter(f => f.rows.some(r => r.silent)).length;
let strandedPairs = 0, worstStranded = 0;
for (const a of rowFacts) {
  for (const b of rowFacts) {
    if (a === b) continue;
    let stranded = 0;
    for (let w = 0; w < MAX_WAVES; w++) {
      // A placeholder row over a lit incoming row: the row reads EMPTY, which is the user's report verbatim.
      if (a.rows[w].silent && !b.rows[w].silent) stranded++;
    }
    if (stranded > 0) { strandedPairs++; worstStranded = Math.max(worstStranded, stranded); }
  }
}
const orderedPairs = presets.length * (presets.length - 1);
chk('MEASURED: the stale-body exposure is a PAIR property, so no single-preset pass could have found it',
  withSilentRow > 0 && strandedPairs > 0 && worstStranded > 1,
  `${withSilentRow} of ${presets.length} presets have a silent row and so leave a placeholder behind; `
  + `${strandedPairs} of ${orderedPairs} ordered pairs strand at least one row, worst ${worstStranded} of ${MAX_WAVES}`);

/*
 * ⚠️ **THE ASSERTIONS ARE SOURCE-SHAPED AND SAY SO, exactly as §H does** — a tab needs a DOM, and standing up
 * jsdom for four clauses would buy less than it costs. They pin the NAMED OWNER (`adoptExternalFigure`) and
 * its two obligations. What they cannot see is an owner that is called and wrong; what they CAN see is the
 * shape that actually shipped, and each seed below is that shape or a plausible half-fix of it.
 *
 * ⚠️ **SEPARATE ORACLES, ONE PER CLAUSE, BECAUSE A CLAUSE THAT CAN ONLY FAIL WHEN A SIBLING ALREADY HAS
 * REPORTS ON NOTHING** — `CLAUDE.md`'s twelfth measuring-section defect.
 *
 * ⚠️ **`oracleOverride` IS RETIRED WITH THE TIER (16.15) AND ITS TWO SEEDS WITH IT.** It asserted that both
 * entry points cleared `tierOverride`; the field no longer exists, so the clause could not fail and the pair of
 * half-fix seeds it discriminated (rebuild-bodies-but-keep-the-override, and its inverse) no longer name two
 * reachable states. **The obligation that survives is singular: rebuild the BODIES** — so the two entry points
 * must still be asserted to AGREE, one obligation apiece rather than two.
 */
const oracleRouted = (s) => (/onExternalChange\(\(\)\s*=>\s*this\.adoptExternalFigure\(\)\)/.test(s) ? 0 : 1);
const oracleBodies = (b) => (/for\s*\(let w = 0; w < MAX_WAVES; w\+\+\)\s*this\.renderSlotBody\(w\);/.test(b) ? 0 : 1);

chk('the external-change callback routes into ONE named owner, never an inline body',
  oracleRouted(tabSrc) === 0,
  'an inline callback is where the two missing lines hid — a named owner is what a checker and a reader can both see');
seed('the callback inlined back to `rebuildModel(); sync();` — the shape that shipped and was reported',
  oracleRouted(tabSrc.replace(
    /onExternalChange\(\(\)\s*=>\s*this\.adoptExternalFigure\(\)\)/,
    'onExternalChange(() => { this.rebuildModel(); this.sync(); })')),
  'this is the ACTUAL defect, not an invented one');

chk('...and that owner REBUILDS every row body, because `sync()` cannot create an input that does not exist',
  oracleBodies(adoptBody) === 0,
  'without it a silent placeholder survives onto a lit figure and the row reads empty');
seed('the owner rebuilding the model but NOT the bodies',
  oracleBodies(adoptBody.replace(/for \(let w = 0; w < MAX_WAVES; w\+\+\) this\.renderSlotBody\(w\);/, '')),
  'the shape that shipped: the reported symptom, left in place by a fix that only touches the data');

// ⚠️ **AND THE TWO ENTRY POINTS MUST AGREE.** `reset()` is the precedent — it carried the line and a comment
// explaining it from the build. Asserting the pair keeps a future edit from fixing one path and drifting the
// other apart again, which is the failure this whole section is a post-mortem of.
// ⚠️ **16.17 WAS WRITTEN AGAINST THIS CLAUSE AND IT HELD: `+ give it size` is gone, the silent branch of
// `renderSlotBody` was rewritten around a per-level checkbox, and both entry points still rebuild the bodies.**
// The clause was named in advance as the one that had to survive that rewrite; the record of it surviving is
// worth more than the prediction was, because it is the only evidence the obligation was not re-derived.
chk('BOTH wholesale-replacement paths rebuild the bodies — `reset()` is the precedent, not an exception',
  oracleBodies(resetBody) === 0 && oracleBodies(adoptBody) === 0,
  'one behaviour, two entry points; the defect was having the rule in only one of them');
seed('`reset()` drifting away from the external path',
  oracleBodies(resetBody.replace(/for \(let w = 0; w < MAX_WAVES; w\+\+\) this\.renderSlotBody\(w\);/, '')),
  'a clause that only reads the NEW path would let the old one regress unobserved');

/*
 * ⚠️ **AND THERE ARE THREE OF THEM, NOT TWO — WHICH IS THIS SECTION'S OWN LESSON ARRIVING A SECOND TIME (16.17).**
 * `New Figure` replaces the figure wholesale exactly as `reset()` and `adoptExternalFigure()` do, and until 16.17
 * it did **not** rebuild the bodies: it wrote `seedFigure()`, called `rebuildModel()` and committed, so rows 1 and
 * 2 kept whatever body the OUTGOING preset had given them. **A pre-existing defect on the most-used button on the
 * tab, invisible to the two-entry-point clause above because the third entry point was never enumerated** —
 * `CLAUDE.md`: *three enumerations of one list make a missing entry structurally invisible*, and this is that in
 * a checker rather than in a source file.
 *
 * ⚠️ **AND THE OBLIGATION IS NOW A PAIR: rebuild the bodies AND reset the mutes.** A mute is presentation state
 * over a SPECIFIC figure, so a mute that outlives its figure is strictly worse than a stale body — the row shows
 * the incoming preset's real numbers, the checkbox reads *off*, and the very next `commit()` writes that level out
 * CLEARED. Silent data loss on a figure the user never touched. So the clause reads all three bodies for both
 * halves, and `New Figure` is anchored as a handler rather than a method because that is what it is.
 */
const newFigureBody = (tabSrc.match(/newBtn\.addEventListener\('click', \(\) => \{[\s\S]*?\n {4}\}\);/) ?? [''])[0];
chk('ANCHOR: the THIRD wholesale-replacement path — the `New Figure` handler — is locatable',
  newFigureBody.length > 0 && /seedFigure\(\)/.test(newFigureBody),
  `${newFigureBody.length} chars, containing the seed call — an anchor that matched nothing would exonerate the `
  + 'one path this clause was added for');
const oracleMutes = (b) => (/this\.resetMutes\(\);/.test(b) ? 0 : 1);
chk('ALL THREE wholesale-replacement paths rebuild the bodies AND switch every level back on',
  oracleBodies(adoptBody) === 0 && oracleBodies(resetBody) === 0 && oracleBodies(newFigureBody) === 0
  && oracleMutes(adoptBody) === 0 && oracleMutes(resetBody) === 0 && oracleMutes(newFigureBody) === 0,
  'one behaviour, THREE entry points — the two-path version of this clause was green while `New Figure` '
  + 'carried the very defect the section is a post-mortem of');
seed('`New Figure` left out of the list, i.e. the two-entry-point clause this one replaces',
  oracleBodies(newFigureBody.replace(/for \(let w = 0; w < MAX_WAVES; w\+\+\) this\.renderSlotBody\(w\);/, '')),
  'if `New Figure` did not need the rebuild, widening the clause from two paths to three would be decorative');
seed('a mute left set across a figure replacement — the worse half, because it EXPORTS the loss',
  ['adopt', 'reset', 'new'].filter((_, i) =>
    oracleMutes([adoptBody, resetBody, newFigureBody][i].replace(/this\.resetMutes\(\);/, '')) === 1).length,
  'a clause reading only the body rebuild would pass on all three paths while a stale mute emptied a level');

/*
 * ⚠️ **THE CLAUSE §E COULD NOT HOLD, BECAUSE `bodyOfTab` IS DEFINED HERE AND NOT THERE (line ~1195).** 16.15's
 * product change is that `renderSlotBody` has NO tier branch: every lit row appends the same set of rows, so the
 * source-shaped half of *"a one-field edit writes exactly that field"* belongs wherever the extractor lives.
 * **This is a placement fact, not a design one — do not "move it back to §E" without moving `bodyOfTab` too.**
 */
const slotBody = bodyOfTab('private renderSlotBody(slot: number): void');
// ⚠️ **THE ORACLE STRIPS COMMENTS FIRST, because every deletion in 16.15 left its lesson behind as prose** — a
// raw `/tier/` scan over this body would fail on the very comments that record why the tier is gone. Same class
// as §N's copy scan reading source text instead of string literals.
const oracleNoTier = (b) => {
  const code = b.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
  const rows = (code.match(/this\.(axisRow|dialRow|breatheRow)\(/g) ?? []).length;
  return rows >= 9 && !/tier|simple/i.test(code) ? 0 : 1;
};
chk('ANCHOR: `renderSlotBody` is locatable and appends the unconditional row set (no tier branch)',
  slotBody.length > 0 && oracleNoTier(slotBody) === 0,
  `${slotBody.length} chars, ${(slotBody.match(/this\.(axisRow|dialRow|breatheRow)\(/g) ?? []).length} `
  + 'row builders, no tier/simple identifier outside comments');
seed('a tier branch reintroduced into the body, i.e. two presentations of one row again',
  oracleNoTier(`${slotBody}\n    if (this.tierFor(slot) === 'simple') return;`),
  'the projection writer is gone, so a second presentation would have nothing to route an edit through');

// ===================================================================================================
console.log('\n§K — the ONE RATIO CONTROL and its shared base rule (16.6 / E97, re-pointed by 16.11 / E102)');
// ---------------------------------------------------------------------------------------------------
/*
 * ⚠️ **THIS SECTION'S FOUR SOURCE-SHAPED CLAUSES ALL FAILED AT ONCE ON CORRECT CODE, AND THE REPAIR IS WHERE
 * THE SET NOW LIVES RATHER THAN A NEW REGEX.** 16.11 merged the gallery and the Tuner into one listbox, which
 * renamed `galleryRow`/`ensureGalleryScores`/`paintGalleryTiles` and deleted `tunerRow` — every `bodyOfTab`
 * anchor here went to 0 chars and the ANCHOR clause did its job by failing. That is `CLAUDE.md`'s
 * *"a behaviour-neutral rename breaks a text-pattern grep — read the assertion before believing a failure is a
 * regression."* ⚠️ **The lesson is not "re-point faster": it is that a set of three windings had no business
 * being readable only through a UI method's body.** `RATIO_ROWS` now lives in `composer-model.ts` and this
 * section IMPORTS it, so the measured clauses below survive any future rename of the control that draws it.
 * **Do not move the set back into the tab to "keep the UI together."**
 *
 * ⚠️ **THE CACHE-INVALIDATION CLAUSE WAS RETIRED RATHER THAN RE-POINTED, WITH ITS REASON RECORDED HERE.** It
 * asserted that a PLANE CHANGE drops the score cache; 16.9 deleted the notion of a selected plane, so the event
 * it named is unreachable and no edit could ever violate it. **A dead assertion is worse than a missing one —
 * it occupies the slot the real check would take** (this file's own opening rule). What replaced it is §N's
 * plane-invariance clause: the cache is now `[row][plane]` and complete, so the property that matters is that
 * every plane is present, not that a transition clears anything. **Do not resurrect a plane-change clause.**
 *
 * ⚠️ **THE SECTION EXISTS FOR THE BASE RULE, NOT FOR THE THUMBNAILS.** 16.5's Tuner shipped with
 * `base = min(nonzero winding)`, which is NOT idempotent: re-picking the same ratio COMPOUNDS it, because the
 * new minimum is the old base times the ratio's own minimum. Measured witness, from this file's own data:
 * `3:2:5` over a `7:7:7` slot gives `21:14:35`, and clicking the SAME tile again gives `42:28:70`. A gallery
 * would have made that defect ordinary — sixteen one-click ways to reach it instead of one dropdown — so
 * 16.6's first obligation was to fix the rule, and to fix it in **ONE** place both controls call.
 *
 * ⚠️ **`ratioBase`'s gcd IS the fix and idempotency IS the property.** `base = gcd(|nonzero windings|)` makes
 * `applyRatio(applyRatio(x, r), r) === applyRatio(x, r)` for every ratio whose components are coprime — and for
 * one that is not (`2:2:0`), the gcd absorbs the common factor exactly once. So the assertion below is not "the
 * numbers look right": it is that the operation is a PROJECTION, which is the only property that makes a
 * clickable gallery safe.
 *
 * ⚠️ **AND THE TILE SET'S DISTINCTNESS IS ASSERTED IN 3D, WITH THE PER-PLANE COLLISIONS RECORDED RATHER THAN
 * ASSERTED AWAY (invariant 29).** Sixteen tiles project onto only 11 distinct curves in XY, 6 in XZ and 7 in
 * YZ — which is precisely why every tile carries a text caption, and why the caption's CSS comment calls itself
 * load-bearing. A future edit that made two tiles identical **in 3D** would be a silently duplicated control;
 * one that makes two identical in a single plane is the shipped, labelled state.
 */
const ratioRowBody = bodyOfTab('private ratioRow(slot: number): HTMLElement');
const ratioScoresBody = bodyOfTab('private ensureRatioScores(): ScoreResult[][]');
const paintBoxesBody = bodyOfTab('private paintRatioBoxes(): void');
const pickRatioBody = bodyOfTab('private pickRatio(box: RatioBox, i: number): void');
chk('ANCHOR: the merged control\'s four methods are all locatable in the source',
  ratioRowBody.length > 0 && ratioScoresBody.length > 0 && paintBoxesBody.length > 0
  && pickRatioBody.length > 0,
  `ratioRow ${ratioRowBody.length}, ensureRatioScores ${ratioScoresBody.length}, `
  + `paintRatioBoxes ${paintBoxesBody.length}, pickRatio ${pickRatioBody.length} chars — an empty body asserts nothing`);
// ⚠️ **AND THE OLD NAMES MUST BE GONE, ASSERTED EXPLICITLY — otherwise 16.11's merge could be half-applied**
// (a second surface left behind is the exact defect the owner reported: *"both the grid of shapes to select and
// the Tuner dropdown are basically setting the same three winding values"*). A rename that left `tunerRow` alive
// would pass every clause below while the tab still shipped two ratio controls.
chk('...and the two surfaces 16.11 merged are GONE, not merely renamed',
  bodyOfTab('private tunerRow(slot: number): HTMLElement') === ''
  && bodyOfTab('private galleryRow(slot: number): HTMLElement') === '',
  'a surviving second ratio surface is the reported defect, and no measured clause here could see it');

/*
 * ⚠️ **THE COMPOUNDING WITNESS IS MEASURED AND NAMED, BECAUSE THE SEED IS THE SHIPPED DEFECT AND NOT AN
 * INVENTION.** `minBase` is 16.5's rule verbatim; `gcdBase` is the model's. Both are applied to the same cells
 * twice, and the seed is that the first one MOVES on the second application. ⚠️ **The seed's oracle counts
 * SECOND-APPLICATION drift, not first-application difference** — the two rules agree on plenty of slots, so a
 * clause comparing one application would pass on most of the library while the defect stayed live.
 */
const minBase = (windings) => {
  const nz = windings.map(Math.abs).filter(v => v > 0);
  return nz.length ? Math.min(...nz) : 1;
};
const applyRatioWith = (baseOf, axes, ratio) => {
  const base = baseOf(axes.map(c => c.winding));
  for (let a = 0; a < AXES; a++) axes[a].winding = base * ratio[a];
};
const cellsOf = (wave) => readFigure({ generators: { waves: [wave], particleCount: 0 } }).slots[0].axes;

/*
 * ⚠️ **EVERY CLAUSE BELOW RUNS OVER THE SHIPPED MERGED SET, NOT OVER `RATIO_TILES`, AND THAT WIDENS THE BASIS
 * — so the counts here are NOT comparable to the ones the pre-16.11 output printed.** `RATIO_ROWS` is the list
 * a user can actually pick from; a clause scoped to one of its two sources would exonerate the other. The union
 * is counted, never written: `RATIO_TILES` and `RATIO_NAMED` overlap in exactly one entry (`1:1:1`), which the
 * next clause asserts rather than assumes. ⚠️ **`CLAUDE.md`: state the basis, and do not read the change in
 * these figures as an event.**
 */
const RATIO_SET = RATIO_ROWS.map(r => r.ratio);
chk('BASIS: the shipped set is the counted UNION of the gallery tiles and the named ratios, overlapping in one',
  RATIO_ROWS.length === RATIO_TILES.length + RATIO_NAMED.length - 1
  && new Set(RATIO_SET.map(r => r.join(':'))).size === RATIO_ROWS.length,
  `${RATIO_TILES.length} tiles + ${RATIO_NAMED.length} named - ${RATIO_TILES.length + RATIO_NAMED.length
    - RATIO_ROWS.length} shared = ${RATIO_ROWS.length} rows, all distinct as ratios`);
/*
 * ⚠️ **THE SEED IS THE LITERAL, BECAUSE THE LITERAL IS WHAT WAS TEMPTING TO WRITE.** It rebuilds the union with
 * one extra entry appended to a source and asserts the count MOVES — which is exactly what a hardcoded `20` in
 * the tab, the CSS, the plan or this file would fail to do, silently and in the passing direction.
 */
seed('a hardcoded union size, i.e. a count that does not move when a source list does',
  (() => {
    const keys = new Set([...RATIO_TILES, ...RATIO_NAMED.map(r => r.ratio), [9, 7, 5]].map(r => r.join(':')));
    return keys.size === RATIO_ROWS.length ? 0 : 1;
  })(),
  'if the union were insensitive to its sources, counting it would buy nothing over writing the number');

let gcdIdempotent = 0, gcdCases = 0, minDrift = 0;
let worstDrift = '';
for (const s of liveSlots) {
  for (const ratio of RATIO_SET) {
    // The gcd rule, twice, through the SHIPPED helper.
    const a1 = cellsOf(s.wave);
    applyRatio(a1, ratio);
    const once = a1.map(c => c.winding);
    applyRatio(a1, ratio);
    gcdCases++;
    if (a1.every((c, i) => c.winding === once[i])) gcdIdempotent++;
    // 16.5's rule, twice, on a fresh copy of the same cells.
    const a2 = cellsOf(s.wave);
    applyRatioWith(minBase, a2, ratio);
    const mOnce = a2.map(c => c.winding);
    applyRatioWith(minBase, a2, ratio);
    if (a2.some((c, i) => c.winding !== mOnce[i])) {
      minDrift++;
      if (!worstDrift) worstDrift = `${s.name} slot ${s.i} ${ratio.join(':')}: `
        + `${cellsOf(s.wave).map(c => c.winding).join(':')} -> ${mOnce.join(':')} -> ${a2.map(c => c.winding).join(':')}`;
    }
  }
}
chk('picking a ratio is IDEMPOTENT — clicking the same tile twice changes nothing (the gcd base rule)',
  gcdCases > 0 && gcdIdempotent === gcdCases,
  `${gcdIdempotent} of ${gcdCases} (live slot x tile) picks are fixed points of a second identical pick`);
seed('16.5\'s shipped `min(nonzero)` base, which COMPOUNDS on a re-click',
  minDrift,
  `if the two rules agreed everywhere this property would assert nothing (witness: ${worstDrift || 'none'})`);

/*
 * ⚠️ **AND THE RULE MUST HAVE EXACTLY ONE OWNER IN THE SOURCE, or the fix decays back into two copies.** After
 * 16.11 there is one writer — `pickRatio` — and it must call `applyRatio` and compute no base of its own. This
 * is the one source-shaped clause in the section and it says so: it can convict a second copy, not a wrong
 * `ratioBase`, which is what the measured clauses above are for.
 *
 * ⚠️ **THE CLAUSE IS NOW SCOPED TO THE WRITER AND SEPARATELY TO THE WHOLE TAB, BECAUSE THE MERGE MADE THE
 * FIRST HALF WEAKER.** With two controls, "neither inlines a base" was a real statement about two bodies; with
 * one, a body-scoped test could be satisfied by a base computed anywhere else in the file. So the second half
 * asserts that `Math.min(` over windings appears NOWHERE in the tab. `paintRatioBoxes` legitimately calls
 * `ratioBase` to LABEL the button — reading the base is not computing one, which is why the pattern named is
 * `Math.min(...` and not `ratioBase`.
 */
const oracleOneOwner = (s) => (
  /applyRatio\(this\.model\.slots\[box\.slot\]!\.axes, r\.ratio\)/.test(s)
  && !/Math\.min\(\.\.\./.test(s) ? 0 : 1);
chk('the ONE ratio control routes through the ONE shared owner, and computes no base of its own',
  oracleOneOwner(pickRatioBody) === 0,
  'a second copy of the base rule is a second chance to reintroduce the compounding');
chk('...and no second base rule is computed anywhere else in the tab either',
  !/Math\.min\(\.\.\.[\s\S]{0,80}winding/.test(tabSrc),
  'with one control left, a body-scoped clause alone could be satisfied by a base computed elsewhere');
seed('the control inlining its own `Math.min(...)` base instead of calling the shared owner',
  oracleOneOwner(pickRatioBody.replace(
    /applyRatio\(this\.model\.slots\[box\.slot\]!\.axes, r\.ratio\)/,
    'const base = Math.min(...axes.map(c => c.winding).filter(v => v > 0)); void base')),
  'this is 16.5\'s defect re-entering through the new control');

/*
 * ⚠️ **THE NON-INTEGER FALLBACK IS A REAL LIBRARY CASE, NOT A DEFENSIVE BRANCH.** `gcd` is only defined over
 * integers, and the library authors non-integer windings (measured: every one of them is `0.5` or `112.5`). The
 * rule falls back to `base = 1`, which makes the tile's ratio the literal winding triple — the only answer that
 * is both defined and honest, since there is no whole number the authored values are multiples of.
 */
const nonIntegerSlots = slots.filter(s => s.wave.axes.some(a => !Number.isInteger(a.fm.base ?? 0)));
let fallbackOk = 0;
for (const s of nonIntegerSlots) {
  const axes = cellsOf(s.wave);
  applyRatio(axes, [2, 3, 0]);
  if (axes[0].winding === 2 && axes[1].winding === 3 && axes[2].winding === 0) fallbackOk++;
}
chk('MEASURED: a non-integer winding falls back to `base = 1`, the only defined answer — and the case is real',
  nonIntegerSlots.length > 0 && fallbackOk === nonIntegerSlots.length,
  `${nonIntegerSlots.length} slots carry a non-integer winding (all ${[...new Set(nonIntegerSlots
    .flatMap(s => s.wave.axes.map(a => a.fm.base ?? 0)).filter(v => !Number.isInteger(v)))].join(', ')}); `
  + `all ${fallbackOk} take the ratio literally`);
/*
 * ⚠️ **THE SEED HERE CORRECTED MY OWN CLAIM ABOUT WHY THE FALLBACK IS NEEDED, WHICH IS THE ONLY REASON IT IS
 * WORTH RUNNING.** I first seeded "a float `gcd` returns a fraction and makes the pick UNREPEATABLE" and the
 * seed did not fail: `a % b` on `0.5`/`112.5` is exact in binary floating point, so Euclid's algorithm
 * terminates and IS idempotent on this data. The defect a missing fallback actually produces is different and
 * narrower — the pick stops being the ratio. `gcd(0.5, 1) = 0.5`, so clicking `2:3:0` would author `1:1.5:0`:
 * a caption that says one thing and a control that writes another. **A seed that does not fail is a claim about
 * the seed's reasoning first — re-derive the defect rather than strengthening the assertion around it.**
 */
seed('a `gcd` applied to non-integers, so the pick is no longer the RATIO the caption names',
  (() => {
    const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
    let n = 0;
    for (const s of nonIntegerSlots) {
      const nz = s.wave.axes.map(a => Math.abs(a.fm.base ?? 0)).filter(v => v > 0);
      if (!nz.length) continue;
      const base = nz.reduce((acc, v) => gcd2(acc, v), 0);
      if ([2, 3, 0].some((r, i) => Math.abs(base * r - [2, 3, 0][i]) > 1e-12)) n++;
    }
    return n;
  })(),
  'if no non-integer winding existed the fallback would be unreachable and this clause decorative');

/*
 * ⚠️ **ROW DISTINCTNESS IN 3D, WITH THE PER-PLANE COLLISIONS MEASURED AND PRINTED.** The thumbnails are drawn
 * from the SHIPPED `computeScore`, on the same synthetic unit-size one-wave figure the tab builds, so this reads
 * the pictures a user actually sees. Two rows identical in 3D would be two rows doing the same thing; two
 * identical in one plane is the shipped state the captions exist for (invariant 29).
 *
 * ⚠️ **THE BASIS IS THE MERGED SET NOW, WHICH IS WHY THESE COUNTS DIFFER FROM THE PRE-16.11 OUTPUT — and the
 * per-plane clause got STRICTER for free.** 16.6's gallery drew ONE plane per tile, so a per-plane collision was
 * a real ambiguity a caption had to resolve. 16.11 draws all three per row, so the collisions now have to be
 * simultaneous in all three to be ambiguous at all — and that is the clause below. **The caption is still
 * load-bearing; three planes narrow the ambiguity, they do not remove it.**
 */
const tileWaves = (ratio) => [{
  speed: 0,
  axes: [0, 1, 2].map(q => ({
    phase: q === 1 ? 90 : 0,
    am: { base: 1, amplitude: 0, frequency: 0 },
    fm: { base: ratio[q], amplitude: 0, frequency: 0 },
  })),
}];
const tileKey3 = (ratio) => {
  const p = evaluateAt3(tileWaves(ratio), 0, 240);
  return Array.from(p, v => v.toFixed(4)).join(',');
};
const distinct3D = new Set(RATIO_SET.map(tileKey3)).size;
const perPlane = Object.keys(PLANE_AXES).map(pl => ({
  pl,
  n: new Set(RATIO_SET.map(r => Array.from(computeScore(tileWaves(r), pl).path, v => v.toFixed(4)).join(','))).size,
}));
chk('every one of the merged rows is a DISTINCT figure in 3D, so no two are the same control',
  distinct3D === RATIO_ROWS.length,
  `${distinct3D} of ${RATIO_ROWS.length} distinct in 3D; per plane only `
  + `${perPlane.map(p => `${p.pl} ${p.n}`).join(', ')} — which is why every row carries a caption`);
seed('a duplicated entry in the merged set, i.e. two rows that are one control',
  RATIO_ROWS.length - new Set([...RATIO_SET.slice(0, RATIO_ROWS.length - 1), RATIO_SET[0]].map(tileKey3)).size,
  'a set whose members were already indistinguishable would make this clause unfalsifiable');
// ⚠️ The per-plane collisions are asserted to EXIST rather than asserted away: if a future edit made every row
// distinct in every plane the captions could be dropped, and this clause is where that would surface.
chk('MEASURED: the rows COLLIDE in every single plane, which is what makes the caption load-bearing',
  perPlane.every(p => p.n < RATIO_ROWS.length),
  `XY/XZ/YZ distinct: ${perPlane.map(p => p.n).join('/')} of ${RATIO_ROWS.length}`);
/*
 * ⚠️ **AND THE THREE PLANES TOGETHER MUST DISAMBIGUATE STRICTLY MORE THAN ANY ONE OF THEM — the clause 16.11
 * earns and 16.6 could not have stated.** This is invariant 29 as a UI property from the other side: the reason
 * every row draws XY, XZ and YZ is that a single plane loses rows to collisions, so the union of the three
 * projections is asserted to be a finer partition than the best single plane. If it were not, the third canvas
 * would be decoration and 16.10's own argument for the triple would be weaker than it claims.
 */
const perRowTriple = new Set(RATIO_SET.map(r => Object.keys(PLANE_AXES)
  .map(pl => Array.from(computeScore(tileWaves(r), pl).path, v => v.toFixed(4)).join(',')).join('|'))).size;
chk('MEASURED: the three planes TOGETHER separate more rows than the best single plane does',
  perRowTriple > Math.max(...perPlane.map(p => p.n)),
  `all three: ${perRowTriple} of ${RATIO_ROWS.length}; best single plane: `
  + `${Math.max(...perPlane.map(p => p.n))} — which is what the third canvas buys`);

/*
 * ⚠️ **AND THE CACHE IS THE ONE PERFORMANCE PROPERTY, BECAUSE THE ARGUMENT IS A RATE (invariant 8) AND NOT A
 * PER-DRAW COST.** `ensureRatioScores` must be the only `computeScore` caller in the ratio path, and the repaint
 * — which `sync()` calls on every keystroke — must rasterise from it. With 20 rows × 3 planes × 3 slots, a
 * recompute inside the repaint is ~43 000 sample evaluations per keypress.
 *
 * ⚠️ **A PLANE-CHANGE INVALIDATION CLAUSE USED TO SIT HERE AND WAS RETIRED, NOT RE-POINTED — the reason is in
 * this section's header and it is the interesting half of the repair.** The cache is now `[row][plane]` and
 * complete, so there is nothing a transition could make stale.
 */
const oracleCache = (s) => (/if \(this\.ratioScores\) return this\.ratioScores;/.test(s) ? 0 : 1);
const oracleNoRecompute = (s) => (/computeScore\(/.test(s) ? 1 : 0);
chk('the ratio scores are CACHED, and the repaint rasterises from the cache rather than recomputing',
  oracleCache(ratioScoresBody) === 0 && oracleNoRecompute(paintBoxesBody) === 0,
  'a `computeScore` inside the repaint is invariant 8 reached through a diagram instead of a buffer');
seed('the cache short-circuit removed, i.e. a full recompute per repaint',
  oracleCache(ratioScoresBody.replace(/if \(this\.ratioScores\) return this\.ratioScores;/, '')),
  'the shape a later "simplify" edit would produce');
seed('a `computeScore` call moved into the repaint path',
  oracleNoRecompute(`${paintBoxesBody}\n  computeScore(this.model.slots[0].axes, 'xy');`),
  'the same defect from the other direction — the cache present but bypassed');
/*
 * ⚠️ **THE RETIRED SEED'S OWN LESSON IS KEPT BECAUSE IT IS ABOUT SEEDS AND NOT ABOUT PLANES.** Its first
 * version was `tabSrc.replace(/this\.galleryScores = null;\n/, '')` — but that string occurred TWICE
 * (`dispose()` cleared it too) and a non-global `replace` takes the FIRST, which was the one in `dispose`. So
 * the mutation deleted an unrelated line, the handler it meant was untouched, and the seed reported NOT CAUGHT
 * on a perfectly correct file. **Anchor a source mutation on the region it means, never on a string that may
 * appear elsewhere in the file** — `CLAUDE.md`'s *"a SKIPPED mutation reads exactly like a caught one."*
 *
 * What replaces it is a claim the new shape CAN fail: the cache must cover every plane the UI draws, which is
 * the only way `[row][plane]` can go stale now. A version that computed one plane and reused it for all three
 * would draw XY curves under an XZ label — the same user-visible defect the retired clause guarded, reached
 * through the surviving mechanism.
 */
const oracleAllPlanes = (s) => (/PLANES\.map\(plane => computeScore\(/.test(s) ? 0 : 1);
chk('...and it covers EVERY plane the UI draws, which is the only way the grid can now go stale',
  oracleAllPlanes(ratioScoresBody) === 0,
  'one plane computed and reused for three would draw XY curves under an XZ label');
seed('a single-plane cache reused for all three thumbnails',
  oracleAllPlanes(ratioScoresBody.replace(
    /PLANES\.map\(plane => computeScore\(/,
    'PLANES.map(() => computeScore(')),
  'this is the retired plane-staleness defect reached through the shape that actually exists now');

/*
 * ⚠️ **THE SET'S LIBRARY COVERAGE IS MEASURED HERE BECAUSE IT WAS QUOTED FROM A PROBE IN THREE PLACES AND EVERY
 * ONE OF THEM WAS ON A DIFFERENT BASIS.** The tile set is chosen for LEGIBILITY, not frequency, and the
 * argument for that trade rests on a number — how much coverage the choice gives up — so the number needs an
 * owner that re-runs. Three bases have now produced three figures for one quantity (`754 of 854` from a
 * per-slot probe, `418 of 478` from a `readFigure`-silent probe, and this clause's own), which is exactly the
 * `CLAUDE.md` situation: **state the basis with the figure, and do not read a delta as an event.** The clause
 * asserts the TRADE (the frequency-optimal set of the same size covers strictly more than the shipped one does)
 * rather than either figure, because the trade is what the design decision claims and the figures are what move.
 *
 * ⚠️ **AND THE TRADE IS ASSERTED AT THE SHIPPED SET'S OWN SIZE, WHICH IS WHY THE COMPARISON SURVIVED THE
 * MERGE.** 16.11 grew the list from 16 rows to `RATIO_ROWS.length`, so a clause that had compared against "the
 * top 16" would now be comparing sets of different sizes and its inequality would mean nothing. The top-N is
 * taken at `RATIO_ROWS.length` — a bigger list must still be beaten by the frequency-optimal list of the SAME
 * length, or the legibility argument has quietly become a coverage argument.
 */
{
  const norm = (w) => {
    const nz = w.map(Math.abs).filter(x => x > 0 && Number.isInteger(x));
    if (!nz.length) return w.join(':');
    const g = nz.reduce((a, b) => { let x = a, y = b; while (y) { [x, y] = [y, x % y]; } return x; });
    return w.map(x => Math.round(Math.abs(x) / g)).join(':');
  };
  const keys = liveSlots.map(s => norm(s.wave.axes.map(a => a.fm.base ?? 0)));
  const freq = new Map();
  for (const k of keys) freq.set(k, (freq.get(k) ?? 0) + 1);
  const top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, RATIO_ROWS.length);
  const topCov = top.reduce((a, [, n]) => a + n, 0);
  const setKeys = new Set(RATIO_SET.map(t => norm([...t])));
  const setCov = keys.filter(k => setKeys.has(k)).length;
  // Several of the measured top entries are dense discs (`1:1:98` and friends) and one is `0:0:0`, the empty slot.
  const undrawable = top.filter(([k]) => k === '0:0:0'
    || (Number(k.split(':')[2]) >= 32 || Number(k.split(':')[1]) >= 32 || Number(k.split(':')[0]) >= 32)).length;
  chk('MEASURED: the shipped set gives up real coverage for legibility — and the trade is asserted, not a figure',
    topCov > setCov && undrawable >= 5,
    `over ${liveSlots.length} live slots on THIS checker's basis: the measured top ${RATIO_ROWS.length} `
    + `by frequency covers ${topCov} (${(100 * topCov / liveSlots.length).toFixed(1)}%) against the shipped `
    + `set's ${setCov} (${(100 * setCov / liveSlots.length).toFixed(1)}%) — but ${undrawable} of that top `
    + `${RATIO_ROWS.length} are dense discs or the empty slot (${top.filter(([k]) => k === '0:0:0'
      || k.split(':').some(x => Number(x) >= 32)).map(([k]) => k).join(', ')}), which is the whole argument`);
  /*
   * ⚠️ **THE MERGE MUST HAVE BOUGHT COVERAGE AS WELL AS REMOVING A SURFACE, AND THAT IS NOT SELF-EVIDENT — the
   * five named ratios were chosen as musical relationships, not by frequency, so four of them adding nothing was
   * a live possibility.** If the union covered no more live slots than the tiles alone, merging would have been
   * pure subtraction and the extra rows would be cost with no benefit. Measured here rather than assumed.
   */
  const tileOnlyCov = keys.filter(k => new Set(RATIO_TILES.map(t => norm([...t]))).has(k)).length;
  chk('MEASURED: the merge WIDENED library coverage — the named ratios are not a subset of the tiles',
    setCov > tileOnlyCov,
    `merged ${setCov} of ${liveSlots.length} against the ${RATIO_TILES.length} tiles alone at ${tileOnlyCov}`);
}

// ===================================================================================================
console.log('\n§L — the PHASE DIAL in effective degrees (16.7 / E98)');
// ---------------------------------------------------------------------------------------------------
/*
 * ⚠️ **THIS IS THE TAB'S ONE CONTROL WHOSE DISPLAYED UNIT IS NOT ITS STORED UNIT, AND THE INVERSION IS THE
 * WHOLE SECTION.** The engine's argument is `(n + phase) * fm`, **not** `n * fm + phase`, so the shift a user
 * sees is `wrap360(phase x winding)` and the dial must solve `phase = target / winding` backwards. §D already
 * measures that the effective shift differs from the authored degrees on hundreds of axes; what §L adds is that
 * the INVERSE is exact, that it REFUSES the one case where it is undefined, and — since 16.15 — that a dial
 * writes the phase of the axis it names and nothing else.
 *
 * ⚠️ **`winding = 0` IS ALGEBRA, NOT A HEURISTIC: no phase whatsoever shifts that axis**, so the dial is
 * disabled with a reason rather than clamped or hidden. ⚠️ **And it must NOT be disabled on `size = 0`** — the
 * stored phase there is real and becomes visible the moment the axis is given size, so greying it would tell
 * the user a working control is broken. Both halves are asserted, and both are seeded.
 *
 * ⚠️ **THE TWO ANCHORS BELOW BOTH LOST A `tier` PARAMETER IN 16.15 AND THE ANCHOR CLAUSE IS WHAT REPORTED IT —
 * a signature is part of a source-shaped anchor, so a DELETED ARGUMENT breaks it exactly as a rename does.**
 * `CLAUDE.md`: read the assertion before believing a failure is a regression. Both were 0 chars, which would have
 * silently exonerated every clause reading them had the anchor clause not existed.
 */
const dialRowBody = bodyOfTab('private dialRow(slot: number): HTMLElement');
const installDialBody = bodyOfTab('private installDial(dial: Dial): void');
const paintDialBody = bodyOfTab('private paintDial(dial: Dial): void');
chk('ANCHOR: the dial\'s three methods are all locatable in the source',
  dialRowBody.length > 0 && installDialBody.length > 0 && paintDialBody.length > 0,
  `dialRow ${dialRowBody.length}, installDial ${installDialBody.length}, paintDial ${paintDialBody.length} chars`);

/*
 * ⚠️ **THE ROUND TRIP IS MEASURED OVER EVERY LIVE AXIS AT EVERY 15 DEGREE TARGET, AND THE ORACLE IS THE
 * ENGINE'S OWN EXPRESSION RE-DERIVED HERE** (`wrap360(phase * winding)`), not `effectivePhase` — reading the
 * model's own derived field back would test the field against itself. The detents the dial snaps to (0/90/180/
 * 270) are inside this grid by construction, so the control's own values are covered rather than merely
 * bracketed.
 */
const DIAL_TARGETS = [];
for (let d = 0; d < 360; d += 15) DIAL_TARGETS.push(d);
// The four the dial snaps to, listed here rather than imported: the tab's own `DIAL_DETENTS` is module-private,
// and a checker that imported it would assert the constant against itself instead of against the library.
const DIAL_DETENT_SET = [0, 90, 180, 270];
let dialCases = 0, dialExact = 0, dialWorst = 0, dialRefused = 0, dialZeroAxes = 0;
for (const s of liveSlots) {
  for (const cell of cellsOf(s.wave)) {
    if (cell.winding === 0) { dialZeroAxes++; continue; }
    for (const target of DIAL_TARGETS) {
      const phase = phaseForTarget(target, cell.winding);
      if (phase === null) { dialRefused++; continue; }
      dialCases++;
      const err = Math.abs(wrap360(phase * cell.winding) - target);
      // 360 and 0 are the same angle; a target of 0 can come back as 359.999... on a fractional winding.
      const wrapped = Math.min(err, Math.abs(err - 360));
      dialWorst = Math.max(dialWorst, wrapped);
      if (wrapped < 1e-9) dialExact++;
    }
  }
}
chk('the dial\'s inversion `target -> phase -> wrap360(phase x winding)` is EXACT on every live axis',
  dialCases > 0 && dialExact === dialCases,
  `${dialExact} of ${dialCases} (live axis x 15-degree target) round trips exact; worst error `
  + `${dialWorst.toExponential(3)}; ${dialZeroAxes} live-slot axes carry winding 0 and are excluded by algebra`);
seed('a dial that treats the stored phase AS the shift, i.e. ignores the winding multiplication',
  (() => {
    let n = 0;
    for (const s of liveSlots) for (const cell of cellsOf(s.wave)) {
      if (cell.winding === 0) continue;
      for (const target of DIAL_TARGETS) {
        const err = Math.abs(wrap360(target * cell.winding) - target);
        if (Math.min(err, Math.abs(err - 360)) > 1e-9) { n++; break; }
      }
    }
    return n;
  })(),
  'this is `PSSS_UI_extension_ideas.md`\'s own trap and `Sliders`\' `Symmetry` defect, seeded here so the dial cannot inherit it');

/*
 * ⚠️ **THE REFUSAL AT `winding = 0` IS ASSERTED AS A REFUSAL, NOT AS A VALUE**, and the seed is the division
 * that happens anyway — which produces `Infinity` or `NaN` and would be STORED, poisoning the slot's phase for
 * the session. This is the shape invariant 20 warns about in a different medium: an arithmetic guard that lets
 * a non-finite through reads exactly like one that works.
 */
const zeroWindingLiveAxes = liveSlots.flatMap(s => cellsOf(s.wave)).filter(c => c.winding === 0).length;
chk('MEASURED: `winding = 0` is REFUSED (`null`), never divided — and the case is a real part of the library',
  zeroWindingLiveAxes > 0 && DIAL_TARGETS.every(t => phaseForTarget(t, 0) === null),
  `${zeroWindingLiveAxes} axes on live slots carry winding 0, where NO phase can shift the axis at all`);
seed('a dial that divides anyway, storing `Infinity`/`NaN` into the slot\'s phase',
  DIAL_TARGETS.filter(t => !Number.isFinite(t / 0) || Number.isNaN(0 / 0)).length,
  'a non-finite phase reaches the shader as a NaN coordinate and the slot stops drawing');
// The other half, and it is the one a "defensive" edit would break: a zero SIZE must leave the dial live.
const oracleInertRule = (s) => (/cell\.winding === 0/.test(s) && !/cell\.size === 0/.test(s) ? 0 : 1);
chk('...and `inert` means winding 0 ONLY — a zero-size axis keeps a working dial, because its phase is real',
  oracleInertRule(paintDialBody) === 0,
  'greying a zero-size axis would report a working control as broken; the row\'s own readout owns that case');
seed('the inert test widened to `size === 0`, the plausible over-defensive edit',
  oracleInertRule(`${paintDialBody}\n    if (cell.size === 0) canvas.classList.add('inert');`),
  'the row already says `no size — winding inert there`; the dial saying it too would be wrong, not redundant');

/*
 * ⚠️ **THE THIRD PROPERTY INVERTED BY 16.15, AND THE INVERSION IS THE FINDING.** Until 16.15 a dial on a
 * `simple` row wrote X as `phaseX` and Y as a TWIST relative to the new X, because the eight simple controls WERE
 * the slot and a direct `axes[1].phase =` produced a triple the row could not describe. The old clause asserted
 * that derived write and its two-branch source shape — **and with the tier gone the derived write is exactly the
 * defect.** Dragging the Y dial moved a number computed from X; the tier forced it, so it was never a feature.
 *
 * ⚠️ **SO THIS IS NOT A RETIREMENT BUT A REVERSAL: the same subject, the opposite assertion.** What replaces it
 * is the property §E states for the numeric fields, applied to the one control that is not a number box: **a dial
 * writes the phase of the axis it belongs to and touches nothing else on any other axis.** That is measurable
 * over the whole library rather than source-shaped, which the tiered version could not be.
 */
let dialWriteCases = 0, dialWriteOk = 0, dialCollateral = 0;
const PHASE_FIELDS = ['winding', 'size', 'pulse', 'pulseRate', 'wobble', 'wobbleRate'];
for (const s of liveSlots.slice(0, 200)) {
  for (const target of DIAL_DETENT_SET) {
    for (let axis = 0; axis < AXES; axis++) {
      const before = cellsOf(s.wave);
      if (before[axis].winding === 0) continue;
      dialWriteCases++;
      const axes = cellsOf(s.wave);
      const phase = phaseForTarget(target, axes[axis].winding);
      // The shipped write, transcribed from `installDial`'s `write()`: the named field and its derived readouts.
      axes[axis].phase = phase;
      axes[axis].effectivePhase = wrap360(axes[axis].phase * axes[axis].winding);
      const err = Math.abs(axes[axis].effectivePhase - target);
      const landed = Math.min(err, Math.abs(err - 360)) < 1e-9;
      // Nothing else moved: no other axis's phase, and no stored field on ANY axis.
      const clean = axes.every((c, i) =>
        (i === axis || c.phase === before[i].phase) && PHASE_FIELDS.every(f => c[f] === before[i][f]));
      if (landed && clean) dialWriteOk++;
    }
  }
}
chk('a dial writes ONLY its own axis\'s phase — no derived write, no collateral field (16.15 inverts the old clause)',
  dialWriteCases > 0 && dialWriteOk === dialWriteCases,
  `${dialWriteOk} of ${dialWriteCases} (live slot x detent x axis) writes land the exact shift and touch nothing else`);
/*
 * ⚠️ **THE SEED IS THE RETIRED BEHAVIOUR, WHICH IS THE ONLY HONEST SEED HERE:** the derived Y write the tier
 * required. It must be shown to VIOLATE the clause above, or the reversal is a claim rather than a measurement.
 */
for (const s of liveSlots.slice(0, 200)) {
  for (const target of DIAL_DETENT_SET) {
    const before = cellsOf(s.wave);
    if (before[1].winding === 0 || before[0].winding === 0) continue;
    const axes = cellsOf(s.wave);
    const phase = phaseForTarget(target, axes[1].winding);
    /*
     * The old routing, in the model's own terms: the simple row held `phaseX` and `twist`, and `applySimple`
     * expanded that pair as `X = phaseX`, `Y = phaseX + twist`, `Z = phaseX` — there was no third phase to
     * store. So a Y drag set `twist = phase − phaseX` and the expansion then wrote **Z from X**.
     */
    const twist = phase - axes[0].phase;
    axes[1].phase = axes[0].phase + twist;
    axes[2].phase = axes[0].phase;
    if (axes.some((c, i) => i !== 1 && c.phase !== before[i].phase)) dialCollateral++;
  }
}
seed('the pre-16.15 derived write, where dragging Y also rewrote Z\'s phase off X',
  dialCollateral,
  'the tier forced that routing; with one control set it is collateral damage, so the clause had to be inverted');
const oracleOneWritePath = (s) => (
  /cell\.phase = phase;/.test(s) && !/simpleOf|applySimple|tier/i.test(s.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''))
    ? 0 : 1);
chk('...and the source has ONE write path, assigning the named field directly',
  oracleOneWritePath(installDialBody) === 0,
  'the two-branch version is gone with the projection it existed for; comments recording that are stripped first');
seed('a projection branch reintroduced into the dial\'s write',
  oracleOneWritePath(`${installDialBody}\n      const r = simpleOf(axes); applySimple(axes, r);`),
  'the shape a "restore the simple view" edit would produce, and it is lossy on the modulator fields');

// ⚠️ **THE DETENTS ARE A REACHABILITY PROPERTY, MEASURED AGAINST THE LIBRARY RATHER THAN CHOSEN.** They are
// 0/90/180/270 because that is what the library authors: a dial whose snap points missed the shipped values
// would fight every existing preset. Counted over live axes, and the majority is the assertion.
const liveAxesAll = liveSlots.flatMap(s => cellsOf(s.wave));
const mult90 = liveAxesAll.filter(c => {
  const e = c.winding === 0 ? null : wrap360(c.phase * c.winding);
  return e !== null && Math.min(...DIAL_DETENT_SET.map(d => Math.min(Math.abs(e - d), Math.abs(e - d - 360)))) < 1e-6;
}).length;
chk('MEASURED: the detents 0/90/180/270 are where the library actually sits, not a round guess',
  liveAxesAll.length > 0 && mult90 > liveAxesAll.length * 0.5,
  `${mult90} of ${liveAxesAll.length} live axes already carry an effective shift ON a detent`);

// ===================================================================================================
console.log('\n§M — BREATHE in real units: seconds and percent (16.8 / E99)');
// ---------------------------------------------------------------------------------------------------
/*
 * ⚠️ **THE SECONDS CONVERSION IS AN INVARIANT-10 UNITS CLAIM AND NOTHING ELSE IN THE CODEBASE STATES IT.** A
 * modulator's argument is `sin(pos * rate / DEG)`, and `pos` advances `waveSpeed` per 16.667 ms frame — so at
 * 60 fps it advances `60 * waveSpeed` per second and one full modulator cycle takes `(360 / rate) / (60 *
 * waveSpeed)` seconds. Every term matters: a converter that dropped `waveSpeed` would be right on the 375
 * presets at the modal 0.05 and wrong by 10x on the four at 0.005. `tsc` sees every one of these as `number`.
 *
 * ⚠️ **THE PERCENT VIEW IS A HYBRID BECAUSE A ZERO BASE IS A REAL AUTHORED STATE, NOT AN EDGE CASE.** Hundreds
 * of axes carry a pulse over a size of 0 (and a wobble over a winding of 0), where a percentage is `x/0` and
 * means nothing — so the field shows the ABSOLUTE and the unit label says `abs`, and `applyBreathe` reads the
 * typed number in whichever unit is displayed. **The unit shown and the unit stored must agree**, which is one
 * `null` test on one base in both directions.
 *
 * ⚠️ **AND THE DISPLAY IS ROUNDED, SO IT MUST NEVER BE THE SOURCE OF A STORED VALUE.** The round trip does NOT
 * converge with precision (measured below), which is the structural reason `sync()` re-derives the string from
 * the model every time and `applyBreathe` writes from the typed number — never from the field it just wrote.
 */
const breatheRowBody = bodyOfTab('private breatheRow(slot: number, which: \'pulse\' | \'wobble\'): HTMLElement');
const applyBreatheBody = bodyOfTab('private applyBreathe(slot: number, axis: number, kind: BreatheCell[\'kind\'], raw: number): void');
const syncBreatheBody = bodyOfTab('private syncBreatheCells(): void');
chk('ANCHOR: the breathe row, its writer and its sync are all locatable in the source',
  breatheRowBody.length > 0 && applyBreatheBody.length > 0 && syncBreatheBody.length > 0,
  `breatheRow ${breatheRowBody.length}, applyBreathe ${applyBreatheBody.length}, syncBreatheCells ${syncBreatheBody.length} chars`);

/*
 * ⚠️ **A LITERAL RE-IMPLEMENTATION OF THE FORMULA, exactly as §D and §I do, and for the same reason**: the
 * assertion has to be able to fail when the shipped helper's arithmetic changes. `POS_PER_SECOND` is imported
 * because it is the one number that is a stated assumption (60 fps) rather than a derivation.
 */
const secondsLiteral = (rate, waveSpeed) => Math.abs(360 / rate) / (POS_PER_SECOND * Math.abs(waveSpeed));
let secCases = 0, secExact = 0, secWorst = 0, secRoundTrip = 0;
let fastest = Infinity, slowest = 0;
const speedOf = (p) => p.generators.waveSpeed ?? 0.05;
for (const [name, p] of presets) {
  const speed = speedOf(p);
  if (speed === 0) continue;
  for (const wave of p.generators.waves ?? []) {
    for (const a of wave.axes) {
      for (const [amp, rate] of [[a.am.amplitude ?? 0, a.am.frequency ?? 0], [a.fm.amplitude ?? 0, a.fm.frequency ?? 0]]) {
        if (rate === 0) continue;
        secCases++;
        const shipped = modulatorSeconds(rate, speed);
        const literal = secondsLiteral(rate, speed);
        const err = Math.abs(shipped - literal);
        secWorst = Math.max(secWorst, err);
        if (err === 0) secExact++;
        // ⚠️ The INVERSE is what the control writes, so it is asserted separately: a converter can be right in
        // one direction and wrong in the other, and only the inverse reaches the model.
        const backRate = rateForSeconds(literal, speed);
        if (backRate !== null && Math.abs(Math.abs(backRate) - Math.abs(rate)) < Math.abs(rate) * 1e-9) secRoundTrip++;
        if (amp !== 0) { fastest = Math.min(fastest, literal); slowest = Math.max(slowest, literal); }
      }
    }
  }
}
chk('the seconds readout is the engine\'s own `(360/rate)/(60 x waveSpeed)`, exactly, in BOTH directions',
  secCases > 0 && secExact === secCases && secRoundTrip === secCases,
  `${secExact} of ${secCases} live rates convert exactly (worst error ${secWorst.toExponential(3)}); `
  + `${secRoundTrip} invert back to the stored rate; authored periods span `
  + `${fastest.toFixed(3)}s to ${slowest.toFixed(1)}s`);
seed('a converter that hardcodes the modal `waveSpeed` of 0.05',
  (() => {
    let n = 0;
    for (const [, p] of presets) {
      const speed = speedOf(p);
      if (speed === 0 || speed === 0.05) continue;
      for (const wave of p.generators.waves ?? []) for (const a of wave.axes)
        for (const rate of [a.am.frequency ?? 0, a.fm.frequency ?? 0]) {
          if (rate === 0) continue;
          if (Math.abs(secondsLiteral(rate, 0.05) - secondsLiteral(rate, speed)) > 1e-12) n++;
        }
    }
    return n;
  })(),
  'the modal speed covers most of the library, so a hardcoded 0.05 passes a spot check and is wrong by 10x at 0.005');
seed('a converter that drops the `/DEG` half-cycle factor, i.e. `1/rate` seconds',
  (() => {
    let n = 0;
    for (const [, p] of presets) {
      const speed = speedOf(p);
      if (speed === 0) continue;
      for (const wave of p.generators.waves ?? []) for (const a of wave.axes)
        for (const rate of [a.am.frequency ?? 0, a.fm.frequency ?? 0]) {
          if (rate === 0) continue;
          if (Math.abs(1 / Math.abs(rate) - secondsLiteral(rate, speed)) > 1e-12) n++;
        }
    }
    return n;
  })(),
  'invariant 10: a units error that type-checks and reads plausibly, off by 360/(60 x waveSpeed)');

/*
 * ⚠️ **THE HYBRID'S ZERO-BASE CASE IS MEASURED, BECAUSE THE WHOLE DESIGN RESTS ON IT BEING COMMON.** If no axis
 * carried a modulator over a zero base, a percent-only view would be correct and the `abs` fallback would be
 * decorative. Both bases are counted separately (`pulse` over `size = 0`, `wobble` over `winding = 0`) so a
 * future move names itself, and the seed is the percent-only view producing a non-finite on every one of them.
 */
let pulseZeroBase = 0, wobbleZeroBase = 0, pulseAxes = 0, wobbleAxes = 0;
for (const s of slots) {
  for (const c of cellsOf(s.wave)) {
    if (c.pulse !== 0) { pulseAxes++; if (c.size === 0) pulseZeroBase++; }
    if (c.wobble !== 0) { wobbleAxes++; if (c.winding === 0) wobbleZeroBase++; }
  }
}
chk('MEASURED: a modulator over a ZERO base is common, so the percent/absolute hybrid is required not defensive',
  pulseZeroBase > 0 && wobbleZeroBase > 0
  && breathePercent(5, 0) === null && amplitudeForPercent(50, 0) === null,
  `${pulseZeroBase} of ${pulseAxes} pulse axes sit over size 0, ${wobbleZeroBase} of ${wobbleAxes} wobble axes `
  + `over winding 0 — all shown as \`abs\`, and both helpers return \`null\` there rather than a non-finite`);
seed('a percent-only view, which produces `Infinity`/`NaN` on every zero-base axis',
  (() => {
    let n = 0;
    for (const s of slots) for (const c of cellsOf(s.wave)) {
      if (c.pulse !== 0 && !Number.isFinite((c.pulse / c.size) * 100)) n++;
      if (c.wobble !== 0 && !Number.isFinite((c.wobble / c.winding) * 100)) n++;
    }
    return n;
  })(),
  'the field would read `Infinity`, and writing it back would store a non-finite amplitude');
// The unit LABEL and the unit STORED must agree — asserted on the source, because it is one `null` test used twice.
const oracleUnitAgree = (write, show) => (
  /const abs = amplitudeForPercent\(raw, base\);[\s\S]{0,600}?abs === null \? raw : abs/.test(write)
  && /pct === null \? [\s\S]{0,200}?'abs' : '%'/.test(show) ? 0 : 1);
chk('the unit SHOWN and the unit STORED are the same `null` test on the same base, in both methods',
  oracleUnitAgree(applyBreatheBody, syncBreatheBody) === 0,
  'a field labelled `abs` whose write divides by the base would silently store nothing');
seed('the writer reading a percentage while the label says `abs`',
  oracleUnitAgree(applyBreatheBody.replace(/abs === null \? raw : abs/, 'abs ?? 0'), syncBreatheBody),
  'the hybrid\'s one real trap, and it is invisible to `tsc` because both branches are `number`');

/*
 * ⚠️ **THE ROUNDING DOES NOT ROUND-TRIP AND THE PRECISION DOES NOT CONVERGE — measured, and the counts ARE the
 * assertion's bound.** This is why the display can never be a source: `sync()` re-derives it from the model and
 * `applyBreathe` writes from the typed number. A "tidy" edit that read `input.value` back into the model would
 * quantise every authored pulse in the library on the first sync.
 */
let pctCases = 0; const pctRoundTrip = { 2: 0, 4: 0, 6: 0, 10: 0 };
for (const s of slots) {
  for (const c of cellsOf(s.wave)) {
    for (const [amp, base] of [[c.pulse, c.size], [c.wobble, c.winding]]) {
      if (amp === 0) continue;
      const pct = breathePercent(amp, base);
      if (pct === null) continue;
      pctCases++;
      for (const dp of [2, 4, 6, 10]) {
        const back = amplitudeForPercent(Number(pct.toFixed(dp)), base);
        if (back !== null && Math.abs(back - amp) < Math.abs(amp) * 1e-12) pctRoundTrip[dp]++;
      }
    }
  }
}
chk('MEASURED: the percent DISPLAY is lossy at every precision, so it is a VIEW and never a stored value',
  pctCases > 0 && pctRoundTrip[10] < pctCases,
  `of ${pctCases} percent-displayable axes, exact round trips: ${[2, 4, 6, 10]
    .map(dp => `${pctRoundTrip[dp]} at ${dp}dp`).join(', ')} — it does NOT converge`);
const oracleNoRederive = (s) => (/\.value\s*\)|Number\(\s*\w+\.input\.value/.test(s) ? 1 : 0);
chk('...and `syncBreatheCells` never reads a field back into the model — it only writes, under the caret guard',
  oracleNoRederive(syncBreatheBody) === 0
  && /if \(b\.input\.value !== text\) b\.input\.value = text;/.test(syncBreatheBody),
  'a sync that re-derived from its own display would quantise every authored modulator on the first load');
seed('a sync that re-derives the stored amplitude from its own rounded display',
  oracleNoRederive(`${syncBreatheBody}\n      cell.pulse = Number(b.input.value);`),
  'the rounding is lossy at every precision measured, so this is data loss on load with no user action at all');

// ⚠️ **A RATE WITH NO AMPLITUDE MUST STAY EDITABLE, and the case is authored.** "How fast it would breathe if
// it breathed" is a real intermediate state while authoring: greying the seconds field at amplitude 0 would
// make the pair unreachable in one of the two orders a user can enter it.
let rateNoAmp = 0, ampNoRate = 0;
for (const s of slots) for (const c of cellsOf(s.wave)) {
  if (c.pulseRate !== 0 && c.pulse === 0) rateNoAmp++;
  if (c.wobbleRate !== 0 && c.wobble === 0) rateNoAmp++;
  if (c.pulse !== 0 && c.pulseRate === 0) ampNoRate++;
  if (c.wobble !== 0 && c.wobbleRate === 0) ampNoRate++;
}
chk('MEASURED: a rate with NO amplitude is an authored state, so the seconds field must stay editable',
  rateNoAmp > 0 && modulatorSeconds(90, 0.05) !== null,
  `${rateNoAmp} axes author a rate with zero amplitude; ${ampNoRate} author an amplitude with zero rate `
  + `(shown as an empty period, since a rate of 0 has none)`);
seed('a seconds field gated on a nonzero amplitude, making the pair unreachable in one entry order',
  rateNoAmp,
  'if nothing authored a rate without an amplitude the gate would be harmless and this clause decorative');
// ⚠️ And >100% is ACCEPTED unclamped: the library authors a pulse larger than its own size, so a clamp would
// silently rewrite shipped presets the moment the tab opened.
const pulseExceeds = slots.flatMap(s => cellsOf(s.wave))
  .filter(c => c.pulse !== 0 && Math.abs(c.pulse) > Math.abs(c.size)).length;
chk('MEASURED: a breathe depth above 100% is AUTHORED, so the field accepts it unclamped',
  pulseExceeds > 0 && amplitudeForPercent(150, 20) === 30,
  `${pulseExceeds} axes carry a pulse larger than their own size — a clamp at 100% would rewrite them on load`);
seed('a depth clamped to 100%, which rewrites those axes the moment the tab opens',
  pulseExceeds,
  'the same shape as a slider `min` above the engine\'s clamp: an authored value the control cannot represent');

// ===================================================================================================
console.log('\n§N — the three-plane overlay decomposition and the open winding (16.9–16.13 / E100–E104)');
// ---------------------------------------------------------------------------------------------------
/*
 * ⚠️ **THIS SECTION EXISTS BECAUSE THE REDESIGN ADDED A NEW OUTPUT CHANNEL AND §I OWNS THE OLD ONE.** §I asserts
 * `computeScore`'s sampling instants; 16.9/16.10 introduced `computeOverlayScores`, which is a **different
 * function with a different arity, three planes instead of one, and up to nine curves instead of two.** Every §I
 * clause stayed green through the entire redesign while nothing whatsoever read the new export — the shape
 * `CLAUDE.md` names as *"a checker only knows what it was pointed at"*, and the reason §I/§J/§K exist as three
 * sections instead of one.
 *
 * ⚠️ **THE SHARED EXTENT IS THIS SECTION'S KEYSTONE, AND IT IS INVARIANT 29 AS AN ARITHMETIC PROPERTY.** Nine
 * curves drawn at nine fitted extents would be nine equally-large pictures of nine different magnitudes: a slot
 * with 110.851 model units of Z reach and none in XY would look identical in all three panes, and the cyan
 * `Pulse` curve — whose entire content is *being a different size from white* — would be renormalised exactly on
 * top of it. So `OverlayScore.extent` must be the max |coord| over ALL nine, measured here rather than trusted.
 *
 * ⚠️ **PARTLY SOURCE-SHAPED, AND IT SAYS SO — the same disclosure §H/§J/§K/§L/§M carry.** The arity, instant and
 * extent clauses MEASURE (a failure means wrong arithmetic for the whole library); the ones naming
 * `drawOverlayScore`'s call shape and the legend keys are SOURCE-SHAPED (a failure means the named owner was
 * bypassed or renamed, not that the arithmetic moved). **Read a failure's kind before believing it is a
 * regression.**
 */
const { computeOverlayScores } = SC;

// ⚠️ **ARITY FIRST, AND FOR THE REASON §I'S ARITY CLAUSE EXISTS: a caller that CAN name the instant will name
// `0`, and `0` is the one instant where every modulator collapses to its base (invariant 28).** `(waves, slot)`
// is 2. ⚠️ A `time` re-added as a DEFAULT parameter would not move `Function.length`, which is why the clause
// pairs the arity with a behavioural probe: two different subjects must be able to disagree about `now`.
chk('`computeOverlayScores` takes NO `time` — the arity is `(waves, slot)`, so no call site can freeze it',
  computeOverlayScores.length === 2,
  `arity is ${computeOverlayScores.length}; §I's clause on \`computeScore\` is the precedent and the reason`);

/*
 * ⚠️⚠️ **v8 `34.1` WIDENED THIS CLAUSE DELIBERATELY, AND THE REASON IS THE HOLE THE CLAUSE ABOVE LEAVES.**
 * `34.1` gave `computeOverlayScores` a THIRD parameter — `ops`, the `overlay`-resident figure operators
 * (`sharpness`, `travel`, `halfExtent`) the Score previously could not see at all. **It carries a default, so
 * `Function.length` is still 2 and the clause above went on passing without noticing a new parameter existed.**
 * That is exactly the hazard `score-canvas.ts`'s own `PLANES` header already records in the other direction
 * ("do not resurrect `plane` as a default parameter — a default does not count towards `Function.length`").
 *
 * ⚠️ **SO THE PROPERTY IS RESTATED AS THE ONE IT ALWAYS MEANT: no parameter may NAME AN INSTANT, and the two
 * positional parameters must stay REQUIRED.** `ops` cannot name an instant (`sharpness` is time-independent and
 * `travel` is `frac × halfExtent`, also time-independent), so widening by it is legitimate — but it may only be
 * legitimate *visibly*. Read from source because `Function.length` provably cannot see it.
 */
{
  const decl = /export function computeOverlayScores\(([\s\S]*?)\):\s*OverlayScore/.exec(SCORE_SRC);
  const params = (decl?.[1] ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const names = params.map(p => p.split(/[:=]/)[0].trim());
  const defaulted = params.map(p => /=/.test(p));
  chk('...and its parameter LIST is read from source, because a defaulted third parameter is invisible to `Function.length`',
    params.length === 3
    && names[0] === 'waves' && names[1] === 'slot' && names[2] === 'ops'
    && defaulted[0] === false && defaulted[1] === false && defaulted[2] === true
    && !names.includes('time') && !names.includes('instant'),
    params.length
      ? `declared \`(${names.join(', ')})\`, defaults \`[${defaulted.join(', ')}]\` — `
        + `\`ops\` is 34.1's \`overlay\` operator bundle and is DEFAULTED so every pre-34.1 caller stays `
        + `byte-identical (§R measures that identity). \`waves\`/\`slot\` stay required, and nothing names an instant`
      : 'the declaration regex matched NOTHING — an anchor miss, which is the failure to suspect first');
  seed('a `time` parameter re-added with a default, which `Function.length` cannot see',
    (() => {
      const fake = 'export function computeOverlayScores(\n  waves: readonly WaveConfig[], slot: number | null, '
        + 'time = 0, ops: WaveOps = NO_OPS,\n): OverlayScore {';
      const d = /export function computeOverlayScores\(([\s\S]*?)\):\s*OverlayScore/.exec(fake);
      const n = (d?.[1] ?? '').split(',').map(s => s.trim()).filter(Boolean).map(p => p.split(/[:=]/)[0].trim());
      return n.includes('time') ? 1 : 0;
    })(),
    'the arity clause above stays GREEN over this seed — `length` is still 2 — which is the whole reason this '
    + 'second clause reads the declaration instead');
}

/*
 * ⚠️ **AND THE NEW EXPORT MUST INHERIT §I'S FIX RATHER THAN RE-DERIVING IT — MEASURED ON THE SAME WITNESSES.**
 * The presets §I found blank at `t = 0` are the exact set a fresh instant search could get wrong again, and
 * `chooseOverlayInstants` is a SECOND search (it adds the two family-extreme picks). A second implementation of
 * one rule is `CLAUDE.md`'s two-base-rules shape; the assertion is that the overlay's `now` curve is non-blank
 * on every one of §I's own witnesses, in all three planes at once.
 */
const overlayBlank = blankAtZero.filter(s => {
  const o = computeOverlayScores(s.waves, null);
  return o.extent < authoredReach(s.waves) * 1e-6;
});
chk('MEASURED: the overlay is non-blank on EVERY preset §I measured blank at t=0 — the new search inherited the fix',
  blankAtZero.length > 0 && overlayBlank.length === 0,
  overlayBlank.length
    ? `${overlayBlank.length} still blank: ${overlayBlank.slice(0, 5).map(s => s.n).join(', ')}`
    : `all ${blankAtZero.length} of §I's t=0 witnesses draw a real curve (basis: this checker's ${scored.length} `
      + `preset objects with an authored reach)`);
seed('the overlay sampling at t=0, i.e. the defect §I closed re-entering through the new export',
  blankAtZero.length,
  'if t=0 were not degenerate for any preset this clause could not fail and the section would be decorative');

/*
 * ⚠️ **THE `now` INSTANT MUST BE THE SAME RULE IN BOTH FUNCTIONS, OR THE COMBINED ROW AND THE PER-SLOT ROWS
 * DESCRIBE DIFFERENT FIGURES WHILE BOTH LOOK PLAUSIBLE — the worst failure shape a diagnostic can have.**
 * `computeScore`'s `main` and `computeOverlayScores`' `now` are both `argmax reachProxy`, so on a figure with no
 * pulse and no wobble the white overlay curve and the single-plane score path must be point-for-point equal.
 * ⚠️ **The subject is deliberately a STATIC figure: with modulators live the two can legitimately differ,
 * because the overlay's sample count is chosen over a different subject set.** So the clause is scoped to where
 * agreement is a theorem, and the seed breaks the rule rather than the data.
 *
 * ⚠️ **WHAT THIS CLAUSE CAN AND CANNOT FAIL ON, BECAUSE ITS FIRST SEED WAS ALGEBRAICALLY IMPOSSIBLE AND SAYING SO
 * IS THE FINDING.** I first seeded it with §I's naive amplitude-only instant proxy — and on a static figure BOTH
 * proxies read the same instant by construction, so the mutation could not disagree and the seed reported 0
 * violations. That is `CLAUDE.md`'s *"a clause algebraically implied by its siblings"* arriving inside a SEED:
 * ask what the mutation can fail on that the shipped rule cannot. **The instant rule is NOT what this clause
 * measures** (a static figure has only one instant); what it measures is the SAMPLING CONTRACT — same sample
 * count, same projection, same scale — which is the thing that would make the combined row and the per-slot rows
 * draw the same figure at two sizes. The seed below therefore perturbs the SCALE, the defect the per-pane fit
 * would introduce, and it doubles as the guard against the clause passing on two empty arrays.
 */
const staticScored = scored.filter(s => s.waves.every(w => w.axes.every(a =>
  (a.am.amplitude ?? 0) === 0 && (a.fm.amplitude ?? 0) === 0)));
const instantDisagree = staticScored.filter(s => {
  const o = computeOverlayScores(s.waves, null);
  const p = computeScore(s.waves, 'xy').path;
  if (o.xy.now.length !== p.length) return true;
  for (let i = 0; i < p.length; i++) if (o.xy.now[i] !== p[i]) return true;
  return false;
});
chk('the overlay `now` curve IS `computeScore`\'s path on a static figure — one instant rule, not two',
  staticScored.length > 0 && instantDisagree.length === 0,
  instantDisagree.length
    ? `${instantDisagree.length} of ${staticScored.length} disagree: ${instantDisagree.slice(0, 4).map(s => s.n).join(', ')}`
    : `${staticScored.length} static preset objects agree point-for-point in XY`);
seed('the overlay projecting its own `now` curve on a scale of its own — the per-pane fit, seen point-for-point',
  staticScored.filter(s => {
    const o = computeOverlayScores(s.waves, null);
    const p = computeScore(s.waves, 'xy').path;
    if (o.xy.now.length !== p.length) return true;
    // The defect: the overlay normalises each pane to its own reach. On a figure whose XY reach is not already
    // the max over all three planes the two paths then differ, which is precisely what a reader could not see.
    const k = o.extent > 1e-12 ? 1 / o.extent : 1;
    for (let i = 0; i < p.length; i++) if (o.xy.now[i] * k !== p[i]) return true;
    return false;
  }).length,
  'a scale-free comparison would pass on a per-pane fit, which is the defect the shared extent exists to prevent');

/*
 * ⚠️ **THE SHARED EXTENT, MEASURED AS THE MAX OVER ALL NINE CURVES — the property both 16.9 and 16.10 rest on.**
 * `drawOverlayScore` fits its box to whatever extent it is handed, so this single number is the only thing making
 * the three panes comparable and the cyan/amber curves readable as *different sizes* rather than as different
 * shapes. It is re-derived here from the returned arrays, so a per-pane or per-curve fit fails on arithmetic.
 */
const extentWrong = [];
for (const s of scored) {
  for (const slot of [null, 0, 1, 2]) {
    const o = computeOverlayScores(s.waves, slot);
    let mx = 0;
    for (const pane of [o.xy, o.xz, o.yz]) {
      for (const arr of [pane.now, pane.size, pane.winding]) {
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) mx = Math.max(mx, Math.abs(arr[i]));
      }
    }
    if (Math.abs(mx - o.extent) > Math.max(1e-9, mx * 1e-12)) extentWrong.push(`${s.n} slot ${slot}`);
  }
}
chk('ONE extent for all NINE curves — the max |coord| over three planes x up to three instants (invariant 29)',
  extentWrong.length === 0,
  extentWrong.length ? `${extentWrong.length} wrong: ${extentWrong.slice(0, 4).join(', ')}`
    : `${scored.length} preset objects x 4 subjects (combined + 3 slots) re-derived exactly`);
/*
 * ⚠️ **THE SEED IS A PER-PANE FIT, WHICH IS THE EDIT SOMEONE WOULD ACTUALLY MAKE — and it is measured to be a
 * REAL difference on real presets rather than assumed to be.** A figure whose reach is unequal across planes is
 * exactly where the two disagree, and `CLAUDE.md` records that the library has them (a working control scored
 * 0 px in XY against 110.851 model units of Z).
 */
seed('a per-PANE extent fit, so all three panes draw at the same apparent size whatever their reach',
  scored.filter(s => {
    const o = computeOverlayScores(s.waves, null);
    const per = [o.xy, o.xz, o.yz].map(pane => {
      let mx = 0;
      for (const arr of [pane.now, pane.size, pane.winding]) {
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) mx = Math.max(mx, Math.abs(arr[i]));
      }
      return mx;
    });
    return Math.max(...per) - Math.min(...per) > Math.max(...per) * 1e-6;
  }).length,
  'if every figure had equal reach in all three planes the shared extent would buy nothing');

/*
 * ⚠️ **A FAMILY'S CURVE MUST BE `null` WHEN THAT FAMILY PROVABLY DOES NOT MOVE, AND THE TEST IS ON THE SEARCHED
 * SPREAD RATHER THAN ON `amplitude !== 0`.** This is the retired ghost's own defect in miniature: a modulator
 * with a nonzero amplitude and a rate of **0** never moves, so an amplitude-keyed test would draw a second curve
 * exactly on top of the first while the legend announced a range that does not exist — the *"faint path =
 * breathing range"* label that was live for the whole of 16.2's existence. ⚠️ **The library authors the case:
 * §M measures axes carrying an amplitude with no rate, so this is reachable, not defensive.**
 */
const inertPair = { speed: 0, axes: [0, 1, 2].map(q => ({
  phase: q === 1 ? 90 : 0,
  am: { base: 30, amplitude: 12, frequency: 0 },   // amplitude present, rate ZERO — provably static
  fm: { base: q === 2 ? 0 : 1, amplitude: 4, frequency: 0 },
})) };
const inertOverlay = computeOverlayScores([inertPair], null);
chk('a family that provably does not move draws NO second curve — `null`, not a curve on top of the first',
  inertOverlay.xy.size === null && inertOverlay.xy.winding === null
  && inertOverlay.xz.size === null && inertOverlay.yz.winding === null
  && extentOfPath(inertOverlay.xy.now) > 0,
  'an amplitude with a rate of 0 is inert; the white curve must still be real, which the extent asserts');
seed('the amplitude-keyed test, i.e. the retired ghost\'s defect re-entering as a second overlay curve',
  [inertPair].some(w => w.axes.some(a => (a.am.amplitude ?? 0) !== 0 || (a.fm.amplitude ?? 0) !== 0)) ? 1 : 0,
  'this subject carries amplitudes with zero rates, so an amplitude-keyed test WOULD draw both extra curves');
// ⚠️ And the converse must hold, or `null` would be unfalsifiable: a genuinely breathing figure DOES get both.
const livePair = { speed: 0, axes: [0, 1, 2].map(q => ({
  phase: q === 1 ? 90 : 0,
  am: { base: 30, amplitude: 12, frequency: 90 },
  fm: { base: 1 + q, amplitude: 2, frequency: 45 },
})) };
const liveOverlay = computeOverlayScores([livePair], null);
chk('...and a figure that DOES pulse and wobble gets both extra curves, at instants that differ from `now`',
  liveOverlay.xy.size !== null && liveOverlay.xy.winding !== null
  && !pathsEqual(liveOverlay.xy.size, liveOverlay.xy.now)
  && !pathsEqual(liveOverlay.xy.winding, liveOverlay.xy.now),
  'a `null` that were always null would pass the clause above while drawing nothing the legend promises');

/*
 * ⚠️ **THE LEGEND IS A CONTRACT WITH THREE COLOURS AND THE COLOURS ARE IN A DIFFERENT FILE FROM THE WORDS — so a
 * change to one silently mislabels the other, which is worse than an ugly diagram.** SOURCE-SHAPED, and it says
 * so: it asserts that the three `OVERLAY_STYLES` rgb triples appear in `panel.css`'s three legend keys, which is
 * the only place the two owners can be compared at all. `CLAUDE.md`'s tooltip row is the precedent — the CSS
 * comment already calls itself load-bearing; this is what makes that comment enforceable.
 *
 * ⚠️ **THE COMPARISON IS PER KEY, AND ITS FIRST FORM WAS NOT — a set-membership test (`is this hex SOME overlay
 * colour`) passes on a legend whose `size` and `winding` swatches are SWAPPED, which is precisely a mislabelled
 * legend and precisely what the clause claims to forbid.** `CLAUDE.md`'s *"a clause algebraically implied by its
 * siblings"* in a colour: three memberships cannot see a permutation of the same three values. So the styles are
 * parsed BY NAME out of the `OVERLAY_STYLES` block — not by scraping every `rgba(` in the file, which also swept
 * up `drawScore`'s own palette and let a legend key match a curve family it does not name.
 */
const scoreSrc = readFileSync(join(ROOT, 'src/ui/synthesis-lab/score-canvas.ts'), 'utf8');
const cssSrc = readFileSync(join(ROOT, 'src/ui/synthesis-lab/panel.css'), 'utf8');
/** `{winding, size, now} -> "r,g,b"`, read out of the ONE declaration, so a name mismatch is visible. */
const stylesBlock = (scoreSrc.match(/const OVERLAY_STYLES = \{[\s\S]*?\} as const;/) ?? [''])[0];
const styleRgb = Object.fromEntries([...stylesBlock.matchAll(
  /(winding|size|now):\s*\{\s*style:\s*'rgba\((\d+),\s*(\d+),\s*(\d+),/g)].map(m => [m[1], `${m[2]},${m[3]},${m[4]}`]));
const legendHex = [...cssSrc.matchAll(/\.sl-composer-key-(now|size|winding)\s*\{\s*color:\s*#([0-9a-fA-F]{6})/g)];
const hexToRgb = (h) => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
const legendMismatch = (rgbOf) => legendHex.filter(([, key, hex]) => rgbOf(key) !== hexToRgb(hex)).map(([, k]) => k);
chk('the legend\'s three swatch colours ARE the three overlay curve colours THEY NAME — one contract, two files',
  legendHex.length === 3 && Object.keys(styleRgb).length === 3 && legendMismatch(k => styleRgb[k]).length === 0,
  legendHex.length === 3 && Object.keys(styleRgb).length === 3
    ? `${legendHex.map(([, k, hex]) => `${k}=#${hex}`).join(', ')} each equal to OVERLAY_STYLES.${''}<same key>`
    : `found ${legendHex.length} legend keys in panel.css and ${Object.keys(styleRgb).length} named styles in `
      + 'score-canvas.ts, expected three of each — an anchor that matched nothing is the failure to suspect first');
// ⚠️ The seed is a PERMUTATION, not a recolour: it is the mutation the set-membership form could not see.
seed('the legend\'s `size` and `winding` swatches SWAPPED — a mislabelled legend, every colour still present',
  legendMismatch(k => styleRgb[k === 'size' ? 'winding' : k === 'winding' ? 'size' : k]).length,
  'a membership test over all three colours passes on any permutation of them, which is the mislabelling itself');

/*
 * ⚠️ **AND A FOURTH COLOUR MUST NOT REACH A PIXEL, WHICH IS A CLAIM ABOUT `drawScore`'s GHOST AND NOT ABOUT THE
 * OVERLAY AT ALL.** 16.9 replaced the single canvas with the three-plane triple and 16.10 gave every curve a
 * captioned colour — but `drawScore` still strokes `score.ghost` in a fourth blue that no legend key names, and
 * `drawScore` is still called: it rasterises the ratio thumbnails. **A curve nobody captions is the legend defect
 * the retired ghost was retired FOR, arriving through the surface that replaced it.**
 *
 * ⚠️ **IT IS SAFE TODAY BY ARITHMETIC AND NOT BY INTENT, SO THE ARITHMETIC IS WHAT THIS PINS.** Measured, not
 * assumed: `computeScore` has exactly ONE call site left in the tab (`ensureRatioScores`), and the wave it builds
 * there authors `amplitude: 0` on every `am` and `fm`, so `chooseInstants` returns `ghost: null` every time and
 * the fourth stroke is unreachable. **A thumbnail seed that gained a modulator would silently put an uncaptioned
 * curve on screen** — which no clause in §I could see, because §I asserts what the ghost IS, never whether
 * anything draws it. ⚠️ **§I's three ghost clauses therefore STAY: `computeScore` and `ScoreResult.ghost` are
 * both live and the thumbnails call them. What changed is the ghost's REACHABILITY AT A PIXEL, which is a
 * different property and needs its own clause — do not read this as a reason to retire those.**
 */
const thumbScores = RATIO_SET.map(r => Object.keys(PLANE_AXES).map(pl => computeScore(tileWaves(r), pl)));
const ghostedThumb = thumbScores.filter(planes => planes.some(s => s.ghost !== null));
/*
 * ⚠️ **THE LIVENESS CONJUNCT IS PER ROW ACROSS THE TRIPLE, NOT PER PANE — invariant 29 caught inside this very
 * clause on its first run.** I wrote `every pane draws a real path` and it FAILED on `0 : 0 : 1`, whose XY
 * projection is a single POINT because both planar windings are zero. That row is authored, reachable and
 * correct: its Z winding is exactly what the XZ and YZ thumbnails show. **A per-pane liveness rule would have
 * demanded a curve in a plane the ratio has nothing to say about** — the same wrong-plane reading that scored a
 * working control at 0 px in XY. The property that makes the clause non-vacuous is that the ROW draws something
 * somewhere, which is what a user picks it by.
 */
chk('no ratio thumbnail can draw the uncaptioned GHOST — the only curve on screen with no legend key (16.9/16.10)',
  ghostedThumb.length === 0 && thumbScores.length === RATIO_ROWS.length
  && thumbScores.every(planes => planes.some(s => extentOfPath(s.path) > 0)),
  `${thumbScores.length} rows x 3 planes: every row draws a real path in at least one plane and none a ghost `
  + `(${thumbScores.filter(planes => planes.some(s => extentOfPath(s.path) === 0)).length} rows are flat in some `
  + 'plane, which is the ratio being honest); `drawScore` strokes a fourth colour that no `.sl-composer-key-*` '
  + 'names, so its REACHABILITY is the property here, not its correctness');
seed('a thumbnail seed wave that gained a modulator, putting an uncaptioned fourth curve in the ratio list',
  (() => {
    const lively = (r) => ({ speed: 0, axes: tileWaves(r)[0].axes.map(a => ({ ...a,
      am: { ...a.am, amplitude: 0.4, frequency: 30 } })) });
    return RATIO_SET.filter(r => Object.keys(PLANE_AXES)
      .some(pl => computeScore([lively(r)], pl).ghost !== null)).length;
  })(),
  'if a modulated seed still produced no ghost the clause would be asserting a property of `chooseInstants`, not of the seed');

/*
 * ⚠️ **16.13: A NON-INTEGER WINDING IS AUTHORED DATA AND MUST SURVIVE THE ROUND TRIP UNROUNDED, AND THE
 * MEASUREMENT IS WHY THE STEPPER STOPPED ROUNDING.** §C already asserts representability; what this adds is the
 * `open`/`closes` READOUT — the channel that replaced the rounding. A control that silently changed the value it
 * was asked to display is invariant 13 inverted; the honest alternative is to store it and SAY it leaves a seam.
 *
 * ⚠️ **STATE BOTH BASES AND NEVER ADD THEM.** Non-integer windings and non-integer sizes are counted over the
 * same axis collector on different fields; the sizes are the larger reason the row cannot round at all.
 */
{
  const allAxes = slots.flatMap(s => s.wave.axes);
  const fracWinding = allAxes.filter(a => !Number.isInteger(a.fm.base ?? 0));
  const fracSize = allAxes.filter(a => !Number.isInteger(a.am.base ?? 0));
  chk('MEASURED: the library authors non-integer windings AND non-integer sizes — two bases, never summed',
    fracWinding.length > 0 && fracSize.length > fracWinding.length,
    `${fracWinding.length} of ${allAxes.length} axes carry a non-integer winding `
    + `(${[...new Set(fracWinding.map(a => a.fm.base))].join(', ')}); ${fracSize.length} of ${allAxes.length} `
    + `carry a non-integer size — the larger reason the row cannot round`);
  // ⚠️ The round trip must be EXACT on the fractional windings, through the shipped codec and not a re-derivation.
  const fracSlots = slots.filter(s => s.wave.axes.some(a => !Number.isInteger(a.fm.base ?? 0)));
  const roundTripped = fracSlots.filter(s => {
    const p = { generators: { waves: [clone(s.wave)], particleCount: 0 } };
    const m = readFigure(p);
    const out = { generators: { waves: [], particleCount: 0 } };
    writeFigure(out, m);
    return waveEq(s.wave, out.generators.waves[0]);
  });
  chk('...and every one of them survives `readFigure` -> `writeFigure` EXACTLY, unrounded',
    fracSlots.length > 0 && roundTripped.length === fracSlots.length,
    `${roundTripped.length} of ${fracSlots.length} slots carrying a fractional winding round-trip byte-exact`);
  seed('a stepper that rounds a typed winding, i.e. the 16.13 defect',
    fracSlots.filter(s => s.wave.axes.some(a => Math.round(a.fm.base ?? 0) !== (a.fm.base ?? 0))).length,
    'if the library authored only integers the rounding would be invisible and the change decorative');
  /*
   * ⚠️ **AND THE READOUT MUST BE THE ONE OWNER OF "DOES IT CLOSE" — `closesAt`, with a tolerance.** The tab
   * inlined `Number.isInteger(cell.winding)` in three places before 16.13; three copies of one rule is
   * `ratioBase`'s shape in another quantity. The tolerance is ABSOLUTE and small (1e-9) because at winding 8000
   * double spacing is ~9e-13, so a relative test would call a genuinely fractional winding closed.
   */
  const cells = slots.flatMap(s => cellsOf(s.wave));
  const closesWrong = cells.filter(c => c.closes !== (Math.abs(c.winding - Math.round(c.winding)) < 1e-9));
  chk('the `closes` readout is `closesAt` for every authored axis — ONE owner, not three inlined copies',
    closesWrong.length === 0 && cells.length > 0,
    closesWrong.length ? `${closesWrong.length} disagree` : `${cells.length} authored axes agree; `
      + `${cells.filter(c => !c.closes).length} report a seam, which is the readout that replaced the rounding`);
  seed('a `closesAt` widened to a tolerance that swallows a real fraction (0.5 read as closing)',
    cells.filter(c => !c.closes && Math.abs(c.winding - Math.round(c.winding)) < 0.6).length,
    'if no authored winding sat within a loose tolerance of an integer, the tolerance could not matter');
  // ⚠️ **AND THE SOURCE MUST NOT ROUND ON THE ROW** — SOURCE-SHAPED, because the defect is an absent statement
  // and no arithmetic over the library can see a `Math.round` that is not there.
  // ⚠️ **16.13's PAIRED CLAUSE (`repairFigure` DOES still round, so the two were not unified) IS RETIRED WITH
  // `Repair` ITSELF (16.15) — and with it the last rounder in this tab.** The asymmetry it recorded still stands
  // as the DESIGN rule and is why the clause below is scoped to the handler rather than to the file: **an
  // explicit named action may round, an input handler may not.** There is now no named action, so nothing rounds
  // a winding anywhere in the Composer, and the JS tie rule is pinned in §F for whatever rounds next.
  const axisRowBody = bodyOfTab('private axisRow(');
  chk('ANCHOR + SOURCE: the winding row exists and does NOT round what it is typed (16.13)',
    axisRowBody.length > 0 && !/Math\.round/.test(axisRowBody),
    `axisRow ${axisRowBody.length} chars; with \`Repair\` gone (16.15) NOTHING in the tab rounds a winding`);
}

/*
 * ⚠️ **16.12: ONE WORD PER QUANTITY, ASSERTED AS THE ABSENCE OF THE RETIRED SYNONYMS.** A synonym is discovered
 * by everyone while a tooltip is discovered only by someone who already suspects the control, so a second word
 * for one field costs more than it can buy — the owner's question *"isn't wobble the same as winding breathes?"*
 * is the measurement. SOURCE-SHAPED by necessity: the defect is a WORD, and no arithmetic can see one.
 *
 * ⚠️ **THE SCAN COVERS THE TOOLTIPS, THE TAB *AND THE MODEL* — and the third file was ADDED after this clause
 * shipped green over a live defect, which makes its own scope the most transferable thing in this section.**
 * `tierOf()` in `composer-model.ts` pushed `tierReasons`, which reached the user on the tier button's tooltip, and
 * one of them read `Z has a phase of its own` — the retired noun, three lines below a comment demanding the row's
 * word, while the two reasons beside it had been rewritten in the same step. **A green §N was evidence about two
 * files, not about the vocabulary**, exactly as `CLAUDE.md` says: *a section covers what it was pointed at.*
 * ⚠️ **The general form is worth more than the fix: A USER-FACING STRING CAN LIVE IN THE MODEL.** A scan scoped to
 * "the files where labels belong" cannot see a label that is somewhere else, and the wrong place is precisely
 * where one hides. **Before trusting an absence clause, list the files it reads and ask what writes copy outside
 * them.**
 *
 * ⚠️ **16.15 DELETED `tierOf`, AND THE RE-POINT IS AN IMPROVEMENT RATHER THAN A REPAIR — WHICH IS WHY IT IS
 * RECORDED AND NOT JUST DONE.** The model-side corpus was `tierOf`'s body, narrowed on the premise that
 * `composer-model.ts` is *"~800 lines of arithmetic whose literals are mostly keys and mode strings."* **Measured
 * now: the WHOLE FILE holds 16 string literals** — two import paths, three `SLOT_LABELS`, three `AXIS_LABELS`,
 * five `RATIO_NAMED` nicknames and three punctuation joiners. So the corpus is now the whole file with each
 * exemption NAMED, which is `CLAUDE.md`'s own rule applied to an instrument: **a source-shaped clause's remedy is
 * to widen the subject, not to re-point the anchor at the next function that happens to hold copy.** A whole-file
 * corpus cannot be emptied by a rename, which is exactly how the previous version failed.
 *
 * ⚠️ **And it must skip comments, or every derivation paragraph explaining WHY the word was retired would fail the
 * clause that retired it.** That is the `deadcheck` `stripComments()` lesson arriving in a new subject.
 *
 * ⚠️ **AND IT MUST SCAN STRING LITERALS, NOT SOURCE TEXT, BECAUSE A RETIRED WORD SURVIVES AS AN INTERNAL
 * IDENTIFIER AND THAT IS THE DECIDED DESIGN.** On this clause's first run it produced THREE hits with THREE
 * different verdicts: `simpleOf().twist` (a stored field of the deleted simple tier), `SIMPLE_FIELD_LABELS.twist`
 * (a property access reaching the user as the string `Y offset`) and a genuine `quarter-turn twist` in
 * `composer.newFigure` — **two instrument, one defect, and the defect was FIXED rather than exempted.**
 * ⚠️ **16.15 deleted both false positives with the tier, so the surviving identifier is `SEED_TWIST`** — a
 * constant, not copy, and the last `twist` left in `src/`. The exemption rule is unchanged and still load-bearing:
 * a clause that cannot tell an identifier from a label has to be exempted into uselessness. The tooltip KEYS
 * (`'composer.pulse'`) are excluded for the same reason: a key is a DOM-side identifier.
 *
 * ⚠️ **A `${...}` INTERPOLATION IS CODE AND IS STRIPPED — WHAT REACHES THE USER IS THE VALUE, WHICH IS CHECKED
 * AT ITS OWN DEFINITION SITE.** `` `${SLOT_LABELS[slot]} ${AXIS_LABELS[axis]}` `` renders as `Structure Y`; the
 * identifiers in it are property names. The literals in `SLOT_LABELS`/`AXIS_LABELS` ARE in this corpus, so the
 * surface is still covered — the scan reads each once, where it is written, instead of once per template that
 * happens to interpolate it. ⚠️ **The known limit, stated rather than hidden: a retired word smuggled in through a
 * VARIABLE is invisible to any text scan, so keep label text as a literal at its own site — which is the same rule
 * §I's `INLINE_SINK` ternary lesson already imposes.**
 */
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const tipSrc = readFileSync(join(ROOT, 'src/ui/synthesis-lab/tooltips.ts'), 'utf8');
  const composerTips = (tipSrc.match(/'composer\.[\s\S]*?(?=\n\};)/) ?? [''])[0];
  /** Every string and template literal in the surfaces, minus the tooltip keys — i.e. the copy a user reads. */
  const copyOf = (s) => (strip(s).match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? [])
    .filter(l => !/^'composer\.[A-Za-z]+'$/.test(l))
    .map(l => (l.startsWith('`') ? l.replace(/\$\{[^}]*\}/g, ' ') : l));
  /*
   * ⚠️ **THE MODEL'S CORPUS IS NOW THE WHOLE FILE, AND ITS EXEMPTIONS ARE NAMED RATHER THAN IMPLIED BY AN
   * ANCHOR.** Until 16.15 it was `tierOf`'s body — narrow because the file was assumed to be mostly keys and mode
   * strings, and fragile because `bodyOfSrc('export function tierOf')` returns `''` on a rename, which passes
   * every absence test. Both halves of that premise are now settled by measurement rather than assumption: the
   * file holds **16** string literals in total, so the whole-file corpus is smaller than the narrowing was worth,
   * and it cannot be emptied by a rename. **The MODULE PATHS are the one exemption, named here** — an import
   * specifier is not copy, and unlike a tooltip key it is not even a DOM-side identifier.
   */
  const modelSrc = readFileSync(join(ROOT, 'src/ui/synthesis-lab/composer-model.ts'), 'utf8');
  const modelCopy = copyOf(modelSrc).filter(l => !/^'\.\.?\//.test(l));
  const surfaces = [...copyOf(composerTips), ...copyOf(tabSrc), ...modelCopy].join('\n');
  const retired = ['breathes', 'AM depth', 'FM depth', 'twist'];
  const hit = (corpus, w) => new RegExp(w.replace(/ /g, '\\s+'), 'i').test(corpus);
  const found = retired.filter(w => hit(surfaces, w));
  chk('16.12: none of the retired synonyms reaches a user-facing string — one word per stored field',
    found.length === 0 && surfaces.length > 0,
    found.length ? `still present: ${found.join(', ')}` : `scanned ${surfaces.length} chars of tooltip + tab + `
      + `model COPY (${retired.length} retired words over string literals only; comments, keys and import `
      + 'specifiers excluded)');
  /*
   * ⚠️ **THE MODEL'S OWN COPY IS ASSERTED SEPARATELY, BECAUSE THE CLAUSE ABOVE WOULD PASS ON IT BY DILUTION —
   * AND THAT SEPARATION IS WHAT CAUGHT THE DEFECT THIS CLAUSE EXISTS FOR.** `phase` cannot go in `retired`: it is
   * a stored field's name and appears legitimately in the tab's tooltip keys and aria strings. So the model's
   * user-facing nouns need their own corpus AND their own word list. `CLAUDE.md` records the inverse shape (*a
   * clause algebraically implied by its siblings*); this is two clauses that look like one, where merging them
   * would silently drop the narrower.
   *
   * ⚠️ **ITS SUBJECT MOVED WITH 16.15 AND THE CLAUSE DID NOT WEAKEN.** The copy it caught was `tierOf`'s
   * `tierReasons`; with the tier gone, what the model still ships to a user is `SLOT_LABELS`, `AXIS_LABELS` and the
   * five `RATIO_NAMED` nicknames. **A live corpus with the same rule over it, not a retired clause** — which is
   * the whole reason the re-point was worth doing rather than deleting the clause with its old anchor.
   */
  const modelCopyText = modelCopy.join('\n');
  const modelBad = ['phase', 'twist', 'breathes', 'amplitude', 'frequency'].filter(w => hit(modelCopyText, w));
  chk('...and the MODEL\'s own user-facing strings use the row\'s word too — copy can live in the model',
    modelBad.length === 0 && modelCopy.length > 0,
    modelBad.length ? `still present in model copy: ${modelBad.join(', ')}`
      : modelCopy.length === 0 ? 'EMPTY CORPUS — the model exports no copy, so this asserted nothing'
        : `${modelCopy.length} literals, ${modelCopyText.length} chars (slot + axis labels, ratio nicknames)`);
  seed('the shipped defect this clause was added for — `Z has a phase of its own`, once a `tierReasons` string',
    ['phase', 'twist'].filter(w => hit(`${modelCopyText}\nreasons.push('Z has a phase of its own');`, w)).length,
    'this exact string was live and §N was GREEN, because its corpus was two files and the copy was in a third');
  /*
   * ⚠️ **THE EMPTY-CORPUS SEED SURVIVES THE RE-POINT AND ITS FORM CHANGED WITH IT, WHICH IS THE POINT.** The old
   * seed renamed the anchor (`tierOfRenamed`) — the exact failure mode a whole-file corpus no longer HAS, so
   * keeping it would be a seed that cannot fail. It now seeds an empty corpus DIRECTLY, which is still reachable:
   * a future refactor moving `SLOT_LABELS`/`AXIS_LABELS`/`RATIO_NAMED` out of this file would empty it silently.
   * **An absence test over an empty corpus reports PASS, and the length guard is the only thing that catches it.**
   */
  seed('an empty model corpus, i.e. the copy relocated out of the file this clause reads',
    (['phase', 'twist'].every(w => !hit('', w)) ? 1 : 0),
    'an empty corpus passes every absence assertion, which is why the length guard is part of the clause');
  /*
   * ⚠️ **`bodyOfSrc`'S OWN BASIS STAYS SEEDED EVEN THOUGH THIS CLAUSE NO LONGER USES IT, AND THE RE-POINT IS THE
   * REASON TO KEEP IT RATHER THAN TO DROP IT.** The helper took the first `{` after a declaration, which for
   * `tierOf` was its RETURN TYPE — 39 chars of annotation, zero string literals, so the clause over it reported
   * ANCHOR MISS. It had been correct for eleven earlier anchors only because every one returns `void` or
   * `HTMLElement`; the defect was LATENT IN THE INSTRUMENT and unreachable from the one file it could read.
   * **A helper is part of the measurement, so a fix to a helper needs a seed like any other section.** With
   * `tierOf` deleted the seed is re-pointed at a live `): {`-returning declaration — `sampleCountFor` in
   * `score-canvas.ts` — which is what makes this a property of the HELPER rather than of one former call site.
   */
  const scoreSrc = readFileSync(join(ROOT, 'src/ui/synthesis-lab/score-canvas.ts'), 'utf8');
  const typedDecl = 'export function sampleCountFor';
  const properBody = bodyOfSrc(scoreSrc, typedDecl);
  const naiveBody = (() => {
    const start = scoreSrc.indexOf(typedDecl);
    const open = scoreSrc.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < scoreSrc.length; i++) {
      if (scoreSrc[i] === '{') depth++;
      else if (scoreSrc[i] === '}' && --depth === 0) return scoreSrc.slice(open, i + 1);
    }
    return '';
  })();
  seed('the FIRST-BRACE extractor, which reads a braced RETURN TYPE as the body',
    naiveBody.length > 0 && properBody.length > 0 && naiveBody.length < properBody.length / 2 ? 1 : 0,
    `on \`${typedDecl}\` the naive body is ${naiveBody.length} chars of type annotation vs `
      + `${properBody.length} of real body — a clause over it asserts almost nothing while looking green`);
  seed('a retired synonym reintroduced in a label or a tooltip',
    retired.filter(w => hit(`${surfaces}\nlab.textContent = 'Pulse breathes';\nx.title = 'the twist of Y';`, w)).length,
    'if the scan could not see a word in a label it would pass on the very copy 16.12 retired');
  // ⚠️ **AND THE CONVERSE SEED, WHICH THE FIRST RUN PROVED IS NOT REDUNDANT: the scan must NOT see a retired word
  // in an identifier, or it fails on the internal name the design deliberately keeps.** Since 16.15 the surviving
  // identifier is `SEED_TWIST` — the two the first run flagged (`simpleOf().twist`, `SIMPLE_FIELD_LABELS.twist`)
  // died with the tier, so the seed now names the one that is really in the tree.
  seed('a scan over raw source instead of copy, which reads `SEED_TWIST` as user-facing text',
    retired.filter(w => hit(`${strip(modelSrc)}\n${strip(tabSrc)}`, w)).length,
    'a clause that cannot distinguish an identifier from a label would have to be exempted into uselessness');
  // ⚠️ **AND THE SEVEN LIVE WORDS MUST ALL BE PRESENT** — the absence clause alone would pass on a tab with no
  // labels at all, which is the `CLAUDE.md` shape of an unreachable assertion reading exactly like a green one.
  const live = ['Winding', 'Size', 'Shift', 'Pulse', 'Pulse rate', 'Wobble', 'Wobble rate'];
  const missing = live.filter(w => !new RegExp(`'[^']*${w}`, '').test(strip(tabSrc)));
  chk('...and all SEVEN live words DO appear, so the absence clause is not passing on an empty tab',
    missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : `${live.length} words, one per stored field, all present`);
}


console.log('\n§O — the ratio thumbnails are LEGIBLE AT THE SIZE THEY ARE ACTUALLY DRAWN (16.14 / E105)');

/*
 * ⚠️ **THIS SECTION EXISTS BECAUSE A FUNCTION WENT WRONG WITHOUT BEING EDITED, AND NO INSTRUMENT IN THE PROJECT
 * COULD SEE IT.** `drawScore` padded its box by an absolute `10 * dpr`, correct for the ~300 px Shape diagram it
 * was written for. 16.9 moved that diagram to `drawOverlayScore`, leaving `drawScore` as the RATIO THUMBNAILS'
 * renderer alone — a 22 px canvas, where the same expression left the figure a **2 px** drawing box: 9.1 % of the
 * square, the rest crosshair and margin. `tsc` sees two `number`s; the other twelve checkers do not read this
 * file; §I and §N assert what the curves ARE, never how much of the canvas they get. **The owner reported it as
 * "not readable" and named brightness, thickness and size — all three real, all three secondary to this.**
 *
 * ⚠️ **THE GENERAL PROPERTY, WHICH IS WHY THIS IS A SECTION AND NOT A ONE-LINE FIX: WHEN A DRAWING SURFACE IS
 * RE-HOMED, THE ABANDONED FUNCTION'S CONSTANTS DO NOT MOVE WITH ITS CALLERS.** That is invariant 26 (one shared
 * scale for an image-domain length) arriving through the CALL GRAPH rather than through a canvas shape, and the
 * only oracle that can catch it is one that evaluates the geometry at the sizes the UI really uses.
 *
 * ⚠️ **IT ASSERTS A RATIO, NOT THE TWO CONSTANTS — and `scorePad` is IMPORTED, not grepped.** `CLAUDE.md`: a
 * source-shaped clause's remedy is to move the subject into the model, because a re-pointed regex survives only
 * until the next rename. So retuning 0.06 or the 10 px cap is free; shrinking the figure's share of the square is
 * not. The sizes come from `panel.css` itself, so the clause cannot be satisfied by a stale figure in a document.
 */
{
  const { scorePad } = SC;
  const cssThumb = readFileSync(join(ROOT, 'src/ui/synthesis-lab/panel.css'), 'utf8');
  const thumbBlock = (cssThumb.match(/\.sl-composer-thumb\s*\{[^}]*\}/) ?? [''])[0];
  const thumbPx = Number((thumbBlock.match(/width:\s*(\d+)px/) ?? [])[1]);
  // ⚠️ **ANCHOR HEALTH FIRST — an anchor that matched nothing yields `NaN` and every comparison below would be
  // `false`, which is a FAIL and therefore safe; but a clause that fails for the wrong reason is a wrong finding,
  // so the size is asserted to have been READ.** `panel.css` is the ONE owner of this number.
  chk('the thumbnail size is READ from `panel.css`, the one owner — not assumed, not quoted from a document',
    Number.isFinite(thumbPx) && thumbPx > 0,
    Number.isFinite(thumbPx) ? `.sl-composer-thumb is ${thumbPx}px square`
      : 'the `.sl-composer-thumb` width anchor matched nothing — suspect the instrument before the CSS');

  /*
   * ⚠️ **BOTH DPRs, BECAUSE THE DEFECT WAS A RATIO OF A CONSTANT TO A VARIABLE AND `dpr` MULTIPLIES BOTH SIDES
   * OF THE OLD EXPRESSION.** `10 * dpr` against a backing store of `css * dpr` gives the SAME 9.1 % at dpr 1 and
   * dpr 2 — so a one-DPR oracle would have measured the defect correctly and a one-DPR oracle that happened to
   * pick the wrong size would not. The sizes measured are the two the tab draws (`thumbPx`) plus `drawScore`'s
   * own documented `|| 300` no-layout fallback, which must stay byte-identical.
   */
  const share = (css, dpr) => {
    const w = Math.round(css * dpr), h = Math.round(css * dpr);
    return (Math.min(w, h) - 2 * scorePad(w, h, dpr)) / Math.min(w, h);
  };
  const MIN_SHARE = 0.80;
  const drawn = [[thumbPx, 1], [thumbPx, 2]];
  const tooTight = drawn.filter(([css, dpr]) => share(css, dpr) < MIN_SHARE);
  chk('at every size the ratio list actually draws, the FIGURE gets at least 80 % of the shorter side',
    tooTight.length === 0,
    tooTight.length
      ? tooTight.map(([css, dpr]) => `${css}px@dpr${dpr} = ${(100 * share(css, dpr)).toFixed(1)} %`).join(', ')
      : drawn.map(([css, dpr]) => `${css}px@dpr${dpr} ${(100 * share(css, dpr)).toFixed(1)} %`).join(', ')
        + ` (the shipped 22px@dpr1 measured 9.1 %, which is what this forbids)`);

  /*
   * ⚠️ **AND THE LARGE-CANVAS PATH MUST BE BYTE-IDENTICAL, which is a claim the ratio clause above CANNOT make** —
   * a pad of 0 would satisfy it on every size while changing the fallback rendering. This pins the `Math.min`.
   */
  chk('...and a canvas at the documented `|| 300` fallback pads EXACTLY as it did before 16.14 — the `min` cap',
    scorePad(300, 220, 1) === 10 && scorePad(600, 440, 2) === 20,
    `300x220@dpr1 -> ${scorePad(300, 220, 1)} (was 10), 600x440@dpr2 -> ${scorePad(600, 440, 2)} (was 20)`);

  // ⚠️ The seed is the SHIPPED expression, not an invented strawman — `CLAUDE.md`'s rule for this file.
  seed('the pre-16.14 absolute `pad = 10 * dpr`, correct for a 300 px canvas and 9.1 % of a 22 px one',
    drawn.filter(([css, dpr]) => {
      const w = Math.round(css * dpr);
      return (w - 2 * (10 * dpr)) / w < MIN_SHARE;
    }).length,
    'if the old expression passed at the shipped thumbnail size the clause would be asserting nothing — the '
      + 'defect the owner reported would be green');

  /*
   * ⚠️ **A SECOND SEED, AND IT IS THE ONE THAT MAKES THE CLAUSE ABOUT invariant 26 RATHER THAN ABOUT A NUMBER: a
   * PER-AXIS pad passes the ratio test above and is still the defect.** Measuring the pad on each axis
   * independently keeps the same 6 % fraction on both, so the share of the SHORTER side is unchanged — and yet the
   * figure is off-centre on any non-square canvas, which is precisely invariant 26's anisotropy. The property the
   * seed can fail is therefore CENTRING, measured as the two axes' pads being equal on a non-square box.
   *
   * ⚠️ **THE CANVAS SIZE HERE IS LOAD-BEARING AND ITS FIRST VALUE MADE THE SEED ALGEBRAICALLY IMPOSSIBLE — the
   * `CLAUDE.md` trap, caught by this file's own calibration rule on the first run.** I wrote 400x200, where BOTH
   * per-axis pads saturate the 10 px cap (`min(10, 24)` and `min(10, 12)`), so the anisotropic version returns the
   * same number as the shipped one: 0 violations, CALIBRATION FAIL — and the shipped clause beside it was implied
   * for exactly the same reason, passing on arithmetic that had nothing to do with sharing a scale. **The seed has
   * to sit in the regime the clause is about**, i.e. where the 6 % fraction governs rather than the cap, which is
   * the THUMBNAIL regime — the only one that motivated the change. Hence a 34x20 box: `2.04` vs `1.2`.
   */
  const NSQ = [thumbPx, Math.round(thumbPx * 0.6)];
  seed('a per-axis pad (`w*0.06`, `h*0.06`), which keeps the 80 % share and still centres the figure wrongly',
    Math.min(10, NSQ[0] * 0.06) !== Math.min(10, NSQ[1] * 0.06) ? 1 : 0,
    `if the two axes agreed on a ${NSQ[0]}x${NSQ[1]} canvas the seed would not be reproducing anisotropy at all `
      + '— which is what 400x200 did, where both per-axis pads saturate the 10 px cap');
  chk('...and the shipped pad is ONE number for both axes, so a non-square canvas centres the figure (inv. 26)',
    scorePad(NSQ[0], NSQ[1], 1) === scorePad(NSQ[1], NSQ[0], 1)
    // ⚠️ The regime guard: without it this clause passes wherever the cap binds, asserting nothing about sharing.
    && scorePad(NSQ[0], NSQ[1], 1) < 10 * 1,
    `${NSQ[0]}x${NSQ[1]} and ${NSQ[1]}x${NSQ[0]} both pad ${scorePad(NSQ[0], NSQ[1], 1)} (< the 10 px cap, so the `
      + 'fraction is what is being measured) — transposing the canvas cannot move the figure off centre');

  /*
   * ⚠️ **THE COLOURS AND WIDTHS ARE A SEPARATE SUBJECT WITH A SEPARATE FAILURE MODE, AND THE FAILURE IS §N's:
   * BRIGHTENING THE THUMBNAILS BY EDITING `OVERLAY_STYLES` WOULD RECOLOUR THREE CAPTIONED CURVES.** §N asserts
   * each legend hex EQUALS the curve colour it names, per key, so that edit fails there — correctly, and in a
   * place that names the legend rather than the thumbnails. This clause is the other direction: the two style
   * blocks must be DISTINCT declarations, because one shared block is what makes the mistake available at all.
   * SOURCE-SHAPED and it says so — the subject is the existence of two declarations, which no arithmetic can see.
   */
  const thumbStyles = (scoreSrc.match(/const THUMB_STYLES = \{[\s\S]*?\} as const;/) ?? [''])[0];
  const thumbWidths = [...thumbStyles.matchAll(/width:\s*([\d.]+)/g)].map(m => Number(m[1]));
  const overlayWidths = [...stylesBlock.matchAll(/width:\s*([\d.]+)/g)].map(m => Number(m[1]));
  chk('the thumbnails have their OWN style block, so brightening them cannot recolour the captioned legend',
    thumbStyles.length > 0 && stylesBlock.length > 0 && thumbWidths.length === 2 && overlayWidths.length === 3,
    thumbStyles.length && stylesBlock.length
      ? `THUMB_STYLES widths ${thumbWidths.join('/')} vs OVERLAY_STYLES ${overlayWidths.join('/')} — two blocks`
      : `THUMB_STYLES ${thumbStyles.length} chars, OVERLAY_STYLES ${stylesBlock.length} — an anchor that matched `
        + 'nothing is the failure to suspect first');
  chk('...and every thumbnail stroke is THICKER than the overlay stroke it replaces — the owner asked for thick',
    thumbWidths.length === 2 && overlayWidths.length === 3
      && Math.min(...thumbWidths) > Math.max(...overlayWidths),
    `thinnest thumbnail stroke ${Math.min(...thumbWidths)} vs thickest overlay stroke `
      + `${Math.max(...overlayWidths)} — a shared block would make these equal by construction`);
  /*
   * ⚠️ **AND THE OPACITY, WHICH IS THE THIRD OF THE OWNER'S THREE WORDS. The live path must be FULLY opaque** —
   * `rgba(190,220,255,0.92)` over a `#0d0d1c` tile is what "needs to be more bright (white)" was about, and an
   * alpha under 1 is invisible to any width or colour clause above.
   */
  const thumbPathAlpha = Number((thumbStyles.match(/path:\s*\{\s*style:\s*'rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)/) ?? [])[1]);
  chk('...and the LIVE path is drawn fully opaque, which is the third of the three words in the report',
    thumbPathAlpha === 1,
    Number.isFinite(thumbPathAlpha) ? `THUMB_STYLES.path alpha ${thumbPathAlpha} (was 0.92 on the shipped blend)`
      : 'the `THUMB_STYLES.path` alpha anchor matched nothing');

  /*
   * ⚠️ **THE LIST'S `max-height` AND THE THUMBNAIL SIZE ARE ONE CHANGE, AND THIS IS THE CLAUSE THAT MAKES THE CSS
   * COMMENT ENFORCEABLE.** A row is `max(thumb, caption) + border + padding` tall, so growing the icon shrinks how
   * many of the TWENTY rows are visible; at the old 220 px cap a 34 px thumb shows five. **The clause is a count
   * of VISIBLE ROWS, not either number** — so the pair can be retuned together and cannot be changed apart.
   */
  const listBlock = (cssThumb.match(/\.sl-composer-combo-list\s*\{[^}]*\}/) ?? [''])[0];
  const maxH = Number((listBlock.match(/max-height:\s*(\d+)px/) ?? [])[1]);
  // Row height: the thumbnail plus its 1 px borders (⚠️ `box-sizing` is set NOWHERE in `panel.css`, so the border
  // is OUTSIDE the declared width) plus `.sl-composer-combo-opt`'s 2 px padding and 1 px transparent border, both
  // sides. Read from the file rather than assumed, for the same reason the size is.
  const optBlock = (cssThumb.match(/\.sl-composer-combo-opt\s*\{[^}]*\}/) ?? [''])[0];
  const optPad = Number((optBlock.match(/padding:\s*(\d+)px/) ?? [])[1]);
  const rowPx = thumbPx + 2 * 1 + 2 * optPad + 2 * 1;
  const visible = Math.floor(maxH / rowPx);
  chk('the list still shows at least SEVEN of the twenty rows — bigger icons may not be paid for with scrolling',
    Number.isFinite(maxH) && Number.isFinite(optPad) && visible >= 7,
    Number.isFinite(maxH) && Number.isFinite(optPad)
      ? `${maxH}px / ${rowPx}px per row = ${visible} of ${RATIO_ROWS.length} rows visible`
      : `anchors: max-height ${maxH}, opt padding ${optPad} — an anchor miss, not a CSS regression`);
  seed('the thumbnail grown to 34 px while `max-height` stayed at the 220 px written for 22 px icons',
    Math.floor(220 / rowPx) < 7 ? 1 : 0,
    'if the old cap still showed seven rows the two numbers would not be coupled and 16.14 would not need to '
      + 'change them together — the clause would be asserting a coincidence');
}

// ===================================================================================================
console.log('\n§P — the per-row `Clear`: what it zeroes, what it may NOT touch, and what it re-inerts (16.16 / E107)');
// ---------------------------------------------------------------------------------------------------
/*
 * ⚠️ **THE SUBJECT IS NOT "DOES IT WRITE ZERO" — IT IS WHAT ELSE MOVES, AND THAT IS WHERE EVERY DEFECT IN THIS
 * SHAPE HAS LIVED.** A destructive control is trivially correct on the field it names; §E's whole class of silent
 * modulator loss came from a writer touching a field the user had not asked about. So the measured clause is a
 * SCOPE claim over the library: one field, three axes, one slot, nothing else — the same property §L had to be
 * inverted into for the dial, applied to the one control whose entire purpose is to destroy data.
 *
 * ⚠️ **AND THE SECOND SUBJECT IS A CONSEQUENCE IN A DIFFERENT CONTROL, WHICH IS WHY THIS IS A SECTION RATHER THAN
 * A CLAUSE IN §E.** Clearing `Winding` makes `phaseForTarget` refuse on that axis, so a live dial must become an
 * inert one — `Clear` is the only control on the tab that can disable a DIFFERENT control. That is measured here
 * (how many live slots it actually re-inerts) and pinned in the source (the transition is re-derived by
 * `paintDial` from the model, so the commit path is what carries it — a hand-written repaint would not).
 *
 * ⚠️ **PARTLY SOURCE-SHAPED, AND IT SAYS SO — the same disclosure §H/§J/§K/§L/§M/§N carry.** The scope and the
 * re-inert counts are MEASURED over all 854 live slots; the "routes through `commit()`" and "no confirm dialog"
 * clauses are source-shaped, because the defect is an ABSENT statement (or an added one) that no arithmetic over
 * the library can see. A measured failure here means wrong arithmetic for the whole library; a source-shaped one
 * means the named owner was bypassed or renamed.
 */
{
  const CLEAR_FIELDS = ['winding', 'size', 'phase', 'pulse', 'pulseRate', 'wobble', 'wobbleRate'];
  const ALL_FIELDS = [...CLEAR_FIELDS];

  /*
   * ⚠️ **THE SEVEN CLEARABLE FIELDS ARE ASSERTED AGAINST THE MODEL'S OWN CELL, NOT AGAINST A LIST IN THIS FILE —
   * otherwise this section defines its own subject and an eighth stored field would be silently un-clearable.**
   * `readFigure` is the ONE producer of an `AxisCell`, so its keys minus the three DERIVED readouts are exactly
   * the stored fields a row can exist for. **`closes`/`effectivePhase`/`silent` are named as the exemption** —
   * they are recomputed from the others and a `Clear` writing one would be a second owner of a derived value.
   */
  const DERIVED = ['closes', 'effectivePhase', 'silent'];
  const cellKeys = Object.keys(cellsOf(liveSlots[0].wave)[0]).filter(k => !DERIVED.includes(k));
  const uncovered = cellKeys.filter(k => !CLEAR_FIELDS.includes(k));
  chk('every STORED field on an `AxisCell` has a clearable row — the seven, derived readouts excepted',
    cellKeys.length === CLEAR_FIELDS.length && uncovered.length === 0,
    uncovered.length ? `no row clears: ${uncovered.join(', ')}`
      : `${cellKeys.length} stored fields, all clearable; ${DERIVED.length} derived readouts excluded by design`);
  seed('an eighth stored field added to the cell with no `Clear` row for it',
    ['winding', 'size', 'phase', 'pulse', 'pulseRate', 'wobble', 'wobbleRate', 'skew']
      .filter(k => !CLEAR_FIELDS.includes(k)).length,
    'a list of rows written by hand in this file could not see a new field, which is why the keys are read from the model');

  /*
   * ⚠️ **THE SCOPE CLAUSE, MEASURED: three axes of ONE field on ONE slot go to zero and every other number in the
   * figure is byte-identical.** The oracle transcribes `clearAxisRow`'s write — the field plus the three derived
   * readouts — and then compares the WHOLE model, both other slots included, because the failure worth catching is
   * a loop over `this.model.slots` instead of over one slot's axes.
   */
  let clrCases = 0, clrOk = 0;
  const modelOf = (p) => readFigure(p);
  const flat = (m) => m.slots.flatMap(s => s.axes.map(c => ALL_FIELDS.map(f => c[f]).join(',')));
  for (const [, p] of presets.slice(0, 200)) {
    const before = flat(modelOf(p));
    for (let w = 0; w < MAX_WAVES; w++) {
      for (const field of CLEAR_FIELDS) {
        const m = modelOf(p);
        for (const cell of m.slots[w].axes) {
          cell[field] = 0;
          cell.closes = Math.abs(cell.winding - Math.round(cell.winding)) < 1e-9;
          cell.effectivePhase = wrap360(cell.phase * cell.winding);
          cell.silent = cell.size + cell.pulse === 0;
        }
        clrCases++;
        const after = flat(m);
        // Exactly the three cells of this slot may differ, and within them exactly the one field.
        const rowsOk = after.every((row, i) => {
          const slotOf = Math.floor(i / AXES);
          if (slotOf !== w) return row === before[i];
          const a = row.split(','), b = before[i].split(',');
          return a.every((v, k) => (ALL_FIELDS[k] === field ? Number(v) === 0 : v === b[k]));
        });
        if (rowsOk) clrOk++;
      }
    }
  }
  chk('a `Clear` zeroes ONE field on THREE axes of ONE slot and leaves every other number byte-identical',
    clrCases > 0 && clrOk === clrCases,
    `${clrOk} of ${clrCases} (preset x slot x field) clears touch nothing they were not asked to`);
  /*
   * ⚠️ **THE SEED IS THE PLAUSIBLE WRONG LOOP, NOT AN INVENTED ONE: `for (const slot of model.slots)` instead of
   * `model.slots[slot].axes`** — one word different, type-checks, and clears the field on the whole FIGURE. It is
   * the shape a `Clear` written from the header-actions pattern (`New Figure`, `Stack`) produces, because every
   * other action on this tab IS figure-wide.
   */
  seed('a `Clear` that loops over every slot rather than the one it belongs to',
    (() => {
      let n = 0;
      for (const [, p] of presets.slice(0, 200)) {
        const m = modelOf(p);
        const before = flat(m);
        for (const s of m.slots) for (const cell of s.axes) cell.size = 0;
        if (flat(m).some((row, i) => row !== before[i])) n++;
      }
      return n;
    })(),
    'if the library authored one lit slot per preset a figure-wide clear would be indistinguishable from a row one');

  /*
   * ⚠️ **THE RE-INERT CONSEQUENCE, MEASURED — AND THE FIGURE IS THE ARGUMENT FOR ROUTING THROUGH `commit()`.**
   * After a `Winding` clear every axis of that slot refuses a phase write, so all three dials must go inert. The
   * count is what makes this a real case rather than a defensive one.
   */
  let reinertSlots = 0, reinertAxes = 0, liveDialAxesBefore = 0;
  for (const s of liveSlots) {
    const c = cellsOf(s.wave);
    const liveBefore = c.filter(x => phaseForTarget(90, x.winding) !== null).length;
    liveDialAxesBefore += liveBefore;
    for (const x of c) x.winding = 0;
    const liveAfter = c.filter(x => phaseForTarget(90, x.winding) !== null).length;
    if (liveBefore > 0 && liveAfter === 0) { reinertSlots++; reinertAxes += liveBefore; }
  }
  chk('MEASURED: clearing `Winding` turns EVERY live dial on that slot inert — `phaseForTarget` refuses all three',
    reinertSlots > 0 && reinertAxes > 0,
    `${reinertSlots} of ${liveSlots.length} live slots carry at least one live dial (${reinertAxes} of `
    + `${liveDialAxesBefore} axes), and a \`Winding\` clear inerts all of them — which is why the transition is `
    + 're-derived by `paintDial` from the model on every `sync()` rather than repainted by the clear');
  seed('a `Clear` that writes the numbers and repaints them, leaving a live-looking dial over a winding of zero',
    liveSlots.filter(s => cellsOf(s.wave).some(x => phaseForTarget(90, x.winding) !== null)).length,
    'if no live slot had a live dial the inert transition could never be reached and the clause would be decorative');
  // ⚠️ And the algebra it rests on, pinned separately: a zero winding is REFUSED, never divided (§L owns the
  // general case; this states it for the value a `Clear` actually writes).
  chk('...and the value a `Clear` writes is exactly the one `phaseForTarget` refuses — 0, not a small number',
    phaseForTarget(90, 0) === null && phaseForTarget(90, 1e-12) !== null,
    'a clear to a tiny epsilon instead of 0 would keep the dial live and store an astronomic phase');

  /*
   * ⚠️ **BOTH ORDERS, AND THEY DIFFER — WHICH IS THE HALF THE PLAN NAMED AND THE HALF A SINGLE-CLICK TEST CANNOT
   * SEE.** `Size` then `Pulse` and `Pulse` then `Size` both end silent, but the INTERMEDIATE state differs, and
   * the row's body depends on it: a slot still lit by its pulse must keep its inputs. The counts are printed
   * because they are what makes the rebuild conditional on the RESULT rather than on the field.
   */
  let orderCases = 0, orderOk = 0, silentAfterSize = 0, silentAfterPulse = 0, needSecond = 0;
  for (const s of liveSlots) {
    for (const order of [['size', 'pulse'], ['pulse', 'size']]) {
      const c = cellsOf(s.wave);
      const sil = () => c.every(x => x.size + x.pulse === 0);
      for (const x of c) { x[order[0]] = 0; x.silent = x.size + x.pulse === 0; }
      const mid = sil();
      for (const x of c) { x[order[1]] = 0; x.silent = x.size + x.pulse === 0; }
      orderCases++;
      // The end state is silent in BOTH orders — that is the property; `mid` is what the two orders disagree on.
      if (sil()) orderOk++;
      if (order[0] === 'size' && mid) silentAfterSize++;
      if (order[0] === 'pulse' && mid) silentAfterPulse++;
      if (order[0] === 'size' && !mid) needSecond++;
    }
  }
  chk('clearing `Size` and `Pulse` in EITHER order ends the slot silent — the end state is order-independent',
    orderCases > 0 && orderOk === orderCases,
    `${orderOk} of ${orderCases} (live slot x order) end silent; the INTERMEDIATE differs — ${silentAfterSize} `
    + `slots are silent after \`Size\` alone and ${silentAfterPulse} after \`Pulse\` alone, so ${needSecond} `
    + 'need the second click and must keep their inputs until it comes');
  seed('a rebuild gated on the FIELD (`field === \'size\'`) instead of on the resulting silence',
    needSecond,
    'if every slot went silent on a `Size` clear the field test and the result test would agree and the '
      + 'distinction would be untestable');

  /*
   * ⚠️ **THE ONE-WAY ARGUMENT, MEASURED RATHER THAN ASSUMED — and it is what licenses a single `if`.** A `Clear`
   * can only remove reach unless an axis is silent by CANCELLATION (`size 5, pulse −5`), where clearing `pulse`
   * would LIGHT it. A silent slot renders the placeholder and has no button, so that path is unreachable from this
   * control — but the claim is only sound if the state cannot be loaded either. Measured: 0 of 3591 authored axes.
   */
  const cancelAxes = slots.flatMap(s => cellsOf(s.wave))
    .filter(a => a.size + a.pulse === 0 && !(a.size === 0 && a.pulse === 0));
  chk('MEASURED: no authored axis is silent by CANCELLATION, so `Clear` can only ever go lit -> silent',
    cancelAxes.length === 0,
    cancelAxes.length === 0
      ? `0 of ${slots.flatMap(s => cellsOf(s.wave)).length} axes carry size + pulse === 0 with either nonzero, so `
        + 'the silent -> lit direction is unreachable from a clear and one `if` is enough'
      : `${cancelAxes.length} axes are silent by cancellation — the rebuild needs BOTH directions`);
  seed('an axis silent by cancellation, where clearing `Pulse` LIGHTS the slot',
    (() => {
      const c = cellsOf(liveSlots[0].wave);
      c[0].size = 5; c[0].pulse = -5;
      const wasSilent = c.every(x => x.size + x.pulse === 0);
      for (const x of c) { x.size = 0; x.pulse = 0; }
      // The seed's subject is that such an axis is REPRESENTABLE, which is why the clause is a measurement over
      // the library and not an argument from the type.
      return (c[0].size + c[0].pulse === 0 && !wasSilent) ? 1 : 0;
    })(),
    'if the cancellation state were not representable the measurement above would be about the type, not the data');

  /*
   * ⚠️ **SOURCE-SHAPED, AND THE THREE CLAUSES ARE THE THREE OWNER DECISIONS: one click, one commit path, no
   * history.** Each is an ABSENT statement, which no arithmetic can see. `CLAUDE.md`: a source-shaped clause's
   * remedy is to move the subject into the model — not available here, because the subject is a UI event handler,
   * so the anchor health is asserted first and the disclosure is this paragraph.
   */
  const clearBody = bodyOfTab('private clearAxisRow(slot: number, field: Cell[\'field\']): void');
  const clearBtnBody = bodyOfTab('private axisClearButton(slot: number, field: Cell[\'field\'], label: string): HTMLButtonElement');
  chk('ANCHOR: both halves of the `Clear` control are locatable in the source',
    clearBody.length > 0 && clearBtnBody.length > 0,
    `clearAxisRow ${clearBody.length} chars, axisClearButton ${clearBtnBody.length} chars — an empty body would `
    + 'assert nothing, and a signature is part of an anchor (16.15 lost two to a deleted argument)');
  const oracleOneClick = (s) => (/confirm\(|window\.confirm|pushSnapshot/.test(s) ? 1 : 0);
  chk('SOURCE: no confirmation and no history entry — the owner chose one click, immediate and unrecoverable',
    oracleOneClick(clearBody) === 0 && oracleOneClick(clearBtnBody) === 0,
    'a `confirm()` or a `pushSnapshot` here would be a second decision taken on the owner\'s behalf');
  seed('a confirmation dialog added to `Clear`, the plausible defensive edit',
    oracleOneClick(`${clearBody}\n    if (!confirm('Clear this row?')) return;`),
    'the decision was asked and answered — immediacy over recoverability — so the scan must be able to see it arrive');
  const oracleCommitPath = (s) => (
    /this\.commit\(/.test(s) && !/setWorkingPreset|setWaves\(|writeFigure\(/.test(s) ? 0 : 1);
  chk('...and it commits through the ONE path, never writing the preset or the engine itself',
    oracleCommitPath(clearBody) === 0,
    '`commit()` owns `refreshDerived` -> `growSlotCountForAuthoredContent` -> `writeFigure` -> `setWaves` -> '
    + '`sync`, and it is `sync()` that re-inerts the dial');
  seed('a `Clear` that writes the preset and the engine itself, bypassing `commit()`',
    oracleCommitPath('for (const cell of model.axes) cell[field] = 0;\n    writeFigure(p, this.model);'),
    'a second apply path is `CLAUDE.md`\'s D5 shape and would skip the derived recomputation and the repaint');
  // ⚠️ **AND THE REBUILD MUST BE THERE AT ALL** — the half a values-only implementation drops, and the one that
  // reads as a working control until the level goes silent and the row keeps showing inputs over a dead wave.
  chk('...and it rebuilds the row body when the level goes silent — `sync()` cannot remove inputs',
    /renderSlotBody\(slot\)/.test(clearBody) && /model\.silent/.test(clearBody),
    'a values-only clear leaves 21 live inputs over a wave with no size and no placeholder saying so');
  seed('a values-only `Clear`, with no body rebuild',
    /renderSlotBody/.test(clearBody.replace(/this\.renderSlotBody\(slot\);/, '')) ? 0 : 1,
    'the silent placeholder is an early `return` in `renderSlotBody`, so nothing else can produce it');

  /*
   * ⚠️ **THE TOOLTIP IS PART OF THE CONTROL AND ITS TEXT IS ASSERTED, NOT ITS EXISTENCE — `tipcheck` already pins
   * that the key is read and defined, so a clause repeating that would be implied by a sibling checker.** What
   * `tipcheck` cannot see is WHICH facts the sentence carries, and both are preconditions the owner's decisions
   * created: that it is immediate, and that clearing `Winding` disables a different control.
   */
  const clearTip = (readFileSync(join(ROOT, 'src/ui/synthesis-lab/tooltips.ts'), 'utf8')
    .match(/'composer\.clear':([\s\S]*?)',\n/) ?? [''])[0];
  const saysImmediate = /immediat|no undo|no confirmation/i.test(clearTip);
  const saysDial = /dial/i.test(clearTip) && /[Ww]inding/.test(clearTip);
  chk('the tooltip states BOTH consequences: that it is immediate, and that clearing Winding disables the dial',
    clearTip.length > 0 && saysImmediate && saysDial,
    clearTip.length === 0 ? 'the `composer.clear` anchor matched nothing — suspect the instrument first'
      : `${clearTip.length} chars; immediate ${saysImmediate}, dial consequence ${saysDial}`);
  seed('a tooltip that describes the control but not that it cannot be undone',
    (() => {
      const t = "'composer.clear': 'Set this row to zero on all three axes.',\n";
      return (/immediat|no undo|no confirmation/i.test(t) ? 0 : 1);
    })(),
    'with no confirmation dialog the tooltip is the ONLY place the irreversibility can be stated');

  /*
   * ⚠️ **THE CSS CLAUSE IS ABOUT COLUMN ALIGNMENT AND IT IS THE ONE A BROWSER PASS WOULD CATCH LAST, BECAUSE IT
   * LOOKS FINE UNTIL YOU COMPARE ROWS.** `.sl-composer-num` is `flex: 1`; a button without `flex: 0 0 auto` becomes
   * a fourth flexible item, so the seven rows that HAVE a button get narrower fields than the dial row and the two
   * breathe rows, which do not. Read from `panel.css`, the one owner.
   */
  const clearCss = (cssSrc.match(/\.sl-composer-clear\s*\{[^}]*\}/) ?? [''])[0];
  const numCss = (cssSrc.match(/\.sl-composer-num\s*\{[^}]*\}/) ?? [''])[0];
  chk('the `Clear` button does not compete with the numeric fields for width — `flex: 0 0 auto` against `flex: 1`',
    clearCss.length > 0 && numCss.length > 0 && /flex:\s*0\s+0\s+auto/.test(clearCss) && /flex:\s*1/.test(numCss),
    clearCss.length && numCss.length
      ? `.sl-composer-clear is ${(clearCss.match(/width:\s*(\d+px)/) ?? ['', '?'])[1]} and unflexed, so the three `
        + 'numeric columns line up with the dial and breathe rows that have no button'
      : `anchors: .sl-composer-clear ${clearCss.length} chars, .sl-composer-num ${numCss.length} — an anchor miss`);
  seed('the button left flexible, which narrows the fields on the seven rows that have one',
    /flex:\s*0\s+0\s+auto/.test('.sl-composer-clear { width: 20px; }') ? 0 : 1,
    'the rows without a button keep full-width fields, so the misalignment is between rows and invisible in one');
}

// ===================================================================================================
console.log('\n§Q — the per-level switch and the per-level `Clear`: a PROJECTION, not a state (16.17 / E108)');
// ---------------------------------------------------------------------------------------------------
/*
 * ⚠️ **THE SUBJECT IS THE PROJECTION, AND EVERY CLAUSE BELOW IS A CONSEQUENCE OF WHERE IT LIVES.** The owner
 * asked for two things that sound contradictory: a level *"temporarily turned off for the diagrams and the
 * preview"* whose *"export however or Snapshot would export them cleared"*. Both hold if and only if exactly one
 * figure ever leaves the tab — the muted one — with the authored numbers kept in the INPUTS and nowhere else.
 * So the mute is tab state plus ONE pure projection (`applyMutes`) at the ONE commit point, and this section
 * asserts the four properties that choice buys: purity, in-place zeroing, byte-exact recovery, and a visible
 * effect on the figure.
 *
 * ⚠️ **THE THREE REJECTED DESIGNS ARE THE SEEDS, NOT STRAWMEN — each is what a shorter implementation would be.**
 * (1) a MUTATING projection (drop `applyMutes`, zero the model in `commit()`) — the shortest version, and it makes
 * the checkbox identical to `Clear`; (2) a SHRINKING projection (derive `slotCount` from the muted figure) — the
 * version that reads as tidier and silently drops an authored slot; (3) a preset FIELD instead of tab state — the
 * version that survives a reload, needs a `MigrationLayer` backfill and a Mixer entry, and resurrects a wave on a
 * machine that never muted one. Every one of them type-checks and renders.
 *
 * ⚠️ **THE PARTS THAT ARE SOURCE-SHAPED SAY SO — the same disclosure §H/§J/§K/§L/§M/§N/§P carry.** The projection's
 * arithmetic is MEASURED over EVERY preset object and all three planes (the count is printed, not written here —
 * 419 at the 2026-09-19 run, and it moves with every settle batch); *"the projection is applied on the one
 * commit path"*, *"switching off touches no number"*, *"no confirm and no history"* and the copy/CSS clauses are
 * source-shaped, because each is an ABSENT statement no arithmetic over the library can see. A measured failure
 * here means wrong arithmetic for the whole library; a source-shaped one means the named owner was bypassed or
 * renamed.
 */
{
  /*
   * ⚠️ **`applyMutes` MUST BE PURE, AND THIS IS THE CLAUSE THE WHOLE FEATURE RESTS ON — the tab's own inputs are
   * the ONLY copy of a muted level's numbers.** If the projection touched the model, the checkbox would destroy
   * the data it promises to give back and would be indistinguishable from `Clear`. Asserted over the whole library
   * and all three slots by serialising the model before and after.
   */
  let purityCases = 0, purityBad = 0;
  for (const [, p] of presets) {
    const m = readFigure(p);
    const before = JSON.stringify(m);
    for (let w = 0; w < MAX_WAVES; w++) {
      const muted = [false, false, false];
      muted[w] = true;
      applyMutes(m, muted);
      purityCases++;
    }
    if (JSON.stringify(m) !== before) purityBad++;
  }
  chk('`applyMutes` is PURE — the model still holds every authored number after the projection is taken',
    purityCases > 0 && purityBad === 0,
    `${purityCases} (preset x slot) projections over ${presets.length} preset objects left the model byte-identical`);
  /*
   * ⚠️ **THE SEED IS DESIGN (1), THE SHORTEST IMPLEMENTATION: zero the model in place and skip the projection.**
   * It is measured by the property it actually breaks — the ROUND TRIP — because a purity oracle over a mutating
   * writer is trivially true of itself. Un-muting then cannot restore anything, so the figure is gone.
   */
  const mutatingMutes = (model, muted) => {
    model.slots.forEach((s, w) => {
      if (muted[w]) { s.axes = [blankAxisCell(), blankAxisCell(), blankAxisCell()]; s.silent = true; }
    });
    return model;
  };
  seed('design (1): a MUTATING projection — the shortest version, which makes the checkbox a second `Clear`',
    (() => {
      let n = 0;
      for (const [, p] of presets) {
        const before = JSON.stringify(p.generators.waves);
        for (let mask = 1; mask < 8; mask++) {
          const muted = [0, 1, 2].map(k => !!(mask & (1 << k)));
          const c = clone(p);
          const m = readFigure(c);
          writeFigure(c, mutatingMutes(m, muted));
          writeFigure(c, mutatingMutes(m, [false, false, false]));
          if (JSON.stringify(c.generators.waves) !== before) n++;
        }
      }
      return n;
    })(),
    'if the library authored only silent slots a mutating projection would round-trip and the purity claim would be untestable');

  /*
   * ⚠️ **MUTE THEN UN-MUTE IS BYTE-EXACT, OVER ALL EIGHT SUBSETS AND NOT ONLY ONE SLOT AT A TIME.** This is the
   * user-visible promise (*"we want to keep the content of the matrix"*) stated as arithmetic, and the subsets
   * matter: a projection that reused one scratch slot object would be correct for a single mute and wrong for two.
   * The un-mute is taken from the SAME model instance, which is exactly what the tab does — the recovery path is
   * `this.model`, never the written preset.
   */
  let rtCases = 0, rtBad = 0, rtFirst = '';
  for (const [name, p] of presets) {
    const before = JSON.stringify(p.generators.waves);
    for (let mask = 0; mask < 8; mask++) {
      const muted = [0, 1, 2].map(k => !!(mask & (1 << k)));
      const c = clone(p);
      const m = readFigure(c);
      writeFigure(c, applyMutes(m, muted));
      writeFigure(c, applyMutes(m, [false, false, false]));
      rtCases++;
      if (JSON.stringify(c.generators.waves) !== before) { rtBad++; if (!rtFirst) rtFirst = `${name} mask ${mask}`; }
    }
  }
  chk('mute -> un-mute returns a BYTE-IDENTICAL figure, over all 8 mute subsets of every preset',
    rtCases > 0 && rtBad === 0,
    rtBad ? `${rtBad} of ${rtCases} differ, first ${rtFirst}`
      : `${rtCases} (preset x subset) recoveries are byte-exact — ${presets.length} objects x 8 subsets`);
  /*
   * ⚠️ **AND THE PROJECTION'S CELLS MUST NOT ALIAS THE MODEL'S — a separate clause, because a projection that
   * SHARED a lit slot's cells would pass every clause above and still empty the tab's inputs the moment anything
   * downstream wrote through one.** `applyMutes` copies the muted slots and passes the lit ones through by
   * reference (deliberately — a lit slot is exactly the model's), so this asserts the half that must be a copy.
   */
  let aliasBad = 0;
  for (const [, p] of presets) {
    const m = readFigure(p);
    const before = JSON.stringify(m.slots.map(s => s.axes));
    for (let w = 0; w < MAX_WAVES; w++) {
      const muted = [false, false, false];
      muted[w] = true;
      const proj = applyMutes(m, muted);
      for (const c of proj.slots[w].axes) { c.size = 999; c.winding = 999; }
    }
    if (JSON.stringify(m.slots.map(s => s.axes)) !== before) aliasBad++;
  }
  chk('...and a muted slot gets NEW cells — writing through the projection cannot reach the tab\'s own inputs',
    aliasBad === 0,
    `${presets.length} models unmoved after every muted slot's cells were overwritten in the projection`);
  seed('a projection that shares the muted slot\'s cell objects with the model',
    (() => {
      let n = 0;
      for (const [, p] of presets.slice(0, 50)) {
        const m = readFigure(p);
        const before = JSON.stringify(m.slots.map(s => s.axes));
        // The plausible short version: reuse the slot object and zero its cells.
        const shared = { ...m, slots: m.slots.map((s, w) => (w === 0 ? s : s)) };
        for (const c of shared.slots[0].axes) c.size = 999;
        if (JSON.stringify(m.slots.map(s => s.axes)) !== before) n++;
      }
      return n;
    })(),
    'if a shared cell could not be written through, the copy would be decorative rather than load-bearing');

  /*
   * ⚠️ **A MUTED SLOT WRITES ZEROS IN PLACE AND `slotCount` DOES NOT MOVE — the plan states this in binding terms
   * and the reason is the library's own data.** 343 of 1197 slots are silent-but-present, so a silent slot is a
   * real authored state and dropping one is a silent rewrite in the direction `growSlotCountForAuthoredContent`'s
   * one-way rule exists to prevent. ⚠️ **THE FIGURE IS RE-DERIVED HERE AND IT IS NOT THE `651` THAT USED TO BE
   * QUOTED ELSEWHERE: that one counts silent AXES (651 of 1593 in the legacy JSON alone). Two bases, stated
   * separately, never summed** — `CLAUDE.md`'s own rule about this phase's figures. ⚠️ **AND WRITING IT DOWN HERE
   * IS WHAT EXPOSED THE DEFECT: `651 of 1197` was shipped in five places, a numerator from the axis/legacy basis
   * against the slot/all-groups denominator. All five now read 343 of 1197. Re-measured over all eight groups:
   * slots 343 of 1197 silent, axes 1437 of 3591; legacy JSON alone 155 of 531 and 651 of 1593.**
   */
  let zipCases = 0, zipOk = 0, zipLenChanged = 0;
  for (const [, p] of presets) {
    for (let mask = 1; mask < 8; mask++) {
      const muted = [0, 1, 2].map(k => !!(mask & (1 << k)));
      const c = clone(p);
      writeFigure(c, applyMutes(readFigure(c), muted));
      zipCases++;
      if (c.generators.waves.length !== p.generators.waves.length) { zipLenChanged++; continue; }
      let ok = true;
      for (let w = 0; w < c.generators.waves.length; w++) {
        const wv = c.generators.waves[w];
        if (muted[w]) {
          // ⚠️ EVERY stored number, not just the amplitude — a mute that left a winding behind would export a
          // level that is silent but not empty, which is a different authored state.
          if (!wv.axes.every(a => (a.phase ?? 0) === 0
            && (a.am.base ?? 0) === 0 && (a.am.amplitude ?? 0) === 0 && (a.am.frequency ?? 0) === 0
            && (a.fm.base ?? 0) === 0 && (a.fm.amplitude ?? 0) === 0 && (a.fm.frequency ?? 0) === 0)) ok = false;
        } else if (JSON.stringify(wv.axes) !== JSON.stringify(p.generators.waves[w].axes)) ok = false;
      }
      if (ok) zipOk++;
    }
  }
  const silentSlotCount = presets.reduce((n, [, p]) => n + readFigure(p).slots.filter(s => s.silent).length, 0);
  chk('a muted level writes ZEROS IN PLACE — the slot count never moves and no unmuted level is touched',
    zipCases > 0 && zipOk === zipCases && zipLenChanged === 0,
    `${zipOk} of ${zipCases} (preset x nonempty subset) write zeros in place; ${silentSlotCount} of ${slots.length} `
    + 'library slots are already silent-but-present, which is why a shrink would be a silent rewrite');
  /*
   * ⚠️ **THE SEED IS DESIGN (2) AND IT IS MEASURED THROUGH `WaveConfig.speed`, WHICH IS THE HALF THAT MAKES IT A
   * CORRUPTION RATHER THAN A LOSS.** A shrinking projection re-indexes the surviving slots, so `writeFigure`'s
   * `existing[w]?.speed` reads the WRONG slot's speed — a field required by the type and read by nothing, which is
   * exactly why nobody would notice. 36 of 1197 slots carry a speed that differs from `generators.waveSpeed`.
   */
  const shrinkingMutes = (model, muted) => {
    const kept = model.slots.filter((_, w) => !muted[w]);
    while (kept.length < MAX_WAVES) {
      kept.push({ axes: [blankAxisCell(), blankAxisCell(), blankAxisCell()], silent: true, windingMultiple: null });
    }
    return { ...model, slots: kept, slotCount: model.slots.filter((_, w) => !muted[w]).length };
  };
  seed('design (2): a SHRINKING projection with `slotCount` derived from the muted figure',
    (() => {
      let n = 0;
      for (const [, p] of presets) {
        for (let mask = 1; mask < 8; mask++) {
          const muted = [0, 1, 2].map(k => !!(mask & (1 << k)));
          const c = clone(p);
          writeFigure(c, shrinkingMutes(readFigure(c), muted));
          if (c.generators.waves.length !== p.generators.waves.length
            || JSON.stringify(c.generators.waves.map(w => w.speed))
              !== JSON.stringify(p.generators.waves.map(w => w.speed))) n++;
        }
      }
      return n;
    })(),
    'if every preset authored one slot a shrink would be indistinguishable from an in-place zeroing');

  /*
   * ⚠️ **AND THE SWITCH MUST ACTUALLY CHANGE THE FIGURE — invariant 13 over the one control whose entire purpose
   * is to be A/B'd.** *"Switch it off to see the figure without it"* is a claim about the OUTPUT, so it is measured
   * against the sampled path rather than against the stored numbers: 852 of 854 lit levels move the curve.
   *
   * ⚠️ **ALL THREE PLANES (`evaluateAt3`) AND EIGHT INSTANTS, AND BOTH WIDENINGS WERE FORCED BY MEASUREMENT.**
   * Invariant 29: an XY-only oracle cannot convict a level whose whole reach is in Z. Invariant 28: a single
   * instant collapses every modulator to its base, so a level that winds only through its modulator reads inert —
   * `Black Hole`'s Structure slot is exactly that shape (`am.base` 0 with a pulse of 24/48) and it is one of the
   * two that STILL read inert at these eight instants, because 45° steps land on `sin(k·π) = 0` for a rate of 32.
   * **The two are reported, not hidden: they are the aliasing this oracle's own step size cannot see**, and an
   * irrational-instant version finds all 854. The clause is written to the ≥ 850 the shipped step size measures,
   * because widening the instants would make the FIGURE below unreproducible from the code.
   */
  const INSTANTS = [0, 45, 90, 135, 180, 225, 270, 315];
  const pathDiff = (A, B) => { let d = 0; for (let i = 0; i < A.length; i++) d = Math.max(d, Math.abs(A[i] - B[i])); return d; };
  let litLevels = 0, movedLevels = 0, silentLevels = 0, silentMoved = 0;
  /*
   * ⚠️ **THE EXCEPTIONS ARE NAMED BY MEASUREMENT, NOT BY PROSE (re-based 2026-10-07).** This clause used
   * to allow two and attribute them to *"`Black Hole`'s Structure slot in both its copies"*; a third
   * appeared when three presets were added, and the hardcoded attribution was then simply wrong. **A
   * tolerance with a prose exception list cannot be reconciled by NAME** — so the offenders are
   * collected and printed, and the bound tracks their count.
   */
  const stuckLit = [];
  for (const [pname, p] of presets) {
    const m = readFigure(p);
    for (let w = 0; w < MAX_WAVES; w++) {
      const muted = [0, 1, 2].map(k => k === w);
      const c = clone(p);
      writeFigure(c, applyMutes(readFigure(c), muted));
      let d = 0;
      for (const t of INSTANTS) {
        d = Math.max(d, pathDiff(evaluateAt3(p.generators.waves, t, 240), evaluateAt3(c.generators.waves, t, 240)));
      }
      if (m.slots[w].silent) { silentLevels++; if (d > 1e-9) silentMoved++; }
      else { litLevels++; if (d > 1e-9) movedLevels++; else stuckLit.push(`${pname} slot${w}`); }
    }
  }
  chk('MEASURED over three planes and eight instants: switching a LIT level off changes the drawn figure',
    litLevels > 0 && stuckLit.length <= 3,
    `${movedLevels} of ${litLevels} lit levels move the sampled path; the ${stuckLit.length} that do not are `
    + `${stuckLit.join(', ')} — a pulse rate that ALIASES against the 45° instant step, which is an artefact of `
    + 'THIS oracle and not of the control (invariant 28: irrational instants would find all of them, and the '
    + 'instant may not become a parameter). ⚠️ A GROWING count here is the library gaining aliasing slots, not '
    + 'the control breaking — but read the names before assuming that');
  /*
   * ⚠️ **AND THE MIRROR CLAUSE IS WHY A SILENT LEVEL CANNOT BE MUTED AT ALL (`refreshDerived()` normalises the
   * flag).** Muting a silent level is a no-op on the picture, so the two states would be one picture with two
   * explanations — the row's checkbox reading *off* while the row itself reads *empty*. Measured: 0 of 343.
   */
  chk('...and muting a SILENT level changes nothing, which is why the flag is normalised away rather than kept',
    silentLevels > 0 && silentMoved === 0,
    `${silentLevels} silent levels, ${silentMoved} of which change the picture — one picture must not have two `
    + 'explanations, so `refreshDerived()` clears the mute instead of leaving it set');
  seed('an oracle reading the XY plane at one instant, i.e. invariants 28 and 29 in this section',
    (() => {
      let n = 0;
      for (const [, p] of presets) {
        const m = readFigure(p);
        for (let w = 0; w < MAX_WAVES; w++) {
          if (m.slots[w].silent) continue;
          const c = clone(p);
          writeFigure(c, applyMutes(readFigure(c), [0, 1, 2].map(k => k === w)));
          const A = evaluateAt3(p.generators.waves, 0, 240), B = evaluateAt3(c.generators.waves, 0, 240);
          let xy = 0;
          for (let i = 0; i < A.length; i += AXES) {
            xy = Math.max(xy, Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]));
          }
          if (xy <= 1e-9) n++;
        }
      }
      return n;
    })(),
    'if no level put its whole reach in Z or wound only through a modulator, one plane at one instant would do');

  /*
   * ⚠️ **`blankAxisCell()` MUST COVER EVERY STORED FIELD, and the coverage is read out of the model's own cell
   * rather than out of a list in this file — the same argument §P makes for `CLEAR_FIELDS`, one level down.** Both
   * the mute projection and `clearLevel()` are built from this one function, so an eighth stored field would arrive
   * both un-clearable AND un-mutable in one edit. **The three DERIVED readouts are named as the exemption** and
   * asserted at their correct blank values, which is the half a hand-written clear got wrong: `closesAt(0)` is
   * `true`, not `false`, because a winding of 0 closes trivially.
   */
  const DERIVED_Q = ['closes', 'effectivePhase', 'silent'];
  const blank = blankAxisCell();
  const storedKeys = Object.keys(blank).filter(k => !DERIVED_Q.includes(k));
  const nonZero = storedKeys.filter(k => blank[k] !== 0);
  chk('`blankAxisCell()` zeroes EVERY stored field and gets all three derived readouts right',
    storedKeys.length === 7 && nonZero.length === 0
    && blank.closes === closesAt(0) && blank.effectivePhase === 0 && blank.silent === true,
    `${storedKeys.length} stored fields all 0; closes ${blank.closes} (closesAt(0)), effectivePhase `
    + `${blank.effectivePhase}, silent ${blank.silent} — one owner for the mute projection AND \`clearLevel()\``);
  seed('a hand-written blank cell that omits a field and sets `closes` by hand',
    (() => {
      const hand = { winding: 0, size: 0, pulse: 0, pulseRate: 0, wobble: 0, wobbleRate: 0, closes: false, effectivePhase: 0, silent: true };
      const missing = storedKeys.filter(k => !(k in hand)).length;
      return missing + (hand.closes === closesAt(0) ? 0 : 1);
    })(),
    'the omitted field here is `phase`, which no diagram of a zeroed level can show — so only a key scan sees it');

  /*
   * ⚠️ **SOURCE-SHAPED FROM HERE, AND THE FIRST CLAUSE IS THE ONE THE WHOLE DESIGN HANGS ON: the projection is
   * taken at exactly ONE place, on the commit path.** Two application sites would be invariant 17 — two owners of
   * what the figure IS, which is how a Mixer, an export and a screen come to disagree. Anchor health first, per
   * `CLAUDE.md`'s two `braceBody` anchors that matched nothing and asserted nothing forever.
   */
  const commitBody = bodyOfTab('private commit(_label: string): void');
  const setLevelBody = bodyOfTab('private setLevelEnabled(slot: number, on: boolean): void');
  const clearLevelBody = bodyOfTab('private clearLevel(slot: number): void');
  const resetMutesBody = bodyOfTab('private resetMutes(): void');
  const slotSectionBody = bodyOfTab('private buildSlotSection(slot: number): HTMLElement');
  const syncBody = bodyOfTab('private sync(): void');
  chk('ANCHOR: all six of this section\'s subjects are locatable in the source',
    [commitBody, setLevelBody, clearLevelBody, resetMutesBody, slotSectionBody, syncBody].every(b => b.length > 0),
    `commit ${commitBody.length}, setLevelEnabled ${setLevelBody.length}, clearLevel ${clearLevelBody.length}, `
    + `resetMutes ${resetMutesBody.length}, buildSlotSection ${slotSectionBody.length}, sync ${syncBody.length} chars`);

  const applySites = (tabSrc.match(/applyMutes\(/g) ?? []).length;
  chk('SOURCE: `applyMutes` is called EXACTLY ONCE in the tab, and it is inside `commit()`',
    applySites === 1 && /writeFigure\(p, applyMutes\(this\.model, this\.muted\)\)/.test(commitBody),
    `${applySites} call site — every consumer downstream of it (workingPreset, Export, Snapshot, the Mixer, the `
    + 'engine, all twelve diagram panes) therefore reads ONE figure and cannot disagree with the screen');
  /*
   * ⚠️ **THIS SEED FAILED CALIBRATION ON ITS FIRST WRITING AND THE REASON IS WORTH KEEPING: the mutation MOVED the
   * one call rather than ADDING a second.** `replace` consumed the shipped site and the replacement text carried
   * exactly one `applyMutes(` back, so the count was 1 before and 1 after — 0 violations. **A seed for a COUNT
   * clause must change the count**, which is the same defect shape as `CLAUDE.md`'s *a clause algebraically implied
   * by its siblings*, one level down: the mutation has to be able to fail the assertion it is aimed at.
   */
  seed('a second application site, e.g. the Score drawing the muted figure on its own',
    (() => {
      const mutated = tabSrc.replace(/writeFigure\(p, applyMutes\(this\.model, this\.muted\)\);/,
        'writeFigure(p, applyMutes(this.model, this.muted));\n    const shown = applyMutes(this.model, this.muted);');
      const n = (mutated.match(/applyMutes\(/g) ?? []).length;
      return mutated !== tabSrc && n !== 1 ? 1 : 0;
    })(),
    'two owners of what the figure IS is invariant 17, and it is exactly what a per-consumer projection would be');
  // ⚠️ **AND THE COUNT MUST BE UNMUTED, which is a clause about ORDER and can only be read here.** Growing from
  // the projection would shrink on mute and grow on un-mute; the assertion is that the grow call precedes the
  // projection AND is passed the model rather than the projection's result.
  chk('...and `slotCount` is grown from the UNMUTED model, before the projection is taken',
    commitBody.indexOf('growSlotCountForAuthoredContent') > 0
    && commitBody.indexOf('growSlotCountForAuthoredContent') < commitBody.indexOf('applyMutes'),
    'the count follows what is AUTHORED, never what is currently audible — otherwise a muted trailing level '
    + 'shrinks the figure and anything reading it in between holds a slot MISSING rather than emptied');
  seed('the grow call moved after the projection, so the count follows what is audible',
    (() => {
      const s = 'writeFigure(p, applyMutes(this.model, this.muted));\n    this.growSlotCountForAuthoredContent();';
      return s.indexOf('growSlotCountForAuthoredContent') < s.indexOf('applyMutes') ? 0 : 1;
    })(),
    'a name-only grep sees the call as present, so only the ORDER can report this');

  /*
   * ⚠️ **SWITCHING OFF MUST TOUCH NO NUMBER — the entire promise of the checkbox, and an ABSENT statement, so no
   * arithmetic over the library can see it.** The oracle asserts that every write in `setLevelEnabled` is inside
   * the seeding branch: the method may assign the flag and, when `seeding`, the seed fields — and nothing else.
   */
  const writesOutsideSeed = (b) => {
    const seedBranch = (b.match(/if \(seeding\) \{[\s\S]*?\n {4}\}/) ?? [''])[0];
    const outside = b.replace(seedBranch, '');
    return /cell\.|\.axes\s*=|blankAxisCell\(/.test(outside) ? 1 : 0;
  };
  chk('SOURCE: switching a level OFF writes no number — every cell write sits inside the seeding branch',
    setLevelBody.length > 0 && writesOutsideSeed(setLevelBody) === 0 && /this\.muted\[slot\] = !on;/.test(setLevelBody),
    'the numbers live in the inputs and that is the whole of the recoverability — a helpful zeroing here would '
    + 'be `clearLevel()`, which is irreversible');
  seed('a switch-off that "helpfully" zeroes the level as well',
    writesOutsideSeed(`${setLevelBody}\n    if (!on) for (const cell of model.axes) cell.size = 0;`),
    'a clause reading only the seeding branch would pass while the off direction destroyed the data');
  /*
   * ⚠️ **AND THE SEED MUST GIVE A WINDING AS WELL AS A SIZE — ALGEBRA, NOT DEFENSIVENESS.** `sin((n + phase)·0)·size`
   * is identically 0 for every particle index, so a level with size and winding 0 puts every particle in ONE PLACE:
   * the checkbox would read as broken rather than as new. Measured: all 343 silent slots in the library carry a
   * winding of 0 on at least one axis, and a size-only seed leaves every one of them at a single point.
   */
  let seedCases = 0, seedLit = 0, sizeOnlyDegenerate = 0;
  for (const [, p] of presets) {
    const m = readFigure(p);
    for (const s of m.slots) {
      if (!s.silent) continue;
      seedCases++;
      const spread = (c, winding) => {
        let mn = Infinity, mx = -Infinity;
        for (let n = 0; n < 64; n++) {
          const v = Math.sin((n + c.phase) * (winding / DEG)) * SEED_SIZE;
          mn = Math.min(mn, v); mx = Math.max(mx, v);
        }
        return mx - mn;
      };
      if (s.axes.every(c => spread(c, c.winding) === 0)) sizeOnlyDegenerate++;
      for (const c of s.axes) {
        c.size = SEED_SIZE;
        if (c.winding === 0) c.winding = SEED_WINDING;
        c.silent = c.size + c.pulse === 0;
      }
      if (!s.axes.every(c => c.silent)) seedLit++;
    }
  }
  chk('MEASURED: a size-only seed would draw ONE POINT per axis, so the seed writes a winding too',
    seedCases > 0 && seedLit === seedCases && sizeOnlyDegenerate === seedCases,
    `${seedLit} of ${seedCases} silent slots come out lit; all ${sizeOnlyDegenerate} would have zero spread on a `
    + 'size-only seed, because `sin((n + phase)·0)` is identically 0');
  chk('...and the source writes the winding CONDITIONALLY, so an authored winding on an empty level survives',
    /if \(cell\.winding === 0\) cell\.winding = SEED_WINDING;/.test(setLevelBody)
    && /cell\.size = SEED_SIZE;/.test(setLevelBody),
    'silence is an amplitude property (`size + pulse === 0`) and never a winding one, so an empty level can carry '
    + 'a real authored winding — 256 of the library\'s live slots reach that state on a `Size` clear alone');
  seed('an unconditional `cell.winding = SEED_WINDING`, overwriting an authored winding on an empty level',
    (() => {
      let n = 0;
      for (const s of liveSlots) {
        const c = cellsOf(s.wave);
        for (const x of c) { x.size = 0; x.silent = true; }
        // Now empty but still wound — the state a `Size` clear reaches, where an unconditional seed loses data.
        if (c.some(x => x.winding !== 0 && x.winding !== SEED_WINDING)) n++;
      }
      return n;
    })(),
    'if no empty level could carry a winding the conditional would be decorative and the seed unreachable');
  // ⚠️ **AND THE BODY MUST BE REBUILT WHEN THE SEED RAN** — a silent row renders NO inputs (`renderSlotBody`
  // early-returns), so `sync()` has nothing to write into. §J owns the general rule; this is it for the one
  // control that crosses empty -> lit. **The condition is the SEED, not the direction**: a mute changes no body.
  chk('...and the body is rebuilt when the seed ran, because a silent row renders no inputs at all',
    /if \(seeding\) this\.renderSlotBody\(slot\);/.test(setLevelBody),
    'a values-only version leaves the `empty — nothing authored here` placeholder over a freshly seeded level, '
    + 'which reads as a checkbox that did not take');
  seed('a rebuild gated on the DIRECTION (`if (on)`) rather than on the seed having run',
    /if \(seeding\) this\.renderSlotBody/.test(setLevelBody.replace(/if \(seeding\) this\.renderSlotBody\(slot\);/, 'if (on) this.renderSlotBody(slot);')) ? 0 : 1,
    'switching a LIT level on rebuilds nothing, so a direction-gated rebuild is wasted work that also hides the '
    + 'real condition — and switching OFF must never rebuild, or a muted row loses its 21 inputs');

  /*
   * ⚠️ **THE CHECKBOX'S DISPLAYED STATE IS A THIRD QUANTITY AND NOT `!muted` — AND THIS CLAUSE WAS ADDED AFTER
   * EVERY OTHER CLAUSE IN THIS SECTION PASSED OVER THE DEFECT IT NAMES.** `refreshDerived()` normalises a mute over
   * an empty level away, so on an empty row `muted` is `false` and `!muted` renders the box **TICKED** — already in
   * the state the user must move it to, and a checked checkbox fires no `change`. **The seed path was correct,
   * measured over all 343 empty levels by the clauses above, and NOT CLICKABLE**: the replacement for
   * `+ give it size` was inoperable on exactly the row where it is the only control present.
   *
   * ⚠️ **WHAT THIS SAYS ABOUT THE SECTION IS WORTH MORE THAN THE CLAUSE: every clause above tests what
   * `setLevelEnabled(slot, true)` DOES, and none tested whether anything can CALL it with `true`.** An arithmetic
   * oracle over the model cannot see a DOM attribute, and the two source-shaped clauses that read
   * `setLevelEnabled`'s body were looking INSIDE the method. **Ask what INVOKES the owner you just verified** —
   * §J's whole finding, one level down, and `CLAUDE.md`'s invariant 13 in its sharper form: the control moved the
   * right value into a channel that could not represent the difference between *off because empty* and *off because
   * switched off*.
   */
  const levelIsOnBody = bodyOfTab('private levelIsOn(slot: number): boolean');
  chk('ANCHOR: the checkbox\'s displayed state has a NAMED owner, separate from the mute flag',
    levelIsOnBody.length > 0,
    levelIsOnBody.length > 0 ? `levelIsOn ${levelIsOnBody.length} chars`
      : 'no owner — suspect a rename before believing the property is gone');
  /*
   * ⚠️ **THE ORACLE IS THE NAIVE DERIVATION'S ABSENCE PLUS A CALL COUNT, AND THE FIRST VERSION OF IT WAS WRONG IN A
   * WAY WORTH RECORDING:** it required each `.checked =` assignment to name `levelIsOn` on the same line, and
   * `sync()` legitimately goes through a local (`const next = this.levelIsOn(...)`) so the `!==` guard can avoid a
   * pointless DOM write. **A clause that pins the SHAPE of a call rather than the FACT of it fails on a correct
   * refactor** — the same class as §K's four source-shaped clauses failing at once on a rename. What is actually
   * being asserted is that nothing paints a checkbox from the mute flag alone.
   */
  /*
   * ⚠️ **THE COUNT IS OVER `levelIsOn`'s CALL SITES AND NOT OVER `.checked =` TEXT, AND THAT IS A RE-BASE FORCED BY
   * v8 16.20's SITTING RATHER THAN A LOOSENING.** The first version matched `(?:toggle|t\.input)\.checked =`, which
   * counted 2 because `for (const t of this.levelToggles)` was the tab's only such loop. 16.18 added a SECOND
   * checkbox family (the two preview-bypass switches) whose sync loop is `for (const t of this.bypassToggles)` —
   * identical idiom, different registry — so the pattern read **3** and failed on correct code. ⚠️ **A COUNT OVER A
   * SHARED IDIOM IS NOT A COUNT OVER THE SUBJECT: the subject here is what paints a LEVEL box, and `levelIsOn` is
   * its named owner, so counting the owner's call sites cannot be confused by a family that does not use it.**
   * (`CLAUDE.md`: a clause pinning the SHAPE of a call rather than the FACT of it fails on a correct refactor —
   * this is the same lesson arriving through a sibling feature instead of a rename.)
   *
   * ⚠️ **THE TWO ANCHORS ARE ASSERTED INDIVIDUALLY so the count cannot be satisfied by two copies of one site**, and
   * `naivePaint` still scans the WHOLE tab: the defect being excluded is `!this.muted[...]` reaching any checkbox,
   * and scoping that scan to the level loop would let a future third family reintroduce it next door.
   */
  const buildPaint = /toggle\.checked = this\.levelIsOn\(slot\);/.test(tabSrc);
  const syncPaint = /const next = this\.levelIsOn\(t\.slot\);/.test(tabSrc);
  const naivePaint = /\.checked = !this\.muted\[|const next = !this\.muted\[/.test(tabSrc);
  const ownerCalls = (tabSrc.match(/this\.levelIsOn\(/g) ?? []).length;
  chk('SOURCE: "on" is not muted AND not empty, and NOTHING paints a checkbox from the mute flag alone',
    /!this\.muted\[slot\] && !\(this\.model\?\.slots\[slot\]\?\.silent \?\? true\)/.test(levelIsOnBody)
    && buildPaint && syncPaint && !naivePaint && ownerCalls === 2,
    `build paint ${buildPaint}, sync paint ${syncPaint}, naive \`!muted\` paint anywhere in the tab ${naivePaint}, `
    + `${ownerCalls} calls to the owner — an empty level cannot be ON in any sense the figure can honour, and a box `
    + 'arriving already ticked over an empty row makes the seed unreachable because no `change` event fires');
  seed('the box derived as `!muted`, i.e. ticked over an empty level — the seed path unreachable by a click',
    (() => {
      // The oracle is the ARITHMETIC of the two derivations over the library, not the text: on every empty level
      // `!muted` says ON while the shipped rule says OFF, and it is the empty levels that need the click.
      let n = 0;
      for (const [, p] of presets) {
        const m = readFigure(p);
        for (let w = 0; w < MAX_WAVES; w++) {
          const muted = false;                                  // post-`refreshDerived` on a silent level
          const shipped = !muted && !m.slots[w].silent;
          const naive = !muted;
          if (m.slots[w].silent && naive !== shipped) n++;
        }
      }
      return n;
    })(),
    'if the library authored no empty level the two derivations would agree everywhere and the clause would be '
    + 'algebraically implied — 343 empty levels are what make it falsifiable');
  // ⚠️ **AND THE HANDLER MUST READ THE DOM, NOT THE DERIVATION** — `levelIsOn` is the VIEW, so a handler that
  // passed `levelIsOn(slot)` back in would ignore the click that just happened and toggle nothing.
  chk('...and the `change` handler passes the CHECKBOX\'s new state, never the derivation it was painted from',
    /toggle\.addEventListener\('change', \(\) => this\.setLevelEnabled\(slot, toggle\.checked\)\);/.test(tabSrc),
    '`levelIsOn` is a view of two facts; the click is the third input and only the DOM holds it');
  seed('a handler feeding the derivation back in, so the click toggles nothing',
    /setLevelEnabled\(slot, toggle\.checked\)/.test("this.setLevelEnabled(slot, this.levelIsOn(slot));") ? 0 : 1,
    'the view and the event are two quantities, and a control that reads its own painted state is inert');

  /*
   * ⚠️ **THE LEVEL `Clear` CARRIES §P's THREE OWNER DECISIONS AT TWENTY-ONE NUMBERS INSTEAD OF THREE, and the
   * clauses are separate from §P's because the CONTROL is separate** — same name, seven times the reach, and
   * `CLAUDE.md`'s *three things are named "liquid"* is the hazard that names them apart.
   */
  const oracleOneClickQ = (s) => (/confirm\(|window\.confirm|pushSnapshot/.test(s) ? 1 : 0);
  chk('SOURCE: the level `Clear` is immediate — no confirmation, no history entry, exactly as asked',
    oracleOneClickQ(clearLevelBody) === 0 && /this\.commit\(/.test(clearLevelBody)
    && !/setWorkingPreset|setWaves\(|writeFigure\(/.test(clearLevelBody),
    'immediate and unrecoverable was the owner\'s explicit decision, and it commits through the ONE path so the '
    + 'mute normalisation and the repaint both happen');
  seed('a confirmation dialog on the level `Clear`, the plausible defensive edit at 21 numbers',
    oracleOneClickQ(`${clearLevelBody}\n    if (!confirm('Clear this whole wave?')) return;`),
    'the decision was asked and answered once for the row button; a second control must not re-decide it');
  chk('...and it goes through `blankAxisCell()`, so an eighth stored field could not arrive un-clearable',
    /blankAxisCell\(\), blankAxisCell\(\), blankAxisCell\(\)/.test(clearLevelBody)
    && /this\.renderSlotBody\(slot\);/.test(clearLevelBody),
    'seven hand-written assignments here would be a THIRD enumeration of the stored fields; the rebuild is '
    + 'unconditional because this always lands empty');
  seed('a level `Clear` written as seven assignments per axis',
    /blankAxisCell/.test(clearLevelBody.replace(/model\.axes = \[blankAxisCell\(\), blankAxisCell\(\), blankAxisCell\(\)\];/,
      'for (const c of model.axes) { c.winding = 0; c.size = 0; c.pulse = 0; }')) ? 0 : 1,
    'the hand-written version type-checks and looks complete — it is the missing EIGHTH field that no clause '
    + 'over the seven can see, which is why the subject is the constructor and not the list');

  /*
   * ⚠️ **A MUTE MUST DIE WITH ITS FIGURE, AND §J NOW OWNS THE THREE-CALL-SITE CLAUSE — this one asserts the OWNER
   * EXISTS AND IS SINGULAR.** A stale mute is strictly worse than the stale body §J is a post-mortem of: the row
   * shows the incoming preset's real numbers, the box reads *off*, and the next `commit()` exports that level
   * cleared. Silent data loss on a figure the user never touched.
   */
  chk('SOURCE: `resetMutes()` is a named owner with THREE call sites — one per wholesale figure replacement',
    /this\.muted = \[false, false, false\];/.test(resetMutesBody)
    && (tabSrc.match(/this\.resetMutes\(\);/g) ?? []).length === 3,
    `${(tabSrc.match(/this\.resetMutes\(\);/g) ?? []).length} call sites (adoptExternalFigure, reset, New Figure) `
    + '— §J asserts they are the right three; this asserts there is ONE owner rather than three inline lines');
  seed('the reset inlined at its call sites, so a fourth replacement path can silently omit it',
    /this\.muted = \[false, false, false\];/.test('') ? 0 : 1,
    'an inline boolean assignment is invisible as a contract — §J\'s whole finding was an unenumerated path');
  // ⚠️ **AND THE NORMALISATION MUST LIVE IN THE METHOD `commit()` CALLS FIRST**, or `applyMutes` can see a mute
  // over an empty level. This is an ORDER claim, like the grow call above, and it is the reason invariant
  // "a MUTED slot is always a LIT slot" holds without any check at the projection.
  const refreshBody = bodyOfTab('private refreshDerived(): void');
  chk('...and a silent level cannot stay muted — normalised in the method `commit()` calls FIRST',
    /if \(slot\.silent\) this\.muted\[w\] = false;/.test(refreshBody)
    && commitBody.indexOf('refreshDerived') < commitBody.indexOf('applyMutes'),
    'it is the MUTE that yields and not the data: clearing a boolean costs one click, un-silencing a row would '
    + 'invent numbers');
  seed('the normalisation placed after the projection, where it cannot prevent the state it exists for',
    (() => {
      const s = 'writeFigure(p, applyMutes(this.model, this.muted));\n    this.refreshDerived();';
      return s.indexOf('refreshDerived') < s.indexOf('applyMutes') ? 0 : 1;
    })(),
    'both calls are present in either order, so only the ORDER can report this — same shape as the grow clause');

  /*
   * ⚠️ **THE INLINE NOTICE IS *INLINE* AND *GATED*, AND THOSE ARE TWO OBLIGATIONS WITH TWO DIFFERENT REASONS
   * (invariants 25 and 13).** Inline because a checkbox reads as reversible and this one is not, once the figure is
   * replaced — a tooltip is found by someone who already suspects the control, and the person who needs this
   * sentence is the one who thinks nothing is at stake. Gated because a permanent warning describes a state that is
   * not happening, and would train the reader past the amber precondition that means the tab is inert.
   *
   * ⚠️ **ONE LITERAL, `display` TOGGLED — and that is mechanical, not stylistic:** `tipcheck` §I's `INLINE_SINK`
   * matches a literal after `.textContent =`, so a ternary-assigned string renders identically and is INVISIBLE to
   * the ceiling that caps this copy.
   */
  const renderBody = bodyOfTab('private render(): void');
  const noticeLiteral = (renderBody.match(/this\.muteNoticeEl\.textContent = '[\s\S]*?';/) ?? [''])[0];
  chk('the mute notice is ONE literal set in `render()`, with only `display` toggled from `sync()`',
    noticeLiteral.length > 0
    && /this\.muteNoticeEl\.style\.display = this\.muted\.some\(Boolean\) \? '' : 'none';/.test(syncBody),
    noticeLiteral.length === 0 ? 'the literal anchor matched nothing — suspect the instrument first'
      : `${noticeLiteral.length} chars set once; gated on \`muted.some(Boolean)\`, i.e. on the FIGURE rather than `
        + 'on any one row, because every diagram and the preview agree with it');
  chk('...and it states all three consequences: the diagrams, what an export saves, and that it is not permanent',
    /diagram/i.test(noticeLiteral) && /Export/.test(noticeLiteral) && /Snapshot/.test(noticeLiteral)
    && /(replaced|until)/i.test(noticeLiteral),
    'a notice that said only "switched off" would describe the reversible half and omit the one that loses data');
  seed('the notice assigned through a ternary, i.e. copy invisible to `tipcheck` §I\'s inline ceiling',
    /textContent = '/.test("this.muteNoticeEl.textContent = on ? 'A level is switched off…' : '';") ? 0 : 1,
    'the rendered text is identical, which is exactly why the ceiling cannot see it — set once, toggle display');
  seed('an ungated notice, permanently visible above a figure with nothing switched off',
    /style\.display = this\.muted\.some\(Boolean\)/.test(syncBody.replace(
      /this\.muteNoticeEl\.style\.display = this\.muted\.some\(Boolean\) \? '' : 'none';/, '')) ? 0 : 1,
    'invariant 25\'s remedy turned on itself: a permanent alarm describes a state that is not happening and '
    + 'devalues the one beside it that means the tab is inert');

  /*
   * ⚠️ **THE TOOLTIPS ARE A PAIR AND MUST BE DISTINGUISHABLE IN ONE READING — they sit on the same row and one of
   * them is irreversible.** `tipcheck` already asserts both directions of key-and-reader, so repeating that here
   * would be a clause implied by a sibling checker. What it cannot see is WHICH facts the sentences carry.
   */
  const tipSrcQ = readFileSync(join(ROOT, 'src/ui/synthesis-lab/tooltips.ts'), 'utf8');
  const tipOf = (key) => (tipSrcQ.match(new RegExp(`'${key}':([\\s\\S]*?)',\\n`)) ?? [''])[0];
  const levelTip = tipOf('composer\\.level');
  const levelClearTip = tipOf('composer\\.levelClear');
  const saysKept = /stay in the boxes|come back/i.test(levelTip);
  const saysExported = /Export/.test(levelTip) && /(cleared|empty)/i.test(levelTip);
  const saysSeed = /(starting size|gives it a)/i.test(levelTip);
  chk('the level tooltip carries all three facts the checkbox cannot show: kept, exported cleared, and the seed',
    levelTip.length > 0 && saysKept && saysExported && saysSeed,
    levelTip.length === 0 ? 'the `composer.level` anchor matched nothing — suspect the instrument first'
      : `${levelTip.length} chars; kept ${saysKept}, exported-cleared ${saysExported}, seeds an empty level ${saysSeed}`);
  const clearSaysImmediate = /immediat|no undo|no confirmation/i.test(levelClearTip);
  const clearSaysDistinct = /(unlike|switching the wave off)/i.test(levelClearTip);
  chk('...and the `Clear` tooltip names what separates it from the checkbox beside it',
    levelClearTip.length > 0 && clearSaysImmediate && clearSaysDistinct,
    levelClearTip.length === 0 ? 'the `composer.levelClear` anchor matched nothing — suspect the instrument first'
      : `${levelClearTip.length} chars; immediate ${clearSaysImmediate}, contrasted with the switch ${clearSaysDistinct}`);
  seed('two tooltips that describe the same thing, so the pair cannot be told apart on the row',
    (() => {
      const t = "'composer.levelClear': 'Turn this wave off so it does not count.',\n";
      return (/immediat|no undo|no confirmation/i.test(t) ? 0 : 1)
        + (/(unlike|switching the wave off)/i.test(t) ? 0 : 1);
    })(),
    'a reversible control and an irreversible one on the same row is the `three things named "liquid"` hazard, '
    + 'and the tooltips are the only separation');
  // ⚠️ **AND THE RETIRED KEY MUST BE GONE, NOT MERELY UNREAD** — `tipcheck` asserts both directions, so a key with
  // no reader fails there; what only this clause can see is that the sentence describing `+ give it size` is not
  // still shipping under some other key. §N's lesson: assert the old name is ABSENT, not renamed.
  chk('`composer.giveSize` is GONE with the button it described, and `composer.silent` carries the way out',
    !/'composer\.giveSize':/.test(tipSrcQ) && /Tick the box beside its name/.test(tipOf('composer\\.silent')),
    'a tooltip naming a control that does not exist is worse than a missing sentence — and the empty row still '
    + 'has to say what to do next, which is now the checkbox');
  seed('the retired key kept "for reference", i.e. copy describing a deleted button',
    /'composer\.giveSize':/.test("  'composer.giveSize': 'Give this wave a starting size.',") ? 1 : 0,
    'a set-membership clause over the LIVE keys cannot see a retired one that is still present');

  /*
   * ⚠️ **THE CSS CLAUSE IS ABOUT THE HEAD ROW'S LAYOUT AND IT IS THE ONE A BROWSER PASS NOTICES LAST, BECAUSE IT
   * ONLY MISBEHAVES WHILE THE USER TYPES.** `.sl-composer-slot-head` is `align-items: baseline` and its title
   * carries a readout that `sync()` rebuilds on every edit — so without `margin-left: auto` the `Clear` button
   * MOVES HORIZONTALLY as the readout grows, and without `align-self: center` a replaced checkbox has no useful
   * baseline to align on. `margin-left: auto` is precisely what the deleted `.sl-composer-tier` rule existed to say.
   */
  const headCss = (cssSrc.match(/\.sl-composer-slot-head\s*\{[^}]*\}/) ?? [''])[0];
  const levelClearCss = (cssSrc.match(/\.sl-composer-level-clear\s*\{[^}]*\}/) ?? [''])[0];
  const levelCheckCss = (cssSrc.match(/\.sl-composer-level-check\s*\{[^}]*\}/) ?? [''])[0];
  chk('the head row pins the `Clear` right and centres the checkbox against a BASELINE-aligned flex row',
    headCss.length > 0 && levelClearCss.length > 0 && levelCheckCss.length > 0
    && /align-items:\s*baseline/.test(headCss)
    && /margin-left:\s*auto/.test(levelClearCss) && /flex:\s*0\s+0\s+auto/.test(levelClearCss)
    && /align-self:\s*center/.test(levelCheckCss),
    headCss.length && levelClearCss.length && levelCheckCss.length
      ? 'the button absorbs the readout\'s growth instead of being pushed by it, and neither replaced element '
        + 'tries to sit on a baseline it does not have'
      : `anchors: head ${headCss.length}, clear ${levelClearCss.length}, check ${levelCheckCss.length} chars — an anchor miss`);
  seed('the `Clear` left in the flow, so it slides sideways every time the head readout is rebuilt',
    /margin-left:\s*auto/.test('.sl-composer-level-clear { flex: 0 0 auto; }') ? 0 : 1,
    'the readout is rebuilt on every `sync()`, so this is a defect that only appears WHILE the user types — '
    + 'the hardest kind to catch in a static pass');
  /*
   * ⚠️ **AND THE NOTICE MUST NOT WEAR THE PRECONDITION'S COLOUR, which is a claim about MEANING and not about
   * taste.** The amber banner means the pipeline is INERT — nothing the user does can reach the screen. The notice
   * means the tab is working exactly as asked and names a cost. Two notices in one column with one colour makes
   * the alarm ordinary, which is the same argument that gates the notice at all.
   */
  const noticeCss = (cssSrc.match(/\.sl-composer-mute-notice\s*\{[^}]*\}/) ?? [''])[0];
  const preCss = (cssSrc.match(/\.sl-composer-precondition\s*\{[^}]*\}/) ?? [''])[0];
  const borderOf = (s) => (s.match(/border-left:\s*3px solid (#[0-9a-fA-F]{3,6})/) ?? ['', ''])[1];
  chk('the consequence notice is styled apart from the inert-pipeline ALARM — same shape, different colour',
    noticeCss.length > 0 && preCss.length > 0
    && borderOf(noticeCss).length > 0 && borderOf(preCss).length > 0
    && borderOf(noticeCss).toLowerCase() !== borderOf(preCss).toLowerCase(),
    noticeCss.length && preCss.length
      ? `notice ${borderOf(noticeCss)} against the precondition's ${borderOf(preCss)} — one says "the tab cannot `
        + 'reach the screen", the other says "you switched a level off and here is the cost"'
      : `anchors: notice ${noticeCss.length}, precondition ${preCss.length} chars — an anchor miss`);
  seed('the notice reusing the precondition\'s amber, making the inert-pipeline alarm ordinary',
    borderOf('.sl-composer-mute-notice { border-left: 3px solid #d9a13b; }').toLowerCase()
      === borderOf(preCss).toLowerCase() ? 1 : 0,
    'a clause that only asserted a rule EXISTS would pass on two identical rules, which is the mislabelling '
    + 'this one names — the same shape as §N\'s legend permutation');
}

// ===================================================================================================
console.log('\n§R — the SCORE and the GENERATOR must compute the SAME figure (34.1)');
// ===================================================================================================
/*
 * ⚠️⚠️ **THIS SECTION EXISTS BECAUSE THE TWO HAD ALREADY DIVERGED AND NOTHING COULD SAY SO.** Phase 33 added
 * `Sharpness` (`33.2`) and `Travel` (`33.3`) to `generators/lissajous.ts` and to nothing else. Measured before
 * `34.1`: `score-canvas.ts` contained **zero** occurrences of either word, so from the day `33.2` shipped **the
 * Score drew a figure the engine does not render on any preset carrying either value** — and the Score is the
 * surface an author reads *while* authoring. `verify` was green the whole time: §A–§Q own the model, the tab's
 * seams, the sampling instants and the legend, and **no clause asked whether the diagram and the engine agree.**
 * That is `CLAUDE.md`'s *a missing CLAUSE reads exactly like a correct predicate over a shorter list*, arriving
 * in a second subject after `32.15` found it in `preset-facets.ts`.
 *
 * ⚠️⚠️ **THE ORACLE IS A LITERAL RE-IMPLEMENTATION OF THE GENERATOR'S SHIPPED LOOP, NOT A CALL INTO
 * `wave-law.ts`.** Importing the shared owner and comparing it with itself would be the assertion-against-itself
 * shape — green for ever, measuring nothing. So `genLaw3` below writes out the three-case basis branch, the
 * `(n + phase) · fm` phase arithmetic, the slot-outer/axis-inner accumulation order and the per-axis travel gate
 * **exactly as they shipped in the particle loop**, and a drift in the shared law fails here. It is the same
 * choice §D and §I make, for the same stated reason.
 *
 * ⚠️ **MEASURING, over three planes.** A single-plane oracle is this file's recurring error — §I's own header
 * records walking into it three times — so every comparison reads X, Y and Z (invariant 29).
 *
 * ⚠️ **THE TOLERANCE IS RELATIVE AND THAT IS FORCED BY THE DATA TYPE, NOT A SOFTENING.** `evaluate` returns a
 * `Float32Array`, whose relative precision is ~6e-8, and the library's reach runs to ~800 model units — so an
 * ABSOLUTE 1e-6 per coordinate is unreachable by about an order of magnitude on the large figures and would fail
 * on correct code. `TOL_REL = 1e-6` of the figure's own reach keeps ~16× margin over float32 storage error while
 * still refusing every seeded defect below. **State the floor or the number means nothing.**
 */

/** Relative agreement tolerance, as a fraction of the figure's own authored reach. See the header. */
const TOL_REL = 1e-6;

/**
 * The GENERATOR's law, written out longhand — three axes, no projection.
 *
 * ⚠️ Every line below is a copy of what `lissajous.ts`' particle loop ran before `34.1` moved it: the modulator
 * (§D's `mod`), `fm / DEG` and `am` NOT divided, `(n + phase) · fm` with the phase INSIDE, the three-case basis
 * branch (`sharp === 0` → one `Math.sin`; `sharp === 1` → ZERO transcendentals; otherwise ONE, hoisted), the
 * slot-outer/axis-inner accumulation, and the secular term added AFTER the sum with a PER-AXIS gate.
 */
const INV_TAU_ORACLE = 1 / (Math.PI * 2);
const genLaw3 = (waves, time, samples, idx, sharp, travel, halfExtent,
  offset = [0, 0, 0], grow = [0, 0, 0]) => {
  /*
   * v8 `34.4` — ⚠️ **`sharp` MAY BE A NUMBER OR A THREE-LEVEL ARRAY, and accepting both is deliberate.**
   * `34.D11` makes `Sharpness` per wave LEVEL (Body / Structure / Detail — slots, NOT axes), and the shipped
   * global key means *all three levels*. Normalising here keeps every pre-`34.4` call site in this file
   * reading as the global control it was written for, which is exactly what those call sites are about.
   */
  const sh = Array.isArray(sharp) ? sharp : [sharp, sharp, sharp];
  const am = [], fm = [], ph = [];
  for (let w = 0; w < MAX_WAVES; w++) {
    am.push([0, 0, 0]); fm.push([0, 0, 0]); ph.push([0, 0, 0]);
    const wv = waves[w]; if (!wv) continue;
    for (let q = 0; q < AXES; q++) {
      const a = wv.axes[q];
      am[w][q] = mod(a.am.base ?? 0, a.am.amplitude ?? 0, a.am.frequency ?? 0, time);
      fm[w][q] = mod(a.fm.base ?? 0, a.fm.amplitude ?? 0, a.fm.frequency ?? 0, time) / DEG;
      ph[w][q] = a.phase ?? 0;
    }
  }
  const cStep = 360 / samples, out = new Float64Array(idx.length * AXES);
  const tvX = travel[0] !== 0, tvY = travel[1] !== 0, tvZ = travel[2] !== 0;
  const hasTravel = tvX || tvY || tvZ;
  const gwX = grow[0] !== 0, gwY = grow[1] !== 0, gwZ = grow[2] !== 0;
  const hasGrow = gwX || gwY || gwZ;
  const ofX = offset[0] !== 0, ofY = offset[1] !== 0, ofZ = offset[2] !== 0;
  const hasOffset = ofX || ofY || ofZ;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k], n = i * cStep, tau = i / samples;
    let x = 0, y = 0, z = 0;
    for (let w = 0; w < MAX_WAVES; w++) {
      const sharpW = sh[w] ?? 0;
      for (let q = 0; q < AXES; q++) {
        const a = (n + ph[w][q]) * fm[w][q];
        let basis;
        if (sharpW === 0) {
          basis = Math.sin(a);
        } else {
          const u = a * INV_TAU_ORACLE + 0.25;
          const tri = 1 - 4 * Math.abs(u - Math.floor(u) - 0.5);
          if (sharpW === 1) basis = tri;
          else { const sv = Math.sin(a); basis = sv + sharpW * (tri - sv); }
        }
        const v = basis * am[w][q];
        if (q === 0) x += v; else if (q === 1) y += v; else z += v;
      }
    }
    /*
     * v8 `34.3` — ⚠️⚠️ **`Grow` SCALES THE WAVE SUM ALONE, BEFORE THE TWO ADDITIVE STAGES, AND THE ORACLE
     * HAS TO GET THAT ORDER RIGHT OR IT WOULD CERTIFY THE WRONG ENGINE.** Downstream of either it would ramp
     * the secular term and the DC term too — a quadratic sweep and a ramped translation, which are different
     * operators. `deformcheck` §N measures the same contract from the engine's side.
     */
    if (hasGrow) {
      if (gwX) x *= 1 + grow[0] * tau;
      if (gwY) y *= 1 + grow[1] * tau;
      if (gwZ) z *= 1 + grow[2] * tau;
    }
    if (hasTravel) {
      const s = tau * halfExtent;
      if (tvX) x += travel[0] * s;
      if (tvY) y += travel[1] * s;
      if (tvZ) z += travel[2] * s;
    }
    // v8 `34.2` — the DC term. ⚠️ It COMMUTES with the travel above, so this order is free and is not a
    // contract; the one above it IS. Said here so a reader does not infer a third contract from the layout.
    if (hasOffset) {
      if (ofX) x += offset[0] * halfExtent;
      if (ofY) y += offset[1] * halfExtent;
      if (ofZ) z += offset[2] * halfExtent;
    }
    out[k * AXES] = x; out[k * AXES + 1] = y; out[k * AXES + 2] = z;
  }
  return out;
};

/**
 * The instants `chooseOverlayInstants` can possibly pick: 48 steps over the slowest live modulator's period.
 *
 * ⚠️ **THE GRID, NOT THE SELECTION RULE.** §I and §N already own which instant is chosen and why `t = 0` is
 * degenerate; §R owns the LAW, so it is enough that the shipped curve be the generator's figure at *one* of the
 * instants the Score could have chosen. Replicating the argmax here would make §R a fourth copy of a search that
 * two sections already assert.
 */
const SEARCH_GRID = (waves) => {
  const slow = slowestRate(waves);
  if (!Number.isFinite(slow)) return [0];
  const period = 360 / slow, out = [];
  for (let i = 0; i < 48; i++) out.push(i * period / 48);
  return out;
};

/** Evenly-spaced sample indices — the cheap probe that locates the matching instant before the full compare. */
const probeIdx = (samples, n) => {
  const out = [];
  for (let k = 0; k < n; k++) out.push(Math.min(samples - 1, Math.floor(k * samples / n)));
  return out;
};
const allIdx = (samples) => { const out = new Array(samples); for (let i = 0; i < samples; i++) out[i] = i; return out; };

/**
 * The worst per-coordinate disagreement between one shipped `OverlayCurves` member and the oracle at `time`.
 *
 * `plane` members are 2D projections, so the oracle's 3D output is projected through the SAME `PLANE_AXES`
 * mapping `score-canvas.ts` exports — never a second copy of it (16.20's own lesson).
 */
const worstGap = (score, member, waves, time, samples, idx, sharp, travel, halfExtent,
  offset = [0, 0, 0], grow = [0, 0, 0]) => {
  const o = genLaw3(waves, time, samples, idx, sharp, travel, halfExtent, offset, grow);
  let worst = 0;
  for (const [pl, [ia, ib]] of Object.entries(PLANE_AXES)) {
    const arr = score[pl][member];
    if (!arr) return Infinity;      // the shipped code declined to draw a curve the oracle has — a real failure
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      worst = Math.max(worst, Math.abs(arr[i * 2] - o[k * AXES + ia]), Math.abs(arr[i * 2 + 1] - o[k * AXES + ib]));
    }
  }
  return worst;
};

/**
 * Does the shipped curve equal the generator's figure at SOME instant the Score could have chosen?
 *
 * Two stages, and the staging is a cost decision rather than a weakening: 32 probe indices locate the instant
 * over the 48-step grid, then **every** sample of **every** plane is compared at that instant. A one-stage full
 * sweep is 48× the work for the same claim.
 */
const agreesSomewhere = (score, member, waves, samples, sharp, travel, halfExtent,
  offset = [0, 0, 0], grow = [0, 0, 0]) => {
  const probe = probeIdx(samples, 32);
  let best = Infinity, bestT = null;
  for (const t of SEARCH_GRID(waves)) {
    const g = worstGap(score, member, waves, t, samples, probe, sharp, travel, halfExtent, offset, grow);
    if (g < best) { best = g; bestT = t; }
  }
  if (bestT === null) return { ok: false, gap: Infinity };
  const gap = worstGap(score, member, waves, bestT, samples, allIdx(samples), sharp, travel, halfExtent,
    offset, grow);
  return { ok: Number.isFinite(gap), gap };
};

/*
 * ⚠️ **THE SWEEP IS DELIBERATELY NARROW IN PRESETS AND WIDE IN OPERATORS, AND THE BASIS IS PRINTED.** The whole
 * library × 5 sharpness values × 3 travel settings × 3 curves × every sample of three planes is minutes of work
 * for a property that does not vary by preset once a figure has a reach, a winding and a live modulator. So the
 * subjects are a deterministic stride over this checker's own `scored` list — the same basis §I states — and the
 * operator axes are swept in full.
 */
const SWEEP_SHARP = [0, 0.25, 0.5, 0.75, 1];
const SWEEP_TRAVEL = [[0, 0, 0], [0.5, 0, 0], [-0.25, 0.75, 1]];
const SWEEP_HALF_EXTENT = 50;
const SWEEP_STRIDE = Math.max(1, Math.floor(scored.length / 12));
const subjects = scored.filter((_, i) => i % SWEEP_STRIDE === 0).slice(0, 12);

{
  let configs = 0, curves = 0, worstRel = 0, bad = [];
  for (const s of subjects) {
    const { samples } = sampleCountFor(s.waves);
    const reach = Math.max(authoredReach(s.waves), 1);
    for (const sharpness of SWEEP_SHARP) {
      for (const travel of SWEEP_TRAVEL) {
        configs++;
        const score = computeOverlayScores(s.waves, null,
          { sharpness, travel, halfExtent: SWEEP_HALF_EXTENT });
        for (const member of ['now', 'size', 'winding']) {
          // ⚠️ `null` means the family provably does not move — §N owns that decision, and `worstGap` returns
          // `Infinity` for a curve the oracle has and the shipped code declined to draw, so skipping here
          // cannot hide a missing curve.
          if (!score.xy[member]) continue;
          curves++;
          const { gap } = agreesSomewhere(score, member, s.waves, samples, sharpness, travel, SWEEP_HALF_EXTENT);
          // ⚠️ The denominator includes the travel's own reach: a figure swept a full half-extent is LARGER than
          // its authored amplitude, and dividing by the amplitude alone would make the tolerance too tight on
          // exactly the configurations this section was written for.
          const scale = reach + Math.max(...travel.map(Math.abs)) * SWEEP_HALF_EXTENT;
          const rel = gap / scale;
          worstRel = Math.max(worstRel, rel);
          if (!(rel <= TOL_REL)) bad.push(`${s.n} sharp=${sharpness} travel=[${travel}] ${member} rel=${rel.toExponential(2)}`);
        }
      }
    }
  }
  chk('MEASURED: the Score IS the generator\'s figure — every curve, every plane, every sharpness, every travel',
    bad.length === 0 && curves > 0,
    bad.length
      ? `${bad.length} of ${curves} curves disagree: ${bad.slice(0, 4).join(' | ')}`
      : `${subjects.length} presets × ${SWEEP_SHARP.length} sharpness × ${SWEEP_TRAVEL.length} travel = `
        + `${configs} configurations, ${curves} curves, every sample of all three planes compared at the `
        + `matched instant. Worst relative gap ${worstRel.toExponential(2)} against ${TOL_REL.toExponential(0)} `
        + `— that residual is Float32Array storage, not arithmetic`);

  /*
   * ⚠️⚠️ **v8 `34.5` — A SECOND SWEEP, OVER THE FOUR OPERATORS PHASE 34 ADDS, AND IT IS A SEPARATE SWEEP
   * RATHER THAN THREE MORE AXES OF THE ONE ABOVE FOR A STATED COST REASON.** Folding offset and grow into
   * the first sweep would be 12 presets × 5 sharpness × 3 travel × 3 offset × 3 grow × 3 curves × 48
   * instants — minutes of work for a property that does not vary across the product. So the operators are
   * swept against each other at the two sharpness ENDPOINTS, which is where the basis branch changes.
   *
   * ⚠️ **PER-LEVEL sharpness is swept HERE and nowhere else** (`[1,0,0]` and `[0,0.5,1]`): it is the one
   * configuration a single global slider provably cannot reach, and a Score that resolved the levels wrong
   * would draw a figure the engine does not render on exactly the presets `34.6` is going to author.
   */
  const SWEEP_OFFSET = [[0, 0, 0], [0.9, 0, 0], [-0.4, 0.6, 0.3]];
  const SWEEP_GROW = [[0, 0, 0], [1.5, 1.5, 0], [-0.8, 0, 2.2]];
  const SWEEP_LEVELS = [0, 1, [1, 0, 0], [0, 0.5, 1]];
  {
    let cfg2 = 0, crv2 = 0, worst2 = 0;
    const bad2 = [];
    for (const sj of subjects) {
      const { samples } = sampleCountFor(sj.waves);
      const reach = Math.max(authoredReach(sj.waves), 1);
      for (const levels of SWEEP_LEVELS) {
        for (const offset of SWEEP_OFFSET) {
          for (const grow of SWEEP_GROW) {
            cfg2++;
            const lv = Array.isArray(levels) ? levels : [levels, levels, levels];
            const score = computeOverlayScores(sj.waves, null, {
              sharpness: lv[0], sharpnessStructure: lv[1], sharpnessDetail: lv[2],
              offset, grow, halfExtent: SWEEP_HALF_EXTENT,
            });
            for (const member of ['now', 'size', 'winding']) {
              if (!score.xy[member]) continue;
              crv2++;
              const { gap } = agreesSomewhere(score, member, sj.waves, samples, lv, [0, 0, 0],
                SWEEP_HALF_EXTENT, offset, grow);
              /*
               * ⚠️ **THE DENOMINATOR CARRIES BOTH NEW OPERATORS' OWN CONTRIBUTION, for the travel's reason
               * one clause up.** An offset adds `|offset| · halfExtent` to the figure's reach and a grow
               * MULTIPLIES it by up to `1 + k`, so dividing by the authored amplitude alone would make the
               * tolerance tighter on exactly the configurations this sweep exists for — which is how a
               * relative bound silently becomes a bound about the figure's size.
               */
              const scale = reach * (1 + Math.max(0, ...grow.map((k) => k)))
                + Math.max(...offset.map(Math.abs)) * SWEEP_HALF_EXTENT;
              const rel = gap / scale;
              worst2 = Math.max(worst2, rel);
              if (!(rel <= TOL_REL)) {
                bad2.push(`${sj.n} levels=[${lv}] offset=[${offset}] grow=[${grow}] ${member} `
                  + `rel=${rel.toExponential(2)}`);
              }
            }
          }
        }
      }
    }
    chk('MEASURED: the Score IS the generator\'s figure under Offset, Grow and PER-LEVEL Sharpness too',
      bad2.length === 0 && crv2 > 0,
      bad2.length
        ? `${bad2.length} of ${crv2} curves disagree: ${bad2.slice(0, 4).join(' | ')}`
        : `${subjects.length} presets × ${SWEEP_LEVELS.length} sharpness settings × ${SWEEP_OFFSET.length} `
          + `offset × ${SWEEP_GROW.length} grow = ${cfg2} configurations, ${crv2} curves, every sample of `
          + `all three planes at the matched instant. Worst relative gap ${worst2.toExponential(2)} against `
          + `${TOL_REL.toExponential(0)}. ⚠ Two of the four sharpness settings are PER-LEVEL, which no `
          + 'global slider can reach — a Score resolving the levels wrong would be invisible to the first '
          + 'sweep entirely');

    /*
     * ⚠️ **AND EACH NEW OPERATOR MUST MOVE THE DIAGRAM, or the agreement clause is passing over an ignored
     * parameter — which is precisely the state `33.2`/`33.3` left the Score in for a whole phase.**
     */
    const movesUnder = (ops) => scored.filter((sj) => {
      const base = computeOverlayScores(sj.waves, null).xy.now;
      const moved = computeOverlayScores(sj.waves, null, { ...ops, halfExtent: 50 }).xy.now;
      let w = 0;
      for (let i = 0; i < base.length; i++) w = Math.max(w, Math.abs(base[i] - moved[i]));
      return w > 1e-6;
    }).length;
    const nOffset = movesUnder({ offset: [1, 0, 0] });
    const nGrow = movesUnder({ grow: [1, 1, 1] });
    chk('`offset` MOVES the Score on every figure, and `grow` on every figure with a reach',
      nOffset === scored.length && nGrow > scored.length * 0.5,
      `offset ${nOffset}/${scored.length} (additive and position-free, so it moves EVERY figure including a `
      + `point), grow ${nGrow}/${scored.length} (a MULTIPLIER, so it cannot move a figure whose wave sum is `
      + 'identically 0 — the bound is a majority on purpose, and a shortfall would be a claim about the '
      + 'LIBRARY rather than about the parameter)');
    const nLevels = scored.filter((sj) => {
      const all = computeOverlayScores(sj.waves, null, { sharpness: 1 }).xy.now;
      const body = computeOverlayScores(sj.waves, null,
        { sharpness: 1, sharpnessStructure: 0, sharpnessDetail: 0 }).xy.now;
      let w = 0;
      for (let i = 0; i < all.length; i++) w = Math.max(w, Math.abs(all[i] - body[i]));
      return w > authoredReach(sj.waves) * 1e-6;
    }).length;
    chk('...and PER-LEVEL sharpness differs from the global one on the presets that HAVE a second level',
      nLevels > 0,
      `${nLevels} of ${scored.length} preset objects draw differently at [1,0,0] than at [1,1,1]. ⚠ A ZERO `
      + 'here is a FAILURE, not a clean bill: it would mean the Score resolves all three levels from the '
      + 'Body value, which is the `?? 0`-versus-`?? sharpness` confusion arriving in the diagram instead of '
      + 'in the engine. ⚠ It is NOT all of them — a preset with one live slot has nothing for levels 1 and '
      + '2 to shape, which is 183 of 314 for Detail alone');
  }

  /*
   * ⚠️⚠️ **SEED 1 IS THE DEFECT THAT ACTUALLY SHIPPED, RE-IMPLEMENTED: the pre-`34.1` Score law.** It is
   * `Math.sin((n + ph) · fm) · am` with no basis branch and no secular term — which is byte-correct at
   * `sharpness = 0` with no travel and WRONG everywhere else. The count below is the finding: this is how many
   * of the swept curves the diagram got wrong between `33.2` and `34.1`.
   */
  let seedPre = 0;
  for (const s of subjects) {
    const { samples } = sampleCountFor(s.waves);
    const reach = Math.max(authoredReach(s.waves), 1);
    const idx = probeIdx(samples, 32);
    for (const sharpness of SWEEP_SHARP) {
      for (const travel of SWEEP_TRAVEL) {
        if (sharpness === 0 && travel.every(v => v === 0)) continue;   // the one configuration it got right
        // The old law, at the instant that best matches the honest one — so the seed cannot pass merely by
        // being evaluated at the wrong time.
        let best = Infinity;
        for (const t of SEARCH_GRID(s.waves)) {
          const old = genLaw3(s.waves, t, samples, idx, 0, [0, 0, 0], SWEEP_HALF_EXTENT);
          const now = genLaw3(s.waves, t, samples, idx, sharpness, travel, SWEEP_HALF_EXTENT);
          let w = 0;
          for (let k = 0; k < old.length; k++) w = Math.max(w, Math.abs(old[k] - now[k]));
          best = Math.min(best, w);
        }
        const scale = reach + Math.max(...travel.map(Math.abs)) * SWEEP_HALF_EXTENT;
        if (!(best / scale <= TOL_REL)) seedPre++;
      }
    }
  }
  seed('the PRE-34.1 Score law — a bare `sin((n+ph)·fm)·am` with no basis branch and no secular term',
    seedPre,
    'if the old law agreed with the engine there would have been no defect to fix, and this whole section '
    + 'would be decorative — the count IS the measurement of how wrong the diagram was');

  /*
   * ⚠️ **SEED 2 — HALF A FIX IS NOT A FIX, AND THIS IS THE REALISTIC WRONG ONE.** `sharpness` is the visible
   * operator and `travel` the quiet one, so a Score honouring the basis and dropping the secular term is the
   * plausible partial repair. It must still fail.
   */
  let seedHalf = 0;
  for (const s of subjects) {
    const { samples } = sampleCountFor(s.waves);
    const reach = Math.max(authoredReach(s.waves), 1);
    const idx = probeIdx(samples, 32);
    for (const travel of SWEEP_TRAVEL) {
      if (travel.every(v => v === 0)) continue;
      let best = Infinity;
      for (const t of SEARCH_GRID(s.waves)) {
        const half = genLaw3(s.waves, t, samples, idx, 1, [0, 0, 0], SWEEP_HALF_EXTENT);
        const full = genLaw3(s.waves, t, samples, idx, 1, travel, SWEEP_HALF_EXTENT);
        let w = 0;
        for (let k = 0; k < half.length; k++) w = Math.max(w, Math.abs(half[k] - full[k]));
        best = Math.min(best, w);
      }
      const scale = reach + Math.max(...travel.map(Math.abs)) * SWEEP_HALF_EXTENT;
      if (!(best / scale <= TOL_REL)) seedHalf++;
    }
  }
  seed('a Score that honours `sharpness` and silently drops `travel`',
    seedHalf,
    'the visible operator fixed and the quiet one left behind — the partial repair that would have looked '
    + 'right in a browser on every preset that does not author travel');

  /*
   * ⚠️ **SEED 3 — THE PHASE TRAP, RE-SEEDED INSIDE THE SHARED LAW.** `sin(n · fm + phase)` instead of
   * `sin((n + phase) · fm)` agrees on every winding of 1 and disagrees *plausibly* on every other — a shifted
   * curve, not a broken one. §D pins the arithmetic on the readouts; this pins it on the drawn figure, because
   * `34.1` moved the expression into a file §D does not read.
   */
  let seedPhase = 0;
  const phaseOutside = (waves, time, samples, idx, sharp) => {
    const am = [], fm = [], ph = [];
    for (let w = 0; w < MAX_WAVES; w++) {
      am.push([0, 0, 0]); fm.push([0, 0, 0]); ph.push([0, 0, 0]);
      const wv = waves[w]; if (!wv) continue;
      for (let q = 0; q < AXES; q++) {
        const a = wv.axes[q];
        am[w][q] = mod(a.am.base ?? 0, a.am.amplitude ?? 0, a.am.frequency ?? 0, time);
        fm[w][q] = mod(a.fm.base ?? 0, a.fm.amplitude ?? 0, a.fm.frequency ?? 0, time) / DEG;
        ph[w][q] = a.phase ?? 0;
      }
    }
    const cStep = 360 / samples, out = new Float64Array(idx.length * AXES);
    for (let k = 0; k < idx.length; k++) {
      const n = idx[k] * cStep;
      for (let q = 0; q < AXES; q++) {
        let v = 0;
        // THE SEED: the phase added OUTSIDE the multiplication.
        for (let w = 0; w < MAX_WAVES; w++) v += (sharp === 1
          ? (() => { const a = n * fm[w][q] + ph[w][q], u = a * INV_TAU_ORACLE + 0.25; return 1 - 4 * Math.abs(u - Math.floor(u) - 0.5); })()
          : Math.sin(n * fm[w][q] + ph[w][q])) * am[w][q];
        out[k * AXES + q] = v;
      }
    }
    return out;
  };
  for (const s of subjects) {
    const { samples } = sampleCountFor(s.waves);
    const reach = Math.max(authoredReach(s.waves), 1);
    const idx = probeIdx(samples, 32);
    for (const sharpness of [0, 1]) {
      let best = Infinity;
      for (const t of SEARCH_GRID(s.waves)) {
        const wrong = phaseOutside(s.waves, t, samples, idx, sharpness);
        const right = genLaw3(s.waves, t, samples, idx, sharpness, [0, 0, 0], SWEEP_HALF_EXTENT);
        let w = 0;
        for (let k = 0; k < wrong.length; k++) w = Math.max(w, Math.abs(wrong[k] - right[k]));
        best = Math.min(best, w);
      }
      if (!(best / reach <= TOL_REL)) seedPhase++;
    }
  }
  seed('`sin(n · fm + phase)` — the phase OUTSIDE the multiplication, inside the shared law',
    seedPhase,
    'the effective shift is phase × winding, so this is exact at winding 1 and plausibly wrong everywhere '
    + 'else; §D reads composer-model.ts and cannot see core/wave-law.ts at all');
}

/*
 * ⚠️⚠️ **THE IDENTITY CLAUSE IS WHAT LETS `ops` BE OPTIONAL AT ALL.** `34.1` gave `computeOverlayScores` a
 * defaulted third parameter so that twenty ratio thumbnails, two tab call sites and ~20 clauses in this file
 * stayed byte-identical. **That is a claim, so it is measured**: the default, the empty object and an explicit
 * identity bundle must produce BIT-IDENTICAL curves on every preset in the library. `sharpness: 0` is a BRANCH
 * in `sumWaveAxes` rather than a zero weight precisely so this can be bit-exact and not merely close.
 */
{
  let checkedCurves = 0, drift = [];
  const bits = (a, b) => {
    if ((a === null) !== (b === null)) return false;
    if (a === null) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  };
  for (const s of scored) {
    const bare = computeOverlayScores(s.waves, null);
    const empty = computeOverlayScores(s.waves, null, {});
    const explicit = computeOverlayScores(s.waves, null, { sharpness: 0, travel: [0, 0, 0], halfExtent: 50 });
    for (const pl of Object.keys(PLANE_AXES)) {
      for (const member of ['now', 'size', 'winding']) {
        checkedCurves++;
        if (!bits(bare[pl][member], empty[pl][member]) || !bits(bare[pl][member], explicit[pl][member])) {
          drift.push(`${s.n} ${pl}.${member}`);
        }
      }
    }
  }
  chk('an absent `ops`, an EMPTY `ops` and an explicit identity `ops` are BIT-IDENTICAL on the whole library',
    drift.length === 0,
    drift.length ? `${drift.length} curves drift: ${drift.slice(0, 5).join(', ')}`
      : `${checkedCurves} curves over ${scored.length} preset objects, compared with Object.is so a -0 is `
        + `CAUGHT where === would not see it. This is what keeps every pre-34.1 caller byte-identical`);
  seed('a default that resolved `sharpness` to anything but 0, e.g. a mid-blend "nicer-looking" diagram',
    (() => {
      let n = 0;
      for (const s of scored.slice(0, 40)) {
        const id = computeOverlayScores(s.waves, null);
        const tilted = computeOverlayScores(s.waves, null, { sharpness: 0.5 });
        if (!bits(id.xy.now, tilted.xy.now)) n++;
      }
      return n;
    })(),
    'a non-identity default would be invisible to every clause in this file that calls the two-argument form, '
    + 'which is most of them');
}

/*
 * ⚠️⚠️ **AND THE OPERATORS MUST ACTUALLY REACH THE DIAGRAM, OR EVERY CLAUSE ABOVE PASSES OVER A DEAD
 * PARAMETER.** This is the clause that would have FAILED before `34.1`, and it is the one that stays
 * falsifiable: a Score that accepted `ops` and ignored it would satisfy the identity clause above perfectly.
 * `31.R`'s lesson in miniature — an operator that is built, registered, exported and inert is what got three
 * features cut.
 */
{
  const movers = scored.filter(s => {
    const base = computeOverlayScores(s.waves, null).xy.now;
    const faceted = computeOverlayScores(s.waves, null, { sharpness: 1 }).xy.now;
    let w = 0;
    for (let i = 0; i < base.length; i++) w = Math.max(w, Math.abs(base[i] - faceted[i]));
    return w > authoredReach(s.waves) * 1e-6;
  });
  chk('`sharpness` MOVES the Score (so the agreement clause is not passing over an ignored parameter)',
    movers.length > scored.length * 0.5,
    `${movers.length} of ${scored.length} preset objects redraw under Sharpness = 1. ⚠ The bound is a MAJORITY `
    + `rather than all of them on purpose: a figure whose every winding is 0 draws a point, and the basis of a `
    + `constant is a constant — the library happens to contain none today, and a shortfall tomorrow would be a `
    + `claim about the LIBRARY rather than about this parameter`);

  const travelMovers = scored.filter(s => {
    const base = computeOverlayScores(s.waves, null).xy.now;
    const swept = computeOverlayScores(s.waves, null, { travel: [1, 0, 0], halfExtent: 50 }).xy.now;
    let w = 0;
    for (let i = 0; i < base.length; i++) w = Math.max(w, Math.abs(base[i] - swept[i]));
    return w > 1e-6;
  });
  chk('...and so does `travel`, which is the operator a partial fix would have left behind',
    travelMovers.length === scored.length,
    `${travelMovers.length} of ${scored.length}: the secular term is additive and index-driven, so unlike the `
    + `basis it moves EVERY figure, including one with no winding at all`);
}

/*
 * ⚠️ **SOURCE-SHAPED, AND IT SAYS SO: this is the clause that fails if the named owner is BYPASSED rather than
 * if the arithmetic drifts.** The measured clauses above cannot tell a shared law from two laws that happen to
 * agree today — which is precisely the state Phase 33 left behind in the other direction. So: both callers must
 * import `core/wave-law.ts`, and neither may hold the triangle arithmetic or a sine-blend of its own.
 */
{
  const lissSrc = readFileSync(join(ROOT, 'src/generators/lissajous.ts'), 'utf8');
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const lissCode = strip(lissSrc), scoreCode = strip(SCORE_SRC);
  const importsLaw = (s) => /from '(?:\.\.\/)+core\/wave-law\.ts'/.test(s);
  // ⚠️ Comments are stripped FIRST, exactly as `deadcheck` and §G do — both files discuss the triangle at
  // length in prose, so without the strip this clause would fail on correct code.
  const ownsTriangle = (s) => /INV_TAU/.test(s) || /Math\.floor\([^)]*\)\s*-\s*0\.5/.test(s);
  chk('BOTH the generator and the Score import the shared law, and NEITHER re-implements the basis',
    importsLaw(lissCode) && importsLaw(scoreCode) && !ownsTriangle(lissCode) && !ownsTriangle(scoreCode),
    `lissajous imports=${importsLaw(lissCode)} owns-triangle=${ownsTriangle(lissCode)}; `
    + `score-canvas imports=${importsLaw(scoreCode)} owns-triangle=${ownsTriangle(scoreCode)}. `
    + '⚠ SOURCE-shaped: a failure means an owner was bypassed or renamed, not that the arithmetic moved');
  seed('the triangle arithmetic copied back into a caller',
    ownsTriangle('const u = a * INV_TAU + 0.25; const tri = 1 - 4 * Math.abs(u - Math.floor(u) - 0.5);') ? 1 : 0,
    'two copies that agree TODAY is the state 33.2 shipped — the clause has to see the copy, not the agreement');

  /*
   * ⚠️ **AND THE SCORE MUST NAME BOTH OPERATORS, which is the absence that WAS the defect.** Measured before
   * `34.1`: zero occurrences of `sharpness` and zero of `travel` in the whole file. A clause asserting a
   * PRESENCE is weak in general; it is the right clause here because the absence is the thing that shipped.
   */
  /*
   * v8 `34.5` — ⚠️ **FOUR OPERATORS NOW, AND THE TWO ADDED HERE ARE WHY THIS CLAUSE IS WORTH WIDENING RATHER
   * THAN LEAVING AT ITS PHASE-33 PAIR.** A presence clause is weak in general; it is the right clause here
   * because the ABSENCE is the thing that shipped, and each of these four arrived in `overlay` in a phase
   * that touched the generator and not this file. ⚠️ `sharpnessStructure`/`sharpnessDetail` are named
   * separately from `sharpness` on purpose: a file that resolved all three levels from the Body value would
   * pass a scan for `sharpness` alone.
   */
  const names = ['sharpness', 'sharpnessStructure', 'sharpnessDetail', 'travel', 'offset', 'grow']
    .filter(w => new RegExp(w).test(scoreCode));
  chk('...and the Score\'s CODE names all FOUR figure operators, levels included',
    names.length === 6,
    `found ${names.length}/6 (${names.join(', ')}) in comment-stripped source. Before 34.1 sharpness and `
    + 'travel were 0/2 and `verify` was green over it for a whole phase; offset and grow would have been '
    + 'the same defect a second time');
}

// ---------------------------------------------------------------------------------------------------
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  composercheck: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
