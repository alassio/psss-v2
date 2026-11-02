/**
 * docs-to-pdf.mjs — render the two top-level documents to PDF.
 *
 *   node scripts/docs-to-pdf.mjs            both documents
 *   node scripts/docs-to-pdf.mjs --only use just `psss-engine-v2_how_to_use_it.md`
 *
 * Markdown is converted by `marked` and printed by the Chromium that `@playwright/test` already
 * installs — so this step adds ONE small dependency and no second browser.
 *
 * ⚠️ **REQUIRES `npm install --save-dev marked` ONCE** — the ONE dependency either new build step has.
 * It is declared in `package.json`, and a missing one fails here with a message naming the command
 * rather than a module-resolution stack. The sibling `package-dist.mjs` needs nothing at all: it uses
 * Windows' own `bsdtar`, after an `adm-zip` dependency proved unreachable from the registry.
 *
 * ⚠️ **THE TEMPORARY HTML IS WRITTEN BESIDE THE SOURCE, IN THE REPOSITORY ROOT, AND THAT IS LOAD-BEARING.**
 * The user manual embeds 32 images as relative paths (`manual-images/…`). Chromium resolves them against
 * the page's own URL, so an HTML file written to a temp directory — or content injected with
 * `setContent()`, which has no URL at all — silently produces a PDF with every image missing. It is
 * written next to the markdown and deleted in a `finally`, so a crash cannot leave it behind.
 *
 * ⚠️ **A MISSING IMAGE IS A BUILD FAILURE, NOT A GAP IN THE PDF.** Chromium reports a broken image by
 * drawing nothing; the PDF still renders and still looks plausible. `requestfailed` is therefore
 * collected and any failure for a local file aborts the step, because the alternative is shipping a
 * manual whose screenshots are blank and finding out from a reader.
 */

import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');          // the repository root, where the documents live
const TAG = '[docs-to-pdf]';

/**
 * Target print resolution for embedded screenshots, and the width it implies.
 *
 * `page.pdf()` embeds an image at its NATURAL pixel size, so the manual's captures — taken at
 * `deviceScaleFactor` 2 for on-screen reading of the markdown — went into the PDF at up to 3200 px
 * wide. Measured: A4 less the 14 mm margins is 182 mm, i.e. **1074 px at 150 dpi and 1433 at 200**, so
 * the widest capture was **3.0× oversampled** and the images were 81 % of a 13.7 MB file.
 *
 * ⚠️ **200 dpi rather than 150 is deliberate** (owner, 2026-10-11): these are screenshots of a UI full
 * of small text, and small text is the first thing downsampling damages.
 *
 * ⚠️ **`manual-images/` IS NOT TOUCHED.** The resampling happens in the page, on the way into the PDF
 * only, so the markdown keeps the full-resolution originals. A build must not degrade its own inputs.
 */
const PRINT_DPI = (() => {
  const i = process.argv.indexOf('--dpi');
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  // ⚠️ A flag, because the right value is a JUDGEMENT about screenshot legibility and the only way to
  // make it is to compare two builds. Measured at the captures' 1600 px median: 200 dpi gives a 1433 px
  // target, an 11 % linear reduction that re-encoding mostly eats — so most images are left alone and
  // the saving comes from the few very wide ones. 150 dpi gives 1074 px, a 1.49x reduction that does pay.
  return Number.isFinite(v) && v >= 72 && v <= 600 ? v : 200;
})();
const PRINT_WIDTH_MM = 182;                       // A4 (210 mm) less the 14 mm margins each side
const MAX_IMAGE_PX = Math.round((PRINT_WIDTH_MM / 25.4) * PRINT_DPI);
/** CSS px available to an image in the layout, for the no-upscale assertion below. */
const COLUMN_CSS_PX = Math.round((PRINT_WIDTH_MM / 25.4) * 96);

/**
 * JPEG quality for the resampled candidate.
 *
 * ⚠️ **TWO ENCODERS ARE TRIED PER IMAGE AND THE SMALLER WINS, because resampling CHANGES WHICH ONE IS
 * RIGHT.** The captures are PNG and compress well at full size — large exactly-flat regions. A
 * high-quality downscale replaces those flats with interpolated gradients, so PNG's filters stop paying:
 * measured, canvas PNG came out at **0.61 bytes/pixel against the originals' 0.28**, and a 5x pixel
 * reduction still only took the file from 13.7 MB to 11.2 MB.
 *
 * ⚠️ **AND THE ORIGINAL IS THE THIRD CANDIDATE: a swap that would not shrink the image is REFUSED.**
 * That is what makes this step unable to regress — without it, re-encoding a small or already-efficient
 * PNG makes the PDF bigger, silently, which is exactly what the first version of it did.
 */
