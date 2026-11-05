import {
  test, expect, SEL, BYPASS_LABELS, VIEW_SECTION_TITLE, FRAMING_SECTION_TITLE, FRAMING_ROW_LABELS,
  FLAT_PANE_CAPTION, PLANE_CAPTIONS, ComposerPage,
} from './composer-fixture.ts';

/*
 * ============================================================================================
 * Phase 17.6 — §A13 / §B13 (106a–106n) and §A14 (107a–107i): E109, E110 and E111.
 * ============================================================================================
 *
 * ⚠️ **THIS FILE IS THE ONLY INSTRUMENT THAT WILL EVER MEASURE E109–E111, AND THAT IS WHY PHASE 6 WAS BUILT
 * BEFORE PHASES 3, 4 AND 5.** `composercheck` is 243 assertions over SEVENTEEN sections, §A–§Q, and **every one
 * of them stops at 16.17.** The two bypass switches, the repeated Speed slider and the two readouts have `tsc`,
 * `vite build` and nine text greps behind them and **nothing whatsoever that measures behaviour.** Everywhere
 * else in this suite an automated spec is a SECOND instrument over a subject that already has one; here it is
 * the first. `CLAUDE.md` states the gap by name: *"E109–E111 (16.18–16.20) shipped with NO section, so nothing
 * measures the preview bypasses, the repeated Speed slider or the two readouts."*
 *
 * ⚠️ **AND THE DEPENDENCY RUNS THE OPPOSITE WAY TO THE PHASE NUMBERING, WHICH IS THE SECOND REASON.** Phase 1's
 * fixture reached slots, readouts, fields, notices and the level checkbox — i.e. exactly the subjects Phases 3–5
 * need — and had **no selector at all** for the bypass boxes, the Speed slider, the pane flat caption or
 * Export/Snapshot. The 23 steps with no checker behind them were also the 23 the harness could not reach. This
 * phase widens `composer-fixture.ts`; the later phases inherit the widening.
 *
 * ⚠️ **THE HIGHEST-VALUE THING THE RECONNAISSANCE PASS FOUND IS A HARNESS DEFECT THAT WOULD HAVE BEEN INVISIBLE:
 * THE TWO CHECKBOX LABELS SHIP WITH A TYPOGRAPHIC APOSTROPHE (U+2019).** `composer.ts` writes
 * `'Don’t apply Visual FX'`, and the same string is the `aria-label` these specs select on. The test plan's own
 * steps render them with an ASCII `'`. **A selector transcribed from the document matches NOTHING — and
 * `CLAUDE.md`'s rule for that is unambiguous: "an absence test over an empty corpus reports PASS."** So
 * `BYPASS_LABELS` holds the spelling once and `assertBypassBoxesPresent()` asserts both boxes resolve to exactly
 * one element before any clause touches them. **A constant can be wrong; an up-front count assertion cannot be
 * wrong quietly.**
 *
 * ⚠️ **EVERY MEASURED CLAIM 106a–107i MAKES WAS RE-DERIVED AGAINST THE SHIPPED LIBRARY BEFORE THIS FILE WAS
 * WRITTEN, AND ALL OF THEM STILL HOLD.** That matters because this document's own recorded failure mode is *"a
 * rewrite corrected expected STRINGS and never asked which controls had ceased to exist."* It also required
 * resolving presets the way `main.ts` does: **a refined TS entry REPLACES a legacy JSON key by name**, and a
 * legacy-only probe reports `Aliens DNA` as `star` with no material where the SHIPPED value is `blend` with the
 * Translation Map ON — which is precisely what 106b tests. A probe that stopped at the JSON would have
 * "corrected" a correct step.
 *
 * ⚠️ **STEP NUMBERS ARE CITED VERBATIM AND ARE NEVER RENUMBERED** — `TESTPLAN-phase16-composer.md`'s rule
 * applies to automation exactly as it applies to a deleted control: *"steps 1–7 passed"* must keep meaning what
 * it meant.
 *
 * ⚠️ **AND THE COST IS STATED, BECAUSE `CLAUDE.md` FORBIDS A SILENT CAP: ONE PRESET LOAD IS ~25 s** (360 tiles,
 * 360 live canvases, CPU-rasterised). So steps that describe ONE screen at ONE instant are grouped into a single
 * `test()` per preset, and the trade is that a failure names the group. A step that MUTATES state between
 * assertions is never grouped that way.
 */

/* ------------------------------------------------------------------------------------------------------------
 * §A13 / §B13 — the `Preview only` section: both bypass switches (E109) and the Speed slider (E110)
 * ---------------------------------------------------------------------------------------------------------- */

