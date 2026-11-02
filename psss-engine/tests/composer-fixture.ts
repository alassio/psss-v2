import { test as base, expect, type Page, type Locator } from '@playwright/test';

/*
 * ============================================================================================
 * Phase 17.1 — the one fixture every Composer spec is built on: boot → open the Lab → select `Composer`.
 * ============================================================================================
 *
 * ⚠️ **THE FIXTURE'S JOB IS NOT CONVENIENCE — IT IS TO MAKE THE HARNESS'S OWN FAILURES LOUD.** This project's
 * recorded failure mode for measuring instruments is an assertion that cannot fail: an anchor matching nothing,
 * a corpus that is empty, a seed that is algebraically impossible. In a browser that shape has a specific
 * form — **a selector that matches nothing, or a page that never finished booting, produces a test that
 * asserts over an empty DOM and reports PASS.** `CLAUDE.md`: *"a SKIPPED mutation reads exactly like a caught
 * one"* and *"an UNREACHABLE assertion is worse than a missing one."*
 *
 * So every helper below either finds its subject or THROWS. There is no "return null and let the caller
 * decide", because the caller's `expect` would then be asserting about `null`.
 */

/** ⚠️ **The `TabId` spelling is `'composer'`; the LABEL is `Composer`. `CLAUDE.md` records that the two differ
 *  for other tabs (`'randomiser'`, `'visual-fx'`), so the harness selects on `data-tab`, never on the label. */
const COMPOSER_TAB = 'composer';

/**
 * Phase 17.2 — the shape `?testhook=1` publishes on `window.__psss`.
 *
 * ⚠️ **THIS IS A SECOND ENUMERATION OF `installTestHook()`'s `read()` AND THE PROJECT'S OWN RULE SAYS TO EXPECT
 * IT TO DRIFT** (*"three enumerations of one list make a missing entry structurally invisible"*). It is
 * accepted here for one measured reason and the mitigation is named: `tests/` is compiled by a SEPARATE
 * tsconfig, so `main.ts` cannot import from it and this cannot be the engine's own type without putting a
 * harness file on the engine's compile path. **The mitigation is §26.2's shape clause in the spec below, which
 * asserts the KEY SET of a live reading against this list — so a field added engine-side and forgotten here
 * fails loudly instead of being silently unreadable.** Do not "tidy" that clause away as redundant with `tsc`:
 * `tsc` cannot see across the two compiles, which is the entire gap it covers.
 */
export interface TestHook {
  pos: number;
  elapsedTime: number;
  speedFactor: number;
  renderMode: string;
  material: string | null;
  filmLook: string;
  bypassVisualFx: boolean;
  bypassMaterials: boolean;
  snapshotIsFrozen: boolean;
  presetName: string | null;
  figureScale: number;
  symmetryFold: number;
  symmetryMirror: boolean;
  canvas: { width: number; height: number };
  particleCount: number;
  lastFrameError: string | null;
}

/** ⚠️ **The authoritative key list, exported so the spec asserts the CONTRACT rather than re-typing it.**
 *  A field added to `read()` in `main.ts` and not added here makes §26.2's shape clause fail — which is the
 *  point: the two enumerations are reconciled by a test, not by hope. */
export const TEST_HOOK_KEYS: ReadonlyArray<keyof TestHook> = [
  'pos', 'elapsedTime', 'speedFactor', 'renderMode', 'material', 'filmLook',
  'bypassVisualFx', 'bypassMaterials', 'snapshotIsFrozen', 'presetName',
  'figureScale', 'symmetryFold', 'symmetryMirror', 'canvas', 'particleCount', 'lastFrameError',
];

/**
 * ⚠️ **THE SELECTORS ARE THE SHIPPED CLASS NAMES AND NO `data-testid` IS ADDED ANYWHERE — THAT IS A DECISION
 * WITH A REASON, NOT LAZINESS.** The tab already carries `.sl-composer-*` classes and `data-slot` on both the
 * slot sections and the readouts, and there is **no shadow DOM in `src/`** (measured: `attachShadow` appears
 * nowhere), so ordinary CSS reaches every control. Adding a parallel `data-testid` set would create a SECOND
 * surface naming the same things — the exact shape `CLAUDE.md` warns about under *"three enumerations of one
 * list make a missing entry structurally invisible"*, and it would let a class rename break the UI while the
 * harness stayed green.
 *
 * ⚠️ **THE COST IS STATED: a behaviour-neutral class rename breaks these specs.** That is the same trade the
 * nine grep-based checkers already make, and `CLAUDE.md`'s rule applies verbatim — *"read the assertion before
 * believing a failure is a regression."*
 */
export const SEL = {
  labButton: 'button.pg-mode-btn:has-text("Lab")',
  gridButton: 'button.sl-btn-grid',
  tabBar: '.sl-tab-bar',
  tabBtn: (id: string) => `.sl-tab-btn[data-tab="${id}"]`,
  tabContent: '.sl-tab-content',

  /**
   * ⚠️ **ONE TAB'S OWN CONTAINER — AND ADDING THIS WAS A CORRECTION, NOT A CONVENIENCE. `SEL.tabContent` IS NOT A
   * SCOPE.** `TabRegistry.createContainer()` appends **every initialised tab's** container inside the single
   * `.sl-tab-content` and hides the inactive ones with `style.display = 'none'` (`exploration/tab-module.ts:51`,
   * `:54`, `:103`) — nothing is ever detached. So once a spec has visited two tabs, a `.sl-tab-content`-scoped
   * selector reaches **both**, and this project's own rule applies verbatim: *"`display: none` stops a tab being
   * SEEN, not WORKING."*
   *
   * ⚠️ **IT ONLY BITES ON SHARED CLASSES, WHICH IS EXACTLY WHERE PHASE 6's NEW SELECTORS LIVE.** `.sl-composer-*`
   * is unique to this tab, so every Phase 1 selector was safe by accident. But **`.sl-section-title`,
   * `.sl-vfx-row`, `.sl-vfx-label`, `.sl-vfx-slider` and `.sl-vfx-value` are all shared with Visual FX** —
   * `composer.ts` reuses them deliberately rather than re-styling. Measured: `visual-fx.ts` carries 8 occurrences
   * of those two class names alone. **After 106n opens Visual FX, an unscoped `.sl-vfx-row:has(…"Speed")` matches
   * TWO rows, and the one it resolves first is not necessarily the Composer's.**
   *
   * ⚠️ **THE FAILURE DIRECTION IS THE BAD ONE: both handles write `speedFactor`**, so a spec driving the wrong
   * one still sees the flag move and still reports green. It would be testing the other tab's control while
   * claiming to test E110. Seed 7 in `05-phase6-seeds.spec.ts` is what makes that ambiguity executable.
   *
   * ⚠️ **AND THE CONTAINER IS CREATED LAZILY, ON FIRST SHOW — MEASURED BY A RED SEED, NOT READ OFF THE SOURCE.**
   * `createContainer()` runs inside `showTab`'s `if (!this.initialized.has(tabId))` branch, so before any
   * `openTab('visual-fx')` this selector matches **nothing** and every clause reading that pane is asserting over
   * an empty locator. Seed 13 was written without a switch and failed reporting *"Visual FX has no single row
   * labelled `Rotation`"* — an accusation against a row that is built correctly. **A clause reading a SECOND tab
   * must open it first, and the reason is existence as well as `activate()`'s re-read.**
   */
  tabPane: (id: string) => `.sl-tab-content [data-tab="${id}"]`,
  presetTile: (name: string) => `.pg-tile[data-preset="${name}"]`,
  slot: (n: number) => `.sl-composer-slot[data-slot="${n}"]`,
  slotBody: '.sl-composer-slot-body',
  readout: (n: number) => `.sl-composer-readout[data-slot="${n}"]`,
  /**
   * ⚠️ **THE `:not()` IS THE WHOLE ASSERTION AND OMITTING IT COST THIS HARNESS ITS FIRST WRONG FIGURE.** A lit
   * row carries **33** `input.sl-composer-num` elements, not the 21 the test plan names: **21 raw fields**
   * (7 quantities × 3 axes) plus **12** `sl-composer-breathe-num` — the percent/seconds VIEWS that 16.8 / E99
   * added over `Pulse` and `Wobble` (2 views × 2 quantities × 3 axes). Measured on the startup preset:
   * `{"sl-composer-num|number":21, "sl-composer-num sl-composer-breathe-num|number":12}`.
   *
   * ⚠️ **THE PLAN'S 21 WAS RIGHT AND MY SELECTOR WAS WRONG, WHICH IS `CLAUDE.md`'S *"STATE THE BASIS; NEVER PAIR
   * A NUMERATOR WITH A DENOMINATOR YOU DID NOT MEASURE IT AGAINST"* ARRIVING IN A NEW MEDIUM.** A spec built on
   * the 33 would have been green, stable and describing a different quantity than the step it claimed to
   * discharge — and the breathe views do NOT round-trip (`CLAUDE.md`: *"the percent view is a VIEW; never
   * re-derive a stored value from a displayed one"*), so they are not interchangeable with the raw fields even
   * in principle.
   */
  numInput: 'input.sl-composer-num:not(.sl-composer-breathe-num)',
  breatheInput: 'input.sl-composer-breathe-num',
  muteNotice: '.sl-composer-mute-notice',
  bypassNotice: '.sl-composer-bypass-notice',
  glCanvas: '#canvas',

  /*
   * ---- Phase 17.6 additions — the `Preview only` section and the pane captions (E109–E111) ----
   *
   * ⚠️ **NOTHING BELOW EXISTED IN PHASE 1's FIXTURE, AND THAT ABSENCE IS WHY PHASE 6 IS BUILT FIRST.** The
   * helpers above reach slots, readouts, fields, notices and the level checkbox — i.e. exactly the subjects
   * Phases 3–5 need. The two bypass checkboxes, the Speed slider, the flat-pane caption and Export/Snapshot
   * had no selector at all, so the 23 steps with no checker section behind them were also the 23 the harness
   * could not reach. **Phase 6 widens the fixture; 3, 4 and 5 inherit the widening.**
   */

  /** The section title. ⚠️ **It is an ASSERTION, not decoration** — step 106a checks the string, because it is
   *  the only place on the tab where the opposite persistence semantics of these controls are stated. */
  viewSectionTitle: '.sl-section-title',

  /**
   * The two SECTIONS by their own titles, each scoped to the Composer pane.
   *
   * ⚠️ **SELECTED BY TITLE AND NEVER BY POSITION, WHICH IS THE FIXTURE'S STANDING RULE AND WAS A REAL DEFECT
   * HERE.** Until 2026-09-10 there was ONE section and 106a read `.sl-section-title` first-match; the framing
   * controls then became SAVED, moved into their own section ABOVE it, and the first match became
   * `Framing & Timing` — so the old clause asserted the wrong element and would have failed while describing a
   * string that is still on the page. **A position clause cannot see an insertion.**
   *
   * ⚠️ **`FRAMING_SECTION_TITLE` IS ALSO VISUAL FX'S OWN SECTION TITLE, so the pane scope is not optional here —
   * unscoped it matches two elements** the moment Visual FX has been built.
   */
  framingSection: `.sl-tab-content [data-tab="composer"] `
    + `.sl-section:has(> .sl-section-title:text-is("Framing & Timing"))`,
  previewSection: `.sl-tab-content [data-tab="composer"] `
    + `.sl-section:has(> .sl-section-title:text-is("Preview only — not saved with the figure"))`,

  /**
   * ⚠️ **A COMPOSER FRAMING ROW, AND THE SCOPING IS THE WHOLE SELECTOR.** Visual FX's own rows use the SAME
   * `.sl-vfx-row` / `.sl-vfx-label` / `.sl-vfx-slider` classes (`composer.ts` reuses them deliberately rather than
   * re-styling) and, since 2026-09-10, **every label this section carries is one Visual FX carries too** (the
   * Composer's set is now a strict SUBSET — the owner removed `Symmetry` from this tab the same day) — so an
   * unscoped
   * `.sl-vfx-row:has(.sl-vfx-label:text-is("Speed"))` matches Visual FX's row the moment that tab has been
   * visited, which is precisely 106n's cross-tab step. **Both handles write the same value, so driving the wrong
   * one still moves the engine and still reports green.**
   *
   * ⚠️ **AND IT IS SCOPED TO `tabPane('composer')`, NOT TO `.sl-tab-content` — THAT WAS A CORRECTION.** Scoping to
   * `.sl-tab-content` looks sufficient and is not: every initialised tab's container lives inside it, hidden by
   * `display` and never detached. See `SEL.tabPane` for the measurement.
   *
   * ⚠️ **A FUNCTION, NOT A CONSTANT, SINCE THE SECTION GREW FROM ONE ROW TO SEVERAL** — `composerSpeedRow` is kept
   * as `framingRow('Speed')` so no caller has to know the label is now one of many. **No count is stated here on
   * purpose: it moved twice in one day** (one row → seven with the widening, seven → five when the owner removed
   * `Symmetry`), and `FRAMING_ROW_LABELS` is the one place that enumerates the set.
   */
  framingRow: (label: string) =>
    `.sl-tab-content [data-tab="composer"] .sl-vfx-row:has(> .sl-vfx-label:text-is("${label}"))`,

  /** Back-compatible alias — the Speed row is one framing row among several. */
  composerSpeedRow: `.sl-tab-content [data-tab="composer"] .sl-vfx-row:has(> .sl-vfx-label:text-is("Speed"))`,

  /** The pane cells of a triple, and the flat caption inside one. ⚠️ **The caption is ALWAYS in the DOM and
   *  toggled by `display`, exactly like the two notices — assert VISIBILITY, never `count()`.** */
  pane: '.sl-composer-pane',
  paneFlat: '.sl-composer-pane-flat',
  paneCanvas: '.sl-composer-pane-canvas',
  paneCap: '.sl-composer-pane-cap',

  /** The Lab header's two persistence buttons — 106f and 106g's only observation channel. */
  exportButton: 'button.sl-btn-export',
  snapshotButton: 'button.sl-btn-snapshot',
  historyTile: '.sl-history-tile',

  /*
   * ⚠️ **`sweepRate` IS RETIRED, AND ITS REPLACEMENT IS AN ABSENCE SELECTOR RATHER THAN NOTHING AT ALL.** The
   * owner removed the Composer's `Sweep rate` control on 2026-09-10 (*"just use the default value and don't
   * provide a control for it, having a speed factor control is sufficient"*), because it and `Speed` multiply the
   * SAME advance — `main.ts` scales `dt` by `speedFactor`, `lissajous.ts` then adds `waveSpeed` per corrected
   * frame — so the tab shipped two controls over one visible quantity, only one of which reset the pose.
   *
   * ⚠️ **THE FIELD SURVIVES: `generators.waveSpeed` IS STILL STORED, STILL VARIES ACROSS THE LIBRARY AND STILL
   * DIVIDES EVERY SECONDS LABEL.** A spec must not read the removal as *"waveSpeed is gone"*; what is gone is the
   * only surface that could MOVE it from this tab.
   *
   * ⚠️ **WHY AN ABSENCE SELECTOR AND NOT A DELETION: `toHaveCount(0)` OVER A DELETED CONTROL IS THE ONE CLAUSE
   * SHAPE THAT PASSES FOR THE WRONG REASON FOREVER** — it is also satisfied by a typo, a renamed label or a tab
   * that never built. So the one clause that uses it (`assertNoSweepRateControl()`) pairs it with a POSITIVE
   * anchor on a control that must still be there. **`CLAUDE.md`: *assert old names are GONE, not merely renamed*,
   * and *a skipped mutation reads exactly like a caught one.***
   */
  sweepRateGone: 'input[aria-label="Sweep rate"]',

  /*
   * ---- Phase 17.3 additions — the remaining DOM-channel controls ----
   *
   * ⚠️ **EVERY SELECTOR BELOW WAS READ OFF `composer.ts` RATHER THAN GUESSED FROM ITS NAME, AND TWO OF THEM ARE
   * NOT WHAT THEIR STEP CALLS THEM.** `Stack ▾` is a `<select>` whose placeholder option carries that text (not a
   * button), and the ratio control is a hand-rolled `role="combobox"` button plus a `role="listbox"` div — not a
   * `<select>` at all. **`CLAUDE.md`: *"Ask what a step's control IS before checking what it SAYS."***
   */

  /** `New Figure` — a plain `button.sl-btn`, matched on its text because the class is shared with `Clear`. */
  newFigureButton: 'button.sl-btn:text-is("New Figure")',

  /**
   * ⚠️ **`Stack ▾` IS A `<select>`, NOT A BUTTON, AND ITS VISIBLE TEXT IS A PLACEHOLDER `option` WITH `value=""`
   * THAT IS RE-SELECTED AFTER EVERY PICK** (`stack.value = ''` in the `change` handler). So a spec drives it with
   * `selectOption`, and **re-picking the same stack requires setting `value` again rather than "clicking twice"**
   * — step 31's *"re-pick Octaves"* is two `selectOption` calls, and it works precisely BECAUSE the control
   * resets itself. Options carry `value = String(i)` into `STACKS`, so a spec selects by LABEL, never by index.
   */
  stackSelect: 'select.sl-composer-stack',

  /** The ratio control (16.11 / E102) — ⚠️ **ONE control since the gallery and the tuner turned out to be the
   *  same control twice.** The button is `role="combobox"`, `aria-label="<Level> winding ratio"`. */
  ratioButton: (level: string) => `button.sl-composer-combo-btn[aria-label="${level} winding ratio"]`,
  ratioValue: '.sl-composer-combo-value',
  /**
   * ⚠️ **THERE ARE THREE LISTS — ONE PER LEVEL, ALL PRESENT AT ONCE — SO THE LIST MUST BE SCOPED BY THE LEVEL
   * WHOSE BUTTON WAS CLICKED, AND `.last()` IS NOT THAT.** `.last()` resolves to *Detail's* list whatever button
   * opened one, so a `toBeVisible()` wait after clicking Body's button times out and reports *"the ratio list did
   * not open"* — the harness naming the engine for a defect that is entirely the selector's. It cost seed 8 a red.
   * It is also `CLAUDE.md`'s own Phase 17 rule turned on the fixture: **select on the label, never on position**;
   * a positional selector cannot see that three things answer to it.
   *
   * `ratioListFor` walks up to the shared `.sl-composer-combo` wrapper, which holds exactly one button and one
   * list, so the pairing is structural rather than ordinal.
   */
  ratioListFor: (level: string) =>
    `.sl-composer-combo:has(button.sl-composer-combo-btn[aria-label="${level} winding ratio"]) `
    + '> .sl-composer-combo-list[role="listbox"]',
  /** ⚠️ Unscoped — matches all three. Use `ratioListFor` whenever ONE level's list is the subject. */
  ratioList: '.sl-composer-combo-list[role="listbox"]',
  ratioOption: '.sl-composer-combo-opt[role="option"]',
  ratioOptionCaption: '.sl-composer-combo-cap',
  ratioThumb: 'canvas.sl-composer-thumb',

  /**
   * The per-quantity `✕` clear (16.16 / E107) — ⚠️ **its `aria-label` names ALL THREE AXES on purpose, because
   * its SCOPE is the row and mistaking it for a per-axis control is the step's own hazard** (§P owns the scope).
   */
  axisClear: (level: string, quantity: string) =>
    `button.sl-composer-clear[aria-label="Clear ${level} ${quantity} on all three axes"]`,

  /** The level `Clear` (16.17 / E108) — ⚠️ **IMMEDIATE: one click, no confirmation, no history, unrecoverable.** */
  levelClear: (level: string) =>
    `button.sl-composer-level-clear[aria-label="Clear every value on ${level}"]`,

  /** The level checkbox (16.17 / E108). ⚠️ **"On" is TWO facts — not muted AND not empty** (`levelIsOn()`). */
  levelCheck: (level: string) => `input.sl-composer-level-check[aria-label="${level} on"]`,

  /** A silent row's copy container — ⚠️ **present INSTEAD of the 21 inputs, never alongside them.** */
  silentRow: '.sl-composer-silent',

  /** The shift dial (16.7 / E98) — ⚠️ **a `<canvas role="slider">`, so it has no `value`;** read the paired
   *  `Shift °` number input instead. Three axes, always, on every row. */
  dial: (level: string, axis: string) =>
    `canvas.sl-composer-dial[aria-label="${level} shift ${axis}"]`,

  /**
   * ⚠️ **THE CLASS ALONE, FOR THE ONE CLAUSE WHOSE SUBJECT IS A *COUNT* RATHER THAN A NAMED DIAL — AND ITS ABSENCE
   * WAS A REAL RED WITH A MESSAGE ACCUSING THE ENGINE.** Steps 74/80 ask *"does every row show THREE dials"*, which
   * needs no axis; the spec interpolated `${SEL.dial}` — **a FUNCTION, uncalled** — so the selector became the
   * function's SOURCE TEXT, matched nothing, and `toHaveCount(3)` reported *"Quader does not show three dials"*.
   * `CLAUDE.md`: *"A HARNESS FAILURE ACCUSES THE SUBJECT BY DEFAULT."* **`tsc` cannot see it: template
   * interpolation of a function is legal TypeScript**, which is why the remedy is a second named selector rather
   * than care at the call site.
   *
   * ⚠️ **AND IT IS THE ONLY LEGITIMATE USE FOR THIS FORM.** Anywhere ONE dial is the subject, `dial(level, axis)`
   * is required — *"select on the label, never on position"*, and three dials per row over three rows means a
   * positional pick has nine candidates.
   */
  dialAny: 'canvas.sl-composer-dial',

  /** A breathe view's unit chip — `%` / `abs` / `s`. ⚠️ **A VIEW; it does not round-trip.** */
  breatheUnit: '.sl-composer-breathe-unit',

  /** Region D's amber precondition — ⚠️ **inline copy, not a tooltip** (invariant 25). */
  precondition: '.sl-composer-precondition',

  /** The Score legend — ⚠️ **compare PER KEY against the declaration; a set-membership clause cannot see a
   *  permutation** (§I's recorded defect). */
  legend: '.sl-composer-legend',
  extent: '.sl-composer-extent',

  /** The Import dialog (`export.ts`) — the channel that makes steps 38, 56, 65 and 105f automatable at all. */
  importButton: 'button.sl-btn-import',
  importConfirm: 'button:text-is("Add to presets")',

  /**
   * The Lab header's `Reset` — ⚠️ **`button.sl-btn sl-btn-reset`, read off `panel.ts:124`, and it is a HEADER
   * control rather than a tab one, so it must NOT be scoped to `SEL.tabContent`.** Step 37 is the only user of
   * it, and its subject is the empty placeholder returning: since 16.15 that is the ONLY presentation `Reset`
   * still owns, and it is the half that was always the destructive one.
   */
  resetButton: 'button.sl-btn-reset',
} as const;

