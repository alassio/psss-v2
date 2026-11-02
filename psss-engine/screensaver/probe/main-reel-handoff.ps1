# Phase 20.10's last multi-process case: a main reel chosen in `/c` is honoured by the next `/s`.
# D3's whole point, and the one thing in this phase that no single process can demonstrate.
#
# ⚠️ THE TWO HALVES ARE INSTRUMENTED DIFFERENTLY ON PURPOSE, AND WHICH HALF GETS THE DEBUGGER IS
# THE DESIGN. The WRITE half (`/c`) is driven through WebView2's remote-debugging port, because a
# checkbox in a Lab tab cannot be reached from outside any other way and clicking at guessed pixel
# coordinates would be an instrument nobody could trust. The READ half (`/s`) runs in the SHIPPING
# configuration with no port, no arguments beyond `/s` and no involvement from this script — so the
# claim being made is about the product, not about the probe's own channel.
#
# ⚠️ AND THE CLICK IS THE PRODUCT'S OWN CLICK. `box.click()` on the real `Main reel` checkbox fires
# the real `change` listener, which calls `ReelStore.setMainReel()` and persists. The tempting
# shortcut — writing `localStorage['psss.reels.v1']` directly from the debugger — would test the
# READ path twice and the WRITE path not at all, while producing an identical-looking pass.
#
# ⚠️ WHAT MAKES THE `/s` HALF OBSERVABLE IS THE ADVANCE CADENCE, NOT A LOG LINE NAMING THE REEL,
# BECAUSE THERE IS NO SUCH LINE. `main.ts`'s deployment line reports the FILE's `mainReelName`
# (`main.ts:395` prints `adopted.mainReelName`), not the resolved one, so it says "Grand Tour" no
# matter what the user chose — reading it as the answer would be a false negative every time.
# Adding a line that names the played reel would be a THIRD `src/` change in a phase whose plan
# names exactly two (20.1 and 20.8a), so the measurement goes to what the log already shows: each
# preset change prints two `Film Look:` debug lines, so the SPACING between them is the reel's
# `playSeconds`. The three deployment reels are 20 s (Grand Tour), 18 s (Fire & Plasma) and 14 s
# (Geometry) — so `Geometry` is the target, and 14 s spacing is a signal that cannot be produced by
# the reel the deployment file names.
#
# ⚠️ THE PROFILE IS SHARED AND THIS CASE WRITES TO IT. `HostPaths.WebView2UserData` is one constant
# with no per-mode branch (PayloadFiles.cs's own ⚠️ says so), which is exactly the mechanism under
# test — so this run leaves a chosen main reel behind in the real user profile. `-Restore` puts it
# back afterwards by the same route it was set, and a run that skips the restore has changed what
# every later case sees.
param(
  [int]$Port = 9333,
  [string]$Reel = 'Geometry',
  [double]$ShowSeconds = 34,
  [switch]$NoRestore
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$publish = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish')).Path
$log = Join-Path $env:LOCALAPPDATA 'psss\screensaver\screensaver.log'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Cfg {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassNameW(IntPtr h, System.Text.StringBuilder b, int max);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PostMessageW(IntPtr h, uint msg, IntPtr w, IntPtr l);
  public const uint WM_CLOSE = 0x0010;
  public static IntPtr WindowOf(uint wantPid, string wantClass) {
    IntPtr hit = IntPtr.Zero;
    EnumWindows((h, p) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid != wantPid) return true;
      var cls = new System.Text.StringBuilder(256);
      GetClassNameW(h, cls, cls.Capacity);
      if (cls.ToString() == wantClass) { hit = h; return false; }
      return true;
    }, IntPtr.Zero);
    return hit;
  }
}
'@

function Get-LogMark { if (Test-Path $log) { (Get-Content -LiteralPath $log).Count } else { 0 } }

