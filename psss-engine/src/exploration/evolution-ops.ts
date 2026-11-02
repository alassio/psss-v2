import type { OverlayState, UnifiedPreset } from '../presets/types.ts';
import type { CategoryLock } from './state.ts';
import type { PresetStatistics } from './preset-stats.ts';
import { deepCopy } from './state.ts';
import { CARRY_TIER, randomizePreset, tierProfile, type Intensity } from './randomize.ts';
import { CATEGORY_LOCKS, OVERLAY_RULES, type OverlayRule } from './overlay-rules.ts';

/**
 * Evolution's genetic operators — crossover, mutation and one generation of breeding.
 *
 * ⚠️ **REWRITTEN BY v8 PHASE 25 (2026-10-06), AND THE MEASUREMENT IS WHY.** The genetics here were real and
 * the GENOME was a third of the preset: `const result = deepCopy(a)` meant every value crossover did not
 * explicitly name came from parent A, and crossover named `generators`, `renderer`, `postProcessors` and
 * exactly ONE overlay key. Measured over 548 library pairs (`25.0`, 2026-10-03, N = 274): the number of
 * distinct top-level overlay keys that could come from parent B was **1** — `transMapChain` — and nothing
 * else, ever. Per-pair overlay B share was **0.0 % at the median**, i.e. for most pairs the child's overlay
 * WAS parent A's, byte for byte. Ten generations of breeding reached **9** overlay leaves and never reached
 * the other 35.
 *
 * ⚠️ **Nobody could have seen this by looking, and that is the finding.** A tile that inherited nothing from
 * parent B still looks like a plausible child, because it IS one — of parent A. It took a provenance probe
 * over the shipped function, classifying every leaf into *identical / from A / from B / blended*, because
 * **the parents agreeing about a value makes the child's value evidence of nothing** and a probe that does
 * not separate those four classes cannot be believed in either direction.
 *
 * ⚠️ **This is the same root cause as Phases 23 and 24 seen from the third tab.** The Mixer's hole was a
 * wholesale `result.overlay = {…}`; the Randomiser's was a hand-written list of jitter call sites; this one
 * was a `deepCopy` with no overlay traversal behind it. **All three now read `OVERLAY_RULES`** — which is
 * also the blast radius: a key added to `OverlayState` without a rule breaks the build in one place, and all
 * three tabs gain it together.
 */

/** Per-child inheritance decision: which parent won each of the seven genes. */
type GeneWinners = Record<CategoryLock, UnifiedPreset>;

