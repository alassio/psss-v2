import type { UnifiedPreset, SinMagicParams, MaterialConfig, LiquidSurfaceConfig, CohesionConfig, LiquidFieldConfig, DyeFieldConfig, OverlayState } from '../presets/types.ts';
import type { ModulatedValue } from '../core/interfaces.ts';
import type { CategoryLock } from './state.ts';
import { deepCopy } from './state.ts';
// ⚠️ `OverlayRule` was `MixRule` until 2026-10-05 — renamed by 24.1 when the record grew the Randomiser's
// `mutate` column, because a record naming BOTH verbs could not keep a name that claims only the first. The
// FIELD this file reads is still `rule.law`; see `OverlayRule`'s own note for why that one did not move.
import type { CustomMixerId, KeysWithLaw, OverlayRule, MixWeights } from './overlay-rules.ts';
// v8 26.4 — the scalar-law branch needs the UNCONDITIONAL set by VALUE, to tell a key whose identity is
// expected in the output from one whose absence must survive. See that branch for why the two differ.
import { UNCONDITIONAL_KEYS } from './overlay-rules.ts';
import { OVERLAY_RULES, weightsFor } from './overlay-rules.ts';
import { STATIC_FIELD_DEFAULTS } from '../post-processors/static-field.ts';
import { BAND_SPLIT_DEFAULTS, PARALLAX_DEFAULTS, REFRACTION_DEFAULTS, TIME_WARP_DEFAULTS, VORTEX_DEFAULTS } from '../post-processors/trans-map-chain.ts';

/**
 * Crossfade two presets.
 *
 * ⚠️ **THE THIRD PARAMETER IS `mix`, NOT `t`, AND THE RENAME IS THE SAFETY MECHANISM** (v8 Phase 23.5). It
 * is `number | MixWeights`: one weight for everything, or one per category lock. A union cannot be used
 * arithmetically, so **every surviving `inv * a.x + t * b.x` that was never taught about categories is a
 * compile error** rather than a block that silently keeps following the master fader. Each block therefore
 * opens with its own `const { t, inv } = weight('<group>')`, and ⚠️ **there must be no module-level `t`/`inv`
 * in scope "for convenience"** — that one line would re-open the hole invisibly.
 *
 * ⚠️ **`result.overlay` IS BUILT EXACTLY ONCE, BY `buildOverlay()`, AND NOT INSIDE ANY LOCK BRANCH** (Phase
 * 23.2). Until 2026-10-05 it was assigned WHOLESALE from two object literals — one in the `visual` block's
 * interpolating branch and one in its locked branch — so every overlay key absent from the literal in force
 * was **destroyed**, at every `t` including `t = 0`. Twenty of the forty-six declared keys were written;
 * measured over the 274-preset library, 270 presets lost at least one effective feature and 263 had their
 * grade reset, at a median of 49 lost leaf paths, with only 2 of 200 sampled pairs byte-faithful to deck A at
 * `t = 0`. The arithmetic was never wrong; the defect was entirely in what never entered the function.
 * **`OVERLAY_RULES` is now the enumeration and `tsc` holds it to `keyof OverlayState`** — adding an overlay
 * key without a rule no longer compiles. Do not re-introduce a literal here.
 */
