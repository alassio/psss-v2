# The two Phase 20.10 cases about what show mode does to the desktop AROUND the animation: the
# cursor, and the white flash before the first frame.
#
#   -Case cursor   hidden while playing, restored after a CLEAN exit
#   -Case flash    samples the screen from launch onwards looking for a bright frame
#   -Case both
#
# ⚠️ THE CURSOR CASE MUST END THROUGH THE PRODUCT'S OWN EXIT, NEVER THROUGH `Process.Kill`, AND
# THE DIFFERENCE IS THE WHOLE MEASUREMENT. `RestoreCursor` is called from `RequestExit` and again
# from a `finally` in `Program.RunShow`; a killed process runs neither, so a Kill would leave the
# desktop with no cursor and the case would report a defect that the probe itself caused. The exit
# is therefore a click AFTER the 700 ms grace (see grace.ps1 for why the grace has to be waited
# out), and if the host does not exit on its own the case reports VOID rather than a verdict.
#
# ⚠️ AND THE INSTRUMENT IS CHECKED BEFORE IT IS BELIEVED. `ShowCursor` maintains a display COUNT,
# and whether a cross-process `GetCursorInfo` can even observe another process's hide is not
# something to assume. So the case reads the flag at three instants and the MIDDLE one is the
# calibration: if the cursor reads "showing" while the saver is playing, this probe is blind and
# the "restored afterwards" reading proves nothing — that is reported as blind, not as a pass.
#
# ⚠️ THE FLASH CASE HAS A SAMPLING FLOOR AND MUST SAY SO. It samples a strip roughly every 100 ms,
# so it can only see a flash that lasts about that long; a single white FRAME at 60 Hz is 16 ms
# and would be missed entirely. It is therefore evidence against a sustained flash and nothing
# more. The structural defence is elsewhere and is not what this case measures:
# `WebHost` sets `DefaultBackgroundColor = Black` before creating the controller, and the host
# class paints black in WM_ERASEBKGND — two independent covers, either of which alone would keep
# the screen black. A pass here does NOT tell you both are present.
param(
  [ValidateSet('cursor', 'flash', 'both')][string]$Case = 'both'
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$publish = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish')).Path
$log = Join-Path $env:LOCALAPPDATA 'psss\screensaver\screensaver.log'

# Compiled before any -AssemblyName load; see capture.ps1's header for why the order matters.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Fx {
  [StructLayout(LayoutKind.Sequential)] public struct CURSORINFO {
    public int cbSize; public int flags; public IntPtr hCursor; public int x, y;
  }
  [DllImport("user32.dll")] public static extern bool GetCursorInfo(ref CURSORINFO ci);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassNameW(IntPtr h, System.Text.StringBuilder b, int max);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
  [DllImport("gdi32.dll")] public static extern int GetDeviceCaps(IntPtr dc, int index);
  public const int DESKTOPVERTRES = 117, DESKTOPHORZRES = 118;
  public const uint LEFTDOWN = 0x0002, LEFTUP = 0x0004;

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
  public static string CursorState() {
    var ci = new CURSORINFO(); ci.cbSize = Marshal.SizeOf(typeof(CURSORINFO));
    if (!GetCursorInfo(ref ci)) return "GetCursorInfo FAILED";
    // CURSOR_SHOWING = 1, CURSOR_SUPPRESSED = 2 (touch). Printed as the raw flag as well,
    // because "hidden" and "suppressed" are different states and only the number separates them.
    return (ci.flags == 1 ? "SHOWING" : ci.flags == 0 ? "hidden" : "flags " + ci.flags)
      + " (flags=" + ci.flags + ", hCursor=" + ci.hCursor.ToInt64() + ")";
  }
}
'@
Add-Type -AssemblyName System.Drawing

