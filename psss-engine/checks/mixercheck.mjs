/**
 * `mixercheck` — v8 **Phase 23.6**. The instrument for the Mixer's total blend.
 *
 * ## What this file is for
 *
 * Until 2026-10-05 `interpolatePreset()` assigned `result.overlay` **wholesale** from two hand-written object
 * literals, so every `overlay` key missing from the literal in force was destroyed at every `t` — including
 * `t = 0`, where the crossfader's own handle claims to be showing deck A untouched. Step 23.0's census
 * (2026-10-01, N = 274) measured the consequence: **270 of 274** presets lost at least one effective feature,
 * **263 of 274** had their grade reset, at a median of **49** lost leaf paths. The repair was architectural —
 * `src/exploration/overlay-rules.ts` now holds one rule per key and `tsc` will not let that table be short —
 * but a table is a claim about intent, and `tsc` cannot check arithmetic. **This file is the measurement.**
 *
 * ⚠️ **THE DEFECT WAS NEVER IN THE ARITHMETIC.** Every lerp in `interpolate.ts` was correct before the fix
 * and is correct after it. The whole hole was in *what never entered the function*. That is why §B asserts
 * completeness and §C measures ENDPOINTS rather than midpoints: a midpoint oracle would have passed, happily,
 * for every one of the months the library was being flattened.
 *
 * ## The rules this file is held to (CLAUDE.md, *Verify*)
 *
 * - **A measuring section's own basis has been the defect repeatedly.** Hence §H: every gate in §C, §D, §E, §F
 *   and §G is re-run over a deliberately broken input and must report a violation. **A seed that passes is a
 *   CALIBRATION FAIL and exits non-zero** — the checker is then claiming it cannot see what it was written to
 *   see. ⚠️ **Seeds do not protect this file's own figures**; §A states its basis instead of quoting one.
 * - **A total agreeing with a total proves nothing.** §A reconciles the key sets by NAME.
 * - **Never read a failure count as a defect count, either direction.** One missing rule shows up in §B once
 *   and in §C on as many pairs as the library happens to exercise; the two numbers are not comparable.
 * - **Read a failure as a claim about the checker until it is exonerated.** The measuring sections here
 *   (§C, §D, §F) must never be simplified into greps.
 *
 * ## The one thing to understand before changing §C
 *
 * §C does **not** require a crossfade result to be byte-identical to its deck at the endpoint. Three families
 * of difference are legitimate, and each is admitted by a **PREDICATE THAT READS THE DECK**, never by a name
 * on a list:
 *
 * 1. the result's IDENTITY is deck A's (`metadata.name`/`tags`/`createdWith`) — the Mixer names its own
 *    output, and `metadata.designResolution` and `metadata.version` stay inside the compared domain;
 * 2. a **value gate** may DROP a key whose value equals the identity the gate drops (`transMapDispersion: 0`);
 * 3. a key may be ADDED where writing it is provably inert — because it is on `UNCONDITIONAL_KEYS` *and*
 *    carries that key's engine default, or it equals `STATIC_FIELD_DEFAULTS`, or it is a block **nothing
 *    reads at that endpoint**, or it promotes a value the deck already resolved to.
 *
 * ⚠️ **(3) is where a false pass would live, so the inertness argument is about who READS the block, never
 * about the block's own values.** The one residual this file's first run caught was exactly a failure of that
 * distinction: `interpolateMaterial` adopted a one-sided material WHOLE at every `t`, so 122 of 274 pairs
 * carried a foreign material at an endpoint — and a live material **re-resolves the render mode** at
 * `resolveModeAgainstMaterial()`, while `renderMode` itself snaps at 0.5. The mode and the thing that
 * overrides the mode were flipping at two different `t`. Fixed in `interpolate.ts` the same day; the
 * reasoning, and why `interpolateLiquid`'s identical-looking branch was deliberately NOT changed, is written
 * out at that function. **Do not add a `material` exemption here to make this section green again.**
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
/** Load-bearing wherever a pattern is aimed at CODE: `deadcheck`'s rule. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

const RULES_SRC = 'src/exploration/overlay-rules.ts';
const INTERP_SRC = 'src/exploration/interpolate.ts';

/*
 * ⚠️ **PREFLIGHT, AND IT IS NOT CEREMONY.** `overlay-rules.ts` is imported below under Node, which strips
 * TYPES and does nothing else. A `class` whose constructor grows a parameter property, or an `enum`, throws
 * `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` **while `tsc --noEmit` stays green** — the `reel-model.ts` trap. Without
 * this block that failure arrives as an unreadable stack from inside Node's loader; with it, it arrives as a
 * sentence naming the construct. Comments and strings are stripped first: a checker whose corpus includes its
 * subject's prose reports the subject's DOCUMENTATION as a defect, and this very file's header says "class".
 */
