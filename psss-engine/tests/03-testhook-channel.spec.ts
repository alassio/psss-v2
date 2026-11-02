import { test, expect, TEST_HOOK_KEYS, type TestHook } from './composer-fixture.ts';

/*
 * ============================================================================================
 * Phase 17.2 — `?testhook=1`: the introspection channel, and the specs that hold IT to account.
 * ============================================================================================
 *
 * ⚠️ **THIS SPEC'S SUBJECT IS THE INSTRUMENT, NOT THE COMPOSER — IT DISCHARGES NO TEST-PLAN STEP.** Phase 2
 * exists because the ~42 steps about what the FIGURE does had no machine-readable channel: the only global the
 * engine published was `window.__gldiag`. Those steps are Phases 5 and 6's work. What this file establishes is
 * that the channel is worth building on, and `CLAUDE.md`'s rule is why it comes first: **a falsification harness
 * cannot see a mechanism that is absent, mis-scoped or unreachable** — and every later phase inherits whatever
 * is wrong here.
 *
 * ⚠️ **THE FOUR PROPERTIES BELOW ARE EACH A WAY THE HOOK COULD LIE WHILE READING GREEN, AND ONE OF THEM IS THE
 * DEFECT PHASE 1 ALREADY MET IN ANOTHER MEDIUM:**
 *   §26.2a  the guard is REAL — absent without `?testhook=1` (else it is a shipped API, not a diagnostic)
 *   §26.2b  it is a SNAPSHOT-ON-READ, not a frozen object (a cached reading passes every "did it move?" clause)
 *   §26.2c  it is READ-ONLY (a writable hook is a second apply path — invariant 23)
 *   §26.2d  its KEY SET matches the harness's own declaration (the two-enumeration gap `tsc` cannot see)
 *
 * ⚠️ **AND THE ONE POSITIVE CAPABILITY CLAIM: `pos` SEPARATES A LIVE INTEGRATOR FROM A MOVING PICTURE.** That
 * is the whole reason the step touched `src/` at all. Asserted in §26.2e against the case that motivated it —
 * a figure whose pixels change for reasons other than integration.
 */

