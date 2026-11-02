/**
 * @file v8 `34.1` — **the ONE owner of the wave law**: the phase arithmetic, the triangle basis, the
 * sine↔triangle blend, the per-axis summation, and the secular `Travel` term.
 *
 * ⚠️⚠️ **THIS FILE EXISTS BECAUSE THE FIGURE WAS COMPUTED IN TWO PLACES AND THEY HAD ALREADY DIVERGED.**
 * `generators/lissajous.ts` renders the figure; `ui/synthesis-lab/score-canvas.ts` draws the **Score**, the
 * diagram an author reads *while authoring*. Phase 33 added `Sharpness` (`33.2`) and `Travel` (`33.3`) to
 * the generator and to nothing else, so from that day the Score drew a figure the engine does not render on
 * any preset carrying either value — measured: `score-canvas.ts` contained **zero** occurrences of either
 * word. **Nothing asserted the two agreed, which is exactly why the divergence arrived unannounced**, and
 * `composercheck` §R is now that assertion. The remedy is structural rather than a corrected copy: there is
 * one law, here, and both sites call it.
 *
 * ⚠️⚠️ **THE EXTRACTION IS OF THE *SHIPPED* TRIANGLE AND NOT OF A SPECIFICATION'S.**
 * `SPEC-waveform-operators.md` §4 proposes a different three-branch arithmetic (`triSin`); both
 * forms are correct, and the one that was running is the one that was moved. The textbook
 * `(2/π)·asin(sin a)` is **rejected**: it costs two transcendentals and would make the faceted basis more
 * expensive than the smooth one, destroying the operator's only measured advantage.
 *
 * ⚠️⚠️ **THE BASIS IS *INSIDE* `sumWaveAxes` AND NOT A SEPARATE `waveBasis()` CALL, AND THAT IS A MEASURED
 * DECISION RATHER THAN A STYLE ONE.** The obvious factoring — a tiny exported `waveBasis(a, sharp)` that the
 * summation calls nine times per particle — was written first and benchmarked at 50 000 particles against
 * the inline loop it replaced: **`sharp = 1` went from 0.80 ms/frame to 1.74 ms/frame, a 2.1× regression on
 * exactly the path whose cheapness is this operator's entire justification** (V8 does not inline it away).
 * Folding it back in costs 1.05–1.3× instead. So the law is one function, and the price of that is that a
 * clause wanting the bare basis must probe it through a single-slot table — see `composercheck` §R, which
 * does exactly that with `am = fm = [1, 0, 0]`, `ph = [0, 0, 0]`, where `out[0]` IS `basis(n, sharp)`.
 * **Do not "tidy" the basis out into its own function.**
 *
 * ⚠️ **WHAT THIS FILE DELIBERATELY DOES *NOT* OWN: the modulator `base + sin(time·freq/DEG)·amp`.** Three
 * copies of the *parameter shape* exist — `AxisWave.am` is `{base, amplitude, frequency}` (`interfaces.ts`),
 * the generator's internal `LegacyWaveAxis.am` is `{base, amp, freq}` (`lissajous.ts`), and
 * `buildWaveTable()` translates between them **with `?? 0` defaulting, so that rename IS the normaliser** —
 * deleting or relocating it moves behaviour on any preset with a missing field. So the functions here take
 * the **already-resolved per-frame numbers** (`am[slot][axis]`, `fm[slot][axis]`, `ph[slot][axis]`) and
 * never see either shape. That also keeps `composercheck` §D's deliberate re-implementation of the
 * modulator intact: §D asserts the phase arithmetic against a literal copy *on purpose*, and folding the
 * modulator in here would have silently turned that clause into an assertion against itself.
 *
 * ⚠️ **IMPORT-SAFE UNDER BARE NODE, AND THAT IS A CONSTRAINT RATHER THAN A HABIT.** `composercheck.mjs`
 * does `await import('../src/core/wave-law.ts')` and Node **strips types only** — it does not compile
 * TypeScript. A constructor parameter property, an `enum` or a decorator throws
 * `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` at runtime **while `tsc --noEmit` stays green**, which is the exact
 * trap `reel-model.ts` records. So: no classes, no enums, no decorators, and **no imports at all** — a
 * single import reaching the DOM or a GL type would make the whole file unloadable from a checker.
 */

