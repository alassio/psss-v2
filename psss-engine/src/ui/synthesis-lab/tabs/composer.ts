/**
 * @file v8 16.3–16.5 (E94–E96) — the **Composer**: the first and only surface that can author or inspect the
 * Lissajous curve the whole library is made of.
 *
 * ⚠️ **WHY A NINTH TAB EXISTS AFTER FIFTEEN PHASES, stated as the absence it fills.** Every other tab edits a
 * *decoration* of the figure — a field, a material, a grading, a render mode, a trail. `grep -rn "waves"
 * src/ui/` returned three hits before this file, all readers. So the engine had six field systems, nine
 * materials, fifteen film looks and twelve TransMap styles decorating a subject that **no UI could author,
 * read, or explain.** That gap was found by grepping for what was missing rather than by any browser pass,
 * and it is the whole argument for Phase 16: the output-channel discriminator ranks *ways of moving
 * particles*, and this adds neither a field nor a channel but an authoring surface for what all of them
 * decorate.
 *
 * **The vocabulary, and why it is not the config spelling.** A `WaveConfig` axis is
 * `phase`/`am{base,amplitude,frequency}`/`fm{base,amplitude,frequency}` — seven numbers whose names describe
 * an FM synthesiser rather than a shape. The tab teaches **seven words, one per stored field, and no field has
 * a second one**: **Winding** (`fm.base` — how many times the curve wraps), **Size** (`am.base`), **Shift**
 * (`phase`, shown in *effective* degrees), **Pulse** and **Pulse rate** (`am.amplitude`, `am.frequency` — the
 * size moving), **Wobble** and **Wobble rate** (`fm.amplitude`, `fm.frequency` — the winding moving, in the same
 * cycles-per-figure unit as Winding itself). `composer-model.ts` owns that renaming and is the only writer.
 *
 * ⚠️ **THE ONE-WORD-PER-FIELD RULE IS v8 16.12 (E103) AND IT FIXED A REPORTED DEFECT OF SYNONYMY, NOT OF
 * CLARITY.** The tab shipped with a `Pulse` row *and* a `Size breathes` row, a `Wobble` row *and* a
 * `Winding breathes` row — each pair being one stored field in two units — plus a `Phase / twist` label holding
 * two words for one control. The owner counted them as separate quantities and asked *"I am confused about
 * wobble versus winding breathes, isn't that the same?"* — a question that was **correct**, and that no tooltip
 * could have answered while both words shipped: ⚠️ **a synonym is discovered by everyone, a tooltip only by
 * someone who already suspects the control.** **Never reintroduce "breathes", "amplitude", "frequency",
 * "AM/FM depth" or "twist" as a user-facing word for any of the seven.** Where two rows show one field, they
 * share the noun and differ only in the parenthesised unit.
 *
 * ⚠️ **THREE STRUCTURAL DECISIONS ARE THE OWNER'S AND MUST NOT BE QUIETLY REVISITED:** three wave rows are
 * always shown (no add/remove — a silent row says *"empty — nothing authored here"*, and since 16.17 the way out
 * is the level's own enable checkbox rather than a `+ give it size` button); the
 * Score defaults to XY with an XZ/YZ toggle rather than three panes; and an external preset change **fully
 * resyncs** this tab rather than trying to preserve edits.
 *
 * ⚠️ **THE SECOND OF THOSE THREE WAS SUPERSEDED BY THE OWNER ON 2026-09-08 (v8 16.9 / E100), AND IT IS RECORDED
 * RATHER THAN DELETED BECAUSE THE ORIGINAL WAS A DECISION AND NOT A GUESS.** The one-plane-plus-toggle design
 * shipped and was then reported as the tab's worst confusion: *"I select X/Y diagram and can then select per
 * wave a setting which sets all 3 dimensions X/Y/Z? switching to the Y/Z diagram different selections can be
 * made but again for all X/Y/Z? this is confusing."* The chips were a **view** control sitting inside a column
 * of **edit** controls, so a plane change read as an edit that had failed to take. All three planes are now
 * drawn side by side, always, and **the notion of a SELECTED plane is gone** — `ScorePlane` survives only as
 * the sampling parameter it always was. **Do not re-add a plane selector.**
 *
 * ⚠️ **THE STEPPER IS THE FIRST IN THE LAB, and that is forced by the data rather than chosen.** There is no
 * `input.type = 'number'` anywhere else in `src/ui` — every numeric control is a `range`. But the library's
 * winding numbers span 0.5 to 8000 across a few dozen distinct values, so no linear range resolves the small
 * end and no log range lands on integers, and **an integer is exactly what closes the curve.** `trackcheck`
 * vets `SliderSpec` stops and cannot vet a stepper, so `composercheck` §C owns that representability claim.
 *
 * ⚠️ **BUT IT NO LONGER ROUNDS WHAT IT IS TYPED (v8 16.13 / E104), AND THE ROUNDING WAS A SILENT REWRITE OF
 * AUTHORED DATA.** The spinner arrows still step by 1 — ±1 is the meaningful move for a closing figure — while a
 * typed value is stored verbatim and the readout says `closes` or reports a seam. The library carries 12
 * non-integer windings of 3591 axes (`0.5` on 8, `112.5` on 4); **twelve is not the argument.** The argument is
 * that a control which silently changes the value it was asked to display is invariant 13 inverted, and that the
 * same row already refuses to round SIZES for a much larger reason — 728 of 3591 sizes are non-integer, across
 * 220 of 399 presets. ⚠️ **State both bases and never add them** (both from the axis collector over different
 * fields; `composercheck` prints its own).
 *
 * ⚠️ **AND SINCE v8 16.15 (E106) NOTHING IN THE ENGINE ROUNDS A WINDING AT ALL — `Repair` AND `repairFigure` ARE
 * BOTH DELETED, ON THE OWNER'S WORD (*"forget about buttons Repair and Simplify"*).** The rule this header used to
 * carry was *"`Repair` is the only rounder; do not unify it with the stepper"*; the rule now is the strictly
 * simpler **nothing rounds**, which is closer to 16.13's own argument than the pair ever was. `repairFigure` died
 * with its button because the button was its ONE caller (grepped before deleting, not assumed), and the tie rule
 * `Math.round(-9.5) === -9` it owned is gone with it — ⚠️ **if a rounder is ever re-introduced, that tie rule has
 * to be re-derived rather than recalled.**
 */

import type { TabModule } from '../../../exploration/tab-module.ts';
import type { ExplorationState, TabId } from '../../../exploration/state.ts';
import type { UnifiedPreset } from '../../../presets/types.ts';
import type { AxisWave } from '../../../core/interfaces.ts';
import type { VisualFxControls } from './visual-fx.ts';
/*
 * v8 16.19 (E110) — the Speed slider repeated at the top of this tab.
 *
 * ⚠️ **A VALUE IMPORT BESIDE THE TYPE-ONLY ONE ABOVE, AND THE WHOLE STEP IS THAT THIS LINE EXISTS.** The ask was
 * *"the slider should be identical to the one on the Visual Fx page"*, and "identical" is taken literally: the
 * squared track, its step and its format string are ONE owner, so the Composer's copy cannot drift from the
 * original. A re-derived curve would be a second owner of a quantisation that was measured against the library
 * (376 distinct speeds, exact value→position→value round trip) — *"a re-pointed regex survives until the next
 * rename; an import survives it."* **Add no arithmetic here.**
 *
 * ⚠️ **THE PHASE PLAN ASSERTED THESE WERE ALREADY EXPORTED AND `fmtSpeed` WAS NOT** — it was module-private, and
 * only trying the import found out. Exporting it was this step's one edit to `visual-fx.ts`. **A plan's
 * measurement of another file's export surface is a claim, not evidence.**
 */
/*
 * ⚠️ **AND THE SAME LINE CARRIES THE WHOLE OF THE 2026-09-10 `Framing & Timing` REPEAT.** The owner asked for
 * *"the full set of controls of the Framing & Timing section"*, connected to *"exactly the same settings
 * values"* — so every curve, step and formatter is imported and **this file adds no arithmetic of its own.**
 * `figureScaleToPos`, `fmtFigureScale` and `fmtParticleCount` were module-private and were exported for this;
 * the alternative was re-derived mappings whose drift from the original would be invisible in exactly the way
 * `fmtSpeed`'s would have been.
 *
 * ⚠️ **`fmtSymmetryFold` WAS IN THIS LIST UNTIL 2026-09-10 AND WENT BACK TO MODULE-PRIVATE WITH THE CONTROL IT
 * WAS EXPORTED FOR** (owner: *"remove the Symmetry control, this one is not needed on the Composer tab"*). An
 * export whose stated reason has gone is a claim that reads as a dependency — and nothing in the toolchain
 * reports an unused one, which is why it was narrowed by hand rather than left for `tsc`.
 */
import {
  SPEED_STEP, SPEED_TRACK, fmtSpeed,
  PARTICLE_STEP, particleCountToPos, posToParticleCount, fmtParticleCount,
  figureScaleToPos, fmtFigureScale,
} from './visual-fx.ts';
// The log track Figure Scale shares with the Sliders tab's ten multipliers — `figureScaleToPos`'s inverse.
import { sliderMul } from '../../../exploration/slider-mappings.ts';
// Rotation's signed quartic track, its step and its RPM formatter — three owners, none of them here.
import { ROT_STEP, rotationToPos, posToRotation, fmtRotationRpm } from '../../../core/rotation-track.ts';
import { TAB_TIPS } from '../tooltips.ts';
import { makeCollapsible } from '../collapsible.ts';
import type { Collapsible } from '../collapsible.ts';
import {
  readFigure, writeFigure, applyStack, seedFigure, applyMutes, blankAxisCell,
  ratioBase, applyRatio, RATIO_ROWS, phaseForTarget, wrap360, closesAt,
  modulatorSeconds, rateForSeconds, periodPhrase, breathePercent, amplitudeForPercent,
  SLOT_LABELS, AXIS_LABELS, AXES, MAX_WAVES,
  SEED_WINDING, SEED_SIZE, SEED_PARTICLE_COUNT, SEED_WAVE_SPEED,
} from '../composer-model.ts';
import type { FigureModel, AxisCell, SlotModel } from '../composer-model.ts';
import {
  computeScore, drawScore, PLANES, PLANE_LABELS,
  computeOverlayScores, drawOverlayScore, paneExtent,
} from '../score-canvas.ts';
import type { ScorePlane, ScoreResult, OverlayCurves, WaveOps } from '../score-canvas.ts';

/**
 * The harmonic stacks the `Stack ▾` menu offers, as multiples of the Body slot's winding.
 *
 * ⚠️ **DERIVED BY MEASURING THE LIBRARY, and the measurement did not match the figure the phase plan quoted.**
 * The plan named 34 distinct between-slot stacks; counting them with a representative winding of
 * `max |fm.base|` over each slot's *audible* axes gives **49**, and many are fractional (a Detail slot winding
 * more slowly than the Body). ⚠️ **That is a difference of BASIS, not an event** — a collector that takes the
 * first axis, or that includes silent axes, counts a different set. So this list is not "the top N stacks":
 * it is a hand-picked spread of the integer ones that were common AND are musically legible, plus the two
 * sub-unit cases the library actually authors. **State the basis with any figure quoted about it.**
 *
 * ⚠️ **THEY ARE NAMED FOR WHAT THEY DO, not for their ratio**, because `×5 ×125` tells the user nothing about
 * the picture. The names are descriptive rather than authoritative — no library preset is titled any of these.
 */
const STACKS: ReadonlyArray<{ label: string; multiples: [number, number] }> = [
  { label: 'Unison — all three wind together', multiples: [1, 1] },
  { label: 'Octaves — 1 : 2 : 4', multiples: [2, 4] },
  { label: 'Fifths — 1 : 3 : 9', multiples: [3, 9] },
  { label: 'Rosette — 1 : 4 : 16', multiples: [4, 16] },
  { label: 'Filigree — 1 : 5 : 125', multiples: [5, 125] },
  { label: 'Dense weave — 1 : 32 : 100', multiples: [32, 100] },
  { label: 'Slow drift — 1 : ¼ : 1/16', multiples: [0.25, 0.0625] },
];

/** One editable numeric field, remembered so `sync()` can write values back without rebuilding the DOM. */
interface Cell {
  input: HTMLInputElement;
  slot: number;
  axis: number;
  field: keyof Pick<AxisCell, 'winding' | 'size' | 'pulse' | 'pulseRate' | 'wobble' | 'wobbleRate' | 'phase'>;
}

/*
 * ⚠️ **THE THUMBNAIL SIZE LIVES IN `panel.css` ALONE (`.sl-composer-thumb`'s width plus `aspect-ratio: 1/1`),
 * AND A `TILE_PX` CONSTANT HERE WAS DELETED RATHER THAN USED.** `drawScore` sizes its backing store from
 * `clientWidth`/`clientHeight`, so a JS constant would be a second owner of one number that the CSS would
 * immediately override — the two would agree until someone changed the layout. **A thumbnail's SAMPLE count is
 * set by its winding and not by its pixel size** (`sampleCountFor` returns the `SCORE_MIN_SAMPLES` floor of 720
 * for every entry in the set, the largest component being 8), which is why the cache exists for the redraw RATE
 * and not for any per-draw cost.
 */

/**
 * The merged ratio control (16.11) — a hand-built combobox/listbox, one per slot.
 *
 * ⚠️ **IT IS HAND-BUILT BECAUSE `<option>` RENDERS TEXT ONLY, IN EVERY ENGINE — that was CHECKED, not
 * assumed.** A `<select>` cannot hold a canvas, so the owner's *"tiny shape images in the dropdown list"* is
 * only reachable through `role="combobox"` + `role="listbox"`, which then owes the keyboard and focus behaviour
 * a native `<select>` would have given for free: `aria-expanded`, `aria-activedescendant`, per-row
 * `aria-selected`, Arrow/Home/End/Enter/Space/Escape, and a click-outside dismiss.
 */
interface RatioBox {
  slot: number;
  /** The closed control — `role="combobox"`. */
  button: HTMLButtonElement;
  /** The current-value text inside the button, rewritten by `sync()`. */
  value: HTMLElement;
  /** The popup — `role="listbox"`, `display` toggled. */
  list: HTMLElement;
  /** One `role="option"` per `RATIO_ROWS` entry, index-aligned with it. */
  options: HTMLElement[];
  /** `[row][plane]`, index-aligned with `RATIO_ROWS` × `PLANES`. */
  canvases: HTMLCanvasElement[][];
  /** The `aria-activedescendant` row, or -1. Keyboard focus only — never the committed value. */
  active: number;
}

/**
 * One drawn pane of an overlay row (16.9 / 16.10). `slot === null` is the combined figure at the top of the tab.
 *
 * ⚠️ **THE PLANE IS A PROPERTY OF THE PANE AND NEVER OF THE TAB — that is the whole of 16.9.** The tab used to
 * hold `private plane` and one canvas, so a plane was a piece of *selected state* sitting among edit controls;
 * three panes each knowing their own plane removes the state rather than relocating it.
 */
/*
 * ⚠️ **`SIMPLE_FIELD_LABELS` IS DELETED WITH THE TIER (16.15), AND ITS ONE TRANSFERABLE LESSON IS NOT.** It
 * existed because two strings served two jobs at once — an `aria-label` and the `data-simple` key `sync()`
 * queried by — so a rename reaching one site left `sync()` matching nothing, which reads exactly like a working
 * sync. **Any future control whose label is also a DOM lookup key owes itself the same single owner.** The 21
 * numeric inputs do not: they are registered in the `cells` array by object reference, never queried by string.
 */

interface Pane {
  canvas: HTMLCanvasElement;
  slot: number | null;
  plane: ScorePlane;
  /**
   * The *"flat here"* caption — v8 16.20 (E111). Always built, `display` toggled; never created on demand.
   *
   * ⚠️ **IT IS HELD BY REFERENCE FOR THE SAME REASON `cells` IS, AND THE DELETED `data-simple` LOOP IS THE
   * PRECEDENT** (see the note above `Pane`): a caption queried by a string key built from a label is a caption
   * that stops updating the moment either is renamed, which reads exactly like a pane that is never flat. And
   * because a flat pane is 30 of 3759 across the library, nobody would report it.
   *
   * ⚠️ **ONE ELEMENT WITH ITS TEXT SET AT BUILD TIME, TOGGLED BY `display` — NOT text assigned per sync.**
   * `tipcheck` §I's inline-copy scan matches a LITERAL after `.textContent =`, so copy assembled in `sync()`
   * from a variable would be invisible to the ceiling it exists to enforce (`CLAUDE.md`: *"set the text once and
   * toggle `display`"*). Its one literal also makes it greppable, which is what lets §R assert the copy agrees
   * with the row readout's.
   */
  flatCap: HTMLElement;
}

/** A dial (16.7): one canvas per axis, remembered so `sync()` can repaint it. */
interface Dial {
  canvas: HTMLCanvasElement;
  slot: number;
  axis: number;
  /** ⚠️ Non-null only WHILE a pointer is down — see `installDial`. */
  drag: number | null;
}

/** One breathe field (16.8). `depth` is a percent or an absolute; `seconds` is a period. */
interface BreatheCell {
  input: HTMLInputElement;
  unit: HTMLElement;
  slot: number;
  axis: number;
  kind: 'pulseDepth' | 'pulseSeconds' | 'wobbleDepth' | 'wobbleSeconds';
}

/**
 * The empty-pane caption (v8 16.20 / E111) and the row readout's silent-axis phrase, side by side.
 *
 * ⚠️ **THEY ARE ONE LITERAL EACH AND THEY SIT TOGETHER BECAUSE THE STEP'S RULE IS THAT THEY MUST NOT DISAGREE.**
 * Both describe the same underlying fact at different granularity — *this projection shows nothing* against
 * *this axis has no size* — and they are two strings because they answer two questions, not because there are two
 * facts. Splitting them across two files is how they would drift into contradicting each other on the same row.
 *
 * ⚠️ **THE PANE CAPTION IS THE WEAKER CLAIM ON PURPOSE, AND IT IS WEAKER BY MEASUREMENT** — see `buildTriple`:
 * a zero winding flattens a pane whose axes both carry a real authored size, so the pane can only honestly report
 * the projection, while the row readout (which reads the model, not the drawn curve) is the one entitled to name a
 * cause. **Do not "improve" the pane caption by naming an axis or a cause; that is the row's job.**
 *
 * ⚠️ **NEITHER MAY EVER BE REPHRASED TO SUGGEST A REMEDY THE TAB THEN APPLIES.** Invariant 29: say so, do not
 * grant the axis a size.
 */
const FLAT_PANE_CAPTION = 'flat here — no reach in this plane';
const SILENT_AXIS_PHRASE = 'no size — winding inert there';

/**
 * The slowest LIVE modulator on a row, in seconds, plus whether the whole row actually repeats at that period —
 * v8 16.20 (E111). `null` when nothing on the row modulates at all.
 *
 * ⚠️ **A ROW CAN HAVE A SLOWEST MODULATOR AND STILL NOT REPEAT AT ITS PERIOD, AND THE COPY MUST NOT CLAIM
 * OTHERWISE — MEASURED, NOT ANTICIPATED.** Of 1197 library slots, **436 have no live modulator at all** (no
 * period exists), **248 carry exactly one rate** (the row's period *is* that modulator's), and **513 carry two or
 * more — of which 225 are NOT integer multiples of the slowest**, e.g. `Andromeda`'s `1, 1.2, 1.3` or
 * `Alpha Particles`' `2, 5`. On those the figure returns to its opening pose only at a common multiple far beyond
 * the slowest cycle, so *"repeats every 120 s"* would be **confidently wrong on 225 rows** — and confidently
 * wrong is the exact failure shape this phase's three readout defects shared. So the two cases get two phrasings
 * and each says only what is true of its own case.
 *
 * ⚠️ **LIVENESS IS `amplitude !== 0 && rate !== 0`, THE STRICT/EFFECTIVE PAIR, AND BOTH HALVES ARE REQUIRED.** An
 * amplitude of 0 is inert whatever the rate; a rate of 0 never moves whatever the amplitude — the same test
 * `chooseInstants` and `syncBreatheCells` already use, and taking either alone would put a period on a row that
 * has none.
 *
 * ⚠️ **IT DELIBERATELY DOES *NOT* SKIP MODULATORS ON A SILENT AXIS, unlike `reachProxy`/`amSum`.** Those weight by
 * instantaneous visibility because they are choosing an instant to DRAW; this is answering *"how fast is this row
 * moving"* about the stored figure. **Measured: the distinction is unreachable — 0 of 1197 rows have their slowest
 * rate on a silent axis, and 0 have every rate there** — so the two rules agree on the whole library today and the
 * choice is recorded rather than hidden behind an agreement that could end with one authored preset.
 */
function slowestModulatorSeconds(slot: SlotModel, waveSpeed: number): { seconds: number; repeats: boolean } | null {
  const rates: number[] = [];
  for (const cell of slot.axes) {
    for (const [amp, rate] of [[cell.pulse, cell.pulseRate], [cell.wobble, cell.wobbleRate]] as const) {
      if (amp === 0 || rate === 0) continue;
      rates.push(Math.abs(rate));
    }
  }
  if (rates.length === 0) return null;
  const slowest = Math.min(...rates);
  const seconds = modulatorSeconds(slowest, waveSpeed);
  if (seconds === null) return null;
  // ⚠️ The tolerance is on the RATIO, which is dimensionless — an absolute epsilon on rates spanning 0.05 to 12
  // would call the fast end commensurate with anything. `closesAt`'s own argument, one quantity over.
  const repeats = rates.every(r => Math.abs(r / slowest - Math.round(r / slowest)) < 1e-9);
  return { seconds, repeats };
}

// `periodPhrase` MOVED to `composer-model.ts` (v8 Step 21.4e) and is imported above. It did not change: a
// second readout — Visual FX's `Colour Drift` — now describes a period of the same kind off the same
// `modulatorSeconds`, and **two spellings of the phrase would be two conventions for one quantity**, which is
// exactly the defect its own header argues against one row apart. The model module is where the arithmetic it
// rounds already lives, so the phrase and its factor of 60 stay in one file.

/** How close to a detent counts as on it, in EFFECTIVE degrees. */
const DIAL_SNAP_DEG = 7;
const DIAL_DETENTS: readonly number[] = [0, 90, 180, 270];

export class ComposerTab implements TabModule {
  readonly id: TabId = 'composer';
  private state: ExplorationState | null = null;
  private container: HTMLElement | null = null;
  private controls: VisualFxControls;

  /** The model being edited. Rebuilt from the preset on every external change (the owner's resync decision). */
  private model: FigureModel | null = null;
  private cells: Cell[] = [];
  private dials: Dial[] = [];
  private breatheCells: BreatheCell[] = [];
  /** One merged ratio control per slot (16.11). */
  private ratioBoxes: RatioBox[] = [];
  /**
   * One `ScoreResult` per `RATIO_ROWS` entry PER PLANE, or `null` before the first build.
   *
   * ⚠️ **THE CACHE IS THE WHOLE REASON THE THUMBNAILS ARE AFFORDABLE, AND INVARIANT 8 IS ABOUT THE RATE RATHER
   * THAN THE COST.** The rows are drawn from `RATIO_ROWS` alone (unit sizes, not the slot's own axes) precisely
   * so they do not depend on anything an edit changes: **the only input is the ratio.** That is also why
   * choosing a row writes windings ONLY, and why the tooltip says so — a thumbnail that promised the user's own
   * sizes and phases would have to be rebuilt per slot per edit, which is the design this cache exists instead
   * of.
   *
   * ⚠️ **IT IS NOW PLANE-INVARIANT AND HAS NO INVALIDATION AT ALL, AND THE MISSING LINE IS A REMOVED DEFECT
   * CLASS RATHER THAN AN OVERSIGHT (16.11).** Its only invalidation was the plane chip's `this.galleryScores =
   * null`, which existed solely because *a stale cache draws XY curves under an XZ label.* Every row now draws
   * all three planes, so there is no plane state to go stale. **Do not port an invalidation forward "for
   * safety": a dead invalidation is an assertion nobody can fail.**
   */
  private ratioScores: ScoreResult[][] | null = null;
  /**
   * Every drawn diagram pane: three for the combined figure plus three per lit slot (16.9 / 16.10).
   *
   * ⚠️ **PER-SLOT ENTRIES MUST BE FILTERED OUT IN `renderSlotBody`, exactly like `cells` and `dials` — and
   * omitting that filter is silent.** `body.innerHTML = ''` detaches the canvases but leaves the registry
   * pointing at them, so `drawScoreNow()` would go on rasterising into detached nodes while the row's real
   * panes, registered on the next pass, sat beside stale duplicates that never update.
   */
  private panes: Pane[] = [];
  private extentLabel: HTMLElement | null = null;
  private preconditionEl: HTMLElement | null = null;

