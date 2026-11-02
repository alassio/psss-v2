/**
 * @file v8 21.12 (§E.1) — **the L-frame**: the one honest picture of a *warp*.
 *
 * A deformed lattice at the live canvas's aspect ratio, with the `waveX` profile along the top edge and the
 * `waveY` profile down the left edge — the two 1-D quantities the term rows author, drawn where they act. Pure:
 * `import type` only, **arity 2** (canvas, model) like `score-canvas.ts`.
 *
 * ⚠️ **THIS IS NOT THE OUTPUT, AND THE TAB'S COPY MUST SAY SO ONCE.** It is the displacement the output is
 * *sampled through*. A user who reads a lattice line as a particle path will diagnose the whole warp backwards
 * — the same invariant-25 hazard the Score's "diagram, not a preview" label exists for, in the one form where
 * the picture looks even more like a render than the Score does.
 *
 * ⚠️ **IT MAY HONESTLY DRAW AT `time: 0`, AND THIS PARAGRAPH IS WHY IT MUST NOT BE "FIXED".** `drift` is a
 * **rigid translation** of the field (`DRIFT_RATE = 2π` exactly, so `drift` is cells/second), so every harmonic
 * shifts by the same distance: the shape and the peak are time-invariant and one instant is the whole story.
 * That is the exact opposite of the Composer's Score, where the subject IS periodic and `t = 0` is invariant
 * 28's trap. Someone arriving from `score-canvas.ts` will recognise the shape of that defect here and be
 * wrong; making the instant a parameter would add a jitter to a static diagram and answer nothing.
 *
 * ⚠️ **The lattice comes from `offsets` and the edge profiles from `waveX`/`waveY`, and the two are different
 * quantities.** Styles 1-3 multiply the profiles by distance from the zoom centre, so the lattice is NOT a plot
 * of the profiles — building it from them would be a copy of the field formula (`fieldcheck` §D polices four
 * already), and it would draw a style-0 picture for every style.
 *
 * ⚠️ **The crosshair is drawn from the model's own centre, never from the middle of the box.** 41 of the 72
 * style-1..3 library presets are off centre, so a picture that assumes the middle is wrong for the majority —
 * and the centre is what decides the lattice's whole character on those styles.
 *
 * ⚠️ **The lattice is drawn to a MEASURED exaggeration and the box says the factor.** True-to-scale is
 * unusable: the library's authored fields span 3.2 px to 2074 px on a 1920-wide frame, and at the ~320 px the
 * panel gives this box a 3.2 px field is 0.5 px of ink — invisible, i.e. indistinguishable from the exact
 * identity that `describeStaticField` has three separate sentences to tell apart. So the displacement is scaled
 * to a fixed fraction of a lattice cell and the factor is printed: a picture of a *shape* with its scale
 * stated, never a measurement (the readout is the measurement, and it is the one place a number is claimed).
 */
import type { FieldMeasurement } from './field-measure.ts';

/** Fraction of one lattice cell the PEAK displacement is drawn as. */
const PEAK_CELLS = 0.85;

/**
 * Draw the L-frame. A null model is the degenerate-canvas case and clears the box — the caller owns the words.
 *
 * ⚠️ **Returns the exaggeration factor so the caller can print it.** Two owners of that number would be two
 * numbers; the drawing is the one that knows it, because it is the one that chose the box.
 */
