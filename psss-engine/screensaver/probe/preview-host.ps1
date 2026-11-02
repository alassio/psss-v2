# 20.7 with a REAL parent window: parenting, painting, scaling, and the watchdog's cleanup.
#
# Stands in for the Screen Saver dialog by creating an ordinary window at roughly the size
# Settings uses for its thumbnail (152x112 CLIENT), handing its HWND to `psss.scr /p <hwnd>`,
# measuring what actually appears inside that client area, and then DESTROYING IT to see
# whether the child process notices and exits.
#
# ⚠️ `-Awareness` IS THE POINT OF THIS SCRIPT'S SECOND REVISION, NOT AN OPTION. The first run
# (2026-09-15) captured the parent's client area as pure magenta while the host's own log said
# `[preview] child of <hwnd> at 304x224` and `preview.png decoded at 608x448` -- a window
# created, parented, sized and fed a bitmap, showing nothing. The accusation available at that
# point was MIXED-DPI HOSTING: a DPI-unaware parent (this script, by default) hosting a
# PerMonitorV2 child (the host, by manifest) is the one configuration Windows does not
# composite unless the PARENT's thread has opted in with
# `SetThreadDpiHostingBehavior(DPI_HOSTING_BEHAVIOR_MIXED)`. That is a claim about the PROBE,
# so the probe has to be able to falsify it: run it `-Awareness pmv2` and the two processes
# share a context, and if the child paints then, the magenta was this script's own doing.
# ⚠️ AND BOTH ANSWERS ARE FINDINGS. `unaware` is not an artificial configuration to be
# discarded once the fix lands -- the host does not choose its parent, and a parent in a
# different context is exactly what it must survive. Keep measuring BOTH.
#
# ⚠️ THE CHILD'S WM_PAINT IS NOT DELIVERED THROUGH THIS PROCESS'S LOOP, and an earlier version
# of this header said it was. Messages go to the thread that OWNS the window, so the preview
# child's WM_PAINT is dispatched by the host's own `RunLoop` and the DoEvents pump below cannot
# starve it. The pump is still required, for two reasons that are not that one: this form must
# paint its own background (an unpainted window is not magenta, it is whatever was behind it,
# which would make the discriminator below meaningless), and a window whose thread stops
# pumping is declared hung and ghosted by DWM.
#
# ⚠️ AND DESTROYING THE PARENT IS THE HALF THAT CANNOT BE SEEN. A leaked `/p` process holds a
# GDI bitmap and shows nothing on screen -- it is found only in Task Manager, which is why the
# plan lists it as a risk in its own right. This script's last section is the only place in the
# probe where that is measured; it caught a real leak on 2026-09-15 (a bare `return` in
# `PreviewHost.Start` when `GetClientRect` failed, which left `RunLoop` blocked forever).
#
# ⚠️ NO NON-ASCII INSIDE A STRING LITERAL ANYWHERE BELOW. Windows PowerShell 5.1 decodes a
# BOM-less file as the ANSI code page; the BOM these scripts now carry fixes that, but an
# em dash in a literal is one lost BOM away from a parse error, and a parse error in a probe
# reads as a broken host. Comments are safe because they are never evaluated.
param(
  [ValidateSet('unaware', 'pmv2')][string]$Awareness = 'unaware',
  [double]$Settle = 8,
  [double]$ExitWait = 4
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scr = (Resolve-Path (Join-Path $here '..\bin\x64\Release\net8.0-windows\win-x64\publish\psss.scr')).Path

# ⚠️ THIS BLOCK RUNS BEFORE WinForms IS LOADED AND BEFORE ANY WINDOW EXISTS. Process DPI
# awareness can only be set while the process has never had a top-level window or a DC, so
# moving the Add-Type of System.Windows.Forms above this would make `-Awareness pmv2` fail
# silently and the run would report the unaware result under the aware label.
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Probe {
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
  [DllImport("gdi32.dll")] public static extern int GetDeviceCaps(IntPtr dc, int index);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool GetClientRect(IntPtr hwnd, out RECT r);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool ClientToScreen(IntPtr hwnd, ref POINT p);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern IntPtr FindWindowExW(IntPtr parent, IntPtr after, string cls, string caption);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool GetWindowRect(IntPtr hwnd, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowLongW(IntPtr hwnd, int index);
  public static readonly IntPtr PMV2 = new IntPtr(-4);
  public const int HORZRES = 8, DESKTOPHORZRES = 118, DESKTOPVERTRES = 117;
  public const int GWL_STYLE = -16;
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
'@

if ($Awareness -eq 'pmv2') {
  $promoted = [Probe]::SetProcessDpiAwarenessContext([Probe]::PMV2)
  "AWARENESS requested pmv2, SetProcessDpiAwarenessContext returned $promoted"
  if (-not $promoted) {
    # No silent degradation: reporting the unaware result under the aware label is the one
    # outcome that would make the discriminator lie in the direction of the hypothesis.
    "ABORTED - could not promote this process, so the mixed-DPI variable cannot be controlled"
    exit 2
  }
} else {
  "AWARENESS unaware (the default), which is the MIXED-DPI case against a PerMonitorV2 host"
}

# The virtualization factor of THIS process, measured rather than assumed: 1 when aware, 2 on
# this 200 % display when not. Every coordinate this script reads back from Win32 is in the
# process's own context, and the screen capture is in physical pixels, so the crop below needs
# exactly this number.
$dc = [Probe]::GetDC([IntPtr]::Zero)
$logicalW = [Probe]::GetDeviceCaps($dc, [Probe]::HORZRES)
$physicalW = [Probe]::GetDeviceCaps($dc, [Probe]::DESKTOPHORZRES)
[void][Probe]::ReleaseDC([IntPtr]::Zero, $dc)
$scale = if ($logicalW -gt 0) { [double]$physicalW / $logicalW } else { 1.0 }
"SCALE this process sees $logicalW px wide, the screen is $physicalW px wide, factor $scale"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'stand-in for the Screen Saver dialog'
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point 200, 200
# ClientSize, not Size: the preview area is a CLIENT rect, and the host reads it with
# GetClientRect -- asking for a 152x112 outer size would hand the child a smaller area than
# Settings does and quietly change what is being scaled.
$form.ClientSize = New-Object System.Drawing.Size 152, 112
$form.BackColor = [System.Drawing.Color]::Magenta   # any leftover parent pixel is obvious
$form.Show()
[System.Windows.Forms.Application]::DoEvents()
$hwnd = $form.Handle
"PARENT hwnd $($hwnd.ToInt64()) client $($form.ClientSize.Width)x$($form.ClientSize.Height) at $($form.Location)"

# The client area in PHYSICAL screen pixels, which is what the capture will be measured in.
$origin = New-Object 'Probe+POINT'
$cr = New-Object 'Probe+RECT'
[void][Probe]::ClientToScreen($hwnd, [ref]$origin)
[void][Probe]::GetClientRect($hwnd, [ref]$cr)
$cx = [int][Math]::Round($origin.X * $scale); $cy = [int][Math]::Round($origin.Y * $scale)
$cw = [int][Math]::Round(($cr.R - $cr.L) * $scale); $ch = [int][Math]::Round(($cr.B - $cr.T) * $scale)
"CLIENT in physical screen pixels: ${cx},${cy} ${cw}x${ch}"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $scr
$psi.Arguments = "/p $($hwnd.ToInt64())"
$psi.WorkingDirectory = Split-Path -Parent $scr
$psi.UseShellExecute = $false
$p = [System.Diagnostics.Process]::Start($psi)
"LAUNCHED psss.scr /p $($hwnd.ToInt64())  pid $($p.Id)"

$deadline = (Get-Date).AddSeconds($Settle)
while ((Get-Date) -lt $deadline) {
  [System.Windows.Forms.Application]::DoEvents()
  Start-Sleep -Milliseconds 50
}

if ($p.HasExited) {
  "EXITED EARLY with code $($p.ExitCode) - the child gave up on a LIVE parent, which is a defect"
} else {
  "ALIVE with the parent up, as it should be"

  # ⚠️ THE WINDOW STATE IS READ BEFORE THE PIXELS, BECAUSE IT SPLITS THE MAGENTA IN TWO.
  # A blank client area has two completely different causes and one appearance: the child
  # exists and is visible but painted nothing (a `Paint()` defect, ours), or the child exists
  # and is not composited (a DPI-hosting problem, the parent's context). Only this line
  # distinguishes them, and going straight to the capture is what left the first run with a
  # hypothesis instead of a localisation.
  $child = [Probe]::FindWindowExW($hwnd, [IntPtr]::Zero, 'PsssScreensaverPreview', $null)
  if ($child -eq [IntPtr]::Zero) {
    "CHILD not found under this parent by class name - the host never parented it here"
  } else {
    $wr = New-Object 'Probe+RECT'
    [void][Probe]::GetWindowRect($child, [ref]$wr)
    $style = [Probe]::GetWindowLongW($child, [Probe]::GWL_STYLE)
    $visible = [Probe]::IsWindowVisible($child)
    "CHILD hwnd $($child.ToInt64()) visible=$visible style=0x$($style.ToString('X8')) rect $($wr.L),$($wr.T) $($wr.R - $wr.L)x$($wr.B - $wr.T) (in THIS process's context)"
  }

  # ⚠️ A CHILD PROCESS, NOT `& capture.ps1`. Measured 2026-09-15: dot-calling it from here
  # throws BadImageFormatException out of its `Add-Type`, because this script has already
  # loaded System.Windows.Forms into the session and PS 5.1's inline-C# compiler resolves its
  # references against that. The failure names an assembly and reads like a broken machine
  # rather than a caller-state problem. A fresh process also means the instrument measures
  # the same way whoever calls it.
  $cap = Join-Path $here 'capture.ps1'
  $shot = Join-Path $here "shot-preview-$Awareness.png"
  & powershell -NoProfile -ExecutionPolicy Bypass -File $cap -Out $shot

  # ⚠️ MAGENTA IS THE MEASUREMENT, NOT "lit". The preview's own content is dark and on black,
  # so a lit-fraction cannot tell an unpainted parent from a legitimately dark thumbnail --
  # which is precisely why the parent is a colour that the payload cannot produce. The
  # question this answers is "how much of the area the child was given still belongs to the
  # parent", and the only two honest outcomes are ~100 % (nothing composited) and ~0 %.
  $full = New-Object System.Drawing.Bitmap $shot
  $crop = New-Object System.Drawing.Bitmap $cw, $ch
  $gc = [System.Drawing.Graphics]::FromImage($crop)
  $gc.DrawImage($full, (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch),
                       (New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch),
                       [System.Drawing.GraphicsUnit]::Pixel)
  $gc.Dispose()
  $cropOut = Join-Path $here "shot-preview-$Awareness-client.png"
  $crop.Save($cropOut, [System.Drawing.Imaging.ImageFormat]::Png)

  $mag = 0; $lit = 0; $n = 0; $maxCh = 0
  for ($y = 0; $y -lt $ch; $y += 2) {
    for ($x = 0; $x -lt $cw; $x += 2) {
      $px = $crop.GetPixel($x, $y)
      $n++
      if ($px.R -gt 200 -and $px.B -gt 200 -and $px.G -lt 60) { $mag++ }
      $m = [Math]::Max($px.R, [Math]::Max($px.G, $px.B))
      if ($m -gt $maxCh) { $maxCh = $m }
      if ($m -gt 8) { $lit++ }
    }
  }
  $crop.Dispose(); $full.Dispose()
  $magPct = [Math]::Round(100.0 * $mag / $n, 2)
  $litPct = [Math]::Round(100.0 * $lit / $n, 2)
  "CLIENT AREA -> $cropOut : magenta $magPct%, lit $litPct%, max channel $maxCh over $n sampled pixels"
  if ($magPct -gt 50) {
    "VERDICT the parent still owns its client area - the child is not compositing"
  } elseif ($litPct -lt 2) {
    "VERDICT the child owns the area but it is black - a Paint() or bitmap problem, not hosting"
  } else {
    "VERDICT the child painted the thumbnail"
  }
}

# The half nothing on screen can show: Settings closing its dropdown.
"DESTROYING the parent window"
$form.Close()
$form.Dispose()
$deadline = (Get-Date).AddSeconds($ExitWait)
while ((Get-Date) -lt $deadline -and -not $p.HasExited) {
  [System.Windows.Forms.Application]::DoEvents()
  Start-Sleep -Milliseconds 50
}
if ($p.HasExited) {
  "EXITED after the parent was destroyed, code $($p.ExitCode) - the IsWindow watchdog worked"
} else {
  $p.Kill(); $p.WaitForExit()
  "LEAKED: still running $ExitWait s after the parent was destroyed - killed by the probe"
}
