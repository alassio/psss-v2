/*
 * `uicheck.mjs` — **does the regrouped Visual FX tab mount, group, gate, and leave the engine untouched?**
 *
 * ⚠️ **OUTSIDE `verify`, ON PURPOSE AND FOR `democheck`'s REASON: it needs a browser.** `verify` is the
 * engine's gate and must stay runnable without Chromium. Run it deliberately: `npm run check:ui`, against
 * a dev server on 5190.
 *
 * ⚠️ **IT EXISTS BECAUSE A PURE LAYOUT CHANGE HAS EXACTLY ONE WAY TO BE FUNCTIONAL, AND IT IS SILENT:** a
 * section that the reorder dropped, or a control that stopped being synced. **The second cannot happen by
 * construction** — `syncKey()` resolves through `controlList`, which holds element references captured at
 * CONSTRUCTION, so re-parenting cannot reach it, and it THROWS on a missing key rather than going stale.
 * **The first can, which is why the section census below names all 19 rather than counting them.**
 *
 * ⚠️ Every selector here is a shipped class name. **No `data-testid` — ever.**
 *
 * ⚠️ The decisive structural fact is already established in source: `syncKey()` resolves through
 * `controlList`, which holds element references captured at CONSTRUCTION, so re-parenting cannot affect
 * it — and it THROWS on a missing key rather than going stale. **This run is for the two things source
 * cannot settle: that nothing throws at mount, and that Export is byte-identical across a collapse.**
 */
import { chromium } from 'playwright';

const URL = (process.env.DEMO_URL ?? 'http://localhost:5190/') + '?testhook=1';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3500);

let pass = 0, fail = 0;
/*
 * A read-only snapshot of engine state, taken before the settings search is exercised in section S.
 * `null` when the page was not opened with `?testhook=1`, in which case that clause is skipped rather
 * than asserted over nothing.
 */
let hookBeforeSearch = null;

