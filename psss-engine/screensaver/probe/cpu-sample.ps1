# Probe 13 of RUN-RECORD.md section 3 -- hand-run, like every other script here. THE DISCRIMINATOR
# for the multi-second pause the owner reported on 2026-09-16 (RUN-RECORD section 5.M), and the only
# instrument this project has for it, which is why it was kept rather than deleted with the sitting
# that wrote it: the defect is OPEN.
#
# ⚠️ IT MEASURES FROM OUTSIDE THE PAGE BY NECESSITY, NOT BY PREFERENCE. The real screensaver cannot
# be attached to over CDP: WebHost.AttachAsync passes its own additionalBrowserArguments, which makes
# WebView2 ignore WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS, and AreDevToolsEnabled is false besides --
# and neither may be changed for an instrument's benefit. Do not "improve" this script by opening a
# debugging port in the shipped host; measure the process instead, which is what it does.
#
# The question a fps figure cannot answer: during the ~1-3 s frame, is the renderer BUSY or IDLE?
#   BUSY  -> a long synchronous task (JS, a shader compile, a huge upload): CPU time climbs.
#   IDLE  -> requestAnimationFrame was not called at all (occlusion, a compositor or swap-chain
#            reconfiguration, DWM promoting the fullscreen window): CPU time flatlines while the
#            wall clock advances.
# Both look identical in the log, which only ever reports the MEAN over PerfGuard's 30-frame window.
# ⚠️ AND THE MEAN CANNOT BE INVERTED INTO A DURATION: a 30-frame mean of 9 fps is consistent with one
# dead frame of ~3 s AND with two of ~1.5 s, so the log's fps figure and this script's idle run are
# TWO MEASUREMENTS, to be stated side by side and never reconciled into one number. On 2026-09-16 they
# did not agree (fps=9.2 implies ~3.0 s of stall in the window; the longest idle run measured 1.33 s),
# and that disagreement is a finding about the stall's SHAPE, not an error in either instrument.
#
# ⚠️ THE IDLE RUN IS A LOWER BOUND. It counts CONSECUTIVE samples below 0.05 cores, so the two samples
# that straddle the stall's edges carry partial CPU and break the run -- up to one interval lost at
# each end -- and only the LONGEST run is reported, so a stall in two pieces reads as its larger half.
#
# ⚠️ THE TWO MODES ANSWER DIFFERENT QUESTIONS AND MUST NOT BE POOLED. In /c the Lab is open on the
# Reel tab, so the tile grids run and PerfGuard trips at the tile work it exists to catch (Edge
# reproduces that one: blitToCanvases, 3.9 s of self time in 15 s). Only /S has no tiles.
#
# ⚠️ AND A /S RUN THAT DIED EARLY MEASURES NOTHING. Show mode ends on the page's own input funnel,
# which has no time grace (README section 3), and five launches on 2026-09-16 ended inside 1.3 s.
# The SURVIVED line below is therefore part of every reading, not a footnote to it.
#
# No non-ASCII in a string literal below (Windows PowerShell 5.1 + a lost BOM = a parse error that
# reads as a broken host).
param(
  [string]$Mode = '/S',
  [double]$Seconds = 16,
  [int]$IntervalMs = 50,
  [string]$Park = ''            # "x,y" in VIRTUAL-SCREEN px: park the cursor there before launching
)

$ErrorActionPreference = 'Stop'

# ⚠️ -Park EXISTS TO TEST A HYPOTHESIS ABOUT THE EARLY EXITS, not to make the probe pass. Chromium
# fires a mousemove when the layout under a stationary cursor changes, and setPanelMode('fullscreen')
# resizes twice (immediately and again after 350 ms). If the early exits depend on WHERE the cursor
# sits, they are synthetic moves and not the user's hand.
if ($Park) {
  Add-Type -AssemblyName System.Windows.Forms
  $xy = $Park.Split(',')
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point([int]$xy[0], [int]$xy[1])
  "PARKED cursor at $([System.Windows.Forms.Cursor]::Position)"
}
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# ⚠️ Relative to THIS script's directory (screensaver\probe\), and Resolve-Path is what makes a wrong
# path an immediate abort rather than a launch of nothing that reports a clean, empty measurement.
$scr = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish\psss.scr')).Path
$log = Join-Path $env:LOCALAPPDATA 'psss\screensaver\screensaver.log'
$logLinesBefore = (Get-Content -LiteralPath $log).Count

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $scr
$psi.Arguments = $Mode
$psi.WorkingDirectory = (Split-Path -Parent $scr)
$psi.UseShellExecute = $false     # the whole point: the .scr association would rewrite this to /S
$launchedAt = Get-Date
$proc = [System.Diagnostics.Process]::Start($psi)
"LAUNCHED $Mode pid $($proc.Id) at $($launchedAt.ToString('HH:mm:ss.fff'))"

