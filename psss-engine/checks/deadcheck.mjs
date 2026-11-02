#!/usr/bin/env node
/**
 * deadcheck — the things Batch G deleted must stay deleted, and must stay deleted for the RIGHT REASON.
 *
 * Why this file exists at all. Batch G removed six dead code paths on 2026-08-10. Every one of them had
 * been dead for months without anyone noticing, because nothing in the toolchain can see the difference
 * between "this exists and runs" and "this exists and is never reached":
 *
 *   - `tsc` type-checks a compiled program and a never-drawn program identically.
 *   - `vite build` happily bundles a shader with zero draw calls.
 *   - the five GL checkers all reason about code that IS reached — they check shaders, samplers, VAOs,
 *     buffer lengths and blend state. A resource nobody binds satisfies all of them trivially.
 *
 * So the risk this guards is regrowth: someone re-adds `flameAccumFBO` "for later", or reinstates
 * `TransMap.resize()` because it looks like an obvious missing method, and the next audit re-discovers
 * the same waste from scratch. The triage's own record shows this is not hypothetical — four prior
 * "unused" findings were WRONG on re-grep, in both directions, which is exactly why the reasoning is
 * asserted here in executable form rather than left in a comment.
 *
 * ⚠️ The assertions target the REASON, not the name. Each one checks the condition that made the code
 * dead (no draw call, no caller, no reader), so it fails if the code comes back LIVE — which is a
 * legitimate change that should then be reviewed — and stays quiet if it comes back correctly wired.
 * A test that merely greps for an absent identifier would pass forever while telling you nothing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(root, p), 'utf8');

let failures = 0;
const fail = m => { console.error(`  FAIL  ${m}`); failures++; };
const pass = (m, why) => console.log(`  PASS  ${m}${why ? `   ${why}` : ''}`);

// Count occurrences of a needle across the whole of src/, so an assertion cannot be defeated by moving
// the code to another file — which is the realistic regrowth path for a resource like an FBO.
const srcFiles = execSync('git ls-files -co --exclude-standard src', { cwd: root, encoding: 'utf8' })
  .split('\n').map(s => s.trim()).filter(s => s.endsWith('.ts'));
const allSrc = srcFiles.map(f => rd(f)).join('\n');
// Comments are where the tombstones live; strip them so a tombstone mentioning a deleted name does not
// read as the name being back in use.
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const code = stripComments(allSrc);

console.log('=== deadcheck: Batch G deletions must not regrow ===');

// ---- G2/G3: the flame accumulation pipeline --------------------------------------------------
// Dead because Phase 6B shipped `splat` as DIRECT additive rendering to the main FBO. The FBO was
// created and resized, the resolve program was compiled, and neither was ever used in a draw.
{
  const names = ['flameAccumFBO', 'flameAccumTex', 'flameResolveProgram', 'flameResolveVao',
                 'FLAME_RESOLVE_VERT_SRC', 'FLAME_RESOLVE_FRAG_SRC'];
  const back = names.filter(n => code.includes(n));
  if (back.length === 0) {
    pass('the flame accumulation pipeline is gone', 'no FBO, texture, program, VAO or shader source');
  } else {
    // Regrowth is allowed IF it is actually wired: a resolve program must reach a draw call.
    const hdr = stripComments(rd('src/renderers/hdr-particle.ts'));
    const bindsAccum = /bindFramebuffer\([^)]*flameAccum/.test(hdr);
    const drawsResolve = /flameResolveVao[\s\S]{0,400}?gl\.draw(Arrays|Elements)/.test(hdr);
    if (bindsAccum && drawsResolve) {
      pass('flame accumulation is back but is WIRED', 'binds the FBO and draws the resolve pass');
    } else {
      fail(`flame accumulation regrew WITHOUT being wired (${back.join(', ')}) — `
         + `bindsAccumFBO=${bindsAccum} drawsResolvePass=${drawsResolve}. `
         + `This is what was deleted: resources created at init with zero draw calls.`);
    }
  }
}

// ---- G5: TranslationMapProcessor.resize() ----------------------------------------------------
// Dead because the ONLY resize path (`resizeAll` in main.ts) does dispose() + initTransMap(), which is
// deliberate: it preserves LIVE overlay style/enabled/ifsParams instead of reverting to the preset's
// stored block. It was also wrong — it rebuilt the displacement texture with no style gate, so styles
// 4/5/6 paid a large allocation for a map they never sample.
{
  const tm = stripComments(rd('src/post-processors/trans-map.ts'));
  const hasResize = /^\s{2}resize\s*\(/m.test(tm);
  if (!hasResize) {
    pass('TranslationMapProcessor.resize() is gone', 'resizeAll() uses dispose()+initTransMap()');
  } else {
    // If it is reinstated it MUST gate the displacement build by style, since buildDisplacementTexture's
    // switch only has cases for styles 0-3.
    const body = tm.slice(tm.search(/^\s{2}resize\s*\(/m));
    const end = body.indexOf('\n  }');
    const resizeBody = body.slice(0, end < 0 ? 600 : end);
    const builds = resizeBody.includes('buildDisplacementTexture');
    const gated = /style\s*[<=!]==?\s*[0-6]|style\s*<\s*4/.test(resizeBody);
    if (!builds || gated) {
      pass('TranslationMapProcessor.resize() is back but gates the displacement build');
    } else {
      fail('TranslationMapProcessor.resize() rebuilds the displacement texture with NO style gate. '
         + 'buildDisplacementTexture() has cases for styles 0-3 only, so styles 4/5/6 allocate '
         + 'Int32Array(w*h) + Float32Array(w*h*4) + an RGBA32F upload (~74 MB at 1080p) for an '
         + 'all-zero map they never sample. Copy the gating in init().');
    }
  }
}

// ---- H7: LissajousGenerator.getPositionsForFluidSeed() ---------------------------------------
// Dead because the fluid sim wants normalised UVs and velocity UVs with the crystal block excluded,
// which main.ts builds itself before calling seedFromParticles(). Model positions were the wrong shape.
{
  if (!code.includes('getPositionsForFluidSeed')) {
    pass('getPositionsForFluidSeed() is gone', 'main.ts builds UVs and calls seedFromParticles()');
  } else {
    fail('getPositionsForFluidSeed() regrew. It returned `this.positions.slice()` — MODEL space, and '
       + 'INCLUDING the crystal block, which has no trajectory. The fluid field needs normalised UVs '
       + 'with `n = state.count - crystalCount`. Use getState().positions if a copy is not wanted.');
  }
}

// ---- G8: the always-empty `fields` preset block ----------------------------------------------
// Dead because it was reserved for a force-field registry that was never built. 14 writes, 0 reads.
{
  const declared = /^\s*fields\s*:\s*\{/m.test(stripComments(rd('src/presets/types.ts')));
  const literals = (code.match(/fields:\s*\{\s*active:/g) ?? []).length;
  if (!declared && literals === 0) {
    pass('the `fields` preset block is gone', 'was required, written at 14 sites, read at 0');
  } else if (declared) {
    // Reinstating it is fine only if something reads it.
    const reads = /\.fields\.active/.test(code);
    if (reads) pass('`fields` is back and is READ');
    else fail('`fields` regrew in UnifiedPreset with no reader. It was deleted precisely because being '
            + 'REQUIRED forced every new preset literal to carry a meaningless line while advertising a '
            + 'capability that does not exist. Make it optional, or wire a reader.');
  } else {
    fail(`${literals} \`fields: { active: ... }\` literal(s) remain but the type no longer declares it.`);
  }
}

// ---- G9: the empty shaders/ directory and the fields/ stub -----------------------------------
{
  const shaders = existsSync(join(root, 'src/renderers/shaders'));
  const fieldsDir = existsSync(join(root, 'src/fields'));
  if (!shaders && !fieldsDir) {
    pass('src/renderers/shaders/ and src/fields/ are gone', 'all GLSL is inline in template literals');
  } else {
    // A shaders/ directory is legitimate — but only if it actually holds shaders.
    if (shaders) {
      const files = execSync('git ls-files -co --exclude-standard src/renderers/shaders', { cwd: root, encoding: 'utf8' })
        .split('\n').filter(s => s.trim());
      if (files.length > 0) pass(`src/renderers/shaders/ is back with ${files.length} file(s)`);
      else fail('src/renderers/shaders/ exists and is EMPTY again.');
    }
    if (fieldsDir) {
      const idx = join(root, 'src/fields/index.ts');
      const isStub = existsSync(idx) && stripComments(rd('src/fields/index.ts')).trim() === '';
      if (isStub) fail('src/fields/index.ts is a comment-only stub again (was: "// Force field '
                     + 'implementations will register here (Phase 4)"), and nothing imports it.');
      else pass('src/fields/ is back with real content');
    }
  }
}

// ---- G7: write-only ExplorationState fields --------------------------------------------------
// Dead because each tab owned the authoritative copy. 7 assignments, 0 reads. `evolutionGeneration`
// also aliased the tab's live array BY REFERENCE, so a reader would have seen it mutate underneath.
{
  const names = ['crossfaderPosition', 'evolutionSeeds', 'evolutionGeneration'];
  const back = names.filter(n => code.includes(n));
  if (back.length === 0) {
    pass('write-only ExplorationState fields are gone', 'tabs own the authoritative copies');
  } else {
    // Regrowth is fine only if something READS them — i.e. an occurrence that is not an assignment.
    const unread = back.filter(n => {
      const uses = [...code.matchAll(new RegExp(`\\b${n}\\b[^\\n]*`, 'g'))].map(m => m[0]);
      const nonDecl = uses.filter(u => !new RegExp(`^\\s*${n}\\s*[:=]`).test(u.trim()));
      return nonDecl.every(u => new RegExp(`\\.${n}\\s*=`).test(u));
    });
    if (unread.length === 0) pass(`ExplorationState field(s) back and READ: ${back.join(', ')}`);
    else fail(`write-only ExplorationState field(s) regrew: ${unread.join(', ')}. A mirror a tab can `
            + `forget to update is worse than no shared state; put it behind a method with an event, `
            + `like pushSnapshot(). Note evolutionGeneration was assigned BY REFERENCE.`);
  }
}

// ---- G12: statistics collected but never read ------------------------------------------------
// `jitter()` is the sole reader of paramRanges. Anything collected that it never looks up is waste;
// anything it looks up that is NOT collected is worse — the mutation silently does nothing.
{
  const stats = stripComments(rd('src/exploration/preset-stats.ts'));
  const rnd = stripComments(rd('src/exploration/randomize.ts'));

  // Literal keys collected, and literal keys requested. Template-literal families (wave*, color*,
  // rotation*) are excluded from both sides: they are generated by identical loops in both files, so a
  // string comparison would produce false mismatches rather than real ones.
  const collected = new Set([...stats.matchAll(/collect\(samples,\s*'([^']+)'/g)].map(m => m[1]));
  const requested = new Set([...rnd.matchAll(/jitter\([^,]+,\s*'([^']+)'/g)].map(m => m[1]));

  // ⚠️ "Collected but unread" splits into two classes, and only one of them is a defect. G12's three
  // (`bloom.threshold`, `bloom.intensity`, `toneMap.exposure`) targeted the DEAD
  // `postProcessors.bloom`/`toneMap` blocks, which no renderer consults — grading comes solely from
  // `FilmLookParams` (ADR 007) — so a range built from them could only ever have driven mutation of
  // parameters with no visual effect. Deleting the collection was unambiguously right.
  //
  // These three are different: they describe parameters that ARE live, so the range is correct and the
  // gap is on the Randomiser's side — it simply does not mutate them yet. Deleting the collection would
  // be the wrong direction, since a future `jitter()` call needs the range to exist or it is inert (see
  // the `missing` assertion below). Held as an allow-list so the check still catches a NEW dead-target
  // collection, which is what G12 was actually about.
  //
  // ⚠️ **RE-BASED 2026-10-06 (v8 `24.3`, `24.D7`): THIS LIST WAS THREE ENTRIES AND IS NOW ONE.**
  // `renderer.blurRadius` and `renderer.depthSize` are jittered by `applyGaussianJitter` as of Phase 24,
  // so they now fail the `!requested.has(k)` test and must NOT be allow-listed — an entry for a key that
  // IS read costs nothing today but makes the list unreadable as a record of what is still owed. Their
  // old annotation is kept below because it is what justified wiring them: the allow-list had already
  // named their readers, so the ranges were known-good and the gap was on the Randomiser's side.
  //
  //   renderer.blurRadius — WIRED 2026-10-06. Read by main.ts (gates the blur pass at > 0) and by every
  //                         tile renderer.
  //   renderer.depthSize  — WIRED 2026-10-06. Read as `uDepthSize` in both the point and splat vertex
  //                         shaders.
  //   renderer.streaks    — ⚠️ collected, interpolated, migrated from `VisualFx.Streaks` and carried by
  //                         every preset, but read by NO renderer or shader: there is no `uStreaks` and
  //                         no `this.streaks`. It is an inert preset field, and therefore the one entry
  //                         here that is genuinely suspect. Left in place deliberately: 177 legacy
  //                         presets carry it and it is part of the on-disk format, so removing it is a
  //                         format change rather than a dead-code deletion, and belongs in its own item.
  //                         ⚠️ **AND IT IS DELIBERATELY NOT WIRED (`24.D7` asked for five keys and got
  //                         four).** Measured 2026-10-05: `streaks` is **0 on all 274 presets**, so its
  //                         collected range is a single point and `jitter()` through it is arithmetically
  //                         guaranteed to return the value unchanged. Wiring it would add a call site
  //                         that appears to mutate and cannot — the exact defect class Phase 24 removes.
  const UNREAD_OK = new Set(['renderer.streaks']);

  const unread = [...collected].filter(k => !requested.has(k) && !UNREAD_OK.has(k));
  const missing = [...requested].filter(k => !collected.has(k));

  if (unread.length === 0) {
    pass('no statistic is collected for a parameter that is both unread and dead',
         `${UNREAD_OK.size} unread-but-live keys allow-listed`);
  } else {
    fail(`collected but never read: ${unread.join(', ')}. G12 removed bloom.threshold, `
       + `bloom.intensity and toneMap.exposure for this — those targeted the DEAD `
       + `postProcessors.bloom/toneMap blocks, so they could only ever have driven mutation of `
       + `parameters with no visual effect (grading comes solely from FilmLookParams, ADR 007). If the `
       + `new key DOES describe a live parameter, add it to UNREAD_OK with the reader named.`);
  }

  if (missing.length === 0) {
    pass('every literal key jitter() requests is collected', 'a missing range makes the mutation INERT');
  } else {
    fail(`jitter() requests ranges that are never collected: ${missing.join(', ')}. `
       + `jitter() returns the value UNCHANGED when the range is absent, so these mutations are `
       + `silently inert while appearing to work — the more harmful mirror of G12. This is exactly how `
       + `overlay.curlNoise.turbulence/scale were found dead on 2026-08-10.`);
  }
}

// ---- G13: the spread-argument reduction ------------------------------------------------------
// NOT a crash fix. `n` is bounded by the library size (177) against a V8 limit near 124 000. Asserted
// so the claim in the triage cannot be re-inflated into a "latent RangeError" by a later reader.
{
  const stats = stripComments(rd('src/exploration/preset-stats.ts'));
  if (/Math\.(min|max)\(\.\.\./.test(stats)) {
    fail('preset-stats.ts uses Math.min/max(...values) again. Reachability aside — one sample per '
       + 'preset per key means n <= 177, far below the ~124k spread limit, so this is NOT the latent '
       + 'crash the triage called it — the single-pass loop also removes two extra walks per key.');
  } else {
    pass('preset-stats.ts reduces in a single pass', 'not a crash fix: n <= 177 by construction');
  }
}

// ---- G14: the dye field --------------------------------------------------------------------------
// The largest dead path found so far, and the one Batch G MISSED. `injectDye`, `advectDye` and
// `renderDyeOverlay` had zero callers anywhere in src/, yet `overlay.dye` was a persisted preset block
// and the Visual FX tab shipped four fully-wired controls for it — so ticking Enable really did allocate
// 13 GL objects (3 programs, 1 VAO, 3 buffers, 2 FBOs, 2 textures, and 6 uniform locations) to draw
// nothing. It survived Batch G because every deadcheck assertion above targets a path the extraction had
// already named; none of them asks the general question "does this exported method have a caller?".
//
// ⚠️ TWO directions, and both matter. The IMPLEMENTATION must stay gone unless it is wired into the
// frame loop; the CONFIG TYPE must stay present, because `overlay.dye` may exist in a user's exported
// preset and removing the field from OverlayState would make those imports fail to type-check. This is
// the `GrowthConfig` precedent: format compatibility outlives the feature.
//
// ⚠️ **RE-BASED 2026-09-03 FOR v8 STEP 15.7, WHICH IS THE FIELD COMING BACK CORRECTLY WIRED.** The section as
// first written asserted the *pre-deletion architecture* rather than the property it meant to protect: it
// looked for `injectDye`/`renderDyeOverlay` called on the FLUID processor from `main.ts`, and for
// `FluidAdvectionProcessor.init()` re-entering `initDye()`. Both are things the rebuild was explicitly required
// NOT to do — the deletion's own note says *"build it as its own render pass"*, and `fluid-advection.ts`'s H12
// note says a fixed-size field must have no `resize()` to forget. So the original assertion **failed on
// correct code**, which is the ninth-plus instance of this checker family's own basis being the defect
// (`CLAUDE.md`'s measuring bullet). ⚠️ **The lesson is the general one: an assertion keyed to WHERE code lives
// fails the moment the code is moved for a good reason. Key it to the PROPERTY** — here, "every allocated pass
// reaches a per-frame call site", which is architecture-independent and is what G14 actually found violated.
//
// The resize half is not dropped, it is RELOCATED to H12's section below (which already asserts the
// no-resize-needed property for fluid and physarum, and now for dye too) — because that is where the property
// now lives, not because it stopped mattering.
{
  // The OLD implementation's names. These must stay gone unconditionally: they name methods on
  // `FluidAdvectionProcessor`, and the rebuild does not use that class at all.
  const oldImpl = ['injectDye', 'advectDye', 'renderDyeOverlay', 'initDye', 'disposeDye',
                   'dyeTexA', 'dyeTexB', 'dyeFboA', 'dyeFboB', 'dyeInitialized'];
  const oldBack = oldImpl.filter(n => code.includes(n));
  // The NEW owner. Present = the field is rebuilt; absent = it is still deleted. Both are legitimate states,
  // so the test is conditional rather than an equality.
  const hasOwner = existsSync(join(root, 'src/post-processors/dye-field.ts'));

  if (oldBack.length > 0) {
    fail(`the PRE-DELETION dye implementation regrew (${oldBack.join(', ')}). These are methods and handles on `
       + `FluidAdvectionProcessor, and that is the architecture G14 deleted: three draw passes buried among `
       + `four live subsystems, with zero callers. v8 15.7 rebuilt the field as its own pass in `
       + `src/post-processors/dye-field.ts — extend THAT, never re-add these.`);
  } else if (!hasOwner) {
    pass('the dye field implementation is gone', '3 draw passes with 0 callers, 13 GL objects allocated');
  } else {
    // Rebuilt. The property to assert is the one G14 found violated — allocation with no per-frame caller —
    // and it takes three checks because the field has three distinct ways to be dormant.
    const mainSrc = stripComments(rd('src/main.ts'));
    const dye = stripComments(rd('src/post-processors/dye-field.ts'));
    // 1. The two per-frame passes are CALLED from the frame loop. `main.ts` is the only site that drives
    //    per-frame work, so a call anywhere else would not discharge this.
    const injected = /\.inject\s*\(/.test(mainSrc) && /dyeProcessor/.test(mainSrc);
    const stepped = /dyeProcessor\.step\s*\(/.test(mainSrc);
    // 2. The output is CONSUMED. This is the check the original section had no equivalent of and the one that
    //    matters most now: the rebuilt field's output is a texture read by another shader rather than a
    //    composite pass of its own, so "it draws" is no longer sufficient evidence that anything sees it.
    //    ⚠️ A dye field that injects and advects but is never sampled is EXACTLY G14's defect in a new shape.
    const handedOff = /setDyeTexture\s*\(/.test(mainSrc);
    const sampled = /uniform\s+sampler2D\s+uDye\b/.test(stripComments(rd('src/renderers/hdr-particle.ts')));
    // 3. Allocation is GATED on being active — the specific waste G14 costed at 13 GL objects. `Enable` off
    //    must allocate nothing beyond the 1x1 fallback.
    const lazyAlloc = /ensureResources\s*\(/.test(dye) && /isActive\s*\(\s*\)/.test(dye);
    if (injected && stepped && handedOff && sampled && lazyAlloc) {
      pass('the dye field is back and is WIRED', 'injected + stepped in main.ts, sampled by uDye, lazily allocated');
    } else {
      fail(`src/post-processors/dye-field.ts exists but the field is not fully wired — `
         + `inject=${injected} step=${stepped} handedOff=${handedOff} sampledByShader=${sampled} `
         + `lazyAlloc=${lazyAlloc}. G14's defect was allocation with no per-frame caller; its NEW shape is a `
         + `field that injects and advects but whose texture nothing samples, which is just as invisible.`);
    }
  }

  // The other direction: the type must survive so old exports still parse.
  const types = stripComments(rd('src/presets/types.ts'));
  const typeKept = /^export interface DyeFieldConfig\b/m.test(types);
  const fieldKept = /^\s*dye\?:\s*DyeFieldConfig/m.test(types);
  if (typeKept && fieldKept) {
    pass('DyeFieldConfig and OverlayState.dye survive', 'import compatibility, as with GrowthConfig');
  } else {
    fail(`the dye CONFIG TYPE was removed too (interface=${typeKept} OverlayState.dye=${fieldKept}). `
       + `\`overlay.dye\` is a persisted block that may exist in already-exported presets, so deleting `
       + `the type is a FORMAT change, not a dead-code deletion. Restore it with the `
       + `import-compatibility comment, exactly as GrowthConfig is kept.`);
  }
}

// ---- H12: the two field-simulation resize() methods ------------------------------------------
// Deleted because BOTH simulations are resolution-independent by construction: `FLUID_SIZE` and
// `TRAIL_SIZE` are module constants baked into every texture allocation AND into the shader sources,
// both `init()` signatures take only `(gl)`, neither class holds a canvas-derived field, and every
// interface is UV-space. So `resize()` — `dispose(); init(gl);` in both — rebuilt 9 programs,
// 9 textures, 9 FBOs and 6 VAOs into a byte-identical state, while CLEARING the accumulated velocity
// and trail fields. Under H11 that ran twice per Lab panel toggle, `setPanelMode` calling `resizeAll()`
// immediately and again from a 350 ms setTimeout that chases the CSS grid-template-columns transition.
//
// This is the same regrowth shape as G5 above: a method that looks like an obvious omission next to
// every other processor's `resize(w, h)`, and whose absence is deliberate.
//
// ⚠️ **THE DYE FIELD JOINED THIS LOOP ON 2026-09-03 (v8 15.7), AND IT IS THE ONE THAT PROVES THE PROPERTY
// MATTERS.** G14's write-up records a LATENT resize bug in the deleted version: `FluidAdvectionProcessor.resize()`
// was `dispose(); init();` and `init()` never re-entered `initDye()`, so the dye handles would have gone null on
// the first window resize with nothing to notice. 15.7 designed that out rather than fixing it — `DYE_SIZE` is a
// fixed 512², every uniform is UV — so the assertion that keeps it designed out is this one, not a re-entry check
// in the fluid class (see the re-based G14 section above for why the old check failed on correct code).
// ⚠️ **A third entry is all it costs to add a fixed-size field here. Add the next one too.**
{
  const files = {
    fluid: 'src/post-processors/fluid-advection.ts',
    physarum: 'src/generators/physarum.ts',
    dye: 'src/post-processors/dye-field.ts',
  };
  const sizeConst = { fluid: 'FLUID_SIZE', physarum: 'TRAIL_SIZE', dye: 'DYE_SIZE' };
  for (const [label, path] of Object.entries(files)) {
    // The dye field is a legitimate absence (it was deleted 2026-08-12 and rebuilt 2026-09-03), so the loop
    // skips a file that is not there rather than crashing — the G14 section above owns whether it should exist.
    if (!existsSync(join(root, path))) continue;
    const src = stripComments(rd(path));
    const hasResize = /^\s{2}resize\s*\(/m.test(src);
    if (!hasResize) {
      // Assert the REASON, not the absence: the simulation must still be fixed-size, i.e. the module
      // constant is a literal and `init()` still takes no dimensions. If someone makes either one
      // canvas-derived, a resize path becomes genuinely necessary and this must fail.
      const konst = new RegExp(`^const ${sizeConst[label]} = \\d+;`, 'm').test(src);
      const initNoDims = /^\s{2}init\(gl: WebGL2RenderingContext\): void/m.test(src);
      if (konst && initNoDims) {
        pass(`${label} has no resize() and does not need one`, `fixed ${sizeConst[label]}, init(gl) only`);
      } else {
        fail(`${label} (${path}) has no resize() but is no longer fixed-size: `
           + `${sizeConst[label]} is a literal const=${konst}, init() takes only (gl)=${initNoDims}. `
           + `H12 deleted resize() BECAUSE the simulation was resolution-independent. If a dimension now `
           + `reaches this class, that reasoning no longer holds and a resize path is needed again.`);
      }
    } else {
      // Reinstating it is only defensible if the class actually became resolution-dependent — a bare
      // dispose()+init() is exactly what was deleted.
      const body = src.slice(src.search(/^\s{2}resize\s*\(/m));
      const end = body.indexOf('\n  }');
      const resizeBody = body.slice(0, end < 0 ? 600 : end);
      const isBareRebuild = /this\.dispose\(\)/.test(resizeBody) && /this\.init\(/.test(resizeBody);
      const takesDims = /^\s{2}resize\s*\(\s*\w+\s*:\s*number/m.test(src);
      if (!isBareRebuild || takesDims) {
        pass(`${label}.resize() is back and is not a bare rebuild`, takesDims ? 'takes dimensions' : '');
      } else {
        fail(`${label}.resize() regrew as a bare dispose()+init(gl) (${path}). That is what H12 deleted: `
           + `${sizeConst[label]} is a module constant baked into the textures and the shaders, so the `
           + `rebuild produced a byte-IDENTICAL simulation — 9 programs, 9 textures, 9 FBOs and 6 VAOs `
           + `across both classes, twice per Lab panel toggle — while wiping the accumulated field. If `
           + `the class is now resolution-dependent, take the dimensions as parameters.`);
      }
    }
  }
  // And the call sites must stay gone, else the cost returns regardless of what the method does.
  const mainSrc = stripComments(rd('src/main.ts'));
  const calls = (mainSrc.match(/(physarumProcessor|fluidProcessor|dyeProcessor)\.resize\s*\(/g) ?? []);
  if (calls.length === 0) {
    pass('resizeAll() no longer rebuilds the field simulations', 'nothing to notify of a canvas change');
  } else {
    fail(`resizeAll() calls ${calls.join(', ')} again. A canvas change is invisible to both classes, so `
       + `these calls could only ever have cost a full GL teardown and cleared the accumulated field.`);
  }
}

console.log(failures === 0
  ? `\ndeadcheck: OK (${srcFiles.length} source files scanned)`
  : `\ndeadcheck: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
