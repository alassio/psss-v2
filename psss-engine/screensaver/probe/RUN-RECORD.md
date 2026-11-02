# Phase 20.10 — host probe run record

**Machine:** Windows 11 Pro 10.0.26200, single display, 2880×1800 physical at 200 % scaling.
**Runs recorded here:** 2026-09-14 (first sitting, marked ↩ below) and **2026-09-15 (this sitting)**.
**Subject:** `bin/x64/Release/net8.0-windows/win-x64/publish/psss.scr`, 16 155 178 bytes, built
2026-09-15 01:01 by `build.bat` from the ten host sources listed in §2.

⚠️ **The binary was REBUILT on 2026-09-16 (16 159 274 bytes) to carry the boot-curtain fix, and NOT ONE
case below has been re-run against it.** The host sources did not change — the fix is entirely in the
embedded payload — so every §5 figure is *expected* to hold, but **"expected to hold" is not a run.**
That is the same rule as §8's "a rebuild invalidates all of them", stated here because this header is
where a reader decides whether the numbers below describe the file on disk. **The rebuild's own evidence
is `tests/10-screensaver-mode.spec.ts` case 7 and the curtain string appearing 5× inside `psss.scr`.**

---

## 1. What this record is, and what it is not

Phase 20's D8 decision is that **the screensaver host gets no checker**. `verify` cannot see it: it is
C# outside `src/`, driven by Win32 messages and observed through a screen and a log file. So the
instrument for the whole phase is a hand-run probe — and the plan's wording is
"a hand-run host probe **with a written run record**", because *a probe that is deleted afterwards is
a record of a run and not an instrument*. This file is that record.

**What it claims:** that each listed case was run against the binary in §2, and what the numbers were.

**What it does not claim:**

- ⚠️ **It is not a suite and it does not re-run.** Nothing here fires again on a later build. Every
  figure below is a claim about **one binary at one date**; a rebuild invalidates all of them and the
  scripts must be re-run by hand. That is the accepted cost of D8, not an oversight to be fixed by
  quoting these numbers in a future sitting.
- ⚠️ **It does not discharge the Playwright side, which is 20.10's OTHER instrument and now exists**
  — `tests/10-screensaver-mode.spec.ts`, seven cases, twelve seeds, all green 2026-09-16 (§8). The two do
  not overlap and neither substitutes for the other: this record measures the **host** and cannot
  observe the page's listeners; the spec measures the **page** and runs in a browser where
  `window.chrome.webview` does not exist. ⚠️ **No AUTOMATED instrument executes both together** —
  whether the host acts on a `psss-exit` message that the page really sent is covered only by §5.C,
  by hand. ⚠️ **"Nothing in this project executes both together" is what this bullet said until
  2026-09-16, and it contradicted §5.C two hundred lines below it**: the probe IS an execution of
  both, which is exactly why §5.C can quote *"the page reported a click"*. The real limit is that it
  is hand-run and does not re-run on a later build. **A gap worth stating is worth bounding, or the
  measurement that does exist gets re-done or disbelieved.**