/**
 * The two bypass switches' labels — ⚠️ **RENAMED AND RE-POLARISED 2026-09-10 on the owner's word** (*"revert the
 * meaning: change names to Apply Visual Fx and Apply Materials which are enabled by default"*).
 *
 * ⚠️ **THE TYPOGRAPHIC-APOSTROPHE FINDING THIS CONSTANT WAS WRITTEN FOR IS NOW HISTORICAL, AND THE REASONING
 * STAYS BECAUSE THE MECHANISM DOES.** The shipped labels were `'Don’t apply Visual FX'` / `'Don’t apply
 * Materials'` with a U+2019, the test plan rendered them with an ASCII `'`, and **a selector transcribed from the
 * document matched NOTHING** — which `CLAUDE.md` calls out exactly: *"an absence test over an empty corpus
 * reports PASS."* The new labels contain no apostrophe at all, so that specific trap is gone; the general one is
 * not, and the next label with a dash, a quote or an ellipsis in it walks into it identically.
 *
 * ⚠️ **THE MITIGATION IS NOT THIS CONSTANT — IT IS `assertBypassBoxesPresent()` BELOW**, which asserts both boxes
 * resolve to exactly one element before any spec clicks either. A constant can be wrong; an up-front count
 * assertion cannot be wrong quietly. **That is why the helper survives the rename unchanged.**
 *
 * ⚠️ **A LABEL NOW STATES THE OPPOSITE OF THE FLAG IT DRIVES.** `Apply Visual FX` ticked means
 * `bypassVisualFx === false`. Every helper below keeps the FLAG's sense in its parameters and inverts once at the
 * DOM, mirroring `composer.ts` — see `setBypass`.
 */
export const BYPASS_LABELS = {
  fx: 'Apply Visual FX',
  materials: 'Apply Materials',
} as const;

/**
 * The `Preview only` section title — step 106a asserts this exact string.
 *
 * ⚠️ **IT IS NO LONGER THE TAB'S FIRST SECTION TITLE (2026-09-10).** The framing controls became SAVED and moved
 * into their own section ABOVE this one, so a clause reading the first `.sl-section-title` now reads
 * `Framing & Timing`. **106a was re-pointed to select the section by its title rather than by position** — which
 * is the fixture's own no-position rule, and the position clause had been passing only by coincidence.
 */
export const VIEW_SECTION_TITLE = 'Preview only — not saved with the figure';

/**
 * The saved framing section's title — ⚠️ **DELIBERATELY THE SAME STRING VISUAL FX USES FOR ITS OWN SECTION**, so
 * a selector for it must be scoped to the Composer pane or it matches two elements the moment Visual FX has been
 * built. `SEL.framingSection` does the scoping; do not use this constant bare.
 */
export const FRAMING_SECTION_TITLE = 'Framing & Timing';

/**
 * The framing controls' row labels, in the order `buildFramingSection()` appends them.
 *
 * ⚠️ **`Mirror` IS CONDITIONAL: its row is `display: none` at symmetry fold 1**, which is the state nearly every
 * library preset is in — so a clause asserting every entry is VISIBLE fails on a correct build. Assert the
 * UNCONDITIONAL ones, and assert `Mirror`'s visibility against the live fold.
 *
 * ⚠️ **`Symmetry` WAS THE FIFTH ENTRY UNTIL 2026-09-10, WHEN THE OWNER REMOVED THAT ROW FROM THE COMPOSER** (*"remove
 * the Symmetry control, this one is not needed on the Composer tab"*) — Visual FX keeps its own. So this list is
 * FIVE, of which four are unconditional, and every clause standing on it had to be re-derived rather than
 * re-counted: the `.slice()` bound below, 106a's order clause, and 106a-i's fold drive, which could no longer be
 * PERFORMED at all. ⚠️ **`Mirror` STAYING IS THE LITERAL READING OF THE REQUEST AND IT HAS A CONSEQUENCE FOR THIS
 * FIXTURE: the Composer can no longer CHANGE the fold, so nothing in this harness can reveal `Mirror`'s row through
 * the Composer's own DOM** — the only way to see it visible is a preset whose authored fold is above 1, and
 * `Material Organic` is the one library entry that qualifies.
 */
export const FRAMING_ROW_LABELS = [
  'Figure Scale', 'Speed', 'Particle Number', 'Rotation', 'Mirror',
] as const;

/** ⚠️ **The flat-pane caption, and it must NOT name an axis or a cause** (107b). A winding of 0 flattens a pane
 *  whose two sizes are large and real, so `no Z size` would be confidently wrong on a reachable case. */
export const FLAT_PANE_CAPTION = 'flat here — no reach in this plane';

/** The three plane captions, in the order `PLANES` draws them. Used to name a pane by its plane, never by index. */
export const PLANE_CAPTIONS = ['X / Y', 'X / Z', 'Y / Z'] as const;

/**
 * The `b − r` split that separates the three curve hues. **`paneInk` and 22b's per-hue spread are the only two
 * consumers and they MUST share it.**
 *
 * ⚠️ **DERIVED, NEVER PICKED: `b − r` is +20 for the white curve `rgba(235,242,255)`, +128 for cyan
 * `rgba(96,214,224)` and −152 for amber `rgba(224,168,72)`, so the split sits at the midpoint of the two NEAREST
 * (white and cyan) and every bucket then sits ~54 from it.** The hand-picked **24** this replaces left white a
 * margin of **4** and shipped RED — it failed step 20 and seed 3 on a correct diagram, because white is not
 * neutral but faintly blue and its anti-aliased edge crossed the line (measured on `Cylinder`: 42 pixels bucketed
 * cyan, ALL at alpha ≤ 31, sampling `rgba(230,238,255,30)`). `CLAUDE.md`: *"derive a tolerance from the worst-case
 * argument magnitude; never pick one that passes."*
 *
 * ⚠️ **IT IS EXPORTED BECAUSE THE VALUE EXISTED TWICE AND ONLY ONE COPY WAS FIXED FIRST — THE SECOND WAS LIVE CODE
 * IN 22b, WHICH WOULD HAVE KEPT THE DEFECT IN A STEP THAT READS THE SAME PIXELS.** `CLAUDE.md`: *"Correct once per
 * QUANTITY, not per file"*, and *"three enumerations of one list make a missing entry structurally invisible"*.
 * A `page.evaluate` cannot close over a module constant, so each consumer passes it in as an ARGUMENT — that is
 * the whole reason this is not simply referenced inside the two loops.
 */
export const HUE_SPLIT = (20 + 128) / 2;

/**
 * ⚠️ **EVERY NUMERIC INPUT CARRIES A SHIPPED `aria-label` OF THE FORM `"<Level> <Quantity> <Axis>"` — MEASURED,
 * AND IT IS WHY NO `data-testid` WAS NEEDED.** The full set on one row is `Body Winding X` … `Body Wobble rate Z`
 * for the 21 raw fields, plus `Body Pulse (% · s) X depth` / `… X seconds` for the breathe views, plus
 * `Body on` for the level checkbox.
 *
 * ⚠️ **SELECTING ON THE LABEL RATHER THAN ON POSITION IS A CORRECTNESS CHOICE, NOT A STYLE ONE.** `nth(4)` would
 * silently retarget the moment a row's field order changed — and `CLAUDE.md` records exactly that failure for
 * this tab: *"a SET-MEMBERSHIP CLAUSE CANNOT SEE A PERMUTATION."* An `aria-label` names the axis, so a spec that
 * meant Y cannot quietly start testing Z.
 *
 * ⚠️ **AND IT DOUBLE-DUTIES AS AN ACCESSIBILITY ASSERTION**: if a refactor drops the labels, these specs fail
 * loudly rather than degrading, which is the direction a harness should fail in.
 */
export const LEVEL_NAMES = ['Body', 'Structure', 'Detail'] as const;
export type Axis = 'X' | 'Y' | 'Z';

/** The three level names, in the order the tab draws them. Slot indices are 0-based in the DOM. */
export const SLOTS = { body: 0, structure: 1, detail: 2 } as const;

/**
 * The copy a silent row shows. ⚠️ **This is the 16.17 wording and it REPLACED `silent — no size`, which
 * `CLAUDE.md` records as not merely worse but WRONG** (silence is `size + pulse === 0`). A spec asserting the
 * old string would fail on correct code, so the literal lives here once.
 */
export const EMPTY_ROW_COPY = 'empty — nothing authored here';

export class ComposerPage {
  constructor(readonly page: Page) {}

