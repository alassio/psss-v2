/**
 * package-dist.mjs — assemble the distribution zip.
 *
 *   node scripts/package-dist.mjs
 *
 * ⚠️ **NO npm DEPENDENCY. The zip is written by WINDOWS' OWN `bsdtar`** — `C:\Windows\System32\tar.exe`,
 * present on Windows 10 1803 and later. An `adm-zip` dependency was declared first and removed on
 * 2026-10-11, because the registry was unreachable from the owner's machine (`ECONNRESET`) and this step
 * needs nothing that the platform does not already provide. `build:all` already requires Windows for the
 * screensaver host, so this adds no new constraint.
 *
 * ⚠️ **GNU `tar` SILENTLY WRITES A *TAR* WHEN ASKED FOR A ZIP, AND THAT IS WHY THE MAGIC BYTES ARE
 * CHECKED.** Measured: GNU tar 1.35 — which is what a Git Bash `tar` resolves to — accepts
 * `-a -c -f out.zip` without complaint and produces an uncompressed tar whose first bytes are the first
 * filename instead of `PK\x03\x04`. The file has a `.zip` extension, `tar -tf` lists it happily, and
 * Windows Explorer refuses to open it. So the executable is taken by its FULL PATH rather than from
 * `PATH`, its `--version` is required to say `bsdtar`, and the finished file's signature is verified.
 *
 * ## What goes in, and the one rule behind the exclusions
 *
 * The archive carries the built deployment, the sources needed to rebuild it, and the documentation.
 * **It carries no build by-products except the ones that ARE the deployment** — so `dist/` is included
 * whole, while every intermediate that produced it is not:
 *
 *   dist/                       the built deployment, including dist/screensaver/
 *   src/                        the engine source
 *   screensaver/                SOURCE ONLY — see the exclusions below
 *   scripts/                    the build steps
 *   public/, index.html, package.json, package-lock.json, tsconfig.json, vite.config.ts
 *   README.md + the two manuals + their PDFs
 *
 * ⚠️ **THE LAST LINE OF THAT LIST IS AN INTERPRETATION AND IS FLAGGED AS ONE.** The brief named
 * `scripts/` with the words *"all files necessary to run a build"*, and `scripts/` alone cannot build
 * anything: `npm run build` needs `package.json` for the script definitions, `vite.config.ts` and
 * `tsconfig.json` for the compiler, and `index.html` + `public/` as build inputs. Those six are
 * therefore included so the zip is genuinely buildable. **Removing them is a one-line change to
 * `EXTRA_FILES`/`EXTRA_DIRS` if the archive is meant to be source-complete but not build-complete.**
 *
 * ## The exclusions
 *
 * | Excluded | Why |
 * |---|---|
 * | `screensaver/bin/`, `screensaver/obj/` | .NET build output; `bin/` also holds a 16 MB duplicate of the `.scr` that `dist/screensaver/` already carries |
 * | `screensaver/probe/` | the host's hand-run test instrument and its run record |
 * | `screensaver/Payload/` | regenerated from `dist/` by the build — including it ships the same engine twice |
 * | `node_modules/`, `.playwright/`, `.vite/` | installed or run artefacts |
 * | `*.zip` | ⚠️ **so a second run cannot nest the previous archive inside the new one** |
 *
 * ⚠️ **THE ARCHIVE IS WRITTEN TO THE REPOSITORY ROOT, NOT INTO `dist/`.** `dist/` is an input to this
 * step, so an archive written there would be swallowed by the next run — and `vite build` empties
 * `dist/`, which would delete it anyway.
 *
 * ⚠️ **THE ENTRY LIST IS READ BACK OUT OF THE FINISHED FILE AND ASSERTED.** A filter that silently
 * matches nothing produces a valid zip that is simply missing a tree, and a zip is opaque until
 * something opens it — so the checks below open it. Four of them are negative (no `bin/`, `obj/`,
 * `probe/`, `.zip`), because an exclusion that stops working is the failure this step cannot see.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(HERE, '..');              // psss-engine/
const ROOT = resolve(ENGINE, '..');              // the repository root
const TAG = '[package-dist]';

/**
 * `YYYYMMDD_HHMMSS` in LOCAL time — the same stamp `ui/synthesis-lab/export.ts` puts on an export, and
 * local for the same reason: it exists so a human can tell two archives apart at a glance, which only
 * works if it reads as the wall-clock time the build ran. ⚠️ **Do not "fix" it to `toISOString()`** —
 * that shifts every future filename by the UTC offset and makes old and new archives unsortable
 * against each other.
 */
