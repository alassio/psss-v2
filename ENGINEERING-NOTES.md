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

## How this was built

Three tools did distinct jobs, and the distinction is worth stating because it explains the shape of the
repository rather than just crediting software.

**The original JavaScript implementation was reverse-analysed with [Reversa](https://github.com/sandeco/reversa)**, a reverse-engineering
framework, which extracted its behaviour into written specifications — the control flow, the data model,
the preset format and the figure mathematics. The TypeScript engine was then built against those
specifications rather than against a reading of the old source, and the extracted legacy tree is still
the reference a parity question is settled by. That is why this engine reproduces the original's preset
format exactly enough that an original preset still loads.

**The research that scoped the later work was done with [hyperresearch](https://github.com/jordan-gibbs/hyperresearch)**, a multi-source deep-research
pipeline with a persistent source vault. Features were not chosen from intuition: each research pass
read papers and reference implementations, recorded every claim against its source, and produced a study
from which a phase was then scoped — so a decision to build or to drop usually traces to a measurement
or a citation rather than to a preference. Several of the strongest ideas in that study were dropped on
inspection, and the record says why.

**The implementation was carried out with [Claude Code](https://claude.com/claude-code)** — the engine, the checkers, the tests and both
manuals. The review discipline described above is what made that workable: the checkers are the gate a
change has to pass, and a visual change additionally has to pass an eye, because no checker can tell
whether a picture is worth looking at. Several features in this engine were built, measured, found
correct and then cut on exactly that basis.

⚠️ **None of those artefacts are in this repository.** The specifications, the research vault, the
ideation notes and the phase plan are part of the private engineering tree described above. They are
cited by comments here for provenance, and the comments state their own rules inline.

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