export function crossoverPresets(
  a: UnifiedPreset,
  b: UnifiedPreset,
  t?: number,
  // ⚠️ **APPENDED, NEVER INSERTED (25.D12).** `crossoverPresets(a, b, t?)` is the signature `mixercheck`
  // calls directly, and a signature change there is a two-site edit with no compiler between the test and
  // the code. Both new parameters are optional and both default to the pre-Phase-25 behaviour.
  // ⚠️ **`rng` IS HERE BECAUSE `25.7` REQUIRES AN INJECTED SOURCE, NOT A MONKEY-PATCHED `Math.random`** —
  // otherwise the checker's assertions are unreproducible and a flake reads as a regression. It is an
  // APPENDED optional field, so `crossoverPresets(a, b, t?)` still type-checks unchanged.
  opts?: { intensity?: Intensity; locks?: Set<CategoryLock>; dominant?: UnifiedPreset; rng?: () => number },
): UnifiedPreset {
  const rnd = opts?.rng ?? Math.random;
  const blend = t ?? (0.3 + rnd() * 0.4);
  const result = deepCopy(a);
  const locks = opts?.locks ?? new Set<CategoryLock>();

  /**
   * The per-gene coin (`25.D2`, `25.D3`, `25.D8`).
   *
   * ⚠️ **SEVEN COINS PER CHILD, NOT FORTY-SIX.** The gene boundary is `OverlayRule.group`, and that is a
   * design decision with a visible consequence: a group-level coin gives the grade bundle and the colour
   * bundle coherence **for free** — the same bundling the Mixer had to decide explicitly — and produces
   * children whose look can be traced to a parent **by eye**. A per-key coin mixes more and yields looks
   * explicable by nothing, which is the opposite of what makes a nine-tile gallery worth scanning.
   *
   * ⚠️ **`dominance` leans the coin at Subtle (`25.D8`)** and the dominant parent is the FIRST selected tile
   * where the caller names one. At even odds a Subtle child can still arrive with a grade or a render mode
   * neither parent is known for; the lean is what makes *Subtle* mean loyal as well as small.
   */
  const dominance = opts?.intensity ? tierProfile(opts.intensity).dominance : 0.5;
  const dominant = opts?.dominant ?? a;
  const recessive = dominant === a ? b : a;
  const winners = {} as GeneWinners;
  for (const gene of CATEGORY_LOCKS) {
    // ⚠️ **A LOCKED GENE DOES NOT THROW A COIN AT ALL (25.D4).** The chip row is labelled *Keep untouched*,
    // and a lock that stopped mutation while leaving inheritance free would let a locked group change
    // anyway — invariant 13 exactly, a control that does not move the thing it names. The winner is the
    // dominant parent, which the caller defines as the first selected tile: determinate, stable across a
    // Breed, and explainable in one line of UI copy. It replaces "the seed", which does not exist once
    // three parents are selected.
    winners[gene] = locks.has(gene) ? dominant : (rnd() < dominance ? dominant : recessive);
  }

  // Wave-level crossover: randomly pick whole waves from either parent.
  //
  // ⚠️ **KEPT VERBATIM, AND IT IS THE ONE GENETIC OPERATOR THE MIXER DOES NOT HAVE.** Lerping two wave
  // tables was proposed and declined by the owner: averaging different tables mostly yields a figure
  // resembling neither parent, and it removes the discrete jumps that make a gallery worth scanning.
  const maxWaves = Math.max(a.generators.waves.length, b.generators.waves.length);
  result.generators.waves = [];
  for (let w = 0; w < maxWaves; w++) {
    const src = rnd() < blend ? b : a;
    const wave = src.generators.waves[w];
    if (wave) {
      result.generators.waves.push(deepCopy(wave));
    } else {
      const fallback = a.generators.waves[w] ?? b.generators.waves[w];
      if (fallback) result.generators.waves.push(deepCopy(fallback));
    }
  }

  // Interpolate top-level numeric params
  result.generators.particleCount = Math.round(lerp(a.generators.particleCount, b.generators.particleCount, blend));
  result.generators.waveSpeed = lerp(a.generators.waveSpeed, b.generators.waveSpeed, blend);
  result.generators.rotation = a.generators.rotation.map((v, i) => lerp(v, b.generators.rotation[i] ?? 0, blend));

  // Color from one parent (coin flip weighted by blend) — a BUNDLE, because four correlated arrays lerped
  // independently is a colour neither parent authored.
  const colorSrc = rnd() < blend ? b : a;
  result.generators.colorBase = [...colorSrc.generators.colorBase];
  result.generators.colorAmp = [...colorSrc.generators.colorAmp];
  result.generators.colorFreq = [...colorSrc.generators.colorFreq];
  result.generators.colorShift = [...colorSrc.generators.colorShift];

  // Renderer params — interpolate
  result.renderer.glow = lerp(a.renderer.glow, b.renderer.glow, blend);
  result.renderer.decayFactor = lerp(a.renderer.decayFactor, b.renderer.decayFactor, blend);
  result.renderer.blurRadius = lerp(a.renderer.blurRadius, b.renderer.blurRadius, blend);
  result.renderer.depthSize = lerp(a.renderer.depthSize, b.renderer.depthSize, blend);
  result.renderer.streaks = lerp(a.renderer.streaks, b.renderer.streaks, blend);

  /**
   * ⚠️ **THE `renderer.mode` COIN WAS DELETED HERE BY `25.1`/`25.D9`, AND THIS LINE IS NOT ITS RETURN.**
   *
   * The deleted line was `result.renderer.mode = Math.random() < blend ? b.renderer.mode : a.renderer.mode`
   * — an INDEPENDENT coin, and it was inert on **245 of 274** presets (89.4 %). `main.ts` resolves
   * `preset.overlay?.renderMode ?? (isSamePreset ? currentRenderMode : (preset.renderer.mode ?? 'star'))`,
   * and `overlay.renderMode` is authored on those 245, so the write was shadowed. On the remaining 29 the
   * two entry points diverged: `Generate` does not rename, so `isSamePreset` was true and the LIVE mode won
   * — inert there too — while `breedGeneration` names children `Evo Gen N`, so the coin DID land, at the
   * cost of a renderer dispose + re-init into a mode nobody chose. **Reachable on 29 of 274 through `Breed`
   * alone, inert everywhere else**, which is invariant 17 read backwards: two sources, and the writer chose
   * the one nobody resolves first.
   *
   * What replaces it is not a coin but a CONSEQUENCE: `renderer.mode` is the twin of `overlay.renderMode`,
   * so it follows **that key's own gene winner** (`P7`). The pair cannot disagree, which is the property the
   * deleted line violated — and the mode is still inherited, through the channel 245 of 274 presets use.
   */
  result.renderer.mode = winners[OVERLAY_RULES.renderMode.group].renderer.mode;

  /**
   * ⚠️ **`postProcessors.bloom` AND `postProcessors.toneMap` RECOMBINATION WAS DELETED BY `25.1`/`25.D9`,
   * AND THE FIGURE THAT KILLED IT IS THE TRAP: both blocks are carried by 274 of 274 presets and consulted
   * by NO renderer.** Grading is driven solely from `FilmLookParams` (defect **EX1** / **ADR 007**; the
   * authoritative in-source statement is `preset-stats.ts`'s own header). **A block every preset carries
   * looks maximally live and was the deadest thing in this file.** They survive in the child because
   * `deepCopy(a)` carries them; nothing reads them, and recombining them cost a coin per child to decide
   * something no frame depends on.
   *
   * ⚠️ **`visualFx` went too: carried by 0 of 274** (triage I11 — the block is unreachable by authoring), so
   * its three-branch inheritance was arbitrating over a field that never exists.
   *
   * ⚠️ **And `fractal`: nine lines serving 1 of 274.** The accepted and stated cost is that **that one
   * preset's attractor now always comes from the dominant parent.**
   *
   * ⚠️ **`postProcessors.transMap` is NOT in that list — it is READ, and its crossover stays**, re-expressed
   * below as part of the `transmap` gene.
   */

  /**
   * ⚠️ **THE THREE INVARIANT-17 PAIRS RESOLVE FROM ONE GENE WINNER (`P7`), AND THIS IS WHERE TWO OF THEM
   * ARE CLOSED.** `postProcessors.transMap.*` is the twin of `overlay.transMapEnabled`/`transMapStyle`/
   * `ifsParams`, and the layer chain (`overlay.transMapChain`) is the authoritative field over all of them —
   * `chainFromOverlay` prefers it unconditionally. All four live in the `transmap` group, so taking the
   * block from that gene's winner is what makes "b's TransMap block under a's chain" unrepresentable.
   *
   * The pre-Phase-25 code threw a SEPARATE `Math.random() < 0.5` here and a second one for the chain, and
   * carried an explicit invariant-17 comment about keeping them together. **That comment is the evidence the
   * hole was one of scope rather than of understanding: the author knew exactly what an overlay key costs
   * and handled the one they were looking at.**
   */
  const tmSrc = winners[OVERLAY_RULES.transMapStyle.group];
  result.postProcessors.transMap = deepCopy(tmSrc.postProcessors.transMap);

  /**
   * ⚠️ **THE OVERLAY IS A UNION MERGE OVER THE TABLE'S KEYS, NEVER A WHOLESALE ASSIGNMENT (`25.2`).** A
   * `result.overlay = {…}` here is the literal mistake Phase 23 exists to remove — it DESTROYS every key
   * absent from the literal in force — and re-making it would be invisible to `tsc`, since both shapes are
   * `OverlayState | undefined`.
   *
   * ⚠️ **ABSENT IS A VALUE, NOT A MISSING ONE.** Where the winning parent does not author a key, the key is
   * DELETED from the child rather than inherited from the loser: an absent key is how a preset says "the
   * runtime default is canonical" (and for `transMapChain` specifically, "the legacy scalars are
   * canonical"), so filling it in from the other parent would publish a value neither of them chose.
   */
  const aOv = (a.overlay ?? {}) as Record<string, unknown>;
  const bOv = (b.overlay ?? {}) as Record<string, unknown>;
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(OVERLAY_RULES) as (keyof typeof OVERLAY_RULES)[]) {
    const rule: OverlayRule = OVERLAY_RULES[key];
    const winner = winners[rule.group];
    const wOv = winner === b ? bOv : aOv;
    /**
     * ⚠️ **FIVE LAW KINDS MAP ONTO `25.D2`'s TWO MODES, AND THE MAPPING IS A DECISION, NOT A DETAIL.**
     * `25.D2` specifies *snap → take the winner's value whole; lerp → lerp at the pair's blend*, and the
     * shipped table has five kinds rather than two. `lerp` and `geometric` lerp; **`snap`, `bundle` and
     * `custom` all take the winner's value whole**, because crossover's "whole from one parent" is always a
     * value some parent authored, whereas re-deriving ten custom mixers' per-field splits here would be a
     * second enumeration of the overlay surface — the one thing `25.D1` forbids.
     *
     * ⚠️ **`bundle` needs no special handling and that is the group-gene paying off**: every member of a
     * bundle shares a group, so they already resolve from one winner.
     */
    /**
     * ⚠️ **THE LOCK SHORT-CIRCUITS THE LAW, AND LEAVING IT OUT WAS A REAL DEFECT CAUGHT BY `mixercheck`
     * §O(e) ON THE FIRST RUN (2026-10-06).** The gene coin already resolves a locked group to the dominant
     * parent — but a `lerp`/`geometric` key does not READ its gene winner, it averages the two parents, so
     * `shape.figureScale` and `motion.speedFactor` moved off the first parent **with their chip lit.**
     *
     * **A lock that holds the categorical keys of a group and averages its scalars is worse than no lock**:
     * it is right about most of the group, so the chip looks like it works. `25.D4` says byte-identical to
     * the first selected tile, and byte-identical has to mean every key in the gene, whatever its law.
     */
    if (locks.has(rule.group)) {
      if (key in wOv) out[key] = deepCopy(wOv[key]);
    } else if (rule.law.kind === 'lerp' || rule.law.kind === 'geometric') {
      const av = aOv[key];
      const bv = bOv[key];
      if (typeof av === 'number' && typeof bv === 'number') {
        // `geometric` is lerped in LOG space for the reason the slider tracks are: a linear step through a
        // log-scaled quantity is a fraction of the control at one end and a re-roll at the other.
        out[key] = rule.law.kind === 'geometric' && av > 0 && bv > 0
          ? Math.exp(lerp(Math.log(av), Math.log(bv), blend))
          : lerp(av, bv, blend);
      } else if (key in wOv) {
        // One side absent, so there is nothing to average: the winner's value stands whole.
        out[key] = deepCopy(wOv[key]);
      }
    } else if (key in wOv) {
      out[key] = deepCopy(wOv[key]);
    }
  }
  result.overlay = out as OverlayState;

  return result;
}

