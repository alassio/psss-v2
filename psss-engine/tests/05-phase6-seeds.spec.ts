/*
 * ⚠️ **`VIEW_SECTION_TITLE` IS NO LONGER IMPORTED HERE, AND THAT IS A CONSEQUENCE WORTH NAMING RATHER THAN A
 * TIDY-UP.** Seed 2 used to build its section selector by hand from that constant plus the bare
 * `.sl-section-title` class — the very combination whose measured failure its own comment records. The 2026-09-10
 * rewrite routes it through `SEL.previewSection`, which owns the scoping (pane + child combinator + `:text-is`),
 * so the constant has no second consumer. **`noUnusedLocals` is what said so** — `CLAUDE.md`: *read a
 * `noUnusedLocals` failure as a claim about the DESIGN before deleting the symbol.*
 */
import {
  test, expect, SEL, BYPASS_LABELS, FLAT_PANE_CAPTION, ComposerPage,
} from './composer-fixture.ts';

/*
 * ============================================================================================
 * Phase 17.6 — **the seeded defects for `04-preview-only-and-readouts.spec.ts`.** Discharges NO test-plan step.
 * ============================================================================================
 *
 * ⚠️ **THIS FILE SHIPS IN THE SAME SITTING AS THE SPEC IT CALIBRATES, WHICH IS A RULE AND NOT A PREFERENCE:
 * *"A SPEC WITHOUT A SEED DISCHARGES NOTHING, WHATEVER COLOUR IT REPORTS — ship the seeds in the same sitting,
 * never in a later phase."*** Deferring them to Phase 7 would mean spec 04 spent an unknown interval as the sole
 * evidence about E109–E111 while being, formally, evidence about nothing.
 *
 * ⚠️ **AND THE STAKES ARE HIGHER HERE THAN THEY WERE FOR SPEC 01's SEEDS, BECAUSE SPEC 04's SUBJECT HAS NO OTHER
 * INSTRUMENT.** Spec 01 re-measures steps `composercheck` §A–§Q already cover from the source side; a vacuous
 * clause there is a lost second opinion. Spec 04 is the FIRST instrument over E109–E111 — `CLAUDE.md`: *"E109–E111
 * (16.18–16.20) shipped with NO section, so nothing measures the preview bypasses, the repeated Speed slider or
 * the two readouts."* A vacuous clause there is not a lost second opinion; it is a false first one.
 *
 * ⚠️ **THE SITTING'S MOST VALUABLE FINDING CAME FROM WRITING THESE SEEDS, NOT FROM RUNNING THEM — AND IT WAS A
 * DEFECT IN SPEC 04 ITSELF.** 106f and 106g compared two exports through
 * `JSON.stringify(JSON.parse(s), Object.keys(JSON.parse(s)).sort())`. **`JSON.stringify`'s replacer ARRAY applies
 * at every depth**, so every nested key absent from the top-level key set is deleted — *including the entire
 * `overlay` block, which is the only thing those two steps are about.* Measured: `norm({m:{n:1},k:2})` and
 * `norm({m:{n:9},k:2})` both yield `{"k":2,"m":{}}` and compare EQUAL. **Two of the file's fourteen bypass clauses
 * could not fail, and no amount of re-reading them would have shown it** — seed 5 below is what shows it, and it
 * is the reason the normaliser now lives in the fixture with its own measurement written down.
 *
 * ⚠️ **HOW THESE SEEDS WORK AND THE LIMIT THAT COMES WITH IT — unchanged from spec 02, restated because it is
 * easy to overclaim.** Each mutates the **live page** to manufacture the defect its clause claims to catch, then
 * asserts the clause's own predicate now reports it. A seed here proves *"if the engine shipped this defect, spec
 * 04 would go red"*. It proves **nothing** about whether the engine could ship it. Both halves matter and only
 * the first is claimed.
 *
 * ⚠️ **AND `src/` IS NOT TOUCHED, WHICH IS A CONSTRAINT ON THIS PHASE SPECIFICALLY.** `CLAUDE.md`: *"Phases 3–7
 * edit no `src/` file and none may"*, and *"nothing may be added under `src/` for the harness's benefit —
 * `deadcheck` counts `src` files."* 17.2's spec could calibrate against defects seeded IN `main.ts` because the
 * owner had approved an edit there; this phase has no such approval, so every seed below is page-local and dies
 * at teardown. **That is a stated weakness of these seeds, not a claim about their sufficiency.**
 *
 * ⚠️ **EVERY SEED ASSERTS ITS PRE-MUTATION READING.** *"A SKIPPED mutation reads exactly like a caught one"* —
 * without the before-reading, a seed that silently failed to apply would report the clause as discriminating on
 * the strength of nothing having happened.
 */