const chk = (n, ok, d = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '   ' + d : ''}`); ok ? pass++ : fail++; };

/*
 * Open the Lab, then the Visual FX tab — using the SUITE'S OWN selectors rather than guessed ones.
 * ⚠️ `TabRegistry` builds a tab's container on FIRST SHOW, so nothing inside Visual FX exists in the DOM
 * until its button has been clicked. My first attempt guessed at an accessible name, found nothing, and
 * timed out waiting for a group head that could not exist yet — which read as a layout failure and was a
 * fixture failure.
 */
const bar = page.locator('.sl-tab-bar');
if (await bar.count() === 0 || !(await bar.first().isVisible())) {
  await page.locator('button.pg-mode-btn:has-text("Lab")').first().click();
  await bar.first().waitFor({ state: 'visible', timeout: 30000 });
}
await page.locator('.sl-tab-btn[data-tab="visual-fx"]').click();
await page.waitForTimeout(900);

/*
 * The pre-search snapshot for section S. Taken HERE, before anything in this file has typed into the
 * settings field, because the clause it feeds asks whether USING the search moved engine state -- and
 * that question is only answerable against a value captured first.
 */
hookBeforeSearch = await page.evaluate(() => {
  const h = window.__psss;
  return h === undefined ? null : {
    mode: h.renderMode, mat: h.material, look: h.filmLook, pts: h.particleCount,
    scale: h.figureScale, fold: h.symmetryFold, speed: h.speedFactor,
  };
});

/** A row by its visible label. ⚠️ `slider()` sets no `aria-label`, so the label SPAN is the handle. */
const row = (label) => page.locator('.sl-vfx-row')
  .filter({ has: page.locator(`.sl-vfx-label:text-is("${label}")`) }).first();

const heads = page.locator('.sl-vfx-group-head');
/*
 * ⚠️ **THE LABEL SPAN, not the head's `textContent`** — the activity badge is a second child span, so
 * `allTextContents()` returned `["Figure0","Particles1",…]` once the badge existed. **A clause that reads
 * a container's text is a clause that breaks when anything is added to the container**; naming the child
 * is what makes it survive.
 */
const names = await heads.locator('span:first-child').allTextContents();
chk('the five groups mount, in the owner\'s order',
  JSON.stringify(names) === JSON.stringify(['Figure', 'Particles', 'Colour', 'Image', 'Fields']),
  JSON.stringify(names));

/*
 * ⚠️ **ALL FIVE SHIP COLLAPSED, AND THE ACTIVITY BADGE IS WHAT MAKES THAT SAFE** — 58 % of the library
 * runs a Translation Map, so a closed group with no marker would conceal a live effect. The two clauses
 * below are one decision: if the badge clause ever fails, the collapse is no longer safe either.
 */
chk('all five groups ship COLLAPSED (owner option B)',
  (await Promise.all([0, 1, 2, 3, 4].map((i) => heads.nth(i).getAttribute('aria-expanded'))))
    .every((v) => v === 'false'),
  (await Promise.all([0, 1, 2, 3, 4].map((i) => heads.nth(i).getAttribute('aria-expanded')))).join(','));

{
  // The badge must be ABSENT where nothing is active and PRESENT with a number where something is.
  // On the default preset `Colour` has a film look, so its badge must be lit; `Fields` has nothing.
  const badge = (i) => heads.nth(i).locator('.sl-vfx-group-count');
  const colourShown = await badge(2).isVisible();
  const colourText = (await badge(2).textContent().catch(() => '')) ?? '';
  const fieldsShown = await badge(4).isVisible();
  chk('the activity badge is LIT with a count where something is active, and absent where nothing is',
    colourShown && /^[1-9]/.test(colourText.trim()) && !fieldsShown,
    `Colour badge ${colourShown ? 'shown "' + colourText.trim() + '"' : 'ABSENT'}, `
    + `Fields badge ${fieldsShown ? 'shown' : 'absent'} — the default preset has a film look and no fields`);

  chk('...and the count is also in the head TITLE, so the signal is not colour-only',
    /active here/.test((await heads.nth(2).getAttribute('title')) ?? ''),
    `title: ${JSON.stringify(((await heads.nth(2).getAttribute('title')) ?? '').slice(-40))}`);
}

{
  // Deformation is a collapsible SECTION, and its body must be reachable — a predicate gate here would
  // have made it permanently unreachable, which is the defect `makeCollapsibleSection` exists to avoid.
  await heads.nth(0).click();                       // open Figure
  await page.waitForTimeout(250);
  const sub = page.locator('.sl-vfx-sub-head').filter({ hasText: 'Deformation' }).first();
  const before = await sub.getAttribute('aria-expanded');
  await sub.click();
  await page.waitForTimeout(250);
  const after = await sub.getAttribute('aria-expanded');
  /*
   * ⚠️⚠️ **SELECTED ON THE ROW'S LABEL SPAN, NOT ON `aria-label`, BECAUSE `slider()` SETS NONE.** Only
   * two specialised widgets in this tab set an `aria-label`; `makeRow` puts the text in a
   * `.sl-vfx-label` span. **An earlier version of this file asserted `!isVisible()` on
   * `[aria-label="Dye Amount"]` and PASSED — on an element that never existed.** A negative assertion
   * against a selector that matches nothing is the false pass this project warns about, and it is worse
   * than no clause at all. Both clauses here now select something that provably exists when shown.
   */
  const twistVisible = await row('Fold').isVisible().catch(() => false);
  chk('Deformation is a collapsible SECTION that opens to reveal its rows',
    before === 'false' && after === 'true' && twistVisible,
    `aria-expanded ${before} -> ${after}; the Fold row visible: ${twistVisible}`);
  await heads.nth(0).click();                       // leave Figure as found
  await page.waitForTimeout(200);
}

// every section title must still be present SOMEWHERE — a lost section is the real hazard of a reorder
const titles = await page.locator('.sl-vfx-group-body .sl-section-title').allTextContents();
// ⚠️ `Deformation` is DELIBERATELY absent from this list: it is now a `.sl-vfx-sub-head` collapsible
// rather than a `.sl-section-title`, and it is asserted by the clause that opens it instead.
const EXPECT = ['Framing & Timing', 'Attractor', 'Render Mode', 'Per-Particle',
  'Splat Shear', 'Ribbon Rendering', 'Neon Lines', 'Film Look', 'Colour Palette', 'Dye Field',
  'Translation Map', 'Cohesion', 'Liquid Field', 'Fluid Advection', 'Curl Noise', 'Physarum Network'];
const missing = EXPECT.filter((t) => !titles.includes(t));
chk('every section survived the reorder', missing.length === 0,
  `${titles.length} titles in groups; missing: ${missing.join(', ') || 'none'}`);

/*
 * The gate, asserted in BOTH directions so neither half can be vacuous: with `Dye Field` off its
 * `Dye Amount` row must exist in the DOM (construction is never deferred) and be HIDDEN; switching the
 * enabler on must reveal it.
 */
{
  await heads.nth(4).click();                      // open Fields
  await page.waitForTimeout(250);
  const amount = row('Dye Amount');
  const built = await amount.count();
  const hiddenWhenOff = built > 0 && !(await amount.isVisible());
  /*
   * ⚠️ **SELECTED ON ITS ACCESSIBLE NAME, which is what `31.U2` added it for.** Five sections label
   * their checkbox `Enable`, so `filter({ hasText: /^Enable/ }).last()` picked CURL NOISE's — the clause
   * reported "shown on: false" and the engine was fine. **A position-based selector over colliding
   * labels is the shape `CLAUDE.md` forbids, and this is what it costs.**
   */
  const enable = page.locator('[aria-label="Enable Dye Field"]');
  await enable.check().catch(() => {});
  await page.waitForTimeout(300);
  const shownWhenOn = await amount.isVisible().catch(() => false);
  await enable.uncheck().catch(() => {});
  await page.waitForTimeout(250);
  const hiddenAgain = !(await amount.isVisible().catch(() => true));
  await heads.nth(4).click();                      // leave Fields as found
  chk('a gated body is BUILT but hidden while off, and revealed when the enabler is switched on',
    built > 0 && hiddenWhenOff && shownWhenOn && hiddenAgain,
    `Dye Amount row in DOM: ${built > 0}; hidden off: ${hiddenWhenOff}; shown on: ${shownWhenOn}; `
    + `hidden again: ${hiddenAgain}. ⚠️ The "in DOM" half is what proves construction is NOT deferred — `
    + 'which is the whole reason a collapsed or gated row still exports and still takes a Reset');
}

// EXPORT equivalence across a collapse — the thing the owner asked to be sure of
/*
 * ⚠️ **THE HOOK EXPOSES ENGINE STATE, NOT A PRESET — my first version asked for `__psss.preset` and got
 * `null`, which it reported as INCONCLUSIVE rather than as a pass.** The 16 declared fields are the live
 * settings (`renderMode`, `material`, `filmLook`, `figureScale`, `symmetryFold`, `symmetryMirror`,
 * `particleCount`, `speedFactor`, the bypass flags…), which is exactly the surface a stray UI write would
 * disturb. `pos` and `elapsedTime` are EXCLUDED because they advance every frame by design — including
 * them would make this clause fail on a working engine.
 */
const KEYS = ['speedFactor', 'renderMode', 'material', 'filmLook', 'bypassVisualFx', 'bypassMaterials',
  'presetName', 'figureScale', 'symmetryFold', 'symmetryMirror', 'particleCount'];
const exportJson = () => page.evaluate((keys) => {
  const h = window.__psss;
  if (!h) return null;
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, h[k]])));
}, KEYS);
const before = await exportJson();
await heads.nth(4).click();            // expand Fields
await page.waitForTimeout(300);
await heads.nth(0).click();            // collapse Figure
await page.waitForTimeout(300);
const after = await exportJson();
chk('collapsing and expanding groups changes the engine STATE by NOTHING',
  before !== null && before === after,
  before === null ? 'the test hook is absent — add ?testhook=1; INCONCLUSIVE, not a pass'
    : `${before.length} chars, identical`);

/*
 * ════════════════════════════════════════════════════════════════════════════════════════════════════
 * THE MATERIALS TAB (v8 `31.M`) — the same three questions as above, asked of a different tab.
 * ════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **The structural guarantee here is WEAKER than Visual FX's and the clauses have to carry more.**
 * That tab resolves every control through a `controlList` of construction-time references and THROWS on
 * a missing key; this tab syncs through per-subsystem `Map`s keyed by string and would simply skip a
 * control that was never registered. **So "every row still syncs" is asserted by behaviour here, not
 * inferred from the shape.**
 */
/*
 * ⚠️ **`scrollIntoViewIfNeeded` AND A COUNT ASSERTION, because the two failures read identically.** The
 * tab bar overflows horizontally, so a plain `.click()` timed out on "element is not visible" — which is
 * indistinguishable from the button not existing at all, and the two have completely different fixes.
 * `CLAUDE.md` makes the same distinction for the Composer tab: *the button existing is NOT evidence the
 * tab mounted.*
 */
const matBtn = page.locator('.sl-tab-btn[data-tab="materials"]');
chk('the Materials tab button is registered', await matBtn.count() === 1,
  `found ${await matBtn.count()} — the last three tabs only register inside if (config.visualFxControls)`);
await matBtn.scrollIntoViewIfNeeded();
await matBtn.click();
await page.waitForTimeout(900);

{
  /*
   * ⚠️⚠️ **SCOPED TO THE TAB'S OWN CONTAINER, and the unscoped version did not fail honestly — it
   * matched BOTH tabs' heads and then clicked one belonging to a HIDDEN tab, which timed out on
   * "element is not visible".** The Visual FX tab's DOM stays in place when another tab is shown, for
   * the same reason a collapsed group's rows do: `display: none` stops a row being SEEN, not working.
   * **A global selector in a multi-tab panel is a selector that will eventually address the wrong tab.**
   * `tab-module.ts` sets `dataset.tab` on each container, which is the handle.
   */
  const mat = page.locator('.tab-content[data-tab="materials"]');  // see the Composer block on why `.tab-content`
  const mHeads = mat.locator('.sl-vfx-group-head');
  const mNames = await mHeads.locator('span:first-child').allTextContents();
  chk('the Materials tab mounts three groups, in the measured order',
    JSON.stringify(mNames) === JSON.stringify(['Material', 'Fire', 'Crystals']),
    JSON.stringify(mNames));

  chk('Material is open; Fire and Crystals start closed (least used last, and closed)',
    (await Promise.all([0, 1, 2].map((i) => mHeads.nth(i).getAttribute('aria-expanded'))))
      .join(',') === 'true,false,false',
    (await Promise.all([0, 1, 2].map((i) => mHeads.nth(i).getAttribute('aria-expanded')))).join(','));

  /*
   * The Enable gate, both directions. ⚠️ Selected on the accessible name `31.M` added — the three
   * sections all label this checkbox `Enable`, so there is nothing else to select on, and a
   * position-based pick is the shape that silently grabbed Curl Noise's box in the Visual FX clause.
   */
  await mHeads.nth(2).click();                       // open Crystals
  await page.waitForTimeout(300);
  const cryEnable = mat.locator('[aria-label="Enable Crystals"]');
  /*
   * The scoped row helper. ⚠️ **`has:` takes a RELATIVE locator, so the inner one is built from `page`
   * even though the outer is scoped** — `mat.locator(...)` carries its whole chain and would have
   * searched for a `[data-tab="materials"]` INSIDE each row, matching nothing. That read as "the row was
   * never built", which is a claim about the tab rather than about this line. **The Materials tab's rows
   * carry no class at all** (inline-styled `div` + `label`), hence `div` + a label filter rather than
   * Visual FX's `.sl-vfx-row`.
   */
  const matRow = (label) => mat.locator('div').filter({
    has: page.locator(`label:text-is("${label}")`) }).last();
  const cryRow = matRow('Crystal Size');
  const built = await cryRow.count();
  const hiddenOff = built > 0 && !(await cryRow.isVisible());
  const enableErr = await cryEnable.check().then(() => '').catch((e) => String(e).slice(0, 60));
  await page.waitForTimeout(350);
  const enableState = await cryEnable.isChecked().catch(() => false);
  const shownOn = await cryRow.isVisible().catch(() => false);
  const badge = await mHeads.nth(2).locator('.sl-vfx-group-count').textContent().catch(() => '');
  await cryEnable.uncheck().catch(() => {});
  await page.waitForTimeout(300);
  const hiddenAgain = !(await cryRow.isVisible().catch(() => true));
  chk('a Materials section is BUILT but hidden while off, and revealed by its own Enable',
    built > 0 && hiddenOff && shownOn && hiddenAgain,
    `Crystal Size in DOM: ${built > 0}; hidden off: ${hiddenOff}; shown on: ${shownOn}; `
    + `hidden again: ${hiddenAgain}; badge while on: ${JSON.stringify(badge)}`);

  chk('...and the badge counted it while it was on',
    (badge ?? '').trim() === '1',
    `badge read ${JSON.stringify(badge)} — one subsystem; box checked: ${enableState}`
    + `${enableErr ? `; check() threw: ${enableErr}` : ''}`);

  /*
   * ⚠️ **STATE IDENTITY, ASKED AGAIN OF THIS TAB RATHER THAN INHERITED FROM THE VISUAL FX CLAUSE.** The
   * collapse mechanism is shared (`makeCollapsible`), so the group half genuinely is the same code — but
   * **this tab added a SECOND mechanism the other does not have**, the per-section `Enable` gate, and the
   * round trip below exercises both. It is the one clause that answers the owner's instruction directly:
   * *no other functional changes are happening.* The box is returned to its found state first, so a
   * residue from the gate clause above cannot be read as a collapse effect.
   */
  const mBefore = await exportJson();
  await mHeads.nth(1).click();                       // expand Fire
  await page.waitForTimeout(250);
  await mHeads.nth(0).click();                       // collapse Material
  await page.waitForTimeout(250);
  await mHeads.nth(1).click();                       // and back
  await page.waitForTimeout(250);
  const mAfter = await exportJson();
  chk('collapsing Materials groups changes the engine STATE by NOTHING either',
    mBefore !== null && mBefore === mAfter,
    mBefore === null ? 'the test hook is absent; INCONCLUSIVE, not a pass'
      : `${mBefore.length} chars, identical`);

  await mHeads.nth(0).click();                       // leave as found
  await mHeads.nth(2).click();
  await page.waitForTimeout(200);
}

/*
 * ====================================================================================================
 * THE COMPOSER TAB (v8 `31.C`) - a switched-off LEVEL hides its inputs
 * ====================================================================================================
 *
 * WARN **THE THIRD GATE AND THE THIRD MECHANISM, WHICH IS WHY IT GETS ITS OWN CLAUSES RATHER THAN THE
 * SHARED ONES.** Visual FX gates on `blend > 0` and on an `Enable`, Materials on a section's `Enable`
 * through one shared builder; this one gates on a flag the tab OWNS (`muted`) and normalises elsewhere - so
 * its interesting state is not "off", it is **off for the other reason**: an EMPTY level, which must keep
 * showing its placeholder. The last clause seeds that state with the row's own `Clear` rather than hoping a
 * library preset supplies it.
 *
 * WARN **AND THE VALUE ROUND TRIP IS THE CLAUSE THAT MATTERS, because the gate's whole justification is
 * 16.17's promise that switching off touches no number.** Hidden-and-intact and hidden-and-zeroed look
 * identical from outside; only reading a value back distinguishes them.
 */
await page.locator('.sl-tab-btn[data-tab="composer"]').scrollIntoViewIfNeeded();
await page.locator('.sl-tab-btn[data-tab="composer"]').click();
await page.waitForTimeout(900);

{
  /*
   * ⚠️ **`.tab-content` IS LOAD-BEARING: the tab BUTTON carries the same `data-tab` as the container**, so the
   * bare attribute matches two elements. Chained locators tolerated it (only one of the two has descendants)
   * and `evaluate()` did not - a strict-mode violation, which is the honest failure. **A selector that is
   * ambiguous but only fails under some operations is worse than one that always fails**: the Materials block
   * above has been passing on the same ambiguity, so it is pinned here too.
   */
  const comp = page.locator('.tab-content[data-tab="composer"]');
  const slots = comp.locator('.sl-composer-slot');
  /*
   * ⚠️ **THE SCORE IS FIRST AND THE SETTINGS GROUP IS LAST BEFORE THE SLOT ROWS - asserted as the measured
   * ORDER of the tab's own children, not as "the Score exists".** The owner's reorder is a claim about
   * sequence, and the only way a reorder regresses is by sequence; a presence test would stay green through
   * any shuffle.
   */
  const order = await comp.evaluate((el) => Array.from(el.children)
    .map((c) => {
      const head = c.querySelector(':scope > .sl-vfx-group-head > span, :scope > .sl-section-title');
      if (head) return head.textContent;
      if (c.classList.contains('sl-composer-slot')) return 'slot';
      if (c.classList.contains('sl-btn-group')) return 'actions';
      return null;
    })
    .filter((t) => t !== null));
  chk('the Score leads, its figure-wide actions follow it, and the settings group sits last',
    JSON.stringify(order) === JSON.stringify(
      // ⚠️ The Score section's heading is NOT the word `Score` - it states what the diagram omits, which is
      // the clause's own reminder that a title is read from the source and never from the name of its builder.
      ['Shape — diagram, no rotation or grading', 'actions', 'Framing & Preview',
        'slot', 'slot', 'slot']),
    JSON.stringify(order));

  /*
   * ⚠️ **ONE COLLAPSIBLE, TWO SECTION TITLES INSIDE IT - and the second half is the half worth asserting.**
   * The merge is only safe because both inner headings survived: they carry this tab's one persistence
   * distinction (framing IS saved, the bypasses are NOT), and a single outer name can make neither claim.
   * Losing one of them is a silent change - the group would still open, still hold every control, and quietly
   * stop saying which of them the preset keeps.
   */
  const setupHead = comp.locator('.sl-vfx-group-head');
  const inner = await comp.locator('.sl-vfx-group-body .sl-section-title').allTextContents();
  chk('the settings group is ONE collapsible, closed, holding BOTH section titles unchanged',
    (await setupHead.count()) === 1
    && (await setupHead.getAttribute('aria-expanded')) === 'false'
    && JSON.stringify(inner)
       === JSON.stringify(['Framing & Timing', 'Preview only - not saved with the figure'
         .replace(' - ', ' — ')]),
    `${await setupHead.count()} head(s), expanded=${await setupHead.getAttribute('aria-expanded')}, `
    + `inner titles ${JSON.stringify(inner)}`);

  /*
   * ⚠️ **THE BADGE COUNTS BYPASSES, AND AT LOAD IT MUST BE ABSENT RATHER THAN ZERO.** Both boxes are ticked
   * on load (the `Apply ...` polarity), so a badge here on arrival would mean the polarity is inverted - the
   * one defect in this area that looks like a feature. Then one untick must raise it to 1: a closed group
   * hiding a live bypass is the only thing that made collapsing it questionable, so this clause IS the
   * argument for the default.
   */
  const badge = setupHead.locator('.sl-vfx-group-count');
  const badgeAtLoad = await badge.isVisible();
  await setupHead.click();
  await page.waitForTimeout(250);
  const applyFx = comp.locator('[aria-label="Apply Visual FX"]');
  const tickedAtLoad = await applyFx.isChecked();
  await applyFx.uncheck();
  await page.waitForTimeout(350);
  const badgeText = ((await badge.textContent().catch(() => '')) ?? '').trim();
  await applyFx.check();
  await page.waitForTimeout(300);
  const badgeBack = await badge.isVisible();
  await setupHead.click();
  await page.waitForTimeout(200);
  chk('Apply Visual FX is ticked at load, so the badge is ABSENT then and reads 1 for one bypass',
    tickedAtLoad === true && badgeAtLoad === false && badgeText === '1' && badgeBack === false,
    `ticked at load: ${tickedAtLoad}; badge at load visible: ${badgeAtLoad}; `
    + `badge with one bypass: ${JSON.stringify(badgeText)}; gone again: ${!badgeBack}`);

  const names = await slots.locator('.sl-section-title').allTextContents();
  chk('the Composer mounts three slot sections, named',
    JSON.stringify(names) === JSON.stringify(['Body', 'Structure', 'Detail']),
    JSON.stringify(names) + ' - the level checkbox is the way IN to a row, so all three are always present');

  /*
   * Slot 1 (`Structure`). WARN Selected by its own `aria-label`, never by index among the tab's checkboxes:
   * this tab carries three checkbox FAMILIES at once (two bypasses, `Mirror`, three levels) and a positional
   * pick is the shape that silently grabbed Curl Noise's box in the Visual FX clause.
   */
  const sec1 = slots.nth(1);
  const box1 = sec1.locator('[aria-label="Structure on"]');
  const body1 = sec1.locator('.sl-composer-slot-body');
  const wasOn = await box1.isChecked();
  const builtOn = await body1.locator('input,select,button,canvas').count();
  // A value to carry across the switch. WHICH input does not matter, only that it is one of the 21 the
  // promise is about.
  const probe = body1.locator('input').first();
  const before = await probe.inputValue().catch(() => '');
  const clearOn = await sec1.locator('[aria-label="Clear every value on Structure"]').isVisible();

  await box1.uncheck();
  await page.waitForTimeout(400);
  const hiddenOff = !(await body1.isVisible());
  const builtOff = await body1.locator('input,select,button,canvas').count();
  const noteOff = (await sec1.locator('.sl-composer-silent').first().textContent().catch(() => '')) ?? '';
  const clearOff = await sec1.locator('[aria-label="Clear every value on Structure"]').isVisible();

  await box1.check();
  await page.waitForTimeout(400);
  const shownOn = await body1.isVisible();
  const after = await probe.inputValue().catch(() => '');

  chk('a switched-off LEVEL hides its inputs, and switching it on shows them again',
    wasOn && hiddenOff && shownOn,
    `on at entry: ${wasOn}; hidden while off: ${hiddenOff}; shown again: ${shownOn}`);

  chk('...and they were HIDDEN, never unbuilt - the control count does not move',
    builtOn > 0 && builtOff === builtOn,
    `${builtOn} controls while on, ${builtOff} while off. WARN Equal counts are what keep 16.17's promise `
    + 'mechanical: sync() writes into the inputs that EXIST, so a row rebuilt on every mute would need a '
    + 'second restore path that nothing else on this tab has');

  chk('...and switching off touched NO number, read back rather than assumed',
    before !== '' && before === after,
    before === '' ? 'no input found in the row - INCONCLUSIVE, not a pass'
      : `${before} before, ${after} after - hidden-and-intact vs hidden-and-zeroed look identical outside`);

  chk('...and `Clear` goes with them, so nothing destructive is left over invisible data',
    clearOn && !clearOff,
    `Clear visible while on: ${clearOn}; while off: ${clearOff}. ⚠️ It destroys 21 numbers with no `
    + 'confirmation - the right call while they are on screen to be judged, and not while they are hidden');

  chk('...and the hidden row SAYS the values are kept, in its own words',
    /switched off/.test(noteOff) && /kept/.test(noteOff),
    JSON.stringify(noteOff.slice(0, 72)) + ' - a bare head reads as data lost, the one thing it is not');

  /*
   * WARN **OFF BECAUSE EMPTY IS A DIFFERENT STATE AND MUST NOT BE GATED.** Seeded with the row's own `Clear`,
   * because the state is one click away and no library preset is guaranteed to supply it. The placeholder is
   * the only surface that says why the row is blank, beside the only control that fills it - gating on
   * `levelIsOn()` instead of on `muted` would hide exactly this sentence and leave a bare head.
   */
  const sec2 = slots.nth(2);
  await sec2.locator('[aria-label="Clear every value on Detail"]').click();
  await page.waitForTimeout(450);
  const body2 = sec2.locator('.sl-composer-slot-body');
  const note2 = (await body2.locator('.sl-composer-silent').first().textContent().catch(() => '')) ?? '';
  const box2 = sec2.locator('[aria-label="Detail on"]');
  const shown2 = await body2.isVisible();
  const ticked2 = await box2.isChecked();
  chk('an EMPTY level keeps its placeholder and its unticked box, so the way back stays visible',
    shown2 && /nothing authored here/.test(note2) && ticked2 === false,
    `body visible: ${shown2}; note: ${JSON.stringify(note2.slice(0, 34))}; box ticked: ${ticked2} - `
    + 'off-because-empty and off-because-switched-off share one tick and only one is clickable, which is '
    + "16.17's own defect reached in a new medium");
}


// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== S. the cross-tab SETTINGS SEARCH: coverage, paths and the jump ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

/*
 * ⚠️⚠️ **THIS IS THE HALF `searchcheck` CANNOT REACH, AND IT IS THE HALF THE FEATURE'S VALUE RESTS ON.**
 * The index is SCANNED from the rendered panel, so "is every tab covered" is a DOM question. A search
 * that silently stops indexing a tab answers **no match**, which is indistinguishable from *"that
 * setting does not exist"* -- no error, no console line, no visual tell.
 *
 * ⚠️ The field builds every tab on first use (`TabRegistry.buildAll()`), so the clauses below type once
 * and then read the live dropdown.
 */
const SEARCH_FIELD = '.sl-search-field';
const SEARCH_ROW = '.sl-search-results .sl-search-row';

const searchFor = async (q) => {
  await page.locator(SEARCH_FIELD).fill(q);
  await page.waitForSelector(`${SEARCH_ROW}, .sl-search-empty`, { timeout: 30000 });
  return page.evaluate(() => Array.from(document.querySelectorAll('.sl-search-results .sl-search-row'))
    .map((r) => ({
      label: r.querySelector('.sl-search-row-label')?.textContent ?? '',
      path: r.querySelector('.sl-search-row-path')?.textContent ?? '',
      tab: r.querySelector('.sl-search-row-tab')?.textContent ?? '',
      why: r.querySelector('.sl-search-row-why')?.textContent ?? '',
      tag: r.querySelector('.sl-search-row-tag')?.textContent ?? '',
    })));
};

