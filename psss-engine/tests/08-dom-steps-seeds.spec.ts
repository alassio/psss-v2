import {
  test, expect, SEL, EMPTY_ROW_COPY, ComposerPage,
} from './composer-fixture.ts';

/*
 * ============================================================================================
 * Phase 17.3 — **the seeded defects for `06-dom-steps.spec.ts`.** Discharges NO test-plan step.
 * ============================================================================================
 *
 * ⚠️ **SAME SITTING AS THE SPEC IT CALIBRATES, WHICH IS A RULE:** *"A SPEC WITHOUT A SEED DISCHARGES NOTHING,
 * WHATEVER COLOUR IT REPORTS — ship the seeds in the same sitting, never in a later phase."* Spec 06 is the
 * largest single instrument this phase will produce (35 tests over ~52 steps); shipping it uncalibrated would
 * mean the bulk of Phase 16's automated evidence spent an unknown interval being, formally, evidence about
 * nothing.
 *
 * ⚠️ **THE FILE NUMBER IS 08 AND NOT 07, ON PURPOSE.** Both plan documents commit `tests/07-diagram-panes.spec.ts`
 * to Phase 4, which is unbuilt. Taking 07 here would either force Phase 4 to renumber or leave a gap that reads
 * as a deleted spec — `CLAUDE.md`'s *"closing a deletion's gap silently moves what 'steps 1–7 passed' refers
 * to"*, in the filenames rather than the step list. **Numbering follows the PLAN's order, not the build order.**
 *
 * ⚠️ **WHAT A SEED HERE PROVES, AND THE HALF IT DOES NOT.** Each mutates the **live page** to manufacture the
 * defect its clause claims to catch, then asserts the clause's own predicate now reports it. That establishes
 * *"if the engine shipped this defect, spec 06 would go red"*. It establishes **nothing** about whether the engine
 * could ship it. Only the first is claimed.
 *
 * ⚠️ **NO `src/` FILE IS TOUCHED.** `CLAUDE.md`: *"Phases 3–7 edit no `src/` file and none may"*, and *"nothing
 * may be added under `src/` for the harness's benefit — `deadcheck` counts `src` files."* 17.2's spec could
 * calibrate against defects seeded in `main.ts` because the owner had approved an edit there; this phase has no
 * such approval, so every seed below is page-local and dies at teardown. **A stated weakness, not a sufficiency
 * claim** — a page-local seed can show a clause discriminates, but it cannot show the clause is pointed at the
 * mechanism a real regression would travel through.
 *
 * ⚠️ **EVERY SEED ASSERTS ITS PRE-MUTATION READING.** *"A SKIPPED mutation reads exactly like a caught one"* —
 * without the before-reading, a seed that silently failed to apply reports its clause as discriminating on the
 * strength of nothing having happened. Where a seed changes a COUNT, it ADDS a site and asserts the count moved:
 * *"A SEED FOR A *COUNT* CLAUSE MUST CHANGE THE COUNT."*
 *
 * ⚠️ **AND THE SITTING'S MOST VALUABLE FINDING CAME FROM WRITING SEED 1, NOT FROM RUNNING IT — IT WAS A DEFECT IN
 * SPEC 06 ITSELF, IN FIVE CLAUSES AT ONCE.** Steps 31, 33, 67, 69 and 73 compared two winding triples read as
 * `(['X','Y','Z']).map((a) => Number(v[label] ?? 'NaN'))`. On a label change every read is `[NaN,NaN,NaN]`, and
 * **`expect([NaN,NaN,NaN]).toEqual([NaN,NaN,NaN])` PASSES** — `toEqual` uses SameValueZero, under which `NaN`
 * equals itself (measured, Playwright 1.63). So all five idempotence clauses would have reported PASS while
 * comparing one absent read against another. **`CLAUDE.md`'s *"an absence test over an empty corpus reports
 * PASS"* reaching an EQUALITY clause** — the direction that rule is usually not stated in. The remedy is
 * `ComposerPage.axisTriple()`, which asserts the three labels are PRESENT, in ONE place; seed 1 is what shows the
 * remedy works. **Four inline copies of the vacuous form existed; the duplication is what hid it.**
 */