  /**
   * Boot the engine and wait until it is genuinely running.
   *
   * ⚠️ **"LOADED" IS NOT "RUNNING", AND CONFLATING THEM IS THE FIRST WAY THIS HARNESS COULD LIE.** `load` fires
   * when the module graph is fetched; the engine then compiles 58 shaders under a CPU rasteriser. A spec that
   * proceeded at `load` would query a DOM the Lab has not built yet and find nothing — reporting PASS on every
   * absence assertion. So the wait condition is the LAB BUTTON being present, which only exists once
   * `main.ts` has built the preview-grid chrome.
   *
   * ⚠️ **AND THE CONSOLE IS CAPTURED BUT NOT TRUSTED AS A PASS CONDITION** (`CLAUDE.md`: *"A CLEAN CONSOLE IS
   * NOT EVIDENCE THE FRAME IS FINE"*). It is recorded so a spec can assert on a specific error; silence proves
   * nothing, which is why `assertEngineDrew()` exists and looks at pixels instead.
   */
  readonly consoleErrors: string[] = [];

  async boot(query = ''): Promise<void> {
    this.page.on('console', (m) => {
      if (m.type() === 'error') this.consoleErrors.push(m.text());
    });
    this.page.on('pageerror', (e) => this.consoleErrors.push(`pageerror: ${e.message}`));

    await this.page.goto(`/${query}`, { waitUntil: 'load' });
    await this.page.locator(SEL.labButton).waitFor({ state: 'visible', timeout: 60_000 });
  }

  /**
   * Phase 17.2 — boot with `?testhook=1` and return the FIRST reading.
   *
   * ⚠️ **THE DEFAULT `boot()` STILL NAVIGATES TO A BARE `/`, AND KEEPING IT THAT WAY IS DELIBERATE: the twelve
   * steps Phase 1 discharged must keep running on the surface a USER gets.** If the shared fixture had been
   * changed to always pass the guard, every Phase 1 spec would silently have started testing a configuration no
   * user can reach — and they would still have been green, which is the failure this project calls *"a
   * confirmation is evidence only if a specific failure was available to it."*
   *
   * ⚠️ **IT ASSERTS THE HOOK IS PRESENT, because the alternative is a spec that reads `undefined` and asserts
   * about nothing.** A missing hook must fail HERE, naming the guard, rather than 40 lines later as
   * `Cannot read properties of undefined`.
   */
  async bootWithHook(): Promise<TestHook> {
    await this.boot('?testhook=1');
    const first = await this.hook();
    expect(first, 'CALIBRATION: `window.__psss` is absent even though the page was loaded with `?testhook=1`. '
      + 'Either `installTestHook()` did not run or the guard spelling changed — every assertion in this spec '
      + 'would otherwise have been reading `undefined`.').toBeTruthy();
    // ⚠️ The assertion above is the guard; `expect` does not narrow the type for `tsc`, so the non-null is
    // asserted here rather than by widening the return type to `| null` — a nullable return would push an
    // `!` into every caller and make the guard's failure arrive late, at the first field read.
    return first!;
  }

  /**
   * One reading of the engine's live state, or `null` when the guard is off.
   *
   * ⚠️ **A FRESH `evaluate` PER CALL IS THE POINT, NOT AN INEFFICIENCY.** `window.__psss` is a GETTER, so each
   * read re-samples; caching the object in the fixture would reintroduce exactly the defect the engine-side
   * getter exists to prevent — **a stale reading over which every "did it advance?" assertion PASSES.**
   */
  async hook(): Promise<TestHook | null> {
    return this.page.evaluate(() => (window as unknown as { __psss?: unknown }).__psss ?? null) as Promise<TestHook | null>;
  }

  /**
   * Sample `pos` twice across a real wait and require it to ADVANCE.
   *
   * ⚠️ **THIS IS THE CHANNEL PHASE 1 DID NOT HAVE, AND IT ANSWERS A QUESTION PIXELS CANNOT.** Phase 1's
   * frozen-figure guard compared two canvas signatures — which catches a dead loop, but cannot distinguish a
   * dead INTEGRATOR from a live one whose figure is being pushed around by rotation, curl noise or the fluid
   * field. `pos` advances iff `generator.update()` ran. **`elapsedTime` is checked too because the two can
   * disagree: `elapsedTime` is scaled by `speedFactor` and `pos` by `waveSpeed`, so a spec asserting only one
   * of them would be blind to a bug in the other's multiplier** (invariant 10 — check the units of the result).
   */
  async assertIntegratorAdvanced(ms = 1200): Promise<void> {
    const a = await this.hook();
    expect(a, 'assertIntegratorAdvanced needs `?testhook=1` — use `bootWithHook()`.').toBeTruthy();
    await this.page.waitForTimeout(ms);
    const b = await this.hook();
    expect(b!.pos, `the integration clock did not advance over ${ms} ms — \`generator.update()\` is not running. `
      + 'A canvas comparison could not have told this from a figure being moved by a post-processor.')
      .toBeGreaterThan(a!.pos);
    expect(b!.elapsedTime, `\`pos\` advanced but \`elapsedTime\` did not over ${ms} ms — these are scaled by `
      + 'different multipliers (`waveSpeed` vs `speedFactor`), so one can stall while the other runs.')
      .toBeGreaterThan(a!.elapsedTime);
  }