test.describe('§A13/§B13 · The `Preview only` section — steps 106a–106n', () => {
  /*
   * ⚠️ **106a IS THE SECTION'S OWN TITLE, AND THE TEST PLAN CALLS IT AN ASSERTION RATHER THAN A LABEL — CORRECTLY.**
   * Everything else on the tab edits the figure; nothing in this section is exported, snapshotted or
   * interpolated. That is the **exact opposite** of 16.17's level checkboxes, which sit a few rows below, look
   * the same, and DO persist. Two checkbox families with opposite persistence semantics on one tab is the hazard
   * the title exists to answer, so the string is load-bearing.
   *
   * ⚠️ **REWRITTEN 2026-09-10 FOR THE OWNER'S THREE COMPOSER-UI CHANGES, AND THE STEP'S SUBJECT SPLIT IN TWO.**
   * The framing controls became SAVED (*"you can change from preview only mode for those controls to the same
   * mode like in Visual Fx"*), so they moved out of this section into a `Framing & Timing` one ABOVE it — and the
   * two bypass switches were renamed and RE-POLARISED (`Apply Visual FX` / `Apply Materials`, ticked by default).
   * **Three of this step's old clauses therefore asserted the exact opposite of the shipped behaviour**, which is
   * the direction that fails loudly; a fourth — the row-order clause — read `.sl-section-title` FIRST-MATCH and
   * would have silently changed subject to the new section. **A position clause cannot see an insertion.**
   *
   * ⚠️ **AND THE TICKED DEFAULT IS NOW THE OTHER HALF: NOTHING PERSISTS THESE FLAGS, SO AN UNTICKED BOX ON LOAD IS
   * A DEFECT** — the inverse of what this step asserted for two phases. E109 argued for the unticked polarity
   * (making the abnormal state the visible one); **the owner reversed it, and the clause follows the owner.**
   */
  /*
   * ⚠️ **IT BOOTS WITH THE HOOK SINCE 2026-09-10, AND THE REASON IS A CONTROL THAT NO LONGER EXISTS.** The owner
   * removed the Composer's `Symmetry` row (*"this one is not needed on the Composer tab"*), which was the tab's
   * ONLY readout of the live fold — and the `Mirror` clause below branches on that fold, because either answer is
   * correct depending on the preset. With the readout gone the discriminator has to come from the engine, so this
   * step reads it through `?testhook=1` rather than pinning one branch. **Pinning `hidden` would have been shorter
   * and would have passed on this preset while asserting the PRESET instead of the control.**
   */
  test('step 106a — both sections exist, every unconditional framing row is present, and BOTH `Apply` boxes open '
    + 'TICKED with no notice', async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      await composer.assertEngineDrew();

      // ⚠️ The calibrations first: if the labels or the section do not resolve, everything below is asserting
      // over nothing. Both helpers assert an exact count of 1, never a truthiness.
      await composer.assertBypassBoxesPresent();
      await composer.assertFramingRowsPresent();

      /*
       * ⚠️ **SCOPED TO `tabPane('composer')`, NOT TO `SEL.tabContent`, AND THAT WAS A CORRECTION.**
       * `.sl-section-title` and `.sl-vfx-label` are SHARED with Visual FX, and `TabRegistry` leaves every
       * initialised tab's container inside the one `.sl-tab-content`, hidden by `display` and never detached. So
       * a `.sl-tab-content`-scoped read collects Visual FX's section titles too the moment that tab has been
       * visited — and `toContain` over a longer list is the direction that stays GREEN. See `SEL.tabPane`.
       *
       * ⚠️ **BOTH TITLES ARE ASSERTED, AND `Framing & Timing` IS ALSO VISUAL FX'S OWN SECTION TITLE** — which is
       * exactly why this read is pane-scoped and why the section LOCATORS in the fixture are too. Unscoped, the
       * framing clause would pass on Visual FX's section while the Composer's was missing entirely.
       */
      const composerPane = SEL.tabPane('composer');
      const titles = await composer.page.locator(`${composerPane} ${SEL.viewSectionTitle}`).allTextContents();
      expect(titles, `no section titled ${JSON.stringify(VIEW_SECTION_TITLE)}. This string is the ONLY place on `
        + 'the tab where the two bypass switches\' non-persistence is stated, and 16.17\'s level checkboxes — '
        + 'which DO persist — sit a few rows below looking identical.').toContain(VIEW_SECTION_TITLE);
      expect(titles, `no section titled ${JSON.stringify(FRAMING_SECTION_TITLE)}. The framing controls became `
        + 'SAVED on 2026-09-10 and had to leave the `Preview only` section with that change — leaving them under '
        + 'a heading that says "not saved with the figure" would make the tab\'s one persistence claim the wrong '
        + 'one.').toContain(FRAMING_SECTION_TITLE);

      /*
       * ⚠️ **THE ORDER IS PART OF THE STEP.** A permutation is invisible to a set-membership claim, which
       * `CLAUDE.md` records as a real defect on this very tab.
       *
       * ⚠️ **THE SECTION IS PINNED BY ITS TITLE *TEXT*, NOT BY `.sl-section-title` ALONE — MEASURED, AND THE BARE
       * CLASS WAS PASSING BY LUCK.** `.sl-section:has(.sl-section-title)` resolved to **10** sections when this was
       * measured: the MIXER's four titled sections are still in the DOM (the Lab's tabs
       * are hidden by `display`, not removed), plus `Shape`, three slots and `Figure-wide`. ⚠️ **`Figure-wide` was
       * deleted with its one row on 2026-09-10, so that figure is now one lower — and it is left here as the DATED
       * MEASUREMENT it was rather than decremented, because the point it makes does not depend on the count and
       * arithmetic on a quoted figure is how a basis goes wrong.** ⚠️ **The Mixer's four were named here as
       * `Deck A`/`Deck B`/`Crossfader`/`Category Locks` until 2026-10-05, when v8 23.5 retitled the fourth to
       * `Categories` and gave it the per-category faders. Still four, still unasserted — the titles are now
       * named by COUNT rather than quoted, because prose that quotes shipped copy goes stale silently.** This
       * clause was green only because none of the
       * other sections happens to contain a `.sl-vfx-label`; **the same selector used for a DOM MUTATION in
       * seed 2 silently hit an empty list**, which is how it was found. Scoping to the one section makes the
       * clause's subject its stated one, and it can no longer be broken by an unrelated tab gaining a row.
       *
       * ⚠️ **`Mirror`'s ROW IS `display: none` AT SYMMETRY FOLD 1 — but its LABEL is in the DOM regardless, so
       * `allTextContents()` returns every entry including that one.** The comparison is therefore against the whole
       * list, and `Mirror`'s VISIBILITY is a separate clause below, against the live fold.
       *
       * ⚠️ **`Symmetry` WAS THE FIFTH LABEL UNTIL 2026-09-10 AND THE LIST IS NOW FIVE (the owner removed that row
       * from this tab; Visual FX keeps its own).** The expectation is `FRAMING_ROW_LABELS` and not a literal, so
       * this clause followed the constant — but the MESSAGE named the six labels in prose and would have gone on
       * naming a control the tab no longer has, which is `CLAUDE.md`'s *"a step quoting retired copy converts a
       * regression into a PASS"* reaching a failure message rather than an assertion.
       */
      const framingLabels = await composer.page.locator(
        `${SEL.framingSection} .sl-vfx-label`).allTextContents();
      expect(framingLabels, 'the framing section must repeat Visual FX\'s rows IN ITS OWN ORDER — Figure Scale, '
        + 'Speed, Particle Number, Rotation, Mirror. A set-membership check cannot see a permutation, and the '
        + 'owner asked for "the full set of controls", minus the `Symmetry` row removed on 2026-09-10.')
        .toEqual([...FRAMING_ROW_LABELS]);
      // ⚠️ **AND THE REMOVED ROW MUST BE GONE, ASSERTED IN ITS OWN RIGHT — the clause above compares against a
      // constant, so re-adding the row AND the constant entry together would leave it green.** This is the
      // *"assert old names are GONE, not merely renamed"* rule; Visual FX's row is out of scope and untouched.
      await expect(composer.page.locator(SEL.framingRow('Symmetry')),
        'the Composer still has a `Symmetry` framing row. The owner removed it on 2026-09-10 — Visual FX keeps '
        + 'its own, and that surface is where the fold is set.').toHaveCount(0);

      /*
       * ⚠️ **`Mirror` IS ASSERTED AGAINST THE LIVE FOLD RATHER THAN AGAINST A CONSTANT, because either answer is
       * correct depending on the preset** — and a clause that picked one would be asserting the preset, not the
       * control. Visual FX hides this row at fold 1 (`syncVisibility()`); the Composer mirrors that, and
       * *"meaningless"* is not *"cannot be applied"*, which is why it is HIDDEN rather than greyed.
       *
       * ⚠️ **THE FOLD IS READ FROM THE ENGINE AND NO LONGER FROM THE TAB, BECAUSE THE ROW THAT PRINTED IT IS THE
       * ONE THAT WAS REMOVED.** The old form read `framingValue('Symmetry')` and compared it to `'Off'` — after
       * the removal that locator resolves to nothing and `textContent()` REJECTS, so the step would have failed
       * naming the Mirror row, accusing a control that is working. `symmetryFold` is a hook field already.
       */
      const foldValue = (await composer.hook())!.symmetryFold;
      const mirrorRow = composer.page.locator(SEL.framingRow('Mirror'));
      if (foldValue <= 1) {
        await expect(mirrorRow, 'the Mirror row is visible at fold 1, where mirroring is meaningless — Visual FX '
          + 'hides it there and the two surfaces must agree.').toBeHidden();
      } else {
        await expect(mirrorRow, `the Mirror row is hidden at fold ${foldValue}, where it does something.`)
          .toBeVisible();
      }

      /*
       * ⚠️ **BOTH BOXES OPEN TICKED, WHICH IS THE OWNER'S POLARITY AND THE INVERSE OF WHAT THIS CLAUSE SAID FOR
       * TWO PHASES.** The engine flag is still a BYPASS and still defaults to `false`; the box shows APPLY, so a
       * default `false` paints as ticked. **Read through `isBypassed()` and not off `checked`** — the two are
       * opposite now, and a clause asserting `checked` directly is right or wrong with no symptom either way.
       */
      expect(await composer.isBypassed('fx'), 'a bundle arrived BYPASSED. Nothing persists these flags, so an '
        + 'unticked `Apply` box on load means something is writing them at init.').toBe(false);
      expect(await composer.isBypassed('materials')).toBe(false);
      // The DOM half of the same fact, stated once, so a future polarity change fails HERE and names itself.
      await expect(composer.bypassBox('fx'), 'the `Apply Visual FX` box must arrive TICKED — that is the owner\'s '
        + '2026-09-10 polarity, and the label reads as a double negative in the other direction.').toBeChecked();
      await expect(composer.bypassBox('materials')).toBeChecked();

      /*
       * ⚠️ **THE TWO SWITCHES SHARE ONE ROW (the owner: *"on the same row to save space"*), AND THE CAPTIONS MOVED
       * OUT OF `.sl-vfx-label` TO GET THERE.** That column is a fixed 56 px and cannot hold two captions, so the
       * row ships with none and each box carries its own `.sl-composer-bypass-cap`. **The old clause read
       * `.sl-vfx-label` inside this section and would now return an EMPTY LIST** — `toEqual([...])` against an
       * empty array is the one comparison shape that can report a vacuous read as a mismatch OR as a pass
       * depending on the expectation, which is why the count is asserted separately below.
       *
       * ⚠️ **ORDER, NOT MEMBERSHIP: `Apply Visual FX` FIRST.** A permutation is invisible to a set clause, and
       * here it is worse than cosmetic — the two boxes are visually identical and 22 px apart, so a swap makes
       * every user's next click turn off the other bundle.
       */
      const caps = composer.page.locator(`${SEL.previewSection} .sl-composer-bypass-cap`);
      await expect(caps, 'the two `Apply` captions are not both in the `Preview only` section — one row, two '
        + 'captions, and they are what tells the boxes apart.').toHaveCount(2);
      expect(await caps.allTextContents(), 'the two switch captions must read Visual FX then Materials, IN THAT '
        + 'ORDER. They sit 22 px apart on one row and look identical, so a permutation silently re-points every '
        + 'click.').toEqual([BYPASS_LABELS.fx, BYPASS_LABELS.materials]);
      // ⚠️ ONE row, asserted as one: the owner's request was to save space, and two rows would satisfy every
      // clause above.
      await expect(composer.page.locator(`${SEL.previewSection} .sl-composer-bypass-row`),
        'the two switches are not on a single shared row — that was the request, and nothing else here can see '
        + 'it.').toHaveCount(1);

      // ⚠️ The notice is ALWAYS in the DOM and toggled by `display` — assert VISIBILITY, never `count()`.
      await expect(composer.notice('bypass'), 'the consequence notice is visible with both bundles applied. It is '
        + 'gated on `anyBypass`, and an always-visible alarm is an alarm nobody reads.').toBeHidden();
    });

  /*
   * ⚠️ **106a-i — A NEW STEP FOR THE 2026-09-10 CHANGE, LETTERED RATHER THAN RENUMBERED** (the test plan's rule:
   * insertions are lettered and never renumbered, so *"106a passed"* keeps meaning what it meant).
   *
   * ⚠️ **IT MEASURES THE ONE PROPERTY THE OWNER ACTUALLY ASKED FOR AND NO OTHER CLAUSE COVERS:** *"the controls
   * shall be connected to exactly the same settings values as in the Visual Fx tab and the preview shall react
   * according to settings changes."* 106a asserts the rows EXIST; this asserts each one reaches the engine and
   * the canvas. **Existence and effect are two properties, and invariant 13 is the whole of this file's subject.**
   *
   * ⚠️ **DRIVEN THROUGH THE DOM, NEVER THROUGH THE SETTERS** (Phase 2's rule) — and via the same
   * `input` + `change` pair `dragSpeedTo` documents, because the two handlers do different things: `input` sets
   * the value, `change` is the release-time read-back guard.
   *
   * ⚠️ **`particleCount` AND `rotationSpeed` ARE READ FROM `generators`, NOT FROM `overlay`** — they are the two
   * framing values that live in the preset body (invariant 17: one source, not two). The hook publishes the
   * resolved readings, so the spec does not have to know which is which; it is stated because a future clause
   * reaching for `overlay.particleCount` would find `undefined` and read it as inert.
   */
  test('step 106a-i — every framing control reaches the ENGINE and the canvas, and each one moves ITS OWN value',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      await composer.assertFramingRowsPresent();

      const before = (await composer.hook())!;
      expect(before.presetName, 'the preset did not become the applied one.').toBe('Aliens DNA');

      /*
       * ⚠️ **A POSITION AWAY FROM THE CURRENT ONE IS NOT ENOUGH — IT MUST BE AWAY FROM THE TRACK'S FIXED POINT
       * TOO.** `Figure Scale` maps position 0.5 to exactly 1.0×, and a preset already at 1.0× would then have
       * this clause set the value it already holds and report *"the control moved nothing"* over a working
       * slider. Both targets below are deliberately off-centre.
       */
      const scaleBefore = before.figureScale;
      await composer.setFramingPosition('Figure Scale', 0.75);
      const afterScale = (await composer.hook())!;
      expect(afterScale.figureScale, 'the Figure Scale slider did not reach `setFigureScale` — it is the row the '
        + 'owner named first ("the visual size").').not.toBeCloseTo(scaleBefore, 4);
      // ⚠️ Nothing ELSE may move: seven controls over five engine values is where a copy-paste error hides, and
      // every one of them is a plausible `number` to `tsc`.
      expect(afterScale.speedFactor, 'Figure Scale moved the SPEED — the two rows share a factory and their '
        + 'setters are one line apart.').toBeCloseTo(before.speedFactor, 6);
      expect(afterScale.particleCount, 'Figure Scale moved the particle count.').toBe(before.particleCount);

      const countBefore = afterScale.particleCount;
      await composer.setFramingPosition('Particle Number', 0.35);
      const afterCount = (await composer.hook())!;
      expect(afterCount.particleCount, 'the Particle Number slider did not reach `setParticleCount` — the owner '
        + 'named it explicitly ("the number of particles").').not.toBe(countBefore);
      expect(afterCount.figureScale, 'Particle Number moved the figure scale.')
        .toBeCloseTo(afterScale.figureScale, 6);

      /*
       * ⚠️ **THE ROTATION TRIPLET IS THE CLAUSE THAT NEEDS ALL THREE AXES (invariant 29), AND ONE HANDLE MUST
       * MOVE ONE AXIS.** `setRotationSpeed(axis, v)` reads the live triple, replaces one member and writes it
       * back, so a handle wiring all three would re-assert two stale values — and a single-axis assertion cannot
       * see that. Drive Y; assert X and Z are untouched.
       *
       * ⚠️ **READ THROUGH VISUAL FX'S OWN READOUTS, NOT THROUGH THE HOOK — `rotationSpeed` IS NOT A HOOK FIELD AND
       * WAS NOT MADE ONE.** `CLAUDE.md` forbids adding to `src/` for the harness, and this quantity does not need
       * it: Visual FX's triplet re-reads `getRotationSpeed()` on `activate()`. **The second surface is the
       * STRONGER oracle here**, because the owner asked for *"exactly the same settings values as in the Visual Fx
       * tab"* — a hook read could only show the Composer reached some engine value, while this shows the two
       * surfaces agree.
       *
       * ⚠️ **AND IT ONLY WORKS BECAUSE OF THE TAB SWITCH.** No framing setter calls `notifyExternalChange()`
       * (E110's one-way staleness, which generalises to all seven), so the Visual FX handles move solely because
       * `openTab` re-syncs them. Reading them without switching would read a stale build-time string and be
       * unable to distinguish that from an unwired control — which is why the pre-state is captured through the
       * SAME switch, not before the Composer was opened.
       */
      await composer.openTab('visual-fx');
      const rotBefore = await composer.vfxRotationReadouts();
      await composer.openComposer();
      await composer.setRotationPosition('Y', 0.8);
      await composer.openTab('visual-fx');
      const rotAfter = await composer.vfxRotationReadouts();
      expect(rotAfter[1], 'the Composer\'s Rotation Y handle did not reach the engine value Visual FX displays — '
        + 'the owner asked for exactly the same settings values, and this is the only clause that can say the two '
        + `surfaces disagree. Before ${JSON.stringify(rotBefore)}, after ${JSON.stringify(rotAfter)}.`)
        .not.toBe(rotBefore[1]);
      expect(rotAfter[0], 'the Y handle moved the X axis — each handle writes ONE member of the live triple, and '
        + 'a handle sending all three re-asserts two stale values, which a single-axis clause cannot see.')
        .toBe(rotBefore[0]);
      expect(rotAfter[2], 'the Y handle moved the Z axis.').toBe(rotBefore[2]);
      await composer.openComposer();

      /*
       * ⚠️ **THE `Symmetry` HALF OF THIS STEP IS RETIRED (2026-09-10) BECAUSE ITS CONTROL IS GONE, NOT BECAUSE IT
       * STOPPED DISCRIMINATING.** It read:
       *
       *     await composer.setFramingValue('Symmetry', 5);
       *     expect((await composer.hook())!.symmetryFold).toBe(5);
       *     await expect(page.locator(SEL.framingRow('Mirror'))).toBeVisible();
       *
       * The owner removed the row (*"remove the Symmetry control, this one is not needed on the Composer tab"*), so
       * **the step can no longer be PERFORMED** — `CLAUDE.md`: *"a step that cannot be performed is worse than one
       * quoting retired copy"*, and *"retire an unfalsifiable clause with its reason in the header."* Visual FX's
       * own `Symmetry` row is untouched and out of this file's scope.
       *
       * ⚠️ **AND THE SECOND OBSERVABLE WENT WITH IT: NOTHING IN THIS HARNESS CAN NOW REVEAL `Mirror`'s ROW THROUGH
       * THE COMPOSER'S OWN DOM.** The reveal was a CONSEQUENCE of the fold slider (`set` → `syncFramingVisibility`),
       * and the Composer can no longer change the fold. That is a real reduction in what this file can see, stated
       * rather than hidden: a defect in `syncFramingVisibility()`'s live-update path is now only reachable by
       * driving Visual FX's slider, which no clause here does.
       */

      /*
       * ⚠️ **`Mirror` ITSELF IS STILL MEASURED, ON A PRESET WHOSE AUTHORED FOLD IS ABOVE 1 — AND THAT IS THE ONLY
       * WAY LEFT IN.** `Material Organic` is the ONE library entry with `symmetryFold: 3, symmetryMirror: true`
       * (`demo-presets.ts:2205`, re-grepped); every other preset leaves the fold at 1, where the row is correctly
       * hidden and `setChecked` would time out on an invisible element. **A step needing a specific preset says so
       * with its measurement, so a future retune that flattens that fold fails HERE naming the fold.**
       *
       * ⚠️ **THE PRESET SWAP MUST COME AFTER EVERY CLAUSE ABOVE**, because loading one re-applies all seven framing
       * values from the incoming preset — the `figureScale` / `particleCount` / rotation readings would all be
       * describing a figure nobody edited.
       */
      await composer.loadPreset('Material Organic');
      await composer.assertFramingRowsPresent();
      const organic = (await composer.hook())!;
      expect(organic.symmetryFold, 'CALIBRATION: `Material Organic` no longer carries a fold above 1, so the '
        + '`Mirror` row is hidden and this clause is measuring nothing. It is the only library preset that '
        + 'qualifies — if it was retuned, name another one here rather than deleting the clause.')
        .toBeGreaterThan(1);
      await expect(composer.page.locator(SEL.framingRow('Mirror')),
        'the Mirror row is hidden on a preset whose authored fold is above 1 — `sync()` must run '
        + '`syncFramingVisibility()`, and that call is now the ONLY thing that can ever show this row.')
        .toBeVisible();

      const mirrorBefore = organic.symmetryMirror;
      await composer.mirrorBox().setChecked(!mirrorBefore);
      await composer.page.waitForTimeout(300);
      expect((await composer.hook())!.symmetryMirror, 'the Mirror checkbox did not reach `setSymmetryMirror`.')
        .toBe(!mirrorBefore);

      /*
       * ⚠️ **AND THE PREVIEW MUST HAVE REACTED — the owner's own words** (*"the preview shall react according to
       * settings changes"*). The comparison is `lit`, not `mean`: `CLAUDE.md` records that `mean` drifts by 59
       * with nothing touched on an accumulating trail, so a mean tolerance here would be unfalsifiable in one
       * direction. A `> 0` clause is the threshold the neighbouring steps already use.
       *
       * ⚠️ **IT NOW MEASURES `Material Organic`, NOT `Aliens DNA`, BECAUSE THE MIRROR CLAUSE ABOVE HAD TO SWAP THE
       * PRESET — and this is a fair subject for it: that preset is `splat` WITH a material, which is the one mode
       * that draws NOTHING when its material is missing, so a black frame here is worth catching.**
       */
      const sig = await composer.canvasSignature();
      expect(sig.lit, 'the canvas is BLACK after the framing edits. Every one of these values reaches the '
        + 'generator, so a black frame is a real defect and not a measurement artefact.').toBeGreaterThan(0);
    });

  /*
   * ⚠️ **106b IS THE STEP WITH THE MOST WAYS TO LOOK RIGHT AND BE WRONG, AND THE PRESERVED SET IS THE SUBJECT.**
   * FX-off keeps **Film Look and the whole of Framing & Timing** — the owner's explicit scope, not a derivation
   * — so *"a preset that goes grey-and-ungraded here is a failure, not a success."* The engine sources those
   * fields LIVE (`livePreservedOverlay()`) rather than from the frozen capture, precisely so a second click
   * cannot rewind them, and **the Speed slider two rows above is the reason that matters.**
   *
   * ⚠️ **`Aliens DNA` IS `blend` + Translation Map ON with NO material — MEASURED THROUGH THE ENGINE'S OWN
   * RESOLUTION ORDER.** The legacy JSON says `star` and no material; `REFINED_PRESETS` REPLACES that entry. A
   * spec built on the JSON reading would assert the wrong mode and blame the checkbox.
   *
   * ⚠️ **THE `symmetry` IN THE TITLE IS AN ENGINE VALUE, NOT THE REMOVED CONTROL, AND THE 2026-09-10 REMOVAL DOES
   * NOT TOUCH THIS STEP.** `symmetryFold` / `symmetryMirror` are `overlay` fields inside FX-off's preserved scope,
   * and they must survive a bypass click whether or not this tab has a slider for them — the preserving code is
   * `livePreservedOverlay()`, which never read the Composer. **Re-pointing these two clauses at the Composer's row
   * count would have been the tempting tidy-up and would have deleted the only thing measuring the scope.**
   */
  test('step 106b — FX-off on Aliens DNA drops the warp, shows the notice, and PRESERVES the film look, scale, '
    + 'symmetry and speed', async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      const before = (await composer.hook())!;
      expect(before.presetName, 'the preset did not become the applied one — every reading below would describe '
        + 'the previous figure.').toBe('Aliens DNA');
      // ⚠️ The precondition, asserted rather than assumed: if `Aliens DNA` ever stops being an FX-carrying
      // preset, this step is measuring nothing and must say so instead of passing.
      expect(before.renderMode, 'CALIBRATION: `Aliens DNA` is expected to resolve to `blend` (REFINED_PRESETS '
        + 'replaces the legacy `star` entry). If the mode changed, 106b\'s subject changed with it — this step '
        + 'exists because the preset HAS effects to withhold.').toBe('blend');
      expect(before.material, 'CALIBRATION: `Aliens DNA` is expected to carry NO material — that is what makes '
        + '106c the guaranteed inert-looking step.').toBeNull();
      const sigBefore = await composer.canvasSignature();

      await composer.setBypass('fx', true);

      const after = (await composer.hook())!;
      expect(after.bypassVisualFx, 'the engine did not record the flag — the checkbox is a VIEW of engine state '
        + '(invariant 17), so a ticked box the engine disagrees with is the one surface on screen lying about '
        + 'the picture.').toBe(true);

      // ⚠️ **THE PRESERVED SET, FIELD BY FIELD.** These four are the owner's stated scope and each is silent
      // when wrong: a grading change reads as "the bypass worked", which is why they are asserted by VALUE.
      expect(after.filmLook, 'FX-off changed the FILM LOOK. The owner\'s scope keeps Film Look and the whole of '
        + 'Framing & Timing — a preset that goes grey-and-ungraded here is a FAILURE, not a success.')
        .toBe(before.filmLook);
      expect(after.figureScale, 'FX-off changed the figure scale — part of Framing & Timing, which is KEPT.')
        .toBeCloseTo(before.figureScale, 6);
      expect(after.symmetryFold, 'FX-off changed the symmetry fold.').toBe(before.symmetryFold);
      expect(after.symmetryMirror, 'FX-off changed the symmetry mirror.').toBe(before.symmetryMirror);
      expect(after.speedFactor, 'FX-off changed the SPEED. `livePreservedOverlay()` sources this LIVE exactly '
        + 'so the Speed slider two rows above cannot be rewound by a bypass click.')
        .toBeCloseTo(before.speedFactor, 6);

      // ⚠️ The picture must genuinely have changed — otherwise the flag is set and the bypass never applied,
      // which is the *"a control that moves nothing"* half of invariant 13.
      const sigAfter = await composer.canvasSignature();
      expect(sigAfter.lit + sigAfter.mean, 'the flag flipped but the PICTURE is identical. `Aliens DNA` carries '
        + 'the Translation Map, so FX-off must be visible — a flag with no rendered consequence is invariant '
        + '13\'s defect with the engine agreeing it happened.')
        .not.toBe(sigBefore.lit + sigBefore.mean);
      expect(sigAfter.lit, 'FX-off produced a BLACK preview on a `blend` preset. `blend` is in '
        + '`PLAIN_BYPASS_MODES`, so the mode must be left exactly as authored.').toBeGreaterThan(0);

      await expect(composer.notice('bypass'), 'the consequence notice did not appear. Its subject is a data-loss '
        + 'path in ANOTHER tab, which no per-control tooltip can own (invariant 25).').toBeVisible();
      const noticeText = (await composer.notice('bypass').textContent()) ?? '';
      expect(noticeText, 'the notice must say that Export, Snapshot and the Mixer still write the FULL look — '
        + 'that is the half distinguishing these boxes from the level checkboxes below.').toContain('Export');
      /*
       * ⚠️ **RE-POINTED 2026-09-10: `back off` → `back on`, BECAUSE THE SENTENCE'S SUBJECT IS THE SWITCH AND THE
       * SWITCH WAS INVERTED.** The data-loss path is unchanged — edits made in Visual FX or Materials while the
       * bundle is NOT being applied are dropped when it is applied again — but the direction that describes it is
       * now "on". ⚠️ **This is the only clause in the suite that can catch a copy change lagging a polarity
       * change**, which is exactly the pair that reads correct in source and backwards on screen.
       */
      expect(noticeText, 'the notice still describes the OLD switch direction. Under `Apply Visual FX`, the loss '
        + 'happens when the bundle is switched back ON — a notice describing the opposite direction is worse than '
        + 'none, because it names a real hazard at the wrong moment.').toContain('lost when you switch it back on');

      /*
       * ═══ Phase 17.5 — the GL clause ══════════════════════════════════════════════════════════════════════
       * ⚠️ **`Aliens DNA` IS THE SHARPEST PRESET IN THE SUITE FOR THIS, WHICH IS WHY THE CLAUSE IS HERE AND NOT
       * ONLY ON A QUIETER STEP.** It is `blend` mode **with the Translation Map on**, and the warp moves pixels
       * on its own — so the `sigAfter !== sigBefore` clause above would be satisfied by a bypass that stopped the
       * generator dead. `pos` is the only channel that separates the two, and withholding effects must not cost
       * the sweep: FX-off flattens the RENDER, never the integrator.
       */
      await composer.assertIntegratorAdvanced();
      expect((await composer.hook())!.lastFrameError, 'the frame loop threw with FX-off engaged — `drawFrame`\'s '
        + 'catch fired, so this is an engine failure and not a harness one. ⚠️ A throw as the frame\'s last '
        + 'statement ended the loop for a whole session once (invariant 22); the rAF now lives in a `finally`, so '
        + 'a throw here leaves the animation RUNNING and is invisible to every clause above.').toBeNull();
    });

  /*
   * ⚠️ **106c IS THE BLOCK'S ONE GUARANTEED INERT-LOOKING STEP, AND THE TEST PLAN SAYS TO READ IT AGAINST THIS
   * TAB'S CHARACTERISTIC DEFECT.** `Aliens DNA` carries no material, so Materials-off has nothing to withhold —
   * the box is not broken. **The discriminator is whether the preset HAS the thing the box withholds**, which
   * the hook can answer directly (`material === null`) where a human has to open the Materials tab.
   *
   * ⚠️ **SO THE ASSERTION IS TWO-PART, AND THAT IS THE POINT: the FLAG must move even though the PICTURE must
   * not.** A one-part version could not tell "correctly inert" from "wired to nothing".
   */
  test('step 106c — Materials-off on a preset with no material moves the FLAG and not the picture',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      await composer.setBypass('fx', true);
      const before = (await composer.hook())!;
      expect(before.material, 'CALIBRATION: this step\'s entire content is that the preset has NOTHING to '
        + 'withhold. A material here makes the step measure the opposite thing.').toBeNull();
      const sigBefore = await composer.canvasSignature();

      await composer.setBypass('materials', true);
      const after = (await composer.hook())!;

      expect(after.bypassMaterials, 'the flag did not reach the engine — without this half, "nothing changed" '
        + 'cannot be told from "the box is wired to nothing", which is this tab\'s characteristic defect.')
        .toBe(true);
      expect(after.renderMode, 'Materials-off changed the resolved MODE on a preset with no material. '
        + '`materialWasLive` is false, so `resolveModeAgainstMaterial(requested, null)` must land on the same '
        + 'mode it already had.').toBe(before.renderMode);

      /*
       * ⚠️ **THE PICTURE HALF IS `lit > 0` AND NOT A `mean` TOLERANCE, AND THAT IS 106e's FINDING APPLIED HERE
       * RATHER THAN A SECOND DERIVATION — THE `mean` FORM SHIPPED RED ON A CORRECT ENGINE.** It read
       * `toBeLessThanOrEqual(6)` and failed at 11; the control measurement is decisive and was taken on THIS
       * preset: `Aliens DNA` with **no click at all**, six reads over ~4 s, wanders 120 → 179, **a free-running
       * span of 59 against a "defect" of 11.** `lit` moves 880 → 1000 across the same window. Aliens DNA carries
       * `transMapEnabled` and `decayFactor` 0.988, so the trail is still filling while the clause samples it.
       *
       * ⚠️ **SO THE NOISE STRICTLY EXCEEDS THE SIGNAL AND NO TOLERANCE ON `mean` IS HONEST HERE — 106e's comment
       * says so in full, and its SEED proved a derived band self-satisfying.** Do not re-add one, and do not
       * "fix" this by widening 6: a tolerance above 59 admits every real change this step could catch, which is
       * `CLAUDE.md`'s *"never pick one that passes"* in its most literal form.
       *
       * ⚠️ **WHAT CARRIES THE STEP INSTEAD IS THE `renderMode` EQUALITY ABOVE — EXACT, UNTOLERANCED AND THE
       * STEP'S ACTUAL SUBJECT.** "The mode is being forced" is a claim about the resolved mode, which the hook
       * publishes directly (invariant 17's owner), so the pixel read was never the discriminator for it. `lit`
       * is kept as the black-preview backstop, the one threshold this drift cannot cross (106d, 106j).
       */
      const sigAfter = await composer.canvasSignature();
      expect(sigAfter.lit, 'Materials-off BLACKED the preview on a preset that has no material to withhold. '
        + '`lit` is the threshold 106d and 106j use, and drift cannot cross it — a zero here is a real black '
        + 'frame, which is the failure `bypassOverlay`\'s `splat`→`star` guard exists to prevent.')
        .toBeGreaterThan(0);
      expect(sigBefore.lit, 'CALIBRATION: the preview was ALREADY black before the Materials click, so the '
        + 'clause above has no subject and would pass on a bypass that blacks the screen.').toBeGreaterThan(0);

      await composer.setBypass('fx', false);
      await composer.setBypass('materials', false);
      await expect(composer.notice('bypass'), 'the notice must disappear once both boxes are off.').toBeHidden();
    });

  /*
   * ⚠️ **106d IS THE FAILURE THIS WHOLE STEP EXISTS FOR AND THE ONLY COMPOSER STEP THAT CAN BLACK THE PREVIEW.**
   * `splat` with no material **draws nothing at all**, so a materials-off that left the mode at `splat` blacks
   * the screen and the checkbox gets blamed. `bypassOverlay()`'s `splat`→`star` guard is what prevents it, and
   * this is the clause that holds the guard to account.
   *
   * ⚠️ **`Aurora Borealis` = `splat` + `LiquidLight`, MEASURED.** Both halves are asserted as a CALIBRATION
   * before the bypass, because the black-preview case is only reachable while that pairing holds — and a step
   * measuring an unreachable configuration reports green about nothing.
   *
   * ⚠️ **THE DISCRIMINATOR IS `lit === 0`, NOT A DIFF AGAINST A BASELINE.** `CLAUDE.md`: judge it on the FINAL
   * 8-bit output. A tolerance diff would report "it changed" — which is true and useless when the change is to
   * black.
   */
  test('step 106d — Materials-off on Aurora Borealis draws plain STARS, never a black preview',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aurora Borealis');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      const before = (await composer.hook())!;
      expect(before.renderMode, 'CALIBRATION: `Aurora Borealis` must resolve to `splat` for this step to be '
        + 'reachable at all — `splat` with the material withheld is the ONLY configuration that blacks the '
        + 'frame.').toBe('splat');
      expect(before.material, 'CALIBRATION: `Aurora Borealis` must carry a live material (`LiquidLight`).')
        .toBe('LiquidLight');
      const sigBefore = await composer.canvasSignature();
      expect(sigBefore.lit, 'CALIBRATION: the preset is not drawing anything BEFORE the bypass, so a black '
        + 'frame afterwards would prove nothing.').toBeGreaterThan(0);

      await composer.setBypass('materials', true);

      const after = (await composer.hook())!;
      expect(after.renderMode, 'the resolved mode stayed at `splat` with the material withheld. `splat` draws '
        + 'NOTHING without a material — this is the black-frame defect, and `bypassOverlay()`\'s splat→star '
        + 'guard is what must prevent it.').toBe('star');
      expect(after.material, 'the material is still live with Materials-off ticked.').toBeNull();

      const sigAfter = await composer.canvasSignature();
      expect(sigAfter.lit, 'A BLACK PREVIEW — the single most likely defect in this step. Judge it on the FINAL '
        + '8-bit output, not on whether the mode string looks right.').toBeGreaterThan(0);
      expect(sigAfter.mean, 'the preview is technically non-black but essentially unlit.').toBeGreaterThan(0);
      expect(after.lastFrameError, 'the frame loop threw while the bypass was on — `drawFrame`\'s catch fired, '
        + 'so this is an engine failure and not a harness one.').toBeNull();

      /*
       * ═══ Phase 17.5 — the GL clause, and on THIS step it is not redundant with `lit > 0` ═══════════════════
       * ⚠️ **THE BLACK-PREVIEW CLAUSE ABOVE AND THIS ONE FAIL IN OPPOSITE DIRECTIONS, AND THE MODE SWAP IS
       * EXACTLY THE KIND OF EDIT THAT COULD COST THE SWEEP.** `bypassOverlay()`'s `splat`→`star` guard rewrites
       * the resolved mode mid-session; a re-apply that reached `initGenerator()` would zero `pos` and a stricter
       * one could leave it stopped — and a **stationary lit figure passes `lit > 0` and `mean > 0` forever.**
       * A frozen figure still looks plausible, which is invariant 22's whole symptom.
       */
      await composer.assertIntegratorAdvanced();
    });

  /*
   * ⚠️ **106e IS AN IDEMPOTENCY PROPERTY AND IT IS THE ONE A SINGLE TOGGLE CANNOT SEE.** *"Tick and untick each
   * box three times in turn: every cycle must land on the same picture."* A look that DRIFTS means the re-apply
   * is not idempotent and the preserved set is being rewound — which is exactly why
   * `livePreservedOverlay()` sources those fields live instead of from the frozen capture.
   *
   * ⚠️ **IT IS A PAIR/REPEAT PROPERTY: `CLAUDE.md`'s *"ask what a defect needs TWO of."*** The first cycle
   * cannot fail this clause; the second and third can.
   */
  test('step 106e — three tick/untick cycles land on the SAME picture and the SAME preserved set',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aurora Borealis');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      const base = (await composer.hook())!;
      const baseSig = await composer.canvasSignature();

      /*
       * ⚠️ **THE "SAME PICTURE" HALF IS MEASURED AS THE EXPORTED LOOK, NOT AS PIXELS, AND THAT WAS FORCED BY
       * MEASUREMENT — `canvasSignature().mean` CANNOT DISCRIMINATE ON A TRAIL-ACCUMULATING PRESET.** The full
       * derivation, because it is the kind of thing that gets "simplified" back:
       *
       *   1. The clause first read `toBeLessThanOrEqual(8)` — a PICKED number — and failed at 12.
       *   2. A probe measured the null hypothesis: `Aurora Borealis` with **no bypass click at all**, sampled
       *      over the same elapsed animation time, wanders 66 → 83 about a base of 70. **Free-running span 17 —
       *      larger than the 12 being reported as a defect.** So the red was the harness accusing the subject.
       *   3. Replacing 8 with a band DERIVED from that control loop passed — and **its own seed then proved the
       *      derived band self-satisfying: FX-off HELD, a genuinely different look, moved `mean` by only 8,
       *      inside the band of 17.** The noise strictly exceeds the signal, so **no tolerance on `mean` can
       *      work here, derived or picked**, and `lit` drifts 432 → 581 over the same idle window.
       *
       * ⚠️ **THAT SEED IS THE REASON THIS CLAUSE IS SHAPED THIS WAY: IT CAUGHT A TOLERANCE THAT PASSED FOR THE
       * WRONG REASON, WHICH IS THE ONE THING A GREEN RUN CANNOT TELL YOU.** `CLAUDE.md`: *"never pick one that
       * passes"* — and a runtime-derived band is only honest if a real change still exceeds it, which is what
       * the seed asks and what failed.
       *
       * ⚠️ **THE EXPORT IS STRICTLY STRONGER THAN THE FIVE PUBLISHED FIELDS AND IS EXACTLY, NOT APPROXIMATELY,
       * COMPARABLE.** It carries every authored value including the whole `overlay` block, so it sees a rewind
       * in a field the hook does not publish at all — the case the pixel clause was there to backstop — and it
       * needs no tolerance, so it cannot be fitted. **Do not re-add a pixel comparison here: the step's
       * black-preview question is 106d's and 106j's, both of which measure `lit > 0`, a threshold this drift
       * cannot cross.**
       */
      const baseExport = ComposerPage.normalisePresetJSON(await composer.exportPresetText());
      expect(baseExport.length, 'CALIBRATION: the baseline export is empty, so the comparison at the end of this '
        + 'test would be between two empty strings — which are equal, and the clause would pass over anything.')
        .toBeGreaterThan(100);

      for (const which of ['fx', 'materials'] as const) {
        for (let cycle = 1; cycle <= 3; cycle++) {
          await composer.setBypass(which, true);
          await composer.setBypass(which, false);

          const back = (await composer.hook())!;
          // ⚠️ The RESOLVED mode and material are what "the look returned exactly" means in a machine-readable
          // form — `CLAUDE.md`: never `preset.renderer.mode`, always the resolved value (invariant 17).
          expect(back.renderMode, `cycle ${cycle} of \`${which}\` did not restore the resolved mode. A look that `
            + 'DRIFTS across cycles means the re-apply is not idempotent — and the FIRST cycle cannot see this, '
            + 'which is why the step demands three.').toBe(base.renderMode);
          expect(back.material, `cycle ${cycle} of \`${which}\` did not restore the material.`)
            .toBe(base.material);
          expect(back.filmLook, `cycle ${cycle} of \`${which}\` rewound the FILM LOOK — the preserved set is `
            + 'being taken from the frozen capture instead of live.').toBe(base.filmLook);
          expect(back.speedFactor, `cycle ${cycle} of \`${which}\` rewound the SPEED.`)
            .toBeCloseTo(base.speedFactor, 6);
          expect(back.snapshotIsFrozen, `cycle ${cycle} of \`${which}\` left the authored capture in place with `
            + 'both flags off — `bypassAuthoredOverlay` must be nulled on release, or the next Export writes a '
            + 'stale overlay.').toBe(false);

          /*
           * ⚠️ **THE STUCK-BYPASS CLAUSE, AND IT HAS TO BE THE FLAGS — NOT THE PICTURE AND NOT THE EXPORT.** A
           * bypass that never releases is the most literal reading of *"a cycle that did not come back"*, and
           * **neither of the other two channels can see it**: `mean`'s idle noise (17) exceeds the change a held
           * FX-off makes (8), and the export is bypass-INVARIANT BY DESIGN — 106f asserts exactly that, because
           * `getSnapshot()` returns the authored overlay while a box is ticked. Three channels, three different
           * questions; **this is the only one that answers "did the box let go."**
           */
          expect(back.bypassVisualFx, `cycle ${cycle} of \`${which}\` left FX-off engaged after the untick.`)
            .toBe(false);
          expect(back.bypassMaterials, `cycle ${cycle} of \`${which}\` left Materials-off engaged after the `
            + 'untick.').toBe(false);
        }
      }

      /*
       * ⚠️ **AND THE PICTURE-LEVEL HALF: THE EXPORTED LOOK IS BYTE-IDENTICAL AFTER SIX CYCLES.** This is the
       * clause the five per-cycle assertions cannot cover — they compare the five fields the hook publishes,
       * while this compares every authored value, so a rewind in an `overlay` field nothing else reads fails
       * HERE. It is also the one comparison in this step with no tolerance at all.
       */
      expect(ComposerPage.normalisePresetJSON(await composer.exportPresetText()),
        'the LOOK drifted across six tick/untick cycles: the exported preset differs from the one exported '
        + 'before the first click, with both boxes now clear. A bypass is a VIEW, so six ticks and six unticks '
        + 'must leave the authored state exactly as it was — a difference here is the non-idempotent re-apply '
        + 'this step exists to catch, and it is visible in a field the test hook does not publish.')
        .toBe(baseExport);
      expect(baseSig.lit, 'CALIBRATION: the baseline frame was BLACK, so this test ran against a preset that '
        + 'never drew and every comparison above compared one dead state to another.').toBeGreaterThan(0);

      /*
       * ═══ Phase 17.5 — the GL clause, AND THIS STEP IS THE ONE THAT MOST NEEDED IT ═══════════════════════════
       * ⚠️ **EVERY OTHER CHANNEL IN THIS TEST IS DELIBERATELY BYPASS-INVARIANT OR TOLERANCE-FREE-BY-EXPORT, WHICH
       * MEANS NONE OF THEM CAN SEE A STOPPED ENGINE.** The export is bypass-invariant BY DESIGN (106f asserts it),
       * the five hook fields are all authored state, and the long comment above records that **no tolerance on
       * `mean` can work on this preset** because idle drift (17) exceeds a real look change (8). So after twelve
       * bypass re-applies, *"is the figure still running"* is asked by exactly one channel — this one.
       * ⚠️ **Twelve re-applies is also where a re-entrancy defect would land** (`bypassApplying` exists because
       * unguarded, every click re-entered `adoptExternalFigure()`), and a re-entrant loop that stalled the
       * integrator would leave all six per-cycle clauses green.
       */
      await composer.assertIntegratorAdvanced();
    });

  /*
   * ⚠️ **106f IS THE HALF THAT SEPARATES THESE BOXES FROM THE LEVEL CHECKBOXES, AND THE TEST PLAN IS EXPLICIT
   * THAT THE COPY IS PART OF THE STEP: "if both controls behaved the same way, one of them is wrong, and the
   * copy that distinguishes them has failed even if the files are right."*** So this clause asserts BOTH the
   * byte-identity AND the notice's claim about it.
   *
   * ⚠️ **`getSnapshot()` RETURNS THE AUTHORED OVERLAY WHILE A BOX IS TICKED — the OPPOSITE of E108's mute**, and
   * `panel.ts` overwrites `copy.overlay` with it before exporting. That is the mechanism; this is the property.
   *
   * ⚠️ **THE EXPORT IS COMPARED AFTER STRIPPING THE NAME-AND-TIMESTAMP NOISE, NOT RAW.** `CLAUDE.md`: *"an
   * export is mostly runtime-default NOISE — diff programmatically."* A raw compare would fail on the filename
   * suffix and report a false defect in the one direction that matters most.
   *
   * ⚠️ **THIS CLAUSE CAUGHT A REAL `src/` DEFECT BY RUNNING (2026-09-09) AND IT WAS FIXED IN `src/` (2026-09-10,
   * owner: *"fix all issues"*), SO ITS GREEN IS NOW A CONFIRMATION — DO NOT RE-POINT IT EITHER WAY.** Measured red
   * (`Aliens DNA` and `Aurora Borealis`, both boxes): the bypassed export carried **three keys the authored one
   * did not** — `overlay.particleSize`, `overlay.symmetryFold`, `overlay.symmetryMirror`. Owner:
   * `bypassOverlay()` spreads `...livePreservedOverlay()` into `kept`, and that helper returned
   * `particleSize: particleSizeScale` alongside the two symmetry fields unconditionally. **So the bypass DID
   * write, which is exactly what E109's rule forbids** (*"neither box may write `workingPreset`"*, Export /
   * Snapshot / Mixer byte-identical either way).
   *
   * ⚠️ **THE FIX IS IN THE PRODUCER, NOT HERE, AND THE TEMPTING REMEDY WAS IN THIS FILE: widening the normaliser
   * to ignore the three keys would have turned the suite green over a live violation of the rule the step exists
   * to measure** — `CLAUDE.md`'s *"a net figure conceals a repair"* in the harness. ⚠️ **THE RED STEP WAS THE
   * DELIVERABLE FOR A DAY, AND THAT IS THE TRANSFERABLE PART: this comment is kept in full so the next reader can
   * see that the clause was not weakened while it was failing.** The three keys now carry the identity gates
   * `getSnapshot()`'s plain branch already uses, so a preset at the identity values exports them from NEITHER
   * branch and a preset away from them exports them from BOTH.
   */
  test('step 106f — two Exports, one with both boxes ticked, are IDENTICAL', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();
    await composer.assertBypassBoxesPresent();

    await composer.setBypass('fx', true);
    await composer.setBypass('materials', true);
    const bypassed = await composer.exportPresetText();

    await composer.setBypass('fx', false);
    await composer.setBypass('materials', false);
    const plain = await composer.exportPresetText();

    /*
     * ⚠️ Parse and re-serialise so key ORDER and whitespace cannot produce a false difference — the claim is
     * about VALUES. **The normaliser is `ComposerPage.normalisePresetJSON` and it must be that one**: the
     * obvious inline form, `JSON.stringify(o, Object.keys(o).sort())`, applies its replacer array at EVERY
     * depth and silently deletes the whole `overlay` block — i.e. the only thing this step measures. Measured;
     * see the helper's comment. **Do not re-inline it.**
     */
    const norm = (s: string) => ComposerPage.normalisePresetJSON(s);
    expect(bypassed.length, 'CALIBRATION: the bypassed export is empty, so the comparison below would be '
      + 'between two empty strings — which are equal.').toBeGreaterThan(100);
    expect(norm(bypassed), 'the two exports DIFFER — a bypass is a VIEW and must write nothing. This is the '
      + 'exact OPPOSITE of 105e, where a switched-off LEVEL exports as zeros: two checkbox families on one tab '
      + 'with opposite persistence semantics, and if they behave the same way one of them is wrong.')
      .toBe(norm(plain));

    // ⚠️ The copy half of the step, which the test plan says fails even when the files are right.
    await composer.setBypass('fx', true);
    const noticeText = (await composer.notice('bypass').textContent()) ?? '';
    expect(noticeText, 'the notice must state that Export and Snapshot still write the FULL look. The files '
      + 'being identical is only half the step — a user cannot see a byte comparison.').toContain('Export');
    expect(noticeText).toContain('Snapshot');
  });

  /*
   * ⚠️ **106g IS THE WORSE DIRECTION OF 106f AND THE TEST PLAN SAYS SO: A TILE MATCHING THE BYPASSED PREVIEW
   * "writes the loss into history."*** `CLAUDE.md` records the same asymmetry for the export gate: *"Snapshot
   * worst because it writes the loss into history."*
   *
   * ⚠️ **WHAT IS OBSERVABLE HERE IS THE SNAPSHOT'S STORED STATE, NOT A TILE'S PIXELS.** A history tile is a
   * reduced-fidelity `GridTileRenderer` draw — `CLAUDE.md` calls reduced fidelity a WON'T-FIX — so comparing it
   * against the main canvas would fail for a documented, unrelated reason. The clause therefore asserts that a
   * snapshot was taken while a box was ticked and that the stored overlay is the AUTHORED one, via
   * `snapshotIsFrozen` plus a re-export.
   *
   * ⚠️ **WAS RED FOR THE SAME `src/` CAUSE AS 106f — the same three `livePreservedOverlay()` keys — AND IS FIXED
   * BY THE SAME ONE-OWNER CHANGE (2026-09-10). TWO RED STEPS, ONE DEFECT: never read this pair as two.**
   * ⚠️ **AND THE PAIR IS WHY THE FINDING IS WORTH ITS RED: 106f says the loss is exportable, 106g says
   * it reaches HISTORY, which `CLAUDE.md` records as the worse direction because history is the restore target.
   * One failing clause would have been a curiosity; two on the same mechanism, one of them writing into the
   * restore path, is the argument.**
   */
  test('step 106g — a Snapshot taken with a box ticked stores the FULL look, not the bypassed preview',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aurora Borealis');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      const authored = await composer.exportPresetText();

      await composer.setBypass('materials', true);
      const frozen = (await composer.hook())!;
      expect(frozen.snapshotIsFrozen, 'CALIBRATION: `bypassAuthoredOverlay` is null while a bypass is ON, so '
        + 'there is no authored capture for Snapshot to write — one boolean cannot express "reports frozen, '
        + 'pixels moved", which is why this field ships alongside the two flags.').toBe(true);

      await composer.clickSnapshot();
      const whileBypassed = await composer.exportPresetText();

      // ⚠️ The same shared normaliser as 106f, for the same measured reason — an inline top-level key sort
      // deletes `overlay` at depth and makes this comparison unconditionally true.
      const norm = (s: string) => ComposerPage.normalisePresetJSON(s);
      expect(norm(whileBypassed), 'Snapshot/Export recorded the BYPASSED look. This is the worse direction of '
        + '106f, because it writes the loss into HISTORY where it becomes the restore target.')
        .toBe(norm(authored));

      // ⚠️ The history tile must at least EXIST — a snapshot that silently did nothing would leave the
      // comparison above trivially true.
      await composer.openTab('history');
      await expect(composer.page.locator(SEL.historyTile).first(), 'CALIBRATION: History has no tiles after a '
        + 'Snapshot click, so the assertion above passed over a snapshot that never happened. `pushSnapshot` is '
        + 'the only way to add history.').toBeVisible();
    });

  /*
   * ⚠️ **106h WAS REVERSED BY THE OWNER ON 2026-09-10 AND IT NOW ASSERTS THE OPPOSITE OF WHAT IT SHIPPED
   * ASSERTING. THE STEP IS THE SAME DRIVE; ONLY THE EXPECTED READING FLIPPED.** E109 deliberately held the two
   * flags engine-side *so that a bypass SURVIVED a preset load*, and this test asserted that survival — green
   * through three phases. The user reported the survival as a bug: *"if in Composer the Visual Fx and Materials
   * are disabled and we go back to Grid and select a new preset, then those remain disabled and the preset does
   * not show correctly in the preview — whenever a new preset is selected, those two checkboxes should be enabled
   * again."* **A ruling, not a defect report against an implementation of the spec** — which is why the old clause
   * was correct at the moment it was written and is wrong now, and why the previous expectations are kept in this
   * header rather than deleted: `bypassVisualFx` was `true`, `isBypassed('fx')` was `true`, `renderMode` was
   * `star` over `First Contact`'s authored `liquid`, and the notice was visible.
   *
   * ⚠️ **THE TWO SYMPTOMS THE REPORT NAMES ARE ONE CAUSE, AND THIS TEST MEASURES BOTH ENDS OF IT.** The bypass is
   * a RE-APPLY, so a flag surviving the load does not merely leave a checkbox stale — it rewrites the incoming
   * preset's render mode and withholds its material. **`renderMode` is therefore the clause that owns *"the preset
   * does not show correctly in the preview"*, and the checkbox clause owns the other half. Neither alone would
   * have discriminated: a flag cleared without a re-apply leaves the boxes right and the pixels stripped.**
   *
   * ⚠️ **`First Contact` = `liquid`, NO material — measured, AND ITS ROLE INVERTED WITH THE RULING.** It was
   * chosen because `liquid` is outside `PLAIN_BYPASS_MODES`, so a live FX-off must flatten it to `star`; that made
   * it the one preset able to prove the bypass RE-APPLIED rather than merely survived. **The same property now
   * proves the opposite**: reading `liquid` means the flag was genuinely dropped BEFORE the overlay was applied.
   * A plain-set second preset would report `star` either way and this test would be unfalsifiable.
   *
   * ⚠️ **THE `isSamePreset` HALF IS NOT TESTED HERE AND THAT IS DELIBERATE — IT IS THE OTHER DIRECTION OF THE
   * SAME GATE AND IT NEEDS ITS OWN DRIVE**, because a reset that fires on every re-apply passes every clause
   * below. It is step 106h-i, immediately after this one; ⚠️ **106h alone is green over an UNGATED clear**, which
   * is the more likely defect of the two (every Sliders drag would untick the boxes).
   */
  test('step 106h — a genuinely DIFFERENT preset switches both boxes back on, and its own look is drawn',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      await composer.setBypass('fx', true);
      // ⚠️ CALIBRATION: without this the clauses below cannot tell a working reset from a bypass that never
      // applied in the first place — *"a confirmation is evidence only if a specific failure was available."*
      expect(await composer.isBypassed('fx'), 'CALIBRATION: the bypass did not take on the FIRST preset, so '
        + 'every clause below would pass over a state that was never entered.').toBe(true);

      await composer.loadPreset('First Contact');

      const h = (await composer.hook())!;
      expect(h.presetName, 'the second preset did not become the applied one.').toBe('First Contact');
      expect(h.bypassVisualFx, 'the flag SURVIVED the preset switch. That was E109\'s shipped behaviour and the '
        + 'owner reversed it on 2026-09-10: a new preset must arrive with both bundles applied.').toBe(false);
      /*
       * ⚠️ **READ THROUGH `isBypassed()`, WHICH OWNS THE ONE `!`** — the box says `Apply Visual FX` and the flag
       * is named `bypass…`, so a clause comparing `checked` to the flag directly is right or wrong with no
       * symptom either way, and this file has ten of them.
       */
      expect(await composer.isBypassed('fx'), 'the engine dropped the bypass but the checkbox still says the '
        + 'bundle is withheld. The box is a VIEW re-read from the engine on every `sync()` (invariant 17), so a '
        + 'disagreement here means the resync never ran — the flag being right is not enough.').toBe(false);

      // ⚠️ **THE HALF THAT OWNS *"the preset does not show correctly in the preview"*.** `liquid` is outside
      // `PLAIN_BYPASS_MODES`, so a surviving FX-off would have flattened it — reading the authored mode is what
      // proves the flag was dropped BEFORE the overlay was applied, not merely repainted in the checkbox after.
      expect(h.renderMode, 'the new preset is being drawn as `star` over its authored `liquid` mode — the boxes '
        + 'may look right but the bypass is still rewriting the picture. This is the SECOND symptom in the '
        + 'user report, and it is the same cause as the first.').toBe('liquid');
      await expect(composer.notice('bypass'), 'the consequence notice is still visible with no bypass live — it '
        + 'is gated on `anyBypass` in `sync()`, so this is the notice disagreeing with the engine.').toBeHidden();
    });

  /*
   * ⚠️ **106h-i IS THE OTHER DIRECTION OF ONE GATE, AND IT IS THE DEFECT 106h STRUCTURALLY CANNOT SEE.** The
   * reset is gated on `isSamePreset` (`main.ts`, `applyPresetChange`) because **every Sliders/Randomiser/Mixer
   * move rebuilds the working preset and emits `preset-changed`**, so that path runs constantly with the SAME
   * preset. Ungated, the clear would fire there too — a control silently undoing a different control's state,
   * which is E109's own `bypassApplying` trap in the opposite direction, and **106h is green over it.**
   *
   * ⚠️ **A LETTERED INSERTION, NEVER A RENUMBER** — 106i is the re-entrancy step and keeps its number.
   *
   * ⚠️ **THE RE-APPLY IS DRIVEN THROUGH A SLIDER RATHER THAN THROUGH ANY API, BECAUSE THE SUBJECT IS THE EVENT
   * ITSELF.** The Composer's own `Speed` slider writes `speedFactor` and does NOT emit `preset-changed`, so it
   * would exercise nothing; the drive has to be something that rebuilds the preset. `Sliders`' own move does.
   */
  test('step 106h-i — a re-apply of the SAME preset must NOT switch the boxes back on',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      await composer.setBypass('materials', true);
      expect(await composer.isBypassed('materials'), 'CALIBRATION: the bypass did not take, so the clause below '
        + 'would pass over a state that was never entered.').toBe(true);

      // A Sliders move rebuilds the working preset and emits — the same path a preset switch takes, with the
      // SAME name. That name equality is the whole discriminator.
      await composer.openTab('sliders');
      /*
       * ⚠️⚠️ **SCOPED TO THE SLIDERS CONTAINER, AND IT WAS NOT — THE TEST TIMED OUT FOR 9 MINUTES ON A HIDDEN
       * COMPOSER SLIDER.** `${SEL.tabContent} input[type="range"]` matches every BUILT tab, and containers sit in
       * the DOM in the order the tabs were first shown: this test opens the Composer before Sliders, so `.first()`
       * resolved to the Composer's `Figure Scale` — inside a container now `display: none` — and `fill` waited for
       * it to become visible until the deadline. Proven pre-existing on 2026-11-05 by re-running it on the whole
       * `src/` tree from the previous day's backup: identical failure. `CLAUDE.md`'s rule, reached in a spec:
       * scope a tab's controls to `.tab-content[data-tab="X"]`.
       */
      const slider = composer.page.locator('.tab-content[data-tab="sliders"] input[type="range"]').first();
      await expect(slider, 'CALIBRATION: no range input on the Sliders tab, so nothing below was driven.')
        .toHaveCount(1);
      // ⚠️ **THE TRACK IS 0–100 WITH A CENTRE OF 50, AND `applyAllSliders` SKIPS ANY SLIDER STILL AT 0.5** —
      // a value inside 0…1 would land on 0 or 1 after `parseInt(...)/100`, i.e. an extreme rather than the
      // small move this step wants, and a value of 50 would emit a preset with no slider applied at all.
      await slider.fill('75');
      await slider.dispatchEvent('input');
      await composer.page.waitForTimeout(600);

      const h = (await composer.hook())!;
      expect(h.presetName, 'CALIBRATION: the slider move changed the applied preset NAME, so this is no longer '
        + 'a same-preset re-apply and the clause below is measuring 106h instead.').toBe('Aliens DNA');
      expect(h.bypassMaterials, 'a same-preset re-apply cleared the bypass. The clear must be gated on '
        + '`isSamePreset`, or every slider drag silently undoes a switch the user set on another tab.').toBe(true);

      await composer.openComposer();
      expect(await composer.isBypassed('materials'), 'the flag survived but the checkbox came back ticked — the '
        + 'box is a VIEW and it is now lying about the picture in the direction nobody looks.').toBe(true);
    });

  /*
   * ⚠️ **106i IS THE DEFECT THE BUILD ACTUALLY HIT, AND IT IS A CONTROL SILENTLY UNDOING A DIFFERENT CONTROL'S
   * STATE.** Unguarded, ticking a bypass re-entered `adoptExternalFigure()` and **un-muted every level** —
   * `bypassApplying` is the re-entrancy guard that exists because of it. `CLAUDE.md` names it directly.
   *
   * ⚠️ **BOTH ORDERS ARE CHECKED, BECAUSE THE STEP SAYS TO AND BECAUSE A RE-ENTRANCY DEFECT IS ORDER-SENSITIVE
   * BY NATURE.** A one-order spec would have a 50 % chance of being green over the real bug.
   */
  test('step 106i — a bypass click must NOT un-mute a level, in either order', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();
    await composer.assertBypassBoxesPresent();

    // ---- order 1: mute Structure, then tick the bypass ----
    const structure = composer.levelCheckbox(1);
    await expect(structure, 'CALIBRATION: the Structure level checkbox is not ticked on a lit row, so '
      + 'unchecking it below would be a no-op and the seed path would be unreachable — which is exactly the '
      + 'defect §Q was green over.').toBeChecked();
    await structure.uncheck();
    await composer.page.waitForTimeout(300);
    await expect(structure, 'CALIBRATION: the level did not switch off, so nothing below can detect it coming '
      + 'back on.').not.toBeChecked();

    await composer.setBypass('fx', true);
    await expect(structure, 'STRUCTURE CAME BACK ON when a bypass was ticked. Unguarded, the click re-entered '
      + '`adoptExternalFigure()` and un-muted every level — one control silently undoing another\'s state, '
      + 'with the checkbox as the only witness. `bypassApplying` is the guard.').not.toBeChecked();
    await expect(composer.notice('mute'), 'the mute notice above the rows must still be there.').toBeVisible();

    // ---- order 2: bypass first, then mute, then the OTHER bypass ----
    await composer.setBypass('materials', true);
    await expect(structure, 'the second bypass click un-muted the level.').not.toBeChecked();
    await composer.setBypass('fx', false);
    await expect(structure, 'RELEASING a bypass un-muted the level — the release path goes through the same '
      + 're-apply and needs the same guard.').not.toBeChecked();
    await composer.setBypass('materials', false);
    await expect(structure, 'releasing the last bypass un-muted the level.').not.toBeChecked();
  });

  /*
   * ⚠️ **106j IS A STATED CONSEQUENCE, NOT A DEFECT, AND THE TEST PLAN SAYS SO: "worth a line only if you think
   * the trade is wrong."*** Materials-off forces `star`, so on the only two `liquid`+material presets in the
   * library the **iso-surface is lost, not just the material.** That is the owner's explicit override of the
   * plan, and its cost on exactly 2 presets.
   *
   * ⚠️ **AUTOMATING IT PINS THE COST TO A NUMBER SO IT CANNOT DRIFT SILENTLY.** If a third `liquid`+material
   * preset is ever authored, the trade's denominator changed and someone should be told — the clause asserts
   * the two named presets are still in that state rather than asserting the count, because the count lives in
   * the plan and re-deriving it here would be a fourth enumeration.
   */
  test('step 106j — on the two liquid+material presets, Materials-off costs the ISO-SURFACE, by design',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Flower Power II');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      const before = (await composer.hook())!;
      expect(before.renderMode, 'CALIBRATION: `Flower Power II` must resolve to `liquid` — `liquid` is the only '
        + 'mode that OCCLUDES rather than adding light, and it is the thing this step says is lost.')
        .toBe('liquid');
      expect(before.material, 'CALIBRATION: it must carry a live material; it is one of only two presets that '
        + 'are `liquid` AND materialled.').toBe('Plasma');

      await composer.setBypass('materials', true);
      const after = (await composer.hook())!;
      expect(after.renderMode, 'Materials-off did not force `star` on a liquid+material preset. That IS the '
        + 'owner\'s override of the plan — asserting it keeps the stated cost from drifting into a defect '
        + 'report.').toBe('star');

      const sig = await composer.canvasSignature();
      expect(sig.lit, 'the iso-surface loss blacked the frame. Losing the surface is the accepted trade; '
        + 'losing the picture is not.').toBeGreaterThan(0);

      /*
       * ═══ Phase 17.5 — the GL clause ══════════════════════════════════════════════════════════════════════
       * ⚠️ **THE ACCEPTED COST IS THE ISO-SURFACE AND NOTHING ELSE, SO THE SWEEP IS PART OF WHAT "BY DESIGN" HAS
       * TO MEAN.** This is the heaviest mode transition the bypass performs — `liquid` is the only mode that
       * OCCLUDES rather than adding light, and it is being swapped for `star` mid-session while the shared
       * velocity field's `isActive()` sources change under it. A stalled integrator here would leave `lit > 0`
       * (the surface's last frame is lit) and read as the documented trade.
       */
      await composer.assertIntegratorAdvanced();
    });

  /*
   * ⚠️ **106k IS THE "MUST NOT CHANGE" DIRECTION AND IT IS THE ONE A PERMISSIVE IMPLEMENTATION FAILS.** FX-off
   * flattens only `volume`, `liquid` and `splat`; `pixel`/`blend`/`star` are left as authored.
   * **A `star` preset that changes appearance here means the plain set is being INFERRED instead of read** —
   * `PLAIN_BYPASS_MODES` is the named owner. (It held four members until `log-density` was retired on
   * 2026-09-19; the assertion is over the SET, so count it rather than trusting a size in this comment.)
   *
   * ⚠️ **`Cylinder` IS ALSO THE RIGHT PRESET TO JUDGE ANY BRIGHTNESS CHANGE ON** (`CLAUDE.md`: judge shape and
   * grading changes on a LOW-ACCUMULATION preset and measure the FINAL 8-bit output), which is why the tolerance
   * here is tight rather than generous.
   */
  test('step 106k — both boxes on a plain `star` preset change NOTHING', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');
    await composer.openComposer();
    await composer.assertBypassBoxesPresent();

    const before = (await composer.hook())!;
    expect(before.renderMode, 'CALIBRATION: `Cylinder` must be `star` — a member of `PLAIN_BYPASS_MODES`. '
      + 'This step\'s whole content is that the plain set is READ, not inferred.').toBe('star');
    expect(before.material, 'CALIBRATION: `Cylinder` must carry no material.').toBeNull();
    const sigBefore = await composer.canvasSignature();

    await composer.setBypass('fx', true);
    await composer.setBypass('materials', true);

    const after = (await composer.hook())!;
    expect(after.renderMode, 'FX-off changed the mode on a `star` preset. A plain particle draw is not an '
      + 'effect — if this moves, the four-member plain set is being inferred instead of read from '
      + '`PLAIN_BYPASS_MODES`.').toBe('star');
    expect(after.filmLook, 'FX-off changed the film look on a plain preset.').toBe(before.filmLook);
    expect(after.figureScale).toBeCloseTo(before.figureScale, 6);

    // ⚠️ A LOW-ACCUMULATION preset, so a real brightness change shows up; the tolerance covers only the
    // wall-clock `dt` and the sparks `Math.random()` the plan measured.
    const sigAfter = await composer.canvasSignature();
    expect(Math.abs(sigAfter.mean - sigBefore.mean), 'the picture changed on a plain `star` preset with no '
      + 'material and no effects. Measured on a LOW-ACCUMULATION preset deliberately, so this tolerance is '
      + 'tight.').toBeLessThanOrEqual(6);

    /*
     * ═══ Phase 17.5 — the GL clause, AND HERE IT IS THE INVERSE OF EVERY OTHER ONE ══════════════════════════
     * ⚠️ **THIS STEP'S SUBJECT IS THAT NOTHING CHANGED, SO ITS CLAUSES ALL PASS ON A DEAD ENGINE — INCLUDING THE
     * TIGHT `mean` TOLERANCE, WHICH A FROZEN FRAME SATISFIES PERFECTLY (difference 0).** That is the sharpest form
     * of *"a confirmation is evidence only if a specific failure was available to it"*: an inertness assertion is
     * the one shape that gets STRONGER when the subject stops working. `pos` is what makes the green mean
     * something — the picture is unchanged **and** the figure is still sweeping.
     */
    await composer.assertIntegratorAdvanced();
  });

  /*
   * ⚠️ **106l IS WHY THE FLAGS ARE ENGINE-SIDE AT ALL: THE BYPASS MUST HOLD WITH THE COMPOSER NEVER BUILT.**
   * `CLAUDE.md`: *"it is applied ENGINE-SIDE from `applyPresetChange`/`resetOverlays`, because the bypass must
   * hold with the Lab closed."*
   *
   * ⚠️ **AND THE GRID/LAB EXCLUSIVITY IS THE INSTRUMENT TRAP HERE** — closing the Lab means clicking `Grid`,
   * which is a different view of the same panel. `dispose()` is not called on a tab switch but the tab IS
   * suspended, so a flag stored in the tab would survive this and a flag read from the tab would not.
   *
   * ⚠️ **106h's 2026-09-10 REVERSAL DOES NOT REACH THIS STEP, AND THE DISTINCTION IS THE WHOLE GATE: THE OWNER
   * RULED ON A *DIFFERENT PRESET ARRIVING*, NOT ON THE FLAGS BEING SHORT-LIVED.** Clicking `Grid` reaches no
   * apply path at all — no preset is selected, `applyPresetChange` does not run — so the flag must still hold
   * here. **Do not retire this step as collateral of 106h**: 106h and this one are the two sides `isSamePreset`
   * separates, and a clear that fired on every panel switch would pass 106h and fail here. ⚠️ **The `Grid` button
   * this step clicks is also the way IN to 106h's second load, so the two steps drive the same button to opposite
   * expectations — what differs is the tile click that follows it.**
   */
  test('step 106l — the bypass holds with the Lab CLOSED, and the box agrees on re-open',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aurora Borealis');
      await composer.openComposer();
      await composer.assertBypassBoxesPresent();

      await composer.setBypass('materials', true);
      const bypassedSig = await composer.canvasSignature();

      await composer.closeLab();
      await composer.page.waitForTimeout(600);

      const closed = (await composer.hook())!;
      expect(closed.bypassMaterials, 'the flag died with the Lab. It lives in the engine precisely so the '
        + 'bypass holds while the Composer is not built.').toBe(true);
      expect(closed.renderMode, 'the authored mode came back once the Lab closed — the bypass is being applied '
        + 'from the TAB rather than engine-side.').toBe('star');
      const closedSig = await composer.canvasSignature();
      expect(Math.abs(closedSig.mean - bypassedSig.mean), 'the picture changed when the Lab closed.')
        .toBeLessThanOrEqual(8);

      /*
       * ═══ Phase 17.5 — the GL clause, ASSERTED WITH THE LAB CLOSED ═════════════════════════════════════════
       * ⚠️ **THE `mean` CLAUSE ABOVE IS AN INERTNESS CLAUSE AND A FROZEN FRAME SATISFIES IT WITH A DIFFERENCE OF
       * 0** — the same inversion as 106k. And this is the one place the suite observes the engine with the Lab
       * NOT built: closing it takes the whole panel through `setPanelMode()` and suspends every tab, which is
       * where a `GridTileRenderer` that keeps ticking (or a `suspend()` that stops something it should not) lands.
       * ⚠️ **Asserted BEFORE re-opening on purpose:** re-opening would resume everything and hide a stall.
       */
      await composer.assertIntegratorAdvanced();

      await composer.openComposer();
      // ⚠️ Inverted with the `Apply` polarity — the flag is still a bypass, so agreement means UNTICKED. Read
      // through `isBypassed()`, the one place the `!` lives.
      expect(await composer.isBypassed('materials'), 'the box came back saying `Apply` over a still-bypassed '
        + 'engine — the state is repainted from the controls on every `sync()`, so this is the tab disagreeing '
        + 'with the picture.').toBe(true);
      await expect(composer.notice('bypass')).toBeVisible();
    });

  /*
   * ⚠️ **106m WAS "TWO CONTROLS THAT SOUND THE SAME"; THE OWNER REMOVED ONE OF THEM (2026-09-10), SO THE STEP IS
   * NOW `Speed` DOES NOT RESET THE POSE **AND** THERE IS NO SECOND SPEED CONTROL TO CONFUSE IT WITH.** The reason
   * for the removal is the reason the pair was worth a step in the first place: `speedFactor` and `waveSpeed`
   * multiply the SAME advance (`main.ts` scales `dt`, `lissajous.ts` then adds `waveSpeed · correction`), so the
   * visible rate was a product of two controls two sections apart — and only one of them reset the pose.
   *
   * ⚠️ **THE `Sweep rate` HALF IS NOT DELETED, IT IS INVERTED — AND THAT IS THE ONLY HONEST MOVE HERE.** The
   * original clause asserted `pos` goes DOWN on a sweep-rate change; the control is gone, so the assertion is
   * unperformable. Dropping it silently would leave the step's title claiming a contrast it no longer measures
   * (*"a step that cannot be performed is worse than one quoting retired copy"* — but a step that quietly stops
   * measuring half its subject is worse than both). It becomes an ABSENCE clause with a positive anchor, in
   * `assertNoSweepRateControl()`.
   *
   * ⚠️ **`pos` IS STILL THE ONLY CHANNEL THAT CAN SEE THE SURVIVING HALF, WHICH IS PHASE 2's ENTIRE
   * JUSTIFICATION.** A canvas diff says *"the picture changed"* whether the pose was preserved or reset; a reset
   * shows up as `pos` going DOWN and nowhere else.
   */
  test('step 106m — Speed does NOT reset the pose, and no `Sweep rate` control remains to confuse it with',
    async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();

    await composer.page.waitForTimeout(1200);
    const beforeSpeed = (await composer.hook())!;
    expect(beforeSpeed.pos, 'CALIBRATION: `pos` is still at its opening value, so a RESET below would be '
      + 'indistinguishable from no change at all.').toBeGreaterThan(0.5);

    const newSpeed = await composer.dragSpeedTo(0.9);
    expect(newSpeed, 'the Speed slider did not change `speedFactor`. It is `speedFactor` — NOT '
      + '`generators.waveSpeed` and NOT `WaveConfig.speed`.').not.toBeCloseTo(beforeSpeed.speedFactor, 3);

    const afterSpeed = (await composer.hook())!;
    expect(afterSpeed.pos, 'the Speed slider RESET the pose. It must not: it scales the advance, it does not '
      + 're-init the generator. That was the removed `Sweep rate` row\'s behaviour, and a canvas diff cannot tell '
      + 'the two apart — which is why `pos` was published.').toBeGreaterThanOrEqual(beforeSpeed.pos);

    /*
     * ═══ Phase 17.5 — the GL clause, AND THIS ONE PATCHES A REAL HOLE IN THE CLAUSE ABOVE ════════════════════
     * ⚠️ **`toBeGreaterThanOrEqual` IS SATISFIED BY A STOPPED INTEGRATOR — EQUALITY IS THE FROZEN CASE.** It has
     * to be `>=` rather than `>` (the drag is faster than a frame at low `speedFactor`, so `pos` may legitimately
     * be unchanged at that instant), which means the clause cannot distinguish *"did not reset"* from *"stopped
     * advancing"* — and a Speed slider that froze the figure would report a PASS on the step whose whole subject
     * is that it does not disturb the sweep. The step's own words are *"the figure speeds up or slows down"*, so
     * moving is half the claim.
     */
    await composer.assertIntegratorAdvanced();

    /*
     * ---- and the control that MAY reset is GONE (2026-09-10) ----
     *
     * ⚠️ **THIS REPLACED A DRIVE, AND THE REPLACEMENT IS WEAKER ON PURPOSE RATHER THAN BY OVERSIGHT.** The
     * original half filled `Sweep rate` with half its value and asserted `pos` fell; nothing on the tab can now
     * re-init the generator, so there is no control left whose pose reset this step could observe. What remains
     * measurable is that the confusable second surface is absent — asserted with a positive anchor, because a
     * bare count-0 also passes over a tab that failed to build.
     *
     * ⚠️ **`generators.waveSpeed` STILL EXISTS AND STILL RESETS THE POSE WHEN IT CHANGES.** The step no longer
     * covers that behaviour because no user-reachable control on this tab triggers it — not because the engine
     * stopped doing it. **Do not read this clause as *"waveSpeed is inert now."***
     */
    await composer.assertNoSweepRateControl();
  });

  /*
   * ⚠️ **106n IS A STATED LIMIT PLUS ITS ONE REAL FAILURE MODE, AND CONFLATING THEM WOULD FILE THE DESIGN AS A
   * BUG.** `setSpeedFactor` does not notify, so a Visual FX drag will NOT move this handle — **by design**,
   * because notifying would put a full resync of every subscriber inside the drag loop. **But the reverse
   * direction must work.** One-way staleness is the design; two-way staleness is a defect.
   *
   * ⚠️ **AND THE SELECTOR IS THE TRAP: VISUAL FX'S SPEED ROW USES THE SAME `.sl-vfx-row` / `.sl-vfx-label` /
   * `.sl-vfx-slider` CLASSES** (`composer.ts` reuses them deliberately). An unscoped `.sl-vfx-slider` would
   * find Visual FX's handle the moment that tab is open — i.e. exactly during this step. The fixture scopes to
   * `.sl-tab-content` and matches the row by its label, so the two cannot be confused.
   */
  test('step 106n — the one-way staleness is the design, the reverse direction WORKS, and Argus opens at 0.6×',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Argus');
      await composer.openComposer();

      // ⚠️ **THE PART THAT IS A PLAIN CORRECTNESS CLAIM: the handle must open at the preset's value.**
      const opened = (await composer.hook())!;
      expect(opened.speedFactor, 'CALIBRATION: `Argus` is measured at speedFactor 0.6 — one of the presets that '
        + 'ship a value other than 1. If it changed, this half of the step is measuring nothing.')
        .toBeCloseTo(0.6, 2);
      const valueText = (await composer.speedValue().textContent())?.trim() ?? '';
      expect(valueText, 'the Speed readout must open at the preset\'s value, not at 1.00x. `fmtSpeed` is '
        + 'IMPORTED from `visual-fx.ts` — this copy adds no arithmetic of its own.').toBe('0.60x');

      // ---- the reverse direction: drag HERE, then check Visual FX agrees ----
      const driven = await composer.dragSpeedTo(0.75);
      expect(driven, 'dragging the Composer\'s Speed did not move `speedFactor`.').not.toBeCloseTo(0.6, 2);

      /*
       * ⚠️ **THIS LOCATOR MUST NAME VISUAL FX'S OWN PANE, AND WRITING IT AS `SEL.tabContent` WAS A DEFECT I
       * FIXED.** With both tabs initialised, `.sl-tab-content .sl-vfx-row:has(…"Speed")` matches TWO rows — the
       * Composer's and Visual FX's — so `toHaveCount(1)` fails and the failure would read as *"Visual FX has no
       * Speed row"*, accusing the subject for a harness reason. **The whole point of this half of 106n is that
       * the two rows are DIFFERENT elements, so each must be addressed through its own pane.**
       */
      await composer.openTab('visual-fx');
      const vfxSpeedRow = `${SEL.tabPane('visual-fx')} .sl-vfx-row:has(> .sl-vfx-label:text-is("Speed"))`;
      const vfxValue = composer.page.locator(`${vfxSpeedRow} .sl-vfx-value`);
      await expect(vfxValue, 'CALIBRATION: no Speed row on the Visual FX tab, so the agreement claim below '
        + 'would pass over an empty locator.').toHaveCount(1);
      const vfxText = (await vfxValue.textContent())?.trim() ?? '';
      expect(vfxText, 'Visual FX disagrees with the speed the Composer set. ONE-WAY staleness (FX → Composer) '
        + 'is the design and is not a defect; TWO-WAY staleness is — Visual FX resyncs whenever it is next '
        + 'opened, so this direction must work.').toBe(`${driven.toFixed(2)}x`);

      // ⚠️ **AND THE DESIGNED LIMIT, ASSERTED AS A LIMIT SO IT CANNOT BE FILED AS A BUG LATER.** Driving FX's
      // slider must NOT move the Composer's handle until something else emits.
      const fxSlider = composer.page.locator(`${vfxSpeedRow} input.sl-vfx-slider`);
      await fxSlider.evaluate((el) => {
        const input = el as HTMLInputElement;
        input.value = '0.4';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await composer.page.waitForTimeout(300);
      const afterFxDrag = (await composer.hook())!;

      await composer.openTab('composer');
      // ⚠️ Re-opening the tab is NOT the "something else emits" case — `sync()` runs on show, so the handle is
      // expected to agree here. The documented staleness is *while both are open*, which a single-panel Lab
      // cannot present; the assertion below states what IS observable and names what is not.
      const backText = (await composer.speedValue().textContent())?.trim() ?? '';
      expect(backText, 'the Composer\'s Speed readout disagrees with the engine after a tab switch. The '
        + 'documented limit is that no NOTIFY fires during a Visual FX drag — it is NOT that the handle may be '
        + 'wrong once `sync()` has run. Do not "fix" the limit by adding a notify; a full resync per drag frame '
        + 'is the cost that was rejected.').toBe(`${afterFxDrag.speedFactor.toFixed(2)}x`);
    });
});

