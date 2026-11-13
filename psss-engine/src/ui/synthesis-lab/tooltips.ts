/**
 * @file ONE table of hover tooltips for the whole Lab UI, keyed by the control's own descriptor key.
 *
 * ## Why a table rather than a `title` at each call site
 *
 * The Visual FX tab is built from a control descriptor table and its header states the rule: *add a control
 * by writing a descriptor, never by hand-wiring*. Hand-setting `.title` on 82 rows would be exactly that
 * hand-wiring, times 82, and the next control added would silently have no tooltip with nothing to say so.
 * So the factories (`slider`, `check`, `select`, `rgbRow`, `tripletRow`) resolve
 * `spec.title ?? CONTROL_TIPS[spec.key]` and every descriptor gets one for free.
 *
 * ⚠️ **`spec.title` WINS.** A handful of descriptors carry a hand-written `title` because the text is derived
 * from the control's own arithmetic (the force gate's two, Dispersion, and every `layerSlider`). Those are
 * more specific than anything a shared table can say, so the table never overrides them — it fills gaps.
 *
 * ⚠️ **A key here that no control uses is INERT AND INVISIBLE**, which is the one failure mode this shape
 * has: `tsc` cannot check a `Record<string, string>` against the descriptor keys, so a renamed key drops its
 * tooltip silently. `namecheck`-style coverage is not worth a checker for a tooltip, but the keys are the
 * same serialised overlay names seven checkers already grep, so they do not move often. When one does, grep
 * this file for it.
 *
 * ## What a tooltip is for here
 *
 * The user's brief: *"all controls and headers in the UI shall get tooltips with some explanation on how to
 * use it and what effect this specific control has"*, with the inline prose cut to one or two sentences. So
 * each entry answers both halves — what moving it does, and what to reach for it for — and the detail that
 * used to sit in a paragraph under the section now lives here. Two or three sentences is the working
 * ceiling: a tooltip longer than a hover is worth is prose again, in a worse place.
 *
 * ⚠️ **A tooltip must not be the only place a PRECONDITION is stated.** Several controls are exact no-ops
 * until something else is non-zero (Depth Parallax needs a warp layer; the gate's Age/Temperature need a
 * material; Time Warp needs a non-flat field). Those keep their inline note as well, because a hover is
 * discovered only by someone who already suspects the control — which is not the person who has just
 * concluded the feature is broken.
 */

/**
 * Tooltips for `visual-fx.ts` descriptors, keyed by `SliderSpec`/`CheckSpec`/`SelectSpec`/`RgbSpec`/
 * `TripletSpec` `key`. Resolved in the five control factories.
 */
// ⚠️ **THE ONLY IMPORT IN THIS FILE, AND IT MUST STAY A `type` IMPORT.** It sits below the `@file` block so
// that block stays the first thing in the file. `LOCK_CATEGORY_TIPS` is keyed by `CategoryLock` (24.2) so
// that a missing category is a compile error rather than the word "undefined" in a tooltip; a VALUE import
// here would give this leaf table a dependency on the exploration graph, and three checkers read it as text.
import type { CategoryLock } from '../../exploration/state.ts';