  /**
   * ⚠️ **THE ENGINE MUST BE SHOWN TO HAVE DRAWN, BY PIXELS, BEFORE ANY SPEC ASSERTS ANYTHING ABOUT A FIGURE.**
   * This is the harness's answer to the black-frame failure mode: a failed `compileProgram()` "throws nothing,
   * links, binds and no-ops to black", so a suite that skipped this check would run all 136 steps against a
   * black canvas and only the pixel steps would notice — and they would blame the step, not the boot.
   *
   * It reads the GL canvas back through `toDataURL` and requires SOME non-near-black pixel. Deliberately a
   * weak assertion: it is a smoke test for "the pipeline ran", not a look check. ⚠️ **It must stay weak** —
   * strengthening it into a brightness threshold would make it fail on the low-accumulation presets
   * (`Cylinder`, `Quader`, `Pipes`) that `CLAUDE.md` says to JUDGE look changes on.
   */
  async assertEngineDrew(): Promise<void> {
    const lit = await this.page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#canvas');
      if (!c) return { ok: false, why: 'no #canvas element' };
      const gl = c.getContext('webgl2');
      if (!gl) return { ok: false, why: 'canvas has no webgl2 context' };
      const w = 64, h = 64;
      const px = new Uint8Array(w * h * 4);
      // Read a centre patch: the figure is centred and the margins are legitimately black.
      const x = Math.max(0, Math.floor(c.width / 2 - w / 2));
      const y = Math.max(0, Math.floor(c.height / 2 - h / 2));
      gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let maxV = 0;
      for (let i = 0; i < px.length; i += 4) {
        maxV = Math.max(maxV, px[i]!, px[i + 1]!, px[i + 2]!);
      }
      return { ok: maxV > 8, why: `brightest centre channel = ${maxV}` };
    });
    expect(lit.ok, `the engine did not draw a lit frame — ${lit.why}. `
      + 'A failed shader compile links, binds and no-ops to BLACK with a silent console, so this is the '
      + 'check that separates "the engine is broken" from "the step under test is broken".').toBe(true);
  }

  /** Open the Lab panel. Idempotent: if the tab bar is already up, does nothing. */
  async openLab(): Promise<void> {
    const bar = this.page.locator(SEL.tabBar);
    if (await bar.count() === 0 || !(await bar.first().isVisible())) {
      await this.page.locator(SEL.labButton).click();
      await bar.first().waitFor({ state: 'visible', timeout: 30_000 });
    }
  }

  /**
   * Select the Composer tab.
   *
   * ⚠️ **THE TAB IS LAST, AFTER MATERIALS (an owner decision), AND ITS THREE SECTIONS ONLY REGISTER INSIDE
   * `if (this.config.visualFxControls)`** — `CLAUDE.md`: *"the bar can show more tabs than the registry
   * holds."* So the button existing is NOT evidence the tab mounted. This waits for the tab's own content and
   * fails with that distinction named, because the two causes have completely different fixes.
   */
  async openComposer(): Promise<void> {
    await this.openLab();
    const btn = this.page.locator(SEL.tabBtn(COMPOSER_TAB));
    await expect(btn, 'no `Composer` button in the tab bar — the tab is LAST, after Materials; if the bar '
      + 'renders without it, `TAB_DEFS` lost its entry').toHaveCount(1);
    await btn.click();
    await this.page.locator(`${SEL.tabContent} .sl-composer-slot`).first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    // v8 32.13 — `Framing & Preview` is closed on arrival, and `SEL.framingSection` resolves INSIDE it.
    await this.expandGroups(COMPOSER_TAB);
  }

  /**
   * Load a library preset by clicking its tile, then return to wherever the Lab was.
   *
   * ⚠️ **THE GRID AND THE LAB ARE MUTUALLY EXCLUSIVE VIEWS OF ONE PANEL, AND THAT COST THE FIRST DRAFT OF THIS
   * HELPER A TIMEOUT.** `setPanelMode()` (`main.ts:5371`) calls `previewGrid.hide()` when the Lab opens, so with
   * the Composer on screen all 360 tiles are still in the DOM and **none of them is clickable** — measured:
   * `count() === 1` and `isVisible() === false` for `Aliens DNA`. A `count()`-based existence check therefore
   * passes while the click cannot land, which is this project's *"`display: none` stops a tab being SEEN, not
   * WORKING"* arriving from the other direction.
   *
   * ⚠️ **AND IT IS THE TEST PLAN'S OWN RULE ABOUT ITSELF: *"ask what a step's control IS before checking what
   * it SAYS."*** Every A-session step reads *"Load X, open Composer"* — that ORDER is the real path, and the way
   * back for a second preset is the Lab header's `Grid` button, not the browser's history. So this helper
   * switches to the grid, clicks, and restores the Composer if it was open.
   *
   * ⚠️ **IT CLICKS THE TILE RATHER THAN CALLING ANY API, AND THAT IS THE WHOLE POINT OF A BROWSER PASS.**
   * `CLAUDE.md` invariant 23: the startup preset must go through `applyPresetChange`, the ONLY reader of the
   * `overlay` block — and a tile's listener must read `tile.dataset.preset` rather than a name captured at
   * build time. Driving the real click exercises both; reaching into the engine would exercise neither.
   *
   * ⚠️ **A PRESET NAME IS A PRIMARY KEY IN FIVE OWNERS**, so a name that does not resolve must fail loudly
   * here rather than leave the previous figure loaded — which would make the NEXT assertion describe the wrong
   * preset entirely. That is the *"confirmation is evidence only if a specific failure was available to it"*
   * rule: a silently-unchanged figure is available to no failure at all.
   */
  async loadPreset(name: string): Promise<void> {
    const composerWasOpen = await this.page.locator(`${SEL.tabContent} .sl-composer-slot`).count() > 0
      && await this.page.locator(`${SEL.tabContent} .sl-composer-slot`).first().isVisible();

    // Back to the grid if the Lab is covering it. The `Grid` button only exists when `onGridClick` is wired.
    const gridBtn = this.page.locator(SEL.gridButton);
    if (await gridBtn.count() > 0 && await gridBtn.first().isVisible()) {
      await gridBtn.first().click();
      await this.page.locator('.pg-tile').first().waitFor({ state: 'visible', timeout: 30_000 });
    }

    const tile = this.page.locator(SEL.presetTile(name));
    await expect(tile, `no preset tile named ${JSON.stringify(name)}. Note this is a COUNT check on a grid `
      + 'that is VIEWPORT-driven with eviction, so a tile can exist and be unrendered — but it must at least '
      + 'exist, and a name that resolves to none is a typo or a rename, not an eviction.').toHaveCount(1);
    await tile.scrollIntoViewIfNeeded();
    await tile.click();

    if (composerWasOpen) {
      await this.openComposer();
      // The tab does a FULL RESYNC on an external figure arriving (`adoptExternalFigure`), which rebuilds the
      // row BODIES rather than only their values — so wait for the rebuild rather than the first paint.
      await this.page.waitForTimeout(250);
    }
  }

  slot(n: number): Locator {
    return this.page.locator(`${SEL.tabContent} ${SEL.slot(n)}`);
  }

  /** A slot's readout line — the `closes` / `open` badge, the `×… of Body` multiple, the shift notes. */
  readout(n: number): Locator {
    return this.page.locator(`${SEL.tabContent} ${SEL.readout(n)}`);
  }

  /**
   * The **raw** numeric inputs inside one slot — ⚠️ **exactly 21 on a lit row** (7 quantities × 3 axes), always,
   * since 16.15 deleted the tier. The 12 percent/seconds VIEWS are excluded; see `SEL.numInput`.
   */
  numInputs(n: number): Locator {
    return this.slot(n).locator(SEL.numInput);
  }

  /**
   * One field by name, on one level and one axis — e.g. `field('Body', 'Winding', 'X')`.
   *
   * ⚠️ **THIS IS THE ONLY WAY A SPEC SHOULD REACH A FIELD.** It resolves through the shipped `aria-label`, so it
   * cannot be fooled by a field-order change, and it asserts the label matched exactly ONE input — a label typo
   * would otherwise produce a locator matching nothing, and `fill()` on nothing times out with a message about
   * the harness rather than about the tab.
   */
  field(level: (typeof LEVEL_NAMES)[number], quantity: string, axis: Axis): Locator {
    return this.page.locator(
      `${SEL.tabContent} input[aria-label="${level} ${quantity} ${axis}"]`);
  }

  /** The `Preview only` / mute notices. ⚠️ **Both are ALWAYS in the DOM and hidden by `display` — so a spec must
   *  assert VISIBILITY, never `count()`.** `CLAUDE.md`: *"`display: none` stops a tab being SEEN, not WORKING."*
   *  Measured at boot: both present, both `offsetParent === null`. */
  notice(which: 'mute' | 'bypass'): Locator {
    return this.page.locator(which === 'mute' ? SEL.muteNotice : SEL.bypassNotice);
  }

  /** Whether a row is showing the empty placeholder instead of controls. */
  async isEmptyRow(n: number): Promise<boolean> {
    return (await this.slot(n).locator(`text=${EMPTY_ROW_COPY}`).count()) > 0;
  }

  /**
   * The level checkbox on a slot's title row (16.17 / E108).
   *
   * ⚠️ **ITS DISPLAYED STATE IS A THIRD QUANTITY — `levelIsOn()` = NOT MUTED **AND** NOT EMPTY.** That
   * conflation WAS the defect §Q was green over: painted from the mute flag alone, the box arrived TICKED on an
   * empty row, so no `change` fired and the seed path was unreachable. **A spec asserting on this box must say
   * which of the two facts it is testing.**
   */
  levelCheckbox(n: number): Locator {
    return this.slot(n).locator('input[type="checkbox"]').first();
  }

  /*
   * ==========================================================================================
   * Phase 17.6 — the `Preview only` section (E109/E110) and the two readouts (E111)
   * ==========================================================================================
   */

  /**
   * One bypass checkbox, selected by its shipped `aria-label`.
   *
   * ⚠️ **THE LABEL IS THE SELECTOR** — see `BYPASS_LABELS`, whose text was renamed on 2026-09-10. Scoped to
   * `.sl-tab-content` so it cannot resolve to some other tab's control after a tab switch.
   *
   * ⚠️ **THE BOX'S `checked` IS THE NEGATION OF THE FLAG THIS METHOD'S NAME REFERS TO.** `bypassBox('fx')`
   * returns the `Apply Visual FX` box: ticked means `bypassVisualFx === false`. **Read `checked` through
   * `isBypassed()` rather than asserting on it directly**, or a clause reads exactly backwards while looking
   * right — the failure has no symptom other than being wrong.
   */
  bypassBox(which: 'fx' | 'materials'): Locator {
    return this.page.locator(
      `${SEL.tabContent} input[aria-label="${BYPASS_LABELS[which]}"]`);
  }

  /**
   * Whether the bundle is BYPASSED — i.e. the box is UNTICKED. The one place the harness inverts.
   *
   * ⚠️ **IT EXISTS SO NO SPEC WRITES THE `!` ITSELF.** The engine flag and the DOM state are opposite since the
   * 2026-09-10 polarity flip, and a `!` scattered across four specs is the *"two spellings of one boolean"* shape
   * that `composer.ts` refuses on its own side (invariant 17). One inversion in the fixture, one in the tab.
   */
  async isBypassed(which: 'fx' | 'materials'): Promise<boolean> {
    return !(await this.bypassBox(which).isChecked());
  }

  /**
   * ⚠️ **THE CALIBRATION THAT MAKES EVERY BYPASS CLAUSE MEAN SOMETHING, AND IT IS CALLED BEFORE ANY OF THEM.**
   * Both boxes must resolve to exactly ONE element. This is the guard against the U+2019 defect and against a
   * class or label rename: without it, a `.check()` would time out with a message about Playwright and an
   * `expect(...).toHaveCount(0)` would report PASS. **A count assertion cannot be wrong quietly; a constant can.**
   */
  async assertBypassBoxesPresent(): Promise<void> {
    for (const which of ['fx', 'materials'] as const) {
      await expect(this.bypassBox(which),
        `CALIBRATION: no checkbox with aria-label ${JSON.stringify(BYPASS_LABELS[which])}. `
        + 'The shipped labels use a TYPOGRAPHIC apostrophe (U+2019), not ASCII — a selector transcribed from '
        + 'the test plan matches nothing, and every absence assertion below would then pass over an empty '
        + 'locator.').toHaveCount(1);
    }
  }

  /**
   * Set a bypass flag through the DOM and wait for the engine to have re-applied.
   *
   * ⚠️ **IT CLICKS, RATHER THAN CALLING THE SETTER, BECAUSE THE ENGINE-SIDE RE-APPLY IS THE SUBJECT.** The flags
   * live in `main.ts`, are applied from `applyPresetChange`/`resetOverlays`, and the checkbox is only a VIEW of
   * them (invariant 17). Driving the setter would exercise a path no user can reach — Phase 2's rule verbatim.
   *
   * ⚠️ **AND IT USES `.check()`/`.uncheck()`, WHICH ARE IDEMPOTENT, RATHER THAN `.click()`** — 106e cycles each
   * box three times and a `click` on an already-correct box would invert it, making the spec assert the opposite
   * of what it says. The wait is for the re-apply to reach a frame; the bypass goes through
   * `visualFxControls.resetOverlays()`, which is not synchronous with the click.
   *
   * ⚠️ **`on` MEANS *"the BYPASS is on"* — THE FLAG'S SENSE, NOT THE BOX'S — AND THE PARAMETER KEPT ITS MEANING
   * ACROSS THE 2026-09-10 POLARITY FLIP DELIBERATELY.** Re-pointing it at the box would have silently inverted
   * every existing call site, and there was no assertion able to catch that: `setBypass('fx', true)` would have
   * gone from stripping the FX to restoring them, and every downstream clause would have measured the wrong
   * state while naming the right one. **The inversion is the one `.uncheck()`/`.check()` swap below.**
   */
  async setBypass(which: 'fx' | 'materials', on: boolean): Promise<void> {
    const box = this.bypassBox(which);
    // The box says APPLY, the parameter says BYPASS — so bypassing means UNticking. One `!`, here.
    if (on) await box.uncheck(); else await box.check();
    await this.page.waitForTimeout(400);
  }

  /*
   * ---- The saved `Framing & Timing` section (2026-09-10) ----
   *
   * ⚠️ **EVERY CONTROL HERE IS A SECOND SURFACE OF A VISUAL FX ONE, so every one of these locators is scoped to
   * the Composer PANE and every clause about them has to say which surface it drove.** Both write the same
   * engine value, so a spec that reaches the wrong row still moves the engine and still reports green — the
   * `SEL.framingRow` comment records the measurement. **`FRAMING_ROW_LABELS` is the enumeration; no count is
   * repeated here** (it went one → seven → five inside two days).
   */

  /** One framing row's range input, by its row label. `Rotation` has three and needs `rotationSlider`. */
  framingSlider(label: string): Locator {
    return this.page.locator(`${SEL.framingRow(label)} input.sl-vfx-slider`);
  }

  /** One framing row's readout. */
  framingValue(label: string): Locator {
    return this.page.locator(`${SEL.framingRow(label)} .sl-vfx-value`);
  }

  /**
   * One axis of the Rotation triplet, by its own `aria-label` (`Rotation X` / `Y` / `Z`).
   *
   * ⚠️ **BY ACCESSIBLE NAME AND NOT BY `nth()`, WHICH IS THE FIXTURE'S NO-POSITION RULE AT ITS SHARPEST:** the
   * three handles are visually and structurally identical, so an index clause cannot see a permutation — the
   * exact defect §I's per-key legend comparison exists for, one medium over.
   */
  rotationSlider(axis: 'X' | 'Y' | 'Z'): Locator {
    return this.page.locator(
      `${SEL.framingSection} input[aria-label="Rotation ${axis}"]`);
  }

  /** The `Mirror` checkbox. ⚠️ **Its ROW is `display: none` at symmetry fold 1** — assert visibility, not count. */
  mirrorBox(): Locator {
    return this.page.locator(`${SEL.framingSection} input[aria-label="Mirror"]`);
  }

  /**
   * ⚠️ **THE CALIBRATION FOR THE WHOLE FRAMING SECTION, AND IT ASSERTS THE UNCONDITIONAL ROWS ONLY.** `Mirror`'s
   * row is hidden at fold 1, which is the state most of the library is in, so a loop over every entry fails
   * on a correct build. The unconditional ones are asserted PRESENT — Playwright's `isVisible()` does not model
   * ancestor clipping, but these rows are in the panel's own flow, not in a scrolling popup, so the weaker
   * oracle is sound here in a way it was not for the ratio list.
   *
   * ⚠️ **THE BOUND IS DERIVED FROM `Mirror`'s POSITION, NOT WRITTEN AS A NUMBER — IT WAS `slice(0, 6)` AND WOULD
   * HAVE STAYED GREEN AT SIX OVER A FIVE-ENTRY LIST**, because `slice` clamps silently and the loop would simply
   * have included the conditional row it exists to exclude. `Symmetry`'s removal (2026-09-10) moved the count and
   * that is exactly the shape `CLAUDE.md` warns about: *"never carry a total forward"*. `indexOf` re-derives it,
   * so the next insertion or removal cannot get this wrong.
   */
  async assertFramingRowsPresent(): Promise<void> {
    await expect(this.page.locator(SEL.framingSection),
      `CALIBRATION: no Composer section titled ${JSON.stringify(FRAMING_SECTION_TITLE)}. Visual FX ships a `
      + 'section with the SAME title, so this selector is pane-scoped — a missing pane scope would have found '
      + 'two elements, and a missing section would make every clause below vacuous.').toHaveCount(1);
    const conditionalAt = FRAMING_ROW_LABELS.indexOf('Mirror');
    expect(conditionalAt, 'CALIBRATION: `Mirror` is not in FRAMING_ROW_LABELS, so this loop would assert every '
      + 'row unconditionally and fail on the fold-1 presets that make up nearly the whole library.')
      .toBeGreaterThan(0);
    for (const label of FRAMING_ROW_LABELS.slice(0, conditionalAt)) {
      await expect(this.page.locator(SEL.framingRow(label)),
        `CALIBRATION: no framing row labelled ${JSON.stringify(label)} in the Composer pane.`).toHaveCount(1);
    }
  }

  /** The Speed row's range input and readout — the framing row E110 shipped first. */
  speedSlider(): Locator {
    return this.framingSlider('Speed');
  }

  speedValue(): Locator {
    return this.framingValue('Speed');
  }

  /**
   * Move the Speed slider to a POSITION (0..1), the unit the element actually carries.
   *
   * ⚠️ **THE ELEMENT'S RANGE IS POSITION SPACE, NOT SPEED — `SPEED_TRACK.fromPos` SQUARES IT.** A helper taking a
   * speed would have to duplicate the track's arithmetic in the harness, which is a second enumeration of a
   * mapping `visual-fx.ts` owns; `CLAUDE.md` forbids exactly that shape. So the spec sets a position and reads
   * the resulting speed back **from the engine** through `?testhook=1`, which is the honest direction: the harness
   * asserts the engine's answer rather than predicting it.
   *
   * ⚠️ **IT DISPATCHES `input` THEN `change`, BECAUSE THE TWO HANDLERS DO DIFFERENT THINGS** — `input` sets the
   * speed, `change` is the release-time read-back guard that re-canonicalises the handle. A spec firing only
   * `input` would never exercise the guard; one firing only `change` would never move the speed.
   */
  async dragSpeedTo(position: number): Promise<number> {
    const slider = this.speedSlider();
    await expect(slider, 'CALIBRATION: no Speed slider in the active tab content. The row is matched by its '
      + 'label text, and Visual FX ships an identically-classed row — an unscoped selector would have found '
      + 'that one instead.').toHaveCount(1);
    await slider.evaluate((el, pos) => {
      const input = el as HTMLInputElement;
      input.value = String(pos);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, position);
    await this.page.waitForTimeout(200);
    const h = await this.hook();
    expect(h, 'dragSpeedTo reads the resulting speed back from the engine — use `bootWithHook()`.').toBeTruthy();
    return h!.speedFactor;
  }

  /**
   * Move one framing slider to a POSITION (0..1) — the unit those elements carry.
   *
   * ⚠️ **`dragSpeedTo` IS NOT GENERALISED INTO THIS, DELIBERATELY: IT RETURNS THE ENGINE'S RESULTING SPEED AND
   * THIS RETURNS NOTHING.** Most framing rows have no hook field to read back, so a helper promising a value
   * would have to return `undefined` for some callers — a sentinel channel, which is where Phase 7 found both of
   * its false passes. The caller reads whatever channel its own quantity actually has.
   *
   * ⚠️ **`input` THEN `change`, BECAUSE THE TWO HANDLERS DO DIFFERENT THINGS** — `input` writes the value through
   * to the engine, `change` is `settleOnRelease`'s read-back guard. A helper firing only one exercises half the
   * control, and which half depends on the row.
   */
  async setFramingPosition(label: string, position: number): Promise<void> {
    const slider = this.framingSlider(label);
    await expect(slider, `CALIBRATION: no framing slider on the ${JSON.stringify(label)} row. Visual FX ships `
      + 'identically-classed rows and `SEL.framingRow` is pane-scoped for that reason — an unscoped selector '
      + 'would have driven the OTHER surface and still moved the engine, reporting green over an unwired '
      + 'Composer row.').toHaveCount(1);
    await this.dispatchRange(slider, position);
  }

  /*
   * ⚠️ **`setFramingValue(label, value)` WAS HERE AND IS GONE (2026-09-10), AND IT WAS DELETED BY A DESIGN
   * ARGUMENT RATHER THAN BECAUSE ITS LAST CALLER WENT.** Its doc read *"only `Symmetry` qualifies, and the
   * distinction is the row's own `min`/`max`, not a convention"* — the row's element range was `1..12` with
   * `step="1"` and no `toPos`/`fromPos`, so the position WAS the value. The owner removed that row from the
   * Composer, and with it the only framing slider whose element carries a raw value: **every surviving row is
   * position space (0..1)**, so the method's stated precondition is now satisfied by nothing.
   *
   * ⚠️ **KEEPING IT WOULD HAVE BEEN A FALSE-PASS CHANNEL, WHICH IS WHY THIS IS NOT MERELY TIDINESS.** Called on
   * any remaining row it would write e.g. `5` into a `0..1` range, the browser would CLAMP to 1 silently, and the
   * spec would read a real engine change at the track's maximum — a green clause over a value nobody asked for.
   * That is Phase 7's *"a helper returning a sentinel is a false-pass channel"* in the WRITING direction.
   * `setFramingPosition` is the one way in; `CLAUDE.md`: *read an unused symbol as a claim about the DESIGN.*
   */

  /** Move ONE axis of the Composer's Rotation triplet, by plane name. See `rotationSlider` for why not `nth()`. */
  async setRotationPosition(axis: 'X' | 'Y' | 'Z', position: number): Promise<void> {
    const slider = this.rotationSlider(axis);
    await expect(slider, `CALIBRATION: no Composer Rotation ${axis} handle. The three are addressed by `
      + '`aria-label` — they are visually and structurally identical, so an index clause could not see a '
      + 'permutation of the axes.').toHaveCount(1);
    await this.dispatchRange(slider, position);
  }

  /** The shared range-driving primitive. Kept private so no spec drives a range without both events. */
  private async dispatchRange(slider: Locator, value: number): Promise<void> {
    await slider.evaluate((el, v) => {
      const input = el as HTMLInputElement;
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await this.page.waitForTimeout(200);
  }

  /**
   * Visual FX's OWN Rotation readouts, as the three displayed strings — ⚠️ **the cross-surface read, and the only
   * channel that can discharge the owner's actual words for this row.**
   *
   * ⚠️ **`rotationSpeed` IS NOT A `?testhook=1` FIELD AND WAS NOT ADDED AS ONE.** `CLAUDE.md`: *"Nothing may be
   * added under `src/` for the harness's benefit."* Phase 2's `installTestHook()` edit was owner-approved for
   * `pos`, which no other channel could supply; this quantity HAS another channel, because Visual FX's own
   * triplet reads it from the same `getRotationSpeed()` getter on `activate()`. So the harness reads the second
   * surface instead of widening the first.
   *
   * ⚠️ **AND THAT MAKES IT THE BETTER ORACLE, NOT A FALLBACK:** the request was *"connected to exactly the same
   * settings values as in the Visual Fx tab"*, and a hook read could only ever show that the Composer reached
   * SOME engine value. This shows the two surfaces agree — which is the property that was asked for.
   *
   * ⚠️ **IT DEPENDS ON `activate()` RE-READING, AND THAT IS ASSERTED BY THE CALLER, NOT ASSUMED HERE** — none of
   * the framing setters calls `notifyExternalChange()` (E110's stated one-way staleness, which generalises to
   * every framing row), so the Visual FX handle moves ONLY because switching tabs re-syncs it. A caller that read
   * it without switching would be reading a stale build-time value and could not tell that from an unwired
   * control.
   *
   * ⚠️ **AND THERE IS A HARDER PRECONDITION UNDERNEATH THAT ONE, WHICH COST SEED 13 A RED RUN: the Visual FX pane
   * DOES NOT EXIST until that tab has been opened once** (`TabRegistry` builds containers lazily — see
   * `SEL.tabPane`). This method's own count clause catches it, but it catches it by NAMING THE ROW, so the message
   * accuses a control that is fine. **Every caller of this method must have opened `visual-fx` first**; both
   * reasons point the same way, and the second is the one a reader does not think of.
   */
  async vfxRotationReadouts(): Promise<string[]> {
    const pane = SEL.tabPane('visual-fx');
    const row = this.page.locator(`${pane} .sl-vfx-row:has(> .sl-vfx-label:text-is("Rotation"))`);
    await expect(row, 'CALIBRATION: Visual FX has no single row labelled `Rotation`. A label-only locator is '
      + 'used here because that pane has no per-section wrapper (see `vfxControl`), so the count clause is the '
      + 'only thing separating "one row" from "two rows and a positional pick".').toHaveCount(1);
    const out = await row.locator('.sl-vfx-triplet-value').allTextContents();
    expect(out, 'CALIBRATION: Visual FX\'s Rotation row does not hold three readouts. An oracle for a '
      + 'three-axis subject must read all three planes.').toHaveLength(3);
    return out.map((s) => s.trim());
  }

  /**
   * ⚠️ **`sweepRate()` IS RETIRED (2026-09-10) AND THIS IS WHAT REPLACED IT — AN ABSENCE CLAUSE WITH A POSITIVE
   * ANCHOR, BECAUSE A BARE `toHaveCount(0)` IS UNFALSIFIABLE.** Nothing about a control being absent distinguishes
   * *"the owner removed it"* from *"the tab failed to build"*, *"the label was renamed"* or *"the pane scope is
   * wrong"* — every one of those reads as a pass. So this asserts, in order: the tab content EXISTS, a control
   * that must still be there IS there, and only then that no `Sweep rate` input remains anywhere in the pane.
   *
   * ⚠️ **THE ANCHOR IS `Speed`, DELIBERATELY: it is the control the owner kept IN PLACE OF the removed one**
   * (*"having a speed factor control is sufficient"*), so if the removal ever regresses by re-adding a second
   * speed surface, this clause is the one that has to fail. **`CLAUDE.md`: *retire an unfalsifiable clause with
   * its reason in the header and replace it with one the new shape CAN fail.***
   *
   * ⚠️ **IT DOES NOT ASSERT ANYTHING ABOUT `waveSpeed` THE FIELD** — that is still stored, still varies across the
   * library and still divides every seconds label. Only the CONTROL is gone.
   */
  async assertNoSweepRateControl(): Promise<void> {
    await expect(this.page.locator(SEL.tabContent),
      'CALIBRATION: no Composer tab content, so an absence clause below would pass over a tab that never '
      + 'built.').toHaveCount(1);
    await expect(this.speedSlider(),
      'CALIBRATION: no `Speed` row in the Composer\'s framing section. `Speed` is the control the owner kept IN '
      + 'PLACE OF `Sweep rate`, so its absence means the removal cannot be measured here at all — and without '
      + 'this anchor the clause below would report the whole tab missing as a clean removal.').toHaveCount(1);
    await expect(this.page.locator(`${SEL.tabContent} ${SEL.sweepRateGone}`),
      'A `Sweep rate` input is present in the Composer pane. The owner removed that control on 2026-09-10 '
      + 'because it and `Speed` multiply the SAME advance (`dt · speedFactor` then `pos += waveSpeed · '
      + 'correction`), so two controls governed one visible rate and only one of them reset the pose. If this '
      + 'row is back, the tab has two speed surfaces again.').toHaveCount(0);
  }

  /**
   * One pane of one row, addressed by its PLANE rather than by index.
   *
   * ⚠️ **BY PLANE, BECAUSE A SET-MEMBERSHIP OR POSITIONAL CLAUSE CANNOT SEE A PERMUTATION** — `CLAUDE.md` records
   * that failure for this exact tab (§I's legend). The pane canvas carries a shipped `aria-label` of the form
   * `"<Level> in <Plane>"` (or `"Combined figure in <Plane>"`), so the plane is nameable and `nth(1)` is not
   * needed anywhere.
   */
  pane(level: 'Combined figure' | (typeof LEVEL_NAMES)[number], plane: (typeof PLANE_CAPTIONS)[number]): Locator {
    return this.page.locator(
      `${SEL.tabContent} ${SEL.pane}:has(> ${SEL.paneCanvas}[aria-label="${level} in ${plane}"])`);
  }

  /**
   * The flat caption inside one pane.
   *
   * ⚠️ **ALWAYS IN THE DOM, TOGGLED BY `display` — SO A SPEC MUST ASSERT VISIBILITY.** `CLAUDE.md`: *"`display:
   * none` stops a tab being SEEN, not WORKING"*, and the same rule has already cost this harness one wrong
   * figure on the two notices. A `count()` check here would be green on every pane in the library.
   */
  paneFlatCaption(
    level: 'Combined figure' | (typeof LEVEL_NAMES)[number], plane: (typeof PLANE_CAPTIONS)[number],
  ): Locator {
    return this.pane(level, plane).locator(SEL.paneFlat);
  }

  /**
   * ⚠️ **THE CALIBRATION FOR EVERY FLAT-CAPTION CLAUSE, AND IT IS THE ONE THAT CATCHES A RENAMED CLASS.** A pane
   * whose caption element is missing entirely reads as *"not flat"* — the silent direction, because 107c and
   * 107d are ABSENCE claims and both would pass. So assert the element EXISTS on every pane first, then assert
   * its visibility per pane.
   */
  async assertFlatCaptionsExist(): Promise<void> {
    const panes = this.page.locator(`${SEL.tabContent} ${SEL.pane}`);
    const n = await panes.count();
    expect(n, 'CALIBRATION: no `.sl-composer-pane` cells at all — the diagram did not build, and every '
      + 'flat-caption claim below would be asserting over an empty page.').toBeGreaterThan(0);
    const caps = this.page.locator(`${SEL.tabContent} ${SEL.paneFlat}`);
    expect(await caps.count(), 'CALIBRATION: the pane cells exist but carry no `.sl-composer-pane-flat` element. '
      + 'A missing caption element reads as "not flat", which is the SILENT direction: 107c and 107d are '
      + 'absence claims and both would pass.').toBe(n);
  }

  /** ⚠️ **Whether a pane is CURRENTLY showing the flat caption — the visibility question, not the count one.** */
  async paneIsFlat(
    level: 'Combined figure' | (typeof LEVEL_NAMES)[number], plane: (typeof PLANE_CAPTIONS)[number],
  ): Promise<boolean> {
    return this.paneFlatCaption(level, plane).isVisible();
  }

  /**
   * The Lab header's `Export` button, with the exported JSON returned as text.
   *
   * ⚠️ **A CLICK ALONE OBSERVES NOTHING — `exportPresetJSON` BUILDS A DETACHED ANCHOR AND CALLS `a.click()`**, so
   * the only thing a spec can read is the body of the blob that path produced. That is what makes 106f (two
   * exports byte-identical) testable at all, and it is why this returns the TEXT rather than a boolean.
   *
   * ⚠️ **THE CHANNEL IS `URL.createObjectURL`, NOT PLAYWRIGHT'S `download` EVENT, AND THE REASON IS A MEASURED
   * CONSTRAINT RATHER THAN A PREFERENCE.** Reading a download's body needs a Node stream and a `Buffer`, and
   * `tests/tsconfig.json` sets `types: []` on purpose — *"`@types/node` is not a dependency of this project and
   * adding one for the harness's convenience would be the harness editing the engine's dependency set."*
   * Measured: `createObjectURL` has exactly ONE call site in `src/` (`export.ts`'s `downloadJSON`), so the patch
   * cannot capture some other feature's blob.
   *
   * ⚠️ **IT IS AN OBSERVATION, NOT A SECOND APPLY PATH — the real button is still clicked and the real
   * `exportPresetJSON` still runs.** Phase 2's rule (*"every mutation goes through the DOM"*) is about DRIVING
   * the engine; this only watches what the engine handed the browser. **And it is strictly more precise than a
   * file: the download's NAME carries `timestampSuffix()`, which differs between two calls seconds apart and
   * would produce a false difference in the one direction 106f cares about.**
   *
   * ⚠️ **`downloadJSON` CALLS `URL.revokeObjectURL(url)` IMMEDIATELY, SO THE URL IS DEAD BEFORE ANY `await`** —
   * the patch therefore keeps the **Blob object**, which revoking does not neuter, and reads it afterwards.
   * Capturing the url string instead would have failed intermittently and looked like a flaky engine.
   */
  async exportPresetText(): Promise<string> {
    const btn = this.page.locator(SEL.exportButton);
    await expect(btn, 'CALIBRATION: no `Export` button in the Lab header. 106f has no other observation '
      + 'channel — a spec that skipped this would be asserting about two empty strings, which are equal.')
      .toHaveCount(1);

    await this.page.evaluate(() => {
      const w = window as unknown as { __exportBlobs?: Blob[]; __exportPatched?: boolean };
      if (w.__exportPatched) { w.__exportBlobs = []; return; }
      w.__exportBlobs = [];
      w.__exportPatched = true;
      const real = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (obj: Blob | MediaSource): string => {
        if (obj instanceof Blob) w.__exportBlobs!.push(obj);
        return real(obj as Blob);
      };
    });

    await btn.click();

    const text = await this.page.evaluate(async () => {
      const w = window as unknown as { __exportBlobs?: Blob[] };
      const blob = w.__exportBlobs?.[w.__exportBlobs.length - 1];
      return blob ? await blob.text() : '';
    });
    expect(text.length, 'CALIBRATION: the Export click produced no blob at all. `exportPreset()` returns early '
      + 'when `state.workingPreset` is null, so an empty reading here means nothing was exported — and two '
      + 'empty strings compare EQUAL, which is the silent direction for 106f and 106g.').toBeGreaterThan(0);
    return text;
  }

  /**
   * ⚠️ **THE EXPORT COMPARATOR, AND IT LIVES HERE BECAUSE MY FIRST VERSION OF IT WAS THE EXACT DEFECT THIS
   * PROJECT KEEPS RECORDING: AN ASSERTION THAT COULD NOT FAIL.** It was
   * `JSON.stringify(JSON.parse(s), Object.keys(JSON.parse(s)).sort())` — and `JSON.stringify`'s replacer ARRAY is
   * applied at **every depth**, not only the top level. Measured directly:
   * `norm({m:{n:1},k:2})` and `norm({m:{n:9},k:2})` both produce `{"k":2,"m":{}}` and compare **EQUAL**. Every
   * nested key absent from the top-level key set is deleted — **including the entire `overlay` block, which is
   * the only thing 106f and 106g are about.** The clause would have been green, stable, and comparing two
   * near-empty objects. `CLAUDE.md`: *"an absence test over an empty corpus reports PASS"*, arriving in a new
   * medium — and it was caught by seeding it, not by reading it.
   *
   * ⚠️ **SO THE NORMALISATION IS A RECURSIVE KEY SORT AND NOTHING ELSE — IT MAY NOT DROP A SINGLE VALUE.** Key
   * ORDER is the only thing that could produce a false difference here (the exported JSON carries no timestamp;
   * `timestampSuffix()` goes in the FILENAME, which this channel deliberately never reads). Arrays keep their
   * order, because `dye.fixedColour` is a reference type whose order is meaning.
   */
  static normalisePresetJSON(text: string): string {
    const sortDeep = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(sortDeep);
      if (v !== null && typeof v === 'object') {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(v as Record<string, unknown>).sort()) {
          out[k] = sortDeep((v as Record<string, unknown>)[k]);
        }
        return out;
      }
      return v;
    };
    return JSON.stringify(sortDeep(JSON.parse(text)));
  }

  /** The Lab header's `Snapshot` button — 106g's only way to write history. */
  async clickSnapshot(): Promise<void> {
    const btn = this.page.locator(SEL.snapshotButton);
    await expect(btn, 'CALIBRATION: no `Snapshot` button in the Lab header.').toHaveCount(1);
    await btn.click();
    await this.page.waitForTimeout(300);
  }

  /** Switch to a Lab tab by its `TabId`. ⚠️ **The spellings are `'randomiser'` and `'visual-fx'`, not the labels.** */
  async openTab(id: string): Promise<void> {
    await this.openLab();
    const btn = this.page.locator(SEL.tabBtn(id));
    await expect(btn, `no tab button with data-tab=${JSON.stringify(id)} — the TabId spellings differ from the `
      + 'labels (`randomiser`, `visual-fx`), and the last three tabs only register inside '
      + '`if (this.config.visualFxControls)`.').toHaveCount(1);
    await btn.click();
    await this.page.waitForTimeout(250);
    await this.expandGroups(id);
  }

  /**
   * v8 `32.13` — **OPEN EVERY COLLAPSIBLE GROUP AND SUB-HEAD IN A TAB, BECAUSE THE SUITE HAS NO OTHER
   * WAY TO SEE INSIDE ONE.**
   *
   * ⚠⚠ **IT EXISTS BECAUSE `verify:browser` WENT STALE THE MOMENT THE LAB WAS REGROUPED (v8 `31.U`),
   * AND THE FAILURE WAS NOT A MISSING CONTROL BUT AN INVISIBLE ONE.** Visual FX, Materials and the Composer
   * now open as closed group headers; spec `04` went red at `toBeVisible()` on the Composer's `Mirror` row,
   * which sits inside `Framing & Timing`, which sits inside the closed `Framing & Preview`. **To every
   * selector in this file a closed group is indistinguishable from a deleted section** — the same rule
   * the engine states as *`display: none` stops a row being SEEN, not working*, arriving in the harness.
   *
   * ⚠ **CALLED FROM `openTab` AND `openComposer`, WHICH ARE THE TWO WAYS IN.** A spec that reaches a
   * tab by some third route gets no expansion and will fail the way `04` did; if a third route is ever
   * added, it belongs on this list. **`capture-ui.mjs` carries the identical helper for the identical
   * reason** — two copies, and the duplication is deliberate: the harness may not import from a script
   * that drives a dev server, and a shared module would couple `verify:browser` to `manual-images`.
   *
   * ⚠ **IT CLICKS ONLY WHERE `aria-expanded` DISAGREES**, because the heads are toggles — an
   * unconditional click on an already-open group closes it, which would make the helper's effect depend on
   * what the previous spec left behind.
   */
  async expandGroups(id: string): Promise<void> {
    const opened = await this.page.evaluate((tab) => {
      const root = document.querySelector(`.tab-content[data-tab="${tab}"]`);
      if (!root) return -1;
      let n = 0;
      for (const head of root.querySelectorAll('.sl-vfx-group-head')) {
        if (head.getAttribute('aria-expanded') === 'false') { (head as HTMLElement).click(); n++; }
      }
      // The section-level heads (`Deformation` today) only matter once their own group is open, which the
      // loop above has just ensured.
      for (const sub of root.querySelectorAll('.sl-vfx-sub-head')) {
        if (sub.getAttribute('aria-expanded') === 'false') { (sub as HTMLElement).click(); n++; }
      }
      return n;
    }, id);
    expect(opened, `expandGroups(${JSON.stringify(id)}): the tab container is not in the DOM. `
      + '`TabRegistry` builds it on FIRST SHOW, so this runs after the tab button click and never before.')
      .toBeGreaterThanOrEqual(0);
    if (opened > 0) await this.page.waitForTimeout(250);
  }

  /**
   * Close the Lab by clicking the preview-grid header's `Grid` button — 106l's *"close the Lab entirely"*.
   *
   * ⚠️ **THE `if` USED TO BE THE WHOLE METHOD, AND THAT MADE IT A CONDITIONAL NO-OP — PHASE 17.7's SECOND
   * FINDING.** If `Grid` were ever renamed, moved or hidden, this returned silently having closed nothing, and
   * **106l — the ONE test in the suite that observes the engine with the Lab not built — would assert its whole
   * subject against a Lab that was still open.** Every one of its clauses passes in that state: the flag is still
   * true, the mode is still bypassed, the picture is unchanged, and `pos` still advances. **A test that cannot
   * fail is worse than a missing one** (`CLAUDE.md`: *"an UNREACHABLE assertion is worse than a missing one"*),
   * and this is the *"a SKIPPED mutation reads exactly like a caught one"* shape in a fixture ACTION rather than
   * in a clause.
   *
   * ⚠️ **THE REMEDY IS TO ASSERT THE POSTCONDITION, NOT TO DROP THE `if`.** The guard is legitimate — the Lab may
   * already be closed and a second click would re-open it — so what is asserted is the STATE the caller needs
   * (`.pg-tile` visible, i.e. the panel is in Grid mode), which is true on both branches and false exactly when
   * the close silently failed. **`setPanelMode()` makes the Grid and the Lab mutually exclusive views of one
   * panel**, so a visible tile IS the Lab being closed.
   */
  async closeLab(): Promise<void> {
    const gridBtn = this.page.locator(SEL.gridButton);
    if (await gridBtn.count() > 0 && await gridBtn.first().isVisible()) {
      await gridBtn.first().click();
    }
    await expect(this.page.locator('.pg-tile').first(), 'CALIBRATION: the Lab is not closed — no preview tile is '
      + 'visible after clicking `Grid`. ⚠️ **This assertion is what stops `closeLab()` being a conditional no-op**: '
      + 'without it a renamed or hidden `Grid` button returned silently, and step 106l — the only test that '
      + 'observes the engine with the Lab NOT built — would assert every clause against a still-open Lab, where '
      + 'all of them pass. The Grid and the Lab are mutually exclusive views of ONE panel, so a visible tile is '
      + 'the postcondition.').toBeVisible({ timeout: 30_000 });
  }

  /**
   * A coarse signature of the **WHOLE** GL canvas — the tolerance channel for *"the picture did / did not change"*.
   *
   * ⚠️ **IT IS DELIBERATELY COARSE AND THAT IS PHASE 5's WHOLE TECHNIQUE.** `dt` is wall-clock and
   * `lissajous.ts` carries a `Math.random()` gated on sparks, so **byte-equality is not available on an animated
   * frame** — the plan measured that. This returns mean brightness and a lit-fragment fraction, quantised, so an
   * unchanged look reads equal across frames while a mode change does not.
   *
   * ⚠️ **AND IT ANSWERS *"is it BLACK"* SEPARATELY**, which is 106d's actual failure: `splat` with no material
   * draws nothing, so the discriminator there is `lit === 0`, not a diff against a baseline.
   *
   * ⚠️ **IT READ A 96×96 CENTRE PATCH UNTIL 2026-09-09 AND THAT WAS THE DEFECT — IT COST TWO FALSE `lit === 0`
   * REPORTS AGAINST THE ENGINE (106d, 106j), EACH ONE THE HARSHEST VERDICT THIS FIXTURE CAN RETURN.** Both were
   * settled by LOOKING at Playwright's own failure screenshot, which showed a plainly lit figure: `Aurora
   * Borealis` draws OFF-CENTRE, and `Flower Power II` is an **annulus with a black hole exactly where the patch
   * sat.** A centre patch is not a sample of the frame — it is a sample of one composition, and *"is the preview
   * black"* is a claim about the FRAME. `CLAUDE.md` states the general rule this violated: *"measure the FINAL
   * 8-bit output"*, and invariant 21's *"one stage cannot localise a producer, and the ENDPOINTS are not enough
   * either"* — a single patch is one point, not even an endpoint.
   *
   * ⚠️ **SO IT READS THE ENTIRE FRAMEBUFFER IN ONE `readPixels` AND STRIDES THE CPU SCAN, RATHER THAN WIDENING
   * THE PATCH.** Any patch, at any size, is still a bet about where the figure is; the library is 399 presets and
   * nothing constrains their framing. The full read is 800 × 900 × 4 ≈ 2.9 MB once per call and the stride keeps
   * the loop cheap — a cost this harness can pay, and the reason the patch existed was never cost.
   *
   * ⚠️ **THE STRIDE IS 4 IN EACH AXIS AND MUST STAY COPRIME WITH NOTHING IN PARTICULAR — IT IS NOT AN ALIASING
   * GUARD, BECAUSE `mean` AND `lit` ARE AREA STATISTICS OVER ~45 000 SAMPLES.** What it must not become is a
   * stride so coarse that a thin single-curve figure falls between the samples: `lit` is compared against 0, so a
   * figure missed entirely reads as a black frame and the false report returns in a new form. **4 was chosen
   * against the thinnest thing the library draws (a one-pixel `star` trail on `Cylinder`), which spans many rows
   * at this canvas size; do not raise it without re-measuring that case.**
   *
   * ⚠️ **`lit` IS PER-MILLE OF THE SAMPLED AREA AND ITS BASIS CHANGED WITH THIS FIX** — it used to be per-mille of
   * a 96×96 patch centred on the figure, so it read HIGH; over the whole canvas the same figure reads far lower.
   * **Both are ratios in ‰ and neither is wrong, but they are different bases: never compare a `lit` from a log
   * written before 2026-09-09 with one from after.** Only `lit === 0` means the same thing on both.
   */
  /*
   * ⚠️ **THE `-1` SENTINEL IS ASSERTED AGAINST *HERE*, AND ITS ABSENCE WAS PHASE 17.7's FINDING — A FALSE-PASS
   * SHAPE IN THREE SHIPPED CLAUSES AT ONCE.** The `evaluate` below returns `{mean:-1, lit:-1}` when `#canvas` or
   * its WebGL2 context is missing, and **three clauses are pure INERTNESS clauses on `mean`** — 106c
   * (`Math.abs(after.mean - before.mean) <= 4`), 106k (`<= 6`) and 106l (`<= 8`). **`Math.abs(-1 − -1) === 0`
   * satisfies all three perfectly.** So a lost context — the exact failure this project records as *"a failed
   * compile throws nothing, links, binds and no-ops to black"* one layer out — would report the three tightest
   * tolerances in the suite as GREEN.
   *
   * ⚠️ **IT IS THE INERTNESS INVERSION AGAIN, ONE LEVEL BELOW WHERE PHASE 5 FOUND IT.** Phase 5 added `pos` to
   * those same three steps because an unchanged picture passes on a stopped engine; this is the same shape in the
   * *reading channel* rather than in the subject — **an assertion that two absent readings are equal.** The `lit`
   * consumers are safe by luck rather than design (`expect(-1).toBeGreaterThan(0)` fails loudly), which is why the
   * guard belongs to the helper and not to the callers.
   *
   * ⚠️ **ASSERTED IN ONE PLACE, LIKE `axisTriple`'s label presence — do not push it out to the call sites.** Eleven
   * call sites would be eleven chances to omit it, and `CLAUDE.md`'s *"three enumerations of one list make a
   * missing entry structurally invisible"* is the whole reason the remedy is central. **Seed 11 in
   * `08-dom-steps-seeds.spec.ts`** is what shows the guard fires — and its half A measures the false pass rather
   * than arguing it. ⚠️ **`05-phase6-seeds.spec.ts` ALSO has a seed 11 and it is a different seed: the two files
   * number independently, so cite the FILE with the number.**
   */
  async canvasSignature(): Promise<{ mean: number; lit: number }> {
    const sig = await this.readCanvasSignature();
    expect(sig.mean, 'CALIBRATION: `canvasSignature()` returned its `-1` sentinel — `#canvas` is absent or has no '
      + 'WebGL2 context. ⚠️ **This guard exists because THREE clauses compare two `mean` readings for EQUALITY '
      + '(106c, 106k, 106l), and `Math.abs(-1 − -1) === 0` satisfies every one of them** — a lost context would '
      + 'report the suite\'s tightest tolerances as green. An inertness clause gets STRONGER when its subject '
      + 'stops working, and this is that inversion inside the READING channel.').toBeGreaterThanOrEqual(0);
    return sig;
  }

  /** The raw read — ⚠️ **only `canvasSignature()` and its seed may call this; it can return the `-1` sentinel.** */
  async readCanvasSignature(): Promise<{ mean: number; lit: number }> {
    return this.page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('#canvas');
      const gl = c?.getContext('webgl2');
      if (!c || !gl) return { mean: -1, lit: -1 };
      const w = c.width, h = c.height;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const STRIDE = 4;
      let sum = 0, lit = 0, n = 0;
      for (let y = 0; y < h; y += STRIDE) {
        for (let x = 0; x < w; x += STRIDE) {
          const i = (y * w + x) * 4;
          const v = Math.max(px[i]!, px[i + 1]!, px[i + 2]!);
          sum += v;
          if (v > 16) lit++;
          n++;
        }
      }
      if (n === 0) return { mean: -1, lit: -1 };
      return { mean: Math.round(sum / n), lit: Math.round((lit / n) * 1000) };
    });
  }

  /**
   * Every slot readout's text, in slot order — **the empty string for a slot that has no readout at all.**
   *
   * ⚠️ **A SILENT SLOT HAS NO `.sl-composer-readout` ELEMENT, AND THE COMMENT HERE PREVIOUSLY CLAIMED THE
   * OPPOSITE ("the empty string, not absent"). THAT WRONG COMMENT WAS THE DEFECT AND IT COST THREE RED TESTS**
   * (107g, 107i's load half, seed 8), each reported against the engine as a 540 s timeout on `locator.textContent`
   * — i.e. `CLAUDE.md`'s *"A HARNESS FAILURE ACCUSES THE SUBJECT BY DEFAULT"*, in the exact form that rule
   * predicts. `renderSlotBody()` returns EARLY on `model.silent`, having appended only the
   * `empty — nothing authored here` div, so `readoutRow(slot)` is never built for that row. **Measured against
   * the shipped source, not inferred: `Cylinder` and `Deep Thought2` are `[false,true,true]`, so two of their
   * three rows have no readout — and both presets are named by 107g and 107i.**
   *
   * ⚠️ **`count()` FIRST, NEVER A `textContent()` WITH A SHORT TIMEOUT.** A timeout would still spend the wait and
   * would still surface as a Playwright error rather than as a reading, so the absence would remain
   * indistinguishable from a hang. The count is the honest question: *is there a readout here at all.*
   *
   * ⚠️ **AND THE EMPTY STRING IS THE RIGHT RETURN, because every caller asks either `toContain(...)` (which an
   * empty string fails, correctly — a silent row states no period) or `.not.toMatch(...)` (which it passes,
   * also correctly).** A caller needing to tell *absent* from *present-but-blank* must ask `readout(n).count()`
   * itself; no clause in spec 04 does.
   */
  async readoutTexts(): Promise<string[]> {
    const out: string[] = [];
    for (let n = 0; n < 3; n++) {
      const r = this.readout(n);
      out.push(await r.count() === 0 ? '' : ((await r.textContent()) ?? '').trim());
    }
    return out;
  }

  /*
   * ==========================================================================================
   * Phase 17.3 — the remaining DOM-channel controls
   * ==========================================================================================
   */

  /**
   * Every raw field value on one row, keyed by its `aria-label` — the round-trip unit for steps 30, 31, 34, 35,
   * 105b, 105c and 107h.
   *
   * ⚠️ **KEYED BY LABEL, NEVER AN ARRAY, BECAUSE THE STEPS THAT USE IT ASSERT *"THESE MOVED AND THOSE DID NOT"*
   * AND AN ARRAY CANNOT SAY WHICH.** `CLAUDE.md`'s *"a SET-MEMBERSHIP CLAUSE CANNOT SEE A PERMUTATION"* applies
   * to a positional read of 21 values exactly as it applied to the legend hexes: two swapped axes compare equal
   * as multisets and differ as maps. **An empty map for a silent row is the honest answer** — it has no inputs.
   */
  async rowValues(n: number): Promise<Record<string, string>> {
    return this.numInputs(n).evaluateAll((els) => {
      const out: Record<string, string> = {};
      for (const e of els) {
        const i = e as HTMLInputElement;
        out[i.getAttribute('aria-label') ?? '?'] = i.value;
      }
      return out;
    });
  }

  /**
   * Type a value into one field and COMMIT it the way a user does.
   *
   * ⚠️ **`fill()` ALONE COMMITS NOTHING ON THIS TAB — THE HANDLERS ARE `change` AND `blur`, NOT `input`**, which
   * is deliberate: `repairFigure` rounds on blur and an `input`-time commit would fight the user mid-keystroke
   * (`CLAUDE.md`: *"a control silently changing a value it was asked to display is invariant 13 inverted"*). So
   * this presses `Tab`, which fires both. **A spec that only filled would assert against a figure that never
   * changed — and "nothing changed" cannot be told from a dead handler.**
   */
  async setField(level: (typeof LEVEL_NAMES)[number], quantity: string, axis: Axis,
    value: string): Promise<void> {
    const f = this.field(level, quantity, axis);
    await expect(f, `CALIBRATION: no field labelled "${level} ${quantity} ${axis}" — the seven user-facing words `
      + 'are `Winding`, `Size`, `Shift °`, `Pulse`, `Pulse rate`, `Wobble`, `Wobble rate`, and `breathes`/`twist` '
      + 'are RETIRED as user-facing words.').toHaveCount(1);
    await f.fill(value);
    await f.press('Tab');
    await this.page.waitForTimeout(250);
  }

  /**
   * Pick a winding ratio on one level, by the caption a user reads.
   *
   * ⚠️ **IT IS NOT A `<select>`: THE CONTROL IS A `role="combobox"` BUTTON PLUS A `role="listbox"` DIV**, so it
   * must be OPENED before an option can be clicked, and `selectOption` would throw. The captions are
   * `"<text>  ·  <name>"` for a named row and `"<text>"` otherwise — **two spaces either side of the `·`**,
   * which is why this matches on the text portion rather than the whole caption.
   *
   * ⚠️ **AND IT WAITS FOR THE LIST TO BE VISIBLE, NOT MERELY PRESENT** — the list is in the DOM closed, so a
   * `count()`-based readiness check would let the click land on a hidden option. That is this harness's
   * most-recorded defect shape, and the ratio list is one more instance of it.
   */
  async pickRatio(level: (typeof LEVEL_NAMES)[number], ratioText: string): Promise<void> {
    const btn = this.page.locator(`${SEL.tabContent} ${SEL.ratioButton(level)}`);
    await expect(btn, `CALIBRATION: no ratio combobox for ${level}.`).toHaveCount(1);
    await btn.click();
    // ⚠️ Scoped to THIS level's combo wrapper. `.last()` here was a defect: three lists exist at once, so it
    // resolved to Detail's whatever button was clicked — green for `Detail`, a spurious "the list did not OPEN"
    // for Body and Structure. See `SEL.ratioListFor`.
    const list = this.page.locator(`${SEL.tabContent} ${SEL.ratioListFor(level)}`);
    await expect(list, `the ${level} ratio list did not OPEN. It is in the DOM while closed, so a \`count()\` check `
      + 'would have passed here and the click below would have landed on a hidden option.').toBeVisible();
    const opt = list.locator(SEL.ratioOption)
      .filter({ has: this.page.locator(`${SEL.ratioOptionCaption}:text-is("${ratioText}")`) });
    const alt = list.locator(`${SEL.ratioOption}:has(${SEL.ratioOptionCaption})`)
      .filter({ hasText: ratioText });
    const target = (await opt.count()) === 1 ? opt : alt.first();
    await expect(target, `no ratio row whose caption contains ${JSON.stringify(ratioText)}. RATIO_ROWS is a `
      + 'COUNTED UNION of `RATIO_TILES` and `RATIO_NAMED` and must never be hardcoded — re-run §K rather than '
      + 'reading a delta as an event.').toHaveCount(1);
    await target.click();
    await this.page.waitForTimeout(300);
  }

  /** The ratio button's current caption for one level — `—` when the windings sit on no listed ratio. */
  async ratioValueText(level: (typeof LEVEL_NAMES)[number]): Promise<string> {
    const v = this.page.locator(`${SEL.tabContent} ${SEL.ratioButton(level)} ${SEL.ratioValue}`);
    return ((await v.textContent()) ?? '').trim();
  }

  /**
   * Apply a `Stack ▾` entry by its visible label.
   *
   * ⚠️ **THE CONTROL RE-SELECTS ITS OWN PLACEHOLDER (`stack.value = ''`) AFTER EVERY PICK, AND THAT IS WHAT MAKES
   * STEP 31's *"re-pick Octaves"* POSSIBLE AT ALL** — a `<select>` that kept its selection would fire no second
   * `change`. So a repeat is two `selectOption` calls, not a double click, and this helper asserts the reset
   * afterwards: without that, a second call would silently do nothing and step 31 would pass over one apply.
   *
   * ⚠️ **`applyStack` RETURNS EARLY WHEN BODY'S MAX |winding| IS 0**, so a stack on a fresh silent figure moves
   * nothing. Step 48 works because `New Figure` seeds `SEED_WINDING = 1`; a spec stacking a zero-winding Body
   * would assert against a deliberate no-op.
   */
  async applyStack(label: string): Promise<void> {
    const sel = this.page.locator(`${SEL.tabContent} ${SEL.stackSelect}`);
    await expect(sel, 'CALIBRATION: no `Stack ▾` select — it is a `<select>` with a placeholder option, NOT a '
      + 'button, however the step words it.').toHaveCount(1);
    await sel.selectOption({ label });
    await this.page.waitForTimeout(400);
    await expect(sel, 'the stack select did not reset to its placeholder. It must, or a re-pick fires no second '
      + '`change` and step 31 passes over a single apply.').toHaveValue('');
  }

  /** `New Figure` — ⚠️ **it seeds a MEASURED LIT figure; `MigrationLayer.defaultWave()` is all zeros and renders
   *  BLACK.** Also resets every mute and rebuilds all three bodies (105h's whole chain). */
  async clickNewFigure(): Promise<void> {
    const btn = this.page.locator(`${SEL.tabContent} ${SEL.newFigureButton}`);
    await expect(btn, 'CALIBRATION: no `New Figure` button.').toHaveCount(1);
    await btn.click();
    await this.page.waitForTimeout(400);
  }

  /**
   * Click a per-quantity `✕`, or a level's `Clear`.
   *
   * ⚠️ **BOTH ARE IMMEDIATE, UNRECOVERABLE AND WRITE NO HISTORY — THE OWNER'S EXPLICIT DECISION, so a spec must
   * never assume an undo exists.** They have DIFFERENT reaches and §P owns the distinction: a `✕` clears one
   * quantity across all three axes, and `Clear` clears all 21. ⚠️ **Clearing `Winding` also disables that row's
   * `Shift` dials — a CONSEQUENCE IN A DIFFERENT CONTROL, which is what makes step 104 the one to watch.**
   */
  async clearQuantity(level: (typeof LEVEL_NAMES)[number], quantity: string): Promise<void> {
    const btn = this.page.locator(`${SEL.tabContent} ${SEL.axisClear(level, quantity)}`);
    await expect(btn, `CALIBRATION: no \`✕\` for ${level} ${quantity}. Its aria-label names all three axes `
      + 'because its SCOPE is the row.').toHaveCount(1);
    await btn.click();
    await this.page.waitForTimeout(300);
  }

  async clearLevel(level: (typeof LEVEL_NAMES)[number]): Promise<void> {
    const btn = this.page.locator(`${SEL.tabContent} ${SEL.levelClear(level)}`);
    await expect(btn, `CALIBRATION: no \`Clear\` on ${level}.`).toHaveCount(1);
    await btn.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * A shift dial's keyboard channel.
   *
   * ⚠️ **THE DIAL IS A `<canvas role="slider">`, SO IT HAS NO `value` — THE READING COMES FROM THE PAIRED
   * `Shift °` NUMBER INPUT.** A spec asserting on the canvas would have nothing to assert against.
   *
   * ⚠️ **THE SHIPPED KEYS ARE ARROWS ONLY — `±1`, OR `±90` WITH SHIFT. THERE IS NO `Home` HANDLER**, measured in
   * `installDial()`. Step 81's *"`Home` returns to 0"* therefore describes behaviour that does not exist and is
   * reported as a retired expectation rather than automated.
   *
   * ⚠️ **AND A HORIZONTAL ARROW ON A FOCUSED DIAL ALSO CYCLES THE PRESET UNDERNEATH IT — A `src/` FINDING, NOT A
   * DIAL DEFECT.** `main.ts:5498-5525` installs a global `keydown` that steps the preset on ArrowRight/ArrowLeft
   * and skips only `if (e.target.tagName === 'INPUT')` — **a dial is a `<canvas>`, so it is not skipped.** Measured
   * by probe: `ArrowRight` on Body's dial took the preset from `Aurora Borealis` to `Barrock`. ⚠️ **THE KEYMAP AT
   * `composer.ts:1884` IS INNOCENT AND READING THE SOURCE SAID SO WHILE THE STEP STILL FAILED — what localised it
   * was that the WHOLE ROW changed identically for `ArrowRight` and for a pointer drag**, i.e. a new figure had
   * arrived, not a shifted axis. `CLAUDE.md`'s *"one stage cannot localise a producer"* through a keyboard.
   * ⚠️ **REPORTED, NOT PATCHED (phases 3–7 may not edit `src/`), and the clauses in spec 06 assert the SHIPPED
   * behaviour — so a green there means the defect is still present. Do not read that green as a confirmation.**
   */
  dialFor(level: (typeof LEVEL_NAMES)[number], axis: Axis): Locator {
    return this.page.locator(`${SEL.tabContent} ${SEL.dial(level, axis)}`);
  }

  async nudgeDial(level: (typeof LEVEL_NAMES)[number], axis: Axis,
    key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', shift = false): Promise<void> {
    const d = this.dialFor(level, axis);
    await expect(d, `CALIBRATION: no dial for ${level} ${axis}. All three axes always carry one — the two-dial `
      + 'simple row was DELETED by 16.15.').toHaveCount(1);
    await d.focus();
    await this.page.keyboard.press(shift ? `Shift+${key}` : key);
    await this.page.waitForTimeout(250);
  }

  /**
   * The breathe views on one row — depth text, seconds text and each unit chip.
   *
   * ⚠️ **THESE ARE VIEWS AND DO NOT ROUND-TRIP AT ANY PRECISION** (`CLAUDE.md`, verbatim). A spec may assert what
   * they SAY and must never re-derive a stored value from one. The unit chip reads `%` over a nonzero base and
   * `abs` over a zero base — **the percent/absolute hybrid is a real authored state, not a fallback** — and the
   * seconds chip is always `s`, with an EMPTY text where no period exists.
   */
  async breatheViews(n: number): Promise<Array<{ label: string; value: string; unit: string }>> {
    return this.slot(n).locator(SEL.breatheInput).evaluateAll((els) => els.map((e) => {
      const i = e as HTMLInputElement;
      const chip = i.nextElementSibling;
      return {
        label: i.getAttribute('aria-label') ?? '?',
        value: i.value,
        unit: (chip?.className ?? '').includes('breathe-unit') ? (chip?.textContent ?? '').trim() : '',
      };
    }));
  }

  /**
   * ONE breathe view, by the four facts that identify it — ⚠️ **and the LABEL FORMAT LIVES HERE ONCE, because it
   * is not the format a spec would guess.** The shipped label is
   * `` `${SLOT_LABELS[slot]} ${lab.textContent} ${AXIS_LABELS[a]} ${ariaSuffix}` ``, i.e.
   * **`Body Pulse (% · s) X depth`** — the row label is interpolated WHOLE, parenthetical and middle dot
   * included, so the axis sits in the MIDDLE of the label and not at its end.
   *
   * ⚠️ **A SPEC MATCHING `label.endsWith(axis)` FINDS NOTHING, AND THAT IS THE SILENT DIRECTION: `find()` returns
   * `undefined`, and every clause reading `.value` off it would throw rather than report — or, written
   * defensively, would pass over nothing at all.** `CLAUDE.md`'s *"an absence test over an empty corpus reports
   * PASS"*, reached through a label format instead of a selector. **This helper asserts the view was FOUND**, so
   * a format change fails naming the label rather than the step.
   */
  async breatheView(n: number, which: 'Pulse' | 'Wobble', axis: Axis, kind: 'depth' | 'seconds'):
  Promise<{ label: string; value: string; unit: string }> {
    const want = `${LEVEL_NAMES[n]} ${which} (% · s) ${axis} ${kind}`;
    const all = await this.breatheViews(n);
    const hit = all.find((v) => v.label === want);
    expect(hit, `CALIBRATION: no breathe view labelled ${JSON.stringify(want)}. The 12 labels on this row are: `
      + `${JSON.stringify(all.map((v) => v.label))}. The shipped format interpolates the ROW LABEL whole — `
      + '`Body Pulse (% · s) X depth` — so the axis is in the MIDDLE, and a matcher keyed on the label ENDING '
      + 'with the axis silently finds nothing.').toBeTruthy();
    return hit!;
  }

  /** The `input` element behind one breathe view, for the clauses that must EDIT one (steps 86, 88, 89). */
  breatheField(n: number, which: 'Pulse' | 'Wobble', axis: Axis, kind: 'depth' | 'seconds'): Locator {
    return this.page.locator(
      `${SEL.tabContent} input[aria-label="${LEVEL_NAMES[n]} ${which} (% · s) ${axis} ${kind}"]`);
  }

  /**
   * Import a preset from a JSON string, through the real dialog.
   *
   * ⚠️ **THIS IS THE CHANNEL THAT MAKES STEPS 38, 56, 65 AND 105f AUTOMATABLE AT ALL, AND IT IS NOT A SHORTCUT
   * PAST THE UI.** `importPresetWithDialog()` creates a TRANSIENT `input[type=file]` and calls `.click()` on it,
   * so the spec arms `filechooser` FIRST and then presses `Import` — the reverse order misses the event and waits
   * out the timeout. The name is then confirmed through the dialog's own `Add to presets` button, which is where
   * `validate()` refuses a duplicate case-insensitively.
   *
   * ⚠️ **THE DIALOG PRE-RESOLVES A DUPLICATE TO ` v<n>` BEFORE IT EVER OPENS**, so a spec re-importing an
   * exported file gets a NEW name and must load the tile by that name. **A preset name is a primary key in FIVE
   * owners, so a duplicate freezes a tile rather than repeating a label** — this helper returns the name that was
   * actually committed rather than the one that was requested.
   */
  async importPresetJSON(json: string, filename = 'spec-import.json'): Promise<string> {
    /*
     * ⚠️ **THE LAB IS OPENED FIRST, AND OMITTING THIS COST 540 s PER CALL IN EXACTLY THE SHAPE
     * `playwright.config.ts` WARNS ABOUT.** `SEL.importButton` lives in the Lab HEADER: it is in the document but
     * `display: none` while the preview grid owns the panel (`setPanelMode()` — *"the grid and the Lab are mutually
     * exclusive views of one panel"*). Measured after a `bootWithHook()`: `count() === 1`, `isVisible() === false`.
     * So a spec that reloads and then imports armed `waitForEvent('filechooser')` against a click Playwright would
     * never dispatch, and the wait ran to the per-test deadline — surfacing as `Target page … has been closed`,
     * **indistinguishable from a renderer crash and accusing the engine by default.** ⚠️ **A `count()` guard would
     * have PASSED here; visibility is the discriminating question.** `openLab()` is idempotent, so calling it
     * unconditionally is cheaper than making every caller remember the ordering.
     */
    await this.openLab();
    const importBtn = this.page.locator(SEL.importButton);
    await expect(importBtn, 'CALIBRATION: the `Import` button is not VISIBLE even with the Lab open, so arming the '
      + 'file chooser below would wait out the whole per-test deadline and report the timeout as a page crash.')
      .toBeVisible();

    const chooserPromise = this.page.waitForEvent('filechooser');
    await importBtn.click();
    const chooser = await chooserPromise;
    /*
     * ⚠️ **A `Uint8Array` HERE FAILS AT RUNTIME, AND THE EARLIER COMMENT CLAIMING OTHERWISE WAS WRONG — MEASURED,
     * NOT REASONED.** `new TextEncoder().encode(json)` type-checks and reads as the dependency-free choice, but
     * Playwright serialises `FilePayload.buffer` by calling **`.toString('base64')`** on it. A `Uint8Array`'s
     * `toString` ignores the argument and returns `"123,34,97,…"`, which the injected script then hands to
     * `atob` — surfacing as:
     *
     *     fileChooser.setFiles: InvalidCharacterError: Failed to execute 'atob' on 'Window'
     *
     * ⚠️ **AND NOTE WHICH DIRECTION THAT FAILED IN: LOUDLY, INSIDE `setFiles`, NAMING `atob` — so it accused the
     * harness rather than the engine.** That is the good case. The bad case was available: had the digits happened
     * to be valid base64, the import would have proceeded with GARBAGE and steps 38, 56, 65 and 105f would have
     * reported a lossy round trip as an ENGINE defect. **The type-checker could not see any of this** —
     * `skipLibCheck` let `FilePayload.buffer` degrade, which is exactly why it compiled.
     *
     * ⚠️ **`Buffer` IS PRESENT AT RUNTIME (Playwright's runner is Node) AND ABSENT FROM THE TYPES ON PURPOSE.**
     * `tests/tsconfig.json` sets `"types": []` so the harness never adds `@types/node` to the engine's dependency
     * set — `CLAUDE.md`: the engine's compile settings are not the harness's to change. So the ONE name needed is
     * declared locally, in the narrowest form that expresses the one call made. **Do not widen this to
     * `@types/node`, and do not "simplify" it back to `TextEncoder`.**
     */
    const nodeBuffer = (globalThis as unknown as {
      Buffer: { from(s: string, enc: string): { toString(enc: string): string } };
    }).Buffer;
    expect(typeof nodeBuffer?.from, 'CALIBRATION: `Buffer` is not available in the test runner, so a preset file '
      + 'cannot be handed to the file chooser at all. A `Uint8Array` is NOT a substitute — Playwright calls '
      + '`.toString("base64")` on the payload, which a typed array answers with a comma-joined digit list.')
      .toBe('function');
    await chooser.setFiles({ name: filename, mimeType: 'application/json',
      // ⚠️ The cast target is `Uint8Array`, NOT `Buffer` — `Buffer` is not a NAME here either (that is the same
      // `"types": []` decision), and a real `Buffer` IS a `Uint8Array` at runtime, so this narrows honestly.
      buffer: nodeBuffer.from(json, 'utf8') as unknown as Uint8Array });

    const nameInput = this.page.locator('input[type="text"]').last();
    await expect(nameInput, 'the Import dialog did not open — `showImportDialog` builds a fixed overlay with a '
      + '`Preset name` text input, and without it the confirm click below has nothing to confirm.').toBeVisible();
    const committed = (await nameInput.inputValue()).trim();

    const confirm = this.page.locator(SEL.importConfirm);
    await expect(confirm, 'no `Add to presets` button — that is the dialog\'s confirm label, not `Import` or '
      + '`OK`.').toBeVisible();
    await confirm.click();
    await this.page.waitForTimeout(600);
    return committed;
  }

  /** Region D's amber precondition — ⚠️ **inline copy, ALWAYS in the DOM, toggled by `display`.** */
  precondition(): Locator {
    return this.page.locator(`${SEL.tabContent} ${SEL.precondition}`);
  }

  /**
   * One Visual FX control, identified by **its section title AND its row label** — the only pair that is unique.
   *
   * ⚠️ **NEITHER HALF ALONE WORKS, AND THAT IS MEASURED: `Blend` IS THE LABEL OF *TWO* ROWS** — the Attractor's
   * (`attractorBlend`) and physarum's (`setPhysarumBlend`), plus `Blend (γ)` for the fluid and `Force Blend` in the
   * force-gate section. A label-only locator resolved to **2** elements and the assertion failed reporting
   * *"no Attractor `Blend` slider"* — ⚠️ **a message that accuses the tab of missing a control it actually ships
   * TWICE**, which is `CLAUDE.md`'s *"A HARNESS FAILURE ACCUSES THE SUBJECT BY DEFAULT"* with the accusation
   * inverted from duplication into absence.
   *
   * ⚠️ **AND `.last()` IS NOT THE FIX, THOUGH IT COMPILES AND WOULD HAVE PASSED HERE.** `CLAUDE.md`: *"Select on
   * the label, never on position."* A positional pick silently follows whichever section happens to come last, so
   * inserting a new section — which Visual FX invites, *"add a control by writing a descriptor"* — moves it to a
   * different control with no failure. **This is the one selector shape a permutation cannot be seen through.**
   *
   * ⚠️ **`:has()` CANNOT SCOPE BY SECTION HERE: `sectionTitle()` AND `makeRow()` PRODUCE FLAT SIBLINGS.** There is
   * no per-section wrapper element — read `buildCustomizePanel`'s `el.appendChild(...)` sequence. So the scope has
   * to be expressed as DOM ORDER: the rows belonging to a section are the siblings between its
   * `.sl-section-title` and the next one. That is what this walks, and it is why the resolution happens in
   * `evaluate` rather than in a selector string.
   */
  async vfxControl(section: string, label: string, kind: 'input' | 'select'): Promise<Locator> {
    const pane = SEL.tabPane('visual-fx');
    const css = kind === 'select' ? 'select' : 'input[type="range"]';

    /*
     * ⚠️ **THE WALK RETURNS AN *INDEX*, NOT AN ELEMENT HANDLE, SO THE RESULT IS AN ORDINARY LOCATOR.** Returning a
     * handle would force every caller onto `ElementHandle`, which does not auto-wait and cannot be used with
     * `expect(locator)` matchers — so the clauses would lose the retry semantics every other selector here has.
     * The index is resolved ONCE against the same `css` list the returned locator enumerates, which is what keeps
     * the two in step.
     */
    const idx = await this.page.locator(pane).evaluate((root, args) => {
      const [sec, lab, sel] = args as [string, string, string];
      const all = [...root.querySelectorAll(sel)];
      const titles = [...root.querySelectorAll('.sl-section-title')];
      const start = titles.find((t) => (t.textContent ?? '').trim() === sec);
      if (!start) return -2;
      for (let n = start.nextElementSibling; n; n = n.nextElementSibling) {
        // The next section title ENDS this section — that boundary is the whole point of the walk.
        if (n.classList.contains('sl-section-title')) break;
        const own = n.querySelector(':scope > .sl-vfx-label');
        if (own && (own.textContent ?? '').trim() === lab) {
          const hit = n.querySelector(sel);
          return hit ? all.indexOf(hit) : -3;
        }
      }
      return -1;
    }, [section, label, css]);

    expect(idx, `CALIBRATION: could not locate \`${label}\` (${kind}) inside Visual FX's \`${section}\` section `
      + `— the walk returned ${idx} (-2 = no such section title, -1 = no such row label in it, -3 = the row `
      + 'holds no such control). ⚠️ A label-only locator is NOT the fallback: `Blend` labels two different rows '
      + '(Attractor and physarum), so it resolves to 2 elements and fails claiming the control is ABSENT.')
      .toBeGreaterThanOrEqual(0);

    return this.page.locator(pane).locator(css).nth(idx);
  }

  /**
   * The three axis values of ONE quantity on one row, as numbers — the read every winding/size clause needs.
   *
   * ⚠️ **IT EXISTS BECAUSE THE OBVIOUS INLINE FORM IS VACUOUS, AND THAT WAS MEASURED RATHER THAN REASONED.** The
   * shape it replaces was `(['X','Y','Z'] as const).map((a) => Number(v[`${level} ${q} ${a}`] ?? 'NaN'))`, and it
   * appeared FOUR times — `CLAUDE.md`'s *"three enumerations of one list make a missing entry structurally
   * invisible"*, with the twist that here the duplication concealed a defect rather than an omission:
   *
   *   - a missing label yields `NaN`, so the triple is `[NaN, NaN, NaN]`; and
   *   - **`expect([NaN,NaN,NaN]).toEqual([NaN,NaN,NaN])` PASSES** (measured with Playwright 1.63 — `toEqual`
   *     uses SameValueZero, under which `NaN` equals itself).
   *
   * So every idempotence and unchanged-by clause written that way — steps 31, 33, 67, 69, 73 — **would have
   * reported PASS if the `aria-label` format ever changed**, comparing one absent read against another. Two
   * absent reads are equal; that is the whole failure. **This is `CLAUDE.md`'s *"an absence test over an empty
   * corpus reports PASS"* reaching an EQUALITY clause**, which is the direction the rule is usually not stated in.
   *
   * ⚠️ **SO THE PRESENCE OF ALL THREE LABELS IS ASSERTED HERE, ONCE, AND A CHANGE FAILS NAMING THE LABEL.** Do
   * not inline this back, and do not "simplify" the presence assertion away: it is the only thing standing
   * between five clauses and vacuity.
   */
  async axisTriple(level: (typeof LEVEL_NAMES)[number], quantity: string,
    values?: Record<string, string>): Promise<[number, number, number]> {
    const v = values ?? await this.rowValues(LEVEL_NAMES.indexOf(level));
    const keys = (['X', 'Y', 'Z'] as const).map((a) => `${level} ${quantity} ${a}`);
    const missing = keys.filter((k) => v[k] === undefined);
    expect(missing, `CALIBRATION: ${JSON.stringify(missing)} absent from the row's inputs. The labels present `
      + `are ${JSON.stringify(Object.keys(v))}. ⚠️ Without this assertion the triple would be [NaN,NaN,NaN] and `
      + '`toEqual` would compare it EQUAL to any other absent read — every idempotence clause using it would '
      + 'report PASS over two things that are not there.').toEqual([]);
    /*
     * ⚠️ **AN EMPTY INPUT IS NOT A ZERO, AND `Number('')` IS `0` RATHER THAN `NaN` — SO THE GUARD BELOW CANNOT
     * CATCH IT AND THE BLANK-ROW DEFECT ARRIVED AS *"the seed wrote no winding"*.** That message named the wrong
     * mechanism for a real defect: the source demonstrably writes the winding, and it took a probe reading the
     * raw `value` strings to see they were all `''`. **A blank field and an authored 0 are different states and
     * only one of them is a value** — `CLAUDE.md`'s *"a guard releasing to 0 hides its own trip; use a
     * representable sentinel"*, reached through a DOM string instead of a shader. Asserted BEFORE the numeric
     * coercion, because after it the two are indistinguishable.
     */
    const blank = keys.filter((k) => (v[k] ?? '').trim() === '');
    expect(blank, `CALIBRATION: ${JSON.stringify(blank)} is present but BLANK. An empty numeric input coerces to `
      + '0, so every clause below would read it as an authored zero and a failure would accuse whatever last '
      + 'wrote that field. ⚠️ This is the shape of the level-checkbox finding, FIXED in `src/` 2026-09-10: '
      + '`setLevelEnabled` used to commit BEFORE `renderSlotBody`, so `sync()` filled the OLD inputs and the '
      + 'freshly built ones were never written — 21 blank fields over a correctly seeded model. The guard stays '
      + 'because the COERCION, not that one call order, is what makes a blank indistinguishable from an authored '
      + '0 — the next such defect reads identically.').toEqual([]);

    const out = keys.map((k) => Number(v[k]));
    const bad = out.filter((x) => Number.isNaN(x));
    expect(bad.length, `CALIBRATION: a ${level} ${quantity} input holds a non-numeric value `
      + `(${JSON.stringify(keys.map((k) => v[k]))}), so a numeric comparison below is meaningless.`).toBe(0);
    return out as [number, number, number];
  }

  // ---- Phase 17.4 additions — the pane PIXEL channel -------------------------------------------------
  //
  // ⚠️ **A `toHaveScreenshot` BASELINE IS THE WRONG INSTRUMENT FOR EVERY STEP IN PHASE 4 AND THE REASON IS WHAT
  // THE STEPS ASK.** 22a asks whether two panes are FLATTER than a third; 22b whether the cyan curve is a
  // different SIZE from the white one; 20 whether cyan and amber are ABSENT. None of those is "does this pane
  // match a stored PNG" — a baseline answers a question nobody asked, goes stale on any legitimate retune, and
  // when it fails it names no quantity. **These read the ink instead, per colour, so a failure names which curve.**
  //
  // ⚠️ **AND THE DIAGRAM IS THE ONE SURFACE WHERE THIS IS SAFE: it is 2D canvas at "no rotation, no canvas fit,
  // one frozen instant"** (the plan's words) — deterministic, unlike the GL frame, which is why Phase 5's clauses
  // are a hook read and these are a pixel read.

  /**
   * The ink of one pane, bucketed by the three curve colours the legend names.
   *
   * ⚠️ **THE BUCKETS ARE DERIVED FROM `OVERLAY_STYLES` IN `score-canvas.ts` — `winding` amber `rgba(224,168,72)`,
   * `size` cyan `rgba(96,214,224)`, `now` white `rgba(235,242,255)` — AND THE CLASSIFIER IS A HUE TEST RATHER THAN
   * AN EXACT MATCH, because every pixel is composited at 0.75/0.95 alpha over a translucent panel and
   * anti-aliased.** An exact-RGB clause would count almost nothing and report every curve ABSENT, which is the
   * silent direction for step 20.
   *
   * ⚠️ **`r > b` ⇒ amber, `b > r` ⇒ cyan, `|r − b|` small ⇒ white. That ordering is the whole classifier and it is
   * what makes a PERMUTED palette visible**: swapping the cyan and amber constants swaps the two counts, which a
   * "some non-background ink exists" clause cannot see (`CLAUDE.md`: a set-membership clause cannot see a
   * permutation). The faint axis crosshair is `rgba(255,255,255,0.10)` — neutral, so it lands in `white`, and every
   * clause below is written as a comparison rather than an absolute count for that reason.
   *
   * ⚠️ **THE THRESHOLD IS THE EXPORTED `HUE_SPLIT`, WHOSE DOC COMMENT OWNS THE DERIVATION AND THE MEASUREMENT OF
   * THE HAND-PICKED 24 IT REPLACES — A DEFECT THAT SHIPPED RED, FAILING STEP 20 AND SEED 3 ON A CORRECT DIAGRAM.**
   * It is not restated here: `CLAUDE.md`'s *"A COMMENT THAT RECITES A THRESHOLD IS A SECOND COPY OF IT"* — the
   * recitation in step 20 was itself part of what made a 4-unit margin read as a safety argument.
   *
   * ⚠️ **AN ALPHA FLOOR CANNOT SUBSTITUTE FOR THE SPLIT: the artefact was a MARGIN failure, not a faintness one**,
   * and raising the floor would also drop the real curves' own soft edges from `total`.
   */
  async paneInk(
    level: 'Combined figure' | (typeof LEVEL_NAMES)[number], plane: (typeof PLANE_CAPTIONS)[number],
  ): Promise<{ amber: number; cyan: number; white: number; total: number; w: number; h: number }> {
    const canvas = this.pane(level, plane).locator(SEL.paneCanvas);
    await expect(canvas, `CALIBRATION: no pane canvas for "${level} in ${plane}". The shipped \`aria-label\` is `
      + '`"<Level> in <Plane>"`, and a missing canvas makes every ink count 0 — under which "no cyan curve" and '
      + '"the pane did not build" are the same reading.').toHaveCount(1);

    // ⚠️ `HUE_SPLIT` is passed in as an ARGUMENT, not closed over: `evaluate` runs in the PAGE, where this
    // module does not exist. It is shared with 22b's per-hue spread — see the constant's own doc comment.
    const ink = await canvas.evaluate((el, split) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      const { width: w, height: h } = c;
      if (w === 0 || h === 0) return { amber: 0, cyan: 0, white: 0, total: 0, w, h };
      const d = ctx.getImageData(0, 0, w, h).data;
      let amber = 0, cyan = 0, white = 0, total = 0;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3]!;
        // ⚠️ The threshold is on ALPHA, not on luminance: the canvas is cleared to fully transparent, so a
        // luminance test over premultiplied-looking data would count the cleared area as black ink.
        if (a < 8) continue;
        total++;
        const r = d[i]!, b = d[i + 2]!;
        if (r - b > split) amber++;
        else if (b - r > split) cyan++;
        else white++;
      }
      return { amber, cyan, white, total, w, h };
    }, HUE_SPLIT);

    expect(ink, 'CALIBRATION: the pane canvas has no 2D context, so no clause below has a subject.').not.toBeNull();
    expect(ink!.w, `CALIBRATION: the "${level} in ${plane}" pane canvas has a zero-width backing store. `
      + '`drawOverlayScore` assigns `canvas.width` from `clientWidth * dpr` and falls back to 120 — a 0 here means '
      + 'the pane has no layout yet, and every ink count would be 0 while the diagram is fine.')
      .toBeGreaterThan(0);
    return ink!;
  }

  /**
   * How far one pane's ink spreads from the pane centre, as a fraction of the half-extent it was drawn at.
   *
   * ⚠️ **THIS IS 22a's ACTUAL QUANTITY AND AN INK COUNT IS NOT IT.** A flat pane draws a horizontal LINE, which
   * has plenty of ink — so "fewer pixels" cannot distinguish flat from full, and a count-based 22a would pass on
   * a pane fitted individually. What 22a claims is that the two Z panes reach LESS FAR VERTICALLY than the X/Y
   * pane does, because all three are drawn at ONE shared extent (`OverlayScore.extent`, whose doc comment says
   * the sharing is the point). **So measure the vertical spread and compare panes.**
   *
   * ⚠️ **THE CROSSHAIR IS EXCLUDED BY ALPHA (`0.10` ⇒ 25/255) AND THAT EXCLUSION IS LOAD-BEARING:** it spans the
   * full width and height of the box, so including it would report every pane as reaching 100 % and 22a could
   * never fail. The curves are drawn at 0.75 and 0.95.
   */
  async paneSpread(
    level: 'Combined figure' | (typeof LEVEL_NAMES)[number], plane: (typeof PLANE_CAPTIONS)[number],
  ): Promise<{ vertical: number; horizontal: number; ink: number }> {
    const canvas = this.pane(level, plane).locator(SEL.paneCanvas);
    await expect(canvas, `CALIBRATION: no pane canvas for "${level} in ${plane}".`).toHaveCount(1);

    const out = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx || c.width === 0 || c.height === 0) return null;
      const { width: w, height: h } = c;
      const d = ctx.getImageData(0, 0, w, h).data;
      let minX = w, maxX = -1, minY = h, maxY = -1, ink = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // ⚠️ 64, not 8: the crosshair is drawn at alpha 0.10 (≈25) and spans the whole box, so an 8 threshold
          // would make every pane read as full and 22a unfailable. The curves are 0.75 and 0.95.
          if (d[(y * w + x) * 4 + 3]! < 64) continue;
          ink++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (ink === 0) return { vertical: 0, horizontal: 0, ink: 0 };
      return { vertical: (maxY - minY) / h, horizontal: (maxX - minX) / w, ink };
    });

    expect(out, `CALIBRATION: the "${level} in ${plane}" pane could not be measured (no context or zero-size `
      + 'backing store), so a spread comparison below would compare two zeros — which are EQUAL.').not.toBeNull();
    return out!;
  }
}

