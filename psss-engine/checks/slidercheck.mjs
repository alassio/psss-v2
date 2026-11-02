/**
 * `slidercheck` — the Sliders tab's fourteen rows, held to the five properties a grep cannot see.
 * v8 Phase 26, step `26.9`, decision `26.D13`.
 *
 * ⚠️ **IT MUST MEASURE, AND THE DEFECTS ARE WHY.** All three defects this phase fixes were invisible to
 * every text-level instrument in this tree, and two of them were invisible to an AGGREGATE measurement as
 * well: the 2026-10-03 evaluation led with a leaf-count diff over the whole library and read as healthy,
 * because **an aggregate cannot see one writer clobbering another writer's field.** The defects were found
 * only by comparing a SINGLE row's result against the COMBINED result, which is clause (a) below.
 *
 * ⚠️ **THE THREE DEFECTS, EACH WITH THE FIGURE THAT FOUND IT:**
 *  - **A** — `grading()` returned a brand-new object on every call, and it has four call sites run in
 *    `SEMANTIC_SLIDERS` order, so the LAST grading row won. `Depth`'s `depthSize` differed from its
 *    single-row result on **274/274** at 0.8.
 *  - **B** — `Glow` called `grading()` twice and the second call discarded its own halo write, over the
 *    top 35 % of its travel, with a silent discontinuity at **0.65**.
 *  - **C** — the rebuild seeded from the literal `'Legacy'`, discarding the authored grade of the **145**
 *    presets that carry `customFilmLookParams` without `sliderBaseFilmLook`.
 *
 * ⚠️ **AT 0.8 THE GLOW AND MOOD FIGURES READ 0/274 AND THAT IS NOT HEALTH — IT IS A AND B MASKING EACH
 * OTHER.** A badly chosen sample point sees nothing, which is this file's main exposure: **every clause
 * below is calibrated against a re-introduced defect in section F, and a clause that passes on both the
 * fixed and the broken code is worthless.**
 *
 * ⚠️ **`loadLibrary` IS EXPORTED FROM `src/presets/library.ts`, NOT FROM `manager.ts`**, and
 * `public/psss_presets.json` is **not plain JSON** — it opens `g_psss_presets={`.
 */
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const { SEMANTIC_SLIDERS, SLIDER_OWNED_OVERLAY_KEYS, beginGradingPass, sliderMul } =
  await import('../src/exploration/slider-mappings.ts');
