import type { BuoyancyConfig } from '../presets/types.ts';
import { curl2DInto } from './simplex-noise.ts';

/** One reused result slot per octave — the three `curl2D` calls used to return a new array each, per hot particle. */
const C1 = new Float64Array(2), C2 = new Float64Array(2), C3 = new Float64Array(2);

export class FireProcessor {
  private fireOffsetX: Float32Array;
  private fireOffsetY: Float32Array;
  private noisePhase: Float32Array;
  private particleAge: Float32Array;
  private count: number;
  private time: number = 0;

  constructor(particleCount: number) {
    this.count = particleCount;
    this.fireOffsetX = new Float32Array(particleCount);
    this.fireOffsetY = new Float32Array(particleCount);
    this.noisePhase = new Float32Array(particleCount);
    this.particleAge = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      this.noisePhase[i] = i * 2.399 + (i * i * 0.013) % 6.28;
    }
  }

  update(dt: number, temperatures: Float32Array | null, config: BuoyancyConfig, positions?: Float32Array): void {
    if (!temperatures || !config.enabled) return;

    const dtNorm = dt / 16.667;
    const strength = config.strength;
    const turbulence = config.turbulence;
    const maxOff = config.maxOffset;
    const returnDecay = Math.pow(1.0 - config.returnForce * 0.15, dtNorm);
    // Scales the per-frame lift so the offset recurrence's STEADY STATE is frame-time independent.
    // `offset = offset * returnDecay + lift` settles at `lift / (1 - returnDecay)`; `returnDecay` is
    // exponential in dt while a `dtNorm`-scaled lift is linear, so the two only PARTLY cancel and the
    // settled height varied ~7 % across an ordinary 13–20 ms frame spread. Milder than the steering
    // fields — buoyancy is a one-way lift, so it reads as slight speed variation rather than as
    // jitter — but the same defect. Exactly 1.0 at 60 fps, so tuned presets are unchanged.
    const rate60 = Math.max(0, Math.min(1, config.returnForce * 0.15));
    const liftScale = rate60 > 1e-6 ? (1 - returnDecay) / rate60 : dtNorm;
    this.time += dt * 0.003;

    // Spatial coherence grid cell size — particles within ~40px share turbulence direction
    const cellSize = 40.0;
    const invCell = 1.0 / cellSize;

    for (let i = 0; i < this.count; i++) {
      const temp = temperatures[i]!;

      // Buoyancy: hot particles rise (negative Y = up in screen coords)
      this.fireOffsetY[i] = this.fireOffsetY[i]! + (-strength * temp * liftScale);

      // Increment particle age
      this.particleAge[i] = this.particleAge[i]! + dt * 0.001;

      // Turbulence
      if (turbulence > 0 && temp > 0.05) {
        const useCurl = config.curlOctaves !== false; // default true

        if (useCurl && positions) {
          // 3-octave simplex-curl noise: organic, non-repeating flame motion
          const px = positions[i * 3]!;
          const py = positions[i * 3 + 1]!;
          const age = this.particleAge[i]!;

          // Age-dependent response: young hot particles resist, old cool particles break up
          const normalizedAge = Math.min(age * 0.5, 1.0); // saturates at ~2 seconds
          const turbulenceResponse = (0.3 + 0.9 * normalizedAge) * (0.5 + 0.5 * temp);

          // Octave 1 (large): slow bending of entire flame body; 2 (medium): rolling tongues and lobes;
          // 3 (fine): edge flicker and tip breakup.
          curl2DInto(px * 0.003, py * 0.003, this.time * 0.25, C1);
          curl2DInto(px * 0.012, py * 0.012, this.time * 0.8, C2);
          curl2DInto(px * 0.04, py * 0.04, this.time * 2.5, C3);
          const cx1 = C1[0]!, cy1 = C1[1]!, cx2 = C2[0]!, cy2 = C2[1]!, cx3 = C3[0]!, cy3 = C3[1]!;

          // Weighted sum (60% large, 30% medium, 10% fine)
          const curlX = cx1 * 0.6 + cx2 * 0.3 + cx3 * 0.1;
          const curlY = cy1 * 0.6 + cy2 * 0.3 + cy3 * 0.1;

          this.fireOffsetX[i] = this.fireOffsetX[i]! + curlX * turbulence * turbulenceResponse * liftScale * 12.0;
          this.fireOffsetY[i] = this.fireOffsetY[i]! + curlY * turbulence * turbulenceResponse * liftScale * 8.0;
        } else {
          // Fallback: sinusoidal turbulence (original behaviour)
          let spatialPhase: number;
          if (positions) {
            const px = positions[i * 3]!;
            const py = positions[i * 3 + 1]!;
            const cx = Math.floor(px * invCell);
            const cy = Math.floor(py * invCell);
            spatialPhase = (cx * 7.31 + cy * 13.17) % 6.28;
          } else {
            spatialPhase = this.noisePhase[i]!;
          }
          const phase = spatialPhase * 0.7 + this.noisePhase[i]! * 0.3;
          const flicker = Math.sin(this.time * 4.0 + phase) * 0.7
                        + Math.sin(this.time * 7.3 + phase * 1.7) * 0.3;
          const jitter = (Math.random() - 0.5) * 0.3;
          this.fireOffsetX[i] = this.fireOffsetX[i]! + (flicker + jitter) * turbulence * temp * liftScale * 8.0;
          const vertFlicker = Math.sin(this.time * 5.5 + phase * 2.3) * 0.4
                            + Math.sin(this.time * 3.1 + spatialPhase) * 0.3;
          this.fireOffsetY[i] = this.fireOffsetY[i]! + vertFlicker * turbulence * temp * liftScale * 4.0;
        }
      }

      // Return force: exponential decay pulls offset back toward zero
      this.fireOffsetX[i] = this.fireOffsetX[i]! * returnDecay;
      this.fireOffsetY[i] = this.fireOffsetY[i]! * returnDecay;

      // Safety clamp.
      //
      // ⚠️ **Written as an explicit finite test FIRST, because a chained `if (x > max) … else if (x < -max) …`
      // is TRANSPARENT TO NaN.** Every comparison against NaN is false, so such a value passes both branches
      // untouched, and `NaN * returnDecay` on the line above is NaN forever — the offset is integrated state,
      // so one bad frame poisons that particle for the rest of the session. It then reaches `positions`, and
      // through the additive draw the trail buffer, where the fade pass MULTIPLIES and can never clear it.
      //
      // No entry path is known today (`curl2D` and the sinusoidal fallback are both bounded, and `temp` is
      // clamped to 1), which is exactly why this is worth stating: the clamp reads as if it bounds the value
      // and does not, so a future contributor upstream of here would get no signal. Reset to 0 rather than to
      // a bound — a NaN carries no sign to clamp toward, and 0 is the un-displaced mathematical position.
      const ox = this.fireOffsetX[i]!;
      const oy = this.fireOffsetY[i]!;
      this.fireOffsetX[i] = Number.isFinite(ox) ? Math.max(-maxOff, Math.min(maxOff, ox)) : 0;
      this.fireOffsetY[i] = Number.isFinite(oy) ? Math.max(-maxOff, Math.min(maxOff, oy)) : 0;
    }
  }

  getOffsetX(): Float32Array {
    return this.fireOffsetX;
  }

  getOffsetY(): Float32Array {
    return this.fireOffsetY;
  }

  reset(): void {
    this.fireOffsetX.fill(0);
    this.fireOffsetY.fill(0);
    this.particleAge.fill(0);
    this.time = 0;
  }

  /**
   * Grow or shrink in place, preserving buoyancy state (Visual FX "Particle Number").
   *
   * Reconstructing the processor would be simpler and is wrong here: `fireOffsetX/Y` and `particleAge`
   * are INTEGRATED state — the offsets accumulate lift across frames against an exponential return, and
   * the age drives the turbulence-response curve (young particles resist, old ones break up). A fresh
   * instance zeroes all three, so on a fire preset every particle would snap back to its mathematical
   * position and re-enter as "young" on every step of a slider drag. Same grow-only reasoning as
   * `LissajousGenerator.setParticleCount` and `main.ts`'s fluid buffers (D8).
   *
   * `noisePhase` is the exception and is EXTENDED rather than copied-then-padded: it is a pure function
   * of the index, so the new tail can be filled with its true values instead of zeros. Zeros there would
   * be a real defect rather than a one-frame artifact — every new particle would share phase 0 and so
   * receive identical turbulence, which reads as a coherent sheet moving as one.
   */
  resize(particleCount: number): void {
    const next = Math.max(0, Math.floor(particleCount));
    if (next === this.count) return;

    const carry = (src: Float32Array): Float32Array => {
      const out = new Float32Array(next);
      out.set(src.length <= next ? src : src.subarray(0, next));
      return out;
    };

    this.fireOffsetX = carry(this.fireOffsetX);
    this.fireOffsetY = carry(this.fireOffsetY);
    this.particleAge = carry(this.particleAge);

    const phase = carry(this.noisePhase);
    for (let i = this.count; i < next; i++) {
      phase[i] = i * 2.399 + (i * i * 0.013) % 6.28;
    }
    this.noisePhase = phase;

    this.count = next;
  }


  dispose(): void {
    this.fireOffsetX = new Float32Array(0);
    this.fireOffsetY = new Float32Array(0);
    this.noisePhase = new Float32Array(0);
    this.particleAge = new Float32Array(0);
    this.count = 0;
  }
}