/**
 * ⚠️ **THE CALIBRATION HELPER, PRESENT FROM PHASE 1 RATHER THAN DEFERRED TO PHASE 7, BECAUSE A HARNESS THAT
 * CANNOT FAIL IS WORSE THAN NO HARNESS.** `composercheck` runs every property twice — once on real data
 * expecting PASS, once on a deliberately broken copy expecting FAIL — and reports a seed that passes as a
 * CALIBRATION FAIL. The browser equivalent of a seed is a NEGATIVE CONTROL: assert that a selector which must
 * NOT match really does not, so a spec's positive assertions are known to be discriminating rather than
 * vacuous.
 *
 * ⚠️ **This is the shape that catches the harness's own characteristic lie: `expect(locator).toHaveCount(0)`
 * passes identically whether the thing is absent or the PAGE is.** So it takes an anchor that must be present
 * and asserts it, before asserting the absence. **An absence test over an empty corpus reports PASS** —
 * `CLAUDE.md` states that rule for text scans; it is the same rule here.
 */
export async function assertAbsentAgainstLivePage(
  present: Locator, absent: Locator, what: string,
): Promise<void> {
  const anchorCount = await present.count();
  expect(anchorCount, `CALIBRATION: the anchor for "${what}" matched nothing, so the absence claim below `
    + 'would have passed over an empty page. Assert the corpus is non-empty before asserting an absence.')
    .toBeGreaterThan(0);
  await expect(absent, what).toHaveCount(0);
}

export const test = base.extend<{ composer: ComposerPage }>({
  composer: async ({ page }, use) => {
    const c = new ComposerPage(page);
    await c.boot();
    await use(c);
  },
});

export { expect };
