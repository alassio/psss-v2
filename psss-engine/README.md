# PSSS Engine

A modern TypeScript/WebGL2 reimplementation of the PSSS (Particle Systems Screen Saver) engine. Achieves full visual parity with the legacy Canvas2D/JavaScript implementation for all 177 original presets, plus a modern HDR rendering stack with bloom, tone mapping, depth shading, lighting, palettes, film looks, ribbon rendering, and fractal/strange attractor blending.

## Quick Start

```bash
cd psss-engine
npm install
npm run dev
```

Open `http://localhost:5173/` in a browser.

## Build & Deployment

⚠️ **THIS FILE IS NOT AUTHORITATIVE ON PROCESS — the repo-root `README.md` is** (§2.1 prerequisites, §4 build and deploy, §5 the screensaver), with the **data files' format and the measurement that forces it** in `psss-engine-v2_how_it_works.md` **§10.11** (added later the same day — the deployment pair, `g_psss_*=`, and the `file://` transport table) and the rest of the build's *reasoning* — why each setting exists, what breaks without it — still only in the archived edition of *how_it_works* (its **Appendix F**), which is kept with the project's engineering records rather than in this repository. ⚠️ **Those are two documents and the appendix letters belong to the ARCHIVED one**: the current reference has no Appendix F, its appendix runs A.1–A.4, and its own format chapter is a numbered section rather than an appendix. This section is a pointer, kept correct on purpose; **the engine chapters below it are maintained on their own schedule, so read any process claim there as dated.**

```bash
npm run build             # tsc → vite build → node scripts/export-library.mjs   (the web deployment)
npm run build:all         # ALL FOUR steps below, in order — the ONE central command
npm run build:screensaver #   2. the host alone: publish, stage the data files, assert the payload is one build
npm run docs:pdf          #   3. the two root manuals → PDF, beside their markdown
npm run package:dist      #   4. psss-engine-v2-distribution_<date>_<time>.zip in the repository root
npm run preview           # serve the built output over HTTP
npm run verify            # tsc --noEmit + every checker in checks/  <- must pass before calling a change done
npm run check:specs       # tsc over tests/ — invisible to verify, whose tsconfig includes only src
npm run check:demos       # does each demo preset differ from its PARENT? needs a dev server + Chromium
npm run check:ui          # does the Visual FX tab group, gate and sync? needs a dev server + Chromium
npm run verify:browser    # the Playwright suite
```

⚠️ **Three gates, and `verify` runs only its own.** Count the checkers with `ls checks/*.mjs` rather than trusting a total written down — here or anywhere else.

⚠️ **Step 3 needs ONE devDependency, installed once — `npm install --save-dev marked`** — and the script names that command if it is run without it. **Step 4 needs nothing**: it writes the zip with Windows' own `bsdtar` (`C:\Windows\System32	ar.exe`). ⚠️ **Step 4's inputs include step 1's `dist/` and step 3's PDFs, so the ORDER in `build:all` is load-bearing**, and the archive is written to the repository ROOT rather than into `dist/`: `dist/` is one of its inputs, and `vite build` empties `dist/` on the next web build.

**⚠️ `tsc` and `vite build` cannot see shader defects, nor GL state ordering.** GLSL lives in
template-literal strings and GL state is set at runtime, so five separate defects passed both cleanly and
only appeared in a browser — an undeclared uniform, three collapsed palette-mapping branches, a sampler left
on the wrong texture unit, a vertex buffer shorter than its draw call (which ANGLE reports and then silently
**drops the whole draw**, giving a black frame with no JS exception), and a leaked blend function.
`psss-engine/checks/` guards each of those classes:

| checker | asserts |
|---|---|
| `glslcheck` | every `u*`/`a*`/`v*` identifier used in a shader is also declared, plus the trail sanitiser's three boolean selects (invariant 20) |
| `samplercheck` | every `sampler2D` is assigned a texture unit, outside any conditional |
| `vaocheck` | both passes sharing a VAO upload every per-instance buffer |
| `lencheck` | every per-instance upload is sized to the draw count, over **three** paths — splat, the crystal pass and (since 2026-09-24) `NeonLineRenderer`. ⚠️ **A path it has not been pointed at reads exactly like a path with no defect**: neon was absent from this file for months and the suite was green throughout |
| `blendcheck` | a pass that DEPENDS on a blend function SETS it rather than inheriting it, and every pass restores `activeTexture` to unit 0 |
| `cullcheck` | `CULL_SENTINEL` has ONE definition, and its magnitude still clears every consumer guard **read out of the source** — so raising a guard without raising the sentinel fails (triage I13) |
| `deadcheck` | code that exists but is never REACHED — no draw call, no caller, no reader |

⚠️ **`check:gl` runs the first SIX rows; count them with `grep check:gl package.json` rather than trusting a
number in prose** — this table listed five for as long as `cullcheck` existed, and each checker prints its own
basis (`glslcheck` scanned 61 shaders across 10 files on 2026-09-17), so **quote a figure only with its date.**

`deadcheck` guards a different blind spot from the GL six: `tsc` type-checks a never-drawn program
exactly like a drawn one, `vite build` bundles a shader with zero draw calls, and the GL checkers reason
only about code that *is* reached — a resource nobody binds satisfies every one of them trivially. Batch G
(2026-08-10) removed six such paths that had been dead for months, including a whole compiled flame-resolve
program. Each `deadcheck` assertion targets **the reason** the code was dead, so correctly-wired regrowth
passes and unwired regrowth fails. Two of its nine assertions are bidirectional — every statistic
`preset-stats.ts` collects must be read by `jitter()`, *and* every key `jitter()` requests must be collected
— which is how two silently inert Randomiser mutations were found.

`coveragecheck` (2026-09-18, plan `21.1`) guards a third blind spot, one step past `deadcheck`'s: code that
*is* reached, wired, drawn and correct — **but only if a preset selects it, and no preset does.** Every other
gate is satisfied by such a feature, and the user meets it as an absence. It composes the library by
importing the real modules (`PresetManager` + `loadLibrary` over `public/psss_presets.json`, plus the TS
groups) and **resolves** activation rather than grepping bodies — the effective render mode through
`resolveModeAgainstMaterial()`, the live TransMap styles through `buildChainPlan()`, the force field through
`main.ts`' own `blend > 0 && tmEnabled` gate — then asserts per-feature floors, enum-member coverage,
boolean-leaf coverage (over leaves **derived by walking**, not a written list), and zero inert authorings.
⚠️ **Its own basis is part of what it asserts**, so §A reconciles the name set by NAME rather than by total,
and a section that finds nothing is a claim about the section until a seed exonerates it — every section
carries one, and each of the three defects found while writing it was in a resolver, not in `src/`.
`--audit` prints the per-preset activation report instead of asserting anything; the naming half of that
report is deliberately **not** mechanised, because a word-match called `Fluid Advection Demo` correct while
its body advected nothing (renamed by `21.2`). Its verdicts are plan `21.3`'s table, now in the manual's
**§27.6** — proposals only, the owner's to answer line by line.

⚠️ **Both of this file's palette readers go through `resolvePaletteSelection`, and that is not tidiness.**
Each used to carry its own `??` chain over the palette's two sources, and the `--audit` one read the film-look
half alone — so it printed *no palette* for the 114 bodies `21.4d` adopts, every one of which names one. **A
report cannot fail, so a report that undercounts reads as a gap to go and fill**, which is the one way a
reporting reader is *worse* than a rendering one. `sel.name` is the field to read; `sel.shaderPalette` is
`'none'` by construction under `index` and would have produced the same undercount a second way.

`palettecheck` (2026-09-18, plan `21.4`) guards a fourth blind spot, and it is the one a browser is *least*
able to help with: **the step's whole claim is an IDENTITY.** `21.D3` shows the legacy per-particle colour law
*is* Quilez's cosine palette (`a = colorBase/255`, `b = colorAmp/255`), so the `index` mapping is a seventh
**mapping** rather than a new colour system and the migration can name a `Cycle:` palette on 114 shipping
presets **without changing one pixel**. "Unchanged" is exactly what a visual review cannot confirm — a 1-LSB
authoring error (`0.5` where `128/255` was meant) is a lie in the sentence the step rests on and invisible on
screen. So the parity test runs through the **real** `LissajousGenerator`, at four non-zero instants
(⚠️ `pos = 0` is forbidden anywhere in the file: the drift term collapses on all three channels at once there,
so a test run at 0 passes with `colorShift` ignored entirely — invariant 28). Its source-shaped sections assert
the things no arithmetic can see: both halves of the `index` guard, and that `paletteMappingToInt` has exactly
**one** caller — the resolver — which is invariant 17 made falsifiable. Writing it found a live defect in the
**preview grid**, a third palette reader left on its own `??` chain when the palette gained a second source.

⚠️ **And then documenting it found a FOURTH reader, which every clause above was green over**, so the lesson is
about the instrument's granularity rather than about one file: `resolvePhysarumTrailLut()` read
`customFilmLookParams.palette` — correct while the film look was the only source — so a palette chosen in the new
Colour Palette section coloured the figure and not the trail. `main.ts` called the resolver *elsewhere*, and the
trail never converts a mapping, so neither the file-granular clause nor the `paletteMappingToInt` tell could see
it. **A whole-file test for "does this file resolve" cannot see a second reader inside the same file**; the clause
that catches the class is a ban on reading a palette *source* at all, calibrated against the pre-fix line verbatim
and against the tempting near-miss fix (`shaderPalette`, which is `'none'` under `index` and would have fallen
through to orange on exactly the 114 bodies the migration adopted).

⚠️ **§H (`21.4g`) is the section that exists because a USER found the defect, and it is worth reading as a limit
on everything above.** The six built sub-steps left the tab with **two** `Palette` controls — the new one and the
one nobody removed — writing the two sources the resolver reconciles. Since the override wins, the older control
was **inert whenever the newer one was set**: invariant 13's harder form, and every gate in this repo was green
over it, because each control was correctly wired to a field that is correctly read. No count of sections,
descriptors or tooltips can represent "two controls for one quantity". What §H *can* do is hold the fix in place,
so it asserts an **absence** (six retired spellings, over comment-stripped source — this file's prose names them
all, so a raw-text pattern would match itself and pass forever), the surviving rows reading the **resolved**
selection rather than a stored field, and the adoption's **call sites and order**: `applyFilmLook` must not adopt,
because it is also the preset-load path, and adopting before it captures the outgoing look. ⚠️ **Its measured
clause earned itself immediately**: a material's `presentation` establishes a look in two calls, so the adoption
in `setFilmLook` captured a stale palette that then beat the material's own — all four presentation sets applying
every field except their colours. §H replays that three-step sequence from a deliberately stale state; §I seeds
the defect as it shipped, the reordered variant, and the tidy generalisation (adopting inside
`setCustomFilmLookParam`) that would fire on every slider drag.

⚠️ **And then the same user found a SECOND defect in `21.4g` one day later, over a §H clause that was green
because it asserted the wrong rule IN WORDS.** Three of the fifteen look bundles carry `palette: 'none'`
(`Legacy`, `Legacy Graded`, `Cinematic`) — which does not mean *no palette*, it means *this bundle declines to
choose one*, and that is why those three exist: a grading change can be judged without restyling the colour.
The adoption materialised that word into the override, so picking `Legacy Graded` — or `Customize`, which
`applyFilmLook` seeds from the outgoing bundle — **erased the palette the preset itself had selected**, on every
one of the 114 bodies the migration adopts. The report was `Spiritual`, arriving as `Cycle: Indigo` +
`Particle index` and losing both to `None` + `Depth`. The fix is an early return:
`lookPaletteForAdoption()` returns `null` and `adoptLookPalette()` writes nothing. ⚠️ **The instrument lesson is
the one this repo keeps re-learning in a new place: the pre-fix clause SAID *"adopting `'none'` is correct: it
is the stored word for no palette, which is what that look means"*, and the seed beside it justified itself with
*"nothing above a film look supplies a palette"* — a premise `21.4d` had already falsified by putting a palette
into 114 bodies.** Every clause in §A–§H started from a preset that has selected nothing, the one state in
which "write `'none'`" and "write nothing" are indistinguishable. So **seed a write-rule against a subject that
HAS the thing the write can destroy**, and re-derive a calibration's *premise*, not only its seed. §H now
measures all **15 looks × the 9 `(palette, mapping)` pairs the library actually authors**, reconciles the three
abstainers **by name** against the bundles whose `palette` field is `'none'`, and §I seeds three ways: the
shipped `'none'` write (27 of 135 cases wrong), the tempting `PALETTE_UNSET` coercion — which is **not** a fix,
because `''` means "not overridden" and falls straight through to the look's own `'none'`, reaching the same
answer by a route that deletes the override en route (the same 27) — and a mapping-only half-write, which is
**worse** at 135, since re-pointing a `Cycle:` palette from the CPU index law at a depth LUT yields a
*different* plausible picture rather than a missing one. ⚠️ **That third seed also caught my own prose
disagreeing with my own arithmetic** — modelled first as `palette: undefined`, it fell through to the look and
re-measured the wipe (27) while its sentence claimed the palette survives: **check what a seed MODELS against
what its sentence CLAIMS.**

**These are necessary, not sufficient: a shader change is not done until it has been seen in a browser.**

The web build outputs **four** files, side by side, opening from `file://` with no server and no network:

```
dist/
├── index.html            engine + inlined CSS, three deferred classic scripts
├── psss-engine.js        the whole engine, one classic script — there is no assets/ directory
├── psss_presets.json     the composed preset library, external and editable
└── psss_reels.json       the reel library + which reel autostarts
```