  /**
   * v8 16.17 (E108) — which levels are switched OFF. **One boolean per slot, in TAB state and nowhere else.**
   *
   * ⚠️ **THE OWNER ASKED FOR TWO THINGS THAT ONLY FIT TOGETHER IF THE MUTE IS A PROJECTION: a level
   * *"temporarily turned off for the diagrams and the preview"* that *"export however or Snapshot would export
   * cleared"*.** So the authored numbers live in the INPUTS (that is the whole of the recoverability) and every
   * consumer of the figure — `workingPreset`, Export, Snapshot, the Mixer, the engine, all twelve diagram panes —
   * reads `applyMutes(model, muted)` through the one `commit()` path. **One owner of what the figure IS, so the
   * mute cannot disagree with the screen.**
   *
   * ⚠️ **IT IS DELIBERATELY NOT IN THE MODEL AND NOT IN THE PRESET, AND BOTH WRONG ANSWERS ARE TEMPTING.**
   * `SlotModel`'s own comment forbids presentation state outright; a preset field would need a `MigrationLayer`
   * backfill and a Mixer entry (*"neither `tsc` nor any checker sees the omission"*) and would carry a mute to a
   * machine that never set one, resurrecting a wave on reload. **The cost is stated in the UI instead** — a
   * muted level is gone for good once the figure is replaced, which is the same sentence as *"exports cleared"*.
   *
   * ⚠️ **INVARIANT: a MUTED slot is always a LIT slot.** A silent row has nothing to mute, so `refreshDerived()`
   * normalises the flag rather than leaving it set — otherwise clearing a muted row's fields would leave a mute
   * over an empty level, and the checkbox would offer to restore numbers that no longer exist.
   */
  private muted: boolean[] = [false, false, false];
  /**
   * The per-level enable checkboxes, remembered so `sync()` can write them back.
   *
   * ⚠️ **THIS REGISTRY IS *NOT* FILTERED IN `renderSlotBody`, UNLIKE THE OTHER SIX, AND THE ASYMMETRY IS THE
   * POINT: the checkbox lives on the slot HEAD, which `renderSlotBody` never touches.** Filtering it there would
   * drop the entry on the first body rebuild and leave a checkbox that never updates again — the exact failure
   * the six filters exist to prevent, reached by copying the idiom to a control that is not in the body.
   *
   * ⚠️ **`body` AND `offNote` RIDE IN THE SAME REGISTRY AND THAT IS SOUND FOR THE SAME REASON, WHICH IS NOT THE
   * OBVIOUS ONE: `renderSlotBody` clears the body's CONTENTS (`body.innerHTML = ''`) and never replaces the body
   * ELEMENT**, so these two handles outlive every rebuild exactly as the head's checkbox does. A registry of
   * nodes that `renderSlotBody` detaches would be the silent-stale shape the six filters answer.
   */
  private levelToggles: Array<{
    slot: number;
    input: HTMLInputElement;
    body: HTMLElement;
    offNote: HTMLElement;
    clear: HTMLElement;
  }> = [];
  /**
   * The inline notice that a switched-off level exports cleared. Text set ONCE; only `display` is toggled.
   *
   * ⚠️ **INLINE AND GATED, WHICH ARE TWO SEPARATE OBLIGATIONS (invariants 25 and 13).** Inline because a
   * tooltip is discovered only by someone who already suspects the control, and the fact that a switched-off
   * level is *unrecoverable after the next figure change* is not something a reversible-looking checkbox
   * suggests. Gated because a permanent warning describes a state that is not happening — **a control that
   * explains the pipeline must be gated on the pipeline actually being in that state.**
   */
  private muteNoticeEl: HTMLElement | null = null;

  /**
   * The repeated `Framing & Timing` sliders — v8 16.19 (E110) shipped one of them (Speed); the owner's
   * 2026-09-10 ask replaced it with the whole section, so the single field became a registry.
   *
   * ⚠️ **EVERY HALF IS HELD, because this tab has no `controlList` and therefore no `syncControl`.** Visual FX
   * finds its label as the input's NEXT SIBLING; that is a convention of ITS factory, not of the DOM, so copying
   * the lookup instead of the reference would be a second owner of a layout decision. Holding the pair is the
   * smaller commitment.
   *
   * ⚠️ **NOT IN `SliderSpec`, NOT IN `controlList`, AND DELIBERATELY HAND-MIRRORED.** `slider()` is a private
   * member of `VisualFxTab` over its own `controlList`; reaching it would mean exporting a factory bound to
   * another tab's sync machinery. What is shared is the ARITHMETIC (the tracks, the steps, the formatters),
   * which is the part a drift would be invisible in — a differently-shaped `<div>` is not.
   *
   * ⚠️ **`get`/`toPos`/`fmt` TRAVEL WITH THE INPUT so `sync()` needs no per-control branch** — 16.17's
   * post-mortem, where a `switch` over a fixed list was named as *"a second enumeration of one list"*. The
   * three closures ARE the enumeration, written once at the build site. Rotation's three handles differ only
   * in what their `get` closes over, which is why the triplet needs no separate registry.
   */
  private framingSliders: Array<{
    input: HTMLInputElement; label: HTMLElement;
    get: () => number; toPos: (v: number) => number; fmt: (v: number) => string;
  }> = [];

  /**
   * The framing section's boolean control (`Mirror`), same registry shape as the sliders above.
   *
   * ⚠️ **SEPARATE FROM `bypassToggles` BECAUSE THE TWO FAMILIES HAVE OPPOSITE PERSISTENCE AND OPPOSITE
   * POLARITY** — this one is SAVED with the preset and painted from the value it names; those two are engine
   * view state and painted INVERTED. One registry for both would put that distinction inside a per-entry flag,
   * which is exactly the shape 16.17 got wrong.
   */
  private framingChecks: Array<{ input: HTMLInputElement; get: () => boolean }> = [];

  /**
   * `Mirror`'s row, hidden at fold 1 — the same `syncVisibility` rule Visual FX applies to its own copy.
   *
   * ⚠️ **A HIDDEN ROW IS NOT A DISABLED ONE, AND VISUAL FX'S CHOICE IS FOLLOWED RATHER THAN RE-DECIDED:** at
   * fold 1 a mirror is not *"hard to see"*, it is algebraically absent (there is no neighbouring sector to
   * reflect into), so the row goes away instead of greying. Two surfaces for one control must agree about that.
   *
   * ⚠️ **SINCE 2026-09-10 THE FOLD IT DEPENDS ON HAS NO CONTROL ON THIS TAB** (the owner removed `Symmetry`
   * here), so this row is now the only member of the section whose presence a Composer user cannot cause. On
   * nearly every library preset the fold is 1 and this row is therefore ABSENT — which means the section's last
   * visible row is usually Rotation, and a reader counting rows on screen will not count six.
   */
  private symmetryMirrorRow: HTMLElement | null = null;

  /**
   * v8 16.18 (E109) — the two preview bypass checkboxes, each paired with its own engine getter.
   *
   * ⚠️ **THE GETTER IS STORED BESIDE THE INPUT SO `sync()` NEEDS NO PER-BOX BRANCH, and the reason is 16.17's
   * post-mortem:** a `switch` or an index-keyed lookup here is a second enumeration of a two-member list, and
   * *"three enumerations of one list make a missing entry structurally invisible"*. The pair is the enumeration.
   *
   * ⚠️ **NEITHER FLAG LIVES HERE.** Both are engine state (`main.ts`), because a bypass must hold with the Lab
   * closed and with this tab never built — so this registry holds views, never values.
   *
   * ⚠️ **`get` RETURNS THE BYPASS FLAG AND THE BOX SHOWS ITS NEGATION (2026-09-10, the owner's polarity flip to
   * `Apply …`, ticked by default).** The INVERSION LIVES AT THE DOM BOUNDARY AND NOWHERE ELSE — one `!` where
   * the box is painted, one `!` where the `change` handler writes back — because the engine flag keeps its own
   * name and meaning (`bypassVisualFx` is still *bypass*), and a second spelling of one boolean is invariant
   * 17's shape. **Do not rename the flags to match the label.**
   */
  /**
   * v8 `31.C` — the ONE collapsible holding `Framing & Timing` AND `Preview only` (owner, 2026-10-25).
   *
   * ⚠️ **ONE GROUP OVER TWO SECTIONS, AND THE TWO SECTION TITLES SURVIVE INSIDE IT UNCHANGED — that is what
   * makes the merge safe rather than a loss.** The inner headings carry this tab's only explicit persistence
   * claims (`Framing & Timing` is SAVED with the preset; `Preview only - not saved with the figure` is not),
   * and no single outer name can make either claim for both. So the outer head is deliberately neutral and
   * says only where you are, while the two sentences that matter stay where they were.
   *
   * ⚠️ **ITS BADGE COUNTS BYPASSES, WHICH IS WHY COLLAPSING IT BY DEFAULT IS SAFE.** Both boxes are ticked
   * on load, so the abnormal state is UNTICKED - and a bypass hidden behind a closed head would be the one
   * state where the preview disagrees with the preset and nothing visible says so. `countPhrase` exists for
   * this: the shared default would read `nothing active here` over seven live framing sliders.
   */
  private setupGroup: Collapsible | null = null;
  private bypassToggles: Array<{ input: HTMLInputElement; get: () => boolean }> = [];
  /**
   * The notice that the preview and the two decoration tabs currently disagree. Text set ONCE; `display` toggled.
   *
   * ⚠️ **A THIRD top-of-tab notice, and it had to decide which of the two existing SHAPES it is** — the amber
   * `sl-composer-precondition` (an INERT PIPELINE: nothing you do here can be seen) or the cyan
   * `sl-composer-mute-notice` (a CONSEQUENCE: what you did is real and costs something elsewhere). It is the
   * second: the tab is fully live, and what needs saying is what the switch costs in another tab. **Its own class
   * because the two existing ones are deliberately not merged into one class with a modifier.**
   */
  private bypassNoticeEl: HTMLElement | null = null;

  /**
   * ⚠️ **Unsubscribe handle, and `dispose()` MUST call it (invariant 15).** `externalChangeCallbacks` is a
   * list, not a single slot, so a tab that subscribes and never unsubscribes leaves a dead closure reacting
   * to every preset change for the rest of the session — the shape `SlidersTab`'s un-removed
   * `state.on('preset-changed')` listener still has.
   */
  private unsubscribeExternal: (() => void) | null = null;

  constructor(controls: VisualFxControls) {
    this.controls = controls;
  }

  init(container: HTMLElement, state: ExplorationState): void {
    this.state = state;
    this.container = container;
    this.rebuildModel();
    this.render();
    // ⚠️ Subscribed LAST, after the first render, so the callback can never fire against a half-built DOM.
    this.unsubscribeExternal = this.controls.onExternalChange(() => this.adoptExternalFigure());
  }

  /**
   * A new figure has arrived from outside this tab — rebuild the model AND the presentation.
   *
   * ⚠️ **A FULL RESYNC, by the owner's decision.** A preset change replaces the figure outright, so there is
   * no meaningful sense in which an in-progress winding edit "survives" it; merging would produce a figure
   * that is neither the preset's nor the user's.
   *
   * ⚠️ **BUT `rebuildModel() + sync()` IS NOT A FULL RESYNC, AND THAT GAP WAS A USER-REPORTED DEFECT — the
   * external path was missing the two lines `reset()` has carried since the build.** `sync()` writes values
   * into whatever inputs are CURRENTLY in the DOM; it cannot create or remove a row's controls, because that
   * is `renderSlotBody`'s job and it is only called on a tier change or a full `render()`. So both pieces of
   * per-row PRESENTATION state survived a preset change:
   *
   * - **The silent placeholder.** A row that was silent under the outgoing preset shows
   *   `empty — nothing authored here` INSTEAD of any inputs (an early `return` in `renderSlotBody`). On the
   *   incoming preset that same row can be fully lit, and `sync()` then has no inputs to write into — so the
   *   row reads *empty* while the model, the engine and the render all hold a live wave. Reported exactly
   *   that way: *"both STRUCTURE and DETAILS show empty, whereas before all 3 were filled."* **Measured by
   *   `composercheck` §J: 238 of 399 presets have at least one silent row and so leave a placeholder behind,
   *   and 53 017 of 158 802 ordered preset pairs strand at least one row (worst case 2 of 3).**
   * - ⚠️ **A stale `tierOverride` WAS THE SECOND HALF AND IT IS GONE WITH THE TIER (16.15) — recorded because a
   *   future reader will see this list shrink and `composercheck` §J lose clauses, and must not read that as
   *   coverage lost.** The defect was: a `simple` override held over an incoming row the DATA required to be
   *   `full` put the eight simple controls over a slot carrying modulators, and the next `phase X` edit routed
   *   through `applySimple`, which **zeroed pulse/pulseRate/wobble/wobbleRate** — the lossy demotion `Simplify`
   *   refused to perform, reached through a stale presentation instead. **Measured at 92 982 (A → B, row)
   *   triples, worst single row losing 12 modulator numbers.** With one control set there is no projection to
   *   route an edit through, so **the whole class is unreachable rather than guarded**: `applySimple` was the only
   *   writer that could zero a field the user had not touched. **That is a deletion making a defect impossible,
   *   which is the strongest form of fix and the reason a shrinking §J is progress here.**
   *
   * ⚠️ **THE FIRST BULLET SURVIVES AND IS WHY THIS METHOD STILL EXISTS.** A silent → lit transition still turns a
   * placeholder row into a full body, and `sync()` still cannot create inputs that do not exist.
   *
   * ⚠️ **`reset()` IS THE CORRECT PRECEDENT AND IT ALREADY DID BOTH — so this is one behaviour with two
   * entry points where only one was complete, and the incomplete one is the path a user takes constantly.**
   * The fix is to share it: **anything that replaces the figure wholesale must rebuild the BODIES, not only
   * the values.** Do not "optimise" this back to `rebuildModel() + sync()`.
   */
  private adoptExternalFigure(): void {
    this.resetMutes();
    this.rebuildModel();
    for (let w = 0; w < MAX_WAVES; w++) this.renderSlotBody(w);
    this.sync();
  }

  /**
   * Switch every level back on. (v8 16.17 / E108)
   *
   * ⚠️ **THREE CALL SITES, AND THE LIST IS THE CONTRACT: `adoptExternalFigure()`, `reset()` and `New Figure`** —
   * every path that replaces the figure WHOLESALE. **A mute is presentation state over a specific figure, so it
   * is exactly the thing §J is a post-mortem of:** a stale placeholder body over an incoming preset was reported
   * as *"both STRUCTURE and DETAILS show empty"*, and a stale MUTE is the same defect with a worse ending — the
   * row shows the incoming preset's real numbers, the checkbox is off, and the very next `commit()` **exports
   * that level cleared.** Silent data loss on a figure the user never touched.
   *
   * ⚠️ **`New Figure` IS ON THE LIST AND IT IS THE ONE THAT DOES NOT LOOK LIKE IT NEEDS TO BE.** Its seed lights
   * slot 0 only, so mutes on 1 and 2 are normalised away by `refreshDerived()` anyway — but a mute on **Body**
   * survives, and a brand-new figure that exports empty is the worst version of this. ⚠️ **Do not conclude from
   * the normalisation that the reset is redundant: it is redundant for two slots of three.**
   */
  private resetMutes(): void {
    this.muted = [false, false, false];
  }

  activate(): void { this.sync(); }
  /** Nothing per-frame is owned here — no rAF, no interval, no `GridTileRenderer`. */
  deactivate(): void { /* intentionally empty */ }

  dispose(): void {
    // ⚠️ FIRST statements, per invariant 15 and the D17 idiom every sibling tab follows.
    this.unsubscribeExternal?.();
    this.unsubscribeExternal = null;
    this.model = null;
    this.cells = [];
    this.dials = [];
    this.breatheCells = [];
    this.ratioBoxes = [];
    this.ratioScores = null;
    this.panes = [];
    this.extentLabel = null;
    this.preconditionEl = null;
    this.levelToggles = [];
    this.muteNoticeEl = null;
    // ⚠️ **v8 16.19: the handles are dropped and EVERY ENGINE VALUE IS LEFT ALONE, which is the opposite of the
    // mute line below and deliberately so.** None of the framing values is this tab's state — they are Visual FX's,
    // shown here and now also SAVED from here — so resetting one on dispose would have closing the Lab silently
    // undo a size, speed, count or rotation the user set on ANOTHER tab. The mute is tab-owned presentation state;
    // these are second views of somebody else's values. **The rule generalised unchanged when the section grew
    // from one slider to seven controls, and again when the owner removed one of them: the discriminator is
    // whether the value has another surface, never how many controls the section holds.**
    this.framingSliders = [];
    this.framingChecks = [];
    this.symmetryMirrorRow = null;
    /*
     * ⚠️ **v8 16.18: BOTH FLAGS ARE SWITCHED OFF, WHICH IS THE OPPOSITE DECISION FROM THE FRAMING CONTROLS ABOVE
     * — and the discriminator is whether the value has ANOTHER SURFACE, not whether this tab owns it.** Every
     * framing value has Visual FX's own control, so leaving them alone leaves them reachable; these two flags
     * have **exactly one control in the whole UI, and it is the one being destroyed.** Left on, the session would run with a
     * stripped preview and nothing anywhere able to restore it — a state reachable only by re-opening the Lab
     * and finding a tab whose checkbox explains a picture the user has stopped associating with it.
     *
     * ⚠️ **THE SETTERS ARE CALLED RATHER THAN THE FIELDS CLEARED, so the engine actually re-applies the authored
     * look** — writing `false` into a local would leave the preview stripped while every readout claimed
     * otherwise, which is invariant 13 with the pixels as the output channel.
     *
     * ⚠️ **A SECOND RESET PATH EXISTS SINCE 2026-09-10 AND THIS ONE IS STILL NEEDED — `applyPresetChange` CLEARS
     * THE FLAGS ON A GENUINE PRESET SWITCH (owner's ruling), WHICH IS NOT THE SAME EVENT AS CLOSING THE LAB.**
     * Closing the Lab with the SAME preset still loaded reaches no apply path at all, so dropping these two calls
     * as "now redundant" would leave exactly the state the block above describes: a stripped preview and no
     * control anywhere able to restore it. **Two paths, two events; neither implies the other.**
     */
    this.controls.setBypassVisualFx(false);
    this.controls.setBypassMaterials(false);
    this.bypassToggles = [];
    this.bypassNoticeEl = null;
    this.setupGroup = null;
    // ⚠️ Back to "everything on", not left as it was: a disposed tab's mute would otherwise apply to whatever
    // figure is loaded when the tab is next built, silently emptying a level the user never switched off.
    this.muted = [false, false, false];
  }

  /**
   * Panel Reset. ⚠️ **REQUIRED, never optional** — `TabModule` says so, and `EvolutionTab`'s omission is why.
   * Here there is genuine state to restore: the model derives from the entry preset, and a row's BODY is either
   * the silent placeholder or the full set of inputs.
   *
   * ⚠️ **THE BODIES MUST BE REBUILT AND NOT ONLY THE VALUES, and with the tier gone (16.15) the surviving reason
   * is the SILENT PLACEHOLDER alone** — a row that was lit under the working figure and is silent in the entry
   * preset (or the reverse) needs a different body, and `sync()` writes into the inputs that exist. That is
   * `EvolutionTab`'s omission in a different costume: restoring the data and not the presentation.
   */
  reset(entryPreset: UnifiedPreset): void {
    // ⚠️ **A mute is restored too, and it belongs here rather than only on the external path** — 16.17's flag is
    // per-level presentation state over a specific figure, and `Reset` replaces the figure wholesale. See
    // `resetMutes()`: a mute that outlives its figure exports a level the user never switched off as cleared.
    this.resetMutes();
    this.model = readFigure(entryPreset);
    for (let w = 0; w < MAX_WAVES; w++) this.renderSlotBody(w);
    this.sync();
  }

  // -------------------------------------------------------------------------------------------------
  // Model plumbing
  // -------------------------------------------------------------------------------------------------

  /**
   * ⚠️ **READS `state.workingPreset`, NOT the engine, and the two are different objects.** The Lab edits
   * `workingPreset`; `main.ts` holds its own `preset`. They converge on an apply. Reading the engine's copy
   * here would show the last APPLIED figure rather than the one being composed, so a Randomiser mutation the
   * user has not yet applied would be invisible.
   */
  private rebuildModel(): void {
    const p = this.state?.workingPreset;
    this.model = p ? readFigure(p) : null;
  }

  /**
   * Push the model into the working preset AND the engine.
   *
   * ⚠️ **BOTH, and for two different reasons — writing one is invariant 13 in one direction or the other.**
   * `writeFigure` into `workingPreset` is what Export, the Mixer and a snapshot read; `controls.setWaves` is
   * what this frame draws. Preset-only means every control is inert until the next apply; engine-only means
   * every edit vanishes on Export.
   *
   * ⚠️ **AND IT DOES *NOT* GO THROUGH `state.setWorkingPreset()`, WHICH IS THE OPPOSITE OF WHAT EVERY OTHER
   * EDITING TAB DOES — the reason is the one thing the phase plan says twice.** That call emits
   * `preset-changed`, which `panel.ts` forwards to `main.ts`'s `onPresetChanged` → `applyPresetChange` →
   * `initGenerator()`. `initGenerator` resets `pos` and re-reads `angle`, so routing a Composer edit through it
   * would **snap the figure back to its opening pose on every stepper click** — and worse, it reallocates
   * buffers, recompiles programs and resets the PerfGuard window, all for one changed number. `setWaves()`
   * exists precisely so this path does not need it.
   *
   * ⚠️ **The consequence, stated because it is a real limitation and not an oversight: an edit here does not
   * push a history entry and does not re-baseline the other tabs.** `workingPreset` is mutated in place, so
   * Export, Snapshot and a later tab switch all see the edit — but `SlidersTab`'s baseline is captured on
   * `preset-changed` and therefore keeps the pre-edit figure until something else emits. That is the correct
   * trade against re-initialising the generator on every keystroke, and it is why the self-echo guard every
   * other tab needs is ABSENT here: this tab emits nothing to echo.
   */
  private commit(_label: string): void {
    const p = this.state?.workingPreset;
    if (!p || !this.model) return;
    this.refreshDerived();
    this.growSlotCountForAuthoredContent();
    /*
     * ⚠️ **THE MUTE IS APPLIED HERE AND NOWHERE ELSE (v8 16.17 / E108) — ONE PROJECTION, ON THE ONE PATH.** Every
     * consumer downstream of this line reads the MUTED figure: `writeFigure` puts it in `workingPreset` (so Export,
     * Snapshot and the Mixer see it), `setWaves` puts it in the engine (so the live preview does), and `sync()` ends
     * in `drawScoreNow()`, which reads `workingPreset` (so all twelve diagram panes do). **That is why Export,
     * Snapshot and the Mixer need no change at all and cannot disagree with the screen** — three owners of one
     * truth is how invariant 17 happened.
     *
     * ⚠️ **`applyMutes` IS PURE AND `this.model` KEEPS THE AUTHORED NUMBERS, WHICH IS THE ENTIRE DIFFERENCE
     * BETWEEN A MUTE AND A `Clear`.** Mutating the model here — the shorter-looking version — would make the two
     * controls identical and lose the data the checkbox promises to give back. The inputs are synced from
     * `this.model` below, so a muted row still shows what it holds.
     *
     * ⚠️ **`growSlotCountForAuthoredContent()` RUNS ON THE UNMUTED MODEL, DELIBERATELY.** The count follows what
     * the user has AUTHORED, never what is currently audible, so a muted trailing level writes zeros IN PLACE and
     * un-muting it restores a byte-identical figure. Growing from the projection would shrink on mute and grow on
     * un-mute, and anything that read the short version in between would hold a figure with a slot MISSING rather
     * than emptied — the silent rewrite `growSlotCountForAuthoredContent`'s one-way rule exists to prevent.
     */
    writeFigure(p, applyMutes(this.model, this.muted));
    this.controls.setWaves(p.generators.waves);
    this.sync();
  }

  /**
   * Give a silent Structure/Detail slot enough size to be seen, after a `Stack` has given it a winding.
   *
   * ⚠️ **THE FRACTION IS NOT COSMETIC: a stack whose three waves are the SAME SIZE reads as noise, not as
   * structure.** The library's own convention is a decaying series — the Body carries the figure and the later
   * slots add a fringe — so a stacked slot arrives at a fraction of the Body's size per axis. Equal sizes at
   * windings 1 : 32 : 100 sum three full-amplitude curves of wildly different frequency, which is a blur.
   *
   * ⚠️ **IT TOUCHES ONLY SLOTS THAT ARE SILENT, so it can never resize a wave the preset authored.** A stack
   * applied to a fully-lit library preset therefore behaves exactly as `applyStack` alone: windings change,
   * nothing else does. The size is only ever *granted*, never adjusted.
   */
  private giveStackedSlotsSize(): void {
    if (!this.model) return;
    const body = this.model.slots[0]!;
    const FRINGE = [1, 0.45, 0.2];
    for (let w = 1; w < MAX_WAVES; w++) {
      const slot = this.model.slots[w]!;
      if (!slot.silent) continue;
      for (let a = 0; a < AXES; a++) {
        const cell = slot.axes[a]!;
        // ⚠️ Per axis from the BODY's own axis, so a Z the seed left at zero stays at zero — a stack must not
        // turn a deliberately flat 2D figure into a 3D one behind the user's back.
        cell.size = Math.round(Math.abs(body.axes[a]!.size) * FRINGE[w]!);
        cell.silent = cell.size + cell.pulse === 0;
      }
      slot.silent = slot.axes.every(c => c.silent);
      // The row's controls change from the silent placeholder to real inputs, so the body must be rebuilt.
      this.renderSlotBody(w);
    }
  }

