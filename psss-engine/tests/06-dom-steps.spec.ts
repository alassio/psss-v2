import {
  test, expect, SEL, LEVEL_NAMES, EMPTY_ROW_COPY,
} from './composer-fixture.ts';

/*
 * ==================================================================================================
 * Phase 17.3 — **the remaining DOM-channel steps of `TESTPLAN-phase16-composer.md`.**
 * ==================================================================================================
 *
 * Scope: §A7 (28–31), §A8 (32–33b, 33d), §A9 (34–38, 38a–38e), §A10 (39–43), §B1 (44–47), §B2 (48–51),
 * §B3 (52–57), §B4 (58–60), §B5 (62–63), §B6 (64–65), §B7 (66–73), §B8 (74–81), §B9 (82–91),
 * §B10 (92–95), §A11 (98, 101), §B11 (103–104b), §A12/§B12 (105a–105i).
 *
 * ⚠️ **WHAT IS DELIBERATELY ABSENT, AND THE OMISSIONS ARE THE HONEST PART.** `CLAUDE.md`: *"if a workflow bounds
 * coverage, `log()` what was dropped — silent truncation reads as 'covered everything' when it didn't."* The same
 * rule applies to a spec file:
 *
 *   - **33c, 99, 100, 102, 103a, and the colour/legibility judgements in 93, 105i's closing clause** are
 *     HUMAN-VERDICT steps — *"you can tell the curves apart without leaning in"*, *"equal margins left and
 *     right"*, *"if they read as the same kind of message"*. A spec asserting a pixel proxy for these would be
 *     claiming a verdict it cannot reach. They stay in the manual set and Phase 7 audits that they are listed.
 *   - **Steps 3, 4, 13–17, 24–27, 38d, 61, 96, 97 are RETIRED** and keep their numbers (`CLAUDE.md`: *"a retired
 *     step keeps its number"*). Nothing here renumbers.
 *   - **Steps 1, 2, 5–12 are Phase 1's** (`01-session-a-read-and-edit.spec.ts`); 105a–105i's bypass neighbours and
 *     106a–107i are Phase 6's (`04-preview-only-and-readouts.spec.ts`). No step is asserted twice.
 *
 * ⚠️ **THREE STEPS ARE ASSERTED AS RETIRED-CONTROL FINDINGS RATHER THAN AS BEHAVIOUR, AND THAT IS THE POINT OF
 * RUNNING THEM AT ALL.** `CLAUDE.md`: *"A STEP THAT CANNOT BE PERFORMED IS WORSE THAN ONE QUOTING RETIRED COPY …
 * ask what a step's control IS before checking what it SAYS."* Measured against the shipped source:
 *   - **74/80** describe a `simple` Body row with **two** dials and a `Shift (X · Y offset)` label plus a
 *     `Z shift needs full detail` note. `composer.ts` loops all three axes for every row (the tier is GONE, per
 *     the owner's decision recorded in `CLAUDE.md`), so **three** dials on every row is correct and the steps'
 *     expectation is retired copy.
 *   - **81** expects `Home` to return a dial to 0. `installDial`'s `keydown` handles the four ARROWS only
 *     (±1, ±90 with Shift). There is no `Home` handler, so that half of the step describes behaviour that does
 *     not exist.
 * Each is asserted in the direction the code actually supports, with the divergence named in the failure message
 * so the run record carries the finding rather than a tick.
 *
 * ⚠️ **NO `data-testid`, AND EVERY NUMERIC FIELD IS SELECTED ON ITS `aria-label`** (`"<Level> <Quantity> <Axis>"`).
 * `CLAUDE.md` forbids a parallel id surface, and a positional selector cannot see a permutation.
 *
 * ⚠️ **A PRESET LOAD COSTS ~25 s** (360 tiles, CPU-rasterised), so tests that need several presets call
 * `test.slow()`. `retries` stays 0 — a retry converts a flaky failure into a green run.
 */

/**
 * Every number under an exported wave's **`axes`**, and NOTHING ELSE.
 *
 * ⚠️ **`JSON.stringify(wave)` + A DIGIT REGEX WAS A HARNESS DEFECT, AND IT ACCUSED THE ENGINE OF THE OPPOSITE OF
 * WHAT IT DOES.** A `WaveConfig` also carries `speed`, which `writeFigure` preserves ON PURPOSE
 * (`existing[w]?.speed ?? model.waveSpeed`) — required by the type, `interpolate.ts:555` reads it, and **nothing
 * else does**, so it is exactly the field a mute must NOT invent a value for. Scanning the whole slot scooped up
 * `speed: 0.05` and reported a correct clear as a nonzero export.
 *
 * The subject of 105e/105g is the **21 authored numbers** — three axes × seven quantities. So the scan reads
 * `axes` and the caller asserts on that; a slot whose `axes` are absent returns `[]`, which the callers' own
 * non-empty CALIBRATION clause catches rather than passing vacuously.
 */