export const CONTROL_TIPS: Record<string, string> = {
  // ---- Framing & Timing ----
  figureScale: 'Multiplies the automatic canvas fit, 0.2×–5.0×. The fit preserves the preset’s authored '
    + 'aspect ratio and so letterboxes on a wide canvas — raise this to fill the screen, or go past 1× to '
    + 'frame part of a large figure. Saved with the preset.',
  speedFactor: 'Master time multiplier: scales wave motion AND every rotation rate together, so the figure '
    + 'keeps its shape and only its tempo changes. At 0 the figure freezes in its current pose, which is the '
    + 'way to study a still frame. Saved with the preset.',
  particleCount: 'How many particles trace the curve, 100–200 000. More particles fill the curve into a '
    + 'continuous surface; fewer leave it as discrete points and cost less per frame. Raise this after '
    + 'raising Symmetry, which divides the same particles between the arms.',
  symmetryFold: 'Folds the figure into n identical sectors in model space, so the symmetry axis tumbles with '
    + 'the 3D rotation instead of being pinned to the screen. Integer only — a half fold is a figure whose '
    + 'arms do not close. Each arm carries 1/n of the density, so raise Particle Number to compensate.',
  symmetryMirror: 'Reflects each sector into its neighbour so the seam matches. Recommended: the un-mirrored '
    + 'form jumps at the sector edge, which visibly breaks trails in Ribbon and Neon modes. Meaningless at '
    + 'fold 1, where the row is hidden.',
  // ---- v8 Phase 42 — 3-D Symmetry ----
  sym3dLayout: 'Repeats the whole figure in 3-D around the centre. Choose where the copies sit: on a Ring or a Sphere '
    + 'of as many positions as you like, or on the points of a solid — Tetrahedron, Octahedron, Cube, Icosahedron, '
    + 'Dodecahedron. Each copy is the complete figure, never cut, and the arrangement turns with the figure.',
  sym3dPositionsRing: 'How many positions around the ring, evenly spaced: 2 doubles the figure, 3 triples it, and so on.',
  sym3dPositionsSphere: 'How many positions on the sphere, spread as evenly as possible. Most counts have no perfectly '
    + 'symmetric arrangement on a sphere, so this is even rather than crystal-like.',
  sym3dOn: 'Which points of the solid carry a copy: its vertices, the middles of its edges, or the centres of its '
    + 'faces. The cube has 8, 12 and 6; the icosahedron 12, 30 and 20.',
  sym3dLocal: 'How many copies share each position, turned evenly about it: 2 makes a pair, 3 a three-way star. The '
    + 'total is positions × copies here.',
  sym3dRadius: 'How far the positions are from the centre. At 0 every copy sits on the centre and they overlap into one '
    + 'symmetric solid; from about 1.5 they separate into distinct copies. The whole arrangement is scaled back so it '
    + 'keeps the figure\'s size.',
  sym3dMirrors: 'Mirrors every second copy at a position, so pairs become mirror images of each other. Shown once there '
    + 'are at least 2 copies at each position.',
  sym3dFacing: 'Outward turns each copy to face away from the centre, so a ring reads as a wreath and a sphere as a '
    + 'shell. Parallel keeps every copy the way the original faces.',

  // ---- Deformation (v8 Phase 30) ----
  /*
   * v8 `32.1`/`32.2` (`E129b`) — Barr's other two deformers.
   *
   * ⚠️ **BOTH CARRY THEIR PRECONDITION IN THE TEXT, for `twist`'s reason exactly**: they read a
   * coordinate, so on a figure with no extent on that axis they correctly do nothing — 63 of 294 preset
   * bodies have zero z amplitude. That is invariant 13's harder shape, and a tooltip is the only place it
   * can be answered before the user concludes the control is broken.
   */
  taper: 'Scales the figure\u2019s cross-section along each axis \u2014 so it flares open at one end and '
    + 'pinches shut at the other, turning a tube into a cone or a spindle. Centre is off, and the slider '
    + 'snaps to it. \u26a0 Each axis reads its own coordinate, so an axis the figure has no extent on does '
    + 'nothing. \u26a0 Unlike Twist this changes the figure\u2019s density, so the engine compensates the '
    + 'brightness automatically; at extreme settings the compensation saturates.',
  bend: 'Curves the figure\u2019s axis, like bending a pipe into an arc. Centre is off, and the slider '
    + 'snaps to it. \u26a0 Each axis reads its own coordinate, so an axis the figure has no extent on does '
    + 'nothing. \u26a0 The range stops short of the point where the curve would turn inside out \u2014 '
    + 'that is a hard limit, not a taste one.',
  /*
   * v8 `33.2` \u2014 `Sharpness`. \u26a0\ufe0f **The tooltip has to answer *why does this do nothing on my preset*
   * BEFORE the user concludes it is broken**, which is invariant 13's harder shape and the reason the
   * taper's tip above is written the way it is. The honest answer is measured: the corner carries only
   * 0.4 % of the waveform's energy, so a long trail averages it away. Naming the three low-accumulation
   * presets is more use than naming the mechanism.
   */
  /*
   * v8 `34.4` \u2014 \u26a0\ufe0f **THE KEY IS `sharpnessLevels` NOW, NOT `sharpness`, AND BOTH HALVES MOVED IN ONE EDIT.**
   * `tipcheck` \u00a7B fails on a dead entry and \u00a7A on a descriptor with no entry, so a rename that touched only
   * one of the two files would have gone red in both directions \u2014 which is the clause working.
   *
   * \u26a0\ufe0f\u26a0\ufe0f **THE PER-LEVEL SENTENCE STATES THE PROPORTIONAL RULE AND MUST NEVER SAY "SHARPEN BODY".**
   * Measured over 314 presets: a level's sharpness is visible in proportion to that level's share of the
   * figure's amplitude budget (mean shares Body 69.3 % / Structure 24.7 % / Detail 5.9 %, Detail's MEDIAN
   * share exactly 0.0 %, and **183 of 314 presets carry no live Detail term at all**). The shorthand
   * "sharpen Body" is simply WRONG for three of the six presets that carry this control today \u2014 the owner's
   * finetuned stars, whose Structure outweighs their Body 28.5 to 13.0. **A cell whose level is silent stays
   * visible and inert (`34.D12`), so this tooltip is the only place that can explain it.**
   */
  sharpnessLevels: 'Rebuilds the figure from straight segments meeting at sharp corners instead of smooth '
    + 'curves. One cell per wave LEVEL, so you can facet the broad shape and leave the fine detail smooth, '
    + 'or the reverse. \u26a0 A level shows in proportion to how much of the figure it actually draws, so a cell '
    + 'over a level this preset barely uses does very little \u2014 the Composer\u2019s Score shows which levels carry '
    + 'the figure. \u26a0 The knot is provably unchanged: only how it is drawn. \u26a0 The difference lives in the '
    + 'corners, so a long trail averages it away \u2014 judge it on Cylinder, Quader or Pipes.',
  /*
   * v8 `34.4` \u2014 `Temper`. \u26a0\ufe0f\u26a0\ufe0f **THE DWELL IS A FEATURE AND THE NEXT READER WILL "FIX" IT**, so the tooltip
   * has to say that the pause is the control working. The resolved value is held inside 0\u2013100 %, so a swing
   * that would pass either end stops there and the cycle dwells at pure sine and at full facets instead of
   * sweeping straight through them.
   */
  sharpnessDepth: 'Breathes Sharpness above, between its value minus this and its value plus this, and '
    + 'holds the result inside 0\u2013100 %: where the swing would pass either end it stops there, so the cycle '
    + 'DWELLS at pure sine and at full facets instead of sweeping straight through them. The motion is '
    + 'crystallise, hold, melt, hold \u2014 and that pause is the control working, not a stuck slider. The '
    + 'readout says (clipped) whenever a dwell is active. \u26a0 One depth for all three levels: they breathe '
    + 'together on one cycle. Set it to 0 to stop the breathing; the figure then holds whatever Sharpness '
    + 'says.',
  sharpnessRate: 'How fast Sharpness breathes \u2014 the readout is the time for one full crystallise-and-melt '
    + 'cycle. \u26a0 NOMINAL: Speed above multiplies the actual rate, and the preset\u2019s own sweep speed sets the '
    + 'scale, so the real cycle is faster or slower than the number says. Off means it never cycles, which '
    + 'is also what happens with Temper at 0.',
  /*
   * v8 `33.3` \u2014 `Travel`. \u26a0\ufe0f **It must say the figure stops closing**, because that is the one thing no
   * other control in the Lab does and a user seeing two loose ends will otherwise read it as a defect.
   * \u26a0\ufe0f And it must say the frame is not guaranteed: nothing auto-fits this term, which is unique among
   * the figure quantities and is `TRAVEL_MAX`'s whole reason for existing.
   */
  travel: 'Slides the figure steadily along each axis as it is drawn, so instead of a closed loop you get '
    + 'an open arc \u2014 a spring, a conical spiral, a barber-pole stripe. Centre is off, and the slider '
    + 'snaps to it. \u26a0 The figure gains two free ends; nothing else in the Lab does that. \u26a0 At '
    + 'large settings it can travel past the edge of the frame, and no auto-fit will pull it back.',
  /*
   * v8 `34.4` \u2014 `Stretch`. Same dwell clause as `Temper`, in Travel's own unit. \u26a0\ufe0f The three cells are per
   * AXIS and each has its own rate, which is the one thing one-rate-per-operator could not express.
   */
  travelDepth: 'Breathes Travel above, so the open arc extends and retracts instead of sitting at one '
    + 'length. The result is held inside Travel\u2019s own range, so a swing that would pass the end stops there '
    + 'and DWELLS \u2014 the readout says (clipped) while it does, and that pause is the control working. \u26a0 '
    + 'Each axis breathes on its own rate, so three axes can wander out of step rather than shuttling '
    + 'together. Centre is off, and the slider snaps to it.',
  travelRate: 'How fast each axis of Travel breathes \u2014 the readout is the time for one full extend-and-'
    + 'retract cycle, per axis. \u26a0 NOMINAL: Speed above multiplies the actual rate and the preset\u2019s own '
    + 'sweep speed sets the scale. Off means that axis never cycles.',
  /*
   * v8 `34.2` \u2014 `Offset`. \u26a0\ufe0f\u26a0\ufe0f **THE TOOLTIP MUST SAY WHAT THE CONTROL IS *FOR*, because a still picture of
   * an offset figure is just a figure that is off-centre.** The engine rotates about the model origin, so
   * every figure in the library spins IN PLACE; the whole value of this operator is that it turns that spin
   * into an orbit. \u26a0\ufe0f And it must state the Z hazard in words, because the ROW's own readout only appears
   * once Z is non-zero \u2014 the inline note is the measurement, this is the warning.
   */
  offset: 'Moves the whole figure off centre, by a fraction of the design box\u2019s half-width. \u26a0 The real '
    + 'point is MOTION: the figure spins about the centre of the box, not about itself, so an off-centre '
    + 'figure ORBITS instead of turning in place \u2014 a ball opens into a ring, then into a wide wreath. '
    + 'Centre is off, and the slider snaps to it. \u26a0 On Z it moves the figure toward or away from the '
    + 'camera, and far enough back the particles pass behind it and vanish; the note under this row says how '
    + 'close you are, and that limit depends on the window size rather than on the preset.',
  offsetDepth: 'Breathes Offset above, so the figure drifts rather than sitting off centre. The result is '
    + 'held inside Offset\u2019s own range, so a swing that would pass the end stops there and DWELLS \u2014 the '
    + 'readout says (clipped) while it does. \u26a0 Each axis has its own rate, so three axes at three rates '
    + 'give a slow wandering drift rather than a straight-line shuttle. Centre is off, and the slider snaps '
    + 'to it.',
  offsetRate: 'How fast each axis of Offset drifts \u2014 the readout is the time for one full round trip, per '
    + 'axis. \u26a0 Three DIFFERENT rates is what makes the drift wander instead of shuttle. \u26a0 NOMINAL: '
    + 'Speed above multiplies the actual rate. Off means that axis never drifts.',
  /*
   * v8 `34.3` \u2014 `Grow`. \u26a0\ufe0f\u26a0\ufe0f **THE STORED VALUE IS A RAMP COEFFICIENT AND 0 IS THE IDENTITY, NOT 1.** The
   * user-facing form of that is the one thing this tooltip must get right: 0 means no change, +1 doubles the
   * amplitude by the end of the stroke, \u22121 tapers it to a point and is the floor.
   */
  grow: 'Ramps the figure\u2019s size along the curve as it is drawn, so the stroke opens out or closes down '
    + 'from one end to the other \u2014 a circle becomes a cone, a helix becomes a conical spiral. \u26a0 Off means '
    + 'no change. +1.00 doubles the size by the end of the stroke; \u22121.00 tapers it to a point and is the '
    + 'floor. \u26a0 It ramps the WAVE only, so Travel and Offset still move the figure the same amount wherever '
    + 'the ramp has taken it. \u26a0 At the taper end all the particles near the tip pile up, which reads as a '
    + 'bright spot \u2014 that is the geometry, not the brightness control.',
  growDepth: 'Breathes Grow above. The result is held inside its own range, so a swing that would go below '
    + 'a full taper stops at the taper and DWELLS there \u2014 the stroke pauses at a point before flaring back, '
    + 'and the readout says (clipped) while it does. \u26a0 Crossing zero is worth setting up: zero is the '
    + 'identity, so the figure passes visibly through its own unmodified shape each cycle. Centre is off, '
    + 'and the slider snaps to it.',
  growRate: 'How fast each axis of Grow breathes \u2014 the readout is the time for one full taper-and-flare '
    + 'cycle, per axis. \u26a0 NOMINAL: Speed above multiplies the actual rate. Off means that axis never '
    + 'breathes.',
  /*
   * v8 `32.7` (`E133`) — the 3D inversion. ⚠️ **The tooltip must distinguish it from the image-space
   * `Inverse 1/z` in Translation Map, which is the SAME formula after the projection** — two controls that
   * look alike and differ only in where they act is exactly the hazard `CLAUDE.md` names for the three
   * things called "liquid".
   */
  invertAmount: 'Turns the figure inside out through a sphere: what was near the centre explodes outward '
    + 'and what was far collapses inward, so straight runs become arcs. \u26a0 This acts in 3D, BEFORE the '
    + 'figure is turned toward the camera, so it also changes which particles are in front \u2014 depth '
    + 'shading, the Volume mode and Liquid\u2019s occlusion all read differently. The Translation Map '
    + 'style Inverse 1/z is the same shape applied to the finished picture instead, which leaves depth '
    + 'alone. Low values are the usable range.',
  invertRadius: 'The radius of the sphere the figure is inverted through, as a multiple of the figure\u2019s '
    + 'own size. Points exactly on the sphere do not move; inside and outside swap. \u26a0 Does nothing '
    + 'while Inversion is off.',
  twist: 'Wrings the figure about each axis, by an angle proportional to how far along that axis a point '
    + 'sits — so the near and far ends turn opposite ways and the shape reads as a solid being torqued '
    + 'rather than an image being smeared. One full turn from the centre to the edge of the figure’s own '
    + 'box per 1.00. Needs a figure with DEPTH: on a flat one it correctly does nothing, so try it on a '
    + 'preset whose Z wave has amplitude. It adds no light of its own — but it spreads the figure over more '
    + 'of the frame, so a wound figure reads brighter and clips less. Saved with the preset.',
  boxFoldIterations: 'Reflects the figure back inside an invisible box whenever it strays outside, so the '
    + 'curve becomes architecture — mirrored chambers and corridors, with the trail still sweeping '
    + 'through them. Many parts of the curve land on the same place, so the creases light up: bright '
    + 'seams tell you it is working. ⚠️ 2, 3 and 4 usually do NOTHING on their own — one reflection '
    + 'already brings the figure inside the box, leaving nothing to fold. To make them count, move Fold '
    + 'Scale off 1.00 or turn Cell Size right down. Off hides the three rows below.',
  boxFoldLimit: 'How big the invisible box is, as a share of the figure’s own design box. Nothing folds '
    + 'while the whole figure fits inside, so turn this DOWN until the outer parts start reflecting. '
    + 'Smaller box, more folding, finer structure.',
  boxFoldScale: 'Shrinks or grows the figure between one fold and the next, which is what turns repeated '
    + 'folds into self-similar nesting rather than the same reflection twice. It compounds: at 4 folds a '
    + 'scale of 1.5 is already 5× and 0.5 is a 16× contraction. It also changes brightness, because '
    + 'squeezing the figure genuinely does put more particles in each pixel.',
  // ---- v8 Phase 38 — the Fractal Fold ----
  fractalFoldIterations: 'Folds the figure back into itself again and again, and pulls every fold back toward '
    + 'where each point started — so a smooth figure turns into nested, self-similar structure: rings within '
    + 'rings, layered shells, a boxy frame. Each step adds a level. It stays one continuous curve, so trails, '
    + 'ribbons and Neon Lines keep working, and the figure is scaled back to its own size. Off changes nothing.',
  fractalFoldLimit: 'The size of the invisible box the figure is folded into, as a share of its design box. '
    + 'This picks the family of shapes: small cells shatter the figure, then come layered sheets, a boxy '
    + 'frame, and at the largest a lobed ring. Small changes morph smoothly, so it animates well.',
  fractalFoldScale: 'How strongly each fold stretches the figure before it is pulled back. Negative values '
    + 'turn it inside out as well and often give the most striking shapes. At 0 the fold does nothing.',
  fractalFoldLimitDepth: 'Makes the cell size breathe: how far it swings either side of its setting. Off holds '
    + 'it still. A swing that would leave the cell’s range rests at the limit for a moment.',
  fractalFoldLimitRate: 'How fast the cell size breathes, as a period that follows the figure’s own '
    + 'speed. Only matters while Cell Breath is on.',
  fractalFoldScaleDepth: 'Makes the fold strength breathe: how far the scale swings either side of its '
    + 'setting. A swing through 0 passes through the unfolded figure.',
  fractalFoldScaleRate: 'How fast the fold strength breathes, as a period that follows the figure’s own '
    + 'speed. Only matters while Scale Breath is on.',

  wScale: 'Treats the figure as a slice of a FOUR-dimensional object and sets how far it extends into '
    + 'that fourth direction, using each particle’s place along the curve as its fourth coordinate. On its '
    + 'own it makes one end of the curve nearer than the other, so the figure gains depth it did not have. '
    + 'Off is exact and hides the spin rows. Turn it up before touching those.',
  wWinding: 'How many times the fourth coordinate reverses as you walk along the curve. This is what '
    + 'makes 4D Spin look like more than a stretch: at 1 the figure simply leans into the fourth '
    + 'direction, while higher values push successive stretches of it in OPPOSITE directions, so the '
    + 'strands sweep through one another. Try 3 to 6 with 4D Spin set on all three planes. Whole numbers '
    + 'only — a fraction does not close, and the curve tears at the seam.',
  wAngles: 'Rotates the figure through the fourth dimension, in the three planes that involve it. These '
    + 'are rotations with no three-dimensional equivalent: parts of the figure turn INSIDE OUT through '
    + 'each other rather than merely around. The ordinary three-axis rotation is the Rotation row near '
    + 'the top of this tab — it is not repeated here. Needs 4D Extent above to be above zero. ⚠️ Z-W is '
    + 'the plane that moves depth, so it changes the figure most.',

  // ---- Per-Particle (v8 31.2) ----
  // ⚠️ TRIMMED TO FIT THE 600-CHAR CEILING tipcheck §G ENFORCES, and the material that went is the
  // material the SECTION header already carries (why one driver feeds all three rows). The PRECONDITION
  // stayed, because it is the half a user cannot deduce from watching the control.
  channelDriver: 'Which ordering the three rows below read, all three sharing this one choice. Along the '
    + 'curve numbers the particles from one end of the figure to the other; Speed reads how fast each is '
    + 'moving; Depth how near or far; Colour cycle where it sits in the colour sweep. Changing it alone '
    + 'does nothing until a row below is turned up. ⚠️ Speed needs a figure that MOVES — at Speed zero '
    + 'every particle has the same velocity, none, so the rows correctly do nothing. Along the curve '
    + 'always works.',
  channelLight: 'Makes some particles brighter than others, picked by the Driver above. Centre is '
    + 'neutral. Right brightens the high end of the ordering and dims the low end; left swaps them, which '
    + 'is a different picture of the same ordering rather than less of it. This is the one to try first: '
    + 'at a particle’s size the eye reads brightness far better than it reads colour.',
  channelSize: 'Makes some particles bigger than others, picked by the Driver above. Centre is neutral. '
    + 'At the extremes the smallest particles nearly vanish while the largest double — so a figure gains '
    + 'a sense of near and far, or of thickening along its length, from one slider. The pixel estimate '
    + 'beside Particle Size then reports the SMALLEST particle, since there is no longer just one size.',
  channelAlpha: 'Makes some particles more solid than others, picked by the Driver above. Centre is '
    + 'neutral. It reads most clearly on a preset with a visible trail or a material, where a faint '
    + 'particle lets what is behind it through; on a plain additive figure it mostly looks like dimming, '
    + 'which is what Lightness already does better.',

  // ---- Ribbon Rendering ----
  splatShear: 'Which way a material splat is sheared. Follow path keeps each mark the same apparent width whichever way the particle travels. Flat nib fixes the cross-axis to the screen, so marks widen across the direction of travel and narrow along it, like a calligraphy pen. Only affects presets that use a material.',
  ribbonMode: 'Draws the particle path as a continuous solid band instead of separate points, so the curve '
    + 'reads as a surface with an inside and an outside. Off is the point cloud every legacy preset was '
    + 'authored against.',
  ribbonWidth: 'Thickness of the band in pixels. Narrow reads as a drawn line, wide as a folded sheet that '
    + 'occludes itself where the curve crosses.',

  // ---- Neon Lines ----
  linesEnabled: 'Draws each particle\'s recent path as a short glowing trail, so the figure\'s motion shows as '
    + 'light-trails. A figure that does not move draws none. Best on a moderate particle count, where the '
    + 'individual trails are still legible. Turning Neon Lines off also turns off Electric Discharge, which '
    + 'needs their glow.',
  lineWidth: 'Line thickness in pixels. Past about 4 the segments merge into a solid ribbon and the '
    + 'wireframe reading is lost.',

  // ---- Electric Discharge (v8 Phase 40) ----
  dischargeEnabled: 'Crackling filaments of light around the figure, like an electric discharge. The light is '
    + 'pulled toward the brightest parts of the image, which keeps collapsing it into thin, unstable filaments. '
    + 'It tears the glow of the Neon Lines apart, so it needs them: turning it on also turns Neon Lines on '
    + '(which ends Ribbons), and turning Neon Lines off turns it off.',
  dischargeIntensity: 'How strongly the light is pulled into filaments. Low is a faint shimmer; high is a '
    + 'violent, tightly wound discharge.',
  dischargeFilament: 'How thick the filaments are, in pixels: low is hair-fine, high is thick, softer arcs.',
  dischargeCrackle: 'How fast the filaments flicker and how long they live. Low is calm and slow; high is a '
    + 'violent, fast crackle that also keeps a slow figure flickering.',
  dischargeBranching: 'Makes the filaments fork and wander along a slowly drifting field instead of hugging the '
    + 'figure\'s edges — from 0 (none) to lightning-like branches.',

  // ---- Film Look ----
  filmLook: 'A named bundle of grading settings — bloom, tone curve, exposure, saturation, vignette and the '
    + 'particle shape controls — applied in one pick. Choose Customize to open the panel below and edit those '
    + 'values individually; picking any named look re-seeds them.',

  // ---- Attractor ----
  attractorIndex: 'Replaces the sine-wave curve with a strange attractor, keeping the current rendering and '
    + 'grading. Off restores the preset’s own waves. Use Blend below to mix rather than switch outright.',
  attractorBlend: 'How far to move from the preset’s wave figure toward the attractor: 0 is the preset '
    + 'untouched, 1 the attractor alone. It also fades the Translation Map warp, so a mid value gives an '
    + 'attractor with some of the preset’s character still in it.',
  // v8 Phase 37 — the attractor layout and the strand. The type precondition stays INLINE in the row (`37.D16`).
  attractorLayout: 'How the attractor’s particles are arranged. Cloud spreads them over many unrelated orbits '
    + 'for even coverage. Strand follows ONE trajectory, so neighbouring particles are neighbouring points along '
    + 'the path: the figure becomes a single moving stroke with two free ends, and a colour mapped by particle '
    + 'index runs as a gradient along it. Effects that push particles around (curl noise, fluid, physarum) fight '
    + 'that ordering by nature.',
  attractorArcSpan: 'How much of the trajectory the strand shows, in multiples of the attractor’s size. Longer '
    + 'strands show more of the shape; past the point where the path starts retracing itself the strokes pile up '
    + 'and wash towards white, soonest on Aizawa and Rössler.',
  attractorArcSpanDepth: 'How far the strand length breathes above and below its setting. The strand stretches '
    + 'and shrinks rather than being redrawn. 0 holds it still.',
  attractorArcSpanRate: 'How fast the strand length breathes.',
  attractorAdvance: 'How fast the strand travels along its trajectory, in new points per frame; 0 freezes it. A '
    + 'fast strand under a long trail smears into a blur. On a strand the velocity colour and stretch measure '
    + 'this travel, not the attractor’s own speed.',
  attractorAdvanceDepth: 'How far the strand speed breathes above and below its setting. 0 holds it steady.',
  attractorAdvanceRate: 'How fast the strand speed breathes.',

  // ---- Curl Noise ----
  curlEnabled: 'Adds a divergence-free turbulent flow to every particle, so the figure churns and eddies '
    + 'instead of tracing a clean curve. Divergence-free means the particles swirl without piling up.',
  curlTurbulence: 'Strength of the churn. Low values wobble the curve; high values dissolve it into smoke, '
    + 'so raise it slowly if you want the figure to stay recognisable.',
  curlScale: 'Size of the eddies. Small values give fine local jitter, large values give slow whole-figure '
    + 'drift — this is the control that decides whether the noise reads as texture or as motion.',
  curlEvolutionSpeed: 'How fast the noise field itself changes. At 0 the flow is frozen, so particles follow '
    + 'fixed streamlines and the figure holds a distorted shape rather than boiling.',

  // ---- Render Mode ----
  // ⚠️ v8 15.9 added the `liquid` clause. Its absence was invariant 13's inverse: the tip on the control that
  // LISTS the modes named six of seven, so the one mode that is different in kind — the only one that occludes
  // rather than adding light — was the one a user could not read about. The second route is named because the
  // Materials tab is where most users will now meet it.
  renderMode: 'How each particle is drawn. Pixel and Blend are the flat legacy looks; Star adds a soft glow '
    + 'halo (the usual choice); Splat accumulates overlapping particles into smooth density, good for dense '
    + 'figures; Volume ray-marches the accumulation as fog. Liquid is the odd one out: instead '
    + 'of adding light it merges nearby particles into one closed surface, with its own section in Visual FX. '
    + 'Picking the Liquid material switches you here too.',
  particleSize: 'Scales every particle, 0.25×–4×, on top of whatever the render mode’s own base size is — 3 px '
    + 'for Pixel and Blend, 5 px for Star, and a material’s Splat Size (or 16 px without '
    + 'one) for Splat and Volume. The pixel figure beside the handle is what the current mode and canvas '
    + 'actually produce, so it changes when you switch mode. Crystals are excluded — they have their own '
    + 'Crystal Size. Saved with the preset.',
  // ⚠️ The two OVERRIDES are the load-bearing half of this text, not padding. Both make the live trail differ
  // from what the handle reads, which is invariant 25's shape — a control that describes a pass something
  // upstream has already changed. Naming them here is what stops "Trail Decay does nothing" being reported
  // against an additive material or a style-6 chain.
  decayFactor: 'How much of the previous frame survives, so this is trail length: 0 draws each frame clean, '
    + '0.9 keeps a ten-frame smear, 0.99 nearly never forgets. Two things override it — an additive material '
    + 'caps it (its emission would otherwise accumulate to a flat white on any revisited pixel), and TransMap’s '
    + 'Fluid Feedback style replaces it with its own Persist. In both cases the real trail is shorter than the '
    + 'handle says. Saved with the preset.',

  // ---- Translation Map ----
  transMapEnabled: 'Master switch for the whole image-warp pass. With it off no layer below does anything, '
    + 'whatever its settings — 60 of the 177 legacy presets load with it off, and adding a layer does not '
    + 'turn it on. The pipeline line at the foot of the section always says what is actually running.',
  transMapStyle: 'The warp operator for a single-layer chain. Shown only while the chain has one layer; add a '
    + 'second and each layer carries its own style instead.',
  transMapWarpMix: 'Master strength for the summed warp of every layer. 0 is byte-identical to the pass '
    + 'being off, so this is the fastest way to A/B the whole chain without losing your layer settings.',
  transMapBeforeParticles: 'Runs the warp BEFORE this frame’s particles are drawn, so only the accumulated '
    + 'trail is displaced and the figure itself stays crisp — a flowing wake behind a solid subject. Needs a '
    + 'long trail to show: on a preset whose trail lives one frame there is no history to displace and both '
    + 'orders look identical.',

  // ---- Physarum Network ----
  'physarum.blend': 'Blends in a slime-mould simulation, in which agents follow and reinforce their own '
    + 'deposited trail until it condenses into a branching vein network. 0 is off; the simulation costs '
    + 'nothing until it is raised.',
  'physarum.sensorAngle': 'How wide the agents look to either side, in degrees. Narrow angles give long '
    + 'straight veins, wide angles a dense tangled mesh.',
  // ⚠️ "in pixels" until 2026-09-20 and it was never pixels: the reach is measured on the trail field, which
  // is 512 cells across the view at any window size. Both the sensing and (since the same day's units fix) the
  // steering step scale with the frame, so the whole subsystem is resolution-independent — say fraction, not px.
  'physarum.sensorDistance': 'How far ahead the agents look, as a fraction of the frame — the trail field is '
    + 'always 512 cells across, so 25 reaches about a twentieth of the way over the view at any window size. '
    + 'This sets the scale of the network — short is fine capillaries, long is a few thick trunks.',
  'physarum.turnSpeed': 'How sharply an agent may steer toward the trail it senses, in degrees per step. Low '
    + 'values give smooth sweeping curves, high values a nervous crystalline mesh.',
  'physarum.decayRate': 'How fast the deposited trail fades. Low values let the network remember and thicken '
    + 'its paths; high values keep only what is actively travelled, so the pattern stays in motion.',
  'physarum.depositAmount': 'How much trail each agent lays down. Together with Decay Rate this decides '
    + 'whether the network condenses into a few strong veins or stays a diffuse haze.',
  'physarum.showTrail': 'Draws the deposited trail field itself as well as the agents. Off shows only the '
    + 'moving agents, which reads as sparse drifting dust rather than a network.',
  'physarum.trailOpacity': 'How strongly the trail field is composited over the figure. Lower it when the '
    + 'network is burying the Lissajous figure underneath it.',
  'physarum.trailColour': 'Which colour ramp the trail field is drawn through, mapped by trail density — so '
    + 'the thick trunks and the faint capillaries take different colours instead of one flat orange. Needs '
    + 'Show Trail on and Blend above 0, like every row above. "Preset (orange)" is the original fixed tint. '
    + '"Auto" follows the film look’s Palette, falls back to the material’s Colour Ramp, and lands on orange '
    + 'if neither is set — so the network tracks the rest of the image without being set twice.',

  // ---- Fluid Advection ----
  'fluid.blend': 'Blends the particles’ positions toward being carried by a fluid velocity field, so the '
    + 'figure is dragged and sheared as if suspended in a current. 0 is off.',
  'fluid.returnForce': 'How strongly each particle is pulled back to its mathematical position on the curve. '
    + 'High values let the fluid only ripple the figure; low values let it wash the figure away entirely.',

  // ---- Volume Render ----
  'volume.extinction': 'How quickly the ray-marched fog absorbs light with depth. High values give a dense '
    + 'surface-like cloud, low values a thin translucent haze you can see through.',
  'volume.densityScale': 'Multiplies the accumulated density the fog is built from. Raise it when the volume '
    + 'reads as too faint to have a shape; lower it when it saturates into a solid block.',

  // ---- Liquid Surface (v8 Step 15.1) ----
  'liquid.isoLevel': 'Where the surface forms, in multiples of the density measured along the figure itself — '
    + 'so it means the same thing at 4000 particles as at 20 000, and the same thing on a dense curve as on a '
    + 'sparse one. 1.0 is the balanced surface: below it the lobes fuse, above it they separate into droplets.',
  // ⚠️ The ceiling note is NOT decoration: above the driver's point-size clamp this control is exactly
  // inert, and the clamp moves with the canvas — so on a large window the top of the track does nothing.
  // Saying so here is the only place a user meets it. See KERNEL_WIDTH_MIN's header for the arithmetic.
  'liquid.kernelWidth': 'How far each particle’s influence reaches. Together with Iso Level this sets how '
    + 'close two drops must come before they merge into one shape instead of overlapping. ⚠️ On a large '
    + 'window the top of this range stops having an effect, because the sprite hits a size limit your '
    + 'graphics driver imposes — if raising it changes nothing, that is why.',
  'liquid.edgeSoftness': 'Feathering on the surface boundary, as a fraction of the threshold. 0 gives a hard '
    + 'painted edge; high values give a misty falloff that reads as spray rather than liquid.',
  // v8 15.7 widened this from four sources to five. ⚠️ `Dye` owns the "it can be unavailable" fact here rather
  // than in the Dye Field section, because this is the control where the degradation is SEEN (the surface looks
  // like Ramp) and the section eight rows below is where it would be looked for last.
  // ⚠️ v8 15.9a added the INDEXING fact, which a 2026-09-03 browser experiment cost: the three LUT sources
  // are indexed by THICKNESS, never by a palette mapping or a temperature — which is why "playing around with
  // palette seems not to have an effect" was a correct observation about a working feature. And the material
  // clause now names the material rather than implying every material changes the surface.
  'liquid.tintSource': 'Where the surface takes its colour. Preset uses the figure’s own colour, Palette the '
    + 'active film-look gradient, Material Ramp the live material’s ramp, Ramp a gradient you pick below, and '
    + 'Dye the colour the figure has painted into the dye field. ⚠️ The three gradient sources are indexed by '
    + 'THICKNESS — the thin rim takes the low end, the thick core the high end — not by a palette mapping or a '
    + 'temperature, so a Palette’s own Map setting cannot reach the surface. ⚠️ Dye falls back to Ramp '
    + 'wherever there is no dye — including everywhere, if the Dye Field section below is not enabled.',
  'liquid.surfaceRamp': 'The gradient the surface is coloured by, indexed by thickness — the thin rim takes '
    + 'the low end and the thick core the high end. Used only when Tint Source is Ramp.',
  // ⚠️ v8 15.9a — the row's LABEL is `Figure Colour`; this key stays `liquid.colourMix`. Rewritten because
  // the old text described the operation ("it blends on top of whichever source") without saying which
  // operand dominates, and at the 0.85 default the figure's own colours ARE 85 % of the result. Two facts
  // are now stated that the original could not: the DIRECTION (1 = the figure, 0 = the Tint Source) and the
  // DYE EXEMPTION, which is the one place this control is an exact no-op.
  'liquid.colourMix': 'How much of each pixel’s colour comes from the particles that actually built it. '
    + '1 keeps the figure’s own colours; 0 leaves the surface coloured by Tint Source alone. At the default '
    + '0.85 the figure dominates, so changing Tint Source looks weak until you lower this — and with Tint '
    + 'Source on Preset the two are the same colours anyway, so the travel only really shows on Ramp, '
    + 'Material Ramp and Palette. ⚠️ Under Dye it does nothing at all: that source is exempt.',
  'liquid.mixModel': 'How overlapping colours combine. Light blends toward the brighter constituent, the way '
    + 'lit fluid behaves. Pigment deepens where layers stack, the way ink or paint does, and leaves the thin '
    + 'rim untouched — so it reads as a material rather than as a brightness change.',
  // v8 Step 15.3 — the surface material. Each states the property the control changes, not the term's name:
  // 'Fresnel' and 'Beer-Lambert' are the derivations, and they live in `renderers/liquid-reference.ts`.
  'liquid.refraction': 'How much light appears to bend travelling through the body — the same control the '
    + 'crystal section has. It deepens the colour where the surface is thick and splits it slightly at the '
    + 'edges, which is what makes a shape read as seen-through rather than as filled in.',
  'liquid.specular': 'Strength of the glint where the surface faces the light. It follows the surface’s own '
    + 'curvature, so it slides across a moving figure and is the clearest cue that the shape is wet.',
  'liquid.thickness': 'How much light the body absorbs on its way through, so a thick core goes deeper and '
    + 'darker while the thin rim stays bright. This is what separates a volume of liquid from a flat fill.',
  'liquid.edgeBrightness': 'Brightness of the rim where the surface turns away from you — the glancing-angle '
    + 'sheen every real liquid has. Raise it when the shape reads as a solid silhouette rather than a body.',

  // ---- Cohesion (v8 Step 15.4) ----
  // ⚠️ Each states the PROPERTY, and each carries the one precondition its own arithmetic imposes rather than
  // repeating the section's shared hint: Cohesion is the on/off, Radius is in SCREEN pixels (unlike Cluster
  // Force's model units), and Return Force is a correctness condition rather than a refinement.
  'cohesion.strength': 'How hard nearby particles pull on each other, so the figure beads into separate drops '
    + 'instead of one continuous curve. It moves the particles themselves, so it works in every render mode — '
    + 'but only Liquid actually fuses the drops into single shapes. ⚠️ 0 is off, and preview tiles never bead.',
  'cohesion.radius': 'How far apart two particles can be and still attract, in SCREEN pixels — so it is '
    + 'unaffected by how big the figure is in the scene. It sets the drop SIZE: small radii give many fine '
    + 'beads, large ones a few fat lobes, and past about 64 px the whole figure collapses back into one lump.',
  'cohesion.returnForce': 'How strongly each particle springs back to where its curve says it belongs. This is '
    + 'what keeps the beading stable: at 0 nothing pulls back and the drops drift until they hit an internal '
    + 'limit, while high values hold the figure’s shape and let only small tight beads form.',

  // ---- Liquid Field (v8 Step 15.5) ----
  // ⚠️ Each carries the precondition its OWN arithmetic imposes, which is not the same as the section's shared
  // hint: `enabled` owns the "it only flows while the figure moves" fact because that is the one that makes a
  // ticked box look broken; `fieldCoupling` owns "0 still draws the pool" because that is what distinguishes it
  // from an off switch; `fieldDecay` owns the top-of-range warning, since 0.999 is where a stir stops forgetting.
  'liquidField.enabled': 'Adds a pool of free-floating particles that the figure drags through as it moves, so '
    + 'the figure stirs a body of liquid instead of being one. They join the same particle set, so every render '
    + 'mode draws them. ⚠️ The pool only flows while the figure actually MOVES — on a still or very slowly '
    + 'rotating preset it sits where it was seeded no matter how high Field Coupling is.',
  'liquidField.poolSize': 'How many particles the pool holds, on top of the figure’s own. Around the figure’s '
    + 'own particle count gives a body comparable in mass to what is stirring it; far above that the pool '
    + 'dominates its own cause, and 0 leaves the figure alone.',
  'liquidField.seedPattern': 'Where the pool starts out. Fill spreads it over the whole frame, Cloud '
    + 'concentrates it where the figure draws (so the stirring is visible immediately), Blobs starts as separate '
    + 'islands that can merge, and Basin pools it along the bottom edge. Changing this re-places every particle.',
  'liquidField.fieldCoupling': 'How strongly the figure’s motion pushes the pool around. ⚠️ 0 is not an off '
    + 'switch — the pool is still drawn, it just holds still where it was seeded; use Enable to remove it. High '
    + 'values throw particles far enough that they leave the frame and are recycled.',
  'liquidField.fieldDecay': 'How long the flow remembers a stir. Low values let the wake settle almost at once, '
    + 'so the pool only moves where the figure just passed; high values let currents build up and keep circling '
    + 'after it has gone. ⚠️ Near the top the flow barely forgets at all and drifts free of the figure.',

  // ---- Dye Field (v8 Step 15.7) ----
  // ⚠️ **`enabled` carries the THREE-LINK precondition chain in full** (mode Liquid → Tint Source = Dye →
  // this box), which is longer than any other tooltip's here and is why the section also states it inline: the
  // dye can be running perfectly and be invisible for two reasons that live in a different section.
  // Each of the others carries only the fact its OWN arithmetic imposes.
  // v8 28.6 — ⚠️ **THE SECOND SITE OF THE STALE SENTENCE.** This said *"It is only ever SEEN through Render
  // Mode Liquid with Tint Source = Dye"*, which 28.1 falsified. Corrected here, in the section hint and in
  // both manuals; `DESIGN-liquid-material.md` too. The preview-tile exception stays, because 28.D4 kept it.
  'dye.enabled': 'Turns on a colour field the figure paints as it moves, which the flow then carries and '
    + 'smears. ⚠️ In Render Mode Liquid with Tint Source = Dye it colours the surface itself; in every other '
    + 'mode it draws behind the figure. It needs MOTION: it fills only where the figure has been, so a still '
    + 'preset dyes one fixed shape. ⚠️ Trail Decay smears it as well as the figure, and preview tiles never '
    + 'dye.',
  'dye.opacity': 'How much colour each particle lays down per frame. High values saturate the field quickly, '
    + 'so the body reads as fully dyed; low values leave a faint stain that only the densest passes build up. '
    + 'It is a deposit strength, not a layer opacity — the dye is the surface’s own colour, not a veil over it.',
  'dye.decayRate': 'How long the dye lingers after the figure has moved on. Low values leave only a short '
    + 'trail behind the figure; near the top the field never really clears and the whole body ends up one '
    + 'saturated colour. This is where the visible structure comes from — dye that never fades has none.',
  // ⚠️ **This one names the FLOW's own source, which no other dye control depends on.** The flow is the 512²
  // velocity field the figure stirs, and it runs on the dye's own account since 2026-09-03 — so the only thing
  // that can still leave this slider inert is a figure that is not moving. Before that fix it was also inert
  // whenever the Liquid Field pool was off, which is the report this sentence exists to prevent recurring as a
  // question: the precondition is MOTION and nothing else.
  'dye.advectionStrength': 'How far the flow drags the dye each frame. At 0 the dye stays exactly where it was '
    + 'painted, which reads as a static stain; raising it lets the wake pull colour into streaks and swirls. '
    + '⚠️ The flow is stirred by the figure itself, so this is the one dye control that does nothing at all on a '
    + 'still preset — it needs rotation or wave motion, but nothing else switched on.',
  'dye.injectionRadius': 'How wide a mark each particle paints, in screen pixels. Small values give fine '
    + 'threads that follow the curve; large ones give broad strokes that merge into flat colour fields. It is '
    + 'measured on the screen’s shorter side, so a mark is round at any window shape.',
  // ⚠️ **TIGHTENED TO FIT §G'S 600-CHARACTER CEILING WHEN `Palette` WAS ADDED (2026-10-15), AND THE CEILING
  // WAS RIGHT TO BITE.** Each source needs its own ⚠️ clause — four of the five degrade or can read inert —
  // so the paragraph grows with the union while the budget does not. What was cut is restatement ("and the
  // one to start with", "of the figure", "nothing in the field varies and"), never a warning.
  // ⚠️ **CONDENSED TWICE NOW to fit §G's 600-character ceiling** — the sixth source pushed it to 823 and
  // the seventh would have again. The ceiling is a real constraint and the answer is always to tighten the
  // prose: every ⚠️ precondition survives, the connective padding does not. **Do not raise the cap.**
  'dye.colourSource': 'Where the dye takes its colour. Depth, Palette and Ramp all walk a gradient — the '
    + 'material’s, the one you picked, or ⚠️ the dye’s own (the only one neither material nor palette can '
    + 'move). Figure copies the particles’ colours as they are; Velocity does the same but ⚠️ dims slow '
    + 'particles. Temperature reads the material’s heat ramp. Fixed paints one colour, so ⚠️ only its '
    + 'density varies.',
  'dye.mapping': 'Which way the gradient is laid across the figure. Depth runs it from near to far, so the '
    + 'flow mixes near and far colours. Index runs it along the curve instead, in the order the particles '
    + 'are drawn, which gives bands — ⚠️ only Depth, Palette and Ramp read a gradient, so this does nothing '
    + 'for the other four.',
  'dye.cycles': 'How many times the gradient repeats along the curve under Index. ⚠️ Bands wash out if '
    + 'they get finer than the marks that paint them: lower Dye Radius, or use a sparser figure, if raising '
    + 'this stops adding detail. ⚠️ A gradient whose two ends differ shows a seam where it wraps.',
  'dye.showFigure': 'Draw the figure itself, or hide it and keep only the dye it stirs up. With this off the '
    + 'curve still paints and still moves the field — you simply do not see it, so the dye becomes the whole '
    + 'picture. ⚠️ Sparks, crystals and the liquid pool keep drawing; only the curve is hidden. ⚠️ The frame '
    + 'gets much darker, because the figure was most of the light, so expect to raise Dye Amount and '
    + 'Exposure. ⚠️ It does nothing while the dye is not visible, so the figure can never vanish with '
    + 'nothing to replace it.',
  'dye.blendMode': 'How the dye combines with what is behind it. Over lets dense dye read as real, possibly '
    + 'dark fluid and can never overbrighten, but it thins the figure’s trail where the dye is thick. Add '
    + 'only ever adds light, so it hides nothing — ⚠️ but then Trail Decay also controls the dye’s '
    + 'brightness, and a long trail with Add will blow out toward white. ⚠️ Neither applies in Render Mode '
    + 'Liquid with Tint Source = Dye, where the surface does its own compositing.',
  'dye.ramp': 'The gradient the dye colours itself by when Dye Colour is Ramp. The same list the Colour '
    + 'Palette offers, but chosen separately — ⚠️ this is the only way to give the dye a colour that neither '
    + 'the material nor the figure’s palette can move.',
  'dye.fixedColour': 'The single colour every particle paints when Dye Colour is Fixed. ⚠️ Near-black dye is '
    + 'indistinguishable from no dye at all, since the surface takes this as its own colour rather than '
    + 'layering it over something.',

  // ---- Customize: Particles ----
  'cp.glow': 'Size and softness of each particle’s halo — a SHAPE control, not a brightness one. Low values '
    + 'give a tight bright core, high values a wide diffuse bloom. Only used by Star and Blend modes.',
  'cp.depthSize': 'How much nearer particles are drawn larger than distant ones. This is the main cue that '
    + 'makes a 3D figure read as having depth rather than as a flat pattern.',
  'cp.depthBrightness': 'How much nearer particles are drawn brighter than distant ones. Use it with Depth '
    + 'Size when the figure looks uniformly lit and therefore flat.',
  'cp.depthDof': 'Depth of field: blurs particles away from the focal depth, so only the middle of the '
    + 'figure is sharp. A photographic cue — it makes the figure read as an object being photographed.',
  'cp.depthColorShift': 'Tints distant particles away from near ones, an aerial-perspective cue. Adds depth '
    + 'separation without changing size or brightness, which is useful when both are already committed.',
  'cp.lightingMode': 'How particles are shaded: flat ignores direction entirely, the lit modes add a '
    + 'directional highlight and a rim, so the figure gains a surface instead of reading as emissive dust.',
  'cp.rimPower': 'How tightly the rim highlight hugs the silhouette. High values give a thin bright outline, '
    + 'low values a broad wash across the whole facing side.',

  // ---- Colour Palette (v8 Step 21.4a / 21.4e / 21.4g) ----
  //
  // ⚠️ **`cp.palette` and `cp.paletteMapping` are GONE and must not come back** — `21.4g` removed the
  // Customize sub-panel's palette rows, because two rows labelled `Palette` meant one of them was always
  // inert with nothing to say which. There is one palette control; a film look that HAS a palette now WRITES
  // it into this one. `tipcheck` asserts both directions, so a re-added row would fail here rather than
  // silently.
  //
  // ⚠️ **Both texts below say "a look that brings one", and the qualifier is load-bearing** — three bundles
  // carry `palette: 'none'`, meaning they decline to choose, and since 2026-09-19 they write nothing (the
  // owner reported the unqualified version erasing a preset's own palette). ⚠️ **Deliberately NOT naming the
  // three**: no checker holds a tooltip to `FILM_LOOKS`, so an enumeration in user copy would go stale the
  // first time a bundle gained or lost a palette, silently and in the one place the user is told to trust.
  overlayPalette: 'The palette in force, whatever supplied it. Replaces per-particle colour with a gradient '
    + 'and keeps the named film look — and choosing a film look that brings a palette sets this to that '
    + 'look’s own, which you can then change here. A look that brings none leaves your choice alone. None '
    + 'means no palette at all.',
  overlayPaletteMapping: 'Which per-particle quantity is looked up in the palette. Phase follows position '
    + 'along the curve; Depth colours by distance, and ⚠️ on a flat pose every particle has the same depth so '
    + 'the whole figure comes out one colour. ⚠️ Particle index is the odd one out: it colours the population '
    + 'by position in the sweep, on the CPU, so it reaches every render mode including ribbons and neon '
    + 'lines — and it is the only one the two rows below can move.',
  indexCycles: 'How many times each colour channel sweeps its palette across the whole population. Under 1 '
    + 'the figure is one long gradient; above about 8 it reads as banding, and very high values as noise.',
  colourDrift: 'How fast each channel’s colour cycles as the figure sweeps, in radians of phase per step. '
    + 'Opposite signs on two channels make the hue rotate rather than pulse; zero freezes the colours to '
    + 'their particles.',

  // ---- Customize: Bloom ----
  'cp.bloomEnabled': 'Bleeds light from bright pixels into their surroundings, the way a camera does. This '
    + 'is what makes bright cores read as genuinely hot rather than merely white.',
  'cp.bloomThreshold': 'How bright a pixel must be to bloom. It SUBTRACTS against accumulated values that '
    + 'can reach the hundreds, so on a dense trail it is a weak lever — reach for Intensity instead.',
  'cp.bloomIntensity': 'How strongly the bloom is added back. A plain multiplier, so this is the effective '
    + 'control over how much the image glows.',

  // ---- Customize: Tone Map ----
  'cp.toneMapEnabled': 'Compresses out-of-range brightness into what the display can show, instead of '
    + 'letting it clip flat. Turn it off only to see the raw accumulation.',
  'cp.toneMapCurve': 'Which compression curve to use. ACES rolls the highlights off like film; None clips '
    + 'hard, which flattens bright cores into featureless white.',
  'cp.exposure': 'Overall brightness before the tone curve. This is the right first control for an image '
    + 'that is too dark or blown out — it moves the whole picture through the curve.',
  'cp.saturation': 'Colour intensity after tone mapping. ⚠️ Pixels already clipped to white upstream have '
    + 'lost their hue and cannot be recovered here; fix those with Exposure or Gain.',
  'cp.vignette': 'Darkens the frame edges, drawing the eye to the centre. A composition control — it also '
    + 'hides the hard edge where a warp meets the frame border.',
  'cp.lift': 'Raises or lowers the BLACKS per channel. Use it to tint the empty background, which is what '
    + 'the darkest pixels almost all are.',
  'cp.gamma': 'Bends the MIDTONES per channel without moving black or white. The control for colour balance '
    + 'in the body of the image.',
  'cp.gain': 'Scales the HIGHLIGHTS per channel. Past the tone curve’s knee the output no longer depends on '
    + 'the input, so this — not Exposure — is what owns the colour of a saturated core.',

  // ---- Force Field ----
  'force.blend': 'Pushes the actual PARTICLES along the same field the image warp uses, so the figure’s '
    + 'geometry is displaced rather than the picture of it. 0 is off. It leans the figure into the field; it '
    + 'cannot make it orbit, because each particle is sampled at its mathematical position.',
  'force.return': 'How strongly particles are pulled back to the curve. High values let the force only lean '
    + 'the figure; low values let it drift far from its authored shape.',
  'force.sparks': 'Also applies the force to material sparks. Off keeps sparks on their own ballistic paths, '
    + 'so they read as independent embers rather than as part of the figure.',
  'force.gateBy': 'Scales the force per particle by one of its own properties, so the push differentiates '
    + 'within a single figure instead of moving everything equally. Age and Temperature need an active '
    + 'material to mean anything and are disabled without one.',
  'force.gateInvert': 'Flips which end of the gating property gets the force — young instead of old, cool '
    + 'instead of hot, near instead of far.',

  // ---- Fluid Feedback ----
  'fluidFeedback.persist': 'How long the trail survives inside this style’s own feedback loop. High values '
    + 'let the warp compound over many frames, which is what turns a displacement into a flowing current.',
  'fluidFeedback.amplify': 'Multiplies the warp fed back into the next frame. This is the loop gain — the '
    + 'control that decides whether the motion settles into a steady flow or runs away into chaos.',
  'fluidFeedback.fieldDecay': 'How long the velocity field remembers its own history. Near 1 the flow has '
    + 'momentum and keeps moving after the source changes; lower values make it track the figure closely.',
  'fluidFeedback.glowBoost': 'Extra brightness for the feedback trail, so the flowing part of the image '
    + 'stands out from the figure that is feeding it.',

  // ---- Procedural Flow ----
  'flow.archetype': 'A named flow shape — the field the warp follows. Pick the shape first, then '
    + 'parameterise it with the sliders below; changing a slider keeps the shape.',
  'flow.strength': 'Peak displacement of the flow field, in the same 8%-of-the-frame unit the other styles '
    + 'use, so a value means the same amount in every style.',
  'flow.scale': 'Spatial size of the flow features. Small values give fine local swirls, large values one '
    + 'broad sweep across the whole frame.',
  'flow.curlAmount': 'Blends the field from straight flow toward pure curl. Curl circulates rather than '
    + 'translating, so this is the control that turns a push into a swirl.',
  'flow.direction': 'Direction of the flow’s straight component, in degrees. Irrelevant once Curl Amount is '
    + 'at 1, where the field only circulates.',
  'flow.radial': 'Adds an inward (negative) or outward (positive) component about the frame centre, for a '
    + 'sink or a source. Combine with Curl Amount to get a spiral rather than a plain drain.',
  'flow.evolutionSpeed': 'How fast the flow field itself changes over time. At 0 it is a fixed field, so the '
    + 'image settles into a static distortion instead of continuously flowing.',
};

