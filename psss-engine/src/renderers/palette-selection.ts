import { getIndexPaletteAB, getPaletteLUT } from '../presets/palettes.ts';
import { PALETTE_MAPPING_OFF, paletteMappingToInt, type PaletteMapping } from './film-looks.ts';

/**
 * # The ONE owner of "which palette, mapped how" — v8 Step 21.4a / 21.4c
 *
 * ## Why this file exists at all
 *
 * As of `21.4c` the palette has **two sources**: `overlay.palette` / `overlay.paletteMapping` (per preset,
 * grading-free) and `FilmLookParams.palette` / `.paletteMapping` (the older home, inside a look bundle).
 * Invariant 17 is explicit about what that costs — *two sources ⇒ every reader resolves them in the same
 * order AND nothing may write the resolved value afterwards* — and it is explicit about how the last such
 * defect hid: **grepping the readers exonerated the file that was wrong**, because every reader looked
 * correct and the bug was a later write. So the resolution exists exactly once, here, and returns everything
 * a caller could want already decided. There is no second `??` chain anywhere, and callers must not
 * re-derive one from the two halves of the result.
 *
 * ## The `index` mapping's split, and why the result carries BOTH halves
 *
 * Six of the seven mappings sample a 256-entry LUT in the fragment shader and **replace `vColor`**. The
 * seventh, `index` (`21.4a`), is CPU-side: it hands `a`/`b` to the per-particle colour law in
 * `LissajousGenerator`, which writes `state.colors` — the buffer the point, splat, ribbon, neon and liquid
 * paths all already read. That is why the mapping is worth having rather than being a seventh shader branch:
 * one CPU change reaches every consumer, including the two trajectory renderers that had to be taught the
 * palette separately in 2026-08.
 *
 * ⚠️ **With `index` selected, the shader must not see a palette at all.** If it did, the LUT sample would
 * overwrite the CPU's answer with a *different, plausible-looking* picture — the worst kind of defect,
 * because nothing is black and nothing throws. There are two guards and they are both in this function's
 * result, so they cannot disagree:
 *
 * - `shaderPalette` is `'none'` whenever the mapping is `index`, and
 * - `shaderMappingInt` is `PALETTE_MAPPING_OFF` (negative) in the same case.
 *
 * The second is not redundant: the shader's mapping chain ends in `else { palCoord = vVelocity; }`, so an
 * unmatched int selects the velocity mapping instead of doing nothing. **Assert both directions** — a test
 * that only checks `shaderPalette` would pass with the int wired to 6.
 *
 * ## What `indexPalette === null` means, and why it is not an error
 *
 * `null` is the answer in three legitimate cases: the mapping is not `index`; the mapping is `index` and no
 * palette is named; the mapping is `index` and the named palette carries no `a`/`b`. The first two both mean
 * **"the generator uses the preset's own `colorBase`/`colorAmp`"**, which is the code path that has always
 * run — so a preset whose quadruple matches no `Cycle:` palette is **bit-identical** under `index` to what it
 * renders today, with no palette in sight. That is the whole reason the migration in `21.4d` can adopt a body
 * without editing it.
 *
 * ⚠️ **Two figures that used to stand here were stale and are deliberately not repeated: re-measure, do not
 * quote.** The adoption count moved with the library (measured 2026-09-18: **114** of 276 bodies resolve a
 * palette name under `index`, **4** fall through to `Preset colour (index)` — `21.D3`'s "five unnamed pairs"
 * was a different, earlier basis), and both figures are a BASIS difference rather than an event: a body that
 * gained a palette and one that lost its mapping cancel in a total. `palettecheck` computes the partition
 * from the live library — read it there, and reconcile by NAME.
 *
 * The third case does not arise, because `Classic:` gradients and `Material:` ramps get `kind: 'lut'`
 * instead — see below.
 */
export interface IndexPaletteSource {
  /**
   * `'ab'` — a cosine palette (the 12 curated or the 9 `Cycle:` ones). `base`/`amp` are in the **0–255
   * domain**, because the generator's law runs there and must stay byte-identical; see
   * `getIndexPaletteAB`'s note on why that round trip is lossless.
   *
   * `'lut'` — a `Classic:` gradient or a `Material:` ramp, which have no `a`/`b` to give. The population is
   * coloured by sampling their baked ramp across the index domain instead.
   */
  kind: 'ab' | 'lut';
  base?: [number, number, number];
  amp?: [number, number, number];
  lut?: Uint8Array;
}

export interface PaletteSelection {
  /** The resolved palette NAME — the stored word, `'none'` when nothing supplies a palette. */
  name: string;
  /** The resolved mapping — the stored word. */
  mapping: PaletteMapping;
  /** What the LUT path (point/splat shaders, ribbon, neon) must be given. `'none'` under `index`. */
  shaderPalette: string;
  /** What `uPaletteMapping` must be given. `PALETTE_MAPPING_OFF` under `index`. */
  shaderMappingInt: number;
  /** What `LissajousGenerator.setIndexPalette()` must be given. `null` for every LUT mapping. */
  indexPalette: IndexPaletteSource | null;
  /**
   * `true` when the colour the figure ends up with comes from the preset's OWN `colorBase`/`colorAmp` under
   * the `index` mapping, rather than from a palette — the state `21.4f` labels `Preset colour (index)`.
   * Derived here so the UI cannot invent a fourth rule for it.
   */
  usesPresetQuadruple: boolean;
}