⚠️ **This block used to describe `index.html` + `assets/index-*.js` + `psss_presets.json`, a shape the build has not emitted since the `file://` deployment work** — recorded because **a wrong SHAPE is worse than a stale figure: it reads as a build defect rather than as an old document.** `npm run build:all` additionally leaves **`dist/screensaver/`** — `psss.scr` plus the same two data files, the installable screensaver set. ⚠️ **`vite build` empties `dist/`, so a later web-only build deletes that folder**, deliberately: a `.scr` outliving the engine embedded in it is the stale artefact the wrapper exists to prevent. Prerequisites, the argument contract and installing: **`screensaver/README.md`**.

**No backend server required.** The `dist/` folder can be opened directly via `file://`, dropped onto any static host (GitHub Pages, S3, Netlify, etc.), or served by any HTTP server. This preserves the same zero-infrastructure deployment model as the legacy single-file implementation.

The Vite dev server (`npm run dev`) is used only during development for TypeScript transpilation and hot-reload — it is not part of the production deployment.

## Repository Structure

```
psss_js_new/                    # Root project
├── psss.js                     # Legacy engine (single-file, Canvas2D + WebGL1)
├── index.html                  # Legacy UI (Bootstrap + jQuery)
├── psss_presets.json           # 177 preset definitions (legacy app; git-tracked, never modified)
├── psss-engine/                # ← New engine (this directory)
│   ├── src/                    # TypeScript source
│   ├── public/                 # Static assets + the engine's own psss_presets.json copy
│   │                           #   (a real file, NOT a symlink — see Known Issues: divergence)
│   ├── index.html              # Minimal fullscreen canvas host
│   ├── package.json            # Dependencies: Vite, TypeScript, Lit
│   ├── tsconfig.json           # Strict TS config (noUncheckedIndexedAccess, etc.)
│   └── vite.config.ts          # Dev server config (allows parent dir access)
└── backup_*/                   # Timestamped backups of prior states
```

## Code Structure

```
src/
├── main.ts                         # Entry point: init, animation loop, ping-pong FBO pipeline
├── core/
│   ├── interfaces.ts               # Generator, Renderer, PostProcessor interfaces + types
│   ├── compute-backend.ts          # WebGL2 context creation with feature detection
│   ├── config.ts                   # EngineConfig defaults
│   ├── pipeline.ts                 # Pipeline coordinator (placeholder)
│   └── registry.ts                 # Component registry (placeholder)
├── core/
│   ├── curl-noise.ts               # Divergence-free simplex-curl turbulence (CPU, model space)
│   └── deform-limits.ts            # v8 Phase 30 — the deformation clamps + readouts, shared engine/UI
├── crystal/                        # v8 Phase 8a — Faceted Crystal (additive pooled crystals)
│   ├── crystal-config.ts           # DEFAULT_CRYSTAL_CONFIG, CRYSTAL_SHAPES, SHAPE_SIZE_COMPENSATION
│   ├── crystal-pool.ts             # CrystalPool: nucleate → hold → melt lifecycle, FIFO-oldest reuse
│   └── spatial-hash.ts             # SpatialHash: uniform-grid neighbour queries for accretion
├── generators/
│   ├── lissajous.ts                # Particle wave generator (3 waves × 3 axes, AM/FM)
│   ├── attractors.ts               # Fractal/strange attractor iteration (10 types, 39 presets: 15 Julia, 11 Mandelbrot, 13 strange)
│   ├── fire-processor.ts           # Buoyancy offset engine (temperature-driven upward force)
│   ├── spark-pool.ts               # Independent spark particle pool (pre-allocated, Newtonian physics)
│   ├── material.ts                 # MaterialProcessor: per-particle temperature/lifetime state
│   ├── material-presets.ts         # 8 material presets + default configs for buoyancy/spark/dye/volume
│   ├── colour-ramps.ts             # 7 colour ramps (fire, ice, liquid, organic, smoke, fire-phase, fire-smoke)
│   ├── simplex-noise.ts            # simplex3D + curl2D (divergence-free 2D curl derivative)
│   ├── physarum.ts                 # Physarum polycephalum steering simulation
│   └── index.ts
├── growth/                         # DORMANT — retained for v8 Phase 8b; see growth/README.md
│   ├── README.md                   # Status, what was deleted and why, what is kept
│   ├── dla-processor.ts            # DLA sticking core — reused by Phase 8b.1
│   ├── reaction-diffusion.ts       # GPU Gray-Scott + chemotaxis loop — optional Phase 8b.4
│   ├── growth-presets.ts           # 5 DLA + 5 RD presets (L-System/Crystal entries pruned)
│   └── index.ts
├── renderers/
│   ├── hdr-particle.ts             # WebGL2 point-sprite renderer; modes are the `RenderMode` union — count it there
│   ├── ribbon-renderer.ts          # Ribbon/streak renderer (3 modes: hybrid, streaks, adaptive)
│   ├── neon-line-renderer.ts       # Neon line overlay renderer
│   ├── film-looks.ts               # Film look presets (15 named + Customize mode)
│   └── index.ts
├── post-processors/
│   ├── trans-map.ts                # Pixel displacement (7 styles, 0–6)
│   ├── trans-map-force.ts          # TransMapForceField: displacement → particle forces (styles 4 & 5)
│   ├── procedural-flow.ts          # ProceduralFlowGenerator: RG16F simplex-curl displacement (style 5)
│   ├── flow-archetypes.ts          # 12 procedural flow archetypes
│   ├── ifs-presets.ts              # 10 curated IFS transform presets (style 4)
│   ├── bloom.ts                    # HDR bloom (bright-pass → downsample → tent upsample)
│   ├── tone-map.ts                 # Tone mapping + colour grading (ACES/Reinhard + LGG)
│   ├── fluid-advection.ts          # GPU velocity field + dye field (semi-Lagrangian advection)
│   └── index.ts
├── presets/
│   ├── types.ts                    # UnifiedPreset, OverlayState, GrowthConfig, all config interfaces
│   ├── migration.ts                # Legacy JSON → UnifiedPreset conversion
│   ├── palettes.ts                 # Cosine palette system + legacy gradient LUTs
│   ├── manager.ts                  # Load, freeze, working-copy management
│   ├── fire-presets.ts             # 5 curated fire/ember/flame presets (Phase 6)
│   ├── flow-presets.ts             # 5 curated procedural-flow presets (Phase 6C)
│   └── index.ts
├── fields/
│   └── index.ts                    # Force fields (placeholder)
├── exploration/                    # Lab state, algorithms and shared tab plumbing
│   ├── state.ts                    # ExplorationState + TabId union
│   ├── tab-module.ts               # TabModule interface + TabRegistry
│   ├── overlay-rules.ts            # OVERLAY_RULES: one row per overlay key (group + law + mutate + scale)
│   ├── interpolate.ts              # interpolatePreset (master + per-category weights)
│   ├── randomize.ts                # randomizePreset (Gaussian jitter, 7 strategies, reads OVERLAY_RULES)
│   ├── evolution-ops.ts            # mutatePreset / breedGeneration
│   ├── slider-mappings.ts          # SEMANTIC_SLIDERS (14) + sliderMul + SCALERS + rowLiveness + warmthLaw
│   ├── preset-stats.ts             # Per-field statistics used to scale mutation sigma
│   ├── perf-guard.ts               # FPS watchdog; pauses tile renderers below threshold
│   └── evo-tile-renderer.ts        # Legacy evolution grid renderer (superseded by GridTileRenderer)
└── ui/
    ├── index.ts                    # UI exports
    ├── layout.css                  # CSS Grid split-screen layout (.app-layout, .fullscreen)
    ├── preview-grid/
    │   ├── panel.ts                # PreviewGridPanel: scrollable tile grid, search, IntersectionObserver
    │   ├── panel.css               # Grid tile styling, active-tile highlight
    │   └── grid-tile-renderer.ts   # WebGL2 tile renderer: per-slot FBO pipeline, budget scheduling, tonemap
    └── synthesis-lab/
        ├── panel.ts                # SynthesisLabPanel: header (Reset/Snapshot/Export/Import/Grid) + 8 tabs
        ├── panel.css               # Lab panel styling
        ├── export.ts               # exportPresetJSON, exportAllPresetsJSON, importPresetWithDialog
        └── tabs/                   # re-listed from `ls` 2026-10-06 — it was wrong in BOTH directions:
            ├── composer.ts         # it still listed the deleted archetypes.ts and omitted these three
            ├── evolution.ts        ├── history.ts      ├── materials.ts
            ├── mixer.ts            ├── randomiser.ts   ├── reel.ts
            ├── sliders.ts          ├── transmap.ts     └── visual-fx.ts
                                    # materials.ts also owns the Crystals section (8a-3)
                                    # directory order, NOT bar order — read TAB_DEFS for that
```

## Rendering Pipeline

Each frame executes this sequence using ping-pong RGBA16F HDR FBOs (A and B):

```
1. Decay + Blur:    Read A → Write B  (blit with optional 3×3 gaussian, then fade overlay)
2. Crystal:         Render into B     (crystal pool slots only: hexagonal, hard-edged, ALPHA-OCCLUDING; drawn first so it blocks the glow behind it — v8 Phase 8a)
2b. Particles:      Render into B     (point sprites or ribbon geometry; the draw is truncated to exclude the trailing crystal block)
2a. Physarum:       Overlay onto B    (only when active and showTrail)
2b. Growth:         Own FBO → B       (only when isAnyEnabled(); rebinds B afterwards)
3. TransMap:        Read B → Write A  (pixel displacement warp, fades with attractor blend)
   or Copy:         Read B → Write A  (simple blit if no TransMap)
4. Post-process:    Read A → Screen   (bloom → tone map, or direct blit in Legacy mode)
```

Steps 2a/2b are conditional overlays that write into the trail buffer *before* TransMap, so
both are warped along with the particles. The growth compositor renders its four systems into
its own RGBA16F FBO and composites the result onto B, then restores the B binding.

### Post-Processing Chain (Phase 2)

When a non-Legacy film look is active:

```
Trail FBO (A) → Bloom (bright-pass → 5-level mip downsample → tent upsample → composite)
             → Tone Map (ACES/Reinhard + exposure + lift/gamma/gain + saturation + vignette)
             → Screen
```

Bloom does NOT re-enter the trail buffer — it's applied only at the final output stage.

## Key Concepts

### Particle Generation (LissajousGenerator)

Each particle's position is computed from 3 independent waves per axis (X, Y, Z):

```
am = base + sin(time * freq / DEG) * amplitude
fm = (base + sin(time * freq / DEG) * amplitude) / DEG
position = sin((particleIndex * step + phase) * fm) * am
```

Where `step = 360 / particleCount`. After computing 3D positions, Euler XYZ rotation and perspective projection map to screen space. Per-particle velocity is computed as normalized frame-to-frame screen-space displacement.

Wave amplitudes are scaled from the preset's design resolution to the actual canvas size at init time. When the canvas is resized (e.g. entering/exiting fullscreen), `generator.resize(w, h)` rescales the already-scaled amplitudes from the old dimensions to the new ones and updates the projection origin and perspective depth, ensuring particles fill the correct viewport in all layout modes.

### Attractor System

Ten fractal/strange attractor types that blend with the Lissajous wave engine:

| Type | Category | Parameters |
|------|----------|------------|
| Clifford | Discrete 2D map | a, b, c, d |
| De Jong | Discrete 2D map | a, b, c, d |
| Lorenz | Continuous 3D ODE | sigma, rho, beta, dt |
| Rössler | Continuous 3D ODE | a, b, c, dt |
| Thomas | Continuous 3D cyclic | b, dt |
| Halvorsen | Continuous 3D | a, dt |
| Aizawa | Continuous 3D toroidal | a, b, c, dt |
| Nosé-Hoover | Continuous 3D thermostat | a, dt |
| Julia | Escape-time flow | cRe, cIm, speed |
| Mandelbrot | Escape-time flow | speed |

**35 curated presets** across all types (3 Clifford, 2 De Jong, 2 Lorenz, 2 Rössler, 1 Thomas, 1 Halvorsen, 1 Aizawa, 1 Nosé-Hoover, 15 Julia, 11 Mandelbrot).

#### Attractor Blending

Blending operates in **model space** (before rotation/projection), matching the legacy implementation:

```
particle[i].xyz = (1 - blend) * wavePosition + blend * attractorPosition
```

At blend=0.0 the particle system is pure Lissajous; at blend=1.0 the particles follow purely the attractor dynamics, but still receive 3D rotation and perspective projection for depth effect.

#### Escape-Time Flow (Julia & Mandelbrot)

Particles flow perpendicular to the escape-time gradient (along iso-contours):

1. Pre-build 512×512 escape-time grid with adaptive maxIter (256–1000 based on zoom)
2. Apply 3-pass weighted box blur for smooth gradients
3. Sample via bilinear interpolation
4. Compute gradient with central differences (eps = gridPixel × 1.5)
5. Move perpendicular to gradient at speed = gridPixel × 0.4
6. Random respawn for particles hitting set interior/boundary

Grid is cached and only rebuilt when attractor type/params/bounds change.

#### TransMap Fade

TranslationMap displacement fades proportionally to attractor blend via shader `mix()`:
- blend=0.0 → TransMap at full strength
- blend=0.5 → TransMap at 50%
- blend=1.0 → TransMap fully disabled

#### State Preservation

Attractor particle state (converged positions) is preserved across preset switches. When particle count changes between presets, state is resampled (copy + wrap for new particles).

### Render Modes (Point Sprites)

| Mode | Blending | Fragment Shape | Point Size |
|------|----------|----------------|------------|
| pixel (0) | Alpha | Radial falloff | 3.0 × scale |
| blend (1) | Additive (ONE, ONE) | Radial falloff | 3.0 × scale |
| star (2) | Alpha | Cross/star pattern | 5.0 × scale |
| splat | Additive or Alpha | Temperature-driven colour ramp + radial core/halo | splatRadius (1–50) |
| volume | Additive → Beer-Lambert resolve | Gaussian density + depth fade | splatRadius × velocityStretch |
| liquid | iso-surface, OCCLUDES | screen-space surface over an accumulated density field | `liquidPointDiameter()` |