export function interpolatePreset(
  a: UnifiedPreset,
  b: UnifiedPreset,
  mix: number | MixWeights,
  locks: Set<CategoryLock>,
  lockedValues: Map<CategoryLock, UnifiedPreset> = new Map(),
): UnifiedPreset {
  const result = deepCopy(a);
  const weight = (group: CategoryLock): { t: number; inv: number } => weightsFor(mix, group);

  if (!locks.has('shape')) {
    const { t, inv } = weight('shape');
    result.generators.particleCount = Math.round(inv * a.generators.particleCount + t * b.generators.particleCount);
    result.generators.waves = interpolateWaves(a.generators.waves, b.generators.waves, t);
    /**
     * v8 Phase 23.4 / 23.D7 — the DESIGN BOX, **snapped at t = 0.5**.
     *
     * It was never blended at all: `deepCopy(a)` carried deck A's box to every `t`, including `t = 1`, so a
     * mix of a 1920×1080 preset with a square one was framed by whichever deck happened to be in slot A.
     * ⚠️ **It cannot be lerped**: invariant 27's point is that a subsystem's SCALE and its ORIGIN are two
     * quantities, and an intermediate box is a frame neither deck's figure was fitted to — the figure would
     * drift off centre across the sweep instead of arriving. Snapped with `shape` because it is the box the
     * figure's own geometry was authored in.
     */
    result.metadata.designResolution = { ...(t < 0.5 ? a : b).metadata.designResolution };
  } else {
    const snap = lockedValues.get('shape');
    if (snap) {
      result.generators.particleCount = snap.generators.particleCount;
      result.generators.waves = deepCopy(snap.generators.waves);
      result.metadata.designResolution = { ...snap.metadata.designResolution };
    }
  }

  if (!locks.has('color')) {
    const { t } = weight('color');
    result.generators.colorBase = lerpArr(a.generators.colorBase, b.generators.colorBase, t);
    result.generators.colorAmp = lerpArr(a.generators.colorAmp, b.generators.colorAmp, t);
    result.generators.colorFreq = lerpArr(a.generators.colorFreq, b.generators.colorFreq, t);
    result.generators.colorShift = lerpArr(a.generators.colorShift, b.generators.colorShift, t);
    // `visualFx` is a DEAD channel — nothing reads it (see the @deprecated note in `presets/types.ts`).
    // Carried across only so a preset that has the block does not silently lose it on a crossfade; the
    // grade the user actually sees comes from `overlay.filmLook` / `customFilmLookParams`.
    if (a.visualFx || b.visualFx) {
      const src = t < 0.5 ? a.visualFx : b.visualFx;
      const fallback = t < 0.5 ? b.visualFx : a.visualFx;
      const keep = src ?? fallback;
      if (keep) result.visualFx = { ...keep };
    }
  } else {
    const snap = lockedValues.get('color');
    if (snap) {
      result.generators.colorBase = snap.generators.colorBase.slice();
      result.generators.colorAmp = snap.generators.colorAmp.slice();
      result.generators.colorFreq = snap.generators.colorFreq.slice();
      result.generators.colorShift = snap.generators.colorShift.slice();
      if (snap.visualFx) result.visualFx = deepCopy(snap.visualFx);
    }
  }

  if (!locks.has('motion')) {
    const { t, inv } = weight('motion');
    result.generators.waveSpeed = inv * a.generators.waveSpeed + t * b.generators.waveSpeed;
    result.generators.rotation = lerpArr(a.generators.rotation, b.generators.rotation, t);
    /**
     * v8 Phase 23.4 / 23.D7 — the initial POSE, **snapped at t = 0.5**, and resolved with `motion` rather
     * than `shape` because it is the OFFSET of the rotation one line up (`CLAUDE.md`: "`Angle` (initial
     * pose) vs `Rotation` (speed)"). A user who locks `motion` to hold how the figure turns gets the pose it
     * turns from; `shape` keeps its narrower meaning, "how many particles and what waves".
     *
     * ⚠️ **Snapped, not lerped, because a pose is three ANGLES in degrees and the axes are not independent
     * of one another** — the rotation they compose is not the composition of the lerps (invariant 10's
     * "check the units of the RESULT"), so a blend would sweep the figure through orientations neither deck
     * authored. 23.D1's default applies: late is better than invented.
     *
     * Emitted only where the winner has it — the key is optional and most presets omit it.
     */
    const poseWinner = t < 0.5 ? a : b;
    if (poseWinner.generators.angle) result.generators.angle = poseWinner.generators.angle.slice();
    else delete result.generators.angle;
  } else {
    const snap = lockedValues.get('motion');
    if (snap) {
      result.generators.waveSpeed = snap.generators.waveSpeed;
      result.generators.rotation = snap.generators.rotation.slice();
      if (snap.generators.angle) result.generators.angle = snap.generators.angle.slice();
      else delete result.generators.angle;
    }
  }

  /**
   * v8 `36.13` — **`generators.type` AND `generators.lsystem`, HAND-WRITTEN, because nothing would do it
   * for them.**
   *
   * ⚠️⚠️ **THIS COMMENT USED TO SAY THE OPPOSITE AND IT WAS REWRITTEN RATHER THAN DELETED.** It read:
   * *"`generators.type` and `generators.attractor` are still not blended, and that is deliberate… Fixing
   * it means deciding what 'halfway between a lissajous and an attractor figure' is — **a phase, not a
   * line**."* **Phase 36 is that phase, and it decided: THERE IS NO HALFWAY, so the type SNAPS.**
   * ⚠️ `generators.attractor` is still not blended here and that half of the old note stands — the
   * `fractal` block below owns the attractor's own crossfade.
   *
   * ⚠️⚠️ **`36.D1`'s COST ARRIVED EXACTLY AS PREDICTED AND `mixercheck` IS WHAT FOUND IT.** A non-`overlay`
   * block gets **no automatic law of any kind**: `OVERLAY_RULES` is total over `OverlayState`, which is
   * what buys an `overlay` key its Mixer law, its Randomiser column, its crossover law, its export gate
   * and its `facetcheck` coverage for free — and a `generators` block gets none of it. The first two
   * curve demos turned the endpoint clauses red on **20 ADDED + 20 REMOVED + 1 CHANGED** paths, every one
   * `generators.lsystem.*`. **Nothing would have failed if this had been forgotten until a user tried it.**
   *
   * The law, and every clause of it is a decision rather than an implementation detail:
   *   - **`type` SNAPS AT t = 0.5**, never at an endpoint — invariant 16, and `16.D`'s own rule for a
   *     categorical field. A type difference is a HARD CUT and that is not a defect (`36.D18`).
   *   - **The DORMANT block is not interpolated at all.** It is both wasted work and a correctness
   *     question: interpolating data that affects neither picture would make the result depend on it.
   *   - **`rule` SNAPS** — there is no interpolant between two production systems, and an intermediate
   *     would not be a fractal at all.
   *   - **The five `ModulatedValue` triples lerp component-wise**, which is what makes a crossfade on
   *     `yaw` alone morph BETWEEN NAMED FRACTALS — the best Mixer demo in either spec, and something no
   *     other crossfade in the product can do.
   *   - ⚠️ **`descend` is GEOMETRIC, not linear.** Octaves are multiplicative, so a linear lerp from 1 to
   *     128 spends half the crossfade above ×64. `lerpTransform`'s scale term takes the same treatment
   *     for the same reason.
   */
  if (!locks.has('shape')) {
    const { t } = weight('shape');
    // Categorical: snap at the midpoint, never at an endpoint (invariant 16).
    const typeWinner = t < 0.5 ? a : b;
    result.generators.type = typeWinner.generators.type;
    const liveA = a.generators.lsystem;
    const liveB = b.generators.lsystem;
    if (liveA !== undefined && liveB !== undefined) {
      // Both decks carry a curve: blend it. `rule` snaps with the type for the same reason.
      const lerpMV = (x: ModulatedValue, y: ModulatedValue): ModulatedValue => ({
        base: x.base + (y.base - x.base) * t,
        amplitude: x.amplitude + (y.amplitude - x.amplitude) * t,
        frequency: x.frequency + (y.frequency - x.frequency) * t,
      });
      // GEOMETRIC on `descend` -- see the header. Guarded because a non-positive base has no log.
      const geoMV = (x: ModulatedValue, y: ModulatedValue): ModulatedValue => ({
        base: x.base > 0 && y.base > 0 ? x.base * Math.pow(y.base / x.base, t) : x.base + (y.base - x.base) * t,
        amplitude: x.amplitude + (y.amplitude - x.amplitude) * t,
        frequency: x.frequency + (y.frequency - x.frequency) * t,
      });
      // v8 `39.A8` — an optional key survives the blend unless the deck lacking it is at its own endpoint.
      const oneSidedKeep = (x: unknown, y: unknown, w: number): boolean =>
        (x !== undefined && w < 1) || (y !== undefined && w > 0);
      /*
       * v8 `39.C5` — **the custom generator SNAPS WITH THE RULE and is never interpolated** (spec §2.4: structure is
       * not a parameter). It travels with whichever deck's `rule` wins, so a result naming `customize` always
       * carries ITS generator and one naming a library rule never carries a stale one (`custom` present iff
       * `customize`, spec §3.5).
       */
      const ruleWinner = t < 0.5 ? liveA : liveB;
      result.generators.lsystem = {
        rule: ruleWinner.rule,
        ...(ruleWinner.custom !== undefined ? { custom: deepCopy(ruleWinner.custom) } : {}),
        recursion: lerpMV(liveA.recursion, liveB.recursion),
        yaw: lerpMV(liveA.yaw, liveB.yaw),
        pitch: lerpMV(liveA.pitch, liveB.pitch),
        roll: lerpMV(liveA.roll, liveB.roll),
        descend: geoMV(liveA.descend, liveB.descend),
        smoothness: liveA.smoothness + (liveB.smoothness - liveA.smoothness) * t,
        centre: (t < 0.5 ? liveA : liveB).centre.slice(),
        /*
         * v8 `39.A8` — **`twist` and `stretch` LERP**, each side read at its IDENTITY when absent (`?? 0`,
         * `?? 1`). ⚠️⚠️ The fold-as-a-crossfade depends on this: two dragon presets at twist 0 and 180 play the
         * fold across the fader. ⚠️ **Added only if EITHER deck authors the key**, so a blend of two pre-Phase-39
         * curves produces exactly the block it always did — a key neither side has must not appear (`36.D1`).
         * ⚠️ A plain lerp, NOT the spec's "shorter arc": no shipped Twist range wraps (the widest is ±180 on
         * Peano, whose ends are different figures), so the arc rule has nothing to do here.
         * ⚠️⚠️ **ONE-SIDED: the deck that LACKS the key wins at its own endpoint** — `mixercheck` §C found the first
         * version ADDING `twist`/`stretch` at t = 1 over a deck B that authors neither. Between the ends the absent
         * side reads as the identity, so the blend is continuous and each endpoint is that deck exactly.
         */
        ...(oneSidedKeep(liveA.twist, liveB.twist, t) ? {
          twist: lerpMV(liveA.twist ?? { base: 0, amplitude: 0, frequency: 0 },
            liveB.twist ?? { base: 0, amplitude: 0, frequency: 0 }),
        } : {}),
        ...(oneSidedKeep(liveA.stretch, liveB.stretch, t) ? {
          stretch: lerpMV(liveA.stretch ?? { base: 1, amplitude: 0, frequency: 0 },
            liveB.stretch ?? { base: 1, amplitude: 0, frequency: 0 }),
        } : {}),
      };
    } else {
      // ⚠️ Only one deck (or neither) carries a curve, so there is nothing to blend TOWARD. The block
      // follows the TYPE's winner, which keeps the result self-consistent: a result whose type is
      // `lsystem` always has the block, and one whose type is not never gains a synthetic one.
      const blockWinner = t < 0.5 ? a : b;
      if (blockWinner.generators.lsystem !== undefined) {
        result.generators.lsystem = deepCopy(blockWinner.generators.lsystem);
      } else {
        delete result.generators.lsystem;
      }
    }
  } else {
    /*
     * ⚠️⚠️ **THIS `else` WAS MISSING AND A LOCKED `shape` SILENTLY DID NOT HOLD THE FIGURE.** The FIRST
     * `shape` block above has one — it restores `particleCount`, `waves` and the design box from the
     * locked snapshot — and this second one, `36.13`'s, had none. So `result` kept `deepCopy(a)`'s type
     * and curve block: **measured with a third preset as the snapshot and every weight at 1, the lock
     * held `particleCount` and `waves` correctly and ignored `generators.type` and
     * `generators.lsystem` entirely.** A lock that holds half a category is worse than no lock, because
     * the half it drops is the half that decides which KIND of figure you are looking at.
     *
     * ⚠️⚠️ **`36.D1`'s COST FOR THE FIFTH TIME: a non-`overlay` block gets no automatic law of any
     * kind.** The named hand-written sites were `interpolate.ts`, `evolution-ops.ts`, `randomize.ts` and
     * `preset-facets.ts`; the list was incomplete twice over — `composer.ts`'s `adoptExternalFigure`
     * was one missed site, and this is a SECOND one inside `interpolate.ts` itself, where the file had
     * already been "taught" about the block once. **Being on the list is not the same as every branch
     * in the listed file being on it.**
     *
     * ⚠️ The delete-or-assign shape is the same as the unlocked branch's, and for the same reason: a
     * result whose type is not `lsystem` must never carry a synthetic block, and one whose type IS
     * `lsystem` must always have it.
     */
    const snap = lockedValues.get('shape');
    if (snap) {
      result.generators.type = snap.generators.type;
      if (snap.generators.lsystem !== undefined) {
        result.generators.lsystem = deepCopy(snap.generators.lsystem);
      } else {
        delete result.generators.lsystem;
      }
    }
  }

  if (!locks.has('transmap')) {
    const { t, inv } = weight('transmap');
    result.postProcessors.transMap = {
      enabled: t < 0.5 ? a.postProcessors.transMap.enabled : b.postProcessors.transMap.enabled,
      style: t < 0.5 ? a.postProcessors.transMap.style : b.postProcessors.transMap.style,
      beforeParticles: t < 0.5 ? a.postProcessors.transMap.beforeParticles : b.postProcessors.transMap.beforeParticles,
      sinMagicParams: lerpSinMagic(a.postProcessors.transMap.sinMagicParams, b.postProcessors.transMap.sinMagicParams, t),
      sinMagicParams2: lerpSinMagic(a.postProcessors.transMap.sinMagicParams2, b.postProcessors.transMap.sinMagicParams2, t),
      zoomCenter: {
        x: inv * a.postProcessors.transMap.zoomCenter.x + t * b.postProcessors.transMap.zoomCenter.x,
        y: inv * a.postProcessors.transMap.zoomCenter.y + t * b.postProcessors.transMap.zoomCenter.y,
      },
      // ifsParams snaps at t=0.5 — no element-wise interpolation across different-length arrays
      ...(((t < 0.5 ? a : b).postProcessors.transMap.ifsParams) ? { ifsParams: (t < 0.5 ? a : b).postProcessors.transMap.ifsParams! } : {}),
    };
  } else {
    const snap = lockedValues.get('transmap');
    if (snap) result.postProcessors.transMap = deepCopy(snap.postProcessors.transMap);
  }

  if (!locks.has('attractor')) {
    const { t, inv } = weight('attractor');
    const fracA = a.fractal;
    const fracB = b.fractal;
    if (fracA && fracB && fracA.type === fracB.type) {
      result.fractal = {
        type: fracA.type,
        params: lerpArr(fracA.params, fracB.params, t),
        blend: inv * fracA.blend + t * fracB.blend,
        bounds: lerpArr(fracA.bounds, fracB.bounds, t) as [number, number, number, number],
      };
    } else {
      const pick = t < 0.5 ? fracA : fracB;
      if (pick) {
        result.fractal = deepCopy(pick);
      } else {
        delete result.fractal;
      }
    }
  } else {
    const snap = lockedValues.get('attractor');
    if (snap?.fractal) result.fractal = deepCopy(snap.fractal);
    else delete result.fractal;
  }

  if (!locks.has('visual')) {
    const { t, inv } = weight('visual');
    /**
     * ⚠️ **`renderer.mode` SNAPS HERE AND ITS OVERLAY TWIN `overlay.renderMode` SNAPS IN `buildOverlay()`,
     * AND BOTH ARE IN THE `visual` GROUP ON PURPOSE** (v8 Phase 23.5, the twin rule in `overlay-rules.ts`).
     * With one master `t` the pair could not disagree. With a fader per category they can: resolved from two
     * different winning sides the frame would render deck B's mode under deck A's everything-else, and since
     * **the overlay wins at every reader** (invariant 17) the visible mode would be the overlay's while every
     * neighbouring control said otherwise. `mixercheck` §E checks the four pairs by NAME.
     */
    result.renderer.glow = inv * a.renderer.glow + t * b.renderer.glow;
    result.renderer.decayFactor = inv * a.renderer.decayFactor + t * b.renderer.decayFactor;
    result.renderer.blurRadius = inv * a.renderer.blurRadius + t * b.renderer.blurRadius;
    result.renderer.depthSize = inv * a.renderer.depthSize + t * b.renderer.depthSize;
    result.renderer.streaks = inv * a.renderer.streaks + t * b.renderer.streaks;
    result.renderer.mode = t < 0.5 ? a.renderer.mode : b.renderer.mode;

    result.postProcessors.bloom = {
      enabled: t < 0.5 ? a.postProcessors.bloom.enabled : b.postProcessors.bloom.enabled,
      threshold: inv * a.postProcessors.bloom.threshold + t * b.postProcessors.bloom.threshold,
      intensity: inv * a.postProcessors.bloom.intensity + t * b.postProcessors.bloom.intensity,
      radius: Math.round(inv * a.postProcessors.bloom.radius + t * b.postProcessors.bloom.radius),
    };

    result.postProcessors.toneMap = {
      curve: t < 0.5 ? a.postProcessors.toneMap.curve : b.postProcessors.toneMap.curve,
      exposure: inv * a.postProcessors.toneMap.exposure + t * b.postProcessors.toneMap.exposure,
      lift: lerpArr(a.postProcessors.toneMap.lift, b.postProcessors.toneMap.lift, t) as [number, number, number],
      gamma: lerpArr(a.postProcessors.toneMap.gamma, b.postProcessors.toneMap.gamma, t) as [number, number, number],
      gain: lerpArr(a.postProcessors.toneMap.gain, b.postProcessors.toneMap.gain, t) as [number, number, number],
    };
  } else {
    const snap = lockedValues.get('visual');
    if (snap) {
      result.renderer.glow = snap.renderer.glow;
      result.renderer.decayFactor = snap.renderer.decayFactor;
      result.renderer.blurRadius = snap.renderer.blurRadius;
      result.renderer.depthSize = snap.renderer.depthSize;
      result.renderer.streaks = snap.renderer.streaks;
      result.renderer.mode = snap.renderer.mode;
      result.postProcessors.bloom = deepCopy(snap.postProcessors.bloom);
      result.postProcessors.toneMap = deepCopy(snap.postProcessors.toneMap);
    }
  }

  /**
   * v8 Phase 23.2 — **THE OVERLAY IS BUILT HERE, ONCE, FROM `OVERLAY_RULES`.**
   *
   * ⚠️ **Written after every block above, and that is now an ordering CONVENIENCE rather than a
   * requirement.** Until 2026-10-05 the TransMap chain, the dispersion, the pass order and the force gate
   * were written in a block down here, each one explaining that it had to be "written here rather than in
   * the `transmap` block above because `result.overlay` is assigned wholesale by the `visual` block, which
   * would discard anything an earlier block put into it". That hazard is gone — and so is the worse one it
   * was a symptom of: with the whole object coming out of one owner, a `transmap` key no longer travels
   * with the `visual` LOCK by accident, and a key nobody wrote is a compile error rather than a silent reset.
   */
  result.overlay = buildOverlay(a, b, locks, lockedValues, weight);

  return result;
}

