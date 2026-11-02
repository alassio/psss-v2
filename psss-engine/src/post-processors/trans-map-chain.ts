import type {
  BandSplitConfig,
  OverlayState,
  ParallaxConfig,
  RefractionConfig,
  TimeWarpConfig,
  TransMapLayer,
  TransMapStyle,
  ConformalConfig, VortexConfig,
} from '../presets/types.ts';
import { isStaticFieldDefault, STATIC_FIELD_TARGET_FRACTION } from './static-field.ts';

/**
 * The TransMap LAYER CHAIN — the one place "which styles are active" is decided, and the one place the
 * legacy single-style spelling is translated into the chain form.
 *
 * ⚠️ **Read this before touching `getForceModes()` or `main.ts`'s TransMap block.** The whole
 * compatibility story is that `overlay.transMapStyle` remains canonical for a ONE-layer chain, so every
 * consumer must go through `chainFromOverlay()` rather than reading `transMapChain` directly — an export
 * written before this feature has no `transMapChain` key at all, and so does every one of the 177 legacy
 * presets.
 *
 * ## Why the layers collapse into at most three GPU stages
 *
 * Seven of the nine styles are the SAME function. Styles 0-3 warp with `finalUv = mix(vUv, dispUv, uMix)`
 * and styles 5/6 with `finalUv = vUv + offset * uMix`; since `mix(vUv,d,m) === vUv + (d-vUv)*m`, the two
 * agree exactly (verified to 0.00e+0 — see `setMix()` in `trans-map.ts`). So a chain of field layers is
 * a chain of ADDITIONS, and additions fold into one shader:
 *
 * | stage | layers | cost |
 * |---|---|---|
 * | build (CPU, on chain change only) | 0,1,2,3 | one Float32Array fill + one RGBA32F upload |
 * | warp (GPU, 1 pass/frame)          | summed static, 5, 6, 7 (+ 9 as a modifier) | ONE pass regardless of layer count |
 * | echo (GPU, 1 pass/frame)          | 4 | 1 pass + 1 scratch FBO, allocated only if present |
 *
 * **Style 4 is the one genuine outlier**: it lerps a COLOUR (`mix(original, echo, uMix)`), not a
 * coordinate, so it cannot be summed into a displacement — it can only be chained as a second pass.
 * That asymmetry is why a field-only chain is free and an echo chain is not.
 *
 * ⚠️ **Only ONE boundary in the chain array is executable.** The field layers sum, and addition commutes,
 * so reordering them changes nothing at any weights. The echo layer's position relative to the field
 * layers IS real (warp-then-echo blurs the echo's source; echo-then-warp warps the echo). With at most
 * one layer per style there is exactly one echo layer, hence exactly TWO executable arrangements — which
 * is why the UI offers one swap button rather than per-row reordering (a control that did not move the
 * thing it named would be invariant 13).
 */

/**
 * What a style DOES, which is what decides which GPU stage it lands in.
 *
 * - `field` — contributes a summed relative UV offset. Any number of these fold into ONE warp pass.
 * - `colour` — lerps a COLOUR rather than a coordinate, so it cannot be summed and needs its own pass
 *   plus a scratch target. Style 4 is the only one today.
 * - `modifier` — changes how the warp pass COMPOSITES its result, contributing neither an offset nor a
 *   colour blend of its own. ⚠️ **A modifier is inert without an active field layer**, which is a fact the
 *   UI has to surface rather than leave the user to discover (invariant 13).
 */
export type StyleDomain = 'field' | 'colour' | 'modifier';

export interface StyleMeta {
  style: TransMapStyle;
  name: string;
  domain: StyleDomain;
  /**
   * The layer has no meaningful per-layer WEIGHT, so the row must suppress its slider.
   *
   * ⚠️ **And `normaliseChain` forces `weight` to 1 on these**, which is not cosmetic tidying:
   * `isStyleActive()` and `buildChainPlan()`'s `live` filter both drop a layer at `weight <= 0`, so a
   * weightless layer that arrived at weight 0 from a hand-edited import would vanish from the pipeline with
   * **no slider anywhere in the UI able to bring it back**.
   */
  weightless?: true;
  /** Inert unless the chain also has an active `field` layer. Only `modifier` styles set this. */
  requiresField?: true;
  /**
   * The field is SEPARABLE (`wX(x) + wY(y)`) and built on the CPU, so any number of these sum into one
   * displacement texture before the frame is drawn. Styles 0-3.
   *
   * ⚠️ **Exists so `buildChainPlan` stops testing `l.style <= 3`**, which was a fifth implicit enumeration
   * of the vocabulary and one that fails SILENTLY in the wrong direction: a future separable style numbered
   * above 3 would be excluded from `staticStyles`, so it would appear in the UI, be counted `live`, and
   * contribute nothing to the texture. The `<= 3` spelling happens to be right for styles 7 and 9 (neither
   * is separable) — being right is not the same as saying what it means.
   */
  separable?: true;
  /**
   * v8 `30.4` — the style owns its own per-layer BODY in the Visual FX layer row, rather than
   * borrowing the shared Flow/Fluid/IFS panel or having no parameters at all.
   *
   * ⚠️ **IT LIVES HERE SO THE UI NEEDS NO EDIT WHEN A STYLE IS ADDED.** The `ownsBody` test used to
   * be a hand-written list of style numbers, and style 12 shipped unreachable because the list did
   * not name it — the expander was disabled, so its parameters could not be opened while the style
   * still appeared in the add-layer menu. **Declare it beside the name and `styleOwnsBody()` does
   * the rest.**
   */
  ownBody?: boolean;
}

/**
 * **THE style vocabulary — the ONE enumeration.**
 *
 * ⚠️ **This table replaced THREE separate enumerations of the same list** (2026-08-20, Step 14.0): the
 * `TRANS_MAP_STYLE_NAMES` record, `FIELD_STYLES`, and a literal `[0,1,2,3,4,5,6]` inside
 * `visual-fx.ts`'s `refreshAddOptions()` that built the "add layer" menu. **Three enumerations of one list
 * make a missing entry structurally invisible**: a style added to the union and to the names record but not
 * to that literal compiled, loaded from a preset correctly, rendered correctly, and was *unreachable from
 * the UI*. `tsc` saw all three as consistent because it never compares them.
 *
 * ⚠️ **`TransMapStyle` is DELIBERATELY WIDER than this table** — the type spans 0-11 because the numbering is
 * persisted in every export and must never be reused, while a style appears here only once it is
 * *implemented*. **As of 2026-08-27 the table is FULL: all twelve numbers are built** (Phase 14's remaining
 * four steps landed together), so the "absent style" mechanism now has no live instance. It stays load-bearing
 * anyway: `normaliseChain()` DROPS an unknown style from an import rather than admitting an inert layer, which
 * is what a future style 12 arriving from a newer export must hit. A dropped layer is visible in the UI; a
 * present-but-inert one reads as a rendering bug. **Adding one is a single-line edit here plus its shader term.**
 *
 * ⚠️ **Styles 8 and 11 are `modifier`s, NOT the `colour` and `field` domains their specs assumed, and that
 * choice is what kept the ordering machinery sound.** The plan had style 8 (Time Warp) as a second `colour`
 * style, which would have invalidated `echoRunsFirst()` and `needsScratch` together: two colour passes turn
 * the chain's two executable arrangements into six and need two intermediates, a derivation the spec
 * explicitly owed before the style could be added. Expressing the temporal blend as a **modifier inside the
 * warp pass** — it lerps that pass's own output against a history texture, exactly as Band Split lerps
 * against a blurred one — discharges that debt instead of paying it: `COLOUR_STYLES` still has exactly one
 * member, `echoRunsFirst()`'s one-colour-layer assumption still holds, and no second scratch target exists.
 * The cost is that Time Warp cannot be sequenced *between* two colour passes, which the chain has no way to
 * express anyway. **Do not "promote" either style to a richer domain without redoing that derivation.**
 */
