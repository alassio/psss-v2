import type { OverlayState, UnifiedPreset } from '../presets/types.ts';
import type { PresetStatistics } from './preset-stats.ts';
import { FILM_LOOKS, CUSTOMIZE_FILM_LOOK, type FilmLookParams } from '../renderers/film-looks.ts';
import { OVERLAY_RULES, type ScaleLaw, type ScalerId } from './overlay-rules.ts';
// ⚠️ **`resolvePaletteSelection` IS THE ONE OWNER OF "which palette, mapped how", AND `palettecheck` §F
// BANS RE-DERIVING IT.** `rowLiveness`'s first version read `overlay.palette` directly and was WRONG on
// 124 presets whose palette comes from the FILM LOOK BUNDLE rather than the overlay — it reported `Warmth`
// live on 81 where the measured answer is far lower. Invariant 17 verbatim: two sources, one resolution
// order, and nothing re-resolves it afterwards.
import { resolvePaletteSelection } from '../renderers/palette-selection.ts';

export interface SliderDef {
  id: string;
  label: string;
  /**
   * Surfaced as the control's tooltip, for the sliders whose behaviour is deliberate but reads as broken.
   *
   * Two do (EX9/EX10): `Symmetry`'s lower half does nothing because there is no meaningful inverse of
   * "quantise toward 90°", and `Depth` starts a fully-static preset rotating because it substitutes a
   * `BASE_ROT` fallback for a zero rotation vector. Both were reported as defects; neither is one. A
   * tooltip is the fix because changing either behaviour would remove a capability — the alternative for
   * `Depth` is that the slider does nothing at all on the 6 static presets.
   */
  hint?: string;
  /**
   * ⚠️ **`pass` IS REQUIRED OF EVERY ROW EVEN THOUGH ONLY THE `Grade` ROWS USE IT (v8 `26.1`).** It is a
   * parameter rather than module state because `26.D9` ruled out every alternative for measurable reasons:
   * a module-level flag survives across presets and across the Mixer's calls into this same module;
   * testing `ov.customFilmLookParams` for existence cannot distinguish "this pass built it" from "the
   * preset authored it", which is Defect C's whole cause; and mutating without a pass owner leaves the
   * READER deciding when a rebuild is due, which is the *identity gate belongs in the ONE owner of the set*
   * rule read backwards.
   */
  apply(preset: UnifiedPreset, value: number, stats: PresetStatistics, pass: GradingPass): void;
}

/**
 * One grading rebuild per apply pass, carrying the baseline's own grade (v8 `26.1`/`26.2`, `26.D9`).
 *
 * ⚠️ **IT CARRIES THE SEED, IT DOES NOT MERELY MARK THE PASS OPEN**, and that is `26.D9`'s `×875` clause: a
 * pass owner that only says *"a rebuild already happened"* leaves `grading()` with the LIVE object as its
 * only available seed, which is the compounding defect that put the literal `'Legacy'` in this file in the
 * first place. **"Seed from the preset's own grade" and "seed from the live overlay" are two readings of
 * one sentence and only the first is survivable** — see `grading()`'s `×875` paragraph.
 */
export interface GradingPass {
  /** The baseline's own `customFilmLookParams`, where the preset authored one. */
  readonly seedParams: FilmLookParams | null;
  /** The bundle the seed came from, or `null` where the preset's OWN params were the source. */
  readonly seedBundle: string | null;
  /**
   * Set by the FIRST `grading()` call in this pass and mutated by every later one. ⚠️ **This field being
   * non-null is the only thing that distinguishes "already rebuilt in this pass" from "the preset authored
   * a grade", which no test on the preset itself can do.**
   */
  params: FilmLookParams | null;
}

/**
 * Open a grading pass over the round's BASELINE preset.
 *
 * ⚠️ **HAND IT THE BASELINE, NEVER THE WORKING COPY.** The baseline is captured once per shaping round by
 * `applyAllSliders()` and is fixed for its duration, so it is the only reference that is both stable and
 * the preset's own. The working copy is what the rows are busy mutating.
 *
 * ⚠️ **A PASS IS OPENED EVEN WHEN NO GRADING ROW IS OFF-CENTRE** (`26.1`), because a conditional pass
 * boundary is one the next reader will not know exists. Opening it costs nothing: `grading()` is what
 * writes, and only an off-centre row calls it.
 */
export function beginGradingPass(baseline: UnifiedPreset): GradingPass {
  const ov = baseline.overlay;
  const authored = ov?.customFilmLookParams;
  if (authored) {
    /*
     * ⚠️ **THIS BRANCH IS THE WHOLE OF DEFECT C, AND IT FIRED ON 145 PRESETS.** 172 presets carry
     * `filmLook: 'Customize'`; 145 of them author `customFilmLookParams` but NO `sliderBaseFilmLook`, and
     * the old base resolution keyed off `sliderBaseFilmLook`/`filmLook` alone — so it fell through to the
     * literal `'Legacy'` and seeded from the Legacy BUNDLE, discarding the preset's authored grade before
     * the slider scaled anything. Measured on those 145: one `Mood` nudge (0.5 → 0.6) changed a median of
     * **12** authored grading fields that have nothing to do with the slider, and the palette on **94**.
     * Witness `Aliens DNA`: `exposure 1.4 → 1.175` — Legacy's 1.0 × √1.378, i.e. **the authored 1.4 was
     * discarded BEFORE the multiplier was applied.** A Snapshot or Export taken off-centre baked the loss.
     */
    return { seedParams: authored, seedBundle: ov?.sliderBaseFilmLook ?? null, params: null };
  }
  // No authored grade: the named bundle really IS the source, so record which one.
  const bundle = ov?.sliderBaseFilmLook
    ?? (ov?.filmLook && ov.filmLook !== CUSTOMIZE_FILM_LOOK ? ov.filmLook : 'Legacy');
  const seed = (FILM_LOOKS as Record<string, FilmLookParams | undefined>)[bundle]
    ?? FILM_LOOKS['Legacy'];
  return { seedParams: seed ?? null, seedBundle: bundle, params: null };
}

// Value range: 0.0–1.0, center 0.5 = no change (×1.0).
// Multiplicative helper: 0→0.2×, 0.5→1×, 1→5× of the preset's own value.
// Uses log2(5) ≈ 2.322 as the exponent scale so endpoints are exact.
const LOG2_5 = Math.log2(5);
export function sliderMul(v: number): number {
  return Math.pow(2, LOG2_5 * (2 * v - 1));
}
// Internal alias
const mul = sliderMul;

