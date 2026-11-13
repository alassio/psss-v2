/**
 * # The **Transmap** tab — the separable static field, showing the terms the engine is actually using
 *
 * The Composer's counterpart for the image-domain warp: the tab where a field's **terms** are authored, the
 * numbers on screen are the ones the frame is warped by, and the measured size of the result is stated.
 *
 * ⚠️ **THE WORKING PHRASE "field editor" IS RETIRED AND MAY NOT APPEAR HERE, IN COPY, IN A CHECKER OR IN THE
 * PLAN AGAIN** (owner, 2026-09-21). The tab is `Transmap`.
 *
 * ## The one requirement everything below serves
 *
 * *"the diagram, the selection in the dropdowns and the specific numbers in the wave tables reflect exactly
 * the settings of the current preset also shown in the main preview … changing any selection … or any values
 * in the tables shall directly be reflected in the diagram as well in the transmap settings of the preset
 * which is animated in the main preview"* (owner, 2026-09-22, second commission).
 *
 * ⚠️ **THAT SUPERSEDES THE BINDING ANSWER OF THE SAME DAY (§M.1, "show each preset in the regime it is stored
 * in"), AND WITH IT THE RULE THAT ONLY `⤓ Bake to terms` MAY CONVERT A REGIME.** Both buttons are gone, and
 * the rows now show **live resolved terms, editable** in BOTH regimes — the owner's answer to the one fork
 * this reversal opens. So:
 *
 * - **Table regime** (`pattern` = `(Preset)` / unknown; **136 of the library's 154 separable layers**): the
 *   preset's own 4×4 `SinMagicParams` IS what the engine reads, so the rows are the stored data unchanged.
 *   `strength` is a relative gain around 0.5, so **0.5 is byte-identical to no gain at all**; `detail` is
 *   deliberately not applied and its row is hidden.
 * - **Archetype regime** (**18 layers**, every one an engine-era demo): the rows show `bakeStaticField()`'s
 *   terms — the ones `resolveStaticWaves` builds its waves from — and **typing in one ADOPTS them**
 *   (`pattern` → `(Preset)` at the parity `strength`), which is the old bake happening on the edit instead of
 *   on a button.
 *
 * ⚠️ **THE ADOPTION'S SCALAR IS CANVAS-DEPENDENT AND THAT COST IS ACCEPTED, NOT FIXED** — `Grid Lattice`
 * style 1 measures k = 0.0572 at 16:9 against 0.0883 at 1:1, a 1.54× swing — so a field adopted by typing
 * freezes its size at the window the user typed at. The shape is exact (element-wise relative error ≤ 1.8e-16
 * over styles 0-3 and four canvas shapes); only the magnitude is pinned. **`adoptShownTerms()` is the ONE
 * conversion site** and the identification line is where the user is told.
 *
 * ⚠️ **NO ROW IS READ-ONLY ANY MORE, AND THAT REVERSES THE 2026-09-22 REFUSAL** (owner, 2026-09-23: *"the
 * table is set according to the config that corresponds to the selected value but the table remains
 * editable"*). The one case that used to refuse — a style-3 archetype whose `zoomBias` is not 1, i.e. **every**
 * Zoom Combined layer, since the field defaults to 0 — is now EXACT: `carryZoomBias()` writes the bias as a
 * frequency-0 slot, which is pure DC on both paths. The five archetypes that fill all four zoom slots have
 * nowhere to put it, and there `StaticFieldBake.warning` is the note under the rows, shown BEFORE the edit that
 * would drop the steady zoom. **The note is the bake's own sentence and the bake is its own gate** — never
 * re-derive either from the style or the bias.
 *
 * ## Scope — §H's SPLIT IS REVERSED (owner, 2026-09-23)
 *
 * This tab owns the **separable static field of the layer you PICK**, plus that layer's `Style`, its mute, its
 * zoom half and its zoom centre. **Visual FX keeps the chain's SHAPE** — add, remove, reorder, the weights, the
 * pass-order flag and styles 4-11 — and since 2026-09-23 it edits every per-layer scalar on this tab as well,
 * inside its own chain rows.
 *
 * ⚠️ **THE RULE THAT REPLACED §H IS NOT "TWO OWNERS ARE FINE" — IT IS "ONE OWNER OF THE DATA, TWO EDITORS OF
 * IT".** §H banned a second editor because *two owners of one subject* is a real failure class; what makes two
 * editors safe is that neither owns anything. Both go through `getTransMapChain()` → patch → `setTransMapChain()`,
 * both getters COPY, **neither caches a layer object**, and the measurement and the drift track are shared as
 * FUNCTIONS (`field-measure.ts`, `DRIFT_TRACK`) rather than transcribed. What is duplicated is the widget; what
 * is not duplicated is the number, the resolver, the measurement or the words.
 *
 * ⚠️ **THE WAVE TABLES ARE THE ONE THING THAT STAYS SINGLE-OWNER, AND THE REASON IS THE DATA, NOT THE SPLIT:**
 * `sinMagicParams` is PRESET data shared by every layer in the chain, so there is no per-layer copy to edit
 * per-layer. The owner's instruction says so directly — *"the wave details are global and can only be edited
 * globally and not per individual transmap"* — and `multiLayerEl` is where a user is told, because a term typed
 * here moves every separable layer at once and nothing on screen would otherwise say so.
 *
 * ⚠️ **THE PICK IS POSITIONAL AND CARRIED BY TWO FIELDS (`index` + `style`), SO A MISMATCH DROPS IT RATHER THAN
 * MOVING IT** — the Reel's preview-marker rule, and for the same reason: a chain has no per-layer identity, so a
 * remembered index alone would silently follow a Visual FX reorder onto a different layer and every control here
 * would describe it without a word changing. `editedIndex()` is the ONE resolver (invariant 17: one order, and
 * nothing may re-derive it), the pick is cleared on `activate()` and on every external change, and a dropped
 * pick falls back to the FIRST separable layer, which is exactly the behaviour this tab had before the picker.
 *
 * ## Where the silent failures are
 *
 * ⚠️ **THE WHOLE TAB IS BUILT ONCE AND VISIBILITY IS TOGGLED — no section is ever rebuilt, and that is a
 * decision against the Composer's worst defect class rather than laziness.** `adoptExternalFigure()`'s
 * post-mortem is that *replacing the figure must rebuild the row BODIES, not only the values*: a stale body
 * over incoming data routes the next edit through the wrong writer. Building every style's section up front
 * and hiding the ones this style does not read makes that class **unreachable** — there is no body to go
 * stale — at the cost of a few hidden inputs that `sync()` writes into and nobody can see. **Do not
 * "optimise" this into conditional construction.**
 *
 * ⚠️ **Two write paths, and mixing them up is silent both ways (§F).** The **tables** live on the preset
 * (`postProcessors.transMap.sinMagicParams`), so an edit must mutate `state.workingPreset` in place **and**
 * call `controls.setTransMapWaveTables` — the Lab's copy is what Export, Snapshot and the Mixer read, and
 * `main.ts`'s `preset` is what the frame draws; they are **different objects** that otherwise converge only on
 * a preset change. The **chain** (`style`, `staticField`, `zoomCenter`) is engine state, reaches Export through
 * `getOverlaySnapshot()`, and is written with `getTransMapChain()` → patch → `setTransMapChain()`.
 * **Never `state.setWorkingPreset`**, which re-inits the generator and resets `pos`.
 *
 * ⚠️ **A drag calls `refreshDerived()`, never `sync()`.** `sync()` writes every control's value, so calling it
 * from an `input` handler would fight the pointer on the slider being dragged — Visual FX's `setStaticField`
 * has the same rule for the same reason. Structural events (style, pattern, a checkbox, a typed term) call
 * `sync()`.
 *
 * ⚠️ **THE TERM ROWS ARE FILLED FROM `refreshDerived()`, NOT FROM `sync()`, AND THAT IS FORCED BY THE ROWS
 * BEING LIVE VALUES.** In the archetype regime `Strength` and `Detail` change the resolved amplitudes and
 * frequencies, so a drag has to rewrite them — filling them from `sync()` alone would leave a table that
 * disagreed with the picture beside it for the whole drag, which is the exact symptom this rewrite exists to
 * remove. They are not the dragged control, so writing them cannot fight a pointer.
 *
 * ⚠️ **An edit here pushes no history entry and does not re-baseline the other tabs**, exactly as the
 * Composer's does not, and for the same reason: the alternative is re-initialising the generator on every
 * keystroke. Stated because it is a real limitation, not an oversight.
 */
import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId } from '../../../exploration/state.ts';
import type {
  SinMagicParams,
  StaticFieldConfig,
  TransMapLayer,
  TransMapStyle,
  UnifiedPreset,
} from '../../../presets/types.ts';
import {
  chainFromOverlay,
  isSeparableStyle,
  TRANS_MAP_STYLE_NAMES,
  TRANS_MAP_STYLES,
} from '../../../post-processors/trans-map-chain.ts';
import {
  PATTERN_PRESET,
  STATIC_FIELD_ARCHETYPES,
  STATIC_FIELD_DEFAULTS,
  STATIC_FIELD_DETAIL_MAX,
  STATIC_FIELD_DETAIL_MIN,
  STATIC_FIELD_DETAIL_STEP,
  STATIC_FIELD_STRENGTH_STEP,
  STATIC_FIELD_STRENGTH_TRACK,
  WARP_SHAPES,
  WARP_SHAPE_LABELS,
  WAVE_ANGLE_STEP,
  WAVE_ANGLE_TRACK,
  bakeStaticField,
  findArchetype,
  staticFieldOf,
} from '../../../post-processors/static-field.ts';
import type { StaticFieldBake } from '../../../post-processors/static-field.ts';
import { drawFieldFrame } from '../field-frame-canvas.ts';
import {
  SHAPE_NOTICES,
  SHIFT_SHAPE_NOTICES,
  ZOOM_SHAPE_NOTICES,
  describeStaticField,
  describeTermIdentity,
  fieldCentre,
  harmonics,
  measureStaticField,
  shapeNoticeKeys,
} from '../field-measure.ts';
import type { ShapeNoticeKey } from '../field-measure.ts';
import { TAB_TIPS } from '../tooltips.ts';
import { DRIFT_TRACK, type VisualFxControls } from './visual-fx.ts';

/** The four separable styles, in `TRANS_MAP_STYLES`' order — derived, never a literal list (14.0's rule). */
const SEPARABLE_STYLES = TRANS_MAP_STYLES.filter(m => m.separable === true);

/**
 * The two labels the `(Preset)` option wears. **Both are LABELS — `PATTERN_PRESET` is the only stored word**
 * (*Phase 19*'s rule: a label persisted is the defect), and both are built from it so a rename cannot leave one
 * behind.
 *
 * ⚠️ **`— edited` is a rendering of `↺ Reset field`'s comparison and has no state of its own** — see
 * `refreshButtons()`, which owns both. The owner asked for this word (2026-09-23), for the case their own
 * commission creates: selecting a named pattern now fills the rows *and leaves them editable*, so the first
 * keystroke silently moves the layer from that name to `(Preset)`, and without the word the dropdown would show
 * one unexplained state for "the preset's own terms" and "the terms I just took over".
 */
const PATTERN_CLEAN_LABEL = `${PATTERN_PRESET} — the terms below`;
const PATTERN_EDITED_LABEL = `${PATTERN_PRESET} — edited`;

/**
 * The two axis panes. `x` is `waveX` (one value per COLUMN, length = width); `y` is `waveY` (per ROW, height).
 *
 * ⚠️ **Both are always visible and there is no selector** — the Composer's decision, and here it is also
 * invariant 29's remedy: **25 of 154 layers have exactly one live axis**, so a pane that had to be chosen
 * would hide the fact that the other direction is silent. The pane SAYS it is silent; it is never given a size.
 *
 * ⚠️ **The panes are `WaveX` / `WaveY` and the retired words are `Across` / `Down` (owner, 2026-09-22): their
 * return anywhere user-facing is a regression.** `Across`/`Down` named the direction the PROFILE is drawn
 * along, which is not the direction it displaces — style 0 is cross-coupled (`waveX` moves pixels *down*), so
 * the old labels contradicted the field on the tab's own default style. The engine's array names have always
 * been `waveX`/`waveY`, so the labels now match the one vocabulary the code, the readout (`X …· Y …`) and the
 * manual already shared. ⚠️ **The `aria-label`s carry the same word**, so a rename here moves eight selectors
 * in `tests/11-transmap-tab.spec.ts`; **no checker sees either half**.
 */
const PANES = [
  { axis: 'x' as const, label: 'WaveX', ampRow: 0, freqRow: 1 },
  { axis: 'y' as const, label: 'WaveY', ampRow: 2, freqRow: 3 },
];

/**
 * What ticking an empty term row seeds.
 *
 * ⚠️ **A checkbox that is "the way in" must produce something, and deriving the checked state from liveness
 * alone makes it spring back.** A term is live iff **both** numbers are non-zero (the engine's own predicate:
 * `sin(0) · amp ≡ 0` however large the amplitude), so ticking a row that remembers `0, 0` would write zeros,
 * measure as silent, and paint itself off again — invariant 13 with the control's own state as the output
 * channel. Seeding two stated, immediately editable numbers is the honest way in; the tooltip names them.
 *
 * ⚠️ **Only a zero component is replaced.** A row the user unticked keeps its numbers in the DOM, so ticking
 * it back must restore exactly those — seeding over them would silently discard the pair the checkbox
 * promises to give back.
 */
const TERM_SEED = { amp: 0.5, freq: 1 };

/** A deep copy of a table. ⚠️ Required on read: `getTransMapWaveTables()` hands its arrays over BY REFERENCE. */
function copyTable(t: SinMagicParams): SinMagicParams {
  return [[...t[0]], [...t[1]], [...t[2]], [...t[3]]];
}