/**
 * Tooltips for section and sub-section headers, keyed by the header's own visible text.
 *
 * Keyed by text rather than by an id because `sectionTitle(text)` / `subTitle(text)` take only the text, and
 * adding an id parameter to both would mean editing every call site to say twice what they already say
 * once. ⚠️ The cost is that RENAMING a header silently drops its tooltip — the same failure `CONTROL_TIPS`
 * has, and the reason both live in one file to grep. ⚠️ **This table covers `visual-fx.ts` ALONE** — §C/§D
 * read that one file, so a header in another tab is tooltipped from `TAB_TIPS` and must NOT be added here.
 * (The call-site count was quoted here until 21.12 changed it; re-`grep` it, never carry the figure.)
 */
export const HEADER_TIPS: Record<string, string> = {
  // ---- the five GROUP headers (v8 31.U). ⚠️ These are read by `groupTitle()`, which `tipcheck`
  // §C/§D matches alongside `sectionTitle`/`subTitle` — so a group without a tip here fails the build
  // check, and a tip with no group fails it too.
  'Figure': 'What shape exists at all, before anything is drawn: how big it is and how fast it moves, '
    + 'how space itself is bent around it, and whether a chaotic attractor replaces it entirely. Start '
    + 'here — everything in the groups below acts on whatever this group produces.',
  'Particles': 'What each individual particle LOOKS like: which kind of mark is drawn, how the marks '
    + 'vary from one particle to the next, and whether they are joined into continuous strokes. Render '
    + 'Mode comes first because it decides which of the rest apply at all.',
  'Colour': 'Where colour comes from and how the finished frame is graded — the film look with its '
    + 'eighteen individual controls, and the palette that can replace per-particle colour. Almost '
    + 'every preset uses something in here, so the badge on this header is usually lit.',
  'Image': 'Effects that warp the accumulated PICTURE rather than the figure. These run after '
    + 'everything above and read the frame as an image, which is why a kaleidoscope here gives flat '
    + 'ghosts pinned to the viewport while Deformation gives a solid that tumbles.',
  'Fields': 'Simulations that run over time and act on the particles — cohesion, a liquid pool, the '
    + 'dye field, fluid advection, curl noise and a Physarum network. Five of the six end in the same '
    + 'place, a smooth nudge to each particle position, so they layer rather than conflict; the dye is '
    + 'the exception and colours instead of pushing. Last and collapsed because these are the least '
    + 'used controls in the engine — most presets leave every one of them off.',
  'Framing & Timing': 'How big and how fast: the size of the figure in the frame, the speed of everything '
    + 'that moves, how many particles draw it, and its rotational symmetry. Reach for these before styling.',
  /*
   * v8 `33.2`/`33.3` — ⚠️ **This header's job is to explain why these two are NOT in `Deformation`**,
   * because that is where a user will look for them and the distinction is real: these change what the
   * curve is made of, the deformers below move an already-built curve's points. `facetcheck` §B holds the
   * same line in machine-readable form.
   */
  /*
   * ⚠️ **ONE ROW SINCE 2026-10-28, and the tip was rewritten rather than left describing two.** `Travel`
   * moved to `Framing & Timing` on owner instruction after confirming both controls by use, so this
   * section is `Sharpness` alone. The old text promised *"whether it closes into a loop"* — a section
   * heading that describes a control filed somewhere else is worse than a thin section.
   *
   * ⚠️⚠️ **AND IT WAS STILL TOO NARROW — WIDENED BY `35.4`.** The sentence above was written for
   * `Sharpness` alone and then `34.3`/`34.4` filed `Grow`, `Flare` and `Flare Rate` here, so for two phases
   * the header of a SIX-row section described one of them and the other five read as misfiled. **That is
   * the inverse of an over-claiming caption and no checker reads either**: `tipcheck` §C/§D assert this key
   * exists and is used, never that it covers what the section holds. The widened text names both halves —
   * what the wave is MADE of (`Sharpness`, `Temper`) and how its amplitude RUNS ALONG the curve (`Grow`,
   * `Flare`) — and both are generator terms, which is the classification that keeps them out of
   * `Deformation` (`facetcheck` §B's `NOT_DEFORMATION.grow` records that decision).
   */
  'Curve Basis': 'Changes what the curve itself is made of, before anything below deforms it: whether it is '
    + 'built from smooth waves or from straight faceted segments, and how its reach grows or shrinks along '
    + 'its own length. Deformation bends a finished figure; this decides what that figure is made of.',
  'Deformation': 'Bends space itself, before the figure is turned toward the camera — so the result reads as '
    + 'a solid object being deformed rather than a picture being distorted. These are functions OF a point’s '
    + 'position, unlike the flow and turbulence controls further down, which add a push TO it. They need a '
    + 'figure with depth to show their full effect, and they compose with Symmetry above.',
  'Per-Particle': 'Until now every particle in a figure looked the same. These rows let one ordered '
    + 'quantity — position along the curve, speed, depth or colour phase — set each particle’s size, '
    + 'brightness and solidity individually. One shared Driver feeds all three, so the result reads as '
    + 'structure in the figure rather than as noise over it. Everything here is off by default and off '
    + 'is exact.',
  'Splat Shear': 'Chooses which way a material splat is stretched across its direction of travel. Follow path keeps every mark the same apparent width; Flat nib fixes the cross-axis to the screen so marks widen across the motion and narrow along it, like a calligraphy pen. Needs a material to be visible at all.',
  'Ribbon Rendering': 'Draws the particle path as a continuous solid band rather than as separate points, so '
    + 'the curve reads as a surface.',
  'Neon Lines': 'Each particle draws its recent path as a short glowing trail, so the figure\'s motion shows '
    + 'as light-trails. Most legible at a moderate particle count.',
  'Electric Discharge': 'Crackling, forking filaments of light around the figure, like an electric discharge. '
    + 'Needs Neon Lines: turning it on turns them on (ending Ribbons), and turning them off turns it off.',
  'Film Look': 'The whole grading chain — bloom, tone curve, exposure, colour, vignette — as named bundles. '
    + 'Pick Customize to edit the individual values.',
  // ⚠️ Since 21.4g this is the ONE palette header — the Customize sub-panel's `Palette` sub-header and its
  // two rows are gone. The title stays `Colour Palette` rather than `Palette` because `tipcheck` keys these
  // by TEXT and the retirement is asserted on the old spelling.
  'Colour Palette': 'The palette in force for this preset, composed with whatever film look is selected '
    + 'rather than replacing it. Choosing a film look that brings a palette sets this to that look’s palette, '
    + 'and one that brings none leaves it as it is; change it here to override either way. Particle index is '
    + 'the mapping the legacy colour law uses, and the only one whose rates are editable.',
  'Index Colour': 'The per-particle colour law itself: how many times each channel sweeps across the '
    + 'population, and how fast it cycles as the figure moves. Shown only under the Particle index mapping.',
  Attractor: 'Replaces or blends the sine-wave figure with a strange attractor, keeping the current '
    + 'rendering and grading.',
  'Curl Noise': 'Adds a divergence-free turbulent flow to every particle, so the figure churns and eddies '
    + 'rather than tracing a clean curve.',
  'Render Mode': 'How an individual particle is drawn — flat point, glowing star, accumulated density or '
    + 'ray-marched fog. It changes which of the grading controls below have any effect.',
  'Translation Map': 'Warps the rendered IMAGE itself, downstream of the particles. Layers each contribute a '
    + 'displacement and are summed into one warp pass; Enable gates all of them at once.',
  'Physarum Network': 'A slime-mould simulation whose agents follow and reinforce their own trail until it '
    + 'condenses into a branching vein network, blended over the figure.',
  'Fluid Advection': 'Carries the particles along a fluid velocity field, so the figure is dragged and '
    + 'sheared as if suspended in a current.',
  'Volume Render': 'Settings for the Volume render mode’s ray-marched fog. Shown only while that mode is '
    + 'selected.',
  'Liquid Surface': 'Settings for the Liquid render mode, which draws one merged surface through the '
    + 'particles instead of a cloud of separate sprites. Shown only while that mode is selected.',
  // ⚠️ States that it is NOT mode-gated, because it sits directly under a section that is: the natural reading
  // of the position would be that these belong to Liquid too, and they move the particles in all seven modes.
  Cohesion: 'Pulls nearby particles together so the figure beads into drops rather than staying one smooth '
    + 'curve. It changes the particles, not the rendering, so it applies in every render mode — Liquid is just '
    + 'the one that then fuses the drops into single surfaces.',
  // ⚠️ Says what it ADDS, because that is what separates it from the two sections above it: Liquid Surface
  // changes how the figure is drawn and Cohesion changes how its particles move, while this one creates
  // particles the figure never had. Also not mode-gated, for the same positional reason as Cohesion.
  'Liquid Field': 'Adds a separate pool of particles for the figure to stir, so it moves THROUGH a liquid '
    + 'instead of being one. The pool joins the same particle set, so every render mode draws it — and like '
    + 'Cohesion it is unrelated to whether Liquid mode is selected.',
  // ⚠️ Says where the output GOES, because that is this section's failure mode rather than what it adds: the
  // three sections above it all show their effect immediately, and this one shows nothing until a dropdown in
  // Liquid Surface is set. The header is where someone reading the tab top-to-bottom meets that first.
  'Dye Field': 'The figure paints colour into a field the flow then carries, so the body keeps a memory of '
    + 'where it has been. ⚠️ Unlike the sections above, this one has no effect you can see on its own — it is '
    + 'read as the liquid surface’s colour, so it needs Render Mode Liquid with Tint Source = Dye.',

  // Sub-headers
  // ⚠️ RENAMED from `Particles` 2026-10-25: that word is now a GROUP header, and two headers may not
  // share a label — `tipcheck` maps one tip per name, so the duplicate was a compile error. The new
  // name is also the more accurate one for what this sub-panel holds.
  'Particle Shape': 'The shape and depth cues of an individual particle — its halo, and how much nearer particles '
    + 'differ from distant ones.',
  // ⚠️ **No `Palette` sub-header entry — `21.4g` removed that sub-panel, and re-adding one would be the
  // regression.** It read *"Replaces per-particle colour with a gradient … the last word on hue"*, which was
  // true of the field and false of the UI: the `Colour Palette` section above wins, so the row it titled was
  // inert whenever that section was set. `tipcheck` §C/§D key these by TEXT, so the two used to need
  // deliberately different titles; there is one title now.
  Bloom: 'Bleeds light out of bright pixels the way a camera does, which is what makes bright cores read as '
    + 'hot rather than merely white.',
  'Tone Map': 'Compresses out-of-range brightness into what the display can show, then grades the result. '
    + 'Without it, bright areas clip flat.',
  Layers: 'The warp chain. Each layer contributes a displacement, all of them are summed into one pass, and '
    + 'at most one layer per style may be present.',
  /*
   * ⚠️ **`Zoom half` and `Zoom centre` are BACK (2026-09-23) because their headers are, and the reason they
   * are not the Transmap tab's strings is worth reading before "deduplicating" them.** v8 21.12 moved both
   * headers out of `visual-fx.ts`; the owner reversed that split, so both tabs now carry a `Zoom half` and a
   * `Zoom centre` section over the same layer.
   *
   * ⚠️ **THE TWO SENTENCES ARE DIFFERENT ON PURPOSE.** `TAB_TIPS['transmap.zoomHalf']` says "everything above
   * is the shift, everything here is the zoom", which describes that tab's LAYOUT — the term panes sit between
   * the two. In `visual-fx.ts` there are no term panes, so the same sentence would point at rows that are not
   * on screen: invariant 25's shape, a description that names a thing the user cannot see. One subject, two
   * places, two true sentences. What IS shared is imported rather than restated — the tracks (`DRIFT_TRACK`,
   * the `STATIC_FIELD_*` bounds) and the measurement (`field-measure.ts`).
   *
   * ⚠️ **`tipcheck` §C/§D key these by TEXT and read `visual-fx.ts` ALONE**, so read a §D failure here as "no
   * header in `visual-fx.ts`", never as "no header anywhere" — that is how §D reported the 21.12 move, and it
   * would report a re-removal identically.
   */
  'Zoom half': 'Zoom Combined applies a shift and a zoom together, and they come from separate tables: the '
    + 'rows above are the shift, the rows here are the zoom. It is not one field at two detail levels.',
  'Zoom centre': 'Where this layer’s zoom pushes away from. Per-layer and optional — left alone, the layer '
    + 'follows the preset’s own centre. Wave Shift has no centre at all, so the section is absent there.',
  'IFS Transforms': 'The affine maps of an iterated function system: each row is one contraction, and the '
    + 'figure is what survives applying them over and over.',
  'Force Field': 'Pushes the actual particles along the same field the warp uses, so the figure’s geometry '
    + 'moves rather than the picture of it. A property of the whole chain, not of one layer.',
  'Fluid Feedback': 'Feeds the warped result back into the next frame’s warp, so displacement compounds into '
    + 'a self-sustaining flow.',
  'Procedural Flow': 'Builds the displacement from a named flow shape rather than from the preset’s wave '
    + 'table, then lets you parameterise that shape.',
};

