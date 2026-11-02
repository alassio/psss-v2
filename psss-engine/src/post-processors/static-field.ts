import { triBasis } from '../core/wave-law.ts';
import type { SinMagicParams, StaticFieldConfig, TransMapLayer, WarpShape } from '../presets/types.ts';

/**
 * The STATIC FIELD archetype library — how styles 0-3 get their `sinMagicParams` when the preset's own
 * table is not what you want.
 *
 * ## The problem this exists to solve
 *
 * Before this module, `sinMagicParams` reached the engine at exactly two sites (`main.ts`'s
 * `initTransMap` and `grid-tile-renderer.ts`), read straight off `postProcessors.transMap`, with no
 * getter, no setter and no UI. So selecting a style 0-3 from the Visual FX tab applied **the current
 * preset's table under a different formula**, and there are two ways that goes wrong:
 *
 * 1. **The resolved field is identically zero** — then `wX`/`wY` vanish and the warp is an EXACT identity
 *    (verified: max |offset| = 0 px for all four styles), so the style silently does nothing at all. 12 of the
 *    13 engine TS presets and **2 of the 177 legacy ones** (`Rose`, `Penta Star System`) are in this state,
 *    measured as the peak of the resolved offset at 1920x1080.
 *
 *    ⚠️ **"An all-zero table" is a DIFFERENT predicate and it is the wrong one — it disagrees in both
 *    directions.** Three legacy presets have an all-zero `sinMagicParams` and only ONE of them is inert:
 *    `Subspace` and `The Real Black Hole` are style 3, which composes a shift with a zoom, and their live
 *    `sinMagicParams2` warps the frame end to end (`Subspace` peaks at 1138 px). Meanwhile `Penta Star System`
 *    is an exact identity with no zeros at all — its X and Y rows carry amplitude -0.10 at **frequency 0**, and
 *    `sin(0) · amp ≡ 0`. So a table full of numbers can be inert and a table full of zeros can warp: **measure
 *    the field, never scan the table.** `fieldcheck` §A5 asserts exactly this (its own basis filter carried the
 *    defect), and the panel's field readout measures a peak for the same reason.
 * 2. **The table was authored for a different style** — and the four formulas do not share units. Style 0
 *    scales amplitudes by `min(w,h)/100` and adds them as PIXELS; styles 1-3 use the raw value as a ZOOM
 *    DELTA. To reach the same 48 px displacement at 800x600 needs amplitude 5.58 for style 0 and 0.105 for
 *    style 1 — a **53x** ratio. So 59 of the 119 nonzero style-0 tables produce a NEGATIVE zoom under style
 *    1 (`Meditation` spans [-42, +44]), which mirrors, then `rollToRange` folds it back: visual noise.
 *
 * That is invariant 10 in structural form — every one of those numbers is a `number` to `tsc`.
 *
 * ## The fix: separate SHAPE from MAGNITUDE
 *
 * An archetype stores **shape only** — relative harmonic amplitudes and frequency ratios. Magnitude comes
 * from a normalised `strength` (0..1) that is converted to per-style amplitudes at runtime by
 * `solveGain()`, so one slider means the same visible amount of warp in every style.
 *
 * ⚠️ **There are deliberately NO pinned calibration constants in this file.** An earlier draft solved a
 * per-style `AMP_SCALE` (5.5846 / 0.1048 / 33.5073) against a reference archetype and hard-coded them.
 * That was rejected: the constants were only correct for the archetype they were solved against (the
 * measured spread across the 8 archetypes was 3.7%-8.1% of `min(w,h)`, i.e. "strength 1.0" meant half as
 * much warp on `Interference` as on `Grid Lattice`), they were not resolution-independent (7.9% at 800x600
 * became 9.7% at 1080p for the zoom styles), and any new archetype would have silently mis-scaled. They
 * would also have been exactly the kind of pinned constant that CLAUDE.md warns invalidates every derived
 * value when touched. `solveGain()` derives the gain from the wave arrays instead, which are built anyway.
 *
 * Measured with `solveGain()`, across all 8 archetypes x styles 0-3 x {800x600, 1920x1080, 1000x1000}:
 *
 *   worst deviation from the 8% target ... 0.17 percentage points
 *   strength linearity ................... 0.05 pp (0.1 -> 0.83%, 1.0 -> 8.05%)
 *   drift invariance ..................... 0.26 pp (phase 0 -> pi)
 *   detail invariance .................... 0.29 pp (detail 0.5 -> 16)
 *   cost ................................. 0.816 ms at 1920x1080, on CHAIN CHANGE only
 *
 * ## Where the archetypes come from
 *
 * Not invented — distilled from the 177 legacy tables. Clustered magnitude-blind (which axes are live,
 * harmonic count, X/Y mirror, antiphase) the 109 distinct tables collapse into 19 structural families, and
 * 6 of them cover 132 of 177 presets. The per-archetype `provenance` records which family, so a future
 * reader can re-derive the choice rather than trusting it. Frequencies are the values the library actually
 * uses: 1 (x96), 8 (x93), 4 (x47), 2 (x46), 0.5 (x38), 3 (x29), 7 (x21), 5 (x18), 6 (x15), 16 (x13) —
 * integers and halves. The long tail (`0.19580902`, `-800.01`, `1000000`) is randomiser residue, not
 * authored design, and is deliberately not represented.
 */

/** Peak displacement at `strength = 1.0`, as a fraction of `min(width, height)`. */
export const STATIC_FIELD_TARGET_FRACTION = 0.08;

/**
 * Samples per axis for `solveGain()`'s peak scan.
 *
 * ⚠️ **This is a SCAN RESOLUTION, not a quality knob.** Displacement is linear in the gain for all four
 * styles, so one solve is exact up to how finely the peak is located; 128 measured 0.17 pp worst-case
 * against a full per-pixel scan. Raising it costs `O(SCAN^2)` for no accuracy that survives the 8-bit
 * output. Lowering it below ~64 lets a high-`detail` field's peak fall between samples, which reads as
 * "strength means less on Fine Mesh".
 */
const GAIN_SCAN = 128;

const MAX_SIN_MAGIC = 4;
const DEG = 180 / Math.PI;

/** The name meaning "use the preset's own `sinMagicParams`" — the default, and byte-identical to pre-2026-08-20. */
export const PATTERN_PRESET = '(Preset)';

/** The name meaning "the sliders have been moved off any archetype's values". Never resolved as a shape. */
export const PATTERN_CUSTOM = '(Custom)';

/**
 * **The ONE enumeration of the warp wave shapes.** Both static-field editors' dropdowns, the Mixer's
 * `members` string and `shapecheck` all read THIS. The union itself is `WarpShape` in `presets/types.ts`.
 *
 * ⚠️⚠️ **THE TRAP, AND IT IS ONE-WAY.** `Record<WarpShape, …>` makes `tsc` force an entry for a new union
 * member; `readonly WarpShape[]` makes `tsc` force **nothing** — and **the dropdown reads the array.** So a
 * sixth shape added to the union plus both `Record`s below compiles clean, and the picker silently offers one
 * option fewer: the shape exists, is storable, interpolates, exports, and cannot be selected. The identical
 * gap is documented twice already in this tree (`core/interfaces.ts`'s `ChannelDriver`, and `33.5` is its
 * other live instance).
 *
 * ⚠️ **`checks/shapecheck.mjs` §A mechanises it as SET EQUALITY, in both directions, against BOTH `Record`s —
 * never as length equality**, because equal lengths with one name swapped is exactly the edit a rename
 * produces and a length test passes over it. §A carries a seeded sixth member so the clause has been shown
 * to fire; **a clause for a one-way gap that has never been shown to fire is the gap.**
 *
 * ⚠️ **Do not add a `Record<WarpShape, (x: number) => number>` and call that the gate** (`35.D6`): the
 * dispatch has ONE owner — the `shapeFn` switch `35.2` writes — and a second `Record` of functions here
 * would be a second owner of it. `32.8`'s finding is the precedent in the other direction: a `Record` cannot
 * see a missing **read** of its own result.
 */
export const WARP_SHAPES: readonly WarpShape[] =
  ['sine', 'triangle', 'trapezoid', 'square', 'sawtooth'];

/** ⚠️ `Record<WarpShape, …>` so `tsc` forces a label for a new member — `WARP_SHAPES` above forces nothing. */
export const WARP_SHAPE_LABELS: Record<WarpShape, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  trapezoid: 'Trapezoid',
  square: 'Square',
  sawtooth: 'Sawtooth',
};

/**
 * Which shapes RIP the image rather than bending it. Read by the notice line and by the tear assertion —
 * **never a second hand-typed list**, which is how the notice and the measurement come apart.
 *
 * ⚠️ `square` and `sawtooth` are a different CLASS, not merely a larger number: measured 120 px (style 0) and
 * 571 px (a zoom style) at 1920×1080, against sine's pre-existing 6 px `jsRound` quantisation floor, which
 * `trapezoid` sits in too. The magnitudes are measurements and will rot — cite them with the frame size.
 */
export const WARP_SHAPE_DISCONTINUOUS: Record<WarpShape, boolean> = {
  sine: false,
  triangle: false,
  trapezoid: false,
  square: true,
  sawtooth: true,
};

/** `1 / 2π`, for the two shapes below that need the cycle fraction rather than the angle. */
const INV_TAU = 1 / (Math.PI * 2);

/**
 * The trapezoid — **derived from the imported triangle, never from a second triangle** (`35.D6`).
 *
 * The clip fraction is hard-coded at 0.5 and is **not** to be exposed: the spec's §13 refuses it, and a
 * second continuous knob between `triangle` and `square` is what the `Shape mix` slider already is.
 */
function trapSin(a: number): number {
  const t = triBasis(a) * 2;
  return t > 1 ? 1 : t < -1 ? -1 : t;
}

/**
 * ⚠️ **DISCONTINUOUS.** `|| 1` because `Math.sign(0)` is **0** and the field must not drop to zero at a
 * crossing — a zero-valued ring at every half-cycle would read as the pattern having holes in it.
 *
 * ⚠️⚠️ **CONSEQUENCE, AND IT IS WHY `buildWave`/`buildZoomWave` EXEMPT A FREQUENCY-0 SLOT:** `sqrSin(0)` is
 * `1`, not `0`. `sqrSin(Math.PI)` is also `1`, because `Math.sin(Math.PI)` is `+1.22e-16` and not zero. So
 * this shape shares **neither** of sine's zeros, and a slot whose argument is identically 0 would acquire a
 * DC term it does not have on the sine path. See `buildWave`'s exemption paragraph.
 */
function sqrSin(a: number): number {
  return Math.sign(Math.sin(a)) || 1;
}

/**
 * ⚠️ **DISCONTINUOUS, and the only shape here that is not EVEN** — a monotone ramp then a jump.
 *
 * ⚠️⚠️ **`sawSin(0) === -1`, NOT 0**, so this is the SECOND shape that breaks `f(0) = 0` and
 * `PHASE35-KEYS.md` §3.2 names only `square`. Both are covered by the one exemption in
 * `buildWave`/`buildZoomWave`; **do not narrow that exemption to `square` on the strength of the
 * document.** (`sawSin(Math.PI)` IS 0, so unlike `square` this shape shares one of sine's two zeros.)
 */
function sawSin(a: number): number {
  const u = a * INV_TAU;
  return 2 * (u - Math.floor(u)) - 1;
}

/**
 * **The ONE owner of the shape dispatch** (`35.D6`), resolved ONCE per wave build and never per sample.
 *
 * ⚠️ **A plain `switch`, deliberately not a `Record<WarpShape, (x: number) => number>`.** The design
 * document's §1.3 forbids the `Record` for a reason that is not style: a `Record` of functions here would be
 * a second owner of the dispatch, and `32.8`'s finding is that **a `Record` cannot see a missing READ of its
 * own result** — the defect there was exactly that. The `switch` is also a real, if narrow, `tsc` gate: with
 * every union member covered and **no `default`**, TypeScript proves the end of the function unreachable, so
 * a sixth `WarpShape` makes it reachable and the declared return type rejects the implicit `undefined`
 * (TS2366). ⚠️ **Adding a `default` arm surrenders that gate silently** — `shapecheck` §E asserts its
 * absence, since `WARP_SHAPES`' array has no gate of its own (§A) and this would have been the second.
 *
 * ⚠️ **`sine` returns `Math.sin` so the function is TOTAL and can be probed**, but the callers must NOT
 * route the sine path through it: both builders branch on `shape === 'sine' || mix === 0` to the **pre-change
 * expression**, because bit-identity is not algebraic identity. See `buildWave`.
 */
function shapeFn(shape: WarpShape): (a: number) => number {
  switch (shape) {
    case 'sine': return Math.sin;
    case 'triangle': return triBasis;
    case 'trapezoid': return trapSin;
    case 'square': return sqrSin;
    case 'sawtooth': return sawSin;
  }
}

/**
 * The shape the two wave builders will actually apply — **`null` IS the identity fast path.**
 *
 * ⚠️⚠️ **TWO INDEPENDENT IDENTITIES, AND NOTHING MAY COUPLE THEM** (`35.D2`, and `STATIC_FIELD_DEFAULTS`
 * says the same at the fields): `shape === 'sine'` is one, `mix === 0` is the other. A user who picks a shape
 * and leaves the mix at 0 sees **nothing**, which the spec's §4.3 calls the most likely first-use confusion
 * in the phase; the notice line is the whole of the remedy and a coupling here is not.
 *
 * ⚠️ **The mix clamp is NaN-SAFE BY SHAPE, not by `Math.min`/`Math.max`.** `mix > 0` is false for `NaN`, so a
 * hand-edited import carrying `shapeMix: null`/`NaN` takes the identity arm instead of NaN-ing the whole
 * wave array — and from there the displacement texture, which no sanitiser on the screen path would reach
 * (invariant 20/21's class). `Math.min(1, Math.max(0, NaN))` is `NaN` and would NOT do this.
 */
function resolveShape(shape: WarpShape, mix: number): { fn: ((a: number) => number) | null; mix: number } {
  const m = mix > 0 ? (mix < 1 ? mix : 1) : 0;
  return { fn: m === 0 || shape === 'sine' ? null : shapeFn(shape), mix: m };
}

/**
 * A shape-only field descriptor. Amplitudes are RELATIVE (sum-normalised at resolve time, so harmonic
 * count does not change magnitude) and frequencies are in CYCLES ACROSS THE AXIS, scaled by `detail`.
 */
export interface StaticFieldArchetype {
  name: string;
  /** Relative amplitudes of the 4 X harmonics. All-zero means "this axis is inert". */
  xAmp: readonly [number, number, number, number];
  /** X frequencies, in cycles across the width. Sign matters: it sets the phase relationship with Y. */
  xFreq: readonly [number, number, number, number];
  yAmp: readonly [number, number, number, number];
  yFreq: readonly [number, number, number, number];
  /** Which legacy family this was distilled from, and how many presets share it. */
  provenance: string;
  /**
   * Opt in to AUTHORED amplitudes: `xAmp`/`yAmp` are a stored table's own numbers, not a shape up to scale,
   * and `strength` is the `(Preset)` branch's relative gain around 0.5 instead of the 8%-of-frame solve.
   *
   * ⚠️ **This is NOT the pinned `AMP_SCALE` the header rejects, and the difference is where the constant
   * lives.** `AMP_SCALE` was a per-STYLE calibration multiplying a normalised shape, so it was wrong at any
   * canvas or archetype it had not been solved against. This flag introduces no constant at all: it selects
   * the magnitude law that `resolveStaticWaves`' `(Preset)` branch has always used for the 200-odd shipped
   * tables (`strength / STATIC_FIELD_DEFAULTS.strength`, so 0.5 is unity), which is exactly resolution- and
   * style-independent because it converts nothing.
   *
   * ⚠️ **What it COSTS, stated because it is a real loss.** `solveGain()` exists so that one slider position
   * means the same visible warp on every archetype and every style; a flagged archetype opts out of that, so
   * `Strength 0.5` means "the authored lens" here and "8% of `min(w,h)`" on the other rows. **The flag is
   * therefore only correct for a shape transcribed from a REAL table, where the author's amplitude IS the
   * design** — and it is the only way such a shape is reachable at all when its required `strength` exceeds
   * `STATIC_FIELD_STRENGTH_MAX` (measured: `Sphere` needs 5.99 under the solve, against a ceiling of 2, and
   * 21.13 refused to widen the ceiling for exactly this tail). Do not set it on a distilled family.
   *
   * ⚠️ **`identifyArchetype` needs no branch for it only because both flagged shapes have `sum|amp| === 1`**,
   * which makes `sumNormalise` the identity on them — so the normalised amplitudes it compares against and
   * the authored ones resolved here are the same numbers. **A flagged archetype whose amplitudes did not sum
   * to 1 would identify at a `scale` that no longer equals its required `strength`**, silently, and the
   * required-`strength` readout is MEASURED through both regimes so it would follow the code and not the
   * comment. Keep the sum at 1, or teach `identifyArchetype` the distinction.
   */
  absoluteAmp?: boolean;
}