export const TRANS_MAP_STYLES: readonly StyleMeta[] = [
  { style: 0,  name: 'Wave Shift',        domain: 'field', separable: true },
  { style: 1,  name: 'Wave Zoom',         domain: 'field', separable: true },
  { style: 2,  name: 'Zoom Overlay',      domain: 'field', separable: true },
  { style: 3,  name: 'Zoom Combined',     domain: 'field', separable: true },
  { style: 4,  name: 'Fractal Feedback',  domain: 'colour' },
  { style: 5,  name: 'Procedural Flow',   domain: 'field' },
  { style: 6,  name: 'Fluid Feedback',    domain: 'field' },
  { style: 7,  name: 'Density Refraction', domain: 'field', ownBody: true },
  { style: 8,  name: 'Time Warp',         domain: 'modifier', weightless: true, requiresField: true },
  { style: 9,  name: 'Band Split',        domain: 'modifier', weightless: true, requiresField: true },
  { style: 10, name: 'Vortex',            domain: 'field', ownBody: true },
  { style: 11, name: 'Depth Parallax',    domain: 'modifier', weightless: true, requiresField: true },
  // v8 30.4 (E125). A FIELD, like the vortex: it produces an offset of its own from an analytic term
  // rather than from the displacement texture, so a chain of nothing but a conformal layer is a
  // working warp and it counts toward `needsWarp`.
  { style: 12, name: 'Conformal',         domain: 'field', ownBody: true },
];

/**
 * Style number → metadata. ⚠️ **COUNT `TRANS_MAP_STYLES`, never this comment.** It read *“Nine
 * entries”* over a twelve-style table until `30.4` made it thirteen — a figure in a comment beside
 * the thing it counts, which is the one place a count has no reason to be. The `Map` is for clarity
 * rather than for speed at any size.
 */
const STYLE_META = new Map<number, StyleMeta>(TRANS_MAP_STYLES.map(m => [m.style, m]));

/** Metadata for `style`, or `undefined` for a number outside the IMPLEMENTED vocabulary. */
/**
 * v8 `30.4` — **does this style own its own per-layer body?**
 *
 * ⚠️ **DERIVED FROM `TRANS_MAP_STYLES`, AND THAT IS THE WHOLE POINT OF ADDING IT (2026-10-22).** The UI's
 * `ownsBody` test was a hand-written list of style NUMBERS, and `fieldcheck` already asserted that its
 * weightless half must be a derivation rather than a list — *a hand-listed `8 || 9 || 11` here would be the
 * identical defect one style later*. **Style 12 then shipped as exactly that defect: the literal list did
 * not name it, so its expander was disabled and every conformal parameter was unreachable while the style
 * still appeared in the add-layer menu.** The owner found it in use.
 *
 * So the set moves into the ONE style enumeration, where a new style declares `ownBody: true` beside its
 * name and the UI needs no edit at all. **The next style with its own parameters cannot repeat this.**
 */
export function styleOwnsBody(style: number): boolean {
  return STYLE_META.get(style)?.ownBody === true;
}

export function styleMeta(style: number): StyleMeta | undefined {
  return STYLE_META.get(style);
}

/** Every implemented style, ascending — the source of the add-layer menu. */
export const ALL_STYLES: readonly TransMapStyle[] = TRANS_MAP_STYLES.map(m => m.style);

/** Styles that contribute a summed DISPLACEMENT FIELD. Derived, never written out by hand. */
export const FIELD_STYLES: readonly TransMapStyle[] =
  TRANS_MAP_STYLES.filter(m => m.domain === 'field').map(m => m.style);

/**
 * Styles whose pass is a COLOUR composite rather than a displacement.
 *
 * ⚠️ **A list, not the lone `ECHO_STYLE = 4` constant it replaced** — kept as a list because the shape of the
 * question ("which styles composite a colour rather than a coordinate") is plural even though the answer is
 * currently singular.
 *
 * ⚠️ **It STILL has exactly one member after Step 14.3 shipped, and that is the point.** Style 8 (Time Warp)
 * blends a colour, so the spec expected it here — which would have invalidated `echoRunsFirst()` and
 * `needsScratch`. It is a `modifier` instead, blending inside the warp pass, so the one-colour-layer
 * assumption every consumer relies on is intact. See the `TRANS_MAP_STYLES` header for that derivation.
 * **A genuine second colour style still owes the six-arrangement / two-intermediate work in `echoRunsFirst()`.**
 */
export const COLOUR_STYLES: readonly TransMapStyle[] =
  TRANS_MAP_STYLES.filter(m => m.domain === 'colour').map(m => m.style);

/**
 * The style whose pass is a colour composite — retained as a named constant because it is the ONE colour
 * style and reads better than `COLOUR_STYLES[0]!` at its call sites.
 */
export const ECHO_STYLE = 4;

export const TRANS_MAP_STYLE_NAMES: Record<number, string> = Object.fromEntries(
  TRANS_MAP_STYLES.map(m => [m.style, m.name]),
);

export function isFieldStyle(style: number): boolean {
  return styleMeta(style)?.domain === 'field';
}

/** True when the layer's weight slider must be suppressed rather than shipped inert (invariant 13). */
export function isWeightless(style: number): boolean {
  return styleMeta(style)?.weightless === true;
}

/**
 * True for the CPU-built separable styles (0-3) — the ones whose settings are a `StaticFieldConfig`.
 *
 * ⚠️ **Replaces `style <= 3` at the UI's layer-row site too.** That spelling meant two different things in
 * two files ("summed into the displacement texture" in the plan builder, "has a static-field sub-panel"
 * here); they coincide today, and naming the predicate is what keeps them from silently diverging.
 */
export function isSeparableStyle(style: number): boolean {
  return styleMeta(style)?.separable === true;
}

/**
 * A `modifier` layer that does nothing because the chain has no active field layer to modify.
 *
 * ⚠️ **Not a defect to fix — a state to LABEL.** Band Split recomposes the warp's output, so with no warp
 * its two sliders provably change nothing (`finalUv === vUv`, hence the warped and unwarped residuals are
 * the same pixels). Silently doing nothing is invariant 13; the layer row therefore says so, following the
 * precedent the Age/Temperature force gate sets for "needs a material".
 */
export function isInertModifier(chain: readonly TransMapLayer[], style: number): boolean {
  if (styleMeta(style)?.requiresField !== true) return false;
  return !chain.some(l => l.enabled && l.weight > 0 && isFieldStyle(l.style));
}

/** A layer as authored, with every optional filled in. `weight` is clamped, `style` trusted. */
export function makeLayer(style: TransMapStyle, weight = 1.0): TransMapLayer {
  return { style, enabled: true, weight: isWeightless(style) ? 1.0 : weight };
}

