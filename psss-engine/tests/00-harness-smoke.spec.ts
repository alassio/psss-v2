import { test, expect, SEL, assertAbsentAgainstLivePage } from './composer-fixture.ts';

/*
 * ============================================================================================
 * Phase 17.1 — the harness testing ITSELF. Discharges NO test-plan step.
 * ============================================================================================
 *
 * ⚠️ **THIS FILE EXISTS BECAUSE OF THIS PROJECT'S OWN HISTORY, AND IT IS NUMBERED 00 SO IT RUNS FIRST.**
 * `CLAUDE.md`: *"read a failure as a claim about the CHECKER until the checker is exonerated"*, and — the
 * sharper form — *"A MEASURING SECTION'S OWN BASIS HAS BEEN THE DEFECT REPEATEDLY."* A browser harness has a
 * richer set of ways to be vacuously green than a text grep does: the page may not have booted, the selector
 * may match nothing, the click may have landed on an overlay, the engine may be drawing black.
 *
 * ⚠️ **SO NOTHING HERE ASSERTS ANYTHING ABOUT THE COMPOSER'S BEHAVIOUR.** Every test below is a claim about
 * the INSTRUMENT. If any of them fails, no result from any other spec in this directory means anything.
 */

test.describe('Phase 17.1 — instrument checks (not test-plan steps)', () => {
  test('the engine boots and DRAWS — not merely loads', async ({ composer }) => {
    /*
     * ⚠️ **THE TWO HALVES ARE SEPARATE CLAIMS AND THE SECOND IS THE ONE THAT MATTERS.** `boot()` waits for the
     * Lab button, which proves `main.ts` ran far enough to build the chrome. It does NOT prove a frame was
     * drawn: a failed shader compile throws nothing, links, binds and no-ops to BLACK. Only the pixel read
     * separates those, which is why the probe that preceded this harness took a screenshot rather than reading
     * the console.
     */
    await composer.assertEngineDrew();
  });

  test('SwiftShader is the rasteriser, and float colour buffers are available', async ({ page }) => {
    /*
     * ⚠️ **THIS IS A GUARD ON THE CONFIG, NOT A CAPABILITY PROBE, AND IT WAS MEASURED TO BE NECESSARY.** On
     * 2026-09-09 three launch forms were compared: the default and `--disable-gpu --enable-unsafe-swiftshader`
     * both gave SwiftShader, but launching via an explicit `executablePath` reached the REAL AMD GPU
     * (`ANGLE (AMD, AMD Radeon 8060S, Direct3D11)`). **A pixel baseline recorded on one and compared against
     * the other is unreadable** — different rasteriser, different shader compiler, different precision. So the
     * renderer is asserted rather than assumed, and this test is what makes every future baseline portable.
     *
     * ⚠️ **`EXT_color_buffer_float` is asserted because the engine's trail and field passes need it**; without
     * it the failure would arrive later as a black or clipped trail, i.e. as a fake defect in whatever step
     * happened to look at the trail first.
     */
    const gpu = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      if (!gl) return null;
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : '',
        floatBuf: !!gl.getExtension('EXT_color_buffer_float'),
        floatBlend: !!gl.getExtension('EXT_float_blend'),
        maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      };
    });
    expect(gpu, 'no WebGL2 context at all — the whole of Phase 17 rests on WebGL2 working headless').not.toBeNull();
    expect(gpu!.renderer, `renderer is ${JSON.stringify(gpu!.renderer)}, expected SwiftShader. If this reads `
      + 'as a real GPU, the launch args in `playwright.config.ts` were bypassed and no pixel baseline taken '
      + 'on this run is comparable with one taken on another machine.').toContain('SwiftShader');
    expect(gpu!.floatBuf, 'EXT_color_buffer_float missing — the trail and field passes need it').toBe(true);
    expect(gpu!.floatBlend, 'EXT_float_blend missing').toBe(true);
    expect(gpu!.maxTex).toBeGreaterThanOrEqual(4096);
  });

  test('the Lab opens and the authoring tabs are in their DECIDED order', async ({ composer, page }) => {
    await composer.openLab();

    /*
     * ⚠️ **THE ORDER IS AN OWNER DECISION AND IT IS ALSO A SCAN-HEALTH CHECK.** `CLAUDE.md`: adding a `TabId`
     * member is invisible to `tsc` at every consumer, because dispatch is a `Map` with no `switch` — so the tab
     * bar's contents are exactly the kind of thing only an enumeration can hold.
     *
     * ⚠️ **THIS TEST ASSERTED `composer` LAST AND `materials` SECOND-LAST UNTIL 2026-09-22, AND IT WAS STALE
     * TWICE OVER: Phase 19 put the Reel last, and v8 21.12 INSERTED the Transmap between the two.** That is
     * worth more than the fix. The assertion was written as *"assert the tail, not the whole list, so this is
     * not a third enumeration of `TAB_DEFS`"* — sound reasoning, wrong instrument: **the tail is the one part
     * of the list that every appended tab moves**, so the form chosen to avoid maintenance was the form
     * guaranteed to need it. And because the suite had not been run in full since, nothing said so —
     * `CLAUDE.md`: *"a suite that has grown since its last green run has not been run green."*
     *
     * Rewritten as RELATIVE order over the decided adjacencies, which is what the decisions actually say and
     * what survives a tab being added anywhere else:
     *   · Materials immediately before the Composer   (original)
     *   · the Composer immediately before the Transmap (v8 21.12)
     *   · the Reel FIRST                               (owner, 2026-10-05)
     *
     * ⚠️ **THE WHOLE BAR WAS REORDERED BY THE OWNER ON 2026-10-05** to `Reel, Visual FX, Materials, Composer,
     * Transmap, Sliders, Mixer, Randomise, Evolution, History`, **and the Reel moved from LAST to FIRST** —
     * reversing Phase 19, which had itself reversed Phase 16's "never move the Composer off LAST". **Two of
     * the three adjacencies above survived that reshuffle untouched, which is the argument for the relative
     * form made good**: only the clause that pinned a tab to an END of the list needed rewriting, and an end
     * is precisely what the 2026-09-22 lesson above says is the fragile thing to assert. The Materials →
     * Composer → Transmap run is now asserted as a chain, so it is one fact in two clauses rather than two
     * independent ones.
     *
     * ⚠️ **`at('reel') === 0` IS NOW ALSO THE DEFAULT-TAB ASSERTION'S PREMISE, and they are separate claims.**
     * The owner's decision was that the Lab opens on the FIRST tab, so `panel.ts` reads `TAB_DEFS[0].id` at
     * both sites instead of the `'mixer'` literal it hardcoded until 2026-10-05. The `.active` check below
     * would therefore pass for the wrong reason if the bar were reordered and the default followed silently —
     * so it asserts the Reel is **both** first AND active, and says which fact failed.
     */
    const ids = await page.locator(`${SEL.tabBar} .sl-tab-btn`).evaluateAll(
      (els) => els.map((e) => (e as HTMLElement).dataset['tab'] ?? ''));
    expect(ids.length, 'the tab bar rendered no buttons — count `TAB_DEFS`').toBeGreaterThan(4);

    const at = (id: string) => ids.indexOf(id);
    const where = `tab order is ${JSON.stringify(ids)}`;
    for (const id of ['materials', 'composer', 'transmap', 'reel']) {
      expect(at(id), `${where}; '${id}' is not in the bar at all. ⚠️ Visual FX, Materials, the Composer and `
        + 'the Transmap register inside `if (this.config.visualFxControls)` and the Reel inside a guard of its '
        + 'own, so a missing button here is a REGISTRY question before it is an order question.')
        .toBeGreaterThanOrEqual(0);
    }
    expect(at('composer'), `${where}; Materials must sit immediately before the Composer`)
      .toBe(at('materials') + 1);
    expect(at('transmap'), `${where}; the Transmap must sit immediately after the Composer (21.12)`)
      .toBe(at('composer') + 1);
    expect(at('reel'), `${where}; the Reel must be FIRST (owner, 2026-10-05 — it was LAST under Phase 19, `
      + 'which had itself reversed Phase 16; do not "restore" either earlier order)').toBe(0);

    /*
     * ⚠️ **THE DEFAULT TAB IS A SECOND, SEPARATE CLAIM** — that the Lab opens on `TAB_DEFS[0]`, which the
     * owner decided on 2026-10-05 and which `panel.ts` implements by reading the table rather than naming a
     * tab. It is asserted here, next to the order, because the two are only equivalent while the order holds:
     * read alone, a passing `.active` check says nothing about WHICH tab was supposed to be active.
     *
     * ⚠️ **`.active` on the BUTTON, not the presence of the container** — `TabRegistry` builds a tab's
     * container on first show, so asserting `[data-tab="reel"]` content here would be asserting that the open
     * happened, in a form that cannot distinguish "opened on the Reel" from "opened on something else and the
     * Reel's container does not exist yet". The class is the one thing that says which.
     */
    await expect(page.locator(`${SEL.tabBar} .sl-tab-btn.active`), 'no tab button carries `.active` after the '
      + 'Lab opened — the opening `switchTab` never ran, or it resolved to a tab with no module (the Reel '
      + 'registers inside a guard of its own, so this is a REGISTRY question first)').toHaveCount(1);
    expect(await page.locator(`${SEL.tabBar} .sl-tab-btn.active`).getAttribute('data-tab'),
      `${where}; the Lab must open on the FIRST tab in the bar (owner, 2026-10-05). If the order assertions `
      + 'above passed and this failed, `panel.ts` is naming a tab literally again instead of reading '
      + '`TAB_DEFS[0].id` — the drift that hid behind the `// Show first tab` comment until the reshuffle.')
      .toBe(ids[0]);
  });

  test('the Composer tab MOUNTS — three slot sections, not merely a button', async ({ composer, page }) => {
    /*
     * ⚠️ **THE BUTTON EXISTING IS NOT EVIDENCE THE TAB MOUNTED**, because the last three tabs register inside
     * `if (this.config.visualFxControls)` — `CLAUDE.md`: *"the bar can show more tabs than the registry
     * holds."* A spec that clicked the button and started asserting would find an empty container and every
     * absence assertion in it would pass.
     *
     * ⚠️ **AND THE COUNT IS EXACTLY THREE, ALWAYS, LIT OR NOT** — an owner decision ("three wave rows always
     * shown, no add/remove"). A row with nothing authored shows a placeholder; it does not disappear.
     */
    await composer.openComposer();
    const slots = page.locator(`${SEL.tabContent} .sl-composer-slot`);
    await expect(slots, 'the Composer must always show exactly three wave rows — no add/remove (owner '
      + 'decision). A count other than 3 means either the tab did not mount or `slotCount` reached the view.')
      .toHaveCount(3);
  });

  test('CALIBRATION: the absence helper cannot pass over an empty page', async ({ composer, page }) => {
    /*
     * ⚠️ **THE SEED FOR THE HARNESS'S OWN CHARACTERISTIC LIE, AND ITS EXPECTED VERDICT IS THAT THE HELPER
     * THROWS.** `expect(locator).toHaveCount(0)` is satisfied identically by "the thing is absent" and "the
     * page is absent" — the browser form of `CLAUDE.md`'s rule that *an absence test over an empty corpus
     * reports PASS*. So the helper takes an anchor and asserts it first.
     *
     * This test proves the guard is real by pointing it at an anchor that matches nothing and requiring a
     * throw. ⚠️ **A seed that does not fail is a CALIBRATION FAIL** — if this test ever passes without the
     * helper throwing, every absence claim in this suite is decorative.
     */
    await composer.openComposer();

    // (a) the guard fires when the anchor is bogus, even though the absence claim would have "passed".
    let threw = false;
    try {
      await assertAbsentAgainstLivePage(
        page.locator('.sl-composer-this-class-does-not-exist'),
        page.locator('.sl-composer-also-not-real'),
        'a claim that would be vacuous',
      );
    } catch { threw = true; }
    expect(threw, 'CALIBRATION FAIL: the absence helper did not object to an anchor matching nothing, so it '
      + 'cannot distinguish "absent" from "the page never rendered". Every absence assertion built on it is '
      + 'decorative until this fails.').toBe(true);

    // (b) and it PASSES against a live anchor with a genuinely absent subject — 16.15 deleted the tier,
    //     `Repair` and `Simplify`, and step 23 asks a reader to confirm no such button exists.
    await assertAbsentAgainstLivePage(
      page.locator(`${SEL.tabContent} .sl-composer-slot`),
      page.locator(`${SEL.tabContent} button:has-text("Simplify")`),
      'a `Simplify` button — the whole tier was DELETED by 16.15 / E106',
    );
  });

  test('CALIBRATION: a wrong preset name FAILS rather than leaving the previous figure', async ({ composer }) => {
    /*
     * ⚠️ **THE MOST DANGEROUS SILENT PASS IN THIS HARNESS WOULD BE A PRESET THAT NEVER LOADED**, because every
     * later assertion would then describe the wrong figure — and most of them would still pass, since the test
     * plan's presets share many properties. `CLAUDE.md`: *"a confirmation is evidence only if a specific
     * failure was available to it."*
     *
     * So `loadPreset()` throws on a name that does not resolve, and this seed proves it. **A preset NAME is a
     * primary key in five owners**, which is exactly why a typo must be loud.
     */
    await composer.openComposer();
    let threw = false;
    try {
      await composer.loadPreset('This Preset Does Not Exist ✱');
    } catch { threw = true; }
    expect(threw, 'CALIBRATION FAIL: `loadPreset` accepted a name that resolves to no tile. Every spec that '
      + 'names a preset would then be silently testing whatever was loaded before it.').toBe(true);
  });
});
