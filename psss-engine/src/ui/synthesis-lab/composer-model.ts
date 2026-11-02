/**
 * @file v8 16.1 (E92) — the LOSSLESS figure model the Composer tab reads and writes.
 *
 * ⚠️ **THIS FILE SHIPS NO UI, AND THAT IS THE POINT.** The phase's single largest risk is not the tab: it is
 * that a control set which *looks* complete silently discards a field on the way through, so opening a
 * library preset and saving it back quietly changes it. That failure is invisible to `tsc` (every field is a
 * `number`), invisible to all twelve checkers, and **invisible to a browser pass** — the figure still renders,
 * just not the one that was authored. It surfaces as a user report on a saved preset, which is the most
 * expensive place there is to find it. So the model and its harness (`checks/composercheck.mjs`) ship before
 * the tab, and the harness is calibrated against seeded defects rather than trusted.
 *
 * **The design that makes losslessness structural rather than careful.** `readFigure` carries **every field
 * of every `AxisWave` one-for-one** — nothing is fused, nothing is derived-and-discarded. The derived
 * readouts (`closes`, `effectivePhase`, `windingMultiple`, `silent`) sit BESIDE the raw cells and are
 * never the storage. `writeFigure` reads only the raw cells. So the round trip is an identity by
 * construction, and `composercheck`'s job is to prove it *can* fail — see its property 1, which seeds the
 * fusion that was proposed and rejected.
 *
 * ⚠️ **THE REJECTED DESIGN, RECORDED SO IT IS NOT RE-PROPOSED.** `PSSS_UI_extension_ideas.md` §3.1b offered
 * `reach = am.base + am.amplitude` as a single control and `twist` as the only phase control. Both are lossy
 * against the real library: `am.base` and `am.amplitude` are **both nonzero** on a large minority of audible
 * slots (two numbers cannot come back out of one), and a twist-only row cannot express an absolute X phase,
 * which the library authors on most live waves. The measured counts are in `composercheck`'s own output —
 * ⚠️ **read them from the checker, never from a figure quoted in prose.**
 *
 * ⚠️ **THERE ARE NO TIERS SINCE v8 16.15 (E106): the tab shows every one of the 21 fields on every row, and
 * this file therefore holds NO presentation state at all.** The removed pair (`tier`, `tierReasons`) was
 * carefully separated from storage so a projected row round-tripped identically — and the deletion is better
 * than the separation was, because **the projection itself was the only writer that could zero a field the user
 * never touched.** See the block above `readFigure` for what the ~200 deleted lines measured.
 */

import type { WaveConfig, AxisWave } from '../../core/interfaces.ts';
import type { UnifiedPreset } from '../../presets/types.ts';

/** `lissajous.ts`'s own limit. A fourth row would be a generator change, not a UI change. */
export const MAX_WAVES = 3;
export const AXES = 3;

/** The three slot names the tab shows, in `waves` order. Body carries the figure; Detail is the fringe. */
export const SLOT_LABELS: readonly [string, string, string] = ['Body', 'Structure', 'Detail'];
export const AXIS_LABELS: readonly [string, string, string] = ['X', 'Y', 'Z'];

/**
 * One axis of one slot, carrying **every authored number** plus the readouts derived from them.
 *
 * The raw six are `winding`/`size`/`pulse`/`pulseRate`/`wobble`/`wobbleRate` and `phase` — a 1:1 renaming of
 * `AxisWave`'s `fm.base`/`am.base`/`am.amplitude`/`am.frequency`/`fm.amplitude`/`fm.frequency`/`phase`. The
 * rename is the whole vocabulary the tab teaches, and it is deliberately not the config spelling:
 *
 * - **`winding`** (`fm.base`) — how many times the sine closes per figure. See `closes`.
 * - **`size`** (`am.base`) — this axis's radius in model units, before the canvas fit.
 * - **`pulse` @ `pulseRate`** (`am.amplitude` @ `am.frequency`) — how far and how fast the **size** moves.
 * - **`wobble` @ `wobbleRate`** (`fm.amplitude` @ `fm.frequency`) — how far and how fast the **winding** moves,
 *   in the same unit as `winding` itself (cycles per figure).
 * - **`phase`** — in degrees, **and not the shift you get.** See `effectivePhase`.
 *
 * ⚠️ **THESE SEVEN WORDS ARE THE WHOLE VOCABULARY AND NO QUANTITY MAY HAVE A SECOND ONE (v8 16.12 / E103).** The
 * tab shipped with *"the size breathes"* and *"the winding breathes"* as glosses here and as ROW LABELS in the
 * UI, beside `Pulse` and `Wobble` rows holding the same two stored fields — and the owner counted four
 * quantities where there are two: *"I am confused about wobble versus winding breathes, isn't that the same?"*
 * It is. ⚠️ **A synonym is discovered by everyone; a tooltip only by someone who already suspects the control**,
 * so no tooltip could have answered that question while both words shipped. **Do not reintroduce "breathes",
 * "amplitude", "frequency" or "AM/FM depth" as a user-facing word for any of these.**
 */
export interface AxisCell {
  winding: number;
  size: number;
  pulse: number;
  pulseRate: number;
  wobble: number;
  wobbleRate: number;
  phase: number;

  // ---- derived, never stored ----

  /**
   * ⚠️ **`winding` IS THE WINDING NUMBER, so an integer closes the curve and a non-integer leaves a seam.**
   * `lissajous.ts`'s inner line is `sin((n + phase) · fm) · am` with `n` sweeping 0→360 and
   * `fm = fm.base / DEG`, so the sine completes exactly `fm.base` cycles as the particle index runs the
   * whole figure. The library is overwhelmingly integer, with a bare handful of exceptions — ⚠️ **count them
   * from `composercheck`, not from here.** This is the badge that makes 16.5's `Drift` control mean
   * something.
   */
  closes: boolean;