/**
 * `1/2π`, the triangle basis's index into its own period.
 *
 * ⚠️ A reciprocal constant rather than a divide, because it is evaluated **nine times per particle** in the
 * innermost loop of the hottest function in the engine. (`lissajous.ts` builds a separate local `TAU` for a
 * once-per-frame rotation; that is a different cost site and is deliberately left alone.)
 *
 * ⚠️ Module-private: nothing outside needs the number, and `deformcheck` §M's no-transcendental clause reads
 * the literal `a * INV_TAU` out of this file's SOURCE, which an export would not help.
 */
const INV_TAU = 1 / (Math.PI * 2);

/**
 * The half-extent `Travel` is measured in when no design box is supplied.
 *
 * ⚠️ **NOT A MAGIC FALLBACK — it mirrors the generator's own default.** `LissajousGenerator.init()` reads
 * `designResolution?.width ?? 100` / `?? 100` and then takes `min(w, h) * 0.5`, so a preset with no design
 * box travels in a 100×100 room and this is that room's half-extent. Supplying a different number here
 * would make a diagram disagree with the engine on exactly the presets that author nothing.
 */
export const DEFAULT_DESIGN_HALF_EXTENT = 50;

/**
 * The triangle basis, `tri = 1 − 4·|frac(u + ¼) − ½|` at `u = a/2π`. **This is the DEFINITION.**
 *
 * It shares `Math.sin`'s zeros and its ±1 peaks exactly and is odd — **those three ARE the Jones–Przytycki
 * family conditions**, which is what licenses the "the knot type cannot change" claim in the tooltip and
 * both manuals. Built from `floor` and `abs` with **no transcendental call**, which is the operator's one
 * measured advantage (`33.21` shipped a defect that inverted it).
 *
 * ⚠️⚠️ **THERE IS A SECOND, TEXTUALLY IDENTICAL COPY INSIDE `sumWaveAxes` AND THAT DUPLICATION IS DELIBERATE,
 * MEASURED, AND MUST NOT BE "TIDIED" AWAY.** Calling this function from the particle loop instead benchmarks
 * at **0.80 → 1.74 ms/frame at 50 000 particles** on the `sharp === 1` path — a **2.1× regression**, because
 * V8 does not inline it across nine calls per particle. So the loop keeps its own copy and this export serves
 * the callers that are *not* per-particle. ⚠️ **The duplication is held honest by an instrument, not by
 * review**: `deformcheck` §M asserts this function and the inlined copy agree **bit-exactly** over a sweep,
 * probing the loop's copy through a single-slot unit table. **If you change one, the clause goes red.**
 *
 * ⚠️ **Why it is exported at all** — two callers, neither hot: Phase 35's warp shapes (`35.D6`/`35.D8`: the
 * static field's wave table is built once per chain change over a ~2200-entry 1-D array, so the inlining cost
 * that governs the particle loop simply does not arise there), and `deformcheck` §M itself, which until now
 * asserted the triangle's mathematics against a **local re-implementation** — a gap proven real, since seeding
 * this file's `+ 0.25` as `+ 0.5` left all 63 of its clauses green.
 *
 * ⚠️ Takes the angle `a` in **radians**, exactly as the loop does — not `u`. A caller that pre-divides by
 * `2π` and passes `u` gets a figure wrong by a factor of `2π` in the phase, which reads as a shifted curve.
 */
export function triBasis(a: number): number {
  const u = a * INV_TAU + 0.25;
  return 1 - 4 * Math.abs(u - Math.floor(u) - 0.5);
}