/**
 * The signature every `custom` law's owner has. It takes whole PRESETS, not the block it owns, because some
 * owners must read outside `overlay` to resolve their key honestly — `mixPassOrder` falls back to
 * `postProcessors.transMap.beforeParticles` on each side before snapping (invariant 17).
 */
type OverlayMixer = (a: UnifiedPreset, b: UnifiedPreset, t: number, inv: number) => Partial<OverlayState>;

/**
 * v8 Phase 23.1 — every `custom` law's owner, resolved by name.
 *
 * ⚠️ **`Record<CustomMixerId, OverlayMixer>` is enforcement in BOTH directions**: a law naming an owner that
 * does not exist here is a compile error, and an entry here that no law names is one too. That is why
 * `CustomMixerId` is a union rather than the `string` the plan specified — `mixercheck` §B can only grep for
 * the name, and a grep cannot tell a rename from a deletion.
 *
 * The five block interpolators keep their own `(block, block, t, inv)` signatures — they are documented,
 * measured and individually derived (⚠️ **four of them implement four different asymmetric-side rules and
 * none generalises to the next**), so they are ADAPTED here rather than rewritten to this shape.
 */
const CUSTOM_MIXERS: Record<CustomMixerId, OverlayMixer> = {
  mixCurlNoise,
  mixSymmetry,
  mixTransMapChain,
  mixDispersion,
  mixPassOrder,
  mixForceGate,
  interpolateMaterial: (a, b, t, inv) => interpolateMaterial(a.overlay?.material, b.overlay?.material, t, inv),
  interpolateLiquid: (a, b, t, inv) => interpolateLiquid(a.overlay?.liquid, b.overlay?.liquid, t, inv),
  interpolateCohesion: (a, b, t, inv) => interpolateCohesion(a.overlay?.cohesion, b.overlay?.cohesion, t, inv),
  interpolateLiquidField: (a, b, t, inv) =>
    interpolateLiquidField(a.overlay?.liquidField, b.overlay?.liquidField, t, inv),
  interpolateDye: (a, b, t, inv) => interpolateDye(a.overlay?.dye, b.overlay?.dye, t, inv),
  mixSharpnessLevels,
};

/**
 * v8 `34.4` (`34.D14`) — **the three `Sharpness` LEVELS, backfilled from `sharpness` on EACH SIDE before
 * anything is lerped.**
 *
 * ⚠️⚠️ **THIS FUNCTION EXISTS BECAUSE `SCALAR_IDENTITIES`' OWN HEADER FORBIDS THE ALTERNATIVE, AND THE
 * ALTERNATIVE FAILS SILENTLY AT THE WORST POSSIBLE POSITION.** `34.D11` requires
 * `sharpnessStructure ?? sharpness` (never `?? 0`), i.e. **a default that is not the key's identity** — and
 * a scalar law can only substitute an identity. `interpolatePreset` reads the PRESET objects, *before* any
 * adoption, so with `lerp` and identity 0 the crossfader resolves `Quader Faceted` (which carries
 * `sharpness: 1` and neither new key) to **Body 1 / Structure 0 / Detail 0 at t = 0** — de-facetting two
 * thirds of every pre-Phase-34 faceted preset at the position where the Mixer claims to show deck A
 * untouched. **`mixercheck` §C cannot see it: the leaf is written on both sides, so it is neither ADDED nor
 * DESTROYED, only WRONG**, and §C's whole question is add-versus-destroy. `deformcheck` §N is the clause
 * that does see it, measured over the six presets that carry the key.
 *
 * ⚠️ **THE EMISSION IS THE UNION OF WHAT THE TWO DECKS CARRY.** A key neither deck authored stays ABSENT
 * (`23.0`'s hard rule: at `t = 0` the result IS deck A), while a key EITHER deck authored is written for
 * both — resolved through the backfill, so the value written for the side that omitted it is exactly what
 * that side's engine would have resolved anyway. **That is a stronger inertness claim than writing an
 * identity, not a weaker one.**
 *
 * ⚠️⚠️ **IT DOES NOT MAKE AN ADDED LEAF UNREACHABLE, AND THE DESIGN PASS PREDICTED THAT IT WOULD.** Measured:
 * `mixercheck` §C went red on `Interference × Quader Faceted` at `t = 0`, because deck **B** carries
 * `sharpness` and deck A does not. **Carrying the key on either side is what materialises it.** The right
 * admission is therefore a RULE and not an allowlist entry — the inert value for a materialised level is the
 * deck's OWN resolved level, not a constant — and it lives in `mixercheck`'s rule **(3f)**.
 *
 * ⚠️ **`?? 0` for `sharpness` ITSELF is correct and is a different question**: 0 IS that key's identity (the
 * generator branches on it), so a deck that omits it genuinely means *no faceting*. The backfill only
 * answers *what does an absent LEVEL mean*, and the answer is *follow Body*.
 */
function mixSharpnessLevels(
  a: UnifiedPreset, b: UnifiedPreset, t: number, inv: number,
): Partial<OverlayState> {
  const levels = (p: UnifiedPreset): [number, number, number] => {
    const body = p.overlay?.sharpness ?? 0;
    return [body, p.overlay?.sharpnessStructure ?? body, p.overlay?.sharpnessDetail ?? body];
  };
  const la = levels(a), lb = levels(b);
  const KEYS = ['sharpness', 'sharpnessStructure', 'sharpnessDetail'] as const;
  const out: Partial<OverlayState> = {};
  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i]!;
    if (a.overlay?.[key] === undefined && b.overlay?.[key] === undefined) continue;
    out[key] = inv * la[i]! + t * lb[i]!;
  }
  return out;
}

/**
 * The value a scalar law contributes from a side that does not carry the key.
 *
 * ⚠️ **Each of the three is the key's IDENTITY, not merely its default, and the two are not the same claim**:
 * writing 1.0 into a crossfade of two presets that both omit the key must be inert at every reader, which is
 * what makes these three the only members of `UNCONDITIONAL_KEYS`. A scalar law whose default is NOT its
 * identity must not be added here — it belongs in the `snap` column, where an absent key stays absent.
 *
 * `Record<KeysWithLaw<'lerp' | 'geometric'>, number>` is derived from the rule table, so changing a key's law
 * to `lerp` without giving it an identity here does not compile, and an identity for a key that is no longer
 * a scalar law does not either.
 */
const SCALAR_IDENTITIES: Record<KeysWithLaw<'lerp' | 'geometric'>, number> = {
  // v8 Phase 40 — Electric Discharge: each identity IS the engine's `?? default` (`DISCHARGE_DEFAULTS`).
  dischargeIntensity: 1.375,
  dischargeFilament: 1.5,
  dischargeCrackle: 0.875,
  dischargeBranching: 0,
  // v8 Phase 42 — 3-D Symmetry's Radius: the identity IS `SYM3D_DEFAULTS.radius` (centred).
  sym3dRadius: 0,
  speedFactor: 1.0,
  figureScale: 1.0,
  particleSize: 1.0,
  /*
   * v8 `26.4`. ⚠️ **ZERO, AND IT IS AN IDENTITY RATHER THAN A DEFAULT — the distinction this block exists
   * to make.** `paletteHueShift` is an additive angle in turns, so 0 is the value that is inert at every
   * reader: the shaders compute `fract(coord + shift)`, and `fract(coord + 0) === coord`. The other three
   * entries are 1.0 because they are multipliers. **A key whose default is not its identity may not be
   * added here at all** — it belongs in the `snap` column, where an absent key stays absent.
   *
   * ⚠️ **This file is where `tsc` named the new key.** The record is derived from the rule table, so a key
   * given a `lerp` law without an identity here does not compile — which is the whole argument for the
   * shared table, arriving as a compile error in exactly one place.
   */
  paletteHueShift: 0.0,
  /*
   * v8 `30.1`. ⚠️ **ZERO, AND IT IS AN IDENTITY RATHER THAN A DEFAULT — the same distinction, for a third
   * kind of quantity.** A twist is an angle per unit of coordinate, and the operator's own gate is
   * `twX !== 0 || twY !== 0 || twZ !== 0`, which skips the loop entirely: so 0 is not merely the value the
   * control starts at, it is the value at which the code does not run and the positions are untouched. A
   * crossfade of two presets that both omit the three is therefore inert at every reader, which is the
   * condition for membership here.
   *
   * ⚠️ **Three entries rather than one, because `OverlayState` carries three flat scalars rather than a
   * block** (invariant 14, `30.D11`). If they are ever tidied into a `TwistConfig`, this record loses three
   * members and gains a `MigrationLayer` obligation — **do not do the first half without the second.**
   */
  // v8 32 — all eight are CONTINUOUS, so none of them snaps (32.5). Identities: 0 for the six
  // deformers and for `invertAmount`; `invertRadius`'s identity is 1, but it is inert while the
  // amount is 0, so a lerp through it cannot change a figure.
  // ⚠ It read NINE until `invertShell` was removed on 2026-10-26 — re-count from the lines below
  // rather than trusting this sentence.
  taperX: 0.0, taperY: 0.0, taperZ: 0.0,
  bendX: 0.0, bendY: 0.0, bendZ: 0.0,
  invertAmount: 0.0, invertRadius: 1.0,
  /*
   * v8 `33.3`. ⚠️ **AN IDENTITY IN THE STRONG FORM — the value at which the code does not RUN, not merely
   * the value at which it computes something neutral** — which is the condition for membership here.
   *
   * `travel*` 0 is the stage's gate: `applyTravel` tests the triple AND each axis against 0 and skips the
   * add entirely. ⚠️ **Three entries rather than one because `OverlayState` carries three flat scalars**
   * (invariant 14, `33.D7`) — if they are ever tidied into a `TravelConfig`, this record loses three members
   * and gains a `MigrationLayer` obligation. **Do not do the first half without the second.**
   *
   * ⚠️⚠️ **`sharpness` HAS LEFT THIS RECORD AND `tsc` IS WHAT REMOVED IT (v8 `34.D14`).** It is a `custom`
   * key now, so it is not a member of `KeysWithLaw<'lerp' | 'geometric'>` and an entry for it would not
   * compile. **The reason it had to move is THIS RECORD'S OWN HEADER RULE:** `34.D11` requires the two new
   * per-level bases to default to `sharpness` rather than to 0, i.e. a default that is not an identity, and
   * a scalar law cannot express one. See `mixSharpnessLevels`.
   */
  travelX: 0.0, travelY: 0.0, travelZ: 0.0,
  /*
   * v8 `34.4` — `Stretch`: the breathing of `Travel`, per axis (`34.D11`). ⚠️ **0 is an identity in the
   * STRONG form for a reason that is the DEPTH's rather than the base's:** `resolveOp` returns the base
   * unchanged where `depth === 0` — it does not compute `base + sin(x)·0` and clamp the result — so at the
   * written value nothing is evaluated at all. ⚠️ A rate at 0 is additionally read by NOTHING while its
   * depth is 0, which is `invertRadius`'s standing arriving in a second subject.
   */
  travelDepthX: 0.0, travelDepthY: 0.0, travelDepthZ: 0.0,
  travelRateX: 0.0, travelRateY: 0.0, travelRateZ: 0.0,
  /*
   * v8 `34.4` — `Temper`: ONE depth and ONE rate for all three `Sharpness` LEVELS (`34.D11`'s one
   * asymmetry). Same derivation as `Stretch` above. ⚠️ **The two are `lerp` while the three BASES are
   * `custom`** — a `custom` key and a `lerp` key in one operator is not a contradiction here, because the
   * backfill problem is the BASES' alone: a depth's absent-side value genuinely is its identity.
   */
  sharpnessDepth: 0.0, sharpnessRate: 0.0,
  /*
   * v8 `34.2` — `Offset` and `Sway`. ⚠️ **0 is an identity in the STRONG form: `applyOffset` tests each axis
   * and skips the add**, which is `applyTravel`'s arrangement and exists for the same `-0` reason.
   */
  offsetX: 0.0, offsetY: 0.0, offsetZ: 0.0,
  offsetDepthX: 0.0, offsetDepthY: 0.0, offsetDepthZ: 0.0,
  offsetRateX: 0.0, offsetRateY: 0.0, offsetRateZ: 0.0,
  /*
   * v8 `34.3` — `Grow` and `Flare`.
   *
   * ⚠️⚠️ **`0.0`, AND IT IS AN IDENTITY RATHER THAN A DEFAULT — THIS IS THE RECORD WHERE THAT CLAIM IS
   * ACTUALLY MADE, AND `invertRadius: 1.0` SITS A FEW LINES UP AS THE COUNTER-EXAMPLE.** The stored value is
   * the amplitude RAMP COEFFICIENT `k` in `am · (1 + k·τ)`, **not a multiplier**: at `k = 0` the factor is
   * exactly 1 for every particle, so a crossfade of two presets that both omit the key is inert at every
   * reader. **A reader who sees "multiplier" and writes `1.0` here scales the far end of every stroke in the
   * library by 2 and nothing would say so** — `tsc` sees `number`, `OVERLAY_RULES` cannot express an
   * identity, and no preset's exported bytes would change. The full statement is on `GROW_FLOOR` in
   * `core/deform-limits.ts`.
   *
   * ⚠️ The per-axis gate for `grow*` is a COST gate, not a correctness one (the factor is exactly 1 at 0 and
   * `x * 1` preserves `-0`), so these three are admitted on `particleSize`'s standing rather than the
   * twist's — stated here because `UNCONDITIONAL_KEYS` makes the same split and overstating it would licence
   * a future key that only looked similar.
   */
  growX: 0.0, growY: 0.0, growZ: 0.0,
  growDepthX: 0.0, growDepthY: 0.0, growDepthZ: 0.0,
  growRateX: 0.0, growRateY: 0.0, growRateZ: 0.0,
  twistX: 0.0,
  twistY: 0.0,
  twistZ: 0.0,
  /*
   * v8 `30.3`. ⚠️ **ZERO, AND IT IS AN IDENTITY: the operator's own gate is `bias === 0`, which takes the
   * ORIGINAL `i * cStep` expression** rather than evaluating `f` at an identity parameter. So 0 is the
   * value at which the reparameterisation is not merely neutral but absent — the strongest form of the
   * condition for membership here.
   */
  /*
   * v8 `31.2` — the three per-particle channel AMOUNTS. ⚠️ **0 is an identity in the strong form, which is
   * what admits them here at all:** the operator's gate is a three-way test against 0, so at the written
   * value nothing is computed and nothing is published — not merely a multiply by 1 at some reader. ⚠️
   * **`channelDriver` is absent and that is forced, not chosen: it `snap`s**, so it is not a member of
   * `KeysWithLaw<'lerp' | 'geometric'>` and adding it here would not compile.
   */
  channelSize: 0.0,
  channelAlpha: 0.0,
  channelLight: 0.0,
  /*
   * v8 `31.4` — the 4D rotation's extent and its three angles. ⚠️ **`wScale` 0 is an identity in the
   * strong form — it is the stage's gate — and the three ANGLES are identities at 0 for a second,
   * independent reason: a rotation by zero turns is the identity matrix.** Both hold, and only the first
   * is what admits them to `UNCONDITIONAL_KEYS`.
   */
  wScale: 0.0,
  wXW: 0.0,
  wYW: 0.0,
  wZW: 0.0,
};

