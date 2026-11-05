# psss screensaver host — build, install, and the argument contract

A Windows `.scr` screensaver that plays the psss engine's Reel in a WebView2 window. **Phase 20** of
`research_paper_psss_fractal_v8.md`; the eight binding decisions are **D1–D8** there and are not
re-opened here.

⚠️ **This file is the human-facing half only.** Every rule whose violation is *silent* lives as a ⚠️
paragraph in the source file that owns it — `Psss.Screensaver.csproj`, `Program.cs`, `PayloadFiles.cs`,
`ScreensaverWindow.cs`, `PreviewHost.cs`. **Read the header of the file you are about to edit.** What is
here is what a person needs before they have read any of them.

| where | what |
|---|---|
| `probe/RUN-RECORD.md` | the hand-run host probe and **its results** — cases A–L, the figures, and what each instrument cannot see |
| `../tests/10-screensaver-mode.spec.ts` | the automated half: the `?screensaver=1` **page** contract, seven cases, twelve seeds |
| plan → *Phase 20* | D1–D8, and every measurement that chose the shape below |

---

## 1. Build

**Prerequisites**, all present on the machine this was developed on: Visual Studio (for the native
linker the single-file publish invokes), the **.NET 8 SDK** (8.0.421 measured), and Node for the engine
build. **WebView2 needs no SDK** — the runtime ships with Windows 11 and the NuGet package carries the
interop.

```sh
cd psss-engine
npm run build:all                  # everything, in order; this host is step 2 of four
```

That is `npm run build` (the engine bundle → `dist/`) followed by `npm run build:screensaver`
(`scripts/build-screensaver.mjs`), which runs `build.bat` and then does the three things the .NET build
cannot do for itself. ⚠️ **Since 2026-10-11 `build:all` continues past this host** with `npm run
docs:pdf` and `npm run package:dist` (the manuals as PDF, then the distribution archive) — **so a green
`build:all` no longer means the run ENDED here, and a failure after this point is not a failure of this
host.** The repo-root `README.md` §4 lists the four steps. Either stage still runs alone, and
`npm run build` alone is unchanged for anyone who wants only the web artefact — it is the
platform-independent half, and this one needs .NET and Visual Studio:

```sh
npm run build                      # 1. the engine bundle -> dist/   (no .NET needed)
npm run build:screensaver          # 2. the host, staging and the identity checks
screensaver/build.bat              # ...step 2's publish alone, WITHOUT the staging or the checks
```

⚠️ **A BARE `build.bat` LEAVES THE JOB HALF DONE, AND THE HALF IT SKIPS IS THE SILENT ONE.** The
`.csproj` refreshes only the **embedded** half of the payload (`Payload/`, from `../dist`) and fails the
build if it is missing. The **disk** half — the preset and reel files, which D4 deliberately keeps out of
the binary — was for two days copied by no build step at all: a publish folder kept whatever a human last
put there. Measured 2026-09-17: a fresh `psss.scr` sat beside a preset library two days old and 320
presets long, against a `dist/` of 313. Nothing reports that. The screensaver starts, plays, and shows a
library nobody built. `npm run build:screensaver` is what closes it.

**What the wrapper adds, and why each part is a check rather than a copy:**

1. **Stages the data files** from `dist/` beside the published `.scr`.
2. **Asserts the payload is ONE build**, in two layers that fail independently — the embedded files
   compared to `dist/` by SHA-256 (the *inputs*), and a 256-byte slice of each looked for **inside the
   published binary** (the *artefact*). ⚠️ **The second is not a slower version of the first**: a compile
   or publish that reuses an earlier assembly leaves every input on disk correct and the `.scr` carrying
   the previous page. The slice check works only while the single-file bundle is uncompressed — measured
   2026-09-17, a slice of `psss-engine.js` occurs exactly once in the 16 MB output — so if
   `EnableCompressionInSingleFile` is ever turned on, **read a red there as a claim about the check.**
3. **Asserts the data files are byte-identical** in `dist/`, the publish folder and `dist/screensaver/`,
   **by hash and never by size** — a preset library changes content far more often than length.
4. **Assembles `dist/screensaver/`** — `psss.scr` + the two data files, the installable set, so one build
   leaves both artefacts under `dist/`. ⚠️ **`vite build` empties `dist/`, so a later web-only build
   deletes that folder** — which is correct: a `.scr` outliving the engine it embeds is the stale artefact
   all of this is written against.
5. **Refreshes an existing `psss.exe` test copy** (§3) and never creates one.

⚠️ **It spells none of the four payload filenames, deliberately** — `PayloadFiles.cs` documents that they
live in four places with no compiler between the copies, and a fifth would make a rename one step harder
to audit. The embedded set is read from the `.csproj`'s `EmbeddedResource` lines and the disk set from
`dist/index.html`'s own `<script src>` tags, **each a source that can disagree with the tree**: a data
file the build failed to write is named by the *page* that asks for it. Never edit `Payload/` by hand —
it is regenerated on every build.

