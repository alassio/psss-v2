#!/usr/bin/env node
/**
 * coveragecheck — **a feature no preset activates is, from a user's chair, a feature that does not work.**
 *
 * v8 Phase 21.1. The 2026-09-17 coverage census found `pixel`, `log-density` (since RETIRED), `volume`,
 * TransMap style 8 and
 * the whole force gate at ZERO presets, plus two authored-but-inert keys (`21.2`). A one-off audit decays, so
 * the census is promoted here into a gate: it composes the library exactly as `main.ts` does, resolves each
 * feature the way `main.ts` resolves it AT LOAD, and asserts that the gaps the phase closes cannot silently
 * reopen.
 *
 * ## What it may and may not assert (`21.D7`, and these bounds are the owner's)
 *
 * - ✅ **floors** (`21.D5`: every field system and every TransMap style reaches ≥ 2 live presets), **enum-member
 *   coverage**, **boolean-leaf coverage**, and **zero inert authorings**.
 * - ✅ an explicit exempt list **with a reason string per entry**, so a declared zero and an undeclared one are
 *   different states.
 * - ❌ **never** richness (`21.D1` — the legacy tail is not retrofitted), never a palette / film-look /
 *   attractor-entry floor (the owner's *"a long list does no harm"*), and never that a demo is GOOD. Those are
 *   printed in §G as REPORT lines and gate nothing. A checker cannot hold a UI to its purpose, only a user can.
 *
 * ## The two declared lists, and why a COMMISSIONED entry that becomes covered is a FAILURE
 *
 * Owner decision, 2026-09-18: rather than let `verify` run red for the length of the phase, or let the floors
 * sit un-asserted (a report nobody reads is not a gate), every requirement carries one of three statuses:
 *
 *   - `GATED`       — the floor is asserted. Below it ⇒ FAIL.
 *   - `EXEMPT`      — a decision on record, with a reason that is not "it is hard". The reason string itself is
 *                     asserted, so an exemption cannot be smuggled in empty.
 *   - `COMMISSIONED` — a gap this phase is already committed to closing, naming its own step (`21.5b`, …).
 *
 * ⚠️ **A `COMMISSIONED` row whose feature is now covered FAILS**, with the message telling you to promote it to
 * `GATED`. That is the one clause that makes the list self-cleaning: a TODO that discharges itself silently is
 * how a phase ends with its own checker asserting nothing. Same direction as the `EXEMPT` rows, where becoming
 * covered prints a promotion NOTE (not a failure — `overlay.growth` is import-only, so a "covered" growth would
 * be a false positive rather than a discharge).
 *
 * ## The BASIS is part of what this checker asserts, and the basis has already been the defect once
 *
 * On 2026-09-18 the census's own basis — enum members, blocks and styles — was found unable to represent a
 * **boolean switch on a block that is already covered**, so `transMap.beforeParticles` sat at zero inside the
 * most-used block in the library and *the census reported nothing at all*. **A basis that cannot express a class
 * of gap declares that class covered by silence.** Three consequences are built into this file:
 *
 *   1. §E derives its boolean paths **by walking the migrated bodies**, never from a maintained list — a hand
 *      list is a third enumeration of a set that already exists twice, and the entry it omits is invisible
 *      exactly where it matters.
 *   2. §D reports every **unclaimed categorical path** it walks past, so a categorical field nobody thought to
 *      enumerate surfaces as a NOTE instead of as silence.
 *   3. §A reconciles the composed library **by NAME against a second, independent derivation** of the same set.
 *      *Seeds do not protect the checker's own figures* — a total agreeing with a total proves nothing.
 *
 * ## A temporary scaffold is not a coverage source (`21.6g`, and this rule has been TESTED)
 *
 * The 14 `" warpfirst"` review copies were deleted on 2026-09-18 by the owner's verdict, and the pass-order
 * census fell from 24 to 8 while the honest figure stayed 0 throughout. A checker that had counted them would
 * have reported the feature covered right up to that day and then gone quiet, because nothing asserts a floor it
 * believes is met. ⚠️ **The suffix exclusion is therefore NOT needed for that scaffold any more and must not be
 * deleted on that ground** — the rule is about the class, the next scaffold will have a different suffix, and
 * the clause is what keeps the count honest before anyone notices. Each suffix names its owning module so it
 * cannot outlive its scaffold silently.
 *
 * ## Everything in *Verify* applies, because this is a MEASURING checker
 *
 * Its rules are pure functions of a library object, which is what lets §H seed six defects into a **fixture
 * copy** and prove each rule fails — with no edit under `src/` (`deadcheck` counts `src` files, and nothing may
 * be added there for the harness's benefit). Read a failure as a claim about the checker until it is exonerated.
 *
 * ⚠️ **Activation is RESOLVED, never grepped.** Key presence is the wrong basis and would report every figure
 * larger: `renderMode` is overridden by a live material, a weightless modifier is inert with no field layer, and
 * `splat` with no material draws nothing. Three of those resolutions live in `main.ts`, which is browser-only and
 * cannot be imported here — so they are re-implemented in §B **and the source text of each owner is asserted to
 * still have the shape re-implemented**. A SOURCE-SHAPED failure in §B means the owner was renamed or bypassed;
 * a MEASURED failure elsewhere means the arithmetic is wrong.
 *
 * ⚠️ **Every status in the tables below was set from the counts MEASURED on 2026-09-18. A status is a claim, not
 * evidence** — re-run the checker rather than trusting a row.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

let pass = 0, fail = 0, notes = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };
/**
 * ⚠️ **A SEEDED DEFECT MUST BE SHOWN TO FAIL, or the property it calibrates is decorative.** A seed that passes
 * is a CALIBRATION FAIL and exits non-zero exactly like a real failure: the checker is then claiming it cannot
 * see the thing it was written to see.
 */
const seed = (n, violations, why) => {
  const ok = violations > 0;
  console.log(`  ${ok ? 'CALIB' : 'CALIBRATION FAIL'}  ${n} — seeded defect ${ok ? `caught (${violations} violations)` : 'NOT CAUGHT'}${ok ? '' : '   ' + why}`);
  ok ? pass++ : fail++;
};
const note = (s) => { console.log(`  NOTE  ${s}`); notes++; };

// ---------------------------------------------------------------------------------------------------
// COMPOSE THE LIBRARY — the same three lines `export-library.mjs` and `fieldcheck` §U use.
// ⚠️ `public/psss_presets.json` is NOT plain JSON: it opens `g_psss_presets={`, so `JSON.parse` throws
// until the assignment prefix is sliced off. It is also READ-ONLY by project rule.
// ---------------------------------------------------------------------------------------------------
const { PresetManager } = await import('../src/presets/manager.ts');
const { loadLibrary } = await import('../src/presets/library.ts');
const { REFINED_PRESETS, REFINED_SUFFIX } = await import('../src/presets/refined-presets.ts');
const { VARIANT_PRESETS } = await import('../src/presets/variant-presets.ts');
const { FIRE_PRESETS } = await import('../src/presets/fire-presets.ts');
const { FLOW_PRESETS } = await import('../src/presets/flow-presets.ts');
const { SHOWCASE_PRESETS } = await import('../src/presets/showcase-presets.ts');
const { CHAIN_PRESETS } = await import('../src/presets/chain-presets.ts');
const { DEMO_PRESETS } = await import('../src/presets/demo-presets.ts');
const {
  TRANS_MAP_STYLES, chainFromOverlay, isStyleActive, isInertModifier, buildChainPlan,
} = await import('../src/post-processors/trans-map-chain.ts');
const { getAllPaletteNames } = await import('../src/presets/palettes.ts');
/*
 * ⚠️ **IMPORTED, not re-implemented — invariant 17, and this file used to carry the chain by hand.** The
 * palette has two sources (`overlay.palette` and `customFilmLookParams.palette`) and `21.4a`'s rule is that
 * every reader resolves them in ONE order, owned by `resolvePaletteSelection`. Two of this file's readers — the
 * §G usage line and the `--audit` listing — each had their own `??` chain, and the audit's read only the
 * film-look half, so it printed no palette at all for the 114 bodies the `21.4d` migration adopted. Both now
 * call the resolver. ⚠️ **A report cannot fail, so a report that undercounts reads as a gap to go and fill** —
 * which is why a *reporting* reader is worth holding to the same rule as a rendering one.
 */
const { resolvePaletteSelection } = await import('../src/renderers/palette-selection.ts');
const { FILM_LOOKS } = await import('../src/renderers/film-looks.ts');
const { ATTRACTOR_PRESETS } = await import('../src/generators/attractors.ts');
/*
 * ⚠️ **v8 22.1 (2026-09-24) — NOW IMPORTED, AND §B BELOW IS ONE RE-IMPLEMENTATION LIGHTER.** The render-mode
 * resolver was private to `main.ts`, which this file cannot import, so §B carried a hand-written copy and said
 * so. Phase 22's facet predicate needed the same rule under Node, and hand-writing a THIRD copy of the one rule
 * whose single ownership invariant 17 exists to defend was the wrong trade — so `22.1` moved it, unchanged, into
 * `generators/material-presets.ts` (pure, already imported by `main.ts`, no cycle).
 *
 * ⚠️ **Read this as the checker's basis getting BETTER, not as a figure moving — and that was MEASURED, not
 * argued.** This file's entire stdout was captured with the copy in place and again with the import, over the
 * whole composed library, and the two are **byte-identical**; the function was separately exercised over all ten
 * boundary cases (no material / `'None'` / a splat-requesting material / `Liquid` / `liquid` requested with and
 * without a material, both directions). So the copy had NOT drifted, and no figure below moved. If one ever does
 * move on a day this import changed, the copy had drifted and the engine was always right — which is the whole
 * reason to stop keeping copies.
 */
const { resolveModeAgainstMaterial } = await import('../src/generators/material-presets.ts');

const rawText = rd('public/psss_presets.json');
const rawLib = JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''));
const mgr = new PresetManager();
const orphans = loadLibrary(mgr, rawLib);
const NAMES = mgr.list();
/** Mutable deep clones — `PresetManager` deep-freezes, and §H needs to mutate a fixture. */
const LIB = new Map(NAMES.map((n) => [n, JSON.parse(JSON.stringify(mgr.get(n)))]));

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== A. the basis: the composed library, reconciled BY NAME against a second derivation ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **A TOTAL AGREEING WITH A TOTAL PROVES NOTHING.** The second derivation below is the arithmetic over the
 * SOURCE groups — legacy keys, the ` new` pending keys, the variants, the five TS groups — and it is compared as
 * a SET, so a settle that replaced a legacy key in place and a variant that fell to the orphan sweep are both
 * visible as names rather than cancelling in a sum. The union is DEDUPED because a settled entry keyed by the
 * ORIGINAL name replaces that key rather than adding one, which is exactly the arithmetic a sum gets wrong.
 */
const expectedNames = new Set(Object.keys(rawLib));
for (const k of Object.keys(REFINED_PRESETS)) expectedNames.add(k);
for (const v of VARIANT_PRESETS) expectedNames.add(v.name);
for (const g of [FIRE_PRESETS, FLOW_PRESETS, SHOWCASE_PRESETS, CHAIN_PRESETS, DEMO_PRESETS]) {
  for (const k of Object.keys(g)) expectedNames.add(k);
}
const missingFromLib = [...expectedNames].filter((n) => !LIB.has(n));
const extraInLib = NAMES.filter((n) => !expectedNames.has(n));
chk(`the composed library is ${NAMES.length} presets, and the source groups derive the SAME NAME SET`,
  missingFromLib.length === 0 && extraInLib.length === 0,
  `missing ${JSON.stringify(missingFromLib.slice(0, 5))}, extra ${JSON.stringify(extraInLib.slice(0, 5))}. `
  + '⚠️ Reconcile by NAME. A difference here means composition and the group sources disagree about what ships, '
  + 'and every count below inherits it');
chk('...and no refined/variant entry is an orphan', orphans === 0,
  `loadLibrary reported ${orphans} orphan(s) — an orphan still LOADS but lands at the end of the group, so the `
  + 'coverage figures stay right while library POSITION is wrong');