const IMAGE_QUALITY = 0.92;

/** The documents to render, in the order the console reports them. */
const DOCS = [
  { md: 'psss-engine-v2_how_it_works.md', title: 'PSSS v2 — How It Works' },
  { md: 'psss-engine-v2_how_to_use_it.md', title: 'PSSS v2 — How To Use It' },
];

// ── dependencies, named explicitly when absent ───────────────────────────────────────────────────
async function load(name, hint) {
  try {
    return await import(name);
  } catch {
    console.error(`${TAG} missing dependency '${name}'.`);
    console.error(`${TAG} run:  npm install --save-dev ${hint}`);
    process.exit(1);
  }
}

const { marked } = await load('marked', 'marked');
const { chromium } = await load('playwright', '@playwright/test');

/**
 * Print stylesheet. Deliberately plain: this is a reference document, not a brochure.
 *
 * ⚠️ `break-inside: avoid` on table ROWS rather than on tables. Several tables here run for pages
 * (Appendix A.4 is 139 rows), so avoiding a break inside the table would push the whole thing onto a
 * fresh page and leave most of one blank — and on a table taller than a page, Chromium ignores it
 * anyway. Per row is what actually keeps a cell's text together.
 */
const CSS = `
  @page { size: A4; margin: 18mm 14mm 20mm 14mm; }
  body { font: 10.5pt/1.5 "Segoe UI", system-ui, sans-serif; color: #111; }
  h1 { font-size: 20pt; border-bottom: 2px solid #333; padding-bottom: 4px; break-before: page; }
  h1:first-of-type { break-before: avoid; }
  h2 { font-size: 15pt; margin-top: 1.4em; }
  h3 { font-size: 12.5pt; margin-top: 1.2em; }
  h4 { font-size: 11pt; margin-top: 1em; }
  h1, h2, h3, h4 { break-after: avoid; }
  p, li { orphans: 2; widows: 2; }
  code { font: 9.5pt/1.4 "Cascadia Mono", Consolas, monospace; background: #f3f3f3;
         padding: 0.5px 3px; border-radius: 3px; }
  pre { background: #f6f6f6; border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px;
        overflow-wrap: break-word; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 9pt; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #efefef; }
  tr { break-inside: avoid; }
  blockquote { margin: 0.8em 0; padding: 6px 12px; border-left: 3px solid #999; background: #fafafa;
               break-inside: avoid; }
  img { max-width: 100%; height: auto; break-inside: avoid; }
  a { color: #0b5; text-decoration: none; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.4em 0; }
`;

function page(title, bodyHtml) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<title>${title}</title><style>${CSS}</style></head><body>${bodyHtml}</body></html>`;
}

// ── render ───────────────────────────────────────────────────────────────────────────────────────
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
/** `--full-res` embeds the captures at their original size — the pre-2026-10-11 behaviour, for comparison. */
const noResample = process.argv.includes('--full-res');

/**
 * `--doc <file.md> [--title "..."]` — render ONE arbitrary root-level document instead of `DOCS`.
 *
 * ⚠️ **THIS EXISTS SO THAT AD-HOC DOCUMENTS DO NOT GO INTO `DOCS`, AND THAT DISTINCTION IS
 * LOAD-BEARING.** `DOCS` is what `build:all` renders, and `package:dist` then puts those PDFs into the
 * release zip. A research study or a review is **not** a shipped artefact of the engine, so adding one
 * to `DOCS` would silently grow the release and make `build:all` fail whenever that file is absent —
 * the step treats a missing document as a build failure, correctly, for the two documents it owns.
 *
 * ⚠️ So: **`DOCS` is for documents the ENGINE SHIPS. `--doc` is for everything else.** It overrides the
 * list rather than extending it, so `build:all`'s contract is untouched and no README build-output row
 * changes.
 *
 * The title defaults to the filename without its extension, which is adequate for a one-off; pass
 * `--title` when the running header matters.
 */
const docFlag = process.argv.includes('--doc') ? process.argv[process.argv.indexOf('--doc') + 1] : null;
const titleFlag = process.argv.includes('--title') ? process.argv[process.argv.indexOf('--title') + 1] : null;

let wanted;
if (docFlag) {
  if (!docFlag.endsWith('.md')) {
    console.error(`${TAG} --doc expects a .md filename relative to the repository root, got '${docFlag}'`);
    process.exit(1);
  }
  wanted = [{ md: docFlag, title: titleFlag ?? docFlag.replace(/\.md$/, '') }];
} else {
  wanted = DOCS.filter((d) => !only || d.md.includes(only));
  if (wanted.length === 0) {
    console.error(`${TAG} --only '${only}' matched none of: ${DOCS.map((d) => d.md).join(', ')}`);
    process.exit(1);
  }
}

marked.setOptions({ gfm: true, breaks: false });

/*
 * ⚠️ **`--allow-file-access-from-files` IS REQUIRED FOR THE RESAMPLING AND FOR NOTHING ELSE.** The page
 * is loaded over `file://`, and drawing a `file://` image onto a canvas TAINTS that canvas, so
 * `toDataURL()` throws `SecurityError: Tainted canvases may not be exported`. The flag makes local files
 * same-origin with each other, which is what un-taints it.
 *
 * ⚠️ **It is a deliberate, scoped relaxation**: this browser is launched by a build step, renders two
 * local markdown files and is closed immediately. It never loads anything remote. **Do not copy the flag
 * into the Playwright suite or into anything that opens a page the user supplies.**
 */
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
let failed = 0;