$t0 = [System.Diagnostics.Stopwatch]::StartNew()
$rows = New-Object System.Collections.Generic.List[object]
$cutoff = $launchedAt.AddSeconds(-1)
while ($t0.Elapsed.TotalSeconds -lt $Seconds) {
  $ms = $t0.Elapsed.TotalMilliseconds
  # ⚠️ Only processes THIS run started, plus dwm, which is long-lived and named explicitly. Stale
  # msedgewebview2 children of earlier probes -- and other apps' WebView2 hosts -- otherwise fill
  # the table with 0 ms rows that read as idle renderers.
  $set = @(Get-Process -Name 'psss', 'msedgewebview2' -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -ge $cutoff })
  $set += @(Get-Process -Name 'dwm' -ErrorAction SilentlyContinue)
  foreach ($p in $set) {
    try {
      $rows.Add([pscustomobject]@{ t = $ms; procId = $p.Id; name = $p.ProcessName; cpu = $p.TotalProcessorTime.TotalMilliseconds })
    } catch { }
  }
  Start-Sleep -Milliseconds $IntervalMs
}
$wall = $t0.Elapsed.TotalMilliseconds
$survived = if ($proc.HasExited) { "NO - exited on its own" } else { "YES - killed by the probe" }
if (-not $proc.HasExited) { $proc.Kill() }
$proc.WaitForExit(4000) | Out-Null
"SURVIVED the whole $([math]::Round($wall)) ms window: $survived"

$byProc = $rows | Group-Object procId
"SAMPLED $($rows.Count) rows across $($byProc.Count) process(es)"

# ⚠️ The alignment is COMPUTED, not eyeballed: every log line this run added is restamped as
# +ms from the same launch instant the CPU series is measured from. A stall claim that pairs a
# wall-clock log line with a stopwatch series by hand is a claim about the reader's arithmetic.
$added = Get-Content -LiteralPath $log | Select-Object -Skip $logLinesBefore
$offsetOf = {
  param($line)
  if ($line -match '^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})') {
    [int]((([datetime]::ParseExact($matches[1], 'yyyy-MM-dd HH:mm:ss.fff', $null)) - $launchedAt).TotalMilliseconds)
  } else { $null }
}

foreach ($g in ($byProc | Sort-Object { -(($_.Group | Sort-Object t)[-1].cpu - ($_.Group | Sort-Object t)[0].cpu) })) {
  $s = $g.Group | Sort-Object t
  $total = $s[-1].cpu - $s[0].cpu
  "PID $($g.Name) $($s[0].name): CPU $([math]::Round($total)) ms over $([math]::Round($s[-1].t - $s[0].t)) ms wall"
}

# The busiest process as a time series. Utilisation is in cores: 1.00 = one core saturated.
# ⚠️ THE PER-PID TOTALS ABOVE COVER EVERY PROCESS, BUT THIS REDUCTION COVERS ONE, and it is the only
# output with a time window in it. So `LONGEST IDLE RUN` / `NO IDLE RUN` is a claim about ONE process:
# a stall caused by the WebView2 GPU process while the renderer is the busier of the two leaves this
# figure exactly as it reads. ⚠️ Both are named `msedgewebview2`, so the `BUSIEST PID` line below
# cannot tell you which one you are looking at -- a whole-window total cannot localise a 3 s burst.
# Closing that needs a per-PID version of THIS loop, not a wider Get-Process. See RUN-RECORD.md 5.M.
$busiest = $byProc | Where-Object { $_.Group[0].name -ne 'dwm' } |
  Sort-Object { ($_.Group | Sort-Object t)[-1].cpu - ($_.Group | Sort-Object t)[0].cpu } -Descending |
  Select-Object -First 1
if ($busiest) {
  $s = $busiest.Group | Sort-Object t
  $dwmRows = ($rows | Where-Object { $_.name -eq 'dwm' } | Sort-Object t)
  # Longest run of consecutive samples in which this process burned < 0.05 cores.
  $runStart = $null; $bestFrom = 0; $bestTo = 0
  for ($i = 1; $i -lt $s.Count; $i++) {
    $dw = $s[$i].t - $s[$i - 1].t
    $u = if ($dw -gt 0) { ($s[$i].cpu - $s[$i - 1].cpu) / $dw } else { 0 }
    if ($u -lt 0.05) {
      if ($null -eq $runStart) { $runStart = $s[$i - 1].t }
      if (($s[$i].t - $runStart) -gt ($bestTo - $bestFrom)) { $bestFrom = $runStart; $bestTo = $s[$i].t }
    } else { $runStart = $null }
  }
  "BUSIEST PID $($busiest.Name) ($($s[0].name))"
  if (($bestTo - $bestFrom) -ge 300) {
    "   LONGEST IDLE RUN $([math]::Round($bestTo - $bestFrom)) ms, from +$([math]::Round($bestFrom)) ms to +$([math]::Round($bestTo)) ms"
    $d0 = ($dwmRows | Where-Object { $_.t -le $bestFrom } | Select-Object -Last 1)
    $d1 = ($dwmRows | Where-Object { $_.t -ge $bestTo } | Select-Object -First 1)
    if ($d0 -and $d1) {
      $du = ($d1.cpu - $d0.cpu) / ($d1.t - $d0.t)
      "   dwm over that same window: $([math]::Round($du, 2)) cores"
    }
  } else {
    "   NO IDLE RUN over 300 ms - if a stall was logged, it was CPU-bound"
  }
  "   utilisation per sample (cores), 10 per line:"
  $line = ''
  for ($i = 1; $i -lt $s.Count; $i++) {
    $dw = $s[$i].t - $s[$i - 1].t
    $u = if ($dw -gt 0) { ($s[$i].cpu - $s[$i - 1].cpu) / $dw } else { 0 }
    $line += ('{0,6}:{1,5:N2}' -f [int]$s[$i].t, $u)
    if (($i % 10) -eq 0) { "      $line"; $line = '' }
  }
  if ($line) { "      $line" }
}

"--- log lines this run added, restamped as +ms from launch ---"
foreach ($l in $added) {
  $o = & $offsetOf $l
  if ($null -ne $o) { "   +{0,6} ms  {1}" -f $o, ($l -replace '^\S+ \S+\s+', '') } else { "           $l" }
}
