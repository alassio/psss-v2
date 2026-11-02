# `psss-original/` — the JavaScript version this engine was migrated from

⚠️ **This directory is NOT the upstream project, and the folder name is the one misleading thing about
it.** It is the JavaScript implementation **as it stood in this project when the TypeScript rewrite
began** — Andreas Kardin's original, plus substantial further work done here on the JavaScript version
before the migration. It is read-only and frozen.

**For the original author's own code, use the upstream repository**, or this repository's own history:

| what | where |
|---|---|
| Andreas Kardin's implementation, current | <https://github.com/mephzara/psss_js> |
| the same code, in this repository's history | commit `2934077` — `git show 2934077:psss.js` |
| his live demo | <http://mephzara.com/misc/psss_js/> |

Upstream has not changed since **2023-09-18**; the whole difference below is work added here.

## What differs from upstream

| file | upstream | here |
|---|---|---|
| `psss.js` | 1591 lines | **5078 lines** (+3545 / −58) |
| `index.html` | 622 lines | **1070 lines** (+451 / −3) |
| `psss_presets.json` | — | **byte-identical** |
| `LICENSE` | — | **byte-identical** |

**All ten of the original's functions are still present** (`drawFrame`, `calcTransMap`, `applyPreset`,
`selectPreset`, `displayPreset`, `start`, `testCube` and the three preset-name parsers), and only 58 of
their lines were touched. The growth is **57 added functions**, in five groups:

| added here | what it became in `psss-engine/` |
|---|---|
| **Strange attractors and escape-time fractals** — `cliffordIterate`, `dejongIterate`, `lorenz2dIterate`, `rosslerIterate`, `thomasIterate`, `halvorsenIterate`, `nosehooverIterate`, `aizawaIterate`, `juliaIterate`, `smoothEscapeJulia`/`Mandelbrot`, `buildEscapeFlowGrid`, `escapeFlowIterate`, `sampleEscapeGrid`, `computeAdaptiveMaxIter`, `blurGrid` | `src/generators/attractors.ts` |
| **Evolution and breeding** — `breedGeneration`, `crossoverPresets`, `mutatePreset`, `interpolatePreset`, `EvoTile`, `evoSelectTile`, `sendFractalToEvolution` | `src/exploration/evolution-ops.ts`, `interpolate.ts`, `randomize.ts` |
| **The preview grid** — `initPreviewGrid`, `createTilePipeline`, `createTileShell`, `showPreviewAll`, `processInitQueue` | `src/ui/preview-grid/` |
| **Preset import and export** — `exportAllPresets`, `exportPresetAsFile`, `importPresetCollection`, `importSinglePreset`, `addPresetToDropdowns` | `src/ui/synthesis-lab/export.ts`, `src/presets/manager.ts` |
| **The Lab surface** — `switchLabTab`, the archetype sliders, `randomizePreset`, `captureSnapshot`/`restoreSnapshot`, `renderLabHistory`, `generatePalette` | `src/ui/synthesis-lab/` and its tabs |

`index.html`'s added lines are that surface's controls — the `chkFx*` effect switches, the `chkLabLock*`
and `chkRandLock*` category locks, the `cmdEvo*` and `cmdFrac*` buttons, and the preview-grid styling.

⚠️ **So this directory is the first generation of everything the TypeScript engine does**, which is why
it is kept rather than replaced by a faithful copy of upstream: the specifications the rewrite was built
against were extracted from *this* tree, so it is the reference a parity question is settled by. Replacing
it with upstream's files would leave the repository holding an "earlier version" the current engine was
never derived from.

## `psss_how_it_works.md`

That file describes **this** JavaScript engine — the extended one in this directory — and was written
here. It is not upstream documentation.

## Why nothing here is edited

The code is frozen at the state the migration started from. Changing it would destroy the only record of
that starting point and invalidate the parity reference; the TypeScript engine is where work happens.
`NOTICE` in the repository root carries the attribution and the GPL-3.0 terms this directory is
distributed under, exactly as the original was.
