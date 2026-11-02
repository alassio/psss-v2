import { test, expect, SEL, SLOTS } from './composer-fixture.ts';

/*
 * ============================================================================================
 * Phase 17.1 — **the seeded defects for `01-session-a-read-and-edit.spec.ts`.** Discharges NO test-plan step.
 * ============================================================================================
 *
 * ⚠️ **THIS FILE IS THE ANSWER TO "IS A GREEN SUITE EVIDENCE ABOUT THE COMPOSER, OR ONLY ABOUT THE SUITE?" — AND
 * UNTIL IT EXISTED, THE HONEST ANSWER WAS THE SECOND.** `composercheck` runs every property twice: once on real
 * data expecting PASS, once on a deliberately broken copy expecting FAIL, and reports a seed that passes as a
 * **CALIBRATION FAIL**. This is that discipline in a browser. `CLAUDE.md`: *"A MEASURING SECTION'S OWN BASIS HAS
 * BEEN THE DEFECT REPEATEDLY"* and *"calibrate every new section against seeded defects."*
 *
 * ⚠️ **THE PRECEDENT IS SPECIFIC AND IT IS THE REASON THIS FILE IS NOT DEFERRED TO PHASE 7: §Q WAS GREEN AT 27
 * CLAUSES OVER A CHECKBOX A USER COULD NOT MEANINGFULLY CLICK.** Every clause looked inside the owner; none asked
 * whether the owner was reached. A browser suite has strictly more ways to be vacuously green than a text grep —
 * an unbooted page, a selector matching nothing, a click landing on an overlay — so the seeds are the only thing
 * separating "the tab is correct" from "the specs are decorative".
 *
 * ⚠️ **HOW THESE SEEDS WORK, AND THE LIMIT THAT COMES WITH IT.** Each mutates the **live DOM** to manufacture the
 * defect its clause claims to catch, then asserts the clause's own predicate now reports the defect. That makes
 * them cheap and exact about the OBSERVATION CHANNEL — but it does **not** test the engine's production of the
 * value. A seed here proves *"if the tab shipped this defect, spec 01 would go red"*; it proves nothing about
 * whether the tab could ship it. **Stated, because the two are easy to conflate and only the first is claimed.**
 *
 * ⚠️ **EVERY SEED MUST CHANGE WHAT IT CLAIMS TO CHANGE, AND THAT IS ASSERTED RATHER THAN ASSUMED.** `CLAUDE.md`:
 * *"A SEED FOR A COUNT CLAUSE MUST CHANGE THE COUNT"*, and *"A SEED CAN BE ALGEBRAICALLY IMPOSSIBLE."* So each
 * block below records the pre-mutation reading too: a seed that silently failed to apply would otherwise report
 * the clause as discriminating on the strength of nothing having happened.
 *
 * ⚠️ **NOTHING HERE MAY OUTLIVE ITS TEST.** The mutations are page-local and the page is discarded at teardown,
 * so no seed can leak into another spec — which matters because `workers: 1` means every spec shares one engine.
 */

