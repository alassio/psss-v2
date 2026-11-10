/**
 * dischargecheck — v8 Phase 40, Electric Discharge.
 *
 * ⚠️ **THE EFFECT'S NUMBERS ARE WRITTEN IN FOUR PLACES AND NO COMPILER COMPARES THEM**: the engine's
 * `DISCHARGE_DEFAULTS` / `DISCHARGE_RANGES`, the Mixer's `SCALAR_IDENTITIES`, `mixercheck`'s
 * `UNCONDITIONAL_LEAVES`, and the Visual FX sliders' `min`/`max`/`step`. A default that drifts in one of them is a
 * Mixer endpoint that changes a frame, a slider that cannot reach the authored value, or a preset whose `?? default`
 * disagrees with its own crossfade — each silent. This checker holds them equal, plus the rules that make the
 * effect what it is (off is a branch; the feed is energy-neutral; the buffer REPLACES the image; the warp acts on
 * the COMBINED image) and its wiring (one reader for both apply paths, the value-gated export).
 *
 * Most clauses are source-shaped by design — a behaviour-neutral rename breaks them, so read the assertion before
 * believing a failure is a regression. The equalities are MEASURED against the imported engine constants.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src') + '/';
const read = (f) => readFileSync(SRC + f, 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
let pass = 0, fail = 0;
const chk = (n, ok, x = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   ' + x : ''}`); ok ? pass++ : fail++; };

const { DISCHARGE_DEFAULTS, DISCHARGE_RANGES } = await import('../src/post-processors/electric-discharge.ts');
const KEYS = ['intensity', 'filament', 'crackle', 'branching'];
const OV = { intensity: 'dischargeIntensity', filament: 'dischargeFilament', crackle: 'dischargeCrackle', branching: 'dischargeBranching' };

console.log('\n=== A. the four copies of the numbers agree ===\n');
{
  const interp = read('exploration/interpolate.ts');
  const mix = readFileSync(join(ROOT, 'checks/mixercheck.mjs'), 'utf8');
  const vfx = strip(read('ui/synthesis-lab/tabs/visual-fx.ts'));
  const bad = [];
  for (const k of KEYS) {
    const key = OV[k], def = DISCHARGE_DEFAULTS[k], [lo, hi] = DISCHARGE_RANGES[k];
    const id = interp.match(new RegExp(`\\n\\s*${key}: ([\\d.]+),`));
    if (!id || Number(id[1]) !== def) bad.push(`${key}: SCALAR_IDENTITIES ${id?.[1]} vs default ${def}`);
    const lv = mix.match(new RegExp(`'overlay\\.${key}': ([\\d.]+)`));
    if (!lv || Number(lv[1]) !== def) bad.push(`${key}: UNCONDITIONAL_LEAVES ${lv?.[1]} vs default ${def}`);
    const sl = vfx.match(new RegExp(`key: '${key}', min: ([\\d.]+), max: ([\\d.]+), step: 1 / (\\d+)`));
    if (!sl) { bad.push(`${key}: slider descriptor not found`); continue; }
    const [smin, smax, den] = [Number(sl[1]), Number(sl[2]), Number(sl[3])];
    if (smin !== lo || smax !== hi) bad.push(`${key}: slider ${smin}..${smax} vs DISCHARGE_RANGES ${lo}..${hi}`);
    // The Slider-tracks rule: the step is a NEGATIVE POWER OF TWO and the range a whole number of steps (a browser
    // refuses an overshooting stop), and an authored default the track cannot represent is a defect.
    if (Math.log2(den) % 1 !== 0) bad.push(`${key}: step 1/${den} is not a power of two`);
    if (((hi - lo) * den) % 1 !== 0) bad.push(`${key}: range ${lo}..${hi} is not a whole number of 1/${den} steps`);
    if (((def - lo) * den) % 1 !== 0) bad.push(`${key}: default ${def} is not on the 1/${den} grid`);
    if (def < lo || def > hi) bad.push(`${key}: default ${def} outside ${lo}..${hi}`);
  }
  chk('defaults = Mixer identities = allowlisted leaves, and the sliders match the ranges on a power-of-two grid',
    bad.length === 0, bad.join('; ') || `${KEYS.length} keys × 4 copies`);
}

console.log('\n=== B. the effect\'s own rules (the shader) ===\n');
{
  const src = read('post-processors/electric-discharge.ts');
  chk('the feed is ENERGY-NEUTRAL: deposit = 1 - decay, so with no pull the buffer settles to the figure',
    /uDeposit'\]!, 1 - decay\)/.test(src), 'a free deposit gain made the first build a brighter copy, not a discharge');
  const comp = (src.match(/const COMPOSITE_FRAG = `([\s\S]*?)`;/) ?? ['', ''])[1];
  chk('the buffer REPLACES the image: the composite reads the discharge and NOT the figure',
    comp.includes('uDischarge') && !comp.includes('uFigure'),
    'adding a pinched copy over the untouched figure measured as a smooth glowing line with no crackle (p56-shots)');
  chk('the warp acts on the COMBINED image: the gradient climbs the blend, and both inputs are sampled displaced',
    /float blendA\(vec2 uv\)/.test(src) && /texture\(uPrev, src\) \* uDecay \+ texture\(uFigure, src\) \* uDeposit/.test(src),
    'decay·warp(prev) + figure laid the fresh light down unwarped, and that smooth layer kept the halo intact');
  chk('Branching is a BRANCH: the curl field is evaluated only while uBranch > 0',
    /if \(uBranch > 0\.0\) \{/.test(src), 'a weighted term would pay for the noise on every frame of every discharging preset');
  chk('the feedback loop guards non-finite values with a BOOLEAN select (invariant 20)',
    /bvec4 bad = bvec4\(/.test(src) && /bad\.x \? 0\.0 : d\.x/.test(src) && !/mix\(d,/.test(src),
    'mix() keeps a NaN, and a NaN in a feedback buffer persists for its whole life');
  chk('every target is tested for completeness (invariant 5) and the pass degrades to the input, never black',
    /checkFramebufferStatus\(gl\.FRAMEBUFFER\) === gl\.FRAMEBUFFER_COMPLETE/.test(src)
    && /if \(!this\.ensureSize\(w, h\)\) return figure;/.test(src), '');
  chk('dispose() nulls every deleted handle (invariant 1)',
    /this\.update = null; this\.composite = null; this\.vao = null; this\.quadBuf = null;/.test(src), '');
  chk('the jitter is deterministic — no Math.random() in the render path',
    !/Math\.random\(/.test(strip(src)), 'two runs of one session must crackle identically');
}

console.log('\n=== C. the wiring (main.ts, the rule table, the demos) ===\n');
{
  const main = strip(read('main.ts'));
  chk('OFF IS A BRANCH: apply() runs only inside `if (discharge.enabled)`, on presentSource',
    /if \(discharge\.enabled\) \{\s*(?:perfHud\?\.begin\('discharge'\);\s*)?presentSource = electricDischarge\.apply\(presentSource,/.test(main),   // the `?perf=1` bracket is allowed, nothing else
    'an unconditional call would cost a full-screen pass on every preset and break bit-identity');
  const readers = (main.match(/discharge = readDischarge\(ov\);/g) ?? []).length;
  chk('ONE reader for BOTH apply paths (applyPresetChange and resetOverlays)', readers === 2,
    `${readers} call sites — two apply paths with their own defaults is the lineWidth 1.5-vs-2.0 drift`);
  chk('the export is VALUE-GATED on the defaults, so a preset that never used it exports the same bytes',
    /discharge\.enabled \|\| discharge\.intensity !== DISCHARGE_DEFAULTS\.intensity/.test(main), '');
  // Coupled to Neon Lines (owner 11-05): EVERY write of the lines flag must be followed by the one owner, or a
  // route exists that leaves a discharge over no lines. Scanned over the RAW file's lines so the window is real.
  const mainLines = read('main.ts').split('\n');
  const writers = [], orphans = [];
  mainLines.forEach((l, i) => {
    if (/^\s*(\/\/|\*)/.test(l) || /let linesEnabled = false;/.test(l)) return;
    if (!/\blinesEnabled = (?!true\b)/.test(l)) return;
    writers.push(i + 1);
    if (!mainLines.slice(i, i + 10).some((x) => /coupleDischargeToLines\(\);/.test(x))) orphans.push(i + 1);
  });
  chk('lines OFF => discharge OFF: every write of `linesEnabled` is followed by coupleDischargeToLines()',
    writers.length >= 5 && orphans.length === 0,
    `${writers.length} writers${orphans.length ? `, UNCOUPLED at main.ts:${orphans.join(', ')}` : ''}`);
  chk('discharge ON => lines ON: setDischarge switches the lines on and ends ribbons, as setLinesEnabled does',
    /if \(discharge\.enabled && !linesEnabled\) \{ linesEnabled = true; ribbonState = 'off'; \}/.test(main), '');
  const rules = strip(read('exploration/overlay-rules.ts'));
  chk('the switch SNAPS and the four amounts LERP (invariant 16)',
    /dischargeEnabled: \{ group: 'visual', law: \{ kind: 'snap' \}/.test(rules)
    && KEYS.every((k) => new RegExp(`${OV[k]}: \\{ group: 'visual', law: \\{ kind: 'lerp' \\}`).test(rules)), '');
  const { VARIANT_PRESETS } = await import('../src/presets/variant-presets.ts');
  const demos = VARIANT_PRESETS.filter((v) => v.preset.overlay?.dischargeEnabled === true);
  // Every demo must author the lines ON and ribbons OFF: the coupling would otherwise switch its discharge off on
  // load, and the demo would show nothing (`Pipes Discharge`, deleted 11-05, was exactly that body).
  const unlined = demos.filter((d) => d.preset.overlay.linesEnabled !== true || (d.preset.overlay.ribbonMode ?? 'off') !== 'off');
  // ⚠️ The floor is 2, not the 3 Phase 40 shipped: the owner's finetuned `Curve Fold Discharge` (2026-11-08) turns the
  // discharge OFF (a splat + LiquidLight body now), so the effect is demonstrated by `Quader Discharge` and `Curve Weave
  // Lightning`. A demo count is the owner's; what this clause must hold is the COUPLING and the Branching case.
  chk('the effect has demos, every one authors Neon Lines on (the coupling), and one shows Branching',
    demos.length >= 2 && unlined.length === 0 && demos.some((d) => (d.preset.overlay.dischargeBranching ?? 0) > 0.5),
    demos.map((d) => d.name).join(', ') + (unlined.length ? `; WITHOUT LINES: ${unlined.map((d) => d.name).join(', ')}` : ''));
}

console.log(`\ndischargecheck: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
