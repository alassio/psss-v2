import { test, expect, SEL } from './composer-fixture.ts';
import type { Page } from '@playwright/test';

/*
 * ============================================================================================
 * Phase 20.10 — `?screensaver=1`, the SECOND of the phase's two instruments.
 * ============================================================================================
 *
 * The first is `screensaver/probe/` + `RUN-RECORD.md`, which measures the C# host by hand. This file
 * measures the PAGE side of the same contract, and the split is the point: D8 says the host gets no
 * checker, but `?screensaver=1` is a query parameter precisely so the mode is reachable from
 * `npm run dev` and from an ordinary browser (`main.ts:6092`). A build define would have made the
 * whole input policy visible only inside the host, *"which is how a deployment-only path ships
 * broken."*
 *
 * ⚠️ **WHAT THIS FILE CANNOT SEE, STATED FIRST.** `window.chrome.webview` is absent here, so the
 * `psss-exit` MESSAGE is never delivered to anything. What is asserted is that the funnel RAN — via
 * the `console.debug` that `main.ts:6133` calls *"the browser-side instrument"* and requires to be
 * kept. Whether the host acts on the message is §5.C of the run record, measured there against the
 * real binary. **No AUTOMATED instrument covers the join** — but §5.C DID demonstrate it by hand, in
 * one log, so the honest gap is that the demonstration does not re-run on a later build, not that the
 * join is untested. (Corrected here and in four docs on 2026-09-16; the stronger claim was mine.)
 *
 * ⚠️ **THE SEVEN CASES ARE 20.10's OWN LIST AND EACH ONE IS TWO-SIDED WHERE IT CAN BE.** Every clause
 * below asserts about a mode whose defining behaviour is that *nothing happens* — no fullscreen ask,
 * no grid, no shortcut, no exit under threshold. `CLAUDE.md`: *"a confirmation is evidence only if a
 * specific failure was available to it"*, and an absence assertion over a page that never booted
 * passes trivially. So five of the seven carry a CONTROL arm in a mode where the same action DOES
 * something, and the control is what makes the absence mean anything.
 *
 * ⚠️ **CASE 7 WAS ADDED 2026-09-16 BECAUSE A HUMAN SAW SOMETHING SIX GREEN CASES AND THIRTEEN HAND-RUN
 * PROBES HAD ALL PASSED OVER**, and its lesson is about this file's shape rather than about the mode:
 * every case above waits for a settled outcome and then measures, so the whole BOOT is invisible to
 * them by construction. The owner's first real `psss.scr /s` run showed the editor's two-pane layout
 * for about half a second before the reel appeared. **Where a suite's helpers all wait for the end
 * state, no number of cases covers the transient.**
 *
 * ## The seeds — 1 to 6 run 2026-09-15, 7a and 7b run 2026-09-16
 *
 * Each seed was applied, run, and reverted to a byte-identical file (`md5sum` checked against a copy
 * taken before it). ⚠️ **Seeds 1–6 target `src/main.ts`; 7a targets `index.html` and is the first seed
 * in this file that does not touch `src/` at all** — worth saying because the fix it defends is
 * deliberately NOT in `src/` (a screensaver layout rule in `src/ui/layout.css` arrives after the first
 * paint by construction), so a rule of thumb like *"seed the engine"* would have left the load-bearing
 * half of case 7 unseeded. ⚠️ **The point of listing them is that a *skipped* mutation reads exactly
 * like a caught one** — so what is recorded is the clause that went red and, where relevant, the seeds
 * that did NOT:
 *
 * | # | seeded defect | result |
 * |---|---|---|
 * | 1 | the `return` before the fullscreen ask in the screensaver branch, deleted | red — case 1's ask count |
 * | 2 | `presentationClick` installed instead of `screensaverClick` | red — case 2, reason and promotion |
 * | 3a | `if (screensaver) return;` deleted from the shortcut handler | **GREEN — see case 3's ⚠️** |
 * | 3b | `e.stopPropagation()` deleted from `screensaverKey` | **GREEN — see case 3's ⚠️** |
 * | 3c | both of the above deleted | red — case 3's film-look clause |
 * | 4a | the first-`mousemove` discard removed (origin `0,0`) | red — case 4's first-move clause |
 * | 4b | `SCREENSAVER_MOVE_THRESHOLD_PX` 8 → 4 | red — case 4's sub-threshold clause |
 * | 4c | the bare-modifier exemption deleted from `screensaverKey` | red — case 4's modifier clause |
 * | 5 | `postToHost`'s optional chaining and `try` removed | red — case 5, with the mechanism named |
 * | 6 | `autostart = screensaver \|\| (…)`, so `?reel=0` stops winning | red — case 6's precedence clause |
 * | 7a | `index.html`: the `classList.add('psss-screensaver-boot')` removed | red — case 7's panel clause, at `{x: 800, w: 800}` — the owner's flash, measured |
 * | 7b | `main.ts`: the matching `classList.remove(…)` removed | red — case 7's lift clause |
 *
 * ⚠️ **7a and 7b are two halves of ONE mechanism and each catches only its own half**, which is the
 * reason both exist: with 7a alone a curtain that never lifts is green, and with 7b alone a curtain
 * that is never raised is green. Case 6 does constrain 7b from the other side — its `Lab` button
 * cannot be visible unless the curtain lifted — but it reports the failure as a 90 s timeout.
 *
 * ⚠️ **Seed 6 is also why `waitForOutcome()` exists** — see its own header. It first failed as an
 * anonymous 90-second timeout, which is a caught defect with a useless diagnosis.
 *
 * ⚠️ **`boot()` FROM THE SHARED FIXTURE CANNOT BE USED HERE, AND IT FAILS IN THE SLOW DIRECTION.** It
 * waits for `SEL.labButton` to be **visible**; the Lab button lives in the preview-grid panel inside
 * `.right-panel`, and `layout.css:63` sets `.app-layout.fullscreen .right-panel { display: none }`.
 * Screensaver mode calls `setPanelMode('fullscreen')` during boot, so that button is never visible
 * and the shared helper would burn its full 60 s wait and then report a timeout — which reads as
 * *"the engine did not boot"* rather than as *"the harness asked for the wrong element."* The local
 * `bootScreensaver()` waits for `#app-layout.fullscreen` instead. ⚠️ **The fixture is deliberately
 * NOT changed**: every other spec's `boot()` must keep waiting on the surface a user gets.
 */

