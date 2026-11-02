# The one Phase 20.10 case `run.ps1` cannot express: input INSIDE 20.6's 700 ms grace period.
#
# ⚠️ THE GRACE CLOCK DOES NOT START WHEN THE PROCESS STARTS, AND THAT MISMATCH COST FOUR
# MIS-ATTRIBUTED CASES. `ScreensaverWindow.Start` sets `_startTick` immediately after
# `CreateWindowExW`, so the 700 ms is measured from the WINDOW, while `run.ps1 -Settle` measures
# from `Process.Start`. Between the two sits the whole startup of a self-contained single-file
# .NET app — extraction, runtime init, JIT — which is not a fixed cost and is far longer than the
# grace period itself. Four cases were run through `run.ps1` at 0.2 s, 0.3 s, 0.35 s and 0.5 s of
# PROCESS time; all four left the host running and NONE produced a `[show] ignoring` line. Read
# as grace-period passes they would have been four confirmations of a path that had not executed
# once: the input was injected before any window existed, so it went to the shell that launched
# the probe. ⚠️ A "still running" result is the SAME OBSERVATION for "the grace ignored it" and
# for "nothing received it", which is why this file waits for the window instead of for a clock.
#
# ⚠️ AND THE CONTROL INJECTION IS NOT OPTIONAL — it is what makes the first result mean anything.
# Landing inside the grace can only ever produce a negative (no exit), and a negative from an
# injection route that was never shown to work is worth nothing. So the same route, from the same
# script, in the same run, injects a second time AFTER the grace has expired. Then:
#
#     early ignored + late exits  -> the grace path executed and releases. The only pass.
#     early ignored + late ignored-> the injection never reached the handler. Says nothing
#                                    about the grace, and is the shape the four earlier cases had.
#     early EXITS                 -> the grace does not hold. A real defect in 20.6.
#
# ⚠️ The log is the primary instrument here, not the exit code. `[show] ignoring … ms into the
# 700 ms grace period` prints the MEASURED elapsed, so the line proves both that the message
# arrived and that it was inside the window — a bare "did not exit" proves neither.
#
#   -Wait <s>     how long to poll for the show window before giving up
#   -Late <s>     when to inject the control, in seconds after the window appeared
param(
  [double]$Wait = 40,
  [double]$Late = 3
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scr = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish\psss.scr')).Path
$log = Join-Path $env:LOCALAPPDATA 'Psss\Screensaver\screensaver.log'

# ⚠️ Compiled BEFORE anything else loads an assembly, per capture.ps1's header: PS 5.1's inline
# Add-Type resolves its references against whatever the session has already loaded, and a compile
# after `Add-Type -AssemblyName System.Windows.Forms` throws BadImageFormatException.
# ⚠️ THE WINDOW IS FOUND BY ENUMERATING THIS PID'S WINDOWS, NOT BY `FindWindowW`, AND THE FIRST
# VERSION OF THIS SCRIPT USED THE LATTER AND REPORTED "no PsssScreensaverShow window after 40s"
# WHILE THE ANIMATION WAS ON SCREEN. Measured 2026-09-15 with `find-window.ps1`, which asserts it
# both ways in one run:
#
#     FindWindowW('PsssScreensaverShow', null) -> 0
#     FindWindowW(null, 'psss')                -> 0
#     EnumWindows over the pid: 5703726  class 'PsssScreensaverShow'  title 'psss'  visible=True
#
# The same P/Invoke finds `Shell_TrayWnd` (65814) and fails on `Progman` too, so it is not a
# broken declaration and not a marshalling fault — some classes are simply not reachable this way
# on this machine, and the mechanism is NOT established. That is recorded as unexplained rather
# than explained wrongly: what the probe needs is a working finder, and the sweep is one.
#
# ⚠️ AND THE PID FILTER IS AN IMPROVEMENT, NOT A CONSOLATION. A class-name search matches ANY
# process's window of that class, including a leaked host from an earlier case — and this phase
# has already produced two immortal processes that nothing on screen revealed. A finder that can
# lock onto the wrong subject would have made every later measurement in this file untrustworthy.
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class Grace {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);

  // ⚠️ The delegate is created inside this call and used before it returns, so no rooting field
  // is needed here — unlike the host's WndProc, which must outlive the call that installs it.
  public static IntPtr ShowWindowOf(uint wantPid, string wantClass) {
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
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassNameW(IntPtr h, System.Text.StringBuilder buf, int max);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, IntPtr extra);
  public const uint LEFTDOWN = 0x0002;
  public const uint LEFTUP = 0x0004;
}
'@

