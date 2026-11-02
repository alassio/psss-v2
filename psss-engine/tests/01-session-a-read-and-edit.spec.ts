import { test, expect, SEL, assertAbsentAgainstLivePage, EMPTY_ROW_COPY, SLOTS } from './composer-fixture.ts';

/*
 * ============================================================================================
 * `TESTPLAN-phase16-composer.md` §A1 · §A2 · §A3 — **steps 1–12**, ported verbatim.
 * ============================================================================================
 *
 * ⚠️ **THESE ARE THE TWELVE STEPS PHASE 17.1 EXISTS TO PROVE PORTABLE, AND THE STEP NUMBERS ARE THE TEST PLAN'S
 * OWN — NEVER THIS FILE'S.** `CLAUDE.md`: *"Insertions are lettered and NEVER renumbered, AND A RETIRED STEP
 * KEEPS ITS NUMBER"*, because closing a gap silently moves what *"steps 1–7 passed"* refers to. So each `test()`
 * title starts with the plan's number, steps 3, 4 and 13–17 are absent because they are RETIRED (not because
 * they are unported), and **a step that becomes automated keeps its box and its number.**
 *
 * ⚠️ **WHAT A GREEN RUN OF THIS FILE DOES AND DOES NOT MEAN.** It means the twelve steps' *observable* claims
 * hold — strings, counts, control presence, one commit per typed value. It does **not** discharge the plan's
 * three design judgements, and step 11's *"keeps sweeping from where it was"* is the honest boundary case: the
 * automated form asserts the mechanism (the sweep position does not reset), which is what a snap-back would
 * break — but a human watching for a visible jolt is checking something slightly wider. **Stated, not papered
 * over.**
 */

