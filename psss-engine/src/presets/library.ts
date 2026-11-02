import { FIRE_PRESETS } from './fire-presets.ts';
import { FLOW_PRESETS } from './flow-presets.ts';
import { SHOWCASE_PRESETS } from './showcase-presets.ts';
import { CHAIN_PRESETS } from './chain-presets.ts';
import { DEMO_PRESETS } from './demo-presets.ts';
import { REFINED_PRESETS, REFINED_SUFFIX } from './refined-presets.ts';
import { VARIANT_PRESETS } from './variant-presets.ts';
import type { PresetManager } from './manager.ts';

/**
 * THE ONE OWNER OF LIBRARY COMPOSITION — the legacy JSON interleaved with its refined counterparts and
 * its anchored variants, then the five built-in TS groups in their fixed order.
 *
 * ⚠️ **THIS FUNCTION HAS TWO CALLERS THAT RUN IN DIFFERENT RUNTIMES, AND THAT IS THE WHOLE POINT.**
 * `main.ts` calls it in the browser for the dev build; `scripts/export-library.mjs` calls it in Node at
 * build time to write the deployment's single external preset file. Composition therefore exists ONCE, so
 * the deployed library cannot differ from the dev library in content, in count or — the property no type
 * catches — in ORDER. Duplicating the sequence into the exporter would have made every future preset group
 * a two-site edit whose omission is invisible in dev and only visible in a deployment nobody diffs.
 *
 * ⚠️ **KEEP IT FREE OF I/O AND OF ANYTHING BROWSER-ONLY.** The raw legacy presets are passed IN rather than
 * fetched here precisely so this module imports under `node --experimental-strip-types` (unflagged in Node
 * 22.18+): a `fetch` or a `document` reference anywhere in this file's import graph would move the exporter
 * from "a plain .mjs" to "a second bundler pass".
 *
 * @param rawPresets The parsed legacy `g_psss_presets` object, in file order.
 * @returns The number of refined/variant presets whose anchor was missing (see the orphan sweeps below).
 *          The caller owns the warning, because the two runtimes report differently.
 */
