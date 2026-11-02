// 20.4 (the window) and 20.6 (the exit policy) — show mode, `/s`.
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Psss.Screensaver;

internal sealed class ScreensaverWindow : IDisposable
{
    private const string ShowClass = "PsssScreensaverShow";
    private const string BlackClass = "PsssScreensaverBlack";

    /// <summary>
    /// 20.6's grace period. ⚠️ THIS IS NOT THE REMEDY FOR THE SPURIOUS FIRST MOUSE MOVE —
    /// see <see cref="_firstMoveSeen"/>. Two distinct causes, two distinct remedies:
    /// launching the `.scr` by a double-click in Explorer delivers a mouse-up and a move
    /// into the fresh window (this), while Windows delivers a WM_MOUSEMOVE whenever the
    /// cursor merely happens to sit inside a new window, with no click involved (that).
    /// Conflating them yields a saver that ignores the first REAL input for 700 ms and
    /// still exits instantly when the cursor was already centred.
    /// </summary>
    private const long GraceMs = 700;

    /// <summary>
    /// 20.6's cumulative threshold, in screen pixels. The same number as the page layer's
    /// `SCREENSAVER_MOVE_THRESHOLD_PX` in `main.ts`, and ⚠️ the two are independent copies
    /// by necessity — they measure different HWNDs (see the two-layer note on
    /// <see cref="Start"/>) and no compiler compares them.
    /// </summary>
    private const double MoveThresholdPx = 8.0;

    // ⚠️ The delegate must outlive the window: Marshal.GetFunctionPointerForDelegate does
    // not root it, and a collected WndProc is an access violation at the next message.
    private static WndProc? _procKeepAlive;
    private static Win32.MonitorEnumProc? _enumKeepAlive;
    private static ScreensaverWindow? _instance;

    private IntPtr _hwnd;
    private readonly List<IntPtr> _blackWindows = new();
    private WebHost? _web;
    private IntPtr _blackBrush;

    private long _startTick;
    private bool _firstMoveSeen;
    private POINT _lastCursor;
    private double _movePath;
    private bool _cursorHidden;
    private bool _exitRequested;

    public int ExitCode { get; private set; }

    /// <summary>
    /// Creates the windows and starts the page. Returns once navigation has been POSTED;
    /// the caller pumps the message loop, which is what actually drives WebView2.
    ///
    /// ⚠️ 20.6 — TWO EXIT LAYERS, BOTH REQUIRED, AND THE REASON IS STRUCTURAL RATHER THAN
    /// DEFENSIVE. Input over the WebView goes to the WebView's OWN child HWND and never
    /// reaches this WndProc; input on the black secondary monitors never reaches the page.
    /// A host-only implementation exits on everything except a move over the actual
    /// animation; a page-only implementation exits on everything except a click on the
    /// second monitor. Both holes pass a hand test on a single-monitor machine.
    /// </summary>
    public async Task Start()
    {
        _instance = this;
        _procKeepAlive ??= StaticWndProc;
        _blackBrush = Win32.CreateSolidBrush(0x00000000);
        RegisterClass(ShowClass, _blackBrush);
        RegisterClass(BlackClass, _blackBrush);

        RECT primary = PrimaryMonitorBounds();
        Program.Log($"[show] primary monitor {primary.Left},{primary.Top} {primary.Width}x{primary.Height}");

        // ⚠️ THE BLACK SIBLINGS ARE CREATED FIRST, AND THE ORDER IS LOAD-BEARING. The
        // primary popup handles WM_ACTIVATE/WA_INACTIVE as an exit trigger; creating a
        // sibling popup after it would deactivate it and the saver would exit the instant
        // it started, on multi-monitor machines only.
        CreateBlackSiblings(primary);

        _hwnd = Win32.CreateWindowExW(
            Win32.WS_EX_TOPMOST, ShowClass, "psss",
            Win32.WS_POPUP | Win32.WS_VISIBLE | Win32.WS_CLIPCHILDREN,
            primary.Left, primary.Top, primary.Width, primary.Height,
            IntPtr.Zero, IntPtr.Zero, Win32.GetModuleHandleW(null), IntPtr.Zero);
        if (_hwnd == IntPtr.Zero) throw new InvalidOperationException("CreateWindowExW failed for the show window");
        Win32.SetForegroundWindow(_hwnd);
        Win32.UpdateWindow(_hwnd);

        // Sampled ONCE at start, per 20.6. The first-move ignore below resamples it; that
        // duplication is what keeps the two remedies separable.
        Win32.GetCursorPos(out _lastCursor);
        _startTick = Environment.TickCount64;
        HideCursor();

        // 20.4 records SPI_SETSCREENSAVERRUNNING as optional and legacy: set it only if the
        // hand probe shows a popup breaking through the topmost window, NOT pre-emptively.
        // Deliberately not called. (Win32.SPI_SETSCREENSAVERRUNNING is the constant.)

        _web = new WebHost();
        _web.ExitRequested += reason => RequestExit(reason);
        _web.FatalReported += message =>
        {
            Program.Log($"[show] FATAL from the page: {message}");
            RequestExit("a fatal page error", 1);
        };
        Win32.GetClientRect(_hwnd, out RECT client);
        await _web.AttachAsync(_hwnd, client, "?screensaver=1");
    }

