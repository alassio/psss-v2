/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * Phase 17.4 — THE DIAGRAM PANE PIXEL CHANNEL
 *
 * Discharges the pane-pixel steps of `TESTPLAN-phase16-composer.md` §A5 — **18, 19, 20, 21, 22, 22a, 22b** —
 * plus the pane half of **33a**, which spec 06 defers here by name, and the flat CAPTION (E111), which no other
 * spec observes.
 *
 * ⚠️ **NOT ONE CLAUSE HERE IS A STORED-IMAGE BASELINE, AND THAT IS A DECISION WITH A REASON RATHER THAN AN
 * OMISSION.** `toHaveScreenshot` answers *"does this pane match a PNG I committed"*, and no step in §A5 asks that.
 * 22a asks whether two panes are FLATTER than a third; 22b whether the cyan curve is a different SIZE from the
 * white one; 20 whether cyan and amber are ABSENT. A baseline would go stale on any legitimate retune, and when it
 * failed it would name no quantity. **Every clause below measures a NAMED quantity: per-colour ink, or vertical
 * spread.**
 *
 * ⚠️ **THE DIAGRAM IS THE ONE SURFACE ON WHICH A PIXEL READ IS SOUND HERE.** The plan measured it as *"no rotation,
 * no canvas fit, one frozen instant"* — deterministic 2D canvas. The GL frame is not, which is why Phase 5's
 * clauses are `?testhook=1` reads and these are `getImageData`.
 *
 * ⚠️ **EVERY LITERAL IN THIS FILE WAS MEASURED IN NODE AGAINST THE SHIPPED `score-canvas.ts` AND THE SHIPPED
 * PRESET UNION (314 keys) BEFORE IT WAS WRITTEN — `computeOverlayScores` AND `paneExtent` ARE PURE, SO A CLAUSE'S
 * SUBJECT CAN BE CHECKED WITHOUT A BROWSER AT ALL, AND FIVE OF THIS FILE'S FIRST-DRAFT EXPECTATIONS DIED THAT
 * WAY.** They are worth naming, because each would have read as an engine defect:
 *   1. **The plan's step 22 says *"double every Body `Size`"* — Aliens DNA's Body `Size` is `0 / 0 / 0`.** Its
 *      whole reach is `Pulse`. That edit is a NO-OP (measured: extent unchanged at 61.8193), and the step would
 *      have failed reporting `reach ±…` inert. `CLAUDE.md`: a slot is silent iff its AMPLITUDE is zero, and many
 *      audible slots wind entirely via a modulator.
 *   2. **Doubling ONE row of a three-row figure legitimately CHANGES the shapes** — the extent is the MAX over
 *      rows, so the doubled row grows relative to the others and the auto-fit correctly redraws them smaller
 *      (measured on Aliens DNA: XY vertical spread 0.770 → 0.540). *"The shapes barely change"* is only true when
 *      every LIVE row doubles. **The subject is now `Argus`, whose Body is its only live row.**
 *   3. **Aliens DNA's Structure Z panes are visually flat but their `paneExtent` is NOT zero** (15 and 25), so the
 *      flat CAPTION is correctly absent there. 22a's picture half and E111's caption half have DIFFERENT subjects;
 *      asserting both on one preset would have failed on correct behaviour.
 *   4. **A row's cyan/amber curves can be present-but-zero-sized rather than `null`** (Aliens DNA Body: `size` and
 *      `winding` raster to 0–1 px in every plane), so a `!== null` check is not an "is drawn" check — which is how
 *      `Aliens DNA` looked like a valid subject for 22b when it is not.
 *   5. **`maxWinding` for Dancing Rays is 8001, not the plan's 8000** — `sampleCountFor` bounds by
 *      `|base| + |amplitude|`, and that `+1` is a correct modulated bound, not a typo. A literal `8000` clause
 *      would have failed naming the engine.
 *
 * ⚠️ **THE COLOUR CLASSIFIER IS A HUE ORDERING (`r > b` amber, `b > r` cyan, neither white) AND IT IS WHAT MAKES A
 * PERMUTED PALETTE VISIBLE** — `CLAUDE.md` records that shape verbatim for this tab's legend. An exact-RGB clause
 * would count almost nothing (every curve is composited at 0.75/0.95 and anti-aliased) and report every curve
 * ABSENT, which is step 20's silent direction: the step it exists to discharge would pass on a blank pane.
 *
 * ⚠️ **AND THE STEPS THIS FILE CANNOT DISCHARGE ARE NAMED RATHER THAN QUIETLY COVERED.** 19's *"the legend's
 * colours match the curves you can SEE"* is asserted here PER KEY against `panel.css`, but the *"a cyan swatch over
 * an amber curve"* judgement stays the owner's — a spec comparing swatch and curve to the same declaration cannot
 * see a case where BOTH moved together. **22b's verdict is likewise the owner's**: this file measures that cyan
 * differs from white in SIZE and amber in SHAPE, which is the arithmetic; whether a reader can tell WHICH IS WHICH
 * is the human half, and `TESTPLAN` lists it among the ~12 that stay theirs. **A suite reporting these green would
 * be claiming to have answered them.**
 *
 * ⚠️ **SEEDS SHIP IN THE SAME SITTING (`tests/09-diagram-pane-seeds.spec.ts`).** `CLAUDE.md`: *"A SPEC WITHOUT A
 * SEED DISCHARGES NOTHING, WHATEVER COLOUR IT REPORTS."*
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, expect } from './composer-fixture';
import { SEL, PLANE_CAPTIONS, FLAT_PANE_CAPTION, HUE_SPLIT } from './composer-fixture';

/**
 * The three curve colours.
 *
 * ⚠️ **DECLARED HERE AS A SECOND COPY OF THE `OVERLAY_STYLES` CONSTANTS RATHER THAN IMPORTED, BECAUSE `src/` AND
 * `tests/` COMPILE UNDER TWO TSCONFIGS AND THE HARNESS MAY NOT ADD A FILE UNDER `src/`** (`deadcheck` counts `src`
 * files; a single addition moves it 80 → 81). So there is no compiler between the copies — `TEST_HOOK_KEYS`'
 * situation exactly, handled the same way: the legend clause below compares these to the SHIPPED `panel.css`
 * values **per key**, so a drift in either direction fails naming the key.
 */