# ⚠️ ONE CONNECTION PER EVALUATION, which is wasteful and deliberate: a persistent socket needs a
# reader loop that correlates ids, and a correlation bug in a probe reads as the SUBJECT answering
# the wrong question. Connect, ask one thing, read until that id comes back, close.
#
# ⚠️ EVERY `GetAwaiter().GetResult()` IS `[void]`-ED, AND WITHOUT THAT THIS FUNCTION RETURNS AN
# ARRAY. `CloseAsync` completes as `VoidTaskResult`, which PowerShell adds to the success stream, so
# the first version of this case printed `BEFORE psss.reels.v1 = System.Object[]` and
# `CLICK System.Threading.Tasks.VoidTaskResult` — the DOM script's own answer was in there, at index
# 1, unread. Same defect as `startup-cases.ps1`'s `New-PartialTree`: a function that both prints and
# returns. In an instrument it is worse than a crash, because `System.Object[]` is a value and could
# have been reported as one.
function Invoke-Cdp([string]$wsUrl, [string]$expression) {
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  [void]$ws.ConnectAsync([Uri]$wsUrl, $ct).GetAwaiter().GetResult()
  $payload = @{
    id = 1
    method = 'Runtime.evaluate'
    params = @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
  } | ConvertTo-Json -Depth 6 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $seg = New-Object System.ArraySegment[byte] (,$bytes)
  [void]$ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).GetAwaiter().GetResult()

  $buf = New-Object byte[] 65536
  $recv = New-Object System.ArraySegment[byte] (,$buf)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt 20) {
    $sb = New-Object System.Text.StringBuilder
    do {
      $r = $ws.ReceiveAsync($recv, $ct).GetAwaiter().GetResult()
      [void]$sb.Append([System.Text.Encoding]::UTF8.GetString($buf, 0, $r.Count))
    } while (-not $r.EndOfMessage)
    $msg = $sb.ToString() | ConvertFrom-Json
    if ($msg.id -eq 1) {
      [void]$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', $ct).GetAwaiter().GetResult()
      $ws.Dispose()
      if ($msg.result.exceptionDetails) { return "CDP EXCEPTION: " + $msg.result.exceptionDetails.text }
      return $msg.result.result.value
    }
  }
  $ws.Dispose()
  return 'CDP TIMEOUT'
}

function Start-Config([int]$port) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = (Join-Path $publish 'psss.scr')
  $psi.Arguments = '/c'
  $psi.WorkingDirectory = $publish
  $psi.UseShellExecute = $false
  # ⚠️ The env var is read by the WebView2 BROWSER PROCESS, so it has to be on the host's
  # environment before the environment is created — not something that can be turned on later.
  $psi.EnvironmentVariables['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = "--remote-debugging-port=$port"
  [System.Diagnostics.Process]::Start($psi)
}

function Get-PageTarget([int]$port, [double]$max = 40) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $max) {
    try {
      $list = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 3
      $t = $list | Where-Object { $_.type -eq 'page' -and $_.url -like '*psss.invalid*' } | Select-Object -First 1
      if ($t) { return $t }
    } catch { }
    Start-Sleep -Milliseconds 200
  }
  return $null
}

# ⚠️ A PAGE TARGET EXISTS BEFORE THE TAB'S DOM DOES, AND THE FIRST CONTROL RUN OF THIS CASE WAS LOST
# TO IT: `CLICK no reel select in the DOM`, in a run whose only difference from the passing one was
# machine timing. `/json/list` answers as soon as the document is navigable, while the Reel tab's
# controls are created by `TabRegistry` when the tab is first SHOWN (`CLAUDE.md` → Phase 17 states
# the same rule for the Playwright suite: `[data-tab="X"]` matches nothing until X has been opened).
# ⚠️ Polling for the ELEMENT rather than sleeping a fixed time is the fix; a `Start-Sleep 3` would
# pass on this machine and hand the same false negative to the next one.
function Wait-Dom([string]$wsUrl, [string]$selector, [double]$max = 25) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $max) {
    if ((Invoke-Cdp $wsUrl "!!document.querySelector('$selector')") -eq $true) { return $sw.Elapsed.TotalSeconds }
    Start-Sleep -Milliseconds 200
  }
  return -1
}