  /**
   * ⚠️ **THE SHIFT THE ENGINE ACTUALLY APPLIES, AND IT IS NOT THE AUTHORED DEGREES.** The argument is
   * `(n + phase) · fm`, **not** `n · fm + phase`, so `phase` is multiplied by the winding number and the
   * effective shift is `phase × winding mod 360`. It differs from the authored value at every winding but 1,
   * and a handful of library slots author a phase the engine **cancels to exactly 0°** — which no surface in
   * the engine could show before this one.
   *
   * ⚠️ **`Sliders`' `Symmetry` has this defect today** (it snaps `phase` to multiples of 90° as though the
   * shift were absolute). Out of scope by instruction; recorded here so the Composer does not copy it.
   */
  effectivePhase: number;

  /**
   * ⚠️ **SILENCE IS AN AMPLITUDE PROPERTY AND NEVER A WINDING ONE.** A slot with `winding = 0` on every axis
   * can be the liveliest row in the preset, winding entirely through `wobble` — `Pipes`' first wave is the
   * witness. The test is `size + pulse === 0`; greying a row out on `winding === 0` would mislabel exactly
   * the rows worth looking at.
   *
   * ⚠️ **It is not an instantaneous test either.** `pulse` reaches the figure as `sin(pos · pulseRate) ·
   * pulse`, which is **0 at `pos = 0`**, so an axis with `size = 0` and `pulse ≠ 0` contributes nothing at
   * the opening instant and everything a few frames later. Step 16.0's probe learned that the expensive way:
   * a one-frame oracle read 34 correctly-driven presets as inert.
   */
  silent: boolean;
}

export interface SlotModel {
  axes: [AxisCell, AxisCell, AxisCell];
  /**
   * True when every axis is silent — the row the tab collapses to *"empty — nothing authored here"*.
   *
   * ⚠️ **THIS IS A PROPERTY OF THE FIGURE AND IT IS NOT THE TAB'S MUTE (v8 16.17 / E108) — the two produce the
   * same picture and are recorded in different places on purpose.** `silent` is what the stored numbers say; a
   * mute is a per-level checkbox living in TAB state, applied through `applyMutes` on the way out. So a muted
   * level's `silent` stays `false` — the authored numbers are still in the model and still in the inputs — while
   * the figure that reaches the preset and the engine has `silent: true` for it. **Do not conflate them and do
   * not add a `muted` field here** (see the `tier` note below: the model holds no presentation state).
   */
  silent: boolean;
  /**
   * This slot's winding as a multiple of the Body slot's, or `null` when either is 0. This is the number the
   * library's variety actually lives in — an inter-slot stack of integers, not an intra-axis ratio.
   */
  windingMultiple: number | null;
  /*
   * ⚠️ **`tier` AND `tierReasons` ARE DELETED (v8 16.15 / E106) AND NOTHING REPLACES THEM: the tab now shows
   * all 21 fields on every row, unconditionally.** Recorded here rather than dropped silently because the two
   * fields were the model's ONLY presentation-shaped members, and their removal is what makes this interface
   * purely a figure again. **Do not re-add a presentation hint to the model** — if a future collapse is
   * wanted, it is a view concern and belongs in the tab, which is the shape the owner rejected in 16.15 in
   * favour of no collapse at all.
   */
}

export interface FigureModel {
  slots: [SlotModel, SlotModel, SlotModel];
  /**
   * ⚠️ **`waves.length` AS AUTHORED, and it must survive the round trip untouched.** `lissajous.ts` pads its
   * internal table to `MAX_WAVES` because `update()` loops unconditionally; that pad is an implementation
   * detail of the generator and **writing it back would normalise every short preset to three slots.** No
   * shipped preset is short today (the migration pads too), so this is a property nothing currently
   * exercises — which is exactly why it is asserted rather than assumed, with `composercheck` seeding one-
   * and two-wave presets to prove the assertion can fail.
   */
  slotCount: number;
  particleCount: number;
  /** The figure-wide sweep rate. ⚠️ NOT `WaveConfig.speed` — see `writeFigure`. */
  waveSpeed: number;
  /**
   * ⚠️ **THE PRECONDITION THE WHOLE TAB HANGS ON.** At `attractor.blend = 1.0` the wave positions are
   * **replaced outright** in `lissajous.ts`, so every control in the Composer does nothing visible while
   * nothing about any individual control is wrong. The tab states this as **inline copy**, not a tooltip:
   * the user has no reason to suspect a particular row, so no per-row note can own it (invariant 25).
   */
  attractorBlend: number;
}

/**
 * Degrees into `[0, 360)`.
 *
 * ⚠️ **EXPORTED SINCE 16.7 because the dial and `composercheck` §L must wrap the SAME way the cells do.** Two
 * copies of a modulo convention is the shape that lets a readout and its control disagree by 360° on a
 * negative phase — and the library authors phases in the negative half routinely (the X→Y delta measured −90 on
 * most live slots), all of which go through this.
 */
export const wrap360 = (deg: number): number => {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
};

/**
 * Whether a winding closes the curve. ⚠️ **THE ONE OWNER OF THE TEST, AND IT IS EXPORTED SINCE 16.13 (E104)
 * BECAUSE THE TAB HAD THREE HAND-INLINED COPIES OF `Number.isInteger(cell.winding)`** — which is the
 * two-base-rules shape (`ratioBase`) in another quantity: four copies of one rule is how one of them stays
 * wrong. The tolerance is what makes it worth owning: an exact `Number.isInteger` reads `4.000000000000001`,
 * reachable by `applyRatio`'s own division, as an open figure.
 *
 * ⚠️ **`1e-9` IS ABSOLUTE AND THAT IS DELIBERATE AT THIS SCALE, NOT AN OVERSIGHT** — windings run to 8000, where
 * a double's spacing is ~9e-13, so absolute `1e-9` is still far tighter than any authored value. A *relative*
 * tolerance would be looser at the top of the range for no gain: nothing in the library authors a winding within
 * 1e-9 of an integer without meaning that integer. The library's twelve real fractions are `0.5` and `112.5`.
 */