/**
 * Get the preset's grading params as a mutable `FilmLookParams`, switching it to Customize mode.
 *
 * Grading is driven **solely** from `FilmLookParams` (ADR 007), and only the `Customize` film look
 * routes through `overlay.customFilmLookParams` — a named bundle is applied straight from `FILM_LOOKS`
 * and ignores any override. So a slider that wants to change exposure, glow or bloom must move the
 * preset to Customize, seeded from whatever look is active, or its write goes nowhere.
 *
 * This is what `Mood` and `Glow` were missing. They wrote `postProcessors.toneMap` and
 * `postProcessors.bloom`, which **nothing reads** — `main.ts` initialises both processors from
 * hardcoded literals. `Mood` was therefore entirely inert and `Glow`'s bloom half did nothing
 * (defect EX1).
 *
 * ## Always seeds from a NAMED bundle — never from an existing Customize seed
 *
 * `sliderBaseFilmLook` records which bundle the seed came from, and the seed is rebuilt from that bundle
 * on every call. This makes the sliders IDEMPOTENT, which is the tab's core contract: `applyAllSliders`
 * re-applies every slider from a captured baseline precisely so that dragging cannot compound.
 *
 * An earlier version returned the existing seed so "repeated moves compose". That was wrong, and badly:
 * a slider fires on EVERY `input` event, so one drag emits dozens of applies. With `Mood` multiplying an
 * already-multiplied exposure each time, a small nudge reached exposure ×875 within ~40 events and the
 * figure went flat white — then could not be recovered, because returning to centre makes `apply()`
 * return early and never writes a corrected value. Reported 2026-08-06.
 *
 * ⚠️ Only call this when something is actually going to change. Calling it at slider centre would
 * silently convert a preset from "Cinematic" to "Customize (a copy of Cinematic)" — visually identical,
 * but it would strip the user's named choice from every subsequent export.
 *
 * ## ONE rebuild per pass — the fix for Defect A, which fired on 274 of 274
 *
 * ⚠️ **THIS FUNCTION USED TO END `ov.customFilmLookParams = params` WITH `params` A BRAND-NEW OBJECT, ON
 * EVERY CALL, AND IT HAS FOUR CALL SITES.** `applyAllSliders()` runs them in `SEMANTIC_SLIDERS` order, so
 * **the last grading row to run won and every earlier grading write was thrown away.** Mood is last.
 * Measured: with all ten rows at 0.8, `Depth`'s `depthSize` differed from its single-slider result on
 * **274/274**; at 0.6, `Glow`'s halo write was destroyed by a later grading row on **274/274**.
 *
 * ⚠️ **AND AT 0.8 THE GLOW AND MOOD FIGURES READ 0/274, WHICH IS NOT HEALTH — IT IS THE TWO DEFECTS
 * MASKING EACH OTHER** (Defect B had already discarded Glow's write before Mood arrived). **Reconcile
 * those three numbers by NAME, never by totalling them.** It is also why the aggregate leaf-count diff
 * that the 2026-10-03 evaluation led with read as healthy: **an aggregate cannot see one writer clobbering
 * another's field.**
 *
 * Now the first call in a pass builds the object and every later call returns **that same object** to be
 * mutated in place. The idempotency the old rebuild bought is preserved by a different mechanism — the
 * pass is seeded from the fixed BASELINE, not from the live overlay — which is also what fixes Defect C.
 */
function grading(preset: UnifiedPreset, pass: GradingPass): FilmLookParams {
  if (!preset.overlay) preset.overlay = {};
  // (Callers must gate on `value !== 0.5` themselves — see the warning above. `applyAllSliders` already
  // skips centre, so this is only reachable by calling `apply()` directly, e.g. from a test.)
  const ov = preset.overlay;

  // Already rebuilt in THIS pass: hand back the same object. ⚠️ The test is on the PASS, never on the
  // preset — `ov.customFilmLookParams` being present cannot tell "this pass built it" from "the preset
  // authored it", and conflating those two is exactly Defect C.
  if (pass.params) return pass.params;

  const params: FilmLookParams = { ...(pass.seedParams ?? FILM_LOOKS['Legacy']) };
  // ⚠️ **ONLY where a bundle really was the source (`26.2`).** Where the preset's own authored params were
  // the seed there is no bundle to name, and writing one would be a claim about provenance that is false;
  // the key is slider-owned, so the revert deletes it and absent stays absent.
  if (pass.seedBundle !== null) ov.sliderBaseFilmLook = pass.seedBundle;
  ov.filmLook = CUSTOMIZE_FILM_LOOK;
  ov.customFilmLookParams = params;
  pass.params = params;
  return params;
}

/**
 * A block scaler: given the block and a multiplier, scale the sub-fields this key owns.
 *
 * ⚠️ **`SCALERS` IS `Record<ScalerId, Scaler>` AND THAT IS THE POINT (v8 `26.3`, owner-confirmed).** The
 * union plus the exhaustive record makes **"the owner exists" and "the owner is reachable" both compile
 * facts, in both directions** — a scaler named in the table and missing here does not compile, and one
 * written here and named by no key does not either. Copied from `MixLaw.custom`'s shape rather than
 * `MutateLaw.block`'s `owner: string`, which nothing enforces.
 *
 * ⚠️ **WHY THE SUB-FIELD LISTS LIVE HERE AND NOT IN THE ROWS:** a row naming its own fields inline would
 * be the fourth enumeration of the overlay surface, which is exactly what `26.D6` and `P2` exist to
 * prevent. The table names every key once; the scaler owns that key's interior.
 */
type Scaler = (block: Record<string, unknown>, m: number) => void;

/** Scale one numeric sub-field in place, clamped, leaving a field the preset does not author alone. */
function sub(b: Record<string, unknown>, field: string, m: number, lo: number, hi: number): void {
  const v = b[field];
  if (typeof v !== 'number') return;
  b[field] = Math.max(lo, Math.min(hi, v * m));
}

/**
 * ⚠️ **EVERY BOUND BELOW IS THE RANGE OF THE CONTROL THAT ALREADY OWNS THE FIELD, read off its descriptor
 * on 2026-10-06 — not invented here.** `26.D10`'s rule is that a range `min` is cosmetic unless the clamp
 * is shared, so scaling past a control's own range would author a value the user cannot reach by hand.
 */