function Start-Show {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = (Join-Path $publish 'psss.scr')
  $psi.Arguments = '/s'
  $psi.WorkingDirectory = $publish
  $psi.UseShellExecute = $false
  [System.Diagnostics.Process]::Start($psi)
}
function Wait-Window([System.Diagnostics.Process]$p, [double]$max = 30) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $max) {
    $h = [Fx]::WindowOf([uint32]$p.Id, 'PsssScreensaverShow')
    if ($h -ne [IntPtr]::Zero) { return $sw.Elapsed.TotalSeconds }
    if ($p.HasExited) { return -1 }
    Start-Sleep -Milliseconds 5
  }
  return -1
}
function Send-Click {
  [Fx]::mouse_event([Fx]::LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 30
  [Fx]::mouse_event([Fx]::LEFTUP, 0, 0, 0, [IntPtr]::Zero)
}

if ($Case -eq 'cursor' -or $Case -eq 'both') {
  Write-Output '########## the cursor across a whole session ##########'
  Write-Output ("    BEFORE  {0}" -f [Fx]::CursorState())
  $p = Start-Show
  $t = Wait-Window $p
  if ($t -lt 0) { Write-Output '    VOID: no window appeared'; exit 2 }
  Start-Sleep -Seconds 6
  $during = [Fx]::CursorState()
  Write-Output ("    DURING  {0}   <- the calibration: 'SHOWING' here means this probe is BLIND" -f $during)
  Send-Click
  Start-Sleep -Seconds 3
  if ($p.HasExited) {
    Write-Output ("    exited with code {0} on its own (a clean exit, so RestoreCursor ran)" -f $p.ExitCode)
    Start-Sleep -Milliseconds 500
    Write-Output ("    AFTER   {0}" -f [Fx]::CursorState())
  } else {
    $p.Kill(); $p.WaitForExit()
    Write-Output '    VOID: it did not exit on its own, so the probe killed it and the AFTER reading'
    Write-Output '          would measure the kill rather than RestoreCursor. No verdict.'
    Write-Output ("    AFTER (a KILL, not a clean exit) {0}" -f [Fx]::CursorState())
  }
}

if ($Case -eq 'flash' -or $Case -eq 'both') {
  Write-Output '########## a bright frame between launch and the first animation frame ##########'
  $dc = [Fx]::GetDC([IntPtr]::Zero)
  $pw = [Fx]::GetDeviceCaps($dc, [Fx]::DESKTOPHORZRES)
  $ph = [Fx]::GetDeviceCaps($dc, [Fx]::DESKTOPVERTRES)
  [void][Fx]::ReleaseDC([IntPtr]::Zero, $dc)
  if ($pw -le 0) { Write-Output '    ABORT: no physical size (see capture.ps1 - never guess one)'; exit 2 }
  # ⚠️ A STRIP, NOT THE SCREEN, and the reason is the sampling rate: a full 2880x1800 capture plus
  # a downscale costs a few hundred ms, which would make the sampling interval coarser than the
  # thing being looked for. A white flash is full-screen by nature, so a band through the middle
  # sees it. It would NOT see a flash confined to one corner, which is not a failure mode WebView2
  # or WM_ERASEBKGND can produce.
  $stripH = 8
  $strip = New-Object System.Drawing.Bitmap $pw, $stripH
  $sg = [System.Drawing.Graphics]::FromImage($strip)
  $small = New-Object System.Drawing.Bitmap 96, 2
  Write-Output ("    sampling a {0}x{1} strip at y={2}, physical screen {0}x{3}" -f $pw, $stripH, [int]($ph/2), $ph)

  $p = Start-Show
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $samples = @()
  while ($sw.Elapsed.TotalSeconds -lt 6) {
    $sg.CopyFromScreen(0, [int]($ph / 2), 0, 0, (New-Object System.Drawing.Size $pw, $stripH))
    $g2 = [System.Drawing.Graphics]::FromImage($small)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $g2.DrawImage($strip, 0, 0, 96, 2)
    $g2.Dispose()
    $mx = 0; $sum = 0.0
    for ($y = 0; $y -lt 2; $y++) { for ($x = 0; $x -lt 96; $x++) {
      $c = $small.GetPixel($x, $y)
      $m = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
      if ($m -gt $mx) { $mx = $m }
      $sum += $m
    } }
    $samples += [pscustomobject]@{ T = $sw.Elapsed.TotalSeconds; Max = $mx; Mean = [Math]::Round($sum / 192, 1) }
    Start-Sleep -Milliseconds 60
  }
  $sg.Dispose(); $strip.Dispose(); $small.Dispose()

  # ⚠️ Reported as the WHOLE SERIES' extremes plus the brightest single sample, because "no flash"
  # is a claim about a maximum. A mean over the series would hide a one-sample spike, which is
  # precisely the event being looked for.
  $brightest = $samples | Sort-Object Mean -Descending | Select-Object -First 1
  Write-Output ("    {0} samples over {1:0.0}s, interval {2:0} ms" -f $samples.Count,
    $samples[-1].T, (1000 * $samples[-1].T / $samples.Count))
  Write-Output ("    brightest sample: t={0:0.00}s mean {1} max channel {2}" -f `
    $brightest.T, $brightest.Mean, $brightest.Max)
  Write-Output '    the first 12 samples:'
  $samples | Select-Object -First 12 | ForEach-Object {
    Write-Output ("      t={0:0.00}s  mean {1,5}  max {2,3}" -f $_.T, $_.Mean, $_.Max)
  }
  if (-not $p.HasExited) { $p.Kill(); $p.WaitForExit() }
}