test.describe('Phase 17.3 — calibration: spec 06\'s clauses must be able to FAIL', () => {
  /*
   * ══ SEED 1 · the idempotence clauses cannot be vacuous (steps 31, 33, 67, 69, 73) ══════════════
   *
   * ⚠️ **THE MUTATION IS A RENAMED `aria-label`, WHICH IS THE MISTAKE THAT ACTUALLY HAPPENS.** A deleted input
   * fails loudly — `fill()` times out. A RENAMED one fails silently: `rowValues()` keys on the label, so the
   * winding entries simply vanish from the record and every triple becomes `[NaN,NaN,NaN]`. **That is strictly
   * the harder direction, and it is the one five clauses shared.**
   *
   * ⚠️ **AND THE SEED IS ASYMMETRIC ON PURPOSE: IT ASSERTS BOTH THAT `axisTriple` FAILS *AND* THAT THE OLD INLINE
   * FORM WOULD HAVE PASSED.** The second half is what makes this a calibration rather than a smoke test — without
   * it the seed shows only that a guard fires, never that the guard was NEEDED. `CLAUDE.md`: *"A MUTATION THAT
   * CANNOT FAIL ALONE MUST BE SEEDED WITH THE DEFECT IT WOULD CONCEAL."*
   */
  test('seed 1 — a renamed winding label makes `axisTriple` FAIL, where the inline `.map(Number)` form PASSED',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      const before = await composer.rowValues(0);
      expect(before['Body Winding X'], 'CALIBRATION: `Body Winding X` is absent BEFORE any mutation, so the seed '
        + 'cannot manufacture its own defect — the shipped `aria-label` format changed and `axisTriple`\'s key '
        + 'construction must be re-measured against `axisRow()`.').toBeDefined();
      const triple = await composer.axisTriple('Body', 'Winding', before);
      expect(triple.every(Number.isFinite), 'CALIBRATION: Quader\'s Body windings do not read as three finite '
        + 'numbers, so the comparison this seed is about is already meaningless.').toBe(true);

      // The mutation: rename all three Body `Winding` labels, exactly as a refactor would.
      const renamed = await page.locator(`${SEL.tabContent} ${SEL.slot(0)} ${SEL.numInput}`)
        .evaluateAll((els) => {
          let n = 0;
          for (const e of els) {
            const lab = e.getAttribute('aria-label') ?? '';
            if (/^Body Winding [XYZ]$/.test(lab)) {
              e.setAttribute('aria-label', lab.replace('Winding', 'Turns'));
              n += 1;
            }
          }
          return n;
        });
      expect(renamed, 'CALIBRATION: the seed renamed no input, so nothing below is being demonstrated. The three '
        + '`Body Winding [XYZ]` labels were not found on the row — re-measure the label format.').toBe(3);

      const after = await composer.rowValues(0);
      expect(after['Body Winding X'], 'CALIBRATION: the rename did not reach `rowValues()`, so the mutation did '
        + 'not land.').toBeUndefined();

      /*
       * Half A — **the old inline form PASSES over the mutated row.** This is the defect, executed. Two absent
       * reads compared equal, and note it compares the MUTATED row against the MUTATED row, which is exactly
       * what step 31 does: read, act, read again, compare. A compounding bug plus a renamed label = green.
       */
      const inline = (v: Record<string, string>) =>
        (['X', 'Y', 'Z'] as const).map((a) => Number(v[`Body Winding ${a}`] ?? 'NaN'));
      expect(inline(after), 'CALIBRATION: `toEqual` no longer treats NaN as equal to NaN, so the vacuity this '
        + 'seed exists to demonstrate is gone and `axisTriple`\'s presence assertion can be reconsidered. It was '
        + 'measured on Playwright 1.63: `toEqual` uses SameValueZero.').toEqual(inline(after));
      expect(inline(after).every(Number.isNaN), 'CALIBRATION: the inline read did not produce NaN over a renamed '
        + 'label, so half A is not demonstrating the vacuity.').toBe(true);

      /* Half B — **`axisTriple` FAILS over the same row.** */
      let guardFailed = false;
      let msg = '';
      try {
        await composer.axisTriple('Body', 'Winding', after);
      } catch (e) { guardFailed = true; msg = String(e); }
      expect(guardFailed, 'CALIBRATION FAIL: the three `Body Winding` labels were renamed and `axisTriple` still '
        + 'returned. Then steps 31, 33, 67, 69 and 73 are comparing `[NaN,NaN,NaN]` against `[NaN,NaN,NaN]`, '
        + 'which `toEqual` reports EQUAL — five idempotence clauses passing over two things that are not there.')
        .toBe(true);
      expect(msg, 'CALIBRATION: `axisTriple` failed, but not with the message that names the absent labels — so '
        + 'a real occurrence would accuse the engine rather than the label format.').toContain('Body Winding X');
    });

  /*
   * ══ SEED 2 · the empty-row placeholder clause (steps 46, 49, 105f, 105h) ═══════════════════════
   *
   * ⚠️ **`isEmptyRow()` IS A `text=` COUNT, SO IT IS AN ABSENCE TEST IN THE `false` DIRECTION AND A PRESENCE TEST
   * IN THE `true` DIRECTION — AND THE TWO FAIL DIFFERENTLY.** Step 46 asserts `true` on rows 2–3 and `false` on
   * row 1 in the SAME loop; step 49 asserts `false` after a stack. A copy change breaks the `true` clauses
   * (loudly) and the `false` clauses silently — a row that stopped rendering the placeholder AND a row whose
   * placeholder text merely changed both read `false`. So the seed mutates the COPY, not the row.
   */
  test('seed 2 — a changed placeholder string makes the empty-row clause report the wrong answer both ways',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Cylinder');
      await composer.openComposer();
      await composer.clickNewFigure();

      expect(await composer.isEmptyRow(1), 'CALIBRATION: Structure is not empty after `New Figure`, so this seed '
        + 'has no empty row to work with — `New Figure` seeds Body ONLY.').toBe(true);
      expect(await composer.isEmptyRow(0), 'CALIBRATION: Body reads as empty after `New Figure`, so the seed '
        + 'cannot show the `false` direction.').toBe(false);

      const changed = await composer.slot(1).evaluate((sec, copy) => {
        let n = 0;
        const walk = (el: Element) => {
          for (const child of [...el.childNodes]) {
            if (child.nodeType === 3 && (child.textContent ?? '').includes(copy as string)) {
              child.textContent = (child.textContent ?? '').replace(copy as string, 'nothing here yet');
              n += 1;
            } else if (child.nodeType === 1) walk(child as Element);
          }
        };
        walk(sec);
        return n;
      }, EMPTY_ROW_COPY);
      expect(changed, `CALIBRATION: the placeholder copy ${JSON.stringify(EMPTY_ROW_COPY)} was not found as a `
        + 'text node inside the Structure slot, so the seed rewrote nothing. `EMPTY_ROW_COPY` must be re-measured '
        + 'against `renderSlotBody`, and note the owner\'s decision that the copy is `empty — nothing authored '
        + 'here`: the old `+ give it size` wording is GONE and was also WRONG (silence is `size + pulse === 0`).')
        .toBeGreaterThan(0);

      expect(await composer.isEmptyRow(1), 'CALIBRATION FAIL: the placeholder text was rewritten and '
        + '`isEmptyRow()` still reported `true`. Then it is matching on something other than the shipped copy — '
        + 'most likely a substring so short it matches the row\'s other text — and step 46\'s claim that the row '
        + 'reads the placeholder is not being tested.').toBe(false);
    });

  /*
   * ══ SEED 3 · the level checkbox's polarity (step 46, 105h) ═════════════════════════════════════
   *
   * ⚠️ **THE MUTATION TICKS THE DOM CHECKBOX WITHOUT FIRING `change`, WHICH IS THE EXACT SHAPE OF §Q'S REAL
   * DEFECT** — a box painted into a state its owner never heard about. `CLAUDE.md`: the box *"arrived TICKED over
   * an empty row, so no `change` fired and the seed path was unreachable on the one row where it is the only
   * control"*, and §Q was GREEN over it because every clause looked inside the owner. **The engine-side fix was
   * `levelIsOn()` = not muted AND not empty; this seed is the browser-side proof that the CLAUSE can see it.**
   *
   * ⚠️ **AND IT IS NOT REDUNDANT WITH SEED 2 EVEN THOUGH BOTH USE AN EMPTY ROW.** Seed 2 asks whether the spec can
   * see the placeholder at all; seed 3 asks whether it can see a CONTROL whose displayed state disagrees with the
   * model. *"A BOOLEAN CONTROL'S DISPLAYED STATE IS A THIRD QUANTITY."*
   */
  test('seed 3 — a checkbox ticked without a `change` event is caught, which is §Q\'s real defect exactly',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Cylinder');
      await composer.openComposer();
      await composer.clickNewFigure();

      expect(await composer.isEmptyRow(2), 'CALIBRATION: Detail is not empty after `New Figure`.').toBe(true);
      expect(await composer.levelCheckbox(2).isChecked(), 'CALIBRATION: Detail\'s box is ALREADY ticked over an '
        + 'empty row before any mutation. That is not a seed failure — it is §Q\'s defect LIVE in the shipped '
        + 'engine, and step 46 is red. Report it; do not "fix" this seed.').toBe(false);

      await composer.levelCheckbox(2).evaluate((el) => { (el as HTMLInputElement).checked = true; });

      expect(await composer.levelCheckbox(2).isChecked(), 'CALIBRATION: the mutation did not land, so the clause '
        + 'below "caught" nothing.').toBe(true);
      /*
       * The clause under test is step 46's `expect(isChecked()).toBe(false)`. Asserting the mutated reading is
       * exactly what that clause would now see — a red. Expressed as the clause's own predicate rather than
       * re-running the test, because the test also loads a preset and re-seeds the figure.
       */
      expect(await composer.levelCheckbox(2).isChecked() === false,
        'CALIBRATION FAIL: the box was forced `checked` in the DOM and step 46\'s predicate still reads it as '
        + 'unticked. Then the clause is not reading the box a user sees, and §Q\'s defect — a control painted '
        + 'into the state you must move it to, firing no `change` — would pass unnoticed a second time.')
        .toBe(false);

      /* ⚠️ **Restored, because `isChecked()` is also how seed 4 identifies a live row**, and a leaked tick would
       * make seed 4 fail for seed 3's reason with a message accusing the engine. A seed must not leak into the
       * next seed in its own file; page teardown only protects the next SPEC. */
      await composer.levelCheckbox(2).evaluate((el) => { (el as HTMLInputElement).checked = false; });
      expect(await composer.levelCheckbox(2).isChecked(), 'CALIBRATION: seed 3 did not restore.').toBe(false);
    });

  /*
   * ══ SEED 4 · the 21-input count, and it must ADD a site (steps 105a, 74) ═══════════════════════
   *
   * ⚠️ **`CLAUDE.md`: *"A SEED FOR A *COUNT* CLAUSE MUST CHANGE THE COUNT — make it ADD a site."*** A seed that
   * REMOVED an input would be caught by any count, including a `>= 21`; only an ADDITION distinguishes `toBe(21)`
   * from `toBeGreaterThanOrEqual(21)`, and the shipped figure is exactly 21 (7 quantities × 3 axes since 16.15
   * deleted the tier).
   *
   * ⚠️ **AND THE ADDED INPUT CARRIES `sl-composer-num` DELIBERATELY, BECAUSE THAT IS THE CONFUSION THE FIGURE
   * ALREADY HAD ONCE:** *"A LIT ROW HAS 33 `sl-composer-num` INPUTS AND ONLY 21 ARE THE SUBJECT — 12 are
   * `sl-composer-breathe-num` percent/seconds VIEWS."* Counting 33 is green, stable and about a different
   * quantity. So the seed adds a bare `sl-composer-num` and requires the count to MOVE — which it can only do if
   * `SEL.numInput` excludes the breathe views by their own class rather than by position.
   */
  test('seed 4 — an ADDED numeric input moves the 21 count, so the clause is not a `>=` in disguise',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      const before = await composer.numInputs(0).count();
      expect(before, 'CALIBRATION: a lit Body row does not carry exactly 21 raw numeric inputs. 21 = 7 '
        + 'quantities × 3 axes, and the 12 breathe VIEWS must be excluded — if this reads 33, `SEL.numInput` is '
        + 'matching `sl-composer-breathe-num` too and every count clause is about a different quantity.').toBe(21);

      await composer.slot(0).evaluate((sec) => {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'sl-composer-num';
        inp.setAttribute('aria-label', 'Body Seeded Extra X');
        sec.appendChild(inp);
      });

      const after = await composer.numInputs(0).count();
      expect(after, 'CALIBRATION: the seed appended an `input.sl-composer-num` to the Body slot and the count did '
        + 'NOT move. Either the mutation did not land or `SEL.numInput` is narrower than the class — in which '
        + 'case a real 22nd input would also be invisible to it.').toBe(before + 1);
      expect(after === 21, 'CALIBRATION FAIL: a 22nd numeric input was added to the row and a `toBe(21)` clause '
        + 'would still pass. Then the count is not the count.').toBe(false);
    });

  /*
   * ══ SEED 5 · the retired-vocabulary DOM scan (steps 74, 82) ════════════════════════════════════
   *
   * ⚠️ **THIS IS THE ONE SEED FOR THE ONE CAPABILITY THE BROWSER ADDS THAT A CHECKER STRUCTURALLY LACKS.**
   * `CLAUDE.md`: *"A DOM SCAN CATCHES WHAT NO TEXT SCAN CAN (a word reaching the screen through a variable —
   * §N's standing gap)"*, and §N's retired-word scan was once GREEN over a live violation in a THIRD file. So the
   * mutation injects a retired word as a TEXT NODE — the form a `${…}` interpolation would produce — and requires
   * the scan to see it.
   *
   * ⚠️ **THE WORD CHOSEN IS `breathes`, NOT `Repair`.** `breathes` and `twist` *"named ONE quantity in two
   * places"*, which is why the owner's *"isn't that the same?"* was correct and no tooltip could have answered it
   * while both shipped — it is the retirement with the most reason behind it. `twist` would be a poor choice: it
   * SURVIVES as the model's internal simple-tier field name, so a source scan must exempt it and only a DOM scan
   * can be strict about it.
   */
  test('seed 5 — a retired word injected as a text node is caught, which no source scan could do',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      const read = async () => (await page.locator(SEL.tabContent).textContent()) ?? '';
      const before = await read();
      expect(before.length, 'CALIBRATION: the Composer tab published no text, so the absence clause below would '
        + 'pass over an empty corpus — this project\'s single most-recorded instrument defect.')
        .toBeGreaterThan(200);
      expect(before, 'CALIBRATION: the tab\'s own vocabulary is absent, so the scan is not reading the right '
        + 'element.').toContain('Winding');
      expect(before, 'CALIBRATION: `breathes` is ALREADY in the DOM before any mutation. That is not a seed '
        + 'failure — it is a live violation of the owner\'s retirement, and step 74/82\'s copy half is red. '
        + 'Report it; do not "fix" this seed.').not.toContain('breathes');

      await composer.slot(0).evaluate((sec) => {
        const span = document.createElement('span');
        // A TEXT NODE, which is the form a `${…}` interpolation produces — invisible to a string-literal scan.
        span.textContent = 'breathes';
        sec.appendChild(span);
      });

      const after = await read();
      expect(after, 'CALIBRATION FAIL: `breathes` was injected into the tab as a text node and the DOM scan still '
        + 'did not see it. Then steps 74/82\'s copy half is a fourth enumeration of the source, not a new '
        + 'instrument — and the retired-vocabulary rule keeps the one gap it was written to close.')
        .toContain('breathes');
    });

  /*
   * ══ SEED 6 · the dial's `inert` class, in BOTH directions (steps 78, 79, 104) ══════════════════
   *
   * ⚠️ **THE PAIR IS THE SUBJECT, WHICH IS WHY ONE SEED COVERS BOTH POLARITIES.** Step 78 asserts `inert` over a
   * zero WINDING (the refusal is ALGEBRA: `target/0` writes `Infinity` into `generators.waves`); step 79 asserts
   * NOT `inert` over a zero SIZE (a WORKING control reported as broken — *"cannot be applied"* vs *"cannot be
   * seen"*, and only the first may disable anything). **A seed that only removed the class would leave step 79's
   * direction — the one that must NOT fire — untested**, and that is the direction whose failure grants a
   * false alarm rather than a missed one.
   */
  test('seed 6 — adding and removing the dial\'s `inert` class is caught in both directions',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Deep Thought2');
      await composer.openComposer();

      const zDial = composer.dialFor('Body', 'Z');
      const yDial = composer.dialFor('Body', 'Y');
      await expect(zDial, 'CALIBRATION: no Body Z dial on Deep Thought2 — all three axes always carry one since '
        + '16.15 deleted the two-dial simple row.').toHaveCount(1);

      /* Direction A — step 78's clause: the class is PRESENT over winding 0, and removing it is caught. */
      const v = await composer.rowValues(0);
      expect(Number(v['Body Winding Z']), 'CALIBRATION: Deep Thought2 Body Z is not at winding 0, so direction A '
        + 'is not in its stated state.').toBe(0);
      await expect(zDial, 'CALIBRATION: the Z dial is not `inert` over a winding of 0 BEFORE any mutation. That '
        + 'is not a seed failure — step 78 is red, and `target / 0` writes `Infinity` into `generators.waves` '
        + 'from one drag. Report it.').toHaveClass(/inert/);

      await zDial.evaluate((el) => { el.classList.remove('inert'); });
      expect(await zDial.evaluate((el) => el.classList.contains('inert')),
        'CALIBRATION FAIL: `inert` was removed from a zero-winding dial and the class read still reports it. Then '
        + 'step 78 cannot see a dial that went live over an undividable winding.').toBe(false);
      await zDial.evaluate((el) => { el.classList.add('inert'); });

      /*
       * Direction B — step 79's clause: the class is ABSENT on a live-winding dial, and ADDING it is caught.
       * ⚠️ **Body Y, not Structure Z on another preset: the point is a dial on THIS row whose winding is nonzero,
       * so the two directions are demonstrated against one another on one screen.** Step 79 itself uses Quader's
       * zero-SIZE axis, which is the stronger subject but needs a second ~25 s preset load.
       */
      expect(Number(v['Body Winding Y']), 'CALIBRATION: Deep Thought2 Body Y is not at a nonzero winding, so '
        + 'direction B has no live dial to work with.').not.toBe(0);
      await expect(yDial, 'CALIBRATION: the Y dial is ALREADY `inert` over a nonzero winding, so the seed cannot '
        + 'manufacture direction B\'s defect — and a working control is being reported as broken.')
        .not.toHaveClass(/inert/);

      await yDial.evaluate((el) => { el.classList.add('inert'); });
      expect(await yDial.evaluate((el) => el.classList.contains('inert')),
        'CALIBRATION FAIL: `inert` was ADDED to a live dial and step 79\'s `not.toHaveClass(/inert/)` would still '
        + 'pass. That is the direction that matters most: a greyed dial over a real stored shift is a WORKING '
        + 'control reported as broken, and it is the half a removal-only seed leaves untested.').toBe(true);
      await yDial.evaluate((el) => { el.classList.remove('inert'); });
    });

  /*
   * ══ SEED 7 · the readout's period phrasings and the flat-pane caption (steps 58, 59, 79) ═══════
   *
   * ⚠️ **BOTH STRINGS WERE NARROWED BY MEASUREMENT AND A SEED MUST RESPECT WHICH ONE IT IS TESTING.** The period
   * has TWO phrasings — `repeats every N s` only where the live rates are commensurate, else `slowest cycle N s`
   * — and where no period exists the readout must print **NOTHING**, never `Infinity`/`0`/`—`. So the seed's
   * mutation is a SUBSTITUTION of one phrasing for the other plus a placeholder, and the clause must reject both.
   *
   * ⚠️ **THE `toContain` SHAPE IS THE VULNERABILITY BEING TESTED.** `expect(text).toContain('no size')` passes on
   * a readout that says `no size` for the wrong axis, or that appends a placeholder after it. A seed that
   * DELETED the phrase would be caught by any `toContain`; only a substitution shows whether the clause pins the
   * phrasing the owner actually chose.
   *
   * ⚠️ **THE TWO MUTATIONS ARE APPLIED AND JUDGED SEPARATELY, AND MY FIRST VERSION COMBINED THEM — WHICH WOULD
   * HAVE BEEN A DEFECT OF EXACTLY THE KIND THIS FILE EXISTS TO CATCH.** It rewrote the wording AND appended the
   * placeholder in one `evaluate`, then asserted `includes('no size') && !includes('Infinity')` was false. That
   * conjunction is false as soon as EITHER half lands — and since replacing `no size` with `no Z size` removes the
   * substring `no size`, the first half alone satisfied it. **The placeholder clause would never have been
   * exercised, and the seed would have been green on the strength of the other mutation.** `CLAUDE.md`: *"a clause
   * algebraically implied by its siblings"*, reached through a shared mutation instead of a shared expression.
   * **One mutation, one verdict, one restore.**
   */
  test('seed 7 — a swapped period phrasing and an `Infinity` placeholder are each caught SEPARATELY',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      const original = (await composer.readoutTexts())[1] ?? '';
      expect(original, 'CALIBRATION: Quader\'s Structure readout does not mention `no size`, so step 79\'s '
        + 'subject is absent and this seed has nothing to substitute. Structure Z ships winding 96 with size 0 — '
        + 'the converse of step 78 — and the readout is what owns the "cannot be seen" case in place of a '
        + 'disabled control.').toContain('no size');
      expect(original, 'CALIBRATION: the readout ALREADY prints `Infinity`. That is not a seed failure — it is a '
        + 'live violation of the narrowing (where no period exists the readout must print NOTHING). Report it.')
        .not.toContain('Infinity');

      const setReadout = (text: string) =>
        composer.readout(1).evaluate((el, t) => { el.textContent = t as string; }, text);

      /*
       * ── Mutation A · the retired wording, ALONE ────────────────────────────────────────────────
       * ⚠️ **`no Z size` IS THE MEASURED-WRONG WORDING, NOT A COSMETIC VARIANT:** a zero WINDING flattens a pane
       * whose sizes are real, so naming the axis's SIZE describes the wrong cause. The shipped row readout says
       * `no size — winding inert there`; the pane caption is `flat here — no reach in this plane`.
       */
      await setReadout(original.replace('no size', 'no Z size'));
      const afterA = (await composer.readoutTexts())[1] ?? '';
      expect(afterA, 'CALIBRATION: mutation A did not land.').toContain('no Z size');
      expect(afterA.includes('no size'), 'CALIBRATION FAIL: the readout was rewritten to the retired `no Z size` '
        + 'wording and step 79\'s `toContain("no size")` clause would still pass. Then it is not pinning the '
        + 'phrasing the owner chose — and the phrasing IS the subject, because `no Z size` names the wrong cause.')
        .toBe(false);

      /*
       * ── Mutation B · the placeholder, ALONE, over the UNMODIFIED wording ───────────────────────
       * ⚠️ **Restored to `original` first, so this half is judged against the shipped wording rather than against
       * mutation A's leftovers** — the whole reason the two are separate.
       */
      await setReadout(`${original} · repeats every Infinity s`);
      const afterB = (await composer.readoutTexts())[1] ?? '';
      expect(afterB, 'CALIBRATION: mutation B did not land.').toContain('Infinity');
      expect(afterB, 'CALIBRATION: mutation B destroyed the shipped wording, so it is not testing the placeholder '
        + 'in isolation.').toContain('no size');
      expect(afterB.includes('Infinity'), 'CALIBRATION FAIL: an `repeats every Infinity s` placeholder was '
        + 'appended and a clause scanning the readout did not object. Where no period exists the readout must '
        + 'print NOTHING — never `Infinity`, `0` or `—` — and the two phrasings (`repeats every N s` only where '
        + 'the live rates are commensurate, else `slowest cycle N s`) were both narrowed by MEASUREMENT.')
        .toBe(true);

      await setReadout(original);
      expect((await composer.readoutTexts())[1], 'CALIBRATION: seed 7 did not restore the readout.')
        .toBe(original);
    });

  /*
   * ══ SEED 8 · the ratio combobox must be OPENED, not merely present (steps 32, 71, 98, 101) ═════
   *
   * ⚠️ **THE LIST IS IN THE DOM WHILE CLOSED, SO EVERY `count()`-BASED READINESS CHECK PASSES WHILE THE CLICK
   * CANNOT LAND.** `CLAUDE.md` states this as a Phase 17 rule about the grid and the two notices — *"A `count()`
   * check passes while the click cannot land — assert VISIBILITY"* — and the ratio list is one more instance.
   * `pickRatio()` already waits for `toBeVisible()`; this seed is what shows that wait is load-bearing rather
   * than ceremonial.
   *
   * ⚠️ **AND IT SEEDS THE *CAPTION* CLAUSE TOO, WHICH IS THE HALF WITH A RECORDED DEFECT BEHIND IT.** The ratio
   * captions are LOAD-BEARING, not decoration (invariant 29 as a UI property), and `RATIO_ROWS` is a COUNTED
   * UNION that must never be hardcoded. A seed that emptied one caption shows whether step 71's "every row is
   * captioned" clause reads the captions or merely counts the rows.
   */
  test('seed 8 — a hidden ratio list and an emptied caption are both caught', async ({ composer, page }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Quader');
    await composer.openComposer();

    const btn = page.locator(`${SEL.tabContent} ${SEL.ratioButton('Body')}`);
    await expect(btn, 'CALIBRATION: no ratio combobox on Body. It is a `role="combobox"` BUTTON plus a '
      + '`role="listbox"` DIV — not a `<select>` — so `selectOption` would throw.').toHaveCount(1);
    await btn.click();
    /*
     * ⚠️ **`ratioListFor('Body')`, AND THE `.last()` THAT USED TO BE HERE IS ITSELF A FINDING THIS SEED PRODUCED.**
     * Three lists are in the DOM at once — one per level — so `.last()` resolved to *Detail's* list while Body's was
     * the one open, and the wait timed out reporting *"the ratio list did not open"*: a **selector** defect
     * accusing the **engine**, which is a harness failure's default direction. It was in `pickRatio()` too, where
     * it had been green only because the levels it was used on had not exercised the difference. `CLAUDE.md`'s
     * *"select on the label, never on position"* is the rule, and this is what it looks like when broken.
     */
    const list = page.locator(`${SEL.tabContent} ${SEL.ratioListFor('Body')}`);
    await expect(list, 'CALIBRATION: the ratio list did not open, so neither half below has a subject.')
      .toBeVisible();

    /*
     * Half A — the list forced hidden while still PRESENT.
     * ⚠️ **`isConnected` IS THE DIRECT QUESTION AND A RECONSTRUCTED CLASS SELECTOR IS NOT.** An earlier form here
     * re-queried `document` with the element's own `className` split into a compound selector — which asks
     * *"does something matching my classes exist"*, not *"am I still in the tree"*, and would have answered YES
     * from a sibling. The distinction is the entire subject of this half: present-but-invisible.
     */
    const presentWhileHidden = await list.evaluate((el) => {
      (el as HTMLElement).style.display = 'none';
      return el.isConnected;
    });
    expect(presentWhileHidden, 'CALIBRATION: the list left the DOM when hidden, so this seed is demonstrating a '
      + 'deletion rather than the present-but-invisible state that a `count()` clause cannot see.').toBe(true);
    expect(await list.isVisible(), 'CALIBRATION FAIL: the ratio list was hidden by `display` and `isVisible()` '
      + 'still reports it visible.').toBe(false);
    expect(await list.count() > 0 && !(await list.isVisible()),
      'CALIBRATION FAIL: the list is not simultaneously PRESENT and INVISIBLE, so it cannot demonstrate that a '
      + '`count()`-based readiness check would pass while the click cannot land — this harness\'s '
      + 'most-recorded defect shape.').toBe(true);
    await list.evaluate((el) => { (el as HTMLElement).style.display = ''; });
    await expect(list, 'CALIBRATION: the list did not come back, so half B has no subject.').toBeVisible();

    /* Half B — one caption emptied, testing whether "every row is captioned" reads the captions. */
    const caps = list.locator(SEL.ratioOptionCaption);
    const nCaps = await caps.count();
    expect(nCaps, 'CALIBRATION: the ratio list published no captions. `RATIO_ROWS` is a COUNTED UNION of '
      + '`RATIO_TILES` and `RATIO_NAMED` and must never be hardcoded — re-run §K rather than reading a delta as '
      + 'an event.').toBeGreaterThan(3);
    const textsBefore = await caps.allTextContents();
    expect(textsBefore.every((t) => t.trim().length > 0), 'CALIBRATION: a ratio caption is ALREADY empty before '
      + 'any mutation. That is not a seed failure — step 71 is red. Report it.').toBe(true);

    await caps.first().evaluate((el) => { el.textContent = ''; });
    const textsAfter = await caps.allTextContents();
    expect(textsAfter.every((t) => t.trim().length > 0), 'CALIBRATION FAIL: a ratio caption was emptied and a '
      + '"every row is captioned" clause still passed. Then it is counting ROWS, not reading CAPTIONS — and the '
      + 'captions are load-bearing rather than decoration: distinctness in any single plane is far below '
      + 'distinctness across all three, which is why three panes are the fix and not the caption.').toBe(false);
    expect(textsAfter.length, 'CALIBRATION: the caption count changed, so the seed removed a row rather than '
      + 'emptying its text — a deletion any count would catch, which is not what this half is about.')
      .toBe(textsBefore.length);
  });

  /*
   * ══ SEED 9 · `setField` must COMMIT, not merely fill (steps 58, 88, 95, 103) ═══════════════════
   *
   * ⚠️ **MEASURED, AND IT FALSIFIED THIS SEED'S FIRST TWO DRAFTS: `fill()` DOES COMMIT, BECAUSE PLAYWRIGHT
   * DISPATCHES `change` AS WELL AS `input`** — and the tab's listener is `change` (`composer.ts:2150`, whose own
   * comment says why: an `input` listener would commit 1, then 12, then 120 for one typed "120"). So *"fill
   * without the `Tab`"* is NOT the omission it looks like, and a seed built on it fails while the engine is
   * correct — the harness accusing the subject, which `CLAUDE.md` names as a harness failure's default direction.
   *
   * ⚠️ **THE OMISSION THAT IS REAL IS TYPING WITHOUT COMMITTING — `pressSequentially`, which fires `input` per
   * keystroke and NO `change`.** That is the state a user is in mid-edit, and it is the one this seed can hold the
   * engine to: the export must not move. **And it is the STRONGER seed, because it is exactly what moving the
   * listener to `input` would break** — the `fill()` version could not have failed on that change at all, since
   * `fill()` fires both events either way. Half B then commits the same value and the export must move; without it
   * the seed would pass on an engine that ignores the field entirely.
   *
   * ⚠️ **NEITHER HALF READS THE ROW, WHICH IS THE WHOLE REASON THIS SEED IS NOT VACUOUS, AND MY FIRST VERSION OF IT
   * WAS.** `rowValues()` reads each input's `.value`, i.e. **the DOM**, and typing sets exactly that. So a row-based
   * half B passes whether or not anything committed, and a row-based half A would be asserting that the typing
   * failed to type. **The DOM cannot distinguish "typed" from "stored"; only a channel downstream of the model
   * can.** This is `CLAUDE.md`'s output-channel discriminator applied to the harness itself: *"ask what a feature
   * READS, not what the call writes."*
   *
   * ⚠️ **AND THE CHOICE OF *WHICH* DOWNSTREAM CHANNEL IS ITSELF MEASURED, BECAUSE THE OBVIOUS ONE OBSERVES BY
   * INTERFERING: `exportPresetText()` clicks a button, which BLURS the field and fires the `change` half A exists
   * to withhold.** The observation committed the edit and then reported the commit as an engine defect. **Half A
   * therefore reads the row's READOUT — `sync()` writes it from the model and it costs no focus** — and half B
   * keeps the export, where a click is harmless because the value is committed on purpose. **Two channels, chosen
   * per half by what each half can afford to disturb.**
   */
  test('seed 9 — typing without committing leaves the STORED figure untouched, and committing it moves the model',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      const f = composer.field('Body', 'Size', 'X');
      await expect(f, 'CALIBRATION: no `Body Size X` field — the seven user-facing words are `Winding`, `Size`, '
        + '`Shift °`, `Pulse`, `Pulse rate`, `Wobble`, `Wobble rate`.').toHaveCount(1);

      const hookBefore = (await composer.hook())!;
      expect(hookBefore.lastFrameError, 'CALIBRATION: the frame loop was already throwing before the seed.')
        .toBeNull();
      const before = await composer.axisTriple('Body', 'Size');
      expect(before[0], 'CALIBRATION: Quader\'s Body X size is 0, so the change below cannot be told from a '
        + 'clear.').not.toBe(0);

      /*
       * ⚠️ **THE READ CHANNEL HAD TO BE CHANGED FOR AN OBSERVER-EFFECT REASON, AND IT IS THE SHARPEST THING THIS
       * SEED MEASURED: `exportPresetText()` CLICKS THE `Export` BUTTON, WHICH TAKES FOCUS OFF THE FIELD — firing
       * the `change` this half exists to withhold.** So the observation COMMITTED the edit and then reported the
       * commit as an engine defect (*"an uncommitted keystroke reached `workingPreset`"*). Two drafts died on it
       * and both accused the engine.
       *
       * ⚠️ **THE REMEDY IS A CHANNEL THAT TAKES NO FOCUS: the row's own READOUT, which `sync()` writes from the
       * MODEL.** It is downstream of `commit()` and needs no click, so it can be read with the caret still in the
       * field. **And it makes the seed strictly stronger** — passing now asserts both that no commit happened AND
       * that the readout is model-derived rather than input-derived, which is invariant 25's shape in a readout
       * ("confidently wrong rather than obviously stale"). The subject is `Size`, so the discriminating readout
       * fact is the SILENT-AXIS phrase: Quader's Body Z is silent, and zeroing X would change which axes it names.
       *
       * The export remains half B's channel, where a click is harmless because the value is committed on purpose.
       */
      /*
       * ⚠️ **HALF B'S BASELINE IS TAKEN HERE, BEFORE ANY TYPING, AND MOVING IT AFTER HALF A BREAKS IT IN THE SAME
       * WAY HALF A WAS ALREADY BROKEN — one step later and with the opposite verdict.** Half A leaves an
       * uncommitted value in the field; the very export click that would capture a baseline blurs the field and
       * COMMITS it, so the baseline arrives already holding the edit and half B then reports *"the commit path is
       * dead"* over a working one. **The observer effect is a property of the CHANNEL, so it has to be reasoned
       * about at every use, not patched at the one that failed.**
       */
      const exportBefore = await composer.exportPresetText();

      const readoutBefore = (await composer.readoutTexts())[0];
      expect(readoutBefore, 'CALIBRATION: the Body readout is empty, so it cannot serve as half A\'s observation '
        + 'channel. A silent SLOT prints nothing at all — but Quader\'s Body is lit, so an empty string here means '
        + 'the readout has no producer and every clause below would compare two empty strings, which are EQUAL.')
        .not.toBe('');

      /*
       * Half A — TYPE the value keystroke by keystroke and do not commit it. The DOM value moves; nothing
       * downstream of the model may. `pressSequentially` fires one `input` per character and NO `change`;
       * `fill()` fires both and commits, which is what falsified this seed's first draft.
       *
       * ⚠️ Reading the ROW here would assert that the typing failed to type — the exact tautology this seed's own
       * doc comment exists to warn about.
       */
      const target = '0';
      await f.focus();
      await f.press('Control+a');
      await f.pressSequentially(target, { delay: 30 });
      await composer.page.waitForTimeout(400);
      expect(await f.inputValue(), 'CALIBRATION: the typing did not change the input\'s displayed value, so half A '
        + 'is not demonstrating the missing commit. (`Control+a` then type — a bare `pressSequentially` would '
        + 'APPEND to the authored value.)').toBe(target);

      expect((await composer.readoutTexts())[0], 'CALIBRATION: an UNCOMMITTED keystroke reached the model — so the '
        + 'tab commits on `input` after all, and `setField`\'s whole commit story (and with it `repairFigure`\'s '
        + 'round-on-blur behaviour, which step 95 depends on) must be re-measured. ⚠️ `composer.ts:2150` states '
        + 'the cost of an `input`-time commit: typing "120" would write 1, then 12, then 120 — three engine writes '
        + 'and three history-worthy states for one edit. ⚠️ The OTHER reading of this failure is that the readout '
        + 'is derived from the INPUT rather than from the model, which is the same defect one layer out.')
        .toBe(readoutBefore);

      /* Half B — the same value, committed. The MODEL must move, in the export and in the readout alike.
       * ⚠️ `exportBefore` was captured at the TOP, before half A typed — see the comment there. */
      await composer.setField('Body', 'Size', 'X', target);
      const committedRow = await composer.axisTriple('Body', 'Size');
      expect(committedRow[0], 'CALIBRATION: the committed value is not even in the input, so half B has no '
        + 'subject.').toBe(Number(target));

      const exportCommitted = await composer.exportPresetText();
      expect(ComposerPage.normalisePresetJSON(exportCommitted), 'CALIBRATION FAIL: the value was typed AND committed with '
        + '`Tab` — which fires both `change` and `blur` — and the EXPORT is byte-identical to before the edit. '
        + 'Either the commit path is dead or `setField` is not reaching the model; both make every editing step '
        + 'in spec 06 assert against a figure that never changed, and "nothing changed" cannot be told from a '
        + 'dead handler. ⚠️ Note the commit path is NOT `state.setWorkingPreset` — the tab mutates '
        + '`workingPreset` in place and calls `controls.setWaves()`, because the former would re-init the '
        + 'generator and snap the figure to its opening pose on every click.')
        .not.toBe(ComposerPage.normalisePresetJSON(exportBefore));

      /*
       * ⚠️ **THIS CLAUSE IS WHAT MAKES HALF A NON-VACUOUS AND IT IS NOT OPTIONAL: half A asserts the readout DID
       * NOT MOVE, which passes trivially on a readout that cannot move for this quantity at all.** So the same
       * edit, committed, must move it. The mechanism is named rather than assumed: Quader's Body carries size on
       * all three axes and no pulse, so `Size X → 0` makes X silent (`size + pulse === 0`) and the silent-axis
       * phrase must now name X. **A seed whose "unchanged" half has no matching "changed" half is measuring the
       * channel's silence, not the engine's.**
       */
      const readoutAfter = (await composer.readoutTexts())[0];
      expect(readoutAfter, 'CALIBRATION FAIL: the committed `Size X → 0` did not move the Body readout, so half A\'s '
        + '"the readout did not move" was measuring a channel that cannot move for this quantity — vacuous, '
        + 'whatever colour it reported. Quader\'s Body has size on all three axes and no pulse, so zeroing X makes '
        + 'X silent and the `no size — winding inert there` phrase must now name it.').not.toBe(readoutBefore);
      expect(readoutAfter, 'CALIBRATION FAIL: the readout moved but does not name X as the silent axis. Silence is '
        + '`size + pulse === 0` — never size alone — and the phrase is the owner of "this axis cannot show its '
        + 'winding".').toContain('no size');

    const hookAfter = (await composer.hook())!;
    expect(hookAfter.lastFrameError, 'the committed edit made the frame loop throw. ⚠️ `requestAnimationFrame` '
      + 'belongs in a `finally` — as a frame\'s last statement, one throw ended the loop for the session.')
      .toBeNull();
  });

  /*
   * ══ SEED 10 · step 101's two halves are each a SIZE claim, and neither may be a position one (step 101) ═══
   *
   * ⚠️ **THIS SEED EXISTS BECAUSE THE CLAUSE IT CALIBRATES WAS WRONG TWICE, BOTH TIMES BY MEASURING A POSITION,
   * AND BOTH TIMES THE RED ACCUSED THE ENGINE.** Step 101 reads *"at least seven rows are visible without
   * scrolling, and the list still fits inside the panel — bigger icons must not be paid for with a taller list."*
   * The subject is the list's `max-height` against the row height — a SIZE. The two rejected forms:
   *
   *   1. `box.y + box.height <= tabContent.y + tabContent.height` — the list is `position: absolute` inside an
   *      `overflow-y: auto` container, so overhanging the container's CURRENT scroll viewport is what an absolute
   *      popup is FOR. It measured 9 px of "overflow" that was the scroll offset.
   *   2. `box.y + box.height <= viewport.height` — measured 1083 in a 900 px window, because Body's combo button
   *      sits at y ≈ 763 in an 822 px panel. **A popup opening downward near the bottom of a scrollable panel is
   *      not a layout defect**, and this form would have gone red on every correct layout but a top-scrolled one.
   *
   * ⚠️ **AND THE BACKSTOP I REACHED FOR FIRST WAS ALSO UNSOUND, WHICH IS THE FINDING WORTH KEEPING: `isVisible()`
   * REPORTED `true` FOR ALL TWENTY ROWS**, including the twelve clipped out of the list's own 318 px scroll
   * viewport. Playwright's visibility is a non-empty box plus CSS visibility and does **not** model ancestor
   * clipping — so a `toBeVisible()` loop over seven rows is the *"a `count()` check passes while the click cannot
   * land"* defect wearing the recommended fix's clothes. **Half A below asserts exactly that**, so the unsound
   * oracle cannot be reintroduced as a simplification without this seed going green over a shrunken list.
   */
  test('seed 10 — a shrunken ratio list fails the row-fit clause, and `isVisible()` cannot see the clipping',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Quader');
      await composer.openComposer();

      const btn = page.locator(`${SEL.tabContent} ${SEL.ratioButton('Body')}`);
      await btn.click();
      const list = page.locator(`${SEL.tabContent} ${SEL.ratioListFor('Body')}`);
      await expect(list, 'CALIBRATION: the ratio list did not open, so neither half has a subject.').toBeVisible();
      const options = list.locator(SEL.ratioOption);

      /* The clause's own predicate, as a function, so both readings below come from the same arithmetic. */
      const rowsThatFit = async () => {
        const clientH = await list.evaluate((el) => el.clientHeight);
        const optBox = await options.first().boundingBox();
        return Math.floor(clientH / Math.max(optBox?.height ?? 1, 1));
      };

      const fitBefore = await rowsThatFit();
      expect(fitBefore, 'CALIBRATION: fewer than seven rows fit BEFORE any mutation. That is not a seed failure — '
        + 'step 101 is red as shipped. Report it.').toBeGreaterThanOrEqual(7);

      /*
       * Half A — the oracle I rejected, demonstrated failing on the SAME state that half B catches.
       * ⚠️ **This half's expected verdict is that `isVisible()` is USELESS here, not that it is correct** —
       * `CLAUDE.md`: *"A MUTATION THAT CANNOT FAIL ALONE MUST BE SEEDED WITH THE DEFECT IT WOULD CONCEAL, AND ITS
       * EXPECTED VERDICT IS GREEN."* Green here means the weak oracle demonstrably cannot see the clipping.
       */
      const total = await options.count();
      expect(total, 'CALIBRATION: the list published no rows, so "all rows report visible" is vacuous — an absence '
        + 'test over an empty corpus reports PASS.').toBeGreaterThan(fitBefore);
      const clippedIdx = total - 1;
      expect(await options.nth(clippedIdx).isVisible(), 'CALIBRATION FAIL: Playwright now DOES model ancestor '
        + 'clipping, so the last row of a 20-row list inside a 318 px scroll viewport reports invisible. Then a '
        + '`toBeVisible()` loop WOULD be a sound oracle for step 101 and the rejection recorded in spec 06 is '
        + 'stale — re-measure before trusting either.').toBe(true);

      /*
       * Half B — the shipped clause's subject: shrink the list's own scroll viewport, which is exactly what a
       * resize to bigger icons that forgets §O's `max-height` does. The mutation must move the COUNT, not merely
       * the geometry: *"A SEED FOR A *COUNT* CLAUSE MUST CHANGE THE COUNT."*
       */
      await list.evaluate((el) => { (el as HTMLElement).style.maxHeight = '120px'; });
      const fitAfter = await rowsThatFit();
      expect(fitAfter, 'CALIBRATION: the `max-height` override did not change how many rows fit, so the mutation '
        + 'did not apply and this half would report the clause as discriminating on the strength of nothing having '
        + 'happened.').toBeLessThan(fitBefore);
      expect(fitAfter, 'CALIBRATION FAIL: the list was shrunk to 120 px and seven rows still "fit" — so step 101\'s '
        + 'row arithmetic is not reading the list\'s own scroll viewport (`clientHeight`) and cannot see a '
        + '`max-height` regression at all. §O pins that height for 22 px icons; a resize to 34 px that forgets it '
        + 'trades reachability for legibility, and nothing else in the suite measures the trade.')
        .toBeLessThan(7);

      /*
       * Half C — the OTHER half of the shipped clause, in the direction it is actually written: the list must be
       * no TALLER than the panel it opens inside. Grown past the panel, that comparison must fail.
       * ⚠️ **Grown rather than moved, because "moved" is what both rejected forms measured.**
       */
      const panelH = (await page.locator(SEL.tabContent).boundingBox())!.height;
      await list.evaluate((el, h) => {
        (el as HTMLElement).style.maxHeight = `${Math.round(h) + 200}px`;
        (el as HTMLElement).style.height = `${Math.round(h) + 200}px`;
      }, panelH);
      const grownH = (await list.boundingBox())!.height;
      expect(grownH, 'CALIBRATION: the height override did not take, so half C has no subject.')
        .toBeGreaterThan(panelH);
      expect(grownH <= panelH, 'CALIBRATION FAIL: the list was grown 200 px TALLER than the panel and the '
        + '"fits inside the panel" comparison still held. Then it is not comparing the two HEIGHTS — and a list no '
        + 'scroll position can fully show is precisely what "bigger icons must not be paid for with a taller '
        + 'list" forbids.').toBe(false);

      await list.evaluate((el) => {
        (el as HTMLElement).style.maxHeight = '';
        (el as HTMLElement).style.height = '';
      });
      expect(await rowsThatFit(), 'CALIBRATION: seed 10 did not restore the list height.')
        .toBeGreaterThanOrEqual(7);
    });

  /*
   * ══ SEED 11 · `canvasSignature()`'s `-1` SENTINEL must be caught, because three clauses PASS on it ═══
   *
   * ⚠️ **THIS SEED CALIBRATES PHASE 17.7's ONE ENGINE-FACING FINDING, AND THE FINDING IS IN THE HARNESS'S READING
   * CHANNEL RATHER THAN IN A CLAUSE.** `canvasSignature()` returns `{mean:-1, lit:-1}` when `#canvas` or its
   * WebGL2 context is missing. **Three shipped clauses compare two `mean` readings for near-EQUALITY** — 106c
   * (`<= 4`), 106k (`<= 6`) and 106l (`<= 8`) — and `Math.abs(-1 − -1) === 0` satisfies every one of them. So a
   * lost context would report the three tightest tolerances in the suite as GREEN.
   *
   * ⚠️ **IT IS THE INERTNESS INVERSION ONE LEVEL BELOW WHERE PHASE 5 FOUND IT.** Phase 5 added
   * `assertIntegratorAdvanced()` to those same three steps because an unchanged picture passes on a stopped
   * engine. This is the identical shape in the READING channel: **an assertion that two absent readings are
   * equal** — `CLAUDE.md`'s *"an absence test over an empty corpus reports PASS"* reaching an equality clause, the
   * same way it reached `axisTriple` (seed 1). **Two independent instances of one rule in one fixture is the
   * argument for the guard living in the helper.**
   *
   * ⚠️ **HALF A'S EXPECTED VERDICT IS THAT THE UNGUARDED FORM PASSES: *"A MUTATION THAT CANNOT FAIL ALONE MUST BE
   * SEEDED WITH THE DEFECT IT WOULD CONCEAL, AND ITS EXPECTED VERDICT IS GREEN."*** Without it the seed shows only
   * that a guard fires, never that the guard was NEEDED — and "needed" is the entire claim here.
   *
   * ⚠️ **THE MUTATION RENAMES `#canvas`'s `id` RATHER THAN REMOVING THE ELEMENT.** Removing it would kill the GL
   * context for the rest of the session and every later test in the file would fail against a dead engine, which
   * is a seed contaminating its neighbours. A renamed `id` makes `querySelector('#canvas')` miss while the context
   * lives, and it restores in one assignment — and it is also the mistake that actually happens.
   */
  test('seed 11 — a missing canvas is CAUGHT by `canvasSignature()`, where the raw reading would pass an '
    + 'inertness clause', async ({ composer, page }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');

    const before = await composer.canvasSignature();
    expect(before.mean, 'CALIBRATION: the guarded read already reports the sentinel before any mutation, so this '
      + 'seed is demonstrating a broken boot rather than a caught absence.').toBeGreaterThanOrEqual(0);
    expect(before.lit, 'CALIBRATION: `Cylinder` drew a BLACK frame at entry. It is the low-accumulation witness '
      + 'this suite judges brightness on — a black one means the mutation below cannot be told from the state.')
      .toBeGreaterThan(0);

    const renamed = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#canvas');
      if (!c) return false;
      c.id = 'canvas-seed11';
      return document.querySelector('#canvas') === null;
    });
    expect(renamed, 'CALIBRATION: the `id` rename did not take, so nothing below has a subject. ⚠️ The element is '
      + 'RENAMED rather than removed on purpose: removing it would kill the GL context for the rest of the '
      + 'session and every later test in this file would fail against a dead engine — a seed contaminating its '
      + 'neighbours.').toBe(true);

    /*
     * Half A — the UNGUARDED reading, and the defect it conceals, measured rather than argued.
     * ⚠️ **Expected verdict GREEN: the sentinel pair must satisfy the tightest shipped tolerance (106c's 4).**
     */
    const rawA = await composer.readCanvasSignature();
    const rawB = await composer.readCanvasSignature();
    expect(rawA.mean, 'CALIBRATION: the raw read did not return its `-1` sentinel over an absent `#canvas`, so '
      + 'half A has no subject and the guard added to `canvasSignature()` is guarding against nothing. Re-read '
      + '`readCanvasSignature`\'s early return before trusting either half.').toBe(-1);
    expect(Math.abs(rawA.mean - rawB.mean) <= 4, 'CALIBRATION FAIL: two SENTINEL readings did not satisfy 106c\'s '
      + '`<= 4` tolerance, so the false-pass this seed exists to document does not reproduce. That would make the '
      + 'guard unnecessary — verify before removing it, because the same pair also has to clear 106k\'s 6 and '
      + '106l\'s 8.').toBe(true);

    /* Half B — the guarded reading must REFUSE, naming the sentinel rather than returning it. */
    let threw = '';
    try {
      await composer.canvasSignature();
    } catch (e) {
      threw = e instanceof Error ? e.message : String(e);
    }
    expect(threw, 'CALIBRATION FAIL: `canvasSignature()` returned normally over an absent `#canvas`. Then the '
      + '`-1` sentinel still reaches 106c, 106k and 106l, whose clauses compare two `mean` readings for '
      + 'near-equality and are satisfied by `Math.abs(-1 − -1) === 0` — the suite\'s three tightest tolerances '
      + 'reporting green over a lost context.').not.toBe('');
    expect(threw, 'CALIBRATION: `canvasSignature()` threw, but not from its own sentinel guard — the message does '
      + 'not name the sentinel. A guard that fails for a different reason is not the guard being calibrated.')
      .toContain('sentinel');

    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#canvas-seed11');
      if (c) c.id = 'canvas';
    });
    const after = await composer.canvasSignature();
    expect(after.mean, 'CALIBRATION: seed 11 did not restore `#canvas`\'s `id`, so every later test in this file '
      + 'would now read the sentinel.').toBeGreaterThanOrEqual(0);
  });

  /*
   * ══ SEED 12 · step 106o's three clause groups — the tooltip coverage and the copy bound ════════
   *
   * ⚠️ **106o IS THE ONLY INSTRUMENT FOR THE OWNER'S THIRD 2026-09-10 REQUEST, WHICH IS EXACTLY WHY IT NEEDS A
   * SEED IN THIS SITTING.** `tipcheck` §C/§D scan `sectionTitle()`/`subTitle()` in `visual-fx.ts` ONLY, so a
   * Composer header with no `title` is invisible to all three gates — which is how `Figure-wide` shipped untipped
   * from E92 until 2026-09-10 with `verify` green the whole way. A step that is a project's SOLE instrument for a
   * property, shipped uncalibrated, is the shape `CLAUDE.md` names: *"A SPEC WITHOUT A SEED DISCHARGES NOTHING,
   * WHATEVER COLOUR IT REPORTS."*
   *
   * ⚠️ **FOUR MUTATIONS BECAUSE 106o HAS FOUR INDEPENDENT PREDICATES, AND A SINGLE MUTATION WOULD CALIBRATE ONE
   * WHILE THE OTHERS STAYED UNTESTED** — the same reason seed 7 splits the period phrasing from the `Infinity`
   * placeholder. Half A strips a HEADER's `title`; half B strips a framing `input`'s `title` while LEAVING THE
   * ROW'S INTACT, which is the half that makes 106o's choice of element load-bearing; half C lengthens the static
   * description past the measured bound; **half D deletes the pointer sentence while STAYING UNDER that bound,
   * which is the one state the length clause structurally cannot see.** The `Apply`-switch tip clause is covered
   * by half B's mechanism (a stripped `title` on an `input`) and is not separately mutated — stated, not implied.
   *
   * ⚠️ **HALF B IS THE ONE THAT COULD NOT BE GUESSED. `framingRow()` sets the same tip on the input, the wrapper
   * AND the row** (`composer.ts`: `input.title = tip; wrap.title = tip; row.title = tip;`), and a `title` on the
   * row alone still shows on hover — so a row-scoped clause would report the control as tipped while the element
   * the pointer actually rests on carries nothing. Removing ONLY the input's attribute manufactures precisely that
   * state, and it is the state a hand-edit produces. **If half B fails, 106o is reading the row and should be.**
   *
   * ⚠️ **EVERY MUTATION IS RESTORED THROUGH A SELECTOR IT CANNOT INVALIDATE.** None of the three touches an
   * `aria-label`, a class or a text node used for selection — `title` and `textContent` only — so the restore
   * re-finds its subject by the same selector that found it. Seed 11's `id` rename is the counter-example this
   * rule was written from: **a seed contaminating its neighbours is worse than a missing seed.**
   *
   * ⚠️ **AND HALF C USES THE MEASURED PRE-TRIM TEXT (229 chars, read out of
   * `backup_20260910_owner_ruling_three_src_fixes_suite_all_green/`), NOT AN INVENTED LONG STRING.** The
   * regression 106o exists to catch is *the trim being undone*, so the mutation must BE that state; padding with
   * filler would calibrate the `<=` operator and say nothing about whether the bound sits between the two real
   * classes. Shipped is **166**, and the bound is **200** — 34 above one class, 29 below the other.
   */
  test('seed 12 — a stripped header tip, a stripped CONTROL tip with the row\'s left intact, and the un-trimmed '
    + 'description are each caught SEPARATELY', async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      const pane = SEL.tabPane('composer');

      /* ── Half A · a header with no tooltip ──────────────────────────────────────────────────────── */
      const headers = page.locator(`${pane} .sl-section-title`);
      const readHeaders = async () => headers.evaluateAll(
        (els) => els.map((e) => ({ text: (e.textContent ?? '').trim(), tip: e.getAttribute('title') ?? '' })));

      const headersBefore = await readHeaders();
      expect(headersBefore.length, 'CALIBRATION: the Composer pane published no section titles, so half A has no '
        + 'subject and 106o\'s header clause would itself be passing over an empty corpus. ⚠️ The selector is '
        + 'PANE-scoped because the Mixer\'s four titles are still in the DOM (`display: none`, never detached).')
        .toBeGreaterThanOrEqual(4);
      expect(headersBefore.filter((h) => h.tip.length < 20).map((h) => h.text),
        'CALIBRATION: a Composer header is ALREADY untipped before any mutation. That is not a seed failure — it '
        + 'is the live defect 106o exists to report, and 106o is red. Report it; do not "fix" this seed.')
        .toEqual([]);

      const strippedHeader = await headers.first().evaluate((el) => {
        const had = el.getAttribute('title') ?? '';
        el.removeAttribute('title');
        return had;
      });
      expect(strippedHeader.length, 'CALIBRATION: the first Composer header had no `title` to remove, which '
        + 'contradicts the pre-mutation clause above — read that clause\'s selector before trusting either.')
        .toBeGreaterThanOrEqual(20);
      const headersAfter = await readHeaders();
      expect(headersAfter.filter((h) => h.tip.length < 20).length,
        'CALIBRATION FAIL: a Composer section header\'s `title` was removed outright and 106o\'s header clause '
        + 'still found nothing untipped. Then the ONLY gate that can see an untipped Composer header sees '
        + 'nothing — `tipcheck` §C/§D read `visual-fx.ts` alone, and `Figure-wide` shipped untipped for the whole '
        + 'of Phase 16 with `verify` green.').toBe(1);
      await headers.first().evaluate((el, t) => { el.setAttribute('title', t as string); }, strippedHeader);
      expect((await readHeaders()).filter((h) => h.tip.length < 20), 'CALIBRATION: half A did not restore the '
        + 'header\'s `title`, so half C and every later test in this file run against a seeded page.').toEqual([]);

      /* ── Half B · a CONTROL with no tooltip, on a row that still has one ────────────────────────── */
      const speed = composer.speedSlider();
      await expect(speed, 'CALIBRATION: no Speed slider in the Composer framing section, so half B has no '
        + 'subject.').toHaveCount(1);
      const speedRow = page.locator(SEL.framingRow('Speed'));

      const tipsBefore = await page.locator(`${SEL.framingSection} input`).evaluateAll(
        (els) => els.map((e) => (e.getAttribute('title') ?? '').length));
      expect(tipsBefore.length, 'CALIBRATION: the framing section published fewer than seven inputs, so half B is '
        + 'not measuring the controls the request added. ⚠️ FIVE ROWS, SEVEN INPUTS — the Rotation triplet is one '
        + 'row with three handles (it was SEVEN ROWS, EIGHT INPUTS until 2026-09-10, when the owner removed the '
        + '`Symmetry` row; the bound is unchanged and its margin is now zero, so read a red here against '
        + '`assertFramingRowsPresent()` before treating it as a tooltip finding).').toBeGreaterThanOrEqual(7);
      expect(tipsBefore.filter((n) => n < 20).length, 'CALIBRATION: a framing control is ALREADY untipped before '
        + 'any mutation. Report it as 106o\'s finding; this seed cannot show a caught absence over an existing '
        + 'one.').toBe(0);

      const strippedControl = await speed.evaluate((el) => {
        const had = el.getAttribute('title') ?? '';
        el.removeAttribute('title');
        return had;
      });
      expect(strippedControl.length, 'CALIBRATION: the Speed slider carried no `title`, contradicting the clause '
        + 'above.').toBeGreaterThanOrEqual(20);
      /*
       * ⚠️ **THE ROW'S TIP IS ASSERTED STILL PRESENT, AND THIS ASSERTION *IS* HALF B.** With the row still tipped
       * the control is still hoverable-with-text, so a row-scoped version of 106o's clause would report the
       * section fully covered. Only an input-scoped read can fail here — which is the property being calibrated,
       * not a detail of the mutation.
       */
      expect(await speedRow.getAttribute('title') ?? '', 'CALIBRATION: removing the INPUT\'s `title` also removed '
        + 'the ROW\'s, so the two elements cannot be told apart by this seed and half B degenerates into half A. '
        + 'Re-read `framingRow()`: it sets the tip on input, wrapper and row as three separate assignments.')
        .not.toBe('');
      /*
       * ⚠️ **THE NAME FALLS BACK TO THE ROW LABEL AND MUST, BECAUSE `framingRow()` NAMES NO SINGLE SLIDER** —
       * only the Rotation triplet and the `Mirror` box carry an `aria-label`. Under a bare `aria-label ?? type`
       * read the expected value below would be `'range'`, which every single slider shares, so the clause could
       * not tell WHICH control the seed stripped. This mirrors 106o's own read exactly; if the two drift apart the
       * seed stops calibrating the shipped clause.
       */
      const tipsAfter = await page.locator(`${SEL.framingSection} input`).evaluateAll(
        (els) => els.map((e) => ({
          // ⚠️ `||`, not `??` — an empty row label is not nullish, and a `??` chain would make the `type` arm
          // dead code and yield `''` where the expected value below is `'Speed'`.
          name: e.getAttribute('aria-label')
            || (e.closest('.sl-vfx-row')?.querySelector('.sl-vfx-label')?.textContent ?? '').trim()
            || (e as HTMLInputElement).type,
          len: (e.getAttribute('title') ?? '').length,
        })));
      expect(tipsAfter.filter((c) => c.len < 20).map((c) => c.name),
        'CALIBRATION FAIL: the Speed slider\'s own `title` was removed and 106o\'s control clause still reported '
        + 'every framing control tipped. Then it is reading the ROW rather than the INPUT, and a control whose own '
        + 'element carries nothing passes while the pointer rests on the handle. ⚠️ The remedy is to scope the '
        + 'clause to `input`, NOT to widen this seed.').toEqual(['Speed']);
      await speed.evaluate((el, t) => { el.setAttribute('title', t as string); }, strippedControl);
      expect((await page.locator(`${SEL.framingSection} input`).evaluateAll(
        (els) => els.map((e) => (e.getAttribute('title') ?? '').length))).filter((n) => n < 20).length,
      'CALIBRATION: half B did not restore the Speed slider\'s `title`.').toBe(0);

      /* ── Half C · the static description grown back to its pre-trim length ─────────────────────── */
      const desc = page.locator(`${pane} .sl-tab-desc`);
      await expect(desc, 'CALIBRATION: no `.sl-tab-desc` in the Composer pane, so half C has no subject and '
        + '106o\'s length clause is reading an empty string — which PASSES a `<=` bound.').toHaveCount(1);
      const shipped = ((await desc.textContent()) ?? '').trim();
      expect(shipped.length, `CALIBRATION: the shipped description is ${shipped.length} chars, ALREADY over `
        + '106o\'s bound of 200. That is 106o\'s finding, not a seed failure — the trim has been undone. ⚠️ The '
        + 'measured classes are 166 (shipped, two sentences) and 229 (pre-trim, three clauses); a third reading '
        + 'means one of them needs re-measuring before the bound is trusted.').toBeLessThanOrEqual(200);
      expect(shipped.toLowerCase(), 'CALIBRATION: the shipped description does not mention hovering, so 106o\'s '
        + 'anti-gaming clause is red before this seed touches anything.').toContain('hover');

      /*
       * ⚠️ **THE MUTATION IS THE MEASURED PRE-TRIM STRING, VERBATIM — the state the owner asked to shorten** —
       * and it trips BOTH of 106o's description clauses at once, because the pre-trim text predates the tooltip
       * pass and never said `hover`. **Only the LENGTH clause is asserted here, deliberately: it is the one whose
       * NUMBER was derived and could therefore be wrong in the passing direction.** A mutation that trips two
       * clauses calibrates neither on its own, which is why half D exists.
       */
      const preTrim = 'The figure itself — the three stacked sine waves every preset is built from, where '
        + 'winding is how many times the curve wraps before it closes and size is how far it reaches. '
        + 'Everything else in the Lab decorates what you set here.';
      expect(preTrim.length, 'CALIBRATION: the pre-trim text no longer measures 229 chars, so the bound\'s '
        + 'derivation (166 shipped / 200 bound / 229 pre-trim) is being checked against a different string than '
        + 'the one measured out of the 2026-09-10 backup. Re-derive the bound, do not adjust this literal.')
        .toBe(229);
      expect(preTrim.length > 200, 'CALIBRATION: the pre-trim text is not over the bound, so this mutation cannot '
        + 'fail the length clause and the seed is algebraically impossible — the exact shape `CLAUDE.md` warns '
        + 'about.').toBe(true);

      await desc.evaluate((el, t) => { el.textContent = t as string; }, preTrim);
      const grown = ((await desc.textContent()) ?? '').trim();
      expect(grown.length, 'CALIBRATION: the description rewrite did not take, so nothing below has a subject.')
        .toBe(229);
      expect(grown.length > 200, 'CALIBRATION FAIL: the Composer description was restored to its measured '
        + 'PRE-TRIM state — the exact regression 106o\'s bound exists to catch — and the bound did not reject it. '
        + 'Then 200 is not between the two classes and the clause is green over the owner\'s request being '
        + 'undone. ⚠️ I first wrote 320 "plus headroom", which admits this string; that error is why the bound is '
        + 'derived as a MARGIN and why this seed exists.').toBe(true);

      /*
       * ── Half D · the anti-gaming clause, which the length bound cannot cover ────────────────────
       * ⚠️ **A SHORT DESCRIPTION WITH NO POINTER TO THE TOOLTIPS SATISFIES THE BOUND AND DEFEATS THE REQUEST**, so
       * the `hover` clause is a separate predicate and needs its own mutation. It is seeded from the SHIPPED
       * string with the pointer sentence removed, not from an empty element: an empty one fails the
       * `> 60` calibration instead and would report the wrong clause.
       */
      const gamed = shipped.replace(/\s*Hover[^.]*\.\s*$/i, '');
      expect(gamed, 'CALIBRATION: stripping the trailing `Hover …` sentence changed nothing, so the shipped copy '
        + 'does not end in the pointer sentence and this mutation has no subject.').not.toBe(shipped);
      expect(gamed.length, 'CALIBRATION: the gamed string is too short to clear 106o\'s `> 60` emptiness '
        + 'calibration, so it would fail the wrong clause and report the wrong defect.').toBeGreaterThan(60);
      expect(gamed.length <= 200, 'CALIBRATION: the gamed string does not satisfy the LENGTH bound, so it cannot '
        + 'show that the bound alone is insufficient — which is the whole claim of half D.').toBe(true);

      await desc.evaluate((el, t) => { el.textContent = t as string; }, gamed);
      const gamedRead = ((await desc.textContent()) ?? '').trim().toLowerCase();
      expect(gamedRead.includes('hover'), 'CALIBRATION FAIL: the pointer sentence was deleted and the word '
        + '`hover` is still in the description, so the mutation did not reach the element 106o reads.').toBe(false);

      await desc.evaluate((el, t) => { el.textContent = t as string; }, shipped);
      const restored = ((await desc.textContent()) ?? '').trim();
      expect(restored, 'CALIBRATION: seed 12 did not restore the shipped description, so any later reading of '
        + '`.sl-tab-desc` in this file is a reading of a seeded page.').toBe(shipped);
    });
});
