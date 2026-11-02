import { test, expect, SEL, PLANE_CAPTIONS, FLAT_PANE_CAPTION, HUE_SPLIT } from './composer-fixture';

/*
 * ============================================================================================
 * Phase 17.4 — **the seeded defects for `07-diagram-panes.spec.ts`.** Discharges NO test-plan step.
 * ============================================================================================
 *
 * ⚠️ **SAME SITTING AS THE SPEC IT CALIBRATES, WHICH IS A RULE:** *"A SPEC WITHOUT A SEED DISCHARGES NOTHING,
 * WHATEVER COLOUR IT REPORTS — ship the seeds in the same sitting, never in a later phase."*
 *
 * ⚠️ **AND A PIXEL SPEC NEEDS THIS MORE THAN A DOM SPEC DOES, BECAUSE ITS CHARACTERISTIC FAILURE IS SILENT IN THE
 * PASSING DIRECTION.** Every clause in spec 07 is a count or a ratio over `getImageData`, and **a pane that failed
 * to draw reads as "no cyan curve", "flat", and "the two panes agree" all at once** — three of that spec's four
 * question shapes, all green. `CLAUDE.md`'s *"an absence test over an empty corpus reports PASS"*, in a medium
 * where the empty corpus is a plausible-looking blank box.
 *
 * ⚠️ **EVERY MUTATION IS A CANVAS PAINT OR A STYLE WRITE, AND `src/` IS NOT TOUCHED.** *"Phases 3–7 edit no `src/`
 * file and none may"*, and *"nothing may be added under `src/` for the harness's benefit — `deadcheck` counts `src`
 * files."* **Stated weakness, not a sufficiency claim:** a page-local seed shows a clause discriminates; it cannot
 * show the clause is pointed at the mechanism a real regression would travel through.
 *
 * ⚠️ **EVERY SEED ASSERTS ITS PRE-MUTATION READING, AND EVERY CANVAS SEED RESTORES BY `putImageData`.** *"A SKIPPED
 * mutation reads exactly like a caught one"* — and a leaked paint would make the NEXT clause fail with a message
 * accusing the engine. Page teardown protects only the next SPEC, never the next clause.
 *
 * ⚠️ **ONE MUTATION, ONE VERDICT, ONE RESTORE — THE RULE SPEC 08's SEED 7 PAID FOR.** Where a test carries two
 * mutations (to reuse a ~25 s preset load) they are applied, judged and undone in sequence, never together: a
 * conjunction over two mutations is satisfied by either half, so the other half is never exercised and the seed is
 * green on the strength of its sibling.
 *
 * ⚠️ **AND THE SITTING'S MOST VALUABLE OUTPUT AGAIN CAME FROM WRITING THE SEEDS RATHER THAN RUNNING THEM: FIVE OF
 * SPEC 07's FIRST-DRAFT EXPECTATIONS WERE FALSIFIED IN NODE BEFORE A BROWSER RAN, EACH OF WHICH WOULD HAVE ACCUSED
 * THE ENGINE.** `score-canvas.ts` and `composer-model.ts` are pure, so a clause's SUBJECT is checkable without a
 * browser at all — and the falsified drafts were wrong about the subject, not the arithmetic: a Body row whose two
 * extreme curves raster to 0–1 px, a preset whose `Size` triple is all zeros so the step's own edit is a no-op, a
 * pane that is visually flat while `paneExtent > 0` so the caption is correctly absent. **The seeds below calibrate
 * the clauses; the Node oracle calibrated the SUBJECTS, and neither substitutes for the other.**
 */