/**
 * v8 Phase 23.2 — **the ONE owner of a crossfaded `overlay`.**
 *
 * One pass over `OVERLAY_RULES`, which `tsc` holds to `keyof OverlayState`, so the loop reaches **every**
 * declared key and a key with no law does not compile. What replaced the two object literals is this
 * property: the enumeration is the type system's, not a programmer's memory.
 *
 * ⚠️ **EACH KEY ANSWERS TO ITS OWN GROUP'S LOCK AND ITS OWN GROUP'S FADER, AND THAT IS A BEHAVIOUR CHANGE,
 * NOT A REFACTOR.** Before 2026-10-05 a locked `visual` group restored the whole overlay from its snapshot
 * (and, with no snapshot, STRIPPED it — `result.overlay = {}`), so locking the visual category also froze
 * every TransMap and attractor overlay key. Now `transmap` keys follow the `transmap` lock even while
 * `visual` is held. The old coupling was not a feature: it is why a locked `visual` group dropped
 * `overlay.material` entirely (that key appeared in neither literal).
 *
 * ⚠️ **A locked group with NO snapshot emits nothing for its keys** — the one piece of the old
 * `result.overlay = {}` behaviour that is deliberately kept. `lockWithSnapshot()` is the only way a lock is
 * taken through the UI, so a missing snapshot means a caller locked a category without capturing one, and
 * inventing deck A's values for it would be a lock that silently follows a deck.
 *
 * ⚠️ **Reference values are DEEP-COPIED on the way out** (`copyKey`). The literal this replaced spread
 * `dye` shallowly and carried a note that sharing `fixedColour` with the snapshot was "harmless only
 * because nothing mutates a `fixedColour` in place" — a Mixer result is applied as a preset and then edited
 * (I12), so that was one setter away from writing back into a deck.
 */
function buildOverlay(
  a: UnifiedPreset,
  b: UnifiedPreset,
  locks: Set<CategoryLock>,
  lockedValues: Map<CategoryLock, UnifiedPreset>,
  weight: (group: CategoryLock) => { t: number; inv: number },
): OverlayState {
  const out: OverlayState = {};
  // A `custom` owner may own SEVERAL keys (`mixSymmetry` owns two, `mixForceGate` four) and must run once.
  const ownersRun = new Set<CustomMixerId>();

  for (const key of Object.keys(OVERLAY_RULES) as (keyof OverlayState)[]) {
    const rule: OverlayRule = OVERLAY_RULES[key];
    const { t, inv } = weight(rule.group);

    if (locks.has(rule.group)) {
      // ⚠️ `!== undefined`, never truthiness — `palette: 'none'` and `transMapWarpMix: 0` are real authored
      // values, and `''` (`PALETTE_UNSET`) is what the SELECT uses for "not overridden". `copyKey` owns that
      // test so the forty-six keys cannot drift apart from one another.
      const held = lockedValues.get(rule.group)?.overlay;
      if (held) copyKey(out, held, key);
      continue;
    }

    switch (rule.law.kind) {
      /**
       * ⚠️ **`bundle` IS OPERATIONALLY IDENTICAL TO `snap` — *as long as a bundle's members share a group* —
       * AND THAT INVARIANT IS THE WHOLE VALUE OF THE `id`.** Per-group snapping already resolves one winning
       * side per group, so every member of a same-group bundle comes from that side by construction. Split a
       * bundle across two groups and the two halves resolve from two winners: deck A's `Cycle: Ember` under
       * deck B's `index` mapping, or `customFilmLookParams` belonging to a film look the result does not
       * name. `mixercheck` §B is what keeps the members in one group; do not "simplify" the ids away.
       *
       * v8 Step 21.4c's palette pair and 23.D2's grade trio are the two bundles. ⚠️ **`undefined` is not
       * `'none'`**: absent `palette` means "inherit the film look's palette", so the winner's ABSENCE has to
       * leave the key out rather than write a value — which is what makes this an emission test per key
       * under one winner, rather than a wholesale copy of the winner's bundle.
       */
      case 'snap':
      case 'bundle': {
        const winner = (t < 0.5 ? a : b).overlay;
        if (winner) copyKey(out, winner, key);
        break;
      }

      /**
       * The two scalar laws. ⚠️ **The cast is sound BECAUSE of the table, and `mixercheck` §B is the
       * independent check** — `tsc` cannot correlate `rule.law.kind` with `key` (they are two properties of
       * one object, not a discriminated pair), so the loop asserts what the `Record` above already proved:
       * a key reaching this branch has an identity.
       *
       * `lerp` is endpoint-EXACT (`1 * x + 0 * y` is `x`). ⚠️ **`geometric` is exact only to float
       * rounding** — `exp(ln v)` is not always `v` — which is why `mixercheck` §C compares numbers with a
       * tolerance and prints how many leaves needed it, rather than demanding bit equality and being
       * quietly adjusted until it passes.
       *
       * The `1e-3` floor is `particleSize`'s, derived below at `interpolateWaves`' neighbour: `ln(0)` is
       * `-Inf`, the setter clamps to `PARTICLE_SIZE_MIN`, and a hand-edited import is not obliged to.
       */
      case 'lerp':
      case 'geometric': {
        const scalarKey = key as KeysWithLaw<'lerp' | 'geometric'>;
        const identity = SCALAR_IDENTITIES[scalarKey];
        /*
         * ⚠️ **BOTH SIDES ABSENT MEANS THE KEY STAYS ABSENT — added 2026-10-06 for v8 `26.4`, and
         * `mixercheck` §C caught its absence on the first run.** Writing the identity unconditionally added
         * `overlay.paletteHueShift: 0` to **1096 of 1096** endpoint comparisons, where neither deck had
         * authored it — an ADDED leaf at a crossfade's own endpoint, which is exactly what Phase 23's hard
         * assertion forbids: **at `t = 0` the result IS deck A, byte for byte.**
         *
         * ⚠️ **THE THREE OLDER SCALAR KEYS DO NOT NEED THIS GUARD AND MUST NOT GET IT**: `speedFactor`,
         * `figureScale` and `particleSize` are the whole of `UNCONDITIONAL_KEYS`, i.e. keys the engine reads
         * whether or not a preset carries them, so emitting their identity is a no-op the oracle justifies.
         * **Being inert at every reader is NOT the same claim as being expected in the output**, and that
         * distinction is what this guard turns on.
         */
        if (a.overlay?.[scalarKey] === undefined && b.overlay?.[scalarKey] === undefined
          && !(UNCONDITIONAL_KEYS as readonly string[]).includes(scalarKey)) break;
        const va = a.overlay?.[scalarKey] ?? identity;
        const vb = b.overlay?.[scalarKey] ?? identity;
        setScalar(
          out,
          scalarKey,
          rule.law.kind === 'lerp'
            ? inv * va + t * vb
            : Math.exp(inv * Math.log(Math.max(1e-3, va)) + t * Math.log(Math.max(1e-3, vb))),
        );
        break;
      }

      case 'custom': {
        if (ownersRun.has(rule.law.owner)) break;
        ownersRun.add(rule.law.owner);
        Object.assign(out, CUSTOM_MIXERS[rule.law.owner](a, b, t, inv));
        break;
      }
    }
  }

  return out;
}

/**
 * Copy one key from one overlay to another, deep for a reference value, and ⚠️ **only when the source
 * actually has it** — `!== undefined`, never truthiness, for the reason given at the locked branch above.
 */
