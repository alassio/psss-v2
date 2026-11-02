/**
 * # Static-field measurement and wording — the ONE owner (v8 21.12)
 *
 * Everything the **Transmap** tab knows about how big a field is, which pattern its terms are, and how to say
 * so in a sentence. Pure: no DOM, no engine handles, `import type` for every type it names.
 *
 * ⚠️ **It exists because two presets whose warps measure 3.2 px and 2074 px present IDENTICAL panel state.**
 * 136 of the library's 154 separable-style layers sit on `(Preset)` at Strength 0.5 with Drift 0, so "this
 * slider does nothing" and "this slider works and the preset's table is nearly flat" were indistinguishable
 * from inside the UI. Every figure here is therefore a MEASUREMENT of the resolved field, never a reading of
 * the table: the identity case is not the all-zero case (`Penta Star System` carries a nonzero amplitude at
 * frequency 0, so `sin(0)·amp ≡ 0` — an exact identity from a table visibly full of numbers).
 *
 * ⚠️ **One measurement, two consumers, and that is the point.** The picture and the sentence read the SAME
 * sample grid, so the panel cannot show a drawing that disagrees with its own caption. A second grid here
 * would be a fifth copy of the field formula (`fieldcheck` §D polices four already).
 *
 * ⚠️ **`time: 0` is correct for this quantity, not a convenience.** `drift` is a RIGID TRANSLATION of the
 * field, so the peak is invariant in time: sampling a later instant moves *where* the peak is, not *what* it
 * is. That is the opposite of the Composer's readout, where the subject IS periodic and `t = 0` is the trap
 * (invariant 28) — two readouts, two different quantities. **Do not make the instant a parameter here** for the
 * same reason invariant 28 forbids it there.
 *
 * ⚠️ **Called on an edit, never per frame.** A 64×64 grid is ~4 100 evaluations of four sine terms —
 * microseconds, invisible next to the DOM work on the same events. But it is emphatically not frame work:
 * invariant 8 is about allocation RATE, and a measurement that crept into `drawFrame` would reach the user as a
 * periodic jitter rather than as a slow panel.
 */
import type { SinMagicParams, TransMapLayer, WarpShape } from '../../presets/types.ts';
import type { ResolvedStaticLayer } from '../../post-processors/static-field.ts';
import {
  STATIC_FIELD_DETAIL_MAX,
  STATIC_FIELD_DETAIL_MIN,
  STATIC_FIELD_STRENGTH_MAX,
  WARP_SHAPE_DISCONTINUOUS,
  WARP_SHAPE_LABELS,
  // ⚠️ The Y wave's baked-in quarter turn, imported rather than retyped — see `shapeNoticeKeys`' header.
  WAVE_QUARTER_TURN,
  findArchetype,
  identifyArchetype,
  resolveStaticWaves,
  staticFieldOf,
  staticOffsetAt,
} from '../../post-processors/static-field.ts';

/**
 * Grid resolution for the measurement, both axes.
 *
 * Deliberately coarse: it reports a peak to one decimal for a human deciding whether a field is worth
 * touching. **It is not the parity oracle** — `fieldcheck` §A owns exactness. 64 is also what the picture
 * draws through, and `FIELD_LINE_STRIDE` divides it exactly; changing one without the other gives the drawing
 * a different lattice from the number under it.
 */
export const FIELD_SAMPLE_N = 64;

/** Every Nth sample row/column becomes a drawn line. Must divide `FIELD_SAMPLE_N`. */
export const FIELD_LINE_STRIDE = 4;

/** The sampled field: pixel offsets on a `FIELD_SAMPLE_N²` lattice, plus the figures derived from them. */
export interface FieldMeasurement {
  /** `2 · n · n` pixel offsets, x then y per node, row-major. Consumed by the picture AND the sentence. */
  offsets: Float64Array;
  n: number;
  /** Largest displacement magnitude found, in pixels. */
  peak: number;
  /** `peak / min(width, height)` — the scale-free figure, because that is the scale the engine targets. */
  fraction: number;
  width: number;
  height: number;
  /**
   * The two 1-D profiles the term rows author, straight off the resolver.
   *
   * ⚠️ **"One value per column / per row" IS NO LONGER TRUE, AND NEITHER IS THE LENGTH (`35.3`).** At
   * `angleX = 0` `waveX` is `width` samples indexed by `x`; at any other angle it is a `hypot(w,h)`-sized
   * table indexed along the ROTATED axis, and `waveY` likewise against `angleY`. So these are *the wave
   * along its own sampling direction*, and the only length they are guaranteed to have is their own
   * `.length` — **never `width`/`height`**, which is what `field-frame-canvas.ts` used to pass.
   *
   * ⚠️ **These are NOT the displacement** — styles 1-3 multiply them by distance from the centre, and style 0
   * adds them directly. The picture draws them along the edges *as profiles* and the lattice from `offsets`;
   * drawing the lattice from these would be a fifth copy of the field formula.
   */
  waveX: Float64Array;
  waveY: Float64Array;
  /** Carried so the picture is `(canvas, model)` and needs no second source for the crosshair or the style. */
  style: number;
  cx: number;
  cy: number;
}