/**
 * Enforce the chain invariants: at most one layer per style, styles in range, weights in 0..1.
 *
 * ⚠️ **De-duplicates by keeping the FIRST occurrence**, so a hand-edited import with two style-5 entries
 * degrades to its first rather than throwing. Returns a fresh array of fresh objects — callers mutate
 * layer rows in place from the UI, so sharing would let a snapshot keep changing after it was taken
 * (the same hazard as `cloneIfsParams`, invariant I12).
 *
 * ⚠️ **The range test is a TABLE LOOKUP, not `style > 6`.** It was the literal comparison until Step 14.0,
 * and that spelling is the fourth enumeration of the vocabulary: it would silently admit a style 8 that
 * `TRANS_MAP_STYLES` does not implement, producing a layer row with a name of `Style 8`, no shader term and
 * no offset — an inert layer, which reads as a rendering bug. Dropping it is visible and therefore better.
 */
export function normaliseChain(raw: readonly TransMapLayer[] | undefined): TransMapLayer[] {
  if (!raw || raw.length === 0) return [];
  const seen = new Set<number>();
  const out: TransMapLayer[] = [];
  for (const l of raw) {
    if (!l || typeof l.style !== 'number') continue;
    const style = Math.round(l.style);
    const meta = styleMeta(style);
    if (!meta) continue;
    if (seen.has(style)) continue;
    seen.add(style);
    const layer: TransMapLayer = {
      style: meta.style,
      // An import may omit `enabled`; absent means ON, matching `?? default` elsewhere.
      enabled: l.enabled !== false,
      // ⚠️ A weightless style is pinned to 1: no slider exists to recover it from a 0 in an import, and
      // `buildChainPlan()` drops a weight-0 layer, so the layer would be permanently invisible.
      weight: meta.weightless ? 1.0 : Math.max(0, Math.min(1, l.weight ?? 1.0)),
    };
    if (l.zoomCenter) layer.zoomCenter = { x: l.zoomCenter.x, y: l.zoomCenter.y };
    // ⚠️ **An ALL-DEFAULT `staticField` is dropped, not copied**, and this is the second half of
    // `isLegacyExpressible`'s gate rather than a duplicate of it. That one keeps a single-layer chain out of
    // the export entirely; this one keeps the block out of a chain that IS exported — a three-layer chain
    // would otherwise carry seven runtime-default keys per static layer, and an export is mostly
    // runtime-default noise already. The UI writes a full block on the first slider touch even when every
    // value still equals its default, so without this the noise arrives from ordinary use, not from
    // hand-editing. Behaviour-neutral: `staticFieldOf()` fills every default on read, so the UI reads back
    // exactly what it wrote.
    if (l.staticField && !isStaticFieldDefault(l.staticField)) layer.staticField = { ...l.staticField };
    if (l.ifsParams) layer.ifsParams = l.ifsParams.map(t => ({ ...t }));
    if (l.proceduralFlow) layer.proceduralFlow = { ...l.proceduralFlow };
    if (l.fluidFeedback) layer.fluidFeedback = { ...l.fluidFeedback };
    if (l.refraction) layer.refraction = { ...l.refraction };
    if (l.timeWarp) layer.timeWarp = { ...l.timeWarp };
    if (l.bandSplit) layer.bandSplit = { ...l.bandSplit };
    // ⚠️ `centre` is a nested object, so it needs its own copy — spreading `l.vortex` would SHARE it, and the
    // UI mutates the eye position in place from a drag. The same trap `zoomCenter` above avoids.
    if (l.vortex) layer.vortex = { ...l.vortex, ...(l.vortex.centre ? { centre: { ...l.vortex.centre } } : {}) };
    // v8 30.4 — `centre` AND `mobius` are both nested, so both need their own copy: spreading
    // `l.conformal` would SHARE them, and a snapshot would then change under the UI's row edits.
    if (l.conformal) layer.conformal = {
      ...l.conformal,
      ...(l.conformal.centre ? { centre: { ...l.conformal.centre } } : {}),
      ...(l.conformal.mobius ? { mobius: { ...l.conformal.mobius } } : {}),
    };
    if (l.parallax) layer.parallax = { ...l.parallax };
    out.push(layer);
  }
  return out;
}

export function cloneChain(chain: readonly TransMapLayer[]): TransMapLayer[] {
  return normaliseChain(chain);
}

/**
 * Style 7 defaults. **`strength` is a fraction of the same 8 %-of-`min(w,h)` target the static family uses**
 * (`STATIC_FIELD_TARGET_FRACTION`), so 0.35 means the same visible amount as 0.35 on a Wave Shift layer.
 *
 * `reach` is in TEXELS of the full-resolution frame — a screen-space unit, hence scaled in a preview tile.
 */
export const REFRACTION_DEFAULTS: Required<RefractionConfig> = {
  strength: 0.35,
  reach: 1.0,
  invert: false,
  source: 'density',
};

/** Style 9 defaults. **`amount: 0` is exactly today's behaviour**, so adding the layer changes nothing yet. */
export const BAND_SPLIT_DEFAULTS: Required<BandSplitConfig> = {
  amount: 0.0,
  radius: 4.0,
};

/**
 * A layer's refraction settings with every optional filled in — the read side of invariant 14.
 *
 * Mirrors `staticFieldOf()` deliberately: the UI reads back exactly what a partial block plus defaults
 * resolves to, so an export written before style 7 existed inherits DEFAULTS rather than live values.
 */
export function refractionOf(layer: TransMapLayer | undefined): Required<RefractionConfig> {
  const r = layer?.refraction;
  return {
    strength: r?.strength ?? REFRACTION_DEFAULTS.strength,
    reach: r?.reach ?? REFRACTION_DEFAULTS.reach,
    invert: r?.invert ?? REFRACTION_DEFAULTS.invert,
    source: r?.source ?? REFRACTION_DEFAULTS.source,
  };
}

/** A layer's band-split settings with every optional filled in. See `refractionOf`. */
export function bandSplitOf(layer: TransMapLayer | undefined): Required<BandSplitConfig> {
  const b = layer?.bandSplit;
  return {
    amount: b?.amount ?? BAND_SPLIT_DEFAULTS.amount,
    radius: b?.radius ?? BAND_SPLIT_DEFAULTS.radius,
  };
}

/**
 * Style 8 defaults. **`amount: 0` is byte-identical to no layer**, so adding the row changes nothing yet.
 *
 * `source: 'field'` drives the temporal lag from the summed chain offset — the reading that makes the effect
 * *differentiate within one frame*, since the field varies per pixel. `'density'` drives it from the trail's
 * own alpha instead, which smears the dense core and leaves sparse arcs sharp: the inverse of global blur.
 */
/**
 * v8 `30.4` — the conformal defaults. ⚠️ **`map: 'power'` at `power: 2` is the gentlest member and the one
 * whose effect is most legible on first use**; `inverse` and `logPolar` both restructure the whole frame,
 * which is a poor first impression of a control the user has just added.
 */