- ⚠️ **A case that passes here passes on ONE machine, and three of the cases are about machine
  configuration** (DPI, monitor count, the screen's own pixels). §6 names what this machine cannot
  test at all.

---

## 2. The subject, exactly

| part | what it is |
|---|---|
| `psss.scr` | 16 155 178 bytes, self-contained single-file .NET 8 win-x64, from `ConfigWindow.cs`, `Interop.cs`, `PayloadFiles.cs`, `PreviewHost.cs`, `Program.cs`, `ScreensaverWindow.cs`, `WebHost.cs`, `Psss.Screensaver.csproj`, `app.manifest`, `build.bat` |
| embedded (D4) | `Payload/index.html` 18 498 B + `Payload/psss-engine.js` 799 141 B — byte-identical to `psss-engine/dist/`'s |
| from disk (D4) | `psss_presets.json` 2 025 205 B, `psss_reels.json` 1 178 B, beside the `.scr` |

The page inside the host reports **`[page] log: Loaded 320 presets`** on every run, which is the same
count the browser build reports — so the preset leg of this task reached the deployed payload and the
seven settles plus `Lost In Another Sky II` are in the binary being measured.

⚠️ **EVERY FIGURE IN THIS SECTION IS THE SUBJECT AS IT STOOD IN SEPTEMBER 2026 AND IS NOT MAINTAINED —
`320` and `2 025 205 B` are both stale as of 2026-09-17** (the library is 313 presets / 1 995 801 B) **and
that staleness is itself the record of a defect that has since been fixed.** "On every run" was true *and*
uninformative: the `.csproj` refreshed only the EMBEDDED half of the payload, so the two disk-side data
files kept whatever a human last copied beside the `.scr` — a run could therefore report the same count
after a rebuild that changed the library. `npm run build:all` now stages them (root `README.md` §5,
`screensaver/README.md` §1), so **a count read here says what the payload was on the day, never what a
rebuild will report.** Re-measure before comparing; the §5 observables below do not depend on either number.

`psss_reels.json` carries three reels — `Grand Tour` (12 presets, 20 s, fade), `Fire & Plasma`
(8, 18 s, fade), `Geometry` (10, 14 s, black) — and `"mainReelName": "Grand Tour"`. Those
`playSeconds` values are the observable §5.K depends on.

⚠️ **ANNOTATION 2026-09-19 — the paragraph above is the RECORD and stays as measured.** `Grand Tour` has since
become the whole library: **247 presets, `random`**, still 20 s and still `fade`. A re-run therefore reads 247 where
this record says 12, and one pass is ~90 min rather than ~4. **§5.K's observable did not move** — it depends on
`playSeconds`, not on the count — so nothing below is invalidated; a count read here still says only what the
payload was on the day. ⚠️ **The line numbers this record cites have drifted with it**: `DEFAULT_MAIN_REEL_NAME` is
every `reel-store.ts` line cited in this record is **+48**, because 247 names were spliced in above all of them —
`DEFAULT_MAIN_REEL_NAME` is `:141` not `:93` (§5.M), and `:176`/`:315` are now `:224`/`:363` (§5.M's restored-state
note). **Re-`grep` the identifier; do not trust the offset for the next edit.**

---

## 3. The instruments

Each script's own header carries its derivations, its failure modes and the ⚠️ rules it learned;
this table is a map, not a summary.

| script | case | what it CANNOT see |
|---|---|---|
| `args.ps1` | the nine argument forms | anything on screen — it reads the host's own decision line |
| `run.ps1` | launch, settle, capture, then one exit route | input inside the grace period (§5.D) |
| `capture.ps1` | pixel statistics of the primary monitor | which preset is on screen (see §5.B's ⚠️) |
| `input.ps1` | injecting key / click / move / nudge | whether the input reached the host — the log says that |
| `grace.ps1` | input INSIDE the 700 ms grace, with a late control | nothing, if its window finder fails (§7.1) |
| `find-window.ps1` | window presence asserted two ways | it is a diagnostic, and makes no claim about the host |
| `startup-cases.ps1` | the `/s` mutex, and each data file missing | the screen — all three cases are absences |
| `show-effects.ps1` | cursor hidden/restored; a bright frame at startup | a flash shorter than ~78 ms (§5.I) |
| `preview-host.ps1` | `/p` into a parent, at a chosen DPI awareness | whether the real Settings parent behaves like either arm |
| `preview-orphan.ps1` | `/p` outliving a killed parent | — |
| `main-reel-handoff.ps1` | `/c` writes a main reel, `/s` obeys it | which reel `/s` played, directly — only the cadence (§5.K) |
| `restore-profile.ps1` | undoing the probe's own side effect | nothing; it measures nothing by design |
| `make-preview.mjs` | rendering `preview.png` candidates | — |
| `cpu-sample.ps1` | per-process CPU across a launch, restamped against the log — §5.M's stall | anything inside the page: it names when the renderer stopped working, never what it was doing |

⚠️ **Every row above is HAND-RUN and none of them re-runs on a later build.** Count the rows here rather
than carrying a total, and note that they are **not all PowerShell** — `make-preview.mjs` is Node, so "the
PowerShell probes" undercounts the table. The phase's one automated instrument is not in this table because
it does not measure the host at all:

| not a probe | case | what it CANNOT see |
|---|---|---|
| `tests/10-screensaver-mode.spec.ts` | the `?screensaver=1` **page** contract, seven cases, twelve seeds | the host — it runs in headless Chromium where `window.chrome.webview` is undefined, so it observes the exit funnel's `console.debug` and never a delivered message |

---

## 4. Preconditions, asserted rather than assumed

- **`%LOCALAPPDATA%\psss\screensaver\data` must not exist.** `PayloadFiles.FindOnDisk` searches the
  exe directory and *then* that path, so a copy of either data file there would rescue §5.F and §5.G
  and both would pass while claiming to test a missing file. `startup-cases.ps1` **asserts this and
  exits 2** rather than trusting a note. Verified absent again 2026-09-15: that root holds only
  `WebView2\`, `screensaver.log` and `screensaver.log.pre-bom`.
- **Every launch is `UseShellExecute = false`.** Through `ShellExecute` the `.scr` association
  rewrites the arguments to `/S`, which would make §5.A report `Show` nine times — a table of
  identical wrong answers that looks like a parser with one branch.
- **The log line count is marked before each case** and only the new lines are read. The log is
  append-only with a size cap that *deletes* rather than truncates, so a stale line from an earlier
  sitting would otherwise read as a pass.

---

## 5. Cases

### A. The argument contract — nine forms (20.3)

Re-run 2026-09-15, verbatim:

```
[/s]       exitedIn3s=False code=n/a  pid 38564 args [/s] -> Show (show mode)
[-s]       exitedIn3s=False code=n/a  pid 39780 args [-s] -> Show (show mode)
[/S]       exitedIn3s=False code=n/a  pid 15528 args [/S] -> Show (show mode)
[/c]       exitedIn3s=False code=n/a  pid 24128 args [/c] -> Config (config with no owner window)
[-c]       exitedIn3s=False code=n/a  pid 41864 args [-c] -> Config (config with no owner window)
[]         exitedIn3s=False code=n/a  pid 38736 args [] -> Config (no argument, so config by convention)
[/p 1234]  exitedIn3s=True  code=0    pid 15492 args [/p 1234] -> Preview (preview into HWND 1234)
[/p:1234]  exitedIn3s=True  code=0    pid 43308 args [/p:1234] -> Preview (preview into HWND 1234)
[--wat]    exitedIn3s=False code=n/a  pid 43504 args [--wat] -> Config (unrecognised argument '--wat', so config)
```

Nine forms, three modes, and each host line states **how** it decided — which is the part a screen
capture could not distinguish (`/s` chosen vs `/s` defaulted to). The two `/p` forms exit 0 within
3 s because HWND 1234 is not a live window and `PreviewHost`'s `IsWindow` watchdog gives up: that is
the contract, not a failure, and §5.J measures the watchdog properly.

### B. Show mode actually presents (20.4)

⚠️ **A clean log is not evidence the frame is not black** — the engine's own rule, and the reason
19.12a measured pixels rather than reporting "it looked fine". A GL failure inside the host presents
as a black screen with a clean log.

| run | figure, full 2880×1800 basis |
|---|---|
| ↩ 2026-09-14 | `lit 32.22 % (threshold 8), max channel 114, mean 16.42` |
| 2026-09-15 | `lit 47.09 % (threshold 8), max channel 197, mean 43.58 over 23040 sampled cells` |

⚠️ **THE COVERAGE FIGURE IS AN INSTANCE MEASUREMENT, NOT A THRESHOLD, AND THE TWO RUNS ABOVE ARE THE
PROOF.** Same binary, same script, same settle — 32 % and 47 %, because the reel had advanced to a
different preset when the shot was taken. Anyone who writes `lit > 30 %` into a future check has
built a flaky test out of a number this record happens to contain. What is load-bearing is only
**"substantially lit, with a max channel far above the threshold"**; the exact percentage is a
property of the preset, not of the host.

⚠️ And the basis is stated because it was wrong once: `powershell.exe` runs DPI-virtualized, so
`Screen.PrimaryScreen.Bounds` reads 1440×900 while `CopyFromScreen` BitBlts in **physical** pixels —
a 1440×900 request captured the top-left quarter and every statistic had a quarter-screen basis while
claiming a full-screen one (§7.2).

### C. Exit routes, and the two layers

All four distinct exit reasons appear in one log file:

```
2 [show] exiting (0) because a key (vk 65)
3 [show] exiting (0) because the page reported a click
1 [show] exiting (0) because the page reported a mouse move
1 [show] exiting (1) because a fatal page error
```

⚠️ **TWO EXIT LAYERS EXIST AND BOTH WERE DEMONSTRATED.** A key reaches the **host** WndProc, which
owns input before the WebView child window exists at all; a click and a mouse move are reported by
the **page**, through `window.chrome.webview`, because once the child covers the screen the host sees
no mouse input. A case that only ever tested one route would leave a whole layer unmeasured, and the
two layers fail independently.

`move` / `nudge` below the 8 px threshold correctly did **not** exit (↩ 2026-09-14): the one
`mouse move` exit above is the deliberate 19 px path. A screensaver that dies on cursor jitter is the
defect `MoveThresholdPx` exists to prevent, and it is only observable as an *absence*.

### D. The 700 ms grace period (20.6)

The one case `run.ps1` cannot express, and the one that had to have its instrument rebuilt.

⚠️ **THE GRACE CLOCK STARTS AT THE WINDOW, NOT AT THE PROCESS, AND THAT MISMATCH COST FOUR
MIS-ATTRIBUTED CASES.** `ScreensaverWindow.Start` sets `_startTick` immediately after
`CreateWindowExW`; `run.ps1 -Settle` measures from `Process.Start`. Between them sits the entire
startup of a self-contained single-file .NET app — extraction, runtime init, JIT — which is not a
fixed cost and is **far longer than the grace period itself**. Four cases run at 0.2, 0.3, 0.35 and
0.5 s of *process* time all left the host running and **none** produced an `ignoring` line: read as
grace passes they would have been four confirmations of a path that had not executed once. The input
went to the shell that launched the probe.

⚠️ **"Still running" is the same observation for "the grace ignored it" and for "nothing received
it"** — which is why `grace.ps1` waits for the *window* and why the late control injection is not
optional. Result, 2026-09-15:

```
WINDOW    appeared at ~0.49s from launch
EARLY     clicked 62 ms after the window
          still running after the early click
LATE      clicked ~3 s after the window
          EXITED with code 0 after the late click
```

and the host's own line, which is the primary instrument because it prints the **measured** elapsed:

```
2026-09-15 01:15:48.678  [show] ignoring a mouse button — 62 ms into the 700 ms grace period
```

`early ignored + late exits` is the only one of the three outcomes that is a pass. It is what
happened.

### E. `/s` twice — the named mutex

Second instance, with the first **still playing**:

```
2026-09-15 01:18:29.772  [show] another show instance already holds the mutex — exiting 0
```

⚠️ The first host **must still be alive** for this to mean anything: a second instance exiting 0 after
the first had already gone would be the mutex doing nothing at all, reported as a pass.
`startup-cases.ps1` asserts the first is alive and calls the case VOID otherwise.

⚠️ Recorded because it is not fine in general: **only the `--- pid N` header line names a pid**, so
two concurrent hosts interleave in one log with nothing to attribute the rest by. It is tolerable here
only because the second host writes two lines and exits.

### F. `psss_reels.json` missing ⇒ WARN, and it keeps playing

Both channels say so, and the host stayed up for the full 12 s watch:

```
[payload] warning: psss_reels.json not found in C:\...\Temp\psss-probe-noreels then
          %LOCALAPPDATA%\psss\screensaver\data — the built-in reels will play
[page] warning: [reels] no psss_reels.json beside index.html — playing the built-in reels
```

### G. `psss_presets.json` missing ⇒ FATAL, exit 1

```
[payload] FATAL: psss_presets.json not found in C:\...\Temp\psss-probe-nopresets then
          %LOCALAPPDATA%\psss\screensaver\data — the page will report psss-fatal
[show] FATAL from the page: psss_presets.json did not load — all four deployment files must sit side by side
[show] exiting (1) because a fatal page error
[loop] ended, exit 1
```

⚠️ **THE ASYMMETRY BETWEEN F AND G IS THE POINT AND MUST NEVER BE "TIDIED".** A missing reel file is
recoverable — `BUILT_IN_REELS` play — while a missing preset library leaves nothing to render, so it
must fail loudly rather than show a black screen. Making the two consistent would break whichever one
was made to match the other.

⚠️ **A wording defect found here and deliberately NOT fixed:** the page's fatal text says *"all four
deployment files must sit side by side"*, which is the **web** deployment's four-file layout (19.11).
In the screensaver only **two** files sit on disk; `index.html` and `psss-engine.js` are embedded
(D4). The message is inherited from `src/`, and correcting it would be a **third** `src/` change in a
phase whose plan names exactly two (20.1 and 20.8a) — so it is recorded here as a known cosmetic
inaccuracy in a fatal path, not silently altered.

⚠️ Both cases build a **partial tree in `%TEMP%` from an explicit copy list**, never by deleting from
`publish/`. Deleting there would make the next unrelated case measure a broken install without saying
so, and `build.bat` would restore it at some unpredictable later time — a defect that appears and
disappears with the build rather than with the case. The list is written out rather than being
"everything except X", because an exclusion silently starts copying whatever a future build adds.

### H. The cursor is hidden while playing and restored after (20.5)

```
BEFORE  SHOWING (flags=1, hCursor=65539)
DURING  hidden  (flags=0, hCursor=0)     <- the calibration
exited with code 0 on its own (a clean exit, so RestoreCursor ran)
AFTER   SHOWING (flags=1, hCursor=65539)
```

⚠️ **THE MIDDLE READING IS THE CALIBRATION, NOT A RESULT.** `ShowCursor` maintains a display *count*,
and whether a cross-process `GetCursorInfo` can observe another process's hide is not something to
assume. Had DURING read `SHOWING`, this probe would have been **blind** and the AFTER reading would
have proved nothing — reportable as blind, not as a pass. It read `hidden`, so the instrument is
exonerated and the AFTER reading means something.

⚠️ **AND THE CASE MUST END THROUGH THE PRODUCT'S OWN EXIT, NEVER `Process.Kill`.** `RestoreCursor`
runs from `RequestExit` *and* from a `finally`; a killed process runs neither, so a Kill would leave
the desktop with no cursor and the probe would report a defect it had caused itself. The exit is
therefore a **post-grace** click (§5.D), and the script reports VOID rather than a verdict if the host
has to be killed. `hCursor` is identical before and after — the same cursor, not merely *a* cursor.

### I. No bright frame between launch and the first animation frame (20.4)

76 samples of a 2880×8 strip at y=900 over 6.0 s, interval **78 ms**:

```
t=0.08s  mean  11.5  max  12      <- the desktop
t=0.17s  mean  11.5  max  12
t=0.24s  mean    11  max  12
t=0.32s  mean    11  max  12
t=0.40s  mean  11.5  max  12
t=0.48s  mean  11.5  max  12
t=0.57s  mean  11.5  max  12
t=0.65s  mean     2  max   7      <- the black window takes over
t=0.74s  mean     1  max   5
t=0.86s  mean   0.5  max   3
t=0.94s  mean     0  max   2
t=1.02s  mean     0  max   1
...
brightest sample: t=3.92s mean 94.4 max channel 243   <- the animation, not a flash
```

The takeover is **monotone downward**: desktop → black → animation. The brightest sample in the whole
series arrives at 3.92 s and is the reel itself. ↩ 2026-09-14 measured the same shape with its
brightest at t=3.09 s, mean 94.1, max 243.

⚠️ **AND IT MISSED A HALF-SECOND DEFECT THAT WAS ON SCREEN WHILE IT RAN — FOUND BY THE OWNER'S EYES
ON THE FIRST REAL `/s` RUN, 2026-09-16.** Between the first paint and the reel autostart the page
showed the ordinary editor layout: two panes, the right one `#0a0a0a`. That is ~6 samples wide at this
interval, so the sampling floor below is NOT the reason it was missed. Two reductions are:
1. **A MEAN OVER A 2880-WIDE STRIP CANNOT SEE A DIM REGION.** `#0a0a0a` over the right quarter moves
   the mean of the strip by about **3 counts** — indistinguishable from the desktop's own 11.5, and
   the direction of the takeover (11.5 → 2 → 0) still reads as monotone. **A per-region measurement
   would have caught it; a whole-strip mean cannot, at any sampling rate.**
2. **THIS RECORD PRINTS THE EXTREMES AND ELIDES THE MIDDLE** (`...` above, then "brightest sample").
   ⚠️ **A dim transient is a MIDDLE-magnitude event, so the summary was shaped to hide exactly this
   class of defect** while the raw series may well have carried it. The figures kept must be chosen
   against the defect classes the case is supposed to exclude, not against what looks tidy.

The fix is a boot curtain in `index.html`'s head (`html.psss-screensaver-boot`), lifted by `main.ts`'s
autostart block, seeded from both sides as spec case 7 (seeds 7a/7b). ⚠️ **The spec, not this case, is
now the instrument for it** — a DOM measurement of one named pane, which is a thing a screen-pixel mean
cannot be.

⚠️ **THIS CASE HAS A SAMPLING FLOOR AND IS ONLY EVIDENCE AGAINST A *SUSTAINED* FLASH.** At ~78 ms per
sample it cannot see a single white **frame**, which at 60 Hz is 16 ms. ⚠️ **And a pass here does not
prove both structural covers are present:** `WebHost` sets `DefaultBackgroundColor = Black` before
creating the controller, *and* the host paints black in `WM_ERASEBKGND`. Either alone would keep the
screen black, so this measurement cannot tell you one has been removed.

### J. `/p` preview — the DPI fix and the orphan watchdog

**Both parent DPI contexts, re-measured 2026-09-15 against the fixed binary:**

| parent's DPI awareness | client-area magenta | lit | verdict |
|---|---|---|---|
| unaware (mixed-DPI vs a PerMonitorV2 host) | **0.11 %** | 36.41 % | the child painted the thumbnail |
| PerMonitorV2 | **0.14 %** | 36.53 % | the child painted the thumbnail |

↩ Before the `PreviewHost` DPI-context fix (2026-09-14) the same measurement read **99.88 % magenta** —
i.e. the probe's magenta backfill was essentially the whole client area and the child had painted
almost nothing. The two arms above put the mixed-DPI hypothesis **on a switch**, which is what made
the diagnosis possible; ⚠️ neither arm proves the *real* Windows Settings parent behaves like either
of them, and that remains untested.

**The orphan watchdog**, parent killed with `TerminateProcess` (no window teardown):

```
CHILD before the kill: isWindow=True
AFTER THE KILL: parent isWindow=False, child isWindow=False, child's parent now 0
EXITED 0.45 s after the parent process was killed, code 0
```

↩ Before the fix this leaked for **12 s**. 0.45 s reproduced exactly on 2026-09-15.

⚠️ This phase produced **two immortal `/p` processes** that nothing on screen revealed — a preview host
with a dead parent has no window and no output. That is why `grace.ps1`'s finder is pid-filtered
(§7.1) and why this case exists at all.

### K. `/c` → `/s`: a main reel chosen in Settings is honoured by the next session (D3)

The one thing in this phase no single process can demonstrate. Run as a **two-sided differential**,
2026-09-15:

| main reel chosen in `/c` | `playSeconds` | `localStorage['psss.reels.v1']` after the click | advance gaps measured in `/s` |
|---|---|---|---|
| `Geometry` | 14 | `"mainReelName": "Geometry"`, `reels: []` | **14.5 s, 15.9 s** |
| `Grand Tour` | 20 | `"mainReelName": "Grand Tour"`, `reels: []` | **20.1 s, 21.8 s** |

⚠️ **THE TWO HALVES ARE INSTRUMENTED DIFFERENTLY ON PURPOSE.** The **write** half (`/c`) is driven
through WebView2's remote-debugging port, because a checkbox in a Lab tab cannot be reached from
outside any other way and clicking at guessed pixel coordinates would be an instrument nobody could
trust. The **read** half (`/s`) runs in the **shipping configuration** — no port, no arguments beyond
`/s`, no involvement from the script — so the claim is about the product, not about the probe's
channel.

⚠️ **AND THE CLICK IS THE PRODUCT'S OWN CLICK.** `box.click()` on the real *Main reel* checkbox fires
the real `change` listener → `ReelStore.setMainReel()` → `persist()`. Writing `localStorage` directly
would have tested the **read** path twice and the write path not at all, while producing an
identical-looking pass. The reel is selected through the real `<select>` with a dispatched `change`,
because the checkbox handler reads `this.editingName` — setting `.value` alone would tick the box for
whichever reel was loaded before, i.e. silently choose the wrong one and still pass.

⚠️ **THE OBSERVABLE IS THE CADENCE, BECAUSE NO LOG LINE NAMES THE PLAYED REEL.** `main.ts:395` prints
the **file's** `adopted.mainReelName`, so the log says `main reel "Grand Tour"` no matter what the
user chose — reading it as the answer would be a false negative every time:

```
[page] log: Loaded 3 deployment reel(s) from psss_reels.json, main reel "Grand Tour"
```

Adding a line that named the *resolved* reel would be a third `src/` change (§5.G's ⚠️), so the
measurement goes to what the log already carries: each preset change prints a pair of
`[page] debug: Film Look:` lines, so the spacing between pairs is the reel's `playSeconds`.

⚠️ **READ THE RESULT AS THE DIFFERENCE BETWEEN THE ARMS, NEVER AS ONE NUMBER AGAINST `playSeconds`.**
Both arms carry the same offsets (~+0.5 s on the first gap, ~+1.8 s on the second) — the transition
plus the parser's anchor. An absolute comparison would have needed those offsets modelled, and
getting them wrong would have looked exactly like the handoff failing. The **6-second separation
between the arms** needs no model.

⚠️ **AND ONLY THE `Geometry` ARM IS LOAD-BEARING.** The deployment file names `Grand Tour` *and*
`DEFAULT_MAIN_REEL_NAME` is `'Grand Tour'` (`reel-store.ts:93`), so candidates 1, 2 and 3 of the
four-candidate resolution order all coincide there: a 20 s cadence is what the **fallback** produces
too. The `Grand Tour` arm is therefore a **control** — it shows the instrument does not always report
14 s — and the 14 s cadence is the reading, because no fallback can produce it.

**Side effect, and its restoration.** This case writes to the **real** user profile:
`HostPaths.WebView2UserData` is one constant with no per-mode branch, which is the very mechanism
under test. Cleared afterwards with `restore-profile.ps1`:

```
BEFORE  { "version": 1, "reels": [], "mainReelName": "Grand Tour" }
CLEAR   cleared "Grand Tour"; 0 user reel(s) untouched
AFTER   { "version": 1, "reels": [], "mainReelName": null }
```

⚠️ **`null` IS THE CORRECT RESTORED STATE, NOT `"Grand Tour"`.** `reel-store.ts:176` and `:315`: a
resolved fallback must never be persisted, because that **freezes the deployment's answer at whatever
the first run saw** — a later build shipping a different `psss_reels.json` would be overridden on this
machine forever, silently. ⚠️ The two states are **indistinguishable in every observable this phase
has**, so the difference had to be reasoned about rather than measured. ⚠️ And there is **no click
that clears the mark**: the checkbox refuses to un-tick by design (`reel.ts:453`), because
`mainReelName()` would resolve a fallback and the box would spring straight back on. So the restore
goes at `localStorage` directly — the opposite of this case's own rule, which is honest only because
`restore-profile.ps1` makes **no measurement and states no verdict**. `main-reel-handoff.ps1`'s
built-in `-Restore` path has the freezing defect and its header now says so.

### L. `preview.png` (20.8a / D5)

Six candidates rendered by `make-preview.mjs` and compared by eye; `preview-cand-4.png` was chosen
and copied to `screensaver/preview.png` (169 475 B, identical bytes). D5 is a **static** PNG — a live
render in the Settings thumbnail was declined — so this is a judgement call with no measurement
behind it, recorded as such.

### M. The 2026-09-16 defect report — two halves, one closed and one open

The owner's words: *"the mode `/s` works now correctly, however `/c` and `/p` as arguments show exactly the
same behaviour, we do not enter a config mode with the Reel tab and there is no thumbnail view, in both
cases it goes to fullscreen mode and starts playing the first preset of the main reel, sometimes it does a
pause after a few seconds, where the animation pauses for a few seconds before it continues, this however
does not happen each time we start it up"*.

⚠️ **THE TWO HALVES ARE UNRELATED AND WERE VERY NEARLY INVESTIGATED AS ONE.** Both arrived in one sentence
about one launch, and the first reading — "config mode is broken and it stalls" — is wrong twice: the mode
was never entered, and the stall also happens in modes that *were* entered. **A report that names two
symptoms is not evidence of one cause.**

**M1 — `/c` and `/p` "behave exactly like `/s`": NOT A PARSER DEFECT, and nothing in this host is wrong.**
All ten launches that day logged **`args [/S]`**, so neither typed argument ever reached `ParseArguments`.
The cause is the `.scr` **shell association** and it is documented in §4's second bullet and, for a human,
in `README.md` §3 — which had never stated it and now does, because ⚠️ **this record knew it and the
human-facing file did not, which is how a documented fact still cost a defect report.** The same binary
launched with `UseShellExecute = false` gives both modes:

```
--- pid ..... args [/c] -> Config (config with no owner window)
[config] work area 0,0 2880x1704 at 192 dpi -> window 40,40 2800x1624
[webview] navigating to https://psss.invalid/index.html?reel=0&tab=reel
[page] debug: Panel mode: grid  lab
[page] debug: [tab] opened the Lab on "reel"
```

and `preview-host.ps1` against a real parent: `VERDICT the child painted the thumbnail`, then
`EXITED after the parent was destroyed, code 0`. **Both modes work; only the route to them was
undocumented.** The routes that do deliver an argument are the table in `README.md` §3.

**M2 — the intermittent pause: OPEN. What is measured, and what each figure is a measurement OF.**

| the claim | how it is known | ⚠️ what it is not |
|---|---|---|
| it is **ONE frame**, ~1.3–1.8 s | `cpu-sample.ps1`'s idle run, three surviving observations | not a slow *period* — so no engine parameter, particle count or preset is implicated |
| the renderer burns **no measurable CPU** across it | per-process `TotalProcessorTime`, flat to <0.05 cores | **this is the load-bearing reading**: a long JS task, a lazy shader compile, a texture upload and a GC all *consume* CPU, so all of them are ruled out and `requestAnimationFrame` was simply never called |
| ~3–6 s after `presenting`, **once** per session | the restamped log lines beside the CPU series | not tied to any timer in `src/` — only five exist and none is at that period |
| nothing jumps when it resumes | `main.ts`'s `dt` is `Math.min(time - lastTime, 100)` | this is *why* it reads as "pauses before it continues" and not as a skip; it is an explanation of the symptom, **not** a fix |
| `PerfGuard` reports it as `fps=8.8 … 9.5` | the log, in show **and** config mode | ⚠️ **a MEAN over 30 frames, which cannot be inverted into a duration** — see `cpu-sample.ps1`'s header; on 2026-09-16 the mean implied ~3.0 s and the measured idle run was 1.33 s, and those are two measurements to be stated side by side |

⚠️ **The config-mode trips are a DIFFERENT phenomenon and pooling them was my own error, caught by
measurement.** In `/c` the Lab is open on the Reel tab, so the tile grids run and `PerfGuard` trips at
exactly the tile work it exists to catch — reproduced in Edge on the real GPU as `blitToCanvases`, 3.9 s of
self time in 15 s. Only `/S` has no tiles. I had read the config trip as evidence the stall "is not
screensaver-specific", which would have moved the whole investigation into the engine.

**Not reproducible outside the host:** the identical built bundle at `?screensaver=1` in Edge on the real
AMD GPU, 15 s, showed one 618 ms boot task and no gap of any kind.

⚠️ **One candidate tried and FALSIFIED — recorded so it is not re-tried:**
`--disable-features=CalculateNativeWinOcclusion` was added to `WebHost.cs`, the host rebuilt, and two of the
three surviving runs **still stalled** (1333 ms and 1732 ms; `fps=9.2` and `fps=9.5`). The flag was then
**removed**, because a flag whose comment claims a fix it does not deliver is worse than no flag; the
negative result lives in `WebHost.cs`'s header where the next person will meet it.

⚠️ **AND THE HOST CANNOT BE PROFILED FROM OUTSIDE, WHICH BOUNDS EVERY FUTURE ATTEMPT.**
`WebHost.AttachAsync` sets `additionalBrowserArguments` explicitly, and that makes WebView2 **ignore**
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` — so `--remote-debugging-port` cannot be injected into a shipped
build, and `AreDevToolsEnabled` is false besides. Two CDP attach attempts failed before the cause was found
in the source. **Every in-host measurement is therefore external to the page**, which is what `cpu-sample.ps1`
is; the alternative — opening a debugging port in a shipped screensaver — is not one.

⚠️ **A THIRD finding, entirely unlooked-for, and it invalidates measurements rather than adding one:
SHOW MODE OFTEN ENDS ALMOST IMMEDIATELY ON THIS MACHINE.** Eight of nine `/S` launches on 2026-09-16 ended
between ~50 ms and 1.3 s of `presenting`, on the **page's** funnel, with reasons `a mouse move` (drift, and
the page has no time grace — `README.md` §3's asymmetry paragraph), `the window lost activation`, and
**`a click` three times, which drift cannot explain and which is recorded as UNEXPLAINED.** It is not a
permanent property: `run.ps1` reported `ALIVE after 14s` on 2026-09-15, one 13 s and one 16 s run survived on
2026-09-16, and the owner's own runs lasted 10 s or more. ⚠️ **Hence the rule now in `cpu-sample.ps1` and in
its `SURVIVED` line: a show-mode measurement must state how long its session actually survived** — a probe
that dies at 1 s and a probe that runs 16 s answer different questions, and the short one reports a quiet
window as an absence of stalls.

**Last reading, on the reverted binary** (`cpu-sample.ps1`, 16 s, survived the whole window): **no idle run
over 300 ms and no `PerfGuard` trip at all.** ⚠️ Per the rule above and in `WebHost.cs`, that is
**"not reproduced" and not "fixed"** — the defect is intermittent, so a quiet run is the least informative
outcome available, and it is recorded here only so the count of surviving observations is honest.

#### 5.M addendum, 2026-09-17 — the owner's installed host, and TWO classes where this section assumed one

⚠️ **READ THIS BEFORE CITING ANY FIGURE ABOVE.** The owner installed the `.scr`, ran it repeatedly, and
reported *"after 2-3 seconds when the first animation starts it stalls multiple seconds … most of the time at
screensaver startup"*. The correction came from **the installed host's own `screensaver.log`** — the routes
the owner uses, accumulated over three days — and not from any probe built for this section. **67 show
sessions; 15 logged a `PerfGuard` trip; the trips cluster at 3.88–6.96 s after `presenting`.**

⚠️ **THE REPORTED fps IS BIMODAL WITH NOTHING BETWEEN, AND THIS SECTION HAD BEEN CHARACTERISING THE SMALLER
GROUP.** Deep: **7.2, 8.0, 8.5, 8.8, 8.9, 9.2, 9.5, 9.7**. Shallow: **14.7, 20.7, 23.9, 25.2, 25.8, 26.1,
29.9**. Converting a 30-frame mean into **time lost inside that window** — a lower bound on the stall and
never a frame duration, per this section's own rule — against the **115–117 fps** the recovery lines report as
normal, so a nominal window is **258 ms**:

| class | window from the mean | minus nominal ⇒ lost |
|---|---|---|
| deep (8 obs.) | 3.09 – 4.17 s | **2.8 – 3.9 s** |
| shallow (7 obs.) | 1.00 – 2.04 s | **0.75 – 1.8 s** |

⚠️ **THAT RESOLVES THE CONTRADICTION THE TABLE ABOVE ALREADY FLAGGED AND COULD NOT EXPLAIN.** Row `fps=8.8 …
9.5` says *"the mean implied ~3.0 s and the measured idle run was 1.33 s, and those are two measurements to be
stated side by side"*. They are not two measurements of one event: **~3.0 s is the deep class and 1.33 s is the
shallow one.** The instruction to state them side by side was right; the assumption that one of them had to be
wrong was not. **The owner's "multiple seconds" is the deep class, and everything this section measured
directly is the shallow one.**

⚠️ **`PerfGuard` HAS A ~120-FRAME DEAD ZONE, SO ITS TRIP COUNT IS A FLOOR AND NOT A RATE.**
`SETTLE_FRAMES = 90` returns before pushing any `dt` and `SAMPLE_COUNT = 30` must then fill, so the earliest
possible report is frame 121 after the last `applyPresetChange` — **~0.78 s at 115 fps but ~2.0 s at 60 fps.**
Working back from the trip times, onset lands at **~0.8 s after `presenting`**, *on that boundary*. So whether
a session reports anything depends on which side of the dead zone the stall falls, **an absent trip is not an
absent stall, and 15/67 cannot be read as a frequency.** This reconciles this section's "not each time" with
the owner's "most of the time" **without either observation being wrong** — and note that §5.M's own
short-session finding (eight of nine runs dead inside 1.3 s) meant most probe runs could not have seen it
either. ⚠️ **The RECOVERY GAP is the sharper instrument and localises the big sample inside the window:**
**12 ms** and **31 ms** (deep) mean it was the *oldest* sample and left after one shift; **236 ms** (shallow)
means it was the newest and had to slide the full width. ⚠️ **A latched mean-over-N guard is a presence
detector with a dead zone, not a timer.**

⚠️ **AND THE ZERO-CPU FALSIFICATION IS NARROWER THAN THIS SECTION HAS BEEN READING IT — the gap is in the
REDUCTION, not in the collection, which is why re-reading the sampler's process list exonerates nothing.**
`cpu-sample.ps1` **does** sample every `msedgewebview2` process this run started, GPU process included (line
81), and prints a CPU total for each (lines 110–113). But those totals are **whole-window** figures, and a
whole-window total cannot localise a 3 s burst. **The only time-resolved reading is `LONGEST IDLE RUN`, and it
is computed for exactly ONE process — the busiest non-`dwm` one (lines 117–135)** — plus `dwm` as a single
average over that same window (lines 136–141). So "zero CPU during the stall" is a claim about **one process
over one window**, and a driver-side D3D compile or a heavy first draw in the **GPU** process would starve
`requestAnimationFrame` while leaving the renderer's idle run exactly as measured. ⚠️ **Worse for the reader:
the renderer and the GPU process are BOTH named `msedgewebview2`, so the `BUSIEST PID … (name)` line cannot
say which one the idle run describes** — if the GPU process were the busier of the two, the figure quoted
throughout this section is the GPU process's and was read as the renderer's. **That class was never excluded —
it was mistaken for excluded, and every "every CPU-consuming explanation is ruled out" reading above must be
read with this paragraph.** The fix is a per-PID idle-run reduction, not a wider `Get-Process`.
`CalculateNativeWinOcclusion` stays falsified; do not retry it.

**Owner-measured, 2026-09-17, and negative: it does NOT reproduce in a browser** at the same bundle — which
strengthens rather than repeats the Edge result above, because that one was taken on a machine in use. Three
candidates for what the browser route lacks, cheapest first: the **full-monitor drawing buffer**
(2 880 × 1 800 × display scale vs a windowed tab — test a browser in *real* full screen on that monitor); the
**panel-mode compositing path** (presenting with `fullscreenElement` null is not the browser's fullscreen
path); the **cold private profile** (`…\WebView2\EBWebView\` is used by nothing else, so its shader cache is
far colder than an everyday browser's). ⚠️ **One suspect is dead from the log alone: Windows' own
idle-maintenance work cannot be it — the deepest stalls occurred in runs launched BY HAND, seconds apart, on a
machine that was not idle.** That matters because the screensaver and Windows idle maintenance share a
trigger, which made it the most attractive explanation available.

⚠️ **PARKED BY OWNER DECISION 2026-09-17, and Phase 20 was ticked with this open** — read the tick and this
section together or neither. ⏳ **Owed, and none of it is a fix:** sample the **GPU** process alongside the
renderer; two `/s` runs with `…\WebView2\EBWebView\Default\GPUCache` cleared between (large once then gone ⇒
shader cache; **no warming is itself the finding**, since the owner sees it most of the time); the idle browser
test. ⚠️ **The real owed item is an instrument: every duration here is INFERRED from a guard with a 120-frame
dead zone.** A direct per-frame record over the first few hundred frames — opt-in like `?gldiag=1`, never
always-on — replaces the whole inference chain, and costs nothing to plumb because the host already copies the
page's console into `screensaver.log`. The fallback is to warm up behind the existing boot curtain, which
**hides** a one-time cost rather than explaining it and would make the defect unobservable: measure first, or
knowingly give the measurement up.

---

## 6. Not measurable on this machine

- **D2's secondary monitors: black, and exiting together with the primary.** This is a
  single-display machine and every show-mode run logs
  **`[show] 0 black sibling window(s)`** — so `CreateBlackSiblings` is reached and correctly creates
  nothing, but the branch that creates, paints and tears down a sibling has **never executed**.
  ⚠️ The log line is evidence the code ran, *not* evidence the feature works; the two readings differ
  and only the first is available here. This is the phase's largest unmeasured surface.
- **The real Windows Settings preview parent** (§5.J's ⚠️) — both arms are synthetic parents created
  by the probe.
- **A single-frame white flash** (§5.I's sampling floor).
- **Installation through the shell** (right-click → Install, the `.scr` in `%WINDIR%`, the Settings
  dialog's own timeout behaviour). Every launch here is direct and explicit.

---

## 7. Instrument-level findings — the defects that were in the probe, not the host

These cost real cases and each one produced a *plausible* wrong answer rather than an error, which is
why they are recorded next to the results rather than deleted with the bug.

1. **`FindWindowW` is not a reliable finder on this machine, and the mechanism is NOT established.**
   `grace.ps1` polled for class `PsssScreensaverShow` every 5 ms for 40 s and reported
   `ABORT: no ... window after 40s` **while the animation was on screen**. `find-window.ps1` asserted
   it both ways in one run:
   ```
   FindWindowW('PsssScreensaverShow', null) -> 0
   FindWindowW(null, 'psss')                -> 0
   EnumWindows over the pid: 5703726  class 'PsssScreensaverShow'  title 'psss'  visible=True
   ```
   The same P/Invoke finds `Shell_TrayWnd` and also fails on `Progman`, so it is neither a broken
   declaration nor a marshalling fault. **Recorded as unexplained rather than explained wrongly.**
   ⚠️ The replacement — a pid-filtered `EnumWindows` sweep — is an **improvement, not a consolation**:
   a class-name search matches *any* process's window of that class, including a leaked host from an
   earlier case (§5.J), so the old finder could have locked onto the wrong subject and made every
   later measurement untrustworthy.
2. **The capture size trap, twice.** `powershell.exe` is DPI-**virtualized by default** (not by
   manifest — an earlier header asserted the opposite, an assumption written in the voice of a
   measurement). A 1440×900 request captured the top-left quarter and read as two separate "real"
   findings: show mode's lit % over a quarter basis, and the config window's Lab panel appearing
   absent because it sits outside the crop — which read as *"`?tab=reel` does not work in the host"*
   when the host log proves it does. Then the **first repair had the same defect one layer down**: a
   silent fallback to the virtualized size printed `physical 1440x900 (this process sees 1440x900)`,
   which is self-consistent and completely wrong. Hence the rules now in `capture.ps1`: **every source
   names itself in the output, no source at all means ABORT rather than guess, and "names itself"
   includes naming its own failure** — an empty `catch` had hidden a total loss of both sources as if
   it were one fragile fallback. Seen live again 2026-09-15: `NOTE GetDeviceCaps source unavailable:
   UnauthorizedAccessException` (Defender scanning the temp DLL mid-write) while the WMI source
   carried the run — visible precisely because both sources report.
3. **A PowerShell function returns everything it writes to the success stream — three times.**
   `New-PartialTree`'s progress line made the caller receive a two-element array and
   `Join-Path` failed with a `DriveNotFoundException` **naming a drive called `"    tree C"`**: an
   error that reads like a broken path rather than like a function returning too much. `Invoke-Cdp`
   leaked `CloseAsync`'s `VoidTaskResult`, printing `BEFORE psss.reels.v1 = System.Object[]` and
   `CLICK System.Threading.Tasks.VoidTaskResult` — the real answer was in the array at index 1,
   unread. ⚠️ **In an instrument this is worse than a crash, because `System.Object[]` is a value and
   could have been reported as one.** Fixes: `Write-Host` for progress, `[void]` on every await.
4. **PS 5.1 vs PS 7 syntax.** `grace.ps1` used inline `if (...) {...} else {...}` **expressions**
   inside `-f` arguments. That is PS 7 syntax; Windows PowerShell 5.1 — which is what runs `.ps1` by
   default here — rejects it at **parse** time, so the probe would have failed before launching
   anything.
5. **`Add-Type` ordering.** PS 5.1's inline C# compiler resolves references against whatever the
   session has already loaded, so a compile placed after `Add-Type -AssemblyName System.Windows.Forms`
   throws an exception that **names an assembly** and reads as a broken machine rather than a caller
   ordering problem. Every script compiles its interop block **first**.
6. **A CDP page target exists before a Lab tab's DOM does, and it cost a control run.** `/json/list`
   answers as soon as the document is navigable, while `TabRegistry` builds a tab's container on first
   **show** — the same rule `CLAUDE.md` states for the Playwright suite. The first handoff control run
   died with `CLICK no reel select in the DOM`. Fixed by polling for the **element**; ⚠️ a
   `Start-Sleep 3` would have passed on this machine and handed the false negative to the next one.
7. **Two probe scripts disappeared from disk mid-sitting**, unexplained, and were rewritten. Noted as
   a hazard for anyone re-running this: verify the script set is complete before trusting a "no such
   file" result.
8. **A working-directory slip** produced a German "argument not present" message from
   `powershell -File ./startup-cases.ps1` because the shell's cwd was `screensaver/`, not
   `screensaver/probe/`. Cosmetic, but it reads as a broken script.

9. **A zero in a CPU table can be the counter, not the process — and it was about to be quoted as
   evidence.** `cpu-sample.ps1` prints `PID 2652 dwm: CPU 0 ms over 15922 ms wall` on **every** run.
   `dwm.exe` is a protected process and its `TotalProcessorTime` is not readable from an unelevated
   session, so that row is a **permission failure formatted as a measurement** — and it sat one line away
   from the renderer's genuine zero, which *is* the finding of §5.M. ⚠️ **Two zeros with different
   meanings in one table is the shape to distrust:** the renderer's is a live counter that stopped moving,
   dwm's is a counter that was never read. Recorded rather than fixed, because the row's *presence* is
   still useful — it names what the instrument cannot see.
10. **The publish size is not an instrument for "did my edit land"** — see `README.md` §1's block. A
   ~40-character source change left `psss.scr` byte-identical at 16,159,274 B, twice (adding a flag, then
   removing it). ⚠️ **A UTF-16 string scan is what settles it**, because C# literals live in the `#US` heap
   two bytes per character and a byte-oriented `grep` finds nothing in a binary that contains the string.
   ⚠️ **AND THE CONVERSE LANDED ON 2026-09-17, WHICH STRENGTHENS THIS ITEM RATHER THAN DATING IT: the
   `.scr` went 16,159,274 → 16,159,428 B, +154 B, with NO host source edit between them.** So the size
   moves without an edit as readily as an edit leaves it still — it is not an instrument in either
   direction. That step was chased and is recorded as UNATTRIBUTED (the `#US` scan returns 0 for the only
   string the sitting could have added, and the build is deterministic at the current tree: a from-scratch
   build after `rm -rf screensaver/obj` reproduced 16,159,428 B at the same `sha256 abcfed853db7…`). ⚠️ **The
   274 binary no longer exists to diff, so it can never now be localised** — and the instrument that made
   the 2026-09-16 +4,096 B attributable, the two data files holding still, is gone too: they now move with
   every preset settle. **From here the hashes are the instrument and the next size step is the first one
   that can be attributed again.**
11. **A synthetic cursor park cannot test the early exits, because the instrument is the subject.**
   `cpu-sample.ps1 -Park` sets the cursor before launching to test whether the exits depend on where it
   sits — and `SetCursorPos` itself produced host-side exits (`a mouse move of 609 px`, `334`, `1035`). The
   switch is kept because the hypothesis is still open, but ⚠️ **it can only be read on a machine whose
   physical mouse is not also moving**, and on this one it confounded every arm.
12. “**HOW DO I TEST `/S`, `/C` AND `/P`?” WAS ASKED ON 2026-09-16 AND THE ANSWER IN `run.ps1`'s OWN HEADER
   WAS WRONG.** The header documented `-Args '/c'`; the parameter is `-ScrArgs`. ⚠️ **PowerShell binds
   `-Args` to nothing** (it is not a prefix of `ScrArgs`) **and exits 0**, so the script runs with an EMPTY
   argument — which the contract answers with CONFIG. So the documented command reached config mode, which
   is what a reader typing it expects to see, **by a route that had nothing to do with the argument**: the
   same wrong line typed as `-Args '/s'` would have measured config and been written down as show.
   `$Args` cannot be the parameter's name because it is an automatic variable, which is how the two
   spellings came to differ. ⚠️ **A parameter name is the one part of a probe's header that the probe
   itself cannot check, and a silently-ignored switch is indistinguishable from an honoured one** — the
   only tell is the host's own first log line, `--- pid N args [X] -> Mode (how)`, which is why every
   route in `README.md` §3 is now stated together with the instruction to read that line rather than the
   screen. Fixed in the header, with the MSYS prefix (`MSYS_NO_PATHCONV=1`, or `//c`; both measured to
   arrive as `/c`) recorded beside it, because the two traps compose: a mangled `/p` becomes `P:/`, whose
   handle is unusable, and the contract answers that with config as well. **`/p` is therefore the one mode
   with NO command-line route at all** — it needs a live parent window, so `preview-host.ps1` or the real
   Settings dialog are the only two ways to see it.
   ⚠️ **Follow-up, same day, when the question became “how from PowerShell”: `.\psss.scr /c` is a
   DOCUMENT ACTIVATION, not a launch with an argument.** `.SCR` is absent from `$env:PATHEXT`
   (`.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL`), so the call operator hands the file to
   the shell and the association's `/S` wins — the same outcome as a double-click, reached by a route that
   looks like a normal command invocation. **Measured on a copy of `cmd.exe` renamed `t.scr`**, chosen so
   that an argument that DID arrive would leave a file behind: `& .\t.scr /c "echo … > out.txt"` produced
   none, and the same call in a pipeline failed with `CantActivateDocumentInPipeline`, which names the
   mechanism outright. ⚠️ **The stand-in is the point of the technique: the real `.scr` cannot report
   what it received without entering a mode, and show mode takes the screen.** `Get-ExecutionPolicy -List`
   reads `CurrentUser RemoteSigned` on this machine, so `.\probe\run.ps1` runs from a prompt unsigned,
   these scripts being local.
   ⚠️ **AND THE OWNER ANSWERED THE QUESTION BETTER THAN EITHER OF THOSE: COPY `psss.scr` TO `psss.exe`
   AND RUN THAT.** The rewrite belongs to the `scrfile` ASSOCIATION, i.e. to the extension, so it does not
   follow the program: `.EXE` is in `PATHEXT`, has no verb template, and the argument is simply passed.
   Verified 2026-09-16 — `.\psss.exe /c` logged `--- pid 48576 args [/c] -> Config (config with no owner
   window)`, and the same log holds the owner's own `args [/S] -> Show` and `args [/P] -> Config (preview
   with an unusable handle '', so config)` from the same route minutes earlier. ⚠️ **This is the finding
   inside the finding: three paragraphs above were spent on how to defeat the rewrite from two shells, and
   the one-line answer was to stop feeding it a `.scr` at all** — the trap was named correctly ("the
   association") and then worked AROUND instead of being read as what it says. `/p` remains unreachable
   this way, and its log line is the proof the argument arrived: a bare `/p` has no handle, so the contract
   answers config. **Prefer this route for `/s` and `/c`; keep the probes for what they add** — capture,
   screen measurement, one injected input and the CPU series.

Recurring and benign, recorded so it is not re-investigated: **`[payload] 404 favicon.ico`** appears
on every single run. The page requests a favicon the embedded payload does not carry.

---

## 8. What this record does NOT discharge

- ⚠️ **§5.M's STALL IS OPEN, AND ITS CANDIDATE IS FALSIFIED, NOT UNTESTED** — the distinction matters
  because the next attempt must not begin with the occlusion flag. What is owed on it: an explanation, and
  before that a **surviving** run in which it reproduces on demand rather than intermittently. ⚠️ **The
  binary the figures describe is the one built 2026-09-16 with the flag REMOVED, which is the shipped
  state**, and every §5.M figure comes from at most three surviving observations.
- ⚠️ **A SECOND OWNER `/s` RUN ON THE REBUILT BINARY** — the host↔page join has no automated instrument
  (§4's ⚠️), the first owner run found the boot flash, and there have now been two rebuilds since.
- ⚠️ **A HALF-SECOND EDITOR-LAYOUT FLASH DURING BOOT, WHICH THIS RECORD'S OWN §5.I RAN STRAIGHT PAST**
  (owner, first real `/s` run, 2026-09-16) — read §5.I's added block: the miss was caused by the
  measurement's REDUCTIONS (a mean over a full-width strip, and a summary that prints the extremes),
  not by its 78 ms sampling floor. Fixed and now covered by spec case 7, seeds 7a/7b.
- ~~The `?screensaver=1` Playwright spec~~ — **BUILT AND RUN 2026-09-15, RE-RUN WITH ITS SEVENTH CASE
  2026-09-16**:
  `psss-engine/tests/10-screensaver-mode.spec.ts`, all seven cases green, `check:specs` clean, `verify`
  green. Read **the spec's own header** for its seed table and for the two properties measured while
  writing it, neither of which belongs in this file: **case 3 cannot be failed by a single-point seed**
  (the keyboard has two independent covers — seeds 3a and 3b are each GREEN alone, only 3c is red), and
  **seed 6 first failed as an anonymous 90-second timeout**, which is why the spec races the two boot
  outcomes instead of waiting for the expected one. ⚠️ **`boot()` from the shared fixture is unusable
  in this mode** — it waits for the `Lab` button, which `.app-layout.fullscreen .right-panel` hides —
  and the fixture was deliberately NOT changed to accommodate it.
- **`screensaver/README.md`** — build, install and the argument contract for a human, including the
  stated deviations and the MSB3277 / IL2104 explanation.
- **Documentation:** `README.md` §2 parameter rows (`?screensaver=1`, `?tab=`); manual §14.3 keyboard
  row and **Appendix F.6**; `psss-engine/screensaver/` added to `CLAUDE.md`'s backup item list (D7);
  the third `src/` change (`layout.css`, a Phase 19 defect fix) recorded in the plan.
- **A backup copy** covering this sitting, verified with `diff -r -q` against both the live tree and
  the previous copy.
- ~~`npm run verify`~~ — **run green 2026-09-15** (`tsc --noEmit` + every checker in `checks/`), with
  `src/main.ts` confirmed **byte-identical by `md5sum`** to a copy taken before the first seed. ⚠️ That
  identity check is the load-bearing part, not the green: twelve seeds were applied to and reverted from
  a shipped file, and a green `verify` would not notice a surviving one-character seed in a comment or
  in a string a checker does not read.