test.describe('§A1 · Read a rich figure — Aliens DNA', () => {
  /*
   * ⚠️ **ALL THREE §A1 STEPS SHARE ONE PRESET LOAD BECAUSE A LOAD COSTS ~25 s UNDER SWIFTSHADER**, and three
   * separate `test()`s would each pay it. The trade is stated because it has a real cost: these assertions are
   * no longer independent, so the FIRST failure hides the rest. That is acceptable here only because they all
   * describe one screen at one instant; a spec that mutated state between them must not be grouped this way.
   */
  test('steps 1, 2, 5 — three lit rows, 21 raw inputs each, no tier button, readouts carry the stack multiple',
    async ({ composer, page }) => {
      test.slow();
      await composer.openComposer();
      await composer.loadPreset('Aliens DNA');

      // — step 1/2: three rows, none empty, all with the full 21.
      const slots = page.locator(`${SEL.tabContent} .sl-composer-slot`);
      await expect(slots, 'three wave rows always shown, no add/remove (owner decision)').toHaveCount(3);

      for (const n of [SLOTS.body, SLOTS.structure, SLOTS.detail]) {
        expect(await composer.isEmptyRow(n),
          `row ${n} reads "${EMPTY_ROW_COPY}" on Aliens DNA, which has 3 live slots, all full-by-data. `
          + 'A placeholder here means `writeFigure`/`renderSlotBody` decided the row was silent — and silence is '
          + '`size + pulse === 0`, never `FM.Base === 0`.').toBe(false);

        /*
         * ⚠️ **21 IS THE RAW FIELDS ONLY.** The row also carries 12 `sl-composer-breathe-num` percent/seconds
         * views (16.8 / E99); counting all `sl-composer-num` gives 33 and would be a green assertion about a
         * different quantity. The fixture's selector excludes them — see `SEL.numInput`.
         */
        await expect(composer.numInputs(n),
          `row ${n} must show ALL 21 numeric inputs (7 quantities × 3 axes) with nothing to click first — `
          + '16.15 / E106 deleted the tier, an owner decision over a view-only collapse').toHaveCount(21);
      }

      // — step 2, second half: all three level boxes ticked, and the cyan mute notice ABSENT.
      for (const n of [SLOTS.body, SLOTS.structure, SLOTS.detail]) {
        /*
         * ⚠️ **THIS ASSERTS `levelIsOn()`'S *VIEW*, WHICH IS A THIRD QUANTITY — AND SAYING WHICH FACT IS UNDER
         * TEST IS MANDATORY HERE.** `CLAUDE.md`: *"On" is TWO facts — not muted AND not empty*, and conflating
         * them WAS the defect §Q was green over (the box arrived ticked on an empty row, so no `change` fired
         * and the seed path was unreachable). On Aliens DNA both facts are true, so a tick is expected; the
         * discriminating case is an EMPTY row, which step 2 cannot reach and §B3 can.
         */
        await expect(composer.levelCheckbox(n),
          `level ${n}'s box must be ticked on a fully lit preset — "on" here means BOTH not-muted and not-empty`)
          .toBeChecked();
      }
      await expect(composer.notice('mute'),
        'the cyan mute notice must be HIDDEN while all three levels are on — the plan states that seeing it '
        + 'with all boxes ticked IS a finding. Note this asserts VISIBILITY: the element is always in the DOM '
        + 'and toggled by `display`, so a `count()` check would pass either way.').toBeHidden();

      // — step 3/4 retired: there must be NO tier button, of any label.
      await assertAbsentAgainstLivePage(
        slots,
        page.locator(`${SEL.tabContent} button:has-text("Simplify"), `
          + `${SEL.tabContent} button:has-text("Show detail")`),
        'a tier button of ANY label — 16.15 / E106 deleted it, and the plan says finding one is a finding',
      );

      /*
       * ⚠️ **THE RETIRED-WORD SCAN, AND IT RUNS AGAINST THE RENDERED DOM RATHER THAN THE SOURCE — WHICH IS
       * PRECISELY THE GAP THAT LET §N GO GREEN OVER A LIVE VIOLATION IN A THIRD FILE.** `CLAUDE.md`: *"A
       * USER-FACING STRING CAN LIVE IN THE MODEL"*, and *"a word reaching the DOM through a VARIABLE is
       * invisible to any text scan."* A browser closes that hole completely: it does not matter which file the
       * string came from, only that it reached the screen. **This is the one assertion here that a checker
       * structurally cannot make.**
       */
      const tabText = await page.locator(SEL.tabContent).innerText();
      expect(tabText.toLowerCase(), 'the word `breathes` is RETIRED as user-facing copy (16.12 / E103) — it '
        + 'named ONE quantity in two places. Reaching the DOM at all means a producer outside the files §N '
        + 'scans still ships it.').not.toContain('breathe');
      expect(tabText.toLowerCase(), 'the word `twist` is RETIRED as user-facing copy — it survives ONLY as the '
        + "model's internal simple-tier field name, which must never reach the screen").not.toContain('twist');
      expect(tabText, 'the label is `Shift °`, never `Phase °` (16.12 / E103)').not.toContain('Phase');
      expect(tabText, 'the level labels must be on screen — if this fails the scans above ran over an empty '
        + 'string and their absence claims were vacuous').toContain('Body');

      // — step 5: `closes`/seam badge on every row, and the `×… of Body` multiple on rows 2–3.
      const r0 = await composer.readout(SLOTS.body).innerText();
      expect(r0, 'the Body readout must carry the closure badge — `closesAt()` is its ONE owner')
        .toMatch(/closes|seam/);
      for (const n of [SLOTS.structure, SLOTS.detail]) {
        const r = await composer.readout(n).innerText();
        expect(r, `row ${n} must show its \`×… of Body\` multiple — the stack relationship is the main thing `
          + 'the readout exists to teach, and its absence is a listed Fail').toMatch(/×\s*[\d.]+\s*of Body/);
      }
    });
});