export const CONFORMAL_DEFAULTS: Required<Omit<ConformalConfig, 'centre'>> = {
  map: 'power',
  power: 2,
  /*
   * ⚠️ **`cRe: 0.4` RATHER THAN 0, AND THE ZERO WAS A DEFECT (owner report, 2026-10-22).** With all four
   * parameters at their algebraic identity the map is `(1·z + 0) / (0·z + 1)` = `z` **exactly**, so
   * selecting Mobius did nothing at all until a slider moved — and `a`, the first slider, only scales, so
   * small moves barely show. **A control whose default is its own identity reads as broken on first use**
   * (invariant 13). `c` is the parameter that bends the far field inward, i.e. the lens this member exists
   * for, so a modest `c` is the smallest default that shows what the map does.
   */
  mobius: { aRe: 1, aIm: 0, bRe: 0, bIm: 0, cRe: 0.4, cIm: 0 },
};

export const TIME_WARP_DEFAULTS: Required<TimeWarpConfig> = {
  amount: 0.0,
  source: 'field',
  axis: 'x',
  bias: 0,
};

/**
 * Style 10 defaults. **`swirl: 0.5` is deliberately NON-ZERO, unlike the two modifiers above.**
 *
 * A modifier at 0 is bit-identical to absent, so a zero default costs nothing and protects the 145 warp
 * presets from a visible change. Vortex is a FIELD: at swirl 0 the layer contributes no offset, and since
 * adding it is an explicit act (the add-layer menu), a zero default would ship a control whose only honest
 * description is "does nothing until you move it" — the shape invariant 13 warns about. 0.5 is half the
 * 8 %-of-`min(w,h)` target, i.e. plainly visible without dominating a chain it was added to.
 */
export const VORTEX_DEFAULTS: Required<Omit<VortexConfig, 'centre'>> & { centre: { x: number; y: number } } = {
  swirl: 0.5,
  radius: 0.4,
  centre: { x: 0.5, y: 0.5 },
  falloff: 'gaussian',
};

/** Style 11 defaults. **`amount: 0` is byte-identical to today**; near/far are the spec's measured pair. */
export const PARALLAX_DEFAULTS: Required<ParallaxConfig> = {
  amount: 0.0,
  nearScale: 1.5,
  farScale: 0.4,
  curve: 'linear',
  /**
   * ⚠️ **`'figure'` is the default even though `'canvas'` is the historical behaviour, and that was safe because
   * 0 of the then-364 shipped presets used style 11.** ⚠️ **That is no longer true: `Sphere II` (2026-08-28)
   * ships an ENABLED style-11 layer, so it is now 1 of 359** — and it is unaffected only because it authors
   * `depthRange: 'manual'` explicitly, which bypasses this default rather than agreeing with it. A future
   * style-11 preset that omits the field WOULD be steered by this line; re-measure before changing it.
   * Measured on the 93 legacy presets with a narrow-but-fittable band, at `Near 0.5/Far 2.0`: median near:far
   * ratio **1.30× on `'canvas'` against 4.00× on `'figure'`**, where a full-range figure gives 4.00×. Defaulting
   * to the historical value would have made the feature look broken on two thirds of the library.
   */
  depthRange: 'figure',
  /** Only read when `depthRange === 'manual'`. The full raw scale, so switching to Manual changes nothing until dragged. */
  rangeFrom: 0,
  rangeTo: 1,
};

/** A layer's time-warp settings with every optional filled in. See `refractionOf`. */
export function timeWarpOf(layer: TransMapLayer | undefined): Required<TimeWarpConfig> {
  const t = layer?.timeWarp;
  return {
    amount: t?.amount ?? TIME_WARP_DEFAULTS.amount,
    source: t?.source ?? TIME_WARP_DEFAULTS.source,
    axis: t?.axis ?? TIME_WARP_DEFAULTS.axis,
    bias: Math.max(-1, Math.min(1, t?.bias ?? TIME_WARP_DEFAULTS.bias)),
  };
}

/**
 * A layer's vortex settings with every optional filled in. See `refractionOf`.
 *
 * ⚠️ **`centre` falls back to the layer's own `zoomCenter` before the default**, in that order. Styles 1-3
 * already express "the point this layer operates about" as `zoomCenter`, and a vortex eye is the same idea —
 * so a user who sets a chain's zoom centre and then adds a vortex gets the eye they were already looking at,
 * rather than one silently at the middle. ⚠️ `zoomCenter` is in PERCENT (0-100, the legacy preset unit) while
 * `centre` is normalised UV: the conversion is here, once, because two readers dividing by 100 in different
 * places is exactly the units drift invariant 10 is about.
 */
/**
 * v8 `30.4` — a layer's conformal settings with every optional filled in.
 *
 * ⚠️ **`centre` falls back to the layer's own `zoomCenter` before the default, in that order** (`30.D13`) —
 * the vortex eye's precedence verbatim, so the two styles cannot disagree about what "the point this layer
 * operates about" means.
 *
 * ⚠️ **`power` is ROUNDED and clamped here, because the integer constraint is a CORRECTNESS property**
 * (`30.D16`): a fractional exponent introduces a branch cut, i.e. a discontinuity in a warp whose whole
 * selling point is that it is smooth. A hand-edited import reaches this function without passing the
 * stepped slider.
 */
export function conformalOf(layer: TransMapLayer | undefined): Required<Omit<ConformalConfig, 'centre'>> & {
  centre: { x: number; y: number };
} {
  const c = layer?.conformal;
  const n = c?.power ?? CONFORMAL_DEFAULTS.power;
  return {
    map: c?.map ?? CONFORMAL_DEFAULTS.map,
    power: Math.max(2, Math.min(8, Math.round(Number.isFinite(n) ? n : 2))),
    mobius: { ...CONFORMAL_DEFAULTS.mobius, ...(c?.mobius ?? {}) },
    centre: c?.centre ?? layer?.zoomCenter ?? { x: 0.5, y: 0.5 },
  };
}

export function vortexOf(layer: TransMapLayer | undefined): Required<Omit<VortexConfig, 'centre'>> & {
  centre: { x: number; y: number };
} {
  const v = layer?.vortex;
  const zc = layer?.zoomCenter;
  const centre = v?.centre
    ?? (zc ? { x: zc.x / 100, y: zc.y / 100 } : VORTEX_DEFAULTS.centre);
  return {
    swirl: v?.swirl ?? VORTEX_DEFAULTS.swirl,
    radius: v?.radius ?? VORTEX_DEFAULTS.radius,
    centre: { x: centre.x, y: centre.y },
    falloff: v?.falloff ?? VORTEX_DEFAULTS.falloff,
  };
}

/** A layer's parallax settings with every optional filled in. See `refractionOf`. */
export function parallaxOf(layer: TransMapLayer | undefined): Required<ParallaxConfig> {
  const p = layer?.parallax;
  return {
    amount: p?.amount ?? PARALLAX_DEFAULTS.amount,
    nearScale: p?.nearScale ?? PARALLAX_DEFAULTS.nearScale,
    farScale: p?.farScale ?? PARALLAX_DEFAULTS.farScale,
    curve: p?.curve ?? PARALLAX_DEFAULTS.curve,
    depthRange: p?.depthRange ?? PARALLAX_DEFAULTS.depthRange,
    rangeFrom: p?.rangeFrom ?? PARALLAX_DEFAULTS.rangeFrom,
    rangeTo: p?.rangeTo ?? PARALLAX_DEFAULTS.rangeTo,
  };
}