for (const doc of wanted) {
  const mdPath = join(ROOT, doc.md);
  if (!existsSync(mdPath)) {
    console.error(`${TAG} FAIL ${doc.md} — not found at ${mdPath}`);
    failed++;
    continue;
  }

  const md = readFileSync(mdPath, 'utf8');
  const html = page(doc.title, marked.parse(md));
  const tmpPath = join(ROOT, `.${doc.md}.pdfbuild.html`);
  const pdfPath = mdPath.replace(/\.md$/, '.pdf');

  /*
   * Original byte sizes, measured in NODE and handed to the page.
   *
   * ⚠️ **`fetch()` CANNOT READ A `file://` SIBLING, so the page cannot weigh its own images.** Measured
   * twice now in this project — it is the same constraint that forces the deployment's data files to be
   * scripts rather than JSON (`presets/deployment-format.ts`). `--allow-file-access-from-files` un-taints
   * a canvas; it does not give `fetch` a file transport.
   */
  const srcSizes = {};
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const rel = m[1];
    const abs = join(ROOT, rel);
    if (existsSync(abs)) srcSizes[rel] = statSync(abs).size;
  }

  writeFileSync(tmpPath, html, 'utf8');
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();

  // See the header: a broken local image renders as nothing and is invisible in the output.
  const brokenAssets = [];
  pg.on('requestfailed', (req) => {
    if (req.url().startsWith('file:')) brokenAssets.push(req.url());
  });

  try {
    await pg.goto(pathToFileURL(tmpPath).href, { waitUntil: 'load' });
    // `load` does not wait for lazily-decoded images; this does.
    await pg.evaluate(() => Promise.all(
      Array.from(document.images).filter((i) => !i.complete).map((i) => i.decode().catch(() => {})),
    ));

    const imgTotal = await pg.evaluate(() => document.images.length);
    const imgBroken = await pg.evaluate(
      () => Array.from(document.images).filter((i) => i.naturalWidth === 0).length,
    );

    if (brokenAssets.length > 0 || imgBroken > 0) {
      console.error(`${TAG} FAIL ${doc.md} — ${imgBroken} of ${imgTotal} images did not load`);
      for (const u of brokenAssets.slice(0, 5)) console.error(`${TAG}        ${u}`);
      failed++;
      continue;
    }

    /*
     * Resample oversized images, in the page, with the browser's own scaler.
     *
     * ⚠️ **ONLY EVER DOWN, NEVER UP** — an image already narrower than the target is left completely
     * alone, not re-encoded. Re-encoding a small PNG through a canvas can make it BIGGER (the original
     * is an optimised file; `toDataURL` is not), and upscaling would add bytes for no resolution.
     *
     * ⚠️ **THE RENDERED SIZE MUST NOT CHANGE, and the reason it does not is an inequality worth
     * stating:** the layout gives an image at most `COLUMN_CSS_PX` (688), and the target is
     * `MAX_IMAGE_PX` (1433), so a downsampled image is still wider than the column and `max-width: 100%`
     * keeps displaying it at exactly the same size. **If the target ever drops below the column width
     * this stops being true and images start rendering smaller**, which is why the assert is here.
     */
    if (MAX_IMAGE_PX < COLUMN_CSS_PX) {
      console.error(`${TAG} FAIL — PRINT_DPI ${PRINT_DPI} gives ${MAX_IMAGE_PX}px, under the `
        + `${COLUMN_CSS_PX}px column: images would render smaller, not just softer`);
      failed++;
      continue;
    }

    const resampled = noResample ? { done: 0, skipped: imgTotal, resized: 0, before: 0, after: 0 } : await pg.evaluate(
      async ({ maxPx, quality, sizes }) => {
        let done = 0, skipped = 0, resized = 0, before = 0, after = 0;
        for (const img of Array.from(document.images)) {
          // The original's own byte count, so the swap can be refused if it would not pay. Supplied by
          // the caller: see the note above `srcSizes` for why the page cannot measure this itself.
          const origBytes = sizes[img.getAttribute('src')] ?? 0;
          before += origBytes;

          // ⚠️ **NO WIDTH-BASED EARLY SKIP.** An image narrower than the target is NOT resized, but it
          // is still offered to the encoder comparison, because the two questions are independent:
          // "is it too big for print" and "is PNG the right format for it". Measured — the seven recipe
          // captures are 600x900 and cost 2280 KB as PNG against 653 KB as JPEG, and an early skip on
          // width left every one of them untouched. The first version of this step did exactly that.
          // ⚠️ Captured BEFORE the swap. The first version of the counter below tested
          // `targetW < img.naturalWidth` after assigning `img.src`, by which point `naturalWidth` is the
          // NEW width — so it reported "0 resized" on a run that had just resized a 3200px capture.
          // **A counter that reads the element it just mutated measures the wrong thing.**
          const naturalW = img.naturalWidth;
          const targetW = Math.min(maxPx, naturalW);
          const scale = targetW / naturalW;
          const c = document.createElement('canvas');
          c.width = targetW;
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, c.width, c.height);

          // Two candidates, because neither encoder wins on every image — see the header.
          const png = c.toDataURL('image/png');
          const jpg = c.toDataURL('image/jpeg', quality);
          const best = jpg.length < png.length ? jpg : png;
          const bestBytes = Math.round((best.length - best.indexOf(',') - 1) * 3 / 4);

          // origBytes 0 means the caller could not measure it; treat that as 'do not risk it'.
          if (origBytes === 0 || bestBytes >= origBytes) { skipped++; after += origBytes; continue; }

          await new Promise((res) => {
            img.addEventListener('load', res, { once: true });
            img.addEventListener('error', res, { once: true });
            img.src = best;
          });
          after += bestBytes;
          done++;
          if (targetW < naturalW) resized++;
        }
        return { done, skipped, resized, before, after };
      },
      { maxPx: MAX_IMAGE_PX, quality: IMAGE_QUALITY, sizes: srcSizes },
    );

    // The swap must not have broken anything — same check as above, after the replacement.
    const stillBroken = await pg.evaluate(
      () => Array.from(document.images).filter((i) => i.naturalWidth === 0).length,
    );
    if (stillBroken > 0) {
      console.error(`${TAG} FAIL ${doc.md} — ${stillBroken} image(s) broken AFTER resampling`);
      failed++;
      continue;
    }

    await pg.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font:7pt sans-serif;color:#888;width:100%;padding:0 14mm;">`
        + `<span>${doc.title}</span></div>`,
      footerTemplate: `<div style="font:7pt sans-serif;color:#888;width:100%;padding:0 14mm;`
        + `text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      margin: { top: '18mm', bottom: '20mm', left: '14mm', right: '14mm' },
    });

    const kb = Math.round(statSync(pdfPath).size / 1024);
    // A PDF of a document this size cannot legitimately be tiny; a near-empty one means the markdown
    // converted to nothing, which `marked` does without complaining on a bad input.
    if (kb < 20) {
      console.error(`${TAG} FAIL ${doc.md} — wrote only ${kb} KB, which cannot be the whole document`);
      failed++;
      continue;
    }
    const imgNote = imgTotal === 0
      ? 'no images'
      : `${imgTotal} image(s): ${resampled.done} re-encoded (${resampled.resized} also resized to `
        + `${MAX_IMAGE_PX}px / ${PRINT_DPI} dpi), ${resampled.skipped} kept as-is; images `
        + `${(resampled.before / 1048576).toFixed(1)} MB -> ${(resampled.after / 1048576).toFixed(1)} MB`;
    console.log(`${TAG} ${doc.md.replace(/\.md$/, '.pdf')}  ${kb} KB, ${imgNote}`);
  } finally {
    await ctx.close();
    rmSync(tmpPath, { force: true });
  }
}

await browser.close();

if (failed > 0) {
  console.error(`${TAG} ${failed} document(s) failed`);
  process.exit(1);
}
console.log(`${TAG} OK`);