function buildStamp() {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`
    + `_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}

/**
 * ⚠️ **THE STAMP MEANS EVERY RUN WRITES A NEW FILE AND NOTHING IS EVER OVERWRITTEN** (owner,
 * 2026-10-11). That is the point — an archive is a release artefact and a build should not destroy the
 * previous one — but it has two consequences worth knowing. **The root accumulates archives**, so the
 * step counts the ones already there and says so rather than letting them pile up unnoticed. And
 * **`*.zip` is excluded from the archive's own inputs**, so a second run cannot pack the first: with a
 * fixed name that only mattered for re-runs, and with a stamp there is a growing set of them to swallow.
 */
/**
 * `--web` — the CROSS-PLATFORM release path (Phase 29.D20).
 *
 * ⚠️ **IT EXISTS BECAUSE A PLATFORM LIMIT WAS BEING REPORTED AS A CORRUPT TREE.** Without it this
 * script fails on Linux and macOS with *"expected input missing — dist/screensaver/psss.scr"*, which
 * reads as a broken repository rather than as "this platform cannot build the screensaver host".
 * `build-screensaver.mjs` already refuses a non-Windows platform with a clear message pointing at
 * `npm run build`; this is the same courtesy, one step later.
 *
 * ⚠️ **THE `.scr` ASSERTION IS INVERTED HERE, NOT DROPPED.** In web mode the presence of
 * `dist/screensaver/` means a STALE `.scr` from an earlier Windows build got packed — exactly the
 * confusion the distinct archive name exists to prevent — so the gate count does not fall.
 */
const WEB_ONLY = process.argv.includes('--web');

const OUT = join(ROOT, `psss-engine-v2-distribution_${buildStamp()}${WEB_ONLY ? '_web' : ''}.zip`);

/** Directories taken whole, relative to `psss-engine/`, placed under `psss-engine/` in the archive. */
const ENGINE_DIRS = ['dist', 'src', 'scripts', 'public'];

/** The screensaver, source only. Its exclusions are the `SKIP_DIRS` below. */
const SCREENSAVER_DIR = 'screensaver';

/** Build-manifest files — see the interpretation note in the header. */
const EXTRA_FILES = ['index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts'];

/** Repository-root documents, with the PDFs the previous build step wrote. */
const DOC_FILES = [
  'README.md',
  'psss-engine-v2_how_to_use_it.md',
  'psss-engine-v2_how_it_works.md',
  'psss-engine-v2_how_to_use_it.pdf',
  'psss-engine-v2_how_it_works.pdf',
];

/**
 * Directory names dropped wherever they appear, compared LOWER-CASED.
 *
 * ⚠️ **`payload` belongs here and was missing from the first version of this list**, which the `--list`
 * dry run caught: `screensaver/` listed 14 files where its source is 12, the two extras being
 * `Payload/index.html` and `Payload/psss-engine.js` — the engine, shipped a second time. The archive's
 * own `NO screensaver/Payload` assertion would also have caught it, but only after writing a 29 MB file.
 *
 * ⚠️ **Compared lower-cased on purpose.** `Payload` is capitalised on disk while `bin` and `obj` are
 * not, and a case-sensitive `Set` therefore reads as working on three of four entries.
 */
const SKIP_DIRS = new Set(['bin', 'obj', 'probe', 'payload', 'node_modules', '.playwright', '.vite', '.git']);

/**
 * `--list` prints what WOULD be archived and exits, and it deliberately needs no dependency.
 *
 * ⚠️ **It is here because the include/exclude rules are the part of this script most likely to be
 * wrong, and the part a finished zip hides.** `adm-zip` is therefore loaded after the file list is
 * built, so the rules can be inspected on a machine where nothing has been installed yet — and so a
 * change to them can be reviewed as a diff of file names rather than by unzipping.
 */
const LIST_ONLY = process.argv.includes('--list');



/** Walk `absDir`, yielding [absolutePath, archivePath] and honouring SKIP_DIRS and *.zip. */
function* walk(absDir, archiveDir) {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
      yield* walk(join(absDir, entry.name), `${archiveDir}/${entry.name}`);
    } else if (entry.isFile() && !entry.name.toLowerCase().endsWith('.zip')) {
      yield [join(absDir, entry.name), `${archiveDir}/${entry.name}`];
    }
  }
}

// ── collect ──────────────────────────────────────────────────────────────────────────────────────
const files = [];
const missing = [];

