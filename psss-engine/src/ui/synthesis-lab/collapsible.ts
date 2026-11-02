/**
 * v8 `31.U3` — **ONE collapsible group-of-sections, shared by the Lab's tabs.**
 *
 * ⚠️ **IT LIVES HERE RATHER THAN IN A TAB BECAUSE TWO TABS NEED IT, AND A SECOND COPY IS HOW THEY COME
 * TO DIVERGE.** It was a private method on `VisualFxTab` until the Materials tab needed the same
 * behaviour; duplicating ~35 lines of DOM plus the collapse semantics would have been a second
 * enumeration of one rule, which is the shape `CLAUDE.md` warns about under *three enumerations of one
 * list make a missing entry structurally invisible*.
 *
 * ⚠️⚠️ **COLLAPSING TOGGLES `hidden` AND NEVER DEFERS CONSTRUCTION, and that is the whole safety
 * argument for every caller.** A tab's rows are built when it first mounts, whatever state the groups
 * are in, because a tab's sync path addresses controls by reference and a control that does not exist
 * yet is a silent no-op. **`display: none` stops a row being SEEN, not working** — so a collapsed group
 * still exports, still snapshots and still takes a Reset.
 *
 * ⚠️ **The ACTIVITY COUNT is of ACTIVE FEATURES, not of changed settings.** No tab has a per-control
 * default table — the identities live in `OVERLAY_RULES`, which no tab reads — and inventing one here
 * would be a third copy of a list that already exists twice. *"3"* meaning **three subsystems are
 * running** is also the more actionable statement than a diff against defaults a user cannot see.
 * **Each caller's own predicate decides what counts, and the meaning is written into the head's
 * `title`** so it is not folklore.
 *
 * ⚠️ **A `<button>`, not a clickable `<div>`:** focusable and keyboard-operable for free, with
 * `aria-expanded` as the one state a screen reader needs. **No `data-testid` — ever**; a spec selects
 * this on its accessible name.
 */
export interface Collapsible {
  /** Append this. */
  wrap: HTMLElement;
  /** Build into this. */
  body: HTMLElement;
  /**
   * Set the activity count. 0 hides the badge entirely — an empty group should look empty rather than
   * carry a grey zero. ⚠️ The count is also appended to the head's `title`, so the signal is never
   * colour-only.
   */
  setCount: (n: number) => void;
}

export interface CollapsibleOpts {
  /** The visible label, and the accessible name. */
  text: string;
  /**
   * The tooltip. Each tab passes it from its OWN table, so this module names none of them.
   *
   * ⚠️ `string | undefined` rather than `tip?: string`, because `exactOptionalPropertyTypes` is on
   * and a `Record<string, string>` lookup yields an explicit `undefined` that an optional property
   * refuses. **Widening here is honest — a caller may genuinely have no tip — and keeps the
   * filtering out of every call site.**
   */
  tip?: string | undefined;
  /** Start expanded. Default false: a collapsed default is the point of the mechanism. */
  open?: boolean;
  /**
   * The head's class. `'sl-vfx-group-head'` for a top-level group, `'sl-vfx-sub-head'` for a
   * section-level one — the two differ only in weight, so the hierarchy reads.
   */
  headClass?: string;
  /**
   * How the count READS in the head's `title`. Default `3 active here` / `nothing active here`.
   *
   * ⚠️ **IT IS A PARAMETER BECAUSE THE DEFAULT PHRASE IS A LIE FOR A MIXED GROUP, AND A SILENT ONE.**
   * The doc comment above already says *each caller's own predicate decides what counts*; a caller whose
   * count is of something other than "active subsystems" needs the sentence to match, or the head makes a
   * claim about the whole group from a count of one part of it. The Composer's `Framing & Preview` is the
   * case: it counts BYPASSES, so `nothing active here` would read as the framing sliders being inert.
   *
   * ⚠️ **Defaulted rather than required, and the default reproduces the previous string exactly** — Visual
   * FX's five groups and Materials' three pass nothing and must not move.
   */
  countPhrase?: (n: number) => string;
}

export function makeCollapsible(opts: CollapsibleOpts): Collapsible {
  const {
    text, tip, open = false, headClass = 'sl-vfx-group-head',
    countPhrase = (n: number) => (n > 0 ? `${n} active here` : 'nothing active here'),
  } = opts;
  const wrap = document.createElement('div');

  const head = document.createElement('button');
  head.type = 'button';
  head.className = headClass;
  const label = document.createElement('span');
  label.textContent = text;
  head.appendChild(label);

  const count = document.createElement('span');
  count.className = 'sl-vfx-group-count';
  count.hidden = true;
  head.appendChild(count);

  const body = document.createElement('div');
  body.className = 'sl-vfx-group-body';

  /*
   * ⚠️ The open state is tracked in a CLOSURE rather than read back off `body.hidden`: that DOM property
   * is typed `boolean | "until-found"` in this lib, so a round trip through it is not a boolean and `tsc`
   * says so. One owner for the state, read by nobody else.
   */
  let isOpen = open;
  const apply = (on: boolean) => {
    isOpen = on;
    head.setAttribute('aria-expanded', on ? 'true' : 'false');
    body.hidden = !on;
  };

  const setCount = (n: number) => {
    count.hidden = n <= 0;
    count.textContent = String(n);
    head.classList.toggle('is-active', n > 0);
    head.title = `${tip ?? text} — ${countPhrase(n)}`;
  };

  apply(open);
  setCount(0);
  head.addEventListener('click', () => apply(!isOpen));
  wrap.appendChild(head);
  wrap.appendChild(body);
  return { wrap, body, setCount };
}