/**
 * ⚠️ **TWO ARGUMENTS WERE HARDCODED HERE UNTIL 2026-10-06 AND IT WAS ONE LINE WITH TWO DEFECTS IN IT.** The
 * body was `return randomizePreset(preset, 'medium', new Set(), stats)`: a fresh empty lock set, against
 * **seven** chips rendered in the Evolution panel, and a hardcoded intensity, against a strength selector
 * the tab appeared to offer. **Every one of those chips did nothing — not "mostly nothing", nothing**, and
 * the argument was a literal at the call site, so no checker and no compiler could see it. Invariant 13:
 * *does this control still move the thing it names.*
 */
export function mutatePreset(
  preset: UnifiedPreset,
  stats: PresetStatistics,
  intensity: Intensity = 'medium',
  locks: Set<CategoryLock> = new Set(),
): UnifiedPreset {
  return randomizePreset(preset, intensity, locks, stats);
}

export interface BreedOptions {
  intensity: Intensity;
  locks: Set<CategoryLock>;
  /**
   * ⚠️ **A PARAMETER RATHER THAN A CONSTANT, DELIBERATELY (`25.D12`)** — so `mixercheck` can measure
   * crossover reach without elitism in the way. A checker that can only observe the operator through the
   * feature wrapped around it measures the wrapper.
   */
  carryParents: boolean;
  /** Injected RNG, for the same reason `crossoverPresets` takes one. Defaults to `Math.random`. */
  rng?: () => number;
}