/** Everything the page said, with its level — `boot()`'s own capture keeps errors only. */
interface Recorded {
  readonly lines: string[];
  readonly errors: string[];
  /** How many times `Element.prototype.requestFullscreen` was CALLED, patched before page load. */
  fullscreenAsks(): Promise<number>;
}

/**
 * Boot with an arbitrary query string, recording the console and counting fullscreen requests.
 *
 * ⚠️ **THE `requestFullscreen` COUNTER IS THE ONLY HONEST INSTRUMENT FOR "IT DID NOT ASK", AND
 * `document.fullscreenElement === null` IS NOT ONE.** A gesture-less ask in headless Chromium is
 * REFUSED, so `fullscreenElement` is null in both arms — after a successful-but-refused ask and after
 * no ask at all. Asserting the state would therefore pass identically whether 20.1's `return` before
 * the ask is present or deleted, which is the exact shape of a clause that cannot fail. Counting the
 * CALL separates them.
 *
 * ⚠️ **The patch returns a REJECTED promise, matching what the browser really does without a
 * gesture** — so `main.ts:6239`'s `catch` still runs and the normal-presentation arm still prints its
 * refusal line. A patch that resolved would silently take the other branch and make the control arm
 * assert about a path production never reaches here.
 */
async function bootScreensaver(page: Page, query: string): Promise<Recorded> {
  const lines: string[] = [];
  const errors: string[] = [];
  page.on('console', (m) => {
    lines.push(`${m.type()}: ${m.text()}`);
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.addInitScript(() => {
    (window as unknown as { __fsAsks: number }).__fsAsks = 0;
    const proto = Element.prototype as unknown as { requestFullscreen: () => Promise<void> };
    proto.requestFullscreen = function patched(): Promise<void> {
      (window as unknown as { __fsAsks: number }).__fsAsks++;
      // Rejected on purpose — see this function's ⚠️. `Promise.reject` rather than `throw` because
      // `main.ts` reads the return value and calls `.catch()` on it.
      return Promise.reject(new Error('requestFullscreen patched by 10-screensaver-mode.spec.ts'));
    };
  });

  await page.goto(`/${query}`, { waitUntil: 'load' });
  return {
    lines,
    errors,
    fullscreenAsks: () => page.evaluate(() => (window as unknown as { __fsAsks: number }).__fsAsks),
  };
}

/**
 * Which of the two mutually exclusive boot outcomes the page reached: presenting, or showing the editor.
 *
 * ⚠️ **A RACE, NOT A WAIT FOR THE EXPECTED ONE, AND THE REASON IS A MEASURED DEFECT IN THIS FILE'S OWN
 * FIRST VERSION.** Seeding `autostart = screensaver || …` (so `?reel=0` stops winning) made case 6 fail
 * — but by a 90-second `locator.waitFor` timeout on the `Lab` button, whose message says nothing about
 * `?reel=0` and reads exactly like *"the engine did not boot"*. That is the slow-direction failure the
 * shared `boot()` would also have produced. Racing the two outcomes turns the same seed into a named
 * claim that arrives in about a second, and **a diagnosis is part of what an instrument is for.**
 *
 * ⚠️ Both branches are given a `.catch` AT CREATION, not after the race: the loser settles 90 s later,
 * long after the test has ended, and an unhandled rejection then lands in whatever test is running.
 */
async function waitForOutcome(page: Page): Promise<'presenting' | 'editor' | 'neither'> {
  const presenting = page.locator('#app-layout.fullscreen').waitFor({ state: 'attached', timeout: 90_000 })
    .then(() => 'presenting' as const).catch(() => 'neither' as const);
  const editor = page.locator(SEL.labButton).waitFor({ state: 'visible', timeout: 90_000 })
    .then(() => 'editor' as const).catch(() => 'neither' as const);
  return Promise.race([presenting, editor]);
}

/** The presentation is up — and it says WHICH other thing happened when it is not. */
async function waitForPresentation(page: Page): Promise<void> {
  const outcome = await waitForOutcome(page);
  expect(outcome, 'the page did not present. "editor" means the autostart block declined (an empty reel '
    + 'library, or a `reel`/`screensaver` parameter not reaching it); "neither" means it never booted at '
    + 'all, which is a harness or engine failure and not a screensaver finding.').toBe('presenting');
}

/** A click with NO cursor travel — see case 2's ⚠️ on why `page.mouse.click()` cannot be used. */
async function clickWithoutMoving(page: Page): Promise<void> {
  await page.mouse.move(400, 300);   // the FIRST move, which the threshold logic discards
  await page.mouse.down();
  await page.mouse.up();
}

const EXIT = '[screensaver] exit requested by';
const PRESENTING = '[screensaver] presenting';

test.describe('Phase 20.10 — the `?screensaver=1` page contract', () => {
  test('1. it presents WITHOUT ever asking for full screen (and normal presentation does ask)', async ({ page }) => {
    /*
     * ⚠️ **THE PROMOTION IS THE DEFECT THIS MODE EXISTS TO REMOVE**, and 20.1's comment says why it is
     * not merely redundant: inside a host window that is already full screen `fullscreenElement` is
     * **null** and a click IS a transient activation, so `requestFullscreen` SUCCEEDS as a visual
     * no-op — *"the first input is spent on it and the screensaver ignores its first click"*, which
     * reads to a user as *"sometimes it does not exit"*.
     *
     * ⚠️ **THE CONTROL ARM IS WHAT MAKES THE COUNT OF 0 EVIDENCE.** `?reel=1` reaches the SAME
     * `startPresentation()` one branch earlier and must ask. Without it, a count of 0 would be
     * satisfied by a page that never presented at all, by a patch that failed to install, and by an
     * engine with the whole autostart block removed.
     */
    const control = await bootScreensaver(page, '?reel=1');
    await waitForPresentation(page);
    const controlAsks = await control.fullscreenAsks();
    expect(controlAsks, 'CALIBRATION: normal reel autostart did not call `requestFullscreen` even '
      + 'once, so either the patch did not install or the page never presented. The screensaver arm '
      + 'below would then be asserting 0 against an instrument that cannot count.').toBeGreaterThan(0);

    // A second page in the same test: the counter is per-page, and the two arms must not share one.
    const ss = await page.context().newPage();
    const saver = await bootScreensaver(ss, '?screensaver=1');
    await waitForPresentation(ss);
    expect(await saver.fullscreenAsks(), 'screensaver mode asked for full screen. 20.1 requires the '
      + '`return` in `startPresentation()` BEFORE the ask: the host window is already full screen, so '
      + 'the ask is a visual no-op that costs the first input.').toBe(0);
    expect(saver.lines.some((l) => l.includes(PRESENTING)), 'the `[screensaver] presenting` line is '
      + 'absent, so this arm never entered the mode and its 0 above means nothing.').toBe(true);

    // ⚠️ And the layout is IDENTICAL to a normal presentation — `main.ts:6222`: *"this mode is the
    // input policy and nothing else."* A mode that also changed the layout would be a second thing
    // to keep in step, and the run record's §5.B pixel measurement is what would catch it late.
    await expect(ss.locator('#app-layout.fullscreen')).toBeAttached();
    await expect(ss.locator(SEL.labButton), 'the Lab button is visible in screensaver mode — the '
      + 'right panel must be hidden by `.app-layout.fullscreen`').toBeHidden();
    await ss.close();
  });

  test('2. a click ends the session and neither enters full screen nor reveals the grid', async ({ page }) => {
    /*
     * ⚠️ **`page.mouse.click()` CANNOT BE USED AND THE REASON IS A REAL AMBIGUITY, NOT PEDANTRY.** It
     * MOVES the cursor first, and `screensaverMove` shares the one-shot funnel with `screensaverClick`
     * — `requestScreensaverExit` is idempotent, so whichever fires first owns the reason. A test that
     * clicked from a distance would frequently exit via *"a mouse move"* and still be green on "it
     * exited", while proving nothing about the click path. So the cursor is placed first (that move is
     * the discarded origin sample) and then pressed without travel.
     *
     * ⚠️ **THE REASON STRING IS THEREFORE PART OF THE ASSERTION** — it is what distinguishes the two
     * handlers, and it is the only thing that can.
     */
    const rec = await bootScreensaver(page, '?screensaver=1');
    await waitForPresentation(page);
    const asksBefore = await rec.fullscreenAsks();

    await clickWithoutMoving(page);
    await page.waitForTimeout(300);

    const exits = rec.lines.filter((l) => l.includes(EXIT));
    expect(exits.length, `no exit was requested by a click. Lines seen: ${JSON.stringify(rec.lines.slice(-8))}`)
      .toBeGreaterThan(0);
    expect(exits[0], 'the exit fired but the reason is not "a click" — `screensaverMove` won the race, '
      + 'so this case did not test the click path at all (see this test\'s ⚠️).').toContain('a click');

    expect(await rec.fullscreenAsks(), 'the click called `requestFullscreen`. In screensaver mode '
      + '`presentationClick` — the only caller of `promotePresentation()` — must never be INSTALLED '
      + '(`main.ts:6215`: a different listener set, not the same one with a flag inside it).')
      .toBe(asksBefore);

    // The grid must not appear: `main.ts:6260` returns early from the reveal path, because leaving a
    // screensaver showing the Preview Grid with no chrome to close it is *worse than doing nothing*.
    await expect(page.locator('#app-layout.fullscreen'), 'the page left fullscreen panel mode after a '
      + 'click — the grid or the Lab is now on screen with no way to dismiss it').toBeAttached();
    await expect(page.locator(SEL.labButton)).toBeHidden();
  });

  test('3. a keypress ends the session and fires NO shortcut (control: it fires without the mode)', async ({ page }) => {
    /*
     * ⚠️ **THE SEED IS A DIGIT, BECAUSE A DIGIT HAS AN OBSERVABLE EFFECT THE TEST HOOK CAN READ.**
     * `main.ts:6393` maps `1`–`9` onto `applyFilmLook`, and `filmLook` is a `TEST_HOOK_KEYS` field. So
     * "no shortcut fired" becomes a measurement rather than a hope. ⚠️ **`r` would have been the
     * tempting choice** — 20.1's own comment names *"a waking `r` cycling the ribbon mode on the way
     * out"* — but `ribbonState` is not on the hook, so the assertion would have had no channel and
     * would have quietly become "it exited", which case 2 already covers.
     *
     * ⚠️ **THE CONTROL ARM RUNS FIRST AND IS NOT OPTIONAL.** If the digit did not change the film look
     * in an ordinary editing session, the screensaver arm's "unchanged" would be vacuous — and it
     * would stay vacuous through any future change that broke the shortcut for unrelated reasons.
     *
     * ⚠️ **THIS CASE CANNOT BE FAILED BY A SINGLE-POINT SEED, AND THAT WAS MEASURED, NOT ASSUMED
     * (2026-09-15).** The keyboard has TWO independent covers and either alone suffices:
     *     seed 3a — delete `if (screensaver) return;` from the document handler → **still green**
     *     seed 3b — delete `e.stopPropagation()` from `screensaverKey`          → **still green**
     *     seed 3c — delete BOTH                                                 → **red**, as quoted below
     * `screensaverKey` is a capture-phase `window` listener and the shortcut handler is a bubble-phase
     * `document` one, so the capture listener's `stopPropagation()` ends propagation before the document
     * ever sees the key. ⚠️ **So a green here does NOT tell you both covers are present** — the same
     * shape as the run record's flash case (`DefaultBackgroundColor` + `WM_ERASEBKGND`), and it is
     * recorded rather than engineered away: removing a cover to make the test sharper would be
     * weakening the product to flatter the instrument. The two exist because `main.ts:6356` says
     * *"'normally' is not the standard here."*
     *
     * ⚠️ **TWO DIGITS, NOT ONE, AND THAT IS WHAT MAKES THE CONTROL DETERMINISTIC.** `main.ts:6395` maps
     * digit N onto `Object.keys(FILM_LOOKS)[N-1]`, so a single digit is a no-op whenever the preset the
     * library happens to open with ALREADY carries that look — the control would then fail while the
     * engine was perfectly correct, and the honest reading of that red would be impossible to
     * distinguish from a real regression. `1` and `2` name two DIFFERENT looks, so the current look can
     * equal at most one of them and the two readings after the presses must differ from each other. No
     * knowledge of the library's opening preset is needed, and none is assumed.
     */
    const readLook = (p: Page) => p.evaluate(
      () => (window as unknown as { __psss?: { filmLook: string } }).__psss?.filmLook ?? null);

    await bootScreensaver(page, '?reel=0&testhook=1');
    await page.locator(SEL.labButton).waitFor({ state: 'visible', timeout: 90_000 });
    expect(await readLook(page), 'CALIBRATION: `?testhook=1` gave no `filmLook`, so neither arm of this '
      + 'case has a channel to read and the screensaver arm below cannot fail.').not.toBeNull();

    await page.keyboard.press('1');
    await page.waitForTimeout(400);
    const afterOne = await readLook(page);
    await page.keyboard.press('2');
    await page.waitForTimeout(400);
    const afterTwo = await readLook(page);
    expect(afterTwo, `CALIBRATION: "1" and "2" produced the same film look (${afterOne} then `
      + `${afterTwo}). They name two different entries of FILM_LOOKS, so the shortcut is not reaching `
      + 'the hook at all and the screensaver arm\'s "unchanged" assertion would be decorative.')
      .not.toBe(afterOne);

    const ss = await page.context().newPage();
    const rec = await bootScreensaver(ss, '?screensaver=1&testhook=1');
    await waitForPresentation(ss);
    const before = await readLook(ss);
    await ss.keyboard.press('1');
    await ss.waitForTimeout(200);
    await ss.keyboard.press('2');
    await ss.waitForTimeout(400);

    expect(await readLook(ss), 'the film-look shortcut fired in screensaver mode. `main.ts:6359` '
      + 'returns early from the document handler AND `screensaverKey` calls `stopPropagation()`; the '
      + 'mode owns the keyboard outright, because the page is not waking, it is dying.').toBe(before);
    const exits = rec.lines.filter((l) => l.includes(EXIT));
    expect(exits.length, 'the key changed nothing AND requested no exit — the listener is not '
      + 'installed at all, which is a worse defect than the shortcut firing.').toBeGreaterThan(0);
    // ⚠️ The FIRST key owns the reason: `requestScreensaverExit` is idempotent, so `2` is recorded
    // nowhere. Asserting the reason names `1` is what shows the funnel read `e.key` rather than a
    // constant — a hardcoded reason string would satisfy "an exit happened" forever.
    expect(exits[0]).toContain('the 1 key');
    expect(exits, 'the second key produced a SECOND exit line. `requestScreensaverExit` must be '
      + 'idempotent: the host acts on the message, and two closes race.').toHaveLength(1);
    await ss.close();
  });

  test('4. a bare modifier and a sub-threshold move do nothing; past 8 px reports an exit', async ({ page }) => {
    /*
     * ⚠️ **THREE ABSENCES AND ONE PRESENCE, IN ONE PAGE, IN ORDER — AND THE ORDER IS THE INSTRUMENT.**
     * The funnel is one-shot, so each absence is only meaningful while no exit has yet been requested;
     * the final presence then proves every preceding absence was measured on a page that COULD have
     * exited. Splitting these across four pages would lose exactly that.
     *
     * ⚠️ **THE FIRST MOVE IS DISCARDED BY DESIGN AND FOR A REASON A DELAY CANNOT FIX** (`main.ts:6113`):
     * Windows delivers a `WM_MOUSEMOVE` whenever the cursor merely happens to sit inside a newly
     * created window, with no motion at all. The host's 700 ms grace (run record §5.D) is the *other*
     * remedy, for the mouse-up of the double-click that launched the `.scr`. Conflating them yields a
     * saver that ignores 700 ms of real input *and still* exits instantly when the cursor was centred.
     */
    const rec = await bootScreensaver(page, '?screensaver=1');
    await waitForPresentation(page);
    const noExitYet = (why: string) =>
      expect(rec.lines.filter((l) => l.includes(EXIT)), why).toHaveLength(0);

    // (a) a bare modifier is someone reaching for Alt+Tab, not asking for the session to end.
    await page.keyboard.press('Shift');
    await page.keyboard.press('Control');
    await page.waitForTimeout(200);
    noExitYet('a bare Shift or Control ended the session. `main.ts:6152` exempts all four modifiers — '
      + 'Alt+Tab away from a screensaver is not the user asking for it to end.');

    // (b) the first move sets the origin and returns; it cannot exit however far it travels.
    await page.mouse.move(700, 500);
    await page.waitForTimeout(150);
    noExitYet('the FIRST mousemove ended the session. It must be discarded — a cursor that merely sits '
      + 'inside a newly created window generates one with no motion involved.');

    // (c) 3 px, then 3 px more: cumulative 6 < 8, so still nothing. ⚠️ PATH length, not displacement.
    await page.mouse.move(703, 500);
    await page.mouse.move(706, 500);
    await page.waitForTimeout(150);
    noExitYet('a 6 px cumulative move ended the session, under the 8 px threshold. A screensaver that '
      + 'dies on cursor jitter is the defect `SCREENSAVER_MOVE_THRESHOLD_PX` exists to prevent.');

    // (d) 5 px more: cumulative 11 ≥ 8. Now it must exit, and by the MOVE route.
    await page.mouse.move(711, 500);
    await page.waitForTimeout(300);
    const exits = rec.lines.filter((l) => l.includes(EXIT));
    expect(exits.length, 'an 11 px cumulative move did NOT end the session — and because of that, '
      + 'every absence asserted above was measured on a page that may simply have had no listener. '
      + 'This clause is what makes (a)–(c) evidence.').toBeGreaterThan(0);
    expect(exits[0]).toContain('a mouse move');
  });

  test('5. `window.chrome.webview` is absent and nothing throws', async ({ page }) => {
    /*
     * ⚠️ **THIS IS THE CASE THAT PROTECTS THE OTHER FIVE.** `postToHost` is called on the exit path
     * with no host present; if it threw, the funnel would die *after* setting
     * `screensaverExitRequested = true` and before its `console.debug` — so every other case here
     * would report "no exit line" and read as a defect in the input policy rather than in the channel.
     *
     * ⚠️ **AND THE ABSENCE IS ASSERTED, NOT ASSUMED.** If some future fixture ever injected a stub
     * `chrome.webview`, this spec would silently start testing the host-present path — the one
     * configuration a browser cannot honestly test — and would still be green.
     */
    const rec = await bootScreensaver(page, '?screensaver=1');
    await waitForPresentation(page);

    const hasHost = await page.evaluate(() =>
      !!(window as unknown as { chrome?: { webview?: unknown } }).chrome?.webview);
    expect(hasHost, 'CALIBRATION: `window.chrome.webview` EXISTS in this browser run. Every clause in '
      + 'this file assumes the host channel is absent; with a stub present this spec is measuring a '
      + 'different mode than the one it names.').toBe(false);

    await clickWithoutMoving(page);
    await page.waitForTimeout(300);

    expect(rec.lines.some((l) => l.includes(EXIT)), 'the exit funnel produced no line with no host '
      + 'present — `postToHost` most likely threw before the `console.debug`. `main.ts:6133` calls '
      + 'that line the browser-side instrument and requires both channels to be kept.').toBe(true);
    expect(rec.errors, `the page reported errors in screensaver mode: ${JSON.stringify(rec.errors)}. `
      + 'A missing `chrome.webview` must be a no-op, not a throw — `main.ts:76` says the two posters '
      + 'need no mode gate precisely because they are inert in a browser.').toHaveLength(0);
  });

  test('6. `?screensaver=1&reel=0` presents NOTHING and installs no input policy', async ({ page }) => {
    /*
     * ⚠️ **A CONTRADICTORY PAIR RESOLVES TOWARD THE DEBUGGABLE SIDE, DELIBERATELY** (`main.ts:6295`):
     * `?reel=0` wins over the mode's forced autostart, because it is *"the only way to load the page
     * in screensaver mode WITHOUT playback."*
     *
     * ⚠️ **THE LOAD-BEARING CLAUSE IS THAT A CLICK DOES NOTHING, AND IT IS A STRUCTURAL CLAIM.** The
     * three listeners are installed by `startPresentation()`; with no presentation there is no input
     * policy at all. A mode flag consulted inside a *globally* installed handler would pass every
     * other case in this file and fail only this one — so this is the case that holds the mode's
     * shape, not just its behaviour.
     *
     * ⚠️ **AND THE HOST'S REAL `/c` URL IS NOT THIS ONE.** The run record's log shows
     * `navigating to https://psss.invalid/index.html?reel=0&tab=reel` — no `screensaver=1`. This case
     * is the parameter contract; the pair below is the host's actual config route, asserted second so
     * a failure names which of the two is broken.
     */
    const rec = await bootScreensaver(page, '?screensaver=1&reel=0');
    expect(await waitForOutcome(page), 'the page presented despite `?reel=0`, which must win over the '
      + 'mode\'s forced autostart — it is the only way to load the page in screensaver mode WITHOUT '
      + 'playback, and the host\'s `/c` route depends on the same precedence.').toBe('editor');
    expect(rec.lines.some((l) => l.includes(PRESENTING)), 'the layout stayed in editor mode but the '
      + 'screensaver presenting line was logged — the two disagree, so one of them is lying.').toBe(false);
    await expect(page.locator('#app-layout.fullscreen')).not.toBeAttached();
    expect(await rec.fullscreenAsks()).toBe(0);

    await clickWithoutMoving(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    expect(rec.lines.filter((l) => l.includes(EXIT)), 'a click or key requested an exit on a page that '
      + 'never presented. The input policy is installed BY `startPresentation()`; if it is reachable '
      + 'without one, the mode is a global handler with a flag inside it and the host\'s `/c` config '
      + 'window would close itself on the first click.').toHaveLength(0);

    /*
     * The host's actual `/c` route, and 20.8a's `?tab=` in the same breath.
     *
     * ⚠️ **DO NOT WAIT FOR THE `Lab` BUTTON HERE — IT IS HIDDEN, AND THE FIRST VERSION OF THIS ARM SPENT
     * 90 s DISCOVERING THAT.** `?tab=reel` calls `setPanelMode('lab')` itself (`main.ts:6342`), and the
     * Grid and the Lab are mutually exclusive views of ONE panel: once the Lab is open, the `Lab` button
     * is gone and the way back is the header's `Grid` button. So this arm waits on the TAB BAR, while
     * the first arm above legitimately waits on the `Lab` button — there nothing opened the Lab, which
     * is precisely what that arm asserts. ⚠️ The two waits differ *because the two states differ*; using
     * one helper for both would have to fail on one of them.
     */
    const cfg = await page.context().newPage();
    const cfgRec = await bootScreensaver(cfg, '?reel=0&tab=reel');
    await cfg.locator(SEL.tabBar).waitFor({ state: 'visible', timeout: 90_000 });
    // ⚠️ `.active`, not merely present: the log line below says a tab was opened, but only the class
    // says WHICH — and `openTab` returning true for an unregistered module is the failure 20.8a's second
    // warning exists for. The Reel tab registers inside a guard of its own, so the bar can hold fewer
    // tabs than `TAB_DEFS` lists and `/c` would open on whatever was active instead.
    await expect(cfg.locator(`${SEL.tabBtn('reel')}.active`), 'the Reel tab is not the active tab after '
      + '`?tab=reel` — the host\'s `/c` window would open on some other tab, or the Reel tab never '
      + 'registered at all.').toBeVisible();
    expect(cfgRec.lines.some((l) => l.includes('[tab] opened the Lab on "reel"')),
      `?tab=reel did not log the open. Lines: ${JSON.stringify(cfgRec.lines.slice(-6))}`).toBe(true);
    await expect(cfg.locator(SEL.labButton), 'the `Lab` button is visible while the Lab is open — the '
      + 'two views of the panel are meant to be mutually exclusive').toBeHidden();
    await cfg.close();
  });

  test('7. the editor layout is never painted during boot, and the curtain lifts when it must', async ({ page }) => {
    /*
     * ⚠️ **THE DEFECT THIS CASE EXISTS FOR WAS FOUND BY A HUMAN LOOKING AT THE SCREEN, ON THE FIRST
     * REAL `psss.scr /s` RUN (owner, 2026-09-16), AND SIX GREEN CASES PLUS TWELVE HOST PROBES HAD
     * ALREADY PASSED OVER IT**: *"first the screen is black, then for half a second the screen is
     * split into two panes (right panel a bit more bright) but both panes do not contain anything."*
     * `startPresentation()` runs at the END of boot, so until it does, `.app-layout` is the ordinary
     * `1fr 1fr` editor grid with `.right-panel` at `#0a0a0a`. Fixed by a boot curtain in
     * `index.html`'s head, lifted in `main.ts`'s autostart block.
     *
     * ⚠️ **WHY THE OTHER INSTRUMENTS MISSED IT, BECAUSE THAT IS THE REUSABLE PART.** Every case above
     * waits for a settled outcome and then measures — `waitForPresentation` first — so all of them
     * are blind to every intermediate state BY CONSTRUCTION. The host probe did sample the boot
     * (`RUN-RECORD.md` §5.I, 76 samples over 6 s) but reduced each sample to a mean over a
     * 2880×8 strip and reported the extremes: a `#0a0a0a` panel over a quarter of the width moves
     * such a mean by about 3 counts, and the record's own `...` elides the middle of the series in
     * favour of the brightest sample. **A test that only ever looks at endpoints cannot see a
     * transient, and a measurement reduced to a mean cannot see a dim region.**
     *
     * ⚠️ **THE STALL IS THE INSTRUMENT.** The boot window is ~500 ms and racing it would make this
     * case flaky in the direction that gets tests deleted, so the dev server's `psss_presets.json`
     * fetch (`main.ts:632`) is held open instead, freezing the page in the exact state the owner saw.
     * ⚠️ It is held on the SUBJECT AND THE CONTROL AT ONCE and released once: two pages, one gate.
     *
     * ⚠️ **THE CONTROL ARM IS WHAT MAKES "HIDDEN" MEAN ANYTHING.** A hidden right panel is also what
     * a page that has not rendered yet looks like, what a wrong selector looks like, and what a
     * failed navigation looks like. So an ordinary load is stalled identically and its right panel
     * must be VISIBLE and WIDE at the same point in its life.
     */
    let release = (): void => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    // ⚠️ `await`ed rather than returned: `page.route` resolves to a `Disposable` in Playwright 1.63,
    // which `check:specs` rejects against a `Promise<void>` annotation (and `verify` cannot see).
    const stallPresets = async (p: Page): Promise<void> => {
      await p.route('**/psss_presets.json', async (route) => {
        await held;
        await route.continue();
      });
    };
    /** The second grid track's USED width — `1fr 0fr` resolves to `"<N>px 0px"`. */
    const secondTrackPx = (p: Page): Promise<number> => p.evaluate(() => {
      const cols = getComputedStyle(document.getElementById('app-layout')!).gridTemplateColumns;
      return parseFloat(cols.trim().split(/\s+/)[1] ?? 'NaN');
    });
    /*
     * ⚠️ **BOTH ARMS MUST BE MEASURED IN THE SAME STATE, AND THE FIRST VERSION OF THIS CASE WAS NOT
     * — IT PASSED ALONE AND FAILED IN A FULL-FILE RUN** (2026-09-16). `#right-panel` is attached by
     * the HTML parser, but `layout.css` arrives with the module graph, so measuring as soon as the
     * element exists can land BEFORE `.app-layout` is a grid at all: `gridTemplateColumns` is then
     * the string `"none"` and the parse above is `NaN`. Run alone the control happened to be styled
     * in time; after six other cases it was not. **The calibration is what caught it, in the
     * direction it was written for — a disagreement between two measurements of one page.**
     *
     * ⚠️ **THE UNSTYLED INSTANT IS COVERED BY THE FIX AND IS DELIBERATELY NOT ASSERTED HERE.** The
     * curtain's `display: none` sits in `index.html`'s HEAD, so it applies to that instant too — but
     * the instant is not addressable from a test (there is no event for "parsed but not yet styled"),
     * and an assertion that cannot be reliably reached is worse than a missing one. What this case
     * measures is the styled boot window, which is the half-second the owner actually saw.
     */
    const awaitStyled = async (p: Page): Promise<void> => {
      await p.waitForFunction(() => {
        const el = document.getElementById('app-layout');
        return !!el && getComputedStyle(el).display === 'grid';
      }, undefined, { timeout: 60_000 });
    };

    const control = await page.context().newPage();
    const saver = await page.context().newPage();
    try {
      await stallPresets(control);
      await stallPresets(saver);
      // `commit`, not `load`: the point is to be inside the boot, and `load` is a settled outcome.
      await control.goto('/', { waitUntil: 'commit' });
      await saver.goto('/?screensaver=1', { waitUntil: 'commit' });
      await awaitStyled(control);
      await awaitStyled(saver);

      // CALIBRATION, and it comes first: the editor layout must be measurable mid-boot at all.
      const controlBox = await control.locator('#right-panel').boundingBox();
      expect(controlBox?.width ?? 0, 'CALIBRATION: an ORDINARY stalled load shows no right panel '
        + 'either, so this case cannot tell a hidden panel from an unrendered page and its verdict '
        + 'on screensaver mode below is worthless. Either the stall now blocks the layout itself, or '
        + '`#right-panel` is no longer the pane the owner saw.').toBeGreaterThan(100);
      expect(await secondTrackPx(control), 'CALIBRATION: the control\'s second grid track is 0 px '
        + 'while its panel has width — the two measurements disagree, so one of them is wrong.')
        .toBeGreaterThan(100);

      // ⚠️ Assert we really are BEFORE the decision. Without this the case could pass by having
      // measured after `startPresentation()`, which is what every other case in this file does.
      await expect(saver.locator('#app-layout.fullscreen'), 'the page presented while its presets '
        + 'were still stalled, so this measurement is not of the boot window at all.')
        .not.toBeAttached();

      expect(await saver.locator('#right-panel').boundingBox(), 'the editor\'s right panel occupies '
        + 'real screen area during a screensaver boot — this is the owner\'s two-pane flash. The '
        + 'curtain is `html.psss-screensaver-boot` in `index.html`\'s HEAD; check it is still set '
        + 'there (a rule moved into `layout.css` arrives too late by construction) and that its '
        + 'selectors still outrank `.app-layout`.').toBeNull();
      expect(await secondTrackPx(saver), 'the second grid column is not collapsed during a '
        + 'screensaver boot, so the canvas is sized to part of the window and the rest is chrome.')
        .toBe(0);

      // ── and now the half the curtain makes possible to get wrong: it must LIFT ────────────────
      release();
      await waitForPresentation(saver);
      await expect(saver.locator('html.psss-screensaver-boot'), 'the boot curtain is still set after '
        + 'the page presented. It is harmless while `.fullscreen` agrees with it, which is exactly '
        + 'why it must be removed here rather than left to agree forever — `main.ts`\'s autostart '
        + 'block owns the removal, unconditionally and after the decision.').not.toBeAttached();

      /*
       * ⚠️ **`?screensaver=1&reel=0` IS THE ARM THE CURTAIN COULD BREAK, AND CASE 6 WOULD ONLY CATCH
       * IT AS A 90 s TIMEOUT.** That pair loads screensaver mode WITHOUT playback on purpose, so it
       * must end up showing the editor; a curtain keyed on `?screensaver=1` and never lifted would
       * leave a permanently black debug page whose `Lab` button is present but invisible.
       */
      const debug = await page.context().newPage();
      const rec = await bootScreensaver(debug, '?screensaver=1&reel=0');
      /*
       * ⚠️ **60 s, AND THE DEFAULT 5 s FAILED HERE FIRST** (2026-09-16). `bootScreensaver` resolves on
       * `load`, and the lift is at the END of a boot that takes well over 5 s under headless
       * SwiftShader — the whole reason `waitForOutcome` above is written against a 90 s budget. The
       * short version failed with a message that read exactly like a stuck curtain, which is the
       * false positive worth spending a comment on: the *lift* had not happened YET, and the correct
       * reading was available from case 6 being green (its `Lab` button cannot be visible unless the
       * curtain has lifted). Assert the boot's END state with the boot's own budget.
       */
      await expect(debug.locator('html.psss-screensaver-boot'), 'the boot curtain is still set on '
        + '`?screensaver=1&reel=0`, which must show the editor: the debug route that exists to load '
        + 'this mode without playback is now a black screen.').not.toBeAttached({ timeout: 60_000 });
      await expect(debug.locator(SEL.labButton), 'the `Lab` button is not visible on '
        + '`?screensaver=1&reel=0` — the editor did not come back.').toBeVisible({ timeout: 30_000 });
      expect(rec.errors, 'the debug route logged a page error').toEqual([]);
      await debug.close();
    } finally {
      release();
      await control.close();
      await saver.close();
    }
  });
});