const SCALERS: Record<ScalerId, Scaler> = {
  // Visual FX: Turbulence [0,1], Noise Scale [0.1,10]. ⚠️ **NEVER `.enabled` (`26.5`)** — a slider may not
  // flip a categorical, which is why this row is live on 7 presets and disabled on 267 (`26.D3`, shipped
  // as specified by owner confirmation 2026-10-06 with its real reach stated).
  scaleCurlNoise: (b, m) => { sub(b, 'turbulence', m, 0, 1); sub(b, 'scale', m, 0.1, 10); },

  // Materials: Heat Gain [0.1,10], Emission [0.5,10]. ⚠️ **NEVER `heatMode` or `blendMode`** — `blendMode`
  // changes what `decayFactor` MEANS, and an additive material caps the trail. ⚠️ **And
  // `material.emissionIntensity` cannot reach a CRYSTAL**, so the row's reason line must not let it
  // over-promise on the 8 crystal presets (`P6`).
  scaleMaterial: (b, m) => { sub(b, 'heatGain', m, 0.1, 10); sub(b, 'emissionIntensity', m, 0.5, 10); },

  // Visual FX: Thickness [0,2]. The liquid half is gated by its CALLER on `renderMode === 'liquid'`,
  // because **there is no `liquid.enabled` field at all** — the mode is the gate, true on 21 of 22 carriers.
  scaleLiquid: (b, m) => { sub(b, 'thickness', m, 0, 2); },

  // Visual FX: Opacity [0,1], Advection [0,2].
  scaleDye: (b, m) => { sub(b, 'opacity', m, 0, 1); sub(b, 'advectionStrength', m, 0, 2); },

  // Visual FX: Budget/Frame [1,40], Pool Size [50,2000]. ⚠️ **Quantised in the STORED unit** (`26.D10`):
  // both are integer counts, and a fractional spark budget is a value no authoring path can produce.
  scaleSparks: (b, m) => {
    const n = b['maxSparksPerFrame'];
    if (typeof n === 'number') b['maxSparksPerFrame'] = Math.round(Math.max(1, Math.min(40, n * m)));
    const pool = b['poolSize'];
    if (typeof pool === 'number') b['poolSize'] = Math.round(Math.max(50, Math.min(2000, pool * m)));
  },

  /**
   * The warp chain's per-layer weights.
   *
   * ⚠️ **THE FLOOR IS STRICTLY ABOVE ZERO AND THAT IS NOT TIDINESS: `isStyleActive()` and
   * `buildChainPlan()`'s `live` filter BOTH DROP A LAYER AT `weight <= 0`**, so a weight scaled to 0 does
   * not make a layer faint — it **removes the layer from the pipeline**, and the Warp row would then be
   * deleting chain structure it has no business touching. The floor keeps the layer alive at its quietest.
   *
   * ⚠️ **`weightless` LAYERS ARE SKIPPED.** `normaliseChain` forces their `weight` to 1, so scaling one is
   * either overwritten or — if it reached 0 from a hand-edited import — makes the layer vanish.
   */
  scaleChainWeights: (b, m) => {
    const layers = b['layers'];
    if (!Array.isArray(layers)) return;
    for (const layer of layers) {
      if (!layer || typeof layer !== 'object') continue;
      const l = layer as Record<string, unknown>;
      if (l['weightless'] === true) continue;
      const w = l['weight'];
      if (typeof w === 'number') l['weight'] = Math.max(0.01, Math.min(1, w * m));
    }
  },
};

/**
 * Apply a multiplier to one overlay key **through the table**, which is the only route a row may take.
 *
 * ⚠️ **A ROW MAY NOT REACH PAST THIS FUNCTION.** `categorical` and `none` are refusals the table owns, and
 * a row that scaled a categorical anyway would flip an `enabled` or pick a `style` — `26.5`'s one absolute
 * prohibition. The refusals are silent here **because the UI is where they are explained** (`26.6`'s
 * disabled state and its reason line), not because they are unimportant.
 */
function scaleRuled(ov: Record<string, unknown>, key: keyof typeof OVERLAY_RULES, m: number): void {
  const law: ScaleLaw = OVERLAY_RULES[key].scale;
  if (law.kind === 'none' || law.kind === 'categorical') return;
  if (law.kind === 'block') {
    const b = ov[key];
    if (b && typeof b === 'object') SCALERS[law.owner](b as Record<string, unknown>, m);
    return;
  }
  const v = ov[key];
  if (typeof v !== 'number') return;
  ov[key] = law.kind === 'mul-clamped' ? Math.max(law.min, Math.min(law.max, v * m)) : v * m;
}

/**
 * Overlay keys the Sliders tab writes, and therefore the only ones it may revert.
 *
 * `Speed` writes `speedFactor`; `Mood`, `Glow` and `Depth` reach grading through `grading()`, which writes
 * the other three. Everything else in `overlay` is live Visual FX state the tab must carry forward
 * untouched — see the merge in `applyAllSliders`.
 *
 * ⚠️ **A NEW `overlay` FIELD A ROW WRITES AND DOES NOT LIST HERE LEAKS, and the leak is invisible to `tsc`
 * and to every checker but one.** The three-tier revert in `applyAllSliders()` — what the BASELINE declares,
 * else `fxBaseline`, else `delete` (because absent must stay absent) — **generalises to any key put in this
 * list**, which is what makes a new row far cheaper than it looks. `slidercheck` (`26.D13`e) holds the list
 * to the rows in BOTH directions, which is the only reason this is enforced at all.
 *
 * ⚠️ **It lives in THIS module, not in `tabs/sliders.ts`, so that a Node-run checker can import it** — the
 * tab reaches the DOM. Moved here 2026-10-06; **do not re-declare it in the tab.**
 */
export const SLIDER_OWNED_OVERLAY_KEYS = [
  'speedFactor',
  'filmLook',
  'customFilmLookParams',
  'sliderBaseFilmLook',
  // ⚠️ **THE EIGHT KEYS v8 `26.5`'s FOUR ROWS WRITE.** They are whole BLOCKS, and that is correct rather
  // than coarse: the revert target for an owned key is what the BASELINE declares, and a row only ever
  // writes into a block the preset already authored (otherwise `26.6` disables the row), so the baseline
  // always declares it and the baseline's whole block is what comes back. ⚠️ **These blocks are also live
  // Visual FX state**, which the existing machinery already handles — an owned key that no longer matches
  // what this tab emitted was changed from outside and BECOMES the new revert target.
  // v8 26.4 — `Warmth`'s rotation. Slider-owned like the rest, so the three-tier revert returns it to
  // the baseline's value, else `fxBaseline`, else DELETES it — and absent must stay absent.
  'paletteHueShift',
  'transMapWarpMix',
  'transMapChain',
  'transMapDispersion',
  'curlNoise',
  'material',
  'liquid',
  'dye',
  'sparks',
] as const satisfies readonly (keyof OverlayState)[];

