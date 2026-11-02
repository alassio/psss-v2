import { test, expect, SEL, ComposerPage } from './composer-fixture.ts';
import type { Locator } from '@playwright/test';

/*
 * ============================================================================================
 * v8 21.12 §L — the Transmap tab in a real browser.
 * ============================================================================================
 *
 * ⚠️ **THIS FILE IS THE ONLY INSTRUMENT THAT SEES THE TAB AT ALL.** `fieldcheck` §G and `trackcheck` §M are
 * TEXT scans of `transmap.ts`, `field-measure.ts` and `static-field.ts`: they can prove a constant is shared, a
 * grid is reachable and a sentence is worded from the right owner, and they cannot prove the row exists, is
 * visible, is enabled, or moves anything. `CLAUDE.md`: *"A DOM scan is the one instrument a text scan cannot
 * be."*
 *
 * ⚠️ **AND THE PHASE'S OWN MEASUREMENTS MADE IT NECESSARY RATHER THAN NICE.** The tab exists because two
 * presets whose warps measure 3.2 px and 2074 px presented IDENTICAL panel state — i.e. because *the panel's
 * OUTPUT CHANNEL could not show a difference that was really there*. A text scan cannot fail that way round
 * either: it reads the code that computes the sentence, never the sentence. So every clause below reads a
 * STRING OR A FLAG OFF THE PAGE, and the two edit clauses require a number to MOVE.
 *
 * ⚠️ **THE FIXTURES ARE NAMED PRESETS AND EACH ONE IS A REGIME, NOT AN EXAMPLE.** They were chosen by
 * enumerating the composed library (`loadLibrary` over `public/psss_presets.json`, resolved through
 * `chainFromOverlay` — *"import the module, do not read the JSON"*), so each name below is the answer to a
 * question about coverage rather than a preset someone liked:
 *
 *   - `Intro System`        style 0, table regime, identifiable as `Interference` at Detail 1 — the main subject
 *   - `Barrock`             table regime, 8 live terms, identifiable as NOTHING — the other identification branch
 *   - `Shift Lattice Drift` archetype regime (`Interference`, Strength 0.85) — Detail live, terms SOLVED
 *                           (they were "inert" until 2026-09-22; that test's own header records the reversal)
 *   - `Anima Electrica`     style 3 + table regime — the §J greying, one of 23 such presets
 *   - `Lost In Another Sky` identifies at Detail 0.125, BELOW the track — 1 of exactly 3 out-of-range presets
 *   - `Alpha Particles`     separable but TransMap off — 1 of 92; the editor stays live, the engine does not
 *   - `Argus`              resolves to style 7 only — no separable layer at all
 *
 * ⚠️ **A NAME IS A PRIMARY KEY IN FIVE OWNERS, so a rename breaks this file loudly** (`loadPreset` asserts the
 * tile exists) — which is the honest failure. **Do not "fix" it by loosening the selector**: the regime is the
 * subject, so a substitute preset has to be re-measured, not guessed.
 *
 * ⚠️ **`[data-tab="transmap"]` MATCHES NOTHING UNTIL THE TAB HAS BEEN OPENED ONCE** — `TabRegistry` builds a
 * tab's container on first show. Every clause here goes through `openTransmap()`, which opens the tab and then
 * waits for its own content, so a tab that is in the bar but never registered fails as "no pane" rather than as
 * a wrong reading over an empty locator.
 *
 * ⚠️ **NO `data-testid`, EVER.** Every handle below is an `aria-label`, a shipped class or a visible label.
 *
 * ----------------------------------------------------------------------------------------------------------
 * **THE SEED RUN — 2026-09-22, six on-disk defects, and the RATIO is the finding.** *"A spec without a seed
 * discharges nothing."* Each was applied to `src/`, run against one test, and reverted with a `diff -q` byte
 * check. **Five were caught by the clause that names them. The sixth was not, and that is what the last test
 * in this file is for.**
 *
 *   1. `commitTables()` stops calling `sync()`     → CAUGHT: "the measured peak did not move"
 *   2. the table word dropped from the term labels → CAUGHT: 24 duplicated `aria-label`s, listed
 *   3. `Zoom Bias` never disabled                  → CAUGHT: `toBeDisabled()` on the §J gate
 *   4. the `Detail` row left visible on terms      → CAUGHT: `toBeHidden()` in the table regime
 *   5. the out-of-range warning made unreachable   → CAUGHT: "names a Detail the slider cannot reach"
 *   6. `commitTables()` stops writing the preset   → **NOT CAUGHT** on the tile route; caught only after the
 *                                                     startup-route test was added. See its own header.
 *
 * ⚠️ **SEED 2 WAS NOT A SEED WHEN IT STARTED — IT WAS THE SHIPPED CODE, AND THE FIRST RUN OF THIS FILE FOUND
 * IT.** `buildTermsSection` is called twice, so `Amplitude of term 1 WaveX` named an input in the shift half
 * AND one in the zoom half: two controls writing to two different tables under one accessible name. No checker
 * in `checks/` can see an `aria-label`, `tsc` cannot, and both functions read correctly on their own. It is now
 * fixed in `termRow`, re-seeded, and pinned by the uniqueness clause.
 *
 * ⚠️ **SEED 6 IS THE ONE WORTH READING TWICE.** It was a REAL defect in a REAL field, `verify`-green, and the
 * export clause written to catch exactly it stayed green — because the route the test took made the two writes
 * one write. **A seed that is not caught is a statement about the ROUTE, not about the clause**; the fix was a
 * second test on the other route, not a stronger assertion on this one.
 */

/** The tab's own container. ⚠️ `SEL.tabContent` is NOT a scope — see `SEL.tabPane`. */
const PANE = SEL.tabPane('transmap');