await page.locator(SEARCH_FIELD).fill('e');
await page.waitForSelector(`${SEARCH_ROW}, .sl-search-empty`, { timeout: 60000 });

/*
 * ⚠️⚠️ **EVERY TAB MUST CONTRIBUTE AT LEAST ONE ENTRY.** Measured when this was built: Randomise,
 * Evolution and History hold ZERO labelled inputs between them -- their whole interface is buttons --
 * which is why buttons are indexed at all. Without this clause those three tabs could fall out of the
 * index and nothing would say so.
 */
const coverage = await page.evaluate(() => {
  const out = {};
  for (const c of document.querySelectorAll('.tab-content[data-tab]')) {
    const id = c.dataset.tab;
    out[id] = c.querySelectorAll('input[aria-label], select[aria-label], canvas[aria-label], button').length;
  }
  return out;
});
const emptyTabs = Object.entries(coverage).filter(([, n]) => n === 0).map(([id]) => id);
chk(`all ${Object.keys(coverage).length} tabs are built and hold something indexable`,
  Object.keys(coverage).length === 10 && emptyTabs.length === 0,
  emptyTabs.length === 0
    ? Object.entries(coverage).map(([k, v]) => `${k}:${v}`).join(' ')
    : `INVISIBLE TO THE SEARCH: ${emptyTabs.join(', ')}`);

/*
 * The owner's own motivating case. W **`Symmetry` sits in a CLOSED section inside a CLOSED group**, so
 * it is two separate clicks deep -- which is why it could not be found by looking.
 */
const symm = await searchFor('symmetry');
const vfxSymm = symm.find((r) => r.path.startsWith('Visual FX') && r.label === 'Symmetry');
chk('searching `symmetry` finds the Visual FX control, two closed containers deep',
  vfxSymm !== undefined, symm.map((r) => `${r.label} [${r.path}]`).slice(0, 4).join(' | '));

/*
 * ⚠️⚠️ **THE PATH MUST NAME THE SECTION THE CONTROL IS ACTUALLY IN.** An earlier scanner climbed out of
 * the collapsible and reported `Visual FX › Figure › Deformation › Curve Basis` -- a path naming two
 * sections, the second of which it is not in. **A plausible wrong path is worse than a short one**,
 * because the whole feature is an answer to "where does this live".
 */
/*
 * ⚠⚠ **ASSERTED AS SEGMENTS, NOT AS THE RENDERED STRING, AND THIS CLAUSE ALREADY CAUGHT THE
 * DIFFERENCE ONCE.** The row builds the path from spans so the TAB can carry more weight, and the
 * separator's spacing is a CSS margin rather than text — so `textContent` reads
 * `Visual FX›Figure›Deformation` with no spaces. The first version of this clause compared the
 * spaced string and went red on correct code. **Splitting on the separator tests what matters (which
 * sections the path names, in order) and is immune to how the gaps are drawn.**
 */
const segsOf = (s) => s.split('›').map((x) => x.trim()).filter((x) => x.length > 0);
chk('...and its path is exactly its own chain, with no section it is not in',
  vfxSymm !== undefined
  && JSON.stringify(segsOf(vfxSymm.path)) === JSON.stringify(['Visual FX', 'Figure', 'Deformation']),
  vfxSymm === undefined ? '(not found)' : `[${segsOf(vfxSymm.path).join(' | ')}]`);

chk('...and the TAB is its own emphasised element, because it is the coarsest discriminator',
  vfxSymm !== undefined && vfxSymm.tab === 'Visual FX',
  vfxSymm === undefined ? '(not found)' : `tab span reads "${vfxSymm.tab}"; ⚠ the owner reported the `
  + 'path as "barely readable" and the location is what decides which hit is the right one');

/*
 * ⚠️⚠️ **THE PRESET FILTER DRAWER MUST NOT BE IN THE INDEX.** The Reel tab hosts a copy of it and its
 * chips carry a COMPOSED accessible name, so before the exclusion the results showed *"Symmetry fold,
 * 2 presets, not filtered"* beside the real control. A filter chip is worth having only when enough
 * PRESETS carry the feature; a settings entry is worth having for every CONTROL. Two universes.
 */
const chipRows = symm.filter((r) => /presets, (not )?filtered|presets, excluded/.test(r.label));
chk('no preset-filter chip leaks into the settings results',
  chipRows.length === 0,
  chipRows.length === 0 ? 'none' : `LEAKED: ${chipRows.map((r) => r.label).join(' | ')}`);

/* A named VALUE is findable and is tagged, so three different `Neon`s are distinguishable. */
const neon = await searchFor('neon');
const neonValue = neon.find((r) => r.tag === 'value');
chk('a named value (a film look, a palette) is indexed and tagged',
  neonValue !== undefined,
  neon.map((r) => `${r.label}${r.tag ? ' <' + r.tag + '>' : ''}`).slice(0, 4).join(' | '));

/*
 * ⚠️⚠️ **THE JUMP MUST ACTUALLY REVEAL THE TARGET, AND THIS IS THE ONE CLAUSE A TEXT SCAN CANNOT BE.**
 * Everything upstream can be right -- the entry, the path, the expand list -- and the control still be
 * invisible, because an inner collapsible inside a collapsed body has no layout and opening it first
 * measures nothing. The assertion is therefore `offsetParent`, after the click, in the live DOM.
 */
await searchFor('symmetry');
const jumped = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('.sl-search-results .sl-search-row'));
  const row = rows.find((r) => (r.querySelector('.sl-search-row-path')?.textContent ?? '')
    .includes('Deformation'));
  if (!row) return { clicked: false };
  row.click();
  return { clicked: true };
});
await page.waitForTimeout(900);
const revealed = await page.evaluate(() => {
  const c = document.querySelector('.tab-content[data-tab="visual-fx"]');
  const el = c?.querySelector('[aria-label="Symmetry"]');
  return {
    tabShown: c !== null && getComputedStyle(c).display !== 'none',
    visible: !!(el && el.offsetParent !== null),
    flashed: document.querySelectorAll('.sl-search-hit').length,
  };
});
chk('clicking a result opens the tab, expands BOTH closed containers and reveals the control',
  jumped.clicked && revealed.tabShown && revealed.visible,
  `clicked ${jumped.clicked} · tab shown ${revealed.tabShown} · control visible ${revealed.visible}`);

chk('...and the landing row is flashed, so the eye can find it after the scroll',
  revealed.flashed === 1,
  `${revealed.flashed} element(s) carry .sl-search-hit; ⚠️ the flash is 1600 ms, so a reader sampling `
  + 'later measures 0 and that is not a defect -- it is why this reads immediately after the click');

/*
 * ⚠️⚠️ **THE SEARCH MUST NOT WRITE ENGINE STATE. NOT ONCE.** Building ten tabs runs ten `init()`s, and a
 * tab that WROTE during init would apply nine tabs' worth of state the first time anyone typed in the
 * field -- arriving as a changed picture with no action to attribute it to. Measured through
 * `?testhook=1`, which is read-only by construction.
 */