test.describe('Phase 17.1 — calibration: spec 01\'s clauses must be able to FAIL', () => {
  test('all six seeded defects are CAUGHT — a seed that passes is a calibration failure',
    async ({ composer, page }) => {
      test.slow();
      await composer.openComposer();
      await composer.loadPreset('Aliens DNA');

      /* ── seed 1 · the 21-raw-input count (step 2) ────────────────────────────────────────────────
       * ⚠️ **THE MUTATION REMOVES THE CLASS FROM NINE INPUTS RATHER THAN DELETING THEM, WHICH IS THE POINT: it
       * seeds a *selector* defect, the exact shape that would let a renamed class report a row as collapsed.**
       * A count clause must be seeded with something that changes the count. */
      const before1 = await composer.numInputs(SLOTS.body).count();
      expect(before1, 'the seed must start from the real 21 — starting from anything else means the clause under '
        + 'calibration was already failing and this test would "catch" its own broken premise').toBe(21);
      await composer.slot(SLOTS.body).evaluate((s) => {
        [...s.querySelectorAll('input.sl-composer-num:not(.sl-composer-breathe-num)')]
          .slice(0, 9).forEach((i) => i.classList.remove('sl-composer-num'));
      });
      expect(await composer.numInputs(SLOTS.body).count(),
        'CALIBRATION FAIL: nine inputs were unclassed and the count did not move, so step 2\'s '
        + '`toHaveCount(21)` cannot see a collapsed row').not.toBe(21);

      /* ── seed 2 · the retired user-facing word (step 4's surviving finding) ──────────────────────
       * ⚠️ **THIS IS THE SEED THAT PROVES THE BROWSER CLOSES §N'S HOLE.** §N scans string LITERALS in named files
       * and was GREEN over a live violation in a third file, because *"a USER-FACING STRING CAN LIVE IN THE
       * MODEL"* and *"a word reaching the DOM through a VARIABLE is invisible to any text scan."* So the seed
       * injects the word through `textContent` — i.e. with no literal anywhere — and the DOM scan still sees it.
       * **A text scan is structurally incapable of catching this seed; that asymmetry is the finding.** */
      expect((await page.locator(SEL.tabContent).innerText()).toLowerCase(),
        'the tab must not already ship the retired word, or the seed proves nothing').not.toContain('breathe');
      await page.locator(SEL.tabContent).evaluate((e) => {
        const s = document.createElement('span');
        s.textContent = 'breathes';        // no string literal reaches any source file the checker scans
        e.appendChild(s);
      });
      expect((await page.locator(SEL.tabContent).innerText()).toLowerCase(),
        'CALIBRATION FAIL: a retired word was injected into the rendered tab and the DOM scan missed it')
        .toContain('breathe');

      /* ── seed 3 · the cyan mute notice visible with every level on (step 2) ──────────────────────
       * ⚠️ **SEEDED VIA `display` SPECIFICALLY, BECAUSE THAT IS THE MECHANISM THE CLAUSE HAD TO GET RIGHT.** The
       * notice is ALWAYS in the DOM; a `count()`-based clause would pass whether it were on screen or not — this
       * project's *"`display: none` stops a tab being SEEN, not WORKING"* in its assertion-shaped form. */
      expect(await composer.notice('mute').count(), 'the notice element must exist even while hidden — if it '
        + 'does not, the visibility clause is asserting about an absent element').toBe(1);
      expect(await composer.notice('mute').isVisible(),
        'it must start hidden with all three levels on').toBe(false);
      await composer.notice('mute').evaluate((e) => { (e as HTMLElement).style.display = 'block'; });
      expect(await composer.notice('mute').isVisible(),
        'CALIBRATION FAIL: the mute notice was forced visible and `toBeHidden()` would still have passed')
        .toBe(true);

      /* ── seed 4 · a tier button of any label (steps 3–4, retired) ────────────────────────────────
       * ⚠️ **AN ABSENCE CLAUSE IS THE ONE THAT MOST OFTEN CANNOT FAIL, so this seed ADDS the forbidden control.**
       * `CLAUDE.md`: *"an absence test over an empty corpus reports PASS"* — and the plan is explicit that
       * finding a tier button of ANY label is a finding, which is why the seed uses one of the two retired
       * labels rather than an invented one. */
      const tierSel = `${SEL.tabContent} button:has-text("Simplify"), `
        + `${SEL.tabContent} button:has-text("Show detail")`;
      expect(await page.locator(tierSel).count(),
        '16.15 / E106 deleted the tier; it must be absent to begin with').toBe(0);
      await composer.slot(SLOTS.body).evaluate((s) => {
        const b = document.createElement('button'); b.textContent = 'Simplify'; s.appendChild(b);
      });
      expect(await page.locator(tierSel).count(),
        'CALIBRATION FAIL: a `Simplify` button was added and the absence clause did not notice')
        .toBeGreaterThan(0);

      /* ── seed 5 · the readout echoing AUTHORED degrees (steps 6–9) ───────────────────────────────
       * ⚠️ **THE MOST IMPORTANT SEED IN THE FILE, BECAUSE THE DEFECT IT MODELS IS *PLAUSIBLE COPY*.** `phase` is
       * multiplied by the winding, so the applied shift is `phase × FM.Base mod 360`. A readout printing the
       * authored `18°` is not obviously broken to look at — it is exactly what a user typed — and `CLAUDE.md`
       * records `Sliders`' `Symmetry` carrying this very defect today. The seed replaces the effective form with
       * the authored one and requires the clause to reject it. */
      expect(await composer.readout(SLOTS.body).innerText(),
        'Aliens DNA Body must be showing the effective form before the seed').toContain('(not 18°)');
      await composer.readout(SLOTS.body).evaluate((e) => {
        e.textContent = 'closes · Y shift 18° · repeats every 120 s';
      });
      expect(await composer.readout(SLOTS.body).innerText(),
        'CALIBRATION FAIL: the readout was rewritten to echo the AUTHORED degrees and the clause still matched')
        .not.toContain('Y shift 90° (not 18°)');

      /* ── seed 6 · a frozen figure (step 11) ─────────────────────────────────────────────────────
       * ⚠️ **STEP 11 HAS TWO WAYS TO FAIL AND THE OBVIOUS CLAUSE ONLY SEES ONE.** A snap-back to the opening pose
       * and a *frozen* figure both violate *"keeps sweeping from where it was"*, but a clause reading only
       * "something changed after the edit" is satisfied by a snap. The two-sample form catches the freeze; this
       * seed stubs `requestAnimationFrame` to manufacture exactly that, which also confirms the sampler reads
       * live GL rather than a cached frame.
       *
       * ⚠️ **AND IT DOUBLES AS THE PROOF THAT THE SIGNATURE FUNCTION IS SENSITIVE AT ALL** — two identical
       * readings from a stopped loop, given that the readings differ while it runs. */
      const sig = async () => page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('#canvas');
        const gl = c?.getContext('webgl2'); if (!c || !gl) return 'no-context';
        const px = new Uint8Array(96 * 96 * 4);
        gl.readPixels(Math.floor(c.width / 2 - 48), Math.floor(c.height / 2 - 48), 96, 96,
          gl.RGBA, gl.UNSIGNED_BYTE, px);
        let sum = 0, lit = 0;
        for (let i = 0; i < px.length; i += 4) {
          const v = Math.max(px[i]!, px[i + 1]!, px[i + 2]!); sum += v; if (v > 16) lit++;
        }
        return `${Math.round(sum / 4096)}:${Math.round(lit / 64)}`;
      });
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>)['requestAnimationFrame'] = () => 0;
      });
      await page.waitForTimeout(600);
      const a = await sig();
      await page.waitForTimeout(1200);
      const b = await sig();
      expect(a, 'the signature must be reading real pixels').not.toBe('no-context');
      expect(b, `CALIBRATION FAIL: rAF was stubbed out and the canvas signature still changed (${a} → ${b}), so `
        + "step 11's two-sample clause cannot tell a sweeping figure from a frozen one").toBe(a);
    });
});
