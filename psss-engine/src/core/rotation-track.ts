/**
 * The X/Y/Z rotation-speed track: the RPM the Visual FX sliders show <-> the degrees/second the engine stores.
 *
 * ## Why this is its own module and not three literals in `visual-fx.ts`
 *
 * The number has THREE owners — the slider track, `LissajousGenerator.setRotationSpeed`'s clamp, and
 * `trackcheck` — and a slider `min`/`max` is COSMETIC while the engine's clamp is what actually moves
 * (invariant 13). `SPEED_MIN`/`SPEED_MAX` are shared between the tab and `main.ts` for exactly that reason;
 * the difference here is that the clamp lives in the GENERATOR, so sharing through `visual-fx.ts` would make
 * `generators/` depend on a UI tab. One neutral module, imported by all three, makes the drift
 * unrepresentable rather than merely asserted.
 *
 * ## The unit, DERIVED rather than assumed (invariant 10)
 *
 * `generators.rotation` is consumed at `lissajous.ts`'s `update()`:
 *
 *     angle[i] += rotationSpeed[i] * (dt / 1000)      // dt in ms  ->  units per SECOND
 *     ... Math.sin(angle[i] / DEG)                    // DEG = 180/PI  ->  angle is in DEGREES
 *
 * So the stored unit is **degrees per second** and one full turn is 360 of them:
 * `1 RPM = 360 deg / 60 s = 6 deg/s` exactly. That factor is {@link DPS_PER_RPM}; nothing else in the engine
 * knows about RPM.
 *
 * ⚠️ **The label is NOMINAL RPM, not the on-screen rate.** `main.ts` calls `generator.update(dt *
 * speedFactor)`, so the true rate is `nominal x speedFactor`. The slider deliberately shows the nominal
 * value: it is what an export contains, it is what a preset round-trips, and an effective readout would move
 * the handle whenever the Speed slider moved — and would make the value a drag writes depend on the current
 * Speed, which is precisely the exact round trip this track exists to guarantee.
 *
 * ## The sign is INVERTED, and that is a rendering fact rather than a preference
 *
 * `project()` rotates Z as `(x, y) -> (x cos - y sin, x sin + y cos)` — counter-clockwise in a y-UP frame —
 * and then writes `originX - x * proj`, `originY - y * proj`, negating BOTH axes into the canvas's y-DOWN
 * frame. The two negations cancel for the sense of the turn, so a **positive** stored `rotation[2]` renders
 * **clockwise** on screen. The requirement is "left of centre = clockwise", so the slider value is
 * `-dps / DPS_PER_RPM` and all three axes use the same sign convention (X and Y are tumbles with no
 * unambiguous clockwise reading, so consistency across the row is what matters there).
 *
 * ## The curve, measured
 *
 * Signed quartic: `rpm = sign(p) * ROT_MAX_RPM * |p|^4` over a track position of -1..+1.
 *
 * A LINEAR +-10 RPM track would be unusable on the actual library. Measured over all 177 legacy presets
 * (259 non-zero components): the range is -0.167..+5.0 RPM and **243 of the 259 sit inside +-0.25 RPM**, i.e.
 * 94% of the authored values would live in the middle 2.5% of the travel. On the quartic the library's
 * median (0.083 RPM) sits at **30% of half-travel** and 5 RPM at 84%, so both the slow crawl every preset
 * actually uses and the fast spin the range advertises get real gestures.
 *
 * Signed quartic rather than the logarithmic `sliderMul` curve Figure Scale uses, because that curve is
 * symmetric about a multiplicative centre of 1.0 and has NO ZERO at all — and 0 here is categorical ("no
 * rotation"), the default, and the value 37 of the 177 presets carry on every axis. `sign(p) * |p|^n` is
 * exact at 0 and at both ends by construction.
 *
 * ⚠️ **`step` and the quantisation grid were chosen together, and both are measured** (2001 stops at
 * `ROT_STEP`, so 1000 per direction):
 *
 *   - endpoints exact: position -1 -> +60 deg/s, +1 -> -60 deg/s (i.e. +-10 RPM after the sign flip).
 *   - **0 is exactly reachable and STICKY**: 9.6% of half-travel quantises to it. Kept deliberately, for the
 *     same reason `DRIFT_TRACK` and `SPEED_TRACK` keep their sticky ends — 0 is the categorical default and
 *     easy return to it is worth more than the sub-0.002 RPM values it swallows, which are slower than one
 *     turn per 8 minutes and indistinguishable from standing.
 *   - **30 of the 36 distinct authored speeds round-trip EXACTLY** through value -> position -> value, across
 *     every preset source (the 177 in `public/psss_presets.json` plus every `rotation:` literal in
 *     `src/presets/`). ⚠️ Re-measured 2026-08-27 as presets settle — the SIX exceptions have not changed, but
 *     the totals move with the library, so re-run `trackcheck` rather than trusting these two numbers. Those
 *     six are off by at most **0.0017 RPM**, which is below the readout's own two decimals, so no preset
 *     displays a different number after a round trip: `0.857143` -> `0.86` and `1.285714` -> `1.29`
 *     (repeating decimals no finite grid can hold), `2` -> `1.99`, `6` -> `5.99`, `8.8` -> `8.81`,
 *     `30` -> `30.01`. ⚠️ `1.285714 -> 1.29` is why `fmtRotationRpm` tolerates a SHARED label: `Bors dream`
 *     authors 1.29 outright, so the two are one track position and must read alike.
 *   - the map is **IDEMPOTENT at every one of the 2001 stops**, which is the property that actually matters
 *     for "correctly translated back and forth": a value that has been through the track once cannot drift
 *     further, so a preset load followed by any number of resyncs never creeps.
 *   - 1481 distinct speeds, and the worst non-zero dead run is 30 consecutive stops (at 0.01 deg/s, the
 *     smallest representable speed) — well inside the 60-stop ceiling `trackcheck` enforces for the particle
 *     track, so a keyboard arrow is never visibly dead in the range anyone drags to.
 *   - every multiple of the grid is REACHABLE out to **+-0.97 deg/s**, i.e. 258 of the library's 259 non-zero
 *     components (all but the single 30) sit inside the fully-reachable band.
 *
 * ⚠️ **Quantised in DEGREES/SECOND, not in the RPM it displays, and that was measured rather than assumed.**
 * Quantising in RPM is the obvious choice — it is the unit shown, and it is what `DRIFT_TRACK` and
 * `SPEED_TRACK` do — but the AUTHORED data is in degrees/second, and an RPM grid cannot represent it: a
 * 0.01-RPM grid drops exact round trips from **30/36 to 10/36** (0.1 -> 0.12, 0.5 -> 0.48, 1 -> 1.02, and
 * `0.857143` -> `0.84`), so nearly every preset would come back from the track holding a value nobody
 * authored. The readout rounds to two decimals either way, so the RPM grid buys a tidier exported number and
 * pays for it in fidelity to the library. A finer 3-decimal degrees/second grid was also rejected: it lands
 * exact round trips at 14/36 for resolution below the readout's precision, and it nearly halves the sticky
 * zero (9.5% of half-travel -> 5.3%).
 */