for (const d of [...ENGINE_DIRS, SCREENSAVER_DIR]) {
  const abs = join(ENGINE, d);
  if (!existsSync(abs)) { missing.push(`psss-engine/${d}/`); continue; }
  for (const pair of walk(abs, `psss-engine/${d}`)) files.push(pair);
}
for (const f of EXTRA_FILES) {
  const abs = join(ENGINE, f);
  if (existsSync(abs)) files.push([abs, `psss-engine/${f}`]);
  else missing.push(`psss-engine/${f}`);
}
for (const f of DOC_FILES) {
  const abs = join(ROOT, f);
  if (existsSync(abs)) files.push([abs, f]);
  else missing.push(f);
}

// ⚠️ **WEB MODE DROPS `dist/screensaver/` BY PATH, NOT BY NAME.** `SKIP_DIRS` is compared against a
// bare directory NAME, and `screensaver` names two different things here — the host's SOURCE at
// `psss-engine/screensaver/`, which must still ship, and the built `.scr` the Windows step copies into
// `dist/screensaver/`, which must not. A name-based skip would delete the source as well.
if (WEB_ONLY) {
  const before = files.length;
  files.splice(0, files.length,
    ...files.filter(([, archivePath]) => !archivePath.startsWith('psss-engine/dist/screensaver')));
  console.log(`${TAG} --web: dropped ${before - files.length} screensaver output file(s) from the archive`);
}

if (missing.length > 0 && LIST_ONLY) {
  // A dry run reports the rules; it is not the gate. Missing inputs are expected here before the
  // earlier build steps have run, so they are named and the listing continues.
  console.log(`${TAG} note: ${missing.length} input(s) not present yet — ${missing.join(', ')}`);
} else if (missing.length > 0) {
  console.error(`${TAG} FAIL — ${missing.length} expected input(s) missing:`);
  for (const m of missing) console.error(`${TAG}        ${m}`);
  if (missing.some((m) => m.endsWith('.pdf'))) {
    console.error(`${TAG} the PDFs come from 'npm run docs:pdf', which build:all runs first.`);
  }
  if (missing.some((m) => m.startsWith('psss-engine/dist'))) {
    console.error(`${TAG} dist/ comes from 'npm run build'.`);
  }
  process.exit(1);
}

// ── the dry run, which needs no dependency ───────────────────────────────────────────────────────
if (LIST_ONLY) {
  const groups = new Map();
  let bytes = 0;
  for (const [abs, archivePath] of files) {
    const top = archivePath.split('/').slice(0, 2).join('/');
    const g = groups.get(top) ?? { n: 0, bytes: 0 };
    const size = statSync(abs).size;
    g.n++; g.bytes += size; bytes += size;
    groups.set(top, g);
  }
  for (const [top, g] of [...groups].sort()) {
    console.log(`${TAG} %s  %s file(s), %s MB`.replace('%s', top.padEnd(26))
      .replace('%s', String(g.n).padStart(4)).replace('%s', (g.bytes / 1048576).toFixed(1).padStart(6)));
  }
  console.log(`${TAG} TOTAL  ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB uncompressed`);
  console.log(`${TAG} --list only; nothing written`);
  process.exit(0);
}

// ── write, with bsdtar ───────────────────────────────────────────────────────────────────────────
// ⚠️ **RESOLVED BY PLATFORM, NOT HARDCODED (Phase 29.D20).** This was an absolute Windows path, which
// made the whole step Windows-only quite apart from the `.scr` input — so `release:web` could not have
// worked on any other platform. On Windows the binary is bundled; elsewhere it comes from PATH, where
// Debian/Ubuntu ship it in `libarchive-tools`.
const BSDTAR = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'bsdtar';

if (process.platform === 'win32' && !existsSync(BSDTAR)) {
  console.error(`${TAG} FAIL — ${BSDTAR} not found; it ships with Windows 10 1803 and later.`);
  process.exit(1);
}
// See the header: a `tar` from PATH may be GNU tar, which writes a TAR when asked for a zip.
const version = execFileSync(BSDTAR, ['--version'], { encoding: 'utf8' }).trim();
if (!/bsdtar/i.test(version)) {
  console.error(`${TAG} FAIL — ${BSDTAR} is not bsdtar but: ${version}`);
  console.error(`${TAG} GNU tar accepts '-a -c -f x.zip' and writes a TAR under that name.`);
  process.exit(1);
}