/** Tooltips for the Materials tab, keyed by its `FireRowDef.key` (and by label for hand-built rows). */
export const MATERIAL_TIPS: Record<string, string> = {
  // ---- the three GROUP headers (v8 31.M). ⚠️ Keyed with a ` group` suffix so they cannot collide with
  // the row and section labels that already use the bare words `Material` and `Crystals` — two headers
  // sharing a name is a compile error in HEADER_TIPS and a silent mis-tooltip here.
  'Material group': 'Which material the particles are drawn with, and how its heat and blending behave. '
    + 'This is the tab subject: picking None turns everything here off, which is why this group is the '
    + 'one that opens by default. Every other group on this tab needs a material before it does anything.',
  'Fire group': 'The two systems that only exist for fire-like materials — the buoyancy that lifts hot '
    + 'particles, and the sparks that fly off them. ⚠️ Both are hidden entirely unless the chosen '
    + 'material is a fire type, because neither has anything to act on otherwise. One condition governs '
    + 'the pair, which is why they share a group.',
  'Crystals group': 'A separate population of hard, faceted, occluding ice, ADDED beside the figure '
    + 'rather than replacing any of it. It has its own pool, its own lifecycle and its own colour ramp, '
    + 'so it is not a property of the material — it only borrows the material heat to decide where ice '
    + 'forms. The largest section on the tab and the least used, so it starts closed.',
  // ---- Material base ----
  splatRadius: 'Size of each particle’s deposit in pixels. This sets the scale of everything else in the '
    + 'material — a small radius reads as sparks, a large one as a continuous body.',
  coreBrightness: 'Brightness of the deposit’s centre. Raise it to make hot particles read as incandescent '
    + 'rather than merely coloured.',
  // ⚠️ **THE SECOND SENTENCE IS A PRECONDITION, NOT A DESCRIPTION, AND IT IS WHY THIS TIP IS LONGER THAN ITS
  // NEIGHBOURS (2026-09-04).** Reported as *"it seems really difficult to trim this down reducing Core
  // Brightness and Halo Strength"*, and the report is exactly right about Halo: the splat kernel computes
  // `circularShape = mix(haloFalloff * uHaloStrength, uCoreBrightness, coreZone)` with
  // `coreZone = smoothstep(0.3, 0.25, r)` (`renderers/hdr-particle.ts:777-782`), and `coreZone == 1` at
  // r = 0 — so at the centre the halo term is multiplied by zero. **Halo Strength is ALGEBRAICALLY absent
  // from a core pixel: exactly, not merely weakly.** That is invariant 13's harder form — the control moves
  // precisely the thing it names, and reads as inert because the pixels the user is looking at are the ones
  // it provably cannot reach. Under additive blending those centres are also the pixels most likely to be
  // clipped, so the two facts compound: the brighter the frame, the larger the region this slider cannot
  // touch. ⚠️ **The `mix` is CORRECT — do not "fix" the shader to let Halo bleed into the core.** A hard
  // core with an independent surround is the kernel's design, and the two terms not interacting is what
  // makes `falloffExponent` mean one thing. The remedy is the documented one: **a precondition belongs where
  // the user already is** (see this file's header — a tooltip is only found by someone who already suspects
  // the control, so a precondition is the one kind of copy that earns its place in a hover).
  haloStrength: 'Brightness of the soft surround outside the core. This is what makes a deposit glow into '
    + 'its neighbours instead of ending abruptly. ⚠️ It cannot dim a particle’s centre — the core is drawn '
    + 'by Core Brightness alone, so if the figure is washed out in its bright middles, this slider is not '
    + 'the control that reaches them.',
  falloffExponent: 'How sharply the deposit fades from core to edge. High values give a hard defined dot, '
    + 'low values a wide soft cloud.',
  thermalLag: 'How long a particle takes to reach the temperature its motion implies, in seconds. Near 0 the '
    + 'heat tracks the driver instantly; high values smear it, so hot regions trail behind the motion.',
  emissionIntensity: 'How much light the material emits for a given temperature. The master brightness of '
    + 'the material — note it does not reach crystals, which are lit rather than emissive.',
  heatGain: 'How much heat the driver produces. Raise it to push more of the figure into the hot end of the '
    + 'colour ramp; lower it to keep only the fastest or highest particles hot.',
  velocityStretch: 'Stretches each deposit along its direction of travel, so fast particles read as motion '
    + 'streaks rather than as dots. Effective range is 0–1.',
  heatMode: 'Which per-particle quantity becomes temperature: how fast it moves, where it is, or how old it '
    + 'is. This decides WHERE the material is hot, and so what the figure’s hot regions mean.',
  blendMode: 'How deposits combine. Additive accumulates without limit, so overlaps brighten — ⚠️ it also '
    + 'changes what trail persistence means, and a value carried over from Alpha can end up many times too '
    + 'strong. Alpha composites with coverage and stays bounded.',
  // ⚠️ v8 15.9 — this tip now owns the ONE fact a user cannot discover from the dropdown: two of the nine
  // entries are named after liquid and they differ by RENDER MODE, not by their numbers (which are identical
  // by design). ⚠️ **It deliberately does NOT promise that Liquid colours the surface** — the material's live
  // contribution is motion and drops; the colour is Tint Source's, whose single owner a material may not
  // write (invariant 17). Saying otherwise here is what would make a correct engine read as broken.
  material: 'A named bundle of every material setting below. Picking one replaces them all — and decides '
    + 'crystals too: Ice switches them on, every other material switches them off. ⚠️ Liquid and Liquid '
    + 'Light hold the same values and differ only in how they are drawn: Liquid switches you to the merged '
    + 'iso-surface, Liquid Light draws separate glowing sprites. Liquid gives the surface its motion and '
    + 'its drops, not its colour — that stays with Tint Source in the Visual FX tab.',

  // ---- Buoyancy ----
  strength: 'How hard hot particles rise. This is what turns a heat map into a flame that has an up.',
  returnForce: 'How strongly particles are pulled back to their position on the curve. High values keep the '
    + 'figure recognisable while it burns; low values let the flame leave it behind.',
  turbulence: 'Sideways jitter added to the rise, so the flame licks and wavers instead of climbing '
    + 'straight.',
  maxOffset: 'Hard ceiling on how far a particle may be displaced, in pixels. The safety rail that stops a '
    + 'strong flame from evacuating the figure entirely.',
  smokeThreshold: 'The temperature below which a risen particle becomes smoke. Raise it to convert more of '
    + 'the flame to smoke, lower it to keep the column burning higher.',
  smokeOpacity: 'How visible smoke is. Smoke is drawn dark and unlit, so this is also how much of the figure '
    + 'behind it gets obscured.',
  smokeDissipation: 'How slowly smoke thins out. Near 1 it lingers and builds into a column; lower values '
    + 'make it vanish just above the flame.',

  // ---- Sparks ----
  poolSize: 'Hard ceiling on how many pooled bodies can exist at once. It bounds every rate below it — '
    + 'raising a birth rate past what the pool can hold just recycles faster.',
  threshold: 'How hot a particle must be to eject a spark. Raise it to make sparks rare and meaningful; '
    + 'lower it for a continuous shower.',
  ejectionSpeed: 'How fast a spark leaves the figure. Together with Gravity this sets the shape of the arc.',
  gravity: 'Downward acceleration on sparks, in pixels per second squared. 0 lets them fly straight out; '
    + 'high values give short ballistic hops that fall back.',
  drag: 'Air resistance on sparks. High values make them stall and hang; 0 lets them carry to the frame '
    + 'edge.',
  maxLifetime: 'How long a spark lives, in seconds, before it is returned to the pool. The main control over '
    + 'how far sparks travel from the figure.',
  coolingRate: 'How fast a spark loses heat, and so fades down its colour ramp. High values give brief '
    + 'bright flecks, low values long-lived embers.',
  maxSparksPerFrame: 'Per-frame birth limit. A cost control: it caps the work regardless of how much of the '
    + 'figure is above Threshold.',

  // ---- Crystals ----
  birthRule: 'What makes a particle nucleate a crystal: slow motion, low temperature, or chance. ⚠️ cold '
    + 'needs an active material to read temperatures and quietly behaves as slow without one.',
  slowFraction: 'What fraction of the population counts as slow (or cold) enough to nucleate. A percentile, '
    + 'so it adapts to the preset instead of needing a threshold per figure.',
  freezeCap: 'Soft target population, as a fraction of the pool. Nucleation halts above it and melting is '
    + 'never gated, so the population settles back toward this level on its own.',
  nucleationBudget: 'How many crystals may be born per frame. Together with Lifetime this sets the turnover '
    + 'rate — how lively the structure looks.',
  crystalLifetime: 'How long a crystal lasts before it melts, in seconds. Long lifetimes build a persistent '
    + 'structure; short ones give a shimmering surface that is always renewing.',
  nucleationTime: 'How long a crystal takes to grow to full size, in seconds. It is not yet solid during '
    + 'this ramp, so it exerts no cluster force and accretes nothing.',
  meltTime: 'How long a crystal takes to fade away, in seconds. Longer melts read as thawing; short ones as '
    + 'shattering.',
  meltThreshold: 'The temperature at which a crystal melts early, before its lifetime is up. The control for '
    + 'ice that retreats from a nearby flame.',
  crystalSize: 'Base size of a crystal in pixels. Compensated per shape, so switching shape changes the '
    + 'silhouette without also changing the apparent weight.',
  iceOpacity: 'How much a crystal occludes what is behind it. Crystals are the one alpha-occluding element '
    + 'here, so this is what makes them read as solid rather than as another glow.',
  specularStrength: 'Brightness of the highlight on a facet. This is what says "mineral" rather than "fog" — '
    + 'raise it for glassy ice.',
  facetSharpness: 'How crisply the facets meet. High values give a cut-gem look, low values a rounded '
    + 'water-worn one.',
  edgeBrightness: 'Brightness of the crystal’s outline. It separates overlapping crystals from each other, '
    + 'which a cluster needs to read as many bodies rather than one mass.',
  internalRefraction: 'How much the crystal appears to bend what is behind it, so it reads as a transparent '
    + 'solid with a thickness instead of a coloured shape.',
  shape: 'The crystal’s silhouette. hexagon is the original solid look, plate a thin ringed disc, dendrite a '
    + 'growth-driven snowflake, prism a quartz shard. plate and dendrite gain internal detail as they grow.',
  crystalRamp: 'Which colour ramp maps a crystal’s temperature to its colour. ice is the expected mineral '
    + 'reading; the others deliberately break it.',
  clusterForce: 'The only crystal control that moves the FIGURE. Negative deflects particles around the ice '
    + 'as an obstacle, positive draws them toward it as an accretion bias, 0 is off.',
  clusterForceRadius: 'How far the cluster force reaches, in MODEL units — check it against the figure’s own '
    + 'extent, not against the pixel size of the crystals.',
  clusterForceReturn: 'How strongly deflected particles return to the curve. High values keep the figure '
    + 'intact while it flows around the ice.',
  accretionRadius: 'How close a passing particle must come to stick to a crystal, in pixels. The main '
    + 'control over how fast a cluster grows.',
  stickingProbability: 'Chance that a particle within range actually deposits. Low values give sparse '
    + 'branching growth, high values a dense compact mass.',
  growthAnisotropy: 'How strongly deposits are biased along six axes. This is what turns a growing blob into '
    + 'a dendrite with arms.',
  maxGrowth: 'How much a crystal may thicken beyond its base size. What differentiates a mature crystal from '
    + 'a freshly nucleated one.',
  accretionBudget: 'Per-frame limit on deposits. A cost control, and also a way to slow growth so it can be '
    + 'watched.',
  latticeSnap: 'Pulls deposits onto a shared hexagonal grid, so joints come out crisp and angular instead of '
    + 'organically wobbly. Acts only on accreted deposits, so it needs Growth on.',
  latticeCell: 'Spacing of that grid, in pixels. It sets the visible step size of the crystalline structure.',
  growthEnabled: 'Master switch for accretion, thickening and the spatial hash — all inert until this is on. '
    + 'It also needs crystals that have already finished forming: deposits land on solid crystals, so an '
    + 'empty pool grows nothing.',
  symmetryFoldCrystal: 'Mirrors every deposit into all six sectors, so the arms grow identically and the '
    + 'cluster reads as one snowflake rather than six separate lumps. Costs up to 6 pool slots per deposit.',
};

