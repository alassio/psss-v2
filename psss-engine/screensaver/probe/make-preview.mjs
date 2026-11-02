/*
 * 20.7's `preview.png`, captured the way the plan requires: "a frame captured once from the
 * main reel ... with the same Playwright + SwiftShader configuration the specs use, at the
 * preview's aspect ratio, from a preset that is legible small".
 *
 * ⚠️ THE VIEWPORT IS THE PREVIEW'S ASPECT RATIO AND NOT A ROUND NUMBER. Settings' preview
 * area is ~152x112, so this renders at 4x that (608x448) and lets `StretchBlt(HALFTONE)`
 * do the final reduction. Capturing at 16:9 and letting GDI squash it would change the
 * FIGURE's proportions, which on a wave-based engine is a shape change rather than a
 * cropping choice — the engine's own image-domain rule (invariant 26): measure length on one
 * shared scale, and a thumbnail is an image-domain operator like any other.
 *
 * ⚠️ IT CAPTURES SEVERAL CANDIDATES AND PICKS NONE. "Legible small" is a judgement no
 * measurement in this repo can make — a checker can confirm the file exists and decodes,
 * not that a human can tell what it is at 152 px. So this writes one candidate per reel slot
 * and a human chooses; that choice is recorded in RUN-RECORD.md.
 *
 * ⚠️ `?reel=1`, NOT a synthesised preset load. The point is that the thumbnail shows what the
 * screensaver actually shows, and the only faithful source of that is the main reel playing
 * through the presentation path — the same path `?screensaver=1` uses. Clicking a grid tile
 * would sample a preset in the ORDINARY panel layout, at a different canvas size, with the
 * grid's own 360 live tiles competing for the same CPU rasteriser.
 *
 * Run from `psss-engine/` after `npm run build`:
 *   node screensaver/probe/make-preview.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Copied from playwright.config.ts rather than imported: that file is a `defineConfig`
// default export and does not publish the array. ⚠️ Two copies with no compiler between
// them — if the specs' args change, change these. `--enable-unsafe-swiftshader` is an
// ASSERTION about which rasteriser drew the frame, not a fallback.
const SWIFTSHADER_ARGS = ['--enable-unsafe-swiftshader', '--disable-lcd-text', '--force-color-profile=srgb'];

const PREVIEW_WIDTH = 608;
const PREVIEW_HEIGHT = 448;

// One capture per reel slot, sampled at the MIDDLE of each 20 s slot so no frame lands in a
// cross-fade — a blended frame is neither preset and would be the least legible of all.
const SLOT_SECONDS = 20;
const SLOTS_TO_SAMPLE = 6;

const here = path.dirname(fileURLToPath(import.meta.url));
const distIndex = path.resolve(here, '..', '..', 'dist', 'index.html');

const browser = await chromium.launch({ args: SWIFTSHADER_ARGS });
const page = await browser.newPage({ viewport: { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT } });

const presetLog = [];
page.on('console', (msg) => {
  const text = msg.text();
  if (/Preset:|Reel|preset/i.test(text)) presetLog.push(`${(Date.now() - t0) / 1000}s ${text}`);
});

const t0 = Date.now();
await page.goto(`${pathToFileURL(distIndex).href}?reel=1`);
await page.waitForTimeout(4000);

const canvas = page.locator('#canvas');
const box = await canvas.boundingBox();
console.log(`canvas box ${box?.width}x${box?.height} (asked for ${PREVIEW_WIDTH}x${PREVIEW_HEIGHT})`);

for (let slot = 0; slot < SLOTS_TO_SAMPLE; slot++) {
  // Absolute wall-clock targets, so a slow capture does not accumulate drift into the next
  // slot and silently sample a cross-fade.
  const targetMs = (slot * SLOT_SECONDS + SLOT_SECONDS / 2) * 1000;
  const waitMs = targetMs - (Date.now() - t0);
  if (waitMs > 0) await page.waitForTimeout(waitMs);
  const out = path.join(here, `preview-cand-${slot + 1}.png`);
  await canvas.screenshot({ path: out });
  console.log(`slot ${slot + 1}: ${out} at ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

console.log('--- preset-related console lines ---');
for (const line of presetLog) console.log(line);

await browser.close();
