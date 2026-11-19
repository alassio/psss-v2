# PSSS Engine — the code map

**▶ [Run the engine in your browser](https://alassio.github.io/psss-v2/)** — the same build this directory produces.

This file is the **map of `psss-engine/`**: every file it holds, one line each, with what the file does and
where to read more. It is held complete by `checks/mapcheck.mjs`, which `npm run verify` runs: a file that
is added without a line here, or a line naming a file that no longer exists, fails the gate.

| To find out… | Read |
|---|---|
| how to build, run, check and deploy | the repository's root **`README.md`** (§2–§5) |
| how the engine works — the pipeline, the mathematics, the file formats | **`psss-engine-v2_how_it_works.md`** (*How it works* below) |
| what each control in the program does | **`psss-engine-v2_how_to_use_it.md`** (*How to use it* below) |
| the Windows screensaver host | **`screensaver/README.md`** |
| why the source comments cite documents that are not in this repository | **`ENGINEERING-NOTES.md`** at the repository root |

Each source file opens with a header comment that states what it owns and the rules that keep it correct;
read that header before editing the file. A section reference such as *How it works* §1.6 points into the
technical manual.

---

## `psss-engine/` — the top level

| File | What it is |
|---|---|
| `index.html` | The page: the canvas, the preview grid and the Lab panel's host elements. |
| `package.json` | Dependencies and every npm script — the build steps, `verify` and each `check:*`. |
| `package-lock.json` | The pinned dependency tree `npm ci` installs. |
| `tsconfig.json` | The compiler settings `verify` type-checks the engine under. |
| `vite.config.ts` | The build: one classic script with inlined CSS, so the output opens from `file://`. Its header states the settings that must not change. |
| `playwright.config.ts` | The browser suite's configuration: its own dev server on port 5176. |
| `.gitignore` | Keeps `node_modules/`, `dist/` and test output out of the repository. |
| `README.md` | This map. |
| `src/` | The engine source — the sections below. |
| `public/` | The preset file the dev server loads, and reference data. |
| `checks/` | The static checkers `npm run verify` runs. |
| `tests/` | The Playwright browser suite. |
| `scripts/` | Build, packaging, PDF and screenshot scripts. |
| `screensaver/` | The Windows screensaver host (C# + WebView2). |

`node_modules/` and `dist/` are created by `npm install` and the build; neither is part of the source.

---

## `src/` — the engine

| File | What it does | Read more |
|---|---|---|
| `main.ts` | The entry point and the frame loop: builds every subsystem, applies a preset, and runs the nine pipeline stages each frame in order. | *How it works* §0, §9.1 |

### `src/core/` — shared foundations

| File | What it does | Read more |
|---|---|---|
| `compute-backend.ts` | The WebGL2 context, with feature detection, and the buffer, texture and program handles the renderers use. | §9.5 |
| `config.ts` | The engine's default configuration. | |
| `gl-program.ts` | The one shader compile-and-link path: every program goes through it with a label, so a failed compile reports instead of drawing black. | §9.5 |
| `glsl-noise.ts` | Shared GLSL: 3-D simplex noise and its 2-D curl, imported by every shader that needs noise. | §7.4 |
| `interfaces.ts` | The generator, renderer and post-processor interfaces, the shared types, and the list of per-particle channel drivers. | §1.3 |
| `projection.ts` | The perspective-projection constants and the cull sentinel shared by everything that projects to the screen. | §4.2 |
| `rotation-track.ts` | The rotation-speed track: the RPM the sliders show against the degrees per second the engine stores. | §4.1 |
| `wave-law.ts` | The wave law — phases, the sine and triangle bases, the per-axis sum and `Travel` — shared by the generator and the Composer's Score. | §1.1 |
| `curl-noise.ts` | Divergence-free curl noise in model space, the turbulence field. | §2.1 |
| `deform-limits.ts` | The limits and readouts of the model-space operators (twist, box fold, taper, bend and the rest), shared by the engine and the UI. | §1.3 |
| `fractal-fold.ts` | The Fractal Fold: box fold and ball fold composed with a feedback term. Imports nothing. | §1.3 |
| `symmetry-groups.ts` | 3-D Symmetry as data: where the copies of a figure sit for each solid, built by closure. Imports nothing. | §1.3 |

### `src/generators/` — where the particles are and what colour they take

| File | What it does | Read more |
|---|---|---|
| `lissajous.ts` | The figure generator: evaluates the waves, the attractors or the self-similar curve for every particle, applies the model-space operators and the colour law, and projects. | §1, §3, §4 |
| `figure-types.ts` | The figure-type registry — waves, attractor, self-similar curve — and how a preset's type is resolved. | §1 |
| `attractors.ts` | Strange attractors and escape-time fractals: iteration, the escape field and the attractor presets. | §1.4, A.1 |
| `attractor-strand.ts` | The attractor strand: one trajectory walked into a ring buffer, so neighbouring particles are neighbouring points on the path. | §1.4 |
| `material.ts` | The material model per particle: temperature, heat and the colour ramp lookup. | §3.3 |
| `material-presets.ts` | The material library (Fire, Ice, Lava and the rest) and the default configuration of each material subsystem. | §3.3, A.2 |
| `colour-ramps.ts` | The colour ramps the materials sample by temperature. | §3.3 |
| `fire-processor.ts` | Buoyancy: the temperature-driven upward drift and turbulence of hot particles. | §2.7 |
| `simplex-noise.ts` | CPU simplex noise and the 2-D curl the buoyancy turbulence uses. | §2.7 |
| `spark-pool.ts` | Sparks: a pooled second population thrown off hot particles. | §1.5 |
| `liquid-pool.ts` | A standing liquid population moved only by the fluid velocity the figure writes. | §1.5, §2.3 |
| `cohesion-field.ts` | Cohesion: short-range attraction that beads the curve into droplets. | §2.2 |
| `physarum.ts` | The Physarum network: agents that follow and deposit a trail. | §2.5 |

### `src/generators/lsystem/` — self-similar curves and plants

| File | What it does | Read more |
|---|---|---|
| `rules.ts` | The rule library as data — every curve and plant, with its axiom, productions and angles. | §1.6 |
| `turtle.ts` | The expander and the 3-D turtle: a production system to a raw point list. | §1.6 |
| `generator.ts` | The generator builder: a curve as scaled copies of itself laid along a generator, for `Twist` and `Stretch`. | §1.6 |
| `curve.ts` | Resamples a point list to the particle count and fits it to the preset's extent. | §1.6 |
| `figure.ts` | The resolved figure per frame: caching, the blend between levels, continuous recursion and growth. | §1.6 |
| `growth.ts` | The growth timeline: grow, hold, wither, rest, repeat. | §1.6 |
| `zoom.ts` | The self-similar zoom: an exact index band, its contiguity measured. | §1.6 |
| `custom.ts` | `Customize` for curves: a self-similar curve drawn from an editable generator. | §1.6 |
| `productions.ts` | `Customize` for plants: their own productions, edited. | §1.6 |
| `tetra.ts` | The Sierpinski-tetrahedron curve. | §1.6 |
| `hill.ts` | The Hill-tetrahedron curve. | §1.6 |

### `src/crystal/` — frozen crystals

| File | What it does | Read more |
|---|---|---|
| `crystal-pool.ts` | The additive crystal pool: nucleation, growth, hold and melt, drawn as faceted shapes. | §1.5 |
| `crystal-config.ts` | Crystal shapes, sizes and defaults. | §1.5 |
| `spatial-hash.ts` | A uniform-grid spatial hash for the "is a crystal near me" query. | §1.5 |

### `src/renderers/` — how a particle becomes pixels

| File | What it does | Read more |
|---|---|---|
| `hdr-particle.ts` | The main particle pass into the HDR trail: the six render modes, particle size, depth and lighting cues, blending. | §5 |
| `ribbon-renderer.ts` | Ribbons: the figure drawn as connected strips. | §5.6 |
| `neon-line-renderer.ts` | Neon lines, built on the GPU from the particle trail. | §5.6 |
| `trajectory-palette.ts` | The palette lookup shared by the ribbon and neon-line shaders. | §5.6 |
| `liquid-reference.ts` | The density reference the liquid iso-surface's `Iso Level` is a multiple of, and its smoothing. | §5.5 |
| `film-looks.ts` | The film-look bundles and their parameters. | §8.4 |
| `palette-selection.ts` | The one resolver for which palette and mapping apply, from a preset's two palette sources. | §3.2, §3.4 |

### `src/post-processors/` — whole-image stages

| File | What it does | Read more |
|---|---|---|
| `trans-map.ts` | The Translation Map: the warp pass that displaces every pixel, and the chain that runs its styles. | §7 |
| `trans-map-chain.ts` | The TransMap style table — one enumeration of every style and its metadata — and the chain plan. | §7.1 |
| `static-field.ts` | The separable wave field and its archetypes: the one place a warp wave is built. | §7.3 |
| `trans-map-force.ts` | The TransMap force: the warp field read back so it can push particles. | §2.8 |
| `procedural-flow.ts` | Procedural Flow, the noise-driven displacement field. | §7.4 |
| `flow-archetypes.ts` | The Procedural Flow presets. | §7.4 |
| `ifs-presets.ts` | The Fractal Feedback (IFS) transforms. | §7.9 |
| `fluid-advection.ts` | Fluid advection: the velocity field particles write and the image is carried by. | §2.6, §7.5 |
| `dye-field.ts` | The dye field: colour carried by the fluid. | §2.4 |
| `depth-field.ts` | The depth pass and its percentile band, for depth cues. | §5.7 |
| `electric-discharge.ts` | Electric Discharge: branching filaments of light around the figure. | §5.6a |
| `bloom.ts` | Bloom. | §8.1 |
| `tone-map.ts` | Tone mapping, then lift, gamma, gain, saturation and vignette. | §8.2, §8.3 |
| `reel-crossfade.ts` | The Reel's fade transition: the outgoing frame composited over the incoming preset. | §9.3 |

### `src/presets/` — the preset library and its format

| File | What it does | Read more |
|---|---|---|
| `types.ts` | The preset format as types: every block and field. | §10.2 |
| `migration.ts` | Loads every older preset form into the current one. | §10.12 |
| `manager.ts` | The preset manager: lookup by name and sorting. | |
| `library.ts` | Composes the library from its groups and the external preset file. Its header states the composition rules. | §10.11 |
| `deployment-format.ts` | The format rule of the two deployment files (`g_psss_presets=` / `g_psss_reels=`), so they load from `file://`. | §10.11 |
| `reel-store.ts` | The reel library: built-in, deployment and saved reels merged into one view, and their persistence. | §9.3, §10.10 |
| `palettes.ts` | The cosine palettes and the cycle palettes. | §3.2 |
| `preset-facets.ts` | What each preset's frame actually does, as predicates — the facets the preview grid's filter offers. | |
| `refined-presets.ts` | Refined counterparts of the original presets. | *How to use it* §7 |
| `variant-presets.ts` | Variants derived from library presets. | *How to use it* §7 |
| `demo-presets.ts` | The demos — each one shows one feature — at the end of the library. | *How to use it* §7 |
| `showcase-presets.ts` | The showcase presets. | *How to use it* §7 |
| `fire-presets.ts` | The fire presets. | *How to use it* §7 |
| `flow-presets.ts` | The flow presets. | *How to use it* §7 |
| `chain-presets.ts` | Presets built on TransMap style chains. | *How to use it* §7 |

### `src/exploration/` — the Lab's logic, without its UI

| File | What it does | Read more |
|---|---|---|
| `state.ts` | The Lab's shared state: the working preset, history, category locks. | |
| `tab-module.ts` | The interface every Lab tab implements, and the tab registry. | |
| `interpolate.ts` | The Mixer's crossfade between two presets. | *How to use it* §6.7 |
| `overlay-rules.ts` | One rule per `overlay` key: how it mixes, mutates and scales. | |
| `randomize.ts` | The Randomiser's mutations by intensity tier. | *How to use it* §6.8 |
| `evolution-ops.ts` | Evolution's crossover, mutation and breeding. | *How to use it* §6.9 |
| `preset-stats.ts` | Parameter ranges across the library, which the Randomiser and Evolution draw from. | |
| `slider-mappings.ts` | The Sliders tab's rows: what each quality dial moves. | *How to use it* §6.6 |
| `reel-model.ts` | The Reel model — the ordered presets, the schedule, the transition arithmetic. Pure. | §9.3 |
| `perf-guard.ts` | The performance guard that throttles the preview tiles under load. | §9.2 |

### `src/ui/` — the page around the canvas

| File | What it does | Read more |
|---|---|---|
| `layout.css` | The page layout: canvas, preview grid and Lab side by side. | |
| `perf-hud.ts` | The `?perf=1` overlay: frame times and what each part of the frame costs. | *How to use it* §4.3 |
| `perf-run.ts` | `?reel=2`: the performance test reel and its log. | *How to use it* §4.3 |

### `src/ui/preview-grid/` — the wall of live thumbnails

| File | What it does | Read more |
|---|---|---|
| `panel.ts` | The preview grid: search, sort, the tiles and their life cycle. | *How to use it* §5 |
| `panel.css` | The grid's styles. | |
| `grid-tile-renderer.ts` | The shared tile renderer: each tile's own trail, drawn in batches with asynchronous readback. Also used by the Evolution and History tabs and the preset picker. | §9.4 |
| `filter-model.ts` | The facet filter's state and cache, without DOM. | *How to use it* §5.2 |
| `filter-drawer.ts` | The facet filter's UI: the button, the summary and the drawer. | *How to use it* §5.2 |

### `src/ui/synthesis-lab/` — the Lab panel

| File | What it does | Read more |
|---|---|---|
| `panel.ts` | The Lab panel: the tab bar, tab switching, and the actions shared by every tab. | *How to use it* §6.0 |
| `panel.css` | The Lab's styles. | |
| `tooltips.ts` | Every tooltip in the Lab, in one table keyed by control. | |
| `collapsible.ts` | The collapsible section group shared by the tabs. | |
| `export.ts` | Export and import of presets, bundles and reels. | §10, *How to use it* §7.4 |
| `preset-picker.ts` | The preset picker with search, filter and live tiles (the Mixer's decks use it). | *How to use it* §6.7 |
| `composer-model.ts` | The Composer's lossless figure model: the only reader and writer of a preset's waves. | *How to use it* §6.4 |
| `score-canvas.ts` | The Score: the 2-D diagram of the figure the Composer is editing. | *How to use it* §6.4 |
| `field-measure.ts` | How big a TransMap field is and how to say so, for the Transmap tab. Pure. | *How to use it* §6.5 |
| `field-frame-canvas.ts` | The Transmap tab's picture of the warp: a deformed lattice with the two wave profiles. | *How to use it* §6.5 |
| `settings-search.ts` | The settings search's matching. Pure. | *How to use it* §6.0 |
| `settings-index.ts` | Scans the built panel into the search index, and jumps to an entry. | *How to use it* §6.0 |
| `settings-search-panel.ts` | The settings search's field and result list. | *How to use it* §6.0 |

### `src/ui/synthesis-lab/tabs/` — one file per Lab tab

| File | What it does | Read more |
|---|---|---|
| `reel.ts` | The Reel tab: build a reel and play it full screen. | *How to use it* §6.1 |
| `visual-fx.ts` | The Visual FX tab, built from a control descriptor table. | *How to use it* §6.2 |
| `materials.ts` | The Materials tab. | *How to use it* §6.3 |
| `composer.ts` | The Composer tab: the figure itself — waves, curves, attractors and their operators. | *How to use it* §6.4 |
| `transmap.ts` | The Transmap tab: the warp field's terms. | *How to use it* §6.5 |
| `sliders.ts` | The Sliders tab. | *How to use it* §6.6 |
| `mixer.ts` | The Mixer tab. | *How to use it* §6.7 |
| `randomiser.ts` | The Randomise tab. | *How to use it* §6.8 |
| `evolution.ts` | The Evolution tab. | *How to use it* §6.9 |
| `history.ts` | The History tab. | *How to use it* §6.10 |

---

## `public/` — the preset file and reference data

The dev server serves this folder; the build does **not** copy it. The deployment's two data files are
written by `scripts/export-library.mjs` instead.

| File | What it is |
|---|---|
| `psss_presets.json` | The legacy-format preset library. The dev server loads it and composes it with the built-in groups; the build reads it to write the deployment's preset file. |
| `legacy_presets_original_177.json` | Reference data: the original 177 presets as an *Export All* writes them, the fixed point an export and re-import must reproduce. |

---

## `checks/` — the static checkers

`npm run verify` runs every checker here except the two marked *browser*, which need a running dev server
and are run on their own. Each checker's header states what it guards and why.

| File | What it guards |
|---|---|
| `mapcheck.mjs` | This map: every file listed exactly once, every listed file present. |
| `glslcheck.mjs` | Every identifier a shader uses is declared. |
| `samplercheck.mjs` | Every sampler is assigned a texture unit, unconditionally. |
| `vaocheck.mjs` | Two passes sharing a vertex array both upload every per-instance buffer. |
| `lencheck.mjs` | Every per-instance upload covers the draw count; no synchronous readback on the per-frame path. |
| `blendcheck.mjs` | A pass that depends on a blend function sets it, and restores the active texture unit. |
| `cullcheck.mjs` | The cull sentinel has one definition and clears every consumer's guard. |
| `deadcheck.mjs` | Removed dead code stays removed: nothing compiled that is never drawn, called or read. |
| `aestheticcheck.mjs` | No preset collapses into a degenerate figure. |
| `fieldcheck.mjs` | The warp field's formula agrees across GLSL, TypeScript and the readouts, measured. |
| `shapecheck.mjs` | The warp wave shapes. |
| `trackcheck.mjs` | Every non-linear slider track is monotone and round-trips. |
| `namecheck.mjs` | A preset name is unique wherever names are keys. |
| `tipcheck.mjs` | Every control has a tooltip and every tooltip reaches a control. |
| `composercheck.mjs` | The Composer's figure model is lossless. |
| `reelcheck.mjs` | Reels: the schedule, the transitions and the deployment file. |
| `coveragecheck.mjs` | Every feature is activated by at least one preset. |
| `palettecheck.mjs` | The palette resolution, and the palette mapping's identity with the original colour law. |
| `facetcheck.mjs` | The filter's facet predicates answer correctly. |
| `figurecheck.mjs` | Figure types, self-similar curves and plants. |
| `mixercheck.mjs` | The Mixer's blend reaches both endpoints exactly. |
| `slidercheck.mjs` | The Sliders tab's rows, measured. |
| `splatcheck.mjs` | The splat and grading path. |
| `deformcheck.mjs` | The model-space operators, measured through the real generator. |
| `searchcheck.mjs` | The settings search reaches every setting. |
| `dischargecheck.mjs` | Electric Discharge's numbers agree in every place they are written. |
| `symmetrycheck.mjs` | 3-D Symmetry's arrangements, measured. |
| `strandcheck.mjs` | The attractor strand keeps its ordering and leaves the cloud unchanged. |
| `democheck.mjs` | *Browser.* Each demo preset shows the feature it exists for. |
| `uicheck.mjs` | *Browser.* The Lab's tabs mount, group and gate correctly. |

---

## `scripts/` — build and tooling

| File | What it does |
|---|---|
| `export-library.mjs` | Build step: writes the composed preset library and the reels as the deployment's two data files. |
| `build-screensaver.mjs` | `npm run build:screensaver`: builds the screensaver host around the web build. |
| `docs-to-pdf.mjs` | `npm run docs:pdf`: renders the two manuals to PDF. |
| `package-dist.mjs` | `npm run package:dist`: the distribution zip. |
| `browser-suite.mjs` | `npm run verify:browser:chunks`: the browser suite in groups, each on a fresh dev server. |
| `capture-ui.mjs` | Takes the user manual's screenshots against a running dev server. |

---

## `tests/` — the Playwright browser suite

Run with `npm run verify:browser`, or the whole suite with `npm run verify:browser:chunks`. A *seeds* file
plants defects to prove that the matching spec can fail.

| File | What it tests |
|---|---|
| `00-harness-smoke.spec.ts` | The harness itself: the page, the test hook and the canvas. |
| `01-session-a-read-and-edit.spec.ts` | The Composer: reading a rich figure and editing it. |
| `02-calibration-seeds.spec.ts` | Seeds for `01`. |
| `03-testhook-channel.spec.ts` | The test hook's read-only channel, with its seeds. |
| `04-preview-only-and-readouts.spec.ts` | The Composer's preview-only state and its readouts. |
| `05-phase6-seeds.spec.ts` | Seeds for `04`. |
| `06-dom-steps.spec.ts` | The Composer, step by step through the DOM. |
| `07-diagram-panes.spec.ts` | The Score's panes, measured per colour and per plane. |
| `08-dom-steps-seeds.spec.ts` | Seeds for `06`. |
| `09-diagram-pane-seeds.spec.ts` | Seeds for `07`. |
| `10-screensaver-mode.spec.ts` | `?screensaver=1`: play, and exit on input. |
| `11-transmap-tab.spec.ts` | The Transmap tab. |
| `12-sliders-tab.spec.ts` | The Sliders tab. |
| `composer-fixture.ts` | Shared selectors, labels and the test-hook types the specs use. |
| `tsconfig.json` | The specs' compiler settings, for `npm run check:specs`. |

---

## `screensaver/` — the Windows screensaver host

Building it needs the .NET 8 SDK and Visual Studio; `screensaver/README.md` covers prerequisites, the
argument contract and installing. Its `bin/`, `obj/` and `Payload/` folders are build output.

| File | What it does |
|---|---|
| `README.md` | The host's own manual. |
| `Program.cs` | The argument contract (`/s`, `/c`, `/p`), the message loop and the log. |
| `ScreensaverWindow.cs` | Show mode: the full-screen window and its exit policy. |
| `ConfigWindow.cs` | Configure mode: the Lab's Reel tab in a window. |
| `PreviewHost.cs` | Preview mode: a static picture in the Settings dialog's small window. |
| `WebHost.cs` | The WebView2 environment and how it serves the embedded engine and the data files. |
| `PayloadFiles.cs` | The names of the files the host embeds and reads. |
| `Interop.cs` | Every Windows API call the host makes. |
| `Psss.Screensaver.csproj` | The project: one self-contained executable. |
| `app.manifest` | The Windows application manifest. |
| `build.bat` | Builds the host from a plain command prompt. |
| `preview.png` | The picture preview mode shows. |
| `probe/` | Scripts that exercise a built `.scr` from outside, and the record of their runs. |