export const STATIC_FIELD_ARCHETYPES: readonly StaticFieldArchetype[] = [
  {
    name: 'Vertical Ripple',
    xAmp: [0, 0, 0, 0], xFreq: [0, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [8, 0, 0, 0],
    provenance: 'family Yonly/h1 (n=53); 52 presets ship this table verbatim as [[0,0,0,0],[0,0,0,0],[1,0,0,0],[8,0,0,0]]',
  },
  {
    name: 'Horizontal Ripple',
    xAmp: [1, 0, 0, 0], xFreq: [8, 0, 0, 0],
    yAmp: [0, 0, 0, 0], yFreq: [0, 0, 0, 0],
    provenance: 'the X mirror of Vertical Ripple; family Xonly/h1 (n=4) uses the shape, none at freq 8',
  },
  {
    name: 'Grid Lattice',
    xAmp: [1, 0, 0, 0], xFreq: [6, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [4, 0, 0, 0],
    provenance: 'family both/h1/mirror (n=24); the 6/4 pair is Borg Cube\'s, whose 11x7 nodal lattice is the reference case',
  },
  {
    name: 'Interference',
    xAmp: [1, 0, 0, 0], xFreq: [-1, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [1, 0, 0, 0],
    provenance: 'family both/h1/mirror/antiphase (n=20); equal magnitude, opposite sign — one broad counter-rotating cell',
  },
  {
    name: 'Turbulent Weave',
    xAmp: [1, 0.5, 0.25, 0.125], xFreq: [1, 2, 4, 8],
    yAmp: [1, 0.5, 0.25, 0.125], yFreq: [1, 2, 4, 8],
    provenance: 'family both/h4/mirror (n=10); geometric octave falloff, the pattern Birds Flying and Black Electricity use',
  },
  {
    name: 'Coarse Swell',
    xAmp: [1, 0, 0, 0], xFreq: [1, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [1, 0, 0, 0],
    provenance: 'frequency 1 is the single most used value in the library (x96) — one lens across the whole frame',
  },
  {
    name: 'Fine Mesh',
    xAmp: [1, 0, 0, 0], xFreq: [16, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [16, 0, 0, 0],
    provenance: 'frequency 16 appears x13; the densest lattice the library authors used',
  },
  {
    name: 'Diagonal Shear',
    xAmp: [1, 0, 0, 0], xFreq: [4, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [-4, 0, 0, 0],
    provenance: 'equal frequency, opposite sign — the antiphase families (n=39 total) in their simplest form',
  },
  // ─── Added 2026-09-23 (owner: "add all six new archetypes"), from DESIGN-static-field-archetypes.md §4.
  // ⚠️ THE SLOT ORDER OF EACH TABLE IS PART OF ITS IDENTITY — `identifyArchetype` compares slot i to slot i, so
  // these are written in the order the library's own bodies use, NOT sorted. Re-sorting a table's four slots
  // silently stops it identifying anything, and nothing on screen changes (the field is a sum).
  // ⚠️ They are APPENDED rather than merged into the coverage-descending run above, because array order is both
  // the menu order and the tie-break between two archetypes that are exact negatives of each other: inserting
  // into the run would move existing menu positions and could change which NAME an already-shipped preset
  // identifies as. The six are coverage-descending among themselves (5, 4, 3, 2, 2, 1).
  {
    name: 'Ember Cascade',
    xAmp: [1, 0.5, 0.25, 0.25], xFreq: [1, 8, 16, 14],
    yAmp: [1, 0.5, 0.25, 0.25], yFreq: [1, 8, 16, 14],
    provenance: 'the fire family (n=5: Burn Burn Burn, Dancing Elphes, Fire Storm, Hades On Fire, Hades on Fire II) at detail 0.5; one broad swell carrying three fine near-neighbours, 16 against 14 beating slowly',
  },
  {
    name: 'Cross Shear',
    xAmp: [1, 0, 0, 0], xFreq: [2, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [-1, 0, 0, 0],
    provenance: 'n=4 (Multi Threads, Multi Threads II, Multi Mixer, Unfiy The Force); Diagonal Shear is the 1:-1 case, this is 2:-1 — one axis twice as fine AND counter-signed',
  },
  {
    name: 'Harmonic Cascade',
    xAmp: [1, 0.5, 0.25, 0.125], xFreq: [-1, -2, -3, -4],
    yAmp: [1, 0.5, 0.25, 0.125], yFreq: [1, 2, 3, 4],
    provenance: 'n=3 (Miracle, Miracle Frost, Birth of a Black Hole); a HARMONIC series in antiphase where Turbulent Weave is an OCTAVE series in phase — many-lobed and counter-rotating rather than woven',
  },
  {
    name: 'Broad Over Fine',
    xAmp: [1, 0, 0, 0], xFreq: [8, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [1, 0, 0, 0],
    provenance: 'n=2 (Anima Electrica, Birth Of Venus); the asymmetric counterpart of Grid Lattice\'s 6/4 — fine striping over a single broad lens',
  },
  {
    // ⚠️ WRITTEN AT THE LIBRARY'S OWN 0.1 SCALE ON PURPOSE. The same shape spelled [1, 1.01, 5.05, 5]
    // identifies at detail 0.1, BELOW the 0.25 Detail track floor — i.e. a match the slider cannot reach.
    name: 'Beat Swell',
    xAmp: [1, -1, 0.5, -0.5], xFreq: [0.1, 0.101, 0.505, 0.5],
    yAmp: [1, -1, 0.5, -0.5], yFreq: [0.1, 0.101, 0.505, 0.5],
    provenance: 'n=2 (Quader, Dancing Quader); two nearly equal frequencies of opposite sign — a BEAT whose envelope period far exceeds either wave, the library\'s only slow-moire shape',
  },
  {
    name: 'Prime Comb',
    xAmp: [1, 1, 1, 1], xFreq: [2, 3, 5, 7],
    yAmp: [1, 1, 1, 1], yFreq: [2, 3, 5, 7],
    provenance: 'n=1 exactly (Aurora Borealis II), but 2/3/5/7 combs recur in ~5 bodies; pairwise-coprime frequencies at equal amplitude never realign, so the field reads organic rather than lattice-like — admitted on CHARACTER, not coverage',
  },
  // ─── Added 2026-09-24 (owner: "two additional default values … Macrolense … Distant Lense"), transcribed from
  // the `Sphere` preset's own table rather than distilled from a family: `[[1,0,0,0],[0.5,0,0,0],[1,0,0,0],[0.5,0,0,0]]`,
  // i.e. one live harmonic per axis at frequency 0.5 — HALF a cycle across `min(w,h)`, which is why it reads as a
  // single lens filling the frame rather than as a pattern. Appended for the reasons the block above states.
  //
  // ⚠️ **THE PAIR IS NOT A MIRROR ON EVERY STYLE, AND THE SIGN ALGEBRA IS WHY BOTH EARN A MENU ROW.** Every
  // occurrence of a frequency in `buildWave` is LINEAR in the sine's argument — the `360·i·f/period` term, the
  // `phase·f` term and `centreAnchor`'s `π·f·(1 − n/period)` alike — so negating all four frequencies negates the
  // argument and `sin(−θ) = −sin(θ)`: **on style 0 (a pixel SHIFT) `Distant Lense` is `Macrolense`'s field
  // sample-for-sample negated, i.e. the same thing at a negative `Strength`.** It is NOT redundant there either —
  // one click against a slider sign — but the real difference is on styles 1-3, where the resolved value is a ZOOM
  // DELTA consumed by `zoomCoordinate`, which is **not** odd in its argument: zooming in by d and out by d are not
  // each other's negation, `solveGain` therefore lands on a different gain for the two, and the peak it normalises
  // is measured on the already-nonlinear coordinate. **`Sphere` itself is style 2**, so the pair is a genuine
  // macro-versus-distant lens exactly where the shape came from. Do not "simplify" either row into the other.
  //
  // ⚠️ **BOTH CARRY `absoluteAmp`, and without it the dropdown reproduced the SHAPE at a twelfth of the
  // AMPLITUDE** (owner, 2026-09-24: *"it does not apply the same amplitude of 1 as the Sphere preset has, but a
  // much smaller value around 0.1"* — measured 0.0835 at the default strength 0.5, style 2, 1920x1080). The
  // cause is not these entries: the 8%-of-frame solve caps peak displacement at `STRENGTH_MAX x 8%` = 16% of
  // `min(w,h)`, and `Sphere`'s authored lens is a ~48% displacement, so it needs **strength 5.99** against a
  // ceiling of 2. Under the solve, `Coarse Swell` needs 10.26 and `Grid Lattice` 12.23 for the same amplitude 1
  // — **every archetype is equally unable to reach an authored table, which is the tail `STATIC_FIELD_STRENGTH_MAX`
  // deliberately does not cover.** So the fix could not be a bigger number anywhere: it had to be the OTHER
  // magnitude law, the one the `(Preset)` branch already uses. See `absoluteAmp` for what that costs.
  //
  // ⚠️ **`Macrolense` CHANGES WHICH NAME SOME SHIPPED TABLES IDENTIFY AS, and that is the appending rule's one
  // exception — `identifyArchetype` ranks by smallest `|log detail|`, NOT by array order.** A `[a,0,0,0]/[0.5,…]`
  // table used to read as `Coarse Swell × detail 0.5`; it now reads as `Macrolense × detail 1`, which is the more
  // honest identification (the parity point, and a `detail` the slider sits on) but IS a new answer in the panel's
  // identification line. The cross-over is at `|log|` parity: `Macrolense` wins below frequency 1/√2 ≈ 0.707 and
  // `Coarse Swell` at and above it, so nothing at frequency 1, 2, 4, 8 or 16 moves. `Distant Lense` relabels
  // NOTHING — it can only match a table whose frequencies are both NEGATIVE, where every positive-frequency
  // archetype yields a negative `detail` and is rejected outright, so it strictly ADDS identification coverage.
  // **Both claims are measured by `trackcheck`'s Detail and SIGN sections over the composed library; re-run it
  // rather than trusting this paragraph.**
  {
    name: 'Macrolense',
    xAmp: [1, 0, 0, 0], xFreq: [0.5, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [0.5, 0, 0, 0],
    absoluteAmp: true,
    provenance: 'the `Sphere` table verbatim, amplitude included (frequency 0.5 is the library\'s 5th most used value, x38); half a cycle across min(w,h) on both axes — the macro-lens bulge, and the shape `Coarse Swell` reaches only at detail 0.5',
  },
  {
    name: 'Distant Lense',
    xAmp: [1, 0, 0, 0], xFreq: [-0.5, 0, 0, 0],
    yAmp: [1, 0, 0, 0], yFreq: [-0.5, 0, 0, 0],
    absoluteAmp: true,
    provenance: 'the owner\'s inverse of Macrolense — the same single harmonic at the same authored amplitude with both frequencies negated, which inverts the lens (pushing away where Macrolense pulls in); the shape `Eternal Fire` authors exactly, and the only archetype whose frequencies are all negative',
  },
  // ─── Added 2026-10-29 (`35.6`, `35.D7`). THREE, not the spec's six: the owner cut `Diamond Mosaic`,
  // `Chevron Press` and `Blade Fan` on a measurement — `identifyArchetype` resolves their tables as
  // `Fine Mesh` @ detail 0.3125, `Fine Mesh` @ 0.375 and `Diagonal Shear` @ 0.75, all three INSIDE the
  // `Detail` track, so a user reaches them today with one dropdown click plus one slider. **Never
  // re-propose them.**
  //
  // ⚠️⚠️ **THESE ARE DESIGNED, NOT DISTILLED, AND THAT IS A DIFFERENCE IN KIND THAT MUST BE SAID RATHER
  // THAN DISCOVERED.** The 2026-09-23 six were distilled from the legacy tables and their whole case was
  // COVERAGE (they added 17 identifications). These three add **ZERO** — measured over the 278 live table
  // layers (identified 186 before and after) and over all 628 library tables (221 before and after). Their
  // case is the other one: *a field an author cannot otherwise reach in one click.* Do not grade them by
  // coverage and do not "fix" the zero.
  //
  // ⚠️⚠️ **THE APPEND OBLIGATION IS FALSIFIED AND APPENDING IS STILL CORRECT — FOR THE OTHER REASON.** The
  // block above claims appending protects which NAME an already-shipped preset identifies as. It does not:
  // `identifyArchetype` ranks by smallest `|log detail|` (see its rule 4), and array order is only the
  // tie-break between exact negatives. Measured 2026-10-29: appending the spec's SIX would have relabelled
  // **2 live layers** (`Patterns`, `There Will Be Light`) and **9 library tables**, because three of the six
  // were an existing table at a different `detail`. **Appending these three relabels NOTHING — 0 live
  // layers and 0 library tables** — and that is a property of the TABLES (none is any shipped table at any
  // scale), not of their position. Appending remains right because array order IS the menu order.
  //
  // ⚠️ **Each is a TWO-live-slot mirror-or-crossed pair, and the shipped set has no such shape at all** —
  // every one of the 16 above is 1 live slot per axis or 4. That is why none of them identifies as anything
  // and why nothing identifies as them.
  //
  // ⚠️ **Slot order is part of each table's identity** (the 2026-09-23 block says why): `Brick Weave`'s X is
  // `[7, 3]` against its Y's `[3, 7]`, and swapping either pair silently stops it identifying. Re-sorting
  // changes nothing on screen, because the field is a sum.
  //
  // ⚠️ **None carries `absoluteAmp`, deliberately** — see that flag's own doc: it is only correct for a shape
  // transcribed from a REAL table, where the author's amplitude IS the design. These are designed, so they
  // take the normalised 8%-of-frame gain. Their amplitude sums (1.35, 1.4, 1.3) do NOT equal 1, which is
  // exactly why flagging one later to answer a `Strength` complaint would make it identify at a `scale` that
  // no longer equals its required `strength`, silently.
  //
  // ⚠️ **The shape is NOT stored here, and the spec's §12.1 is superseded on that point.** It proposed each
  // entry carry recommended `shape`/`shapeMix`/`angleX`/`angleY` defaults that selecting the pattern writes.
  // `StaticFieldArchetype` has no such fields, the dropdown is `35.4` and the angles are `35.3`, so adding
  // them here would be four more symbols with no reader — `35.1`'s own refusal. **An archetype is a TABLE**;
  // the shape lives on the layer beside it and the demos carry it.
  //
  // Distinctness, re-measured 2026-10-29 rather than quoted — normalised field distance over a 26×26×2
  // sample grid of the resolved displacement, each field divided by its own L2 norm, so the measure is
  // magnitude-blind (`strength` is a separate control) and runs 0 (same shape) .. 2 (exact negative) with
  // √2 ≈ 1.414 meaning ORTHOGONAL. **The scale is this set's own floor: the two closest of the shipped 16
  // are `Turbulent Weave` / `Coarse Swell` at 0.491.** ⚠️ The spec names `Interference` / `Harmonic Cascade`
  // at 0.498 as the closest pair; under this reading that pair is 0.510 and is the SECOND closest. **Two
  // measurements wearing one set of words — do not reconcile them, and re-measure rather than quoting
  // either.** Nearest shipped archetype: `Brick Weave` 0.875, `Oblique Lattice` 0.849, `Terraced Swell`
  // 0.823 — all ≈1.7× the floor, i.e. each is further from the library than the library is from itself.
  //
  // ⚠️ **The spec's *"pairwise distances among the six run 1.359-1.395, i.e. near-orthogonal"* does NOT hold
  // for the kept pair, because that figure was measured WITH the angles: `Brick Weave` / `Oblique Lattice` is
  // **0.573** as tables.** Both still clear the 0.491 floor, so the rule is satisfied; the near-orthogonality
  // claim is not, and it was an ANGLE property rather than a table property. Same correction applies to
  // `Oblique Lattice`'s quoted 1.393, which is 0.849 as a table.
  {
    name: 'Brick Weave',
    xAmp: [1, 0.35, 0, 0], xFreq: [7, 3, 0, 0],
    yAmp: [1, 0.35, 0, 0], yFreq: [3, 7, 0, 0],
    provenance: 'designed for Phase 35, not distilled from the library; 7:3 against 3:7 — the one CROSSED pair here, fine striping on one axis over a coarse swell on the other, which is what reads as a brick course rather than a lattice. Measured 0.875 from the nearest existing archetype (Prime Comb) against this set\'s own 0.491 floor, and it relabels nothing. ⚠️ Re-tabled from the specifier\'s first version, which reused Grid Lattice\'s 6:4 at 0.438 — less distinct than the two closest shipped archetypes are from each other, because "an existing table plus a shape" is already reachable by picking the parent and setting the shape',
  },
  {
    name: 'Oblique Lattice',
    xAmp: [1, 0.4, 0, 0], xFreq: [3, 7, 0, 0],
    yAmp: [1, 0.4, 0, 0], yFreq: [-3, -7, 0, 0],
    provenance: 'designed for Phase 35, not distilled from the library; the SIGN-ANTIPHASE 3:7 pair — the two axes carry equal-magnitude opposite-sign frequencies, which is the route this file already documents at Diagonal Shear, so the lattice genuinely runs off-axis instead of square to the frame. ⚠️ THE NAME IS EARNED BY THE SIGNS, NOT BY AN ANGLE: an archetype is a TABLE and cannot carry an angleX/angleY default, so a name promising obliqueness has to be true of the table alone. The entry first shipped as the MIRRORED pair (yFreq [3, 7]), which is axis-aligned and measured 0.849 — a name the table did not earn, since the specifier reached "off-axis" through angleX/angleY 28° and the 1.393 it quotes is an ANGLE figure. Owner decision 2026-10-29: take the antiphase table, which is both truthful and measurably more distinct',
  },
  {
    // ⚠️⚠️ **THIS ENTRY DIES WITH `trapezoid`, AND THAT VERDICT HAS NOT BEEN TAKEN.** `triangle` and
    // `trapezoid` were both measured as mere REFINEMENTS of sine (`shapecheck` §H puts `trapezoid` at 3.0 px
    // in sine's own tear class against `square`'s 71.0), and the judgement is owed to an EYE, not to a
    // checker. The archetype is the table only, so it is independently usable under any shape — but its
    // whole DESIGN is the terracing a clipped wave gives, so **if `trapezoid` is cut, cut this entry with
    // it.** Stated here so that is one edit rather than a hunt. The sibling coupling is already gone:
    // `Chevron Press` depended on `triangle` and `35.D7` cut it.
    name: 'Terraced Swell',
    xAmp: [1, 0.3, 0, 0], xFreq: [2, 5, 0, 0],
    yAmp: [1, 0.3, 0, 0], yFreq: [2, 5, 0, 0],
    provenance: 'designed for Phase 35, not distilled from the library; the mirrored 2:5 pair — two broad cells per axis with a non-harmonic fifth riding them, so the contours never realign and read as stepped terraces under a clipped wave. Measured 0.823 from the nearest existing archetype (Prime Comb) against this set\'s own 0.491 floor, and it relabels nothing. ⚠️ Designed FOR trapezoid and cut with it if that shape does not survive its look verdict — see the comment on this entry',
  },
] as const;

export function findArchetype(name: string | undefined): StaticFieldArchetype | undefined {
  if (!name) return undefined;
  return STATIC_FIELD_ARCHETYPES.find(a => a.name === name);
}

/** Every selectable pattern name, in dropdown order. */
export function patternNames(): string[] {
  return [PATTERN_PRESET, ...STATIC_FIELD_ARCHETYPES.map(a => a.name), PATTERN_CUSTOM];
}

/**
 * The `Strength` track's maximum — **the ONE owner of that bound** (v8 21.13, the owner's "both" answer).
 *
 * ⚠️ **It is read by four places that must never disagree: the two sliders' `max`, the identification line's
 * in-/out-of-range threshold, `STATIC_FIELD_STRENGTH_MIN` (which is its negation), and `trackcheck`.** The
 * label and the track are two views of one number, and a hand-copied `2.0` in the wording is exactly how they
 * come to disagree — so the wording formats THIS constant. That is the same rule the Composer's `ratioBase`
 * states: two bases is the defect. ⚠️ **Since 2026-09-22 the threshold is compared against `|needed|`**, so
 * this constant bounds the MAGNITUDE and the track is symmetric about 0.
 *
 * ⚠️ **Derived, not picked, and the derivation is a measurement — re-derive it, do not quote it.**
 *
 * **2026-09-25: 2.0 → 16, REVERSING v8 decision 21.13's "do not widen the top" (the owner's call).** 21.13
 * refused 4.0 on a resolution argument — *"it halves the resolution where the library actually sits"* — and
 * that argument was sound about a LINEAR track and is simply not about this one: the curve below carries the
 * range and the VALUE GRID carries the resolution, so widening cost nothing where the library sits. The old
 * reasoning is kept above the line rather than deleted, because the premise it rests on is the thing that
 * changed.
 *
 * **The basis, re-derived 2026-09-25 and DIFFERENT from 21.13's** — do not reconcile the two (*CLAUDE.md*: a
 * basis difference is not an event). 21.13 counted 63 legacy-JSON tables; this counts the **COMPOSED** library
 * (`loadLibrary` over `public/psss_presets.json`, so settled refinements replace their legacy keys) and it
 * measures rather than derives: **274 composed bodies → 159 identifiable → 139 with a measurable Strength
 * answer on ALL FIVE canvas shapes** (style 3 excluded, for the reason `describeTermIdentity` gives).
 *
 * ⚠️ **"Measurable" is a different set on each canvas, so the 139 is an INTERSECTION and `trackcheck` §M's
 * `140` is not a contradiction**: that clause measures at 1920×1080 alone, where one more body has a
 * non-degenerate peak. Two measurements wearing the same word — **do not reconcile them, and do not read the
 * gap as a body appearing or disappearing.** Every figure below is labelled with which of the two it is.
 *
 * The distribution moved as well as the basis, because the `absoluteAmp` fix of 2026-09-24 pulled five bodies
 * out of the far tail:
 *
 *   - at 1920×1080, **median 0.128**, worst **12.20** (`Inside Athlon`); over five canvas shapes the same body
 *     needs **14.89** at its worst, which is what a ceiling has to cover to be canvas-proof;
 *   - coverage, 16:9 / every shape: **2.0 → 131/129**, 4.0 → 138/137, 8 → 138/138, 12.5 → 139/138,
 *     **15 → 139/139**, 16 → 139/139;
 *   - the tail above the old 2.0 is exactly **eight bodies**, seven of them ≤ 3.57 (`Millenium Falcon`,
 *     `Blue Planes`, `Vivianes Harp`, `Mondrian Melting`, `Star Dust`, `Kissing Deeply`, `Plasma`) and
 *     `Inside Athlon` alone at 12.20.
 *
 * **16 rather than 15, and the reason is the curve's arithmetic, not the tail**: `16 × 0.5⁴ = 1` exactly, so
 * **±1 sits at exactly half of each half's travel** and the old ceiling 2.0 at 59.5% — the whole of the old
 * range gets three fifths of the handle, and the new tail the rest. 15 covers the library equally well and
 * puts no round number anywhere.
 *
 * ⚠️ **The resolution did NOT pay for the range, and that is a measurement rather than a hope** (*Slider
 * tracks*: reachability and resolution are separate properties). `STATIC_FIELD_STRENGTH_GRID` quantises in the
 * STORED unit at a flat **0.01 — exactly the old track's step** — so **381 of the old track's 401 values are
 * still reachable**, every 0.01 multiple within **±1.47** is reachable, and the 20 that are gone all have
 * magnitude ≥ 1.48. The readout keeps 2 decimals, which is that same grid, so every reachable value is also
 * printable. Above 1.47 one notch moves more than 0.01 and the track is coarser than the old one **over a
 * region the old one could not reach at all**.
 *
 * ⚠️ **It means two different things on the two branches and the widening changes BOTH.** On an archetype it
 * is normalised — 16 is `16 × 8% × min(w,h)`, i.e. **1382 px at 1920×1080**, a displacement wider than the
 * frame, which is the honest reading of the end of the track and is what the identification line prints. On
 * `(Preset)` it is a relative gain around the 0.5 default, so the same handle at 16 is a **32×** gain on the
 * author's own amplitudes. **Neither branch's parity point moves**: 0.5 still reproduces an authored table
 * exactly (`fieldcheck` §A) and the archetype branch is still linear in `strength` (`fieldcheck` §G).
 *
 * ⚠️ **Nothing outside the UI reads this bound** — grepped 2026-09-25: no engine path clamps a stored
 * `strength`, and `randomStaticField()` draws from its own hardcoded 0.2…0.8. So the widening cannot change a
 * single shipped preset, a Mixer result, an import or a seeded reel body; it only adds reach to four handles.
 */
export const STATIC_FIELD_STRENGTH_MAX = 16;

/**
 * The `Strength` track's minimum — **`-STATIC_FIELD_STRENGTH_MAX` BY CONSTRUCTION, never a second literal**
 * (2026-09-22, the owner's *"allow Strength to go negative"*).
 *
 * ⚠️ **It is DERIVED from the maximum rather than written, because two literals is the defect this constant
 * exists to prevent** — the same rule as the Composer's one `ratioBase`. A hand-typed `-2` would let a later
 * widening of the top move one end of the track and not the other, and the asymmetry would read as a UI quirk
 * rather than as a bug: the handle would simply stop early on one side.
 *
 * ⚠️ **What a negative `Strength` MEANS, and it is the same thing on both regimes — which is why it needed no
 * second stored field.** Both branches multiply a set of amplitudes by a signed scalar, so the sign passes
 * straight through to the displacement: the field is the same shape with every offset pointing the other way.
 * On `(Preset)` the branch is already a signed relative gain (`strength / 0.5`), and on an archetype
 * `solveGain()` returns a positive number scaled by `strength`, so peak displacement is
 * `|strength| × 8%` of `min(w,h)` and stays LINEAR in `strength` across zero (`fieldcheck` §C's oracle is
 * unchanged — it measures a magnitude).
 *
 * ⚠️ **0 is now a DEAD CENTRE rather than an end stop, and that is the cost.** It still means "no warp" (both
 * branches multiply by it), so the handle's midpoint is the identity and the two halves are mirror images.
 * **The resolution did not change** — measured, not assumed: in 2026-09-22 the step stayed a flat `0.01` and the
 * track simply gained 200 positions; since 2026-09-25 the value GRID is a flat 0.01 instead
 * (`STATIC_FIELD_STRENGTH_GRID`), which keeps every value the 2026-09-22 track could reach up to ±1.47. ⚠️ **On
 * a curved track 0 is no longer one stop but a BAND** — 13.2% of the travel quantises to it, deliberately, for
 * the reason `DRIFT_TRACK` keeps its sticky zero: the identity is the value a user returns to.
 *
 * ⚠️ **Why it was worth doing: the sign is unreachable from the dropdown otherwise.** An archetype's stored
 * amplitudes are `sumNormalise`d and a negated table is the same SHAPE at a negative shared gain, which
 * `identifyArchetype` used to refuse outright. Measured over the composed library, the negated shapes are not
 * a corner: they dominate the style-3 zoom tables. See `identifyArchetype`'s rule 1 for the sign rule itself
 * and `trackcheck` §M for the figures, which are measured there and deliberately not restated here.
 */
export const STATIC_FIELD_STRENGTH_MIN = -STATIC_FIELD_STRENGTH_MAX;

/**
 * The `Strength` track's CURVE — **a signed quartic, `v = sign(p) · MAX · |p|⁴` over a position of ±1**
 * (2026-09-25, the sitting that reversed 21.13).
 *
 * ⚠️ **The curve is what made the widening free, so it is not a cosmetic choice.** A LINEAR ±16 was measured
 * first and rejected on the spot: with a median need of 0.128, `|s| ≤ 1` would have occupied **6.3%** of the
 * travel and one pixel of a 200 px slider would have been 0.16 units — the median value literally unreachable
 * by drag. The quartic gives `|s| ≤ 1` half of each half and `|s| ≤ 2` (the whole old range) 59.5%.
 *
 * ⚠️ **Quartic and NOT logarithmic, for `rotationToPos`'s and `COLOUR_DRIFT_TRACK`'s reason: 0 is CATEGORICAL
 * here** — it is the identity on both regimes of `resolveStaticWaves`, and a log map has no zero at all.
 * `sign(p)·|p|⁴` is exact at 0 and at both ends by construction. This is the same idiom, the same exponent and
 * the same quantise-the-magnitude-and-re-apply-the-sign body as `COLOUR_DRIFT_TRACK` in `visual-fx.ts`; see its
 * header for why `Math.round` on a signed value breaks oddness by 1 LSB and what that cost to find.
 *
 * ⚠️ **Quantised in the STORED unit at a flat 0.01, never in position** — the trap `core/rotation-track.ts`
 * documents. That grid is deliberately the OLD track's step, which is what makes the widening lossless below
 * ±1.47; see `STATIC_FIELD_STRENGTH_MAX`'s note for the figures and `trackcheck` §M for the measurements.
 *
 * ⚠️ **It lives HERE rather than in either tab, because FOUR handles carry it** — two in `tabs/transmap.ts` and
 * two in `tabs/visual-fx.ts`, built in four different functions. `visual-fx.ts` owns the tracks whose only
 * consumer is itself; a curve with consumers in two tabs belongs beside the bounds it is derived from, and a
 * copy of it in one tab would be the drift `trackcheck` §M's source-shaped clauses exist to prevent.
 *
 * Measured over the 2001 stops (2026-09-25, `trackcheck` §M re-runs all of it): endpoints exactly ±16;
 * **1193 distinct values and 1193 distinct labels — 1:1**; worst non-zero dead run **42** stops against the
 * 60-stop house ceiling; sticky zero **13.2%**; odd at every stop; idempotent at every stop; and **13 of the 13
 * strength values the library authors round-trip EXACTLY through the element's own position grid** — better
 * than `COLOUR_DRIFT_TRACK` manages, because a 0.01 grid is coarse enough to absorb the position snap.
 */
const STATIC_FIELD_STRENGTH_CURVE = 4;

/** Position resolution: ±1 at this step is 2001 stops, matching `COLOUR_DRIFT_STEP`'s signed track. */
export const STATIC_FIELD_STRENGTH_STEP = 0.001;

/**
 * Quantisation grid in the STORED unit — **the OLD track's step, kept on purpose**, which is the whole of the
 * claim that widening the range cost no resolution where the library sits.
 */
export const STATIC_FIELD_STRENGTH_GRID = 0.01;

/**
 * Decimal places OF that grid, **derived and not written**, because the two are one quantity.
 *
 * ⚠️ **Found by seeding, 2026-09-25, and it is worth recording what the defect looked like**: `fromPos` used a
 * literal `toFixed(2)`, so the grid was expressed TWICE. Seeding `GRID = 0.001` therefore changed nothing a
 * user could reach — the `toFixed` re-coarsened every value back to 0.01 — and `trackcheck`'s parity clause
 * stayed GREEN through a grid change, which is the *Verify* rule about a measuring section's own basis in its
 * purest form. Deriving it makes a grid change single-site and makes that clause sensitive to it.
 */
const STATIC_FIELD_STRENGTH_DECIMALS = Math.max(0, Math.round(-Math.log10(STATIC_FIELD_STRENGTH_GRID)));

export const STATIC_FIELD_STRENGTH_TRACK = {
  toPos: (v: number): number => {
    const c = Math.max(STATIC_FIELD_STRENGTH_MIN, Math.min(STATIC_FIELD_STRENGTH_MAX, Number.isFinite(v) ? v : 0));
    return Math.sign(c) * Math.pow(Math.abs(c) / STATIC_FIELD_STRENGTH_MAX, 1 / STATIC_FIELD_STRENGTH_CURVE);
  },
  fromPos: (pos: number): number => {
    const p = Math.max(-1, Math.min(1, Number.isFinite(pos) ? pos : 0));
    const mag = STATIC_FIELD_STRENGTH_MAX * Math.pow(Math.abs(p), STATIC_FIELD_STRENGTH_CURVE);
    // ⚠️ **Quantise the MAGNITUDE and re-apply the sign — never `Math.round` a signed value**, and `toFixed`
    // rather than the bare product, which yields `0.7000000000000001` for a value the library authors as 0.7.
    // Both rules are `COLOUR_DRIFT_TRACK`'s, and the second one is why the round trip is exact at all.
    const q = Number((Math.round(mag / STATIC_FIELD_STRENGTH_GRID) * STATIC_FIELD_STRENGTH_GRID)
      .toFixed(STATIC_FIELD_STRENGTH_DECIMALS));
    // `Math.sign(p) * 0` is `-0`, which prints as `0` and compares equal but is a different stored number.
    return q === 0 ? 0 : Math.sign(p) * q;
  },
};

/**
 * The `Detail` track — **the ONE owner of those bounds, for the same reason `STATIC_FIELD_STRENGTH_MAX` is.**
 *
 * ⚠️ **These exist because the identification line can quote a `Detail` the slider cannot set, which is the
 * Strength problem in the other quantity and was missed when Strength was answered.** `identifyArchetype`
 * derives `detail` as a RATIO of a stored frequency to the archetype's own (`freqs[a][i] / archFreqs[a][i]`),
 * so it is a continuous number, while the slider is a bounded grid — and a readout that names a value the
 * control cannot reach is the *Slider tracks* defect (*"an authored value the track cannot represent is a
 * defect, readout precision included"*) wearing a derived value instead of an authored one.
 *
 * ⚠️ **Measured 2026-09-22, and the two halves came out opposite ways — which is why they are separate
 * properties rather than one.** Basis, stated because it is the whole of the claim: the **COMPOSED** library
 * (`loadLibrary` over `public/psss_presets.json`, so settled refinements replace their legacy keys), its
 * separable layers resolved through `chainFromOverlay`, and `identifyArchetype` run on each. **Resolution:
 * perfect — NOT ONE identifiable table lands off the 0.05 grid**, because the archetype frequencies are
 * 1/4/6/8/16 and the authored ones are integers, so every ratio that occurs is a multiple of 0.05.
 * **Reachability: THREE fall outside the RANGE** — `Lost In Another Sky` and `Lost In Another Sky II` at 0.125
 * (below `MIN`) and `Vertical Attraction` at 12.5 (above `MAX`). ⚠️ **The legacy JSON alone finds only TWO of
 * the three** (the refined `II` body exists in no source file), which is *Refined legacy presets*' rule biting
 * in a new place: **import the module, do not read the JSON.** ⚠️ **And do not reconcile any of these counts
 * with the 63 quoted above — that is a third basis**, taken when fewer refinements had settled. Re-run
 * `trackcheck` §M, which owns every figure here.
 *
 * ⚠️ **The three out-of-range members were NOT fixed by widening the track, and that is the decision.** Widening
 * to cover 12.5 would cost 25× the resolution everywhere the library actually sits to reach one preset, which
 * is the trade 21.13 already rejected at 4.0 for Strength. Instead `describeTermIdentity` STATES the case, the
 * answer the owner gave for Strength — so the wording must format THESE constants and never a hand-typed 0.25
 * or 8. `trackcheck` §M measures both halves and names all three presets, so a widening that made the sentence
 * unreachable would fail rather than pass quietly.
 */
export const STATIC_FIELD_DETAIL_MIN = 0.25;
/** @see STATIC_FIELD_DETAIL_MIN — the upper bound of the same track. */
export const STATIC_FIELD_DETAIL_MAX = 8;
/** @see STATIC_FIELD_DETAIL_MIN — its step, the half that measured CLEAN over the library. */
export const STATIC_FIELD_DETAIL_STEP = 0.05;

/** One archetype × `detail` that reproduces a stored wave table's SHAPE exactly. */
export interface ArchetypeIdentification {
  archetype: StaticFieldArchetype;
  /** The `detail` the archetype needs. May fall outside the Detail track — the caller says so, this does not. */
  detail: number;
  /**
   * The scalar the archetype's sum-normalised amplitudes are multiplied by to land on the stored ones.
   *
   * ⚠️ **This is NOT the required `strength`, and confusing the two is the trap.** It is the shape's scale in
   * the stored table's own units, which say nothing about pixels: the archetype branch's own scale comes from
   * `solveGain()` at the live canvas size, and it is canvas-DEPENDENT (measured: 1.54× between 16:9 and 1:1).
   * **A required `strength` can only be MEASURED, by resolving both regimes at one frame size and dividing
   * the peaks** — never derived from this number.
   *
   * ⚠️ **Its SIGN, however, is the one part of it that IS the required `strength`'s — and it is the only place
   * the inversion is visible at all.** A measured peak is a magnitude, so the ratio of two peaks can never
   * report a negated field: a reader that takes the size from a measurement and forgets to take the sign from
   * here will print a positive `Strength` that produces the mirror image (invariant 13's "the output channel
   * cannot show the result"). `describeTermIdentity` multiplies its measured ratio by `Math.sign(scale)`.
   */
  scale: number;
}

/**
 * Relative tolerance for "these stored terms ARE that archetype".
 *
 * ⚠️ **A tolerance is unavoidable and it is not the same thing as "nothing rounds".** The candidate `detail`
 * is a RATIO of two authored numbers, so an exact match still arrives with the last bit of a division on it;
 * the rows themselves store what the user typed, unrounded. 1e-9 is four orders looser than the bake's
 * measured element-wise error (≤ 1.8e-16) and eleven orders tighter than the smallest gap the library's own
 * frequencies leave between two archetypes (8 against 8.5 at detail 1), so it can neither reject a real match
 * nor merge two shapes. **It is not a similarity threshold** — widening it into one would make the
 * identification line a guess wearing the word "are".
 */
const IDENT_REL_EPS = 1e-9;

function nearlyEqual(a: number, b: number, ref: number): boolean {
  return Math.abs(a - b) <= IDENT_REL_EPS * Math.max(1, Math.abs(ref));
}

/**
 * **Which archetype × `detail` these stored terms are — the ONE owner, shared by the Transmap tab and
 * `fieldcheck`.** (v8 21.12 §D)
 *
 * ⚠️ **Two implementations of this rule is the defect, not a duplication to tidy later** — the same reason
 * the Composer has exactly one `ratioBase`. The tab prints the answer as a claim about reproducibility and
 * the checker asserts it over the library; if they can disagree, the printed claim is unfalsifiable.
 *
 * The rule, in the order it has to run:
 *
 * 1. An archetype's stored amplitudes are its `sumNormalise`d ones times ONE NON-ZERO scalar shared by both
 *    axes — because `resolveStaticWaves` applies one `gain` to both. ⚠️ **The scalar MAY BE NEGATIVE since
 *    2026-09-22** (the owner's *"allow Strength to go negative"*): a negative one negates the field, which was
 *    refused here as "a different field, not the same shape at another size" — true of the picture, and the
 *    wrong test, because `Strength` now reaches `STATIC_FIELD_STRENGTH_MIN` and so the negated field IS
 *    reachable from the dropdown. **The old rule made this function's answer depend on a slider bound, which
 *    is why it had to move when the bound did.** What must still hold is that ONE scalar covers both axes.
 * 2. Its frequencies are the archetype's times ONE `detail`, shared by both axes for the same reason.
 *    ⚠️ **`detail` stays strictly POSITIVE and that is not an oversight.** Every term of `buildWave`'s phase is
 *    proportional to the frequency, so negating all four frequencies negates the wave — i.e. a negative
 *    `detail` is just the negative-`scale` case a second time, and the `Detail` slider cannot reach it
 *    (`STATIC_FIELD_DETAIL_MIN` is 0.25). Admitting one would print a `Detail` no control can set.
 * 3. A slot whose archetype amplitude is 0 must store amplitude 0; its frequency is then unread (`sin(·)·0`),
 *    so it may hold anything — testing it would reject `Vertical Ripple` tables that carry a stray frequency
 *    in a dead slot.
 * 4. ⚠️ **Every archetype is tried and the smallest `|log detail|` wins — NOT the first match.** Preferring
 *    the first over-reports out-of-range Detail: it is what made "widening the Detail track buys 5 presets"
 *    read as true when the answer is 3, because `Star Dust` and `Warp2` are `Fine Mesh × 8` (inside the
 *    shipped track) and also `Coarse Swell × 128` (far outside it). Both are true; only one is the honest
 *    identification. ⚠️ **The SIGN is not part of that ranking**, so a table matching one archetype positively
 *    and another negatively is decided by `detail` alone and then by array order, exactly as two positive
 *    matches are. Preferring the positive reading was considered and rejected: it would make the printed answer
 *    depend on which of two shapes the list happens to hold first *and* on a sign, and `detail` is the quantity
 *    the user has to be able to SET. Measured over the composed library, no table has two matches at the same
 *    `|log detail|`, so the preference would be unreachable code today (`trackcheck` §M asserts it).
 *
 * ⚠️ **`detail` below the engine's own `max(0.05, detail)` clamp is rejected**, because such a match is not
 * reproducible: the engine would silently resolve the clamped value and the field would not come back.
 */
export function identifyArchetype(table: SinMagicParams): ArchetypeIdentification | null {
  const amps: readonly number[][] = [table[0]!, table[2]!];
  const freqs: readonly number[][] = [table[1]!, table[3]!];
  let best: ArchetypeIdentification | null = null;
  for (const arch of STATIC_FIELD_ARCHETYPES) {
    const archAmps = [sumNormalise(arch.xAmp), sumNormalise(arch.yAmp)];
    const archFreqs = [arch.xFreq, arch.yFreq];
    // The scale and the detail both come from the FIRST live slot, then every slot is verified against them.
    // Deriving each slot's own ratio and comparing ratios would be the same test written twice.
    // ⚠️ `scale === 0` is the "not found yet" SENTINEL as well as a rejection, and it survives the sign
    // widening precisely because 0 is the one scalar that is still no match: a negative scale stops the search
    // exactly as a positive one does. A separate `found` flag would be a second state saying the same thing.
    let scale = 0;
    let detail = 0;
    for (let a = 0; a < 2 && scale === 0; a++) {
      for (let i = 0; i < MAX_SIN_MAGIC; i++) {
        const aa = archAmps[a]![i]!;
        if (aa === 0) continue;
        scale = amps[a]![i]! / aa;
        const af = archFreqs[a]![i]!;
        if (af !== 0) detail = freqs[a]![i]! / af;
        break;
      }
    }
    // ⚠️ `Number.isFinite` is load-bearing and `!(scale > 0)` used to be doing that job silently: a stored
    // amplitude of Infinity over a normalised one yields Infinity, which every `nearlyEqual` below would then
    // compare against `Infinity * 0 = NaN`. Widening the sign test without it would admit a NaN "match".
    if (scale === 0 || !Number.isFinite(scale) || !(detail >= 0.05)) continue;
    let ok = true;
    for (let a = 0; a < 2 && ok; a++) {
      for (let i = 0; i < MAX_SIN_MAGIC; i++) {
        const aa = archAmps[a]![i]!;
        const want = aa * scale;
        if (!nearlyEqual(amps[a]![i]!, want, scale)) { ok = false; break; }
        if (aa === 0) continue;
        const wantF = archFreqs[a]![i]! * detail;
        if (!nearlyEqual(freqs[a]![i]!, wantF, wantF)) { ok = false; break; }
      }
    }
    if (!ok) continue;
    if (!best || Math.abs(Math.log(detail)) < Math.abs(Math.log(best.detail))) {
      best = { archetype: arch, detail, scale };
    }
  }
  return best;
}

/** What a term takeover produces: the stored tables plus the settings they must be written WITH. */
export interface StaticFieldBake {
  /** The shift table — `sinMagicParams`, in its `[xAmp, xFreq, yAmp, yFreq]` row order. */
  table1: SinMagicParams;
  /**
   * The zoom table — `sinMagicParams2`. **Null for styles 0-2, and null means DO NOT WRITE**, not "write
   * zeros": those styles never read the second table, so the preset's own second table is data the bake has
   * no business destroying. (*Preset format*: a gate destroys a block rather than omitting it — same rule.)
   */
  table2: SinMagicParams | null;
  /** The `strength` the caller must store alongside `table1`. Always the parity point. */
  strength: number;
  /** The `strength2` the caller must store alongside `table2`. */
  strength2: number;
  /**
   * **Null when this bake is the same field, or the sentence the user must read BEFORE editing a term** —
   * the ONE owner of the note under the rows, and the successor to the refusal `staticBakeBlocker()` used to
   * return. See `carryZoomBias`: the only inexactness left is a zoom half whose four slots are all taken, so
   * there is nowhere to put `zoomBias`'s constant term.
   *
   * ⚠️ **`warning === null` is exactly "the round trip is bit-tight", and `fieldcheck` §W asserts that
   * equivalence in both directions.** A warning gated on anything else — the style, the bias, a pattern name —
   * would drift out of step with the arithmetic it describes the moment either side changed (invariant 25:
   * the description owns the gate, and here the gate is the measurement itself).
   */
  warning: string | null;
}

/** See `StaticFieldBake.warning` and `carryZoomBias`. Stated once, so the note and the gate cannot diverge. */
const ZOOM_BIAS_UNCARRIED = 'This pattern’s zoom half already uses all four terms, so there is no slot left to '
  + 'hold Zoom Bias’s steady part: typing in a term keeps the ripple exactly and drops that steady zoom, '
  + 'because terms are always read at a bias of 1. ↺ Reset field puts it back.';

/**
 * **`zoomBias` written as terms** — the one place the two regimes' CONSTANT (DC) zoom is reconciled, and the
 * reason a style-3 layer can be edited at all (owner, 2026-09-23: *"the table remains editable"*).
 *
 * The asymmetry it closes is real arithmetic, not a missing feature. `buildZoomWave` sums
 * `bias*amp + sin(theta)*amp` per slot, and the table branch **hardcodes `bias = 1`** — so matching the
 * oscillation forces `amp' = amp` on every live harmonic, which forces the stored DC to `sum(amp)` and leaves a
 * deficit of `(bias - 1) * sum(amp)`. ⚠️ **The fix is a slot at FREQUENCY 0, which is pure DC on both paths:**
 * `centreAnchor(0, n, period)` is 0, `phase * 0` is 0 and `(360 * i * 0) / period` is 0, so its sine term is
 * `sin(0) = 0` at every pixel AND at every drift phase, and its whole contribution is the stored amplitude.
 *
 * ⚠️ **A slot the archetype already holds at frequency 0 is rescaled, not left alone** — it is DC on the
 * archetype path too, where it reads `bias * amp`, so storing `amp` unchanged would be the same defect one slot
 * over. At `bias = 0` that rescale frees the slot, which is then available to host the deficit.
 *
 * ⚠️ **`carried: false` is the ONE case with no equal table, and it is a property of the PATTERN, not of the
 * bias**: five of the fourteen archetypes (`Turbulent Weave`, `Ember Cascade`, `Harmonic Cascade`,
 * `Beat Swell`, `Prime Comb`) use all four amplitudes, so no slot is free. **The cross-axis fold was measured
 * and buys nothing**: `dz` reads `-(zX[x] + zY[y])/2`, so the deficit could legally be hosted in the OTHER
 * axis — but every archetype is written with the same slot occupancy on both axes, so an axis with no room
 * never has a sibling with room. One rule, and the deficit stays in the axis it came from, where the pane
 * summary can show it.
 *
 * ⚠️ **Equal in exact arithmetic, not bit-identical**, and that is the one place this differs from the shift
 * half: the archetype adds `bias * amp` inside each slot while the table adds `amp` inside each slot and the
 * remainder once, so the sums are reassociated. Measured at a few ulps of the wave's own peak (`fieldcheck`
 * §W1e derives the bound from `sum|amp| / peak` rather than picking one) — never make the zoom leg's oracle
 * `=== 0`, and never "fix" the shift half's exactness to match it.
 */
function carryZoomBias(amps: readonly number[], freqs: readonly number[], bias: number):
{ amp: number[]; freq: number[]; carried: boolean } {
  const amp = [0, 1, 2, 3].map(k => amps[k] ?? 0);
  const freq = [0, 1, 2, 3].map(k => freqs[k] ?? 0);
  let dc = 0;
  for (let k = 0; k < MAX_SIN_MAGIC; k++) {
    const a = amp[k]!;
    if (a === 0) continue;
    if (freq[k] === 0) { amp[k] = bias * a; continue; }
    dc += (bias - 1) * a;
  }
  if (dc === 0) return { amp, freq, carried: true };
  const free = amp.findIndex(v => v === 0);
  if (free < 0) return { amp, freq, carried: false };
  amp[free] = dc;
  freq[free] = 0;
  return { amp, freq, carried: true };
}

/**
 * The stored tables a layer's ARCHETYPE field is exactly equal to — the `⤓ Bake to terms` arithmetic.
 * Null when the layer is not on an archetype — which is the only refusal left, and it is expressed by the null
 * rather than by a second predicate (the `staticBakeBlocker()` this replaced returned a sentence for it that no
 * caller could ever show). **Read `warning` before presenting the result**; this function answers "what would
 * the terms be", not "is anything lost by taking them".
 *
 * ⚠️ **It reuses `archetypeTerms()` and must never compute a gain of its own.** The archetype branch's
 * amplitudes are `sumNormalise(arch.amp) × solveGain(…) × strength`, and `solveGain` scans the actual pixel
 * arrays at the live canvas size — so the scalar is canvas-DEPENDENT (`Grid Lattice` style 1: 0.0572 at 16:9
 * against 0.0883 at 1:1, a 1.54× swing, because the offset grows with distance from the centre while the
 * target tracks `min(w,h)`). That is the whole reason a bake is an explicit one-way button carrying the frame
 * size, and **never a display transform**: a silent bake would satisfy the round trip at the window size the
 * tab was opened at and break it at the next.
 *
 * ⚠️ **The returned `strength`/`strength2` are part of the answer, not a suggestion.** The table branch
 * multiplies by `strength / 0.5`, so storing these amplitudes at any other strength applies the measured gain
 * twice. The `fit` needs no per-style factor for the same reason it is returned separately by
 * `archetypeTerms` — `min(w,h)/100` is applied by BOTH branches and so cancels.
 *
 * ⚠️ **`detail` is left alone by design.** The baked frequencies already carry it and the table branch ignores
 * it, so the stored value is inert — and keeping it is what lets the user switch the pattern back and land on
 * the same field again.
 *
 * ⚠️ **`zoomBias` is left alone for the SAME reason, and writing it here would be a defect twice over**
 * (2026-09-23): the table branch never reads it, so the value is inert exactly as `detail` is and preserving it
 * is what makes switching the pattern back a return trip — and the `Zoom Bias` track is ±0.5, so the "set it to
 * 1" the old refusal advised is **not representable by the control at all**. The bias reaches the terms through
 * `carryZoomBias()` instead, as a frequency-0 slot.
 */
export function bakeStaticField(
  layer: TransMapLayer,
  width: number,
  height: number,
  centreX: number,
  centreY: number,
): StaticFieldBake | null {
  const s = staticFieldOf(layer);
  const arch = findArchetype(s.pattern);
  if (!arch) return null;
  // ⚠️ Through `waveMaps()`, never a hand-built identity map: the gain this bake COPIES is solved against
  // the probes, so a bake taken under a non-zero angle must solve at that angle or the stored amplitudes
  // describe a differently-oriented field. ⚠️ **`StaticFieldBake` still needs no new field** — the takeover's
  // patch base is `{ ...staticFieldOf(entry), ...patch }`, so all fifteen keys including the four angles
  // ride along (measured at `35.2`, asserted by `shapecheck` §K3b; do not narrow that spread).
  const t = archetypeTerms(s, arch, layer.style, width, height, centreX, centreY,
    sharedPeriod(width, height), waveMaps(s, width, height));
  // ⚠️ Written out as four fixed slots rather than mapped: `SinMagicParams` is a TUPLE of tuples, and `.map`
  // returns `number[]`, which would need a cast — and a cast here would accept a three-term row.
  const quad = (a: readonly number[]): [number, number, number, number] =>
    [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0];
  // ⚠️ **Through `carryZoomBias()`, which is where the zoom half's constant term is reconciled** — writing
  // `t.zoom.xAmp` straight out is the pre-2026-09-23 bake, which is exact only at `zoomBias === 1` and was
  // therefore refused for every other style-3 layer. Read that function's header before changing either side.
  const zx = t.zoom ? carryZoomBias(t.zoom.xAmp, t.zoom.xFreq, t.zoom.bias) : null;
  const zy = t.zoom ? carryZoomBias(t.zoom.yAmp, t.zoom.yFreq, t.zoom.bias) : null;
  return {
    table1: [quad(t.xAmp), quad(t.xFreq), quad(t.yAmp), quad(t.yFreq)],
    table2: zx && zy ? [quad(zx.amp), quad(zx.freq), quad(zy.amp), quad(zy.freq)] : null,
    strength: STATIC_FIELD_DEFAULTS.strength,
    strength2: STATIC_FIELD_DEFAULTS.strength2,
    warning: zx && zy && !(zx.carried && zy.carried) ? ZOOM_BIAS_UNCARRIED : null,
  };
}

/**
 * The defaults a layer with no `staticField` block behaves as.
 *
 * ⚠️ **`pattern: '(Preset)'` and `drift: 0` together are what keep all 203 shipped presets rendering
 * exactly as they did before this module existed.** `(Preset)` routes `resolveStaticField()` straight to
 * `config.sinMagicParams`, and `drift: 0` leaves the phase term at zero, so the field is the same field.
 * That is also the parity oracle the GLSL port is tested against — do not give either a non-zero default.
 */
export const STATIC_FIELD_DEFAULTS: Required<Omit<StaticFieldConfig, 'pattern2'>> & { pattern2: string } = {
  pattern: PATTERN_PRESET,
  strength: 0.5,
  detail: 1.0,
  drift: 0.0,
  pattern2: PATTERN_PRESET,
  strength2: 0.5,
  zoomBias: 0.0,
  // ⚠️ **TWO independent identities, both deliberate** (`35.D2`): `shape: 'sine'` and `shapeMix: 0` each make
  // the wave builder take the pre-change expression. Nothing may couple them — a shape pick must NOT imply a
  // non-zero mix, and a mix drag must NOT imply a shape. The notice line is the whole of the remedy.
  shape: 'sine',
  shapeMix: 0.0,
  shape2: 'sine',
  shapeMix2: 0.0,
  // ⚠️ **All four angles default to 0, which is the IDENTITY BY BRANCH, not by arithmetic** — see
  // `waveAxisMap()`. `0` makes every one of the four index consumers take the pre-change expression; it does
  // not make them compute a rotation by zero. `WAVE_ANGLE_MAX` is the range and ±90 is not arbitrary.
  angleX: 0.0,
  angleY: 0.0,
  angleX2: 0.0,
  angleY2: 0.0,
};

/** Read a layer's static-field settings with every default filled in (invariant 14 — flat scalars, `?? default`). */
export function staticFieldOf(layer: TransMapLayer | undefined): typeof STATIC_FIELD_DEFAULTS {
  const s = layer?.staticField;
  return {
    pattern: s?.pattern ?? STATIC_FIELD_DEFAULTS.pattern,
    strength: s?.strength ?? STATIC_FIELD_DEFAULTS.strength,
    detail: s?.detail ?? STATIC_FIELD_DEFAULTS.detail,
    drift: s?.drift ?? STATIC_FIELD_DEFAULTS.drift,
    pattern2: s?.pattern2 ?? STATIC_FIELD_DEFAULTS.pattern2,
    strength2: s?.strength2 ?? STATIC_FIELD_DEFAULTS.strength2,
    zoomBias: s?.zoomBias ?? STATIC_FIELD_DEFAULTS.zoomBias,
    shape: s?.shape ?? STATIC_FIELD_DEFAULTS.shape,
    shapeMix: s?.shapeMix ?? STATIC_FIELD_DEFAULTS.shapeMix,
    shape2: s?.shape2 ?? STATIC_FIELD_DEFAULTS.shape2,
    shapeMix2: s?.shapeMix2 ?? STATIC_FIELD_DEFAULTS.shapeMix2,
    angleX: s?.angleX ?? STATIC_FIELD_DEFAULTS.angleX,
    angleY: s?.angleY ?? STATIC_FIELD_DEFAULTS.angleY,
    angleX2: s?.angleX2 ?? STATIC_FIELD_DEFAULTS.angleX2,
    angleY2: s?.angleY2 ?? STATIC_FIELD_DEFAULTS.angleY2,
  };
}

/**
 * True when the settings are indistinguishable from the defaults — **the export gate.**
 *
 * ⚠️⚠️ **A FIELD MISSING FROM THIS PREDICATE IS DESTROYED, NOT OMITTED, AND IT IS THE ORDINARY SAVE PATH**
 * (invariant 17, Snapshot worst of all). Measured 2026-10-29 while `shape` was absent from here: a layer
 * whose ONLY non-default value was `shape: 'square'` read as all-default, so `normaliseChain()` dropped the
 * block when copying the chain AND `isLegacyExpressible()` returned true for the one-layer chain — which
 * keeps `transMapChain` out of `getSnapshot()` **entirely**. The user's field came back as `(Preset)` after a
 * round trip. **Export, Snapshot and the Mixer's deck all go through here.**
 *
 * ⚠️ **`tsc` CANNOT SEE AN OMISSION HERE.** `fieldcheck` §J asserts that every per-layer config *block*
 * appears in `isLegacyExpressible()`; it cannot see a sub-FIELD, so this predicate is unguarded in both
 * directions by the compiler. **`shapecheck` §C is the instrument**: every key of `STATIC_FIELD_DEFAULTS`
 * must be named in this function's own source text, seeded. That is `32.15`'s finding exactly — *a missing
 * clause reads exactly like a correct predicate over a shorter list.*
 */
export function isStaticFieldDefault(s: StaticFieldConfig | undefined): boolean {
  if (!s) return true;
  const d = STATIC_FIELD_DEFAULTS;
  return (s.pattern ?? d.pattern) === d.pattern
    && (s.pattern2 ?? d.pattern2) === d.pattern2
    && (s.strength ?? d.strength) === d.strength
    && (s.strength2 ?? d.strength2) === d.strength2
    && (s.detail ?? d.detail) === d.detail
    && (s.drift ?? d.drift) === d.drift
    && (s.zoomBias ?? d.zoomBias) === d.zoomBias
    && (s.shape ?? d.shape) === d.shape
    && (s.shapeMix ?? d.shapeMix) === d.shapeMix
    && (s.shape2 ?? d.shape2) === d.shape2
    && (s.shapeMix2 ?? d.shapeMix2) === d.shapeMix2
    // ⚠️ The four ANGLES (`35.3`). A layer whose only non-default value is `angleX: 28` must NOT read as
    // all-default — the measured failure mode is identical to `shape`'s: `normaliseChain()` drops the block,
    // `isLegacyExpressible()` returns true, and `getSnapshot()` emits no `transMapChain` key at all.
    && (s.angleX ?? d.angleX) === d.angleX
    && (s.angleY ?? d.angleY) === d.angleY
    && (s.angleX2 ?? d.angleX2) === d.angleX2
    && (s.angleY2 ?? d.angleY2) === d.angleY2;
}

function sumNormalise(a: readonly number[]): number[] {
  let s = 0;
  for (const v of a) s += Math.abs(v);
  return s > 0 ? a.map(v => v / s) : a.slice();
}

/**
 * The orientation range for every one of the four wave angles, in DEGREES. **±90, never 0–360.**
 *
 * ⚠️ **Two independent reasons, and a reader who finds only one of them will widen the range.** See
 * `StaticFieldConfig.angleX`: `(angle + 180°, −amp)` is bit-identical, so 0–360 offers every field twice;
 * and ±90 has no wrap, so `blendLayerBlocks()`' plain `mix()` is the shortest path. **The UI track and the
 * Mixer law both depend on this constant** — it is not a clamp (nothing clamps a stored value here, exactly
 * as nothing clamps `strength`), it is the range the control spans and the range the lerp is correct over.
 */
export const WAVE_ANGLE_MAX = 90;

/**
 * **The Y wave's baked-in quarter turn, in degrees** — `waveAxisMap`'s `quarterTurn` arm, and the thing that
 * makes `angleX = angleY = 0` the orthogonal pair rather than a parallel one.
 *
 * ⚠️⚠️ **IT IS NOT `WAVE_ANGLE_MAX`, AND THE TWO BEING 90 IS A COINCIDENCE OF NUMBERS, NOT OF MEANING.** One
 * is how far a control may travel; this one is a fixed rotation inside the index. Invariant 24's rule —
 * *where two subsystems meet, measure the direction of the scale; never read it off a comment* — in its
 * cheaper form: **two quantities wearing one number need two names**, or widening the range to ±120 would
 * silently re-aim the quarter turn. It is exported because `field-measure.ts`' notice predicate has to ask
 * *"are the two sampling directions parallel"*, which is a question about `angleY + this`, and a second
 * hand-typed `90` there is the enumeration this constant exists to prevent.
 */
export const WAVE_QUARTER_TURN = 90;

/**
 * Position resolution of the angle sliders — **a NEGATIVE POWER OF TWO, and that is a browser finding
 * rather than a taste.**
 *
 * ⚠️⚠️ **`1 / WAVE_ANGLE_MAX` WAS THE OBVIOUS CHOICE AND IT MADE +90° UNREACHABLE IN CHROMIUM.** Measured
 * 2026-10-29 in a real browser (`35.4`, and no instrument outside one could have seen it): with
 * `min="-1" max="1" step="0.011111111111111112"` the top of the travel is **89°, not 90°** — the readout
 * printed `89°` for a handle dragged to the end. **A form control's stepping is evaluated in base-10
 * `Decimal`, not in doubles**, and the allowed values are `min + k·step` that are **≤ max** with no
 * clamping: in exact decimal `-1 + 180 × 0.011111111111111112` is `1.00000000000000016`, which exceeds
 * `max`, so `k = 180` is refused and the last stop is `k = 179`. ⚠️ **In IEEE doubles that same expression
 * is exactly `1`**, so a Node model of the grid reports the track as perfect — *a measuring section's own
 * basis has been the defect repeatedly*, and this is that rule with the basis being the arithmetic itself.
 *
 * ⚠️ **A negative power of two is exact in BINARY *and* IN DECIMAL**, so the grid closes at both ends under
 * either arithmetic: `-1 + 256 × 0.0078125` is `1` in both. ⚠️ **Derived from `WAVE_ANGLE_MAX`, so widening
 * the range moves the resolution with it** (*Slider tracks*: **widening a range must move `1/STEP` with
 * it**) — the exponent is the smallest one that keeps the increment at or under one degree per stop,
 * `WAVE_ANGLE_MAX / 2^bits = 0.703°` today, which is what makes **every whole degree reachable** with a
 * worst dead run of 2 stops against the 60-stop house ceiling. `trackcheck` §M measures all of it.
 */
const WAVE_ANGLE_POS_BITS = Math.ceil(Math.log2(WAVE_ANGLE_MAX));

export const WAVE_ANGLE_STEP = 1 / 2 ** WAVE_ANGLE_POS_BITS;

/**
 * The angle track — **LINEAR, so the only thing it buys is the position/value split and the quantiser.**
 *
 * ⚠️⚠️ **`fromPos` ROUNDS TO WHOLE DEGREES, AND THAT IS THE QUANTISER RATHER THAN A TIDY-UP.** The position
 * grid is finer than one degree by construction (`WAVE_ANGLE_STEP`: 257 stops over 181 degrees, 0.703° per
 * stop), so without the rounding a drag would store `28.828125` — a value no author can type, no second
 * drag can return to, and `trackcheck`'s *"an authored value a track cannot represent is a defect"* in the
 * only direction that reaches an export. **With it, all 257 stops land on one of exactly 181 whole degrees,
 * both ends and 0 included.**
 *
 * ⚠️ **0 must be exactly reachable because `waveAxisMap` BRANCHES on `angleDeg === 0`**, and a rotation BY
 * zero is not the same thing (`cos(90°)` is `6.12e-17`) — a stop that printed `0°` over a rotated field
 * would lose `35.2`/`35.3`'s entire bit-identity contract to a slider. That is why the clause asserts it
 * rather than trusting the grid.
 *
 * ⚠️ **Quantise in the STORED unit** (*Slider tracks*), which here is degrees — and that unit is why
 * `Math.round` is enough where `STATIC_FIELD_STRENGTH_TRACK` needs a grid constant and a `toFixed`.
 *
 * ⚠️ **Nothing here CLAMPS a stored angle** — `35.D2` and §9.1 forbid refusing a degenerate orientation, so
 * `toPos` clamps only the HANDLE (an imported 120° parks at the end of the travel and keeps rendering at
 * 120° until the user drags), exactly as `WAVE_ANGLE_MAX`'s own header says. `trackcheck` §M owns the
 * measurement of all 181 stops.
 */
export const WAVE_ANGLE_TRACK = {
  toPos: (v: number): number => {
    const c = Math.max(-WAVE_ANGLE_MAX, Math.min(WAVE_ANGLE_MAX, Number.isFinite(v) ? v : 0));
    return c / WAVE_ANGLE_MAX;
  },
  fromPos: (pos: number): number => {
    const p = Math.max(-1, Math.min(1, Number.isFinite(pos) ? pos : 0));
    /*
     * ⚠️⚠️ **QUANTISE THE MAGNITUDE AND RE-APPLY THE SIGN — NEVER `Math.round` A SIGNED VALUE.** This is
     * `COLOUR_DRIFT_TRACK`'s and `STATIC_FIELD_STRENGTH_TRACK`'s rule, and it is load-bearing here rather
     * than inherited: the position grid is a power of two and the stored unit is a degree, so ties at
     * exactly ±0.5° are REACHABLE — four of them, at `k = 32 / 96 / 160 / 224`, where `|p| · 90` is
     * `67.5` or `22.5`. `Math.round` breaks a tie toward `+Infinity`, so a bare round gave `-67` on the
     * left of centre and `+68` on the right: **the same handle distance from 0 reading a different angle
     * depending on which side it is, which `trackcheck` §M caught as the oddness clause going red.**
     *
     * ⚠️ `Math.sign(p) * 0` is `-0`, which prints as `0` and compares equal but is a different stored
     * number — and `waveAxisMap` tests `angleDeg === 0`, where `-0 === 0` is true, so this is about what an
     * EXPORT carries rather than about the branch.
     */
    const mag = Math.round(Math.abs(p) * WAVE_ANGLE_MAX);
    return mag === 0 ? 0 : Math.sign(p) * mag;
  },
};

/**
 * **How ONE wave array is indexed** — the `35.3` object, and the place the phase origin is kept apart from
 * the array length.
 *
 * ⚠️⚠️ **`length` AND `anchorLen` ARE TWO QUANTITIES THAT USED TO BE ONE ARGUMENT (`n`), AND THAT IS THIS
 * STEP'S LANDMINE.** `buildWave` took a single `n` and handed it BOTH to `new Float64Array(n)` and to
 * `centreAnchor(freq, n, period)`. A rotated sample ranges over the frame's DIAGONAL, so the table has to
 * widen from `max(w,h)` to `hypot(w,h)` (+14.7 % at 1080p) — and widening the `centreAnchor` argument with
 * it **moves the field**. Pinning the anchor to the axis length instead gives **0.000e+0**, bit-identical.
 *
 * ⚠️ **The displacement is EXACT, frequency-independent, and that is the form to quote: `(length − anchorLen)/2`
 * — at 1920×1080 that is `143.5` texels on X and `563.5` on Y.** An amplitude figure is basis-dependent and a
 * table length is easy to get wrong: ⚠️⚠️ **this header previously read `1920 → 2203` shifting the wave by
 * `1.943`, and BOTH numbers were wrong — the shipped length is `2·(⌈hypot/2⌉+1)+1 = 2207` (2203 is `hypot`
 * ROUNDED, which is not a table length), and against the shipped length `shapecheck` §N2c's seed measures
 * `1.886`.** Corrected 2026-10-29, found because a doc pass re-derived the figure instead of copying it.
 * **The comment and the instrument had disagreed, and the instrument was right** — so prefer the closed form,
 * which no basis change can invalidate, over a measured amplitude that one can.
 *
 * That is invariant 26's *correct once per QUANTITY, not once per file*, in the same one-line expression that
 * had already shipped a silent origin bug once (see `centreAnchor` — the figure rendered off-centre at
 * 1920×1200 and shipped). **`anchorLen` is ALWAYS the axis length — `width` for an X wave, `height` for a Y
 * wave — and `length` is the table. Never derive either from the other.**
 *
 * ⚠️⚠️ **GATING THE WIDENING ON `angle !== 0` IS NOT THE FIX for that defect and must not be read as one.**
 * The split is the fix. The gate below is then a pure *allocation* choice whose harmlessness is a
 * MEASUREMENT, not an argument: `shapecheck` §N1 runs the rotated path at angle 0 against a table widened
 * anyway and asserts the two agree bit-for-bit at every pixel, which is what proves 0° does not jump to 1°.
 * Remove the split and that clause goes red by 1.9 while a shape-invariance test stays green — *"a
 * shape-invariance property test is not sufficient on its own: it passes for a field that is correctly
 * shaped and wrongly placed."*
 */
export interface WaveAxisMap {
  /**
   * ⚠️⚠️ **`false` means every consumer takes the PRE-CHANGE EXPRESSION — a bare `arr[x]` — and NOT a
   * rotation by zero.** Bit-identity is not algebraic identity: `cos(90°)` is `6.12e-17`, not 0, so a Y wave
   * "rotated by zero" would read `h/2 + 6.12e-17·(x − w/2) + (y − h/2)`, which is not `y`. **Branch, never
   * weight** — the same rule, for the same reason, as `35.2`'s identity arm in `buildWave`.
   */
  rotated: boolean;
  /** Direction cosine of the sampling axis. Meaningless, and unread, when `rotated` is false. */
  cos: number;
  /** Direction sine of the sampling axis. Meaningless, and unread, when `rotated` is false. */
  sin: number;
  /** The AXIS COORDINATE of table index 0: entry `i` holds the wave at `i + origin`. 0 when not rotated. */
  origin: number;
  /** Samples in the table. Equals `anchorLen` when not rotated; `hypot(w,h)`-sized when rotated. */
  length: number;
  /**
   * ⚠️⚠️ **THE PHASE ORIGIN'S AXIS LENGTH — `width` for an X wave, `height` for a Y wave, ALWAYS.** This is
   * `centreAnchor`'s second argument and it must NEVER be `length`. See this interface's header.
   */
  anchorLen: number;
  /**
   * The TABLE INDEX the frame centre maps to: `anchorLen / 2 − origin`, precomputed because the sampler runs
   * once per particle per frame (invariant 8's class — see `staticOffsetAt`).
   *
   * ⚠️ **It is `anchorLen / 2` and not `length / 2`, and that is the whole split in one expression.** The
   * frame centre is where `centreAnchor` reproduces legacy's phase, so pinning the rotation's pivot there is
   * what makes the field's centre value ANGLE-INVARIANT — the quantity `fieldcheck` §A5 already asserts
   * along the canvas-shape axis, asserted here along the angle axis.
   */
  centreIndex: number;
}

/** The four maps one static layer needs: the two SHIFT waves and style 3's two ZOOM waves. */
export interface StaticWaveMaps {
  x: WaveAxisMap;
  y: WaveAxisMap;
  /** Style 3's zoom X wave, from `angleX2` — a SECOND FUNCTION's parameter, not a second pair on one. */
  zx: WaveAxisMap;
  zy: WaveAxisMap;
}

/**
 * One axis's index mapping. ⚠️ **`quarterTurn` is the Y wave's BAKED-IN +90°** — stored angles are measured
 * from the orthogonal pair, so `angleX = angleY = 0` is exactly the pre-`35.3` field and the default is the
 * identity.
 *
 * ⚠️ **The widened table is centred on the axis, not on index 0.** `origin` is negative by construction, so
 * `i + origin` runs from `round(axisLen/2) − half` through `round(axisLen/2) + half`, covering
 * `axisLen/2 ± hypot(w,h)/2` — which is the full range a rotated sample can reach, since
 * `(w/2)|cos| + (h/2)|sin| ≤ hypot(w/2, h/2)`. The `+ 1` in `half` and the `2·half + 1` length together
 * leave `floor(t) + 1` in range for the 2-tap lerp at every pixel and at every angle, with no clamp doing
 * load-bearing work.
 */
function waveAxisMap(angleDeg: number, axisLen: number, diag: number, quarterTurn: boolean): WaveAxisMap {
  // ⚠️⚠️ **NaN-SAFE BY SHAPE, not by a clamp — the same rule, for the same reason, as `resolveShape`'s mix
  // test.** The predicate is *"is this a usable non-zero angle"*, so a hand-edited import carrying
  // `angleX: null`/`NaN`/`Infinity` falls to the IDENTITY arm. Written the other way round
  // (`if (angleDeg === 0)`) a NaN would take the ROTATED arm, `cos`/`sin` would be NaN, `Math.floor(NaN)`
  // would pass BOTH bound tests (every NaN comparison is false), `arr[NaN]` would be `undefined` and the
  // whole wave array — and from it the displacement texture — would be NaN. **No sanitiser on the screen
  // path reaches that** (invariant 20/21's class), and `Math.min`/`Math.max` would NOT fix it: `Math.min(90,
  // Math.max(-90, NaN))` is NaN. `shapecheck` §N1c asserts it, seeded with the inverted test.
  if (!Number.isFinite(angleDeg) || angleDeg === 0) {
    // The identity, and it is the pre-change shape of every field below: table length = axis length,
    // origin 0, so `buildWave`'s `i + origin` is `i` and the samplers' `arr[x]` is unchanged.
    return { rotated: false, cos: 1, sin: 0, origin: 0, length: axisLen, anchorLen: axisLen,
      centreIndex: axisLen / 2 };
  }
  // ⚠️ `WAVE_QUARTER_TURN`, never a literal 90 — `field-measure.ts`' parallel test asks about `angleY` PLUS
  // this same rotation, and two hand-typed copies of it is how the notice comes to describe a different
  // geometry from the one the sampler indexes. See that constant's header for why it is not `WAVE_ANGLE_MAX`.
  const a = (angleDeg + (quarterTurn ? WAVE_QUARTER_TURN : 0)) / DEG;
  const half = Math.ceil(diag / 2) + 1;
  const origin = Math.round(axisLen / 2) - half;
  return { rotated: true, cos: Math.cos(a), sin: Math.sin(a), origin, length: 2 * half + 1,
    anchorLen: axisLen, centreIndex: axisLen / 2 - origin };
}

/**
 * The ONE owner of "how are this layer's four waves indexed". ⚠️ **`resolveStaticWaves`, `archetypeTerms`'
 * unit-gain probes, both gain solves, `staticOffsetAt` and the GLSL uniform upload all read THIS** — a
 * second derivation anywhere is a place for the rotation to disagree with the table it indexes, which is
 * exactly the one-sided-change defect `fieldcheck` §D cannot see.
 *
 * ⚠️ **`(fx, fy)` IS THE FRAME CENTRE AND IS NOT `centreX`/`centreY`.** In this subsystem
 * `centreX`/`centreY`/`uStaticCentre` mean the ZOOM centre, resolved per layer from
 * `zoomCenter?.x ?? config.zoomCenterX` and read only by styles 1–3's radial scaling. The wave index has
 * never depended on it, and rotating about it would couple the wave's phase origin to a control that has
 * never touched it — a new cross-dependence on every preset authoring a `zoomCenter`. The frame centre is
 * `anchorLen / 2` per axis, which is also where `centreAnchor` reproduces legacy's phase; the two symbols
 * are deliberately spelled differently.
 */
export function waveMaps(s: typeof STATIC_FIELD_DEFAULTS, width: number, height: number): StaticWaveMaps {
  const diag = Math.hypot(width, height);
  return {
    x: waveAxisMap(s.angleX, width, diag, false),
    y: waveAxisMap(s.angleY, height, diag, true),
    zx: waveAxisMap(s.angleX2, width, diag, false),
    zy: waveAxisMap(s.angleY2, height, diag, true),
  };
}

/**
 * **Sample one wave array at pixel `(x, y)`** — the TS half of the index, and one of FOUR consumers.
 *
 * ⚠️⚠️ **THE ROTATED INDEX IS FRACTIONAL, SO THIS IS A 2-TAP LERP.** `staticOffset()`'s GLSL comment records
 * that `floor()` *"recovers i exactly"* because `vUv` at a pixel centre is `(i + 0.5)/n` — **a rotated
 * coordinate recovers nothing exactly.** Nearest instead would stair-step along the wave's own iso-lines,
 * and `trans-map.ts` already records that *"a one-texel sampling difference on a high-contrast trail is
 * visible as a stipple."* The lerp is ARITHMETIC, not a filter mode: the texture sampler stays `NEAREST` and
 * the fetch stays `texelFetch`, so a discontinuous wave cannot be smoothed by accident.
 *
 * ⚠️ **`idx` is the PRE-CHANGE index — `x` for an X wave, `y` for a Y wave — and the unrotated arm returns
 * `arr[idx] ?? 0` verbatim**, including the `?? 0` that an out-of-range index relied on. `dx`/`dy` are the
 * pixel's offset from the FRAME CENTRE, hoisted by the caller because this runs once per particle per frame.
 *
 * ⚠️ **`m` may be `undefined`, and that means NOT ROTATED.** `ResolvedStaticLayer.maps` is optional so that
 * the oracles which hand-build a layer (`fieldcheck` §A's `separableField`, `field-measure.ts`) keep
 * working; `resolveStaticWaves` always publishes it, so the only layers reaching here without one are
 * angle-free by construction. ⚠️ **A layer with rotated WAVES and no `maps` would silently sample them
 * unrotated** — `shapecheck` §N4 asserts `resolveStaticWaves` publishes the maps and that `rebuildStaticField`
 * forwards them, because that is the only thing standing between the two cases.
 */
function sampleWave(
  arr: Float64Array,
  m: WaveAxisMap | undefined,
  idx: number,
  dx: number,
  dy: number,
): number {
  // ⚠️ The PRE-CHANGE EXPRESSION, taken by a BRANCH. A rotation by zero is not this — see `WaveAxisMap`.
  if (m === undefined || !m.rotated) return arr[idx] ?? 0;
  const t = m.centreIndex + dx * m.cos + dy * m.sin;
  const i0 = Math.floor(t);
  // Defensive only: `waveAxisMap`'s `half` is derived to make both taps in-range at every pixel and angle.
  // A clamp that ever fires would mean the derivation is wrong, so it must not be load-bearing — and the
  // clamp is to the ARRAY's own length, never to the texture width, which is a max over all four tables.
  if (i0 < 0) return arr[0] ?? 0;
  if (i0 + 1 >= arr.length) return arr[arr.length - 1] ?? 0;
  const a = arr[i0]!;
  return a + (arr[i0 + 1]! - a) * (t - i0);
}

/**
 * The phase constant that anchors a wave to the FRAME CENTRE rather than to pixel 0.
 *
 * ⚠️ **This is the second half of the aspect fix and it is an INDEPENDENT quantity from the divisor — the
 * shared `period` fixed the wave's SCALE and left its ORIGIN wrong.** Legacy divided by each axis's own
 * length, which was the aspect bug, but it also meant `i/n` reached 0.5 at the frame centre on every canvas,
 * so a wave always had the SAME phase in the middle of the frame whatever the shape. Sharing the divisor
 * silently gave that property up: with `sin(2*pi*f*i/period)` anchored at pixel 0, the phase at the centre
 * becomes `pi*f*n/period`, which varies with the canvas. Reported as *"the fullscreen image isn't having the
 * image fully centered"* on `Sphere new` — style 2's eye (where the zoom factor reaches 0) sat at x = **0.313**
 * of the frame at 1920x1200 against 0.500 at the near-square 960x1036 preview, and the preview escaped it
 * only because 960x1036 is nearly 1:1. **Correcting once per quantity, not once per file** (invariant 24):
 * this is the origin, `sharedPeriod` is the scale.
 *
 * ⚠️ **A PRESET CANNOT COMPENSATE FOR THIS, which is why it had to be fixed in code.** The frequency that
 * would re-centre the eye is `min(w,h)/(2*w)` — canvas-DEPENDENT: 0.5 at 960x1036, 0.3125 at 1920x1200,
 * 0.2109 at 2560x1080. A preset holds one number, so authoring 0.3125 to fix fullscreen moves the eye to
 * 0.800 in the preview and rescales the pattern as a side effect. A canvas-dependent error is not
 * cancellable by a canvas-independent constant.
 *
 * ⚠️ **Measured reach: 172 of the 174 legacy presets with a non-degenerate wave table** had their
 * centre-of-frame phase disturbed at some canvas shape (worst centre-value error 82.3). It read as a
 * mis-centred figure rather than as a phase error, so nothing but a screenshot could have localised it.
 *
 * ⚠️ **Zero when `n === period`, i.e. at ANY SQUARE canvas — verified bit-identical to the pre-anchor form
 * (max |diff| 1.55e-15 over 3 sizes x 4 harmonics).** That is what preserves `fieldcheck` §A1's legacy
 * anchor: §A1 evaluates at 1:1, where this term vanishes and the whole formula is the pre-port one. §A5
 * asserts the property this term exists for — centre-phase parity with legacy at NON-square shapes, where it
 * measures 9.09e-12 against the shipped form's 82.3.
 *
 * Derivation: `sin(2*pi*f*(i - n/2)/period + pi*f)` = `sin(2*pi*f*i/period + pi*f*(1 - n/period))`, so the
 * whole correction is one additive constant per harmonic — no per-sample cost, and the `+ pi*f` term is what
 * reproduces legacy's own phase at the centre rather than merely centring the wave on zero.
 */
function centreAnchor(freq: number, n: number, period: number): number {
  return Math.PI * freq * (1 - n / period);
}

/**
 * Build one 1D wave array — the separable core every style shares.
 *
 * ⚠️ **The phase term is `phase * freq`, NOT `phase`.** Because `sin(2*pi*f*i/n + phase*f)` equals
 * `sin(2*pi*f*(i/n + phase/(2*pi)))`, scaling the phase by each harmonic's OWN frequency shifts every
 * harmonic by the same SPATIAL amount, so a multi-harmonic field TRANSLATES RIGIDLY. A bare `+ phase`
 * would advance each harmonic by a different distance, and the field would boil in place — which is the
 * standing-nodal-lattice problem drift exists to fix, reintroduced one term later. Not an approximation:
 * it is exact for every harmonic.
 *
 * ⚠️ **`n` is the ARRAY LENGTH but `period` is the CYCLE LENGTH, and they are deliberately DIFFERENT on a
 * non-square canvas. Never collapse them back into one argument.** The frequency divisor used to be `n`
 * itself, i.e. each axis's own pixel count, so a wave completed `freq` cycles across the WIDTH *and* `freq`
 * cycles across the HEIGHT — its spatial period in pixels was proportional to that axis's own length, and
 * the whole field was stretched by exactly the canvas aspect ratio. Reported as *"the figure is slightly
 * horizontally distorted"* on a preview→fullscreen toggle: measured on `Sphere new` (style 2, authored freq
 * 0.5), the zoom rings went from period 1920×2072 px at 960×1036 (ring aspect 0.927, near-circular) to
 * 3840×2400 at 1920×1200 (aspect **1.600**, a visibly wide ellipse) — a **1.7267× horizontal stretch that
 * equals the canvas aspect change to four decimals**. That exact equality is what identified the divisor:
 * the ring geometry was a pure function of canvas aspect and of nothing else.
 *
 * ⚠️ **`min(w,h)` is not a free choice — it is ALREADY this subsystem's length scale**, so this makes the
 * field consistent with itself rather than introducing a second convention: `solveGain` targets a peak of
 * `STATIC_FIELD_TARGET_FRACTION * min(w,h)`, and style 0's amplitude `fit` is `min(w,h)/100`. Amplitude was
 * therefore isotropic all along while frequency was not, which is why the defect read as a *shape* change
 * and never as a strength change.
 *
 * ⚠️ **At a SQUARE canvas `period === n` and this is an arithmetic identity**, which is what keeps
 * `fieldcheck` §A's legacy-parity oracle meaningful: it compares against an independent transcription of the
 * pre-port 2D formula, and that oracle is still exact — it just has to be evaluated at 1:1. §A now asserts
 * both halves (identity when square, aspect-invariance when not).
 *
 * ⚠️ **THE DIVISOR WAS ONLY HALF THE FIX AND SHIPPING IT ALONE CAUSED A SECOND, VISIBLE DEFECT — see
 * `centreAnchor`.** Sharing `period` corrected the wave's SCALE and silently broke its ORIGIN: legacy's `i/n`
 * reached 0.5 at the frame centre on every canvas, so the centre phase was shape-invariant for free, and
 * `i/period` is not. The figure then rendered off-centre on a wide canvas (`Sphere new`'s style-2 eye at
 * x = 0.313 instead of 0.500 at 1920x1200) — a NEW report one sitting after the aspect fix was called done.
 * **This is invariant 26's own "correct once per QUANTITY, not once per file" clause turned on its author:**
 * frequency scale and phase origin are two quantities, both expressed in the same one-line expression, and
 * fixing the first made the second wrong in a way no existing assertion could see. **A shape-invariance
 * property test is not sufficient on its own — it passes for a field that is correctly shaped and wrongly
 * placed**, which is exactly what shipped (§A3's circularity ratio was 1.0000 throughout).
 *
 * ⚠️⚠️ **THE SHAPE'S IDENTITY ARM IS THE PRE-CHANGE EXPRESSION, VERBATIM, AND IT IS A BRANCH RATHER THAN A
 * ZERO WEIGHT BECAUSE BIT-IDENTITY IS NOT ALGEBRAIC IDENTITY** (`35.2`). `(1 - 0) * Math.sin(th) + 0 * fn(th)`
 * is exact for every finite value **except `-0`**, and `-0` is REACHABLE here: at `i === 0` with a NEGATIVE
 * frequency on a square canvas every term of `th` is `-0` or `+0` summing to `-0`, so `Math.sin(th)` is `-0`
 * — while `0 * sqrSin(-0)` is `+0` (`Math.sign(-0)` is `-0`, which is **falsy**, so the `|| 1` guard returns
 * `1`), and `-0 + 0` is `+0`. ⚠️ **Measured 2026-10-29: today that difference does NOT reach `out[i]`,
 * because the accumulator starts at `+0` and `0 + (-0)` is `+0` — so the two forms happen to agree on this
 * function's OUTPUT.** That is an accident of `let s = 0`, not a property of the arithmetic: it would stop
 * being true the moment the accumulation changed shape. **The branch is what makes the guarantee
 * structural rather than lucky, it is also the cheaper arm, and `fieldcheck` §A1's oracle is bit-exact —
 * do not "simplify" the two arms into one.** The multiplication order is likewise the shipped one term for
 * term: the ternary sits INSIDE the `… * amps[k]!` product and neither factor may move (see
 * `ArchetypeTerms`' header on `v * gain` then `* fit`).
 *
 * ⚠️⚠️ **A FREQUENCY-0 SLOT IS EXEMPT FROM THE SHAPE, DELIBERATELY, AND THE REASON IS THAT IT HAS NO WAVE.**
 * Every term of the argument carries `freq` as a factor — `(360·i·f)/period`, `centreAnchor`'s
 * `π·f·(1 − n/period)` and `phase·f` alike — so at `f === 0` the argument is **exactly 0 at every pixel and
 * at every drift phase**. `Math.sin(0)` is 0, so such a slot contributes nothing here and exactly
 * `bias · amp` in `buildZoomWave`; that is `carryZoomBias()`'s entire premise and the bake's bit-tightness
 * rests on it. ⚠️ **Two of the five shapes are nonzero there** — `sqrSin(0) === 1` and `sawSin(0) === -1` —
 * so without the exemption a *dead* slot would come alive as a DC term the moment a shape was picked:
 * measured **7 slots across 5 shipped presets** carry a frequency-0 slot at a nonzero amplitude
 * (`Penta Star System`, `Penta Star Eternal Flow`, `Anima Electrica`, `The Real Black Hole`, `Voyager`),
 * reading as a translated field on the shift half and as a changed steady zoom on the zoom half.
 * ⚠️ `PHASE35-KEYS.md` §3.2 states this of `square` ONLY and offers the exemption as one of two
 * options for `buildZoomWave` alone. **Both halves of that are too narrow: `sawtooth` breaks it too, and
 * `buildWave` is reachable (4 of the 7 slots are shift slots).** The exemption is in both builders and
 * covers both shapes.
 *
 * ⚠️ `shape` and `mix` reach here from `staticFieldOf()`, resolved ONCE per build through `resolveShape()` —
 * never per sample, and never as a `Record` lookup inside the loop.
 */
function buildWave(
  amps: readonly number[],
  freqs: readonly number[],
  map: WaveAxisMap,
  phase: number,
  period: number,
  shape: WarpShape,
  shapeMix: number,
): Float64Array {
  const { fn, mix } = resolveShape(shape, shapeMix);
  const n = map.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // ⚠️⚠️ **`p` IS THE AXIS COORDINATE AND `map.anchorLen` IS THE AXIS LENGTH — the two quantities `n` used
    // to carry.** `origin` is 0 and `length === anchorLen` when the wave is unrotated, so `i + 0` is `i` and
    // this line is bit-identical to the pre-`35.3` one. Read `WaveAxisMap`'s header before changing either.
    const p = i + map.origin;
    let s = 0;
    for (let k = 0; k < MAX_SIN_MAGIC; k++) {
      const f = freqs[k]!;
      const th = ((360 * p * f) / period) / DEG + centreAnchor(f, map.anchorLen, period) + phase * f;
      // ⚠️ The first arm is the PRE-CHANGE EXPRESSION. See the two paragraphs above before touching either.
      s += (fn === null || f === 0
        ? Math.sin(th)
        : (1 - mix) * Math.sin(th) + mix * fn(th)) * amps[k]!;
    }
    out[i] = s;
  }
  return out;
}

/**
 * The shared spatial period every axis's frequency is measured against — the fix for the aspect stretch.
 *
 * ⚠️ **One scale for BOTH axes is the entire point; a per-axis value is the defect.** See `buildWave`.
 * `min(w,h)` matches `solveGain`'s and style 0's existing use of the same measure, so the field's frequency
 * and its amplitude now share one convention.
 *
 * ⚠️ **The consequence is deliberate and is the reason the field can exceed the frame on the long axis:** at
 * 1920×1080 a freq-1 pattern now has a period of 1080 px on both axes, so it repeats ~1.78 times across the
 * width instead of once. That is what makes a circle a circle. `rollToRange` in `staticOffsetAt` already
 * wraps the sample coordinate, so more cycles across the long axis needs no other change.
 */
function sharedPeriod(width: number, height: number): number {
  return Math.max(1, Math.min(width, height));
}

/**
 * Solve the amplitude gain that makes peak displacement equal `strength * 8%` of `min(w,h)`.
 *
 * Displacement is LINEAR in the gain for all four styles, so measuring the peak of a unit-gain field and
 * dividing is exact — no iteration. The scan is `GAIN_SCAN^2` samples of two 1D arrays, which is why this
 * is affordable at all.
 *
 * ⚠️ **Called on CHAIN CHANGE, never per frame.** The peak is drift-INVARIANT (drift is a rigid
 * translation, measured 0.26 pp over phase 0..pi), so re-solving it each frame would burn 0.8 ms to compute
 * the same number — invariant 8's allocation-rate trap in CPU form.
 *
 * ⚠️ **An analytic bound is NOT sufficient here, and was tried.** Bounding the peak as
 * `hypot(max|wX|, max|wY|)` over-predicts whenever the two axes peak at different pixels: styles 0 and 1
 * came out exact, but style 2 (whose zoom couples both axes) landed at 4.7% instead of 8.0% on
 * `Interference` and `Coarse Swell`. Measuring the joint field is what closed the last 3.3 pp.
 *
 * ⚠️⚠️ **IT IS ONE OF THE ANGLE'S FOUR INDEX CONSUMERS AND IT WAS `wX[x]` / `wY[y]` BEFORE `35.3`.** The
 * others are the GLSL `staticOffset()`, the TS `staticOffsetAt()` and `solveGain3`. **Left unrotated while
 * the rendered field is rotated, this measures the peak of a field nobody renders and `strength` carries
 * the wrong orientation's calibration** — measured spread 1.221× on `Turbulent Weave`, so it is a real
 * defect rather than a rounding question. ⚠️ **`fieldcheck` §D cannot see a one-sided change**: it is a
 * text scan for each style's distinguishing term in the shader and in the TS sampler, so a rotation added
 * to one and forgotten in the other leaves every existing clause green. `shapecheck` §N is the instrument.
 *
 * ⚠️⚠️ **AND `35.3` MADE A CATASTROPHIC CANCELLATION REACHABLE, WHICH IS WHY `peak <= 0` GREW INTO A
 * DERIVED FLOOR.** Style 2's displacement is `dz = -(wx + wy)/2`, and at angle 0 the two waves are indexed
 * by DIFFERENT coordinates (`x` and `y`), so they cannot cancel. **A PARALLEL or ANTIPARALLEL pair indexes
 * them by the SAME coordinate** — `angleY = angleX - 90` puts the Y wave on the X wave's own axis — and
 * every archetype whose two axes share one table up to sign (most of them: `Interference`,
 * `Diagonal Shear`, `Harmonic Cascade`, `Fine Mesh`, `Coarse Swell`, `Prime Comb`, `Turbulent Weave`) then
 * has `wy === -wx` identically, so `dz` is **analytically zero** and the measured peak is pure round-off.
 *
 * Measured 2026-10-29, which is how the floor is derived rather than picked: `Interference` style 2 at
 * `45 / -45` gave a probe peak of **1.45e-12**, so the solved gain came out at **2.97e+13** and the
 * rendered field was round-off amplified by thirteen orders — normalised to the right MAGNITUDE (41.9 px
 * against a 43.2 px target) and therefore not obviously broken, with noise instead of a wave for its
 * STRUCTURE. `peak <= 0` does not catch it: the peak is small, not zero.
 *
 * **The discriminator is `peak / (mag * rad)`** — the measured peak against the peak the field would have
 * had if nothing cancelled, where `mag` bounds `|wx| + |wy|` over the grid and `rad` is the furthest the
 * grid reaches from the zoom centre. Over 612 non-`absoluteAmp` configurations (19 archetypes × styles 0-2
 * × 12 angle pairs): **31 cancelled, all style 2 at a parallel or antiparallel pair, worst ratio 3.57e-15;
 * 581 healthy, smallest ratio 6.93e-3. A gap of 1.94e+12.** `GAIN_CANCEL_FLOOR` sits inside it.
 *
 * ⚠️ **Returning 0 is the HONEST answer, not a fallback**: the field really is identically zero there, so
 * `0` renders no warp, which is what `peak <= 0` has always meant. **The remedy for the user is the notice
 * line** (*"The two waves are parallel — the field is one-directional"*, `35.4`), because `35.D2` forbids
 * clamping or refusing a degenerate angle — *that would be hiding a control rather than naming a risk.*
 *
 * ⚠️ **`solveGain3` deliberately has NO floor and that is a measurement, not an omission.** Its
 * `d = hypot(wY + (x-cx)*dz, wX + (y-cy)*dz)` keeps the SHIFT half as separate `hypot` components, so a
 * cancelled zoom pair removes the zoom and leaves the shift standing. Measured over the same sweep: the
 * worst style-3 final amplitude is **31.0**, where a blown gain shows as ~1e13. An unexercised guard there
 * would be a clause for a gap that has never been shown to fire, which is the gap.
 */
function solveGain(
  style: number,
  wX: Float64Array,
  wY: Float64Array,
  mapX: WaveAxisMap,
  mapY: WaveAxisMap,
  w: number,
  h: number,
  centreX: number,
  centreY: number,
): number {
  const fit = Math.min(w, h) / 100;
  const stepX = Math.max(1, Math.floor(w / GAIN_SCAN));
  const stepY = Math.max(1, Math.floor(h / GAIN_SCAN));
  // The FRAME centre, not `centreX`/`centreY` (which are the ZOOM centre and are used below for the radial
  // styles). Two quantities, two symbols — see `waveMaps`.
  const fx = w / 2, fy = h / 2;
  // The furthest the grid reaches from the ZOOM centre — the radial styles' lever arm, and half of the
  // cancellation discriminator below. Derived from the corners rather than scanned: it is a bound, not a
  // measurement, and a per-pixel `hypot` here would be 16 k of them for one number.
  const rad = Math.hypot(Math.max(centreX, w - 1 - centreX), Math.max(centreY, h - 1 - centreY));
  let peak = 0;
  // ⚠️ `mag` bounds `|wx| + |wy|`, i.e. the peak `dz` would have had WITHOUT cancellation. See the header:
  // this is the only thing that tells a genuinely flat field apart from a catastrophically cancelled one.
  let mag = 0;
  for (let y = 0; y < h; y += stepY) {
    // ⚠️ `fdx`/`fdy` are the pixel's offset from the FRAME centre — the rotation's pivot. `dx`/`dy` below
    // are the DISPLACEMENT this function is measuring the peak of. Two quantities that would otherwise wear
    // one pair of names inside one loop body.
    const fdy = y - fy;
    for (let x = 0; x < w; x += stepX) {
      const fdx = x - fx;
      const wy = sampleWave(wY, mapY, y, fdx, fdy);
      const wx = sampleWave(wX, mapX, x, fdx, fdy);
      const m = Math.abs(wx) + Math.abs(wy);
      if (m > mag) mag = m;
      let dx: number, dy: number;
      if (style === 0) {
        // Cross-coupled by design: horizontal displacement comes from the Y wave. See `computeSinMagic`.
        dx = wy * fit;
        dy = wx * fit;
      } else if (style === 1) {
        dx = (x - centreX) * -wx;
        dy = (y - centreY) * -wy;
      } else {
        const dz = -(wx + wy) / 2;
        dx = (x - centreX) * dz;
        dy = (y - centreY) * dz;
      }
      const d = Math.hypot(dx, dy);
      if (d > peak) peak = d;
    }
  }
  // ⚠️⚠️ **`peak <= 0` WIDENED INTO A DERIVED FLOOR (`35.3`) — read the header before touching it.** A
  // parallel wave pair makes style 2's `wx + wy` cancel analytically, and the residual is round-off that a
  // division would amplify by thirteen orders into the displacement texture. `mag === 0` reduces this to
  // the original `peak <= 0`, so a genuinely silent table is unaffected.
  if (peak <= GAIN_CANCEL_FLOOR * mag * rad) return 0;
  return (STATIC_FIELD_TARGET_FRACTION * Math.min(w, h)) / peak;
}

/**
 * The floor, as a fraction of the peak a style-2 field would have had **without** cancellation
 * (`mag * rad`). Below it, `solveGain` returns 0 rather than dividing.
 *
 * ⚠️ **Derived from a measured GAP, not picked:** over 612 non-`absoluteAmp` configurations the ratio
 * `peak / (mag * rad)` is **≤ 3.57e-15 on the 31 cancelled ones and ≥ 6.93e-3 on the 581 healthy ones** —
 * twelve orders apart, with this constant ~2.8e5× above the worst cancellation and ~7e6× below the smallest
 * real field. **A value anywhere in that gap is equally correct, which is what makes it a derivation rather
 * than a fit**; `shapecheck` §N7 re-measures both sides, so narrowing the gap shows up as a red rather than
 * as a silently wrong field.
 */
const GAIN_CANCEL_FLOOR = 1e-9;

/**
 * Style 3's zoom wave, which is NOT the same function as the other three.
 *
 * ⚠️ **`computeSinMagicZoom2` reads `params2[0][n] + sin(...) * params2[0][n]`** — a DC term equal to the
 * amplitude, added before the sine. That is why style-3 presets sit at a steady zoom OFF 1.0 rather than
 * oscillating around it (`Voyager` is a flat 0.90 contraction). `zoomBias` exposes that term as its own
 * control instead of leaving it welded to the amplitude, which is what makes such a preset reproducible
 * from the UI at all.
 *
 * ⚠️⚠️ **THIS FUNCTION TAKES `shape2`/`shapeMix2`, NOT `shape`/`shapeMix`, AND CROSSING THEM IS SILENT.**
 * `PHASE35-KEYS.md` §3.2's census is the authority: the shift tables go through `buildWave` and take
 * the first pair, style 3's zoom tables come here and take the second. The spec's §5.1 reads *"four call
 * sites, two parameter pairs"* on **one** function and is wrong — there are **twelve sites across these
 * two**, and a shape applied to one builder and not the other is a style-DEPENDENT divergence `tsc` cannot
 * see.
 *
 * ⚠️⚠️ **THE DC (BIAS) TERM IS NOT SHAPED AND MUST NEVER BE.** The shape replaces the `sin(θ)` factor only.
 * Shaping `bias * amps[k]` would change what `zoomBias` MEANS — it is the steady part of the zoom, not part
 * of the ripple — and it would break `carryZoomBias()`'s frequency-0 slot arithmetic, which is how a style-3
 * layer is editable at all. **A frequency-0 slot is exempt from the shape here for the same reason it is in
 * `buildWave`; read that exemption paragraph before changing either side.**
 */
function buildZoomWave(
  amps: readonly number[],
  freqs: readonly number[],
  map: WaveAxisMap,
  phase: number,
  bias: number,
  period: number,
  shape: WarpShape,
  shapeMix: number,
): Float64Array {
  const { fn, mix } = resolveShape(shape, shapeMix);
  const n = map.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // ⚠️ The axis coordinate, exactly as in `buildWave` — and `map` here is the ZOOM half's, from
    // `angleX2`/`angleY2`. Handing this function the SHIFT map is as silent as crossing the shape pairs.
    const p = i + map.origin;
    let s = 0;
    for (let k = 0; k < MAX_SIN_MAGIC; k++) {
      // Same centre anchor as `buildWave` — style 3 composes the two, so an anchor on only one of them
      // would slide the shift against the zoom instead of leaving both centred. ⚠️ And the anchor reads the
      // AXIS length, never the table length: see `WaveAxisMap`.
      const f = freqs[k]!;
      const th = ((360 * p * f) / period) / DEG + centreAnchor(f, map.anchorLen, period) + phase * f;
      // ⚠️ The first arm is the PRE-CHANGE EXPRESSION, and `bias * amps[k]!` is OUTSIDE the shaped factor.
      s += bias * amps[k]! + (fn === null || f === 0
        ? Math.sin(th)
        : (1 - mix) * Math.sin(th) + mix * fn(th)) * amps[k]!;
    }
    out[i] = s;
  }
  return out;
}

/**
 * Style 3's joint solve. ⚠️ **The FOURTH index consumer** — and the only one reading all four maps, because
 * the shift half takes `angleX`/`angleY` and the zoom half `angleX2`/`angleY2`. See `solveGain`'s header for
 * what a missed rotation costs and why no existing `fieldcheck` clause can see it.
 */
function solveGain3(
  wX: Float64Array,
  wY: Float64Array,
  zX: Float64Array,
  zY: Float64Array,
  maps: StaticWaveMaps,
  w: number,
  h: number,
  centreX: number,
  centreY: number,
): number {
  const stepX = Math.max(1, Math.floor(w / GAIN_SCAN));
  const stepY = Math.max(1, Math.floor(h / GAIN_SCAN));
  const fx = w / 2, fy = h / 2;
  let peak = 0;
  for (let y = 0; y < h; y += stepY) {
    const dy = y - fy;
    for (let x = 0; x < w; x += stepX) {
      const dx = x - fx;
      const dz = -(sampleWave(zX, maps.zx, x, dx, dy) + sampleWave(zY, maps.zy, y, dx, dy)) / 2;
      const d = Math.hypot(sampleWave(wY, maps.y, y, dx, dy) + (x - centreX) * dz,
        sampleWave(wX, maps.x, x, dx, dy) + (y - centreY) * dz);
      if (d > peak) peak = d;
    }
  }
  if (peak <= 0) return 0;
  return (STATIC_FIELD_TARGET_FRACTION * Math.min(w, h)) / peak;
}

/** The two 1D wave arrays a static layer contributes, plus style 3's second pair. */
export interface StaticWaves {
  /**
   * Length `maps.x.length` — `width` at `angleX === 0`, `hypot(w,h)`-sized otherwise. ⚠️ **It was
   * unconditionally `width` before `35.3`, and three sites assumed so**: `buildStaticWaveTexture`'s texture
   * width, its row stride, and the `waveTexWidth === n` reuse test. Already gain-scaled.
   */
  waveX: Float64Array;
  /** Length `maps.y.length` — `height` at `angleY === 0`. */
  waveY: Float64Array;
  /** Style 3 only — the zoom wave from the second table. Null for styles 0-2. */
  zoomX: Float64Array | null;
  zoomY: Float64Array | null;
  /**
   * ⚠️⚠️ **HOW THE FOUR ARRAYS ABOVE ARE INDEXED, and they are USELESS WITHOUT IT at a non-zero angle.**
   * Published here rather than re-derived per consumer because `waveMaps()` is the one owner (`35.3`) — the
   * angle has four index consumers and a second derivation is where one of them diverges silently.
   */
  maps: StaticWaveMaps;
}

/**
 * The one place a layer's `staticField` becomes numbers the field build can use.
 *
 * `(Preset)` returns the preset's own tables verbatim, at the amplitudes the author wrote — no gain solve,
 * no normalisation. That is the default for every shipped preset and is why nothing changes until a
 * control is touched. `(Custom)` is treated as `(Preset)` for shape purposes: it only ever appears as a UI
 * label meaning "the sliders have moved", and the sliders' effect is already in `strength`/`detail`.
 *
 * @param phase drift phase in radians, advanced by the caller. Zero reproduces the pre-drift field exactly.
 */
export function resolveStaticWaves(
  layer: TransMapLayer,
  presetParams: SinMagicParams,
  presetParams2: SinMagicParams,
  width: number,
  height: number,
  centreX: number,
  centreY: number,
  phase: number,
): StaticWaves {
  const s = staticFieldOf(layer);
  const style = layer.style;
  const arch = findArchetype(s.pattern);
  // ⚠️ ONE period for BOTH axes — see `buildWave`. Resolved once here so no branch below can reintroduce a
  // per-axis divisor: passing `width` to a waveX call and `height` to its waveY sibling is exactly the
  // defect, and it reads as symmetric, correct-looking code.
  const period = sharedPeriod(width, height);
  // ⚠️ Resolved ONCE here, for the same reason `period` is: the four maps reach `buildWave`, both gain
  // solves, `staticOffsetAt` and the GLSL upload, and a second derivation is where the rotation and the
  // table it indexes come apart (`35.3`). ⚠️ They carry the table LENGTHS, so no branch below may pass
  // `width`/`height` to a builder any more — that argument is now `maps.x`/`maps.y`.
  const maps = waveMaps(s, width, height);

  if (!arch) {
    // (Preset) / (Custom) / an unknown name from a hand-edited import: the preset's own table.
    //
    // ⚠️ **`strength` is applied here as a RELATIVE gain around its 0.5 default, so 0.5 reproduces the
    // authored field exactly.** It was ignored on this branch, which left the Strength slider dead for every
    // shipped preset (measured 0.00e+0 between strength 0.1 and 0.9) — invariant 13, a control that does not
    // move the thing it names, and the reason its tooltip had to admit "Ignored while Pattern is (Preset)".
    // Relative rather than absolute because this branch has NO gain solve: the archetype branch normalises to
    // a target fraction of the frame, while here the amplitudes are the author's own and are the thing to
    // preserve. `strength / 0.5` keeps 0.5 as unity, so the 203 shipped presets — all at the 0.5 default —
    // stay byte-identical, which is section A's parity oracle.
    //
    // ⚠️ **`detail` is deliberately still NOT applied here**, and that is not an oversight to fix later. On the
    // archetype branch `detail` multiplies the FREQUENCIES, which is meaningful because an archetype is a
    // shape defined up to scale. Multiplying a preset's authored frequencies would not refine its field, it
    // would replace it: the legacy tables encode specific integer relationships (nodal lattices that close
    // only at those ratios — Borg Cube's 6/4 is the reference case), and a non-integer multiple of them is a
    // different figure, not a finer one. The Detail slider is therefore hidden on this path rather than wired
    // to something that would look like damage. See `buildStaticFieldBody`.
    const gain = s.strength / STATIC_FIELD_DEFAULTS.strength;
    const fit = (style === 0 ? Math.min(width, height) / 100 : 1) * gain;
    // ⚠️ **The shape IS applied on this branch, which is the OPPOSITE of `detail`'s treatment above**
    // (`35.D2` decision 1). `detail` would replace a legacy table's authored integer frequency ratios with a
    // different figure; a shape leaves every frequency alone and re-draws the same harmonics with a
    // different basis, so the author's table survives. ⚠️ **The named risk, stated rather than designed
    // out:** these tables were authored FOR sine, so a shape on `(Preset)` can read as damage — the notice
    // line *"This table's frequencies were authored for Sine."* is the whole of the remedy. **Do not make
    // these two rows inert on `(Preset)` to match `Detail`**; see the asymmetry note in `tooltips.ts`.
    const waveX = buildWave(presetParams[0]!.map(v => v * fit), presetParams[1]!, maps.x, phase, period,
      s.shape, s.shapeMix);
    const waveY = buildWave(presetParams[2]!.map(v => v * fit), presetParams[3]!, maps.y, phase, period,
      s.shape, s.shapeMix);
    if (style !== 3) return { waveX, waveY, zoomX: null, zoomY: null, maps };
    return {
      waveX,
      waveY,
      maps,
      // The zoom half takes `strength2`, matching the archetype branch's split: `strength` drives the shift,
      // `strength2` the zoom. Same relative-to-0.5 convention, same parity guarantee.
      //
      // ⚠️ **`shape2`/`shapeMix2` HERE, never `shape`/`shapeMix` — crossing the two pairs is silent** and
      // shows up only on style 3. See `buildZoomWave`'s header.
      // ⚠️ `maps.zx`/`maps.zy` HERE, never `maps.x`/`maps.y` — crossing the two pairs is exactly as silent
      // as crossing the shape pairs, and shows up only on style 3.
      zoomX: buildZoomWave(
        presetParams2[0]!.map(v => v * (s.strength2 / STATIC_FIELD_DEFAULTS.strength2)),
        presetParams2[1]!, maps.zx, phase, 1, period, s.shape2, s.shapeMix2),
      zoomY: buildZoomWave(
        presetParams2[2]!.map(v => v * (s.strength2 / STATIC_FIELD_DEFAULTS.strength2)),
        presetParams2[3]!, maps.zy, phase, 1, period, s.shape2, s.shapeMix2),
    };
  }

  const t = archetypeTerms(s, arch, style, width, height, centreX, centreY, period, maps);
  const waveX = buildWave(t.xAmp.map(v => v * t.fit), t.xFreq, maps.x, phase, period, s.shape, s.shapeMix);
  const waveY = buildWave(t.yAmp.map(v => v * t.fit), t.yFreq, maps.y, phase, period, s.shape, s.shapeMix);
  if (!t.zoom) return { waveX, waveY, zoomX: null, zoomY: null, maps };
  return {
    waveX,
    waveY,
    maps,
    // ⚠️ `shape2`/`shapeMix2` and `maps.zx`/`maps.zy`, as on the `(Preset)` branch above.
    zoomX: buildZoomWave(t.zoom.xAmp, t.zoom.xFreq, maps.zx, phase, t.zoom.bias, period,
      s.shape2, s.shapeMix2),
    zoomY: buildZoomWave(t.zoom.yAmp, t.zoom.yFreq, maps.zy, phase, t.zoom.bias, period,
      s.shape2, s.shapeMix2),
  };
}

/**
 * The archetype branch's resolved AMPLITUDES and FREQUENCIES — everything but the `buildWave` call.
 *
 * ⚠️ **Extracted (v8 21.12) so `bakeStaticField` can reuse the gain solve rather than transcribe it**, which
 * is the whole point: a bake that computed its own scalar would be a second owner of `solveGain`'s result,
 * and the two would agree on the day it was written and at the canvas size it was tested at. The amplitudes
 * here are **exactly what a stored table holds at the parity `strength` of 0.5**, which is what makes the
 * bake a copy rather than a conversion.
 *
 * ⚠️ **`fit` is returned SEPARATELY and is not folded in, and that asymmetry is load-bearing.** Style 0
 * multiplies amplitudes by `min(w,h)/100` on BOTH branches, so a baked table must NOT carry it — carrying it
 * would apply it twice and blow the field up by `min(w,h)/100`. Every other style's `fit` is 1, so the only
 * caller that can be hurt by this is the one style where the mistake is a factor of ten.
 *
 * ⚠️ **The multiplication ORDER is the shipped one, term for term.** `v * gain` then `* fit` is not
 * interchangeable with `v * gain * fit` in general floating point — it happens to be here because JS
 * evaluates left to right, which is exactly why the split was written this way and must stay this way:
 * `fieldcheck` §A's parity oracle is bit-exact.
 */
interface ArchetypeTerms {
  /** Pre-`fit` amplitudes — a stored table's own units. */
  xAmp: number[];
  xFreq: number[];
  yAmp: number[];
  yFreq: number[];
  /** `min(w,h)/100` for style 0, else 1. Applied by the caller. */
  fit: number;
  /** Style 3 only. `xAmp`/`yAmp` here are final (the zoom half has no `fit`). */
  zoom: { xAmp: number[]; xFreq: number[]; yAmp: number[]; yFreq: number[]; bias: number } | null;
}

function archetypeTerms(
  s: typeof STATIC_FIELD_DEFAULTS,
  arch: StaticFieldArchetype,
  style: number,
  width: number,
  height: number,
  centreX: number,
  centreY: number,
  period: number,
  maps: StaticWaveMaps,
): ArchetypeTerms {
  const detail = Math.max(0.05, s.detail);
  // ⚠️ `absoluteAmp` takes the AUTHORED amplitudes and `sumNormalise` for everything else — see the flag's
  // own doc. Written as a branch rather than folded into `sumNormalise` because normalising is what the
  // OTHER fourteen archetypes mean by an amplitude, and a helper that sometimes did not normalise would make
  // that distinction invisible at every call site.
  const xAmp = arch.absoluteAmp ? [...arch.xAmp] : sumNormalise(arch.xAmp);
  const yAmp = arch.absoluteAmp ? [...arch.yAmp] : sumNormalise(arch.yAmp);
  const xFreq = arch.xFreq.map(f => f * detail);
  const yFreq = arch.yFreq.map(f => f * detail);

  // Unit-gain waves, used to measure the peak. Phase 0: the gain is drift-invariant.
  // ⚠️ Built unconditionally: `solveGain` is skipped on the `absoluteAmp` path, but `solveGain3` below still
  // needs the SHIFT half's waves to normalise the joint style-3 field even when the shift half is authored.
  //
  // ⚠️⚠️ **THESE TWO ARE PROBES AND THEY MUST CARRY THE SHAPE — THIS IS THE PHASE'S MOST INVISIBLE SITE.**
  // `solveGain`/`solveGain3` measure the peak of exactly these arrays and divide the target by it, so a probe
  // left at sine while the rendered waves are shaped calibrates `strength` against **a field nobody
  // renders**. ⚠️ The error is ~3 % (the measured 1.03× peak spread across all five shapes) — i.e. **below
  // the threshold at which anyone would look**, which is invariant 10's class with the very measurement that
  // proves it harmless being the one that makes it invisible. `shapecheck` §F measures it instead: the
  // realised peak must be the SAME for every shape, since each is normalised to one target.
  //
  // ⚠️⚠️ **AND THEY MUST CARRY THE ANGLE FOR THE SAME REASON (`35.3`).** They are built at `maps.x`/`maps.y`
  // and both solves below sample them THROUGH those maps, so the peak is measured on the field that is
  // actually rendered. A probe left axis-aligned under a rotated field mis-calibrates `strength` by a
  // measured 1.221× on `Turbulent Weave` — larger than the shape's 1.03×, and invisible for the same reason.
  const uX = buildWave(xAmp, xFreq, maps.x, 0, period, s.shape, s.shapeMix);
  const uY = buildWave(yAmp, yFreq, maps.y, 0, period, s.shape, s.shapeMix);

  if (style !== 3) {
    // ⚠️ TWO magnitude laws, and the flag is the only thing that chooses between them. The relative form is
    // `resolveStaticWaves`' `(Preset)` gain verbatim — 0.5 is unity, so a flagged archetype at the default
    // strength bakes its authored table byte for byte, on every style and at every canvas size.
    const gain = arch.absoluteAmp
      ? s.strength / STATIC_FIELD_DEFAULTS.strength
      : solveGain(style, uX, uY, maps.x, maps.y, width, height, centreX, centreY) * s.strength;
    const fit = style === 0 ? Math.min(width, height) / 100 : 1;
    return {
      xAmp: xAmp.map(v => v * gain), xFreq,
      yAmp: yAmp.map(v => v * gain), yFreq,
      fit, zoom: null,
    };
  }

  // Style 3 is a SHIFT composed with a ZOOM, from two independent tables — not two detail levels of one
  // field. `pattern`/`strength` drive the shift, `pattern2`/`strength2` the zoom.
  const arch2 = findArchetype(s.pattern2) ?? arch;
  const x2Amp = arch2.absoluteAmp ? [...arch2.xAmp] : sumNormalise(arch2.xAmp);
  const y2Amp = arch2.absoluteAmp ? [...arch2.yAmp] : sumNormalise(arch2.yAmp);
  const x2Freq = arch2.xFreq.map(f => f * detail);
  const y2Freq = arch2.yFreq.map(f => f * detail);
  // ⚠️ The ZOOM half's probes, and they take `shape2`/`shapeMix2` — see `uX`/`uY` above for why a probe left
  // at sine mis-calibrates `strength2`, and `buildZoomWave` for why crossing the two pairs is silent.
  // ⚠️ And `maps.zx`/`maps.zy`, so the joint solve measures the ORIENTATION the zoom half will render at.
  const uZX = buildZoomWave(x2Amp, x2Freq, maps.zx, 0, s.zoomBias, period, s.shape2, s.shapeMix2);
  const uZY = buildZoomWave(y2Amp, y2Freq, maps.zy, 0, s.zoomBias, period, s.shape2, s.shapeMix2);
  // ⚠️ **`absoluteAmp` is resolved PER HALF here, because the two halves are two independent archetypes** —
  // `pattern` and `pattern2` — and a flagged shape paired with a distilled one is reachable from the UI. The
  // alternative (either half flagged ⇒ both relative) was rejected: it would make one dropdown silently change
  // what the OTHER dropdown's slider means. The cost is that `solveGain3` normalises the JOINT peak assuming
  // both halves are unit-gain, so a mixed pair is normalised on one half only — which is inherent to opting a
  // shape out of the 8% target, not a defect of the split.
  //
  // ⚠️ The solve is skipped only when NEITHER half needs it; `solveGain3` is 0.8 ms and must not run for a
  // result nothing reads.
  const gain = arch.absoluteAmp && arch2.absoluteAmp
    ? 0
    : solveGain3(uX, uY, uZX, uZY, maps, width, height, centreX, centreY);
  const shiftGain = arch.absoluteAmp ? s.strength / STATIC_FIELD_DEFAULTS.strength : gain * s.strength;
  const zoomGain = arch2.absoluteAmp ? s.strength2 / STATIC_FIELD_DEFAULTS.strength2 : gain * s.strength2;
  return {
    xAmp: xAmp.map(v => v * shiftGain), xFreq,
    yAmp: yAmp.map(v => v * shiftGain), yFreq,
    fit: 1,
    zoom: {
      xAmp: x2Amp.map(v => v * zoomGain), xFreq: x2Freq,
      yAmp: y2Amp.map(v => v * zoomGain), yFreq: y2Freq,
      bias: s.zoomBias,
    },
  };
}

/**
 * Phase advance at `drift = 1.0`, in radians per second **per unit of effective frequency**.
 *
 * ⚠️ **Units (invariant 10): CELLS per second, and the divisor in `driftPhase()` is what makes it so.**
 * `buildWave` computes `sin(f*(2*pi*i/period) + phase*f)` = `sin(f*(2*pi*i/period + phase))`, so a raw phase
 * of `p` translates the field by `p*period/(2*pi)` PIXELS — a figure with no `f` in it. That invariance is
 * what makes the drift rigid (every harmonic shifts by the same distance, so the pattern slides instead of
 * boiling), and it is the right property for the *field*; it is the wrong property for a *control*. A pixel
 * rate is not what the eye reads. What reads as speed is how many cells cross a given pixel per second, and
 * that is `effFreq / period` — so at a fixed slider value the apparent speed scaled with the pattern's
 * frequency.
 *
 * ⚠️ **The `n` -> `period` change (the aspect-stretch fix, see `buildWave`) leaves `RATE = 2*pi` EXACTLY
 * right, and that was re-derived rather than assumed**: the shift is `phase*period/(2*pi)` px, one cell is
 * `period/f` px, so `cells/s = drift*RATE/(2*pi)` — `period` cancels precisely as `n` used to. ⚠️ **It also
 * FIXED a second anisotropy in drift itself, which nothing had reported:** with the old per-axis divisor
 * `waveX` advanced `p*w/(2*pi)` px while `waveY` advanced `p*h/(2*pi)`, i.e. DIFFERENT distances, so on a
 * non-square canvas a drifting field sheared instead of translating rigidly — the exact failure the
 * `phase * freq` term above exists to prevent, reintroduced by the divisor rather than by the phase. Both
 * axes now share one `period`, so the rigid-translation property finally holds in 2D and not just per axis.
 *
 * ⚠️ **Measured spread before normalisation: 128x at ONE slider value** — 0.25 cells/s for `Coarse Swell` at
 * detail 1 against 32 cells/s for `Fine Mesh` at detail 8. It factors as **16x from the pattern**
 * (`Coarse Swell`'s fundamental 1 against `Fine Mesh`'s 16) times **8x from detail** (0.25..8, hence
 * `effFreq = baseFreq * detail`). ⚠️ **Dividing by `detail` alone — the obvious reading of "normalise" — would
 * have left the 16x**, which is the larger of the two factors: the pattern dropdown would still have changed
 * the speed silently. Both factors are in `effFreq` for that reason.
 *
 * ⚠️ **An earlier revision of this comment claimed `2*pi/4` meant "one full CELL every 4 seconds". It did
 * not** — it meant one full FRAME WIDTH every 4 s, wrong by exactly the frequency factor above, which is how
 * the sensitivity got through review. Verified by cross-correlating the wave array at phase 0 against phase
 * 0.02 over 4 patterns x 2 detail values at n=1920: the shift was 6.00 px in every cell against a prediction
 * of 6.11, the raw readings differing only by whole multiples of each pattern's own spatial period. After this
 * change the constant means what the old comment said: **drift 1.0 advances the field by one cell every 4 s,
 * on every pattern and at every detail setting.**
 *
 * `overlay.speedFactor` still multiplies in on top (`elapsedTime` is already speed-scaled), so Animation Speed
 * remains a second factor — deliberately, since drift is motion and should follow the global speed.
 *
 * ⚠️ **`2*pi` exactly, so `drift` IS cells per second** — one whole slider unit, one cell, one second. Derived
 * rather than picked: with `phase = t*drift*RATE/f`, the shift is `phase*n/(2*pi)` px and one cell is `n/f` px,
 * so `cells/s = drift*RATE/(2*pi)` — the `n` and the `f` both cancel, and `RATE = 2*pi` makes the coefficient
 * 1. ⚠️ **It was `2*pi/4` first, and measured 0.0625 cells/s at drift 0.25 instead of the intended 0.25** —
 * off by exactly that 4, which is invariant 10's trap in its purest form: the expression was plausible and
 * every term was a `number`. Check any change here by MEASURING cells/s, never by reading the formula.
 */
export const DRIFT_RATE = 2 * Math.PI;

/**
 * The pattern's **effective fundamental frequency** in cycles across the frame — the normalisation divisor.
 *
 * ⚠️ **Derived from the SAME archetype tables and the same `detail` clamp `resolveStaticWaves` uses**, and
 * that is the whole point of it being a function here rather than a number at the call site: a second
 * enumeration of the frequency tables would be a place for the divisor to disagree with the field it is
 * normalising, and nothing would report it (three enumerations of one list are what make a missing entry
 * structurally invisible).
 *
 * ⚠️ **`max(|f|)` over both axes, not a sum or a mean.** The apparent speed of a multi-harmonic pattern is set
 * by its FINEST visible structure — `Turbulent Weave`'s [1,2,4,8] reads as fast because of the 8, not as
 * average because of the 1 — so the highest harmonic is the one to normalise against. Taking the max across X
 * and Y together keeps a single rate for the layer, which the rigid-translation property requires: per-axis
 * divisors would advance X and Y by different spatial amounts and the field would shear as it drifts.
 *
 * Returns 1 for `(Preset)`/`(Custom)`/an unknown name, i.e. NO normalisation on the preset-table path. That
 * path's frequencies are the preset author's own and are not a `detail` multiple of anything, so there is no
 * meaningful cell size to divide by; leaving it at 1 also keeps the 203 shipped presets on exactly the
 * pre-normalisation phase arithmetic. Never returns 0 — `Vertical Ripple` has an all-zero X table, and a
 * pattern with no frequency at all (an empty archetype) would otherwise divide by zero and NaN the field.
 */
export function effectiveFrequency(s: typeof STATIC_FIELD_DEFAULTS): number {
  const arch = findArchetype(s.pattern);
  if (!arch) return 1;
  const detail = Math.max(0.05, s.detail);
  let f = 0;
  for (const v of arch.xFreq) f = Math.max(f, Math.abs(v));
  for (const v of arch.yFreq) f = Math.max(f, Math.abs(v));
  return f > 0 ? f * detail : 1;
}

/**
 * The drift phase, in radians, for a layer at time `time` — **the only sanctioned way to compute it.**
 *
 * ⚠️ **Drift 0 must return exactly 0**, not a value that rounds to it: that is what keeps all 203 shipped
 * presets bit-identical to the pre-drift field, and it is the parity oracle `fieldcheck` section B tests.
 *
 * `scale` is the caller's own multiplier — the preview grid passes 0 to freeze tiles (see
 * `grid-tile-renderer.ts`), which is why it is a scale here rather than a flag.
 */
export function driftPhase(s: typeof STATIC_FIELD_DEFAULTS, time: number, scale: number): number {
  if (s.drift === 0) return 0;
  return (time * s.drift * DRIFT_RATE * scale) / effectiveFrequency(s);
}

/** One static layer, resolved to numbers. What both the GPU upload and the force sampler consume. */
export interface ResolvedStaticLayer {
  style: number;
  /** Zoom centre in PIXELS, not percent — styles 1-3 only, ignored by style 0. */
  centreX: number;
  centreY: number;
  /** `weight / staticWeightScale`; the shader's `uLayerWeight.x` carries the scale back. */
  ratio: number;
  waveX: Float64Array;
  waveY: Float64Array;
  zoomX: Float64Array | null;
  zoomY: Float64Array | null;
  /**
   * How the four arrays are indexed (`35.3`). ⚠️ **OPTIONAL, and ABSENT MEANS NOT ROTATED** — which is
   * correct only for a layer whose four angles are 0.
   *
   * It is optional because two hand-built-layer oracles exist and neither is type-checked:
   * `fieldcheck` §A's `separableField` (the legacy parity oracle, which must stay UNEDITED — `35.D5`) and
   * `field-measure.ts`'s `measureStaticField`. Both build this object field-by-field from a `StaticWaves`,
   * so a required key would have forced an edit to the one file this phase may not touch.
   * `resolveStaticWaves` always publishes `maps`, so the production path always has it.
   *
   * ⚠️ **The cost is named rather than hidden:** a consumer that copies the arrays and drops `maps` samples
   * a rotated field unrotated, with no error. `shapecheck` §N4 asserts `rebuildStaticField` forwards it by
   * spread and that `resolveStaticWaves` returns it.
   */
  maps?: StaticWaveMaps;
}

function rollToRange(v: number, min: number, max: number): number {
  if (v < min) return min + (min - v) % (max - min);
  if (v > max) return max - (v - max) % (max - min);
  return v;
}

function restrictToRange(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function zoomCoordinate(ref: number, coord: number, zoom: number): number {
  return Math.round(ref + (coord - ref) * zoom);
}

/**
 * **THE composition of styles 0-3** — the single source of truth for "where does pixel (x,y) sample from".
 *
 * ⚠️ **This formula exists in THREE places and `checks/fieldcheck.mjs` is the only thing that can tell
 * whether they still agree**: here (consumed by the particle force path), in the warp GLSL (what the screen
 * shows), and in the checker's own independent transcription of the pre-port CPU code (the parity oracle).
 * Section D of that checker greps the shader for each style's distinguishing term precisely because `tsc`
 * and `glslcheck` both see three unrelated bodies of arithmetic — invariant 11's class in triplicate.
 *
 * Writes the RELATIVE offset in UV, summed over layers, exactly as the pre-2026-08-20
 * `addTranslation` wrote it: `(rollToRange(round(x2)) - x) / w`. The `Math.round` and `rollToRange` are
 * **not incidental quantisation to be tidied away** — they are what makes the field a texel-addressed copy
 * table, and dropping them shifts every legacy preset's warp by up to half a texel.
 *
 * ⚠️ **Writes into `out` rather than returning a tuple, and that is invariant 8 rather than style.** The
 * only caller is the particle force loop, once per particle per frame: a returned `[ox, oy]` would be
 * ~7.7 MB/s of garbage at 4000 particles / 60 fps, on top of the tuple `sampleForce` already returns, in
 * the one loop in this file that runs per particle. The comparison point is 58 MB/s, which reached the user
 * as "a jitter every few seconds" — so this is not at that scale, it is simply free to avoid.
 *
 * @param out a 2-element scratch buffer owned by the caller; `[0]` receives x, `[1]` receives y.
 */
export function staticOffsetAt(
  layers: readonly ResolvedStaticLayer[],
  x: number,
  y: number,
  w: number,
  h: number,
  out: Float64Array,
): void {
  let ox = 0;
  let oy = 0;
  // ⚠️ The pixel's offset from the FRAME centre, which is what the sampling rotation pivots about — NOT
  // `L.centreX`/`L.centreY`, which are the ZOOM centre and are read by the radial styles below. Hoisted out
  // of the layer loop; `sampleWave` ignores both when the layer is unrotated. See `waveMaps`.
  const dx = x - w / 2;
  const dy = y - h / 2;
  for (const L of layers) {
    // ⚠️ **The SECOND of the angle's four index consumers** (the others: the warp GLSL, `solveGain`,
    // `solveGain3`). This is the particle FORCE path and, through `field-measure.ts`, the panel's picture —
    // so a rotation added to the shader and forgotten here makes particles feel a field the screen does not
    // show, and `fieldcheck` §D's text scan stays green over it. `shapecheck` §N asserts both sides.
    const wx = sampleWave(L.waveX, L.maps?.x, x, dx, dy);
    const wy = sampleWave(L.waveY, L.maps?.y, y, dx, dy);
    let x2: number;
    let y2: number;
    if (L.style === 0) {
      // Cross-coupled by design: the HORIZONTAL displacement comes from the Y wave. See `computeSinMagic`.
      x2 = restrictToRange(x + wy, -100000, 100000);
      y2 = restrictToRange(y + wx, -100000, 100000);
    } else if (L.style === 1) {
      x2 = zoomCoordinate(L.centreX, x, 1 - wx);
      y2 = zoomCoordinate(L.centreY, y, 1 - wy);
    } else if (L.style === 2) {
      const zoom = 1 - (wx + wy) / 2;
      x2 = zoomCoordinate(L.centreX, x, zoom);
      y2 = zoomCoordinate(L.centreY, y, zoom);
    } else {
      // Style 3 is a SHIFT composed with a ZOOM from the second table — not style 2 at a second detail
      // level. `waveX/waveY` shift, `zoomX/zoomY` zoom.
      // ⚠️ The ZOOM half's own maps (`angleX2`/`angleY2`), never the shift pair's.
      const zoom = 1 - ((L.zoomX ? sampleWave(L.zoomX, L.maps?.zx, x, dx, dy) : 0)
        + (L.zoomY ? sampleWave(L.zoomY, L.maps?.zy, y, dx, dy) : 0)) / 2;
      x2 = zoomCoordinate(L.centreX, Math.round(x + wy), zoom);
      y2 = zoomCoordinate(L.centreY, Math.round(y + wx), zoom);
    }
    const sx = rollToRange(Math.round(x2), 0, w - 1);
    const sy = rollToRange(Math.round(y2), 0, h - 1);
    ox += ((sx - x) / w) * L.ratio;
    oy += ((sy - y) / h) * L.ratio;
  }
  out[0] = ox;
  out[1] = oy;
}

/**
 * Pick a random archetype and plausible scalars — the computational half, deliberately scoped to the
 * Randomise tab rather than being the primary UI.
 *
 * ⚠️ **Offset from `seed`, never `Math.random()` directly**, so a caller can reproduce a generation
 * (invariant 12's reseeding rule, and the same reason `evolution-ops.ts` threads its blend factor).
 *
 * ⚠️ **It stays POSITIVE-ONLY now that `Strength` reaches `STATIC_FIELD_STRENGTH_MIN`, and that is a decision
 * rather than an omission.** The binding reason is reproducibility: every draw comes from the SEEDED `rand()`
 * the Reel's randomised bodies replay, and each extra call or wider range shifts the whole downstream sequence
 * — so a sign bit here would silently change what every existing seed produces, which is the one property this
 * function is built to have. The secondary reason is that a sign is the cheapest thing to try by hand once the
 * dice have produced a shape, whereas the shape is what a user cannot conjure. **A stored negative `strength`
 * is honoured on every path; only the dice do not roll one.**
 *
 * ⚠️⚠️ **THAT REPRODUCIBILITY ARGUMENT IS SOUND AS A CONTRACT AND VACUOUS AS A CONSTRAINT TODAY, AND THE
 * WAVE-SHAPE DRAWS BELOW RELY ON THAT — re-derived 2026-10-29, not inherited.** The only call site passes
 * `Math.random` (`randomize.ts`' `applyStaticFieldJump`), so there is no seeded sequence to shift; and this
 * function ALREADY branches on `rand()` for `drift` and `zoomBias`, so its call count is variable regardless.
 * **If the reproducible path is ever wired up, the shape draws are where it will break first** — they are the
 * only draws here that are conditional on a previous draw's VALUE.
 *
 * ⚠️⚠️ **THE WAVE SHAPE IS ROLLED AND PHASE 34 REFUSES TO ROLL `Offset` — THE ASYMMETRY IS DELIBERATE AND IS
 * STATED HERE BECAUSE THIS IS WHERE A READER OF EITHER PHASE WILL LOOK.** An `Offset` can put the subject off
 * the screen, i.e. produce an INVALID result. **A warp shape cannot produce an invalid field, only a torn
 * one** — and for a warp, tearing is an aesthetic rather than a defect, because nothing is being preserved.
 * Two phases, two answers, one criterion: *can the roll produce something that is not a picture.*
 *
 * ⚠️ **`sine` is weighted at ~60 %, NOT uniform over the five, and that is the load-bearing number.** A
 * uniform roll would make **four of five** random presets non-sinusoidal, which changes the Randomiser's
 * whole character rather than widening it. ⚠️ **And when a non-sine shape IS drawn the mix is rolled in
 * `[0.3, 1.0]`, never `[0, 1]`** — `shapeMix: 0` is one of the block's two independent identities, so a roll
 * that could land there would silently produce an inert result that looks like the dice not working.
 *
 * ⚠️ **The two ANGLES (`35.3`) are deliberately NOT rolled here**: three archetypes carry recommended angles
 * that picking the pattern writes, so a roll on top of a pattern pick would overwrite the archetype's own
 * design. Same argument as the sign bit — an angle is cheap to try by hand.
 */
export function randomStaticField(rand: () => number): StaticFieldConfig {
  const pick = (): string => STATIC_FIELD_ARCHETYPES[Math.floor(rand() * STATIC_FIELD_ARCHETYPES.length)]!.name;
  // ⚠️ Reads `WARP_SHAPES`, never a second list — and SKIPS index 0 (`sine`, which §A asserts heads the
  // array) because the sine case is the weighted majority arm below and must not be drawn twice.
  const pickShape = (): WarpShape =>
    WARP_SHAPES[1 + Math.floor(rand() * (WARP_SHAPES.length - 1))] ?? 'sine';
  return {
    pattern: pick(),
    strength: 0.2 + rand() * 0.6,
    // Detail is perceptually logarithmic — a linear draw would land almost everything above 8.
    detail: Math.pow(2, -1 + rand() * 4),
    // Half the draws stand still, since a fixed lattice is a legitimate look and the library default. When it
    // does move: 0..0.4 cells/s, drawn on the same SQUARED track the slider uses (`DRIFT_TRACK`), so the draw
    // is uniform in slider TRAVEL rather than in value — a linear draw would put most rolls in the fast half,
    // where a static field mostly reads as a shimmer. Units are cells/s and pattern-independent since
    // `effectiveFrequency()` normalises them, so this bound means the same thing on `Fine Mesh` as on
    // `Coarse Swell` — it did NOT before that normalisation, when 0.5 here was 32 cells/s on the former.
    drift: rand() < 0.5 ? 0 : Math.round(Math.pow(rand(), 2) * 400) / 1000,
    pattern2: pick(),
    strength2: 0.2 + rand() * 0.6,
    zoomBias: rand() < 0.7 ? 0 : (rand() - 0.5) * 0.6,
    // The 60/40 split, written as one draw against `SHAPE_SINE_WEIGHT` and then one draw for the shape — the
    // shift half and the zoom half roll INDEPENDENTLY, since `buildWave` and `buildZoomWave` take separate
    // pairs and a style-3 layer whose two halves always matched would be a narrower space, not a safer one.
    //
    // ⚠️ The sine arm writes NOTHING rather than writing `shape: 'sine', shapeMix: 0`. The whole block is
    // replaced by this return value, so an absent key already means the default (invariant 14), and two
    // written defaults would be runtime-default noise in every export of a rolled preset.
    ...rand() < SHAPE_SINE_WEIGHT
      ? {}
      : { shape: pickShape(), shapeMix: SHAPE_MIX_MIN + rand() * (1 - SHAPE_MIX_MIN) },
    ...rand() < SHAPE_SINE_WEIGHT
      ? {}
      : { shape2: pickShape(), shapeMix2: SHAPE_MIX_MIN + rand() * (1 - SHAPE_MIX_MIN) },
  };
}

/**
 * `sine`'s share of a `randomStaticField` roll. ⚠️ **Not `1/WARP_SHAPES.length`** — see that function's
 * header: a uniform roll over five shapes makes four of five random presets non-sinusoidal.
 *
 * ⚠️ **The Evolution surface must take the same treatment or the two surfaces disagree about the parameter
 * space** — which is why this is a named constant rather than a literal at the draw.
 */
export const SHAPE_SINE_WEIGHT = 0.6;

/**
 * The floor on a ROLLED `shapeMix`, so a roll is never silently inert. ⚠️ **It is NOT a floor on the
 * CONTROL** — `shapeMix: 0` is a deliberate identity and every stored value is honoured on every path; only
 * the dice do not roll one. Same shape of rule as the sign bit on `strength`.
 */
export const SHAPE_MIX_MIN = 0.3;