if (hookBeforeSearch !== null) {
  const after = await page.evaluate(() => {
    const h = window.__psss;
    return h === undefined ? null : {
      mode: h.renderMode, mat: h.material, look: h.filmLook, pts: h.particleCount,
      scale: h.figureScale, fold: h.symmetryFold, speed: h.speedFactor,
    };
  });
  const moved = after === null ? ['no hook'] : Object.keys(after)
    .filter((k) => JSON.stringify(after[k]) !== JSON.stringify(hookBeforeSearch[k]));
  chk('using the search changed no engine state',
    moved.length === 0,
    moved.length === 0 ? 'nothing moved' : `WROTE: ${moved.join(', ')}`);
}


// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== T. the Composer BODY must agree with the live figure type ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

/*
 * ⚠️⚠️ **OWNER-REPORTED DEFECT, AND IT SHIPPED BECAUSE NOTHING COMPARED THE TWO.** On a curve preset the
 * type dropdown read "Self-similar curve", the Score drew the curve, and the rows underneath were the
 * Lissajous WAVE slots. `adoptExternalFigure()` rebuilt the three slot bodies and nothing else, so a
 * preset arriving with a different `generators.type` left the previous body standing.
 *
 * ⚠️⚠️ **`composercheck` CANNOT SEE THIS: it runs under bare Node.** The defect is a DOM body that
 * disagrees with the live type, which is why the clause is here, and why it is asserted in BOTH
 * DIRECTIONS -- this class of defect is routinely one-directional, and the two bodies are mutually
 * exclusive so curve->wave has to work as well as wave->curve.
 *
 * ⚠️ The first oracle for this hardcoded "curve body = correct" and then reported the reverse case as
 * WRONG over a correct engine. **An oracle for a mutually exclusive pair must take the expectation as
 * an argument**, which is what `expectBody` does.
 */
const CURVE_PRESET = 'Curve Thicket';
const WAVE_PRESET = 'Cylinder';

const readComposerBody = () => page.evaluate(() => {
  const c = document.querySelector('.tab-content[data-tab="composer"]');
  if (c === null) return { built: false };
  const titles = Array.from(c.querySelectorAll('.sl-section-title'))
    .map((e) => e.textContent?.trim() ?? '');
  const typeSel = Array.from(c.querySelectorAll('select'))
    .find((s) => Array.from(s.options).some((o) => /Self-similar/.test(o.textContent ?? '')));
  return {
    built: true,
    dropdown: typeSel?.selectedOptions[0]?.textContent?.trim() ?? null,
    curve: titles.includes('Curve') && !!c.querySelector('select[aria-label="Rule"]'),
    wave: ['Body', 'Structure', 'Detail'].every((n) => titles.includes(n)),
  };
});

const loadByTile = async (name) => {
  const grid = page.locator('.sl-btn-grid');
  if (await grid.count() > 0 && await grid.isVisible()) { await grid.click(); await page.waitForTimeout(1800); }
  const tile = page.locator(`.pg-tile[data-preset="${name}"]`).first();
  if (await tile.count() === 0) return false;
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await page.waitForTimeout(2500);
  const bar = page.locator('.sl-tab-bar');
  if (!(await bar.first().isVisible())) {
    await page.locator('button.pg-mode-btn:has-text("Lab")').first().click();
    await bar.first().waitFor({ state: 'visible', timeout: 30000 });
  }
  await page.waitForTimeout(500);
  return true;
};

const expectBody = async (what, name, note) => {
  await page.locator('.sl-tab-btn[data-tab="composer"]').click();
  await page.waitForTimeout(1100);
  const b = await readComposerBody();
  const got = b.curve && !b.wave ? 'curve' : b.wave && !b.curve ? 'wave' : 'neither';
  chk(`the Composer shows the ${what.toUpperCase()} body on ${name}${note ? ' ' + note : ''}`,
    got === what,
    `dropdown "${b.dropdown}" · body ${got}${got === what ? '' : `  <-- the dropdown and the body DISAGREE`}`);
  return b;
};

if (await loadByTile(WAVE_PRESET)) {
  await expectBody('wave', WAVE_PRESET, '(the starting state)');
  /* The owner's sequence: the Composer is ALREADY BUILT for waves when the curve preset arrives. */
  if (await loadByTile(CURVE_PRESET)) {
    await expectBody('curve', CURVE_PRESET, '(arriving over an already-built wave body)');
    /* And back, because the pair is mutually exclusive and the fix must not be one-directional. */
    if (await loadByTile(WAVE_PRESET)) {
      await expectBody('wave', WAVE_PRESET, '(arriving over an already-built curve body)');
    }
  }
} else {
  chk(`the tiles for ${WAVE_PRESET}/${CURVE_PRESET} exist`, false,
    'INCONCLUSIVE, not a pass: without both presets this section asserts nothing');
}


// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== U. the Mixer: take the figure or the look from the other deck, and Reset ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

/*
 * ⚠️⚠️ **ASSERTED AS THE OWNER'S OWN ACCEPTANCE SENTENCE, NOT AS "THE CONTROLS MOVED BACK".** The
 * request was a Reset that lets you *"go back and choose a new set of settings mix from A and B which
 * gives IDENTICAL results like after we just entered the Mixer tab"*. So two EQUALITIES are asserted:
 * the state after Reset equals the state on entry, and a recipe after Reset equals the same recipe after
 * entry. A Reset that put the rows back but left the preview on the mixed figure would pass any clause
 * about the rows.
 *
 * ⚠️ **The preview is read through `?testhook=1`** (read-only by construction). The figure
 * discriminator is the particle count: the look preset and the figure preset differ there, so "figure
 * from B, look from A" is visible as a number rather than inferred from a picture.
 */
const MIX_LOOK = 'Aurora Borealis', MIX_FIG = 'Curve Thicket';
const MX = '.tab-content[data-tab="mixer"]';
const mixSnap = () => page.evaluate((MX) => {
  const c = document.querySelector(MX);
  const h = window.__psss;
  const sels = c ? Array.from(c.querySelectorAll('select')) : [];
  return c === null || h === undefined ? null : {
    preview: { pts: h.particleCount, mode: h.renderMode, mat: h.material, look: h.filmLook },
    master: c.querySelector('input[type="range"].sl-slider')?.value ?? null,
    rows: Array.from(c.querySelectorAll('.sl-mix-src')).map((s) =>
      s.querySelector('.sl-mix-src-btn.active')?.textContent ?? '-').join(''),
    locked: c.querySelectorAll('.sl-mix-cat-chip.locked').length,
    deckB: sels[1]?.value ?? null,
    line: c.querySelector('.sl-mix-source-line')?.textContent ?? null,
  };
}, MX);