function Stop-Config([System.Diagnostics.Process]$p) {
  # ⚠️ WM_CLOSE, NOT Kill: the store persists through `localStorage`, whose backing LevelDB is
  # flushed by the browser process on an orderly shutdown. Killing the host here could lose the
  # very write this case exists to observe, and the loss would look like "`/s` ignored the choice".
  $h = [Cfg]::WindowOf([uint32]$p.Id, 'PsssScreensaverConfig')
  if ($h -ne [IntPtr]::Zero) { [void][Cfg]::PostMessageW($h, [Cfg]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero) }
  if (-not $p.WaitForExit(15000)) {
    Write-Output '    NOTE: the config host did not close on WM_CLOSE; killing it (the write may be lost)'
    $p.Kill(); $p.WaitForExit()
  }
}

$STORE_KEY = 'psss.reels.v1'

# ── half A: choose the reel in /c, through its own control ────────────────────────────────────
Write-Output ('########## half A: choose "{0}" as the main reel in /c ##########' -f $Reel)
$c = Start-Config $Port
Write-Output ("    /c pid {0}, remote debugging on port {1}" -f $c.Id, $Port)
$target = Get-PageTarget $Port
if (-not $target) {
  Write-Output '    ABORT: no psss.invalid page target appeared. The WebView2 debugging port is the'
  Write-Output '           instrument, not the subject — this says nothing about the host.'
  if (-not $c.HasExited) { $c.Kill(); $c.WaitForExit() }
  exit 2
}
Write-Output ("    page target: {0}" -f $target.url)

$domAt = Wait-Dom $target.webSocketDebuggerUrl 'select.sl-reel-select'
if ($domAt -lt 0) {
  Write-Output '    ABORT: the Reel tab never built its controls. That is a finding about /c, not about'
  Write-Output '           the handoff — `?reel=0&tab=reel` is supposed to open the tab.'
  if (-not $c.HasExited) { $c.Kill(); $c.WaitForExit() }
  exit 2
}
Write-Output ("    the Reel tab's controls appeared {0:0.0}s after the page target did" -f $domAt)

$before = Invoke-Cdp $target.webSocketDebuggerUrl "localStorage.getItem('$STORE_KEY')"
Write-Output ("    BEFORE  {0} = {1}" -f $STORE_KEY, ($(if ($null -eq $before) { '(absent)' } else { $before })))

# ⚠️ Selected through the real `<select>` and its `change` event, because `loadReel()` is what puts
# the tab into "this reel is the one being edited" — and the checkbox's handler reads
# `this.editingName`. Setting `.value` without dispatching would tick the box for whatever reel was
# loaded before, i.e. silently choose the wrong one and still pass.
$pick = @"
(() => {
  const sel = document.querySelector('select.sl-reel-select');
  if (!sel) return 'no reel select in the DOM';
  const has = [...sel.options].some(o => o.value === '$Reel');
  if (!has) return 'the reel "$Reel" is not in the dropdown: ' + [...sel.options].map(o => o.value).join(' | ');
  sel.value = '$Reel';
  sel.dispatchEvent(new Event('change'));
  const box = document.querySelector('label.sl-reel-main input[type=checkbox]');
  if (!box) return 'no Main reel checkbox in the DOM';
  const was = box.checked;
  if (!box.checked) box.click();
  return 'selected ' + sel.value + '; the box was ' + (was ? 'already ticked' : 'ticked by this click')
    + ' and now reads ' + box.checked;
})()
"@
Write-Output ("    CLICK   {0}" -f (Invoke-Cdp $target.webSocketDebuggerUrl $pick))
Start-Sleep -Milliseconds 500
$after = Invoke-Cdp $target.webSocketDebuggerUrl "localStorage.getItem('$STORE_KEY')"
Write-Output ("    AFTER   {0} = {1}" -f $STORE_KEY, $after)
Stop-Config $c
Write-Output ("    /c exited with code {0}" -f $c.ExitCode)

# ── half B: /s, shipping configuration, and the cadence is the reading ────────────────────────
Write-Output '########## half B: /s with no instrumentation at all ##########'
$mark = Get-LogMark
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = (Join-Path $publish 'psss.scr')
$psi.Arguments = '/s'
$psi.WorkingDirectory = $publish
$psi.UseShellExecute = $false
$s = [System.Diagnostics.Process]::Start($psi)
Write-Output ("    /s pid {0}; watching for {1}s" -f $s.Id, $ShowSeconds)
Start-Sleep -Seconds $ShowSeconds
if (-not $s.HasExited) { $s.Kill(); $s.WaitForExit() }