/**
 * Resolve a style-11 layer's `depthRange` mode into the ONE `[lo, hi]` pair the shader consumes, in TEXTURE
 * units (0 = far, 1 = near).
 *
 * ⚠️ **This is the ONLY reader of the three modes, and the shader has no mode branch at all** — a fourth mode
 * would be added here and nowhere else. That is deliberate: a mode int in the GLSL would put the same three-way
 * decision in two places, which is invariant 17's shape (two sources, two readers, resolved in different orders).
 *
 * ⚠️ **`'canvas'` must return exactly `[0, 1]`, so the consumer's `(t − lo)·(1/(hi − lo))` is arithmetically the
 * IDENTITY.** That is what keeps the pre-14.7b behaviour reachable exactly rather than approximately, and it is
 * why `depthRange` is a categorical field rather than a slider position — no slider value can be relied on to
 * land on the identity.
 *
 * ⚠️ **Sorted for `'manual'`, not validated.** `From` above `To` is a reasonable thing for a user to drag to and
 * it means the same band; rejecting it, or letting the span go negative (which INVERTS near and far — invariant
 * 24's silent failure, since nothing downstream can tell an intended inversion from a dragged one), would both
 * be worse than accepting the obvious intent.
 *
 * @param figure the band `DepthFieldPass.getBand()` measured this frame, used only by `'figure'`.
 */
export function parallaxBandOf(
  p: Required<ParallaxConfig>,
  figureLo: number,
  figureHi: number,
): [number, number] {
  if (p.depthRange === 'canvas') return [0, 1];
  if (p.depthRange === 'manual') {
    return [Math.min(p.rangeFrom, p.rangeTo), Math.max(p.rangeFrom, p.rangeTo)];
  }
  return [figureLo, figureHi];
}

/**
 * The analytic gain that makes `swirl` mean the same thing as a static layer's `strength`.
 *
 * ⚠️ **Style 10 cannot use `solveGain()` and this is its replacement, not an omission.** That function scans a
 * built displacement texture for its peak; a vortex has no texture. The closed form has an exact peak instead,
 * so no scan is needed — but **which peak depends on the FIELD FORM, and the two candidate forms are not
 * interchangeable.**
 *
 * The obvious form is a unit tangent times the falloff, `t̂ · f(r)`, whose magnitude peaks at the eye with
 * value 1 for both falloffs — making the gain a constant independent of `radius`. **It is also singular
 * there**: `t̂` has magnitude 1 at every `r > 0` but its DIRECTION flips across the centre, so every pixel
 * around the eye is displaced by the full amount in a direction that reverses over one texel. That reads as a
 * hard pinch point, not as rotation. The form used is therefore the rigid-rotation one:
 *
 *     displacement(r) ∝ d⊥ · f(r)          magnitude r·f(r), zero at the eye, smooth everywhere
 *     gaussian:  f(r) = exp(−r²/R²)   →   r·f peaks at r = R/√2, value R·e^(−1/2)/√2 = 0.428882·R
 *     inverse:   f(r) = 1/(1 + r²/R²) →   r·f peaks at r = R,     value R/2
 *
 * ⚠️ **So the spec's `r = R/√2` was RIGHT, and my first reading of it as a units error was wrong** — it is the
 * peak of the *displacement* under the non-singular form, not of a torque. The peak scales with `radius`, which
 * is why this takes `radius` and `falloff` rather than `swirl` alone: a fixed constant would have made a small
 * eye ~2.3× weaker than a large one at the same `swirl`, i.e. a control whose meaning drifts with a control
 * beside it.
 *
 * `radius` is floored at 0.01 because it DIVIDES here — a hand-edited import with `radius: 0` would otherwise
 * produce an infinite gain, and `Inf * 0.0 == NaN` inside the trail feedback loop is invariant 20's shape.
 *
 * Returns PIXELS, matching `uRefractGain`; the shader's divide by `min(w,h)` converts to normalised units, so
 * the same `swirl` is the same visible fraction of the frame at 600p, 1080p and in a 256×192 tile.
 */
export function vortexGain(
  swirl: number,
  radius: number,
  falloff: 'gaussian' | 'inverse',
  minDim: number,
): number {
  const r = Math.max(0.01, radius);
  const peak = falloff === 'inverse' ? r * 0.5 : r * 0.4288819424;
  return (swirl * STATIC_FIELD_TARGET_FRACTION * minDim) / peak;
}

/**
 * The vortex displacement at a pixel, in **UV** — the CPU twin of the shader's `vortexOffset()`.
 *
 * ⚠️ **This exists because a style that warps the image but exerts no force is silently HALF-working.** Every
 * other field style feeds the particle force path: styles 0-3 through `staticOffsetAt()`, style 5 through the
 * flow readback, style 4 through `applyIfsForces`. Vortex has no texture at all, so it had no route into
 * `TransMapForceField` — which reads as "Force Blend does nothing on this preset", i.e. invariant 13's shape
 * on a control that demonstrably moves the picture.
 *
 * ⚠️ **The formula is the SHADER's, transcribed — the third copy of one derivation** (`vortexGain` solves the
 * gain, `vortexOffset()` in the warp GLSL draws it, this pushes particles with it). All three are the
 * rigid-rotation form `d⊥ · f(r)`; changing one without the others makes particles drift against the image
 * they are supposed to be embedded in, which looks like a *rendering* fault. `fieldcheck` §L holds the parity
 * assertion, in the same spirit as §A-C for styles 0-3.
 *
 * ⚠️ **Units, at the RESULT rather than the expression (invariant 10).** `d` is dimensionless (a fraction of
 * `min(w,h)`), `gain` is PIXELS, so `d · f · gain` is pixels and the divide by `w`/`h` per axis yields UV —
 * which is what `sampleForce` expects, since it multiplies the pair back by width/height. A divide by `minDim`
 * instead would be "a fraction of `minDim`", 1.78× wrong on x at 16:9.
 *
 * ⚠️ **`gain` is passed in rather than recomputed.** The caller already has it (it uploads the same number as
 * `uVortexGain`), and `vortexGain()` depends on `minDim`, which only the caller knows — recomputing here would
 * be a second resolution of the same value, i.e. the drift `DEFAULT_LINE_WIDTH` is the standing example of.
 *
 * @param out a 2-element scratch buffer owned by the caller; invariant 8 — this runs once per particle
 *   per frame, so a returned tuple would be garbage at the rate `staticOffsetAt`'s header measures.
 */
export function vortexOffsetAt(
  x: number,
  y: number,
  centreX: number,
  centreY: number,
  radius: number,
  inverse: boolean,
  gain: number,
  w: number,
  h: number,
  out: Float64Array,
): void {
  const minDim = Math.max(Math.min(w, h), 1);
  // Pixels relative to the eye, normalised by min(w,h) — the same step that makes the eye ROUND on a 16:9
  // canvas in the shader. `centreX/Y` are normalised UV, so the eye in pixels is `centre * resolution`.
  const dx = (x - centreX * w) / minDim;
  const dy = (y - centreY * h) / minDim;
  const r2 = dx * dx + dy * dy;
  const R2 = Math.max(radius * radius, 1e-6);
  const f = inverse ? 1 / (1 + r2 / R2) : Math.exp(-r2 / R2);
  out[0] = (-dy * f * gain) / w;
  out[1] = (dx * f * gain) / h;
}