const CURVE = {
  now: '#ebf2ff',
  size: '#60d6e0',
  winding: '#e0a848',
} as const;

/** `rgb(…)`/`rgba(…)` → `#rrggbb`. `getComputedStyle().color` never returns a hex. */
const toHex = (rgb: string): string => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return rgb;
  return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
};

test.describe('Phase 17.4 — the diagram panes, measured per colour and per plane', () => {
  /* ═══ §A5 · steps 18, 19 — three panes, three colours, and the panes DIFFER ══════════════════════
   * ⚠️ **STEP 19'S WHOLE POINT IS THAT THE PANES ARE NOT COPIES OF EACH OTHER**, and it replaced a plane CHIP that
   * no longer exists — so a step that clicked to switch planes would be a retired CONTROL, which `CLAUDE.md`
   * grades as worse than retired copy.
   */
  test('steps 18, 19 — Aliens DNA draws three DIFFERENT panes, each with a white curve, with cyan and amber '
    + 'in the plane it pulses and wobbles in, and the legend names all three by their own colours',
  async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();

    // step 18, first half — every plane of the combined figure carries white ink.
    const ink = new Map<string, Awaited<ReturnType<typeof composer.paneInk>>>();
    for (const plane of PLANE_CAPTIONS) {
      const k = await composer.paneInk('Combined figure', plane);
      ink.set(plane, k);
      expect(k.white, `step 18: the \`${plane}\` pane of the combined figure has no white ("now") ink. White is `
        + 'drawn LAST and at the highest alpha (0.95 against the extremes\' 0.75), so its absence means the pane '
        + 'drew nothing rather than that a curve is hidden. ⚠️ Note `drawOverlayScore` returns early on '
        + '`!(extent > 0)` AFTER drawing the faint crosshair, so a pane with no reach still has neutral ink — '
        + 'which is why E111\'s caption is a separate observation from this one.').toBeGreaterThan(0);
    }

    /*
     * step 18, second half — cyan AND amber, in the plane that carries them.
     * ⚠️ **ASSERTED ON THE `X / Y` PANE ONLY, AND THE NARROWNESS IS MEASURED RATHER THAN CAUTIOUS: Aliens DNA's
     * modulators live in X and Y, so the combined `X / Z` pane rasters 0 cyan pixels and `Y / Z` just 4.** The
     * step's own wording is *"where the figure pulses or wobbles"* — a per-PLANE claim, not a per-figure one, and
     * demanding cyan in all three panes would fail on a correct diagram. Measured at the shipped 150 px combined
     * pane: XY amber 274 / cyan 176 / white 2391.
     *
     * ⚠️ **AND IT IS THE COMBINED PANE, NOT THE `Body` ROW'S — WHICH WAS THE FIRST DRAFT'S DEFECT.** Body's
     * `size` and `winding` curves raster to 0–1 px in every plane (they are non-`null` Float32Arrays of a
     * degenerate path), so a Body-row cyan clause fails on a correct diagram. `Structure` is the row that
     * actually pulses visibly here; the combined pane superimposes it.
     */
    const xy = ink.get('X / Y')!;
    expect(xy.cyan, 'step 18: the combined `X / Y` pane carries NO cyan ink. Aliens DNA pulses in X and Y '
      + '(`Pulse` 15/25 on Body, 7.5/12.5 on Structure), and cyan is the size extreme — `size extreme (Pulse)` in '
      + 'the legend. ⚠️ It is also the whole reason the diagram samples an instant SEARCHED over the slowest '
      + 'modulator\'s period rather than `t = 0`: at `t = 0` every modulator collapses to its base and this curve '
      + 'would sit exactly on the white one.').toBeGreaterThan(0);
    expect(xy.amber, 'step 18: the combined `X / Y` pane carries NO amber ink. Aliens DNA wobbles, and amber is '
      + 'the winding extreme — the only curve that shows a `Wobble` at all.').toBeGreaterThan(0);

    /*
     * step 19 — the three panes DIFFER. ⚠️ **Compared as ink TRIPLES rather than as totals: two different curves
     * can carry the same number of pixels, so a total-only clause is the weaker test and it is weak in the
     * direction that matters** (it passes on three identical panes drawn from one plane's data). Measured: the
     * three signatures are all distinct.
     */
    const sigs = PLANE_CAPTIONS.map((p) => {
      const k = ink.get(p)!;
      return `${k.amber}/${k.cyan}/${k.white}`;
    });
    expect(new Set(sigs).size, `step 19: the three panes have identical ink signatures (${sigs.join(' , ')}), so `
      + 'they are drawing the same plane more than once. There is no plane chip to click any more — the three '
      + 'panes being genuinely different projections IS what 16.9 delivered, and `evaluateAt3` is what makes it '
      + 'possible.').toBe(3);

    /*
     * step 19's legend half — asserted PER KEY against the shipped `panel.css` declaration.
     * ⚠️ **A SET-MEMBERSHIP CLAUSE CANNOT SEE A PERMUTATION** (`CLAUDE.md`, recorded against this exact legend):
     * *"each swatch IS one of the three curve colours"* passes on a legend whose swatches are SWAPPED. So each key
     * is compared to ITS OWN declared colour by name. The swatch is a `::before` painted with `currentColor`, so
     * the readable quantity is the span's `color`.
     */
    const legend = composer.page.locator(`${SEL.tabContent} ${SEL.legend}`);
    await expect(legend, 'CALIBRATION: no `.sl-composer-legend` in the tab, so every clause below would be '
      + 'reading an empty object — and three absent colours compare EQUAL to each other.').toHaveCount(1);

    const legendColours = await legend.evaluate((root) => {
      const out: Record<string, string> = {};
      for (const cls of ['now', 'size', 'winding']) {
        const el = root.querySelector(`.sl-composer-key-${cls}`);
        out[cls] = el ? getComputedStyle(el).color : '';
      }
      return out;
    });

    for (const key of ['now', 'size', 'winding'] as const) {
      expect(legendColours[key], `step 19: there is no \`.sl-composer-key-${key}\` span in the legend, so the `
        + 'colour clause below has nothing to read — and an absent colour is not a wrong one.').not.toBe('');
      expect(toHex(legendColours[key]!), `step 19: the legend's \`${key}\` swatch colour disagrees with the `
        + `declaration (expected ${CURVE[key]}). ⚠️ Compared PER KEY on purpose: a clause asserting only that each `
        + 'swatch is ONE OF the three colours passes on a legend whose cyan and amber are SWAPPED — a diagram '
        + 'that is confidently mislabelled, which is strictly worse than an ugly one. ⚠️ If `panel.css` and '
        + '`score-canvas.ts` were retuned TOGETHER this clause is what must be updated, and no automated clause '
        + 'can see that case — which is why 19\'s "does the swatch match the curve you can SEE" half stays the '
        + 'owner\'s.').toBe(CURVE[key]);
    }
  });

  /* ═══ §A5 · step 20 — a preset with no modulators draws WHITE ONLY ════════════════════════════════
   * ⚠️ **THIS IS THE ABSENCE CLAUSE, SO ITS CORPUS IS ASSERTED NON-EMPTY FIRST.** `CLAUDE.md`: *"an absence test
   * over an empty corpus reports PASS"* — a pane that failed to draw has no cyan either, and without the white
   * clause this step would be green on a blank diagram.
   */
  test('step 20 — Cylinder has no pulse and no wobble anywhere, so all three panes draw WHITE only',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Cylinder');
      await composer.openComposer();

      /*
       * ⚠️ **`Cylinder`, MEASURED: EVERY PANE RASTERS `a0 c0` AT BOTH SHIPPED PANE SIZES** — the two extreme
       * curves are not merely small but not built at all. It is also a LOW-ACCUMULATION preset, which `CLAUDE.md`
       * requires for any judgement about what reaches the screen.
       *
       * ⚠️ **`Cylinder` IS now replaced by its refined entry** (settled 2026-09-12; this comment used to say the
       * opposite, and a false premise that still passes is the worse failure). The step is unaffected and the
       * reason is specific, not reassurance: a Score pane is rasterised from `generators.waves` alone, and the
       * refined body's wave table is byte-identical to the legacy one (checked by importing both). The settle
       * changes the PRESENTATION — a `Customize` look at exposure 1.13 with the `Neon` palette — and no grading
       * reaches a Score pane. ⚠️ It also keeps `decayFactor` 0, so the `CLAUDE.md` clause above still holds; a
       * future settle that raised the accumulation would invalidate that sentence and nothing here would fail.
       */
      for (const plane of PLANE_CAPTIONS) {
        const k = await composer.paneInk('Combined figure', plane);

        // ⚠️ The non-empty assertion comes FIRST. Without it the two absence clauses pass on a blank pane.
        expect(k.white, `step 20: the \`${plane}\` pane has no white ink, so the two absence clauses below would `
          + 'be measuring a pane that drew nothing — and an absence test over an empty corpus reports PASS.')
          .toBeGreaterThan(0);

        /*
         * ⚠️ **THE BOUND IS A FRACTION OF THE WHITE INK, NOT ZERO, AND THE REASON IS ANTI-ALIASING RATHER THAN
         * TOLERANCE-PICKING.** An anti-aliased edge composited over the panel drifts a few units, so a hard 0
         * would fail a correct diagram. **`CLAUDE.md`: never pick a tolerance that passes — derive it.** A genuine
         * second curve is a full-length path, the same ORDER as the white one (measured across the library: where
         * cyan is drawn at all it is 11–176 px against 88–7539 white), so 2 % separates edge artefacts from a
         * present curve by an order of magnitude in each direction.
         *
         * ⚠️ **THIS STEP FAILED ON `paneInk`'s CLASSIFIER, NOT ON THE BOUND, AND ITS OWN COMMENT USED TO STATE THE
         * DEFECTIVE ARITHMETIC AS ITS JUSTIFICATION** — *"`b − r` is 20, under the classifier's 24, so a clean
         * white pixel classifies as white"*. Both halves were true and the conclusion did not follow: a margin of
         * **4** is not a classification, and 42 of `Cylinder`'s white-edge pixels (all alpha ≤ 31, sampling
         * `rgba(230,238,255,30)`) crossed it. The split is now derived from `OVERLAY_STYLES` in `paneInk`. ⚠️ **A
         * COMMENT THAT RECITES A THRESHOLD IS A SECOND COPY OF IT: the number belongs to the classifier, and this
         * step must not name one — quoting it here is what made a 4-unit margin read as a safety argument.**
         */
        const bound = Math.max(4, k.white * 0.02);
        expect(k.cyan, `step 20: the \`${plane}\` pane carries cyan ink (${k.cyan} against ${k.white} white). `
          + 'Cylinder has no `Pulse` on any axis of any level, so the size-extreme curve must not be drawn at '
          + 'all. Cyan here means either the extreme search found a departure where there is none, or all three '
          + 'curves are being drawn from the same data.').toBeLessThanOrEqual(bound);
        expect(k.amber, `step 20: the \`${plane}\` pane carries amber ink (${k.amber} against ${k.white} white). `
          + 'Cylinder has no `Wobble` anywhere, so the winding-extreme curve must not be drawn.')
          .toBeLessThanOrEqual(bound);
      }
    });

  /* ═══ §A5 · step 21 — the undersampling notice ═══════════════════════════════════════════════════
   * ⚠️ **AN UNDERSAMPLED DIAGRAM MUST SAY SO RATHER THAN LOOK FINE** — above the sample ceiling a high winding
   * aliases into a different, plausible CLOSED curve, which is a diagnostic being confidently wrong. It is a text
   * clause and it lives here rather than in spec 06 because its subject is the diagram's own fidelity.
   */
  test('step 21 — Dancing Rays says the diagram is undersampled, and names a winding of 8001 rather than the '
    + 'plan\'s 8000', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Dancing Rays');
    await composer.openComposer();

    const extent = composer.page.locator(`${SEL.tabContent} ${SEL.extent}`);
    await expect(extent, 'CALIBRATION: no `.sl-composer-extent` readout, so this step has no observation '
      + 'channel.').toHaveCount(1);
    const text = ((await extent.textContent()) ?? '').trim();

    expect(text, 'CALIBRATION: the extent readout is empty. It is composed from `byScore.get(null)` and always '
      + 'begins with `reach ±…`, so an empty string means the combined score is missing — under which the '
      + 'undersampling clause below would be asserting about nothing.').not.toBe('');
    expect(text, 'step 21: the readout does not state `reach ±…`. That readout is the answer to the diagram\'s '
      + 'one blind spot — the panes auto-fit, so doubling every size changes the picture not at all (invariant '
      + '13\'s harder form: the control moves the right thing and the picture cannot show it).').toMatch(/reach ±/);
    expect(text, 'step 21: the readout does not say the diagram is undersampled. Dancing Rays carries a winding '
      + 'of 8000, far above the sample ceiling, where the curve ALIASES into a different and entirely plausible '
      + 'closed figure. A diagram that looks fine while being wrong is the worst failure a diagnostic can have, '
      + 'which is why the notice exists at all.').toMatch(/diagram undersampled/);

    /*
     * ⚠️ **8001, AND THE `+1` IS THE ENGINE BEING RIGHT WHERE THE PLAN IS ROUND.** `sampleCountFor` bounds the
     * requirement by `|fm.base| + |fm.amplitude|` — 8000 + 1 — because a modulated winding can exceed its base,
     * and the sampling requirement is set by the peak. The plan says 8000. **A literal `8000` clause would have
     * failed naming the engine for a correct bound**, so the number is read out of the string and asserted as a
     * RANGE around the authored base instead. Measured alongside it: `reach ±273.2`.
     */
    const m = /winding (\d+(?:\.\d+)?) — diagram undersampled/.exec(text);
    expect(m, `step 21: the notice does not name a winding number. Got ${JSON.stringify(text)}. The shipped `
      + 'phrasing is `winding <n> — diagram undersampled`, appended to the reach with ` · `.').not.toBeNull();
    const named = Number(m![1]);
    expect(named, `step 21: the notice names winding ${named}, which is below the authored 8000 — so it is not `
      + 'reporting this figure\'s winding at all.').toBeGreaterThanOrEqual(8000);
    expect(named, `step 21: the notice names winding ${named}, far above the authored 8000 plus its modulator. `
      + '⚠️ Expect 8001, NOT the plan\'s 8000: `sampleCountFor` bounds by `|base| + |amplitude|` on purpose. '
      + 'Asserted as a range so that neither a bound change nor a preset retune reads as the notice being '
      + 'broken.').toBeLessThanOrEqual(8010);
  });

  /* ═══ §A5 · step 22 — auto-fit means the SHAPES hold while `reach ±…` doubles ═════════════════════
   * ⚠️ **INVARIANT 13'S HARDER FORM WITH BOTH HALVES IN ONE STEP: the control moves exactly the right thing, the
   * diagram CANNOT show it, and the readout is the output channel that can.** A step asserting only that the
   * readout doubled would pass on a diagram that also rescaled; one asserting only that the picture held would
   * pass on a control that did nothing.
   */
  test('step 22 — doubling every live amplitude on Argus doubles `reach ±…` EXACTLY while the pane shapes do not '
    + 'move at all', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();

    /*
     * ⚠️ **`Argus`, NOT THE PLAN'S `Aliens DNA`, AND THE SWAP IS FORCED BY TWO MEASUREMENTS RATHER THAN CHOSEN.**
     *   1. The plan says *"double every Body `Size`"*. **Aliens DNA's Body `Size` is `0 / 0 / 0`** — its whole
     *      reach is `Pulse` 15/25/64. That edit is a no-op and the step would fail reporting `reach ±…` inert.
     *   2. Doubling ONE row of a three-row figure legitimately CHANGES the shapes, because the extent is the MAX
     *      over rows: measured on Aliens DNA, the XY vertical spread went 0.770 → 0.540 for a correct auto-fit.
     *      *"The shapes barely change"* is only true when every LIVE row doubles.
     * **Argus satisfies both: its Body carries `Size` 50/50/0 AND `Pulse` 0/0/100, and its other two rows are
     * entirely silent** — so one row is the whole figure. Measured either side of this edit: extent 100 → 200,
     * ratio exactly 2.00000, and all three panes' vertical spreads AND ink counts byte-identical (xy 0.4667 /
     * 4243 px, xz and yz 0.9333 / 4129 and 4888 px).
     */
    await composer.loadPreset('Argus');
    await composer.openComposer();

    const extentEl = composer.page.locator(`${SEL.tabContent} ${SEL.extent}`);
    const reachOf = async (): Promise<number> => {
      const t = ((await extentEl.textContent()) ?? '').trim();
      const mm = /reach ±([0-9.]+)/.exec(t);
      expect(mm, `CALIBRATION: no \`reach ±…\` number in ${JSON.stringify(t)}, so this step cannot measure its `
        + 'own subject.').not.toBeNull();
      return Number(mm![1]);
    };

    const sizeBefore = await composer.axisTriple('Body', 'Size');
    const pulseBefore = await composer.axisTriple('Body', 'Pulse');
    expect(sizeBefore.some((v) => v !== 0) && pulseBefore.some((v) => v !== 0),
      `CALIBRATION: Argus's Body does not carry BOTH a nonzero Size (${JSON.stringify(sizeBefore)}) and a nonzero `
      + `Pulse (${JSON.stringify(pulseBefore)}). This step needs both, because a slot's reach is its AMPLITUDE — `
      + 'base plus modulator — and doubling only one half would not double the extent.').toBe(true);
    for (const s of [1, 2]) {
      expect(await composer.isEmptyRow(s), `CALIBRATION: Argus's level ${s} is not empty, so the figure has a `
        + 'second live row and doubling Body alone would legitimately RESCALE the panes — which is the very thing '
        + 'this step\'s second half asserts does not happen.').toBe(true);
    }

    const before = await reachOf();
    const spreadBefore = new Map<string, Awaited<ReturnType<typeof composer.paneSpread>>>();
    for (const plane of PLANE_CAPTIONS) {
      const s = await composer.paneSpread('Combined figure', plane);
      spreadBefore.set(plane, s);
      expect(s.ink, `CALIBRATION: the \`${plane}\` pane has no ink above the curve alpha threshold, so the shape `
        + 'comparison below has no subject. (The threshold is 64 on purpose — the crosshair is drawn at alpha '
        + '0.10 and spans the whole box, so a lower one would report every pane as full.)').toBeGreaterThan(0);
    }

    /*
     * ⚠️ **ONLY THE NONZERO FIELDS ARE WRITTEN, AND THAT IS NOT TIDINESS: A `fill()` OF THE VALUE A FIELD ALREADY
     * HOLDS FIRES NO `change`**, so writing `0` over a `0` would depend on which of the two handlers (`change` or
     * `blur`) happens to run — an ambiguity in the harness, not in the tab. Doubling zero is a no-op either way,
     * so skipping it changes nothing about what the step asserts and removes the ambiguity.
     */
    for (const [i, axis] of (['X', 'Y', 'Z'] as const).entries()) {
      if (sizeBefore[i] !== 0) await composer.setField('Body', 'Size', axis, String(sizeBefore[i]! * 2));
      if (pulseBefore[i] !== 0) await composer.setField('Body', 'Pulse', axis, String(pulseBefore[i]! * 2));
    }
    await composer.page.waitForTimeout(500);

    const after = await reachOf();

    /*
     * ⚠️ **`toBeCloseTo`, NOT A LOOSE BOUND, BECAUSE THE ARITHMETIC IS EXACT AND ONLY THE READOUT'S ROUNDING IS
     * NOT.** `evaluate` is linear in every amplitude, so doubling all four live fields doubles the extent
     * identically — measured 100 → 200. The readout prints `Number(extent.toFixed(1))`, so the only slack needed
     * is one decimal place. **A "grew somewhat" bound here would pass on a control that scaled by 1.1.**
     */
    expect(after / before, `step 22: \`reach ±\` went ${before} → ${after}, a factor of `
      + `${(after / before).toFixed(4)} rather than 2. The panes auto-fit as a group, so this readout is the ONLY `
      + 'channel that can show an amplitude change — if it is inert or wrong the whole control reads as dead '
      + '(invariant 13\'s harder form). ⚠️ The expected factor is EXACT, not approximate: `evaluate` is linear in '
      + 'every amplitude and Argus has exactly one live row.').toBeCloseTo(2, 2);

    /*
     * The shapes do not change — the auto-fit half. ⚠️ **Measured as SPREAD rather than as a pixel diff:** the
     * curve is redrawn from doubled data at a doubled extent, so a diff would report every anti-aliased pixel as
     * changed and call the auto-fit broken. Measured either side: xy 0.4667 → 0.4667, xz 0.9333 → 0.9333,
     * yz 0.9333 → 0.9333 — so 0.04 is a wide margin around a change of ZERO, and it is a bound rather than
     * equality only because a subpixel round can move one raster row in a browser that the Node oracle does not.
     */
    for (const plane of PLANE_CAPTIONS) {
      const b = spreadBefore.get(plane)!;
      const a = await composer.paneSpread('Combined figure', plane);
      expect(Math.abs(a.vertical - b.vertical),
        `step 22: the \`${plane}\` pane's vertical spread moved from ${b.vertical.toFixed(3)} to `
        + `${a.vertical.toFixed(3)} — the diagram RESCALED when every amplitude doubled. The panes fit their `
        + 'contents as a group, which is right (an authored size of 800 and one of 8 must both be visible), and '
        + 'the consequence is that doubling everything must change the picture not at all. ⚠️ Do not "fix" a '
        + 'failure here by fixing the scale — the extent READOUT is the fix, and `composer.ts` says so.')
        .toBeLessThan(0.04);
    }
  });

  /* ═══ §A5 · step 22a — THE SHARED FRAME, the one property of 16.9 no checker can show ════════════
   * ⚠️ **AND THE QUANTITY IS SPREAD, NOT INK COUNT, WHICH IS WHY THIS STEP NEEDED A NEW HELPER.** A flat pane
   * draws a horizontal LINE — plenty of ink — so "fewer pixels" cannot tell flat from full and a count-based 22a
   * would pass on panes fitted individually, i.e. on exactly the defect it exists to catch.
   */
  test('step 22a — Aliens DNA Structure has no Z reach, so its two Z panes draw FLAT while its X / Y pane '
    + 'carries the figure — because all three share one extent', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();
    await composer.assertFlatCaptionsExist();

    /*
     * ⚠️ **THE PRECONDITION IS THE Z AXIS BEING SILENT, AND SILENCE IS `size + pulse === 0` — NEVER SIZE ALONE.**
     * The plan describes this row as *"reach `15 / 25 / 0` — no Z size"*; the checkable form is both amplitude
     * fields zero, because a Z pulse over a zero size is a real authored reach. Measured: Structure's `Size` is
     * `7.5 / 12.5 / 0` and its `Pulse` is `7.5 / 12.5 / 0`.
     */
    const zSize = (await composer.axisTriple('Structure', 'Size'))[2];
    const zPulse = (await composer.axisTriple('Structure', 'Pulse'))[2];
    expect([zSize, zPulse], 'CALIBRATION: Aliens DNA Structure\'s Z axis is not silent, so this is not step 22a\'s '
      + 'state — the two Z panes would legitimately carry a figure and this step would report the shared frame as '
      + 'broken.').toEqual([0, 0]);

    const xy = await composer.paneSpread('Structure', 'X / Y');
    const xz = await composer.paneSpread('Structure', 'X / Z');
    const yz = await composer.paneSpread('Structure', 'Y / Z');

    expect(xy.ink, 'CALIBRATION: the Structure `X / Y` pane has no ink, so every comparison below would be '
      + 'against zero — and two zeros are EQUAL, which is this step\'s silent direction.').toBeGreaterThan(0);
    expect(xy.vertical, 'CALIBRATION: the Structure `X / Y` pane\'s figure has no vertical extent either, so it '
      + 'cannot serve as the "carries the figure" reference. Measured 0.896 of the box at the shipped 96 px slot '
      + 'pane.').toBeGreaterThan(0.3);

    /*
     * ⚠️ **THE COMPARISON IS BETWEEN PANES, NOT AGAINST A CONSTANT, AND THAT IS WHAT MAKES IT A TEST OF THE
     * SHARED FRAME.** If each pane were fitted to its own contents, a Z pane holding a degenerate line would be
     * stretched to fill its box and its vertical spread would MATCH `X / Y`'s. *"The Z panes are flat"* against an
     * absolute threshold tests something weaker; *"flat RELATIVE to a pane drawn at the same extent"* is the
     * property `OverlayScore.extent` exists to provide. Measured at the shipped 96 px slot pane: XY 0.896, XZ
     * 0.000, YZ 0.000 — the Z panes are exactly flat, so the 0.5 factor is a wide margin around zero.
     */
    for (const [name, m] of [['X / Z', xz], ['Y / Z', yz]] as const) {
      expect(m.ink, `CALIBRATION: the Structure \`${name}\` pane has NO ink at all above the curve threshold. `
        + 'That is not the state this step measures — a flat pane still draws a LINE (measured 53 and 87 px), and '
        + 'zero ink would make "it is flatter" vacuously true.').toBeGreaterThan(0);
      expect(m.vertical, `step 22a: the Structure \`${name}\` pane reaches ${m.vertical.toFixed(3)} of its box `
        + `vertically against \`X / Y\`'s ${xy.vertical.toFixed(3)} — i.e. it is NOT flatter. The Z axis is `
        + 'silent, so at one shared extent these two panes must draw flat or nearly flat. ⚠️ If all three look '
        + 'alike the panes are being fitted INDIVIDUALLY, and every depth-only wave in the library is being '
        + 'misrepresented — `drawOverlayScore` takes the extent as a PARAMETER precisely so it can be shared; do '
        + 'not "improve" it by fitting each pane to its own contents.').toBeLessThan(xy.vertical * 0.5);
    }

    /*
     * ⚠️ **AND THE FLAT CAPTION IS *CORRECTLY ABSENT* HERE, WHICH IS THE MEASUREMENT THAT SPLIT THIS TEST FROM
     * THE NEXT ONE.** My first draft asserted `paneIsFlat()` on these two panes and it would have FAILED on
     * correct behaviour: the caption is keyed on `paneExtent(curves) > 0`, the max over BOTH of a pane's axes,
     * and Structure's XZ/YZ panes reach 15 and 25 model units in X and Y. **A pane can be visually flat and
     * correctly say nothing** — flatness in the PICTURE and emptiness in the PLANE are two quantities, which is
     * invariant 29's shape one level down. The caption's own subject is the next test.
     */
    expect(await composer.paneIsFlat('Structure', 'X / Z'), 'step 22a: the Structure `X / Z` pane shows the flat '
      + `CAPTION (\`${FLAT_PANE_CAPTION}\`). ⚠️ Read the direction: the caption means "no reach in this plane at `
      + 'all", and this pane reaches 15 model units in X — it is flat in the PICTURE because the extent is '
      + 'shared, which is the feature. A caption here would describe a different fact from the one that is true, '
      + 'and it would appear on nearly every planar row in the library.').toBe(false);
  });

  /* ═══ E111 · the flat caption's own subject ══════════════════════════════════════════════════════
   * ⚠️ **THIS IS THE OTHER HALF OF WHAT MY FIRST DRAFT CONFLATED WITH 22a, AND IT NEEDED A DIFFERENT PRESET.** The
   * caption fires iff `!score.silent && !(paneExtent(pane) > 0)` — the figure is live but this PLANE is empty.
   * Measured over the union: `Fluid Metall`'s `Y / Z` pane is one (figure extent 50, `paneExtent` exactly 0), on
   * both the combined row and the Body row.
   */
  test('E111 — Fluid Metall has a live figure and an empty Y / Z plane, so that pane alone shows the flat caption',
    async ({ composer }) => {
      test.slow();
      await composer.bootWithHook();
      await composer.loadPreset('Fluid Metall');
      await composer.openComposer();
      await composer.assertFlatCaptionsExist();

      /*
       * ⚠️ **`display: none` IS THE MECHANISM, SO THE QUESTION IS VISIBILITY AND NEVER COUNT.** `CLAUDE.md`
       * records this for the two notices and it holds identically here: the caption element is ALWAYS in the DOM,
       * one per pane, so `count()` is green on every preset in the library. `assertFlatCaptionsExist()` above
       * asserts the corpus — one caption per pane — and `paneIsFlat()` reads `isVisible()`.
       */
      expect(await composer.paneIsFlat('Combined figure', 'Y / Z'), 'E111: Fluid Metall\'s combined `Y / Z` pane '
        + 'has NO reach at all (measured `paneExtent` exactly 0 against a figure extent of 50) and shows no '
        + `\`${FLAT_PANE_CAPTION}\` caption. ⚠️ Until E111 that pane drew two faint axes on an empty box — the `
        + 'diagram being exactly honest and reading as broken. `drawOverlayScore` returns early on '
        + '`!(extent > 0)` and its own comment delegates this copy to the caller, so before the element existed '
        + 'the delegation had no recipient.').toBe(true);

      for (const plane of ['X / Y', 'X / Z'] as const) {
        expect(await composer.paneIsFlat('Combined figure', plane), `E111: the \`${plane}\` pane also shows the `
          + 'flat caption, so it is not keyed on the PANE. Fluid Metall reaches 50 model units in this plane. ⚠️ A '
          + 'caption on every pane is the shape 16.20\'s post-mortem names: `OverlayScore.silent` is figure-wide '
          + 'and `paneExtent` is per-pane, and using the figure-wide one here would light all three.').toBe(false);
      }

      /*
       * ⚠️ **AND THE CAPTION MUST NOT NAME AN AXIS OR A CAUSE — MEASUREMENT NARROWED THE STRING AND `CLAUDE.md`
       * RECORDS THE REJECTED WORDING BY NAME.** `no Z size` would be confidently wrong on a reachable case: a
       * zero WINDING flattens a pane whose two sizes are large and real, and this preset is that case (its
       * `maxWinding` is 1). Invariant 29's real defect is a READOUT: **say the axis is silent, do not grant it a
       * size.**
       */
      const cap = composer.paneFlatCaption('Combined figure', 'Y / Z');
      expect(((await cap.textContent()) ?? '').trim(), 'E111: the flat caption does not read exactly '
        + `\`${FLAT_PANE_CAPTION}\`. The wording is load-bearing: it must name the PLANE, never an axis or a `
        + 'cause.').toBe(FLAT_PANE_CAPTION);
    });

  /* ═══ §A5 · step 22b — cyan differs in SIZE, amber in SHAPE ══════════════════════════════════════
   * ⚠️ **THE ARITHMETIC HALF ONLY. THE VERDICT — "can a reader tell WHICH IS WHICH" — IS THE OWNER'S**, one of the
   * ~12 `TESTPLAN` reserves for a human. This test measures that the two extreme curves differ from white in the
   * two DIFFERENT ways the design claims; it cannot measure whether that answers the owner's *"isn't wobble the
   * same as winding breathes?"*
   */
  test('step 22b — on Storm\'s Body the cyan curve differs from white in SIZE and the amber curve in SHAPE at a '
    + 'comparable size', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();

    /*
     * ⚠️ **`Storm`, NOT THE PLAN'S `Aliens DNA` AND NOT MY FIRST DRAFT'S `Argus`, AND THE SUBJECT WAS *SEARCHED*
     * RATHER THAN CHOSEN.** 22b needs ONE row whose ONE pane draws all three curves at legible sizes, so that the
     * comparison has a single subject. Measured over the whole union at the shipped 96 px slot pane, 24
     * (row, plane) pairs qualify and **neither earlier candidate is among them**:
     *   - **Aliens DNA Body**: its `size` and `winding` curves raster to 0–1 px in every plane. They are non-null
     *     Float32Arrays of a degenerate path, so a `!== null` check would have called this row covered.
     *   - **Argus Body**: it pulses in Z ONLY (`Pulse` 0/0/100) and wobbles in X/Y ONLY (`Wobble` 64/65/0), so no
     *     single plane carries both and both extreme curves raster to ≤ 1 px everywhere. A per-figure reading of
     *     "it pulses and it wobbles" is true and useless — the curves are drawn PER PLANE.
     * **Storm Body `X / Y` measures white 288 px at vertical spread 0.875, cyan 88 px at 0.083, amber 222 px at
     * 0.854** — precisely the pair of claims: cyan a different SIZE, amber a different SHAPE at nearly the same
     * size. Storm is legacy and not replaced (`Storm new` is a separate name), so this loads the figure those
     * numbers were measured on.
     */
    await composer.loadPreset('Storm');
    await composer.openComposer();

    const pulse = await composer.axisTriple('Body', 'Pulse');
    const wobble = await composer.axisTriple('Body', 'Wobble');
    expect(pulse[0] !== 0 || pulse[1] !== 0, `CALIBRATION: Storm's Body does not pulse in X or Y `
      + `(${JSON.stringify(pulse)}), so the \`X / Y\` pane draws no cyan curve and the size half of this step has `
      + 'no subject. ⚠️ The clause is per-PLANE, not per-figure: a pulse that lives only in Z is invisible here, '
      + 'which is exactly why `Argus` was rejected as the subject.').toBe(true);
    expect(wobble[0] !== 0 || wobble[1] !== 0 || wobble[2] !== 0, `CALIBRATION: Storm's Body does not wobble `
      + `(${JSON.stringify(wobble)}), so no amber curve is drawn and the shape half has no subject.`).toBe(true);

    const k = await composer.paneInk('Body', 'X / Y');
    expect(k.white, 'CALIBRATION: the Body `X / Y` pane has no white ink, so both halves below would compare '
      + 'against nothing.').toBeGreaterThan(0);
    expect(k.cyan, 'step 22b: the row pulses and NO cyan curve is drawn. Cyan is the size extreme, the curve that '
      + 'answers "how much does this breathe" — without it the diagram shows one instant of a moving figure and '
      + 'says nothing about its range.').toBeGreaterThan(0);
    expect(k.amber, 'step 22b: the row wobbles and NO amber curve is drawn. Amber is the winding extreme. ⚠️ Its '
      + 'absence makes the owner\'s question unanswerable: `Wobble` is in CYCLES, the same unit as `Winding`, and '
      + 'the amber curve is the only place that difference becomes visible.').toBeGreaterThan(0);

    /*
     * ⚠️ **THE TWO HALVES MUST BE DIFFERENT QUANTITIES OR THE STEP COLLAPSES INTO "THREE CURVES EXIST", WHICH THE
     * INK CLAUSES ABOVE ALREADY SAY.** 22b's claim is that cyan differs in SIZE (a differently-scaled path) and
     * amber in SHAPE (a different path at a comparable reach). So the size half is a SPREAD difference and the
     * shape half is spread SIMILARITY plus an ink difference. A single clause over both is satisfied by either
     * curve alone.
     *
     * The per-hue spread uses the same classifier `paneInk` does, masked to one hue at a time. It lives here
     * rather than on `ComposerPage` because 22b is its only consumer, and a third pixel helper on the fixture
     * would be a surface nothing else reads.
     *
     * ⚠️ **THE HUE SPLIT IS IMPORTED, NOT RESTATED, AND THAT WAS A REAL DEFECT HERE: this loop carried its own
     * hand-written `24` and was the SECOND live copy of the value that failed step 20 and seed 3.** Fixing
     * `paneInk` alone would have left the same mis-bucketing in a step reading the same pixels of the same pane —
     * `CLAUDE.md`: *"Correct once per QUANTITY, not per file."* The threshold's derivation and the measurement
     * against it belong to `HUE_SPLIT`; do not copy either back here.
     */
    const spreadOf = async (want: 'amber' | 'cyan' | 'white'): Promise<number> => {
      const canvas = composer.pane('Body', 'X / Y').locator(SEL.paneCanvas);
      return canvas.evaluate((el, { hue, split }) => {
        const c = el as HTMLCanvasElement;
        const ctx = c.getContext('2d');
        if (!ctx || c.width === 0) return -1;
        const { width: w, height: h } = c;
        const d = ctx.getImageData(0, 0, w, h).data;
        let minY = h, maxY = -1, n = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            // ⚠️ 64, as in `paneSpread`: the crosshair is alpha 0.10 and spans the whole box, so a lower
            // threshold would report every hue as reaching the full height and both clauses would be unfailable.
            if (d[i + 3]! < 64) continue;
            const r = d[i]!, b = d[i + 2]!;
            const got = r - b > split ? 'amber' : b - r > split ? 'cyan' : 'white';
            if (got !== hue) continue;
            n++;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        return n === 0 ? 0 : (maxY - minY) / h;
      }, { hue: want, split: HUE_SPLIT });
    };

    const sWhite = await spreadOf('white');
    const sCyan = await spreadOf('cyan');
    const sAmber = await spreadOf('amber');
    expect(sWhite, 'CALIBRATION: the white curve has no measurable vertical spread, so neither comparison below '
      + 'has a reference. Measured 0.875 of the box.').toBeGreaterThan(0.3);

    // The SIZE half. Measured white 0.875 against cyan 0.083 — a gap of 0.79, so 0.15 is a wide margin.
    expect(Math.abs(sCyan - sWhite), `step 22b: the cyan curve's vertical reach (${sCyan.toFixed(3)}) is `
      + `indistinguishable from white's (${sWhite.toFixed(3)}). Cyan is the SIZE extreme — it must be a visibly `
      + 'different SIZE, not a different shape at the same size. If they coincide, either the extreme search '
      + 'found the same instant as `now`, or both curves are drawn from the same data — and check the second '
      + 'first, because that is how `mix(x, release, vecN(bvecN))` failed: a guard inert for its entire '
      + 'existence.').toBeGreaterThan(0.15);

    // The SHAPE half — a comparable reach, a different path. Measured amber 0.854 against white 0.875.
    expect(Math.abs(sAmber - sWhite), `step 22b: the amber curve's vertical reach (${sAmber.toFixed(3)}) is far `
      + `from white's (${sWhite.toFixed(3)}). Amber must differ in SHAPE at a COMPARABLE size — a wobble `
      + 'redistributes where the curve goes without changing how far it reaches, which is exactly what '
      + 'distinguishes it from a pulse. ⚠️ If amber reads as a different SIZE instead, the two extremes are being '
      + 'searched on the same quantity and the legend\'s two words name one fact.').toBeLessThan(0.2);
    expect(Math.abs(k.amber - k.white) / k.white, `step 22b: amber and white carry near-identical ink `
      + `(${k.amber} vs ${k.white}) at near-identical reach, so the amber curve may be drawn ON TOP of the white `
      + 'one — the retired ghost\'s exact defect, a second path announcing a range that does not exist. ⚠️ Ink is '
      + 'the right discriminator for the SHAPE half because two paths of the same reach can only differ in '
      + 'LENGTH. Measured 222 against 288, a 23 % difference.').toBeGreaterThan(0.05);
  });

  /* ═══ §A5 · the pane half of step 33a, deferred here BY NAME from spec 06 ════════════════════════
   * ⚠️ **SPEC 06 OWNS THE DOM HALF ("the edit is Z-only") AND SAYS SO IN ITS OWN COMMENT; THIS IS THE OTHER HALF.**
   * `CLAUDE.md`'s invariant 29: *"AN ORACLE FOR A THREE-AXIS SUBJECT MUST READ ALL THREE PLANES"* — and this step
   * is what that rule was written for, having already cost three wrong findings in one sitting.
   */
  test('step 33a (pane half) — a Z-only ratio pick leaves the Body X / Y pane byte-identical and moves both Z '
    + 'panes', async ({ composer }) => {
    test.slow();
    await composer.bootWithHook();
    await composer.loadPreset('Aliens DNA');
    await composer.openComposer();

    /*
     * ⚠️ **THE ROW IS `Body`, WHOSE WINDING TRIPLE IS `5 / 5 / 0` — SO AT BASE `gcd(5,5) = 5` THE PICK WRITES
     * `5 / 5 / 5` AND MOVES Z ALONE.** The plan quotes this row as *"reach 15 / 25 / 64"*, which is its AMPLITUDE
     * triple: the reason the pick is VISIBLE here (Z carries amplitude) rather than the reason it is Z-only.
     * Reading one for the other cost spec 06's 33b clause its correctness. Simulated through the shipped model —
     * `readFigure` → `ratioBase` = 5 → `applyRatio([1,1,1])` → `writeFigure` — the windings become `5 / 5 / 5`.
     */
    const wBefore = await composer.axisTriple('Body', 'Winding');
    expect(wBefore[0], 'CALIBRATION: Aliens DNA\'s Body X and Y windings are not equal, so `1 : 1 : 1` would not '
      + 'be idempotent in X and Y and this step\'s "the X/Y pane is still" claim would be wrong for a preset '
      + 'reason rather than an engine one.').toBe(wBefore[1]);
    expect(wBefore[2], 'CALIBRATION: the Body Z winding already equals X and Y, so `1 : 1 : 1` is a complete '
      + 'no-op on this row and no pane could move.').not.toBe(wBefore[0]);

    const before = new Map<string, Awaited<ReturnType<typeof composer.paneInk>>>();
    for (const plane of PLANE_CAPTIONS) before.set(plane, await composer.paneInk('Body', plane));
    expect(before.get('X / Y')!.total, 'CALIBRATION: the Body `X / Y` pane has no ink, so "it did not change" '
      + 'would be comparing two empty readings — which are EQUAL.').toBeGreaterThan(0);

    await composer.pickRatio('Body', '1 : 1 : 1');
    await composer.page.waitForTimeout(500);

    const sig = (k: { amber: number; cyan: number; white: number }) => `${k.amber}/${k.cyan}/${k.white}`;

    /*
     * ⚠️ **THE `X / Y` PANE'S STILLNESS IS THE CORRECT BEHAVIOUR AND THE POINT OF THE STEP: AN XY-ONLY ORACLE
     * MEASURED THIS VERY CONTROL AS DEAD AND PRODUCED A WRONG FINDING**, which the plan records. Asserted as
     * EQUALITY rather than a tolerance, because it was measured that way: the figure-wide extent is unchanged
     * (61.8192 both sides — Z's AMPLITUDE sets it and the pick moves only Z's WINDING), so the XY rasterisation
     * is identical (`0/1/88` before and after at the shipped 96 px pane).
     */
    const xyAfter = await composer.paneInk('Body', 'X / Y');
    expect(sig(xyAfter), `step 33a: the \`X / Y\` pane CHANGED (${sig(before.get('X / Y')!)} → ${sig(xyAfter)}) `
      + 'on a pick that writes Z alone. ⚠️ Read the direction of this failure before believing it: if spec 06\'s '
      + 'DOM half shows the X and Y windings unmoved, then the pane moved without its data moving — the pane is '
      + 'not drawing the plane it is captioned with.').toBe(sig(before.get('X / Y')!));

    for (const plane of ['X / Z', 'Y / Z'] as const) {
      const after = await composer.paneInk('Body', plane);
      expect(sig(after), `step 33a: the \`${plane}\` pane is UNCHANGED (${sig(before.get(plane)!)}) after a pick `
        + 'that writes a new Z winding. This is the half an XY-only oracle cannot see, and its failure means the '
        + 'Z panes are not reading Z — `evaluateAt3` is the owner, and a one-plane oracle here would be invariant '
        + '29 reproduced inside the harness. Measured: XZ `0/0/405` → `0/0/562`, YZ `0/1/499` → `0/0/700`.')
        .not.toBe(sig(before.get(plane)!));
    }
  });
});