export const closesAt = (winding: number): boolean =>
  Number.isFinite(winding) && Math.abs(winding - Math.round(winding)) < 1e-9;

function readAxis(ax: AxisWave): AxisCell {
  const winding = ax.fm.base ?? 0;
  const size = ax.am.base ?? 0;
  const pulse = ax.am.amplitude ?? 0;
  const phase = ax.phase ?? 0;
  return {
    winding,
    size,
    pulse,
    pulseRate: ax.am.frequency ?? 0,
    wobble: ax.fm.amplitude ?? 0,
    wobbleRate: ax.fm.frequency ?? 0,
    phase,
    closes: closesAt(winding),
    effectivePhase: wrap360(phase * winding),
    silent: size + pulse === 0,
  };
}

function writeAxis(cell: AxisCell): AxisWave {
  return {
    phase: cell.phase,
    am: { base: cell.size, amplitude: cell.pulse, frequency: cell.pulseRate },
    fm: { base: cell.winding, amplitude: cell.wobble, frequency: cell.wobbleRate },
  };
}

/**
 * A completely empty axis — every stored field 0, every derived readout consistent with it. (v8 16.17 / E108)
 *
 * ⚠️ **IT IS BUILT BY `readAxis` FROM A ZERO `AxisWave` AND NOT BY LISTING SEVEN ASSIGNMENTS, WHICH IS THE WHOLE
 * REASON IT IS WORTH A FUNCTION.** Both callers — the per-level `Clear` and the mute projection — mean *"nothing
 * authored here"*, and a hand-written `cell.winding = 0; cell.size = 0; …` version is a THIRD enumeration of the
 * seven stored fields beside `AxisCell` itself and `Cell['field']` in the tab. `CLAUDE.md`: **three enumerations
 * of one list make a missing entry structurally invisible** — an eighth stored field would be silently
 * un-clearable, and the checker would have to know to look for it. Going through the ONE reader of an `AxisWave`
 * makes the coverage a property of the type instead.
 *
 * ⚠️ **AND THE DERIVED THREE COME OUT RIGHT FOR FREE, WHICH IS THE HALF A HAND-WRITTEN CLEAR GOT WRONG.**
 * `closesAt(0)` is `true` and `wrap360(0 * 0)` is `0`; the old `+ give it size` handler set `cell.silent` by hand
 * and left `effectivePhase` describing the PREVIOUS winding (invariant 25 in a readout). Nothing here can drift,
 * because `readAxis` is the same function `readFigure` uses on every preset in the library.
 */
export const blankAxisCell = (): AxisCell => readAxis({
  phase: 0,
  am: { base: 0, amplitude: 0, frequency: 0 },
  fm: { base: 0, amplitude: 0, frequency: 0 },
});

/*
 * ═══ THE SIMPLE TIER IS DELETED (v8 16.15 / E106) — `tierOf`, `twistOf`, `SimpleRow`, `simpleOf`,
 * `applySimple` and `repairFigure` are all gone, on the owner's word. What follows is what the ~200 lines they
 * occupied actually BOUGHT, kept because every line of it was measured and none of it is recoverable from the
 * code that remains.
 *
 * ⚠️ **THE DELETION MAKES A DATA-LOSS CLASS UNREACHABLE RATHER THAN GUARDED, AND THAT IS THE ARGUMENT FOR IT.**
 * `applySimple` was the ONLY writer in this file that could zero a field the user never touched: it wrote
 * `pulse`/`pulseRate`/`wobble`/`wobbleRate` to 0 on all three axes by construction, which was correct under its
 * precondition (a slot `tierOf` called `simple`) and catastrophic one call site away from it. §J measured
 * **92 982** A→B row triples where a stale `simple` body over a `full` row would have routed the next edit
 * through it. **With no projection between a control and its stored field, no amount of stale UI state can
 * lose a modulator.** A guard that cannot be reached beats a guard that holds.
 *
 * ⚠️ **AND THE TIER WAS NOT WRONG — IT WAS UNWANTED, WHICH IS A DIFFERENT VERDICT AND THE PHASE'S HEADLINE
 * FINDING.** Its clause set was picked by measuring the library and two candidate clauses were falsified by it
 * before they shipped (a shared cross-axis size collapsed coverage to single digits; a twist-only phase row was
 * §3.1b's lossy design, caught before it reached a control). Its refusal was a feature: a row whose data
 * required `full` could not be demoted, so the control never lied. All of that was true, `verify`-green and
 * unwanted: **a control acting on the user's own data needs a better reason than "the data was inconsistent."**
 * ⚠️ **Do not re-propose a tier, an accordion or a collapse** — 63 inputs on screen is the owner's explicit
 * choice, taken over a view-only collapse that would have lost nothing.
 *
 * ⚠️ **ONE RULE HERE OUTLIVES ITS SUBJECT: A USER-FACING STRING CAN LIVE IN THE MODEL.** `tierOf` built
 * `X pulse` / `Z has a shift of its own` and they reached the screen through `tierReasons` on the tier button's
 * tooltip — so §N's retired-word scan, which read `tooltips.ts` and `tabs/composer.ts` (the two files where a
 * label is *expected* to live), was green over a live violation in this one. **Before trusting an absence
 * clause, list the files it reads and ask what writes copy outside them.** Nothing in this file emits
 * user-facing copy today; the moment something does, §N's corpus must grow with it.
 *
 * ⚠️ **AND ONE MEASUREMENT: of the live waves that fell to `full`, nearly all fell for a `pulse` or a `wobble`
 * and NONE for its Z phase alone.** `full` was the library's ordinary case throughout — which is why showing it
 * always costs less than the tier did.
 */

/**
 * Resolve a preset's wave table into the model, WITHOUT mutating it.
 *
 * ⚠️ **Reads `preset.generators` only.** No `overlay` twin — a figure with two sources would be invariant
 * 17's shape, and every one of the four `overlay` export gates would then have an opinion about it.
 */