function Send-Click {
  [Grace]::mouse_event([Grace]::LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 30
  [Grace]::mouse_event([Grace]::LEFTUP, 0, 0, 0, [IntPtr]::Zero)
}

function Get-ForegroundClass {
  # ⚠️ Reported at every injection because it is the discriminator the four earlier cases
  # lacked. A click goes to the window under the cursor rather than to the focused one, so the
  # foreground window does not have to be ours for the case to be valid — but if it is the
  # shell that launched this probe AND nothing was logged, the input's destination is known
  # rather than guessed.
  $h = [Grace]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 256
  [void][Grace]::GetClassNameW($h, $sb, $sb.Capacity)
  "{0} ({1})" -f $sb.ToString(), $h.ToInt64()
}

# The line count before the run, so the grep below reads only THIS run's lines. The log is
# append-only with a size cap that deletes rather than truncates, so a stale `ignoring` line
# from another sitting would otherwise read as a pass.
$before = if (Test-Path $log) { (Get-Content -LiteralPath $log).Count } else { 0 }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $scr
$psi.Arguments = '/s'
$psi.WorkingDirectory = Split-Path -Parent $scr
$psi.UseShellExecute = $false
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$p = [System.Diagnostics.Process]::Start($psi)
Write-Output ("LAUNCHED  psss.scr '/s'  pid {0}" -f $p.Id)

$hwnd = [IntPtr]::Zero
while ($sw.Elapsed.TotalSeconds -lt $Wait) {
  $hwnd = [Grace]::ShowWindowOf([uint32]$p.Id, 'PsssScreensaverShow')
  if ($hwnd -ne [IntPtr]::Zero) { break }
  if ($p.HasExited) {
    Write-Output ("ABORT: the host exited with code {0} before any window appeared" -f $p.ExitCode)
    exit 2
  }
  Start-Sleep -Milliseconds 5
}
if ($hwnd -eq [IntPtr]::Zero) {
  Write-Output ("ABORT: no PsssScreensaverShow window after {0}s" -f $Wait)
  if (-not $p.HasExited) { $p.Kill(); $p.WaitForExit() }
  exit 2
}
$appeared = $sw.Elapsed.TotalSeconds
Write-Output ("WINDOW    appeared at {0:0.000}s from launch, visible={1}  <- this delay is why a" -f `
  $appeared, [Grace]::IsWindowVisible($hwnd))
Write-Output   "                     fixed -Settle of 0.2..0.5s could not reach the grace period"

Send-Click
$at = $sw.Elapsed.TotalSeconds
Write-Output ("EARLY     clicked at {0:0.000}s from launch = {1:0} ms after the window; foreground {2}" -f `
  $at, (($at - $appeared) * 1000), (Get-ForegroundClass))

Start-Sleep -Milliseconds 400
# ⚠️ Not an inline `if (...) {...} else {...}` inside the format argument: that is PowerShell 7
# syntax and Windows PowerShell 5.1 — which is what runs `.ps1` by default on this machine —
# rejects it at PARSE time, so the whole probe would fail before launching anything.
$earlyOutcome = if ($p.HasExited) { "EXITED with code $($p.ExitCode)" } else { 'still running' }
Write-Output ("          {0} after the early click" -f $earlyOutcome)

if (-not $p.HasExited) {
  Start-Sleep -Seconds $Late
  Send-Click
  $at2 = $sw.Elapsed.TotalSeconds
  Write-Output ("LATE      clicked at {0:0.000}s from launch = {1:0.0} s after the window; foreground {2}" -f `
    $at2, ($at2 - $appeared), (Get-ForegroundClass))
  Start-Sleep -Seconds 2
  $lateOutcome = if ($p.HasExited) { "EXITED with code $($p.ExitCode)" } else { 'STILL RUNNING' }
  Write-Output ("          {0} after the late click" -f $lateOutcome)
}

if (-not $p.HasExited) {
  $p.Kill(); $p.WaitForExit()
  Write-Output 'KILLED by the probe'
}

Write-Output '--- this run''s log lines ---'
$lines = Get-Content -LiteralPath $log
if ($lines.Count -gt $before) { $lines[$before..($lines.Count - 1)] }
