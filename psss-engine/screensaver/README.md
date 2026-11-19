# psss screensaver host — build, install, and the argument contract

A Windows `.scr` screensaver that plays the psss engine's Reel full screen in a WebView2 window. It is one
self-contained executable with the engine embedded; the preset and reel files sit beside it.

Every rule whose violation is *silent* lives as a ⚠️ paragraph in the source file that owns it —
`Psss.Screensaver.csproj`, `Program.cs`, `PayloadFiles.cs`, `ScreensaverWindow.cs`, `PreviewHost.cs`,
`WebHost.cs`. **Read the header of the file you are about to edit.** This file is what a person needs
before reading any of them.

| See | For |
|---|---|
| `probe/RUN-RECORD.md` | the hand-run probe of a built host: its cases, its figures, and what each instrument cannot see |
| `../tests/10-screensaver-mode.spec.ts` | the automated half: the `?screensaver=1` page contract, with seeds |
| `../README.md` | the code map, including every file in this folder |

---

## 1. Build

**Prerequisites:** Visual Studio (for the native linker the single-file publish invokes), the **.NET 8 SDK**,
and Node for the engine build. **WebView2 needs no SDK** — the runtime ships with Windows 11 and the NuGet
package carries the interop.

```sh
cd psss-engine
npm run build:all              # everything, in order; this host is step 2 of four
```

`build:all` is `npm run build` (the engine → `dist/`), `npm run build:screensaver` (this host), `npm run
docs:pdf` and `npm run package:dist`; the repository's root `README.md` §4 lists the four. So a failure after
step 2 is not a failure of this host. The first two also run alone:

```sh
npm run build                  # 1. the engine bundle -> dist/   (no .NET needed)
npm run build:screensaver      # 2. the host, the staging and the identity checks
screensaver/build.bat          # ...step 2's publish alone, WITHOUT the staging or the checks
```

⚠️ **A bare `build.bat` leaves the job half done, and the half it skips is the silent one.** The `.csproj`
refreshes only the **embedded** half of the payload (`Payload/`, from `../dist`) and fails the build if it is
missing. The preset and reel files are kept out of the binary on purpose, and nothing in the .NET build
copies them: without the wrapper, a publish folder keeps whatever library was last put there, and the
screensaver plays it without complaint.

**What `npm run build:screensaver` adds, and why each part is a check rather than a copy:**

1. **Stages the data files** from `dist/` beside the published `.scr`.
2. **Asserts the payload is ONE build**, in two layers that fail independently — the embedded files compared
   to `dist/` by SHA-256 (the *inputs*), and a slice of each looked for **inside the published binary** (the
   *artefact*). ⚠️ **The second is not a slower version of the first**: a compile or publish that reuses an
   earlier assembly leaves every input correct and the `.scr` carrying the previous page. The slice check
   works only while the single-file bundle is uncompressed, so if `EnableCompressionInSingleFile` is ever
   turned on, **read a red there as a claim about the check.**
3. **Asserts the data files are byte-identical** in `dist/`, the publish folder and `dist/screensaver/`, **by
   hash, never by size** — a preset library changes content far more often than length.
4. **Assembles `dist/screensaver/`** — `psss.scr` + the two data files, the installable set. ⚠️ **`vite build`
   empties `dist/`, so a later web-only build deletes that folder** — which is correct: a `.scr` outliving the
   engine it embeds is exactly the stale artefact all of this guards against.
5. **Refreshes an existing `psss.exe` test copy** (§3), and never creates one.
6. **Warns** if the `%LOCALAPPDATA%\psss\screensaver\data` fallback holds older data files than `dist/`.

⚠️ **It spells none of the payload filenames.** `PayloadFiles.cs` explains that they live in several places
with no compiler between the copies, and another copy would make a rename harder to audit. The embedded set
is read from the `.csproj`'s `EmbeddedResource` lines and the disk set from `dist/index.html`'s own
`<script src>` tags. Never edit `Payload/` by hand — it is regenerated on every build.

⚠️ **Use `build.bat`, not a bare `dotnet publish`.** The script puts the Visual Studio Installer directory on
`PATH` and calls `vcvars64.bat`, because the link step invokes `vswhere.exe` **bare**; without it, the failure
surfaces as **MSB3073 with vswhere's own error folded into the linker command line**, which reads as a corrupt
toolchain rather than a missing directory. Adjust the two paths in the script if Visual Studio moves.

### How it is published

- **`net8.0-windows`**, with **`PublishSingleFile` + `SelfContained` + `TrimMode partial`** — one file that
  needs no installed runtime.