export function readFigure(preset: UnifiedPreset): FigureModel {
  const gen = preset.generators;
  const waves = gen.waves ?? [];
  const slots: SlotModel[] = [];

  const bodyWinding = Math.max(...(waves[0]?.axes ?? []).map(a => Math.abs(a.fm.base ?? 0)), 0);

  for (let w = 0; w < MAX_WAVES; w++) {
    const wave = waves[w];
    const axes = [0, 1, 2].map(a => readAxis(
      wave?.axes[a] ?? { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } },
    )) as [AxisCell, AxisCell, AxisCell];

    const own = Math.max(...axes.map(c => Math.abs(c.winding)));
    slots.push({
      axes,
      silent: axes.every(c => c.silent),
      windingMultiple: bodyWinding > 0 && own > 0 ? own / bodyWinding : null,
    });
  }

  return {
    slots: slots as [SlotModel, SlotModel, SlotModel],
    slotCount: waves.length,
    particleCount: gen.particleCount,
    waveSpeed: gen.waveSpeed ?? 0.05,
    attractorBlend: gen.attractor?.blend ?? 0,
  };
}

/**
 * The figure as it should be WRITTEN, with every muted level emptied. (v8 16.17 / E108) **Pure — `model` is
 * never touched.**
 *
 * ⚠️ **THE MUTE IS A PROJECTION AND NOT A STATE, WHICH IS THE WHOLE DESIGN OF 16.17 AND THE REASON THIS
 * FUNCTION IS SEPARATE FROM `writeFigure`.** The owner asked for two things that sound contradictory: a level
 * that is *"temporarily turned off for the diagrams and the preview"* yet *"export however or Snapshot would
 * export them cleared"*. Both hold if — and only if — exactly one figure ever leaves this file: the muted one.
 * The tab keeps the authored numbers in its inputs (that is where the recoverability lives) and every consumer
 * — `workingPreset`, Export, Snapshot, the Mixer, the engine, the three diagrams — reads the projection. ⚠️ **So
 * there is ONE owner of what the figure IS, and the mute cannot disagree with the screen.** A mute stored in the
 * preset instead would be a second source (invariant 17), would need a `MigrationLayer` backfill and a Mixer
 * entry (*"a new `overlay` block needs a Mixer entry as well as a reader, and neither `tsc` nor any checker sees
 * the omission"*), and would resurrect a wave on a machine that never muted it.
 *
 * ⚠️ **`slotCount` IS COPIED THROUGH UNCHANGED, AND THAT IS AN IDEMPOTENCY CLAIM RATHER THAN AN OMISSION.** A
 * muted trailing slot must write **zeros in place**, never a shrink: **343 of the library's 1197 slots are
 * silent** (measured over all eight groups; ⚠️ **the `651` this line used to quote is a DIFFERENT BASIS — silent
 * AXES in the legacy JSON alone, 651 of 1593 — and pairing it with 1197 was a numerator against the wrong
 * denominator**),
 * so a silent-but-present slot is a real authored state and dropping one is a silent rewrite in the opposite
 * direction (`growSlotCountForAuthoredContent`'s whole argument). Keeping the count means muting and unmuting a
 * level returns the preset to a byte-identical figure — ⚠️ **which would NOT hold if the count were derived from
 * the projection**, because the mute would shrink it and the unmute would grow it, and any consumer that had
 * already read the short version (an export, a snapshot, a Mixer endpoint) would hold a figure with a slot
 * missing rather than a slot emptied.
 *
 * ⚠️ **`muted.length` IS NOT ASSUMED TO BE `MAX_WAVES`** — a missing entry reads as *not muted*, which is the
 * safe direction: the failure mode of the other default is a level the user never muted silently exporting
 * empty.
 */
export function applyMutes(model: FigureModel, muted: readonly boolean[]): FigureModel {
  const slots = model.slots.map((slot, w) => (muted[w]
    // ⚠️ A NEW slot object with NEW cells — sharing the cell would empty the tab's own inputs, which is the
    // one thing a mute must never do (`Clear` is the control that does that, and it is irreversible).
    ? { axes: [blankAxisCell(), blankAxisCell(), blankAxisCell()] as [AxisCell, AxisCell, AxisCell],
      silent: true, windingMultiple: null }
    : slot)) as [SlotModel, SlotModel, SlotModel];
  return { ...model, slots };
}

/**
 * Write the model back into `preset.generators`, in place. **The only writer.**
 *
 * ⚠️ **`slotCount` DECIDES HOW MANY SLOTS ARE EMITTED, and that is the pad-to-three guard.** The model
 * always holds three slots because the tab always shows three rows; the preset gets back exactly as many as
 * it authored. A version of this that emitted `MAX_WAVES` unconditionally would type-check, render
 * identically, and rewrite every short preset in the library the moment the tab opened.
 *
 * ⚠️ **`WaveConfig.speed` IS REQUIRED BY THE TYPE AND READ BY NOTHING.** `lissajous.ts`'s `init()` takes
 * `config.waveSpeed`; `setWaves()` ignores the per-wave field explicitly. So this preserves whatever was
 * there rather than inventing a value, and the tab offers **no control for it** — a control would be inert on
 * arrival (invariant 13). `waveSpeed`, the figure-wide field, is the one the footer edits.
 */
export function writeFigure(preset: UnifiedPreset, model: FigureModel): void {
  const gen = preset.generators;
  const existing = gen.waves ?? [];
  const out: WaveConfig[] = [];

  for (let w = 0; w < model.slotCount && w < MAX_WAVES; w++) {
    const slot = model.slots[w]!;
    out.push({
      speed: existing[w]?.speed ?? model.waveSpeed,
      axes: [writeAxis(slot.axes[0]), writeAxis(slot.axes[1]), writeAxis(slot.axes[2])],
    });
  }

  gen.waves = out;
  gen.particleCount = model.particleCount;
  gen.waveSpeed = model.waveSpeed;
}