    private static void RegisterClass(string name, IntPtr background)
    {
        var cls = new WNDCLASSEXW
        {
            CbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf<WNDCLASSEXW>(),
            LpfnWndProc = System.Runtime.InteropServices.Marshal.GetFunctionPointerForDelegate(_procKeepAlive!),
            HInstance = Win32.GetModuleHandleW(null),
            // ⚠️ No class cursor: with HCursor null, DefWindowProc leaves the cursor alone,
            // so ShowCursor(false) is not fought over by every WM_SETCURSOR.
            HCursor = IntPtr.Zero,
            HbrBackground = background,
            LpszClassName = name,
        };
        if (Win32.RegisterClassExW(ref cls) == 0)
        {
            int err = System.Runtime.InteropServices.Marshal.GetLastWin32Error();
            // 1410 = ERROR_CLASS_ALREADY_EXISTS, which is benign on a second call.
            if (err != 1410) throw new InvalidOperationException($"RegisterClassExW({name}) failed: {err}");
        }
    }

    private static RECT PrimaryMonitorBounds()
    {
        // D2: primary monitor only. MONITOR_DEFAULTTOPRIMARY makes the {0,0} probe exact
        // rather than merely usual — the primary monitor's origin IS {0,0} by definition,
        // but the flag means a virtual-desktop layout that puts nothing there still resolves.
        IntPtr monitor = Win32.MonitorFromPoint(new POINT { X = 0, Y = 0 }, Win32.MONITOR_DEFAULTTOPRIMARY);
        var info = new MONITORINFO { CbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf<MONITORINFO>() };
        if (!Win32.GetMonitorInfoW(monitor, ref info))
        {
            throw new InvalidOperationException("GetMonitorInfoW failed for the primary monitor");
        }
        return info.RcMonitor;
    }

    /// <summary>
    /// D2: every OTHER display gets a plain black popup and no WebView — one GL context,
    /// predictable framing, and the reel's compositions were framed for one screen.
    /// They share the exit funnel, and note they are where this host's own WndProc actually
    /// SEES input, which is half of why 20.6 needs two layers.
    /// </summary>
    private void CreateBlackSiblings(RECT primary)
    {
        var others = new List<RECT>();
        _enumKeepAlive = (IntPtr monitor, IntPtr hdc, ref RECT clip, IntPtr data) =>
        {
            var info = new MONITORINFO { CbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf<MONITORINFO>() };
            if (Win32.GetMonitorInfoW(monitor, ref info) && (info.DwFlags & Win32.MONITORINFOF_PRIMARY) == 0)
            {
                others.Add(info.RcMonitor);
            }
            return true;
        };
        Win32.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, _enumKeepAlive, IntPtr.Zero);