/**
 * Resolve the shared zoom centre in PIXELS.
 *
 * ⚠️ **A layer's own `zoomCenter` is a third state: ABSENT means inherit the preset's**, and `?? 50` at the
 * wrong level would silently centre a layer that was meant to inherit an off-centre preset.
 */
export function fieldCentre(
  layer: TransMapLayer,
  presetX: number,
  presetY: number,
  width: number,
  height: number,
): { cx: number; cy: number } {
  return {
    cx: ((layer.zoomCenter?.x ?? presetX) * width) / 100,
    cy: ((layer.zoomCenter?.y ?? presetY) * height) / 100,
  };
}

/**
 * **Measure one separable layer's field.** Null when the canvas is degenerate — a hidden tab or a zero-height
 * window during a drag is reachable, and every figure below divides by `min(w, h)`: bail rather than print NaN.
 *
 * ⚠️ **Measured through the SAME resolver the warp uses**, so Pattern, Strength, Detail, Drift and the
 * per-axis normalisation are already applied. A transcription of the field here would be the copy that drifts.
 */
export function measureStaticField(
  layer: TransMapLayer,
  table1: SinMagicParams,
  table2: SinMagicParams,
  width: number,
  height: number,
  cx: number,
  cy: number,
): FieldMeasurement | null {
  if (width < 2 || height < 2) return null;
  const waves = resolveStaticWaves(layer, table1, table2, width, height, cx, cy, 0);
  /*
   * ⚠️⚠️ **`...waves`, AND THE FOUR NAMED ARRAYS IT REPLACED WERE A ONE-TOKEN DEFECT WITH A WHOLE-PANEL
   * CONSEQUENCE (`35.4`).** `ResolvedStaticLayer.maps` is OPTIONAL and **absent means NOT ROTATED**, so
   * building this object field-by-field silently dropped `35.3`'s index mapping: `staticOffsetAt` took
   * `sampleWave`'s pre-change arm, and the picture and the sentence below described the UNROTATED field
   * while the canvas showed the rotated one. **Invariant 13's harder form** — the control moved exactly the
   * right thing and the readout could not show it — and nothing reported it, because the measurement is
   * self-consistent and `tsc` sees an optional property legitimately omitted.
   *
   * ⚠️ **The spread is also the forward-compatible shape**: a fifth key on `StaticWaves` now arrives here by
   * construction, which is the property `shapecheck` §N5b asserts of `rebuildStaticField` for the same
   * reason. `fieldcheck` §A's own hand-built oracle is the one that must keep omitting `maps` — that file is
   * UNEDITED by design (`35.D5`), and `maps` is optional precisely to let it stay so.
   */
  const L: ResolvedStaticLayer[] = [{
    style: layer.style, centreX: cx, centreY: cy, ratio: 1, ...waves,
  }];
  const n = FIELD_SAMPLE_N;
  const offsets = new Float64Array(2 * n * n);
  const out = new Float64Array(2);
  let peak = 0;
  for (let iy = 0; iy < n; iy++) {
    const y = Math.min(height - 1, Math.floor((iy * height) / n));
    for (let ix = 0; ix < n; ix++) {
      const x = Math.min(width - 1, Math.floor((ix * width) / n));
      staticOffsetAt(L, x, y, width, height, out);
      // ⚠️ The sampler's output is NORMALISED (a UV offset), so each axis scales by its OWN dimension before
      // the length is taken. Multiplying both by `min(w, h)` would understate the wider axis, and multiplying
      // the length by one scale afterwards would be wrong in a different direction on every aspect ratio
      // (invariant 26).
      const dx = (out[0] ?? 0) * width;
      const dy = (out[1] ?? 0) * height;
      const k = 2 * (iy * n + ix);
      offsets[k] = dx;
      offsets[k + 1] = dy;
      const d = Math.hypot(dx, dy);
      if (d > peak) peak = d;
    }
  }
  return {
    offsets, n, peak, fraction: peak / Math.min(width, height), width, height,
    waveX: waves.waveX, waveY: waves.waveY, style: layer.style, cx, cy,
  };
}

/**
 * One axis's live harmonics as `amp@freq`.
 *
 * ⚠️ **Zero-amplitude slots are dropped and frequency-0 terms are NOT** — a term at frequency 0 is the whole
 * explanation of the exact-identity case, and hiding it would send the reader hunting for numbers that are
 * there. `—` means the axis is genuinely silent.
 *
 * ⚠️ **`zoom` is not cosmetic: frequency 0 means OPPOSITE things in the two halves, so one rendering of it must
 * be wrong.** The shift wave is `Σ sin(θₖ)·ampₖ`, where `θₖ = 0` at frequency 0 makes the term contribute
 * nothing; the zoom wave is `Σ [bias·ampₖ + sin(θₖ)·ampₖ]` and the tables are read at a bias of 1, so there the
 * same slot is a *steady zoom* — and it is exactly the slot `carryZoomBias()` parks Zoom Bias's constant part
 * in, i.e. the one the reader is most likely to ask about. Printing it as `0.12@0` in the zoom half would name
 * the engine's own carry as the dead term the shift half's `@0` means.
 */