/**
 * The `New Figure` seed — a lit circle.
 *
 * ⚠️ **IT MUST NOT BE `MigrationLayer.defaultWave()`, WHICH IS ALL ZEROS AND RENDERS BLACK.** A blank start
 * is a black screen with no clue which of 63 numbers ends it, and the tab's whole claim is that the figure
 * becomes legible.
 *
 * ⚠️ **EVERY VALUE HERE IS MEASURED, AND ONE OF THEM CORRECTS A UNITS ERROR IN THE PHASE PLAN.** The plan's
 * seed named `particleCount` **4000**, citing it as the library mode — but 4000 is the mode of the LEGACY
 * JSON's raw `ParticleCount` field, and `MigrationLayer` multiplies that by **5** on the way in
 * (`migration.ts`: `particleCount: (raw.ParticleCount ?? 100) * 5`). The mode of the field this seed writes
 * is therefore **20000**, and seeding 4000 would open every new figure five times sparser than the library's
 * most common density. ⚠️ **This is invariant 10 in the flesh — `tsc` sees both as `number`. Check the units
 * of the RESULT, and re-measure a figure in the unit the code stores rather than the unit a document quotes.**
 *
 * The size and twist are medians over the library's single-live-wave presets. ⚠️ **`SEED_TWIST`'s sign is
 * `phase Y − phase X`** — the convention of the deleted `twistOf` (16.15) — which is why an X phase of 90 and a
 * Y phase of 0 reads as −90, and why `seedFigure` writes `-SEED_TWIST` into X. **The constant keeps the name
 * `twist` because it is not user-facing**; `twist` is retired as a LABEL (16.12), not as an internal noun.
 * `waveSpeed` 0.05 is very nearly the whole library.
 */
export const SEED_WINDING = 1;
export const SEED_SIZE = 30;
export const SEED_TWIST = -90;
export const SEED_PARTICLE_COUNT = 20000;
export const SEED_WAVE_SPEED = 0.05;

export function seedFigure(): WaveConfig[] {
  const axis = (phase: number): AxisWave => ({
    phase,
    am: { base: SEED_SIZE, amplitude: 0, frequency: 0 },
    fm: { base: SEED_WINDING, amplitude: 0, frequency: 0 },
  });
  // X leads by 90°, Y at 0°, Z silent — the library's dominant slot-0 convention, and a circle in XY.
  return [{ speed: SEED_WAVE_SPEED, axes: [axis(-SEED_TWIST), axis(0), { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: SEED_WINDING, amplitude: 0, frequency: 0 } }] }];
}

/*
 * ⚠️ **`repairFigure` (16.4) IS DELETED (16.15) AND SO NOTHING IN THE ENGINE ROUNDS A WINDING AT ALL.** It
 * snapped every winding to its nearest integer, and it died because **its only caller in `src/` was the
 * `Repair` button** — grepped before deleting, not assumed. Three things worth keeping:
 *
 * - **What it was FOR is not solved.** The Randomiser has two closure-breaking mutations (a Gaussian on
 *   `fm.base`, and a ×0.8), and both leave a figure that can never close. `Repair` answered them without
 *   touching a shipped tab. **The honest remedy is in `randomize.ts` — the producer — and that is a behaviour
 *   change needing its own decision.** Say so rather than letting the absence read as completeness.
 * - **16.13's rule simplifies rather than disappearing.** It used to be *"`Repair` is the only rounder; do not
 *   unify it with the stepper"*; it is now the strictly simpler **nothing rounds**, which is closer to 16.13's
 *   own argument (a control must not silently change a value it was asked to display) than the pair ever was.
 * - ⚠️ **THE TIE RULE DIED WITH IT AND MUST BE RE-DERIVED IF A ROUNDER EVER RETURNS:** `Math.round(-9.5)` is
 *   **−9**, not −10, so a snap on a negative half-integer moves toward +∞. The library authors `0.5` and
 *   `112.5`; a naive round is wrong in a direction nobody would look for.
 */

/**
 * `Stack ▾` (16.4) — write ONLY the three slots' winding numbers, as multiples of the Body slot's.
 *
 * ⚠️ **IDEMPOTENT BY CONSTRUCTION, and the precedent for why that is non-negotiable is `Sliders`' `grading()`
 * — a compounding version of the same shape reached exposure ×875 in about forty events.** The multiples are
 * applied to the BODY slot's winding, never to each slot's current value, so re-applying a stack is a no-op.
 *
 * Every amplitude, phase and modulator is left alone: a stack changes the harmonic relationship between the
 * slots and nothing else. ⚠️ **The library's variety lives here — in an inter-slot stack of integers — and
 * NOT in an intra-axis X:Y:Z ratio**, which is why 16.5's Tuner is an inner control and this is a header
 * action.
 */
export function applyStack(model: FigureModel, multiples: readonly number[]): void {
  const body = model.slots[0]!;
  const bodyWinding = Math.max(...body.axes.map(c => Math.abs(c.winding)));
  if (bodyWinding === 0) return;

  for (let w = 1; w < MAX_WAVES; w++) {
    const mult = multiples[w - 1];
    if (mult === undefined) continue;
    const slot = model.slots[w]!;
    for (let a = 0; a < AXES; a++) {
      const cell = slot.axes[a]!;
      const target = bodyWinding * mult;
      cell.winding = target;
      cell.closes = closesAt(target);
      cell.effectivePhase = wrap360(cell.phase * target);
    }
  }
}

/* ---- 16.6 (E97) — the shared ratio base rule ---------------------------------------------------------- */