/*
 * The archive paths are exactly the repository-root-relative paths, so `-C ROOT` plus a list of
 * relative paths stores them verbatim.
 *
 * ⚠️ **A FILE LIST, NEVER A DIRECTORY LIST.** `bsdtar` has no notion of this script's exclusions, so
 * handing it `psss-engine/screensaver` would pack `bin/`, `obj/`, `probe/` and `Payload/` with it — the
 * whole point of the walk above. The list is also written to a FILE rather than passed as arguments,
 * because 130 paths exceed a comfortable command line and Windows' limit is a silent truncation.
 */
const listFile = join(ROOT, '.package-dist.filelist');
writeFileSync(listFile, files.map(([, archivePath]) => archivePath).join('\n') + '\n', 'utf8');

// Not an overwrite — the stamp makes the name unique — but harmless, and it keeps the step idempotent
// inside one second if it is ever run twice in the same second.
rmSync(OUT, { force: true });
try {
  execFileSync(BSDTAR, ['-a', '-c', '-f', OUT, '-C', ROOT, '-T', listFile], { stdio: 'inherit' });
} finally {
  rmSync(listFile, { force: true });
}

// ── read the finished file back and assert it ────────────────────────────────────────────────────
// The signature first: see the header for why a plausible non-zip is the failure to guard here.
const sig = readFileSync(OUT).subarray(0, 4);
if (!(sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04)) {
  console.error(`${TAG} FAIL — ${OUT} does not start with PK\\x03\\x04, so it is not a zip`);
  console.error(`${TAG} first bytes: ${[...sig].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
  process.exit(1);
}
const names = execFileSync(BSDTAR, ['-tf', OUT], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((n) => n.replace(/\\/g, '/'));
const has = (p) => names.includes(p);
const anyUnder = (frag) => names.some((n) => n.includes(frag));

const checks = [
  ['dist/index.html present', has('psss-engine/dist/index.html')],
  ['dist/psss_presets.json present', has('psss-engine/dist/psss_presets.json')],
  // ⚠️ INVERTED in web mode rather than dropped (Phase 29.D20): there, the presence of
  // `dist/screensaver/` means a STALE `.scr` from an earlier Windows build was packed under a name
  // that advertises itself as web-only — which is the one confusion the `_web` suffix exists to stop.
  WEB_ONLY
    ? ['NO dist/screensaver (web archive)', !anyUnder('dist/screensaver')]
    : ['dist/screensaver/psss.scr present', has('psss-engine/dist/screensaver/psss.scr')],
  ['src/main.ts present', has('psss-engine/src/main.ts')],
  ['screensaver source present', has('psss-engine/screensaver/Program.cs')],
  ['build scripts present', has('psss-engine/scripts/build-screensaver.mjs')],
  ['package.json present', has('psss-engine/package.json')],
  ...DOC_FILES.map((f) => [`${f} present`, has(f)]),
  ['NO screensaver/bin', !anyUnder('screensaver/bin/')],
  ['NO screensaver/obj', !anyUnder('screensaver/obj/')],
  ['NO screensaver/probe', !anyUnder('screensaver/probe/')],
  ['NO screensaver/Payload', !anyUnder('screensaver/Payload/')],
  ['NO nested .zip', !names.some((n) => n.toLowerCase().endsWith('.zip'))],
  ['NO node_modules', !anyUnder('node_modules/')],
];

let bad = 0;
for (const [label, ok] of checks) {
  if (!ok) { console.error(`${TAG} FAIL  ${label}`); bad++; }
}
if (bad > 0) {
  console.error(`${TAG} ${bad} assertion(s) failed over ${names.length} entries — archive left for inspection`);
  process.exit(1);
}

const mb = (statSync(OUT).size / (1024 * 1024)).toFixed(1);
console.log(`${TAG} ${OUT.slice(ROOT.length + 1)}  ${names.length} entries, ${mb} MB`);

// See the OUT header: nothing is overwritten, so say how many are now there. A release artefact that
// quietly accumulates is a disk problem the build is in the best position to notice.
const archives = readdirSync(ROOT)
  // ⚠️ `(_web)?` is load-bearing: without it a `--web` archive does not match, so web archives would
  // pile up uncounted by the one instrument that exists to notice exactly that (Phase 29.D20).
  .filter((n) => /^psss-engine-v2-distribution_\d{8}_\d{6}(_web)?\.zip$/.test(n))
  .sort();
if (archives.length > 1) {
  console.log(`${TAG} note: ${archives.length} archives now in the repository root `
    + `(${archives[0]} … ${archives[archives.length - 1]}) — none is deleted by this step`);
}
console.log(`${TAG} OK — ${checks.length} assertions passed`);