export function harmonics(amp: readonly number[], freq: readonly number[], zoom = false): string {
  const terms = amp
    .map((a, i) => [a, freq[i] ?? 0] as const)
    .filter(([a]) => a !== 0)
    .map(([a, f]) => {
      const n = Math.abs(a) >= 1 ? a.toFixed(a % 1 === 0 ? 0 : 2) : a.toFixed(2);
      return zoom && f === 0 ? `${n} steady` : `${n}@${f}`;
    });
  return terms.length ? terms.join(' ') : '—';
}

/* ---- the wave-shape notices and the identification clause (v8 35.4) --------------------------------- */

/**
 * **The notice set for the warp wave shape — ONE string owner for BOTH static-field editors.**
 *
 * ⚠️⚠️ **THE FIRST NOTICE IS THE WHOLE REASON THIS TABLE EXISTS.** `shapeMix: 0` AND `shape: 'sine'` are
 * **both** the identity, deliberately (`35.D2`, and `resolveShape()` says so at the branch), so **a user who
 * picks a shape and leaves the mix at 0 sees nothing at all** — `PHASE35-KEYS.md` §2.4 calls that
 * the most likely first-use confusion in the whole phase and `mixZero` is the entire remedy. **Do not
 * "fix" it by making a shape pick imply a non-zero mix**; the two fields are uncoupled on purpose and the
 * notice is what makes the uncoupling liveable.
 *
 * ⚠️ **A precondition stays INLINE rather than moving to `tooltips.ts`** (`CLAUDE.md`'s exemption), and the
 * rule that comes with that is **set the text once and toggle `display`** — never a ternary-assigned string,
 * because `tipcheck`'s `INLINE_SINK` matches a literal after `=` and ternary-assigned copy is invisible to
 * it. Each editor therefore builds **one `<p>` per key here**, with its text written once from this table,
 * and moves nothing but `display`. `tipcheck` §K is what reads these strings instead.
 *
 * ⚠️ **"Discontinuous" is read from `WARP_SHAPE_DISCONTINUOUS`, never from a second hand-typed list** — see
 * `shapeNoticeKeys()`. That is also why the two tear notices name no SHAPE: the dropdown that caused them is
 * the row directly above, and a wording that spelled out `Square` would be a second enumeration of the
 * `Record` that would silently go stale the moment a sixth shape is added.
 *
 * ⚠️ **NO PIXEL FIGURES, and that is `PHASE35-KEYS.md` §2.4's own instruction** (*"the px figures are
 * measurements and will rot — cite them with the frame size or drop the numbers and keep the warning"*).
 * They had already rotted before this row was written: the design document carries 120 px / 571 px from the
 * spec, while `35.2`'s exhaustive measurement at 1920×1080 reports a max tear of 71.0 (`square`) and 75.0
 * (`sawtooth`) over styles 0-3. **The warning is kept and the numbers are dropped**; `shapecheck` owns the
 * measurement.
 */
export type ShapeNoticeKey = 'mixZero' | 'authoredForSine' | 'tearShift' | 'tearZoom' | 'mixZero2'
  | 'axisSwap' | 'wavesParallel' | 'wavesCancel';

export const SHAPE_NOTICES: Record<ShapeNoticeKey, string> = {
  mixZero: 'Shape mix is 0, so the field is still Sine. Raise it to blend the shape in.',
  authoredForSine: 'These wave frequencies were authored for Sine, so a shape re-reads the author’s table '
    + 'rather than refining it.',
  tearShift: 'This shape is discontinuous: the warp cuts the image rather than bending it.',
  tearZoom: 'This shape is discontinuous, and a zoom style scales the cut by distance from the centre, so '
    + 'the tear grows towards the edges.',
  mixZero2: 'Zoom shape mix is 0, so the zoom half is still Sine.',
  /*
   * ---- the three ORIENTATION notices (`35.4`) ----------------------------------------------------------
   *
   * ⚠️ **They are in this table rather than in one of their own, and that is the cheap decision made
   * deliberately.** Both editors already BUILD one `<p>` per key of this `Record` and already gate them
   * through `shapeNoticeKeys()` from every path including a mid-drag one, so three keys here is three
   * paragraphs in two editors with no new build, gate or resync code — and `tipcheck` §K's partition,
   * length, sentence and set-equality clauses cover them the moment they exist. A parallel `ANGLE_NOTICES`
   * table would have been a second copy of all of that, i.e. the shape of the defect `35.4` exists to fix.
   */
  axisSwap: 'An angle at ±90° swaps that wave onto the other axis — Angle X then runs down the frame and '
    + 'Angle Y across it, so the wave repeats the other direction instead of adding a new one.',
  wavesParallel: 'The two waves are parallel, so the field is one-directional: it varies along one axis and '
    + 'is flat along the other.',
  /*
   * ⚠️⚠️ **THIS LINE IS NOT IN THE DESIGN DOCUMENT.** `PHASE35-KEYS.md` §2.4 predicts only *"the field is
   * one-directional"* for a parallel pair; `shapecheck` §N7 then MEASURED that on style 2 it is worse than
   * that — `dz = -(wx + wy)/2` cancels **analytically**, `solveGain` honestly returns 0, and the warp
   * disappears with nothing on screen saying why. `35.D2` forbids clamping or refusing the orientation, so
   * this sentence is the WHOLE of the remedy and no checker can read it.
   *
   * ⚠️⚠️ **IT NAMES THE MECHANISM AND ITS CONDITION RATHER THAN ASSERTING THE FIELD IS GONE, BECAUSE THE
   * MEASUREMENT CANNOT TELL US THAT.** The obvious stronger gate — *fire when the measured peak is 0* —
   * is unreachable: the cancellation makes `solveGain` return 0, that gain multiplies the amplitudes, and
   * the built arrays come out **all-zero**, byte-identical to a genuinely silent table (`Rose`) or to
   * Strength 0. **A guard releasing to 0 hides its own trip** (invariant 21), so from outside the engine a
   * cancelled field and a silent one are the same observation. The angle relation is the only signal that
   * survives, and the measured readout directly below says whether the field is in fact 0 px.
   */
  wavesCancel: 'This style adds the two waves together, so a parallel pair on a symmetric table cancels '
    + 'exactly — the field then measures 0 px and nothing warps at all.',
};