/**
 * Tooltips for the two panels' HEADER CHROME — the Lab's own buttons and the Preview Grid's — keyed by a
 * stable id rather than by the visible label, because two of them (`Rename`/`Save`) change their caption with
 * their mode and one (`Grid`/`Lab`) is really two buttons in two panels.
 *
 * ⚠️ **The TAB BAR is deliberately NOT here.** Its texts live in `panel.ts`'s own `TAB_DEFS`, which is
 * already that bar's single descriptor table — putting them here as well would be invariant 17's shape (one
 * setting, two sources, drifting silently), and an earlier draft of this file did exactly that and left the
 * copy here with no reader at all.
 *
 * ⚠️ **This paragraph said "its EIGHT texts" until 2026-10-05, and a figure is not what this file owns.**
 * `TAB_DEFS` gained the Composer, the Transmap and the Reel as appends and then LOST Archetypes, so the
 * number has now been wrong in both directions — **count `TAB_DEFS`, never quote a total from a comment.**
 * `TAB_DEFS`' ORDER is also load-bearing as of the owner's 2026-10-05 reshuffle (the Lab opens on
 * `TAB_DEFS[0]`), which is a second reason the table must stay the only place the bar is described.
 *
 * ⚠️ **No `Record<string, string>` annotation, unlike its four siblings, and that is deliberate.** Its readers
 * use DOTTED access (`CHROME_TIPS.reset`), so leaving the keys inferred makes `CHROME_TIPS.rest` a `tsc` error
 * instead of a `title` reading `undefined` — the one failure mode this file's header calls out, closed by the
 * compiler for the one table whose shape permits it. The subscript-keyed tables cannot borrow this (their
 * readers index with a computed `CategoryLock` or a dotted string), which is why `tipcheck` §H exists.
 */
export const CHROME_TIPS = {
  // ---- Synthesis Lab header ----
  reset: 'Restore the preset, and this tab’s own state, to how they were when you entered the tab. Other tabs '
    + 'and the snapshot history are left alone.',
  snapshot: 'Save the current preset — including all live Visual FX state — as a tile in the History tab, so '
    + 'you can return to it after exploring further.',
  rename: 'Rename the current preset in the library. Only works on a saved preset: an edited or mixed one has '
    + 'no library entry to rename, so export or snapshot it first.',
  export: 'Download the current preset as a JSON file, with every live Visual FX setting baked in. The file '
    + 'can be imported back here or shared.',
  import: 'Load a preset from a JSON file, or a whole bundle exported with Export All. You confirm the name '
    + 'first, and a clash is offered a version suffix rather than overwriting.',
  grid: 'Switch to the Preview Grid, which animates every preset in the library as a live tile.',
  settingsSearch: 'Find any setting in the Lab by name, or by what it does — it reads the tooltips as '
    + 'well as the labels. Results show the tab and section each one lives in; click to go there. '
    + 'Named values are searchable too, so Neon finds the film look, the palette and the section. A '
    + 'setting that is switched off or unavailable on this preset says so rather than being hidden.',

  // ---- Preview Grid header ----
  lab: 'Switch to the Synthesis Lab to edit the current preset across eight tabs of controls.',
  exportAll: 'Download the whole library as one JSON bundle, in the order the grid currently shows. Import '
    + 'reads it back as a bundle, so it doubles as a backup.',
  search: 'Type to filter the library and pick a preset from the suggestions; Escape restores the current '
    + 'name. In Rename mode this same field holds the new name instead.',
  searchClear: 'Clear the filter and show the whole library again. Escape in the field does the same.',
  renameGrid: 'Rename the selected preset: press once to edit the name in the search field, then press Save. '
    + 'A name already in use comes back with a version suffix for a second, deliberate Save.',
  renameGridSave: 'Save the new preset name (Enter also works). Escape cancels and restores the original.',
  playMainReel: 'Play the main reel full screen, starting from its first preset. The main reel is chosen '
    + 'in the Reel tab; Escape stops it and brings this grid back. This is the same playback the '
    + 'screensaver uses.',
  sort: 'Reorders the tiles only — the library itself is untouched. Library order interleaves each refined '
    + 'preset beside its original, which a name sort splits apart.',

  // ---- Preview Grid filter (v8 Phase 22) ----
  //
  // ⚠️ **The ~168 FACET tooltips are NOT here and must not be copied here.** Each lives on its own `FacetDef`
  // in `presets/preset-facets.ts`, beside the predicate it describes, for the same reason the tab bar's eight
  // texts live in `TAB_DEFS`: a facet's tip explains its ACTIVATION SCALAR, so separating the words from the
  // test is invariant 17's shape (one text, two sources) over the one pairing the phase exists to keep honest.
  // These five are the filter's CHROME, which has no descriptor of its own.
  filter: 'Filter the grid by what each preset actually does — materials, populations, fields, Translation Map '
    + 'styles, palettes. Click a chip once to require it, twice to exclude it, a third time to clear it.',
  filterClear: 'Clear every active filter chip and show the whole library again. The search field is separate '
    + 'and is not touched.',
  filterSearch: 'Narrow the chips below by name — useful in the Colour & Grade group, which is the long one. '
    + 'This searches the filter names, not the presets.',
  filterCount: 'How many presets match the active filter, out of the whole library. Each chip’s own number is '
    + 'its library-wide total and does not narrow as you add more chips.',
  filterDrop: 'Remove the one chip that is costing the most matches — measured, not guessed. The other chips '
    + 'stay active.',
  filterSearchChip: 'The active text search, shown here because it narrows the grid alongside the chips. Click '
    + 'to clear just the search and keep the filter.',
};

/**
 * Tooltips for the seven tabs that are NOT built from a descriptor table — Mixer, Randomise, Sliders,
 * Archetypes, Evolution, History and, since v8 Phase 16, Composer. Keyed `<tab>.<control>`, because several
 * names (`sendToEvo`, `title`) legitimately recur across tabs with different surroundings.
 *
 * These tabs each have a handful of controls rather than 82, so they are hand-wired by necessity; the table
 * exists so the text sits beside the rest of the UI's copy instead of being scattered through seven `render()`
 * methods. `tipcheck` §H asserts every key here is read and every read resolves.
 *
 * ⚠️ **A HAND-WIRED TAB'S TOOLTIPS BELONG HERE AND NOWHERE ELSE, and putting them in the wrong table FAILS
 * `tipcheck` rather than merely being untidy.** §A–§D scan `visual-fx.ts` ALONE, because `CONTROL_TIPS` and
 * `HEADER_TIPS` exist to be matched against that file's descriptor table — so a `CONTROL_TIPS` entry for a
 * hand-wired tab is reported as matching no descriptor. The Composer is hand-wired (it has steppers, a canvas
 * and a refusal button, none of which the descriptor machinery can express), so all 21 of its keys are `TAB_TIPS`.
 */