test.describe('§26.2 — the `?testhook=1` channel is real, live, read-only and complete', () => {
  /*
   * ⚠️ **§26.2a — THE GUARD. If this clause is ever removed, the hook has quietly become part of the shipped
   * surface**, which is precisely what `?gldiag=1`'s rules forbid: *"never made always-on and never tidied
   * away."* An always-live hook is a second surface onto engine state, and `CLAUDE.md` records that the last
   * time this project grew a second path into the same state, it took invariant 23 to write it down.
   *
   * ⚠️ **NOTE WHAT IS ASSERTED: `undefined`, on a page THAT BOOTED.** Asserting absence on a page that failed to
   * load would pass for the wrong reason — the empty-corpus defect — so the Lab button is waited for first
   * (inside `boot()`), and the engine is shown to have DRAWN before the absence is believed.
   */
  test('§26.2a the hook is ABSENT without the URL guard, on a page that booted and drew', async ({ composer }) => {
    await composer.boot();
    await composer.assertEngineDrew();

    const hook = await composer.hook();
    expect(hook, 'the engine published `window.__psss` WITHOUT `?testhook=1` — the hook has leaked onto the '
      + 'shipped path. It must be opt-in via one URL guard, exactly as `?gldiag=1` is.').toBeNull();

    // ⚠️ The corpus guard for the absence above: prove the page really is the running engine, not a blank
    // document that would report `null` for any global whatsoever.
    const isRealEngine = await composer.page.evaluate(() => !!document.querySelector('#canvas'));
    expect(isRealEngine, 'CALIBRATION: no `#canvas` on the page, so the absence assertion above was made '
      + 'against a document that is not the engine — it would pass for any global.').toBe(true);
  });

  /*
   * ⚠️ **§26.2b — SNAPSHOT-ON-READ. THIS IS THE CLAUSE THAT MATTERS MOST AND IT IS THE ONE A PLAUSIBLE
   * IMPLEMENTATION FAILS.** The tempting form is `window.__psss = { pos, speedFactor, ... }` assigned once at
   * init — one line shorter, and **it reports the boot frame forever.** Every "did the figure respond?" clause
   * in Phases 5 and 6 would then pass over a dead engine. Phase 1 met this shape already (its two-sample canvas
   * signature exists for the same reason) and the seed below is that defect made explicit.
   */
  test('§26.2b every read RE-SAMPLES — it is a getter, not a frozen object', async ({ composer }) => {
    const first = await composer.bootWithHook();

    await composer.page.waitForTimeout(1200);
    const second = await composer.hook();

    expect(second!.pos, 'two reads of `window.__psss` returned the SAME `pos`, so the hook is a cached object '
      + 'rather than a getter. Every later phase\'s "did it advance?" assertion would pass over a dead loop.')
      .not.toBe(first.pos);

    // ⚠️ **A DIFFERENT `pos` IS NOT ENOUGH — DIRECTION IS PART OF THE PROPERTY.** `pos` is a monotonically
    // accumulating phase (`CLAUDE.md`: it "accumulated monotonically for the whole session"), so a reading that
    // moved BACKWARDS means something reset the integrator — which is exactly what `init()` does, and exactly
    // what `setWaves()` exists to avoid. A `not.toBe` alone would call that a pass.
    expect(second!.pos, '`pos` moved BACKWARDS between two reads — something re-ran `init()`. `setWaves()` '
      + 'exists precisely so a live edit does not reset the integration clock.').toBeGreaterThan(first.pos);
  });

  /*
   * ⚠️ **§26.2c — READ-ONLY. A WRITABLE HOOK WOULD BE A SECOND APPLY PATH INTO ENGINE STATE**, and the suite's
   * entire claim is that it exercises the path a USER takes. If a spec could set `speedFactor` directly it would
   * be testing a configuration no user can reach, and a later reader would have no way to tell which specs did.
   *
   * The engine defines `__psss` as an accessor with a getter and no setter, so an assignment in non-strict page
   * context is silently discarded. **Asserting the SILENCE is the wrong test** — what matters is that the value
   * did not change, so this writes and then reads back.
   */
  test('§26.2c the hook cannot be written through — no setter, and a write does not stick', async ({ composer }) => {
    await composer.bootWithHook();

    const outcome = await composer.page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      try { w['__psss'] = { pos: -999, hacked: true }; } catch { /* strict-mode throw is also acceptable */ }
      const after = w['__psss'] as { pos?: number; hacked?: boolean } | undefined;
      return { hacked: after?.hacked ?? null, pos: after?.pos ?? null };
    });

    expect(outcome.hacked, 'assigning to `window.__psss` REPLACED it — the hook is a mutable handle, so a spec '
      + 'could drive the engine through a path no user can reach.').toBeNull();
    expect(outcome.pos, 'the hook survived the write but reported the injected `pos`.').not.toBe(-999);

    // ⚠️ And it must still WORK after the attempted write — a hook that survives by breaking is no better.
    const still = await composer.hook();
    expect(still, 'the hook stopped reporting after a write attempt.').toBeTruthy();
    expect(typeof still!.pos, '`pos` is no longer a number after a write attempt.').toBe('number');
  });

  /*
   * ⚠️ **§26.2d — THE KEY SET, AND THIS CLAUSE EXISTS BECAUSE `tsc` STRUCTURALLY CANNOT SEE THE GAP IT COVERS.**
   * `tests/` compiles under its own tsconfig (`check:specs`) and `src/` under the engine's (`verify`), so
   * `TestHook` in the fixture and `read()` in `main.ts` are two enumerations of one list with NO compiler
   * between them. `CLAUDE.md`: *"three enumerations of one list make a missing entry structurally invisible."*
   *
   * ⚠️ **BOTH DIRECTIONS ARE ASSERTED, and the second is the one that actually bites.** A key the engine
   * publishes but the harness has not declared is *unreadable* — a spec would write `hook.newField` and get a
   * type error, which is loud. A key the harness declares but the engine has STOPPED publishing yields
   * `undefined` at runtime, and `expect(undefined).not.toBe(x)` PASSES. So the missing-key direction is the
   * silent one.
   */
  test('§26.2d the published key set matches the harness declaration EXACTLY, both directions', async ({ composer }) => {
    await composer.bootWithHook();

    const live = await composer.page.evaluate(() =>
      Object.keys((window as unknown as { __psss: object }).__psss).sort());

    expect(live.length, 'CALIBRATION: the hook published NO keys, so both comparisons below would be trivially '
      + 'satisfiable. Assert the corpus is non-empty before comparing sets.').toBeGreaterThan(0);

    const declared = [...TEST_HOOK_KEYS].sort();

    const undeclared = live.filter((k) => !declared.includes(k as keyof TestHook));
    expect(undeclared, `the engine publishes ${JSON.stringify(undeclared)}, which \`TestHook\` does not declare `
      + '— add them to the fixture, or the specs cannot read them.').toEqual([]);

    const missing = declared.filter((k) => !live.includes(k));
    expect(missing, `\`TestHook\` declares ${JSON.stringify(missing)}, which the engine no longer publishes. `
      + '⚠️ THIS IS THE SILENT DIRECTION: a spec reading one of these gets `undefined`, and most assertions '
      + 'PASS against `undefined`.').toEqual([]);
  });

  /*
   * ⚠️ **§26.2e — THE POSITIVE CAPABILITY CLAIM, AND THE ONLY REASON THE STEP TOUCHED `src/`.** A canvas
   * comparison answers *"did the picture change?"*; it cannot answer *"is the integrator running?"* — because
   * rotation, curl noise, the fluid field and an attractor blend all move pixels without `update()` advancing
   * the wave phase. `pos` answers the second question directly.
   *
   * ⚠️ **THE STARTUP PRESET IS THE RIGHT SUBJECT PRECISELY BECAUSE IT IS BUSY:** measured, `Aurora Borealis`
   * boots with `renderMode: 'splat'` and a live `LiquidLight` material, so it has plenty of pixel motion that is
   * NOT the integrator. A frozen-`pos` engine here would still look alive.
   */
  test('§26.2e `pos` and `elapsedTime` both advance — a live integrator, not just a moving picture', async ({ composer }) => {
    await composer.bootWithHook();
    await composer.assertEngineDrew();
    await composer.assertIntegratorAdvanced(1200);
  });

  /*
   * ⚠️ **§26.2f — THE RESOLVED MODE, WHICH IS AN INVARIANT-17 PROPERTY AND NOT A CONVENIENCE FIELD.** *"Two
   * sources ⇒ every reader resolves them in the same order AND NOTHING MAY WRITE THE RESOLVED VALUE
   * AFTERWARDS"*, owner `resolveModeAgainstMaterial()`. The hook publishes `currentRenderMode` — what the frame
   * actually drew — NOT `preset.renderer.mode`. A hook publishing the authored value would let a later spec
   * "confirm" a mode the frame never used, and the two differ on exactly the presets that matter: **84 of 399
   * carry a live material.**
   *
   * Measured on the startup preset: `renderMode: 'splat'` with `material: 'LiquidLight'` — i.e. the material
   * HAS overridden the authored mode, so this preset is a live witness rather than a vacuous one.
   */
  test('§26.2f `renderMode` is the RESOLVED mode, witnessed against a live material', async ({ composer }) => {
    const hook = await composer.bootWithHook();

    expect(hook.material, 'CALIBRATION: the startup preset has no live material, so this spec cannot witness '
      + 'the resolver doing anything. Point it at a preset from the 84 that carry one.').not.toBeNull();
    expect(hook.material).not.toBe('None');

    // ⚠️ `splat` is the mode a material REQUESTS. Asserting the specific value (rather than merely "some
    // string") is what makes this a claim about the resolver instead of about typeof.
    expect(hook.renderMode, `with material "${hook.material}" live, the resolved mode should be the one the `
      + 'material requests. A hook publishing `preset.renderer.mode` would report the authored value here.')
      .toBe('splat');

    // ⚠️ **AND THE FRAME MUST NOT BE BLACK, which is the failure `splat` has when it is WRONGLY resolved:**
    // `CLAUDE.md` — "`splat` with no material draws NOTHING". So this pairs the mode reading with pixels;
    // either alone is consistent with the defect.
    await composer.assertEngineDrew();
  });

  /*
   * ⚠️ **§26.2g — THE BYPASS PAIR, WHICH IS WHAT MAKES E109 TESTABLE AT ALL AND CANNOT BE EXPRESSED BY ONE
   * BOOLEAN.** E109's one hard assertion is that Export / Snapshot / the Mixer stay byte-identical while a box
   * is ticked — the *report* is frozen while the *pixels* change, *"the OPPOSITE of E108's mute."* Verifying
   * that needs the flag AND the capture in one reading: `snapshotIsFrozen` is `bypassAuthoredOverlay !== null`,
   * i.e. the authored overlay really was captured rather than re-derived.
   *
   * ⚠️ **AT BOOT ALL THREE MUST BE FALSE/NULL, AND THAT IS A REAL CLAUSE RATHER THAN A TAUTOLOGY:**
   * `applyBypassToEngine()` runs from `applyPresetChange` on EVERY load including the startup preset, and its
   * early return (`if (!anyOn && !bypassAuthoredOverlay) return;`) is the only thing standing between a fresh
   * boot and a capture nobody asked for. A stray capture here would freeze Export on a preset the user never
   * bypassed. **Phases 5–6 drive the checkboxes; this pins the baseline they measure against.**
   */
  test('§26.2g the bypass flags and the frozen-capture flag are all clear at boot', async ({ composer }) => {
    const hook = await composer.bootWithHook();

    expect(hook.bypassVisualFx, 'a fresh boot has `bypassVisualFx` set.').toBe(false);
    expect(hook.bypassMaterials, 'a fresh boot has `bypassMaterials` set.').toBe(false);
    expect(hook.snapshotIsFrozen, '`bypassAuthoredOverlay` is non-null at boot, so `getSnapshot()` is already '
      + 'returning a frozen capture and Export would report a preset state the user never bypassed. '
      + '`applyBypassToEngine()`\'s early return is what prevents this.').toBe(false);
  });

  /*
   * ⚠️ **§26.2h — THE FRAME-ERROR CHANNEL, WHICH ANSWERS PHASE 1'S MOST EXPENSIVE INSTRUMENT DEFECT.** Phase 1
   * lost two theories to `Target page, context or browser has been closed` — a per-test timeout that read
   * exactly like a renderer crash. `lastFrameError` makes the two distinguishable from inside: `null` means
   * `drawFrame`'s `catch` has never fired, so a harness-side failure can no longer be pinned on the engine.
   *
   * ⚠️ **AND IT IS EVIDENCE ONLY BECAUSE THE FIELD IS REACHABLE — `drawFrameBody` throwing sets it** (invariant
   * 22: the rAF sits in a `finally`, so the loop survives and the message is recorded once per distinct error).
   * A field that could never be non-null would make this clause unfalsifiable; seed 4 in
   * `02-calibration-seeds` is what shows it can.
   */
  test('§26.2h no frame has thrown since boot, on a channel that CAN report one', async ({ composer }) => {
    const hook = await composer.bootWithHook();
    await composer.assertEngineDrew();

    expect(hook.lastFrameError, 'the frame loop threw during boot. `CLAUDE.md`: a clean console is not '
      + 'evidence the frame is fine — but a non-null `lastFrameError` IS evidence it is not.').toBeNull();

    // ⚠️ The reading must also survive a stretch of running, or it only describes the boot frame.
    await composer.page.waitForTimeout(1500);
    const later = await composer.hook();
    expect(later!.lastFrameError, 'a frame threw after boot.').toBeNull();
  });

  /*
   * ⚠️ **§26.2i — THE CANVAS AND POPULATION READINGS, BECAUSE CANVAS SIZE IS AN INPUT TO THE SUBJECT.**
   * Invariant 26 (*an image-domain operator must measure length on one shared scale*) and 27 (*a preset cannot
   * compensate for a canvas-dependent error*) both mean a figure assertion is only meaningful beside the size it
   * was drawn at. Phases 4–5 commit pixel baselines; those baselines are void if the canvas differs.
   *
   * ⚠️ **THE MEASURED WIDTH IS 800, NOT THE VIEWPORT'S 1600 — the Lab panel takes half.** Pinning the viewport
   * in `playwright.config.ts` is therefore NOT sufficient on its own, which is exactly the sort of assumption
   * this clause exists to keep honest: **assert the canvas, not the window.**
   *
   * ⚠️ **AND THE `> 0` FORM OF THIS CLAUSE WAS NOT ENOUGH — MEASURED 2026-09-09, PHASE 17.5, AND IT IS THIS
   * SPEC'S OWN NEAR-MISS.** The suite had been running at `1280 × 720` with a canvas of `640 × 720`, because
   * `devices['Desktop Chrome']` carries its own viewport and a project's `use` beats the top-level one. **This
   * clause was written to keep the pin honest and it passed anyway**, since 640 satisfies `> 0`. The `800 × 900`
   * in the comment above came from a hand-run probe launched WITHOUT the config — a reading about a configuration
   * the suite never ran. **So the size is now asserted EXACTLY, and the failure message says what to suspect.**
   * ⚠️ **A `> 0` guard over a quantity with a KNOWN value is an unfalsifiable clause** (`CLAUDE.md`: *"an
   * UNREACHABLE assertion is worse than a missing one"*, and its milder form is one that cannot discriminate).
   */
  test('§26.2i the canvas has a real size and the population is the engine-unit count', async ({ composer }) => {
    const hook = await composer.bootWithHook();

    expect(hook.canvas.width, 'the canvas has zero width — every pixel baseline in Phases 4–5 would be void.')
      .toBeGreaterThan(0);
    expect(hook.canvas.height).toBeGreaterThan(0);

    /*
     * ⚠️ **THE EXACT SIZE, AND BOTH HALVES ARE ASSERTED BECAUSE THEY FAIL FOR DIFFERENT REASONS.** The VIEWPORT
     * failing means the config pin was overridden again (the spread-order defect); the CANVAS failing over a
     * correct viewport means the Lab panel's share of the width changed, which moves the subject of every
     * geometry clause in specs 04 and 07 without moving any of their readings.
     */
    const vp = composer.page.viewportSize();
    expect(vp, '§26.2i: no viewport size at all.').not.toBeNull();
    expect({ w: vp!.width, h: vp!.height }, '§26.2i: THE VIEWPORT PIN IS NOT IN EFFECT. `playwright.config.ts` '
      + 'sets `1600 × 900`, but the `composer` project spreads `devices["Desktop Chrome"]`, which carries its own '
      + '`1280 × 720` — and a project\'s `use` BEATS the top-level `use`. The re-pin must stay BELOW the spread. '
      + 'This exact defect ran green for two phases.').toEqual({ w: 1600, h: 900 });
    expect({ w: hook.canvas.width, h: hook.canvas.height }, '§26.2i: the canvas is not 800 × 900. With the '
      + 'viewport correctly pinned at 1600 × 900 the Lab panel takes half the width, so this is the size every '
      + 'figure in this suite is drawn at — invariant 26 (one shared length scale) and 27 (a preset cannot '
      + 'compensate for a canvas-dependent error) both make it an INPUT to the subject, not framing. If this '
      + 'moved, Phase 4\'s pane geometry and any future pixel baseline moved with it. ⚠️ TWO OWNERS SINCE '
      + '2026-09-25, AND THE VIEWPORT IS ONLY THE FIRST: `resolveRenderSize()` resolves the backing store as '
      + 'floor(CSS × devicePixelRatio × min(scale, 1) / 2) × 2 under `RENDER_PIXEL_BUDGET`, so `deviceScaleFactor` '
      + 'moves this number too — at 2 it would read 1332 × 1498, the budget binding where at DPR 1 it does not '
      + 'bind at all. Both keys are re-pinned BELOW the device spread in `playwright.config.ts`; check the ratio '
      + 'there before concluding the viewport pin broke.')
      .toEqual({ w: 800, h: 900 });

    // ⚠️ **`particleCount` IS THE ENGINE UNIT, NOT THE AUTHORED VALUE** — `migration.ts:190` multiplies the raw
    // preset value by 5, which `CLAUDE.md` flags where `New Figure` seeds a figure. A spec comparing this
    // against a preset's JSON number would be off by exactly that factor, so the claim here is only that the
    // population is non-empty and plausible; the factor is Phase 6's business.
    expect(hook.particleCount, 'the generator published a count of 0 — nothing is being integrated.')
      .toBeGreaterThan(0);

    // The reading must agree with `getState().count`, the one trustworthy length (invariant 7).
    const stateCount = await composer.page.evaluate(() =>
      (window as unknown as { __psss: { particleCount: number } }).__psss.particleCount);
    expect(stateCount).toBe(hook.particleCount);
  });
});