/**
 * The chain a preset/overlay describes — **the only sanctioned way to ask "which styles are active".**
 *
 * Falls back to the legacy scalars when `transMapChain` is absent, which is the case for all 177 legacy
 * presets, the 7 engine presets with a live style, and every export written before this feature. The
 * per-style blocks are carried into the single layer so a style-5 preset keeps its `proceduralFlow`
 * tuning and a style-4 preset its `ifsParams`.
 *
 * @param fallbackStyle the preset's own `postProcessors.transMap.style`, used when the overlay omits one.
 */
export function chainFromOverlay(
  overlay: OverlayState | undefined,
  fallbackStyle: TransMapStyle = 0,
  fallbackIfsParams?: TransMapLayer['ifsParams'],
): TransMapLayer[] {
  if (overlay?.transMapChain && overlay.transMapChain.length > 0) {
    return normaliseChain(overlay.transMapChain);
  }
  // ⚠️ An unimplemented or out-of-range scalar falls back to style 0 rather than producing a layer with no
  // shader term — the same reasoning as `normaliseChain`'s table lookup. A legacy file cannot reach here with
  // one (`MigrationLayer` clamps to 4), but a hand-edited overlay can.
  const raw = overlay?.transMapStyle ?? fallbackStyle;
  const style: TransMapStyle = styleMeta(raw)?.style ?? 0;
  const layer = makeLayer(style, 1.0);
  const ifs = overlay?.ifsParams ?? fallbackIfsParams;
  if (style === ECHO_STYLE && ifs) layer.ifsParams = ifs.map(t => ({ ...t }));
  if (style === 5 && overlay?.proceduralFlow) layer.proceduralFlow = { ...overlay.proceduralFlow };
  if (style === 6 && overlay?.fluidFeedback) layer.fluidFeedback = { ...overlay.fluidFeedback };
  return [layer];
}

/**
 * `true` when the chain says exactly what the legacy scalars can say on their own.
 *
 * ⚠️ **This is the export gate, and it is why a single-layer session still writes byte-identical JSON.**
 * `getSnapshot()` emits `transMapChain` only when this is false. A one-layer chain at full weight is
 * indistinguishable from `transMapStyle: n`, so writing the array would put a new key into every export
 * for no behavioural gain — and an export is mostly runtime-default noise already.
 *
 * A single layer with weight < 1 is NOT legacy-expressible (the legacy form has no per-layer weight;
 * `transMapWarpMix` is the global multiplier, a different quantity), so that case emits the array.
 *
 * ⚠️ **A non-default `staticField` also forces the array out, and it HAS to.** `staticField` lives on the
 * layer and has no legacy spelling at all: a one-layer chain whose Pattern is `Grid Lattice` renders nothing
 * like `transMapStyle: 0` on the preset's own table, so treating it as legacy-expressible would silently
 * discard the whole tuning on export — the user's field would come back as `(Preset)` after a round trip.
 * `isStaticFieldDefault()` is the gate rather than mere presence, because the UI writes a full block on the
 * first slider touch even when every value still equals its default (and `staticFieldOf` fills defaults on
 * read), so keying on `!!l.staticField` would put the array into an export that does not need it.
 *
 * ⚠️ **Every per-style config block forces the array out on the same reasoning, and the trap here is sharper
 * than for `staticField`.** `overlay.transMapStyle` is typed `TransMapStyle`, so it CAN hold any of 0-11 — a
 * single-layer style-7 chain therefore round-trips its *style* through the legacy scalar perfectly while
 * silently dropping `strength`, `reach`, `invert` and `source`. The preset would come back as Density
 * Refraction at defaults, which looks like it worked. Presence is the gate rather than a
 * value-equals-default test because these blocks are written only when the user opens the sub-panel, unlike
 * `staticField`, whose full block the layer row writes on the first touch of any slider.
 *
 * ⚠️ **A new style's block must be added to this list, or its tuning silently dies on export** — the failure
 * is invisible because the *style* survives and only its numbers revert. `fieldcheck` §J asserts that every
 * per-layer config key in `TransMapLayer` appears here.
 */
export function isLegacyExpressible(chain: readonly TransMapLayer[]): boolean {
  if (chain.length !== 1) return false;
  const l = chain[0]!;
  return l.enabled
    && l.weight >= 1.0
    && !l.zoomCenter
    && !l.refraction
    && !l.timeWarp
    && !l.bandSplit
    && !l.vortex
    && !l.conformal
    && !l.parallax
    && isStaticFieldDefault(l.staticField);
}

/**
 * Structural equality key for a chain — order, styles, mute flags and weights.
 *
 * ⚠️ **Chains must be compared by SHAPE, never by identity.** `chainFromOverlay()` and `normaliseChain()`
 * both return a fresh array of fresh objects on every call (I12, so a snapshot cannot keep changing under
 * the UI's in-place row edits), so `a !== b` is true even for two derivations of the same preset. A caller
 * that used `!==` as its dirty check would re-init the pass on every Reset and every grid click — which
 * reconstructs `ProceduralFlowGenerator` and visibly restarts its noise phase.
 *
 * Deliberately EXCLUDES the nested `proceduralFlow`/`fluidFeedback`/`ifsParams` blocks: those are
 * serialisation carriers, and the live values are owned by `main.ts` and re-handed every frame, so a
 * difference in them is not a reason to rebuild anything. `zoomCenter` IS included, since the static
 * displacement texture is built from it.
 *
 * ⚠️ **`staticField` is split: SHAPE fields are in the signature, MAGNITUDE fields are not.**
 * `pattern`/`pattern2`/`detail`/`zoomBias`/`shape`/`shapeMix`/`shape2`/`shapeMix2` change the wave arrays and
 * so must force a rebuild; `strength`/`strength2`/`drift` are applied as a gain and a phase, so including
 * them would rebuild the field on every frame of a slider drag and on every frame that drift advances — the
 * 0.8 ms gain solve turned into per-frame work, which is invariant 8's trap. Drift in particular MUST stay
 * out: it changes continuously by design.
 *
 * ⚠️⚠️ **THIS IS A SECOND HAND-WRITTEN DIGEST OF THE SAME FIELD LIST, BESIDE `TransMap.setChain()`'s, AND
 * NEITHER HAS A COMPILER BETWEEN IT AND `StaticFieldConfig`.** They answer different questions — this one
 * gates `reinitTransMap()` on a PRESET CHANGE (`main.ts`'s `chainSignature(tmChain) !== chainSignature(...)`),
 * that one gates `rebuildStaticField()` on a chain EDIT — and `setChain()` is not called at all on the branch
 * this one guards. **So a wave-array field omitted HERE means two presets differing only in that field do not
 * rebuild the displacement texture: preset B renders preset A's field, with every control, readout and
 * thumbnail showing B's.** `shapecheck` §D asserts both digests name every key `STATIC_FIELD_DEFAULTS` has,
 * seeded. ⚠️ The census in `PHASE35-KEYS.md` §2.3 lists five such enumerations and **misses this
 * one**; it is the sixth.
 *
 * ⚠️ **`vortex`, `timeWarp` and `parallax` are deliberately EXCLUDED, and the test that says so is "does a
 * change rebuild a CPU-side resource", not "is the block new".** Vortex is an analytic shader term with no
 * texture, so nothing is built from it. Time Warp's history target and Depth Parallax's depth target ARE
 * allocations, but they are gated on the layer's presence/enabled/weight — which this signature already
 * carries — not on any value inside the block. Adding them would rebuild the static displacement texture on
 * every frame of a swirl drag, for a field that texture does not contain.
 */