/**
 * The multiplier a scale-free winding ratio is applied at — **the gcd of the slot's nonzero windings.**
 *
 * ⚠️ **THIS IS A FIX TO 16.5 AS SHIPPED, NOT A NEW PREFERENCE, AND THE DEFECT IS `grading()`'s COMPOUNDING
 * SHAPE IN MINIATURE.** The Tuner used `min(|w|)` over the nonzero windings, which is **not idempotent for
 * any ratio without a `1` component**: measured directly on 16.5's own `3 : 2 : 5` entry over a `7:7:7` slot,
 * the first click gives `21:14:35` and the second **`42:28:70`** — because `min(21,14,35)` is 14, not 7. The
 * four ratios containing a `1` were idempotent only by luck, which is why nothing caught it. The gcd is
 * idempotent by construction (`gcd(base·r) = base·gcd(r)` and every ratio here is already in lowest terms) and
 * measures idempotent on **13 664 of 13 664** (live slot × tile) re-clicks — `composercheck` §K's basis, 854 live
 * slots × 16 tiles. ⚠️ **State the basis with the figure: an earlier probe of mine said 20 448 over a wider slot
 * set, and the gap is a BASIS difference, not an event.**
 *
 * ⚠️ **THE GUARD IS ALGEBRAIC: gcd is defined on integers only.** The library authors **10** non-integer
 * windings among its 854 live slots (all `0.5` or `112.5`), and `gcd(0.5, 1)` has no meaning — so a slot
 * carrying one falls back to `base = 1`, i.e. the click sets the ratio absolutely. That is honest rather than
 * approximate, and it is lossless in the sense that matters: the numeric winding row still holds the original
 * until the user commits the click.
 *
 * ⚠️ **AN ALL-ZERO SLOT ALSO RETURNS 1, and that is what makes the gallery work on a fresh figure** — the
 * same shape as `applyStack`'s `bodyWinding === 0` early return, except here returning early would make the
 * control inert on exactly the figure it exists to help author (invariant 13's harder form; `Stack` shipped
 * with that defect and it had to be fixed in the tab).
 */
export function ratioBase(axes: readonly AxisCell[]): number {
  const nonzero: number[] = [];
  for (const c of axes) {
    const v = Math.abs(c.winding);
    if (v > 0) nonzero.push(v);
  }
  if (nonzero.length === 0) return 1;
  if (!nonzero.every(v => Number.isInteger(v))) return 1;

  const gcd2 = (a: number, b: number): number => (b === 0 ? a : gcd2(b, a % b));
  return nonzero.reduce((acc, v) => gcd2(acc, v), 0) || 1;
}

/**
 * Write a scale-free winding ratio over a slot's three axes, in place, at `ratioBase()`'s multiplier.
 *
 * ⚠️ **WINDINGS ONLY — every amplitude, phase and modulator is left alone**, the same contract `applyStack`
 * carries. A gallery click that granted size would resize the authored waves of every lit preset from one
 * click, which is the mistake `Stack` made in the opposite direction (see `giveStackedSlotsSize` in the tab:
 * granting size is the TAB's decision, and only for a slot that is already silent).
 */
export function applyRatio(axes: [AxisCell, AxisCell, AxisCell], ratio: readonly [number, number, number]): void {
  const base = ratioBase(axes);
  for (let a = 0; a < AXES; a++) {
    const cell = axes[a]!;
    cell.winding = base * ratio[a]!;
    cell.closes = closesAt(cell.winding);
    cell.effectivePhase = wrap360(cell.phase * cell.winding);
  }
}

/**
 * The gallery's sixteen tiles. ⚠️ **CHOSEN FOR LEGIBILITY AS 64 px DRAWINGS, NOT FOR FREQUENCY, and the
 * measurement is what says so — `composercheck` §K owns it and prints both halves with its own basis.** On the
 * checker's 854 live slots the measured top 16 by frequency covers **757 (88.6 %)** against this set's **595
 * (69.7 %)** — but **seven** of that top 16 are `0:0:0` (the empty slot) or dense discs (`1:1:98`, `1:1:128`,
 * `1:1:594`, `1:1:625`, `21:21:32`, `32:33:0`), which as thumbnails are indistinguishable. **A gallery is a set
 * of distinguishable pictures; the numeric row below it is what owns coverage.**
 *
 * ⚠️ **THE FIGURES ARE THE CHECKER'S, AND EARLIER DRAFTS OF THIS COMMENT CARRIED TWO OTHER PAIRS FROM TWO
 * DIFFERENT PROBE BASES (`754 of 854`, then `418 of 478`).** That is why §K asserts the **trade** — that the
 * frequency-optimal set covers strictly more, and that five or more of it is undrawable — rather than either
 * number: the trade is what this design decision claims, and the numbers are what move with a basis.
 *
 * ⚠️ **TILES COLLIDE IN EVERY ONE OF THE THREE PLANES, WHICH IS WHY EVERY TILE IS LABELLED — and the counts
 * depend on the BASIS, so `composercheck` §K states its own.** Over the normalised ratio PAIR the set projects
 * to 11 distinct relationships in XY, 6 in XZ and 7 in YZ. Over the CURVES ACTUALLY DRAWN — which is what a
 * user sees, and which carries the tile figure's 90° Y phase — the checker measures **11 / 11 / 10 of 16**. The
 * two are not in conflict and neither is an event: a ratio pair can be shared by tiles whose drawn curves
 * differ, once phase is in the picture. **Read the checker's own output for a current figure.** Do not "fix"
 * the collisions by drawing three planes per tile — 48 canvases for a quick pick — and do not drop the labels,
 * which are the only thing that explains why two tiles look alike.
 */
export const RATIO_TILES: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 0], [1, 1, 1], [1, 2, 0], [2, 1, 0],
  [2, 3, 0], [3, 2, 0], [3, 4, 0], [4, 3, 0],
  [1, 1, 2], [1, 2, 3], [2, 3, 4], [1, 0, 1],
  [0, 0, 1], [1, 1, 8], [5, 4, 0], [1, 3, 0],
];

/* ---- 16.11 (E102) — the ONE ratio set: the gallery's tiles ∪ the Tuner's named ratios ----------------- */