/**
 * Which notices belong beside the SHIFT half's rows, and which beside the ZOOM half's.
 *
 * ⚠️ **A COUNTED UNION, because a notice in neither list is a string with no reader and a notice in both is
 * a sentence the user sees twice.** `tipcheck` §K asserts the two cover `SHAPE_NOTICES` exactly, in both
 * directions — the partition is hand-written and `tsc` cannot see a gap in it. ⚠️ **`tearZoom` is in the
 * SHIFT list on purpose**: it is about a zoom *style* scaling the shift half's cut, not about the zoom
 * half's own table.
 */
/*
 * ⚠️ **All three ORIENTATION notices are in the SHIFT list, and they read `angleX`/`angleY` only.** The zoom
 * half (`angleX2`/`angleY2`) gets sliders but no notice, which is a BOUND on the notice set and is stated
 * here rather than left to be inferred from a missing key: style 3 keeps the shift half as an additive term
 * alongside `dz`, so a parallel ZOOM pair makes that half one-directional and **cannot** make the field
 * vanish. `wavesCancel`'s mechanism is style 2 alone.
 *
 * ⚠️ **No straight apostrophe may appear in a comment INSIDE either array literal.** `tipcheck` §K parses
 * the members with `/'([^']+)'/g` between the first `[` and the first `]`, so one `half's` in there invents a
 * member and reports it as a notice the `Record` does not define — a failure about the scan, in the one
 * place a reader would read it as a failure about the partition.
 */
export const SHIFT_SHAPE_NOTICES: readonly ShapeNoticeKey[] =
  ['mixZero', 'authoredForSine', 'tearShift', 'tearZoom',
    'axisSwap', 'wavesParallel', 'wavesCancel'];

export const ZOOM_SHAPE_NOTICES: readonly ShapeNoticeKey[] = ['mixZero2'];

/**
 * How close to a degenerate orientation counts, in DEGREES — `PHASE35-KEYS.md` §2.4's *"within 2°"* for both
 * of the lines it carries, and for `35.4`'s third.
 *
 * ⚠️ **It is a NOTICE threshold and nothing else.** `shapecheck` §N7c measured that the cancellation's
 * refused band has **no width in degrees at all** — 0.001° off parallel is back at the full target — so this
 * number can never be read as a tolerance the engine applies. It is the width of the band in which a user
 * who is *aiming* at parallel should be told what is about to happen; `35.D2` forbids the engine doing
 * anything about it.
 */
export const ANGLE_NOTICE_TOLERANCE_DEG = 2;

/**
 * Distance from `deg` to the nearest multiple of 180°, in degrees.
 *
 * ⚠️ **180, not 360, and that is the `(angle + 180, −amp)` identity showing up in the UI.** Two sampling
 * directions 180° apart index the same line in opposite senses, which is the same field up to the sign of
 * the amplitudes — so *parallel* and *antiparallel* are one question here, exactly as `WAVE_ANGLE_MAX`'s ±90
 * range is one copy of each distinct orientation. A `% 360` test would call an antiparallel pair
 * non-degenerate and miss half the cases `shapecheck` §N7b found flat.
 */
function degreesFrom180(deg: number): number {
  const m = ((deg % 180) + 180) % 180;
  return Math.min(m, 180 - m);
}

/**
 * **Which notices apply to one layer — the ONE predicate owner for both editors.**
 *
 * ⚠️ **The identity test is `!(mix > 0)`, not `mix === 0`, and it is `resolveShape()`'s own test verbatim.**
 * A negative or `NaN` `shapeMix` from a hand-edited import takes the engine's identity arm too, so a
 * `=== 0` here would leave `shapeMix: -1` rendering sine with nothing on screen saying why. **Two
 * enumerations of one condition is what this function exists to prevent** — if `resolveShape()` ever stops
 * being NaN-safe by shape, this test must move with it.
 *
 * ⚠️ **The tear test reads BOTH halves' shapes.** A sine shift half with a `square` zoom half on style 3
 * tears exactly as hard, and gating the warning on `shape` alone would say nothing about it — the shape of
 * `32.8`'s defect, where a mapping was computed and its result never read.
 *
 * ⚠️ **The three ORIENTATION tests read `WAVE_QUARTER_TURN`, never a literal 90, and never
 * `WAVE_ANGLE_MAX`.** The parallel question is *"is `angleY + the Y wave's baked-in quarter turn` the same
 * direction as `angleX`"*, so the number has to be the one `waveAxisMap` adds — and the range limit happens
 * to be 90 as well, which is two quantities wearing one number (see that constant's header). A hand-typed 90
 * here is the second enumeration, and the symptom would be a notice describing a geometry the sampler does
 * not index.
 *
 * ⚠️ **AND NO ARCHETYPE IS NAMED HERE.** `shapecheck` §N7b lists the archetypes whose two axes share a table
 * up to sign and therefore cancel; enumerating those seven names in this function would be the
 * `WARP_SHAPE_DISCONTINUOUS` mistake in a new field — a hand-typed list that goes stale the moment an
 * archetype is added, with the notice and the arithmetic disagreeing and nothing able to say so. The
 * `wavesCancel` wording states the CONDITION (*a symmetric table*) instead, and the measured readout
 * directly below it says whether the field is in fact 0 px.
 */