/** A table of zeros, for the no-preset case. A fresh one per call, so no caller can write into a shared blank. */
function blankTable(): SinMagicParams {
  return [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
}

/**
 * Six significant digits — the display form of a SOLVED term, and the form `adoptShownTerms()` stores.
 *
 * ⚠️ **This is not the "nothing rounds" rule being broken; it is the other side of it.** An AUTHORED number is
 * stored verbatim (a typed `3.5` must never become `4`, and 8-decimal amplitudes occur in the library), so a
 * `(Preset)` table is shown with no rounding at all. A term coming out of `bakeStaticField()` is not authored —
 * it is `solveGain()`'s output, a float with sixteen digits of arithmetic noise behind a quantity whose
 * magnitude is a fraction of a pixel. Printing all of it would say "this number is exact to a part in 10¹⁶"
 * about a figure that changes by 54 % when the window is resized.
 *
 * ⚠️ **SIGNIFICANT digits, not decimal places.** A fixed 6 decimals maps a legitimate small amplitude
 * (Strength near its minimum resolves terms below 1e-6) to exactly 0, which the rows would then paint as an
 * unticked, silent term — invariant 13 with the rounding as the output channel.
 */
function roundTerm(v: number): number {
  return v === 0 || !Number.isFinite(v) ? v : Number(v.toPrecision(6));
}

/** `roundTerm` over a whole table, on a fresh copy. */
function roundTable(t: SinMagicParams): SinMagicParams {
  return [
    t[0].map(roundTerm), t[1].map(roundTerm), t[2].map(roundTerm), t[3].map(roundTerm),
  ] as SinMagicParams;
}

/** One registered scalar slider: the handle, its readout, and the three closures `sync()` needs. */
interface ScalarSlider {
  input: HTMLInputElement;
  label: HTMLElement;
  get: () => number;
  toPos: (v: number) => number;
  fmt: (v: number) => string;
}

/**
 * Everything this tab owns, in one value — what `↺ Reset field` restores and `↻ Reapply field` puts back.
 *
 * ⚠️ **`staticField: null` and `zoomCenter: null` mean ABSENT, which is a third state and not `undefined`.**
 * A missing `staticField` means "every default"; a missing `zoomCenter` means "inherit the preset's own
 * centre", which is NOT 50/50. `applySnapshot()` therefore `delete`s rather than assigning — the same rule
 * `reset()` has always followed, now written once instead of twice.
 *
 * ⚠️ **It is the tab's whole subject and no more** (§H): the style, the static field, the zoom centre and the
 * two tables. Restoring the chain itself would reset layers, weights and the pass order this tab does not own.
 */
interface FieldSnapshot {
  table1: SinMagicParams;
  table2: SinMagicParams;
  style: TransMapStyle;
  staticField: StaticFieldConfig | null;
  zoomCenter: { x: number; y: number } | null;
}

/** One registered term row — a checkbox and two number fields over one `(amplitude, frequency)` slot. */
interface TermRow {
  /** 1 = `sinMagicParams` (the shift half), 2 = `sinMagicParams2` (the zoom half, style 3 only). */
  table: 1 | 2;
  axis: 'x' | 'y';
  ampRow: number;
  freqRow: number;
  slot: number;
  check: HTMLInputElement;
  amp: HTMLInputElement;
  freq: HTMLInputElement;
}

/**
 * v8 2026-11-13 — the `(Preset)` regime's Strength gain, as one sentence: `strength / 0.5` for the shift half and
 * `strength2 / 0.5` for the zoom half (only on Zoom Combined, style 3, where table 2 is read), the factors
 * `resolveStaticWaves` multiplies the AUTHORED terms by. Empty at the neutral 0.5 on every half that is read.
 */
export function describeTableGain(sf: { strength: number; strength2: number }, zoomHalf: boolean): string {
  const g1 = sf.strength / STATIC_FIELD_DEFAULTS.strength;
  const g2 = sf.strength2 / STATIC_FIELD_DEFAULTS.strength2;
  const live1 = g1 !== 1, live2 = zoomHalf && g2 !== 1;
  if (!live1 && !live2) return '';
  const x = (g: number): string => `\u00d7${g.toFixed(2)}${g < 0 ? ' (inverted)' : ''}`;
  const parts: string[] = [];
  if (live1) parts.push(`Strength ${sf.strength.toFixed(2)}: the shift amplitudes below act ${x(g1)}`);
  if (live2) parts.push(`${live1 ? 'the' : 'Zoom Strength ' + sf.strength2.toFixed(2) + ': the'} zoom amplitudes act ${x(g2)}`);
  return `${parts.join('; ')} \u2014 the rows show them as authored.`;
}

export class TransMapTab implements TabModule {
  readonly id: TabId = 'transmap';
  private state: ExplorationState | null = null;
  private container: HTMLElement | null = null;
  private controls: VisualFxControls;

  /**
   * The tab's own copies of the two tables.
   *
   * ⚠️ **Read from `state.workingPreset`, not from `controls.getTransMapWaveTables()`, and DEEP-COPIED.** The
   * Lab edits `workingPreset` and that is what Export writes; reading the engine's copy would show the last
   * APPLIED tables, so a Randomiser mutation not yet applied would be invisible. The deep copy is not
   * defensive tidiness either — the control surface hands its arrays over by reference with an explicit "the
   * reader must not write through it" warning, and a term row that wrote through one would edit the preset,
   * Export and Snapshot with no assignment anywhere in sight.
   */
  private table1: SinMagicParams = blankTable();
  private table2: SinMagicParams = blankTable();

  /**
   * **WHICH separable layer the whole tab describes** — the picker and the pick itself.
   *
   * ⚠️ **`pick` carries the STYLE alongside the index and both must still match, or the pick is DROPPED.** See
   * the file header: a chain layer has no identity of its own, so an index alone is a marker that follows a
   * Visual FX reorder onto a different layer in total silence. Dropping falls back to the first separable layer —
   * the pre-picker behaviour — and `sync()` moves the dropdown to say so.
   *
   * ⚠️ **`layerRow` is hidden at one separable layer**, because a dropdown with a single option is a control
   * that cannot move the thing it names (invariant 13).
   *
   * ⚠️ **THERE IS NO `Active` CHECKBOX AND THIS TAB WRITES `layer.enabled` NOWHERE** (owner, 2026-09-23: *"we
   * also do not need the checkbox Active on the Transmap page, the transmap config should always be active"*).
   * The switch still exists — it is Visual FX's, on the layer's own chain row — so what was removed is a second
   * EDITOR of one field, not the field. `mutedEl` stays and had to be REWORDED: it used to say "it is unticked
   * above", which named a control that is now in another tab, and a notice pointing at a control the reader
   * cannot see is worse than none.
   */
  private layerSelect: HTMLSelectElement | null = null;
  private layerRow: HTMLElement | null = null;
  private pick: { index: number; style: TransMapStyle } | null = null;

  private frameCanvas: HTMLCanvasElement | null = null;
  private frameCaption: HTMLElement | null = null;
  private styleSelect: HTMLSelectElement | null = null;
  private patternSelect: HTMLSelectElement | null = null;
  private pattern2Select: HTMLSelectElement | null = null;
  /**
   * The two wave-shape dropdowns — the shift half's and style 3's zoom half's (`35.4`).
   *
   * ⚠️ **Built from `WARP_SHAPES`, never from a hand-written option list**, and that is the phase's one-way
   * `tsc` gap: `Record<WarpShape, …>` forces a label for a new union member while `readonly WarpShape[]`
   * forces **nothing**, so a sixth shape added to the union and both `Record`s compiles clean and the picker
   * silently offers one option fewer. `shapecheck` §A mechanises the `Record`s as set equality; the clause
   * asserting that THESE dropdowns read the array is owed (see `shapeDropdown()`).
   */
  private shapeSelect: HTMLSelectElement | null = null;
  private shape2Select: HTMLSelectElement | null = null;
  private identLine: HTMLElement | null = null;
  private resetBtn: HTMLButtonElement | null = null;
  private reapplyBtn: HTMLButtonElement | null = null;
  /**
   * What the reader must know BEFORE typing in a row — `StaticFieldBake.warning`'s own sentence, or empty.
   *
   * ⚠️ **It is no longer a refusal**: every row is editable, so this line is the one place that says a take-over
   * will not be bit-tight, and it must be on screen BEFORE the first keystroke, not after it. Its gate is the
   * bake's `warning === null`, never a second predicate here (invariant 25 — the description owns the gate).
   */
  private termNote: HTMLElement | null = null;
  /**
   * v8 2026-11-13 (owner) — **what Strength does to a `(Preset)` table**, which the rows cannot show: they are the
   * AUTHORED terms, and the engine multiplies them by `strength / 0.5` while drawing (`resolveStaticWaves`), never
   * writing the product back. Hidden on a named pattern (the rows are the bake there, Strength already inside them)
   * and at the neutral 0.5 (×1.00 says nothing). Filled in `refreshDerived()`, so a Strength DRAG updates it.
   */
  private gainNote: HTMLElement | null = null;
  private readoutEl: HTMLElement | null = null;

  /**
   * The state on entering the tab, and the state undone by the last `↺ Reset field`.
   *
   * ⚠️ **BOTH are re-taken on `activate()` AND on an external change**, because "the settings of the preset
   * before entering the tab" stops being a meaningful thing to restore the moment a different preset arrives —
   * a Reset against a stale baseline would write another preset's field over this one, silently and with the
   * button looking exactly as it always does.
   *
   * ⚠️ **`redoSnapshot` is the ONLY thing that enables `↻ Reapply field`**, so it is cleared on every
   * re-baseline and after a reapply: the button's own contract is "active only if Reset has been pushed".
   */
  private entrySnapshot: FieldSnapshot | null = null;
  private redoSnapshot: FieldSnapshot | null = null;

  /** Every scalar slider, so `sync()` needs no per-control branch (16.17's "the pair is the enumeration"). */
  private sliders: ScalarSlider[] = [];
  private termRows: TermRow[] = [];
  private paneSummaries: Array<{ el: HTMLElement; table: 1 | 2; axis: 'x' | 'y' }> = [];

  /** Rows and sections whose PRESENCE is derived from the style or the regime — `display` only, never rebuilt. */
  private detailRow: HTMLElement | null = null;
  private zoomSection: HTMLElement | null = null;
  private centreSection: HTMLElement | null = null;
  /** Everything below the preconditions, hidden wholesale when there is no separable layer to edit. */
  private bodyEl: HTMLElement | null = null;

  /**
   * The three inline notices. ⚠️ **Each one's TEXT IS SET ONCE and only `display` is toggled** — not a style
   * preference: `tipcheck`'s `INLINE_SINK` matches a string literal directly after `.textContent =`, so a
   * ternary-assigned string type-checks, renders identically and is **invisible** to the ceiling that caps
   * exactly this kind of copy. They are inline rather than tooltips because a precondition is discovered only
   * by someone who already suspects the control, and each of these describes a state in which the controls
   * below are lying (invariant 25).
   */
  private noLayerEl: HTMLElement | null = null;
  private disabledEl: HTMLElement | null = null;
  private multiLayerEl: HTMLElement | null = null;
  /**
   * The picked layer contributes nothing — switched off, or at weight 0, both in Visual FX.
   *
   * ⚠️ **ONE test, ONE sentence, covering BOTH causes** (invariant 25: the description owns the gate). The
   * measurement above it is honest either way — it measures the FIELD, which still has a size — so without this
   * line the tab states a peak in pixels for a layer the frame never sees. **Neither cause is editable here
   * since the `Active` box was removed**, which is precisely why the notice had to stay: this tab can no longer
   * fix the state it is reporting, so naming where the switch lives is the whole of its remaining job.
   */
  private mutedEl: HTMLElement | null = null;
  /**
   * §J's notice: `Zoom Pattern` and `Zoom Bias` are **inert in the table regime**.
   *
   * ⚠️ **The engine defect deliberately REMAINS** (owner, 2026-09-22 §M.3): the `!arch` branch calls
   * `buildZoomWave(…, bias = 1, …)` with **1 hardcoded** and never reads `pattern2`. Honouring the stored value
   * would change the DC term of **23 of the 25** style-3 presets — a library-wide visual change, not a fix, and
   * `21.D1` forbids retuning artwork. So the two controls are **disabled** here and this copy describes **what
   * the engine does**, never claiming the field has no bias.
   */
  private zoomInertEl: HTMLElement | null = null;
  /**
   * The wave-shape notices, one `<p>` per `ShapeNoticeKey`, keyed so `sync()` moves nothing but `display`.
   *
   * ⚠️⚠️ **`mixZero` IS THE WHOLE POINT OF `35.4`.** `shapeMix: 0` and `shape: 'sine'` are **both** the
   * identity, deliberately (`35.D2`), so a user who picks a shape and leaves the mix at 0 sees **nothing** —
   * `PHASE35-KEYS.md` §2.4 calls that the phase's most likely first-use confusion and this line is the
   * entire remedy.
   *
   * ⚠️ **ONE string owner and ONE threshold source, both in `field-measure.ts`** — the wordings are
   * `SHAPE_NOTICES` and the discontinuity test reads `WARP_SHAPE_DISCONTINUOUS`, **never a second
   * hand-typed list.** The same table and the same predicate serve Visual FX's own static-field editor, so
   * the two editors cannot come to say different things about one field (the TWO-editors-ONE-owner rule).
   *
   * ⚠️ **Each text is written ONCE at build time and only `display` moves**, for `noLayerEl`'s reason:
   * `tipcheck`'s `INLINE_SINK` cannot see a ternary-assigned string. Here the literal is not even in this
   * file — `tipcheck` §K reads the table instead.
   */
  private shapeNoticeEls = new Map<ShapeNoticeKey, HTMLElement>();

  /** ⚠️ Invariant 15: `onExternalChange` returns an unsubscribe a new subscriber MUST call in `dispose()`. */
  private unsubscribeExternal: (() => void) | null = null;

  constructor(controls: VisualFxControls) {
    this.controls = controls;
  }

  init(container: HTMLElement, state: ExplorationState): void {
    this.state = state;
    this.container = container;
    this.readTables();
    this.render();
    this.rebaseline();
    // ⚠️ Subscribed LAST, after the first render, so the callback can never fire against a half-built DOM.
    this.unsubscribeExternal = this.controls.onExternalChange(() => {
      this.readTables();
      // ⚠️ **The pick dies with the chain it pointed into, and it is cleared BEFORE `rebaseline()`** — which
      // captures the picked layer, so a stale pick would baseline the wrong one. A new preset brings a whole new
      // chain, so "layer 3, Zoom Combined" is not a thing that survives it even when the words still match.
      this.pick = null;
      // See `entrySnapshot`: a preset arriving from outside IS the new baseline, and keeping the old one would
      // arm Reset to write the previous preset's field over this one.
      this.rebaseline();
      this.sync();
    });
  }

  /** ⚠️ Required by `TabModule`. The tab measures on every change, so entering it must re-measure. */
  activate(): void {
    this.readTables();
    // ⚠️ **The pick is dropped on every show, and that is deliberate rather than lazy.** Visual FX can add,
    // remove and reorder layers while this tab is hidden and fires no external change for it, so the one moment
    // a stale pick could not be caught by `editedIndex()`'s style test is a swap between two layers of the SAME
    // style. Re-entering on the first separable layer makes that case unreachable.
    this.pick = null;
    // "The original ones of the preset before entering the Transmap tab" — this is that moment, and it is the
    // only one: `activate()` runs on every show, `init()` on the first.
    this.rebaseline();
    this.sync();
  }

  /** Nothing per-frame is owned here — no rAF, no interval, no tile renderer. */
  deactivate(): void { /* intentionally empty */ }

  dispose(): void {
    // ⚠️ FIRST statements, per invariant 15 and the idiom every sibling tab follows.
    this.unsubscribeExternal?.();
    this.unsubscribeExternal = null;
    this.layerSelect = null;
    this.layerRow = null;
    this.pick = null;
    this.frameCanvas = null;
    this.frameCaption = null;
    this.styleSelect = null;
    this.patternSelect = null;
    this.pattern2Select = null;
    this.identLine = null;
    this.resetBtn = null;
    this.reapplyBtn = null;
    this.termNote = null;
    this.gainNote = null;
    this.readoutEl = null;
    this.entrySnapshot = null;
    this.redoSnapshot = null;
    this.sliders = [];
    this.termRows = [];
    this.paneSummaries = [];
    this.detailRow = null;
    this.zoomSection = null;
    this.centreSection = null;
    this.bodyEl = null;
    this.noLayerEl = null;
    this.disabledEl = null;
    this.multiLayerEl = null;
    this.mutedEl = null;
    this.zoomInertEl = null;
    // ⚠️ **No engine value is touched, unlike the Composer's two bypass flags.** The discriminator is whether
    // the value has ANOTHER surface: every field this tab writes is preset data with a second home (Visual FX
    // still owns the chain, and the tables are the preset's own), so resetting one on dispose would have
    // closing the Lab silently undo an authored field.
  }

  /**
   * Panel Reset. ⚠️ **REQUIRED, never optional** — `TabModule` says so, and `EvolutionTab`'s omission is why.
   *
   * ⚠️ **It restores ONLY what this tab owns, resolved through the engine's own chain reader.** The entry
   * preset's chain is rebuilt with `chainFromOverlay()` (the resolver `main.ts` uses, so an `overlay` chain and
   * a legacy `transMapStyle` scalar are read the same way), and exactly three fields reach the live layer:
   * `style`, `staticField` and `zoomCenter`. **Writing the whole entry chain would reset layers, weights and
   * the pass order this tab does not own** (§H) — a Reset that reached outside its own tab.
   *
   * ⚠️ **This is the PANEL header's Reset, which is not the tab's own `↺ Reset field`** — a different baseline
   * (the panel's entry preset, not the tab's) reached from a different button. They share `applySnapshot()`
   * because the *apply* is one operation; they do not share a baseline, and merging them would make the header
   * button undo an edit made before the tab was ever opened.
   *
   * ⚠️ **It re-baselines afterwards**, so the tab's own Reset goes inactive: the state on screen IS the state
   * the tab would restore, and a live button that changes nothing is invariant 13 in a widget.
   */
  reset(entryPreset: UnifiedPreset): void {
    const tm = entryPreset.postProcessors?.transMap;
    const entryChain = chainFromOverlay(entryPreset.overlay, tm?.style ?? 0, tm?.ifsParams);
    // ⚠️ **Resolved through the SAME `editedIndex()` the live chain uses, so a Reset restores the layer being
    // edited rather than the first one** — and it is the entry chain's own answer: if the pick's (index, style)
    // pair does not exist in the preset as it was entered, the resolver drops to the first separable layer there,
    // which is the only layer the baseline can honestly claim to be about.
    const entryLayer = entryChain[this.editedIndex(entryChain)];
    const live = this.separable().layer;
    if (entryLayer && live) {
      this.applySnapshot({
        table1: tm?.sinMagicParams ? copyTable(tm.sinMagicParams) : blankTable(),
        table2: tm?.sinMagicParams2 ? copyTable(tm.sinMagicParams2) : blankTable(),
        style: entryLayer.style,
        staticField: entryLayer.staticField ? { ...entryLayer.staticField } : null,
        zoomCenter: entryLayer.zoomCenter ? { ...entryLayer.zoomCenter } : null,
      });
    } else {
      // No separable layer at one end or the other: the tables are still this tab's to restore, and they go
      // back through the one commit path so the engine and `workingPreset` cannot disagree.
      this.table1 = tm?.sinMagicParams ? copyTable(tm.sinMagicParams) : blankTable();
      this.table2 = tm?.sinMagicParams2 ? copyTable(tm.sinMagicParams2) : blankTable();
      this.commitTables();
    }
    this.rebaseline();
    this.refreshButtons();
  }

  // -------------------------------------------------------------------------------------------------
  // Model plumbing
  // -------------------------------------------------------------------------------------------------

  /** Re-read both tables from the Lab's working copy. See `table1`'s header for why not from the engine. */
  private readTables(): void {
    const tm = this.state?.workingPreset?.postProcessors?.transMap;
    this.table1 = tm?.sinMagicParams ? copyTable(tm.sinMagicParams) : blankTable();
    this.table2 = tm?.sinMagicParams2 ? copyTable(tm.sinMagicParams2) : blankTable();
  }

  /**
   * **THE resolver: which layer of `chain` this tab edits.** `-1` means the chain has no separable layer.
   *
   * ⚠️ **EVERY reader and EVERY writer goes through this one function, against a chain it already holds.** That
   * is invariant 17 in its literal form — two sources (the pick and "the first separable layer") resolved in one
   * order, in one place, with nothing re-deriving it afterwards. Four writers used to carry their own
   * `chain.findIndex(l => isSeparableStyle(l.style))` copy; with a picker in play those four would have kept
   * writing to layer one while every control on screen showed another, and `tsc` sees four correct expressions.
   *
   * ⚠️ **Takes the caller's chain rather than fetching one**, because `getTransMapChain()` COPIES: resolving an
   * index against a different copy than the one about to be written back is how a pick and a patch come apart.
   *
   * ⚠️ **The style test is the drop**, not a correction — see the file header. A pick whose layer moved is
   * discarded, never followed.
   */
  private editedIndex(chain: readonly TransMapLayer[]): number {
    const picked = this.pick;
    if (picked) {
      const at = chain[picked.index];
      if (at && isSeparableStyle(at.style) && at.style === picked.style) return picked.index;
    }
    return chain.findIndex(l => isSeparableStyle(l.style));
  }

  /** The picked layer and its index in the live chain. `index < 0` means there is none. */
  private separable(): { index: number; layer: TransMapLayer | null } {
    const chain = this.controls.getTransMapChain();
    const index = this.editedIndex(chain);
    return { index, layer: index < 0 ? null : chain[index] ?? null };
  }

  /**
   * Every separable layer's chain index, in chain order — the picker's options and `multiLayerEl`'s basis.
   *
   * ⚠️ **The INDEX is what is kept, not the layer**, and it is the index in the WHOLE chain rather than a count
   * of separable ones: it is what the picker stores, and the number it shows has to be the layer's position in
   * Visual FX's list or the two views name the same row differently (*a name is a primary key*).
   */
  private separableIndices(chain: readonly TransMapLayer[]): number[] {
    const out: number[] = [];
    chain.forEach((l, i) => { if (isSeparableStyle(l.style)) out.push(i); });
    return out;
  }

  /**
   * Push both tables into the working preset AND the engine.
   *
   * ⚠️ **BOTH, and writing one is invariant 13 in one direction or the other.** `workingPreset` is what
   * Export, Snapshot and the Mixer read; `setTransMapWaveTables` is what this frame draws. Preset-only means
   * every term row is inert until the next apply; engine-only means every edit vanishes on Export.
   *
   * ⚠️ **AND THE ENGINE-ONLY HALF IS ROUTE-DEPENDENT, WHICH IS WHY A SEEDED DEFECT HERE WAS NOT CAUGHT ON THE
   * FIRST TRY (spec `11`, 2026-09-22).** `setTransMapWaveTables` writes `main.ts`'s own
   * `preset.postProcessors.transMap.sinMagicParams` as well as rebuilding the field — and `main.ts`'s `preset`
   * and the Lab's `state.workingPreset` are different objects that **converge after a grid click**. So once a
   * tile has been clicked the two writes below are the same write and dropping this one is invisible; on the
   * STARTUP route (`panel.ts` deep-copies at `init()`) it is the only route a term edit has to Export. **Do not
   * read the redundancy as dead code** — it is load-bearing on the route every session starts on, and the spec
   * that covers it had to be written against that route specifically.
   *
   * ⚠️ **`sinMagicParams` is PRESET data with no overlay counterpart, which is why the preset write cannot be
   * skipped the way a chain edit's can.** The chain reaches Export through `getOverlaySnapshot()`; the tables
   * have no such route.
   */
  private commitTables(): void {
    const tm = this.state?.workingPreset?.postProcessors?.transMap;
    if (tm) {
      tm.sinMagicParams = copyTable(this.table1);
      tm.sinMagicParams2 = copyTable(this.table2);
    }
    this.controls.setTransMapWaveTables(this.table1, this.table2);
    this.sync();
  }

  /**
   * Patch the edited layer's `staticField` and push the chain — Visual FX's own idiom.
   *
   * ⚠️ **RE-READS the chain rather than closing over a layer object**, because the chain is handed out as a
   * copy in both directions: a captured layer would be a snapshot that stopped being the engine's.
   */
  private setStaticField(patch: Partial<typeof STATIC_FIELD_DEFAULTS>): void {
    const chain = this.controls.getTransMapChain();
    const entry = chain[this.editedIndex(chain)];
    if (!entry) return;
    entry.staticField = { ...staticFieldOf(entry), ...patch };
    this.controls.setTransMapChain(chain);
  }

  // -------------------------------------------------------------------------------------------------
  // Live terms — what the rows SHOW, and the one place showing turns into owning
  // -------------------------------------------------------------------------------------------------

  /**
   * **The terms the engine is actually building its waves from** — the rows' model, in either regime.
   *
   * On `(Preset)` that is the stored tables verbatim. On an archetype it is `bakeStaticField()`, whose
   * amplitudes already carry `solveGain()` × `strength` and whose frequencies already carry `detail`, so the
   * numbers are the resolved ones and not a description of them. ⚠️ **`table2 === null` means styles 0-2, which
   * never read a second table** — the stored one is shown rather than zeros, exactly as the bake never wrote it.
   *
   * ⚠️ **This is a DISPLAY transform and must not write anything.** The conversion it makes visible is
   * canvas-dependent (see the file header), so the moment it is stored the field's size is pinned to this
   * window — which is why `adoptShownTerms()` is a separate, edit-triggered step and not folded in here.
   */
  private shownTables(layer: TransMapLayer, width: number, height: number, cx: number, cy: number):
  { t1: SinMagicParams; t2: SinMagicParams; bake: StaticFieldBake | null } {
    if (!findArchetype(staticFieldOf(layer).pattern)) {
      return { t1: this.table1, t2: this.table2, bake: null };
    }
    const baked = bakeStaticField(layer, width, height, cx, cy);
    if (!baked) return { t1: this.table1, t2: this.table2, bake: null };
    return {
      t1: roundTable(baked.table1),
      t2: baked.table2 ? roundTable(baked.table2) : this.table2,
      bake: baked,
    };
  }

  /**
   * **Take ownership of the terms on screen** — the one regime conversion, run from a term edit and nowhere
   * else. A no-op on `(Preset)`, where they are already owned; **there is no other exemption left** (owner,
   * 2026-09-23 — every row is editable, so every archetype must be adoptable, and `carryZoomBias()` is what
   * makes the zoom half of style 3 keep its picture across the hand-over).
   *
   * ⚠️ **The returned `strength`/`strength2` are part of the answer, not a suggestion.** The table branch
   * multiplies by `strength / 0.5`, so storing these amplitudes at any other strength applies the measured gain
   * twice — a field that doubles the instant the user types a digit.
   *
   * ⚠️ **`pattern2` goes back to `(Preset)` along with `pattern`.** Style 3's zoom half resolves from
   * `findArchetype(pattern2) ?? arch` on the archetype branch and from the second TABLE on the other, so
   * leaving `pattern2` on a name would point the zoom half at a pattern while its shift half read terms.
   *
   * ⚠️ **It does not commit** — the caller writes its cell into the adopted table first, so one edit is one
   * engine write rather than an adopt-then-edit pair the picture would flicker between.
   */
  private adoptShownTerms(): void {
    const { layer } = this.separable();
    if (!layer) return;
    if (!findArchetype(staticFieldOf(layer).pattern)) return;
    const { width, height } = this.controls.getFrameSize();
    const { cx, cy } = fieldCentre(
      layer, this.controls.getTransMapZoomCenterX(), this.controls.getTransMapZoomCenterY(), width, height,
    );
    /*
     * ⚠️ **Through `shownTables()`, never `bakeStaticField()` directly — one owner, so what is stored is
     * EXACTLY what the rows were showing.** The shown numbers are rounded for display (`roundTable`); baking the
     * unrounded ones instead would make the rows jump to full float noise the instant a digit is typed, and the
     * user's evidence for "these are my terms now" would be numbers they never saw.
     */
    const shown = this.shownTables(layer, width, height, cx, cy);
    if (!shown.bake) return;
    this.table1 = copyTable(shown.t1);
    // ⚠️ Null means DO NOT WRITE, never "write zeros": styles 0-2 do not read the second table, so the
    // preset's own is not this conversion's to destroy (*Preset format*: a gate destroys a block).
    if (shown.bake.table2) this.table2 = copyTable(shown.t2);
    this.setStaticField({
      pattern: PATTERN_PRESET,
      pattern2: PATTERN_PRESET,
      strength: shown.bake.strength,
      strength2: shown.bake.strength2,
    });
  }

  // -------------------------------------------------------------------------------------------------
  // Reset / Reapply — the tab's own undo pair
  // -------------------------------------------------------------------------------------------------

  /** Everything this tab owns, right now. Null when there is no separable layer to own it. */
  private capture(): FieldSnapshot | null {
    const { layer } = this.separable();
    if (!layer) return null;
    return {
      table1: copyTable(this.table1),
      table2: copyTable(this.table2),
      style: layer.style,
      staticField: layer.staticField ? { ...layer.staticField } : null,
      zoomCenter: layer.zoomCenter ? { ...layer.zoomCenter } : null,
    };
  }

  /** Re-take the baseline and drop the redo. See `entrySnapshot` for when, and why both together. */
  private rebaseline(): void {
    this.entrySnapshot = this.capture();
    this.redoSnapshot = null;
  }

  /**
   * Put a captured state back — the shared apply of both Resets and of Reapply.
   *
   * ⚠️ **ABSENT and `undefined` ARE DIFFERENT STATES, and `exactOptionalPropertyTypes` is the only thing that
   * says so.** A snapshot that carried neither block has to `delete` the live one: assigning `undefined` would
   * type-error, and assigning a defaults object would silently pin an inherited zoom centre to whatever the
   * preset happened to have at the time.
   *
   * ⚠️ **Chain first, tables second, and `commitTables()` last** — it is the only path that writes both
   * `workingPreset` and the engine, and it ends in `sync()`, so the whole panel is repainted from the restored
   * state rather than from the state the buttons were drawn against.
   */
  private applySnapshot(snap: FieldSnapshot): void {
    this.table1 = copyTable(snap.table1);
    this.table2 = copyTable(snap.table2);
    const chain = this.controls.getTransMapChain();
    const live = chain[this.editedIndex(chain)];
    if (live) {
      live.style = snap.style;
      if (snap.staticField) live.staticField = { ...snap.staticField };
      else delete live.staticField;
      if (snap.zoomCenter) live.zoomCenter = { ...snap.zoomCenter };
      else delete live.zoomCenter;
      this.controls.setTransMapChain(chain);
    }
    this.commitTables();
  }

  /**
   * A snapshot's comparison key — the basis for "has anything been changed".
   *
   * ⚠️ **An ABSENT `staticField` and an all-default one must compare EQUAL**, because `normaliseChain()` DROPS
   * an all-default block on its way into the engine: a slider taken away from its default and put back lands on
   * `null` where the baseline holds an object, or the reverse, and a raw comparison would leave Reset armed
   * over a field that is byte-identical to the baseline. `staticFieldOf()` is the resolver that makes the two
   * the same string, and it is the same one every reader uses (invariant 17: one resolution order).
   *
   * ⚠️ **`zoomCenter` is compared AS STORED, null and all**, for the opposite reason: absent means "inherit the
   * preset's own centre" and is a genuinely different state from a pair that happens to equal it today —
   * `isLegacyExpressible()` reads its PRESENCE to decide the chain must be serialised.
   */
  private static snapshotKey(snap: FieldSnapshot): string {
    const resolved = staticFieldOf({
      style: snap.style,
      enabled: true,
      weight: 1,
      ...(snap.staticField ? { staticField: snap.staticField } : {}),
    });
    return JSON.stringify([snap.table1, snap.table2, snap.style, resolved, snap.zoomCenter]);
  }

  // -------------------------------------------------------------------------------------------------
  // Rendering — built ONCE; see the file header for why nothing here is ever rebuilt
  // -------------------------------------------------------------------------------------------------

  private render(): void {
    const el = this.container!;
    el.innerHTML = '';
    this.sliders = [];
    this.termRows = [];
    this.paneSummaries = [];
    // ⚠️ Cleared with the other build-time registries. The Map is keyed, so a second render would overwrite
    // rather than leak — but an entry pointing at a DETACHED paragraph is a gate that moves nothing, which is
    // the same reason the three lists above are reset here.
    this.shapeNoticeEls.clear();

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    /*
     * ⚠️ **TWO sentences, a `tipcheck` §I ceiling rather than a style preference** — inline copy is capped
     * because tooltips are additive, so a regrown orientation paragraph passes every other section.
     *
     * ⚠️ **The second sentence is MANDATED by §E.1 and must not be trimmed away.** The picture below is NOT the
     * output; it is the displacement the output is sampled through, and a user who reads a lattice line as a
     * particle path will diagnose the whole warp backwards. That is invariant 25 in a diagram, and the tab's
     * copy has to say it once.
     */
    desc.textContent = 'The image-domain field the whole frame is sampled through — the wave terms it is built '
      + 'from, the pattern that can replace them, and how big the result actually is. The picture is the '
      + 'displacement itself, not the rendered output: a grid line is where the frame is read from, never a '
      + 'particle path.';
    el.appendChild(desc);

    // ---- the three preconditions, above everything they describe ---------------------------------

    this.disabledEl = document.createElement('p');
    this.disabledEl.className = 'sl-composer-precondition';
    this.disabledEl.textContent = 'TransMap is switched off, so nothing on this tab reaches the picture — the '
      + 'numbers below are still the preset’s own and are still saved by Export and Snapshot. Tick Enable in '
      + 'the Visual FX tab’s Translation Map section to see them.';
    el.appendChild(this.disabledEl);

    this.noLayerEl = document.createElement('p');
    this.noLayerEl.className = 'sl-composer-precondition';
    this.noLayerEl.textContent = 'This preset’s warp has no shift or zoom layer, so there is no separable field '
      + 'to edit here — the other warp styles build their displacement in the shader and have no wave terms. '
      + 'Add a Wave Shift, Wave Zoom, Zoom Overlay or Zoom Combined layer in Visual FX to author one.';
    el.appendChild(this.noLayerEl);

    this.multiLayerEl = document.createElement('p');
    this.multiLayerEl.className = 'sl-composer-mute-notice';
    this.multiLayerEl.textContent = 'This warp has more than one shift or zoom layer — Layer, below, picks the '
      + 'one every control on this tab describes. ⚠️ The two wave tables are the preset’s own and are shared by '
      + 'every layer, so a term typed here moves all of them at once.';
    el.appendChild(this.multiLayerEl);

    this.bodyEl = document.createElement('div');
    el.appendChild(this.bodyEl);

    // ⚠️ **FIRST, above the undo pair, because it is upstream of both** — `↺ Reset field`'s baseline is the
    // PICKED layer's, and a picker below the button it re-baselines would read as if the two were unrelated.
    this.bodyEl.appendChild(this.buildLayerSection());
    this.bodyEl.appendChild(this.buildChangesSection());
    this.bodyEl.appendChild(this.buildPictureSection());
    this.bodyEl.appendChild(this.buildPatternSection());
    this.bodyEl.appendChild(this.buildScalarSection());
    this.bodyEl.appendChild(this.buildTermsSection(1, 'Terms'));
    this.zoomSection = this.buildZoomSection();
    this.bodyEl.appendChild(this.zoomSection);
    this.centreSection = this.buildCentreSection();
    this.bodyEl.appendChild(this.centreSection);

    /*
     * ⚠️ **THE MEASURED READOUT IS LAST, so it describes every control above it — the centre included**, which
     * for styles 1-3 is part of the field's geometry and therefore part of what gets measured.
     *
     * ⚠️ **ONE OWNER of the measurement (§E.7).** The words come from `describeStaticField`, the same function
     * the picture's model comes from, so the drawing and its caption cannot disagree — and Visual FX's copy of
     * this readout is gone rather than duplicated. *Two copies of a measurement is how two measurements come to
     * wear the same words.*
     */
    this.readoutEl = document.createElement('p');
    this.readoutEl.className = 'sl-tab-desc sl-transmap-readout';
    this.readoutEl.title = TAB_TIPS['transmap.readout']!;
    this.bodyEl.appendChild(this.readoutEl);

    this.sync();
  }

  /**
   * **Which layer** — the picker, and the notice for a layer that is not reaching the picture (owner,
   * 2026-09-23).
   *
   * ⚠️ **THE OPTION LIST IS REBUILT BY `sync()`, AND THAT IS NOT AN EXCEPTION TO THE NO-REBUILD RULE.** The rule
   * (file header) is about a row BODY going stale under incoming data, because a body carries the writers: a
   * stale one routes the next edit through the wrong one. An `<option>` carries no handler — the `change`
   * listener lives on the `<select>`, is bound once here, and reads `value` at event time — so there is nothing
   * to go stale. The list *must* be derived, because layers are added and removed in Visual FX.
   *
   * ⚠️ **The label is `TRANS_MAP_STYLE_NAMES` plus the layer's position in the WHOLE chain**, which is the
   * number a user counts down Visual FX's list to find. Two layers of one style are otherwise two options
   * wearing one name, which is *a name is a primary key* arriving in a dropdown — and the style word alone
   * cannot tell them apart because the pick is positional in the first place.
   *
   * ⚠️ **The mute is ticked when the layer is ON, and the label says `Active` for that reason** (E109's polarity
   * rule: an unticked box on load is the defect). Visual FX's own checkbox is the same field with an inverted
   * caption; the two are one switch and either one moves the other's view on the next sync.
   */
  private buildLayerSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';

    this.layerSelect = document.createElement('select');
    this.layerSelect.className = 'sl-vfx-select';
    this.layerSelect.title = TAB_TIPS['transmap.layer']!;
    this.layerSelect.setAttribute('aria-label', 'Layer');
    this.layerSelect.addEventListener('change', () => {
      const chain = this.controls.getTransMapChain();
      const index = Number(this.layerSelect!.value);
      const at = chain[index];
      // A dropdown whose options were rebuilt from this same chain cannot normally miss — but the chain is
      // re-read here rather than trusted, so a layer removed between the repaint and the click is a no-op
      // rather than a pick pointing at nothing.
      if (!at || !isSeparableStyle(at.style)) { this.sync(); return; }
      this.pick = { index, style: at.style };
      /*
       * ⚠️ **A DIFFERENT LAYER IS A DIFFERENT BASELINE, so the pick re-baselines — the same rule an arriving
       * preset follows.** `entrySnapshot` holds one layer's field; without this, picking layer 3 after editing
       * layer 1 would leave `↺ Reset field` armed with layer 1's numbers and it would write them onto layer 3,
       * silently, with the button looking exactly as it always does. The cost is stated rather than hidden: the
       * way back to a pre-edit layer 1 is the panel header's Reset, not this tab's.
       */
      this.rebaseline();
      this.sync();
    });
    this.layerRow = this.row('Layer', this.layerSelect, TAB_TIPS['transmap.layer']!);
    sec.appendChild(this.layerRow);

    // See `mutedEl`: it names BOTH causes and the tab that owns them, because neither is editable here.
    this.mutedEl = document.createElement('p');
    this.mutedEl.className = 'sl-composer-precondition';
    this.mutedEl.textContent = 'This layer is not reaching the picture — in the Visual FX chain it is either '
      + 'switched off or at weight 0. Everything below still describes the layer’s own field, and Export and '
      + 'Snapshot still save it.';
    sec.appendChild(this.mutedEl);

    return sec;
  }

  /**
   * **`↺ Reset field` and `↻ Reapply field`** — the tab's own undo pair, replacing `⟳ Random pattern` and
   * `⤓ Bake to terms` (owner, 2026-09-22: *"all changes to the settings are immediately applied and visible, no
   * button is needed for applying changes or for transfer of settings into the config tables"*).
   *
   * ⚠️ **NEITHER IS NAMED `Reset`, and the reason is that the PANEL HEADER already has one.** *A name is a
   * primary key*: two buttons reading `Reset` inside one panel is a control the user cannot tell apart and an
   * `aria-label` a spec cannot select on — and they do different things against different baselines (see
   * `reset()`). The word `field` is what separates them.
   *
   * ⚠️ **First in the body, above the picture, because they are the way BACK from every control below.** A
   * disabled button at the top is also the tab's only statement that nothing has been changed yet.
   */
  private buildChangesSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';

    const group = document.createElement('div');
    group.className = 'sl-btn-group';

    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'sl-btn';
    this.resetBtn.textContent = '↺ Reset field';
    this.resetBtn.title = TAB_TIPS['transmap.resetField']!;
    this.resetBtn.setAttribute('aria-label', 'Reset field');
    this.resetBtn.addEventListener('click', () => {
      const base = this.entrySnapshot;
      if (!base) return;
      // ⚠️ **Captured BEFORE the restore, which is the whole of Reapply's contract** — "the settings which were
      // active just before pushing Reset". Taking it afterwards would record the baseline twice and leave
      // Reapply as a second Reset.
      this.redoSnapshot = this.capture();
      this.applySnapshot(base);
      this.refreshButtons();
    });
    group.appendChild(this.resetBtn);

    this.reapplyBtn = document.createElement('button');
    this.reapplyBtn.className = 'sl-btn';
    this.reapplyBtn.textContent = '↻ Reapply field';
    this.reapplyBtn.title = TAB_TIPS['transmap.reapplyField']!;
    this.reapplyBtn.setAttribute('aria-label', 'Reapply field');
    this.reapplyBtn.addEventListener('click', () => {
      const redo = this.redoSnapshot;
      if (!redo) return;
      this.applySnapshot(redo);
      // Cleared AFTER the apply: the change is back, so the thing Reset undid no longer exists to be redone.
      // Reset goes live again in the same breath, because the state now differs from the baseline once more.
      this.redoSnapshot = null;
      this.refreshButtons();
    });
    group.appendChild(this.reapplyBtn);

    sec.appendChild(group);
    return sec;
  }

  private buildPictureSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    /*
     * ⚠️ **THIS LABEL MUST NOT BE SHORTENED TO "Preview", for the same reason the Composer's Score must not
     * be.** Calling it a preview would make every deliberate omission — no particles, no trail, no grading,
     * one instant — read as a defect, which is invariant 25 arriving through a title.
     */
    title.textContent = 'Displacement — the warp itself, not the picture it makes';
    title.title = TAB_TIPS['transmap.frame']!;
    sec.appendChild(title);

    this.frameCanvas = document.createElement('canvas');
    this.frameCanvas.className = 'sl-transmap-frame';
    this.frameCanvas.setAttribute('role', 'img');
    this.frameCanvas.setAttribute('aria-label', 'Deformed lattice of the static field, with the WaveX and WaveY profiles on the top and left edges');
    sec.appendChild(this.frameCanvas);

    /*
     * ⚠️ **The exaggeration factor is PRINTED, and the number comes from the drawing rather than from here.**
     * True-to-scale is unusable — the library's authored fields span 3.2 px to 2074 px on a 1920-wide frame, so
     * at panel size a 3.2 px field would be half a pixel of ink and therefore indistinguishable from the exact
     * identity the readout has three separate sentences to tell apart. `drawFieldFrame` returns the factor it
     * chose because it is the one that knows the box; two owners of that number would be two numbers.
     */
    this.frameCaption = document.createElement('p');
    this.frameCaption.className = 'sl-tab-desc sl-transmap-frame-cap';
    this.frameCaption.title = TAB_TIPS['transmap.frameScale']!;
    sec.appendChild(this.frameCaption);

    // `Style` is in scope by §H — it decides what the picture MEANS (a shift, a zoom, or a zoom about a
    // centre), so it belongs with the picture rather than below the terms.
    this.styleSelect = document.createElement('select');
    this.styleSelect.className = 'sl-vfx-select';
    this.styleSelect.title = TAB_TIPS['transmap.style']!;
    for (const meta of SEPARABLE_STYLES) {
      const o = document.createElement('option');
      o.value = String(meta.style);
      o.textContent = meta.name;
      this.styleSelect.appendChild(o);
    }
    this.styleSelect.addEventListener('change', () => {
      const style = Number(this.styleSelect!.value) as TransMapStyle;
      const chain = this.controls.getTransMapChain();
      const index = this.editedIndex(chain);
      const entry = chain[index];
      if (!entry) return;
      entry.style = style;
      // ⚠️ **The pick has to follow its own layer's style change, or it drops on the very next read** — the
      // corroborating field IS the style (see `pick`), so writing one without the other would bounce the user
      // back to layer one the instant they changed a style. Written from the RESOLVED index, never from
      // `pick.index`, so a pick that was already dropped stays dropped rather than being resurrected here.
      this.pick = { index, style };
      this.controls.setTransMapChain(chain);
      // A style change adds or removes whole sections (the zoom half, the centre) and changes what the
      // picture draws, so this is a structural event: full `sync()`, not `refreshDerived()`.
      this.sync();
    });
    sec.appendChild(this.row('Style', this.styleSelect, TAB_TIPS['transmap.style']!));

    return sec;
  }

  private buildPatternSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';
    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = 'Pattern';
    title.title = TAB_TIPS['transmap.pattern']!;
    sec.appendChild(title);

    this.patternSelect = this.patternDropdown(false, TAB_TIPS['transmap.pattern']!);
    sec.appendChild(this.row('Pattern', this.patternSelect, TAB_TIPS['transmap.pattern']!));

    /*
     * ⚠️ **The shape rows live in the PATTERN section, not in `Amount`, because a shape is a shape.** They sit
     * BELOW Pattern and ABOVE the identification line on purpose: the line names the shape too (`35.4`), so
     * the three read top to bottom as *which table · which wave · what that is*.
     *
     * ⚠️ **They are NOT gated by regime.** `35.D2` decision 1 keeps the shape live on `(Preset)` as well as on
     * an archetype — the opposite of `Detail`'s row, two sections down, which is hidden on `(Preset)`. The
     * asymmetry is deliberate and is commented at both tooltips; **do not harmonise them.** ⛔ And nothing
     * here may gate a TERM row: TransMap already hides 31 of 62 controls by style and the owner reviewed and
     * left that alone, so adding a row must not change what the tab hides.
     */
    this.shapeSelect = this.shapeDropdown(false, TAB_TIPS['transmap.shape']!);
    sec.appendChild(this.row('Shape', this.shapeSelect, TAB_TIPS['transmap.shape']!));
    sec.appendChild(this.shapeMixSlider('Shape Mix', TAB_TIPS['transmap.shapeMix']!, false));

    /*
     * ⚠️ **The orientation pair sits with Pattern and Shape, which is where an ORIENTATION belongs** — the
     * three read top to bottom as *which table · which wave · which way it runs*, and `Amount` below is for
     * sizes. ⛔ **And nothing here is gated**: TransMap already hides 31 of 62 controls by style and the
     * owner reviewed and left that alone, so adding a row must not change what the tab hides. These two are
     * read by all four separable styles, so there is nothing to gate them on anyway.
     *
     * ⚠️ The notices follow BELOW, so every line they can emit is below every row it can be caused by.
     */
    sec.appendChild(this.anglePairRow('Angle', TAB_TIPS['transmap.angle']!, ['X', 'Y'],
      s => [s.angleX, s.angleY],
      (cell, v) => this.setStaticField(cell === 0 ? { angleX: v } : { angleY: v })));

    for (const el of this.buildShapeNotices(SHIFT_SHAPE_NOTICES)) sec.appendChild(el);

    /*
     * ⚠️ **THE IDENTIFICATION LINE IS THE OWNER'S SENTENCE MADE CHECKABLE (§D), and its three wordings are ONE
     * string owner with ONE threshold read from `STATIC_FIELD_STRENGTH_MAX`.** It answers the question the
     * dropdown cannot: *which pattern are these terms, and could the dropdown reach them?* Of the 63 library
     * tables an archetype reproduces in shape, **34 need more than Strength 1 and the worst needs 12.24×** — so
     * a line that named the pattern and stopped would read as *"switch to this and you are done"* for half the
     * library. A second hand-typed bound is how the label and the track come to disagree.
     */
    this.identLine = document.createElement('p');
    this.identLine.className = 'sl-tab-desc sl-transmap-ident';
    this.identLine.title = TAB_TIPS['transmap.identify']!;
    sec.appendChild(this.identLine);

    return sec;
  }

  /**
   * A pattern dropdown.
   *
   * ⚠️ **`(Custom)` IS NOT OFFERED, and that is §D's decision rather than an omission.** It resolves exactly as
   * `(Preset)` — `findArchetype` returns undefined for it, so `resolveStaticWaves` takes its `!arch` branch and
   * produces a byte-identical field — and `fieldcheck` §G pins that. **One word per stored state**: offering a
   * second spelling of one regime is invariant 17's shape in a dropdown. A preset that already stores
   * `(Custom)` still resolves correctly and is shown as `(Preset)`, which is what it renders as.
   */
  private patternDropdown(second: boolean, tip: string): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'sl-vfx-select';
    sel.title = tip;
    for (const name of [PATTERN_PRESET, ...STATIC_FIELD_ARCHETYPES.map(a => a.name)]) {
      const o = document.createElement('option');
      o.value = name;
      /*
       * ⚠️ **THE STORED WORD IS THE `value`; only the LABEL says what it means, and that split is the answer to
       * *"Pattern says (Preset), not a name"*.** `(Preset)` is a state, not a missing reading — it is what 136
       * of the library's 154 separable layers store, and the field really does come from the terms below. Giving
       * that state a second stored spelling is invariant 17's shape in a dropdown (§D's closed decision), so the
       * name it lacked goes in the label, and WHICH pattern the terms resemble is the identification line's job.
       */
      o.textContent = name === PATTERN_PRESET ? PATTERN_CLEAN_LABEL : name;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      this.setStaticField(second ? { pattern2: sel.value } : { pattern: sel.value });
      // A pattern change switches REGIME: the Detail row appears or disappears, the identification line
      // changes meaning and the bake button's precondition flips. Structural, so a full `sync()`.
      this.sync();
    });
    return sel;
  }

  /**
   * A wave-shape dropdown — **BUILT FROM `WARP_SHAPES`, with labels from `WARP_SHAPE_LABELS`.**
   *
   * ⚠️⚠️ **NEVER A HAND-WRITTEN OPTION LIST, AND THIS IS THE PHASE'S ONE-WAY `tsc` GAP** (`35.1`, and
   * `interfaces.ts`' `ChannelDriver` plus `33.5` are its two other live instances in this tree):
   * `Record<WarpShape, …>` makes `tsc` force an entry for a new union member, `readonly WarpShape[]` makes it
   * force **nothing**, and the dropdown reads the array. A sixth shape added to the union and both `Record`s
   * therefore compiles clean while the picker offers one option fewer — the shape exists, is storable,
   * interpolates, exports and cannot be selected. ⚠️ **Nothing in `checks/` can see a hand-written list here
   * except a SOURCE-TEXT clause**; that clause belongs in `shapecheck` §B and is reported as OWED (`35.4`).
   *
   * ⚠️ **The stored word is the `value` and the label is the `Record`'s** — *Phase 19*'s rule, a label
   * persisted is the defect. `WARP_SHAPES[0]` is `sine`, which `shapecheck` §A3 pins as the default and the
   * head of the list, so an unmatched assignment can never silently land on a different shape.
   */
  private shapeDropdown(second: boolean, tip: string): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'sl-vfx-select';
    sel.title = tip;
    for (const name of WARP_SHAPES) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = WARP_SHAPE_LABELS[name];
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      const shape = sel.value as (typeof WARP_SHAPES)[number];
      this.setStaticField(second ? { shape2: shape } : { shape });
      // ⚠️ **A full `sync()`, not `refreshDerived()`** — the notice set is derived from the shape, and a
      // pick is not a drag, so there is no handle under the pointer for `sync()` to fight.
      this.sync();
    });
    return sel;
  }

  /**
   * One `Shape Mix` row. ⚠️ **A plain 0..1 linear track, step 0.01** — `min`/`max` are VALUES here, not
   * positions, because the row is unmapped (see `slider()`'s own note on which unit the caller is in).
   *
   * ⚠️ **It must NOT be coupled to the dropdown.** Snapping this to 1 when a shape is picked, or resetting
   * the shape when this returns to 0, would collapse `35.D2`'s two independent identities into one — and the
   * notice line, not a coupling, is the sanctioned remedy for the confusion that creates.
   */
  private shapeMixSlider(label: string, tip: string, second: boolean): HTMLElement {
    return this.slider(label, tip, {
      min: 0, max: 1, step: 0.01,
      get: () => second
        ? staticFieldOf(this.separable().layer ?? undefined).shapeMix2
        : staticFieldOf(this.separable().layer ?? undefined).shapeMix,
      set: v => this.setStaticField(second ? { shapeMix2: v } : { shapeMix: v }),
      fmt: v => v.toFixed(2),
    });
  }

  /**
   * **One `Angle` row: TWO captioned sliders, X and Y, sharing one label and one tooltip** (`35.4`).
   *
   * ⚠️⚠️ **ONE ROW WITH TWO CELLS, NEVER TWO ROWS.** It is the Composer's `framingTripletRow` primitive in
   * its two-cell case, and the reason is not layout: the two angles are **one quantity in two halves** — the
   * degenerate configurations the notices warn about (parallel, ±90, style 2's exact cancellation) are all
   * properties of the PAIR, so two separate rows would read as two unrelated orientations and put the
   * notices next to neither of them. `visual-fx.ts` carries the same row for the same reason.
   *
   * ⚠️ **Each handle writes ONLY its own angle** — `tripletRow`'s own rule. The setter merges a patch into
   * the live `staticField`, so a handle that sent both would re-assert its sibling's value from a stale DOM
   * element on every drag frame.
   *
   * ⚠️ **`min`/`max` are POSITIONS (±1), because this is a TRACKED row** — `WAVE_ANGLE_TRACK` is linear, so
   * the only things it buys are that convention and the quantiser, and it is `WAVE_ANGLE_MAX`'s first and
   * only reader in `src/` (`35.1`'s finding in a new symbol: a constant cited in prose alone has no reader
   * and nothing reports it). **A value bound here would be read as a position and clamp the travel to a
   * ninetieth of itself**, which is the trap `trackcheck` §M records against the Strength row.
   *
   * ⚠️ **The readout re-reads `get()` after `set()`**, which is `32.14`'s repair: `fromPos` ROUNDS to whole
   * degrees, so a handler that formatted the dragged number would print a fraction of a degree the engine
   * never stored — the same shape as `TWIST_SNAP` snapping the engine while the panel reported `+0.03 turns`.
   * The thumb is written back too, because that is what the user aims with.
   */
  private anglePairRow(
    label: string,
    tip: string,
    captions: readonly [string, string],
    get: (s: typeof STATIC_FIELD_DEFAULTS) => readonly [number, number],
    set: (cell: 0 | 1, v: number) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    row.title = tip;
    const lab = document.createElement('span');
    lab.className = 'sl-vfx-label';
    lab.textContent = label;
    row.appendChild(lab);

    const pair = document.createElement('div');
    pair.className = 'sl-vfx-triplet';
    for (let c = 0; c < 2; c++) {
      const cell = c as 0 | 1;
      const box = document.createElement('div');
      box.className = 'sl-vfx-triplet-cell';

      const cap = document.createElement('span');
      cap.className = 'sl-vfx-triplet-caption';
      cap.textContent = captions[cell];
      box.appendChild(cap);

      const live = (): number => get(staticFieldOf(this.separable().layer ?? undefined))[cell];

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(-1);
      input.max = String(1);
      input.step = String(WAVE_ANGLE_STEP);
      input.className = 'sl-vfx-slider';
      input.title = tip;
      // ⚠️ **The per-cell `aria-label`, because the ROW label says only "Angle"** and the two handles are
      // otherwise indistinguishable to anything selecting by accessible name — *Phase 17*'s rule is no
      // `data-testid`, ever, so an unnamed cell is an unreachable control for the harness and for
      // `capture-ui.mjs`' `setControl`.
      input.setAttribute('aria-label', `${label} ${captions[cell]}`);
      box.appendChild(input);

      const valueLabel = document.createElement('span');
      valueLabel.className = 'sl-vfx-triplet-value';
      box.appendChild(valueLabel);

      const fmt = (v: number): string => `${Math.round(v)}°`;
      input.addEventListener('input', () => {
        // ⚠️ **`set` FIRST, then re-read** — `32.14`'s repair. `fromPos` quantises, so formatting the
        // dragged number would print a value the engine never stored.
        set(cell, WAVE_ANGLE_TRACK.fromPos(parseFloat(input.value)));
        const now = live();
        valueLabel.textContent = fmt(now);
        const pos = String(WAVE_ANGLE_TRACK.toPos(now));
        if (input.value !== pos) input.value = pos;
        // ⚠️ `refreshDerived()`, never `sync()` — see `slider()`. An angle changes which notices apply and
        // re-solves the gain, so the derived half MUST run: without it the parallel and cancellation lines
        // would appear only after some unrelated structural event.
        this.refreshDerived();
      });

      /*
       * ⚠️ **Registered in `this.sliders` with the SAME closure shape as `slider()`'s**, so `sync()` needs no
       * per-control branch and the cell is repainted from the live value on every preset load, Mixer move and
       * cross-tab edit. 16.17's post-mortem: the closures ARE the enumeration.
       */
      this.sliders.push({ input, label: valueLabel, get: live, toPos: WAVE_ANGLE_TRACK.toPos, fmt });
      pair.appendChild(box);
    }
    row.appendChild(pair);
    return row;
  }

  /**
   * The notice paragraphs for one half of the shape set, in `SHAPE_NOTICES`' order.
   *
   * ⚠️ **Built unconditionally, text written ONCE, `display` the only thing that ever moves** — the
   * `INLINE_SINK` rule, and here the literal is not even in this file: it comes from `SHAPE_NOTICES`, which
   * `tipcheck` §K reads. `syncShapeNotices()` is the one gate owner for both halves.
   */
  private buildShapeNotices(keys: readonly ShapeNoticeKey[]): HTMLElement[] {
    return keys.map(k => {
      const p = document.createElement('p');
      p.className = 'sl-composer-precondition';
      p.textContent = SHAPE_NOTICES[k];
      p.style.display = 'none';
      this.shapeNoticeEls.set(k, p);
      return p;
    });
  }

  /**
   * Show exactly the notices that apply — **ONE gate owner, reading ONE predicate** (`shapeNoticeKeys()`).
   *
   * ⚠️ **Iterating the Map rather than the applicable set is what makes a notice go AWAY.** Showing the
   * returned keys alone would leave a stale notice lit forever: a paragraph nothing ever hides is worse than
   * a missing one, because it reads as a live warning about a state the field has left.
   */
  private syncShapeNotices(layer: TransMapLayer): void {
    const on = new Set(shapeNoticeKeys(layer));
    for (const [k, el] of this.shapeNoticeEls) el.style.display = on.has(k) ? '' : 'none';
  }

  private buildScalarSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';
    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = 'Amount';
    sec.appendChild(title);

    /*
     * ⚠️ **THE BOUNDS ARE NOT ON THIS ROW AT ALL ANY MORE, and that is the 2026-09-25 shape** (the sitting that
     * reversed 21.13 and took the ceiling to 16). `min`/`max` here are the ±1 POSITION of a mapped track, so the
     * value bounds live in `STATIC_FIELD_STRENGTH_TRACK` alone — which reads `STATIC_FIELD_STRENGTH_MAX`/`_MIN`
     * itself. A hand-typed value bound on this row would now be worse than before: it would not merely disagree
     * with the identification line, it would be read as a position and silently clamp the handle's travel.
     * **Both Strength rows import the same track object** (this one and Zoom Strength, ~230 lines apart), and
     * `trackcheck` §M counts the rows that do.
     *
     * ⚠️ **Below 0 the field INVERTS rather than fading**, and the readout cannot show that — a peak is a
     * magnitude — so the tooltip and the identification line are the only places it is said. **0 is the dead
     * centre and still means no warp**, on both regimes, because both multiply by this scalar. On the curve it
     * is a BAND rather than a stop, which is what makes it easy to return to by hand.
     */
    sec.appendChild(this.slider('Strength', TAB_TIPS['transmap.strength']!, {
      min: -1, max: 1, step: STATIC_FIELD_STRENGTH_STEP,
      toPos: STATIC_FIELD_STRENGTH_TRACK.toPos, fromPos: STATIC_FIELD_STRENGTH_TRACK.fromPos,
      get: () => staticFieldOf(this.separable().layer ?? undefined).strength,
      set: v => this.setStaticField({ strength: v }),
      fmt: v => v.toFixed(2),
    }));

    /*
     * ⚠️ **The Detail ROW is HIDDEN in the table regime, not left visible-but-inert.** `detail` multiplies the
     * archetype's FREQUENCIES, which is meaningful because an archetype is a shape defined up to scale. A
     * preset's authored frequencies are not: they encode specific integer relationships (nodal lattices that
     * close only at those ratios), so scaling them would replace the figure rather than refine it — which is
     * why the engine deliberately does not apply it there. A control that moves nothing is invariant 13, and
     * wiring it to something would be worse than hiding it.
     */
    this.detailRow = this.slider('Detail', TAB_TIPS['transmap.detail']!, {
      // ⚠️ The bounds are the shared constants for the same reason `Strength`'s `max` is: the identification
      // line quotes them, so the track and the sentence are two views of one pair of numbers.
      min: STATIC_FIELD_DETAIL_MIN, max: STATIC_FIELD_DETAIL_MAX, step: STATIC_FIELD_DETAIL_STEP,
      get: () => staticFieldOf(this.separable().layer ?? undefined).detail,
      set: v => this.setStaticField({ detail: v }),
      fmt: v => v.toFixed(2),
    });
    sec.appendChild(this.detailRow);

    /*
     * ⚠️ **The readout STATES THE UNIT, because `drift` genuinely IS cells per second** — `DRIFT_RATE` is
     * exactly 2π, so the number needs no conversion and printing a bare `0.25` would leave the one quantity on
     * this tab that has a natural unit wearing none. The squared track is imported from `visual-fx.ts` rather
     * than restated: a differently-shaped row is visible, a drifted curve is not.
     */
    sec.appendChild(this.slider('Drift', TAB_TIPS['transmap.drift']!, {
      min: 0, max: 1, step: 0.005,
      toPos: DRIFT_TRACK.toPos, fromPos: DRIFT_TRACK.fromPos,
      get: () => staticFieldOf(this.separable().layer ?? undefined).drift,
      set: v => this.setStaticField({ drift: v }),
      fmt: v => `${v.toFixed(3)} cells/s`,
      wideLabel: true,
    }));

    return sec;
  }

  /**
   * One terms section: two panes, four fixed rows each.
   *
   * ⚠️ **FOUR rows, always, and the count is the MODEL's rather than a taste** — `MAX_SIN_MAGIC` is 4, so a
   * fifth row could not be stored and a variable count would make an empty slot indistinguishable from a
   * missing one. Same rule as the Composer's three fixed levels.
   */
  private buildTermsSection(table: 1 | 2, titleText: string): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';
    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = titleText;
    title.title = TAB_TIPS['transmap.terms']!;
    sec.appendChild(title);

    /*
     * ⚠️ **The take-over note, built for the SHIFT half only although what it warns about is the ZOOM half's
     * slots.** `buildTermsSection` runs twice, so a second copy would be a second element saying one thing — and
     * the condition is a property of the whole LAYER (its pattern's occupancy), not of a table. Above the rows it
     * describes, like the three preconditions at the top of the tab, and — since 2026-09-23 — **it no longer
     * explains a locked row: nothing here is locked by regime, so this is advice read BEFORE the keystroke.**
     */
    if (table === 1) {
      this.termNote = document.createElement('p');
      this.termNote.className = 'sl-tab-desc sl-transmap-term-note';
      sec.appendChild(this.termNote);
      // v8 2026-11-13 — the Strength gain on a `(Preset)` table, above the rows it multiplies (see `gainNote`).
      this.gainNote = document.createElement('p');
      this.gainNote.className = 'sl-tab-desc sl-transmap-gain-note';
      sec.appendChild(this.gainNote);
    }

    for (const pane of PANES) {
      const head = document.createElement('div');
      head.className = 'sl-vfx-sub-title';
      head.textContent = pane.label;
      head.title = pane.axis === 'x' ? TAB_TIPS['transmap.waveX']! : TAB_TIPS['transmap.waveY']!;
      sec.appendChild(head);

      for (let slot = 0; slot < 4; slot++) {
        sec.appendChild(this.termRow(table, pane.axis, pane.ampRow, pane.freqRow, slot));
      }

      /*
       * ⚠️ **The per-pane summary is written in the READOUT's own words (`0.5@8 1@16`) by the same
       * `harmonics()` function**, so the pane and the readout cannot disagree — and `— silent in this
       * direction` is invariant 29's remedy verbatim: **say the axis is silent, do not give it a size.**
       */
      const sum = document.createElement('p');
      sum.className = 'sl-tab-desc sl-transmap-pane-sum';
      sum.title = TAB_TIPS['transmap.paneSummary']!;
      sec.appendChild(sum);
      this.paneSummaries.push({ el: sum, table, axis: pane.axis });
    }

    return sec;
  }

  /**
   * One `[✓] Amplitude [ … ] Frequency [ … ]` row.
   *
   * ⚠️ **STEPPERS WITH TYPED ENTRY, AND NO SLIDER FOR EITHER NUMBER (§E.4, a closed decision).** `|freq|`
   * spans 0.1 … 1 000 000 — twenty-three octaves — so a track satisfying the octave rule would still be
   * unusable: **reachability and resolution are separate properties, and the first passes green on a useless
   * track.** ⚠️ **NOTHING ROUNDS** (8 decimals are observed in the library) and the typed value is stored
   * verbatim — the Composer's 16.13 rule, whose violation silently turned a typed `3.5` into `4`.
   *
   * ⚠️ **`change`, not `input`**: an `input` listener fires per keystroke, so typing `120` would commit 1, then
   * 12, then 120 — three engine writes and three rebuilt fields for one edit.
   */
  private termRow(table: 1 | 2, axis: 'x' | 'y', ampRow: number, freqRow: number, slot: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-slider-row sl-transmap-term';

    /*
     * ⚠️ **THE TABLE IS PART OF EVERY ACCESSIBLE NAME HERE, AND IT WAS MISSING — a real defect, found by the
     * Playwright pass and by nothing else.** `buildTermsSection` is called TWICE (the shift half and, on style
     * 3, the zoom half), so `Amplitude of term 1 across` named TWO inputs writing to two different tables:
     * `sinMagicParams` and `sinMagicParams2`. That is *"a NAME is a primary key"* arriving in the accessibility
     * layer — a screen-reader user heard one name for two controls, and the suite's own rule (*"select on the
     * `aria-label`, never on position"*) was unsatisfiable for these sixteen rows.
     *
     * ⚠️ **THE WORD IS THE SECTION'S OWN (`Zoom terms` ⇒ "zoom term"), NOT A NUMBER.** A label reading
     * `table 2` would name an internal field; the user's handle on that half is the heading above it. And
     * `tipcheck` cannot see any of this — it polices `title` attributes, so a duplicate `aria-label` is
     * invisible to every text scan in `checks/`.
     */
    const termWord = table === 2 ? 'zoom term' : 'term';
    // ⚠️ The accessible name carries the pane's OWN word, so it renamed with the pane (`across`/`down` retired
    // 2026-09-22). Deriving it from `PANES` would couple a screen-reader name to a display label's casing; the
    // words are stated once each, here and there, and the spec's selectors are the instrument that ties them.
    const axisWord = axis === 'x' ? 'WaveX' : 'WaveY';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'sl-transmap-term-check';
    check.title = TAB_TIPS['transmap.term']!;
    check.setAttribute('aria-label', `Use ${termWord} ${slot + 1} ${axisWord}`);
    row.appendChild(check);

    const num = (kind: 'amp' | 'freq', step: number): HTMLInputElement => {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'sl-composer-num';
      input.step = String(step);
      input.title = kind === 'amp' ? TAB_TIPS['transmap.amplitude']! : TAB_TIPS['transmap.frequency']!;
      input.setAttribute(
        'aria-label',
        `${kind === 'amp' ? 'Amplitude' : 'Frequency'} of ${termWord} ${slot + 1} ${axisWord}`,
      );
      input.addEventListener('change', () => {
        const raw = Number(input.value);
        // A non-numeric entry is refused by repainting, never by substituting a number the user did not type.
        if (!Number.isFinite(raw)) { this.sync(); return; }
        this.writeTerm(table, kind === 'amp' ? ampRow : freqRow, slot, raw);
      });
      return input;
    };

    const ampLabel = document.createElement('span');
    ampLabel.className = 'sl-transmap-term-cap';
    ampLabel.textContent = 'Amp';
    const amp = num('amp', 0.1);
    const freqLabel = document.createElement('span');
    freqLabel.className = 'sl-transmap-term-cap';
    freqLabel.textContent = 'Freq';
    const freq = num('freq', 1);

    row.appendChild(ampLabel);
    row.appendChild(amp);
    row.appendChild(freqLabel);
    row.appendChild(freq);

    check.addEventListener('click', () => {
      if (check.checked) {
        // ⚠️ Only a ZERO component is seeded — see `TERM_SEED`. A row unticked earlier keeps its numbers in
        // the DOM, and those are what the checkbox promised to give back.
        const a = Number(amp.value) || TERM_SEED.amp;
        const f = Number(freq.value) || TERM_SEED.freq;
        this.writeTerm(table, ampRow, slot, a, false);
        this.writeTerm(table, freqRow, slot, f);
      } else {
        // ⚠️ Zeros into the TABLE, and the DOM keeps the numbers — that is the whole of "the way back", and it
        // is session-only. The tooltip says so, because a preset change silently replaces the DOM too.
        this.writeTerm(table, ampRow, slot, 0, false);
        this.writeTerm(table, freqRow, slot, 0);
      }
    });

    this.termRows.push({ table, axis, ampRow, freqRow, slot, check, amp, freq });
    return row;
  }

  /**
   * Write one table cell. `commit` false batches a pair, so a checkbox is ONE engine write rather than two.
   *
   * ⚠️ **The adoption happens HERE, first, and it is what makes the rows editable in both regimes.** On an
   * archetype the numbers in the DOM are the pattern's resolved terms; typing over one means "these terms are
   * mine now", so the shown table has to become the stored table BEFORE the cell is written — otherwise the
   * edit would land on the preset's old, unread table and change nothing on screen. Idempotent: the second call
   * of a checkbox pair finds `(Preset)` already set and returns.
   */
  private writeTerm(table: 1 | 2, rowIndex: number, slot: number, value: number, commit = true): void {
    this.adoptShownTerms();
    const t = table === 1 ? this.table1 : this.table2;
    const target = t[rowIndex as 0 | 1 | 2 | 3];
    target[slot as 0 | 1 | 2 | 3] = value;
    if (commit) this.commitTables();
  }

  private buildZoomSection(): HTMLElement {
    const sec = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = 'Zoom half';
    title.title = TAB_TIPS['transmap.zoomHalf']!;
    sec.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.textContent = 'Zoom Combined is a shift composed with a zoom from a second table — not one field at '
      + 'two detail levels. The shift half is everything above; this is the zoom.';
    sec.appendChild(hint);

    this.pattern2Select = this.patternDropdown(true, TAB_TIPS['transmap.zoomPattern']!);
    sec.appendChild(this.row('Zoom Pattern', this.pattern2Select, TAB_TIPS['transmap.zoomPattern']!));

    // ⚠️ The same signed track OBJECT as `Strength` above, not a second row built to the same recipe — a zoom
    // wave is negated by a negative scalar exactly as a shift wave is, and the two rows wearing different
    // ranges would be the asymmetry `STATIC_FIELD_STRENGTH_MIN`'s header warns about. Since 2026-09-25 the
    // curve carries the bounds, so a divergence here would be a differently-SHAPED handle, not just a shorter
    // one — visible side by side, which is the cheapest place for this to be caught.
    sec.appendChild(this.slider('Zoom Strength', TAB_TIPS['transmap.zoomStrength']!, {
      min: -1, max: 1, step: STATIC_FIELD_STRENGTH_STEP,
      toPos: STATIC_FIELD_STRENGTH_TRACK.toPos, fromPos: STATIC_FIELD_STRENGTH_TRACK.fromPos,
      get: () => staticFieldOf(this.separable().layer ?? undefined).strength2,
      set: v => this.setStaticField({ strength2: v }),
      fmt: v => v.toFixed(2),
    }));

    sec.appendChild(this.slider('Zoom Bias', TAB_TIPS['transmap.zoomBias']!, {
      min: -0.5, max: 0.5, step: 0.01,
      get: () => staticFieldOf(this.separable().layer ?? undefined).zoomBias,
      set: v => this.setStaticField({ zoomBias: v }),
      fmt: v => v.toFixed(2),
    }));

    /*
     * ⚠️⚠️ **THE ZOOM HALF NEEDS ITS OWN PAIR BECAUSE IT IS A SEPARATE FUNCTION, not a second parameter pair
     * on one function.** `shape2`/`shapeMix2` drive `buildZoomWave`, which carries a DC bias term `buildWave`
     * does not have; the twelve call sites split 6/6 across the two. **Crossing them is silent**, and a shape
     * applied to one function and not the other is a style-dependent divergence no `tsc` can see.
     *
     * ⚠️ **These two are NOT in `Zoom Pattern`'s inert class, and the design document says they are**
     * (`PHASE35-KEYS.md` §5.4). `35.2` wired them on BOTH branches — sites 7/8 are `(Preset)` and 9/10 the
     * archetype — so they are read in both regimes and gated by STYLE alone, like `Zoom Strength`. **They
     * must not be added to `zoomInert`'s two `disabled` flags**, or the panel would declare a gate the engine
     * does not implement.
     */
    this.shape2Select = this.shapeDropdown(true, TAB_TIPS['transmap.zoomShape']!);
    sec.appendChild(this.row('Zoom Shape', this.shape2Select, TAB_TIPS['transmap.zoomShape']!));
    sec.appendChild(this.shapeMixSlider('Zoom Shape Mix', TAB_TIPS['transmap.zoomShapeMix']!, true));

    /*
     * ⚠️ **`angleX2`/`angleY2`, which are the ZOOM half's and are a THIRD and FOURTH angle, not a second
     * reading of the first pair.** `waveMaps()` builds four `WaveAxisMap`s and `solveGain3` is the one
     * consumer that reads all four; handing `buildZoomWave` the SHIFT map is as silent as crossing the shape
     * pairs one row above, which is why the two pairs have separate controls rather than one shared row.
     *
     * ⚠️ **No notice for this pair, and that is a stated bound** — see `SHIFT_SHAPE_NOTICES`' header. Style 3
     * keeps the shift half as an additive term alongside `dz`, so a parallel ZOOM pair makes that half
     * one-directional and cannot make the field vanish.
     */
    sec.appendChild(this.anglePairRow('Zoom Angle', TAB_TIPS['transmap.zoomAngle']!, ['X', 'Y'],
      s => [s.angleX2, s.angleY2],
      (cell, v) => this.setStaticField(cell === 0 ? { angleX2: v } : { angleY2: v })));

    for (const el of this.buildShapeNotices(ZOOM_SHAPE_NOTICES)) sec.appendChild(el);

    // §J's notice. See `zoomInertEl`'s header for why the engine defect stays and what this copy may claim.
    this.zoomInertEl = document.createElement('p');
    this.zoomInertEl.className = 'sl-composer-precondition';
    this.zoomInertEl.textContent = 'Zoom Pattern and Zoom Bias are not read while the terms are the source: '
      + 'the engine takes the zoom half straight from the second table below and holds its bias at 1. They are '
      + 'greyed rather than hidden so the gap is visible — pick a Pattern above to make both live.';
    sec.appendChild(this.zoomInertEl);

    sec.appendChild(this.buildTermsSection(2, 'Zoom terms'));
    return sec;
  }

  private buildCentreSection(): HTMLElement {
    const sec = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = 'Zoom centre';
    title.title = TAB_TIPS['transmap.centre']!;
    sec.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'sl-tab-desc';
    hint.textContent = 'Where the zoom pushes away from, in percent of the frame, and the crosshair on the '
      + 'picture above. Untouched, this layer inherits the preset’s own centre.';
    sec.appendChild(hint);

    for (const axis of ['x', 'y'] as const) {
      sec.appendChild(this.slider(axis === 'x' ? 'Centre X' : 'Centre Y', TAB_TIPS['transmap.centre']!, {
        min: 0, max: 100, step: 1,
        get: () => {
          const layer = this.separable().layer;
          const fallback = axis === 'x'
            ? this.controls.getTransMapZoomCenterX()
            : this.controls.getTransMapZoomCenterY();
          return layer?.zoomCenter ? layer.zoomCenter[axis] : fallback;
        },
        /*
         * ⚠️ **Touching either axis MATERIALISES BOTH, because `zoomCenter` is a pair** — and its presence is
         * what `isLegacyExpressible()` reads to decide the chain must be serialised, so a half-written pair
         * would export a centre with one axis silently defaulted.
         */
        set: v => {
          const chain = this.controls.getTransMapChain();
          const entry = chain[this.editedIndex(chain)];
          if (!entry) return;
          const other = axis === 'x' ? 'y' : 'x';
          const otherVal = entry.zoomCenter
            ? entry.zoomCenter[other]
            : (other === 'x' ? this.controls.getTransMapZoomCenterX() : this.controls.getTransMapZoomCenterY());
          entry.zoomCenter = axis === 'x' ? { x: v, y: otherVal } : { x: otherVal, y: v };
          this.controls.setTransMapChain(chain);
        },
        fmt: v => `${Math.round(v)}%`,
      }));
    }
    return sec;
  }

  // -------------------------------------------------------------------------------------------------
  // Row factories
  // -------------------------------------------------------------------------------------------------

  /** A label and one control on an `sl-vfx-row`, titled on the row so the whole cell is the hover target. */
  private row(label: string, control: HTMLElement, tip: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    row.title = tip;
    const lab = document.createElement('span');
    lab.className = 'sl-vfx-label';
    lab.textContent = label;
    row.appendChild(lab);
    row.appendChild(control);
    return row;
  }

  /**
   * A registered range row.
   *
   * ⚠️ **`min`/`max` are the POSITION range for a mapped control and the VALUE range for an unmapped one**, and
   * `get`/`toPos`/`fmt` TRAVEL WITH THE INPUT so `sync()` needs no per-control branch — 16.17's post-mortem,
   * where a `switch` over a fixed list was named *"a second enumeration of one list"*. The closures ARE the
   * enumeration, written once at the build site.
   */
  private slider(label: string, tip: string, spec: {
    min: number; max: number; step: number;
    get: () => number; set: (v: number) => void;
    toPos?: (v: number) => number; fromPos?: (p: number) => number;
    fmt: (v: number) => string;
    wideLabel?: boolean;
  }): HTMLElement {
    const toPos = spec.toPos ?? ((v: number) => v);
    const fromPos = spec.fromPos ?? ((p: number) => p);

    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    row.title = tip;
    const lab = document.createElement('span');
    lab.className = 'sl-vfx-label';
    lab.textContent = label;
    row.appendChild(lab);

    const wrap = document.createElement('div');
    wrap.className = 'sl-vfx-slider-wrap';
    wrap.title = tip;
    const input = document.createElement('input');
    input.type = 'range';
    /*
     * ⚠️ **`spec.min`/`spec.max` ALWAYS, and the caller says which unit they are in** — VALUE on a plain row,
     * POSITION on a mapped one. This was `spec.toPos ? 0 : spec.min` until 2026-09-25 and that ternary was a
     * latent bug with exactly one victim available: it assumed every mapped track was positive, so the first
     * SIGNED mapped row (Strength, on the ±1 quartic) would have been built with `min = 0` and silently lost
     * its whole negative half — on this tab only, with `visual-fx.ts`'s copy of the row still reaching it.
     * Nothing would have thrown, the handle would have moved, and the inversion the identification line talks
     * about would simply have been unreachable here. `DRIFT_TRACK`'s row already passes `min: 0, max: 1`, so the
     * ternary was buying nothing even before the signed track arrived.
     */
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.className = 'sl-vfx-slider';
    input.title = tip;
    input.setAttribute('aria-label', label);

    const valueLabel = document.createElement('span');
    valueLabel.className = spec.wideLabel ? 'sl-vfx-value sl-vfx-value--wide' : 'sl-vfx-value';

    input.addEventListener('input', () => {
      const v = fromPos(parseFloat(input.value));
      valueLabel.textContent = spec.fmt(v);
      spec.set(v);
      // ⚠️ **`refreshDerived()`, NEVER `sync()`** — see the file header: `sync()` writes every handle, so it
      // would fight the pointer on this one.
      this.refreshDerived();
    });

    wrap.appendChild(input);
    wrap.appendChild(valueLabel);
    row.appendChild(wrap);
    this.sliders.push({ input, label: valueLabel, get: spec.get, toPos, fmt: spec.fmt });
    return row;
  }

  // -------------------------------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------------------------------

  /**
   * Write every control's VALUE and every derived readout. Called on structural events only.
   *
   * ⚠️ **Not from a slider's `input` handler** — see `slider()`.
   */
  private sync(): void {
    /*
     * ⚠️ **ONE chain read, and the index comes from `editedIndex()` against THAT copy.** Calling `separable()`
     * and `separableIndices()` separately would be two copies and two resolutions of one question — the shape
     * invariant 17 is about, and here it would also let the dropdown's options and its selected value be built
     * from different chains.
     */
    const chain = this.controls.getTransMapChain();
    const index = this.editedIndex(chain);
    const layer = index < 0 ? null : chain[index] ?? null;
    const sepIdx = this.separableIndices(chain);
    const enabled = this.controls.getTransMapEnabled();

    if (this.noLayerEl) this.noLayerEl.style.display = index < 0 ? '' : 'none';
    if (this.disabledEl) this.disabledEl.style.display = !enabled && index >= 0 ? '' : 'none';
    if (this.multiLayerEl) this.multiLayerEl.style.display = sepIdx.length > 1 ? '' : 'none';
    if (this.bodyEl) this.bodyEl.style.display = index < 0 ? 'none' : '';
    if (!layer) return;

    if (this.layerSelect) {
      /*
       * ⚠️ **Rebuilt only when the option SET has changed, and the guard is what keeps a repaint from closing an
       * open dropdown.** `sync()` runs on every structural event, and replacing the `<option>` children of a
       * `<select>` the user is holding open collapses it — the same class of defect as a `sync()` from a slider's
       * `input` handler, one widget over. The key is index AND style, i.e. exactly what a label is built from.
       */
      const key = sepIdx.map(i => `${i}:${chain[i]!.style}`).join(',');
      if (this.layerSelect.dataset.optionKey !== key) {
        this.layerSelect.dataset.optionKey = key;
        this.layerSelect.innerHTML = '';
        for (const i of sepIdx) {
          const o = document.createElement('option');
          o.value = String(i);
          o.textContent = `${i + 1}. ${TRANS_MAP_STYLE_NAMES[chain[i]!.style] ?? `Style ${chain[i]!.style}`}`;
          this.layerSelect.appendChild(o);
        }
      }
      // ⚠️ **From the RESOLVED index, never from `pick`** — a dropped pick has to show the layer the tab is
      // actually editing, or the one control that says which layer that is becomes the one control that lies.
      this.layerSelect.value = String(index);
    }
    // A dropdown with one option cannot move the thing it names (invariant 13), and with the `Active` box gone
    // there is nothing under it either — so the whole row goes when there is only one separable layer.
    if (this.layerRow) this.layerRow.style.display = sepIdx.length > 1 ? '' : 'none';
    // ⚠️ Invariant 25, and BOTH causes in one test — see `mutedEl`. Neither `enabled` nor `weight` is this tab's
    // to edit any more: `buildChainPlan` drops a layer at `weight <= 0` exactly as it drops a switched-off one,
    // and Visual FX owns both. The notice stays precisely BECAUSE the fix is in another tab.
    if (this.mutedEl) this.mutedEl.style.display = !layer.enabled || layer.weight <= 0 ? '' : 'none';

    const s = staticFieldOf(layer);
    const arch = findArchetype(s.pattern);

    if (this.styleSelect) this.styleSelect.value = String(layer.style);
    // ⚠️ A preset may store `(Custom)` or a name from a hand-edited import; neither is an option here, and an
    // unmatched assignment would leave the `<select>` showing the FIRST entry while meaning something else.
    // `(Preset)` is what both of those actually render as, so that is what is shown.
    if (this.patternSelect) this.patternSelect.value = arch ? s.pattern : PATTERN_PRESET;
    if (this.pattern2Select) {
      this.pattern2Select.value = findArchetype(s.pattern2) ? s.pattern2 : PATTERN_PRESET;
    }
    // ⚠️ Every member of `WARP_SHAPES` is an option, and `staticFieldOf()` resolves an absent field to
    // `'sine'`, so unlike the pattern dropdowns there is no unmatched-value case to fall back from. A
    // hand-edited import carrying an unknown word would show the first option — which `shapecheck` §A3 pins
    // as `sine`, i.e. the engine's own default for anything it cannot resolve.
    if (this.shapeSelect) this.shapeSelect.value = s.shape;
    if (this.shape2Select) this.shape2Select.value = s.shape2;

    for (const sl of this.sliders) {
      const v = sl.get();
      const pos = String(sl.toPos(v));
      if (sl.input.value !== pos) sl.input.value = pos;
      const text = sl.fmt(v);
      if (sl.label.textContent !== text) sl.label.textContent = text;
    }

    // Regime- and style-derived VISIBILITY. Never a rebuild — see the file header.
    if (this.detailRow) this.detailRow.style.display = arch ? '' : 'none';
    if (this.zoomSection) this.zoomSection.style.display = layer.style === 3 ? '' : 'none';
    if (this.centreSection) this.centreSection.style.display = layer.style !== 0 ? '' : 'none';

    /*
     * ⚠️ **§J: the two zoom controls are DISABLED in the table regime, and the notice is gated on the same
     * test.** Disabled rather than hidden because the point is to declare the gap: a hidden control says
     * nothing, and this one has a stored value the engine ignores. **The description owns the gate**
     * (invariant 25) — one test, both surfaces.
     */
    const zoomInert = layer.style === 3 && !arch;
    if (this.pattern2Select) this.pattern2Select.disabled = zoomInert;
    const biasSlider = this.sliders.find(sl => sl.input.getAttribute('aria-label') === 'Zoom Bias');
    if (biasSlider) biasSlider.input.disabled = zoomInert;
    if (this.zoomInertEl) this.zoomInertEl.style.display = zoomInert ? '' : 'none';

    // ⚠️ **The term rows are NOT filled here** — see the file header: their values are live and change on a
    // Strength or Detail drag, so they belong to `refreshDerived()`, which this call ends in.
    this.refreshDerived();
  }

  /**
   * Re-measure and re-word everything derived: the picture, its scale caption, **the sixteen term rows**, the
   * pane summaries, the identification line, the take-over note and the readout.
   *
   * ⚠️ **ONE measurement feeds the picture AND the sentence**, so the panel cannot draw a field that disagrees
   * with its own caption. A second grid here would be a fifth copy of the field formula (`fieldcheck` §D
   * polices four already).
   *
   * ⚠️ **THE ROWS ARE FILLED FROM `shownTables()`, WHICH IS THE ANSWER TO *"the tables don't match the
   * animation"*.** In the archetype regime the stored tables are not read by the resolver at all, so showing
   * them put the preset's unused numbers next to a picture drawn from the pattern — two surfaces of one panel
   * describing different fields. There is no measurement that can catch that: both halves were individually
   * correct.
   *
   * ⚠️ **On change, never per frame.** The resolve measures 0.81-1.16 ms; invariant 8 is about allocation RATE,
   * and a measurement that crept into `drawFrame` would reach the user as a periodic jitter.
   */
  private refreshDerived(): void {
    const { layer } = this.separable();
    if (!layer) return;
    const { width, height } = this.controls.getFrameSize();
    const { cx, cy } = fieldCentre(
      layer, this.controls.getTransMapZoomCenterX(), this.controls.getTransMapZoomCenterY(), width, height,
    );
    /*
     * ⚠️ **The measurement takes the STORED tables and the rows take the SHOWN ones, and that is not an
     * inconsistency.** `measureStaticField` resolves through `resolveStaticWaves`, i.e. through the engine's own
     * regime test: on an archetype it ignores both tables, so handing it the baked ones would measure the same
     * field while implying the resolver reads them. One field, two honest arguments.
     */
    const m = measureStaticField(layer, this.table1, this.table2, width, height, cx, cy);
    const shown = this.shownTables(layer, width, height, cx, cy);
    /*
     * ⚠️ **The note comes from the BAKE, so it exists only where a bake does** — on an archetype. `(Preset)`
     * layers own their terms already, and there is nothing about a take-over to warn them of. The wording, its
     * one condition and the proof that every other archetype is exact all live in `carryZoomBias()`; nothing
     * here may add a second reason (invariant 25).
     */
    const note = shown.bake?.warning ?? null;
    // **The zoom half reads its terms at a bias of 1**, so an amplitude at frequency 0 is a CONSTANT zoom there —
    // live, not inert. The shift half has no such term: its `sin(0)` is 0 whatever the amplitude.
    const zoomTable = layer.style === 3;

    if (this.frameCanvas) {
      const exaggeration = drawFieldFrame(this.frameCanvas, m);
      if (this.frameCaption) {
        this.frameCaption.textContent = m && m.peak > 0
          ? `Displacement drawn ${exaggeration < 10 ? exaggeration.toFixed(1) : String(Math.round(exaggeration))}× life size, so a small field is still visible.`
          : 'Nothing to draw — this field does not move the frame.';
      }
    }

    for (const r of this.termRows) {
      const t = r.table === 1 ? shown.t1 : shown.t2;
      const a = t[r.ampRow as 0 | 1 | 2 | 3][r.slot as 0 | 1 | 2 | 3];
      const f = t[r.freqRow as 0 | 1 | 2 | 3][r.slot as 0 | 1 | 2 | 3];
      /*
       * ⚠️ **The engine's own liveness predicate, and it is NOT the same predicate in the two tables.** In the
       * shift half a term at frequency 0 contributes nothing however large its amplitude (`sin(0) = 0`), which is
       * the whole explanation of the exact-identity case. In the zoom half `buildZoomWave` adds `bias · amp`
       * ALONGSIDE the sine and the terms are read at a bias of 1, so a frequency-0 amplitude there is a constant
       * zoom — and it is exactly the slot `carryZoomBias()` parks Zoom Bias's steady part in. Printing that slot
       * unticked would call the engine's own carry dead.
       */
      r.check.checked = a !== 0 && (f !== 0 || (zoomTable && r.table === 2));
      if (shown.bake) {
        /*
         * ⚠️ **On a pattern every cell is overwritten unconditionally, and the "keep the user's numbers" guard
         * below must NOT apply here.** These numbers are not the user's — they are solved from Pattern, Detail
         * and Strength, so a zero among them is this field's actual zero and leaving a stale digit in that box
         * would show a term the engine is not using. The way back from an unticked box is a table-regime
         * promise (the checkbox's own tooltip says session-only); a pattern has no unticked state to return to.
         */
        r.amp.value = String(a);
        r.freq.value = String(f);
      } else {
        // ⚠️ Only overwrite a field the table actually holds a value for: a zeroed row must KEEP the user's
        // numbers in the DOM, because that is the only way back from an unticked checkbox.
        if (a !== 0 || Number(r.amp.value) === 0 || r.amp.value === '') r.amp.value = String(a);
        if (f !== 0 || Number(r.freq.value) === 0 || r.freq.value === '') r.freq.value = String(f);
      }
      /*
       * ⚠️ **NO ROW IS READ-ONLY BECAUSE OF ITS REGIME ANY MORE — the only disabled rows are the ones this STYLE
       * does not read**, and that reversal is the commission's own requirement (owner, 2026-09-23). Editing a cell
       * takes the terms over (`writeTerm` → `adoptShownTerms`), so a row that shows a live number and refuses the
       * edit is exactly the "an edit doesn't reach the animation" symptom. Where the take-over cannot be
       * bit-tight the answer is `termNote`, ABOVE the rows and before the first keystroke — never a locked box.
       */
      const inert = r.table === 2 && !zoomTable;
      r.check.disabled = inert;
      r.amp.disabled = inert;
      r.freq.disabled = inert;
    }

    for (const p of this.paneSummaries) {
      const t = p.table === 1 ? shown.t1 : shown.t2;
      const [ampRow, freqRow] = p.axis === 'x' ? [0, 1] as const : [2, 3] as const;
      // ⚠️ **The zoom flag is per TABLE, not per style** — `harmonics()`' own rule: in table 2 a frequency-0
      // amplitude is a steady zoom and must not be printed as the shift half's dead `@0`.
      const h = harmonics(t[ampRow], t[freqRow], p.table === 2);
      p.el.textContent = h === '—' ? '— silent in this direction' : h;
    }

    if (this.identLine) {
      this.identLine.textContent = describeTermIdentity(
        layer, this.table1, this.table2, width, height, cx, cy,
      );
    }

    /*
     * ⚠️ **HERE AND NOT IN `sync()` ALONE, AND THAT IS THE ONE PLACEMENT THAT MATTERS.** `Shape Mix`'s drag
     * handler ends in `refreshDerived()` (never `sync()`, which would write every handle and fight the
     * pointer), so a gate placed only in `sync()` would leave *“Shape mix is 0 — the field is still Sine”* on
     * screen for the whole drag that disproves it. `sync()` ends in this method, so both paths are covered by
     * ONE call site.
     */
    this.syncShapeNotices(layer);

    if (this.gainNote) {
      // ⚠️ The regime test is the BAKE's existence, the same one the term note uses: a bake exists only on a named
      // pattern, where Strength is already inside the shown rows. One predicate for both lines (invariant 25).
      const text = shown.bake ? '' : describeTableGain(staticFieldOf(layer), layer.style === 3);
      this.gainNote.textContent = text;
      this.gainNote.style.display = text ? '' : 'none';
    }

    if (this.termNote) {
      // ⚠️ The note is `StaticFieldBake.warning`'s own sentence and its gate is that sentence's existence, so
      // what the user reads and what the arithmetic does cannot diverge (invariant 25). A second wording here is
      // how the two come to describe different preconditions.
      this.termNote.textContent = note ?? '';
      this.termNote.style.display = note ? '' : 'none';
    }

    if (this.readoutEl) {
      this.readoutEl.textContent = describeStaticField(m, layer, this.table1, this.table2);
    }

    this.refreshButtons();
  }

  /**
   * Arm or disarm `↺ Reset field` and `↻ Reapply field`. Called from the end of every repaint, so no caller can
   * change the field and leave the pair describing the state before its own edit.
   *
   * ⚠️ **Reset is armed by COMPARING, never by a dirty flag.** A flag set on every write would stay armed after
   * a slider was dragged away from its baseline and back, and — worse — after an edit the engine normalised
   * away; `snapshotKey()` owns the comparison, including the absent-vs-all-default case `normaliseChain()`
   * creates. **Reapply is armed by the EXISTENCE of `redoSnapshot` alone**, which is what the owner asked for:
   * it always puts back the state that was live just before Reset, so it is available exactly once per Reset
   * and any later edit (which `rebaseline()` does not run on) leaves it pointing at that same state.
   *
   * ⚠️ **`(Preset) — edited` IS `↺ Reset field`'s own comparison, wearing a word instead of a disabled
   * attribute** (owner, 2026-09-23: *"as soon as we start editing then name changes … we can go back to the
   * original setting with value `Preset` by pushing the button `Reset`"*). Computing it here, from the one
   * `snapshotKey()` pair, is what makes that promise literally true: the label can only say "edited" while the
   * button that undoes it is armed, so there is no state where the word appears and `Reset` cannot clear it. A
   * second dirty test next to the dropdown is how the two come to disagree — and a `dirty` FLAG would survive a
   * drag away and back, which is the defect the comparison exists to avoid.
   */
  private refreshButtons(): void {
    const now = this.capture();
    const dirty = now !== null && this.entrySnapshot !== null
      && TransMapTab.snapshotKey(now) !== TransMapTab.snapshotKey(this.entrySnapshot);
    if (this.resetBtn) this.resetBtn.disabled = !dirty;
    if (this.reapplyBtn) this.reapplyBtn.disabled = this.redoSnapshot === null;
    /*
     * ⚠️ **Both dropdowns, because both name ONE field's regime**: an adoption sends `pattern` and `pattern2` to
     * `(Preset)` together (see `adoptShownTerms()`), so labelling one and not the other would say the shift half
     * is edited and the zoom half is not. Only the `textContent` changes — never the `value`, which is the stored
     * word and must stay bare (*Phase 19*'s rule: a label persisted is the defect), and never the option SET,
     * because replacing a `<select>`'s children closes it under the user's cursor.
     */
    const label = dirty ? PATTERN_EDITED_LABEL : PATTERN_CLEAN_LABEL;
    for (const sel of [this.patternSelect, this.pattern2Select]) {
      const opt = sel?.querySelector<HTMLOptionElement>(`option[value="${PATTERN_PRESET}"]`);
      if (opt && opt.textContent !== label) opt.textContent = label;
    }
  }
}