export const TAB_TIPS: Record<string, string> = {
  // ---- Mixer ----
  'mixer.deckA': 'The preset the crossfader blends FROM, at the far left. Defaults to whatever is loaded and '
    + 're-syncs to it whenever you re-enter the tab.',
  'mixer.deckB': 'The preset the crossfader blends TO, at the far right. Nothing happens until both decks '
    + 'hold a preset.',
  // v8 2026-11-13 — the preset picker the deck buttons open.
  'picker.search': 'Type part of a name to narrow the tiles below. It combines with the Filter chips.',
  'picker.searchClear': 'Clear the name search.',
  'picker.close': 'Close without changing the deck. Escape does the same.',
  'picker.tile': 'Click to load this preset into the deck. The tiles follow the grid’s current sort, and the '
    + 'Filter chips here are the grid’s own, so a chip ticked here also narrows the grid.',
  /*
   * ⚠️ **"Interpolates every numeric parameter" WAS THE OLD COPY AND IT WAS FALSE** — CLAUDE.md's *Mixer
   * coverage* row says so in as many words, and v8 23.0 measured it: `interpolatePreset` wrote 20 of the 46
   * declared `overlay` keys and **destroyed the other 26 at every `t`**. 23.2 closed the hole, so the honest
   * sentence is now about WHICH LAW each setting answers to rather than about everything being numeric.
   * **Authorable, read and interpolated are three independent properties**; this copy promises only the third.
   */
  'mixer.crossfader': 'The master blend. Continuous values move smoothly between the decks; categorical ones '
    + '— render mode, curl noise, symmetry fold, material, TransMap style — cannot be half-way, so they SNAP '
    + 'to Deck B past the midpoint. At 0 you get Deck A exactly, at 100 Deck B exactly.',
  'mixer.sourceFigure': 'Keep this preset\u2019s look \u2014 colour, grade, materials, image warp \u2014 and take the '
    + 'FIGURE from Deck B. Rotation and the attractor come with the figure. The look rows are held at Deck A '
    + 'and the figure rows are handed to the crossfader, which moves to B — so dragging the crossfader '
    + 'back fades the figure towards Deck A’s while the look stays exactly as it is.',
  'mixer.reset': 'Go back to exactly how things were when you opened the Mixer: the preview returns to the '
    + 'preset you came in with, every row below takes its settings from Deck A again, the crossfader '
    + 'returns to A and any locks are released. Deck B stays chosen, so you can start a new mix from the '
    + 'same pair.',
  'mixer.sourceLook': 'The other way round: keep Deck A\u2019s figure and take Deck B\u2019s look. The figure rows '
    + 'are held at A and the crossfader then fades the look.',
  'mixer.allFollow': 'Hand every row back to the crossfader, keeping where the crossfader is. Use it to go '
    + 'from a mix you built row by row back to blending everything at once \u2014 without resetting the '
    + 'preview or Deck B.',
  'mixer.rowSource': 'Where this one group of settings comes from: Deck A, Deck B, or the master '
    + 'crossfader. Picking a deck pins the row; the double arrow hands it back to the master.',
  'mixer.sourceLine': 'What the rows add up to right now, in one sentence \u2014 the faders say it in numbers '
    + 'and this says it in words.',
  'mixer.categoryFader': 'This category’s own blend position. Untick “follow master” and this group of '
    + 'settings fades independently — Deck A’s colour at 0 under Deck B’s shape at 100, from one pair.',
  'mixer.followMaster': 'While ticked, this category sits wherever the master crossfader is. Untick it to '
    + 'give the category its own fader. Ticked for every category on load, so the Mixer behaves exactly as it '
    + 'always did until you choose otherwise.',
  'mixer.categoryLocks': 'Click a category to FREEZE it at its current blended value, so the crossfader '
    + 'leaves it alone. Locking mid-fade is how you keep one preset’s colour on another’s shape. A lock '
    + 'captures what the engine is showing RIGHT NOW, including any Visual FX edits made since the blend.',
  'mixer.sendToEvo': 'Hand the current blend to the Evolution tab as its breeding seed, so you can mutate a '
    + 'mix you like rather than starting from a library preset.',

  // ---- Randomise ----
  // ⚠️ **ALL THREE REWRITTEN 2026-10-06 (v8 `24.6`), AND THE DIFFERENCE BETWEEN THE TIERS IS NOW TWO
  // PROPERTIES, NOT ONE.** Until Phase 24 the tiers differed only in how far a nudge travelled, so "small /
  // substantial / large" told the whole story. They now also differ in whether a press may re-roll a
  // categorical identity at all (`INTENSITY[tier].categorical` in `randomize.ts`, 24.D5) — and that is the
  // more visible of the two, because a new palette or material changes the frame more than any amount of
  // nudging. A tooltip that still said only "how far" would leave the user unable to predict the one thing
  // they can now choose.
  // ⚠️ **THE PARTICLE MODE IS NAMED IN BOTH LISTS AND IT WAS NOT UNTIL 2026-10-06.** Before `24.5` the style
  // jump wrote `renderer.mode`, which `main.ts` ignores, so the tier copy was accidentally accurate: Subtle
  // could not change the mode because NOTHING could. Fixing that write made the strategy live, and the
  // tooltip is the user-facing half of withholding it at Subtle (`CATEGORICAL_STRATEGIES`).
  //
  // ⚠️ **AND THE EXCEPTION IS STATED RATHER THAN QUIETLY TRUE.** A warp layer's field pattern is a name, so
  // Subtle re-picking one is a categorical change by subject — it is left in the draw because it has always
  // been there and Phase 24 did not touch it. A promise with one unstated exception is read as a lie the
  // first time a user hits the exception; naming it costs a clause.
  'rnd.subtle': 'Small nudges to the preset’s own values — recognisably the same figure, freshly varied. The '
    + 'setting to use when the preset is nearly right. Subtle NEVER swaps an identity: the palette, the film '
    + 'look, the material, the particle mode, the warp style and the attractor are left exactly as they are, '
    + 'whatever the locks say — only Medium and Wild can change those. The one exception is a warp layer’s '
    + 'field pattern, which Subtle may still re-pick.',
  'rnd.medium': 'Substantial mutation: the figure keeps its family resemblance but changes character. About '
    + 'one press in four re-skins a single identity instead of nudging numbers — a new palette, film look, '
    + 'material, particle mode, warp style or attractor, one of them per press, never all at once.',
  // ⚠️ `Wild`'s warning is a statement about the SETTING, not about a defect: the hit rate is the intended
  // behaviour and saying so is what stops it being read as one.
  'rnd.wild': 'Large, structure-breaking mutation. Expect most results to be unusable and the occasional one '
    + 'to be worth keeping — that is the intended hit rate, not a fault. Nudges travel about eight times as '
    + 'far as Subtle’s and can reach the end of a control’s range in one press, and like Medium it can swap '
    + 'an identity outright. Snapshot anything you like before pressing again.',
  // ⚠️ **The masking caveat lives HERE and not in `LOCK_CATEGORY_TIPS['color']` — see that table's note.**
  // Precedence is palette > material ramp > preset colour, so on the 114 library presets that author a
  // palette the four colour curves are invisible: the jitter runs, the frame holds still, and that reads as
  // a broken control (invariant 13's harder half — the control moves the right thing and the output channel
  // cannot show it). Saying so is the remedy; damping the jitter would make the Randomiser disagree with the
  // Visual FX sliders, which move the same arrays under the same precedence.
  'rnd.masking': 'A palette overrides the colour curves wherever one is set, so a colour mutation on a '
    + 'palette preset may look as though only the palette moved — or as though nothing did. Clear the '
    + 'palette in Visual FX to see the curves themselves.',
  'rnd.restart': 'Return to the preset as it was when you entered this tab, discarding the whole mutation '
    + 'chain. Disabled when you are already there.',
  'rnd.back': 'Step one mutation back. The chain is kept for this tab only and is not the Snapshot history.',
  'rnd.forward': 'Step one mutation forward again. Randomising after stepping back discards everything ahead '
    + 'of the current position.',
  'rnd.sendToEvo': 'Hand the current mutation to the Evolution tab as its breeding seed.',

  // ---- Sliders ----
  // ---- v8 26.7 — the two header controls (26.D7, 26.D12) ----
  //
  // ⚠️ **`Bake` IS THE ONLY NON-IDEMPOTENT CONTROL IN THIS TAB AND THE TIP HAS TO SAY SO**, because every
  // other control here promises that centre restores the preset. Bake deliberately breaks that promise —
  // that is its purpose — so a user who does not know will lose the ability to get back.
  // v8 26.8 / 26.D1 — the one surviving piece of the removed Archetypes tab.
  //
  // ⚠️ **THE TIP HAS TO SAY "VIEW", NOT "EDIT", BECAUSE THE CONTROL IS A BYPASS** (invariant 25: the
  // description owns the gate). A user who reads this as an edit will expect it in an Export, and it is
  // deliberately absent from one — Export, Snapshot and the Mixer are byte-identical with the strip on.
  'sliders.strip': 'Show the bare curve: pixel points, no material, no warp, no attractor, no fields and '
    + 'the plain Legacy grade. ⚠️ It changes only what you SEE — the preset itself is untouched, so an '
    + 'Export or Snapshot taken now is identical either way. Speed is left alone so you can still slow the '
    + 'figure down while inspecting it.',
  'sliders.resetAll': 'Return all fourteen sliders to centre and the preset to how it was when you opened '
    + 'this tab. Exactly what clicking every ↺ would do.',
  'sliders.bake': 'Adopt the current result as the new starting point and re-centre all fourteen sliders, '
    + 'so you can shape it again from here. ⚠️ This is the one control that does NOT revert: once baked, '
    + 'centre means the baked result and the original is only in History.',
  'sliders.reset': 'Return this one slider to centre, i.e. to the preset’s own value. The other sliders keep '
    + 'their positions.',

  // ---- Evolution ----
  // ⚠️ **ALL FOUR OF THESE WERE REWRITTEN BY v8 PHASE 25 (2026-10-06) AND THREE OF THEM DESCRIBED A GENOME
  // THAT WAS A THIRD OF THE PRESET.** `evo.breed` promised "each a mix of the parents", which was true of the
  // figure and false of everything modern: crossover could bring exactly ONE of the 44 authored overlay keys
  // from the second parent, so for most pairs the child's look WAS parent A's, byte for byte. The copy was
  // not wrong about the intent — it was wrong about the reach, which is the kind of tooltip defect no checker
  // can see because the string is well-formed and the control exists.
  //
  // ⚠️ **`Generate` and `Breed` are now DIFFERENT operations rather than two strengths of one**, and saying
  // so is the single most useful thing this tab's copy can do: **`Breed` explores BETWEEN what you have,
  // `Generate` explores AWAY from it.** The tab shipped for months with two buttons that did nearly the same
  // thing, and a lineage still narrows — three parents share seven genes between them, so breeding converges
  // by construction and `Generate` is the only way out of that.
  'evo.generate': 'Replace all nine tiles with fresh mutations of the current preset — this explores AWAY '
    + 'from what you have, where Breed explores between your picks. It discards the generation on screen, so '
    + 'apply anything you want to keep first. Back brings it again.',
  'evo.breed': 'Cross the selected tiles into a new generation. Each child inherits all seven categories — '
    + 'the grade, palette, material, warp and the rest — WHOLE from one parent or the other, and averages '
    + 'the numbers inside them, so a child’s look can be traced to a parent by eye. Your picks come back '
    + 'in the first slots, varied one step more gently. Needs at least one tile selected.',
  'evo.apply': 'Load the selected tile into the main view as the working preset, so the other tabs can edit '
    + 'it. With several selected it takes the one in the lowest slot.',
  'evo.tile': 'A live animated mutation. Click to select it as a parent (up to three), click again to '
    + 'deselect. ★ marks a parent you picked, ◆ a tile carried over from the last generation — a tile '
    + 'can be both.',
  'evo.back': 'Bring back the previous generation and the parents you had selected in it. One step only: '
    + 'there is no Forward, and a second press does nothing until you breed or generate again.',
  // ⚠️ **THE STRENGTH SELECTOR DRIVES BOTH BUTTONS (25.D10), AND THE TIER MEANS THREE THINGS AT ONCE
  // (25.D6, 25.D8, 25.D11)** — how far numbers move, how loyal inheritance is, and how often a child is
  // mutated at all. The tips below say all three for Subtle because that is the tier whose name makes a
  // promise a user can check; Medium and Wild only need the first.
  'evo.strength': 'How far Generate and Breed stray from what they start with. It drives both buttons, and '
    + 'the parents carried into the first slots are always varied one step more gently than the children '
    + 'beside them.',
  'evo.subtle': 'Small nudges, and a loyal inheritance: a child takes about five genes in six from its '
    + 'dominant parent, and nothing categorical is re-rolled — no new palette, film look, material, '
    + 'particle mode, warp style or attractor. Carried parents are varied almost imperceptibly.',
  'evo.medium': 'Substantial mutation at even odds between the parents, and three children in five are '
    + 'mutated after crossover. A child can arrive with a new palette, material or particle mode.',
  'evo.wild': 'Large, structure-breaking mutation, and nearly every child is mutated after crossover. '
    + 'Expect tiles that look broken — a few of nine being unusable is the intended hit rate, not a fault.',
  'evo.locks': 'Click a category to keep it exactly as your FIRST pick has it. Here a lock does both jobs: '
    + 'the category is neither mutated nor inherited from any other parent. These chips are the same ones as '
    + 'on the Mixer and Randomise tabs, so locking one here lights it there too.',
  'evo.counter': 'How many parents you have picked, out of three. At three, the remaining tiles dim and '
    + 'further clicks are ignored — click a picked tile to free a slot.',

  // ---- History ----
  'history.clear': 'Delete every snapshot. It does not touch the library or the preset you are working on.',
  'history.tile': 'A snapshot, still animating. Click to make it the working preset again — including the '
    + 'Visual FX state it was saved with.',

  // ---- Composer (v8 Phase 16) ----
  //
  // ⚠️ **THE PRECONDITIONS ARE NOT HERE, AND THAT SPLIT IS INVARIANT 25 RATHER THAN AN OVERSIGHT.** A tooltip
  // is only ever discovered by someone who already suspects the control it is on, so it can carry the
  // DESCRIPTION of a control but never the condition under which the whole tab does nothing. The Region D
  // warning (attractor blend at 1.0 replaces these positions outright) and the diagram’s own
  // `no rotation or grading` label are therefore INLINE copy in `composer.ts`. One entry below deliberately
  // repeats a narrower precondition that IS specific to its own control — `extent` being the answer to the
  // diagram’s auto-fit — because that belongs to one control.
  //
  // ⚠️ **THERE WERE TWO SUCH ENTRIES UNTIL 2026-09-10: `sweepRate` carried *"changing it restarts the figure from
  // its opening pose"*, and it went with the control.** A comment counting a list is the shape that goes stale;
  // it is written as a count here anyway because the SPLIT is the point and the reader has to be able to check it.
  'composer.slot': 'One of the three sine waves that are summed to make the figure. Body carries the shape, '
    + 'Structure and Detail add the fringe — a preset can use one, two or all three.',
  // ⚠️ **THE `Repair` CLAUSE IS GONE (v8 16.15 / E106) BECAUSE THE BUTTON IS, AND A TOOLTIP NAMING A CONTROL
  // THAT DOES NOT EXIST IS WORSE THAN A MISSING SENTENCE — invariant 25 inside out: the explanation becomes the
  // wrong thing.** Nothing rounds a winding now, so the honest sentence is that a typed value is kept: the
  // readout is the whole feedback a fraction gets, and there is no action that snaps it.
  'composer.winding': 'How many times this axis wraps before the curve closes, per figure. A whole number '
    + 'closes it; a fraction leaves a visible seam and the readout says so — a fraction is a real shape, not an '
    + 'error, so nothing rounds it away. Typed values are stored exactly as typed; the arrows step by one '
    + 'because ±1 is the move that keeps a figure closed.',
  'composer.size': 'How far this axis reaches, in model units before the canvas fit. Zero on all three axes '
    + 'is what makes a wave silent.',
  'composer.phase': 'Where along the sine this axis starts, in degrees. ⚠️ It is multiplied by the winding '
    + 'number, so the shift you get is degrees × winding — the readout under the row states the real one, and '
    + 'the dial beside it is set in those real degrees.',
  // ⚠️ **`composer.twist` IS DELETED (16.15) WITH THE SIMPLE ROW IT DESCRIBED.** Its sentence is preserved as
  // the reason §3.1b's twist-only design was rejected: an offset alone cannot express an absolute X shift,
  // which most library waves author. The `Shift °` row now shows all three axes' stored degrees directly.
  // ⚠️ **ONE WORD PER QUANTITY (v8 16.12 / E103): "PULSE" IS THE SIZE MOVING AND "WOBBLE" IS THE WINDING
  // MOVING, AND THE WORD "BREATHES" IS GONE FROM ALL NINE OF THESE ENTRIES.** The tab shipped with two names for
  // each — a `Pulse` row and a `Size breathes` row, a `Wobble` row and a `Winding breathes` row — which are the
  // same stored field in two units, and the owner read them as four independent quantities: *"I am confused
  // about wobble versus winding breathes, isn’t that the same?"* It is. **Do not reintroduce a second name for
  // either;** where the distinction being drawn is the UNIT, say "in percent" or "in seconds".
  'composer.pulse': 'How much the size pulses — this much is added to and subtracted from Size over time. Zero '
    + 'leaves the figure a fixed shape.',
  'composer.pulseRate': 'How fast the size pulses. At a pulse of zero the rate does nothing, whatever it '
    + 'is set to.',
  'composer.wobble': 'How much the winding wobbles — this much is added to and subtracted from Winding over '
    + 'time, so the curve continuously re-wraps. A wave can wind entirely this way with Winding at zero.',
  'composer.wobbleRate': 'How fast the winding wobbles. At a wobble of zero the rate does nothing, whatever '
    + 'it is set to.',
  // ⚠️ **`composer.tier` IS DELETED (16.15): every wave now shows all twenty-one controls, so there is nothing
  // to switch and nothing to refuse.** Its refusal sentence held a rule worth carrying elsewhere — *a control
  // must say BEFORE the click that it can decline* — which was implemented by appending the model's own
  // `tierReasons` to this tooltip at runtime. That is how a user-facing string came to live in `composer-model.ts`
  // and pass §N's copy scan; see that file's own note.
  // ⚠️ **THE "IMMEDIATE, NO UNDO" SENTENCE IS PART OF THE CONTROL AND NOT A CAVEAT (v8 16.16 / E107).** The owner
  // chose one click over a confirmation dialog, so the only place that fact can be stated is BEFORE the click —
  // and a destructive control that does not say it is destructive is the failure invariant 25 is about, arriving
  // through an omission rather than through a wrong sentence. ⚠️ **The winding clause is here for the same reason
  // it is in `composer.dial`: clearing a winding DISABLES a different control**, which is not something a user can
  // predict from the word `Clear`.
  'composer.clear': 'Set this row to zero on all three axes at once. It happens immediately, with no '
    + 'confirmation and no undo — the same as typing three zeros. ⚠️ Clearing Winding also disables the Shift '
    + 'dial for those axes, because no phase can shift an axis that does not wind; clearing Size or Pulse to '
    + 'nothing on every axis makes the whole wave silent.',
  /*
   * ⚠️ **THIS TOOLTIP ENUMERATES THE READOUT'S FACTS, SO EVERY FACT ADDED TO THE READOUT MUST BE ADDED HERE — and
   * v8 16.20 (E111) added one that a stale list would have left unexplained.** The two period phrasings differ on
   * purpose and the difference is the whole point: *repeats every N s* is a claim about the figure returning, and
   * 225 of the library's 761 modulated rows carry rates that are not multiples of their slowest, so on those the
   * only true statement is about the slowest cycle. **Do not collapse the two into one sentence** — that is the
   * confidently-wrong readout this phase produced three times.
   */
  'composer.readout': 'What the engine makes of this wave: whether it closes, its winding as a multiple of '
    + 'the Body wave, the phase shift actually applied where that differs from the number you typed, which axes '
    + 'have no size to show their winding, and how long its slowest breathing takes. It reads “repeats every N s” '
    + 'only when every modulator on the wave lines up with that cycle; otherwise it names the slowest cycle alone, '
    + 'because the wave itself comes back round much later. Nothing here is stored — it all describes the numbers '
    + 'above it.',
  /*
   * ⚠️ **THE PANE CAPTION DELIBERATELY MAKES THE WEAKER CLAIM AND THIS TOOLTIP IS WHERE THE CAUSE IS ALLOWED TO
   * LIVE.** The caption on the canvas says only that the projection is empty; naming a cause there would be wrong
   * on a reachable case (two axes with real size and zero winding draw nothing — `sin(n·0)·am` is 0), and it is
   * the row readout, which reads the model, that is entitled to name a silent axis. **Do not move this
   * explanation onto the canvas.**
   */
  'composer.paneFlat': 'This projection has nothing to draw: neither of its two axes reaches anywhere, so there '
    + 'is no curve, only the crosshair. That is usually correct — most figures in the library are flat in at '
    + 'least one plane — and it is left alone rather than fixed, because giving an axis a size to fill the pane '
    + 'would change the figure into a different one.',
  'composer.silent': 'This wave has no size on any axis, so it contributes nothing to the figure — which is '
    + 'a valid state, not a fault. Winding at zero does NOT make a wave silent. Tick the box beside its name to '
    + 'give it a starting size and start editing.',
  /*
   * ⚠️ **`composer.giveSize` IS RETIRED (v8 16.17 / E108) WITH THE BUTTON IT DESCRIBED, and `composer.silent` now
   * carries the sentence that told the user what to do next.** Recorded rather than deleted silently because
   * `tipcheck` asserts BOTH directions — a key with no reader fails as loudly as a reader with no key — so a
   * future reader seeing this block shrink must not read it as copy lost. **A tooltip naming a control that does
   * not exist is worse than a missing sentence** (the `Repair` clause above, same shape).
   *
   * ⚠️ **THE TWO KEYS BELOW ARE A PAIR AND MUST STAY DISTINGUISHABLE IN ONE READING, because they sit next to
   * each other on the same row and one of them is irreversible.** `level` is reversible and about the FIGURE;
   * `levelClear` destroys twenty-one numbers. Neither may describe itself in words that would also fit the other.
   */
  'composer.level': 'Whether this wave counts. Switch it off to see the figure without it — its numbers stay '
    + 'in the boxes and come back when you switch it on, but the wave is written out empty in the meantime, so '
    + 'Export and Snapshot save it cleared and it is gone once the figure is replaced. On an empty wave, '
    + 'switching on gives it a starting size and a winding so there is something to edit.',
  'composer.levelClear': 'Set every number on this whole wave — all seven values on all three axes — to zero. '
    + 'It happens immediately, with no confirmation and no undo, and unlike switching the wave off it does not '
    + 'keep a copy of what was there.',
  // ⚠️ **`quarter-turn twist` BECAME `Y offset of a quarter turn` (v8 16.12 / E103): `twist` SURVIVES ONLY AS AN
  // INTERNAL NAME, never as a user-facing word.** The old wording named a field no row is labelled with —
  // `composercheck` §N asserts the absence over string LITERALS, which is why `SEED_TWIST` (an identifier, and
  // since 16.15 the last `twist` left in `src/`) is not a violation. **A copy scan that cannot tell an identifier
  // from a label has to be exempted into uselessness; keep label text a literal at its own site.**
  'composer.newFigure': 'Replace the wave table with a plain circle — one wave, winding 1:1:1, a Y offset of a '
    + 'quarter turn — and reset particle count and sweep rate to the library’s most common values. It leaves the '
    + 'render mode, material and film look alone.',
  'composer.stack': 'Set the Structure and Detail windings as whole multiples of the Body wave’s, which is '
    + 'where the library’s variety actually lives. Multiples apply to the Body value, never to the current '
    + 'one, so re-applying the same stack changes nothing.',
  // ⚠️ **`composer.repair` IS DELETED (16.15) WITH ITS BUTTON, AND WHAT IT WAS FOR IS NOT SOLVED — the
  // Randomiser can still leave a figure that never closes.** The remedy, if wanted, belongs in `randomize.ts`;
  // see `composer-model.ts`'s note where `repairFigure` used to be.
  // ⚠️ **ONE ENTRY WHERE THERE WERE TWO (v8 16.11 / E102): `composer.tuner` AND `composer.gallery` DESCRIBED TWO
  // CONTROLS THAT WROTE THE SAME THREE NUMBERS THROUGH THE SAME `applyRatio`, WHICH IS WHAT THE OWNER REPORTED.**
  // Their two load-bearing paragraphs are merged below rather than dropped with them.
  //
  // ⚠️ **"smallest winding" WAS WRONG AND IT DESCRIBED A REAL DEFECT RATHER THAN MERELY MIS-WORDING A CORRECT
  // ONE.** The base is the greatest common divisor of the nonzero windings, not their minimum: with the minimum,
  // `3 : 2 : 5` over a `7:7:7` slot gives `21:14:35` and then `42:28:70`, because `min(21,14,35)` is 14 rather
  // than 7. The tooltip said "smallest" because the code did — and the sentence about re-applying being safe was
  // therefore false for eleven of the sixteen ratios. **The gcd is what makes the promise true.**
  //
  // ⚠️ **AND IT NO LONGER SAYS "in the plane the diagram above is showing" — that clause described the RETIRED
  // plane chip and would now be simply false**: every row draws all three planes. A tooltip naming a control
  // that no longer exists is invariant 25 inside out — the explanation is the thing that is wrong.
  'composer.ratio': 'Pick this wave’s X : Y : Z winding relationship by its shape rather than by three numbers. '
    + 'Each row shows the real curve for that ratio in all three planes, and picking one scales this wave’s '
    + 'windings to it while keeping the largest whole number that divides them all as the base — so re-picking '
    + 'the same ratio changes nothing. Distinct from Stack, which sets the ratio BETWEEN the three waves. Ratios '
    + 'the list does not offer are still reachable from the Winding row below.',
  'composer.dial': 'The phase shift the engine actually applies, in degrees — drag it, or click a quarter-turn '
    + 'mark. ⚠️ It is not the number in the Phase row: the engine multiplies that by the winding, so the dial '
    + 'divides back out to find the value to store. At a winding of zero no phase can shift anything, so it is '
    + 'disabled and says so.',
  'composer.breathePulseDepth': 'How far the size pulses, as a percentage of Size. It is the Pulse row in '
    + 'plain units — over 100 % is allowed and means the axis passes through zero and inverts, which some '
    + 'library presets do on purpose. Where Size is zero there is no percentage to take, so it shows the '
    + 'absolute amount instead and says so.',
  // ⚠️ **THE `Changing Sweep rate re-times every one of these` CLAUSE IS DELETED WITH THAT CONTROL (2026-09-10) —
  // AND A USER-FACING STRING NAMING A DELETED CONTROL IS THE WORST KIND OF STALE COPY**, because it sends the
  // reader looking for a row that is not there (invariant 25 inside out: the explanation becomes the wrong thing).
  // **What replaced it is TRUE OF THE SAME NUMBER and is the thing a user can still act on:** the figure's stored
  // sweep rate is what these seconds are quoted at, and the Speed slider scales the wall clock over it.
  'composer.breathePulseSeconds': 'How long one full pulse of the size takes, in seconds at this figure’s stored '
    + 'sweep rate. ⚠️ Speed at the top scales the wall clock over it, so at 0.5× it really takes twice as long. It '
    + 'stays editable when the depth is zero, because setting the timing before the amount is a reasonable order '
    + 'to work in.',
  'composer.breatheWobbleDepth': 'How far the winding wobbles, as a percentage of Winding — the Wobble row in '
    + 'plain units. Where Winding is zero it shows the absolute amount instead, which is the case for a wave '
    + 'that winds entirely by wobbling.',
  'composer.breatheWobbleSeconds': 'How long one full wobble of the winding takes, in seconds at this figure’s '
    + 'stored sweep rate. ⚠️ Speed at the top scales the wall clock over it.',
  // ⚠️ **THE "faint second outline" SENTENCE DESCRIBED THE RETIRED GHOST AND HAD TO GO WITH IT (16.10):** one
  // faint curve answered "does anything move" for TWO independent quantities, so a pulsing wave and a wobbling
  // one drew the same picture. The two named curves are described by the legend, which is on screen rather than
  // behind a hover — a tooltip cannot be the only owner of a colour key.
  'composer.score': 'The bare curve in model space, drawn as a diagram, in all three planes at once. ⚠️ It '
    + 'deliberately has no rotation, no canvas fit, no material and no grading — the live view beside the Lab '
    + 'already shows those.',
  'composer.legend': 'What the three colours on every diagram mean. White is the figure right now; cyan is how '
    + 'far it reaches at the extreme of its Pulse; amber is the shape at the extreme of its Wobble. A colour you '
    + 'cannot see means that wave does not pulse or does not wobble — the two curves sit exactly on the white one.',
  'composer.extent': 'How far the figure reaches in model units. ⚠️ The diagram auto-fits its box, so '
    + 'doubling every Size changes the picture here not at all — this number is the only place that shows it.',
  /*
   * ⚠️ **`composer.figureWide` AND `composer.sweepRate` WERE HERE AND BOTH WENT WITH THE `Figure-wide` SECTION
   * (2026-09-10, owner: *"I do not understand what sweep factor is at all, why do we have it on the page?"* then
   * *"just use the default value and don't provide a control for it, having a speed factor control is
   * sufficient"*).** `waveSpeed` survives as a stored field the Composer preserves and never offers.
   *
   * ⚠️ **DELETING BOTH KEYS WAS COMPULSORY, NOT TIDY — `tipcheck` §H resolves `TAB_TIPS` in BOTH DIRECTIONS**, so
   * an entry no tab reads fails `verify` naming it dead. That is the one direction of this table that cannot go
   * stale silently, and it is the reason a control removal here is a two-file edit by construction.
   *
   * ⚠️ **THE HEADER'S OWN HISTORY IS WORTH KEEPING: `Figure-wide` WAS THE TAB'S ONE UNTIPPED HEADER FROM E92 UNTIL
   * 2026-09-10** — found by enumerating the `sl-section-title` sites, not by any checker, because `tipcheck` §C/§D
   * scan `sectionTitle()` literals **in `visual-fx.ts` only** and this tab is hand-wired. **A Composer header is
   * checked by §H alone, and §H can only see a header that already reads the table** — so the next hand-wired
   * section to ship untipped will be just as invisible.
   */
  /*
   * ---- v8 16.19 (E110), rebuilt 2026-09-10 — the whole `Framing & Timing` repeat ----
   *
   * ⚠️ **THE TAB HAD TWO SPEED-ISH CONTROLS AND EACH TOOLTIP NAMED THE OTHER; NOW THERE IS ONE, AND THAT IS WHY
   * THE PAIR IS GONE RATHER THAN HALF-MAINTAINED.** The cross-reference had already been FORCED into an amendment
   * once — `sweepRate` said the Speed slider *"is not saved"*, which stopped being true the moment the owner made
   * these controls persist — which is the argument for the deletion rather than against it: a cross-reference goes
   * stale silently, in the direction that reads as documentation. **`composer.speed` must not name a control that
   * no longer exists, and must not be re-paired if a `waveSpeed` surface ever returns elsewhere.**
   *
   * ⚠️ **THESE TEXTS ARE A SECOND COPY OF WHAT `CONTROL_TIPS` SAYS ABOUT THE SAME CONTROLS, AND THE DUPLICATION
   * IS DELIBERATE AND PRE-EXISTING** — E110 shipped it for `composer.speed` alone and it now covers the section.
   * **The count is not stated here on purpose: it moved twice in one day** (one → seven with the widening, seven
   * → six when the owner removed `Symmetry`), and a figure in a comment above a list is the shape that goes
   * stale. Count the entries. The two tables cannot share a literal: `tipcheck` §G PARSES `TAB_TIPS`'s values and reports any
   * entry it cannot (`entr(ies) escape the length checks`), so an entry composed as `CONTROL_TIPS['x'] + '…'`
   * would leave the ceiling silently not applying. **The cost is that the pair must be amended together**, which
   * is why it is written here rather than left to be noticed.
   *
   * ⚠️ **WHAT IS NOT DUPLICATED IS THE CROSS-TAB STALENESS, STATED ONCE IN `composer.framing`.** No setter behind
   * these controls calls `notifyExternalChange()` — measured, and deliberately so, since a notify per drag frame
   * is a full resync of every subscriber inside the drag loop — so a Visual FX drag does not move the handle
   * here. Repeating that in every one of these tooltips would be the enumeration shape again; the header is the one
   * hover every reader of the section passes.
   */
  /*
   * v8 `31.C` — the ONE collapsible head over `Framing & Timing` and `Preview only` (owner, 2026-10-25).
   *
   * ⚠️ **IT MUST NOT MAKE A PERSISTENCE CLAIM, because the group straddles the one line this tab draws:**
   * the framing controls ARE saved with the preset and the two bypasses are NOT. The two inner section titles
   * each state their own half and both survived the merge - so this one says where you are and hands the
   * question down, rather than averaging two opposite answers into a third wrong one.
   */
  'composer.setup': 'Two sections, collapsed because neither composes the figure: the framing and timing '
    + 'controls repeated from Visual FX, and the two switches that change only how the preview is drawn. '
    + '⚠️ Each says for itself whether it is saved with the preset — they differ.',
  'composer.framing': 'The same size, speed, count and rotation controls as the Visual FX tab, on exactly the '
    + 'same values — a change here is a change there, and both are saved with the preset. ⚠️ The link is one-way '
    + 'while both tabs are built: dragging one of these on Visual FX will not move the handle here until '
    + 'something else reloads this tab.',
  'composer.figureScale': 'Multiplies the automatic canvas fit, 0.2×–5.0×. The fit keeps the preset’s authored '
    + 'aspect ratio and so letterboxes on a wide canvas — raise this to fill the screen, or go past 1× to frame '
    + 'part of a large figure. It moves the framing only: the diagrams below auto-fit and will not change.',
  'composer.speed': 'Master time multiplier: scales wave motion AND every rotation rate together, so the figure '
    + 'keeps its shape and only its tempo changes. At 0 it freezes in its current pose, which is the way to study '
    + 'a still frame. ⚠️ The seconds on the Pulse and Wobble rows are quoted at the figure’s own stored rate, and '
    + 'this multiplies them — at 0.5× every one of those labels really takes twice as long.',
  'composer.particleCount': 'How many particles trace the curve, 100–200 000. More particles fill it into a '
    + 'continuous surface; fewer leave it as discrete points and cost less per frame. A folded figure divides the '
    + 'same particles between its arms, so raise this after raising the fold on the Visual FX tab.',
  'composer.rotation': 'Full turns per minute about each axis, ±10 — left of centre is clockwise, right '
    + 'counter-clockwise, centre none. X and Y tumble the figure toward and across the camera, Z spins it in the '
    + 'picture plane. ⚠️ The numbers are NOMINAL: Speed above multiplies the actual rate, so at 0.5× a 2 rpm spin '
    + 'takes two minutes. The diagrams below never rotate at all.',
  /*
   * ⚠️ **`composer.symmetryFold` WAS HERE AND WAS DELETED WITH ITS CONTROL (2026-09-10, owner: *"remove the
   * Symmetry control, this one is not needed on the Composer tab"*) — AND DELETING IT WAS COMPULSORY, NOT TIDY.**
   * `tipcheck` §H resolves `TAB_TIPS` in BOTH directions, so an entry no tab reads fails `verify` naming it a
   * dead entry. That is the one direction of this table that cannot go stale silently; the fold's own text still
   * lives in `CONTROL_TIPS` for Visual FX's row, which is now the only surface that has one.
   *
   * ⚠️ **`composer.symmetryMirror` STAYS, because `Mirror` stays** — and its last sentence is the load-bearing
   * one now: the row is hidden at fold 1 and this tab no longer has a way to raise the fold, so a reader who
   * cannot find the checkbox needs to be told where the condition lives.
   */
  'composer.symmetryMirror': 'Reflects each sector into its neighbour so the seam matches. Recommended: the '
    + 'un-mirrored form jumps at the sector edge, which visibly breaks trails in Ribbon and Neon modes. '
    + 'Meaningless at fold 1, where this row is hidden rather than greyed — set the fold on the Visual FX tab.',
  /*
   * ---- v8 16.18 (E109) — the two preview bypass switches, and the section that is left holding them ----
   *
   * ⚠️ **EACH ONE SAYS WHAT IT KEEPS, NOT ONLY WHAT IT DROPS**, because the scope is the owner's decision and is
   * not guessable from the label: FX-off keeps Film Look and the whole Framing & Timing group, and
   * Materials-off forces Star rather than letting the mode resolver decide. A tooltip that only said *"turns the
   * effects off"* would leave a user reading a preserved grade as a bug.
   *
   * ⚠️ **AND EACH SAYS THAT NOTHING IS SAVED EITHER WAY**, which is the fact that separates these two boxes from
   * every other checkbox on the tab — the three level switches persist and export the level cleared, and `Mirror`
   * in the section directly above persists too. **`composer.view` can no longer be the only place that says it:**
   * until 2026-09-10 the framing controls sat under that same heading and were preview-only with it, and the
   * heading's claim now covers these two switches alone.
   *
   * ⚠️ **THE POLARITY IS `Apply …`, TICKED BY DEFAULT (the owner's flip), SO EACH TEXT OPENS BY SAYING WHICH
   * STATE IS NORMAL.** The engine flag is still a BYPASS and keeps its name; the negation lives at the DOM
   * boundary, so the tooltip is the only place a reader can find out which way round the box is.
   *
   * ⚠️ **`composer.view` NAMES *TWO* WAYS BACK ON SINCE 2026-09-10, AND THE SECOND ONE IS THE ONE A USER MEETS
   * FIRST** (owner's ruling: a genuine preset switch re-ticks both boxes — `main.ts`'s `applyPresetChange` tail).
   * The tip has to name it because the reset is otherwise indistinguishable from the user having mis-clicked:
   * both boxes come back ticked with no interaction. ⚠️ **It says *a DIFFERENT preset* rather than *a preset*
   * ON PURPOSE — the reset is gated on `isSamePreset`, so a Sliders/Randomiser/Mixer move, which re-applies the
   * working preset and is far more frequent, does NOT reset them.** A tip reading *"loading a preset"* would be
   * wrong about the common case and would look like a defect the moment a slider drag left the boxes alone.
   */
  'composer.view': 'The two switches below change only how the running preview is drawn — never the figure, and '
    + 'never the look that gets saved. Nothing here is exported, stored in a snapshot or blended by the Mixer, '
    + 'and both switch back on when you close the Lab or load a different preset.',
  'composer.bypassFx': 'On is the normal state. Switch it off to draw the preview without any of the Visual FX — '
    + 'no ribbon, lines, attractor, warp, network, fluid or crystals — keeping the film look and the framing '
    + 'controls above. ⚠️ Nothing is saved either way: the full look is still what gets exported.',
  'composer.bypassMaterials': 'On is the normal state. Switch it off to draw the preview without the material, '
    + 'as plain stars, to see the figure the material is sitting on. ⚠️ Nothing is saved either way, and a preset '
    + 'whose look depends on the liquid surface will look very different while this is off.',

  /* ── The figure type and the self-similar curve (v8 36.11) ────────────────────────────────────────────
   *
   * ⚠⚠ **FOUR OF THESE NINE CARRY SOMETHING NOTHING ELSE IN THE PRODUCT SAYS, and `36.18` names them:**
   * `rule` (that it chooses the figure's IDENTITY while the angles animate it — the model's whole idea, and
   * not guessable from the controls), `yaw` (that the published angle is a LANDMARK rather than a limit, and
   * that other angles give other named fractals — without this an author treats the default as the only
   * correct value), `descend` (that it is NOT `Figure Scale`), and `figureType` (that switching is
   * non-destructive). The other five are ordinary.
   */
  'composer.figureType': 'Which kind of figure this preset draws. Switching keeps the other kind\'s '
    + 'settings rather than clearing them, so you can switch back and forth freely \u2014 and a preset can '
    + 'carry a tuned version of both.',
  'composer.curve': 'A self-similar curve: one continuous stroke that fills space or branches, built by '
    + 'repeating a small rule. The rule picks WHICH fractal; the angles below animate it.',
  'composer.rule': 'The production rule, which is the figure\'s identity \u2014 Hilbert, dragon, Koch, '
    + 'Gosper, a plant. \u26a0 The angles below are NOT part of the rule: run one rule at another angle and '
    + 'you get a valid, different, still self-similar curve. That is what makes this one dial a family.',
  'composer.recursion': 'How many times the rule is applied. Fractional values blend two levels, so the '
    + 'curve subdivides smoothly instead of jumping \u2014 new detail appears BETWEEN existing strokes '
    + 'rather than the whole figure scaling. The range is the rule\'s own.',
  'composer.yaw': 'The turtle\'s left/right turn, in degrees. \u26a0 The rule\'s published angle is a '
    + 'LANDMARK, not a limit \u2014 it is where this production is the NAMED fractal, and other angles give '
    + 'other named fractals. Sweeping it is the point. Under Customize it is the UNIT every Turn in the '
    + 'generator table counts in, so it bends all of them together. \u26a0 This is not the figure\'s '
    + 'orientation; that is Rotation, in Visual FX.',
  'composer.twist': 'Rotates chosen copies of the curve about their own axis, in degrees, at every level at '
    + 'once — so the flat curve opens into 3-D. On Dragon, 180° IS the Lévy C curve (and on Lévy C, '
    + 'the dragon): one slider folds one named fractal into the other. On Plant it turns the branches about '
    + 'the trunk. On Hilbert 2D and Peano the square lattice opens out — there Twist works at the lattice '
    + 'angle only, so Yaw is held at 90° while Twist is in use. Only shown where the rule has copies to twist.',
  'composer.stretch': 'Grows or shrinks the branches, at every level at once, while the trunk keeps its '
    + 'length. 1× is the rule as published. Only shown for a rule with branches (Plant).',
  // ---- v8 Phase 39 Stage C — the Customize rule and the generator editor ----
  'composer.customize': 'Customize: edit the generator — the few straight steps the rule repeats inside every '
    + 'step, level after level, which is all a rule is. It starts from the rule you were on and changes nothing '
    + 'until you edit a step. ⚠ Choosing a named rule again replaces your edits, with no confirmation.',
  'composer.customizeUnavailable': 'Bush 3D cannot be customized: it is a GROWTH rule — each level adds branches at '
    + 'the tips and lengthens the stems — not a shape repeated inside itself, so it has no generator to edit. A '
    + 'plant-growth editor is planned as a future phase. Pick another rule first.',
  'composer.customizeNote': 'The steps the rule repeats. Read them as a walk: each row turns, then walks one '
    + 'segment; recursion then replaces every segment with a smaller copy of the whole walk. While the table is '
    + 'still exactly a named rule\'s, the figure IS that rule; the first edit makes it your own curve, and '
    + 'undoing the edit makes it the named rule again.',
  'composer.genDraw': 'Path draws through the joints between pieces; Cells draws through the centre of each '
    + 'piece\'s square. Cells is offered only when the generator fills space — every piece one cell from the '
    + 'next and none twice — and it is what grants Descend.',
  'composer.genKind': 'Move walks a new segment. Retrace walks back along the most recent move not yet retraced '
    + '— how a branch is drawn as one stroke, out and back. A retrace copies everything from its move, so its '
    + 'own cells are greyed out.',
  'composer.genTurn': 'How far this step turns before it walks, in units of Yaw and relative to the previous '
    + 'step: 0 is straight on, +1 one Yaw angle left, −2 two to the right. Step 1\'s turn only rotates the '
    + 'whole figure, so the shape lives in the turns from step 2 on. Terdragon is 0, +1, −1 at Yaw 120°: a '
    + 'zig-zag whose repeats fill a triangular grid. Because every turn is a multiple of Yaw, the Yaw slider bends '
    + 'the whole generator together.',
  'composer.genLift': 'How far this step tilts up or down out of the plane before it walks, in units of Pitch '
    + 'and relative to the previous step. 0 keeps the generator flat.',
  'composer.genLength': 'This step\'s length, relative to the others. Unequal lengths are fine: the curve is '
    + 'spaced along its length either way.',
  'composer.genReverse': 'Walk this piece backwards: the smaller copy laid along it runs end to start, so its own '
    + 'pattern comes out in the opposite order. The segment itself does not move.',
  'composer.genOrient': 'Not a turn — the walk is unchanged. It rotates the smaller copy laid along this piece '
    + 'about the piece\'s own direction: 180° mirrors the copy to the other side, 90° and 270° stand it '
    + 'out of the plane. 0° on every step of most rules.',
  'composer.genTwistable': 'Let Twist act on this piece. Twist then rotates every marked piece about its own '
    + 'direction by the same angle.',
  'composer.genStretchable': 'Let Stretch act on this step: Stretch then lengthens or shortens every marked '
    + 'step by the same factor, at every level at once.',
  'composer.genMoveUp': 'Move this step one place earlier.',
  'composer.genMoveDown': 'Move this step one place later.',
  'composer.genDelete': 'Remove this step. A retrace that depended on it is removed with it.',
  'composer.genAddMove': 'Add a straight step at the end.',
  'composer.genAddRetrace': 'Add a step back along the most recent move not yet retraced. Needs an open move.',
  'composer.genStart': 'Lay the copies along a STARTING SHAPE instead of one straight segment. It may close into a '
    + 'loop: Moore is Hilbert 2D\'s generator laid along four steps up the square\'s centre line and back '
    + 'down. Ticking it adds one straight step, which changes nothing until you edit it.',
  'composer.genStartAdd': 'Add a straight step to the starting shape.',
  'composer.genStartDelete': 'Remove this step from the starting shape (it keeps at least one).',
  'composer.genShowLift': 'Show the Lift column, to tilt steps out of the plane and make the generator 3-D.',
  'composer.genStatus': 'Whether the generator can be drawn. A failure keeps the figure on its last valid shape '
    + 'until it is fixed.',
  'composer.genDensity': 'How evenly the curve covers space, which is how evenly it is lit: about 1 is even, '
    + 'and a high value means pieces pile on top of each other and glow brighter there.',
  'composer.pitch': 'The turtle\'s up/down turn, in degrees. Only shown for a rule whose production '
    + 'actually contains pitch symbols \u2014 most are flat and use yaw alone.',
  'composer.roll': 'The turtle\'s spin about its own heading, in degrees. Only shown for a rule whose '
    + 'production actually contains roll symbols.',
  'composer.descend': 'Travels INTO the curve, revealing finer structure as you go. \u26a0 It is not '
    + 'Figure Scale and not a zoom of the picture: the figure does not get bigger, it gets DEEPER, because '
    + 'the recursion and the slice of the curve on screen move together. Only available on rules whose '
    + 'structure can be indexed backwards.',
  'composer.smoothness': 'Rounds the curve\'s corners toward a spline. At 0 the curve is left exactly as '
    + 'the rule draws it; raising it relaxes the hard turns, which also makes deeper recursions readable '
    + 'instead of solid.',
  'composer.curveDepth': 'How far this value wobbles \u2014 it is added to and subtracted from the value '
    + 'above over time. Zero holds it still.',
  'composer.curveRate': 'How fast the value above wobbles. Zero holds it still, whatever the depth.',

  /* ── The Transmap tab (v8 21.12) ──────────────────────────────────────────────────────────────────────
   *
   * ⚠️ **THE WORKING PHRASE "field editor" IS RETIRED AND MAY NOT RETURN HERE** (owner, 2026-09-21). The tab
   * is `Transmap`, and these tips say "warp", "field" or "terms" for what it edits.
   *
   * ⚠️ **Several of these describe a control that is DISABLED in one of the two regimes, and each says so in
   * its own text rather than leaving the greying unexplained.** `transmap.detail`, `transmap.zoomPattern` and
   * `transmap.zoomBias` are inert on one side of the Pattern / (Preset) split. A disabled control whose tooltip
   * describes only what it would do is how a user concludes the engine is broken: the reason has to travel with
   * the description.
   *
   * ⚠️ **`transmap.term`, `transmap.amplitude` and `transmap.frequency` ARE NO LONGER IN THAT LIST, and putting
   * one back is a regression** (owner, 2026-09-23: *"the table is set according to the config that corresponds to
   * the selected value but the table remains editable"*). The rows are live in both regimes now, and the only
   * copy about a take-over that is not bit-tight is `ZOOM_BIAS_UNCARRIED`, inline above the rows where it is read
   * before the keystroke rather than hidden in a hover.
   *
   * ⚠️ **There is no `transmap.active`** — the tab has no `Active` checkbox (same owner message), and `tipcheck`
   * asserts TAB_TIPS coverage in BOTH directions, so a tip left here for a deleted control fails the build.
   *
   * ⚠️ **What is NOT here is every measured figure** — the peak, the identified pattern, the Strength a match
   * would need and the exaggeration the picture is drawn at are all generated in `field-measure.ts` and
   * `field-frame-canvas.ts`, because each is a MEASUREMENT of the live field and no fixed string can state it.
   * These tips explain what the number means; that module states it. **Do not copy a figure into this file** —
   * two owners of one measurement is how the panel comes to disagree with itself.
   */
  /*
   * ⚠️ **`transmap.layer` must keep saying that the WAVE TERMS are the exception (owner, 2026-09-23).** A picker
   * over per-layer settings invites the reading that everything below it is per-layer; the terms are not — they
   * are the preset's own tables, shared by every layer — and this is the tooltip on the control that creates the
   * expectation. `multiLayerEl` says the same thing inline, for the user who never hovers.
   */
  'transmap.layer': 'Which shift or zoom layer this whole tab is about — Style, Pattern, the amounts, the zoom '
    + 'half and the zoom centre all follow this choice, and each layer keeps its own. ⚠️ The wave terms are the '
    + 'exception: they are the preset’s own two tables, shared by every layer, so typing one moves them all. The '
    + 'number is the layer’s position in the Visual FX chain list, which is also where layers are added, removed '
    + 'and reordered.',
  'transmap.frame': 'The displacement this layer applies, drawn as a deformed grid at the frame’s own shape, '
    + 'with the two wave profiles along the top and left edges. ⚠️ This is the warp itself, not the rendered '
    + 'picture: a line shows where the frame is read FROM, so it is never a particle path.',
  'transmap.frameScale': 'The grid is drawn larger than life so that a small warp is still visible, and this '
    + 'says by how much. The authored fields in the library run from a couple of pixels to most of the frame, '
    + 'so a true-to-scale drawing would show nothing at all for half of them — the measured size is in the '
    + 'line at the bottom of the tab, which is the one place a number is claimed.',
  'transmap.style': 'How the two wave profiles become a displacement. Wave Shift slides each pixel; the three '
    + 'Zoom styles push it away from or towards a centre, so they also use the Zoom centre below. Zoom '
    + 'Combined does both, taking its zoom from a second set of terms. Only these four styles are built from '
    + 'wave terms — the other warp styles live in the Visual FX tab and have no terms to edit.',
  'transmap.pattern': 'Where the field comes from. (Preset) means the terms below are the source, which is what '
    + 'almost every preset in the library does. Picking a named pattern takes over: it re-solves its own size on '
    + 'every canvas, and the terms below show that solved shape — still editable. Typing in one keeps those '
    + 'numbers at this window size and this reads “(Preset) — edited”; Reset field puts back whatever the preset '
    + 'had when you opened the tab.',
  'transmap.identify': 'Which named pattern the terms below are, if any, and what Strength it would take to '
    + 'match the field you are seeing now. Many authored fields are stronger than the Strength slider can '
    + 'reach, so this says when picking the pattern would give you a smaller field rather than the same one.',
  'transmap.resetField': 'Put the field back to what it was when you opened this tab — the style, the pattern, '
    + 'every slider and both sets of terms. Nothing else in the preset is touched. It greys out while the field '
    + 'still matches that starting point, so a lit button is also how you know you have changed something — it '
    + 'is the same test that makes Pattern read “(Preset) — edited”.',
  'transmap.reapplyField': 'Put back the changes Reset just undid, exactly as they were the moment you pressed '
    + 'it. Only Reset arms this, so it is available once per Reset; changing anything afterwards leaves it '
    + 'pointing at that same state rather than following the newer edits.',
  'transmap.strength': 'Overall size of the warp. 0.5 is the neutral setting where a preset’s terms are used '
    + 'exactly as authored, so above it the field is stronger than the preset intended and below it weaker. '
    + '0 is the dead centre of the track, not an end stop: below it the same field is inverted, every offset '
    + 'pointing the opposite way at the same size. The measured result in pixels is in the line at the bottom '
    + 'of the tab — and because that is a size, only the sign of the number here says which way round it is.',
  'transmap.detail': 'Scales a named pattern’s frequencies, making its shape finer or coarser without changing '
    + 'its size. ⚠️ It applies to patterns only, and the row is hidden on (Preset): a preset’s own frequencies '
    + 'encode exact whole-number relationships, and scaling those would replace the figure rather than refine '
    + 'it — which is why the engine deliberately ignores it there.',
  /*
   * ⚠️⚠️ **`transmap.shape` AND `transmap.shapeMix` ARE NOT IN THE INERT-IN-ONE-REGIME SET ABOVE, AND THE
   * ASYMMETRY IS A DECISION** (`35.D2` decision 1): the shape applies on `(Preset)` as well as on an
   * archetype, which is the **opposite** of `transmap.detail`'s treatment two entries up. The reason is that a
   * shape is a transformation OF the author's own table, where `detail` would be a rescaling of frequencies
   * the author chose. **Do not "fix" the inconsistency** — the named risk (that a table's frequencies were
   * authored for sine) is said out loud by `SHAPE_NOTICES.authoredForSine` instead.
   *
   * ⚠️ **The re-calibration sentence in `transmap.shapeMix` is FALSE ON EXACTLY TWO of the 22 patterns**, and
   * that is why it names them: `Macrolense` and `Distant Lense` carry `absoluteAmp`, so they skip `solveGain`
   * entirely and a shape there changes the warp's SIZE as well as its form (`PHASE35-KEYS.md` §4.2).
   */
  'transmap.shape': 'The wave the field is built from. Sine is the default and what every shipped preset '
    + 'uses; Triangle and Trapezoid are harder-edged versions of it, and Square and Sawtooth cut the image '
    + 'rather than bending it. ⚠️ It does nothing at all until Shape mix is above 0 — the two are separate '
    + 'on purpose. Unlike Detail it applies on (Preset) too, reshaping the preset’s own terms instead of '
    + 'replacing them.',
  'transmap.shapeMix': 'How much of the shape is blended into the plain sine wave: 0 is pure Sine whatever '
    + 'Shape says, and 1 is the shape alone. Strength re-solves itself as you move it, so the warp keeps its '
    + 'measured size — except on Macrolense and Distant Lense, which carry their own amplitudes and skip '
    + 'that step, so there the size moves with the shape.',
  /*
   * v8 `35.4` — the orientation pair. **ONE tip for the two cells**, because the row is one quantity in two
   * halves (the `tripletRow` precedent: the row carries the title and the `aria-label`s carry the axis).
   *
   * ⚠️ **The range is ±90 and the tip says why, because a reader who finds only the UI reason will widen
   * it.** `(angle + 180°, −amplitude)` is bit-identical, so a full circle would offer every field twice; and
   * ±90 has no wrap, which is what makes the Mixer's plain lerp the shortest path between two orientations.
   * `WAVE_ANGLE_MAX`'s own header carries both reasons.
   *
   * ⚠️ **It does NOT enumerate the degenerate cases** — ±90, parallel, and style 2's exact cancellation are
   * three INLINE notices (`SHAPE_NOTICES.axisSwap`/`wavesParallel`/`wavesCancel`), because each is a
   * precondition that depends on the other angle's live value and a tooltip cannot be conditional.
   */
  'transmap.angle': 'Which direction each wave runs in, in degrees. At 0 and 0 they are at right angles, the '
    + 'way every shipped preset is built; turning them apart gives the field an arbitrary lattice '
    + 'orientation, and turning them together gives stripes in one direction only. The range is ±90 because '
    + 'a wave at +120° is the same field as one at −60° with its amplitudes flipped.',
  'transmap.zoomAngle': 'The same pair for the zoom half of Zoom Combined, which is built by a separate pass '
    + 'and can therefore run at its own orientation. Leaving these at 0 while the shift angles turn is a '
    + 'legitimate field: the zoom keeps its lattice square while the shift half tilts.',
  'transmap.drift': 'How fast the whole field slides, in grid cells per second. It moves the field rigidly, so '
    + 'the shape and the size never change — only where it sits. 0 holds it still, which is what almost every '
    + 'preset in the library does.',
  'transmap.terms': 'The sine terms the field is built from: four in WaveX and four in WaveY, each with an amplitude '
    + 'and a frequency. These are always the terms the engine is using right now — on (Preset) they are the '
    + 'stored ones, and on a named pattern they are the pattern solved at this window size. Typing in any box '
    + 'makes them yours: Pattern goes back to (Preset) carrying these same numbers, so the field you were '
    + 'looking at is the field you keep editing.',
  // ⚠️ **The panes are `WaveX` / `WaveY`; `Across` and `Down` are RETIRED WORDS (owner, 2026-09-22) and may not
  // return to any copy.** They named the direction the profile is drawn along, not the direction it pushes —
  // on Wave Shift, WaveX displaces pixels DOWN — so the old labels were wrong about the tab's default style.
  // These two tips are therefore the one place the "one value per column / per row" fact is stated in words.
  /*
   * ⚠️⚠️ **BOTH OF THESE WERE FALSE AT A NON-ZERO ANGLE AND WERE REWRITTEN BY `35.4`.** They said *"one
   * value per column"* and *"one value per row"*, and they said the field never varies diagonally — all
   * three claims were true of the engine until `35.3` made the wave index a direction rather than a
   * coordinate. **Angle X is the control that makes them false**, so each tip now names its own angle: a
   * tooltip that describes the state a control had before a sibling control existed is invariant 25's
   * failure wearing prose, and `tipcheck` can see that these keys EXIST but never that they are true.
   */
  'transmap.waveX': 'The four terms of the first wave. At Angle X 0 they vary along the width of the frame — '
    + 'one value per column, making vertical bands — and at any other angle they vary along that direction '
    + 'instead, so the bands tilt with it. On Wave Shift these values move pixels up and down.',
  'transmap.waveY': 'The four terms of the second wave, which starts out at right angles to the first: at '
    + 'Angle Y 0 one value per row, making horizontal bands, and tilted with the angle otherwise. A field '
    + 'with terms in one direction only is legal and common — the line under each set says when you have one.',
  'transmap.paneSummary': 'The live terms in this direction, written as amplitude@frequency. A term with an '
    + 'amplitude of 0 is left out. In the zoom half a term at frequency 0 reads “steady” instead, because there '
    + 'it is a constant zoom rather than nothing. If it says this direction is silent, every term here is '
    + 'switched off and the field varies in the other direction only.',
  'transmap.term': 'Whether this term counts. In the shift half a term needs BOTH a non-zero amplitude and a '
    + 'non-zero frequency to do anything; in the zoom half an amplitude alone is enough, and at frequency 0 it '
    + 'is a steady zoom. Switching a term off stores zero for both. Switching it back on restores the numbers '
    + 'still shown in the boxes, or starts you at amplitude 0.5 and frequency 1 if they were empty. That '
    + 'memory lasts until you load another preset.',
  'transmap.amplitude': 'How far this term pushes the frame. The four amplitudes in a direction add up, and '
    + 'the total is scaled by Strength before it reaches the picture — so the line at the bottom of the tab is '
    + 'what actually happens. Type any value: what you type is stored exactly as typed. A number a pattern '
    + 'solved for you is shown to six digits, because its size is only as exact as the current window.',
  'transmap.frequency': 'How many times this term repeats across the frame. Whole numbers make a field that '
    + 'closes seamlessly; fractions do not, which is a look rather than a mistake. In the shift half a frequency '
    + 'of 0 makes the term do nothing however large its amplitude, because it is a flat sine; in the zoom half '
    + 'the same term is a steady zoom of that amplitude, held everywhere in the frame.',
  'transmap.zoomHalf': 'Zoom Combined applies a shift and a zoom together, and they come from separate terms: '
    + 'everything above is the shift, everything here is the zoom. It is not one field at two detail levels.',
  'transmap.zoomPattern': 'Which named pattern supplies the zoom half. ⚠️ It is read only while the shift half '
    + 'is on a pattern too — with Pattern set to (Preset) the engine takes the zoom straight from the second '
    + 'set of terms below and ignores this, which is why it greys out rather than disappearing.',
  'transmap.zoomStrength': 'Size of the zoom half only, on the same scale as Strength: 0.5 uses the second set '
    + 'of terms exactly as authored, and below 0 the zoom half inverts — what pushed outwards pulls inwards. '
    + 'The shift half keeps its own Strength, so the two halves are balanced against each other here, and '
    + 'giving them opposite signs is how they can be made to oppose rather than reinforce.',
  'transmap.zoomBias': 'Shifts the zoom towards pushing outwards or pulling inwards, rather than doing equal '
    + 'amounts of both. ⚠️ Like Zoom Pattern it is read only while a pattern is picked: with the terms as the '
    + 'source the engine holds it at a fixed value, and it greys out so the gap is visible rather than silent. '
    + 'Typing over a pattern’s terms moves whatever this is doing into one of them, so the picture does not jump '
    + '— except where all four zoom terms are already in use, which the note above the terms says.',
  /*
   * ⚠️ **These two are in `transmap.zoomStrength`'s class, NOT `transmap.zoomPattern`'s, and the design
   * document says otherwise.** `PHASE35-KEYS.md` §5.4 puts them in the inert-in-one-regime set
   * beside `zoomPattern` and `zoomBias`. Measured against what `35.2` built: `shape2`/`shapeMix2` reach
   * `buildZoomWave` on BOTH branches (sites 7/8 are the `(Preset)` branch and 9/10 the archetype branch), so
   * they are read in both regimes and are gated by STYLE alone. **Saying they grey out would describe a gate
   * the code does not implement** — invariant 25 in the direction nothing can check.
   */
  'transmap.zoomShape': 'The wave shape for the zoom half only. The zoom half is built by a separate pass '
    + 'from the second set of terms, so it can carry a different shape from the shift half above. ⚠️ Zoom '
    + 'Combined only, and like Shape it does nothing until Zoom shape mix is above 0.',
  'transmap.zoomShapeMix': 'How much of Zoom shape is blended into the zoom half’s sine wave: 0 is pure Sine '
    + 'whatever Zoom shape says. It is independent of the shift half’s Shape mix, so the two halves can be '
    + 'shaped by different amounts — or one shaped and the other left smooth.',
  'transmap.centre': 'Where the zoom pushes away from, as a percentage of the frame, marked by the crosshair '
    + 'on the picture above. Wave Shift ignores it entirely. Touching either axis fixes both for this layer, '
    + 'which otherwise follows the preset’s own centre.',
  'transmap.readout': 'What the field actually measures: the largest displacement in pixels, the same figure '
    + 'as a share of the frame’s short side, and where it comes from. It is the one number on this tab that is '
    + 'measured rather than drawn, and it is the way to tell a field that is genuinely flat from one that is '
    + 'working and simply small.',

  /* ── The Reel tab (v8 Phase 19) ───────────────────────────────────────────────────────────────────────
   *
   * ⚠️ **Two of these carry a PRECONDITION and are still tooltips, which is the exception to the inline rule,
   * not a breach of it.** `CLAUDE.md`'s tooltip row says a precondition stays inline — but the two here
   * (`reel.main` and `reel.delete`) describe when a DISABLED control would become usable, and a disabled
   * control's reason has nowhere inline to live: the row it sits in is one checkbox and one button. Both
   * controls also set the same reason as their `title` when disabled, so the reason is reachable either way.
   *
   * ⚠️ **`reel.export`/`reel.import` say "reels" in their first clause on purpose.** The Lab header already
   * has Export and Import for PRESETS, so a user who reads only the first few words has to be able to tell
   * the two pairs apart — the owner's decision to ship a dedicated pair rather than widen the header buttons
   * only helps if the copy makes the split visible.
   */
  'reel.select': 'Every reel this build knows about — the ones shipped with the engine, any that came with the '
    + 'deployment, and your own. Picking one loads it here for editing. ★ marks the main reel, which is the one '
    + 'that plays when nothing else is chosen.',
  'reel.new': 'Start a fresh, empty reel. It exists only in this editor until you press Save, so nothing is '
    + 'overwritten and the reel you were looking at is still in the dropdown.',
  'reel.name': 'The reel’s name, and its identity: saving under a name that already exists replaces that reel '
    + 'after a confirmation. Renaming and saving leaves the original in place, so it is how you copy a reel.',
  'reel.playMode': 'Sequential plays the presets in the order below and loops forever. Random shuffles, plays '
    + 'every preset once, then reshuffles — so nothing repeats until everything has been seen, and no preset '
    + 'ever follows itself.',
  'reel.playSeconds': 'How long each preset holds before the next one starts, in seconds. The transition '
    + 'happens on top of this, so the switch itself costs no extra hold time.',
  'reel.transition': 'Fade to black dips the picture out, switches, and brings the new one up — jump-free for '
    + 'any pair of presets. Cross-fade dissolves one into the other, which is smoother but shows both figures '
    + 'at once for a moment, so it suits soft, accumulated looks better than crisp geometric ones.',
  'reel.main': 'The reel that plays by itself when the engine starts on a deployed page, and the one Play uses '
    + 'when no reel is selected. Exactly one reel is main; ticking this moves the mark rather than adding a '
    + 'second. Save the reel first — an unsaved reel has no name to mark.',
  'reel.save': 'Store this reel in your browser. Saving under an existing name replaces it, after asking. Your '
    + 'reels live in this browser only, so use Export Reels to move them to another machine.',
  'reel.delete': 'Remove this reel from your browser. Only your own reels can be deleted; one of yours that '
    + 'shares its name with a reel shipped in the engine will fall back to the shipped version rather than '
    + 'disappearing, and the confirmation says which will happen.',
  'reel.play': 'Play this reel full screen, starting now. Escape — or a click on the picture — brings you back '
    + 'here. Editing while it plays is safe: the change takes effect at the next switch.',
  'reel.stripTile': 'A preset in this reel, animating. Click to select it, or drag it onto another tile to move '
    + 'it into that place — the positions renumber themselves. The arrows shift it one place, the cross takes it '
    + 'out, and the number is its position. The tile outlined in red is the one the main view is showing.',
  'reel.stripMove': 'Move this preset one place earlier or later in the play order. Dragging the tile onto '
    + 'another one does the same thing over any distance. The order is what Sequential mode follows; Random mode '
    + 'ignores it.',
  'reel.stripToFirst': 'Move every selected preset to the front of the reel, keeping their order relative to one '
    + 'another. This is the quick way to choose what a Sequential reel opens with; Random mode ignores the order '
    + 'altogether.',
  'reel.stripRemove': 'Take this preset out of the reel. The preset itself is untouched — it stays in the '
    + 'library and in every other reel.',
  'reel.removeSelected': 'Take every selected preset out of this reel at once. Nothing is deleted from the '
    + 'library, and the reel is not saved until you press Save.',
  'reel.removeAll': 'Empty the reel completely, leaving its name, play mode, time and transition alone. The '
    + 'reel is not saved until you press Save, so this is undone by picking the reel again in the dropdown.',
  'reel.search': 'Narrow the preset list below by name. It matches anywhere in the name, so “fire” finds Fire '
    + 'Storm and Eternal Fire alike. Filter, beside it, narrows by what a preset actually does; the two combine.',
  'reel.add': 'Append every selected preset to the end of the reel, in the order they appear here. A preset can '
    + 'appear in a reel more than once — adding it twice plays it twice.',
  // ⚠️ **WIDENED in v8 22.7 from "when a search is active" to both halves.** This tooltip is the ONLY place that
  // says what `Add All` adds, and the facet filter changed the answer: it is the visible set, so a filter alone
  // — with the search box empty — already narrows what the button does.
  'reel.addAll': 'Append every preset currently listed — which means the set left by the search and the filter, '
    + 'not the whole library. Use it with either to build a themed reel in two clicks.',
  'reel.browseTile': 'A preset in the library, animating. Click to select it, double-click to add it to the reel '
    + 'straight away. Selecting several and pressing Add adds them all in this order.',
  'reel.export': 'Save every reel — including the ones shipped with the engine — to a file, so they can be '
    + 'moved to another browser or machine. This file holds reels only; the Export button at the top of the Lab '
    + 'is for the preset itself.',
  'reel.import': 'Load reels from a file written by Export Reels. Nothing is overwritten: a reel whose name is '
    + 'already taken arrives with a version suffix, exactly as an imported preset does. A preset file is '
    + 'refused with a message rather than half-read.',
};