export function shapeNoticeKeys(layer: TransMapLayer): ShapeNoticeKey[] {
  const s = staticFieldOf(layer);
  const out: ShapeNoticeKey[] = [];
  const live = s.shape !== 'sine' && s.shapeMix > 0;
  const live2 = layer.style === 3 && s.shape2 !== 'sine' && s.shapeMix2 > 0;
  if (s.shape !== 'sine' && !(s.shapeMix > 0)) out.push('mixZero');
  // ⚠️ `findArchetype`, not a comparison against `(Preset)`/`(Custom)` — `resolveStaticWaves` sends
  // `(Custom)` and any unknown name from a hand-edited import down the same preset-table branch, so the two
  // literals would be a narrower enumeration of the engine's own question (the test `randomize.ts` and both
  // editors' regime gates already use).
  if (live && !findArchetype(s.pattern)) out.push('authoredForSine');
  const torn = (live && WARP_SHAPE_DISCONTINUOUS[s.shape])
    || (live2 && WARP_SHAPE_DISCONTINUOUS[s.shape2]);
  // Style 0 adds the wave as a flat pixel shift; 1-3 multiply it by distance from the centre, which is the
  // only difference between the two wordings.
  if (torn) out.push(layer.style === 0 ? 'tearShift' : 'tearZoom');
  if (layer.style === 3 && s.shape2 !== 'sine' && !(s.shapeMix2 > 0)) out.push('mixZero2');

  /*
   * ---- the orientation half (`35.4`) -------------------------------------------------------------------
   *
   * ⚠️ **NaN-SAFE BY SHAPE, exactly as `waveAxisMap` is, and the reason is the same.** Written as
   * `>= tolerance` these tests would fire on a `NaN` angle from a hand-edited import, because every `NaN`
   * comparison is false; written as `<= tolerance` a `NaN` falls to *no notice*, which agrees with the
   * engine — `waveAxisMap` sends a non-finite angle down the IDENTITY arm, so the field really is the
   * orthogonal one and there is nothing to warn about.
   */
  const tol = ANGLE_NOTICE_TOLERANCE_DEG;
  if (degreesFrom180(s.angleX - WAVE_QUARTER_TURN) <= tol
    || degreesFrom180(s.angleY - WAVE_QUARTER_TURN) <= tol) out.push('axisSwap');
  // The X wave samples along `angleX`; the Y wave along `angleY + WAVE_QUARTER_TURN`. Parallel is the two
  // being one line, which is `degreesFrom180` of their difference — see that helper for why not 360.
  const parallel = degreesFrom180(s.angleY + WAVE_QUARTER_TURN - s.angleX) <= tol;
  if (parallel) out.push('wavesParallel');
  // ⚠️ **Style 2 alone.** Its displacement is `dz = -(wx + wy)/2` with NO additive shift term, so a parallel
  // pair puts both waves on one axis and a symmetric table makes the sum identically zero. Style 0 cannot
  // (its two waves drive different output axes), style 1 cannot (each wave scales its own axis), and style 3
  // keeps `wy`/`wx` alongside `dz`. `shapecheck` §N7b measured that the flat set is exactly style 2's.
  if (parallel && layer.style === 2) out.push('wavesCancel');
  return out;
}

/**
 * **The clause that puts the wave shape into the identification line** (`35.4`, `PHASE35-KEYS.md` §12).
 *
 * ⚠️ **`identifyArchetype` identifies the TABLE and needs no change** — the shape is stored separately and
 * is not in the table. **But without this clause the line reports `Grid Lattice` for an image the author
 * sees as a square mosaic**, which is invariant 25's failure: a readout describing a state the field no
 * longer has. One comma-led clause, spliced at **all six** of `describeTermIdentity`'s return sites, so the
 * grammar is identical everywhere and a missed site is a missing clause rather than a broken sentence.
 *
 * ⚠️ **Empty while the shape is inert**, by the same `!(mix > 0)` test `shapeNoticeKeys()` uses: at mix 0
 * the picture really is the sine field the pattern names, so naming a shape there would be the opposite
 * error. `mixZero` is what covers that case.
 *
 * ⚠️ **`trackcheck` asserts this line's wordings** (`trackcheck.mjs`, which imports `describeTermIdentity`
 * and runs it over the library) — **NOT `fieldcheck` §D**, which is the GLSL-vs-TS sampler comparison. The
 * spec and an earlier plan paragraph both point at the wrong instrument.
 */