/**
 * The Tuner's inner ratios (16.5) — X : Y : Z within a single slot, and the only source of the NICKNAMES.
 *
 * ⚠️ **THIS IS THE INNER CONTROL AND `applyStack` IS THE OUTER ONE, and conflating them was a real risk.** A
 * stack changes the relationship BETWEEN slots; a ratio changes it between the three AXES of one slot.
 * Measured, the library's variety lives overwhelmingly in the former — which is why `Stack` is a header action
 * and the ratio listbox is a per-row one, rather than the reverse.
 */
export const RATIO_NAMED: ReadonlyArray<{ name: string; ratio: readonly [number, number, number] }> = [
  { name: 'circle / sphere', ratio: [1, 1, 1] },
  { name: 'figure eight', ratio: [1, 2, 1] },
  { name: 'trefoil', ratio: [2, 3, 1] },
  { name: 'lattice', ratio: [3, 4, 1] },
  { name: 'knot', ratio: [3, 2, 5] },
];

/** One row of the merged ratio listbox (16.11): the three windings, its caption, and its optional nickname. */
export interface RatioRow {
  ratio: readonly [number, number, number];
  /** `1 : 2 : 0` — always present, always shown. A row must be nameable in a bug report. */
  text: string;
  /** `trefoil`, or `''` for the tiles that never had one. Never a substitute for `text`. */
  name: string;
}

/**
 * v8 16.11 (E102) — the ONE ratio set: `RATIO_TILES` ∪ `RATIO_NAMED`, **counted in code, never hardcoded.**
 *
 * ⚠️ **THE MERGE IS THE STEP AND THE DUPLICATION WAS CONCEALING SOMETHING.** 16.6's gallery and 16.5's Tuner
 * both wrote one slot's three windings through the same `applyRatio`, so the only difference a user could see
 * was the presentation — one looked like a *view* and one like an *edit*, which is exactly how the owner read
 * them. What the duplication hid is that the two sets **overlap in exactly one entry (`1:1:1`)**, so the tab
 * shipped **two controls offering different ratios while each claimed to be the ratio control.**
 *
 * ⚠️ **IT LIVES IN THE MODEL AND NOT IN THE TAB, SO `composercheck` §N CAN IMPORT IT RATHER THAN GREP IT.**
 * §K's predecessor read the gallery through `bodyOfTab` anchors, and when 16.11 renamed those three methods all
 * four of its source-shaped clauses failed at once while the behaviour was correct — `CLAUDE.md`'s
 * *"nine of thirteen checkers are text-pattern greps, so a behaviour-neutral rename breaks them."* A ratio is
 * three windings; windings are this file's subject. **Do not move it back into the tab.**
 *
 * ⚠️ **THE UNION'S SIZE IS A MEASUREMENT — `RATIO_ROWS.length` is its one owner.** Writing `20` anywhere would
 * go stale the moment either list moved, in the direction that still passes.
 *
 * ⚠️ **`RATIO_TILES` IS `ReadonlyArray<readonly [number, number, number]>` — BARE TUPLES, not `{ratio}`
 * objects** (a probe of mine crashed on that assumption). `RATIO_NAMED` entries are objects. The two shapes are
 * why this is a function and not a spread.
 */
export const RATIO_ROWS: ReadonlyArray<RatioRow> = (() => {
  const key = (r: readonly number[]): string => r.join(':');
  const nameOf = new Map(RATIO_NAMED.map(r => [key(r.ratio), r.name]));
  const rows: RatioRow[] = [];
  const seen = new Set<string>();
  const push = (ratio: readonly [number, number, number]): void => {
    const k = key(ratio);
    if (seen.has(k)) return;
    seen.add(k);
    rows.push({ ratio, text: ratio.join(' : '), name: nameOf.get(k) ?? '' });
  };
  // ⚠️ Tiles FIRST so the gallery's deliberately-legible ordering survives the merge; the named entries the
  // Tuner added then follow in their own order. A `Set`-based union with no fixed order would reshuffle the
  // list on any edit to either source, and a listbox whose rows move is a listbox nobody can describe.
  for (const t of RATIO_TILES) push(t);
  for (const r of RATIO_NAMED) push(r.ratio);
  return rows;
})();

/* ---- 16.7 (E98) — phase as EFFECTIVE degrees ---------------------------------------------------------- */

/**
 * Solve `wrap360(phase · winding) === target` for `phase`. `null` when no phase can reach the target.
 *
 * ⚠️ **THIS INVERTS THE PHASE'S ONE COUNTER-INTUITIVE PROPERTY: the argument is `(n + phase) · fm`, so the
 * shift the figure receives is `phase × winding` and NOT the authored degrees.** Measured exact by
 * `composercheck` §L on its own basis — the round trip `target → phase → wrap360(phase·winding)` reproduces
 * `target` in **43 656 of 43 656** (live-slot axis × 15° target) cases, worst error `5.684e-14`, because
 * `(target/w)·w` is one division and one multiplication in the same double.
 *
 * ⚠️ **`winding === 0` RETURNS `null` AND THAT IS ALGEBRA RATHER THAN A HEURISTIC.** The argument becomes
 * `(n + phase) · 0 = 0`, so phase is provably inert and `target / 0` is `Infinity` — a dial that divided
 * anyway would write `Infinity` into `generators.waves`. **Measured: 743 of 2562 axes on live slots sit at
 * winding 0**, so the refusal is a common path and not an edge case. ⚠️ **Both figures are §L's; read them
 * from the checker, and note an earlier probe of mine reported the same two quantities as `7244` and
 * `343 of 2154` on a narrower axis basis — a basis difference, not an event.**
 *
 * ⚠️ **IT DOES NOT REFUSE ON `size === 0`.** A zero-size axis is a *different* inertness, already named by
 * the row's own readout (`X/Y no size — winding inert there`); conflating the two would repeat derivation 3's
 * `FM.Base = 0` mislabelling in a new costume — those are the liveliest rows in the library when a `pulse`
 * carries them.
 */
export function phaseForTarget(targetDeg: number, winding: number): number | null {
  if (!Number.isFinite(winding) || winding === 0) return null;
  const phase = targetDeg / winding;
  return Number.isFinite(phase) ? phase : null;
}