/**
 * What each category lock COVERS. Composed into a full sentence by the tab, because the two tabs do
 * different things with a lock: the Mixer freezes the category at its blended value, the Randomiser excludes
 * it from mutation. One table, two verbs — stating the verb here would make one of them wrong. (Phase 25
 * makes Evolution a third reader, with a third verb.)
 *
 * ⚠️ **`Record<CategoryLock, string>` SINCE v8 `24.2` (2026-10-05), AND THE RETYPE IS THE POINT, NOT TIDINESS.**
 * It was `Record<string, string>`, under which a seventh `CategoryLock` compiled fine and both tabs rendered
 * a chip whose tooltip read `Leave undefined untouched when randomising.` — the literal word "undefined" in
 * the UI, from an index signature that answers every key. `tipcheck` could not see it either: it asserts that
 * a `title` comes from a table, not that the lookup hit a row. **Now a missing member is a compile error.**
 *
 * ⚠️ **THREE OF THESE SENTENCES WERE FALSE WHEN `24.2` FOUND THEM, and all three for the same reason:** the
 * scope of a category is the `group` column of `OVERLAY_RULES`, and these tips were written before that
 * column existed. `color` promised the palette and the film look while both lived in `visual`; `attractor`
 * promised the generator while the Randomiser's `attractor` chip gated nothing at all; `visual` claimed the
 * render mode and never mentioned the twenty-odd field systems that are its real content. `24.1` moved nine
 * keys and `24.5` wired the chips, so **the tips below are now true** — the fix was in the code and the
 * table, not in the wording alone. ⚠️ **Any further group move is a TWO-FILE edit with `overlay-rules.ts`,
 * and nothing enforces it.**
 */
