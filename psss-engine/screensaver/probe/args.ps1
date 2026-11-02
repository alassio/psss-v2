# 20.3's argument contract, measured one form at a time.
#
# Each form is launched, given a short settle, killed, and the mode the host DECIDED is read
# back out of its own log line (`--- pid N args [X] -> Mode (how)`). Nothing here looks at
# the screen: the question is only "which of the three modes did the parser pick, and did it
# say why", and a screen capture cannot distinguish `/s` chosen from `/s` defaulted-to.
#
# ⚠️ EVERY LAUNCH HERE IS UseShellExecute = FALSE. Through ShellExecute the `.scr`
# association would replace the arguments with `/S` (see run.ps1's header) and this whole
# script would report `Show` nine times — a table of identical wrong answers that looks like
# a parser with one branch.
#
# ⚠️ `/p` WITHOUT A LIVE PARENT IS EXPECTED TO EXIT, not to hang: PreviewHost polls
# `IsWindow(parent)` and gives up when it goes away. A fabricated handle like 1234 is
# therefore a legitimate parse test and a dead end for the window — which is why the exit
# code is reported rather than treated as a failure.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scr = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish\psss.scr')).Path
$log = Join-Path $env:LOCALAPPDATA 'psss\screensaver\screensaver.log'

# The contract's nine forms. "" is the no-argument case, which the shell's `config` verb
# actually uses, so it is the most reachable of all of them.
$forms = @('/s', '-s', '/S', '/c', '-c', '', '/p 1234', '/p:1234', '--wat')

foreach ($form in $forms) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $scr
  $psi.Arguments = $form
  $psi.WorkingDirectory = Split-Path -Parent $scr
  $psi.UseShellExecute = $false
  $p = [System.Diagnostics.Process]::Start($psi)
  Start-Sleep -Seconds 3
  $exited = $p.HasExited
  $code = if ($exited) { $p.ExitCode } else { 'n/a' }
  if (-not $exited) { $p.Kill(); $p.WaitForExit() }

  # The host's own decision, found by pid so a stale line can never be read instead.
  $line = (Get-Content $log | Select-String -Pattern ("pid {0} " -f $p.Id) | Select-Object -Last 1)
  $decision = if ($line) { ($line.Line -split '--- ')[-1] } else { 'NO LOG LINE' }
  "{0,-10} exitedIn3s={1,-5} code={2,-4} {3}" -f "[$form]", $exited, $code, $decision
}