⚠️ **The numbers this table used to carry were the shader's `modeInt`, not an identity, and they are gone on
purpose.** `log-density` was **retired on 2026-09-19** (owner; plan 21.8c/d, decision 21.D6) — no preset in the
library selected it, and it cost an R32F FBO and two programs. Its `modeInt` **3 is reserved, not reused**: the
shaders only ever branch on `== 2`, so a new mode handed 3 would silently inherit "not star". The legacy
INTEGER 3 still exists in `presets/migration.ts` and now maps to `star`, because an imported legacy file can
still key it.

### Ribbon Renderer

Three ribbon modes (cycled with `R` key):

| Mode | Description | Particles |
|------|-------------|-----------|
| Hybrid | 200 sampled long ribbons (64-point trail) | Remaining particles rendered as points |
| Streaks | Short thin velocity trails (6-point trail, 20% width) | All particles |
| Adaptive | Short ribbons, trail auto-scales with count (max 12) | All particles |

Ribbons are tapered (thin at tail, wide at head) with soft-edge falloff and additive blending. The vertex budget is capped at 200K to maintain 60fps.

**Density-adaptive scaling:**
- Width scales as `baseWidth × sqrt(1000 / particleCount)` — thinner for denser presets
- Attractor-aware alpha: `opacity × (1 - blend × 0.6)` prevents white-out from additive stacking in concentrated attractor bands

**Teleport detection:** Segments where distance² > 900 (particle respawn) are clamped to zero alpha, preventing streak artifacts.

