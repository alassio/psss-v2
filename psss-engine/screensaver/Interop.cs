// Every P/Invoke in the host, in one file (plan 20.2's layout line).
//
// ⚠️ The window-class and message constants live here too, because a message number
// spelled at its use site is the same class of gap as a filename spelled twice: nothing
// compares the copies. A wrong WM_ number does not fail to compile — it silently never
// matches, and the symptom is "the screensaver sometimes does not exit".
using System;
using System.Runtime.InteropServices;

namespace Psss.Screensaver;

internal delegate IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);

[StructLayout(LayoutKind.Sequential)]
internal struct RECT
{
    public int Left, Top, Right, Bottom;
    public int Width => Right - Left;
    public int Height => Bottom - Top;
}

[StructLayout(LayoutKind.Sequential)]
internal struct POINT
{
    public int X, Y;
}

[StructLayout(LayoutKind.Sequential)]
internal struct MSG
{
    public IntPtr Hwnd;
    public uint Message;
    public IntPtr WParam, LParam;
    public uint Time;
    public POINT Point;
}

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
internal struct WNDCLASSEXW
{
    public uint CbSize, Style;
    public IntPtr LpfnWndProc;
    public int CbClsExtra, CbWndExtra;
    public IntPtr HInstance, HIcon, HCursor, HbrBackground;
    public string? LpszMenuName, LpszClassName;
    public IntPtr HIconSm;
}

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
internal struct MONITORINFO
{
    public uint CbSize;
    public RECT RcMonitor, RcWork;
    public uint DwFlags;
}

[StructLayout(LayoutKind.Sequential)]
internal struct PAINTSTRUCT
{
    public IntPtr Hdc;
    public int FErase;
    public RECT RcPaint;
    public int FRestore, FIncUpdate;
    private long _rgbReserved0;
    private long _rgbReserved1;
    private long _rgbReserved2;
    private long _rgbReserved3;
}

internal static class Win32
{
    // ---- window styles -------------------------------------------------------------
    public const uint WS_POPUP = 0x80000000;
    public const uint WS_VISIBLE = 0x10000000;
    public const uint WS_CHILD = 0x40000000;
    public const uint WS_OVERLAPPEDWINDOW = 0x00CF0000;
    public const uint WS_CLIPCHILDREN = 0x02000000;
    public const uint WS_EX_TOPMOST = 0x00000008;
    public const uint WS_EX_TOOLWINDOW = 0x00000080;

    // ---- messages ------------------------------------------------------------------
    public const uint WM_DESTROY = 0x0002;
    public const uint WM_SIZE = 0x0005;
    public const uint WM_ACTIVATE = 0x0006;
    public const uint WM_PAINT = 0x000F;
    public const uint WM_CLOSE = 0x0010;
    public const uint WM_ERASEBKGND = 0x0014;
    public const uint WM_SETCURSOR = 0x0020;
    public const uint WM_TIMER = 0x0113;
    public const uint WM_KEYDOWN = 0x0100;
    public const uint WM_SYSKEYDOWN = 0x0104;
    public const uint WM_MOUSEMOVE = 0x0200;
    public const uint WM_LBUTTONDOWN = 0x0201;
    public const uint WM_RBUTTONDOWN = 0x0204;
    public const uint WM_MBUTTONDOWN = 0x0207;
    public const uint WM_MOUSEWHEEL = 0x020A;
    public const uint WM_APP = 0x8000;

    public const int WA_INACTIVE = 0;
    public const uint MONITORINFOF_PRIMARY = 0x00000001;
    public const uint MONITOR_DEFAULTTOPRIMARY = 0x00000001;

    // 20.4: legacy, applied only if the hand probe shows a popup breaking through.
    public const uint SPI_SETSCREENSAVERRUNNING = 0x0061;

    public const int SW_SHOW = 5;
    public const int HALFTONE = 4;
    public const uint SRCCOPY = 0x00CC0020;

    // ---- user32 --------------------------------------------------------------------
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern ushort RegisterClassExW(ref WNDCLASSEXW cls);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateWindowExW(uint exStyle, string className, string? windowName,
        uint style, int x, int y, int width, int height, IntPtr parent, IntPtr menu, IntPtr instance,
        IntPtr param);

    [DllImport("user32.dll")]
    public static extern IntPtr DefWindowProcW(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool DestroyWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hwnd, int cmd);

    [DllImport("user32.dll")]
    public static extern bool UpdateWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern int GetMessageW(out MSG msg, IntPtr hwnd, uint filterMin, uint filterMax);

    [DllImport("user32.dll")]
    public static extern bool TranslateMessage(ref MSG msg);

    [DllImport("user32.dll")]
    public static extern IntPtr DispatchMessageW(ref MSG msg);