/*
 * ============================================================================================
 * §26.2 SEEDS — the clauses above, shown to be able to FAIL.
 * ============================================================================================
 *
 * ⚠️ **`CLAUDE.md`, and it is Phase 1's own correction: *a spec without a seed discharges nothing, whatever
 * colour it reports* — SHIP THE SEEDS IN THE SAME SITTING, never in a later phase.** Phase 7 audits that this
 * rule was kept; it is not the moment the rule starts applying.
 *
 * ⚠️ **EACH SEED ASSERTS ITS PRE-MUTATION READING FIRST.** A seed that failed to apply would otherwise report
 * the clause as discriminating on the strength of nothing having happened — *"a SKIPPED mutation reads exactly
 * like a caught one."*
 *
 * ⚠️ **THESE MUTATE THE PAGE, NEVER `src/`.** The engine-side defect each one imitates is named in its comment.
 */
test.describe('§26.2 SEEDS — each clause above must be able to fail', () => {
  test('the four channel properties are all discriminating', async ({ composer }) => {
    await composer.bootWithHook();

    /*
     * SEED 1 — the frozen-object hook (§26.2b's subject).
     * ⚠️ **THIS IS THE PLAUSIBLE IMPLEMENTATION, NOT A STRAW MAN: `window.__psss = {...}` assigned once at init
     * is one line SHORTER than the getter and reads as tidier.** It reports the boot frame forever.
     */
    const beforeSeed1 = await composer.hook();
    expect(beforeSeed1!.pos, 'CALIBRATION: `pos` is 0 before seed 1, so a frozen hook would be '
      + 'indistinguishable from a live one that has not started.').toBeGreaterThan(0);

    const seed1 = await composer.page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const frozen = { ...(w['__psss'] as object) };            // the defect: snapshot once...
      Object.defineProperty(w, '__psss', { get: () => frozen, configurable: true });
      const a = (w['__psss'] as { pos: number }).pos;
      await new Promise((r) => setTimeout(r, 1200));
      const b = (w['__psss'] as { pos: number }).pos;
      return { a, b };
    });
    expect(seed1.b, 'SEED 1 FAILED TO SEED: a frozen hook still reported a changing `pos`, so §26.2b would '
      + 'have been green over a cached object.').toBe(seed1.a);

    /*
     * SEED 2 — a hook that is present without the guard (§26.2a's subject).
     * ⚠️ The engine-side defect is *"tidying"* the URL check away, or hoisting the assignment above it. The
     * absence clause must be able to see a hook that simply exists.
     */
    const seed2 = await composer.page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w['__psss'];
      const absent = w['__psss'] === undefined;
      w['__psss'] = { pos: 1 };                                  // the defect: unguarded publication
      return { absent, present: w['__psss'] !== undefined };
    });
    expect(seed2.absent, 'CALIBRATION: seed 2 could not clear the hook first, so "present" proves nothing.').toBe(true);
    expect(seed2.present, 'SEED 2 FAILED TO SEED.').toBe(true);

    /*
     * SEED 3 — a WRITABLE hook (§26.2c's subject).
     * ⚠️ A plain assignment (`window.__psss = read`) instead of `defineProperty` produces exactly this, and it
     * is the form most people would write. The clause must see that the write STICKS.
     */
    const seed3 = await composer.page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      w['__psss'] = { pos: 1 };                                  // writable data property, not an accessor
      w['__psss'] = { pos: -999, hacked: true };                  // the defect: the write lands
      return (w['__psss'] as { hacked?: boolean }).hacked ?? null;
    });
    expect(seed3, 'SEED 3 FAILED TO SEED: the write did not stick, so §26.2c would have been green over a '
      + 'mutable hook.').toBe(true);

    /*
     * SEED 4 — a MISSING key, i.e. §26.2d's SILENT direction.
     * ⚠️ **THIS IS THE SEED THAT MATTERS MOST, because the failure it imitates is invisible at runtime: a spec
     * reading a dropped field gets `undefined`, and `expect(undefined).not.toBe(x)` PASSES.** The mutation
     * deletes a key rather than renaming one, because a rename would show up in the *undeclared* direction too
     * and so could be caught by the louder half of the clause.
     */
    const seed4 = await composer.page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const full = { ...(w['__psss'] as Record<string, unknown>) };
      const had = 'pos' in full;
      delete full['pos'];                                        // the defect: engine stops publishing a field
      Object.defineProperty(w, '__psss', { get: () => full, configurable: true });
      return { had, keys: Object.keys(full) };
    });
    expect(seed4.had, 'CALIBRATION: `pos` was not present before seed 4 deleted it.').toBe(true);
    expect(seed4.keys, 'SEED 4 FAILED TO SEED: `pos` survived the delete.').not.toContain('pos');

    // ...and the clause's own predicate, run against the mutated reading, must REPORT the loss.
    const missing = [...TEST_HOOK_KEYS].filter((k) => !seed4.keys.includes(k));
    expect(missing, 'SEED 4 NOT CAUGHT: §26.2d\'s missing-key comparison did not notice a deleted field — the '
      + 'silent direction is undefended.').toContain('pos');

    /*
     * SEED 5 — a BACKWARDS `pos`, i.e. the monotonicity half of §26.2b.
     * ⚠️ **A seed that merely changed `pos` would be caught by `not.toBe` and would say nothing about the
     * direction clause** — *"a seed can be algebraically impossible; ask what the mutation can fail on that the
     * shipped rule cannot."* The engine-side defect is a live edit routed through `init()`, which resets `pos`
     * to 0 — the exact thing `setWaves()` exists to avoid.
     */
    const seed5 = await composer.page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      let p = 500;
      Object.defineProperty(w, '__psss', { get: () => ({ pos: (p -= 100) }), configurable: true });
      const a = (w['__psss'] as { pos: number }).pos;
      await new Promise((r) => setTimeout(r, 50));
      const b = (w['__psss'] as { pos: number }).pos;
      return { a, b };
    });
    expect(seed5.b, 'CALIBRATION: seed 5 did not move `pos` at all.').not.toBe(seed5.a);
    expect(seed5.b, 'SEED 5 FAILED TO SEED: `pos` did not go backwards, so §26.2b\'s monotonicity clause was '
      + 'not exercised — and a `not.toBe` alone would call an integrator reset a PASS.').toBeLessThan(seed5.a);
  });
});