/** The unset sentinel a dropdown stores for "not overridden"; NOT the same value as `'none'`. */
export const PALETTE_UNSET = '';

/**
 * v8 Step 21.4f — the `pos` the swatch strip is sampled at. **ONE site, and deliberately not a parameter.**
 *
 * ⚠️ **Invariant 28 in full.** A readout sampling one instant of something periodic must not sample `t = 0`,
 * because at `pos === 0` the colour law's drift term `sin(… + pos · shift[c])` collapses to `sin(…)` on all
 * three channels at once — so a swatch drawn there shows the identical ramp whatever `Colour Drift` says, and
 * the control reads inert while working perfectly. The same invariant forbids making the instant a parameter,
 * which is why it lives here rather than in the tab that draws the strip.
 *
 * **1, and the value was checked algebraically rather than picked.** The failure to avoid is a ghost — an
 * instant at which the drift returns every channel to its starting phase, i.e. `pos · shift[c] ≡ 0 (mod 2π)`.
 * Every authored `colorShift` magnitude in the library lies in `(0, 3]`, and `1 · 3 < 2π`, so **no authored
 * drift can complete even half a turn by `pos = 1`** and none of them can be a ghost. A larger instant would
 * reintroduce the risk (at `pos = 2π` every `shift = 1` channel is a ghost, and 12 presets author 1).
 */
export const INDEX_SWATCH_POS = 1;

/**
 * Resolve the palette selection from the overlay and the live film-look params, in that order.
 *
 * ⚠️ **`ov.palette === ''` (`PALETTE_UNSET`) is "not overridden", `'none'` is "no palette".** They are two
 * different answers and the dropdown stores both, so the chain tests for `undefined` *and* the empty string
 * rather than using `??` alone — a plain `??` would make an unset dropdown override a film look's palette
 * with the empty string, which `getPaletteLUT` reads as no palette. That is a one-character difference
 * between "the look's palette still applies" and "the look's palette silently stopped applying".
 */
export function resolvePaletteSelection(
  // ⚠️ `| undefined` written out rather than left to `?`, because `exactOptionalPropertyTypes` is on: the
  // callers hold `string | undefined` variables (that IS the "not overridden" state) and an optional
  // property would reject them. The two are different types under that flag, and the difference is exactly
  // the distinction this function exists to respect.
  ov: { palette: string | undefined; paletteMapping: PaletteMapping | undefined } | undefined,
  fp: { palette: string; paletteMapping: PaletteMapping } | undefined,
): PaletteSelection {
  const ovName = ov?.palette;
  const name = (ovName !== undefined && ovName !== PALETTE_UNSET) ? ovName : (fp?.palette ?? 'none');
  const mapping = ov?.paletteMapping ?? fp?.paletteMapping ?? 'depth';

  if (mapping !== 'index') {
    return {
      name, mapping,
      shaderPalette: name,
      shaderMappingInt: paletteMappingToInt(mapping),
      indexPalette: null,
      usesPresetQuadruple: false,
    };
  }

  const named = name !== 'none' && name !== PALETTE_UNSET;
  let indexPalette: IndexPaletteSource | null = null;
  if (named) {
    const ab = getIndexPaletteAB(name);
    if (ab) {
      indexPalette = { kind: 'ab', base: ab.base, amp: ab.amp };
    } else {
      // A `Classic:` gradient or a `Material:` ramp. Its ramp IS a LUT by construction, so sampling one
      // here is not the "never bake `index` into a LUT" mistake — that rule is about the cosine law, whose
      // per-channel phase moves every frame and whose clamp happens before an 8-bit round, neither of which
      // a 256-entry table can hold. A gradient has no phase and no clamp to lose.
      //
      // Falling back to the preset's quadruple instead would leave 20 of the 41 palettes doing NOTHING on
      // this mapping, silently — a mode no preset selects hiding inside a mapping some preset does.
      const lut = getPaletteLUT(name);
      if (lut) indexPalette = { kind: 'lut', lut };
    }
  }

  return {
    name, mapping,
    // Both guards, decided once. See the header: asserting only one of them is a false pass.
    shaderPalette: 'none',
    shaderMappingInt: PALETTE_MAPPING_OFF,
    indexPalette,
    usesPresetQuadruple: indexPalette === null,
  };
}