const { computePresetStatistics } = await import('../src/exploration/preset-stats.ts');
const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`);
  ok ? pass++ : fail++;
};
const note = (m) => console.log(`  NOTE  ${m}`);
/**
 * ⚠️ **A SEEDED DEFECT MUST BE SHOWN TO FAIL.** `seed` runs one of this file's own gates over deliberately
 * broken behaviour and asserts the gate reports at least one violation. A gate that cannot see the defect
 * it exists for is worse than a missing gate, because it reports green.
 */
const seed = (n, violations, why) => {
  const ok = violations > 0;
  console.log(`  ${ok ? 'CALIB' : 'CALIBRATION FAIL'}  ${n} — seeded defect ${ok ? `caught (${violations} violation${violations === 1 ? '' : 's'})` : 'NOT CAUGHT'}${ok ? '' : '   ' + why}`);
  ok ? pass++ : fail++;
};

const clone = (v) => JSON.parse(JSON.stringify(v));
const J = (v) => JSON.stringify(v ?? null);

const rawText = rd('public/psss_presets.json');
const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
const mgr = new PresetManager();
loadLibrary(mgr, rawLib);
const NAMES = mgr.list();
const N = NAMES.length;
const LIB = new Map(NAMES.map((n) => [n, clone(mgr.get(n))]));
const STATS = computePresetStatistics([...LIB.values()]);

/**
 * Run the tab's apply pass over one preset. ⚠️ **This mirrors `applyAllSliders()`'s PASS DISCIPLINE and
 * nothing else** — it deliberately does not reproduce the overlay merge, because the merge is the tab's
 * revert mechanism and clause (e) checks the LIST it is driven by rather than the merge itself.
 */
function applyRows(preset, values) {
  const out = clone(preset);
  const gp = beginGradingPass(preset);
  for (const def of SEMANTIC_SLIDERS) {
    const v = values[def.id] ?? 0.5;
    if (v !== 0.5) def.apply(out, v, STATS, gp);
  }
  return out;
}

/** Every leaf path a row's own channels could land on, flattened to `path -> JSON`. */
function leaves(v, prefix = '', out = {}) {
  if (v === null || typeof v !== 'object') { out[prefix] = J(v); return out; }
  for (const [k, child] of Object.entries(v)) {
    if (prefix === '' && k === 'metadata') continue;
    leaves(child, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== A. the basis, and the one endpoint nobody may assert an equality against ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
note(`library: ${N} presets · rows: ${SEMANTIC_SLIDERS.length} · owned overlay keys: ${SLIDER_OWNED_OVERLAY_KEYS.length}`);
note(`row order (apply order): ${SEMANTIC_SLIDERS.map((d, i) => `${i}:${d.id}`).join(' ')}`);

/*
 * ⚠️ **`sliderMul(1)` IS NOT EXACTLY 5 AND AN EQUALITY ASSERTION AGAINST `5` IS A REAL FAILURE CLASS HERE.**
 * `2 ** (log2(5) · (2v − 1))` gives `4.999999999999999` at the top. The clause therefore asserts the
 * endpoints to a tolerance and asserts the EXACT identity only at centre, where the arithmetic is exact.
 */
chk('`sliderMul` is one curve: 0 → 0.2×, 0.5 → exactly 1×, 1 → ~5× (never asserted as exactly 5)',
  Math.abs(sliderMul(0) - 0.2) < 1e-12 && sliderMul(0.5) === 1 && Math.abs(sliderMul(1) - 5) < 1e-12
  && sliderMul(1) !== 5,
  `0 → ${sliderMul(0)} · 0.5 → ${sliderMul(0.5)} · 1 → ${sliderMul(1)} (the top endpoint is NOT 5)`);

/*
 * ⚠️ **THIS CLAUSE WAS A GREP AND THE GREP WAS MATCHING COMMENT TEXT — my own defect, caught on the first
 * run (2026-10-06).** It searched the `SEMANTIC_SLIDERS` body for `Math.pow(2,` or `** (` and the second
 * alternative matches a markdown bold-close followed by a parenthesis, which appears in the row comments.
 * **A clause that fails on prose asserts nothing about code.** It is now a MEASUREMENT of the property
 * `26.D10` actually cares about: every row responds to position, and the response is the SHARED curve, so
 * a row with its own mapping shows up as a response that does not match `sliderMul`.
 */
{
  // ⚠️ **THE AXIS IS SEARCHED FOR, NOT ASSUMED.** The first attempt read `waves[0].axes[0].fm.frequency`
  // and that field is **0** on the preset it landed on, so the ratio was never computed and the clause
  // failed with an empty measurement — an unreachable assertion, which is worse than a missing one.
  let probe = null, wi = 0, ai = 0;
  outer: for (const n of NAMES) {
    const pr = LIB.get(n);
    for (let w = 0; w < pr.generators.waves.length; w++) {
      for (let a = 0; a < pr.generators.waves[w].axes.length; a++) {
        if (pr.generators.waves[w].axes[a].fm.frequency !== 0) { probe = pr; wi = w; ai = a; break outer; }
      }
    }
  }
  // `complexity` scales wave fields by exactly `sliderMul(v)`, so its curve is directly observable with no
  // grading pass in the way.
  const observed = [];
  for (const v of [0.25, 0.75]) {
    const out = applyRows(probe, { complexity: v });
    observed.push(out.generators.waves[wi].axes[ai].fm.frequency
      / probe.generators.waves[wi].axes[ai].fm.frequency);
  }
  const want = [sliderMul(0.25), sliderMul(0.75)];
  chk('a row\'s response IS `sliderMul` — one curve, no per-row mapping (26.D10)',
    observed.length === 2 && observed.every((r, i) => Math.abs(r - want[i]) < 1e-9),
    `complexity at 0.25/0.75 scaled fm.frequency by ${observed.map((r) => r.toFixed(6)).join(' / ')} `
    + `against sliderMul ${want.map((r) => r.toFixed(6)).join(' / ')}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== B. clause (a) — one row alone equals that row inside the full pass (DEFECT A) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THE ONE CLAUSE A GREP COULD NEVER BE.** It is also the clause whose SAMPLE POINT matters: at 0.8 the
 * Glow and Mood oracles read 0/274 before the fix because Defects A and B masked each other, so this runs
 * at TWO positions and reports both. **Reconcile by NAME, never by totalling the per-row numbers.**
 */
const GRADING_ROWS = ['depth', 'glow', 'mood'];
function soloVsCombined(position, runner = applyRows) {
  const all = {};
  for (const d of SEMANTIC_SLIDERS) all[d.id] = position;
  const out = {};
  for (const id of GRADING_ROWS) out[id] = [];
  for (const name of NAMES) {
    const base = LIB.get(name);
    const combined = runner(base, all);
    for (const id of GRADING_ROWS) {
      const solo = runner(base, { [id]: position });
      // Compare only the row's OWN grading channels — a row is not responsible for another's fields.
      const chans = id === 'depth' ? ['depthSize']
        : id === 'glow' ? ['glow', 'bloomEnabled', 'bloomIntensity']
        : ['exposure', 'saturation', 'toneMapEnabled', 'toneMapCurve'];
      for (const c of chans) {
        const a = J(solo.overlay?.customFilmLookParams?.[c]);
        const b = J(combined.overlay?.customFilmLookParams?.[c]);
        if (a !== b) { out[id].push(`${name}.${c}: solo ${a} vs combined ${b}`); break; }
      }
    }
  }
  return out;
}
for (const position of [0.6, 0.8]) {
  const v = soloVsCombined(position);
  for (const id of GRADING_ROWS) {
    chk(`at ${position}, \`${id}\`'s own grading channels survive the full pass on all ${N} presets`,
      v[id].length === 0,
      v[id].length ? `${v[id].length}/${N} differ — e.g. ${v[id][0]}` : `${N}/${N} identical`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== C. clause (b) — monotonic with no discontinuity, sampled ACROSS 0.65 (DEFECT B) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THE SAMPLING IS THE ASSERTION.** Defect B's discontinuity sat at exactly 0.65 and `renderer.glow`
 * kept rising across it, so the slider still did something visible on a ribbon or neon preset and only the
 * film-look halo was dead. A monotonicity check that skipped 0.65 — or that read `renderer.glow` instead of
 * the grading field — would have passed every day of the defect's life.
 */
const SWEEP = [0.52, 0.56, 0.60, 0.64, 0.66, 0.70, 0.80, 0.90, 1.00];
function glowSweepViolations(runner = applyRows) {
  const bad = [];
  for (const name of NAMES) {
    const base = LIB.get(name);
    let prev = -Infinity, prevPos = null;
    for (const v of SWEEP) {
      const g = runner(base, { glow: v }).overlay?.customFilmLookParams?.glow;
      if (typeof g !== 'number') { bad.push(`${name}@${v}: glow absent`); break; }
      // Non-decreasing: the row scales upward across its whole upper travel. A DROP is the defect.
      if (g < prev - 1e-9) { bad.push(`${name}: glow ${prev} @${prevPos} → ${g} @${v}`); break; }
      prev = g; prevPos = v;
    }
  }
  return bad;
}
{
  const bad = glowSweepViolations();
  chk(`\`glow\`'s film-look halo never DROPS across ${SWEEP.join('/')} — the 0.65 branch is sampled`,
    bad.length === 0,
    bad.length ? `${bad.length}/${N} — e.g. ${bad[0]}` : `${N}/${N} monotonic across the branch boundary`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== D. clause (c) — centre is a byte-identical no-op, and it must NOT touch the look ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **"CENTRE DOES NOTHING" HAS A SECOND HALF THAT IS EASY TO BREAK AND INVISIBLE: calling `grading()` at
 * centre silently converts a preset from its NAMED look to "Customize (a copy of it)"** — visually
 * identical, and it strips the user's named choice from every later export. So this asserts byte-identity
 * over the whole preset, which catches the conversion as well as any value change.
 */
{
  const bad = [];
  for (const name of NAMES) {
    const base = LIB.get(name);
    const out = applyRows(base, {});
    if (J(out) !== J(base)) bad.push(name);
  }
  chk(`all ${SEMANTIC_SLIDERS.length} rows at centre leave the preset byte-identical on all ${N}`,
    bad.length === 0,
    bad.length ? `${bad.length} changed — e.g. ${bad[0]}` : `${N}/${N} byte-identical, named looks intact`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== E. clause (d) — idempotence at N = 20, the ×875 oracle (DEFECT C\'s mechanism) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **N ≥ 20 IS THE WHOLE POINT AND N = 2 WOULD BE SATISFIABLE BY THE DEFECT.** A slider fires on every
 * `input` event, so one drag is dozens of applies. An earlier version of `grading()` reused the LIVE seed
 * so "repeated moves compose": `Mood` re-multiplied an already-multiplied exposure each time and reached
 * **×875** within ~40 events, going flat white — **irrecoverably, because returning to centre makes
 * `apply()` return early and so never writes a corrected value.** An oracle at N = 2 sees a 2× drift and
 * calls it rounding.
 */
const REPEATS = 20;
/**
 * Drive the tab's apply loop the way a DRAG does: `REPEATS` successive applies, each one starting from the
 * FIXED baseline while the previous output's overlay is carried forward as live FX state.
 *
 * ⚠️ **MODELLING THIS FAITHFULLY IS THE WHOLE DIFFICULTY, AND A FIRST VERSION OF THIS SECTION GOT IT
 * WRONG IN THE INTERESTING DIRECTION.** It fed each output back in as the next INPUT and reported 274/274
 * compounding, exposure reaching **×875** after 20 — the historical figure exactly. **But the engine was
 * right and the oracle was wrong:** `applyAllSliders()` never re-applies to its own output; it deep-copies
 * `this.baseline` every pass. And seeding from a preset whose grade is already scaled *must* compound —
 * that is what *"seed from the preset's own grade"* MEANS once you hand it a scaled preset. **"Seed from
 * the preset's own grade" and "seed from the live overlay" are two readings of one sentence and only the
 * first is survivable**, so the oracle has to distinguish them rather than conflate them.
 *
 * So the loop below reproduces the TWO protections that actually hold the contract, and the seed in §G
 * removes both:
 *  1. the pass is opened on the **fixed baseline**, never on the working copy;
 *  2. the slider-owned keys are **reverted** out of the carried-forward live overlay, because absent must
 *     stay absent — which is why `SLIDER_OWNED_OVERLAY_KEYS` is a revert mechanism and not a hint.
 */
function driveDrag(base, values, { protectedPass = true } = {}) {
  let live = null;
  let last = null;
  for (let i = 0; i < REPEATS; i++) {
    const work = clone(base);
    if (live) {
      const merged = { ...live, ...(work.overlay ?? {}) };
      if (protectedPass) {
        // The three-tier revert, minus `fxBaseline` (which has no analogue outside the tab): what the
        // BASELINE declares wins, else the key is DELETED.
        for (const k of SLIDER_OWNED_OVERLAY_KEYS) {
          if (work.overlay && k in work.overlay) continue;
          delete merged[k];
        }
      }
      work.overlay = merged;
    }
    const gp = beginGradingPass(protectedPass ? base : work);
    for (const def of SEMANTIC_SLIDERS) {
      const v = values[def.id] ?? 0.5;
      if (v !== 0.5) def.apply(work, v, STATS, gp);
    }
    live = clone(work.overlay ?? {});
    last = work;
  }
  return last;
}
function idempotenceViolations(opts = {}) {
  const bad = [];
  for (const name of NAMES) {
    const base = LIB.get(name);
    for (const id of ['mood', 'glow', 'depth']) {
      const once = applyRows(base, { [id]: 0.7 });
      const many = driveDrag(base, { [id]: 0.7 }, opts);
      const a = J(once.overlay?.customFilmLookParams);
      const b = J(many.overlay?.customFilmLookParams);
      if (a !== b) {
        bad.push(`${name}.${id}: exposure ${once.overlay?.customFilmLookParams?.exposure} once vs `
          + `${many.overlay?.customFilmLookParams?.exposure} after ${REPEATS}`);
        break;
      }
    }
  }
  return bad;
}
{
  const bad = idempotenceViolations();
  chk(`a ${REPEATS}-event drag at one position equals a single apply, on all ${N}`,
    bad.length === 0,
    bad.length ? `${bad.length}/${N} compound — e.g. ${bad[0]}` : `${N}/${N} idempotent across ${REPEATS} applies`);
}
/*
 * ⚠️ **AND `apply` MUST NOT MUTATE THE BASELINE IT IS SEEDED FROM.** The loop above re-reads `base` every
 * iteration, so an `apply` that reached through a shared reference would make the drag drift while every
 * single-apply clause stayed green — a different defect from compounding, with the same symptom.
 */
{
  const bad = [];
  for (const name of NAMES) {
    const base = LIB.get(name);
    const before = J(base);
    applyRows(base, { mood: 0.8, glow: 0.8, depth: 0.8, complexity: 0.8 });
    if (J(base) !== before) bad.push(name);
  }
  chk('no row mutates the baseline it was seeded from', bad.length === 0,
    bad.length ? `${bad.length} mutated — e.g. ${bad[0]}` : `${N}/${N} baselines untouched`);
}

/*
 * Defect C's own oracle, stated as a property rather than as a figure: a grading row must scale the
 * preset's OWN authored grade, so a field the row does not name may not move.
 */
{
  const UNRELATED = ['bloomThreshold', 'lightingMode', 'depthBrightness', 'depthDof', 'depthColorShift'];
  const carriers = NAMES.filter((n) => LIB.get(n).overlay?.customFilmLookParams);
  const bad = [];
  for (const name of carriers) {
    const base = LIB.get(name);
    const out = applyRows(base, { mood: 0.6 });
    const before = base.overlay.customFilmLookParams;
    const after = out.overlay?.customFilmLookParams ?? {};
    for (const f of UNRELATED) {
      if (f in before && J(before[f]) !== J(after[f])) {
        bad.push(`${name}.${f}: ${J(before[f])} → ${J(after[f])}`);
        break;
      }
    }
  }
  chk('a `mood` nudge leaves every grading field the row does not name untouched (DEFECT C)',
    bad.length === 0,
    bad.length ? `${bad.length}/${carriers.length} carriers lost a field — e.g. ${bad[0]}`
      : `${carriers.length} presets author customFilmLookParams; none lost an unrelated field`);
  chk('...and the authored value is what gets scaled, not a bundle default (DEFECT C, exposure witness)',
    (() => {
      const w = NAMES.find((n) => typeof LIB.get(n).overlay?.customFilmLookParams?.exposure === 'number'
        && LIB.get(n).overlay.customFilmLookParams.exposure !== 1);
      if (!w) return false;
      const base = LIB.get(w);
      const got = applyRows(base, { mood: 0.6 }).overlay?.customFilmLookParams?.exposure;
      const want = base.overlay.customFilmLookParams.exposure * Math.sqrt(sliderMul(0.6));
      return Math.abs(got - want) < 1e-9;
    })(),
    'the old code seeded from the Legacy bundle, so an authored 1.4 became 1.0 × √1.378 = 1.175 — the '
    + 'authored value was discarded BEFORE the multiplier, which is why scaling the right number is the '
    + 'assertion and not merely "something changed"');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== F. clause (e) — SLIDER_OWNED_OVERLAY_KEYS covers the rows, in BOTH directions ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **BOTH DIRECTIONS, BECAUSE THE TWO FAILURES ARE DIFFERENT DEFECTS.** A key written and not listed
 * **LEAKS** — it is never reverted, so returning every row to centre does not restore the preset, and that
 * is invisible to `tsc` and to every other checker. A key listed and never written is dead weight that
 * makes the list stop being a description of the rows.
 */
  /*
   * ⚠️ **THE SCAN IS THE WHOLE LIBRARY AND IT READ `NAMES.slice(0, 40)` UNTIL 2026-10-06, WHICH REPORTED
   * `dye` AS DEAD WEIGHT — a false finding, and a basis error of exactly the kind this file keeps meeting.**
   * `overlay.dye` is carried by **5 presets of 274**, and none of them is in the first forty, so the row
   * that writes it looked like a row that writes nothing. **A sample is not a reach measurement**, and the
   * blocks these rows reach are rare by construction: dye 5, liquid 22, sparks 23, curlNoise-enabled 7.
   * **Any clause about what a row CAN write has to see every carrier.**
   */
  const written = new Set();
  for (const name of NAMES) {
    const base = LIB.get(name);
    for (const d of SEMANTIC_SLIDERS) {
      for (const v of [0.2, 0.8]) {
        const out = applyRows(base, { [d.id]: v });
        const b = base.overlay ?? {};
        for (const k of Object.keys(out.overlay ?? {})) {
          if (J(b[k]) !== J(out.overlay[k])) written.add(k);
        }
      }
    }
  }
  const listed = new Set(SLIDER_OWNED_OVERLAY_KEYS);
  const unlisted = [...written].filter((k) => !listed.has(k));
  const unwritten = [...listed].filter((k) => !written.has(k));
  chk('every `overlay` key the rows write is in SLIDER_OWNED_OVERLAY_KEYS (the LEAK direction)',
    unlisted.length === 0,
    unlisted.length ? `UNLISTED and therefore leaking: ${unlisted.join(', ')}`
      : `${written.size} key(s) written, all listed: ${[...written].sort().join(', ')}`);
  chk('...and every listed key is actually written by some row (the dead-weight direction)',
    unwritten.length === 0,
    unwritten.length ? `listed but never written: ${unwritten.join(', ')}` : `${listed.size} listed, all reached`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== G. the `scale` column — every law reachable, every scaler OBSERVED (26.3) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THE UNION AND THE `Record` ALREADY PROVE "THE OWNER EXISTS" AND "THE OWNER IS REACHABLE" — THIS
 * SECTION CLOSES THE ONE GAP THEY CANNOT: the sub-field NAMES inside a scaler are string literals.**
 * `scaleMaterial` writing `b['heatGian']` compiles, is reached, and does nothing — the row would be inert
 * on all 84 material presets with every type-level proof still green. So each scaler must be **observed
 * moving a real value on a real preset**, which is the only instrument that can see a typo.
 */
{
  const { OVERLAY_RULES: RULES } = await import('../src/exploration/overlay-rules.ts');
  const scaleKinds = {};
  const owners = new Set();
  for (const [k, r] of Object.entries(RULES)) {
    scaleKinds[r.scale.kind] = (scaleKinds[r.scale.kind] ?? 0) + 1;
    if (r.scale.kind === 'block') owners.add(r.scale.owner);
  }
  note(`scale law census: ${Object.entries(scaleKinds).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

  /*
   * `none` carries a reason, for the same arrangement `MutateLaw.frozen` uses: "no row scales this" and
   * "a row forgot this" are the same table entry if omission is how you say the first.
   */
  const reasonless = Object.entries(RULES)
    .filter(([, r]) => r.scale.kind === 'none' && !(r.scale.why ?? '').trim());
  chk('every `none` scale law carries its reason (the frozen-law arrangement)',
    reasonless.length === 0,
    reasonless.length ? `no reason: ${reasonless.map(([k]) => k).join(', ')}`
      : `${scaleKinds['none'] ?? 0} keys are explicitly not scalable, each with a why`);

  /*
   * ⚠️ **A `mul-clamped` BOUND MUST AGREE WITH THE SAME KEY'S `mutate` BOUND.** Four keys carry both a
   * continuous mutation range and a scale clamp, and they are the same physical limit written twice in one
   * file — the exact shape of duplication that drifts silently. `mixercheck` §J already re-reads these from
   * the files that own them, so agreeing with `mutate` chains this clause onto that one.
   */
  const disagree = [];
  for (const [k, r] of Object.entries(RULES)) {
    if (r.scale.kind !== 'mul-clamped' || r.mutate.kind !== 'continuous') continue;
    if (r.scale.min !== r.mutate.min || r.scale.max !== r.mutate.max) {
      disagree.push(`${k}: scale [${r.scale.min}, ${r.scale.max}] vs mutate [${r.mutate.min}, ${r.mutate.max}]`);
    }
  }
  chk('a key carrying BOTH a scale clamp and a mutate range states the same bounds',
    disagree.length === 0,
    disagree.length ? disagree.join('; ') : 'the same physical limit is never written twice with two values');

  /*
   * Each block scaler, observed. ⚠️ **The row is driven, not the scaler** — calling `SCALERS` directly
   * would prove the function works and say nothing about whether a ROW ever reaches it, which is the
   * half that was inert on the Randomiser for four phases.
   */
  const ROW_FOR_OWNER = {
    scaleCurlNoise: 'turbulence',
    scaleMaterial: 'heat',
    scaleLiquid: 'substance',
    scaleDye: 'substance',
    scaleSparks: 'substance',
    scaleChainWeights: 'warp',
  };
  const BLOCK_FOR_OWNER = {
    scaleCurlNoise: 'curlNoise', scaleMaterial: 'material', scaleLiquid: 'liquid',
    scaleDye: 'dye', scaleSparks: 'sparks', scaleChainWeights: 'transMapChain',
  };
  chk('every `ScalerId` in the union is named by some key in the table',
    [...Object.keys(ROW_FOR_OWNER)].every((o) => owners.has(o)) && owners.size === Object.keys(ROW_FOR_OWNER).length,
    `table names ${[...owners].sort().join(', ')}`);

  for (const [owner, rowId] of Object.entries(ROW_FOR_OWNER)) {
    const blockKey = BLOCK_FOR_OWNER[owner];
    const carriers = NAMES.filter((n) => LIB.get(n).overlay?.[blockKey] !== undefined);
    let moved = 0;
    const moves = new Set();
    for (const name of carriers) {
      const base = LIB.get(name);
      const out = applyRows(base, { [rowId]: 0.8 });
      const before = leaves(base.overlay?.[blockKey] ?? null);
      const after = leaves(out.overlay?.[blockKey] ?? null);
      let any = false;
      for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (before[k] !== after[k]) { moves.add(k); any = true; }
      }
      if (any) moved++;
    }
    chk(`\`${owner}\` is OBSERVED moving a real sub-field through its row (\`${rowId}\`)`,
      moved > 0,
      moved > 0
        ? `${moved} of ${carriers.length} \`${blockKey}\` carriers moved; fields: ${[...moves].sort().join(', ')}`
        : `${carriers.length} carriers and NONE moved — a sub-field name in the scaler does not exist`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== H. CALIBRATION — every clause re-run over a re-introduced defect ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **A MEASURING SECTION'S OWN BASIS HAS BEEN THE DEFECT REPEATEDLY IN THIS TREE, AND SEEDS DO NOT
 * PROTECT THE CHECKER'S OWN FIGURES.** Each seed below reproduces one pre-Phase-26 behaviour and asserts
 * the matching clause reports it. ⚠️ **The third seed is the one whose absence would let this phase
 * re-ship the ×875 flat-white regression**, so it is not optional.
 */

// Seed 1 — DEFECT A: a brand-new grading object per call, i.e. a fresh pass for every row.
const seedDefectA = (preset, values) => {
  const out = clone(preset);
  for (const def of SEMANTIC_SLIDERS) {
    const v = values[def.id] ?? 0.5;
    if (v !== 0.5) def.apply(out, v, STATS, beginGradingPass(preset)); // a NEW pass each row
  }
  return out;
};
{
  const v = soloVsCombined(0.6, seedDefectA);
  seed('clause (a) sees a fresh grading object per row — the last row wins',
    GRADING_ROWS.reduce((t, id) => t + v[id].length, 0),
    'the solo-vs-combined oracle is the only instrument that can see one writer clobbering another');
}

// Seed 2 — DEFECT B: Glow's halo write discarded above 0.65, by re-opening the pass inside the branch.
const seedDefectB = (preset, values) => {
  const out = clone(preset);
  const gp = beginGradingPass(preset);
  for (const def of SEMANTIC_SLIDERS) {
    const v = values[def.id] ?? 0.5;
    if (v !== 0.5) def.apply(out, v, STATS, gp);
    // Reproduce the second `grading()` call: above 0.65 the object is rebuilt from the seed, so the halo
    // write made a few lines earlier is thrown away and `glow` snaps back to the bundle's value.
    if (def.id === 'glow' && v > 0.65 && out.overlay?.customFilmLookParams) {
      out.overlay.customFilmLookParams = { ...(gp.seedParams ?? {}), bloomEnabled: true };
    }
  }
  return out;
};
seed('clause (b) sees the halo write discarded above 0.65',
  glowSweepViolations(seedDefectB).length,
  'a sweep that skipped 0.65, or read `renderer.glow` instead of the grading field, would pass over it');

// Seed 3 — the COMPOUNDING defect: both protections removed at once, which is the pre-2026-08-06 state.
// ⚠️ **THIS IS THE SEED WHOSE ABSENCE WOULD LET THE PHASE RE-SHIP THE ×875 FLAT-WHITE REGRESSION.** It
// opens the pass on the WORKING COPY instead of the baseline and stops reverting the slider-owned keys, so
// each apply re-multiplies the previous apply's exposure — and because returning to centre makes `apply()`
// return early, the result was historically irrecoverable rather than merely wrong.
seed('clause (d) sees a pass seeded from the working copy with no owned-key revert — the ×875 defect',
  idempotenceViolations({ protectedPass: false }).length,
  'an oracle at N = 2 would see a 2x drift and call it rounding, which is why N = ' + REPEATS);

// Seed 4 — clause (c): a row that writes at centre, i.e. the silent Customize conversion.
{
  const bad = [];
  for (const name of NAMES) {
    const base = LIB.get(name);
    const out = clone(base);
    // What calling `grading()` at centre does: converts a named look to Customize with identical values.
    const gp = beginGradingPass(base);
    if (!out.overlay) out.overlay = {};
    out.overlay.filmLook = 'Customize';
    out.overlay.customFilmLookParams = { ...(gp.seedParams ?? {}) };
    if (J(out) !== J(base)) bad.push(name);
  }
  seed('clause (c) sees a centre apply that converts a named look to Customize', bad.length,
    'the conversion is visually identical, so byte-identity over the whole preset is the only oracle');
}

// ---------------------------------------------------------------------------------------------------
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  slidercheck: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