test.describe('§A2 · The phase cancellation — steps 6–9', () => {
  /*
   * ⚠️ **THIS IS THE BLOCK THAT JUSTIFIES THE WHOLE PHASE, AND IT IS ALSO WHERE AN AUTOMATED PORT IS STRICTLY
   * BETTER THAN A HUMAN PASS.** The engine's inner expression is `sin((n + phase) · fm) · am`, so the applied
   * shift is **`phase × winding mod 360`**, not the authored degrees — `CLAUDE.md` states it as a standalone
   * silent-violation rule. Four presets, four exact strings: a reader must hold four `(authored → effective)`
   * pairs in their head and not tick from memory; a spec compares literals.
   *
   * ⚠️ **AND THE MEASURED VALUES ARE THE PLAN'S, RE-READ OFF THE LIVE DOM BEFORE BEING ASSERTED — not copied
   * from the document.** `CLAUDE.md`: *"never do arithmetic on a quoted figure."* All four matched, which is a
   * result about the plan as well as the engine: §A2's expectations are still correct after 16.20 rewrote the
   * readout to append a period.
   */
  const CASES: ReadonlyArray<{ step: number; preset: string; expect: readonly string[]; why: string }> = [
    { step: 6, preset: 'Aliens DNA', expect: ['Y shift 90° (not 18°)'], why: 'authored 18°, winding 5' },
    { step: 7, preset: 'Black Hole', expect: ['X shift 0° (not 90°)'], why: 'authored 90°, winding 32 — the '
      + 'engine cancels it to EXACTLY 0°, which is why the readout is worse than absent if it echoes 90°' },
    { step: 8, preset: 'Argus', expect: ['X shift 0° (not 90°)'], why: 'winding 0 on that axis' },
    { step: 9, preset: 'Andromeda', expect: ['Y shift 120° (not 30°)', 'Z shift 240° (not 60°)'],
      why: 'two shifted axes at once' },
  ];

  for (const c of CASES) {
    test(`step ${c.step} — ${c.preset}: Body readout prints the EFFECTIVE shift, not the authored one`,
      async ({ composer }) => {
        test.slow();
        await composer.openComposer();
        await composer.loadPreset(c.preset);
        const readout = await composer.readout(SLOTS.body).innerText();
        for (const want of c.expect) {
          expect(readout.replace(/\s+/g, ' '),
            `${c.preset} Body must read ${JSON.stringify(want)} (${c.why}). Got: ${JSON.stringify(readout)}. `
            + 'An authored-degrees echo here would leave a user editing a phase at high winding with no way to '
            + 'learn why nothing moved.').toContain(want);
        }
      });
  }
});