- ⚠️ **Not `PublishAot`.** An AOT-published binary reaches `CoreWebView2Environment.CreateAsync` and throws
  `NotSupportedException: COM Interop requires ComWrapper instance registered for marshalling` — WebView2
  reaches the browser through built-in COM interop, which NativeAOT does not provide.
- ⚠️ **`BuiltInComInteropSupport` is load-bearing, not defensive.** Without it, the trimmed single-file
  build throws `TypeLoadException`, because trimming removes COM support the compiler cannot see being used.
- ⚠️ **`TrimMode partial` is not a tuning knob.** It trims only assemblies marked trimmable, which keeps
  `System.Drawing.Common` (the preview's PNG decode) and the WebView2 interop assembly whole. A full trim is
  untested, and its failure mode is a runtime `TypeLoadException` **in a process with no console**.

### Three warning families are expected

A green build is **not** a silent build, and treating these as noise is how a fourth one gets missed:

- **`MSB3277` — `WindowsBase` 4.0.0.0 vs 5.0.0.0.** The WebView2 package ships a WPF assembly alongside the
  Core one; this host uses **only Core**. ⚠️ **Re-read this one if an edit adds a WPF or WinForms
  reference** — then the conflict stops being cosmetic.
- **`IL2026` — "Built-in COM support is not trim compatible."** The trimmer cannot prove the COM path;
  `BuiltInComInteropSupport` is what makes it work anyway.
- **`IL2104` — `Microsoft.Web.WebView2.Wpf` / `.Core` "produced trim warnings."** The library-level roll-up
  of the same thing.

**Nothing else should appear.** A new `IL` warning naming *this host's own* assembly is a real finding.

### The version it carries

**The `.scr` carries `psss-engine/package.json`'s version, and nothing in this folder writes one.**
`scripts/build-screensaver.mjs` passes it to `dotnet publish` as `-p:Version=<x.y.z>` and then **reads it
back** from the published binary, failing the build if the two disagree. It appears in the file's Properties
→ Details, in the Settings window's title, and at the start of the host's log line.

⚠️ **Never write a number into the `.csproj`.** Its default is `0.0.0-local` on purpose, so a bare `build.bat`
produces a binary that says plainly it is not a release.

### The output

**`dist/screensaver/` is the installable set — three files, and it is what to copy anywhere:**

```
psss.scr             the host, with index.html and psss-engine.js embedded
psss_presets.json    the preset library — required
psss_reels.json      the reels — optional
```

The publish folder (`bin/x64/Release/net8.0-windows/win-x64/publish/`) holds the same three plus any `psss.exe`
test copy, which is why the assembled folder is the deliverable. The rename to `.scr` happens in the build,
and the `.exe` is deleted, so the publish folder cannot ship two entry points that drift apart.

⚠️ **A size match does not prove the binary carries your edit.** A rebuild from identical inputs reproduces
the size exactly, but so can a small source change. **What settles it is a string scan, and it must be
UTF-16:** C# string literals are stored two bytes per character, so a byte-oriented `grep` finds nothing in a
binary that contains the string:

```sh
# 1 = present, 0 = absent. Run it on the publish output, not on the intermediate DLL.
perl -e 'local $/; my $d=<STDIN>; my $p=join("\0", split //, $ARGV[0]);
         my $c=0; $c++ while $d =~ /\Q$p\E/g; print "$c\n"' \
     disable-background-timer-throttling < publish/psss.scr
```

---

## 2. Install

`psss.scr` is one file, but **the two data files are not embedded and must sit beside it**. Copy all three
together — `dist/screensaver/` is exactly that set.

- **To install it:** right-click `psss.scr` → **Install**, or copy all three files into `C:\Windows\System32\`
  and pick *psss* in **Settings → Personalisation → Lock screen → Screen saver**. Windows lists only the `.scr`
  files in `System32`; the right-click route sets the registry value directly and works from anywhere the
  file stays put.
- **To try it:** double-click `psss.scr` — that starts show mode (§3 explains why every launch does).
- ⚠️ **Nothing in the build writes into an install.** A rebuild leaves an installed copy on the previous
  library indefinitely: re-copy all three files after every rebuild.
- **If the data files were left behind:** the host still starts, and the page reports the problem rather than
  showing a black screen with no explanation.

⚠️ **The two data files are not symmetric, and must not be made so:**

| File | Missing ⇒ |
|---|---|
| `psss_presets.json` | **fatal** — the engine has no library at all |
| `psss_reels.json` | **a warning**; the reels built into the engine play instead |

**Where the host looks for them** (`PayloadFiles.FindOnDisk`): the folder holding `psss.scr`, then
`%LOCALAPPDATA%\psss\screensaver\data`. ⚠️ **The second location will rescue a broken install and make it
look fine** — when testing the missing-file behaviour, that directory must not exist.

### Where it keeps things

```
%LOCALAPPDATA%\psss\screensaver\screensaver.log   the log — every mode, every exit, every page console line
%LOCALAPPDATA%\psss\screensaver\WebView2\         the WebView2 user-data folder, and localStorage with it
%LOCALAPPDATA%\psss\screensaver\data\             the optional data-file fallback (above)
```

The reel settings are one key, `psss.reels.v1`, in
`%LOCALAPPDATA%\psss\screensaver\WebView2\EBWebView\Default\Local Storage\leveldb` — note the `EBWebView`
level, which the shorter form of the path omits.

⚠️ **Show, preview and config share ONE user-data folder, and that sharing is the feature:** it is why a main
reel chosen in the config window is what show mode plays next. It is also why a reel picked while testing
stays picked — `probe/restore-profile.ps1` is the way back, because the *Main reel* checkbox cannot be
un-ticked.

⚠️ **That folder is not your everyday browser's.** A main reel ticked in the Lab in Chrome or Edge, or on the
dev server, does **not** reach the screensaver, and the screensaver's choice is invisible there: two separate
stores of the same key, with no sync. The Settings window (config mode) is the only place a screensaver main
reel can be set — which is why config mode exists.

⚠️ **The *Main reel* tick saves itself — there is no Save to press for it.** It is written to storage the
moment it changes, so closing the config window right after ticking loses nothing. `Save` covers a reel's
**contents** (its preset list, play time, transition), and those *are* lost if the window closes without it.

---

## 3. The argument contract

Parsed case-insensitively; `/` and `-` are both accepted, and a handle may follow as `:1234`, `=1234` or a
separate argument. Handles are decimal; `0x`-prefixed hex is accepted too.

| Argument | Mode | What it does |
|---|---|---|
| `/s` | **show** | full screen on the **primary monitor**, the other monitors blacked out; plays the main reel |
| `/p <hwnd>` | **preview** | a static `preview.png` in the Settings dialog's thumbnail |
| `/c`, `/c:<hwnd>` | **config** | the Lab's **Reel** tab in an ordinary window, opened at `?reel=0&tab=reel` |
| *(none)*, `/p` with an unusable handle, anything unrecognised | **config** | never a crash and never a silent exit |

**Everything unrecognised is config** because the Screen Saver dialog gives no feedback either way: an
unparsed argument would otherwise look like *"the screensaver does nothing"*. The config window has no
`screensaver=1`, because it is an editor and keeps the ordinary input policy.

⚠️ **You cannot reach `/p` or `/c` by typing them after `psss.scr`.** The `.scr` file association's default
verb is `"%1" /S`, so every launch that goes through the shell — a double-click, Explorer, `start`,
`Start-Process`, and `cmd` or PowerShell resolving a `.scr` — **discards what you typed and passes `/S`**.
In PowerShell, `.\psss.scr /c` is a document activation for the same reason: `.SCR` is not in
`$env:PATHEXT`.

| To reach | The routes that deliver the argument |
|---|---|
| **config** | right-click `psss.scr` → **Configure** (that verb passes **no** argument, which is where "no argument ⇒ config" earns its keep), **Settings…** in the Screen Saver dialog (`/c:<hwnd>`), or `probe/run.ps1 -ScrArgs '/c'` |
| **preview** | the Screen Saver dialog's own thumbnail, or `probe/preview-host.ps1` — preview needs a **live parent window** |
| **show** | anything at all, including the double-click |

**The simplest way to pass an argument is to copy the file to `psss.exe` and run that.** The rewrite belongs
to the `.scr` association, so under `.exe` the argument is simply passed:

```powershell
cd .\bin\x64\Release\net8.0-windows\win-x64\publish\
Copy-Item psss.scr psss.exe
.\psss.exe /s          # show mode, full screen; any key, click or 8 px of mouse path ends it
.\psss.exe /c          # config: the Lab's Reel tab in a window
.\psss.exe /p          # NOT preview — a bare /p has no handle, so the contract answers config
```

The copy is a plain duplicate of the same binary. `npm run build:screensaver` re-copies it on every build,
but only if it is already there; after a bare `build.bat`, delete it or re-copy it.

The probes do the same, plus capture, measurement and one injected input. ⚠️ **The parameter is `-ScrArgs`,
never `-Args`**, which binds to nothing and starts config mode with no argument:

```powershell
.\probe\run.ps1 -ScrArgs '/s' -Settle 14 -Shot show -Then key
.\probe\run.ps1 -ScrArgs '/c' -Settle 14 -Shot config
.\probe\preview-host.ps1            # preview, with a real parent window the script creates
```

⚠️ **In Git Bash, prefix `MSYS_NO_PATHCONV=1`.** Its path conversion turns a lone `/S` into `S:/` and `/c` into
`C:/` before the process starts. The mangled `C:/` still reaches config, but with its handle destroyed, so it
can never test `/c:<hwnd>`, the form the Settings dialog sends.

⚠️ **Read the first log line of each launch, not the screen.** `--- pid N args [X] -> Mode (how)` is the only
place that says which mode was actually entered, and every route above can land in config while looking
deliberate.

### How show mode ends

Any of: **a key** (bare Shift, Control, Alt and Meta exempted, so Alt+Tab is not "stop"), **a click**, or **a
mouse move past 8 px of cumulative path**. Two layers report it — the host's own window procedure, which
catches a key before the WebView exists, and the page, which posts `psss-exit` through
`window.chrome.webview`.

⚠️ **The host ignores input for its first 700 ms, and the page discards its first `mousemove` — two remedies
for two different problems.** The grace period absorbs the mouse-up and drift of the double-click that
launched the file; the discarded move is the one Windows delivers whenever the cursor merely *sits* inside a
new window. ⚠️ **Only the host has the time grace.** Once the WebView covers the window the host no longer sees
mouse input, and the page has only the first-move discard and the 8 px path — so a show-mode session can end
within a second or two of starting. A show-mode measurement should state how long its session survived.

---

## 4. Testing it

There is no checker for the host. The two instruments are:

```sh
# the page contract, automated
npx playwright test tests/10-screensaver-mode.spec.ts

# the host, by hand — read probe/RUN-RECORD.md first, then each script's own header
powershell -File probe/args.ps1
powershell -File probe/run.ps1
powershell -File probe/startup-cases.ps1
# ...and the rest: probe/RUN-RECORD.md, section 3, lists every probe script
```

⚠️ **No automated instrument covers the join between the page and the host.** The spec runs in a browser where
`window.chrome.webview` is undefined, so it sees that the exit path *ran*, never that a message was delivered.
The probe's run record shows messages crossing — `[show] exiting (0) because the page reported a click` beside
the host's own `… because a key` — but that is a hand-run result on one binary and does not re-run on a later
build. ⚠️ **Watching show mode on screen is the only instrument for this join**, and the probe's figures
describe the binary they were taken on: a rebuild needs a fresh watch.

### The boot curtain, because it spans three files

`?screensaver=1` must be **black from the first paint**, not from the reel's start: `startPresentation()` runs
at the end of boot, so without a cover the ordinary editor layout would be on screen for about half a second.

| File | Its half |
|---|---|
| `../index.html` (head) | sets `psss-screensaver-boot` on `<html>`, and carries the two CSS rules **and the write-up** |
| `../src/main.ts` (autostart block) | removes the class once the outcome is settled |
| `../src/ui/layout.css` | a pointer comment only — ⚠️ **a rule added here would arrive after the first paint**, since this stylesheet is injected by the boot it would have to cover |

⚠️ **The lift is unconditional and must stay that way:** `?screensaver=1&reel=0` loads this mode without
playback on purpose, so it has to end up showing the editor — a curtain that is never lifted turns that debug
route into a permanently black page.

---

## 5. Known limits, so they are not re-discovered as bugs

- **An occasional pause a few seconds into show mode.** Sometimes the animation stops for one long frame — about
  1.5 s or about 3 s — and then continues; it does not happen on every start, and it does not reproduce in a
  browser running the same bundle. It is one frame, not a slow period. The WebView2 process sampled burns no measurable CPU across it, so
  the page is not being asked to draw — though GPU-process work is not ruled out, because the sampled process
  and the GPU process share a name. The frame-time clamp in `main.ts` is why it reads
  as a pause rather than a jump. **Open and not explained.** One candidate has been tried and ruled out
  (`--disable-features=CalculateNativeWinOcclusion`; `WebHost.cs`'s header records it). The run record's case M holds
  everything measured.
- **The page's fatal message says "all four deployment files must sit side by side."** It is the web
  deployment's wording; the screensaver has **two** files on disk, because `index.html` and `psss-engine.js` are
  embedded.
- **`[payload] 404 favicon.ico` on every run.** The page asks for a favicon the embedded payload does not carry.
  Benign, and expected in every log.
- **Preview renders a static PNG, not a live frame** — a second WebView2 in the Settings dialog's small
  thumbnail is not worth its startup cost.
- **No preset name is shown in show mode.**
- **Show mode covers the primary monitor only**, with the others blacked out. Behaviour beyond that, and
  per-monitor DPI, are untested (the run record's *Not measurable on this machine*).
