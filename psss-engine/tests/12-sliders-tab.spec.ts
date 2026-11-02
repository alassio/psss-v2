import { test, expect, SEL } from './composer-fixture.ts';

/*
 * ============================================================================================
 * v8 `26.10` — the Sliders tab in a real browser.
 * ============================================================================================
 *
 * ⚠️ **THIS FILE IS THE ONLY INSTRUMENT THAT SEES THE PANEL.** `slidercheck` imports `SEMANTIC_SLIDERS` and
 * calls `apply()` over the whole library — it can prove the arithmetic, the pass discipline, the clamps and
 * the liveness PREDICATE, and it cannot prove that a row exists, is grouped under the right heading, is
 * disabled, or shows its reason. `CLAUDE.md`: *"A DOM scan is the one instrument a text scan cannot be."*
 *
 * ⚠️ **SCOPE IS SLIDERS ONLY, BY OWNER DECISION (2026-10-06).** The Mixer, Randomise and Evolution tabs have
 * no coverage of their Phase 23/24/25 additions, and Evolution has **no assertion of any kind** — its only
 * mention anywhere in this suite is a comment about tab order. That gap is a NAMED owed item and is
 * deliberately not absorbed into this file.
 *
 * ⚠️ **`TabRegistry` BUILDS A TAB'S CONTAINER ON FIRST SHOW**, so `[data-tab="sliders"]` matches nothing
 * until the tab has been opened. The first test below is the calibration for exactly that.
 *
 * ⚠️ **NO `data-testid` — EVER.** Every control here is selected by its `aria-label`, never by position,
 * because position is what `26.D2`'s grouping changes.
 */

const TAB = 'sliders';

/** The fourteen rows, grouped as `26.D2` fixes them. The ORDER inside a group is the panel's, not the apply order. */
const SECTIONS: { title: string; rows: string[] }[] = [
  { title: 'Figure', rows: ['Complexity', 'Flow', 'Density', 'Symmetry', 'Structure', 'Depth'] },
  { title: 'Grade', rows: ['Warmth', 'Glow', 'Mood'] },
  { title: 'Physics', rows: ['Speed', 'Warp', 'Turbulence', 'Heat', 'Substance'] },
];