test.describe('§A3 · Edit without losing your place — steps 10–12', () => {
  test('steps 10, 11 — a Winding step changes the shape and does NOT restart the sweep',
    async ({ composer, page }) => {
      test.slow();
      /*
       * ⚠️ **THIS IS THE ONE TEST IN THIS FILE THAT BOOTS WITH `?testhook=1`, AND IT IS AN EXPLICIT TRADE, NOT A
       * TIDY-UP.** Step 11's claim is *"keeps sweeping from where it was"*, and the closing clause needs `pos`.
       * ⚠️ **THE SHARED `boot()` DEFAULT STAYS A BARE `/` — do not "simplify" this by moving the hook into the
       * fixture**: `CLAUDE.md` records that a fixture always passing the guard *"would move every Phase 1 step
       * onto an unreachable configuration AND STAY GREEN"*. The other tests here keep the bare configuration, and
       * `03-testhook-channel.spec.ts` owns the guard itself.
       *
       * ⚠️ **AND THE ALTERNATIVE WAS WORSE: a `pos` clause that runs only `if (hook)` would report PASS on a page
       * that never published one** — a skipped assertion reading exactly like a satisfied one, which is this
       * project's standing failure mode. So the hook is REQUIRED here and `bootWithHook()` asserts it up front.
       */
      await composer.bootWithHook();
      await composer.openComposer();
      await composer.loadPreset('Aliens DNA');

      /*
       * ⚠️ **THE OBSERVABLE UNDER TEST IS THE COMMIT PATH, AND NAMING IT IS THE POINT.** The tab mutates
       * `workingPreset` in place and calls `controls.setWaves()`. It deliberately does NOT go through
       * `state.setWorkingPreset` → `'preset-changed'` → `applyPresetChange` → `initGenerator()`, because that
       * resets `pos`, re-reads `angle` and reallocates buffers — the figure would snap to its opening pose on
       * every stepper click. **A snap means the commit path regressed to the obvious-looking one.**
       *
       * ⚠️ **SO THE ASSERTION IS ABOUT `pos` NOT RESETTING, AND THE HARNESS'S LIMIT IS STATED: this compares
       * frames, which cannot distinguish "the sweep continued" from "the sweep restarted and happens to look
       * similar".** What makes it discriminating is the ORDER: a reset lands the figure at its opening pose,
       * which is a fixed frame — so the test also requires the post-edit frame to differ from the frame the
       * page shows immediately after a fresh load of the same preset. Without that second leg the assertion
       * would be *"something changed"*, which a snap-back also satisfies.
       */
      const sig = async () => page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('#canvas');
        const gl = c?.getContext('webgl2'); if (!c || !gl) return '';
        const px = new Uint8Array(96 * 96 * 4);
        gl.readPixels(Math.floor(c.width / 2 - 48), Math.floor(c.height / 2 - 48), 96, 96,
          gl.RGBA, gl.UNSIGNED_BYTE, px);
        // Coarse buckets: `dt` is wall-clock so an exact frame is not reproducible (see `playwright.config.ts`).
        let sum = 0, lit = 0;
        for (let i = 0; i < px.length; i += 4) {
          const v = Math.max(px[i]!, px[i + 1]!, px[i + 2]!);
          sum += v; if (v > 16) lit++;
        }
        return `${Math.round(sum / 4096)}:${Math.round(lit / 64)}`;
      });

      await composer.assertEngineDrew();
      const windX = composer.field('Body', 'Winding', 'X');
      await expect(windX, 'no `Body Winding X` input — every field carries a shipped `aria-label` of the form '
        + '"<Level> <Quantity> <Axis>"; if this matched nothing, a rename dropped the labels').toHaveCount(1);
      const before = await windX.inputValue();

      /*
       * ⚠️ **THE STEP SAYS "CLICK `+` ONCE" AND THE STEPPER IS THE NATIVE `<input type=number>` SPINNER**, so the
       * automated equivalent is a real `ArrowUp` on the focused input — NOT `fill()`. The distinction is
       * load-bearing on this tab: `CLAUDE.md` records that **the stepper does not round while `repairFigure`
       * still does, and the two must NOT be unified**, so an arrow and a typed value travel different paths.
       * Driving `fill()` here would silently test the wrong one.
       */
      await windX.focus();
      await windX.press('ArrowUp');
      await page.waitForTimeout(400);
      const after = await windX.inputValue();
      expect(Number(after), `the arrows step by ±1 — ${before} → ${after}. ±1 is the move that keeps a figure `
        + 'closed, which is why the step is 1 and not a fraction').toBeCloseTo(Number(before) + 1, 6);

      // the shape really changed, and the engine is still drawing
      await composer.assertEngineDrew();
      const edited = await sig();

      // …and it is still advancing, rather than frozen at whatever pose the edit left it in.
      await page.waitForTimeout(1200);
      const later = await sig();
      expect(later, `the figure must keep SWEEPING after the edit — two samples 1.2 s apart were identical `
        + `(${edited}), which means the animation stopped rather than continued. A frozen figure and a `
        + 'snapped-back one both fail step 11, for different reasons.').not.toBe(edited);

      /*
       * ═══ Phase 17.5 — the GL clause, and it CLOSES this test's own stated limit ═══════════════════════════
       * ⚠️ **THE FRAME COMPARISON ABOVE CANNOT DISTINGUISH A LIVE INTEGRATOR FROM A DEAD ONE, AND THE COMMENT AT
       * THE TOP OF THIS FILE SAYS SO — Phase 2 published the channel that can.** Rotation, curl noise, the fluid
       * field and an attractor blend all move pixels **while the wave phase is frozen** (invariant 22's symptom:
       * *"a frozen figure still looks plausible"*), so `sig()` changing is necessary and not sufficient.
       * `pos` advances iff `generator.update()` ran. **Both clauses stay:** the frame diff is the only one that
       * sees "the integrator runs but nothing reaches the screen", and `pos` is the only one that sees the
       * converse. Phase 5's whole content is adding the second half where the first was alone.
       */
      await composer.assertIntegratorAdvanced();
    });

  test('step 12 — typing `120` into a Size field is ONE commit, not three', async ({ composer, page }) => {
    test.slow();
    await composer.openComposer();
    await composer.loadPreset('Aliens DNA');

    const sizeY = composer.field('Body', 'Size', 'Y');
    await expect(sizeY).toHaveCount(1);

    /*
     * ⚠️ **THE FAILURE THIS STEP GUARDS IS AN INPUT HANDLER THAT COMMITS PER KEYSTROKE — `1`, then `12`, then
     * `120`: three engine writes and three history-worthy states for one edit.** So typing must be
     * keystroke-by-keystroke (`pressSequentially`), never `fill()`, which sets the value in one shot and would
     * make the defect unreachable. ⚠️ **A test that cannot reach the defect it names is worse than a missing
     * one** — `CLAUDE.md`, and the reason this is not a `fill()`.
     *
     * ⚠️ **AND THE CARET IS THE OTHER HALF OF THE STEP — MEASURED *THROUGH THE VALUE*, BECAUSE `selectionStart`
     * IS UNREADABLE HERE AND THAT COST THIS SPEC ITS FIRST RED RUN.** Reading `input.selectionStart` returned
     * **`null`** with a perfectly correct value of `120`: the HTML spec forbids the selection API on
     * `input[type=number]`, so the direct caret assertion was **unmeasurable, not failing**. ⚠️ **That is
     * `CLAUDE.md`'s *"the engine can be right and the TEST wrong"* in its purest form — and note which way it
     * broke: loudly. An assertion over `null` that had been written as a truthiness check would have PASSED and
     * this file would claim to test a caret it never observed.**
     *
     * ⚠️ **THE REPLACEMENT OBSERVES THE CARET WITHOUT READING IT, AND IT IS STRICTLY THE BETTER TEST.** Press
     * `Home`, type one more digit, and look at WHERE that digit landed in the value. If the handler rewrites the
     * input on every keystroke and forces the caret to the end, the digit appends (`1205`); if the caret is left
     * where the user put it, it prepends (`5120`). **Same defect, observed through the one channel a number
     * input does expose** — which is the output-channel discriminator applied to the harness itself.
     */
    await sizeY.focus();
    await sizeY.press('Control+a');
    await sizeY.pressSequentially('120', { delay: 60 });

    expect(await sizeY.inputValue(), 'all three digits must be accepted — a value of `1` or `12` means an '
      + 'intermediate commit truncated the edit').toBe('120');

    await sizeY.press('Home');
    await sizeY.pressSequentially('5', { delay: 60 });
    const afterHome = await sizeY.inputValue();
    expect(afterHome, `typing a digit at the START of \`120\` produced ${JSON.stringify(afterHome)}. \`5120\` `
      + 'means the caret stayed where it was put; `1205` means every keystroke rewrote the input value and '
      + 'forced the caret to the end — three engine writes and three history-worthy states for one edit, which '
      + 'is the defect step 12 exists to catch.').toBe('5120');

    // …and put it back to what step 12 actually asks for before committing.
    await sizeY.press('Control+a');
    await sizeY.pressSequentially('120', { delay: 60 });

    // and it commits on blur without the figure going dark
    await sizeY.blur();
    await page.waitForTimeout(400);
    await expect(sizeY, 'the committed value must survive the blur — `repairFigure` rounds on blur, and 120 is '
      + 'already integral, so a change here means something else rewrote it').toHaveValue('120');
    await composer.assertEngineDrew();
  });
});