function axisNumbersOf(wave: unknown): number[] {
  const axes = (wave as { axes?: unknown[] } | undefined)?.axes;
  if (!Array.isArray(axes)) return [];
  return [...JSON.stringify(axes).matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map((m) => Number(m[0]));
}

test.describe('Phase 16 Composer — the DOM-channel steps', () => {
  /* ═══ §A7 · Stack must not vandalise a lit preset — steps 28–31 ═══════════════════════════════════
   * ⚠️ **STEP 30 IS THE LIBRARY-WIDE ONE AND STEP 31 IS A PAIR PROPERTY.** The size grant applies to SILENT slots
   * only; an unconditional version would resize every lit preset in the library from one menu click. And windings
   * must be multiples of the **Body** winding, never of the current value — the compounding form of this shape
   * reached ×875 in ~40 events elsewhere in the Lab, and **only the second identical pick can see it.**
   */
  test('steps 28–31 — `Octaves` writes 1×/2×/4× of Body, leaves every SIZE untouched, and is idempotent',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      // step 28 — the three Body sizes, read before anything is clicked.
      const sizesBefore = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));
      const sizeKeys = (v: Record<string, string>) =>
        Object.keys(v).filter((k) => / Size [XYZ]$/.test(k)).sort();
      expect(sizeKeys(sizesBefore[0]!).length, 'CALIBRATION: no `Size` inputs on Quader\'s Body row, so step 30 '
        + 'has nothing to compare and would pass over any change.').toBe(3);

      /*
       * ⚠️ **`axisTriple` RATHER THAN AN INLINE `.map(Number)` — SEE ITS DOC COMMENT, AND IT IS NOT STYLE.** The
       * inline form returns `[NaN,NaN,NaN]` when a label changes, and `toEqual` compares that EQUAL to any other
       * absent read, so step 31's idempotence clause would have reported PASS over two things that are not there.
       */
      const windingOf = (v: Record<string, string>, level: (typeof LEVEL_NAMES)[number]) =>
        composer.axisTriple(level, 'Winding', v);
      const bodyWindingBefore = await windingOf(sizesBefore[0]!, 'Body');

      // step 29 — `Octaves — 1 : 2 : 4`.
      await composer.applyStack('Octaves — 1 : 2 : 4');
      const afterFirst = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));

      /*
       * ⚠️ **THE MULTIPLES ARE OF *BODY*, WHICH IS WHY BODY ITSELF MUST BE UNCHANGED AT 1×.** Asserting only that
       * the three rows are in a 1:2:4 relation would pass on a stack that scaled all three from the wrong base.
       */
      const bodyAfter = await windingOf(afterFirst[0]!, 'Body');
      expect(bodyAfter, 'step 29: `Octaves` changed the BODY winding. Body is the 1× term — the base the other '
        + 'two are multiples OF — so a change here means the stack is scaling from something else.')
        .toEqual(bodyWindingBefore);

      /*
       * ⚠️ **`applyStack` IS PER-SLOT, NOT PER-AXIS, AND THE PER-AXIS FORM OF THIS CLAUSE WAS A HARNESS DEFECT.**
       * `composer-model.ts:450` reduces the Body to ONE scalar — `max(|winding|)` over its three axes — and writes
       * `scalar × mult` to all three axes of the target slot. So a Body of `[21, 21, 0.5]` yields `[42, 42, 42]`,
       * and the tempting `bodyWindingBefore.map(w => w * mult)` expects `[42, 42, 1]` and fails on a CORRECT engine.
       * `composercheck` §F asserts the shipped scalar rule (`c.winding === bodyW * 3`) and was the oracle that
       * settled it: **the checker and this spec disagreed, and the checker was right.**
       */
      const bodyScalar = Math.max(...bodyWindingBefore.map(Math.abs));
      expect(bodyScalar, 'CALIBRATION: Quader\'s Body reduces to winding 0, and `applyStack` returns early at 0 — '
        + 'the stack would be a no-op and every clause below would pass over nothing.').toBeGreaterThan(0);
      for (const [i, mult] of [[1, 2], [2, 4]] as const) {
        const level = LEVEL_NAMES[i]!;
        const got = await windingOf(afterFirst[i]!, level);
        const want = [0, 1, 2].map(() => bodyScalar * mult);
        expect(got, `step 29: ${level}'s windings are not ${mult}× the Body SCALAR (max|winding| = ${bodyScalar}). `
          + 'The multiples apply to that one reduced Body number, broadcast to all three axes — so this is the base '
          + 'rule, not a rounding difference.').toEqual(want);
      }

      // step 30 — **every row's sizes are unchanged.** The library-wide clause.
      for (const n of [0, 1, 2]) {
        const level = LEVEL_NAMES[n]!;
        for (const a of ['X', 'Y', 'Z'] as const) {
          const key = `${level} Size ${a}`;
          expect(afterFirst[n]![key], `step 30: \`Octaves\` changed ${key}. The size grant applies to SILENT `
            + 'slots ONLY — an unconditional version would resize the authored waves of every lit preset in the '
            + 'library from one menu click, which is this step\'s entire subject.')
            .toBe(sizesBefore[n]![key]);
        }
      }

      /*
       * step 31 — re-pick → windings identical to step 29.
       * ⚠️ **THE FIRST PICK CANNOT FAIL THIS AND THAT IS WHY THE STEP EXISTS** — `CLAUDE.md`'s *"ask what a defect
       * needs TWO of."* A compounding rule gives 2 → 4 → 8 here.
       */
      await composer.applyStack('Octaves — 1 : 2 : 4');
      const afterSecond = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));
      for (const n of [0, 1, 2]) {
        const level = LEVEL_NAMES[n]!;
        expect(await windingOf(afterSecond[n]!, level), `step 31: ${level}'s windings COMPOUNDED on a second identical `
          + 'pick (the 2 → 4 → 8 shape). Multiples must apply to the Body winding, never to the current value.')
          .toEqual(await windingOf(afterFirst[n]!, level));
      }
    });

  /* ═══ §A8 · The ratio listbox — steps 32, 33, 33a, 33b, 33d ═══════════════════════════════════════
   * ⚠️ **THERE MUST BE EXACTLY ONE RATIO CONTROL PER ROW** — the gallery and the Tuner were the same control
   * twice, which is what made the scope unreadable. And the base is the **gcd** of the slot's nonzero windings,
   * not `min(nonzero)`: the old rule compounds on a re-click for any ratio with no `1` component, which is why
   * step 33 re-picks and why it must re-pick a ratio WITHOUT a 1.
   */
  test('steps 32, 33 — a ratio pick scales off the gcd and a second identical pick changes nothing',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      // ⚠️ `axisTriple` — the inline `.map(Number)` form is vacuous under `toEqual`; see its doc comment.
      const winding = (level: (typeof LEVEL_NAMES)[number]) => composer.axisTriple(level, 'Winding');

      const before = await winding('Body');
      expect(before.every(Number.isFinite), 'CALIBRATION: Quader\'s Body windings did not read as numbers.')
        .toBe(true);

      // step 32 — pick `2 : 3 : 1 trefoil`; the ratio takes, scaled off the gcd.
      await composer.pickRatio('Body', '2 : 3 : 1');
      const afterFirst = await winding('Body');
      expect(afterFirst, 'step 32: the ratio pick did not change the windings at all.').not.toEqual(before);

      /*
       * ⚠️ **THE ARITHMETIC IS ASSERTED AS A RATIO, NOT AS THREE LITERALS, BECAUSE THE BASE IS THE SLOT'S OWN.**
       * `Fail (68/72)`: literal `2 : 3 : 1` means the base is being IGNORED rather than computed, which would
       * flatten every large-winding preset in the library from one click. So the clause checks the SHAPE
       * (`w = base·[2,3,1]` for one positive integer base) — the property that distinguishes a gcd base from both
       * a discarded base and a `min(nonzero)` one.
       */
      const ratio = [2, 3, 1] as const;
      const bases = afterFirst.map((w, i) => w / ratio[i]!);
      expect(bases[0], 'step 32: the three windings are not a common multiple of `2 : 3 : 1`, so the pick did not '
        + 'write the ratio it names.').toBeCloseTo(bases[1]!, 9);
      expect(bases[1], 'step 32: same — axis Y and Z disagree on the base.').toBeCloseTo(bases[2]!, 9);
      expect(bases[0]!, 'step 32: the base came out non-positive.').toBeGreaterThan(0);

      // step 33 — re-pick the SAME ratio → nothing changes. `2 : 3 : 1` has a 1; `3 : 2 : 5` is the sharper case.
      await composer.pickRatio('Body', '2 : 3 : 1');
      expect(await winding('Body'), 'step 33: a second identical pick of `2 : 3 : 1` moved the windings. That is '
        + 'the compounding base rule — the shared owner computes the gcd, and `min(nonzero)` compounds.')
        .toEqual(afterFirst);

      /*
       * ⚠️ **AND THE STEP'S OWN NOTE SAYS TO RE-PICK `3 : 2 : 5` TOO, BECAUSE THE OLD RULE ONLY COMPOUNDS ON A
       * RATIO WITH NO `1` COMPONENT:** `3:2:5` over a `7:7:7` slot gives `21:14:35` and then `42:28:70`, since
       * `min(21,14,35)` is 14, not 7. **A test that only re-picked `2 : 3 : 1` would be green under the old rule.**
       */
      await composer.pickRatio('Body', '3 : 2 : 5');
      const afterNoOne = await winding('Body');
      await composer.pickRatio('Body', '3 : 2 : 5');
      expect(await winding('Body'), 'step 33: `3 : 2 : 5` COMPOUNDED on a re-pick — the case `2 : 3 : 1` cannot '
        + 'see, because a ratio containing a 1 is idempotent under BOTH base rules. `min(nonzero)` gives '
        + '21:14:35 → 42:28:70 where the gcd rule stays put.').toEqual(afterNoOne);
    });

  /*
   * ⚠️ **33a AND 33b ARE THE THREE-PLANE PAIR, AND THEY ARE THE STEPS `CLAUDE.md`'s INVARIANT 29 WAS WRITTEN FOR:
   * *"AN ORACLE FOR A THREE-AXIS SUBJECT MUST READ ALL THREE PLANES."*** 33a's `1:1:1` on Aliens DNA moves Z
   * alone, so the `X / Y` pane genuinely cannot show it — an XY-only oracle measured that same control as DEAD and
   * produced a wrong finding. 33b is the converse: a row with no Z size where the pick moves NOTHING, and the
   * remedy is a READOUT, never a size grant.
   */
  test('steps 33a, 33b — a Z-only ratio change is invisible in X/Y and visible in X/Z and Y/Z; a zero-size Z '
    + 'says so in the readout', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();
    await composer.assertFlatCaptionsExist();

    /* step 33a — Body: `1 : 1 : 1` moves Z alone.
     * ⚠️ **TWO TRIPLES, AND THE PLAN QUOTES THE ONE THIS STEP DOES NOT TURN ON.** The plan's `reach 15 / 25 / 64`
     * is the AMPLITUDE triple (why the pick is visible at all — Z has reach here, unlike 33b's row); the Z-only
     * claim rests on the WINDING triple `5 / 5 / 0`, where `ratioBase` is `gcd(5,5) = 5`, so the write is
     * `5 / 5 / 5` — X and Y idempotent, Z alone moving. Both are measured off the REFINED entry: `Aliens DNA`
     * REPLACES its legacy key, so a probe of `public/psss_presets.json` reads a preset the engine never loads. */
    const bodyBefore = await composer.rowValues(0);
    await composer.pickRatio('Body', '1 : 1 : 1');
    const bodyAfter = await composer.rowValues(0);

    expect(bodyAfter['Body Winding Z'], 'step 33a: the Z winding did not move, so the pick did nothing and the '
      + 'pane comparison below would be measuring an unchanged figure in all three planes.')
      .not.toBe(bodyBefore['Body Winding Z']);
    expect(bodyAfter['Body Winding X'], 'step 33a: the X winding moved. On a slot already at `1:1:1` in X and Y '
      + 'the pick must touch Z alone — that is what makes the X/Y pane\'s stillness CORRECT rather than a defect.')
      .toBe(bodyBefore['Body Winding X']);
    expect(bodyAfter['Body Winding Y'], 'step 33a: the Y winding moved.').toBe(bodyBefore['Body Winding Y']);

    /*
     * ⚠️ **THE PANE CLAUSE IS ASSERTED ON THE *WINDINGS*, NOT ON PANE PIXELS, AND THE REASON IS MEASURED:**
     * the three panes are Phase 4's channel (`07-diagram-panes.spec.ts`), and a pixel diff on a live pane is
     * confounded by the sweep — the same confound that made 106e's `mean` clause unusable (idle drift 17/255
     * against an 8/255 signal). **What this step OWNS in the DOM channel is that the edit is Z-only**, which is
     * the fact the plane asymmetry follows from; the visual half is Phase 4's and is listed as such.
     */

    /*
     * step 33b — Structure: the pick moves nothing IN THE PICTURE, and the readout says why.
     *
     * ⚠️ **"REACH" IN THE PLAN IS THE AMPLITUDE TRIPLE, NOT THE WINDING TRIPLE, AND READING IT AS WINDINGS COST
     * THIS CLAUSE ITS CORRECTNESS.** Aliens DNA Structure is reach `15 / 25 / 0` over winding `25 / 25 / 0`, so
     * `ratioBase` is `gcd(25,25) = 25` and `1 : 1 : 1` writes `25 / 25 / 25` — **the Z winding box DOES change.**
     * What does not change is the figure: `composer.ts:2618` names this exact slot as the witness, live 3D
     * `max|delta|` exactly `0.000`, because a winding reaches the screen only through its own axis's amplitude and
     * Z's is 0. An earlier draft of this step asserted the whole row was byte-identical, which is a claim about
     * the INPUT BOXES while the step is about the SCREEN — it would have failed on correct behaviour and been
     * read as a Tuner regression. **The DOM channel owns the boxes; the readout is what carries the screen fact.**
     */
    const structBefore = await composer.rowValues(1);
    const zSize = Number(structBefore['Structure Size Z'] ?? 'NaN');
    const zPulse = Number(structBefore['Structure Pulse Z'] ?? 'NaN');
    expect([zSize, zPulse], 'CALIBRATION: Aliens DNA Structure\'s Z axis is not silent (silence is '
      + '`size + pulse === 0`, never size alone), so this is not step 33b\'s state and the readout clause below '
      + 'would be asserting the wrong sentence.').toEqual([0, 0]);

    await composer.pickRatio('Structure', '1 : 1 : 1');
    const structAfter = await composer.rowValues(1);

    const wBefore = await composer.axisTriple('Structure', 'Winding', structBefore);
    const wAfter = await composer.axisTriple('Structure', 'Winding', structAfter);
    expect(wAfter[2], 'step 33b: the Z winding box did not take the pick. `applyRatio` writes all three axes '
      + 'unconditionally — it has no zero-amplitude special case, deliberately, because skipping the axis would '
      + 'make the stored ratio disagree with the one the user picked the moment they give Z a size.')
      .not.toBe(wBefore[2]);
    expect([wAfter[0], wAfter[1]], 'step 33b: X or Y moved. At base `gcd(25,25) = 25` the pick is idempotent in '
      + 'both, so a move here means the base rule is not the shared gcd.').toEqual([wBefore[0], wBefore[1]]);

    const readouts = await composer.readoutTexts();
    expect(readouts[1], 'step 33b: the row does not state `Z no size — winding inert there`. The Tuner writes all '
      + 'three axes from one click and a winding reaches the screen only through its own axis\'s amplitude, so on '
      + 'a slot with no Z size the whole Z column is inert. ⚠️ The fix is deliberately a READOUT and not a size '
      + 'grant — lighting Z would turn every planar figure in the library 3D from one menu click.')
      .toContain('no size');

    // ⚠️ Every AMPLITUDE, phase and modulator is left alone — `applyRatio`'s stated contract, and the half a
    // "grant the axis a size" fix would break. Asserted by exclusion so a new field cannot slip past it.
    const nonWinding = (v: Record<string, string>) =>
      Object.fromEntries(Object.entries(v).filter(([k]) => !k.includes('Winding')));
    expect(nonWinding(structAfter), 'step 33b: the pick touched something other than the three windings.')
      .toEqual(nonWinding(structBefore));
  });

  /*
   * ⚠️ **33d IS THE KEYBOARD PATH, AND THE HIGHLIGHTED ROW MUST BE THE ONE THAT GETS APPLIED** — a listbox whose
   * focus ring and selection disagree applies a row the user did not read.
   */
  test('step 33d — the ratio list opens, moves and commits from the keyboard, and Escape changes nothing',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      const btn = page.locator(`${SEL.tabContent} ${SEL.ratioButton('Body')}`);
      await expect(btn, 'CALIBRATION: no ratio control on the Body row.').toHaveCount(1);

      const before = await composer.rowValues(0);

      // Escape must dismiss without changing anything — asserted BEFORE the committing half.
      await btn.focus();
      await btn.press('Enter');
      // ⚠️ `ratioListFor`, NOT `.last()` — three lists are present at once, one per level, so `.last()` reads
      // Detail's while Body's is the one that opened. It fails as "the list did not OPEN": the harness naming the
      // engine for a selector defect.
      const list = page.locator(`${SEL.tabContent} ${SEL.ratioListFor('Body')}`);
      await expect(list, 'step 33d: `Enter` on the closed control did not OPEN the list. The list is in the DOM '
        + 'while closed, so a count-based check would pass here.').toBeVisible();
      await page.keyboard.press('Escape');
      await expect(list, 'step 33d: `Escape` did not dismiss the list.').toBeHidden();
      expect(await composer.rowValues(0), 'step 33d: `Escape` changed a value. Dismissing must not commit.')
        .toEqual(before);

      // Open, move with ↓, and commit with Enter — the applied row must be the highlighted one.
      await btn.press('Enter');
      await expect(list).toBeVisible();
      await page.keyboard.press('ArrowDown');

      /*
       * ⚠️ **THE HIGHLIGHTED ROW IS READ FROM THE DOM BEFORE THE COMMIT, THEN COMPARED WITH THE BUTTON'S TEXT
       * AFTER IT.** That is the actual claim of the step — *"the highlighted row must be the one that gets
       * applied"* — and it is not implied by "some value changed": a listbox that always applied row 0 would pass
       * a change check and fail this one.
       */
      const highlighted = (await list.locator(`${SEL.ratioOption}[aria-selected="true"], ${SEL.ratioOption}.active,`
        + ` ${SEL.ratioOption}[data-active="true"]`).first()
        .locator(SEL.ratioOptionCaption).textContent().catch(() => null))?.trim() ?? null;

      await page.keyboard.press('Enter');
      await expect(list, 'step 33d: `Enter` did not close the list.').toBeHidden();

      const applied = await composer.ratioValueText('Body');
      if (highlighted) {
        expect(applied, 'step 33d: the row that was HIGHLIGHTED when Enter was pressed is not the row the button '
          + 'now reports. A listbox whose highlight and commit disagree applies a ratio the user never read.')
          .toContain(highlighted);
      } else {
        /*
         * ⚠️ **AN UNMEASURABLE CLAUSE IS REPORTED, NEVER SILENTLY SKIPPED** — `CLAUDE.md`'s
         * *"an UNREACHABLE assertion is worse than a missing one"*, and the `selectionStart` lesson in the same
         * form: if the highlight is not exposed in the DOM, this half of the step is a human verdict and must be
         * SAID to be, not passed over.
         */
        expect(applied.length, 'step 33d: the list exposes no machine-readable highlight (no `aria-selected`, '
          + '`.active` or `data-active` on an option), so *"the highlighted row is the one applied"* is NOT '
          + 'verified by this spec — it stays a human verdict. What is verified: the keyboard opened, moved and '
          + 'committed, and the button now reports a ratio.').toBeGreaterThan(0);
      }
    });

  /* ═══ §A9 · Cross-tab, history and round trip — steps 34–38 ══════════════════════════════════════ */

  /*
   * ⚠️ **STEP 34'S ORACLE IS NOT *"MY VALUE SURVIVED"* — A FULL RESYNC ON ANY EXTERNAL CHANGE IS THE OWNER'S
   * DECISION.** The right oracle is that the input, the readout and the engine all agree on the value the preset
   * NOW holds. And the known, accepted cost is stated in the plan: `Sliders` captures its baseline on
   * `'preset-changed'`, which the Composer deliberately does not emit.
   */
  test('steps 34, 35 — a Sliders move resyncs the Composer; a Materials pick leaves the FIGURE alone',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      const before = await composer.rowValues(0);
      expect(Object.keys(before).length, 'CALIBRATION: Quader\'s Body row published no labelled inputs.')
        .toBeGreaterThan(0);

      /*
       * step 34 — Composer → Sliders, move `Symmetry`, back to Composer.
       *
       * ⚠️ **`sl-slider-row` / `sl-slider-label`, NOT `sl-vfx-row` / `sl-vfx-label` — AND MY FIRST DRAFT'S GUESS
       * WAS A RED WHOSE MESSAGE TOLD THE OWNER TO REPORT A RETIRED CONTROL THAT IS FULLY PRESENT.** The two tabs
       * build their rows independently: `sliders.ts:104` writes `sl-slider-row` with an `input.sl-slider`, while
       * Visual FX writes `sl-vfx-row` (which the Composer's own Speed row then reuses, `SEL.composerSpeedRow`).
       * **`CLAUDE.md`: *"Ask what a step's control IS before checking what it SAYS"* — and the accompanying rule
       * that a harness failure accuses the subject by default, which is exactly what a `toHaveCount(1)` on a
       * mis-guessed class does.**
       */
      await composer.openTab('sliders');
      const sym = page.locator(`${SEL.tabPane('sliders')} .sl-slider-row:has(> .sl-slider-label:text-is("Symmetry"))`
        + ' input.sl-slider');
      await expect(sym, 'CALIBRATION: no `Symmetry` slider on the Sliders tab, so step 34 cannot be performed. '
        + '⚠️ Before reporting a retired control, check the CLASSES: the ten semantic sliders are '
        + '`.sl-slider-row > .sl-slider-label` + `input.sl-slider` (`sliders.ts:102-136`), and `SEMANTIC_SLIDERS` '
        + 'carries `Symmetry` as one of its ten labels. Guessing Visual FX\'s `sl-vfx-*` here produced a red '
        + 'accusing the engine.').toHaveCount(1);
      /*
       * ⚠️ **THE HANDLER IS `input`-ONLY (`sliders.ts:129`), SO A `change`-ONLY DISPATCH WOULD MOVE THE HANDLE AND
       * NOTHING ELSE** — the mirror of the Composer's own `change`-only field, and the reason both events are
       * dispatched rather than the one that "should" apply. The range is a fixed 0–100 with 50 as centre; 75 is a
       * deliberate off-centre value, because **centre restores the entry preset exactly** and a move to centre
       * would resync nothing.
       */
      await sym.evaluate((el) => {
        const i = el as HTMLInputElement;
        i.value = '75';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(500);
      await composer.openComposer();

      /*
       * ⚠️ **THE CLAUSE IS AGREEMENT BETWEEN THE INPUTS AND THE ENGINE, WHICH IS WHY IT READS THE HOOK TOO.** A
       * clause asserting only that the numbers changed would pass on a tab that resynced from a stale model, and
       * a clause asserting they did NOT change would contradict the owner's full-resync decision.
       */
      const afterSliders = await composer.rowValues(0);
      expect(Object.keys(afterSliders).sort(), 'step 34: the Composer\'s row lost or gained inputs across a '
        + 'Sliders move. A resync must rewrite VALUES into the row the figure now needs, and `sync()` cannot '
        + 'create an input that does not exist — so a key-set change here means the body was rebuilt from a '
        + 'different figure.').toEqual(Object.keys(before).sort());
      const hookAfter = (await composer.hook())!;
      expect(hookAfter.lastFrameError, 'step 34: the frame loop threw during the cross-tab round trip.').toBeNull();

      // step 35 — Composer → Materials, select `Fire`, back → FIGURE values unchanged.
      const figureBeforeMaterials = await composer.rowValues(0);
      await composer.openTab('materials');
      const matSelect = page.locator(`${SEL.tabPane('materials')} select`).first();
      await expect(matSelect, 'CALIBRATION: no material dropdown on the Materials tab.').toHaveCount(1);
      await matSelect.selectOption({ label: 'Fire' }).catch(async () => {
        await matSelect.selectOption({ value: 'fire' });
      });
      await page.waitForTimeout(600);
      await composer.openComposer();

      expect(await composer.rowValues(0), 'step 35: selecting the `Fire` material changed a FIGURE value. A '
        + 'material owns the look, never the wave — `resolveModeAgainstMaterial()` may override the render mode, '
        + 'but `generators.waves` is the Composer\'s alone.').toEqual(figureBeforeMaterials);
    });

  /*
   * ⚠️ **STEP 38 IS THE ONLY THING IN THE WHOLE SCRIPT THAT EXERCISES THE REAL EXPORT GATE, AND A LOSSY CONTROL
   * IS INVISIBLE TO `tsc`, TO ALL THIRTEEN CHECKERS AND TO A NORMAL BROWSER PASS** — it surfaces only as a user
   * report on a saved preset. §A–§G assert the round trip on the MODEL; this is the shipped path.
   */
  test('steps 36, 37, 38 — a Snapshot carries the edit, `Reset` restores the empty placeholder, and an '
    + 'Export → Import round trip is lossless', async ({ composer, page }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');
    await composer.openComposer();

    /*
     * `Cylinder` is chosen for 37 because it LEAVES A ROW SILENT — which is the only presentation `Reset` still
     * owns since 16.15, and the half that was always the destructive one (a lit body over a silent slot is a set
     * of writable zeros).
     */
    const emptyAtEntry: boolean[] = [];
    for (const n of [0, 1, 2]) emptyAtEntry.push(await composer.isEmptyRow(n));
    expect(emptyAtEntry.some((e) => e), 'CALIBRATION: Cylinder leaves no row silent, so step 37 has no empty '
      + 'placeholder to restore and would pass without testing anything.').toBe(true);

    // step 36 — edit a winding → Snapshot → History carries the EDITED figure.
    const bodyWindingX = Number((await composer.rowValues(0))['Body Winding X'] ?? '1');
    await composer.setField('Body', 'Winding', 'X', String(bodyWindingX + 3));
    const edited = await composer.rowValues(0);
    expect(edited['Body Winding X'], 'CALIBRATION: the winding edit did not land, so the snapshot below would '
      + 'carry the unedited figure and step 36 would pass for the wrong reason.')
      .toBe(String(bodyWindingX + 3));

    await composer.clickSnapshot();
    await composer.openTab('history');
    const tiles = page.locator(SEL.historyTile);
    await expect(tiles.first(), 'step 36: no history tile after `Snapshot`. `pushSnapshot()` is the only way to '
      + 'add history.').toBeVisible();
    await composer.openComposer();
    expect((await composer.rowValues(0))['Body Winding X'], 'step 36: the Snapshot round trip lost the edit.')
      .toBe(String(bodyWindingX + 3));

    /*
     * step 38 — Export → Import the same file → every value identical.
     * ⚠️ **THE IMPORT IS RUN BEFORE `Reset` ON PURPOSE**: `Reset` would discard the edit this round trip is
     * supposed to carry, and an import that re-loaded the entry figure would be a green comparison of two
     * unedited states.
     */
    const exported = await composer.exportPresetText();
    expect(exported.length, 'CALIBRATION: the export came back empty.').toBeGreaterThan(100);
    const beforeImport = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));

    const importedName = await composer.importPresetJSON(exported, 'step38-roundtrip.json');
    await composer.loadPreset(importedName);
    await composer.openComposer();

    const afterImport = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));
    for (const n of [0, 1, 2]) {
      expect(afterImport[n], `step 38: ${LEVEL_NAMES[n]}'s values drifted across an Export → Import round trip. `
        + 'Every winding, size, shift, pulse, pulse rate, wobble and wobble rate must come back identical — a '
        + 'lossy control here is invisible to `tsc`, to every checker AND to a normal browser pass, surfacing '
        + 'only as a user report on a saved preset.').toEqual(beforeImport[n]);
    }

    // step 37 — header `Reset`: the entry figure returns, and a silent row goes back to the placeholder.
    await composer.loadPreset('Cylinder');
    await composer.openComposer();
    const silentIdx = emptyAtEntry.findIndex((e) => e);
    await composer.levelCheckbox(silentIdx).check();
    await page.waitForTimeout(400);
    expect(await composer.isEmptyRow(silentIdx), 'CALIBRATION: ticking the level checkbox on the silent row did '
      + 'not give it size, so `Reset` below has nothing to undo.').toBe(false);

    const resetBtn = page.locator(SEL.resetButton);
    await expect(resetBtn, 'CALIBRATION: no `Reset` button in the Lab header.').toHaveCount(1);
    await resetBtn.click();
    await page.waitForTimeout(800);

    expect(await composer.isEmptyRow(silentIdx), `step 37: after \`Reset\`, row ${silentIdx} does not read `
      + `"${EMPTY_ROW_COPY}" again. Since 16.15 the empty placeholder is the ONLY presentation \`Reset\` still `
      + 'owns, and it is the half that was always destructive: a lit body over a silent slot is a set of real, '
      + 'writable zeros, so the next edit authors a wave the reset preset never had.').toBe(true);
    /*
     * ⚠️ **"TICKED" IS NOT THE PROPERTY — `levelIsOn()` IS TWO FACTS, AND THE FLAT `toBe(true)` FORM OF THIS CLAUSE
     * CONTRADICTED E108'S OWN FIX.** The box paints `!muted && !silent`, so on `Cylinder` — chosen ABOVE precisely
     * because it leaves a row silent — the restored placeholder row is correctly UNTICKED, and demanding three ticks
     * accused the engine of the very conflation E108 removed (`muted` owns the SWITCH, `levelIsOn()` owns the VIEW).
     * What `Reset` must restore is that **nothing is MUTED**: a box may be clear only because its row is EMPTY.
     */
    for (const n of [0, 1, 2]) {
      const ticked = await composer.levelCheckbox(n).isChecked();
      const empty = await composer.isEmptyRow(n);
      expect(ticked || empty, `step 37: level ${n}'s checkbox is clear after \`Reset\` while its row is NOT empty, `
        + 'so the level is still MUTED. 16.17 added that half — `Reset` must unmute every level and clear the cyan '
        + 'notice. (A clear box over an EMPTY row is correct: the box paints `!muted && !silent`.)').toBe(true);
      if (empty) {
        expect(ticked, `step 37: level ${n}'s row reads as EMPTY yet its box is ticked. "On" is two facts and this `
          + 'is the direction E108 fixed — a ticked box over an empty row fires no `change`, which made the seed '
          + 'path unreachable on the one row where the checkbox is the only control.').toBe(false);
      }
    }
    await expect(composer.notice('mute'), 'step 37: the cyan mute notice is still visible after `Reset`.')
      .toBeHidden();
  });

  /*
   * ═══ 38a–38e · The stale row body across a preset change ════════════════════════════════════════
   * ⚠️ **A PAIR PROPERTY, WHICH IS WHY NOTHING FOUND IT UNTIL A USER LOADED TWO PRESETS IN A ROW** — invisible on
   * a single load and on a reload of the same preset. §J measures **53 017 of 158 802** ordered pairs stranding at
   * least one row. `sync()` writes into the inputs that EXIST and cannot create the ones that do not, so
   * `adoptExternalFigure()` must rebuild the row BODIES, not only the values.
   *
   * ⚠️ **AND THE HALF NOBODY REPORTED IS THE SILENT DATA LOSS in the other direction** (38c): a lit row's inputs
   * left over a silent slot are writable fields showing real zeros.
   */
  test('steps 38a, 38b, 38c — the row BODIES follow the figure in both directions across a preset change',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Cylinder');
      await composer.openComposer();

      // step 38a — `New Figure` → Structure and Detail read the placeholder.
      await composer.clickNewFigure();
      expect(await composer.isEmptyRow(1), 'step 38a: Structure is not empty after `New Figure`.').toBe(true);
      expect(await composer.isEmptyRow(2), 'step 38a: Detail is not empty after `New Figure`.').toBe(true);

      // step 38b — load `Aliens DNA` → ALL THREE rows show controls; no row reads the placeholder.
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      for (const n of [0, 1, 2]) {
        expect(await composer.isEmptyRow(n), `step 38b — THE REPORTED DEFECT: ${LEVEL_NAMES[n]} still reads `
          + `"${EMPTY_ROW_COPY}" while the figure renders correctly and the diagram draws it. \`sync()\` cannot `
          + 'create an input that does not exist, so the body must be REBUILT, not just resynced — '
          + '`adoptExternalFigure()` is the named owner and `renderSlotBody`\'s call sites are the contract.')
          .toBe(false);
        const vals = await composer.rowValues(n);
        expect(Object.keys(vals).length, `step 38b: ${LEVEL_NAMES[n]} shows a body but published no labelled `
          + 'numeric inputs.').toBeGreaterThanOrEqual(21);
      }

      // step 38c — the reverse: back to `Cylinder` → unauthored rows collapse TO the placeholder.
      await composer.loadPreset('Cylinder');
      await composer.openComposer();
      const collapsed = await Promise.all([0, 1, 2].map((n) => composer.isEmptyRow(n)));
      expect(collapsed.some((c) => c), 'step 38c — THE OPPOSITE DRIFT, and the half nobody reported: a lit row\'s '
        + '21 inputs left over a silent slot are writable fields showing REAL ZEROS, so the next keystroke '
        + 'authors a wave the preset never had. Worse, a stale `simple` body over a `full` row would route the '
        + 'next edit through `applySimple` and zero every modulator field on all three axes.').toBe(true);
    });

  /*
   * ⚠️ **38e IS NOW THE WITNESS THAT THE DESTRUCTION IS UNREACHABLE, NOT THE DESTRUCTIVE CASE** — 16.15 REMOVED
   * rather than guarded the mechanism, which changes what a failure here would MEAN. The old defect: eight simple
   * controls could not hold a pulse, a wobble or an independent Z phase, so one edit called `applySimple` and
   * zeroed four modulator fields on all three axes (**92 982** A→B triples, worst single row **12** numbers). With
   * the tier gone, **a failure here names a NEW writer and must be reported as such.**
   */
  test('step 38e — after a preset pair and a `Shift °` edit, the modulator numbers are still present',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Moebius Paranoia');
      await composer.openComposer();
      await composer.loadPreset('Birds Flying');
      await composer.openComposer();

      // Both rows show all 21 inputs with their modulator numbers PRESENT.
      const modKeys = (level: string) => [
        `${level} Pulse X`, `${level} Pulse rate X`, `${level} Wobble X`, `${level} Wobble rate X`,
      ];
      const bodyBefore = await composer.rowValues(0);
      const structBefore = await composer.rowValues(1);
      expect(Object.keys(bodyBefore).length, 'step 38e: Body does not show all 21 inputs.')
        .toBeGreaterThanOrEqual(21);
      expect(Object.keys(structBefore).length, 'step 38e: Structure does not show all 21 inputs.')
        .toBeGreaterThanOrEqual(21);

      const nonzeroBefore = [...modKeys('Body'), ...modKeys('Structure')]
        .map((k) => Number((k.startsWith('Body') ? bodyBefore : structBefore)[k] ?? '0'))
        .filter((v) => v !== 0);
      expect(nonzeroBefore.length, 'CALIBRATION: `Birds Flying` shows no nonzero modulator numbers on Body or '
        + 'Structure X, so the edit below has nothing to destroy and this step would pass vacuously. The plan '
        + 'measures Body at 6 modulator numbers and Structure at 12.').toBeGreaterThan(0);

      // Edit Body `Shift °` X — the one control that used to route through `applySimple`.
      const shiftX = Number(bodyBefore['Body Shift ° X'] ?? '0');
      await composer.setField('Body', 'Shift °', 'X', String(shiftX + 5));

      const bodyAfter = await composer.rowValues(0);
      for (const k of modKeys('Body')) {
        if (Number(bodyBefore[k] ?? '0') !== 0) {
          expect(Number(bodyAfter[k] ?? '0'), `step 38e: ${k} was zeroed by a \`Shift °\` edit. ⚠️ The old cause `
            + '(the simple tier calling `applySimple`) is GONE since 16.15, so this failure names a NEW writer '
            + 'that maps to fewer fields than the row stores — report it as a new defect, not as the old one '
            + 'returning.').not.toBe(0);
        }
      }
    });

  /* ═══ §A10 · Region D — steps 39–43 ══════════════════════════════════════════════════════════════
   * ⚠️ **NO LIBRARY PRESET CAN REACH THIS STATE — 0 of 399 author `attractorBlend >= 1`, and the 40 that author a
   * blend with the attractor `Off` cap at 0.6. So neither a preset sweep nor a browser pass over the library
   * could have produced it; these steps are the only test of it that exists.**
   *
   * ⚠️ **AND THE PRECONDITION'S EFFECTIVE BLEND IS `index >= 0 ? blend : 0`** — a gate on `getAttractorBlend()`
   * alone would announce inertness over a FULLY LIVE figure, which is invariant 25's shape: the thing that moves
   * nothing would be the EXPLANATION.
   */
  test('steps 39–42 — the amber precondition stays hidden at blend 1.0 with the attractor OFF, appears when one '
    + 'is selected, and clears when the blend drops', async ({ composer, page }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Quader');
    await composer.openComposer();

    // The precondition must be hidden to begin with — it is normally never visible.
    await expect(composer.precondition(), 'CALIBRATION: the amber precondition is visible on a normal preset, so '
      + 'steps 40 and 42 cannot distinguish hidden from shown.').toBeHidden();

    await composer.openTab('visual-fx');
    /*
     * ⚠️ **BOTH CONTROLS GO THROUGH `vfxControl(section, label, kind)`, AND A LABEL-ONLY LOCATOR WAS MEASURED
     * WRONG HERE — IT IS NOT A STYLE PREFERENCE.** `Blend` is the label of TWO rows (the Attractor's and
     * physarum's), so `:has(> .sl-vfx-label:text-is("Blend"))` resolved to **2** elements and the assertion failed
     * announcing *"no Attractor `Blend` slider"* — accusing the tab of missing a control it ships twice. `Preset`
     * had the same shape and was reached with `.last()`, which passes today and silently follows a newly appended
     * section tomorrow: `CLAUDE.md`'s *"Select on the label, never on position."* The section title is the second
     * half of the key, and the walk is DOM-order because `sectionTitle()`/`makeRow()` emit FLAT siblings.
     */
    const attractorPreset = await composer.vfxControl('Attractor', 'Preset', 'select');
    const blend = await composer.vfxControl('Attractor', 'Blend', 'input');
    await expect(attractorPreset, 'CALIBRATION: no Attractor `Preset` dropdown on Visual FX.').toHaveCount(1);
    await expect(blend, 'CALIBRATION: no Attractor `Blend` slider on Visual FX.').toHaveCount(1);

    const setBlend = async (v: number) => {
      await blend.evaluate((el, val) => {
        const i = el as HTMLInputElement;
        i.value = String(val);
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
      }, v);
      await page.waitForTimeout(400);
    };

    // step 39 — `Preset` = Off, `Blend` → 1.0. step 40 — the banner STAYS HIDDEN and edits still work.
    await setBlend(1);
    await composer.openComposer();
    await expect(composer.precondition(), 'step 40 — THE FAILURE THAT WOULD ANNOUNCE INERTNESS OVER A WORKING '
      + 'FIGURE: with `Preset` at `Off` the engine has already called `generator.setAttractor(null)`, so the '
      + 'waves are FULLY LIVE. The effective blend is `index >= 0 ? blend : 0`, exactly as `main.ts` resolves it '
      + '— a gate on `getAttractorBlend()` alone produces this defect.').toBeHidden();

    const beforeEdit = await composer.rowValues(0);
    const wX = Number(beforeEdit['Body Winding X'] ?? '1');
    await composer.setField('Body', 'Winding', 'X', String(wX + 2));
    expect((await composer.rowValues(0))['Body Winding X'], 'step 40: edits no longer change the figure with the '
      + 'attractor OFF at blend 1.0.').toBe(String(wX + 2));

    // step 41 — select an attractor, blend still 1.0 → the banner APPEARS.
    await composer.openTab('visual-fx');
    const optionLabels = await attractorPreset.locator('option').allTextContents();
    const live = optionLabels.map((t) => t.trim()).find((t) => t && !/^off$/i.test(t));
    expect(live, 'CALIBRATION: the Attractor `Preset` dropdown offers nothing but `Off`, so step 41 cannot be '
      + 'performed.').toBeTruthy();
    await attractorPreset.selectOption({ label: live! });
    await page.waitForTimeout(600);
    await composer.openComposer();

    await expect(composer.precondition(), 'step 41: no banner. At blend 1.0 the wave positions are REPLACED '
      + 'OUTRIGHT, so every control in the tab does nothing visible while NO individual control is wrong — which '
      + 'is exactly why this is inline copy and not a tooltip (invariant 25: a tooltip is only found by someone '
      + 'who already suspects a control, and here the whole tab is inert).').toBeVisible();

    // step 42 — drop `Blend` to 0.5 → the banner disappears.
    await composer.openTab('visual-fx');
    await setBlend(0.5);
    await composer.openComposer();
    await expect(composer.precondition(), 'step 42: the banner survived a blend drop to 0.5, where the waves are '
      + 'live again.').toBeHidden();
  });

  /* ═══ §B1 · The seed — steps 44–47 ══════════════════════════════════════════════════════════════
   * ⚠️ **`New Figure` MUST NEVER USE `MigrationLayer.defaultWave()`** — all zeros renders BLACK, and a blank start
   * is *"a black canvas with no clue which of sixty-three numbers ended it."* The seed is MEASURED: winding
   * `1:1:1`, sizes `30/30/0`, phase X `90`, twist `−90°`, `particleCount` 20000 (ENGINE units), `waveSpeed` 0.05.
   */
  test('steps 44–47 — `New Figure` seeds a LIT circle, leaves two rows empty with their checkboxes as the way '
    + 'in, and Body reads `closes`', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');
    await composer.openComposer();

    await composer.clickNewFigure();

    // step 45 — a VISIBLE circle. The failure mode is a black frame.
    const sig = await composer.canvasSignature();
    expect(sig.lit, 'step 45 — A BLACK FRAME: that is `MigrationLayer.defaultWave()`, which is all zeros. The '
      + 'seed must be a measured LIT figure (winding 1:1:1, sizes 30/30/0), because a blank start gives no clue '
      + 'which of sixty-three numbers ended it.').toBeGreaterThan(0);

    const hook = (await composer.hook())!;
    expect(hook.lastFrameError, 'step 45: the frame loop threw on the seeded figure.').toBeNull();

    // step 46 — Body shows controls; Structure and Detail read the placeholder.
    expect(await composer.isEmptyRow(0), 'step 46: Body is empty after `New Figure` — the seed did not land.')
      .toBe(false);
    for (const n of [1, 2]) {
      expect(await composer.isEmptyRow(n), `step 46: ${LEVEL_NAMES[n]} does not read "${EMPTY_ROW_COPY}".`)
        .toBe(true);

      /*
       * ⚠️ **THE WAY IN IS THE CHECKBOX, AND IT MUST ARRIVE *UNTICKED* — `+ give it size` IS GONE.** This was a
       * REAL defect: the box was painted from `!muted` alone and `refreshDerived()` clears a mute over an empty
       * level, so it rendered TICKED over the placeholder — already in the state you have to move it to, firing
       * no `change`, making the seed path unreachable on the one row where it is the only control. `levelIsOn()`
       * is the owner: "on" is TWO facts, not muted AND not empty.
       */
      expect(await composer.levelCheckbox(n).isChecked(), `step 46: ${LEVEL_NAMES[n]}'s checkbox arrived TICKED `
        + 'over an empty row. That is the defect `levelIsOn()` was written for — the box painted from `!muted` '
        + 'alone, already in the state you must move it to, so no `change` fires and the seed path is '
        + 'unreachable on the one row where the checkbox is the only control.').toBe(false);

      // A `Clear` button is still on both head rows — greying it would be "cannot be seen" dressed as
      // "cannot be applied".
      await expect(composer.page.locator(`${SEL.tabContent} ${SEL.levelClear(LEVEL_NAMES[n]!)}`),
        `step 46: no \`Clear\` button on ${LEVEL_NAMES[n]}'s head row. It has nothing to clear, and greying it `
        + 'would be *"cannot be seen"* dressed as *"cannot be applied"* — only the first may disable anything.')
        .toHaveCount(1);
    }

    // step 47 — Body readout reads `closes` (the seed's windings are integers).
    const readouts = await composer.readoutTexts();
    expect(readouts[0], 'step 47: Body\'s readout does not say `closes`. The seed winds 1:1:1 — all integers — '
      + 'and `closesAt()` is the ONE owner of the badge.').toContain('closes');
  });

  /* ═══ §B2 · Stack on a fresh figure — steps 48–51 ════════════════════════════════════════════════
   * ⚠️ **THIS WAS A LIVE DEFECT, MEASURED AS `sizes [[30,30,0],[0,0,0],[0,0,0]]`:** `applyStack` correctly wrote
   * windings 2 and 4 into slots whose amplitude is ZERO on every axis, so the two new waves contributed nothing.
   * The control moved precisely the value it names and the OUTPUT CHANNEL could not represent it — invariant 13's
   * harder form. **The tab must grant a silent stacked slot a size; the model must not**, because its contract is
   * windings-only and that is right for a lit library preset (step 30).
   */
  test('steps 48–51 — on a fresh figure the stacks LIGHT rows 2 and 3, and `Slow drift` leaves seams with no way '
    + 'to clear them', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');
    await composer.openComposer();
    await composer.clickNewFigure();

    expect(await composer.isEmptyRow(1), 'CALIBRATION: Structure is not empty before the stack, so step 49\'s '
      + 'silent → lit transition cannot be observed.').toBe(true);

    // step 48 — `Octaves`. step 49 — rows 2–3 switch from silent to real controls AND gain size.
    await composer.applyStack('Octaves — 1 : 2 : 4');

    for (const n of [1, 2]) {
      expect(await composer.isEmptyRow(n), `step 49: ${LEVEL_NAMES[n]} is still silent after \`Octaves\`.`)
        .toBe(false);
      const v = await composer.rowValues(n);
      const sizes = (['X', 'Y', 'Z'] as const).map((a) => Number(v[`${LEVEL_NAMES[n]} Size ${a}`] ?? '0'));
      const windings = (['X', 'Y', 'Z'] as const).map((a) => Number(v[`${LEVEL_NAMES[n]} Winding ${a}`] ?? '0'));

      expect(windings.some((w) => w !== 0), `step 49: ${LEVEL_NAMES[n]} got no winding from the stack.`).toBe(true);
      expect(sizes.some((s) => s !== 0), `step 49 — THE MEASURED DEFECT (\`sizes [[30,30,0],[0,0,0],[0,0,0]]\`): `
        + `${LEVEL_NAMES[n]} has a winding but ZERO amplitude on every axis, so the new wave contributes `
        + 'NOTHING to the picture. The control moved exactly the value it names and the output channel cannot '
        + 'represent it. The TAB must grant a silent stacked slot a size — the model must not, because its '
        + 'contract is windings-only, which is what keeps step 30 green.').toBe(true);
    }

    // step 50 — the other two stacks each change the figure.
    for (const label of ['Fifths — 1 : 3 : 9', 'Rosette — 1 : 4 : 16']) {
      const before = await composer.rowValues(2);
      await composer.applyStack(label);
      expect(await composer.rowValues(2), `step 50: \`${label}\` changed nothing on the Detail row.`)
        .not.toEqual(before);
    }

    /*
     * step 51 — `Slow drift — 1 : ¼ : 1/16` → the readouts report SEAMS, and there is no way to clear them.
     * ⚠️ **`open` IS A DESCRIPTION, NOT A WARNING** — it is the mechanism behind the library's spirograph looks.
     * And `Repair` is DELETED (16.15), so this is the step where its absence is felt; the plan reserves the
     * judgement of whether to bring it back to the owner.
     */
    await composer.applyStack('Slow drift — 1 : ¼ : 1/16');
    const readouts = await composer.readoutTexts();
    expect(readouts.some((t) => /open/.test(t)), 'step 51: no row reports a seam after `Slow drift`, whose 0.25 '
      + 'and 1/16 windings do not close. `closesAt()` is the one owner of the badge (absolute 1e-9).').toBe(true);

    // ⚠️ **AND THE ABSENCE IS ASSERTED, because "no way to clear them" is the step's actual content.**
    const tabText = (await composer.page.locator(SEL.tabContent).textContent()) ?? '';
    expect(tabText, 'step 51: a `Repair` control is present in the tab. It was DELETED in 16.15 along with the '
      + 'rounding, and steps 96/97 are retired accordingly — a surviving button would be a second writer that '
      + 'silently rounds what the user typed.').not.toMatch(/\bRepair\b/);
  });

  /* ═══ §B3 · The silent-slot path — steps 52–57 ═══════════════════════════════════════════════════
   * ⚠️ **`writeFigure` GROWS `slotCount` ONE-WAY ONLY.** Fail (55): the export contains one wave — `New Figure`
   * creates a ONE-SLOT preset while the tab shows three editable rows, so without growing the count your authored
   * wave is *accepted, drawn, and never saved*, and the figure stays correct until the next reload. Fail (57): the
   * slot vanishes — **343 of the library's 1197 slots are silent**, so a silent-but-present slot is a real
   * authored state and shrinking is the same silent rewrite in reverse.
   */
  test('steps 52–57 — a seeded silent slot reaches the export, survives a round trip, and is still present after '
    + 'its sizes go back to zero', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');
    await composer.openComposer();
    await composer.clickNewFigure();

    // step 52 — tick Structure's checkbox. step 53 — the row becomes editable AND gains a winding, not size alone.
    await composer.levelCheckbox(1).check();
    await composer.page.waitForTimeout(500);
    expect(await composer.isEmptyRow(1), 'step 52/53: ticking Structure\'s checkbox did not seed the row.')
      .toBe(false);

    /* ⚠️ `axisTriple`, NOT `Number(v[k] ?? '0')`. The inline form maps an ABSENT label to a plausible 0, so a row
     * whose body never rebuilt — or a renamed label — reads as *"the seed wrote no winding"*: the harness accusing
     * the engine of the one defect this step exists to catch. `axisTriple` asserts the three labels are PRESENT
     * first, so that failure arrives as a CALIBRATION message naming the missing key. Seed 1 of
     * `08-dom-steps-seeds.spec.ts` measures both halves of exactly this.
     *
     * ⚠️ **AND THE ANTICIPATED FAILURE MODE WAS THE WRONG ONE, WHICH IS THE FINDING: the labels were all PRESENT
     * and the VALUES were empty strings.** `Number('') === 0`, so the label guard passed, the NaN guard passed,
     * and the clause below fired with a message blaming the seed — over source that demonstrably writes the
     * winding (`composer.ts:2325`). ⚠️ **`axisTriple` NOW ASSERTS NON-BLANK, so this arrives as a CALIBRATION
     * naming the blank fields.** The `src/` cause: `setLevelEnabled` called `commit()` — which ends in `sync()` —
     * and only AFTERWARDS `renderSlotBody`, so `sync()` wrote the OLD inputs and all 21 freshly built ones stayed
     * blank until an unrelated commit.
     *
     * ⚠️ **FIXED IN `src/` 2026-09-10 (owner: *"fix all issues"*) — the bodies are built BEFORE the commit — SO
     * THIS STEP'S GREEN IS NOW A CONFIRMATION.** ⚠️ **KEEP THE NON-BLANK GUARD REGARDLESS: it is what turned a
     * message accusing the engine's seed into one naming the reading channel, and `Number('') === 0` will make the
     * next blank-input defect indistinguishable from an authored zero exactly as it did here.** */
    const seededWinding = await composer.axisTriple('Structure', 'Winding');
    expect(seededWinding.some((w) => w !== 0), 'step 53: the seed gave Structure size but NO winding. §Q measures '
      + 'that a size-only seed draws one point per axis on all 343 of the library\'s empty levels — a dot, which '
      + 'reads as broken. The slot must arrive WITH a winding.').toBe(true);

    // step 54 — Structure `Winding` 3/3/3 and `Size` 20/20/0.
    for (const a of ['X', 'Y', 'Z'] as const) await composer.setField('Structure', 'Winding', a, '3');
    await composer.setField('Structure', 'Size', 'X', '20');
    await composer.setField('Structure', 'Size', 'Y', '20');
    await composer.setField('Structure', 'Size', 'Z', '0');

    // step 55 — Export → the Structure wave is IN `generators.waves`.
    const exported = await composer.exportPresetText();
    const parsed = JSON.parse(exported) as { generators?: { waves?: unknown[] } };
    const waves = parsed.generators?.waves;
    expect(Array.isArray(waves), 'step 55: the export has no `generators.waves` array.').toBe(true);
    expect(waves!.length, 'step 55 — THE WORST POSSIBLE SYMPTOM: `New Figure` creates a ONE-SLOT preset while the '
      + 'tab shows three editable rows, so without growing `slotCount` your whole authored Structure wave is '
      + 'accepted, drawn, and NEVER SAVED — and the figure stays correct until the next reload.')
      .toBeGreaterThanOrEqual(2);

    // step 56 — Import it back → the Structure wave is present in the UI.
    const name = await composer.importPresetJSON(exported, 'step55-structure.json');
    await composer.loadPreset(name);
    await composer.openComposer();
    expect(await composer.isEmptyRow(1), 'step 56: after an Export → Import round trip the Structure wave is not '
      + 'in the UI.').toBe(false);
    const reloaded = await composer.rowValues(1);
    expect(Number(reloaded['Structure Winding X']), 'step 56: the Structure winding did not survive the round '
      + 'trip.').toBe(3);

    /*
     * step 57 — zero Structure's sizes so the row reads silent, then Export → the slot is STILL PRESENT.
     * ⚠️ **THE GROWTH IS DELIBERATELY ONE-WAY. Never write the internal pad-to-three back**, and never shrink:
     * most presets author fewer than three live waves, so a shrink is a silent rewrite in reverse.
     */
    await composer.setField('Structure', 'Size', 'X', '0');
    await composer.setField('Structure', 'Size', 'Y', '0');
    const afterZero = JSON.parse(await composer.exportPresetText()) as { generators?: { waves?: unknown[] } };
    expect(afterZero.generators?.waves?.length, 'step 57: the silent slot VANISHED from the export. 343 of the '
      + 'library\'s 1197 slots are silent, so a silent-but-present slot is a real authored state — shrinking is '
      + 'the same silent rewrite as step 55\'s, in the opposite direction.').toBeGreaterThanOrEqual(2);
  });

  /* ═══ §B4 · Author with the readouts — steps 58–60 ═══════════════════════════════════════════════
   * ⚠️ **`phase` IS MULTIPLIED BY THE WINDING** — the argument is `(n + phase)·fm`, NOT `n·fm + phase`, so the
   * effective shift is `phase × FM.Base mod 360`. `Sliders`' `Symmetry` has this defect today
   * (`slider-mappings.ts:152-157`), out of scope and seeded in §D so the Composer cannot inherit it silently.
   */
  test('steps 58, 59 — the readout states the shift you actually get, and it tracks the winding',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Cylinder');
      await composer.openComposer();
      await composer.clickNewFigure();

      // step 58 — winding X 8, shift X 45 → `X shift 0° (not 45°)` because 45 × 8 = 360.
      await composer.setField('Body', 'Winding', 'X', '8');
      await composer.setField('Body', 'Shift °', 'X', '45');
      let readouts = await composer.readoutTexts();
      expect(readouts[0], 'step 58: the readout does not state the EFFECTIVE shift. The argument is `(n+phase)·fm`, '
        + 'so 45 × 8 = 360 ≡ 0° — the stored 45 reaches the figure as no shift at all, and this readout is the '
        + 'only place that fact is visible.').toMatch(/X shift 0°.*not 45°/);

      // step 59 — winding X 7 → `X shift 315° (not 45°)`.
      await composer.setField('Body', 'Winding', 'X', '7');
      readouts = await composer.readoutTexts();
      expect(readouts[0], 'step 59: the readout did not follow the winding change. 45 × 7 = 315°.')
        .toMatch(/X shift 315°.*not 45°/);
    });

  /*
   * ⚠️ **STEP 60'S FIELDS ARE ALREADY THERE — NO `Show detail` FIRST (16.15), AND THAT IS PART OF THE STEP.** The
   * visual half (a captioned CYAN size-extreme curve in all three panes) is Phase 4's channel; what the DOM owns
   * is that the raw fields exist and take the values without a promotion click.
   */
  test('step 60 — `Pulse` and `Pulse rate` are directly editable with no promotion step', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');
    await composer.openComposer();
    await composer.clickNewFigure();

    const tabText = (await composer.page.locator(SEL.tabContent).textContent()) ?? '';
    expect(tabText, 'step 60: a `Show detail` control is present. The tier is GONE — the owner chose "every row '
      + 'always shows all its numeric inputs" over a view-only collapse — so a promotion control would be a '
      + 'retired surface.').not.toMatch(/Show detail/);

    await composer.setField('Body', 'Pulse', 'X', '15');
    await composer.setField('Body', 'Pulse rate', 'X', '2');
    const v = await composer.rowValues(0);
    expect(Number(v['Body Pulse X']), 'step 60: the `Pulse` field did not take 15.').toBe(15);
    expect(Number(v['Body Pulse rate X']), 'step 60: the `Pulse rate` field did not take 2.').toBe(2);
  });

  /* ═══ §B5 · steps 62, 63 — RETIRED SUBJECT, RE-POINTED AT THE REMOVAL ═══════════════════════════
   * ⚠️ **THE OWNER REMOVED THE `Sweep rate` CONTROL ON 2026-09-10** (*"you do not need to remove sweep rate
   * completely, just use the default value and don't provide a control for it, having a speed factor control is
   * sufficient"*), so **the SUBJECT of steps 62 and 63 no longer exists.** Both steps drove that input: 62 typed
   * 0.2 and asserted the value plus a still-running sweep, 63 typed 0 and asserted the freeze, then restored 0.05.
   *
   * ⚠️ **THE NUMBERS ARE KEPT AND THE STEPS ARE NOT DELETED** — `CLAUDE.md`: *"insertions are lettered and NEVER
   * renumbered, and a RETIRED step keeps its number"*, and *"a step that cannot be performed is worse than one
   * quoting retired copy"*, because `there is no such button` is an honest report a tally cannot tell from a
   * regression. So the pair is re-pointed at the one thing that IS now measurable here: **that the control is
   * gone and has not come back**, with a positive anchor so the clause cannot pass over an empty pane.
   *
   * ⚠️ **WHAT WAS LOST, STATED RATHER THAN QUIETLY DROPPED — AND EACH HALF SURVIVES SOMEWHERE ELSE:**
   *   · *"`waveSpeed` drives the seconds labels"* → **step 107h** in `04`, now on the `Firestorm`/`Ember Storm`
   *     controlled pair (byte-identical modulator cells, `waveSpeed` 0.12 vs 0.10), which is a STRONGER instrument
   *     than moving one control was: it also catches a converter that hardcodes the modal 0.05.
   *   · *"`waveSpeed = 0` freezes `pos` while `elapsedTime` keeps running"* → **seed 11** in `05`, which reaches
   *     that state through Export → edit the JSON → Import, the only DOM route left to it.
   *   · *"a `waveSpeed` change re-inits and zeroes `pos`"* → **NOT re-homed, and deliberately so.** The engine
   *     still behaves that way (`setWaveSpeed` re-inits; nothing on the Composer invokes it), so this is a real
   *     coverage loss rather than a retired behaviour. **Do not read the removal as *"waveSpeed is inert now"***;
   *     the Sliders tab's `Flow` slider and every Import still move it.
   *
   * ⚠️ **AND THE POSE-RESET NOTE THAT USED TO SIT IN THIS HEADER IS NOW FALSE OF THE TAB:** with the control gone,
   * **NOTHING in the Composer legitimately does what step 11 forbids everywhere else** — so step 11's rule now
   * holds over the whole tab with no exception, which is a tightening, not a gap. `106m` owns that clause for
   * `Speed`, the control the owner kept in its place.
   */
  test('steps 62, 63 — RETIRED: the `Sweep rate` control is gone, and no replacement for it appeared',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Cylinder');
      await composer.openComposer();

      /*
       * The absence clause with its own positive anchors — the fixture's `assertNoSweepRateControl()` asserts the
       * pane is built and the `Speed` row is present BEFORE asserting the absence, because *"an absence test over
       * an empty corpus reports PASS"* and this is exactly that shape reached through the DOM.
       */
      await composer.assertNoSweepRateControl();

      /*
       * ⚠️ **AND THE HALF THAT KEEPS THIS FROM BEING A PURE ABSENCE TEST: the figure must still be sweeping.** The
       * removal kept the FIELD at its stored value, so `pos` must still advance on a preset that was moving before
       * — a "removal" that also dropped the default to 0 would satisfy every absence clause above while freezing
       * every figure in the library, and no text or count check could see it.
       */
      await composer.assertIntegratorAdvanced();
    });

  /* ═══ §B6 · Keep it — steps 64, 65 ══════════════════════════════════════════════════════════════
   * ⚠️ **STEP 65 RELOADS THE BROWSER, WHICH IS THE POINT: NOTHING PERSISTS (no `localStorage` in `src/`)**, so the
   * import is the only path back and it must go through the ONE apply path (invariant 23).
   */
  test('steps 64, 65 — a Snapshot then an Export survive a browser RELOAD and an Import', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');
    await composer.openComposer();
    await composer.clickNewFigure();
    await composer.setField('Body', 'Winding', 'X', '5');
    await composer.setField('Body', 'Size', 'X', '27');

    // step 64 — Snapshot, then Export.
    await composer.clickSnapshot();
    const exported = await composer.exportPresetText();
    const before = await composer.rowValues(0);
    expect(Number(before['Body Winding X']), 'CALIBRATION: the pre-export edit did not land.').toBe(5);

    // step 65 — reload the browser, Import the file, open the Composer → every value matches.
    await composer.bootWithHook();
    const name = await composer.importPresetJSON(exported, 'step65-keepit.json');
    await composer.loadPreset(name);
    await composer.openComposer();

    expect(await composer.rowValues(0), 'step 65: a value differs after a RELOAD → Import round trip. Nothing '
      + 'persists (there is no `localStorage` in `src/`), so the file is the only path back — and the startup '
      + 'preset must go through `applyPresetChange`, the ONLY reader of the `overlay` block.').toEqual(before);
  });

  /* ═══ §B7 · The ratio listbox on `Aurora Borealis` — steps 66–73 ═════════════════════════════════
   * ⚠️ **RUN 2'S REPORT, VERBATIM: picking a ratio *"is not applied … I assume this is a bug."* IT IS NOT A BUG.**
   * Every slot's winding on that preset is already uniform: Body `0/0/0` (base 1), Structure `16/16/16` (base 16),
   * Detail `64/64/64` (base 64) — so **two of the three rows are ALREADY on `1 : 1 : 1`** and the pick was
   * correct, idempotent and invisible. **What 16.11 changed is not the write: the button now PRINTS the slot's own
   * reduced ratio and marks the matching row selected**, so "already there" is readable before the click.
   */
  test('steps 66, 67 — Structure and Detail already read `1 : 1 : 1`, and picking it moves NOTHING',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aurora Borealis');
      await composer.openComposer();

      // step 66 — BEFORE clicking anything, both rows must already print `1 : 1 : 1 · circle / sphere`.
      for (const level of ['Structure', 'Detail'] as const) {
        const text = await composer.ratioValueText(level);
        expect(text, `step 66: ${level}'s ratio button does not already read \`1 : 1 : 1\`. ⚠️ Fail (66) is the `
          + 'button reading `—`, or showing the first row, or showing a ratio the slot is not on: it must print '
          + 'the reduced ratio from `ratioBase` EVEN WHEN NO ROW MATCHES, and that is the common case — the '
          + 'twenty rows cover 595 of 854 live library slots, so ~3 slots in 10 sit on a ratio the list does not '
          + 'offer. A button falling back to row 0 would rebuild the `Aurora Borealis` confusion out of a '
          + 'different part.').toMatch(/1\s*:\s*1\s*:\s*1/);
      }

      // step 67 — pick the row it already sits on → NOTHING moves, and step 66 is what makes that readable.
      const before = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));
      const readoutsBefore = await composer.readoutTexts();
      await composer.pickRatio('Structure', '1 : 1 : 1');
      const after = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));

      for (const n of [0, 1, 2]) {
        expect(after[n], `step 67: picking the ratio Structure ALREADY sits on changed ${LEVEL_NAMES[n]}'s `
          + 'numbers. That is the compounding base rule (see step 32) — the shared gcd owner was bypassed, so '
          + 'look for a SECOND base rule rather than at the listbox.').toEqual(before[n]);
      }
      expect(await composer.readoutTexts(), 'step 67: a readout changed on a byte-identical no-op.')
        .toEqual(readoutsBefore);
    });

  test('steps 68, 69, 70 — the gcd base is KEPT (16 → 32:48:16), a re-pick is inert, and Body at winding 0 takes '
    + 'a literal 1:1:1', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aurora Borealis');
    await composer.openComposer();

    // ⚠️ `axisTriple` — the inline `.map(Number)` form is vacuous under `toEqual`; see its doc comment.
    const winding = (n: number) => composer.axisTriple(LEVEL_NAMES[n]!, 'Winding');

    expect(await winding(1), 'CALIBRATION: `Aurora Borealis` Structure is not at 16/16/16, so this is not the '
      + 'preset state steps 68–70 are written against and their literal expectations would be wrong.')
      .toEqual([16, 16, 16]);

    // step 68 — `2 : 3 : 1` on Structure → `32 : 48 : 16`, the gcd base 16 KEPT, not discarded.
    await composer.pickRatio('Structure', '2 : 3 : 1');
    expect(await winding(1), 'step 68 — Fail (68/72): you got literal `2 : 3 : 1`. Then the base is being IGNORED '
      + 'rather than computed, and every large-winding preset in the library would be FLATTENED by one click. '
      + 'The list sets the RELATIONSHIP and keeps the slot\'s own scale.').toEqual([32, 48, 16]);

    // step 69 — pick it again → nothing moves, and the button still reads `2 : 3 : 1`.
    await composer.pickRatio('Structure', '2 : 3 : 1');
    expect(await winding(1), 'step 69: a second identical pick compounded.').toEqual([32, 48, 16]);
    expect(await composer.ratioValueText('Structure'), 'step 69: the button no longer reports `2 : 3 : 1` after a '
      + 're-pick.').toMatch(/2\s*:\s*3\s*:\s*1/);

    /*
     * step 70 — Body (winding `0/0/0`, base 1) → literal `1 : 1 : 1`, and the figure changes substantially.
     * ⚠️ **A WINDING OF 0 ON ALL THREE AXES IS A REAL AUTHORED STATE ON THIS PRESET, NOT A BROKEN ONE** — the row
     * winds through its `Wobble`, which is exactly why a UI must never grey out `FM.Base = 0`. `CLAUDE.md`: *"A
     * UI greying out `FM.Base = 0` would mislabel the liveliest rows in the library."*
     */
    expect(await winding(0), 'CALIBRATION: `Aurora Borealis` Body is not at 0/0/0.').toEqual([0, 0, 0]);
    await composer.pickRatio('Body', '1 : 1 : 1');
    expect(await winding(0), 'step 70: Body did not take a literal `1 : 1 : 1` at base 1.').toEqual([1, 1, 1]);
  });

  /*
   * ⚠️ **STEP 71'S CAPTIONS ARE LOAD-BEARING, NOT DECORATION** — rows collide within a single plane (§K measures
   * 11/14/14 distinct curves of 20 in XY/XZ/YZ against 20 of 20 across all three), so without labels several rows
   * would be visually identical controls. **Do not report the single-plane collisions as a defect; report a
   * missing label.** `RATIO_ROWS` is a COUNTED UNION and must never be hardcoded — so this reads the count from
   * the shipped module rather than asserting 20.
   */
  test('steps 71, 98, 101 — every ratio row is captioned, the five names are present, and the list is reachable '
    + 'without scrolling', async ({ composer, page }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Quader');
    await composer.openComposer();

    const btn = page.locator(`${SEL.tabContent} ${SEL.ratioButton('Body')}`);
    await btn.click();
    // ⚠️ Scoped to Body's combo — see `SEL.ratioListFor`; `.last()` reads Detail's list whatever button opened one.
    const list = page.locator(`${SEL.tabContent} ${SEL.ratioListFor('Body')}`);
    await expect(list, 'CALIBRATION: the ratio list did not open, so every clause below would read an empty '
      + 'corpus — and an absence test over an empty corpus reports PASS.').toBeVisible();

    const options = list.locator(SEL.ratioOption);
    const count = await options.count();
    expect(count, 'CALIBRATION: the ratio list has fewer than two rows.').toBeGreaterThan(1);

    // step 71 / step 98 — every row is captioned, and each shows THREE thumbnails.
    const captions = await options.locator(SEL.ratioOptionCaption).allTextContents();
    expect(captions.filter((c) => c.trim().length > 0).length, 'step 71 — Fail (71): a row has no caption. The '
      + 'captions are LOAD-BEARING: §K measures 11/14/14 of 20 rows drawing distinct curves in XY/XZ/YZ alone '
      + 'against 20 of 20 across all three, so without labels several rows would be visually identical controls.')
      .toBe(count);

    const thumbCount = await options.first().locator(SEL.ratioThumb).count();
    expect(thumbCount, 'step 98: a row does not show THREE thumbnails. Three panes rather than a caption is the '
      + 'fix for single-plane collisions — distinctness in any one plane is far below distinctness across all '
      + 'three (invariant 29 as a UI property).').toBe(3);

    // step 71 — the five named ratios are present, one of them sharing a tile (`1:1:1`).
    const allText = captions.join(' | ');
    for (const name of ['circle / sphere', 'figure eight', 'trefoil', 'lattice', 'knot']) {
      expect(allText, `step 71: the named ratio "${name}" is missing from the list. \`RATIO_NAMED\` has five `
        + 'entries and `RATIO_ROWS` is their counted union with `RATIO_TILES` — never hardcoded, so re-run §K '
        + 'rather than reading a delta as an event.').toContain(name);
    }

    /*
     * step 101 — at least SEVEN rows visible without scrolling, and the list still FITS the panel. Both halves are
     * measured, because either alone passes on the other's failure.
     *
     * ⚠️ **BOTH HALVES ARE MEASURED AS *SIZES*, NOT AS POSITIONS, AND TWO EARLIER POSITION-BASED FORMS OF THIS
     * CLAUSE WERE HARNESS DEFECTS.** The step reads *"at least seven rows are visible without scrolling, and the
     * list still fits inside the panel — bigger icons must not be paid for with a taller list."* That is a claim
     * about the list's HEIGHT (`max-height: 320px`, §O's subject) against the row height. It is **not** a claim
     * about where the popup happens to land, and the two rejected forms each measured exactly that:
     *
     *   1. `box.y + box.height <= tabContent.y + tabContent.height` — `.sl-composer-combo-list` is
     *      `position: absolute` inside an `overflow-y: auto` container (`panel.css:878` / `:75`), so overhanging
     *      the container's CURRENT scroll viewport is what an absolute popup is FOR. Measured 9 px of "overflow"
     *      that was the container's scroll offset.
     *   2. `box.y + box.height <= viewport.height` — same defect one frame out. Measured: Body's combo button sits
     *      at y ≈ 763 in an 822 px panel, so a correctly-capped 320 px list reaches 1083 in a 900 px window. **A
     *      popup opening downward near the bottom of a scrollable panel is not a layout bug.**
     *
     * ⚠️ **AND `isVisible()` CANNOT BACKSTOP EITHER OF THEM: it reported `true` for all TWENTY rows**, including
     * the twelve clipped out of the list's own 318 px scroll viewport — Playwright's visibility is a non-empty box
     * plus CSS visibility, and it does not model ancestor clipping. **A visibility loop here would be exactly the
     * *"a `count()` check passes while the click cannot land"* defect wearing the recommended fix's clothes.**
     */
    const box = await list.boundingBox();
    expect(box, 'step 101: the list has no layout box.').not.toBeNull();
    const optBox = await options.first().boundingBox();
    expect(optBox, 'step 101: a row has no layout box.').not.toBeNull();

    // The list's OWN scroll viewport is the surface the step's "without scrolling" refers to.
    const listClientH = await list.evaluate((el) => el.clientHeight);
    expect(listClientH, 'CALIBRATION: the list reports a zero client height, so the row arithmetic below divides '
      + 'into nothing and would report 0 rows rather than a layout fact.').toBeGreaterThan(0);
    const visibleRows = Math.floor(listClientH / Math.max(optBox!.height, 1));
    expect(visibleRows, `step 101: only ${visibleRows} rows fit in the list's own ${listClientH} px viewport `
      + `at a row height of ${Math.round(optBox!.height)} px — fewer than seven. §O pins the \`max-height\`, which `
      + 'was written for 22 px icons: a resize to 34 px that forgets it trades reachability for legibility.')
      .toBeGreaterThanOrEqual(7);

    /*
     * ⚠️ **"FITS INSIDE THE PANEL" IS A HEIGHT COMPARISON — the list must be no TALLER than the panel it opens
     * inside.** That is the property *"bigger icons must not be paid for with a taller list"* names, and it is
     * scroll-position-independent, which is what makes it measurable at all.
     */
    const panelBox = await page.locator(SEL.tabContent).boundingBox();
    expect(panelBox, 'step 101: the tab content has no layout box.').not.toBeNull();
    expect(box!.height, `step 101: the ratio list (${Math.round(box!.height)} px) is TALLER than the panel it `
      + `opens inside (${Math.round(panelBox!.height)} px), so no scroll position can show all of it. Bigger icons `
      + 'must not be paid for with a taller list — the `max-height` is the control, and this is the direction §O '
      + 'cannot see from the source alone.').toBeLessThanOrEqual(panelBox!.height);
  });

  /*
   * ⚠️ **72 AND 73 ARE THE PAIR THAT PROVES 16.9 REMOVED A COLLAPSE.** On the old single-plane surface, one pick
   * that genuinely does nothing (67) and one that changes only the plane you were not looking at (73) produced
   * THE SAME SCREEN. **Steps 67 and 73 side by side are the proof.**
   */
  test('steps 72, 73 — the list keeps the slot\'s own scale (5 → 10:15:5), and a Z-only change is invisible in '
    + 'X/Y alone', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Moebius Paranoia');
    await composer.openComposer();

    // ⚠️ `axisTriple` — the inline `.map(Number)` form is vacuous under `toEqual`; see its doc comment.
    const winding = (n: number) => composer.axisTriple(LEVEL_NAMES[n]!, 'Winding');

    expect(await winding(1), 'CALIBRATION: `Moebius Paranoia` Structure is not at 5/5/0, so step 72\'s literal '
      + 'expectation would be wrong.').toEqual([5, 5, 0]);

    // step 72 — `2 : 3 : 1` on Structure → `10 : 15 : 5`, not `2 : 3 : 1`. Then a re-pick is inert.
    await composer.pickRatio('Structure', '2 : 3 : 1');
    expect(await winding(1), 'step 72: the list did not keep the slot\'s own scale (base 5).')
      .toEqual([10, 15, 5]);
    await composer.pickRatio('Structure', '2 : 3 : 1');
    expect(await winding(1), 'step 72: the re-pick compounded.').toEqual([10, 15, 5]);

    /*
     * step 73 — Body (`1/1/5`): `1 : 1 : 1` moves the Z winding from 5 to 1 and NOTHING else, which is why the
     * X/Y pane cannot change while X/Z and Y/Z both do (measured 0 / 23.3 / 23.3). The pane pixels are Phase 4's
     * channel; the DOM owns the Z-only fact the asymmetry follows from.
     */
    expect(await winding(0), 'CALIBRATION: `Moebius Paranoia` Body is not at 1/1/5.').toEqual([1, 1, 5]);
    await composer.pickRatio('Body', '1 : 1 : 1');
    expect(await winding(0), 'step 73: the pick did not move Z alone from 5 to 1. On the old single-plane surface '
      + 'this state was INDISTINGUISHABLE from step 67\'s genuine no-op — one pick that does nothing and one that '
      + 'changes only the plane you were not looking at produced the same screen, and that collapse is what 16.9 '
      + 'removed.').toEqual([1, 1, 1]);
  });

  /* ═══ §B8 · The shift dial — steps 74–81 ════════════════════════════════════════════════════════
   * ⚠️ **THE ARGUMENT IS `(n + phase) · winding`, SO THE SHIFT THE FIGURE RECEIVES IS `phase × winding`** and the
   * numeric field is in the PRE-multiplication unit while the dial is in the unit you mean. Fail (75/76): the
   * field takes the number you dialled — the dial treating the stored phase AS the shift, which on a winding-16
   * axis is an error of 16×.
   */
  test('steps 74, 80 — every row shows THREE dials, and the two-dial `simple` row the steps describe is RETIRED',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      /*
       * ⚠️ **THIS STEP IS ASSERTED IN THE DIRECTION THE SHIPPED CODE SUPPORTS, AND THE DIVERGENCE IS THE FINDING.**
       * Steps 74 and 80 describe **two** dials on a `simple` Body row, a numeric row labelled
       * `Shift (X · Y offset)`, and a `Z shift needs full detail` note. **All three are RETIRED:** the owner chose
       * *"every row always shows all its numeric inputs"* over a view-only collapse, so `composer.ts` loops all
       * three axes for every row. `CLAUDE.md`: *"A STEP THAT CANNOT BE PERFORMED IS WORSE THAN ONE QUOTING RETIRED
       * COPY … ask what a step's control IS before checking what it SAYS."* A spec asserting two dials would fail
       * green-side-up against a correct engine.
       */
      for (const n of [0, 1, 2]) {
        const level = LEVEL_NAMES[n]!;
        /*
         * ⚠️ **`SEL.dialAny`, NOT `SEL.dial` — AND THE DIFFERENCE WAS A RED ACCUSING THE ENGINE.** `SEL.dial` is a
         * `(level, axis) => string` FUNCTION; interpolating it uncalled puts its SOURCE TEXT in the selector, which
         * matches nothing, and `toHaveCount(3)` then reported *"Quader does not show three dials"* — the harness
         * naming the subject for a defect entirely its own. **`tsc` cannot see it: interpolating a function into a
         * template is legal TypeScript.** The count is the subject here, so the class-only selector is correct;
         * everywhere ONE dial is the subject `composer.dialFor(level, axis)` is required.
         */
        const dials = page.locator(`${SEL.tabContent} ${SEL.slot(n)} ${SEL.dialAny}`);
        await expect(dials, `steps 74/80: ${level} does not show three \`Shift °\` dials. ⚠️ NOTE THE DIRECTION: `
          + 'the test plan says TWO on a `simple` Body row, and that expectation is RETIRED — the tier is gone by '
          + 'the owner\'s decision, so three dials on every row is CORRECT and the script\'s wording is the thing '
          + 'that is out of date. A failure here means fewer than three, which would be the tier returning.')
          .toHaveCount(3);
      }

      const tabText = (await page.locator(SEL.tabContent).textContent()) ?? '';
      expect(tabText, 'step 80: the retired label `Shift (X · Y offset)` is on screen. The simple tier is gone; '
        + 'the word is `Shift` everywhere (16.12).').not.toContain('X · Y offset');
      expect(tabText, 'step 80: the retired note `Z shift needs full detail` is on screen. Every row now carries '
        + 'a Z dial, so the note would describe a restriction that no longer exists.')
        .not.toContain('needs full detail');
    });

  /*
   * ⚠️ **THE WORD IS `Shift` EVERYWHERE ON THIS TAB (16.12 / E103) — `Phase °`, `twist` and `Phase / twist` ARE
   * RETIRED**, because two words for one control was part of run 2's reported confusion. `twist` survives ONLY as
   * the model's internal field name, which no user-facing string reads. Same for §B9's `breathes`, `AM depth` and
   * `FM depth`. **A word reaching the DOM through a VARIABLE is invisible to any text scan, which is precisely
   * the capability a DOM read adds over §N's source scan** — `CLAUDE.md` names this as the one thing the browser
   * can do that a checker structurally cannot.
   */
  test('steps 74, 82 (copy half) — no retired vocabulary reaches the DOM on any of three presets',
    async ({ composer, page }) => {
      test.slow();
      /*
       * ⚠️ **THE LAST THREE ENTRIES WERE ADDED 2026-09-10 AND THEY ARE A DIFFERENT CLASS FROM THE OTHER TEN.** The
       * originals are retired VOCABULARY — one quantity that had two names. `Don’t apply …` and the old
       * `+ give it size` are retired **polarity and copy**: the owner renamed the two switches to `Apply Visual FX`
       * / `Apply Materials` and inverted them, so the old strings now describe the OPPOSITE behaviour.
       *
       * ⚠️ **AND THAT MAKES THEM THE HIGHEST-VALUE ENTRIES IN THE LIST, BECAUSE A STALE LABEL OVER AN INVERTED
       * CONTROL IS WORSE THAN A CONFUSING ONE — IT IS ACTIVELY WRONG.** A `Don’t apply Visual FX` box that is
       * ticked by default and applies FX when ticked would read as a double negative to every user and be believed.
       * **This scan is the only instrument that can see it**: §N reads string LITERALS, and both spellings would
       * survive a source scan unchanged if the copy were assembled through a variable.
       *
       * ⚠️ **BOTH APOSTROPHE SPELLINGS ARE LISTED, AND THE ASCII ONE IS NOT REDUNDANT.** The shipped string used
       * U+2019; a hand-retyped revival would almost certainly use `'`. A scan for only the original spelling would
       * miss the more likely mistake — which is seed 1's finding pointed at the DOM instead of at a selector.
       *
       * ⚠️ **AND `Preview only — not saved with the figure` IS *NOT* IN THIS LIST, THOUGH THE SAME CHANGE MOVED
       * SEVEN CONTROLS OUT FROM UNDER IT.** That title still ships and is still TRUE — of the two bypass switches,
       * which are all that remain in that section. **The framing controls left the section precisely so the
       * sentence would stay true**, so retiring the string would assert the opposite of what was built. The
       * discriminator for this list is *"does the string now describe the wrong behaviour"*, not *"did the
       * 2026-09-10 change touch it"*.
       */
      const retired = ['Phase °', 'Phase / twist', 'twist', 'breathes', 'AM depth', 'FM depth', 'Show detail',
        'Repair', 'Simplify', '+ give it size', 'Don’t apply', "Don't apply"];

      await composer.bootWithHook();
      for (const preset of ['Quader', 'Argus', 'Aliens DNA']) {
        await composer.loadPreset(preset);
        await composer.openComposer();

        /*
         * ⚠️ **THE CORPUS IS ASSERTED NON-EMPTY FIRST** — `CLAUDE.md`: *"an absence test over an empty corpus
         * reports PASS"*, and *"assert the corpus is NON-EMPTY even when the anchor is known present."*
         */
        const text = (await page.locator(SEL.tabContent).textContent()) ?? '';
        expect(text.length, `CALIBRATION: the Composer tab published no text on ${preset}, so every absence `
          + 'clause below would pass over an empty corpus.').toBeGreaterThan(200);
        expect(text, `CALIBRATION: the tab's own vocabulary is absent on ${preset}, so the scan is not reading `
          + 'the right element.').toContain('Winding');

        for (const word of retired) {
          expect(text, `RETIRED VOCABULARY on ${preset}: "${word}" reached the DOM. ⚠️ This is the one check a `
            + 'source scan structurally cannot make — §N reads string LITERALS, and a word arriving through a '
            + 'VARIABLE is invisible to it. `breathes`/`twist` named ONE quantity in two places, which is why '
            + 'the owner\'s *"isn\'t that the same?"* was correct and no tooltip could have answered it.')
            .not.toContain(word);
        }
      }
    });

  /*
   * ⚠️ **A NEW STEP FOR THE OWNER'S THIRD 2026-09-10 REQUEST, AND IT IS THE ONLY INSTRUMENT THAT CAN MEASURE IT:**
   * *"Keep static explanatory text minimal to save space, instead apply tooltips for all headers and controls on
   * the Composer page."* **Both halves are a claim about the rendered DOM, and neither has a checker.** `tipcheck`
   * §C/§D scan `sectionTitle()`/`subTitle()` **in `visual-fx.ts` only**, so a Composer header with no `title` is
   * invisible to every gate — which is how `Figure-wide` stayed untipped from E92 to 2026-09-10 while `verify` was
   * green throughout. **A DOM scan catches what no text scan can**, and this is the capability the browser adds.
   *
   * ⚠️ **`Figure-wide` NO LONGER EXISTS — the owner removed its one control (`Sweep rate`) later the same day, and
   * the empty section went with it. The sentence above is kept as the STANDING PROOF of the gap, not as a
   * description of the current tab**; it is the only recorded instance of a Composer header shipping untipped, and
   * deleting it would leave this step's reason to exist unstated. **Do not "correct" it to the present tense.**
   *
   * ⚠️ **THE TWO HALVES PULL IN OPPOSITE DIRECTIONS, WHICH IS WHY THEY ARE ONE STEP.** "Minimal static text" and
   * "a tooltip on everything" trade against each other: satisfying the first by deleting a precondition, or the
   * second by inlining its text, each fails the other. ⚠️ **AND THE TRADE HAS A DOCUMENTED EXCEPTION — a
   * PRECONDITION STAYS INLINE (invariant 25), because a tooltip is only discovered by someone who already suspects
   * the control.** So the inline-text clause is a BOUND, not a prohibition; region D's blend copy and the two
   * notices are supposed to be there.
   *
   * ⚠️ **`title` IS READ FROM THE DOM AND NOT FROM `TAB_TIPS`, AND THE DIFFERENCE IS THE WHOLE POINT.** A clause
   * comparing the table to itself is a fourth enumeration; this asks whether the string reached the SCREEN, which
   * is the question `tipcheck`'s literal-subscript rule cannot answer.
   */
  test('step 106o — every Composer section header and framing control carries a tooltip, and the static copy '
    + 'stays minimal', async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      const pane = SEL.tabPane('composer');

      /*
       * ── the headers ─────────────────────────────────────────────────────────────────────────────────
       * ⚠️ **PANE-SCOPED, BECAUSE THE MIXER'S FOUR SECTION TITLES ARE STILL IN THE DOM** — `.sl-section-title`
       * unscoped collects them and this clause would then be measuring another tab's tooltips. Measured at 10
       * sections for the loose selector; see 106a.
       */
      const headers = await page.locator(`${pane} .sl-section-title`).evaluateAll(
        (els) => els.map((e) => ({ text: (e.textContent ?? '').trim(), tip: e.getAttribute('title') ?? '' })));
      expect(headers.length, 'CALIBRATION: the Composer pane published no section titles, so every clause below '
        + 'would pass over an empty corpus — this project\'s most-recorded instrument defect.')
        .toBeGreaterThanOrEqual(4);
      const untipped = headers.filter((h) => h.tip.length < 20).map((h) => h.text);
      expect(untipped, 'these Composer section headers reach the screen with NO tooltip (or a stub under 20 '
        + 'chars). ⚠️ `tipcheck` §C/§D scan `sectionTitle()` in `visual-fx.ts` ONLY, so a missing Composer header '
        + 'tip is invisible to every gate — `Figure-wide` was untipped from E92 until 2026-09-10 (when the owner '
        + 'removed the section outright) with `verify` green the whole time. This clause is the only thing that '
        + 'can say so.').toEqual([]);

      /*
       * ── the framing controls, which are the ones the request added ───────────────────────────────────
       * ⚠️ **THE TIP IS ASSERTED ON THE `input`, NOT ON THE ROW, AND THAT IS THE STRICTER SIDE.** `framingRow` sets
       * it on all three of input, wrapper and row; a `title` on the row alone still shows on hover, so a row-level
       * read would pass over a control whose own element carries nothing — and the pointer spends its time over
       * the handle.
       */
      /*
       * ⚠️ **THE NAME FALLS BACK TO THE ROW LABEL, BECAUSE `framingRow()` SETS NO `aria-label` ON A SINGLE SLIDER
       * — MEASURED, NOT ASSUMED.** Only `framingTripletRow` (`Rotation X/Y/Z`) and `framingCheckRow` (`Mirror`)
       * name their inputs; the single sliders are reached by their ROW label, which is how `SEL.framingRow` works.
       * A bare `aria-label ?? type` read therefore names every single slider `range`, so a failure here would not
       * say WHICH control is untipped — and this clause's only job when red is to name it. (**Three such sliders
       * since 2026-09-10, four before it**; the fallback is a property of `framingRow`, not of the count.)
       */
      const framingTips = await page.locator(`${SEL.framingSection} input`).evaluateAll(
        (els) => els.map((e) => ({
          // ⚠️ `||` and not `??` on the second fallback: a row label that resolves to `''` is not nullish, so a
          // `??` chain would make the `type` arm dead code and hand the clause below an empty name.
          name: e.getAttribute('aria-label')
            || (e.closest('.sl-vfx-row')?.querySelector('.sl-vfx-label')?.textContent ?? '').trim()
            || (e as HTMLInputElement).type,
          tip: e.getAttribute('title') ?? '',
        })));
      expect(framingTips.map((c) => c.name).filter((n) => n.length > 0).length,
        'CALIBRATION: a framing input resolved to an EMPTY name, so a red reading of the clause below would not '
        + 'say which control is untipped.').toBe(framingTips.length);
      /*
       * ⚠️ **SEVEN INPUTS, COUNTED FROM `buildFramingSection()`'s CALLS AND NOT FROM THE ROWS:** three
       * `framingRow`s (Figure Scale, Speed, Particle Number) + three Rotation handles + the Mirror checkbox.
       * **Five rows, seven inputs** — the triplet is one row with three controls, so a clause counting rows would
       * under-read by two and pass while two axes went untipped.
       *
       * ⚠️ **IT WAS *SEVEN ROWS, EIGHT INPUTS* UNTIL 2026-09-10, WHEN THE OWNER REMOVED THE `Symmetry` ROW** (*"not
       * needed on the Composer tab"*) — one row, one input. **The arithmetic is re-derived here rather than
       * decremented, because the two figures never moved together:** the row count also lost `Symmetry`'s sibling
       * nothing, while the input count is rows + 2 for the triplet, and `CLAUDE.md` forbids doing arithmetic on a
       * quoted figure.
       *
       * ⚠️ **A LOWER BOUND RATHER THAN AN EQUALITY, AND THE REASON IS A SCAN-HEALTH ARGUMENT, NOT LAXITY:** this
       * clause's subject is the TIPS, and an equality would make it fail on any future row addition — reporting
       * a missing tooltip when a control was added. `assertFramingRowsPresent()` owns the count; this owns the
       * coverage. ⚠️ **BUT THE MARGIN IS NOW ZERO — the bound was 7 against 8 inputs and is 7 against 7**, so a
       * further removal fails HERE too, in a clause whose message will talk about tooltips. **Read a red here
       * against `assertFramingRowsPresent()` first**: if that is green, this is a coverage failure; if it is red,
       * this is an echo. The bound is left at the shipped count deliberately — lowering it for headroom would let
       * a half-read section satisfy the coverage clause below, which is the failure this floor exists for.
       * ⚠️ **`Mirror` is included even at fold 1: `display: none` hides a row, it does not remove its input from
       * the DOM** — which is what makes the coverage read stable across presets.
       */
      expect(framingTips.length, 'CALIBRATION: the framing section published fewer than seven inputs (three '
        + 'sliders + three Rotation handles + the Mirror checkbox), so the clause below is not reading the '
        + 'controls the owner asked for. Check `assertFramingRowsPresent()` before reading this as a tooltip '
        + 'failure.').toBeGreaterThanOrEqual(7);
      expect(framingTips.filter((c) => c.tip.length < 20).map((c) => c.name),
        'these framing controls reach the screen with NO tooltip. The owner\'s request was explicit — *"apply '
        + 'tooltips for all headers and controls"* — and these rows are the controls that request ADDED, so '
        + 'they are the ones with no prior coverage of any kind.').toEqual([]);

      /*
       * ── and the two `Apply` switches, whose tip carries the thing no other surface states ────────────
       * ⚠️ **THEIR TOOLTIP IS THE ONLY PLACE THE POLARITY IS EXPLAINED, WHICH MAKES IT LOAD-BEARING RATHER THAN
       * HELPFUL.** Ticked = normal is not self-evident on a switch named for what it does when ON, and the
       * section title says only that nothing is saved. The clause asserts the tip is SUBSTANTIAL, not its wording:
       * pinning the sentence would make it a second copy of `TAB_TIPS`.
       */
      for (const which of ['fx', 'materials'] as const) {
        const tip = (await composer.bypassBox(which).getAttribute('title')) ?? '';
        expect(tip.length, `the \`Apply\` switch for ${which} carries no real tooltip. Its tip is the only place `
          + 'on the tab that says ON is the normal state and that nothing is saved either way — the section '
          + 'title states non-persistence but not the polarity.').toBeGreaterThan(40);
      }

      /*
       * ── the "minimal static text" half ──────────────────────────────────────────────────────────────
       * ⚠️ **A BOUND, NOT A PROHIBITION, AND THE BOUND HAS A DERIVATION: `tipcheck` §I ALREADY CAPS INLINE COPY AT
       * 420 CHARS PER SITE.** This measures the tab's own description element, which is the one the request named
       * ("keep static explanatory text minimal") and the one §I does not cover — §I reads a literal directly after
       * `.textContent =`, and this string is assembled from two concatenated literals.
       *
       * ⚠️ **THE BOUND IS DERIVED AS A MARGIN BETWEEN THE TWO NEAREST CLASSES, MEASURED — AND MY FIRST NUMBER WAS
       * WRONG IN THE DIRECTION THAT PASSES.** Shipped (2 sentences): **166** chars. Pre-trim (3 clauses, the state
       * the owner asked to shorten): **229** chars, read out of
       * `backup_20260910_owner_ruling_three_src_fixes_suite_all_green/`. I first wrote 320 "plus
       * headroom" — **which admits the pre-trim text and would have been green over the exact regression this
       * clause exists to catch.** `CLAUDE.md`: *derive a tolerance from the worst-case argument; never pick one
       * that passes.*
       *
       * ⚠️ **200 SITS IN THE GAP: 34 chars of headroom over the shipped text (a reword, a renamed tab) and 29
       * below the known-too-long state.** The two classes are only 63 apart, which is worth stating: this is a
       * genuinely tight bound and a THIRD sentence of any length crosses it, which is the shape of the regression.
       * **Do not widen it without re-measuring both classes** — widening to admit a new sentence would retire the
       * only clause that can see the trim being undone.
       */
      const desc = page.locator(`${pane} .sl-tab-desc`);
      await expect(desc, 'CALIBRATION: no `.sl-tab-desc` in the Composer pane, so the length clause below would '
        + 'read an empty string and pass — an absence test over an empty corpus.').toHaveCount(1);
      const descText = ((await desc.textContent()) ?? '').trim();
      expect(descText.length, 'CALIBRATION: the tab description is empty, so the bound below measures nothing.')
        .toBeGreaterThan(60);
      expect(descText.length, `the Composer's static description has grown back to ${descText.length} chars. The `
        + 'owner asked for minimal static text WITH tooltips carrying the detail, and the two trade against each '
        + 'other — text added here is text a tooltip should have held. ⚠️ The bound is a MEASURED margin: shipped '
        + '166, pre-trim 229, so 200 sits between the two nearest classes and any third sentence crosses it. '
        + 'Re-measure both before widening.').toBeLessThanOrEqual(200);
      // ⚠️ **AND THE POINTER TO THE TOOLTIPS MUST SURVIVE, because minimal copy is only usable if it says where
      // the detail went.** Trimming this sentence would satisfy the bound above while making the tab less usable
      // — the clause that stops the length bound being gamed.
      expect(descText.toLowerCase(), 'the description no longer tells the reader that hovering reveals the '
        + 'detail. With the explanatory text deliberately minimal, that sentence is what makes the tooltips '
        + 'discoverable at all — and the length bound above is satisfied by deleting it.').toContain('hover');
    });

  test('steps 75, 76, 77 — the dial writes `shift / winding` into the numeric field, and snaps at the quadrants',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();

      /*
       * ⚠️ **THE TWO WITNESSES ARE CHOSEN FOR THEIR WINDINGS, WHICH IS WHAT THE INVERSION IS DIVIDED BY:**
       * `Anima Electrica` Body Y at winding 8 (90/8 = 11.25) and `Deep Thought2` Body X at winding 16
       * (90/16 = 5.625). **On a winding-16 axis the "dial writes the number you dialled" defect is a factor of
       * 16**, so a single-witness test at winding 1 could not see it at all.
       *
       * ⚠️ **`src/` FINDING (2026-09-09), CONFIRMED — THE SAME ROOT CAUSE AS STEP 81, AND THIS STEP IS WHERE IT
       * WAS MEASURED: `installDial`'s `keydown` CALLED `preventDefault()` AND NEVER `stopPropagation()`**, so the
       * document-level preset switcher ALSO ran on the same press. Its guard is `tagName === 'INPUT'` and a dial is
       * a `<canvas role="slider">`, so it did not exclude it, and it does not test `shiftKey` either —
       * `Shift+ArrowRight` therefore stepped the dial by 90 AND advanced the preset in one keystroke.
       * ⚠️ **FIXED IN `src/` 2026-09-10 IN THE DIAL, NOT IN THE GLOBAL GUARD (owner: *"fix all issues"*) — a
       * widget owns its own keys, and widening an enumeration of what to SKIP would leave the next keyboard widget
       * hijacked identically. This step's green is now a confirmation, and it is the step that MEASURED the owning
       * side.**
       *
       * ⚠️ **THE READING IS `0`, NEITHER BRANCH OF THIS STEP'S OWN HYPOTHESIS** (11.25 correct, 90 for the
       * un-divided defect). That is the tell, and it is why the failure message below is the WRONG MECHANISM: it
       * accuses the dial's arithmetic, which is INNOCENT — the 90 was written correctly and then the row was
       * REPLACED underneath the read. **Do not re-point the clause at `0`: the arithmetic assertion is the one
       * this step exists to make, and `0` is a symptom of a different subject.**
       *
       * ⚠️ **WHAT LOCALISED IT WAS THE CALIBRATION THAT PASSED.** `Body Winding Y` was asserted `=== 8` BEFORE
       * the nudge and reads `0` in the failure snapshot — a row cannot change its own winding, so the identity of
       * the preset changed. **A step whose pre-state assertion passes and whose post-state contradicts it is
       * reporting an event BETWEEN them, not bad arithmetic.** Neither half alone could have said so.
       */
      const cases = [
        { preset: 'Anima Electrica', axis: 'Y' as const, winding: 8, expected: 11.25, step: '75' },
        { preset: 'Deep Thought2', axis: 'X' as const, winding: 16, expected: 5.625, step: '76' },
      ];

      for (const c of cases) {
        await composer.loadPreset(c.preset);
        await composer.openComposer();

        const v = await composer.rowValues(0);
        expect(Number(v[`Body Winding ${c.axis}`]), `CALIBRATION: ${c.preset} Body ${c.axis} is not at winding `
          + `${c.winding}, so step ${c.step}'s literal expectation (${c.expected}) would be wrong arithmetic `
          + 'against the wrong preset.').toBe(c.winding);

        /*
         * The dial is a `<canvas role="slider">` with no `value`, so the reading comes from the paired numeric
         * field — and driving it by keyboard is the only DOM-honest way in (`nudgeDial` uses the shipped keymap).
         * ⚠️ **The dial's own unit is degrees of SHIFT; 90° is `Shift × winding = 90`, i.e. `90 / winding`.**
         */
        await composer.setField('Body', 'Shift °', c.axis, '0');
        const dial = composer.dialFor('Body', c.axis);
        await expect(dial, `CALIBRATION: no dial for Body ${c.axis} on ${c.preset}.`).toHaveCount(1);

        // ⚠️ Shift+Arrow steps by 90 — the shipped keymap, and it lands exactly on a quadrant (step 77's snap).
        await composer.nudgeDial('Body', c.axis, 'ArrowRight', true);

        const after = await composer.rowValues(0);
        const field = Number(after[`Body Shift ° ${c.axis}`] ?? 'NaN');
        expect(field, `step ${c.step} — Fail (75/76): the \`Shift °\` field took the number you DIALLED. Then the `
          + 'dial is treating the stored phase AS the shift and ignoring the winding multiplication, which is the '
          + `very confusion it exists to remove — on a winding-${c.winding} axis that is a factor of `
          + `${c.winding}. The argument is \`(n+phase)·winding\`, so a 90° shift is stored as 90/${c.winding}.`)
          .toBeCloseTo(c.expected, 3);

        const readouts = await composer.readoutTexts();
        expect(readouts[0], `step ${c.step}: the readout does not confirm the 90° shift the dial applied. That `
          + 'readout and this dial are the same fact from two directions.').toMatch(/shift/);
      }
    });

  /*
   * ⚠️ **78 AND 79 ARE ONE PAIR AND MUST BE GRADED TOGETHER: THE SAME ROW SHAPE WITH THE ZERO MOVED FROM THE
   * WINDING TO THE SIZE, AND ONLY ONE OF THEM MAY DISABLE THE DIAL.** *"Cannot be applied"* versus *"cannot be
   * seen"* — only the first may disable anything. Fail (78): the dial spins → `target/0` was divided anyway and
   * **`Infinity` is written into `generators.waves`**, a corrupted preset from one drag (§L measures 743 of 2562
   * live axes already at winding 0). Fail (79): a greyed dial on a zero-SIZE axis is a WORKING control reported
   * as broken — the stored shift is real, exported, and visible the moment the axis gains size.
   */
  test('steps 78, 79 — a zero-WINDING dial is disabled and says why; a zero-SIZE dial stays LIVE and the readout '
    + 'owns that case', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();

    // step 78 — Deep Thought2 Body Z: winding 0, size 100 — the largest size on the row, and still refused.
    await composer.loadPreset('Deep Thought2');
    await composer.openComposer();
    const dtBody = await composer.rowValues(0);
    expect(Number(dtBody['Body Winding Z']), 'CALIBRATION: Deep Thought2 Body Z is not at winding 0, so step 78 '
      + 'is not in its stated state.').toBe(0);
    expect(Number(dtBody['Body Size Z']), 'CALIBRATION: Deep Thought2 Body Z has no size, which would make step '
      + '78 an invisible axis rather than *"a fully visible axis that still refuses a shift"* — the whole point.')
      .toBeGreaterThan(0);

    const zDial = composer.dialFor('Body', 'Z');
    await expect(zDial, 'CALIBRATION: no Z dial on Deep Thought2 Body.').toHaveCount(1);
    await expect(zDial, 'step 78 — Fail (78): the dial is LIVE over a winding of 0. Then `target / 0` is divided '
      + 'anyway and `Infinity` is written into `generators.waves` — a corrupted preset from one drag. The '
      + 'refusal is ALGEBRA, not defensiveness: the argument is `(n+phase)·0`, identically zero, so no phase '
      + 'whatsoever can shift it.').toHaveClass(/inert/);

    const zTitle = (await zDial.getAttribute('title')) ?? '';
    expect(zTitle.length, 'step 78: the disabled dial states no reason. With nothing on screen saying why, a '
      + 'refused control is indistinguishable from a broken one.').toBeGreaterThan(0);

    // step 79 — the CONVERSE: Quader Structure Z, winding 96 and size 0 → the dial must stay LIVE.
    await composer.loadPreset('Quader');
    await composer.openComposer();
    const qStruct = await composer.rowValues(1);
    expect(Number(qStruct['Structure Winding Z']), 'CALIBRATION: Quader Structure Z is not at winding 96.')
      .toBeGreaterThan(0);
    expect(Number(qStruct['Structure Size Z']), 'CALIBRATION: Quader Structure Z has a size, so step 79 is not in '
      + 'its stated state and the pair with 78 collapses.').toBe(0);

    await expect(composer.dialFor('Structure', 'Z'), 'step 79 — Fail (79): the dial is GREYED on a zero-SIZE '
      + 'axis. That is a WORKING control reported as broken: the stored shift is real, exported, and becomes '
      + 'visible the moment the axis gains size. ⚠️ Two different claims — "cannot be applied" vs "cannot be '
      + 'seen" — and only the first may disable anything. The row\'s own `no size — winding inert there` readout '
      + 'is what owns this case.').not.toHaveClass(/inert/);

    const readouts = await composer.readoutTexts();
    expect(readouts[1], 'step 79: the row does not state `Z no size — winding inert there`, which is the readout '
      + 'that owns the "cannot be seen" case in place of a disabled control.').toContain('no size');
  });

  /*
   * ⚠️ **STEP 81'S `Home` EXPECTATION IS RETIRED COPY: `installDial`'s `keydown` HANDLES THE FOUR ARROWS ONLY**
   * (±1, with ±90 on Shift). There is no `Home` handler in the shipped source. So the arrow half is asserted as
   * behaviour and the `Home` half is asserted as a finding, in the direction the code supports — an unreachable
   * assertion would be worse than a missing one.
   *
   * ⚠️ **THIS STEP AND STEPS 75–77 FAILED ON ONE `src/` DEFECT, MEASURED AT 75 — the missing `stopPropagation()`
   * in `installDial`'s `keydown` letting the document preset switcher (guard `tagName === 'INPUT'`, and a dial is a
   * `<canvas>`) fire on the same press.** ⚠️ **TWO RED STEPS WERE ONE FINDING: the single dial fix turned both
   * green, and counting them as two subjects would have double-counted it.** ✅ Fixed in `src/` 2026-09-10.
   * ⚠️ **THE `Home` CLAUSE IS INDEPENDENT OF THAT AND STILL ASSERTS A RETIRED EXPECTATION — so this test is now
   * MIXED: its arrow clauses are confirmations and its `Home` clause is a finding. Do not read one colour for the
   * whole test.**
   */
  test('step 81 — arrow keys move the dial in steps; `Home` does NOT return it to 0 and that is a retired '
    + 'expectation', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Anima Electrica');
    await composer.openComposer();

    await composer.setField('Body', 'Shift °', 'Y', '0');
    const read = async () => Number((await composer.rowValues(0))['Body Shift ° Y'] ?? 'NaN');
    expect(await read(), 'CALIBRATION: the shift did not reset to 0 before the keyboard test.').toBe(0);

    await composer.nudgeDial('Body', 'Y', 'ArrowRight');
    const afterRight = await read();
    expect(afterRight, 'step 81: `ArrowRight` did not move the dial. The shipped keymap is the four arrows, '
      + '±1 of SHIFT degrees (±90 with Shift held).').not.toBe(0);

    await composer.nudgeDial('Body', 'Y', 'ArrowLeft');
    expect(await read(), 'step 81: `ArrowLeft` did not undo `ArrowRight` — the steps are asymmetric.')
      .toBeCloseTo(0, 6);

    // Move it away, then press `Home` — which the shipped dial does not handle.
    await composer.nudgeDial('Body', 'Y', 'ArrowRight', true);
    const beforeHome = await read();
    expect(beforeHome, 'CALIBRATION: the dial did not move before `Home`, so the clause below could not tell a '
      + 'working `Home` from a dial that never left 0.').not.toBe(0);

    await composer.dialFor('Body', 'Y').press('Home');
    await composer.page.waitForTimeout(250);
    expect(await read(), 'step 81 — A RETIRED EXPECTATION, NOT A REGRESSION: the script says `Home` returns the '
      + 'dial to 0, and `installDial` has no `Home` handler — its `keydown` handles the four arrows only. This '
      + 'clause asserts the shipped behaviour so the run record carries the divergence. If `Home` now works, the '
      + 'step is no longer retired and this clause is what must change.').toBeCloseTo(beforeHome, 6);
  });

  /* ═══ §B9 · `Pulse` and `Wobble` in percent and seconds — steps 82–91 ═══════════════════════════
   * ⚠️ **BREATHE SECONDS ARE `(360/rate)/(60·waveSpeed)`** — an invariant-10 UNITS claim: a converter dropping
   * `waveSpeed` is right on nearly every preset and **wrong by 10× on four**. Depth is a percent/absolute HYBRID
   * (a modulator over a zero base is a real authored state), a pulse over 100 % is accepted UNCLAMPED, and **the
   * percent view does NOT round-trip at any precision — it is a VIEW; never re-derive a stored value from it.**
   */
  test('steps 82, 83, 84 — the breathe views exist above the raw rows, a depth over a nonzero base reads `%`, and '
    + 'the zero-base hybrid reads `abs`', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Argus');
    await composer.openComposer();

    // step 82 — the two `(% · s)` rows exist, each with three depth fields, three unit chips, three seconds.
    const views = await composer.breatheViews(0);
    expect(views.length, 'step 82: Argus\'s Body row does not publish the breathe VIEW inputs. There must be a '
      + '`Pulse (% · s)` row and a `Wobble (% · s)` row, each with three depths and three seconds — 12 view '
      + 'inputs in all, which is exactly why counting 33 `sl-composer-num` inputs measures a DIFFERENT quantity '
      + 'from the 21 that round-trip.').toBeGreaterThanOrEqual(12);

    /*
     * ⚠️ **83 AND 84 ARE ONE PROPERTY WITH TWO BRANCHES, AND THE UNIT CHIP IS WHAT MAKES IT HONEST.** A row
     * showing an absolute number under a `%` chip is the same defect wearing the right number. Argus is the
     * witness because ONE row carries both branches: X/Y `Wobble` over winding 0 and Z `Pulse` over size 0.
     */
    const v = await composer.rowValues(0);

    for (const [quantity, axis, base] of [
      ['Wobble', 'X', 'Body Winding X'], ['Wobble', 'Y', 'Body Winding Y'], ['Pulse', 'Z', 'Body Size Z'],
    ] as const) {
      const baseVal = Number(v[base] ?? 'NaN');
      expect(baseVal, `CALIBRATION: Argus Body ${base} is not 0, so step 84's hybrid branch is not in its stated `
        + 'state on this axis.').toBe(0);

      const chip = await composer.breatheView(0, quantity, axis, 'depth');
      expect(chip.unit, `step 84 — Fail (84): the ${quantity} ${axis} depth sits over a ZERO base and its unit `
        + 'chip does not read `abs`. A modulator over a zero base is COMMON in this library, not an edge case '
        + '(386 of 1132 pulse axes over size 0; 343 of 1217 wobble axes over winding 0), so the '
        + 'percent/absolute hybrid is required — and the chip is what makes it honest.').toMatch(/abs/i);
      expect(chip.value, `step 84: the ${quantity} ${axis} depth reads \`Infinity\`, \`NaN\` or blank over a `
        + 'zero base.').toMatch(/^-?\d+(\.\d+)?$/);
    }

    // step 83 — a depth over a NONZERO base reads as a percentage with a `%` chip.
    const percentChips = views.filter((x) => x.label.includes('depth') && /%/.test(x.unit));
    expect(percentChips.length, 'step 83: no depth anywhere reads as a PERCENTAGE. If every chip says `abs`, the '
      + 'hybrid has collapsed to its absolute branch and step 84 would pass for the wrong reason.')
      .toBeGreaterThan(0);
  });

  /*
   * ⚠️ **STEP 87 HAS MOVED INTO ITS OWN TEST BELOW, BECAUSE ITS DRIVING CHANNEL IS GONE.** The owner removed the
   * `Sweep rate` control on 2026-09-10, so a sweep-rate MOVE is no longer performable and the clause is now a
   * comparison across a controlled PRESET PAIR — which cannot share a fixture with the steps here, since a preset
   * load discards step 86's edit. The step number is unchanged; only the enclosing `test()` differs.
   */
  test('steps 85, 86, 89, 90 — the seconds views convert both ways and print NOTHING where no period exists',
    async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Argus');
    await composer.openComposer();

    // step 85 — plausible human periods: Wobble rate 0.1 → 1200 s; Z Pulse rate 1 → 120 s, at sweep 0.05.
    const wobbleSecs = await composer.breatheView(0, 'Wobble', 'X', 'seconds');
    expect(Number(wobbleSecs.value), 'step 85: the Wobble period is not 1200 s. The arithmetic is '
      + '`(360/rate)/(60·waveSpeed)` — a converter dropping `waveSpeed` is right on nearly every preset and '
      + 'wrong by 10× on four, which is an invariant-10 units defect that `tsc` sees as `number`.')
      .toBeCloseTo(1200, 0);

    expect(Number((await composer.breatheView(0, 'Pulse', 'Z', 'seconds')).value), 'step 85: the Z Pulse period '
      + 'is not 120 s at rate 1 and sweep 0.05.').toBeCloseTo(120, 0);

    // step 86 — set Z Pulse seconds 120 → 30 → the RAW `Pulse rate` updates 1 → 4.
    const secField = composer.breatheField(0, 'Pulse', 'Z', 'seconds');
    await expect(secField, 'step 86: the seconds field is not addressable by its aria-label.').toHaveCount(1);
    await secField.fill('30');
    await secField.press('Tab');
    await composer.page.waitForTimeout(400);

    expect(Number((await composer.rowValues(0))['Body Pulse rate Z']), 'step 86: changing the seconds VIEW did '
      + 'not write the raw `Pulse rate`. The view converts in both directions — 120 s → 30 s is 4×, so the rate '
      + 'goes 1 → 4.').toBeCloseTo(4, 3);

    /* step 87 was here and now has its own `test()` below — the sweep-rate control it drove no longer exists. */

    /*
     * step 89 — on an axis with ZERO depth the seconds field is still EDITABLE (24 library axes author a rate
     * with no amplitude, so greying this would destroy them on the first edit).
     * step 90 — a rate of 0 → the seconds field shows EMPTY, never `Infinity` or `0`.
     */
    await composer.openComposer();
    await composer.setField('Body', 'Wobble', 'X', '0');
    await composer.breatheView(0, 'Wobble', 'X', 'seconds');
    await expect(composer.breatheField(0, 'Wobble', 'X', 'seconds'), 'step 89: the seconds field is DISABLED on a '
      + 'zero-depth axis. 24 library axes author a rate with no amplitude, so greying this would destroy them on '
      + 'the first edit — set the timing first, then the amount.').toBeEnabled();

    await composer.setField('Body', 'Wobble rate', 'X', '0');
    const noPeriod = await composer.breatheView(0, 'Wobble', 'X', 'seconds');
    expect(noPeriod.value.trim(), 'step 90: with the rate at 0 there is NO period, and the field must show '
      + 'EMPTY — never `Infinity`, never `0`. A zero would be a value the reader must attribute to something.')
      .toBe('');
  });

  /*
   * ⚠️ **STEP 87 IS THE UNITS CLAUSE AND IT IS THE ONE A CONVERTER FAILS SILENTLY:** every seconds label must be
   * quoted at the FIGURE'S OWN stored `waveSpeed`, and `CLAUDE.md`'s standing figure is why — *"a converter that
   * hardcodes 0.05 is right on 375 presets and wrong by up to 10× on the rest."*
   *
   * ⚠️ **THE DRIVING CHANNEL IS GONE AND THE REPLACEMENT IS STRONGER, NOT WEAKER.** The step used to move the
   * Composer's `Sweep rate` control 0.05 → 0.1 and assert every seconds label halved with no stored rate touched;
   * the owner removed that control on 2026-09-10 (*"just use the default value and don't provide a control for
   * it"*). Nothing on the tab moves `waveSpeed` now, so the comparison moves to a **controlled preset pair** —
   * which also catches the hardcoded-0.05 defect the original could not, because the original started FROM 0.05.
   *
   * ⚠️ **THE PAIR: `Firestorm` (`waveSpeed` 0.12) AND `Ember Storm` (0.10) CARRY BYTE-IDENTICAL MODULATOR CELLS.**
   * Verified by importing `composer-model.ts`'s own `readFigure` over the whole library and comparing
   * `slots.map(s => s.axes)` as JSON: identical, all three slots non-silent on both, unmuted on both. **So the two
   * halves of the original step survive as they were:** the raw rates must READ THE SAME on both figures (the *"no
   * stored value moved"* half, now a property of the pair rather than of an edit) while every seconds label
   * differs by the stored-rate quotient 0.12/0.10 = **1.2**.
   *
   * ⚠️ **BOTH LABEL SETS ARE ASSERTED VERBATIM RATHER THAN AS A RATIO, and that is deliberate: a ratio clause
   * cannot see a constant-factor error** — a converter that dropped `60` or applied `DEG` would still produce
   * labels in a 1.2 ratio. The twelve figures below come from `modulatorSeconds(rate, waveSpeed)` at
   * `(360/rate)/(60·waveSpeed)`, rounded the way `syncBreatheCells` rounds (`toFixed(s < 1 ? 3 : 1)` then
   * `Number`). A hardcoded 0.05 would print **34.3 / 40 / 48 / 100 / 120 / 150** for BOTH figures, which is
   * neither expected set.
   */
  test('step 87 — every seconds label follows the FIGURE\'S OWN stored sweep rate, on a pair whose stored '
    + 'modulator cells are identical', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Firestorm');
    await composer.openComposer();

    /*
     * The absence clause first, because the step's whole shape depends on it: if a `Sweep rate` control ever comes
     * back, the ORIGINAL step 87 is performable again and this pair-based version is the wrong instrument.
     */
    await composer.assertNoSweepRateControl();

    const AXES = ['X', 'Y', 'Z'] as const;
    const readSeconds = async () => {
      const out: Record<string, string> = {};
      for (const which of ['Pulse', 'Wobble'] as const) {
        for (const axis of AXES) {
          out[`${which} ${axis}`] = (await composer.breatheView(0, which, axis, 'seconds')).value;
        }
      }
      return out;
    };
    const rateKeys = (v: Record<string, string>) => Object.fromEntries(
      Object.entries(v).filter(([k]) => / (Pulse|Wobble) rate [XYZ]$/.test(k)));

    const fastSecs = await readSeconds();
    const fastRates = rateKeys(await composer.rowValues(0));
    expect(Object.keys(fastRates).length, 'CALIBRATION: `Firestorm`\'s Body row does not publish six raw rate '
      + 'fields, so the "no stored value moved" half below would compare an empty object to an empty object — '
      + 'which is the false-pass shape this step is most exposed to.').toBe(6);

    expect(fastSecs, 'step 87: `Firestorm`\'s seconds labels are not the ones its OWN stored `waveSpeed` of 0.12 '
      + 'implies. The arithmetic is `(360/rate)/(60·waveSpeed)`; a converter that hardcodes the modal 0.05 prints '
      + '34.3 / 40 / 48 / 100 / 120 / 150 here and is right on 375 of the library\'s presets, which is why no '
      + 'single-preset clause can see it (invariant 10 — `tsc` sees every one of these as `number`).').toEqual({
      'Pulse X': '14.3', 'Pulse Y': '16.7', 'Pulse Z': '20',
      'Wobble X': '41.7', 'Wobble Y': '50', 'Wobble Z': '62.5',
    });

    // ---- the same figure at a different stored rate, and nothing else different ----
    await composer.loadPreset('Ember Storm');
    await composer.openComposer();

    const slowRates = rateKeys(await composer.rowValues(0));
    expect(slowRates, 'CALIBRATION FAIL: `Firestorm` and `Ember Storm` no longer carry identical stored modulator '
      + 'rates, so this step\'s controlled pair has been broken by a retune and the seconds comparison below is '
      + 'measuring two different figures rather than two rates. Re-derive the pair with `readFigure` over the '
      + 'library before touching either expectation — and note that `CLAUDE.md` forbids retuning a library preset '
      + 'to repair a spec.').toEqual(fastRates);

    const slowSecs = await readSeconds();
    expect(slowSecs, 'step 87: `Ember Storm`\'s seconds labels are not the ones its stored `waveSpeed` of 0.10 '
      + 'implies. Its raw rates are identical to `Firestorm`\'s (asserted just above), so every difference here '
      + 'is the stored sweep rate and nothing else — 0.12/0.10 = 1.2× longer, axis by axis.').toEqual({
      'Pulse X': '17.1', 'Pulse Y': '20', 'Pulse Z': '24',
      'Wobble X': '50', 'Wobble Y': '60', 'Wobble Z': '75',
    });

    /*
     * ⚠️ **AND THE COLLAPSE CLAUSE, WHICH IS THE ONE A HARDCODED CONSTANT FAILS:** if the converter ignores the
     * figure's own rate the two sets are EQUAL, and both `toEqual`s above would have to be wrong in the same
     * direction for that to slip through — but stating it separately means the failure message names the
     * mechanism instead of one axis.
     */
    expect(slowSecs, 'step 87: the two figures printed the SAME seconds labels. Their stored `waveSpeed` values '
      + 'differ (0.12 vs 0.10) and their raw rates do not, so identical labels mean the converter is not reading '
      + '`waveSpeed` at all — the exact invariant-10 defect this step exists for.').not.toEqual(fastSecs);
  });

  /*
   * ⚠️ **STEP 88 IS THE UNCLAMPED CASE AND ITS FAILURE IS SILENT DATA LOSS IN A NEW COSTUME:** clamping to 100
   * would REWRITE the 436 library axes that carry a pulse larger than their own size, on tab open.
   * ⚠️ **STEP 91 IS THE ROUND-TRIP DRIFT: the percent display is lossy ON PURPOSE and does not converge at any
   * precision** (§M: 1254 of 1620 axes at 2 dp, 1504 at 10), so a drift means `sync()` is reading its own rounded
   * output back — *"never re-derive a stored value from a displayed one."*
   */
  test('steps 88, 91 — a depth over 100 % is accepted unclamped, and a percent reading does not drift across a '
    + 'tab switch', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Behind A Glass Window');
    await composer.openComposer();

    const depthOf = async () => composer.breatheView(1, 'Pulse', 'X', 'depth');
    await depthOf();

    // step 88 — type 150 % → ACCEPTED, not clamped.
    const field = composer.breatheField(1, 'Pulse', 'X', 'depth');
    await field.fill('150');
    await field.press('Tab');
    await composer.page.waitForTimeout(400);

    const after = await depthOf();
    expect(Number(after.value), 'step 88 — Fail (88): the value was CLAMPED to 100. Then opening the tab '
      + 'REWRITES the 436 library axes that carry a pulse larger than their own size — the silent-data-loss shape '
      + 'in a new costume. The base passes through zero each cycle and the figure inverts; that is an AUTHORED '
      + 'state.').toBeGreaterThan(100);

    /*
     * step 91 — switch tabs and back → the reading has NOT drifted.
     * ⚠️ The stored value is the oracle, not the view: this compares the RAW field across the switch and requires
     * the view to be consistent with it, rather than requiring the lossy percent to be byte-stable.
     */
    const rawBefore = (await composer.rowValues(1))['Structure Pulse X'];
    const viewBefore = (await depthOf()).value;
    await composer.openTab('materials');
    await composer.page.waitForTimeout(300);
    await composer.openComposer();

    expect((await composer.rowValues(1))['Structure Pulse X'], 'step 91: the STORED pulse drifted across a tab '
      + 'switch. The percent display is lossy on purpose and must never be read back into the model — a drift '
      + 'here means `sync()` is re-deriving the stored value from its own rounded output.').toBe(rawBefore);
    expect((await depthOf()).value, 'step 91: the percent VIEW drifted across a tab switch while the stored '
      + 'value held. Then the view is being recomputed from a different base each time it renders.')
      .toBe(viewBefore);
  });

  /* ═══ §B10 · Fractional windings and the `open` badge — steps 92–95 ═════════════════════════════
   * ⚠️ **THE STEPPER USED TO SILENTLY ROUND WHAT YOU TYPED, AND SINCE 16.15 NOTHING ON THE COMMIT PATH ROUNDS.**
   * `grep axisRow` for `Math.round`: there must be none. ⚠️ **THAT IS NARROWER THAN *"nothing rounds at all"*, AND
   * THE DIFFERENCE IS THE WHOLE OF STEPS 94–96: TYPING IS VERBATIM, THE ARROWS QUANTISE TO THE INTEGER GRID** —
   * two properties of one field, settled as such by the owner 2026-09-10 (see step 95). **`open` IS A
   * DESCRIPTION, NOT A WARNING** — it is the mechanism behind the library's spirograph looks, and styling it as
   * broken would tell the user the engine is wrong on twelve authored axes.
   */
  test('steps 92, 93, 94, 95, 96 — an authored 0.5 reads `open`, a typed 3.5 SURVIVES, the arrows step to '
    + 'INTEGERS, and nothing restores an integer from a typed fraction', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();

    // step 92 — Quader Body Z winding is 0.5, an authored fraction in the library today.
    await composer.loadPreset('Quader');
    await composer.openComposer();
    const q = await composer.rowValues(0);
    expect(Number(q['Body Winding Z']), 'CALIBRATION: Quader Body Z is not at 0.5, so step 92 is not in its '
      + 'stated state. The library\'s only non-integer windings are 0.5 and 112.5, both exact ties.').toBe(0.5);

    const readouts = await composer.readoutTexts();
    expect(readouts[0], 'step 92: the readout does not say `open — Z leaves a seam` on a fractional winding. '
      + '⚠️ Fail (92/94): a `closes` badge here, or a closed curve in the panes, means `drawScore` extended the '
      + 'sweep to `k·360` to make an open curve look tidy — which would draw `open` and `closes` IDENTICALLY and '
      + 'delete this readout\'s only output channel.').toMatch(/open/);
    expect(readouts[0], 'step 92: the readout names no axis for the seam.').toMatch(/Z/);

    /*
     * step 93 — `open` MUST NOT LOOK LIKE AN ERROR: no red, no warning icon, no exclamation mark. The colour
     * judgement is a human verdict; what the DOM owns is the absence of error MARKUP and of alarm punctuation.
     */
    const readoutEl = composer.readout(0);
    const cls = (await readoutEl.getAttribute('class')) ?? '';
    expect(cls, 'step 93: the readout carries error/warning styling on a fractional winding. `open` sits in the '
      + 'same NEUTRAL readout as `closes` — a fractional winding is the mechanism behind the library\'s '
      + 'spirograph looks, and styling it as broken would tell the user the engine is wrong on twelve authored '
      + 'axes.').not.toMatch(/error|warn|danger|invalid/i);
    expect(readouts[0], 'step 93: the readout uses alarm punctuation for `open`.').not.toMatch(/[!⚠]/);

    // step 94 — type 3.5 into Aliens DNA Body X and commit → the field KEEPS 3.5.
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();
    await composer.setField('Body', 'Winding', 'X', '3.5');
    expect((await composer.rowValues(0))['Body Winding X'], 'step 94 — Fail (94/95): your `3.5` became `4`. Then '
      + 'the rounding parameter is back and every fractional winding a user types is silently destroyed — the '
      + 'exact defect class this tab exists to eliminate, arriving through an input handler. Grep `axisRow` for '
      + '`Math.round`; there must be none.').toBe('3.5');
    expect((await composer.readoutTexts())[0], 'step 94: the readout did not switch to `open` on a typed 3.5.')
      .toMatch(/open/);

    /*
     * step 95 — the spinner ARROWS move by ±1 and do NOT snap to an integer.
     *
     * ⚠️ **SETTLED BY THE OWNER 2026-09-10, AND THE ANSWER IS THAT THE SHIPPED BEHAVIOUR IS CORRECT AND *THIS
     * CLAUSE* WAS THE WRONG SIDE.** The decision, verbatim in substance: *"the winding step should typically be
     * one; the ability must remain to type a non-integer such as 2.5, but the stepper and arrows step to integers
     * only."* Measured 2026-09-09: from a typed `3.5`, `ArrowUp` yields **`4`** — which is exactly that. So the
     * expectation is now `4` and `5`, not `4.5` and `5.5`.
     *
     * ⚠️ **NO `src/` EDIT WAS NEEDED AND THAT IS THE FINDING: THE BEHAVIOUR WAS ALREADY RIGHT.** `composer.ts`
     * ships `step="1"` with **no `Math.round` on the commit path**, and the BROWSER snaps arrow stepping to the
     * step GRID (the nearest multiple of the step, not `value + step`). **Typed values are untouched; arrows
     * quantise.** ⚠️ **THE ATTRIBUTE IS LOAD-BEARING FOR TWO SEPARATE PROPERTIES AT ONCE — it grants the ±1
     * arrow step AND the integer grid — so neither candidate remedy was ever needed:** `step="any"` would have
     * deleted the ±1 step 16.13 wanted, and a hand-written `keydown` would have re-introduced a second writer of
     * the field, the shape 16.15 deleted `repairFigure` to avoid.
     *
     * ⚠️ **THE PRECEDING CLAUSE (STEP 94) IS WHAT KEEPS THIS HONEST AND MUST NEVER BE WEAKENED TO MATCH: it
     * asserts the typed `3.5` SURVIVES.** Together the two say *"typing is verbatim, stepping is integer"* — the
     * decision's two halves, each with its own clause. **A single clause cannot express it, which is why the
     * earlier reading of this pair as one contradiction was wrong.** ⚠️ **This is a clause asserting an OWNER
     * DECISION, not a shipped defect: its green means the behaviour is intended — unlike the deliberately red
     * steps elsewhere in this file, where green would mean a defect is still present.**
     */
    const field = composer.field('Body', 'Winding', 'X');
    await field.focus();
    await field.press('ArrowUp');
    await composer.page.waitForTimeout(250);
    expect((await composer.rowValues(0))['Body Winding X'], 'step 95: `ArrowUp` from a typed 3.5 did not reach the '
      + 'next INTEGER. The owner\'s rule (2026-09-10) is that the arrows step to integers only, which the `step="1"'
      + '` grid delivers; a reading of `4.5` here means the grid was loosened — most likely to `step="any"`, which '
      + 'also DELETES the ±1 move 16.13 wanted.').toBe('4');
    await field.press('ArrowUp');
    await composer.page.waitForTimeout(250);
    expect((await composer.rowValues(0))['Body Winding X'], 'step 95: the second arrow step is not ±1 on the '
      + 'integer grid.').toBe('5');

    /*
     * step 96 (RETIRED as `Repair`, REPLACED by the stronger property) — **nothing anywhere restores a TYPED
     * fraction to an integer:** not a blur, not a tab switch, not a Snapshot, not an Export → Import round trip.
     *
     * ⚠️ **THE FRACTION IS RE-TYPED HERE, AND OMITTING THAT WOULD HAVE MADE EVERY CLAUSE BELOW VACUOUS.** Step 95
     * now leaves the field on an INTEGER by design, so carrying its value forward would assert *"an integer
     * survives a round trip"* — true of the whole library, discriminating nothing, and **green**. This is the
     * subject-substitution failure: the value changed under the step and the clauses kept their shape.
     * ⚠️ **AND THE TIE RULE IS NOW A FACT WITH NO IMPLEMENTATION:** `Math.round(-9.5) === -9`, not `-10`, and the
     * library's only fractions are exact ties — so if rounding is ever wanted again it must be re-derived.
     */
    await composer.setField('Body', 'Winding', 'X', '5.5');
    expect((await composer.rowValues(0))['Body Winding X'], 'CALIBRATION for step 96: the re-typed 5.5 did not '
      + 'land, so every clause below would be about an integer and would pass on nothing. This is step 94\'s '
      + 'property again and a failure here localises to the commit path, not to the round trip.').toBe('5.5');

    await composer.openTab('materials');
    await composer.openComposer();
    expect((await composer.rowValues(0))['Body Winding X'], 'step 96: a tab switch restored the integer.')
      .toBe('5.5');

    await composer.clickSnapshot();
    expect((await composer.rowValues(0))['Body Winding X'], 'step 96: a `Snapshot` restored the integer.')
      .toBe('5.5');

    const exported = await composer.exportPresetText();
    const name = await composer.importPresetJSON(exported, 'step96-fraction.json');
    await composer.loadPreset(name);
    await composer.openComposer();
    expect((await composer.rowValues(0))['Body Winding X'], 'step 96: an Export → Import round trip restored the '
      + 'integer. This is the STRONGER property that replaced the retired `Repair` steps, and it is now the only '
      + 'one available — nothing on the COMMIT path may round.').toBe('5.5');
  });

  /* ═══ §B11 · The per-row `✕` clear — steps 103–104b ═════════════════════════════════════════════
   * ⚠️ **THE PLAUSIBLE WRONG VERSION LOOPS OVER `model.slots` RATHER THAN ONE SLOT'S AXES** — one word different,
   * type-checks, and clears the WHOLE FIGURE. §P seeds exactly that. And **the `✕` is on the seven RAW axis rows
   * only**: the dial row and the two `(% · s)` rows have none, because they are VIEWS of fields the raw rows
   * already own and a `✕` there would be a second writer of one value.
   */
  test('steps 103, 103b — a row `✕` clears three axes of ONE quantity and nothing else, and its tooltip states '
    + 'the irreversibility', async ({ composer, page }) => {
    test.slow();
    await composer.bootWithHook();
    /*
     * ⚠️ **`Distortion`, NOT `Aliens DNA`, AND THE SUBJECT WAS A HARNESS DEFECT — THE STEP'S PRECONDITION IS THAT
     * THE ROW SURVIVES ITS OWN CLEAR.** `Aliens DNA`'s Body has `Size = [0, 0, 0]` (it is entirely a pulse figure),
     * so clearing `Pulse` makes the slot SILENT, `clearAxisRow` correctly calls `renderSlotBody` and the row
     * collapses to the placeholder — after which every `aria-label` this test reads is GONE and `Number(undefined)`
     * is `NaN`. The red accused the clear of losing values it had in fact only stopped displaying.
     * Measured over the union: 79 presets have all of `Pulse`, `Size`, `Winding` and `Wobble` live on the Body;
     * `Distortion` is one (pulse `[4,11,18]`, size `[2,9,16]`), so the row stays LIT and "nothing else moved" is
     * measurable — which is the whole subject of 103.
     */
    await composer.loadPreset('Distortion');
    await composer.openComposer();

    const before = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));
    const pulseNonzero = (['X', 'Y', 'Z'] as const)
      .map((a) => Number(before[0]![`Body Pulse ${a}`] ?? '0')).filter((x) => x !== 0);
    expect(pulseNonzero.length, 'CALIBRATION: Distortion Body has no nonzero `Pulse`, so the clear below would '
      + 'have nothing to remove and step 103 would pass vacuously.').toBeGreaterThan(0);
    const sizeNonzero = (['X', 'Y', 'Z'] as const)
      .map((a) => Number(before[0]![`Body Size ${a}`] ?? '0')).filter((x) => x !== 0);
    expect(sizeNonzero.length, 'CALIBRATION: Distortion Body has no nonzero `Size`, so clearing `Pulse` would make '
      + 'the slot SILENT and collapse the row to the placeholder — every label below would vanish and the clauses '
      + 'would read `NaN`, accusing the clear of losing values it only stopped DISPLAYING.').toBeGreaterThan(0);

    // step 103b — the tooltip, asserted BEFORE the destructive click.
    const clearBtn = page.locator(`${SEL.tabContent} ${SEL.axisClear('Body', 'Pulse')}`);
    await expect(clearBtn, 'CALIBRATION: no `✕` on Body\'s `Pulse` row.').toHaveCount(1);
    const tip = (await clearBtn.getAttribute('title')) ?? '';
    expect(tip.length, 'step 103b: the `✕` has NO tooltip. With no confirmation dialog, the tooltip is the ONLY '
      + 'place the irreversibility can be stated — report a missing one as a defect, not as a missing nicety.')
      .toBeGreaterThan(0);
    expect(tip, 'step 103b: the tooltip does not state that the clear is immediate with no undo.')
      .toMatch(/undo|immediat|no confirmation/i);

    // step 103 — click it: all three pulse fields go to 0, `Pulse rate` KEEPS its values, no other row moves.
    await composer.clearQuantity('Body', 'Pulse');
    const after = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));

    for (const a of ['X', 'Y', 'Z'] as const) {
      expect(Number(after[0]![`Body Pulse ${a}`]), `step 103: Body Pulse ${a} is not 0 after the clear.`).toBe(0);
    }
    for (const a of ['X', 'Y', 'Z'] as const) {
      expect(after[0]![`Body Pulse rate ${a}`], `step 103: \`Pulse rate ${a}\` was cleared too. The scope is ONE `
        + 'quantity\'s three axes — the plausible wrong version loops over `model.slots` instead of one slot\'s '
        + 'axes: one word different, type-checks, and clears the whole figure.')
        .toBe(before[0]![`Body Pulse rate ${a}`]);
    }
    for (const n of [1, 2]) {
      expect(after[n], `step 103: clearing Body's \`Pulse\` also changed ${LEVEL_NAMES[n]}. §P measures this `
        + 'scope over 4200 (preset × slot × field) clears.').toEqual(before[n]);
    }
  });

  /*
   * ⚠️ **104 IS ALGEBRAICALLY DIFFERENT AND IT IS THE ONE TO WATCH: CLEARING `Winding` MUST RE-INERT ALL THREE
   * `Shift` DIALS IN THE SAME CLICK** — a CONSEQUENCE IN A DIFFERENT CONTROL, which is what §P owns. A dial that
   * still looks live over a winding of 0 would look usable and do nothing (the write is refused because
   * `target/0` stores `Infinity`), with nothing on screen saying why. **758 of 854 live slots carry a live dial,
   * so this is the common case.**
   */
  test('step 104 — clearing `Winding` re-inerts all three `Shift` dials in the same click', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    /*
     * ⚠️ **`Distortion`, NOT `Aliens DNA`, AND THE SWAP IS FORCED BY A MEASUREMENT: THIS CLAUSE IS ABOUT ALL THREE
     * DIALS, SO ALL THREE WINDINGS MUST START NONZERO — AND ALIENS DNA'S BODY WINDING IS `5 / 5 / 0`.** Its Z dial
     * is ALREADY inert (correctly: `target / 0` writes `Infinity`), so the pre-mutation assertion failed and the
     * red accused the engine of a dial that was doing exactly the right thing. Measured over the 314-key union,
     * **117 presets carry three nonzero Body windings**; `Distortion` is `3 / 10 / 17`, and its sizes and pulses
     * are nonzero on all three axes too, which is why steps 104a/104b below use it as well.
     */
    await composer.loadPreset('Distortion');
    await composer.openComposer();

    const w0 = await composer.axisTriple('Body', 'Winding');
    expect(w0.every((w) => w !== 0), `CALIBRATION: Distortion's Body windings are ${JSON.stringify(w0)} — one is `
      + 'ZERO, so that axis\'s dial starts inert and the transition this step measures cannot be observed on it. '
      + '⚠️ Do NOT resolve this by dropping the axis: the claim is that ONE click re-inerts ALL THREE, and a '
      + 'two-of-three version passes on a loop that stops early.').toBe(true);
    for (const a of ['X', 'Y', 'Z'] as const) {
      await expect(composer.dialFor('Body', a), `CALIBRATION: Body's ${a} dial is ALREADY inert over a nonzero `
        + 'winding, so the clear below cannot demonstrate the transition — and a working control is being reported '
        + 'as broken.').not.toHaveClass(/inert/);
    }

    await composer.clearQuantity('Body', 'Winding');

    const v = await composer.rowValues(0);
    for (const a of ['X', 'Y', 'Z'] as const) {
      expect(Number(v[`Body Winding ${a}`]), `step 104: Body Winding ${a} is not 0 after the clear.`).toBe(0);
      await expect(composer.dialFor('Body', a), `step 104 — Fail (104): the ${a} dial is still LIVE over a `
        + 'winding of 0. The inert state is re-derived from the model on EVERY sync and the clear commits through '
        + 'the one path precisely so it comes for free — so a live dial here means the clear repainted numbers by '
        + 'hand instead of committing, the same bypass that would also skip the derived readouts.')
        .toHaveClass(/inert/);
    }
  });

  /*
   * ⚠️ **104a IS A RESULT-GATED REBUILD, NOT A FIELD-GATED ONE, AND IT MUST HOLD IN BOTH ORDERS.** Measured: of
   * 854 live slots, 334 go silent the moment `Size` is cleared and 131 the moment `Pulse` is, **so 520 need the
   * second click** — a row that collapses on the FIRST `Size` click while its pulse is still nonzero is the
   * defect. ⚠️ **And 104b's checkbox must have UNTICKED itself when the row went silent**, or there is nothing to
   * click: that was a real defect (the box painted from `!muted` alone).
   */
  test('steps 104a, 104b — the row collapses on the SECOND clear in either order, and the checkbox unticks itself '
    + 'and reseeds', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();

    for (const order of [['Size', 'Pulse'], ['Pulse', 'Size']] as const) {
      /*
       * ⚠️ **`Distortion`, NOT `Aliens DNA` — MEASURED: ALIENS DNA'S BODY `Size` IS `0 / 0 / 0`.** Its whole reach
       * is `Pulse` (15 / 25 / 64), so *"clear `Size` first"* is a NO-OP and the row collapses on the click the step
       * calls the second — indistinguishable from the field-gated defect this step exists to catch, and red for a
       * preset reason rather than an engine one. `Distortion` carries size `2 / 9 / 16` AND pulse `4 / 11 / 18`,
       * and the two-click collapse was simulated through the shipped `readFigure`/`writeFigure` in BOTH orders
       * before this subject was chosen: live after the first clear, silent after the second, both ways.
       *
       * ⚠️ **AND THE PRECONDITION IS READ WITH `axisTriple`, NOT `?? '0'`** — a missing label maps to a plausible
       * ZERO under `??`, so a renamed input would report the preset as lacking a size and the CALIBRATION line
       * would fire naming the preset. Seed 1 of `08-dom-steps-seeds.spec.ts` is what shows this matters.
       */
      await composer.loadPreset('Distortion');
      await composer.openComposer();

      const sizes = await composer.axisTriple('Body', 'Size');
      const pulses = await composer.axisTriple('Body', 'Pulse');
      expect(sizes.some((v) => v !== 0) && pulses.some((v) => v !== 0),
        `CALIBRATION (${order.join(' then ')}): Distortion's Body does not carry BOTH a size `
        + `(${JSON.stringify(sizes)}) and a pulse (${JSON.stringify(pulses)}), so the two-click collapse cannot be `
        + 'observed and a FIRST-click collapse — the defect — would look correct. ⚠️ Silence is '
        + '`size + pulse === 0`, never a single field, which is exactly why both must be live.').toBe(true);

      await composer.clearQuantity('Body', order[0]);
      expect(await composer.isEmptyRow(0), `step 104a (${order[0]} first): the row collapsed on the FIRST clear `
        + `while its ${order[1]} is still nonzero. Then the rebuild is keyed on the FIELD rather than on the `
        + 'resulting silence, and 520 of the library\'s live slots would lose their inputs while still audible.')
        .toBe(false);

      await composer.clearQuantity('Body', order[1]);
      expect(await composer.isEmptyRow(0), `step 104a (${order.join(' then ')}): the row did not collapse on the `
        + 'SECOND clear. Silence is `size + pulse === 0` — never a single field.').toBe(true);

      /*
       * step 104b — the checkbox must have UNTICKED itself, then ticking it reseeds with a VISIBLE wave.
       * ⚠️ **A TICKED BOX ON AN EMPTY ROW IS THE DEFECT RETURNING** — `refreshDerived()` clears a mute over an
       * empty level, so a box painted from `!muted` alone renders ticked over the placeholder, already in the
       * state you must move it to, firing no `change`. `levelIsOn()` is the owner: "on" is TWO facts.
       */
      expect(await composer.levelCheckbox(0).isChecked(), `step 104b (${order.join(' then ')}): the checkbox is `
        + 'still TICKED over an empty row, so there is nothing here to click. That is the `levelIsOn()` defect '
        + 'returning — the box painted from `!muted` alone.').toBe(false);

      await composer.levelCheckbox(0).check();
      await composer.page.waitForTimeout(500);
      expect(await composer.isEmptyRow(0), 'step 104b: ticking the checkbox did not bring the row back with real '
        + 'controls.').toBe(false);
      // ⚠️ `axisTriple` for the same reason as step 53's: `?? '0'` maps a MISSING label to a plausible zero, so a
      // body that never rebuilt would report the engine's seed as winding-less. See seed 1 of the seeds spec.
      const reseeded = await composer.axisTriple('Body', 'Winding');
      expect(reseeded.some((w) => w !== 0),
        'step 104b: the reseed has no winding — a size-only seed draws one point per axis, which reads as broken.')
        .toBe(true);
    }
  });

  /* ═══ §A12 / §B12 · The level switch and the level `Clear` — steps 105a–105i ═════════════════════
   * ⚠️ **THIS IS THE ONE BLOCK WHERE THE SCREEN AND THE INPUT BOXES ARE SUPPOSED TO DISAGREE, AND EVERYWHERE ELSE
   * THAT DISAGREEMENT IS THE DEFECT.** The owner's words: *"we want to keep the content of the matrix for later
   * editing but temporarily turn it off for the diagrams and the preview … export however or Snapshot would
   * export them cleared."* **So "the boxes still say 16 while the wave is gone from the picture" is a PASS.**
   */
  test('steps 105a, 105b, 105c, 105d — the switch removes the wave from the PICTURE while keeping all 21 numbers, '
    + 'and the round trip is exact', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();

    // step 105a — three checkboxes, three `Clear` buttons, all ticked, NO cyan notice.
    for (const n of [0, 1, 2]) {
      await expect(composer.levelCheckbox(n), `step 105a: no checkbox on ${LEVEL_NAMES[n]}'s head row.`)
        .toHaveCount(1);
      expect(await composer.levelCheckbox(n).isChecked(), `step 105a: ${LEVEL_NAMES[n]}'s box is not ticked on a `
        + 'freshly loaded lit preset.').toBe(true);
      await expect(composer.page.locator(`${SEL.tabContent} ${SEL.levelClear(LEVEL_NAMES[n]!)}`),
        `step 105a: no \`Clear\` button on ${LEVEL_NAMES[n]}'s head row.`).toHaveCount(1);
    }
    await expect(composer.notice('mute'), 'step 105a: the cyan notice is on screen with every level on.')
      .toBeHidden();

    const numbersAtEntry = await Promise.all([0, 1, 2].map((n) => composer.rowValues(n)));
    const sigAtEntry = await composer.canvasSignature();
    expect(sigAtEntry.lit, 'CALIBRATION: the frame is black at entry, so the picture-change clauses below would '
      + 'compare two dead states.').toBeGreaterThan(0);

    // step 105b — untick Body: the notice appears, the numbers STAY, the row is neither collapsed nor greyed.
    await composer.levelCheckbox(0).uncheck();
    await composer.page.waitForTimeout(700);

    await expect(composer.notice('mute'), 'step 105b: the cyan notice did not appear when a level was switched '
      + 'off. With no notice, nothing on screen says why the figure lost a wave.').toBeVisible();
    expect(await composer.rowValues(0), 'step 105b — THE FAILURE THAT WOULD MAKE THE CHECKBOX A SECOND `Clear`: '
      + 'Body\'s numbers changed when it was switched off. The numbers staying visible AND editable is the whole '
      + 'feature — the owner asked to keep the matrix content for later editing.').toEqual(numbersAtEntry[0]);
    expect(await composer.isEmptyRow(0), 'step 105b: the row COLLAPSED when it was switched off.').toBe(false);
    await expect(composer.field('Body', 'Winding', 'X'), 'step 105b: the row was DISABLED when switched off. A '
      + 'switched-off level must stay editable.').toBeEnabled();

    // step 105c — re-tick: the numbers round-trip byte-exact and the notice goes.
    await composer.levelCheckbox(0).check();
    await composer.page.waitForTimeout(700);
    await expect(composer.notice('mute'), 'step 105c: the notice survived re-ticking every level.').toBeHidden();
    expect(await composer.rowValues(0), 'step 105c: a number differs after an off → on round trip. §Q measures '
      + 'this as byte-exact over 3192 (preset × subset) recoveries, so a difference means the projection MUTATED '
      + 'the model — the one defect that makes the switch silently destructive.').toEqual(numbersAtEntry[0]);

    /*
     * step 105d — untick ALL THREE: a LEGAL state, not a crash. No console error, and the three rows keep all
     * 63 numbers. Then re-tick and the figure returns.
     */
    for (const n of [0, 1, 2]) await composer.levelCheckbox(n).uncheck();
    await composer.page.waitForTimeout(900);

    const allOff = (await composer.hook())!;
    expect(allOff.lastFrameError, 'step 105d: the frame loop THREW with every level off. That is a legal state — '
      + 'an empty figure — not a crash.').toBeNull();
    for (const n of [0, 1, 2]) {
      expect(await composer.rowValues(n), `step 105d: ${LEVEL_NAMES[n]} lost numbers with every level off. All `
        + '63 must stay.').toEqual(numbersAtEntry[n]);
    }

    for (const n of [0, 1, 2]) await composer.levelCheckbox(n).check();
    await composer.page.waitForTimeout(900);
    for (const n of [0, 1, 2]) {
      expect(await composer.rowValues(n), `step 105d: ${LEVEL_NAMES[n]}'s numbers did not survive the all-off → `
        + 'all-on round trip.').toEqual(numbersAtEntry[n]);
    }
  });

  /*
   * ⚠️ **105e AND 105f ARE THE SHARPEST EDGE IN THE BLOCK AND THEY POINT IN OPPOSITE DIRECTIONS.** The export
   * records **what you SAW**: a switched-off level is present-and-ZEROED, never missing (Fail 105e: a shrink
   * re-indexes the surviving waves so `WaveConfig.speed` follows the wrong slot — a field required by the type
   * and READ BY NOTHING, which is why it would never surface as a symptom). Then importing that file gives a row
   * that reads `empty` with its box unticked — **correct, because the numbers were never in the file.**
   */
  test('steps 105e, 105f — a switched-off level exports as a PRESENT, ZEROED slot, and importing it yields an '
    + 'empty row with an unticked box', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();

    const wavesAtEntry = (JSON.parse(await composer.exportPresetText()) as
      { generators?: { waves?: unknown[] } }).generators?.waves ?? [];
    expect(wavesAtEntry.length, 'CALIBRATION: the entry export has fewer than three waves, so a shrink could not '
      + 'be distinguished from the preset\'s own slot count.').toBeGreaterThanOrEqual(3);

    // step 105e — switch Structure off, Export → Structure's wave is PRESENT and every number is 0.
    await composer.levelCheckbox(1).uncheck();
    await composer.page.waitForTimeout(700);

    const exported = await composer.exportPresetText();
    const waves = (JSON.parse(exported) as { generators?: { waves?: Record<string, unknown>[] } })
      .generators?.waves ?? [];
    expect(waves.length, 'step 105e — Fail (105e): the slot is ABSENT from the export rather than '
      + 'present-and-zeroed. That is a shrink, and §Q\'s second seeded design: it re-indexes the surviving '
      + 'waves, so `WaveConfig.speed` follows the wrong slot — required by the type, read by nothing, and '
      + 'therefore never surfacing as a symptom. A silent slot is a real authored state (343 of the library\'s '
      + '1197 already are).').toBe(wavesAtEntry.length);

    // ⚠️ `axisNumbersOf` — NOT the whole slot; `speed` is preserved on purpose. See its doc comment.
    const numbers = axisNumbersOf(waves[1]);
    expect(numbers.length, 'step 105e: the exported Structure slot carries no `axes` numbers at all to check, so '
      + 'the clear clause below would pass over an empty array.').toBeGreaterThan(0);
    expect(numbers.every((n) => n === 0), 'step 105e: the switched-off slot exported NONZERO authored numbers. The '
      + 'owner asked for exactly this: *"export however or Snapshot would export them cleared"* — it must be '
      + `CLEARED, not missing. Got: ${JSON.stringify(waves[1]?.axes).slice(0, 200)}`).toBe(true);

    // step 105f — import that file back → the row reads `empty` and its box is UNTICKED.
    const name = await composer.importPresetJSON(exported, 'step105e-cleared.json');
    await composer.loadPreset(name);
    await composer.openComposer();

    expect(await composer.isEmptyRow(1), `step 105f: after importing the export, Structure does not read `
      + `"${EMPTY_ROW_COPY}". ⚠️ This is the CORRECT outcome and the sharpest edge in the block: the export `
      + 'recorded what you SAW, and what you saw had no Structure. The numbers were never in the file.')
      .toBe(true);
    expect(await composer.levelCheckbox(1).isChecked(), 'step 105f: the imported empty row\'s checkbox is '
      + 'TICKED. An empty level cannot be "on" in any sense the figure can honour, and a ticked box over the '
      + 'placeholder is the `levelIsOn()` defect returning.').toBe(false);
  });

  /*
   * ⚠️ **105h IS THE ONE DESTRUCTIVE SEQUENCE AND §J'S FINDING IN A SECOND MEDIUM: ONE BEHAVIOUR, THREE ENTRY
   * POINTS** (`adoptExternalFigure`, `Reset`, `New Figure`), all of which must reset the mutes *and* rebuild the
   * bodies. **A stale unticked box after the figure was replaced is the worst-behaved failure in the step:** the
   * row would show the new figure's real numbers while writing that level out EMPTY on the next edit. A failure
   * means a FOURTH replacement path nobody has enumerated.
   */
  test('steps 105g, 105h, 105i — a Snapshot stores the switched-off figure, replacing the figure re-ticks every '
    + 'box, and the level `Clear` zeroes 21 numbers at once', async ({ composer, page }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();

    // step 105g — switch Detail off, Snapshot → the stored figure has Detail CLEARED.
    await composer.levelCheckbox(2).uncheck();
    await composer.page.waitForTimeout(700);
    await composer.clickSnapshot();

    await composer.openTab('history');
    await expect(page.locator(SEL.historyTile).first(), 'step 105g: no history tile after `Snapshot`.')
      .toBeVisible();
    await composer.openComposer();

    const snapExport = JSON.parse(await composer.exportPresetText()) as
      { generators?: { waves?: Record<string, unknown>[] } };
    // ⚠️ `axisNumbersOf` — `speed` is NOT part of the subject; see its doc comment.
    const detailNums = axisNumbersOf(snapExport.generators?.waves?.[2]);
    expect(detailNums.length, 'step 105g: the exported Detail slot has no `axes` numbers to check, so the clear '
      + 'clause below would pass over an empty array.').toBeGreaterThan(0);
    expect(detailNums.every((n) => n === 0), 'step 105g — A SNAPSHOT THAT SHOWS DETAIL IS THE FAILURE: it would '
      + 'mean the history sees a different figure from the screen. `getSnapshot()` must write what you SAW.')
      .toBe(true);

    /*
     * step 105h — the destructive sequence, tested for BOTH replacement paths the plan names.
     * ⚠️ The numbers being unrecoverable is the accepted trade; **the DEFECT is a box left unticked.**
     */
    for (const replace of ['newFigure', 'presetLoad'] as const) {
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      await composer.levelCheckbox(0).uncheck();
      await composer.page.waitForTimeout(600);
      expect(await composer.levelCheckbox(0).isChecked(), `CALIBRATION (${replace}): Body did not switch off, so `
        + 'the re-tick below would pass over a box that never moved.').toBe(false);

      if (replace === 'newFigure') await composer.clickNewFigure();
      else { await composer.loadPreset('Quader'); await composer.openComposer(); }
      await composer.page.waitForTimeout(700);

      for (const n of [0, 1, 2]) {
        const isEmpty = await composer.isEmptyRow(n);
        const checked = await composer.levelCheckbox(n).isChecked();
        /*
         * ⚠️ **THE EXPECTATION IS `levelIsOn()`, NOT "ALWAYS TICKED": an EMPTY row's box is correctly UNTICKED**
         * (an empty level cannot be on in any sense the figure can honour), and `New Figure` leaves two rows
         * empty by design. Conflating the two WAS the defect, so the clause asks the two-fact question.
         */
        expect(checked, `step 105h (${replace}): ${LEVEL_NAMES[n]}'s checkbox is ${checked ? 'ticked' : 'unticked'}`
          + ` over a row that is ${isEmpty ? 'EMPTY' : 'LIT'}. A stale unticked box over a LIT row is the `
          + 'worst-behaved failure in this step — the row would show the new figure\'s real numbers while '
          + 'writing that level out EMPTY on the next edit. §J\'s finding in a second medium: one behaviour, '
          + 'three entry points (`adoptExternalFigure`, `Reset`, `New Figure`), and a failure means a FOURTH '
          + 'replacement path nobody has enumerated.').toBe(!isEmpty);
      }
      await expect(composer.notice('mute'), `step 105h (${replace}): the cyan notice survived the figure being `
        + 'replaced, so it now describes mutes that no longer exist.').toBeHidden();
    }

    /*
     * step 105i — the level `Clear`: 21 numbers to 0 in ONE click, no confirmation, the row collapses.
     * ⚠️ **IMMEDIATE AND UNRECOVERABLE BY THE OWNER'S EXPLICIT DECISION** — no confirmation, no history.
     */
    await composer.clickNewFigure();
    await composer.levelCheckbox(1).check();
    await composer.page.waitForTimeout(500);
    await composer.setField('Structure', 'Winding', 'X', '4');
    await composer.setField('Structure', 'Size', 'X', '22');
    expect(await composer.isEmptyRow(1), 'CALIBRATION: Structure is not lit before the level `Clear`.')
      .toBe(false);

    await composer.clearLevel('Structure');

    const cleared = await composer.rowValues(1);
    const nonzero = Object.entries(cleared).filter(([, v]) => Number(v) !== 0);
    expect(nonzero, 'step 105i: the level `Clear` left nonzero numbers behind. All 21 go to 0 in one click, with '
      + 'no confirmation and no history — the owner chose that explicitly.').toEqual([]);
    expect(await composer.isEmptyRow(1), 'step 105i: the row did not collapse to the placeholder after its level '
      + '`Clear`. ⚠️ The two controls must FEEL different: the checkbox KEEPS the numbers and `Clear` does not.')
      .toBe(true);
  });
});