/** The three readouts, by their shipped classes. */
const READOUT = `${PANE} .sl-transmap-readout`;
const IDENT = `${PANE} .sl-transmap-ident`;
const PANE_SUM = `${PANE} .sl-transmap-pane-sum`;
const TERM_ROW = `${PANE} .sl-transmap-term`;

/**
 * `4 slots × 2 axes × 2 tables`. **Sixteen, always, and the count is the MODEL's**: `MAX_SIN_MAGIC` is 4, so a
 * variable count would make an empty slot indistinguishable from a missing one.
 */
const TERM_ROWS_TOTAL = 16;

/** Eight of them are the shift half, which is all a non-style-3 layer has. */
const TERM_ROWS_SHIFT = 8;

/**
 * Load a preset, then open the Transmap tab on it.
 *
 * ⚠️ **THE ORDER IS THE USER'S ORDER AND IT IS LOAD-THEN-OPEN, NOT THE REVERSE.** `loadPreset` clicks a TILE,
 * which means going through the grid — and the Lab and the grid are mutually exclusive views of one panel, so
 * the Lab is closed by the time the tile is clicked. Opening the tab afterwards therefore exercises
 * `activate()`'s re-read (`readTables()` + `sync()`), which is the path a user takes. Opening the tab FIRST and
 * loading underneath it would exercise `onExternalChange` instead — a different code path, and not the one any
 * clause below claims to be about.
 */
async function openTransmap(composer: ComposerPage, preset: string): Promise<void> {
  await composer.loadPreset(preset);
  await composer.openTab('transmap');
  await expect(composer.page.locator(PANE), `the Transmap tab button was clicked but its pane never appeared. `
    + '⚠️ **The button existing is NOT evidence the tab mounted** — `CLAUDE.md`: *"the bar can show more tabs '
    + 'than the registry holds"*, because Visual FX, Materials, the Composer and this tab all register inside '
    + '`if (this.config.visualFxControls)`. Those two causes have completely different fixes.').toBeVisible();
}

/** The `Measured: …` line, as the user reads it. */
async function readout(composer: ComposerPage): Promise<string> {
  return ((await composer.page.locator(READOUT).textContent()) ?? '').trim();
}

/**
 * The peak in px, parsed out of the readout.
 *
 * ⚠️ **PARSED FROM THE SENTENCE RATHER THAN MEASURED A SECOND TIME, AND THAT IS THE POINT.** A spec that
 * re-derived the field would be asserting its own arithmetic agrees with the engine's — which `fieldcheck` §A
 * already owns, exactly, and this file could only do approximately. What is untested without this is whether
 * the number reaches the SCREEN, so the screen is where it is read from.
 */
function peakOf(text: string): number {
  const m = /peak ([\d.]+) px/.exec(text);
  expect(m, `no "peak N px" in the readout ${JSON.stringify(text)}. ⚠️ **Three DIFFERENT sentences report a `
    + '0 px field** (an all-zero table, a live term at frequency 0, and an archetype at Strength 0) and none of '
    + 'them carries a peak. A fixture that fell into one of those would make every comparison below read 0 '
    + 'against 0 — equal, and green.').not.toBeNull();
  return Number(m![1]);
}

/** One slider by its shipped `aria-label` — `Strength`, `Detail`, `Drift`, `Zoom Bias`, `Centre X`. */
function slider(composer: ComposerPage, label: string): Locator {
  return composer.page.locator(`${PANE} input.sl-vfx-slider[aria-label="${label}"]`);
}

/** One `<select>` by the row label a user reads — `Style`, `Pattern`, `Zoom Pattern`. */
function select(composer: ComposerPage, label: string): Locator {
  return composer.page.locator(`${PANE} .sl-vfx-row:has(.sl-vfx-label:text-is("${label}")) select`);
}

