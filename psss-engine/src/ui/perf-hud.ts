/**
 * @file v8 performance pass (owner, 2026-11-10) — **the `?perf=1` overlay**: what the main view and the tile grids
 * actually cost on THIS machine, so a slower machine can be measured where it runs rather than inferred from a fast one.
 *
 * Opt-in only, and cheap: it records one number per frame and touches the DOM twice a second. It READS — it changes no
 * budget and no setting — so turning it on does not change what it measures beyond that DOM write.
 *
 * ⚠️ **THE FRAME BREAKDOWN** — `begin(name)`/`end(name)` around each section of the main frame (`trail` = the decay
 * pass, a copy plus a fade; `figure` = the CPU figure computation; `particles`, `lines`, `ribbons`, `warp`,
 * `discharge`, `glow`, `grade`, `present` = the plain blit to the screen when there is no grade; `tiles`).
 *
 * ⚠️ **`worst 10 s`** is the longest single frame of the last ten seconds. p50/p95 are taken over one half-second
 * window, so a lone hitch — the frame a reel spends switching presets — is invisible in them; this is the reading
 * for it. CPU time is always
 * measured. GPU time is measured with `EXT_disjoint_timer_query_webgl2` WHERE THE MACHINE OFFERS IT (most real GPUs
 * do; a software renderer usually does not, and the row then says `gpu n/a`). Queries are read back FRAMES later —
 * never waited on — and a window in which the GPU reports a DISJOINT event (a clock change, a context switch) is
 * discarded rather than averaged. ⚠️ Timer queries cannot nest, so `begin` closes an open query first: sections must
 * be sequential, which the call sites in `main.ts` are.
 *
 * Per tile renderer it shows the steady renders, the warm-up (first-image) renders and the images DELIVERED per second,
 * the async readback's mean latency (issue → paint), the active slots, and `pressure` — the main loop's frame time over
 * the estimated refresh interval (1 = every frame on time), the quantity that scales the tile animation budget.
 */

/** One tile renderer's cumulative counters, as `GridTileRenderer.getStats()` returns them. */
export interface TileStats {
  slots: number; rendered: number; warmRendered: number; delivered: number; readbacks: number;
  readbackLatencyMs: number; pressure: number; refreshMs: number;
}

export interface PerfHudSources {
  /** Named tile renderers; a getter returning null is skipped (a renderer not built yet). */
  tiles: () => { label: string; stats: TileStats | null }[];
  /** The main view: the guard's level and the canvas size in device pixels. */
  main: () => { guardLevel: number; canvasW: number; canvasH: number };
}

/** The WebGL2 timer-query extension's constants, typed locally (lib.dom has no type for it). */
interface TimerExt { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }

export class PerfHud {
  private readonly el: HTMLDivElement;
  private readonly dts: number[] = [];
  /** Every frame of the last ten seconds as [timestamp, dt], for `worst 10 s`. */
  private readonly recent: [number, number][] = [];
  private lastPaint = 0;
  private prev = new Map<string, TileStats>();
  /** Section order as first seen, CPU ms accumulated this window, GPU ms accumulated, and frames this window. */
  private readonly order: string[] = [];
  private readonly cpuMs = new Map<string, number>();
  private readonly gpuMs = new Map<string, number>();
  private readonly cpuStart = new Map<string, number>();
  private frames = 0;
  private readonly ext: TimerExt | null;
  private active: { name: string; q: WebGLQuery } | null = null;
  private readonly pending: { name: string; q: WebGLQuery }[] = [];
  private readonly pool: WebGLQuery[] = [];
  private disjoint = false;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly src: PerfHudSources) {
    this.ext = (gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null) ?? null;
    this.el = document.createElement('div');
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {
      position: 'fixed', left: '8px', top: '8px', zIndex: '99999', pointerEvents: 'none',
      font: '11px/1.35 ui-monospace, Consolas, monospace', color: '#cfe8ff', background: 'rgba(0,0,0,0.72)',
      padding: '6px 8px', borderRadius: '4px', whiteSpace: 'pre',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.el);
    this.lastPaint = performance.now();
  }

  /** Start timing one section of the frame (CPU always; GPU where the timer extension exists). */
  begin(name: string): void {
    if (!this.cpuMs.has(name)) { this.order.push(name); this.cpuMs.set(name, 0); this.gpuMs.set(name, 0); }
    this.cpuStart.set(name, performance.now());
    if (!this.ext) return;
    if (this.active) this.closeQuery();
    const q = this.pool.pop() ?? this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = { name, q };
  }

  /** End the section `begin` opened. */
  end(name: string): void {
    const s = this.cpuStart.get(name);
    if (s !== undefined) { this.cpuMs.set(name, (this.cpuMs.get(name) ?? 0) + performance.now() - s); this.cpuStart.delete(name); }
    if (this.active && this.active.name === name) this.closeQuery();
  }

  private closeQuery(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Collect finished GPU queries, in order, without ever waiting on one. */
  private pollQueries(): void {
    if (!this.ext) return;
    const gl = this.gl;
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) this.disjoint = true;
    while (this.pending.length > 0) {
      const head = this.pending[0]!;
      if (!gl.getQueryParameter(head.q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(head.q, gl.QUERY_RESULT) as number;
      this.gpuMs.set(head.name, (this.gpuMs.get(head.name) ?? 0) + ns / 1e6);
      this.pool.push(head.q);
      this.pending.shift();
    }
  }

  /** Called once per main-loop frame with its interval in ms. */
  frame(dt: number): void {
    const now = performance.now();
    if (Number.isFinite(dt) && dt > 0) { this.dts.push(dt); this.recent.push([now, dt]); }
    while (this.recent.length > 0 && now - this.recent[0]![0] > 10_000) this.recent.shift();
    this.frames++;
    this.pollQueries();
    const span = now - this.lastPaint;
    if (span < 500) return;
    this.lastPaint = now;
    const s = this.dts.splice(0).sort((a, b) => a - b);
    const q = (f: number): number => (s.length ? s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]! : 0);
    const m = this.src.main();
    const lines = [
      `main  ${(s.length / (span / 1000)).toFixed(1).padStart(5)} fps   p50 ${q(0.5).toFixed(1)} ms   p95 ${q(0.95).toFixed(1)} ms   worst 10 s ${this.recent.reduce((m, r) => Math.max(m, r[1]), 0).toFixed(0)} ms`,
      `      guard L${m.guardLevel}   canvas ${m.canvasW}x${m.canvasH}   ${this.ext ? (this.disjoint ? 'gpu timing: window discarded (disjoint)' : 'gpu timing: on') : 'gpu timing: n/a on this machine'}`,
      'per frame         cpu ms   gpu ms',
    ];
    const f = Math.max(1, this.frames);
    for (const name of this.order) {
      const c = (this.cpuMs.get(name) ?? 0) / f, g = (this.gpuMs.get(name) ?? 0) / f;
      lines.push(`  ${name.padEnd(12)} ${c.toFixed(2).padStart(7)}  ${this.ext && !this.disjoint ? g.toFixed(2).padStart(7) : '    n/a'}`);
      this.cpuMs.set(name, 0); this.gpuMs.set(name, 0);
    }
    this.frames = 0;
    this.disjoint = false;
    for (const { label, stats } of this.src.tiles()) {
      if (!stats || stats.slots === 0) continue;
      const p = this.prev.get(label);
      this.prev.set(label, { ...stats });
      if (!p) continue;
      const per = (k: 'rendered' | 'warmRendered' | 'delivered'): string => ((stats[k] - p[k]) / (span / 1000)).toFixed(1);
      const rb = stats.readbacks - p.readbacks;
      const lat = rb > 0 ? ((stats.readbackLatencyMs - p.readbackLatencyMs) / rb).toFixed(0) : '-';
      lines.push(`${label.padEnd(6)}${String(stats.slots).padStart(3)} tiles  render ${per('rendered')}/s  first ${per('warmRendered')}/s  `
        + `shown ${per('delivered')}/s  readback ${lat} ms  pressure ${stats.pressure.toFixed(2)}`);
    }
    this.el.textContent = lines.join('\n');
  }

  dispose(): void {
    this.el.remove();
    for (const p of this.pending) this.gl.deleteQuery(p.q);
    for (const q of this.pool) this.gl.deleteQuery(q);
  }
}