/* ------------------------------------------------------------------------------------------------------------
 * §A14 — the two readouts (E111): the flat-pane caption and the period phrase
 * ---------------------------------------------------------------------------------------------------------- */

test.describe('§A14 · The two readouts — steps 107a–107i', () => {
  /*
   * ⚠️ **THE BLOCK'S PREMISE IS THE PHASE'S OWN HISTORY: THREE OF ITS DEFECTS WERE READOUTS AND ALL THREE WERE
   * CONFIDENTLY WRONG RATHER THAN BLANK** — the Score sampled at `t = 0`, the ghost's no-op guard, the
   * mislabelled legend. **A readout that says nothing is recoverable; one that says the wrong thing is
   * believed.** So every clause here asks *"is the text TRUE"*, never *"is there text"*.
   */

  /*
   * ⚠️ **107a AND 107b ARE ONE SCREEN, AND 107b IS THE STEP'S REAL CONTENT: THE WORDING WAS NARROWED BY
   * MEASUREMENT.** It must NOT say `no Z size` or name any axis — a pane is flat iff neither of its axes
   * REACHES anywhere, and `sin((n + phase) · fm) · am` is zero when `fm` is zero **whatever `am` is**. So a
   * winding of 0 flattens a pane whose two sizes are large and real, and a caption naming a cause would be
   * confidently wrong on that reachable case.
   *
   * ⚠️ **THE CAPTION MUST ALSO BE HOVERABLE — the tooltip carries the cause, the caption carries only the
   * claim.** `panel.css` writing it as `pointer-events: none` was a real defect, so `title` presence is
   * asserted rather than assumed.
   *
   * ⚠️ **MY FLAT-PANE BASIS DIFFERS FROM THE PLAN'S AND BOTH ARE STATED: 25 of 2319 NON-SILENT panes here, 28
   * of 3591 ALL panes there.** `CLAUDE.md`: *"a one-off difference is a BASIS difference, not an event"* — do
   * not reconcile the numerators. What the step needs is that the five NAMED cases are still in that state, and
   * they are.
   */
  test('steps 107a, 107b — Radar\'s Detail X / Y pane reads the flat caption, which names NO axis and IS '
    + 'hoverable', async ({ composer }) => {
      test.slow();
      await composer.boot();
      await composer.loadPreset('Radar');
      await composer.openComposer();
      await composer.assertFlatCaptionsExist();

      const flat = composer.paneFlatCaption('Detail', 'X / Y');
      await expect(flat, 'CALIBRATION: Radar\'s Detail row has no `X / Y` pane at all — the pane is addressed '
        + 'by its shipped aria-label (`"<Level> in <Plane>"`), never by index, because a positional claim '
        + 'cannot see a permutation.').toHaveCount(1);
      await expect(flat, 'Radar\'s Detail `X / Y` pane is not showing the flat caption. Measured: that pane has '
        + 'no reach in its plane, so without the caption it draws a bare crosshair — the diagram being exactly '
        + 'honest and reading as broken.').toBeVisible();

      const text = (await flat.textContent())?.trim() ?? '';
      expect(text, 'the flat caption\'s wording changed.').toBe(FLAT_PANE_CAPTION);
      // ⚠️ **THE ABSENCE HALF, AND IT IS THE ONE MEASUREMENT FALSIFIED THE PLAN'S OWN ILLUSTRATION ON.**
      expect(text, 'the caption names an AXIS. It must not: a winding of 0 flattens a pane whose two sizes are '
        + 'large and real, so `no Z size` is confidently wrong on a reachable case — and a confidently wrong '
        + 'explanation is this phase\'s signature defect (three for three were wrong EXPLANATIONS).')
        .not.toMatch(/\b(no [XYZ] size|[XYZ] axis)\b/);
      expect(text, 'the caption names a CAUSE. The ROW READOUT is what may name a silent axis; the caption '
        + 'states only that the plane is empty.').not.toMatch(/winding|size|inert/i);

      const title = await flat.getAttribute('title');
      expect(title, 'the caption carries no tooltip. The caption is the SHORT claim and the tooltip carries the '
        + 'cause — and it is only reachable because the caption is NOT `pointer-events: none`, which was a real '
        + 'defect in `panel.css`.').toBeTruthy();
      expect((title ?? '').length, 'the tooltip is empty — an unlisted `TAB_TIPS` key resolves to `undefined` '
        + 'and sets `title = "undefined"`, which nothing else in the project can see.').toBeGreaterThan(10);

      // ⚠️ The OTHER two panes of that row must draw curves, which is what makes the claim specific rather
      // than "this preset is flat". Derived from `PLANE_CAPTIONS` rather than retyped, so a plane added or
      // renamed in `score-canvas.ts` cannot leave this loop quietly checking two of three.
      for (const plane of PLANE_CAPTIONS.filter((p) => p !== 'X / Y')) {
        expect(await composer.paneIsFlat('Detail', plane), `Radar's Detail ${plane} pane is ALSO flat. The step `
          + 'names one plane; three flat panes on a lit row means the oracle is reading one plane for all '
          + 'three (invariant 29).').toBe(false);
      }
    });

  /*
   * ⚠️ **THE FOUR OTHER MEASURED FLAT PANES, SPOT-CHECKED — AND THIS IS AN INVARIANT-29 CLAUSE.** *"An oracle
   * for a three-axis subject must read ALL THREE PLANES"* — it cost three wrong findings in one sitting. Each
   * case below names a DIFFERENT plane on a different level, so a one-plane oracle cannot pass them all.
   */
  const FLAT_CASES = [
    { preset: 'Andromeda', level: 'Structure', plane: 'X / Y' },
    { preset: 'Anima Electrica', level: 'Structure', plane: 'X / Z' },
    { preset: 'Nova2', level: 'Structure', plane: 'X / Y' },
    { preset: 'Fluid Metall', level: 'Body', plane: 'Y / Z' },
  ] as const;

  for (const c of FLAT_CASES) {
    test(`step 107b — ${c.preset} ${c.level}/${c.plane} is flat (three different PLANES across these cases, `
      + 'which a one-plane oracle cannot pass)', async ({ composer }) => {
        test.slow();
        await composer.boot();
        await composer.loadPreset(c.preset);
        await composer.openComposer();
        await composer.assertFlatCaptionsExist();

        expect(await composer.paneIsFlat(c.level, c.plane),
          `${c.preset}'s ${c.level} ${c.plane} pane is not showing the flat caption. Measured across the `
          + 'library before this spec was written; the cases deliberately span all three planes because an '
          + 'oracle reading ONE plane of a three-axis subject is invariant 29\'s defect.').toBe(true);
      });
  }

  /*
   * ⚠️ **107c IS A SECOND-OWNER CLAUSE: THE CAPTION MUST NOT APPEAR ON AN EMPTY ROW.** An empty row already has
   * copy — `empty — nothing authored here` — and *"three `flat here` captions on an empty row would be a second
   * owner of a state that already has copy"*, which is 16.17's post-mortem exactly.
   *
   * ⚠️ **AND `New Figure` MUST SEED A LIT FIGURE, NOT `MigrationLayer.defaultWave()`** — all zeros renders
   * BLACK. So Body is expected NOT to be empty, which is also the anchor that keeps the absence claim from
   * passing over a blank tab.
   */
  test('step 107c — an EMPTY row shows its own copy and NO flat captions', async ({ composer }) => {
    test.slow();
    await composer.boot();
    await composer.openComposer();
    await composer.assertFlatCaptionsExist();

    const newFigure = composer.page.locator(`${SEL.tabContent} button:has-text("New Figure")`);
    await expect(newFigure, 'CALIBRATION: no `New Figure` button — this step has no other way to reach an '
      + 'empty row.').toHaveCount(1);
    await newFigure.click();
    await composer.page.waitForTimeout(500);

    expect(await composer.isEmptyRow(1), 'CALIBRATION: Structure is not empty after `New Figure`, so the '
      + 'absence claim below is about a lit row and proves nothing.').toBe(true);
    expect(await composer.isEmptyRow(2), 'CALIBRATION: Detail is not empty after `New Figure`.').toBe(true);
    expect(await composer.isEmptyRow(0), 'Body is EMPTY after `New Figure` — it must seed a measured LIT '
      + 'figure, because `MigrationLayer.defaultWave()` is all zeros and renders BLACK.').toBe(false);

    // ⚠️ An empty row draws no panes at all, so the absence is asserted over the ROW rather than over a pane
    // locator that could match nothing for the wrong reason.
    for (const n of [1, 2]) {
      const caps = composer.slot(n).locator('.sl-composer-pane-flat:visible');
      expect(await caps.count(), `slot ${n} is empty and shows a "flat here" caption. The empty state already `
        + 'has its own copy; a second owner of one state is 16.17\'s post-mortem repeating.').toBe(0);
    }
  });

  /*
   * ⚠️ **107d IS INVARIANT 29 VERBATIM: THE CAPTION MUST GRANT NOTHING.** *"The remedy for a silent axis is to
   * SAY SO; do not grant the axis a size"* — one control that lit Z would turn every planar preset in the
   * library 3D from a single click.
   *
   * ⚠️ **AN ABSENCE CLAIM, SO THE ANCHOR IS ASSERTED FIRST.** `assertAbsentAgainstLivePage`'s rule, inlined
   * here because the anchor is the caption itself: if the caption is not VISIBLE, "no button inside it" is true
   * of every pane in the library.
   */
  test('step 107d — the flat pane offers no button, no click target and no fix', async ({ composer }) => {
    test.slow();
    await composer.boot();
    await composer.loadPreset('Radar');
    await composer.openComposer();
    await composer.assertFlatCaptionsExist();

    const pane = composer.pane('Detail', 'X / Y');
    await expect(composer.paneFlatCaption('Detail', 'X / Y'), 'CALIBRATION: the pane is not in the flat state, '
      + 'so "it offers no remedy" is trivially true of it.').toBeVisible();

    expect(await pane.locator('button').count(), 'the flat pane carries a BUTTON. Invariant 29: the remedy for '
      + 'a silent axis is to SAY SO — one control that lit Z would turn every planar preset in the library 3D '
      + 'from a single click.').toBe(0);
    expect(await pane.locator('a, [role="button"], input').count(), 'the flat pane carries a click target.')
      .toBe(0);

    const paneText = (await pane.textContent()) ?? '';
    expect(paneText, 'the flat pane OFFERS to fix itself. It may state the fact and nothing more.')
      .not.toMatch(/give it|add|fix|enable|make it/i);
  });

  /*
   * ⚠️ **107e IS THE STEP THAT PROVES THE COMMENSURABILITY TEST RUNS, AND IT PUTS BOTH PHRASINGS ON ONE SCREEN.**
   * `Aurora Borealis` Body has live rates 1 and 1.1 — **not commensurate**, so the wave comes back round far
   * later than 120 s and the honest phrase is `slowest cycle`. Structure and Detail are 1, 2, 3 — commensurate,
   * so `repeats every`. ⚠️ **If both rows say `repeats every`, the test is not running and the readout is
   * confidently wrong on the row that matters** — 225 of 1197 library slots are in that state.
   */
  test('step 107e — Aurora Borealis shows BOTH period phrasings at once', async ({ composer }) => {
    test.slow();
    await composer.boot();
    await composer.loadPreset('Aurora Borealis');
    await composer.openComposer();

    const [body, structure, detail] = await composer.readoutTexts();
    expect(body, 'Body must read `slowest cycle 120 s`: its live rates are 1 and 1.1, which are NOT '
      + 'commensurate. `repeats every` here would mean the commensurability test is not running — and it is '
      + 'wrong on 225 of 1197 library slots.').toContain('slowest cycle 120 s');
    expect(structure, 'Structure must read `repeats every 120 s` — its rates (1, 2, 3) ARE commensurate.')
      .toContain('repeats every 120 s');
    expect(detail, 'Detail must read `repeats every 120 s`.').toContain('repeats every 120 s');

    // ⚠️ **THE SAME NUMBER WITH TWO DIFFERENT PHRASINGS IS THE POINT** — asserting the pair explicitly, because
    // each row read alone is satisfied by a collapsed implementation.
    expect(body, 'Body used the commensurate phrasing.').not.toContain('repeats every');
    expect(structure, 'Structure used the non-commensurate phrasing.').not.toContain('slowest cycle');
  });

  /*
   * ⚠️ **107f IS THE PRECISION CLAUSE AND THE UNITS ARE THE SUBJECT.** Breathe seconds are
   * `(360/rate)/(60·waveSpeed)` — an invariant-10 units claim, and *"a converter dropping `waveSpeed` is right
   * on nearly every preset and wrong by 10× on four."* Sub-10-second values print to one decimal; a period
   * under 1 s prints to three.
   */
  const PERIOD_CASES = [
    { preset: 'Aliens DNA', expected: ['repeats every 120 s', 'repeats every 12 s', 'repeats every 8 s'] },
    { preset: 'Radar', expected: ['1.7 s', '2.9 s', '1.6 s'] },
  ] as const;

  for (const c of PERIOD_CASES) {
    test(`step 107f — ${c.preset}'s three rows print the measured periods`, async ({ composer }) => {
      test.slow();
      await composer.boot();
      await composer.loadPreset(c.preset);
      await composer.openComposer();

      const texts = await composer.readoutTexts();
      for (let n = 0; n < 3; n++) {
        expect(texts[n], `${c.preset} slot ${n} must contain ${JSON.stringify(c.expected[n])}. The seconds are `
          + '`(360/rate)/(60·waveSpeed)` — an invariant-10 units claim, and a converter that drops `waveSpeed` '
          + 'is right on nearly every preset and wrong by 10× on four.').toContain(c.expected[n]);
      }
    });
  }

  /*
   * ⚠️ **107g IS AN ABSENCE CLAUSE AND EVERY REJECTED PLACEHOLDER IS A VALUE THE READER COULD BELIEVE.** *"`0`
   * reads as instant, `Infinity` reads as broken, `—` reads as missing data; all three are things a reader has
   * to attribute to something."* A wave with no pulse and no wobble does not repeat SLOWLY — it does not repeat
   * at all, and `slowestModulatorSeconds()` returns `null` so nothing prints.
   *
   * ⚠️ **`Quader` PUTS BOTH STATES SIDE BY SIDE ON ONE SCREEN**, which is what makes the absence specific
   * rather than "this preset prints nothing".
   */
  test('step 107g — Cylinder states NO period at all; Quader states one on two rows and none on the third',
    async ({ composer }) => {
      test.slow();
      await composer.boot();
      await composer.loadPreset('Cylinder');
      await composer.openComposer();

      const cyl = await composer.readoutTexts();
      for (let n = 0; n < 3; n++) {
        expect(cyl[n], `Cylinder slot ${n} printed a period phrase. None of its three slots modulates, so `
          + 'there is no period to state.').not.toMatch(/repeats every|slowest cycle/);
        expect(cyl[n], `Cylinder slot ${n} printed a PLACEHOLDER. \`0\` reads as instant, \`Infinity\` as `
          + 'broken, `—` as missing data — each is a value the reader has to attribute to something.')
          .not.toMatch(/Infinity|NaN|—|\b0 s\b/);
      }

      await composer.loadPreset('Quader');
      const quad = await composer.readoutTexts();
      expect(quad[0], 'Quader\'s Body must state NO period — the two states side by side on one screen is what '
        + 'makes this clause specific.').not.toMatch(/repeats every|slowest cycle/);
      expect(quad[1], 'Quader\'s Structure must read `slowest cycle 2 s`.').toContain('slowest cycle 2 s');
      expect(quad[2], 'Quader\'s Detail must read `slowest cycle 2 s`.').toContain('slowest cycle 2 s');
    });

  /*
   * ⚠️ **107h's ORIGINAL MECHANISM IS GONE AND ITS PROPERTY IS NOT — SO IT IS RE-POINTED AT A CONTROLLED PRESET
   * PAIR RATHER THAN RETIRED.** The step used to halve the `Sweep rate` control and assert every period label
   * doubled while no stored value moved. The owner removed that control (2026-09-10), which retires the DRIVE but
   * leaves the property it was measuring fully intact and arguably more important: **the label must be derived
   * from the figure's OWN stored `waveSpeed`, and a converter that hardcoded the modal 0.05 would be right on 375
   * of 399 presets and wrong on the rest** (invariant 10 through a readout; `composercheck` §M owns the span).
   *
   * ⚠️ **THE PAIR IS A MEASURED CONTROL, NOT A CONVENIENT CHOICE: `Firestorm` AND `Ember Storm` CARRY
   * BYTE-IDENTICAL MODULATOR CELLS AND DIFFER ONLY IN `generators.waveSpeed` (0.12 vs 0.10).** Verified by
   * importing both through `readFigure` and comparing every axis of every slot as JSON — identical — so the ONLY
   * thing that can explain a different label is the sweep rate. That is what makes this a stronger instrument
   * than the drag was: the drag changed one number on one figure, and a reader could attribute the new label to
   * the edit; here the figures are the same and only the stored rate differs.
   *
   * ⚠️ **THE RATIO IS EXACTLY 1.2 AND BOTH SETS OF LABELS ARE ASSERTED VERBATIM, because a RATIO clause alone
   * cannot see a converter that is wrong by a constant factor on both sides.** Measured: `Firestorm` prints
   * `62.5 / 50 / 100 s`, `Ember Storm` prints `75 / 60 / 120 s`. **A converter hardcoding 0.05 prints
   * `150 / 120 / 240 s` for BOTH** — which is why the two-preset form discriminates where one preset could not.
   *
   * ⚠️ **AND THE `no stored value moved` HALF SURVIVES IN A STRONGER FORM: the 21 raw inputs are compared ACROSS
   * the two presets and must be EQUAL.** Originally it proved a sweep-rate edit did not `commit()`; now it proves
   * the two different labels are not explained by any stored number at all. Same clause, better evidence.
   *
   * ⚠️ **BOTH PRESETS SHIP A NON-1 `speedFactor` (0.5 and 0.75) AND THE LABELS ABOVE IGNORE IT — THAT IS 107i's
   * DEFECT AND ITS PRESENCE HERE IS DELIBERATE.** These numbers are the readout's own arithmetic, not the wall
   * clock. Do not "correct" them when 107i is fixed: re-derive them from whichever fix lands.
   */
  test('step 107h — the period labels follow each figure\'s OWN stored sweep rate, on a pair whose stored '
    + 'fields are identical', async ({ composer }) => {
      test.slow();
      await composer.boot();
      await composer.loadPreset('Firestorm');
      await composer.openComposer();

      // ⚠️ The absence anchor sits here rather than in its own test: this is the step whose mechanism the removal
      // took away, so it is the step that has to state there is nothing left to drive.
      await composer.assertNoSweepRateControl();

      const fast = await composer.readoutTexts();
      const fastFields = await composer.numInputs(0).evaluateAll(
        (els) => els.map((e) => (e as HTMLInputElement).value));
      expect(fastFields.length, 'CALIBRATION: a lit row must carry 21 RAW inputs — the 12 percent/seconds '
        + 'breathe VIEWS are excluded, and counting 33 is green, stable and about a different quantity.')
        .toBe(21);

      // ⚠️ `slowest cycle` rather than `repeats every`: these rates are NOT commensurate, and the phrase is part
      // of the assertion — the two phrasings are separate measured properties of the same readout (16.20).
      expect(fast[0], '`Firestorm` Body did not print `slowest cycle 62.5 s`. At its stored `waveSpeed` of 0.12 '
        + 'that is the arithmetic; a converter hardcoding the library\'s modal 0.05 prints 150 s here — right on '
        + '375 of 399 presets and wrong on this one.').toContain('slowest cycle 62.5 s');
      expect(fast[1], '`Firestorm` Structure did not print `slowest cycle 50 s` (0.05 would print 120 s).')
        .toContain('slowest cycle 50 s');
      expect(fast[2], '`Firestorm` Detail did not print `slowest cycle 100 s` (0.05 would print 240 s).')
        .toContain('slowest cycle 100 s');

      // ---- the same figure at a different stored rate ----
      await composer.loadPreset('Ember Storm');
      const slow = await composer.readoutTexts();
      const slowFields = await composer.numInputs(0).evaluateAll(
        (els) => els.map((e) => (e as HTMLInputElement).value));

      expect(slowFields, 'CALIBRATION FAIL: `Firestorm` and `Ember Storm` no longer carry identical stored '
        + 'fields, so a different label below is explainable by the figure rather than by the sweep rate and '
        + 'this step is measuring nothing. Both were verified identical by importing them through `readFigure`; '
        + 'if one was retuned, re-measure and re-derive every number in this step.').toEqual(fastFields);

      expect(slow[0], '`Ember Storm` Body did not print `slowest cycle 75 s`. Its cells are IDENTICAL to '
        + '`Firestorm`\'s and its stored `waveSpeed` is 0.10 rather than 0.12, so the label must differ by '
        + 'exactly that ratio and by nothing else. A label that did not move means the readout is not '
        + 'recomputed when a figure arrives — a description of the PREVIOUS figure, this phase\'s signature '
        + 'defect.').toContain('slowest cycle 75 s');
      expect(slow[1], '`Ember Storm` Structure did not print `slowest cycle 60 s`.')
        .toContain('slowest cycle 60 s');
      expect(slow[2], '`Ember Storm` Detail did not print `slowest cycle 120 s`.')
        .toContain('slowest cycle 120 s');

      // ⚠️ The pair must actually DIFFER, or every clause above could be satisfied by a frozen readout printing
      // one preset's labels forever. An equality check on the two arrays is the cheapest thing that can see it.
      expect(slow, 'the two presets printed the SAME labels. They store different sweep rates, so identical '
        + 'labels mean the readout is not re-derived per figure — and every verbatim clause above would still '
        + 'have passed on whichever set happened to be stale.').not.toEqual(fast);
    });

  /*
   * ⚠️ **107i IS A PREDICTED FAILURE AND IT SHIPS AS AN EXECUTABLE ONE — `test.fail()` — WHICH INVERTS THIS
   * CLAUSE'S COLOUR.** A **GREEN 107i means the defect is STILL PRESENT.** If it ever turns RED, someone chose
   * one of the two one-line fixes and this clause plus step 107i must be rewritten to the new truth.
   *
   * ⚠️ **THE 2026-09-10 `Sweep rate` REMOVAL DID NOT FIX THIS AND DID NOT MAKE IT SMALLER — IT NARROWED THE
   * ARGUMENT.** While both controls existed, one could argue the readout described the FIGURE and `speedFactor`
   * described the PREVIEW, and a reader had one control for each. With the `Sweep rate` control gone,
   * `speedFactor` is **the only speed the user can change at all**, so a period readout that ignores it now
   * ignores the sole adjustable input to the quantity it prints. **That strengthens the "fold it in" side of the
   * choice below without settling it — the owner's ruling is still what is needed, and this clause must not be
   * re-pointed to assert either answer.**
   *
   * ⚠️ **WHY IT IS NOT PATCHED: THE FIX IS THE OWNER'S CHOICE AND THE TWO OPTIONS ARE NOT EQUIVALENT.** Either
   * fold `speedFactor` into the seconds — a preview-only slider then re-labels a stored figure's rows — or say
   * **NOMINAL** in the copy, the way Visual FX's Rotation readout already does for the same interaction. Both
   * are one-liners; they say different things to the reader.
   *
   * ⚠️ **AND WHY `test.fail()` RATHER THAN A PLAIN FAILING TEST: A PERMANENTLY RED SUITE IS ONE THE NEXT
   * SITTING LEARNS TO IGNORE.** This project's own rule about a checker applies — an assertion nobody reads is
   * an assertion nobody can fail. Marked, executed, and reported as expected.
   *
   * ⚠️ **THE DEFECT IS ALREADY WRONG ON LOAD, WHICH IS THE HALF THE DRAG OBSCURES**: 97 of 761 period-printing
   * slots across 49 presets ship a non-1 `speedFactor`, worst measured `Deep Thought2` Body printing 600 s
   * where the truth is 3000 s. So the clause checks the LOAD case too, on the worst preset, and that half is a
   * plain assertion about a measured number rather than a prediction.
   */
  test('step 107i — PREDICTED FAILURE: the period readout ignores `speedFactor` (a GREEN here means the defect '
    + 'is still present)', async ({ composer }) => {
      test.slow();
      test.fail(true, 'Known defect, measured before the test plan was written and deliberately NOT patched: '
        + 'the period is derived from the stored `waveSpeed` alone, so `speedFactor` — since 2026-09-10 the ONLY '
        + 'speed control the user has — does not reach it. The honest fix is either folding `speedFactor` into '
        + 'the seconds or saying NOMINAL '
        + 'in the copy, and the two are NOT equivalent, so the choice is the owner\'s. This clause asserts the '
        + 'CORRECT behaviour and is expected to fail; if it ever PASSES, the fix landed and both this test and '
        + 'step 107i must be rewritten.');

      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();

      const before = await composer.readoutTexts();
      expect(before[0], 'CALIBRATION: Body must open at `repeats every 120 s` for the doubling below to be '
        + 'meaningful.').toContain('repeats every 120 s');

      const speed = await composer.dragSpeedTo(1.0);
      expect(speed, 'CALIBRATION: the Speed slider did not reach 2× — the defect claim below needs the engine '
        + 'to actually be running at twice the rate.').toBeCloseTo(2.0, 1);

      const after = await composer.readoutTexts();
      // ⚠️ THE ASSERTION IS THE TRUTH, NOT THE CURRENT BEHAVIOUR. At 2× the figure comes back round in ~60 s.
      expect(after[0], 'the period readout ignored `speedFactor`: it still says 120 s while the figure now '
        + 'comes back round in about 60 s. `Speed` (16.19) is now the tab\'s only speed control, and the readout '
        + 'added '
        + 'by 16.20 does not read it.').toContain('repeats every 60 s');
    });

  /*
   * ⚠️ **THE LOAD-TIME HALF OF 107i, AND IT IS A PLAIN ASSERTION ABOUT A MEASURED NUMBER — NOT A PREDICTION.**
   * `Deep Thought2` ships `speedFactor` 0.2, so its Body prints **600 s** where the truth is **3000 s** (5×
   * out) with no slider ever touched. **This is the half a drag-only test would miss entirely**, and it is why
   * the defect is not merely a stale-label problem: it is wrong the moment the preset loads.
   *
   * ⚠️ **IT IS WRITTEN TO PASS, ASSERTING THE WRONG-BUT-CURRENT VALUE, AND IT SAYS SO IN ITS OWN MESSAGE.** A
   * second `test.fail()` would hide a real regression: if the printed number ever stops being 600 s, either the
   * fix landed or the preset changed, and both need a human.
   */
  test('step 107i (load half) — Deep Thought2 prints 600 s where the truth is 3000 s, with no slider touched',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Deep Thought2');
      await composer.openComposer();

      const h = (await composer.hook())!;
      expect(h.speedFactor, 'CALIBRATION: `Deep Thought2` is measured at speedFactor 0.2 — the worst case of '
        + 'the 49 presets that ship a non-1 value. If it changed, this clause is about a different figure.')
        .toBeCloseTo(0.2, 2);

      const [body] = await composer.readoutTexts();
      // ⚠️ Asserting the CURRENT, WRONG value on purpose: 600 s is `Sweep rate` alone; 3000 s is the truth
      // once `speedFactor` 0.2 is applied. A change in either direction needs a human, which is why this is
      // a normal test and not a second `test.fail()`.
      expect(body, 'the printed period is no longer 600 s. Either 107i\'s defect was fixed (in which case say '
        + 'WHICH of the two one-line fixes was chosen, and rewrite step 107i and the expected-failure clause '
        + 'above) or the preset was retuned. Both need a human — the truth at speedFactor 0.2 is 3000 s.')
        .toContain('600 s');
    });
});