export function warpShapeClause(shape: WarpShape, mix: number, zoomHalf = false): string {
  if (shape === 'sine' || !(mix > 0)) return '';
  const m = mix < 1 ? mix : 1;
  return `, ${zoomHalf ? 'its zoom half ' : ''}warped with the ${WARP_SHAPE_LABELS[shape]} `
    + `wave shape at mix ${m.toFixed(2)}`;
}

/** `1234 px` / `3.2 px` — under 10 px the decimal is the information, above it it is noise. */
function px(v: number): string {
  return v < 10 ? v.toFixed(1) : String(Math.round(v));
}

/**
 * **The measured-field sentence.** The one place the panel says how much, and the only witness the user has.
 *
 * ⚠️ **THREE distinct causes reach a 0 px field and the message must name the RIGHT one.** An all-zero table
 * (`Rose`), a nonzero amplitude at frequency 0 (`Penta Star System`) and an archetype at Strength 0 are
 * different findings: telling someone with a flat table to look for a frequency-0 term sends them hunting for
 * nothing, and telling someone with `-0.10@0` that their table is empty contradicts what they can see in the
 * rows. So the branch is decided by MEASURING the table, never by narrating a mechanism that covers both.
 *
 * ⚠️ **THE ZOOM HALF'S SOURCE IS DECIDED BY `arch`, NOT BY `pattern2`** — read it off `resolveStaticWaves`,
 * because the two look interchangeable and are not. On the archetype branch style 3 resolves its zoom from
 * `findArchetype(s.pattern2) ?? arch`, so the preset's `sinMagicParams2` is not read AT ALL once a pattern is
 * chosen; on the `(Preset)` branch `pattern2` is ignored instead and `sinMagicParams2` is the only source.
 * Gating this clause on `pattern2` printed the preset's zoom harmonics underneath a live archetype — a readout
 * describing a table the pass never touched, exactly the failure invariant 25 names.
 */
export function describeStaticField(
  m: FieldMeasurement | null,
  layer: TransMapLayer,
  table1: SinMagicParams,
  table2: SinMagicParams,
): string {
  if (!m) return '';
  const s = staticFieldOf(layer);
  const arch = findArchetype(s.pattern);
  if (m.peak === 0) {
    // Style 3 alone reads the second table, so an identity there means BOTH halves are inert — reporting only
    // the shift half would call `Subspace` flat when its zoom half warps the frame end to end.
    const tables = layer.style === 3 ? [table1, table2] as const : [table1] as const;
    const live = tables.some(t => harmonics(t[0], t[1]) !== '—' || harmonics(t[2], t[3]) !== '—');
    const print = layer.style === 3
      // ⚠️ `zoom` true for the SECOND table only, and it is the same argument every reader of `table2` owes —
      // see `harmonics()`: frequency 0 is a steady zoom there, not a dead term.
      ? `X ${harmonics(table1[0], table1[1])} · Y ${harmonics(table1[2], table1[3])}, zoom half `
        + `X ${harmonics(table2[0], table2[1], true)} · Y ${harmonics(table2[2], table2[3], true)}`
      : `X ${harmonics(table1[0], table1[1])} · Y ${harmonics(table1[2], table1[3])}`;
    return arch
      ? 'Measured: 0 px — this layer warps nothing. Strength is 0, or the pattern resolved flat.'
      : live
        ? `Measured: 0 px — an exact identity, so this layer warps nothing at any Strength. The terms are `
          + `${print}: every live term sits at frequency 0, and sin(0) = 0 however large its amplitude. `
          + `Change a frequency below, or pick a pattern, to get a field.`
        : `Measured: 0 px — every amplitude is 0, so this layer warps nothing at any Strength. `
          + `Type an amplitude below, or pick a pattern, to get a field.`;
  }
  const source = arch
    ? `pattern “${s.pattern}”`
    : 'the terms below';
  const zoomHalf = layer.style !== 3
    ? ''
    : arch
      ? ` · zoom half pattern “${findArchetype(s.pattern2) ? s.pattern2 : s.pattern}”`
      : ` · zoom half X ${harmonics(table2[0], table2[1], true)} · Y ${harmonics(table2[2], table2[3], true)}`;
  return `Measured: peak ${px(m.peak)} px (${(m.fraction * 100).toFixed(1)}% of the frame’s short side) `
    + `at ${m.width}×${m.height}, from ${source}${zoomHalf}.`;
}