export function chainSignature(chain: readonly TransMapLayer[]): string {
  return chain
    .map(l => {
      const s = l.staticField;
      const sf = s
        ? `${s.pattern ?? '-'},${s.pattern2 ?? '-'},${(s.detail ?? 1).toFixed(4)},${(s.zoomBias ?? 0).toFixed(4)}`
          + `,${s.shape ?? '-'},${(s.shapeMix ?? 0).toFixed(4)},${s.shape2 ?? '-'},${(s.shapeMix2 ?? 0).toFixed(4)}`
          // ⚠️ The four ANGLES (`35.3`) are wave-ARRAY fields of the strongest kind: they change the table's
          // LENGTH as well as its contents. Two presets differing only in `angleX` must reinit, or preset B
          // renders preset A's field at preset A's table width while every control shows B's.
          + `,${(s.angleX ?? 0).toFixed(4)},${(s.angleY ?? 0).toFixed(4)}`
          + `,${(s.angleX2 ?? 0).toFixed(4)},${(s.angleY2 ?? 0).toFixed(4)}`
        : '-';
      return `${l.style}:${l.enabled ? 1 : 0}:${l.weight.toFixed(4)}:${l.zoomCenter ? `${l.zoomCenter.x},${l.zoomCenter.y}` : '-'}:${sf}`;
    })
    .join('|');
}

/** The layer for `style`, or undefined. Chains are ≤7 entries, so a linear scan is the right shape. */
export function findLayer(chain: readonly TransMapLayer[], style: number): TransMapLayer | undefined {
  return chain.find(l => l.style === style);
}

/**
 * **Is `style` CONTRIBUTING to the rendered frame** — enabled *and* carrying nonzero weight.
 *
 * ⚠️ **The `weight > 0` clause is load-bearing and was missing.** This predicate must agree with
 * `buildChainPlan()`'s `live` filter EXACTLY, because the plan decides what the GPU draws while this decides
 * the out-of-band state changes that go with it. It tested `enabled` only, so a style-6 layer dragged to
 * weight 0 left `trailDecay` pinned to `fluidFeedback.persist` and the 512² velocity simulation running: the
 * warp itself correctly vanished (the plan excluded the layer, so the shader bound the zero fallback), but
 * the trail kept the wrong fade length, which reads as "weight 0 does not fully remove the effect" — exactly
 * the reported symptom, and a residue only muting or deleting the layer cleared.
 *
 * This is the same defect as the 2026-08-12 report ("selecting a transmap dropdown changes the animation
 * even though transmap is disabled"): `trailDecay` feeds the per-frame fade pass unconditionally, so it is
 * visible whenever its predicate is wider than the predicate governing the pass it belongs to.
 *
 * Use for SIDE EFFECTS and cost (trail decay, fluid sim activation, resource allocation). For "does the
 * chain carry a configuration for this style" — export gating, which must preserve a muted layer's tuning —
 * use `hasLayerFor()`.
 */
export function isStyleActive(chain: readonly TransMapLayer[], style: number): boolean {
  return chain.some(l => l.style === style && l.enabled && l.weight > 0);
}

/**
 * **Is a layer for `style` PRESENT at all**, whatever its mute flag or weight.
 *
 * The counterpart to `isStyleActive()`, and the right test for carrying a style's configuration block. A
 * muted layer keeps its settings by design — that is the whole point of having mute separate from remove —
 * so an export gated on activity would silently discard the `proceduralFlow` or `fluidFeedback` tuning of a
 * layer the user muted to A/B it, and importing that file back would reset it to defaults.
 */
export function hasLayerFor(chain: readonly TransMapLayer[], style: number): boolean {
  return chain.some(l => l.style === style);
}

// ⚠️ `hasStyle(chain, style)` lived here and was DELETED 2026-08-19, deliberately and without a deprecated
// shim. It tested `enabled` while ignoring `weight`, which made it disagree with `buildChainPlan()`'s `live`
// filter — the weight-0 residue bug. A shim would have kept the ambiguous name reachable with zero callers
// (which `deadcheck` flags anyway) and left the next caller a name that does not say which question it
// answers. Every site now picks `isStyleActive()` or `hasLayerFor()` explicitly. Do not reinstate it.

/**
 * Whether the ECHO pass runs BEFORE the warp pass — the chain's one executable ordering (see the header).
 *
 * Derived from array position: echo-first iff the style-4 layer precedes every enabled field layer.
 *
 * ⚠️ **This assumes EXACTLY ONE colour layer, and that assumption still holds after Step 14.3.** The natural
 * reading of style 8 (Time Warp) is a second colour composite, and building it that way would invalidate this
 * function and `needsScratch` with it: with two colour passes the arrangements are no longer two but six (each
 * colour pass may precede or follow the warp, and they have an order between themselves), the "field order is
 * a mathematical no-op" argument still holds but "one executable boundary" does not, and a single scratch
 * target no longer suffices — a warp between two colour passes needs the second pass to read what the first
 * wrote *through* the warp, i.e. two intermediates. **Style 8 is a `modifier` precisely to avoid owing that
 * derivation**, so `COLOUR_STYLES.length === 1` remains an invariant of the table rather than a coincidence.
 * Do not widen this predicate to admit a second colour layer; do the derivation instead.
 *
 * ⚠️ A `modifier` layer (Band Split) is deliberately NOT a boundary. It changes how the warp pass
 * composites, so it lives inside that pass and has no position of its own — which is why it is excluded
 * from the `firstField` scan below via `isFieldStyle`.
 */
export function echoRunsFirst(chain: readonly TransMapLayer[]): boolean {
  const echoIdx = chain.findIndex(l => l.style === ECHO_STYLE);
  if (echoIdx < 0) return false;
  const firstField = chain.findIndex(l => isFieldStyle(l.style));
  return firstField < 0 ? false : echoIdx < firstField;
}

/**
 * What the chain compiles to. Derived on CHAIN CHANGE, never per frame — a plan object rebuilt every
 * frame is exactly the per-frame allocation RATE that invariant 8 was written about (58 MB/s reached the
 * user as "a jitter every few seconds", i.e. a GC pause).
 */
