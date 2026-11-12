/**
 * @file v8 performance pass (owner, 2026-11-12) — **`?reel=2`: the PERFORMANCE TEST REEL and its automatic log.**
 *
 * The owner's measurement of the fullscreen reel, made repeatable: a fixed list of presets, played as a reel
 * presentation, each held `PERF_RUN_HOLD_SECONDS`; for each one the run records the **switch freeze** (the longest
 * frame in the first `SWITCH_WINDOW_MS` after the preset appears — the reel transition's hitch), then lets it settle
 * `SETTLE_MS` and measures `MEASURE_MS` through the `?perf=1` overlay's capture window (frame rate, p50 / p95 /
 * worst, CPU and GPU milliseconds per section). When every preset has a row, the reel stops and the log is
 * DOWNLOADED, printed to the console, kept in `localStorage` (`PERF_RUN_STORAGE_KEY`) and shown with a Copy button.
 *
 * ⚠️ **Only FULLSCREEN frames are measured.** A browser refuses fullscreen without a gesture, so the presentation is
 * promoted on the first click (19.12a); a preset that passes before it is measured on the next round of the reel.
 * "Fullscreen" is `document.fullscreenElement`, or a window that covers the screen (a host that is fullscreen by
 * itself).
 *
 * ⚠️ **The test reel is NOT in the reel store** — it is handed to `reelStart` directly, so it never appears in the
 * user's Reel tab, is never persisted and cannot become the main reel.
 *
 * ⚠️ **The list is a MEASUREMENT SET, not a showcase:** every cost class the review ranks (wave / curve / attractor
 * figures; star, splat, two-pass smoke, liquid, Neon Lines; curl; physarum and fluid advection, whose readbacks are
 * synchronous). Change it and every earlier log stops being comparable — add at the END.
 */
import type { Reel } from '../exploration/reel-model.ts';
import type { PerfCapture, PerfHud } from './perf-hud.ts';

export const PERF_RUN_PRESETS: readonly string[] = [
  'Quader', 'Chaos to Order', 'Nova2', 'Curve Dragonfold', 'Boiling Milk', 'Video Tape Error',
  'Quader Torus Knot', 'Curve Fold', 'Mandelbrot River Glow', 'Miracle Frost', 'Dye Holi Festival',
  'Material Fog', 'Liquid Maze', 'Lava Flow', 'Curtains Falling', 'The Real Super Man', 'Physarum Flower',
  'Fractal Cross',
];
const SWITCH_WINDOW_MS = 3000;
const SETTLE_MS = 10_000;
const MEASURE_MS = 5000;
/** Hold per preset: the settle + the measurement + a margin, so the capture never straddles the next switch. */
export const PERF_RUN_HOLD_SECONDS = 16;
export const PERF_RUN_STORAGE_KEY = 'psss-perf-run-last';
/** Section order in the log (a section that never ran on a preset prints `-`). */
/**
 * ⚠️ **The run must END on any machine.** A row is recorded however few frames the window held (a preset drawing one
 * frame in five seconds IS the result), and after this many full rounds the run finishes with whatever it has — a
 * preset that never produced a capture is listed as not measured. Without both, a slow enough preset is retried for
 * ever and the log never arrives (found on the software renderer, where the heaviest presets draw < 1 fps).
 */
const MAX_ROUNDS = 3;
const SECTIONS = ['trail', 'figure', 'particles', 'lines', 'ribbons', 'warp', 'discharge', 'glow', 'grade', 'present', 'tiles'];

export function perfTestReel(): Reel {
  return { name: 'Performance Test', presets: [...PERF_RUN_PRESETS], playMode: 'sequential', playSeconds: PERF_RUN_HOLD_SECONDS, transition: 'fade' };
}

interface Row {
  name: string; canvas: string; guard: number; fps: number; p50: number; p95: number; worst: number; switchMs: number;
  cpu: Record<string, number>; gpu: Record<string, number> | null; disjoint: boolean;
}

export interface PerfRunSources {
  presetName: () => string | null;
  canvas: () => { w: number; h: number };
  guardLevel: () => number;
  /** Called once, when every preset has a row — stop the reel and leave the presentation. */
  onDone: () => void;
}