function copyKey<K extends keyof OverlayState>(out: OverlayState, src: OverlayState, key: K): void {
  const v = src[key];
  if (v === undefined) return;
  out[key] = (typeof v === 'object' && v !== null ? deepCopy(v) : v) as OverlayState[K];
}

/** Narrow write for the scalar laws; keeps the single necessary cast in `buildOverlay` down to the KEY. */
function setScalar(out: OverlayState, key: KeysWithLaw<'lerp' | 'geometric'>, value: number): void {
  out[key] = value;
}

/**
 * Curl noise: linear interpolation for numeric params, snap `enabled` at t=0.5 (invariant 16 — a crossfade
 * cannot half-enable a field).
 *
 * ⚠️ **Emitted unconditionally**, from the engine's own defaults when a side omits the block, which is why
 * it is one of the four `UNCONDITIONAL_KEYS`: `enabled: false` with `turbulence: 0` is inert at every reader.
 */
function mixCurlNoise(a: UnifiedPreset, b: UnifiedPreset, t: number, inv: number): Partial<OverlayState> {
  const curlA = a.overlay?.curlNoise ?? { enabled: false, turbulence: 0, scale: 1.0, evolutionSpeed: 0.5 };
  const curlB = b.overlay?.curlNoise ?? { enabled: false, turbulence: 0, scale: 1.0, evolutionSpeed: 0.5 };
  return {
    curlNoise: {
      enabled: t < 0.5 ? curlA.enabled : curlB.enabled,
      turbulence: inv * curlA.turbulence + t * curlB.turbulence,
      scale: inv * curlA.scale + t * curlB.scale,
      evolutionSpeed: inv * curlA.evolutionSpeed + t * curlB.evolutionSpeed,
    },
  };
}

/**
 * E30 symmetry: SNAPPED at t=0.5, never interpolated — the same treatment as `renderer.mode` and
 * `curlNoise.enabled`.
 *
 * ⚠️ The fold order is a small INTEGER naming a point group, so intermediate values are not blends:
 * crossfading 3-fold to 6-fold through 4.5 would fold the figure into sectors whose arms do not close, i.e. a
 * broken figure rather than a stage between two whole ones. Rounding a lerp is no better — it would still
 * pass through 4 and 5, showing two rosettes the user never asked for. `symmetryMirror` follows whichever
 * side won, because the mirror flag is meaningless apart from the fold it applies to.
 *
 * Emitted only when the winning side actually folds. Fold 1 is the identity, so writing it would put an inert
 * key into every crossfade result — and `symmetryMirror` has no meaning without a fold, hence one condition
 * rather than two. ⚠️ **That value gate is why the pair is a `custom` law and not a two-member `bundle`.**
 */
function mixSymmetry(a: UnifiedPreset, b: UnifiedPreset, t: number): Partial<OverlayState> {
  const symWinner = t < 0.5 ? a : b;
  const symFold = symWinner.overlay?.symmetryFold ?? 1;
  const symMirror = symWinner.overlay?.symmetryMirror ?? true;
  return symFold > 1 ? { symmetryFold: symFold, symmetryMirror: symMirror } : {};
}

/**
 * TransMap LAYER CHAIN — **snapped at t=0.5, never interpolated** (invariant 16).
 *
 * ⚠️ **Resolved under the `transmap` group, not `visual`** — it is TransMap state, and a locked TransMap must
 * hold its chain while the visual group keeps crossfading. Before Phase 23.2 that was a hand-written gate on
 * a block sitting outside the `visual` branch; it is now the `group` column of its rule.
 *
 * There is nothing here to interpolate in either half. The chain's ORDER is categorical (`echoRunsFirst` is a
 * boolean, and field-layer order is a mathematical no-op), its MEMBERSHIP is a set of discrete styles, and a
 * per-layer WEIGHT cannot be crossfaded against a chain that has no such layer — the missing side is not
 * "weight 0", it is a different pipeline with a different pass count. A blend of {0,5} and {4} would have to
 * invent a three-layer chain neither deck asked for, which is the same reason `ifsParams` and `symmetryFold`
 * snap rather than lerp.
 *
 * Emitted ONLY when the winning side has one, so a crossfade between two ordinary presets — which is every
 * pair in the shipped library — produces no `transMapChain` key at all, and the result stays byte-identical
 * to what it was before chains existed. Deep-copied: a Mixer result is applied as a preset, and sharing layer
 * objects with a deck would let a later chain edit mutate the deck (I12).
 */
function mixTransMapChain(a: UnifiedPreset, b: UnifiedPreset, t: number): Partial<OverlayState> {
  const chainWinner = t < 0.5 ? a : b;
  if (!chainWinner.overlay?.transMapChain) return {};
  const chain = deepCopy(chainWinner.overlay.transMapChain);
  blendLayerBlocks(chain, a.overlay?.transMapChain, b.overlay?.transMapChain, t);
  return { transMapChain: chain };
}

/**
 * Dispersion INTERPOLATES rather than snapping — unlike everything else in the TransMap group. It is a plain
 * continuous scalar with a meaningful zero on both sides (absent === 0 === no fringing), so unlike a
 * per-layer weight there is no "different pipeline" on the missing side to invent: fading a deck with
 * dispersion 0.3 against one without it is exactly a fade to no fringing.
 *
 * Emitted only when the result is nonzero, so a crossfade between two ordinary presets adds no key — ⚠️ which
 * is why it is a `custom` law rather than a `lerp`: a `lerp` writes its identity unconditionally, and 0 would
 * be an inert key in every result. ⚠️ Note its sibling `transMapWarpMix` is NOT interpolated but SNAPPED, and
 * that is not an inconsistency: its engine default is **1.0**, i.e. absent means FULL warp, so "absent is
 * zero" — the one fact this function rests on — is false for it.
 */
function mixDispersion(a: UnifiedPreset, b: UnifiedPreset, t: number): Partial<OverlayState> {
  const da = a.overlay?.transMapDispersion ?? 0;
  const db = b.overlay?.transMapDispersion ?? 0;
  const disp = da + (db - da) * t;
  return disp > 0 ? { transMapDispersion: disp } : {};
}

/**
 * PASS ORDER (Step 14.6) — **snapped at t=0.5** (invariant 16), like `renderer.mode` and `symmetryFold`.
 *
 * It is a permutation of three GPU passes, not a quantity: there is no frame in which the warp half-runs
 * before the draw, and a lerp of the boolean would silently mean `false` — i.e. a crossfade from a warp-first
 * deck would jump to warp-last at t=0.0001 rather than at the midpoint.
 *
 * ⚠️ Resolved overlay-first on BOTH sides before snapping, so the winner is the order that deck actually
 * renders with (invariant 17) — the reason this owner takes whole presets. The `postProcessors` half snaps in
 * the `transmap` block of `interpolatePreset`, in the SAME group (the twin rule): resolved from two winners
 * the mix would render with one deck's order at every t, because the overlay wins at every reader.
 *
 * Emitted only when true, for the same reason `main.ts` gates its export: `false` is the default and the
 * value every shipped preset carries, so an ordinary pair produces no key.
 */
function mixPassOrder(a: UnifiedPreset, b: UnifiedPreset, t: number): Partial<OverlayState> {
  const orderWinner = t < 0.5 ? a : b;
  const order = orderWinner.overlay?.transMapBeforeParticles
    ?? orderWinner.postProcessors.transMap.beforeParticles;
  return order ? { transMapBeforeParticles: true } : {};
}

/**
 * FORCE GATE (Step 14.4) — the source and the invert flag SNAP, the two scalars INTERPOLATE.
 *
 * ⚠️ **`transMapForceGateBy` is categorical** (invariant 16, the `renderer.mode` / `symmetryFold` / `pattern`
 * case): there is no halfway attribute between gating by age and gating by depth, and a lerp between two
 * `ForceGateSource` strings is not even expressible. `transMapForceGateInvert` is the same — a boolean whose
 * midpoint would silently mean `false`.
 *
 * `transMapForceGateAmount` interpolates for the dispersion reason above: absent === 0 === ungated is a real
 * neutral on the missing side, so fading a gated deck against an ungated one is exactly a fade to ungated.
 * `transMapForceGateHalfLife` interpolates too, but only within the SNAPPED source — a half-life is
 * meaningless unless the winner is `'age'`, and blending toward a side that gates by depth would crossfade a
 * number nothing reads.
 *
 * ⚠️ **All four keys are emitted only when the winner actually gates**, so a crossfade between two ordinary
 * presets — every pair in the shipped library, none of which carries a gate — adds no key and the result
 * stays byte-identical to what the Mixer produced before this step. ⚠️ **One owner for the four, because the
 * gate is one decision**: three of them are unread unless the fourth says the gate is on, which is the
 * `bundle` argument made in a case where the members also need value gates.
 *
 * ⚠️ A LOCKED `transmap` group restores all four from the snapshot with a plain `!== undefined` test, in
 * `buildOverlay`'s locked branch — including the two this function omits when neutral. The locked snapshot is
 * the authority on what the deck held, so dropping a held `transMapForceGateHalfLife` because the source is
 * not `'age'` would EDIT the held state rather than hold it.
 */
function mixForceGate(a: UnifiedPreset, b: UnifiedPreset, t: number): Partial<OverlayState> {
  const gateWinner = t < 0.5 ? a : b;
  const gateBy = gateWinner.overlay?.transMapForceGateBy ?? 'none';
  if (gateBy === 'none') return {};
  const ga = a.overlay?.transMapForceGateAmount ?? 0;
  const gb = b.overlay?.transMapForceGateAmount ?? 0;
  const amount = ga + (gb - ga) * t;
  if (amount <= 0) return {};
  const out: Partial<OverlayState> = { transMapForceGateBy: gateBy, transMapForceGateAmount: amount };
  if (gateWinner.overlay?.transMapForceGateInvert) out.transMapForceGateInvert = true;
  if (gateBy === 'age') {
    // Only the `'age'` source reads this. Defaulted on BOTH sides to the engine's own 2.0 so a deck that
    // omits the key (the common case) contributes its default rather than a 0 that would make the gate
    // collapse to zero at any nonzero age.
    const ha = a.overlay?.transMapForceGateHalfLife ?? 2.0;
    const hb = b.overlay?.transMapForceGateHalfLife ?? 2.0;
    const half = ha + (hb - ha) * t;
    if (half !== 2.0) out.transMapForceGateHalfLife = half;
  }
  return out;
}

/**
 * Crossfade the CONTINUOUS half of every per-layer block, in place on the already-snapped chain.
 *
 * ⚠️ **This is the one part of a chain blend that is not categorical, and the split is the point.**
 * `pattern`/`pattern2` are archetype NAMES and `shape`/`shape2` are wave bases — snapped with the chain
 * above, per invariant 16, exactly like `renderer.mode` and `symmetryFold`; there is no halfway shape
 * between `Grid Lattice` and `Fine Mesh`, and none between a sine and a square.
 * `strength`/`strength2`/`detail`/`drift`/`zoomBias`/`shapeMix`/`shapeMix2` are scalars with a continuous
 * visual meaning, so holding them categorical too would make a Mixer sweep across two tuned static layers
 * jump at t=0.5 instead of crossfading — the effect the Mixer exists to provide. `refraction.invert` and
 * `refraction.source` are the same categorical case as `pattern` and snap with the chain.
 *
 * ⚠️ **Only layers present on BOTH sides are blended, matched by STYLE.** A layer the other deck lacks has
 * no counterpart to blend toward, and treating the missing side as zero would fade a field out on its way to
 * a deck that never asked for that — the same reason a per-layer weight is not crossfaded against a chain
 * without that layer. Those layers keep the winner's values verbatim.
 *
 * ⚠️ **Was `blendStaticFields`, and its `layer.style > 3` skip was a SIXTH implicit style enumeration.** It
 * predates styles 7 and 9 and would have silently excluded them — a Mixer sweep between two refraction-tuned
 * decks would jump at t=0.5 while every neighbouring control crossfaded, which reads as a Mixer bug rather
 * than as a missing case. It is now keyed on which BLOCK a layer carries, so a new block joins by being
 * handled here rather than by a range test happening to include its number.
 *
 * Mutates `chain`, which is already a `deepCopy` of the winner (never a deck's live array — I12).
 */
