/**
 * The Reel model — an ordered collection of presets, its schedule, and its transition arithmetic.
 *
 * ⚠️ PURE BY CONSTRUCTION: no DOM, no GL, no preset-library import, no `Date`, no side effects. This is not
 * tidiness — `checks/reelcheck.mjs` imports this module directly under Node, so a single reach for `window`
 * or a GL type here converts a measuring checker into a crash. The store (`presets/reel-store.ts`) owns
 * persistence, the tab owns the DOM, `main.ts` owns the engine effects; everything that can be decided by
 * arithmetic alone is decided here so that it can be measured without a browser.
 *
 * Plan: `research_paper_psss_fractal_v8.md` → Phase 19 (19.1). The transition design and the two-mode
 * decision are recorded there; the figures below are derived, not chosen.
 */

/** How the runner picks the next preset. Owner decision: two modes, no third. */
export type ReelPlayMode = 'sequential' | 'random';

/**
 * The transition between two presets. Owner decision 2026-09-11: exactly these two ship.
 * `'black'` is S1 (out to black, switch, back in); `'fade'` is S2 (the outgoing trail is frozen and
 * cross-faded in the TRAIL domain, pre-tonemap). S3 and S4 were declined as modes — do not add a member.
 */
export type ReelTransition = 'black' | 'fade';

/**
 * ⚠️ The one `tsc`-enforced enumeration site for each union, the `RENDER_MODE_LABELS` precedent: a
 * `Record<Union, string>` fails to compile when a member is added, whereas an `if`-chain or a lookup with a
 * fallback silently files the new member under the wrong label. Every UI label comes from here.
 *
 * The stored values are the owner's words (`black`, `fade`); the LABELS are not, deliberately — as bare
 * words "Black" and "Fade" read as a pair of intensities when the actual difference is whether the two
 * figures are ever on screen together. Owner-chosen 2026-09-12.
 */
export const REEL_TRANSITION_LABELS: Record<ReelTransition, string> = {
  black: 'Fade to black',
  fade: 'Cross-fade',
};

export const REEL_PLAY_MODE_LABELS: Record<ReelPlayMode, string> = {
  sequential: 'Sequential',
  random: 'Random',
};

/**
 * A reel. `presets` holds preset NAMES, not presets.
 *
 * ⚠️ Names are resolved at PLAY time, never at save time (see `resolveReel`). A name is a primary key in
 * five owners and the library composes differently in a deployment than in dev, so a reel that stored
 * resolved presets would either go stale or duplicate the library. A reel outliving one of its presets is a
 * supported state, not a corrupt one.
 *
 * ⚠️ There is no `isMain` field, and that absence is load-bearing. A boolean per reel makes "exactly one
 * main reel" an invariant every writer can break independently — invariant 17's shape. The main reel is one
 * `mainReelName` on the store, with `setMainReel()` as its only writer.
 */
