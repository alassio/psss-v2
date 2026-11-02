# Screen capture + pixel measurement for the Phase 20.10 host probe.
#
# ⚠️ A CLEAN LOG IS NOT EVIDENCE THE FRAME IS NOT BLACK. That is the engine's own rule and
# the reason 19.12a measured "24.5 % lit, max channel 255" rather than reporting "it looked
# fine". A GL failure inside the host presents as a black screen with a clean log, so the
# only honest confirmation of show mode is a pixel measurement of the primary monitor while
# the reel is playing.
#
# ⚠️ THE CAPTURE SIZE MUST BE THE PHYSICAL ONE, NEVER `Screen.PrimaryScreen`, AND GETTING IT
# WRONG PRODUCED A PLAUSIBLE FIGURE RATHER THAN AN ERROR. Measured 2026-09-15: powershell.exe
# runs DPI-VIRTUALIZED, and on this 200 % display `Screen.PrimaryScreen.Bounds` and
# `GetDeviceCaps(HORZRES)` both report 1440x900 while the screen is really 2880x1800.
# `Graphics.CopyFromScreen` BitBlts the SCREEN DC and therefore works in PHYSICAL pixels -- so
# a 1440x900 request captured the TOP-LEFT QUARTER, and every statistic derived from it had a
# quarter-screen basis while claiming a full-screen one. It read as a real finding twice: show
# mode's "lit %" was computed over one quarter, and the config window's Lab panel -- which
# lives on the right of a 2800 px window -- was outside the crop, which read as "?tab=reel does
# not work in the host" when the host log proves it does. This is the DPI trap of
# ConfigWindow.cs, in the instrument instead of the host.
#
# ⚠️ IT IS VIRTUALIZED BY DEFAULT, NOT BY MANIFEST -- an earlier revision of this header
# asserted the opposite ("its manifest is system-aware, so `SetProcessDpiAwarenessContext`
# cannot rescue it"), which was an ASSUMPTION written in the voice of a measurement. Measured
# 2026-09-15: `SetProcessDpiAwarenessContext(PER_MONITOR_AWARE_V2)` returns TRUE from a fresh
# `powershell -NoProfile`, after which HORZRES reads 2880 and `Screen.PrimaryScreen.Bounds`
# reads 2880x1800 in the same process. That matters beyond this file: it is what lets
# `preview-host.ps1` choose its own DPI context and so put the mixed-DPI hypothesis on a
# switch. This script does NOT promote itself -- it must keep measuring the SCREEN, and reading
# the physical size from a named source is correct in either context -- but nothing about it
# depends on the promotion being impossible.
#
# ⚠️ AND THE FIRST REPAIR HAD THE SAME DEFECT ONE LAYER DOWN: a silent `if ($pw -le 0)`
# fallback to the virtualized size. When `Add-Type` failed (a transient
# UnauthorizedAccessException on its temp DLL -- Defender scanning it mid-write), the script
# printed "physical 1440x900 (this process sees 1440x900)", which is SELF-CONSISTENT and
# completely wrong. A fallback that cannot be distinguished from a success is worse than no
# fallback: it launders a failed measurement into a quoted figure. Hence the rule below --
# ⚠️ EVERY SOURCE NAMES ITSELF IN THE OUTPUT, AND NO SOURCE AT ALL MEANS ABORT, NOT GUESS.
# ⚠️ AND "NAMES ITSELF" INCLUDES NAMING ITS OWN FAILURE. The WMI source's `catch` was empty
# until 2026-09-15, so when BOTH sources failed the run printed one NOTE about the source that
# does report and nothing at all about the source that had been described as the reliable one
# -- reading as a single fragile fallback rather than as the total loss it was. An empty catch
# in an instrument is the same defect as a silent fallback, one level quieter.
param(
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$LitThreshold = 8
)

$sources = @()

