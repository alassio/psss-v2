#!/usr/bin/env node
/*
 * ============================================================================================
 * THE SECOND ARTEFACT'S BUILD DRIVER — `npm run build:screensaver`, step 2 of `npm run build:all`.
 * ⚠️ **It was the TAIL of `build:all` until 2026-10-11**, when `docs:pdf` and `package:dist` were added
 * after it; the archive step reads this step's `dist/screensaver/` output, so it still runs before them.
 * ============================================================================================
 *
 * Runs `screensaver/build.bat` (the .NET publish), then does the three things the .NET build
 * cannot do for itself, each of which was a hand step until 2026-09-17:
 *
 *   1. stages the deployment's DATA files beside the published `.scr`, from `dist/`;
 *   2. ASSERTS the payload is one build — the data files byte-identical to `dist/` by SHA-256, and
 *      the embedded half checked TWICE: once against `dist/` on disk, and once INSIDE the published
 *      binary, which are two different questions (see step 3b);
 *   3. assembles `dist/screensaver/` — the installable folder, so both artefacts of one build end
 *      up under `dist/` and ship from one place.
 *
 * ⚠️ **THE STAGING STEP IS WHY THIS SCRIPT EXISTS, AND ITS ABSENCE WAS SILENT FOR TWO DAYS.**
 * `Psss.Screensaver.csproj` refreshes only the EMBEDDED half of the payload (`Payload/`, from
 * `../dist`) and fails loudly if it is missing. The DISK half — the preset and reel files, which
 * D4 deliberately keeps out of the binary — was copied by no build step at all, so a publish
 * folder kept its data files from whenever a human last copied them. Measured 2026-09-17: a
 * `psss.scr` carrying a fresh engine sat beside a preset file two days old and 320 presets long,
 * against a `dist/` of 313. Nothing reports that — the screensaver starts, plays, and shows a
 * library nobody built. **A size or a date is not the check; the hash is.**
 *
 * ⚠️ **NO PAYLOAD FILENAME IS SPELLED IN THIS FILE, DELIBERATELY** — and the sources it derives
 * them from are chosen so that each can DISAGREE with the tree. `PayloadFiles.cs` documents that
 * the four names live in four places with no compiler between the copies (`vite.config.ts`,
 * `presets/reel-store.ts`, `scripts/export-library.mjs`, the host); a fifth would make a rename one
 * step harder to audit, and this script would be the copy nobody thinks to check. So:
 *
 *   embedded      = the `<EmbeddedResource Include="Payload\…">` lines of the .csproj — what the
 *                   BINARY carries. ⚠️ Not the listing of `Payload/`: that directory is generated,
 *                   a leftover in it is embedded by nothing, and reading it would turn a harmless
 *                   rename artefact into a failed build with a wrong diagnosis.
 *   on disk       = the `<script src>` tags of `dist/index.html`, MINUS the embedded set — what the
 *                   PAGE will ask the host to serve. ⚠️ Not the listing of `dist/`: a data file
 *                   MISSING from `dist/` must fail here, and a listing cannot miss what is absent.
 *                   `scripts/export-library.mjs` asserts those same tags from the other end, so the
 *                   two scripts close the loop on the names without either spelling them.
 *
 * A rename on the engine side therefore flows through with nothing to update here, and a file that
 * changes SIDES (embedded ⇄ on disk) follows a `.csproj` edit automatically. ⚠️ **The `.scr` is
 * found by EXTENSION for the same reason** — the rename is owned by the `RenameToScr` target — and
 * exactly one is required, because two would mean entry points that can drift.
 *
 * ⚠️ **THE HASH CHECK ON THE EMBEDDED HALF IS NOT REDUNDANT WITH THE `.csproj`'s GUARD.** That
 * target's `Error` conditions only test that the two source files EXIST; they cannot see a `Copy`
 * that did not happen, a `Payload/` edited by hand, or an `EmbeddedResource` naming a file `dist/`
 * no longer produces — all of which end in an embedded page that differs from the one in `dist/`,
 * which is invisible on screen. ⚠️ **And it is not the whole check either: it reads the INPUTS.** A
 * compile or publish that reused an earlier assembly leaves every input on disk correct and the
 * binary stale, so step 3b asks the same question of the artefact. **Two layers, not one, because
 * "the files I built are right" and "the file I ship carries them" fail independently.**
 *
 * ⚠️ **`vite build` EMPTIES `dist/`, SO `dist/screensaver/` IS DELETED BY THE NEXT WEB BUILD.**
 * That is correct and load-bearing: a `.scr` surviving in `dist/` past a rebuild of the engine it
 * embeds is exactly the stale artefact this script is written against. It also means the folder is
 * regenerated whole here rather than merged into, so a file that stops being part of the
 * deployment cannot linger in it.
 *
 * ⚠️ **`dist/screensaver/` HOLDS NO `.exe`.** The `.exe` copy is the *testing* route for `/s` and
 * `/c` (`screensaver/README.md` §3 — a typed argument never survives a `.scr` launch), not a
 * deliverable. This script refreshes one that already exists in the publish folder, because a
 * rebuild otherwise leaves it stale and you test old code with no symptom; it never creates one.
 *
 * ⚠️ **AN INSTALLED COPY IS OUTSIDE THIS SCRIPT AND IS THE ONE REMAINING WAY TO RUN A STALE
 * LIBRARY.** Installing copies the three files elsewhere (`System32\`, or wherever the right-click
 * *Install* pointed the registry at), and `PayloadFiles.FindOnDisk` reads them from beside the
 * executable, then from `%LOCALAPPDATA%\psss\screensaver\data`. Nothing here writes to either — a
 * build must not modify an install — so the fallback directory is only CHECKED, and a stale file
 * there is reported as a warning naming the fix.
 *
 * Windows only, by nature: it shells out to a `.bat` that calls `vcvars64`.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const SCREENSAVER = resolve(ROOT, 'screensaver');
const PAYLOAD = resolve(SCREENSAVER, 'Payload');
const CSPROJ = resolve(SCREENSAVER, 'Psss.Screensaver.csproj');
const BUILD_BAT = resolve(SCREENSAVER, 'build.bat');
const OUT = resolve(DIST, 'screensaver');
const INDEX = resolve(DIST, 'index.html');
// The host's own fallback location, spelled in `PayloadFiles.cs`'s `HostPaths`. Read-only here.
const FALLBACK_DATA = process.env.LOCALAPPDATA
  ? resolve(process.env.LOCALAPPDATA, 'psss', 'screensaver', 'data') : null;

const TAG = '[build-screensaver]';
const warnings = [];
const fail = (msg) => { console.error(`${TAG} ${msg}`); process.exit(1); };
const warn = (msg) => { warnings.push(msg); };
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const filesIn = (dir) => readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isFile()).map((e) => e.name).sort();

if (process.platform !== 'win32') {
  fail(`the screensaver host is Windows-only (.NET 8 + Visual Studio); this is ${process.platform}.\n`
    + `${TAG} run \`npm run build\` for the web deployment, which is platform-independent.`);
}
if (!existsSync(BUILD_BAT)) fail(`${BUILD_BAT} not found.`);
if (!existsSync(CSPROJ)) fail(`${CSPROJ} not found.`);
if (!existsSync(INDEX)) {
  fail(`dist/index.html is missing — run \`npm run build\` first, or \`npm run build:all\`, which does both.`);
}

/*
 * ── the two derived name sets, both read BEFORE the publish so a mismatch costs no build ──────
 */