function blendLayerBlocks(
  chain: NonNullable<OverlayState['transMapChain']>,
  aChain: OverlayState['transMapChain'],
  bChain: OverlayState['transMapChain'],
  t: number,
): void {
  if (!aChain || !bChain) return;
  const inv = 1 - t;
  const mix = (x: number | undefined, y: number | undefined, dflt: number): number =>
    inv * (x ?? dflt) + t * (y ?? dflt);
  for (const layer of chain) {
    const la = aChain.find(l => l.style === layer.style);
    const lb = bChain.find(l => l.style === layer.style);
    if (!la || !lb) continue;

    // Both sides must carry a block. An absent one means "the defaults", and blending toward a default is
    // not the same as blending toward a value the other deck chose — a layer with no block is expressing no
    // opinion, so the winner's stays. Each block is tested independently: a style-7 layer never has a
    // `staticField` and a style-0 layer never has a `refraction`, so the guards are the type check.
    const sa = la.staticField, sb = lb.staticField;
    if (sa && sb) {
      const d = STATIC_FIELD_DEFAULTS;
      layer.staticField = {
        // Snapped with the chain — see the header. Read off the CURRENT layer, which already holds the
        // winner's, rather than re-deriving the t<0.5 test in a second place (I9).
        pattern: layer.staticField?.pattern ?? d.pattern,
        pattern2: layer.staticField?.pattern2 ?? d.pattern2,
        // ⚠️ **The two SHAPES are CATEGORICAL and snap with the chain exactly as `pattern` does** (invariant
        // 16): there is no halfway basis between a sine and a square, and `shapeFn`'s dispatch has no
        // intermediate to return. ⚠️ **The two MIXES lerp**, and that is what makes the snap invisible when
        // it matters — a Mixer pair authored so `shapeMix` dips toward 0 at the midpoint snaps the shape
        // where nothing can see it. **That pair is the acceptance test for this law and cannot be checked
        // from a still.**
        //
        // ⚠️⚠️ **A LEAF OMITTED FROM THIS OBJECT LITERAL IS DESTROYED, NOT MERELY UN-INTERPOLATED** — the
        // literal REPLACES `layer.staticField` wholesale, and `tsc` cannot see the omission because
        // `StaticFieldConfig` is all-optional. `shapecheck` §G is the instrument.
        shape: layer.staticField?.shape ?? d.shape,
        shape2: layer.staticField?.shape2 ?? d.shape2,
        strength: mix(sa.strength, sb.strength, d.strength),
        strength2: mix(sa.strength2, sb.strength2, d.strength2),
        detail: mix(sa.detail, sb.detail, d.detail),
        drift: mix(sa.drift, sb.drift, d.drift),
        zoomBias: mix(sa.zoomBias, sb.zoomBias, d.zoomBias),
        shapeMix: mix(sa.shapeMix, sb.shapeMix, d.shapeMix),
        shapeMix2: mix(sa.shapeMix2, sb.shapeMix2, d.shapeMix2),
        // ⚠️ **The four ANGLES are CONTINUOUS and LERP — the opposite of the two shapes one line above, and
        // the asymmetry is the whole content of this block's law.** An angle has a halfway value and the
        // index arithmetic is defined at it; a basis function does not.
        //
        // ⚠️⚠️ **A PLAIN `mix()` IS CORRECT HERE ONLY BECAUSE THE RANGE IS ±90 AND HAS NO WRAP** (see
        // `WAVE_ANGLE_MAX`). On a 0–360 track a lerp from 350° to 10° sweeps the long way round, which is
        // why `interpolatePose` SNAPS the Composer's rotation instead — *"a pose is three ANGLES in degrees
        // and the axes are not independent of one another."* These four are independent and unwrapped, so
        // the shortest path IS the lerp. **Widening the range to 0–360 would silently break this line**, and
        // that is one of the two reasons the range is what it is.
        angleX: mix(sa.angleX, sb.angleX, d.angleX),
        angleY: mix(sa.angleY, sb.angleY, d.angleY),
        angleX2: mix(sa.angleX2, sb.angleX2, d.angleX2),
        angleY2: mix(sa.angleY2, sb.angleY2, d.angleY2),
      };
    }

    const ra = la.refraction, rb = lb.refraction;
    if (ra && rb) {
      const d = REFRACTION_DEFAULTS;
      layer.refraction = {
        strength: mix(ra.strength, rb.strength, d.strength),
        reach: mix(ra.reach, rb.reach, d.reach),
        // Categorical, exactly like `pattern`: there is no halfway between a bulge and a pinch, and no
        // halfway between coverage and brightness as a height source.
        invert: layer.refraction?.invert ?? d.invert,
        source: layer.refraction?.source ?? d.source,
      };
    }

    const ba = la.bandSplit, bb = lb.bandSplit;
    if (ba && bb) {
      const d = BAND_SPLIT_DEFAULTS;
      layer.bandSplit = {
        amount: mix(ba.amount, bb.amount, d.amount),
        radius: mix(ba.radius, bb.radius, d.radius),
      };
    }

    const ta = la.timeWarp, tb = lb.timeWarp;
    if (ta && tb) {
      const d = TIME_WARP_DEFAULTS;
      layer.timeWarp = {
        amount: mix(ta.amount, tb.amount, d.amount),
        // Categorical: `field` and `density` are different QUANTITIES, not two ends of a scale, so there is no
        // halfway reading. Snapped with the chain, exactly like `pattern` and `refraction.source`.
        source: layer.timeWarp?.source ?? d.source,
      };
    }

    const va = la.vortex, vb = lb.vortex;
    if (va && vb) {
      const d = VORTEX_DEFAULTS;
      // ⚠️ **`centre` is a nested OBJECT, so it needs its two scalars mixed componentwise** — the only block
      // here that is not flat. `mix(va.centre, ...)` would be a type error, but `layer.vortex = {...va}` would
      // not be: it would silently keep the winner's eye while swirl and radius crossfaded, so the vortex would
      // JUMP across the frame at t=0.5 while its strength swept smoothly. Both sides' centres resolve through
      // the same `?? d.centre` the accessor uses.
      const ca = va.centre ?? d.centre, cb = vb.centre ?? d.centre;
      layer.vortex = {
        swirl: mix(va.swirl, vb.swirl, d.swirl),
        radius: mix(va.radius, vb.radius, d.radius),
        centre: { x: inv * ca.x + t * cb.x, y: inv * ca.y + t * cb.y },
        // Categorical: gaussian and inverse are different functions, and a blend of the two is neither.
        falloff: layer.vortex?.falloff ?? d.falloff,
      };
    }

    const pa = la.parallax, pb = lb.parallax;
    if (pa && pb) {
      const d = PARALLAX_DEFAULTS;
      layer.parallax = {
        amount: mix(pa.amount, pb.amount, d.amount),
        nearScale: mix(pa.nearScale, pb.nearScale, d.nearScale),
        farScale: mix(pa.farScale, pb.farScale, d.farScale),
        // Categorical: `squared` is a different mapping, not a larger `linear`.
        curve: layer.parallax?.curve ?? d.curve,
        // ⚠️ Categorical, and the strongest case of it in this function: the three modes decide WHAT THE DEPTH
        // SCALE MEANS, so there is no reading in which 'figure' is halfway to 'manual'. Snapped with the chain
        // (invariant 16). ⚠️ The manual band is mixed ANYWAY, even though it is only read in 'manual' mode —
        // an unmixed pair would jump the instant the mode snapped at t=0.5, which is the same defect the vortex
        // `centre` comment above describes, and equally invisible until a deck actually authors a manual band.
        depthRange: layer.parallax?.depthRange ?? d.depthRange,
        rangeFrom: mix(pa.rangeFrom, pb.rangeFrom, d.rangeFrom),
        rangeTo: mix(pa.rangeTo, pb.rangeTo, d.rangeTo),
      };
    }
  }
}

function lerpArr(a: number[], b: number[], t: number): number[] {
  const len = Math.max(a.length, b.length);
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    result.push(va + (vb - va) * t);
  }
  return result;
}

function interpolateWaves(a: UnifiedPreset['generators']['waves'], b: UnifiedPreset['generators']['waves'], t: number): UnifiedPreset['generators']['waves'] {
  const len = Math.max(a.length, b.length);
  const result: UnifiedPreset['generators']['waves'] = [];
  const inv = 1 - t;

  for (let w = 0; w < len; w++) {
    const wa = a[w];
    const wb = b[w];
    if (!wa && !wb) continue;
    const defaultAxis = { phase: 0, am: { base: 0, amplitude: 0, frequency: 0 }, fm: { base: 0, amplitude: 0, frequency: 0 } };
    const defaultWave = { speed: 0.05, axes: [defaultAxis, defaultAxis, defaultAxis] as [typeof defaultAxis, typeof defaultAxis, typeof defaultAxis] };
    const src = wa ?? defaultWave;
    const dst = wb ?? defaultWave;

    result.push({
      speed: inv * src.speed + t * dst.speed,
      axes: [
        lerpAxis(src.axes[0], dst.axes[0], t),
        lerpAxis(src.axes[1], dst.axes[1], t),
        lerpAxis(src.axes[2], dst.axes[2], t),
      ],
    });
  }
  return result;
}

function lerpAxis(
  a: { phase: number; am: { base: number; amplitude: number; frequency: number }; fm: { base: number; amplitude: number; frequency: number } },
  b: { phase: number; am: { base: number; amplitude: number; frequency: number }; fm: { base: number; amplitude: number; frequency: number } },
  t: number,
) {
  const inv = 1 - t;
  return {
    phase: inv * a.phase + t * b.phase,
    am: {
      base: inv * a.am.base + t * b.am.base,
      amplitude: inv * a.am.amplitude + t * b.am.amplitude,
      frequency: inv * a.am.frequency + t * b.am.frequency,
    },
    fm: {
      base: inv * a.fm.base + t * b.fm.base,
      amplitude: inv * a.fm.amplitude + t * b.fm.amplitude,
      frequency: inv * a.fm.frequency + t * b.fm.frequency,
    },
  };
}

function lerpSinMagic(a: SinMagicParams, b: SinMagicParams, t: number): SinMagicParams {
  const inv = 1 - t;
  return [
    [inv * a[0][0] + t * b[0][0], inv * a[0][1] + t * b[0][1], inv * a[0][2] + t * b[0][2], inv * a[0][3] + t * b[0][3]],
    [inv * a[1][0] + t * b[1][0], inv * a[1][1] + t * b[1][1], inv * a[1][2] + t * b[1][2], inv * a[1][3] + t * b[1][3]],
    [inv * a[2][0] + t * b[2][0], inv * a[2][1] + t * b[2][1], inv * a[2][2] + t * b[2][2], inv * a[2][3] + t * b[2][3]],
    [inv * a[3][0] + t * b[3][0], inv * a[3][1] + t * b[3][1], inv * a[3][2] + t * b[3][2], inv * a[3][3] + t * b[3][3]],
  ];
}