export interface ChainPlan {
  /** Enabled SEPARABLE styles (0-3) — summed on the CPU into ONE displacement texture. */
  staticStyles: TransMapLayer[];
  /** The enabled style-5 layer, if any. */
  flowLayer: TransMapLayer | null;
  /** The enabled style-6 layer, if any. */
  fluidLayer: TransMapLayer | null;
  /** The enabled style-7 (Density Refraction) layer, if any. */
  refractLayer: TransMapLayer | null;
  /**
   * The enabled style-9 (Band Split) layer, if any.
   *
   * ⚠️ **A modifier, so it is NOT counted by `needsWarp`.** Band Split recomposes the warp's output against
   * the unwarped frame's low frequencies; with no field layer the warped and unwarped frames are the same
   * pixels, so its residual difference is identically zero. Letting it force a warp pass on its own would
   * spend two blur passes to reproduce the input exactly.
   */
  bandLayer: TransMapLayer | null;
  /**
   * The enabled style-10 (Vortex) layer, if any.
   *
   * ⚠️ **A FIELD, so unlike the three modifiers it DOES count toward `needsWarp`** — it produces an offset of
   * its own, from an analytic term rather than the displacement texture, so a chain consisting of nothing but
   * a vortex layer is a working warp. This is the one of the four new styles that can turn the pass on.
   */
  vortexLayer: TransMapLayer | null;
  /**
   * v8 `30.4` — the enabled style-12 (Conformal) layer, if any.
   *
   * ⚠️ **A FIELD, so it counts toward `needsWarp`**, for the vortex's reason exactly: it produces its
   * own offset from an analytic term, so a chain of nothing but a conformal layer is a working warp.
   */
  conformalLayer: TransMapLayer | null;
  /** The enabled style-8 (Time Warp) layer, if any. A modifier — see `bandLayer`. */
  timeWarpLayer: TransMapLayer | null;
  /** The enabled style-11 (Depth Parallax) layer, if any. A modifier — see `bandLayer`. */
  parallaxLayer: TransMapLayer | null;
  /** The enabled style-4 layer, if any. */
  echoLayer: TransMapLayer | null;
  /** True when the echo pass runs before the warp pass. */
  echoFirst: boolean;
  /** A warp pass is needed at all (i.e. at least one enabled field layer). */
  needsWarp: boolean;
  /** Both passes run, so an intermediate render target is required. */
  needsScratch: boolean;
  /** The warp pass must also produce the band-split blur targets. */
  needsBandBlur: boolean;
  /**
   * A full-resolution history target is required — Step 14.3's real cost.
   *
   * ⚠️ **Its "one frame of history is free" premise was FALSIFIED.** The warp pass renders into `fboA` and
   * `texA` is that FBO's own attachment, so reading `texA` as history is a framebuffer feedback loop:
   * undefined in WebGL2 and silent on ANGLE, i.e. invariant 20's shape rather than an error. Hence a real
   * third `RGBA16F`, allocated only when this is true.
   */
  needsHistory: boolean;
  /**
   * A separate `R16F` depth target is required, written by all three particle renderers — Step 14.7's cost.
   *
   * ⚠️ The trail is `RGBA16F` with RGB = colour and A = coverage, both spoken for, so depth cannot ride along
   * in the existing target. Six invariants converge on the plumbing (1, 2, 3, 4, 5, 6).
   */
  needsDepth: boolean;
}

// ⚠️ Step 14.6's pass ordering is deliberately NOT a `ChainPlan` field. The plan is derived from the chain
// array alone, and `beforeParticles` lives on `postProcessors.transMap` (plus its `overlay` twin) — a field
// here would either be hard-coded `false`, i.e. an inert member of a structure whose whole contract is
// "derived from the chain" (invariant 13's shape), or would need the plan to take a second argument and so
// change every one of its call sites. It is resolved once in `main.ts` and handed to
// `TransMapProcessor.setParticlesAfterWarp()` instead. See invariant 17: one local, every reader gated on it.

export function buildChainPlan(chain: readonly TransMapLayer[]): ChainPlan {
  const live = chain.filter(l => l.enabled && l.weight > 0);
  // By METADATA, not by `l.style <= 3` — see `StyleMeta.separable` for why the numeric test was a silent
  // enumeration of the vocabulary rather than a statement about the field.
  const staticStyles = live.filter(l => styleMeta(l.style)?.separable === true);
  const flowLayer = live.find(l => l.style === 5) ?? null;
  const fluidLayer = live.find(l => l.style === 6) ?? null;
  const refractLayer = live.find(l => l.style === 7) ?? null;
  const timeWarpLayer = live.find(l => l.style === 8) ?? null;
  const bandLayer = live.find(l => l.style === 9) ?? null;
  const vortexLayer = live.find(l => l.style === 10) ?? null;
  const conformalLayer = live.find(l => l.style === 12) ?? null;   // v8 30.4
  const parallaxLayer = live.find(l => l.style === 11) ?? null;
  const echoLayer = live.find(l => l.style === ECHO_STYLE) ?? null;
  const needsWarp = staticStyles.length > 0
    || flowLayer !== null
    || fluidLayer !== null
    || refractLayer !== null
    || vortexLayer !== null
    || conformalLayer !== null;   // v8 30.4 — a field style, so it can turn the pass on by itself
  // ⚠️ The two allocation flags also test the AMOUNT, not just the layer, because both amounts default to 0:
  // a freshly added layer would otherwise allocate 8 MB (history) or force all three renderers onto a second
  // colour attachment (depth) while provably contributing nothing to the frame.
  const historyAmount = timeWarpLayer ? timeWarpOf(timeWarpLayer).amount : 0;
  const parallaxAmount = parallaxLayer ? parallaxOf(parallaxLayer).amount : 0;
  return {
    staticStyles,
    flowLayer,
    fluidLayer,
    refractLayer,
    bandLayer,
    vortexLayer,
    conformalLayer,
    timeWarpLayer,
    parallaxLayer,
    echoLayer,
    echoFirst: echoRunsFirst(chain),
    needsWarp,
    needsScratch: needsWarp && echoLayer !== null,
    needsBandBlur: needsWarp && bandLayer !== null,
    needsHistory: needsWarp && historyAmount > 0,
    needsDepth: needsWarp && parallaxAmount > 0,
  };
}

/** One-line human summary of the executed pipeline, for the Visual FX readout. */
export function describePlan(plan: ChainPlan): string {
  const stages: string[] = [];
  const fieldNames = [
    ...plan.staticStyles.map(l => TRANS_MAP_STYLE_NAMES[l.style]!),
    ...(plan.flowLayer ? [TRANS_MAP_STYLE_NAMES[5]!] : []),
    ...(plan.fluidLayer ? [TRANS_MAP_STYLE_NAMES[6]!] : []),
    ...(plan.refractLayer ? [TRANS_MAP_STYLE_NAMES[7]!] : []),
    ...(plan.vortexLayer ? [TRANS_MAP_STYLE_NAMES[10]!] : []),
  ];
  // Every modifier is named INSIDE the warp stage, not as a stage of its own, because that is where it
  // executes — a readout that implied a separate pass would misdescribe the pipeline it exists to explain.
  // ⚠️ Each is gated on its `needs*`/`needsBandBlur` flag rather than on layer presence, so a modifier that
  // is present but at amount 0 (and therefore genuinely not running) is not advertised as a stage.
  const mods = [
    ...(plan.needsBandBlur ? ['band-split'] : []),
    ...(plan.needsHistory ? ['time-warp'] : []),
    ...(plan.needsDepth ? ['depth-parallax'] : []),
  ];
  const bandSuffix = mods.length > 0 ? `, ${mods.join(', ')}` : '';
  const warp = fieldNames.length > 0 ? `warp: ${fieldNames.join(' + ')}${bandSuffix}` : null;
  const echo = plan.echoLayer ? 'echo: IFS' : null;
  if (plan.echoFirst) {
    if (echo) stages.push(echo);
    if (warp) stages.push(warp);
  } else {
    if (warp) stages.push(warp);
    if (echo) stages.push(echo);
  }
  if (stages.length === 0) return 'trail → bloom  (no active layer)';
  return `trail → [${stages.join('] → [')}] → bloom`;
}

