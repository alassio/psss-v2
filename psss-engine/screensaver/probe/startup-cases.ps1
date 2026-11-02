# The three Phase 20.10 cases that are decided before a frame is ever drawn: the `/s` mutex, a
# missing reel file (WARN) and a missing preset file (FATAL). All three are read off the exit code
# and the log rather than off the screen, because all three are ABSENCES — there is nothing to
# photograph.
#
#   -Case mutex      two `/s` hosts at once; the second must log the mutex line and exit 0
#   -Case noreels    a data directory with no psss_reels.json; must warn and keep playing
#   -Case nopresets  a data directory with no psss_presets.json; must exit 1 with a log line
#   -Case all        all three in order
#
# ⚠️ THE TWO FILE CASES DEPEND ON A PRECONDITION THAT IS NOT VISIBLE IN THEM, AND IF IT EVER STOPS
# HOLDING THEY BOTH PASS FOR THE WRONG REASON. `PayloadFiles.DataDirectories()` searches the
# executable's directory and THEN `%LOCALAPPDATA%\psss\screensaver\data`, so a copy of either file
# in the second location would satisfy the request that this case exists to starve — and the case
# would report "found on disk" while claiming to test "missing". Verified absent 2026-09-15
# (`ls` on that path: No such file or directory), and the script asserts it below rather than
# trusting that note, because the host itself creates directories under that root.
#
# ⚠️ AND THE MISSING FILE IS ACHIEVED BY COPYING A PARTIAL TREE, NEVER BY DELETING FROM THE
# PUBLISH DIRECTORY. Deleting there would make the next unrelated case in the run record measure a
# broken install without saying so, and `build.bat` would restore it at some unpredictable later
# time — a defect that appears and disappears with the build rather than with the case.
param(
  [ValidateSet('mutex', 'noreels', 'nopresets', 'all')][string]$Case = 'all'
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$publish = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish')).Path
$log = Join-Path $env:LOCALAPPDATA 'psss\screensaver\screensaver.log'
$dataDir = Join-Path $env:LOCALAPPDATA 'psss\screensaver\data'

function Get-LogMark {
  if (Test-Path $log) { (Get-Content -LiteralPath $log).Count } else { 0 }
}
function Show-NewLog([int]$mark) {
  $lines = Get-Content -LiteralPath $log
  if ($lines.Count -gt $mark) { $lines[$mark..($lines.Count - 1)] | ForEach-Object { "    $_" } }
}
function Start-Host([string]$dir, [string]$scrArgs) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = (Join-Path $dir 'psss.scr')
  $psi.Arguments = $scrArgs
  $psi.WorkingDirectory = $dir
  $psi.UseShellExecute = $false
  [System.Diagnostics.Process]::Start($psi)
}

# ⚠️ A PARTIAL COPY, and the copy list is written OUT rather than being "everything except X":
# an exclusion silently starts copying any file a future build adds, which for this phase means
# the case would stop being the case it is named after.
function New-PartialTree([string]$name, [string[]]$files) {
  $dir = Join-Path $env:TEMP $name
  if (Test-Path $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
  New-Item -ItemType Directory -Path $dir | Out-Null
  foreach ($f in $files) { Copy-Item -LiteralPath (Join-Path $publish $f) -Destination $dir }
  # ⚠️ `Write-Host`, NOT `Write-Output`, and this cost one aborted case. A PowerShell function
  # returns EVERYTHING it writes to the success stream, so a progress line here becomes part of
  # the return value: the caller received a two-element array and `Join-Path "    tree C:..."`
  # failed with `DriveNotFoundException`, an error that names a drive and reads like a broken
  # path rather than like a function returning too much.
  Write-Host ("    tree {0} contains: {1}" -f $dir, ((Get-ChildItem $dir | ForEach-Object Name) -join ', '))
  $dir
}

if ($Case -in @('noreels', 'nopresets', 'all')) {
  if (Test-Path $dataDir) {
    Write-Output ("PRECONDITION FAILED: {0} exists; a file there would rescue the 'missing' cases" -f $dataDir)
    Get-ChildItem $dataDir | ForEach-Object { Write-Output ("    holds {0}" -f $_.Name) }
    exit 2
  }
  Write-Output ("PRECONDITION ok: {0} does not exist, so the exe directory is the only source" -f $dataDir)
}

if ($Case -eq 'mutex' -or $Case -eq 'all') {
  Write-Output '########## /s twice: the named mutex ##########'
  $mark = Get-LogMark
  $a = Start-Host $publish '/s'
  Write-Output ("    first  pid {0}" -f $a.Id)
  Start-Sleep -Seconds 6
  $b = Start-Host $publish '/s'
  Write-Output ("    second pid {0}" -f $b.Id)
  Start-Sleep -Seconds 4
  # ⚠️ The SECOND host is the subject and the FIRST must still be alive for the case to mean
  # anything: a second instance exiting 0 while the first had already gone would be the mutex
  # doing nothing at all, reported as a pass.
  $firstState = if ($a.HasExited) { "EXITED with code $($a.ExitCode) -- THE CASE IS VOID" } else { 'still running (required)' }
  $secondState = if ($b.HasExited) { "exited with code $($b.ExitCode)" } else { 'STILL RUNNING -- two savers are stacked' }
  Write-Output ("    first  {0}" -f $firstState)
  Write-Output ("    second {0}" -f $secondState)
  foreach ($proc in @($b, $a)) { if (-not $proc.HasExited) { $proc.Kill(); $proc.WaitForExit() } }
  # ⚠️ Only the `--- pid` header line names a pid, so two concurrent hosts interleave in one log
  # with no way to attribute the rest. That is fine here (the second host writes two lines and
  # then exits) and is recorded because it is NOT fine in general.
  Write-Output '    --- log ---'
  Show-NewLog $mark
}

if ($Case -eq 'noreels' -or $Case -eq 'all') {
  Write-Output '########## /s with no psss_reels.json: WARN, and it keeps playing ##########'
  $dir = New-PartialTree 'psss-probe-noreels' @('psss.scr', 'psss_presets.json')
  $mark = Get-LogMark
  $p = Start-Host $dir '/s'
  Start-Sleep -Seconds 12
  $state = if ($p.HasExited) { "EXITED with code $($p.ExitCode) -- a missing reel file must NOT be fatal" } else { 'still running (required)' }
  Write-Output ("    {0}" -f $state)
  if (-not $p.HasExited) { $p.Kill(); $p.WaitForExit() }
  Write-Output '    --- log ---'
  Show-NewLog $mark
}

if ($Case -eq 'nopresets' -or $Case -eq 'all') {
  Write-Output '########## /s with no psss_presets.json: FATAL, exit 1 ##########'
  $dir = New-PartialTree 'psss-probe-nopresets' @('psss.scr', 'psss_reels.json')
  $mark = Get-LogMark
  $p = Start-Host $dir '/s'
  Start-Sleep -Seconds 12
  $state = if ($p.HasExited) { "exited with code $($p.ExitCode) (1 required)" } else { 'STILL RUNNING -- a fatal that does not exit is a black screen' }
  Write-Output ("    {0}" -f $state)
  if (-not $p.HasExited) { $p.Kill(); $p.WaitForExit() }
  Write-Output '    --- log ---'
  Show-NewLog $mark
}