# ⚠️ SOURCE 1 IS COMPILED BEFORE ANY `-AssemblyName` LOAD, AND THAT FIXED ONE DEFECT AND
# REVEALED A SECOND -- it did NOT make this source work. Measured 2026-09-15: with
# `System.Windows.Forms` already loaded into the session, PS 5.1's inline C# compiler resolves
# this snippet's references against the loaded set and fails with an exception that NAMES AN
# ASSEMBLY, so it reads as a broken machine rather than a caller-ordering problem.
# `preview-host.ps1` already carried a note about that mechanism when DOT-CALLING this script,
# and the conclusion drawn there -- "call it in a fresh process" -- did not cure it, because
# the offending load was INSIDE this file, five lines above the compile. Compiling first is the
# only ordering that is correct from every caller.
# ⚠️ AFTER THE REORDER THE EXCEPTION CHANGED RATHER THAN DISAPPEARED: `UnauthorizedAccessException`
# on `%TEMP%\*.dll`. That is a SECOND, independent failure that the first one was masking, and
# on this machine it is the live one -- so `Add-Type` is unavailable here and Source 2 carries
# every run. Do not read the reorder as having repaired this source; read it as having stopped
# one cause from hiding another. The reason the script still measures correctly is that it has
# two INDEPENDENT sources and reports which one it used, not that either is dependable.
#
# GetDeviceCaps(DESKTOPHORZRES) reports the physical size even from a virtualized process,
# which is exactly the property wanted here.
try {
  if (-not ('Caps' -as [type])) {
    Add-Type -ErrorAction Stop @'
using System;
using System.Runtime.InteropServices;
public static class Caps {
  [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
  [DllImport("gdi32.dll")] public static extern int GetDeviceCaps(IntPtr dc, int index);
  public const int DESKTOPVERTRES = 117;
  public const int DESKTOPHORZRES = 118;
}
'@
  }
  $dc = [Caps]::GetDC([IntPtr]::Zero)
  $w = [Caps]::GetDeviceCaps($dc, [Caps]::DESKTOPHORZRES)
  $h = [Caps]::GetDeviceCaps($dc, [Caps]::DESKTOPVERTRES)
  [void][Caps]::ReleaseDC([IntPtr]::Zero, $dc)
  if ($w -gt 0 -and $h -gt 0) {
    $sources += [pscustomobject]@{ Name = 'GetDeviceCaps(DESKTOP*RES)'; W = $w; H = $h }
  } else {
    "NOTE  GetDeviceCaps returned $($w)x$($h), which is not usable"
  }
} catch {
  "NOTE  GetDeviceCaps source unavailable: $($_.Exception.GetType().Name): $($_.Exception.Message)"
}

# Source 2: WMI, which needs no compilation and so cannot be denied a temp file. An independent
# mechanism rather than a fallback -- the two agreeing is what makes either quotable.
try {
  $vc = Get-CimInstance Win32_VideoController -ErrorAction Stop |
        Where-Object { $_.CurrentHorizontalResolution -gt 0 } | Select-Object -First 1
  if ($vc) {
    $sources += [pscustomobject]@{ Name = 'Win32_VideoController'
      W = [int]$vc.CurrentHorizontalResolution; H = [int]$vc.CurrentVerticalResolution }
  } else {
    "NOTE  Win32_VideoController reported no adapter with a live mode"
  }
} catch {
  "NOTE  Win32_VideoController source unavailable: $($_.Exception.GetType().Name): $($_.Exception.Message)"
}

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$virtual = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

if ($sources.Count -eq 0) {
  # ⚠️ ABORT rather than fall back. See the header: a laundered figure is the failure mode.
  "CAPTURE ABORTED - no physical-resolution source available (this process sees $($virtual.Width)x$($virtual.Height), which is NOT trustworthy)"
  exit 2
}

# Largest wins: every source either reports the physical size or a virtualized subset of it,
# never something bigger, so `max` cannot pick a wrong answer over a right one.
$best = $sources | Sort-Object { $_.W * $_.H } -Descending | Select-Object -First 1
$pw = $best.W; $ph = $best.H
$names = ($sources | ForEach-Object { "$($_.Name)=$($_.W)x$($_.H)" }) -join ', '

$shot = New-Object System.Drawing.Bitmap $pw, $ph
$g = [System.Drawing.Graphics]::FromImage($shot)
# Source coordinates are physical too, so the origin is the physical origin: 0,0.
$g.CopyFromScreen(0, 0, 0, 0, (New-Object System.Drawing.Size $pw, $ph))
$g.Dispose()
$shot.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)

# Measure on a downscale: GetPixel over 8 MP is minutes, and the statistics of interest
# (is anything lit at all, how much, how bright) survive a box filter.
$w = 192; $h = [int]($w * $ph / $pw)
$small = New-Object System.Drawing.Bitmap $w, $h
$gs = [System.Drawing.Graphics]::FromImage($small)
$gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
$gs.DrawImage($shot, 0, 0, $w, $h)
$gs.Dispose()

$lit = 0; $total = $w * $h; $max = 0; $sum = 0.0
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $p = $small.GetPixel($x, $y)
    $m = [Math]::Max($p.R, [Math]::Max($p.G, $p.B))
    if ($m -gt $max) { $max = $m }
    $sum += $m
    if ($m -gt $LitThreshold) { $lit++ }
  }
}
$small.Dispose(); $shot.Dispose()

$pct = [Math]::Round(100.0 * $lit / $total, 2)
$mean = [Math]::Round($sum / $total, 2)
"MEASURED $($pw)x$($ph) via $($best.Name) [sources: $names; this process sees $($virtual.Width)x$($virtual.Height)] -> $Out : lit $pct% (threshold $LitThreshold), max channel $max, mean $mean over $total sampled cells"
