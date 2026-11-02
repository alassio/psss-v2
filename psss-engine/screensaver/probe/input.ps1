# Synthetic input for the Phase 20.10 host probe.
#
# ⚠️ INJECTED INPUT, NOT PostMessage, and the distinction is the point of the probe. Input over
# the WebView goes to the WebView's OWN child HWND; a PostMessage to the host window would
# exercise only the host layer and would pass even if 20.1's page layer were absent — which
# is exactly the hole 20.6 says a single-layer implementation leaves. Injected input takes
# the real route and therefore tests whichever layer actually receives it.
# ⚠️ The calls below are `keybd_event`/`mouse_event`, NOT `SendInput` as an earlier revision of
# this header said. They are the legacy wrappers over the same injection path, so the property
# the probe depends on is unchanged — but the header named an API this file does not call, and
# a reader checking the claim against the code would have found it false.
#
#   -Key <vk>          press and release one virtual key
#   -MoveBy <px>       move the cursor right by <px> in ONE step
#   -Nudge <px>        move the cursor right by <px> in 1 px steps (many events, small path)
#   -Click             left button down + up at the current position
param(
  [int]$Key = 0,
  [int]$MoveBy = 0,
  [int]$Nudge = 0,
  [switch]$Click
)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Inject {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  // ⚠️ NO `GetCursorPos` HERE. One was declared as `out int[] p` until 2026-09-15 — a wrong
  // marshalling for a POINT struct, which would have corrupted the stack rather than failed to
  // compile. It was never called, so nothing exercised it; an unused P/Invoke with a wrong
  // signature is a loaded trap for the next caller, not dead weight. Use GetPhysicalCursorPos.
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, IntPtr extra);
  [DllImport("user32.dll")] public static extern bool GetPhysicalCursorPos(out POINT p);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  public const uint KEYEVENTF_KEYUP = 0x0002;
  public const uint MOUSEEVENTF_MOVE = 0x0001;
  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
}
'@

if ($Key -ne 0) {
  [Inject]::keybd_event([byte]$Key, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 30
  [Inject]::keybd_event([byte]$Key, 0, [Inject]::KEYEVENTF_KEYUP, [IntPtr]::Zero)
  "sent key vk $Key"
}
if ($MoveBy -ne 0) {
  [Inject]::mouse_event([Inject]::MOUSEEVENTF_MOVE, $MoveBy, 0, 0, [IntPtr]::Zero)
  "sent one relative mouse move of $MoveBy px"
}
if ($Nudge -ne 0) {
  for ($i = 0; $i -lt $Nudge; $i++) {
    [Inject]::mouse_event([Inject]::MOUSEEVENTF_MOVE, 1, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 15
  }
  "sent $Nudge single-pixel mouse moves"
}
if ($Click) {
  [Inject]::mouse_event([Inject]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 30
  [Inject]::mouse_event([Inject]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero)
  "sent a left click"
}
