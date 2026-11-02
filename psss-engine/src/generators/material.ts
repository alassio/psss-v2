import type { MaterialConfig } from '../presets/types.ts';

/**
 * Temperature of the slowest particle, as a fraction of the ramp. See the note at the velocity driver.
 * Low but non-zero: 0 lands on ramp index 0, which is transparent black on most ramps.
 */
const HEAT_FLOOR = 0.05;

export class MaterialProcessor {
  private temperatures: Float32Array | null = null;
  private lifetimes: Float32Array | null = null;
  private materialTags: Uint8Array | null = null;
  private count = 0;

  /**
   * Whether the last `update()` actually INTEGRATED — i.e. whether `temperatures`/`lifetimes` carry data
   * rather than zeros. **This is not the same question as "are the arrays allocated", and conflating the two
   * was a real defect** (2026-09-20).
   *
   * `lissajous.ts` calls `init()` unconditionally at every re-init, so all three arrays are ALWAYS present at
   * their full length while `update()` returns early for `preset === 'None'`. Every consumer downstream was
   * written against the documented contract *"absent without a live material"* and tests PRESENCE
   * (`!state.temperatures`, `!ages || ages.length < count`) — so with no material those guards saw a
   * full-length array of zeros, read it as real data and never degraded. Two user-visible symptoms from that
   * one cause: palette mapping `age` sampled `fract(0/6) = 0` for every particle (one flat LUT colour, black
   * on `Classic: thermal`), and the mapping-3 → mapping-2 temperature degrade in `hdr-particle.ts` never
   * fired at all. **A guard that tests presence is inert wherever presence is unconditional** — which no
   * checker and no `tsc` run can see, because both arrays are correctly typed and correctly sized.
   *
   * Kept here rather than derived at the reader from `materialConfig`, because the processor is the one thing
   * that knows whether the integration ran; a second reader resolving "is a material live" from the config
   * would be the two-sources trap (invariant 17).
   */
  private live = false;

  init(particleCount: number): void {
    this.count = particleCount;
    this.temperatures = new Float32Array(particleCount);
    this.lifetimes = new Float32Array(particleCount);
    this.materialTags = new Uint8Array(particleCount);
    // Fresh arrays hold no integrated state, whatever the config says — the next `update()` sets this.
    this.live = false;
  }

  /**
   * Grow or shrink in place, preserving thermal state (Visual FX "Particle Number").
   *
   * `init()` would be shorter and is wrong for a live slider. `temperatures` is integrated
   * (`temp = temp * coolFactor + heat`), so zeroing it makes the whole population re-warm from cold on
   * every step of a drag; and `lifetimes` is an accumulating age that `heatMode: 'age'` reads directly,
   * where zeroing is worse than a transient — every particle would restart the 6 s cycle at the same
   * instant, collapsing the deliberate per-index stagger into one synchronised pulse.
   *
   * `materialTags` is uniform (`fill(tag)` each frame), so the new tail is correct within one frame
   * regardless; it is carried anyway to keep the three arrays the same length at all times.
   */
  resize(particleCount: number): void {
    const next = Math.max(0, Math.floor(particleCount));
    if (next === this.count) return;
    if (!this.temperatures || !this.lifetimes || !this.materialTags) {
      this.init(next);
      return;
    }

    const carryF = (src: Float32Array): Float32Array => {
      const out = new Float32Array(next);
      out.set(src.length <= next ? src : src.subarray(0, next));
      return out;
    };

    this.temperatures = carryF(this.temperatures);
    this.lifetimes = carryF(this.lifetimes);
    const tags = new Uint8Array(next);
    tags.set(this.materialTags.length <= next ? this.materialTags : this.materialTags.subarray(0, next));
    this.materialTags = tags;
    this.count = next;
  }