/** Slider range, in full turns per minute. The sign convention is in this module's header. */
export const ROT_MAX_RPM = 10;

/** `1 RPM = 6 degrees/second`. Derived from `update()`'s integration; see the header. */
export const DPS_PER_RPM = 6;

/**
 * The generator's clamp on `rotation`, in degrees/second — `ROT_MAX_RPM` expressed in the stored unit.
 *
 * ⚠️ Shared with the slider rather than written as a literal in `lissajous.ts`: the slider's range is
 * cosmetic and this is what the render loop obeys, so two copies can drift into the inert control of
 * invariant 13.
 */
export const ROT_MAX_DPS = ROT_MAX_RPM * DPS_PER_RPM;

/** Curve exponent. See the header for why quartic and why not the logarithmic `sliderMul` curve. */
const ROT_CURVE = 4;

/** Track resolution. Coupled to `ROT_DPS_GRID`; both are measured in the header. */
export const ROT_STEP = 0.001;

/**
 * Quantisation grid for the speed the handle produces, in **degrees/second** — the STORED unit, not the
 * displayed one. ⚠️ The header records why: the authored library is in degrees/second, and an RPM grid drops
 * exact round trips from 30/36 to 10/36.
 */
const ROT_DPS_GRID = 0.01;

/** Stored degrees/second -> RPM as the slider shows it. Sign-inverted; see the header. */
export function dpsToRpm(dps: number): number {
  const d = Number.isFinite(dps) ? dps : 0;
  return -d / DPS_PER_RPM;
}