const csproj = readFileSync(CSPROJ, 'utf8');
const embedded = [...csproj.matchAll(/<EmbeddedResource\s+Include="Payload[\\/]([^"]+)"/g)].map((m) => m[1]).sort();
if (embedded.length === 0) {
  fail(`no <EmbeddedResource Include="Payload\\…"> in ${basename(CSPROJ)} — the payload's embedded half is\n`
    + `${TAG} declared there and nowhere else. If that shape changed, this script must be re-read, not patched.`);
}

const html = readFileSync(INDEX, 'utf8');
const referenced = [...html.matchAll(/<script\b[^>]*\bsrc="\.?\/?([^"/]+)"/g)].map((m) => m[1]);
if (referenced.length === 0) fail(`no <script src> tags in dist/index.html — the packer's output is not deployable.`);
const onDisk = [...new Set(referenced.filter((n) => !embedded.includes(n)))].sort();
if (onDisk.length === 0) {
  fail(`dist/index.html references nothing the host would serve from disk, which contradicts D4.\n`
    + `${TAG} referenced: ${referenced.join(', ')} — embedded: ${embedded.join(', ')}`);
}
// ⚠️ Named by the PAGE, so a data file the build failed to write is reported by name from here.
const missing = onDisk.filter((n) => !existsSync(resolve(DIST, n)));
if (missing.length > 0) {
  // ⚠️ The message says nothing about how BADLY each file is missed, on purpose. At runtime the two
  // data files are asymmetric — a missing preset file is fatal, a missing reel file is a warning and
  // the built-in reels play (19.11) — but at BUILD time a file the page references and the build did
  // not write is a defect either way, and a message that ranked them would be the first place that
  // asymmetry got levelled.
  fail(`dist/index.html asks for ${missing.length} file(s) that dist/ does not have: ${missing.join(', ')}\n`
    + `${TAG} re-run \`npm run build\` (or \`npm run build:all\`) — the page would ship asking for a file that is not there.`);
}
// Anything in dist/ that is neither embedded nor referenced travels with neither artefact.
const unclaimed = filesIn(DIST).filter((n) => !embedded.includes(n) && !onDisk.includes(n));
if (unclaimed.length > 0) {
  warn(`dist/ holds ${unclaimed.length} file(s) that index.html does not reference and the binary does not `
    + `embed, so they are NOT staged: ${unclaimed.join(', ')}`);
}