export function breedGeneration(
  parents: UnifiedPreset[],
  count: number,
  stats: PresetStatistics,
  opts?: BreedOptions,
): UnifiedPreset[] {
  if (parents.length === 0) return [];
  const intensity = opts?.intensity ?? 'medium';
  const locks = opts?.locks ?? new Set<CategoryLock>();
  const carry = opts?.carryParents ?? false;
  const rnd = opts?.rng ?? Math.random;
  const { mutateProbability } = tierProfile(intensity);
  const offspring: UnifiedPreset[] = [];

  /**
   * ⚠️ **ELITISM (`25.D5`), AND THE OWNER RULED AGAINST THE SPECIFIER HERE.** Parents survive a Breed
   * **lightly re-mutated** rather than byte-identical, occupying the first slots: three parents + six
   * children, or one + eight. The trade was recorded with the ruling — no slot is ever a repeat of what you
   * just looked at, and in exchange **the exact tile you selected is not in the grid afterwards.** That
   * consequence is why `Back` exists (`25.D7`); the two decisions were made together and only make sense
   * together.
   *
   * ⚠️ **The carry mutates ONE TIER BELOW the selector (`25.D6`)** — Subtle → near, Medium → subtle, Wild →
   * medium — and the gentlest tier **never jumps a categorical**, or "gentler than the children beside it"
   * breaks visibly at Subtle, which is the only tier where that promise is the entire point.
   *
   * ⚠️ **Carried parents keep their OWN names (`25.D13`)**, while children are renamed `Evo Gen N` below.
   */
  if (carry) {
    const carryTier = CARRY_TIER[intensity];
    for (const parent of parents) {
      if (offspring.length >= count) break;
      offspring.push(randomizePreset(parent, carryTier, locks, stats));
    }
  }

  // ⚠️ **`count` KEEPS ITS MEANING AS THE TOTAL NUMBER OF SLOTS RETURNED (`P4`)**, so
  // `parents.length + children === count` and nine stays nine. Every animating tile shares ONE small
  // per-frame budget across the Grid, Evolution, History and the Reel, which is what makes a tenth tile a
  // rendering decision rather than a layout one.
  const dominant = parents[0]!;
  for (let i = offspring.length; i < count; i++) {
    let child: UnifiedPreset;
    if (parents.length === 1) {
      child = mutatePreset(parents[0]!, stats, intensity, locks);
    } else {
      const a = parents[Math.floor(rnd() * parents.length)]!;
      let b = parents[Math.floor(rnd() * parents.length)]!;
      let attempts = 0;
      while (b === a && attempts < 5) {
        b = parents[Math.floor(rnd() * parents.length)]!;
        attempts++;
      }
      // `rnd` rather than `opts?.rng`: one RNG stream for the whole generation, and under
      // `exactOptionalPropertyTypes` an explicit `undefined` is not the same as an absent field.
      child = crossoverPresets(a, b, undefined, { intensity, locks, dominant, rng: rnd });
      // `25.D11`: strength scales the mutation PROBABILITY as well as σ, and `medium` is exactly 0.60 so the
      // default is byte-comparable with the behaviour that shipped before Phase 25.
      if (rnd() < mutateProbability) {
        child = mutatePreset(child, stats, intensity, locks);
      }
    }
    /**
     * ⚠️ **CHILDREN KEEP THE `Evo Gen N` RENAME (`25.D13`), AND THIS IS THE ONE PLACE EVOLUTION AND THE
     * RANDOMISER LEGITIMATELY DIFFER.** `24.D14` forbade renaming in the Randomiser; here the rename ships
     * and is load-bearing — it is what makes a bred child a NEW preset to `main.ts`'s `isSamePreset`
     * resolver. **Deleting the mode coin above must not be read as making the rename redundant**; the
     * resolver has other clauses.
     *
     * ⚠️ **`Evo Gen N` RECURS ACROSS GENERATIONS, SO A NAME IS NOT A PRIMARY KEY HERE** — do not route a
     * child through any path that treats it as one: a duplicate name freezes a tile rather than repeating a
     * label.
     */
    child.metadata.name = `Evo Gen ${i + 1}`;
    offspring.push(child);
  }

  return offspring;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