test.describe('Phase 17.6 — calibration: spec 04\'s clauses must be able to FAIL', () => {
  /*
   * ⚠️ **SEEDS 1–4 SHARE ONE PRESET LOAD, DELIBERATELY AND WITH THE TRADE STATED.** A load costs ~25 s, and all
   * four mutate the SAME screen without depending on each other's state. The cost is that the first failure hides
   * the rest — acceptable for a calibration file, whose only two outcomes are "all seeds caught" and "a clause
   * cannot fail, stop and fix it".
   */
  test('seeds 1–4 — the bypass section\'s selectors, ordering, visibility and label spelling can all FAIL',
    async ({ composer, page }) => {
      test.slow();
      await composer.openComposer();
      await composer.loadPreset('Aliens DNA');
      await composer.assertBypassBoxesPresent();

      /* ── seed 1 · the label spelling (the reconnaissance finding, made executable) ───────────────
       * ⚠️ **THIS IS THE SEED THAT PROVES `assertBypassBoxesPresent()` IS LOAD-BEARING RATHER THAN CEREMONIAL:**
       * a mistyped `aria-label` fails SILENTLY, because **every clause in spec 04 that asks `toHaveCount(0)` or
       * `.not.toBeChecked()` of a locator matching nothing reports PASS.** A deleted control needs no seed — it
       * fails loudly anyway (`.check()` times out); a mistyped one is the whole reason the guard exists.
       *
       * ⚠️ **RE-POINTED 2026-09-10, AND ITS ORIGINAL PREMISE IS NOW ALGEBRAICALLY IMPOSSIBLE — RECORDED HERE
       * RATHER THAN DELETED.** The seed used to rewrite the shipped U+2019 apostrophe (`Don’t apply Visual FX`) to
       * ASCII, the mistake a reader transcribing the test plan makes. **The owner's rename to `Apply Visual FX`
       * removed the apostrophe entirely**, so that mutation now has nothing to change and would have failed its
       * own `.not.toBe()` calibration — the honest direction, and exactly what `CLAUDE.md` means by *"a seed can
       * be algebraically impossible: ask what the mutation can fail on that the shipped rule cannot."*
       *
       * ⚠️ **THE REPLACEMENT IS THE MISTAKE THE NEW SHAPE INVITES: the OLD label.** Every document, step and
       * reader predating 2026-09-10 says `Don't apply Visual FX`, so that string is now precisely what a stale
       * selector carries — and it is a silent miss in the same way the apostrophe was. **The failure class is
       * preserved; only the specific string moved.**
       */
      const staleLabel = 'Don’t apply Visual FX';
      expect(staleLabel, 'CALIBRATION: the stale and shipped spellings are identical, so this seed is '
        + 'algebraically impossible — the rename was reverted and this whole seed needs re-deriving.')
        .not.toBe(BYPASS_LABELS.fx);
      expect(await page.locator(`${SEL.tabContent} input[aria-label="${staleLabel}"]`).count(),
        'CALIBRATION: the OLD label already matches an element, so the seed below cannot manufacture the defect '
        + '— something still ships the pre-rename spelling and `BYPASS_LABELS` must be re-measured.').toBe(0);

      await composer.bypassBox('fx').evaluate((el, stale) => {
        el.setAttribute('aria-label', stale as string);
      }, staleLabel);

      let guardFailed = false;
      try { await composer.assertBypassBoxesPresent(); } catch { guardFailed = true; }
      expect(guardFailed, 'CALIBRATION FAIL: the FX box\'s aria-label was rewritten to the PRE-RENAME spelling '
        + 'and `assertBypassBoxesPresent()` still passed. Without that guard, a selector transcribed from any '
        + 'document written before 2026-09-10 matches NOTHING and every absence clause in spec 04 reports PASS '
        + 'over an empty locator — this project\'s single most-recorded instrument defect.').toBe(true);
      /*
       * Restore, so seeds 2–4 run on the real surface.
       *
       * ⚠️ **THE RESTORE MUST NOT GO THROUGH `bypassBox('fx')` — THAT LOCATOR MATCHES ON THE VERY ATTRIBUTE THE
       * MUTATION JUST REWROTE, SO IT RESOLVES TO NOTHING AND `evaluate` WAITS THE FULL 540 s.** It did, and the
       * failure surfaced as `locator.evaluate: Test timeout` naming a line whose only job is cleanup — one more
       * instance of `CLAUDE.md`'s *"A HARNESS FAILURE ACCUSES THE SUBJECT BY DEFAULT"*, and the sharpest kind,
       * because the seed's own assertion had already PASSED two lines above.
       *
       * ⚠️ **SO THE UNDO IS ADDRESSED BY THE MUTATED VALUE, WHICH IS THE ONE THING THAT IS TRUE OF THE ELEMENT
       * RIGHT NOW.** A general rule for every seed in this file: **a mutation that changes a selector's own
       * predicate must be undone through a selector the mutation cannot invalidate.** The `toHaveCount(1)` below
       * asserts the undo LANDED — without it a failed restore would hand seeds 2–4 a mutated surface and their
       * `before`-readings would fail for a reason that has nothing to do with what they measure.
       */
      const staleBox = page.locator(`${SEL.tabContent} input[aria-label="${staleLabel}"]`);
      await expect(staleBox, 'CALIBRATION: the mutation did not land, so the guard above "caught" nothing and '
        + 'there is nothing here to restore.').toHaveCount(1);
      await staleBox.evaluate((el, real) => {
        el.setAttribute('aria-label', real as string);
      }, BYPASS_LABELS.fx);
      await expect(staleBox, 'the restore did not take: the stale label is still on the element, so seeds 2–4 '
        + 'would run on the mutated surface.').toHaveCount(0);
      await composer.assertBypassBoxesPresent();

      /* ── seed 2 · the switch ORDER (106a) ───────────────────────────────────────────────────────
       * ⚠️ **A PERMUTATION, NOT A DELETION — `CLAUDE.md` records that distinction as a real defect on this very
       * tab: *"A SET-MEMBERSHIP CLAUSE CANNOT SEE A PERMUTATION."*** A seed that removed a control would be
       * caught by a count; the question is whether 106a's `toEqual([...])` is genuinely ordered, and the only
       * mutation that can answer it is a swap.
       *
       * ⚠️ **RE-POINTED 2026-09-10 FROM `.sl-vfx-label` TO `.sl-composer-bypass-cap`, AND THE OLD SELECTOR WOULD
       * NOW HAVE SWAPPED NOTHING — SILENTLY IN THE PASSING DIRECTION.** The owner's *"same row to save space"*
       * change moved both captions out of the 56 px `.sl-vfx-label` column (which cannot hold two) into
       * per-box caption spans, and moved `Speed` out of this section entirely. So the old mutation would have
       * found **zero** labels here. **It is the `swapped` guard below that makes that a failure rather than a
       * green** — the same guard that caught the original wrong selector, catching its successor's obsolescence.
       *
       * ⚠️ **AND THE STAKES ROSE WITH THE RENAME: the two switches now differ by ONE WORD, sit 22 px apart on one
       * row and are visually identical**, so a permutation is no longer a cosmetic defect — it re-points every
       * click at the other bundle, and nothing else on screen would say so.
       */
      const capsSel = `${SEL.previewSection} .sl-composer-bypass-cap`;
      const before2 = await page.locator(capsSel).allTextContents();
      expect(before2, 'CALIBRATION: the two switch captions are not in their shipped order to begin with, so a '
        + 'swap below cannot demonstrate anything — and 106a is already failing.')
        .toEqual([BYPASS_LABELS.fx, BYPASS_LABELS.materials]);

      /*
       * ⚠️ **THE SECTION MUST BE IDENTIFIED BY ITS TITLE *TEXT*, AND `SEL.viewSectionTitle` IS THE BARE CLASS
       * `.sl-section-title` — SO `:has(…)` MATCHES EVERY TITLED SECTION IN THE PANEL, INCLUDING OTHER TABS'.**
       * Measured, not reasoned, and it cost two wrong fixes (`.first()`, then `.last()`) before the structure was
       * read: on the Composer tab that selector resolved to **10** sections, the first four of them **the
       * MIXER's, still in the DOM** (quoted here as `Deck A`, `Deck B`, `Crossfader`, `Category Locks` until
       * 2026-10-05, when 23.5 retitled the fourth to `Categories`; still four, and still unasserted) — then
       * the view section,
       * then `Shape`, three untitled `sl-composer-slot`s and `Figure-wide`. ⚠️ **THAT FIGURE IS A DATED
       * MEASUREMENT AND `Figure-wide` IS GONE (owner, 2026-09-10, with its one control), so the count is now one
       * lower — deliberately NOT decremented here, because arithmetic on a quoted figure is how a basis goes
       * wrong; re-measure it if you need it.** The finding it records is the SHAPE, which has not changed.
       * **They do not nest**, so both an
       * outermost and an innermost pick swapped nothing. ⚠️ **`SEL.previewSection` now owns that scoping** (it is
       * `:has(> .sl-section-title:text-is(…))`, child-combinator and pane-scoped), which is why this seed no
       * longer builds the selector by hand — but the measurement is kept, because the next hand-built one repeats
       * the defect.
       *
       * ⚠️ **AND THE READ ABOVE IS RIGHT WHILE THE OLD MUTATION WAS WRONG, WHICH IS WHY THE FAILURE POINTED AT
       * THE WRONG THING:** `allTextContents()` flattens all ten matches, and since nine contribute no labels it
       * returned exactly the shipped ones in DOM order — so `before2` passed its guard while the mutation was
       * hitting an empty list. **A selector used for READING can be correct while the same selector used for a
       * DOM MUTATION is not** — `CLAUDE.md`'s *"a SKIPPED mutation reads exactly like a caught one"*, reached from
       * the selector rather than the assertion. The `mutated !== original` guard is what caught it.
       */
      const previewSection = page.locator(SEL.previewSection);
      await expect(previewSection, 'CALIBRATION: the `Preview only` section is not uniquely identified by its '
        + 'title text, so the mutation below would be ambiguous. `.sl-section-title` alone matches every titled '
        + 'section in the panel — including the Mixer\'s four, which stay in the DOM.').toHaveCount(1);
      const swapped = await previewSection.evaluate((sec) => {
        const caps = [...sec.querySelectorAll('.sl-composer-bypass-cap')];
        const a = caps[0], b = caps[1];
        if (!a || !b) return 0;
        const t = a.textContent; a.textContent = b.textContent; b.textContent = t;
        return caps.length;
      });
      expect(swapped, 'CALIBRATION: the seed found fewer than two `.sl-composer-bypass-cap` elements inside the '
        + '`Preview only` section, so it swapped NOTHING and the clause below would report 106a as unordered on '
        + 'the strength of a mutation that never happened. ⚠️ This is also the guard that would catch this seed '
        + 'going stale a SECOND time: the captions were `.sl-vfx-label` until 2026-09-10, and re-pointing the '
        + 'read without re-pointing the mutation is silent in the PASSING direction.').toBe(2);
      const after2 = await page.locator(capsSel).allTextContents();
      expect(after2, 'CALIBRATION FAIL: the two switch captions were SWAPPED and the ordered read still returned '
        + 'the shipped order. 106a would then be a set-membership claim wearing an array\'s clothes.')
        .not.toEqual(before2);
      expect(after2[0], 'CALIBRATION FAIL: the swap did not change the first caption, so the mutation did not '
        + 'apply and the clause above "caught" nothing.').toBe(BYPASS_LABELS.materials);
      // ⚠️ **RESTORED, BECAUSE SEED 4 READS THIS SECTION.** A caption swap leaks into any later clause selecting
      // by caption text — `a seed must not leak into the next seed in its own file`.
      await previewSection.evaluate((sec) => {
        const caps = [...sec.querySelectorAll('.sl-composer-bypass-cap')];
        const a = caps[0], b = caps[1];
        if (!a || !b) return;
        const t = a.textContent; a.textContent = b.textContent; b.textContent = t;
      });
      expect(await page.locator(capsSel).allTextContents(),
        'CALIBRATION: seed 2\'s swap did not restore, so any later clause reading a caption would fail for '
        + 'seed 2\'s reason and its message would accuse the engine.').toEqual(before2);

      /* ── seed 3 · the bypass notice forced visible (106a, 106c) ─────────────────────────────────
       * ⚠️ **SEEDED VIA `display`, BECAUSE THAT IS THE MECHANISM THE CLAUSE HAD TO GET RIGHT.** The notice is
       * ALWAYS in the DOM; a `count()`-based clause passes whether it is on screen or not. `CLAUDE.md`'s
       * *"`display: none` stops a tab being SEEN, not WORKING"* in assertion form — and this harness has already
       * had one wrong figure from exactly this shape.
       */
      expect(await composer.notice('bypass').count(), 'CALIBRATION: the bypass notice element must exist even '
        + 'while hidden, or the visibility clauses are asserting about an absent element.').toBe(1);
      expect(await composer.notice('bypass').isVisible(),
        'CALIBRATION: it must start HIDDEN with both boxes off — that is 106a\'s claim.').toBe(false);
      await composer.notice('bypass').evaluate((e) => { (e as HTMLElement).style.display = 'block'; });
      expect(await composer.notice('bypass').isVisible(),
        'CALIBRATION FAIL: the bypass notice was forced visible and `toBeHidden()` would still have passed. An '
        + 'always-visible consequence notice is an alarm nobody reads, and a `count()` clause cannot see it.')
        .toBe(true);
      /* ⚠️ **RESTORED, AND THE RESTORE IS LOAD-BEARING RATHER THAN TIDINESS — seed 4 asserts this element is
       * HIDDEN.** Leaving the inline `display: block` in place would make seed 4 fail for seed 3's reason, and the
       * message it printed would accuse the engine. **A seed must not leak into the next seed in its own file;**
       * page-teardown isolation only protects the next SPEC. */
      await composer.notice('bypass').evaluate((e) => { (e as HTMLElement).style.display = 'none'; });
      expect(await composer.notice('bypass').isVisible(),
        'CALIBRATION: seed 3\'s mutation did not restore, so seed 4 below would fail for seed 3\'s reason.')
        .toBe(false);

      /* ── seed 4 · a box in the wrong state on load (106a, 106h) ─────────────────────────────────
       * ⚠️ **THE POLARITY IS THE SUBJECT AND IT IS WHY THIS SEED IS NOT REDUNDANT WITH SEED 1.** Nothing persists
       * these flags, so a box in the wrong state at load means something writes them at init. The mutation moves
       * the DOM checkbox WITHOUT firing `change`, which is also the exact shape of §Q's real defect: a box painted
       * into a state its owner never heard about.
       *
       * ⚠️ **INVERTED 2026-09-10 WITH THE OWNER'S `Apply` POLARITY, AND THE MUTATION HAD TO FLIP WITH IT — A SEED
       * THAT KEPT TICKING THE BOX WOULD HAVE BEEN A NO-OP ON AN ALREADY-TICKED CONTROL, i.e. AN ALGEBRAICALLY
       * IMPOSSIBLE SEED WEARING ITS OLD SHAPE.** `.checked = true` over a box that is already `true` mutates
       * nothing, the `toBeChecked()` clause below would have passed on the UNMUTATED surface, and the seed would
       * have reported the clause as discriminating on the strength of nothing having happened — `CLAUDE.md`'s
       * *"a SKIPPED mutation reads exactly like a caught one"* in its purest form. **The pre-state assertion is
       * what makes the flip visible instead of silent.**
       */
      const box = composer.bypassBox('materials');
      await expect(box, 'CALIBRATION: the `Apply Materials` box must start TICKED — that is the owner\'s '
        + '2026-09-10 polarity, and if it starts unticked the mutation below is a no-op and this seed proves '
        + 'nothing.').toBeChecked();
      await box.evaluate((el) => { (el as HTMLInputElement).checked = false; });
      await expect(box, 'CALIBRATION FAIL: the checkbox was UNticked directly and `toBeChecked()` still passed — '
        + '106a cannot see a box that arrives in the wrong state.').not.toBeChecked();

      /*
       * ⚠️ **AND THE HALF THAT MAKES THIS SEED MORE THAN A RESTATEMENT OF PLAYWRIGHT'S SEMANTICS: writing
       * `.checked` FIRES NO `change` EVENT, so the ENGINE never heard about it.** That is §Q's real defect
       * reproduced deliberately — *"the level checkbox painted `!muted`, arrived TICKED over an empty row, so no
       * `change` fired"* — and it is the state 106h calls *"the one surface on screen lying about the picture."*
       * The notice is the observable consequence: it is gated on the ENGINE's flags, so it must still be hidden
       * under an unticked box. **A clause reading only the checkbox could not tell this from a working bypass.**
       */
      expect(await composer.notice('bypass').isVisible(), 'CALIBRATION FAIL: the bypass notice became visible '
        + 'from a `.checked = false` that fired NO `change` event. Then the notice is painted from the CHECKBOX '
        + 'rather than from the engine\'s flags, and 106a/106c would be reading the control back to itself — the '
        + 'shape §Q was green over.').toBe(false);
      // ⚠️ Left seeded on purpose: this test ends here, and the page is discarded at teardown. Nothing below
      // depends on the box, and `workers: 1` means the NEXT spec gets a fresh page, not this one.
    });

  /*
   * ⚠️ **SEED 5 IS THE ONE THAT FOUND A REAL DEFECT, AND IT RUNS WITHOUT A BROWSER ROUND-TRIP ON PURPOSE.** The
   * subject is the COMPARATOR, not the page: 106f and 106g assert that two exported JSON texts are equal, and a
   * comparator that equates everything makes both clauses unconditionally green. **A seed for a comparator is a
   * pair of inputs that MUST differ.**
   *
   * ⚠️ **THE DIFFERENCE IS PLANTED IN `overlay`, NESTED, BECAUSE THAT IS WHERE THE DEFECT LIVED AND WHERE THE
   * SUBJECT LIVES.** A top-level difference would have been caught by the broken version too — which is
   * `CLAUDE.md`'s *"ask what the mutation can fail on that the shipped rule cannot"* applied to a seed.
   */
  test('seed 5 — the export comparator can tell two presets apart, INCLUDING a nested `overlay` difference',
    async () => {
      const authored = JSON.stringify({
        metadata: { name: 'Seed' },
        generators: { waves: [{ am: { base: 30 } }] },
        overlay: { filmLook: 'Kodachrome', speedFactor: 1, symmetryFold: 4 },
      });
      // Only ONE nested value differs, two levels down, inside the block the two steps are entirely about.
      const bypassed = JSON.stringify({
        metadata: { name: 'Seed' },
        generators: { waves: [{ am: { base: 30 } }] },
        overlay: { filmLook: 'None', speedFactor: 1, symmetryFold: 4 },
      });

      const norm = ComposerPage.normalisePresetJSON;
      expect(norm(authored), 'CALIBRATION FAIL — AND THIS IS THE DEFECT THAT WAS ACTUALLY FOUND: the comparator '
        + 'reports two presets EQUAL when their `overlay.filmLook` differs. The original inline form was '
        + '`JSON.stringify(JSON.parse(s), Object.keys(JSON.parse(s)).sort())`, and a replacer ARRAY applies at '
        + 'EVERY depth — so every nested key absent from the top-level key set is DELETED, including the whole '
        + '`overlay` block. 106f and 106g would have been green, stable, and comparing two near-empty objects.')
        .not.toBe(norm(bypassed));

      // ⚠️ The OTHER direction, which is the reason a normaliser exists at all: key ORDER must NOT count.
      const reordered = JSON.stringify({
        overlay: { symmetryFold: 4, speedFactor: 1, filmLook: 'Kodachrome' },
        generators: { waves: [{ am: { base: 30 } }] },
        metadata: { name: 'Seed' },
      });
      expect(norm(reordered), 'CALIBRATION FAIL: the comparator reports a false difference on a pure key '
        + 'REORDER. Then 106f fails on correct code, which is the other way an instrument accuses its subject — '
        + '`CLAUDE.md`: a harness failure accuses the subject by default.').toBe(norm(authored));

      // ⚠️ And arrays must keep their ORDER: `dye.fixedColour` is the format's first reference type, and its
      // order is meaning. A normaliser that sorted array members would equate two different colours.
      const swappedArray = JSON.stringify({ overlay: { dye: { fixedColour: [0.2, 0.9, 0.1] } } });
      const otherArray = JSON.stringify({ overlay: { dye: { fixedColour: [0.9, 0.2, 0.1] } } });
      expect(norm(swappedArray), 'CALIBRATION FAIL: the comparator equates two different `fixedColour` arrays. '
        + 'Array order is meaning for the format\'s one reference type.').not.toBe(norm(otherArray));
    });

  /*
   * ⚠️ **SEED 6 IS THE FLAT-CAPTION SEED AND IT SEEDS THE *SILENT DIRECTION*, WHICH IS THE OPPOSITE OF THE
   * OBVIOUS ONE.** 107c and 107d are ABSENCE claims — *"an empty row shows NO flat caption"*, *"the flat pane
   * offers no button"*. The failure that matters is therefore a caption element that has gone MISSING or been
   * renamed, because a pane with no caption element reads as *"not flat"* and **both absence claims pass.** So
   * the mutation removes the class from every caption and requires `assertFlatCaptionsExist()` to catch it.
   *
   * ⚠️ **AND THE SECOND HALF SEEDS THE CAPTION SAYING THE WRONG THING, WHICH IS THIS PHASE'S SIGNATURE DEFECT:
   * three of its three readout defects were confidently WRONG EXPLANATIONS, not blank ones.** `no Z size` is
   * falsifiable and was falsified — a winding of 0 flattens a pane whose two sizes are large and real — so 107b's
   * `not.toMatch(/no [XYZ] size/)` has to be able to fail, and only an injected wrong caption shows that it can.
   */
  test('seed 6 — a missing caption element and a WRONG caption are both caught', async ({ composer, page }) => {
    test.slow();
    await composer.openComposer();
    await composer.loadPreset('Radar');
    await composer.assertFlatCaptionsExist();

    // ---- 6a: the pane is genuinely flat before anything is touched ----
    expect(await composer.paneIsFlat('Detail', 'X / Y'), 'CALIBRATION: Radar\'s Detail `X / Y` pane is not in '
      + 'the flat state, so every seed below is about a pane that was never the subject. Re-measure the library '
      + 'before assuming the caption broke.').toBe(true);

    // ---- 6b: the WRONG caption. The clause under calibration is 107b's absence match. ----
    const wrong = 'flat here — no Z size';
    expect(wrong, 'CALIBRATION: the seeded wrong caption is identical to the shipped one, so the mutation is '
      + 'algebraically impossible and cannot demonstrate the clause.').not.toBe(FLAT_PANE_CAPTION);
    await composer.paneFlatCaption('Detail', 'X / Y').evaluate((e, txt) => { e.textContent = txt as string; },
      wrong);
    const seededText = (await composer.paneFlatCaption('Detail', 'X / Y').textContent())?.trim() ?? '';
    expect(seededText, 'CALIBRATION FAIL: the caption text did not change, so the clause below "caught" nothing.')
      .toBe(wrong);
    expect(seededText, 'CALIBRATION FAIL: the caption was rewritten to name an AXIS (`no Z size`) and 107b\'s '
      + 'absence match did not reject it. That wording is FALSIFIABLE and was falsified — a winding of 0 '
      + 'flattens a pane whose two sizes are large and real — so a confidently wrong explanation would reach a '
      + 'reader unchallenged. Three of this phase\'s three readout defects were wrong EXPLANATIONS.')
      .toMatch(/\b(no [XYZ] size|[XYZ] axis)\b/);

    // ---- 6c: the caption ELEMENT removed — the SILENT direction for 107c and 107d ----
    const paneCount = await page.locator(`${SEL.tabContent} ${SEL.pane}`).count();
    expect(paneCount, 'CALIBRATION: no panes at all.').toBeGreaterThan(0);
    await page.locator(`${SEL.tabContent} ${SEL.paneFlat}`).first().evaluate(() => {
      document.querySelectorAll('.sl-composer-pane-flat')
        .forEach((e) => e.classList.remove('sl-composer-pane-flat'));
    });
    expect(await page.locator(`${SEL.tabContent} ${SEL.paneFlat}`).count(),
      'CALIBRATION FAIL: the class was stripped from every caption and the selector still matched them — the '
      + 'mutation did not apply.').toBe(0);

    let captionGuardFailed = false;
    try { await composer.assertFlatCaptionsExist(); } catch { captionGuardFailed = true; }
    expect(captionGuardFailed, 'CALIBRATION FAIL: every caption element was unclassed and '
      + '`assertFlatCaptionsExist()` still passed. This is the SILENT direction: a pane with no caption element '
      + 'reads as "not flat", so 107c ("an empty row shows NO caption") and 107d ("the flat pane offers no '
      + 'button") would BOTH pass while the readout had ceased to exist entirely.').toBe(true);

    // ⚠️ And the consequence, made explicit rather than left to inference: with the class gone, `paneIsFlat`
    // now answers FALSE about a pane that IS flat. That is the wrong answer the guard exists to prevent.
    expect(await composer.paneIsFlat('Detail', 'X / Y'), 'CALIBRATION FAIL: `paneIsFlat` still reports true '
      + 'with no caption element present, so it is not reading the caption at all.').toBe(false);
  });

  /*
   * ⚠️ **SEED 7 IS THE SPEED SLIDER'S SCOPING SEED, AND IT IS THE ONE DEFECT IN THIS FILE THAT WAS FOUND IN THE
   * FIXTURE ITSELF AND WOULD HAVE SHIPPED GREEN.** Visual FX's Speed row uses the SAME `.sl-vfx-row` /
   * `.sl-vfx-label` / `.sl-vfx-slider` classes — `composer.ts` reuses them deliberately — and **`TabRegistry`
   * never detaches a tab: `createContainer()` appends every initialised tab's container inside the ONE
   * `.sl-tab-content`, and `show()` hides the others with `style.display = 'none'`
   * (`exploration/tab-module.ts:51`, `:54`, `:103`).**
   *
   * ⚠️ **SO `.sl-tab-content` IS NOT A SCOPE, AND THE ORIGINAL `SEL.composerSpeedRow` USED IT.** After 106n opens
   * Visual FX — the one step that visits both — an unscoped-by-tab selector matches TWO Speed rows. `CLAUDE.md`'s
   * *"`display: none` stops a tab being SEEN, not WORKING"* is the rule; this is it arriving in a selector.
   *
   * ⚠️ **AND THE FAILURE DIRECTION IS THE BAD ONE, WHICH IS WHY THIS SEED IS THE MOST VALUABLE IN THE FILE:
   * BOTH HANDLES WRITE `speedFactor`.** A spec driving Visual FX's handle while claiming to drive the Composer's
   * would see the flag move, read the value back through the hook, and report GREEN about the wrong control —
   * i.e. E110 would have no instrument at all while appearing to have one.
   *
   * ⚠️ **THE SEED IS A COUNT, AND WHAT IT MUTATES IS THE SCOPE: with both panes built, the `.sl-tab-content` form
   * must match MORE than the `tabPane('composer')` form.** `CLAUDE.md`: *"a seed for a COUNT clause must change
   * the count."* No DOM edit is needed — the ambiguity is a property of the shipped markup, and the only thing
   * this test changes is whether both producers have been initialised.
   */
  test('seed 7 — `.sl-tab-content` is NOT a tab scope: the Speed row is ambiguous without the pane',
    async ({ composer, page }) => {
      test.slow();
      await composer.openComposer();
      await composer.loadPreset('Argus');

      const SHARED = '.sl-vfx-row:has(> .sl-vfx-label:text-is("Speed"))';

      // ---- before: only the Composer has been initialised, so BOTH forms agree. This is why the defect is
      // invisible to any spec that never opens a second tab — i.e. to every spec except 106n.
      expect(await page.locator(`${SEL.tabContent} ${SHARED}`).count(), 'CALIBRATION: with only the Composer '
        + 'built, the loose form must already match exactly one row — otherwise the count change below is not '
        + 'attributable to the second tab.').toBe(1);
      await expect(composer.speedSlider(), 'CALIBRATION: the fixture\'s scoped Speed slider does not resolve to '
        + 'exactly one element, so every comparison below is about the wrong subject.').toHaveCount(1);

      // ---- the mutation: initialise Visual FX, i.e. reach the state 106n actually visits ----
      await composer.openTab('visual-fx');

      const loose = await page.locator(`${SEL.tabContent} ${SHARED}`).count();
      expect(loose, 'CALIBRATION FAIL: with BOTH tabs initialised, a `.sl-tab-content`-scoped Speed-row selector '
        + 'still matches exactly one element, so this seed cannot demonstrate the ambiguity it exists for. '
        + 'Either `TabRegistry` started detaching inactive panes (it does not — it sets `display: none`) or the '
        + 'two rows stopped sharing classes. Re-derive `SEL.tabPane`\'s reason to exist before trusting it — the '
        + 'ORIGINAL `SEL.composerSpeedRow` used the loose form, and both handles write `speedFactor`, so a spec '
        + 'driving the wrong one reports GREEN about the other tab\'s control.').toBeGreaterThan(1);

      // ---- and the fix, asserted in both directions: each pane holds exactly ONE Speed row, and they are
      // DIFFERENT elements. A one-sided count could not tell a correct scope from a lucky one.
      expect(await page.locator(`${SEL.tabPane('composer')} ${SHARED}`).count(),
        'CALIBRATION FAIL: the Composer pane does not hold exactly one Speed row.').toBe(1);
      expect(await page.locator(`${SEL.tabPane('visual-fx')} ${SHARED}`).count(),
        'CALIBRATION FAIL: the Visual FX pane does not hold exactly one Speed row — then 106n\'s cross-tab '
        + 'agreement clause is reading an empty locator, and an empty locator\'s `textContent()` is not a '
        + 'disagreement, it is nothing.').toBe(1);

      /*
       * ⚠️ **`SHARED` MUST NOT CROSS INTO `page.evaluate` — `:has()` IS CSS BUT `:text-is()` IS A PLAYWRIGHT
       * PSEUDO-CLASS, AND `querySelector` THROWS `SyntaxError` ON IT.** It did, and the throw came from inside the
       * browser at `Array.map`, so the report named `page.evaluate` and not the selector — a harness defect
       * accusing the subject, again. The Playwright-**locator** uses of `SHARED` a few lines up are correct and
       * stay; only this one crosses the boundary.
       *
       * ⚠️ **SO THE TEXT TEST MOVES INTO JS, WHERE IT IS AN ORDINARY COMPARISON.** `:text-is("Speed")` is an exact,
       * trimmed, full-text match on the element itself, so `textContent.trim() === 'Speed'` is the same predicate
       * — deliberately EXACT, and the exactness must NOT be relaxed to a substring test now that the label it was
       * originally guarding against is gone. ⚠️ **The original reason was `Sweep rate`, removed by the owner on
       * 2026-09-10; the reason it stays EXACT is that Visual FX carries `Evol. Speed` (twice — curl noise and
       * procedural flow) and `Turn Speed`, so a substring test picks the WRONG ROW IN THE SAME PANE and the
       * cross-pane identity clause below then compares two unrelated rows and reports agreement.** A retired
       * guard's SUBJECT changing is not a reason to retire the guard — enumerate what else satisfies it first.
       *
       * ⚠️ **AND THE `>` IN `:has(> …)` IS PART OF THE PREDICATE, NOT DECORATION:** the label must be a DIRECT
       * child of the row, which is what `:scope > .sl-vfx-label` expresses here. A descendant scan would match a
       * row that merely contains a nested `Speed` label somewhere below it.
       */
      const same = await page.evaluate(() => {
        const panes = [...document.querySelectorAll('.sl-tab-content [data-tab]')];
        const rows = panes
          .map((p) => [...p.querySelectorAll('.sl-vfx-row')].find((r) => [
            ...r.querySelectorAll(':scope > .sl-vfx-label'),
          ].some((l) => (l.textContent ?? '').trim() === 'Speed')))
          .filter(Boolean);
        return rows.length >= 2 ? rows[0] === rows[1] : true;
      });
      expect(same, 'CALIBRATION FAIL: the two panes resolve to the SAME Speed row element, so the per-pane '
        + 'counts above are one element counted twice and the scope proves nothing.').toBe(false);
    });

  /*
   * ⚠️ **SEED 8 IS THE PERIOD READOUT'S SEED, AND IT SEEDS THE PHRASING COLLAPSE — WHICH IS THE FAILURE 107e AND
   * 107g EXIST FOR AND THE ONE A "IS THERE TEXT" CLAUSE CANNOT SEE.** There are two phrasings: `repeats every N s`
   * only where the live rates are commensurate, else `slowest cycle N s`. **An implementation that printed
   * `repeats every` unconditionally would look completely correct on most presets and be confidently wrong on 225
   * of 1197 library slots** — and both strings contain a number and a unit, so any clause checking for a
   * well-formed period passes on both.
   *
   * ⚠️ **THE MUTATION IS THE COLLAPSE ITSELF: rewrite the non-commensurate row's readout to the commensurate
   * phrasing.** And the third clause seeds a PLACEHOLDER, because 107g's rejected values (`0`, `Infinity`, `—`)
   * are each *"a value the reader has to attribute to something"* — an absence clause over a row that prints
   * nothing at all cannot fail, and that is precisely the shape this project keeps recording.
   */
  test('seed 8 — a collapsed period phrasing and a placeholder are both caught', async ({ composer }) => {
    test.slow();
    await composer.openComposer();
    await composer.loadPreset('Aurora Borealis');

    const before = await composer.readoutTexts();
    expect(before[0], 'CALIBRATION: Aurora Borealis Body must open with the NON-commensurate phrasing (its live '
      + 'rates are 1 and 1.1). If it opens with `repeats every`, 107e is already failing and this seed would '
      + '"catch" its own broken premise.').toContain('slowest cycle');
    expect(before[1], 'CALIBRATION: Structure must open with the COMMENSURATE phrasing (rates 1, 2, 3) — the '
      + 'two phrasings on one screen is what makes 107e specific.').toContain('repeats every');

    // ---- 8a: the collapse. Body now says what Structure says. ----
    await composer.readout(0).evaluate((e) => {
      e.textContent = (e.textContent ?? '').replace('slowest cycle', 'repeats every');
    });
    const collapsed = (await composer.readout(0).textContent()) ?? '';
    expect(collapsed, 'CALIBRATION FAIL: the phrasing was not rewritten, so the clause below caught nothing.')
      .not.toBe(before[0]);
    expect(collapsed, 'CALIBRATION FAIL: Body\'s readout was collapsed to the COMMENSURATE phrasing and 107e\'s '
      + '`not.toContain("repeats every")` did not reject it. Both phrasings carry a number and a unit, so a '
      + 'clause checking for a well-formed period passes on either — and the collapsed form is wrong on 225 of '
      + '1197 library slots while looking right on the rest.').toContain('repeats every');
    expect(collapsed, 'CALIBRATION FAIL: the collapsed readout still contains `slowest cycle`, so 107e\'s pair '
      + 'assertion could pass on a row carrying BOTH phrasings — which is neither state.')
      .not.toContain('slowest cycle');

    // ---- 8b: a PLACEHOLDER on a row that must print nothing. Calibrates 107g. ----
    await composer.loadPreset('Cylinder');
    const cyl = await composer.readoutTexts();
    expect(cyl[0], 'CALIBRATION: Cylinder\'s Body must print NO period — none of its slots modulates. If it '
      + 'prints one, 107g is already failing.').not.toMatch(/repeats every|slowest cycle/);
    expect(cyl[0], 'CALIBRATION: it must not already carry a placeholder either.').not.toMatch(/Infinity|NaN|—/);

    await composer.readout(0).evaluate((e) => { e.textContent = `${e.textContent ?? ''} · repeats every 0 s`; });
    const seeded = (await composer.readout(0).textContent()) ?? '';
    expect(seeded, 'CALIBRATION FAIL: the placeholder was not injected.').not.toBe(cyl[0]);
    expect(seeded, 'CALIBRATION FAIL: `repeats every 0 s` was injected into a row with NO period and 107g\'s '
      + 'clause did not reject it. `0` reads as instant, `Infinity` as broken, `—` as missing data — each is a '
      + 'value the reader must attribute to something, and printing NOTHING is the only honest option. An '
      + 'absence clause over a row that prints nothing anyway cannot fail; this is what makes it able to.')
      .toMatch(/repeats every|\b0 s\b/);
  });

  /*
   * ⚠️ **SEED 9 IS THE HOOK-CHANNEL SEED FOR THIS SPEC SPECIFICALLY, AND IT IS NOT REDUNDANT WITH 17.2's.** Spec
   * 03 calibrated the hook's SHAPE — its key set, its getter-ness, its guard. This seeds what spec 04 does with
   * it: **fourteen bypass clauses read `bypassVisualFx`, `bypassMaterials`, `renderMode`, `material`, `filmLook`,
   * `speedFactor` and `snapshotIsFrozen` off a live reading and compare them to a BEFORE reading.** If `hook()`
   * ever returned the same object twice, every one of those comparisons would pass — *"reports frozen, pixels
   * moved"* in its most general form.
   *
   * ⚠️ **AND THE SEED IS THE `window.__psss = read()` MISTAKE, WHICH `CLAUDE.md` NAMES AS THE TEMPTING ONE:
   * *"IT IS ONE LINE SHORTER, READS AS TIDIER AND REPORTS THE BOOT FRAME FOREVER."*** Replacing the getter with a
   * frozen snapshot must make a *"did it respond?"* clause fail — this one asserts that it does.
   */
  test('seed 9 — a FROZEN hook makes spec 04\'s before/after comparisons fail, as it must',
    async ({ composer, page }) => {
      test.slow();
      const first = await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();

      // ⚠️ The pre-mutation reading, and it is a REAL discrimination: two live reads must differ.
      await page.waitForTimeout(900);
      const live = (await composer.hook())!;
      expect(live.pos, 'CALIBRATION: `pos` did not advance between two live reads, so the freeze below is '
        + 'indistinguishable from the engine\'s normal behaviour and this seed proves nothing.')
        .toBeGreaterThan(first.pos);

      // ---- the mutation: replace the accessor with a frozen object, the exact tidier-looking mistake ----
      await page.evaluate(() => {
        const snapshot = JSON.parse(JSON.stringify(
          (window as unknown as { __psss: unknown }).__psss));
        Object.defineProperty(window, '__psss', { value: snapshot, configurable: true, writable: false });
      });

      const a = (await composer.hook())!;
      await page.waitForTimeout(900);
      const b = (await composer.hook())!;
      expect(b.pos, 'CALIBRATION FAIL: the hook was replaced with a FROZEN object and two reads 900 ms apart '
        + 'still differed. Then `hook()` is not reading `window.__psss`, and every before/after comparison in '
        + 'spec 04 is measuring something else.').toBe(a.pos);

      // ⚠️ **AND THE CONSEQUENCE SPELLED OUT: a bypass now reports as having done nothing while the engine
      // really did apply it.** This is the clause that shows spec 04's fourteen bypass comparisons depend on the
      // getter — not on the flag, which the engine sets either way.
      await composer.assertBypassBoxesPresent();
      await composer.setBypass('fx', true);
      const afterBypass = (await composer.hook())!;
      expect(afterBypass.bypassVisualFx, 'CALIBRATION FAIL: a frozen hook reported the NEW flag value, so it is '
        + 'not frozen and the seed did not apply. With a genuinely frozen hook this reads `false` over a live '
        + 'bypass — which is why `installTestHook()` uses a `get` accessor and why "simplifying" it to '
        + '`window.__psss = read()` would make every "did it respond?" clause in this spec pass over a dead '
        + 'engine.').toBe(false);
    });

  /*
   * ⚠️ **SEED 10 OWNS 106e's END-STATE COMPARISON, AND IT IS THE SEED THAT ALREADY EARNED ITS KEEP — IT FAILED
   * A GREEN CLAUSE AND FORCED THE CLAUSE TO CHANGE.** The history, because it is the whole reason 106e no longer
   * measures pixels:
   *
   *   1. 106e compared the picture against a PICKED `mean` tolerance of 8 and failed at 12.
   *   2. A probe measured the null hypothesis: `Aurora Borealis` free-runs 66 → 83 about a base of 70 with **no
   *      bypass click at all** — a span of **17**, larger than the 12 being reported as a drift. So the picked
   *      number was the defect, and the red was `CLAUDE.md`'s named default: the harness accusing the subject.
   *   3. A band DERIVED from that control loop made 106e pass — **and the first version of this seed proved the
   *      pass worthless: FX-off HELD, a genuinely different look, moved `mean` by only 8, INSIDE the band of
   *      17.** Noise strictly exceeds signal, so no tolerance on `mean` can discriminate on this preset.
   *   4. 106e therefore compares the **exported look** instead: exact, tolerance-free, and sensitive to every
   *      authored field rather than the five the hook publishes.
   *
   * ⚠️ **THAT IS THE TRANSFERABLE FINDING: A SEED CAUGHT A CLAUSE THAT PASSED FOR THE WRONG REASON, WHICH NO
   * GREEN RUN CAN DO.** `CLAUDE.md`'s *"a green suite is evidence about the suite"* in its sharpest form — and
   * the reason a derived tolerance is not automatically an honest one.
   *
   * ⚠️ **AND THE MUTATION IS AN AUTHORED-STATE EDIT, NOT A HELD BYPASS — WHICH IS ITSELF A MEASURED CORRECTION.**
   * The first version of this seed held FX-off and demanded the export change. **That was wrong, and 106f is the
   * proof: the export is bypass-INVARIANT BY DESIGN**, because `getSnapshot()` returns the AUTHORED overlay while
   * a box is ticked. A seed asserting the opposite would have demanded the engine break 106f. So the three
   * channels answer three different questions and each needs its own clause:
   *
   *   - *did the box let go?*        → the bypass FLAGS, asserted per cycle inside 106e's loop
   *   - *did the picture survive?*   → `lit > 0`, which is 106d's and 106j's, above the drift floor
   *   - *did the authored look survive?* → the EXPORT, which is what this seed calibrates
   *
   * ⚠️ **THE MUTATION IS THEREFORE A REAL COMPOSER EDIT THROUGH THE DOM — the one thing that MUST move the
   * export.** If it does not, 106e's end-state clause is blind to authored drift and its green means only that
   * the exporter is insensitive.
   */
  test('seed 10 — 106e\'s end-state export comparison can FAIL on a real authored change', async ({
    composer,
  }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aurora Borealis');
    await composer.openComposer();
    await composer.assertBypassBoxesPresent();

    /*
     * ⚠️ **THE PRE-MUTATION READING, THE HALF A SEED MOST OFTEN OMITS** — `CLAUDE.md`: *"Seeds must ASSERT their
     * pre-mutation reading, or a seed that failed to apply reports the clause as discriminating on the strength
     * of nothing having happened."* Two exports with NOTHING touched must be identical, or the comparison 106e
     * relies on is unstable and its green is meaningless.
     */
    const baseExport = ComposerPage.normalisePresetJSON(await composer.exportPresetText());
    expect(baseExport.length, 'CALIBRATION: the export came back empty, so every comparison here is between two '
      + 'empty strings.').toBeGreaterThan(100);
    expect(ComposerPage.normalisePresetJSON(await composer.exportPresetText()),
      'CALIBRATION FAIL: two exports taken back-to-back with NOTHING touched already differ, so 106e\'s '
      + 'end-state clause is measuring export noise — a timestamp, a name suffix or a runtime default — and '
      + 'would fail whatever the bypass did. `normalisePresetJSON` is what must absorb that.').toBe(baseExport);

    /*
     * ── the mutation: a real authored edit, driven through the DOM ─────────────────────────────────
     * ⚠️ **`Body Size X` IS CHOSEN BECAUSE IT IS STORED, NOT DERIVED, AND BECAUSE `Aurora Borealis`'s BODY ROW
     * IS LIVE.** `size` is `am.base`, written straight into `generators.waves`, so the export must carry it. A
     * breathe PERCENT view would have been the wrong choice — `CLAUDE.md`: *"the percent view does NOT
     * round-trip at any precision — it is a VIEW."*
     */
    const before = await composer.rowValues(0);
    const sizeX = Number(before['Body Size X'] ?? '0');
    expect(Number.isFinite(sizeX), 'CALIBRATION: no `Body Size X` reading on this preset\'s Body row, so the '
      + 'mutation below has nothing to change and the clause after it would compare two identical exports.')
      .toBe(true);
    await composer.setField('Body', 'Size', 'X', String(sizeX + 7));

    const afterField = await composer.rowValues(0);
    expect(afterField['Body Size X'], 'CALIBRATION FAIL: the edit did not land in the input, so nothing was '
      + 'authored and the export comparison below would report the clause as discriminating on the strength of '
      + 'nothing having happened.').not.toBe(before['Body Size X']);

    expect(ComposerPage.normalisePresetJSON(await composer.exportPresetText()),
      'CALIBRATION FAIL: `Body Size X` was changed by 7 and the export is STILL byte-identical. Then 106e\'s '
      + 'end-state clause cannot see authored drift at all and its green says only that the exporter is '
      + 'insensitive — not that six tick/untick cycles preserved the look. Either `setWaves()` is not reaching '
      + '`workingPreset` or the exporter is writing a stale copy.').not.toBe(baseExport);
  });

  /*
   * ⚠️ **SEED 11 OWNS PHASE 17.5's WHOLE CONTRIBUTION — THE *"and the figure keeps moving"* CLAUSE — AND IT IS
   * SHIPPED IN THE SAME SITTING AS THOSE CLAUSES, WHICH IS THE RULE.** Phase 5 added nine
   * `assertIntegratorAdvanced()` calls across specs 01, 04 and 06 and NO new spec file (an owner-level decision
   * recorded in the plan: a separate GL spec would re-load the same presets at ~25 s each). Nine clauses with no
   * seed would be nine greens about nothing.
   *
   * ⚠️ **SEED 9 DOES NOT COVER THIS, AND THE DISTINCTION IS THE POINT.** Seed 9 freezes the HOOK — the reading
   * channel — and proves `hook()` re-samples. This seed leaves the hook fully live and stops the ENGINE, which is
   * the defect the Phase 5 clauses actually claim to catch. **A frozen reader and a frozen subject are two
   * defects, and only the second is what invariant 22 cost a whole session.**
   *
   * ⚠️ **THE MUTATION IS STILL A REAL, USER-REACHABLE FROZEN SWEEP — BUT ITS CHANNEL CHANGED ON 2026-09-10 AND
   * THE REPLACEMENT IS THE INTERESTING PART.** The seed used to type `0` into the Composer's `Sweep rate` row; the
   * owner removed that control, so the shortest DOM route to `generators.waveSpeed === 0` is now **Export →
   * edit the JSON → Import**, both of which are shipped Lab header buttons with existing fixture channels
   * (`exportPresetText()`, `importPresetJSON()`). Import ends in `setWorkingPresetExternal` → `preset-changed` →
   * `applyPresetChange` → `initGenerator()`, i.e. **the one apply path** (invariant 23), so the frozen state is
   * produced by the engine exactly as a user's own file would produce it.
   *
   * ⚠️ **THE EDIT IS TO A FILE, NOT TO THE PAGE, AND THAT DISTINCTION IS WHAT KEEPS THIS A LEGITIMATE SEED.**
   * `src/` may not be touched and no runtime object is patched: the JSON the engine itself exported is modified on
   * the way back in, which is a thing any user can do in a text editor. **A `page.evaluate` writing
   * `generators.waveSpeed = 0` on a live preset would be a second apply path and would exercise something no user
   * can reach** — the `?testhook=1` rule, one level out.
   *
   * ⚠️ **A `page.clock`-BASED FREEZE WAS THE TEMPTING ALTERNATIVE AND WOULD STILL BE WRONG**: it stops wall-clock
   * `dt` for the whole page, so it also freezes `elapsedTime` and the canvas — a mutation that trips every clause
   * at once cannot tell which one caught it. ⚠️ **AND `Speed` → 0 IS WRONG FOR THE SAME REASON, WHICH IS WHY THE
   * REMOVED CONTROL HAD TO BE REPLACED RATHER THAN SUBSTITUTED FOR:** `elapsedTime += dt · speedFactor` and
   * `pos += waveSpeed · correction`, so a `speedFactor` of 0 stops BOTH and the seed would become a duplicate of
   * seed 9 (a dead reader) while claiming to catch a dead subject. **Only `waveSpeed` stops one and not the other.**
   *
   * ⚠️ **THE COST IS STATED: THIS SEED IS NOW EXPENSIVE** (an export, a file round trip, a full preset apply and a
   * grid prepend, on top of the two 1 s+ observation windows). It stays because `assertIntegratorAdvanced()` has
   * ten callers across three specs and an uncalibrated helper is ten greens about nothing.
   */
  test('seed 11 — Phase 17.5\'s `assertIntegratorAdvanced()` can FAIL: a live hook over a stopped sweep',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Cylinder');
      await composer.openComposer();

      /*
       * ── the pre-mutation reading: the assertion PASSES on the unmutated page ────────────────────────
       * ⚠️ **WITHOUT THIS THE SEED WOULD PROVE ONLY THAT SOMETHING FAILED, NOT THAT THE FREEZE CAUSED IT.**
       */
      await composer.assertIntegratorAdvanced();

      /*
       * ---- the mutation: a preset whose stored `waveSpeed` is 0, imported through the real dialog ----
       *
       * ⚠️ **THE EXPORT IS READ AND ASSERTED BEFORE IT IS EDITED, because a `replace()` that matches nothing is
       * the silent direction — *a skipped mutation reads exactly like a caught one*.** The key is asserted PRESENT
       * with a non-zero value first, then the substitution is asserted to have CHANGED the text. Without both, an
       * exporter that renamed or omitted the field would leave this seed importing the original figure and
       * reporting the integrator clause as uncalibrated-but-green.
       */
      const exported = await composer.exportPresetText();
      const entryMatch = /"waveSpeed"\s*:\s*([0-9.eE+-]+)/.exec(exported);
      expect(entryMatch, 'CALIBRATION: the exported JSON carries no `waveSpeed` key, so this seed cannot '
        + 'manufacture a frozen sweep and every Phase 17.5 clause stays uncalibrated. Either the exporter stopped '
        + 'writing `generators.waveSpeed` or it was renamed — both need a human.').not.toBeNull();
      const entryRate = Number(entryMatch![1]);
      expect(entryRate, 'CALIBRATION: the exported `waveSpeed` is already 0, so the page was ALREADY frozen and '
        + 'the pre-mutation pass above contradicts it — read that as a defect in this seed, not in the engine.')
        .toBeGreaterThan(0);

      const frozenJson = exported.replace(entryMatch![0], '"waveSpeed": 0');
      expect(frozenJson, 'CALIBRATION FAIL: the substitution changed nothing, so the import below re-applies the '
        + 'ORIGINAL figure and the `rejects.toThrow()` clause would be measuring a live engine.')
        .not.toBe(exported);

      // ⚠️ The name is taken from the helper's RETURN, never assumed: the dialog pre-resolves a duplicate to
      // ` v<n>` before it opens, and a preset name is a primary key in five owners — guessing it here would
      // freeze a tile rather than fail.
      const frozenName = await composer.importPresetJSON(frozenJson, 'seed11-frozen-sweep.json');
      await page.waitForTimeout(700);

      /*
       * ⚠️ **THE HOOK MUST STILL BE LIVE, AND THIS CLAUSE IS WHAT SEPARATES THIS SEED FROM SEED 9.** If the
       * accessor had died, `pos` would also stop advancing and the seed would be catching seed 9's defect while
       * claiming to catch this one. `elapsedTime` is scaled by `speedFactor`, NOT by `waveSpeed`, so it keeps
       * running through a stored sweep rate of 0 — which is exactly the asymmetry that makes it the right witness,
       * and the reason `Speed` → 0 could not have replaced this mutation.
       *
       * ⚠️ **THE IMPORT IS ASSERTED TO HAVE LANDED, VIA THE HOOK'S `presetName`.** `importPresetJSON` confirms the
       * dialog, but nothing about the dialog closing proves the engine adopted the figure — and if it did not, the
       * clauses below run over the ORIGINAL preset and the seed reports the live engine as frozen or, worse, the
       * frozen one as live.
       */
      const t0 = (await composer.hook())!;
      expect(t0.presetName, `CALIBRATION FAIL: the engine is not showing the imported preset (expected `
        + `${JSON.stringify(frozenName)}, hook says ${JSON.stringify(t0.presetName)}). The import did not reach `
        + '`applyPresetChange`, so every clause below is about the ORIGINAL figure.').toBe(frozenName);
      await page.waitForTimeout(900);
      const t1 = (await composer.hook())!;
      expect(t1.elapsedTime, 'CALIBRATION FAIL: `elapsedTime` stopped too, so the whole page is frozen rather '
        + 'than the sweep. Then this seed is a duplicate of seed 9 (a dead reader) and proves nothing about the '
        + 'integrator clause. `elapsedTime` is scaled by `speedFactor` and `pos` by `waveSpeed` — a stored sweep '
        + 'rate of 0 must stop only the second.').toBeGreaterThan(t0.elapsedTime);
      expect(t1.pos, 'CALIBRATION FAIL: the imported figure stores `waveSpeed: 0` and `pos` still advanced, so the '
        + 'mutation did not apply — and *a SKIPPED mutation reads exactly like a caught one*. Nothing below is '
        + 'evidence.').toBeCloseTo(t0.pos, 6);

      /*
       * ── and the clause itself, required to REPORT it ────────────────────────────────────────────────
       * ⚠️ **THE ASSERTION IS INVERTED VIA `rejects`, WHICH IS THE ONLY HONEST SHAPE HERE**: the seed's claim is
       * *"the shipped helper goes red on this state"*, so it must run the SHIPPED helper rather than a re-derived
       * copy of its predicate. A hand-rolled `expect(b.pos).toBe(a.pos)` would calibrate a clause this suite does
       * not contain — the fourth-enumeration defect in miniature.
       */
      await expect(composer.assertIntegratorAdvanced(1000),
        'CALIBRATION FAIL: `assertIntegratorAdvanced()` PASSED over a sweep frozen at a stored `waveSpeed` of 0. '
        + 'Then all nine Phase 17.5 clauses in specs 01, 04 and 06 are green about nothing, and the *"the figure '
        + 'keeps moving"* half of steps 11, 62, 63, 106b, 106d, 106e, 106j, 106k, 106l and 106m is unmeasured — '
        + 'which is the state Phase 2 was approved to end.').rejects.toThrow();

      /*
       * ⚠️ **AND THE RESTORE, ASSERTED — because a seed that leaves the page frozen would hand the NEXT test in
       * this file a dead engine and blame it for the failure.** Nothing persists between tests (a fresh page per
       * test, no `localStorage` in `src/`), so this is belt-and-braces; it is also the clause that proves the
       * frozen state was reversible, i.e. that the seed manufactured a state and did not break something.
       *
       * ⚠️ **THE RESTORE IS NOW A PRESET LOAD RATHER THAN AN UNDO OF THE EDIT, AND THAT IS A REAL DIFFERENCE
       * WORTH STATING: the frozen preset REMAINS IN THE LIBRARY for the rest of this test.** Nothing else in this
       * file loads by that name, and the page is fresh per test, so it cannot leak — but a future test that
       * enumerates library tiles will see it, and *"a preset name is a primary key in five owners"* is why that is
       * recorded here rather than left to be discovered.
       */
      await composer.loadPreset('Cylinder');
      await page.waitForTimeout(600);
      await composer.assertIntegratorAdvanced();
    });

  /*
   * ⚠️ **SEEDS 12–14 CALIBRATE THE FOUR FIXTURE CHANNELS THE OWNER'S 2026-09-10 CHANGES ADDED, AND THEY SHIP IN
   * THE SAME SITTING AS THE SPEC THAT USES THEM — the rule, not a preference.** New channels:
   * `assertFramingRowsPresent()`, `framingSlider`/`framingValue`, `rotationSlider`, `mirrorBox`, `isBypassed()`
   * and `vfxRotationReadouts()`.
   *
   * ⚠️ **THE UNIT IS THE FIXTURE CHANNEL, NOT THE STEP NUMBER** — `CLAUDE.md`'s seed-coverage rule, learned when a
   * step-number join reported gaps that were pure artefact. Classified: `assertFramingRowsPresent` is
   * self-asserting (seed 12 tests that its assertion is reachable), `framingSlider`/`rotationSlider`/`mirrorBox`
   * are **bare locators** and therefore exactly where a false pass lives (seeds 12 and 13),
   * `vfxRotationReadouts` self-asserts a count of 3 (seed 13), and `isBypassed` is a **derived boolean over an
   * inversion** — the highest-risk shape in the set, because it is right or wrong with no symptom (seed 14).
   *
   * ⚠️ **NOTE WHAT IS *NOT* SEEDED AND WHY: `setFramingPosition`'s two-event dispatch.** A seed for it would have
   * to remove one listener from a shipped element, and `src/` may not be touched — so the property is stated at
   * the helper instead and 106a-i's per-quantity clauses are what would notice a half-driven control. **A stated
   * gap, not a silent one.**
   */
  test('seeds 12–14 — the framing channels, the Rotation axis channel and `isBypassed()` can all FAIL',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();

      /* ── seed 12 · the framing section's own calibration and the row locators ────────────────────
       * ⚠️ **`assertFramingRowsPresent()` IS THE GUARD EVERY FRAMING CLAUSE STANDS ON, AND ITS FAILURE MODE IS THE
       * ONE THIS PROJECT RECORDS MOST: an empty locator satisfies every absence and equality clause written over
       * it.** The mutation renames one row's label — the mistake a reader transcribing an old document makes, and
       * the one that fails SILENTLY, exactly as seed 1's did.
       *
       * ⚠️ **RENAMING RATHER THAN REMOVING, ON PURPOSE.** A removed row makes `framingSlider(...).evaluate()` time
       * out and accuse the engine; a renamed one resolves to nothing and reports green. Only the second needs a
       * guard, which is the same argument seed 1 makes about a control versus its label.
       */
      await composer.assertFramingRowsPresent();
      const scaleRow = page.locator(SEL.framingRow('Figure Scale'));
      await expect(scaleRow, 'CALIBRATION: the `Figure Scale` row does not resolve to exactly one element, so '
        + 'the mutation below has no subject.').toHaveCount(1);
      // ⚠️ Addressed through the ROW, whose selector the mutation does not invalidate — seed 1's rule.
      await scaleRow.locator('.sl-vfx-label').evaluate((el) => { el.textContent = 'Figure Size'; });
      await expect(page.locator(SEL.framingRow('Figure Scale')), 'CALIBRATION: the label rename did not land, so '
        + 'nothing below is evidence.').toHaveCount(0);

      let framingGuardFailed = false;
      try { await composer.assertFramingRowsPresent(); } catch { framingGuardFailed = true; }
      expect(framingGuardFailed, 'CALIBRATION FAIL: one framing row\'s label was renamed and '
        + '`assertFramingRowsPresent()` still passed. Then `framingSlider(label)` can resolve to NOTHING while '
        + 'every clause reading it reports green — and 106a-i\'s per-quantity clauses would be comparing two '
        + 'absent reads, which are equal.').toBe(true);

      /* ⚠️ **AND THE OTHER HALF, WHICH IS THE POINT: THE BARE LOCATOR ITSELF GOES QUIET.** `framingValue` returns
       * a locator with no assertion of its own, so this is what a false pass would look like from inside a
       * clause. Restored immediately afterwards. */
      expect(await composer.framingValue('Figure Scale').count(), 'CALIBRATION FAIL: `framingValue` still '
        + 'resolves after its row label was renamed, so the locator is not actually label-bound and the guard '
        + 'above is guarding nothing.').toBe(0);
      await page.locator(`${SEL.framingSection} .sl-vfx-label`).first()
        .evaluate((el) => { el.textContent = 'Figure Scale'; });
      await composer.assertFramingRowsPresent();

      /* ── seed 13 · the Rotation axis channel, and the cross-surface readout ──────────────────────
       * ⚠️ **THIS IS THE THREE-PLANE SEED (invariant 29), AND THE DEFECT IT MANUFACTURES IS A PERMUTATION OF THE
       * AXES — the one thing an `nth()`-based locator cannot see and an `aria-label` one can.** The handles are
       * visually and structurally identical, so a swap is invisible on screen; `rotationSlider` selects by
       * accessible name precisely so this seed can exist.
       */
      /*
       * ⚠️ **THE PRE-STATE IS READ THROUGH A TAB SWITCH, AND THE FIRST DRAFT WAS RED FOR WANT OF ONE — FOUND BY
       * RUNNING THIS SEED FOR THE FIRST TIME (2026-09-10; it was written the day before and never executed, so it
       * discharged nothing whatever colour it would have reported).** `TabRegistry` creates a tab's container
       * LAZILY, on first show (`exploration/tab-module.ts:47`, `:99`) — so before any `openTab('visual-fx')` the
       * pane does not exist and `SEL.tabPane('visual-fx')` matches NOTHING. The failure arrived as
       * *"Visual FX has no single row labelled `Rotation`"*, which is `CLAUDE.md`'s *"a harness failure accuses the
       * SUBJECT by default"*: the row is built correctly and the tab had simply never been opened. **106a-i reads
       * the same channel and was green because it switches first** — it is the only reason that step passed, and
       * the reason is stated at `vfxRotationReadouts()` for the DRIFT it prevents, not for the pane's existence.
       *
       * ⚠️ **AND THE SWITCH IS NOT ONLY ABOUT EXISTENCE: no framing setter calls `notifyExternalChange()`, so the
       * Visual FX handles move solely because `activate()` re-reads.** The post-state read therefore has to go
       * through the SAME switch — a pre-state taken without one would compare a build-time string against a
       * re-synced one and read the difference as the seed's own evidence.
       */
      await composer.openTab('visual-fx');
      const before13 = await composer.vfxRotationReadouts();
      await composer.openComposer();
      expect(before13, 'CALIBRATION: `vfxRotationReadouts()` must return three strings before anything is '
        + 'mutated — an oracle for a three-axis subject must read all three planes.').toHaveLength(3);
      for (const axis of ['X', 'Y', 'Z'] as const) {
        await expect(composer.rotationSlider(axis), `CALIBRATION: no Composer Rotation ${axis} handle, so the `
          + 'permutation below cannot be manufactured and 106a-i\'s per-axis clauses are reading nothing.')
          .toHaveCount(1);
      }
      // The mutation: swap the X and Y `aria-label`s. Both handles still exist and both still work — only their
      // NAMES lie, which is the defect a positional locator ships by construction.
      await page.locator(SEL.framingSection).evaluate((sec) => {
        const x = sec.querySelector('input[aria-label="Rotation X"]');
        const y = sec.querySelector('input[aria-label="Rotation Y"]');
        if (!x || !y) return;
        x.setAttribute('aria-label', 'Rotation Y');
        y.setAttribute('aria-label', 'Rotation X');
      });
      /*
       * ⚠️ **THE OBSERVABLE IS THAT DRIVING `Y` NOW MOVES THE X READOUT — asserted through Visual FX's own row,
       * which is the same channel 106a-i uses.** A clause reading the Composer's own readout could not see this:
       * the handle whose label says `Y` faithfully updates the cell it sits in, so the LOCAL view is
       * self-consistent and only the cross-surface read exposes which engine axis actually moved.
       */
      await composer.setRotationPosition('Y', 0.85);
      await composer.openTab('visual-fx');
      const after13 = await composer.vfxRotationReadouts();
      await composer.openComposer();
      expect(after13[0], 'CALIBRATION FAIL: with the X and Y `aria-label`s SWAPPED, driving "Y" left Visual FX\'s '
        + 'X readout unchanged — so either the labels are not what `rotationSlider` selects on, or the '
        + 'cross-surface read cannot see which axis moved. Both make 106a-i\'s per-axis clauses vacuous, and a '
        + 'positional locator would ship this defect permanently.').not.toBe(before13[0]);
      // ⚠️ Restored by the MUTATED name, not the real one — seed 1's rule, and here both names exist so the
      // wrong order would silently swap them back to the mutated state.
      await page.locator(SEL.framingSection).evaluate((sec) => {
        const inputs = [...sec.querySelectorAll('input[aria-label^="Rotation "]')];
        // DOM order is X, Y, Z by construction (`framingTripletRow` appends in axis order), and that is the one
        // fact the label swap did NOT change — which is why the restore reads position and the seed does not.
        (['X', 'Y', 'Z'] as const).forEach((a, i) => inputs[i]?.setAttribute('aria-label', `Rotation ${a}`));
      });
      for (const axis of ['X', 'Y', 'Z'] as const) {
        await expect(composer.rotationSlider(axis),
          `CALIBRATION: the ${axis} label did not restore, so seed 14 runs on a mutated surface.`).toHaveCount(1);
      }

      /* ── seed 14 · `isBypassed()`'s inversion ────────────────────────────────────────────────────
       * ⚠️ **THE HIGHEST-RISK CHANNEL IN THE SET, AND THE REASON IS THE SHAPE RATHER THAN THE CODE: A DERIVED
       * BOOLEAN OVER AN INVERSION IS RIGHT OR WRONG WITH NO SYMPTOM EITHER WAY.** The engine flag is a BYPASS and
       * the box says APPLY, so exactly one `!` stands between them — and a helper that dropped it would report
       * every bypass state backwards while every clause using it stayed green in form. Ten clauses in spec 04
       * read through this one method for exactly that reason.
       *
       * ⚠️ **THE MUTATION IS NOT A DOM WRITE BUT A REAL CLICK, BECAUSE THE PROPERTY IS AGREEMENT WITH THE
       * ENGINE.** `?testhook=1` publishes `bypassVisualFx` directly, so this seed can assert the helper against
       * the ONE source of truth in both states — which is the only thing that pins the polarity rather than
       * restating it.
       */
      const h0 = (await composer.hook())!;
      expect(h0.bypassVisualFx, 'CALIBRATION: the engine already holds the FX bypass at load. Nothing persists '
        + 'these flags, so this contradicts 106a and the seed below cannot establish the OFF state.').toBe(false);
      expect(await composer.isBypassed('fx'), 'CALIBRATION FAIL: `isBypassed()` disagrees with the engine in the '
        + 'DEFAULT state. It is the inversion of a ticked box, and if it is wrong here it is wrong in all ten of '
        + 'spec 04\'s clauses — in the direction that reports every bypass state backwards.').toBe(false);

      await composer.setBypass('fx', true);
      const h1 = (await composer.hook())!;
      expect(h1.bypassVisualFx, 'CALIBRATION FAIL: `setBypass(which, true)` did not reach the engine. ⚠️ Its `on` '
        + 'parameter kept the BYPASS sense through the 2026-09-10 rename and the inversion lives in the swapped '
        + '`check()`/`uncheck()` call — re-pointing the parameter at the BOX instead would have inverted every '
        + 'existing call site with no assertion able to catch it.').toBe(true);
      expect(await composer.isBypassed('fx'), 'CALIBRATION FAIL: `isBypassed()` reports FALSE over an engine that '
        + 'holds the bypass. The helper and the flag disagree, which is the one surface on screen lying about the '
        + 'picture — and it is invisible to any clause that reads only one of them.').toBe(true);
      // ⚠️ **AND THE BOX ITSELF, IN THE OPPOSITE DIRECTION: bypassed ⇒ UNticked.** Without this the two clauses
      // above would both be satisfied by a helper that ignored the DOM entirely and re-read the hook.
      await expect(composer.bypassBox('fx'), 'CALIBRATION FAIL: the box is still ticked over a bypassed engine, '
        + 'so `isBypassed()` cannot be reading the checkbox — it would be a second copy of the hook, and spec '
        + '04\'s ten clauses would be asserting the engine against itself.').not.toBeChecked();
      await composer.setBypass('fx', false);
      expect(await composer.isBypassed('fx'), 'CALIBRATION: the release did not take.').toBe(false);
    });
});