⚠️ **The one staleness no build step can reach is an INSTALLED copy.** Installing puts the three files
somewhere else, and nothing here writes into an install. The wrapper only *checks* the
`%LOCALAPPDATA%\psss\screensaver\data` fallback and warns if what is there is older than `dist/`; after a
rebuild, re-copy `dist/screensaver/` over an install by hand.

⚠️ **Use `build.bat`, not a bare `dotnet publish`.** The script prepends the VS Installer directory to
`PATH` and calls `vcvars64.bat`, because the link step invokes `vswhere.exe` **bare**; without it on
`PATH` the failure surfaces as **MSB3073 with vswhere's own stderr folded into the linker command
line**, which reads as a corrupt toolchain rather than a missing directory. Adjust the two paths in the
script if Visual Studio moves.

### Two deviations from the plan's own skeleton, both measured

The plan's 20.2 says `net9.0-windows, PublishAot`. Neither survived its retire-the-risk step. Both are
recorded rather than silently substituted:

1. **`net8.0-windows`.** Installing a .NET 9 SDK machine-wide needs elevation
   (`winget install Microsoft.DotNet.SDK.9` exits **1602** in a non-elevated shell) and the phase was to
   be implemented without blocking on a UAC prompt. Nothing in this host uses a .NET 9 API.
2. **`PublishSingleFile` + `SelfContained` + `TrimMode partial`, not `PublishAot`** — the plan's own
   stated fallback, taken because the risk it told us to retire first **did fire**. An AOT-published
   binary reaches `CoreWebView2Environment.CreateAsync` and throws
   `System.NotSupportedException: COM Interop requires ComWrapper instance registered for marshalling.`
   WebView2 reaches the browser through built-in COM interop, which NativeAOT does not provide.
   ⚠️ **`BuiltInComInteropSupport` does not rescue the AOT build; it does rescue the trimmed
   single-file one** — so that property is load-bearing, not defensive. Without it the same probe throws
   `System.TypeLoadException`, because trimming removes COM support the compiler cannot see being used.
   **D1 required ONE FILE, not a small one**, so the fallback satisfies it.

⚠️ **`TrimMode partial` is not a tuning knob.** It trims only assemblies marked trimmable, which keeps
`System.Drawing.Common` (the `/p` PNG decode) and the WebView2 interop assembly whole. A full trim is
untested, and its failure mode is a runtime `TypeLoadException` **in a process with no console**.

### Three warning families are expected. Re-measured 2026-09-15 on a clean publish

A green build is **not** a silent build, and treating these as noise is how the fourth one gets missed:

- **`MSB3277` — `WindowsBase` 4.0.0.0 vs 5.0.0.0** (about a dozen lines). The WebView2 package ships a
  WPF assembly (`Microsoft.Web.WebView2.Wpf.dll`) alongside the Core one; this host uses **only Core**
  and no WPF. The higher version wins and nothing loads the WPF half. ⚠️ **This is the one to re-read if
  a future edit adds a WPF or WinForms reference** — then the conflict stops being cosmetic.
- **`IL2026` — "Built-in COM support is not trim compatible."** The exact interaction deviation 2 above
  is about. It is a warning *because* the trimmer cannot prove the COM path; `BuiltInComInteropSupport`
  is what makes it work anyway, and the run record's case A–L pass is the evidence that it does.
- **`IL2104` — `Microsoft.Web.WebView2.Wpf` / `.Core` "produced trim warnings."** The library-level
  roll-up of the same thing.

**Nothing else should appear.** A new `IL` warning naming *this host's own* assembly is a real finding.

### The version it carries