test.describe('Phase 17.4 — calibration: spec 07\'s pixel clauses must be able to FAIL', () => {
  /*
   * ══ SEED 1 · the legend's colours must be compared PER KEY (step 19) ═══════════════════════════
   *
   * ⚠️ **THIS IS THE ONE DEFECT SHAPE `CLAUDE.md` RECORDS AGAINST THIS EXACT LEGEND:** *"A SET-MEMBERSHIP CLAUSE
   * CANNOT SEE A PERMUTATION — 'each legend hex IS one of the three curve colours' passes on a legend whose
   * swatches are SWAPPED. Compare PER KEY against the named declaration, and seed with a permutation, not a
   * recolour."* So the mutation is a SWAP, and the seed asserts BOTH that the per-key clause fails AND that the
   * set-membership clause still passes — the second half is what makes this a calibration rather than a smoke
   * test.
   *
   * ⚠️ **NO PRESET IS LOADED, AND THAT IS DELIBERATE RATHER THAN LAZY.** The legend is one element for the whole
   * tab and carries no preset-dependent state, so a ~25 s load would buy nothing — and `CLAUDE.md` requires stating
   * what a bound covers: this seed says nothing about any pane, only about the legend.
   */
  test('seed 1 — SWAPPED legend swatches fail the per-key clause while a set-membership clause still PASSES',
    async ({ composer, page }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.openComposer();

      const legend = page.locator(`${SEL.tabContent} ${SEL.legend}`);
      await expect(legend, 'CALIBRATION: no `.sl-composer-legend`, so this seed has nothing to permute and step '
        + '19\'s colour half has no subject.').toHaveCount(1);

      const read = () => legend.evaluate((root) => {
        const out: Record<string, string> = {};
        for (const cls of ['now', 'size', 'winding']) {
          const el = root.querySelector(`.sl-composer-key-${cls}`) as HTMLElement | null;
          out[cls] = el ? getComputedStyle(el).color : '';
        }
        return out;
      });
      const toHex = (rgb: string): string => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
        return m ? '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('') : rgb;
      };

      const before = await read();
      for (const k of ['now', 'size', 'winding'] as const) {
        expect(before[k], `CALIBRATION: the legend has no \`.sl-composer-key-${k}\` span before any mutation, so `
          + 'this seed cannot permute it — and an ABSENT colour is not a wrong one, which is step 19\'s silent '
          + 'direction. Re-measure against `composer.ts:1043`.').not.toBe('');
      }
      expect(toHex(before.size!), 'CALIBRATION: the `size` swatch is not the shipped cyan `#60d6e0` before any '
        + 'mutation. That is not a seed failure — step 19 is red against `panel.css:669`. Report it.').toBe('#60d6e0');
      expect(toHex(before.winding!), 'CALIBRATION: the `winding` swatch is not the shipped amber `#e0a848` before '
        + 'any mutation. Step 19 is red against `panel.css:670`. Report it.').toBe('#e0a848');

      /* The mutation: swap cyan and amber — the diagram confidently MISLABELLED, which `score-canvas.ts`'s own
       * header names as worse than an ugly one. */
      await legend.evaluate((root) => {
        const s = root.querySelector('.sl-composer-key-size') as HTMLElement | null;
        const w = root.querySelector('.sl-composer-key-winding') as HTMLElement | null;
        if (s) s.style.color = '#e0a848';
        if (w) w.style.color = '#60d6e0';
      });

      const after = await read();
      expect(toHex(after.size!), 'CALIBRATION: the swap did not land, so nothing below is being demonstrated.')
        .toBe('#e0a848');

      /*
       * Half A — **the set-membership clause PASSES over the swapped legend.** This is the defect, executed: the
       * three hexes present are exactly the three declared, in the wrong slots.
       */
      const declared = new Set(['#ebf2ff', '#60d6e0', '#e0a848']);
      const got = (['now', 'size', 'winding'] as const).map((k) => toHex(after[k]!));
      expect(got.every((h) => declared.has(h)), 'CALIBRATION: the swap left a colour that is not one of the three '
        + 'declared, so half A is demonstrating a RECOLOUR rather than a PERMUTATION — and a recolour is what any '
        + 'clause can catch.').toBe(true);
      expect(new Set(got).size, 'CALIBRATION: the swapped legend does not carry three DISTINCT colours, so a '
        + '"three different swatches" clause would also have caught this and half A is not the weaker test it '
        + 'claims to be.').toBe(3);

      /* Half B — **the per-key clause FAILS.** */
      expect(toHex(after.size!) === '#60d6e0', 'CALIBRATION FAIL: the cyan and amber swatches were SWAPPED and a '
        + 'per-key comparison still reports `size` as cyan. Then step 19 is a set-membership clause in disguise '
        + 'and cannot see a permutation — the legend would keep naming the curves, in the wrong order, and every '
        + 'reader of the diagram would be confidently misinformed.').toBe(false);
      expect(toHex(after.winding!) === '#e0a848', 'CALIBRATION FAIL: the `winding` swatch was set to cyan and the '
        + 'per-key clause still reports amber.').toBe(false);
    });

  /*
   * ══ SEED 2 · the hue classifier and the three-signature clause (steps 18, 19) ══════════════════
   *
   * ⚠️ **TWO MUTATIONS ON ONE ~25 s LOAD, APPLIED AND JUDGED AND RESTORED SEPARATELY.** They are different
   * questions: A asks whether the CLASSIFIER can tell the curves apart (paint cyan over amber and the counts must
   * move), B asks whether step 19's distinctness clause can see three panes drawn from ONE plane's data.
   */
  test('seed 2 — repainting a pane\'s hues moves the ink counts, and three identical panes fail the distinctness '
    + 'clause', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();

    const xy = composer.pane('Combined figure', 'X / Y').locator(SEL.paneCanvas);
    const before = await composer.paneInk('Combined figure', 'X / Y');
    expect(before.cyan, 'CALIBRATION: the Aliens DNA combined `X / Y` pane carries NO cyan before any mutation. '
      + 'That is not a seed failure — step 18 is red, and this preset pulses in X and Y (measured: amber 274, '
      + 'cyan 176, white 2391 at the shipped 150 px combined pane). Report it; do not "fix" this seed.')
      .toBeGreaterThan(0);
    expect(before.amber, 'CALIBRATION: the pane carries no amber before any mutation — step 18 is red.')
      .toBeGreaterThan(0);

    /* Snapshot the backing store, so mutation A can be undone exactly. A leaked paint would make mutation B fail
     * for A's reason, with a message accusing the engine. */
    const snapshot = await xy.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      return Array.from(ctx.getImageData(0, 0, c.width, c.height).data);
    });
    expect(snapshot.length, 'CALIBRATION: the pane\'s backing store is empty, so neither mutation can be undone '
      + 'and a leak into the next clause is certain.').toBeGreaterThan(0);

    /*
     * ── Mutation A · repaint every CYAN pixel amber, ALONE ─────────────────────────────────────
     * ⚠️ **A PERMUTATION OF THE PIXELS, NOT AN ERASURE, BECAUSE AN ERASURE IS WHAT ANY CLAUSE CATCHES.** The pane
     * keeps exactly the same total ink and the same shapes; only the hue assignment moves. That is the pixel-level
     * form of seed 1's defect, and if `paneInk`'s classifier were an "is there non-background ink" test it would
     * report this pane unchanged — leaving step 20's two absence clauses unable to fail either.
     */
    /*
     * ⚠️ **THE SELECTOR USES THE IMPORTED `HUE_SPLIT`, AND A SEED THAT SELECTS ON A DIFFERENT THRESHOLD FROM THE
     * CLASSIFIER IT CALIBRATES IS TESTING NEITHER.** This mutation used to select on its own `> 24` while the
     * subject bucketed at 24 too — agreement by coincidence, and when `paneInk`'s split was corrected the
     * disagreement would have been SILENT IN THE PASSING DIRECTION: at 24 the selector also repaints the white
     * curve's soft edge, so `afterA.amber > before.amber` would hold on a pane carrying NO cyan at all, which is
     * precisely the state the seed exists to prove is distinguishable.
     */
    const moved = await xy.evaluate((el, split) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! < 8) continue;
        if (d[i + 2]! - d[i]! > split) { d[i] = 224; d[i + 1] = 168; d[i + 2] = 72; n += 1; }
      }
      ctx.putImageData(img, 0, 0);
      return n;
    }, HUE_SPLIT);
    expect(moved, 'CALIBRATION: the repaint touched no pixel, so mutation A is not demonstrating anything. It '
      + 'selects exactly what `paneInk` calls cyan (the shared `HUE_SPLIT`), so a 0 here means this pane draws no '
      + 'cyan curve — a step 18 subject, not a seed subject.').toBeGreaterThan(0);

    const afterA = await composer.paneInk('Combined figure', 'X / Y');
    expect(afterA.cyan === before.cyan, 'CALIBRATION FAIL: every cyan pixel in the pane was repainted amber and '
      + '`paneInk` reports the same cyan count. Then it is not classifying by HUE at all, and step 18\'s "the '
      + 'pane carries cyan" clause is really "the pane carries ink" — which is green on a pane drawing one white '
      + 'curve, i.e. on exactly the state step 20 asserts and steps 18/22b deny.').toBe(false);
    expect(afterA.amber, 'CALIBRATION: the repainted pixels did not arrive in the amber bucket, so the classifier '
      + 'is not a partition and the two counts are not comparable quantities.').toBeGreaterThan(before.amber);
    expect(afterA.total, 'CALIBRATION: the total ink moved, so mutation A is an ERASURE rather than a permutation '
      + '— and an erasure is what any clause catches, which would make this seed the weaker test it exists not to '
      + 'be.').toBe(before.total);

    /* Restore, exactly. */
    await xy.evaluate((el, data) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      const img = ctx.createImageData(c.width, c.height);
      img.data.set(Uint8ClampedArray.from(data as number[]));
      ctx.putImageData(img, 0, 0);
    }, snapshot);
    const restored = await composer.paneInk('Combined figure', 'X / Y');
    expect(`${restored.amber}/${restored.cyan}/${restored.white}`, 'CALIBRATION: mutation A did not restore, so '
      + 'mutation B would fail for A\'s reason with a message accusing the engine.')
      .toBe(`${before.amber}/${before.cyan}/${before.white}`);

    /*
     * ── Mutation B · draw the X / Y pane's bitmap into the two Z panes, ALONE ───────────────────
     * ⚠️ **THIS IS THE DEFECT STEP 19 EXISTS FOR — THREE PANES DRAWN FROM ONE PLANE — AND IT IS ALSO INVARIANT 29
     * REPRODUCED INSIDE THE HARNESS IF THE CLAUSE CANNOT SEE IT:** *"AN ORACLE FOR A THREE-AXIS SUBJECT MUST READ
     * ALL THREE PLANES … it cost three wrong findings in one sitting."* A total-ink clause would not catch this,
     * because two different curves can carry the same number of pixels; the seed is what shows the TRIPLE is the
     * quantity.
     */
    const sigOf = (k: { amber: number; cyan: number; white: number }) => `${k.amber}/${k.cyan}/${k.white}`;
    const sigsBefore = [] as string[];
    for (const plane of PLANE_CAPTIONS) sigsBefore.push(sigOf(await composer.paneInk('Combined figure', plane)));
    expect(new Set(sigsBefore).size, `CALIBRATION: the three panes ALREADY share signatures (${sigsBefore.join(' , ')}) `
      + 'before any mutation. That is not a seed failure — step 19 is red and the panes are not three different '
      + 'projections. Report it.').toBe(3);

    const bitmap = await xy.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      return { w: c.width, h: c.height, d: Array.from(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data) };
    });
    for (const plane of ['X / Z', 'Y / Z'] as const) {
      await composer.pane('Combined figure', plane).locator(SEL.paneCanvas).evaluate((el, src) => {
        const c = el as HTMLCanvasElement;
        const s = src as { w: number; h: number; d: number[] };
        c.width = s.w; c.height = s.h;
        const ctx = c.getContext('2d')!;
        const img = ctx.createImageData(s.w, s.h);
        img.data.set(Uint8ClampedArray.from(s.d));
        ctx.putImageData(img, 0, 0);
      }, bitmap);
    }

    const sigsAfter = [] as string[];
    for (const plane of PLANE_CAPTIONS) sigsAfter.push(sigOf(await composer.paneInk('Combined figure', plane)));
    expect(new Set(sigsAfter).size, 'CALIBRATION: the copy did not land — the three signatures are still '
      + 'distinct, so mutation B manufactured nothing.').toBe(1);
    expect(new Set(sigsAfter).size === 3, 'CALIBRATION FAIL: all three panes were overwritten with the `X / Y` '
      + 'pane\'s bitmap and step 19\'s distinctness clause would still pass. Then the clause cannot see a diagram '
      + 'that draws one plane three times — which is what 16.9 replaced the plane CHIP with, so its whole '
      + 'deliverable would be unmeasured.').toBe(false);
  });

  /*
   * ══ SEED 3 · step 20's two ABSENCE clauses, and the seed must ADD ink (step 20) ═════════════════
   *
   * ⚠️ **`CLAUDE.md`: *"A SEED FOR A *COUNT* CLAUSE MUST CHANGE THE COUNT — make it ADD a site."*** A seed that
   * ERASED the pane would satisfy both absence clauses more strongly, which is the direction they already cannot
   * fail in; only an ADDITION distinguishes *"there is no cyan"* from *"there is nothing"*. And the added ink must
   * clear the derived bound — `max(4, white × 0.02)`, which exists for anti-aliasing and not as a tolerance
   * picked to pass.
   *
   * ⚠️ **THIS SEED'S OWN PRE-MUTATION ASSERTION IS WHAT CAUGHT `paneInk`'s CLASSIFIER DEFECT, AND IT IS THE
   * CLEAREST CASE IN THE SUITE OF A SEED EARNING ITS KEEP: it read 42 cyan pixels on `Cylinder`, which has no
   * `Pulse` anywhere, and said so in a message naming the right quantity.** The cause was in the READING channel,
   * not in the bound and not in the engine: the white curve `rgba(235,242,255)` has its own `b − r` of **+20**
   * against a hand-picked split of 24, a margin of 4 that every anti-aliased edge pixel crossed. Measured: all 42
   * were alpha ≤ 31 and sampled as `rgba(230,238,255,30)` — the white curve's own soft edge. `paneInk` now
   * derives the split from `OVERLAY_STYLES`; see its doc comment. ⚠️ **THE BOUND WAS INNOCENT AND WIDENING IT
   * WOULD HAVE BURIED THE DEFECT — which is exactly what this seed's message told the reader NOT to do.**
   */
  test('seed 3 — cyan ink ADDED to a Cylinder pane fails step 20\'s absence clause, and the anti-alias bound is '
    + 'not what admits it', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Cylinder');
    await composer.openComposer();

    const before = await composer.paneInk('Combined figure', 'X / Y');
    expect(before.white, 'CALIBRATION: the Cylinder `X / Y` pane drew nothing, so both absence clauses below '
      + 'would pass over an empty pane — this project\'s single most-recorded instrument defect, in a medium '
      + 'where the empty corpus looks like a plausible diagram.').toBeGreaterThan(0);
    const bound = Math.max(4, before.white * 0.02);
    expect(before.cyan, `CALIBRATION: the Cylinder pane ALREADY carries ${before.cyan} cyan pixels against a `
      + `bound of ${bound.toFixed(1)}. That is not a seed failure — Cylinder has no \`Pulse\` on any axis of any `
      + 'level (measured: every pane rasters amber 0, cyan 0 at both shipped pane sizes), so step 20 is red. '
      + 'Report it.').toBeLessThanOrEqual(bound);

    /*
     * The mutation: one cyan polyline of the same ORDER as a real curve.
     * ⚠️ **THE LENGTH IS CHOSEN AGAINST THE MEASURED LIBRARY, NOT AGAINST THE BOUND.** Where a size curve is drawn
     * at all it rasters 11–176 px against 88–7539 white, so a genuine second curve clears a 2 % bound by an order
     * of magnitude — which is the argument that the bound separates anti-aliasing from a present curve rather than
     * merely admitting this seed.
     */
    const canvas = composer.pane('Combined figure', 'X / Y').locator(SEL.paneCanvas);
    await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = 'rgba(96,214,224,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = 10 + (i / 60) * (c.width - 20);
        const y = c.height / 2 + Math.sin(i / 6) * (c.height / 4);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    const after = await composer.paneInk('Combined figure', 'X / Y');
    expect(after.cyan, 'CALIBRATION: the seed painted a cyan polyline and the cyan count did not move — so either '
      + 'the paint did not land or the classifier does not bucket the shipped cyan. Either way nothing below is '
      + 'demonstrated.').toBeGreaterThan(before.cyan);
    expect(after.cyan, `CALIBRATION: the added cyan (${after.cyan}) does not clear the derived bound `
      + `(${bound.toFixed(1)}), so this seed is asserting about a curve too faint to be one. A real size curve is `
      + 'the same ORDER as the white one.').toBeGreaterThan(bound);
    expect(after.cyan <= bound, 'CALIBRATION FAIL: a full cyan polyline was added to a pane with no `Pulse` '
      + 'anywhere and step 20\'s `cyan <= bound` clause would still pass. Then the clause is not reading the cyan '
      + 'bucket — and step 20 is the ONE step whose whole content is an absence, so it would be discharging '
      + 'nothing.').toBe(false);
    expect(after.amber, 'CALIBRATION: painting cyan moved the AMBER count too, so the classifier is not a '
      + 'partition and step 20\'s two clauses are not independent.').toBe(before.amber);
  });

  /*
   * ══ SEED 4 · 22a's spread comparison, and the crosshair exclusion that makes it failable ═══════
   *
   * ⚠️ **TWO MUTATIONS, TWO VERDICTS, AND THE SECOND ONE CALIBRATES A THRESHOLD RATHER THAN A CLAUSE.**
   * `paneSpread`'s alpha cut is 64 and not 8 because the crosshair is `rgba(255,255,255,0.10)` (≈25) and spans the
   * FULL box — at a lower cut every pane reads as reaching 100 % of its height and **22a could never fail in
   * either direction**. That is a property of the helper, so it is seeded here rather than asserted in the spec.
   */
  test('seed 4 — a stretched Z pane fails 22a, and the crosshair alpha is excluded so 22a can fail at all',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Aliens DNA');
      await composer.openComposer();

      const xy = await composer.paneSpread('Structure', 'X / Y');
      const xz = await composer.paneSpread('Structure', 'X / Z');
      expect(xy.ink, 'CALIBRATION: the Structure `X / Y` pane has no ink above the curve threshold, so every '
        + 'comparison below is against zero — and two zeros are EQUAL, which is 22a\'s silent direction.')
        .toBeGreaterThan(0);
      expect(xy.vertical, 'CALIBRATION: the Structure `X / Y` pane has no vertical extent, so it cannot be 22a\'s '
        + '"carries the figure" reference. Measured 0.896 at the shipped 96 px slot pane.').toBeGreaterThan(0.3);
      expect(xz.vertical, `CALIBRATION: the Structure \`X / Z\` pane is NOT flat before any mutation `
        + `(${xz.vertical.toFixed(3)} against \`X / Y\`'s ${xy.vertical.toFixed(3)}). That is not a seed failure — `
        + '22a is red, and the three panes are being fitted individually rather than at one shared extent. '
        + 'Report it. Measured: 0.000, the Z axis being silent (`Size` 7.5/12.5/0, `Pulse` 7.5/12.5/0).')
        .toBeLessThan(xy.vertical * 0.5);

      const zCanvas = composer.pane('Structure', 'X / Z').locator(SEL.paneCanvas);
      const snapshot = await zCanvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        return Array.from(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data);
      });
      const restore = () => zCanvas.evaluate((el, data) => {
        const c = el as HTMLCanvasElement;
        const ctx = c.getContext('2d')!;
        const img = ctx.createImageData(c.width, c.height);
        img.data.set(Uint8ClampedArray.from(data as number[]));
        ctx.putImageData(img, 0, 0);
      }, snapshot);

      /*
       * ── Mutation A · stretch the flat Z pane to fill its box, ALONE ────────────────────────────
       * ⚠️ **THIS IS THE DEFECT 22a EXISTS FOR, AND IT IS ALSO A PLAUSIBLE "IMPROVEMENT":** fitting each pane to
       * its own contents makes every pane look full, and `drawOverlayScore`'s header says so in its own words —
       * *"Do not 'improve' this by fitting each pane to its own contents … here it would additionally erase the
       * very difference the cyan curve exists to show."* A stretched flat pane is exactly what that change would
       * produce, so the seed paints one.
       */
      await zCanvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const ctx = c.getContext('2d')!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = 'rgba(235,242,255,0.95)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const x = 6 + (i / 80) * (c.width - 12);
          const y = 6 + ((Math.sin(i / 8) + 1) / 2) * (c.height - 12);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      const afterA = await composer.paneSpread('Structure', 'X / Z');
      expect(afterA.vertical, 'CALIBRATION: the stretch did not land — the `X / Z` pane still reads flat, so '
        + 'mutation A manufactured nothing.').toBeGreaterThan(xy.vertical * 0.5);
      expect(afterA.vertical < xy.vertical * 0.5, 'CALIBRATION FAIL: the flat `X / Z` pane was repainted to fill '
        + 'its box and 22a\'s "it is flatter" clause would still pass. Then 22a cannot see panes fitted '
        + 'INDIVIDUALLY — the one property `OverlayScore.extent` exists to provide, and the state in which every '
        + 'depth-only wave in the library is misrepresented as a full figure.').toBe(false);

      await restore();
      const back = await composer.paneSpread('Structure', 'X / Z');
      expect(back.vertical, 'CALIBRATION: mutation A did not restore, so mutation B would be measuring A\'s '
        + 'paint.').toBeLessThan(xy.vertical * 0.5);

      /*
       * ── Mutation B · a full-box line at the CROSSHAIR's alpha, ALONE ───────────────────────────
       * ⚠️ **THE VERDICT HERE IS *"THE READING DID NOT MOVE"*, WHICH IS THE OPPOSITE POLARITY FROM EVERY OTHER
       * SEED IN THIS FILE, AND IT IS RIGHT: `CLAUDE.md` — *"A MUTATION THAT CANNOT FAIL ALONE MUST BE SEEDED WITH
       * THE DEFECT IT WOULD CONCEAL, AND ITS EXPECTED VERDICT IS GREEN."*** The threshold's job is to be blind to
       * this ink; a seed proving it is blind is the only way to know 22a's flat readings are not simply the
       * crosshair being under-counted by luck.
       */
      await zCanvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const ctx = c.getContext('2d')!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c.width / 2, 2);
        ctx.lineTo(c.width / 2, c.height - 2);
        ctx.stroke();
      });

      const afterB = await composer.paneSpread('Structure', 'X / Z');
      const ink8 = await zCanvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let minY = c.height, maxY = -1;
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            if (d[(y * c.width + x) * 4 + 3]! < 8) continue;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        return maxY < 0 ? 0 : (maxY - minY) / c.height;
      });
      expect(ink8, 'CALIBRATION: an alpha-8 read does not see the painted crosshair-alpha line either, so this '
        + 'mutation is not demonstrating what the 64 threshold excludes — the paint did not land.')
        .toBeGreaterThan(0.5);
      expect(afterB.vertical, 'CALIBRATION FAIL: a full-height line at the crosshair\'s alpha (0.10 ⇒ ≈25) moved '
        + '`paneSpread`\'s vertical reading. Then the threshold is below the crosshair and EVERY pane reads as '
        + 'reaching its full height — under which 22a cannot fail in either direction, and its flat readings are '
        + `an artefact. The alpha-8 read of the same pane is ${ink8.toFixed(3)}, which is what the 64 cut exists `
        + 'to reject.').toBeLessThan(xy.vertical * 0.5);

      await restore();
    });

  /*
   * ══ SEED 5 · the flat caption, BOTH directions, and the missing-element case (E111) ════════════
   *
   * ⚠️ **THREE MUTATIONS BECAUSE THE CAPTION HAS THREE FAILURE MODES AND THEY FAIL DIFFERENTLY.** Hidden where it
   * must show (E111's clause goes vacuous); shown where it must not (the caption appears on every pane, which is
   * 16.20's recorded shape — `OverlayScore.silent` is figure-wide and `paneExtent` is per-pane); and the ELEMENT
   * ABSENT, which reads as *"not flat"* — the silent direction, because two of the three clauses are absence
   * claims and both pass.
   */
  test('seed 5 — the flat caption is caught hidden, caught over-showing, and caught MISSING',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Fluid Metall');
      await composer.openComposer();
      await composer.assertFlatCaptionsExist();

      const flatCap = composer.paneFlatCaption('Combined figure', 'Y / Z');
      const litCap = composer.paneFlatCaption('Combined figure', 'X / Y');

      expect(await composer.paneIsFlat('Combined figure', 'Y / Z'), 'CALIBRATION: Fluid Metall\'s `Y / Z` pane '
        + 'does NOT show the flat caption before any mutation. That is not a seed failure — E111 is red. Measured: '
        + 'its `paneExtent` is exactly 0 against a figure extent of 50, which is the caption\'s precondition '
        + 'exactly. Report it.').toBe(true);
      expect(await composer.paneIsFlat('Combined figure', 'X / Y'), 'CALIBRATION: the `X / Y` pane ALREADY shows '
        + 'the caption, so the over-showing half has nothing to manufacture — and the caption is on a pane that '
        + 'reaches 50 model units, which is 16.20\'s defect live.').toBe(false);
      expect(((await flatCap.textContent()) ?? '').trim(), `CALIBRATION: the caption does not read `
        + `${JSON.stringify(FLAT_PANE_CAPTION)}, so the mutations below are about a different string. The wording `
        + 'was NARROWED by measurement: `no Z size` is wrong because a zero WINDING flattens a pane whose sizes '
        + 'are real.').toBe(FLAT_PANE_CAPTION);

      /* ── Mutation A · hide the caption that must show, ALONE ───────────────────────────────── */
      await flatCap.evaluate((el) => { (el as HTMLElement).style.display = 'none'; });
      expect(await flatCap.count() > 0, 'CALIBRATION: the caption left the DOM when hidden, so this half is '
        + 'demonstrating a deletion rather than the present-but-invisible state a `count()` clause cannot see — '
        + 'which is mutation C\'s job, not A\'s.').toBe(true);
      expect(await composer.paneIsFlat('Combined figure', 'Y / Z'), 'CALIBRATION FAIL: the caption was hidden by '
        + '`display` and `paneIsFlat` still reports the pane as captioned. Then it is a `count()` check in '
        + 'disguise — and the caption is toggled by `display`, so it is present on every pane in the library and '
        + 'the clause would be green everywhere.').toBe(false);
      await flatCap.evaluate((el) => { (el as HTMLElement).style.display = ''; });
      expect(await composer.paneIsFlat('Combined figure', 'Y / Z'), 'CALIBRATION: mutation A did not restore.')
        .toBe(true);

      /* ── Mutation B · show the caption that must not, ALONE ──────────────────────────────────
       * ⚠️ **THE RESTORE CAPTURES THE ORIGINAL INLINE VALUE AND DOES NOT ASSUME `''` — WRITING `''` WAS THIS
       * SEED'S OWN DEFECT AND IT SHIPPED RED.** `composer.ts:1130` builds every caption with an inline
       * `style.display = 'none'` and toggles that same property, so a lit pane's caption is hidden BY an inline
       * value: clearing the property does not restore it, it REVEALS it. The seed then failed its own
       * did-B-restore check — the harness accusing the subject, one level down, inside a calibration seed.
       * **Read the property before mutating it whenever `src` sets it inline; `''` is only the restore for a
       * property the source never wrote.** (Mutation A is the safe direction by luck rather than by design: the
       * flat pane's caption is shown by `display = ''`, so there `''` happens to be correct.) */
      const litCapDisplay = await litCap.evaluate((el) => (el as HTMLElement).style.display);
      expect(litCapDisplay, 'CALIBRATION: a lit pane\'s caption is not hidden by an INLINE `display`, so the '
        + 'restore below is guessing. `composer.ts` sets `flatCap.style.display = \'none\'` at build time and '
        + 'toggles that property — if that changed, re-derive the restore rather than widening this.').toBe('none');
      await litCap.evaluate((el) => { (el as HTMLElement).style.display = 'block'; });
      expect(await composer.paneIsFlat('Combined figure', 'X / Y') === false, 'CALIBRATION FAIL: the flat caption '
        + 'was forced visible on a pane that reaches 50 model units and E111\'s `not flat` clause would still '
        + 'pass. Then nothing measures the caption\'s SCOPE — and a caption keyed on the figure-wide '
        + '`OverlayScore.silent` instead of the per-pane `paneExtent` would light all three panes while every one '
        + 'of them draws a curve, which is the diagnostic contradicting itself on screen.').toBe(false);
      await litCap.evaluate((el, d) => { (el as HTMLElement).style.display = d; }, litCapDisplay);
      expect(await composer.paneIsFlat('Combined figure', 'X / Y'), 'CALIBRATION: mutation B did not restore, so '
        + 'mutation C would be measuring B\'s state.').toBe(false);

      /*
       * ── Mutation C · REMOVE one caption element, ALONE ─────────────────────────────────────────
       * ⚠️ **THE SILENT DIRECTION, AND THE REASON `assertFlatCaptionsExist()` IS CALLED BEFORE EVERY CAPTION
       * CLAUSE RATHER THAN ONCE PER FILE:** a pane with no caption element reads as *"not flat"*, so a renamed
       * class would turn E111's two absence clauses green and its one presence clause into the only red — and a
       * single red among three greens reads as a preset problem, not an instrument one.
       */
      const nBefore = await composer.page.locator(`${SEL.tabContent} ${SEL.paneFlat}`).count();
      expect(nBefore, 'CALIBRATION: no caption elements at all, so mutation C cannot remove one.')
        .toBeGreaterThan(0);
      await litCap.evaluate((el) => { el.remove(); });
      const nAfter = await composer.page.locator(`${SEL.tabContent} ${SEL.paneFlat}`).count();
      expect(nAfter, 'CALIBRATION: the removal did not land, so nothing below is demonstrated.').toBe(nBefore - 1);

      expect(await composer.paneIsFlat('Combined figure', 'X / Y'), 'CALIBRATION: a pane with NO caption element '
        + 'does not read as `false`. Then the silent direction this half is about does not exist and '
        + '`assertFlatCaptionsExist()` can be reconsidered.').toBe(false);

      let guardFailed = false;
      try {
        await composer.assertFlatCaptionsExist();
      } catch { guardFailed = true; }
      expect(guardFailed, 'CALIBRATION FAIL: a caption element was REMOVED from a pane and '
        + '`assertFlatCaptionsExist()` still returned. Then a renamed class would make every absence clause in '
        + 'E111 pass — "the pane is not captioned" and "the pane has no caption element" being the same reading — '
        + 'and the one presence clause would be the only red, which reads as a preset problem rather than an '
        + 'instrument one.').toBe(true);
    });
});