**Film-look palette (fixed 2026-08-06).** Ribbon and neon are *trajectory* renderers and were never sent
the film look's `palette`/`paletteMapping` — `applyFilmLook` routes those through
`renderer.setFilmLook()`, which is `HDRParticleRenderer` alone, and neither trajectory shader had a
palette uniform at all. They emitted the preset's own `state.colors`, so 12 of the (then) 14 film looks had their
palette silently dropped. It was easy to miss in **Hybrid** (only 200 particles are ribboned; every other
particle still goes through the palette-aware point pass) and total in **Streaks**/**Adaptive** and neon,
where every particle is a trajectory — presenting as "the film look is ignored and some default ramp is
used", while bloom/exposure/tone-map kept responding because those are full-screen passes.

`TrajectoryPalette` (`renderers/trajectory-palette.ts`) now resolves the palette **on the CPU** as each
history sample is captured, reusing the `r`/`g`/`b` fields both renderers already store — no new uniforms,
attributes or textures. Its mapping is byte-identical to the point shader's (verified to 0.00000 deviation
across 10 palettes × 3 mappings), which matters because Hybrid draws ribbons and points side by side from
the same figure. The LUT index must **round**, not truncate: the shader lands on the nearest texel centre,
and truncating is off by one over the upper half of every texel (`Prismatic` shifts up to 7/255 per texel).
`Legacy` and `Cinematic` are `palette: 'none'`, so they — and all 177 legacy presets, which default to
`Legacy` — render exactly as before. Depth shading and the two lighting modes remain absent from both
trajectory renderers by design: `depthSize`, `depthDof` and rim lighting are point-sprite concepts with no
meaning for a 2D strip.

### Depth Shading

Per-particle depth (normalized Z from perspective projection) drives:

- **Size**: Near particles larger, far particles smaller
- **Brightness**: Atmospheric extinction (far = dimmer)
- **DoF blur**: Out-of-focus particles rendered softer/larger
- **Colour shift**: Warm near, cool far (temperature shift)

### Fake Lighting

Point sprites reconstruct sphere normals from `gl_PointCoord`:

- **Directional**: Lambertian diffuse from configurable light direction
- **Rim**: Fresnel-like edge glow (highlights silhouettes)
- **Both**: Combined directional + rim

### Bloom

5-level progressive downsample/upsample with tent filter:

1. **Bright pass**: Extract pixels above luminance threshold
2. **Downsample**: 13-tap bilinear, half resolution per level
3. **Upsample**: 3×3 tent filter with additive accumulation
4. **Composite**: Scene + bloom × intensity

### Tone Mapping

- **Curves**: ACES filmic (Hill's fitted RRT+ODT, with `ACES_EXPOSURE_BIAS`), Reinhard, or passthrough
- **Exposure**: Pre-curve linear multiplier
- **Lift/Gamma/Gain**: Per-channel colour grading
- **Saturation**: Luminance-preserving desaturation/enhancement
- **Vignette**: Distance-based edge darkening

### Palette System

Two palette types, unified via 256-entry RGBA LUT textures:

**Cosine Palettes** (12 curated, Quilez formula):
`color(t) = a + b × cos(2π(c×t + d))`

Warm, Cool, Neon, Earth, Prismatic, Monochrome, Sunset, Ocean, Fire, Aurora, Pastel, Midnight

**Legacy Gradient Palettes** (13, linear interpolation between stops):
fire, ocean, aurora, neon, grayscale, sunset, toxic, thermal, cyberpunk, ice, ember, galaxy, candy

**Material ramps** are also selectable as palettes via a `Material: ` prefix, so the Customize → Palette
dropdown reads **Cosine ·** (12) / **Classic ·** (13) / **Material ·** (7). The prefix is required, not
decorative: `fire`, `ice`, `smoke` and `organic` collide with cosine or legacy names, and the cosine lookup
runs first and is case-insensitive. This gives `material.colourRamp` a UI control for the first time.

**Palette Mapping** — determines what drives the LUT lookup coordinate. Six members since B14:

| Mapping | Source | Effect |
|---------|--------|--------|
| depth (0) | Normalized Z (0=near, 1=far) | Near/far colour gradient |
| phase (1) | Particle colour luminance | Brightness-to-colour remap |
| velocity (2) | Normalized speed (0=still, 1=fastest) | Speed-to-colour mapping |
| temperature (3) | `MaterialConfig` heat — **needs an active material** | Integrated, thermally-smeared colour |
| position (4) | Dual-axis `sin(px*0.003) * cos(py*0.004)` field | Static spatial colour field |
| age (5) | Staggered 6 s cycle | Cyclic colour over particle lifetime |

**Colour precedence, unified by B14 (2026-08-07): palette > material ramp > preset colour**, one order
across every pass. Before B14 there were five sources with no priority, chosen by the active *render mode* —
and since selecting a material force-switches the mode to `splat`, and the splat fragment shader contained
no palette code at all, **choosing a material silently discarded both the film look's palette and the
preset's own `ColorBase`/`ColorAmp`/`ColorFreq`.** Reported as *"when I use a material the change of colour
via film look seems not to apply"*.

| Pass | preset colour | film-look palette | material ramp | crystal ramp |
|------|:---:|:---:|:---:|:---:|
| **point** — `pixel`/`blend`/`star` | ✅ | ✅ | — | — |
| **splat** — any material | — | ✅ **(B14)** | ✅ fallback | ✅ |
| **volume** | — | — | ✅ | — |
| **ribbon** | ✅ | ✅ | — | — |
| **neon** | ✅ | ✅ | — | — |

`temperature` is what lets a material and a film look **compose instead of compete**: material heat becomes
the palette's *input*, so the material owns the physics and the film look owns the colour. The set
deliberately covers the same quantities as `MaterialConfig.heatMode`, and `position`/`age` reuse heatMode's
own formulas so both controls mean the same thing by the same word — changing one formula without the other
would leave the labels matching while the behaviour diverged. They remain complementary, not redundant:
`heatMode` decides what makes a particle *hot* and **integrates** (temperature has thermal memory and lags
its driver), while `paletteMapping` decides what *indexes the palette* and is **instantaneous**. So
`heatMode: velocity` + `Map: temperature` gives smeared trailing colour, while `Map: velocity` gives crisp
banding off the same input.

⚠️ **`temperature` is the only mapping that needs a material.** Without one, `temperatures[]` is all-zero
and every particle samples LUT index 0 — one flat colour. `HDRParticleRenderer` degrades mapping 3 to
`velocity` when `state.temperatures` is absent, and the guard must exist in the renderer as well as the UI
because a preset can carry mapping 3 with no material. `position` and `age` deliberately carry no such
guard — do not widen it, or two working mappings go silently dead.

⚠️ **Each mapping must read its OWN per-particle source, or the options collapse.** Two traps, both hit on
the first attempt and reported as *"changing the map values seems not really to have an effect"*: do **not**
derive `phase` from `rampColor.rgb` (the ramp is already temperature-indexed, so phase becomes a duplicate
of temperature — it needs the preset's own oscillating colour); and `aVelocityDir` cannot serve `velocity`,
because the generator normalises it, so `length()` is always 1. Both new splat attributes are per-instance
and need `vertexAttribDivisor(…, 1)` — without it every instance reads particle 0 and the whole figure takes
one colour.

**Colour and ALPHA are separate concerns.** Ramps and palettes are **RGB lookup tables**; opacity comes from
**geometry** (`shape` in the point and splat passes, `density` in volume, Fresnel × `iceOpacity` for
crystals). The palette override is therefore RGB-only, and swapping an alpha-less palette for a ramp changes
colour without affecting how solid a material is. One exception (B15): **alpha-blend** materials fold in the
ramp's authored alpha — `outA = uIsAdditive > 0.5 ? shape : clamp(shape * rampColor.a, 0, 1)`. The gate is
load-bearing, since `ONE, ONE` never reads alpha, so `Plasma`/`Fire`/`Ember`/`LiquidLight` are provably
byte-identical while the curve becomes load-bearing for `Smoke`/`Fog`/`Ice`/`Organic`. This is the real fix
for the "snakes looking for a way through the ice" defect — a cold opaque Ice particle was replacing the
bright crystal behind it, knocking a 0.85 crystal to **0.18**; with the ramp's own alpha it survives at
**0.746**. **Ramp alpha is not recoverable from RGB** (the alpha-to-luminance ratio swings 15.05× → 1.01×
within a single ramp), so do not "simplify" it away: it encodes *how much this temperature should occlude*,
independent of how bright it is.

### Film Looks

Named rendering parameter presets that configure the full post-processing stack:

Keys 1–6 switch the first six; all 15 are selectable from the Visual FX tab. Listed **crisp → soft**,
which is the rendered `glow` ordering — **not** the dropdown order, which iterates literal order in
`film-looks.ts`.

| Film Look | Key | glow | Bloom | Tone Map | Depth | Lighting | Palette |
|-----------|-----|------|-------|----------|-------|----------|---------|
| Void | — | 1.5 | On (0.9) | ACES | Full+DoF | Rim | Midnight (depth) |
| Monochrome | — | 2.0 | Off | Reinhard | Size+Bright | Rim | Monochrome (depth) |
| Vintage | — | 2.6 | On (0.25) | Reinhard | Full | Directional | Earth (depth) |
| Cinematic | 3 | 3.0 | On (0.6) | ACES | Full | Directional | None |
| Teal & Orange | — | 3.2 | On (0.45) | ACES | Size+Bright | Both | Sunset (depth) |
| Dramatic | 6 | 3.4 | On (0.7) | ACES | Full | Both | Prismatic (velocity) |
| **Legacy** | 1 | **4.0** | Off | Off | Off | Off | None |
| **Legacy Graded** | — | **4.0** | On (0.3) | ACES | Off | Off | None |
| Glacier | — | 4.4 | On (0.55) | ACES | Full+DoF | Rim | Cool (depth) |
| Luminous | 2 | 4.8 | On (0.4) | ACES | Size+Bright | Off | Warm (depth) |
| Holographic | — | 5.0 | On (0.45) | ACES | Size+DoF | Both | Aurora (phase) |
| Neon | 4 | 5.4 | On (0.55) | ACES | Size | Rim | Neon (phase) |
| Plasma | — | 6.0 | On (0.65) | ACES | Size | Rim | Neon (velocity) |
| Ethereal | 5 | 6.4 | On (0.5) | Reinhard | Size+Bright+DoF | Off | Pastel (depth) |
| Overexposed | — | 7.0 | On (0.8) | Reinhard | Off | Off | Warm (phase) |

Legacy mode produces identical output to Phase 1 (no post-processing).

**⚠️ `glow` is the reciprocal of a falloff exponent, and all values were re-authored 2026-08-06** (there
were 14 bundles then; `Legacy Graded` was added later and inherits `Legacy`'s 4.0). The
shader applies `pow(falloff, 8.0 / glow)`. It was `pow(falloff, glow)` until then — backwards, since
`falloff` is in [0,1] and a higher exponent *shrinks* the halo, so the control did the opposite of its
name. The shader fix first shipped with the values remapped `new = 8/old` to "render exactly as before",
which preserved the *buggy* appearance and left an ordering contradicting every name (`Void` had the
widest halo, `Overexposed` the narrowest). They are now authored against the field's real meaning, and 8
of the 14 land within 0.6 of the original pre-remap values.

`Legacy` is **pinned at 4.0** — all 177 legacy presets carry `renderer.glow: 2.0` and the ribbon/neon
shaders use `max(1.0, 2.0/uGlow)` so that value is the identity. `bloomIntensity` was trimmed on the four
looks where glow and bloom double-count (`Holographic`, `Neon`, `Plasma`, `Overexposed` — the values in
the table above are the new ones). No other grading field changed. Treat `glow` as a **shape** control:
`exposure` and `bloom` own brightness, and tuning `glow` against a brightness target re-inverts it.

**`Legacy Graded` (added 2026-08-10) exists because `star` mode is UNDER-EXPOSED in absolute terms.**
Alpha compositing is bounded by the sprite's own `shape` — the measured mean at `glow: 2.0` is 0.373 — so
a figure pixel reaches only 0.139–0.365, and under `Legacy` (no tone map, exposure 1.0) that goes straight
to the screen as **8-bit 35–93 of 255**. All 177 legacy presets therefore render in the bottom third of
the available range. With ACES at exposure 1.4 the same values become 74 / 129 / 159.

⚠️ **The three tone-map fields are ONE atomic change; any subset is inert.** `exposure` is a uniform
*inside* the tone-map shader, and the whole post pass is gated on `bloom.isEnabled() || toneMap.isEnabled()`
— so raising `exposure` on a bundle with `toneMapEnabled: false` changes nothing at all. This is why it
could not be done by giving `Legacy` "a better default exposure". It is a **separate bundle** rather than a
`Legacy` retune because `Legacy` is the `?? 'Legacy'` fallback for every preset with no `overlay` block —
all 177 — so editing it restyles the whole library at once and destroys the A/B reference needed to judge
or revert. It differs from `Legacy` in exactly six fields, preserving `glow: 4.0` and `palette: 'none'`, so
sprite geometry is byte-identical and colour untouched: this changes brightness only.

**`glow` reaches every render mode since 2026-08-07 (B11 + B12).** It previously affected `blend` only:
the `star` fragment shader branched and returned before reaching the glow line — and `star` is the default
for 167 of the 177 presets — while `splat` had no `uGlow` uniform at all, so glow was inert whenever a
material was active. `star` now scales the arm **half-width** as well as the radial fade (the width term
is the load-bearing half; shading alone was measurable but invisible at a real ~8 px sprite), and `splat`
folds glow into the material's falloff **multiplicatively**: `uFalloffExponent * (4.0 / uGlow)`. The
multiplication is not a style choice — `falloffExponent` is honestly named (higher = tighter) while `glow`
is the *reciprocal* of an exponent, so adding or replacing would recreate the inversion bug. Both paths
normalise on `glow = 4.0` (`Legacy`'s value), keeping all 177 legacy presets byte-identical.

⚠️ **`glow` cannot brighten a scene that already clips, and most presets do.** Measured boundary: glow
stops being perceptible above a peak HDR of ~2.75, and `Aurora Borealis` peaks at 3.87. **Judge any
particle-shape or grading change on a low-accumulation preset** — `Cylinder` (`MotionBlur 0`) is the best;
never on `MotionBlur 8` + 4 000 particles (`Rose`, `Waves`, `Transmission`). And measure the **final 8-bit
output**, not the shader's `shape`: trail accumulation, exposure and the tone curve can each flatten a
change to nothing.

### TranslationMap

A pixel-remapping field applied every frame to create flowing distortion effects. Seven displacement
algorithms — the first four are the legacy precomputed tables, the last three are modern additions:

- **Style 0 (sinMagic)**: Wave-based X/Y shift
- **Style 1 (sinMagicZoom)**: Zoom toward center modulated by wave values
- **Style 2 (sinMagicZoomOverlay)**: Combined X+Y zoom modulation
- **Style 3 (sinMagicZoom2)**: Dual-parameter set (shift + zoom combined)
- **Style 4 (IFS fractal feedback)**: up to 6 weighted affine transforms blended per frame, producing
  self-similar echo trails. 10 curated presets + a per-transform editor
- **Style 5 (procedural flow)**: time-evolving simplex-curl noise rendered to an RG16F displacement
  texture on the GPU. 12 flow archetypes
- **Style 6 (fluid feedback)**: Milkdrop-style liquid warping driven by the *actual* particle-motion
  velocity field rather than by procedural noise

Implemented as a precomputed RGBA32F displacement texture sampled in a fullscreen shader pass. A `uMix` uniform interpolates between identity UV and displaced UV, allowing proportional fade with attractor blend.

**⚠️ Style 6 overrides three pieces of global state** — `trailDecay` (its `persist` replaces the preset's
`decayFactor`), `setForceFieldActive(true)` (which starts the 512² velocity sim) and `setFieldDecay`. Until
2026-08-12 all three were assigned on entry at **six** sites and restored at none, and the assignment tested
only the *style*, so merely picking style 6 from the dropdown changed the trail length and started the sim
**with TransMap switched off** — and leaving style 6 never undid it. They are now derived in one place,
`applyFluidFeedbackState()`, as a pure function of `(currentTransMapEnabled, currentTransMapStyle)`; being a
pure function of the two flags is what makes the leak structurally impossible. **Do not re-introduce an
assign-on-entry site** — add to the helper instead.

**Force Field.** With the Translation Map enabled, `TransMapForceField` couples the displacement to the
particles themselves rather than only to the image. Style 5 reads the GPU displacement texture back to the
CPU on a 4-frame cadence and applies bilinear-sampled forces to persistent per-particle offsets; style 4
computes force CPU-direct, assigning each particle one weighted-random IFS transform (chaos game) and
re-rolling one particle every two frames so branches evolve organically. `transMapWarpMix` controls the
image-space warp independently of `transMapForceBlend`.

### Trail Accumulation

Persistence/trails are achieved by decaying the previous frame rather than clearing. `decayFactor = MotionBlur / 8.1` controls fade speed (0 = instant clear, ~0.86 = long trails). When `SmoothFilter` is active, a 3×3 gaussian blur softens the trails each frame.

### Material System (Phase 5)

Per-particle temperature-driven rendering. 8 material presets (Plasma, Fire, Ember, Smoke, Fog, Ice, LiquidLight, Organic) with configurable parameters:

- **Heat Modes**: Velocity (relative min/max), Position (spatial low-freq), Age (cyclic 6s period)
- **Rendering**: Core brightness + halo strength with radial falloff, temperature-to-colour ramp lookup
- **Colour Ramps** (7): fire, ice, liquid, organic, smoke, fire-phase (9-point:
  transparent→smoke→ember→flame→white-hot), fire-smoke (flame → smoke transition → transparent)

**The parameter model was corrected by Batch M (2026-08-08).** Four `MaterialConfig` fields did not mean
what their names or values implied, because the heat-integration fix had silently repurposed them and
nothing was re-tuned afterwards — tuning values before fixing this would have been tuning against broken
axes:

| field | was | is |
|---|---|---|
| `emissionIntensity` | delivered **2.00 at 500 particles and 0.14 at 20 000** from one authored value | honest at the library median scene |
| `velocityStretch` | **inert above 1.0**, but the slider ran 0–6 | 0–1, all of it live |
| flame aspect | read a **normalised** vector, so `speed` was always 1.0 | reads real per-particle speed |
| `coolingRate` + `dissipation` | **two knobs for one dimension** | one `thermalLag`, in seconds |

**⚠️ `thermalLag` is in SECONDS and is frame-rate independent — the old pair were not.**
`coolFactor = pow(0.5, dtSec / thermalLag)`, so after `thermalLag` seconds temperature has closed half the
gap to its driver, at any refresh rate. The old `dissipation^(1 + coolingRate*2)` was a per-frame constant,
which made the same material cool **2.4× faster at 144 Hz than at 60 Hz**. `MigrationLayer.migrate()`
converts old exports by inverting the old formula at 60 fps, and guards `dissipation` outside (0,1) rather
than emitting NaN (which would blank the material). Note `SparkConfig.coolingRate` still exists and is a
**different field on a different type** — deliberately not renamed, since a global rename would take it.

**⚠️ `emissionIntensity` damping: the EXPONENT is load-bearing, not the reference point.** The shader damps
additive output by `pow(refOverlap / overlap, 0.25)`, where `overlap = particleCount * splatRadius² * 1e-4`.
Damping is genuinely needed — additive blending sums every overlapping splat — but the old
`1 / sqrt(overlap)` made the authored number meaningless. **Re-normalising alone achieves nothing:**
`sqrt(ref/ov) = sqrt(ref) · (1/sqrt(ov))` and `sqrt(ref)` is a constant, so every scene-to-scene ratio is
unchanged (measured across 8 scenes the spread stayed at exactly 6.40×). Only weakening the exponent
compresses it — 0.25 gives 2.53×. The reference is **4 000 particles at radius 10**, the measured library
median (75 of 177 presets); 2 000 is only the p10. The lift is clamped to **1.5×** so a sparse scene cannot
be amplified until it clips on its own. A guard in `mtest.mjs` asserts that re-normalising at the old
exponent leaves the spread identical, comparing **unclamped** values so the `min()` clamp cannot be credited
with an improvement the normalisation did not make. The **point** path has no equivalent compensation.

**Temperature saturation is fixed and is now impossible for `heatGain <= 1`.** `material.ts` applies
`heatScale = 1 - coolFactor` to every driver, making the steady state exactly `driver * heatGain`,
independent of the cooling parameters. So `heatGain` is an honest **peak temperature** control and
`thermalLag` affects **only lag, not range**. The one surviving limit is deliberate: the velocity driver's
`HEAT_FLOOR` (0.05) floors the coldest particle at `0.05 * heatGain`, and `heatGain > 1` can still clamp by
construction. Because a hand-tuned combination can still saturate, **never assume `temperatures[]` has
spread** — `CrystalPool.advance()` compares *relative* heat against the population's own per-frame min/max
for exactly this reason, and a degenerate zero-spread range disables early melt rather than melting
everything.

**Which behaviours a material switch turns on is decided by two ALLOW-lists** in `material-presets.ts`.
`FIRE_BEHAVIOUR_MATERIALS = ['Plasma','Fire','Ember','Smoke']` gets buoyancy + sparks;
`CRYSTAL_MATERIALS = ['Ice']` gets crystals; everything else gets neither — **including the disable
direction**. Both lists are positive so a *new* material defaults to no automatic behaviour; the old
negative form (`everything except COLD_MATERIALS`) silently gave fire buoyancy and sparks to `Organic`,
`LiquidLight` and `Fog`, none of which is combusting. And crystals must be **disabled** as well as enabled —
`Ice → Organic` used to leave the hard-edged, alpha-occluding crystal pass drawing over a soft organic
material. A single switch looked fine and only a *sequence* misbehaved, which is why the guard suite
simulates sequences.

### Fire & Buoyancy System (Phase 6)

Temperature-driven particle dynamics that make hot particles rise and spawn sparks:

**Buoyancy (FireProcessor):**
- Persistent per-particle Y offsets (same pattern as physarum/fluid advection)
- Upward force = `strength × temperature × dt` (normalized)
- Exponential return decay: `offset *= (1 - returnForce × 0.15)^dtNorm`
- Random lateral turbulence for flame flicker
- Max offset safety clamping (default 200px)

**Spark Pool (SparkPool):**
- Pre-allocated 500-particle buffer with independent Newtonian physics
- Spawns when wave particle velocity exceeds threshold (per-frame budget limit)
- Independent gravity (200px/s²), linear drag, half-life cooling
- Swap-with-last compaction for dead sparks (no GC pressure)
- Concatenated with wave particle state for unified rendering

### Volume Render Mode (Phase 6)

2-pass Beer-Lambert absorption pipeline for volumetric smoke/fog effects:

```
Pass 1: Additive density accumulation into RGBA16F FBO
         (point sprites with Gaussian falloff × temperature colour × depth fade)

Pass 2: Full-screen Beer-Lambert resolve
         opacity = 1 - exp(-extinction × density)
         colour = rgb / density (density-weighted average)
```

Configurable: extinction (0.1–10), densityScale (0.1–5), depthFade (0–1), velocityStretch (0–2).

### Dye Field (Phase 6)

Extends the fluid advection system with a colour texture:

- RGBA16F ping-pong dye FBOs (512×512)
- **Injection**: Point-sprite colour splats from particle temperatures (or fixed/velocity source)
- **Advection**: Semi-Lagrangian displacement by the existing velocity field
- **Composite**: Screen-space alpha overlay (configurable opacity and decay)

Visible in Visual FX tab only when fluid advection blend > 0.

### Fire Presets (Phase 6)

5 curated presets demonstrating the fire pipeline:

| Preset | Character |
|--------|-----------|
| Lissajous Flame | Classic fire with rising buoyancy and active sparks |
| Attractor Fire Cloud | Lorenz-blended ember cloud with high turbulence |
| Julia Burn Rivers | Fractal flow with plasma material on fire-phase ramp |
| Hopf Fire Ring | Toroidal ring with IFS fractal feedback + gentle buoyancy |
| Ember Storm | High-particle chaotic storm with curl noise + max buoyancy |

## Preset Format

Presets are loaded from the legacy `psss_presets.json` and converted to `UnifiedPreset` by `MigrationLayer`. Key fields:

- `ParticleCount` × 5 → actual particle count. **This multiplier is on the v1 migration branch only**,
  guarded by `metadata.version === 2` — a v2 preset (anything the engine itself exported) carries
  `generators.particleCount` verbatim, and the Visual FX **Particle Number** slider writes an absolute
  value, not a multiple
- `Waves[3][3]` → 3 waves, each with 3 axes (Phase, AM{Base,Amp,Freq}, FM{Base,Amp,Freq})
- `WaveSpeed` → animation speed
- `Rotation[3]` → rotation speed per axis (degrees/second)
- `Angle[3]` → **initial** orientation per axis (degrees), distinct from `Rotation`
- `MotionBlur` (0–8) → trail decay factor
- `SmoothFilter` → enable 1px gaussian blur on trails
- `RenderMode` (0/1/2) → pixel/blend/star
- `TransMapFilter` + `TransMapStyle` + `SinMagicParams` → displacement effect
- `TransMapMode` (0 = `tmmApplyBefore`, 1 = `tmmApplyAfter`) → `postProcessors.transMap.beforeParticles`,
  i.e. whether the warp runs before the particles are drawn or after. ⚠️ **Added to this list on 2026-09-18,
  when the migration was fixed to read it** — it had read `TransMapBefore`, a name absent from all 177 legacy
  entries, so every preset arrived warp-last regardless of what it authored. The explicit override is still
  read first (`TransMapBefore !== undefined ? … : TransMapMode === 0`), and **nothing in the tree writes it any
  more**: `presets/pass-order-pins.ts` was its one writer and is **DELETED (2026-09-19)**. ⚠️ **A fifteen-preset A/B review ran
  on 2026-09-18 and is CLOSED**: each affected anchor shipped a `" warpfirst"` copy carrying the authored order,
  and the owner's verdict was to keep the pre-fix (warp-last) look everywhere and delete all fourteen copies.
  The pins held whichever anchors still shipped a RAW legacy body, and that split moved with every settle batch —
  12 / 3 on 2026-09-18, 13 / 2 on 2026-09-19 — until the fifth settle batch that day settled the last two
  (`Symbol Of Infinity Transformed`, `The Masters Light`) and **the file deleted itself per its own exit rule.
  All fifteen now AUTHOR their own `beforeParticles: false`.** ⚠️ **The shim's disappearance is not the end of the
  subject** — `fieldcheck` §U kept the load-bearing clause by GENERALISING it: it prints `all 15 enabled mode-0
  anchors ship a SETTLED body` and separately asserts each one *would* flip to warp-first if its settled body were
  removed, so the `false` is provably the author's. A sixteenth anchor arriving unsettled fails there; the repair is
  to settle it, or to re-open the pin file from the project's engineering log, never to widen the clause.
  ⚠️ **Most of those pairs looked identical and that was arithmetic,
  not a broken migration**: warp-last is warp-first with one extra warp applied to the whole frame, so the
  visible size is `peak step × (1 − decayFactor)` — 76.7 on `Millenium Falcon` against 0.4 on `Black Hole`,
  whose 81-frame trail already contains 81 such steps. The ranked table was `pass-order-pins.ts`' header and is
  preserved verbatim in the project's engineering log, kept as the evidence the verdict was given on. ⚠️ **So NO shipping preset demonstrates warp-first** — the
  bodies that resolve `beforeParticles: true` all have the warp disabled (`fieldcheck` §U measures both,
  and `coveragecheck` §E reports the leaf as `0 live of N true` for the same reason — a plain boolean scan of
  the bodies reads it as covered, which is why that leaf has a resolver of its own),
  which is why plan `21.6g` commissions a purpose-built demo
- `Width/Height` → design resolution (amplitudes are scaled relative to this)

### `Angle` (initial orientation)

`Angle[3]` seeds `LissajousGenerator.angle` and is applied by the same rotate-X → rotate-Y
→ rotate-Z pipeline as `Rotation`; the difference is that `Angle` is a one-off starting pose
while `Rotation` accumulates per frame. 25 of the 177 legacy presets carry a non-zero `Angle`.

It is load-bearing, not cosmetic. `Scanner` has **no Y wave at all** (all three Y axes are
zero), so every particle has `y = 0` and its entire vertical extent comes from the Z wave
being rotated into view by `Angle[0] = 90`. Its `Rotation` is `[0, 1, 0]` — a spin about Y,
which can never *create* Y extent. With `Angle` dropped, `Scanner`'s bounding-box height is
exactly 0 forever and it renders as a flat horizontal line.

> **Divergence from the legacy app.** The legacy `psss.js` also ignores `Angle`
> (`ParticleWaves.applyPreset` at `psss.js:1559` assigns `rotationSpeed3d` but never
> `angle`, leaving the `[0,0,0]` initialiser at `psss.js:1184`). `Scanner` is therefore flat
> in the original app too — this was a long-standing data-path bug, not a port regression.
> The engine now honours `Angle`, so these 25 presets intentionally render differently
> between the two. Legacy files are not modified.

## UI Layout

The default view is a split-screen layout:

```
┌─────────────────────┬──────────────────────────────────┐
│                     │ [Search...][Export All][Import][Lab]│
│   Active Preset     │ ┌───┐ ┌───┐ ┌───┐               │
│   (Live Preview)    │ │   │ │   │ │   │               │
│                     │ └───┘ └───┘ └───┘               │
│                     │ ┌───┐ ┌───┐ ┌───┐               │
│   Click to toggle   │ │   │ │   │ │   │               │
│     fullscreen      │ └───┘ └───┘ └───┘               │
│                     │           ... scroll             │
└─────────────────────┴──────────────────────────────────┘
```

- **Left panel**: Active preset rendered at full quality (HDR pipeline)
- **Right panel**: Switchable between Preview Grid and Synthesis Lab
- **Preview Grid**: All presets as live animated tiles (256×192 @ 15fps). Header: search, Export All, Import, Lab buttons.
- **Search field**: Displays current preset name; on focus + 2+ chars, filters both dropdown and grid (case-insensitive). Clear (×) or Escape cancels search.
- **Export All**: Downloads all presets as `psss_presets_YYYYMMDD_HHMMSS.json`.
- **Import (Grid)**: Opens file picker → name-edit dialog → prepends preset to top of grid, selects and scrolls to it.
- **Fullscreen**: Click left panel for native browser fullscreen; click again or Escape to restore split view

**Lab header buttons**: Reset, Snapshot, Export (single preset, `<name>_YYYYMMDD_HHMMSS.json`), Import (same dialog, navigates to Grid on confirm), Grid.

**Synthesis Lab — count `TAB_DEFS` in `ui/synthesis-lab/panel.ts`; as of 2026-10-05 it is 10**, in the
owner's order of 2026-10-05: Reel, Visual FX, Materials, Composer, Transmap, Sliders, Mixer, Randomise,
Evolution, History. Every tab switch captures the working preset as that tab's **entry baseline**; Reset
returns to it and also resets all Visual FX overlay state.

⚠️ **The order is NOT cosmetic any more: the Lab opens on `TAB_DEFS[0]`, i.e. the Reel** (owner,
2026-10-05 — presentation first, then authoring, then exploration). `panel.ts` hardcoded `'mixer'` at both
default sites until that date, which was correct only because Mixer happened to be first, so the reshuffle
turned a latent drift into a visible one; both sites now read the table. **The Reel moved from LAST to
FIRST**, reversing Phase 19, which had itself reversed Phase 16's "never move the Composer off LAST" — all
three were owner calls, so do not "restore" either earlier order. `?tab=<TabId>` still overrides the
default, and registration order is deliberately NOT the bar order (tabs are registered grouped by their
`config` guard, so the bar can show more tabs than the registry holds — the opening switch resolves to the
first entry that actually has a module).

⚠️ **This line read "8 tabs" and listed eight, having missed the Composer, Transmap and Reel as they were
appended, and then listed Archetypes after that tab was deleted.** A stated tab count has now been wrong
in both directions, so it is given with a date and an instruction to count. (Earlier history, still true:
there were 9 until v8 Phase 8a-3 folded the Crystal tab into Materials as its Crystals section, beside
Buoyancy and Sparks. The Archetypes tab was removed on 2026-10-04 as obsolete — see the manual's §25.)

**Visual FX — Particle Number (added 2026-08-12).** The one Visual FX control that does *not* write
`overlay`. 1–50 000 on a **cubic** track, `pos = ((count − 1) / 49999)^(1/3)`, so 1–2 000 gets 34 % of the
travel while 20 000–50 000 is compressed into the top 26 %. Two design points worth not re-deriving:

- **It writes `preset.generators.particleCount`, deliberately, not a new `overlay` field.** That field
  already exists and already has **five mutating consumers** — Mixer interpolation, Randomiser jitter,
  Evolution crossover, the Sliders tab's Density multiplier and `preset-stats` collection. ⚠️ **This read
  "six … Archetype patches" until 2026-10-06; the Archetypes tab was REMOVED on 2026-10-04, so the sixth
  consumer no longer exists.** The argument is unchanged and does not rest on the count — an `overlay` twin
  would make two sources of truth for one number and force every consumer to arbitrate — but **a count in a
  rationale is a figure, and it goes stale the moment a consumer is deleted.** Accepted consequences, all correct: the value survives Export, the Mixer interpolates it,
  Density multiplies against it, and preview tiles follow automatically. The getter reads the **generator**,
  not the preset, because the generator holds what is actually being drawn.
- **⚠️ It resizes in place — `dispose()` + `init()` is wrong for a live slider, and so is re-`init()`ing any
  sub-processor.** `LissajousGenerator.init()` resets `pos` to 0 and re-reads `angle`, so a drag would snap
  the figure back to its opening pose on every step. Hence `setParticleCount()`, which grows the 9
  per-particle arrays and truncates on shrink. A slider fires on **every** `input` event, so anything
  reconstructed here is reconstructed dozens of times per drag — which is why the discipline had to be
  pushed into four sub-processors: `FireProcessor.resize()` and `MaterialProcessor.resize()` were added for
  this, `PhysarumProcessor.resizeHeadings()` alongside the existing `resetHeadings()`, and
  `initAttractorState()` gained a `fromIndex` so only a grown tail is seeded. Each failure is a *whole
  population* resetting at once: buoyancy offsets snapping home, temperatures re-warming from cold, every
  physarum particle losing the filament it had turned onto, the attractor cloud collapsing to its starting
  spiral. Three things are deliberately left alone — `FireProcessor.noisePhase` is *extended* with its true
  per-index values (zeros would give every new particle identical turbulence, reading as a coherent sheet),
  the cluster-force arrays are grown only if already allocated (zero-length *is* the disabled state), and the
  crystal pool is neither resized nor reset (its capacity comes from `crystal.poolSize`, and resetting it
  would demolish and re-grow the whole ice structure dozens of times per drag).
- **Anything added to `setParticleCount()` must be checked the same way:** ask what the field *accumulates*,
  not merely whether it ends up the right length.

**Figure Scale** is the neighbouring control and takes the **logarithmic** `sliderMul` curve
(`2^(log2(5)·(2v−1))`, 0.2×–5.0×) instead, reused from the Sliders tab so the two feel identical. That curve
is symmetric about a centre of 1.0, which is meaningful for a multiplier and meaningless for an absolute
count — which is why Particle Number is cubic. A pure log map was measured and rejected there: it hands 42 %
of the track to 1–100, below the point where a Lissajous figure reads as a curve at all.

### Preview Grid Tile Renderer

Each visible tile runs a **REDUCED** pipeline at reduced scale — not the full renderer. It supports the
Lissajous generator, materials (splat + colour ramp), a film look's **palette and `paletteMapping`**
(added 2026-08-12, D16), TransMap, the fluid sim, and trail decay/blur.

It has **zero references to**, and so silently ignores: `NeonLineRenderer`, `RibbonRenderer`,
**crystals** (`setCrystalConfig` is never called), film-look **grading** (exposure, lift/gamma/gain,
saturation, vignette, DoF, lighting), bloom, tone-map curves, physarum, curl noise, attractor blending,
and `preset.fractal` (so a Julia/Mandelbrot preset shows a plain Lissajous figure — the "rivers" of
`Julia Burn Rivers` are its whole point). A preset that ships any of those in its `overlay` will preview
inaccurately — `Miracle Frost` declares `linesEnabled: true` *and* a crystal block, so its tile shows
the warped figure with its ice material but neither the neon trails nor the faceted ice, and reads as a
different preset. Invisible until presets started shipping overlays that had been Lab-only runtime
state.

Deliberately not fixed (decided 2026-08-05, **re-affirmed 2026-08-07 as triage C7** after the divergence
was raised explicitly): 177 tiles make per-tile cost the binding constraint on the whole grid. Tiles
identify a preset; they do not preview its final look. This is a **won't fix, not a deferral** — both
halves were declined, adding crystals *and* decoupling `perspectiveZ` from tile dimensions. Crystals
would still be the most tractable single win if the trade were revisited (the pool already publishes
`frozen`/`crystalCount`/`growth`, and the crystal pass is one `uRenderPass == 3` branch), but re-opening
should require a fresh report of tiles being *unusable for identification*, which is the only thing they
are for. Do not re-litigate it from the observation that a tile looks unlike its preset — that is the
accepted cost.

Two further intentional divergences: trail decay is clamped to `MAX_TILE_DECAY = 0.96` (a tile renders
one frame per `stepFrames`, so a high `decayFactor` accumulates far more than at full rate — 0.9877
gives ~21x versus ~2x typical), and particle count is capped at `MAX_TILE_PARTICLES = 2000` after the
`/4` divisor so a 20 000-particle preset is not 5x the cost of a typical tile.

**⚠️ Screen-space parameters must be scaled by `SCREEN_SPACE_TILE_SCALE`, and ONLY those (D14).** Spark
physics runs *after* the perspective projection in `lissajous.ts`, so it integrates in the pixel space of
whichever canvas it is drawn into — a 256×192 tile, not a 1024×768 view. One shared constant,
`(TILE_W + TILE_H) / (1024 + 768)` = **0.25**, scales `material.splatRadius`, `buoyancy.maxOffset` and
`sparks.gravity`; nothing else qualifies. **Decide by UNIT, not by field name:** `sparks.ejectionSpeed`
reads like a velocity but is a *dimensionless* multiplier on `dx * 30`, where `dx` is already a tile-pixel
delta, so scaling it would make tile sparks 4× too slow — likewise `drag`/`coolingRate` (1/s), `threshold`
(normalised to `velRefEMA`, resolution-independent by construction) and the two lifetimes (seconds). The
old buoyancy factor was `TILE_H / (designResolution.height ?? 720)`, which divides **pixels by authored
model units** — 1.92 for a legacy 100×100 preset (all 177 of them) — and so *amplified* tile buoyancy
rather than reducing it.

**⚠️ The ADDITIVE splat path needs a brightness compensation, and it is capped (D15).** Reported as
*"Julia Burn Rivers is almost black in the tile preview"* — measured mean frame luminance **10/255 against
the main view's 159/255**. Two independent causes, multiplying:

- **The premultiply was unconditional.** The tile emitted `vec4(col * a, a)` in both blend modes, but under
  `ONE, ONE` the GPU never reads alpha, so scaling RGB by `a` applied `shape` a **second** time *and*
  applied the ramp's authored alpha curve where the main renderer deliberately does not. Now gated on
  `uIsAdditive` the same way. The loss was shape- and temperature-dependent, so it **distorted the ramp**
  rather than merely dimming it — cold particles have both a low `shape` and a low ramp alpha and were
  suppressed hardest: **5.45×** on `Julia Burn Rivers` against ~1.40× on the four fire presets, which is
  why that one preset read as black while the others merely looked dim.
- **Nothing compensated the lost light.** `PARTICLE_DIVISOR` cuts the count to ¼, and in the splat path the
  sprite radius is *also* scaled by `SCREEN_SPACE_TILE_SCALE`, so the sprite-area ratio `S²` = 0.0625
  exactly equals the tile/main frame-area ratio — **the two cancel**, leaving the luminance ratio equal to
  the *count* ratio. Separately, trail gain is `1/(1 − d^stepFrames)` against the main view's `1/(1 − d)`.
  Hence `splatBrightnessFor()` = `(1 − d^N) / ((1 − d) · countRatio)`, folded into `uEmissionIntensity`.
  **⚠️ `N` here is the MEASURED step (`stepFrames`), not the `FRAME_SKIP` constant, and that is deliberate:
  this figure compares the tile to the MAIN VIEW, which renders every frame at whatever the live refresh
  rate is, so the live count is the correct one. `uBrightness` asks a different question and must NOT take
  the bare count — see `trailBrightnessFor()` in `grid-tile-renderer.ts`.**

Three constraints, each of which makes a wider fix wrong: **additive only** (alpha blending converges to a
bounded weighted average, so a 13× lift there would drive `a` to 1.0 and make every particle opaque — the
old `Miracle Frost` solid-white failure); the **non-splat path is deliberately untouched** (modes 0/1/2 keep
a *fixed* `gl_PointSize`, so their sprite-area ratio is 1.0 and by the same metric they are ~5× too
*bright*, which has been the accepted appearance of 167 of the 177 legacy presets for the life of the grid);
and **capped at `stepFrames × PARTICLE_DIVISOR`** (16 at 60 Hz, 32 at 120 Hz — the cap tracks the step for
the same reason the numerator does), above which `MAX_TILE_PARTICLES` has truncated the
count so the figure is genuinely *sparser* — brightness cannot recover lost structure.

**⚠️ Tiles DO apply a film look's palette and `paletteMapping` — but nothing else about the look (D16).**
Reported immediately after D15 as *"now brightness looks good, however the colors are wrong"*. **Two axes
had diverged, not one**, which is why forwarding the LUT alone would have fixed only half of it: the colour
**source** (palette vs material ramp) *and* the palette **index** (`phase` vs temperature).

- **Applies to BOTH paths.** The point path takes the palette too, matching the main renderer's precedence
  table. `state.depths` and `state.velocities` are new `aDepth`/`aVelocity` attributes, uploaded on **every**
  draw — every enabled attribute in a VAO is read by every draw that binds it, so a buffer left short by a
  previous larger slot would under-size this one, and **ANGLE then drops the whole draw with no JS
  exception** (a black tile).
- **The four live mappings are byte-identical to the main shader** and must stay that way: collapsing any
  two makes the corresponding looks render identically, which reads as *"the palette control does
  nothing"*. In particular `phase` must take the preset's own oscillating colour, **never** the ramp colour,
  which is already temperature-indexed.
- **Mappings 3 and 5 are degraded on the CPU**, in `tilePaletteFor()`, so the shader never sees them. `age`
  (5) → `temperature`, because it needs `state.lifetimes` — the one `GeneratorState` array not extended to
  `count`, hence the same silent-black-draw trap. `temperature` (3) → `velocity` when no material is
  running, since `temperatures[]` would be all-zero and every particle would sample LUT index 0.
- **Inert for all 177 legacy presets, by construction** — none has an `overlay` block, so all default to
  `Legacy`, one of only three `palette: 'none'` bundles.
- **⚠️ The particle program now has TWO `sampler2D`s, which changes the binding rules.** Both are assigned
  their unit **unconditionally** and a texture is always bound to each — a 1×1 white `fallbackTex` stands in
  when a slot has no ramp or no palette. An unassigned sampler defaults to unit 0 and collides with
  `uRampTex`, an incomplete unit samples black, and in a multi-sampler program some drivers then resolve the
  **entire draw** to black. The bind-inside-the-branch pattern that was safe here before D16 **is not safe
  now**, and `activeTexture` is restored to unit 0 afterwards because the fade/blur/blit passes bind by unit.

So a tile's hues now match the main view while its brightness and saturation still differ — the scope
chosen, and consistent with C7.

Pipeline details:
- Per-slot RGBA16F ping-pong FBOs (`MAX_SLOTS = 32` preallocated)
- Decay + blur → particle rendering (render-mode aware) → TranslationMap
- IntersectionObserver triggers slot acquire/release on scroll
- Exponential tone mapping on readback (HDR → LDR without saturation)
- Step-corrected decay (`decayFactor^stepFrames`) and brightness compensation

**Scheduling.** All tile work is metered by wall-clock time rather than by fixed counts, so
the grid fills as fast as the machine allows instead of at a fixed rate. **⚠️ Rewritten
2026-09-24: each budget is a DUTY CYCLE — a fraction of the measured frame
(`frameSliceMs(duty)` = `duty × frameMsEma`) — and the steady gate is `SlotState.sinceStepMs`
against `TILE_STEP_INTERVAL_MS`, per SLOT rather than per grid.**

| Phase | Duty | Derived against | Cadence |
|-------|------|-----------------|---------|
| Math warm-up | `MATH_WARM_DUTY` = `MATH_WARM_BUDGET_MS / NOMINAL_FRAME_MS` = 0.24 | the FRAME | **every frame** — pure arithmetic, no GL |
| GL warm-up | `GL_WARM_DUTY` = `GL_WARM_BUDGET_MS / TILE_STEP_INTERVAL_MS` = 0.18 | the STEP INTERVAL | every frame while any slot is warming, round-robin |
| Steady state | `STEADY_DUTY` = `STEADY_BUDGET_MS / TILE_STEP_INTERVAL_MS` = 0.15 | the STEP INTERVAL | per slot, on `sinceStepMs ≥ TILE_STEP_INTERVAL_MS`, from a rotating cursor |

**⚠️ The two divisors are different and not interchangeable.** The maths pass runs every
frame, so its budget is a share of a FRAME; the two GL passes run once per step interval, so
theirs is a share of THAT. Swapping them scales the pass by
`TILE_STEP_INTERVAL_MS / NOMINAL_FRAME_MS` (≈ 4) with nothing to say so.

**Why a duty and not the absolute ms it used to be.** A duty delivers
`duty × frameMs × fps === duty × 1000` ms of tile work per second **at any refresh rate**;
the absolute form delivered `budget × stepsPerSecond ÷ tiles`, so on a 120 Hz panel it cut
tile throughput to a **quarter** while the old shared `FRAME_SKIP` gate simultaneously ran the
tiles at an unintended 30 steps/s at double the cost. And **15 % of a frame cannot drop a
frame**, which the old whole-grid lump could — the per-grid gate put every tile's step on the
*same* frame, which is how the grid's cost arrived as a hitch rather than as a cost.

- **Math warm-up** (`MATH_WARM_FRAMES = 40`) exists only to step off frame 0, where 41 of
  177 presets occupy ≤1 cell of a 16×16 occupancy grid at tile scale. The degenerate case is
  `Am.Base == 0`, which evaluates to `sin(0)*amp == 0` for every particle (10 presets have
  this on every axis). By frame 40 only 5 remain collapsed, and those are `perspectiveZ`
  culling cases (see Known Issues), not warm-up failures.
  It is *not* a convergence mechanism: the AM/FM modulators
  have a median period of ~7200 frames, so no realistic warm-up "develops" the pattern —
  the tile animates through it live. Drained depth-first (a partially warmed tile cannot
  be shown, so completing tiles one at a time releases them soonest).
- **GL warm-up** (`warmupFramesFor(decay)`, capped by `GL_WARM_FRAMES_MAX = 10`) pre-builds
  just enough trail to make a shape readable while scanning the grid — targeting ~50% of
  steady-state brightness, not ~95%. Advances the sim by `effectiveDt`, matching the steady
  pass; stepping a single frame here while the decay pass applies `decayFactor^stepFrames`
  would build a shorter trail than the tile then settles into.
- **Steady state** renders every settled tile, then `blitToCanvases()` reads back only
  tiles flagged `needsBlit`. `readPixels` is a synchronous GPU→CPU stall and the bulk of a
  tile's cost, so skipping unchanged tiles is the main saving; a tile the budget skipped
  keeps its last frame rather than paying to re-read identical pixels.
- **⚠️ The readback is the one pass that must NOT be spread across frames.**
  `blitToCanvases()` is batched into one burst per `TILE_STEP_INTERVAL_MS` (`blitPending` +
  `blitAccumMs`) while the *renders* stay spread by the duty cycle. Spreading the blits too
  made the grid **2.5× dearer** — measured `Chemical` 4.93 → 12.5 ms — because the cost is per
  SYNC POINT, not per pixel: the first `readPixels` of a frame waits for the main view's queued
  GPU work, so *n* blits on one frame pay that latency once and on *n* frames pay it *n* times.
  **A stall does not divide.** Spreading the renders *is* free, and the reason is a property of
  the subject: **nothing about a tile's appearance depends on which frame of its step it renders
  on** — only on how many main-loop frames the step spanned (`stepFrames`).
- **Adaptive slot cap.** Per-tile cost (render + readback) is EMA-smoothed and the
  concurrent-slot ceiling derived from it, but floored at
  `max(visibleTiles + VISIBLE_SLOT_HEADROOM, MIN_SLOT_CAP)`. The cap must never fall below
  what is on screen: every acquire beyond it evicts a tile the user is looking at, which
  then freezes on its last painted frame (`releaseSlot` does not clear the canvas). Cost
  therefore governs only prefetch depth above the viewport.
- **Slot exhaustion evicts, never refuses.** `acquireSlot` releases the least-recently
  acquired slot when the pool is dry. Returning early instead is what previously left
  tiles permanently black.
- **Observer ordering.** `PreviewGridPanel` drains all releases before any acquire within
  a single IntersectionObserver callback. One callback can carry both directions, and
  interleaving starves trailing entries of capacity that outgoing tiles are about to free.
- **`PerfGuard` gates all four tile renderers, and it THROTTLES before it freezes** (rewritten
  2026-09-24). Three levels: 0 normal, 1 tile cadence ÷ `TILE_THROTTLE_SCALE = 3` below
  `FPS_THROTTLE_IN = 30` (recovering at `FPS_THROTTLE_OUT = 45`), 2 tiles stopped below
  `FPS_FREEZE_IN = 15` (recovering at 22). Level 1 exists because **freezing is what produced
  the user-visible complaint** — a frozen tile has no warm-up left to finish, so the grid
  stalled *while filling*; `GridTileRenderer` therefore **exempts a grid with warm-up still
  pending** from the throttle, since filling the grid is the work the user is waiting on.
  **⚠️ A hysteresis band cannot damp an oscillation whose switch costs a FRACTION of the frame**
  — once the grid spends a duty cycle, its cost scales with the frame it is added back into, so
  no fixed band is provably wide enough. Hence an adaptive dwell on the **optimistic direction
  only**: `recoverDwell` doubles (cap 8) each time a recovery fails to hold and resets after
  `RECOVER_STICK_FRAMES = 600`. The down-shift is never dwelled. Constants and their
  derivations: the engineering notes kept with the project's design records (`ENGINE-NOTES`).

## Controls

| Input | Action |
|-------|--------|
| Arrow Right/Left | Next/previous preset |
| L | Cycle right panel: Grid → Lab → Grid |
| 1–6 | Switch film look (Legacy, Luminous, Cinematic, Neon, Ethereal, Dramatic) — the remaining 9 are selectable from the Visual FX tab |
| R | Cycle ribbon mode (Off → Hybrid → Streaks → Adaptive → Off) |
| A | Cycle attractor preset (Off → Clifford Classic → ... → Off) |
| +/- | Adjust attractor blend (0.0–1.0, step 0.1) |
| Click canvas | Toggle fullscreen / split view |

## Dependencies

- **Vite 8** — Dev server + bundler
- **TypeScript 6** — Strict mode, ES2022 target
- **Lit 3** — Web components (reserved for UI)

No runtime dependencies beyond the browser's WebGL2 API.

## Known Issues

- **Tile-scale perspective culling.** `perspectiveZ` is derived from canvas size as
  `-(width + height) / 2`, giving `-224` for a 256×192 tile versus `-840` at 960×720.
  Presets whose Z amplitude exceeds the tile's near plane have particles culled behind the
  camera (projected to `-10000, -10000`), so they briefly render as a dot or sparse cloud in
  the preview grid while looking correct in the main preview. Affects `Fire Storm`,
  `Eternal Fire`, `Hades On Fire`, `Burn Burn Burn`, `Dancing Elphes` (Z amplitude ~460–610).
  They self-recover within a second as the wave evolves. A real fix means decoupling
  `perspectiveZ` from tile dimensions.
- **`MAX_SLOTS = 32` ceiling.** A grid wider than ~32 concurrently observed tiles (roughly a
  1200×1000 viewport or larger, given `auto-fill, minmax(200px, 1fr)` plus a 100px
  `rootMargin`) exhausts the pool and thrashes via eviction. Raising it costs 768 KB of GPU
  memory per slot (an RGBA16F ping-pong pair) and lowers per-tile refresh rate, since
  `STEADY_BUDGET_MS` is shared across all live tiles.
- **Preset data divergence.** `psss-engine/public/psss_presets.json` intentionally differs
  from the git-tracked root copy used by the legacy app: six fully-static presets have faster
  `Rotation` (see Preset Format). The engine also honours `Angle` while legacy does not,
  affecting 25 presets. Legacy files are never modified.

## Status

- **Phase 1** — Complete. Full feature parity with legacy engine for all 177 presets.
- **Phase 2** — Complete. Modern rendering stack: HDR FBOs, bloom, tone mapping, depth shading, fake lighting, cosine palettes, palette mapping, film looks, ribbon renderer (3 modes, density-adaptive, teleport-safe), attractor generator (10 types, 35 presets, escape-flow grid matching legacy), model-space blending with rotation/perspective, TransMap proportional fade, state preservation across preset switches.
- **Phase 3** — Complete. Split-screen UI: preview grid with live animated tiles for all 177 presets, searchable preset dropdown (shows active preset name; filters grid + dropdown on 2+ chars; × / Escape to cancel), IntersectionObserver-based slot pooling (max 16 — *superseded, see the preview-grid performance entry below*), per-tile full rendering pipeline (decay/blur → particles → TransMap) with render-mode-aware shaders, incremental warm-up with frame budget, exponential tone mapping, Synthesis Lab integration with panel switching. Native browser fullscreen (click canvas) with correct canvas resize on viewport change — `LissajousGenerator.resize()` rescales wave amplitudes and projection params so particles fill the full screen in all layout modes. Mixer category locks now capture a blended snapshot on lock (not pinned to Deck A) and restore live interpolation on unlock. Deck A auto-updates to the active preset each time the Mixer tab is opened.
- **Phase 3** (cont.) — Evolution tab 3×3 grid upgraded to full `GridTileRenderer` pipeline (same per-slot RGBA16F ping-pong FBOs, decay/blur → particles → TransMap, render-mode-aware shaders, incremental warm-up, exponential tone mapping as the preview grid). `EvoTileRenderer` is superseded and no longer used at runtime. "Send to Evolution" from Mixer/Randomiser correctly initialises the tab before seeding (tab `init()` and `activate()` run before slot acquisition). Randomiser tab now has Restart/Back/Forward navigation through a local history stack; index 0 is the preset captured on tab entry; Restart jumps directly to index 0 (restores entry preset); Back/Forward step one entry at a time; all three buttons are disabled when already at the respective boundary. Slider tab: relative multiplicative controls (0.2×–5.0× per slider, center = 1× = no change); Speed slider controls `renderer.speedFactor` which scales animation `dt` in the render loop. Fullscreen now remembers whether the user was in Grid or Lab view and returns to that view on exit.
- **Phase 3** (cont.) — Lab panel Reset/History overhaul: Reset now restores the current tab to its entry-time preset and internal state (crossfader position, slider positions, randomiser history stack) without touching the History list. A new **Snapshot** button explicitly saves the current working preset to History (max 10 entries). History tab upgraded from color-swatch strip to a 2-column live animated tile grid (full `GridTileRenderer` pipeline, dedicated renderer instance). Clicking a history tile restores that preset as the working preset for further editing. A **Clear** button in the History tab deletes all entries. History is never modified automatically — only via Snapshot and Clear.
- **Phase 3** (cont.) — Archetypes expanded from 6 to 10 templates: Wire Frame (pixel mode, 800 particles, very short trails, exposes raw wave skeleton), Dark Matter (4 000 particles, very long trails 0.96, slow smearing on dark background), Starburst (star mode + bloom 0.7, depth size 0.8, neon look), Frozen (near-static waveSpeed 0.001, short trails, reveals pure geometric form). All archetype descriptions updated to precise technical strings (mode · particles · trails · glow · film look).
- **Phase 3** (cont.) — Export/Import: Lab **Export** button downloads current preset as `<name>_YYYYMMDD_HHMMSS.json`. New Lab **Import** button: file picker → JSON migration → name-edit dialog (duplicate-name rejection) → adds to library, prepends animated tile to Preview Grid (scrolls grid to top first so the slot is visible and correctly acquired by the renderer), switches to Grid view, selects preset. Preview Grid header gains **Export All** (`psss_presets_YYYYMMDD_HHMMSS.json`, all presets keyed by name) and **Import** (identical dialog, stays in Grid view). `importPresetWithDialog` and `exportAllPresetsJSON` shared from `export.ts` — no duplicated logic between the two entry points.
- **Phase 6** — Complete. Procedural Flow & Fire Materials: buoyancy forces (FireProcessor — temperature-driven upward offsets with exponential return + lateral turbulence), spark detachment (SparkPool — 500-particle pre-allocated pool with independent gravity/drag/cooling), volumetric smoke renderer (Beer-Lambert 2-pass pipeline in RGBA16F FBO), dye field (semi-Lagrangian advection extension to fluid system), fire-phase colour ramp (9-point: transparent→smoke→ember→flame→white-hot), full UI integration in Materials tab (buoyancy/sparks sections) and Visual FX tab (dye/volume sections), 5 curated fire presets (Lissajous Flame, Attractor Fire Cloud, Julia Burn Rivers, Hopf Fire Ring, Ember Storm). All new configs persist in `overlay` block and round-trip through export/import.
- **Preview grid performance & correctness** — Grid population reworked from blocking to budget-driven. Removed the synchronous 600-frame math spin from `acquireSlot` (measured ~33ms per tile, ~0.6s of frozen main thread for a screenful) in favour of time-sliced phases; math warm-up moved out from behind the `FRAME_SKIP` gate to run every frame (4× throughput at half the per-frame cost, since it issues no GL calls). Warm-up lengths cut to what the data justifies: math 600→40 frames, GL up to 120→10 renders (`warmupFramesFor` retargeted from ~95% to ~50% of steady-state trail brightness). Steady-state pass now budgeted with a rotating cursor, and `readPixels` skipped for tiles that did not re-render (`needsBlit`). Fixed four defects found along the way: (1) tiles at every 18th grid index stayed permanently black — `acquireSlot` returned silently when the slot pool was exhausted, and the IntersectionObserver interleaved acquires with releases so trailing entries never saw capacity that outgoing tiles were about to free; now releases drain first and exhaustion evicts the least-recently-acquired slot instead of refusing; (2) a contiguous band of tiles froze mid-animation — the adaptive slot cap was derived purely from GPU cost and could fall below the on-screen tile count, so each acquire evicted a visible tile, which then kept its last painted frame because `releaseSlot` does not clear the canvas; the cap is now floored at `visibleTiles + VISIBLE_SLOT_HEADROOM`; (3) GL warm-up round-robin computed `perSlot` as `GL_WARM_BUDGET_MS / nPending` — milliseconds divided by a count, a unit error that collapsed to 1 render per pass and starved the tail; (4) warm-up renders advanced the sim by a single frame while the decay pass applied `decayFactor^FRAME_SKIP`, converging to a shorter trail than the tile then settled into. `MAX_SLOTS` 16→32.
- **Legacy `Angle` field now honoured** — `MigrationLayer` never read `raw.Angle` and `LissajousGenerator` hardcoded `this.angle = [0, 0, 0]`, silently discarding the initial orientation of 25 presets. Catastrophic for `Scanner`, whose three Y axes are all zero: its entire vertical extent comes from the Z wave being rotated into view by `Angle[0] = 90`, and its `Rotation` of `[0, 1, 0]` (a spin about Y) cannot create Y extent — bounding-box height was exactly 0 forever, rendering as a flat horizontal line. Added `Angle` to the legacy type and migration output, `angle?` to `UnifiedPreset.generators`, and forwarded it at all three generator-init sites (`main.ts`, `grid-tile-renderer.ts`, `evo-tile-renderer.ts`). Legacy `psss.js` has the same bug (`applyPreset` at `psss.js:1559` sets `rotationSpeed3d` but never `angle`) and is deliberately left untouched, so these 25 presets now diverge between engine and legacy.
- **Preset rotation tuning (engine copy only)** — Six presets with no time-varying wave parameters (every `Am.Amp`/`Fm.Amp` zero, so rotation is their only geometric motion) had `Rotation` raised to complete a revolution in ~120s instead of 6–12min: `Moebius Paranoia`, `Subspace`, `Blue Spiralo`, `Cylinder`, `Fluid Metall`, `Patterns`. Vectors scaled proportionally (dominant axis → 3.0 °/s) so per-axis ratios and tumbling character survive; `Angle` untouched. Applied to `psss-engine/public/psss_presets.json` only — the git-tracked root copy belongs to the legacy app.
- **Growth systems removed (July 2026)** — The Phase 8 growth implementation (DLA + Reaction-Diffusion + L-System + Crystal Ornament, a `GrowthCompositor` with its own RGBA16F FBO, and a 9th "Growth" Lab tab) was rejected as visually unconvincing and largely deleted: ~2 200 lines removed across `growth-compositor.ts`, `crystal-ornament.ts`, `lsystem-processor.ts` and `tabs/growth.ts`, plus `LSystemConfig`/`CrystalConfig` and the `getGrowthConfig`/`setGrowthConfig`/`resetGrowth` accessors. The Lab is back to 8 tabs. `dla-processor.ts` and `reaction-diffusion.ts` are retained **dormant** — unreachable from any UI or the render loop and tree-shaken out of the production bundle — as source material for v8 Phase 8b; see `src/growth/README.md`. Post-mortem: the failure was *not* missing particle coupling (RD was fully coupled via deposit → simulate → sense-gradient → `rdOffsetX/Y` and still disappointed) but that every particle-influencing system in the engine terminates in the same smooth positional-nudge output channel, so a new field cannot yield a new visual category. The replacement design (irreversible frozen particle state + a hard-edged, alpha-occluding, faceted render pass) is v8 Phase 8a.
- **v8 Phase 8a — Faceted Crystal MVP** — First **irreversible per-particle state** and the engine's first **hard-edged, occluding** primitive. A particle can be *frozen*: it permanently stops moving (holding a stored screen position and skipping the wave equation plus every offset accumulator) and is drawn by a new crystal pass — a hexagonal kernel with a hard alpha cutoff, a 6-way quantised facet normal driving a specular glint, and premultiplied-alpha compositing so it **occludes** rather than adds light. This is deliberately the visual opposite of everything else in the library, which is uniformly soft, additive and luminous. Implemented as `uRenderPass == 3` inside the *existing* splat program (no second shader program), drawn back-to-front via a CPU depth sort on the per-particle `depths` array — the pipeline has no depth buffer, so painting order is the only route to correct overlap. Crystals are suppressed in every additive/material pass, so crystal **overrides** material for them and nothing is drawn twice. State is `overlay.crystal` — absent ⇒ the pass never runs and output is pixel-identical to a build without the feature. Pool contents are **never serialised** and reset on preset change (they are history, not parameters, and cannot interpolate in the Mixer). Pending a human go/no-go gate; if it fails, the six-step removal recipe in `research_paper_psss_fractal_v8.md` §8 deletes it.
  - **Phase 8a-2 — additive pool.** The original *destructive* model (freezing stopped a wave particle, so the figure developed holes where crystals appeared) was replaced by `CrystalPool` in `src/crystal/crystal-pool.ts`, which spawns **independent** crystals exactly as `SparkPool` spawns embers: nucleation only *reads* a wave particle's model position and the particle keeps flowing untouched. Crystals gained a lifecycle (nucleate → hold for a ±30%-jittered lifetime → melt, plus early melt above `meltThreshold`) and three birth rules (`slow` / `cold` / `random`). `freeze-modes.ts` and the debug `freezeMode`/`freezeFraction` fields were deleted with the old model. Crystals occupy the **trailing block** of the concatenated particle arrays, so the point and volume paths truncate their draw to exclude them — 8a's colour-zeroing trick was unsound, because a palette film look replaces `vColor` from the LUT and resurrected the zeroed dot on top of the ice.
  - **Phase 8a-3 — folded into Materials.** Once crystals had a lifecycle and a pooled population they stopped being a rendering *mode* and became a **material behaviour**, structurally the same kind of thing as sparks — so the standalone **Crystal** Lab tab was deleted and its controls re-homed as a third section of the **Materials** tab beside Buoyancy and Sparks, dropping the Lab from 9 tabs to 8. `buildFireSection()` was extended from sliders-only to also build dropdowns, sub-headers, hints and hand-built rows, all optional so the Buoyancy and Sparks call sites are unchanged. `overlay.crystal` was deliberately **not** renamed or nested under `overlay.material` (decision D-C), so old exports round-trip untouched. The **Ice** material was reworked in the same pass: it was a blue-tinted *flame* (`velocityStretch: 1.0`, additive blending, high emission — every cue saying hot gas), and is now `velocityStretch: 0` with alpha blending, a dimmer core and a rebalanced heat range, with its hard faceted look coming from the crystal pass, which selecting Ice auto-enables. Ice is also excluded from the fire behaviour bundle (`materialAutoEnablesFireBehaviour()`): auto-enabling buoyancy would give it strictly-upward temperature-proportional lift, ejecting sparks, and — because buoyancy sets a non-zero `smokeThreshold` — route its coldest particles through the hardcoded `fire-smoke` ramp. Crystals remain an **independent** toggle (decision D-A), so `Fire + crystals` (the Fire-Ice duel the `cold` rule exists for) and `Ice + buoyancy` both stay reachable by hand.
  - **Phase 8a-4 — selectable shapes and crystal size.** The single hexagon made growth read as *inflation* rather than accretion: a scale-invariant silhouette can only get bigger, so a cluster looked like a pile of ice cubes, and the fat symmetric hexagon actively *masked* the dendrites the pool was already producing (`growthAnisotropy` biases accretion along six axes). Added `CrystalShape` = `hexagon` | `plate` | `dendrite` | `prism`, dispatched by `crystalSDF()` on the `uCrystalShape` uniform, all 6-fold so they agree with both the facet quantisation and the accretion axes. `plate` (squashed hexagon + concentric growth rings) and `dendrite` (6-fold star whose arms and side-branches extend with `growth`) are **growth-driven**: internal detail scales with `growth`, so size earns complexity. `dendrite` is the default. Crystals also gained their own **`crystalSize`** (2–96 px, default 22) — they previously borrowed `MaterialConfig.splatRadius`, so with no material active they were pinned at 12 px and could not be resized at all. Because the shapes fill very different fractions of their quad (measured by SDF sampling on a 181² grid: hexagon 44 %, prism 24 %, plate 19 %, dendrite 17→36 % by growth), selecting a non-hexagon shape made crystals visibly *smaller* at an unchanged radius; `SHAPE_SIZE_COMPENSATION` applies a per-shape factor ≈ `sqrt(hexArea / shapeArea)` so one Crystal Size setting gives equal visual weight (verified 1.00–1.01×) and switching shape is a fair A/B. `maxGrowth` widened 3 → 6, since its old ceiling was tuned when growth alone drove apparent size. The radius is deliberately **not** clamped to `maxPointSize`: that limit is `ALIASED_POINT_SIZE_RANGE` (commonly 64) and applies to `gl_PointSize` sprites, but the crystal pass draws instanced `TRIANGLE_STRIP` quads, so clamping would have silently capped the slider at 64.
  - **Phase 8b.2 — cluster force field.** The co-evolution the roadmap asked for and never received: until now crystals and the curve ignored each other, so ice appeared beside the figure while the figure flowed straight through as if nothing were there. `CrystalPool.sampleClusterForce()` accumulates a model-space displacement for every live wave particle from nearby crystals, through a persistent `clusterForceX/Y` offset pair (the physarum/RD pattern). `clusterForce` is **signed**: negative = obstacle (particles deflect around the ice), positive = accretion bias (drawn toward it); `clusterForceRadius` and `clusterForceReturn` set range and how snappily particles return to their mathematical position. This is the only crystal feature that changes the **Lissajous figure itself** rather than only adding to the image. Placed as the LAST model-space stage before the rotation, since the field is sampled against crystal MODEL positions. Gated on `clusterForce !== 0`, with arrays allocated lazily. Two bugs were caught by testing the maths before wiring: the **sign was inverted** (both halves of the slider pushed the same way, because the accumulator sums directions pointing *away*), and **normalising magnitude by total weight cancelled the distance falloff** exactly — a crystal at the far edge pushed as hard as an adjacent one, then jumped to zero at the boundary. Now the direction is normalised while the magnitude carries the `(1 − d/r)²` ramp: verified 3.06 → 2.25 → 1.00 → 0.25 → 0.01 → 0 and density-independent (1 vs 20 co-located crystals give an identical push).
  - **Phase 8b.1 — hex lattice and 6-fold symmetry folding.** The step that turns fuzzy dendrites into recognisable *snowflakes*. `growthAnisotropy` already biased deposits along six axes, but only **statistically** — each arm grew by its own random walk, so arms were lumpy and asymmetric, and the cluster read as six separate lumps. `snapToHexLattice()` pulls deposits onto a shared hexagonal grid via **cube-coordinate rounding** (rounding axial q/r independently picks the wrong cell near hexagon edges, giving an "almost regular" lattice); `latticeSnap` lerps between free and snapped, so the control is continuous. `foldDeposit()` mirrors each deposit into the other five 60° sectors around its **seed**, making all six arms identical by construction. Lattice is anchored in absolute model space so neighbouring clusters share one grid; the fold is anchored on the seed so each cluster is its own snowflake. Verified numerically: snapping is idempotent, never exceeds the hex circumradius, and all six lattice neighbours sit at exactly `cell × √3`; the fold is an exact rotation (equal radii, 60° apart). Two correctness rules were needed — a snapped deposit is **re-tested for separation** (`occupiedNear`), because the snap moves it *after* it already passed the test and would otherwise reintroduce the invisible stacked-duplicate problem `MIN_SEPARATION_FRAC` exists to prevent; and `foldDeposit` **stops on a dry free list** rather than trusting the caller's budget, because a folded deposit costs 6 slots not 1, so the last budgeted iteration could force `acquireSlot()` to steal a live crystal, which then vanishes with no melt ramp (flicker, not erosion). Trades organic for formal, so both controls default to off.
  - **Phase 8b.4 — NOT done, and its "cheapest quality win" framing is stale.** The plan describes wiring `RDConfig.modulationTarget` as cheap because it assumed RD was live. It is not: `setRDProcessor` has **no caller anywhere**, RD appears in no UI tab, and `reaction-diffusion.ts` is not imported by `main.ts` — 828 dormant, tree-shaken lines. Implementing `modulationTarget` therefore means first reviving the subsystem end to end (instantiate, wire, build a Visual FX group, add the readback path), and RD was deleted *because it was visually disappointing*. The honest counter-argument is that driving colour/opacity/size is a genuinely different output channel from the smooth positional nudge the post-mortem blamed — but it is a subsystem revival, not a quick win, and was deliberately skipped.
  - **Phase 8a-5 — real 3D crystal shading.** Crystals read as "a group of 2D areas" for three compounding reasons, all in the shading rather than the geometry: the normal's Z was the **constant** `0.55`, so every facet on every crystal faced the same way; the only orientation was `vFacetAngle`, an **in-plane** rotation, so no crystal ever tilted toward or away from the camera; and both shading terms were purely **radial**, so every crystal wore the same concentric bullseye regardless of pose. Now the normal is reconstructed from the **SDF gradient** (`dFdx`/`dFdy`) with a bevel profile (rim normals lean outward, interior normals face the viewer), quantised per-facet and blended by `facetSharpness`; a **per-crystal 3D tilt** foreshortens the quad so silhouettes genuinely vary, seeded from the birth velocity direction — stable, because the pool writes it once at nucleation and slot indices are stable, whereas `gl_InstanceID` would shift every frame under the depth sort and make the pose flicker. Added **diffuse terracing** (quantised light response — the cue that says "flat faces meeting at angles"; a smooth ramp reads as a sphere however good the normal is), a **fill light** so faces turned from the key light are shaped rather than black, **Fresnel** driving both a white-biased sky rim and *opacity* (real glass is near-transparent face-on and near-opaque edge-on; uniform alpha was much of the flat read), and a **thickness-based** interior so light appears to travel *through* the body. Verified that `dFdx` on the dendrite SDF does not blow up at its six angular fold seams: gradient magnitude sampled at 3 600 angles × 4 radii peaks at **1.02** against the ideal 1.0. Deliberately chosen *over* multi-facet sub-geometry, which would have cost 3–4× fill rate, required intra-crystal alpha sorting to avoid seams, and left all three root causes in place.
  - **Heat rebalance (2026-07-31).** `MaterialProcessor` integrates heat as `temp = temp * coolFactor + heat` with `coolFactor = dissipation^(1 + coolingRate*2)`, converging to `heat / (1 - coolFactor)` — and where that ceiling exceeds 1 the value **clamps at 1.0 for every particle**, leaving `temperatures[]` with no distribution at all. Two presets did this: `Ice` (`coolingRate 0.3 → 1.5`, `heatGain 0.7 → 0.3`) and `LiquidLight` (`coolingRate 0.4 → 1.5`, `heatGain 1.0 → 0.4`), both now on a clean unclipped `[0.23 .. 0.77]` against Fire's `[0.18 .. 0.60]`. `heatGain` has to move alongside `coolingRate`, because raising the latter alone leaves the fast end pinned at 1.0. This was found via a real failure: early melt compared *raw* temperature, so on saturated Ice every crystal exceeded `meltThreshold` and was destroyed one frame after birth — the visible symptom was "crystals never appear". `CrystalPool.advance()` now compares **relative** heat against the population's own per-frame min/max, with a degenerate zero-spread range disabling early melt rather than melting everything. Both materials also now sample their whole colour ramp instead of only its top end. **⚠️ Superseded twice — do not reason from the values above.** The root cause was fixed 2026-08-05 (`heatScale = 1 - coolFactor`, closing Open Point 7), so `coolingRate`/`dissipation` no longer affect the temperature *range* at all — which makes the rule this rebalance was tuned under (*"`heatGain` has to move alongside `coolingRate`"*) **unfollowable**, and both fields were then merged into `thermalLag` by Batch M. The `heatGain` values here were also recalibrated 2026-08-08: they capped Ice and LiquidLight at temperature 0.37 and 0.32, leaving the top ~65 % of their ramps unreachable, and are now **Ice 0.8** / **LiquidLight 0.9**. What survives: the integration can still saturate for a hand-tuned `heatGain > 1`, so `CrystalPool.advance()`'s **relative**-heat comparison is retained deliberately.
  - **Trajectory renderers exclude the crystal block.** `NeonLineRenderer` and `RibbonRenderer` derive their count from `trajectoryCount(state)` = `state.count - (state.crystalCount ?? 0)`. Not cosmetic: `updateHistory()` rebuilds the entire trail history whenever `count !== lastCount`, and the crystal block length changes every frame as crystals nucleate and melt, so without the exclusion every neon line vanished the moment crystals were enabled — the history could never accumulate. **The spark-block thrash was then fixed too (2026-08-06):** the spark block sits *inside* the counted range and its length also changes every frame, so it used to wipe both renderers' history before it could accumulate. Neon now updates its history **per slot**, so existing slots keep their trails across a count change, and ribbon derives its selection from `state.waveCount` (a fixed length for a given preset) rather than the live count. Residual, accepted: spark slot indices shuffle as the pool compacts, so an individual spark's short trail can inherit a neighbour's — visually indistinguishable, and far better than every trail vanishing.
  - **Neon line fixes (2026-08-05).** Three independent defects, all found from one user report ("neon shows only part of the figure, ribbons show all of it"). The ribbon/neon asymmetry was the diagnostic: they share the same `state` and the same 900 threshold, but ribbon sets `alpha = 0` where neon *drops geometry*, so only neon could lose the figure.
    1. **`MAX_PARTICLES = 8000` cap removed** — the actual cause. Any preset whose effective count exceeds 8000 (the Sliders tab's Density multiplier takes a 4 000-particle preset straight past it) had every slot above the cap silently dropped. Because that is a *contiguous index range*, a coherent fraction of the figure had no lines. An earlier revision of this README asserted the cap was safe because "crystals occupy the highest indices and are truncated first" — true of crystals, but it reasoned only about crystals and never asked whether 8000 could be reached by ordinary means. That comment then actively discouraged looking there. Ribbon never had an equivalent cap.
    2. **`baseVert` index desynchronisation** — `buildGeometry` advanced `baseVert` on *skipped* segments, which write no vertices. After the first skip every subsequent segment's indices pointed 4 vertices too far, so quads were drawn from the wrong data and the index buffer overran the vertices. Simulated at a realistic skip rate: **100 %** of drawn segments referenced wrong vertices; 0 % after the fix. Latent in the pre-existing teleport branch and propagated into the 8a-2 frozen-segment skip.
    3. **Adaptive teleport threshold** — the flat legacy `TELEPORT_SQ = 900` (30 px) rejected *legitimate fast motion*: a particle on a high harmonic moves 40–150 px/frame. Replaced by `computeTeleportSq()`: `max(22 % of the screen diagonal, 6× this frame's median step)`, capped at half the diagonal. Median not mean, so a few real teleports cannot raise the threshold and admit themselves; the ceiling exists because on a very fast preset the motion bound alone would grow past a real wrap and stitch a bright line across the figure. Also fixes a resolution bug — 30 px was far stricter at 1440p than at 720p.

    Process note: two fixes were proposed from static reasoning and neither resolved the symptom, because both were *real but different* bugs. One line of `console.log` instrumentation (`count=8000 drawn=56000/56000 skipTele=0`) identified the true cause immediately — nothing was being skipped, the renderer was simply never told about the rest of the particles. Instrument earlier when a fix does not land.

- **Out-of-phase triage batches, 2026-08-07 → 2026-08-12.** Eight batches of defect work landed between the
  Phase 8 increments, mostly from single user observations. Each is documented in its own section above; the
  worklist itself lives in the project's reverse-engineering triage document (`TRIAGE`).

  | ref | what |
  |---|---|
  | **B11 + B12** | `glow` reached only `blend`; now reaches every render mode. `star` (the default for 167 presets) returned before the glow line; `splat` had no `uGlow` uniform at all |
  | **B13** | `star` has ~3.9× less tone-map headroom than `blend` — measured, then **accepted as won't-fix**: lowering the star sprite would restyle all 167 legacy presets, which are the parity baseline |
  | **B14 + B16** | one colour precedence order across every pass, and `paletteMapping` widened from 3 to 6 members. `temperature` is the bridge that lets a material and a film look compose instead of compete |
  | **B15** | alpha-blend materials fold in the ramp's authored alpha — the real fix for the "snakes looking for a way through the ice" defect |
  | **Batch M** | four `MaterialConfig` fields did not mean what their names implied; then all 8 materials retuned. Tuning before this would have been tuning against broken axes |
  | **11c** | material→behaviour coupling rewritten as two positive allow-lists, in **both** directions (enable *and* disable) |
  | **11d** | nucleation had no proximity test at all; adding one exposed a pixels-vs-model-units trap that cut the population from 640 crystals to 69 |
  | **12** | a leaked blend function → the `blendcheck` checker |
  | **12b** | `clusterForce` at a radius exceeding the figure's own extent shredded the curve; three wrong diagnoses before the units were checked |
  | **Batch G** | six code paths dead for months, including a compiled program → the `deadcheck` checker |
  | **14** | `star` is under-exposed in **absolute** terms → the `Legacy Graded` bundle |
  | **15** | style 6 assigned three pieces of global state at six sites and restored at none → `applyFluidFeedbackState()`. Plus D8 (grow-only fluid buffers), D10 (tolerance-based escape-grid cache) and D14 (tile screen-space scaling) |
  | **16** | D15 tile splat brightness, D16 tile palette/mapping, and the Visual FX **Particle Number** slider |

  **Two cross-cutting lessons, both earned expensively.** First: **re-derive both halves of a premise** —
  that the code is reached, *and* that the cost is real. Twelve premises turned out wrong across three
  triage sittings, in **both** directions: three of Batch G's were over-stated costs never actually paid,
  D8 was *understated* (a correctness bug filed as an allocation one), and D14's was *half-inverted*
  (`ejectionSpeed` must **not** be scaled). A size estimate in a document is not evidence. Second: for any
  in-place resize or state migration, **ask what the field accumulates**, not merely whether it ends up the
  right length.
