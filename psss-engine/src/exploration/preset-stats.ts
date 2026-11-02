import type { UnifiedPreset } from '../presets/types.ts';

export interface ParamRange {
  min: number;
  max: number;
  mean: number;
  stddev: number;
}

export interface PresetStatistics {
  paramRanges: Map<string, ParamRange>;
}

export function computePresetStatistics(presets: UnifiedPreset[]): PresetStatistics {
  const samples: Map<string, number[]> = new Map();

  for (const p of presets) {
    collect(samples, 'generators.particleCount', p.generators.particleCount);
    collect(samples, 'generators.waveSpeed', p.generators.waveSpeed);
    collect(samples, 'renderer.glow', p.renderer.glow);
    collect(samples, 'renderer.decayFactor', p.renderer.decayFactor);
    collect(samples, 'renderer.blurRadius', p.renderer.blurRadius);
    collect(samples, 'renderer.depthSize', p.renderer.depthSize);
    collect(samples, 'renderer.streaks', p.renderer.streaks);

    for (let c = 0; c < 3; c++) {
      collect(samples, `generators.colorBase.${c}`, p.generators.colorBase[c] ?? 128);
      collect(samples, `generators.colorAmp.${c}`, p.generators.colorAmp[c] ?? 128);
      collect(samples, `generators.colorFreq.${c}`, p.generators.colorFreq[c] ?? 0.1);
      collect(samples, `generators.colorShift.${c}`, p.generators.colorShift[c] ?? 0.1);
    }

    for (let r = 0; r < 3; r++) {
      collect(samples, `generators.rotation.${r}`, p.generators.rotation[r] ?? 0);
    }

    // Added 2026-08-10 alongside triage G12, as its mirror image. `randomize.ts` jitters these two keys
    // under the `visual` category, but nothing collected them — so `jitter()` took its `if (!range)
    // return value` path and BOTH MUTATIONS WERE SILENTLY INERT. That is the same class of defect as
    // G12 (collected-but-unread) seen from the other end, and it is the more harmful direction: an
    // unread sample merely wastes a few microseconds, whereas a missing range makes a documented
    // Randomiser control do nothing while appearing to work.
    //
    // Note the sample set is SMALL and non-representative on purpose: no legacy preset declares
    // `curlNoise` (0 occurrences in `psss_presets.json`) and only four hand-authored presets do, one of
    // them with `turbulence: 0`. `jitter()` scales by `range.max - range.min` and clamps to it, so with
    // few samples the range is narrow and mutation is correspondingly timid — correct behaviour for a
    // parameter the library barely uses, and it widens on its own as more presets adopt it. The
    // alternative, hardcoding the UI's 0-1 / 0.1-10 bounds, would make curl noise the single most
    // violently mutated parameter in the Randomiser.
    if (p.overlay?.curlNoise) {
      collect(samples, 'overlay.curlNoise.turbulence', p.overlay.curlNoise.turbulence);
      collect(samples, 'overlay.curlNoise.scale', p.overlay.curlNoise.scale);
    }

    for (let w = 0; w < (p.generators.waves?.length ?? 0); w++) {
      const wave = p.generators.waves[w]!;
      for (let a = 0; a < 3; a++) {
        const ax = wave.axes[a]!;
        collect(samples, `wave${w}.axis${a}.phase`, ax.phase);
        collect(samples, `wave${w}.axis${a}.am.base`, ax.am.base);
        collect(samples, `wave${w}.axis${a}.am.amplitude`, ax.am.amplitude);
        collect(samples, `wave${w}.axis${a}.am.frequency`, ax.am.frequency);
        collect(samples, `wave${w}.axis${a}.fm.base`, ax.fm.base);
        collect(samples, `wave${w}.axis${a}.fm.amplitude`, ax.fm.amplitude);
        collect(samples, `wave${w}.axis${a}.fm.frequency`, ax.fm.frequency);
      }
    }

    // `bloom.threshold`, `bloom.intensity` and `toneMap.exposure` were collected here and were dropped
    // on 2026-08-10 (triage G12). Nothing ever looked them up: `jitter()` is the sole reader of
    // `paramRanges`, and it is called with exactly six literal keys plus the per-wave/per-channel
    // families above. Worse than unread — those two blocks target the DEAD `postProcessors.bloom` /
    // `postProcessors.toneMap` blocks (defect EX1), which no renderer consults, since grading is driven
    // solely from `FilmLookParams` (ADR 007). So a range built from them could only ever have driven
    // mutation of parameters with no visual effect.
  }

  const paramRanges = new Map<string, ParamRange>();
  for (const [key, values] of samples) {
    const n = values.length;
    if (n === 0) continue;
    // Single pass rather than `Math.min(...values)` / `Math.max(...values)` / two `reduce`s.
    //
    // ⚠️ The spread form was flagged as a latent `RangeError` crash (triage G13). Re-verified
    // 2026-08-10: it was NOT reachable. One sample is pushed per preset per key, so `n` is bounded by
    // the library size — **274 as of 2026-10-06** — against a V8 spread-argument limit around 124 000.
    // ⚠️ **The figure was written as 177 and was re-based here on 2026-10-06, and the BASIS is what
    // matters, not the number**: 177 was the legacy JSON alone, while this function is handed the whole
    // composed library. Neither figure is close to the limit, so the conclusion is unchanged — but a
    // reader re-deriving the headroom from the stale figure would be reasoning about the wrong set, and
    // the margin is what the argument rests on. Re-run the count, never scale this number.
    // This is hygiene and a modest constant-factor win (measured: the whole function is ~2.8 ms one-time
    // at startup), NOT a crash fix. Do not cite it as one.
    let min = Infinity, max = -Infinity, sum = 0;
    for (let i = 0; i < n; i++) {
      const v = values[i]!;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const mean = sum / n;
    let sqSum = 0;
    for (let i = 0; i < n; i++) { const d = values[i]! - mean; sqSum += d * d; }
    paramRanges.set(key, { min, max, mean, stddev: Math.sqrt(sqSum / n) });
  }

  return { paramRanges };
}

function collect(map: Map<string, number[]>, key: string, value: number): void {
  if (!isFinite(value)) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(value);
}
