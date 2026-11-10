# PSSS v2 — How It Works

**A technical reference for the PSSS engine: the rendering pipeline, stage by stage, with the
mathematics and the algorithms each stage actually runs.**

This document answers *how the software works*. It is organised as the **nine pipeline stages**, and
every functional block of the four editing tabs — **Composer**, **Visual FX**, **Materials** and
**Transmap** — is described in the stage where it is processed. So if you have read about a control in
the user manual and want to know what it does to the numbers, and *when* in the frame it happens, this
is where to look.

| Companion document | What it is |
|---|---|
| `psss-engine-v2_how_to_use_it.md` | **The user manual.** Every control, what it is for, and how to drive it. Start there if the question is "what should I click". |
| `psss-engine-v2_how_it_works_old.md` | **The superseded combined document**, kept unchanged with the project's engineering records rather than in this repository. It mixes this material with engineering history, measurements and development decisions. ⚠️ **Older section references — `§15`, `§18`, `§26.1` and the like — resolve in THAT file**, because this document numbers its sections by pipeline stage and does not preserve the old numbering. The references that lived in source comments have been repointed here; §26.1's preconditions table is now [Appendix A.4](#a4-preconditions--what-each-control-needs-in-order-to-do-anything). |

**PSSS was created by Andreas Kardin (*mephzara*), and the idea, the wave mathematics and most of the
preset library are his.** This document describes the third implementation of it; stages 1–4 are
substantially the original mathematics. The full account is
[chapter 12](#12-credits-and-the-original-psss).

**Notation used throughout.**

| Symbol | Meaning |
|---|---|
| `i` | particle index, `0 … N−1` for a particle count of `N` |
| `n` | the particle's position along the sweep: `n = i · cStep`, the parameter the wave functions are evaluated at |
| `pos` | the figure's animation phase, advanced every frame by the sweep rate and the Speed factor |
| `DEG` | `180/π`. The engine stores angles in **degrees** and divides by `DEG` at the point of use, which is why so many formulas carry `/DEG` |
| *model space* | the figure's own coordinate system, before rotation, scale, canvas fit or projection |
| *screen space* | pixels of the output framebuffer |
| `min(w,h)` | the frame's shorter side. **Every image-domain length in the engine is measured on this one scale**, so an effect keeps its proportions on any window shape |

---

## Contents

- [0. The Pipeline at a Glance](#0-the-pipeline-at-a-glance)
- [1. Stage 1 — Generating Particle Positions](#1-stage-1--generating-particle-positions)
  - [1.1 The additive wave model](#11-the-additive-wave-model)
    - [The wave basis — Sharpness](#the-wave-basis--sharpness)
    - [The amplitude ramp — Grow](#the-amplitude-ramp--grow)
    - [The secular term — Travel](#the-secular-term--travel)
    - [The DC term — Offset](#the-dc-term--offset)
    - [Breathing — the four operators that cycle](#breathing--the-four-operators-that-cycle)
    - [One law, two readers](#one-law-two-readers)
  - [1.2 Modulation: Pulse and Wobble](#12-modulation-pulse-and-wobble)
  - [1.3 Model-space operators](#13-model-space-operators)
    - [Twist](#twist)
    - [Box-fold](#box-fold)
    - [Taper and bend](#taper-and-bend)
    - [Spherical inversion](#spherical-inversion)
    - [Fractal Fold](#fractal-fold)
    - [4D rotation](#4d-rotation)
    - [Depth ordering](#depth-ordering)
    - [Symmetry](#symmetry)
    - [3-D Symmetry](#3-d-symmetry)
  - [1.4 Strange attractors](#14-strange-attractors)
    - [1.4.1 Continuous systems — integrated ODEs](#141-continuous-systems--integrated-odes)
    - [1.4.2 Discrete maps](#142-discrete-maps)
    - [1.4.3 Escape-time sets — Julia and Mandelbrot](#143-escape-time-sets--julia-and-mandelbrot)
    - [1.4.4 Fitting an attractor into the figure's space](#144-fitting-an-attractor-into-the-figures-space)
  - [1.5 Extra populations](#15-extra-populations)
  - [1.6 Self-similar curves](#16-self-similar-curves)
    - [The model](#the-model)
    - [The bracket pop retraces](#the-bracket-pop-retraces)
    - [Resampling, and the two interpolations](#resampling-and-the-two-interpolations)
    - [The generator builder — Twist and Stretch](#the-generator-builder--twist-and-stretch)
    - [Customize — the generator as data](#customize--the-generator-as-data)
    - [Normalisation](#normalisation)
    - [Smoothness](#smoothness)
    - [Descend — the self-similar zoom](#descend--the-self-similar-zoom)
    - [What this figure source inherits, and what it does not](#what-this-figure-source-inherits-and-what-it-does-not)
- [2. Stage 2 — Field Systems That Move Particles](#2-stage-2--field-systems-that-move-particles)
  - [2.1 Curl noise](#21-curl-noise)
  - [2.2 Cohesion](#22-cohesion)
  - [2.3 Liquid field](#23-liquid-field)
  - [2.4 Dye field](#24-dye-field)
  - [2.4a The dye's two output paths](#24a-the-dyes-two-output-paths--and-only-one-of-them-needs-liquid)
  - [2.5 Physarum network](#25-physarum-network)
  - [2.6 Fluid advection](#26-fluid-advection)
  - [2.7 Buoyancy and smoke (Materials)](#27-buoyancy-and-smoke-materials)
  - [2.8 The force gate](#28-the-force-gate)
- [3. Stage 3 — Colour Per Particle](#3-stage-3--colour-per-particle)
  - [3.1 The colour oscillator](#31-the-colour-oscillator)
  - [3.2 Palettes](#32-palettes)
  - [3.3 Material ramps and temperature](#33-material-ramps-and-temperature)
  - [3.4 Precedence](#34-precedence)
- [4. Stage 4 — 3D Transform and Projection](#4-stage-4--3d-transform-and-projection)
  - [4.1 Scale, then rotation](#41-scale-then-rotation)
  - [4.2 Perspective projection](#42-perspective-projection)
  - [4.3 Canvas fit](#43-canvas-fit)
- [5. Stage 5 — Drawing a Particle: the Six Render Modes](#5-stage-5--drawing-a-particle-the-six-render-modes)
  - [5.1 Particle size](#51-particle-size)
  - [5.2 The six modes](#52-the-six-modes)
  - [5.3 Star: the glow shape](#53-star-the-glow-shape)
  - [5.4 Volume](#54-volume)
  - [5.5 Liquid: the iso-surface](#55-liquid-the-iso-surface)
  - [5.6 Ribbons and neon lines](#56-ribbons-and-neon-lines)
  - [5.6a Electric Discharge](#56a-electric-discharge)
  - [5.7 Depth and lighting cues](#57-depth-and-lighting-cues)
  - [5.8 Blending](#58-blending)
- [6. Stage 6 — The Trail: Motion Blur as Feedback](#6-stage-6--the-trail-motion-blur-as-feedback)
  - [6.1 The feedback equation](#61-the-feedback-equation)
  - [6.2 Effective trail length](#62-effective-trail-length)
  - [6.3 Two overrides, and both make the real trail shorter than the handle says](#63-two-overrides-and-both-make-the-real-trail-shorter-than-the-handle-says)
  - [6.4 Warp First](#64-warp-first)
- [7. Stage 7 — Translation Map: Warping the Image](#7-stage-7--translation-map-warping-the-image)
  - [7.1 The chain model](#71-the-chain-model)
  - [7.2 The displacement unit](#72-the-displacement-unit)
  - [7.3 The wave field](#73-the-wave-field)
    - [The five wave shapes](#the-five-wave-shapes)
    - [The nineteen named patterns](#the-nineteen-named-patterns)
    - [The four wave styles](#the-four-wave-styles)
    - [The four orientation angles](#the-four-orientation-angles)
  - [7.4 Procedural Flow](#74-procedural-flow)
  - [7.5 Fluid Feedback](#75-fluid-feedback)
  - [7.6 Density Refraction](#76-density-refraction)
  - [7.7 Vortex](#77-vortex)
  - [7.8 The three modifiers](#78-the-three-modifiers)
    - [7.8.1 Band Split (style 9)](#781-band-split-style-9)
    - [7.8.2 Time Warp (style 8)](#782-time-warp-style-8)
    - [7.8.3 Depth Parallax (style 11)](#783-depth-parallax-style-11)
  - [7.9 Fractal Feedback — an iterated function system](#79-fractal-feedback--an-iterated-function-system)
  - [7.10 Dispersion](#710-dispersion)
  - [7.11 Reading what is actually running](#711-reading-what-is-actually-running)
- [8. Stage 8 — Grading: Bloom, Tone Map, Film Look](#8-stage-8--grading-bloom-tone-map-film-look)
  - [8.0 How the final image is assembled](#80-how-the-final-image-is-assembled)
  - [8.1 Bloom](#81-bloom)
    - [8.1.1 The four passes](#811-the-four-passes)
    - [8.1.2 What the controls really do](#812-what-the-controls-really-do)
  - [8.2 Tone mapping](#82-tone-mapping)
  - [8.3 Lift, gamma, gain, saturation, vignette](#83-lift-gamma-gain-saturation-vignette)
  - [8.4 Film looks](#84-film-looks)
    - [8.4.1 Which looks bind a palette, and which leave it alone](#841-which-looks-bind-a-palette-and-which-leave-it-alone)
    - [8.4.2 The fifteen bundles' grading values](#842-the-fifteen-bundles-grading-values)
    - [8.4.3 How a look is applied](#843-how-a-look-is-applied)
- [9. Stage 9 — Composition and Reliability](#9-stage-9--composition-and-reliability)
  - [9.1 Frame order](#91-frame-order)
  - [9.2 The performance guard](#92-the-performance-guard)
    - [9.2.1 What the budget actually is](#921-what-the-budget-actually-is)
    - [9.2.2 The three levels, and how the thresholds were derived](#922-the-three-levels-and-how-the-thresholds-were-derived)
    - [9.2.3 Why a band was not enough: the dwell](#923-why-a-band-was-not-enough-the-dwell)
    - [9.2.4 What the user actually sees](#924-what-the-user-actually-sees)
  - [9.3 Reels](#93-reels)
  - [9.4 Preview grid tiles](#94-preview-grid-tiles)
    - [9.4.1 One rendered tile-frame, step by step](#941-one-rendered-tile-frame-step-by-step)
    - [9.4.2 Where a tile differs from the full pipeline](#942-where-a-tile-differs-from-the-full-pipeline)
    - [9.4.3 Why tiles need a brightness compensation, and why it is narrow](#943-why-tiles-need-a-brightness-compensation-and-why-it-is-narrow)
    - [9.4.4 Slots, eviction and the blit](#944-slots-eviction-and-the-blit)
  - [9.5 Numerical robustness](#95-numerical-robustness)
- [10. The Export and Import Formats](#10-the-export-and-import-formats)
  - [10.1 Four artefacts, three formats](#101-four-artefacts-three-formats)
  - [10.2 The five blocks](#102-the-five-blocks)
  - [10.3 The wave table is `[wave][axis]`](#103-the-wave-table-is-waveaxis)
  - [10.4 A complete real example](#104-a-complete-real-example)
  - [10.5 The overlay block and its export gates](#105-the-overlay-block-and-its-export-gates)
    - [The four figure-operator gates](#the-four-figure-operator-gates)
  - [10.6 Absence is meaningful](#106-absence-is-meaningful)
  - [10.7 The blocks nothing reads](#107-the-blocks-nothing-reads)
  - [10.8 Bundles, and how one is told from a single preset](#108-bundles-and-how-one-is-told-from-a-single-preset)
  - [10.9 Importing: names, versions and case](#109-importing-names-versions-and-case)
  - [10.10 The reel file](#1010-the-reel-file)
  - [10.11 The two deployment files](#1011-the-two-deployment-files)
  - [10.12 The legacy v1 format](#1012-the-legacy-v1-format)
- [11. References](#11-references)
  - [Tone mapping and grading](#tone-mapping-and-grading)
  - [Noise and flow](#noise-and-flow)
  - [Agent and growth models](#agent-and-growth-models)
  - [Curves, attractors and fractals](#curves-attractors-and-fractals)
  - [Density fields, liquids and materials](#density-fields-liquids-and-materials)
  - [Fluid simulation](#fluid-simulation)
  - [Shading](#shading)
  - [Colour, projection and the trail](#colour-projection-and-the-trail)
  - [Numerical methods and control](#numerical-methods-and-control)
  - [Platform: WebGL2 and the browser](#platform-webgl2-and-the-browser)
  - [Context](#context)
- [12. Credits and the Original PSSS](#12-credits-and-the-original-psss)
  - [12.1 The author](#121-the-author)
  - [12.2 The first version — a Delphi screensaver for Windows](#122-the-first-version--a-delphi-screensaver-for-windows)
  - [12.3 The second version — a JavaScript rewrite for the browser](#123-the-second-version--a-javascript-rewrite-for-the-browser)
  - [12.4 What this version changed, and what it kept](#124-what-this-version-changed-and-what-it-kept)
- [Appendix A — Catalogues](#appendix-a--catalogues)
  - [A.1 The thirty-five attractor presets](#a1-the-thirty-five-attractor-presets)
  - [A.2 The material parameter set, by pipeline stage](#a2-the-material-parameter-set-by-pipeline-stage)
  - [A.3 The six field systems at a glance](#a3-the-six-field-systems-at-a-glance)
  - [A.4 Preconditions — what each control needs in order to do anything](#a4-preconditions--what-each-control-needs-in-order-to-do-anything)

---

## 0. The Pipeline at a Glance

A frame is built in nine stages. The first four produce **where every particle is**; the fifth turns
particles into pixels; the last four operate on the **image** and no longer know about particles at all.

| Stage | What it produces | Runs on | Edited in |
|---|---|---|---|
| 1 Positions | a model-space position per particle | CPU | **Composer** (figure type, and either the wave slots or the curve rows); Visual FX → **Figure** (Framing & Timing, Curve Basis, Deformation, Attractor) |
| 2 Fields | that position, nudged | CPU + GPU | Visual FX → **Fields** (all six sections); **Materials** → Fire (buoyancy) |
| 3 Colour | an RGB value per particle | CPU | Visual FX → **Colour** (Colour Palette); **Materials** (ramps) |
| 4 Transform | a screen-space position and a depth | CPU | Visual FX → **Figure** (Rotation, Figure Scale) |
| 5 Draw | pixels in an HDR buffer | GPU | Visual FX → **Particles** (Render Mode) and **Colour** (the Film Look particle controls); **Materials** |
| 6 Trail | the HDR buffer, blended with the previous frame | GPU | Visual FX → **Particles** (Render Mode → Trail) |
| 7 Warp | the image, displaced | GPU | **Transmap**; Visual FX → **Image** (Translation Map) |
| 8 Grade | the final 8-bit image | GPU | Visual FX → **Colour** (Film Look) |
| 9 Composite | what reaches the screen | GPU + CPU | Reel, preview grid |

⚠️ **The Visual FX groups in that last column ARE these stages, which is not a coincidence and is worth
using.** The tab's five groups — *Figure*, *Particles*, *Colour*, *Image*, *Fields* — are the pipeline
cut where a reader can act on it, so a symptom that localises to a stage localises to a group. The two
orders only differ where one stage is edited from two groups, and stage 5 is the only one that is.

⚠️ **Stage 1 has TWO interchangeable figure SOURCES, and everything downstream of it has exactly one
input either way.** A preset's `generators.type` selects between the additive wave sum (§1.1) and a
self-similar curve (§1.6); both write the same model-space position array, and stages 2–9 cannot tell
which produced it. **That is why the whole rest of this document applies unchanged to both** — the
deformation operators, the field systems, the colour sources, the projection, the trail, the warp and
the grade are all consumers of stage 1's output rather than of the wave model specifically.

**Two consequences worth holding on to, because they explain most "why did that happen" questions:**

1. **Stages 1–4 are per-particle; stages 6–8 are per-pixel.** A control in the second group cannot
   know which particle produced a pixel. That is why the warp bends a background that has no particles
   in it, and why grading cannot treat the figure differently from its trail.
2. **The trail (stage 6) sits between drawing and warping.** So the warp acts on the *accumulated*
   image, not on this frame's particles alone — which is what makes a long trail and a warp interact so
   strongly, and why the `Warp First` switch (§6.4) exists at all.

---

## 1. Stage 1 — Generating Particle Positions

### 1.1 The additive wave model

PSSS's figure is a **3D Lissajous curve built by additive synthesis**. For each particle the engine
evaluates, on each of the three axes, a sum of up to **three sine waves**:

```
            3
  x(i)  =   Σ   A[w][0] · sin( (n + φ[w][0]) · f[w][0] )
           w=1
            3
  y(i)  =   Σ   A[w][1] · sin( (n + φ[w][1]) · f[w][1] )
           w=1
            3
  z(i)  =   Σ   A[w][2] · sin( (n + φ[w][2]) · f[w][2] )
           w=1

  where   n = i · cStep
```

That is the whole figure. Everything else in the engine decorates it.

- **`A` is `Size`** — how far that axis reaches, in model units.
- **`f` is the winding**, derived from the stored `Winding` as `f = Winding / DEG`.
- **`φ` is the phase**, from the stored `Shift °`.
- **`cStep`** is the sweep step: the parameter advance between consecutive particles. With `N`
  particles the curve is sampled at `N` points, so raising the particle count samples the *same* curve
  more densely — it does not make the figure bigger or longer.

> ⚠️ **The phase is added to `n` and then multiplied by the winding — `(n + φ)·f`, not `n·f + φ`.**
> The effective phase shift is therefore **`φ · f`**: the same stored `Shift °` produces a different
> actual shift on every axis, scaled by that axis's winding. At a winding of **0** no phase can shift
> anything at all. This is why the Composer shows two `Shift °` rows: the stored number, and a dial
> showing the phase the engine really applies, which divides the winding back out.

**Closure.** The curve closes — meets itself exactly — when every winding is a whole number, because
then all three axes complete an integer number of cycles over the sweep. A fractional winding leaves a
visible seam where the end of the sweep fails to meet the start. That is a legitimate shape, not an
error, and nothing rounds it away.

**The three slots.** The three waves are named **Body**, **Structure** and **Detail** by convention
rather than by mechanism — they are identical in the formula. The convention is large-and-slow to
small-and-fast: Body carries the silhouette (large `A`, low winding), Structure a fringe along it,
Detail a fine texture. A wave whose `A` is zero on all three axes contributes nothing and is *silent*.

#### The wave basis — Sharpness

The three sums above are written with `sin`, and that is one end of a control. **Sharpness** moves the
basis function from `sin` toward a **triangle wave** — and it does so **per wave slot**, so each of the
three waves carries its own basis. With `λ_w` the slot's value in `[0, 1]`:

```
            3
  x(i)  =   Σ   A[w][0] · basis( (n + φ[w][0]) · f[w][0] ,  λ_w )     (and likewise y, z)
           w=1

  basis(a, λ) = (1 − λ)·sin(a) + λ·tri(a)

  where   tri(a) = 1 − 4·|frac(a/2π + ¼) − ½|       frac(u) = u − floor(u)
```

The triangle matches `sin`'s zeros and its ±1 peaks exactly, so the figure keeps its amplitude and its
timing and changes only what happens *between* those points: straight segments meeting at sharp corners.
The range and the step live in `core/deform-limits.ts` (`SHARPNESS_MAX`, `SHARPNESS_STEP`).

**Three values, one per SLOT — Body, Structure and Detail — and not one per axis.** `λ_w` is resolved
once per frame and read inside the slot loop, which is why this is the one figure operator that stores
three numbers rather than the usual axis triple: a slot's basis applies to all three of its axes at
once. The intended use is a hierarchy — facet the broad shape and leave the fine texture smooth, or the
reverse — rather than three unrelated settings.

⚠️ **An absent Structure or Detail value means *follow Body*, not zero.** Both are read
`?? sharpness`, never `?? 0`, because the single stored value that existed before the slots were split
was global across all three — so a preset carrying one number must still facet all three slots or it
would change appearance in silence. **The consequence is that there is no absent-key spelling of "Body
only":** a figure faceted on one slot has to store all three values explicitly, which is what makes the
export gate's *all three or none* rule load-bearing rather than cosmetic
([§10.5](#105-the-overlay-block-and-its-export-gates)). The backfill has one owner, at the point where
a preset is adopted, because the generator has two `init()` call sites.

⚠️⚠️ **A SLOT'S SHARPNESS IS VISIBLE IN PROPORTION TO THAT SLOT'S SHARE OF THE FIGURE'S AMPLITUDE
BUDGET, AND THAT IS A MEASUREMENT RATHER THAN A GUIDELINE.** Measured over the composed library
(liveness and quantity both `|am.base| + |am.amplitude|`, summed per slot over the three axes and
normalised per preset): **mean shares Body 70.9 %, Structure 23.5 %, Detail 5.6 %**, with Detail's
*median* share exactly **0.0 %** because **191 of the library's 325 presets carry no live Detail term at
all.** ⚠️ **The three shares are a figure OF that basis over that population and nothing else — they
move whenever the library grows, so re-derive them from the library rather than carrying them.** So the
third value is reachable, stored, interpolated, exported — and structurally inert on the majority of the
library. ⚠️ **The shorthand *"sharpen Body"* is therefore wrong as advice**: it is false on every preset
whose Structure outweighs its Body, which several of the faceted presets do. The proportional rule is
the one that holds everywhere, and the Composer's **Score** is what shows which slots carry a given
figure.

⚠️ **A cell for a silent slot stays visible and inert, by decision.** The rule *hide a cell whose wave
slot is silent* is only expressible where there is a slot model with a notion of silence, which the
Composer has and Visual FX does not. The panel therefore shows three cells unconditionally and the
tooltip carries the proportional rule; the alternative was a second owner of "is this slot silent".

⚠️ **The knot type is invariant along the whole control, and that is a theorem rather than a
measurement.** Over the family **F** of continuous `f` with `f(t+1) = −f(t)`, `f(−t) = f(t)`, `f(0) = 1`
and `f` strictly decreasing on `(0, ½)`, the resulting Lissajous knot does not depend on which member of
**F** is used. **F** is convex and contains both the cosine and the sawtooth, so every setting here
yields the **same knot** as every other. The control changes the figure's visual language and *cannot*
change its topology — which is what makes it safe to expose on every preset in the library. (§11,
*Curves, attractors and fractals*.)

⚠️ **It is not a deformation, and the distinction is structural rather than taxonomic.** Every operator
in §1.3 is a map applied to a position *after* the wave sum; this changes the **function the sum is made
of**, so it runs inside the evaluation loop and is not a member of the operator chain at all. The
`Deformed` facet therefore excludes it.

⚠️ **`λ_w = 0` is a hard branch, not a zero weight.** `x + 0·tri` equals `x` for every finite `x`
*except* `−0`, which it silently turns into `+0` — one bit, on every preset in the library. The loop
picks each slot's basis by branch and never blends at zero, so the identity is bit-exact rather than
merely equal.

⚠️ **A triangle wave keeps 99.6 % of its energy in three harmonics, so the whole visible difference is
the corner** — about 0.4 % of the spectral energy. A high-accumulation trail averages it away: judge
this control on `Cylinder`, `Quader` or `Pipes` and measure the final 8-bit output, never on a dense
preset. ⚠️ **The faceted basis is also the cheaper one**: `tri` is built from `floor` and `abs` with no
transcendental call, so a slot at `λ_w = 1` costs **three fewer** sines per particle than the same slot
at 0 — its three axes — and all three slots faceted saves nine. Faceted presets measure 34–54 % cheaper
than smooth ones. The textbook `(2/π)·asin(sin a)` would have cost two transcendentals and inverted
that. An intermediate `λ_w` needs one sine, hoisted so it is computed once per term.

#### The amplitude ramp — Grow

**Grow** scales each axis's wave sum by a factor that ramps along the curve, so the stroke opens out or
closes down from one end to the other. With `τ = i / N` the element's position along the sweep in
`[0, 1)`:

```
  x(i) = ( Σ_w  A[w][0] · basis(…) ) · (1 + k_x · τ)
```

one coefficient `k` per axis, bounded by `GROW_FLOOR` … `GROW_MAX` (−1 … +3) in
`core/deform-limits.ts`.

⚠️⚠️ **THE STORED VALUE IS A RAMP COEFFICIENT AND `0` IS THE IDENTITY — NOT `1`.** At `k = 0` the
multiplier is exactly 1 for every particle and the figure is bit-identical to one that never carried the
key. **A reader who sees the word "multiplier" and writes `1` as the default scales every amplitude by
`1 + τ`, doubling the far end of every stroke in the library** — and nothing would report it: the type
is `number`, the rule table cannot express an identity, and no preset changes in a way a checker
notices. The readout never prints a bare multiplier at 0; it prints `Off`, and `×N at the end`
otherwise. The counter-example two fields away is the inversion sphere's radius, whose identity really
is 1.

⚠️ **`GROW_FLOOR = −1` is structural rather than a taste.** At exactly −1 the amplitude reaches 0 at
the end of the stroke — a full taper to a point, where every particle near `τ = 1` converges on the
origin and the tip is a genuine density spike. Below −1 the amplitude goes negative, which is a phase
inversion mid-stroke: fine mathematically, a fold-back visually, and impossible to read off the control.
**The clamp is on the resolved value**, because a base of 0 breathing with a depth of 2 would otherwise
reach −2.

⚠️ **`GROW_MAX = 3` is a legibility bound, not a fitting one, and the top of the range is deliberately
past the useful band.** Measured on a median-amplitude host at 1440×900 with a 100×100 design box: `k`
from 0 to 1.7 puts **0.0 %** of the stroke's last tenth off-frame, 1.8 is the first value at which it
leaves at all (1.5 %), and 3.0 puts 22.5 % off. **So the authoring band is roughly 0.5 … 1.8** and the
constant is what the control may *reach*. Every one of those figures is canvas-dependent — the canvas
fit is `min(cw/designW, ch/designH)`, so a taller window clips sooner — which is the second reason it is
stated as a reach rather than as a safety guarantee.

⚠️⚠️ **IT RUNS ON THE WAVE SUM ALONE, UPSTREAM OF BOTH TRANSLATION TERMS, AND THAT ORDERING IS THE ONE
CONTRACT THESE OPERATORS ADD.** Run after Travel it would ramp the secular term into a quadratic sweep;
run after Offset it would turn a constant translation into a ramped one. Both are different operators
and neither was asked for. **Travel and Offset, by contrast, commute exactly** — two additions into the
same accumulator — so their written order is not a contract and must not be read as one.

⚠️ **The factor is hoisted out of the slot loop**, which is the per-term form at a third of the
multiplies by distributivity: three multiplies per particle instead of nine. It is identical *at the
identity*, which is all the export gate and the Mixer need, and it forecloses a per-slot `Grow`.

⚠️ **The per-axis gate here is a cost gate, not a correctness one** — the factor enters as a
multiplier, and `x · 1` preserves `−0`. That is the opposite of Travel's and Offset's gates below, where
the term is *added* and the gate protects a bit.

⚠️ **It is not a member of the `Deformed` facet**, and that is the closer of the two calls: it changes
what the sum is made of rather than mapping a point after the sum, even though it changes the silhouette
materially.

#### The secular term — Travel

**Travel** adds a term linear in the particle index to each axis's sum:

```
  x(i) += t_x · (i / N) · halfExtent          halfExtent = min(designW, designH) / 2
```

one rate `t` per axis, bounded by `TRAVEL_MAX` in `core/deform-limits.ts`. At `t = 1` the figure walks
one design half-extent along that axis between the first particle and the last.

⚠️ **This is the one figure term that makes the curve OPEN**, and it is the reason it exists: **no finite
sum of sinusoids can produce a monotone ramp**, so one line reaches helices, conical spirals and
spherical spirals that the generator cannot otherwise draw at any winding. The result is an arc with two
free ends, where everything else in the library is a closed loop oscillating in place. The `Open figure`
facet reads these three scalars and nothing else.

⚠️ **Nothing auto-fits it, which is why the bound is a constant and not a measurement.** `project()`
multiplies by a `waveScale` fixed from the design box at `init()`, and **no code anywhere measures the
curve's own extent** — so a secular term can walk the figure out of frame and no fit will catch it.
`TRAVEL_MAX` is the only thing between the control and a figure nobody can see.

⚠️ **It is added after the wave sum and after Grow, and before every operator in §1.3**, so the
deformers see the travelled position: a twist of a helix is a twisted helix rather than a twisted loop
that is then slid. Each axis is tested against zero on its own rather than only the triple, so an axis
that is off is *skipped* — the claim is that the code does not execute, which is stronger than
arithmetic that happens to be inert, and `−0` makes the difference reachable.

⚠️⚠️ **THE COLOUR SEAM AT THE OPEN END IS CORRECT AND WILL BE READ AS A DEFECT.** The colour law wraps
— it is periodic in the particle index — and a closed loop hides that wrap because its two ends meet.
An open curve does not, so the hue jumps where the arc stops. **The local fix is `paletteMapping:
'index'`**, which maps the palette once across the population instead of cycling it, and turns the seam
into a gradient that runs from one free end to the other. **Nothing about the colour law is changed to
accommodate this**: un-wrapping it globally would alter every closed figure in the library.

#### The DC term — Offset

**Offset** adds a constant to each axis, identical for every particle, in the same design half-extents
`Travel` uses:

```
  x(i) += o_x · halfExtent
```

one constant `o` per axis, bounded by `OFFSET_MAX = 2.0`. It reads no position and no index, so unlike
the taper and the bend it creates no axis order to get wrong, and the translation is exact.

⚠️⚠️ **ITS ENTIRE VALUE IS IN THE MOTION, NOT IN THE POSITION.** A still frame of an offset figure is
just a figure that is off centre. **The engine rotates about the model origin** ([§4.1](#41-scale-then-rotation)),
so every figure in the library spins *in place*; an offset is the term that spin is taken about, and it
turns the spin into an **orbit**. At about one figure radius a ball opens into a torus with a hole;
at about 2.6 radii it becomes a wide wreath.

⚠️ **`OFFSET_MAX` is a REACH, not a fitting bound, and that is a different kind of number from
`TRAVEL_MAX`.** Measured on the same median-amplitude host: `travelX` at `TRAVEL_MAX` puts **0.0 %** of
the figure off-frame, while `offsetX` at `OFFSET_MAX` puts **76.9 %** off. A fitting bound is impossible
here because the canvas fit maps the design box onto the canvas's *shorter* dimension, so one
half-extent is about the half-height and the largest framed offset is ~1.0 on x against ~0.5 on y —
**one constant cannot be both**, and a canvas-derived constant would be a bound a preset cannot
compensate for. The usable band is well below the bound.

⚠️ **It is excluded from the Randomiser by decision.** A random offset breaks the centring every preset
relies on and every rotation is taken about, so the result reads as the Randomiser being broken rather
than as variety.

⚠️⚠️ **ON Z, OFFSET AND TRAVEL COMPOSE TOWARD THE PERSPECTIVE DIVIDE, AND THE HAZARD IS REACHABLE
INSIDE THE CONTROL'S OWN RANGE.** `project()` divides by `q = z·scale − perspectiveZ` and answers a cull
sentinel for `q ≤ 0` ([§4.2](#42-perspective-projection)), so a particle pushed far enough back passes
*behind* the camera and is dropped. At 1440×900 on a 100×100 design box the perspective-factor clamp
bites at −2.47 half-extents and the cull at −2.60 — **`offsetZ: −2` alone sits at 77 % of the cull
depth.** The guard is a **readout** rather than a clamp: the row prints how far the figure's own deepest
point reaches toward the cull, as a percentage, and says that past 100 % the far particles are dropped.

⚠️⚠️ **BOTH QUANTITIES ARE CANVAS-DEPENDENT, SO THE SAME PRESET IS SAFE ON ONE WINDOW AND CLIPS ON
ANOTHER.** `perspectiveZ = −(cw + ch)/2` and the canvas fit both move with the window, so the depth at
which a particle is dropped — expressed in model units — moves too. That is why the sentence names the
window instead of implying a safe value, and why the percentage is recomputed rather than cached. **A
culled particle reads as a streak leaving the screen, never as a clamp.**

⚠️ **The readout is gated on the operator's own identity, not on a mode**, because there is no
perspective switch to gate on: the divide runs unconditionally. So it says nothing while `offsetZ` and
`travelZ` are both 0, or it would print a number about every preset in the library and become noise.
⚠️ **Stated limit: a bare window resize does not repaint it.** It is recomputed on every control
interaction, preset change and re-show of the tab, but nothing in that panel observes the canvas —
adding a listener there would be a second owner of "the canvas changed". The number is late, never
stale, and the sentence says the limit depends on the window precisely so that a reader who resizes
knows to expect a different answer.

⚠️ **It is not a member of the `Deformed` facet**: a rigid translation is not a deformation.

#### Breathing — the four operators that cycle

Each of the four figure operators above carries a **depth** and a **rate**, which make its value cycle
over time instead of holding still. The resolution is one expression, evaluated **once per frame** and
never per particle:

```
  value(t) = clamp( base + sin( t · rate / DEG ) · depth ,  lo ,  hi )
```

where `t` is the figure's animation phase (so the rate inherits both the preset's own sweep speed and
the master Speed factor), and `lo`/`hi` are the operator's own range.

| Operator | Its breathing | Depth ceiling | Keys |
|---|---|---|---|
| **Sharpness** | **Temper** | half of `[0, SHARPNESS_MAX]` | **one depth and one rate for all three slots** — they breathe together on one cycle |
| **Travel** | **Stretch** | half-width of `[−TRAVEL_MAX, +TRAVEL_MAX]` | one depth and one rate **per axis** |
| **Offset** | **Sway** | half-width of `[−OFFSET_MAX, +OFFSET_MAX]` | one depth and one rate **per axis** |
| **Grow** | **Flare** | half-width of the asymmetric `[GROW_FLOOR, GROW_MAX]` | one depth and one rate **per axis** |

**Every depth ceiling is derived, never typed: it is its base range's half-width**, which is the largest
depth that can reach every value in the range. A larger one would buy only dwell duration, and a dwell
is better set by moving the base toward a bound. Deriving is what stops a widened base range silently
leaving its depth behind.

**Every depth is signed**, and a sign is not redundant with the rate: it is the only way to put two
axes in **antiphase** at one rate.

⚠️⚠️ **THE CLAMP IS ON THE RESOLVED VALUE, WHICH PRODUCES A DWELL AT EACH BOUND — AND THE DWELL IS A
FEATURE.** A swing that would pass either end of the range stops there, so the cycle becomes *move,
hold, move back, hold* — for `Temper`, crystallise, hold, melt, hold. **Every one of the four readouts
prints `(clipped)` while a dwell is active**, or the next reader removes the pause as a stuck slider.
The rejected alternative was to constrain the UI so `base ± depth` stays in range, which would make a
depth slider's maximum depend on a base slider's value: two interdependent controls for one quantity.

⚠️ **`depth = 0` skips the modulator entirely rather than adding `sin(x)·0`.** The operators sit on the
identity of every preset in the library, and `base + sin(x)·0` is `base` for every finite base *except*
`−0`. **At `depth = 0` the base is also returned without passing through the clamp**, which is
required rather than sloppy: every setter has already clamped its own base, and `Math.max(0, −0)` is
`+0`, so clamping an identity would break bit-exactness for `Sharpness` alone — the one operator whose
lower bound *is* 0.

⚠️ **The temporal function stays sinusoidal and must never take the `Sharpness` blend.** A triangle
there would make the breathing's own motion piecewise-linear, which is a different control, and it would
make the dwell indistinguishable from the ramp into it.

**The rate.** `rate = 0` means *never cycles* and is the operator's identity; it is reachable exactly,
because the track quantises its bottom few per cent to zero. Above that the track is **geometric** over
`OP_RATE_MIN` … `OP_RATE_MAX` = 0.4 … 60, a span of 150× or 7.2 octaves, so halving a period costs the
same travel as doubling it. ⚠️ **The readout is a period in seconds, and it is nominal**: the period is
`6 / (rate · waveSpeed)`, so it moves when either the preset's own sweep speed or the master Speed
factor moves. At the library's median `waveSpeed` of 0.05 that is `120 / rate` seconds — 2 s at the
ceiling, 300 s at the floor. Where the sweep speed is 0 there is no period at all, and the honest
answer is that the figure's modulators are frozen rather than that the control is off.

⚠️ **A non-zero rate below the floor is raised to the floor rather than snapped to zero**, because the
two are different claims: 0 means *this never breathes*, while a hand-edited 0.01 means *a cycle the
author wanted and the track cannot represent*.

⚠️ **The rate track is the only one of these whose mix law and whose track deliberately disagree.** The
track is geometric; the interpolation law is linear, because a geometric mix is `exp(…·ln a + …·ln b)`
and `ln 0` is `−∞` — **a key whose identity is 0 cannot have a geometric mix law.** Do not "fix" one
half to match the other.

#### One law, two readers

⚠️⚠️ **EVERYTHING IN THIS SECTION — the phase arithmetic, the triangle basis, the sine-toward-triangle
blend, the per-axis summation, the amplitude ramp and both translation terms — HAS EXACTLY ONE OWNER,
AND THERE ARE TWO READERS OF IT.** The generator renders the figure; the Composer's **Score** draws the
diagram an author reads *while authoring*. They must agree, because a Score that draws a different
curve from the one the engine renders is worse than no diagram.

**They are not two correct copies — they are one function called twice**, which is the only arrangement
that cannot drift. The two differ in exactly one respect, and it is a parameter rather than a
divergence: the ramp and the secular term are driven by `τ`, the element's **fraction** along the sweep,
not by its index — because the generator samples tens of thousands of particles and the diagram a few
thousand points, and only the fraction is common to both.

⚠️ **The Score is passed the four operators' BASES and deliberately not their breathing**, because
`computeScore` takes no `time` at all — *instantaneous amplitude is not amplitude* — and a breathing
operator has no value without an instant. **The bases are not an approximation of the breathing figure:
they are exactly what the resolver returns at the phase origin**, where `sin(0) = 0`. Adding depth and
rate to the bundle would mean choosing an instant, and the standing rule is that the instant must never
become a parameter.

⚠️ **The three sharpness levels are passed explicitly rather than left to default**, because the
engine's read-back is already backfilled: it returns the three *resolved* values, so passing them is a
copy of engine state rather than a second resolution of `?? sharpness`.

⚠️ **Adding an operator to the generator is therefore a TWO-file edit**, and the second file is this
bundle. The Score's auto-fit is what makes a missed one hard to see on `Offset` in particular: it fits
its own box, so an offset alone moves the drawn curve and the fit moves it back.

⚠️ **The law takes already-resolved per-frame numbers and deliberately does *not* own the modulator**
(`base + sin(t·freq/DEG)·amp` — [§1.2](#12-modulation-pulse-and-wobble)). Three copies of that
*parameter shape* exist with a translating step between two of them, and that translating step is where
missing-field defaulting lives, so folding the modulator in would move behaviour on any preset with an
absent field.

### 1.2 Modulation: Pulse and Wobble

Two of the seven stored values per axis are **time modulations**, evaluated per frame rather than per
particle. They are what make a PSSS figure look alive rather than merely rotating.

**Pulse modulates the amplitude** — the figure breathes:

```
  A(t) = A + P · sin( t · rP / DEG )
```

where `P` is `Pulse` and `rP` is `Pulse rate`. The UI also exposes this pair in plain units: a **depth
as a percentage of `A`** and a **period in seconds**. A depth over 100 % drives `A` through zero and
negative, which inverts that axis each cycle — several library presets do this deliberately.

**Wobble modulates the winding** — the figure re-wraps:

```
  f(t) = f + W · sin( t · rW / DEG )
```

with `W` as `Wobble` and `rW` as `Wobble rate`. Because the winding is what decides how many times the
curve wraps, a wobbling winding means the knot is continuously re-drawn into a different one. **A wave
can wind entirely by wobbling**, with `Winding` at 0 and `W` above 0: then the axis has no fixed wrap
count at all, only the one the wobble gives it at that instant.

> At a modulation depth of zero the corresponding rate does nothing whatever it is set to. The two
> modulations are independent per axis, so a figure can breathe on one axis while re-wrapping on
> another.

**Periodicity.** The whole wave is periodic only if the live rates are commensurate — in which case the
Composer prints `repeats every N s`. If they are not, there is no single period and it prints
`slowest cycle N s` instead. This matters for any readout that samples one instant of a periodic
quantity, which is why the Score's envelope traces exist.

### 1.3 Model-space operators

**Eight operators act on the figure in model space, after every displacement field and before the
rotation** — the 4D rotation, twist, taper, bend, spherical inversion, box-fold, the Fractal Fold and the
symmetry fold.
They are a different kind of thing from the six field systems: a field adds a displacement **to** a
point, while these are functions **of** the point — so they compose with every field for free, and the
result reads as a solid being deformed rather than as an image being distorted.

```
  waves + secular term → attractor blend → the five positional-nudge fields
        → 4D rotation → Twist → Taper + Bend → Inversion
        → Box-fold → Fractal Fold → Symmetry fold → 3-D Symmetry   ← this stage, in order
        → modelPos snapshot (crystals nucleate HERE)
        → 3D rotation → perspective projection
```

**The 4D rotation runs FIRST because it produces the `xyz` every later operator reads.**

Two consequences of that position, and both are load-bearing:

- **The crystal pool nucleates on the deformed figure**, because `modelPos` is snapshotted after the stage.
  Crystals appear inside the folded architecture rather than on the shape it was folded from.
- **The deformation is a property of the FIGURE, so it tumbles as a rigid solid.** A screen-space
  kaleidoscope — which is what the Translation Map's own `Kaleidoscope` gives — produces flat overlapping
  ghosts pinned to the viewport instead.

⚠️ **Symmetry is deliberately LAST, so symmetry is the outermost property.** A folded rosette stays a
rosette whose arms are identically twisted; running a deformation after the fold would break the symmetry
it had just been given.

#### Twist

**Twist** rotates the plane perpendicular to each axis by an angle proportional to the coordinate along
it — `θ = k·z` about Z, and the analogues about X and Y. Each axis leaves **its own** coordinate untouched,
which is what makes all three depth-safe.

```
  x' = x·cos(k·z) − y·sin(k·z)        y' = x·sin(k·z) + y·cos(k·z)        z' = z
```

The unit is **turns per half-extent of the design box**, derived rather than picked, so one turn means the
same thing at every Figure Scale and on every canvas. The axes compose **X then Y then Z**, and that order
is part of the contract: rotations do not commute, so a preset is portable only while the order is fixed.

⚠️ **Its Jacobian determinant is exactly 1**, so it creates and destroys no light and changes no splat's
size or shape. ⚠️ **That does NOT mean the frame's brightness is unchanged** — winding the figure spreads
it over more of the frame, so the same light lands on more pixels. Measured on `Pipes` at Twist Z +0.50:
mean luminance 93.9 → 141.6 while near-clipped pixels *fell* 7.52 % → 1.85 %. **A model-space volume ratio
and a screen-space coverage statistic are two quantities.**

⚠️ **It reads z, so on a planar figure it correctly does nothing** — 68 of the library's 325 preset
bodies, a fifth of it, have zero z amplitude.

#### Box-fold

**Box-fold** reflects any coordinate that strays outside a cell back inside it, optionally scaling between
iterations:

```
  for each of x, y:   if c >  L:  c := 2L − c
                      if c < −L:  c := −2L − c
```

⚠️ **It is the engine's only MANY-TO-ONE coordinate map, and that is the whole feature.** Every other
operator here — every field, every Translation Map style, the twist above — is one-to-one: it moves a point
somewhere else. A fold sends separate stretches of one curve to the same place, so **density piles up at
the fold planes, and density is brightness in an additive renderer.** The architecture therefore arrives
**lit at its seams**. No amount of added displacement can produce a seam.

⚠️ **The reflection is CONTINUOUS at the cell wall** (`2L − L = L`), which is what keeps it clear of the
three teleport guards the modular form would trip. **There is no wrap variant and there must never be one.**

⚠️ **Z IS NOT FOLDED.** Folding the depth axis inverts the depth order of every pair straddling a fold
plane — measured at **61–100 %** of sampled pairs against a 10 % bound, across all 164 strong-z bodies and
every cell size and iteration count. A reflection does not *perturb* an ordering, it **reverses** it
wholesale for the reflected region, so no parameter is safe. The cell is XY only.

⚠️ **Iterations is the gate, and the cap of 4 is Hart's composition rule rather than cost.** Iteration is
composition, so n folds multiply the Lipschitz bound geometrically while costing about six arithmetic
operations each — cheap in ALU is exactly the trap. **`Fold Scale` ≠ 1 changes brightness, uncompensated,
and that is correct**: compressing a figure genuinely does put more particles in a pixel.

#### Taper and bend

**Taper** scales the figure's cross-section by a function of position along an axis; **bend** curves the
axis itself. With `u` the coordinate normalised by the design half-extent, one factor per axis:

```
  taper   s(u) = 1 + t·u          clamped below at TAPER_MIN_FACTOR
  bend    b(u) = 1 − k·u          clamped below at BEND_MARGIN
```

All six factors are evaluated from the **pre-deformation** position and multiplied, so the stage is
order-free. That is a deliberate departure from composing three Barr maps sequentially, which would not
commute — taper-x would read an `x` that taper-z had already scaled — and would therefore need a declared
axis order. The 4D rotation above already carries one such order contract, and a second invisible ordering
in the same stage is how a preset stops being portable.

⚠️ **These are the first model-space operators whose determinant is not 1, and that is the whole difference
from the twist.** Barr gives the determinant per deformation:

| deformation | det **J** | luminance in an additive renderer |
|---|---|---|
| twisting, θ = f(z) | **1** | none — exactly energy-neutral |
| tapering, r = f(z) | r² | ∝ 1/r² — unbounded as r → 0 |
| bending, rate k | 1 − k·z | ∝ 1/(1 − k·z) — singular at the centre of curvature |

So the twist needed no compensation and these two cannot do without one. The correction multiplies
intensity by `det J = (s_x·s_y·s_z)² · (b_x·b_y·b_z)` — the taper factors squared because taper scales a
cross-section, the bend factors linear — and it travels through the **per-particle size channel**, which is
already the one owner of that multiplier.

⚠️ **The clamps are what make the operators shippable, and they are clamps rather than ranges.** Each
factor is floored, the composed product is floored again, and the sliders' own travel cannot reach the
singularity. Past zero Barr's map is *everted*: the region beyond the centre of curvature turns inside out,
which is the geometric face of the same failure the luminance sees as an unbounded value. An unbounded
value here would reach a tone map that is NaN at infinity, through a trail buffer whose fade *multiplies* —
so it could never be cleared by any number of later frames.

⚠️ **The compensation SATURATES at extreme settings rather than tracking `det J` exactly.** The raw product
reaches ×15.6 at full taper, while the size channel's consumers are calibrated for a ratio span of 5 and
the driver clips anything past the point-size ceiling. Bounding it to the vehicle's own span keeps one
calibration instead of two; beyond it the correction is incomplete, which is a stated limit.

#### Spherical inversion

**Inversion** reflects every point through a sphere of radius `R`: a point at distance `r` moves to `R²/r`
along the same ray, so near becomes far and the centre explodes outward. It is lerped from the identity by
an amount, and the radius it divides by is floored as a fraction of the figure's half-extent — a magnitude
guard rather than a float epsilon, since the centre of the map is a true pole and a vertex at infinity is
dropped outright by the driver, which reaches the user as a *missing* particle rather than a broken one.

⚠️ **This is the same formula as Translation Map's `Inverse 1/z` conformal map, and the difference is where
it acts.** That one runs after the projection, where depth has already been discarded; this one runs
before, so it also reorders which particles are in front — depth shading, the volume mode's absorption and
the liquid surface's occlusion all read differently under it.

⚠️ **It ships because the measurement licensed it, and the measurement replaced a falsified bound.** A bare
10 % depth-inversion bound condemns the engine's own 90° pose rotation on every strong-z body, so it is not
a shipping gate. The discriminating property is inversion **with no change to the projected image** — which
is what the removed z box-fold was, at 67 % inversion and 0 % image change. Measured over 174 strong-z
bodies at three instants, full-strength inversion trips that rule on 31 bodies while the shipped pose
rotations trip it on 39 and 65. It is the loudest operator in the stage, not the quietest: 19.6 % mean
depth inversion against a mean image change of 102.6 % of the figure's own width.

⚠️ **The amount lerp is the only control that bounds the depth effect** — at 0.3 no body fails the rule.
Restricting the map to an outer shell, which the study proposed for exactly this purpose, was measured
failing the discriminator on the same 31 bodies as no restriction at all: a figure spanning the design
extent has most of its particles outside any such shell. **A control whose rationale is falsified is
worse than no control**, so the amount is the one that carries the guarantee.

#### Fractal Fold

**The Fractal Fold** iterates the Mandelbox step — a box fold, a ball fold and a scale — with a **feedback** term
that adds the particle's own position back after every iteration. Without the feedback, repeating a fold only
reflects the figure again; with it, each iteration is re-anchored to where the point started, so detail nests
inside detail and a plain figure becomes self-similar structure. Per iteration, on X and Y only:

```
  box fold    x, y:  |x| > L  →  x = sign(x)·2L − x
  ball fold   r² = x² + y²:  r² < (L/2)²  →  (x, y) ·= 4 ;   r² < L²  →  (x, y) ·= L²/r²
  scale       (x, y) ·= s
  feedback    (x, y) += (x₀, y₀)
```

- **Iterations** 1–3 are the operator's gate (0 skips the stage entirely, bit-exact). The ball fold's two radii
  are tied to the cell (`L/2` and `L`), so three of the Mandelbox's constants are one control.
- **Z is never folded, scaled or moved.** Folding depth was measured through the engine over 204 strongly
  three-dimensional presets: at about a third of the settings in range it swapped near and far while the
  picture barely changed — the pattern that also keeps z out of the box fold — and no range of the scale
  avoided it. With z untouched, depth order is preserved by construction.
- **The unit is the figure's own size.** The cell `L` and the whole fold work in units of the unfolded
  figure's XY RMS radius, measured every frame from the INPUT. Measured against the design box instead, the
  compensated size varied from a tenth to eighty-five times across the library, because the fold's growth
  depends on how large a figure is relative to the cell. The input's size changes only when the figure itself
  moves, so animating a fold setting never makes the figure pulse in size.
- **The figure keeps its size.** The fold grows a figure by a factor that depends strongly on the settings and
  weakly on the figure, so the result is divided by a growth measured through the engine over 24 library
  presets and interpolated over iterations × cell × scale. The median residual is 1.00 and most figures land
  within ±6 % of their unfolded size; at the extreme setting the worst figure lands between 0.4× and 1.3× of it. A logarithmic radial limiter beyond 2.5×
  the figure's radius pulls the few far-flung points back onto the canvas, point by point.
- **Scale 0 is a second exact identity** (the law reduces to `x = x₀`) with a dead zone around it; negative
  scales are in range and often give the most striking shapes.
- **Cell and scale breathe**: each has a signed depth and a rate on the same convention as the other breathing
  operators; a depth of 0 is exact. In the Mixer the iteration count snaps and the rest lerp; the Randomiser does
  not roll them. The preview tiles apply it.
- It runs after the box fold and before the symmetry folds, so a symmetric figure is folded first and then
  repeated.

#### 4D rotation

**The figure is treated as a slice of a four-dimensional object**, with each particle's position along the
curve lifted into a fourth coordinate:

```
  lift:     w = sin(pi · winding · u) · halfExtent · wScale        u = 2i/count − 1
  rotate:   in the x-w, y-w and z-w planes, three angles, in that order
  project:  p' = p · d / (d − w)        d = 3 · halfExtent
```

⚠️ **The lift is PERIODIC in the curve parameter, and that is what separates this operator from a 3D
one.** A single monotone ramp makes `w` nearly a function of POSITION — measured, only 0.00–0.32 % of
particle pairs that are far apart in index sit at the same place on any library figure — and rotating a
coordinate that is a function of position is a 3D deformation wearing a fourth axis. With `winding` the
coordinate reverses along the curve, so successive stretches are pushed in opposite directions and the
strands cross. **The winding is an integer: a fraction does not close, and a closed figure tears at the
seam.**

**The fourth coordinate is the curve parameter, which is the most on-identity choice available** — the
figure *is* a curve traced by a parameter, so lifting that parameter generalises the engine's own premise.
It is also what makes the pass-through lawful: two particles at the same `xyz` can differ in `w`, which no
function of position can give.

**Only the three planes that involve `w` are exposed.** The `xy`, `xz` and `yz` planes are the ordinary 3D
**Rotation** control; offering them here would be two controls for one quantity.

⚠️ **Its Jacobian determinant is NOT 1 — a 4D rotation preserves 4-volume and the 3D projection does
not** — so density, and therefore brightness, changes, uncompensated and correctly. The splat quad's own
area normalisation is a different quantity and does not apply.

⚠️ **The perspective denominator is floored by a bound on MAGNIFICATION, not by a float epsilon.** `d/(d−w)`
is unbounded as `w → d`, and an `x-w` rotation mixes `x` into `w`, so the post-rotation `w` is bounded by
the figure's own radius — which no constant can know in advance. The floor is a quarter of `d`, capping the
magnification at 4×, so an extreme pose cannot fling one particle across the frame.

#### Depth ordering

**Two of these seven operators reorder depth, and whether that is a defect turns on one measurement.**

A z-axis box-fold was built and removed: it inverted 56 % of sampled depth pairs **while changing the
projected image by 0.0 %**. The figure looked identical and every depth cue — the depth palette, parallax,
depth of field, liquid occlusion — silently reversed. That is what makes an inversion a defect.

The inversion rate alone does not say so. Measured over the strong-z library, the engine's own 3D pose
rotation at 90° inverts **58 %** of pairs, and it is the oldest correct control in the engine. What
separates the two is the second quantity:

| operator | depth pairs inverted | image change |
|---|---|---|
| z box-fold (removed) | 67 % | **0 %** |
| 4D extent, no angle | 6 % | 4 % |
| 3D pose rotation, 90° | 58 % | 25 % |
| 4D rotation, all three planes | 43 % | 31 % |

**An operator may reorder depth in proportion to how much it reorders the image** — then the new ordering
is self-explanatory, because the figure visibly turned. The removed fold is the only operator measured that
inverts depth while leaving the image alone.

#### Symmetry

**Symmetry** folds the figure into `k` identical sectors **in model space** — before rotation, so the
symmetry axis tumbles with the figure instead of being pinned to the screen. The fold is applied to the
particle's angular coordinate about the model origin:

```
  θ' = (θ mod 2π/k)          with the sector index discarded
```

Only whole `k` are meaningful: a fractional fold produces a figure whose arms do not close. Because the
same `N` particles are divided between `k` arms, **each arm carries `N/k` of the density** — raising
Symmetry thins the figure unless the particle count is raised with it. **Mirror**, available once
`k > 1`, alternates the handedness of successive sectors, turning a pinwheel into a true reflection
pattern.

#### 3-D Symmetry

**3-D Symmetry** REPLICATES the figure around the centre, as the last model-space stage after the 2-D fold. Its
copies are **positions × copies at each position**, and the two factors are set independently. A solid's symmetry
group always factors this way (orbit × stabiliser: the cube's 24 rotations towards a vertex are 8 vertices × 3
turns), so a group alone fixes both numbers; setting them separately reaches every count in between. Copy `c`
has a unit position `d_c` and an orientation `M_c`; particle `i` is copy `c = i mod C`, moved `r · h` along its
position (`h` = half the design box's shorter side, `r` = Radius) and scaled by `1 / (1 + r)`:

```
  p' = (M_c · p + r · h · d_c) / (1 + r)        c = i mod C,  C = positions × copies at each
```

- ⚠️ **Replicate, never fold.** A fold maps each point into one fundamental region, which cuts the curve at
  every mirror plane — a solid has many, and a 3-D fold reads as the figure chopped into multiplied line
  segments. Replication keeps every copy whole; the copy index is a fixed function of `i`, so no particle
  ever jumps between copies (nothing trips the teleport guards downstream).
- **The positions.** A **Ring** of n is exact (`2πj/n` on the equator). A **Sphere** of n is a Fibonacci spiral,
  even but not symmetric, because most n have no symmetric arrangement on a sphere. A **solid's** vertices, edge
  midpoints or face centres are the exact ORBIT of one axis under the solid's rotation group, built once by
  closure from generators: T for the tetrahedron (4 / 6 / 4), O for the cube (8 / 12 / 6) and the octahedron
  (6 / 12 / 8), I for the icosahedron (12 / 30 / 20) and the dodecahedron (20 / 30 / 12). Duals share a group and
  swap axes, so the octahedron's vertices are the cube's face centres. The order is deterministic, so a
  particle's copy never changes between frames or sessions.
- **The orientation.** `M_c = F_p · L_k`: `L_k` turns copy `k` of a position by `2πk / (copies at each)` about z
  and, with **Mirrors**, reflects every second one (y → −y). `F_p` is the facing: **Outward** is the minimal
  rotation taking z to the position (a half-turn about x for −z), so the local turns happen about the radial
  axis; **Parallel** is the identity.
- **Radius** reaches 3 half-extents: a figure is itself about one half-extent in radius, so below about 1.5
  neighbouring copies overlap and above it they separate. The `1 / (1 + r)` fit keeps the arrangement at the
  figure's size.
- **Density divides by C.** The row's notice multiplies the two factors out and states the particles each copy
  gets, and from 24 copies it says the figure thins; the particle count is never raised automatically.
- **Off is a branch** — the stage does not run — so a preset without the keys is bit-identical. In the Mixer
  the arrangement, counts, mirrors and facing snap at the midpoint and the radius lerps; the Randomiser does
  not roll them. The preview tiles apply it, so a tile shows the same arrangement as the main view.

### 1.4 Strange attractors

An attractor **replaces the wave curve** as the source of positions, keeping everything downstream —
fields, colour, rendering, grading — unchanged. The **Blend** control interpolates between the two
sources:

```
  p = (1 − β) · p_wave + β · p_attractor
```

At `β = 0` the preset is untouched; at `β = 1` the waves are gone. Blend also fades the Translation Map
warp as it rises, so a mid value gives an attractor that still carries the preset's character.

The thirty-five attractor presets are drawn from **three mathematically distinct families**, and the
difference between them explains their very different visual behaviour. **Appendix A.1 lists all
thirty-five by family.**

#### 1.4.1 Continuous systems — integrated ODEs

Each particle holds its own `(x, y, z)` state and integrates a system of ordinary differential
equations with **forward Euler** at a per-frame step `dt`:

```
  p ← p + ṗ(p) · dt
```

| System | Equations |
|---|---|
| **Lorenz** | `ẋ = σ(y − x)`,  `ẏ = x(ρ − z) − y`,  `ż = xy − βz` |
| **Rössler** | `ẋ = −y − z`,  `ẏ = x + ay`,  `ż = b + z(x − c)` |
| **Thomas** | `ẋ = sin y − bx`,  `ẏ = sin z − by`,  `ż = sin x − bz` |
| **Halvorsen** | `ẋ = −ax − 4y − 4z − y²`, and the two cyclic permutations of it |
| **Aizawa** | `ẋ = (z − b)x − dy`,  `ẏ = dx + (z − b)y`,  `ż = c + az − z³/3 − (x² + y²)(1 + ez) + f·z·x³` |
| **Nosé–Hoover** | `ẋ = y`,  `ẏ = −x + yz`,  `ż = a − y²` |

> ⚠️ **Forward Euler diverges, and the engine reseeds rather than clamps.** A particle whose state
> leaves the system's basin is given a fresh start offset deterministically from its own index — not
> from a random number, which would make the figure flicker differently on every machine. Halvorsen in
> particular carries an explicit escape radius: a step that would take `‖p‖` beyond it is rejected and
> the particle reseeded.

#### 1.4.2 Discrete maps

Two families are **2D maps**, not ODEs: the next position is a direct function of the current one, with
no time step at all.

| Map | Iteration |
|---|---|
| **Clifford** | `x' = sin(a·y) + c·cos(a·x)`,  `y' = sin(b·x) + d·cos(b·y)` |
| **De Jong** | `x' = sin(a·y) − cos(b·x)`,  `y' = sin(c·x) − cos(d·y)` |

Neither ever assigns `z`, so both are **flat** figures — they live in a plane and gain their apparent
depth only from the rotation in stage 4.

> **The flicker of these two families is intrinsic.** A discrete map jumps; consecutive iterations are
> not neighbours, so the point cloud re-scatters every step rather than flowing. That is the
> mathematics, not a rendering defect.

#### 1.4.3 Escape-time sets — Julia and Mandelbrot

These are not dynamical trajectories but **set-membership tests**. For a complex `c` and `z₀`, iterate

```
  z ← z² + c
```

and count the iterations until `|z| > 2` (the escape radius). For the **Mandelbrot** set `z₀ = 0` and
`c` is the point being tested; for a **Julia** set `c` is fixed per preset and `z₀` is the point.

Particles are distributed over a window of the complex plane and placed according to that test, with a
**smooth (continuous) escape count** so the bands do not quantise. Two engine-specific properties:

- **The iteration ceiling is adaptive.** `computeAdaptiveMaxIter(bounds)` derives it from the window:
  a deep zoom needs far more iterations than a wide view to resolve the same boundary detail. ⚠️ **A
  preset's own stored `maxIter` is not read** — the adaptive value governs, and the grid cache is keyed
  on it.
- **Escape time is not a coordinate.** The count says *how quickly* a point left, not *where* it went,
  so it cannot be used as a position; it selects and shades, and the position comes from the sample
  grid.

**Two foliations of one field.** A particle's step is taken from the gradient of the smooth escape count,
and **Flow** chooses which of the two orthogonal directions it follows:

```
  Contours      step ∝ (−g_y,  g_x) / |∇|      the level-set TANGENT
  Field lines   step ∝ ( g_x,  g_y) / |∇|      the GRADIENT
```

Under *Contours* a particle slides along an iso-contour — and because the smooth escape count is a
monotone function of the Douady–Hubbard potential, those contours are its **equipotentials**. Under
⚠️⚠️ **`'ray'` HAS NO CONTROL SINCE 2026-11-01 (owner) AND THE CODE BELOW IS STILL LIVE — the two
statements are both true and the gap between them is the point.** The Visual FX `Flow` row was
removed because the field lines get **swallowed at the boundary** (`33.22`'s replenishment defect:
seeds respawning into cells with no inward path, and every surviving ray ending in an exact
two-point oscillation). **`escapeFlow` stays a live type member, `main.ts` still adopts it from a
preset and still gates it into an export, and the branch below still runs — so an imported body
that authors `'ray'` renders as rays.** ⚠️ **No shipped preset authors it any longer**: the three
that did were converted to contours and renamed in the same sitting, so this path is reachable
only by hand and is demonstrated by nothing.

*Field lines* the particle climbs the field instead of circling it, so the population reads as radial
filaments converging on the set's boundary rather than as contour lines wrapping it.

⚠️ **The gradient foliation is not an external-ray tracer and must not be read as one.** The grid is
low-pass filtered — three 3×3 passes over a 512² sampling — so the field is a smoothed potential and its
gradient lines diverge from true external rays by more than the sampling alone implies. It is a new
visual family, not the exact mathematical object.

⚠️ **The step length is the same in both**, deliberately: it was chosen so that a contour-follower stays
glued to its contour. A ray wants no such thing, but lengthening the step for it would make the two modes
differ in two variables at once and nothing downstream could attribute a change to either. The visible
consequence is that **field lines leave the sampling window far more often**, so more particles respawn
each frame and the figure is grainier.

⚠️ **The control acts only here.** Julia and Mandelbrot are the only two sources that build an escape
grid, so on the other eight attractor types the control is **inert** rather than hidden — the
asymmetry with the escape-time channel driver below is deliberate: an inert control produces the right
picture, a driver reading an absent field would produce a wrong one, and only the second justifies
hiding.

**The escape count is also published per particle**, normalised to `[0, 1]`, as a **driver for the
per-particle size, alpha and lightness channels** — so the fractal's own quantity, *distance from the
set*, can reach the image as brightness or size and not only as position. The array is allocated and
grown with its siblings on every preset, but it only *means* anything on the two escape-time types, so
the driver resolves once per frame against `hasEscapeField` and falls back to the curve index where there
is no field. ⚠️ **A length test alone would pass on every preset and drive the channels from stale
zeros**, which is why the predicate is the attractor's type and its blend rather than the buffer's size.
The same predicate decides whether the option is offered in the Lab at all, so the UI and the generator
cannot disagree about whether it is usable.

> **No respawn distribution rescues a window that lies inside the set.** If every sampled point is a
> member, nothing escapes, and the figure is a solid block. The thirty-five presets include specific
> named windows — *Seahorse Valley*, *Elephant Valley*, *Mini-brot* and so on — precisely because the
> interesting structure is at the boundary and has to be aimed at.

#### 1.4.4 Fitting an attractor into the figure's space

Every family produces coordinates on its own scale — Lorenz spans tens of units, Clifford barely two.
Each is **normalised to ±1 and then fitted to a fraction of the design box**, so that switching
attractors does not change how much of the frame is filled. The bounds are computed by sampling and
**reused by tolerance**: a small change in the window reuses the existing grid rather than rebuilding
it. ⚠️ That reuse is **a correctness requirement, not an optimisation** — a crossfade between two
windows lerps the bounds, and a rebuild mid-fade would jump.

### 1.5 Extra populations

Two optional populations are **born** at this stage, from the figure's own particles, and drawn later in
stage 5. Both are **additive**: they never remove a particle from the figure.

- **Sparks** (Materials) — ejected from particles whose temperature passes a threshold, then
  integrated as ballistic bodies with gravity, drag, a lifetime and their own cooling.
- **Crystals** (Materials) — nucleated on particles that satisfy a birth rule (`slow`, `cold` or
  `random`), then grown, held and melted on their own clock. A crystal stores a **model-space**
  position, which is what keeps it attached to the figure through the rotation in stage 4.

The pool slot order is `[wave][sparks][liquid][crystals]`, and the liquid pool was **inserted** into
that order rather than appended — worth knowing if you are reading index arithmetic in the source.

---

### 1.6 Self-similar curves

Stage 1's second figure source. A preset selects it with `generators.type: 'lsystem'`, and its parameters
live in `generators.lsystem`.

#### The model

A **production system** plus a **3-D turtle**. The production is a set of string rewrite rules; applying
them `n` times to an axiom gives a long symbol string, and the turtle walks that string, emitting a point
every time it steps forward. `F` and `G` draw; `f` moves without drawing; `+`/`-` turn about the turtle's
up axis (**yaw**), `&`/`^` about its left axis (**pitch**), `<`/`/` and `>`/`\` about its heading
(**roll**); `|` turns around; `[` and `]` push and pop.

This is to self-similar curves what the Fourier sum is to smooth closed ones: one model, a small
parameter set, an open-ended family.

| Fourier model | Turtle model |
|---|---|
| three slots per axis | a production rule |
| per slot: size, winding, phase | per symbol: a yaw, pitch or roll turn |
| windings choose the figure's identity | the **rule** chooses the figure's identity |
| modulation animates it | the **angles** animate it |

⚠️ **The angle is not part of the rule, and that is the property the whole type rests on.** The Koch
quadratic production at 90° is the Koch curve; the same production at 117° is a Sierpiński triangle.
Sweeping the angle therefore morphs the figure **between named fractals**, which no other control in the
engine can do.

#### The bracket pop retraces

On `]` the turtle does **not** jump back to the branch point. It **re-emits the sub-path in reverse**,
then restores its state. That return leg is the Euler tour's, and it is what makes a branching structure
**one continuous curve with index adjacency preserved** — a tree drawn with a teleporting pop is a
scatter of disconnected branches, and the chord it leaves in the point list is as long as the whole
branch. ⚠️ It roughly doubles the list length per branch level, which is why the recursion ceiling is
declared per rule.

#### Resampling, and the two interpolations

The point list has whatever length the expansion produced; the figure needs exactly `particleCount`
positions. The list is therefore **walked continuously and interpolated between entries**, never indexed
into — indexing gives many particles the same entry, so the minimum distance between consecutive
particles becomes zero.

Two parameters are continuous but change the list, so each is resolved by interpolating between two
builds rather than by rebuilding every frame:

- **Recursion** interpolates the list at `floor(n)` and `floor(n)+1`. Both depend only on a particle's
  fraction along the curve, so both are fully precomputable, and the result reads as the curve
  **subdividing** rather than scaling. Every level of a rule's own recursion range is reachable; the
  levels are not the same amount of detail across rules, because the expansion factor per level runs
  from about 2 (the dragon, Lévy C) to about 9 (Peano), which is why each rule declares its own range.
- **An angle** interpolates two builds at the ends of a bracket, and rebuilds only when the angle leaves
  it. ⚠️ **The bracket width is declared per rule and is derived from a measured error budget**, because
  the figure's sensitivity to its angle differs by more than an order of magnitude across the rule set.
  ⚠️ **The error is not monotone in recursion on every rule** — on most it grows with depth, on Hilbert 2D
  it falls and on Gosper it peaks at depth 1 — so each width is the **minimum** over every depth in the
  rule's range and over a solve centred on its own demo's sweep.
  On the space-filling rules the bracket is below the point of usefulness — a deep Hilbert curve is not a
  near-linear function of its angle at any workable width — so those rules **bypass it and rebuild each
  frame**, which the Composer states in a note.

#### The generator builder — Twist and Stretch

Every rule is also **k scaled copies of itself laid along a k-segment generator**, each copy with a
reverse flag and an orientation about its own axis. For a rule that draws junctions (an *edge* rule) the
generator is simply the rule's own depth-1 walk, so the turn angle needs no second encoding; the copies
are composed level by level as similarity transforms. Two parameters exist only in this model:

- **Twist** adds an angle to the orientation of the rule's *twistable* copies. On the dragon the second
  copy is twistable, and a half-turn of it **is the Lévy C curve** (and the converse), so one continuous
  parameter folds one named fractal into another through 3-D intermediates.
- **Stretch** is one factor on the rule's *stretchable* steps — the Plant's two branches and their
  retraces — so the branches grow and recede at every level at once while the trunk keeps its length.

Each is **one shared value with a per-copy mask**, never a value per copy.

⚠️ **The turtle stays the builder at the identity** (twist 0, stretch 1, neither breathing), so a preset
that uses neither is bitwise what it was. Off the identity the generator builds the bracket corners, and
its output is carried into the **turtle's own frame** — the exact depth-n chord is computed from each
symbol's net displacement and turn, level by level, and the first step decides a mirror — so the hand-over
is continuous to rounding. ⚠️ The generator reproduces the turtle point for point on every rule it covers.

⚠️ **Exactly one shape axis is bracketed, and only while it is the only one breathing.** Angle, twist and
stretch brackets are each solved with the other two held, so with two or more breathing the corners are
built at the exact values every frame; the generator affords it, building faster than the turtle.

⚠️ **Stretch resamples by arc length.** Index resampling equals arc-length resampling only while every
segment has the same length; a stretched step breaks that and the break compounds with depth, so while
Stretch is off its identity the list is resampled at equal steps of length. At the identity the index walk
is kept, which is why no unstretched figure changes.

**Cell rules.** Hilbert 2D and Peano emit cell **centres**, not junctions, so their generator is an
explicit junction path and each leaf emits the centre of its **tile** (the square with the copy as an edge,
or as its diagonal). The tiles exist only at the lattice angle, so ⚠️ **on these two rules Twist and Yaw
are mutually exclusive** — while Twist acts the turn angle is held at the landmark. Hilbert 3D, Moore,
Bush 3D and the turtle-only rules have no Twist row.

#### Customize — the generator as data

Under the `Customize` rule the generator is stored in the preset (`generators.lsystem.custom`, present only
while the rule is `customize`): a list of steps — a **move** with a turn and a lift in units of Yaw and Pitch,
a length, a reverse flag, an orientation and the Twist / Stretch masks, or a **retrace** — plus a draw mode
(`path` or `cells`) and a frame. Walking the steps gives the generator polyline, which is normalised to a unit
chord; the depth-n curve is the same copy composition as the named rules', through the same transforms.

- **A turn is relative to the previous heading** (`heading_i = heading_{i−1} + turn_i · yaw`, then the same for
  lift about the left axis), so step 1's turn only rotates the whole polyline — which the chord normalisation then
  removes. So the shape is carried by the turns from step 2 on: the edge rules seed step 1 as 0, and Hilbert 2D's
  cell generator keeps its stored lattice units (+1 first), which draws the same figure. `orient` is a rotation of the copy's FRAME about its own segment, never a heading change. Example: Terdragon
  seeds as turns 0, +1, −1 at yaw 120°, every other flag off; its triangles are not in the generator — every
  segment at every level lies on one of three directions 120° apart, so the depth-n path runs along a
  triangular lattice.
- ⚠️ **A retrace stores nothing.** It walks back along the most recent move not yet retraced, and its segment,
  flags (reverse inverted) and the heading after it are that move's — so the out-leg and its return leg can
  never disagree.
- ⚠️⚠️ **Choosing `Customize` is a visual no-op, by routing.** The seed is the current rule's generator, read off
  its depth-1 walk (turn units are heading changes divided by Yaw; a segment that undoes the last open move is a
  retrace), and every parameter is kept. While the generator is **structurally equal** to a named rule's — deep,
  exact equality of steps and draw mode — the one resolver hands back that rule and the figure is built by the
  rule's own path, so the picture is bit-identical at any recursion. The first structural edit leaves the rule;
  undoing it returns. Nothing records where a generator came from: equality alone decides.
- **The frame is fitted at seeding.** The custom build of the seed is matched to the rule's own drawing by a
  similarity (rotation and mirror) at the current recursion, and stored, so the first edit does not spin the
  figure. A seed that leaves the plane (Hilbert 3D) stores a full 3-D basis instead — one of the 48 signed axis
  permutations, exact because both drawings lie on the cube lattice. Where the current angle leaves the generator
  with no chord, the frame is fitted at the published angle instead.
- **Every rule seeds except Bush 3D.** A rule's structure comes from its generator flags where it has them, and
  otherwise from a Customize-only table that does not touch the named rule's rows: ⚠️ the two questions — *does
  the named rule get a Twist row* and *can it seed Customize* — are separate tables, because Hilbert 3D has an
  exact generator but no usable Twist. Hilbert 3D is eight unit moves on the cube lattice with Turn and Lift (no
  roll needed), each copy oriented, drawn through cube centres; Moore is Hilbert 2D's generator on a **starting
  shape**. Bush 3D is a growth rule (new branches at the tips, stems that lengthen) rather than a self-similar
  subdivision, so it has no generator; `Customize` is offered but disabled there, and a plant-growth editor is a
  future phase.
- **The starting shape** (the spec's initiator) is an optional second step list walked with the same law but not
  normalised — it may close. Each of its segments carries one copy of the depth-n generator, so a starting shape
  of m segments has m · kⁿ leaves (the recursion bound divides the budget by m). One plain straight step is the
  absent starting shape — the same drawing, and the same rule under equality — so switching it on is a no-op.
  Moore is four steps up the square's centre line, a U-turn and back down: its four Hilbert quadrants have their
  chords on that line, and each square tile lies to one side of its step.
- **Validation runs on every build.** Fewer than 2 or more than 16 steps, a retrace with nothing open, or a
  non-positive length cannot be drawn at any angle, and a stored generator failing them resolves to the default
  rule on load (the generator itself is kept). A path whose end returns to its start — chord under 2 % of the
  path length — fails at that angle only, and the figure keeps its **last valid build** while it does. A step
  as long as the whole chord is a **warning**, not a failure: the named rules do it inside their own ranges
  (the dragon above 90°) and draw correctly, because at a finite depth a non-contracting generator is still
  exact — it grows with depth and the extent fit absorbs that.
- **The recursion bound is derived**, `floor(log 65 536 / log k)` for k steps, never authored. There is **no
  shape bracket** on this path (a bracket width is solved per named rule against an error budget; a custom
  generator has none to solve), so a breathing Yaw, Pitch, Twist or Stretch rebuilds at the exact value each
  frame, and a still figure builds once and is memoised. The list is resampled by arc length whenever the
  steps are unequal.
- ⚠️ **`Cells` and `Descend` are earned, not declared.** A planar generator with k = s² steps, or a 3-D one with
  k = s³, passes the space-filling check if, at the 90° lattice with Twist 0 and Stretch 1, its depth-2 tile
  centres are all distinct and every consecutive pair is one cell apart — trying the edge square, then the
  diagonal square, or for 3-D the edge cube. Passing grants `Cells` (turns and lifts held at 90°) and `Descend`,
  with `s` as the zoom octave and the tile's dimension as the zoom's; Descend acts only at the space-filling
  shape, Twist 0 and Stretch 1, and not with a starting shape — the index window is a spatial one only inside a
  single tile's grid.
- **Density readout.** The build is resampled to 4 096 points along its length and binned on a 32-cell grid;
  the readout is the 99th percentile over the median of the occupied cells' counts. The bands are the
  library's own envelope — the named rules read 1.0 to 5.3 — so *clumpy* (above 5.5) means worse than any
  named rule.
- The Mixer snaps the generator with the rule and never interpolates it; the Randomiser never produces
  `Customize`, and Evolution moves the curve block whole.

⚠️ **Hill tetrahedron is not in the rule set, by measurement.** Its standard refinement (Maubach bisection of
the Kuhn simplex) is exactly self-similar — every third generation is eight copies at ½ — but no
single-generator traversal of that dissection is continuous, whatever its entry and exit points, and the
traversal that is continuous by construction (always bisect the entry–exit edge) degenerates into needles
without limit. An exact curve on it would need several generators, which this model does not have.

#### Normalisation

Each build is fitted to its own extent, and the fit is interpolated alongside the points. ⚠️ **This is
what keeps an angle sweep a change of SHAPE rather than of SIZE.** A single fit captured once and held
makes a deeper recursion a bigger figure and an angle sweep a shrinking one; a fit recomputed per frame
makes the figure pulse. Interpolating a fit that is captured per cached bracket corner does neither.

The figure is then scaled to a fraction of the preset's own design box — the same fraction and the same
reasoning as the attractor path, so a curve and a wave figure are comparable in size rather than one
dwarfing the other.

#### Smoothness

A uniform quadratic B-spline over the same points, blended toward the polyline. ⚠️ **At 0 the spline is
not evaluated at all.** That is a branch rather than a zero weight, for two reasons: a weighted blend at
zero is not bitwise the polyline, and evaluating the expensive path unconditionally would make the plain
path cost more than the smoothed one. The basis sums to one at every parameter value, so smoothing cannot
change the figure's scale — it cuts corners, which is the whole visual effect.

#### Descend — the self-similar zoom

Effective recursion is `recursion + log(descend)/log(s)`, where **s** is the rule's subdivision factor —
2 for Hilbert, whose levels halve a cell, and 3 for Peano, whose levels third it — and the index window
narrows by the same factor. So
the particle budget stays entirely on screen and the figure **reveals new structure** instead of being
magnified. `Figure Scale` cannot do this: it maps the same points over a larger area, so a lattice
becomes a few squares and then a dot.

⚠️ **The window is snapped to an aligned `s^k` sub-cube boundary, and that alignment is not an
optimisation.** An aligned sub-cube is visited as **one contiguous run of indices**; an arbitrarily
placed box of the same size is not, and a band taken from its extremes contains stretches of curve from
elsewhere in the figure. The symptom is that the spacing between particles drifts as the zoom deepens
instead of holding constant.

⚠️ **It is available only on rules whose structure can be indexed backwards**, and is absent — not
disabled — everywhere else, because on a rule without that property the band is a scattered subset: a
picture, but not a zoom.

⚠️ **Its depth is bounded by cost rather than by arithmetic.** Each octave multiplies the symbol count,
so the ceiling is one level above the rule's own recursion range: a second level costs a rebuild of
tens to hundreds of milliseconds at every octave crossing, a visible hitch. The clamp is reported rather
than silent.

⚠️ **Descend wins over Twist and Stretch.** The contiguous window exists only at the space-filling shape,
so while the curve descends the two shape axes are ignored. ⚠️ **The band holds a constant number of cells,
set by the BASE recursion** — (cells per axis at that recursion)^dimension — so a zoom from a shallow base
draws a coarse curve of a few long strokes; the base recursion is what sets the detail on screen.

#### What this figure source inherits, and what it does not

Everything downstream of stage 1 is a consumer of positions, so the curve inherits it unchanged: the
model-space operators (§1.3), all six field systems (§2), every colour source (§3), the projection (§4),
every render mode (§5), the trail, the warp and the grade. **Index adjacency is preserved**, so trails,
ribbons, neon lines and the per-particle channels work on it.

Two things are specific to the wave model and are therefore absent:

- **Sharpness** substitutes a triangle wave for the sine inside the wave sum. There is no sinusoid in a
  turtle walk for it to replace.
- **The per-slot modulation** (Pulse, Wobble) acts on wave slots, which this type does not have. Its
  equivalent is the Depth and Rate pair on each curve row, resolved through the same operator law the
  figure operators use — so `Speed` controls both kinds of motion with no separate wiring.

⚠️ **A curve with no modulation and no rotation is a static figure, and on a static figure the trail is
a no-op and the trajectory renderers have nothing to accumulate.** Every shipped curve preset modulates
at least one parameter for that reason.

## 2. Stage 2 — Field Systems That Move Particles

Six field systems can push particles around after stage 1 has placed them. They are mathematically
very different, and they are worth understanding together because of one shared property:

> ⚠️ **ALL SIX TERMINATE IN A SINGLE OUTPUT CHANNEL: a smooth positional offset added to the
> particle's position.** None of them can change a particle's colour, size, lifetime or draw order.
> That is why a seventh field would add little, while a new *output channel* would add a great deal —
> and why two fields at once tend to fight rather than compose.

### 2.1 Curl noise

A **divergence-free** turbulent flow. Taking the 2D curl of a scalar noise field gives a velocity field
with zero divergence, which means particles swirl without piling up or thinning out:

```
  curl(n)(x, y) = ( ∂n/∂y , −∂n/∂x )
```

evaluated by central differences on a 3D simplex-noise field — the third dimension is time, so the flow
evolves:

```
  ∂n/∂x ≈ [ n(x+ε, y, t) − n(x−ε, y, t) ] / 2ε       ε = 0.5
  ∂n/∂y ≈ [ n(x, y+ε, t) − n(x, y−ε, t) ] / 2ε
```

The offset applied is `Turbulence · curl(n)(p/Scale, t · EvolSpeed)`. So **Scale** sets the spatial
size of the eddies (small = fine jitter, large = whole-figure drift), **Turbulence** the magnitude, and
**Evol. Speed** how fast the field itself changes — at 0 the field is frozen and particles follow fixed
streamlines, holding a distorted shape rather than boiling.

Simplex noise is used rather than classic Perlin noise for its lower directional bias and better
scaling behaviour in three dimensions.

### 2.2 Cohesion

A short-range attraction that makes the figure bead into drops. Each particle is pulled toward the
local centre of mass of its neighbours within a radius `r`, measured in **screen pixels** — so the
beading is independent of how large the figure is in the scene.

The neighbour search uses a **uniform spatial hash grid** with cell size `r`, which makes the cost
linear in particle count rather than quadratic. Three details are load-bearing:

- **The grid is capped.** If `(w/r)·(h/r)` would exceed the cell budget, **the radius itself is raised**
  until it fits. ⚠️ The deadband, the speed and the displacement cap all read the **resolved** radius —
  reading the configured one instead would be a strength error dressed as a size error, and it only
  appears at 4K.
- **A deadband** suppresses the force at very short range, so particles that have already merged do not
  jitter against each other.
- **Return Force** springs each particle back toward its curve position. This is what makes beading
  stable: without it the drops drift until they hit the displacement cap.

Past roughly `r = 64 px` the whole figure collapses into one lump, because every particle is inside
everyone else's neighbourhood.

### 2.3 Liquid field

A **pool of free particles**, added to the same particle set (so every render mode draws them), that the
figure drags through as it moves. The pool is seeded by one of four patterns — *Fill*, *Cloud*, *Blobs*,
*Basin* — and then advected by a velocity field the figure itself stirs.

The flow has memory: `Field Decay` is the retention factor applied to the velocity field each frame, so
low values let the wake settle immediately while high values let currents build and keep circling after
the figure has passed.

> ⚠️ **The pool only moves while the figure moves.** The velocity field is sourced from particle motion,
> so on a still or very slowly rotating preset it sits where it was seeded regardless of
> `Field Coupling`. And `Field Coupling = 0` is **not** an off switch — the pool is still drawn and
> still occupies slots; only `Enable` removes it.

### 2.4 Dye field

Unlike the other five, the dye field's output is **colour**, not position — it is included here because
it is advected by the same flow. The figure paints into a texture, the flow carries it, and it decays:

```
  dye(t+1) = advect( dye(t), v ) · decay       and then += deposit from this frame's particles
```

**Dye Radius** is the deposit footprint, measured on `min(w,h)` so a mark is round at any window shape;
**Advection** scales how far the flow drags the dye each frame; **Dye Decay** is the retention.

**Dye Colour** chooses what each particle deposits, and the six sources differ in what they READ:

| source | reads | needs | independent of the figure? |
|---|---|---|---|
| `Depth` (default) | the live material's ramp, or `ice` with no material, indexed by the particle's normalised depth | nothing | no — the material's ramp |
| `Palette` | the **resolved palette's** 256-entry LUT, indexed by the same depth coordinate | a palette to be live | no — the figure's palette |
| `Ramp` | **the dye's own authored gradient** (`dye.ramp`, resolved through the whole palette namespace), indexed by the same depth coordinate | nothing | **yes** |
| `Figure` | the figure's own per-particle colour, **undimmed** | nothing | no — literally the figure's colour |
| `Velocity` | the same colours, scaled 0.35–1.0 by speed against a fixed reference | nothing | no — literally the figure's colour |
| `Temperature` | the material's ramp indexed by per-particle temperature | a live material | no — the material's ramp |
| `Fixed` | one authored RGB | nothing | yes, but **flat** |

⚠️ **`Figure` AND `Velocity` DIFFER ONLY IN THE SPEED TERM, and both are kept.** The dimming is a
feature rather than a defect: its 0.35 floor exists so a momentarily stationary particle deposits a dim
colour instead of punching a hole in the wake at every wave reversal. **`Figure` is the same read with no
speed term at all.**

⚠️ **`Ramp` EXISTS BECAUSE NO OTHER SOURCE IS BOTH INDEPENDENT AND VARYING, which the last column is
there to show.** `Fixed` is independent but constant, and 15.7 measured that constancy as having
*"removed the last variation"*; everything else borrows the material, the palette or the figure's own
colours. ⚠️ **It must never consult `material.colourRamp` — if it did it would be `Depth` with extra
steps** — and it matters most for a figure-free dye with no material, where
`Depth` would paint the whole field ice-blue.

##### The coordinate: `Dye Map`

The three ramp sources share **one** coordinate expression, and `Dye Map` chooses what it reads:

```
Depth:   t = clamp(depth, 0, 1)                 // near → far
Index:   t = fract((i / count) × Dye Cycles)    // along the curve, wrapping
```

⚠️ **TWO END RULES, ONE TEXEL LOOKUP.** Depth reaches 1.0 *exactly* at the far plane, so its path uses an
integer texel modulo with a bit-exact identity at hue shift 0 — **a `fract()` there would wrap the far end
onto the near end and swap the two colours the near/far split exists to separate.** The index coordinate
wraps on purpose, because cycle counts above 1 are its normal case. **The lookup itself is shared; a
second copy is how the two coordinates come to disagree about the hue rotation.**

⚠️ **The index path reads no depth at all**, so its gate must not require `state.depths` — otherwise the
mapping goes inert on any frame where that array is short, which is a configuration-dependent failure.

⚠️ **WHAT BOUNDS THE USEFUL CYCLE COUNT IS NOT THE CONTROL, IT IS THE FIELD'S OWN AVERAGING.** The dye
read is `rgb / a`, a weighted mean of every deposit on a texel, so a mark of `Dye Radius` screen pixels
averages roughly `radius / index spacing` consecutive particles. Bands survive while one cycle spans many
more particles than that:

```
cycles  ≪  particleCount × index spacing / Dye Radius
```

With the index spacings in App. A (`Waves` 0.13 px, `Cylinder` 0.50, `Pipes` 0.87, `Quader` 1.23 at
1024×768), a 20 000-particle sparse figure at radius 6 bands cleanly into the thousands, while `Waves`
shares ~100 particles per mark and washes out at the same setting. **A dense figure is the limit, not the
control.**

⚠️ **A wrapping ramp walk shows a SEAM wherever the ramp's last colour meets its first.** A cyclic
gradient has none — every `Cycle:` palette is cosine-generated and its LUT ends where it begins, measured
as an end-to-end difference of exactly 0. A `Classic:` gradient bands just as well and shows one seam per
cycle.

> ⚠️ **`Palette` is `Depth` with a different ramp, and sharing the coordinate is the design.** The
> surface resolves the field as `rgb / a`, which is scale-invariant, so a source that does not vary
> *across the figure* makes every dye slider inert — a near/far split is the cheapest variation that
> needs no material, which is why `Depth` is the default and why the new member inherits its coordinate
> rather than being indexed by particle index. It degrades to `Depth`'s own ramp when no palette
> resolves, never to black: the field is the surface's **albedo**, so black dye is a black body.

> ⚠️ **The palette's hue rotation (`Warmth` → `overlay.paletteHueShift`) applies here too**, as a texel
> rotation of the LUT with an explicit identity at 0. The rotation reaches five consumers, not four; a
> consumer that read the LUT unrotated would make `Warmth` move the figure and not the dye.

> ⚠️ **The resolved LUT is memoised by NAME, one slot.** `getPaletteLUT()` does not cache — it
> allocates 1 KB and evaluates 256 cosines per call — and this resolver runs once per frame. The memo is
> keyed on the palette the **one resolver** chose, never on `overlay.palette` or on the film look's own
> field: the pair has two sources and keying on either half would go stale whenever the other won.

> ⚠️ **It needs motion twice over**: the field fills only where the figure has been, and `Advection`
> does nothing at all without rotation or wave motion.

#### 2.4a The dye's two output paths — and only one of them needs *Liquid*

| path | what it does | needs the `liquid` block? |
|---|---|---|
| **Body / albedo** — the surface's `Tint Source = Dye` | replaces the resolved colour **inside** the silhouette | **yes, irreducibly.** It needs the iso surface's coverage, and its per-pixel fallback is `Surface Ramp`. Without a surface there is nothing to be the albedo *of* |
| **Wake / overlay** | draws where the figure is **not** | **no. nothing at all.** It needs the field, the saturation constant and the hue quotient; its fallback is black *by design*, because there is no surface here to fall back to |

**The wake therefore has its own output channel**, a full-screen premultiplied composite that runs in
**every** render mode, and the Visual FX **Blend** control chooses how it combines (§6.2.12a of the user
guide). The resolver refuses to run it **while the iso surface is actually drawing** with
`Tint Source = Dye`, because that fragment already composites the identical wake in its own
`coverage == 0` branch — **running both would draw it twice, giving `1 − (1−a)²` instead of `a`**, which
reads as the dye being too strong rather than as a double draw.

⚠️ **THE WORD "WHILE" IS LOAD-BEARING.** An unconditional refusal keyed on *mode plus tint source* looks
equivalent and is not: with **Show Figure** off the surface does not draw, so there is nothing to double,
and refusing anyway would leave the dye with no path at all on exactly the presets that configuration is
for. **Three questions must stay separate:** is the figure hidden, does the surface draw, and should the
overlay run. **One predicate answering two of them makes the control inert where it should do the most.**

⚠️ **THE OVERLAY COMPOSITES AT STAGE 5, BEFORE THE FIGURE, AND TWO CONSEQUENCES FOLLOW BY CONSTRUCTION
RATHER THAN BY CHOICE:**

- **TransMap warps the dye along with the figure.** The warp is Stage 7 and operates on the image, which
  by then no longer knows which pixel came from which particle. **You cannot have the figure warped and
  the dye unwarped**; that would need two buffers and two warp passes.
- **Trail Decay smears the dye as well as the figure.** Everything written into the `fboA`/`fboB`
  ping-pong is read by the next frame's decay pass, and the only non-trailing slot is after the final
  composite — which would lose the warp *and* the grading. So the dye carries **two** integrators, its
  own `Dye Decay` and the trail's. ⚠️ **Do not "fix" this by moving the pass.**

⚠️ **AND THE TWO BLEND MODES ARE TWO STEADY STATES RATHER THAN TWO BRIGHTNESSES.** Composited into a
buffer that then decays by `k`, the fixed point for dye colour `C` at composite alpha `a` is
`aC / (1 − (1−a)k)` under **Over** but `aC / (1 − k)` under **Add** — **1.00 × C against 6.67 × C** at
`a = 1`, `k = 0.85`. So **Over cannot blow out**, while under **Add `Trail Decay` becomes a brightness
control for the dye** and climbs steeply as `k → 1`. Over also attenuates its destination by `(1 − a)`,
which is the same term that bounds it: **where the dye is dense it thins the figure's trail.**

### 2.5 Physarum network

A **slime-mould** simulation (after Jones, 2010): a population of agents that sense, steer toward and
reinforce their own deposited trail until it condenses into a branching vein network. Each agent, each
step:

1. **Senses** the trail field at three points — ahead, and at `±SensorAngle` offset by `SensorDist`;
2. **Rotates** toward the strongest of the three, by at most `TurnSpeed` degrees;
3. **Moves** forward and **deposits** into the trail field.

The trail field is then diffused and decayed on the GPU:

```
  trail(t+1) = blur( deposit ) + trail(t) · (1 − decay)        clamped to [0,1]
```

The field is a fixed **512 cells across** regardless of window size, which is why `Sensor Dist` is
expressed as a fraction of the frame rather than in pixels. **Decay Rate** and **Deposit** together
decide whether the network condenses into a few strong veins or stays a diffuse haze.

### 2.6 Fluid advection

Blends each particle's position toward being carried by a fluid velocity field, against a spring back
to its mathematical position on the curve:

```
  p ← (1 − γ) · p + γ · advect(p, v)   ,   then pulled toward p_curve with strength k
```

`γ` is `Blend` and `k` is `Return`. High `k` lets the fluid only ripple the figure; low `k` lets it wash
the figure away entirely.

### 2.7 Buoyancy and smoke (Materials)

The Materials tab contributes its own positional system at this stage. Hot particles **rise**:

```
  offset_y  −=  Strength · T(i)          (screen-up is negative y)
```

with sideways **Turbulence** jitter added, the total displacement clamped by **Max Offset** (a hard
ceiling in pixels, the safety rail that stops a strong flame evacuating the figure), and a
**Return Force** pulling particles back to their curve positions so the figure stays recognisable while
it burns.

A risen particle whose temperature has fallen below **Smoke Threshold** becomes **smoke**: drawn dark
and unlit, with its own opacity and a `Dissipation` retention that decides whether it lingers into a
column or vanishes just above the flame.

### 2.8 The force gate

A single multiplier that scales how much of the summed field displacement is applied, implemented as a
**lerp from 1**:

```
  gain = 1 + amount · (g − 1)
```

so **amount 0 is byte-identical to ungated** rather than merely close. It scales the **increment only,
never the decay term**, and is applied before the `maxForcePixels` clamp. With no material active it is
inert.

---

## 3. Stage 3 — Colour Per Particle

### 3.1 The colour oscillator

With no palette in force, each particle's colour comes from a per-channel sine oscillator over the same
sweep parameter the figure uses:

```
  for each channel c ∈ {R, G, B}:

    v_c = base_c + A_c · sin( n · colorFreq_c / DEG + pos · colorShift_c + hueShift )

    colour_c = clamp(v_c, 0, 255) / 255
```

- **`colorFreq`** is **cycles across the particle index** — count-free, so it means the same thing at
  4 000 particles as at 200 000. ⚠️ A value below one full cycle produces a figure of essentially **one
  flat colour**, not a dim one; that distinction catches people out.
- **`colorShift`** multiplies `pos`, so it animates the hue over time: a per-channel colour drift.
- **`hueShift`** is the `Warmth` slider's rotation when a palette is in force (see below).
- The engine evaluates this per frame through a per-particle `sin`/`cos` table and the angle-sum identity
  (see *The performance guard*), which is the same value; the swatch and every single-particle reader use the direct form.
- The clamp is **per channel and at the extremes**, which is why pushing amplitude high gives
  saturated primaries rather than a brighter version of the same hue.

### 3.2 Palettes

A **palette** replaces the per-particle oscillator with a lookup into a gradient. Over forty are
shipped, in four families:

| Family | Construction |
|---|---|
| **Cosine** | the classic cosine-gradient form, `c(t) = a + b · cos(2π(ct + d))`, with a published-style parameter quadruple per palette — compact and smooth by construction |
| **Cycle** | an `(a, b)` pair authored as exact `/255` values, evaluated as a cycling oscillator. Nine of these, and they are the family an `index` mapping adopts |
| **Classic** | the legacy engine's named ramps, carried across verbatim |
| **Material** | the ramps the material system uses, exposed as palettes so a figure can borrow a material's colour without using the material |

**`Map`** chooses *what quantity* is looked up:

| Mapping | Quantity |
|---|---|
| `Depth` | distance from the viewer after projection. ⚠️ On a figure with no rotation every particle has the same depth, so the whole figure comes out one colour |
| `Phase` | position along the curve |
| `Velocity` | per-frame displacement magnitude |
| `Position` | a spatial coordinate |
| `Age` | time since the particle was (re)seeded |
| `Temperature` | the material's per-particle temperature. Requires a material |
| `Particle index` | the particle's position in the sweep |

> ⚠️ **`Particle index` is the odd one out, and deliberately so: it is computed on the CPU.** All the
> others are GPU-side lookups available only to the modes that sample them, whereas the index mapping
> produces a per-particle RGB in the vertex data — so it reaches **every** render mode, including
> ribbons and neon lines, which the others cannot colour.

The palette is sampled through a LUT texture with `CLAMP_TO_EDGE`. ⚠️ That clamp is why every hue-shift
site tests for a zero shift explicitly: `fract(1.0)` is `0.0`, so a wrapping offset of exactly one turn
would move the LUT's top edge rather than leaving it alone.

### 3.3 Material ramps and temperature

A material maintains a **per-particle temperature** with first-order thermal lag. Per frame, with
`dt` in seconds and a lag `τ`:

```
  coolFactor = 0.5 ^ (dt / τ)                  — the fraction retained this frame
  heatScale  = 1 − coolFactor                  — the fraction admitted this frame

  heat = ( HEAT_FLOOR + (1 − HEAT_FLOOR) · u(i) ) · HeatGain · heatScale

  T(i) ← T(i) · coolFactor + heat
```

where `u(i)` is the normalised driver chosen by **Heat Mode** — the particle's `velocity`, its
`position`, or its `age`. `τ` is **Thermal Lag** in seconds: near 0 the temperature tracks the driver
instantly, and high values smear it so hot regions trail behind the motion.

> ⚠️ **`heatScale = 1 − coolFactor` is a correctness requirement, not a convenience.** The pair is a
> discrete first-order filter; using any other admitted fraction makes the steady-state temperature
> depend on the frame rate, which reads as "the material looks different on a faster machine".

`T` then indexes the material's **Colour Ramp**, and scales **Emission** — the material's master
brightness. ⚠️ Emission does **not** reach crystals, which are lit rather than emissive.

### 3.4 Precedence

Three sources can colour a particle, and they resolve in exactly one order:

```
  palette   >   material ramp   >   preset colour oscillator
```

This single rule explains most "my colour edit did nothing" reports: with a palette active, the
oscillator's `base`/`amp`/`freq` are still there and still stored, but they are being **replaced**
rather than ignored. Setting the palette to `None` returns them.

> **A film look sets the palette only if it has one.** Three of the shipped looks carry no palette and
> deliberately **abstain** — they write nothing to the palette selection, leaving your choice alone.

**Colour Mix** blends the resolved colour toward the figure's own. Its *default* carries most of the
surface colour on the liquid path, which is why it reads as a constant rather than as a control. The
**dye** source is the one source **exempt** from Colour Mix, and the only one whose data can be absent
at runtime — with no dye painted it degrades to the chosen ramp.

> ⚠️ **The palette reaches a dyed surface through ONE route only — the dye's own palette source — and
> the three routes it does NOT reach by are worth naming, because each looks like the others'
> responsibility.** Under `Tint Source = Dye` the
> surface's palette branch is not taken (it is gated on the `palette` source), `uRamp` resolves to
> `Surface Ramp` rather than to any palette, and `Colour Mix` is forced to 0 — so the per-particle route
> is shut as well. Three plausible paths, all closed, and no single file wrong — which is why the
> **dye**'s own palette source ([§2.4](#24-dye-field)) is the one place that can
> read a palette without making the surface a second resolver for it.

---

## 4. Stage 4 — 3D Transform and Projection

### 4.1 Scale, then rotation

The figure is scaled **in model space, before rotation**:

```
  p ← p · figScale
```

That order matters: a scaled figure keeps the same perspective foreshortening and the same depth
ordering it would have at scale 1. Scaling after projection would flatten it instead.

Rotation is applied as three successive axis rotations, **X then Y then Z**, each a plane rotation on
the complementary pair. With `sx = sin(angX/DEG)`, `cx = cos(angX/DEG)` and so on:

```
  X:   y' = y·cx − z·sx            Y:   x' =  x·cy + z·sy        Z:   x' = x·cz − y·sz
       z' = y·sx + z·cx                 z' = −x·sy + z·cy             y' = x·sz + y·cz
```

Rotation **rates** are stored in turns per minute, ±10 per axis, and the angle is advanced each frame by
`rate · rotFactor`. ⚠️ **The rates are nominal: the Speed factor multiplies the actual advance**, so at
0.5× a stated 2 rpm really takes two minutes.

X and Y tumble the figure toward and across the camera; Z spins it in the picture plane. Z alone never
changes any particle's depth, which is why a Z-only preset gets nothing from a depth-mapped palette.

### 4.2 Perspective projection

A single-point perspective divide against a camera distance `perspZ`:

```
  q    = z − perspZ
  proj = perspZ / q

  screenX = originX − x · proj
  screenY = originY − y · proj
```

with `origin` at the canvas centre. The projection is **only valid for `q < 0`** — points at or behind
the camera plane. A particle with `q ≥ 0` is **culled** by writing a sentinel coordinate far outside the
frame rather than by branching downstream; no consumer tests the value, they only rely on it exceeding
their own guards.

Depth is then normalised to `[0, 1]` from the perspective term, and that normalised depth is what the
depth-mapped palette, the depth-size and depth-brightness cues, the depth of field and Depth Parallax
all read.

> ⚠️ **Two subsystems meet here and their depth conventions are opposite.** Where a value crosses that
> boundary the direction of the scale has to be measured rather than read off a comment, and the
> inversion must happen **exactly once**, at a named place. Three separate values encode that direction
> and each is silent when wrong.

### 4.3 Canvas fit

A preset stores a **design resolution**. The engine fits that design box into the actual canvas
**preserving the authored aspect ratio**, which is why a preset authored square letterboxes on a wide
window rather than stretching. **Figure Scale** (0.2×–5×) multiplies that automatic fit, so raising it
fills the screen and going past 1× frames part of a larger figure.

The slider is **logarithmic** — `sliderMul(p) = 5^(2p−1)`, giving exactly 0.2× at 0, 1.0× at the centre
and 5× at 1 — because halving and doubling are equal-sized visual changes and so deserve equal-sized
gestures. A linear 0.2–5.0 track would give shrinking only 17 % of the travel.

#### The canvas itself: three sizes, and only one pair may disagree

Fitting the figure assumes the canvas is the shape it looks like, and that is its own question. **Three
sizes exist and confusing any two is the whole trap:**

| size | what it is |
|---|---|
| the **CSS box** | what the stylesheet stretches the canvas element to |
| the **device surface** | `CSS × devicePixelRatio`, the real pixels the compositor will light |
| the **backing store** | `canvas.width/height`, what is actually drawn |

The backing store is deliberately allowed to be *smaller* than the device surface — that is the render
budget, and it costs sharpness only. ⚠️ **But its ASPECT must match the CSS box's, because the
compositor stretches one into the other.** When those two disagree the browser distorts the frame, no
GL code is wrong about anything, and the console is clean — so the symptom is "the figure has the wrong
proportions" with nothing to blame.

> ⚠️ **The sizing therefore MEASURES the canvas's own box** rather than reconstructing it from the
> window and the panel widths. Reconstruction failed in two ways at once: the fullscreen branch used
> `window.innerWidth`, which is the box's *future* value while the panel animation is still running, so
> leaving full screen could leave the backing store at the full-screen width inside a half-width box
> (measured at 1520×900 in an 800×900 box — a 1.9× horizontal squash). And the height was always
> `window.innerHeight`, which under the narrow-window breakpoint is **twice** the canvas's height,
> because the panes stack instead of sitting side by side.
>
> ⚠️ **Measuring a live box makes a SETTLE OBSERVATION mandatory rather than optional**, since the
> measurement is only right for the instant it was taken. The panel transition's own `transitionend` is
> what re-measures; a fixed timer is kept only as the fallback for the cases where no transition runs.
> A `ResizeObserver` would be the more correct instrument and is deliberately **not** used: it fires
> once per animation frame for the whole transition, and every resize that resolves to a new size
> rebuilds both FBO sets and clears the accumulated trail.

---

## 5. Stage 5 — Drawing a Particle: the Six Render Modes

### 5.1 Particle size

Size resolves through **four paths with one shared multiplier**, plus a fifth base that exists only on
the splat path:

| Mode | Base size | Then |
|---|---|---|
| Pixel, Blend | 3 px | × `Particle Size` × `scaleFactor` |
| Star | 5 px | × `Particle Size` × `scaleFactor` |
| Splat, Volume | the material's **Splat Radius**, or 16 px with no material | × `Particle Size` × `scaleFactor` |

`Particle Size` spans 0.25×–4×. ⚠️ **The clamp on the result is asymmetric**, and the pixel estimate the
UI prints beside the handle mirrors that same clamp — the two have to agree or the readout lies.
**Crystals are excluded** from this multiplier entirely and use their own `Crystal Size`.

### 5.2 The six modes

| Mode | What it draws |
|---|---|
| **Pixel** | one hard point per particle. The flattest, most diagram-like reading, and the legacy default |
| **Blend** | a soft additive dot; overlaps sum into glow |
| **Star** | a bright core with a soft halo, shaped by the `Glow` control |
| **Splat** | an accumulating soft kernel. **Requires a material** — with none, the splat path has no kernel and draws *nothing at all* |
| **Volume** | ray-marches the accumulated density as participating fog |
| **Liquid** | reconstructs a single closed **iso-surface** from the particle density, the only mode in which the figure can occlude what is behind it |

> ⚠️ **`RenderMode` being a union type buys type safety, not enumeration coverage.** There is no
> exhaustive `switch`; the code is `if`-chains that fall through to `star`. A newly added mode therefore
> compiles and silently renders as `star` unless every chain is visited. `RENDER_MODE_LABELS` is the one
> site the compiler does enforce.

#### 5.2a Energy normalisation and shear on the splat quad

Both govern the appearance of every preset whose material sets `velocityStretch > 0`, which is most of
them, and both live in `SPLAT_VERT_SRC` / `SPLAT_FRAG_SRC`.

**Energy normalisation.** A stretched splat is scaled by `widthBoost` in *both* axes and again
by `aspect` in height, with nothing dividing the deposited light — so stretching a particle made it
brighter as well as longer, and the brightness was not a choice anyone made. The vertex stage now
derives `vEnergyScale = 1 / (widthBoost² · aspect)` and the fragment multiplies the shape term by it.

- ⚠️ **The two stages are not symmetric.** The vertex **sizes** the quad; the fragment **shapes** the
  mark. The factor is derived in one and applied in the other — it is a pair, not the same term twice.
- ⚠️ **Gated on `uIsAdditive`.** Ungated it scales alpha too, so an alpha-blended splat would become
  more *transparent* when stretched, which is a different quantity entirely.
- ⚠️ **Applied AFTER the discard test**, or dim fragments drop under the threshold and the splat
  silently **shrinks** — a geometry change wearing a brightness change's clothes.
- ⚠️ **A frozen crystal is exempt.** The crystal branch rebuilds
  the quad from `baseSize` alone — no `sizeMultiplier`, no `widthBoost`, no `aspect` — so it must reset
  `vEnergyScale` to 1 or it pays a compensation for a stretch it never received. At `velocityStretch` 1
  the factor is about 6, and the symptom is *crystal opacity*, one stage from the cause.
- **Two residuals are stated rather than approximated:** `taperFactor` varies within the quad rather
  than scaling it, and `sizeMultiplier` (flame expansion) is an authored size feature with its own
  control — normalising it away would cancel the feature. **Compensate the stretch, not every term that
  contains `blend`.**

**Splat shear.** `overlay.splatShear` selects the quad's cross-axis: `'tangent'` (the default,
and byte-identical to the pre-27.6 behaviour) uses the path tangent's perpendicular, so a mark keeps a
constant apparent width whichever way the particle travels; `'fixed'` pins the cross-axis to the
screen, so marks widen across the direction of travel and narrow along it. Hsu, Lee and Wiseman call
these the **ribbon** and **sausage** styles, the second *"drawn with a flat nibbed pen"*.

- ⚠️ **The stored words are `tangent` and `fixed`, never `ribbon`/`sausage`** — `ribbonMode` is already
  a different feature on `OverlayState`, and a second meaning for that word is a name trap.
- ⚠️ **Only the vertex stage computes `perp`**, so unlike 27.2 this is a one-stage change.
- ⚠️ **A crystal is unaffected**, because the frozen branch overrides the `perp`-built quad outright.
- ⚠️ **`reapplyRendererState()` must re-hand it** (invariant 2): the renderer's flag is a plain boolean,
  so a rebuilt renderer starts from its initialiser and a render-mode change would silently revert the
  look. The Mixer **snaps** it at t = 0.5 — a blended two-way choice is meaningless (invariant 16).

### 5.3 Star: the glow shape

`Glow` is a **shape** control, not a brightness one: it sets the size and softness of the halo around
each particle's core. Low values give a tight bright core, high values a wide diffuse bloom. It is read
only by `Star` and `Blend`.

⚠️ **`glow` is inverted internally**, and `haloStrength` is **algebraically absent at the core** — the
core is drawn by `Core Brightness` alone. So if a figure is washed out in its bright middles, the halo
control cannot reach it; that is a `Core Brightness` or exposure problem.

### 5.4 Volume

Two controls over a ray-march of the accumulated density field:

```
  transmittance along a ray:   T = exp( −Extinction · ∫ density · DensityScale  ds )
```

**Extinction** is how quickly the fog absorbs light with depth — high gives a dense, almost
surface-like cloud, low a thin translucent haze. **Density Scale** multiplies the accumulated density
the fog is built from.

### 5.5 Liquid: the iso-surface

The liquid mode builds a density field from the particles and extracts the surface where that density
crosses a threshold. The threshold is **relative to the density measured along the figure itself**:

```
  isoRef = IsoLevel · densityRef
```

which is what makes `IsoLevel` mean the same thing at 4 000 particles as at 20 000, and on a sparse
curve as on a dense one. **1.0 is the balanced surface**; above it the lobes separate into droplets,
below it they fuse.

Coverage at a pixel, with `d` the sampled density:

```
  halfW    = Softness · isoRef

  coverage = Softness > 0  ?  smoothstep(isoRef − halfW, isoRef + halfW, d)
                           :  (d ≥ isoRef ? 1 : 0)

  thickness = clamp( (d − isoRef) / thickRef , 0, 1 )
```

So **Edge Softness** feathers the boundary as a *fraction of the threshold* (0 gives a hard painted
edge, high values a misty falloff), and **thickness** — how far past the threshold the density goes —
drives the volumetric shading: absorption through the body, refraction, and the rim.

| Control | Role in the shading |
|---|---|
| **Kernel Width** | how far each particle's density contribution reaches; with `IsoLevel` it sets how close two drops must come to merge |
| **Thickness** | how much light the body absorbs on the way through, so a thick core goes deeper and darker while the thin rim stays bright |
| **Refraction** | how much the surface appears to bend what is behind it |
| **Specular** | the glint where the surface faces the light, following the surface normal — the clearest cue that the shape is wet |
| **Edge Bright** | the glancing-angle sheen where the surface turns away |
| **Tint Source** | where the colour comes from: `Preset`, `Palette`, `Material Ramp`, `Ramp`, or `Dye` |
| **Surface Ramp** | the gradient the body is coloured by, indexed by thickness. Shown for `Ramp` **and for `Dye`** |
| **Figure Colour** | how much of each pixel's colour comes from the particles that built it. Default 0.85, which is why changing `Tint Source` looks weak until it is lowered. **Hidden under `Dye`** |
| **Mix Model** | `Light` blends toward the brighter constituent; `Pigment` deepens where layers stack and leaves the thin rim untouched. **Hidden under `Dye`** |

> ⚠️ **The three gradient tint sources are indexed by THICKNESS**, not by a palette mapping and not by
> temperature — the thin rim takes the low end of the ramp and the thick core the high end. A Palette's
> own `Map` setting therefore cannot reach the liquid surface.

> ⚠️ **THREE ROWS ARE GATED ON `Tint Source` AND THEY MOVE IN OPPOSITE DIRECTIONS.** `Surface Ramp`
> appears for `Ramp` and `Dye`; `Figure Colour` and `Mix Model` disappear for `Dye`. The two that leave
> are unreadable by **algebra, not by taste**: the shader resolves
> `mixAmt = (tintSource == dye) ? 0.0 : colourMix`, so `mix(tint, mixed, 0.0)` is an identity that
> discards `colourMix` *and* `mixed` — and `mixed` is the only thing `Mix Model` feeds. Both controls
> were visible with zero reach.
>
> ⚠️ **`Surface Ramp` was the inverse mistake and it mattered more.** It was hidden for every source but
> `Ramp` on the stated grounds that *"the other sources do not read it at all"* — true of `Preset` and
> `Palette`, and **false of `Dye`**, which samples the ramp as its **per-pixel fallback** wherever the
> field is thin or has never been visited. So the one source whose body colour the ramp governs was the
> one source that could not reach the control. `Material Ramp` stays excluded on purpose: it falls back
> to the ramp only when no material is live, which is a degradation rather than a second authoring path.
>
> A row the active configuration cannot read is **hidden, not greyed**, throughout this tab — a greyed
> row implies it still applies. The Sliders tab's opposite convention, *disable and print the reason*,
> is for a row that is live under two different laws and has to say which.

### 5.6 Ribbons and neon lines

Two ways to connect consecutive particles into continuous strokes instead of leaving them separate.
They are **mutually exclusive** — enabling one disables the other.

- **Ribbon** builds a triangle strip along the curve with a width in pixels, giving the path an inside
  and an outside; past a certain width it occludes itself where the curve crosses.
- **Neon Lines** draws each particle's **own recent path** — its last eight positions on screen — as
  a glowing stroke, so a moving figure leaves short light-trails and a motionless one leaves none. Past
  about 4 px the strokes merge into a solid band and the wireframe reading is lost, and the effect depends
  on the particle count being low enough for individual strokes to be legible.
  ⚠️ **The strokes are built on the graphics card.** The trail history lives in a float texture laid out
  so that the newest sample of every particle is one contiguous block, and only that block is uploaded each
  frame — about 8 floats per particle; the vertex shader reads the two ends of each segment and builds its
  quad, applying the frozen-sample and teleport skips itself (the teleport threshold is still computed on
  the CPU from the same history). Expanding the quads on the CPU instead costs 196 floats per particle per
  frame, which halves the frame rate at 40 000 particles.

> ⚠️ **A vertex buffer shorter than its draw call is dropped entirely by ANGLE** — the whole draw
> silently produces nothing. Two passes that share a VAO must therefore both upload every per-instance
> buffer at the correct length, and length tests must compare against `state.count` rather than test
> for a null array.

### 5.6a Electric Discharge

A full-screen pass on the finished image, between the reel cross-fade and Bloom, with **two buffers of its
own**. Each frame it forms the blend `decay · previous + (1 − decay) · image`, computes the gradient of
that blend's coverage, and resamples **both** inputs displaced **toward** the gradient — Translation Map
style 7 with *Invert* on, i.e. diffusion run backwards, which keeps collapsing light into thin unstable
filaments. The result **replaces** the image.

- ⚠️ **Replace, not add.** Adding a pinched copy over the untouched image reads as extra glow with no
  crackle; the crackle is the halo itself being torn into filaments.
- ⚠️ **The warp acts on the blend, not on the previous buffer alone.** Warping only the history lays the
  fresh light down unwarped, and that smooth layer keeps the halo intact.
- ⚠️ **The feed is energy-neutral** (`deposit = 1 − decay`): with no pull the buffer settles to the image
  itself, so the effect changes structure, not brightness.
- **Intensity** is the pull in the same units as a refraction layer's strength (a fraction of
  `min(w,h)`), **Filament** the gradient reach in pixels. **Crackle** sets the buffer's decay (0.9 calm to
  0.5 violent) and a deterministic per-frame jitter of where the gradient is sampled, which keeps a slow
  figure from settling into a static pattern. **Branching** adds the direction of a drifting curl-noise
  field, measured in an isotropic domain (`min(w,h)` on both axes), scaled to the pull.
- ⚠️ **Off is a branch**: the pass does not run, and Branching 0 skips the noise inside the shader. The
  buffers are cleared on a preset change and when the effect is switched on, so stale filaments never flash.
- It never writes the trail, so a preset's own decay and Translation Map are untouched. The preview grid
  does not run it, as it does not run neon lines.
- ⚠️⚠️ **It is coupled to Neon Lines.** The crackle is the lines' glow being torn apart; on crisp points or
  ribbons there is no soft field to climb and the pull only thins and dims the figure (a self-supplied halo
  was tried and rejected: it washes the lined case out and still gives no crackle without lines). So the
  engine enforces both directions in one place, `coupleDischargeToLines()` in `main.ts`, called after
  every write of the lines flag: enabling the discharge enables the lines (ending ribbons), and lines off ⇒
  discharge off, including when a preset or a Mixer blend arrives with the discharge on and no lines.

### 5.7 Depth and lighting cues

These five live in the Film Look's **Particles** group but act per particle at draw time:

| Control | Effect |
|---|---|
| **Depth Sz** | near particles drawn larger. The primary cue that makes a 3D figure read as having depth |
| **Depth Br** | near particles drawn brighter, far ones dimmer — atmospheric extinction. It points the same way as **Depth Sz**, so the two reinforce: a near stroke is both thicker and brighter |
| **DoF** | blurs particles away from a focal depth fixed at the middle of the figure — a photographic cue. ⚠️ It blurs the near and the far side **alike**, so it cues distance from the focal plane and says nothing about which side is in front |
| **Color Sh** | warms near particles and cools distant ones: aerial perspective, with no size or brightness cost |
| **Lighting** / **Rim Pow** | `None` ignores direction entirely; `Directional`, `Rim` and `Both` add a highlight and a silhouette rim from the surface normal, `Rim Pow` setting how tightly the rim hugs the edge |

⚠️⚠️ **Particles do not hide one another.** No particle pass tests depth, and the only depth sort in the
engine is the crystal pass, so in every mode except *Liquid* the strokes of a figure **composite** where
they cross. On a dense 3-D figure these cues are therefore the **entire** front-to-back signal, and they
can only be judged against each other: `Depth Sz` and `Depth Br` agree, `Color Sh` agrees, and `DoF`
does not take a side. The nearest thing to occlusion is the per-particle **Opacity Spread** driven by
**Depth** with a **negative** amount — the channel's law favours the far end for a positive amount — and
it reaches the point and splat passes only — the ribbon and neon renderers do not read the channels (see their row in *A.4 Preconditions*).

### 5.8 Blending

Particles are composited **premultiplied**, with `(ONE, ONE_MINUS_SRC_ALPHA)`. The tint must therefore
be multiplied by alpha at the source.

> ⚠️ **Getting that premultiplication wrong does not dim the image — it distorts the falloff.** The
> core stays roughly right while the halo's shape changes, which reads as a *shape* defect and sends
> you looking at the wrong control.

**Blend Mode** (Materials) decides how deposits combine: `Additive` accumulates without limit so
overlaps brighten; `Alpha` composites with coverage and stays bounded. ⚠️ The choice also changes what
trail persistence means — see §6.3.

---

## 6. Stage 6 — The Trail: Motion Blur as Feedback

### 6.1 The feedback equation

The trail is not a buffer of past positions. It is a **feedback loop**: the previous frame's image is
faded toward black and this frame's particles are drawn on top of it.

```
  fadeAlpha = 1 − decayFactor

  image(t) = image(t−1) · decayFactor  +  particles(t)
```

`decayFactor` is the `Trail Decay` control (default 0.86). It is **how much of the previous frame
survives**, which is the same thing as trail length.

### 6.2 Effective trail length

Because the fade is multiplicative, a contribution laid down `k` frames ago is attenuated by
`decayFactor^k`. The number of frames before a contribution falls below a visibility threshold `ε` is

```
  k = ln(ε) / ln(decayFactor)
```

which is why the control is so non-linear in feel: at 0.9 a contribution is at 35 % after ten frames,
at 0.99 it is at 90 %, and at 0.0 each frame is drawn clean. This single control is the one most
responsible for a preset's "feel".

### 6.3 Two overrides, and both make the real trail shorter than the handle says

1. **An additive material caps the decay.** An additive deposit accumulates without limit, so on any
   pixel the figure revisits the sum would saturate to flat white. The engine therefore clamps
   `decayFactor` to a cap while such a material is active. ⚠️ **Decay values cannot be tabulated
   per-preset** for this reason: the same stored number means different things with and without an
   additive material.
2. **TransMap's `Fluid Feedback` style replaces it** with its own `Trail Persist`, because that style
   is itself a feedback loop and two nested ones would compound unpredictably.

### 6.4 Warp First

The warp (stage 7) normally runs *after* this frame's particles are drawn. `Warp First` runs it
**before**, so only the accumulated trail is displaced and the current particles stay crisp — a flowing
wake behind a solid subject.

> ⚠️ **It needs a long trail to show.** On a preset whose trail lives one frame there is no history to
> displace, and both orders produce identical output.

---

## 7. Stage 7 — Translation Map: Warping the Image

### 7.1 The chain model

The warp is a **lens on the finished image**: it bends pixels and never moves a particle. It is built
as a chain of layers, and the twelve styles belong to **three domains** that combine differently.

| Domain | Styles | How it reaches the image |
|---|---|---|
| **field** (9) | Wave Shift, Wave Zoom, Zoom Overlay, Zoom Combined, Procedural Flow, Fluid Feedback, Density Refraction, Vortex, **Conformal** | each produces a displacement `δ(u)` per pixel; **all field layers are summed** and applied in one pass |
| **modifier** (3) | Time Warp, Band Split, Depth Parallax | produces **no displacement**; modifies how the summed displacement is applied. Requires a field layer to exist |
| **colour** (1) | Fractal Feedback | a **separate pass** that feeds the image back into itself; runs before or after the warp pass |

⚠️ **`Conformal` is a FIELD style even though a complex map is naturally a coordinate REPLACEMENT, and
the difference is what makes it mixable.** It is applied as `off = f(z) − z`, so it sums with every
other layer and `weight`/`ChainMix` 0 is the exact identity. **Accepted cost, stated rather than
hidden: at an intermediate weight the displacement is partial and the map is therefore NOT
angle-preserving.** Conformality holds at full weight only. The alternative — a coordinate-replacement
style like `Fractal Feedback` — cannot be mixed at all.

⚠️ **Its plane is normalised on `min(w, h)` on BOTH axes.** A per-axis normalisation would turn every
circle into an ellipse and make the word *conformal* false in the one place it is the entire point.

⚠️ **The row that picks the function is labelled `Function`, not `Map`** — the dye's own mapping row is
also called `Map` and is visible in the same tab, so two unrelated dropdowns once shared one word.

⚠️ **THE DISPLACEMENT IS SOFT-NORMALISED, AND WITHOUT THAT TWO OF THE FOUR MAPS ARE UNUSABLE.** Measured
over the frame in UV, where 1.0 is a whole frame: `power` displaces by a median 0.30, `logPolar` 0.38 at
a p95 of 0.98, and `inverse` **1.59 at a p95 of 5.20 and a maximum of 60**. So the magnitude is passed
through `x/(1+x)` against a one-frame cap — **soft rather than clamped, because a clamp puts a derivative
discontinuity at the cap and that reads as a visible ring.** `refractOffset()` makes the same choice for
the same reason.

⚠️ **A map must displace without TRANSLATING, and a MEAN is the wrong statistic for checking it.**
Log-polar maps the plane to a *strip*: centring it brought its mean offset from −0.482 UV to −0.016 and
the figure was still pushed off screen, because zero mean with a whole frame of spread still empties one
side. **The magnitude distribution is the statistic that decides.**

⚠️ **A conformal layer RESAMPLES THE TRAIL, so it compounds frame over frame on an accumulating preset.**
On a body with `decayFactor` 0.37 plus a box-fold's density pile-up it saturates the frame to white, and
*lowering* its weight makes that worse rather than better — which is the signature of a feedback loop
rather than of a value set too high. **Judge an image-domain warp on a preset with no accumulation
first, then add accumulation deliberately.**

⚠️ **`z^n` takes INTEGER exponents only.** A fractional one puts a branch cut along one ray — a hard
radial discontinuity in a warp whose selling point is smoothness. **The deliberate seam comes from
log-polar instead**, where the branch is the logarithm's own: two members, two characters, no
ambiguous middle.

⚠️ **`1/z` IS SAFE HERE AND THE SAME FORMULA IS GATED OUT IN MODEL SPACE.** Inversion destroys depth
ordering, which is why it fails the depth gate as a 3D deformation; in image space there is no depth
left to destroy. **Never cite one as precedent for the other.**

⚠️ **`Time Warp` has THREE lag sources, not two** — the summed offset's magnitude, the trail's own
alpha, and a **coordinate** (x, y or radius). The third makes the lag a function of *where* a pixel is
rather than of what is in it, which is the one place the temporal axis enters the warp stage.
**It is a temporal GRADIENT, not a set of distinct instants**: the history is one frame blended
recursively, so a region's past is an exponential smear whose depth varies across the frame.

The sampled result for a field chain of `L` layers with weights `wᵢ`, under the master `ChainMix`:

```
  δ(u)      = ChainMix · Σ  wᵢ · δᵢ(u)
                         i=1..L

  out(u)    = in( u + δ(u) )
```

Two consequences follow directly from that sum:

- **Field layers add.** Pointing the same way they reinforce; opposing they cancel. One strong plus one
  light reads as structure; two strong layers tend to flatten each other.
- **Their order in the list is irrelevant** — addition is commutative. The only real ordering choice is
  warp-versus-echo for the colour style.
- **`ChainMix = 0` is visually identical to the pass being off**, which makes it the A/B control;
  `Enable` is the only true bypass.

Each style appears **at most once** in a chain, so a chain is a set of different operators rather than a
stack of repeats — "more of the same" is a weight, not a second layer.

### 7.2 The displacement unit

Every style's strength is expressed as a fraction of **8 % of `min(w, h)`**. One unit therefore means
the same visual amount in every style, at every resolution, and in a preview tile.

> ⚠️ **An image-domain operator must measure length on one shared scale, and `min(w,h)` is that
> scale.** Measuring one component against width and another against height makes a *shape* change
> masquerade as a strength change, and a parity oracle built the same way inherits the defect — only a
> property test across several canvas aspect ratios catches it.

### 7.3 The wave field

The four **wave styles** are the only ones whose field is authored rather than generated, and the
Transmap tab is where that authoring happens. The field is a sum of four terms per direction, each
written with a chosen **wave shape** `s`:

```
             4                                        4
  Wx(u) =    Σ  aₖ · s(2π · fₖ · u_x + drift)         Wy(v) =   Σ  bₖ · s(2π · gₖ · v_y + drift)
            k=1                                      k=1
```

- **Amplitudes add** within a direction, and the total is then scaled by **Strength**.
- **`Strength = 0.5` is neutral** — the preset's terms exactly as authored. 0 sits mid-track and means
  no warp; **below 0 the same field is inverted**, every offset pointing the other way at the same size.
- **Whole-number frequencies close seamlessly** across the frame; fractions do not, leaving a visible
  discontinuity at the edge, which several library presets use deliberately.
- **In the shift half a frequency of 0 makes a term inert** however large its amplitude — a wave that
  repeats zero times is flat. **In the zoom half an amplitude alone is enough**, and frequency 0 gives
  a steady zoom with no oscillation.
- **Drift** advances the phase rigidly at a rate in grid cells per second, so the field slides without
  changing shape or size.

#### The five wave shapes

`s` is `Math.sin` by default and is one of five functions, blended toward `sin` by a continuous
**`Shape mix`** in `[0, 1]`. All five are built to agree with `sin` in period and in peak amplitude, so
a shape changes the field's *character* and not its reach.

| Shape | `s(a)` | Continuous | What it makes |
|---|---|---|---|
| **Sine** | `sin a` | yes | the identity, and what every preset in the library is built on except the eight wave-shape demos |
| **Triangle** | `1 − 4·\|frac(a/2π + ¼) − ½\|` | yes | linear ramps instead of curves: the lens profile gets straight sides and a crease at each extreme |
| **Trapezoid** | the triangle at twice the slope, clipped to ±1 | yes | the crease becomes a **plateau** — flat regions of constant displacement separated by linear ramps |
| **Square** | `sign(sin a) \|\| 1` | **no** | two displacement values and nothing between them: hard rectilinear blocks |
| **Sawtooth** | `2·frac(a/2π) − 1` | **no** | a monotone ramp then a jump — the only shape here that is not even |

⚠️⚠️ **`Shape mix: 0` AND `Shape: Sine` ARE BOTH THE IDENTITY, DELIBERATELY, AND NOTHING COUPLES THEM.**
Two independent identities give the wave builder two ways to take the fast path, and they mean **a user
who picks a shape and leaves the mix at 0 sees nothing at all.** That is the most likely first-use
confusion in the feature, and the remedy is a notice line under the row — *"Shape mix is 0, so the field
is still Sine"* — **not** a shape pick that implies a non-zero mix. **Do not couple the two fields.**

⚠️ **The mix clamp is NaN-safe by its shape, not by `min`/`max`.** The test is `mix > 0`, which is false
for `NaN`, so a hand-edited import carrying a non-numeric mix takes the identity arm instead of turning
the whole wave array — and from there the displacement texture — into NaN. `min(1, max(0, NaN))` is
`NaN` and would not do this.

⚠️⚠️ **`Square` AND `Sawtooth` ARE A DIFFERENT CLASS, NOT MERELY A LARGER NUMBER.** A discontinuous
field **cuts the image rather than bending it**: adjacent pixels are sampled from positions far apart,
so the warp tears. That is the point — nothing else in the engine makes hard rectilinear structure — and
it is stated in words rather than in pixels because the magnitude is a measurement that moves with the
frame size. Two notice lines carry it, and a zoom style scales the cut by distance from the centre, so
the tear grows toward the edges. **Which shapes tear is read from one table, never from a second
hand-typed list.**

⚠️ **`Triangle` and `Trapezoid` are refinements of sine rather than new categories.** Measured against
sine's own sampling floor, the trapezoid sits inside it; only `square` and `sawtooth` leave it.

⚠️⚠️ **TWO SHAPES DO NOT SHARE SINE'S ZERO AT THE ORIGIN, WHICH IS WHY A FREQUENCY-0 TERM IS EXEMPT.**
`square(0) = 1` — not 0, and `sign(0)` is 0, which is forced to 1 so the field cannot drop to zero at a
crossing and put holes in the pattern — and `sawtooth(0) = −1`. So a term whose argument is identically
0 would acquire a DC offset it does not have on the sine path. Both builders exempt such a term, and
**that exemption covers both shapes: do not narrow it to `square`.**

⚠️ **The shape applies in BOTH regimes — on a named pattern and on the preset's own terms alike — which
is the opposite of `Detail`'s treatment.** The asymmetry is deliberate: a shape is a transformation *of*
the author's table, where `Detail` would be a rescaling of frequencies the author chose. The named risk
— that a table's frequencies were authored for sine — is said out loud by a third notice line rather
than prevented.

⚠️ **The shift half and the zoom half carry independent pairs**, because they are two different
functions: the shift tables go through one builder and style 3's zoom tables through another, which
carries a DC bias term the first does not have. **Crossing the two pairs is silent.**

⚠️ **`Strength` re-solves itself as the mix moves**, so the warp keeps its measured peak while the shape
changes — **except on `Macrolense` and `Distant Lense`**, which carry absolute amplitudes and skip the
gain solve, so there the size moves with the shape.

⚠️ **The identification line at the foot of the tab names the shape as well as the table.** Without that
clause it would report `Grid Lattice` for an image the author sees as a square mosaic. It stays silent
while the shape is inert, by the same `mix > 0` test, because at mix 0 the picture really *is* the sine
field the pattern names.

#### The nineteen named patterns

A named pattern replaces the preset's terms with a ready-made table and **re-solves its own size on
every canvas**. The tables below are the authored amplitudes and frequencies, which is what makes each
one's character predictable. **The table is the whole of a pattern** — the wave shape is stored beside
it on the layer, so any pattern can be drawn with any shape.

| Pattern | X (amp @ freq) | Y (amp @ freq) | Character |
|---|---|---|---|
| **Coarse Swell** | 1 @ 1 | 1 @ 1 | one lens over the whole frame — the gentlest, and the most used value in the library |
| **Macrolense** | 1 @ 0.5 | 1 @ 0.5 | half a cycle: part of one very broad lens |
| **Distant Lense** | 1 @ −0.5 | 1 @ −0.5 | the inverse of Macrolense |
| **Vertical Ripple** | — | 1 @ 8 | eight parallel ripples on one axis only; the most common legacy field |
| **Horizontal Ripple** | 1 @ 8 | — | the same, rotated 90° |
| **Grid Lattice** | 1 @ 6 | 1 @ 4 | crossing ripples make a regular lattice of lenses |
| **Fine Mesh** | 1 @ 16 | 1 @ 16 | the densest lattice; reads as texture rather than shape |
| **Interference** | 1 @ −1 | 1 @ 1 | equal and opposing: one broad counter-turning cell |
| **Diagonal Shear** | 1 @ 4 | 1 @ −4 | equal and opposing at higher frequency: the picture leans |
| **Cross Shear** | 1 @ 2 | 1 @ −1 | opposing with one axis twice as fine: an uneven lean |
| **Broad Over Fine** | 1 @ 8 | 1 @ 1 | fine on one axis, one swell on the other |
| **Turbulent Weave** | 1, ½, ¼, ⅛ @ 1, 2, 4, 8 | same | an octave series: a coarse shape carrying its own fine detail |
| **Harmonic Cascade** | 1, ½, ¼, ⅛ @ −1, −2, −3, −4 | same, positive | a *harmonic* series in antiphase: many lobes, unevenly spaced |
| **Ember Cascade** | 1, ½, ¼, ¼ @ 1, 8, 16, 14 | same | one broad swell carrying three fine ripples; the 16-against-14 near-miss makes it shimmer |
| **Prime Comb** | 1, 1, 1, 1 @ 2, 3, 5, 7 | same | pairwise-coprime frequencies never realign, so the field never exactly repeats |
| **Beat Swell** | 1, −1, ½, −½ @ 0.1, 0.101, 0.505, 0.5 | same | nearly-equal frequencies beat against each other: the field swells and fades over time |
| **Brick Weave** | 1, 0.35 @ 7, 3 | 1, 0.35 @ 3, 7 | the one **crossed** pair: fine striping on one axis over a coarse swell on the other, which reads as a brick course rather than a lattice |
| **Oblique Lattice** | 1, 0.4 @ 3, 7 | same | the **mirrored** 3:7 pair — a broad ridge carrying a second harmonic well above its octave, so it reads as organic flowing ridges rather than as a grid |
| **Terraced Swell** | 1, 0.3 @ 2, 5 | same | the mirrored 2:5 pair: two broad cells per axis with a non-harmonic fifth riding them, so the contours never realign. **Designed for `Trapezoid`**, under which it reads as stepped terraces |

⚠️ **Those last three are DESIGNED rather than distilled, and that is a difference in kind.** The
sixteen above were distilled from the legacy library and their case was coverage — they add
identifications. These three add **none**: measured over every live table layer and every library table,
the identification counts are the same before and after. Their case is the other one, *a field an
author cannot otherwise reach in one click*, and each is a **two-live-slot mirrored or crossed pair**,
a shape the first sixteen do not contain at all — every one of those is one live slot per axis, or four.
**Do not grade them by coverage and do not "fix" the zero.** Measured distinctness: each sits 0.82–0.88
from its nearest existing archetype on a magnitude-blind field distance, against **0.491** for the two
closest of the shipped sixteen, i.e. each is further from the library than the library is from itself.

⚠️ **None of the three carries absolute amplitudes**, deliberately: that flag is only correct for a
shape transcribed from a real authored table, where the author's amplitude *is* the design. These take
the normalised gain, and their amplitude sums are not 1 — which is exactly why flagging one later to
answer a `Strength` complaint would make it identify at a scale that no longer equals its required
strength, silently.

> ⚠️ **A named pattern is canvas-adaptive; typing a term freezes it.** The terms shown under a named
> pattern are the numbers it *solved* for the current window. Editing one adopts those numbers as fixed
> values at that window size, and the readout changes to `(Preset) — edited`.

> ⚠️ **The wave terms are the PRESET's own two tables and are shared by every layer in the chain.** The
> per-layer settings — style, pattern, strength, drift, zoom centre — are per layer, but a term typed in
> the Transmap tab moves every layer that reads `(Preset)`.

#### The four wave styles

| Style | Operation |
|---|---|
| **Wave Shift** | `δ = ( Wx , Wy )` — a pure translation per pixel. Nothing changes size |
| **Wave Zoom** | `δ = (u − c) · W(u)` — displacement along the ray from a centre `c`, so the image breathes in and out |
| **Zoom Overlay** | the same zoom, composited **over** the unzoomed image rather than replacing it: both are visible at once |
| **Zoom Combined** | a shift and a zoom together, each from **its own** set of four-plus-four terms, with its own `Zoom Strength` and a `Zoom Bias` constant added under the oscillation |

`Zoom centre` is in percent of the frame and is read by the three zoom styles; **Wave Shift ignores
it**. ⚠️ `Zoom Combined`'s two halves are genuinely separate fields, not one field at two detail
levels — which is what lets the shift and the zoom be set to oppose each other.

#### The four orientation angles

Each wave is sampled along a direction of its own. **Angle X** and **Angle Y** set the two shift waves'
directions in degrees, and `Zoom Combined`'s zoom half carries a second pair, **Zoom Angle X / Y**,
because it is built by a separate pass over a separate set of terms. All four default to 0, where the
two sampling directions are at **right angles**: the Y wave's quarter turn is baked into the index
(`WAVE_QUARTER_TURN`), which is what makes `0, 0` the orthogonal pair rather than a parallel one, and
what makes the default field bit-for-bit the one the engine draws with no orientation control at all.

**The rotation enters as an INDEX, never as a second field.** The field is still two 1D tables, one per
direction, and an angle changes only which entry of its own table a pixel reads:

```
  unrotated   i = x                                              (an X wave; y for a Y wave)
  rotated     t = centreIndex + (x − w/2)·cos θ + (y − h/2)·sin θ
              W = lerp( table[⌊t⌋], table[⌊t⌋+1], t − ⌊t⌋ )
```

- **The pivot is the FRAME centre, and it is not the zoom centre.** The zoom centre is a per-layer
  control read only by the three zoom styles' radial scaling; the wave's phase origin has never
  depended on it, and rotating about it would couple the two for every preset that authors one. The two
  quantities are spelled differently everywhere they meet.
- **Angle 0 is a BRANCH, not a rotation by zero.** `cos 90° = 6.12e−17`, not 0, so a Y wave "rotated by
  zero" would read `h/2 + 6.12e−17·(x − w/2) + (y − h/2)`, which is not `y`. Bit-identity is not
  algebraic identity, so 0 takes the pre-rotation expression verbatim — one branch per build, never a
  weight.
- **The rotated index is FRACTIONAL, so the sample is a 2-tap lerp.** An unrotated index recovers its
  texel exactly (a pixel centre is `(i + ½)/n`, so the floor is exact); a rotated coordinate recovers
  nothing exactly. Nearest-neighbour would stair-step along the wave's own iso-lines, which reads as a
  **stipple** on a high-contrast trail. The lerp is *arithmetic*, not a filter mode — the wave texture
  stays `NEAREST` and the fetch stays a texel fetch, so `Square` and `Sawtooth` cannot be smoothed by
  accident.
- **There are FOUR index consumers and they must agree**: the GLSL sampler that builds the image, the
  CPU sampler the force gate reads, and **both** gain solves — the one serving the first three styles
  and `Zoom Combined`'s joint one. A rotation added to one and forgotten in another leaves every
  per-style text check green while the gain is solved against a field nobody renders; the realised peak
  then lands up to **30.1 %** off target, so it is a visible defect and not a rounding question.
- **The solved gain really does depend on the angle**, which is why all four angles enter the chain
  signature as *values*. Measured on `Turbulent Weave` under `Wave Zoom`: `0/0` → 0.0521, `30/0` →
  0.0439, `45/−20` → 0.0449, `90/90` → 0.0450, a spread of **1.186×**. Reducing one to an on/off bit
  would freeze the field mid-drag at the last rebuilt orientation, and an omission would also leave the
  wave texture's width describing a texture of a different size.

⚠️⚠️ **THE TABLE'S LENGTH AND THE PHASE ORIGIN'S AXIS LENGTH ARE TWO QUANTITIES, AND NOTHING MAY FOLD
THEM INTO ONE.** A rotated sample ranges over the frame's **diagonal**, so the table has to widen from
`max(w, h)` to `hypot(w, h)` — **+14.7 %** at 1920×1080 — which with the guard texel the 2-tap lerp
needs makes the table **2207** entries wide against that axis's 1920. But the phase constant that
anchors a wave to the frame centre takes an **axis**
length — `width` for an X wave, `height` for a Y wave — and widening *that* along with the table **moves
the field**: the displacement is exactly `(tableLen − axisLen)/2`, i.e. **143.5 px on X and 563.5 px on
Y** at 1920×1080, independent of frequency, which on a two-harmonic table whose amplitude sum is 1.35 is
a change **larger than the wave itself** — and it happens at **angle 0**. So the index carries three
separately named fields: `length` (the table), `anchorLen` (the axis, and the anchor's only legal
argument) and `origin` (the axis coordinate that table entry 0 holds), with `centreIndex` precomputed as
`anchorLen/2 − origin`. That is invariant 26 — *correct once per quantity* — applied to the one
expression that writes a frequency scale and a phase origin on the same line, where each of the two is
silent when it is wrong.

⚠️⚠️ **THE WIDENING IS GATED ON `angle ≠ 0`, AND THAT GATE IS AN ALLOCATION CHOICE ONLY.** It is not the
fix for the defect above and must never be read as one: the split is the fix. The table's *content*
provably does not depend on its length — the rotated path run at angle 0 against a table widened anyway
agrees bit-for-bit at every axis coordinate, **602,424 comparisons over 432 tables at `max |diff| = 0`**
— which is what proves 0° does not jump to 1°. A shape-invariance property test cannot establish this:
it passes for a field that is correctly shaped and wrongly placed.

⚠️⚠️ **A PARALLEL PAIR MAKES `Zoom Overlay` CANCEL ANALYTICALLY, SO THE GAIN SOLVE NEEDS A DERIVED FLOOR
AND NOT A `peak ≤ 0` TEST.** That style scales the ray by `dz = −(Wx + Wy)/2`. At angle 0 the two waves
are indexed by *different* coordinates and cannot cancel; a **parallel** pair (`Angle Y = Angle X − 90°`)
puts them on one axis, and for the seven patterns whose two axes carry the same table up to sign —
`Interference`, `Diagonal Shear`, `Harmonic Cascade`, `Fine Mesh`, `Coarse Swell`, `Prime Comb`,
`Turbulent Weave` — `Wy ≡ −Wx` and `dz` is **identically zero**. Measured on `Interference` at
`45 / −45`: the unit-gain probe peaks at **1.454e−12**, so dividing by it gives a gain of **2.972e+13**
— round-off amplified thirteen orders into the displacement texture and then normalised to the *right
magnitude*, which is the dangerous part: the field would not look obviously broken, it would simply have
noise instead of a wave for its structure. `peak ≤ 0` does not catch that, because the peak is **small,
not zero**.

The discriminator is `peak / (mag · rad)`: the measured peak against the peak the field would have had
if nothing cancelled, where `mag` bounds `|Wx| + |Wy|` over the grid and `rad` is the furthest the grid
reaches from the zoom centre. Over the whole pattern × style × angle-pair sweep that ratio is **≤
3.57e−15 on every cancelled configuration and ≥ 6.42e−4 on every healthy one — a gap of 1.8e+11** —
with `GAIN_CANCEL_FLOOR = 1e-9` inside it. **Returning 0 there is the honest answer rather than a
fallback:** the field really is identically zero, so no warp is the correct render, and the remedy is the
notice line under the row, because clamping or refusing a degenerate orientation would hide a control
instead of naming a risk. `mag = 0` reduces the test to the original `peak ≤ 0`, so a genuinely silent
table is unaffected.

⚠️ **The refused band has NO WIDTH IN DEGREES, which is what makes it a guard on an arithmetic event
rather than on a configuration.** Separation against realised peak: `0°` → 0.00 px, and `0.001°`,
`0.01°`, `0.1°`, `1°` and `5°` all → 43.20 px against a 43.20 px target. An angle predicate would have
had to pick a width, and every pair inside it would have lost a field that is real and merely
one-directional.

⚠️ **`Zoom Combined`'s joint solve deliberately has NO floor, and that is a measurement rather than an
omission.** It measures `hypot( Wy + (x − cx)·dz , Wx + (y − cy)·dz )`, which keeps the shift half as
separate `hypot` components — so a cancelled zoom pair removes the zoom and leaves the shift standing.
The worst style-3 amplitude over the same sweep is **31.0**, where a blown gain shows as ~1e13. A guard
there would be a clause for a gap that has never been shown to fire, which is itself the gap.

⚠️⚠️ **THE ANGLE TEST IS `!Number.isFinite(a) || a === 0`, AND THE ORDER OF THE TWO HALVES IS THE
GUARD.** `a === 0` is false for `NaN`, so written the other way round a non-numeric angle from a
hand-edited import takes the **rotated** arm: `cos` and `sin` are NaN, `⌊NaN⌋` passes **both** bound
tests because every comparison against NaN is false, the table read is `undefined`, and the wave array —
and from it the displacement texture — goes NaN. **No sanitiser on the screen path reaches that.**
`Math.min(90, Math.max(−90, NaN))` is NaN, so a clamp does not fix it either: the predicate has to be
*is this a usable non-zero angle*, answered once per build rather than once per sample.

⚠️ **The range is ±90° and never 0–360°, for two independent reasons — a reader who finds only one of
them will widen it.** `(angle + 180°, −amp)` is the same composed field at every pixel, so a full circle
would offer every distinct field twice; that makes ±90 a **completeness** claim rather than a
convenience. And ±90 has no wrap, which is what lets the Mixer interpolate an angle with a plain `lerp`.
`WAVE_ANGLE_MAX` is the range the control spans and the range the blend is correct over — it is not a
clamp, and nothing clamps a stored angle, so an imported 120° parks the handle at the end of the travel
and keeps rendering at 120° until it is dragged.

⚠️⚠️ **THE POSITION STEP IS `1/128` — A NEGATIVE POWER OF TWO — AND THE REASON IS A BROWSER FINDING, NOT
A TASTE.** `1/90` is the obvious choice and it makes **+90° unreachable in Chromium**: a form control's
stepping is evaluated in base-10 `Decimal`, and the allowed stops are `min + k·step` that are **≤ max**,
with an overshooting stop **refused** rather than clamped. In exact decimal
`−1 + 180 × 0.011111111111111112` is `1.00000000000000016`, which exceeds `max`, so `k = 180` is refused
and the handle at the end of the travel reads **89°**. In IEEE doubles that same expression is exactly
`1`, so every double-precision model of the grid reports the track as perfect — the defect is reachable
only from a real browser. A negative power of two is exact in **binary *and* in decimal**
(`−1 + 256 × 0.0078125 = 1`), so the grid closes at both ends under either arithmetic.
`WAVE_ANGLE_STEP` is derived from `WAVE_ANGLE_MAX`, so widening the range moves the resolution with it;
the exponent is the smallest that keeps the increment at or under one degree per stop, **0.703°**.
The stored value is quantised to whole degrees, so all **257** stops land on one of exactly **181**
reachable angles, both ends and 0 included — and 0 must be exactly reachable, because the identity is a
branch on it.

⚠️ **Baking a named pattern into editable terms carries all four angles, and needs no stored field of
its own.** The bake solves the pattern's amplitudes at the live window *through the same index mapping*,
because a bake taken under a non-zero angle must solve at that angle or the stored amplitudes describe a
differently-oriented field. The patch is then applied over a base of **all fifteen** static-field
settings, so the four angles ride along with the eleven others; narrowing that spread to the keys the
bake writes would silently reset them.

### 7.4 Procedural Flow

A generated flow field rather than an authored one. Where the static family reads its displacement from
two 1D wave tables ([§7.3](#73-the-wave-field)), this style **evaluates a full-resolution field in a
fragment shader** from six numbers, and renders it into a displacement texture the chain then adds like
any other layer.

#### The field equation

Everything is computed in `q`, an **isotropic** space, never in raw UV — the subsystem's length scale is
`min(w, h)`, and there are three separate correction sites (input domain, radial direction, output
units) because they are three different quantities (invariant 26).

```
  aspect  = (w, h) / min(w, h)                       (1,1) on a square canvas
  q       = uv · aspect                              pixels over one shared length scale
  p       = 2 · (q − ½·aspect)                       centred, isotropic — the radial origin

  curl(q,t) = ( ∂n/∂y , −∂n/∂x ) · 0.1               n = snoise( q·Scale , t·EvolSpeed )
  straight  = ( Direction + Radial · p/|p| ) · 0.1

  δ_iso   = ( (1 − Curl)·straight + Curl·curl ) · Strength
  δ_uv    = δ_iso / aspect                           what the warp samples
```

The noise derivatives are central differences at `eps = 0.01` in noise-coordinate space. ⚠️ **That is a
different epsilon from the particle-side curl field of [§2.1](#21-curl-noise)** — same operator, two
subsystems, two domains; neither figure transfers.

Three readings of that equation matter more than the algebra:

- ⚠️ **`Radial` lives INSIDE the `(1 − Curl)` blend, not beside it.** It is part of the *structured*
  term, so **raising Curl fades the radial component out along with the straight one** — at `Curl = 1`
  there is no sink and no source left, only circulation. A spiral is therefore a *middle* setting, never
  an extreme one.
- ⚠️ **`Scale` is a FREQUENCY, so the control reads backwards from its name.** It **multiplies** the
  noise coordinate, so **higher Scale = smaller, more numerous eddies**; at 0.1 the whole canvas sits
  inside a fraction of one noise cell and the "flow" is a nearly uniform push.
- **`Direction` is not normalised by the field**, only by the slider. The shader uses the vector's own
  length, so a `[0, 0]` direction means *no straight term at all* — not "a straight term pointing
  right".

| Control | Stored as | Range (step) | What it does |
|---|---|---|---|
| **Strength** | `strength` | 0 – 1 (0.01) | the whole field's gain. 0 is a true bypass of this layer |
| **Scale** | `scale` | 0.1 – 5 (0.1) | noise **frequency**: higher ⇒ finer eddies. See the warning above |
| **Curl Amount** | `curlAmount` | 0 – 1 (0.01) | blends *structured* (straight + radial) → *circulation*. This is what turns a push into a swirl, and what deletes the radial term on the way |
| **Direction** | `direction: [x, y]` | 0 – 360° (1°) | heading of the straight term. **Stored as a unit vector, edited as an angle** — `[cos θ, sin θ]`, and `+y` is **down** in UV, so 270° reads as *up* on screen |
| **Radial** | `radial` | −1 – +1 (0.01) | a sink (negative) or source (positive) about the frame centre, in isotropic units |
| **Evol. Speed** | `evolutionSpeed` | 0 – 2 (0.01) | multiplies time into the noise's third axis. **At 0 the field freezes** and the image settles into a static distortion |

#### The twelve archetypes

An **Archetype** is a named starting point: selecting one writes all six values at once. They are
parameterisations of the single equation above and nothing more — there is no per-archetype code path.

| Archetype | Strength | Scale | Curl | Direction | ⇒ angle | Radial | Evol. | What the shape is |
|---|---|---|---|---|---|---|---|---|
| **Fire Rise** | 0.40 | 1.2 | 0.30 | `[0, −1]` | 270° (up) | 0 | 1.2 | mostly straight lift with a little wander — flames rather than smoke |
| **Smoke Drift** | 0.25 | 2.0 | 0.60 | `[0.3, −0.95]` | 287.5° | 0 | 0.5 | curl-dominant and slow, with a gentle up-and-right lean |
| **Vortex** | 0.50 | 1.5 | 0.90 | `[0, 0]` | — | 0 | 0.8 | near-pure circulation. The only archetype whose curl is high enough to be *called* a vortex |
| **Expansion** | 0.35 | 1.0 | 0.20 | `[0, 0]` | — | **+1.0** | 0.6 | a source: everything pushed outward from centre, barely stirred |
| **Implosion** | 0.40 | 1.0 | 0.20 | `[0, 0]` | — | **−1.0** | 0.6 | the same field inverted — a sink |
| **Wind Shear** | 0.50 | 0.8 | 0.40 | `[1, 0]` | 0° (right) | 0 | 1.0 | the coarsest noise in the set over a strong lateral push: broad sideways slabs |
| **Thermal Column** | 0.60 | 1.8 | 0.50 | `[0, −1]` | 270° (up) | **−0.3** | 1.5 | rise plus mild inward pull — a chimney that narrows as it climbs. Fastest-evolving of the lifting shapes |
| **Ocean Current** | 0.30 | 3.0 | 0.70 | `[0.7, −0.7]` | 315° | +0.1 | **0.3** | the finest field (Scale 3.0) at the slowest evolution — many small eddies drifting almost statically |
| **Chaos** | 0.70 | 1.0 | 0.80 | `[0, 0]` | — | 0 | **2.0** | curl at the top of the evolution range: the field itself rewrites faster than the image can settle |
| **Gentle Drift** | 0.15 | 2.5 | 0.50 | `[0, −1]` | 270° (up) | 0 | 0.4 | the weakest strength in the set — an upward shimmer rather than a flow |
| **Strong Expansion** | 0.80 | 0.7 | **0.10** | `[0, 0]` | — | **+1.0** | 0.4 | `Expansion` with twice the gain and almost no curl: a clean radial blast |
| **Strong Implosion** | 0.90 | 0.7 | **0.10** | `[0, 0]` | — | **−1.0** | 0.4 | the strongest field in the set, and the cleanest drain |

Reading the table as a set is more useful than reading any row: **the twelve occupy only part of the
reachable space.** No archetype uses `Curl = 0` (pure translation), none exceeds `Strength 0.9`, none
pairs a strong radial with a strong curl — which is the spiral the equation can make and no preset
selects — and six of the twelve have **no straight term at all**.

Three behaviours of the Archetype control itself are worth knowing, because none of them is visible on
screen:

- **Editing any parameter flips the dropdown to `Custom`.** The archetype name records *where the values
  came from*, not a constraint on them, and it is what the preset serialises. Selecting `Custom` from the
  dropdown is deliberately a **no-op** — there is nothing to restore.
- ⚠️ **The Direction readout cannot show "no direction".** Six archetypes store `[0, 0]`, for which the
  angle is `atan2(0, 0) = 0`, so the handle sits at **0°** — indistinguishable from a real rightward
  push. Worse, the slider always writes a *unit* vector, so one nudge takes the straight term's magnitude
  from 0 to 1 and the shape changes far more than one degree's worth. This is invariant 13's second
  shape: the control moves the right thing, and the **output channel cannot represent the state**.
- ⚠️ **The module default is labelled `Gentle Drift` and is not Gentle Drift.** A fresh flow layer starts
  at `strength 0.30, scale 1.5, curl 0.50, dir [0,−1], radial 0, evol 0.80` while reporting *Gentle
  Drift* in the dropdown — **three of the six values differ**: Strength 0.30 against the archetype's
  0.15, Scale 1.5 against 2.5, Evol. Speed 0.80 against 0.4 (Curl, Direction and Radial do match). So
  re-selecting the named archetype *changes* the field, and two source comments that call the default
  "`Gentle Drift`" are describing the label rather than the numbers. Read the values, not the name.

### 7.5 Fluid Feedback

A warp that feeds into its own next frame, which is what turns a displacement into a *current* that
keeps flowing after the figure has moved on. It is the only warp style whose displacement comes from a
**simulation with memory** rather than from a closed-form field: the particles deposit their motion into
a velocity field, the field diffuses and decays on its own clock, and the warp reads it back.

The field is a **512 × 512 `RGBA16F` texture**, ping-ponged, holding a 2D vector per texel in the `R`
and `G` channels. ⚠️ **Its unit is a per-frame DISPLACEMENT in UV, not a velocity** — invariant 10 at a
subsystem boundary. Nothing in the loop multiplies by `dt`, because the deposit is already a
per-frame quantity; a consumer that treats it as a velocity has to convert, and exactly one does.

#### The per-frame algorithm

**Step 1 — deposit (CPU-prepared, GPU-splatted).** For every particle, this frame's screen motion
becomes a field contribution:

```
  v_raw   = ( dx/w , dy/h ) · 0.08            dx, dy = this frame's pixel motion
  v_raw   = 0                  if dx² + dy² ≥ 900 px²      ← teleport guard
  v_ema  ← v_ema·(1 − 0.3) + v_raw·0.3        exponential smoothing, α = 0.3
  e       = min(u, 1−u, v, 1−v) / 0.03
  fade    = min(e, 1)²                                     ← squared edge fade
  v_dep   = v_ema · fade
```

The teleport guard matters because a respawn or a preset change moves a particle across the frame in one
step; without it a single reseed injects an enormous impulse that the field then remembers for a second.
The **edge fade is squared** and applied at deposit time *as well as* at output, because the trail buffer
is `CLAMP_TO_EDGE` — anything that reaches the border is re-read every frame and accumulates there.

The deposit is drawn as `GL_POINTS` at `gl_PointSize = 6`, with a cone kernel and **additive blending**
(`ONE, ONE`) and **no clear**:

```
  w(P) = max( 0 , 1 − 2·|P − ½| )             P = gl_PointCoord
  field += v_dep · w(P)
```

**Step 2 — diffuse and decay.** Four passes of a 3 × 3 box blur, **and only the fourth multiplies by
`Field Decay`**; the first three are lossless spreads. Each pass spreads about one texel, so four give a
corridor roughly four texels wide:

```
  field ← mean( 3×3 neighbourhood ) · d         d = FieldDecay on the last pass, 1.0 on the others
```

Samples outside `[0,1]` are not counted in the mean, so the border is averaged over fewer taps rather
than against zero. The decay is geometric, so its half-life follows directly:

```
  t½ = ln 2 / (−ln d)  frames        d = 0.985 ⇒ 45.9 frames ≈ 0.77 s at 60 fps
                                     d = 0.95  ⇒ 13.5 frames ≈ 0.23 s
                                     d = 0.999 ⇒ 693 frames  ≈ 11.6 s
```

That range is the whole character of the control: at the bottom the field is a blurred copy of this
frame's motion, at the top it is a current with eleven seconds of memory.

⚠️ **The decay is PER FRAME, not per second — the step function is handed a `dt` and ignores it.** So
the half-lives in *frames* above are fixed and the ones in *seconds* are not: on a machine running at
30 fps the field remembers for twice as long in wall-clock terms, and the flow reads as noticeably
heavier. This is the opposite choice from the particle-side offsets of [§2.6](#26-fluid-advection),
which were explicitly converted to a continuous rate. **Quote this subsystem's memory in frames**, and
judge a style-6 preset at a known frame rate.

⚠️ **THE FIELD IS NOT MADE DIVERGENCE-FREE, AND THE CODE FOR DOING SO IS COMPILED BUT NEVER RUN.** Four
further shaders exist beside the blur — semi-Lagrangian advection, divergence, a Jacobi pressure solve
and gradient subtraction, the standard Navier–Stokes projection — and they are created at init, held,
and disposed without a single draw call. The step function runs **only** the blur. The projection was
replaced because divergence-free shear produced a visible electric jitter, which is a worse artefact
than the sources and sinks it removes. So: **a reader grepping for `Jacobi` here will describe a
pressure solve that does not happen**, and one consequence is real — this field *can* have sources and
sinks, and the glow in Step 3 is partly how that reads on screen.

**Step 3 — consume (in the chain shader).** The warp adds the field as one more layer offset, and the
same magnitude drives a brightness term:

```
  flOff    = field(uv).rg · weight · Amplify · 50
  edgeFade = smoothstep( 0 , 0.02 , min(u, 1−u, v, 1−v) )      only when a fluid layer is present
  strength = | flOff · edgeFade |                               measured PRE global Chain Mix
  glow     = GlowBoost · strength · 8
  rgb     += glow · rgb / (1 + rgb)                             self-limiting additive glow
  rgb     ·= edgeFade
```

The `× 50` is a unit conversion, not a taste constant: the field holds values around 0.001–0.01 UV, so
without it an `Amplify` of 10 would still be sub-pixel. The glow is written as `rgb/(1+rgb)` rather than
a plain multiply so that **it cannot compound inside the feedback loop** — the term saturates toward 1 as
the pixel brightens. ⚠️ **`strength` is measured before the chain's global `Chain Mix`**, which is why
turning Chain Mix down fades the *warp* while leaving the glow where it was; `Enable` off is the only
true bypass ([§7.1](#71-the-chain-model)).

**Step 4 — the trail override.** While a style-6 layer is live, this style **replaces the preset's own
trail decay** with its `Trail Persist`:

```
  trailDecay = active ? persist : preset.renderer.decayFactor
  trailDecay = min( trailDecay , materialAccumulationCap )      if a material is live
```

⚠️ **`active` means "the chain carries style 6 **and** that layer is enabled **and** its weight > 0"** —
not "the primary style is 6". ⚠️ **All three clauses are load-bearing: testing only the style leaves a
zero-weight layer pinning the trail to `persist` and the 512² simulation running, so its warp disappears
while its cost and its trail override do not.** The cap is applied with `min`, so it can only ever **shorten** a trail, never lengthen one.

**Step 5 — optional readback.** Every other frame, and **only if a CPU consumer exists**, the field is
read back (`readPixels`, 2 MB). The GPU warp reads the texture directly and needs no readback; the
consumers that do are particle advection ([§2.6](#26-fluid-advection)) and the liquid pool. Skipping it
when nothing reads it is the difference between a free effect and a synchronous stall every second frame.

#### The four controls

| Control | Stored as | Range (step) | Default | What it changes |
|---|---|---|---|---|
| **Trail Persist** | `persist` | 0.90 – 0.99 (0.01) | 0.96 | the **image** trail, overriding the preset's Trail Decay for as long as this layer is live. Nothing else in the chain touches the trail |
| **Warp Amplify** | `amplify` | 1.0 – 10.0 (0.1) | 1.0 | the loop gain — how far the field's displacement actually moves the image, and therefore whether the motion settles into a steady flow or keeps building |
| **Field Decay** | `fieldDecay` | 0.95 – 0.999 (0.001) | 0.985 | how long the **field** remembers, per the half-life table above. Clamped to that range on write, so an out-of-range import is pulled in rather than rejected |
| **Glow Boost** | `glowBoost` | 0 – 2.0 (0.05) | 0.0 | brightness added in flowing regions, scaled by the local offset magnitude — so it marks *where* the current is, not the whole frame. 0 by default, which is why the style reads as pure motion unless asked otherwise |

⚠️ **A fifth field, `dispersion`, is still in the type and is import-only.** Chromatic dispersion was
never a fluid quantity — the shader spreads its R and B taps along the *summed* chain offset, so it
modifies whatever warp is present — and being reachable only through a style-6 layer was a bundling
accident. It is now the chain-level `transMapDispersion` ([§7.10](#710-dispersion)); the old home is
read on import so older exports keep working, and nothing writes it any more.

**Two feedback loops, not one**, and keeping them apart is what makes this style tunable: `Field Decay`
is the loop inside the *velocity field* (Step 2), and `Trail Persist` is the loop inside the *image*
(Step 4). Either one alone produces something that looks like flow; the characteristic style-6 look —
motion that continues after the figure has left — needs both, and a runaway needs only one of them set
too high.

### 7.6 Density Refraction

Treats the image's own brightness or coverage as a **height field** and refracts through its gradient,
so the figure acts as its own lens. It is the first of the two styles that read the frame they are
warping: the height is sampled from the **trail texture**, which means the lens is built from the
*accumulated* image rather than from this frame's particles.

⚠️ **The height field has two sources.** `density` takes the trail's alpha — the particle shaders' shape
term, which is RGBA16F and therefore unbounded above. `luminance` takes the trail's luma, which follows the
bright core rather than the coverage.

⚠️⚠️ **Three BLUR levels were added here and removed the same day, and the reason is worth carrying.** They
read a level of bloom's pyramid, so the lens would have been built from a chosen *scale* of the image's
structure. Two real defects were found and fixed first — the level was never wired through, so every member
read one texture, and the sources were separately under-driven because the displacement is `m / (1 + m)` of
the gain and blurring reduces `m` in proportion to the mip's footprint. **After both fixes the levels
differed monotonically and still only at 1.0–1.7× a noise floor that could not be driven below ~10, because
the warp is a feedback loop whose churn exceeds the signal.** The owner cut them on that basis.

⚠️ **What is left unexplored is the normalisation, not the plumbing.** `m / (1 + m)` is what makes `Reach`
behave as softness — and it is also what flattens the difference a blurred input is supposed to make,
because a sharp field saturates it while a blurred one stays in its linear region.

#### The algorithm

```
  h(uv)   = Source(uv)                 density  → trail alpha (coverage)
                                       luminance → dot(rgb, (0.2126, 0.7152, 0.0722))

  texel   = Reach / (w, h)             Reach is in texels of the FULL-RESOLUTION frame

  ∇h      = ( h(uv + x̂·texel) − h(uv − x̂·texel) ,
              h(uv + ŷ·texel) − h(uv − ŷ·texel) ) / (2 · Reach)      central difference ÷ span

  m       = |∇h|
  δ_px    = (∇h / m) · m/(1 + m) · (−Invert) · Gain          Gain = Refract · 0.08 · min(w,h)
  δ_uv    = δ_px / (w, h)
```

Four details in that chain are each load-bearing, and three of them were missing from this section
before:

- ⚠️ **The difference is divided by `2 · Reach`, which is what makes Reach mean SOFTNESS rather than
  strength.** A central difference over `2·Reach` texels is a *difference*, not a derivative; dividing
  by the span turns it into a per-texel slope, so widening the stencil smooths the lens instead of
  strengthening it. Without that divide, Reach and Refract would be two controls for one quantity.
- ⚠️ **The magnitude is SOFT-normalised, `m/(1 + m)`, and that is not a clamp.** The trail is `RGBA16F`
  and its alpha is **unbounded above** — a dense accumulation pushes coverage well past 1.0 — so the raw
  gradient has no useful ceiling. The soft curve is smooth everywhere and stays nearly linear in the
  sparse case, which is what keeps a low-accumulation preset (`Pipes`, `Cylinder`) from reading as *"this
  style does nothing"* while a dense one still cannot run away. **Normalising the GRADIENT rather than
  clamping the HEIGHT is the whole trick**: clamping the height would flatten every dense region to a
  plateau and delete the gradient there outright — the lens would vanish exactly where the figure is
  thickest.
- **The gain is in PIXELS and converted to UV at the end.** `Refract · 8% · min(w, h)` is the same target
  every static layer's `Strength` is solved against, so `0.5` here means the same visible displacement as
  `0.5` there — at 600p, at 1080p, and in a 180 px preview tile. A gradient left in raw texel units would
  have been 1.8× stronger at 1080p than at 600p.
- **The sign is negated by default.** `∇h` points *uphill*, toward denser trail, and the default look is
  a bulge *away* from density — so the shader negates, and `Invert` flips it back to a pinch.

| Control | Stored as | Range (step) | Default | What it does |
|---|---|---|---|---|
| **Refract** | `strength` | 0 – 1 (0.01) | 0.35 | peak displacement as a fraction of 8 % of `min(w,h)` |
| **Reach** | `reach` | 0.5 – 8 px (0.1) | 1.0 | gradient stencil half-width, in full-resolution texels. Small reads the fine strand edges as sharp lens rims; large reads the whole knot as one soft, glassy mass. ⚠️ **A screen-space unit, so a preview tile scales it** |
| **Invert** | `invert` | boolean | `false` | displace *toward* density — a pinch rather than a bulge, so the figure reads as collapsing into its own mass |
| **Source** | `source` | `density` / `luminance` | `density` | coverage versus brightness. `luminance` follows the bright core rather than the extent, which is visibly different on a palette-mapped preset |

**Why it needs no precondition line in the UI**, unlike most styles: it warps unconditionally. The
property that actually distinguishes it is that `∇h = 0` in empty space, so **the background stays
perfectly still** and only the neighbourhood of the figure moves. That is also why it is the one field
style that cannot produce a full-frame drift however hard it is driven.

### 7.7 Vortex

The one field style with **no texture at all** — a closed-form tangential displacement about a placeable
eye, and the only style in the chain that produces coherent **rotation**.

#### The algorithm

```
  d    = (uv − eye) · (w, h) / min(w, h)        offset from the eye, in units of min(w,h)
  r²   = d · d
  R²   = max(EyeRadius², 1e−6)

  f(r) = exp(−r²/R²)                            Falloff = gaussian
       = 1 / (1 + r²/R²)                         Falloff = inverse

  δ_px = (−d_y , d_x) · f(r) · Gain              perpendicular × falloff
  δ_uv = δ_px / (w, h)
```

⚠️ **THE FORM IS RIGID ROTATION — `d⊥ · f(r)` — AND NOT A UNIT TANGENT TIMES THE FALLOFF.** The obvious
alternative, `t̂ · f(r)`, has magnitude 1 at every `r > 0`, but **its direction flips across the eye**: the
pixels either side of the centre are displaced by the full amount in opposite directions, over one texel.
That reads as a hard pinch point rather than as rotation, and it is a discontinuity inside a feedback
loop. `d⊥` is **zero at the eye and grows linearly out of it**, which is what a rotating body actually
does.

That choice decides the gain, which is why the two are one derivation. There is no displacement texture
to scan for a peak, so the peak is solved in closed form — and it depends on `EyeRadius`:

```
  |δ| ∝ r · f(r)

  gaussian:  peaks at r = R/√2 ,  value R·e^(−½)/√2 = 0.4288819 · R
  inverse:   peaks at r = R    ,  value R/2

  Gain = Swirl · 0.08 · min(w,h) / peak          in PIXELS, like the refraction gain
```

⚠️ **The peak scales with `radius`, so a constant would have made a small eye about 2.3× weaker than a
large one at the same `Swirl`** — a control whose meaning drifts with the control beside it. `radius` is
floored at `0.01` on both the CPU and the GPU side because it divides here: a hand-edited `radius: 0`
would otherwise produce an infinite gain, and `Inf · 0 = NaN` inside the trail feedback loop is the
NaN-propagation failure of [§9.5](#95-numerical-robustness).

| Control | Stored as | Range (step) | Default | What it does |
|---|---|---|---|---|
| **Swirl** | `swirl` | **UI 0 – 1** (0.01); type −1 – +1 | 0.5 | peak tangential displacement as a fraction of 8 % of `min(w,h)`. **Signed in the format, unsigned in the UI** — see below |
| **Eye Radius** | `radius` | 0.05 – 1.5 (0.01) | 0.4 | falloff extent as a fraction of `min(w,h)`. ⚠️ **Already normalised, so a preview tile must NOT scale it** — unlike Reach above, which is in texels. Decide by UNIT, never by field name |
| **Eye X / Eye Y** | `centre` | 0 – 1 (0.01) | frame centre | eye position in normalised UV. **Inherited from the layer's `zoomCenter`** when it had one, so a vortex added to a zoomed chain spins about the same point |
| **Falloff** | `falloff` | `gaussian` / `inverse` | `gaussian` | `gaussian` is contained — a whirlpool in still water. `inverse` is long-range and reads as the whole frame slowly stirring, like liquid in a glass |

Four properties of this style are invisible from the formula and each one has caught somebody:

- ⚠️ **It resamples the TRAIL, so what you see is the per-frame step times how long the trail lives.**
  The same `Swirl` is a gentle turn or a hard shear depending on **Motion Blur**, a control in a different
  section: measured at the defaults, **8° at Motion Blur 0 and 634° at Motion Blur 8.** The 8° is
  reproducible from the gain above — at `Swirl 0.5`, `R 0.4`, the peak step is
  `0.08·√2·0.5/0.4 = 0.141 rad = 8.1°` per frame — so the control is linear in `Swirl` and the *look* is
  not linear in anything the Vortex panel contains. **Judge this style on a preset whose trail you know.**
- ⚠️ **A negative `Swirl` is authorable but not reachable from the UI**, whose slider starts at 0. Exactly
  **one** preset in the library uses one (`swirl: -0.7`); every other authored value is positive
  (0.35, 0.43, 0.53). So the anticlockwise half of the range is a reachable-but-unselected configuration
  — the class worth enumerating in an audit, because a defect there stays hidden until a user authors it.
- ⚠️ **The sign lives in the GAIN and not in the layer weight.** Weights are magnitudes, so folding the
  sign into one would make a negative swirl at half weight read as a *positive* one. For the same reason
  the shader's gate is `Gain != 0`, not `Gain > 0` — the natural-looking `> 0` would have made **every**
  anticlockwise vortex silently inert.
- **It is the one field style with a CPU twin.** Every other style reaches the particle force path through
  a texture — styles 0–3 through the static field sampler, style 5 through the flow readback, style 4
  through its own forces — and a vortex has no texture, so it had no route in at all. That reads as *"Force
  Blend does nothing on this preset"* while the picture visibly rotates. The displacement is therefore
  transcribed a third time for the CPU, making **one derivation in three places** (the gain solver, the
  warp shader, the particle force); a change to one without the others makes particles drift against the
  image they are supposed to be embedded in, which looks like a rendering fault rather than a mismatch.
  A checker holds the parity.

### 7.8 The three modifiers

**None displaces anything.** Each changes how the *summed* displacement of the field layers is applied,
so each is inert on its own and the UI has to say so. They are also **weightless** — a per-layer weight
on a multiplier would be indistinguishable from turning its own amount down, i.e. a second inert
control — and none of them counts toward the chain's "does this need a warp pass" test.

All three are implemented **inside** the warp pass rather than as passes of their own. That is the
decision that keeps the chain cheap: each is structurally the same operator, *a lerp against a second
texture*, so the chain still has exactly one colour style and exactly two executable arrangements.

#### 7.8.1 Band Split (style 9)

Separates the image into a low-frequency **base** and a high-frequency **residual**, and warps only the
residual — so the composition holds its shape and position while its surface texture crawls.

**The base is built once, at half resolution, in two separable Gaussian passes:**

```
  σ       = max(0.5, BandRadius · 0.5)      radius is in FULL-res texels; halved for the half-res target
  extent  = min(8, ⌈2σ⌉)                    taps per side, capped
  w(i)    = exp(−i² / 2σ²)
  base    = Σ w(i)·taps / Σ w(i)            normalised by the ACCUMULATED total, not analytically
```

⚠️ **The weights are normalised by the accumulated total rather than analytically**, because the tail is
truncated at 8 taps. An analytic normaliser over a truncated kernel loses energy, and a darkened base
shows up as a **brightness shift** at `amount > 0` — which reads as "Band Split changes the exposure"
rather than as a missing band effect.

**The composition is algebraic, and this is where the cheapness comes from.** The naive form — blur the
input, blur the warped output, recombine — needs two blurs, and worse, it makes `amount = 0` mean *no
warp at all*, contradicting the control's own definition. Lerping between the two **end states**
instead:

```
    mix( full_warped , base_unwarped + resid_warped , amount )
  = mix( full_warped , base_unwarped + full_warped − base_warped , amount )
  = full_warped + amount · ( base_unwarped − base_warped )
```

So the implementation is **one blur of the input, sampled twice** — at `uv` and at the warped `uv` — and
`amount = 0` is bit-identical to having no layer:

```
  rgb += BandSplit · ( base(uv) − base(uv + δ) )
```

- ⚠️ **`rgb` only — alpha is deliberately untouched.** Alpha carries the accumulated coverage that
  Density Refraction ([§7.6](#76-density-refraction)) reads back next frame; mixing a blurred alpha into
  it would feed a *smoothed height field* into a gradient operator.
- ⚠️ **The base is sampled PER CHANNEL at that channel's own tap** when dispersion is non-zero. The
  cancellation above is only exact against the UV a channel was actually read from, so one shared
  correction becomes a feedback **gain** on R and B — measured as bounded at dispersion 0.00–0.03 but
  overflowing `RGBA16F` within 400 frames at 0.04 and 200 frames at 0.05. Since the slider step is 0.01,
  the **fourth step off zero destroyed the frame**, and green survived because G is the channel whose tap
  *is* the base UV. ⚠️ **So the failure presents as "converges to a green frame", which names the one
  INNOCENT channel** — invariant 19's signature, and the reason the surviving channel is the clue.
- **It is inert with no field layer for an exact reason, not merely a pointless one**: with `δ = 0` the
  two samples are the same texel and cancel precisely.

| Control | Range (step) | Default | What it does |
|---|---|---|---|
| **Band Split** | 0 – 1 (0.01) | 0.0 | 0 is exactly the unsplit behaviour; 1 freezes the base completely |
| **Band Radius** | 1 – 16 px (0.5) | 4.0 | the split frequency, in full-resolution texels. Small reads as a fine electric crawl along each strand; **large inverts the effect perceptually**, holding tonal masses while whole sub-strands slide. ⚠️ Screen-space, so a preview tile scales it |

#### 7.8.2 Time Warp (style 8)

Blends each pixel against an **older frame** by a per-pixel amount, so different parts of one figure
appear to run at different speeds.

```
  raw = ( Source == density )  ?  alpha        the trail's accumulated coverage
                               :  |δ| · h      the summed offset magnitude, in pixels

  w   = raw / (1 + raw)                        soft normalisation, not a clamp

  out = isFinite(history) ? mix( out , history(uv) , TimeWarp · w ) : out
```

- **The history is one frame of the warp pass's own output**, blitted after each frame — so the lag is
  recursive rather than a fixed one-frame offset, and **it compounds**. Past about 0.8 the figure reads
  as being dragged through syrup.
- ⚠️ **The history is a REAL third render target, not the pass's own attachment.** The tempting premise
  that "one frame of history is free" is false here: this shader writes the trail's A target, so reading
  that target would be a **framebuffer feedback loop** — undefined in WebGL2 and *silent* on ANGLE.
- ⚠️ **The weight is sampled at the pixel being WRITTEN, not at the source location.** The question the
  operator answers is "how much is this location lagging", and what the viewer sees there is the field at
  *there*. Reading the source location would make the lag pattern itself travel with the warp — a smear
  of a smear rather than differential speed.
- ⚠️ **The lerp is guarded by a BOOLEAN SELECT, never an arithmetic one.** `mix(x, NaN, 0)` is still NaN,
  because any arithmetic on NaN is NaN, so a weight of zero does not protect the frame — the history
  texel is tested for non-finiteness and the whole blend skipped ([§9.5](#95-numerical-robustness)).
- **`rgb` AND alpha, unlike Band Split**: this is a temporal blend of the whole frame, and holding alpha
  at the current frame while `rgb` lags would desynchronise the density field from the colour it belongs
  to.
- ⚠️ **It needs THREE things, which is why it drew "no visible effect" reports**: the layer enabled, a
  field that is actually non-zero (or `Source: Density`, which does not depend on the field), **and
  visible motion between frames**. A still preset has nothing to lag.

| Control | Range (step) | Default | What it does |
|---|---|---|---|
| **Time Warp** | 0 – **0.95** (0.01) | 0.0 | the lag, multiplied by the per-pixel weight. **The slider stops short of 1**, and the weight is `raw/(1+raw)` which is strictly below 1, so the blend never takes the history entirely at any setting |
| **Source** | `field` / `density` | `field` | `field` lags most where the chain displaces most, so motion and smear coincide and the effect differentiates *within* one frame. `density` lags the dense core and leaves sparse arcs crisp — the inverse of a global blur |

#### 7.8.3 Depth Parallax (style 11)

Scales the summed displacement by each pixel's depth, so near and far parts of one figure warp by
different amounts.

```
  depth  = clamp( (depthRaw − bandLo) · bandScale , 0 , 1 )      the RANGE remap
  dCurve = ( Curve == squared ) ? depth²  : depth
  mult   = mix( 1 , mix( Far , Near , dCurve ) , Parallax )

  δ      = ( ΣfieldOffsets ) · ChainMix · edgeFade · mult
```

- ⚠️ **The remap is applied BEFORE the curve, and that order is load-bearing.** `squared` biases toward
  the near end of whatever scale it is handed, so squaring a *raw canvas-normalised* depth would bias
  toward the near end of the **canvas** — a place a narrow-band figure never reaches, making the Curve
  control inert on exactly the presets the remap exists to rescue. Remapped first, "squared" means "near
  end of the **figure**", which is what the control claims.
- ⚠️ **The multiplier is a lerp from 1**, so `Parallax = 0` is byte-identical to having no layer whatever
  Near and Far hold.
- ⚠️ **It is applied to the SUM, before the clamp.** Scaling each term separately is the same arithmetic
  — multiplication distributes — but it would put the multiply *inside* the two branched terms, so a
  chain with no refraction layer would silently skip it. Scaling *after* the clamp would let the near
  field exceed the maximum offset by `Near`, reopening the off-screen sampling the clamp exists to
  prevent.
- ⚠️ **The depth is clamped because a manual band may sit INSIDE the figure** (that is the slab-isolation
  case): depths beyond the band must pin to the ends rather than extrapolate past Near/Far.

| Control | Range (step) | Default | What it does |
|---|---|---|---|
| **Parallax** | 0 – 1 (0.01) | 0.0 | how much of the Near/Far pair to apply |
| **Near** | 0 – 3 (0.05) | 1.5 | multiplier for the closest pixels. **1.0 is exactly the unmodified warp** |
| **Far** | 0 – 3 (0.05) | 0.4 | the same scale, for the most distant. At 0 the far side holds perfectly still while the near side sweeps |
| **Curve** | `linear` / `squared` | `linear` | linear spreads the effect through the scene; squared concentrates it in the nearest layer |
| **Depth Range** | `figure` / `canvas` / `manual` | **`figure`** | what the 0–1 scale is measured against |

**`Near = Far` means no parallax at any amount**, and the pair carries two independent quantities: the
**difference** sets how much depth separation is visible, while the **level** scales the warp overall.
`Near 0 / Far 0.4` and `Near 0.4 / Far 0.8` share a spread, but the second warps about twice as much.

⚠️ **`Depth Range` is the control that makes this style work at all on the legacy library**, and the
reason is measured: the raw depth scale is normalised over the **canvas**, and a legacy figure typically
occupies a thin slice of it — across the ~93 affected presets the median near:far multiplier ratio is
**1.30× raw against 4.00× fitted**. On `Canvas (raw)` the Near/Far pair simply cannot open the figure up.
`canvas` resolves to the band `0/1`, which makes the remap **arithmetically the identity** — that is how
the pre-remap behaviour stays reachable *exactly* rather than approximately, and why the field is
categorical instead of a pair of numbers.

⚠️ **Empty background reads as "far" too**, because the depth buffer clears to the far value — so a high
`Far` amplifies the background rather than the figure, which is the opposite of what the control sounds
like it should do.

### 7.9 Fractal Feedback — an iterated function system

The one **colour-domain** style, and not a displacement at all. It feeds the image back into itself
through a set of affine copy-and-place rules — an **IFS** — which is what produces kaleidoscopes,
tunnels and spirals that no displacement field can make.

#### The algorithm

Each transform is a rotation, a uniform scale and a translation, with a weight. The pass runs them all
for every output pixel and sums the taps:

```
  for j in 0 … count−1:
      srcUv_j = Rot(angle_j) · (uv − ½) · scale_j  +  ½  +  (tx_j, ty_j)
      srcUv_j = clamp(srcUv_j, 0, 1)
      result += ŵ_j · frame(srcUv_j)              ŵ_j = weight_j / Σ weight

  out = sanitise( mix( frame(uv) , result , Mix ) )
        Mix = ChainMix · layerWeight · attractorFade        an OPACITY, clamped to 0…1
```

Five properties of that loop decide how the controls behave:

- ⚠️ **The transform is applied to the SAMPLING coordinate, so `scale` acts INVERSELY.** An output pixel
  at radius ρ from the centre reads the frame at `ρ · scale`, which means `scale < 1` **magnifies** the
  fed-back copy and `scale > 1` shrinks it. Nine of the ten shipped sets are below 1; `Explosion` at 1.08
  is the only one above. **The set names describe the accumulated look, not the per-frame transform**, and
  the two can read in opposite directions — judge by eye, not by the sign of `1 − scale`.
- **The weights are normalised to sum to 1**, so lowering one weight makes that branch of the pattern
  fainter *relative to the others* rather than dimming the whole echo. Raising every weight equally
  changes nothing at all.
- **`Mix` is an opacity — the one place the chain's mix lerps a COLOUR** rather than scaling a
  displacement. Style 4 fades with the attractor blend like every style except Fluid Feedback.
- **`srcUv` is clamped, not wrapped**, so a transform that reaches past the frame samples the border
  pixel. A large `TX`/`TY` therefore smears the edge inward instead of tiling.
- ⚠️ **The pass carries its own NaN guard**, because it can be the *terminal* write to the trail buffer:
  with an echo layer and a field layer both live, the warp writes a scratch target and the echo writes
  the real one. Guarding only the warp pass would have left that ordering — and a lone style-4 chain,
  where the echo is the only pass — unprotected. **The `clamp` on `srcUv` is not a substitute**: it bounds
  the coordinate and is transparent to a NaN.

| Control | Range (step) | What it does |
|---|---|---|
| **Angle** | 0 – 360° (1) | rotation of the copy. Decides whether the result reads as a spiral or a mirror |
| **Scale** | 0.1 – 2.0 (0.05) | the copy's size, **inversely** — see above. Near 1 piles copies up; far from 1 separates them fast |
| **TX / TY** | −0.5 – +0.5 (0.01) | translation in UV, applied after the rotation and scale. Turns a concentric pattern into a drifting cascade |
| **Weight** | 0 – 1 (0.05) | this branch's share of the sum, normalised against the others |

**Up to six transforms**, added with `+ Add Transform` and removable per row; the shader's arrays are
sized 6 and the pass slices to 6, so a hand-edited import with more is truncated rather than rejected.

#### The ten default systems

Selecting one writes the whole transform list. Editing any value flips the dropdown to `(Custom)` —
which is a *label*, not a selectable shape: the matcher compares the live list against every set
field-by-field (weights within 0.001) and reports `Custom` when nothing matches.

| Preset | n | Transforms `(angle°, scale, tx, ty, weight)` | What makes it that shape |
|---|---|---|---|
| **Spiral** | 1 | `(15, 0.95, 0, 0, 1.0)` | one gentle rotation just under unity — the minimal case, and a slow turn that never closes |
| **Zoom Tunnel** | 1 | `(0, 0.85, 0, 0, 1.0)` | **no rotation at all**, so the only motion is scale: concentric rings with nothing to twist them |
| **Vortex** | 1 | `(45, 0.75, 0, 0, 1.0)` | the same single copy with a large angle *and* a hard scale — rotation and zoom at comparable rates, which is what reads as a twist rather than a tunnel |
| **Kaleidoscope** | 3 | `(120, 0.9, 0, 0, 1.0)` · `(240, 0.9, 0, 0, 1.0)` · `(360, 0.9, 0, 0, 1.0)` | the complete **three-fold** rotation set. ⚠️ **`360` ≡ `0`**, so the third copy is un-rotated — the set is `{0°, 120°, 240°}` written with 360 in place of 0 |
| **Mirror** | 2 | `(0, 0.95, +0.15, 0, 1.0)` · `(0, 0.95, −0.15, 0, 1.0)` | pure translation, equal and opposite, with no rotation: the only set whose copies are displaced rather than turned |
| **Fern** | 2 | `(5, 0.9, 0, −0.1, 1.0)` · `(−75, 0.4, +0.2, +0.15, 0.6)` | **the only ASYMMETRIC set, and the only one with unequal weights.** A near-identity stem plus a small, hard-turned, lighter frond — the classic Barnsley arrangement in miniature |
| **Double Helix** | 2 | `(20, 0.9, +0.05, 0, 1.0)` · `(−20, 0.9, −0.05, 0, 1.0)` | mirrored *rotations* as well as mirrored offsets, so the two branches wind past each other instead of standing side by side |
| **Cascade** | 1 | `(2, 0.98, 0, +0.08, 1.0)` | scale almost exactly 1 and the largest vertical offset in the set — the copy barely changes size, so what you see is drift |
| **Explosion** | 1 | `(8, 1.08, 0, 0, 1.0)` | ⚠️ **the one set with `scale > 1`**, so the fed-back copy shrinks rather than grows. The only entry whose sampling direction is inverted relative to the other nine |
| **Crystal** | 3 | `(90, 0.95, 0, 0, 1.0)` · `(180, 0.95, 0, 0, 1.0)` · `(270, 0.95, 0, 0, 1.0)` | the three non-identity quarter turns. ⚠️ **No `0°` member, unlike Kaleidoscope** — the un-rotated image reaches the output only through the final `mix` with the original, which is why its symmetry reads as harder-edged |

Two things that table makes visible and prose does not: **four of the ten are single-transform sets**,
which is to say they are feedback loops rather than iterated systems in any interesting sense; and
**only `Fern` uses a weight other than 1.0**, so the normalised-weight machinery is exercised by exactly
one shipped preset.

⚠️ **`Spiral`'s numbers are identical to the engine's fallback IFS**, used wherever style 4 is requested
with no transform list. They are **separate literals on purpose** — retuning or renaming `Spiral` must
not silently change what a parameter-less style-4 preset renders — so do not collapse them.

#### Ordering

Because it is a separate pass, **its order matters**: warping an already-echoed image and echoing an
already-warped one look quite different, and `⇅ Swap warp / echo order` chooses. With both an echo layer
and a field layer live, one of the two writes a scratch target and the other writes the real one; with
only an echo layer, this pass is the whole chain. The pipeline readout names it `echo: IFS`.

⚠️ **That two-arrangement limit is why Time Warp is a modifier rather than a second colour style**
([§7.8.2](#782-time-warp-style-8)): a second colour pass would turn two executable arrangements into
six and require two scratch intermediates.

### 7.10 Dispersion

Chromatic fringing along the warp direction: red and blue are sampled at different distances along the
*same* offset vector, so the three channels disagree about where the image is.

#### The algorithm

```
  δ        = the SUMMED, parallax-scaled, clamped chain offset        (as in §7.8.3)

  uv_R     = uv + δ · (1 − 3·D)
  uv_G     = uv + δ
  uv_B     = uv + δ · (1 + 3·D)

  out.rgb  = ( frame(uv_R).r , frame(uv_G).g , frame(uv_B).b )
  out.a    = frame(uv_G).a                                           ← the GREEN tap, not 1.0
```

⚠️ **Three corrections to what this section said before, and the first two change what you would expect
on screen:**

- **The factor is `3·D`, not `D`.** The spread is three times the slider value, which is why a setting
  of 0.05 is already a strong fringe.
- **Red is the SHORT tap and blue the LONG one** — `(1 − 3D)` and `(1 + 3D)`, not the other way round.
  Red lags the warp, blue leads it.
- **Alpha comes from the green tap**, not from a constant. This matters because the warp pass writes the
  buffer the next frame accumulates into: a hardcoded `1.0` flattened the accumulated coverage to a
  plateau, so Density Refraction ([§7.6](#76-density-refraction)) read a zero gradient and **did
  nothing — but only in a chain that also had dispersion turned up.** An interaction invisible in either
  feature tested alone, and it reported as *"refraction is broken"* rather than as *"dispersion
  overwrote its input"*.

#### Two consequences of the arithmetic

**The red channel's displacement passes through zero and reverses.** `1 − 3D` is 0 at `D = 1/3` and
negative above it, and the slider reaches **0.5**:

| D | red factor | what red does |
|---|---|---|
| 0.00 | 1.00 | tracks green exactly — no fringe |
| 0.10 | 0.70 | lags green by 30 % of the offset |
| **0.333** | **0.00** | **red is sampled completely UNWARPED** while green and blue are displaced |
| 0.50 | −0.50 | red is displaced the *opposite* way, half as far |

So the top third of the range is not "more fringing" but a different effect — the red channel detaching
from and then counter-warping against the other two. That is reachable from the UI and worth knowing
before reading a result as a defect.

**It is self-limiting and therefore needs no gate.** Where `δ = 0` all three taps collapse to the same
texel, so a chain with no field layer renders **identically at any dispersion value** — including with
TransMap off or `Chain Mix` at 0. And because the spread is *proportional to the local offset*, a strong
warp fringes far more than a gentle one at the same setting.

⚠️ **This is deliberately NOT a lens aberration.** A lens-style one would be radial and independent of
the motion. This one follows the warp, which is a different effect and the one that was wanted.

#### Why it is a chain control and not a Fluid Feedback one

The shader always applied it to the **summed** offset `sOff + fOff + flOff + …`, so it was style-agnostic
from the start — **only the upload confined it**, which read `feedback ? fluidDispersion : 0` and sat
between two uniforms that genuinely are style-6 semantics. That one line is how a general warp modifier
came to look like a Fluid Feedback feature. **It is the chain-level `transMapDispersion`, beside `Chain
Mix`, and the Fluid panel holds no copy of the handle** — ⚠️ **two handles writing one uniform is how a
control comes to disagree with the engine, so the duplicate is removed rather than left in place.**

The old home, `FluidFeedbackConfig.dispersion`, is still **read on import** so older exports keep working,
and nothing writes it any more ([§10.7](#107-the-blocks-nothing-reads)).

| Control | Stored as | Range (step) | Default | Notes |
|---|---|---|---|---|
| **Dispersion** | `overlay.transMapDispersion` | 0 – 0.5 (0.01) | 0.0 | clamped to that range by its single setter; **exported only when non-zero**, so an untouched export is byte-identical to one written before the control existed |

⚠️ **Its interaction with Band Split is the one place this control has destroyed a frame**, and the fix
was to hoist these three taps so each channel's band correction is computed at the UV that channel was
actually read from. The measured thresholds and the failure mechanism are in
[§7.8.1](#781-band-split-style-9) — in short, **the fourth step off zero was enough.**

### 7.11 Reading what is actually running

The section prints its own pipeline, which is the fastest diagnostic the engine offers:

```
  trail → [warp: Wave Shift + Vortex, time-warp] → [echo: IFS] → bloom
  trail → bloom  (no active layer)
```

Field styles are joined with `+` inside one warp stage — the visible proof that they sum. Modifiers are
named *inside* that stage, because that is where they execute. The echo is its own stage, ordered by
the swap.

---

## 8. Stage 8 — Grading: Bloom, Tone Map, Film Look

Everything in this stage operates on the HDR image. **Read the order off the code, not off a diagram** —
the order is what makes several of these controls behave the way they do.

### 8.0 How the final image is assembled

By the time this stage runs, the frame is a single `RGBA16F` texture holding **unbounded** values: the
trail has been accumulating for many frames, the warp has resampled it, and nothing so far has clamped
anything. This stage is what turns that into eight bits per channel on screen — and the first thing to
know is that **it is conditional, and can be absent entirely.**

```
  presentSource                                    ← the HDR frame, after warp and any reel cross-fade
    │
    ├── if (bloom OFF and tone map OFF) ───────────────────────────► blit straight to the screen
    │                                                                (the "legacy path")
    ├── if (bloom ON)   bloom.apply(presentSource → postFBO)
    │                     ├─ bright pass  → mip[0]
    │                     ├─ 4 × downsample  mip[0] → mip[4]
    │                     ├─ 4 × upsample    mip[4] → mip[0]   additively
    │                     └─ composite:  scene + mip[0] · Intensity
    │                   srcTex = postFBO
    │
    └── if (tone map ON)  toneMap.apply(srcTex → the screen)
        else              blit srcTex to the screen
```

Three consequences of that shape, and each one has been mistaken for a bug:

- ⚠️ **With both switches off the HDR buffer is blitted to an 8-bit framebuffer with no curve at all.**
  The only thing bounding the result is the driver's own conversion on write. That is the `Legacy` look,
  and it is the state **all 177 legacy presets load in** — so "the grading stage" is literally not
  running for most of the shipped library.
- ⚠️ **`Exposure` is a uniform INSIDE the tone-map shader.** So on a bundle with `toneMapEnabled: false`,
  raising exposure changes **nothing** — no error, no effect. The same is true of lift, gamma, gain,
  saturation and vignette. **`toneMapEnabled`, `toneMapCurve` and the values are one atomic change; any
  subset is inert.**
- **Bloom's output is still HDR.** The composite writes `scene + bloom · Intensity` into another
  `RGBA16F` target, so bloom *adds* headroom rather than consuming it — which is why bloom and the tone
  curve interact: bloom decides how much light there is to roll off, and the curve decides what happens
  to it.

**Why this stage is under-exposed by default, measured.** A figure pixel in `star` mode at `glow: 2.0`
reaches a steady state of only **0.139–0.365**, because alpha compositing is bounded by the sprite's own
shape term: `v = s²/(1 − d^K(1 − s))` can never exceed `s`, and the mean shape is 0.373. Under `Legacy`
that value goes straight to the screen, i.e. **35–93 of 255**. The whole legacy library renders in the
bottom third of the available range. With `exposure: 1.4` + ACES those three values land at
**74 / 127 / 160** — roughly double, with no clipping even on the 94 presets at `MotionBlur 8`, because
ACES rolls off rather than clamping. That measurement is the entire reason `Legacy Graded` exists.

⚠️ **THOSE THREE FIGURES ARE RE-MEASURED ON THE SHIPPING CURVE, AND A TONE FIGURE IS ONLY MEANINGFUL
ALONGSIDE THE CURVE THAT PRODUCED IT.** `74 / 127 / 160` is Hill's fit **with `ACES_EXPOSURE_BIAS`**; the
single-rational fit gave `74 / 129 / 159` on the same inputs, and **that agreement is the evidence the
bias restores the transfer rather than approximating it.** ⚠️ **Without the bias the same three pixels
read `30 / 66 / 97` — DARKER AT TWO OF THE THREE THAN `Legacy`'s own ungraded `35 / 64 / 93`**, which
inverts this bundle's entire purpose: *`Legacy` plus a grading pass, just not under-exposed*. **A
"graded" look measuring darker than the ungraded one it is built on is the signature to watch for; the
bundle's own description is the oracle.**

### 8.1 Bloom

Bloom bleeds light from bright pixels into their surroundings, the way a camera does. It is **four
programs over a five-level mip pyramid**, not a single blur.

#### 8.1.1 The four passes

**Pass 1 — the bright pass.** Keeps the part of each pixel that exceeds the threshold, as a *proportion*
of its own luminance, and writes it into the largest mip (half the canvas on each axis):

```
  lum          = dot(rgb, (0.2126, 0.7152, 0.0722))           Rec. 709 luma
  contribution = max(0, lum − Threshold) / max(lum, 0.001)
  bright       = rgb · contribution
```

Note it scales the **colour** by a ratio derived from luminance, rather than subtracting the threshold
from each channel — so a bright pixel keeps its hue instead of drifting toward whichever channel
survived the subtraction. The `max(lum, 0.001)` is there so a black pixel divides by something.

**Pass 2 — progressive downsample**, four times, each halving both axes. A **13-tap** kernel with
weights `0.25` centre, `0.125` edges, `0.0625` corners — a tent that approximates the Karis average, so
a single very bright texel cannot flicker the whole pyramid:

```
  mip[i] = 0.25·c + 0.125·(L+R+U+D) + 0.0625·(4 corners)      sampled from mip[i−1]
```

**Pass 3 — progressive upsample**, four times, back up the pyramid with a 3×3 tent
(`1 2 1 / 2 4 2 / 1 2 1` over 16) and **additive blending (`ONE, ONE`)**. The addition is what makes the
result a sum of five differently-sized blurs rather than one: each level contributes its own radius, so
the glow has a tight core and a wide halo at once.

**Pass 4 — composite.** The only place `Intensity` appears:

```
  out = scene + mip[0] · Intensity
```

#### 8.1.2 What the controls really do

| Control | What it is |
|---|---|
| **Threshold** | subtracted from **luminance** in the bright pass |
| **Intensity** | a plain multiplier at the composite |

> ⚠️ **`Threshold` SUBTRACTS against accumulated values that can reach the hundreds.** On a dense trail
> in an HDR buffer, almost everything clears any threshold in the 0–1 range, so this is a weak lever
> there. **`Intensity` is a plain multiplier on the add-back and is therefore the effective control**
> over how much the image glows.

⚠️ **`BloomConfig.radius` is accepted and never used.** The call site passes `radius: 5`, `init()` does
not store it, and no shader takes it — **the blur extent is set entirely by `levels` (5) and the mip
pyramid**, which is a function of canvas size. There is no radius control in the UI either, and the
deprecated `postProcessors.bloom.radius` in the preset format is a second dead copy of the same idea
([§10.7](#107-the-blocks-nothing-reads)). Do not "wire it up" expecting a free control: a real radius
would mean changing the tap offsets or the level count.

⚠️ **The mip pyramid is built by `resize()`, not by `init()`.** A film-look change disposes and
re-creates bloom, so an `init()` without a following `resize()` leaves the pyramid empty and
`apply()` **silently returns without drawing** — bloom quietly stops working, with no exception and no
GL error. All current call sites pair the two; nothing in the type system makes them.

### 8.2 Tone mapping

Tone mapping compresses out-of-range brightness into what the display can show. **It is one fragment
shader, and §8.2 and §8.3 are two halves of the same pass** — which is why their order cannot be
rearranged and why they share a single enable flag:

```
  hdr    = texture(input, uv).rgb
  hdr   *= Exposure                        1. exposure, BEFORE the curve
  mapped = curve(hdr)                      2. one of three curves
  mapped = liftGammaGain(mapped)           3. per-channel, AFTER the curve
  lum    = dot(mapped, luma709)
  mapped = mix(vec3(lum), mapped, Sat)     4. saturation
  mapped = mapped · vignette(uv)           5. vignette, last
  out    = vec4(mapped, 1.0)               ← alpha forced to 1
```

Exposure is applied **first**, so it moves the whole image along the curve:

```
  hdr ← hdr · Exposure
```

Then one of three curves:

| Curve | Formula |
|---|---|
| **ACES** | **Hill's fitted ACES**: NaN→0 by boolean select, **× `ACES_EXPOSURE_BIAS` (2.0)**, `clamp(x, 0, 1e4)`, then sRGB→AP1, the RRT+ODT rational fit, AP1→sRGB, and a final `clamp(0, 1)`. Rolls highlights off like film and keeps hue through the knee |
| **Reinhard** | `x / (1 + x)` — gentler, never clips, but desaturates less gracefully |
| **None** | `clamp(hdr, 0, 1)` — a hard clip, which flattens bright cores into featureless white |

⚠️ **THE SINGLE-RATIONAL NARKOWICZ (2015) APPROXIMATION MUST NOT APPEAR ON THIS BRANCH**,
`clamp( x(2.51x + 0.03) / (x(2.43x + 0.59) + 0.14), 0, 1 )` — both fits compile and both look plausible,
so substituting it is invisible. `checks/splatcheck.mjs` §A asserts the published AP1 matrices are
present, that those five constants are **absent**, and — the sharpest clause — that **the matrices are
written COLUMN-wise**: HLSL fills `float3x3` by rows and GLSL's `mat3` by columns, so copying the
published rows straight in applies the transpose, which is a believable colour shift with no error
message anywhere.

> ⚠️ **The `None` branch is where the clamp lives — it is not a separate pipeline stage.** And the
> ACES fit is **rational**, so it is **NaN at infinity** — which is why both guards live *inside* the
> branch rather than relying on anything upstream: a **boolean select** maps NaN to 0 (⚠️
> `mix(x, y, vecN(bvecN))` is arithmetic and a NO-OP for NaN — invariant 20), and the input `clamp`
> runs **before** the division, because a clamp after it cannot recover `Inf/Inf`. The screen path is
> not reachable by the trail sanitiser, so a NaN uniform or a single NaN texel would otherwise
> propagate across the whole frame.

⚠️ **`ACES_EXPOSURE_BIAS` IS PART OF THE CURVE, NOT A SECOND `Exposure`, AND IT IS WHY THE ACES BRANCH
AND THE `None` BRANCH ARE COMPARABLE AT ALL.** The Narkowicz fit this branch must not carry has an input
gain folded into its five coefficients; Hill's fit is the curve alone. **So the two are not two spellings
of one transfer, and a drop-in swap of the body changes the brightness of every `aces` preset by about a
stop** — which is the one difference between them that no checker in §A can see, because every clause
there is about *which constants are present*. The factor is **2.0, fitted by least squares on 8-bit output
codes over `x ∈ [0.005, 8]`**: it reproduces the single-rational response to **RMS 1.21 and worst case
3.28 of 255 codes** on neutrals, where the untouched fit is 3.3× darker at the toe.

> ⚠️ **It restores LUMINANCE, not CHROMA, and the asymmetry is the point.** The RRT's per-channel
> desaturation of bright saturated colour is real colour rendering that no scalar gain reproduces — on a
> saturated sweep the two fits still differ by up to **94 codes** in one channel. **Calibrate this
> constant on NEUTRALS; a saturated hue measures the wrong quantity.**
>
> ⚠️ **AND A STOP LOST HERE SURFACES AS A GEOMETRY CHANGE SOMEWHERE ELSE, WHICH IS THE REASON THIS
> PARAGRAPH IS LONG.** A splat core clips, so it loses 6–17 % — invisible. The dye wake
> ([§2.4](#24-dye-field)) is
> `1 − exp(−a · k)`, so its whole range is `x ≈ 0.01–0.4`, where the loss is **58–80 %**; and the fitted
> toe is negative below AP1 linear **0.003 25**, so a faint skirt needs **2.4×** more signal just to light
> 8-bit code 1. The skirt does not vanish — it sits in codes **1–15**, which reads as black on a real
> display, so **the dye field appears SMALLER rather than dimmer.** ⚠️ **A lit-pixel count cannot see
> this and will exonerate the curve** (measured on `Dye Wake` at 1440×900: lit fraction 57.0 % → 57.6 %
> while mean luminance went 25.3 → 52.7 of 255). **The discriminating instrument is the histogram's low
> band, not the coverage** — which is the measurement form of CLAUDE.md's rule that a grading change is
> judged on a LOW-ACCUMULATION preset.

⚠️ **The curve is the ONLY place the image becomes bounded**, and only for two of the three branches:
ACES clamps to `0…1` explicitly, Reinhard asymptotes to 1 without ever reaching it, and `None` is a hard
`clamp`. Everything in §8.3 then runs on that bounded value — which is why `Gain` above 1 can push back
out of range and why the final write to an 8-bit framebuffer is the last clamp in the pipeline.

### 8.3 Lift, gamma, gain, saturation, vignette

Applied after the curve, in this order:

```
  liftGammaGain(c) = pow( max(c · Gain + Lift, 0) , 1/Gamma )          per channel

  lum  = dot(c, (0.2126, 0.7152, 0.0722))                             Rec. 709 luma
  c    = mix( vec3(lum), c, Saturation )

  d    = |uv − 0.5| · 1.414
  c    = c · max( 1 − Vignette · d² , 0 )
```

Which gives each of them a distinct and non-overlapping job:

- **Lift** raises or lowers the **blacks** per channel — the control for tinting the empty background,
  which is what most of the darkest pixels are.
- **Gamma** bends the **midtones** per channel without moving black or white: colour balance in the body
  of the image.
- **Gain** scales the **highlights** per channel. ⚠️ **Past the tone curve's knee the output no longer
  depends on the input**, so `Gain` — not `Exposure` — is what owns the colour of a saturated core.
- **Saturation** interpolates against Rec. 709 luma. ⚠️ A pixel already clipped to white upstream has
  **no hue left to recover**; it must be fixed with Exposure or Gain instead.
- **Vignette** is a quadratic falloff in normalised distance from the centre, which also conveniently
  hides the hard edge where a warp meets the frame border.

### 8.4 Film looks

A **film look** is a named bundle of **21 fields** applied in one pick, and it spans three stages rather
than just this one:

| Fields | Count | Stage they act in |
|---|---|---|
| `glow`, `depthSize`, `depthBrightness`, `depthDof`, `depthColorShift`, `lightingMode`, `lightDir`, `rimPower` | 8 | **Stage 5** — particle shape and shading |
| `bloomEnabled`, `bloomThreshold`, `bloomIntensity` | 3 | **§8.1** |
| `toneMapEnabled`, `toneMapCurve`, `exposure`, `lift`, `gamma`, `gain`, `saturation`, `vignette` | 8 | **§8.2–§8.3** |
| `palette`, `paletteMapping` | 2 | **Stage 3** — colour |

**Fifteen bundles are shipped**, plus a sixteenth dropdown entry, `Customize`, which exposes the values
individually.

#### 8.4.1 Which looks bind a palette, and which leave it alone

**Three of the fifteen do not touch the palette at all. Twelve bind one.** This is not a cosmetic
distinction: a look that binds a palette **replaces the preset's own authored colour**, while an
abstainer leaves the figure's `colorBase`/`colorAmp`/`colorFreq` oscillation ([§3.1](#31-the-colour-oscillator))
exactly as the preset wrote it.

**The three that change nothing:**

| Look | Why it abstains |
|---|---|
| **Legacy** | the parity reference for the whole legacy library — it must render those presets as they were authored |
| **Legacy Graded** | `Legacy` plus grading and **nothing else**, so a grading change can be judged without restyling the colour |
| **Cinematic** | exposure, vignette and a strong bloom, over whatever colour the preset already has |

**The twelve that bind, with the palette and the mapping each one selects:**

| Look | Palette | Mapping |
|---|---|---|
| **Luminous** | `Warm` | `depth` |
| **Neon** | `Neon` | `phase` |
| **Ethereal** | `Pastel` | `depth` |
| **Dramatic** | `Prismatic` | `velocity` |
| **Vintage** | `Earth` | `depth` |
| **Glacier** | `Cool` | `depth` |
| **Plasma** | `Neon` | `velocity` |
| **Monochrome** | `Monochrome` | `depth` |
| **Teal & Orange** | `Sunset` | `depth` |
| **Holographic** | `Aurora` | `phase` |
| **Void** | `Midnight` | `depth` |
| **Overexposed** | `Warm` | `phase` |

Two palettes are each used twice — **`Neon`** (by *Neon* and *Plasma*) and **`Warm`** (by *Luminous* and
*Overexposed*) — and in both cases the pair differs by its **mapping**, so the same gradient reads as a
different image: `phase` follows colour luminance, `velocity` follows speed, `depth` follows near/far.
Nine of the twelve use `depth`.

⚠️ **ABSTAINING IS `null`, NOT `'none'`, AND THE DIFFERENCE IS DESTRUCTIVE.** `palette: 'none'` inside a
bundle means *"this bundle declines to make a colour decision"* — it does **not** mean "set the palette to
none". The resolver therefore returns `null` and **writes nothing**. The first version of that function
materialised the `'none'`, and the report was exact: a preset displaying `Cycle: Indigo` + `index`
correctly had it replaced by `None` + `Depth` the moment the look was switched to `Legacy Graded`,
destroying the selection for every one of the 114 bodies a migration had adopted.

⚠️ **Coercing to the "unset" sentinel is not the fix, and it is the tempting one.** The empty string means
"not overridden", so the chain falls through to the bundle's own `palette`, which is `'none'` — the same
resolved answer by a different route, with the user's override erased on the way. **Only *not writing*
preserves it.**

⚠️ **Both fields or neither.** Adopting the mapping alone would be worse than adopting both: a `Cycle:`
palette under `index` is computed by the generator's colour law, and re-pointing it at `depth` makes the
shader sample a LUT instead — *a different picture* rather than a missing one. The three abstainers all
carry `paletteMapping: 'depth'`, which is **filler for a field they never use**, not a choice to
propagate.

#### 8.4.2 The fifteen bundles' grading values

| Look | Bloom | Thr | Int | Curve | Exp | Sat | Vig |
|---|---|---|---|---|---|---|---|
| **Legacy** | **off** | 0.8 | 0 | **off** | 1.0 | 1.0 | 0 |
| **Legacy Graded** | on | 0.6 | 0.3 | aces | 1.4 | 1.0 | 0 |
| **Luminous** | on | 0.6 | 0.4 | aces | 1.2 | 1.1 | 0 |
| **Cinematic** | on | 0.5 | 0.6 | aces | 1.4 | 1.0 | 0.3 |
| **Neon** | on | 0.3 | 0.55 | aces | 1.5 | 1.4 | 0.2 |
| **Ethereal** | on | 0.4 | 0.5 | reinhard | 1.1 | 0.85 | 0.15 |
| **Dramatic** | on | 0.7 | 0.7 | aces | 1.6 | 1.2 | 0.4 |
| **Vintage** | on | 0.75 | 0.25 | reinhard | 1.0 | 0.65 | 0.5 |
| **Glacier** | on | 0.45 | 0.55 | aces | 0.9 | 0.75 | 0.25 |
| **Plasma** | on | 0.25 | 0.65 | aces | **2.0** | **2.0** | 0 |
| **Monochrome** | **off** | 0.8 | 0 | reinhard | 1.3 | **0** | 0.35 |
| **Teal & Orange** | on | 0.6 | 0.45 | aces | 1.3 | 1.1 | 0.3 |
| **Holographic** | on | 0.35 | 0.45 | aces | 1.4 | 1.5 | 0.1 |
| **Void** | on | **0.85** | **0.9** | aces | **0.7** | 0.5 | **0.6** |
| **Overexposed** | on | **0.2** | 0.8 | reinhard | **2.5** | 0.8 | 0 |

Reading it as a set: **`Legacy` is the only bundle with both switches off**, so it is the only one that
skips the whole stage; `Monochrome` has bloom off but tone mapping on, because its look comes from
`saturation: 0` rather than from glow. `Void` and `Overexposed` are the two extremes — one lifts almost
nothing into bloom and darkens (`Threshold 0.85`, `Exposure 0.7`), the other lifts almost everything and
doubles (`0.2`, `2.5`). Every bundle uses ACES except `Ethereal`, `Vintage`, `Monochrome` and
`Overexposed`, which use Reinhard; **none ships `curve: 'none'` except `Legacy`**, where the curve is
never reached anyway.

#### 8.4.3 How a look is applied

- **Switching to `Customize` keeps the active look's values** and opens them for editing, so you always
  edit *from* somewhere. Picking any named look **re-seeds all 21**, discarding edits.
- ⚠️ **`Customize` is an EDIT MODE and adopts no palette.** Picking a *named* look materialises that
  look's `palette` / `paletteMapping` pair into `overlay` where the bundle carries one (§16.4a);
  `Customize` is gated out of that step in `setFilmLook`, because it decides no colour of its own — the
  values it opens are a copy of the look already live. **So switching to `Customize` changes nothing that
  renders**, and the preset's own palette selection survives it. Without the gate the seed bundle's pair
  would be written over the preset's, which is unrecoverable: re-picking the original look adopts the same
  pair again. The gate is on the NAME the call site was given, and it has to be — `lookPaletteForAdoption`
  answers *does this bundle carry a palette*, and a `Customize` seeded from a carrier does.
- ⚠️ **Both processors are DISPOSED AND RE-CREATED on every look change** — shaders recompiled, the mip
  pyramid rebuilt — because `toneMapEnabled` and `toneMapCurve` are compile-time branches rather than
  uniforms. A *slider* drag instead mutates the values in place, which is why dragging Exposure is cheap
  and switching looks is not.
- **The particle-shape half and the palette half take different routes.** The eight shape fields go to
  the particle renderer; the palette pair goes through the palette resolver instead, because it reaches
  **four** consumers (the particle renderer, both trajectory renderers and the generator). Sending the
  palette through the renderer alone is a real past defect: ribbon and neon dropped it silently, so the
  look appeared to be ignored while bloom, exposure and the tone map all kept responding.

> ⚠️ **Live grading is `overlay.filmLook`. The `postProcessors` field is deprecated and is not read.**
> A value written there has no effect and produces no error.

> ⚠️ **A material's `presentation` block reproduces a look, and it must author every one of the 21 fields
> equal to `FILM_LOOKS`' own value.** An omitted field is *inherited* from whatever was there before, so
> the same material can produce two different images depending on what preceded it — and only a test
> that varies the starting state can see that.

---

## 9. Stage 9 — Composition and Reliability

### 9.1 Frame order

```
  reelTick                              ← first statement of the frame body, given absolute time
  generate positions (1) → fields (2) → colour (3) → transform (4)
  draw particles into HDR FBO (5)
  trail feedback                        (6)   ← or before the draw, with Warp First
  warp pass / echo pass                 (7)
  bloom → tone map → grade              (8)
  present                               (9)
  requestAnimationFrame                 ← in a `finally`
```

> ⚠️ **`requestAnimationFrame` belongs in a `finally`, never as the frame's last statement.** A single
> throw anywhere in the body otherwise ends the animation loop for the whole session, with the page
> still showing its last frame — which reads as a hang rather than an error.

The image is kept in **ping-ponged framebuffers**; the three present branches must all read the same
resolved source rather than one of the ping-pong textures directly, or a transition composites the
wrong buffer.

### 9.2 The performance guard

A guard watches frame cost and reduces work when the budget is exceeded. **What it protects is the main
view, and what it spends to do so is the preview tiles** — the Grid, Evolution, History and Reel
thumbnails, which are the only discretionary work in the frame. It owns no renderer references: it
reports a level, and one gate in the frame loop reads it.

#### 9.2.1 What the budget actually is

The tiles do not have a frame budget in milliseconds; they have a **duty cycle**, a fraction of every
frame. Three budgets were authored as absolute slices and are now stored as fractions, because only the
fraction is refresh-rate-invariant:

| Pass | Authored budget | Divisor | Spent on |
|---|---|---|---|
| **Math warm-up** | 4.0 ms | the nominal frame (16.67 ms) | plain arithmetic, no GL — runs **every** frame, because a tile is unshowable until its math completes |
| **GL warm-up** | 12.0 ms | the tile step (66.7 ms) | pre-accumulating a trail so a new tile is recognisable |
| **Steady state** | 10.0 ms | the tile step | the live animation: one render per tile, with the picture returned by the asynchronous readback below |

⚠️ **The two divisors are different and neither is interchangeable**, because the two kinds of budget
were spent at different cadences — the math slice was already per-frame, the GL slices once per tile
*step*. Dividing the math slice by the step interval would quadruple it; dividing a GL slice by the frame
would quadruple the grid's entire cost. The invariant each product preserves is
`duty × frameMs × framesPerSecond = duty × 1000`, i.e. **240, 180 and 150 ms per second** — byte-identical
to what the absolute figures spent at 60 Hz, and now the same at 120 Hz.

Tiles aim at **15 fps** (a 66.7 ms step), each slot keeping its own accumulator so their steps land on
different frames; a tile that does not fit this frame's slice is **skipped and picked up next time via a
rotating cursor**, so it loses frame rate rather than stopping. That rotation is why a shortfall is
shared instead of always starving the same tail.

**The steady slice also scales with the main view's headroom.** Each tile renderer estimates the display's
frame interval as its best recent frame and tracks the main loop's *pressure* — frame time over that interval,
1 when every frame is on time. The steady budget is full at pressure ≤ 1.25 and falls linearly to **zero at
2.5** (on a 60 Hz screen: full above about 48 fps, none below 24), so the main view is served first and the tiles
animate with whatever is left. **Warm-up is never zeroed**: under pressure it advances one render per tick, so
every tile still reaches its first image.

**The picture comes back asynchronously, in one batch.** A tile used to end in its own synchronous
`readPixels`, and because the tiles share one WebGL context with the main view, each of those waited for all
queued GPU work, the main view's frame included — measured on a software GPU, 430–530 ms of every second with
the grid visible. Now every tile due for a blit is tone-mapped into one cell of a 4 × 4 **atlas**, **one**
`readPixels` per pass goes into a pixel-pack buffer with a fence and returns at once, and a later frame paints
the tiles once the fence has signalled (a fence check, never a wait). A tile's picture is therefore one or two
frames late, which a 15 fps thumbnail does not show; a slot that was released or reassigned meanwhile is skipped.
Measured on the same machine: no time left in `readPixels`, and the main view's loss to the grid fell from
30–50 % to 7–16 %.

**`?perf=1` measures all of this on the machine it runs on.** It brackets each section of the main frame —
the figure computation, the particle or splat draw, Neon Lines, ribbons, the Translation Map warp, Electric
Discharge, bloom, the grade and the tiles — and reports CPU milliseconds per frame always, and GPU milliseconds
where the browser offers `EXT_disjoint_timer_query_webgl2`. The GPU queries are collected frames later, never
waited on, and a window in which the GPU reports a disjoint event is discarded. Sections not bracketed (the
trail fade, the warp's plain copy, the final present) are in the frame time but in no row. The CPU column of a
drawing section is small by nature: the GPU does that work later, which is why the GPU column is the one to
read for drawing.

**The figure computation is the CPU's largest share, and three things keep it lean.** (1) The wave sum is
computed for the whole figure at once: for one wave slot the angle `(n + phase) · FM` is linear in the particle
index, so consecutive sines follow from a rotation recurrence (two multiplies and an add) instead of a
`sin` each, re-anchored with an exact `sin`/`cos` every 32 particles so rounding cannot accumulate — the result
matches the per-particle law to about 1e-12 model units, and a slot with `Sharpness` ≠ 0 is computed exactly.
The Score keeps the exact per-particle evaluation. (2) The colour oscillator takes `sin(a + φ)` as
`sin a · cos φ + cos a · sin φ`, with `sin a` and `cos a` per particle held in a table that changes only with the
particle count or the colour frequencies, and φ the frame's phase — bit-identical to the direct form when there
is no colour shift, and on every palette path. (3) A self-similar curve is rebuilt only when one of its inputs
changes (rule, recursion, the angles after breathing, descend, smoothness, centre, generator); a still curve
reuses its points. A `Customize` curve whose shape does move (a breathing Twist rebuilds two recursion levels
every frame) writes its last level directly — each copy's end point is transformed once per build and every leaf
applies only its parent's transform — and reuses one array per depth instead of allocating new ones, so the
build causes no periodic garbage-collection pause. `deformcheck` holds the first two to their exact forms.

#### 9.2.2 The three levels, and how the thresholds were derived

The guard averages **30 frames**, then moves at most one rung per evaluation:

| Level | Enter | Leave | Response |
|---|---|---|---|
| **0** full cadence | — | below **30 fps** → 1 | tiles at their full 15 fps |
| **1** throttled | below 30 fps | **45 fps** sustained → 0 | the steady slice is **divided by 3** → about **5 tile-fps**. ⚠️ **Warm-up is EXEMPT** |
| **2** first images only | below **15 fps** | **22 fps** → 1 | no tile animates, but `tick()` still runs, so every new tile still reaches its first image |

Four properties of that ladder are load-bearing, and each was a measured defect first:

- ⚠️ **A hysteresis band must be WIDER THAN THE COST OF THE THING IT SWITCHES.** The band was 30→35 fps.
  Measured on the built artefact, the tile grids cost the main thread **4.4–7.3 ms per frame**
  (`Cylinder` 7.33, `Chemical` 4.93, `Boiling Milk` 4.37). At the 30 fps trip a frame is 33.3 ms, so
  switching the grids off lands at 26.0–28.9 ms — **34.6–38.4 fps, inside the old 35 fps recovery.** The
  guard recovered *because it had just degraded*, put the cost straight back, and tripped again:
  **21 latch/recover transitions in one run, four inside 30 s**, every trip at 29.x and every recovery at
  35.x. That signature — both ends of the band hit repeatedly and tightly — is what a band narrower than
  its own switch looks like.
- **The replacement band is derived, not chosen.** 45 fps is 22.2 ms; adding the worst measured grid cost
  gives 29.5 ms = 33.9 fps, which still clears the 30 fps trip. **The property to preserve if either
  number is retuned is `1000 / (1000/FPS_THROTTLE_OUT + worstGridCostMs) > FPS_THROTTLE_IN`.**
- ⚠️ **The wide band is affordable only BECAUSE level 1 throttles instead of freezing.** With the old
  boolean latch, widening the recovery threshold would have meant staying *frozen* longer — strictly
  worse. **Do not widen one without the other.**
- ⚠️ **One transition per evaluation, and the DOWN tests come first.** A single evaluation may not skip
  level 1 on the way down, because the throttle is the state the machine must then be measured *under* —
  jumping straight to frozen would decide against a cost that had not been reduced yet. The ladder
  therefore descends one rung per ~30 frames, which is well under half a second at any refresh rate.

#### 9.2.3 Why a band was not enough: the dwell

⚠️ **A hysteresis band cannot fix an oscillation whose switch costs a FRACTION of the frame.** The 45 fps
derivation above assumed the grids' cost was *absolute*. It is not: they spend a **duty cycle**, so their
cost scales with the frame they are added back into, and **no fixed band can be proved wide enough.**
Measured on `Chemical` (20 000 particles, `star`, CPU-bound with the grid hidden): recovery at 45.4,
next window 29.x — **8 transitions in one 20 s phase**, every trip at 28.8–29.8 and every recovery at
45.1–45.9. The same signature the boolean latch printed, from a different cause.

The fix leaves the band alone and makes **a failed recovery slow the next one down**:

```
  at level 1:   windowsAbove = (avgFps ≥ 45) ? windowsAbove + 1 : 0      reset by ONE bad window
  recover 1→0:  requires  windowsAbove ≥ recoverDwell
  trip 0→1:     if the recovery being undone had not yet HELD:
                    recoverDwell = min(8, recoverDwell × 2)
  held:         600 frames at level 0  ⇒  recoverDwell = 1
```

- **The dwell counter is updated on every evaluation at level 1, including the ones that do not recover**
  — it counts *consecutive* good windows, so one window below the band resets it. Reading it only inside
  the recovery branch would make it a count of good windows ever seen, which any oscillating preset
  accumulates.
- ⚠️ **The DOWN-shift is never dwelled.** A guard that is slow to degrade is a guard that does not work;
  only the optimistic direction may be made expensive.
- **600 frames** (5 s at 120 Hz, 10 s at 60 Hz) resets the dwell, so one bad preset cannot permanently
  slow every later recovery in the session. It is counted in **frames, not seconds**, deliberately:
  every other figure in the class is a frame count, and mixing the two units is how a threshold silently
  becomes refresh-rate-dependent.
- **A preset change clears the whole dwell state** along with the sample window, and holds off
  re-evaluation for **90 frames** — a switch reallocates buffers, recompiles programs and re-warms
  trails, so the frames right after it are unrepresentative and would otherwise latch the guard on the
  switch itself. ⚠️ **Carrying a doubled dwell across a switch would make a cheap preset inherit an
  expensive one's pessimism for up to eight windows, with no measurement of its own able to contradict
  it** — which is why the dwell state is cleared and not merely paused.

#### 9.2.4 What the user actually sees

This is the part worth knowing before reading a report, because **all three levels look like a fault and
only one is one.**

| Symptom | Which level | What it really is |
|---|---|---|
| *"the previews animate slowly, all of them together"* | 1 | the throttle working — about 5 tile-fps instead of 15 |
| *"the previews speed up and slow down about twice a second"* | 1 ↔ 0 oscillating | the dwell is what this exists to damp; the console line prints the dwell on **every** transition, because an oscillation is only diagnosable if the log says how hard the guard was already trying not to oscillate |
| *"the previews never appear"* | 2, historically | ⚠️ **the defect that level 1 exists to prevent** |
| *"the main view is fine but one tile is blank"* | not the guard | a tile evicted by the slot cap, which is permanent for the life of the tab ([§9.4](#94-preview-grid-tiles)) |

⚠️ **FREEZING IS WHAT MADE THE USER-VISIBLE DEFECT, and the measurement is unambiguous: a frozen tile has
no warm-up left to finish.** Time to first *animation* in a newly revealed tile after a scroll —

| Preset | Guard | Time to first animation | Distinct frames observed |
|---|---|---|---|
| `Boiling Milk` (50 675 particles) | never tripped | **429–1041 ms** | 50 / 50 |
| `Barrock` (20 000 + Neon Lines) | tripped | **2336–7307 ms** | 1 / 50 |
| `Chemical` | tripped | **never, in 14 s** | — |

So the heaviest preset of the three filled the grid fastest, because it never tripped the guard. **The
grid was stalling while filling — which is work the user is actively waiting on** — and that is why
level 1 exempts warm-up from the throttle while budgeting the steady pass. Level 2 still exists, because
below 15 fps the main view is itself unusable and yielding the whole budget is right; at 25 fps it is
not, and that gap is exactly what level 1 occupies.

**The one thing the guard cannot do:** the gate is all-or-nothing **across** grids. It cannot shed one
grid to save another, so four visible grids share one budget and one of them cannot be preferred.

> ⚠️ **Watch the per-frame allocation RATE, not the frame time.** A periodic allocation reaches the user
> as "a jitter every few seconds", and the period is the diagnostic: derive it, and only then look for a
> parameter with that period. Blaming the nearest periodic control is how this gets misdiagnosed.

> ⚠️ **Degrading is this class WORKING.** Its transitions log at `debug`, not `warn`, for two reasons: a
> preset sitting near a threshold flips repeatedly and would drown the console during exactly the heavy
> sessions a real fault is hunted in; and the line is **actively misleading next to an unrelated report**
> — *"fps recovered — 115.6"* beside a black canvas reads as related evidence when it is nothing of the
> kind, and a `warn` is what makes it read that way.

### 9.3 Reels

A **reel** is an ordered list of preset *names* plus a play mode, a duration and a transition. Names are
resolved **at play time**, so a reel naming a preset this library lacks shows that entry as missing and
skips it rather than failing.

Two transitions ship:

- **Fade to black** — a fixed DOM overlay, using no GL at all. It works because full screen is taken on
  the document element.
- **Cross-fade** — captures the outgoing frame as a **linear HDR, pre-grade** texture and composites it
  against the incoming one. The capture is sanitised at capture time and **dropped on a size change**.

`transitionMix` moves exactly **one** channel per mode, and **only the far end clamps to the identity**:
at `t = 0` the fade returns a full freeze weight, which is the opposite of the identity. The minimum
reel duration is **derived** from the black transition's total duration rather than hardcoded.

### 9.4 Preview grid tiles

A tile is a **real renderer**, not a thumbnail: it runs the same generator, the same wave evaluation,
the same fields, the same warp chain and the same materials as the main view, into its own ping-pong
pair at **256 × 192**. What it does *not* run is most of Stage 8 — which is what makes the reduction
diagnostic rather than merely cheap.

#### 9.4.1 One rendered tile-frame, step by step

```
  1. decay      texA ─blit(+blur)→ fboB,  then a fade quad at  α = 1 − decay^stepFrames
  2. fluid sim  style-6 tiles only — seeds from the CPU state, writes only its own velocity FBO
  3. ┌ warp     texB ─transMap→ fboA      (or a plain COPY when TransMap is off — not optional)
     └ draw     particles → fboA or fboB  (order permuted by Warp First)
                liquid mode REPLACES the draw with its own field + surface pair
  4. (bloom)    DELETED — see below
  5. blit out   fboA ─tonemap→ one cell of the RGBA8 atlas ─async readPixels (one per pass)→ putImageData later
```

Four details in that sequence are not simplifications of the main path but *different* decisions:

- **The decay exponent is `stepFrames`, not 1.** A tile renders one frame per ~4 main-loop frames, so
  its retention per tile-frame has to be `decay^stepFrames` or the trail would be four times too long.
  ⚠️ It reads the **measured** step rather than the 60 Hz constant — using the constant makes the trail
  **2× too long on a 120 Hz panel**.
- **When TransMap is off, the copy still happens.** `fboA` is what the blit-out reads, so skipping it
  would leave the tile showing the previous tile-frame. It is also what makes the two warp orders agree
  when the warp is off, since copy-then-draw-into-A and draw-into-B-then-copy give the same pixels.
- **Both targets are bound explicitly rather than inherited from the decay pass.** ⚠️ **Inheriting
  `fboB` is the one assumption the Warp-First permutation breaks, and it breaks silently:**
  the particles would still land in `fboB` after the warp had consumed it, so they would reach the canvas
  one tile-frame late and unwarped, rather than not at all.
- **The material blend mode is honoured rather than forced additive.** `Ice` and any `alpha` material is
  bounded at 1.0 in the main renderer; forcing it additive here let a dense tile sum without bound, so
  `Miracle Frost` rendered **solid white in the grid while looking correct in the main view.**

#### 9.4.2 Where a tile differs from the full pipeline

| | Main view | Tile |
|---|---|---|
| Resolution | the canvas | **256 × 192**, fixed |
| Particle count | the preset's | **÷ 4**, then capped at **2000** — a 20 000-particle preset keeps 1/10 |
| Sprite radius (splat) | preset | × `SCREEN_SPACE_TILE_SCALE` ((256+192)/(1024+768) ≈ 0.25) |
| Cadence | every frame | **15 fps** target — one tile-frame per ~4 main frames |
| Trail decay | `d` per frame | `d^stepFrames` per tile-frame |
| **Bloom** | 4 programs over a 5-level mip pyramid ([§8.1](#81-bloom)) | ⚠️ **omitted entirely** |
| **Tone map + grade** | 3 curves + lift/gamma/gain/saturation/vignette ([§8.2](#82-tone-mapping)–[§8.3](#83-lift-gamma-gain-saturation-vignette)) | ⚠️ **one fixed exponential curve**, `1 − exp(−1.5·hdr)` |
| Film look's 11 grading fields | applied | **none of them** |
| Present | blit to the default framebuffer | an atlas cell, read back asynchronously → `putImageData` |

> **If a tile looks *better* than the main view, the defect is in the grading chain** — because the tile
> runs the same geometry through a shorter one. That is the whole diagnostic value of the reduction, and
> it is why the reduction is a deliberate won't-fix rather than a backlog item.

⚠️⚠️ **THE FIGURE IS NOT PART OF THE REDUCTION, AND THAT HAS TO BE STATED RATHER THAN INFERRED FROM THE
TABLE ABOVE.** Every stage-1 control reaches a tile: the wave basis and all three of its slot values,
the amplitude ramp, the secular term, the DC term, the symmetry fold, the twist, the box-fold, the
taper, the bend, the inversion and the 4D rotation. **The diagnostic rule only holds because of that** —
a tile showing a different *shape* from the main view is not a fidelity reduction, it is a forwarding
gap, and **no checker compares a tile against the main view** (the checker that compares the two covers
grading, never geometry). ⚠️ **Adding a figure control is therefore a two-file edit, and the tile
renderer is the half nothing enforces** — the generator compiles perfectly well with an operator the
tile renderer never forwards, and the symptom is a tile drawing a different figure, which reads as
reduced fidelity. **The zeros are the proof when checking one:** a twist and a box-fold both leave z
untouched, so a tile that moves z under either is wrong, and taper and bend must publish a per-particle
channel buffer at all.

⚠️ **THE BLOOM PASS WAS NOT OMITTED FOR COST — IT WAS DIVERGENT.** A tile has no spare FBO in its
ping-pong pair, so the pass blurred `fboB` into `fboA` and blended it back onto `fboB` at 30 %: it
**added 30 % of the trail buffer to itself every rendered frame.** With the fade pass, the per-frame gain
on existing content is `decay^stepFrames · 1.3`, which **diverges for any `decay^stepFrames` above
1/1.3 = 0.769** — i.e. any `decayFactor` above about **0.936**. `Miracle Frost` ships `0.9877`, giving
**1.237 per frame**: the tile drew the figure correctly and then compounded it to solid white. The main
renderer never had this because it blooms into a *separate* output FBO and never writes the result back
into the trail buffer. At 256 × 192 a 2 px blur is barely perceptible anyway, so **the honest fix was to
delete the pass rather than tune a feedback loop toward the edge of stability.**

#### 9.4.3 Why tiles need a brightness compensation, and why it is narrow

Reducing the particle count does not dim a tile by itself — but two reductions compose, and nothing
recovered either:

```
  1. count ÷ 4, and on the SPLAT path the sprite radius is also × S, so the sprite-area ratio
     is S² = 0.0625 — exactly the tile/main frame-area ratio. Those two CANCEL, leaving the
     per-frame luminance ratio equal to the COUNT ratio, 0.25.
  2. a tile renders one frame per `stepFrames` and fades by d^stepFrames, so its steady-state
     trail gain is 1/(1 − d^stepFrames) against the main view's 1/(1 − d)
     — 1.99× against 6.25× at d = 0.84.

  ⇒  B = (1 − d^stepFrames) / ((1 − d) · countRatio)        restores steady-state parity exactly
```

Material presets were rendering about **13× darker** than the main view: `Julia Burn Rivers` measured a
mean frame luminance of **10/255 against 159/255**, reported as *"almost black, you only notice
something is moving"*. After the compensation: **10 → 100** (main 159), `Ember Storm` **12 → 94**
(main 179), `Hopf Fire Ring` **22 → 163** (main 220). **The residual gap is bloom and film-look exposure,
which tiles omit by decision** — the compensation does not try to replace them.

⚠️ **Three constraints, each of which makes a wider fix wrong:**

- **Additive only.** The derivation assumes light *sums*. Alpha blending converges to a weighted average
  bounded at 1.0, so a 13× lift there does not brighten the trail — it drives alpha to 1.0 and makes
  every particle fully opaque, which is the `Miracle Frost` solid-white failure again. **Alpha materials
  (Ice, Fog, Smoke, Organic) get exactly 1.0.**
- **The non-splat path is deliberately untouched.** Modes 0/1/2 keep a *fixed* `gl_PointSize` in both
  renderers, so their sprite-area ratio is 1.0 and does **not** cancel the 16× frame-area ratio — against
  the same metric they are about **5× too BRIGHT**, not too dark. That has been the accepted appearance of
  **167 of the 177** legacy presets for the life of the grid, and "correcting" it would restyle the whole
  library on the strength of one metric.
- **Capped at `stepFrames × 4`.** Above that the count ratio has already dropped below 1/4 because the
  2000-particle cap truncated it, so the figure is genuinely *sparser* — and **brightness cannot recover
  lost structure.** Exact compensation there is 34.4×, which trades a faithfully dim curve for bright
  scattered dots; the cap accepts the dimmer, honest one.

⚠️ **The related authoring trap: absolute pixels and a multiplier on an already-scaled base coincide at
tile size, so applying both SQUARES the reduction.** Decide which of the two a new size field is before
scaling it.

#### 9.4.4 Slots, eviction and the blit

Slot supply is **viewport-driven with eviction**, capped at **128** slots.

⚠️ **Eviction is by LRU with NO CALLBACK, and an evicted tile has no intersection change left to fire —
it is dead for the life of the tab.** That asymmetry is the whole reason "visible" and "live" are
separate sets, with a second live-tile cap and **one** reconcile owner: a tile can be on screen and not
in the live set, and nothing in the DOM will ever ask for it again.

⚠️ **The blit uses `putImageData`, which NEVER resamples.** A destination canvas smaller than 256 × 192
**crops to the top-left** rather than scaling, and the crop is silent — a tile that looks like a
zoomed-in detail of the figure is this, not a framing bug.

Two more tile-specific rules worth knowing when reading tile code: a tile resolves `overlay.X ?? preset.Y`
in the **main loop's** order or it disagrees with the view it is previewing; and **reordering the grid
MOVES tiles**, so a click listener must read the preset name off the tile's own dataset rather than off
its position.

### 9.5 Numerical robustness

- **Forward-Euler integrators diverge — reseed, do not clamp.** Clamping produces a particle stuck on a
  boundary, which looks like a rendering artefact; reseeding returns it to the figure. Offsets are
  derived from the particle index, never from a random draw, so the behaviour is identical on every
  machine.
- **NaN cannot be removed with `mix`.** `mix(x, release, vecN(bvecN))` is a no-op for NaN, because any
  arithmetic on NaN is NaN. A **boolean select** is required, it needs `highp`, and the alpha channel
  must be guarded too.
- **One stage cannot localise a NaN producer.** A guard that releases to 0 hides its own trip; a boolean
  scan cannot see a *ramp*, so the magnitude has to be measured; and `nan == total` means a NaN uniform
  or a whole bad texture rather than a stray texel.
- **A clean console is not evidence the frame is fine.** The opt-in `?gldiag=1` adds an error drain, a
  trail probe and an upload trap. It is opt-in because draining GL errors forces a pipeline flush.
- **A failed shader compile throws nothing.** It links, binds and draws as a no-op — a black frame with
  an empty console — so every program goes through one compile helper whose label argument is
  load-bearing for diagnosis.

---

## 10. The Export and Import Formats

This chapter documents the formats the engine **writes** and **reads**: the preset object, the library
bundle, the reel file, the two deployment data files, and the legacy format all of them descend from.

Two framings before the schemas, because they explain most of what looks odd later.

**An export is a record of a session, not a template.** What `Export` writes is the Lab's working preset
with its `overlay` replaced by a live snapshot of the engine's state. So everything reachable in the UI
is either in the file or **deliberately absent** — and the absences carry meaning, which is why
[§10.6](#106-absence-is-meaningful) exists at all.

**An export is also mostly runtime-default noise.** The snapshot emits 15 overlay keys unconditionally
and 24 more behind gates (measured by walking the snapshot literal: 39 top-level entries, plus
`customFilmLookParams` when the film look is `Customize`). A hand-authored preset in the source tree
carries only the handful of keys it means. ⚠️ **So do not diff two exports by eye to find what a session
changed** — diff each against the default constants programmatically.

### 10.1 Four artefacts, three formats

| Artefact | Written by | Shape | Filename |
|---|---|---|---|
| One preset | the Lab header's **Export** | a single preset object, plain JSON | `<Preset Name>_YYYYMMDD_HHMMSS.json` |
| The whole library | the preview grid's **Export All** | `g_psss_presets={ "Name": {…}, … }` | `psss_presets.json` — **no stamp** |
| The reels | the Reel tab's **Export Reels** | `g_psss_reels={ version, reels, mainReelName }` | `psss_reels.json` — **no stamp** |
| The legacy library (from `psss-original/`, the original JavaScript version verbatim) | nothing — inherited, read-only | v1 keys (`ParticleCount`, `Waves`, …) | `psss_presets.json` in `psss-original/` and `public/` |

The timestamp is **local wall-clock time**, `YYYYMMDD_HHMMSS`, not UTC: it exists so two exports of one
preset can be told apart at a glance, which only works if it reads as the time the button was pressed.

⚠️ **The two library exports are deliberately unstamped**, because their whole purpose is to replace a
file whose name is fixed. A stamped name would hand the renaming back to the user — the exact step the
drop-in change removed. A **single** preset export is not a deployment file and keeps its stamp.

⚠️ **What `Export All` writes is a COMPOSED library, and composing it is a counting trap.** The live
library is the **deduped union of seven TypeScript groups plus the legacy JSON**, not their sum: a
*refined* preset **replaces** the legacy entry of the same name rather than adding to it. So a total
reached by adding the groups up overstates the library, and a refinement being settled makes the union
**one smaller** — which is a change of **basis**, not an event. Count by importing the composed library
and taking its keys; never by summing the sources, and never by counting indentation in the JSON.

### 10.2 The five blocks

```jsonc
{
  "metadata":       { … },   // identity, and the resolution every amplitude is relative to
  "generators":     { … },   // the figure: its TYPE, the wave table or the curve block, colour, spin
  "renderer":       { … },   // how one particle is drawn, and how long the trail lives
  "postProcessors": { … },   // the warp's tables — plus two blocks nothing reads
  "overlay":        { … }    // everything the Lab owns; AUTHORITATIVE wherever the two overlap
}
```

The first four are the shape the format had before the Lab existed. `overlay` is where the engine's own
vocabulary lives — film looks, materials, the warp chain, crystals, the six field systems — and it is
why two of `postProcessors`' three members are inert ([§10.7](#107-the-blocks-nothing-reads)).

⚠️ **`generators.type` selects which figure source runs, and the per-type parameter blocks
are INDEPENDENT of each other.** `type: "lissajous"` reads `generators.waves`; `type: "lsystem"`
reads `generators.lsystem`. **A preset may carry both, and the one that is not live is preserved
rather than cleared** — on export, on import, in a snapshot and through a type switch in the
Composer. That is what makes switching reversible, and what lets one preset hold a tuned version of
each.

⚠️ **An unrecognised `type` is resolved on READ and never rewritten.** The order is: a known
type wins; otherwise a parameter block belonging to a known type selects that type and the UI shows a
one-line notice; otherwise the default type with defaults. **It never throws and never renders an
empty frame.** The preset on disk is left exactly as it was, so a file written by a newer build keeps
working when it returns to that build.

| Block | Required fields | Notes |
|---|---|---|
| `metadata` | `name`, `version: 2`, `designResolution {width, height}` | `createdWith`, `tags` optional. **`name` is a primary key** — [§10.9](#109-importing-names-versions-and-case) |
| `generators` | `type`, `particleCount`, `waveSpeed`, `rotation[3]`, `waves[]`, `colorBase[3]`, `colorAmp[3]`, `colorFreq[3]`, `colorShift[3]` | `angle[3]` (initial pose) and `attractor` optional. `type` is `'lissajous' \| 'attractor'` |
| `renderer` | `mode`, `glow`, `decayFactor`, `blurRadius`, `depthSize`, `streaks` | `speedFactor` and `curlNoise` are **deprecated import-compat only** |
| `postProcessors` | `transMap`, `bloom`, `toneMap` | only `transMap` is read |
| `overlay` | — (the whole block is optional) | absent ⇒ a pre-Lab preset; every Lab feature off |

⚠️ **`designResolution` is what makes an amplitude portable.** Every wave amplitude is expressed against
that box and scaled to the live canvas at init, so a preset authored at 100×100 and one authored at
1920×1080 both fill the window. It is **a scale and not an origin** — see [§4.3](#43-canvas-fit).

⚠️ **`rotation` is a speed and `angle` is a pose**, and the two are easy to confuse because both are
three numbers in degrees. `angle` also diverges from the legacy engine's interpretation, so a legacy
figure and its migrated twin can differ in starting orientation while rotating identically.

### 10.3 The wave table is `[wave][axis]`

```jsonc
"waves": [                       // exactly three entries in every shipped preset
  {
    "speed": 0.05,               // typed, interpolated — and READ BY NOTHING. Preserve verbatim.
    "axes": [                    // exactly three: X, Y, Z
      {
        "phase": 90,             // degrees; MULTIPLIED by fm.base, not added
        "am": { "base": 42.67, "amplitude": 0, "frequency": 0 },
        "fm": { "base": 0,     "amplitude": 8, "frequency": 1 }
      },
      { … },                     // Y
      { … }                      // Z
    ]
  },
  { … }, { … }                   // waves 2 and 3
]
```

Three waves × three axes × seven numbers = **up to 63 numbers** describing the figure. The evaluation is
[§1.1](#11-the-additive-wave-model); three things about the *serialised* form bite:

- **`fm.base` is the winding number**, and it is divided by `DEG` on the way in while `am` is not.
  Misapplying that shrinks the figure — and the Composer's Score auto-fits, so it still looks right.
- **`phase` is multiplied by the winding**, `(n + φ)·f`, not `n·f + φ`. The same numbers under the other
  reading give a different figure.
- **A slot is silent when `am.base` and its pulse are both 0**, never because `fm.base` is 0. An
  all-zero third wave is the normal state, not a defect: most presets use one or two.

### 10.4 A complete real example

This is `Axis Zoom Breathe` exactly as the source tree authors it, with the two silent waves elided. It
is a useful example precisely because it is small: a browser export of the same preset is several times
longer, for the reason given at the top of this chapter.

```jsonc
{
  "metadata": {
    "name": "Axis Zoom Breathe", "version": 2,
    "designResolution": { "width": 100, "height": 100 },
    "tags": ["demo", "transmap", "style1", "review"]
  },
  "generators": {
    "type": "lissajous", "particleCount": 5000, "waveSpeed": 0.05,
    "rotation": [1, 1, 1], "angle": [0, 0, 0],
    "waves": [
      { "speed": 0.05, "axes": [
        { "phase": 90, "am": { "base": 42.666664, "amplitude": 0, "frequency": 0 },
                       "fm": { "base": 0, "amplitude": 8, "frequency": 1 } },
        { "phase": 0,  "am": { "base": 42.666668, "amplitude": 0, "frequency": 0 },
                       "fm": { "base": 0, "amplitude": 8, "frequency": 2 } },
        { "phase": 0,  "am": { "base": 0, "amplitude": 0, "frequency": 0 },
                       "fm": { "base": 0, "amplitude": 0, "frequency": 0 } }
      ] }
      /* waves 2 and 3: all-zero axes — silent */
    ],
    "colorBase": [ … ], "colorAmp": [ … ], "colorFreq": [ … ], "colorShift": [ … ]
  },
  "renderer": {
    "mode": "star", "glow": 2, "decayFactor": 0.78,
    "blurRadius": 3, "depthSize": 0, "streaks": 0
  },
  "postProcessors": {
    "transMap": {
      "enabled": true, "style": 1, "beforeParticles": false,
      "sinMagicParams":  [[0,0,0,0], [0,0,0,0], [1,0,0,0], [8,0,0,0]],
      "sinMagicParams2": [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]],
      "zoomCenter": { "x": 38, "y": 44 }
    },
    "bloom":   { "enabled": false, "threshold": 0.8, "intensity": 0.3, "radius": 5 },
    "toneMap": { "curve": "none", "exposure": 1,
                 "lift": [0,0,0], "gamma": [1,1,1], "gain": [1,1,1] }
  },
  "overlay": {
    "renderMode": "star",
    "filmLook": "Legacy Graded",
    "transMapEnabled": true,
    "transMapStyle": 1,
    "transMapChain": [
      { "style": 1, "enabled": true, "weight": 1,
        "zoomCenter": { "x": 38, "y": 44 },
        "staticField": { "pattern": "Grid Lattice", "strength": 0.8,
                         "detail": 1, "drift": 0.18 } }
    ],
    "transMapWarpMix": 0.85,
    "transMapDispersion": 0,
    "speedFactor": 0.4
  }
}
```

Four things in that file are worth naming, because each one is a rule rather than a detail.

- **`renderer.mode` and `overlay.renderMode` both say `star`, and the overlay is the one that decides.**
  Where the two blocks overlap, `overlay` wins — and a material can override the resolved mode anyway
  ([§5.2](#52-the-six-modes)).
- **`postProcessors.bloom` and `toneMap` are present and inert.** The grade here comes entirely from
  `filmLook: "Legacy Graded"`. Editing `"intensity": 0.3` changes nothing on screen.
- **`transMapStyle: 1` and `transMapChain` say the same thing twice, on purpose.** The scalar is the
  compatibility contract; the array is the truth when a chain says more than one number can.
- **`"transMapDispersion": 0` would NOT survive a round trip.** It is authored explicitly here, but the
  exporter's gate drops it, because 0 is the default — so re-exporting this preset produces a file
  without that key and with identical behaviour. That is the normal case, not a loss.

### 10.5 The overlay block and its export gates

`overlay` is assembled fresh on every Export, Snapshot and Mixer read by one function. **16 entries
are emitted unconditionally** and the rest sit behind the gates below.

⚠️ **TWO COUNTS HERE WEAR THE SAME WORDS AND ARE NOT THE SAME MEASUREMENT.** `OverlayState`'s
interface declares **76** top-level keys; the export function emits **16** of them unconditionally plus
the gated blocks. The difference is keys the exporter never writes at all — `overlay.growth` is
import-only, and `sliderBaseFilmLook` / `customFilmLookParams` are the Sliders tab's own working state.
⚠️ **A count of the exporter's EMITTABLE set is a third basis again, and must be derived from the export
function rather than from either number here.**

| Always emitted | |
|---|---|
| `ribbonMode`, `ribbonWidth`, `linesEnabled`, `lineWidth` | ribbon and neon-line state |
| `splatShear` | `'tangent'` or `'fixed'` — which way a material splat's cross-axis runs. ⚠️ **Written unconditionally on purpose:** it is a per-KEY categorical, so there is no block to destroy by omitting it, and a value-based gate would make Export disagree with the live state for any preset deliberately switched back to `tangent` |
| `filmLook` | the grade's name ([§8.4](#84-film-looks)) |
| `attractorIndex`, `attractorBlend` | −1 and 0 when there is no attractor |
| `renderMode` | and it round-trips **unconditionally**, which is what makes a missing `liquid` block recoverable-looking but not recoverable |
| `transMapEnabled`, `transMapStyle` | the scalar compatibility contract |
| `curlNoise`, `physarum`, `fluidAdvection` | three field systems whose blocks are never gated |
| `speedFactor`, `figureScale` | |

The gates fall into four shapes, and **they are deliberately not unified** — each is derived from what
its own block means:

| Block | Gate | Why that gate |
|---|---|---|
| `liquid` | `mode === 'liquid'` **OR** any field differs from its default | mode alone was the gate once, and leaving the mode for one moment erased eleven authored fields |
| `cohesion` | `strength > 0` | cohesion moves positions, so a beaded `star` preset is a legitimate look — a mode gate would drop its defining parameter |
| `liquidField` | `enabled && poolSize > 0` | the same pair the generator's own publication gate tests, so the export and the picture agree |
| `dye` | `enabled && opacity > 0` | at opacity 0 the field deposits nothing, so the block describes nothing |

⚠️ **THREE KEYS INSIDE `overlay.dye` RIDE THAT SAME GATE: `ramp`, `blendMode` and `showFigure`.** All
three are **optional** in the type (invariant 14: *prefer flat scalars read as `?? default`*), so an
export that omits them imports unchanged and no preset body needs to state its own defaults.

⚠️ **AN EXPORT CARRIES THEM EVEN WHERE THE PRESET DID NOT AUTHOR THEM**, because the export spreads the
RESOLVED config and the apply site fills defaults first — the *"an export is mostly runtime-default
noise"* rule, and intended. **The Mixer behaves the opposite way on purpose:** `interpolateDye` uses
conditional spreads, so an absent key stays absent through a crossfade and **the Mixer can never add a
key neither deck authored.**

⚠️ **A GATE THAT DECLINES TO EMIT A BLOCK DESTROYS IT RATHER THAN OMITTING IT.** Export and Snapshot
**replace** `overlay` wholesale instead of merging into it, so one bad gate breaks all three operations
at once — and **Snapshot is the worst of the three, because it writes the loss into the history the user
is expected to restore from.** This is the single most expensive mistake available in this format.

Two gates are *not* members of that set and must not be counted with them:

- **`palette` / `paletteMapping` are value-gated on `!== undefined`**, two flat optional scalars with
  independent gates. `undefined` means *"no override, inherit the film look's palette"*; **`'none'` is a
  real authored value and must be emitted**, meaning *"this preset has no palette even though its look
  has one"*. A truthy test instead of an `undefined` test is the whole defect in one character.
- **`physarum` is gated at the FIELD, not the block.** The block ships whole — a block-level gate would
  destroy its other eight fields — and only `trailColour` is dropped when it equals the inherit
  sentinel. Omitting that one key is safe **only because the import path normalises it back**.

#### The four figure-operator gates

`Sharpness`+`Temper`, `Travel`+`Stretch`, `Offset`+`Sway` and `Grow`+`Flare`
([§1.1](#11-the-additive-wave-model)) are flat scalars, so each is **identity-gated** and belongs to
[§10.6](#106-absence-is-meaningful)'s first class rather than to the four block shapes above. Three
properties of those four gates are not guessable from the keys:

- ⚠️ **ONE SHARED OWNER, NOT TWO COPIES, AND THAT IS A DELIBERATE DEPARTURE FROM EVERY NEIGHBOURING
  OPERATOR.** The twist, taper, bend and inversion gates are each written twice — once in the preserved
  overlay the bypass path uses, once in the plain snapshot branch — with a comment saying the
  byte-identity assertion is what catches a drift between the copies. **That is affordable for a
  three-key triple and not for thirty-one keys over four gates with a nested sub-gate in each.** The
  preserved overlay is spread *over* the frozen capture, so a key emitted on one side and not the other
  is *added* rather than matched, and the bypassed export gains keys the authored one does not have.
  One owner removes the drift instead of detecting it.
- ⚠️ **ALL THREE SHARPNESS VALUES OR NONE.** Because Structure and Detail read `?? sharpness`, emitting
  one of the three alone would make every Body-only preset silently uniform on reload. **The sharpness
  gate also reads the depth, not only the three bases**, because `Temper` over a base of 0 is a real
  figure — it breathes up from pure sine — and gating on the bases alone would destroy that preset's
  only authored value.
- ⚠️ **THE DEPTH/RATE SUB-GATE SITS INSIDE THE BASE GATE.** A rate with no depth is inert, since the
  modulator is skipped entirely at depth 0, so emitting it alone would put a dead key into every
  export. An export is mostly runtime-default noise already — **diff programmatically against the
  default constants rather than by eye.**

### 10.6 Absence is meaningful

A key missing from an export means one of four distinct things, and reading the wrong one is how a
hand-edited file ends up behaving unlike its source.

| Class | Example | What the absence means |
|---|---|---|
| **Identity-gated noise** | `particleSize` at 1.0; `symmetryFold` at 1; `transMapBeforeParticles` false; `transMapDispersion` 0; the three `sharpness` levels at 0; the three `travel`, `offset` and `grow` triples at 0, and every breathing depth and rate with them; `escapeFlow` at `'contour'` | the default. Emitting it would put an inert key into every export, and keeping it out is what makes an untouched export byte-identical to one written before the feature existed. ⚠️ **`grow`'s identity is `0`, not `1`** — see [§1.1](#the-amplitude-ramp--grow) |
| **"No override — inherit"** | `palette`, `paletteMapping` | a *state*, not a value: the film look decides. This is the class where a gate is destructive rather than tidy |
| **History, excluded on purpose** | the dye texture; the crystal pool's frozen particles; the physarum trail | it cannot interpolate in the Mixer and must not survive a preset switch. Parameters are serialised, state never is |
| **Dead** | `visualFx`; `postProcessors.bloom` | present in most files and read by nothing — [§10.7](#107-the-blocks-nothing-reads) |

⚠️ **The first and second classes look identical in a diff** and are opposites in effect. The test is
whether the field has an inert *value* (class one) or no value at all (class two).

⚠️ **`escapeFlow` and `splatShear` are both per-key categoricals and they are gated oppositely, which is
a difference in what their defaults MEAN rather than an inconsistency.** `splatShear`'s other value is a
look a user can choose and then deliberately switch back from, so omitting the default would make the
export disagree with a deliberate state. `escapeFlow`'s default is the only behaviour the fractal sources
have, so writing it would add an inert key to every export in the library. **Neither can be derived from
"it is categorical"** — the question is whether the default is a decision or merely the absence of one.

⚠️ **Since 2026-11-01 that asymmetry is wider still, and the gate did not have to change: `escapeFlow` has
no control at all.** The non-default is unreachable from the UI and authored by no preset, so "the default
is the only behaviour" is now true twice over — while `splatShear`'s other value is still one click away.
**A gate derived from what a default MEANS survives the control being withdrawn; one derived from the key's
type would not have.**

### 10.7 The blocks nothing reads

These are serialised, migrated and interpolated, and **writing to them has no visual effect whatsoever**.
They survive because every preset and every export already carries them, and because a few non-rendering
consumers still read them.

| Block | Write this instead |
|---|---|
| `postProcessors.bloom` | `overlay.customFilmLookParams.bloomEnabled` / `.bloomIntensity`, with `overlay.filmLook = 'Customize'` |
| `postProcessors.toneMap` | `overlay.customFilmLookParams` — and set `toneMapEnabled` too, since patching `exposure` alone on a `Legacy` preset changes nothing |
| `visualFx` (`palette`, `paletteMapping`, `filmLook`) | `overlay.palette`, `overlay.paletteMapping`, `overlay.filmLook` |
| `renderer.speedFactor` | `overlay.speedFactor` |
| `renderer.curlNoise` | `overlay.curlNoise` |
| `WaveConfig.speed` | nothing — there is no control, and the value is preserved verbatim |

⚠️ **This is not a historical curiosity: three controls wrote into the dead grading blocks and silently
did nothing** until it was found by measurement. A slider can move the right field of the wrong block and
read as a taste problem rather than as a defect.

The opposite case is worth recording too. A **required** `fields: { active: [] }` block once sat in this
format, written at 14 sites and read at **zero** — reserved for a registry that was never built. Being
required was the harm: every new preset had to carry a meaningless line, and every export advertised a
capability that did not exist. It was deleted, and no file on disk depended on it.

### 10.8 Bundles, and how one is told from a single preset

`Export All` writes a **bundle** — `{ "Preset Name": { …preset… }, … }` — and `Import` accepts either
shape. The discrimination is **structural**: a bundle is an object whose every value is itself
preset-shaped, where "preset-shaped" means carrying at least one marker key from the union of **both**
schema versions (`metadata`, `generators`, `renderer`, `overlay`, `postProcessors`, `ParticleCount`,
`Waves`, `SinMagicParams`, `MotionBlur`, `Version`).

⚠️ **A top-level key sniff cannot work here, and the reason is a single preset name.** The library
contains a preset literally named **`Waves`**, so a bundle has a top-level `Waves` key and a key sniff
classifies the whole bundle as one v1 preset with a wave table. A v2 single preset is not mistaken for a
bundle in the other direction because its four values are objects but none of them is preset-shaped.

⚠️ **This function exists because `Export All` once wrote a file `Import` could not read**, and nothing
said so: the bundle was handed whole to the migration layer, which does not throw on it. It produced
**one** nonsense preset out of 177 — named after the file, with a default particle count — and reported
success. The classifier was measured against all five real shapes (v1 single, v1 single *named `Waves`*,
v2 single, v1 bundle, v2 bundle) before being trusted.

### 10.9 Importing: names, versions and case

**A preset name is a primary key**, and it is one in five separate owners, so a duplicate does not
produce two tiles with one label — it freezes a tile. Import therefore renames rather than overwrites.

The rule is a trailing ` v<n>` suffix: `Cylinder` → `Cylinder v2` → `Cylinder v3`, and
`Moebius Paranoia v7` → `v8` → `v9` → `v10`, the number rising until the name is free. The stem is
re-derived from the original name every call, never accumulated — otherwise a second import yields
`Cylinder v2 v3`.

⚠️ **The space before the `v` and the anchored digits are both load-bearing, and the pattern is measured
rather than merely written.** Over the composed library it matches **0 names**, which is the point and
also the limit of the evidence: nothing in the library can falsify it, so only an import ever exercises
it. The version-*ish* names it correctly leaves alone number **thirty, in two populations** — 7
digit-tailed (`Galaxy2`, `Nova2`, `Fluid Metall 2`, …) and 23 Roman-numeral (`Aurora Borealis II` …),
the second growing with every variant spawn. A looser pattern such as `\d+$` would read `Galaxy2` as
`Galaxy` version 2 and rename the import to `Galaxy3` — and **6 of those 7 stems are themselves live
presets**, so the damage would be joining a real family rather than inventing one.

⚠️ **The taken-names set is compared lower-cased**, because the name-keyed maps downstream are
case-sensitive while a user is not: `cosmos` and `Cosmos` would otherwise be two slots for one apparent
name. A rename to a case-only variant of a preset's *own* name is accepted as a recase, not a collision.

### 10.10 The reel file

```jsonc
{
  "version": 1,
  "reels": [
    {
      "name": "Grand Tour",          // unique, compared case-insensitively — the primary key
      "presets": ["Cycloid", "…"],   // play order; duplicates allowed, a reel may revisit a figure
      "playMode": "sequential",      // 'sequential' | 'random'
      "playSeconds": 20,             // seconds held FULLY VISIBLE; the transition runs on top
      "transition": "fade"           // 'black' | 'fade'
    }
  ],
  "mainReelName": "Grand Tour"       // or null
}
```

**Stored values are the bare words.** Labels live only in a label map, so **a label persisted, or a
stored word printed in the UI, is the defect.**

Reading is forgiving in one direction and strict in another:

- **Rejection is per reel, never per file.** A half-written entry costs the user that reel, and the count
  of rejects is reported — *"3 reels loaded, 1 unreadable"* rather than an empty list that looks like a
  wiped profile. A reel needs a non-empty `name` and an array `presets` to survive at all.
- **Unknown `playMode` or `transition` falls back to the default** (`sequential`, `fade`) instead of
  rejecting the reel; `playSeconds` is clamped to **2…600 s**, default 20. ⚠️ **The 2 s floor is derived
  from the black transition's total duration (1900 ms), not chosen** — below it a reel spends more time
  transitioning than showing. Never hardcode a floor here.
- **`mainReelName` is advisory.** Names resolve at **play** time, so saving does not prune a name the
  library lacks: it is shown as missing and skipped. Four candidates resolve the main reel in one fixed
  order, and **the deployment's answer is never persisted** — persisting it would freeze the opening
  animation at whatever the first run happened to see.

⚠️ **There is exactly ONE shape test, and the text parser is a `JSON.parse` in front of it.** The
deployment's reel file arrives as an *object*, not as text (it is loaded with a `<script>` tag — see
[§10.11](#1011-the-two-deployment-files)), so the object path and the Import path must share the test.
**Two shape tests for one format is the defect, not the duplication**: they drift on whichever field a
future version adds, and then the deployment accepts a file the Import button rejects with nothing
between the copies able to see it. The same test, exposed under another name, is what lets the **preset**
importer reject a reel file with a message that says what the file actually was.

### 10.11 The two deployment files

A built deployment is **four files**: `index.html`, `psss-engine.js`, `psss_presets.json` and
`psss_reels.json`. ⚠️ **Despite the extension, the two data files are JavaScript, not JSON.** Each is a
single assignment loaded by a `<script defer>` tag:

```js
g_psss_presets={ "Cycloid": { … }, … }
g_psss_reels={ "version": 1, "reels": [ … ], "mainReelName": "…" }
```

**That is forced by the transport, and it was measured rather than assumed.** Against a real build opened
by double-clicking `index.html` — the `file://` protocol — both of the usual ways of reading a sibling
file fail outright:

| Attempt | Result under `file://` |
|---|---|
| `fetch('./psss_presets.json')` | `TypeError: Failed to fetch` |
| synchronous `XMLHttpRequest` | `NetworkError: Failed to load 'file:///…'` |
| `<script src="./psss_presets.json">` | works — `typeof globalThis.g_psss_presets === 'object'` |

A locally-opened page has exactly one way to read a neighbouring data file, and it is to **execute** it.
Plain JSON cannot be auto-loaded from disk by any browser transport, which is also the arrangement the
original PSSS used.

⚠️ **So the exporter writes the assignment rather than asking the user to add it.** Both library exports
go through one writer and use the deployment's exact filenames, which makes replacing a shipped library a
copy-over with no editing. **This reverses an older rule** — *do not write the prefix in the exporter* —
whose stated reason was that Import would then have to accept two dialects. That reason is discharged
rather than ignored: **one strip function runs on every read path**, so both dialects import and an older
plain-JSON export keeps working. The strip is anchored and deliberately narrow (it matches only
`g_psss_` plus word characters at the very start, and an optional trailing `;`), so a preset whose
*name* contains an `=` cannot be clipped.

Three asymmetries in this pair are load-bearing:

- **`psss_presets.json` missing is FATAL; `psss_reels.json` missing is a warning.** The bundle contains
  no presets at all, so the alternative to failing is a black canvas that reports nothing — whereas the
  built-in reels travel *inside* the bundle, so a deployment with no reel file still plays. ⚠️ **Never
  make them symmetric.** A present-but-malformed reel file is reported and then **ignored**; the fallback
  is deliberately not consulted, because quietly playing something else is how a deployment mistake stays
  unnoticed.
- **The prefix is optional on the dev path and mandatory in the deployment.** The dev server `fetch`es
  the file and strips the prefix only if present, so a prefix-less file dropped into `public/` works
  under `npm run dev` — and then, in a build, parses as a bare block, raises a console `SyntaxError`,
  leaves the global undefined and makes the engine report the file as **missing**. That asymmetry is
  precisely why the exporter writes the prefix.
- **`__reels` is a reserved KEY inside `g_psss_presets`, never a second assignment statement.** An
  authored reel list may still live inside the preset file as that key, where it is **build input only**
  and is never re-emitted. A second `g_psss_reels = {…}` statement in that file makes the dev loader's
  `JSON.parse` throw and continue with an **empty library**.

⚠️ **The two global names are spelled in three files with no compiler between them** — the format owner,
the build's script-tag emitter, and the Node script that writes the library — because a build script
cannot import the TypeScript module without a build step of its own. A checker closes that gap for the
reel *filename*; the **globals have no checker at all**, and a mismatch is silent in this deployment's
characteristic way: the page loads, the global is undefined, and the library is reported missing.

### 10.12 The legacy v1 format

The engine still reads the format of the original Delphi-era screensaver's JavaScript port, and the
legacy library ships as one of the library's sources. Its keys are `PascalCase` and its structure is
flatter:

| v1 | becomes |
|---|---|
| `ParticleCount`, `WaveSpeed`, `Rotation[]`, `Angle[]` | the matching `generators` fields |
| `Waves[][]` | `generators.waves` — same `[wave][axis]` nesting, different field names |
| `ColorBase/Amp/Freq/Shift[]` | the four `generators` colour arrays |
| `MotionBlur` | `renderer.decayFactor` |
| `RenderMode` (an integer) | `renderer.mode` — `0: pixel`, `1: blend`, `2: star`, and more |
| `SinMagicParams`, `SinMagicParams2`, `ZoomCenterX/Y`, `TransMapStyle`, `TransMapFilter` | `postProcessors.transMap` |
| `TransMapMode` (an integer) | `transMap.beforeParticles` — **mode 0 ⇒ `true`**, mode 1 ⇒ `false` |
| `VisualFx { Glow, DepthSize, Streaks, Palette, … }` | split across `renderer` and `overlay` |
| `Fractal { Type, Params, Blend, Bounds }` | `generators.attractor` |
| `Width`, `Height` | `metadata.designResolution` |

Two traps in that table have cost real work:

- ⚠️ **The render-mode map is a deliberate subset and must not be "completed".** Its domain is the
  *legacy* integer, which is frozen forever, so every mode the engine has added since is unreachable
  through it by construction. An invented index for a post-legacy mode is a mapping no file can produce,
  so nothing would ever exercise it and nothing would ever contradict it. ⚠️ **A retired mode's row must
  stay, pointing somewhere else** — an import can still hand over the old integer long after the mode is
  gone, and deleting the row makes the lookup `undefined` and the mode fall through silently.
- ⚠️ **The pass-order field that actually carries the legacy behaviour is `TransMapMode`, not
  `TransMapBefore`.** The explicit field occurs **zero** times in the legacy library and was the only one
  read for a long while, which is why all 177 legacy presets migrated to "warp after the draw" —
  accidentally right for the 107 on mode 1 and wrong for the 70 on mode 0, of which **15 have the warp
  filter on and are therefore the only ones that look different.** The explicit field is kept as an
  override a hand-edited file can set, and it wins.

**The migration layer branches on `metadata.version`, and its v2 arm is IDEMPOTENT** — it clones and
fills only fields that are `undefined`, so re-loading an already-migrated preset is a no-op. That is not
a tidiness property but the thing that makes the deployment work: **one external file can carry the
engine-format library *and* still accept a hand-edited legacy file dropped in its place**, because the
same entry point is correct for both and running it twice costs nothing.

Finally, the direction that does **not** round-trip: **a TransMap chain survives migration but cannot be
expressed in the legacy JSON at all.** A multi-layer warp exported to v1 would degrade to its first
layer. That is why the engine's own format is the only one worth authoring by hand.

---

## 11. References

Every source the pipeline actually borrows from, grouped by the stage it serves. Two conventions are
worth stating, because a references chapter that does not state them invites the reader to over-trust it:

- **An entry says what the engine takes from the source, and where it DIVERGES.** Several of these are
  cited for a construction the engine then departs from — the curvature-flow smoothing it does not do,
  the pressure projection it compiles and never runs, the SPH framing it inverted. **A divergence is more
  useful than a citation**, so it is named rather than smoothed over.
- ⚠️ **Not every entry is a primary publication, and the ones that are not say so.** Three of the six
  integrated attractors (Halvorsen, Aizawa, Nosé–Hoover as used here) have **no canonical paper** behind
  the parameter sets this engine ships; they are cited to reference galleries and secondary write-ups,
  which is the honest provenance. Wikipedia links are for terms of art, not for authority.

> **Links checked 2026-10-11.** All 72 were resolved; **48 were opened and their content checked against
> the claim made here**, including all 43 Wikipedia titles (via the API, so a renamed article would show
> as missing) and all six section anchors. **Four corrections came out of the content check, not the
> liveness check** — a dead anchor (`Phosphor#Persistence`, which does not exist; Wikipedia's own
> redirect points at `Cathode ray tube#Phosphor persistence`), a title that is not what the entry called
> it (Karis), an attribution two sources dispute (Aizawa/Langford), and a platform rule this document had
> credited to a specification it is not stated in (the WebGL feedback loop). ⚠️ **24 could not be opened
> because the publisher blocks automated fetching** — ACM ×10, Springer, Wiley, MIT Press and the rest —
> and **a 403 is a fact about the fetcher, not about the link**; their DOIs all resolved to the right
> publisher, so they are recorded as presumed good and **not** as verified. **Re-date this line if the
> links are ever checked again; it is the first claim here to go stale.**

### Tone mapping and grading

- **Stephen Hill, *fitted ACES* (`SMAA`/`baking-lab`, `ACES.hlsl`)** — the sRGB→AP1 matrix, the
  RRT+ODT polynomial and the AP1→sRGB matrix used by the ACES curve in §8.2.
  ⚠️ **The published source is HLSL, whose `float3x3` fills by ROWS; GLSL's `mat3` fills by COLUMNS,
  so the constants are transposed on the way in.** <https://github.com/iryoku/smaa>
- **Krzysztof Narkowicz, *ACES Filmic Tone Mapping Curve*, 2015** — the single-rational approximation,
  cited because §8.2 requires its constants to be **absent**.
  <https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/>
- **Erik Reinhard et al., *Photographic Tone Reproduction for Digital Images*, 2002** — the `x/(1+x)`
  operator offered as the alternative curve. <https://dl.acm.org/doi/10.1145/566654.566575>
- **John Hable, *Filmic Tonemapping Operators*** — the comparison that motivates offering more than one
  curve. <http://filmicworlds.com/blog/filmic-tonemapping-operators/>
- ***Advances in Real-Time Rendering*, SIGGRAPH 2014** — background for the bloom bright-pass and
  blur-chain construction, including Jorge Jimenez's *Next Generation Post Processing in Call of Duty:
  Advanced Warfare*, the usual reference for the progressive down/upsample pyramid of
  [§8.1.1](#811-the-four-passes). <https://advances.realtimerendering.com/s2014/index.html>
- **Brian Karis, *Tone mapping*, 2013** — the inverse-luminance sample weighting the first bloom
  downsample approximates, so that a single very bright texel cannot flicker the whole pyramid.
  ⚠️ **The post is titled simply "Tone mapping" and never uses the phrase "Karis average"** — that is the
  community's name for the weighting it describes, which is worth knowing before searching for it.
  <https://graphicrants.blogspot.com/2013/12/tone-mapping.html>
- **Lift / gamma / gain** — the colour-grading control set [§8.3](#83-lift-gamma-gain-saturation-vignette)
  implements, named as the industry does. <https://en.wikipedia.org/wiki/Color_grading>

### Noise and flow

- **Robert Bridson, Jim Houriham and Marcus Nordenstam, *Curl-Noise for Procedural Fluid Flow*,
  SIGGRAPH 2007** — the divergence-free construction in §2.1.
  <https://dl.acm.org/doi/10.1145/1276377.1276435>
- **Ken Perlin, *Improving Noise*, SIGGRAPH 2002**, and **simplex noise** — the gradient-noise basis the
  curl is taken of, chosen over classic Perlin noise for lower directional bias in 3D.
  <https://dl.acm.org/doi/10.1145/566570.566636> · <https://en.wikipedia.org/wiki/Simplex_noise>
- **Matthias Teschner et al., *Optimized Spatial Hashing for Collision Detection of Deformable
  Objects*, VMV 2003** — the uniform-grid neighbour search used by cohesion in §2.2.
  <https://cg.informatik.uni-freiburg.de/publications/2003_VMV_collisionDetectionHashing.pdf>

### Agent and growth models

- **Jeff Jones, *Characteristics of Pattern Formation and Evolution in Approximations of Physarum
  Transport Networks*, Artificial Life 16(2), 2010** — the sense/rotate/deposit agent model in §2.5.
  <https://doi.org/10.1162/artl.2010.16.2.16202>
- **Diffusion-limited aggregation** — the growth analogy behind crystal accretion.
  <https://en.wikipedia.org/wiki/Diffusion-limited_aggregation>

### Curves, attractors and fractals

- **Lissajous curves** and **Lissajous knots** — the figure itself (§1.1).
  <https://en.wikipedia.org/wiki/Lissajous_curve> · <https://en.wikipedia.org/wiki/Lissajous_knot>
- **Vaughan Jones and Józef Przytycki, *Lissajous knots and billiard knots*, Banach Center Publications
  42 (1998) 145–163** — Theorem 1.3: over a convex family of waveforms that contains both the cosine
  and the sawtooth, the knot a Lissajous curve forms **does not depend on which member is used**. That is
  the guarantee behind the **Sharpness** basis ([§1.1](#the-wave-basis--sharpness)): it can change how a
  figure is drawn and provably not which knot it is. DOI `10.4064/-42-1-145-163`.
- **Additive synthesis** and **frequency-modulation synthesis** — the model the three-wave sum and the
  Wobble modulation are borrowed from. <https://en.wikipedia.org/wiki/Additive_synthesis> ·
  <https://en.wikipedia.org/wiki/Frequency_modulation_synthesis>
- **John Chowning, *The Synthesis of Complex Audio Spectra by Means of Frequency Modulation*, 1973** —
  the original FM-synthesis paper, which is the direct analogue of modulating a winding.
- **Edward Lorenz, *Deterministic Nonperiodic Flow*, 1963** — the Lorenz system (§1.4.1).
  <https://en.wikipedia.org/wiki/Lorenz_system>
- **Otto Rössler, 1976** — the Rössler attractor. <https://en.wikipedia.org/wiki/R%C3%B6ssler_attractor>
- **René Thomas** — the cyclically symmetric attractor.
  <https://en.wikipedia.org/wiki/Thomas%27_cyclically_symmetric_attractor>
- **Erik Halvorsen** — the cyclically symmetric system with three identical equations under coordinate
  rotation, shipped as one of the six integrated ODEs ([§1.4.1](#141-continuous-systems--integrated-odes)).
  <https://www.dynamicmath.xyz/strange-attractors/>
- **The Aizawa attractor** — the system whose orbit closes onto a **torus-like surface**, which is why it
  is the one ODE preset in the library that genuinely occludes itself. ⚠️ **The name is contested and both
  sources below say so: it is more properly the *Langford* system (W. F. Langford, 1984)**, and
  "Aizawa" is the name it circulates under in graphics. The engine ships the widely-copied parameter set
  `a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1`.
  <https://www.algosome.com/articles/aizawa-attractor-chaos.html>
- **Shuichi Nosé and William Hoover** — the Nosé–Hoover thermostat, whose chaotic regime is the sixth
  integrated system. <https://en.wikipedia.org/wiki/Nos%C3%A9%E2%80%93Hoover_thermostat>
- **Forward Euler integration** — the single-step scheme all six ODEs use, and the reason
  [§9.5](#95-numerical-robustness) says to **reseed rather than clamp**: it is only conditionally stable,
  so a diverged particle must be returned to the figure, not pinned to a boundary.
  <https://en.wikipedia.org/wiki/Euler_method>
- **Clifford Pickover** and **Peter de Jong** — the two discrete 2D maps (§1.4.2). **Strange attractors**
  generally: <https://en.wikipedia.org/wiki/Attractor#Strange_attractor>
- **Julia sets** and the **Mandelbrot set**, with **continuous (smooth) escape-time colouring** for the
  band-free shading in §1.4.3. <https://en.wikipedia.org/wiki/Julia_set> ·
  <https://en.wikipedia.org/wiki/Mandelbrot_set> ·
  <https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set#Continuous_(smooth)_coloring>
- **Iterated function systems** (IFS) and the **fractal flame** algorithm — the model behind Fractal
  Feedback ([§7.9](#79-fractal-feedback--an-iterated-function-system)).
  <https://en.wikipedia.org/wiki/Iterated_function_system> ·
  <https://en.wikipedia.org/wiki/Fractal_flame>
- **Michael Barnsley, *Fractals Everywhere*, 1988** — the **Barnsley fern**, the two-transform
  stem-plus-frond arrangement the `Fern` IFS preset is a miniature of, and the standard demonstration
  that unequal transform weights are what make an IFS look organic rather than symmetric.
  <https://en.wikipedia.org/wiki/Barnsley_fern>
- **Coprime frequency ratios** and the **greatest common divisor** — why a figure closes or does not, and
  the arithmetic behind the Composer's ratio base: the base is the **gcd** of the integer windings, so a
  coprime pair produces the longest non-repeating path.
  <https://en.wikipedia.org/wiki/Coprime_integers> ·
  <https://en.wikipedia.org/wiki/Greatest_common_divisor>
- **Electric Sheep** — the best-known fractal-flame screensaver, and a direct ancestor of this kind of
  program. <https://electricsheep.org/>

### Density fields, liquids and materials

- **Geoff Wyvill, Craig McPheeters and Brian Wyvill, *Data Structure for Soft Objects*, The Visual
  Computer 2(4), 1986** — the `(1 − r²)³` kernel the **liquid density field** and the **dye deposit**
  accumulate ([§2.3](#23-liquid-field), [§5.5](#55-liquid-the-iso-surface)). It is chosen over a Gaussian
  for two properties the engine depends on: **compact support**, so a sprite contributes nothing outside
  its radius, and **C¹ continuity at the boundary**, so a sprite adds no step discontinuity at its edge.
  <https://doi.org/10.1007/BF01900346>
- **James Blinn, *A Generalization of Algebraic Surface Drawing*, ACM ToG 1(3), 1982** — "blobby
  molecules": summing per-particle density into a scalar field and drawing one **iso-surface** of it,
  which is the model the `liquid` render mode implements. ⚠️ **Not the same 1982 Blinn paper as the one
  under *Shading* below** — that one is about participating media; this one is about implicit surfaces.
  <https://dl.acm.org/doi/10.1145/357306.357310>
- **Wikipedia, *Metaballs*** — the same construction under the name most readers will know it by.
  <https://en.wikipedia.org/wiki/Metaballs>
- **Wladimir van der Laan, Simon Green and Miguel Sainz, *Screen Space Fluid Rendering with Curvature
  Flow*, I3D 2009** — the screen-space pipeline the liquid surface follows: accumulate density, threshold
  it for coverage, take a **gradient of the field for the normal**, then shade. ⚠️ **The engine does the
  accumulate / threshold / gradient-normal part and NOT the curvature-flow smoothing** — the surface is
  smoothed by the kernel width instead. <https://dl.acm.org/doi/10.1145/1507149.1507164>
- **The Beer–Lambert law** — thickness to absorption, used both for the liquid's internal absorption and
  for the Volume mode's extinction (`c^n`, §5.4).
  <https://en.wikipedia.org/wiki/Beer%E2%80%93Lambert_law>
- **Christophe Schlick, *An Inexpensive BRDF Model for Physically-based Rendering*, Eurographics 1994** —
  the Fresnel approximation behind the **rim brightening** on liquid surfaces and crystal facets.
  <https://doi.org/10.1111/1467-8659.1330233>
- **James Blinn, *Models of Light Reflection for Computer Synthesized Pictures*, SIGGRAPH 1977** —
  Blinn–Phong specular, used at **exponent 42 for a crystal facet** (a quantised, faceted normal) and
  **16 for a liquid surface** (a smooth one), which is why the same control reads as a glint on one and a
  sheen on the other. <https://dl.acm.org/doi/10.1145/563858.563893>
- **Thomas Porter and Tom Duff, *Compositing Digital Images*, SIGGRAPH 1984** — premultiplied alpha. It
  is what lets the crystal pass **occlude** rather than add light, and the premultiply/blend-mode pairing
  is the one place a mismatch distorts falloff rather than simply dimming.
  <https://dl.acm.org/doi/10.1145/800031.808606>
- **Black-body radiation** — the physical basis of the heat → colour reading in the fire and ember
  ramps. ⚠️ **Cited as the analogy it is: the ramps are authored, not sampled from a Planck curve**, so a
  temperature here is a 0–1 index and not kelvin. <https://en.wikipedia.org/wiki/Black-body_radiation>

### Fluid simulation

- **Jos Stam, *Stable Fluids*, SIGGRAPH 1999** — semi-Lagrangian advection and the Jacobi pressure
  projection, which is the construction the fluid field's shaders are written against
  ([§2.6](#26-fluid-advection), [§7.5](#75-fluid-feedback)). ⚠️ **Read §7.5 before assuming the engine
  runs it: the advection, divergence, Jacobi and gradient-subtract programs are compiled and never
  drawn.** The shipped field is blur-and-decay, deliberately, because divergence-free shear read as
  electric jitter. <https://dl.acm.org/doi/10.1145/311535.311548>
- **Matthias Müller, David Charypar and Markus Gross, *Particle-Based Fluid Simulation for Interactive
  Applications*, SCA 2003** — SPH. ⚠️ **Cited as the road NOT taken, because that is a finding rather
  than an omission**: the plan's early framing was SPH-first, and it was inverted on the measurement that
  **additive splats cannot merge, so merging is a RENDERING problem** — which is why the engine has an
  iso-surface and a cohesion force rather than a pressure solver.
  <https://dl.acm.org/doi/10.5555/846276.846298>
- **Advection–diffusion** — the equation the dye field integrates ([§2.4](#24-dye-field)).
  <https://en.wikipedia.org/wiki/Convection%E2%80%93diffusion_equation>

### Shading

- **James Blinn, *Light Reflection Functions for Simulation of Clouds and Dusty Surfaces*, 1982** — the
  participating-media model behind the Volume mode's extinction in §5.4.
  <https://dl.acm.org/doi/10.1145/965145.801255>
- **Lambertian reflectance** — the diffuse term the liquid surface's gradient normal feeds, and the
  reason a normal derived from a density field is worth computing at all.
  <https://en.wikipedia.org/wiki/Lambertian_reflectance>
- **Rec. 709 luma coefficients** `(0.2126, 0.7152, 0.0722)` — used in three places that must agree: the
  bloom bright pass, the saturation mix, and Density Refraction's `luminance` height source.
  <https://en.wikipedia.org/wiki/Rec._709>
- **Chromatic aberration** — the optical effect [§7.10](#710-dispersion) imitates. ⚠️ **Deliberately NOT
  the physical one**: a lens aberration is radial and independent of the motion, while this spreads the
  R and B taps **along the warp offset**, so it appears only where the image is actually displaced.
  <https://en.wikipedia.org/wiki/Chromatic_aberration>
- **Vignetting** — the quadratic falloff in [§8.3](#83-lift-gamma-gain-saturation-vignette), which also
  hides the hard edge where a warp meets the frame border.
  <https://en.wikipedia.org/wiki/Vignetting>
- **Archimedean buoyancy** — the upward force a hot particle receives in
  [§2.7](#27-buoyancy-and-smoke-materials), driven by the material's temperature rather than by a density
  difference. <https://en.wikipedia.org/wiki/Buoyancy>

### Colour, projection and the trail

These three stages borrow least, and the entries say what little they borrow — ⚠️ **the gap is reported
rather than padded: stages 3, 4 and 6 are substantially the engine's own construction**, and inventing
citations for them would misrepresent where the work came from.

- **Palette cycling** — the ancestor of the per-particle colour oscillator in
  [§3.1](#31-the-colour-oscillator) and of `colorFreq` / `colorShift`: colour as a function of an index
  swept over time, which is how 8-bit-era hardware animated without redrawing.
  <https://en.wikipedia.org/wiki/Color_cycling>
- **HSL and HSV** — the space the authored palettes are reasoned in, though the shader samples them as a
  LUT in RGB. <https://en.wikipedia.org/wiki/HSL_and_HSV>
- **Pinhole / perspective projection** — the single-point division in
  [§4.2](#42-perspective-projection). There is no camera model beyond it: no lens, no frustum clipping,
  no near plane. <https://en.wikipedia.org/wiki/3D_projection#Perspective_projection>
- **Phosphor persistence** — the physical effect the trail imitates, and the better analogy than motion
  blur for what [§6.1](#61-the-feedback-equation) actually computes: a decaying accumulation of past
  frames, not a shutter integrating one.
  <https://en.wikipedia.org/wiki/Cathode_ray_tube#Phosphor_persistence>

### Numerical methods and control

- **Smoothstep** (cubic Hermite interpolation) — the `3t² − 2t³` ramp used for the liquid surface's
  coverage, the warp chain's edge fade and the band-split falloff. Its C¹ continuity at both ends is why
  a threshold built on it has no visible seam. <https://en.wikipedia.org/wiki/Smoothstep>
- **Box blur, and repeated box blurs as a Gaussian approximation** — three or four passes of a small box
  converge on a Gaussian, which is what the fluid field's four 3×3 passes
  ([§7.5](#75-fluid-feedback)) and the band-split base rely on. It is why "how many passes" and "how wide
  a kernel" are not independent controls. <https://en.wikipedia.org/wiki/Box_blur>
- **Exponential moving average** — the smoother used for frame-time measurement, the liquid density
  reference and the fluid deposit. Chosen over a window because it needs one value of state and cannot be
  made to disagree with itself. <https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average>
- **Hysteresis** — the two-threshold arrangement [§9.2](#92-the-performance-guard) is built on, and the
  concept the engine's own measured rule sharpens: **a band must be wider than the cost of the thing it
  switches**, and a band alone cannot damp an oscillation whose switch costs a *fraction* of the frame.
  <https://en.wikipedia.org/wiki/Hysteresis>
- **Least-recently-used eviction** — the slot-cache policy in
  [§9.4.4](#944-slots-eviction-and-the-blit). ⚠️ Cited with the engine's caveat: textbook LRU assumes the
  caller will ask again, and here an evicted tile has **no intersection change left to fire**.
  <https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_(LRU)>
- **Painter's algorithm** — back-to-front sorting, which is how crystals occlude correctly
  ([§5.2](#52-the-six-modes)): the pipeline has **no depth buffer**, so painting order is the only
  available visibility solution. <https://en.wikipedia.org/wiki/Painter%27s_algorithm>

### Platform: WebGL2 and the browser

The document makes load-bearing claims about what the platform does and does not guarantee; these are
where those claims come from.

- **WebGL 2.0 specification** — the API the whole renderer is written against. ⚠️ **The
  framebuffer-feedback rule that [§7.8.2](#782-time-warp-style-8) depends on — sampling a texture that is
  attached to the bound framebuffer — is NOT quoted from here**: it was looked for in this document and
  not found in either half of it. What §7.8.2 actually rests on is the engine's own measurement, that the
  case is **silent on ANGLE** rather than erroring. Cite the spec for the API, not for that rule.
  <https://registry.khronos.org/webgl/specs/latest/2.0/>
- **ANGLE** — the translation layer Chromium runs WebGL through on Windows, and the reason a malformed
  draw can be **dropped silently** rather than raising an error. <https://chromium.googlesource.com/angle/angle>
- **Half-precision floating point** (`RGBA16F`) — the format every HDR target uses. Its ~65 504 ceiling
  is what the trail's unbounded accumulation is measured against, and what the dispersion overflow of
  [§7.8.1](#781-band-split-style-9) actually exceeded.
  <https://en.wikipedia.org/wiki/Half-precision_floating-point_format>
- **`CLAMP_TO_EDGE` wrapping** — why anything that reaches the frame border persists there and
  accumulates, and therefore why the warp chain fades its edges at all (MDN, `texParameter`).
  <https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter>
- **`gl.readPixels`** — the readback the tile grid and the fluid field pay for, and the reason both are
  budgeted rather than run per frame. ⚠️ **MDN documents the API but says nothing about it being
  synchronous** — that it stalls is this engine's own measurement, not a quotable platform claim.
  <https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/readPixels>
- **`CanvasRenderingContext2D.putImageData`** — the tile blit-out, and here the platform claim *is*
  quotable: MDN states the method **"is not affected by the canvas transformation matrix"**, i.e. it maps
  one source pixel to one destination pixel. That is the documented behaviour behind the silent top-left
  crop in [§9.4.4](#944-slots-eviction-and-the-blit).
  <https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData>
- **`requestAnimationFrame`** — the frame clock. MDN is explicit that **"`requestAnimationFrame()` is
  one-shot"** and the callback must re-arm it, which is exactly why [§9.1](#91-frame-order)'s `finally`
  rule exists: a throw that skips the re-arm ends the loop for the session.
  <https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame>
- **Point sprites and `gl_PointCoord`** — how a particle becomes a textured quad without geometry, which
  is what makes 20 000 particles affordable and what fixes the sprite at a *fixed* pixel size in the
  non-splat modes (the asymmetry behind §9.4.3's brightness note).
  <https://registry.khronos.org/OpenGL-Refpages/gl4/html/gl_PointCoord.xhtml>
- **Ping-pong (double) buffering** — the two-target alternation the trail feedback and every image-domain
  pass depend on, since a pass may not read the target it writes.
  <https://en.wikipedia.org/wiki/Multiple_buffering>

### Context

- **XScreenSaver** — the reference point for screensaver behaviour and conventions.
  <https://en.wikipedia.org/wiki/XScreenSaver>
- **Daniel Shiffman, *The Nature of Code* — Oscillation** — the clearest introduction to the sine-driven
  motion this engine is built on. <https://natureofcode.com/oscillation/>

---

## 12. Credits and the Original PSSS

Everything this document describes is the third version of PSSS, and the first two were somebody else's
work. The pipeline is new; the idea, the mathematics it implements and most of the preset library are not.

### 12.1 The author

PSSS — *Particle Systems Screen Saver* — was created by **Andreas Kardin**, who publishes as
**mephzara**. The idea, the name, the mathematics of driving particles along amplitude- and
frequency-modulated sine waves ([§1.1](#11-the-additive-wave-model)), and the great majority of the
preset library all originate with him. Many presets in the library are his, carried across essentially
unchanged.

| | |
|---|---|
| **Author** | Andreas Kardin (*mephzara*) |
| **Source of the JavaScript version** | <https://github.com/mephzara/psss_js> |
| **Live demo of the JavaScript version** | <http://mephzara.com/misc/psss_js/> |

**Thank you, Andreas Kardin** — for the original program, and for publishing the source so that it could
be taken further.

### 12.2 The first version — a Delphi screensaver for Windows

The original PSSS was a **native Windows screensaver**, written in the late 1990s in **Delphi (Object
Pascal) with assembler** for the inner loops. It shipped as a `.scr` file and ran as a real screensaver:
Windows started it when the machine went idle, and it took over the screen.

It had to do all of it **on the processor**. This was the era before 3D acceleration was something a
program could assume, so the projection of [§4](#4-stage-4--3d-transform-and-projection), the particle
drawing of [§5](#5-stage-5--drawing-a-particle-the-six-render-modes) and the trail decay of
[§6](#6-stage-6--the-trail-motion-blur-as-feedback) were all hand-written software rendering — which is
why the assembler was there, and why the particle counts of the day were measured in thousands rather
than hundreds of thousands.

It was released as **shareware** and did very well: **50 000 downloads on its first night** on a 3dfx
shareware site, carried by Tucows, CNET and Download.com, and reviewed in magazines. It was also shown
at the **Zeiss planetarium in Jena** during the Liquid Sound Festival, with the animations synchronised
to compositions by Jan Zehn. Some users wrote their own music to go with it.

### 12.3 The second version — a JavaScript rewrite for the browser

Roughly two decades later the author **rewrote PSSS in JavaScript** so that it would run in a web browser
with nothing to install, and **published the source**. That version draws into an HTML `<canvas>` through
the 2D interface — still processor-based rendering, but inside a browser rather than a Windows
screensaver.

It is three files and no build step, and it is the version **this** engine was built from: the preset
library, the wave mathematics and the visual intent all came across from it. The source is kept beside
this engine as a read-only reference, so a question about what PSSS *originally* did is answered by that
copy rather than by anyone's memory of it.

### 12.4 What this version changed, and what it kept

The short version: the earlier releases *draw* the figure, and this one *photographs* it. Stages 1–4 are
substantially the original mathematics; stages 5–9 are new.

| | The Delphi screensaver | The JavaScript version | This engine |
|---|---|---|---|
| **Runs as** | a Windows screensaver (`.scr`) | a web page | a web page — and a Windows screensaver again |
| **Written in** | Delphi and assembler | JavaScript, three files, no build | TypeScript, built with Vite |
| **Drawing** | software rendering on the CPU | the CPU, into a 2D canvas | the GPU, via WebGL2 |
| **Particles** | thousands | thousands | up to 200 000, plus separate spark and crystal populations ([§1.5](#15-extra-populations)) |
| **Render modes** | one | one | six ([§5.2](#52-the-six-modes)), including an accumulating splat mode and a merged iso-surface |
| **Colour** | per-particle colour | per-particle colour | the full grading chain of [§8](#8-stage-8--grading-bloom-tone-map-film-look) — bloom, tone mapping, lift/gamma/gain, vignette — plus palettes and film looks |
| **Materials** | none | none | heat, buoyancy, smoke, sparks and growing crystals ([§2.7](#27-buoyancy-and-smoke-materials)) |
| **The warp** | a single translation map | a single translation map | a chain of twelve operators with dispersion ([§7](#7-stage-7--translation-map-warping-the-image)) |
| **Extra physics** | none | none | the six field systems of [§2](#2-stage-2--field-systems-that-move-particles) |
| **Editing** | edit the preset file | edit the preset file | the Synthesis Lab, including a figure composer and a genetic breeder |
| **Playback** | one preset at a time | one preset at a time | reels — named playlists with transitions ([§9.3](#93-reels)) |

**Two things were kept on purpose**, and both are documented as format rules rather than as courtesies:

- **The preset format.** This engine still reads the JavaScript version's `psss_presets.json`, so an
  original preset loads here and looks like itself. The migration path is
  [§10.12](#1012-the-legacy-v1-format).
- **The original look.** The **Legacy** film look is unchanged and is the `?? 'Legacy'` fallback for any
  preset with no overlay block, which is all 177 legacy entries — so a preset can always be put back into
  roughly the image the earlier versions produced ([§8.4](#84-film-looks)).

Note the first row of the table: this version runs in a browser *and* ships as a Windows screensaver, so
after twenty-five years PSSS is a screensaver again — which is what the name always said it was.

---

## Appendix A — Catalogues

### A.1 The thirty-five attractor presets

Referenced from §1.4. Grouped by the family whose mathematics they use.

| Family | Presets |
|---|---|
| **Clifford** (2D map) | Clifford Classic, Clifford Swirl, Clifford Fern |
| **De Jong** (2D map) | De Jong Butterfly, De Jong Vortex |
| **Lorenz** (ODE) | Lorenz Classic, Lorenz Tight |
| **Rössler** (ODE) | Rössler Spiral, Rössler Wide |
| **Thomas** (ODE) | Thomas Cyclone |
| **Halvorsen** (ODE) | Halvorsen Knot |
| **Aizawa** (ODE) | Aizawa Torus |
| **Nosé–Hoover** (ODE) | Nosé-Hoover Flow |
| **Julia** (escape time) | Julia Dendrite, Julia Spiral Galaxy, Julia Douady Rabbit, Julia Fractal Dust, Julia San Marco, Julia Basilica, Julia Siegel Disk, Julia Pinwheel, Julia Electric, Julia Swirl, Julia Firework, Julia Neuron |
| **Mandelbrot** (escape time) | Mandelbrot Full Set, Mandelbrot Seahorse Valley, Mandelbrot Elephant Valley, Mandelbrot Antenna Tip, Mandelbrot Double Spiral, Mandelbrot Mini-brot, Mandelbrot Needle, Mandelbrot Scepter Valley, Mandelbrot Starfish, Mandelbrot Spiral Galaxy |

The Julia and Mandelbrot entries differ only in their **window** of the complex plane (and, for Julia,
the fixed `c`) — the iteration is the same. The named windows exist because the interesting structure is
at the set boundary and has to be aimed at deliberately.

### A.2 The material parameter set, by pipeline stage

The Materials tab's fifty-three controls do not all act at one point in the frame. This is the map.

| Group | Controls | Acts in |
|---|---|---|
| **The three choices** | Material, Heat Mode, Blend Mode | Heat Mode → stage 3 (§3.3); Blend Mode → stage 5 (§5.8) and stage 6 (§6.3) |
| **Appearance** | Splat Radius, Core Brightness, Halo Strength, Falloff, Thermal Lag, Emission, Heat Gain, Velocity Stretch | Splat Radius → stage 5 size (§5.1); Thermal Lag and Heat Gain → stage 3 temperature (§3.3); the rest → stage 5 kernel shading. **Velocity Stretch** elongates the kernel along the direction of travel, so fast particles read as motion streaks |
| **Buoyancy** | Enable, Strength, Return Force, Turbulence, Max Offset, Smoke Threshold, Smoke Opacity, Dissipation | stage 2 (§2.7) |
| **Sparks** | Enable, Pool Size, Threshold, Ejection Speed, Gravity, Drag, Lifetime, Cooling, Spark Size, Budget/Frame | born in stage 1 (§1.5), integrated in stage 2, drawn in stage 5 |
| **Crystals** | Enable; Birth (Pool Size, Birth Rule, Slow Fraction, Nucleation/Frame); Lifecycle (Lifetime, Form Time, Melt Time, Melt Heat, Freeze Cap); Appearance (Shape, Crystal Size, Ice Opacity, Specular, Facet Sharp, Edge Bright, Refraction, Colour Ramp); Cluster Force (Cluster Force, Force Radius, Return Force); Growth (Enable Growth, Symmetry Fold) | born in stage 1, **Cluster Force** acts in stage 2, drawn in stage 5 |

Four properties of the material system that are easy to get wrong:

1. **`heatScale = 1 − coolFactor`** (§3.3) — any other admitted fraction makes the temperature
   frame-rate dependent.
2. **`decayFactor` changes meaning with `blendMode`** (§6.3), so decay values cannot be tabulated.
3. **A mode-requesting material means auditing every switch branch.** The revert is *not* the inverse of
   the switch: picking a material may change the render mode, and clearing it hands the mode back by a
   different path.
4. **Three distinct things are named "liquid"** — the material, the render mode and the field — and only
   the tooltips separate them. `Liquid` and `Liquid Light` hold identical values and differ *only* in how
   they are drawn.
5. **Crystals are additive and alpha-occluding.** They are the one element here that hides what is
   behind it, `material.emissionIntensity` cannot reach them, and `clusterForceRadius` is in **model**
   units while every other crystal length is in pixels.

### A.3 The six field systems at a glance

| System | Mathematics | Output |
|---|---|---|
| Curl noise | curl of 3D simplex noise, central differences | positional offset |
| Cohesion | local centre of mass over a spatial hash grid | positional offset |
| Liquid field | advected free-particle pool with a decaying velocity field | positional offset (and extra particles) |
| Dye field | advected scalar colour field with decay | **colour**, visible only through Liquid + `Tint Source = Dye` |
| Physarum | sense/rotate/deposit agents, with a blurred decaying trail field | composited trail image + agent positions |
| Fluid advection | velocity-field transport against a spring to the curve | positional offset |

### A.4 Preconditions — what each control needs in order to do anything

**This is the single most useful table in the document for diagnosing "that control does nothing".**
A large number of PSSS controls are inert until something else is true: a master switch, a render mode,
a non-zero neighbour, or simply motion. Each row names the control, what it requires, **what it looks
like when that requirement is unmet** — which is the part that makes a symptom identifiable — and the
fix.

> ⚠️ **An unmet precondition almost never looks like an error.** It looks like a working control with
> no effect, which sends you to the wrong subsystem. That is the whole reason this table is measured
> rather than reasoned: the third column is what was actually observed on screen.

**The self-similar curve type's own preconditions:**

| Control | Needs | When unmet it looks like | Fix |
|---|---|---|---|
| **Every curve row** | `Figure type` set to **Self-similar curve** | The rows are not merely inert — they are **absent**, because the two types have mutually exclusive bodies. If you are looking for them on a wave preset there is nothing to find. | Switch the type at the top of the Composer. Your wave settings are kept. |
| **Pitch**, **Roll** | a rule whose pattern contains pitch or roll turns | **Absent, not disabled.** Most rules are flat and turn in one plane, so two of the three angle rows simply do not appear. Only two of the fifteen rules use them, and on **Bush 3D** Yaw is absent too: its turns sit in a part of the pattern that draws nothing, so the row would move nothing. | Pick a rule that turns in three dimensions; the provenance line under **Rule** is the quickest way to tell. |
| **Descend** | a rule whose structure can be indexed backwards | **Absent on most rules.** Without that property a zoom would select scattered pieces of the curve rather than one region — a picture, but not a zoom — so the control is withheld instead of lying. | Pick a rule that supports it. |
| **Descend**, at depth | headroom below the cost ceiling | The figure stops revealing new detail and the spacing between particles begins to drift. The readout reports the clamp. | Lower **Recursion** to buy depth, or accept the ceiling: one level of genuinely new structure. |
| **Twist** | a rule with copies to twist (Dragon, Lévy C, Sierpinski-Knopp, Plant, Hilbert 2D, Peano) | **Absent** on every other rule. | Pick one of those rules. |
| **Twist**, on Hilbert 2D or Peano | Yaw at its landmark with no wobble | The Twist rows are **greyed out**, and a note under them says why: the lattice these two twist exists only at that angle. | Set Yaw back to its landmark, or leave Twist at 0 and use Yaw. |
| **Twist**, **Stretch** | Descend at 1× | They have **no effect** while the curve descends: the zoom needs the space-filling shape. | Set Descend to 1×. |
| **Stretch** | a branching rule (Plant) | **Absent** on every other rule. | Pick Plant. |
| **Smoothness** | a value above 0 | At exactly 0 the stroke is drawn precisely as the rule produces it, with no spline evaluated at all. That is the intended identity, not a failure. | Raise it. The visible range is the lower half; the top is measurably flat. |
| **The trail**, **ribbons**, **neon lines** | at least one modulated curve parameter, or a non-zero Rotation | A completely static curve gives the trail nothing to accumulate and the trajectory renderers nothing to join, so all three go quiet while appearing to be on. | Give one row a non-zero **Depth** and **Rate**. Every shipped curve preset does. |
| **Ribbon Mode: Streaks** | particles with real velocity | **The figure disappears** and is replaced by a sparse field of isolated dots. A ribbon mode draws instead of the points, and this one draws along each particle's motion — on a slowly-turning curve there is almost no motion to draw along. Measured mean brightness 0.19 of 255. | Use **Hybrid**, which does not read velocity, or raise **Rotation** until the figure is genuinely moving. |
| **Curl Noise**, on this figure type | nothing — it works, and that is the problem | **The figure drifts out of its own frame and scatters.** Curl pushes each particle along a flowing field and nothing pulls it back, so a shape whose whole identity is its exact geometry comes apart. Measured: the lit centre of the picture wanders halfway to the canvas edge and never settles, against a tenth of that with curl off on the same preset. | Use **Fluid Advection** instead — it has a return force, so the figure drifts and recovers. No Turbulence setting makes Curl Noise safe here. |

**The Fractal Fold's own preconditions:**

| Control | Needs | When unmet it looks like | Fix |
|---|---|---|---|
| **Fractal Cell**, **Fractal Scale**, the breathing rows | **Fractal Fold** at 1 or more | **Absent** — the rows are hidden while the fold is Off. | Raise Fractal Fold. |
| **Fractal Fold** | a **Fractal Scale** other than 0 | The figure is exactly unchanged, and a note under the scale row says so. | Move Fractal Scale away from the centre, either way. |
| **Cell Rate**, **Scale Rate** | its own Breath above Off | No motion: a rate with no depth moves nothing. | Raise Cell Breath or Scale Breath. |

> ⚠️ **A control this table says is inert may now be INVISIBLE instead, and the two symptoms need
> different handling.** Visual FX, Materials and the Composer hide what is switched off: a section whose
> `Enable` is clear shows only that switch, a closed group shows only its name, and a wave level
> switched off in the Composer shows one line in place of its twenty-one inputs. **So "I cannot find
> the control" and "the control does nothing" are now separate questions**, and only the second one is
> what the rows below describe. Nothing hidden is dropped from the preset: every gated row still
> exports, still snapshots, still takes a `Reset` and still interpolates in the Mixer.

> ⚠️ **EVERY `§` NUMBER IN THE *Fix* COLUMN BELOW IS AN OLD-MANUAL NUMBER AND RESOLVES IN
> `psss-engine-v2_how_it_works_old.md`, NOT IN THIS DOCUMENT.** The table was carried across
> whole, because its rows are observations and re-deriving 139 of them would be a worse document, but
> its references came with it. They are safe to ignore and safe to follow into the archived file; what
> they are **not** safe to do is resolve here. **Exactly three collide** with real sections of this
> document, and following one lands on a plausible but wrong subject:
>
> | A row says | It means, in the archived manual | It would wrongly resolve HERE to |
> |---|---|---|
> | `§6.2` | Visual FX | 6.2 Effective trail length |
> | `§9.1` | the materials chapter | 9.1 Frame order |
> | `§10.1` | the trail chapter | 10.1 Four artefacts, three formats |
>
> ⚠️ **That third row's target CHANGED when this document gained a formats chapter** — before that,
> `§10.1` landed in References. **A renumbering silently re-aims every inherited reference, which is
> why this declaration is here rather than a promise to keep 97 of them correct.** Everything from
> `§11` up fails safe: `§11` is now this document's References chapter, but its sections are
> unnumbered, so `§11.3` still resolves to nothing, and `§14`–`§30` have no counterpart at all.
> **The deployment rows are the one exception and were repointed, because `README.md` §6 now owns the
> deployment and the old Appendix F is a record rather than a reference.** Section numbers in the body
> of this document, by contrast, are always its own.

| Control | Requires | What it looks like when unmet | Fix |
|---|---|---|---|
| **Sharpness, on one wave slot** | that slot to carry a real share of the figure's amplitude | the cell is **disabled and dimmed** on a level with no wave at all, and says so on hover; on a level that is live but quiet it moves and the figure barely changes | **a slot's sharpness shows in proportion to that slot's share of the amplitude budget** ([§1.1](#the-wave-basis--sharpness)): mean shares Body 70.9 % / Structure 23.5 % / Detail 5.6 %, and **most of the library's presets have no live Detail term at all**, so on most of the library the third cell is structurally inert. Read the Composer's **Score** to see which slots carry this figure, and **do not reach for "sharpen Body"** — it is false wherever Structure outweighs Body |
| **Sharpness, on any preset with a long trail** | a low-accumulation preset | almost nothing at any setting on all three cells | the difference is 0.4 % of the waveform's energy and lives entirely in the corner, which accumulation averages away. Judge on `Cylinder`, `Quader` or `Pipes` |
| **Temper Rate** | **Temper** (the depth) to be non-zero | nothing — the modulator is skipped entirely at depth 0, so the rate has nothing to drive | set Temper first. The same holds for **Stretch Rate**, **Sway Rate** and **Flare Rate** against their own depths, per axis |
| **Any breathing rate's printed period** | — but it is **nominal** | the cycle takes a different time than the readout says | **Speed multiplies the actual rate and the preset's own sweep speed sets the scale**, so the printed seconds move when either does. Where the sweep speed is 0 the readout says the figure is paused, which is the honest answer rather than *off* |
| **Grow** | nothing — but **its identity is `0`, not `1`** | typing 1 scales the whole far end of the figure by 2× and looks like a bug in the control | it is a **ramp coefficient**, not a multiplier: `Off` means no change, `+1.00` doubles the amplitude by the end of the stroke, `−1.00` tapers it to a point. The readout never prints a bare multiplier at 0 |
| **Grow, past about 1.8** | the frame | the end of the stroke leaves the picture, and raising **Figure Scale** does not bring it back without shrinking the rest | the authoring band is **0.5 … 1.8**; the range reaches 3 because a constant is what a control may reach, not a recommendation. Lower `Grow`, or lower `Figure Scale` and accept a smaller figure |
| **A brightness fix for Grow's tapered tip** | — | the tip of a fully tapered stroke is a hot spot no brightness control removes | **it is geometry, not grading**: every particle near the end of the stroke converges on one point. Back the coefficient off the floor, or shorten the trail |
| **Offset, judged on a still frame** | **motion** | the figure is simply off centre, which looks like a mistake | **the engine rotates about the model origin, so every figure spins in place; an offset turns that spin into an orbit.** Give the preset a `Rotation` — one axis, not three, or the swept ring smears into a shell |
| **Offset Z / Travel Z, past the depth readout's 100 %** | the figure's deepest point to stay nearer than the cull depth | particles **vanish**, and it reads as a streak leaving the screen rather than as a clip | the note under the row prints how far the figure reaches toward the cull depth on **this window**. ⚠️ **The limit is set by the window size, not by the preset** — a value that is safe here can clip on a different window — and the note is recomputed on any control or preset change but **not on a bare resize** |
| **The Z depth note, missing** | `offsetZ` or `travelZ` to be non-zero | the row has no note under it | expected: there is no perspective switch to gate on, so the note is gated on the operator's own identity. Printed always, it would describe every preset in the library and be noise |
| **Travel's open end, coloured** | `Map: Particle index` | a visible hue jump where the arc stops, which reads as a seam | **the seam is correct** — the colour law wraps, and a closed loop hides the wrap because its ends meet. Set the palette's **Map** to *Particle index* and the wrap becomes a gradient from one free end to the other. The colour law itself is not changed for this |
| **Any TransMap layer** | **Enable ticked** | absolutely nothing happens, at any setting | tick Enable. **111 of the library's 325 presets load with it off, and adding a layer does not turn it on** |
| **Any TransMap *field* layer** (0–3, 5, 7, 10) | Chain Mix > 0 | nothing; at 0 the summed offset is zero, so no field displaces anything | raise Chain Mix |
| **Style 6's glow and border fade**, and a **density-sourced style 8** | **NOT Chain Mix** — only `Enable` | they keep running at Chain Mix 0: the glow's `strength` is measured pre-mix and Time Warp on `density` never reads the offset | untick `Enable`, the one true bypass. §11.3 |
| **Any image-domain warp** | a trail with some lifetime | the warp appears as a *static distortion* rather than motion | raise MotionBlur, or judge on a high-decay preset. See §10.1 |
| **Time Warp (8)** | a **non-zero** field, or `Source: density` | exactly nothing — the weight is 0, so the blend is byte-identical to absent | pick an explicit Pattern, switch Source to density, or raise Drift |
| **Time Warp (8)** | visible motion between frames | sub-pixel smear (0.18 px on `Quader`) | use a fast preset, or raise **Drift** to 0.25–0.5 |
| **Band Split (9)** | another layer present | nothing — it modifies, it does not displace | add a field layer |
| **Depth Parallax (11)** | another layer present **and non-zero** | nothing — it is a pure multiplier with no escape | add a field layer with real strength |
| **Depth Parallax (11)** | `Near ≠ Far` | a uniform strength change, not a parallax | separate the two values |
| **Depth Parallax (11)** | a figure with depth span | the figure warps uniformly while the *background* warps most | pick a preset by z-extent (`Black Hole` 0.66, `The Real Black Hole` 0.80), or leave Depth Range on `Figure (auto-fit)` |
| **Static Field on `(Preset)`** | the preset's own field to be **non-zero, measured** | nothing at any Strength — an exact identity | **"Non-flat" is the wrong test and it misses a whole class: a table can be full of numbers and still warp nothing**, if every live amplitude sits at **frequency 0** (`sin(0) · amp ≡ 0`). Two legacy presets resolve to 0 px — `Rose` (all zeros) and `Penta Star System` (`-0.10@0` on both axes) — and only one of them looks empty. **Do not read the table: read the `Measured:` line** — at the bottom of the **Transmap** tab, and at the bottom of each styles-0–3 layer body in **Visual FX** — which prints the peak in px and says outright when the field is an identity, in three separately-worded cases (added 2026-09-18 under the Static Field controls; moved to the Transmap tab on 2026-09-22; **restored in Visual FX on 2026-09-23, as ONE function called twice rather than two transcriptions — and it is the only way to measure a chain's second separable layer**). Then choose an explicit Pattern. §19.3 |
| **Static Field on an archetype** | the wanted displacement to be **within 128 % of `min(w, h)`** | Strength saturates at its maximum with the field still quieter than the preset you were copying | Strength 1.0 = **86.4 px at 1920×1080**, and **the ceiling is ±16 since the owner reversed 21.13 on 2026-09-25** = **1382 px** here, against 172.8 px at the 2.00 it shipped with on 2026-09-22. **This precondition is now LIBRARY-UNREACHABLE and that is what the widening bought**: on the composed basis (274 bodies → 159 identifiable → **139** with a measurable answer on all five canvas shapes) the worst body needs **12.20** at 16:9 and **14.89** on its worst canvas — `Inside Athlon` — so **139 of 139 fit**. At the old 2.00 there were **eight** that did not. It is kept because a hand-edited term table can hold any amplitude at all. **Figures — the earlier "76 of 116, 19.4×" was measured through a broken chain read and is void.** On the corrected basis (**154** separable-style layers in the library, **152** with a measurable field): the span runs **3.2 px** (`Quader`) to **2074 px** (`Stairway To Heaven`), i.e. **24×**, so a ceiling of any value leaves a tail. **21.13 was answered *both* and built both halves**: the track is derived to `STATIC_FIELD_STRENGTH_MAX` (never a hand-typed 2), **and** the **Transmap** tab's identification line now states the multiplier the pattern would need and says outright when it is beyond the maximum — *"matching it needs Strength 4.12, beyond the maximum of 2.00 … the terms below carry it."* On that tab's own basis, **29 of the 63 identifiable library tables need ≤ 1 and 34 need more, the worst 12.24×** (a 2026-09-22 basis — **do not reconcile it with the 139 above**, which is a different library read). Still no way to exceed the ceiling; stay on `(Preset)`, where Strength is a relative gain around 0.5. **Signing the track on 2026-09-22 did NOT widen it** — it doubled the travel, not the reach: the bound is on `\|Strength\|`, so an inverted match needs the same magnitude and saturates at the same size. **The 2026-09-25 reversal is the one change that DID widen the reach, 8×, and it cost no resolution below ±1.47 because the track became a quartic with a grid in the stored unit.** §19.2, §19.7 |
| **Shape** (both editors) | **`Shape mix` above 0** | absolutely nothing, at every shape — the field is still the plain sine one | **raise `Shape mix`. The two are independent identities on purpose**, so picking a shape does not imply a non-zero mix, and a notice line under the row says so while the mix is 0. This is the likeliest first-use confusion in the feature |
| **Shape** (both editors) | a **styles 0–3** layer | the rows are not shown at all — the shape belongs to the wave field, which only the four wave styles read | pick Wave Shift, Wave Zoom, Zoom Overlay or Zoom Combined |
| **Zoom Shape / Zoom Shape Mix** | **Zoom Combined** (style 3) | the rows are not shown — the zoom half exists only on that style | pick Zoom Combined. ⚠️ **They are read in BOTH regimes and are gated by style alone**, so they do *not* grey out on `(Preset)` the way `Zoom Pattern` and `Zoom Bias` do |
| **Angle X / Angle Y** (both editors) | nothing — read by all four wave styles and in **both** regimes | — | **no gate at all**, which is the point: the pair is one row with two cells and every separable style indexes its waves through it. ⚠️ **The range is ±90 and the readout is whole degrees**, because `(angle + 180°, −amplitude)` is the same field and a full circle would offer every orientation twice. ⚠️ **At 0 and 0 the field is bit-identical to the pre-angle engine**, by branch rather than by a rotation of zero |
| **Zoom Angle X / Y** | **Zoom Combined** (style 3) | the row is not shown — the zoom half exists only on that style | pick Zoom Combined. They are a **third and fourth** angle driving the zoom half's own two waves, not a second reading of the shift pair |
| **A degenerate orientation** | nothing — none of the three is blocked or clamped | at ±90° a wave repeats the other axis; parallel makes the field one-directional; **a parallel pair on Zoom Overlay (2) can cancel to nothing at all** | **expected, and a notice line under the row says which of the three you have.** Style 2's displacement is the two waves added, so where they are exact opposites the field is analytically zero and the gain solve honestly returns 0 — read the `Measured:` line. The orientation is a legitimate field, so refusing it would be hiding a control rather than naming a risk |
| **Shape, on the preset's own terms** | nothing — it applies in **both** regimes | the field changes character but the structure may not be what the shape suggests | **expected, and the opposite of `Detail`'s treatment above.** A shape is a transformation *of* the author's table; those frequencies were authored for sine, so a shape re-reads them rather than refining them, and a notice line says so. Pick a named `Pattern` if you want the shape to drive the structure |
| **The warp staying smooth under `Square` or `Sawtooth`** | — | the image **tears** along hard edges instead of bending | **that is the feature, not a fault**: those two shapes are discontinuous and nothing else in the engine makes hard rectilinear structure. A zoom style scales the cut by distance from the centre, so the tear grows toward the edges. Use `Triangle` or `Trapezoid` for a hard-edged field that still bends |
| **The warp keeping its size as `Shape mix` moves** | the pattern **not** to be `Macrolense` or `Distant Lense` | on those two the warp changes size as well as character | `Strength` re-solves itself against the shape on every other pattern; those two carry absolute amplitudes and skip the solve. Re-set `Strength` by eye, reading the measured line at the foot of the tab |
| **Zoom Overlay (2) "eye"** | table amplitude high enough to drive the zoom factor to 0 | a smooth shift with no visible eye | raise the amplitude — at 0.25 the factor bottoms at 0.750 and there is no eye |
| **Particle Size** on Volume | a multiplier below ~1.6× | the handle moves and nothing changes — pinned to the 64 px point-sprite ceiling | work in the lower half of the slider; the pixel readout stops moving when you have saturated |
| **Particle Size** on crystals | — | crystals never change size; excluded by decision | use Crystal Size |
| **Depth Brightness / Colour Shift / Lighting / Rim** | Pixel, Blend or Star | exactly nothing in Splat or Volume | switch mode, or use the material's own shading |
| **Glow** | Pixel, Blend, Star or Splat | nothing in Volume | switch mode |
| **Render Mode `splat`** | an **active material** | you get Star, at the Star size — the splat path is skipped entirely | select a material |
| **Spark Size** | Render Mode `splat` **and** sparks enabled | nothing — the spark override lives in the splat shader only; the other five paths ignore it | switch to Splat; the material must be live too (§9.1 note 3) |
| **The whole Liquid Surface section, missing** | Render Mode `liquid` | the eleven controls are not merely inert, they are **not shown** — the section is hidden in every other mode, so a mode that silently reverted reads as *"my liquid settings were lost"* when they are intact underneath | check Render Mode first. **Selecting a material used to force Splat and take the section with it (fixed 2026-09-01)** — if a preview tile shows the liquid surface and the main view does not, that is the fingerprint of a reverted mode, not of a dropped block |
| **Liquid Field `Pool Size` / `Seed Pattern` / `Field Decay`** | **`Enable` ticked** | nothing at all — no pool exists, so there is nothing to carry | tick Enable. It is **off by default in every preset**, and unlike Liquid Surface it is *not* gated on a render mode. **The rows stay ENABLED and readable with `Enable` off, by decision — this is deliberately NOT the greyed-out treatment used elsewhere**, because the values are what you set *before* ticking the gate. Do not "fix" it |
| **Liquid Field, all five controls** | **the figure to MOVE** | the pool sits exactly where it was seeded and never drifts — which reads as a dead feature | **the precondition is neither a mode nor a slider value: it is MOTION.** The field is the figure's own velocity, so a still figure stirs nothing. Give the preset `Rotation`, and **watch for a minute, not five seconds** — at 3 °/s the pool takes that long to organise |
| **Liquid Field `Field Coupling` at 0** | > 0 to move the pool | the pool is drawn but perfectly static | **this is not an off switch** — the particles still exist, still draw, and still count toward the population. Raise Coupling, or untick Enable if you wanted them gone |
| **Liquid Field, in a preview tile** | the main view | tiles never stir — the pool is not simulated there, by decision | expected; judge it in the main view (the tooltip says so too) |
| **Liquid Field, in `liquid` render mode** | the pool to reach the iso threshold | the pool **vanishes** — it is drawn into the density field, but at the default Pool Size 4 000 / Cloud only **0.13 %** of its footprint crosses the surface threshold, against 61 % of the figure's | **not gated and not a dropped draw — a calibration gap.** Iso Level is measured along the *figure's* curve (particles ~1.1 px apart); the pool is a cloud ~4.1 px apart, so it sits below its own kernel's overlap. Three escapes, all reachable today: **Seed Pattern `Blobs`** (73 % at size 20 000, by far the strongest), **Pool Size up** (18 % at the 20 000 cap), or **Iso Level down** (7.9 % at 0.5, 34 % at 0.25). `Fill` never reaches it at any size |
| **Dye Field, all seven controls** | **a chain THREE links long: Render Mode `liquid` → Tint Source `Dye` → `Enable`** | exactly nothing, and the field is *still running* — it injects and advects in every mode, so the simulation is live and simply has no way to reach the screen | **all three, in that order.** This is the longest precondition chain in the engine and no arrangement of the UI can express it, so it is printed inline above the controls. §16.12 |
| **Dye Field, `Tint Source = Dye` with `Enable` off** | — | the surface looks like Tint Source *Ramp* — **not black** | expected, and deliberate: a source that can be unavailable must degrade to something visible, in all three resolvers, or *"my surface went black"* becomes the report instead of *"the dye is off"* |
| **Dye Field** | **the figure to MOVE**, for about a minute | a coloured stain that sits still — the same failure as Liquid Field's, for the same reason | the carrying velocity *is* the figure's own. Give the preset `Rotation` and watch for a minute; at 3 °/s that is how long a wake takes to organise |
| **Dye Field `Advection` at 0** | > 0 to make the dye travel | the dye deposits and fades normally but never drifts | **not an off switch** — 0 is the authored "static stain" look. Untick Enable if you wanted it gone |
| **Dye Field `Advection`, with `Liquid Field` off** | ~~the Liquid Field pool to be enabled~~ — **nothing, since 2026-09-03** | before that fix: a static stain at every setting of the slider, with everything else about the dye working | **FIXED, and listed because the shape recurs.** The velocity field is a *shared* simulation that runs only while something asks for it; three features could ask and the dye was not one of them, so it advected along a field of zeros. The dye is now a fourth. **Ask what a feature's INPUTS depend on, not only what its outputs feed.** §16.12 |
| **Liquid Field `Field Coupling`, with `Dye Field` on and `Liquid Field` off** | **`Liquid Field → Enable`** — it belongs to the *pool*, not to the dye | exactly nothing, at every value | **correct behaviour, and the question that found the row above.** `Field Coupling` moves the pool's *particles*; with no pool there is nothing to move. **Advection** moves *colour* and needs only motion. The two sit near each other and both mention the flow, which is the whole reason for the confusion |
| **Dye Field, in a preview tile** | the main view | a tile renders Tint Source *Dye* as if it were *Ramp* | expected, by measurement not by omission: a per-tile field is **4.00 MiB per slot** — 5.3× the whole existing slot pair, 504 MiB at 126 slots — and the cost lands as tile evictions. §16.12 |
| **Dye `Dye Colour: Temperature`** | an active material | the deposit takes the figure's own colour instead | select a material. Not disabled, because a material can be picked after the source is |
| **Figure Colour**, while Tint Source is **`Dye`** | any other Tint Source | exactly nothing — the slider is inert at every value | **deliberate, and the only exemption in the list.** Dye is a *history*; blending this frame's per-particle average over it would discard the very thing it shows. Until 2026-09-03 it was not exempt, and Figure Colour's own 0.85 default overwrote 85 % of the dye — the field was correct end to end and still read as inert. §16.12 |
| **Dye `Dye Colour: Velocity`** | a figure whose own colour is *not* what you want to see | the deposit is **the figure's colour, dimmed** by speed — so enabling the field mostly just darkens the figure | this is why the default is *Depth*, not Velocity. Velocity is a real look, but it cannot show you what the field does on first contact, because its output is a copy of what is already on screen |
| **Dye `Dye Colour: Fixed`** | a *varying* source, if you expected the wake to show structure | one colour everywhere the dye reaches — the field's **density** varies but its hue cannot | **not a defect and not a neutral choice**: a single colour is the right answer when you want one deliberate hue and are relying on Dye Amount and Dye Decay for the structure. Pick *Depth* for two-colour mixing along the flow. It was briefly the default, which is how *"none of the sliders seems to have an effect"* arose. §16.12 |
| **Dye Amount / Dye Decay** | nothing further — but expect a **saturation** change, not a hue change | both move how strongly the dye colour replaces the ordinary surface colour, not what that colour is | the hue comes from what was deposited; these two set how much of it has built up. Until 2026-09-03 the build-up did not reach the screen at all and all three of these sliders were inert on a field that was working. §16.12 |
| **Dye, on a figure that fills the frame** | a figure with room to move *away* from where it has been | the wake has nowhere to show, so the dye is only ever seen as the body's own tint | the wake is drawn where the surface is **not**. A dense 20 000-particle figure at a low Iso Level covers most of the frame, so judge dye on a preset with visible background — the same *"judge on a low-accumulation preset"* rule the rest of this document uses |
| **Physarum `Trail Colour`** | **Show Trail** ticked (and Blend > 0, like the whole section) | exactly nothing — with the trail field not drawn there is nothing to colour, and the agents themselves are not tinted by it | tick Show Trail. `Preset (orange)` is the original hardcoded tint and is byte-identical to every preset written before 2026-09-05 |
| **Physarum `Trail Colour: Auto`** | a **Palette** from either source, or a material with a **Colour Ramp** | you get the plain orange, so the setting reads as if it had not applied | **correct, not inert: `Auto` is a fallback chain (Palette → material ramp → orange) and 3 of the 15 named looks carry `Palette: none`.** Pick a Palette in Visual FX → **Colour Palette**, or name a ramp here directly |
| **Physarum `Trail Colour: Auto`, after choosing a palette in §16.4a** | ~~the palette to be the film look's~~ — **nothing, since 2026-09-18** | before that fix: the figure changed colour and the trail kept the *previous* palette, at every setting of this dropdown | **FIXED, and listed because the shape recurs and this is its second instance.** The palette gained a second source in 21.4a and this resolver read one of them, so it was a **fourth reader** left behind — the preview grid was the third. **A file that calls the resolver somewhere is not a file with one resolution order**; the check that sees this class is a ban on reading a *source* at all, not a check that a resolver is called. Invariant 17 |
| **Physarum `Trail Colour: Auto`, under `Map: Particle index`** | — | it works — the trail takes the named palette's ramp, and the figure takes the same colours from the law | **that agreement is the point of 21.4d's identity**, not a coincidence: under `index` the figure reads the palette's `base`/`amp` pair while the trail reads its LUT, and `palettecheck` asserts the two produce the same 8-bit colour. With **no** palette named there is no ramp to take and the trail falls to the material ramp, then orange — the trail has no particle to evaluate the law on |
| **Physarum `Trail Colour`, on a faint network** | enough trail **density variation** to travel the ramp | the whole network reads as one colour from the ramp's middle rather than a gradient | **the ramp is indexed by density, and density is what Deposit Amount and Decay Rate control.** Raise **Deposit** or lower **Decay Rate** so the trunks and capillaries separate; a uniformly faint field has only one density to show |
| **Physarum's trail, lined up with the figure it came from** | ~~a preset whose **design box is in the canvas's own pixel scale**~~ — **nothing, since 2026-09-20** | before that fix: the network drew as a SMALL COPY of the figure in the middle of the frame, and the particles wandered much further than the sensor numbers said — both by the same factor, at every setting of every physarum control | **FIXED, and listed because it is the clearest instance of *check the UNITS of the RESULT, not the plausibility of the expression* — the fifth in that one file.** The steering block built its deposit position from MODEL units but divided by the CANVAS half-width, while the figure was scaled by the uniform fit: the trail came out a `1/fit` scale copy (a 100×100 box at 1024×768 gives **0.13**) and the wander was `fit ×` the documented figure. **A second error sat in the same two lines** — the half-span conversion was not self-inverse, so the step back was HALF the sensed distance; correcting it **doubles the step per unit of Blend**, which is why both shipped demos had a value adapted. The deposit now converts through the figure's own scale and a per-particle perspective factor, and back through the exact inverse, so **the simulation is resolution-independent** (measured `trail/fig` 1.00 / 1.00 / 1.01 / 1.01 at 1024×768 / 1280×800 / 1920×1080 / 3840×2160, against 1.00 / 0.97 / 0.72 / 0.36 before) and **Figure Scale no longer detunes it**. **Still not modelled: the 3D ROTATION** — the deposit runs before it, so a spinning figure's trail is drawn at the unrotated pose; that is a display-side remedy and is not taken. §6.2, §30.13 |
| **Cohesion, outside `liquid` mode** | Liquid mode to see *fusion* | it works — particles measurably bead (1 → 33 droplets) — but additive blending conserves total light **exactly** (measured ratio 1.0001) and the beads were already clipped to white, so the 8-bit frame just gets **narrower** (lit pixels −40 %), never denser | expected. **The visible lever is Cohesion Radius, not Cohesion**, which saturates by ~0.5 (5.62 px of pull at 0.5 vs 5.82 px at 1.0). Radius scales through: 1.4 / 5.8 / 12.0 / 28.1 px at 4 / 16 / 32 / 64, and bigger radii give **fewer, larger** drops (35 → 5 blobs) — which is the legible signal additively. Judge on a low-accumulation preset |
| **The `Liquid` material's colour** | **Tint Source = *Material Ramp*** (or a non-zero Figure Colour) | the surface's colour does not change when you select the material — it keeps whatever Tint Source was already set | **deliberate, not an oversight: the material requests the *mode*, it does not own the *colour*.** Tint Source has a single owner and a material switch does not write it. Set Tint Source = *Material Ramp* to see the material's ramp. §17.2a |
| **The `Liquid` material's shaping fields** (`splatRadius`, `coreBrightness`, `haloStrength`, `falloffExponent`, `velocityStretch`) | Render Mode `splat` | exactly nothing — the iso-surface has no sprites to shape | expected, and the same for any material in Liquid mode: only the material's *physics* half reaches a surface. §17.2a. Picking **`LiquidLight`** instead gets you splats, not a surface — three things are called Liquid, §17.2 |
| **Halo Strength**, on a washed-out **centre** | it can only reach *outside* the core | the slider moves and the bright middles do not change at all, at any value | **arithmetic, not degree: the halo term's weight is exactly ZERO at the sprite's centre**, so the core pixel is bit-identical across the whole range. The core is **Core Brightness** alone; if that does not help either, the pixel is past the tone map's ceiling, where **Emission Intensity** and the trail cap are the only levers left. §17.3 |
| **Core Brightness / Emission Intensity**, on an additive material that still looks white | the accumulated value to be **below the tone-map ceiling** | turning either one down changes the picture far less than the slider travel suggests | **past the ceiling the output no longer depends on the input**, so you are moving between two points on a flat curve — the failure is a loss of *variation*, not excess brightness. Since 2026-09-04 the engine caps the trail for you (index ≤ 25); if a preset is still flat, lower **Emission Intensity**, which lowers the accumulated value *and* raises the cap. §17.3 |
| **A trail that got SHORTER when you applied an additive material** | — | the figure's motion blur visibly reduces the moment Plasma / Fire / Ember / Liquid Light / Liquid is selected | **expected since 2026-09-04 and it is the fix, not a regression.** Most legacy presets carry a persistence that means an 81× gain under additive blending; the cap holds the accumulation index at 25. **Alpha materials are exempt.** Want the long trail back? Lower **Emission Intensity** — the ceiling rises with it. §17.3 |
| **The palette a material brought with it, after a Sliders drag** | you not to have touched **Mood**, **Glow** or **Depth** since selecting the material | the palette silently reverts to the base film look's own, so the material stops reading as itself | **not a defect in either control: the three grading sliders rebuild the whole grade from a *named* film look each time, deliberately, so that repeated drags cannot compound** (an earlier compounding version reached ×875 exposure in about forty events) — **and no named look carries a material palette.** Re-pick the material, or set Palette by hand in Visual FX. **Worst on Plasma**, whose fallback look supplies a palette of its own. §17.2 |
| **Trail Decay, on an additive material** | — | the handle moves freely near the top of the track but the trail stops getting longer | **the cap is holding it** — `1 − Emission Intensity / 25`. The handle keeps showing the preset's value on purpose. Lower **Emission Intensity** to raise the ceiling. §16.7, §17.3 |
| **A presentation set, on the preset it was designed from** | — | you pick the material on its own reference preset and nothing appears to happen | **correct — that is the test that it works.** Each set reproduces its reference preset's grading, departing only in the palette pair, so there it is a near no-op. A **visible** change means the set has drifted from its demo. §17.2 |
| **A presentation set, arriving from a different preset** | nothing — this was **fixed 2026-09-05** and is recorded because of how it looked | before the fix, extra depth shading, rim light or defocus the material does not author, varying with whichever preset you came *from* | **every set now names all 21 fields of the look it reproduces.** If you ever see grading that follows the *previous* preset rather than the material, that is this shape returning: an unnamed field is **inherited**, not defaulted. §17.2 |
| **The four sets not being on all nine materials** | — | picking `Smoke`, `Fog`, `Ice`, `Organic` or `Liquid` changes the material and leaves the grading alone | **deliberate, and the absence is the pre-2026-09-05 behaviour unchanged** — those five have no reference demo signed off yet. Only `Fire`, `Ember`, `Plasma` and `LiquidLight` carry a set. §17.2 |
| **`Liquid Light` looking like one fused blob with a halo** | — | fixed **2026-09-05**; before then its default sprite was 18 px at full halo — 5.8× Plasma's kernel energy, flat across its face | **the only presentation round that changed what a material *draws*.** Now 10 px at halo 0.4, matching its signed-off demo. It is still the softest of the four; the softness is a body now, not a disc. §17.2 |
| **Trail Decay, under TransMap's Fluid Feedback style** | — | it does nothing at all; the trail follows a different number | that style **replaces** it with its own **Persist** control. §14 |
| **`volumeRender.velocityStretch`** | — | it is **gone** —, having had no consumer and no primitive to act on | none needed. `material.velocityStretch` is a *different, live* field — §16.11 |
| **Any `volumeRender` / `sparks` / `buoyancy` field, through the Mixer** | an intermediate value between the two decks | the block **snaps whole** at the fader's midpoint, so you get one deck's value or the other's, never a default and never a blend | set it on the working preset after the crossfade, as before |
| **A category's own fader** | `follow master` **unticked** | the fader is **greyed and will not move**; while following, the row mirrors the master by construction | untick `follow master` — the row adopts the master's current position, so the picture does not jump |
| **A category's own fader, after a lock** | the category **not** frozen | greyed again, and the readout reads **`held`** instead of a percentage | click the category chip to unfreeze; the chip is the toggle and there is no separate unlock |
| **The `shape`, `color` or `motion` fader, for anything Visual FX writes** | the setting to actually be in that category — grading, the film look, the render mode, the symmetry fold and every field system are **`visual`** | the fader moves and almost nothing changes — **though less so since 2026-10-06**: those three owned **0** of the 46 `overlay` settings and now own 2, 5 and 1 (the grade, the palette and its mapping, `figureScale`, `particleSize`, `speedFactor`), so `color` now does move a grade and `visual` is still where the rest lives | use the **`visual`** fader. **Two cells of §21.1's ownership table pointed the wrong way until 2026-10-05, and so did the tab's own note** — this row is the symptom that reports it |
| **A Randomise press at `Subtle`, if you wanted a new palette or film look** | `Medium` or `Wild` | the numbers move and the look does not — **by design.** Subtle withholds the two categorical strategies, so it can never swap the grade, palette, material, particle mode, warp style or attractor | press `Medium`: about one press in four re-skins exactly one of those. ⚠️ **The one exception is a warp layer's field pattern, which Subtle may still re-pick** — stated in the tooltip because an unstated exception reads as a lie. §22 |
| **A Randomise `color` mutation, on a preset that authors a palette** | the palette cleared in Visual FX, to see the colour curves themselves | the four colour curves move and the frame does not — precedence is **palette > material ramp > preset colour** | expected, and the tab says so in a line under the lock chips rather than in a tooltip: a user who presses twice and sees nothing has no reason to hover anything. **Nearly half of the library's presets author a palette of their own.** §22.1 |
| **A Randomise style jump, on a preset with a live material** | no material, or the `material` lock open | the particle mode does not change, at any intensity | **accepted, not compensated.** A material overrides the mode at `resolveModeAgainstMaterial()` — the one owner of that decision — and `applyPresetChange` re-runs it on every apply, so the jump is a no-op on the **84** presets whose material pins the mode. The `visual` lock therefore cannot fully hold the mode while `material` is free. §22.1 |
| **Sliders `Warmth`** | **neither a palette nor a material ramp** — for the COLOUR-CURVE law | the row stays **enabled** and its line says *rotating the palette "X"* instead | **SINCE `26.4` THIS IS NOT A DISABLED-STATE ROW — it has TWO laws and does something under both**, so disabling it would be a lie and the line is informational. Census: **rotate 238 · curves 21 · neither 15.** It is genuinely dead only on those 15, where a material ramp overrides the palette AND the curves. **Before `26.4` the row wrote curves alone and was invisible on 253** — *ask what a feature READS, not what the call writes.* §20 |
| **Sliders `Turbulence`** | **curl noise ENABLED** (`overlay.curlNoise.enabled`) | disabled — *curl noise is off on this preset* | **Present is not enabled: the block is on 181 presets and switched on on 7.** The row was specified on the 181, which was a block census mistaken for a reach measurement; it ships as specified with its real reach stated. A slider may not flip an `enabled`. §20 |
| **Sliders `Heat`** | **a material on the preset** | disabled — *no material on this preset* | Live on 84. **`material.emissionIntensity` cannot reach a CRYSTAL**, so on the 8 crystal presets the row moves the material and not the crystals. It never changes which material is selected, nor its heat or blend MODE. §20 |
| **Sliders `Substance`** | **at least one of** liquid (in `liquid` render mode) / dye / enabled sparks | disabled — *no liquid, dye or sparks on this preset* | Live on 38, and **gated per block**, so a preset with one of the three gets a row that moves only that one. **The liquid half is gated on the RENDER MODE, because there is no `liquid.enabled` field at all.** §20 |
| **Sliders `Warp`** | **a warp on the preset** — an overlay chain, the legacy block, or `transMapEnabled` | disabled — *no warp on this preset* | Live on **214 of the library's 325**. **And it is one-directional on most presets:** its main channel spans `[0, 1]` with 1 as both default and maximum, and **93 % of authored layer weights sit at that ceiling** — measured over those 219, the row can move **182 of them only DOWN** and 37 either way. §20 |
| **Sliders `Strip to figure`** | — | the picture strips to the bare curve and **the preset does not change at all** — an Export or Snapshot taken now is byte-identical either way | **a BYPASS, not an edit (`26.8`/`26.D1`), applied engine-side so it holds with the Lab CLOSED.** It leaves **speed** alone deliberately, so `Speed` at its floor and the strip compose instead of fighting over one key. **A genuine preset switch CLEARS it** — a toggle still reading "on" after that would be the control lying about the picture. §20 |
| **Sliders `Bake`** | — | **centre no longer restores the original** — it restores the BAKED state | **deliberate, and the only non-idempotent control in the tab (`26.D7`).** Returning to centre reverts, so without Bake there is no way to compose two rounds of shaping without going out through Snapshot. The pre-bake preset is in History under `Sliders baked`. §20.1 |
| **Evolution `Breed`, on the tile you selected** | — | **the exact tile you picked is NOT in the new grid** — your picks come back in the first slots *re-mutated*, marked ◆ | **an owner decision, not a defect.** Byte-identical survival was the specifier's recommendation and was overruled, so that no slot is ever a repeat of what you just looked at. **`Back` is the remedy and was added for exactly this reason** — one step, no `Forward`. §23 |
| **An Evolution `Keep untouched` chip** | — | the category is held **to your FIRST pick's value** — the lowest selected slot, not the seed and not the tile you clicked first | **"The seed" does not exist once three parents are selected**, so the first *slot* is the only determinate answer. Here a lock does BOTH jobs — no mutation and no inheritance — which is the one place the three tabs' chips differ in meaning. §23 |
| **Evolution's seed-changed line** | — | nothing happens on its own — the grid keeps the old nine tiles until you press `Generate` | **deliberate: auto-regenerating would destroy nine tiles you may be mid-judgement on** because you loaded a preset in another tab. The notice reports the staleness the regeneration would "fix". §23 |
| **The Randomise `attractor` chip, before 2026-10-05** | — | ~~it gated nothing: the word `attractor` did not occur in `randomize.ts`~~ | **FIXED, and listed because the shape is the hardest one in this table to see.** A lock over an empty set looks, behaves and tests exactly like a lock that works — the preset changes on every press, the locked category holds, and every source-level check passes. **Only measuring reachability with the lock OFF distinguishes "held" from "never written"** (`mixercheck` §M). §22.1 |
| **Force gate `Age` / `Temperature`** | an active material | inert (the UI disables them) | select a material |
| **Palette `Map: Temperature`** | an active material | the whole figure is **one flat colour** (every particle reads LUT index 0) | select a material, or use a different mapping |
| **Palette `Map: Depth`** | a non-flat pose | the whole figure is one colour | tilt the figure with `Angle`, or wait for `Rotation` to tilt it |
| **Palette `Map: Particle index`, with no palette named** | — | **exactly nothing changes, and that is correct** — the colour is already the preset's own `colorBase`/`colorAmp` law, so the frame is bit-identical | **the one mapping that is not a texture lookup**: `paletteMappingToInt('index')` returns `PALETTE_MAPPING_OFF` and the colour is computed per particle on the CPU, which is why it is also the only mapping that reaches ribbons and neon lines. Name a palette to change the colours, or use the **Index Colour** panel's `Cycles`/`Drift` to change the law. The panel's **Source** row says which of the two you are looking at. §16.4a |
| **`Lightness` / `Size Spread` / `Opacity Spread`, on a ribbon or neon preset** | the three channels to reach every drawn thing | all three rows move and the frame does not change at all | **they reach the POINT and SPLAT passes only.** `ribbon-renderer.ts` and `neon-line-renderer.ts` contain no reference to `state.channels`, so a trajectory-drawn particle carries the neutral triple — the generator's half is correct (the published array spans 0.2–5.0 either way) and the renderer never reads it. ⚠️ **Measured 2026-10-31 on `Pipes Taper Comet` (`ribbonMode: 'hybrid'`): frozen at `Speed 0.01x` the ±1 extremes are identical to two decimals; with the ribbon row set to `Off` the same test gives 2.42 vs 7.30.** ⚠️ **And the live frame's churn EXCEEDS the signal — an unfrozen A/B moves by 8–13 of 255 and reads as the control working, which is how this went unnoticed since `31.2`. Freeze before judging any per-particle row.** |
| **Choosing a film look, expecting the `Palette` row to follow** | a look that **carries** a palette — 12 of the 15 do | on `Legacy`, `Legacy Graded` and `Cinematic` the two rows do not move | **correct since 2026-09-19, and the opposite was the defect.** Those three carry `Palette: none`, which means *this look makes no colour decision* — that is why they exist (grading judged without restyling colour), so they leave your palette, and the preset's own, exactly where it is. ⚠️ **`Customize` is the other case where the two rows do not move, and for a different reason: it adopts nothing at all.** It is an edit mode, not a colour decision — the values it opens are a copy of the look already live — so switching to it changes nothing that renders and leaves the preset's selection alone, whether the look it was seeded from carries a palette or abstains. Until the fix the three abstainers wrote `None` + `Depth` over it, which is how a legacy preset lost its migration-adopted `Cycle:` palette on a look change. §16.4a |
| **The whole `Index Colour` sub-panel, missing** | the **resolved** mapping to be `index` | the four rows are not inert, they are **not shown** | **check the resolved mapping, not the `Map` row** — the mapping has two sources and the row shows the RESOLVED one, so a film look selecting `index` opens this panel with no action of yours; before 21.4g the row read `From film look` in that state, which is the confusion the single control removed. §16.4a |
| **`Drift` at 0 on every channel** | a non-zero Drift on at least one channel | the **Cycle** row prints no period — it prints a sentence instead | ⚠️ **correct, and the reason the row exists in two halves**: with no drift each particle keeps one fixed colour forever, so there is no period to print, and `Infinity`/`0`/`—` would each read as a value. `Radar` is the library's example. A **flat** channel is a *different* inertness and is named by the Ramp strip, not here |
| **`Cycles` / `Drift`, under a named palette** | — | they still work, on the preset's own `colorFreq`/`colorShift` | **the palette and these two rows own different halves of one formula, which is why neither disables the other.** A named palette supplies `base`/`amp` — *which* colours; `Cycles`/`Drift` are the rates — *how they are distributed across the population and how they move*. So the panel is fully live under a palette, and the **Source** row is telling you only where `base`/`amp` came from |
| **Liquid `Iso Level` / `Kernel Width`, on a tightly-sampled figure** | a figure whose curve leaves **gaps at the sprite's own scale** | the figure is a single fused slab at *every* setting — sweeping Iso Level changes its size but never splits it into drops | **a property of the FIGURE, not a failure of the controls, and it is measurable before you touch a slider.** Mean distance between consecutive particles at 1024×768: `Waves` 0.13 px, `Cylinder` 0.50, `Pipes` 0.87, `Quader` **1.23**. Across an Iso Level sweep `Cylinder` is **one blob at every setting**; `Quader` runs **1 blob to 41**. Judge merging on a *sparse* figure, or lower Particle Number to open the gaps |
| **Liquid `Tint Source`, at the default `Figure Colour`** | `Figure Colour` below 0.85 — **except at `Dye`, which is exempt** | changing Tint Source barely changes the colour — it looks like the dropdown is not wired | **it is wired; it owns only 15 % of the result.** At the shipped `Figure Colour` 0.85 the figure's own particle colours own the other 85 %. Lower Figure Colour and the dropdown's four sources become obvious. ⚠️ **`Dye` never needed this and the row is no longer even shown there** (2026-10-16) — that source forces the mix to 0. §16.11a |
| **Liquid `Figure Colour` / `Mix Model`, at Tint Source `Dye`** | any source but `Dye` | ⚠️ **both rows are ABSENT** (2026-10-16; before that they were visible and inert) | **unreadable by algebra, not by taste**: the shader resolves `mixAmt = (tintSource == dye) ? 0.0 : colourMix`, so `mix(tint, mixed, 0.0)` is an identity that discards `colourMix` AND `mixed` — and `mixed` is the only thing `Mix Model` feeds. Hidden, not greyed, because a greyed row implies it still applies |
| **Liquid `Figure Colour`, at Tint Source `Preset`** | Tint Source `Ramp`, `Material Ramp` or `Palette` | the slider reads near-inert across its whole travel | **deliberate and unavoidable at that source: the two operands are the same colour family** — a global mean of the preset's wave colours against a local weighted mean of the same colours. It is the algebraic identity at 0 either way. **Do not "fix" the direction**; switch source to see it travel |
| **Liquid `Surface Ramp`** | Tint Source = **`Ramp` or `Dye`** | the row is **not shown** under `Preset`, `Palette` or `Material Ramp` | hidden rather than greyed, because those three do not read it. `Material Ramp` *falls back* to it with no material live, but that is a degradation, not a second authoring path, so the row stays hidden there. ⚠️ **`Dye` WAS WRONGLY IN THAT LIST UNTIL 2026-10-16** — it samples the ramp as its **per-pixel fallback** wherever the dye field is thin or unvisited, so the one source whose body colour the ramp governs was the one source that could not reach the control, and the workaround was to flip to `Ramp`, pick, and flip back |
| **Liquid `Surface Ramp` under `Dye`, at a high `Dye Amount`** | a low-to-mid `Dye Amount` | picking a ramp changes almost nothing | **expected: `Dye Amount` is a crossfade, not a mixture.** The body is `mix(SurfaceRamp[thickness], dyeColour, dyeA)` and `dyeA` saturates toward 1 as the deposit accumulates, so at 1.0 the ramp survives only at the moving leading edge. Lower `Dye Amount` to ~0.1–0.2 to see the two colours as two colours |
| **Dye `Dye Colour: Palette`** | a palette resolved and live | it looks identical to `Depth` | **that IS the degrade and it is deliberate** — with no palette (`'none'`, unset, or a name the resolver does not know) it falls back to `Depth`'s own ramp, never to black, because the field is the surface's albedo and black dye is a black body. Pick a palette under **Colour Palette** |
| **A Visual FX block edit, after a Sliders drag** | you not to drag a slider afterwards — **or to `Bake` first** | the preset's own value comes back, most visibly as a colour reverting | every slider re-applies the preset, which restores the authored overlay block. ⚠️ **FIXED for `Dye Field` on 2026-10-16; STILL OPEN for `Liquid Surface`, `Cohesion`, `Liquid Field`, `Curl Noise`, `Sparks` and `Materials`** — `Tint Source` is the one most likely to catch you, since it lives in `overlay.liquid`. Set it again, or `Bake` to make the current state the starting point |
| **Liquid `Mix Model: Pigment`**, expecting blue + yellow = green | — | it deepens the colour but never **shifts the hue** | **a structural limit, not a tuning choice, and no future setting on this control can add it.** True subtractive mixing needs a second per-pixel statistic and there is exactly one colour target, whose fourth channel already carries the total influence. Pigment is Beer-Lambert darkening: a thin film is left *exactly* unchanged |
| **Liquid `Refraction`**, expecting the background to bend | — | a chromatic fringe on the surface's own slopes, and an inner glow — but nothing behind the body distorts | **by measurement: there is nothing behind the figure to bend.** The trail has decayed to **0.0003** by the time the surface pass runs, and a background-sampling offset lands on the surface's own position a frame earlier on four of five representative presets (0.000 px on `Liquid Surface` itself). An image-domain effect can only be as strong as the difference between consecutive frames |
| **Crystal `Growth`** | crystals that have finished forming | nothing grows — deposits land on *solid* crystals | wait for nucleation, or raise the pool |
| **Crystal `Lattice Snap`** | Growth enabled | inert — it acts only on accreted deposits | enable Growth |
| **Crystal `birthRule: cold`** | an active material | quietly behaves as `slow` instead | select a material |
| **Material `emissionIntensity`** | a non-crystal particle | does not reach crystals at all (the branch returns early) | crystals are *lit*, not emissive — use their own controls |
| **Sliders → `Depth`** | the preset to have rotation of its own | nothing | give it rotation first |
| **Sliders → `Symmetry`** | slider above centre | nothing in the lower half — by design | move it up |
| **`Warp First`** | a long trail | identical to normal ordering | raise MotionBlur |
| **Ribbon `Mirror`** | symmetry fold > 1 | meaningless; the row is hidden | raise Symmetry |
| **Every control on the Composer tab** | `Attractor → Blend` below 1.0 | absolutely nothing changes the picture — while **no individual control is wrong**, which is what makes it hard to localise | **at blend 1.0 the attractor REPLACES the wave positions outright**, so the tab is authoring a figure nothing draws. The tab prints this inline above its first control. Lower Blend in Visual FX. **No library preset reaches this state**, so neither a preset sweep nor a browser pass could have found it. §18.8 |
| **Composer `Shift °` dial** | `Winding ≠ 0` on that axis | disabled, and it says why | give the axis a winding. **Arithmetic, not caution:** the dial divides your target by the winding, so at 0 it would write `Infinity` into the wave table. **582 of the library's 2175 live-slot axes sit at winding 0** — more than a quarter of them, counted over the composed library's wave slots, a slot being live when `am.base + am.amplitude` is non-zero on any of its axes — so this is a common state. It is deliberately **not** disabled at a *size* of zero — *"cannot be applied"* and *"cannot be seen"* are two claims and only the first may disable anything. §18.3 |
| **Composer `Winding` / `Shift °` / the dial, on one axis** | that axis to have **Size or Pulse** | the control moves exactly the value it names and the picture does not change | **a winding reaches the screen only through its own axis's amplitude** — on a wave with reach `15, 25, 0` the whole Z column is inert while the wave itself is perfectly alive. The row readout says `Z no size — winding inert there`. Give the axis a Size; **the tab will not do it for you**, because one control that lit Z would turn every planar preset in the library 3D. §18.3 |
| **All 21 controls of one Composer wave** | that wave to be **switched on** | the numbers are all there and editable, and every diagram, the live preview, Export, Snapshot and the Mixer show the figure **without** it | tick the box on the wave's title row. **The wave is written out CLEARED the whole time it is off** — the numbers live in tab state, so they come back on switching on, **but only until the figure is replaced.** The tab warns inline while any wave is off. §18.6 |
| **A Composer `(% · s)` depth field** | a non-zero base to take a percentage of | it shows an **absolute** amount instead of a percentage, and the unit chip beside it reads `abs` | expected, and measured: **386 axes in the library pulse over a size of zero.** The percent view does **not** round-trip at any precision — never re-derive a stored value from a displayed one. §18.2 |
| **Composer `Mirror`** | symmetry fold > 1 | the row is **not shown** at all | **raise the fold in Visual FX — this tab cannot.** `Symmetry` was removed from the Composer on 2026-09-10, so the row's *presence* is derived from a value this tab has no way to change, and it stays hidden until something resyncs the tab. §16.1, §18.3 |
| **Any Visual FX or Materials edit, with the matching `Apply …` box unticked** | the box **ticked** | the edit appears to take and is then **lost** the moment you tick the box back on | tick the box first, then edit. **Switching back on re-applies the preset's authored overlay**, which is the same mechanism that makes the bypass work at all. The tab warns inline while a box is off. §18.3 |
| **The two Composer `Apply …` boxes, after loading a preset** | — | both come back **ticked** with no interaction, which is indistinguishable from having mis-clicked | **expected since 2026-09-10 and it is the fix, not a regression** — a surviving bypass rewrote the *incoming* preset's mode and withheld its material. **A *different* preset resets them; a Sliders drag, Randomise or a Mixer move does not**, because those re-apply the same preset under the same name. §18.9 |
| **The Composer's `reach ±N` readout** | — | it is the only thing on the tab that responds to doubling every `Size` | **correct and load-bearing: the three diagrams AUTO-FIT their box**, which is right (an authored size of 800 and one of 8 must both be visible) and means the picture cannot show scale at all. **Do not read a still diagram as an inert control.** §18.3 |
| **Every control on the Transmap tab, with the whole body gone** | the preset's warp chain to contain a **separable** layer — `Wave Shift`, `Wave Zoom`, `Zoom Overlay` or `Zoom Combined` (styles 0–3) | the tab shows one sentence and **nothing else** — no picture, no terms, no readout | **hidden rather than greyed, because there is no separable field to author**: the other eight warp styles build their displacement in the shader and have no wave terms at all. **28 library presets are in this state.** Add one of the four styles in Visual FX → Translation Map. §19.8 |
| **Every control on the Transmap tab** | **`Enable`** ticked in Visual FX → Translation Map | every control works, every number is saved by Export and Snapshot, and **nothing reaches the picture** | **the most common state you will meet — 92 library presets have a separable layer with TransMap switched off** — and the notice at the top of the tab is the only thing that says so. **The rows stay LIVE and readable, deliberately** (the same decision as Liquid Field's, §16.11c): the values are what you set *before* ticking the gate. §19.8 |
| **`Detail`, missing (both tabs)** | `Pattern` to be one of the named archetypes | the row is **not shown** in the `(Preset)` regime — which is where the large majority of the library's separable layers sit | **hidden rather than inert, and wiring it would be worse than hiding it.** `detail` multiplies an archetype's *frequencies*, which is meaningful because an archetype is a shape defined up to scale; a preset's authored frequencies encode specific integer ratios (lattices that close only there), so scaling them would **replace** the figure rather than refine it. The engine deliberately does not apply it in that regime. **Both editors gate it on `findArchetype`, never on the `(Preset)` literal** — `(Custom)` and any unknown name from a hand-edited import take the same engine branch, so a name comparison would leave the slider visible and inert on them. **Visual FX's copy showed it anyway on any REBUILT row until 2026-09-23** — first render, collapsing and re-expanding the row, any chain edit — because the gate lived only in the row's *update* path while the *build* path appended the body and returned. **A gate that exists is not a gate that runs**: one owner now runs from both paths and `fieldcheck` §G asserts both reach it. The tab was never affected, its controls being built once and synced on every activation. **What `Detail` does when it IS shown is change fineness, not amount** — the gain solve holds the peak (§11.7.3), which is the other half of the report. §19.1, §11.6 |
| **The Transmap tab's `Layer` picker, missing** | the chain to hold **more than one** separable layer | the tab describes a layer it never names, which is fine until a chain has two | **hidden rather than shown-with-one-entry, deliberately**: a picker offering a single choice is a control that cannot be wrong and cannot be right either. With one separable layer the tab edits it; with two or more the picker appears above everything and **every control on the tab except the two wave tables follows it**. **It is positional and it DROPS rather than moves** — the pick is an index plus the style that was at it (a chain layer has no identity), so a reorder that breaks the pair sends the tab back to the first separable layer, and opening the tab clears the pick outright. §19.0 |
| **The Transmap tab, on a layer that is switched OFF in Visual FX** | — | every control still works, every number is still saved, a notice says the layer contributes nothing, and **there is no box here to turn it back on** | **the tab's own `Active` box (owner: *"the transmap config should always be active"*) and the notice deliberately stayed** — *keep the notice, drop the control* was the owner's answer, so the switch is the layer row's in Visual FX and this tab writes `layer.enabled` nowhere. **ONE notice covers TWO causes** — the layer switched off *or* its weight at 0 — because the `Measured:` line is honest either way: it measures the field, which still has a size, so without that sentence the tab would state a peak in pixels for a layer the frame never sees. **The weight was always Visual FX's.Muting the only separable layer forces the preset to export its chain as an overlay array** (`isLegacyExpressible` requires `enabled`), which is a format consequence, not a defect. §19.0 |
| **`Zoom Pattern` and `Zoom Bias`, greyed (both tabs)** | `Pattern` to be an archetype | both are **disabled**, with their stored values still visible, and a sentence beside them saying why | **a real engine asymmetry that the owner's decision KEEPS (21.12 §J): in the table regime the engine takes the zoom half straight from the second table and holds its bias at 1.** They are greyed rather than hidden precisely so the gap is declarable — a hidden control says nothing, and these two have stored values the engine ignores. **`Zoom Strength` is the exemption and stays live in both regimes.Visual FX's restored copy shipped them LIVE for half a day and nothing reported it** — the sections asserting this gate were pointed at one file. Each tab now drives both `disabled` flags and its own sentence from ONE test, and `fieldcheck` asserts it in both. Pick a `Pattern` to make all three read. §19.6, §11.6 |
| **Transmap's term rows — RETIRED 2026-09-23, there is no longer any precondition on editing them** | — | every row is editable in both regimes, on every style | **THIS ROW USED TO BE "the ONLY remaining disabled case" AND ITS RETIREMENT IS THE RECORD.** Until that day a style-3 layer on a named `Pattern` with a non-zero `Zoom Bias` greyed its whole table, because the table regime holds the bias at 1 and no set of terms could reproduce what was on screen; `staticBakeBlocker()` is now **deleted** and `carryZoomBias()` absorbs the bias into the baked table instead. **The sentence above the rows survived the greying and changed job**: it no longer says why they are locked but what typing will cost, and on the five archetypes whose zoom slots are all full it warns that the steady push cannot be carried — **before** you type, never after. The only rows still disabled anywhere are the ones the **style does not read** (the `Zoom terms` block in styles 0–2, next row). §19.5a |
| **Transmap's `Zoom terms` block, disabled** | Style **`Zoom Combined`** (3) | the eight rows are visible and greyed in styles 0–2 | expected — only style 3 reads the second table. The whole **`Zoom half`** section is *hidden* in styles 0–2, and **`Zoom centre`** is hidden in style 0 (`Wave Shift` has no zoom to centre) |
| **Transmap `↺ Reset field`, disabled** | the field to **differ** from what it was when you opened the tab | the button is greyed on open and lights the moment anything in the field changes | **it is armed by COMPARING the whole field against the entry state, never by a dirty flag**, so undoing an edit by hand greys it again — which makes a lit button the tab's cheapest answer to *"have I changed anything?"*. An absent `staticField` block compares **equal** to an all-default one, or every preset without one would open lit. §19.5a |
| **Transmap `↻ Reapply field`, disabled** | **`↺ Reset field`** to have been pressed | greyed until a `Reset`, then live until used once | **it is armed by the EXISTENCE of the state `Reset` displaced, and only `Reset` creates one.** It restores the state that was live at the instant `Reset` was pressed — **not** anything changed afterwards — and disarms itself on use. One per `Reset`, by design. §19.5a |
| **Transmap `Strength` at 0.5, in the `(Preset)` regime** | — | it looks like a half-strength setting and it is **byte-identical to no gain at all** | **two regimes, two meanings for one slider.** On an archetype `Strength` is absolute (1.0 ≈ 86 px at 1920×1080); on `(Preset)` it is a **relative gain around 0.5**, so the shipped 0.5 is the preset's own authored size. That is why **the large majority of the library's separable layers** sit there and why moving it feels different on the two branches. §19.1, §19.7 |
| **A Transmap term edit, on a preset with more than one separable layer** | — | it changes **every** separable layer, not the one the tab is describing | **the two wave tables are the PRESET's and are shared by the whole chain — that is the one thing on this tab which is not per-layer**, and the notice above the picker says so. Everything else follows the **`Layer`** picker. **"No library preset is in this state (the count is zero), which is also why there is no layer selector" was the 21.12 reading and it is REVERSED**: the figure stands, the conclusion did not survive it. Zero meant no *library* preset needs a picker, and a user assembling a chain in Visual FX is outside that basis entirely — which is exactly what the owner asked for on 2026-09-23. §19.8 |
| **Transmap edits, in `History`** | — | nothing is added, and the other tabs keep their old baseline | **deliberate, exactly as the Composer's edits are** (§18): the alternative is re-initialising the generator on every keystroke. `Reset` restores the preset the tab was entered with; `Snapshot` is how an edit reaches History. §19.8 |
| **Reel: the strip's numbers, `To Front` and the ◀ ▶ arrows** | `Play mode: Sequential` | in `Random` the numbers are **not shown at all**, and reordering has no effect on what plays | **expected, and the numbers are hidden rather than greyed for a reason: a number claiming to be the play order would be false.** The stored order is still there and still shown, and switching back to Sequential brings it and the numbers back. §15.3 |
| **Reel: `Play mode`, `Play time`, `Transition`, the order — changed while a reel is playing** | pressing **`Play`** again | the reel goes on playing exactly as it was, so the control reads as ignored | **the runner holds a COPY taken at `Play`.** Preset *content* is re-read at every switch, so a saved preset edit does show up next time round — the tooltip's *"editing while it plays is safe"* is true of that and not of the reel's own settings. Note `Play` becomes `Stop` while playing, so re-arming is two clicks. §15.6 |
| **Reel: the `Main reel` checkbox, un-ticking it** | — | the box springs straight back on | **there is no "no main reel" state — the mark is one setting for the whole library, not a box per reel**, and the box re-reads itself from the library after every click. Tick a *different* reel instead. §15.1 |
| **Reel: `Main reel`, on a reel that has never been saved** | the reel to exist in the library | the box does nothing at all | save the reel first. The mark refers to a name, and an unsaved reel has none the library knows |
| **Reel: `Save`, on a reel with entries the library does not have** | — | they are **kept**, not pruned, and stay greyed in the strip | **deliberate: names resolve at PLAY time.** Importing a reel before its presets is the ordinary case for a shared pair of files, and pruning at Save would make it destructive. The status line counts them: *"3 not in this library and will be skipped"*. §15.3 |
| **Reel: `Delete`, on a built-in reel** | — | the button is disabled — a built-in cannot be deleted | expected. On a reel of your own that **shadows** a built-in, Delete removes only your layer and the shipped version comes back; the confirmation says so before the fact. §15.7 |
| **Reel: anything you save, in a private-browsing window or a sandboxed frame** | browser storage the page is allowed to write | reels save, work for the session, and are **gone on reload** | **the status line says so up front** — *"this browser will not remember reels — use Export Reels"* — rather than after the loss. A write that fails is still applied in memory and reported separately; **your edit is never discarded because the writing failed.** §15.7 |
| **Reel: `Cross-fade`, on some machines or after a window resize** | a float render target and two small shaders | the switch is an instant hard cut instead of a dissolve, with a console warning and nothing on screen to say why | ⚠️ **degradation, not a defect — and the resize case is deliberate**: a stretched photograph of a differently-shaped canvas reads as a rendering fault, so the still is dropped instead. `Fade to black` uses no GL at all and always works. §15.5 |
| **Reel: `Play`, when every name in the reel is missing** | at least one preset that exists | it refuses and says so, rather than going full screen onto nothing | import the presets, or pick different ones |
| **Reel: the arrow keys and the film-look number keys, while a reel plays** | — | they work — and the reel overwrites your choice at its next switch, without resetting its clock | **not gated, deliberately.** Nothing about a reel makes the rest of the engine read-only. **Leaving full screen is what stops a reel** (Escape, a canvas click, or the browser's own affordance). §14.3, §15.6 |
| **Reel: what the other tabs show, while a reel plays** | — | they describe the preset you left, not the one on screen | **the runner deliberately never writes the Lab's working preset** — doing so would discard an in-progress Sliders or Composer edit and re-seed every tab's baseline several times a minute. It is also what lets `Stop` put your preset back. §15.6 |
| **Reel: tiles animating slowly** | fewer tiles on screen | every tile crawls when both panes are full | **a shared budget, not a fault: ~30 visible tiles run at about 15 fps each, 96 at about 5.** Narrow the pane or scroll so fewer are visible. A tile that has never been scrolled into view shows only its background colour, which is why every tile is labelled. §15.2 |
| **Any grid of preview tiles — Grid, Evolution, History, Reel — while the MAIN view is heavy** | the main loop above **30 fps** | every tile animates at about a third of its normal rate, the whole grid slowing together; below 15 fps they stop altogether | ⚠️ **the guard working, not a fault, and it changed on 2026-09-24: below 30 fps it now THROTTLES the cadence instead of stopping the tiles, and WARM-UP IS EXEMPT** — so scrolling to a fresh region still fills at full speed, which is the half of the old behaviour that read as *"the previews never appear"*. Recovery needs **45 fps**, and **a recovery that does not hold makes the next one wait longer** (doubling, up to eight windows), which is deliberately why the previews no longer speed up and slow down about twice a second on a preset sitting near the threshold. Pick a lighter preset, or narrow the pane. §15.2 |
| **Reel: the autostart, on a dev server** | **`?reel=1`**, or the screensaver | nothing plays by itself, which is correct here and testable | ⚠️ **Since 2026-10-10 a browser build does not autostart either** — it opens on the preview grid and the header's Play button starts the reel. `?reel=1` is the only browser route to the presenting path; the screensaver still autostarts. `README.md` §6, §15.9 |
| **Reel: a deployed page that fills the browser WINDOW but not the screen — the tab strip and address bar are still there** | **one click** | the reel plays, the UI is hidden, and the browser's own chrome stays put; the console carries an error about a refused full-screen request | **expected, and the error is the browser's own, not the engine's.** `requestFullscreen()` needs a **user gesture** and a fresh load has none, so the ask is refused by design; what you are looking at is the engine's fullscreen *panel mode*, which needs no permission. **Click once — that click buys real full screen and the reel plays on**; the click after it, or any key, hands the page over to the Preview Grid. For zero clicks on a dedicated display, launch the browser with **`--kiosk`** (or `--start-fullscreen`): those are browser-level, so they leave no chrome to hide rather than making the ask succeed. §15.9, `README.md` §6 |
| **Reel: a deployed page where the FIRST click seems to do nothing, then the second reveals the UI** | — | one click apparently wasted | **that first click bought real full screen; under F11, `--kiosk`, or inside a host window that is already full screen it is a visual no-op** — all three are browser-level and leave `document.fullscreenElement` **null**, so the engine still has a promotion to spend. Stated rather than worked around: the alternative is guessing at full screen from window dimensions. §15.9 |
| **The preset name, on a mouse move** | **full screen** — and a preset that has actually been applied | nothing appears in any other view | it names what full screen alone cannot: there is no tile caption and no panel there. It is not a wake-up for a presenting deployment either — a **key** hands over, and a click either buys full screen or hands over. §14.3 |
| **`Filter ▾`, a chip clicked while `Rename` is open** | the rename to be finished | the click is **discarded**; while rename mode is open the button reads a bare `Filter ▾`, the summary row is gone and every chip reads *any* | press **Save** or **Escape** first, then choose. **The suspension itself is deliberate** — the rename field *is* the search field, and renaming a preset the grid is hiding would be worse — **and the whole filter comes back exactly as it was.** Only a click made during those few seconds is lost, and nothing on screen says so. §14.4 |
| **`→ / ←`, with a filter active and a non-default `Sort`** | the default sort order, to have them agree with the tiles | they walk the **right presets in the library's order**, not in the order the tiles are showing | expected today, and stated rather than hidden: the *set* is correct either way, so nothing is skipped or repeated — only the sequence differs from what you see. Sort back to the default if the order matters. §14.3, §14.4 |