    [DllImport("user32.dll")]
    public static extern void PostQuitMessage(int exitCode);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool PostMessageW(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool PostThreadMessageW(uint threadId, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int ShowCursor(bool show);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT point);

    [DllImport("user32.dll")]
    public static extern IntPtr MonitorFromPoint(POINT point, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool GetMonitorInfoW(IntPtr monitor, ref MONITORINFO info);

    public delegate bool MonitorEnumProc(IntPtr monitor, IntPtr hdc, ref RECT clip, IntPtr data);

    [DllImport("user32.dll")]
    public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc callback,
        IntPtr data);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SetParent(IntPtr child, IntPtr parent);

    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool AdjustWindowRectEx(ref RECT rect, uint style, bool menu, uint exStyle);

    [DllImport("user32.dll")]
    public static extern IntPtr BeginPaint(IntPtr hwnd, out PAINTSTRUCT ps);

    [DllImport("user32.dll")]
    public static extern bool EndPaint(IntPtr hwnd, ref PAINTSTRUCT ps);

    [DllImport("user32.dll")]
    public static extern int FillRect(IntPtr hdc, ref RECT rect, IntPtr brush);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SetTimer(IntPtr hwnd, IntPtr id, uint intervalMs, IntPtr callback);

    [DllImport("user32.dll")]
    public static extern bool KillTimer(IntPtr hwnd, IntPtr id);

    // ⚠️ A TIMER WITH `hwnd = NULL` IS A THREAD TIMER, AND IT IS A DIFFERENT LIFETIME, NOT A
    // STYLISTIC VARIANT. A window timer dies with its window; a thread timer outlives every
    // window the thread owns, which is the only reason PreviewHost can notice that its own
    // window has been destroyed underneath it (read that call site's ⚠️ block). Its WM_TIMER
    // arrives with `msg.Hwnd == IntPtr.Zero` and is therefore dispatched to NO window
    // procedure — the `TIMERPROC` below is the ONLY way to receive it, and passing NULL for it
    // yields a timer that fires into nothing forever.
    //
    // ⚠️ AND `RunLoop`'S `DispatchMessageW` IS WHAT INVOKES IT. That is why this needs no loop
    // change: the loop special-cases only `WM_RUN` and dispatches everything else, including
    // NULL-hwnd messages. A loop that skipped NULL-hwnd messages — a very natural-looking
    // tidy-up — would silently disable this watchdog and restore the leak.
    public delegate void TimerProc(IntPtr hwnd, uint msg, IntPtr id, uint tickCount);

    [DllImport("user32.dll", SetLastError = true, EntryPoint = "SetTimer")]
    public static extern IntPtr SetThreadTimer(IntPtr hwnd, IntPtr id, uint intervalMs, TimerProc callback);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SystemParametersInfoW(uint action, uint param, IntPtr data, uint winIni);

    [DllImport("user32.dll")]
    public static extern IntPtr LoadCursorW(IntPtr instance, IntPtr cursorName);

    // ---- gdi32 ---------------------------------------------------------------------
    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateSolidBrush(uint colorRef);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr obj);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr obj);

    [DllImport("gdi32.dll")]
    public static extern int SetStretchBltMode(IntPtr hdc, int mode);

    [DllImport("gdi32.dll")]
    public static extern bool StretchBlt(IntPtr dstDc, int dstX, int dstY, int dstW, int dstH,
        IntPtr srcDc, int srcX, int srcY, int srcW, int srcH, uint rop);

    // ---- shcore --------------------------------------------------------------------
    // ⚠️ A SIZE IN "PIXELS" IS AMBIGUOUS IN A PER-MONITOR-AWARE PROCESS, and the ambiguity
    // is silent: every Win32 coordinate this host passes is PHYSICAL, while a UI size a
    // human writes down ("about 1400x900") is in DIPs. On a 200 % display the two differ by
    // a factor of two, and the wrong reading yields a window that is half the intended size
    // — which looks like a layout choice rather than a bug. MDT_EFFECTIVE_DPI = 0.
    [DllImport("shcore.dll")]
    public static extern int GetDpiForMonitor(IntPtr monitor, int dpiType, out uint dpiX, out uint dpiY);

    public const int MDT_EFFECTIVE_DPI = 0;
    public const uint USER_DEFAULT_SCREEN_DPI = 96;

    // ---- DPI awareness contexts (user32, Windows 10 1607+) --------------------------
    // ⚠️ THESE EXIST FOR ONE CALLER — PreviewHost, which puts its thread into the PARENT's
    // context. Read the ⚠️ block at that call site before using them anywhere else: a thread
    // context change silently reinterprets every coordinate the thread subsequently passes or
    // receives, which is a very large blast radius for a call that returns a value nobody
    // usually checks.
    //
    // ⚠️ `GetWindowDpiAwarenessContext` RETURNS A PSEUDO-HANDLE, NOT A POINTER. It may be one
    // of the DPI_AWARENESS_CONTEXT_* sentinels (-1..-5) or a real internal handle, must never
    // be dereferenced or freed, and may only be compared with
    // `AreDpiAwarenessContextsEqual` — `==` between two of them is meaningless and, worse,
    // usually false for two contexts that are in fact the same awareness.
    [DllImport("user32.dll")]
    public static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

    [DllImport("user32.dll")]
    public static extern bool AreDpiAwarenessContextsEqual(IntPtr a, IntPtr b);

    [DllImport("user32.dll")]
    public static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);

    // ---- kernel32 ------------------------------------------------------------------
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr GetModuleHandleW(string? name);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();
}