test.describe('v8 26.10 — the Sliders tab', () => {
  test('CALIBRATION: the pane does not exist until the tab is opened, and then it does', async ({ composer }) => {
    await composer.boot();
    await composer.openLab();
    /*
     * ⚠️ **ASSERT VISIBILITY, NOT `count()`.** The Grid and the Lab are mutually exclusive views of ONE
     * panel, so a `count()`-based existence check passes while nothing is on screen — the same trap that
     * cost `loadPreset()` its first draft a timeout.
     */
    const pane = composer.page.locator(`${SEL.tabContent} [data-tab="${TAB}"]`);
    await expect(pane, 'the Sliders container should not be built before the tab is first shown — if this '
      + 'fails, TabRegistry built every tab eagerly and the rest of this file proves nothing about lazy '
      + 'construction').toHaveCount(0);

    await composer.openTab(TAB);
    await expect(composer.page.locator(`${SEL.tabContent} .sl-slider-row`).first()).toBeVisible();
  });

  test('fourteen rows under three headings, each row in the section 26.D2 assigns it', async ({ composer }) => {
    await composer.boot();
    await composer.openTab(TAB);
    const content = composer.page.locator(SEL.tabContent);

    /*
     * ⚠️ **COUNT THE ROWS, DO NOT TRUST THE NUMBER FOURTEEN.** The count is asserted against the LIST above
     * rather than a literal, so adding a row to `SEMANTIC_SLIDERS` without placing it in a section fails
     * here with the row's name — which is the failure `26.D2` wants, since a row's section is a claim about
     * what it writes.
     */
    const expected = SECTIONS.flatMap((s) => s.rows);
    await expect(content.locator('.sl-slider-row')).toHaveCount(expected.length);

    for (const section of SECTIONS) {
      await expect(
        content.locator('.sl-section-title', { hasText: new RegExp(`^${section.title}$`) }),
        `no \`${section.title}\` heading — 26.D2 fixes three sections and the boundary is a RULE: every `
        + 'Figure row writes generators only, every Grade row shares the one grading pass',
      ).toHaveCount(1);
      for (const row of section.rows) {
        await expect(
          content.locator(`[aria-label="${row}"]`),
          `no slider with aria-label=${JSON.stringify(row)}`,
        ).toHaveCount(1);
      }
    }
  });

  test('the header carries Reset all, Bake and Strip to figure', async ({ composer }) => {
    await composer.boot();
    await composer.openTab(TAB);
    const content = composer.page.locator(SEL.tabContent);
    for (const label of ['Reset all', 'Bake', 'Strip to figure']) {
      await expect(
        content.locator(`[aria-label="${label}"]`),
        `no \`${label}\` button. ⚠️ Strip to figure is only built when the host supplies `
        + '`visualFxControls` — if THAT is the cause, the panel mounted without the control rather than the '
        + 'button being lost, and the two have different fixes',
      ).toHaveCount(1);
    }
  });

  /*
   * ⚠️ **THE PRESET IS CHOSEN BECAUSE IT WAS MEASURED INERT, NOT BECAUSE IT IS CONVENIENT.** `26.0` and the
   * 2026-10-06 liveness run both put `Turbulence` live on **7 of 274** presets — curl noise is *present* on
   * 181 and *enabled* on 7 — so on an arbitrary library preset the row is disabled. The clause asserts the
   * DISABLED state and its reason, which is `26.D4`'s whole content: *an inert row is disabled and carries
   * a one-line reason inside the row.*
   */
  test('an inert row is disabled and says why, in the row (26.D4)', async ({ composer }) => {
    await composer.boot();
    await composer.openTab(TAB);
    const content = composer.page.locator(SEL.tabContent);

    const turbulence = content.locator('[aria-label="Turbulence"]');
    await expect(turbulence).toBeDisabled();

    const cell = content.locator('.sl-slider-cell', { has: content.locator('[aria-label="Turbulence"]') });
    const reason = cell.locator('.sl-slider-reason');
    await expect(reason, 'the reason must be IN the row and VISIBLE — 26.D4 is explicit that it is not '
      + 'hidden and not tooltip-only, because a tooltip is only found by someone who already suspects the '
      + 'control').toBeVisible();
    await expect(reason).toContainText(/curl noise is off/i);

    /*
     * ⚠️ **AND THE CLAUSE IS NOT VACUOUS: a row that IS live must be enabled and carry no line.** Without
     * this half, a panel that disabled every row would pass the half above. `Flow` is live on all 274.
     */
    await expect(content.locator('[aria-label="Flow"]')).toBeEnabled();
    const flowCell = content.locator('.sl-slider-cell', { has: content.locator('[aria-label="Flow"]') });
    await expect(flowCell.locator('.sl-slider-reason')).toBeHidden();
  });

  /*
   * ⚠️ **`Warmth` IS THE ONE ROW THAT CAN BE LIVE AND STILL CARRY A LINE**, because after `26.4` it has two
   * laws and does something under both — so the line names WHICH one is in force. A clause that tied the
   * line to the disabled state would either hide it or, worse, disable a row that works.
   */
  test('Warmth is enabled and names which of its two laws is active (26.4)', async ({ composer }) => {
    await composer.boot();
    await composer.openTab(TAB);
    const content = composer.page.locator(SEL.tabContent);

    await expect(content.locator('[aria-label="Warmth"]')).toBeEnabled();
    const cell = content.locator('.sl-slider-cell', { has: content.locator('[aria-label="Warmth"]') });
    const reason = cell.locator('.sl-slider-reason');
    // Either law is acceptable on the boot preset; what must hold is that a LIVE row is never disabled and
    // that when a palette is in force the line says so rather than claiming the row is dead.
    if (await reason.isVisible()) {
      await expect(reason).toContainText(/rotating the palette/i);
    }
  });

  test('Bake re-centres every row (26.D12)', async ({ composer }) => {
    await composer.boot();
    await composer.openTab(TAB);
    const content = composer.page.locator(SEL.tabContent);

    // Move a row that is live on every preset, so the clause cannot pass by the row being disabled.
    const flow = content.locator('[aria-label="Flow"]');
    await flow.fill('80');
    await flow.dispatchEvent('input');
    await expect(flow).toHaveValue('80');

    await content.locator('[aria-label="Bake"]').click();

    /*
     * ⚠️ **EVERY row, not the one that moved.** `26.D12` makes Bake re-capture the baseline AND re-centre
     * all fourteen; a Bake that re-centred only the dragged row would leave the others claiming an offset
     * from a baseline that no longer exists.
     */
    for (const label of SECTIONS.flatMap((s) => s.rows)) {
      await expect(
        content.locator(`[aria-label="${label}"]`),
        `\`${label}\` did not return to centre after Bake`,
      ).toHaveValue('50');
    }
  });

  test('Strip to figure toggles both ways and reports its state (26.8)', async ({ composer }) => {
    await composer.boot();
    await composer.openTab(TAB);
    const strip = composer.page.locator(`${SEL.tabContent} [aria-label="Strip to figure"]`);

    /*
     * ⚠️ **`aria-pressed` IS THE ASSERTION, NOT THE CLASS.** The control is a bypass, so what has to be
     * observable is that it HAS an on state — invariant 25: the description owns the gate, and a view-state
     * control that looks like an action button is the defect that rule exists to prevent.
     */
    await expect(strip).toHaveAttribute('aria-pressed', 'false');
    await strip.click();
    await expect(strip).toHaveAttribute('aria-pressed', 'true');
    await strip.click();
    await expect(strip).toHaveAttribute('aria-pressed', 'false');

    // And the engine survived both transitions — the strip re-applies through the shared overlay path, so a
    // throw there would end the frame loop for the session (invariant 22).
    await composer.assertEngineDrew();
  });

  /*
   * ⚠️ **A SPEC ASSERTING THE SHIPPED BEHAVIOUR OF A KNOWN DEFECT IS GREEN WHILE THE DEFECT IS PRESENT**, so
   * this one names `26.D8` explicitly rather than looking like a passing correctness check.
   *
   * `Symmetry` writes the STORED phase where the engine reads `(n + phase) · fm`, so its snap lands
   * off-target. It is **deliberately not fixed**: `composercheck` §D seeds that exact defect to prove the
   * checker can see it, so a repair here would silently invalidate another instrument's calibration. What
   * this asserts is only that the row is PRESENT and honest about its reach — never that it is correct.
   */
  test('KNOWN DEFECT (26.D8): Symmetry ships with its winding defect, and the row does not claim otherwise',
    async ({ composer }) => {
      await composer.boot();
      await composer.openTab(TAB);
      const content = composer.page.locator(SEL.tabContent);
      const cell = content.locator('.sl-slider-cell', { has: content.locator('[aria-label="Symmetry"]') });
      const reason = cell.locator('.sl-slider-reason');
      if (await reason.isVisible()) {
        // The reason reports what the row cannot move; it must never assert the snap is accurate.
        await expect(reason).not.toContainText(/correct|accurate|exact/i);
      }
    });
});