/**
 * **The identification line: which pattern these terms ARE, and whether the Strength track can reach them.**
 * (21.12 §D, and the owner's "both" answer to 21.13.)
 *
 * ⚠️ **The required Strength is MEASURED, never derived from `identifyArchetype().scale`.** That scale lives in
 * the stored table's own units, which say nothing about pixels: the archetype branch's own scalar comes from
 * `solveGain()` at the live canvas size and is canvas-DEPENDENT (measured 1.54× between 16:9 and 1:1). So the
 * ratio is taken between two fields resolved AT THE SAME FRAME SIZE — the honest question ("what would I have
 * to set") answered the only way it can be.
 *
 * ⚠️ **It states the out-of-range case rather than implying parity, and the threshold is
 * `STATIC_FIELD_STRENGTH_MAX`, formatted, never a hand-typed number.** A line that named the pattern and
 * stopped would read as "switch to this and you are done" for the half of the library that needs more than
 * Strength 1 — **measured over the composed library 2026-09-25: 113 of 139 bodies fit inside 1, and the worst
 * needs 12.20 at 16:9** (14.89 at its worst canvas shape). ⚠️ **Since the ceiling went to 16 that tail is
 * REACHABLE**, so the sentence's job changed from "the terms below carry it" to naming a number the user can
 * actually set; the figures and the basis live in `STATIC_FIELD_STRENGTH_MAX`'s note and are not restated here.
 *
 * ⚠️ **Style 3 gets a shape answer and NO Strength answer, and that is not laziness.** Its zoom half resolves
 * from `pattern2` on the archetype branch, so there is no way to hold it fixed while measuring the shift half's
 * ratio; and `zoomBias` is read on that branch and ignored here, so the two regimes are not the same field
 * anyway (defect §J). Claiming a number would be claiming a round trip that does not exist.
 */
