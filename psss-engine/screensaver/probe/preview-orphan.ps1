# 20.7's leak, by the route `preview-host.ps1` cannot take: the parent PROCESS dies, rather
# than the parent WINDOW being closed.
#
# ⚠️ THIS SCRIPT EXISTS BECAUSE THE PROBE'S OWN CRASHES FOUND THE DEFECT. Two `/p` processes
# were still running when a build tried to overwrite `psss.scr` on 2026-09-15 (pids 33068 and
# 41408). Both were runs in which `preview-host.ps1` threw before reaching its `$form.Close()`
# section, so the form-owning PowerShell process TERMINATED with the window still up; both had
# logged `[preview] child of <hwnd> at 304x224`; and crucially NEITHER ever logged
# `[loop] ended, exit 0`, which every clean exit does. They outlived their parents by six and
# seventeen minutes and were still counting. Meanwhile every run that closed its form properly
# exited with code 0 in well under a second. So the `IsWindow` watchdog covers one of two
# routes, and the accident covered the other -- which is the whole reason to write the
# distinction down as an instrument instead of fixing what the accident happened to show.
#
# ⚠️ IT IS NOT AN ARTIFICIAL CASE. Nothing about `/p` promises the caller stays alive: the
# Screen Saver dialog can be killed, can crash, or can be closed by a shell restart, and in
# every one of those the preview process is left holding a GDI bitmap forever with nothing on
# screen to show it. That is the plan's own named risk for this step, and "found only in Task
# Manager" is exactly how it presented.
#
# What is measured, in order, because each answer changes what the next one means:
#   1. does the host exit when its parent process is killed, and how fast
#   2. is the parent HWND still a window afterwards (if it is, `IsWindow` cannot be the lifeline)
#   3. does the host's own child window still exist (if not, its window timer died with it,
#      and a window timer cannot be the lifeline either)
#
# ⚠️ NO NON-ASCII INSIDE A STRING LITERAL. See preview-host.ps1's header.
# ⚠️ AND NO `Add-Type -AssemblyName` ANYWHERE ABOVE THE INLINE COMPILE. See capture.ps1's.
param(
  [double]$Settle = 6,
  [double]$ExitWait = 12
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scr = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish\psss.scr')).Path

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Orphan {
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern IntPtr FindWindowExW(IntPtr parent, IntPtr after, string cls, string caption);
}
'@

# ⚠️ THE FORM LIVES IN A SEPARATE PROCESS SO THAT IT CAN BE KILLED WITHOUT KILLING THE
# MEASUREMENT. Hosting the form here and then killing this script would take the observer with
# the subject and leave nobody to read the answers -- which is precisely how the original
# leaks went unnoticed: the only witness died first.
$formScript = @'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$f = New-Object System.Windows.Forms.Form
$f.StartPosition = 'Manual'
$f.Location = New-Object System.Drawing.Point 260, 260
$f.ClientSize = New-Object System.Drawing.Size 152, 112
$f.BackColor = [System.Drawing.Color]::Magenta
$f.Show()
[System.Windows.Forms.Application]::DoEvents()
$f.Handle.ToInt64()
[Console]::Out.Flush()
while ($true) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 50 }
'@
$formFile = Join-Path $env:TEMP 'psss-orphan-parent.ps1'
Set-Content -LiteralPath $formFile -Value $formScript -Encoding UTF8

$psiForm = New-Object System.Diagnostics.ProcessStartInfo
$psiForm.FileName = 'powershell'
$psiForm.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$formFile`""
$psiForm.UseShellExecute = $false
$psiForm.RedirectStandardOutput = $true
$formProc = [System.Diagnostics.Process]::Start($psiForm)
$hwndLine = $formProc.StandardOutput.ReadLine()
$parent = [IntPtr][int64]$hwndLine
"PARENT process pid $($formProc.Id) owns hwnd $($parent.ToInt64())"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $scr
$psi.Arguments = "/p $($parent.ToInt64())"
$psi.WorkingDirectory = Split-Path -Parent $scr
$psi.UseShellExecute = $false
$host_ = [System.Diagnostics.Process]::Start($psi)
"LAUNCHED psss.scr /p $($parent.ToInt64())  pid $($host_.Id)"
Start-Sleep -Seconds $Settle

if ($host_.HasExited) {
  "EXITED EARLY with code $($host_.ExitCode) - gave up on a live parent, which is a defect"
  Stop-Process -Id $formProc.Id -Force
  exit 1
}

$child = [Orphan]::FindWindowExW($parent, [IntPtr]::Zero, 'PsssScreensaverPreview', $null)
"CHILD before the kill: hwnd $($child.ToInt64()) isWindow=$([Orphan]::IsWindow($child))"

"KILLING the parent process (Stop-Process -Force, i.e. TerminateProcess - no window teardown)"
Stop-Process -Id $formProc.Id -Force
$formProc.WaitForExit()

$sw = [System.Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt $ExitWait -and -not $host_.HasExited) { Start-Sleep -Milliseconds 100 }
$parentAlive = [Orphan]::IsWindow($parent)
$childAlive = [Orphan]::IsWindow($child)
$childParent = [Orphan]::GetParent($child)
"AFTER THE KILL: parent hwnd isWindow=$parentAlive, child hwnd isWindow=$childAlive, child's parent now $($childParent.ToInt64())"

if ($host_.HasExited) {
  "EXITED $([Math]::Round($sw.Elapsed.TotalSeconds, 2)) s after the parent process was killed, code $($host_.ExitCode)"
} else {
  # ⚠️ REPORTED AS A LEAK AND THEN KILLED. Leaving it running would break the next `build.bat`
  # with a file-lock error whose message names MSBuild rather than this probe, which is how
  # this defect first surfaced.
  "LEAKED: still running $ExitWait s after the parent process was killed"
  $host_.Kill(); $host_.WaitForExit()
  "killed by the probe"
}
Remove-Item -LiteralPath $formFile -ErrorAction SilentlyContinue
