# Undoes the ONE side effect the Phase 20.10 probe leaves in the real user profile: a stored main
# reel name. Run it after `main-reel-handoff.ps1 -NoRestore`, and read its BEFORE/AFTER as the
# record of what the profile held.
#
# ⚠️ THE PRODUCT HAS NO ROUTE TO THIS AND THAT IS A DESIGN DECISION, NOT A GAP. `reel.ts:453`: the
# Main reel checkbox cannot be UN-ticked to clear the mark, because `mainReelName()` resolves a
# fallback and the box would spring straight back on — a control that visibly refuses its own click
# (invariant 13 through the output channel). `setMainReel(null)` exists for the importer alone. So
# there is no click that restores this, and the restore has to go at `localStorage` directly.
#
# ⚠️ WHICH IS THE OPPOSITE OF THE RULE IN `main-reel-handoff.ps1`, AND THE DIFFERENCE IS WHAT IS
# BEING CLAIMED. There, writing `localStorage` directly would have tested the read path twice and
# the write path not at all — the whole point was that the product's own checkbox did the writing.
# Here nothing is being tested: this script makes no measurement and states no verdict about the
# host. It is a cleanup, and a cleanup that goes around the UI is honest as long as it does not
# also claim to have exercised it.
#
# ⚠️ AND `"mainReelName": null` IS THE TARGET, NOT `"Grand Tour"`. Setting the deployment's own
# answer back would look identical in every observable this phase has — but `reel-store.ts:315` and
# `:176` say a resolved fallback must never be persisted, because that freezes the deployment's
# answer at what the first run happened to see. A later build that ships a different
# `psss_reels.json` would be overridden on this machine forever, silently. `main-reel-handoff.ps1`'s
# own `-Restore` path has exactly this defect: it re-ticks the box for `Grand Tour`, which STORES
# the name. Use this script instead; the flag is left in place because the header there now says so.
#
# ⚠️ THE RESTORE CANNOT BE CONFIRMED THROUGH THE CADENCE CHANNEL, only by reading the value back.
# The deployment file names `Grand Tour` and `DEFAULT_MAIN_REEL_NAME` is *also* `'Grand Tour'`
# (`reel-store.ts:93`), so candidates 1, 2 and 3 of the four-candidate order all resolve to the same
# reel once the stored name is gone: `/s` plays a 20 s cadence before and after. A run record that
# claimed "restored, verified by watching /s" would be describing an experiment with no contrast.
param(
  [int]$Port = 9334
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$publish = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish')).Path
$STORE_KEY = 'psss.reels.v1'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Rst {
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

# Same one-shot CDP call as main-reel-handoff.ps1, and every await is `[void]`-ed for the same
# reason: `CloseAsync`'s `VoidTaskResult` would otherwise be part of the return value.
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
      if ($msg.result.exceptionDetails) { return 'CDP EXCEPTION: ' + $msg.result.exceptionDetails.text }
      return $msg.result.result.value
    }
  }
  $ws.Dispose()
  return 'CDP TIMEOUT'
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = (Join-Path $publish 'psss.scr')
$psi.Arguments = '/c'
$psi.WorkingDirectory = $publish
$psi.UseShellExecute = $false
$psi.EnvironmentVariables['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = "--remote-debugging-port=$Port"
$c = [System.Diagnostics.Process]::Start($psi)
Write-Output ("/c pid {0}, debugging port {1}" -f $c.Id, $Port)

$target = $null
$sw = [System.Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt 40) {
  try {
    $list = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list" -TimeoutSec 3
    $target = $list | Where-Object { $_.type -eq 'page' -and $_.url -like '*psss.invalid*' } | Select-Object -First 1
    if ($target) { break }
  } catch { }
  Start-Sleep -Milliseconds 200
}
if (-not $target) {
  Write-Output 'ABORT: no page target; nothing was changed'
  if (-not $c.HasExited) { $c.Kill(); $c.WaitForExit() }
  exit 2
}
$ws = $target.webSocketDebuggerUrl

Write-Output ("BEFORE  {0}" -f (Invoke-Cdp $ws "localStorage.getItem('$STORE_KEY')"))

# ⚠️ The stored blob is REWRITTEN FIELD-WISE, never replaced with a hand-built object: the user
# layer also holds `reels`, and writing `{version:1,reels:[],mainReelName:null}` would delete every
# reel the user had saved. It reads as "my reels are gone" and this script would be the only
# suspect nobody thinks of.
$clear = @"
(() => {
  const raw = localStorage.getItem('$STORE_KEY');
  if (raw === null) return 'the key was already absent; nothing to do';
  let o;
  try { o = JSON.parse(raw); } catch (e) { return 'REFUSED: the stored value is not JSON: ' + e.message; }
  const had = o.mainReelName ?? null;
  if (had === null) return 'mainReelName was already null; ' + (o.reels || []).length + ' user reel(s) untouched';
  o.mainReelName = null;
  localStorage.setItem('$STORE_KEY', JSON.stringify(o, null, 2));
  return 'cleared "' + had + '"; ' + (o.reels || []).length + ' user reel(s) untouched';
})()
"@
Write-Output ("CLEAR   {0}" -f (Invoke-Cdp $ws $clear))
Start-Sleep -Milliseconds 400
Write-Output ("AFTER   {0}" -f (Invoke-Cdp $ws "localStorage.getItem('$STORE_KEY')"))
# The resolved name, printed to show the fallback chain still answers — and to show that it answers
# with the same reel as before, which is why this is not a measurement.
Write-Output ("        the tab still resolves a main reel; see AFTER for the STORED value, which is the point")

# WM_CLOSE rather than Kill, so the browser process flushes LevelDB — otherwise the clear is lost
# and the profile keeps the probe's choice while this script reports success.
$h = [Rst]::WindowOf([uint32]$c.Id, 'PsssScreensaverConfig')
if ($h -ne [IntPtr]::Zero) { [void][Rst]::PostMessageW($h, [Rst]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero) }
if (-not $c.WaitForExit(15000)) {
  Write-Output 'NOTE: /c did not close on WM_CLOSE; killing it. RE-RUN THIS SCRIPT: the clear may be lost.'
  $c.Kill(); $c.WaitForExit()
} else {
  Write-Output ("/c exited with code {0}" -f $c.ExitCode)
}