  /**
   * Raise `slotCount` to cover any slot the user has actually authored content into.
   *
   * ⚠️ **THIS IS THE PAD-GUARD'S ONE BLIND SPOT AND IT IS A REAL DEFECT, FOUND BY TRACING `New Figure` RATHER
   * THAN BY ANY CHECKER.** `writeFigure` deliberately emits only `slotCount` slots, so a preset that authored
   * one wave gets one back — that is the rule protecting 100-plus short presets from being normalised to three.
   * But the tab always shows **three editable rows**, so on a one-slot preset (which `New Figure` creates) a
   * user can type a full Structure wave into row 2 and `writeFigure` would **silently discard it**: the
   * controls accept the edit, the model holds it, the Score even draws it, and the preset never receives it.
   * The figure would then be right until the next reload and wrong after it.
   *
   * ⚠️ **THE FIX IS ONE-WAY, AND THAT ASYMMETRY IS THE WHOLE POINT.** `slotCount` grows to include any
   * non-silent slot and **never shrinks** — silencing row 3 must not delete a slot the preset authored, because
   * a silent-but-present slot is a real authored state (**343 of the library's 1197 slots**, re-measured; the
   * `651` once quoted here counts silent AXES in the legacy JSON alone) and dropping it
   * would be a different silent rewrite in the opposite direction. So: growing preserves an edit, shrinking
   * would destroy authored data. Only one of those is safe to do automatically.
   */
  private growSlotCountForAuthoredContent(): void {
    if (!this.model) return;
    for (let w = MAX_WAVES - 1; w >= 0; w--) {
      if (!this.model.slots[w]!.silent) {
        this.model.slotCount = Math.max(this.model.slotCount, w + 1);
        return;
      }
    }
  }

  /**
   * Recompute every slot's ROW-LEVEL derived readouts from its current cells.
   *
   * ⚠️ **THIS WAS `refreshTiers` AND IT WAS NEVER ONLY ABOUT THE TIER — 16.15 DELETED THE TIER AND THE METHOD HAD
   * TO SURVIVE, WHICH IS THE ONE TRAP IN THAT DELETION.** Deleting it wholesale with its name would have dropped
   * `slot.silent`, whose recomputation is what makes a level that has just been zeroed render as
   * `empty — nothing authored here` rather than as a row of live inputs over a dead wave — and `commit()` calls this BEFORE
   * `writeFigure`, so a stale `silent` would also reach `growSlotCountForAuthoredContent`. **Read a
   * `noUnusedLocals`-driven deletion as a claim about the design: the name went, the work did not.**
   *
   * ⚠️ **The per-AXIS readouts (`closes`, `effectivePhase`, per-axis `silent`) are NOT recomputed here** — each
   * write site owns them, because a row edit knows exactly which axis it touched. This method owns only what
   * spans the three axes of a slot.
   */
  private refreshDerived(): void {
    if (!this.model) return;
    for (let w = 0; w < MAX_WAVES; w++) {
      const slot = this.model.slots[w]!;
      slot.silent = slot.axes.every(c => c.silent);
      /*
       * ⚠️ **A SILENT LEVEL CANNOT BE MUTED, AND NORMALISING IT HERE IS WHAT KEEPS THE CHECKBOX HONEST (16.17).**
       * The two states have the same picture, so a mute over an empty level is invisible — until the user ticks
       * the box expecting the numbers back and gets an empty row, or until the row's own checkbox reads *off*
       * while the row reads *empty*, which are two different explanations for one picture. `Clear` on a muted
       * level is exactly that path (`Size` then `Pulse` reaches it in two clicks), so this is reachable rather
       * than defensive.
       *
       * ⚠️ **IT IS THE MUTE THAT YIELDS AND NOT THE DATA — the direction matters.** Clearing the flag loses a
       * boolean the user can re-set with one click; the alternative would be to un-silence the row, which would
       * invent numbers. And it must live HERE, in the method `commit()` calls FIRST, so `applyMutes` below can
       * never see a mute over an empty level.
       */
      if (slot.silent) this.muted[w] = false;
    }
  }

  // -------------------------------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------------------------------

  private render(): void {
    const el = this.container!;
    el.innerHTML = '';
    this.cells = [];
    // ⚠️ Every per-row registry must be cleared with the DOM that owns it, or `sync()` writes into detached
    // nodes for the rest of the session — a leak that shows as a control that has simply stopped responding.
    this.dials = [];
    this.breatheCells = [];
    this.ratioBoxes = [];
    this.panes = [];
    // ⚠️ **CLEARED HERE AND NOWHERE ELSE (16.17), WHICH IS THE EXACT OPPOSITE OF THE OTHER FIVE.** The level
    // checkboxes live on the slot HEAD, which only `render()` rebuilds — so this is the one registry that must be
    // cleared here and must NOT be filtered in `renderSlotBody`, where the entry would be dropped and the
    // checkbox would never update again. **The asymmetry is the reason both halves are commented.**
    this.levelToggles = [];
    // ⚠️ **v8 16.19's framing controls live in a section `render()` rebuilds, so a reference kept across a rebuild
    // would have `sync()` writing value labels nobody can see while the visible sliders never update again** — the
    // same failure as the six registries above, and it grew from one entry to seven without changing shape.
    this.framingSliders = [];
    this.framingChecks = [];
    this.symmetryMirrorRow = null;
    // ⚠️ **v8 16.18: cleared here for the same reason, and the ENGINE FLAGS ARE NOT TOUCHED** — a rebuild of the
    // DOM is not a statement about the bypass, and clearing the flags here would have a preset change silently
    // re-apply the full look while the box the user ticked came back ticked.
    this.bypassToggles = [];
    this.setupGroup = null;

    const desc = document.createElement('p');
    desc.className = 'sl-tab-desc';
    /*
     * ⚠️ TWO sentences, and that is a `tipcheck` §I ceiling rather than a style preference: inline copy is
     * capped because tooltips are ADDITIVE, so a regrown orientation paragraph passes every other section.
     *
     * ⚠️ **SHORTENED 2026-09-10 ON THE OWNER'S WORD** (*"keep static explanatory text minimal to save space,
     * instead apply tooltips"*) — the definitions of *winding* and *size* it used to spell out are now reachable
     * from the rows that carry those words (`composer.winding`, `composer.size`), so the line keeps only the
     * thing no single control can say: what this tab is FOR, and that the hover text is where the rest lives.
     * ⚠️ **The three GATED notices below are NOT covered by this trim and must not be shortened into tooltips
     * (invariant 25)** — a precondition is discovered only by someone who already suspects the control, and each
     * of those three describes a state in which the controls are lying.
     */
    desc.textContent = 'The figure itself — the three stacked sine waves every preset is built from, which '
      + 'everything else in the Lab decorates. Hover any header or control for what it does.';
    el.appendChild(desc);

    /*
     * ⚠️ **REGION D's PRECONDITION, INLINE AND NOT A TOOLTIP — invariant 25, and this is its textbook case.**
     * At `attractor.blend = 1.0` the wave positions are REPLACED OUTRIGHT, so every control below does
     * nothing visible while **no individual control is wrong.** A per-row note therefore cannot own it, and a
     * tooltip is worse than useless: a tooltip is only discovered by someone who already suspects the
     * control, and here the whole tab is inert. It must be stated where the eye lands before the first edit.
     */
    this.preconditionEl = document.createElement('p');
    this.preconditionEl.className = 'sl-composer-precondition';
    // ⚠️ **The TEXT is set once and only `display` is toggled — deliberately, so `tipcheck` §I can SEE it.**
    // Its inline-copy scan matches a string literal directly after `.textContent =`; assigning through a
    // ternary (`= inert ? '…' : ''`) type-checks, renders identically, and is INVISIBLE to the scan — the
    // "anchor that matched nothing" shape, where the ceiling would silently stop applying to the one piece of
    // copy in this file that most needs it.
    this.preconditionEl.textContent = 'Attractor blend is 1.0, so the attractor replaces these wave '
      + 'positions outright and nothing here changes the picture. Lower Blend in Visual FX to compose the '
      + 'figure.';
    el.appendChild(this.preconditionEl);

    /*
     * ---- v8 16.17 (E108) — what a switched-off level COSTS, inline and gated ----
     *
     * ⚠️ **INLINE BECAUSE THE COST IS NOT SOMETHING THE CONTROL'S APPEARANCE SUGGESTS (invariant 25).** A
     * checkbox reads as reversible, and this one is — until the figure is replaced, at which point the level is
     * gone for good, because the mute lives in tab state and `commit()` has been writing zeros into the preset the
     * whole time. **The owner asked for exactly that behaviour**, so the remedy is to say it, not to change it.
     * A tooltip cannot own it: a tooltip is found by someone who already suspects the control, and the person who
     * needs this sentence is the one who thinks nothing is at stake.
     *
     * ⚠️ **GATED ON A MUTE ACTUALLY BEING ON, and that is not tidiness — invariant 25's own remedy turned on
     * itself.** A permanent warning describes a state that is not happening; worse, it would be the tab's only
     * always-visible alarm and would train the reader to ignore the one that matters.
     *
     * ⚠️ **ABOVE THE SCORE AND NOT ON THE SLOT ROW, because a mute changes the FIGURE and every diagram below
     * draws the muted one.** A note on the row would say it about that level; the surprising part is that the
     * three panes at the top of the tab, the live preview, Export, Snapshot and the Mixer all agree with it.
     *
     * ⚠️ **ONE STRING LITERAL, SET ONCE, `display` TOGGLED — same rule as the precondition above and for the same
     * mechanical reason:** `tipcheck` §I's inline-copy scan matches a literal directly after `.textContent =`, so
     * a ternary assignment renders identically and is invisible to the ceiling that caps this copy.
     */
    this.muteNoticeEl = document.createElement('p');
    this.muteNoticeEl.className = 'sl-composer-mute-notice';
    /*
     * ⚠️ **`stay in the inputs` WAS CORRECTED TO `are kept` BY `31.C`, AND THE OLD CLAUSE IS THE SHAPE WORTH
     * NAMING: it was TRUE about the model and FALSE about the screen the moment the gate hid the inputs.** A
     * sentence that names the surface a value lives on is a sentence a layout change can falsify, so it now
     * names the GUARANTEE (the values are kept) and not the widget that happens to be holding them.
     */
    this.muteNoticeEl.textContent = 'A level is switched off, so it counts as empty in every diagram below and '
      + 'in the preview, and Export, Snapshot and the Mixer write it cleared. Its numbers are kept and come '
      + 'back when you switch it on, but only until this figure is replaced.';
    el.appendChild(this.muteNoticeEl);

    /*
     * ---- v8 `31.C` — **THE SCORE FIRST, THE SETTINGS LAST** (owner, 2026-10-25) ----
     *
     * ⚠️ **THE SCORE IS THE TAB'S SUBJECT AND IT USED TO BE THIRD OF FOUR, below seven sliders that only
     * DECORATE the figure and two switches that change nothing but the preview.** The three slot rows that
     * follow it then read as *how it is made*, which is the order the tab is actually used in.
     *
     * ⚠️ **`buildHeaderActions()` TRAVELS WITH IT AND THAT IS NOT COSMETIC: `New Figure` and `Stack` act on
     * the WHOLE figure**, which is what the Score shows and what the owner's second report about this tab was
     * about (*"I still could not tell what a control was scoped to"*). A figure-wide action beside the
     * figure-wide picture is the only placement that says so.
     *
     * ⚠️ **THE TWO GATED NOTICES STAY ABOVE EVERYTHING, which is a REQUIREMENT and not a leftover.** The
     * precondition (invariant 25) must be read before the first edit, and the mute notice is above the Score
     * *because a mute changes the figure every diagram below then draws*. They are appended earlier, so
     * reordering here cannot move them - but a future reorder that puts the Score above them breaks both.
     *
     * ⚠️ **TWO SECTIONS, ONE COLLAPSIBLE (owner).** 16.19's split into two sections was forced by the
     * HEADING - *"preview only - not saved"* was false about the seven controls that had become saved - and
     * that split is intact: both titles are inside this group, unchanged. What merged is the COLLAPSE, not
     * the sections. Closed by default: `Framing & Timing` duplicates Visual FX's own section, and this copy
     * does not follow a Visual FX drag (`setSpeedFactor` does not notify), so it is the copy to keep shut.
     */
    el.appendChild(this.buildScoreSection());
    el.appendChild(this.buildHeaderActions());

    const setup = makeCollapsible({
      text: 'Framing & Preview',
      tip: TAB_TIPS['composer.setup']!,
      countPhrase: (n) => (n === 0
        ? 'both applied - the preview matches the preset'
        : `${n} of 2 switched off - the preview is not showing the preset`),
    });
    setup.body.appendChild(this.buildFramingSection());
    setup.body.appendChild(this.buildPreviewSection());
    el.appendChild(setup.wrap);
    this.setupGroup = setup;

    for (let w = 0; w < MAX_WAVES; w++) el.appendChild(this.buildSlotSection(w));

    // ⚠️ **NO FOOTER: THE `Figure-wide` SECTION WAS DELETED WITH ITS ONE ROW (owner, 2026-09-10).** The slot
    // sections are now the last thing on the tab. See the block where `buildFooter()` used to be defined for why
    // `waveSpeed` survives as data with no control.
    // ⚠️ The bodies are filled AFTER the sections are in the document, because `renderSlotBody` finds its
    // target with `container.querySelector` — filling them before the append would find nothing and produce
    // three empty rows with no error anywhere.
    for (let w = 0; w < MAX_WAVES; w++) this.renderSlotBody(w);
    this.sync();
  }

  // -------------------------------------------------------------------------------------------------
  // Framing & Timing — the repeat of Visual FX's first section (2026-09-10)
  // -------------------------------------------------------------------------------------------------

  /*
   * ⚠️ **THREE ROW FACTORIES, AND THEY ARE HERE RATHER THAN IMPORTED BECAUSE `slider()`, `check()` AND
   * `tripletRow()` ARE PRIVATE MEMBERS OF `VisualFxTab` BOUND TO ITS `controlList`.** Exporting one would export
   * a factory that registers into another tab's sync machinery — a second writer of somebody else's registry.
   * What IS shared is every number: the tracks, the steps and the formatters are imported at the top of this
   * file and **nothing below re-derives one.** A differently-shaped `<div>` is visible; a drifted curve is not.
   *
   * ⚠️ **THE `tip` IS A PARAMETER AND ITS `TAB_TIPS['…']` SUBSCRIPT STAYS A LITERAL AT EACH CALL SITE** —
   * `tipcheck` §H reads literal subscripts only, so a key threaded through a variable reports as a non-literal
   * read AND as an entry no tab reads: two failures from one convenience, which is how E109's first version
   * failed. The label text is a literal at its own site for the same reason (§N's DOM-word rule).
   */

  /**
   * One `sl-vfx-row` holding a range input and its readout, registered for `sync()`.
   *
   * ⚠️ **`toPos`/`fromPos` DEFAULT TO IDENTITY, AND SINCE 2026-09-10 NO CALLER USES THE DEFAULT** — `Symmetry`,
   * the 1–12 integer row whose value simply IS its position, was the one control that needed it and the owner
   * removed it from this tab. The default is kept rather than made required: it is the correct answer for any
   * unmapped control and removing it would make the next one invent a pair of identity lambdas. **The three live
   * callers all pass a real track, so a defect in this branch is now invisible here** — Visual FX's own
   * `slider()` still has an unmapped consumer and remains where that arithmetic is exercised.
   */
  private framingRow(label: string, tip: string, spec: {
    min: number; max: number; step: number;
    get: () => number; set: (v: number) => void;
    toPos?: (v: number) => number; fromPos?: (p: number) => number;
    fmt: (v: number) => string;
    wideLabel?: boolean; settleOnRelease?: boolean;
  }): HTMLElement {
    const toPos = spec.toPos ?? ((v: number) => v);
    const fromPos = spec.fromPos ?? ((p: number) => p);

    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    const lab = document.createElement('span');
    lab.className = 'sl-vfx-label';
    lab.textContent = label;
    row.appendChild(lab);

    const wrap = document.createElement('div');
    wrap.className = 'sl-vfx-slider-wrap';
    const input = document.createElement('input');
    input.type = 'range';
    /*
     * ⚠️ **THE RANGE IS THE POSITION RANGE AND THE TRACK OWNS THE MAPPING** — `min`/`max` here are 0..1 for every
     * mapped control (and 1..12 for the one unmapped one). Writing a VALUE range onto a mapped element instead
     * would put a linear track under a curved readout, which looks right at both ends and is wrong everywhere
     * between them.
     */
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(toPos(spec.get()));
    input.className = 'sl-vfx-slider';
    input.title = tip;
    // Also on the wrapper and the row, so the hover target is the whole cell rather than the handle track —
    // Visual FX's `slider()` titles the wrap and `makeRow` lifts it onto the row; both are set by hand here.
    wrap.title = tip;
    row.title = tip;

    const valueLabel = document.createElement('span');
    valueLabel.className = spec.wideLabel ? 'sl-vfx-value sl-vfx-value--wide' : 'sl-vfx-value';
    valueLabel.textContent = spec.fmt(spec.get());

    input.addEventListener('input', () => {
      const v = fromPos(parseFloat(input.value));
      valueLabel.textContent = spec.fmt(v);
      spec.set(v);
    });
    if (spec.settleOnRelease) {
      /*
       * ⚠️ **THE SETTLE-ON-RELEASE READ-BACK GUARD, COPIED FROM `slider()`'s OWN BRANCH — and the read-back is
       * the part that is not obvious.** `change` is the RELEASE event on a range input, so the handle is
       * repositioned onto the canonical position for the value it produced, quantising away the drift a curved
       * track accumulates. But the element SANITISES an assigned value onto its own `min + k*step` grid, so the
       * string that goes in is not necessarily the one that comes out: if the sanitised position no longer maps
       * back to `v`, the reposition would silently CHANGE THE VALUE on release. Restore and leave the handle be.
       */
      input.addEventListener('change', () => {
        const v = fromPos(parseFloat(input.value));
        const canon = String(toPos(v));
        const before = input.value;
        input.value = canon;
        if (fromPos(parseFloat(input.value)) !== v) input.value = before;
      });
    }

    wrap.appendChild(input);
    wrap.appendChild(valueLabel);
    row.appendChild(wrap);
    this.framingSliders.push({ input, label: valueLabel, get: spec.get, toPos, fmt: spec.fmt });
    return row;
  }

  /**
   * Three captioned sliders on one row — Rotation X / Y / Z.
   *
   * ⚠️ **EACH HANDLE WRITES ONLY ITS OWN AXIS, which is the property `tripletRow`'s own header exists for:**
   * `setRotationSpeed(axis, v)` reads the live triple, replaces one member and writes it back, so a handle that
   * sent all three would silently re-assert two stale values against the generator's clamp.
   */
  private framingTripletRow(label: string, tip: string, spec: {
    min: number; max: number; step: number;
    get: () => readonly [number, number, number];
    set: (axis: 0 | 1 | 2, v: number) => void;
    toPos: (v: number) => number; fromPos: (p: number) => number;
    fmt: (v: number) => string;
  }): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    row.title = tip;
    const lab = document.createElement('span');
    lab.className = 'sl-vfx-label';
    lab.textContent = label;
    row.appendChild(lab);