/**
 * v8 Step 21.4g — the palette a FILM LOOK carries, for the ONE caller that adopts it into the override.
 *
 * ## Why a two-field pluck is a function, and why it lives in THIS file
 *
 * `21.4g` collapsed the UI to a single palette control. The rule is *last action wins*: choosing a film look
 * (in Visual FX, by number key, or through a material's `presentation` block) **writes** the look's palette
 * into `overlay.palette` / `overlay.paletteMapping`, where the user can then override it. So the engine needs
 * to ask a look what palette it carries — which is a **read of a palette SOURCE**, the one thing
 * `palettecheck` §F bans `main.ts` from doing after `resolvePhysarumTrailLut()` was found with a private
 * chain (invariant 17, one scope smaller than the file).
 *
 * ⚠️ **The ban is worth keeping literally true, so the read lives here instead — this file is now the only
 * place in `src/` that reads either source.** `resolvePaletteSelection` owns *which source wins*; this owns
 * *what a look carries*. Two questions, one file, no second `??` chain anywhere.
 *
 * ⚠️ **This is NOT a colour decision and must never be used as one.** Its result is written to the override
 * and then resolved like any authored value; a renderer reaching for it would be a second reader of the film
 * look, which is exactly the defect the resolver exists to prevent. The one legitimate caller is
 * `adoptLookPalette()` in `main.ts`, and `palettecheck` §H asserts both that it exists and that
 * `applyFilmLook()` itself does not call it — the preset-load and Lab-Reset paths go through `applyFilmLook`
 * and **must not** materialise anything, or every export in the library would silently gain two fields it
 * never authored.
 *
 * ## ⚠️ A look with no palette of its own adopts NOTHING — `null`, not `'none'`
 *
 * **Owner-reported 2026-09-19, fixed the same day, and the first version of this function shipped the
 * defect.** `Spiritual` (a legacy body the `21.4d` migration adopts to `Cycle: Indigo` + `index`) displayed
 * that pair correctly, and then switching the look to `Legacy Graded` replaced it with `None` + `Depth`.
 * Switching to `Customize` did the same, because `applyFilmLook` seeds Customize from the outgoing bundle.
 *
 * **`palette: 'none'` inside a bundle is not a colour decision — it means the bundle declines to make one.**
 * `Legacy Graded`'s own header says so in as many words: *"`palette: 'none'` keeps each preset's own
 * oscillating `colorBase`/`colorAmp`/`colorFreq`"*. Three of the bundles are built that way (`Legacy`,
 * `Legacy Graded`, `Cinematic`) precisely so that a grading change can be judged without restyling the
 * colour, so materialising their `'none'` into the override turns "I have no opinion" into "there is no
 * palette" — and destroys whatever the preset did select, for every one of the 114 bodies `21.4d` adopted.
 *
 * ⚠️ **Coercing to `PALETTE_UNSET` is NOT the fix, and it is the tempting one.** `''` means "not
 * overridden", so the chain falls through to `fp.palette`, which is `'none'` — the same resolved answer by a
 * different route, and the override is erased on the way. Only *not writing* preserves the selection.
 * (`palettecheck` §H measures both: the shipped `'none'` write and the `''` variant drift identically.)
 *
 * ⚠️ **Both fields or neither.** Adopting the mapping alone would be worse than adopting both: a `Cycle:`
 * palette under `index` is computed by the generator's colour law, and re-pointing it at `depth` makes the
 * shader sample a LUT instead — a *different* picture rather than a missing one, which is the failure mode
 * this file's header calls the worst kind. The three `'none'` bundles all carry `paletteMapping: 'depth'`,
 * which is filler for a field they never use, not a choice to propagate.
 *
 * A look is still never `PALETTE_UNSET` — it cannot say "inherit", because there is nothing above it to
 * inherit from. `null` here is the caller's instruction to leave the override exactly as it stands.
 */
export function lookPaletteForAdoption(
  fp: { palette: string; paletteMapping: PaletteMapping },
): { palette: string; paletteMapping: PaletteMapping } | null {
  if (fp.palette === 'none' || fp.palette === PALETTE_UNSET) return null;
  return { palette: fp.palette, paletteMapping: fp.paletteMapping };
}

/**
 * The seven mappings as `[stored, label]`, for the two dropdowns that offer them.
 *
 * ⚠️ **A `Record<PaletteMapping, string>` on purpose, so `tsc` demands a label for a new member** — the
 * same reason `RENDER_MODE_LABELS` and `REEL_*_LABELS` are shaped this way. A hand-written array of pairs is
 * what let the `Map` dropdown in `visual-fx.ts` sit two members short of the type for a month.
 *
 * ⚠️ **A label is never stored.** `temperature`'s parenthetical is a PRECONDITION and stays inline copy
 * (`tipcheck`'s rule); the stored word is the bare one.
 */
export const PALETTE_MAPPING_LABELS: Record<PaletteMapping, string> = {
  depth: 'Depth',
  phase: 'Phase',
  velocity: 'Velocity',
  position: 'Position',
  age: 'Age',
  temperature: 'Temperature (needs a material)',
  index: 'Particle index',
};

/** Dropdown order: the six LUT mappings as they were, then `index` last — it is the odd one out. */
export const PALETTE_MAPPING_ORDER: PaletteMapping[] = [
  'depth', 'phase', 'velocity', 'position', 'age', 'temperature', 'index',
];