/* ---- 16.8 (E99) — breathe in real units --------------------------------------------------------------- */

/**
 * How many `pos` units the engine advances per second of wall clock, at `waveSpeed === 1`.
 *
 * ⚠️ **THE WHOLE SECONDS DERIVATION HANGS ON THIS ONE FACTOR AND IT IS INVARIANT 10's TERRITORY.**
 * `lissajous.ts` advances `pos += waveSpeed · correction` with `correction = min(dt / 16.667, 6)`, so at 60 fps
 * `correction` is 1 and sixty of them elapse per second. **A factor of 60 out is a control that reads
 * "40 s" over a 0.67 s flicker, and `tsc` sees every term here as `number`.**
 */
export const POS_PER_SECOND = 60;

/**
 * One full modulator cycle, in seconds at the figure's current sweep rate. `null` when it never cycles.
 *
 * `modulate` is `base + sin(pos · rate / DEG) · amplitude`, so a full cycle is `360 / rate` in `pos` units,
 * and `pos` advances `POS_PER_SECOND · waveSpeed` per second — hence `(360 / rate) / (60 · waveSpeed)`.
 *
 * ⚠️ **IT DEPENDS ON `waveSpeed`, A FIGURE-WIDE FIELD NO CONTROL EDITS SINCE 2026-09-10 — AND THE DEPENDENCE IS
 * WHY THE FIELD SURVIVED THE `Sweep rate` REMOVAL.** The owner removed the CONTROL, not the field: the stored
 * value still varies across the library, so dropping the term would be right on nearly every preset and wrong by
 * 10× on the rest (invariant 10). **What changed is only WHO can move it:** previously the tab's own footer, now
 * exclusively a preset load through `adoptExternalFigure()`. The labels must therefore still be recomputed in
 * `sync()` — the arrival of a new figure is a re-label with no stored rate touched. `composercheck` §M measures
 * the library's periods spanning **0.150 s to
 * 12 000 s** — that span is the checker's own output; the quartiles that once stood here (median 40.0 s, p25
 * 17.1, p75 120) were a probe's and have no owner that re-runs, so **read the span from §M** and treat the shape
 * of the distribution as indicative only.
 */
export function modulatorSeconds(rate: number, waveSpeed: number): number | null {
  if (!Number.isFinite(rate) || rate === 0) return null;
  if (!Number.isFinite(waveSpeed) || waveSpeed === 0) return null;
  return Math.abs(360 / rate) / (POS_PER_SECOND * Math.abs(waveSpeed));
}

/**
 * A period in the ONE wording the UI has for one — *moved here from `tabs/composer.ts` by v8 Step 21.4e*, when
 * a second tab acquired a readout of the same quantity (Visual FX's `Colour Drift`). Nothing about it changed.
 *
 * ⚠️ **THE ROUNDING IS `syncBreatheCells`' ROUNDING, DELIBERATELY THE SAME EXPRESSION, because the row readout and
 * the `Pulse rate` / `Wobble rate` seconds fields describe the same quantity two rows apart.** Two conventions
 * would have the readout say `1.6 s` over a field reading `1.558` — a difference the reader has to attribute to
 * something, and there is nothing for them to attribute it to. `Number(...)` then strips a trailing `.0`, so the
 * library's long periods print `12000` rather than `12000.0`.
 *
 * ⚠️ **`repeats` is COMMENSURABILITY, and the caller must test it on the RATIO of the rates** (see
 * `slowestModulatorSeconds`, still in the Composer, and the drift readout in `visual-fx.ts`): an absolute epsilon
 * over rates spanning two orders of magnitude calls the fast end commensurate with anything. Both spellings are
 * asserted verbatim by `tests/04-preview-only-and-readouts.spec.ts`, so **neither string may be reworded here**
 * without that spec — the phrase is now shared by two tabs and a reword silently retitles both.
 */
export function periodPhrase(p: { seconds: number; repeats: boolean }): string {
  const n = Number(p.seconds.toFixed(p.seconds < 1 ? 3 : 1));
  return p.repeats ? `repeats every ${n} s` : `slowest cycle ${n} s`;
}

/** The inverse: the `rate` that makes one cycle take `seconds`. `null` when no rate can. */
export function rateForSeconds(seconds: number, waveSpeed: number): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (!Number.isFinite(waveSpeed) || waveSpeed === 0) return null;
  const rate = 360 / (seconds * POS_PER_SECOND * Math.abs(waveSpeed));
  return Number.isFinite(rate) && rate !== 0 ? rate : null;
}

/**
 * A modulator's depth as a percentage of its base — `null` when there is no base to divide by.
 *
 * ⚠️ **THE HYBRID IS FORCED BY MEASUREMENT AND IS NOT A CONVENIENCE — `composercheck` §M owns all three figures
 * below.** The library routinely authors a modulator over a **zero** base: **386 of 1132 pulsing axes have
 * `size === 0`** (their whole extent lives in the pulse — `Argus`) and **343 of 1217 wobbling axes have
 * `winding === 0`** (they wind entirely through the wobble — `Pipes` wave 0). At `base === 0`,
 * `amplitude / base` is `Infinity`, so the control shows `± N (abs)` there and `± N %` elsewhere, **and says
 * which**.
 *
 * ⚠️ **A PERCENTAGE IS NOT BOUNDED BY 100: `|amplitude| > |base|` on 436 axes**, the state where the base
 * passes through zero and the figure inverts each cycle. The field must accept it rather than clamp.
 */
export function breathePercent(amplitude: number, base: number): number | null {
  if (base === 0 || !Number.isFinite(base)) return null;
  return (amplitude / base) * 100;
}

/** The inverse of `breathePercent`. ⚠️ Only meaningful where a base exists — the caller edits absolutes at 0. */
export function amplitudeForPercent(percent: number, base: number): number | null {
  if (base === 0 || !Number.isFinite(base) || !Number.isFinite(percent)) return null;
  return (percent / 100) * base;
}