    const trip = document.createElement('div');
    trip.className = 'sl-vfx-triplet';
    for (let a = 0; a < 3; a++) {
      const axis = a as 0 | 1 | 2;
      const cell = document.createElement('div');
      cell.className = 'sl-vfx-triplet-cell';

      const cap = document.createElement('span');
      cap.className = 'sl-vfx-triplet-caption';
      cap.textContent = AXIS_LABELS[axis]!;
      cell.appendChild(cap);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.className = 'sl-vfx-slider';
      input.title = tip;
      // ⚠️ **The per-axis label is what `aria-label` names, because the ROW label says only "Rotation" and the
      // three handles are otherwise indistinguishable to anything selecting by accessible name.** The specs
      // select on labels rather than position, so an unnamed axis is an unreachable control for the harness.
      input.setAttribute('aria-label', `${label} ${AXIS_LABELS[axis]}`);
      input.value = String(spec.toPos(spec.get()[axis]!));
      cell.appendChild(input);

      const valueLabel = document.createElement('span');
      valueLabel.className = 'sl-vfx-triplet-value';
      valueLabel.textContent = spec.fmt(spec.get()[axis]!);
      cell.appendChild(valueLabel);

      input.addEventListener('input', () => {
        const v = spec.fromPos(parseFloat(input.value));
        valueLabel.textContent = spec.fmt(v);
        spec.set(axis, v);
      });
      // ⚠️ **`get()[axis]` AND NOT A CAPTURED SCALAR** — the registry entry must re-read the live triple on every
      // sync, or a rotation set from Visual FX or by a preset load would leave this handle showing the value it
      // had when the row was built. The closure is the enumeration; the number is not.
      this.framingSliders.push({
        input, label: valueLabel,
        get: () => spec.get()[axis]!, toPos: spec.toPos, fmt: spec.fmt,
      });
      trip.appendChild(cell);
    }
    row.appendChild(trip);
    return row;
  }

  /** One `sl-vfx-row` holding a checkbox, registered for `sync()`. Painted from the value it names. */
  private framingCheckRow(label: string, tip: string, spec: {
    get: () => boolean; set: (v: boolean) => void;
  }): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-vfx-row';
    row.title = tip;
    const lab = document.createElement('span');
    lab.className = 'sl-vfx-label';
    lab.textContent = label;
    row.appendChild(lab);

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'sl-vfx-check';
    box.title = tip;
    box.setAttribute('aria-label', label);
    box.checked = spec.get();
    box.addEventListener('change', () => { spec.set(box.checked); this.sync(); });
    row.appendChild(box);
    this.framingChecks.push({ input: box, get: spec.get });
    return row;
  }

  /**
   * v8 16.19 (E110), rebuilt 2026-09-10 — the whole of Visual FX's `Framing & Timing`, repeated here.
   *
   * ⚠️ **THE OWNER ASKED FOR THE FULL SECTION AND FOR IT TO WRITE THE PRESET** (*"you can change from preview
   * only mode for those controls to the same mode like in Visual Fx with actually saving the values in the
   * preset"*), which RETIRED the *"Preview only"* heading E110 shipped under. These controls are now ordinary
   * SAVED controls: `figureScale` and `speedFactor` reach the export through `getSnapshot()`'s `overlay`,
   * `rotationSpeed` and `particleCount` through `preset.generators`, and `symmetryMirror` through its own
   * identity-gated overlay key. **Nothing here is Composer state** — every value has Visual FX's control as its
   * other surface, which is why `dispose()` leaves them all alone.
   *
   * ⚠️ **SIX CONTROLS, NOT SEVEN, SINCE 2026-09-10 — AND THE COUNT IS WRITTEN HERE BECAUSE IT IS QUOTED IN FOUR
   * OTHER PLACES.** The owner removed `Symmetry` (*"this one is not needed on the Composer tab"*), so the section
   * is now Figure Scale, Speed, Particle Number, Rotation X/Y/Z and Mirror: **five rows and seven inputs** — plus
   * `Mirror`, which is a sixth row only where the preset's fold is above 1. **Re-derive the figure from the calls
   * below; never carry one forward from a comment.**
   *
   * ⚠️ **NOT ONE SETTER NOTIFIES — MEASURED, and the limit is STATED rather than fixed.** A drag on Visual FX's
   * Figure Scale, Speed, Particle Number, Rotation or Mirror will NOT move the matching handle here until
   * something else emits (a preset load, a Mixer move, a material switch). E110 recorded that for Speed alone;
   * it generalises unchanged to all of them, and the remedy is the same one that was rejected then — a notify per
   * drag frame is a full resync of every subscriber inside the drag loop. **Do not add one.** The reverse
   * direction is fine: these call the same setters, so Visual FX resyncs whenever IT is next opened.
   * ⚠️ **AND IT NOW HAS A VISIBLE CONSEQUENCE IT DID NOT HAVE BEFORE:** a fold raised on Visual FX does not
   * reveal `Mirror` here until something emits, because `syncFramingVisibility()` runs from `sync()` and the row
   * that used to call it mid-drag is gone.
   *
   * ⚠️ **IT SITS ABOVE THE SHAPE DIAGRAM ON THE OWNER'S WORD** (*"at the top level (before SHAPE Diagram)"*) and
   * BELOW both notices, so the two gated alarms stay the first thing the eye lands on.
   */
  private buildFramingSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    // ⚠️ **THE SAME TEXT AS VISUAL FX'S OWN HEADER, DELIBERATELY** — two surfaces for one group of settings, so a
    // second name for it would read as a second group. ⚠️ `HEADER_TIPS` is NOT the table to reach for here:
    // `tipcheck` §D asserts every `HEADER_TIPS` entry matches a `sectionTitle()` literal **in `visual-fx.ts`**,
    // so a Composer header resolves its tooltip from `TAB_TIPS` like every other hand-wired control on this tab.
    title.textContent = 'Framing & Timing';
    title.title = TAB_TIPS['composer.framing']!;
    sec.appendChild(title);

    // Figure Scale — the log track `figureScaleToPos`/`sliderMul` own, shared with the Sliders tab.
    sec.appendChild(this.framingRow('Figure Scale', TAB_TIPS['composer.figureScale']!, {
      min: 0, max: 1, step: 0.005,
      get: () => this.controls.getFigureScale(),
      set: v => this.controls.setFigureScale(v),
      toPos: figureScaleToPos, fromPos: sliderMul, fmt: fmtFigureScale,
    }));

    /*
     * ---- Speed (E110's original row, unchanged in arithmetic) ----
     *
     * ⚠️ **THIS IS `speedFactor`, THE ENGINE-WIDE MULTIPLIER — NOT `generators.waveSpeed` AND NOT
     * `WaveConfig.speed`. THREE NAMES, ONE OF WHICH IS READ BY NOTHING.**
     *
     * ⚠️ **AND SINCE 2026-09-10 THIS IS THE TAB'S ONLY SPEED CONTROL: the footer's `Sweep rate` row (`waveSpeed`)
     * WAS DELETED AT THE OWNER'S REQUEST, BECAUSE THE TWO MULTIPLY THE SAME ADVANCE** — `main.ts` scales `dt` by
     * `speedFactor` and `lissajous.ts` then adds `waveSpeed` per corrected frame, so the visible rate was the
     * PRODUCT of two controls two sections apart. The `waveSpeed` row also RESET THE POSE (baked at `init()`, no
     * in-place setter, so `setWaveSpeed` re-inits the generator and zeroes `pos`) while this one does not, which
     * made the pair actively misleading rather than merely redundant. **Do not re-add a `waveSpeed` row here to
     * "complete" the section, and do not describe this slider by contrast with a control that no longer exists.**
     */
    sec.appendChild(this.framingRow('Speed', TAB_TIPS['composer.speed']!, {
      min: 0, max: 1, step: SPEED_STEP,
      get: () => this.controls.getSpeedFactor(),
      set: v => this.controls.setSpeedFactor(v),
      toPos: SPEED_TRACK.toPos, fromPos: SPEED_TRACK.fromPos, fmt: fmtSpeed,
      settleOnRelease: true,
    }));

    // Particle Number — the cubic track with the snap-to-100 that `PARTICLE_STEP` was measured against.
    // `wideLabel` because the readout reaches six characters ("50,000") and a growing label steals track width.
    sec.appendChild(this.framingRow('Particle Number', TAB_TIPS['composer.particleCount']!, {
      min: 0, max: 1, step: PARTICLE_STEP,
      get: () => this.controls.getParticleCount(),
      set: v => this.controls.setParticleCount(v),
      toPos: particleCountToPos, fromPos: posToParticleCount, fmt: fmtParticleCount,
      wideLabel: true, settleOnRelease: true,
    }));

    // Rotation X/Y/Z — the signed quartic track in `core/rotation-track.ts`, which owns every number about it.
    // ⚠️ The readout is NOMINAL rpm: `Speed` above multiplies the actual rate, and the tooltip says so.
    sec.appendChild(this.framingTripletRow('Rotation', TAB_TIPS['composer.rotation']!, {
      min: -1, max: 1, step: ROT_STEP,
      get: () => this.controls.getRotationSpeed(),
      set: (axis, v) => this.controls.setRotationSpeed(axis, v),
      toPos: rotationToPos, fromPos: posToRotation, fmt: fmtRotationRpm,
    }));

    /*
     * ---- 2026-09-10 — `Symmetry` IS GONE FROM THIS TAB, AND `Mirror` IS NOT ----
     *
     * ⚠️ **THE OWNER REMOVED EXACTLY ONE ROW** (*"remove the Symmetry control, this one is not needed on the
     * Composer tab, the rest works as expected"*) — the 1–12 fold slider, which sat here between Rotation and
     * Mirror. **It is a DELETION, not a hide:** the value is Visual FX's and unchanged, every preset keeps its
     * authored fold, and `overlay.symmetryFold` still round-trips through Export, Snapshot and the Mixer.
     *
     * ⚠️ **`Mirror` STAYS AND THAT IS THE LITERAL READING OF THE REQUEST, WITH ONE CONSEQUENCE WORTH STATING:
     * its row's PRESENCE is derived from a fold this tab can no longer change.** It is hidden at fold 1, which is
     * nearly the whole library, so on most presets the section now ends at Rotation — and where a preset does
     * carry a fold above 1 the checkbox appears and works. `syncFramingVisibility()` therefore still has to run,
     * and now runs ONLY from `sync()`: the one caller that could change the fold mid-drag is the row above,
     * gone. **Do not delete the visibility call along with the slider** — an external fold change (a preset load,
     * a Mixer move, a Visual FX drag followed by anything that emits) is exactly what it exists for.
     */
    this.symmetryMirrorRow = this.framingCheckRow('Mirror', TAB_TIPS['composer.symmetryMirror']!, {
      get: () => this.controls.getSymmetryMirror(),
      set: v => this.controls.setSymmetryMirror(v),
    });
    sec.appendChild(this.symmetryMirrorRow);

    return sec;
  }

  /**
   * v8 16.19 (E110) — *"What you are looking at"*: the two switches that change only the LIVE PREVIEW.
   *
   * ⚠️ **THIS SECTION IS WHAT IS LEFT OF E110's `Preview only` GROUP AFTER THE FRAMING CONTROLS BECAME SAVED
   * (2026-09-10), AND THE SPLIT WAS FORCED BY THE HEADING RATHER THAN CHOSEN FOR LAYOUT.** *"Preview only — not
   * saved with the figure"* was a true statement about one slider and is a FALSE statement about the seven
   * controls that now sit above; leaving them under it would have made the tab's one explicit persistence claim
   * the wrong one. The bypasses keep the claim because they keep the property: neither box writes
   * `workingPreset`, so Export, Snapshot and the Mixer are byte-identical whether they are on or off.
   *
   * ⚠️ **THE SECTION EXISTS SO THE READER CAN TELL WHAT A CONTROL IS SCOPED TO, WHICH IS THE CORRECTION THE
   * OWNER MADE TWICE ABOUT THIS TAB** — and with three checkbox families now on one tab (these two, the three
   * level switches, and `Mirror` directly above) the heading is doing more work than it was in E110, not less.
   */
  private buildPreviewSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    // ⚠️ **"not saved" is the load-bearing half of this label.** With 16.17's level checkbox on every slot head —
    // which DOES persist, and exports the level cleared — and `Mirror` in the section above, which also persists,
    // a family of checkboxes with the OPPOSITE semantics needs the difference stated where it can be read.
    title.textContent = 'Preview only — not saved with the figure';
    title.title = TAB_TIPS['composer.view']!;
    sec.appendChild(title);

    /*
     * ---- v8 16.18 (E109) — the two preview bypass switches, ONE ROW since 2026-09-10 ----
     *
     * ⚠️ **THE ENGINE OWNS BOTH FLAGS AND THE CHECKBOX IS ONLY A VIEW OF THEM (invariant 17).** The controls are
     * asked for their state on every `sync()` rather than the DOM being trusted, because a preset change
     * re-neutralises engine-side without any click — so a checkbox left to its own `checked` would be the only
     * surface disagreeing with the picture. **Same rule as 16.17's level checkbox, and it is the rule 16.17 got
     * WRONG first: "on" was painted from a derived expression, so the box arrived ticked over a row where the
     * click was the only way in and no `change` could ever fire.**
     *
     * ⚠️ **THE POLARITY IS NOW `Apply …`, TICKED BY DEFAULT — THE OWNER'S DECISION, WHICH REVERSES THE ONE E109
     * ARGUED FOR** (*"revert the meaning: change names to Apply Visual Fx and Apply Materials which are enabled
     * by default"*). E109's case for `Don't apply` was that an unticked default makes the abnormal state the
     * visible one; the cost the owner weighed against it is that a negated label makes every reading a double
     * negative. **The engine flag KEEPS ITS NAME AND ITS MEANING — `bypassVisualFx` is still a bypass — and the
     * inversion lives at the DOM boundary, one `!` painting and one `!` writing back.** Renaming the flags to
     * match the label would put two spellings of one boolean into the engine, which is invariant 17's shape;
     * inverting them would silently flip every default in `main.ts`, `getSnapshot()` and `resetOverlays()`.
     *
     * ⚠️ **ONE ROW FOR BOTH, ON THE OWNER'S WORD** (*"on the same row to save space"*), which is why the label is
     * per-BOX rather than the row's: `sl-vfx-label` is a fixed 56 px column and two controls cannot share it.
     * `.sl-composer-bypass-pair` owns the layout and `.sl-composer-bypass-cap` the two inline captions.
     */
    const bRow = document.createElement('div');
    bRow.className = 'sl-vfx-row sl-composer-bypass-row';
    const pair = document.createElement('div');
    pair.className = 'sl-composer-bypass-pair';

    /*
     * ⚠️ **THE TOOLTIP IS A LITERAL SUBSCRIPT AT ITS OWN SITE AND NOT A LOOP VARIABLE — `tipcheck` §H CAUGHT MY
     * FIRST VERSION, WHICH PASSED THE KEY THROUGH THE TUPLE.** `subscriptLiterals` reads `TAB_TIPS['…']` literals,
     * so `TAB_TIPS[key]` reported as a non-literal read AND both keys reported as read by no tab: three failures
     * from one convenience. And the checker's own message says why the convenience is not free — an unlisted or
     * mistyped key resolves to `undefined` and sets `title = "undefined"`, which nothing else in the project can
     * see. **This is `CLAUDE.md`'s rule from the other direction: a word reaching the DOM through a VARIABLE is
     * invisible to any text scan, so keep the KEY a literal at its own site exactly as the label text is.**
     */
    for (const [tip, label, get, set] of [
      [TAB_TIPS['composer.bypassFx']!, 'Apply Visual FX',
        () => this.controls.getBypassVisualFx(), (v: boolean) => this.controls.setBypassVisualFx(v)],
      [TAB_TIPS['composer.bypassMaterials']!, 'Apply Materials',
        () => this.controls.getBypassMaterials(), (v: boolean) => this.controls.setBypassMaterials(v)],
    ] as const) {
      const cell = document.createElement('label');
      cell.className = 'sl-composer-bypass-cell';
      cell.title = tip;
      const box = document.createElement('input');
      box.type = 'checkbox';
      // ⚠️ **`sl-composer-bypass-check` EXISTS SO THESE ARE NOT STYLED AS ONE GROUP WITH 16.17's LEVEL BOXES** —
      // the plan calls two checkbox families with opposite persistence semantics on one tab a real usability
      // hazard, and the class is where that separation is anchored rather than left to the section heading alone.
      box.className = 'sl-vfx-check sl-composer-bypass-check';
      box.title = tip;
      box.setAttribute('aria-label', label);
      // ⚠️ **THE ONE `!` THAT PAINTS, PAIRED WITH THE ONE `!` THAT WRITES BACK.** `get()` returns the BYPASS
      // flag; the box shows whether the bundle is APPLIED. Two negations, no third place to get it wrong.
      box.checked = !get();
      box.addEventListener('change', () => { set(!box.checked); this.sync(); });
      cell.appendChild(box);
      const cap = document.createElement('span');
      cap.className = 'sl-composer-bypass-cap';
      cap.textContent = label;
      cell.appendChild(cap);
      pair.appendChild(cell);
      this.bypassToggles.push({ input: box, get });
    }
    bRow.appendChild(pair);
    sec.appendChild(bRow);

    /*
     * ⚠️ **THE CONSEQUENCE NOTICE, INLINE AND GATED — invariant 25, and its subject is a SIDE EFFECT IN ANOTHER
     * TAB, which no per-control tooltip can own.** While a bundle is switched off the engine is running something
     * other than what Visual FX and Materials display, and an edit made on those tabs is overwritten by the
     * restore when the box is ticked again. That is a genuine data-loss path the checkbox's appearance cannot
     * suggest, and it is the one thing about this feature a user cannot discover by looking.
     *
     * ⚠️ **ONE STRING LITERAL, SET ONCE, ONLY `display` TOGGLED** — `tipcheck` §I's inline scan matches a literal
     * directly after `.textContent =`, so a ternary assignment renders identically and is invisible to the
     * ceiling that caps this copy. Same mechanical reason as the two notices above it.
     */
    this.bypassNoticeEl = document.createElement('p');
    this.bypassNoticeEl.className = 'sl-composer-bypass-notice';
    this.bypassNoticeEl.textContent = 'The preview is not showing what Visual FX and Materials say it is, but '
      + 'Export, Snapshot and the Mixer still write the full look. ⚠️ Anything you change on those two tabs '
      + 'while this is off is lost when you switch it back on.';
    sec.appendChild(this.bypassNoticeEl);

    return sec;
  }

  /**
   * `Mirror`'s row is hidden at fold 1 — the one framing control whose PRESENCE is derived.
   *
   * ⚠️ **IT HAS EXACTLY ONE CALLER SINCE 2026-09-10 (`sync()`), AND THE REASON IT IS STILL ITS OWN METHOD IS A
   * RETIRED ONE — SAID SO RATHER THAN INLINED.** It existed separately because the fold slider's `set` had to
   * reach it MID-DRAG, and `sync()` writes every handle it owns, so calling the whole sync from a drag handler
   * would fight the pointer on the slider being dragged. **That slider is gone** (the owner removed `Symmetry`
   * from this tab), so the mid-drag path no longer exists. Kept separate because the property it asserts is
   * `Mirror`'s alone and belongs where it can be named; **do not read the single caller as dead code** — the fold
   * still changes from outside this tab, and this is the only thing that answers it here.
   */
  private syncFramingVisibility(): void {
    if (this.symmetryMirrorRow) {
      this.symmetryMirrorRow.style.display = this.controls.getSymmetryFold() > 1 ? '' : 'none';
    }
  }

  private buildScoreSection(): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section';

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    /*
     * ⚠️ **THIS LABEL IS LOAD-BEARING INLINE COPY AND MUST NOT BE SHORTENED TO "Preview".** The Score is a
     * diagram in model space: no rotation, no canvas fit, no material, no trail, no grading, one frozen
     * instant. The live full-quality render already occupies half the screen whenever the Lab is open
     * (`index.html` + `layout.css`'s `1fr 1fr`), so a second small render would be strictly worse than what
     * the user is already looking at. Calling this a preview would make every deliberate omission read as a
     * defect — invariant 25 again, this time in a title.
     */
    title.textContent = 'Shape — diagram, no rotation or grading';
    title.title = TAB_TIPS['composer.score']!;
    sec.appendChild(title);

    sec.appendChild(this.buildTriple(null));

    /*
     * ⚠️ **ONE LEGEND FOR THE WHOLE TAB, AND ITS THREE WORDS ARE A CONTRACT WITH `OVERLAY_STYLES`.** The three
     * colours are named in exactly one place; a colour changed in `score-canvas.ts` without changing this line
     * produces a diagram that is confidently MISLABELLED, which is strictly worse than an ugly one. The legend
     * sits on the combined row and not on each slot row deliberately — repeating it four times is the "three
     * enumerations of one list" shape that makes a missing entry structurally invisible.
     */
    const legend = document.createElement('div');
    legend.className = 'sl-composer-legend';
    legend.title = TAB_TIPS['composer.legend']!;
    for (const [cls, text] of [
      ['now', 'now'], ['size', 'size extreme (Pulse)'], ['winding', 'winding extreme (Wobble)'],
    ] as const) {
      const key = document.createElement('span');
      key.className = `sl-composer-key sl-composer-key-${cls}`;
      key.textContent = text;
      legend.appendChild(key);
    }
    sec.appendChild(legend);

    const row = document.createElement('div');
    row.className = 'sl-composer-score-foot';

    /*
     * ⚠️ **THE EXTENT READOUT IS NOT DECORATION: IT IS THE ANSWER TO THE SCORE'S ONE BLIND SPOT.** The
     * diagram auto-fits its box, which is right — an authored size of 800 and one of 8 must both be visible —
     * but it means doubling every axis's size changes the diagram not at all. That is invariant 13's harder
     * form: the control moves exactly the right thing and the output channel cannot represent it. Printing
     * the measured half-extent in model units is the fix. **Do not "fix" it by fixing the scale.**
     */
    this.extentLabel = document.createElement('span');
    this.extentLabel.className = 'sl-composer-extent';
    this.extentLabel.title = TAB_TIPS['composer.extent']!;
    row.appendChild(this.extentLabel);

    sec.appendChild(row);
    return sec;
  }

  /**
   * v8 16.9 (E100) — one row of three captioned canvases, XY / XZ / YZ. `slot === null` is the combined figure.
   *
   * ⚠️ **`PLANES` AND `PLANE_LABELS` ARE THE ENUMERATION AND THE ROW WIDTH IS `PLANES.length` — do not hardcode
   * three, here or in the CSS.** The two lists live side by side in `score-canvas.ts` so an added plane cannot
   * ship unlabelled, and a caption is not decoration: with all three panes drawn at ONE shared extent, a
   * depth-only slot draws as a flat line in XY and a real curve in XZ, and the reader needs to know which is
   * which to read that as the honest picture rather than as a broken pane.
   *
   * ⚠️ **THE `min-width: 0` ON EACH CELL IS LOAD-BEARING AND LIVES IN `panel.css`** — a grid item's default
   * `min-width: auto` is its CONTENT width, so the caption would refuse to shrink and overflow the panel. Same
   * trap as `.sl-vfx-triplet`.
   */
  private buildTriple(slot: number | null): HTMLElement {
    const grid = document.createElement('div');
    grid.className = slot === null ? 'sl-composer-triple' : 'sl-composer-triple sl-composer-triple-slot';

    for (const plane of PLANES) {
      const cell = document.createElement('div');
      cell.className = 'sl-composer-pane';

      const canvas = document.createElement('canvas');
      canvas.className = 'sl-composer-pane-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute(
        'aria-label',
        `${slot === null ? 'Combined figure' : SLOT_LABELS[slot]} in ${PLANE_LABELS[plane]}`,
      );
      cell.appendChild(canvas);

      const cap = document.createElement('span');
      cap.className = 'sl-composer-pane-cap';
      cap.textContent = PLANE_LABELS[plane];
      cell.appendChild(cap);

      /*
       * v8 16.20 (E111) — the empty-state caption. ⚠️ **`drawOverlayScore` DRAWS TWO FAINT AXES AND RETURNS ON
       * `!(extent > 0)`, AND ITS OWN COMMENT DELEGATES THIS COPY TO THE CALLER — so until this element existed,
       * that delegation had no recipient.** A pane with no reach in its plane drew a crosshair on an empty box,
       * which is the diagram being exactly honest and reading as broken.
       *
       * ⚠️ **THE COPY IS `flat here — no reach in this plane` AND IT DELIBERATELY DOES NOT NAME `no Z size`, WHICH
       * IS WHAT THE PLAN'S OWN ILLUSTRATION SUGGESTED — THE SUGGESTED WORDING IS FALSIFIABLE AND I FALSIFIED IT.**
       * A pane is flat iff neither of its two axes reaches anything, and `sin((n + phase) · fm) · am` is zero when
       * `fm` is zero *whatever `am` is*. So an axis pair with `size 25` and `size 40` and a winding of 0 on both
       * draws a flat pane while both axes carry a real, authored size — verified directly against
       * `computeOverlayScores`, not reasoned about. `no Z size` would then be a confidently wrong explanation,
       * which is the failure shape this whole phase's readouts keep producing (the `t = 0` sample, the ghost's
       * no-op guard, the mislabelled legend — three of three were wrong EXPLANATIONS, not wrong pictures).
       * ⚠️ **No library preset reaches that case** (measured: of 30 flat panes across 3759, **0** have a live axis;
       * re-measured 2026-09-17 at 21 of 3540 — **still 0**, which is the half this claim rests on. `score-canvas.ts`'s
       * `paneExtent` header owns both figures and says why they drift with the refined-preset review)
       * — so the library could not have caught it and a browser pass could not either. **The weaker claim is the
       * true one: state that the plane is empty, and let the row readout own the cause.**
       *
       * ⚠️ **AND IT GRANTS NO SIZE, WHICH IS INVARIANT 29'S RULE VERBATIM.** The remedy for a silent axis is to
       * SAY SO; one control that lit Z would turn every planar preset in the library 3D.
       */
      const flatCap = document.createElement('span');
      flatCap.className = 'sl-composer-pane-flat';
      flatCap.textContent = FLAT_PANE_CAPTION;
      // ⚠️ The caption is the SHORT claim and the tooltip carries the cause — which is only reachable because the
      // caption is NOT `pointer-events: none`; see `panel.css`, where writing it that way was a defect I fixed.
      flatCap.title = TAB_TIPS['composer.paneFlat']!;
      flatCap.style.display = 'none';
      cell.appendChild(flatCap);

      grid.appendChild(cell);
      this.panes.push({ canvas, slot, plane, flatCap });
    }
    return grid;
  }

  private buildHeaderActions(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'sl-btn-group';

    const newBtn = document.createElement('button');
    newBtn.className = 'sl-btn';
    newBtn.textContent = 'New Figure';
    newBtn.title = TAB_TIPS['composer.newFigure']!;
    newBtn.addEventListener('click', () => {
      const p = this.state?.workingPreset;
      if (!p) return;
      /*
       * ⚠️ **THE SEED IS `seedFigure()` AND NEVER `MigrationLayer.defaultWave()`, which is all zeros and
       * renders BLACK.** A blank start is a black canvas with no clue which of sixty-three numbers ended it.
       * Every value in the seed is measured against the library — including `particleCount`, where the phase
       * plan's own figure was in the wrong UNIT (raw legacy `ParticleCount`, which migration multiplies by
       * five). `composercheck` §F asserts all of it.
       */
      p.generators.waves = seedFigure();
      p.generators.particleCount = SEED_PARTICLE_COUNT;
      p.generators.waveSpeed = SEED_WAVE_SPEED;
      // ⚠️ **A wholesale replacement, so the mutes go back on (16.17)** — and the reason is `Body`: mutes on the
      // two silent slots would be normalised away by `refreshDerived()`, but a muted Body would make a
      // brand-new figure export EMPTY. `resetMutes()` names all three call sites.
      this.resetMutes();
      this.rebuildModel();
      // ⚠️ The seed lights slot 0 only, so rows 1 and 2 change from lit inputs to the empty placeholder (or back)
      // — a body change, which `sync()` cannot make. Same obligation as `reset()` and `adoptExternalFigure()`.
      for (let w = 0; w < MAX_WAVES; w++) this.renderSlotBody(w);
      this.commit('composer-new-figure');
    });
    group.appendChild(newBtn);

    // ---- Stack ▾ (16.4) ----
    const stack = document.createElement('select');
    stack.className = 'sl-dropdown sl-composer-stack';
    stack.title = TAB_TIPS['composer.stack']!;
    const placeholder = document.createElement('option');
    placeholder.textContent = 'Stack ▾';
    placeholder.value = '';
    stack.appendChild(placeholder);
    STACKS.forEach((s, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = s.label;
      stack.appendChild(o);
    });
    stack.addEventListener('change', () => {
      const i = Number(stack.value);
      if (!stack.value || !this.model) return;
      // ⚠️ Idempotent by construction — multiples apply to the BODY winding, never to the current value.
      // The compounding version of this shape reached exposure ×875 in ~40 events in `Sliders`' `grading()`.
      applyStack(this.model, STACKS[i]!.multiples);
      /*
       * ⚠️ **AND WITHOUT THE NEXT LINE `Stack` IS COMPLETELY INERT ON A FRESH FIGURE — MEASURED, not
       * suspected.** On the `New Figure` seed the model reads `silent = [false, true, true]`; `applyStack` then
       * correctly writes windings 2 and 4 into slots that have **size 0 on every axis**, so the two stacked
       * waves contribute nothing and the picture does not change at all. This is invariant 13's harder form
       * exactly: the control moved precisely the value it names, and the output channel cannot show it. The
       * defect is in this tab and NOT in `applyStack` — the model's contract is *windings only*, which
       * `composercheck` §F pins, and which is right for a library preset whose three slots are already lit.
       */
      this.giveStackedSlotsSize();
      stack.value = '';
      this.commit('composer-stack');
    });
    group.appendChild(stack);

    /*
     * ⚠️ **`Repair` (16.4) IS DELETED HERE ON THE OWNER'S WORD (16.15), AND WHAT IT WAS FOR IS NOT SOLVED —
     * SAY SO RATHER THAN LETTING THE ABSENCE READ AS COMPLETENESS.** It existed to answer the Randomiser's two
     * closure-breaking mutations (a Gaussian on `fm.base`, and a ×0.8) without touching `randomize.ts`. That
     * argument still holds; the owner's is that a control acting on the user's own data needs a better reason
     * than *"the data was inconsistent"*, and the `open — X/Y leaves a seam` readout (16.13) already SAYS what
     * `Repair` silently fixed. **The honest remedy, if it is ever wanted again, is in `randomize.ts` — the
     * producer — and that is a behaviour change to a shipped tab needing its own decision.**
     */

    return group;
  }

  private buildSlotSection(slot: number): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'sl-section sl-composer-slot';
    sec.dataset.slot = String(slot);

    const head = document.createElement('div');
    head.className = 'sl-composer-slot-head';

    const title = document.createElement('div');
    title.className = 'sl-section-title';
    title.textContent = SLOT_LABELS[slot]!;
    title.title = TAB_TIPS['composer.slot']!;
    head.appendChild(title);

    /*
     * ---- v8 16.17 (E108) — the level's own on/off, and its own `Clear` ----
     *
     * ⚠️ **THEY SIT ON THE SLOT'S TITLE ROW BECAUSE THAT IS WHAT SCOPES THEM, AND SCOPE WAS THE OWNER'S SECOND
     * REPORT ABOUT THIS TAB** (*"I still could not tell what a control was scoped to"*). A control on the wave's
     * own head reads as belonging to that WAVE; the same pair in the header actions would read as figure-wide,
     * which is exactly what `New Figure` and `Stack ▾` are. `panel.css` reserved this row for it.
     *
     * ⚠️ **THE ORDER IS `[✓] Body … Clear` WITH THE BUTTON RIGHT-ALIGNED, AND THE CHECKBOX LEADS DELIBERATELY.**
     * The destructive control is the one that must not be reached by accident, so it is the furthest from the
     * title the eye lands on, and the reversible one is where a reader looks first.
     */
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    // ⚠️ The Visual FX checkbox class, reused rather than re-styled — `.sl-vfx-check` is the Lab's one checkbox
    // idiom and a second 16 px accent-coloured rule would be a second owner of one appearance.
    toggle.className = 'sl-vfx-check sl-composer-level-check';
    toggle.title = TAB_TIPS['composer.level']!;
    toggle.setAttribute('aria-label', `${SLOT_LABELS[slot]} on`);
    toggle.checked = this.levelIsOn(slot);
    toggle.addEventListener('change', () => this.setLevelEnabled(slot, toggle.checked));
    head.insertBefore(toggle, title);

    const clear = document.createElement('button');
    clear.className = 'sl-btn sl-composer-level-clear';
    /*
     * ⚠️ **THE WORD, NOT THE `✕` GLYPH THE ROW BUTTONS USE, AND THE DIFFERENCE IS THE STAKES.** A row `Clear`
     * destroys three numbers and there are twenty-one of them competing with three numeric columns for width;
     * this one destroys **twenty-one** and has a whole title row to itself. ⚠️ **Two controls with the same name
     * and vastly different reach is a real hazard** (`CLAUDE.md`: *three things are named "liquid"*), so the two
     * are distinguished by POSITION and by their tooltips, and this one's `aria-label` names the whole wave.
     */
    clear.textContent = 'Clear';
    clear.title = TAB_TIPS['composer.levelClear']!;
    clear.setAttribute('aria-label', `Clear every value on ${SLOT_LABELS[slot]}`);
    clear.addEventListener('click', () => this.clearLevel(slot));
    head.appendChild(clear);

    /*
     * ⚠️ **`Clear` IS HIDDEN WHILE THE LEVEL IS SWITCHED OFF (owner, 2026-10-25), AND THE REASON IS THE GATE
     * BELOW RATHER THAN ANYTHING ABOUT `Clear` ITSELF.** It destroys twenty-one numbers immediately with no
     * confirmation - the owner's decision, and the right one while they are on screen to be judged. With the
     * body hidden they are not: the same click becomes a destructive act on data the user cannot see. Switching
     * the level on first costs one click and makes the stakes visible again.
     *
     * ⚠️ **HIDDEN RATHER THAN `disabled`** - a greyed button invites the explanation that is not there, and
     * `display: none` is the idiom every other gate on the Lab's three tabs already uses.
     */

    /*
     * ⚠️ **THE TIER BUTTON (`Show detail` / `Simplify`) IS DELETED — every row now shows all 21 inputs, always.
     * THE OWNER CHOSE THIS OVER A VIEW-ONLY COLLAPSE, EXPLICITLY, AND 63 INPUTS ON SCREEN IS THE ACCEPTED COST.
     * Do not re-propose a tier, an accordion or a collapse.**
     *
     * ⚠️ **THE FINDING IS WORTH MORE THAN THE DELETION.** `Simplify` refused to demote a row carrying detail, and
     * that refusal was *correct*: `composercheck` §E spent ~20 assertions proving the simple projection was an
     * exact inverse, and it was. **It was correct and unwanted** — a control that acts on the user's own data
     * needs a reason to exist that is not *"the data was inconsistent"*, and a control that refuses is a control
     * whose best day is doing nothing. **A control that lets the user act on the ENGINE needs no such
     * justification**, which is what 16.17–16.19 are and why they replace these two buttons rather than joining
     * them. No checker could have found this; only a user could.
     */
    sec.appendChild(head);

    /*
     * ---- v8 `31.C` — **a switched-off level HIDES its 21 inputs** (owner, 2026-10-25) ----
     *
     * ⚠️⚠️ **THIS IS NOT THE DELETED TIER AND MUST NOT BE READ AS ITS RETURN.** `Show detail` / `Simplify` was a
     * VIEW SWITCH ON A ROW THAT CONTRIBUTES — it hid detail from a live wave, and the owner's answer was that all
     * 21 inputs stay up, always, at 63 on screen. **That decision is untouched: a level that is ON still shows
     * every input.** What is gated here is a level the user has switched OFF, whose inputs describe a wave the
     * figure does not contain — the same rule as the Materials tab's `Enable` sections and Visual FX's
     * `Curl Noise`. **Do not re-propose a collapse, a tier or an accordion for a level that is on.**
     *
     * ⚠️ **IT HIDES; IT NEVER DEFERS CONSTRUCTION OR CLEARS A VALUE.** `renderSlotBody` still builds all 21 inputs
     * for a switched-off lit level, `sync()` still writes into them, and `display: none` stops a row being SEEN,
     * not working — which is what keeps 16.17's whole promise (*"we want to keep the content of the matrix for
     * later editing"*) true while the inputs are invisible.
     *
     * ⚠️ **THE GATE'S PREDICATE IS `muted`, NOT `levelIsOn()`, AND THE DIFFERENCE IS A WHOLE STATE.** `levelIsOn`
     * is false for an EMPTY level too, and an empty level's body is the `empty — nothing authored here`
     * placeholder — the one surface that says why the row is blank, beside the one control that fills it. Gating
     * on `levelIsOn` would hide that sentence and leave a bare head, re-creating 16.17's own defect in a new
     * medium: *"off because empty"* and *"off because switched off"* sharing one appearance.
     *
     * ⚠️ **AND `silent` IS TESTED EXPLICITLY RATHER THAN TRUSTED TO THE NORMALISATION.** `refreshDerived()` clears
     * a mute over a silent level, so `muted && silent` should never occur — but a gate that is only correct
     * because of an invariant two methods away is a gate that fails silently when that invariant moves.
     */
    const offNote = document.createElement('div');
    // ⚠️ **`sl-composer-silent` AND NO CLASS OF ITS OWN**, so this is not a second owner of one appearance — the
    // two notes differ by their COPY, which is also the only difference a reader has. Hidden at construction
    // because `sync()` is the gate's owner and it runs at the END of `init()`: a note visible for the gap would
    // claim every level was off on the first paint.
    offNote.className = 'sl-composer-silent';
    offNote.style.display = 'none';
    // ⚠️ **One literal, set ONCE, `display` toggled** — `tipcheck` §I's inline scan matches a literal after
    // `.textContent =`, so a ternary assignment renders identically and is invisible to the ceiling.
    //
    // ⚠️ **It is NOT a duplicate of the figure-wide mute notice above the Score, and the two answer different
    // questions.** That one is about the COST (every diagram, Export, Snapshot and the Mixer write this level
    // cleared) and is therefore figure-wide by construction; this one answers *"where did my numbers go"*, which
    // is local to the row whose inputs just disappeared and cannot be asked of the figure.
    offNote.textContent = 'switched off — its values are kept here and come back when you switch it on';
    offNote.title = TAB_TIPS['composer.level']!;
    sec.appendChild(offNote);

    const body = document.createElement('div');
    body.className = 'sl-composer-slot-body';
    sec.appendChild(body);

    // ⚠️ Registered AFTER both nodes exist, because the registry now carries them — pushing at the checkbox's own
    // site (where this call used to be) would store `undefined` for two fields `tsc` requires.
    this.levelToggles.push({ slot, input: toggle, body, offNote, clear });

    return sec;
  }

  /**
   * (Re)build one slot's control body.
   *
   * ⚠️ **THE CALL SITES ARE THE CONTRACT: `render()`, the level checkbox (16.17), `giveStackedSlotsSize()`,
   * `clearAxisRow()`, `clearLevel()` (16.17), `reset()`, `adoptExternalFigure()` and `New Figure`.**
   * `adoptExternalFigure` was MISSING and that was a user-reported defect — `sync()` writes into the inputs that
   * exist and cannot create the ones that do not, so a row rendered as the empty placeholder stayed a placeholder
   * over a fully lit incoming figure. **Any new path that replaces the figure wholesale belongs on this list.**
   *
   * ⚠️ **AND `New Figure` WAS THE SAME DEFECT, UNREPORTED, IN THE OTHER DIRECTION — FOUND WHILE WRITING 16.17 BY
   * RE-READING THIS LIST RATHER THAN BY ANY CHECKER.** It replaces the figure with a seed that lights slot 0
   * ONLY, so on any of the library's fully-lit presets rows 1 and 2 go silent while their 21 inputs stay on
   * screen over a dead wave, with no placeholder saying so. It called `rebuildModel()` and `commit()`, both of
   * which are about the DATA — which is §J's whole finding: *restoring the data and not the presentation*, at a
   * third entry point. ⚠️ **A LIST IS ONLY A CONTRACT IF SOMETHING ENUMERATES THE CANDIDATES: this one named the
   * paths that HAD the call, so the path that lacked it was invisible.** §J now asserts all three wholesale
   * replacers together.
   *
   * ⚠️ **DO NOT READ THE COUNT AS STABLE — count the callers.** It was six across 16.15 and 16.16 by coincidence;
   * 16.17 removes `+ give it size`, adds the checkbox, `clearLevel()` and `New Figure`. `clearAxisRow()` and
   * `clearLevel()` are on the list for the OPPOSITE reason to the others: every other caller replaces the
   * figure, while the two `Clear`s only ever cross the lit → empty transition, which is why `clearAxisRow`'s call
   * is conditional at its own site and `clearLevel`'s is not (it always lands empty).
   */
  private renderSlotBody(slot: number): void {
    const sec = this.container?.querySelector<HTMLElement>(`.sl-composer-slot[data-slot="${slot}"]`);
    const body = sec?.querySelector<HTMLElement>('.sl-composer-slot-body');
    if (!body || !this.model) return;

    body.innerHTML = '';
    this.cells = this.cells.filter(c => c.slot !== slot);
    // ⚠️ **THE SAME FILTER AS `cells`, FOR THE SAME REASON, AND OMITTING IT IS SILENT.** `body.innerHTML = ''`
    // detaches this slot's nodes but leaves the registry entries pointing at them, so `sync()` would go on
    // writing values and repainting dials that are no longer in the document — and the row's real controls,
    // registered on the next pass, would sit beside stale duplicates that never update.
    this.dials = this.dials.filter(d => d.slot !== slot);
    this.breatheCells = this.breatheCells.filter(b => b.slot !== slot);
    this.ratioBoxes = this.ratioBoxes.filter(r => r.slot !== slot);
    // ⚠️ `!== slot` and NOT `=== null` — the combined row's three panes live in the same registry and are owned
    // by `render()`, so testing anything but this slot's own number would silently drop the top of the tab.
    this.panes = this.panes.filter(p => p.slot !== slot);

    const model = this.model.slots[slot]!;

    /*
     * ⚠️ **A SILENT ROW IS SHOWN AND LABELLED — it is never hidden and never greyed on its winding.** Silence is
     * `size + pulse === 0`; a slot with a winding of 0 on all three axes can be the liveliest row in the preset
     * (it winds through `wobble` — `Pipes`' first wave is the witness), so greying on the winding would mislabel
     * exactly the rows worth looking at. The owner's decision is three rows always visible, so this row states
     * its state.
     *
     * ⚠️ **`+ give it size` IS DELETED (v8 16.17 / E108) AND THE WAY OUT IS NOW THE LEVEL'S OWN CHECKBOX, WHICH
     * IS A CONSOLIDATION AND NOT A REMOVAL — say which, because an absent button otherwise reads as a lost
     * affordance.** The head's checkbox already answers *"does this level contribute"*; an empty level answers it
     * with **no** for a different reason than a switched-off one, and two controls with one visible effect on one
     * row is the hazard the owner's ask removes. Ticking the box on an empty level seeds it (`setLevelEnabled`),
     * so the button's whole behaviour survives at a control the user is already reading.
     *
     * ⚠️ **THE COPY IS `empty — nothing authored here` AND NOT `silent — no size`, AND THE OLD WORDING WAS WRONG
     * IN THE ONE WAY THAT MATTERS NOW: it names the CAUSE (`no size`) of a state the checkbox now also produces
     * for a different cause.** With a mute in the picture the row has two ways to contribute nothing, and only
     * one of them is about size — a muted row shows its numbers, an empty one has none to show. **`silent` and
     * `muted` must never be described by the same sentence** (`SlotModel.silent` carries the model half of this).
     */
    if (model.silent) {
      const note = document.createElement('div');
      note.className = 'sl-composer-silent';
      note.textContent = 'empty — nothing authored here';
      note.title = TAB_TIPS['composer.silent']!;
      body.appendChild(note);
      return;
    }

    /*
     * ---- 16.10 (E101) — this wave's own diagram, three planes, three curves, ONE frame ----
     *
     * ⚠️ **BESIDE THE NUMBERS AND NOT INSTEAD OF THEM — the owner's decision, verbatim: the numeric rows stay
     * "always visible, as today".** The diagram answers *"what does Pulse do to MY wave"*, which no number can;
     * the numbers remain the exact value, which no diagram can. Do not collapse the rows behind a toggle.
     *
     * ⚠️ **NOT RENDERED FOR A SILENT SLOT — the early `return` above owns that state.** A silent row has no
     * curve to draw at any extent, so three empty boxes would read as three broken diagrams.
     */
    body.appendChild(this.buildTriple(slot));

    // ---- 16.11 (E102) — the ONE ratio control, ABOVE the numbers it writes ----
    body.appendChild(this.ratioRow(slot));

    // ---- winding, per axis: a stepper of 1, but NOT an integer-only field (16.13) ----
    body.appendChild(this.axisRow(slot, 'winding', 'Winding', 1, TAB_TIPS['composer.winding']!));
    body.appendChild(this.axisRow(slot, 'size', 'Size', 1, TAB_TIPS['composer.size']!));

    /*
     * ⚠️ **ONE CONTROL SET, UNCONDITIONALLY — 16.15 deleted the tier and with it the `if` that used to stand
     * here.** Seven rows × three axes = 21 inputs per slot, 63 on the tab; that is the owner's decision, taken
     * over a view-only collapse. **The structural gain is not the missing branch: it is that no projection sits
     * between a control and the stored field any more**, so `applySimple`'s whole class of silent modulator loss
     * (92 982 measured A→B row triples) is unreachable rather than guarded.
     */
    // ⚠️ `Shift °` and not `Phase °` (16.12): `Shift` is the word for `axis.phase` everywhere on this tab,
    // including the dial below, whose whole subject is that the stored degrees are not the shift applied.
    body.appendChild(this.axisRow(slot, 'phase', 'Shift °', 1, TAB_TIPS['composer.phase']!));
    body.appendChild(this.dialRow(slot));
    // ---- 16.8 (E99) — the two unit-converted rows, ABOVE the four raw fields they restate ----
    body.appendChild(this.breatheRow(slot, 'pulse'));
    body.appendChild(this.axisRow(slot, 'pulse', 'Pulse', 1, TAB_TIPS['composer.pulse']!));
    body.appendChild(this.axisRow(slot, 'pulseRate', 'Pulse rate', 1, TAB_TIPS['composer.pulseRate']!));
    body.appendChild(this.breatheRow(slot, 'wobble'));
    body.appendChild(this.axisRow(slot, 'wobble', 'Wobble', 1, TAB_TIPS['composer.wobble']!));
    body.appendChild(this.axisRow(slot, 'wobbleRate', 'Wobble rate', 1, TAB_TIPS['composer.wobbleRate']!));

    body.appendChild(this.readoutRow(slot));
  }

  // -------------------------------------------------------------------------------------------------
  // 16.11 (E102) — the ONE ratio control: the 16.6 gallery and the 16.5 Tuner, merged
  // -------------------------------------------------------------------------------------------------

  /**
   * A single custom listbox over `RATIO_ROWS`; a pick writes this slot's three windings.
   *
   * ⚠️ **THIS REPLACES TWO CONTROLS THAT SET THE SAME THREE NUMBERS, AND THAT DUPLICATION WAS THE DEFECT THE
   * OWNER REPORTED RATHER THAN A TIDINESS COMPLAINT** — *"both the grid of shapes to select and the `Tuner
   * X:Y:Z` dropdown are basically setting the same three winding values X:Y:Z?"* Yes, through the same
   * `applyRatio`. Two surfaces for one write meant the user had to discover they were the same control, and
   * neither showed the other's selection. **Do not re-add a second ratio surface.**
   *
   * ⚠️ **A NATIVE `<select>` CANNOT CARRY THE THUMBNAILS AND THAT IS MEASURED, NOT ASSUMED: an `<option>`
   * renders its TEXT ONLY in every engine** — no child elements, no `background-image` on Chrome/Firefox's
   * native popup. Hence `role="combobox"` + `role="listbox"` by hand, with the keyboard contract written out
   * (ArrowUp/ArrowDown/Home/End/Enter/Space/Escape, `aria-activedescendant`). **A hand-built listbox that
   * cannot be driven from the keyboard is a regression against the `<select>` it replaced.**
   *
   * ⚠️ **EVERY ROW CARRIES THREE THUMBNAILS — XY, XZ AND YZ — AND THE THIRD IS NOT REDUNDANCY.** `composercheck`
   * §K measures 11 / 11 / 10 distinct drawn curves of 16 in XY / XZ / YZ against 16 of 16 in 3D: in any single
   * plane several rows draw the SAME picture, so a one-thumbnail listbox would show duplicate icons against
   * different captions (invariant 29 — an oracle, or a UI, reading one plane of a three-axis subject). The
   * captions stay for the same reason and **must not be dropped to make the thumbnails bigger.**
   *
   * ⚠️ **THE CAPTION IS `RatioRow.text` AND THE NAME IS AN ADDITION TO IT, NEVER A SUBSTITUTE** — four of the
   * twenty rows have a name (`circle / sphere`, `figure eight`, `trefoil`, `lattice`, `knot` — five names, one
   * of which is `1:1:1` and shared with a tile). A row a user cannot quote as three numbers is a row nobody can
   * put in a bug report.
   */
  private ratioRow(slot: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-composer-ratio-row';

    const lab = document.createElement('div');
    lab.className = 'sl-slider-label';
    lab.textContent = 'Shape';
    lab.title = TAB_TIPS['composer.ratio']!;
    row.appendChild(lab);

    const combo = document.createElement('div');
    combo.className = 'sl-composer-combo';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sl-composer-combo-btn';
    button.title = TAB_TIPS['composer.ratio']!;
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-label', `${SLOT_LABELS[slot]} winding ratio`);

    const value = document.createElement('span');
    value.className = 'sl-composer-combo-value';
    // ⚠️ Placeholder only — `sync()` owns this text, and it is written there rather than here because the
    // model's ratio can change from outside the tab (a preset load, the Mixer, `Repair`).
    value.textContent = '—';
    button.appendChild(value);

    const caret = document.createElement('span');
    caret.className = 'sl-composer-combo-caret';
    caret.textContent = '▾';
    caret.setAttribute('aria-hidden', 'true');
    button.appendChild(caret);

    const list = document.createElement('div');
    list.className = 'sl-composer-combo-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Winding ratios');
    list.style.display = 'none';

    const listId = `sl-composer-ratio-list-${slot}`;
    list.id = listId;
    button.setAttribute('aria-controls', listId);

    const box: RatioBox = { slot, button, value, list, options: [], canvases: [], active: -1 };

    const scores = this.ensureRatioScores();

    RATIO_ROWS.forEach((r, i) => {
      const opt = document.createElement('div');
      opt.className = 'sl-composer-combo-opt';
      opt.id = `${listId}-${i}`;
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', 'false');
      opt.dataset.row = String(i);

      const thumbs = document.createElement('span');
      thumbs.className = 'sl-composer-thumbs';
      const canvases: HTMLCanvasElement[] = [];
      PLANES.forEach((plane, p) => {
        const canvas = document.createElement('canvas');
        canvas.className = 'sl-composer-thumb';
        // Titled per plane so a hover names which projection it is — the row is three near-identical squares
        // and there is no room for three captions.
        canvas.title = PLANE_LABELS[plane];
        thumbs.appendChild(canvas);
        canvases.push(canvas);
        // ⚠️ Drawn immediately FROM THE CACHE, and again in `paintRatioBoxes` once the row has layout: a canvas
        // with no layout yet reports `clientHeight` 0, and `drawScore` then falls back to its own default size.
        drawScore(canvas, scores[i]![p]!);
      });
      opt.appendChild(thumbs);

      const cap = document.createElement('span');
      cap.className = 'sl-composer-combo-cap';
      cap.textContent = r.name ? `${r.text}  ·  ${r.name}` : r.text;
      opt.appendChild(cap);

      opt.addEventListener('click', () => {
        this.pickRatio(box, i);
      });
      // ⚠️ `mousedown` is preventDefault-ed so the button keeps focus through the click — otherwise the
      // click-outside dismissal below and the button's own `blur` race, and the list can close before the
      // `click` listener fires.
      opt.addEventListener('mousedown', e => e.preventDefault());

      list.appendChild(opt);
      box.options.push(opt);
      box.canvases.push(canvases);
    });

    button.addEventListener('click', () => this.toggleRatioList(box, list.style.display === 'none'));
    button.addEventListener('keydown', e => this.onRatioKey(box, e));
    /*
     * ⚠️ **THE DISMISSAL IS ON `focusout` OF THE WRAPPER, NOT A DOCUMENT-LEVEL `mousedown` LISTENER** — a
     * document listener would have to be removed in `dispose()` and in every `renderSlotBody` rebuild, and
     * `renderSlotBody` runs on every tier switch. `focusout` dies with the element (invariant 15's shape: a
     * subscription whose owner cannot unsubscribe is a leak). `relatedTarget === null` covers a click on
     * non-focusable chrome.
     */
    combo.addEventListener('focusout', e => {
      const to = (e as FocusEvent).relatedTarget as Node | null;
      if (to && combo.contains(to)) return;
      this.toggleRatioList(box, false);
    });

    combo.appendChild(button);
    combo.appendChild(list);
    row.appendChild(combo);
    this.ratioBoxes.push(box);
    return row;
  }

  /** Open or close one listbox. Kept separate so the keyboard and pointer paths cannot diverge. */
  private toggleRatioList(box: RatioBox, open: boolean): void {
    box.list.style.display = open ? 'block' : 'none';
    box.button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) {
      box.button.removeAttribute('aria-activedescendant');
      return;
    }
    // Opening lands the active row on the current selection, so ArrowDown moves from where the user is rather
    // than from the top of a twenty-row list.
    if (box.active < 0) box.active = Math.max(0, this.selectedRatioRow(box.slot));
    this.markRatioActive(box);
    box.options[box.active]?.scrollIntoView({ block: 'nearest' });
  }

  private markRatioActive(box: RatioBox): void {
    box.options.forEach((o, i) => o.classList.toggle('active', i === box.active));
    const el = box.options[box.active];
    if (el) box.button.setAttribute('aria-activedescendant', el.id);
  }

  /**
   * The keyboard contract. ⚠️ **`Enter`/`Space` COMMIT AND `Escape` CLOSES WITHOUT COMMITTING — and a closed
   * listbox must still respond to the arrows** (opening on the first arrow press is what every native
   * `<select>` does; a listbox that needs a click to open is not keyboard-reachable at all).
   */
  private onRatioKey(box: RatioBox, e: KeyboardEvent): void {
    const open = box.list.style.display !== 'none';
    const last = RATIO_ROWS.length - 1;
    const move = (to: number): void => {
      box.active = Math.max(0, Math.min(last, to));
      if (!open) this.toggleRatioList(box, true);
      else {
        this.markRatioActive(box);
        box.options[box.active]?.scrollIntoView({ block: 'nearest' });
      }
    };
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(open ? box.active + 1 : Math.max(0, this.selectedRatioRow(box.slot))); break;
      case 'ArrowUp': e.preventDefault(); move(open ? box.active - 1 : Math.max(0, this.selectedRatioRow(box.slot))); break;
      case 'Home': if (open) { e.preventDefault(); move(0); } break;
      case 'End': if (open) { e.preventDefault(); move(last); } break;
      case 'Escape': if (open) { e.preventDefault(); this.toggleRatioList(box, false); } break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open && box.active >= 0) this.pickRatio(box, box.active);
        else this.toggleRatioList(box, true);
        break;
      default: break;
    }
  }

  /** Commit one row to one slot. */
  private pickRatio(box: RatioBox, i: number): void {
    const r = RATIO_ROWS[i];
    if (!this.model || !r) return;
    box.active = i;
    this.toggleRatioList(box, false);
    box.button.focus();
    /*
     * ⚠️ **ONE SHARED OWNER — `applyRatio` — AND THE MERGE DID NOT WEAKEN THAT: it is now the only writer for
     * the only ratio control, which is what §H's one-shared-owner clause asserts (re-pointed here from
     * `galleryRow`).** The Tuner shipped with its own `min(nonzero)` base that compounded on a second identical
     * click (`3:2:5` over `7:7:7` → `21:14:35` → `42:28:70`); `ratioBase`'s gcd is idempotent by construction
     * and measures so on 13 664 of 13 664 re-clicks — `composercheck` §K's basis, 854 live slots × 16 tiles.
     * ⚠️ **Read that figure off the checker with its basis: a probe of mine once put it at 20 448 over a wider
     * slot set, and that gap is a BASIS difference, not an event.**
     */
    applyRatio(this.model.slots[box.slot]!.axes, r.ratio);
    this.commit('composer-ratio');
  }

  /**
   * The index in `RATIO_ROWS` whose pick would change nothing for this slot, or `-1`.
   *
   * ⚠️ **COMPARED THROUGH THE SAME `ratioBase` THE WRITE USES, so "selected" means exactly "picking it moves
   * nothing"** — any looser test would mark a row whose pick still moves the figure, which is the shape of the
   * report that opened this redesign (*"the selection is not applied … I assume this is a bug"*).
   */
  private selectedRatioRow(slot: number): number {
    if (!this.model) return -1;
    const axes = this.model.slots[slot]?.axes;
    if (!axes) return -1;
    const base = ratioBase(axes);
    if (!(base > 0)) return -1;
    return RATIO_ROWS.findIndex(r => axes.every((c, a) => c.winding === base * r.ratio[a]!));
  }

  /**
   * Build (or reuse) the `RATIO_ROWS × PLANES` grid of `ScoreResult`s.
   *
   * ⚠️ **THE CACHE IS NOW PLANE-INVARIANT AND HAS NO INVALIDATION AT ALL, AND THE MISSING LINE IS A REMOVED
   * DEFECT CLASS RATHER THAN AN OVERSIGHT.** 16.6's version was keyed on the tab's selected plane and had to be
   * nulled whenever that changed; a stale cache then drew XY curves under an XZ label. 16.9 deleted the notion
   * of a selected plane, so every plane is computed once and the stale state is unreachable. **Do not port an
   * invalidation forward "for safety": a dead invalidation is an assertion nobody can fail.**
   *
   * ⚠️ **EACH THUMBNAIL IS A SYNTHETIC ONE-WAVE FIGURE WITH UNIT SIZES, NOT THE SLOT'S OWN WAVE — deliberately,
   * and the cache depends on it.** A thumbnail of the user's actual wave would change on every size, phase,
   * pulse and wobble edit, so all 180 canvases would have to be recomputed inside `sync()`; and it would be
   * *less* legible, since a slot whose Z size is 0 would render every Z-carrying ratio identically. Unit sizes
   * make the thumbnail show what the RATIO does, which is the only thing picking it changes.
   *
   * ⚠️ **THE Z SIZE IS 1 EVEN THOUGH PICKING A ROW NEVER GRANTS Z A SIZE.** A `1:1:2` thumbnail drawn with
   * `size = [1,1,0]` would be a flat ellipse in XZ and YZ — an honest picture of *this slot* and a useless
   * picture of *the ratio*. The thumbnail illustrates the relationship; the row's `no size — winding inert
   * there` readout is what tells the user their own Z cannot show it. **Two different jobs; do not unify them.**
   */
  private ensureRatioScores(): ScoreResult[][] {
    if (this.ratioScores) return this.ratioScores;
    const axis = (winding: number, phase: number): AxisWave => ({
      phase,
      am: { base: 1, amplitude: 0, frequency: 0 },
      fm: { base: winding, amplitude: 0, frequency: 0 },
    });
    this.ratioScores = RATIO_ROWS.map(r => {
      const wave = {
        speed: 0,
        /*
         * ⚠️ **THE 90° ON Y IS WHAT MAKES A `1:1` THUMBNAIL A CIRCLE RATHER THAN A DIAGONAL LINE, and it is the
         * seed's own `SEED_TWIST` in the other sign.** With every phase at 0, `sin(n·1)` on both axes is
         * `x === y` — nine of the sixteen tile rows would draw a straight line and the list would be worse than
         * useless. A quarter turn is also what the library authors — the X→Y phase delta measured ±90 on most
         * live slots (the figure comes from `twistOf`, deleted with the tier in 16.15; the MEASUREMENT stands).
         */
        axes: [axis(r.ratio[0]!, 0), axis(r.ratio[1]!, 90), axis(r.ratio[2]!, 0)] as [AxisWave, AxisWave, AxisWave],
      };
      // ⚠️ `computeScore` PER PLANE, and the three results are deliberately NOT forced onto a shared extent: a
      // thumbnail's job is to be recognisable in its own square, so each auto-fits. That is the opposite of the
      // per-slot triple in 16.10, where the three panes share one extent because a SIZE difference is the very
      // thing being read. **Two different jobs; the shared-extent rule belongs to `computeOverlayScores` alone.**
      return PLANES.map(plane => computeScore([wave], plane));
    });
    return this.ratioScores;
  }

  /**
   * Repaint every thumbnail and mark each box's selected row.
   *
   * ⚠️ **CALLED FROM `sync()`, BUT IT DRAWS ONLY FROM THE CACHE — the `drawScore` calls here are rasterisation,
   * not evaluation.** The expensive half (`computeScore` × 20 × 3) happens once in `ensureRatioScores`. A
   * version that recomputed here would run ~43 000 sample evaluations per keystroke, which is invariant 8's
   * allocation RATE reached through a diagram rather than a buffer — `composercheck` §K asserts the absence.
   */
  private paintRatioBoxes(): void {
    if (!this.model) return;
    const scores = this.ensureRatioScores();
    for (const box of this.ratioBoxes) {
      const sel = this.selectedRatioRow(box.slot);
      box.canvases.forEach((planes, i) => {
        planes.forEach((canvas, p) => drawScore(canvas, scores[i]![p]!));
        const opt = box.options[i];
        if (!opt) return;
        opt.classList.toggle('selected', i === sel);
        opt.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      });
      /*
       * ⚠️ **THE BUTTON MUST NAME THE SLOT'S ACTUAL RATIO EVEN WHEN NO ROW MATCHES, AND THAT IS THE COMMON CASE
       * RATHER THAN AN EDGE — the twenty rows cover 595 of 854 live library slots (69.7 %), so roughly three
       * slots in ten are on a ratio the list does not offer.** A button reading `—` or falling back to the first
       * row would misreport the figure; it prints the reduced ratio from `ratioBase` instead, which is the same
       * arithmetic the selection test uses. `0 : 0 : 0` is a real authored state (743 of 2562 live-slot axes sit
       * at winding 0) and prints as itself.
       */
      const axes = this.model.slots[box.slot]?.axes;
      if (!axes) continue;
      const base = ratioBase(axes);
      const shown = base > 0
        ? axes.map(c => c.winding / base).join(' : ')
        : axes.map(c => String(c.winding)).join(' : ');
      const name = sel >= 0 ? RATIO_ROWS[sel]!.name : '';
      box.value.textContent = name ? `${shown}  ·  ${name}` : shown;
    }
  }

  // -------------------------------------------------------------------------------------------------
  // 16.7 (E98) — the phase dial, in EFFECTIVE degrees
  // -------------------------------------------------------------------------------------------------

  /**
   * Three dials showing the shift the ENGINE applies, and writing the stored phase backwards from it.
   *
   * ⚠️ **THIS IS THE ONE CONTROL IN THE TAB WHOSE DISPLAYED UNIT IS NOT ITS STORED UNIT, AND THAT INVERSION IS
   * THE WHOLE FEATURE.** The inner expression is `sin((n + phase) · fm) · am`, so the shift the figure actually
   * receives is `phase × winding mod 360`. On a winding-32 axis a user typing `90` into the Phase row gets a
   * shift of `2880 mod 360 = 0°` — the engine cancels it exactly — and nothing in the numeric row can tell
   * them why. The dial is in the unit they mean: it reads `wrap360(phase × winding)` and solves
   * `phase = target / winding` to store.
   *
   * ⚠️ **THE INVERSION IS EXACT, MEASURED RATHER THAN ASSUMED: `composercheck` §L round-trips 43 656 of 43 656
   * (live-slot axis × 15° target) cases with a worst error of `5.684e-14`.** It is exact because it is one
   * division and one multiplication in the same double, not because of any tolerance. ⚠️ **Read the figure from
   * §L with its basis — my own earlier probe put the same quantity at 7244 over a narrower axis set.**
   *
   * ⚠️ **AT WINDING 0 THE DIAL IS DISABLED AND SAYS WHY — it is not merely a division by zero to guard.** No
   * phase whatsoever can shift an axis whose winding is 0: the argument is `(n + phase) · 0`, identically zero.
   * So `phaseForTarget` returns `null` and the control states the reason rather than silently accepting a drag
   * that cannot land. **Measured by §L: 743 of 2562 axes on live slots are in this state**, so it is a common case and not an
   * edge one — a dial that spun freely there would be invariant 13 on a control built to explain invariant 13.
   *
   * ⚠️ **IT DOES *NOT* GREY OUT WHEN `size === 0`, AND THE DISTINCTION IS DELIBERATE.** A zero-size axis makes
   * the phase invisible *this frame*, but the number is real, stored and exported, and it becomes visible the
   * moment the axis is given a size — so disabling it would be greying a control that works. The row-level
   * `no size — winding inert there` readout is what says the axis cannot currently show it. **Two different
   * claims: "cannot be applied" versus "cannot be seen." Only the first disables anything.**
   */
  private dialRow(slot: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-slider-row sl-composer-dial-row';

    const lab = document.createElement('div');
    lab.className = 'sl-slider-label';
    lab.textContent = 'Shift °';
    lab.title = TAB_TIPS['composer.dial']!;
    row.appendChild(lab);

    /*
     * ⚠️ **ALL THREE AXES, ALWAYS — 16.15 deleted the two-dial variant along with the tier.** Z used to be
     * omitted here because `SimpleRow` could not hold an independent Z phase, so a Z dial would have offered a
     * write `applySimple` had to discard. That constraint is gone with the projection: `cell.phase` is now the
     * only representation, so every axis can take a dial and the `Z shift needs full detail` note is deleted
     * rather than reworded. **A note explaining a restriction must die with the restriction** — kept as a
     * comment because a note that outlives its cause is worse than none (invariant 25 in reverse).
     */
    for (let a = 0; a < AXES; a++) {
      const canvas = document.createElement('canvas');
      canvas.className = 'sl-composer-dial';
      canvas.title = TAB_TIPS['composer.dial']!;
      canvas.setAttribute('role', 'slider');
      canvas.setAttribute('aria-label', `${SLOT_LABELS[slot]} shift ${AXIS_LABELS[a]}`);
      canvas.tabIndex = 0;

      const dial: Dial = { canvas, slot, axis: a, drag: null };
      this.dials.push(dial);
      this.installDial(dial);
      row.appendChild(canvas);
    }

    return row;
  }

  /**
   * Wire one dial's pointer, keyboard and paint behaviour.
   *
   * ⚠️ **THE STORED VALUE IS ALWAYS `cell.phase`, NEVER THE TARGET THE USER DRAGGED TO, and re-deriving it from
   * the display would lose precision on almost every axis.** `phase = target / winding` at winding 32 and target
   * 90 is `2.8125` — exact in binary — but at winding 7 it is `12.857142857142858`, and a dial that stored the
   * rounded *display* string and multiplied back would drift a little further on every drag. So the write goes
   * `target → phaseForTarget → cell.phase`, and the dial's own angle is re-derived from `cell.phase` on the next
   * `sync()`. **Do not add a `dial.value` field: the model is the value.**
   */
  private installDial(dial: Dial): void {
    const { canvas } = dial;

    /** The effective shift this axis currently carries, or `null` when no phase can shift it. */
    const current = (): number | null => {
      const cell = this.model?.slots[dial.slot]?.axes[dial.axis];
      if (!cell) return null;
      return cell.winding === 0 ? null : wrap360(cell.phase * cell.winding);
    };

    /** Write a target shift in effective degrees. */
    const write = (targetDeg: number): void => {
      if (!this.model) return;
      const axes = this.model.slots[dial.slot]!.axes;
      const cell = axes[dial.axis]!;
      const phase = phaseForTarget(wrap360(targetDeg), cell.winding);
      // ⚠️ `null` means the winding is 0 — the write is IMPOSSIBLE, not merely clamped. Returning silently is
      // right because the control is already disabled and labelled; accepting it would store `Infinity`.
      if (phase === null) return;
      /*
       * ⚠️ **ONE WRITE PATH SINCE 16.15 — the `simple` branch that used to stand here routed through
       * `simpleOf`/`applySimple`, and that routing was the DEFECT the projection forced, not a feature.** On a
       * Y dial it stored `twist = phase − phaseX`, so dragging Y moved a value derived from X; with the tier
       * gone the dial writes the field it names. **Do not reintroduce a derived write here.**
       */
      cell.phase = phase;
      // The three derived readouts, exactly as `axisRow` recomputes them — `silent` too, because omitting a
      // field here is how a readout starts describing the previous value.
      cell.closes = closesAt(cell.winding);
      cell.effectivePhase = wrap360(cell.phase * cell.winding);
      cell.silent = cell.size + cell.pulse === 0;
      this.commit('composer-dial');
    };

    /** Pointer position → degrees, with a detent snap. */
    const degOf = (ev: PointerEvent): number => {
      const r = canvas.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      // Screen Y is down, model degrees run counter-clockwise from +X — so negate, exactly as `drawScore` does.
      const dy = (r.top + r.height / 2) - ev.clientY;
      const raw = wrap360(Math.atan2(dy, dx) * 180 / Math.PI);
      // ⚠️ The snap is a DISPLAY-side convenience on the target, applied BEFORE the division — `composercheck`
      // §L measures 1550 of 2562 axes on live slots (60.5 %) already carrying an effective shift ON a detent,
      // so landing exactly on one must be easy. (Read the figure from §L, with its basis.)
      for (const d of DIAL_DETENTS) {
        if (Math.abs(wrap360(raw - d + 180) - 180) <= DIAL_SNAP_DEG) return d;
      }
      return Math.round(raw);
    };

    canvas.addEventListener('pointerdown', ev => {
      if (current() === null) return;
      dial.drag = degOf(ev);
      canvas.setPointerCapture(ev.pointerId);
      write(dial.drag);
      ev.preventDefault();
    });
    canvas.addEventListener('pointermove', ev => {
      if (dial.drag === null) return;
      const d = degOf(ev);
      // ⚠️ Only on CHANGE: a pointermove fires far faster than a degree changes, and each write runs
      // `commit()` → `writeFigure` → `setWaves` → `sync()`. Committing per event would put a full resync on
      // every mouse sample, which is invariant 8's RATE argument in a drag handler.
      if (d === dial.drag) return;
      dial.drag = d;
      write(d);
    });
    const end = (ev: PointerEvent): void => {
      if (dial.drag === null) return;
      dial.drag = null;
      if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    /*
     * ⚠️ **`stopPropagation()` IS LOAD-BEARING AND ITS ABSENCE WAS A LIVE DEFECT: `main.ts`'s document-level
     * `keydown` CYCLED THE PRESET UNDER THE DIAL** (found by the Phase 17 suite BY RUNNING, 2026-09-09; two
     * failing tests — steps 81 and 75–77 — ONE cause). That handler steps the preset on ArrowRight/ArrowLeft and
     * skips only `if (e.target.tagName === 'INPUT')`, and **a dial is a `<canvas role="slider">`, so it is not
     * skipped**; it does not test `shiftKey` either, so `Shift+ArrowRight` wrote 90 into the dial AND advanced
     * the preset in one keystroke.
     *
     * ⚠️ **`preventDefault()` DOES NOT STOP ANOTHER LISTENER — it suppresses the BROWSER's default action, and
     * the two are unrelated calls.** Having only the first reads as though the event were handled, which is
     * exactly why this survived review: the line looked complete. **A widget that means to OWN its key needs
     * both**, and the call goes on every branch this handler claims, not only the ones that move the value.
     *
     * ⚠️ **THE FIX IS HERE AND NOT IN `main.ts`'s GUARD, DELIBERATELY.** Widening that guard to exclude
     * `role="slider"` would fix this dial and leave the next focusable non-`INPUT` widget exposed — the guard
     * enumerates what to skip, and an enumeration is what made this invisible. **The control that claims a key
     * is the one that must consume it.** (`main.ts`'s guard is still wrong in general and is left alone here
     * because nothing else in the Lab currently takes an arrow key.)
     */
    canvas.addEventListener('keydown', ev => {
      const cur = current();
      if (cur === null) return;
      const step = ev.shiftKey ? 90 : 1;
      const back = ev.key === 'ArrowLeft' || ev.key === 'ArrowDown';
      const fwd = ev.key === 'ArrowRight' || ev.key === 'ArrowUp';
      if (!back && !fwd) return;
      write(back ? cur - step : cur + step);
      ev.preventDefault();
      ev.stopPropagation();
    });
  }

  /** Paint one dial from the model. Called from `sync()` — cheap, no allocation, no evaluation. */
  private paintDial(dial: Dial): void {
    const ctx = dial.canvas.getContext('2d');
    const cell = this.model?.slots[dial.slot]?.axes[dial.axis];
    if (!ctx || !cell) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const want = Math.round((dial.canvas.clientWidth || 34) * dpr);
    // Assign only on change — writing `width` clears and reallocates the backing store (invariant 8).
    if (dial.canvas.width !== want) dial.canvas.width = want;
    if (dial.canvas.height !== want) dial.canvas.height = want;

    const n = dial.canvas.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, n, n);

    const c = n / 2, r = c - 2 * dpr;
    const inert = cell.winding === 0;
    dial.canvas.classList.toggle('inert', inert);
    // ⚠️ The reason lives on the control's own `title`, appended to the shared tooltip rather than replacing it
    // — a disabled control that does not say why is the failure invariant 25 is about.
    dial.canvas.title = inert
      ? `${TAB_TIPS['composer.dial']!} This axis has a winding of zero, so no phase can shift it.`
      : TAB_TIPS['composer.dial']!;

    ctx.strokeStyle = inert ? 'rgba(255,255,255,0.10)' : 'rgba(190,220,255,0.35)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();

    // The four quarter-turn detents, as ticks — they are where 76.5 % of the library's slots sit.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (const d of DIAL_DETENTS) {
      const a = d * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r * 0.72, c - Math.sin(a) * r * 0.72);
      ctx.lineTo(c + Math.cos(a) * r, c - Math.sin(a) * r);
      ctx.stroke();
    }

    if (inert) return;

    const eff = wrap360(cell.phase * cell.winding);
    const a = eff * Math.PI / 180;
    ctx.strokeStyle = 'rgba(190,220,255,0.92)';
    ctx.lineWidth = 1.6 * dpr;
    ctx.beginPath();
    ctx.moveTo(c, c);
    // ⚠️ `-sin` for the same reason `drawScore` negates Y: model degrees are counter-clockwise, canvas Y is down.
    ctx.lineTo(c + Math.cos(a) * r * 0.86, c - Math.sin(a) * r * 0.86);
    ctx.stroke();
    dial.canvas.setAttribute('aria-valuenow', String(Math.round(eff)));
  }

  // -------------------------------------------------------------------------------------------------
  // 16.8 (E99) — breathe in real units
  // -------------------------------------------------------------------------------------------------

  /**
   * One sentence per modulator, per axis: *"Pulse ± N % every T s"*.
   *
   * ⚠️ **THE LABEL IS `Pulse` / `Wobble` IN PERCENT AND SECONDS, AND IT IS *NOT* A SECOND QUANTITY (v8 16.12 /
   * E103).** It shipped as `Size breathes` / `Winding breathes` beside a `Pulse` / `Wobble` row holding the same
   * two stored fields in raw units, and the owner read the pair as four independent things: *"I am confused about
   * wobble versus winding breathes, isn't that the same?"* It is — one field, two units. The unit is now the only
   * thing that distinguishes the rows, and the label says which. **Do not reintroduce a second name for either
   * quantity;** the word "breathes" is retired from this tab.
   *
   * ⚠️ **THE FOUR RAW FIELDS STAY BELOW THIS ROW, AND THAT IS NOT REDUNDANCY — it is the only way the row can be
   * lossless.** `pulse`/`pulseRate`/`wobble`/`wobbleRate` are authored across ranges no single sentence covers:
   * `|pulse|` reaches 6696.43, `|rate|` reaches 800, and periods span **0.150 s to 12 000 s** (median 40 s;
   * 2 axes faster than half a second, 152 slower than two minutes). The sentence is the readable view; the raw
   * fields remain the exact one.
   *
   * ⚠️ **THE PERCENT VIEW IS A HYBRID BY MEASUREMENT, NOT BY CAUTION: 386 axes carry a pulse over a size of ZERO
   * and 343 carry a wobble over a winding of zero.** A percentage of zero does not exist, so those rows show the
   * ABSOLUTE amount and label the unit — `breathePercent` returns `null` for exactly that case. A percent-only
   * design would have shown `Infinity`, `NaN` or a silent blank on 729 axes, most of them in the presets that
   * breathe hardest.
   *
   * ⚠️ **OVER 100 % IS ACCEPTED AND NOT CLAMPED, AND 436 AXES REQUIRE IT.** `|pulse| > |size|` means the axis
   * passes through zero and inverts each cycle — a real, authored, load-bearing look. A clamp at 100 % would
   * silently retune 436 axes the moment the row was touched, which is the lossy-demotion failure `composercheck`
   * §E exists to prevent, arriving through a display convenience.
   *
   * ⚠️ **AND THE SECONDS FIELD STAYS EDITABLE AT ZERO DEPTH — 24 axes author a rate with no amplitude.** Setting
   * the timing before the amount is a reasonable order to work in, and greying it would also destroy those 24
   * authored rates on the first edit.
   */
  private breatheRow(slot: number, which: 'pulse' | 'wobble'): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-slider-row sl-composer-breathe-row';

    const word = which === 'pulse' ? 'Pulse' : 'Wobble';
    const lab = document.createElement('div');
    lab.className = 'sl-slider-label';
    /*
     * ⚠️ **THE SAME WORD AS THE RAW ROW BELOW, WITH THE UNIT IN PARENTHESES — AND THAT IS THE POINT OF 16.12:
     * the two rows are ONE quantity in two units, so they must share the noun and differ only in the unit.**
     * `Size breathes` / `Winding breathes` here against `Pulse` / `Wobble` below read as four quantities; the
     * owner counted them as four. The parenthetical matches the live unit chip beside each field, which reads
     * `%` or `abs` and `s`.
     */
    lab.textContent = `${word} (% · s)`;
    const depthTip = which === 'pulse'
      ? TAB_TIPS['composer.breathePulseDepth']!
      : TAB_TIPS['composer.breatheWobbleDepth']!;
    const secTip = which === 'pulse'
      ? TAB_TIPS['composer.breathePulseSeconds']!
      : TAB_TIPS['composer.breatheWobbleSeconds']!;
    lab.title = depthTip;
    row.appendChild(lab);

    for (let a = 0; a < AXES; a++) {
      const group = document.createElement('span');
      group.className = 'sl-composer-breathe';

      const mk = (
        kind: BreatheCell['kind'], tip: string, unitText: string, step: string, ariaSuffix: string,
      ): void => {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'sl-composer-num sl-composer-breathe-num';
        input.step = step;
        input.title = tip;
        input.setAttribute('aria-label', `${SLOT_LABELS[slot]} ${lab.textContent} ${AXIS_LABELS[a]} ${ariaSuffix}`);
        const unit = document.createElement('span');
        unit.className = 'sl-composer-breathe-unit';
        unit.textContent = unitText;
        unit.title = tip;

        input.addEventListener('change', () => this.applyBreathe(slot, a, kind, Number(input.value)));

        group.appendChild(input);
        group.appendChild(unit);
        this.breatheCells.push({ input, unit, slot, axis: a, kind });
      };

      mk(which === 'pulse' ? 'pulseDepth' : 'wobbleDepth', depthTip, '%', '1', 'depth');
      mk(which === 'pulse' ? 'pulseSeconds' : 'wobbleSeconds', secTip, 's', '0.1', 'seconds');

      row.appendChild(group);
    }
    return row;
  }

  /**
   * Convert one breathe edit back into the stored field and commit.
   *
   * ⚠️ **`waveSpeed` IS AN INPUT TO THE SECONDS CONVERSION IN BOTH DIRECTIONS, AND IT COMES FROM THE MODEL —
   * never from a constant.** `pos` advances by `waveSpeed · min(dt/16.667, 6)` per frame, so at 60 fps a
   * modulator's period is `(360/rate) / (60 · waveSpeed)`. The library authors six distinct sweep rates
   * (0.05 × 375, then 0.07, 0.01, 0.005, 0.5, 0.08), a hundredfold spread — so a converter hardcoding 0.05
   * would be wrong by up to 10× on 17 presets while looking perfectly plausible. **That is invariant 10: the
   * expression type-checks whatever the units are.**
   */
  private applyBreathe(slot: number, axis: number, kind: BreatheCell['kind'], raw: number): void {
    if (!this.model) return;
    if (!Number.isFinite(raw)) { this.sync(); return; }
    const cell = this.model.slots[slot]!.axes[axis]!;
    const speed = this.model.waveSpeed;

    if (kind === 'pulseDepth' || kind === 'wobbleDepth') {
      const base = kind === 'pulseDepth' ? cell.size : cell.winding;
      const abs = amplitudeForPercent(raw, base);
      /*
       * ⚠️ **`null` MEANS THE BASE IS ZERO, SO THE FIELD IS SHOWING AN ABSOLUTE — AND THE WRITE MUST TAKE IT AS
       * ONE.** This is the hybrid's one real trap: reading the same number as a percentage here would divide the
       * user's `40` by a zero base and store nothing, on the 386 pulse and 343 wobble axes where the row is
       * *already* labelled `abs`. The unit shown and the unit stored have to agree, and both branches are the
       * same `null` test on the same base.
       */
      const v = abs === null ? raw : abs;
      if (kind === 'pulseDepth') cell.pulse = v; else cell.wobble = v;
      cell.silent = cell.size + cell.pulse === 0;
    } else {
      // ⚠️ Zero or negative seconds is not a period at all; `rateForSeconds` returns `null` and the edit is
      // rejected back to the stored value rather than storing an infinite or negative rate.
      const rate = rateForSeconds(raw, speed);
      if (rate === null) { this.sync(); return; }
      if (kind === 'pulseSeconds') cell.pulseRate = rate; else cell.wobbleRate = rate;
    }
    this.commit(`composer-${kind}`);
  }

  /** Write every breathe field and its unit label from the model. */
  private syncBreatheCells(): void {
    if (!this.model) return;
    const speed = this.model.waveSpeed;
    for (const b of this.breatheCells) {
      const cell = this.model.slots[b.slot]!.axes[b.axis]!;
      let text: string, unit: string;
      if (b.kind === 'pulseDepth' || b.kind === 'wobbleDepth') {
        const amp = b.kind === 'pulseDepth' ? cell.pulse : cell.wobble;
        const base = b.kind === 'pulseDepth' ? cell.size : cell.winding;
        const pct = breathePercent(amp, base);
        /*
         * ⚠️ **THE DISPLAY IS ROUNDED AND THE ROUNDING DOES NOT ROUND-TRIP — MEASURED BY `composercheck` §M, AND
         * THE PRECISION DOES NOT CONVERGE: 1254 of 1620 axes round-trip at 2 dp, 1362 at 4, 1388 at 6, 1504 at
         * 10** (read the figures from §M, which is their one owner). So this is a
         * VIEW and never the value: `sync()` re-derives it from `cell.pulse` every time, and `applyBreathe`
         * writes the model from the number the user typed. **Never re-derive a stored field from a display
         * string** — the same rule as the caret guard below, for the same reason: a display is lossy on purpose.
         */
        text = pct === null ? String(Number(amp.toFixed(4))) : String(Number(pct.toFixed(2)));
        unit = pct === null ? 'abs' : '%';
      } else {
        const rate = b.kind === 'pulseSeconds' ? cell.pulseRate : cell.wobbleRate;
        const secs = modulatorSeconds(rate, speed);
        // ⚠️ A rate of 0 is "never breathes", which has no period — shown as an empty field rather than as
        // `Infinity` or `0`, either of which would read as a number the user could edit toward.
        text = secs === null ? '' : String(Number(secs.toFixed(secs < 1 ? 3 : 1)));
        unit = 's';
      }
      if (b.input.value !== text) b.input.value = text;
      if (b.unit.textContent !== unit) b.unit.textContent = unit;
    }
  }

  /**
   * One label plus three numeric inputs, X/Y/Z.
   *
   * ⚠️ **THERE IS NO `integer` PARAMETER ANY MORE AND ITS ABSENCE IS THE WHOLE OF 16.13 (E104): NO FIELD ON THIS
   * ROW ROUNDS WHAT IT IS TYPED.** The winding call site passed `true`, so `Math.round` ran on every commit and a
   * typed `3.5` became `4` with no message — the shape of defect this tab exists to eliminate, arriving through
   * an input handler. `input.step` stays `1` for the winding, which keeps ±1 on the spinner arrows without
   * constraining a typed value (an `input[type=number]`'s `step` governs the arrows and validation, never the
   * stored number). ⚠️ **AND SINCE 16.15 THERE IS NO ROUNDER ANYWHERE — `Repair` is deleted, so the sentence
   * this comment used to end with (*"`Repair` is where rounding lives"*) names a control that no longer exists.
   * Do not re-add a rounding parameter here, and if a rounder is ever wanted again it needs the tie rule
   * re-derived from scratch (`Math.round(-9.5) === -9`), which died with `repairFigure`.**
   */
  private axisRow(
    slot: number, field: Cell['field'], label: string, step: number, tip: string,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-slider-row';

    const lab = document.createElement('div');
    lab.className = 'sl-slider-label';
    lab.textContent = label;
    lab.title = tip;
    row.appendChild(lab);

    for (let a = 0; a < AXES; a++) {
      const input = document.createElement('input');
      /*
       * ⚠️ **`type = 'number'`, THE FIRST IN THE LAB — every other numeric control in `src/ui` is a
       * `range`.** For `winding` this is not a style choice: the authored values span 0.5 to 8000 over a few
       * dozen distinct numbers, so a linear track cannot resolve the small end, a log track cannot land on
       * integers, and **an integer is exactly what closes the curve.** The other fields follow the same
       * control for consistency within the row, and because a size of 800 and one of 8 are both authored.
       */
      input.type = 'number';
      input.className = 'sl-composer-num';
      input.step = String(step);
      input.title = tip;
      input.setAttribute('aria-label', `${SLOT_LABELS[slot]} ${label} ${AXIS_LABELS[a]}`);
      // ⚠️ `change`, not `input`: an `input` listener fires on every keystroke, so typing "120" would commit
      // 1, then 12, then 120 — three engine writes and three history-worthy states for one edit.
      input.addEventListener('change', () => {
        if (!this.model) return;
        const raw = Number(input.value);
        if (!Number.isFinite(raw)) { this.sync(); return; }
        const cell = this.model.slots[slot]!.axes[a]!;
        // ⚠️ **VERBATIM — no `Math.round`, whatever the field.** See this method's own doc comment (16.13).
        cell[field] = raw;
        // ⚠️ **THE DERIVED READOUTS MUST BE RECOMPUTED HERE, or they describe the PREVIOUS value** —
        // invariant 25's shape in a readout: confidently wrong rather than obviously stale.
        cell.closes = closesAt(cell.winding);
        cell.effectivePhase = ((cell.phase * cell.winding) % 360 + 360) % 360;
        cell.silent = cell.size + cell.pulse === 0;
        this.commit(`composer-${field}`);
      });
      this.cells.push({ input, slot, axis: a, field });
      row.appendChild(input);
    }

    /*
     * ---- 16.16 (E107) — one button that empties this row across all three axes ----
     *
     * ⚠️ **LAST IN THE ROW AND NOT FIRST, so the three inputs stay in the same three columns they occupy on
     * every other row** — including the `Shift °` dial row and the two breathe rows, which have no button. A
     * leading button would shift one row's fields out of alignment with the rest of the slot.
     */
    row.appendChild(this.axisClearButton(slot, field, label));
    return row;
  }

  /**
   * The `Clear` control for one entry line (16.16 / E107).
   *
   * ⚠️ **IT IS ON THE SEVEN `axisRow`s ONLY — NOT ON THE `Shift °` DIAL ROW AND NOT ON THE TWO BREATHE ROWS, AND
   * THAT IS A DECISION ABOUT WRITERS RATHER THAN ABOUT LAYOUT.** The dial and the breathe fields are VIEWS of
   * fields the rows below them own (`axis.phase`, and the four modulator fields in percent and seconds), so a
   * `Clear` there would be a second writer of a field that already has one — `ratioBase`'s "two base rules is the
   * defect" shape in a different quantity. ⚠️ **And on the seconds field it would not even be defined: a period of
   * zero is not a period, which is why `rateForSeconds` REJECTS it** and why the field shows blank rather than `0`
   * at rate 0. Clearing `Pulse rate` from its own raw row is the honest way to reach "never pulses".
   */
  private axisClearButton(slot: number, field: Cell['field'], label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'sl-btn sl-composer-clear';
    // ⚠️ A glyph plus an `aria-label`, because seven of these on a slot and twenty-one on the tab cannot each
    // carry the word `Clear` without pushing the three numeric columns off the panel.
    btn.textContent = '✕';
    btn.title = TAB_TIPS['composer.clear']!;
    btn.setAttribute('aria-label', `Clear ${SLOT_LABELS[slot]} ${label} on all three axes`);
    btn.addEventListener('click', () => this.clearAxisRow(slot, field));
    return btn;
  }

  /**
   * Write 0 into one field on all three axes of one slot, and commit.
   *
   * ⚠️ **IMMEDIATE, UNCONFIRMED AND UNRECOVERABLE, BY THE OWNER'S DECISION — and the tooltip says so, because a
   * control whose whole effect is destructive owes that sentence BEFORE the click.** This tab pushes no history on
   * an edit (`commit()` deliberately bypasses `state.setWorkingPreset`, so nothing emits `preset-changed`), so a
   * `Clear` is exactly as recoverable as typing a zero — which is what it replaces. **Do not add a confirmation, a
   * `pushSnapshot` or an undo unasked;** the ask was *"the ability to clear the contents with one button"*.
   *
   * ⚠️ **THE `winding` ROW IS ALGEBRAICALLY DIFFERENT FROM THE OTHER SIX AND THE DIFFERENCE IS NOT HANDLED HERE ON
   * PURPOSE.** A winding of 0 makes the argument `(n + phase) · 0` identically zero, so no phase can shift that
   * axis and the dial must go INERT — `phaseForTarget` returns `null` there rather than writing `Infinity`. That
   * transition is re-evaluated by `paintDial` from the model on **every** `sync()`, and `commit()` ends in
   * `sync()`, so routing through the one commit path is what makes it correct. ⚠️ **A hand-written "repaint the
   * numbers" version of this method would leave a live-looking dial over a winding of zero** — which is invariant
   * 13's harder form in the direction that matters least often and confuses most: the control looks usable, the
   * write is refused, and nothing says why. **Never bypass `commit()` here.**
   *
   * ⚠️ **AND CLEARING `size` OR `pulse` CAN SILENCE THE WHOLE LEVEL, WHICH CHANGES THE ROW'S BODY AND NOT ONLY ITS
   * VALUES** (`silent` is `size + pulse === 0` per axis, and a slot is silent when all three are). A silent slot
   * renders the `empty — nothing authored here` placeholder INSTEAD of any inputs, so the body has to be rebuilt — `sync()`
   * writes into the inputs that exist and cannot remove them. **Both orders reach it and both must work, and they
   * differ**: `Size` then `Pulse` leaves the level lit BY ITS PULSE after the first click and silent after the
   * second, while `Pulse` then `Size` leaves it lit by its size after the first. Measured over the library
   * (`composercheck` §P prints its own basis — **do not do arithmetic on these figures, re-run it**): of 854 live
   * slots, **334 go silent the moment `Size` is cleared and 131 the moment `Pulse` is, so 520 survive a `Size`
   * clear and need the second click.** The rebuild is therefore conditional on the RESULT and never on the field:
   * testing `field === 'size'` would rebuild a row still lit by its pulse and miss a row silenced through `Pulse`.
   * ⚠️ **THE 520 AND THE 389 ARE TWO DIFFERENT QUESTIONS AND CONFUSING THEM IS THE EASY MISTAKE HERE, WHICH IS WHY
   * THE CHECKER PRINTS THE ONE THE CODE DEPENDS ON.** 334 / 131 / **389** partitions the 854 by which single clear
   * silences the slot (`Size` only / `Pulse` only / neither); the number this method's `if` is about is the
   * `Size`-first survivors, **520 = 131 + 389**. A comment quoting 389 as "need the second click" is off by the
   * 131 slots that carry a pulse and no size — which is exactly the row `field === 'size'` would get wrong.
   *
   * ⚠️ **THE TRANSITION IS ONE-WAY HERE, WHICH IS AN ARGUMENT ABOUT REACHABILITY AND NOT AN ASSUMPTION ABOUT THE
   * DATA.** Zeroing a field can only ever *remove* reach — except through cancellation (`size 5, pulse −5` is
   * silent, and clearing `pulse` would light it), and a silent slot shows the placeholder, so **it has no `Clear`
   * button to press.** So `silent → lit` is unreachable from this method and `lit → silent` is the only case,
   * which is why one `if` is enough. ⚠️ The library carries **0 of 3591 axes** silent by cancellation, so no
   * preset can even be loaded into that state — a `Clear`-shaped rebuild that guarded the other direction too
   * would be a branch nothing could enter.
   */
  private clearAxisRow(slot: number, field: Cell['field']): void {
    if (!this.model) return;
    const model = this.model.slots[slot]!;
    for (const cell of model.axes) {
      cell[field] = 0;
      // ⚠️ The same three derived readouts every other write site recomputes, for the same reason — omitting one
      // leaves a readout describing the PREVIOUS value, which is confidently wrong rather than obviously stale.
      cell.closes = closesAt(cell.winding);
      cell.effectivePhase = wrap360(cell.phase * cell.winding);
      cell.silent = cell.size + cell.pulse === 0;
    }
    // ⚠️ `commit()` runs `refreshDerived()` FIRST, so `model.silent` below is the post-clear value — reading it
    // before the commit would test the slot's previous state and never rebuild.
    this.commit(`composer-clear-${field}`);
    if (model.silent) this.renderSlotBody(slot);
  }

  /**
   * What the level's checkbox SHOWS — and it is not `!muted` (v8 16.17 / E108).
   *
   * ⚠️ **THIS METHOD EXISTS BECAUSE `!this.muted[slot]` RENDERED THE BOX **TICKED** OVER AN EMPTY LEVEL, WHICH MADE
   * THE ONE WAY OUT OF AN EMPTY ROW UNREACHABLE.** `refreshDerived()` normalises a mute over a silent level away
   * (a muted slot is always a lit slot), so on an empty row `muted` is `false`, so `!muted` is `true`, so the box
   * arrived already in the state the user has to move it *to* — and a checkbox that is already checked fires no
   * `change` event. The seed path was live, correct, measured over all 343 empty levels by `composercheck` §Q, and
   * **not clickable**. The replacement for `+ give it size` was inoperable on exactly the row where it is the only
   * control there is.
   *
   * ⚠️ **SO "ON" IS TWO FACTS, NOT ONE: not muted AND not empty.** An empty level cannot be on in any sense the
   * figure can honour — there is nothing for it to contribute — which is why the same `silent` flag that forbids
   * the mute must also clear the tick. **`muted` stays the owner of the SWITCH; this is the owner of the VIEW**, and
   * conflating them is what the defect was.
   *
   * ⚠️ **`CLAUDE.md` invariant 13's sharper form, arriving in a new medium: the control moved exactly the right
   * value and the OUTPUT CHANNEL could not show the result — here the channel is the checkbox's own `checked`
   * attribute, and the value it could not represent was "off because empty" versus "off because switched off".**
   * The two states share one appearance and only one of them is reachable by a click. **Read a boolean control's
   * displayed state as a THIRD quantity, never as the negation of the flag behind it.**
   */
  private levelIsOn(slot: number): boolean {
    return !this.muted[slot] && !(this.model?.slots[slot]?.silent ?? true);
  }

  /**
   * Switch one level on or off (v8 16.17 / E108) — and, when switching an EMPTY level on, seed it.
   *
   * ⚠️ **ONE CONTROL, TWO BEHAVIOURS, AND WHICH ONE RUNS IS DECIDED BY THE DATA RATHER THAN BY THE CHECKBOX'S OWN
   * STATE — that is what makes it the honest replacement for `+ give it size` rather than a second control beside
   * it.** Ticking a level that HOLDS numbers un-mutes it and nothing else; ticking one that holds nothing has to
   * put something there, because *"on"* over an empty level is a promise the figure cannot keep and the row would
   * read as a checkbox that did not take. **The seed is exactly what `+ give it size` wrote** — see below.
   *
   * ⚠️ **A SIZE ALONE IS NOT ENOUGH AND THAT IS ALGEBRA, NOT TASTE: a level with size and winding 0 draws ONE
   * POINT per axis.** The inner term is `sin((n + phase) · 0) · size`, identically 0 for every particle index, so
   * every particle lands at the same place and the level reads as broken rather than as new. So the seed writes
   * `SEED_WINDING` **wherever the winding is 0** and leaves an authored winding alone — an empty level can still
   * carry a winding, because silence is an amplitude property (`size + pulse === 0`) and never a winding one.
   *
   * ⚠️ **THE MUTE IS CLEARED *BEFORE* THE SEED AND NOT AFTER, AND THE ORDER IS LOAD-BEARING FOR ONE FRAME.**
   * `refreshDerived()` normalises a mute over an empty level away, so setting the flag first and seeding second
   * would be fine; setting it *after* `commit()` would publish one muted frame of the freshly seeded level — the
   * user's click would visibly do nothing and then work. **Set the flag, then the data, then commit once.**
   *
   * ⚠️ **SWITCHING OFF NEVER TOUCHES A NUMBER, which is the entire promise of the checkbox** (*"we want to keep
   * the content of the matrix for later editing"*). The projection happens in `commit()`; this method only owns
   * the boolean. **Do not "help" by zeroing the model here — that is `clearLevel()`, and it is irreversible.**
   *
   * ⚠️ **THE BODY IS REBUILT ONLY WHEN THE SEED RAN, and the condition is the SEED rather than the direction.** A
   * mute changes no row's body — a muted row keeps its 21 inputs, that being the point — while a seed crosses
   * empty → lit, where `renderSlotBody` swaps a placeholder for the inputs and `sync()` cannot create them.
   */
  private setLevelEnabled(slot: number, on: boolean): void {
    if (!this.model) return;
    const model = this.model.slots[slot]!;
    const seeding = on && model.silent;

    this.muted[slot] = !on;

    if (seeding) {
      for (const cell of model.axes) {
        cell.size = SEED_SIZE;
        if (cell.winding === 0) cell.winding = SEED_WINDING;
        // ⚠️ The three derived readouts, recomputed at the write site like every other writer on this tab —
        // `effectivePhase` in particular, because the winding it is a product of has just changed.
        cell.closes = closesAt(cell.winding);
        cell.effectivePhase = wrap360(cell.phase * cell.winding);
        cell.silent = cell.size + cell.pulse === 0;
      }
      /*
       * ⚠️ **THE SLOT-LEVEL FLAG MUST BE REFRESHED HERE TOO, AND OMITTING IT WOULD TRADE THE BLANK ROW FOR AN
       * EMPTY ONE — a DIFFERENT defect wearing the same fix.** `renderSlotBody` branches on `model.silent`, the
       * SLOT flag, which `refreshDerived()` owns inside `commit()`; called BEFORE the commit it would still read
       * `true` from the pre-seed state and the row would rebuild as the `empty — nothing authored here`
       * placeholder over three freshly seeded axes. **The per-axis writes above cannot stand in for it: `silent`
       * exists at two levels and this method now reads the slot one before `commit()` has recomputed it.**
       * (Invariant 11's shape — a state field a sibling path never writes — reached through an ORDER change.)
       */
      model.silent = model.axes.every(c => c.silent);
    }

    /*
     * ⚠️ **THE REBUILD MUST PRECEDE THE COMMIT, AND HAVING IT AFTERWARDS WAS A LIVE DEFECT — 21 BLANK INPUTS OVER
     * A CORRECTLY SEEDED MODEL** (found by the Phase 17 suite BY RUNNING, 2026-09-09; two failing tests, one
     * cause). `commit()` ends in `sync()`, and **`sync()` writes into the inputs that EXIST** — so with
     * `renderSlotBody` last, `sync()` filled the empty row's PLACEHOLDER, `renderSlotBody` then replaced it with
     * 21 freshly built inputs, and **nothing ever wrote a value into them.** The row read blank until an
     * unrelated edit happened to call `sync()` again.
     *
     * ⚠️ **THIS IS `renderSlotBody`'s OWN DOC COMMENT ONE LEVEL DOWN: *"`sync()` writes into the inputs that
     * exist and cannot create the ones that do not"* — the same sentence that explains why `adoptExternalFigure`
     * needs the call at all also fixes the ORDER, and the list of callers could not express it.** The ordering
     * rule is now: **build the bodies, then commit.** Data-only paths need no rebuild; a path that crosses
     * empty → lit must rebuild FIRST.
     *
     * ⚠️ **AND THE FAILURE MESSAGE ACCUSED THE WRONG MECHANISM** (*"the seed gave size but NO winding"*) — the
     * seed above demonstrably writes `SEED_WINDING`, so source reading could not settle it. **A blank numeric
     * input is not a zero and `Number('') === 0`, not `NaN`, so a NaN guard could not see it either** and every
     * downstream clause read an authored zero.
     */
    if (seeding) this.renderSlotBody(slot);
    this.commit(seeding ? 'composer-level-seed' : 'composer-level-enable');
  }

  /**
   * Empty one whole level — all seven fields on all three axes (v8 16.17 / E108).
   *
   * ⚠️ **IMMEDIATE, UNCONFIRMED AND UNRECOVERABLE, BY THE OWNER'S EXPLICIT DECISION, AND IT DESTROYS UP TO
   * TWENTY-ONE AUTHORED NUMBERS RATHER THAN THREE.** That is the one place it differs in kind from
   * `clearAxisRow`, and it is why the head's button carries the WORD `Clear` while the row buttons carry a `✕`
   * glyph: **two controls with one name and two magnitudes is the hazard, so they are named apart on purpose.**
   * The ask was *"a button `Clear` to clear the content of the whole substructure"* — no confirmation, no
   * `pushSnapshot`, no undo. **Do not add one unasked.**
   *
   * ⚠️ **IT GOES THROUGH `blankAxisCell()` AND NOT THROUGH SEVEN ASSIGNMENTS — the same argument as the model's
   * own comment there: a hand-written list would be a third enumeration of the seven stored fields, so an eighth
   * field would arrive silently un-clearable.** It also gets the three DERIVED readouts right for free
   * (`closesAt(0)` is `true`, `wrap360(0)` is `0`, `silent` is `true`), which is precisely the half the old
   * `+ give it size` handler got wrong in the other direction.
   *
   * ⚠️ **THE CELLS ARE REPLACED AND NOT MUTATED, so `this.cells`'s registered `input` elements must NOT be holding
   * a reference to a CELL — they hold `{slot, axis, field}` and re-read `this.model` on every `sync()`.** That is
   * why replacement is safe here; a registry that cached the cell object would keep writing into the old ones.
   *
   * ⚠️ **THE REBUILD IS UNCONDITIONAL, UNLIKE `clearAxisRow`'S — because this always lands empty.** Clearing one
   * field may leave the level lit by another (520 of 854 live slots survive a `Size` clear), so that method tests
   * the RESULT; there is nothing to test here. ⚠️ **And the mute goes with it: `refreshDerived()` normalises a
   * mute over an empty level away, so a level cleared while switched off comes back with its box TICKED** — which
   * is correct, and is the reason the flag is not cleared by hand here. A level that is empty is not *off*: it is
   * empty, and the two are described by two different sentences on purpose.
   */
  private clearLevel(slot: number): void {
    if (!this.model) return;
    const model = this.model.slots[slot]!;
    model.axes = [blankAxisCell(), blankAxisCell(), blankAxisCell()];
    this.commit('composer-clear-level');
    this.renderSlotBody(slot);
  }

  /*
   * ⚠️ **`simpleRow()` IS DELETED (16.15) AND ITS ONE TRANSFERABLE LESSON IS WORTH MORE THAN THE ROW WAS.** It
   * built two inputs whose `aria-label` doubled as the `data-simple` key `sync()` queried by — one string with
   * two jobs, across two methods, so a rename in one place left `sync()` matching nothing, **which reads exactly
   * like a working sync** (the field simply stops updating and no checker or `tsc` can see it). 16.12 fixed that
   * with a shared `SIMPLE_FIELD_LABELS` owner; 16.15 removes the hazard instead, because **the 21 numeric inputs
   * are registered by OBJECT REFERENCE in `this.cells`, never looked up by label.** Prefer a reference to a
   * string key for any new control on this tab.
   */

  /**
   * The per-slot readouts: whether the curve closes, the effective phase, and the winding multiple.
   *
   * ⚠️ **`effectivePhase` IS THE ONE THING NO OTHER SURFACE IN THE ENGINE CAN SHOW.** The inner expression is
   * `sin((n + phase) · fm) · am`, so the shift the engine applies is `phase × winding mod 360` — not the
   * authored degrees. Measured over the library, the two differ on most live axes and the engine **cancels a
   * nonzero authored phase to exactly 0°** on a hundred-plus of them. Without this readout, a user editing a
   * phase at winding 32 has no way to know why nothing moved.
   */
  private readoutRow(slot: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sl-composer-readout';
    row.dataset.slot = String(slot);
    row.title = TAB_TIPS['composer.readout']!;
    return row;
  }

  /*
   * ⚠️ **`tunerRow()` IS GONE (16.11 / E102) AND ITS ONE LOAD-BEARING PARAGRAPH MOVED TO `pickRatio` RATHER THAN
   * BEING DELETED WITH IT** — the gcd-versus-`min(nonzero)` derivation is the reason `applyRatio` exists, and it
   * was written here because this is where the compounding defect shipped. **Do not re-add a second ratio
   * surface;** the owner's report was that two controls wrote the same three numbers.
   */

  /*
   * ⚠️ **`buildFooter()` AND THE WHOLE `Figure-wide` SECTION ARE GONE (owner, 2026-09-10) — THE TAB HAS NO
   * `Sweep rate` CONTROL AND `waveSpeed` IS NOW DATA THE COMPOSER PRESERVES WITHOUT OFFERING.** The owner's
   * words: *"I do not understand what sweep factor is at all, why do we have it on the page?"* and then
   * *"you do not need to remove sweep rate completely, just use the default value and don't provide a control
   * for it, having a speed factor control is sufficient."*
   *
   * ⚠️ **THE REASON IS NOT TIDINESS: `waveSpeed` AND `speedFactor` MULTIPLY THE SAME ADVANCE, SO THE TAB SHIPPED
   * TWO CONTROLS OVER ONE VISIBLE QUANTITY.** `main.ts` calls `generator.update(dt * speedFactor)` and
   * `lissajous.ts` then does `pos += waveSpeed * min(dt/16.667, 6)` — the rate a user sees is the PRODUCT. Two
   * sections apart, one of them resetting the pose and the other not, they could not be told apart by looking.
   *
   * ⚠️ **AND THIS IS WHAT SETTLES 107i, BY CONSTRUCTION RATHER THAN BY ARITHMETIC.** The period readout divides
   * by `waveSpeed` alone, which was a live defect while `speedFactor` was a second reachable speed; with no
   * `Sweep rate` control the stored value is whatever the preset authored, so the readout now describes the
   * figure as authored and `speedFactor` is openly a PREVIEW multiplier over it. **The seconds are still not the
   * wall clock when Speed is off 1.0 — see `composer.speed`'s tooltip, which says so.**
   *
   * ⚠️ **WHAT MUST NOT BE "TIDIED": `model.waveSpeed` STAYS, AND SO DOES EVERY `modulatorSeconds` CALL THAT
   * PASSES IT.** Dropping the term would be right on nearly every preset and wrong by 10× on the rest
   * (invariant 10 — `composercheck` §M owns the figures), and `writeFigure` must keep round-tripping the stored
   * value or every non-0.05 preset would be silently re-timed on load. **Removing the CONTROL is not removing
   * the FIELD.**
   *
   * ⚠️ **`setWaveSpeed` ON THE CONTROLS INTERFACE IS NOW CALLED BY NOTHING IN THIS TAB AND THAT IS DELIBERATE —
   * it stays on the interface because `main.ts` owns it and a future surface may want it.** Do not delete it to
   * satisfy a dead-code scan; `deadcheck` counts FILES.
   */

  // -------------------------------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------------------------------

  /**
   * Write the model into every control and readout.
   *
   * ⚠️ **A SYNC TEST HERE ASSERTS THE NEW VALUE, NEVER THAT A VALUE SURVIVED** — the Visual FX rule, and it
   * applies for the same reason: an external preset change resyncs this whole tab by design (the owner's
   * decision), so "the handle still reads what I set" is the wrong oracle. The right one is that the input,
   * the readout and the engine agree on the value the preset now holds.
   */
  private sync(): void {
    if (!this.container) return;

    /*
     * The Region D precondition, re-evaluated on every sync.
     *
     * ⚠️ **IT MUST BE RE-READ HERE AND NOT ONLY AT `init()`, because `blend` moves from ANOTHER TAB.** Visual
     * FX owns the Attractor section, so a user can make this whole tab inert without touching it — and
     * `onExternalChange` fires on that, which is what routes back into `sync()`. A precondition evaluated once
     * would confidently describe a pipeline state that has since changed, which is invariant 25 with the
     * warning itself as the stale readout.
     *
     * ⚠️ **`getAttractorBlend()` is `main.ts`'s LIVE RESOLVED value, not `preset.generators.attractor.blend`.**
     * A second reader of the same setting resolving it its own way is invariant 17; the existing accessor
     * returns what the pipeline is actually using this frame, which is the only number a precondition may cite.
     *
     * ⚠️ **BUT `currentBlend` ALONE IS NOT THE EFFECTIVE BLEND, AND READING IT AS SUCH MADE THIS WARNING
     * ITSELF THE FALSE READOUT — found by audit, and it is invariant 25 turned on its own remedy.** With the
     * Attractor `Preset` dropdown at `Off` (`attractorIndex < 0`) `main.ts` calls `generator.setAttractor(null)`
     * and `setAttractorBlend` deliberately skips the generator (`main.ts:3807`), yet `currentBlend` still moves
     * — so a user who drags Visual FX's Blend to 1.0 with no attractor selected has a **fully live** figure and
     * would have been told this tab does nothing. **The effective blend is `index >= 0 ? blend : 0`, which is
     * exactly how `main.ts:2771` resolves it for the ribbon renderer** — so this is invariant 17's rule as
     * well: the same setting has two inputs and every reader must combine them in the same order. **No library
     * preset can reach the bad state** (measured on `composercheck`'s own basis, which it prints every run: 0
     * of 399 author `attractorBlend >= 1`, and the 40 that author a blend with `attractorIndex: -1` cap at
     * 0.6 — ⚠️ a collector that also accepts preset objects carrying no `generators.waves` counts 41, so state
     * the basis with the figure), which is precisely why only an audit could find it — the
     * state is reachable from two UI controls and from the `+`/`-` keys, never from a preset.
     */
    if (this.preconditionEl) {
      const effectiveBlend = this.controls.getAttractorIndex() >= 0 ? this.controls.getAttractorBlend() : 0;
      this.preconditionEl.style.display = effectiveBlend >= 1 ? '' : 'none';
    }

    /*
     * ---- v8 16.19 — the Framing & Timing repeat ----
     *
     * ⚠️ **BEFORE THE `!this.model` RETURN, AND THAT PLACEMENT IS THE POINT — the Region D precondition's own
     * precedent.** Every one of these seven values is ENGINE state; each exists, and is adjustable, whether or
     * not this tab holds a figure. A sync placed after the guard would leave the handles stale for exactly the
     * case where the tab has no model, which is a state `rebuildModel()` reaches whenever `workingPreset` is
     * absent.
     *
     * ⚠️ **THE HANDLE IS ONLY WRITTEN WHEN IT DISAGREES**, the same rule as `cells` and `levelToggles`: assigning
     * a range input's `value` mid-drag fights the pointer, and `sync()` runs from `commit()`, which a drag on
     * another control can reach. ⚠️ **The comparison is against the STRING the element would hold**, not against
     * the number — a range input sanitises what it is given onto its own grid, so comparing floats would report a
     * disagreement on every sync and write the handle every time.
     */
    for (const s of this.framingSliders) {
      const live = s.get();
      const pos = String(s.toPos(live));
      if (s.input.value !== pos) s.input.value = pos;
      const text = s.fmt(live);
      if (s.label.textContent !== text) s.label.textContent = text;
    }
    for (const c of this.framingChecks) {
      const next = c.get();
      if (c.input.checked !== next) c.input.checked = next;
    }
    this.syncFramingVisibility();

    /*
     * ---- v8 16.18 — the two bypass checkboxes and their shared notice ----
     *
     * ⚠️ **BEFORE THE `!this.model` RETURN for the same reason as the sliders: both flags are ENGINE state and
     * mean something with no figure loaded.** And re-read from the engine on every sync rather than trusted from
     * the DOM, because `applyPresetChange` re-neutralises engine-side with no click involved — a box left to its
     * own `checked` would be the one surface disagreeing with the picture.
     *
     * ⚠️ **`get()` IS THE BYPASS FLAG AND THE BOX PAINTS ITS NEGATION (the owner's `Apply …` polarity) — this is
     * the SECOND of exactly two `!`s, the first being at the build site.** `anyBypass` keeps the FLAG's sense, so
     * the notice is shown when something is bypassed, which is the same condition it always had.
     */
    let anyBypass = false;
    for (const t of this.bypassToggles) {
      const next = t.get();
      if (t.input.checked !== !next) t.input.checked = !next;
      if (next) anyBypass = true;
    }
    if (this.bypassNoticeEl) {
      this.bypassNoticeEl.style.display = anyBypass ? '' : 'none';
    }
    /*
     * ⚠️ **`31.C`'s BADGE IS COUNTED HERE, OFF THE SAME `get()` READS THE BOXES USE, and not off the boxes.**
     * The block above exists because `applyPresetChange` re-neutralises both flags with no click involved, so
     * a badge summed from `input.checked` would inherit whichever surface was stale. **One read of the engine,
     * three views of it: the tick, the notice and the count.**
     *
     * ⚠️ **IT COUNTS THE FLAG, SO THE `!` DOES NOT APPEAR HERE** - this is the third place the `Apply ...`
     * polarity could be inverted and the only one where the inversion would be invisible: a badge reading 2
     * over a normal load looks like a feature, not a bug.
     */
    this.setupGroup?.setCount(this.bypassToggles.reduce((n, t) => n + (t.get() ? 1 : 0), 0));

    if (!this.model) return;

    /*
     * ---- 16.17 — the level checkboxes and their one shared notice ----
     *
     * ⚠️ **THE CHECKBOXES ARE SYNCED FROM `this.muted` AND NOT LEFT TO THEIR OWN DOM STATE, because
     * `refreshDerived()` can turn a mute OFF without any click** — clearing a muted level's last size normalises
     * the flag away, and a checkbox left showing `off` over a level that is now merely empty would be the only
     * surface disagreeing with the figure. The DOM is a view of the boolean, never its owner.
     *
     * ⚠️ **`.some(Boolean)` OVER ALL THREE AND NOT PER ROW: the notice is about the FIGURE**, which is why it
     * sits above the Score rather than on a slot. One switched-off level makes every statement in it true.
     */
    /*
     * ⚠️ **`31.C`'s GATE IS APPLIED HERE AND NOWHERE ELSE, FOR THE REASON THE BLOCK ABOVE ALREADY GIVES: the DOM
     * is a view of the boolean, never its owner.** `refreshDerived()` can turn a mute off with no click — so a
     * gate hung on the checkbox's `change` listener would be correct for every click and wrong for every preset
     * load, Mixer move and `Clear`. **That is the exact defect shape the Materials tab's badge shipped with**
     * (its setters do not notify, so only the local listener ran); here the resync exists, so the gate belongs
     * in it. One loop, three views of one flag: the tick, the body and the note.
     */
    for (const t of this.levelToggles) {
      const next = this.levelIsOn(t.slot);
      if (t.input.checked !== next) t.input.checked = next;
      const off = this.muted[t.slot] === true && this.model.slots[t.slot]?.silent !== true;
      t.body.hidden = off;
      t.offNote.style.display = off ? '' : 'none';
      t.clear.style.display = off ? 'none' : '';
    }
    if (this.muteNoticeEl) {
      this.muteNoticeEl.style.display = this.muted.some(Boolean) ? '' : 'none';
    }

    for (let w = 0; w < MAX_WAVES; w++) {
      const slot = this.model.slots[w]!;

      /*
       * ⚠️ **THE TIER BUTTON'S SYNC BLOCK IS DELETED (16.15) AND IT CARRIED THE ONE RULE WORTH KEEPING: a
       * control that can REFUSE must say so BEFORE the click, or it reads as broken when it declines.** It
       * appended `slot.tierReasons` to the button's own tooltip — which is also **why §N's retired-word scan had
       * to read the MODEL and not only the copy files: a user-facing string was being assembled from
       * `tierOf`'s output.** With `tierOf` gone, that string has no producer at all.
       */
      const readout = this.container.querySelector<HTMLElement>(`.sl-composer-readout[data-slot="${w}"]`);
      if (readout) {
        if (slot.silent) {
          readout.textContent = '';
        } else {
          const open = slot.axes.filter(c => !c.closes).length;
          const shifted = slot.axes
            .map((c, a) => ({ a, c }))
            .filter(({ c }) => c.phase !== 0 && Math.abs(c.effectivePhase - (((c.phase % 360) + 360) % 360)) > 1e-9);
          const parts: string[] = [];
          /*
           * ⚠️ **`open` IS A DESCRIPTION AND NOT A WARNING (16.13), WHICH IS WHY IT SITS IN THE SAME NEUTRAL
           * READOUT AS EVERY OTHER FACT ABOUT THE SLOT.** A fractional winding is the mechanism behind the
           * library's spirograph looks; styling it as an error state would tell the user the engine is broken
           * on twelve authored axes. It names the axes so the row it points at is findable, and it is the ONLY
           * feedback a typed fraction now gets — the stepper no longer rounds it away.
           *
           * ⚠️ **The Score draws the seam, and that is the diagnostic — `drawScore` deliberately declines to
           * close the path. Do NOT extend the sweep to `k · 360` to make an open curve look closed:** that
           * would draw `open` and `closes` identically and delete this readout's own output channel.
           */
          const openAxes = slot.axes.map((c, a) => ({ a, c })).filter(({ c }) => !c.closes);
          parts.push(open === 0
            ? 'closes'
            : `open — ${openAxes.map(({ a }) => AXIS_LABELS[a]).join('/')} leave${open > 1 ? '' : 's'} a seam`);
          if (slot.windingMultiple !== null && w > 0) {
            parts.push(`×${Number(slot.windingMultiple.toFixed(4))} of ${SLOT_LABELS[0]}`);
          }
          for (const { a, c } of shifted) {
            // ⚠️ The engine's shift, not the authored one. `0°` here on a nonzero authored phase is the
            // cancellation case, and it is the single most useful thing this tab can say.
            parts.push(`${AXIS_LABELS[a]} shift ${Number(c.effectivePhase.toFixed(2))}° (not ${c.phase}°)`);
          }
          /*
           * ⚠️ **A LIT SLOT CAN STILL HAVE A SILENT *AXIS*, AND EVERY CONTROL ON THAT AXIS IS THEN INERT — this
           * is invariant 13's harder form at axis granularity, and it is MEASURED, not anticipated.** A winding
           * or a phase only reaches the screen through its own axis's amplitude, so on a slot with `reach
           * 15,25,0` the whole Z column moves exactly the value it names into a channel with nothing to show it.
           *
           * ⚠️ **THE TUNER IS WHERE IT BITES, BECAUSE ONE CLICK WRITES ALL THREE AXES — and `composercheck` §I
           * property 8 owns the partition, which it prints every run: of the inert picks over the library's lit
           * slots, the DOMINANT cause is a zero-reach axis (this readout), the rest are already that ratio (§F
           * idempotency, a feature), and a residue of about a dozen is neither and remains unexplained.**
           * ⚠️ **No count is quoted here: the partition moved when 16.6 repointed the base rule at the shared
           * gcd — MORE picks became idempotent — so a figure in this comment would have gone stale silently on a
           * change in a different file.** `Aliens DNA` slot 1 is the witness the user's own report landed on — `1:1:1` over winding
           * `25,25,0` writes a Z winding onto an axis whose amplitude is 0, so live 3D `max|delta|` is exactly
           * **0.000**. The row-level `silent` flag cannot say this: the slot is genuinely lit in X and Y.
           *
           * ⚠️ **DO NOT "FIX" THIS BY GRANTING THE AXIS A SIZE.** `giveStackedSlotsSize()` grants only to a
           * fully silent SLOT, deliberately, and per axis from the Body's own axis so a flat 2D figure stays
           * flat — a Tuner that lit Z would turn every planar preset in the library 3D from one menu click. The
           * remedy is the same as for the auto-fitting extent: **say so, and let the user decide.**
           */
          const dead = slot.axes.map((c, a) => ({ a, c })).filter(({ c }) => c.silent);
          if (dead.length > 0 && dead.length < AXES) {
            parts.push(`${dead.map(({ a }) => AXIS_LABELS[a]).join('/')} ${SILENT_AXIS_PHRASE}`);
          }
          /*
           * v8 16.20 (E111) — how long this row takes to come back round.
           *
           * ⚠️ **`slowestModulatorSeconds` IS THE OWNER AND IT IMPORTS `modulatorSeconds` RATHER THAN
           * RE-DERIVING `(360/rate)/(60·waveSpeed)`** — 16.8 already owns that conversion, and a second copy
           * that dropped `waveSpeed` would be right on 375 of 399 presets and wrong by 10× on the rest, which is
           * invariant 10's units claim arriving through a readout (`CLAUDE.md` states it and nothing else does).
           *
           * ⚠️ **AND IT PRINTS NOTHING WHERE THERE IS NO PERIOD, WHICH IS 436 OF 1197 SLOTS — not `Infinity`, not
           * `0`, not `—`.** A row with no pulse and no wobble does not repeat *slowly*, it does not repeat at all,
           * and each of the three rejected placeholders is a number or a dash the reader could take for a value.
           * This is `syncBreatheCells`' own rule for an empty seconds field, applied to prose.
           */
          const secs = slowestModulatorSeconds(slot, this.model.waveSpeed);
          if (secs !== null) parts.push(periodPhrase(secs));
          readout.textContent = parts.join(' · ');
        }
      }
    }

    for (const cell of this.cells) {
      const v = this.model.slots[cell.slot]!.axes[cell.axis]![cell.field];
      // ⚠️ Only assign when it differs: writing `input.value` while the field has focus moves the caret to
      // the end, so an unconditional sync makes typing a multi-digit number impossible.
      const next = String(v);
      if (cell.input.value !== next) cell.input.value = next;
    }

    /*
     * ⚠️ **THE `data-simple` SYNC LOOP IS DELETED (16.15) — AND IT IS THE REASON THE LOOP ABOVE IS THE WHOLE
     * SYNC NOW.** It queried two inputs per slot by a STRING key built from `SIMPLE_FIELD_LABELS`, so a
     * mismatch between the builder's `aria-label` and this query would have updated nothing while every other
     * field kept working — a partial sync, which is harder to notice than a dead one. The surviving loop walks
     * `this.cells`, holding the element itself, so no key can go stale. **Query by reference, not by label.**
     */

    /*
     * ⚠️ **THE `data-footer="waveSpeed"` SYNC-BACK IS DELETED WITH THE FOOTER (2026-09-10) — AND IT IS THE ONLY
     * PIECE OF THE REMOVAL THAT COULD HAVE BEEN LEFT BEHIND SILENTLY:** `querySelector` returns `null` for a row
     * that no longer exists, the `if (foot && …)` guard swallows it, and the tab would have kept working while
     * carrying a query for a deleted element forever. **A removal's dead READER is invisible; only enumerating
     * the sites catches it.**
     *
     * ⚠️ **THE BREATHE LABELS MUST STILL BE RE-DERIVED HERE, AND THE REASON HAS CHANGED RATHER THAN GONE AWAY.**
     * It used to be *"`waveSpeed` is an input to them and lives in the footer"*; now nothing on this tab can move
     * `waveSpeed`, but **`adoptExternalFigure()` can replace it wholesale when a different preset loads**, and
     * that path ends in `sync()`. So the labels are still derived from a number this function does not own.
     * Deriving them in `applyBreathe` alone would leave twelve labels confidently describing the PREVIOUS
     * figure's sweep rate: invariant 25 in a readout, on the one number that scales all of them.
     */
    this.syncBreatheCells();
    for (const dial of this.dials) this.paintDial(dial);
    this.paintRatioBoxes();

    this.drawScoreNow();
  }

  private drawScoreNow(): void {
    if (!this.model || this.panes.length === 0) return;
    /*
     * ⚠️ **THE WAVES COME FROM `workingPreset`, WHICH IS SAFE ONLY BECAUSE `commit()` WRITES IT FIRST.** The
     * order in `commit()` is `refreshDerived` → `growSlotCountForAuthoredContent` → `writeFigure(p, model)` →
     * `setWaves` → `sync`, so the preset the diagram reads has already received the edit *and* any slot-count
     * growth. **Reading the model instead would be equivalent here and reading it via `writeFigure` on a
     * scratch object was a fix I wrote for a cause that does not exist** — I hypothesised the pad guard made
     * the preset stale, and the call order falsifies that. Recorded because the wrong fix was plausible: if
     * `commit()`'s order is ever changed so `sync()` precedes `writeFigure`, this reader breaks silently, and
     * the diagram is the surface where "silently one edit behind" is hardest to notice.
     *
     * ⚠️ **AND IT IS NOT WHAT CAUSED THE REPORTED DIVERGENCE.** *"the main preview did adapt, but the diagram
     * above did not"* was the `time = 0` sampling below: the live figure sweeps through every instant while the
     * diagram was frozen at the one instant where every modulator is zero, so a winding change on a
     * modulator-driven axis moved the render and provably could not move the diagram. Same root cause as the
     * black `Argus` diagram, reported as two symptoms.
     */
    const waves = this.state?.workingPreset?.generators.waves ?? [];
    /*
     * ⚠️ **`computeOverlayScores` CHOOSES ITS OWN INSTANTS AND TAKES NO `time` — for the same structural reason
     * `computeScore` does not.** This tab's single canvas used to pass `0`, with a comment arguing the ghost path
     * made that safe. It did not: at `time = 0` every modulator is exactly zero, so a figure living in its
     * modulators (`Argus`) drew a BLACK diagram, and the half-period ghost was an algebraic identity that could
     * not have rescued it. Both were user-reported, from the same cause. **Do not re-add a `time` argument here
     * or to either compute function** — `composercheck` §I/§N assert both arities.
     *
     * ⚠️ **ONE `computeOverlayScores` CALL PER SUBJECT, NOT PER PANE — the three panes of a row SHARE a score
     * object and therefore share its `extent`, which is the load-bearing property of 16.9 and 16.10 alike.**
     * Calling it per pane would type-check, draw the same nine curves, and silently renormalise each pane to its
     * own contents: a slot with 110.851 model units of Z reach and none in XY would draw the same apparent size
     * in all three (invariant 29), and cyan would land exactly on white because the whole point of the size
     * extreme is that it is a *different size*.
     */
    /*
     * v8 `34.1` — the figure operators that do NOT live in `generators.waves`.
     *
     * ⚠️⚠️ **READ FROM `controls`, NOT FROM `workingPreset.overlay`, AND THE TWO ARE DIFFERENT ANSWERS.**
     * Visual FX's `Sharpness` and `Travel` write straight through `controls.setSharpness`/`setTravel` into
     * the engine, which CLAMPS and (for travel) SNAPS; `workingPreset.overlay` carries only what the preset
     * authored, so a diagram reading it would describe the figure before the dead zone and before the
     * clamp. `getSharpness()`/`getTravel()` are the engine's own post-clamp values — the same read-back
     * `32.14` made `tripletRow` perform after a snapping setter lied to the panel for a whole phase.
     *
     * ⚠️ **`halfExtent` IS A SEPARATE QUANTITY AND COMES FROM THE PRESET, NOT FROM `controls`** — `Travel`
     * is a fraction of the design HALF-extent, which the generator takes as `min(w, h) * 0.5` from
     * `metadata.designResolution`. Omitting it would be right on the 100×100 legacy bodies and silently
     * wrong on every preset authoring its own box (invariant 27).
     *
     * ⚠️ **THE RATIO THUMBNAILS DO NOT GET THIS BUNDLE** — see `computeScore`'s header for why, and for the
     * limit that decision accepts.
     *
     * ⚠️ **STATED LIMIT, NOT A DEFECT TO FIX WITH A NOTIFY: dragging Visual FX's `Sharpness` or `Travel` does
     * not repaint this diagram.** Neither setter notifies (`setSpeedFactor` has the identical limit, recorded
     * in 16.20a), so the Score picks the new value up on its next `sync()` — any Composer edit, or re-showing
     * the tab. The read is of the LIVE engine value, so it is never stale in the sense that matters; it is
     * late. **Adding a notify here would be a second owner of "a figure parameter changed".**
     */
    /*
     * v8 `34.2`/`34.3`/`34.4` — ⚠️⚠️ **FOUR OPERATORS NOW, NOT TWO, AND THE BUNDLE IS WHERE THE SCORE'S
     * AGREEMENT WITH THE ENGINE IS EITHER KEPT OR LOST.** Adding a figure operator to `overlay` is a
     * TWO-file edit — the generator and this bundle — and `composercheck` §R is what makes the second half
     * fail loudly. Phase 33 made it once and the diagram was wrong for a whole phase.
     *
     * ⚠️ **The three SHARPNESS LEVELS are passed explicitly rather than left to default**, because the
     * engine's own read-back is already backfilled: `getSharpnessLevels()` returns the three resolved values,
     * so passing them is a copy of the engine's state rather than a second resolution of `?? sharpness`.
     *
     * ⚠️ **The BREATHING depths and rates are deliberately NOT in the bundle.** `computeScore` and
     * `computeOverlayScores` take no `time` — *instantaneous amplitude is not amplitude* — and a breathing
     * operator has no value without an instant. The bases ARE the figure at `pos = 0`, which is exactly what
     * `resolveOp` returns there (`sin(0) = 0`), so the diagram shows the figure the engine draws at the
     * phase origin. **Adding depth/rate here would require choosing an instant, and `16.x`'s standing rule
     * is that the instant must never become a parameter.**
     */
    const design = this.state?.workingPreset?.metadata.designResolution;
    const sharpLevels = this.controls.getSharpnessLevels();
    const ops: WaveOps = {
      sharpness: sharpLevels[0],
      sharpnessStructure: sharpLevels[1],
      sharpnessDetail: sharpLevels[2],
      travel: this.controls.getTravel(),
      offset: this.controls.getOffset(),
      grow: this.controls.getGrow(),
      ...(design ? { halfExtent: Math.min(design.width, design.height) * 0.5 } : {}),
    };
    const byScore = new Map<number | null, ReturnType<typeof computeOverlayScores>>();
    for (const pane of this.panes) {
      if (!byScore.has(pane.slot)) byScore.set(pane.slot, computeOverlayScores(waves, pane.slot, ops));
      const score = byScore.get(pane.slot)!;
      const curves: OverlayCurves = score[pane.plane];
      drawOverlayScore(pane.canvas, curves, score.extent);
      /*
       * v8 16.20 (E111) — the caption is toggled HERE, beside the draw call, and the reason is invariant 25.
       *
       * ⚠️ **A READOUT ABOUT A DRAWING MUST BE DERIVED FROM THE SAME OBJECT THE DRAWING WAS, IN THE SAME PASS.**
       * `paneExtent(curves)` is the same predicate `drawOverlayScore` bails on, read off the same `curves`
       * reference one line later — so the caption cannot describe a previous edit's pane, and there is no early
       * return between them for it to sit on the wrong side of. Deriving it in `sync()` from the model instead
       * would type-check and be wrong on exactly the rows that matter: the model knows what is *authored*, the
       * pane knows what got *drawn*, and this caption is about the drawing.
       *
       * ⚠️ **AND IT IS SUPPRESSED ON A WHOLLY SILENT SUBJECT — `score.silent` OWNS THAT STATE AND ALREADY HAS
       * COPY** (the row reads *"empty — nothing authored here"*). Without this conjunct an empty level would grow
       * three *"flat here"* captions saying the same thing a fourth time, and 16.17's post-mortem is precisely
       * that two owners of one state is the defect.
       */
      const wantFlat = !score.silent && !(paneExtent(curves) > 0);
      const nextDisplay = wantFlat ? '' : 'none';
      if (pane.flatCap.style.display !== nextDisplay) pane.flatCap.style.display = nextDisplay;
    }

    const combined = byScore.get(null);
    if (this.extentLabel && combined) {
      const parts = [`reach ±${Number(combined.extent.toFixed(1))}`];
      // ⚠️ **AN UNDERSAMPLED DIAGRAM MUST SAY SO RATHER THAN LOOK FINE.** Above the sample ceiling a high
      // winding aliases into a different, plausible closed curve — confidently wrong, the worst failure a
      // diagnostic can have.
      if (combined.undersampled) parts.push(`winding ${combined.maxWinding} — diagram undersampled`);
      /*
       * ⚠️ **NO `faint path = breathing range` CLAUSE ANY MORE, AND ITS REMOVAL IS PART OF THE GHOST'S
       * RETIREMENT RATHER THAN A TIDY-UP.** One faint curve answered *"does anything breathe"* for two
       * independent quantities, so it could not say WHICH — which is exactly the question the owner asked
       * (*"isn't wobble the same as winding breathes?"*). The legend now names both curves by colour, so a
       * readout repeating the claim in prose would be a second, weaker owner of it.
       */
      this.extentLabel.textContent = parts.join(' · ');
    }
  }
}