/**
 * The wave law: `out[q] = Σ_slots basis((n + phase) · fm) · am`, for the three axes `q`.
 *
 * ⚠️ **THE PHASE IS *INSIDE* THE MULTIPLICATION — `sin((n + phase) · fm)`, never `sin(n · fm + phase)`.**
 * The effective shift is `phase × winding`, so the wrong form disagrees with the engine on every winding but
 * 1, and it disagrees *plausibly*: a shifted curve, not a broken one. ⚠️ **`fm` arrives ALREADY divided by
 * `DEG` and `am` does not** — that asymmetry belongs to the callers (`n` sweeps 0→360 in degrees while
 * `Math.sin` wants radians, so the conversion belongs on the frequency and nowhere else), which is why this
 * function takes resolved numbers and performs no unit conversion of its own.
 *
 * ⚠️ **THE SLOT COUNT COMES FROM `am.length` SO THIS IS NOT A FOURTH COPY OF `MAX_WAVES`** (already declared
 * in `lissajous.ts`, `score-canvas.ts` and `composer-model.ts`). Both callers build a table padded to
 * exactly `MAX_WAVES × 3`. The **axis** count is the literal 3 because `out` is a 3-vector: it is the shape
 * of the output, not an enumeration that could grow.
 *
 * ⚠️ **ACCUMULATION ORDER IS SLOT-OUTER / AXIS-INNER AND MUST STAY SO.** Float addition is not associative,
 * so reordering the loops changes the last bits of every coordinate in the library — a difference no visual
 * review can see and no `===` on a hand-picked sample will catch.
 *
 * ⚠️ `out` is written in place and never allocated here: this is the innermost loop of the hottest function
 * in the engine, so the caller hoists one 3-element scratch (invariant 8 is about RATE).
 *
 * ⚠️⚠️ **v8 `34.4`: `sharp` IS PER WAVE LEVEL (SLOT), NOT ONE NUMBER, AND LEVELS ARE NOT AXES.** `34.D11`
 * makes `Sharpness` the one operator whose extra numbers are per LEVEL — `sharpness` (Body),
 * `sharpnessStructure`, `sharpnessDetail` — so the array is indexed by `t` and is read INSIDE the slot loop,
 * one lookup per slot rather than per term. **A caller passing a 1-element array silently faceted only slot
 * 0 and left the rest smooth**, which is why both callers build a `MAX_WAVES`-long table and why the
 * `?? sharpness` backfill (`34.D11`) happens at the ADOPT site rather than here: this function must not know
 * what an absent key means.
 */
export function sumWaveAxes(
  out: number[],
  n: number,
  am: readonly (readonly number[])[],
  fm: readonly (readonly number[])[],
  ph: readonly (readonly number[])[],
  sharp: readonly number[],
): void {
  out[0] = 0; out[1] = 0; out[2] = 0;
  for (let t = 0; t < am.length; t++) {
    const amT = am[t]!, fmT = fm[t]!, phT = ph[t]!;
    const sharpT = sharp[t] ?? 0;
    for (let q = 0; q < 3; q++) {
      const a = (n + phT[q]!) * fmT[q]!;
      /*
       * v8 `33.2` — the basis: `sin` at `sharp = 0`, a triangle at `sharp = 1`, a blend between.
       *
       * ⚠️⚠️ **THREE CASES, AND THE BRANCH STRUCTURE IS A MEASURED BUG FIX — COLLAPSING IT RE-INTRODUCES A
       * SHIPPED DEFECT.** The first draft read `Math.sin(a) + sharp * (tri - Math.sin(a))`, **calling
       * `Math.sin` TWICE**, so every faceted preset paid **18 transcendentals per particle instead of 9**:
       * the control was 2× *more* expensive than the basis it replaces while the tooltip, the plan and the
       * manual all said "cheaper". It was found by asking what the preview grid now costs, not by any
       * checker — `deformcheck` §M's clause scans the TRIANGLE's two lines and both `Math.sin` calls were
       * outside them. After the fix, faceted presets measure **34–54 % cheaper** than smooth ones.
       * **Transcendentals per term: `sharp === 0` → ONE; `sharp === 1` → ZERO; intermediate → ONE, hoisted
       * into `sv` and reused.** If an edit here costs a second one on any path, it is wrong.
       *
       * ⚠️⚠️ **`sharp === 0` IS A BRANCH AND NOT A ZERO WEIGHT, BECAUSE BIT-IDENTITY IS NOT ALGEBRAIC
       * IDENTITY.** `33.D2` puts this control on every preset authored before Phase 33, so `(1−λ)·sin +
       * λ·tri` at `λ = 0` is not good enough: it is exact for every finite value **except `-0`**, which
       * `x + 0*tri` silently turns into `+0`. One bit, library wide, invisible to every checker that
       * compares with `===` on a non-zero sample. **Branch, never weight.**
       *
       * ⚠️ **THE TRIANGLE IS BUILT FROM `floor` AND `abs`, WITH NO TRANSCENDENTAL CALL**, at `u = a/2π`:
       * `tri = 1 − 4·|frac(u + ¼) − ½|`. It shares `sin`'s zeros and its ±1 peaks exactly and is odd —
       * **those three ARE the Jones–Przytycki family conditions**, so a triangle built with the wrong phase
       * or amplitude is a different function and the knot-invariance theorem the tooltip and the manual both
       * cite stops applying. ⚠️ **The two-line shape is load-bearing for `deformcheck` §M**, which windows
       * `const u = a * INV_TAU` plus the FOLLOWING line and forbids `Math.sin` inside that window — a first
       * attempt read 200 characters instead, swept up the blend's legitimate sine, and failed on correct
       * code. Keep the two lines adjacent and keep every transcendental out of them.
       */
      let basis: number;
      if (sharpT === 0) {
        basis = Math.sin(a);
      } else {
        const u = a * INV_TAU + 0.25;
        const tri = 1 - 4 * Math.abs(u - Math.floor(u) - 0.5);
        if (sharpT === 1) {
          basis = tri;
        } else {
          const sv = Math.sin(a);
          basis = sv + sharpT * (tri - sv);
        }
      }
      // ⚠️ `out[q] = out[q]! + …` rather than `+=` only because `noUncheckedIndexedAccess` cannot see that
      // the three slots were just initialised. The arithmetic is the `+=` it replaces, bit for bit.
      out[q] = out[q]! + basis * amT[q]!;
    }
  }
}