chk('...and loadLibrary did not mutate the read-only legacy JSON',
  JSON.stringify(JSON.parse(rawText.slice(rawText.indexOf('{')).replace(/;\s*$/, ''))) === JSON.stringify(rawLib),
  '`public/psss_presets.json` is read-only by project rule and the pass-order pin must spread a copy');

/*
 * THE SCAFFOLD EXCLUSION (`21.D7`, `21.6g`). A temporary review copy is not a coverage source. Each suffix names
 * the module that owns it, so the clause cannot outlive its scaffold silently — and it is NOT deleted when the
 * scaffold goes, because the rule is about the class and the next scaffold will use a different suffix.
 */
const SCAFFOLDS = [
  { suffix: ' warpfirst', module: 'src/presets/warp-first-review.ts', why: 'the 2026-09-18 TransMap pass-order review copies (deleted by owner verdict the same day)' },
];
const scaffoldNames = new Set();
for (const s of SCAFFOLDS) {
  const hits = NAMES.filter((n) => n.endsWith(s.suffix));
  for (const n of hits) scaffoldNames.add(n);
  const owned = existsSync(join(ROOT, s.module));
  note(`scaffold suffix "${s.suffix}" matched ${hits.length} preset(s); owner module ${s.module} is `
    + `${owned ? 'PRESENT' : 'ABSENT'} — ${s.why}. The clause is retained by rule (21.D7) even at 0 matches`);
}
/** Every count below is over the PERMANENTLY-SHIPPING library. */
const SHIPPING = NAMES.filter((n) => !scaffoldNames.has(n));
chk(`coverage is counted over ${SHIPPING.length} permanently-shipping presets (${NAMES.length} composed − ${scaffoldNames.size} scaffold)`,
  SHIPPING.length === NAMES.length - scaffoldNames.size);

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== B. activation, resolved as main.ts resolves it at load (never key presence) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **`main.ts` IS BROWSER-ONLY AND CANNOT BE IMPORTED HERE**, so TWO resolutions are re-implemented below and
 * the owners' SOURCE SHAPE is asserted. A source-shaped failure means the owner was renamed or bypassed — read it
 * as "the re-implementation is now a second, drifting answer", never as a coverage regression.
 *
 * ⚠️ **THREE until v8 22.1 (2026-09-24), when the render-mode resolver became IMPORTABLE and the copy went.** The
 * two that remain are re-implemented for two DIFFERENT reasons, and only one of them is fixable: the requested-mode
 * `??` chain is an expression inline in `applyPresetChange` with no owner to import, while `getForceModes()` is a
 * method on a GL-owning class. **So "re-implement it" is not a house style here — each copy owes a reason, and the
 * one that had a fixable reason was fixed.** Both keep their source-shape assertion; `resolveModeAgainstMaterial`
 * no longer needs one, and the assertion below is re-pointed at its new home rather than deleted, because the
 * shape it pins (the `liquid` exemption FIRST) is the 2026-09-01 user report and outlived the copy.
 */
