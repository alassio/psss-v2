# One case of the Phase 20.10 host probe: launch psss.scr with the given argument, wait,
# capture and measure the screen, optionally inject one input, wait again, and report the
# exit code. Every case in RUN-RECORD.md is a call to this script.
#
#   -ScrArgs '/c'         the argument string handed to the .scr (empty means none)
#
# ⚠️ THE SPELLING IS `-ScrArgs` AND THIS LINE SAID `-Args` UNTIL 2026-09-16, WHICH FAILS
# SILENTLY IN THE WORST POSSIBLE WAY: PowerShell binds `-Args` to nothing here (it is not a
# prefix of `ScrArgs`), the script runs with an EMPTY argument and exits 0 — and an empty
# argument means CONFIG by the contract, so `-Args '/c'` still LOOKED right while `-Args '/s'`
# would have measured config mode and called it show. `$Args` cannot be the parameter name
# because it is an automatic variable, which is how the mismatch got in.
#
# ⚠️ AND FROM GIT BASH THE VALUE IS MANGLED BEFORE POWERSHELL EVER SEES IT: MSYS rewrites
# `/c` to `C:/` and `/s` to `S:/`. Measured 2026-09-16. Both still reach the right MODE by
# accident (position 0 holds the letter, and the drive colon is read as the handle separator),
# so the trap is `/p` and `/c:<hwnd>`, where the handle is destroyed and the contract falls
# back to config. Prefix the command with `MSYS_NO_PATHCONV=1`, or write `//c` — both were
# measured to arrive as `/c`. In PowerShell proper there is nothing to work around.
#   -Settle <s>           seconds to wait before the capture (WebView2 first run is slow)
#   -Shot <name>          write probe/shot-<name>.png and measure it
#   -Then <key|click|move|nudge|moves|none>  the input injected after the capture
#
# ⚠️ THE THREE MOUSE CASES SEPARATE TWO REMEDIES THAT ONE CASE CANNOT, and until 2026-09-15
# there was only one and it was named as though it should exit. 20.6 has two independent
# reasons to not exit on a mouse move — a distance THRESHOLD (8 px of accumulated path) and
# immunity to the spurious FIRST move (which resamples the anchor and returns) — and a single
# case reading "STILL RUNNING" cannot say which one fired, or whether both are even present:
#
#   nudge   3 events, ~2 px path   -> must NOT exit. Tests the THRESHOLD.
#   move    1 event, 60 px         -> must NOT exit. Tests FIRST-MOVE IMMUNITY, and does it at
#                                     an amplitude far past the threshold, which is what proves
#                                     the immunity is per-EVENT rather than per-distance. A
#                                     `move` that exits means the first move is not immune.
#   moves   20 events, ~19 px path -> MUST exit. The only case that can fail if the threshold
#                                     is set so high that nothing reaches it.
#
# ⚠️ `move` NOT EXITING IS A PASS, and reading it as a defect is the trap: it was recorded as
# "the 60 px move did not exit" before the log was consulted, which is a sentence that sounds
# like a broken screensaver and describes a working one.
#   -After <s>            seconds to wait after the input before reading the exit code
#   -Dir <path>           working directory for the process (chooses which data files it sees)
#   -Shell                launch through ShellExecute, the way Explorer and Settings do
#
# ⚠️ THE LAUNCH ROUTE IS ITSELF A VARIABLE, AND IT COST ONE MISREAD CASE TO FIND OUT.
# Measured from the registry 2026-09-15: `HKCR\scrfile\shell\open\command` is `"%1" /S` and
# is the DEFAULT verb, so ShellExecute on a `.scr` — which is what Start-Process does unless
# told otherwise — REPLACES whatever arguments you passed with `/S`. The first `/c` case of
# this probe therefore ran in SHOW mode and looked like a config-mode pass. Every case
# except the explicitly-`-Shell` ones now launches with UseShellExecute = false.
# (`HKCR\scrfile\shell\config\command` is `"%1"` with NO argument, which is where 20.3's
# "no argument ⇒ config" rule comes from — measured, not recalled.)
param(
  [string]$ScrArgs = '',
  [double]$Settle = 14,
  [string]$Shot = '',
  [string]$Then = 'none',
  [double]$After = 3,
  [string]$Dir = '',
  [switch]$Shell
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scr = if ($Dir) { Join-Path $Dir 'psss.scr' } else {
  Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish\psss.scr'
}
$scr = (Resolve-Path $scr).Path
$workDir = Split-Path -Parent $scr

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $scr
$psi.Arguments = $ScrArgs
$psi.WorkingDirectory = $workDir
$psi.UseShellExecute = [bool]$Shell
$p = [System.Diagnostics.Process]::Start($psi)
Write-Output ("LAUNCHED  {0} '{1}'  shellExecute={2}  pid {3}" -f `
  (Split-Path -Leaf $scr), $ScrArgs, $psi.UseShellExecute, $p.Id)

Start-Sleep -Seconds $Settle
if ($p.HasExited) {
  Write-Output ("EXITED EARLY after {0}s with code {1}" -f $Settle, $p.ExitCode)
} else {
  Write-Output ("ALIVE after {0}s" -f $Settle)
}

if ($Shot -and -not $p.HasExited) {
  # ⚠️ A CHILD PROCESS, NOT `& capture.ps1`. `capture.ps1` compiles inline C# and that compile
  # resolves against whatever the CALLING session has already loaded, so dot-calling it makes
  # the measurement depend on the caller's history — see its own header. A fresh process means
  # every case in RUN-RECORD.md was measured by the same instrument in the same state.
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here 'capture.ps1') `
    -Out (Join-Path $here ("shot-{0}.png" -f $Shot))
}

switch ($Then) {
  'key'   { & (Join-Path $here 'input.ps1') -Key 0x41 }          # 'A'
  'move'  { & (Join-Path $here 'input.ps1') -MoveBy 60 }         # ONE event: the immune first move
  'nudge' { & (Join-Path $here 'input.ps1') -Nudge 3 }           # ~2 px of path after the first
  'moves' { & (Join-Path $here 'input.ps1') -Nudge 20 }          # ~19 px of path after the first
  'click' { & (Join-Path $here 'input.ps1') -Click }
  default { }
}

if ($Then -ne 'none') {
  Start-Sleep -Seconds $After
  if ($p.HasExited) {
    Write-Output ("EXITED after '{0}' with code {1}" -f $Then, $p.ExitCode)
  } else {
    Write-Output ("STILL RUNNING after '{0}'" -f $Then)
  }
}

if (-not $p.HasExited) {
  $p.Kill()
  $p.WaitForExit()
  Write-Output 'KILLED by the probe (it did not exit on its own)'
}
