# Engineering notes — how to read this repository's comments

This file exists to answer one question a reader of the source will ask quickly.

## `CLAUDE.md` is cited a lot and is not in this repository

Comments throughout `psss-engine/src/`, `psss-engine/checks/` and `psss-engine/tests/` cite a file
called `CLAUDE.md`, and occasionally a development plan or an engineering log. Those are the project's
**private engineering index** and are not published.

**Nothing is missing.** Those citations are *pointers, not definitions*. `CLAUDE.md` is an index: one
line per rule, with the rule's reasoning living elsewhere. Every comment that cites it **states its own
rule inline** — the citation records where that rule is catalogued, not where it is explained. A comment
reading

> ⚠️ **Assign every sampler its unit unconditionally and always bind a texture** — `CLAUDE.md`
> invariant 4

tells you the whole rule. The reference adds provenance and nothing else.

## What the comments are for

They are unusually dense, and deliberately so. This engine's characteristic failure is **silent**: a
shader that fails to compile still links and binds and draws black; a control can move the right field
and read inert because the output channel cannot show the result; a checker can be green over a defect
for weeks because it asserts the shape of the implementation rather than the property.

So a comment here usually records **why a thing is the way it is and what breaks if it changes** — not
what the next line does. Where a comment and the code disagree, the comment is the one that was written
with the measurement in hand, and the disagreement is worth reporting.

## The checkers are the specification

`npm run verify` runs `tsc --noEmit` plus every static checker in `psss-engine/checks/`. Several of
them *measure* rather than grep — they import the engine's own modules under Node and compute against
them — and their comments carry the derivations, the worked examples and the calibration records.

If you want to know what this engine guarantees, read `checks/`. If you want to know what it looks
like, read `psss-engine-v2_how_it_works.md`. If you want to use it, read
`psss-engine-v2_how_to_use_it.md`.

## A note on the test suite

`psss-engine/tests/` is a Playwright suite whose comments are authoritative about its own fixtures and
mutation technique. It is **not** wired into the push CI, on purpose: it has not been run green in full
at its pinned configuration, and a suite that makes every commit red teaches people to ignore the
badge. It runs on manual dispatch, and `retries` stays `0`.