export function drawFieldFrame(canvas: HTMLCanvasElement, m: FieldMeasurement | null): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 1;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 220;
  // ⚠️ Assign only on CHANGE: writing `canvas.width` clears the canvas and reallocates its backing store, so an
  // unconditional assignment turns every redraw into an allocation (invariant 8 is about rate).
  const wantW = Math.round(cssW * dpr), wantH = Math.round(cssH * dpr);
  if (canvas.width !== wantW) canvas.width = wantW;
  if (canvas.height !== wantH) canvas.height = wantH;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!m) return 1;

  // The L: the profiles live in a gutter on the top and left, the lattice in the rest.
  const gutter = Math.round(26 * dpr);
  const pad = Math.round(6 * dpr);
  const boxX = pad + gutter, boxY = pad + gutter;
  const boxW = canvas.width - boxX - pad, boxH = canvas.height - boxY - pad;
  if (boxW < 8 || boxH < 8) return 1;

  // ⚠️ **The FRAME's aspect ratio, letterboxed inside the box — not the box's.** The lattice's deformation is
  // read as a shape, and stretching it to a panel-shaped box would make a square field look wide. `min` of the
  // two scales, then centre what is left over.
  const scale = Math.min(boxW / m.width, boxH / m.height);
  const fw = m.width * scale, fh = m.height * scale;
  const ox = boxX + (boxW - fw) / 2, oy = boxY + (boxH - fh) / 2;

  // The frame itself, so the deformation has something to be relative to.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1 * dpr;
  ctx.strokeRect(ox, oy, fw, fh);

  const n = m.n;
  const stride = Math.max(1, Math.round(n / 16));
  // One lattice cell in device pixels, then the exaggeration that puts the PEAK at `PEAK_CELLS` of it.
  const cell = Math.min(fw, fh) / (n / stride);
  const exaggeration = m.peak > 0 ? (PEAK_CELLS * cell) / (m.peak * scale) : 1;
  const k = scale * exaggeration;

  // Node position in device pixels: the undisplaced lattice point plus the exaggerated displacement.
  const px = (ix: number, iy: number): [number, number] => {
    const i = 2 * (iy * n + ix);
    return [
      ox + (ix / (n - 1)) * fw + (m.offsets[i] ?? 0) * k,
      oy + (iy / (n - 1)) * fh + (m.offsets[i + 1] ?? 0) * k,
    ];
  };

  ctx.strokeStyle = 'rgba(120,200,255,0.55)';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  // Rows, then columns. Every node along a drawn line is visited (not every 4th), or a smooth field would read
  // as a polygon and a sharp one as a smooth one.
  for (let iy = 0; iy < n; iy += stride) {
    for (let ix = 0; ix < n; ix++) {
      const [x, y] = px(ix, iy);
      if (ix === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  for (let ix = 0; ix < n; ix += stride) {
    for (let iy = 0; iy < n; iy++) {
      const [x, y] = px(ix, iy);
      if (iy === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // The zoom centre. Style 0 ignores it entirely, so drawing it there would assert a dependence that is not
  // there — one of the two things this picture exists to make visible.
  if (m.style !== 0) {
    const cx = ox + (m.cx / m.width) * fw;
    const cy = oy + (m.cy / m.height) * fh;
    const r = 4 * dpr;
    ctx.strokeStyle = 'rgba(255,190,90,0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();
  }

  // The two profiles, each normalised to ITS OWN maximum — they are shapes here, and the magnitude is the
  // readout's job. ⚠️ An axis whose profile is all zeros draws NOTHING rather than a flat line through the
  // middle: "silent" and "silent, and here is a line" are the two readings invariant 29 says to keep apart, and
  // the panes say the word.
  /*
   * ⚠️ **THE LENGTH IS THE ARRAY'S OWN, AND IT USED TO BE `m.width`/`m.height` (fixed `35.4`).** Those were
   * the same number until `35.3`: a rotated wave table is `hypot(w,h)`-sized and indexed along its OWN
   * sampling direction, not per column or per row (see `FieldMeasurement.waveX`). Passing the frame
   * dimension drew the first `width` entries of a 2203-entry table — a PREFIX of the wave, while `max`
   * above was already taken over the whole of it, so the drawing was both clipped and mis-normalised with
   * nothing to say so. At every angle 0 the two lengths are equal, so this is bit-identical there.
   */
  const profile = (arr: Float64Array, along: 'x' | 'y'): void => {
    let max = 0;
    for (let i = 0; i < arr.length; i++) { const a = Math.abs(arr[i] ?? 0); if (a > max) max = a; }
    if (max === 0) return;
    const len = arr.length;
    const half = gutter / 2 - 1 * dpr;
    ctx.strokeStyle = 'rgba(180,255,200,0.70)';
    ctx.beginPath();
    const steps = 128;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const v = (arr[Math.min(len - 1, Math.round(t * (len - 1)))] ?? 0) / max;
      const x = along === 'x' ? ox + t * fw : pad + half - v * half;
      const y = along === 'x' ? pad + half - v * half : oy + t * fh;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  profile(m.waveX, 'x');
  profile(m.waveY, 'y');

  return exaggeration;
}