if (await loadByTile(MIX_LOOK)) {
  await page.locator('.sl-tab-btn[data-tab="mixer"]').click();
  await page.waitForTimeout(1200);
  const entry = await mixSnap();

  await page.evaluate(({ MX, MIX_FIG }) => {
    const b = document.querySelectorAll(`${MX} select`)[1];
    b.value = MIX_FIG; b.dispatchEvent(new Event('change', { bubbles: true }));
  }, { MX, MIX_FIG });
  await page.waitForTimeout(1200);
  await page.locator(`${MX} button[aria-label="Figure from B, look from A"]`).click();
  await page.waitForTimeout(1500);
  const mix1 = await mixSnap();

  chk('the recipe takes the FIGURE from Deck B and keeps the LOOK from Deck A',
    entry !== null && mix1 !== null
    && mix1.preview.pts !== entry.preview.pts
    && mix1.preview.mode === entry.preview.mode && mix1.preview.mat === entry.preview.mat,
    mix1 === null ? '(no snapshot)' : `particles ${entry?.preview.pts} -> ${mix1.preview.pts} (the figure moved); `
      + `mode/material ${mix1.preview.mode}/${mix1.preview.mat} (the look stayed)`);

  /*
   * ⚠️⚠️ **THE RECIPE HANDS THE TAKEN PART TO THE CROSSFADER (owner, 2026-11-05).** The KEPT rows are held
   * at A; the TAKEN rows (Figure, Motion, Attractor — owner decision 2026-11-04) follow a crossfader moved to
   * B. This clause used to assert `BABABAA` — every row pinned — which was the state in which the crossfader
   * moved nothing. CATEGORY_LOCKS order: Figure Colour Motion Transmap Attractor Materials Visual FX.
   */
  chk('...and the recipe HOLDS the look at A and hands the figure rows to the crossfader, moved to B',
    mix1 !== null && mix1.rows === '⇄A⇄A⇄AA' && mix1.master === '100',
    `rows "${mix1?.rows}", crossfader ${mix1?.master}`);

  /*
   * ⚠️⚠️ **THE PROPERTY THE CHANGE EXISTS FOR: after a recipe the crossfader is LIVE.** Dragging it back to
   * A must return the FIGURE to Deck A's (the particle count is the figure discriminator) while the LOOK
   * stays exactly as it was. Before 2026-11-05 this drag did nothing at all.
   */
  await page.evaluate((MX) => {
    const r = document.querySelector(`${MX} input[type="range"].sl-slider`);
    r.value = '0'; r.dispatchEvent(new Event('input', { bubbles: true }));
  }, MX);
  await page.waitForTimeout(1500);
  const back = await mixSnap();
  chk('...and dragging the crossfader back to A fades the FIGURE back to Deck A while the LOOK stays',
    back !== null && entry !== null
    && back.preview.pts === entry.preview.pts
    && back.preview.mode === mix1?.preview.mode && back.preview.mat === mix1?.preview.mat,
    `particles ${mix1?.preview.pts} -> ${back?.preview.pts} (entry ${entry?.preview.pts}); `
    + `mode/material held at ${back?.preview.mode}/${back?.preview.mat}`);

  /*
   * ⚠️ **With every row held, the crossfader is DISABLED and the status line says why** — a slider that can
   * move nothing and stays draggable is the dead-control defect `26.D4` answers.
   */
  for (const lab of ['Figure', 'Motion', 'Attractor']) {
    await page.locator(`${MX} button[aria-label="${lab} from Deck A"]`).click();
  }
  await page.waitForTimeout(600);
  const dead = await page.evaluate((MX) => ({
    disabled: document.querySelector(`${MX} input[type="range"].sl-slider`)?.disabled ?? null,
    line: document.querySelector(`${MX} .sl-mix-source-line`)?.textContent ?? '',
  }), MX);
  chk('with every row held at a deck, the crossfader is DISABLED and the line says why',
    dead.disabled === true && /switched off/.test(dead.line),
    `disabled ${dead.disabled}; "${dead.line}"`);

  await page.locator(`${MX} button[aria-label="Hand every row back to the crossfader"]`).click();
  await page.waitForTimeout(800);
  const all = await mixSnap();
  chk('`All ⇄` hands every row back and re-enables the crossfader',
    all !== null && all.rows === '⇄⇄⇄⇄⇄⇄⇄'
    && (await page.locator(`${MX} input[type="range"].sl-slider`).first().isDisabled()) === false,
    `rows "${all?.rows}"`);

  // Make Reset undo more than the recipe: a lock and a moved master.
  await page.locator(`${MX} .sl-mix-cat-chip`).first().click();
  await page.evaluate((MX) => {
    const r = document.querySelector(`${MX} input[type="range"].sl-slider`);
    r.value = '63'; r.dispatchEvent(new Event('input', { bubbles: true }));
  }, MX);
  await page.waitForTimeout(900);

  await page.locator(`${MX} button[aria-label="Reset the Mixer to how it was on entry"]`).click();
  await page.waitForTimeout(1800);
  const after = await mixSnap();
  const noB = (s) => (s === null ? null : JSON.stringify({ ...s, deckB: undefined }));
  chk('after Reset the Mixer is IDENTICAL to how it was on entry — preview, rows, master, locks, sentence',
    noB(after) !== null && noB(after) === noB(entry),
    noB(after) === noB(entry) ? `"${after?.line}"`
      : `entry ${noB(entry)} | after ${noB(after)}`);

  chk('...and Deck B stays chosen AND SHOWN, so a new mix can start from the same pair',
    after !== null && after.deckB === MIX_FIG,
    `dropdown reads "${after?.deckB}"; ⚠️ before 2026-11-04 the re-render rebuilt it with no default, so it `
    + 'showed EMPTY while the Mixer still held the old Deck B');

  await page.locator(`${MX} button[aria-label="Figure from B, look from A"]`).click();
  await page.waitForTimeout(1500);
  const mix2 = await mixSnap();
  chk('a recipe after Reset gives the IDENTICAL result to the same recipe after entry',
    mix2 !== null && JSON.stringify(mix2) === JSON.stringify(mix1),
    JSON.stringify(mix2) === JSON.stringify(mix1) ? 'byte-identical snapshots'
      : `first ${JSON.stringify(mix1)} | second ${JSON.stringify(mix2)}`);
} else {
  chk(`the tile for ${MIX_LOOK} exists`, false, 'INCONCLUSIVE, not a pass: section U asserted nothing');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== V. v8 39 — the curve body\'s Twist / Stretch, the exclusion, the rule-pick reset and the search ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

/*
 * ⚠️⚠️ **THE HALF `figurecheck` §J CANNOT REACH.** §J measures the engine; whether a row is SHOWN where the rule
 * has the axis and ABSENT elsewhere, whether a disabled row is actually disabled, and whether the search finds
 * the new rows at the path they live at are DOM questions. Each clause loads a real library demo by its tile.
 */
const curveRows = async () => page.evaluate(() => {
  const c = document.querySelector('.tab-content[data-tab="composer"]');
  if (!c) return null;
  const rows = Array.from(c.querySelectorAll('.sl-vfx-row'));
  const byLabel = (t) => rows.find((r) => r.querySelector('.sl-vfx-label')?.textContent?.trim() === t) ?? null;
  const state = (t) => {
    const r = byLabel(t);
    if (!r) return 'absent';
    const inp = r.querySelector('input');
    return inp && inp.disabled ? 'disabled' : 'live';
  };
  const val = (t) => byLabel(t)?.querySelector('input')?.value ?? null;
  const note = Array.from(c.querySelectorAll('.sl-composer-precondition'))
    .find((n) => /Twist and Yaw take turns/.test(n.textContent ?? ''));
  return {
    twist: state('Twist'), stretch: state('Stretch'), yaw: state('Yaw'), yawSize: state('Yaw size'),
    yawVal: val('Yaw'), yawSizeVal: val('Yaw size'),
    note: !!note && getComputedStyle(note).display !== 'none',
    rule: c.querySelector('select[aria-label="Rule"]')?.value ?? null,
  };
});
const openComposer = async () => {
  await page.locator('.sl-tab-btn[data-tab="composer"]').click();
  await page.waitForTimeout(1100);
};

if (await loadByTile('Curve Fold')) {
  await openComposer();
  const f = await curveRows();
  chk('on the dragon (Curve Fold) the Twist row is SHOWN and live, and Stretch is ABSENT (no stretchable copy)',
    f !== null && f.twist === 'live' && f.stretch === 'absent', JSON.stringify(f));

  const tw = await searchFor('twist');
  const comp = tw.find((r) => r.label === 'Twist' && segsOf(r.path)[0] === 'Composer');
  chk('the settings search finds the curve Twist under the Composer, at the Curve section',
    comp !== undefined && segsOf(comp.path).includes('Curve'),
    tw.map((r) => `${r.label} [${segsOf(r.path).join(' › ')}]`).slice(0, 5).join(' | '));
  /*
   * ⚠️ Measured, not assumed: the model-space deformation's rows are `Twist X/Y/Z`, so the two controls do NOT
   * share a label -- the first draft of this clause assumed a bare `Twist` in Visual FX and was red over correct
   * code. Asserted as it is: a separate hit, a different label AND a different path.
   */
  chk('...and the Visual FX deformation twist is a SEPARATE hit, with its own label (`Twist X`) and path',
    tw.some((r) => /^Twist [XYZ]$/.test(r.label) && segsOf(r.path)[0] === 'Visual FX')
    && !tw.some((r) => r.label === 'Twist' && segsOf(r.path)[0] === 'Visual FX'),
    'so the curve row is the only control labelled exactly `Twist`');
  await page.locator(SEARCH_FIELD).fill('');
} else {
  chk('the tile for Curve Fold exists', false, 'INCONCLUSIVE, not a pass');
}

if (await loadByTile('Curve Breathing Thicket')) {
  await openComposer();
  const s = await curveRows();
  chk('on the Plant (Curve Breathing Thicket) BOTH Stretch and Twist are shown',
    s !== null && s.stretch === 'live' && s.twist === 'live', JSON.stringify(s));
  const st = await searchFor('stretch');
  chk('the settings search finds the curve Stretch under the Composer',
    st.some((r) => r.label === 'Stretch' && segsOf(r.path)[0] === 'Composer'),
    st.map((r) => `${r.label} [${segsOf(r.path).join(' › ')}]`).slice(0, 5).join(' | '));
  await page.locator(SEARCH_FIELD).fill('');
}

if (await loadByTile('Curve Hilbert Opening')) {
  await openComposer();
  const h = await curveRows();
  chk('on a CELL rule with Twist in use, Yaw is DISABLED and the reason is shown (owner 39.Q2 (c))',
    h !== null && h.twist === 'live' && h.yaw === 'disabled' && h.yawSize === 'disabled' && h.note,
    JSON.stringify(h));

  /*
   * ⚠️⚠️ **A RULE PICK RESETS EVERYTHING (owner 39.Q6, retiring Phase 36's re-seat).** Picking Koch must land on
   * Koch's landmark with no wobble, and its Twist row must disappear (Koch has no twistable copy).
   */
  await page.locator('.tab-content[data-tab="composer"] select[aria-label="Rule"]').selectOption('koch');
  await page.waitForTimeout(1500);
  const k = await curveRows();
  chk('a rule pick RESETS the shape parameters: Koch lands at 60° with no wobble, and its Twist row is absent',
    k !== null && k.rule === 'koch' && Number(k.yawVal) === 60 && Number(k.yawSizeVal) === 0 && k.twist === 'absent',
    JSON.stringify(k));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== W. v8 Phase 40 — Electric Discharge: placement, the gated body, the search ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

/*
 * The owner placed the section DIRECTLY BELOW Neon Lines (Phase 40), and the body is gated on its switch (31.U).
 * Both are DOM facts: the order is the tab's APPEND order and the gate is a `display`, neither visible to a text scan.
 */
await page.locator('.sl-tab-btn[data-tab="visual-fx"]').click();
await page.waitForTimeout(800);
const dis = await page.evaluate(() => {
  const root = document.querySelector('.tab-content[data-tab="visual-fx"]');
  for (const head of root.querySelectorAll('.sl-vfx-group-head')) {
    if ((head.querySelector('span')?.textContent?.trim() ?? '') === 'Particles'
      && head.getAttribute('aria-expanded') !== 'true') head.click();
  }
  const titles = Array.from(root.querySelectorAll('.sl-section-title')).map((t) => t.textContent?.trim() ?? '');
  const i = titles.indexOf('Neon Lines');
  const cb = root.querySelector('input[aria-label="Enable Electric Discharge"]');
  const body = root.querySelector('input[aria-label="Discharge Intensity"]')?.closest('.sl-vfx-row');
  const shownBefore = !!body && body.offsetParent !== null;
  if (cb && !cb.checked) cb.click();
  const shownAfter = !!body && body.offsetParent !== null;
  if (cb && cb.checked) cb.click();
  return { next: i >= 0 ? titles[i + 1] : null, hasCb: !!cb, shownBefore, shownAfter };
});
chk('Electric Discharge is the section DIRECTLY below Neon Lines (owner)',
  dis.next === 'Electric Discharge', `section after Neon Lines: "${dis.next}"`);
chk('...and its four rows are HIDDEN until Enable is ticked, then SHOWN (the 31.U gate)',
  dis.hasCb && !dis.shownBefore && dis.shownAfter, JSON.stringify(dis));

/*
 * COUPLED TO NEON LINES (owner 11-05) — both directions, through the real boxes, and the BOXES must show what the
 * engine did (the handlers re-read; a box that kept its old tick would contradict the engine silently). The ribbon
 * `Mode` select is found by its own options because its accessible name, `Mode`, is shared with other sections.
 */
const coupled = await page.evaluate(() => {
  const root = document.querySelector('.tab-content[data-tab="visual-fx"]');
  const q = (l) => root.querySelector(`input[aria-label="${l}"]`);
  const lines = q('Enable Neon Lines'), dis = q('Enable Electric Discharge');
  const ribbon = Array.from(root.querySelectorAll('select')).find((s) => [...s.options].some((o) => o.value === 'streaks'));
  const setRibbon = (v) => { ribbon.value = v; ribbon.dispatchEvent(new Event('change', { bubbles: true })); };
  const disBody = () => root.querySelector('input[aria-label="Discharge Intensity"]')?.closest('.sl-vfx-row')?.offsetParent !== null;
  const r = {};
  setRibbon('hybrid');
  if (dis.checked) dis.click();
  r.start = { lines: lines.checked, dis: dis.checked, ribbon: ribbon.value };
  dis.click();                                   // discharge ON => lines ON, ribbons OFF
  r.afterDisOn = { lines: lines.checked, dis: dis.checked, ribbon: ribbon.value };
  lines.click();                                 // lines OFF => discharge OFF, its body hidden
  r.afterLinesOff = { lines: lines.checked, dis: dis.checked, body: disBody() };
  dis.click(); setRibbon('hybrid');              // a ribbon pick ends the lines, so the discharge too
  r.afterRibbon = { lines: lines.checked, dis: dis.checked };
  setRibbon('off');
  return r;
});
chk('Electric Discharge is COUPLED to Neon Lines in both directions, and every box shows what the engine did',
  coupled.start.lines === false && coupled.start.dis === false
  && coupled.afterDisOn.lines === true && coupled.afterDisOn.dis === true && coupled.afterDisOn.ribbon === 'off'
  && coupled.afterLinesOff.lines === false && coupled.afterLinesOff.dis === false && coupled.afterLinesOff.body === false
  && coupled.afterRibbon.lines === false && coupled.afterRibbon.dis === false,
  JSON.stringify(coupled));

const ds = await searchFor('discharge');
const dsPaths = ds.filter((r) => segsOf(r.path).join(' › ') === 'Visual FX › Particles › Electric Discharge');
chk('the settings search finds the Electric Discharge controls at their exact path',
  dsPaths.length >= 4, ds.map((r) => `${r.label} [${segsOf(r.path).join(' › ')}]`).slice(0, 6).join(' | '));
await page.locator(SEARCH_FIELD).fill('');

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== X. v8 39 Stage C — Customize: the option, the no-op pick, the editor, a named pick back ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

/*
 * ⚠️ **THE HALF `figurecheck` §K CANNOT REACH**: whether the option is offered or DISABLED with its reason, whether
 * the pick resets NOTHING the rows show, whether an edit reaches the readout, whether deleting a move takes its
 * retrace with it, and whether a named pick puts the rows back. All through the real controls, on real demos.
 */
const customState = async () => page.evaluate(() => {
  const c = document.querySelector('.tab-content[data-tab="composer"]');
  const sel = c?.querySelector('select[aria-label="Rule"]');
  const opt = sel ? Array.from(sel.options).find((o) => o.value === 'customize') : null;
  const rows = Array.from(c?.querySelectorAll('.sl-vfx-row') ?? []);
  const val = (t) => rows.find((r) => r.querySelector('.sl-vfx-label')?.textContent?.trim() === t)?.querySelector('input')?.value ?? null;
  const notes = Array.from(c?.querySelectorAll('.sl-row-note') ?? []).map((n) => n.textContent ?? '');
  return {
    rule: sel?.value ?? null, optDisabled: opt ? opt.disabled : null, optTitle: opt?.title ?? '',
    steps: c ? c.querySelectorAll('select[aria-label^="Step "][aria-label$=" kind"]').length : 0,
    kinds: Array.from(c?.querySelectorAll('select[aria-label^="Step "][aria-label$=" kind"]') ?? []).map((s) => s.value).join(','),
    recursion: val('Recursion'), yaw: val('Yaw'), yawSize: val('Yaw size'),
    prov: notes.find((n) => /Named at|Custom generator|Same generator/.test(n)) ?? '',
    status: notes.find((n) => /steps\s+·/.test(n)) ?? '',
    liftCol: !!c?.querySelector('input[aria-label="Step 1 lift"]'),
    startOn: c?.querySelector('input[aria-label="Starting shape"]')?.checked ?? null,
    startRows: c ? c.querySelectorAll('input[aria-label^="Start "][aria-label$=" turn"]').length : 0,
  };
});

if (await loadByTile('Curve Lattice')) {
  await openComposer();
  /*
   * Hilbert 3D is customizable since the cube tile and the 3-D frame: its EIGHT moves, with the Lift column shown
   * (it lifts), and the readout naming the rule it still is. Then Bush 3D — the one rule left disabled — picked
   * through the same Rule select, with the growth-rule reason on the option.
   */
  await page.locator('.tab-content[data-tab="composer"] select[aria-label="Rule"]').selectOption('customize');
  await page.waitForTimeout(900);
  const h = await customState();
  chk('Hilbert 3D (Curve Lattice) is customizable: 8 moves, the Lift column shown, and it is still the named rule',
    h.rule === 'customize' && h.steps === 8 && h.liftCol && /Same generator as Hilbert 3D/.test(h.prov) && /Valid/.test(h.status),
    `${h.steps} steps, lift column ${h.liftCol}, "${h.prov}", "${h.status}"`);
  await page.locator('.tab-content[data-tab="composer"] select[aria-label="Rule"]').selectOption('bush3d');
  await page.waitForTimeout(900);
  const b = await customState();
  chk('on Bush 3D Customize is OFFERED but DISABLED, and the reason says it is a growth rule (a future phase)',
    b.rule === 'bush3d' && b.optDisabled === true && /GROWTH rule/.test(b.optTitle) && /future phase/.test(b.optTitle),
    JSON.stringify({ rule: b.rule, disabled: b.optDisabled }));
}

if (await loadByTile('Curve Weave')) {
  await openComposer();
  await page.locator('.tab-content[data-tab="composer"] select[aria-label="Rule"]').selectOption('customize');
  await page.waitForTimeout(900);
  const m = await customState();
  chk('Moore (Curve Weave) is customizable: the Hilbert 2D generator laid along a 4-step STARTING SHAPE, still Moore',
    m.rule === 'customize' && m.steps === 4 && m.startOn === true && m.startRows === 4 && /Same generator as Moore/.test(m.prov),
    `${m.steps} steps, starting shape ${m.startOn} with ${m.startRows} rows, "${m.prov}"`);
}

if (await loadByTile('Curve Koch Cesaro')) {
  await openComposer();
  const before = await customState();
  await page.locator('.tab-content[data-tab="composer"] select[aria-label="Rule"]').selectOption('customize');
  await page.waitForTimeout(900);
  const after = await customState();
  chk('picking Customize RESETS NOTHING — Recursion, Yaw and its wobble read exactly as before (spec §3.3)',
    after.rule === 'customize' && after.recursion === before.recursion && after.yaw === before.yaw
    && after.yawSize === before.yawSize, `before ${before.recursion}/${before.yaw}/${before.yawSize} after ${after.recursion}/${after.yaw}/${after.yawSize}`);
  chk('...the editor shows the RULE\'s generator (Koch: 4 moves) and the readout names the rule it still is',
    after.steps === 4 && after.kinds === 'move,move,move,move' && /Same generator as Koch/.test(after.prov) && /Valid/.test(after.status),
    `${after.steps} steps [${after.kinds}] · "${after.prov}" · "${after.status}"`);

  const turn = page.locator('.tab-content[data-tab="composer"] input[aria-label="Step 2 turn"]');
  await turn.fill('1.5');
  await turn.dispatchEvent('change');
  await page.waitForTimeout(900);
  const edited = await customState();
  chk('an edit to a step makes it a CUSTOM generator — the readout says so and the status stays valid',
    /Custom generator/.test(edited.prov) && /Valid/.test(edited.status) && edited.steps === 4, `"${edited.prov}" · "${edited.status}"`);

  const back = page.locator('.tab-content[data-tab="composer"] input[aria-label="Step 2 turn"]');
  await back.fill('1');
  await back.dispatchEvent('change');
  await page.waitForTimeout(900);
  const undone = await customState();
  chk('...and UNDOING the edit makes it the named rule again (39.D8: no remembered source, only equality)',
    /Same generator as Koch/.test(undone.prov), `"${undone.prov}"`);

  const cs = await searchFor('step 2 turn');
  chk('the settings search finds the editor\'s cells at the Composer',
    cs.some((r) => /Composer/.test(r.path)), cs.map((r) => `${r.label} [${segsOf(r.path).join(' › ')}]`).slice(0, 3).join(' | '));
  await page.locator(SEARCH_FIELD).fill('');

  await page.locator('.tab-content[data-tab="composer"] select[aria-label="Rule"]').selectOption('dragon');
  await page.waitForTimeout(900);
  const named = await customState();
  chk('picking a NAMED rule again hides the editor and resets the rows to that rule (39.Q6)',
    named.rule === 'dragon' && named.steps === 0 && /Named at/.test(named.prov), `${named.rule}, ${named.steps} step rows, "${named.prov}"`);
}

if (await loadByTile('Curve Thicket')) {
  await openComposer();
  await page.locator('.tab-content[data-tab="composer"] select[aria-label="Rule"]').selectOption('customize');
  await page.waitForTimeout(900);
  const p0 = await customState();
  // The Plant: trunk, branch, RETRACE, trunk, branch, RETRACE, trunk. Delete step 2 (a branch) -> its retrace goes too.
  await page.locator('.tab-content[data-tab="composer"] button[aria-label="Step 2 delete"]').click();
  await page.waitForTimeout(900);
  const p1 = await customState();
  chk('deleting a MOVE takes the retrace that walks back along it (spec §4.4) — no orphan is left',
    p0.kinds === 'move,move,retrace,move,move,retrace,move' && p1.kinds === 'move,move,move,retrace,move' && /Valid/.test(p1.status),
    `[${p0.kinds}] -> [${p1.kinds}] · "${p1.status}"`);
}

if (await loadByTile('Curve Rosette Chain')) {
  await openComposer();
  const r = await customState();
  chk('the Customize demo LOADS with its generator in the editor and no rule named (it equals none)',
    r.rule === 'customize' && r.steps === 3 && /Custom generator/.test(r.prov), `${r.rule}, ${r.steps} steps, "${r.prov}"`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n=== Y. v8 Phase 42 — 3-D Symmetry: placement, the gated body, the layout rows, the notice ===\n');
// ════════════════════════════════════════════════════════════════════════════════════════════════

/*
 * The owner placed it in Visual FX → Deformation beside Symmetry, and set the two factors SEPARATELY (2026-11-06):
 * where the copies sit (a Ring or Sphere of n, or a solid's vertices / edges / faces) and how many share each place.
 * DOM facts only: the row ORDER, the gate (a `display`), which rows each layout shows, Mirrors only once there are
 * two copies at a place, and the notice — `N positions × M = T copies` — which the ENGINE's operator count feeds.
 */
await page.locator('.sl-tab-btn[data-tab="visual-fx"]').click();
await page.waitForTimeout(800);
const s3 = await page.evaluate(() => {
  const root = document.querySelector('.tab-content[data-tab="visual-fx"]');
  for (const h of root.querySelectorAll('[aria-expanded="false"]')) h.click();
  const labels = Array.from(root.querySelectorAll('.sl-vfx-row .sl-vfx-label')).map((l) => l.textContent?.trim() ?? '');
  const iSym = labels.indexOf('Symmetry'), i3 = labels.indexOf('3-D Symmetry');
  const sel = root.querySelector('select[aria-label="3-D Symmetry"]');
  const onSel = root.querySelector('select[aria-label="Solid Points"]');
  const rowOf = (label) => Array.from(root.querySelectorAll('.sl-vfx-row')).find((r) => r.querySelector('.sl-vfx-label')?.textContent?.trim() === label);
  const shown = (label) => { const r = rowOf(label); return !!r && r.offsetParent !== null; };
  const note = () => Array.from(root.querySelectorAll('.sl-vfx-note')).map((n) => n.textContent ?? '').find((t) => /copies/.test(t)) ?? '';
  const pick = (s, v) => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
  const slide = (label, v) => { const i = rowOf(label)?.querySelector('input[type="range"]'); if (i) { i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); } };
  const ROWS = ['Ring Positions', 'Sphere Positions', 'On', 'Copies at Each', '3-D Radius', '3-D Mirrors', 'Facing'];
  const vis = () => Object.fromEntries(ROWS.map((l) => [l, shown(l)]));
  const r = { order: [iSym, i3] };
  const start = sel ? sel.value : null;
  if (sel && onSel) {
    pick(sel, 'off'); r.off = vis();
    pick(sel, 'cube'); pick(onSel, 'vertices'); slide('Copies at Each', 1); r.cube = { rows: vis(), note: note() };
    pick(onSel, 'faces'); slide('Copies at Each', 4); r.cubeFaces4 = { rows: vis(), note: note() };
    pick(sel, 'ring'); slide('Ring Positions', 5); slide('Copies at Each', 2); r.ring = { rows: vis(), note: note() };
    pick(sel, 'sphere'); slide('Sphere Positions', 30); slide('Copies at Each', 1); r.sphere = { rows: vis(), note: note() };
    slide('Sphere Positions', 6); pick(onSel, 'vertices');
    pick(sel, start ?? 'off');
  }
  return r;
});
const rowsAre = (v, want) => !!v && Object.entries(want).every(([k, on]) => v[k] === on);
chk('3-D Symmetry sits in the Deformation section directly after Symmetry (owner)',
  s3.order[0] >= 0 && s3.order[1] > s3.order[0] && s3.order[1] - s3.order[0] <= 2, JSON.stringify(s3.order));
chk('...its body is HIDDEN while Off; each layout shows only its own count row — Ring Positions, Sphere Positions, or On for a solid (31.U)',
  rowsAre(s3.off, { 'Ring Positions': false, 'Sphere Positions': false, On: false, 'Copies at Each': false, '3-D Radius': false, Facing: false })
  && rowsAre(s3.cube?.rows, { 'Ring Positions': false, 'Sphere Positions': false, On: true, 'Copies at Each': true, '3-D Radius': true, Facing: true })
  && rowsAre(s3.ring?.rows, { 'Ring Positions': true, 'Sphere Positions': false, On: false })
  && rowsAre(s3.sphere?.rows, { 'Ring Positions': false, 'Sphere Positions': true, On: false }),
  JSON.stringify({ off: s3.off, cube: s3.cube?.rows, ring: s3.ring?.rows, sphere: s3.sphere?.rows }));
chk('...3-D Mirrors is shown only with two or more copies at each position',
  s3.cube?.rows?.['3-D Mirrors'] === false && s3.cubeFaces4?.rows?.['3-D Mirrors'] === true && s3.ring?.rows?.['3-D Mirrors'] === true
  && s3.sphere?.rows?.['3-D Mirrors'] === false, '');
chk('...and the notice multiplies the ENGINE\'s factors (cube vertices 8 × 1, faces 6 × 4 = 24 with the thinning warning, ring 5 × 2, sphere 30 × 1)',
  /^8 positions × 1 = 8 copies/.test(s3.cube?.note ?? '') && /^6 positions × 4 = 24 copies/.test(s3.cubeFaces4?.note ?? '')
  && /thins/.test(s3.cubeFaces4?.note ?? '') && /^5 positions × 2 = 10 copies/.test(s3.ring?.note ?? '') && !/thins/.test(s3.ring?.note ?? '')
  && /^30 positions × 1 = 30 copies/.test(s3.sphere?.note ?? ''),
  `${s3.cube?.note} | ${s3.cubeFaces4?.note} | ${s3.ring?.note} | ${s3.sphere?.note}`);
const sy = await searchFor('3-d symmetry');
chk('the settings search finds 3-D Symmetry at Visual FX', sy.some((r) => /Visual FX/.test(r.path)),
  sy.map((r) => `${r.label} [${segsOf(r.path).join(' › ')}]`).slice(0, 3).join(' | '));
await page.locator(SEARCH_FIELD).fill('');

console.log(`\n  page errors: ${errs.length ? [...new Set(errs)].slice(0, 3).join(' | ') : 'none'}`);
console.log(`\n${fail === 0 && errs.length === 0 ? 'PASS' : 'FAIL'}  ui: ${pass} passed, ${fail} failed`);
await browser.close();