/**
 * Can this row move anything the user will SEE on this preset — and if not, why not (v8 `26.6`, `26.D4`).
 *
 * ⚠️ **ONE PREDICATE, TWO READERS, AND THAT IS THE WHOLE POINT.** The UI uses it to disable the row and
 * print the reason; `SEMANTIC_SLIDERS`' own `apply` uses it to refuse to write. A second copy of the gate
 * in the rows would let the panel and the engine disagree about what a control does — which is the shape
 * of defect this phase exists to remove, not to reproduce.
 *
 * ⚠️ **IT ANSWERS "WHAT DOES THIS FEATURE READ", NEVER "WHAT DOES THE CALL WRITE" (`P5`).** `Warmth` is the
 * proof: it always writes and is invisible on **253 of 274**, because a palette overrides the colour curves
 * wherever one is set. An inertness measure over written leaves cannot see an output-channel failure —
 * that is invariant 13's harder half, and it is why these predicates are measured rather than inferred.
 *
 * ⚠️ **AND A DISABLED ROW IS THE NORMAL CASE, NOT AN EDGE CASE.** No preset in the library lights all four
 * of `26.5`'s rows (0 → 69 presets, 1 → 128, 2 → 64, 3 → 13, 4 → 0), so **at least one row is disabled on
 * every preset there is.** Build and judge the panel with this on.
 */
export interface RowLiveness {
  live: boolean;
  /**
   * Why the row cannot move anything — or, when `live` is true, WHICH of two laws is in force.
   *
   * ⚠️ **A NON-EMPTY `reason` ON A LIVE ROW IS NOT A CONTRADICTION, AND `Warmth` IS WHY IT EXISTS.** After
   * `26.4` that row has two laws and does something in both cases, so disabling it would be a lie — but the
   * user still needs to know which one they are driving, because the two feel completely different.
   * **The UI disables on `live`, and shows the line whenever `reason` is non-empty.**
   */
  reason: string;
}

/** Which law `Warmth` is driving on this preset. */
export type WarmthLaw = 'rotate' | 'curves' | 'none';

/**
 * v8 `26.4` — the ONE owner of "which `Warmth` law is in force", read by the row AND by `rowLiveness`.
 *
 * ⚠️ **TWO READERS, ONE DECISION, FOR THE SAME REASON THE LIVENESS PREDICATE ITSELF IS SHARED.** If the row
 * and the UI each decided this, a preset could be told one law and driven by the other — and because both
 * laws produce a plausible colour change, nothing would look wrong.
 *
 * ⚠️ **RESOLVED THROUGH THE SHIPPED `resolvePaletteSelection()`, NEVER BY READING `overlay.palette`.** A
 * palette reaches the frame from TWO sources — the overlay override and the active film look's own bundle
 * (114 and 124 presets) — and this function is the one place that order is decided. ⚠️ **And the test is
 * `name === 'none'`, not a truthiness test: `shaderPalette` is the STRING `'none'`, which is truthy**, the
 * gate error `26.0`'s first probe made and reported 0 presets with no palette because of.
 */
export function warmthLaw(preset: UnifiedPreset): { law: WarmthLaw; palette: string } {
  const ov = (preset.overlay ?? {}) as Record<string, unknown>;
  const fp = ov['customFilmLookParams'] as { palette?: string; paletteMapping?: string } | undefined;
  const look = typeof ov['filmLook'] === 'string'
    ? (FILM_LOOKS as Record<string, FilmLookParams | undefined>)[ov['filmLook'] as string]
    : undefined;
  const bundle = fp ?? look;
  const sel = resolvePaletteSelection(
    { palette: ov['palette'] as string | undefined, paletteMapping: ov['paletteMapping'] as never },
    bundle && bundle.palette !== undefined
      ? { palette: bundle.palette as string, paletteMapping: bundle.paletteMapping as never }
      : undefined,
  );
  if (sel.name !== 'none') return { law: 'rotate', palette: sel.name };
  /*
   * ⚠️ **PRECEDENCE IS palette > material ramp > preset colour, so a material ramp with NO palette is the
   * one case where NEITHER law reaches the screen** — 15 presets. The rotation has no palette to rotate and
   * the colour curves are overridden by the ramp, so the row is genuinely dead and must say so.
   */
  const mat = ov['material'];
  if (mat && typeof mat === 'object' && (mat as Record<string, unknown>)['colourRamp'] !== undefined) {
    return { law: 'none', palette: 'none' };
  }
  return { law: 'curves', palette: 'none' };
}

/** Is a block present AND switched on? `undefined` liveness means "present is live" (no gate field). */
function blockLive(b: unknown, gate = true): boolean {
  if (!b || typeof b !== 'object') return false;
  if (!gate) return false;
  const en = (b as Record<string, unknown>)['enabled'];
  return en === undefined ? true : en === true;
}