test.describe('v8 21.12 §L — the Transmap tab', () => {
  test('CALIBRATION: the pane does not exist until the tab is opened, and then it does', async ({ composer }) => {
    /*
     * ⚠️ **THIS IS THE ONE CLAUSE IN THE FILE THAT IS ABOUT THE INSTRUMENT, AND IT IS FIRST BECAUSE EVERY OTHER
     * CLAUSE RESTS ON IT.** If `TabRegistry`'s lazy build ever became an eager one, the "not yet" half would go
     * red and nothing would be broken; if the pane stopped being built at all, every clause below would read an
     * empty locator, and `toBeVisible()` fails on those — but a `count()`-based spec would not. Both halves are
     * asserted so the file states which regime it is running in rather than assuming one.
     */
    await composer.openLab();
    await expect(composer.page.locator(PANE), 'the Transmap pane exists before the tab was ever opened. Not a '
      + 'defect in itself — but this file\'s "open it first" discipline was written for the lazy build, and if '
      + 'the build became eager the reason for that discipline should be re-read, not silently inherited.')
      .toHaveCount(0);

    await composer.openTab('transmap');
    await expect(composer.page.locator(PANE)).toBeVisible();

    // The tab bar's own label, which is `Transmap` while the `TabId` is `transmap` — the two spellings differ
    // by design across this panel (`randomiser`, `visual-fx`), and asserting the label is what catches a
    // `TAB_DEFS` entry that lost its text.
    await expect(composer.page.locator(SEL.tabBtn('transmap'))).toHaveText('Transmap');
  });

  test('the table regime reads: sixteen term rows, eight visible, a measured peak and an identification', async ({ composer }) => {
    await openTransmap(composer, 'Intro System');

    /*
     * ⚠️ **COUNT ALL SIXTEEN, ASSERT EIGHT VISIBLE — the two numbers are different claims.** The zoom half is
     * hidden by `display` on a non-style-3 layer, and *"`display: none` stops a tab being SEEN, not WORKING"*:
     * those eight rows are live inputs bound to `sinMagicParams2`. A spec that counted only the visible rows
     * would pass equally if the zoom section had been deleted.
     */
    await expect(composer.page.locator(TERM_ROW)).toHaveCount(TERM_ROWS_TOTAL);
    await expect(composer.page.locator(`${TERM_ROW}:visible`)).toHaveCount(TERM_ROWS_SHIFT);

    // Four pane summaries (two axes × two tables), two of them visible for the same reason.
    await expect(composer.page.locator(PANE_SUM)).toHaveCount(4);

    /*
     * ⚠️ **EVERY ACCESSIBLE NAME IN THE TERM ROWS IS DISTINCT — AND THIS CLAUSE EXISTS BECAUSE IT WAS NOT.**
     * `buildTermsSection` runs twice, so before the fix `Amplitude of term 1 WaveX` named TWO inputs writing to
     * two different tables. `tipcheck` polices `title` attributes and cannot see an `aria-label` at all, and the
     * duplicate was invisible to `tsc`, to every checker, and to a reader of either function on its own: the
     * label is correct in `termRow` and only the CALL SITE makes it ambiguous.
     *
     * ⚠️ **IT IS ASSERTED AS A SET, NOT AS A LIST OF EXPECTED STRINGS.** A hardcoded list would have to be
     * rewritten for any rewording and would then be a second enumeration of the labels; uniqueness is the
     * property that actually matters, and it is the property the suite's *"select on the `aria-label`, never on
     * position"* rule depends on being true.
     */
    const labels = await composer.page.locator(`${TERM_ROW} [aria-label]`).evaluateAll(
      els => els.map(e => e.getAttribute('aria-label') ?? ''));
    expect(labels.length, 'CALIBRATION: no labelled controls inside the term rows, so the uniqueness claim '
      + 'below would pass over an empty set.').toBe(TERM_ROWS_TOTAL * 3);
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dupes, `duplicated aria-labels in the term rows: ${JSON.stringify([...new Set(dupes)])}. Two controls `
      + 'writing to two different tables under one name — the shift half is `sinMagicParams`, the zoom half '
      + '`sinMagicParams2`.').toEqual([]);

    /*
     * ⚠️ **`Detail` IS HIDDEN HERE AND `Strength` IS NOT, and this is the clause that would catch the row being
     * left visible-but-inert** — a control that moves nothing is invariant 13, and the engine deliberately does
     * not apply `detail` to an authored table.
     */
    await expect(slider(composer, 'Strength')).toBeVisible();
    await expect(slider(composer, 'Detail')).toBeHidden();
    await expect(slider(composer, 'Drift')).toBeVisible();

    // `Intro System` is `[[6,0,0,0],[-1,…]]` on both axes: one live term per direction, amplitude 6 at
    // frequency -1. The summary is `harmonics()`'s own words, the same function the readout uses.
    await expect(composer.page.locator(PANE_SUM).first()).toHaveText('6@-1');

    const text = await readout(composer);
    expect(text, `the readout does not name the terms as the source: ${JSON.stringify(text)}. On the table `
      + 'regime the field comes from `sinMagicParams`, and the phrase is what tells a user that picking a '
      + 'pattern would REPLACE what they are looking at.').toContain('from the terms below');
    expect(peakOf(text), 'a preset with a live term at a nonzero frequency measured 0 px').toBeGreaterThan(0);
    expect(text, 'the readout does not state the frame it measured at. The peak is in PIXELS and every figure '
      + 'divides by `min(w, h)`, so the size is part of the measurement, not decoration.').toMatch(/at \d+×\d+/);

    /*
     * ⚠️ **THE IDENTIFICATION LINE IS 21.12 §D's WHOLE DELIVERABLE AND ITS THREE WORDINGS ARE ONE OWNER.** Here
     * it must name the archetype AND answer the Strength question — a line that named the pattern and stopped
     * would read as *"switch to this and you are done"* for the half of the identifiable library that needs
     * more than Strength 1.
     */
    const ident = ((await composer.page.locator(IDENT).textContent()) ?? '').trim();
    expect(ident, `the identification line does not name the archetype: ${JSON.stringify(ident)}`)
      .toContain('These terms are “Interference”');
    expect(ident, 'the identification line names a pattern without answering what Strength it would need — '
      + 'which is the reading 21.13 was answered "both" to prevent.').toContain('Strength');
    expect(ident, '`Detail` is quoted so the user can reproduce the shape, not only its name.')
      .toContain('Detail 1');
    expect(ident, 'a Detail of 1 is inside the track, so the out-of-range warning must NOT appear here. ⚠️ This '
      + 'is the false-positive half of that clause: without it, a warning that fired unconditionally would '
      + 'still satisfy the `Lost In Another Sky` test below.').not.toContain('only reaches');
  });

  test('an unidentifiable table says so, and does not invent a pattern', async ({ composer }) => {
    /*
     * ⚠️ **THE OTHER BRANCH, AND IT IS NOT SYMMETRIC WITH THE FIRST.** `Barrock`'s eight live terms
     * (`[[1,2,3,4],[8,7,6,5]]` on both axes) match no archetype, and the honest answer is that the field exists
     * only as numbers. A readout that fell back to the nearest archetype would be green on the test above and
     * would be telling a user they could reach this field from the dropdown, which they cannot.
     */
    await openTransmap(composer, 'Barrock');
    const ident = ((await composer.page.locator(IDENT).textContent()) ?? '').trim();
    expect(ident, `expected the "no pattern" wording, got ${JSON.stringify(ident)}`)
      .toContain('No pattern reproduces these terms');
    expect(ident, 'the line must say that picking a pattern REPLACES the field rather than refining it — the '
      + 'dropdown looks like a refinement and is not.').toContain('not refine it');
    await expect(composer.page.locator(`${TERM_ROW}:visible input[type="number"]`)).toHaveCount(TERM_ROWS_SHIFT * 2);
  });

  test('editing one amplitude MOVES the measured peak, the pane summary and the export', async ({ composer }) => {
    /*
     * ⚠️ **THIS IS THE CLAUSE THE WHOLE TAB EXISTS FOR, AND IT IS THREE OBSERVATIONS RATHER THAN ONE.** A term
     * edit has to reach (1) the measurement the panel prints, (2) the per-pane summary, and (3) `workingPreset`,
     * which is what Export, Snapshot and the Mixer read. `commitTables()` writes the preset AND the engine, and
     * *"writing one is invariant 13 in one direction or the other"*: preset-only means every row is inert until
     * the next apply, engine-only means every edit vanishes on Export. **Only the third observation can tell
     * those apart**, which is why the export is read here and not in a test of its own.
     */
    await openTransmap(composer, 'Intro System');

    const before = await readout(composer);
    const peakBefore = peakOf(before);
    const exportBefore = ComposerPage.normalisePresetJSON(await composer.exportPresetText());

    const amp = composer.page.locator(`${PANE} input[aria-label="Amplitude of term 1 WaveX"]`);
    await expect(amp, 'no amplitude field for the first WaveX term. The label is built from the slot INDEX and '
      + 'the axis WORD (`WaveX`/`WaveY`, renamed from `across`/`down` on 2026-09-22), never from a position '
      + 'in the row.').toHaveCount(1);
    await expect(amp).toHaveValue('6');

    /*
     * ⚠️ **`fill()` ALONE COMMITS NOTHING: THE HANDLER IS `change`, NOT `input`** — deliberately, because an
     * `input` listener would commit `2`, then `24` while the user typed. So this blurs, and a spec that only
     * filled would assert against a table that never changed. **"Nothing changed" cannot be told from a dead
     * handler**, which is this suite's most-recorded failure shape.
     *
     * ⚠️ **AND THE NEW VALUE IS 4× THE OLD ONE RATHER THAN A NUDGE.** The peak is printed to one decimal below
     * 10 px, so a small edit could round to the same string and the comparison would read "no change" over a
     * field that had changed. The factor is chosen against the READOUT's precision, not against the slider's.
     */
    await amp.fill('24');
    await amp.press('Tab');
    await composer.page.waitForTimeout(300);

    const after = await readout(composer);
    expect(peakOf(after), `the measured peak did not move: ${JSON.stringify(before)} → ${JSON.stringify(after)}. `
      + 'Either the term never reached `resolveStaticWaves`, or `refreshDerived()` was not called — and the '
      + 'second of those leaves a CORRECT field behind a stale sentence, which is the defect the tab was '
      + 'built to end.').toBeGreaterThan(peakBefore * 2);

    await expect(composer.page.locator(PANE_SUM).first(), 'the pane summary still reads the old amplitude. It '
      + 'and the readout are written by ONE function (`harmonics`), so a disagreement between them means a '
      + 'second copy appeared.').toHaveText('24@-1');

    // The row stays TICKED: both numbers are nonzero, which is the engine's own liveness predicate.
    await expect(composer.page.locator(`${PANE} input[aria-label="Use term 1 WaveX"]`)).toBeChecked();

    /*
     * ⚠️ **THE EXPORT CLAUSE IS WHAT MAKES THE BYTE-IDENTICAL CLAUSE IN THE NEXT TEST NON-VACUOUS.** Two
     * exports of an unchanged preset compare equal for the right reason only if this comparator can be shown to
     * see a real difference at all — the same rule the fixture's own comparator was rewritten under after a
     * version of it compared two near-empty objects as EQUAL.
     */
    const exportAfter = ComposerPage.normalisePresetJSON(await composer.exportPresetText());
    expect(exportAfter, 'the amplitude edit did not reach the export. `sinMagicParams` is PRESET data with no '
      + 'overlay counterpart, so the preset write cannot be skipped the way a chain edit\'s can.')
      .not.toBe(exportBefore);
    const parsed = JSON.parse(exportAfter) as {
      postProcessors?: { transMap?: { sinMagicParams?: number[][] } };
    };
    expect(parsed.postProcessors?.transMap?.sinMagicParams?.[0]?.[0], 'the export changed but not in '
      + '`postProcessors.transMap.sinMagicParams[0][0]` — so something ELSE moved and the clause above passed '
      + 'for the wrong reason. A difference is only evidence when it is the difference that was made.')
      .toBe(24);
  });

  test('on the STARTUP preset — no tile click — a term edit still reaches Export', async ({ composer }) => {
    /*
     * ⚠️ **THIS TEST EXISTS BECAUSE A SEEDED DEFECT SURVIVED THE TEST ABOVE, AND THE REASON IS A ROUTE, NOT A
     * CLAUSE.** Seeding `commitTables()` to drop its `workingPreset` write left the export test GREEN. The
     * measured explanation: `main.ts`'s `preset` and the Lab's `state.workingPreset` are different objects that
     * **converge after a grid click** — so once a tile has been clicked, the engine setter
     * (`setTransMapWaveTables`, which writes `preset.postProcessors.transMap.sinMagicParams` itself) and the
     * tab's own preset write are writing to the SAME object, and either one alone reaches Export.
     *
     * ⚠️ **ON THE STARTUP ROUTE THEY ARE TWO OBJECTS** (`panel.ts:157` deep-copies at `init()`), and Export reads
     * the LAB's copy (`exportPreset()` takes `state.workingPreset` and overwrites only `overlay`). So the tab's
     * own preset write is load-bearing here and nowhere else — which is `CLAUDE.md`'s *"a confirmation is
     * evidence only if a specific failure was available to it, ON THE ROUTE THE USER USES"* with the two routes
     * differing by one deep copy. **A user who opens the Lab and edits a term without ever visiting the grid is
     * on this route**, and it is also the FIRST thing anyone does.
     *
     * ⚠️ **SO THE FIXTURE IS `config.defaultPreset` AND MUST NOT BE LOADED BY NAME.** Clicking its own tile
     * would converge the two objects and put this test back on the route that cannot fail. The preset is
     * `Aurora Borealis` — X silent, Y at `1@8`, TransMap off — and if the default changes, this test must be
     * re-derived rather than repointed: the requirement is "whatever boots, untouched", not that name.
     */
    await composer.openLab();
    await composer.openTab('transmap');
    await expect(composer.page.locator(PANE)).toBeVisible();

    const amp = composer.page.locator(`${PANE} input[aria-label="Amplitude of term 1 WaveY"]`);
    await expect(amp, 'the startup preset has no live term in the WaveY direction any more, so this test would '
      + 'be editing a dead row. Re-derive the fixture from `config.defaultPreset`.').toHaveCount(1);
    await expect(amp).toHaveValue('1');

    const peakBefore = peakOf(await readout(composer));
    await amp.fill('4');
    await amp.press('Tab');
    await composer.page.waitForTimeout(300);

    // The engine half — `setTransMapWaveTables` rebuilt the field and the sentence followed it.
    expect(peakOf(await readout(composer)), 'the readout did not move on the startup route').toBeGreaterThan(peakBefore * 2);

    // The PRESET half, which is a different write to a different object on this route.
    const parsed = JSON.parse(ComposerPage.normalisePresetJSON(await composer.exportPresetText())) as {
      postProcessors?: { transMap?: { sinMagicParams?: number[][] } };
    };
    expect(parsed.postProcessors?.transMap?.sinMagicParams?.[2]?.[0], 'the term edit reached the engine but NOT '
      + 'the exported preset. `commitTables()` writes BOTH, and on the startup route its `workingPreset` write '
      + 'is the only one Export can see — omit it and every edit made before the first tile click vanishes on '
      + 'Export, while the picture looks right the whole time.').toBe(4);
  });

  test('merely opening the tab changes nothing that Export can see', async ({ composer }) => {
    /*
     * ⚠️ **A TAB THAT DIRTIES THE PRESET ON OPEN IS A SILENT DEFECT, AND THIS TAB HAS EVERY INGREDIENT FOR
     * ONE.** `activate()` re-reads both tables and re-syncs every control, and two of its sliders read a
     * FALLBACK when the layer has no `zoomCenter` (the preset's own centre, which is NOT 50/50). A sync that
     * wrote instead of read would materialise that pair — which `isLegacyExpressible()` reads to decide the
     * whole chain must be serialised. So the export would grow a chain block, and nothing else in the suite
     * would notice.
     *
     * ⚠️ **THE COMPARISON IS AROUND THE OPEN, NOT ACROSS A RELOAD**, because a reload would differ for a dozen
     * legitimate reasons. Exported once with the Lab up and this tab never built, once with it built and synced
     * — and nothing else happens in between, so a difference has exactly one possible author.
     */
    await composer.loadPreset('Intro System');
    await composer.openLab();
    const beforeOpen = ComposerPage.normalisePresetJSON(await composer.exportPresetText());

    await composer.openTab('transmap');
    await expect(composer.page.locator(PANE)).toBeVisible();
    await expect(composer.page.locator(READOUT)).toContainText('Measured:');
    const afterOpen = ComposerPage.normalisePresetJSON(await composer.exportPresetText());

    expect(afterOpen, 'building and syncing the Transmap tab changed the exported preset. The tab reads on '
      + 'activate and writes only from a handler; the likely culprits are the centre sliders\' fallback and '
      + '`commitTables()` being reachable from `sync()`.').toBe(beforeOpen);
  });

  test('the archetype regime shows the SOLVED terms, editable, and the line says whose they are', async ({ composer }) => {
    /*
     * ⚠️ **THIS TEST WAS REVERSED ON 2026-09-22 AND THE OLD VERSION WAS GREEN THE WHOLE TIME.** It used to assert
     * the shipped inversion — every shift-half term input `toBeDisabled()`, the identification line reading
     * *"These terms are not what you are seeing"* and naming `⤓ Bake to terms`. All of that was true of the code
     * and was reported by the owner as two of the three symptoms: *"tables don't match the animation"* and *"an
     * edit doesn't reach the animation"*. **A spec asserting the shipped behaviour of a design defect is green
     * while the defect is present** — the instrument was working and pointed at the wrong requirement, which is
     * why this header records the reversal instead of the file quietly changing its mind.
     *
     * ⚠️ **The superseded answer is §M.1, "show each preset in the regime it is stored in".** The commission
     * replaces it on the EDIT path only: the rows now always show the terms the engine is using, and typing in
     * one adopts them. The rest of §M still stands, including the §J greying the next test owns.
     */
    await openTransmap(composer, 'Shift Lattice Drift');

    await expect(select(composer, 'Pattern')).toHaveValue('Interference');
    await expect(slider(composer, 'Detail'), 'the Detail row is still hidden on a preset that is ON a pattern — '
      + '`detail` multiplies the archetype\'s frequencies, which is the one regime where it means something.')
      .toBeVisible();

    const rows = composer.page.locator(`${TERM_ROW}:visible input`);
    const n = await rows.count();
    expect(n, 'CALIBRATION: no visible term inputs at all, so the enabled claim below would pass over an '
      + 'empty corpus.').toBe(TERM_ROWS_SHIFT * 3);
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i), `term input ${i} is disabled while a pattern is selected — the pre-commission `
        + 'behaviour. The rows now carry the solved terms and typing in one takes them over, so a row that shows '
        + 'a live number and refuses the edit IS the reported symptom.').toBeEnabled();
    }

    const ident = ((await composer.page.locator(IDENT).textContent()) ?? '').trim();
    expect(ident, `expected the "solved at" wording, got ${JSON.stringify(ident)}`)
      .toContain('solved at');
    expect(ident, 'the line must still name the pattern the numbers came from — they are not the preset\'s own, '
      + 'and a user who edits one needs to know whose they were.').toContain('Interference');
    expect(ident, 'the line must NOT claim the terms are unused any more; that wording described the inversion '
      + 'this commission reversed.').not.toContain('not what you are seeing');

    const text = await readout(composer);
    expect(text, `the readout does not credit the pattern: ${JSON.stringify(text)}. ⚠️ **The source phrase is `
      + 'decided by `findArchetype`, never by the table** — and it must keep saying "pattern" while the pattern '
      + 'is what the RESOLVER reads, even though the rows below now show that pattern\'s numbers.')
      .toContain('from pattern “Interference”');

    /*
     * ⚠️ **THE ONE NON-CIRCULAR ORACLE FOR "the tables match the animation": TYPE A SHOWN NUMBER BACK IN AND THE
     * MEASURED PEAK MUST NOT MOVE.** Everything else on this tab is drawn from one measurement, so the rows, the
     * picture and the pane summaries agreeing proves only that they share a function. Re-typing a displayed value
     * routes it through `adoptShownTerms()` and out the OTHER branch of `resolveStaticWaves` — the table branch —
     * and the peak is re-measured there. If the rows had been showing the preset's stored, unread terms (the
     * reported symptom), this adoption would install a completely different field and the peak would jump.
     */
    const peakBefore = peakOf(text);
    const amps = composer.page.locator(`${TERM_ROW}:visible input[aria-label^="Amplitude"]`);
    const shown = await amps.evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
    const slot = shown.findIndex(v => Number(v) !== 0 && !/e/i.test(v));
    expect(slot, `CALIBRATION: no shown amplitude is a plain nonzero number (${JSON.stringify(shown)}), so `
      + 're-typing one would assert nothing. A solved archetype at Strength 0.85 has live terms; an all-zero set '
      + 'means the bake never ran and the rows fell back to the stored table. Exponent forms are skipped because '
      + 'the re-typing below appends a digit.').toBeGreaterThanOrEqual(0);

    /*
     * ⚠️ **THE SAME VALUE HAS TO BE TYPED AS A DIFFERENT STRING, AND THIS IS AN INSTRUMENT DEFECT THIS TEST
     * ALREADY HIT.** `fill()` dispatches `input` only; the `change` this tab listens for comes from the native
     * blur, and a browser raises it only when the value moved since focus. Re-typing `3` as `3` therefore commits
     * NOTHING — the first run of this clause failed with Pattern still on `Interference`, which reads exactly like
     * a missing `adoptShownTerms()` call. `3.0` is a different string and the same number, so the handler runs
     * with an arithmetically identical cell, which is what the peak comparison below needs.
     */
    const retyped = shown[slot]!.includes('.') ? `${shown[slot]}0` : `${shown[slot]}.0`;
    expect(Number(retyped), 'the re-typed string is not the same number as the one on screen, so the comparison '
      + 'below would be measuring an edit rather than a takeover.').toBe(Number(shown[slot]));
    const cell = amps.nth(slot);
    await cell.fill(retyped);
    await cell.press('Tab');
    await composer.page.waitForTimeout(300);

    await expect(select(composer, 'Pattern'), 'typing a term did not take the field over. `writeTerm` calls '
      + '`adoptShownTerms()` FIRST, which is what turns the shown numbers into the stored ones — without it the '
      + 'edit lands on a table the resolver is not reading.').toHaveValue('(Preset)');

    const afterText = await readout(composer);
    expect(afterText, 'the readout still credits the pattern after the takeover, so `pattern` was not written.')
      .toContain('from the terms below');
    const ratio = peakOf(afterText) / peakBefore;
    expect(Math.abs(ratio - 1), `the field changed by ${((ratio - 1) * 100).toFixed(1)} % when the numbers on `
      + 'screen were typed back in, so those numbers were NOT the field. ⚠️ Two plausible causes and they are '
      + 'different bugs: the rows showed the stored table instead of the bake, or `adoptShownTerms()` stored the '
      + 'amplitudes at a strength other than the bake\'s own 0.5 — which applies the solved gain twice.')
      .toBeLessThan(0.02);
  });

  test('Reset and Reapply are armed by what has happened, and each restores the field exactly', async ({ composer }) => {
    /*
     * ⚠️ **THE ARMING IS HALF THE FEATURE AND IT IS THE HALF NO CHECKER CAN SEE** (owner, 2026-09-22: *"Reset
     * should only be active if some changes have been done and Reapply only if Reset has been pushed"*). Both
     * buttons work perfectly while permanently enabled, and a permanently-enabled Reset is also a
     * permanently-lit claim that something has been changed.
     *
     * ⚠️ **Reset is armed by COMPARING, never by a dirty flag** (`snapshotKey()`), so the disabled state at the
     * top of this test is evidence about `activate()`'s baseline too: a tab that dirtied anything on open would
     * arrive with Reset already lit. That is the same property the byte-identical export test asserts from the
     * other side, and this is the cheaper instrument for it.
     */
    await openTransmap(composer, 'Intro System');

    const resetBtn = composer.page.locator(`${PANE} button[aria-label="Reset field"]`);
    const reapplyBtn = composer.page.locator(`${PANE} button[aria-label="Reapply field"]`);
    await expect(resetBtn, 'Reset is armed on a freshly opened tab, so either the baseline was taken after an '
      + 'edit or something on this tab wrote on open.').toBeDisabled();
    await expect(reapplyBtn, 'Reapply is armed before any Reset — it must only ever put back what Reset undid.')
      .toBeDisabled();

    const peakBefore = peakOf(await readout(composer));
    const exportBefore = ComposerPage.normalisePresetJSON(await composer.exportPresetText());

    const amp = composer.page.locator(`${PANE} input[aria-label="Amplitude of term 1 WaveX"]`);
    await amp.fill('24');
    await amp.press('Tab');
    await composer.page.waitForTimeout(300);
    const peakEdited = peakOf(await readout(composer));
    expect(peakEdited, 'CALIBRATION: the edit did not move the field, so neither restore below is observable.')
      .toBeGreaterThan(peakBefore * 2);
    await expect(resetBtn, 'the field was changed and Reset is still greyed. The comparison is `snapshotKey()` '
      + 'over the tables, the style, the resolved static field and the zoom centre — a change to any of them '
      + 'arms it.').toBeEnabled();
    await expect(reapplyBtn, 'an ordinary edit armed Reapply. Only Reset may arm it: otherwise the button '
      + 'promises to restore a state that was never taken away.').toBeDisabled();

    await resetBtn.click();
    await composer.page.waitForTimeout(300);
    await expect(amp, 'Reset did not put the amplitude back in the box.').toHaveValue('6');
    expect(peakOf(await readout(composer)), 'Reset left the measured field where the edit put it — the restore '
      + 'reached the DOM but not the engine.').toBeCloseTo(peakBefore, 1);
    /*
     * ⚠️ **BYTE-IDENTICAL, not "close enough".** `applySnapshot()` `delete`s an absent `staticField` or
     * `zoomCenter` rather than assigning one, because an absent `zoomCenter` means *inherit the preset's own
     * centre* and `isLegacyExpressible()` reads its PRESENCE to decide the whole chain must be serialised. A
     * restore that assigned a defaults object would look identical on screen and grow a chain block in the file.
     */
    expect(ComposerPage.normalisePresetJSON(await composer.exportPresetText()),
      'Reset restored the picture but not the preset, or restored it as a different shape.').toBe(exportBefore);
    await expect(resetBtn, 'the field is back at its baseline and Reset is still armed.').toBeDisabled();
    await expect(reapplyBtn, 'Reset ran and Reapply is still greyed — the redo snapshot is taken BEFORE the '
      + 'restore, which is the whole of its contract.').toBeEnabled();

    await reapplyBtn.click();
    await composer.page.waitForTimeout(300);
    await expect(amp, 'Reapply did not put the edit back.').toHaveValue('24');
    expect(peakOf(await readout(composer)), 'Reapply restored the box but not the field.')
      .toBeCloseTo(peakEdited, 1);
    await expect(reapplyBtn, 'Reapply is still armed after firing. The change it held is back in the field, so '
      + 'there is nothing left to redo — and a second click would be a no-op the button claimed was an action.')
      .toBeDisabled();
    await expect(resetBtn, 'the field differs from the baseline again and Reset is greyed.').toBeEnabled();
  });

  test('style 3 in the table regime greys Zoom Pattern and Zoom Bias, and says why — and a pattern makes both live', async ({ composer }) => {
    /*
     * ⚠️ **THE OWNER'S THIRD BINDING ANSWER, AND THE ENGINE DEFECT (§J) DELIBERATELY REMAINS.** On a style-3
     * layer whose source is the terms, the engine takes the zoom half straight from the second table and holds
     * its bias at 1: both controls are stored, read by nothing, and therefore inert. **Greyed rather than
     * hidden, because the point is to DECLARE the gap** — a hidden control says nothing, and this one has a
     * stored value the engine ignores.
     *
     * ⚠️ **ONE TEST OWNS BOTH SURFACES (invariant 25: the description owns the gate).** The notice and the two
     * `disabled` flags are gated on the same expression, so the clause that would catch them drifting apart is
     * the one that reads all three in both regimes — which is why the second half of this test flips the regime
     * rather than stopping at the grey state.
     */
    await openTransmap(composer, 'Anima Electrica');

    await expect(select(composer, 'Style')).toHaveValue('3');
    await expect(select(composer, 'Pattern')).toHaveValue('(Preset)');

    const notice = composer.page.locator(`${PANE} .sl-composer-precondition`)
      .filter({ hasText: 'greyed rather than hidden' });
    await expect(notice, 'the §J notice is missing or reworded. It is the only place the engine\'s own gap is '
      + 'admitted, and a greyed control with no explanation reads as a broken control.').toBeVisible();

    await expect(select(composer, 'Zoom Pattern')).toBeDisabled();
    await expect(slider(composer, 'Zoom Bias')).toBeDisabled();
    // ⚠️ `Zoom Strength` is NOT in the gate: the second table's amplitude scalar IS read on this branch. A
    // clause that greyed the whole section would be the easy wrong answer, so the exemption is asserted.
    await expect(slider(composer, 'Zoom Strength'), 'Zoom Strength was greyed too. It is read in both regimes; '
      + 'greying the section rather than the two inert controls would overstate the defect.').toBeEnabled();

    // The zoom half's own eight term rows ARE the source here, so they must be visible and editable.
    await expect(composer.page.locator(`${TERM_ROW}:visible`)).toHaveCount(TERM_ROWS_TOTAL);

    // ---- flip the regime: picking a pattern makes both live, and the notice goes -------------------
    await select(composer, 'Pattern').selectOption('Grid Lattice');
    await composer.page.waitForTimeout(300);

    await expect(notice, 'the notice survived the regime change, so it is not reading the same test as the two '
      + 'controls.').toBeHidden();
    await expect(select(composer, 'Zoom Pattern')).toBeEnabled();
    await expect(slider(composer, 'Zoom Bias')).toBeEnabled();
    await expect(slider(composer, 'Detail')).toBeVisible();
  });

  test('an identification the Detail track cannot reach says so', async ({ composer }) => {
    /*
     * ⚠️ **THIS IS THE DEFECT THE PHASE ALMOST SHIPPED, AND IT IS THE STRENGTH PROBLEM IN A SECOND QUANTITY.**
     * `identifyArchetype` returns `detail` as a continuous RATIO; the slider is a bounded grid. `Lost In Another
     * Sky` identifies at 0.125, below `STATIC_FIELD_DETAIL_MIN` — so the line would otherwise name a pattern
     * and a number that cannot both be set, which is *"an authored value the track cannot represent is a
     * defect, readout precision included"* wearing a DERIVED value.
     *
     * ⚠️ **THE BOUNDS ARE NOT RESTATED HERE.** The sentence formats `STATIC_FIELD_DETAIL_MIN`/`MAX`, and a
     * hardcoded `0.25 to 8` in this spec would be a second copy that keeps passing after the constants move —
     * a green clause describing a track that no longer exists. `trackcheck` §M owns the numbers; this file owns
     * "the sentence reaches the screen".
     */
    await openTransmap(composer, 'Lost In Another Sky');

    const ident = ((await composer.page.locator(IDENT).textContent()) ?? '').trim();
    expect(ident, `expected an identification, got ${JSON.stringify(ident)}`).toContain('These terms are');
    expect(ident, 'the line names a Detail the slider cannot reach and does not say so. ⚠️ **Bounds only, never '
      + 'the step**: an off-grid ratio lands on a neighbouring stop and looks similar, an out-of-range one '
      + 'cannot be set AT ALL.').toContain('only reaches');
    expect(ident, 'the warning must say the terms are the only place this field exists — otherwise it reads as '
      + '"pick the pattern anyway".').toContain('the only');

    /*
     * ⚠️ **AND THE SILENT-AXIS REMEDY IS HERE TOO (invariant 29): this preset's X axis is entirely zero.** The
     * summary must SAY the direction is silent rather than give it a size — a `0@0` would be a number where
     * there is no quantity.
     */
    const sums = composer.page.locator(`${PANE_SUM}:visible`);
    await expect(sums.first()).toHaveText('— silent in this direction');
    await expect(sums.nth(1)).toHaveText('4@1');
  });

  test('TransMap switched off: the editor stays live and says the engine is not reading it', async ({ composer }) => {
    /*
     * ⚠️ **"OFF" IS NOT "ABSENT", AND THE TAB MUST NOT COLLAPSE INTO THE NO-LAYER CASE.** 92 library presets
     * carry a separable layer with TransMap disabled; their terms are still the preset's own and are still
     * saved by Export and Snapshot, so the body stays up and the notice explains that the picture is elsewhere.
     * Hiding the body here would mean a user could neither see nor author a field that is genuinely stored.
     */
    await openTransmap(composer, 'Alpha Particles');

    const off = composer.page.locator(`${PANE} .sl-composer-precondition`)
      .filter({ hasText: 'TransMap is switched off' });
    await expect(off, 'no "switched off" notice on a preset whose TransMap is disabled — the tab would be '
      + 'showing controls that reach the picture through nothing, with no word about it.').toBeVisible();
    expect(await off.textContent(), 'the notice must name the way in (Visual FX\'s Translation Map section). '
      + 'This tab deliberately has no Enable of its own — the chain is Visual FX\'s.').toContain('Visual FX');

    await expect(composer.page.locator(`${TERM_ROW}:visible`), 'the term rows were hidden because the engine is '
      + 'not reading them. They are still preset data with no other surface.').toHaveCount(TERM_ROWS_SHIFT);
    await expect(composer.page.locator(READOUT)).toContainText('Measured:');
  });

  test('a preset with no separable layer hides the body and names the way in', async ({ composer }) => {
    /*
     * ⚠️ **THE ONE CASE WHERE HIDING IS RIGHT, AND IT IS THE MORE SPECIFIC MESSAGE THAT MUST WIN.** `Argus`
     * resolves to a style-7 chain and its TransMap is ALSO off — so both preconditions are true of it, and the
     * "switched off" line would send a user to tick an Enable that would still give them nothing to edit. The
     * gate is `!enabled && index >= 0` for exactly that reason.
     */
    await openTransmap(composer, 'Argus');

    const noLayer = composer.page.locator(`${PANE} .sl-composer-precondition`)
      .filter({ hasText: 'no shift or zoom layer' });
    await expect(noLayer).toBeVisible();
    expect(await noLayer.textContent(), 'the notice must name the four layer types that DO have wave terms, '
      + 'because "no separable field" is otherwise indistinguishable from "this tab is broken".')
      .toContain('Wave Shift');

    await expect(composer.page.locator(`${PANE} .sl-composer-precondition`)
      .filter({ hasText: 'TransMap is switched off' }), 'both preconditions are showing. `Argus` has TransMap '
      + 'off AND no separable layer; the off-notice offers a remedy that would change nothing here, so it is '
      + 'gated on a layer existing.').toBeHidden();

    /*
     * ⚠️ **ASSERT VISIBILITY, NEVER `count()`.** The whole body is in the DOM — every slider, every term row,
     * every readout — and is hidden with `display`. A `count()` check would be green with the body fully
     * displayed, which is the same rule this panel states about its own tabs.
     */
    await expect(composer.page.locator(`${TERM_ROW}:visible`)).toHaveCount(0);
    await expect(composer.page.locator(READOUT)).toBeHidden();
    await expect(slider(composer, 'Strength')).toBeHidden();
  });
});