  update(
    dt: number,
    velocities: Float32Array,
    positions: Float32Array,
    config: MaterialConfig | null,
  ): void {
    const temps = this.temperatures;
    const lifes = this.lifetimes;
    // ⚠️ Both branches of this guard must write `live` — see its declaration. The early return is the state
    // every material-free preset is in, and leaving the flag stale here would restore the original defect one
    // frame after a material was switched off.
    if (!temps || !lifes || !config || config.preset === 'None') {
      this.live = false;
      return;
    }
    this.live = true;

    const dtSec = dt / 1000;
    const { thermalLag, heatMode, heatGain } = config;
    // heatGain: peak steady-state temperature (see heatScale below)
    //
    // M4 — coolFactor is now derived from ONE parameter, thermalLag, given in SECONDS.
    //
    // It was `Math.pow(dissipation, 1 + coolingRate * 2)`. Two fields, but only their combined
    // scalar ever mattered, and since the heat fix that scalar affects only how much temperature
    // LAGS its driver — not the range it covers. Infinitely many pairs produced identical
    // behaviour, so one of the two was redundant by construction.
    //
    // `thermalLag` is a half-life: after that many seconds, temperature has closed half the gap to
    // what the driver demands. coolFactor is the per-frame retention that yields it.
    //
    // Note this is now FRAME-RATE INDEPENDENT, which the old pair was not — both were per-frame
    // constants, so the same material cooled visibly faster at 144 Hz than at 60 Hz. Deriving from
    // dtSec fixes that as a side effect.
    //
    // Clamped at 1e-4 s: at zero the exponent diverges. That floor is ~0.006 of a 60 Hz frame, so
    // temperature simply equals the driver with no memory, which is the intended limit.
    const coolFactor = Math.pow(0.5, dtSec / Math.max(0.0001, thermalLag));

    // Open Point 7, fix 3b — SATURATION IS NOW IMPOSSIBLE BY CONSTRUCTION.
    //
    // `temp = temp * coolFactor + heat` is a geometric series converging to `heat / (1 - coolFactor)`.
    // With `heat` a fixed per-frame increment that ceiling depends on `coolingRate` and `dissipation`,
    // and wherever it exceeded 1 the value CLAMPED AT 1.0 FOR EVERY PARTICLE — `temperatures[]` then
    // carried no distribution at all and every heat-driven trigger (crystal `cold` rule,
    // `meltThreshold`, `smokeThreshold`, spark spawning, colour-ramp mapping) silently became a
    // constant. Two shipped presets did exactly this until they were hand-rebalanced (fix 1), and any
    // hand-tuned combination could reintroduce it at any time.
    //
    // Multiplying `heat` by `(1 - coolFactor)` makes the steady state equal the DRIVER itself, so it
    // is independent of `coolingRate`/`dissipation` and cannot exceed the driver's own range.
    //
    // The legacy `* 0.15` that the driver expressions carried is simply DROPPED, not divided out. It
    // was part of the old per-frame calibration and has no meaning once the steady state is set
    // directly. (Dividing by it — my first attempt — scales heat 6.67x too high and saturates Plasma,
    // Fire, Ember and Smoke outright. Derivation: steady state is `h / (1 - c)`, and we want that to
    // equal `driver * heatGain`, so `h = driver * heatGain * (1 - c)` exactly.)
    //
    // Consequence, and the reason this is 3b rather than 3a: steady state is now `driver * heatGain`,
    // so `heatGain` becomes an honest PEAK TEMPERATURE control and each material keeps its own heat
    // character (Ice 0.09–0.30 stays cold, Fire 0.30–1.00 runs hot). Normalising `heatGain` away too
    // (3a) would have given every material an identical 0.30–1.00 distribution — Ice as hot as Fire.
    //
    // NOTE the remaining limiter, deliberately NOT addressed here: the velocity driver's hardcoded
    // `0.3` base floor means the coldest particle cannot fall below `0.3 * heatGain`, so the bottom
    // ~30% of the ramp stays unreachable for the six velocity-mode presets. Lowering that floor is a
    // separate, appearance-changing decision with its own gate.
    const heatScale = 1 - coolFactor;

    if (heatMode === 'velocity') {
      // Find min/max velocity for rank-based normalization
      let minVel = Infinity, maxVel = 0;
      for (let i = 0; i < this.count; i++) {
        const v = velocities[i] ?? 0;
        if (v < minVel) minVel = v;
        if (v > maxVel) maxVel = v;
      }
      const range = maxVel - minVel;
      const invRange = range > 0.0001 ? 1.0 / range : 0;

      for (let i = 0; i < this.count; i++) {
        lifes[i] = (lifes[i] ?? 0) + dtSec;
        const v = velocities[i] ?? 0;
        const normalized = (v - minVel) * invRange;
        // HEAT FLOOR 0.3 -> 0.05 (Open Point 7, follow-up).
        //
        // The floor is the temperature of the SLOWEST particle in the scene, and at 0.3 it made the
        // bottom third of every ramp structurally unreachable: on the fire ramp 0.30 is already deep
        // red, so a velocity-mode material could never look cool anywhere and `birthRule: 'cold'` had
        // no genuinely cold population to nucleate in — it picked the least-hot particles, which still
        // looked fiery, and crystals therefore appeared unmotivated.
        //
        // Its stated purpose was "ensure slow particles stay visible", but visibility is
        // `emissionIntensity`/`coreBrightness`'s job; conflating it with TEMPERATURE cost the whole
        // cold end of the signal. At 0.05 the range is 0.05..1.00 (95 % ramp coverage) and slow
        // particles genuinely go cold and dark.
        //
        // Not 0.0: an exactly-zero floor sends the slowest particles to ramp index 0, which on most
        // ramps is fully transparent black — they would vanish rather than read as cold.
        //
        // THE CURVE, not the floor, is what actually decided "always burning".
        //
        // This was `Math.sqrt(normalized)`, chosen to "spread the slow end". But a Lissajous velocity
        // distribution is ALREADY bottom-heavy — measured on the `Fire and Ice` waves, the median
        // normalised speed is 0.24 — so sqrt pushed the median TEMPERATURE up to 0.52. Most of the
        // figure therefore sat mid-to-high on the ramp permanently: only 16 % of particles were below
        // 0.4 while 34 % were above 0.7. Lowering the floor barely helped, because the floor only sets
        // where the very slowest particle lands, not where the POPULATION lands.
        //
        // Linear passes the distribution through unchanged: median temp 0.28, with 59 % of particles
        // below 0.4 and only 10 % above 0.7. The figure now reads as mostly cool with bright hot
        // streaks where it genuinely moves fast — and `birthRule: 'cold'` finally has a large, real
        // cold population to nucleate in.
        const heat = (HEAT_FLOOR + (1 - HEAT_FLOOR) * normalized) * heatGain * heatScale;
        let temp = temps[i] ?? 0;
        // Cool first, then add heat
        temp *= coolFactor;
        temp += heat;
        temps[i] = Math.min(1, temp);
      }
    } else {
      for (let i = 0; i < this.count; i++) {
        lifes[i] = (lifes[i] ?? 0) + dtSec;

        let heat = 0;
        switch (heatMode) {
          case 'position': {
            const px = positions[i * 3] ?? 0;
            const py = positions[i * 3 + 1] ?? 0;
            heat = (Math.sin(px * 0.003) * 0.5 + 0.5) * (Math.cos(py * 0.004) * 0.5 + 0.5) * heatGain * heatScale;
            break;
          }
          case 'age': {
            // Raised cosine over the 6-second cycle, NOT the old `max(0, 1 - age/3)`.
            //
            // That form was clamped to zero for the second half of every cycle — measured: 51 % of the
            // cycle sat below temperature 0.02. Harmless while every age-mode material was ADDITIVE,
            // where temperature 0 merely adds nothing. But `Organic` is `blendMode: 'alpha'`, and since
            // B15 folded the ramp's authored alpha into output alpha, the organic ramp's a=0.00 at t=0
            // meant those particles contributed LITERALLY NOTHING: half the figure was invisible at any
            // instant, and each particle blinked out for 3 s of every 6. Measured brightness 0.00.
            //
            // The raised cosine spends only 9 % of the cycle below 0.02, has median 0.50 instead of 0.00,
            // and — unlike a sawtooth — is continuous at the wrap, so no particle jumps temperature.
            //
            // ⚠️ This does NOT need a matching change in the shader, and that is a correction to an
            // earlier note in this project which claimed the two formulas must move together.
            // `hdr-particle.ts` computes paletteMapping 5 as `fract(aAge / 6.0)` — a plain 0→1 sweep with
            // NO dead zone, because its job is to INDEX a palette across the whole cycle, not to describe
            // how hot a particle is. The two deliberately differ in shape while agreeing on the 6-second
            // period, which is the part that has to match.
            const phase = (i / this.count) * 6.0;
            const age = ((lifes[i] ?? 0) + phase) % 6.0;
            heat = (0.5 - 0.5 * Math.cos((2 * Math.PI * age) / 6.0)) * heatGain * heatScale;
            break;
          }
        }

        let temp = temps[i] ?? 0;
        temp *= coolFactor;
        temp += heat;
        temps[i] = Math.min(1, temp);
      }
    }
  }