export function loadLibrary(manager: PresetManager, rawPresets: Record<string, unknown>): number {
  // Load presets from the legacy JSON file, INTERLEAVED with their refined counterparts.
  //
  // Each `"<Original> new"` entry is placed immediately after its original so the two can be compared
  // back to back in the preset dropdown and the preview grid. `PresetManager.list()` returns
  // `[...library.keys()]` and NOTHING sorts, so this insertion order is the only thing that decides
  // position — which is why the interleave happens here, in the single object handed to `loadAll`,
  // rather than as a separate load loop like the five TS groups below. A separate loop could only ever
  // append its 177 entries after all the originals.
  //
  // ⚠️ A PENDING pair's `REFINED_PRESETS` entry is keyed by the REFINED name (`"<Original> new"` — no
  // literal example is given here, because every settle deletes one and the last two examples went stale
  // that way), and the lookup below is by
  // original name + suffix. A rename on either side silently drops the pairing — the refined preset
  // would still load (see the orphan sweep after the loop) but would land at the end of the group
  // instead of beside its original, which reads as a positioning bug rather than a naming one.
  //
  // ⚠️ **A refined entry keyed by the ORIGINAL name REPLACES that original in place** — it does not add a
  // second tile, and the pair collapses to one entry. That is how a pairwise review is settled in favour
  // of the refined version: the JSON keeps its key (the file is read-only, and its key order is the only
  // thing deciding library position), while the body handed to `loadAll` is the refined one, so the
  // survivor keeps the original's NAME and POSITION. Without this branch the entry would fall to the
  // orphan sweep and land at the end of the group under a name that also exists in the JSON — a duplicate
  // key, which is a frozen tile rather than a repeated label (see `namecheck`).
  const interleaved: Record<string, unknown> = {};
  for (const [name, p] of Object.entries(rawPresets)) {
    // ⚠️ **THE TRANSMAP PASS-ORDER PIN USED TO BE APPLIED HERE AND IS GONE (2026-09-19).** `pass-order-pins.ts`
    // held the legacy anchors whose migrated pass order had to be forced to warp-last, and its own exit rule
    // was to delete itself once a settle emptied the list — which the fifth refined-preset batch did. All
    // fifteen anchors the T1 fix can move now ship a `REFINED_PRESETS` body that AUTHORS
    // `postProcessors.transMap.beforeParticles`, so this loop hands the winning body through untouched.
    // **Do not re-add a shim here**: the file, its ranked evidence table and the argument for both are in
    // `CLAUDE_old.md`, and `fieldcheck` §U asserts the pin-free invariant directly.
    interleaved[name] = REFINED_PRESETS[name] ?? p;
    const refined = REFINED_PRESETS[`${name}${REFINED_SUFFIX}`];
    if (refined) interleaved[`${name}${REFINED_SUFFIX}`] = refined;
    // ANCHORED VARIANTS — an ADDITIONAL preset that ships alongside `name` instead of replacing it.
    // ⚠️ Placed here, after the ` new` sibling, because this loop is the ONLY mechanism that can position
    // anything relative to a legacy key: the JSON is read-only, its key order is the sole source of
    // position, and `list()` sorts nothing. A variant appended by a separate load loop (as the five TS
    // groups below are) could only ever land after all 177 originals. Ordering within one anchor is the
    // array's own order, which is why `VARIANT_PRESETS` is an array and not a `Record`.
    for (const v of VARIANT_PRESETS) {
      // ⚠️ `atEnd` variants are DELIBERATELY not positioned here — see the append loop at the bottom.
      if (!v.atEnd && v.after === name) interleaved[v.name] = v.preset;
    }
  }
  // Any refined preset whose original is absent from the JSON still loads, so the group cannot be
  // silently truncated by an unpaired name. Appended rather than dropped, and counted so the
  // mismatch is visible instead of manifesting as a missing tile.
  let orphans = 0;
  for (const [name, p] of Object.entries(REFINED_PRESETS)) {
    if (!(name in interleaved)) { interleaved[name] = p; orphans++; }
  }
  // Same sweep for the variants, and for the same reason: a variant whose `after` names nothing (a typo,
  // or an anchor that a later settle renamed) would otherwise VANISH ENTIRELY rather than land in the
  // wrong place — a missing preset with no error, which is strictly harder to spot than a misplaced one.
  for (const v of VARIANT_PRESETS) {
    // ⚠️ `atEnd` entries are excluded: they are ABSENT from `interleaved` on purpose, so the orphan
    // sweep would "rescue" every one of them into the middle of the library and defeat the flag.
    if (!v.atEnd && !(v.name in interleaved)) { interleaved[v.name] = v.preset; orphans++; }
  }
  // ⚠️ **A THIRD sweep stood here until 2026-09-19** and it went the OPPOSITE way to the two above: a
  // pass-order pin carried no body, so one naming nothing had no preset to rescue — it just silently stopped
  // pinning, and the count was the only thing that would have said so. It went with `pass-order-pins.ts`.
  // ⚠️ **`orphans` therefore counts BODIES again, which it did not while the pins existed** — a reader
  // reconciling an older figure is reconciling two different quantities.
  manager.loadAll(interleaved);

  // Load built-in fire presets
  for (const [name, p] of Object.entries(FIRE_PRESETS)) {
    manager.importSingle(name, p);
  }

  // Load built-in flow presets (fire+flow combinations)
  for (const [name, p] of Object.entries(FLOW_PRESETS)) {
    manager.importSingle(name, p);
  }

  // Load built-in Phase 8 showcase presets (material ramp coverage / ice crystals / Fire-Ice duel)
  for (const [name, p] of Object.entries(SHOWCASE_PRESETS)) {
    manager.importSingle(name, p);
  }

  // Load TransMap layer-chain presets. `PresetManager.list()` returns `[...library.keys()]` and a `Map`
  // preserves insertion order, so this ordering — not any sort — is what decides position in the grid.
  for (const [name, p] of Object.entries(CHAIN_PRESETS)) {
    manager.importSingle(name, p);
  }

  // Load the per-feature DEMO presets. ⚠️ **LAST, and that placement is the point** — this group is a REVIEW
  // SET (one preset per TransMap style, three chains, all eight materials) authored to be judged and then
  // kept or cut, so it sits at the very bottom of the library where it is easy to find and easy to remove.
  // Cutting one is a deletion in `demo-presets.ts` and nothing else; cutting the group is this loop plus the
  // import. Its two style-7 / style-9 siblings live in `CHAIN_PRESETS` above for historical reasons.
  for (const [name, p] of Object.entries(DEMO_PRESETS)) {
    manager.importSingle(name, p);
  }

  /*
   * THE PER-FEATURE DEMOS THAT ARE DERIVED FROM A PARENT. ⚠️ **LAST OF ALL, and that is an owner
   * instruction (2026-10-25): every demo preset belongs at the END of the list so they are easy to
   * find.** It REVERSES `30.D17`'s placement, which put each demo immediately after its parent so an
   * A/B comparison was one tile away — a real benefit, and the owner weighed findability higher.
   *
   * ⚠️ **They stay in `VARIANT_PRESETS` and carry `atEnd` rather than being moved into `DEMO_PRESETS`,
   * and the reason is the `after` field: it is still the record of which parent each one is ONE CHANGE
   * from**, which is the property that makes a demo an attribution rather than an impression
   * (`30.D17`'s other half). Moving the bodies into a `Record` would discard that pairing, and the
   * pairing is what `democheck` reads. **So the flag changes the POSITION and nothing else.**
   *
   * ⚠️ **`DEMO_PRESETS` above is the older, un-anchored review set and keeps its own placement.** Both
   * groups are now at the bottom; neither is interleaved.
   */
  for (const v of VARIANT_PRESETS) {
    if (v.atEnd) manager.importSingle(v.name, v.preset);
  }

  return orphans;
}