// ── 1. the .NET publish ──────────────────────────────────────────────────────────────────────
// `build.bat` prepends the VS Installer directory to PATH and calls vcvars64 before
// `dotnet publish`; a bare `dotnet publish` fails as MSB3073 with vswhere's stderr folded into the
// linker command line (screensaver/README.md §1). Never substitute one for the other here.
console.log(`${TAG} embedded per ${basename(CSPROJ)}: ${embedded.join(', ')}`);
console.log(`${TAG} on disk per dist/index.html: ${onDisk.join(', ')}`);
/*
 * ⚠️⚠️ **THE VERSION COMES FROM `package.json` AND NOWHERE ELSE** — the one version surface (CLAUDE.md,
 * *Versioning and releases*). It is passed to `dotnet publish` through `build.bat`'s `%*`, so the .csproj
 * carries no number of its own (its default is the deliberately non-release `0.0.0-local`), and it is READ
 * BACK from the published .scr in step 2b, because a property that silently fails to land produces a
 * binary that looks right and reports the wrong release — the class of defect nothing else here would see.
 * ⚠️ A strict `x.y.z` is required: `AssemblyVersion` refuses a pre-release suffix and the failure arrives
 * as an unrelated-looking compiler error several screens up.
 */
const VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
  fail(`package.json version ${JSON.stringify(VERSION)} is not a plain x.y.z, which the .NET build needs`);
}
console.log(`${TAG} publishing the host at version ${VERSION} — screensaver/build.bat`);
const publish = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', BUILD_BAT, `-p:Version=${VERSION}`], {
  cwd: SCREENSAVER,
  stdio: 'inherit',
});
if (publish.error) fail(`could not run build.bat: ${publish.error.message}`);
if (publish.status !== 0) {
  fail(`build.bat exited ${publish.status} — the host was NOT published, and nothing below ran.\n`
    + `${TAG} three warning families are expected on a GREEN build; screensaver/README.md §1 says which.`);
}

// ── 2. locate the publish folder, by scanning rather than by rebuilding the .csproj's path ────
// ⚠️ The TFM and the RuntimeIdentifier live in the .csproj; spelling the path here would copy both
// and go stale on a retarget with the build still green. Exactly one `publish` directory must
// exist — several means an old TFM's output is still on disk and "the newest" would be a guess.
const publishDirs = [];
(function scan(dir, depth) {
  if (depth > 6 || !existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const child = join(dir, e.name);
    if (e.name === 'publish') publishDirs.push(child);
    else scan(child, depth + 1);
  }
})(resolve(SCREENSAVER, 'bin'), 0);

if (publishDirs.length === 0) fail(`build.bat reported success but no publish/ directory was produced.`);
if (publishDirs.length > 1) {
  fail(`${publishDirs.length} publish directories found, so the target is ambiguous — delete the stale ones:\n`
    + publishDirs.map((d) => `  ${d}`).join('\n'));
}
const PUBLISH = publishDirs[0];

// ⚠️ Found by EXTENSION, not by name: the rename is owned by the `RenameToScr` target. Located here,
// BEFORE the embed checks, because one of them reads the binary itself.
const scrs = filesIn(PUBLISH).filter((n) => extname(n).toLowerCase() === '.scr');
if (scrs.length !== 1) {
  fail(`expected exactly one .scr in the publish folder, found ${scrs.length}${scrs.length ? `: ${scrs.join(', ')}` : ''}.`);
}
const SCR = scrs[0];