  setMaterialTag(tag: number): void {
    if (this.materialTags) this.materialTags.fill(tag);
  }

  /**
   * Zero the accumulated heat (D9).
   *
   * Called when a material is switched OFF. Previously only the material TAG was cleared, so
   * `temperatures[]` kept whatever it had last integrated — and that field is read as colour: the splat and
   * volume paths index their ramp by it, and since B14 a film-look palette can be indexed by it too. Stale
   * heat therefore meant stale colour from a material that is no longer running. It is also read by the
   * crystal `cold` birth rule, `meltThreshold` and spark spawning.
   *
   * Lifetimes are deliberately left alone: they are per-particle age, not material state, and are re-seeded
   * by the processor when a material starts.
   */
  resetTemperatures(): void {
    this.temperatures?.fill(0);
  }

  /**
   * `true` only while a material is integrating. The publish gate in `lissajous.ts`' `getState()` reads this;
   * **do not answer it from `getTemperatures() !== null`**, which is what the defect this flag exists for did.
   */
  isLive(): boolean {
    return this.live;
  }

  getTemperatures(): Float32Array | null {
    return this.temperatures;
  }

  getLifetimes(): Float32Array | null {
    return this.lifetimes;
  }

  getMaterialTags(): Uint8Array | null {
    return this.materialTags;
  }

  dispose(): void {
    this.temperatures = null;
    this.lifetimes = null;
    this.materialTags = null;
    this.count = 0;
    this.live = false;
  }
}