/**
 * v8 `34.3` — **`Grow`: the along-curve amplitude ramp, `am · (1 + k·τ)`.**
 *
 * ⚠️⚠️ **`k` IS A RAMP COEFFICIENT AND `0` IS THE IDENTITY, NOT `1`.** See `GROW_FLOOR` in
 * `core/deform-limits.ts` for the full statement; the short form is that a reader who writes `1` as the
 * default doubles the far end of every stroke in the library and nothing anywhere would say so.
 *
 * ⚠️⚠️ **IT MUST RUN ON THE WAVE SUM ALONE — BEFORE `applyTravel` AND BEFORE `applyOffset` — AND THAT IS
 * THE ONE ORDERING CLAIM THIS OPERATOR MAKES.** Run after either of them it would scale the secular term
 * and the DC term too, turning a constant translation into a ramped one and a linear sweep into a
 * quadratic one. **Those are different operators, neither specified.** (`applyTravel` and `applyOffset`
 * commute exactly with each other — two additions into the same accumulator — so THEIR order is free and
 * must not be read as a contract. This one is.)
 *
 * ⚠️ **PER AXIS AND HOISTED OUT OF THE SLOT LOOP, which is algebraically the specification's per-term form
 * at a third of the multiplies** (`Σ_t basis·am·(1+k·τ)` = `(Σ_t basis·am)·(1+k·τ)` by distributivity: 3
 * multiplies per particle instead of 9). ⚠️ **It is NOT bit-identical to the per-term form** — it is
 * identical at the IDENTITY, which is all the export gate and the Mixer allowlist require — and it
 * forecloses a per-SLOT `Grow`, which is out of scope. If per-slot is ever re-proposed, this hoist is the
 * thing that has to come back out.
 *
 * ⚠️ **THE PER-AXIS GATE IS A COST GATE, NOT A CORRECTNESS GATE, and the difference is stated because the
 * sibling below is the opposite case.** The factor is `1 + 0·τ` = exactly 1 and it enters as a
 * MULTIPLIER, so `x * 1` preserves `-0` and skipping saves work rather than protecting a bit. That is
 * `particleSize`'s standing in `UNCONDITIONAL_KEYS`, not the twist's, and overstating it would licence a
 * future key that only looked similar.
 *
 * `frac` is the element's position along the curve in `[0, 1)` — `i * invCount` in the generator and
 * `i / samples` in the Score, for `applyTravel`'s reason: the two counts differ by orders of magnitude and
 * only the FRACTION is common to both.
 */
export function applyGrow(
  out: number[],
  frac: number,
  grow: readonly number[],
): void {
  const gX = grow[0] !== 0, gY = grow[1] !== 0, gZ = grow[2] !== 0;
  if (!(gX || gY || gZ)) return;
  if (gX) out[0] = out[0]! * (1 + grow[0]! * frac);
  if (gY) out[1] = out[1]! * (1 + grow[1]! * frac);
  if (gZ) out[2] = out[2]! * (1 + grow[2]! * frac);
}