// ── 3. the embedded half: what the binary carries must be what dist/ holds ────────────────────
if (!existsSync(PAYLOAD)) fail(`${PAYLOAD} was not produced — the .csproj's CopyDeploymentPayload target did not run.`);
const embedMismatch = [];
for (const name of embedded) {
  const staged = resolve(PAYLOAD, name);
  const source = resolve(DIST, name);
  if (!existsSync(staged)) embedMismatch.push(`${name} — embedded by the .csproj but absent from Payload/`);
  else if (!existsSync(source)) embedMismatch.push(`${name} — embedded, but dist/ does not produce it`);
  else if (sha(staged) !== sha(source)) embedMismatch.push(`${name} — Payload/ copy differs from dist/`);
}
if (embedMismatch.length > 0) {
  // ⚠️ The `.scr` is NOT deleted here. This check runs after the publish — it needs the Payload/ the
  // publish wrote — so a failure always leaves a binary on disk, and that binary is the evidence for
  // diagnosing the mismatch. Saying so is the mitigation; deleting it would throw the evidence away
  // and still leave the run's other outputs behind.
  fail(`the EMBEDDED payload does not match dist/ — the binary would play a build you did not make:\n`
    + embedMismatch.map((l) => `  ${l}`).join('\n')
    + `\n${TAG} ⚠️  a .scr WAS published before this check ran and must not be run or shipped.`
    + `\n${TAG} delete screensaver/Payload/ and re-run \`npm run build:all\`.`);
}
const orphanPayload = filesIn(PAYLOAD).filter((n) => !embedded.includes(n));
if (orphanPayload.length > 0) {
  warn(`screensaver/Payload/ holds ${orphanPayload.length} file(s) the .csproj does not embed, so they are `
    + `dead weight from an earlier build: ${orphanPayload.join(', ')} — delete the directory to be sure.`);
}

/*
 * ── 3b. THE SAME QUESTION ASKED OF THE ARTEFACT INSTEAD OF ITS INPUTS ─────────────────────────
 *
 * ⚠️ **THE HASH CHECK ABOVE COMPARES WHAT WAS OFFERED FOR EMBEDDING, NOT WHAT THE BINARY CONTAINS.**
 * `Payload/` matching `dist/` says the copy happened; it cannot see a compile or a publish that
 * reused an earlier assembly, and in that state every input on disk is correct while the `.scr`
 * carries the previous page. So the payload is looked for IN the binary: a 256-byte slice from the
 * middle of each embedded file must appear in it verbatim.
 *
 * ⚠️ **THIS WORKS ONLY WHILE THE SINGLE-FILE BUNDLE IS UNCOMPRESSED** — measured 2026-09-17: the
 * bundled DLL is stored as-is, so a slice of `psss-engine.js` occurs exactly once in the 16 MB
 * output. Setting `EnableCompressionInSingleFile` (or compressing resources) would break this check
 * on a perfectly healthy build, which is why the failure message names that property first: read a
 * red here as a claim about the CHECK until the check is exonerated.
 *
 * ⚠️ **Not a hash of the resource** — reading .NET metadata to extract one would mean parsing the
 * bundle and the PE, and a defect in the parser is indistinguishable from a defect in the build. A
 * substring search has no state to get wrong. It proves presence, not that nothing else is stale.
 */
/*
 * 2b. ⚠️⚠️ **THE PUBLISHED .scr MUST CARRY `package.json`'s VERSION — READ BACK, NOT ASSUMED.** Windows shows
 * this number in the file's Properties → Details, and the Settings window prints it in its title; both read
 * the binary, so the binary is what is checked. `VersionInfo` is Windows' own reader of the version
 * resource, which is the reader the user's Explorer uses — a home-made PE parser would be a second reader
 * that could disagree with it.
 */
const versionRead = spawnSync('powershell', ['-NoProfile', '-Command',
  `(Get-Item -LiteralPath '${resolve(PUBLISH, SCR).replace(/'/g, "''")}').VersionInfo.ProductVersion`],
{ encoding: 'utf8' });
const scrVersion = (versionRead.stdout || '').trim().split('+')[0];
if (versionRead.status !== 0 || scrVersion !== VERSION) {
  fail(`the published ${SCR} reports version ${JSON.stringify(scrVersion)}, not package.json's ${VERSION} — `
    + 'the -p:Version property did not reach the binary');
}
console.log(`${TAG}   ${SCR} carries version ${scrVersion}, read back from the binary`);