export function describeTermIdentity(
  layer: TransMapLayer,
  table1: SinMagicParams,
  table2: SinMagicParams,
  width: number,
  height: number,
  cx: number,
  cy: number,
): string {
  const s = staticFieldOf(layer);
  /*
   * ⚠️ **SIX RETURN SITES, AND EVERY ONE OF THEM TAKES THE SHAPE CLAUSE** (`35.4`): the archetype branch, the
   * no-match branch, the style-3 branch, the degenerate-peak branch and the two arms of the final ternary.
   * Four of the six are reached through the `shape` local below; the first two each splice it themselves.
   * **A missed site is a preset whose line names a pattern and not the image** — and a text scan cannot see
   * it, which is why `trackcheck` runs the real function over the library.
   */
  const warp = warpShapeClause(s.shape, s.shapeMix);
  /*
   * ⚠️ **THE ARCHETYPE BRANCH NO LONGER SAYS THE TERMS ARE UNUSED, because since the 2026-09-22 commission they
   * ARE what is on screen** — the rows show `bakeStaticField()`'s solved terms, so the old wording ("these terms
   * are not what you are seeing") became the exact opposite of the truth while every figure around it stayed
   * right. **A readout describing a state the UI no longer has is invariant 25's failure**, and no checker can
   * see it: the sentence is a string, and the rows it describes are built in another file.
   *
   * ⚠️ **It states the SIZE's dependence on the window rather than offering a conversion**, because the
   * conversion now happens by itself when a box is typed in. The preset's own stored terms are still there and
   * still untouched — saying so is what stops "typing here destroys my preset" being the reader's conclusion.
   */
  if (findArchetype(s.pattern)) {
    return `These terms are pattern “${s.pattern}” solved at ${width}×${height}${warp} — they are the field `
      + `you are seeing, not the preset’s stored ones, which are kept and come back when you set Pattern to (Preset). `
      + `Typing in any box makes these numbers yours at this window size; a pattern re-solves its size on every `
      + `canvas and terms do not.`;
  }
  const ident = identifyArchetype(table1);
  if (!ident) {
    return `No pattern reproduces these terms${warp} — this field exists only as numbers. `
      + 'Picking a pattern would replace it, not refine it.';
  }
  const detail = `Detail ${ident.detail.toFixed(ident.detail % 1 === 0 ? 0 : 3)}`;
  /*
   * ⚠️ **The quoted `Detail` can be one the Detail slider cannot reach, and saying so is the same answer the
   * owner gave for Strength** (21.13: state the out-of-range case rather than imply parity). `identifyArchetype`
   * returns a continuous RATIO of frequencies; the slider is a bounded grid. Measured over the COMPOSED library
   * the STEP covers every ratio that occurs and the RANGE does not — **the figure and the basis live in
   * `STATIC_FIELD_DETAIL_MIN`'s note and in `trackcheck` §M, and are deliberately not restated here**, because
   * the legacy JSON and the composed library give different counts and a second copy is how they get reconciled
   * by a reader who should not. That note also owns the decision not to widen the track for the 12.5× tail.
   *
   * ⚠️ **Bounds only, never the step.** A ratio off the 0.05 grid would land on a neighbouring stop and produce
   * a visibly similar field, so warning about it would be noise; a ratio outside the range cannot be set AT ALL
   * and the user would be left with whatever `Detail` happened to be stored. The two halves of *Slider tracks*'
   * rule get different treatment because they have different consequences.
   */
  const reach = ident.detail < STATIC_FIELD_DETAIL_MIN || ident.detail > STATIC_FIELD_DETAIL_MAX
    ? ` ⚠️ The Detail slider only reaches ${STATIC_FIELD_DETAIL_MIN} to ${STATIC_FIELD_DETAIL_MAX}, so this one `
      + 'cannot be set — picking the pattern would give a different field, and the terms below are the only '
      + 'place this one exists.'
    : '';
  /*
   * ⚠️ **THE SIGN COMES FROM `ident.scale` AND CANNOT COME FROM THE MEASUREMENT** (2026-09-22, the owner's
   * *"allow Strength to go negative"*). `measureStaticField` returns a PEAK, which is a magnitude, so the ratio
   * below is positive whatever the field does — an inverted match would otherwise print a positive Strength that
   * produces the mirror image, and nothing in the panel could show the difference. **This is invariant 13's
   * harder half: the control moves the right thing and the output channel cannot report the result.**
   *
   * ⚠️ **The inversion is SAID as well as signed, and it is attached to `shape` rather than to the Strength
   * sentence — so it reaches all four return sites**, including style 3 and the degenerate-peak one, which quote
   * no Strength at all. A reader who sees only "needs Strength −1.37" would take the minus for a formatting
   * artefact; a reader on the style-3 branch would never see a sign at all.
   */
  const inverted = ident.scale < 0;
  const invert = inverted
    ? ', INVERTED — the same shape with every offset pointing the opposite way, which is what the negative half '
      + 'of the Strength track is for'
    : '';
  // ⚠️ **`warp` rides on `shape`, which is what reaches the remaining FOUR return sites in one place** —
  // the same reason `invert` is attached here rather than to the Strength sentence (see its note above).
  const shape = `These terms are “${ident.archetype.name}” at ${detail}${invert}${warp}`;
  if (layer.style === 3) {
    // ⚠️ The ZOOM half's shape is named HERE and nowhere else, because this is the only branch whose sentence
    // is about the two halves at all. `shape2`/`shapeMix2` drive `buildZoomWave`, a SEPARATE function, so a
    // style-3 layer really can carry two different shapes.
    return `${shape} — the shift half only${warpShapeClause(s.shape2, s.shapeMix2, true)}. The zoom half `
      + `has terms of its own, and Zoom Bias is read on a pattern but ignored here, so there is no exact `
      + `way back.${reach}`;
  }
  const here = measureStaticField(layer, table1, table2, width, height, cx, cy);
  // ⚠️ `strength: 1` is the UNIT probe, not the strength the user would get: picking a pattern leaves the
  // stored `strength` alone, so the "would give" ratio has to put it back. Two figures, one probe — quoting the
  // unit peak as what the user would see is the near-miss.
  const probe: TransMapLayer = {
    ...layer,
    staticField: { ...s, pattern: ident.archetype.name, detail: ident.detail, strength: 1 },
  };
  const unit = measureStaticField(probe, table1, table2, width, height, cx, cy);
  if (!here || !unit || unit.peak === 0 || here.peak === 0) return `${shape}.${reach}`;
  // ⚠️ **The MAGNITUDE is measured and the SIGN is carried** — two quantities, one number, and the bound below
  // is compared against `Math.abs`. The track is symmetric (`STATIC_FIELD_STRENGTH_MIN === -MAX`), so ONE
  // threshold still owns both ends; testing `needed <= max` against a signed value would call every inverted
  // match "within range" no matter how large it is.
  const needed = (here.peak / unit.peak) * (inverted ? -1 : 1);
  // ⚠️ **`wouldGive` takes the SAME sign flip, and for a different reason than `needed`.** It answers "what
  // would picking the pattern do to what I have": on an inverted match the pattern draws the OPPOSITE field, so
  // the honest ratio is negative — and if the stored `strength` is itself negative the two flips cancel and it
  // comes back positive, which is the case where picking the pattern really does reproduce the picture.
  const wouldGive = ((unit.peak * s.strength) / here.peak) * (inverted ? -1 : 1);
  const max = STATIC_FIELD_STRENGTH_MAX;
  /*
   * ⚠️ **`max` is printed with the file's own adaptive precision** (`detail` above does the same), because
   * 2026-09-25 took the bound to a whole number and a hard `toFixed(2)` would print "±16.00" — two decimals of
   * nothing, on the one figure in this sentence that is a LIMIT rather than a measurement. The `needed` and
   * `wouldGive` figures keep two decimals unconditionally: those are measured, they are what the user types, and
   * `trackcheck` §M pins that precision against the track's value grid.
   *
   * ⚠️ **The out-of-range branch has been LIBRARY-UNREACHABLE since the widening, and it stays.** Measured over
   * the composed library: 139 of 139 bodies with a Strength answer now fall inside ±16, so no shipped preset can
   * make this branch fire — which is why `trackcheck` §M deliberately has NO clause asserting that it does
   * (*CLAUDE.md*: an unreachable assertion is worse than a missing one). It is still reachable from a
   * hand-edited term table, which can hold any amplitude at all, and that is the case it exists for.
   */
  const maxTxt = max.toFixed(max % 1 === 0 ? 0 : 2);
  return Math.abs(needed) <= max
    ? `${shape}. Picking it would give ${wouldGive.toFixed(2)}× this field — within range `
      + `(Strength ±${maxTxt} = ${px(max * unit.peak)} px here, and ${needed.toFixed(2)} matches it).${reach}`
    : `${shape}. Picking it would give ${wouldGive.toFixed(2)}× this field; matching it needs Strength `
      + `${needed.toFixed(2)}, beyond the ${inverted ? 'minimum of −' : 'maximum of '}${maxTxt} `
      + `(${px(max * unit.peak)} px here) — the terms below carry it.${reach}`;
}