/**
 * v8 `34.2` — **`Offset`: the DC translation term**, in design half-extents, identical for every particle.
 *
 * ⚠️ **IT READS NO POSITION AND NO INDEX**, so unlike the taper and the bend it creates no axis order to
 * get wrong: the same constant is added to every particle on every axis. The translation is exact (the
 * specification measures max deviation `0.00e+0` from a clean shift), which is why it is NOT a member of the
 * `Deformed` chip — see `facetcheck` §B's `NOT_DEFORMATION.offset`.
 *
 * ⚠️⚠️ **GATED PER AXIS, NOT ONLY ON THE TRIPLE, AND HERE THAT IS A CORRECTNESS GATE** — the mirror image
 * of `applyGrow` above. The reachable state is one axis non-zero with the stage RUNNING, and `x += 0 * h`
 * is `x + 0`, which is exactly `x` for every finite `x` **except `-0`**, where it silently becomes `+0`.
 * Testing each axis makes the claim the STRONG one — *the code does not execute* — instead of a
 * reachability argument about negative zero that nobody can settle. **`mixercheck`'s
 * `UNCONDITIONAL_LEAVES` entry for `offsetX/Y/Z` rests on this**, exactly as `travel`'s does.
 *
 * ⚠️ **`halfExtent` IS SHARED WITH `applyTravel` ON PURPOSE** (`34.D3`), so the two rows read in one unit
 * and a Z offset composes with a Z travel in a quantity the perspective readout can bound.
 */
export function applyOffset(
  out: number[],
  offset: readonly number[],
  halfExtent: number,
): void {
  const oX = offset[0] !== 0, oY = offset[1] !== 0, oZ = offset[2] !== 0;
  if (!(oX || oY || oZ)) return;
  if (oX) out[0] = out[0]! + offset[0]! * halfExtent;
  if (oY) out[1] = out[1]! + offset[1]! * halfExtent;
  if (oZ) out[2] = out[2]! + offset[2]! * halfExtent;
}

/**
 * v8 `33.3` — the secular `Travel` term: a linear sweep along each axis across the population.
 *
 * `frac` is the element's position along the curve in `[0, 1)` — `i * invCount` in the generator (`invCount`
 * is `1/particleCount`) and `i / samples` in the Score. **It is a FRACTION rather than an index precisely
 * because the two counts differ**: 50 000 particles against a few thousand diagram samples describe the same
 * curve, and only the fraction is common to both.
 *
 * ⚠️ **CALLED AFTER THE WAVE SUM AND BEFORE EVERY DEFORMER**, so the operators downstream see the travelled
 * position and a twist of a helix is a twisted helix rather than a twisted loop that is then slid. That
 * ordering is a choice and it is the one that composes.
 *
 * ⚠️⚠️ **GATED PER AXIS, NOT ONLY ON THE TRIPLE, AND THE REASON IS THE `-0` CASE.** The reachable state is
 * one axis non-zero and the other two at 0 with the stage RUNNING — and `x += 0 * s` is `x + 0`, which is
 * exactly `x` for every finite `x` **except `-0`**, where it silently becomes `+0`. Testing each axis makes
 * the claim the STRONG one — *the code does not execute* — instead of *the arithmetic is inert unless the sum
 * happens to be negative zero*, which is a claim about reachability nobody can check.
 * **`mixercheck`'s `UNCONDITIONAL_LEAVES` entry for `travelX/Y/Z` rests on this**, so the three tests are
 * load-bearing rather than defensive, and `deformcheck` §M asserts them from source (the measured version is
 * impossible: `getState().positions` is projected screen space, where `-0` and `+0` project alike).
 */
export function applyTravel(
  out: number[],
  frac: number,
  travel: readonly number[],
  halfExtent: number,
): void {
  const tvX = travel[0] !== 0, tvY = travel[1] !== 0, tvZ = travel[2] !== 0;
  if (!(tvX || tvY || tvZ)) return;
  const s = frac * halfExtent;
  if (tvX) out[0] = out[0]! + travel[0]! * s;
  if (tvY) out[1] = out[1]! + travel[1]! * s;
  if (tvZ) out[2] = out[2]! + travel[2]! * s;
}