export function rowLiveness(preset: UnifiedPreset, rowId: string): RowLiveness {
  const ov = (preset.overlay ?? {}) as Record<string, unknown>;
  const live = (): RowLiveness => ({ live: true, reason: '' });
  const dead = (reason: string): RowLiveness => ({ live: false, reason });

  switch (rowId) {
    /*
     * ⚠️ **`Warmth` IS THE ROW THIS WHOLE MECHANISM EXISTS FOR.** Precedence is palette > material ramp >
     * preset colour, so where a palette resolves the four colour curves are invisible: the write happens,
     * the frame holds still, and that reads as a broken control. 238 presets have a palette active and 15
     * of the remaining 36 have a material ramp supplying the colour, leaving **`generators.colorBase` as
     * the visible source on 21 of 274 (7.7 %)**. ⚠️ **Until `26.4` lands, the row's channel is `colorBase`
     * alone**, so this reason is the accurate one; `26.4` re-founds it on palette hue rotation and the
     * reason then narrows to the no-palette case.
     */
    /*
     * ⚠️ **AFTER `26.4` THIS ROW IS LIVE ON 259 OF 274 AND ITS LINE IS INFORMATIONAL RATHER THAN AN
     * APOLOGY.** Before it, the row wrote `colorBase` alone and was invisible on 253 — so the same
     * predicate that used to DISABLE it now names which of its two laws the user is driving. **A row that
     * works must never be shown disabled**, and a row whose behaviour changes shape between presets must
     * say which shape is in force.
     */
    case 'warmth': {
      const { law, palette } = warmthLaw(preset);
      if (law === 'rotate') {
        return { live: true, reason: `rotating the palette “${palette}” — up to half a turn each way` };
      }
      if (law === 'curves') return live();
      return dead('colour comes from the material’s ramp, which overrides both the palette and the curves');
    }

    /*
     * ⚠️ **"NO WARP" MEANS NEITHER CHANNEL, AND THE LEGACY BLOCK IS THE BIGGER HALF.** 52 presets carry an
     * `overlay.transMapChain`; **174 carry the legacy `postProcessors.transMap`, of which 127 have no
     * overlay chain at all** — and the legacy block has no amplitude field, so `transMapWarpMix` is the
     * only scalar that reaches those 127. A predicate that looked only at the chain would disable this row
     * on presets where it works.
     */
    case 'warp': {
      const chain = ov['transMapChain'];
      const hasChain = Array.isArray(chain) && chain.length > 0;
      const legacy = preset.postProcessors?.transMap?.enabled === true;
      const overlayOn = ov['transMapEnabled'] === true;
      if (!hasChain && !legacy && !overlayOn) return dead('no warp on this preset');
      return live();
    }

    // ⚠️ **PRESENT IS NOT ENABLED, AND THIS IS THE ROW WHERE THAT COST A DECISION.** `overlay.curlNoise` is
    // present on 181 and `enabled` on **7**; the row was offered to the owner at 181, which was a block
    // census mistaken for a reach measurement. Shipped as specified with its reach stated (`26.D3`).
    case 'turbulence':
      return blockLive(ov['curlNoise'])
        ? live()
        : dead('curl noise is off on this preset');

    // ⚠️ **`material.emissionIntensity` CANNOT REACH A CRYSTAL** (`P6`), so the reason says what the row
    // does reach rather than letting it over-promise on the 8 crystal presets.
    case 'heat':
      return ov['material'] && typeof ov['material'] === 'object'
        ? live()
        : dead('no material on this preset');

    /*
     * ⚠️ **GATED PER BLOCK, AND THE LIQUID GATE IS THE RENDER MODE BECAUSE THERE IS NO `liquid.enabled`.**
     * Live on 39: liquid 22 carriers of which 21 are in `liquid` mode, dye 5, sparks 23 of which 19 are
     * enabled. A row reaching one of the three is normal.
     */
    case 'substance': {
      const parts = [];
      if (ov['renderMode'] === 'liquid' && ov['liquid']) parts.push('liquid');
      if (blockLive(ov['dye'])) parts.push('dye');
      if (blockLive(ov['sparks'])) parts.push('sparks');
      return parts.length > 0 ? live() : dead('no liquid, dye or sparks on this preset');
    }

    /*
     * ⚠️ **`Symmetry`'S INERTNESS IS REAL AND ITS DEFECT IS DELIBERATELY LEFT ALONE (`26.D8`).** The row
     * writes `phase` additively where the engine reads `(n + phase) * fm`, so the snap lands off-target —
     * and `composercheck` §D **seeds that exact defect to prove the checker can see it**, so fixing it here
     * would silently invalidate another checker's calibration. **The reason line must not claim the row is
     * correct**, and it does not: it reports what the row cannot move.
     */
    case 'symmetry': {
      const axes = preset.generators.waves.flatMap((w) => w.axes);
      const offGrid = axes.some((a) => Math.abs(a.phase % 90) > 0.001);
      return offGrid ? live() : dead('every axis is already on the 90\u00b0 grid');
    }

    /*
     * ⚠️ **"THIS PRESET HAS ONLY ONE WAVE" WAS THE PLAN'S GUESS AND IT IS NOT THE CAUSE — MEASURED
     * 2026-10-06.** `26.6` offered that wording "or the measured cause (81 / 65)", and a wave-count
     * predicate reports these rows live on **all 274**, because every library preset has more than one
     * wave. The real cause is that the row's own CHANNEL is already zero: `Complexity` scales
     * `fm.frequency`/`fm.amplitude` and `Structure` scales `am.amplitude`, and **multiplying zero by
     * anything is zero**, so a preset whose every axis has that field at 0 cannot be moved by the row at
     * any position. **`P5`: the predicate is measured, never asserted from a type or from a plan.**
     */
    case 'complexity': {
      const axes = preset.generators.waves.flatMap((w) => w.axes);
      return axes.some((a) => a.fm.frequency !== 0 || a.fm.amplitude !== 0)
        ? live()
        : dead('this preset\u2019s waves carry no frequency modulation to scale');
    }
    case 'structure': {
      const axes = preset.generators.waves.flatMap((w) => w.axes);
      return axes.some((a) => a.am.amplitude !== 0)
        ? live()
        : dead('this preset\u2019s waves carry no amplitude modulation to scale');
    }

    // ⚠️ **`Depth` IS NEVER DISABLED, AND THAT IS EX10 RATHER THAN AN OVERSIGHT.** It substitutes a
    // `BASE_ROT` fallback for a zero rotation vector, so it moves even a fully static preset — a documented
    // deliberate non-defect, and removing it would make the row do nothing at all on the 6 static presets.
    default:
      return live();
  }
}