export const LOCK_CATEGORY_TIPS: Record<CategoryLock, string> = {
  shape: 'the wave table — frequencies, amplitudes, phases — the particle count, the figure’s scale and '
    + 'the particle size',
  // ⚠️ **THE MASKING (24.D8) IS SAID OUT LOUD IN `TAB_TIPS['rnd.masking']`, NOT HERE, AND `tipcheck` §H IS
  // WHY.** This table's entries are composed into a sentence by BOTH tabs ("Leave … untouched when
  // randomising." / the Mixer's own verb), so every value must stay a noun phrase — §H holds them to 120
  // chars for exactly that reason. The first draft of this entry appended "note that a new palette overrides
  // the colour curves…" and came to 188 chars; the checker caught it, and it was a real defect in two tabs'
  // copy rather than a length quibble. The scope goes here, the caveat goes in the tab.
  color: 'base colour and its curves, the palette and its mapping, and the film look',
  motion: 'wave speed, the playback-speed multiplier and the three rotation rates',
  transmap: 'the image-domain warp: style, layers and their parameters',
  attractor: 'the strange-attractor generator and how strongly it is blended in',
  // ⚠️ NEW with 24.D3. The sentence has to carry the reason the lock exists, which is the black frame:
  // `splat` draws nothing without a material, so the material and the render mode are one decision.
  material: 'the material — Plasma, Ice, Smoke and the rest — together with the render mode it requires',
  visual: 'trail length, glow, bloom, the symmetry fold and every Visual FX field system',
};

/**
 * Tooltips for the three MODAL DIALOGS in `export.ts` — Rename, Import (single) and Import Bundle. Keyed
 * `<dialog>.<control>`, because all three are the same markup idiom with different semantics.
 *
 * ⚠️ **Each dialog's own copy stays SHORT and its tooltip carries the name rule**, which is the one thing a
 * user cannot see: a preset name is the primary key of five owners, a clash is refused rather than merged,
 * and the ` v<n>` suffix is what the dialogs offer instead. Stating that in the body text would put three
 * paragraphs inside a 360 px modal.
 */
export const DIALOG_TIPS: Record<string, string> = {
  'rename.name': 'The new name. It must be unique in the library — a name already taken is refused rather '
    + 'than merged, because a preset name is the key its tile and its renderer slot are held under. '
    + 'Renaming to the same name, or only changing its capitalisation, is accepted.',
  'rename.fix': 'Accept the suggested name, which is the next free " v<n>" version of what you typed.',
  'rename.confirm': 'Apply the new name (Enter also works). The preset keeps its position in the library.',
  'rename.cancel': 'Close without renaming. Escape and a click outside the dialog do the same.',

  'import.name': 'The name this preset will be filed under, taken from the file and pre-resolved to the next '
    + 'free " v<n>" if that name is already in use. A clashing name typed by hand is still refused.',
  'import.fix': 'Accept the suggested name, which is the next free " v<n>" version of what you typed.',
  'import.confirm': 'Add the preset to the library under this name (Enter also works) and load it.',
  'import.cancel': 'Discard the file without importing anything. Escape and a click outside do the same.',

  'bundle.skip': 'Import only the presets whose names are not already in the library, leaving your existing '
    + 'ones exactly as they are.',
  'bundle.all': 'Import every preset in the file. No name in it is taken, so nothing is renamed or replaced.',
  'bundle.allSuffix': 'Import every preset, giving each clashing name the next free " v<n>" suffix. Nothing '
    + 'already in the library is overwritten.',
  'bundle.cancel': 'Import nothing. Escape and a click outside the dialog do the same.',
};
