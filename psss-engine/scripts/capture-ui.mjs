/**
 * capture-ui.mjs — screenshots for the user guide (`psss-engine-v2_how_to_use_it.md`).
 *
 * A STANDALONE script, deliberately not a Playwright spec: it is not picked up by `verify:browser`,
 * it asserts nothing, and it fails loudly rather than reporting a test result. Its only job is to
 * produce PNGs for the manual.
 *
 *   node scripts/capture-ui.mjs --base http://localhost:5174 [--mode panels|recipes|all]
 *
 * The page must already be served (`npm run dev`). NOTE the port: 5173 may be somebody else's dev
 * server, so pass `--base` explicitly rather than relying on a default.
 *
 * ── two modes ────────────────────────────────────────────────────────────────────────────────────
 *
 * `panels`  — the preview grid and each of the ten Lab tabs, at deviceScaleFactor 2 so the control
 *             text is crisp. CLEAN SHOTS, no annotation layer.
 *
 *             ⚠️ **NUMBERED CALLOUT BADGES WERE BUILT HERE AND THEN REMOVED BY OWNER DECISION
 *             (2026-10-09). Do not re-add them.** They were drawn into the live DOM before each shot
 *             and numbered in a reserved left-hand gutter, level with each target. Two reasons they
 *             went: the placement rule is PER-ROW, so a horizontal toolbar — the preview grid's
 *             header is one row holding seven controls — stacked every badge in the margin up to
 *             1200 px from what it named, and a tile in a 2D grid has no single row to be level with;
 *             and the caption's numbering was coupled to an ordered list in THIS file with nothing
 *             enforcing that the two stayed in step. Every control in this UI carries its name on
 *             screen, so the guide names them instead.
 *
 * `recipes` — before/after pairs of the ANIMATION for the recipes in the guide, at deviceScaleFactor 1
 *             (an animation needs no text crispness, and 2x would quadruple the file size for nothing).
 *             Each recipe drives only the steps that are reliably scriptable; `scriptedNote` records
 *             which, and the caption in the guide says so. An unscripted step is never implied to be
 *             in the picture.
 *
 * ── why controls are found the way they are ──────────────────────────────────────────────────────
 *
 * Sliders carry an `aria-label` equal to their visible label, so they are addressed by that. The
 * dropdowns carry NO aria-label, so they are found by the OPTION they contain — material, film-look
 * and render-mode names are unique across the UI, which makes that more robust than position within
 * a section, and immune to a section being reordered.
 */
import { chromium } from '@playwright/test';
import { inflateSync } from 'node:zlib';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'http://localhost:5174');
const MODE = argOf('--mode', 'all');
const OUT = resolve(HERE, '..', argOf('--out', '../manual-images'));
/**
 * `--only reel,customize` restricts the run to shots whose FILE NAME contains one of the given
 * fragments. Re-taking one panel otherwise means re-taking all twenty-three, which takes minutes.
 */