const SLICE_BYTES = 256;
const scrBlob = readFileSync(resolve(PUBLISH, SCR));
const notInBinary = embedded.filter((name) => {
  const src = readFileSync(resolve(DIST, name));
  if (src.length < SLICE_BYTES) return false; // nothing to sample; the hash check above still applies
  const slice = src.subarray(Math.floor(src.length / 2), Math.floor(src.length / 2) + SLICE_BYTES);
  return scrBlob.indexOf(slice) < 0;
});
if (notInBinary.length > 0) {
  fail(`the published ${SCR} does not contain the current ${notInBinary.join(' or ')} — it carries an EARLIER\n`
    + `${TAG} build of the page even though Payload/ and dist/ agree, which is the one staleness the\n`
    + `${TAG} .csproj's guard cannot see. ⚠️  a .scr WAS published and must not be run or shipped.\n`
    + `${TAG} First: has \`EnableCompressionInSingleFile\` or resource compression been turned on? Then this\n`
    + `${TAG} check is what broke, not the build. Otherwise: delete screensaver/obj/ and screensaver/Payload/\n`
    + `${TAG} and re-run \`npm run build:all\`.`);
}

// ── 4. stage the disk half beside the .scr ────────────────────────────────────────────────────
for (const name of onDisk) copyFileSync(resolve(DIST, name), resolve(PUBLISH, name));

// ── 5. dist/screensaver/ — the installable folder, regenerated whole ─────────────────────────
// ⚠️ Removed rather than merged into: this directory is this script's own artefact, and a leftover
// file in it would look like part of the deployment. `vite build` empties dist/ anyway.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
copyFileSync(resolve(PUBLISH, SCR), resolve(OUT, SCR));
for (const name of onDisk) copyFileSync(resolve(DIST, name), resolve(OUT, name));

// ── 6. the identity check, over both destinations at once ─────────────────────────────────────
// The clause the request is about: the deployment's data files are identical in all three places or
// the build fails. ⚠️ Hash, never size — a preset library changes content far more often than
// length. Read as a POST-CONDITION on step 4/5 rather than as a search for a defect elsewhere: the
// hashes printed below are measured at the DESTINATION, so the summary states what was written and
// not what was intended.
const identity = [];
for (const name of onDisk) {
  const want = sha(resolve(DIST, name));
  for (const [where, dir] of [['publish', PUBLISH], ['dist/screensaver', OUT]]) {
    const got = sha(resolve(dir, name));
    if (got !== want) identity.push(`${name} differs in ${where} (${got.slice(0, 12)} != ${want.slice(0, 12)})`);
  }
}
if (identity.length > 0) fail(`data files are not identical after staging:\n` + identity.map((l) => `  ${l}`).join('\n'));

// ── 7. refresh an EXISTING .exe test copy, never create one ──────────────────────────────────
// screensaver/README.md §3: a typed argument never survives a `.scr` launch, so `/s` and `/c` are
// tested through a copy named `.exe`. A rebuild does not follow that copy, and a stale one tests
// old code with no symptom — the one silent failure of the documented test route.
const exeTwin = `${SCR.slice(0, -extname(SCR).length)}.exe`;
let exeNote = '';
if (existsSync(resolve(PUBLISH, exeTwin))) {
  copyFileSync(resolve(PUBLISH, SCR), resolve(PUBLISH, exeTwin));
  exeNote = `refreshed the existing test copy ${exeTwin} from ${SCR} (it does not follow a rebuild on its own)`;
}

// ── 8. an installed copy's fallback data directory, CHECKED and never written ─────────────────
if (FALLBACK_DATA && existsSync(FALLBACK_DATA)) {
  const stale = onDisk.filter((n) => {
    const there = resolve(FALLBACK_DATA, n);
    return existsSync(there) && sha(there) !== sha(resolve(DIST, n));
  });
  if (stale.length > 0) {
    warn(`${FALLBACK_DATA} holds an older ${stale.join(' and ')} — an INSTALLED screensaver reading from `
      + `there plays that library, not this build. Copy dist/screensaver/ over it by hand; a build must not `
      + `write into an install.`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
const size = (f) => statSync(f).size.toLocaleString('en-US');
console.log(`${TAG} embedded, verified byte-identical to dist/: ${embedded.join(', ')}`);
console.log(`${TAG} staged beside the .scr and in dist/screensaver/: ${onDisk.join(', ')}`);
console.log(`${TAG} ${PUBLISH}`);
console.log(`${TAG} dist/screensaver/ — the installable set:`);
for (const name of [SCR, ...onDisk]) {
  console.log(`${TAG}   ${name.padEnd(20)} ${size(resolve(OUT, name)).padStart(12)} B  sha256 ${sha(resolve(OUT, name)).slice(0, 12)}`);
}
console.log(`${TAG} data files identical in dist/, publish/ and dist/screensaver/ (sha256)`);
if (exeNote) console.log(`${TAG} ${exeNote}`);
for (const w of warnings) console.warn(`${TAG} ⚠️  ${w}`);