const stripCommentsAndStrings = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  .replace(/`(?:\\.|[^`\\])*`/g, '``')
  .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
  .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
{
  const text = stripCommentsAndStrings(rd(RULES_SRC));
  const hostile = [
    [/\bclass\s+\w/, 'a `class` (its constructor may grow a parameter property, which Node cannot strip)'],
    [/^\s*enum\s|\bconst enum\b/m, 'an `enum` (Node cannot strip one — it has a runtime value)'],
    [/^\s*namespace\s/m, 'a `namespace`'],
    [/^\s*@\w+/m, 'a decorator'],
    [/^\s*import\s+(?!type\b)/m, 'a VALUE import (it must import nothing but types — see the file header)'],
  ].filter(([re]) => re.test(text)).map(([, why]) => why);
  if (hostile.length) {
    console.log(`\n  ${RULES_SRC} contains ${hostile.join(', ')}.`);
    console.log('  Node strips TYPES only. Rewrite as plain functions and plain data; this checker does not\n'
      + '  make that edit.\n');
    console.log('FAIL  mixercheck: 0 passed, 1 failed (subject unreachable)\n');
    process.exit(1);
  }
}

const {
  OVERLAY_RULES, CATEGORY_LOCKS, UNCONDITIONAL_KEYS, weightsFor,
} = await import('../src/exploration/overlay-rules.ts');
const { interpolatePreset } = await import('../src/exploration/interpolate.ts');
const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');
const { STATIC_FIELD_DEFAULTS } = await import('../src/post-processors/static-field.ts');
// v8 32 — rule (3b-ii)'s five per-layer block defaults, from the ONE module that declares them.
const { PARALLAX_DEFAULTS, VORTEX_DEFAULTS, TIME_WARP_DEFAULTS, REFRACTION_DEFAULTS, BAND_SPLIT_DEFAULTS }
  = await import('../src/post-processors/trans-map-chain.ts');
const { resolveModeAgainstMaterial } = await import('../src/generators/material-presets.ts');

let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };
const note = (m) => console.log(`  NOTE  ${m}`);
/**
 * ⚠️ **A SEEDED DEFECT MUST BE SHOWN TO FAIL** (`facetcheck`'s helper, same contract). `seed` runs one of this
 * file's OWN gates over a deliberately broken input and asserts the gate reports at least one violation.
 */
const seed = (n, violations, why) => {
  const ok = violations > 0;
  console.log(`  ${ok ? 'CALIB' : 'CALIBRATION FAIL'}  ${n} — seeded defect ${ok ? `caught (${violations} violation${violations === 1 ? '' : 's'})` : 'NOT CAUGHT'}${ok ? '' : '   ' + why}`);
  ok ? pass++ : fail++;
};

const clone = (v) => JSON.parse(JSON.stringify(v));

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== A. the basis — three counts, and NOT a reconciliation of them ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **"24 KEYS DESTROYED" AND "26 KEYS UNWRITTEN" WERE THE SAME HOLE ON TWO BASES** (two keys had no users
 * at all), and the standing rule is to re-run the census rather than reconcile the two figures. This section
 * therefore prints each count WITH the basis that produced it and compares the key sets as SETS. A sum is
 * never taken across them.
 *
 * **`public/psss_presets.json` is NOT plain JSON** — it opens `g_psss_presets={`, so the assignment prefix is
 * sliced off and the trailing `;` dropped. Read-only by project rule.
 */
const rawText = rd('public/psss_presets.json');
const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
const mgr = new PresetManager();
loadLibrary(mgr, rawLib);
const NAMES = mgr.list();
const N = NAMES.length;
/** Mutable deep clones — `PresetManager` deep-freezes and §F mutates fixtures. */
const LIB = new Map(NAMES.map((n) => [n, clone(mgr.get(n))]));

// Basis 1: the TYPE. A declaration grep over `OverlayState`'s own body, which is the list `tsc` holds
// `OVERLAY_RULES` to — so a disagreement here means the `satisfies` clause was weakened or removed.
const typesText = stripComments(rd('src/presets/types.ts'));
const osBody = typesText.slice(typesText.indexOf('export interface OverlayState {')).split(/\n\}/)[0];
const DECLARED = [...osBody.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
// Basis 2: the TABLE.
const RULED = Object.keys(OVERLAY_RULES);
// Basis 3: what a crossfade over the SHIPPED LIBRARY actually emits. ⚠️ A key no library preset carries is
// unreachable for §C and §D no matter how right its rule is; printing that set is the honest statement of
// what this file can and cannot see.
const AUTHORED = new Set();
for (const p of LIB.values()) for (const k of Object.keys(p.overlay ?? {})) AUTHORED.add(k);

console.log(`  library: ${N} presets (basis: public/psss_presets.json + the seven TS groups, via loadLibrary)`);
console.log(`  declared: ${DECLARED.length} keys (basis: a declaration grep over OverlayState's body)`);
console.log(`  ruled:    ${RULED.length} keys (basis: Object.keys(OVERLAY_RULES))`);
console.log(`  authored: ${AUTHORED.size} keys (basis: the union of overlay keys across the ${N} presets)`);

const missingRule = DECLARED.filter((k) => !RULED.includes(k));
const strayRule = RULED.filter((k) => !DECLARED.includes(k));
chk('every declared OverlayState key has a rule, and no rule names a key that does not exist',
  missingRule.length === 0 && strayRule.length === 0,
  missingRule.length || strayRule.length
    ? `no rule: [${missingRule.join(', ')}]  no declaration: [${strayRule.join(', ')}]`
    : 'reconciled as SETS, not as a difference of totals');

const unauthored = RULED.filter((k) => !AUTHORED.has(k));
console.log(`\n  ⚠️ ${unauthored.length} ruled key(s) are carried by NO shipped preset, so §C/§D cannot reach them:`);
console.log(`     ${unauthored.join(', ') || '(none)'}`);
note('a rule for an unauthored key is checked by §B alone — by NAME and by shape, never by measurement. '
  + 'That is the standing "enumerate the reachable-but-unused configurations" rule: these are the ones a '
  + 'user picks before anyone has measured them.');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== B. completeness and shape of the rule table ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
const interpText = rd(INTERP_SRC);
const interpCode = stripComments(interpText);

const byLaw = {};
for (const [k, r] of Object.entries(OVERLAY_RULES)) (byLaw[r.law.kind] ??= []).push(k);
console.log('  laws in force: ' + Object.entries(byLaw).map(([k, v]) => `${k} ${v.length}`).join(', '));

chk('every rule names a group that is in CATEGORY_LOCKS',
  Object.values(OVERLAY_RULES).every((r) => CATEGORY_LOCKS.includes(r.group)),
  `groups used: ${[...new Set(Object.values(OVERLAY_RULES).map((r) => r.group))].sort().join(', ')}`);

/*
 * ⚠️ **A BUNDLE IS OPERATIONALLY IDENTICAL TO A SNAP WHILE ITS MEMBERS SHARE A GROUP — AND THAT INVARIANT IS
 * THE WHOLE VALUE OF THE `id`.** Split a bundle's members across two groups and each resolves from its own
 * fader's winning side: `customFilmLookParams` from deck A under `filmLook`'s name from deck B, which is a
 * grade no deck authored and which looks like a palette bug. A one-member bundle is a `snap` misspelled.
 */
const bundles = {};
for (const [k, r] of Object.entries(OVERLAY_RULES)) if (r.law.kind === 'bundle') (bundles[r.law.id] ??= []).push(k);
for (const [id, members] of Object.entries(bundles)) {
  const groups = [...new Set(members.map((k) => OVERLAY_RULES[k].group))];
  chk(`bundle '${id}' has 2+ members, all in ONE group`,
    members.length >= 2 && groups.length === 1,
    `${members.length} member(s) [${members.join(', ')}] in group(s) [${groups.join(', ')}]`);
}

/*
 * The custom owners. `CustomMixerId` already makes "the owner exists" a compile fact in both directions —
 * `interpolate.ts` declares `Record<CustomMixerId, OverlayMixer>` — so what is left for a text scan is the
 * thing the type cannot see: that the dispatch is reached from the one loop, and that nothing re-introduced a
 * second construction site for `result.overlay`.
 */
const owners = [...new Set(Object.values(OVERLAY_RULES).filter((r) => r.law.kind === 'custom').map((r) => r.law.owner))];
const missingOwner = owners.filter((o) => !new RegExp(`(^|\\W)${o}\\s*[:(]`, 'm').test(interpCode));
chk(`all ${owners.length} custom owners are present in ${INTERP_SRC}`,
  missingOwner.length === 0, missingOwner.length ? `absent: ${missingOwner.join(', ')}` : owners.join(', '));
chk('CUSTOM_MIXERS is declared over CustomMixerId, so a renamed owner cannot compile',
  /const CUSTOM_MIXERS: Record<CustomMixerId, OverlayMixer>/.test(interpCode),
  'the Record is what makes the grep above redundant in the good case and legible in the bad one');

/*
 * ⚠️ **THE ARCHITECTURAL ASSERTION, AND THE REASON THIS FILE EXISTS.** `result.overlay` must be written at
 * exactly ONE place, from the rule table. Before 23.2 there were two object literals; a third would not fail
 * `tsc`, would not fail §C unless it happened to drop a key the library exercises, and would re-open the
 * whole defect class. A single assignment is the property; `buildOverlay` is its owner.
 */
const overlayAssignments = [...interpCode.matchAll(/result\.overlay\s*=/g)].length;
chk('result.overlay is assigned EXACTLY ONCE, from buildOverlay()',
  overlayAssignments === 1 && /result\.overlay = buildOverlay\(/.test(interpCode),
  `${overlayAssignments} assignment(s) — two literals were the 23.0 defect; a third site would re-open it`);
chk('buildOverlay iterates OVERLAY_RULES rather than a list of its own',
  /for \(const key of Object\.keys\(OVERLAY_RULES\)/.test(interpCode),
  'a hand-written key list inside the loop would be a second enumeration, which is the defect class itself');

/*
 * ⚠️ **`interpolatePreset`'s third parameter must stay a UNION named `mix`.** A bare `t: number` compiles
 * against every old call site and silently restores one global weight, which is precisely the state 23.5
 * widened away from — and the compiler can only find the un-migrated `inv * a.x + t * b.x` lines while the
 * union makes them type errors. A module-level `t`/`inv` in that file would re-open the hole invisibly.
 */
chk('interpolatePreset takes `mix: number | MixWeights`, not a bare t',
  /mix: number \| MixWeights,/.test(interpCode),
  'the union is what makes an un-migrated arithmetic use of the weight a COMPILE error');
chk('no module-level t/inv survives in interpolate.ts — every block derives its own pair',
  !/^const (t|inv) =/m.test(interpCode),
  'a file-scope weight would be in scope inside every block and would read as correct');

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== C. the ENDPOINT oracle — at t=0 the result IS deck A, at t=1 it IS deck B ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * The measurement the phase turns on. See this file's header for why each exemption below is a predicate over
 * the deck rather than a name on a list, and for the one real defect the first run caught.
 *
 * ⚠️ **NUMBERS ARE COMPARED WITH A RELATIVE TOLERANCE AND THE COUNT THAT NEEDED IT IS PRINTED.** `lerp` is
 * endpoint-exact (`1 * x + 0 * y === x`), `geometric` is not: `exp(ln v)` is not always `v`. A tolerance that
 * was widened until the section passed would be a licence — so the figure is reported every run, and a jump
 * in it is a finding even while the section is green.
 */
const IDENTITY_PATHS = ['metadata.name', 'metadata.createdWith', 'metadata.tags'];
const isIdentity = (k) => IDENTITY_PATHS.some((p) => k === p || k.startsWith(p + '.') || k.startsWith(p + '['));
chk('the identity exemption does NOT reach designResolution or version',
  !isIdentity('metadata.designResolution.width') && !isIdentity('metadata.version'),
  '23.4 snaps designResolution under `shape`, so it stays inside the compared domain');

/** The value a gate drops. A removal is admitted ONLY where the deck's own value equals this. */
const GATE_IDENTITIES = {
  'overlay.transMapDispersion': 0,
  'overlay.transMapForceGateAmount': 0,
  'overlay.transMapForceGateInvert': false,
  'overlay.symmetryFold': 1,
  'overlay.symmetryMirror': true,
};
/** `UNCONDITIONAL_KEYS`' leaves and the engine default each one carries. An addition is admitted only AT that value. */
const UNCONDITIONAL_LEAVES = {
  'overlay.particleSize': 1, 'overlay.figureScale': 1, 'overlay.speedFactor': 1,
  'overlay.curlNoise.enabled': false, 'overlay.curlNoise.turbulence': 0,
  'overlay.curlNoise.scale': 1, 'overlay.curlNoise.evolutionSpeed': 0.5,
  // v8 Phase 30. ⚠️ **ADMITTED AT 0, AND THE JUSTIFICATION IS STRONGER THAN THE FOUR ABOVE RATHER THAN
  // WEAKER.** Those are multipliers whose identity is 1, so a reader multiplies by them and the result is
  // unchanged. These three are GATED: the twist operator's first statement is
  // `if (twX !== 0 || twY !== 0 || twZ !== 0)`, so at 0 the code does not execute at all and the written
  // key cannot change a frame by one bit.
  // ⚠️ **It read FOUR until 2026-10-25: `overlay.curveBias` left with `E136`, which the owner dropped on
  // visual review. Re-count the entries rather than trusting a number in this comment.**
  // ⚠️ **The clause below holds this table to `UNCONDITIONAL_KEYS`, so these two lists cannot drift apart
  // — which is the one way an admitted leaf could stop being one the engine had declared inert.**
  'overlay.twistX': 0, 'overlay.twistY': 0, 'overlay.twistZ': 0,
  /*
   * v8 `32.1`/`32.2`. ⚠⚠ **ADMITTED AT 0 ON THE WEAKER CLAIM, AND THE DIFFERENCE FROM THE TWIST
   * ABOVE IS WORTH STATING BECAUSE THE SIX KEYS SHARE ONE GATE.** The operator's gate is the whole
   * six-tuple `if (tpX || tpY || tpZ || bdX || bdY || bdZ)`, so the strong claim — *the code does not
   * execute* — holds only when ALL SIX are 0. The reachable ADDED case is the other one: one key
   * non-zero on one deck, so the remaining five arrive as 0 with the stage RUNNING.
   *
   * ⚠ **So the justification is arithmetic inertness, per key, and it is exact rather than
   * approximate**: a taper factor is `1 + t·u`, which is exactly 1 at `t = 0`, and a bend factor is
   * `1 − k·u`, also exactly 1 at `k = 0`. Both enter `det J` and the position as MULTIPLIERS, so a
   * written 0 contributes the multiplicative identity on both paths. **That is the same standing as
   * `particleSize: 1` above, not the twist's.**
   */
  'overlay.taperX': 0, 'overlay.taperY': 0, 'overlay.taperZ': 0,
  'overlay.bendX': 0, 'overlay.bendY': 0, 'overlay.bendZ': 0,
  /*
   * v8 `32.7`. ⚠ **THE STRONG FORM, like `wScale`: `invertAmount` 0 is the stage's whole gate**, which
   * makes the radius inert at EVERY value rather than only at its default. Both are admitted at the
   * values below, and the two halves hold independently — the amount because the loop is skipped, the
   * radius because a skipped loop never reads it.
   */
  'overlay.invertAmount': 0, 'overlay.invertRadius': 1,
  // v8 31.2. ⚠️ **THE SAME STRONG FORM: the operator's gate is a three-way test against 0** — all three
  // amounts at 0 makes `writeChannels()` return `undefined`, so nothing is computed, nothing is published
  // and both render passes upload their neutral pad. A written 0 cannot change a frame by one bit, which
  // is a stronger claim than inertness under arithmetic.
  // ⚠️ **`overlay.channelDriver` is NOT here and must not be added: it SNAPS**, so a key neither deck
  // carries stays absent and no ADDED leaf for it is reachable. The clause below is what would catch an
  // entry here for a key the engine never declared inert.
  'overlay.channelSize': 0, 'overlay.channelAlpha': 0, 'overlay.channelLight': 0,
  // v8 31.4. ⚠️ **`wScale` 0 IS THE STAGE'S WHOLE GATE, which makes the three ANGLES inert at every value
  // and not only at 0** — a stronger claim than the four Phase 30 keys make. All four are admitted at 0:
  // the extent because the loop is skipped there, the angles because a rotation by zero turns is also the
  // identity matrix, so both halves hold independently.
  // ⚠️ **`overlay.octahedralFold` is NOT here and must not be: it SNAPS**, so no ADDED leaf is reachable.
  'overlay.wScale': 0, 'overlay.wXW': 0, 'overlay.wYW': 0, 'overlay.wZW': 0,
  /*
   * v8 `33.2`/`33.3`. ⚠️ **BOTH ADMITTED ON THE STRONG CLAIM, and for `travel` that is true only because
   * the generator was CHANGED to make it true.** `sharpness` 0 is a branch in the evaluation loop — the
   * triangle basis is never evaluated — so a written 0 cannot change a frame by one bit. `travel*` 0 is a
   * **per-axis** gate: the first draft gated only on the triple, which left `x += 0 * s` reachable with
   * the stage running, and `x + 0` is exactly `x` for every finite `x` **except `-0`**. Rather than argue
   * that a position sum can never be `-0` — a reachability claim no checker can settle — the three axis
   * tests were added so the claim is *the code does not execute*.
   *
   * ⚠️ **This is the FIFTH time this allowlist has grown and the fourth distinct justification**: the
   * twist is strong, the taper/bend six are arithmetic (`1 + t·u` is exactly 1 at 0), `wScale` is strong
   * and makes its three angles inert at EVERY value, and these four are strong per key. **Do not add an
   * entry by analogy — derive which of those four shapes it has, or the allowlist becomes a licence.**
   */
  'overlay.travelX': 0, 'overlay.travelY': 0, 'overlay.travelZ': 0,
  /*
   * v8 `34.2`/`34.3`/`34.4`. ⚠️⚠️ **TWENTY-SIX MORE, THE LARGEST GROWTH THIS TABLE HAS HAD, AND THEY WERE
   * ADMITTED BY THE RULE BEFORE THE RED RATHER THAN AFTER IT** — then the red arrived and reported exactly
   * these 26 paths at exactly 0, on 1256 comparisons each, which is the derivation being CONFIRMED rather
   * than discovered. (`overlay.sharpness` did NOT appear, which is the other half of the prediction: its
   * `custom` owner emits only the union of what the two decks carry, so no ADDED leaf is reachable for it.)
   *
   * **`offsetX/Y/Z`: the STRONG claim — *the code does not execute*.** `applyOffset` tests each axis
   * separately, exactly as `applyTravel` does and for the identical `-0` reason.
   *
   * **`growX/Y/Z`: the WEAKER, arithmetic claim.** The factor is `1 + 0·τ`, exactly 1, entering as a
   * MULTIPLIER, so `x * 1` preserves `-0` and the per-axis `if` is a COST gate. **That is `particleSize`'s
   * standing, not the twist's** — do not promote it, because an overstated admission licences the next key
   * that only looks similar. ⚠️ And note the value admitted is **0, not 1**: `grow` stores a ramp
   * COEFFICIENT, so 0 is its identity, which is the one thing about this operator that would be silent and
   * library-wide if a reader got it backwards.
   *
   * **The twenty depths and rates: the STRONG claim.** `resolveOp` returns the base UNCHANGED where
   * `depth === 0` — it does not compute `base + sin(x)·0` and then clamp — so nothing is evaluated at the
   * written identity. ⚠️ A rate is additionally read by nothing while its own depth is 0, which is
   * `invertRadius`'s standing arriving in a second subject.
   *
   * ⚠️ **This is the SIXTH time this allowlist has grown and no new justification SHAPE appears** — the
   * four already recorded above cover all 26. **Derive which of the four a candidate has; do not add by
   * analogy, or the allowlist becomes a licence.**
   */
  'overlay.offsetX': 0, 'overlay.offsetY': 0, 'overlay.offsetZ': 0,
  'overlay.offsetDepthX': 0, 'overlay.offsetDepthY': 0, 'overlay.offsetDepthZ': 0,
  'overlay.offsetRateX': 0, 'overlay.offsetRateY': 0, 'overlay.offsetRateZ': 0,
  'overlay.growX': 0, 'overlay.growY': 0, 'overlay.growZ': 0,
  'overlay.growDepthX': 0, 'overlay.growDepthY': 0, 'overlay.growDepthZ': 0,
  'overlay.growRateX': 0, 'overlay.growRateY': 0, 'overlay.growRateZ': 0,
  'overlay.travelDepthX': 0, 'overlay.travelDepthY': 0, 'overlay.travelDepthZ': 0,
  'overlay.travelRateX': 0, 'overlay.travelRateY': 0, 'overlay.travelRateZ': 0,
  'overlay.sharpnessDepth': 0, 'overlay.sharpnessRate': 0,
};
chk('every UNCONDITIONAL_LEAVES path belongs to a key on UNCONDITIONAL_KEYS',
  Object.keys(UNCONDITIONAL_LEAVES).every((p) => UNCONDITIONAL_KEYS.includes(p.split('.')[1])),
  `allowlist: ${UNCONDITIONAL_KEYS.join(', ')} — this file may not admit a leaf the engine has not declared inert`);

/** Blocks that reach their own inert state at the far endpoint, and the leaves that PROVE it per block. */
const RAMP_PROOF = {
  dye: { 'overlay.dye.enabled': false, 'overlay.dye.opacity': 0 },
  cohesion: { 'overlay.cohesion.strength': 0 },
  liquidField: { 'overlay.liquidField.enabled': false, 'overlay.liquidField.fieldCoupling': 0 },
};

const leaves = (v, pre = '', out = {}) => {
  if (v === null || typeof v !== 'object') { out[pre] = v; return out; }
  if (Array.isArray(v)) { v.forEach((x, i) => leaves(x, `${pre}[${i}]`, out)); return out; }
  for (const k of Object.keys(v)) leaves(v[k], pre ? `${pre}.${k}` : k, out);
  return out;
};
let tolUsed = 0;
const same = (x, y) => {
  if (typeof x === 'number' && typeof y === 'number') {
    if (x === y) return true;
    const d = Math.abs(x - y), s = Math.max(Math.abs(x), Math.abs(y));
    return d <= 1e-12 * (s || 1);
  }
  return x === y;
};
const resolvedMode = (p) => resolveModeAgainstMaterial(
  p.overlay?.renderMode ?? p.renderer.mode, p.overlay?.material ?? null);

/**
 * The gate itself, factored out so §H can run it over a broken input. Returns one entry per UNJUSTIFIED
 * difference between `want` (the deck) and `got` (the crossfade result at that deck's endpoint).
 */
function endpointViolations(want, got) {
  const W = leaves(want), G = leaves(got), out = [];
  const wantLiquidMode = resolvedMode(want) === 'liquid', gotLiquidMode = resolvedMode(got) === 'liquid';
  for (const k of Object.keys(W)) {
    if (isIdentity(k)) continue;
    if (!(k in G)) {
      if (k in GATE_IDENTITIES && same(W[k], GATE_IDENTITIES[k])) continue;  // (2) a gate dropped its identity
      out.push({ kind: 'REMOVED', k, was: W[k] });
    } else if (!same(W[k], G[k])) {
      out.push({ kind: 'CHANGED', k, was: W[k], now: G[k] });
    } else if (W[k] !== G[k]) tolUsed++;
  }
  for (const k of Object.keys(G)) {
    if (isIdentity(k) || k in W) continue;
    if (k in UNCONDITIONAL_LEAVES && same(G[k], UNCONDITIONAL_LEAVES[k])) continue;  // (3a) declared inert
    const sf = /^overlay\.transMapChain\[\d+\]\.staticField\.(\w+)$/.exec(k);
    if (sf && same(G[k], STATIC_FIELD_DEFAULTS[sf[1]])) continue;                    // (3b) == the documented default
    /*
     * (3b-ii) v8 `32` — **THE SAME RULE, GENERALISED TO THE OTHER FIVE PER-LAYER BLOCKS, and it was
     * exposed rather than caused by Phase 32.**
     *
     * ⚠⚠ **IT WENT RED ON `Parallax Depth Shell` x `There Will Be Light`, NEITHER OF WHICH IS A
     * PHASE 32 PRESET.** Adding three demos moved the library 292 -> 295, which shifted the two strides and
     * newly sampled that pair. **So this is a PRE-EXISTING behaviour reached by a new pairing, and reading
     * it as a Phase 32 defect would have been the wrong diagnosis** — the honest form is that an
     * allowlist tracking today's pairings goes red when the library grows, which is the same lesson
     * `UNCONDITIONAL_KEYS` records about admitting by the RULE and not by the observed path.
     *
     * **What the behaviour is:** `blendLayerBlocks` matches layers by STYLE and requires both decks to
     * carry the block, then writes every leaf through `mix(a, b, dflt)`. An OPTIONAL leaf that neither deck
     * authored therefore materialises at its own default. **Provably inert, and checked rather than
     * assumed:** `trans-map-chain.ts` resolves each one as `p?.leaf ?? DEFAULTS.leaf` at its single reader,
     * so a key written at exactly that default cannot change a frame by one bit.
     *
     * ⚠ **IT IS STILL AN EQUALITY TEST AGAINST THE DOCUMENTED DEFAULT, NOT A BLANKET PASS FOR THE
     * BLOCK.** A materialised leaf at any OTHER value is still a violation, which is what keeps this from
     * licensing the thing the section exists to catch.
     */
    const blk2 = /^overlay\.transMapChain\[\d+\]\.(parallax|vortex|timeWarp|refraction|bandSplit)\.(\w+)$/.exec(k);
    if (blk2 && same(G[k], CHAIN_BLOCK_DEFAULTS[blk2[1]]?.[blk2[2]])) continue;
    // (3c) the liquid SURFACE block is read only in the `liquid` render mode, which snaps in this same group.
    // ⚠️ Both sides are tested: a block that is dormant in the deck but LIVE in the result is a real defect.
    if (k.startsWith('overlay.liquid.') && !wantLiquidMode && !gotLiquidMode) continue;
    // (3d) a field block whose own activation was ramped to the inert value at this end.
    const blk = /^overlay\.(dye|cohesion|liquidField)\./.exec(k)?.[1];
    if (blk && Object.entries(RAMP_PROOF[blk]).every(([pk, pv]) => same(G[pk], pv))) continue;
    // (3e) the pass order PROMOTED into the overlay, equal to the order the deck already resolves to.
    if (k === 'overlay.transMapBeforeParticles'
      && same(G[k], want.overlay?.transMapBeforeParticles ?? want.postProcessors.transMap.beforeParticles)) continue;
    /*
     * (3f) v8 `34.4` — **a `Sharpness` LEVEL materialised at exactly the value the DECK'S OWN `?? sharpness`
     * backfill resolves to.**
     *
     * ⚠️⚠️ **THIS IS A RULE, NOT AN ALLOWLIST ENTRY, AND THE DIFFERENCE IS WHY IT IS HERE RATHER THAN IN
     * `UNCONDITIONAL_LEAVES`.** `34.D11` makes an absent level mean *follow Body*, so the inert value for a
     * materialised level is **the deck's own resolved level**, not a constant: deck A carrying
     * `sharpness: 1` and no levels resolves to (1, 1, 1), so a written `sharpnessStructure: 1` is exactly
     * what adoption would have produced. An allowlist admitting these three AT 0 would be wrong in both
     * directions — it would refuse that correct 1 and admit a 0 that is only correct when the deck means 0.
     *
     * ⚠️ **It was derived from a MEASURED red, and the prediction it replaced was wrong.** The design pass
     * reasoned that a `custom` owner emitting only the union of the decks' keys made an ADDED leaf
     * unreachable. It does not: `Interference × Quader Faceted` at `t = 0` emits `sharpness: 0` because deck
     * **B** carries the key and deck A does not — 22 comparisons, measured, and the same shape as the lerp
     * case the allowlist was built for. **`mixSharpnessLevels` is not what makes the leaf appear; carrying
     * the key on either side is.**
     *
     * ⚠️ **It is still an EQUALITY test against a resolved value, never a blanket pass for the three keys** —
     * a level written at any OTHER number is still a violation, which is what keeps this from licensing the
     * de-facetting defect `34.D14` exists to prevent (`mixercheck` §C is structurally blind to THAT, because
     * there the leaf is written on both sides and is neither added nor destroyed; `deformcheck` §N owns it).
     */
    const lvl = /^overlay\.(sharpness|sharpnessStructure|sharpnessDetail)$/.exec(k);
    if (lvl && same(G[k], want.overlay?.[lvl[1]] ?? want.overlay?.sharpness ?? 0)) continue;
    out.push({ kind: 'ADDED', k, now: G[k] });
  }
  return out;
}

/*
 * ⚠️ **TWO INDEPENDENT PAIRINGS, NOT ONE.** A single stride pairs each preset with exactly one partner, and a
 * rule that is wrong only for (say) a chain-carrying deck against a material-carrying one can miss every pair
 * a single stride happens to produce. Both strides are coprime with most library sizes, so each sweeps the
 * whole list; the pair COUNT is printed rather than carried.
 */
const STRIDES = [[7, 13], [31, 1]];
const PAIRS = [];
for (const [m, c] of STRIDES) {
  for (let i = 0; i < N; i++) {
    const A = NAMES[i], B = NAMES[(i * m + c) % N];
    if (A !== B) PAIRS.push([A, B]);
  }
}
/**
 * v8 `32` — the five per-layer block default tables, keyed by block name for rule (3b-ii).
 *
 * ⚠ **IMPORTED FROM THE ENGINE, NEVER RESTATED HERE.** A copy would be a second enumeration of one
 * list, and the failure it admits is the exact one the rule is supposed to refuse: a leaf materialised at a
 * value that used to be the default.
 */
const CHAIN_BLOCK_DEFAULTS = {
  parallax: PARALLAX_DEFAULTS,
  vortex: VORTEX_DEFAULTS,
  timeWarp: TIME_WARP_DEFAULTS,
  refraction: REFRACTION_DEFAULTS,
  bandSplit: BAND_SPLIT_DEFAULTS,
};

const vio = { REMOVED: new Map(), CHANGED: new Map(), ADDED: new Map() };
let worst = null;
for (const [an, bn] of PAIRS) {
  const A = LIB.get(an), B = LIB.get(bn);
  for (const [t, want] of [[0, A], [1, B]]) {
    const r = interpolatePreset(clone(A), clone(B), t, new Set());
    const vs = endpointViolations(want, r);
    if (vs.length && (!worst || vs.length > worst.n)) worst = { n: vs.length, an, bn, t, vs };
    for (const v of vs) {
      const m = vio[v.kind];
      if (!m.has(v.k)) m.set(v.k, { n: 0, ex: JSON.stringify(v) });
      m.get(v.k).n++;
    }
  }
}
const total = Object.values(vio).reduce((s, m) => s + [...m.values()].reduce((a, e) => a + e.n, 0), 0);
console.log(`  basis: ${PAIRS.length} pairs × 2 endpoints = ${PAIRS.length * 2} comparisons, `
  + `from ${STRIDES.length} independent strides over ${N} presets`);
console.log(`  float tolerance was needed on ${tolUsed} leaf comparisons (the geometric laws; `
  + 'a jump in this figure is a finding even while this section is green)');
for (const kind of ['REMOVED', 'CHANGED', 'ADDED']) {
  const m = vio[kind];
  chk(`at its own endpoint a crossfade result has NO unjustified ${kind} leaf`, m.size === 0,
    m.size === 0 ? `0 over ${PAIRS.length * 2} comparisons` : `${m.size} distinct path(s)`);
  for (const [k, e] of [...m.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 12))
    console.log(`          ${String(e.n).padStart(5)}×  ${k}   ${e.ex.slice(0, 120)}`);
}
if (worst) console.log(`  worst single comparison: ${worst.n} violation(s) — ${worst.an} × ${worst.bn} at t=${worst.t}`);
if (total === 0) {
  note(`0 unjustified differences over ${PAIRS.length * 2} comparisons. ⚠️ Read this as a claim about the `
    + 'ORACLE as much as the engine: it is only as strong as §H shows it to be, and only reaches the '
    + `${RULED.length - unauthored.length} keys some preset actually carries.`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== D. the snap boundary — every categorical key flips at t=0.5, and nowhere else ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * Invariant 16. §C pins the endpoints, which a rule that snapped at 0.001 would also satisfy; this section
 * pins WHERE. 0.49 and 0.51 rather than 0.4/0.6 because a near-miss boundary (`<=` for `<`, or a 0.5 written
 * as a different literal in one owner) is exactly the error an inset sample cannot see.
 *
 * ⚠️ **Only `snap` and `bundle` keys are asserted, and the value is compared against the WINNING DECK's own
 * value** — not against the other sample. Comparing 0.49 with 0.51 would pass for a key that is constant
 * across the pair, which is most keys on most pairs.
 */
const snapKeys = Object.keys(OVERLAY_RULES).filter((k) => ['snap', 'bundle'].includes(OVERLAY_RULES[k].law.kind));
function boundaryViolations(A, B, lo, hi) {
  const rl = interpolatePreset(clone(A), clone(B), lo, new Set());
  const rh = interpolatePreset(clone(A), clone(B), hi, new Set());
  const out = [];
  for (const k of snapKeys) {
    if (A.overlay?.[k] === undefined && B.overlay?.[k] === undefined) continue;
    const wantLo = A.overlay?.[k], wantHi = B.overlay?.[k];
    if (wantLo !== undefined && JSON.stringify(rl.overlay?.[k]) !== JSON.stringify(wantLo)) out.push(`${k}@${lo}`);
    if (wantHi !== undefined && JSON.stringify(rh.overlay?.[k]) !== JSON.stringify(wantHi)) out.push(`${k}@${hi}`);
  }
  return out;
}
const boundaryBad = new Map();
let boundaryPairs = 0;
for (const [an, bn] of PAIRS) {
  boundaryPairs++;
  for (const v of boundaryViolations(LIB.get(an), LIB.get(bn), 0.49, 0.51))
    boundaryBad.set(v, (boundaryBad.get(v) ?? 0) + 1);
}
console.log(`  basis: ${boundaryPairs} pairs × ${snapKeys.length} snap/bundle keys, sampled at 0.49 and 0.51`);
chk('every snap/bundle key resolves from deck A at 0.49 and deck B at 0.51',
  boundaryBad.size === 0,
  boundaryBad.size === 0 ? 'the boundary is at 0.5 in every owner' : [...boundaryBad.keys()].slice(0, 10).join(', '));

/*
 * ⚠️ **AND THE TWO VALUE-GATED PAIRS ARE NOT EXEMPT FROM THE BOUNDARY, ONLY FROM THE COMPARISON ABOVE.**
 * `mixSymmetry` and `mixTransMapChain` snap but may emit nothing, so a deck whose fold is 1 has no value to
 * find in the result. Asserted here against the gate's own condition instead of skipping them.
 */
{
  const withFold = NAMES.find((n) => (LIB.get(n).overlay?.symmetryFold ?? 1) > 1);
  const without = NAMES.find((n) => (LIB.get(n).overlay?.symmetryFold ?? 1) === 1);
  if (withFold && without) {
    const F = LIB.get(withFold), P = LIB.get(without);
    const at = (a, b, t) => interpolatePreset(clone(a), clone(b), t, new Set()).overlay?.symmetryFold;
    chk('a folded deck against an unfolded one hands the fold over exactly at 0.5, in both directions',
      at(F, P, 0.49) === F.overlay.symmetryFold && at(F, P, 0.51) === undefined
      && at(P, F, 0.49) === undefined && at(P, F, 0.51) === F.overlay.symmetryFold,
      `${withFold} (fold ${F.overlay.symmetryFold}) × ${without}`);
  } else note('no folded/unfolded pair in the library — the value-gated boundary is UNREACHED here.');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== E. twin pairs — an overlay key and its engine twin must share a GROUP ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THE DEFECT A FADER PER CATEGORY MAKES POSSIBLE AND ONE MASTER `t` COULD NOT.** Four overlay keys have a
 * `renderer`/`postProcessors` twin that `interpolatePreset` also resolves. Split a pair across two groups and
 * the two halves resolve from two different winning sides — and because **the overlay wins at every reader**
 * (invariant 17), the frame renders one deck's mode under the other deck's everything-else, with no symptom
 * in either half taken alone. Checked by NAME, against the engine-side block that resolves the twin.
 */
const TWINS = [
  ['renderMode', 'renderer.mode',
    /result\.renderer\.mode = t < 0\.5 \? a\.renderer\.mode : b\.renderer\.mode;/],
  ['transMapEnabled', 'postProcessors.transMap.enabled',
    /enabled: t < 0\.5 \? a\.postProcessors\.transMap\.enabled : b\.postProcessors\.transMap\.enabled,/],
  ['transMapStyle', 'postProcessors.transMap.style',
    /style: t < 0\.5 \? a\.postProcessors\.transMap\.style : b\.postProcessors\.transMap\.style,/],
  ['transMapBeforeParticles', 'postProcessors.transMap.beforeParticles',
    /beforeParticles: t < 0\.5 \? a\.postProcessors\.transMap\.beforeParticles : b\.postProcessors\.transMap\.beforeParticles,/],
  // The only one of the five written as a value gate rather than a plain field: an absent `ifsParams` must
  // stay absent, so the winner is picked first and the key spread in only if that winner has one.
  ['ifsParams', 'postProcessors.transMap.ifsParams',
    /\(t < 0\.5 \? a : b\)\.postProcessors\.transMap\.ifsParams/],
];
const GROUP_OF_ENGINE_BLOCK = { 'renderer.mode': 'visual', 'postProcessors.transMap.enabled': 'transmap',
  'postProcessors.transMap.style': 'transmap', 'postProcessors.transMap.beforeParticles': 'transmap',
  'postProcessors.transMap.ifsParams': 'transmap' };
function twinViolations(rules) {
  const out = [];
  for (const [ok, engine] of TWINS) {
    const g = rules[ok]?.group;
    if (g !== GROUP_OF_ENGINE_BLOCK[engine]) out.push(`${ok} is '${g}', its twin ${engine} resolves under '${GROUP_OF_ENGINE_BLOCK[engine]}'`);
  }
  return out;
}
const twinBad = twinViolations(OVERLAY_RULES);
chk(`all ${TWINS.length} twin pairs share a group with their engine-side half`,
  twinBad.length === 0, twinBad.join('; ') || TWINS.map(([a]) => a).join(', '));
for (const [ok, engine, re] of TWINS) {
  if (!re) { note(`${ok} ↔ ${engine}: the engine half is not a one-line snap, so only the GROUP is asserted.`); continue; }
  chk(`the engine half of ${ok} (${engine}) snaps at 0.5 in the ${GROUP_OF_ENGINE_BLOCK[engine]} block`,
    re.test(interpCode), 'a twin that stopped snapping would disagree with its overlay half at some t');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== F. the LOCKED branch — a lock holds its own group and NOTHING else ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THE FIXTURE IS WHERE THE FALSE PASSES LIVE, AND THIS SECTION IS THE CLEAREST CASE OF IT IN THE FILE.**
 * A lock test over a preset whose blocks are all absent reports PASS over a corpus that CANNOT FAIL: there is
 * nothing to hold, so holding nothing is correct. Every held fixture below is therefore chosen BY PREDICATE —
 * the block must be ON — and the section says which preset it found. If the library ever stops carrying one,
 * the line reads UNREACHED rather than PASS.
 *
 * Two properties, and the second is the one 23.2 added: a lock HOLDS every key in its group, and a lock does
 * **NOT** hold a key in any other group. Before 23.2 the `visual` lock froze the TransMap and attractor
 * overlay keys too (they sat inside its literal) and dropped `overlay.material` entirely (it sat in neither).
 */
/**
 * Both halves of the lock property, over an injectable `run` so §H can seed a lock that does nothing.
 *
 * `held` — the keys the result must reproduce from the snapshot; `free` — the keys that must be byte-identical
 * to the UNLOCKED crossfade. ⚠️ The second list is the one 23.2 added, and it is the half a lock test
 * normally forgets: before the rule table, locking `visual` also froze every TransMap and attractor overlay
 * key, because they sat inside the `visual` branch's literal.
 */
function lockViolations(group, heldPreset, A, B, t, run = undefined) {
  const r = (run ?? ((a, b) => interpolatePreset(clone(a), clone(b), t,
    new Set([group]), new Map([[group, clone(heldPreset)]]))))(A, B);
  const free = interpolatePreset(clone(A), clone(B), t, new Set());
  const held = [], frozen = [];
  for (const [k, rule] of Object.entries(OVERLAY_RULES)) {
    if (rule.group === group) {
      if (JSON.stringify(r.overlay?.[k]) !== JSON.stringify(heldPreset.overlay?.[k]))
        held.push(`${group} lock did not hold ${k}`);
    } else if (JSON.stringify(r.overlay?.[k]) !== JSON.stringify(free.overlay?.[k])) {
      frozen.push(`${group} lock also froze ${k} (group ${rule.group})`);
    }
  }
  return { held, frozen, all: [...held, ...frozen] };
}
/**
 * ⚠️ **"THE BLOCK IS ON" PREDICATES — THE FIXTURE RULE, SPELLED OUT.** Each must select a preset that has
 * something in the group to LOSE. A predicate that any preset satisfies would make the held half vacuous
 * again by a different route than a zero-key group does.
 */
/*
 * ⚠️ **RE-BASED 2026-10-06 FOR PHASE 24.1, AND THE CRASH WAS THE CHECKER'S OWN FIXTURE RULE EARNING ITS
 * KEEP.** `24.D3` added a seventh lock (`material`) and `CATEGORY_LOCKS` is what the loop below iterates, so
 * the missing entry was not a silent skip — `live[group]` was `undefined` and the section threw at the first
 * `material` iteration. That is the right failure: a group with no predicate cannot be tested, and a
 * `?.`-guarded lookup would have reported UNREACHED and read like a library gap instead of a missing fixture.
 *
 * ⚠️ **AND `visual` HAD TO BE RE-BASED, BECAUSE BOTH OF THE KEYS IT NAMED LEFT THE GROUP.** `24.1` moved
 * `material` to the new `material` group and `filmLook` to `color`, so the old predicate selected a preset
 * that was rich in two OTHER groups and said nothing about whether it had any `visual` state to lose. It
 * would not have crashed and it would not have failed — it would have gone on passing while testing the
 * wrong thing, which is why this table is written out by hand with a reason rather than derived.
 */
const live = {
  transmap: (p) => p.overlay?.transMapEnabled === true || p.overlay?.transMapChain !== undefined,
  // The two biggest `visual` subjects by authored count (181 curlNoise blocks, 245 renderModes of 274),
  // and both are keys the `visual` lock is supposed to hold — unlike the two this used to name.
  visual: (p) => p.overlay?.curlNoise !== undefined && p.overlay?.renderMode !== undefined,
  // ⚠️ The seventh group owns exactly ONE overlay key, so this predicate IS that key (84 presets of 274).
  material: (p) => p.overlay?.material !== undefined,
  attractor: (p) => p.overlay?.attractorBlend !== undefined,
  shape: (p) => p.overlay?.figureScale !== undefined,
  color: (p) => p.overlay?.palette !== undefined,
  motion: (p) => p.overlay?.speedFactor !== undefined,
};
const [PA, PB] = [LIB.get(NAMES[0]), LIB.get(NAMES[1])];
const keysInGroup = (g) => Object.keys(OVERLAY_RULES).filter((k) => OVERLAY_RULES[k].group === g);
console.log('  overlay keys per group: '
  + CATEGORY_LOCKS.map((g) => `${g} ${keysInGroup(g).length}`).join(', ') + '\n');
/*
 * ⚠️ **THE MEASUREMENT THAT PRINTS IS ITSELF A FINDING, AND WHAT IT FINDS CHANGED ON 2026-10-06 — READ THE
 * PRINTED LINE, DO NOT QUOTE THIS COMMENT.**
 *
 * The 2026-10-05 reading was "THREE OF THE SIX GROUPS OWN NO `overlay` KEY AT ALL": `shape`, `color` and
 * `motion` were groups of `generators`/`renderer` fields only, so the "holds every key" half had NOTHING to
 * assert for them and reported UNREACHED rather than PASS — a vacuous green being the exact false pass this
 * section's header warns about.
 *
 * ⚠️ **`24.1` MOVED NINE KEYS AND THAT STATEMENT IS NOW FALSE: every one of the SEVEN groups owns at least
 * one `overlay` key**, so the UNREACHED branch below is no longer taken by any shipped group. It is kept,
 * and so is the reasoning: a future group could own none, and the branch is also what stops a key moved
 * OUT of a group from reading as a pass. The faders of the three thin groups were never inert even when
 * they owned nothing — they move the non-`generators`/`renderer` blocks, each with its own locked branch in
 * `interpolatePreset`.
 */
for (const group of CATEGORY_LOCKS) {
  const pick = NAMES.find((n) => live[group](LIB.get(n)));
  if (!pick) {
    note(`${group}: no shipped preset satisfies the "block is ON" predicate — UNREACHED, not passing.`);
    continue;
  }
  const v = lockViolations(group, LIB.get(pick), PA, PB, 0.5);
  const owned = keysInGroup(group).length;
  if (owned === 0) {
    note(`${group}: owns 0 overlay keys, so the HELD half has nothing to assert — UNREACHED, not passing.`);
  } else {
    chk(`the ${group} lock holds all ${owned} of its overlay keys (held preset has the block ON)`,
      v.held.length === 0, v.held.slice(0, 6).join('; ') || `held: ${pick}`);
  }
  chk(`the ${group} lock freezes NOTHING outside its own group`,
    v.frozen.length === 0, v.frozen.slice(0, 6).join('; ')
      || `${RULED.length - owned} key(s) byte-identical to the unlocked crossfade`);
}
/*
 * ⚠️ **A LOCKED GROUP WITH NO SNAPSHOT MUST EMIT NOTHING FOR ITS KEYS** — the one piece of the old
 * `result.overlay = {}` that was kept deliberately. "Locked but never captured" is reachable: the Mixer
 * registers unconditionally while the Visual FX controls it reads the live overlay from are OPTIONAL.
 */
{
  const r = interpolatePreset(clone(PA), clone(PB), 0.5, new Set(['transmap']), new Map());
  const leaked = Object.keys(OVERLAY_RULES).filter((k) => OVERLAY_RULES[k].group === 'transmap' && r.overlay?.[k] !== undefined);
  chk('a locked group with NO captured snapshot emits none of its keys',
    leaked.length === 0, leaked.join(', ') || 'nothing leaks from the unlocked side into a held group');
}

/*
 * ⚠️⚠️ **A LOCK MUST HOLD ITS WHOLE CATEGORY, AND `shape` HELD ONLY HALF OF ITS OWN — SHIPPED, MEASURED,
 * FIXED 2026-11-04.** `shape` is resolved by TWO separate blocks in `interpolate.ts`: the first owns
 * `particleCount` / `waves` / the design box and has an `else` restoring the locked snapshot; the second
 * is `36.13`'s `generators.type` + `generators.lsystem` and had **no `else` at all**, so a locked `shape`
 * kept `deepCopy(a)`'s figure type and curve block instead of the snapshot's.
 *
 * ⚠️⚠️ **THE HALF IT DROPPED IS THE HALF THAT DECIDES WHICH KIND OF FIGURE YOU ARE LOOKING AT**, so the
 * failure reads as "the Mixer ignored my lock" on exactly the presets where a lock matters most. This is
 * `36.D1`'s cost for the fifth time: a non-`overlay` block gets no automatic law, and **being on the list
 * of hand-written sites is not the same as every branch in the listed file being on it** — this is a
 * second missed branch inside a file that had already been taught about the block once.
 *
 * ⚠️ The clause uses a THIRD preset as the snapshot, because a snapshot equal to deck A cannot tell a
 * held value from a defaulted one — the defect was invisible to any fixture where the lock was taken on
 * the deck it was being compared against.
 */
/** A short, comparable stand-in for a long value, so the report stays readable. */
const cut = (v) => {
  const s = JSON.stringify(v) ?? 'undefined';
  return s.length <= 44 ? s : `${s.slice(0, 40)}… (${s.length} chars)`;
};
for (const [what, read] of [
  ['particleCount', (p) => p.generators.particleCount],
  ['waves', (p) => JSON.stringify(p.generators.waves)],
  ['generators.type', (p) => p.generators.type],
  ['generators.lsystem', (p) => JSON.stringify(p.generators.lsystem ?? null)],
]) {
  const snapSrc = clone(PB);
  snapSrc.generators.type = 'lsystem';
  snapSrc.generators.lsystem = {
    rule: 'dragon',
    recursion: { base: 7, amplitude: 0, frequency: 0 },
    yaw: { base: 90, amplitude: 0, frequency: 0 },
    pitch: { base: 90, amplitude: 0, frequency: 0 },
    roll: { base: 90, amplitude: 0, frequency: 0 },
    descend: { base: 1, amplitude: 0, frequency: 0 },
    smoothness: 0.25,
    centre: [0, 0, 0],
  };
  snapSrc.generators.particleCount = 4321;
  const r = interpolatePreset(clone(PA), clone(PB), 1, new Set(['shape']),
    new Map([['shape', snapSrc]]));
  const got = read(r);
  chk(`a locked \`shape\` holds ${what} at the SNAPSHOT, not at deck A`,
    JSON.stringify(got) === JSON.stringify(read(snapSrc)),
    // The wave table is 2 kB of JSON, so the detail shows a FINGERPRINT rather than the value: the
    // clause compares in full and only the report is abbreviated.
    `got ${cut(got)}; snapshot ${cut(read(snapSrc))}; deck A ${cut(read(clone(PA)))} `
    + `— every weight is 1, so an unlocked blend would be deck B`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== G. the UI half (23.5) — the tab must read the shared array and send WEIGHTS ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **SOURCE-SHAPED, LIKE `composercheck`'s OWN SUCH SECTIONS: A FAILURE HERE MEANS THE NAMED OWNER WAS
 * BYPASSED OR RENAMED, NOT THAT THE ARITHMETIC IS WRONG.** Everything §B–§F measures lives under
 * `interpolate.ts`, and all of it stays green with the UI sending a single global weight — which is the state
 * 23.0 was measured in. The engine half and the UI half are two deliverables; this section is the only
 * instrument for the second.
 *
 * The three defects it exists for, each silent:
 *
 *  1. **A hand-written list of six categories in the tab.** Phase 24.D3 adds `'material'` to `CategoryLock`;
 *     `tsc` then forces a rule for it in `OVERLAY_RULES` and forces nothing at all in the UI, so the new
 *     category would crossfade with no fader and no lock. Reading `CATEGORY_LOCKS` makes the row appear.
 *  2. **The tab passing a bare number.** `interpolatePreset`'s third parameter is `number | MixWeights`
 *     precisely so an un-migrated weight is a compile error — but a *number* is a legal member of that union,
 *     so the one call site that matters compiles either way. Nothing but a text scan sees it.
 *  3. **`panel.ts` not passing the live-overlay reader.** The fourth constructor argument is OPTIONAL (the tab
 *     must register with `visualFxControls` absent), so omitting it is invisible to `tsc` and the symptom is
 *     only that a `visual` lock quietly discards the user's Visual FX edits — 23.D5's whole subject.
 */
const mixerText = stripComments(rd('src/ui/synthesis-lab/tabs/mixer.ts'));
const panelText = stripComments(rd('src/ui/synthesis-lab/panel.ts'));

/** One gate, factored out so §H can re-run it over a seeded source. */
function uiViolations(mix, pan) {
  const v = [];
  /*
   * ⚠⚠ **THE PATTERN TOLERATES A MULTI-SYMBOL, MULTI-LINE IMPORT, AND THAT IS A CORRECTION.** It was
   * `/import \{ CATEGORY_LOCKS \}/` — exact, single-line — and it went RED the moment the tab also
   * imported `CATEGORY_LABELS` and `FIGURE_CATEGORIES` beside it, over code that still reads the shared
   * owner. **A source-shaped clause must assert the OWNER is read, not the formatting of the line that
   * reads it**; this project's own rule is that most checkers are text greps and a behaviour-neutral
   * edit breaks them, so read the assertion before believing the failure.
   */
  if (!/import \{[\s\S]*?CATEGORY_LOCKS[\s\S]*?\} from '[^']*overlay-rules\.ts'/.test(mix)) {
    v.push('mixer.ts does not import CATEGORY_LOCKS from overlay-rules.ts');
  }
  if (!/const LOCKS: readonly CategoryLock\[\] = CATEGORY_LOCKS;/.test(mix))
    v.push('LOCKS is not an alias of the shared CATEGORY_LOCKS');
  if (/const LOCKS[^=]*=\s*\[/.test(mix)) v.push('LOCKS is a hand-written literal array (defect 1)');
  if (!/for \(const lock of LOCKS\)/.test(mix)) v.push('the category rows are not built by iterating LOCKS');
  if (!/private readWeights\(\): MixWeights \{/.test(mix))
    v.push('readWeights() is absent or no longer returns MixWeights');
  if (!/interpolatePreset\(\s*\n?\s*deckA, deckB, this\.readWeights\(\)/.test(mix))
    v.push('the blend call does not pass readWeights() (defect 2)');
  if (!/if \(!entry\.follow\) weights\[lock\] =/.test(mix))
    v.push('an independent category is not written into the weights, so its fader cannot reach the engine');
  if (!/follow: true,/.test(mix)) v.push('follow master does not default to TICKED (23.D4)');
  if (!/snap\.overlay = deepCopy\(live\)/.test(mix))
    v.push('captureLive() does not write the live overlay over the working preset (defect 3)');
  if (/lockWithSnapshot\([^)]*workingPreset/.test(mix))
    v.push('a lock captures state.workingPreset directly, bypassing captureLive() (23.D5)');
  if (!/new MixerTab\([^;]*getSnapshot\(\)/.test(pan))
    v.push('panel.ts does not hand MixerTab the live-overlay reader (defect 3)');
  return v;
}

{
  const v = uiViolations(mixerText, panelText);
  chk('the Mixer tab reads CATEGORY_LOCKS, sends a MixWeights, and locks off the LIVE overlay',
    v.length === 0, v.join(' | ') || '11 source-shaped clauses, each over a defect tsc cannot see');

  /*
   * ⚠️ **A `LOCKS` SCAN FOR QUOTED CATEGORY NAMES IS *NOT* WHAT THIS SECTION DOES, AND THE REASON IS WORTH
   * KEEPING.** The tab's own explanatory line names `shape`, `colour` and `motion` in prose, inside a string —
   * so a quoted-word scan cannot tell copy from code and would report the honest sentence as the defect. The
   * array's SHAPE is the checkable property; the words are not.
   */
  /*
   * ⚠ **The four 2026-11-04 keys are the source recipes and the per-row A/⇄/B selector.** They are listed
   * here for the same reason as the first four: `tipcheck` §H needs the WHOLE subscript to be a literal at
   * its own site, and a key read through a variable is invisible to it — which resolves to `undefined` and
   * sets `title = "undefined"`, a thing nothing else in the project can see.
   */
  const tipKeys = ['mixer.crossfader', 'mixer.categoryFader', 'mixer.followMaster', 'mixer.categoryLocks',
    'mixer.sourceFigure', 'mixer.sourceLook', 'mixer.rowSource', 'mixer.sourceLine', 'mixer.reset'];
  const unread = tipKeys.filter((k) => !mixerText.includes(`TAB_TIPS['${k}']!`));
  chk(`all ${tipKeys.length} Mixer tooltip keys are read with the whole-subscript shape tipcheck §H requires`,
    unread.length === 0, unread.join(', ') || tipKeys.join(', '));

  /*
   * ⚠️ **RE-BASED 2026-10-06 FOR PHASE 24.1 — THE FUNCTION WAS RENAMED BECAUSE ITS SUBJECT CHANGED.** It was
   * `createZeroKeyNote()`, and the name was accurate while three of the six groups owned no `overlay` key:
   * the note existed to say that `shape`, `colour` and `motion` moved only the `generators`/`renderer`
   * blocks. `24.1` moved nine keys, every one of the seven groups now owns at least one, and the note's job
   * became the opposite one — saying how LOPSIDED the split is, with `visual` as a 21-key catch-all. Hence
   * `createCategoryNote()`.
   *
   * ⚠️ **This clause reads the function NAME and the CSS class together, which is what made the rename
   * visible here at all** — a behaviour-neutral rename is the one change a text grep reports as a
   * regression, so the failure was a claim about the checker. The assertion still asserts only that the note
   * EXISTS, never its wording: the counts move with every group change and a clause over the sentence would
   * have to be re-based with each one.
   */
  chk('the tab states out loud that the `visual` fader is the catch-all',
    /createCategoryNote\(\)/.test(mixerText) && /sl-mix-note/.test(mixerText),
    'the seven groups split 2/5/1/14/2/1/21 — a user reading "colour" needs the lopsidedness said out loud');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== H. CALIBRATION — every gate above, re-run over a seeded defect ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **A MEASURING SECTION'S OWN BASIS HAS BEEN THE DEFECT REPEATEDLY, AND SEEDS DO NOT PROTECT THIS FILE'S
 * OWN FIGURES** — only its gates. Each seed re-runs one gate over an input broken the way the real defect
 * broke it, and a seed that PASSES is a CALIBRATION FAIL. The shapes seeded are the ones 23.0 measured — a
 * destroyed key, a key taken from the wrong side, a boundary that is not 0.5, a split twin, a lock that does
 * nothing and a lock that over-reaches — plus §G's own, which is a different KIND of seed: a source-shaped
 * gate can only be calibrated against a broken source, so seed 7 edits the text rather than the data.
 *
 * ⚠️ **COUNT THE `seed(` CALLS; THIS COMMENT NAMES THEM INSTEAD OF TOTALLING THEM** (it read "the four seeds"
 * while there were six, which is exactly the figure-in-a-comment trap the project rule is about).
 */
{
  // 1. §C over a result with one key deleted — the 23.0 defect itself, one key at a time.
  const A = LIB.get(NAMES[0]), B = LIB.get(NAMES[1]);
  const r = interpolatePreset(clone(A), clone(B), 0, new Set());
  const victim = Object.keys(r.overlay).find((k) => !(k in UNCONDITIONAL_LEAVES) && A.overlay?.[k] !== undefined
    && !(`overlay.${k}` in GATE_IDENTITIES));
  const broken = clone(r);
  delete broken.overlay[victim];
  seed(`§C sees a DESTROYED key (overlay.${victim} deleted from the t=0 result)`,
    endpointViolations(A, broken).length,
    'the endpoint oracle cannot see a dropped key — which is the entire defect it was written for');

  // 2. §C over a result whose value came from the WRONG side.
  const scalarKey = Object.keys(A.overlay ?? {}).find((k) => typeof A.overlay[k] === 'number'
    && typeof B.overlay?.[k] === 'number' && A.overlay[k] !== B.overlay[k]);
  if (scalarKey) {
    const swapped = clone(r);
    swapped.overlay[scalarKey] = B.overlay[scalarKey];
    seed(`§C sees a WRONG-SIDE value (overlay.${scalarKey} taken from deck B at t=0)`,
      endpointViolations(A, swapped).length, 'a CHANGED leaf is invisible to the oracle');
  } else note('§C wrong-side seed UNREACHED: no numeric overlay key differs between the first two presets.');

  // 3. §D over an off-centre boundary: sample 0.51 against deck A, which only a boundary at >0.51 satisfies.
  seed('§D sees a boundary that is NOT at 0.5 (0.51 compared against deck A)',
    boundaryViolations(A, B, 0.49, 0.51).length === 0
      ? boundaryViolations(A, B, 0.51, 0.51).length : 0,
    'the boundary gate passes wherever the flip happens, so it is pinning nothing');

  // 4. §E over a table with one twin moved out of its group.
  const splitTable = Object.fromEntries(Object.entries(OVERLAY_RULES)
    .map(([k, v]) => [k, k === 'transMapStyle' ? { ...v, group: 'visual' } : v]));
  seed('§E sees a SPLIT twin pair (transMapStyle moved to the visual group)',
    twinViolations(splitTable).length,
    'the twin gate cannot see a pair resolving from two different winning sides');

  /*
   * 5 and 6. §F, both halves, each seeded with the defect the OTHER half cannot see.
   *
   * ⚠️ **AN EARLIER VERSION OF SEED 5 DELETED A KEY FROM THE HELD SNAPSHOT AND WAS NOT CAUGHT — CORRECTLY.**
   * The gate compares the result against the snapshot, so a snapshot without the key and a result without the
   * key agree: holding "absent" IS holding. That seed was testing the engine's fidelity to a fixture rather
   * than the gate, which is the standing "an unreachable assertion is worse than a missing one" trap. The two
   * seeds below break the RUN instead — a lock that does nothing, and a lock that holds everything — which
   * are the two ways the branch has actually failed.
   */
  const tm = NAMES.find((n) => live.transmap(LIB.get(n)));
  if (tm) {
    const held = LIB.get(tm);
    // A lock that is IGNORED: run the unlocked crossfade and ask the gate whether the group was held.
    seed('§F(held) sees a lock that did NOTHING (the unlocked crossfade handed to the gate)',
      lockViolations('transmap', held, A, B, 0.5, (a, b) => interpolatePreset(clone(a), clone(b), 0.5, new Set())).held.length,
      'the held half is comparing the result against itself rather than against the snapshot');
    // A lock that OVER-REACHES: lock every group at once, which must leave the other groups' keys unequal to
    // the unlocked crossfade — the pre-23.2 `visual`-freezes-TransMap defect, generalised.
    const allLocked = (a, b) => interpolatePreset(clone(a), clone(b), 0.5,
      new Set(CATEGORY_LOCKS), new Map(CATEGORY_LOCKS.map((g) => [g, clone(held)])));
    seed('§F(frozen) sees a lock that over-reached into every other group',
      lockViolations('transmap', held, A, B, 0.5, allLocked).frozen.length,
      'the frozen half cannot see a lock holding keys that belong to another fader');
  } else note('§F seeds UNREACHED: no TransMap-live preset in the library.');

  /*
   * 7. §G over a source broken the two ways that matter. ⚠️ **A SOURCE-SHAPED GATE CALIBRATES AGAINST A
   * BROKEN SOURCE, NEVER AGAINST BROKEN DATA** — and both mutations below are things a reasonable edit does:
   * re-writing the six categories as a literal (what the tab held before 23.5) and dropping the fourth
   * constructor argument (which `tsc` accepts, because it is optional by necessity).
   */
  const reLocked = mixerText.replace(/const LOCKS: readonly CategoryLock\[\] = CATEGORY_LOCKS;/,
    "const LOCKS: readonly CategoryLock[] = ['shape', 'color', 'motion', 'transmap', 'attractor', 'visual'];");
  seed('§G sees the six categories hand-written back into the tab',
    uiViolations(reLocked, panelText).length,
    'the UI gate cannot see a second enumeration of CategoryLock, which is the defect class itself');
  const unwired = panelText.replace(/, vfx \? \(\) => vfx\.getSnapshot\(\) : undefined/, '');
  seed('§G sees panel.ts dropping the live-overlay argument (optional, so tsc stays green)',
    uiViolations(mixerText, unwired).length,
    'the UI gate cannot see an unwired 23.D5 reader, whose only symptom is a lock discarding Visual FX edits');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// ═══  THE MUTATION HALF — v8 PHASE 24.7  ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/**
 * ## §I–§N: the `mutate` column, which is the Randomiser's half of the same table
 *
 * ⚠️ **LETTERED §I–§N, WHILE `24.7`'s OWN TEXT CALLS THEM §A–§F. THE MAPPING IS: 24.7's §A = §I, §B = §J,
 * §C = §K, §D = §L, §E = §M, §F = §N.** This file already owns §A–§H and has done since 23.6; a second §A
 * would make every failure report ambiguous about which half of the Mixer/Randomiser pair it came from, and
 * the plan's letters were chosen before it was decided that one file holds both columns. The plan's letters
 * are the ones to quote when reading `24.7`; these are the ones a failure prints.
 *
 * ## Why these live in `mixercheck` and not in a `randomisecheck`
 *
 * `OVERLAY_RULES` has **two columns and two readers** (`24.D1`): `law` is how the Mixer blends a key, `mutate`
 * is how the Randomiser changes it. The defect Phase 24 measured was the *same* defect Phase 23 measured, seen
 * from the other tab — the Randomiser wrote **6.8 %** of the `overlay` block (5 of 44 authored keys, median 2
 * of a preset's 55 overlay leaf paths; measured 2026-10-02, N = 274, re-confirmed 2026-10-05) because it, too,
 * had a hand-written list of what it knew about. **One table, so one instrument**: a key added to the table
 * must be checked in both columns in one place, or the second column is where the next omission hides.
 *
 * ## What is NOT asserted here, and why
 *
 * ⚠️ **The DISTRIBUTION of what a press does is not a property.** §I checks that `STRATEGY_WEIGHTS` sums to 1
 * and has one entry per strategy, which is arithmetic; it does not check that jitter is 0.34, because that is
 * a judgement re-derived at `24.4` and a checker asserting it would be asserting a preference. What makes the
 * numbers reviewable is the derivation written at the constant.
 *
 * ⚠️ **"Does a press look good" is not reachable from here**, and the standing rule says so: *a checker cannot
 * hold a UI to its purpose, only a user can*. §M measures the two things a user cannot check by looking — that
 * a lock is honoured for every key in its group, and that every group is reachable at all. Defect 2 (the
 * `attractor` chip that gated an empty set) was invisible for exactly as long as nobody measured reachability.
 */

const RND_SRC = 'src/exploration/randomize.ts';
const rndText = stripComments(rd(RND_SRC));
const { randomizePreset } = await import('../src/exploration/randomize.ts');
const { computePresetStatistics } = await import('../src/exploration/preset-stats.ts');
const { FILM_LOOKS, CUSTOMIZE_FILM_LOOK } = await import('../src/renderers/film-looks.ts');
const { getAllPaletteNames } = await import('../src/presets/palettes.ts');
const { ATTRACTOR_PRESETS } = await import('../src/generators/attractors.ts');
const { MATERIAL_PRESETS } = await import('../src/generators/material-presets.ts');
const { TRANS_MAP_STYLES, chainFromOverlay } = await import('../src/post-processors/trans-map-chain.ts');

/** The Randomiser reads measured ranges; built over the same library §A loaded, so the basis is stated once. */
const STATS = computePresetStatistics([...LIB.values()]);

/*
 * ⚠️ **A SEEDED RNG, AND `Math.random` IS MONKEY-PATCHED TO IT FOR THE DURATION.** `randomize.ts` calls
 * `Math.random()` directly — deliberately, since threading a generator through nine strategies would be a
 * parameter on every signature for the benefit of this file alone, and *nothing may be added under `src/` for
 * the harness's benefit*. So the seam is taken here instead.
 *
 * ⚠️ **AND IT IS A SEED, NOT A CONVENIENCE: an unseeded measuring section discharges nothing.** A lock
 * violation that appears on one run in forty is a PASS most of the time, which is worse than no section at
 * all — it would be cited as evidence. With a fixed seed the same presses run every time, so a failure is
 * reproducible and a green run means this exact set of presses is clean. The price is that the section sees
 * only the presses the seed produces; §M answers that with volume (`PRESSES` per fixture per lock) and by
 * asserting REACHABILITY, which is what shows the presses are not all landing on the same strategy.
 *
 * mulberry32 — 32-bit, no dependencies, and uniform enough for a gate whose subject is "did this key change".
 */
/*
 * ⚠️⚠️ **THE WARM-UP IS LOAD-BEARING AND REMOVING IT SILENTLY DISARMS EVERY `pi * k + rep` LOOP IN THIS FILE.**
 * Measured 2026-10-29: mulberry32's **FIRST** output is strongly correlated across nearby seeds, because the
 * state is `seed + 0x6d2b79f5` and one mixing round does not avalanche a small seed delta. Eight consecutive
 * seeds (`0x25c0 + 159 * 131 + rep`, rep 0..7) give `0.0960 0.1554 0.2808 0.0334 0.0847 0.1119 0.1094 0.3857`
 * — **all eight below 0.5**, i.e. an identical `< 0.5` coin eight times. Draw #2 onward decorrelates normally
 * (`BAABBAAA`, `ABBBBABA`, …), so the defect is the FIRST draw and nothing else.
 *
 * ⚠️⚠️ **WHAT THAT COST: `crossoverPresets` draws the gene coins in order and `shape` is FIRST, so §O's
 * `REPS = 8` bought ZERO independence for the shape gene — eight reps were one draw repeated.** It went
 * unnoticed for four phases because every `shape` key was observable across MANY pairs, so the independence
 * came from pair diversity rather than from reps. **Phase 34's keys are authored by a handful of contiguous
 * `atEnd` demos, which land in ADJACENT pairs, so that diversity vanished and §O(a) collapsed to one coin
 * flip per key** — it reported 8 keys unreachable (`offsetX`, `travelY`, `travelDepth/RateY/Z`, `growX/Y`)
 * while the engine reaches parent B on those pairs **44.5 %** of the time under spread seeds. **The engine was
 * right and the instrument was wrong**, which is this file's own standing rule about a measuring section's
 * basis. **Discarding two draws fixes every call site at the owner rather than per loop.**
 */
function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next(); next();
  return next;
}
const REAL_RANDOM = Math.random;
/** Run `fn` with `Math.random` replaced by a fresh seeded stream. ⚠️ Restores in a `finally` (invariant 22). */
function seeded(seed, fn) {
  Math.random = makeRng(seed);
  try { return fn(); } finally { Math.random = REAL_RANDOM; }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== I. the `mutate` column — one law per key, and the arithmetic of the tiers ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * `tsc` already guarantees that every key HAS a `mutate` law (the `satisfies` clause §A reconciles). What it
 * cannot see is whether a law is well-formed: a `continuous` law with `min >= max` compiles, and a jitter
 * through it returns the value unchanged for every input — the inert mutation this phase exists to delete.
 */
{
  const KINDS = ['continuous', 'categorical', 'bundle', 'block', 'frozen'];
  const byKind = {};
  for (const k of KINDS) byKind[k] = [];
  const badKind = [], badLaw = [];
  for (const [key, rule] of Object.entries(OVERLAY_RULES)) {
    const m = rule.mutate;
    if (!m || !KINDS.includes(m.kind)) { badKind.push(`${key}: ${m?.kind}`); continue; }
    byKind[m.kind].push(key);
    if (m.kind === 'continuous') {
      if (!(m.max > m.min)) badLaw.push(`${key}: min ${m.min} >= max ${m.max} — every jitter through it is a no-op`);
      if (m.scale !== 'linear' && m.scale !== 'geometric') badLaw.push(`${key}: scale '${m.scale}'`);
      if (m.scale === 'geometric' && m.min <= 0) badLaw.push(`${key}: geometric with min ${m.min} — log(0) is -Infinity`);
      if (!m.unit || m.unit.length < 20) badLaw.push(`${key}: no unit stated (invariant 10 — tsc sees every bound as 'number')`);
    }
    if (m.kind === 'frozen' && (!m.why || m.why.length < 40)) {
      badLaw.push(`${key}: frozen with no reason — "we did not get to it" and "this must never move" are different facts`);
    }
    if ((m.kind === 'block' || m.kind === 'categorical') && !(m.owner ?? m.members)) badLaw.push(`${key}: no owner/members named`);
  }
  console.log('  mutate laws per kind: ' + KINDS.map((k) => `${k} ${byKind[k].length}`).join(', '));
  chk('every rule carries a well-formed mutate law', badKind.length === 0 && badLaw.length === 0,
    [...badKind, ...badLaw].slice(0, 6).join('; ')
      || `${RULED.length} keys, each with bounds/owner/reason as its kind requires`);

  /*
   * ⚠️ **AN EMPTY `continuous` SET WOULD BE A FAIL, NOT A VACUOUS PASS** — the same rule as `fieldcheck` §A's
   * named lists. Before 24.3 the Randomiser nudged NO `overlay` scalar at all, so a section that only checked
   * well-formedness would have been green over a table in which nothing continuous existed.
   */
  chk('...and the continuous set is NON-EMPTY, so §J and the log-space branch have a subject',
    byKind.continuous.length > 0, byKind.continuous.join(', '));

  // The tiers. Arithmetic, not preference: the weights are a distribution and must sum to 1.
  const weights = [...rndText.matchAll(/const STRATEGY_WEIGHTS = \[([^\]]+)\]/g)]
    .flatMap((m) => m[1].split(',').map((s) => parseFloat(s.trim())));
  const sum = weights.reduce((a, b) => a + b, 0);
  chk('STRATEGY_WEIGHTS is a distribution: seven members summing to 1.00',
    weights.length === 7 && Math.abs(sum - 1) < 1e-9,
    `${weights.length} members, sum ${sum.toFixed(4)} — [${weights.join(', ')}]`);
  /*
   * ⚠️ **THE RENORMALISATION IS THE PROPERTY, NOT ANY ONE WEIGHT'S VALUE.** `subtle` withholds the
   * categorical strategies, and the alternative implementation — re-draw when one comes up — gives each
   * surviving strategy a probability that depends on how many re-draws are allowed, which is a distribution
   * nobody wrote down. Asserted as source shape because the arithmetic is inside a private function.
   *
   * ⚠️ **RE-BASED 2026-10-06, AND THIS ONE IS A REAL PROPERTY CHANGE, NOT A CHECKER CLAIM.** The first
   * version pinned `const last = allowCategorical ? STRATEGY_WEIGHTS.length : LOOK_JUMP` — a CUTOFF, which
   * could only ever withhold a tail. §M then measured a `subtle` press changing the render mode, because the
   * style jump sits at index 2 and had become live when defect 1 was fixed. The mechanism is now a SET, so
   * the clause asserts a set and the cutoff's return would be a regression.
   */
  chk('...and `subtle` RENORMALISES over the surviving weights rather than re-drawing',
    /const open = \(i: number\) => allowCategorical \|\| !CATEGORICAL_STRATEGIES\.has\(i\);/.test(rndText)
    && /const r = Math\.random\(\) \* total;/.test(rndText),
    'a re-draw loop makes each surviving weight depend on the retry limit');
  /*
   * ⚠️ **AND THE SET IS NON-EMPTY AND HOLDS THE STYLE JUMP** — the member whose absence §M caught. A clause
   * over the mechanism alone would pass over `new Set()`, which is the pre-fix behaviour with new syntax.
   */
  chk('...and the withheld set is non-empty and contains the style jump (index 2), not just the look jump',
    /const CATEGORICAL_STRATEGIES: ReadonlySet<number> = new Set\(\[2, 6\]\);/.test(rndText),
    'index 2 writes overlay.renderMode, which is the loudest single change a press can make — at sigma 0.05 '
    + 'it is also the one a Subtle user would report as a bug');
  /*
   * ⚠️ **BOTH CLAUSES BELOW WERE RE-BASED 2026-10-06 FOR PHASE 25, AND THE TWO FAILURES WERE OF DIFFERENT
   * KINDS — which is why they are separated here rather than loosened together.**
   *
   *  - The FIRST was a claim about the CHECKER. It pinned `Record<Intensity, IntensityProfile>`; `25.D6` adds
   *    a fourth tier below `subtle`, so the table is keyed by `MutationTier` now. The asserted PROPERTY —
   *    one table of profiles, not parallel records — is untouched, and the clause was a text grep over the
   *    one thing that had to change.
   *  - The SECOND was a REAL PROPERTY CHANGE. "subtle is the ONLY tier that withholds a categorical jump" is
   *    now FALSE: `near` withholds too, and `25.D6` requires it to ("the new tier must never jump a
   *    categorical, or 'gentler than the children beside it' breaks visibly at Subtle"). So the property is
   *    re-stated rather than relaxed: the withholding set is EXACTLY {near, subtle}, and `subtle` is the only
   *    SELECTABLE member of it.
   *
   * ⚠️ **And both now PARSE THE ROWS instead of matching a fixed field order.** The old form broke on a new
   * column even where the column was none of its business — a four-column row cannot match
   * `{ sigma: N, categorical: false }` — which is the weakest kind of instrument: one that fails on edits it
   * does not assert anything about. The row bodies are extracted and read by field name.
   */
  const intensityBody = (rndText.split(/const INTENSITY: Record<[^>]+> = \{/)[1] ?? '').split(/\n\};/)[0];
  const tierRows = Object.fromEntries(
    [...intensityBody.matchAll(/(\w+):\s*\{([^}]*)\}/g)].map((m) => [m[1], m[2]]),
  );
  const tierFlag = (tier, field) => {
    const body = tierRows[tier];
    if (!body) return undefined;
    const m = body.match(new RegExp(`${field}:\\s*([\\w.]+)`));
    return m ? m[1] : undefined;
  };
  chk('...and every tier is ONE row of ONE table of profiles, not two parallel records',
    /const INTENSITY: Record<MutationTier, IntensityProfile> = \{/.test(rndText)
    && !/const SIGMA\b/.test(rndText)
    && Object.keys(tierRows).length >= 4,
    `one table, ${Object.keys(tierRows).length} rows: ${Object.keys(tierRows).join(', ')} — a second `
    + 'Record<…, boolean> beside the first is the two-enumerations defect in miniature');
  const withholding = Object.keys(tierRows).filter((t) => tierFlag(t, 'categorical') === 'false');
  chk('...and the tiers withholding a categorical jump are EXACTLY {near, subtle} (24.D5 + 25.D6)',
    withholding.length === 2 && withholding.includes('near') && withholding.includes('subtle')
    && tierFlag('medium', 'categorical') === 'true' && tierFlag('wild', 'categorical') === 'true',
    `withholding: [${withholding.join(', ')}] — \`subtle\` is the only SELECTABLE one, and the tab promises `
    + 'it in words ("Subtle NEVER swaps an identity"), so it is the one row a user can check; `near` is the '
    + 'unselectable carry tier and withholds for 25.D6\'s reason, not as a second promise');
  /*
   * ⚠️ **THE σ SCALE MUST STAY MONOTONIC ACROSS ALL FOUR TIERS**, which is the property `25.D6`'s "one tier
   * below the selector" rests on and the one a free literal could break silently: a `near` σ above
   * `subtle`'s would make a carried parent LOUDER than the children beside it, and nothing else in the tree
   * would say so. Measured off the rows, not asserted of the numbers.
   */
  const sigmas = ['near', 'subtle', 'medium', 'wild'].map((t) => Number(tierFlag(t, 'sigma')));
  chk('...and the four σ values ascend, so the carry is always gentler than the children beside it',
    sigmas.every((v) => Number.isFinite(v)) && sigmas.every((v, i) => i === 0 || v > sigmas[i - 1]),
    `σ: ${sigmas.join(' < ')}`);
  /*
   * `25.D8` / `25.D11`: the two Phase 25 columns. `medium`'s probability is pinned at exactly 0.60 because
   * that is what makes the default byte-comparable with the behaviour that shipped before Phase 25 — the
   * figure was a bare `Math.random() < 0.6` in `breedGeneration`, and a drift here is a silent change to
   * every existing user's default.
   */
  chk('...and the dominance lean exists, is 0.5 at Medium/Wild and leans at Subtle (25.D8)',
    Number(tierFlag('subtle', 'dominance')) > 0.5
    && Number(tierFlag('medium', 'dominance')) === 0.5
    && Number(tierFlag('wild', 'dominance')) === 0.5,
    `subtle ${tierFlag('subtle', 'dominance')} vs medium/wild ${tierFlag('medium', 'dominance')} — without `
    + 'the lean a Subtle child can arrive with a grade neither parent is known for');
  chk('...and Medium\'s mutation probability is EXACTLY 0.60, the pre-Phase-25 default (25.D11)',
    Number(tierFlag('medium', 'mutateProbability')) === 0.60
    && Number(tierFlag('subtle', 'mutateProbability')) < 0.60
    && Number(tierFlag('wild', 'mutateProbability')) > 0.60,
    `subtle ${tierFlag('subtle', 'mutateProbability')} / medium ${tierFlag('medium', 'mutateProbability')} / `
    + `wild ${tierFlag('wild', 'mutateProbability')}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== J. the continuous bounds ARE the engine\'s clamps (the import the table may not make) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THIS SECTION EXISTS BECAUSE `overlay-rules.ts` MAY IMPORT NO VALUES AND SO CANNOT SHARE THE CLAMPS.**
 * Its continuous bounds are written as LITERALS, and the reason is structural rather than stylistic: the track
 * constants live in `ui/synthesis-lab/tabs/visual-fx.ts`, which touches `document`, while this checker imports
 * the rule table under Node — so an import would make the table unloadable here and `reelcheck`'s
 * `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` lesson applies to the whole dependency, not just to syntax.
 *
 * ⚠️ **A LITERAL COPY OF A NUMBER WITH NO COMPILER BETWEEN THE TWO IS EXACTLY THE SHAPE THIS PROJECT KEEPS
 * BEING BITTEN BY** (the reel filename in `vite.config.ts` and `reel-store.ts`; `TEST_HOOK_KEYS`). So the gap
 * is closed by MEASUREMENT: the clamps are re-read from the files that own them, as text, and compared.
 *
 * ⚠️ **AND THE DIRECTION MATTERS — the bound must be the clamp, not merely inside it.** A table bound tighter
 * than the engine's clamp is not harmless: it makes a region of the slider unreachable by randomising, so a
 * user who drags `particleSize` to 4.0 and presses Subtle watches the value pulled back toward 3.x for no
 * stated reason. `24.D10` is explicit that the bounds are the ENGINE's, because that is what the user's
 * control can reach.
 */
{
  const vfxText = stripComments(rd('src/ui/synthesis-lab/tabs/visual-fx.ts'));
  const mainText = stripComments(rd('src/main.ts'));
  const num = (re, where, text) => {
    const m = re.exec(text);
    return m ? parseFloat(m[1]) : NaN;
  };
  /**
   * Each row: the table key, the two numbers read out of the OWNER's own file, and the owner's name for the
   * failure message. ⚠️ **Read as text from the owner, never re-typed here** — a third copy of a clamp inside
   * the checker would make a green run mean "three files agree with me", which is not the property.
   */
  const CLAMPS = [
    ['particleSize', 'visual-fx.ts PARTICLE_SIZE_MIN/MAX',
      num(/export const PARTICLE_SIZE_MIN = ([\d.]+);/, 0, vfxText),
      num(/export const PARTICLE_SIZE_MAX = ([\d.]+);/, 0, vfxText)],
    ['speedFactor', 'visual-fx.ts SPEED_MIN/MAX',
      num(/export const SPEED_MIN = ([\d.]+);/, 0, vfxText),
      num(/export const SPEED_MAX = ([\d.]+);/, 0, vfxText)],
    // ⚠️ `figureScale`'s clamp is not a named constant — it is inline in `main.ts`'s setter, which is itself
    // worth knowing: there is no symbol to import even if the table could import one.
    ['figureScale', 'main.ts\'s inline figureScale clamp',
      num(/figureScale = Math\.max\(([\d.]+), Math\.min\([\d.]+,/, 0, mainText),
      num(/figureScale = Math\.max\([\d.]+, Math\.min\(([\d.]+),/, 0, mainText)],
  ];
  const mismatched = [];
  for (const [key, owner, lo, hi] of CLAMPS) {
    const m = OVERLAY_RULES[key].mutate;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      mismatched.push(`${key}: could not READ the clamp from ${owner} — the pattern broke, not the code`);
    } else if (m.min !== lo || m.max !== hi) {
      mismatched.push(`${key}: table [${m.min}, ${m.max}] vs ${owner} [${lo}, ${hi}]`);
    }
  }
  chk('every continuous bound the engine clamps equals that clamp, read from the file that owns it',
    mismatched.length === 0, mismatched.join('; ')
      || CLAMPS.map(([k, , lo, hi]) => `${k} [${lo}, ${hi}]`).join(', '));
  /*
   * ⚠️ `attractorBlend` has no CONSTANT to compare against — 0..1 is the quantity's own definition (a
   * fraction), not a clamp anyone wrote. Stated rather than silently omitted: a row missing from the table
   * above with no reason is how the next clamp stops being checked.
   */
  const ab = OVERLAY_RULES.attractorBlend.mutate;
  chk('...and attractorBlend, whose 0..1 is the QUANTITY and not a clamp, is still 0..1',
    ab.min === 0 && ab.max === 1, `[${ab.min}, ${ab.max}] — a fraction of the attractor field`);
  /*
   * ⚠️ **THE SCALE IS A SEPARATE PROPERTY FROM THE BOUNDS, AND IT IS THE ONE A REVIEWER SKIPS.** The slider
   * tracks say which: `PARTICLE_SIZE_TRACK` is `log2`, `figureScale`'s is log base 5, and `SPEED_TRACK` is a
   * squared curve — not a log, so a linear jitter is the honest reading of "a fraction of the control" there.
   * A geometric law over a linear track (or the reverse) makes `sigma` mean a different fraction at each end
   * of the range, which is the `jitterStaticFields` drift defect generalised.
   */
  const scales = { particleSize: 'geometric', figureScale: 'geometric', speedFactor: 'linear', attractorBlend: 'linear' };
  const wrongScale = Object.entries(scales).filter(([k, s]) => OVERLAY_RULES[k].mutate.scale !== s);
  chk('...and each one\'s SCALE matches its slider track (log tracks jitter in log space)',
    wrongScale.length === 0,
    wrongScale.map(([k, s]) => `${k}: ${OVERLAY_RULES[k].mutate.scale}, track says ${s}`).join('; ')
      || Object.entries(scales).map(([k, s]) => `${k} ${s}`).join(', '));
  chk('...and `jitterRuled` HAS a log-space branch, so `geometric` is not a label over linear arithmetic',
    /if \(law\.scale === 'geometric'\) \{[\s\S]{0,400}?Math\.exp\(/.test(rndText)
    && /Math\.log\(Math\.max\(law\.min, value\)\)/.test(rndText),
    'the guard inside the log is load-bearing too: an imported 0 makes log(0) -Infinity and the clamp NaN');

  /*
   * v8 `34.5` — ⚠️⚠️ **THE SAME GAP, FOR NINETEEN MORE KEYS, AND IT HAD NEVER BEEN CLOSED FOR ANY FIGURE
   * OPERATOR.** The four rows above are the only bounds this section ever compared; `twist*`, `taper*`,
   * `bend*`, `invert*`, `channel*` and `w*` have carried literal bounds in the table since Phase 30 with
   * **nothing** holding them to the engine's clamps. Phase 34 adds nineteen more, each with a bound derived
   * in `core/deform-limits.ts`, so the table is now the larger half of an uncompared pair and the gap is
   * worth closing where the constants are NAMED.
   *
   * ⚠️ **Read as TEXT from the owner, never re-typed here** — a third copy inside the checker would make a
   * green run mean *three files agree with me*, which is this section's own opening rule.
   *
   * ⚠️ **The RATE rows are compared against `OP_RATE_MIN`/`OP_RATE_MAX` and NOT against 0**, and that is the
   * one place the table and the engine legitimately differ: the mix-law identity is 0 (a rate of 0 means
   * *never cycles*) while the MUTATE range is the band a nudge may move within, which must never produce 0
   * from a non-zero rate. **Two quantities, one key** — stated here because a reviewer comparing the rule row
   * to `OP_RATE_TRACK`'s sticky zero would otherwise read the difference as a defect.
   */
  const deformText = stripComments(rd('src/core/deform-limits.ts'));
  const dnum = (name) => {
    const m = new RegExp(`export const ${name} = (-?[\\d.]+);`).exec(deformText);
    return m ? parseFloat(m[1]) : NaN;
  };
  const SHARP = dnum('SHARPNESS_MAX'), TRAV = dnum('TRAVEL_MAX');
  const GFLOOR = dnum('GROW_FLOOR'), GMAX = dnum('GROW_MAX');
  const RMIN = dnum('OP_RATE_MIN'), RMAX = dnum('OP_RATE_MAX');
  const AX = ['X', 'Y', 'Z'];
  const DERIVED = [
    ['sharpnessStructure', 0, SHARP, 'SHARPNESS_MAX'],
    ['sharpnessDetail', 0, SHARP, 'SHARPNESS_MAX'],
    ['sharpnessDepth', -SHARP / 2, SHARP / 2, 'SHARPNESS_DEPTH_MAX = SHARPNESS_MAX / 2'],
    ['sharpnessRate', RMIN, RMAX, 'OP_RATE_MIN/MAX'],
    ...AX.map((a) => [`travelDepth${a}`, -TRAV, TRAV, 'TRAVEL_DEPTH_MAX = TRAVEL_MAX']),
    ...AX.map((a) => [`travelRate${a}`, RMIN, RMAX, 'OP_RATE_MIN/MAX']),
    ...AX.map((a) => [`grow${a}`, GFLOOR, GMAX, 'GROW_FLOOR/GROW_MAX']),
    ...AX.map((a) => [`growDepth${a}`, -(GMAX - GFLOOR) / 2, (GMAX - GFLOOR) / 2,
      'GROW_DEPTH_MAX = (GROW_MAX - GROW_FLOOR) / 2']),
    ...AX.map((a) => [`growRate${a}`, RMIN, RMAX, 'OP_RATE_MIN/MAX']),
  ];
  const readable = [SHARP, TRAV, GFLOOR, GMAX, RMIN, RMAX].every(Number.isFinite);
  const drifted = DERIVED.filter(([k, lo, hi]) => {
    const m = OVERLAY_RULES[k].mutate;
    return m.min !== lo || m.max !== hi;
  });
  chk(`every Phase 34 continuous bound is DERIVED from core/deform-limits.ts (${DERIVED.length} key(s))`,
    readable && drifted.length === 0,
    !readable
      ? 'could not READ one of SHARPNESS_MAX / TRAVEL_MAX / GROW_FLOOR / GROW_MAX / OP_RATE_MIN / OP_RATE_MAX '
        + 'from `core/deform-limits.ts` — the pattern broke, not the code'
      : drifted.length
        ? drifted.map(([k, lo, hi, src]) => `${k}: table [${OVERLAY_RULES[k].mutate.min}, `
          + `${OVERLAY_RULES[k].mutate.max}] vs ${src} [${lo}, ${hi}]`).join('; ')
        : `read SHARPNESS_MAX ${SHARP}, TRAVEL_MAX ${TRAV}, GROW_FLOOR ${GFLOOR}, GROW_MAX ${GMAX}, `
          + `OP_RATE_MIN ${RMIN}, OP_RATE_MAX ${RMAX}. ⚠ Each depth is its base range's HALF-WIDTH, which is `
          + 'the rule — widening a base range must move its depth with it, or 32.14\'s single-absolute-snap '
          + 'defect returns in a second column');
  /*
   * ⚠️ **`offset*` IS ABSENT FROM THE TABLE ABOVE BY CONSTRUCTION, NOT BY OMISSION, and that is worth a
   * clause of its own**: all nine are `frozen` (`34.D13`, the centring reason), so they carry no bounds for
   * this section to compare. A row missing with no reason is how the next clamp stops being checked.
   */
  const offsetFrozen = ['offsetX', 'offsetY', 'offsetZ', 'offsetDepthX', 'offsetDepthY', 'offsetDepthZ',
    'offsetRateX', 'offsetRateY', 'offsetRateZ'];
  chk('...and all nine `offset` keys are `frozen` with a non-empty reason, so they have no bound to compare',
    offsetFrozen.every((k) => OVERLAY_RULES[k].mutate.kind === 'frozen'
      && (OVERLAY_RULES[k].mutate.why ?? '').length > 40),
    `9 keys, every one frozen with the centring reason. ⚠ 34.D13: a random Offset breaks the centring every `
    + 'rotation is taken about, so the Randomiser would hand back figures spinning off-centre. The reason is '
    + 'in the COLUMN rather than being an absence, because a key missing for a reason nobody wrote down is '
    + 'indistinguishable from a key somebody forgot');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== K. the categorical MEMBERS are live enumerations, counted here and never quoted ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **A `categorical` LAW NAMES ITS MEMBER OWNER IN PROSE, WHICH NO COMPILER READS.** `members` is a string
 * — it has to be, since the owners live in five modules the table may not import — so this section imports
 * them and prints the counts. **The counts are printed, not asserted against a figure**: the standing rule is
 * that a figure is not an index entry, and a clause asserting "41 palettes" would fail the day a palette is
 * added, which is not a defect. What IS asserted is that each owner is non-empty and that the member the
 * Randomiser must NOT hand out is absent from the draw.
 */
{
  const owners = [
    ['filmLook', 'FILM_LOOKS', Object.keys(FILM_LOOKS).length],
    ['palette', 'getAllPaletteNames()', getAllPaletteNames().length],
    ['attractorIndex', 'ATTRACTOR_PRESETS', ATTRACTOR_PRESETS.length],
    ['material', 'MATERIAL_PRESETS', MATERIAL_PRESETS.length],
    ['transMapChain', 'TRANS_MAP_STYLES', TRANS_MAP_STYLES.length],
  ];
  console.log('  member owners: ' + owners.map(([, o, n]) => `${o} ${n}`).join(', '));
  chk('every categorical/bundle/block subject has a NON-EMPTY member owner',
    owners.every(([, , n]) => n > 0), owners.filter(([, , n]) => !n).map(([k]) => k).join(', ')
      || 'counted by import, printed rather than asserted against a figure');

  /*
   * ⚠️ **THE EXCLUSIONS ARE THE PART WITH TEETH, BECAUSE EACH ONE IS A FRAME THE RANDOMISER WOULD OTHERWISE
   * PRODUCE.** Three members of three owners must never be drawn, and all three fail SILENTLY:
   */
  chk('`Customize` is excluded from the grade draw (it names a bundle with no contents of its own)',
    /Object\.keys\(FILM_LOOKS\)/.test(rndText) && !rndText.includes(CUSTOMIZE_FILM_LOOK + "'"),
    `handing out '${CUSTOMIZE_FILM_LOOK}' names whatever customFilmLookParams held — the key the jump deletes`);
  chk('...and the grade jump DELETES customFilmLookParams and sliderBaseFilmLook (24.D13)',
    /delete ov\.customFilmLookParams;/.test(rndText) && /delete ov\.sliderBaseFilmLook;/.test(rndText),
    'both describe the look that WAS there; carrying either across publishes a grade nobody authored');
  chk('`index` is excluded from the palette-mapping draw (it resolves to PALETTE_MAPPING_OFF)',
    /const channels: PaletteMapping\[\] = \['depth', 'phase', 'velocity', 'position', 'age'\];/.test(rndText),
    'a draw including it would switch the palette OFF one time in six, reading as the Randomiser losing the '
    + 'palette it had just chosen');
  chk('...and `temperature` joins the draw ONLY with a live material (invariant 13)',
    /if \(material && material\.preset !== 'None'\) channels\.push\('temperature'\);/.test(rndText),
    'without one the channel is a constant and the palette collapses to a single colour');
  chk('`splat` is NOT in RANDOMISABLE_RENDER_MODES — the material owner is the only route to it',
    /export const RANDOMISABLE_RENDER_MODES: readonly RandomisableRenderMode\[\] = \['pixel', 'blend', 'star'\];/
      .test(rndText),
    'splat with no material draws NOTHING, so a mode drawn with no reference to the material is a black frame');
  /*
   * ⚠️ **AND THE THREE `requiresField` MODIFIERS, WHICH ARE THE SAME CLASS OF DEFECT IN THE WARP.** A chain
   * whose only field layer is replaced BY a modifier is inert (`isInertModifier`), so drawing one is a press
   * that reliably turns the warp off. The excluded set is derived from the style table, never listed here.
   */
  const modifiers = TRANS_MAP_STYLES.filter((m) => m.requiresField === true).map((m) => m.style);
  chk('...and the warp draw excludes the requiresField modifiers, derived from TRANS_MAP_STYLES',
    /const draw = TRANS_MAP_STYLES\.filter\(m => m\.requiresField !== true\);/.test(rndText) && modifiers.length > 0,
    `styles [${modifiers.join(', ')}] are modifiers; a chain whose only field layer becomes one renders unwarped`);
  chk('...and a re-styled layer is REPLACED via makeLayer, not re-pointed in place (24.D11)',
    /makeLayer\(pick\.style, slot\.layer\.weight > 0 \? slot\.layer\.weight : 1\.0\)/.test(rndText),
    'a TransMapLayer carries nine optional per-style blocks; re-pointing `style` leaves the old one\'s block '
    + 'on a layer that no longer reads it, which forces the chain out of legacy form on export');
  chk('...and the warp jump goes through the CHAIN, never overlay.transMapStyle',
    /transMapChain: chain, transMapEnabled: true/.test(rndText)
    && !/transMapStyle:/.test(rndText),
    'chainFromOverlay prefers the chain, so a transMapStyle write is masked on all 52 chain-carrying presets '
    + '— defect 1\'s shape exactly');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== L. the three measured defects stay fixed (source-shaped, each over a silent failure) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/**
 * ⚠️ **SOURCE-SHAPED BY NECESSITY, AND THE RULE FOR READING A FAILURE HERE IS THE PROJECT'S OWN:** in a
 * source-shaped clause a failure means *the named owner was bypassed or renamed*, not that arithmetic is
 * wrong. Each clause below is over a defect that produced a CORRECT-LOOKING frame, which is why none of them
 * can be measured from the result:
 *
 * 1. `preset.renderer.mode` — `main.ts` reads `overlay.renderMode ?? (isSamePreset ? currentRenderMode :
 *    (preset.renderer.mode ?? 'star'))`, and a randomised preset keeps its NAME, so `isSamePreset` is true
 *    and **both** branches ignore the field. The write was inert — and worse, the spurious value still
 *    differed from the live mode often enough to force a renderer dispose + re-init into the mode the engine
 *    was already in. ⚠️ **`main.ts`'s resolution is CORRECT and must not be touched.**
 * 2. `renderer.glow` in the style jump — on the three drawable modes `uGlow` comes from the film look and is
 *    re-handed at every apply, so the write could not reach the frame. It stays live in the JITTER, where
 *    ribbon and neon presets read it through `setGlow()`.
 * 3. the `attractor` chip — zero occurrences of `attractor` in this file before 24.5. A lock over an empty
 *    set reads exactly like a lock that works.
 */
{
  const v = [];
  if (/preset\.renderer\.mode\s*=/.test(rndText)) {
    v.push('defect 1 is back: a write to preset.renderer.mode, which main.ts ignores on BOTH branches');
  }
  // The mode must be written as the overlay key, through the one owner.
  if (!/ov\.renderMode = \(!material && resolved === 'splat'\) \? 'star' : resolved;/.test(rndText)) {
    v.push('the mode is no longer written as overlay.renderMode through writeMaterialAndMode');
  }
  if (!/const resolved = resolveModeAgainstMaterial\(requested, material\);/.test(rndText)) {
    v.push('the mode is no longer resolved against the material (invariant 17\'s one owner)');
  }
  /*
   * ⚠️ Counted, not merely detected: `renderer.glow` must be ASSIGNED exactly once — in the jitter. A second
   * assignment is the style jump's write coming back, and zero means the jitter lost a live mutation.
   *
   * ⚠️ **RE-BASED 2026-10-06, AND THE FIRST VERSION WAS THE CHECKER'S OWN ARITHMETIC BEING WRONG, NOT A
   * LOOSE PATTERN.** It counted occurrences of `preset.renderer.glow` and expected 1, but the single
   * surviving line is `preset.renderer.glow = jitter(preset.renderer.glow, …)` — a read AND a write, so a
   * correct file scored 2. A clause whose expected figure is derived by eye from a line nobody re-read is
   * precisely the defect *Verify* warns about, and it failed in the safe direction only by luck. The
   * property was always "one WRITER", so the pattern now pins the `=`.
   */
  const glowWrites = [...rndText.matchAll(/preset\.renderer\.glow\s*=/g)].length;
  if (glowWrites !== 1) {
    v.push(`defect 2: ${glowWrites} ASSIGNMENTS to preset.renderer.glow — expected exactly 1 (the jitter, live for ribbon/neon)`);
  }
  if (/applyStyleJump[\s\S]{0,600}?renderer\.glow/.test(rndText)) {
    v.push('defect 2 is back: the style jump writes renderer.glow, which the film look re-hands on every apply');
  }
  chk('defects 1 and 2 stay fixed: the mode goes through overlay + one owner, and glow has one writer',
    v.length === 0, v.join(' | ') || `overlay.renderMode via resolveModeAgainstMaterial; ${glowWrites} glow write (the jitter)`);

  const attractorRefs = [...rndText.matchAll(/attractor/gi)].length;
  chk('defect 3 stays fixed: the attractor chip gates a NON-EMPTY set',
    attractorRefs > 0 && /function applyAttractorJump/.test(rndText) && /locks\.has\('attractor'\)/.test(rndText),
    `${attractorRefs} references; before 24.5 this file contained ZERO and the chip gated nothing`);
  chk('...and the entry blend is the shared constant, not a literal (switching ON from -1 only)',
    /ov\.attractorBlend = ATTRACTOR_ENTRY_BLEND;/.test(rndText) && /if \(prev < 0\)/.test(rndText),
    'swapping one live attractor for another must leave the user\'s chosen strength alone');

  /*
   * ⚠️ **ONE WRITER FOR THE MATERIAL/MODE PAIR (24.D12), AND THE COUNT IS THE ASSERTION.** Two strategies
   * need the pair and every ordering of two independent writes has an arrangement that publishes a preset
   * rendering black. `splat` + no material draws NOTHING.
   */
  const matWrites = [...rndText.matchAll(/ov\.material = /g)].length + [...rndText.matchAll(/delete ov\.material;/g)].length;
  chk('the material and the mode are written by ONE owner (24.D12)',
    /function writeMaterialAndMode\(/.test(rndText) && matWrites === 2
    && [...rndText.matchAll(/writeMaterialAndMode\(/g)].length === 3,
    `${matWrites} writes inside writeMaterialAndMode (set + delete), called from the style jump and the material jump`);
  /*
   * ⚠️ **AND THE STYLE JUMP PASSES THE CONFIG, NOT THE NAME.** A name round trip through `getMaterialPreset`
   * replaces a hand-tuned `MaterialConfig` with the canonical one — found while writing §M, and it is the
   * `material` lock's failure mode on every preset whose material is not stock.
   */
  chk('...and the style jump passes the material THROUGH, never re-resolving it from its name',
    /writeMaterialAndMode\(preset, preset\.overlay\?\.material \?\? null, requested, locks\);/.test(rndText),
    'getMaterialPreset(name) on an authored config silently reverts every field the Materials tab edited');
  chk('...and `None` leaves the key ABSENT, which is how main.ts clears a material',
    /if \(material\) ov\.material = material; else delete ov\.material;/.test(rndText),
    'applyPresetChange reads `currentMaterial = ov.material ?? null` — a written `None` config would publish '
    + 'eleven fields describing nothing');

  // The frozen laws' second half: the gate's two categorical fields are never assigned (fieldcheck §K owns
  // the positive clause; this is the table's side of the same rule).
  chk('the force gate\'s categorical halves stay frozen, as their rules say',
    !/transMapForceGateBy:/.test(rndText) && !/transMapForceGateInvert:/.test(rndText)
    && OVERLAY_RULES.transMapForceGateBy.mutate.kind === 'frozen'
    && OVERLAY_RULES.transMapForceGateInvert.mutate.kind === 'frozen',
    'a roll onto age/temperature with no live material would silently turn a working gate OFF');
  chk('...and the two phase writers stay SEPARATE strategies (24.D7)',
    /function applyPhaseRotation/.test(rndText) && /ax\.phase = jitter\(ax\.phase, /.test(rndText),
    'the named angles are a re-pose of ONE axis; the jitter is a sub-degree drift on all nine. Merging them '
    + 'keeps the loud one');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== M. MEASURED: every lock is honoured, every group is REACHABLE, and Subtle never jumps ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **THIS IS THE SECTION THAT WOULD HAVE CAUGHT DEFECT 3, AND NOTHING ELSE IN THE PROJECT CAN.** A chip
 * whose category no strategy writes looks, behaves and tests exactly like a chip that works: the preset
 * changes on every press (other groups move), the locked group's keys are identical (nothing wrote them), and
 * every source-shaped clause passes. Only the REACHABILITY half below distinguishes "held because locked"
 * from "unchanged because unreachable", and it does so by running the same presses with the lock OFF.
 *
 * ⚠️ **TWO HALVES, AND NEITHER IS SUFFICIENT.** Held-only is vacuous for an unreachable group; reachable-only
 * says nothing about locks. Both are reported per group with their own counts, and the counts are NOT summed:
 * one is a violation count over keys, the other a count of keys ever touched.
 *
 * ⚠️ The groups are iterated from `CATEGORY_LOCKS` and their keys from the `group` column, so a key that
 * moves group moves which lock this section holds it to — which is what made `24.1`'s nine moves checkable
 * at all.
 */
{
  const PRESSES = 24;
  const TIERS = ['subtle', 'medium', 'wild'];
  /** Fixtures: the richest presets available, chosen by the §F liveness predicates so each group has something to lose. */
  const FIXTURES = [...new Set(CATEGORY_LOCKS.map((g) => NAMES.find((n) => live[g](LIB.get(n)))).filter(Boolean))];
  chk('the fixture set covers every group\'s liveness predicate', FIXTURES.length > 0, FIXTURES.join(', '));

  /**
   * One press, through the real entry point. ⚠️ **`randomizePreset` is called, never a strategy directly** —
   * the strategies are private and a section reaching past the entry point would stop testing the dispatch,
   * which is where `case 6` and the `subtle` withholding live.
   */
  const press = (p, tier, locks) => randomizePreset(p, tier, locks, STATS);

  /** The overlay keys a group owns, from the table — the one place scope is written. */
  const groupKeys = (g) => RULED.filter((k) => OVERLAY_RULES[k].group === g);

  /**
   * Both halves, over an injectable `run` so §N can seed a press that ignores its locks.
   *
   * `held` — with ONLY `group` locked, every overlay key in that group must come back byte-identical.
   * `touched` — with NOTHING locked, the set of that group's keys any press changed. Empty = unreachable.
   */
  function mutationViolations(group, run = press) {
    const held = [], touched = new Set();
    for (const name of FIXTURES) {
      const base = LIB.get(name);
      for (const tier of TIERS) {
        for (let i = 0; i < PRESSES; i++) {
          const locked = run(base, tier, new Set([group]));
          for (const k of groupKeys(group)) {
            if (JSON.stringify(locked.overlay?.[k]) !== JSON.stringify(base.overlay?.[k])) {
              held.push(`${group} locked, yet ${tier} press ${i} on ${name} changed ${k}`);
            }
          }
          const free = run(base, tier, new Set());
          for (const k of groupKeys(group)) {
            if (JSON.stringify(free.overlay?.[k]) !== JSON.stringify(base.overlay?.[k])) touched.add(k);
          }
        }
      }
    }
    return { held, touched };
  }

  for (const group of CATEGORY_LOCKS) {
    const owned = groupKeys(group);
    const { held, touched } = seeded(0x24000000 + group.length, () => mutationViolations(group));
    chk(`the ${group} lock holds all ${owned.length} of its overlay keys across ${FIXTURES.length * TIERS.length * PRESSES} presses`,
      held.length === 0, held.slice(0, 4).join('; ') || `${owned.length} key(s) byte-identical at every press`);
    /*
     * ⚠️ **A group whose keys NO press ever touches fails, and that is defect 3's instrument.** It is not a
     * "nothing to assert" note like §F's: §F could legitimately find a group owning no key, whereas here the
     * group owns keys and the Randomiser simply never writes them — a chip gating an empty set.
     */
    chk(`...and the ${group} group is REACHABLE: some press changes one of its keys`,
      touched.size > 0, touched.size === 0
        ? `NO press over ${FIXTURES.length * TIERS.length * PRESSES} changed any of [${owned.join(', ')}] — this `
          + `lock gates an empty set, which is defect 3 exactly`
        : `${touched.size}/${owned.length} key(s) reached: ${[...touched].slice(0, 8).join(', ')}`);
  }

  /*
   * ⚠️ **THE TIER PROMISE, MEASURED OVER THE IDENTITIES THEMSELVES AND NOT OVER THE STRATEGY INDEX.** The tab
   * says "Subtle NEVER swaps an identity"; a clause over `pickStrategy` would assert the implementation, so
   * this asserts the published preset instead — which is also what a user would check.
   *
   * ⚠️ The chain is compared by its STYLE SEQUENCE, not whole, and this is the clause's one stated exception:
   * `jitterStaticFields` legitimately nudges a separable layer's field at every tier, AND
   * `applyStaticFieldJump` — categorical by subject, since a `pattern` is a name — stays in `subtle`'s draw
   * because its liveness is not new and Phase 24 did not touch it. **So the narrowing is inherited from a
   * decision recorded at `CATEGORICAL_STRATEGIES` and repeated in the tier tooltip, not chosen here to make
   * the clause pass** — which is the distinction the tolerance rule turns on. What `subtle` must not do is
   * change which STYLES are in the chain.
   *
   * ⚠️ **AND THE SEQUENCE IS RESOLVED THROUGH `chainFromOverlay`, NOT READ OFF `overlay.transMapChain`.**
   * The first version read the key, and it reported a `subtle` violation on the first two fixtures: the chain
   * went from `[]` to `[1]`. That was the ORACLE being wrong, not the engine. On the 222 presets that carry
   * no `transMapChain` the warp lives in `postProcessors.transMap.style`, so `[]` does not mean "no styles" —
   * and `applyStaticFieldJump` materialises the chain by design (its own comment says reading the key
   * directly would make it inert on those 222). Both sides resolve to `[1]`, so **nothing about which styles
   * run changed; only the spelling did.** The cost of the spelling change is real but is a different
   * property — it forces the preset out of legacy-expressible form on export — and it is documented at the
   * strategy. ⚠️ **The general rule this instance teaches: an oracle over a key with a legacy fallback must
   * use the resolver the engine uses, or it reads a format migration as a behaviour change.**
   */
  const styleSeq = (p) => chainFromOverlay(
    p.overlay, p.postProcessors.transMap.style, p.postProcessors.transMap.ifsParams,
  ).map((l) => l.style);
  const identity = (p) => JSON.stringify([
    p.overlay?.filmLook ?? null,
    p.overlay?.palette ?? null,
    p.overlay?.paletteMapping ?? null,
    p.overlay?.material?.preset ?? null,
    p.overlay?.renderMode ?? null,
    p.overlay?.attractorIndex ?? null,
    styleSeq(p),
  ]);
  function tierViolations(tier, run = press) {
    const v = [];
    for (const name of FIXTURES) {
      const base = LIB.get(name);
      const before = identity(base);
      for (let i = 0; i < PRESSES * 8; i++) {
        if (identity(run(base, tier, new Set())) !== before) v.push(`${tier} press ${i} on ${name} swapped an identity`);
      }
    }
    return v;
  }
  const subtleV = seeded(0x24515542, () => tierViolations('subtle'));
  chk(`Subtle never swaps an identity across ${FIXTURES.length * PRESSES * 8} presses (24.D5, and the tab says so)`,
    subtleV.length === 0, subtleV.slice(0, 3).join('; ')
      || 'grade, palette, mapping, material, mode, attractor and the chain\'s style sequence all held');
  /*
   * ⚠️ **AND THE MIRROR, WHICH IS WHAT STOPS THE CLAUSE ABOVE BEING VACUOUS.** If no tier could swap an
   * identity the `subtle` clause would pass over a Randomiser with no categorical jump at all — the state
   * this phase found. So `medium` must be SEEN to swap one.
   */
  const mediumV = seeded(0x244d4544, () => tierViolations('medium'));
  chk('...while Medium IS seen to swap one, so the clause above is not vacuous',
    mediumV.length > 0, `${mediumV.length} of ${FIXTURES.length * PRESSES * 8} medium presses re-skinned an identity`);

  /*
   * ⚠️ **THE CONTINUOUS HALF: a nudged scalar must LAND INSIDE ITS LAW'S BOUNDS, and the geometric branch is
   * where that would fail.** `Math.exp` of a clamped log is inside by construction — unless the clamp and the
   * exponential are applied in the wrong order, which is invariant 10's class: `tsc` sees both as `number`.
   */
  const outOfBounds = seeded(0x2443424e, () => {
    const bad = [];
    for (const name of FIXTURES) {
      const base = LIB.get(name);
      for (const tier of TIERS) {
        for (let i = 0; i < PRESSES; i++) {
          const r = press(base, tier, new Set());
          for (const [k, rule] of Object.entries(OVERLAY_RULES)) {
            if (rule.mutate.kind !== 'continuous') continue;
            const v = r.overlay?.[k];
            if (v === undefined) continue;
            if (!Number.isFinite(v)) bad.push(`${k} = ${v} after a ${tier} press on ${name} (NaN reaches the GL uniform)`);
            else if (v < rule.mutate.min || v > rule.mutate.max) bad.push(`${k} = ${v}, outside [${rule.mutate.min}, ${rule.mutate.max}]`);
          }
        }
      }
    }
    return bad;
  });
  chk('every nudged continuous scalar lands finite and inside its own bounds',
    outOfBounds.length === 0, outOfBounds.slice(0, 4).join('; ')
      || 'checked after every press over all four continuous keys, both scales');

  // ═════════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n=== N. CALIBRATION — §M re-run over seeded defects (a seed that passes is a FAIL) ===\n');
  // ═════════════════════════════════════════════════════════════════════════════════════════════════
  /*
   * ⚠️ **THE SAME CONTRACT AS §H: a measuring section's own basis has been the defect repeatedly, and seeds
   * do not protect this file's own figures.** §M's two halves fail in opposite directions, so each needs its
   * own seed — and the seeds break the RUN rather than the data, because a `src/` mutation would be testing a
   * file that is not the one that ships.
   */
  const anyGroup = CATEGORY_LOCKS[0];
  // 1. A press that IGNORES its locks — the pre-24 `attractor`/`material` state, and the shape a new strategy
  //    introduces by forgetting one `locks.has()` line.
  seed('§M(held) sees a press that ignores its locks entirely',
    seeded(0x4e01, () => mutationViolations(anyGroup, (p, tier) => press(p, tier, new Set())).held.length),
    'the held half is comparing the result against a run that was never locked');
  // 2. A press that does NOTHING — defect 3 generalised to every group at once. The reachability half must
  //    report every group unreached; if it does not, "unchanged" and "unreachable" are indistinguishable here
  //    too and the section cannot see the defect it exists for.
  const inertUnreached = CATEGORY_LOCKS.filter((g) =>
    seeded(0x4e02, () => mutationViolations(g, (p) => clone(p)).touched.size) === 0);
  seed('§M(reachable) sees an INERT press — every one of the seven groups reported unreachable',
    inertUnreached.length === CATEGORY_LOCKS.length ? inertUnreached.length : 0,
    `only ${inertUnreached.length} of ${CATEGORY_LOCKS.length} groups were reported unreachable, so the half `
    + 'cannot distinguish "held" from "never written"');
  // 3. The tier gate, over a tier that IS allowed to jump. ⚠️ This is the one seed that could pass by luck if
  //    the press count were small — hence `PRESSES * 8` fixtures-wide, and the §M mirror clause measures the
  //    rate rather than trusting it.
  seed('§M(tier) sees `wild` handed to the Subtle gate',
    seeded(0x4e03, () => tierViolations('wild')).length,
    'the tier gate cannot see a categorical jump at all, so its green over `subtle` means nothing');
}


/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * §O / §P — v8 PHASE 25: CROSSOVER OVER THE OVERLAY (`25.7`, `25.D15`)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **THE THIRD SECTION SET IN THIS FILE, AND A THIRD READER OF ONE TABLE — NOT A THIRD CHECKER.** §A–§H
 * hold the Mixer's blend to its endpoints, §I–§N hold the Randomiser's mutation, and §O–§P hold Evolution's
 * crossover. The plan's own lettering for `25.7` could not be used for the same reason Phase 24's could not:
 * this file already owns the earlier letters.
 *
 * ⚠️ **IT MUST MEASURE, NEVER GREP, AND THE DEFECT IS WHY.** `crossoverPresets` *mentions* every block it
 * destroyed — the dead `bloom`/`toneMap` recombination, the inert `renderer.mode` coin, the one overlay key
 * it handled impeccably — so **a grep over that function would have passed every single day of the defect's
 * life.** The sections below import the shipped function and run it over real library pairs.
 *
 * ⚠️ **THE RNG IS INJECTED, NOT MONKEY-PATCHED** (`25.7`'s own requirement, and unlike §M's `Math.random`
 * swap). `crossoverPresets` and `breedGeneration` take an optional `rng`, appended to their options rather
 * than inserted into their signatures — so every assertion here is reproducible and a flake cannot be read
 * as a regression.
 *
 * ⚠️ **PROVENANCE IS CLASSIFIED PER LEAF INTO FOUR EXCLUSIVE CLASSES** — *identical / from A / from B /
 * blended* — because **where the parents agree, the child's value is evidence of nothing**, and a probe that
 * does not separate those cannot be believed in either direction. `25.0` learned that the expensive way.
 */
{
  console.log('\n=== O. crossover reach — the direct negation of 25.0\'s one-key figure ===\n');

  const { crossoverPresets, breedGeneration } = await import('../src/exploration/evolution-ops.ts');
  const J = (v) => JSON.stringify(v ?? null);
  const PAIRS = [];
  for (let i = 0; i + 1 < NAMES.length; i += 2) {
    PAIRS.push([LIB.get(NAMES[i]), LIB.get(NAMES[i + 1])]);
  }
  /** Reps per pair. Four was enough to reach 43 of 44 observable keys; eight removes the sampling miss. */
  const REPS = 8;

  /**
   * Every key the two parents actually DISAGREE about, over the whole pairing. This is the only honest
   * denominator for (a): a key no pair differs on is unreachable **by the library**, not by the code, and
   * asserting the table's full count would be asserting a property of `psss_presets.json`.
   */
  const observable = new Set();
  /*
   * ⚠️⚠️ **TWO-SIDED `lerp`/`geometric` KEYS ARE EXCLUDED FROM (a)'s DENOMINATOR, AND THE REASON IS THAT
   * `child === B` IS STRUCTURALLY IMPOSSIBLE FOR THEM — NOT THAT THEY ARE HARD TO REACH.** At `t = 0.5` a
   * key both parents carry resolves to the MIDPOINT, independent of the gene coin: measured 2026-10-29,
   * `offsetX` A=1.2 B=1 -> child=**1.1** on 512 of 512 spread seeds, and `figureScale` A=0.447 B=0.5005 ->
   * **0.4739**. ⚠️⚠️ **So (a)'s `cv === bv` test and (c)'s *"every `lerp` key lands strictly BETWEEN the
   * parents, never snapped to one"* CONTRADICT EACH OTHER on this class — both cannot hold, and (c) is the
   * one that is right.** B *does* contribute to such a key; it contributes half of it.
   *
   * ⚠️ **IT PASSED FOR FOUR PHASES BY ACCIDENT OF THE LIBRARY: every lerp key that was observable also
   * appeared in at least one pair where ONE SIDE WAS ABSENT**, which makes the resolution one-sided and
   * `cv === bv` meaningful again. **`offsetX` is the first key observable ONLY in a two-sided pair** — Phase
   * 34's keys are authored by a few contiguous `atEnd` demos, so a key can easily differ in exactly one pair.
   * **A key is therefore kept in `observable` if ANY disagreeing pair gives it a B-exact route** (snapped, or
   * one side absent); `blendOnly` collects the rest and is REPORTED rather than asserted, because asserting
   * it would be asserting a property of `psss_presets.json`.
   */
  const blendOnly = new Set();
  for (const [a, b] of PAIRS) {
    for (const key of RULED) {
      const av = J(a.overlay?.[key]), bv = J(b.overlay?.[key]);
      if (av === bv) continue;
      const kind = OVERLAY_RULES[key].law.kind;
      const blended = (kind === 'lerp' || kind === 'geometric')
        && a.overlay?.[key] !== undefined && b.overlay?.[key] !== undefined;
      if (blended) blendOnly.add(key); else observable.add(key);
    }
  }
  for (const k of observable) blendOnly.delete(k);

  const reachedFromB = new Set();
  const geneWins = {};
  for (const g of CATEGORY_LOCKS) geneWins[g] = { a: 0, b: 0 };
  let children = 0, childrenWithB = 0, lawViolations = [];
  const SNAPPED = new Set(RULED.filter((k) => OVERLAY_RULES[k].law.kind !== 'lerp'
    && OVERLAY_RULES[k].law.kind !== 'geometric'));

  for (let pi = 0; pi < PAIRS.length; pi++) {
    const [a, b] = PAIRS[pi];
    for (let rep = 0; rep < REPS; rep++) {
      const rng = makeRng(0x25c0 + pi * 131 + rep);
      const child = crossoverPresets(a, b, 0.5, { rng });
      children++;
      let sawB = false;
      for (const key of RULED) {
        const av = J(a.overlay?.[key]), bv = J(b.overlay?.[key]), cv = J(child.overlay?.[key]);
        if (av === bv) continue;
        const group = OVERLAY_RULES[key].group;
        if (cv === bv) { reachedFromB.add(key); sawB = true; geneWins[group].b++; }
        else if (cv === av) { geneWins[group].a++; }
        else if (SNAPPED.has(key)) {
          // (c), one direction: a snapped key holding a value NEITHER parent authored is a blend of a
          // categorical — the class that produces a grade or a style no author ever chose.
          if (lawViolations.length < 6) lawViolations.push(`${key} (${OVERLAY_RULES[key].law.kind}) -> ${cv}`);
        }
      }
      if (sawB) childrenWithB++;
    }
  }

  /*
   * (a) ⚠️ **THE FIGURE THAT SETTLES THE PHASE.** `25.0` measured this at **1** — `transMapChain`, the only
   * overlay key `crossoverPresets` mentioned — and that was not a sampling result but the code read back to
   * itself. The threshold is deliberately the OBSERVABLE set rather than a number: a hardcoded 43 would go
   * stale the day a preset is retuned, and the property is "every key a pair disagrees about can come from
   * either parent", not "forty-three".
   */
  chk('every overlay key the parents disagree about is reachable from parent B — not 1 of 46 (25.0)',
    reachedFromB.size === observable.size && observable.size > 1,
    `${reachedFromB.size} of ${observable.size} observable keys reached from B over ${children} children `
    + `(${RULED.length} ruled; unobservable in this pairing: `
    + `${RULED.filter((k) => !observable.has(k) && !blendOnly.has(k)).join(', ') || 'none'}; `
    + `blend-only, B contributes HALF and cannot be matched exactly: `
    + `${[...blendOnly].join(', ') || 'none'}). Pre-Phase-25 this was 1.`);
  chk('...and most children inherit SOMETHING from B — 25.0 measured 17.0 % of pairs',
    childrenWithB / children > 0.5,
    `${childrenWithB} of ${children} children (${(100 * childrenWithB / children).toFixed(1)} %)`);

  /*
   * (b) Every gene must be seen winning for BOTH parents. ⚠️ **A gene that never wins is a missing `group`**
   * — the key would still be crossed, just always from one side, which is exactly the shape of the defect
   * this phase removed and is invisible to `tsc`.
   */
  const silentGenes = CATEGORY_LOCKS.filter((g) => geneWins[g].a === 0 || geneWins[g].b === 0);
  chk('all seven genes are observed winning for BOTH parents (25.7b)',
    silentGenes.length === 0,
    silentGenes.length ? `never won both ways: ${silentGenes.join(', ')}`
      : CATEGORY_LOCKS.map((g) => `${g} ${geneWins[g].a}/${geneWins[g].b}`).join(' · '));

  /* (c) No snapped key may hold a value neither parent authored. */
  chk('no categorical/snapped key is ever BLENDED (25.7c)',
    lawViolations.length === 0,
    lawViolations.length ? lawViolations.join('; ')
      : `${SNAPPED.size} snapped keys checked over ${children} children`);

  /*
   * (c), the other direction — and it needs its own fixture rather than the library, because two presets
   * that happen to agree about a lerped scalar prove nothing. A lerped key must land BETWEEN the parents and
   * equal neither, which is what "snapped where the law says lerp" would break.
   */
  {
    const LERPED = RULED.filter((k) => OVERLAY_RULES[k].law.kind === 'lerp');
    const a = clone(LIB.get(NAMES[0])), b = clone(LIB.get(NAMES[1]));
    a.overlay = a.overlay ?? {}; b.overlay = b.overlay ?? {};
    for (const k of LERPED) { a.overlay[k] = 0.2; b.overlay[k] = 0.8; }
    const child = crossoverPresets(a, b, 0.5, { rng: makeRng(0x25c1) });
    const notLerped = LERPED.filter((k) => {
      const v = child.overlay?.[k];
      return typeof v !== 'number' || !(v > 0.2 && v < 0.8);
    });
    chk('every `lerp` key lands strictly BETWEEN the parents, never snapped to one (25.7c)',
      notLerped.length === 0,
      notLerped.length ? `snapped or absent: ${notLerped.join(', ')}`
        : `${LERPED.length} lerped keys, each 0.2/0.8 -> strictly interior at t=0.5`);
  }

  /*
   * (d) `P7`'s three invariant-17 pairs. ⚠️ **A rule that lives only in a comment is not closed**, and this
   * is the assertion that closes it: the overlay wins at every reader, so a pair resolving from two
   * different winners renders deck A's mode under deck B's everything-else with **no symptom in either half
   * on its own.** Measured as "the twin equals the same parent the overlay key came from".
   */
  {
    let pairViolations = [];
    for (let pi = 0; pi < PAIRS.length && pairViolations.length < 6; pi++) {
      const [a, b] = PAIRS[pi];
      if (J(a.overlay?.renderMode) === J(b.overlay?.renderMode)
        && J(a.renderer.mode) === J(b.renderer.mode)) continue;
      for (let rep = 0; rep < 4; rep++) {
        const child = crossoverPresets(a, b, 0.5, { rng: makeRng(0x25d0 + pi * 17 + rep) });
        // The twin must agree with whichever parent the child's own mode came from.
        const fromA = J(child.renderer.mode) === J(a.renderer.mode);
        const fromB = J(child.renderer.mode) === J(b.renderer.mode);
        if (!fromA && !fromB) pairViolations.push(`${a.metadata.name}+${b.metadata.name}: renderer.mode is neither parent's`);
        const ovFromA = J(child.overlay?.renderMode) === J(a.overlay?.renderMode);
        const ovFromB = J(child.overlay?.renderMode) === J(b.overlay?.renderMode);
        // Where the two parents differ on BOTH halves, the halves must come from the same side.
        if (J(a.overlay?.renderMode) !== J(b.overlay?.renderMode)
          && J(a.renderer.mode) !== J(b.renderer.mode)
          && ((ovFromA && !fromA) || (ovFromB && !fromB))) {
          pairViolations.push(`${a.metadata.name}+${b.metadata.name}: overlay.renderMode and renderer.mode split`);
        }
      }
    }
    chk('`overlay.renderMode` and its `renderer.mode` twin resolve from ONE gene winner (P7, 25.7d)',
      pairViolations.length === 0, pairViolations.join('; ') || 'checked over every pair the two differ on');
  }
  {
    // The TransMap pair: the block and the layer chain must follow one winner, or a child's chain describes
    // a block it did not come from — and the chain is authoritative, so b's contribution would be silently
    // discarded while LOOKING inherited. This is the pairing the pre-Phase-25 code commented and kept.
    let tmViolations = [];
    for (let pi = 0; pi < PAIRS.length && tmViolations.length < 6; pi++) {
      const [a, b] = PAIRS[pi];
      if (J(a.postProcessors.transMap) === J(b.postProcessors.transMap)) continue;
      if (J(a.overlay?.transMapChain) === J(b.overlay?.transMapChain)) continue;
      for (let rep = 0; rep < 4; rep++) {
        const child = crossoverPresets(a, b, 0.5, { rng: makeRng(0x25e0 + pi * 17 + rep) });
        const blockFromB = J(child.postProcessors.transMap) === J(b.postProcessors.transMap);
        const chainFromB = J(child.overlay?.transMapChain) === J(b.overlay?.transMapChain);
        if (blockFromB !== chainFromB) {
          tmViolations.push(`${a.metadata.name}+${b.metadata.name}: block from ${blockFromB ? 'B' : 'A'}, chain from ${chainFromB ? 'B' : 'A'}`);
        }
      }
    }
    chk('`postProcessors.transMap` and `overlay.transMapChain` resolve from ONE gene winner (P7, 25.7d)',
      tmViolations.length === 0, tmViolations.join('; ') || 'checked over every pair both halves differ on');
  }

  /*
   * (e) `25.D4` — a locked gene is byte-identical to the FIRST selected parent, across crossover AND
   * mutation. ⚠️ **This is the clause that would have caught the pre-Phase-25 state in one line**: the
   * Evolution panel rendered lock chips and `mutatePreset` passed `new Set()`, so every chip did nothing —
   * not "mostly nothing", nothing. **And it must measure both verbs**, because a lock that stopped mutation
   * while leaving inheritance free lets a locked group change anyway, which is invariant 13 exactly.
   */
  const lockViolations = (group, run) => {
    const out = [];
    const keys = RULED.filter((k) => OVERLAY_RULES[k].group === group);
    for (let pi = 0; pi < PAIRS.length && out.length < 6; pi += 7) {
      const [a, b] = PAIRS[pi];
      const child = run(a, b, new Set([group]), pi);
      for (const k of keys) {
        if (J(child.overlay?.[k]) !== J(a.overlay?.[k])) out.push(`${group}.${k} moved off the first parent`);
      }
    }
    return out;
  };
  for (const group of CATEGORY_LOCKS) {
    const v = lockViolations(group, (a, b, locks, pi) =>
      crossoverPresets(a, b, 0.5, { locks, dominant: a, rng: makeRng(0x2500 + pi) }));
    chk(`a locked \`${group}\` gene is byte-identical to the FIRST parent through crossover (25.D4)`,
      v.length === 0, v.join('; ') || `${RULED.filter((k) => OVERLAY_RULES[k].group === group).length} key(s) held`);
  }

  /*
   * (f) `breedGeneration` returns `count` presets with the carried parents FIRST and recognisable. ⚠️ `count`
   * keeps its meaning as the TOTAL number of slots (`P4`), so `parents + children === count` and nine stays
   * nine — a tenth tile is a rendering decision, not a layout one, because every animating tile shares one
   * small per-frame budget across four surfaces.
   */
  {
    const parents = [LIB.get(NAMES[0]), LIB.get(NAMES[3]), LIB.get(NAMES[6])];
    for (const n of [1, 3]) {
      const sel = parents.slice(0, n);
      const gen = breedGeneration(sel, 9, STATS, {
        intensity: 'medium', locks: new Set(), carryParents: true, rng: makeRng(0x25f0 + n),
      });
      chk(`breedGeneration returns exactly 9 with ${n} parent(s) carried into the first slot(s) (P4, 25.D5)`,
        gen.length === 9 && sel.every((p, i) => gen[i].metadata.name === p.metadata.name),
        `${gen.length} slots; first ${n} named [${gen.slice(0, n).map((p) => p.metadata.name).join(', ')}] `
        + `vs parents [${sel.map((p) => p.metadata.name).join(', ')}]`);
      // The "varied" half is measured as a RATE below, not asserted per run — see `carryRate`.
      chk(`...and the remaining ${9 - n} slots are renamed children, so a bred child is NEW to isSamePreset (25.D13)`,
        gen.slice(n).every((p) => /^Evo Gen \d+$/.test(p.metadata.name)),
        gen.slice(n).map((p) => p.metadata.name).join(', '));
    }

    /*
     * ⚠️ **"THE CARRY IS VARIED" IS A RATE, NOT A PER-RUN PROPERTY, AND ASSERTING IT PER RUN WAS THIS
     * SECTION'S OWN DEFECT ON ITS FIRST RUN (2026-10-06).** `randomizePreset` draws **one** strategy per
     * call, and several strategies are legitimately no-ops on a given preset — a wave swap on a preset whose
     * wave slots already agree changes nothing. So a carried parent CAN come back byte-identical, and a
     * clause demanding otherwise fails on correct code. **The engine was right and the test was wrong**,
     * which is the direction this project's rules say to suspect first.
     *
     * What `25.D5` actually guarantees is that the carry goes through the mutator, and what `25.D6`
     * guarantees is that it is mutated **one tier below** the children beside it. Both are statements about
     * a distribution, so both are measured over many seeds — and the second is the one worth having, because
     * it is the property a user can feel and the one a free literal σ could silently break.
     */
    const parent = LIB.get(NAMES[0]);
    let carryChanged = 0, carryDrift = 0, childDrift = 0, runs = 0;
    /**
     * Flatten to `path -> JSON leaf`, skipping `metadata` (the rename is not drift) so the two sides are
     * compared on the parameters alone.
     */
    const leaves = (v, prefix = '', out = {}) => {
      if (v === null || typeof v !== 'object') { out[prefix] = JSON.stringify(v ?? null); return out; }
      for (const [k, child] of Object.entries(v)) {
        if (prefix === '' && k === 'metadata') continue;
        leaves(child, prefix ? `${prefix}.${k}` : k, out);
      }
      return out;
    };
    /** The share of leaf paths that differ — a count, not a magnitude, so it cannot be skewed by one key. */
    const leafDiff = (x, y) => {
      const fa = leaves(x), fb = leaves(y);
      const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
      let moved = 0;
      for (const k of keys) if (fa[k] !== fb[k]) moved++;
      return keys.size === 0 ? 0 : moved / keys.size;
    };
    for (let s2 = 0; s2 < 40; s2++) {
      const gen = breedGeneration([parent, LIB.get(NAMES[3])], 9, STATS, {
        intensity: 'medium', locks: new Set(), carryParents: true, rng: makeRng(0x2600 + s2),
      });
      runs++;
      if (JSON.stringify(gen[0]) !== JSON.stringify(parent)) carryChanged++;
      carryDrift += leafDiff(gen[0], parent);
      childDrift += leafDiff(gen[8], parent);
    }
    chk('the carry goes through the mutator — most carried parents come back varied (25.D5)',
      carryChanged / runs > 0.5,
      `${carryChanged} of ${runs} runs varied the carried parent. ⚠️ NOT 100 %, and that is correct: one `
      + 'strategy is drawn per call and several are no-ops on a given preset');
    chk('...and the carry drifts LESS than the children beside it — one tier below (25.D6)',
      carryDrift / runs < childDrift / runs,
      `carry ${(100 * carryDrift / runs).toFixed(2)} % of leaves vs child `
      + `${(100 * childDrift / runs).toFixed(2)} % — if this ever inverts, a carried tile is LOUDER than the `
      + 'children and "your picks come back, lightly varied" is a lie the grid tells every press');
  }

  // ═════════════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n=== P. CALIBRATION — §O re-run over seeded defects (a seed that passes is a FAIL) ===\n');
  // ═════════════════════════════════════════════════════════════════════════════════════════════════
  /*
   * ⚠️ **A measuring section's own basis has been the defect repeatedly in this tree, and seeds do not
   * protect the checker's own figures.** Each seed below reproduces the PRE-PHASE-25 shape of one defect and
   * asserts the matching §O gate reports it.
   */

  // 1. The defect itself: `const result = deepCopy(a)` with no overlay traversal. If §O's (a) cannot see
  //    THIS, it cannot see anything — the child's overlay is parent A's entire overlay, byte for byte.
  {
    const preCross = (a, b) => { const r = clone(a); return r; };
    const reached = new Set();
    for (const [a, b] of PAIRS) {
      const child = preCross(a, b);
      for (const key of RULED) {
        const av = J(a.overlay?.[key]), bv = J(b.overlay?.[key]), cv = J(child.overlay?.[key]);
        if (av !== bv && cv === bv) reached.add(key);
      }
    }
    seed('§O(a) sees the pre-Phase-25 `deepCopy(a)` with no overlay traversal',
      observable.size - reached.size,
      'the gate cannot distinguish "inherited from B" from "parent A\'s value copied through"');
  }

  // 2. A missing `group`, i.e. a gene that never wins for one side. Simulated by forcing every gene to the
  //    dominant parent — which is also exactly what a fully-locked run looks like, so it proves the gate
  //    reads the gene census and not the key census.
  {
    const wins = {};
    for (const g of CATEGORY_LOCKS) wins[g] = { a: 0, b: 0 };
    for (let pi = 0; pi < PAIRS.length; pi++) {
      const [a, b] = PAIRS[pi];
      const child = crossoverPresets(a, b, 0.5, { locks: new Set(CATEGORY_LOCKS), dominant: a, rng: makeRng(pi) });
      for (const key of RULED) {
        const av = J(a.overlay?.[key]), bv = J(b.overlay?.[key]), cv = J(child.overlay?.[key]);
        if (av === bv) continue;
        if (cv === bv) wins[OVERLAY_RULES[key].group].b++; else if (cv === av) wins[OVERLAY_RULES[key].group].a++;
      }
    }
    seed('§O(b) sees a run in which no gene ever wins for parent B',
      CATEGORY_LOCKS.filter((g) => wins[g].a === 0 || wins[g].b === 0).length,
      'a gene that never wins is a missing `group`, and the census is the only thing that can say so');
  }

  // 3. A locked gene that is not held — the pre-Phase-25 `new Set()` at the call site, which is the literal
  //    one-line defect that made seven chips inert. ⚠️ The seed passes `locks` as EMPTY while the gate still
  //    asserts the group is held, which is the arrangement the panel actually shipped.
  {
    const v = [];
    for (const group of CATEGORY_LOCKS) {
      v.push(...lockViolations(group, (a, b, _locks, pi) =>
        crossoverPresets(a, b, 0.5, { locks: new Set(), dominant: a, rng: makeRng(0x2500 + pi) })));
    }
    seed('§O(e) sees the `new Set()` call site that made every lock chip inert',
      v.length, 'the lock gate would be green over a crossover that ignores locks entirely');
  }

  // 4. The invariant-17 split: the block from one coin and the chain from another, which is what the
  //    pre-Phase-25 code did with two independent `Math.random() < 0.5` draws.
  {
    const v = [];
    for (let pi = 0; pi < PAIRS.length && v.length < 6; pi++) {
      const [a, b] = PAIRS[pi];
      if (J(a.postProcessors.transMap) === J(b.postProcessors.transMap)) continue;
      if (J(a.overlay?.transMapChain) === J(b.overlay?.transMapChain)) continue;
      const rngA = makeRng(0x7001 + pi), rngB = makeRng(0x9002 + pi);
      const child = crossoverPresets(a, b, 0.5, { rng: rngA });
      // Re-split by hand: take the block from the OTHER side than the chain came from.
      const chainFromB = J(child.overlay?.transMapChain) === J(b.overlay?.transMapChain);
      child.postProcessors.transMap = clone((chainFromB ? a : b).postProcessors.transMap);
      const blockFromB = J(child.postProcessors.transMap) === J(b.postProcessors.transMap);
      if (blockFromB !== chainFromB) v.push(`${a.metadata.name}: split`);
      void rngB;
    }
    seed('§O(d) sees the TransMap block and its chain resolved from two independent coins',
      v.length, 'a child whose chain describes a block it did not come from renders plausibly either way');
  }
}

// ---------------------------------------------------------------------------------------------------
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  mixercheck: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