const ONLY = (argOf('--only', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
const wanted = (file) => ONLY.length === 0 || ONLY.some((o) => file.includes(o));

const LAB_BTN = 'button.pg-mode-btn:has-text("Lab")';
const problems = [];


/*
 * Further shots of a tab, for a panel too tall for the viewport or for a state the default does not show.
 *
 * ⚠️ **`scrollIntoViewIfNeeded` SCROLLS THE MINIMUM DISTANCE**, which leaves `scrollTo` at the BOTTOM
 * of the panel — so a shot shows the sections BEFORE its target, never the ones after it. That is why the
 * tall tabs take several shots each: the groups and scroll targets are chosen to tile the tab with no gaps.
 * **Count the entries in this array rather than quoting a total from a comment.**
 *
 * `options` sets dropdowns before the shot, which is how the conditional sections are reached at all:
 * `Liquid Surface` and `Volume Render` only exist while their render mode is picked, and the Film Look
 * panel's eighteen extra rows only exist while the look is `Customize`. MEASURED: a named look shows 53
 * rows and `Customize` shows 71 — and the BOOT preset is already on `Customize`, so the panel being
 * open is the default state rather than something the shot has to arrange.
 */
const EXTRA_SHOTS = [
  /*
   * ---- Visual FX: ONE GROUP PER SHOT ----
   *
   * ⚠️ **`group` REPLACED `scrollTo` FOR THIS TAB AND THE DIFFERENCE IS WHAT THE READER SEES.** The old
   * three shots were scroll POSITIONS - `Render Mode`, `Dye Field`, `Fluid Advection` - chosen to tile a
   * flat list of nineteen sections with no gaps, which is a rule about coverage and says nothing about
   * where a section belongs. The tab now HAS a structure, so each shot is one group with the others shut:
   * the picture is the group, and the closed heads around it tell the reader where they are.
   *
   * ⚠️ **THE MAIN `lab-visual-fx` SHOT IS DELIBERATELY TAKEN BEFORE ANY OF THIS, so it shows the tab AS
   * IT OPENS - five closed heads and nothing else.** That is the one state every reader meets first and
   * the one no scrolled shot could ever show.
   */
  { tab: 'visual-fx', file: 'lab-visual-fx-figure', group: 'Figure' },
  /*
   * ⚠️⚠️ **THE FIGURE GROUP OUTGREW ONE VIEWPORT AND THE FIRST SHOT STOPPED SHOWING TWO WHOLE SECTIONS.**
   * `Deformation` and `Attractor` sit below `Curve Basis`, and now that the figure operators have filled
   * `Curve Basis` out the single shot ends mid-section at `Flare` — **open the PNG and read where it stops
   * rather than inheriting a row count from here.** A caption naming them as off-picture is honest and no
   * substitute: this second shot is scrolled so the group's FOOT is what the reader sees.
   *
   * ⚠️⚠️ **`scrollTo` WAS `'Flow'` UNTIL 2026-11-01 AND THAT ROW NO LONGER EXISTS — the owner withdrew the
   * attractor `Flow` control, so the anchor is now `'Blend'`, the Attractor section's new LAST row.**
   * `scrollIntoViewIfNeeded` leaves its target at the BOTTOM, so the frame still holds the tail of
   * `Curve Basis`, the whole of `Deformation` and the whole of `Attractor`. Aiming at the `Attractor`
   * TITLE instead would cut the rows under it. ⚠️ **A `scrollTo` naming a deleted row does not fail: the
   * lookup misses and the shot comes back UNSCROLLED, i.e. a second copy of the first picture** — which is
   * why this anchor is named in a comment rather than left to be rediscovered.
   */
  { tab: 'visual-fx', file: 'lab-visual-fx-figure-2', group: 'Figure', scrollTo: 'Blend' },
  /*
   * The cross-tab settings search, open over Visual FX. ⚠️ **`symme` is chosen because it shows all three
   * kinds of row the manual explains**: two controls with the SAME name told apart only by their path
   * (Visual FX's and Sliders' `Symmetry`), and two rows that matched only on their TOOLTIP, each carrying
   * the matching fragment (the Mixer's crossfader, `Particle Number`).
   */
  { tab: 'visual-fx', file: 'lab-search', search: 'symme' },
  { tab: 'visual-fx', file: 'lab-visual-fx-particles', group: 'Particles' },
  { tab: 'visual-fx', file: 'lab-visual-fx-colour', group: 'Colour', options: ['Ethereal'] },
  /*
   * ⚠️ **THIS BLOCK USED TO NEED TWO SHOTS AND NOW NEEDS ONE, WHICH IS A MEASUREMENT THE REGROUPING
   * INVALIDATED RATHER THAN A TIDY-UP.** The old note here read *"the eighteen Customize rows do not fit
   * one viewport"* - true when fourteen sections sat above them in a flat list. With the other four
   * groups closed the block starts ~500 px higher and `Glow` to `Gain` fits in one frame; the two shots
   * came out BYTE-IDENTICAL, which is how it was caught. **A stale measurement in a comment reads exactly
   * like a live one** - re-measure after a layout change rather than inheriting the figure.
   */
  { tab: 'visual-fx', file: 'lab-visual-fx-customize', group: 'Colour',
    options: ['Customize'], scrollTo: 'Rim Pow' },
  { tab: 'visual-fx', file: 'lab-visual-fx-image', group: 'Image',
    // Translation Map's own body is gated on its `Enable`, so the shot has to tick it or it photographs
    // one checkbox and calls it a section.
    enable: [['Translation Map', 'Enable']] },
  /*
   * ⚠️⚠️ **THE LAYER ROW'S OWN BODY IS WHERE THE PER-LAYER FIELD CONTROLS LIVE, AND NO SHOT HAD EVER
   * OPENED IT.** The shot above photographs the chain — one collapsed `▸` row per layer — so `Pattern`,
   * `Shape`, `Shape Mix`, `Angle`, `Strength`, `Detail`, `Drift` and the whole `Zoom half` were in no
   * picture at all, and re-running the shot above could never put them there.
   *
   * ⚠️ **`expandGroups()` CANNOT REACH IT: it clicks `.sl-vfx-group-head` and `.sl-vfx-sub-head`, and the
   * layer expander is a plain `button` whose text is `▸`.** A helper that expands "groups" expands the two
   * classes it NAMES. Hence `expandLayers`, which is the same click `setControl`'s retry path makes — the
   * difference being that this shot wants it whether or not a lookup missed.
   *
   * ⚠️ **`preset` IS LOAD-BEARING, NOT A FLOURISH.** `Zoom Shape` and `Zoom Shape Mix` are built only on
   * style 3, so the host has to carry a style-3 layer or the two rows are not in the DOM at all. On a
   * style-0 preset the same shot would show a shorter section and the caption would be describing rows
   * that were never built.
   *
   * ⚠️⚠️ **RE-POINTED 2026-11-01: THE HOST WAS `Warp Split Shapes`, WHICH WAS DELETED — AND THE SHOT NOW
   * NEEDS FOUR `set` STEPS WHERE IT USED TO NEED NONE.** That preset was the library's only carrier of a
   * style-3 layer with BOTH shape pairs live (square on the shift half, triangle on the zoom half), and
   * **after the deletion no shipped preset drives `shape2`/`shapeMix2` at all** (`shapecheck` §G0b prints
   * that census). `Shear Zoom Combined` supplies the style-3 layer; the four shape values are then SET by
   * this recipe, which is the only way left to photograph the rows as live rather than at their
   * identities. ⚠️ **If those four `set` steps ever miss, the shot silently becomes a picture of four
   * identity rows and the caption becomes false — `PROBLEMS` reports a miss, so read it.**
   */
  { tab: 'visual-fx', file: 'lab-visual-fx-image-layer', group: 'Image',
    preset: 'Shear Zoom Combined',
    enable: [['Translation Map', 'Enable']],
    expandLayers: true,
    set: [['Translation Map', 'Shape', 'Square'], ['Translation Map', 'Shape Mix', 1.0],
          ['Translation Map', 'Zoom Shape', 'Triangle'], ['Translation Map', 'Zoom Shape Mix', 1.0]],
    scrollTo: 'Zoom Shape Mix' },
  { tab: 'visual-fx', file: 'lab-visual-fx-fields', group: 'Fields' },
  /*
   * ⚠️ **THE FOUR GATED FIELD BODIES ARE TICKED ON for this second Fields shot** - `Liquid Field`,
   * `Dye Field`, `Curl Noise` and `Physarum` each hide their rows behind their own `Enable`. A manual
   * that photographed them switched off would show four checkboxes where the reader expects the controls
   * the text beside it explains.
   */
  { tab: 'visual-fx', file: 'lab-visual-fx-fields-2', group: 'Fields',
    enable: [['Liquid Field', 'Enable'], ['Dye Field', 'Enable'],
      ['Curl Noise', 'Enable'], ['Physarum Network', 'Blend', 0.6]],
    scrollTo: 'Fluid Advection' },
  { tab: 'visual-fx', file: 'lab-visual-fx-liquid', group: 'Particles',
    options: ['Liquid'], scrollTo: 'Liquid Surface' },
  { tab: 'visual-fx', file: 'lab-visual-fx-volume', group: 'Particles',
    options: ['Volume'], scrollTo: 'Volume Render' },

  /*
   * ---- the Composer ----
   *
   * ⚠️ The three wave slots are OUTSIDE the collapsible, so they need no `group` - but `Framing &
   * Preview` is the one closed head on the tab and gets a shot of its own, since both of its sections
   * (and the persistence distinction between them) are now behind it.
   */
  /*
   * ⚠️ **`-3` IS TAKEN BEFORE `-2` BECAUSE `-2`'s PREP IS DESTRUCTIVE AND THE SHOTS SHARE ONE PAGE.**
   * Unticking `Structure` hides its rows, so `Wobble rate@2` - Detail's, counted among the VISIBLE
   * copies - stops resolving and `-3` photographed the wrong thing. It failed loudly here only because
   * `scrollTo` reports a miss; a step that merely changed a VALUE would have leaked silently into every
   * later shot in the same tab. **Order the shots so anything irreversible happens last.**
   */
  { tab: 'composer', file: 'lab-composer-3', scrollTo: 'Wobble rate@2' },
  /*
   * ⚠️ **`lab-composer-2` PHOTOGRAPHS A SWITCHED-OFF LEVEL, and the shot it replaced was redundant.**
   * It used to scroll to Body's `Wobble rate` - but with the Score at the top of the tab and `Framing &
   * Preview` collapsed to one line, Body's rows are already in the main shot, and the two files came out
   * byte-identical. So this one shows the state that has no other picture: `Structure` unticked, its
   * twenty-one inputs gone, and the one line that says the values are kept.
   */
  { tab: 'composer', file: 'lab-composer-2', scrollTo: 'Structure' },
  /*
   * v8 `36.22` — the self-similar curve body.
   *
   * ⚠️⚠️ **IT NAMES A PRESET BECAUSE THE BODY DOES NOT EXIST OTHERWISE.** The two figure types have
   * mutually exclusive bodies, so on any wave preset this shot would photograph three wave slots and the
   * caption would be a claim about a picture that does not show it. `Curve Morph` is chosen over the
   * others because its rule uses yaw alone, which is the common case — a 3-D rule would show Pitch and
   * Roll rows that most rules do not have.
   *
   * ⚠️ **The script RELOADS before every extra shot**, so this entry restates everything it needs rather
   * than inheriting the previous shot's state. That reload exists because a shot once inherited an
   * earlier shot's edits and its caption was wrong about the preset.
   */
  { tab: 'composer', file: 'lab-composer-curve', preset: 'Curve Morph' },
  /*
   * ⚠️ A SECOND curve shot on a 3-D rule, so the Pitch and Roll rows are documented as existing at all.
   * `Curve Tilt` is the only shipped preset that modulates both.
   */
  { tab: 'composer', file: 'lab-composer-curve-3d', preset: 'Curve Tilt', scrollTo: 'Pitch' },
  { tab: 'composer', file: 'lab-composer-setup', group: 'Framing & Preview' },

  /*
   * ---- Materials ----
   *
   * ⚠️ **EVERY SECTION HERE IS GATED ON ITS OWN `Enable`, so every Materials shot must tick one.** The
   * groups open the sections; the `Enable` opens the rows inside them. Photographing either half alone
   * gives a picture of a switch.
   */
  { tab: 'materials', file: 'lab-materials-fire', group: 'Fire',
    enable: [['Buoyancy', 'Enable'], ['Sparks', 'Enable']] },
  { tab: 'materials', file: 'lab-materials-crystals', group: 'Crystals',
    enable: [['Crystals', 'Enable']], scrollTo: 'Lifecycle' },
  { tab: 'materials', file: 'lab-materials-crystals-2', group: 'Crystals',
    enable: [['Crystals', 'Enable'], ['Growth', 'Enable Growth']], scrollTo: 'Growth' },

  /*
   * ---- Transmap: the wave SHAPE and the wave DIRECTION ----
   *
   * ⚠️⚠️ **THE MAIN `lab-transmap` SHOT SITS AT THE IDENTITY ON BOTH NEW CONTROLS AND CANNOT BE MADE TO
   * SHOW EITHER.** It photographs the boot preset, which is `Shape: Sine`, `Shape Mix 0.00`, `Angle
   * 0° / 0°` — and **`Sine` and a mix of 0 are two separate ways of saying "no shape"**, so a shot that
   * picked a shape and left the mix alone would be byte-identical to the one above it. No shipped preset
   * authors a non-zero angle at all. So both states need setting up, and each needs its own picture.
   *
   * ⚠️ **`preset` RATHER THAN SETTING THE SHAPE BY HAND**, for the shape shot: the eight `Warp *` demos
   * are the feature's own carriers, they ship with the warp switched ON — so the picture has no amber
   * "TransMap is switched off" bar across it — and the identification line then reads the preset's real
   * table rather than one this script typed.
   */
  { tab: 'transmap', file: 'lab-transmap-shape', preset: 'Warp Square Mosaic' },
  /*
   * The SAME preset with the two angles turned, so the pair reads as one change: a brick mosaic on axis,
   * then the same mosaic skewed. ⚠️ **+32 / −18 rather than a round pair**: equal-and-opposite angles are
   * exactly the parallel case the notice below warns about (`angleY + 90 − angleX ≡ 0 (mod 180)`), which
   * would flatten the field and make this picture the degenerate one instead of the tilted one.
   */
  { tab: 'transmap', file: 'lab-transmap-angle', preset: 'Warp Square Mosaic',
    angles: [['Angle X', 32], ['Angle Y', -18]] },
  /*
   * ⚠️ **THE DEGENERATE-ORIENTATION LINES, WHICH NOTHING ELSE CAN PICTURE.** `Warp Torn Zoom` is
   * `Zoom Overlay` (the one style whose two waves are SUMMED) with a discontinuous shape, so
   * `Angle X 90 / Angle Y 0` lights four notices at once: the tear, `±90` swapping a wave onto the other
   * axis, the pair then being parallel, and a parallel pair on this style cancelling.
   *
   * ⚠️⚠️ **`Diagonal Shear` IS NOT COSMETIC AND THE PRESET'S OWN PATTERN WOULD HAVE MADE THE PICTURE LIE
   * BY IMPLICATION.** `wavesCancel` says a parallel pair cancels *on a symmetric table*, and symmetric
   * there means **the two axes agreeing UP TO SIGN** — MEASURED on this preset at 800×1000: the shipped
   * `Coarse Swell` (X `1@1`, Y `1@1`) goes 35 px → 35 px with all four lines lit, because `wx = +wy` sums
   * to twice the wave rather than to nothing; `Diagonal Shear` (X `1@4`, Y `1@-4`) goes 35 px → **`0 px`**,
   * and the displacement lattice above goes flat. Two tables that look equally symmetric, one opposite
   * verdict. **A notice naming a CONDITION must be pictured on a case that satisfies it.**
   */
  /*
   * ⚠️ **RE-POINTED 2026-11-01: the host was `Warp Torn Zoom`, which was deleted.** `Radial Zoom Overlay`
   * is the replacement and the substitution is SAFE for this shot's subject — what the picture needs is a
   * **style-2 (Zoom Overlay) layer with a static field**, and the recipe SETS the pattern to
   * `Diagonal Shear` itself, so the host's own pattern (`Coarse Swell`) never reaches the frame. **The
   * notice fires on the ANGLES, which this recipe also sets.**
   */
  { tab: 'transmap', file: 'lab-transmap-notices', preset: 'Radial Zoom Overlay',
    set: [['Pattern', 'Pattern', 'Diagonal Shear']],
    angles: [['Angle X', 90], ['Angle Y', 0]] },
];

const TABS = [
  ['reel', 'lab-reel'], ['visual-fx', 'lab-visual-fx'], ['materials', 'lab-materials'],
  ['composer', 'lab-composer'], ['transmap', 'lab-transmap'], ['sliders', 'lab-sliders'],
  ['mixer', 'lab-mixer'], ['randomiser', 'lab-randomise'], ['evolution', 'lab-evolution'],
  ['history', 'lab-history'],
];

/* ──────────────────────────────────────────────────────────────────────────────────────────────────
 * Recipes. `steps` are only the scriptable ones; `scriptedNote` is copied into the guide's caption so
 * the reader is told exactly what the "after" image does and does not show.
 * ────────────────────────────────────────────────────────────────────────────────────────────────── */
/**
 * How long a recipe shot is allowed to develop before it is taken, in milliseconds.
 *
 * `--settle 20000,35000` overrides the pair for a run, which is how to judge whether a disappointing
 * picture is under-developed or genuinely a poor choice of preset.
 */
const [SETTLE_BEFORE, SETTLE_AFTER] = (argOf('--settle', '15000,25000')
  .split(',').map((n) => Number(n.trim())));
/*
 * A recipe frame dimmer than this is reported as showing nothing.
 *
 * ⚠️ **12 IS MEASURED, NOT PICKED.** The first floor was 4 and it passed a frame that was visually
 * unreadable at 9.6 — so the floor was calibrated against that failure rather than against a guess. A
 * healthy `before` frame measures around 25-30 on these presets.
 */
const DARK_FLOOR = Number(argOf('--dark-floor', '12'));
/*
 * A frame flatter than this is near-uniform — almost black or blown out.
 *
 * ⚠️ **14 IS CALIBRATED AGAINST A FRAME VERIFIED BY EYE, not picked.** The first floor was 18 and it
 * flagged `recipe-0-cycloid-before`, which measures sd 17.6 and is an excellent picture — thin bright
 * lines on black, perfectly legible. A floor that fails a known-good frame is measuring the wrong thing.
 */
const SD_FLOOR = Number(argOf('--sd-floor', '14'));
/** How many instants each recipe frame samples, and how far apart. `--tries 8,4000` to change. */
const [TRIES, TRY_GAP] = argOf('--tries', '5,4500').split(',').map((n) => Number(n.trim()));

const RECIPES = [
  /*
   * All six start from **Cycloid** (owner, 2026-10-10), which is why only the FIRST carries `before: true`
   * — the other five would photograph the same starting frame five more times.
   *
   * Every step is a `['set', pane, section, label, target]` tuple, where a number is an exact value
   * reached through the row's own readout rather than a position on the track. The achieved readout is
   * printed per step, and those printed numbers are what the guide's captions quote.
   */
  { file: 'recipe-1-look', preset: 'Cycloid', before: true,
    steps: [
      ['set', 'visual-fx', 'Film Look', 'Look', 'Dramatic'],
      ['set', 'visual-fx', 'Film Look', 'Look', 'Customize'],
      ['set', 'visual-fx', 'Tone Map', 'Exposure', 2.5],
      // ⚠️ **NEON LINES WAS REMOVED BY THE OWNER (2026-10-10) BECAUSE THE PICTURE WAS WORSE WITH IT.**
      // Its glowing segments added their own light on top of an already-lifted exposure, and the two
      // together merged the loops into a white mass. Do not re-add it to this recipe.
    ] },

  { file: 'recipe-2-liquid', preset: 'Cycloid',
    steps: [
      ['set', 'visual-fx', 'Render Mode', 'Mode', 'Liquid'],
      ['set', 'visual-fx', 'Render Mode', 'Particle Size', 2.0],
      ['set', 'visual-fx', 'Liquid Surface', 'Iso Level', 1.7],
    ] },

  { file: 'recipe-3-burn', preset: 'Cycloid',
    steps: [
      ['set', 'materials', null, 'Material', 'Fire'],
      ['set', 'materials', null, 'Splat Radius', 2.0],
      ['set', 'materials', null, 'Heat Gain', 0.4],
    ] },

  { file: 'recipe-4-freeze', preset: 'Cycloid',
    steps: [
      ['set', 'materials', null, 'Material', 'Ice'],
      ['set', 'materials', 'Crystals', 'Enable', true],
      ['set', 'materials', 'Growth', 'Enable Growth', true],
      ['set', 'visual-fx', 'Colour Palette', 'Palette', 'Classic · ice'],
    ] },

  { file: 'recipe-5-glass', preset: 'Cycloid',
    steps: [
      ['set', 'visual-fx', 'Translation Map', 'Enable', true],
      ['set', 'visual-fx', 'Translation Map', 'Style', 'Zoom Overlay'],
      ['set', 'visual-fx', 'Translation Map', 'Pattern', 'Grid Lattice'],
      ['set', 'visual-fx', 'Translation Map', 'Strength', 16.0],
    ] },

  { file: 'recipe-6-fractal', preset: 'Cycloid',
    steps: [
      ['set', 'visual-fx', 'Attractor', 'Preset', 'Mandelbrot Full Set'],
      ['set', 'visual-fx', 'Attractor', 'Blend', 0.9],
    ] },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Screenshot `sel`, trimmed to the bottom of its CONTENT.
 *
 * ⚠️ **A PANEL IS NOT THE SAME HEIGHT AS WHAT IS IN IT.** The Lab panel is full-height, but several tabs
 * end well short of the bottom — Mixer, Randomise, Sliders and History all do — and an untrimmed shot
 * carries that empty strip into the guide as dead space. So the shot is clipped to the lowest visible
 * descendant plus a small margin. This is a no-op wherever the content already fills the viewport, which
 * is why it is applied to every panel shot rather than to a list of the short ones (a list would have to
 * be maintained against a UI that keeps changing, and would be wrong silently).
 *
 * `page.screenshot({ clip })` is used rather than `element.screenshot()` because only the page-level
 * call takes a clip rectangle.
 */
/**
 * Mean luminance of a PNG this script just wrote, 0-255, or `null` if it cannot be read.
 *
 * ⚠️ **THE POINT IS TO CATCH A PICTURE THAT SHOWS NOTHING.** A PSSS frame is mostly black by design, so
 * a low number is not automatically wrong — but a recipe "after" shot in the low single digits means the
 * change being illustrated is invisible, which is exactly the defect the owner reported. The reader is
 * written out by hand rather than with a dependency: the file was written moments ago by Chromium, so it
 * is 8-bit non-interlaced, and only the filters PNG actually uses need handling.
 */
function frameStats(path) {
  try {
    const buf = readFileSync(path);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const depth = buf[24];
    const colour = buf[25];
    if (depth !== 8 || (colour !== 2 && colour !== 6)) return null;   // RGB or RGBA only
    const bpp = colour === 6 ? 4 : 3;
    const idat = [];
    for (let i = 8; i < buf.length;) {
      const len = buf.readUInt32BE(i);
      const type = buf.toString('ascii', i + 4, i + 8);
      if (type === 'IDAT') idat.push(buf.subarray(i + 8, i + 8 + len));
      i += len + 12;
    }
    const raw = inflateSync(Buffer.concat(idat));
    const stride = w * bpp;
    const prev = Buffer.alloc(stride);
    const line = Buffer.alloc(stride);
    let total = 0;
    let totalSq = 0;
    for (let y = 0, o = 0; y < h; y += 1) {
      const filter = raw[o]; o += 1;
      raw.copy(line, 0, o, o + stride); o += stride;
      for (let x = 0; x < stride; x += 1) {
        const a = x >= bpp ? line[x - bpp] : 0;
        const b = prev[x];
        const c = x >= bpp ? prev[x - bpp] : 0;
        if (filter === 1) line[x] = (line[x] + a) & 255;
        else if (filter === 2) line[x] = (line[x] + b) & 255;
        else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
        else if (filter === 4) {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
        }
      }
      for (let x = 0; x < stride; x += bpp) {
        const l = (line[x] + line[x + 1] + line[x + 2]) / 3;
        total += l; totalSq += l * l;
      }
      line.copy(prev);
    }
    const mean = total / (w * h);
    return { mean, sd: Math.sqrt(Math.max(0, totalSq / (w * h) - mean * mean)) };
  } catch {
    return null;
  }
}

async function shoot(page, sel, file, trim = true) {
  const el = page.locator(sel).first();
  if (await el.count() === 0) { problems.push(`${file}: ${sel} matched nothing`); return; }
  const box = await el.boundingBox();
  if (!trim || !box) {
    await el.screenshot({ path: `${OUT}/${file}.png` });
    report(file, box);
    return;
  }
  /*
   * The lowest visible pixel of actual CONTENT, in viewport coordinates.
   *
   * ⚠️ **COUNTING EVERY DESCENDANT MEASURES NOTHING** — the first version did, and trimmed 0 % off
   * every panel, because the Lab panel contains a wrapper that stretches to its full height. So only
   * elements that CARRY something are measured: a control, a canvas, or an element with its own text
   * node. A stretchy container has neither and is skipped.
   */
  const contentBottom = await el.evaluate((root) => {
    let bottom = root.getBoundingClientRect().top;
    for (const n of root.querySelectorAll('*')) {
      const carries = /^(INPUT|SELECT|BUTTON|TEXTAREA|CANVAS|IMG|SVG)$/.test(n.tagName)
        || [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim() !== '');
      if (!carries) continue;
      const st = getComputedStyle(n);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = n.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom > bottom) bottom = r.bottom;
    }
    return bottom;
  });
  const height = Math.min(box.height, Math.max(60, contentBottom - box.y + 12));
  await page.screenshot({
    path: `${OUT}/${file}.png`,
    clip: { x: box.x, y: box.y, width: box.width, height },
  });
  const saved = Math.round(100 * (1 - height / box.height));
  report(file, box, saved >= 3 ? `trimmed ${saved}% of the height` : '');
}

/**
 * Take `tries` frames `gap` ms apart and keep the one with the most CONTRAST.
 *
 * ⚠️ **ONE INSTANT IS LUCK, NOT A SHOT.** The same `before` frame of the same preset measured 23.5 on
 * one run and 6.6 on the next, with nothing changed but when the shutter opened: brightness swings
 * through the figure's Pulse and Wobble cycle and its rotation. A longer settle does not help — it
 * only moves the luck to a different instant. So the frames are sampled and the best one kept.
 *
 * ⚠️ **THE OBJECTIVE IS STANDARD DEVIATION, NOT BRIGHTNESS, AND THAT CORRECTION CAME FROM A FAILURE.**
 * Keeping the brightest frame is exactly wrong for a recipe that over-exposes: recipe 8.1 raises Exposure
 * to 2.5, its five samples measured 47 to 142 mean, "brightest" kept the 142 — and that frame is a
 * featureless white blob with the figure completely lost. Contrast penalises BOTH failure modes at once,
 * because a near-black frame and a blown-out frame are both nearly uniform while a legible one is not.
 */
async function shootBest(page, sel, file, tries, gap) {
  const final = `${OUT}/${file}.png`;
  const tmp = `${OUT}/${file}.__try.png`;
  let bestSd = -1, bestMean = 0;
  const seen = [];
  for (let i = 0; i < tries; i += 1) {
    if (i > 0) await page.waitForTimeout(gap);
    const el = page.locator(sel).first();
    if (await el.count() === 0) { problems.push(`${file}: ${sel} matched nothing`); return; }
    await el.screenshot({ path: tmp });
    const st = frameStats(tmp) || { mean: 0, sd: 0 };
    seen.push(`${st.mean.toFixed(0)}/${st.sd.toFixed(0)}`);
    if (st.sd > bestSd) { bestSd = st.sd; bestMean = st.mean; copyFileSync(tmp, final); }
  }
  try { rmSync(tmp); } catch { /* already gone */ }
  console.log(`  ${file}.png   (of ${tries} mean/sd: ${seen.join('  ')} -> kept sd ${bestSd.toFixed(1)},`
    + ` mean ${bestMean.toFixed(1)})`);
  if (bestSd < SD_FLOOR) {
    problems.push(`${file}: best contrast of ${tries} frames is only ${bestSd.toFixed(1)}, below ${SD_FLOOR}`
      + ' — LOOK AT IT. Low contrast means the frame is near-uniform: either almost black or blown out.');
  }
}

/** Log a written shot, with its mean luminance, and flag a recipe frame that shows nothing. */
function report(file, box, note = '') {
  const lum = (frameStats(`${OUT}/${file}.png`) || {}).mean ?? null;
  const bits = [note, lum === null ? '' : `brightness ${lum.toFixed(1)}`].filter(Boolean);
  console.log('  ' + file + '.png' + (bits.length ? `   (${bits.join(', ')})` : ''));
  if (file.startsWith('recipe-') && lum !== null && lum < DARK_FLOOR) {
    problems.push(`${file}: mean brightness ${lum.toFixed(1)} is below ${DARK_FLOOR} — LOOK AT IT. `
      + 'This flags a CANDIDATE, not a verdict: a deliberately sparse look is legitimately dark, and '
      + 'recipe-7-flat reads perfectly at 0.8.');
  }
}

/**
 * UI steps to run immediately before a named shot, so a tab can be photographed in a state it does not
 * boot into. Keyed by FILE NAME, so it applies to a main-list shot and an `EXTRA_SHOTS` one alike.
 *
 * ⚠️ **The History tab needs this or its picture teaches nothing**: the snapshot grid is empty until
 * something has been snapshotted, and an empty grid was exactly the owner's complaint. Two snapshots
 * with a look change between them give two tiles that visibly differ.
 */
const PREP = {
  /*
   * ⚠️ **The one state on the Composer that no scroll or group can reach: a level switched OFF.** The
   * level checkbox lives on the slot's own HEAD, not in a `.sl-vfx-row`, so `setControl` cannot address
   * it and `enable` is no use - a raw click on its accessible name is the only route.
   */
  'lab-composer-2': [
    ['click', '[aria-label="Structure on"]'],
    ['wait', 900],
    ['blur', null],
  ],
  'lab-history': [
    /*
     * ⚠️ **BOTH SNAPSHOTS MUST BE TAKEN WITH THIS TAB VISIBLE, and that is the whole reason this list
     * uses a key press instead of switching tabs.** A history tile is a LIVE renderer started by an
     * intersection callback; a tile added while the tab is HIDDEN never receives one and stays blank for
     * the life of the tab. Measured: snapshot, switch to Visual FX, change the look, snapshot, come back
     * — and the second tile renders nothing, with neither an 8-second wait nor a scroll nudge reviving
     * it. The canvas is sized and pooled, it has simply never been blitted. The same trap as the Reel's
     * eviction note: *visible* and *live* are separate sets.
     *
     * `ArrowRight` steps to the next preset without leaving the tab, so the two tiles are two different
     * presets — which is what the picture is for.
     */
    ['click', 'button:has-text("Snapshot")'],
    ['wait', 1500],
    ['key', 'ArrowRight'],
    ['wait', 3000],
    ['click', 'button:has-text("Snapshot")'],
    // Drop the focus ring the click leaves on the button — it is a capture artefact, not UI state.
    ['blur', null],
    ['wait', 9000],
  ],
};

/** Run a shot's `PREP` steps, if it has any. */
async function prep(page, file) {
  for (const [kind, a, b] of PREP[file] || []) {
    if (kind === 'click') {
      const loc = page.locator(a).first();
      if (await loc.count() === 0) { problems.push(`${file}: prep click ${a} matched nothing`); continue; }
      await loc.click();
    } else if (kind === 'tab') {
      await openTab(page, a);
    } else if (kind === 'option') {
      await setOption(page, a, b);
    } else if (kind === 'wait') {
      await page.waitForTimeout(a);
    } else if (kind === 'key') {
      await page.keyboard.press(a);
    } else if (kind === 'blur') {
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    }
    await page.waitForTimeout(700);
  }
}

/** Set a slider by its visible label. Sliders carry `aria-label` equal to that label. */
async function setSlider(page, label, pos) {
  const el = page.locator(`input.sl-slider[aria-label="${label}"]`).first();
  if (await el.count() === 0) { problems.push(`slider "${label}" not found`); return; }
  if (await el.isDisabled()) { problems.push(`slider "${label}" is DISABLED on this preset`); return; }
  await el.evaluate((n, v) => {
    n.value = String(v);
    n.dispatchEvent(new Event('input', { bubbles: true }));
  }, pos);
}

/**
 * Set whichever dropdown offers this option, and REPORT WHICH ONE IT WAS.
 *
 * ⚠️ **THE REPORT IS THE POINT, NOT A CONVENIENCE**, and it earned itself immediately: it showed that
 * `Plasma` was being set on the MATERIAL dropdown rather than the film look, because **`Plasma` is both
 * a film-look name and a material name** — and a tab's container stays in the DOM once built, so a
 * document-wide scan reaches the tab you are no longer on. The caption would have claimed a film look
 * the picture did not have.
 *
 * ⚠️ **HENCE `paneId`: the search is scoped to the pane just opened.** Option texts are NOT unique
 * across the UI — `Plasma`, `Fire`, `Ice`, `Liquid` and `Blend` all name more than one thing — so an
 * unscoped lookup is a coin toss decided by DOM order.
 */
async function setOption(page, value, paneId) {
  const hit = await page.evaluate(({ want, pane }) => {
    const root = pane
      ? document.querySelector(`.sl-tab-content [data-tab="${pane}"]`)
      : document;
    if (!root) return null;
    for (const sel of root.querySelectorAll('select')) {
      for (const o of sel.options) {
        if (o.value === want || o.textContent.trim() === want) {
          sel.value = o.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          const row = sel.closest('.sl-vfx-row');
          const label = row?.querySelector('.sl-vfx-label')?.textContent?.trim();
          return label || sel.className || sel.tagName;
        }
      }
    }
    return null;
  }, { want: value, pane: paneId });
  if (!hit) problems.push(`no dropdown in ${paneId || 'the page'} offers the option "${value}"`);
  else console.log(`      set ${JSON.stringify(value)} on the "${hit}" dropdown`);
  return hit;
}

/**
 * Set any Visual FX control, found by its SECTION title and its row label.
 *
 * ⚠️ **THE VISUAL FX TAB CARRIES NO `aria-label` ANYWHERE** — measured: a scan of that pane returns an
 * empty list, while the Sliders, Composer and Transmap tabs are fully labelled. So its controls are
 * found by the text of the `.sl-vfx-label` in the same `.sl-vfx-row`.
 *
 * ⚠️ **AND THE SECTION IS REQUIRED, NOT A CONVENIENCE.** `Enable` is the row label of FIVE different
 * checkboxes in this tab — Neon Lines, Curl Noise, Liquid Field, Dye Field and Translation Map — and
 * `Width`, `Blend`, `Scale`, `Strength` and `Evol. Speed` each repeat too. A row-label lookup on its own
 * would silently set whichever came first in the DOM, which is the same defect the unscoped `Plasma`
 * dropdown had.
 *
 * `value` is a percentage of the track for a slider, or a boolean for a checkbox.
 */
async function setVfxControl(page, section, label, value) {
  const err = await page.evaluate(({ sec, want, v }) => {
    const pane = document.querySelector('.sl-tab-content [data-tab="visual-fx"]');
    if (!pane) return 'the Visual FX pane is not built';
    const titles = [...pane.querySelectorAll('.sl-section-title')];
    const i = titles.findIndex((t) => t.textContent.trim() === sec);
    if (i < 0) return `no section titled ${JSON.stringify(sec)}`;
    // Rows between this section title and the next one, wherever they sit in the tree.
    const after = titles[i + 1];
    const rows = [...pane.querySelectorAll('.sl-vfx-row')].filter((r) => {
      const posT = titles[i].compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING;
      const posN = !after || (after.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_PRECEDING);
      return posT && posN;
    });
    for (const row of rows) {
      if (row.querySelector('.sl-vfx-label')?.textContent.trim() !== want) continue;
      const box = row.querySelector('input[type=checkbox]');
      if (box) {
        if (box.checked !== Boolean(v)) box.click();
        return null;
      }
      const el = row.querySelector('input[type=range]');
      if (!el) return 'that row has neither a slider nor a checkbox';
      const lo = Number(el.min), hi = Number(el.max);
      el.value = String(lo + (Number(v) / 100) * (hi - lo));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return null;
    }
    return `no row labelled ${JSON.stringify(want)} in ${JSON.stringify(sec)}`;
  }, { sec: section, want: label, v: value });
  if (err) problems.push(`Visual FX ${section} / ${label}: ${err}`);
  else console.log(`      set Visual FX ${section} / ${label} = ${value}`);
}

/**
 * Set ONE control, found by its pane, its section heading and its row label, to an exact target.
 *
 * `target` may be a boolean (a checkbox), a string (a dropdown, matched on option text) or a number
 * (a slider, matched on the row's READOUT).
 *
 * ⚠️ **THE SECTION IS PART OF THE ADDRESS, NOT A CONVENIENCE.** `Enable` labels five rows in Visual FX
 * and three in Materials; `Strength`, `Blend`, `Scale` and `Width` all repeat. Matching on the label
 * alone silently takes whichever comes first in the DOM.
 *
 * ⚠️ **A NUMERIC TARGET IS REACHED BY BINARY SEARCH ON THE READOUT, because half of these sliders do
 * not hold their own value.** Measured: `Exposure` is `min=0.1 max=4 value=0.7` — the value itself —
 * while `Particle Size` is `min=0 max=1 value=0.5` and reads out `1.00x`. Writing `el.value = 2` is
 * correct for the first and nonsense for the second, and nothing about the element says which it is.
 * The readout is the only thing that speaks the user's units, so it is the oracle. The search assumes
 * the mapping is monotonic, which every track here is.
 *
 * Returns the readout actually achieved, so the caller can log it and the guide can quote it.
 */
async function setControl(page, pane, section, label, target) {
  const res = await page.evaluate(({ paneId, sec, want, tgt }) => {
    const root = document.querySelector(`.sl-tab-content [data-tab="${paneId}"]`);
    if (!root) return { err: `pane ${paneId} is not built` };
    const vis = (e) => { let n = e; while (n && n !== document.body) { if (getComputedStyle(n).display === 'none') return false; n = n.parentElement; } return true; };

    // Heading elements, in document order: `.sl-section-title` in Visual FX, plain styled divs in Materials.
    /*
     * ⚠️ **THE COLLAPSIBLE GROUP HEADS ARE EXCLUDED, AND LEAVING THEM IN WAS A REAL DEFECT WITH A
     * PERFECTLY REASONABLE-LOOKING ERROR.** `Crystals` names BOTH the group head and the section title
     * inside it; `Material` and `Fire` do too. The scan is in document order, so it matched the GROUP
     * head, took the section run to end at the next heading - which is the section title of the same
     * name, one line below - and reported `no row labelled "Enable" in Crystals` over a section that was
     * open, built and correct. **That is *a NAME is a primary key* arriving in this script**, and the
     * group head is the copy with no rows of its own, so it is the copy to drop.
     *
     * ⚠️ It also drops the group's COUNT badge, which is a leaf with a one-character text and would
     * otherwise be a heading named `1`.
     */
    const heads = [...root.querySelectorAll('*')].filter((e) => e.children.length === 0
      && e.textContent.trim().length > 0 && e.textContent.trim().length < 30 && vis(e)
      && !e.closest('.sl-vfx-group-head') && !e.closest('.sl-vfx-sub-head'));
    const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    /*
     * ⚠️ **A SECTION RUNS TO THE NEXT HEADING OF THE SAME KIND, and "same kind" means the same
     * `className`.** The first attempt guessed the boundary from whether a later heading's row had a
     * control, and it failed on `Tone Map`: the Customize panel's sub-headings are a different kind of
     * heading from the tab's `.sl-section-title`s, so the search ran past the one it wanted. Keying the
     * boundary on the heading's own class makes each level bound itself — `.sl-section-title` sections
     * end at the next `.sl-section-title`, a Customize sub-group ends at the next sub-group, and
     * Materials' own headers likewise — with no per-tab special cases.
     */
    let from = null, to = null;
    if (sec) {
      from = heads.find((h) => h.textContent.trim() === sec);
      if (!from) return { err: `no heading ${JSON.stringify(sec)} in ${paneId}` };
      const kind = from.className;
      to = heads.find((h) => h !== from && h.className === kind && after(from, h)) || null;
    }

    const rows = [...root.querySelectorAll('div')].filter((r) => {
      if (!r.querySelector(':scope > input, :scope > select, :scope > div > input, :scope > div > select')) return false;
      if (!vis(r)) return false;
      if (from && !after(from, r)) return false;
      if (to && !after(r, to) && r !== to) return false;
      return true;
    });

    for (const row of rows) {
      const lab = row.querySelector('.sl-vfx-label')
        || [...row.childNodes].find((n) => n.nodeType === 1 && /^(LABEL|SPAN)$/.test(n.tagName));
      if (!lab || lab.textContent.trim() !== want) continue;

      const box = row.querySelector('input[type=checkbox]');
      if (box && typeof tgt === 'boolean') {
        if (box.checked !== tgt) box.click();
        return { ok: String(box.checked) };
      }
      const sel = row.querySelector('select');
      if (sel && typeof tgt === 'string') {
        const o = [...sel.options].find((x) => x.textContent.trim() === tgt || x.value === tgt);
        if (!o) return { err: `${want}: no option ${JSON.stringify(tgt)}` };
        sel.value = o.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: o.textContent.trim() };
      }
      const el = row.querySelector('input[type=range]');
      if (!el || typeof tgt !== 'number') return { err: `${want}: no control matching that target type` };

      // The readout: the last text in the row that begins with a number.
      const readText = () => {
        const cands = [...row.querySelectorAll('span,div')]
          .map((e) => e.textContent.trim())
          .filter((t) => t && t.length < 24 && /^-?\d/.test(t));
        return cands.length ? cands[cands.length - 1] : null;
      };
      const read = () => { const t = readText(); const m = t && t.match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
      const put = (v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };

      let lo = Number(el.min), hi = Number(el.max);
      const step = Number(el.step) || 0.001;
      put(lo); const vLo = read();
      put(hi); const vHi = read();
      if (!isFinite(vLo) || !isFinite(vHi)) return { err: `${want}: no numeric readout to aim at` };

      /*
       * ⚠️ **SHORT-CIRCUIT: when the input HOLDS its own value, write it and stop.** Half of these
       * sliders do (`Exposure` is min 0.1 / max 4 and reads out 0.1 to 4), and for those a binary
       * search on the readout is both slower and LESS exact — it converged on 2.4 for a target of 2.5,
       * because it can only land on positions the step allows and the readout is rounded on the way.
       * Writing the value directly hits the step exactly.
       */
      if (Math.abs(vLo - lo) <= Math.abs(lo) * 0.01 + 1e-6
          && Math.abs(vHi - hi) <= Math.abs(hi) * 0.01 + 1e-6) {
        put(Math.min(hi, Math.max(lo, tgt)));
        return { ok: readText(), note: (tgt < lo || tgt > hi) ? `clamped to ${lo}..${hi}` : '' };
      }
      const rising = vHi > vLo;
      if (tgt < Math.min(vLo, vHi) || tgt > Math.max(vLo, vHi)) {
        put(rising ? (tgt > vHi ? hi : lo) : (tgt > vLo ? lo : hi));
        return { ok: readText(), note: `clamped — the track reaches ${vLo} to ${vHi}` };
      }
      for (let i = 0; i < 40; i += 1) {
        const mid = (lo + hi) / 2;
        put(mid);
        const v = read();
        if ((v < tgt) === rising) lo = mid; else hi = mid;
      }
      /*
       * ⚠️ **THEN SWEEP THE NEIGHBOURING STEPS AND KEEP THE CLOSEST.** The bisection narrows the
       * POSITION, but the reachable values are quantised by `step`, so the position it converges on is
       * not necessarily the step whose readout is nearest the target. Checking a few steps either side
       * costs nothing and is what turns "close" into "the best this track can do".
       */
      let best = null, bestErr = Infinity;
      const centre = (lo + hi) / 2;
      for (let k = -4; k <= 4; k += 1) {
        const pos = Math.min(Number(el.max), Math.max(Number(el.min), centre + k * step));
        put(pos);
        const err = Math.abs(read() - tgt);
        if (err < bestErr) { bestErr = err; best = pos; }
      }
      put(best);
      return { ok: readText() };
    }
    return { err: `no row labelled ${JSON.stringify(want)}${sec ? ' in ' + sec : ''}` };
  }, { paneId: pane, sec: section, want: label, tgt: target });

  /*
   * ⚠️ **A MISSING ROW MAY ONLY BE COLLAPSED, SO EXPAND AND RETRY ONCE BEFORE REPORTING.** The Translation
   * Map layer's own controls — `Pattern`, `Strength`, `Drift`, the zoom centre — live behind the row's `▸`
   * expander, and **setting one of them re-renders the row and collapses it again**: measured, `Pattern`
   * was set successfully and `Strength` then reported "no row labelled" from the very same section one
   * step later. Without this retry that reads as a missing control rather than a closed panel.
   */
  if (res.err && /no row labelled/.test(res.err)) {
    const opened = await page.evaluate((paneId) => {
      const root = document.querySelector(`.sl-tab-content [data-tab="${paneId}"]`);
      const bs = root ? [...root.querySelectorAll('button')].filter((b) => b.textContent.trim() === '▸') : [];
      bs.forEach((b) => b.click());
      return bs.length;
    }, pane);
    if (opened > 0) {
      await page.waitForTimeout(600);
      return setControl(page, pane, section, label, target);
    }
  }
  if (res.err) { problems.push(`setControl(${pane}/${section}/${label}): ${res.err}`); return null; }
  console.log(`      ${pane} / ${section || '-'} / ${label} = ${res.ok}`
    + (res.note ? `   ⚠️ ${res.note}` : ''));
  return res.ok;
}

/**
 * Open every COLLAPSED LAYER ROW in a pane — the `▸` button at the head of each Translation Map layer.
 *
 * ⚠️⚠️ **`expandGroups()` DOES NOT DO THIS AND CANNOT BE MADE TO.** It clicks `.sl-vfx-group-head` and
 * `.sl-vfx-sub-head`; the layer expander is a plain `button` carrying the single character `▸` and no class
 * of its own. **A helper that expands "groups" expands the two classes it NAMES, not everything that looks
 * expandable** — and the consequence was silent: every per-layer field control (`Pattern`, `Shape`, `Shape
 * Mix`, `Angle`, `Strength`, `Detail`, `Drift`, the whole `Zoom half`) was in no picture in the manual,
 * because the only code that ever clicked that button was `setControl`'s retry path, which runs only when a
 * row lookup MISSES — and no recipe's lookup missed.
 *
 * ⚠️ **It clicks only the CLOSED ones (`▸`, never `▾`)**, because the button is a toggle: an unconditional
 * click on an already-open layer shuts it, which is `expandGroups`' own `aria-expanded` lesson in a control
 * that has no `aria-expanded` to read.
 *
 * ⚠️ **A DISABLED expander is skipped rather than reported** — a style that owns no body legitimately has
 * nothing to open, and the engine disables the button to say so.
 */
async function expandLayerRows(page, paneId) {
  const n = await page.evaluate((pane) => {
    const root = document.querySelector(`.sl-tab-content [data-tab="${pane}"]`);
    if (!root) return -1;
    const shut = [...root.querySelectorAll('button')]
      .filter((b) => b.textContent.trim() === '▸' && !b.disabled);
    shut.forEach((b) => b.click());
    return shut.length;
  }, paneId);
  if (n < 0) problems.push(`expandLayerRows: pane ${paneId} is not built`);
  else console.log(`      opened ${n} layer row(s) in ${paneId}`);
  await page.waitForTimeout(600);
}

/**
 * Set one cell of an `Angle` pair, in DEGREES, and REPORT THE READOUT IT LANDED ON.
 *
 * ⚠️ **`setControl` cannot address these, and that is a property of the row rather than a gap in it.** The
 * pair is ONE row with TWO cells sharing the label `Angle`, so a row-label lookup finds the row and then
 * takes its FIRST `input[type=range]` — the X cell, whatever you asked for — while the readout scan takes
 * the LAST numeric text in the row, which is the Y cell's. The two halves of the search would address
 * different handles. The per-cell `aria-label` (`Angle X`, `Angle Y`, `Zoom Angle X`, `Zoom Angle Y`) is
 * the engine's own answer to this and is what is used here.
 *
 * ⚠️ **`min`/`max` ARE POSITIONS (±1), NOT DEGREES — this is a TRACKED row.** The track is linear over
 * ±90°, so the position is `deg / 90`. ⚠️ **The written position is never trusted: the cell's own
 * `.sl-vfx-triplet-value` is re-read afterwards and a disagreement is REPORTED**, because the handler
 * quantises to whole degrees and a caption quoting what this script asked for rather than what the panel
 * prints is exactly the class of false claim a caption cannot be checked for.
 */
async function setAngle(page, pane, ariaLabel, deg) {
  const res = await page.evaluate(({ paneId, name, d }) => {
    const root = document.querySelector(`.sl-tab-content [data-tab="${paneId}"]`);
    if (!root) return { err: `pane ${paneId} is not built` };
    const all = [...root.querySelectorAll(`input[type=range][aria-label="${name}"]`)];
    if (all.length === 0) return { err: `no slider named ${JSON.stringify(name)}` };
    const el = all[0];
    // ±90° over a LINEAR track whose element bounds are ±1 — see `WAVE_ANGLE_TRACK`.
    el.value = String(Math.max(-1, Math.min(1, d / 90)));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const read = el.parentElement?.querySelector('.sl-vfx-triplet-value')?.textContent?.trim() ?? null;
    return { ok: read, extra: all.length - 1 };
  }, { paneId: pane, name: ariaLabel, d: deg });
  if (res.err) { problems.push(`setAngle(${pane}/${ariaLabel}): ${res.err}`); return null; }
  console.log(`      ${pane} / ${ariaLabel} = ${res.ok}   (asked ${deg}°)`
    + (res.extra ? `   ⚠️ ${res.extra} more slider(s) share that name — the FIRST was set` : ''));
  if (res.ok !== `${Math.round(deg)}°`) {
    problems.push(`setAngle(${pane}/${ariaLabel}): asked ${deg}° and the panel reads ${res.ok}`);
  }
  return res.ok;
}

async function openTab(page, id) {
  await page.locator(`.sl-tab-btn[data-tab="${id}"]`).click();
  await page.waitForTimeout(500);
  // ⚠️ **EVERY RECIPE NEEDS THIS AND NONE OF THEM SAYS SO** - see `expandGroups`.
  await expandGroups(page, id);
}

/**
 * Load a named library preset by clicking its tile in the preview grid, then return to the Lab.
 *
 * ⚠️ **THERE IS NO URL PARAMETER FOR A PRESET** — `?tab=` and `?reel=` exist, `?preset=` does not — so a
 * shot whose subject is a preset's own state has to come in through the grid, exactly as a `RECIPES` entry
 * does. **Nothing may be added to `src/` for this script's benefit**, so this is the route.
 *
 * ⚠️ **SCOPED TO `.pg-tile`, for the reason the recipe loop states at length**: `[data-preset]` matches the
 * Reel tab's own tiles too, which are built in the hidden half of the panel, report a 0×0 box and can never
 * be scrolled into view.
 */
async function pickPreset(page, file, name) {
  const tile = page.locator(`.pg-tile[data-preset="${name}"]`).first();
  if (await tile.count() === 0) { problems.push(`${file}: no tile for ${JSON.stringify(name)}`); return false; }
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await page.waitForTimeout(2500);
  console.log(`      loaded the preset ${JSON.stringify(name)}`);
  return true;
}

/**
 * Expand the collapsible GROUPS in a pane - all of them, or exactly one when `only` is given.
 *
 * ⚠️ **WITHOUT THIS EVERY RECIPE SILENTLY MISSES ITS TARGET, and the failure is not where you would
 * look for it.** `setControl` filters candidate headings through `vis()`, and Visual FX, Materials and the
 * Composer now ship with their groups CLOSED - so `no section titled "Film Look"` is reported for a
 * section that is built, correct and one click away. The same goes for `scrollTo`, which uses `:visible`.
 * **A closed group is indistinguishable from a deleted section to every selector in this file.**
 *
 * ⚠️ **`only` COLLAPSES THE OTHERS RATHER THAN JUST OPENING ONE, which is what makes a group's shot
 * worth taking.** With all five of Visual FX's groups open the tab is several thousand pixels tall and a
 * shot of it is a wall of rows with no visible structure; with one open the picture is the group, and the
 * four closed heads above and below it show the reader where they are. That is the layout the UI was
 * reorganised FOR, so it is the layout the manual should photograph.
 *
 * ⚠️ **IT CLICKS ONLY WHERE `aria-expanded` DISAGREES with the wanted state** - the heads are toggles,
 * so an unconditional click on an already-open group closes it.
 */
async function expandGroups(page, paneId, only = null) {
  const n = await page.evaluate(({ pane, want }) => {
    const root = document.querySelector(`.sl-tab-content [data-tab="${pane}"]`)
      ?? document.querySelector(`.tab-content[data-tab="${pane}"]`);
    if (!root) return -1;
    let clicked = 0;
    for (const head of root.querySelectorAll('.sl-vfx-group-head')) {
      const name = head.querySelector('span')?.textContent?.trim() ?? '';
      const open = want === null ? true : name === want;
      if ((head.getAttribute('aria-expanded') === 'true') !== open) { head.click(); clicked++; }
    }
    /*
     * The section-level heads (`Deformation` is the only one today) are opened whenever their own group
     * is - a closed sub-head inside an open group is a hole in the picture, and the reader has no way to
     * tell it from a section that is not there.
     */
    for (const sub of root.querySelectorAll('.sl-vfx-sub-head')) {
      const parentOpen = sub.closest('.sl-vfx-group-body');
      const show = !parentOpen || !parentOpen.hidden;
      if (show && sub.getAttribute('aria-expanded') === 'false') { sub.click(); clicked++; }
    }
    return clicked;
  }, { pane: paneId, want: only });
  if (n < 0) problems.push(`expandGroups: pane ${paneId} is not built`);
  else if (n > 0) console.log(`      opened ${n} group(s)${only ? ` (only ${only})` : ''} in ${paneId}`);
  await page.waitForTimeout(450);
}

/* ── mode: panels ────────────────────────────────────────────────────────────────────────────────── */
if (MODE === 'panels' || MODE === 'all') {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  console.log('panels:');
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.locator(LAB_BTN).waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(4500);
  // Not trimmed: this shot's subject is the whole window, empty space included.
  if (wanted('ui-grid-full')) await shoot(page, 'body', 'ui-grid-full', false);
  if (wanted('ui-grid-panel')) await shoot(page, '.right-panel', 'ui-grid-panel');

  for (const [id, file] of TABS) {
    const extras = EXTRA_SHOTS.filter((e) => e.tab === id && wanted(e.file));
    if (!wanted(file) && extras.length === 0) continue;
    await page.goto(`${BASE}/?tab=${id}`, { waitUntil: 'load' });
    try {
      await page.locator(`.sl-tab-content [data-tab="${id}"]`).waitFor({ state: 'visible', timeout: 20_000 });
    } catch { problems.push(`${file}: pane never became visible`); }
    await page.waitForTimeout(2500);
    /*
     * WARN **THE MAIN SHOT IS TAKEN FIRST, BEFORE ANY GROUP IS TOUCHED, and that is the whole point of
     * where this call sits.** It is the only shot of the tab AS IT OPENS - and for the three regrouped
     * tabs that state is now the interesting one, because it is what every reader meets and what no
     * scrolled or expanded shot can show. Moving a group-opening step above this line would silently
     * replace that picture with a second view of the group's contents.
     */
    if (wanted(file)) {
      await prep(page, file);
      await shoot(page, '.right-panel', file);
    }

    // Further shots of the same tab: one group open, a gated body ticked, or scrolled.
    for (const extra of extras) {
      /*
       * ⚠️ **EVERY EXTRA RELOADS THE PAGE FIRST, AND WITHOUT IT A SHOT INHERITS THE PREVIOUS SHOT'S
       * EDITS.** Measured: `lab-visual-fx-fields.png` was captioned *"a preset that uses none of it"* and
       * showed the **Image** group carrying an activity badge of 1 - because the shot before it had ticked
       * `Translation Map`'s `Enable` and nothing undid it. The caption and the picture disagreed, and the
       * picture was the one that was wrong about the preset.
       *
       * ⚠️ **IT IS SAFE ONLY BECAUSE EVERY EXTRA IS SELF-SUFFICIENT: `preset`, `group`, `options`,
       * `enable`, `set`, `expandLayers`, `angles` and `scrollTo` each restate what they need rather than
       * relying on what ran before.** Checked for every entry in the array — and an entry that adds a step
       * must restate ALL of them, not only the new one.
       * **A shot that depended on its predecessor would now break, and that is the right failure**
       * - it is the same rule the Composer shots learned the hard way, where an untick leaked forward and
       * made `scrollTo` miss. The cost is one reload and one settle per shot.
       */
      /*
       * ⚠️ **`preset` REPLACES THE `?tab=` ROUTE RATHER THAN ADDING TO IT**, because the Lab has to be
       * closed to reach the grid: the shot loads the page bare, clicks the tile, and only then opens the
       * Lab and the tab. `openTab` is what the recipes use for the same journey.
       */
      if (extra.preset) {
        await page.goto(`${BASE}/`, { waitUntil: 'load' });
        await page.locator(LAB_BTN).waitFor({ state: 'visible', timeout: 60_000 });
        await page.waitForTimeout(3000);
        if (!await pickPreset(page, extra.file, extra.preset)) continue;
        await page.locator(LAB_BTN).click();
        await page.locator('.sl-tab-bar').waitFor({ state: 'visible', timeout: 20_000 });
        await openTab(page, id);
      } else {
        await page.goto(`${BASE}/?tab=${id}`, { waitUntil: 'load' });
      }
      await page.waitForTimeout(2500);
      /*
       * ⚠️ **ORDER IS LOAD-BEARING AND EVERY STEP DEPENDS ON THE ONE BEFORE IT.** `group` first,
       * because `setOption` and `setControl` both filter on VISIBILITY and cannot see into a closed
       * group; `options` next, because a render-mode switch is what CREATES `Liquid Surface` and
       * `Volume Render`; `enable` after that, because those rows only exist once the mode does;
       * `set` after that, for anything that is neither a dropdown hunt nor a gate; `expandLayers` after
       * THAT, because a per-layer edit REBUILDS the layer row and shuts it again; `angles` next, since
       * the pair it addresses can be inside a layer body; and `scrollTo` last, because everything above
       * it changes the page height.
       */
      if (extra.group) await expandGroups(page, extra.tab, extra.group);
      for (const opt of extra.options || []) {
        await setOption(page, opt, extra.tab);
        await page.waitForTimeout(900);
      }
      /*
       * ⚠️ **THE THIRD ELEMENT IS OPTIONAL AND EXISTS BECAUSE NOT EVERY GATE IS A CHECKBOX.** `Physarum
       * Network` has no enabler at all — its activation scalar is `Blend`, so its gate is `blend > 0` and
       * the way to open it for a shot is a NUMBER. Defaulting to `true` keeps the checkbox cases short
       * while making the odd one out explicit rather than a silent `no row labelled "Enable"`.
       */
      for (const [sec, label, value] of extra.enable || []) {
        await setControl(page, extra.tab, sec, label, value === undefined ? true : value);
        await page.waitForTimeout(500);
      }
      // `set` is `enable`'s general form — any `[section, label, target]` the shot needs, dropdown or slider.
      for (const [sec, label, value] of extra.set || []) {
        await setControl(page, extra.tab, sec, label, value);
        await page.waitForTimeout(500);
      }
      if (extra.expandLayers) await expandLayerRows(page, extra.tab);
      for (const [label, deg] of extra.angles || []) {
        await setAngle(page, extra.tab, label, deg);
        await page.waitForTimeout(500);
      }
      /*
       * `:visible` is required: the label also exists in a hidden copy, which cannot be scrolled to.
       * `scrollTo` may carry an `@index` because a row label repeats once per wave slot in the
       * Composer — `Wobble rate@2` is Detail's, and without the index every shot lands on Body's.
       *
       * ⚠️ **IT IS NOW OPTIONAL: a shot whose subject is ONE GROUP has no scroll position to pick** —
       * the group starts at the top of the panel because the heads above it are one line each. Defaulting
       * it to the group's own head would be the same thing with more machinery.
       */
      if (extra.scrollTo) {
        const [stText, stIdx] = extra.scrollTo.split('@');
        const target = page.locator('.right-panel')
          .locator(`:text-is(${JSON.stringify(stText)}):visible`)
          .nth(stIdx === undefined ? 0 : Number(stIdx));
        if (await target.count() === 0) {
          problems.push(`${extra.file}: scrollTo ${JSON.stringify(extra.scrollTo)} matched nothing visible`);
        } else {
          await target.scrollIntoViewIfNeeded();
        }
        await page.waitForTimeout(800);
      }
      /*
       * `search` types into the Lab header's settings search and waits for its results list.
       *
       * ⚠️ **LAST, after `scrollTo`, and nothing may move focus between it and the shot.** The results
       * list closes on the field's `blur`, so any later step that clicks or blurs would photograph an empty
       * header. ⚠️ **The FIRST keystroke builds every unbuilt tab** (`TabRegistry.buildAll()`), so the wait
       * is for the results ROW rather than a fixed delay — measured several seconds under SwiftShader.
       */
      if (extra.search) {
        await page.locator('.sl-search-field').fill(extra.search);
        try {
          await page.waitForSelector('.sl-search-results .sl-search-row', { timeout: 60_000 });
        } catch { problems.push(`${extra.file}: search ${JSON.stringify(extra.search)} returned no rows`); }
        await page.waitForTimeout(700);
      }
      await prep(page, extra.file);
      await shoot(page, '.right-panel', extra.file);
    }
  }
  await page.close();
}

/* ── mode: recipes ───────────────────────────────────────────────────────────────────────────────── */
if (MODE === 'recipes' || MODE === 'all') {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  console.log('recipes:');
  for (const r of RECIPES) {
    if (!wanted(r.file)) continue;
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.locator(LAB_BTN).waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(1500);

    /*
     * ⚠️ **SCOPED TO `.pg-tile`, AND THAT IS NOT A TIDINESS POINT.** `[data-preset]` matches **554**
     * elements, not 277: the preview grid's tiles AND the Reel tab's own tiles, which are built in the
     * hidden half of the panel and report a 0x0 box. An unscoped `.first()` picks a reel tile and
     * `scrollIntoViewIfNeeded` then waits out its full timeout on an element that can never be shown.
     */
    const tile = page.locator(`.pg-tile[data-preset="${r.preset}"]`).first();
    if (await tile.count() === 0) { problems.push(`${r.file}: no tile for "${r.preset}"`); continue; }
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    /*
     * ⚠️ **A PSSS PRESET IS NOT FINISHED DRAWING WHEN IT STARTS.** The trail accumulates over many
     * frames, the wave modulation (Pulse and Wobble) can take a minute to come round, and a rotation of
     * a couple of rpm has barely begun after a second. 3 s produced thin, half-formed pictures — the
     * owner's report on the recipe images. These waits are deliberately long; the capture run is slow
     * either way and a half-drawn figure is worth nothing in the guide.
     */
    if (r.before) {
      // ⚠️ ONE shared `before` for all six recipes — they all start from the same preset.
      await page.waitForTimeout(SETTLE_BEFORE);
      await shootBest(page, '.left-panel', 'recipe-0-cycloid-before', TRIES, TRY_GAP);
    }

    await page.locator(LAB_BTN).click();
    await page.locator('.sl-tab-bar').waitFor({ state: 'visible', timeout: 20_000 });

    for (const step of r.steps) {
      const [kind, a, b, c] = step;
      if (kind === 'set') {
        // ['set', pane, section, label, target] — the general route, and the only one the new recipes use.
        await openTab(page, a);
        await setControl(page, a, b, c, step[4]);
      }
      else if (kind === 'slider') { await openTab(page, 'sliders'); await setSlider(page, a, b); }
      else if (kind === 'vfx') { await openTab(page, 'visual-fx'); await setVfxControl(page, a, b, c); }
      else {
        const pane = kind === 'material' ? 'materials' : 'visual-fx';
        await openTab(page, pane);
        await setOption(page, a, pane);
      }
      await page.waitForTimeout(400);
    }
    /*
     * ⚠️ **THE `after` SHOT NEEDS LONGER THAN THE `before` ONE**, because several recipes lengthen the
     * trail or slow the figure down — exactly the changes that take the most frames to show. Dropping
     * Speed to 0.3x means the figure now needs three times as long to travel the same distance.
     */
    await page.waitForTimeout(SETTLE_AFTER);
    await shootBest(page, '.left-panel', `${r.file}-after`, TRIES, TRY_GAP);
  }
  await page.close();
}

await browser.close();
if (problems.length) {
  console.log('\nPROBLEMS (' + problems.length + '):');
  for (const p of problems) console.log('  ' + p);
  process.exitCode = 1;
} else {
  console.log('\nall captures written to ' + OUT);
}
