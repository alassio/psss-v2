# Engineering notes — how to read this repository's comments

This file answers the questions a reader of the source asks first: what the comments' many references
point to, and why so few of their targets are in this repository. For **where things are**, start with
`psss-engine/README.md`, the code map: every file of the engine, one line each.

## The comments cite a private engineering record, and nothing is missing

Comments throughout `psss-engine/src/`, `psss-engine/checks/`, `psss-engine/tests/` and the screensaver
host cite the project's **private engineering record**, which is not published. The citations take
several forms:

| A comment says | It points to |
|---|---|
| `CLAUDE.md`, *"invariant 4"*, *"the sink"* | the private rules index — one line per rule — its numbered invariants, and the archive that holds each rule's full write-up |
| *"the plan"*, *"Phase 41"*, `33.22`, `41.D3`, `D1`–`D8` | the development plan: a phase, a step within it, or a binding decision of a phase |
| `E92`, *"ideation"*, `ENGINE-NOTES` | the design notes each phase was scoped from |
| *"triage"*, `I6`, `H1`, `B14` | the reverse-engineering triage, the worklist the engine's structure was settled by |
| a file name such as `p81-hill-search.mjs` or `MEASUREMENT-…` | a one-off measurement probe |
| a date | when a measurement was taken or a decision made |
| *"the owner"* | the project's maintainer, whose decisions the plan records |

**None of these is needed to read the code.** They are *pointers, not definitions*: every comment that
cites one **states its own rule inline**, and the citation records where the rule is catalogued or how it
was established, not where it is explained. A comment reading

> ⚠️ **Assign every sampler its unit unconditionally and always bind a texture** — `CLAUDE.md`
> invariant 4

tells you the whole rule. The reference adds provenance and nothing else. The same holds for the probe's
run record under `psss-engine/screensaver/probe/`, which is a dated log by nature.

The documents a reader needs are all here, and they name no private file: this repository's `README.md`,
the code map `psss-engine/README.md`, the technical reference `psss-engine-v2_how_it_works.md`, the user
manual `psss-engine-v2_how_to_use_it.md`, and the screensaver host's `psss-engine/screensaver/README.md`.

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
ideation notes and the phase plan are part of the private engineering record described above.

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
them — and their comments carry the derivations, the worked examples and the calibration records. One of
them, `mapcheck`, holds the code map complete.

If you want to know what this engine guarantees, read `checks/`. If you want to know how it works, read
`psss-engine-v2_how_it_works.md`. If you want to use it, read `psss-engine-v2_how_to_use_it.md`.

## A note on the test suite

`psss-engine/tests/` is a Playwright suite whose comments are authoritative about its own fixtures and
mutation technique. It is **not** wired into the push CI, on purpose: a full run is long — a development
server serving it slows down after a few dozen pages, so `npm run verify:browser:chunks` runs it in groups,
each on a fresh server — and two of its tests are known to be red over open defects, so a suite on every
push would make every commit red and teach people to ignore the badge. It runs on manual dispatch, and
`retries` stays `0`.