        foreach (RECT r in others)
        {
            IntPtr black = Win32.CreateWindowExW(
                Win32.WS_EX_TOPMOST | Win32.WS_EX_TOOLWINDOW, BlackClass, null,
                Win32.WS_POPUP | Win32.WS_VISIBLE,
                r.Left, r.Top, r.Width, r.Height,
                IntPtr.Zero, IntPtr.Zero, Win32.GetModuleHandleW(null), IntPtr.Zero);
            if (black != IntPtr.Zero) _blackWindows.Add(black);
        }
        Program.Log($"[show] {_blackWindows.Count} black sibling window(s)");
    }

    private static IntPtr StaticWndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        ScreensaverWindow? self = _instance;
        if (self is null) return Win32.DefWindowProcW(hwnd, msg, wParam, lParam);
        return self.HandleMessage(hwnd, msg, wParam, lParam);
    }

    private IntPtr HandleMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        switch (msg)
        {
            case Win32.WM_MOUSEMOVE:
                OnMouseMove();
                return IntPtr.Zero;

            case Win32.WM_LBUTTONDOWN:
            case Win32.WM_RBUTTONDOWN:
            case Win32.WM_MBUTTONDOWN:
            case Win32.WM_MOUSEWHEEL:
                OnInput("a mouse button");
                return IntPtr.Zero;

            case Win32.WM_KEYDOWN:
            case Win32.WM_SYSKEYDOWN:
                OnInput($"a key (vk {wParam.ToInt64()})");
                return IntPtr.Zero;

            case Win32.WM_ACTIVATE:
                // Only the primary window treats deactivation as an exit: a black sibling is
                // inactive by definition and would exit immediately.
                if (hwnd == _hwnd && (wParam.ToInt64() & 0xFFFF) == Win32.WA_INACTIVE)
                {
                    OnInput("the window lost activation");
                }
                return IntPtr.Zero;

            case Win32.WM_SETCURSOR:
                // Swallow it so nothing re-shows the cursor over our own windows.
                return new IntPtr(1);

            case Win32.WM_SIZE:
                if (hwnd == _hwnd && Win32.GetClientRect(hwnd, out RECT client)) _web?.SetBounds(client);
                return IntPtr.Zero;

            case Win32.WM_ERASEBKGND:
                if (Win32.GetClientRect(hwnd, out RECT fill))
                {
                    Win32.FillRect(wParam, ref fill, _blackBrush);
                }
                return new IntPtr(1);

            case Win32.WM_CLOSE:
                RequestExit("a close request");
                return IntPtr.Zero;

            case Win32.WM_DESTROY:
                if (hwnd == _hwnd) RequestExit("the window was destroyed");
                return IntPtr.Zero;
        }
        return Win32.DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    /// <summary>
    /// The host layer's mouse rule. ⚠️ The first WM_MOUSEMOVE is dropped OUTRIGHT and
    /// resamples the anchor, which is a different remedy from the grace period; see
    /// <see cref="GraceMs"/>. Cursor position is read from GetCursorPos rather than lParam
    /// so the primary window and every black sibling accumulate on ONE screen-coordinate
    /// scale — lParam is client-relative, and a move that crosses monitors would otherwise
    /// jump by a whole screen width and trip the threshold on its own.
    /// </summary>
    private void OnMouseMove()
    {
        if (!_firstMoveSeen)
        {
            _firstMoveSeen = true;
            Win32.GetCursorPos(out _lastCursor);
            return;
        }
        if (!Win32.GetCursorPos(out POINT now)) return;
        double dx = now.X - _lastCursor.X;
        double dy = now.Y - _lastCursor.Y;
        _lastCursor = now;
        _movePath += Math.Sqrt(dx * dx + dy * dy);
        if (_movePath < MoveThresholdPx) return;
        OnInput($"a mouse move of {_movePath:0} px");
    }

    private void OnInput(string reason)
    {
        long elapsed = Environment.TickCount64 - _startTick;
        if (elapsed < GraceMs)
        {
            Program.Log($"[show] ignoring {reason} — {elapsed} ms into the {GraceMs} ms grace period");
            return;
        }
        RequestExit(reason);
    }

    /// <summary>
    /// 20.6's single exit owner, ⚠️ IDEMPOTENT because two layers and several windows all
    /// call it, often within the same millisecond. Restores the cursor, closes the WebView,
    /// destroys the black windows, logs the reason, and posts WM_QUIT last.
    /// </summary>
    public void RequestExit(string reason, int exitCode = 0)
    {
        if (_exitRequested) return;
        _exitRequested = true;
        ExitCode = exitCode;
        Program.Log($"[show] exiting ({exitCode}) because {reason}");

        RestoreCursor();
        _web?.Dispose();
        _web = null;

        foreach (IntPtr black in _blackWindows)
        {
            if (Win32.IsWindow(black)) Win32.DestroyWindow(black);
        }
        _blackWindows.Clear();

        IntPtr show = _hwnd;
        _hwnd = IntPtr.Zero;
        if (show != IntPtr.Zero && Win32.IsWindow(show)) Win32.DestroyWindow(show);

        // ⚠️ PostQuitMessage only works on the thread owning the loop. Every caller of
        // RequestExit is already on it: the WndProc by definition, and the two WebHost
        // events because Program installs a message-loop SynchronizationContext.
        Win32.PostQuitMessage(ExitCode);
    }

    private void HideCursor()
    {
        if (_cursorHidden) return;
        Win32.ShowCursor(false);
        _cursorHidden = true;
    }

    /// <summary>
    /// ⚠️ Called from the exit owner AND from a `finally` in Program, because a throw
    /// between start and exit would otherwise leave the machine with no cursor at all —
    /// the same shape as the engine's invariant 22. Guarded because ShowCursor is a
    /// COUNTER: a second restore would push the count above zero and the cursor would
    /// survive the next legitimate hide.
    /// </summary>
    public void RestoreCursor()
    {
        if (!_cursorHidden) return;
        _cursorHidden = false;
        Win32.ShowCursor(true);
    }

    public void Dispose()
    {
        RestoreCursor();
        _web?.Dispose();
        _web = null;
        if (_blackBrush != IntPtr.Zero)
        {
            Win32.DeleteObject(_blackBrush);
            _blackBrush = IntPtr.Zero;
        }
        _instance = null;
    }
}
