# Release notes

One file per **GitHub release**, named after its tag: `v1.3.0.md` is the text of release `v1.3.0`.

A release is a deliberate decision, not a side effect of a version bump. The version number in
`psss-engine/package.json` moves with the work, and many versions are never released; only a version
chosen for release gets a file here.

The release workflow enforces this. When a `vX.Y.Z` tag is pushed, it stops before building anything
unless:

- the tag matches `psss-engine/package.json`'s version, and
- `release-notes/vX.Y.Z.md` exists and is not empty.

The file then becomes the release's description on GitHub.

Each file says what a user gets: what is new, what is fixed, and what to download.

**Every file opens with a one-paragraph summary above its first heading.** The newest file's summary is
also the *Latest release* announcement at the top of the repository's `README.md`. That block is
generated from the file, never written by hand, and the publication check fails if the two disagree.
To change the announcement, edit the notes file and regenerate the block.