export const SEMANTIC_SLIDERS: SliderDef[] = [
  {
    id: 'complexity',
    label: 'Complexity',
    hint: 'Scales frequency modulation on every wave axis, so the curve oscillates faster and knots up. '
      + 'Raise it for an intricate tangle, lower it for a simple open figure. Centre is the preset unchanged.',
    // Scales FM frequency on all wave axes. Higher = faster oscillation = knottier curves.
    apply(preset, value) {
      const m = mul(value);
      for (const wave of preset.generators.waves) {
        for (const axis of wave.axes) {
          axis.fm.frequency *= m;
          axis.fm.amplitude *= m;
        }
      }
    },
  },
  {
    id: 'flow',
    label: 'Flow',
    hint: 'Scales the wave speed and the rate at which the figure breathes in and out. Distinct from Speed: '
      + 'this changes the MOTION written into the preset, where Speed is a playback multiplier.',
    // Scales overall animation speed and AM frequency (breathing rate).
    apply(preset, value) {
      const m = mul(value);
      preset.generators.waveSpeed *= m;
      for (const wave of preset.generators.waves) {
        for (const axis of wave.axes) {
          axis.am.frequency *= m;
        }
      }
    },
  },
  {
    id: 'density',
    label: 'Density',
    hint: 'Scales the particle count, 0.5×–2× of the preset’s own. More particles fill the curve into a '
      + 'continuous surface; fewer leave it as discrete points and cost less per frame. Never below 100.',
    // Scales particle count relative to the preset's own count. 0.5→1× is the identity.
    apply(preset, value) {
      preset.generators.particleCount = Math.max(
        100,
        Math.round(preset.generators.particleCount * mul(value)),
      );
    },
  },
  {
    id: 'warmth',
    label: 'Warmth',
    hint: 'Shifts the figure’s colour. Where a palette is in force it ROTATES that palette’s hue, up to '
      + 'half a turn each way; where no palette is set it multiplies the preset’s own base colour instead. '
      + '⚠️ Because the extremes are a full half-turn, both ends land on the palette’s opposite colour — so '
      + 'the travel is not a straight line from cool to warm, and the middle of each half is where the '
      + 'biggest readable change is.',
    /**
     * v8 `26.4` / `26.D5` — **TWO laws, mutually exclusive, decided by whether a palette resolves.**
     *
     * ⚠️ **THE ROW WROTE `colorBase` ALONE UNTIL 2026-10-06 AND WAS INVISIBLE ON 253 OF 274 PRESETS.** It
     * always wrote, so any "did a value change" measure said it worked — and precedence is
     * **palette > material ramp > preset colour**, so wherever a palette was set the four colour curves
     * were simply not what the frame read. **Ask what a feature READS, not what the call writes**; that is
     * invariant 13's harder half, and this row is its clearest instance in the engine.
     *
     * ⚠️ **THE TWO LAWS MUST NEVER BOTH FIRE.** `rowLiveness()` is the one predicate that decides which is
     * in force, and the generator's cosine branch carries the matching guard, because that branch is *also*
     * the no-palette fallback. Rotating AND scaling on the same drag would move one quality twice.
     *
     * ⚠️ **THE MAPPING IS EXACT: `turns = position − 0.5`.** `sliderMul(v) = 5^(2v−1)`, so
     * `log(m)/log(5) = 2v−1`, and a half-turn range collapses to the position's own distance from centre.
     * **Do not re-derive it through `mul()` and a logarithm** — the arithmetic cancels, and the cancellation
     * is why this is one line. Centre is exactly 0, which `slidercheck`'s byte-identity clause requires.
     *
     * ⚠️ **±180° MEANS THE TRAVEL IS NOT MONOTONIC IN "WARMTH"** (owner, 2026-10-06): both extremes land on
     * the complement. **Nothing may assert monotonicity on this row** the way the checker does for `Glow` —
     * such a clause would fail on correct code. The hint says so in the user's own terms.
     */
    apply(preset, value) {
      // ⚠️ **THE SAME OWNER THE UI READS**, never `rowLiveness().live` — this row is live under BOTH laws,
      // so `live` cannot tell them apart and using it here would silently pick the wrong one.
      if (warmthLaw(preset).law !== 'rotate') {
        // No palette in force: the original law, kept verbatim.
        const warm = mul(value);       // R: 0.5× … 1× … 2×
        const cool = mul(1.0 - value); // B: inverse
        preset.generators.colorBase[0] = Math.min(255, (preset.generators.colorBase[0] ?? 128) * warm);
        preset.generators.colorBase[2] = Math.min(255, (preset.generators.colorBase[2] ?? 128) * cool);
        return;
      }
      // A palette IS in force, so rotate where it is sampled instead of writing curves nothing reads.
      if (!preset.overlay) preset.overlay = {};
      const turns = value - 0.5;
      // ⚠️ **0 IS THE IDENTITY AND ABSENT IS 0, so the identity is DELETED rather than written** — the same
      // discipline `transMapWarpMix` follows. Writing `paletteHueShift: 0` would author a default.
      if (turns !== 0) preset.overlay.paletteHueShift = turns;
      else delete preset.overlay.paletteHueShift;
    },
  },
  {
    id: 'symmetry',
    label: 'Symmetry',
    hint: 'Upper half only: snaps wave phases toward multiples of 90°, more strongly the higher you go. '
      + 'Centre and below leave phases exactly as authored — there is no meaningful opposite of '
      + '"align to 90°", so the lower half is intentionally inert.',
    // Quantizes wave phases toward multiples of 90° (high) or leaves freeform (low, center).
    // Below center = no quantization. Above center = increasing snap strength.
    apply(preset, value) {
      if (value <= 0.5) return; // center and below: leave phases untouched
      const strength = (value - 0.5) * 2.0; // 0→1 in upper half
      const snap = 90; // degrees
      for (const wave of preset.generators.waves) {
        for (const axis of wave.axes) {
          const quantized = Math.round(axis.phase / snap) * snap;
          axis.phase = axis.phase + (quantized - axis.phase) * strength;
        }
      }
    },
  },
  {
    id: 'depth',
    label: 'Depth',
    hint: 'Scales rotation speed and the depth-size effect. Note: on a preset with no rotation of its own '
      + 'this ADDS a slow spin, so the figure starts turning — that is what makes the slider do anything '
      + 'at all on those presets. Return the slider to centre to restore the preset exactly.',
    // Scales rotation speed and depth-size effect relative to the preset's own values.
    // If the preset has zero rotation, adds a small base so the slider still works.
    apply(preset, value, _stats, pass) {
      const m = mul(value);
      const BASE_ROT = 0.05; // fallback when preset rotation is 0
      preset.generators.rotation = preset.generators.rotation.map(
        (r) => (Math.abs(r) < 0.001 ? BASE_ROT : r) * m,
      );
      // Same story as Glow above: `depthSize` is a `FilmLookParams` field and `setFilmLook` overwrites
      // the uniform after `initRenderer` reads the preset, so writing only the preset block was dead.
      // The rotation half of this slider was always live — that goes through the generator.
      const gd = grading(preset, pass);
      gd.depthSize = (gd.depthSize || 0.5) * m;
      preset.renderer.depthSize = (preset.renderer.depthSize || 0.5) * m;
    },
  },
  {
    id: 'structure',
    label: 'Structure',
    hint: 'Scales how strongly the wave amplitudes are modulated. High gives more shape variation along the '
      + 'curve; low flattens it toward a rigid geometric form. Distinct from Complexity, which changes the '
      + 'RATE of oscillation rather than its depth.',
    // Scales AM amplitude: high = stronger modulation (more shape variation),
    // low = flatter, more rigid curves. Center = preset's own AM amplitude.
    apply(preset, value) {
      const m = mul(value);
      for (const wave of preset.generators.waves) {
        for (const axis of wave.axes) {
          axis.am.amplitude *= m;
        }
      }
    },
  },
  {
    id: 'glow',
    label: 'Glow',
    hint: 'Three things at once: particle halo size, trail persistence, and — above about 0.65 — bloom. This '
      + 'is the single control for how luminous and smeared the image is. Below 0.65 the preset keeps whatever '
      + 'named film look it had.',
    // Scales trail decay (persistence) and glow brightness relative to preset values.
    // High = longer trails + more glow + bloom. Low = short trails, tight points.
    apply(preset, value, _stats, pass) {
      const m = mul(value);
      // Particle glow is a `FilmLookParams` field, so it must go through `grading()`.
      //
      // This wrote `preset.renderer.glow` until 2026-08-06. `initRenderer` does read that — but
      // `applyPresetChange` then calls `applyFilmLook`, whose `renderer.setFilmLook({ glow: look.glow })`
      // OVERWRITES the uniform a few lines later. So the slider's main effect was set and immediately
      // discarded on every apply, in every film look. It survived only into `ribbonRenderer.setGlow` and
      // `neonLineRenderer.setGlow` (which run after), which is why Glow appeared to do nothing at all on
      // a star-mode preset with no ribbons or neon — reported on `Aurora Borealis`.
      //
      // `preset.renderer.glow` is still updated so ribbon/neon glow track the slider too.
      const g = grading(preset, pass);
      g.glow = Math.min(10, (g.glow || 1) * m);
      preset.renderer.glow = Math.min(10, (preset.renderer.glow || 1) * m);
      // Scale decay toward longer trails at high values, shorter at low.
      // decayFactor is 0–1 where higher = longer trails.
      const d = preset.renderer.decayFactor;
      if (value > 0.5) {
        // Push toward 1 (longer) proportionally to upper half
        preset.renderer.decayFactor = d + (1.0 - d) * ((value - 0.5) * 2.0) * 0.4;
      } else {
        // Push toward 0 (shorter) proportionally to lower half
        preset.renderer.decayFactor = d * (value * 2.0);
      }
      // Enable bloom only when significantly above center.
      //
      // Routed through `grading()` — i.e. `overlay.customFilmLookParams` — because that is the only
      // channel the renderer reads. This wrote `postProcessors.bloom` until 2026-08-06, which nothing
      // consumes, so Glow's brightness and trail halves worked while its bloom half silently did
      // nothing (defect EX1). Only touched above 0.65: below that the preset keeps whatever named film
      // look it had, rather than being converted to Customize just for passing through the middle.
      /*
       * ⚠️ **THE SECOND `grading()` CALL WAS DELETED HERE (v8 `26.1`, Defect B) AND THE BRANCH NOW WRITES
       * INTO THE `g` THIS ROW ALREADY HOLDS.** The old call rebuilt the object and discarded this row's own
       * halo write a few lines above — so **`Glow` destroyed its own halo over the top 35 % of its travel.**
       * Measured on `Birth Of Venus` (`filmLook: 'Legacy Graded'`, bundle glow 4):
       * `glow@0.60 → customFilmLookParams.glow 5.519` · `@0.64 → 6.277` · `@0.66 → 4` · `@0.80 → 4`.
       *
       * ⚠️ **WHY IT WAS NEVER REPORTED: `renderer.glow` kept rising across the same travel** (2.759 /
       * 3.139 / 3.347 / 5.253), so on a ribbon or neon preset the slider still did something visible and
       * only the film-look halo was dead. The discontinuity sat at 0.65 and nothing in the UI marked it.
       *
       * ⚠️ **Do NOT re-add a `grading()` call here for symmetry with the other three sites.** A deleted
       * duplicate leaves no trace of why, which is what this paragraph is for.
       */
      if (value > 0.65) {
        g.bloomEnabled = true;
        g.bloomIntensity = (value - 0.65) * 2.86; // 0→1 over 0.65→1.0
      }
    },
  },
  {
    id: 'speed',
    label: 'Speed',
    hint: 'Playback tempo, 0.5×–2×. It multiplies the frame time rather than editing the wave data, so the '
      + 'figure keeps its exact shape and only its pace changes — the non-destructive way to slow a preset down.',
    // Sets speedFactor directly: 0→0.5×, 0.5→1× (no change), 1→2×.
    // Applied as a dt multiplier in the render loop — does not modify wave data.
    apply(preset, value) {
      if (!preset.overlay) preset.overlay = {};
      preset.overlay.speedFactor = mul(value);
    },
  },
  {
    id: 'mood',
    label: 'Mood',
    hint: 'Brightness and colour vividness together: left is dim and washed out, right bright and punchy. It '
      + 'switches tone mapping on, since exposure and saturation cannot reach the shader without it.',
    // Brightness on one axis, colour vividness on the other: low = dim and washed out,
    // high = bright and punchy.
    apply(preset, value, _stats, pass) {
      // Centre is a no-op, and deliberately so: `grading()` converts the preset to Customize, which
      // would strip a user's named film look for no visual change. See `grading()`.
      if (value === 0.5) return;

      // Tone mapping must be ENABLED for exposure and saturation to reach the shader — a preset on
      // `Legacy` has `toneMapEnabled: false`, so patching the values alone would still show nothing.
      const m = mul(value);
      const g = grading(preset, pass);
      g.toneMapEnabled = true;
      if (g.toneMapCurve === 'none') g.toneMapCurve = 'aces';

      // `sqrt(m)`, not `m`, because this used to scale exposure AND gamma by the full multiplier.
      // Both brighten, so they compounded to roughly m² — the top of the slider reached ~25×, and
      // any preset whose trails already peak above 1.0 went flat white by ~0.65. Gamma is now left
      // alone and exposure takes the gentler curve (0.45× … 2.24×), so the whole travel stays
      // usable on bright presets. Reported 2026-08-06 on `Aurora Borealis`.
      g.exposure = g.exposure * Math.sqrt(m);
      // The vividness half — documented in this slider's intent since it was written, but never
      // implemented, which is what left Mood a second brightness control. `uSaturation` was already
      // in the tone-map shader and fully wired; nothing set it.
      //
      // Ceiling matches the Customize UI's own Saturation slider (0–2.5) so the two agree. Two
      // consequences worth knowing, both accepted: on an already-vivid bundle the ceiling is reached
      // before the slider ends (`Plasma` at 0.57, `Neon` at 0.68), and on `Monochrome` this half is
      // inert at every value because it multiplies a saturation of zero.
      g.saturation = Math.min(2.5, g.saturation * m);
    },
  },
  /*
   * ───────────────────────────────────────────────────────────────────────────────────────────────
   * v8 `26.5` — the four `Physics` rows that reach the overlay (`26.D3`).
   *
   * ⚠️ **APPENDED, NEVER INTERLEAVED.** The apply ORDER is this array's order and `26.0` measured the
   * library against it; inserting a row in the middle would change what every existing combination does.
   * **`26.D2`'s three sections are a UI grouping (`26.6`), not this array's order.**
   *
   * ⚠️ **EVERY ONE GOES THROUGH `scaleRuled()`, SO THE TABLE REFUSES WHAT MUST BE REFUSED.** None of them
   * may flip a categorical — not `curlNoise.enabled`, not `transMapEnabled`, not `transMapStyle`, not
   * `beforeParticles`, not `heatMode`, not `blendMode`, not `renderMode`.
   * ───────────────────────────────────────────────────────────────────────────────────────────────
   */
  {
    id: 'warp',
    label: 'Warp',
    hint: 'How hard the image-domain warp pushes: the chain mix first, then each layer\u2019s weight, then '
      + 'dispersion where the preset sets it. It never switches the warp on or off \u2014 Chain Mix 0 is not '
      + 'the same as Enable off. Below centre it quietens the warp on any preset that has one; above centre '
      + 'it can only raise what is not already at full strength, which on most presets is nothing.',
    /*
     * ⚠️ **`transMapWarpMix` IS WRITTEN FIRST AND IT IS WHY THIS ROW REACHES 165 PRESETS INSTEAD OF 52.**
     * Only 52 presets carry an `overlay.transMapChain`; 174 carry the LEGACY `postProcessors.transMap`
     * block, of which **127 have no overlay chain at all** — and **the legacy block has no amplitude field**
     * (its census is `enabled`/`style`/`beforeParticles`/`sinMagicParams`/`sinMagicParams2`/`zoomCenter`),
     * so the warp's amplitude lives inside the 4x4 wave table. **`transMapWarpMix` scales the summed offset
     * (`uMix`) and is the only scalar that can reach those 127.** Read as `?? 1`, because a preset that
     * never authored it is at the default rather than at zero.
     */
    apply(preset, value) {
      // ⚠️ **THE SAME PREDICATE THE UI DISABLES ON** — so the panel and the engine cannot disagree about
      // what this control does, and a row can never write a no-op key onto a preset it does not reach.
      if (!rowLiveness(preset, 'warp').live) return;
      const m = mul(value);
      if (!preset.overlay) preset.overlay = {};
      const ov = preset.overlay as unknown as Record<string, unknown>;
      /*
       * ⚠️ **1 IS THE ABSENT VALUE FOR THIS KEY, SO THE ROW MAY NOT MATERIALISE IT — AND A FIRST VERSION
       * DID, ON THE 241 PRESETS THAT NEVER AUTHORED IT.** It wrote `transMapWarpMix: 1` before scaling,
       * which made every reach measurement read **274/274 at both ends** while the arithmetic was clamping
       * straight back to 1 and changing nothing. **A row that authors a default reports as working.**
       *
       * The identity gate is legitimate here rather than invented, and it already exists in the engine: the
       * READ is `ov.transMapWarpMix ?? 1.0` and the EXPORT emits the key only when it is `< 1.0` — so the
       * default equals the gated identity, which is the condition CLAUDE.md puts on an identity gate.
       *
       * ⚠️ **AND IT MEANS THIS CHANNEL ONLY REDUCES.** `uMix` scales the summed offset over `[0, 1]` with 1
       * as the maximum, so the upper half of this row cannot amplify the warp through it — it reaches
       * upward only via the chain weights below their ceiling and via dispersion. **The hint says so**;
       * granting the axis a size it does not have is what invariant 29 forbids.
       */
      const cur = typeof ov['transMapWarpMix'] === 'number' ? ov['transMapWarpMix'] : 1;
      const law = OVERLAY_RULES.transMapWarpMix.scale;
      const lo = law.kind === 'mul-clamped' ? law.min : 0;
      const hi = law.kind === 'mul-clamped' ? law.max : 1;
      const next = Math.max(lo, Math.min(hi, cur * m));
      if (next < hi) ov['transMapWarpMix'] = next;
      else delete ov['transMapWarpMix'];
      // The chain's per-layer weights. `scaleChainWeights` expects the block it is handed to carry
      // `layers`, so the array is wrapped — the chain IS the layer list at this key.
      const chain = ov['transMapChain'];
      if (Array.isArray(chain)) SCALERS.scaleChainWeights({ layers: chain }, m);
      // ⚠️ **Dispersion only WHERE AUTHORED** — `scaleRuled` returns early on a non-number, so this
      // creates nothing on the 251 presets that do not set it.
      scaleRuled(ov, 'transMapDispersion', m);
    },
  },
  {
    id: 'turbulence',
    label: 'Turbulence',
    hint: 'Scales curl-noise turbulence and its spatial scale together, so the figure is stirred harder or '
      + 'left calmer. It cannot switch curl noise on \u2014 on a preset where it is off, this row is disabled '
      + 'and says so.',
    /*
     * ⚠️ **THIS ROW IS LIVE ON 7 PRESETS OF 274, AND THAT FIGURE IS THE REASON IT CARRIES A WARNING RATHER
     * THAN A CAVEAT.** `overlay.curlNoise` is PRESENT on 181 and `enabled` is true on **7**; the row was
     * put to the owner as reaching 181, which was **a block census mistaken for a reach measurement**
     * (`facetcheck` has reported `Curl Noise 7 / 2.6 %` all along). **Shipped as specified, owner-confirmed
     * 2026-10-06 with the real reach stated** — the honest alternative was to ship it and let `26.6`'s
     * disabled state tell the truth on the other 267, which is what it does.
     */
    apply(preset, value) {
      if (!rowLiveness(preset, 'turbulence').live) return;
      const ov = preset.overlay as unknown as Record<string, unknown> | undefined;
      if (!ov) return;
      scaleRuled(ov, 'curlNoise', mul(value));
    },
  },
  {
    id: 'heat',
    label: 'Heat',
    hint: 'Scales the material\u2019s heat gain and emission together \u2014 how hot and how bright the substance '
      + 'reads. It never changes which material is selected, nor its heat or blend MODE.',
    apply(preset, value) {
      if (!rowLiveness(preset, 'heat').live) return;
      const ov = preset.overlay as unknown as Record<string, unknown> | undefined;
      if (!ov) return;
      // Live on 84 presets — every material carrier authors all twelve fields, so the gate is simply
      // "is there a material". ⚠️ **Neither `heatScale` nor `coolFactor` is authored ANYWHERE in the
      // library** (they live in `MATERIAL_PRESETS`' configs), so `heatGain` and `emissionIntensity` are
      // the only authored channels this row can scale.
      scaleRuled(ov, 'material', mul(value));
    },
  },
  {
    id: 'substance',
    label: 'Substance',
    hint: 'How much stuff there is: liquid thickness, dye opacity and drift, and the spark budget. Each half '
      + 'moves only if the preset has it, so on most presets this row reaches one of the three.',
    /*
     * ⚠️ **GATED PER BLOCK, SO A PRESET WITH ONE OF THE THREE GETS A ROW THAT MOVES ONLY THAT ONE.** Live
     * on 39: `overlay.liquid` on 22, `overlay.dye` on 5, `overlay.sparks` on 23 (`enabled` true on 19).
     *
     * ⚠️ **THE LIQUID HALF IS GATED ON `renderMode === 'liquid'`, NOT ON A `liquid.enabled` — THERE IS NO
     * SUCH FIELD.** The mode IS the gate, and it is true on 21 of the 22 carriers; the twenty-second
     * authors a liquid block the engine never reads, which is a preset-level oddity and not this row's to
     * fix.
     */
    apply(preset, value) {
      const ov = preset.overlay as unknown as Record<string, unknown> | undefined;
      if (!ov) return;
      const m = mul(value);
      // ⚠️ **PER-BLOCK, so a preset with one of the three gets a row that moves only that one** — and each
      // half uses the same liveness notion the predicate does, including `sparks.enabled` (true on 19 of
      // the 23 carriers), because writing into a switched-off block is a no-op the user cannot see.
      if (ov['renderMode'] === 'liquid') scaleRuled(ov, 'liquid', m);
      if (blockLive(ov['dye'])) scaleRuled(ov, 'dye', m);
      if (blockLive(ov['sparks'])) scaleRuled(ov, 'sparks', m);
    },
  },
];