const mainTs = rd('src/main.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
chk('main.ts still resolves the requested mode as `overlay.renderMode ?? preset.renderer.mode ?? star`',
  /currentRenderMode = preset\.overlay\?\.renderMode\s*\?\?\s*\(isSamePreset \? currentRenderMode : \(preset\.renderer\.mode \?\? 'star'\)\)/.test(mainTs),
  'the shape below re-implements this line for a COLD load (isSamePreset false)');
// ⚠️ 22.1 — re-pointed from `main.ts` to the resolver's new home. The mode itself is now IMPORTED from that
// same file, so this clause has stopped guarding a copy and become what it should have been all along: a pin on
// the SHAPE the 2026-09-01 user report is about, in the file that owns it.
const matPresetsTs = rd('src/generators/material-presets.ts');
chk('...and a live material is `!!material && material.preset !== \'None\'`, with `liquid` exempt FIRST',
  /const materialLive = !!material && material\.preset !== 'None';/.test(matPresetsTs)
  && /if \(requested === 'liquid'\) return 'liquid';/.test(matPresetsTs)
  && !/function resolveModeAgainstMaterial\(/.test(mainTs),
  'resolveModeAgainstMaterial is the ONE owner of the rule that a material overrides every mode except liquid, it '
  + 'lives in `generators/material-presets.ts` since 22.1, and `main.ts` must hold no local copy to shadow it');
chk('...and `splat` with no live material still falls back rather than drawing nothing',
  /currentRenderMode === 'splat'\)\s*\{[\s\S]{0,200}?previousRenderMode !== 'splat' \? previousRenderMode : 'star'/.test(mainTs),
  'the fallback is what makes `splat` + no material an INERT AUTHORING (§F) rather than a black frame');

/*
 * **THE ENGINE'S OWN `resolveModeAgainstMaterial`, imported at the top of this file (22.1).** Kept behind a local
 * name because every call site below reads `resolveMode(...)` and renaming them would make a behaviour-neutral
 * edit look like a coverage change in the diff — the *Verify* rule about a rename reading as a regression, applied
 * to the checker itself. ⚠️ **Do not re-inline a copy here**, whatever the next reason looks like.
 */
const resolveMode = resolveModeAgainstMaterial;

/*
 * THE PARTICLE FORCE FIELD, and ⚠️ **THE FIRST DRAFT OF THIS CHECKER GOT IT WRONG IN THE DIRECTION THAT MATTERS**
 * — it required a live style-6 layer and so reported the feature at 0 when six presets use it. **Style 6 is in
 * NONE of the three force modes** (`getForceModes()`'s own ⚠️: Fluid Feedback warps pixels from a velocity field
 * it does not publish as a displacement texture), and the real gate at `main.ts:2774` is
 * `currentTransMapForceBlend > 0 && currentTransMapEnabled` with the SOURCES decided by `getForceModes()`.
 * Every one of the six carriers runs a style-3 or style-5 layer, so the honest figure is 6, not 0. Read this as
 * the *Verify* rule it is: **a measuring section's own basis has been the defect repeatedly** — a floor of 2 that
 * a feature already meets would have commissioned two demos nobody needed.
 */
const transMapTs = rd('src/post-processors/trans-map.ts');
chk('`getForceModes()` still derives all three modes from the chain plan alone (style 6 excluded, 10 inside `analytic`)',
  /ifs: this\.plan\.echoLayer !== null,\s*texture: this\.forceReadbackLayerCount\(\) > 0,\s*analytic: this\.plan\.staticStyles\.length > 0 \|\| this\.plan\.vortexLayer !== null,/.test(transMapTs)
  && /forceReadbackLayerCount\(\): number \{\s*return this\.plan\.flowLayer \? 1 : 0;/.test(transMapTs),
  'the re-implementation below reads `buildChainPlan(chain)`, which IS importable — if this shape moved, the '
  + 'two answers have started to drift and the force-field figure is no longer main.ts\'s');
chk('main.ts still gates the force pass on the blend and the checkbox ALONE, never on a style',
  /if \(currentTransMapForceBlend > 0 && currentTransMapEnabled\) \{/.test(mainTs),
  'requiring style 6 here is the mistake this assertion exists to prevent (see the block comment above)');
/** Re-implementation of `TransMapProcessor.getForceModes()`, asserted above. */
const forceModes = (chain, enabled) => {
  if (!enabled) return { ifs: false, texture: false, analytic: false };
  const plan = buildChainPlan(chain);
  return {
    ifs: plan.echoLayer !== null,
    texture: plan.flowLayer !== null,
    analytic: plan.staticStyles.length > 0 || plan.vortexLayer !== null,
  };
};

/** One activation record per preset. Every field is a RESOLUTION, and each names the rule it applies. */
function resolveAll(lib) {
  const out = new Map();
  for (const [name, p] of lib) {
    const ov = p.overlay ?? {};
    const tm = p.postProcessors?.transMap ?? {};
    const tmEnabled = ov.transMapEnabled ?? tm.enabled ?? false;
    const chain = chainFromOverlay(ov, tm.style ?? 0, tm.ifsParams);
    // A style is LIVE iff TransMap is on, the layer contributes (enabled AND weight > 0 — `isStyleActive`), and
    // it is not a weightless modifier with no field layer to modify (`isInertModifier`, P9).
    const liveStyles = TRANS_MAP_STYLES
      .map((m) => m.style)
      .filter((s) => tmEnabled && isStyleActive(chain, s) && !isInertModifier(chain, s));
    const materialLive = !!ov.material && ov.material.preset !== 'None';
    const requestedMode = ov.renderMode ?? p.renderer?.mode ?? 'star';
    const resolvedMode = resolveMode(requestedMode, ov.material ?? null);
    // `splat` surviving with no live material is the inert authoring of `21.2`: main.ts falls back, so the
    // EFFECTIVE mode is `star` on a cold load (`previousRenderMode` is `star` before the first preset lands).
    const splatWithNoMaterial = resolvedMode === 'splat' && !materialLive;
    const effectiveMode = splatWithNoMaterial ? 'star' : resolvedMode;
    const fm = forceModes(chain, tmEnabled);
    const forceFieldLive = tmEnabled && (ov.transMapForceBlend ?? 0) > 0 && (fm.ifs || fm.texture || fm.analytic);
    const plan = buildChainPlan(chain);
    out.set(name, {
      preset: p, ov, chain, tmEnabled, liveStyles, materialLive, requestedMode, resolvedMode, effectiveMode,
      splatWithNoMaterial, forceFieldLive, needsWarp: tmEnabled && plan.needsWarp,
      // A weightless modifier PRESENT and contributing but with no field layer — the trap the census found
      // avoided rather than absent. Counted so it stays avoided.
      inertModifiers: TRANS_MAP_STYLES
        .map((m) => m.style)
        .filter((s) => tmEnabled && isStyleActive(chain, s) && isInertModifier(chain, s)),
      // A chain whose only live layers are muted or weight-0 — "the chain does nothing".
      deadChain: tmEnabled && chain.length > 0 && liveStyles.length === 0,
    });
  }
  return out;
}

/*
 * THE FEATURE TABLE. Each row's `live()` is the resolution, and the comment names the owner it mirrors. The rows
 * are curated — "field system" is a concept with no runtime registry — but every VOCABULARY below (§D's enums,
 * §E's boolean paths, the render modes, the TransMap styles) is DERIVED, never listed here.
 */
const FEATURES = [
  // --- field systems (`21.D5`: floor 2) ---------------------------------------------------------
  { id: 'physarum',        floor: 2, live: (r) => (r.ov.physarum?.blend ?? 0) > 0 },                       // physarum.ts isActive()
  { id: 'liquidField',     floor: 2, live: (r) => r.ov.liquidField?.enabled === true },                    // main.ts currentLiquidField.enabled
  { id: 'fluidAdvection',  floor: 2, live: (r) => (r.ov.fluidAdvection?.blend ?? 0) > 0 },                 // fluid-advection.ts isActive(), authored half
  { id: 'dye',             floor: 2, live: (r) => r.ov.dye?.enabled === true && (r.ov.dye?.opacity ?? 0) > 0 }, // dye-field.ts isActive()
  { id: 'buoyancy',        floor: 2, live: (r) => r.ov.buoyancy?.enabled === true },
  { id: 'sparks',          floor: 2, live: (r) => r.ov.sparks?.enabled === true },
  { id: 'crystals',        floor: 2, live: (r) => r.ov.crystal?.enabled === true },
  { id: 'cohesion',        floor: 2, live: (r) => (r.ov.cohesion?.strength ?? 0) > 0 },                    // main.ts export gate
  { id: 'curlNoise',       floor: 2, live: (r) => r.ov.curlNoise?.enabled === true },
  { id: 'forceField',      floor: 2, live: (r) => r.forceFieldLive },                                      // main.ts:2774 + getForceModes()
  /*
   * ⚠️ **THE GATE'S MATERIAL PRECONDITION IS PER-SOURCE, NOT BLANKET** — and the plan's `21.5f`/`21.5g` cards
   * and `CLAUDE.md`'s force-gate row both state it as blanket ("inert with no material"), which is true of the
   * two sources they discuss and false of the third. `prepareGate()` reads `state.lifetimes` for `'age'` and
   * `state.temperatures` for `'temperature'` — both absent while `MaterialProcessor.update()` returns early on
   * `preset === 'None'` — but `'depth'` reads `state.depths`, which **every generator always fills**
   * (`material-presets.ts:210`, `types.ts:181`). A blanket test would report a legitimate depth-gated demo as
   * non-compliant, i.e. would send someone to add a material the feature does not need. It is a LERP FROM 1, so
   * `amount: 0` is byte-identical to ungated and belongs in the resolution.
   *
   * ⚠️ **"Absent" became true of `lifetimes` only on 2026-09-20 and is still FALSE of `temperatures`** — the
   * publish gate in `lissajous.ts`' `getState()`, measured in `fieldcheck` §V. `MaterialProcessor.init()` is
   * unconditional, so before that fix both arrays were published as full-length ZEROS: the `'age'` gate read
   * `exp(0) = 1` and behaved as ungated, and the `'temperature'` gate read 0 and silently scaled every force
   * by a constant — neither reported itself inactive, which is what the header above promises. **This row's own
   * resolution is unaffected**: it asks what the BODY authors, which is the right question for coverage and was
   * never where the defect lived.
   */
  { id: 'forceGate',       floor: 2, live: (r) => r.forceFieldLive && (r.ov.transMapForceGateAmount ?? 0) > 0
                                                 && (r.ov.transMapForceGateBy ?? 'none') !== 'none'
                                                 && (r.ov.transMapForceGateBy === 'depth' || r.materialLive) },
  { id: 'symmetryFold',    floor: 2, live: (r) => (r.ov.symmetryFold ?? 1) > 1 },
  // The mirror is meaningless at fold 1 (`21.5h`), so fold > 1 is part of the resolution, not a nicety.
  { id: 'symmetryMirror',  floor: 2, live: (r) => r.ov.symmetryMirror === true && (r.ov.symmetryFold ?? 1) > 1 },
  { id: 'growth',          floor: 2, live: (r) => r.ov.growth?.enabled === true },
  // --- render modes, vocabulary DERIVED from the RenderMode union ---------------------------------
  // --- TransMap styles, vocabulary DERIVED from TRANS_MAP_STYLES ----------------------------------
  // --- the one structural row the census called out separately -----------------------------------
  { id: 'transMapChain3+', floor: 2, live: (r) => r.liveStyles.length >= 3 },
];

/** The render-mode vocabulary, parsed from its ONE declaration — a member added there is gated automatically. */
const coreTs = rd('src/core/interfaces.ts');
const modeDecl = /export type RenderMode =([^;]+);/.exec(coreTs);
const RENDER_MODES = modeDecl ? [...modeDecl[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
chk(`the RenderMode vocabulary is DERIVED from its declaration (${RENDER_MODES.length} members: ${RENDER_MODES.join(', ')})`,
  RENDER_MODES.length >= 6,
  'parsing `export type RenderMode = …` in src/core/interfaces.ts failed — a hand-written list here would be a '
  + 'third enumeration and would silently stop gating a new mode');
for (const m of RENDER_MODES) {
  // `volume` is an ATTEMPT (`21.D6`), so its floor is 1; every other mode's is 2.
  FEATURES.push({ id: `mode:${m}`, floor: m === 'volume' ? 1 : 2, live: (r) => r.effectiveMode === m });
}
for (const m of TRANS_MAP_STYLES) {
  FEATURES.push({ id: `tmstyle:${m.style}`, label: `${m.style} ${m.name}`, floor: 2, live: (r) => r.liveStyles.includes(m.style) });
}
chk(`the TransMap style vocabulary is IMPORTED from TRANS_MAP_STYLES (${TRANS_MAP_STYLES.length} styles)`,
  TRANS_MAP_STYLES.length === 13,
  '⚠️ `TransMapStyle` the TYPE is wider by one (it carries 13); `TRANS_MAP_STYLES` is the ONE enumeration of '
  + 'what is IMPLEMENTED and is the right basis for a floor. ⚠️ **Raised 12 -> 13 by `30.4` (Conformal), and '
  + 'the raise is the TICK: this clause exists so that adding a style is a deliberate edit here rather than '
  + 'a silently widened basis. If it fails, count TRANS_MAP_STYLES — do not relax the comparison.');

/*
 * THE STATUS TABLE — `GATED` | `EXEMPT` (+reason) | `COMMISSIONED` (+step). Set from the counts measured
 * 2026-09-18. ⚠️ Promoting a row is a deliberate edit: that is the tick.
 */
const STATUS = {
  growth:          { status: 'EXEMPT', reason: 'Phase 9 is concluded-but-mostly-cut and Phases 10 and 12 are HELD — there is no shipped surface to demonstrate. `overlay.growth` is import-only and is read by nothing at runtime (21.D5).' },
  // ⚠️ **PROMOTED 2026-09-20 by the demo cohort, and this is the FIRST discharge on this list that was
  // INTENTIONAL** — `fluidAdvection` and `tmstyle:11` below both came off by accident, via preset settles that
  // knew nothing about the phase. `Physarum Weave` was authored FOR this row. **That changes what the promotion
  // means and not how much it discharges:** `21.5a` is a step about a trail that READS as a slime mould, and
  // ⏳ **the preset carries the `'review'` tag — a browser verdict is OWED and a checker cannot give it.**
  physarum:        { status: 'GATED' },
  // ⚠️ **`fluidAdvection` WAS COMMISSIONED `21.5e` AND WENT STALE ON 2026-09-19 — the SECOND accidental
  // discharge, by the same mechanism as `tmstyle:11` below and in the same sitting's batch.** The fifth
  // refined-preset settle pasted the owner's `The Real Super Man` export, whose body carries
  // `fluidAdvection.blend: 0.44`; pre-batch `REFINED_PRESETS` held ZERO carriers, so the sole live one was
  // `Hypno Penta II` and the row read 1/2. **Two independent batches have now met a floor without knowing the
  // row existed**, which is the whole argument for measuring rather than carrying: nothing in a settle request
  // mentions a phase step, and no reviewer of that request would have looked here. `21.5e`'s own claim — a
  // step about DEMONSTRATING advection legibly — is NOT discharged by the row coming off.
  fluidAdvection:  { status: 'GATED' },
  // ⚠️ **PROMOTED 2026-09-20 — three demos, ONE PER `ForceGateSource` MEMBER**, because §D gates the members
  // separately from this row: `Age Gate Embers` (`'age'`), `Temperature Gate Frost` (`'temperature'`) and
  // `Depth Gate Veil` (`'depth'`). ⚠️ **This row's `live` predicate ALSO requires `forceFieldLive`** — the gate
  // scales a force field's increment, so a gated preset with no live field is an inert authoring of the kind §F
  // fails on, and all three carry `transMapEnabled` + a field layer + `transMapForceBlend > 0` for that reason.
  // `21.5f`/`21.5g`'s claim is that the gate's effect is LEGIBLE, which the count cannot see; ⏳ verdict owed.
  forceGate:       { status: 'GATED' },
  // ⚠️ ONE step covers both symmetry rows: the mirror is meaningless at fold 1, so `21.5h`'s demo necessarily
  // lifts the fold to 2 as well. Measured 2026-09-18: BOTH are at 1, and it is the SAME preset (`Material
  // Organic`) — so the plan's `21.5h` card, which says "the 3 fold-only presets", has no such presets to
  // compare against. Re-measure before acting on that clause; a figure in a plan is a claim, not evidence.
  // ⚠️ **BOTH PROMOTED 2026-09-20 by ONE preset (`Mirror Fold Rosette`, fold 5 + mirror), which is exactly what
  // the note above predicted** — the mirror is meaningless at fold 1, so a mirror demo necessarily lifts the
  // fold too and one body discharges two rows. **The counts are now 2 and 2, and they are the SAME two presets**
  // (`Material Organic` and this one), so the plan's `21.5h` card still has no fold-only preset to compare
  // against: the clause it was written around was falsified on 2026-09-18 and authoring the demo did not
  // restore it. ⏳ The step's appeal claim is owed a browser verdict; the count is not the claim.
  symmetryFold:    { status: 'GATED' },
  symmetryMirror:  { status: 'GATED' },
  // ⚠️ **PROMOTED 2026-09-20 — `Pixel Line Art` + `Pixel Age Palette`, authored as a pair on purpose.** The
  // mode's floor is 2 like every other mode's, and the second body is not padding: `pixel` reaches the SHARED
  // palette path, so one demo shows the mode (1 px line art, brightness from the tone curve) and the other
  // shows a feature ON it (`paletteMapping: 'age'` with no material). ⚠️ **§D's `renderer.mode:pixel` row stays
  // EXEMPT and is a different question** — that is the LEGACY field, which the engine reads `overlay.renderMode`
  // over. ⏳ `21.8a` asks for a mode that looks GOOD, which is a verdict; both presets carry `'review'`.
  'mode:pixel':      { status: 'GATED' },
  // ⚠️ **`'mode:log-density'` WAS COMMISSIONED `21.8c` AND THE ROW IS GONE BECAUSE THE MODE IS (owner,
  // 2026-09-19).** `21.D6` had deferred the retirement decision to the demos this row was asking for, and the
  // owner answered by retiring it instead — so the honest end of a commission is sometimes the DELETION of
  // its subject. **The row could not have stayed:** §C's features are derived from the `RenderMode` union, so
  // with the member gone the row named nothing and asserted nothing, which is the one failure shape this file
  // is built to refuse. §A's status-orphan check is the instrument that now says so out loud.
  // ⚠️ **PROMOTED 2026-09-20 — `Time Warp Lattice` + `Time Warp Smear`, and the count is 3 because a third
  // carrier already existed.** ⚠️ **Style 8 is `weightless: true, requiresField: true`**: it contributes no
  // offset of its own and is DROPPED unless a field style shares its chain, so both demos pair it with a live
  // style-0 layer and neither counts toward `needsWarp`. The two bodies split the style's own `source` union
  // (`'field'` and `'density'`), which §D does not gate — so this row is the only instrument over that split.
  // ⏳ `21.6a` is a step about a warp that is legible as TIME rather than as smear; verdict owed.
  'tmstyle:8':     { status: 'GATED' },
  // ⚠️ **`'tmstyle:11'` (Depth Parallax) WAS COMMISSIONED `21.6c` AND WENT STALE ON 2026-09-19 — and unlike
  // `paletteMapping:index`, NOTHING WAS AUTHORED FOR IT.** The `Spiritual` preset settle pasted an owner-tuned
  // export whose chain happens to carry a live style-11 layer, which joined `Sphere II` and took the count to the
  // floor of 2. **A floor can therefore be met by a preset batch that knows nothing about the phase**, which is
  // the strongest form of this rule's argument: a carried census would have gone on claiming the gap for as long
  // as nobody re-ran it. `21.6c`'s own claim — a step about APPEAL and NAMING — is NOT discharged by the row
  // coming off; two accidental carriers are coverage, not a demo.
  // ⚠️ **PROMOTED 2026-09-20 — `Chain Triple Cascade` (styles 0 + 7 + 9) joined the one pre-existing 3-layer
  // chain.** ⚠️ **Every layer's strength in that body is LOW and that is a constraint, not taste:** `uMaxOffset`
  // (1.5) is SHARED across the whole chain, so three layers at their usual strengths clip against one ceiling
  // and the third layer silently contributes nothing — which would have satisfied this row while demonstrating
  // the opposite of `21.6f`. **A count of live layers cannot see a clipped one.** ⏳ Verdict owed.
  'transMapChain3+': { status: 'GATED' },
};
/*
 * ⚠️ **FOUR ROWS CAME OFF THIS LIST AT THE FIRST RUN, 2026-09-18, AND THAT IS THE POINT OF THE RULE.** They had
 * been written from the 2026-09-17 census as carried figures; measured, they were already covered: `liquidField`
 * 2, `dye` 4, `tmstyle:9` 3, `tmstyle:10` 2, plus `mode:volume` at 1 against its floor of 1 and `forceField` at 6
 * once §B's resolver was corrected. They are GATED now. **Their plan steps are NOT discharged by that** —
 * `21.5b`, `21.6d` and `21.6e` are commissioned for APPEAL and NAMING, which no checker can represent, and
 * `21.8e` is an attempt. A floor met is a floor met; the step above it is a separate claim.
 */

const RESOLVED = resolveAll(LIB);
/** Count a feature over the shipping set only. Pure, so §H can call it over a fixture. */
const countFeature = (resolved, shipping, f) => shipping.filter((n) => f.live(resolved.get(n))).length;

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== C. floors (21.D5) — every field system and every TransMap style at >= 2 live presets ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/** The floor rule as a pure function: returns a violation list. §H seeds it. */
function floorViolations(resolved, shipping, features, status) {
  const v = [];
  for (const f of features) {
    const n = countFeature(resolved, shipping, f);
    const s = status[f.id] ?? { status: 'GATED' };
    if (s.status === 'GATED' && n < f.floor) v.push(`${f.id}: ${n} < ${f.floor}`);
    if (s.status === 'COMMISSIONED' && n >= f.floor) v.push(`${f.id}: ${n} >= ${f.floor} but still COMMISSIONED ${s.step}`);
    if (s.status === 'EXEMPT' && (!s.reason || s.reason.trim().length < 20)) v.push(`${f.id}: EXEMPT with no usable reason string`);
  }
  return v;
}
for (const f of FEATURES) {
  const n = countFeature(RESOLVED, SHIPPING, f);
  const s = STATUS[f.id] ?? { status: 'GATED' };
  const label = f.label ? `${f.id} (${f.label})` : f.id;
  // ⚠️ **NAME THE CARRIERS WHILE THERE ARE FEW ENOUGH TO NAME.** A feature at 1 or 2 is the one a step is about
  // to be authored against, and "which preset is the existing one" is the first question that step asks. A count
  // alone sends the reader back to re-derive what this loop already knows.
  const carriers = n > 0 && n <= 3 ? `   [${SHIPPING.filter((x) => f.live(RESOLVED.get(x))).join(' | ')}]` : '';
  if (s.status === 'GATED') {
    chk(`${label} >= ${f.floor}`, n >= f.floor,
      `${n} live preset(s)${carriers}; a shortfall here is a gap in the LIBRARY, never a bug in the feature`);
  } else if (s.status === 'COMMISSIONED') {
    chk(`${label} is below its floor and COMMISSIONED ${s.step} (${n}/${f.floor})`, n < f.floor,
      `${n} live preset(s)${carriers}; a COMMISSIONED row that reaches its floor FAILS, so promote it to GATED — `
      + 'a TODO that discharges itself silently is how a phase ends with its own checker asserting nothing');
  } else {
    chk(`${label} is EXEMPT with a reason on record (${n} live)`, !!s.reason && s.reason.trim().length >= 20, s.reason ?? 'no reason');
    if (n >= f.floor) note(`${label} is EXEMPT but now measures ${n} — promote it to GATED or restate the exemption`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== D. enum-member coverage — vocabularies DERIVED from their single declaration ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **TWO HALVES, AND THEY FAIL DIFFERENTLY.** The VOCABULARY is parsed from the one place the union is
 * declared, so a new member is gated the moment it is typed. The PATH is written here — and is itself asserted
 * to be observed in at least one body, so a rename or a typo fails loudly instead of reporting the enum
 * uncovered (which would read as a library gap and send someone off to author a preset that already exists).
 */
const typesTs = rd('src/presets/types.ts');
const filmLooksTs = rd('src/renderers/film-looks.ts');
const unionFrom = (src, name) => {
  const m = new RegExp(`export type ${name} =([^;]+);`).exec(src);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
};
const inlineUnionFrom = (src, field) => {
  const m = new RegExp(`\\n\\s*${field}\\??:\\s*((?:'[^']+'\\s*\\|\\s*)*'[^']+')`).exec(src);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
};
/**
 * An inline union scoped to ONE interface. ⚠️ `inlineUnionFrom` matches the FIRST field of that name in the
 * whole file, and `source` is declared on both `DyeConfig` and `RefractionConfig` — so an unscoped read would
 * silently hand one interface's vocabulary to the other's path and report a member "covered" from the wrong set.
 */
const blockUnionFrom = (src, iface, field) => {
  const start = src.indexOf(`export interface ${iface} {`);
  if (start < 0) return null;
  const end = src.indexOf('\n}', start);
  return inlineUnionFrom(src.slice(start, end < 0 ? undefined : end), field);
};

const ENUMS = [
  { id: 'liquid.tintSource',        path: 'overlay.liquid.tintSource',        vocab: unionFrom(typesTs, 'LiquidTintSource') },
  { id: 'liquidField.seedPattern',  path: 'overlay.liquidField.seedPattern',  vocab: unionFrom(typesTs, 'LiquidSeedPattern') },
  { id: 'crystal.birthRule',        path: 'overlay.crystal.birthRule',        vocab: unionFrom(typesTs, 'CrystalBirthRule') },
  { id: 'crystal.shape',            path: 'overlay.crystal.shape',            vocab: unionFrom(typesTs, 'CrystalShape') },
  { id: 'material.colourRamp',      path: 'overlay.material.colourRamp',      vocab: unionFrom(typesTs, 'ColourRampName') },
  { id: 'forceGate.by',             path: 'overlay.transMapForceGateBy',      vocab: unionFrom(typesTs, 'ForceGateSource') },
  { id: 'dye.colourSource',         path: 'overlay.dye.colourSource',         vocab: inlineUnionFrom(typesTs, 'colourSource') },
  { id: 'renderer.mode',            path: 'renderer.mode',                    vocab: RENDER_MODES },
  /*
   * ⚠️ **TWO PATHS, ONE VOCABULARY — and the second path is why `paths` exists at all (21.4c).** As of Step
   * 21.4a the mapping is authorable in two places: inside the film-look bundle (the older home, which costs the
   * preset its named look) and as `overlay.paletteMapping` (grading-free, which is the one the migration in
   * 21.4d writes). A row over ONE of them would go on reporting a member "authored by 0 presets" while 129
   * bodies carried it — a FALSE gap, i.e. the gate becoming wrong about the library rather than the library
   * being wrong. Every path in the list is separately required to name a declared field.
   */
  { id: 'paletteMapping', paths: ['overlay.customFilmLookParams.paletteMapping', 'overlay.paletteMapping'], vocab: unionFrom(filmLooksTs, 'PaletteMapping') },
  // ⚠️ **IN NEITHER OF THE CENSUS'S TWO BASES** (`21.9`'s widening note names it): a two-member enum living
  // inside a per-layer block, so the enum sweep did not reach it and the boolean sweep could not represent it.
  { id: 'refraction.source',        path: 'overlay.transMapChain[].refraction.source', vocab: blockUnionFrom(typesTs, 'RefractionConfig', 'source') },
];
/*
 * ⚠️ **`PaletteMapping` IS DECLARED TWICE** — `renderers/film-looks.ts` (6 members, the live one, read by
 * `paletteMappingToInt` and `setPaletteMapping`) and `presets/palettes.ts` (4 members, imported by nothing).
 * `types.ts` points at the film-looks one as the authority. A member added to the WRONG declaration type-checks
 * and gates nothing, so the vocabulary above is taken from film-looks.ts by name and the duplicate is reported.
 */
const paletteMappingDup = unionFrom(rd('src/presets/palettes.ts'), 'PaletteMapping');
if (paletteMappingDup) {
  // ⚠️ BY ID, never `ENUMS.at(-1)` — which is what this line said until a row was appended after it and the
  // note started printing the NEXT row's vocabulary as the live PaletteMapping. A positional reference into a
  // list that grows is the same defect class as the Reel's positional preview marker.
  const live = ENUMS.find((e) => e.id === 'paletteMapping')?.vocab ?? [];
  note(`PaletteMapping is declared TWICE: film-looks.ts [${live.join(', ')}] is the live one; `
    + `palettes.ts [${paletteMappingDup.join(', ')}] has no importer. Adding a member to the second one gates nothing`);
}

/** Walk every body once, collecting leaf paths → observed values. Array indices normalise to `[]`. */
function walkLeaves(lib, shipping) {
  const strings = new Map();   // path -> Map(value -> count)
  const booleans = new Map();  // path -> { present, trueCount }
  const add = (map, path, value) => {
    let m = map.get(path); if (!m) { m = new Map(); map.set(path, m); }
    m.set(value, (m.get(value) ?? 0) + 1);
  };
  for (const name of shipping) {
    const seenBool = new Set(), trueBool = new Set(), seenStr = new Map();
    const walk = (v, path) => {
      if (typeof v === 'string') { if (!seenStr.has(path)) seenStr.set(path, new Set()); seenStr.get(path).add(v); return; }
      if (typeof v === 'boolean') { seenBool.add(path); if (v) trueBool.add(path); return; }
      if (v === null || typeof v !== 'object') return;
      if (Array.isArray(v)) { v.forEach((x) => walk(x, `${path}[]`)); return; }
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
    };
    walk(lib.get(name), '');
    for (const [p, vals] of seenStr) for (const val of vals) add(strings, p, val);
    for (const p of seenBool) {
      let e = booleans.get(p); if (!e) { e = { present: 0, trueCount: 0 }; booleans.set(p, e); }
      e.present++; if (trueBool.has(p)) e.trueCount++;
    }
  }
  return { strings, booleans };
}
const LEAVES = walkLeaves(LIB, SHIPPING);

const ENUM_STATUS = {
  // ⚠️ **`'liquid.tintSource:material'` WAS COMMISSIONED `21.9` AND WENT STALE ON 2026-09-19, by the same
  // accident as §C's `tmstyle:11`**: the `Solar Fusion II` variant spawned by that day's settle batch is an
  // owner-tuned export that runs the iso-surface renderer (`overlay.renderMode: 'liquid'`) over a `Liquid`
  // material and tints the surface FROM it. ⚠️ **Note which `liquid` that is** — `overlay.liquid` here is the
  // ISO-SURFACE parameter block (`isoLevel`, `kernelWidth`, `tintSource`, `surfaceRamp`), which has no
  // `enabled` flag of its own and is live because the effective mode is `liquid`; it is NOT the liquid FIELD
  // (`overlay.liquidField`), and it is not the `Liquid` material either. Three things are named "liquid" and
  // only one of them makes this member live.
  // ⚠️ **ELEVEN ROWS PROMOTED 2026-09-20, ALL BY AUTHORING** (this row through `refraction.source:luminance`),
  // which is the opposite of how the four rows above this list came off. **Read each promotion as "a body now
  // writes this member", never as "the feature is demonstrated"** — the step numbers still stand as claims and
  // the bodies were UNSEEN when the rows were promoted. ⚠️ **Do not read a `'review'` tag count as the review's
  // state either** — it is now a moving figure (measured 2026-09-20: 36 of 51 demo bodies still carry it, and the
  // tag comes off only when the owner confirms a body), and the verdicts live in one place:
  // `REVIEW-phase21-demos.md`, whose table is the thing to re-count.
  //
  // ⚠️ **`basin` LOST ITS CARRIER ON 2026-09-20 AND THIS ROW STATES THE GAP RATHER THAN HIDING IT.** The demo
  // that covered it was reviewed 🔧 by the owner, retuned (`'basin'`, 0.35 / 0.992), then REPLACED by the
  // owner's own Lab export, which moved the seed to `'blobs'` and renamed the preset `Liquid Field Clouds`. A
  // hand-tuned body the owner accepted outranks a coverage row, so the row went back to COMMISSIONED `21.5b`
  // — ⚠️ **the one repair that was NOT available was demoting the assertion to fit the library**: a GATED row
  // with zero carriers FAILS, which is exactly the signal wanted here. `'blobs'` is now carried TWICE
  // (`Liquid Field Pool` and `Liquid Field Clouds`), so the enum is greener than the phase is: **coverage of a
  // member is not diversity across members.**
  // ⚠️ **`fill` and `basin` were specified as the two OPPOSITE CORNERS of the liquid field and deliberately
  // not variants of one body:** `Liquid Field Fill` runs high diffusion over a full seed (0.85 / decay 0.985),
  // against low diffusion over a seed occupying one BAND of the frame. A single preset flipping the enum would
  // cover both members and show neither, because a seed pattern is only legible against the diffusion that
  // carries it — which is why the answer to this gap is a NEW body, not an edit to the one that left.
  'liquidField.seedPattern:fill':   { status: 'GATED' },
  'liquidField.seedPattern:basin':  { status: 'COMMISSIONED', step: '21.5b' },
  // ⚠️ **ONE body (`Hexagon Crystal Bloom`) discharges both crystal members, and its central value has since been
  // REVERSED BY THE OWNER — `growthEnabled` is `true` as shipped (measured, not read off this comment).** The
  // original argument: the 8a-3 gate demoted `hexagon` from the default because hexagons read "like ice cubes"
  // and INFLATE rather than branch when they grow, so a hexagon demo with growth ON would author the member while
  // demonstrating the defect that demoted it. **No checker can tell those two bodies apart** — this row is green
  // either way, which is why the reversal had to come from a browser and did (2026-09-20 owner export; the
  // reasoning is in `REVIEW-phase21-demos.md` entry 26). The measurement is not contradicted: what the
  // eye established is that inflation is not the wrong thing on a `latticeSnap 0.75` grid.
  // `random` birth is the rule that suits it (seeds scattered over the whole figure).
  'crystal.shape:hexagon':          { status: 'GATED' },
  'crystal.birthRule:random':       { status: 'GATED' },
  // ⚠️ `Fire Smoke Crossover`. The member names a ramp that CROSSES between two appearances over particle age,
  // so it is the one `ColourRampName` whose content is temporal — authoring it on a short trail hides it.
  'material.colourRamp:fire-smoke': { status: 'GATED' },
  // ⚠️ `Fixed Dye Plume`. **Its `liquid.tintSource` is `'preset'`, NOT `'dye'`, and that pairing is the trap this
  // member sits behind:** `'dye'` as a tint source degrades to `'ramp'` when the field data is absent, so a demo
  // of a FIXED dye colour must not route the surface tint through the source that can silently substitute.
  'dye.colourSource:fixed':         { status: 'GATED' },
  /*
   * ⚠️ **`Dye Palette Wake`. COMMISSIONED `15.7b` FOR ONE DAY, AND THE COMMISSION DISCHARGED ITSELF THE WAY
   * THIS SECTION'S RULES SAY IT SHOULD.** The row was written on 2026-10-15 with the member and no carrier;
   * on 2026-10-16 the owner exported a confirmed body and it became GATED. **A COMMISSIONED row that reaches
   * its floor FAILS**, so the promotion was forced by the checker rather than remembered — which is the
   * whole mechanism, and the reason the row was not made EXEMPT instead.
   *
   * ⚠️ **ITS BODY IS `Dye Wake` WITH ONE DYE FIELD CHANGED, AND THE PAIR IS DELIBERATE.** Coverage of a
   * member is not the same as a demonstration of it: two bodies one field apart isolate the source, where a
   * freshly authored body would differ in a dozen ways at once and show nothing in particular. ⚠️ **Do not
   * "tidy" the pair by folding it back into one preset** — `Dye Wake`'s `'velocity'` is a MEASURED reversal
   * of its own first authoring (36 hue bins / circular variance 0.944) and deleting it to save an entry
   * would discard that measurement and leave `'velocity'` needing a carrier anyway.
   */
  'dye.colourSource:palette':       { status: 'GATED' },
  /*
   * v8 28.4 — the sixth dye source, shipped with NO carrier preset deliberately.
   *
   * ⚠️ **THIS IS A DECISION ON RECORD, NOT A BACKLOG ITEM.** Authoring or retuning a library preset is an
   * OWNER decision (Phase 16's owner-decision list; `27.D5` restates it for appearance changes), and a
   * demonstration of `'ramp'` would have to be a NEW preset rather than an edit to an existing one — the
   * five visible dye presets all author a different source for reasons their own doc blocks measure.
   *
   * ⚠️ **PROMOTE THIS TO `GATED` THE MOMENT A CARRIER IS AUTHORED** — `coveragecheck` emits a note when an
   * EXEMPT member's live count reaches the floor, so the staleness is self-reporting rather than something
   * to remember. `Dye Palette Wake` is the precedent for how a dye source gets its carrier: the owner's own
   * export, one field changed from its neighbour.
   */
  // v8 28.18 — PROMOTED from EXEMPT to GATED: `Breathing Dye` is its carrier, authored on the owner's
  // authorisation (`28.D15`). ⚠️ **The exemption's own note predicted this and said the checker would
  // self-report** — it emits a note when an EXEMPT member's live count reaches the floor, which is what
  // turns a stale exemption into a visible one instead of a quiet lie.
  'dye.colourSource:ramp':          { status: 'GATED' },
  /*
   * v8 28.15 — the undimmed read of the figure's own colours. ⚠️ **EXEMPT, AND IT CANNOT BE CARRIED BY
   * `28.18`'s DEMO: one preset authors ONE `colourSource`**, and that preset carries `ramp` because the
   * banding is what it exists to show. A carrier for `figure` would be a second preset, which is a
   * separate owner decision — authoring a library preset is not the specifier's call.
   *
   * ⚠️ **It is also the member with the LEAST need of one: `figure` adds no code path at all.** It falls
   * through to the undimmed read that already served as the degrade for `temperature` with no
   * temperatures and `velocity` with no velocities, so the path is exercised by those two today.
   */
  'dye.colourSource:figure':        { status: 'EXEMPT', reason: 'v8 28.15 exposes a code path that already existed (the undimmed read of state.colors, the degrade for temperature-without-temps and velocity-without-velocities), so the PATH is exercised today even with no carrier. One preset authors one colourSource and 28.18 carries `ramp`; a carrier for `figure` is a second preset and therefore an owner decision.' },
  // ⚠️ **The three live gate sources, one body each, and `'none'` stays EXEMPT below as the identity member.**
  // The gate is a **lerp from 1**, so amount 0 is byte-identical to ungated and a source authored at amount 0 is
  // an inert key — all three bodies carry a non-zero amount. `'age'` is the only source that reads `halfLife`
  // (in seconds of particle AGE), and `'depth'` is the only one needing NO material, which is why
  // `Depth Gate Veil` has no material block at all: the absence is part of what it demonstrates.
  'forceGate.by:age':               { status: 'GATED' },
  'forceGate.by:temperature':       { status: 'GATED' },
  'forceGate.by:depth':             { status: 'GATED' },
  // ⚠️ `'none'` is the gate's IDENTITY value, and authoring it explicitly would be an inert authoring of exactly
  // the kind §F fails on. An enum's off-member is the one member coverage must NOT ask for.
  'forceGate.by:none':              { status: 'EXEMPT', reason: 'the identity/off member: `prepareGate` returns early on it, so authoring it is an inert key of the kind §F exists to catch (21.2).' },
  // ⚠ **v8 `32.8` ADDED THREE BLUR MEMBERS TO `refraction.source` AND NEEDED TWO EXEMPTIONS HERE;
  // `32.12` REMOVED THE MEMBERS, SO THE ROWS WENT WITH THEM.** The note worth keeping is the rule they
  // were written under: *if the levels are ever reported as visually indistinguishable the honest remedy
  // is to cut MEMBERS, not to author more presets* — and that is exactly what happened.
  'renderer.mode:pixel':            { status: 'EXEMPT', reason: '`renderer.mode` is the LEGACY-format field; the engine reads `overlay.renderMode` over it and §C gates the EFFECTIVE mode. A value unauthored here is not a gap.' },
  // `'renderer.mode:log-density'` was EXEMPT here; the member left the union on 2026-09-19 and the row with it.
  // ⚠️ The legacy INTEGER 3 still exists and `migration.ts` maps it to `'star'` — so there is nothing for a
  // row to exempt, and a `renderer.mode: 'log-density'` string in an imported body is now simply not a member.
  'renderer.mode:volume':           { status: 'EXEMPT', reason: 'as `renderer.mode:pixel` — see §C `mode:volume`, which carries the 21.8e attempt.' },
  // ⚠️ `Pixel Age Palette`, and the member is covered with **NO material anywhere in the body** — mapping 5
  // (`age`) is one of the mappings the renderer SYNTHESISES when `state.lifetimes` is absent, and only mapping 3
  // (`temperature`) degrades without its array. **Do not "fix" that preset by adding a material to feed it**,
  // and the reason is arithmetic rather than taste: `update()` does `lifes[i] += dtSec` for every particle
  // identically, so REAL lifetimes are uniform across the index and a material would give the whole figure one
  // colour cycling every 6 s. The per-index stagger exists only in the synth.
  // ⚠️ **TWO CORRECTIONS, 2026-09-20.** The mapping number above read "2", and the clause that stood here —
  // *"at `t = 0` every particle sits at the same phase and the preset reads as one flat colour, `21.D8`'s
  // `P11`, not a defect"* — was **explaining away the defect it was written beside.** The synth spreads
  // `fract(age/6)` across the whole ramp at EVERY clock phase including 0 (measured in `fieldcheck` §V), so a
  // flat figure was never this mapping's expected reading. What actually happened: `MaterialProcessor.init()`
  // is unconditional, so `state.lifetimes` was published as a full-length array of ZEROS and the synth's
  // presence guard never fired — every particle sampled LUT index 0, black on `Classic: thermal`. Fixed at the
  // publish site in `lissajous.ts`. **A "not a defect" note beside a symptom is a claim needing its own
  // measurement**, and this one had none.
  'paletteMapping:age':                  { status: 'GATED' },
  // ⚠️ **`'paletteMapping:index'` WAS COMMISSIONED HERE AND THE COMMISSION DISCHARGED ITSELF ON 2026-09-18, AS
  // DESIGNED.** 21.4d's migration adopts the library's own colour law as `overlay.paletteMapping: 'index'` on
  // 114 bodies, which made the COMMISSIONED row STALE — a FAILURE in this section — so the row was deleted in
  // the edit that landed the migration and the member is now an ordinary GATED one, covered by those 114.
  // **The mechanism is the point and the deletion is the receipt:** a commission that cannot go stale is a TODO
  // the checker can never collect. Do not re-add the row to "document" the history; §H's index seed is what
  // keeps the member measured, and this comment is the history.
  // ⚠️ `Inverse Refraction Pinch`, which authors the member together with `invert: true` (§E's row) — ONE preset
  // for the pair, per the owner's standing `21.6g` ruling that a step ships one preset and not a pair. The two
  // belong in one body because inverting a DENSITY-sourced refraction reads as the same picture dimmed, whereas
  // inverting a LUMINANCE-sourced one pinches the bright core, which is the visible half of `21.6h`.
  'refraction.source:luminance':         { status: 'GATED' },
};
/*
 * ⚠️ **SIX ROWS CAME OFF THIS LIST AT THE FIRST RUN TOO**, for the same reason as §C's four: `liquid.tintSource`
 * `'palette'`, `liquidField.seedPattern` `'cloud'` and `paletteMapping` `'velocity'`/`'temperature'`/`'position'`
 * were already authored, and `renderer.mode:liquid` needed no exemption. **The plan's `21.9` list of unused
 * members is therefore a 2026-09-17 figure, not a present state** — re-run this section before authoring against it.
 */
/**
 * Every path a row draws from — `paths` when it has several, else its single `path`.
 *
 * ⚠️ **ONE accessor, because a row shape with two spellings is a row shape two readers can disagree about**, and
 * this file has four readers of it (the rule, the source-shaped tripwire, the unobserved-path note and
 * `claimedPaths`). A reader that forgot `paths` would silently fall back to `undefined` and report the whole
 * vocabulary uncovered — a false gap wearing a real one's clothes.
 */
const pathsOf = (e) => e.paths ?? [e.path];

/**
 * The observed values for a row, SUMMED over its paths. A member authored at either path is authored.
 */
function observedFor(leaves, e) {
  const merged = new Map();
  for (const p of pathsOf(e)) {
    for (const [val, n] of leaves.strings.get(p) ?? new Map()) merged.set(val, (merged.get(val) ?? 0) + n);
  }
  return merged;
}

/**
 * The enum rule as a pure function over one row — the ONE implementation, rendered twice.
 *
 * ⚠️ **THIS FUNCTION WAS DEAD AND ITS OWN HEADER CLAIMED §H SEEDED IT (found 2026-09-18).** §D reported through
 * a second, inline copy of the same arithmetic, `enumViolations` had no caller, and §H seeded five rules of which
 * this was not one — so the enum rule was **uncalibrated while a comment said otherwise**, which is worse than an
 * absent seed: an unreachable assertion reads exactly like a passing one. The loop below now renders THESE
 * findings, and §H seeds this function, so one edit cannot make the reported rule and the seeded rule differ.
 */
function enumFindings(leaves, e, status) {
  const vocab = e.vocab ?? [];
  const seen = observedFor(leaves, e);
  const statusOf = (m) => status[`${e.id}:${m}`] ?? { status: 'GATED' };
  const uncovered = vocab.filter((m) => (seen.get(m) ?? 0) === 0);
  return {
    seen,
    uncovered,
    gatedGaps: uncovered.filter((m) => statusOf(m).status === 'GATED'),
    stale: vocab.filter((m) => (seen.get(m) ?? 0) > 0 && statusOf(m).status === 'COMMISSIONED'),
    badExempt: vocab.filter((m) => {
      const s = statusOf(m);
      return s.status === 'EXEMPT' && (!s.reason || s.reason.trim().length < 20);
    }),
  };
}

/** The whole section as violation strings, for §H to seed against. */
function enumViolations(leaves, enums, status) {
  const v = [];
  for (const e of enums) {
    if (!e.vocab || e.vocab.length === 0) { v.push(`${e.id}: vocabulary could not be DERIVED`); continue; }
    const f = enumFindings(leaves, e, status);
    for (const m of f.gatedGaps) v.push(`${e.id} = '${m}': authored by 0 presets`);
    for (const m of f.stale) v.push(`${e.id} = '${m}': ${f.seen.get(m)} preset(s) — COMMISSIONED ${status[`${e.id}:${m}`].step} is now STALE`);
    for (const m of f.badExempt) v.push(`${e.id} = '${m}': EXEMPT with no usable reason`);
  }
  return v;
}

/*
 * ⚠️ **THE TWO-FINDINGS NOTE THE DELETED SECOND COPY CARRIED, kept because it is the reason for the split
 * below.** A path spelled wrong here and a field no preset has ever authored both produce "not in the walk",
 * and reporting the second as the first sends the reader to fix a rename that did not happen — while reporting
 * the first as the second sends them to author a preset for a field that already exists. `isDeclared` separates
 * them: absent from the TYPES ⇒ the path is stale (a source-shaped failure); present in the types but not in the
 * walk ⇒ every member is at zero, which is a coverage finding and goes through the status table.
 */
/**
 * The SOURCE-SHAPED half of §D: the field a row names must still be declared somewhere in the types.
 *
 * ⚠️ **A TRIPWIRE, NOT A PROOF.** It tests the LEAF name only, so it cannot tell `DyeConfig.source` from
 * `RefractionConfig.source` — that is `blockUnionFrom`'s job, and this one exists purely so a row whose field
 * was RENAMED fails as a source-shaped defect instead of masquerading as a coverage gap.
 */
const TYPE_BLOB = typesTs + filmLooksTs + coreTs + rd('src/post-processors/trans-map-chain.ts');
const isDeclared = (path) => {
  const leaf = path.split('.').pop().replace('[]', '');
  return new RegExp(`\\n\\s*(readonly\\s+)?${leaf}\\??:`).test(TYPE_BLOB);
};
for (const e of ENUMS) {
  const paths = pathsOf(e);
  // ⚠️ EVERY path, not `paths[0]`: a row with two paths has two chances to be stale, and a merged row whose
  // SECOND path was renamed would keep passing on the strength of the first while silently counting nothing.
  chk(`${e.id}: vocabulary DERIVED (${e.vocab ? e.vocab.length : 0} members) and ${paths.map((p) => `\`${p}\``).join(' + ')} still name declared fields`,
    !!e.vocab && e.vocab.length > 0 && paths.every(isDeclared),
    'a failure on this line is SOURCE-SHAPED — the union moved or the field was renamed — and is a DIFFERENT '
    + 'finding from "no preset authors it", which the coverage line below reports');
  if (!e.vocab) continue;
  if (!paths.some((p) => LEAVES.strings.has(p))) {
    note(`${e.id}: declared but authored by NO preset at ${paths.join(' or ')} — every member is at zero, routed through the status table below`);
  }
  const f = enumFindings(LEAVES, e, ENUM_STATUS);
  chk(`...every member covered, or declared (${e.vocab.length - f.uncovered.length}/${e.vocab.length} authored)`,
    f.gatedGaps.length === 0 && f.stale.length === 0 && f.badExempt.length === 0,
    `undeclared gaps ${JSON.stringify(f.gatedGaps)}; stale commissions ${JSON.stringify(f.stale)}`
    + `; reasonless exemptions ${JSON.stringify(f.badExempt)}`);
}
/*
 * ⚠️ **THE BASIS'S OWN BLIND SPOT, REPORTED RATHER THAN ASSUMED AWAY.** Every categorical path the walk saw that
 * no row above claims is printed here — because a categorical field nobody enumerated is exactly the shape of the
 * 2026-09-18 defect, where a class the basis could not express was reported covered by silence.
 */
const claimedPaths = new Set([
  ...ENUMS.flatMap(pathsOf),
  // Claimed by ANOTHER section rather than unclaimed: §C gates the EFFECTIVE render mode, which is the
  // resolution of this field against the material — a §D row over it would be a second, weaker answer.
  'overlay.renderMode',
]);
const unclaimed = [...LEAVES.strings.entries()]
  .filter(([p, vals]) => !claimedPaths.has(p) && vals.size > 1 && vals.size <= 8
    && ![...vals.keys()].some((v) => v.length > 24 || /^#|^\d/.test(v)));
note(`${unclaimed.length} categorical-looking path(s) are claimed by no §D row (report only): `
  + unclaimed.slice(0, 12).map(([p, v]) => `${p}{${[...v.keys()].join('|')}}`).join('  '));

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== E. boolean-leaf coverage — paths DERIVED BY WALKING, never from a list (21.9) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **TWO FIGURES PER PATH, AND THEY ANSWER DIFFERENT QUESTIONS.** `true of present` — so `curlNoise.enabled`
 * 5 of 147 is a feature the library DECLINES, while `dye.enabled` 4 of 4 is a feature only four bodies mention.
 * A single `x of y` conflating them is what made `transMap.beforeParticles` read as "24 of 301 and healthy".
 */
const BOOL_STATUS = {
  // ⚠️ **PROMOTED 2026-09-20 by `Warp First Silhouette`, and it is the ONE promotion on this file that the RAW
  // COUNT WOULD ALREADY HAVE GRANTED — read the resolver, not the number.** **Measured 2026-09-20: `1 live of
  // 4 true`**, so the commission is discharged by the RESOLVED count going 0 → 1 while the raw count merely
  // gained one carrier. ⚠️ **The paragraph below says "8 bodies" and that is a 2026-09-18 figure over a
  // different library** — the `warpfirst` throwaways were removed at owner request and several settles rewrote
  // `beforeParticles: true → false` in their own bodies (`refined-presets.ts` records each rewrite). **Do not
  // reconcile the two numbers; re-run the section.** The RULE that paragraph states is unaffected.
  // ⚠️ **The flag exists at two sites
  // (`postProcessors.transMap.beforeParticles` and `overlay.transMapBeforeParticles`) with the overlay winning**,
  // so that body writes BOTH: authoring only the legacy one is how the eight inert carriers happened.
  // ⚠️ **Styles 8, 9 and 11 do not count toward `needsWarp`** — a "warp first" demo built on style 8 alone would
  // leave this row at 0 while looking authored. Per the owner's `21.6g` ruling, ONE preset ships, not a pair.
  'postProcessors.transMap.beforeParticles': { status: 'GATED' },
  // ⚠️ **PROMOTED 2026-09-20 by `Inverse Refraction Pinch`, the same body that discharges §D's
  // `refraction.source:luminance`** — see that row for why the pair belongs in one preset. This path has NO
  // resolver, so the row is the weaker `trueCount` form: it can see that a chain layer writes `invert: true`,
  // **not that the layer is live** (`21.6h`'s appeal claim is entirely outside it). ⏳ Verdict owed.
  'overlay.transMapChain[].refraction.invert': { status: 'GATED' },
  /*
   * v8 28.5 — ⚠️ **THE `true` LEAF IS EXERCISED BY ALMOST THE WHOLE LIBRARY AND AUTHORED BY NOBODY, WHICH
   * IS THE ONE SHAPE THIS SECTION'S RAW COUNT CANNOT SEE.** `showFigure` defaults to `true`, so every
   * preset that omits the key resolves to it live; the two bodies that DO carry the key are both dye
   * demos authoring `false`, because a visible figure is the default and needs no statement.
   *
   * ⚠️ **AUTHORING `showFigure: true` SOMEWHERE WOULD DISCHARGE THIS AND PROVE NOTHING** — it is a no-op
   * written into a preset body, and a diff touching authored preset values to add a no-op is the shape
   * under which a real retune hides. **The leaf is covered by the DEFAULT, not by a carrier.**
   *
   * ⚠️ **What WOULD deserve a carrier is a preset authoring `false` with the dye OFF**, i.e. the
   * configuration `28.D11`'s force-true makes unreachable — and that one must never exist.
   */
  'overlay.dye.showFigure': { status: 'EXEMPT', reason: 'the `true` leaf is the DEFAULT and resolves live on every preset that omits the key, so it is exercised library-wide while authored nowhere; the two bodies carrying the key are dye demos authoring `false`. Authoring `true` would write a no-op into a preset body, which is the shape under which a real retune hides.' },
  'overlay.growth.enabled': { status: 'EXEMPT', reason: 'growth is exempt by 21.D5 — Phase 9 mostly cut, Phases 10 and 12 HELD, and `overlay.growth` is import-only.' },
  /*
   * v8 `39.C` — the custom generator's two boolean leaves that its ONE library carrier (`Curve Rosette Chain`, a TWIST
   * subject) never sets true. ⚠️ Both are EXERCISED, by a measuring instrument rather than a body: authoring a
   * stretchable step or a mirrored frame into an unreviewed demo only to discharge a census would change the demo's
   * figure for no visual reason — the shape under which a real retune hides (this file's own `showFigure` note).
   */
  'generators.lsystem.custom.steps[].stretchable': { status: 'EXEMPT', reason: 'Stretch on a custom generator is the named rules\' Stretch with the mask as data; the library carrier of Stretch is the Plant (`Curve Breathing Thicket`), the editor seeds the Plant\'s mask (`figurecheck` §K2), and the one Customize demo is a Twist subject.' },
  'generators.lsystem.custom.frame.mirror': { status: 'EXEMPT', reason: 'a CAPTURED fact, not an authored choice: the frame is fitted when Customize is picked, and the Hilbert 2D and Peano seeds capture `mirror: true` (measured, `figurecheck` §K2 draws both through it); the demo was authored in the chord frame.' },
};
/*
 * ⚠️ **A `true` IS NOT AN ACTIVATION, AND THIS IS THE ONE PATH WHERE THE DIFFERENCE IS THE WHOLE FINDING.** The
 * walk can only see the VALUE, so `beforeParticles` reads as "true in 8 bodies" — and all 8 resolve with the warp
 * DISABLED, where the flag reorders a pass that never runs. Counting those 8 would have marked `21.6g` stale and
 * closed the gap it was commissioned to fill, which is the exact failure mode the 2026-09-18 widening was about:
 * **the census read something only because an inert authoring was indistinguishable from a live one.** Hence a
 * per-path resolver, applied INSTEAD of the raw `true` count, and `boolViolations` takes it as a parameter so §H
 * seeds the rule with it in place.
 */
const BOOL_RESOLVERS = {
  'postProcessors.transMap.beforeParticles': (r) =>
    (r.ov.transMapBeforeParticles ?? r.preset.postProcessors?.transMap?.beforeParticles ?? false) === true && r.needsWarp,
};
/** The boolean rule as a pure function. §H seeds it. */
function boolViolations(leaves, status, resolved = null, shipping = null) {
  const v = [];
  for (const [path, e] of leaves.booleans) {
    const s = status[path] ?? { status: 'GATED' };
    const resolver = BOOL_RESOLVERS[path];
    if (resolver && resolved && shipping) {
      const live = shipping.filter((n) => resolver(resolved.get(n))).length;
      if (s.status === 'GATED' && live === 0) v.push(`${path}: RESOLVED live on 0 of ${e.trueCount} bodies that set it true`);
      if (s.status === 'COMMISSIONED' && live > 0) v.push(`${path}: RESOLVED live on ${live} — COMMISSIONED ${s.step} is now STALE`);
      continue;
    }
    if (s.status === 'GATED' && e.trueCount === 0) v.push(`${path}: true in 0 of ${e.present} bodies that carry it`);
    if (s.status === 'COMMISSIONED' && e.trueCount > 0) v.push(`${path}: true in ${e.trueCount} — COMMISSIONED ${s.step} is now STALE`);
    if (s.status === 'EXEMPT' && (!s.reason || s.reason.trim().length < 20)) v.push(`${path}: EXEMPT with no usable reason`);
  }
  return v;
}
const boolPaths = [...LEAVES.booleans.keys()].sort();
chk(`${boolPaths.length} boolean leaf paths derived by WALKING the migrated bodies`, boolPaths.length >= 20,
  '⚠️ A hand-written path list is a third enumeration of a set that already exists twice, and the entry it omits '
  + 'is invisible exactly where it matters (21.9, the 2026-09-18 widening)');
const bv = boolViolations(LEAVES, BOOL_STATUS, RESOLVED, SHIPPING);
chk('every boolean leaf is true — and RESOLVED live where it has a resolver — on >= 1 shipping preset, or is declared',
  bv.length === 0, bv.join(' · '));
for (const p of boolPaths) {
  const e = LEAVES.booleans.get(p);
  const s = BOOL_STATUS[p]?.status ?? 'GATED';
  const r = BOOL_RESOLVERS[p];
  const live = r ? SHIPPING.filter((n) => r(RESOLVED.get(n))).length : null;
  const figure = r ? `${String(live).padStart(3)} live of ${String(e.trueCount).padEnd(3)} true` : `${String(e.trueCount).padStart(3)} of ${String(e.present).padEnd(4)}  `;
  console.log(`        ${(r ? live : e.trueCount) === 0 ? '·' : ' '} ${figure} ${p}${s === 'GATED' ? '' : `   [${s}${BOOL_STATUS[p].step ? ' ' + BOOL_STATUS[p].step : ''}]`}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== F. inert authorings — a key that states what the preset is NOT (21.2) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **Read these zeros differently from §C/§D/§E's.** A zero here means the TRAP WAS AVOIDED — a good result,
 * and the one this section exists to keep. A zero there means never demonstrated.
 */
function inertViolations(resolved, shipping) {
  const out = { splat: [], modifier: [], deadChain: [] };
  for (const n of shipping) {
    const r = resolved.get(n);
    if (r.splatWithNoMaterial) out.splat.push(n);
    if (r.inertModifiers.length > 0) out.modifier.push(`${n} (style ${r.inertModifiers.join(',')})`);
    if (r.deadChain) out.deadChain.push(n);
  }
  return out;
}
const INERT = inertViolations(RESOLVED, SHIPPING);
const listed = (xs) => (xs.length === 0 ? 'none' : xs.join(', '));
chk('0 presets author `splat` with no live material', INERT.splat.length === 0,
  `found ${INERT.splat.length}: ${listed(INERT.splat)}. ⚠️ **splat with no material draws NOTHING**, so main.ts `
  + 'falls back to `star` and such a preset has been rendering as `star` since the key was written. The fix is to '
  + 'REMOVE the inert `renderMode` key — never to add a material, which changes an accepted preset (21.2)');
chk('0 presets carry a weightless modifier with no field layer to modify', INERT.modifier.length === 0,
  `found ${INERT.modifier.length}: ${listed(INERT.modifier)}. Styles 8/9/11 are provably inert alone (P9)`);
chk('0 presets enable TransMap over a chain whose every layer is muted or weight-0', INERT.deadChain.length === 0,
  `found ${INERT.deadChain.length}: ${listed(INERT.deadChain)}`);

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== G. REPORT ONLY — gates nothing, by owner decision (21.D7) ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **NOT ASSERTIONS, AND THEY MAY NOT BECOME ONE.** The owner's ruling is *"a long list does no harm"*: an
 * unused palette, film look or attractor entry is inventory, not a defect, and `21.D1` forbids retrofitting the
 * legacy tail — so richness is a DESCRIPTION of the library, never a target.
 */
const bucketOf = (n) => {
  if (Object.prototype.hasOwnProperty.call(FIRE_PRESETS, n)) return 'fire';
  if (Object.prototype.hasOwnProperty.call(FLOW_PRESETS, n)) return 'flow';
  if (Object.prototype.hasOwnProperty.call(SHOWCASE_PRESETS, n)) return 'showcase';
  if (Object.prototype.hasOwnProperty.call(CHAIN_PRESETS, n)) return 'chain';
  if (Object.prototype.hasOwnProperty.call(DEMO_PRESETS, n)) return 'demo';
  if (VARIANT_PRESETS.some((v) => v.name === n)) return 'variant';
  if (n.endsWith(REFINED_SUFFIX)) return 'pending';
  if (Object.prototype.hasOwnProperty.call(REFINED_PRESETS, n)) return 'settled';
  return 'legacy';
};
/** The 16 notable subsystems of the richness figure. ⚠️ ITS OWN BASIS — never compared against an older histogram. */
const RICHNESS = ['physarum', 'liquidField', 'fluidAdvection', 'dye', 'buoyancy', 'sparks', 'crystals', 'cohesion',
  'curlNoise', 'forceField', 'forceGate', 'symmetryFold'];
const richnessOf = (r) => {
  let n = RICHNESS.reduce((a, id) => a + (FEATURES.find((f) => f.id === id).live(r) ? 1 : 0), 0);
  if (r.tmEnabled && r.liveStyles.length > 0) n++;
  if ((r.ov.attractorBlend ?? 0) > 0) n++;
  if (r.materialLive) n++;
  if (r.ov.customFilmLookParams?.bloomEnabled === true || r.preset.postProcessors?.bloom?.enabled === true) n++;
  return n;
};
const hist = new Map(), bucketSum = new Map(), bucketN = new Map();
for (const n of SHIPPING) {
  const k = richnessOf(RESOLVED.get(n));
  hist.set(k, (hist.get(k) ?? 0) + 1);
  const b = bucketOf(n);
  bucketSum.set(b, (bucketSum.get(b) ?? 0) + k); bucketN.set(b, (bucketN.get(b) ?? 0) + 1);
}
console.log(`        richness over 16 notable subsystems: ${[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k} -> ${v}`).join(' · ')}`);
console.log(`        mean per bucket: ${[...bucketSum.entries()].map(([b, s]) => `${b} ${(s / bucketN.get(b)).toFixed(2)}`).sort().join(' · ')}`);
const paletteNames = getAllPaletteNames().map(([v]) => v);
// ⚠️ **BOTH SOURCES, through the ONE resolver** (21.4c/21.4d — see its import above). Reading only the
// film-look path would report the nine `Cycle:` palettes as unused while 114 migrated bodies name one, and
// nothing would fail. `sel.name` is the resolved word and never `PALETTE_UNSET`; ⚠️ **`shaderPalette` would be
// the wrong field here** — it is `'none'` by construction under the `index` mapping, so it would report those
// same 114 bodies as palette-less a second way.
const paletteSelectionFor = (n) => {
  const ov = RESOLVED.get(n).ov;
  return resolvePaletteSelection(
    { palette: ov.palette, paletteMapping: ov.paletteMapping },
    ov.customFilmLookParams,
  );
};
const usedPalettes = new Set();
for (const n of SHIPPING) {
  const p = paletteSelectionFor(n).name;
  if (p && p !== 'none') usedPalettes.add(p);
}
const usedLooks = new Set(SHIPPING.map((n) => RESOLVED.get(n).ov.filmLook).filter(Boolean));
const usedAttractors = new Set(SHIPPING.map((n) => RESOLVED.get(n))
  .filter((r) => (r.ov.attractorBlend ?? 0) > 0 && r.ov.attractorIndex !== undefined)
  .map((r) => r.ov.attractorIndex));
console.log(`        palettes ${usedPalettes.size} of ${paletteNames.length} used · looks ${usedLooks.size} of ${Object.keys(FILM_LOOKS).length} `
  + `· attractor entries ${usedAttractors.size} of ${ATTRACTOR_PRESETS.length}`);
console.log(`        buckets: ${[...bucketN.entries()].map(([b, c]) => `${b} ${c}`).sort().join(' · ')}`);

/*
 * ⚠️ **OPT-IN (`--audit`) AND IT GATES NOTHING — `21.3`'s instrument, not a section.** The naming audit asks, per
 * demo/showcase/chain preset, *which feature does this teach and does its name say so*, and the first half of
 * that is a RESOLUTION — the same one §B owns. Writing it as a throwaway probe would have produced a second
 * resolver whose answers could drift from this file's, which is `21.D7`'s whole complaint about grepping. So it
 * lives here, behind a flag, outside `verify`: no assertion, no count, nothing that can turn the gate red.
 *
 * ⚠️ **The second half — "does the NAME say so" — is NOT mechanised and must not be.** A word-match would call
 * `Fluid Advection Demo` correct (it contains "Fluid"), which is the exact defect `21.2` renamed. The verdict is
 * the owner's, line by line (`21.3`'s Gate says so); this only lays out the evidence they need.
 */
if (process.argv.includes('--audit')) {
  console.log('\n=== 21.3 AUDIT (opt-in, gates nothing) — what each demo/showcase/chain preset ACTIVATES ===\n');
  const auditFeatures = FEATURES.filter((f) => !f.id.startsWith('mode:'));
  for (const bucket of ['demo', 'showcase', 'chain']) {
    console.log(`  --- ${bucket} ---`);
    for (const n of SHIPPING.filter((x) => bucketOf(x) === bucket)) {
      const r = RESOLVED.get(n);
      const live = auditFeatures.filter((f) => f.live(r)).map((f) => f.label ?? f.id);
      const extras = [];
      if ((r.ov.attractorBlend ?? 0) > 0) extras.push(`attractor:${r.ov.attractorIndex ?? '?'}`);
      if (r.materialLive) extras.push(`material:${r.ov.material.preset}`);
      if (r.ov.filmLook && r.ov.filmLook !== 'Customize') extras.push(`look:${r.ov.filmLook}`);
      const sel = paletteSelectionFor(n);
      if (sel.name && sel.name !== 'none') extras.push(`palette:${sel.name}/${sel.mapping}`);
      else if (sel.usesPresetQuadruple) extras.push(`palette:(preset colour)/${sel.mapping}`);
      console.log(`    ${n.padEnd(28)} mode=${r.effectiveMode.padEnd(11)} ${[...live, ...extras].join(', ') || '(nothing beyond the figure)'}`);
    }
  }
  console.log('');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== G2. status-table orphans — a row that names nothing asserts nothing ===\n');
// ═════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **WRITTEN BECAUSE THE `log-density` RETIREMENT (2026-09-19) EXPOSED THE GAP, NOT BECAUSE OF THE MODE.**
 * §C's features and §D's vocabularies are DERIVED from source declarations, and every status row is looked up
 * BY KEY against them (`STATUS[f.id]`, `status[`${e.id}:${m}`]`) — so a row whose subject leaves the source does
 * not fail, it stops being read. Two rows went that way in one edit: a `COMMISSIONED 21.8c` (a live TODO) and an
 * `EXEMPT` (a live excuse), both of which would have sat here forever reading exactly like rows that pass.
 *
 * ⚠️ **`BOOL_STATUS` IS DELIBERATELY NOT CHECKED HERE, AND THE ASYMMETRY IS THE POINT.** Its keys are paths
 * derived by WALKING THE LIBRARY, not from source: a path no body authors yet is legitimately absent from the
 * walk while its row waits for the preset that will author it. An orphan check over it would fail on exactly the
 * rows that are doing their job. The rule is only sound where the subject set comes from the CODE.
 */
const statusOrphans = Object.keys(STATUS).filter((k) => !FEATURES.some((f) => f.id === k));
chk(`every §C status row names a derived feature (${Object.keys(STATUS).length} rows over ${FEATURES.length} features)`,
  statusOrphans.length === 0,
  `orphaned row(s): ${statusOrphans.join(', ')} — the feature left \`RenderMode\`/\`TRANS_MAP_STYLES\`/the FEATURES `
  + 'list and the row stopped being read; DELETE it (the deletion is the receipt) or restore the subject');
const enumKeys = new Set(ENUMS.flatMap((e) => (e.vocab ?? []).map((m) => `${e.id}:${m}`)));
const enumOrphans = Object.keys(ENUM_STATUS).filter((k) => !enumKeys.has(k));
chk(`every §D status row names a member of a DERIVED vocabulary (${Object.keys(ENUM_STATUS).length} rows over ${enumKeys.size} members)`,
  enumOrphans.length === 0,
  `orphaned row(s): ${enumOrphans.join(', ')} — the union lost the member (or the row's \`id\` no longer matches a `
  + "§D row's), so the row names nothing; a GATED member reads as covered by silence");
// ⚠️ Seeded, or this section is the very thing it warns about: an assertion nothing can reach.
{
  const brokenStatus = { ...STATUS, 'mode:ectoplasm': { status: 'COMMISSIONED', step: '99.9' } };
  const brokenEnum = { ...ENUM_STATUS, 'crystal.shape:trapezoid': { status: 'GATED' } };
  chk('...calibrated: a row for a retired feature and one for a retired enum member are both caught',
    Object.keys(brokenStatus).filter((k) => !FEATURES.some((f) => f.id === k)).length === 1
    && Object.keys(brokenEnum).filter((k) => !enumKeys.has(k)).length === 1,
    'the seeds are the two real shapes: `mode:log-density` (a feature id that left a DERIVED list) and '
    + '`renderer.mode:log-density` (a member that left a DERIVED union)');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== H. calibration — every rule class seeded into a FIXTURE copy and shown to fail ===\n');
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
/*
 * ⚠️ **NO `src/` EDIT, EVER** — `deadcheck` counts `src` files and nothing may be added there for the harness's
 * benefit. Each seed clones the composed library, breaks one thing, and re-runs the rule as a pure function.
 */
const fixture = () => new Map([...LIB].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));

// 1. FLOOR RULE. Silence a covered feature everywhere and confirm its floor fails.
{
  const lib = fixture();
  for (const p of lib.values()) if (p.overlay?.sparks) p.overlay.sparks.enabled = false;
  const r = resolveAll(lib);
  const ship = [...lib.keys()].filter((n) => !scaffoldNames.has(n));
  seed('floor rule: `sparks.enabled` false in every body',
    floorViolations(r, ship, FEATURES.filter((f) => f.id === 'sparks'), STATUS).length,
    'the floor assertion cannot see a feature falling to zero');
}
// 2. INERT-AUTHORING RULE. Author `splat` with no material — `21.2`'s own defect, re-seeded.
{
  const lib = fixture();
  const victim = SHIPPING[0];
  const p = lib.get(victim);
  p.overlay = { ...(p.overlay ?? {}), renderMode: 'splat' };
  delete p.overlay.material;
  seed(`inert rule: \`renderMode: 'splat'\` with no material on "${victim}"`,
    inertViolations(resolveAll(lib), [...lib.keys()]).splat.length,
    '⚠️ this is 21.2\'s live defect — a seed that passes here means the checker could not have found it');
}
// 3. INERT-MODIFIER RULE. A lone weightless layer, which `isInertModifier` calls inert (P9).
{
  const lib = fixture();
  const victim = SHIPPING[0];
  const p = lib.get(victim);
  p.overlay = { ...(p.overlay ?? {}), transMapEnabled: true, transMapChain: [{ style: 8, enabled: true, weight: 1 }] };
  p.postProcessors = { ...(p.postProcessors ?? {}), transMap: { ...(p.postProcessors?.transMap ?? {}), enabled: true } };
  seed(`inert-modifier rule: a lone style-8 layer on "${victim}"`,
    inertViolations(resolveAll(lib), [...lib.keys()]).modifier.length,
    'a weightless modifier with no field layer is provably inert and must be reported, not counted as coverage');
}
// 4. EXEMPT-LIST RULE. An exemption with no reason is not a decision on record.
{
  const broken = { ...STATUS, growth: { status: 'EXEMPT', reason: '' } };
  seed('exempt-list rule: an EXEMPT entry whose reason string is empty',
    floorViolations(RESOLVED, SHIPPING, FEATURES.filter((f) => f.id === 'growth'), broken).length,
    'an undeclared zero and a declared one must be different states (21.D7)');
}
// 5. BOOLEAN-LEAF RULE. ⚠️ The plan's seed (flip `21.6h`'s `refraction.invert` back to false) presupposes 21.6h
//    has landed; today that path is at zero and already COMMISSIONED. The seed available NOW is the same rule
//    from the other side: silence a boolean that IS covered and confirm the walk reports it.
{
  const lib = fixture();
  for (const p of lib.values()) if (p.overlay?.buoyancy) p.overlay.buoyancy.enabled = false;
  const ship = [...lib.keys()].filter((n) => !scaffoldNames.has(n));
  seed('boolean-leaf rule: `overlay.buoyancy.enabled` false in every body that carries it',
    boolViolations(walkLeaves(lib, ship), BOOL_STATUS).filter((v) => v.startsWith('overlay.buoyancy.enabled')).length,
    '⚠️ A SEED WHOSE SUBJECT WAS DELETED READS EXACTLY LIKE A PASSING SEED — when 21.6h lands, re-point this at '
    + '`refraction.invert` as the plan specifies');
}
// 6. SCAFFOLD-EXCLUSION RULE — the one the others cannot reach. ⚠️ Its natural fixture was DELETED on
//    2026-09-18 with the 14 `" warpfirst"` copies, so the seed must ADD a suffixed throwaway that is the ONLY
//    carrier of an uncovered feature and confirm the checker still reports the feature uncovered.
{
  const lib = fixture();
  const donor = JSON.parse(JSON.stringify(LIB.get(SHIPPING[0])));
  donor.overlay = { ...(donor.overlay ?? {}), transMapEnabled: true,
    transMapChain: [{ style: 5, enabled: true, weight: 1 }, { style: 8, enabled: true, weight: 1 }] };
  donor.postProcessors = { ...(donor.postProcessors ?? {}), transMap: { ...(donor.postProcessors?.transMap ?? {}), enabled: true } };
  lib.set('Seeded Throwaway warpfirst', donor);
  const r = resolveAll(lib);
  const shipWith = [...lib.keys()].filter((n) => !SCAFFOLDS.some((s) => n.endsWith(s.suffix)));
  const shipNaive = [...lib.keys()];
  const style8 = FEATURES.filter((f) => f.id === 'tmstyle:8');
  const honest = countFeature(r, shipWith, style8[0]);
  const naive = countFeature(r, shipNaive, style8[0]);
  seed('scaffold-exclusion rule: a " warpfirst" throwaway is the only carrier of style 8',
    naive > honest ? 1 : 0,
    `honest ${honest}, naive ${naive} — the suffix exclusion is doing nothing, so a throwaway would be counted `
    + 'as coverage and the floor would go quiet exactly when the scaffold was deleted (21.6g)');
}

// 7. ENUM-MEMBER RULE — **the rule §D reports with, and it was UNSEEDED until 2026-09-18** while
//    `enumViolations`' own header said otherwise (see that function). Two seeds, because §D's two halves fail
//    differently and a merged row gave the second half somewhere new to hide:
//
//    (a) silence a COVERED member everywhere and confirm the gap is reported — the coverage half;
//    (b) drop the SECOND path of the merged `paletteMapping` row and confirm a member authored only there stops
//        being counted. Without (b), a row that quietly lost a path would keep passing on the first path's
//        strength, which is the false-gap direction: the checker wrong about the library, not the library wrong.
{
  /*
   * ⚠️ **"EVERYWHERE" MEANS EVERY PATH THE ROW READS, AND THIS SEED HAND-WROTE ONE OF THE TWO UNTIL
   * 2026-09-19.** It silenced `overlay.customFilmLookParams.paletteMapping` only, which worked for exactly as
   * long as no preset authored `'depth'` at the grading-free path — `Aizawa Torus Shell` (the `21.7` cohort)
   * then did, the member stayed legitimately covered, and the seed reported NOT CAUGHT. **A partially-applied
   * seed is the same failure as a partially-applied gate**: it exonerates the rule on a library that was never
   * actually silenced. So the paths come from `pathsOf(row)` now, and a path shape the setter cannot reach
   * THROWS rather than being skipped — an under-silenced seed must never read as a caught one.
   */
  const lib = fixture();
  const row = ENUMS.filter((e) => e.id === 'paletteMapping');
  let silenced = 0;
  for (const path of pathsOf(row[0])) {
    if (path.includes('[]')) throw new Error(`seed 7(a) cannot set through an array segment: ${path}`);
    const segs = path.split('.');
    for (const p of lib.values()) {
      let o = p;
      for (const s of segs.slice(0, -1)) o = o?.[s];
      const leaf = segs[segs.length - 1];
      if (o && o[leaf] === 'depth') { o[leaf] = 'phase'; silenced++; }
    }
  }
  const ship = [...lib.keys()].filter((n) => !scaffoldNames.has(n));
  seed(`enum-member rule: \`paletteMapping: 'depth'\` rewritten away in ${silenced} body/bodies`,
    enumViolations(walkLeaves(lib, ship), row, ENUM_STATUS).filter((v) => v.includes("'depth'")).length,
    'the enum rule cannot see a GATED member falling to zero — which is the entire purpose of §D');
}
{
  /*
   * THE ROW'S OWN BASIS, WHICH IS THE ONE THING NO LIBRARY MUTATION CAN SEED — ⚠️ **and the seeded defect here
   * is the ROW SHAPE, not a preset.** 21.4d's migration authors `paletteMapping: 'index'` at the OVERLAY path
   * and nowhere else, so the library as composed is already the fixture: a row reading only
   * `overlay.customFilmLookParams.paletteMapping` reports `'index'` as *authored by 0 presets* while 114 bodies
   * carry it, and a merged row reports nothing. **That FALSE GAP is the defect**, it is the one the widening was
   * written for, and it is invisible to every seed that edits a preset — mutate the library and both row shapes
   * move together. So the mutation is applied to the ROW and the real library is the control.
   *
   * ⚠️ The comparison is two-sided on purpose. `caughtNarrow > 0` alone would pass if the narrow row were
   * reporting something else entirely, and `caughtMerged === 0` alone would pass if the vocabulary had failed to
   * derive. Both together say exactly one thing: the second path is load-bearing.
   */
  const ship = [...LIB.keys()].filter((n) => !scaffoldNames.has(n));
  const leaves = walkLeaves(LIB, ship);
  const merged = ENUMS.filter((e) => e.id === 'paletteMapping');
  const firstPathOnly = merged.map((e) => ({ ...e, paths: [pathsOf(e)[0]] }));
  /*
   * ⚠️ **THE MEMBER IS DERIVED, NOT NAMED (v8 Phase 38, 2026-11-10).** This seed used to hard-code `'index'`, on the
   * library FACT that `index` was authored at the overlay path and nowhere else. Phase 38's demos author it inside a
   * `Customize` look too (a look's own palette outranks the overlay's), so that fact ended — and a seed whose fixture
   * is a coincidence of library content is the fragile basis this file warns about. The property is unchanged:
   * **some member is authored ONLY at the second path**, so the narrow row calls it uncovered and the merged row
   * does not. That member is now computed from the library on every run.
   */
  const members = (vs) => new Set(vs.flatMap((v) => [...v.matchAll(/'([^']+)'/g)].map((m) => m[1])));
  const narrowSet = members(enumViolations(leaves, firstPathOnly, ENUM_STATUS));
  const mergedSet = members(enumViolations(leaves, merged, ENUM_STATUS));
  const onlySecond = [...narrowSet].filter((m) => !mergedSet.has(m));
  seed(`enum-member rule: a row over the OLD path alone calls a second-path-only member uncovered (${onlySecond.join(', ') || 'none'})`,
    onlySecond.length,
    'no member is authored only at the second path, so the two paths are not distinct and the merge asserts nothing '
    + '— or the vocabulary failed to derive; read which before believing the library');
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  coveragecheck: ${pass} passed, ${fail} failed, ${notes} note(s)\n`);
process.exit(fail === 0 ? 0 : 1);