/**
 * v8 Step 15.1 — crossfade the liquid surface.
 *
 * ⚠️ **`tintSource` AND `surfaceRamp` ARE CATEGORICAL AND MUST SNAP AT t=0.5** (invariant 16). A lerp
 * between two ramp names is not a ramp, and a lerp between `'preset'` and `'palette'` is not a source — the
 * same reason `renderer.mode`, `curlNoise.enabled` and `material.colourRamp` snap. The three scalars lerp.
 *
 * ⚠️ **Absent on ONE side is not "interpolate from the default", it is "keep the side that has it"**.
 * `liquid` is emitted only by a preset in the liquid render mode, so a crossfade between a liquid preset and
 * any ordinary one is exactly the asymmetric case, and lerping toward `DEFAULT_LIQUID_CONFIG` would drag Iso
 * Level toward a value neither side authored.
 *
 * ⚠️ **`interpolateMaterial` used to share this branch shape and NO LONGER DOES (Phase 23.2, 2026-10-05) —
 * do not re-unify them.** Adopting the present side's block whole at every `t` leaves it in the result at the
 * OTHER deck's endpoint; that is harmless here, because `renderMode` snaps in this same group and a liquid
 * block is read by nothing outside the `liquid` mode, and it was not harmless there, because a live material
 * re-resolves the mode itself. The reasoning is written out in full at that function — **the inertness
 * argument is about who READS the block, never about the block's own values.**
 */
function interpolateLiquid(
  a: LiquidSurfaceConfig | undefined,
  b: LiquidSurfaceConfig | undefined,
  t: number,
  inv: number,
): { liquid?: LiquidSurfaceConfig } {
  if (!a && !b) return {};
  if (!a) return { liquid: { ...b! } };
  if (!b) return { liquid: { ...a } };
  return {
    liquid: {
      // Geometric on Iso Level, because it is a RATIO on a log track: the arithmetic midpoint of 0.125 and 2
      // is 1.06, which is visually most of the way to 2, while the geometric one is 0.5 — the midpoint of the
      // slider the user set them with. Same argument `particleSize` makes above.
      isoLevel: Math.exp(inv * Math.log(Math.max(a.isoLevel, 1e-6)) + t * Math.log(Math.max(b.isoLevel, 1e-6))),
      kernelWidth: Math.exp(inv * Math.log(Math.max(a.kernelWidth, 1e-6)) + t * Math.log(Math.max(b.kernelWidth, 1e-6))),
      edgeSoftness: inv * a.edgeSoftness + t * b.edgeSoftness,
      tintSource: t < 0.5 ? a.tintSource : b.tintSource,
      surfaceRamp: t < 0.5 ? a.surfaceRamp : b.surfaceRamp,
      // v8 Step 15.2. `colourMix` is a plain 0..1 WEIGHT, not a ratio on a log track, so it lerps LINEARLY —
      // unlike the two above. ⚠️ `mixModel` is CATEGORICAL and snaps (invariant 16): 'light' and 'pigment'
      // are different arithmetic, and a lerp between them would be a third model no preset authored.
      colourMix: inv * a.colourMix + t * b.colourMix,
      mixModel: t < 0.5 ? a.mixModel : b.mixModel,
      // v8 Step 15.3. All four LINEAR, and the reason is the same one that split 15.2's pair: a GEOMETRIC lerp
      // is right for a ratio spanning octaves on a log track (Iso Level, Kernel Width) and wrong for a plain
      // magnitude, because it cannot reach **0** — which is each of these four controls' neutral value and the
      // one every preset that omits the term relies on. ⚠️ **Do not generalise "liquid fields interpolate
      // geometrically" from the first two.**
      refraction: inv * a.refraction + t * b.refraction,
      specular: inv * a.specular + t * b.specular,
      thickness: inv * a.thickness + t * b.thickness,
      edgeBrightness: inv * a.edgeBrightness + t * b.edgeBrightness,
    },
  };
}

/**
 * v8 Step 15.4 — crossfade cohesion.
 *
 * ⚠️ **THE ASYMMETRIC CASE IS HANDLED THE OPPOSITE WAY FROM `interpolateLiquid`, AND THAT IS THE WHOLE POINT
 * OF THIS FUNCTION EXISTING RATHER THAN REUSING THAT SHAPE.** `liquid` carries it: an absent block there means
 * "this preset is not in the liquid mode, so its surface parameters are undefined", and lerping toward a
 * default would drag Iso Level to a value neither side authored. An absent `cohesion` block means something
 * completely different and far more specific — `main.ts` emits it **only when `strength > 0`**, so absent is
 * the exact, authored, known value **`strength: 0` (no beading)**. Carrying the present side wholesale would
 * therefore leave the figure fully beaded at t = 1 on a preset the user can see is not beaded, which reads as
 * the crossfade failing to finish.
 *
 * So `strength` **lerps toward 0** across a one-sided crossfade, while `radius` and `returnForce` are CARRIED
 * from the side that has them: those two genuinely are undefined on the other side (they describe a beading
 * that is not happening), and at `strength` 0 they are unread anyway — carrying them keeps the drop size
 * steady while the beading fades, where lerping them toward `DEFAULT_COHESION_CONFIG` would resize the drops
 * on the way out.
 *
 * All three fields lerp **LINEARLY** when both sides are present. `radius` is in pixels on a log track, which
 * is the shape that argues for a geometric lerp — but its range is only 4 octaves and, unlike Iso Level, its
 * two ends are not a ratio against a measured reference; 15.3's rule applies instead: **0 is `strength`'s
 * neutral value and a geometric lerp cannot reach it.** Keeping all three linear also keeps the one-sided case
 * above consistent with the two-sided one.
 */
function interpolateCohesion(
  a: CohesionConfig | undefined,
  b: CohesionConfig | undefined,
  t: number,
  inv: number,
): { cohesion?: CohesionConfig } {
  if (!a && !b) return {};
  // One-sided: fade the STRENGTH out, carry the geometry. Emitted even at a strength that has reached 0,
  // because a mid-crossfade result is live state, not an export — `main.ts`'s own `strength > 0` gate is what
  // keeps a zero out of a saved file.
  if (!a) return { cohesion: { strength: t * b!.strength, radius: b!.radius, returnForce: b!.returnForce } };
  if (!b) return { cohesion: { strength: inv * a.strength, radius: a.radius, returnForce: a.returnForce } };
  return {
    cohesion: {
      strength: inv * a.strength + t * b.strength,
      radius: inv * a.radius + t * b.radius,
      returnForce: inv * a.returnForce + t * b.returnForce,
    },
  };
}

/**
 * v8 Step 15.5 — crossfade the liquid FIELD pool.
 *
 * ⚠️ **THE ASYMMETRIC SIDE SPLITS THREE WAYS ACROSS FIVE FIELDS, WHICH IS NEITHER `interpolateLiquid`'s
 * WHOLESALE CARRY NOR `interpolateCohesion`'s SINGLE GATE — the block has TWO categorical fields and only one
 * of them is a gate.** `main.ts` emits it only when `enabled && poolSize > 0`, so an absent block is the
 * authored, known state "no pool", exactly as an absent `cohesion` block is `strength: 0`.
 *
 * - `enabled` **SNAPS at t = 0.5** (invariant 16) and is not lerped even one-sidedly: it decides whether the
 *   pool's particles are PUBLISHED at all (`lissajous.ts`'s gate), so it has no meaningful intermediate — a
 *   crossfade cannot half-create a particle. The pool therefore appears or vanishes at the midpoint.
 * - `fieldCoupling` **lerps toward 0** on the missing side, which is what makes that appearance/disappearance
 *   read as a fade rather than a cut: at coupling 0 the pool is still drawn but stands still at its seed
 *   positions, so the visible *motion* ramps in and out continuously across the whole crossfade while the
 *   discrete publication flips once. It is the one field with a neutral value here.
 * - `poolSize`, `seedPattern` and `fieldDecay` are **CARRIED** from whichever side has them. All three are
 *   properties of a pool that is fading out; ⚠️ **`poolSize` in particular must NOT lerp toward 0**, because
 *   `LiquidPool.ensure()` reseeds only the appended range `[count, size)` and a shrinking size would make the
 *   pool drop particles from its tail every frame of the crossfade — a visible thinning from one end of the
 *   Halton sequence, which reads as the seed pattern being wrong.
 *
 * When both sides are present the three scalars lerp **LINEARLY** and the two categoricals snap.
 * ⚠️ **`fieldDecay` is linear despite living on a 0.95–0.999 track** — that is a narrow band near 1, not a
 * ratio spanning octaves, and a geometric lerp between 0.95 and 0.999 differs from the arithmetic one in the
 * fourth decimal. 15.3's rule, not Iso Level's.
 */
function interpolateLiquidField(
  a: LiquidFieldConfig | undefined,
  b: LiquidFieldConfig | undefined,
  t: number,
  inv: number,
): { liquidField?: LiquidFieldConfig } {
  if (!a && !b) return {};
  if (!a) {
    return {
      liquidField: {
        enabled: t >= 0.5 ? b!.enabled : false,
        poolSize: b!.poolSize,
        seedPattern: b!.seedPattern,
        fieldCoupling: t * b!.fieldCoupling,
        fieldDecay: b!.fieldDecay,
      },
    };
  }
  if (!b) {
    return {
      liquidField: {
        enabled: t < 0.5 ? a.enabled : false,
        poolSize: a.poolSize,
        seedPattern: a.seedPattern,
        fieldCoupling: inv * a.fieldCoupling,
        fieldDecay: a.fieldDecay,
      },
    };
  }
  return {
    liquidField: {
      enabled: t < 0.5 ? a.enabled : b.enabled,
      poolSize: Math.round(inv * a.poolSize + t * b.poolSize),
      seedPattern: t < 0.5 ? a.seedPattern : b.seedPattern,
      fieldCoupling: inv * a.fieldCoupling + t * b.fieldCoupling,
      fieldDecay: inv * a.fieldDecay + t * b.fieldDecay,
    },
  };
}

/**
 * v8 Step 15.7 — crossfade the advected dye field.
 *
 * ⚠️ **THIS IS A FOURTH ASYMMETRIC-SIDE RULE AND IT MATCHES NONE OF THE THREE ABOVE IT.** `liquid` carries
 * wholesale, `cohesion` splits two ways, `liquidField` splits three ways across five fields — and `CLAUDE.md`'s
 * own note says none of them generalises to the next one. It is right: the shape here is decided by a fact none
 * of the three has, namely that **the block's visible output is gated by a field in a DIFFERENT block**
 * (`liquid.tintSource === 'dye'`). So:
 *
 * - `enabled` **SNAPS at t = 0.5** (invariant 16) — it decides whether GL resources exist, and a crossfade
 *   cannot half-allocate a framebuffer. Same argument as `liquidField.enabled`.
 * - `opacity` **lerps toward 0** on the missing side and is the one field with a neutral value, so it is what
 *   makes the snap read as a fade: at deposit weight 0 the field keeps advecting and decaying but takes no new
 *   colour, so the dye thins out continuously and then the allocation flips once, invisibly.
 * - `decayRate`, `advectionStrength` and `injectionRadius` are **CARRIED** from the side that has them.
 *   ⚠️ **`decayRate` must NOT lerp toward its default (0.985)** — the crossfade would then change how long the
 *   dye lingers *while* it is fading out, which reads as the field breaking up rather than emptying. Same
 *   reasoning as `liquidField.fieldDecay`, and `advectionStrength` toward 0 would freeze the wake mid-fade.
 * - `colourSource` **SNAPS** (categorical) and `fixedColour` follows whichever side won it — a fixed colour has
 *   no meaning apart from the source that reads it, which is `symmetryMirror`'s relationship to `symmetryFold`.
 *
 * ⚠️ **`fixedColour` is COPIED, not referenced.** It is the first reference type in any of these four blocks,
 * and handing the caller a live alias to one deck's array would let a later edit of the crossfade result write
 * back into the deck. Both sides go through `[...]`, including the one-sided cases.
 *
 * An absent block is the authored, known state "no dye" — `main.ts` emits it only when
 * `enabled && opacity > 0`, i.e. `liquidField`'s two-part value gate rather than a mode gate (a mode-only gate
 * would be the export defect `CLAUDE.md` records).
 */
