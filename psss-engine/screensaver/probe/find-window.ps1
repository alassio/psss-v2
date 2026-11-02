# Diagnostic for grace.ps1's window-finding step, kept because the question it answers recurs:
# "is the window absent, or is my finder wrong?"
#
# ⚠️ IT EXISTS BECAUSE A NEGATIVE FROM `FindWindowW` WAS BRIEFLY READ AS A NEGATIVE ABOUT THE
# HOST. `grace.ps1` polled for `PsssScreensaverShow` every 5 ms for 40 s and never matched, while
# the host's own log showed the window created 0.09 s after the mode line and the animation was
# on screen the whole time. Two claims wearing the same "no window" wording. This script asserts
# the same thing two ways — a targeted `FindWindowW` and a full `EnumWindows` sweep — so a
# disagreement between them localises the fault to the finder rather than to the subject.
param(
  [double]$Settle = 4,
  [string]$Match = 'Psss'
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scr = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish\psss.scr')).Path

Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class Finder {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr FindWindowW(string cls, string name);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassNameW(IntPtr h, StringBuilder b, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowTextW(IntPtr h, StringBuilder b, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

  public static List<string> Sweep(uint wantPid) {
    var found = new List<string>();
    EnumWindows((h, p) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid != wantPid) return true;
      var cls = new StringBuilder(256); GetClassNameW(h, cls, cls.Capacity);
      var txt = new StringBuilder(256); GetWindowTextW(h, txt, txt.Capacity);
      found.Add(h.ToInt64() + "  class '" + cls + "'  title '" + txt + "'  visible=" + IsWindowVisible(h));
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $scr
$psi.Arguments = '/s'
$psi.WorkingDirectory = Split-Path -Parent $scr
$psi.UseShellExecute = $false
$p = [System.Diagnostics.Process]::Start($psi)
Write-Output ("LAUNCHED pid {0}; settling {1}s" -f $p.Id, $Settle)
Start-Sleep -Seconds $Settle

$byName = [Finder]::FindWindowW('PsssScreensaverShow', $null)
Write-Output ("FindWindowW('PsssScreensaverShow', null) -> {0}" -f $byName.ToInt64())
$byTitle = [Finder]::FindWindowW($null, 'psss')
Write-Output ("FindWindowW(null, 'psss')                 -> {0}" -f $byTitle.ToInt64())

Write-Output ("--- every top-level window owned by pid {0} ---" -f $p.Id)
$sweep = [Finder]::Sweep([uint32]$p.Id)
if ($sweep.Count -eq 0) { Write-Output '(none)' } else { $sweep | ForEach-Object { Write-Output "  $_" } }

if (-not $p.HasExited) { $p.Kill(); $p.WaitForExit() }
Write-Output ("exit code {0}" -f $p.ExitCode)