$lines = Get-Content -LiteralPath $log
$new = if ($lines.Count -gt $mark) { $lines[$mark..($lines.Count - 1)] } else { @() }
# Each preset change prints a pair of `Film Look:` lines; the FIRST of each pair is the event.
$events = @()
$lastT = $null
foreach ($l in $new) {
  if ($l -match '^(\d{4}-\d{2}-\d{2} [\d:.]+)\s+\[page\] debug: Film Look') {
    $t = [datetime]::ParseExact($matches[1], 'yyyy-MM-dd HH:mm:ss.fff', $null)
    if ($null -eq $lastT -or ($t - $lastT).TotalSeconds -gt 1.0) { $events += $t }
    $lastT = $t
  }
}
Write-Output ("    {0} preset-change events in the log" -f $events.Count)
for ($i = 1; $i -lt $events.Count; $i++) {
  Write-Output ("      gap {0} -> {1}: {2:0.0} s" -f $i, ($i + 1), ($events[$i] - $events[$i - 1]).TotalSeconds)
}
# ⚠️ READ AS A DIFFERENCE BETWEEN TWO ARMS, NEVER AS ONE NUMBER AGAINST `playSeconds`. Measured
# 2026-09-15, same binary, same parser, only the `/c` choice differing:
#     -Reel Geometry     (playSeconds 14) -> gaps 14.5 s, 15.9 s
#     -Reel 'Grand Tour' (playSeconds 20) -> gaps 20.1 s, 21.8 s
# Both arms carry the SAME offsets (about +0.5 on the first gap and +1.8 on the second), which is the
# transition duration plus this parser's anchor — so an absolute comparison would have needed those
# offsets to be modelled, and getting them wrong would have looked like the handoff failing. The
# 6-second separation between the arms needs no model at all.
Write-Output '    expected: 14 s for Geometry, 18 s for Fire & Plasma, 20 s for Grand Tour, and the'
Write-Output '              deployment file names Grand Tour -- so run BOTH arms and compare them'
$new | Where-Object { $_ -match 'presenting|main reel|autostart|Loaded' } | ForEach-Object { Write-Output "      $_" }

if (-not $NoRestore) {
  Write-Output '########## restoring the profile ##########'
  # ⚠️ PREFER `restore-profile.ps1`, WHICH DOES THIS CORRECTLY — THIS PATH IS NOT A FULL RESTORE and
  # is kept only because removing it would silently change what `-NoRestore` means. It re-ticks the
  # box for `Grand Tour`, which STORES that name; but the state before any probe ran was
  # `mainReelName: null`, and `reel-store.ts:176` says persisting the deployment's own answer freezes
  # it at what the first run saw. The two are indistinguishable in every observable this phase has
  # (the deployment file and `DEFAULT_MAIN_REEL_NAME` both say `Grand Tour`), which is exactly why
  # the difference has to be reasoned about rather than measured.
  # ⚠️ There is no click that clears the mark — the checkbox refuses to un-tick by design
  # (`reel.ts:453`) — so a true restore cannot go through the UI at all.
  # Restored through the SAME control, not by clearing localStorage: this case has just shown
  # that the checkbox writes, so using it to write a value back is the one route already measured.
  # Clearing the key from here would also risk discarding anything else the store holds.
  $c2 = Start-Config $Port
  $t2 = Get-PageTarget $Port
  if ($t2) { [void](Wait-Dom $t2.webSocketDebuggerUrl 'select.sl-reel-select') }
  if ($t2) {
    $restore = @"
(() => {
  const sel = document.querySelector('select.sl-reel-select');
  if (!sel) return 'no reel select';
  sel.value = 'Grand Tour';
  sel.dispatchEvent(new Event('change'));
  const box = document.querySelector('label.sl-reel-main input[type=checkbox]');
  if (!box.checked) box.click();
  return 'main reel set back to ' + sel.value + '; ' + localStorage.getItem('$STORE_KEY');
})()
"@
    Write-Output ("    {0}" -f (Invoke-Cdp $t2.webSocketDebuggerUrl $restore))
    Start-Sleep -Milliseconds 500
  } else {
    Write-Output '    NOTE: could not reattach to restore; the profile still names the probe''s choice'
  }
  Stop-Config $c2
}