function interpolateDye(
  a: DyeFieldConfig | undefined,
  b: DyeFieldConfig | undefined,
  t: number,
  inv: number,
): { dye?: DyeFieldConfig } {
  if (!a && !b) return {};
  if (!a) {
    return {
      dye: {
        enabled: t >= 0.5 ? b!.enabled : false,
        opacity: t * b!.opacity,
        decayRate: b!.decayRate,
        advectionStrength: b!.advectionStrength,
        injectionRadius: b!.injectionRadius,
        colourSource: b!.colourSource,
        fixedColour: [...b!.fixedColour],
        // v8 28.3/28.4/28.5 — ⚠️ **ALL THREE ARE CATEGORICAL AND THEREFORE SNAP (invariant 16).** A blend
        // mode half-way between over and add is not a blend mode; a half-shown figure is not a state; and
        // a ramp NAME has no midpoint. They take the present side here, which is exactly what
        // `colourSource` beside them does — the three new fields follow this block's own convention
        // rather than introducing a second one.
        // v8 28 — ⚠️ **CONDITIONAL SPREADS, not plain assignment, and `exactOptionalPropertyTypes`
        // is only half the reason.** The semantics are the better half: an ABSENT field stays absent
        // through a crossfade, so the Mixer cannot add keys to an export that neither deck authored.
        // Writing `undefined` would both fail the compiler and materialise the key.
        ...(b!.ramp !== undefined ? { ramp: b!.ramp } : {}),
        ...(b!.blendMode !== undefined ? { blendMode: b!.blendMode } : {}),
        ...(b!.showFigure !== undefined ? { showFigure: b!.showFigure } : {}),
        ...(b!.mapping !== undefined ? { mapping: b!.mapping } : {}),
        ...(b!.cycles !== undefined ? { cycles: b!.cycles } : {}),
      },
    };
  }
  if (!b) {
    return {
      dye: {
        enabled: t < 0.5 ? a.enabled : false,
        opacity: inv * a.opacity,
        decayRate: a.decayRate,
        advectionStrength: a.advectionStrength,
        injectionRadius: a.injectionRadius,
        colourSource: a.colourSource,
        fixedColour: [...a.fixedColour],
        // v8 28 — the same three categoricals, present side. See the !a branch.
        // v8 28 — ⚠️ **CONDITIONAL SPREADS, not plain assignment, and `exactOptionalPropertyTypes`
        // is only half the reason.** The semantics are the better half: an ABSENT field stays absent
        // through a crossfade, so the Mixer cannot add keys to an export that neither deck authored.
        // Writing `undefined` would both fail the compiler and materialise the key.
        ...(a.ramp !== undefined ? { ramp: a.ramp } : {}),
        ...(a.blendMode !== undefined ? { blendMode: a.blendMode } : {}),
        ...(a.showFigure !== undefined ? { showFigure: a.showFigure } : {}),
        ...(a.mapping !== undefined ? { mapping: a.mapping } : {}),
        ...(a.cycles !== undefined ? { cycles: a.cycles } : {}),
      },
    };
  }
  const colourWinner = t < 0.5 ? a : b;
  return {
    dye: {
      enabled: t < 0.5 ? a.enabled : b.enabled,
      opacity: inv * a.opacity + t * b.opacity,
      // Linear despite living on a narrow band near 1 (0.90–1.0) — 15.3's rule, not Iso Level's, exactly as
      // `liquidField.fieldDecay` is.
      decayRate: inv * a.decayRate + t * b.decayRate,
      advectionStrength: inv * a.advectionStrength + t * b.advectionStrength,
      // Rounded because the control's step is 1 canvas pixel, so a fractional radius is unreachable by hand
      // and would make a crossfade result unrepresentable on its own slider.
      injectionRadius: Math.round(inv * a.injectionRadius + t * b.injectionRadius),
      colourSource: colourWinner.colourSource,
      fixedColour: [...colourWinner.fixedColour],
      // v8 28.3/28.4/28.5 — ⚠️ **SNAPPED THROUGH `colourWinner`, the SAME t < 0.5 pick the colour
      // fields use (invariant 16).** Reusing that local rather than re-spelling the comparison is
      // deliberate: two spellings of one threshold is how a blend mode and a colour source come to
      // switch on opposite sides of the midpoint, which reads as a one-frame flash of a
      // configuration neither deck authored.
      ...(colourWinner.ramp !== undefined ? { ramp: colourWinner.ramp } : {}),
      ...(colourWinner.blendMode !== undefined ? { blendMode: colourWinner.blendMode } : {}),
      ...(colourWinner.showFigure !== undefined ? { showFigure: colourWinner.showFigure } : {}),
      // v8 28.16 — `mapping` is CATEGORICAL so it snaps with the rest (invariant 16); `cycles` is a COUNT
      // so it lerps and ROUNDS, exactly as `injectionRadius` above does and for the same reason: the
      // control's step is 1, so a fractional result would be unrepresentable on its own slider.
      ...(colourWinner.mapping !== undefined ? { mapping: colourWinner.mapping } : {}),
      /*
       * ⚠️ **CORRECTED 2026-10-22 — a `28.16` DEFECT, FOUND BY PHASE 30 WITHOUT PHASE 30 TOUCHING THE DYE.**
       * It read `a.cycles !== undefined || b.cycles !== undefined`, i.e. emit if EITHER side carries it, and
       * lerped the absent side from a default of 1. **At `t = 1` with `a.cycles = 8` and `b.cycles` absent
       * that writes `cycles: 1` — an ADDED leaf at the crossfade's own endpoint**, which is exactly what
       * `mixercheck` §C forbids and what the `paletteHueShift` incident was about.
       *
       * ⚠️ **ITS THREE NEIGHBOURS ON THE LINES ABOVE WERE ALREADY RIGHT** (`blendMode`, `showFigure`,
       * `mapping` all gate on `colourWinner.X !== undefined`), so this was the one field of four that chose
       * a different presence rule — *four asymmetric-side rules, none general*, read as a licence to pick
       * one rather than as a warning to check each.
       *
       * **The fix keeps the lerp where it is meaningful and follows the winner where it is not:** both
       * sides carry it ⇒ lerp and round, because a count between two authored counts is a real count; only
       * one side carries it ⇒ it follows `colourWinner`, so an absent key survives the endpoint exactly as
       * `mapping`'s does.
       *
       * ⚠️ **IT WENT UNDETECTED BECAUSE THE PAIRING WAS NEVER SAMPLED, NOT BECAUSE THE CLAUSE WAS WEAK.**
       * `mixercheck` was 125/0 before this phase; adding six presets shifted which pairs it walks and
       * `Breathing Dye × Dye Holi Festival` surfaced on the first run. **A green suite over a pair-sampled
       * basis is a claim about the pairs, not about the function.**
       */
      ...(a.cycles !== undefined && b.cycles !== undefined
        ? { cycles: Math.max(1, Math.round(inv * a.cycles + t * b.cycles)) }
        : colourWinner.cycles !== undefined ? { cycles: colourWinner.cycles } : {}),
    },
  };
}

/**
 * Crossfade the material block. The twelve fields split three ways — `preset`, `heatMode`, `blendMode` and
 * `colourRamp` are categorical and SNAP at t=0.5 (invariant 16), the eight scalars lerp.
 *
 * ⚠️ **THE ONE-SIDED CASE SNAPS TOO, AND THAT WAS A FIX ON 2026-10-05 (Phase 23.2), NOT THE ORIGINAL RULE.**
 * Both one-sided branches used to adopt the present side's material WHOLE at every `t` — `if (!a) return {
 * material: { ...b } }` — so a crossfade from a material-less deck A to a `Plasma` deck B rendered Plasma's
 * material at **t = 0**, where the crossfader claims to be showing deck A untouched. Measured over the
 * shipped library (274 pairs, both endpoints): **122 pairs carried a full foreign material block at an
 * endpoint**, by far the largest residual left after the rule table landed.
 *
 * ⚠️ **It is not inert, and the reason is the render mode, not the material's own fields.** A live material
 * (`preset !== 'None'`) OVERRIDES the requested mode at `resolveModeAgainstMaterial()` — every one of the
 * eight asks for `splat`, `Liquid` asks for `liquid` — so an endpoint that adopts the other deck's material
 * does not merely gain some unused shading parameters, it **re-resolves the frame's render mode**. And
 * `renderMode` itself snaps at 0.5 in this same group: the mode and the thing that overrides the mode were
 * flipping at two different `t`, which is invariant 17's split-pair shape arriving by a second route.
 *
 * ⚠️ **A material has no activation scalar to ramp, which is why this is a snap and not a fade.** The four
 * field blocks below solve the same asymmetry by ramping their own activation to the inert value at the far
 * end (`dye.opacity` → 0 with `enabled` false, `cohesion.strength` → 0, `liquidField.fieldCoupling` → 0), and
 * none of that is available here: a material's inactive state is the *string* `'None'` (invariant 18), and
 * `emissionIntensity: 0` is still a live material that still steals the mode. So the honest neutral on the
 * missing side is **no block at all** — exactly what the two-sided branch below already does with `preset`.
 *
 * ⚠️ **`interpolateLiquid`'s one-sided branch is NOT the same case and was deliberately left alone** — its
 * block is read only in the `liquid` render mode, which snaps in this same group, so an adopted block on the
 * side that is not in liquid mode is genuinely dormant. **The asymmetric rules do not generalise to each
 * other; that is the fourth demonstration of it in this file.**
 */
function interpolateMaterial(
  a: MaterialConfig | undefined,
  b: MaterialConfig | undefined,
  t: number,
  inv: number,
): { material?: MaterialConfig } {
  if (!a && !b) return {};
  if (!a || a.preset === 'None') {
    return t >= 0.5 && b && b.preset !== 'None' ? { material: { ...b } } : {};
  }
  if (!b || b.preset === 'None') return t < 0.5 ? { material: { ...a } } : {};
  return {
    material: {
      preset: t < 0.5 ? a.preset : b.preset,
      splatRadius: inv * a.splatRadius + t * b.splatRadius,
      coreBrightness: inv * a.coreBrightness + t * b.coreBrightness,
      haloStrength: inv * a.haloStrength + t * b.haloStrength,
      falloffExponent: inv * a.falloffExponent + t * b.falloffExponent,
      thermalLag: inv * a.thermalLag + t * b.thermalLag,
      emissionIntensity: inv * a.emissionIntensity + t * b.emissionIntensity,
      heatMode: t < 0.5 ? a.heatMode : b.heatMode,
      heatGain: inv * a.heatGain + t * b.heatGain,
      blendMode: t < 0.5 ? a.blendMode : b.blendMode,
      colourRamp: t < 0.5 ? a.colourRamp : b.colourRamp,
      velocityStretch: inv * a.velocityStretch + t * b.velocityStretch,
    },
  };
}