const q = (s: number[], f: number): number => (s.length ? s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]! : 0);
const isFullscreen = (): boolean => document.fullscreenElement !== null
  || (window.innerWidth >= screen.width - 1 && window.innerHeight >= screen.height - 1);

export class PerfRun {
  private readonly rows = new Map<string, Row>();
  private cur: string | null = null;
  private t0 = 0;
  private switchMax = 0;
  private capturing = false;
  private capStart = 0;
  private captured = false;
  private done = false;
  private minDt = Infinity;
  private readonly status: HTMLDivElement;
  private readonly started = new Date();
  /** Preset switches seen in full screen — the backstop that ends the run after `MAX_ROUNDS` rounds of the reel. */
  private switches = 0;

  constructor(private readonly hud: PerfHud, private readonly src: PerfRunSources) {
    this.status = document.createElement('div');
    this.status.setAttribute('aria-hidden', 'true');
    Object.assign(this.status.style, {
      position: 'fixed', left: '8px', bottom: '8px', zIndex: '99999', pointerEvents: 'none',
      font: '12px/1.35 ui-monospace, Consolas, monospace', color: '#ffe9b0', background: 'rgba(0,0,0,0.72)',
      padding: '4px 8px', borderRadius: '4px', whiteSpace: 'pre',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.status);
  }

  /** Once per main-loop frame, with the UNCLAMPED frame interval. */
  frame(now: number, dt: number): void {
    if (this.done) return;
    if (Number.isFinite(dt) && dt > 0 && dt < this.minDt) this.minDt = dt;
    const name = this.src.presetName();
    if (name !== this.cur) {
      if (this.capturing) { this.hud.stopCapture(); this.capturing = false; }   // a switch mid-capture: discard
      this.cur = name; this.t0 = now; this.switchMax = 0; this.captured = false;
      if (isFullscreen()) this.switches++;
    }
    const age = now - this.t0;
    if (age <= SWITCH_WINDOW_MS && Number.isFinite(dt)) this.switchMax = Math.max(this.switchMax, dt);
    const wanted = name !== null && PERF_RUN_PRESETS.includes(name) && !this.rows.has(name);
    const fs = isFullscreen();
    if (wanted && !this.capturing && !this.captured && age >= SETTLE_MS && fs) {
      this.hud.startCapture(); this.capturing = true; this.capStart = now;
    }
    if (this.capturing && now - this.capStart >= MEASURE_MS) {
      const c = this.hud.stopCapture();
      this.capturing = false; this.captured = true;
      if (c && name !== null) this.rows.set(name, this.row(name, c));
    }
    const left = PERF_RUN_PRESETS.length - this.rows.size;
    this.status.textContent = !fs
      ? `perf run: click once for full screen — measuring starts in full screen (${this.rows.size}/${PERF_RUN_PRESETS.length} done)`
      : `perf run: ${this.rows.size}/${PERF_RUN_PRESETS.length} measured — ${name ?? '?'}: `
        + (this.capturing ? `measuring ${Math.max(0, (MEASURE_MS - (now - this.capStart)) / 1000).toFixed(0)} s`
          : this.captured || !wanted ? 'done, next preset soon' : `settling ${Math.max(0, (SETTLE_MS - age) / 1000).toFixed(0)} s`);
    if (left === 0 || this.switches > MAX_ROUNDS * PERF_RUN_PRESETS.length) this.finish();
  }

  private row(name: string, c: PerfCapture): Row {
    const s = c.dts.slice().sort((a, b) => a - b);
    const total = c.dts.reduce((a, b) => a + b, 0);
    const n = Math.max(1, c.frames);
    const per = (m: Record<string, number>): Record<string, number> => {
      const o: Record<string, number> = {};
      for (const [k, v] of Object.entries(m)) o[k] = v / n;
      return o;
    };
    const { w, h } = this.src.canvas();
    return {
      // No frame completed inside the window: 0 fps, and `worst` falls back to the window itself.
      name, canvas: `${w}x${h}`, guard: this.src.guardLevel(), fps: total > 0 ? c.frames / (total / 1000) : 0,
      p50: q(s, 0.5), p95: q(s, 0.95), worst: s[s.length - 1] ?? MEASURE_MS, switchMs: this.switchMax,
      cpu: per(c.cpuMs), gpu: c.gpuTiming && !c.disjoint ? per(c.gpuMs) : null, disjoint: c.disjoint,
    };
  }

  private report(): string {
    const f = (v: number | undefined, d = 1): string => (v === undefined ? '-' : v.toFixed(d));
    const anyGpu = [...this.rows.values()].some((r) => r.gpu !== null);
    const lines = [
      `PSSS performance test reel — ${this.started.toISOString()}`,
      `machine: ${navigator.userAgent}`,
      `gpu: ${this.hud.gpuName()} | gpu timing: ${anyGpu ? 'yes' : 'n/a'} | cpu threads: ${navigator.hardwareConcurrency ?? '?'}`
        + ` | screen ${screen.width}x${screen.height} @ ${window.devicePixelRatio}x | refresh ~${Number.isFinite(this.minDt) ? (1000 / this.minDt).toFixed(0) : '?'} Hz`,
      `per preset: switch freeze = longest frame in the first ${SWITCH_WINDOW_MS / 1000} s; then ${SETTLE_MS / 1000} s settle, ${MEASURE_MS / 1000} s measured, full screen only`,
      '',
      ['preset'.padEnd(24), 'canvas'.padEnd(10), 'fps'.padStart(6), 'p50'.padStart(6), 'p95'.padStart(6), 'worst'.padStart(6),
        'switch'.padStart(7), 'guard'.padStart(5), ...SECTIONS.map((x) => `${x} cpu/gpu`.padStart(16))].join(' '),
    ];
    for (const name of PERF_RUN_PRESETS) {
      const r = this.rows.get(name);
      if (!r) { lines.push(`${name.padEnd(24)} (not measured)`); continue; }
      lines.push([r.name.padEnd(24), r.canvas.padEnd(10), f(r.fps).padStart(6), f(r.p50).padStart(6), f(r.p95).padStart(6),
        f(r.worst, 0).padStart(6), f(r.switchMs, 0).padStart(7), String(r.guard).padStart(5),
        ...SECTIONS.map((x) => `${f(r.cpu[x], 2)}/${r.gpu ? f(r.gpu[x], 2) : 'n/a'}`.padStart(16))].join(' '));
    }
    lines.push('', 'JSON:', JSON.stringify({ started: this.started.toISOString(), rows: [...this.rows.values()] }));
    return lines.join('\n');
  }

  private finish(): void {
    this.done = true;
    this.status.remove();
    const text = this.report();
    console.log(text);
    try { localStorage.setItem(PERF_RUN_STORAGE_KEY, text); } catch { /* storage full or blocked: the download and the panel still carry it */ }
    const stamp = this.started.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = `psss-perf-${stamp}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    this.src.onDone();
    this.showPanel(text);
  }

  private showPanel(text: string): void {
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Performance test results');
    Object.assign(panel.style, {
      position: 'fixed', inset: '5%', zIndex: '100000', background: 'rgba(10,12,18,0.96)', color: '#dfe8f5',
      border: '1px solid #445', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
      font: '12px/1.4 ui-monospace, Consolas, monospace',
    } satisfies Partial<CSSStyleDeclaration>);
    const head = document.createElement('div');
    head.textContent = 'Performance test finished — the log was downloaded; you can also copy it here.';
    const pre = document.createElement('pre');
    Object.assign(pre.style, { flex: '1', overflow: 'auto', margin: '0', whiteSpace: 'pre' } satisfies Partial<CSSStyleDeclaration>);
    pre.textContent = text;
    const bar = document.createElement('div');
    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    copy.setAttribute('aria-label', 'Copy the performance log');
    copy.addEventListener('click', () => { void navigator.clipboard?.writeText(text).then(() => { copy.textContent = 'Copied'; }); });
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.setAttribute('aria-label', 'Close the performance log');
    close.addEventListener('click', () => panel.remove());
    bar.append(copy, ' ', close);
    panel.append(head, pre, bar);
    document.body.appendChild(panel);
  }
}