**The `.scr` carries `psss-engine/package.json`'s version, and nothing in this folder writes one.**
`scripts/build-screensaver.mjs` passes it to `dotnet publish` as `-p:Version=<x.y.z>` (through
`build.bat`'s `%*`) and then **reads it back** from the published binary with Windows' own `VersionInfo`,
failing the build if the two disagree. It appears in the file's Properties → Details, in the Settings
window's title, and at the start of the host's log line.

⚠️ **Never write a number into the `.csproj`.** Its default is `0.0.0-local` on purpose, so a bare
`build.bat` run produces a binary that says plainly it is not a release; a hand-written version there would
be a second version surface that drifts on the first bump.

### The output

**`dist/screensaver/` is the installable set — three files, and it is what to copy anywhere.** The
publish folder holds the same three plus whatever §3 left there (a `psss.exe` test twin, refreshed if it
exists), which is why the *assembled* folder rather than the publish folder is the deliverable. Measured
at the 2026-09-17 build:

```
dist/screensaver/psss.scr             16,159,428 B   sha256 abcfed853db7…  (host + embedded index.html and psss-engine.js)
dist/screensaver/psss_presets.json     1,995,801 B   sha256 f7bce3040182…  (313 presets)
dist/screensaver/psss_reels.json           1,178 B   sha256 1f132837d46f…  (3 reels, main "Grand Tour")
```

⚠️ **THAT TABLE IS FROZEN AT THAT BUILD, AND ITS PRESET FILE IS ALREADY BEHIND THE SOURCE — later the SAME
DAY.** THREE separate refined-preset batches landed on 2026-09-17 after this staging — eleven settles + one
variant, then ten + two, then eleven + three — so `src/`
now composes **276** presets (1,827,654 B) where the staged file holds 313 — **FIVE library batches behind as of
2026-09-18, three of which share the one date 2026-09-17, so the date on the table above cannot tell you how far
behind it is; only the count can.** ⚠️ **AND THE COUNT ALONE CANNOT TELL YOU THE DIRECTION EITHER: the fourth batch
(2026-09-18 morning, the TransMap pass-order review) ADDED 14 temporary `" warpfirst"` copies and took the total to
301, and the fifth (2026-09-18, twelve settles + one variant) DELETED all fourteen of them again and took it to
276** — so between two consecutive readings this figure went up by 14 and down by 25 without a single preset being
authored or retuned in either direction. **Read the batch names, never the difference of two totals**, and never
read a fall as "presets were removed": fourteen of that 25 is one review scaffold leaving, and it had arrived
in the reading immediately before. ⚠️ **AND THE THIRD BATCH MAKES THE GAP A BEHAVIOURAL ONE, NOT ONLY A LIBRARY ONE:** it
shipped alongside a fix to spark ejection in `generators/lissajous.ts` (the per-frame motion was read after the
previous-position buffer had been overwritten, so every spark was born at rest and `ejectionSpeed` multiplied a
zero), plus the re-fit of that slider across eleven presets. **The staged `.scr` therefore still runs the defective
spark code** — a stale payload is not always just a stale preset list, and nothing in the table above would say so.
Nothing detects that: `npm run
build` regenerates `dist/` alone and **only `build:all` restages `dist/screensaver/`**, so the installable set
keeps whatever library the last `build:all` saw, and the date on this table does not distinguish the two runs.
⚠️ **AS OF 2026-09-19 THE GAP IS THREE MORE BATCHES WIDE AND IT NOW COVERS THE REEL FILE TOO.** `src/` composes
**247** presets — the sixth, seventh and eighth settle batches closed the refined-preset review, so **read those
batch names in `research_paper_psss_fractal_v8.md`, never the difference 276 − 247**, which mixes settles that
replace a name with variants that add one. And the same sitting made `Grand Tour` **the whole library, in `random`
order**, which makes the `psss_reels.json` line above stale for a SECOND, independent reason: its 1,178 B /
`sha256 1f132837d46f…` describes a 12-name reel that no longer exists: the web half, rebuilt 2026-09-19, emits
**7,097 B** for the same three reels. **A reel file that grew says nothing about the preset file**, the two lines went
stale for different reasons on different dates, and neither can be repaired by arithmetic — re-measure both here, since
`npm run build` moved `dist/` alone and left this staging untouched.

⚠️ **A `build:all` is therefore OWED before the next install or `/s` run** — and when it is made, write a NEW
table rather than editing this one: the `.scr` line is the fixed point the +154 B attribution below leans on,
and the owner's Phase 20 confirmation was given on *this* payload.

**DISCHARGED 2026-09-24 — `npm run build:all`, EXIT 0, and here is the new table as that line asks. The
2026-09-17 one above is left exactly as it was**, because it is the payload the owner's Phase 20 confirmation
was given on and the fixed point the +154 B attribution leans on:

```
dist/screensaver/psss.scr             16,220,868 B   sha256 bd875e10ecb6…  (host + embedded index.html and psss-engine.js)
dist/screensaver/psss_presets.json     1,873,068 B   sha256 8b9da9449517…  (274 presets)
dist/screensaver/psss_reels.json          18,036 B   sha256 8c252bed1809…  (7 reels, main "Grand Tour")
```

⚠️ **Every stale-gap paragraph above is now closed, and each for its own reason — do not read the three lines
as one event.** The preset file closed an EIGHT-batch library gap (313 → 274 presets, and 274 is *below* 313
while being *later*: read the batch names, never the difference). The reel file went 1,178 B → 18,036 B
because the reel library was twice rebuilt in between — `Grand Tour` became the whole library in `random`
order on 2026-09-19, and on 2026-09-24 the owner's commission replaced the two hand-picked reels with six
generated themed ones, so this is **7 reels over 274 names**, not three over twelve. And the `.scr` moved
16,159,428 → **16,220,868 B, +61,440 B**, which is an EXPLAINED move in the sense the paragraphs below ask
for: the embedded half of the payload is `index.html` + `psss-engine.js`, and both changed across every phase
since 09-17. ⚠️ **But +61,440 B is exactly 60 KiB, which is a PE-alignment artefact and not the payload
delta** — the embedded resources are aligned, so **do not attribute this move byte-for-byte to the engine's
growth, and do not derive the engine's growth from it.** The two data files are hashed by the build, as the
paragraph below insists, and came out identical in `dist/`, `publish/` and `dist/screensaver/`.
⚠️ **The binary is UNWATCHED: this is a build reading, and the owner `/s` pass on a `.scr` is still owed —
now on a rebuild of a rebuild of a rebuild.** A build that verifies its own payload says nothing about what
the payload looks like on screen, and §5.M's show-mode pause is open and untouched by this rebuild.

⚠️ **The rename to `.scr` happens in the build, not in a human's instructions** — a screensaver is an
ordinary Win32 PE with a different extension, so the rename *is* the deliverable. The `.exe` is deleted
so the publish folder cannot ship two entry points that drift apart. ⚠️ **A rebuild from identical inputs
reproduced the byte size exactly** (measured 2026-09-15, again 2026-09-17), so a size that moves without
a source change is worth explaining rather than shrugging at. **The 2026-09-16 rebuild carrying the boot
curtain was 16,159,274 B, up from 16,155,178 B on 2026-09-15** — a source change, which is what an
explained move looks like.

⚠️ **AND ONE MOVE HERE IS UNATTRIBUTED, WHICH IS WORTH MORE THAN A GUESS: 16,159,274 → 16,159,428 B, +154 B,
with no host source edit between them.** Chased on 2026-09-17 and not explained: the UTF-16 scan below
returns 0 for the only string the sitting could have added, and the build is *deterministic at the current
tree* — a re-run and a from-scratch build after `rm -rf obj/` both produced 16,159,428 B at the identical
`sha256 abcfed853db7…`. The 274 binary no longer exists to diff, so the step cannot now be localised;
the honest reading is that something outside `screensaver/` (a NuGet or SDK servicing update is the
obvious candidate, unmeasured) moved it, **not** that 154 B is beneath noticing. **The two data files DO
move now** — 2,025,205 → 1,995,801 B on a library that went 320 → 313 presets — so unlike 2026-09-16
they are no longer the fixed point the `.scr` attribution can lean on; hash them (`build:screensaver`
does) rather than reading their size as a constant.

⚠️ **BUT THE SIZE IS ONLY HALF AN INSTRUMENT, AND THE OTHER HALF IS THE ONE YOU WILL WANT: A SOURCE CHANGE
CAN LEAVE IT BYTE-IDENTICAL.** Measured twice on 2026-09-16 — adding a ~40-character browser flag to
`WebHost.cs`, and then removing it again — and the publish was **16,159,274 B all three times**. A size
match therefore does **not** establish that the binary you are testing carries the edit you just made, which
is the question that matters after a rebuild. **What settles it is a string scan, and it must be UTF-16:**
C# string literals live in the `#US` metadata heap two bytes per character, so a byte-oriented `grep` for a
flag name finds nothing in a binary that contains it:

```sh
# 1 = present, 0 = absent. Run it on the publish output, not on the intermediate DLL.
perl -e 'local $/; my $d=<STDIN>; my $p=join("\0", split //, $ARGV[0]);
         my $c=0; $c++ while $d =~ /\Q$p\E/g; print "$c\n"' \
     disable-background-timer-throttling < publish/psss.scr
```

---

## 2. Install

`psss.scr` is one file, but **the two data files are not embedded and must sit beside it** (D4). Copy
all three together — `dist/screensaver/` is exactly that set — or the screensaver starts and cannot run.
⚠️ **Nothing in the build writes into an install**, so a rebuild leaves an installed copy on the previous
library, silently and indefinitely: re-copy all three by hand after every rebuild.

- **To try it:** double-click `psss.scr` in the publish folder, or type `psss.scr /s` there — ⚠️ **those are
  the same launch and the typed `/s` is not why it works.** Read §3's routing paragraph before concluding
  anything at all from a hand-typed argument.
- **To install it:** right-click `psss.scr` → **Install**, or copy all three files into
  `C:\Windows\System32\` and pick *psss* in **Settings → Personalisation → Lock screen → Screen saver**.
  ⚠️ Windows only lists `.scr` files in `System32`; the right-click route sets the registry value
  directly and works from anywhere the file stays put.
- **If the data files were left behind:** the host still starts, and the page reports the problem
  through `psss-fatal` rather than showing a black screen with no diagnosis.

⚠️ **The two data files are NOT symmetric, and never make them so** (19.11):

| file | missing ⇒ |
|---|---|
| `psss_presets.json` | **FATAL** — the engine has no library at all |
| `psss_reels.json` | **a warning**; the bundled `BUILT_IN_REELS` play instead |

**Fallback search order** (`PayloadFiles.FindOnDisk`): the folder holding `psss.scr`, then
`%LOCALAPPDATA%\psss\screensaver\data`. ⚠️ **The second location will rescue a broken install and make
it look fine** — if you are testing the missing-file behaviour, that directory must not exist.

### Where it keeps things

```
%LOCALAPPDATA%\psss\screensaver\screensaver.log   the log — every mode, every exit, every page console line
%LOCALAPPDATA%\psss\screensaver\WebView2\         the WebView2 user-data folder, and `localStorage` with it
%LOCALAPPDATA%\psss\screensaver\data\             the optional data-file fallback (see above)
```

⚠️ **The user-data folder has an `EBWebView` level inside it that this document omitted until 2026-09-17,
and the omission is worse than cosmetic** — it is the path you follow to clear or inspect the stored
settings, and the shortened form simply does not exist on disk, so following it reports the storage
absent rather than reporting a wrong folder. The reel settings are one key at:

```
%LOCALAPPDATA%\psss\screensaver\WebView2\EBWebView\Default\Local Storage\leveldb   key: psss.reels.v1
```

⚠️ **`/s`, `/p` and `/c` share ONE user-data folder, and that sharing is the feature** (D3): it is why a
main reel chosen in the config window is what the next `/s` plays. It is also why a reel picked while
probing stays picked — `probe/restore-profile.ps1` is the only way back, because the *Main reel*
checkbox deliberately cannot be un-ticked.

⚠️ **AND THIS FOLDER IS NOT YOUR EVERYDAY BROWSER'S, WHICH IS THE HALF THAT READS AS A BUG.** The three
modes share a profile with *each other* and with nothing else: a main reel ticked in the Lab in Chrome or
Edge, or on the dev server, does **not** reach the screensaver, and the screensaver's choice is invisible
there. Two separate stores of the same key, with no sync and no warning in either direction. The Settings
window (`/c`) is the only place a screensaver main reel can be set — which is exactly why `/c` exists.

⚠️ **The `Main reel` tick persists BY ITSELF — there is no Save to press, and that asymmetry is not
stated by the UI.** `setMainReel()` writes `localStorage` on the change event, so closing the config
window immediately after ticking loses nothing. `Save` covers a reel's **contents** (its preset list,
play seconds, transition) and those *are* lost if the window closes without it. Confirmed by reading the
key: eight writes, every one `"reels": []` with only `mainReelName` moving — the mark had been persisting
through a session in which no reel was ever saved.

---

## 3. The argument contract

Parsed case-insensitively; `/` and `-` are both accepted, and a handle may follow as `:1234`, `=1234` or
a separate argument. Handles arrive **decimal**; `0x`-prefixed hex is accepted too.

| argument | mode | what it does |
|---|---|---|
| `/s` | **show** | full screen on the **primary monitor**, siblings blacked out (D2). Plays the main reel. |
| `/p <hwnd>` | **preview** | a static `preview.png` into the Settings dialog's thumbnail (D5) |
| `/c`, `/c:<hwnd>` | **config** | the Lab's **Reel** tab in an ordinary window (D3) |
| *(none)*, `/p` with an unusable handle, anything unrecognised | **config** | see below |

⚠️ **YOU CANNOT REACH `/p` OR `/c` BY TYPING THEM, AND THE REASON IS INVISIBLE FROM THE OUTSIDE.**
`HKCR\scrfile\shell\open\command` is `"%1" /S` and is the **default** verb, so every launch that goes through
ShellExecute — a double-click, Explorer, `start`, `Start-Process`, and `cmd`/PowerShell resolving a `.scr` by
association — **throws away what you typed and passes `/S`**. That is also why the `/s` in §2 appears to work:
not because the argument arrived, but because the association supplies it regardless. Measured from the
registry on 2026-09-15 (`probe/run.ps1`'s header owns that measurement — it cost that probe one misread case)
and re-read unchanged on 2026-09-16.

⚠️ **The 2026-09-16 report that "`/c` and `/p` behave exactly like `/s`" was this and not a parser defect** —
all ten launches that day logged `args [/S]`, so neither argument ever reached `ParseArguments`. The same
binary launched with `UseShellExecute = false` logged `args [/c] -> Config (config with no owner window)`,
opened `40,40 2800x1624` and navigated to `?reel=0&tab=reel` with the Lab on the Reel tab; `/p <hwnd>` against
a real parent painted its thumbnail and exited 0 when the parent was destroyed. **Both modes work; only the
route to them was undocumented.**

| to reach | the routes that actually deliver the argument |
|---|---|
| **config** | right-click `psss.scr` → **Configure** (the `config` verb is `"%1"` with **no** argument, which is where "no argument ⇒ config" earns its keep), or **Settings…** in the Screen Saver dialog (`/c:<hwnd>`), or `probe/run.ps1 -ScrArgs '/c'` |
| **preview** | the Screen Saver dialog's own thumbnail, or `probe/preview-host.ps1` — `/p` needs a **live parent window**, and `/p` with no usable handle is config by contract, not by accident |
| **show** | anything at all, including the double-click |

⚠️ **THE SIMPLEST ROUTE IS TO COPY THE FILE TO `psss.exe` AND RUN THAT — the owner's, 2026-09-16, and it
should be the first thing anyone reaches for.** The rewrite lives in the `scrfile` association, so it applies
to the **extension**, not to the program: under `.exe` there is no verb template, `.EXE` *is* in `$env:PATHEXT`,
and the argument is simply passed. Verified the same day, `.\psss.exe /c` logging
`--- pid 48576 args [/c] -> Config (config with no owner window)`:

```powershell
cd .\bin\x64\Release\net8.0-windows\win-x64\publish\
Copy-Item psss.scr psss.exe
.\psss.exe /s          # show mode, full screen; any key, click or 8 px of mouse path ends it
.\psss.exe /c          # config: the Lab's Reel tab in a window
.\psss.exe /p          # ⚠️ NOT preview — a bare /p has no handle, so the contract answers CONFIG
```

⚠️ **`/p` is the one mode this route cannot reach**, and its log line says so rather than failing:
`args [/P] -> Config (preview with an unusable handle '', so config)`. Preview needs a live parent window, so
`probe/preview-host.ps1` or the real Settings dialog remain the only two ways to see it. ⚠️ **The copy is a
plain duplicate of the same 16 MB binary** — it does not go stale on its own, and **`npm run build:screensaver`
now re-copies it, but only if it is already there** (creating one would put a second entry point in the folder
the `.csproj` deliberately deletes the `.exe` from). So the twin is safe across a rebuild *through the wrapper*;
after a bare `build.bat`, delete it or re-copy it rather than trusting an old one.

The probes do the same thing plus capture, measurement and one injected input, from `psss-engine/screensaver/`.
⚠️ **The parameter is `-ScrArgs`, never `-Args`, which binds to nothing and exits 0 with an EMPTY argument —
i.e. silently in config mode.** In **PowerShell**, where there is nothing to work around:

```powershell
.\probe\run.ps1 -ScrArgs '/s' -Settle 14 -Shot show -Then key
.\probe\run.ps1 -ScrArgs '/c' -Settle 14 -Shot config
.\probe\preview-host.ps1            # /p, with a real parent window the script creates itself
```

In **Git Bash** the same three, where the `MSYS_NO_PATHCONV=1` prefix is load-bearing:

```sh
MSYS_NO_PATHCONV=1 powershell -File probe/run.ps1 -ScrArgs '/s' -Settle 14 -Shot show -Then key
MSYS_NO_PATHCONV=1 powershell -File probe/run.ps1 -ScrArgs '/c' -Settle 14 -Shot config
powershell -File probe/preview-host.ps1
```

⚠️ **AND IN POWERSHELL, `.\psss.scr /c` IS NOT A WAY TO PASS AN ARGUMENT — it is a document activation.**
`.SCR` is not in `$env:PATHEXT` (measured 2026-09-16: `.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL`),
so PowerShell hands the file to the shell exactly as a double-click would and the association's `/S` replaces
what you typed. Two measurements, taken on a copy of `cmd.exe` renamed to `.scr` so the argument would be
*visible* if it arrived: `& .\t.scr /c "echo … > out.txt"` produced **no file**, and the same call inside a
pipeline failed outright with `CantActivateDocumentInPipeline`, which names the mechanism. `Start-Process` is
the same story. ⚠️ **The ONLY thing that delivers an argument is `UseShellExecute = $false`**, which is what
the probes set; inline, that is
`$p=[Diagnostics.ProcessStartInfo]::new($scr,'/c'); $p.UseShellExecute=$false; [Diagnostics.Process]::Start($p)`.

⚠️ **Read the FIRST log line of each, not the screen** — `--- pid N args [X] -> Mode (how)` is the only place
that says which mode was actually entered, and every route above can land in config while looking deliberate.
The log is `%LOCALAPPDATA%\psss\screensaver\screensaver.log`. ⚠️ **`/s` launched this way ends on any input**,
including a synthetic one, so a run that dies at once has measured nothing (§5's early-exit note).

⚠️ **And a THIRD rewriter, for anyone typing in Git Bash instead of PowerShell:** MSYS path conversion turns a
lone `/S` into `S:/` and `/c` into `C:/` **before the process is even started** — measured 2026-09-16, both
forms: `args [C:/] -> Config` and `args [S:/] -> Show (show mode)`. `MSYS_NO_PATHCONV=1` disables it.

⚠️ **And the mangled form still reaches the right mode, which is exactly why this rewriter is dangerous to
measure through.** `ParseArguments` strips a leading `/` or `-` **if there is one**, so in `C:/` the letter is
already at position 0 and the drive colon is read as the handle separator: the `c` case runs with
`handleText = "/"`, which fails `TryParseHandle`, and the answer is `config with no owner window`. So a
bash-typed `/c` does exercise the real `c` branch and is **not** the catch-all — but ⚠️ **it destroys the
handle, so it can never test `/c:<hwnd>`, which is the form the Settings dialog actually sends.** Read a
bash-typed pass as covering the bare form only, and never quote the logged argument as the one you typed.

⚠️ **Everything unrecognised is CONFIG — never a crash and never a silent exit.** The Screen Saver
dialog gives no feedback either way, so an unparsed argument would present to the user as *"the
screensaver does nothing"*. `/c` bare, `-s`, `/S`, `/p:1234` and no argument at all all occur in the
wild. All nine forms are enumerated in the run record's case A.

⚠️ **`/c` navigates to `?reel=0&tab=reel`, with no `screensaver=1`** — the config window is an editor,
not a saver, and must keep the ordinary input policy. Those two parameters are the engine's only two
`src/` **FEATURES** in this phase — in **three** files, since `?tab=` needs `panel.ts` as well, and
⚠️ **the cap counts FEATURES, so the defect fixes are not violations of it**: `layout.css` (a Phase 19
fix) and, on 2026-09-16, `main.ts`'s curtain lift plus `index.html`, which is outside `src/` entirely.
**Reconcile a diff here by NAME, never by a file total.**

### How show mode ends

Any of: **a key** (bare Shift/Control/Alt/Meta exempted, so Alt+Tab is not "the user asked to stop"), **a
click**, or **a mouse move past 8 px of cumulative path**. Two layers report it — the host's own WndProc
(which is what catches a key before the WebView child exists) and the page, which posts `psss-exit`
through `window.chrome.webview`.

⚠️ **The first ~700 ms are a grace period, and the first `mousemove` is discarded — these are two
different remedies for two different problems.** Windows delivers a move whenever the cursor merely
*sits* inside a new window; the grace is for the mouse-up and drift of the double-click that launched
the file. Conflating them yields a saver that ignores 700 ms of real input *and still* exits instantly
when the cursor happened to be centred.

⚠️ **THE TWO LAYERS DO NOT BOTH HAVE THE TIME GRACE, and that asymmetry is measured, not deduced.** The 700 ms
grace lives in the host's WndProc, which stops seeing mouse input the moment the WebView child covers the
window — the 2026-09-16 log has the host ignoring fourteen moves at 62–203 ms and then the *page* reporting the
one that ended the session. On the page side `startPresentation()` attaches the listeners and there is **no
time grace at all**, only the first-sample discard and the 8 px path. So between `presenting` and the user's
first real input, nothing is protecting the session. ⚠️ **Five consecutive launches on 2026-09-16 ended within
1.3 s — three of them reporting `a click`, which drift cannot explain and which is therefore recorded as
UNEXPLAINED rather than given a mechanism.** It is also not a permanent property of the build: `run.ps1`
reported `ALIVE after 14s` on 2026-09-15, and the owner's own runs lasted 10 s or more. **Until it is
explained, a show-mode measurement must state how long its session actually survived** — a probe that exits at
1 s and a probe that runs 14 s answer different questions.

---

## 4. Testing it

**There is no checker and that is D8.** The two instruments are:

```sh
# the page contract, automated, runs on every suite run
npx playwright test tests/10-screensaver-mode.spec.ts

# the host, by hand — read probe/RUN-RECORD.md first, then the script's own header
powershell -File probe/args.ps1
powershell -File probe/run.ps1
powershell -File probe/startup-cases.ps1
# ...and the rest; probe/RUN-RECORD.md §3 is the ONE enumeration — count its rows THERE, do not
# carry a total from here (the table GREW on 2026-09-16, when cpu-sample.ps1 joined it), and note
# that one of them (make-preview.mjs) is Node, not PowerShell
```

⚠️ **No AUTOMATED instrument covers the join, but the join HAS been demonstrated — do not read the gap as
wider than it is.** The spec runs in a browser where `window.chrome.webview` is undefined, so it observes
that the exit funnel *ran*, never that a message was delivered. The probe cannot inspect the page's
listeners either — **but it sees them from downstream, and that is the whole point of the log's wording:**
`RUN-RECORD.md` **§5.C** carries `[show] exiting (0) because the page reported a click` and `… a mouse
move` beside the host layer's own `… because a key (vk 65)`, so **a message really did cross and the host
really did act on it.** ⚠️ **What is owed is therefore narrower and should be stated as what it is:** that
demonstration is **hand-run, once, against one binary**, so it does not re-run on a later build.

⚠️ **THE OWNER HAS NOW WATCHED `/s` TWICE, AND EACH WATCH RETURNED A DEFECT NO INSTRUMENT HERE HAD SEEN**
(2026-09-16: the boot curtain, then the stall in §5) — so the standing owed item is no longer "nobody has
watched it", it is that **a watch is the only instrument for this join and it has never yet come back
empty.** Both defects were *visible* and neither was *measurable* from here: the first was 500 ms of the
wrong layout, the second is one dead frame. **Do not read a rebuild as covered because the previous binary
was watched** — the second `/s` run owed on the rebuilt `.scr` is exactly this instrument, and it is the
owner's eyes or nothing.

⚠️ **The probe's figures describe one binary at one date.** A rebuild invalidates all of them.

### The boot curtain, because it spans three files and none of them is where you would look

`?screensaver=1` must be **black from the first paint**, not from the reel autostart: `startPresentation()`
runs at the END of boot, so without a cover the ordinary editor layout — two panes, the right one
`#0a0a0a` — is on screen for about half a second. **The owner saw exactly that on the first real `/s` run
(2026-09-16), after six green spec cases and thirteen hand-run probes.**

| file | its half |
|---|---|
| `../index.html` (head) | sets `psss-screensaver-boot` on `<html>` and carries the two CSS rules **and the write-up** |
| `../src/main.ts` (autostart block) | removes the class once the outcome is settled |
| `../src/ui/layout.css` | a pointer comment only — ⚠️ **a rule added HERE would arrive after the first paint by construction**, since this stylesheet is injected by the boot it would have to cover |

⚠️ **The class has exactly two sites and `grep psss-screensaver-boot` must find two** (plus the payload
copy and this table). ⚠️ **The lift is unconditional and must stay that way:** `?screensaver=1&reel=0`
loads this mode WITHOUT playback on purpose, so it has to end up showing the editor — a curtain keyed on
the query string and never lifted turns that debug route into a permanently black page.

---

## 5. Known limits and deviations, so they are not re-discovered as bugs

- **The page's fatal message says "all four deployment files must sit side by side."** Inherited from
  the web deployment; the screensaver has **two** on disk, because `index.html` and `psss-engine.js` are
  embedded. Correcting the wording is a **cosmetic** edit, not a defect fix, and the phase's cap covers
  exactly two `src/` FEATURES — so it is left as a recorded inaccuracy in a fatal path. ⚠️ **That is the
  line the cap actually draws:** the boot curtain (2026-09-16) was a defect the owner saw on screen and
  was fixed at once; this is a sentence nobody has been misled by yet.
- ⚠️ **OPEN, NOT EXPLAINED, and PARKED BY OWNER DECISION (2026-09-17): one dead frame, a few seconds into
  show mode, sometimes.** The owner reported it as *"sometimes it does a pause after a few seconds, where the
  animation pauses for a few seconds before it continues, this however does not happen each time we start it
  up"*, and the whole of what is known is in `probe/RUN-RECORD.md` §5.M — read it there rather than
  re-deriving it. The four things worth knowing before touching anything: it is **one frame, not a slow
  period**, so no engine parameter is implicated; ⚠️ **there are TWO magnitude classes, and the 1.3–1.8 s
  this bullet used to quote is the SHALLOW one — the deep class is ~3 s** (the owner's installed host, not
  the probe, is what showed it); one `msedgewebview2` PID burns **no measurable CPU** across it, so
  `requestAnimationFrame` was never called and the decision was taken **above the page** — ⚠️ **but the
  sampler's idle-run reduction covers ONE PID and the renderer and the GPU process share that name, so
  GPU-process work is NOT excluded**; and `dt` is clamped at 100 ms in `main.ts`, which is why it reads as a
  pause that resumes rather than as a jump. ⚠️ **It does NOT reproduce in a browser** at the same bundle
  (owner-measured), which is what makes the host route worth suspecting at all. ⚠️ **One candidate has been
  tried and falsified** (`--disable-features=CalculateNativeWinOcclusion`; `WebHost.cs`'s header carries the
  negative result) — so the next person's first job is not to re-try it.
- **`[payload] 404 favicon.ico` on every run.** The page asks for a favicon the embedded payload does
  not carry. Benign, and expected in every log.
- **`/p` renders a static PNG, not a live frame** (D5) — a second WebView2 in the Settings dialog's
  thumbnail is not worth its startup cost.
- **No preset name is shown in show mode** (D6).
- **Show mode covers the primary monitor only**, with the others blacked out (D2). Multi-monitor
  behaviour beyond that, and per-monitor DPI, are what the run record's §6 says this machine cannot
  test.
- **The `FindWindowW` anomaly in `probe/find-window.ps1` is unexplained**, and is recorded as
  unexplained rather than given a mechanism it has not been shown to have.