/** RPM as the slider shows it -> stored degrees/second. The exact inverse of {@link dpsToRpm}. */
export function rpmToDps(rpm: number): number {
  const r = Number.isFinite(rpm) ? rpm : 0;
  return -r * DPS_PER_RPM;
}

/**
 * Stored degrees/second -> track position in -1..+1.
 *
 * Clamps to the range first, so a preset authored past +-10 RPM parks the handle at the end rather than
 * off the track. No library preset does (the largest is 30 deg/s = 5 RPM), but an imported one could.
 */
export function rotationToPos(dps: number): number {
  const rpm = Math.max(-ROT_MAX_RPM, Math.min(ROT_MAX_RPM, dpsToRpm(dps)));
  return Math.sign(rpm) * Math.pow(Math.abs(rpm) / ROT_MAX_RPM, 1 / ROT_CURVE);
}

/**
 * Track position in -1..+1 -> stored degrees/second, quantised to the `ROT_DPS_GRID` degrees/second grid.
 *
 * Quantised at all so a handle at rest holds a round number rather than `0.083791...` — the value is exported,
 * and an export is mostly runtime-default noise already. Quantised in the STORED unit rather than in the
 * displayed one because that is what the authored library is in; see the header's measurement.
 */
export function posToRotation(pos: number): number {
  const p = Math.max(-1, Math.min(1, Number.isFinite(pos) ? pos : 0));
  const raw = Math.sign(p) * ROT_MAX_RPM * Math.pow(Math.abs(p), ROT_CURVE);
  return Math.round(rpmToDps(raw) / ROT_DPS_GRID) * ROT_DPS_GRID;
}

/**
 * Decimals below {@link FMT_FINE_RPM}. See {@link fmtRotationRpm} for why the precision is not fixed.
 */
const FMT_FINE_RPM = 0.1;

/**
 * The value label: RPM with an explicit sign, plus the direction word.
 *
 * The direction word is the point of the control — a bare `-0.50` says nothing about which way the figure
 * turns, and the whole sign convention above exists to make "left = clockwise" true. `0` prints as `Off`
 * rather than `0.00 rpm cw`, the same way `fmtSymmetryFold` prints `Off` at fold 1: 0 is categorical, and a
 * signed zero with a direction attached reads as though something were happening.
 *
 * ⚠️ **The precision is ADAPTIVE, and two fixed decimals — the obvious choice — was MEASURED WRONG rather
 * than merely suspected.** RPM is a coarse unit for this library: the authored speeds run from 0.01 deg/s to
 * 30 deg/s, i.e. **0.0017 to 5.0 RPM**, so a figure at the low end takes ten minutes to complete one turn.
 * At `toFixed(2)` the distinct authored speeds collapse to **21 labels**, and the two slowest print as
 * **`-0.00 cw`** — a readout asserting zero for a figure that is visibly turning, which is the same defect as
 * printing a direction at 0, in the other direction. Three decimals below 0.1 RPM gives them all their own
 * label; keeping two above it stops the fast half reading `+10.000 ccw`, which is noise in a 1/3-panel cell.
 *
 * ⚠️ **Two AUTHORED values can legitimately share a label, and widening the precision to separate them is
 * the wrong fix — measured 2026-08-27.** `1.285714` and `1.29` deg/s both print `-0.21 cw`. They are not two
 * distinguishable settings: the header lists `1.285714 -> 1.29` among the six values the 0.01 deg/s grid
 * cannot hold, so they are the SAME track position and one label for them is the consistent readout. Going to
 * three decimals everywhere does separate them (35/35 rather than 34/35) but makes the label CHANGE on a
 * round trip — `-0.214 cw` becomes `-0.215 cw` after one load — which breaks the exact-round-trip property
 * the grid exists for, in exchange for distinguishing two speeds 0.0007 RPM apart. `trackcheck` therefore
 * asserts uniqueness over the speeds the track can REPRESENT (34 of them, all distinct here), and its comment
 * records the calibration proving that basis still catches a fixed `toFixed(2)`.
 */
export function fmtRotationRpm(dps: number): string {
  const rpm = dpsToRpm(dps);
  if (rpm === 0) return 'Off';
  const mag = Math.abs(rpm);
  // `cw` / `ccw` rather than arrows: the readout cell is 46px and an arrow glyph's width varies by font.
  return `${rpm > 0 ? '+' : '−'}${mag.toFixed(mag < FMT_FINE_RPM ? 3 : 2)} ${rpm > 0 ? 'ccw' : 'cw'}`;
}