export interface Reel {
  /** Unique, compared case-insensitively. The primary key. */
  name: string;
  /** Preset names in play order. Duplicates are allowed — a reel may deliberately revisit a figure. */
  presets: string[];
  playMode: ReelPlayMode;
  /** Seconds the preset is held FULLY VISIBLE. The transition runs on top of this, not inside it. */
  playSeconds: number;
  transition: ReelTransition;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Bounds and defaults
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ The hold floor is derived from the transition, not chosen for feel: the longest transition is
 * `REEL_TRANSITION_TOTAL_MS.black` (1900 ms), so a hold below ~2 s spends more time transitioning than
 * showing a figure, and a reel of such holds reads as strobing rather than as a sequence. Re-derive this if
 * a transition duration changes — the two are coupled and nothing enforces the coupling but this comment
 * and `reelcheck` §B.
 */
export const REEL_MIN_SECONDS = 2;
export const REEL_MAX_SECONDS = 600;
export const REEL_DEFAULT_SECONDS = 20;
export const REEL_DEFAULT_PLAY_MODE: ReelPlayMode = 'sequential';
export const REEL_DEFAULT_TRANSITION: ReelTransition = 'fade';

/** Longest name the UI will store. Not a display limit — a key limit, so the dropdown stays readable. */
export const REEL_MAX_NAME_LENGTH = 60;

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The warm window — the one measured figure every transition duration is derived from
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Frames the INCOMING preset needs before it is representative. Mirrors `MATH_WARM_FRAMES` in
 * `ui/preview-grid/grid-tile-renderer.ts`, which "steps off frame 0's degenerate cases", and matches
 * `aestheticcheck`'s own `WARM_FRAMES`.
 *
 * ⚠️ THIS IS A SECOND COPY OF A FIGURE THAT ALREADY EXISTS, and there is no compiler between the copies —
 * `reelcheck` §B reads `grid-tile-renderer.ts` and asserts the two agree. Importing the original instead
 * would drag a renderer module into a pure model and break the checker, which is the whole reason this
 * module has no imports. If you change one, the checker fails; that is the design.
 */
export const REEL_WARM_FRAMES = 40;

/**
 * The warm window in MILLISECONDS, which is the unit every transition duration is expressed in.
 *
 * ⚠️ A UNIT CONVERSION WITH A TRADE-OFF, stated because it is invisible in the result (invariant 10): the
 * warm window is measured in FRAMES but a reel's timing must be in SECONDS, or the transition's length
 * would change with the frame rate and a 20-second hold would not be 20 seconds. So the conversion is done
 * once, here, at a DELIBERATELY PESSIMISTIC 50 fps rather than at 60: 40 frames / 50 fps = 800 ms. Below
 * 50 fps the plateau under-covers the warm window and the incoming figure is briefly visible while it
 * settles — accepted, because below that rate `PerfGuard` has already tripped and the machine has bigger
 * problems than a transition seam.
 */
export const REEL_WARM_MS = 800;

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Transition timing — every figure below is derived from REEL_WARM_MS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** S1 `black`: fade the presented image out, switch at black, fade back in. */
export const BLACK_FADE_OUT_MS = 450;
/**
 * ⚠️ Held at black for the WHOLE warm window, and this is the entire point of the constant. An earlier
 * design held black for ~120 ms and let the fade-in cover the warm-up; that reveals the incoming preset
 * filling in from an empty trail at ~70 % brightness, which reads as a rendering fault rather than as a
 * transition. Black is the one image both presets agree on, so spending the warm window there costs
 * nothing and hides everything.
 */
export const BLACK_HOLD_MS = REEL_WARM_MS;
export const BLACK_FADE_IN_MS = 650;

/**
 * S2 `fade`: the outgoing trail is captured, the switch happens immediately, and the captured image is
 * held at FULL weight across the warm window before it ramps away. Same derivation as `BLACK_HOLD_MS` —
 * the plateau is what hides the incoming preset's degenerate frames, and without it the cross-fade shows
 * a bright frozen figure dissolving into a near-empty one.
 */
export const FADE_PLATEAU_MS = REEL_WARM_MS;
export const FADE_RAMP_MS = 1000;

export const REEL_TRANSITION_TOTAL_MS: Record<ReelTransition, number> = {
  black: BLACK_FADE_OUT_MS + BLACK_HOLD_MS + BLACK_FADE_IN_MS,
  fade: FADE_PLATEAU_MS + FADE_RAMP_MS,
};

/**
 * When, within the transition, the incoming preset must already have been applied.
 *
 * ⚠️ For `black` this is not a tuning value but a CORRECTNESS boundary: applying the preset is a visible
 * hard teardown (`applyPresetChange` clears both trail buffers), so it must land where the presented image
 * is exactly 0. For `fade` the apply happens at t = 0, immediately after the capture — the captured image
 * is what covers it.
 */
export const REEL_APPLY_AT_MS: Record<ReelTransition, number> = {
  black: BLACK_FADE_OUT_MS,
  fade: 0,
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The transition, as a pure function of elapsed time
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Everything a transition drives, derived from elapsed milliseconds alone.
 *
 * ⚠️ Two output channels, and each mode moves exactly ONE of them — the other stays at its identity. That
 * is what makes the release byte-identical to never having run: at `done`, `outputGain === 1` and
 * `freezeWeight === 0`, which is the ungated pipeline. `reelcheck` §C asserts the identity rather than
 * trusting it, because a gate that releases to something near its identity is invariant 21's hidden trip.
 */
export interface TransitionMix {
  /** Multiplier on the presented image. 1 = untouched. Only `black` moves it. */
  outputGain: number;
  /** Weight of the FROZEN outgoing trail. 0 = gone. Only `fade` moves it. */
  freezeWeight: number;
  /** True once the incoming preset must already be applied. */
  applied: boolean;
  /** True when the transition is over and both channels are back at their identity. */
  done: boolean;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Hermite ease, zero derivative at BOTH ends.
 *
 * ⚠️ The zero derivative is the requirement, not the smoothness: a linear ramp meeting a plateau has a
 * corner, and a corner in a brightness ramp is visible as a distinct "click" in the fade even though every
 * value along it is correct. `reelcheck` §C measures the per-frame delta rather than eyeballing the curve.
 */
const smoothstep = (u: number): number => {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
};

/**
 * The whole transition, for either mode, at any instant.
 *
 * `elapsedMs` is time since the transition began.
 *
 * ⚠️ **The two ends are clamped, but only the FAR end is clamped to the IDENTITY, and the difference is not
 * pedantry — a checker clause written from a "clamped to the identity at both ends" reading would fail
 * against correct code.** Past `total` both channels are at their identity (full output, no freeze), so an
 * overshoot by a frame cannot flash. Before 0 the clamp is merely IDEMPOTENT: it returns the value at `t = 0`,
 * which for `fade` is `{ outputGain: 1, freezeWeight: 1, applied: true }` — the frozen image at FULL weight,
 * the opposite of the identity. That is required, not a wart: `fade` applies the incoming preset at `t = 0`
 * and the freeze is the only thing covering the reseeded, unwarmed field for the first `FADE_PLATEAU_MS`.
 */
export function transitionMix(transition: ReelTransition, elapsedMs: number): TransitionMix {
  const total = REEL_TRANSITION_TOTAL_MS[transition];
  const e = elapsedMs < 0 ? 0 : elapsedMs;
  const applied = e >= REEL_APPLY_AT_MS[transition];

  if (e >= total) {
    return { outputGain: 1, freezeWeight: 0, applied: true, done: true };
  }

  if (transition === 'black') {
    let outputGain: number;
    if (e < BLACK_FADE_OUT_MS) {
      outputGain = 1 - smoothstep(e / BLACK_FADE_OUT_MS);
    } else if (e < BLACK_FADE_OUT_MS + BLACK_HOLD_MS) {
      outputGain = 0;
    } else {
      outputGain = smoothstep((e - BLACK_FADE_OUT_MS - BLACK_HOLD_MS) / BLACK_FADE_IN_MS);
    }
    return { outputGain, freezeWeight: 0, applied, done: false };
  }

  // 'fade' — full weight across the warm window, then eased away.
  const freezeWeight = e < FADE_PLATEAU_MS ? 1 : 1 - smoothstep((e - FADE_PLATEAU_MS) / FADE_RAMP_MS);
  return { outputGain: 1, freezeWeight, applied, done: false };
}

/** The identity mix — what the pipeline looks like with no transition running. */
export const TRANSITION_IDENTITY: TransitionMix = {
  outputGain: 1,
  freezeWeight: 0,
  applied: true,
  done: true,
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Resolution — a reel against the library it will actually play from
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ResolvedReel {
  /** Preset names that exist, in play order. */
  order: string[];
  /** Names the reel holds that the library does not. Reported, never fatal. */
  skipped: string[];
}

/**
 * Resolve a reel against a library.
 *
 * ⚠️ A missing preset is SKIPPED AND COUNTED, never fatal and never silently dropped. The count is what the
 * tab's status line reports: an editor showing twelve rows while the runner will play ten is lying, and the
 * only way to be honest about it is to resolve in one place and publish both numbers.
 */
export function resolveReel(reel: Reel, hasPreset: (name: string) => boolean): ResolvedReel {
  const order: string[] = [];
  const skipped: string[] = [];
  for (const name of reel.presets) {
    if (hasPreset(name)) order.push(name);
    else skipped.push(name);
  }
  return { order, skipped };
}

/**
 * Total seconds for one pass of a resolved reel — holds plus transitions.
 *
 * ⚠️ `count` transitions, not `count - 1`: the reel loops (owner decision 2026-09-12), so the pass that
 * returns to the first preset also pays for a transition. Reading it as `count - 1` understates a
 * twelve-item reel by about two seconds, which is exactly the size of error a readout hides.
 */
export function passSeconds(count: number, playSeconds: number, transition: ReelTransition): number {
  if (count <= 0) return 0;
  return count * (playSeconds + REEL_TRANSITION_TOTAL_MS[transition] / 1000);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The schedule
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Injectable for the checker and the specs. ⚠️ A schedule with no seed discharges nothing. */
export type Rng = () => number;

/**
 * The play-order cursor.
 *
 * `sequential` wraps. `random` deals from a shuffled deck and reshuffles when the deck is exhausted, so
 * every preset plays once per pass — a plain per-step `Math.random()` would revisit some presets three
 * times before touching others, which over a long session reads as "the reel ignores half my picks".
 *
 * ⚠️ `Math.random()` is CORRECT here, and the distinction from invariant 12 is worth writing down: that
 * invariant forbids `Math.random()` when RESEEDING A PARTICLE, because a per-particle random offset
 * destroys the spatial coherence the figure is made of. A schedule has no spatial structure to destroy.
 *
 * ⚠️ The no-adjacent-repeat guarantee is UNSATISFIABLE at `count === 1` and that is not a defect — one
 * preset can only follow itself. `reelcheck` §D asserts the property for `count >= 2` and asserts the
 * exception at 1, because a checker that swept from 1 would fail against correct code.
 */
export class ReelCursor {
  private deck: number[] = [];
  private last = -1;

  private readonly count: number;
  private readonly mode: ReelPlayMode;
  private readonly rng: Rng;

  /*
   * ⚠️ **NOT a constructor parameter property, and the fields above are not verbosity.** This module is
   * imported by `checks/reelcheck.mjs` and (transitively, through `presets/reel-store.ts`)
   * by `scripts/export-library.mjs`, both of which run under Node's STRIP-ONLY TypeScript mode. That mode
   * erases type annotations without transforming anything, so `constructor(private readonly count: number)`
   * throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` at PARSE time — before any of the file runs.
   *
   * The failure is silent in exactly the place it matters: `tsc --noEmit` accepts a parameter property, so
   * `npm run verify` stays green while `npm run build` dies. Anything in a module Node imports directly is
   * bound by the strip-only subset — no parameter properties, no `enum`, no `namespace`, no legacy
   * `experimentalDecorators`. A UI module (`ui/synthesis-lab/tabs/reel.ts`) is free to use them, because
   * only Vite ever compiles it.
   */
  constructor(count: number, mode: ReelPlayMode, rng: Rng = Math.random) {
    this.count = count;
    this.mode = mode;
    this.rng = rng;
  }

  /** The next index into the resolved order, or -1 if the reel is empty. */
  next(): number {
    if (this.count <= 0) return -1;
    if (this.count === 1) {
      this.last = 0;
      return 0;
    }
    if (this.mode === 'sequential') {
      this.last = this.last < 0 ? 0 : (this.last + 1) % this.count;
      return this.last;
    }
    if (this.deck.length === 0) this.refillDeck();
    const idx = this.deck.pop() ?? 0;
    this.last = idx;
    return idx;
  }

  /** The index currently playing, or -1 before the first `next()`. */
  current(): number {
    return this.last;
  }

  private refillDeck(): void {
    const d: number[] = [];
    for (let i = 0; i < this.count; i++) d.push(i);
    // Fisher-Yates.
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const a = d[i] as number;
      const b = d[j] as number;
      d[i] = b;
      d[j] = a;
    }
    // ⚠️ The deck is POPPED from the end, so the element that plays next is `d[d.length - 1]`, not `d[0]`.
    // Getting this wrong makes the adjacent-repeat guard protect the wrong slot and the guard then reads as
    // working — the repeat still happens, once per pass, which is rare enough to look like chance.
    const first = d[d.length - 1];
    if (d.length > 1 && first === this.last) {
      const swap = Math.floor(this.rng() * (d.length - 1));
      d[d.length - 1] = d[swap] as number;
      d[swap] = first as number;
    }
    this.deck = d;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type ReelField = 'name' | 'presets' | 'playSeconds';

export interface ReelProblem {
  field: ReelField;
  message: string;
}

/**
 * Validate a reel for SAVING. Returns every problem, not the first — a form that reports one problem at a
 * time makes the user discover the second one by fixing the first.
 *
 * `takenNames` are the names already in the store EXCLUDING the reel being edited; a caller renaming a reel
 * must exclude the old name itself or every save of an unchanged name reports a collision.
 */
export function validateReel(reel: Reel, takenNames: readonly string[] = []): ReelProblem[] {
  const problems: ReelProblem[] = [];
  const name = reel.name.trim();

  if (name.length === 0) {
    problems.push({ field: 'name', message: 'A reel needs a name.' });
  } else if (name.length > REEL_MAX_NAME_LENGTH) {
    problems.push({ field: 'name', message: `Keep the name under ${REEL_MAX_NAME_LENGTH} characters.` });
  } else {
    const lower = name.toLowerCase();
    if (takenNames.some((t) => t.trim().toLowerCase() === lower)) {
      problems.push({ field: 'name', message: `A reel named "${name}" already exists.` });
    }
  }

  if (reel.presets.length === 0) {
    problems.push({ field: 'presets', message: 'A reel needs at least one preset.' });
  }

  if (!Number.isFinite(reel.playSeconds)) {
    problems.push({ field: 'playSeconds', message: 'Play time must be a number.' });
  } else if (reel.playSeconds < REEL_MIN_SECONDS || reel.playSeconds > REEL_MAX_SECONDS) {
    problems.push({
      field: 'playSeconds',
      message: `Play time must be between ${REEL_MIN_SECONDS} and ${REEL_MAX_SECONDS} seconds.`,
    });
  }

  return problems;
}

/** Case-insensitive key equality — the ONE place reel names are compared. */
export function sameReelName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Serialisation — untrusted input in both directions
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Written from day one, and not because a migration is expected. Persisted data with no version is a
 * migration with no way to tell old from new, and the first schema change then has to guess from the
 * shape — which is exactly the classifier problem this phase spent a whole step avoiding.
 */
export const REEL_FILE_VERSION = 1;

export interface ReelFile {
  version: number;
  reels: Reel[];
  mainReelName: string | null;
}

const PLAY_MODES: readonly ReelPlayMode[] = ['sequential', 'random'];
const TRANSITIONS: readonly ReelTransition[] = ['black', 'fade'];

/**
 * Coerce one untrusted value into a `Reel`, or `null` if it cannot be one.
 *
 * ⚠️ Per-reel rejection, never per-file: a hand-edited or half-written `localStorage` entry must cost the
 * user that one reel, not the whole set. Returning `null` for a bad entry and counting it is what lets the
 * store report "3 reels loaded, 1 unreadable" instead of starting empty and looking like a wiped profile.
 */
export function sanitiseReel(value: unknown): Reel | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (typeof v['name'] !== 'string' || v['name'].trim().length === 0) return null;
  if (!Array.isArray(v['presets'])) return null;
  const presets = v['presets'].filter((p): p is string => typeof p === 'string' && p.length > 0);

  const playMode = PLAY_MODES.includes(v['playMode'] as ReelPlayMode)
    ? (v['playMode'] as ReelPlayMode)
    : REEL_DEFAULT_PLAY_MODE;
  const transition = TRANSITIONS.includes(v['transition'] as ReelTransition)
    ? (v['transition'] as ReelTransition)
    : REEL_DEFAULT_TRANSITION;

  const rawSeconds = typeof v['playSeconds'] === 'number' ? v['playSeconds'] : REEL_DEFAULT_SECONDS;
  const playSeconds = Number.isFinite(rawSeconds)
    ? Math.min(REEL_MAX_SECONDS, Math.max(REEL_MIN_SECONDS, rawSeconds))
    : REEL_DEFAULT_SECONDS;

  return { name: v['name'].trim(), presets, playMode, playSeconds, transition };
}

export function serialiseReelFile(reels: readonly Reel[], mainReelName: string | null): string {
  const file: ReelFile = {
    version: REEL_FILE_VERSION,
    reels: reels.map((r) => ({ ...r, presets: [...r.presets] })),
    mainReelName,
  };
  return JSON.stringify(file, null, 2);
}

export interface ParsedReelFile {
  reels: Reel[];
  mainReelName: string | null;
  /** Entries that were present but not reel-shaped. Reported to the user, never swallowed. */
  rejected: number;
}

/**
 * ⚠️ Returns `null` for anything that is not a reel file, and the caller MUST distinguish that from an
 * empty reel file. This is the discriminator that keeps the two importers from silently accepting each
 * other's files: `Import Reels` on a preset bundle must say so, and a preset import handed a reels file
 * must say so too. Two importers that quietly accept the wrong file are the same silent-misfile defect
 * this phase declined to introduce into the preset classifier — arrived at from the other end.
 */
export function parseReelFile(text: string): ParsedReelFile | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  return sanitiseReelFile(raw);
}

/**
 * The same test as `parseReelFile`, on a value that has ALREADY been parsed.
 *
 * ⚠️ **The ONE shape test for a reel file, and `parseReelFile` is a `JSON.parse` in front of it** (v8 Phase
 * 19.11). It exists because the deployment's `psss_reels.json` arrives as an OBJECT, not as text: it is loaded
 * with a `<script>` tag under `file://` — where `fetch` cannot read a sibling file — so what the engine gets is
 * `globalThis.g_psss_reels`, already an object. The alternative was a second shape test in `reel-store.ts`,
 * ⚠️ **and two shape tests for one format is the defect, not the duplication**: they drift on the very field a
 * future version adds, the deployment silently accepts a file the Import button rejects (or the reverse), and
 * nothing between the two copies can see it. `JSON.stringify`-ing the object just to hand it back to the text
 * parser was the other candidate and is worse — it converts a non-finite number to `null` on the way through,
 * so a hand-edited `playSeconds: Infinity` would arrive as a *different* rejection than the file importer's.
 */
export function sanitiseReelFile(raw: unknown): ParsedReelFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['version'] !== 'number') return null;
  if (!Array.isArray(obj['reels'])) return null;

  const reels: Reel[] = [];
  let rejected = 0;
  for (const entry of obj['reels']) {
    const reel = sanitiseReel(entry);
    if (reel) reels.push(reel);
    else rejected++;
  }
  const main = typeof obj['mainReelName'] === 'string' ? obj['mainReelName'] : null;
  return { reels, mainReelName: main, rejected };
}

/** True if `text` parses as a reel file. Used by the PRESET importer to reject one with a message. */
export function looksLikeReelFile(text: string): boolean {
  return parseReelFile(text) !== null;
}
