// 20.7 — preview mode, `/p <hwnd>`.
//
// D5: a STATIC PNG, GDI-blitted. No WebView and no GL in a 152x112 window that Settings
// creates and destroys as the dropdown scrolls — reduced-fidelity tiles are already a
// won't-fix in this engine, so a tiny live render would be all cost. A live `/p` render is
// on the never-re-propose list.
using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;

namespace Psss.Screensaver;

internal sealed class PreviewHost : IDisposable
{
    private const string PreviewClass = "PsssScreensaverPreview";
    private const uint WatchdogIntervalMs = 500;

    private static WndProc? _procKeepAlive;
    private static Win32.TimerProc? _watchdogKeepAlive;
    private static PreviewHost? _instance;

    private IntPtr _watchdogTimer;
    private IntPtr _hwnd;
    private IntPtr _parent;
    private IntPtr _bitmap;
    private int _bitmapWidth, _bitmapHeight;
    private IntPtr _blackBrush;
    private bool _exited;

    public void Start(IntPtr parent)
    {
        _instance = this;
        _parent = parent;
        _procKeepAlive ??= StaticWndProc;
        _blackBrush = Win32.CreateSolidBrush(0x00000000);

        LoadPreviewBitmap();

        var cls = new WNDCLASSEXW
        {
            CbSize = (uint)Marshal.SizeOf<WNDCLASSEXW>(),
            LpfnWndProc = Marshal.GetFunctionPointerForDelegate(_procKeepAlive!),
            HInstance = Win32.GetModuleHandleW(null),
            HbrBackground = _blackBrush,
            LpszClassName = PreviewClass,
        };
        if (Win32.RegisterClassExW(ref cls) == 0)
        {
            int err = Marshal.GetLastWin32Error();
            if (err != 1410) throw new InvalidOperationException($"RegisterClassExW(preview) failed: {err}");
        }

        AdoptParentDpiContext(parent);

        if (!Win32.GetClientRect(parent, out RECT client))
        {
            Program.Log("[preview] GetClientRect on the given parent failed — Settings may already have closed it");
            // ⚠️ `Exit()` AND NOT A BARE `return`, AND THE DIFFERENCE IS AN IMMORTAL PROCESS.
            // Measured 2026-09-15 with `/p 1234`: returning here creates no window and no
            // watchdog timer, so `RunLoop` blocks in `GetMessageW` with an empty queue and
            // NOTHING can ever post a quit — the process lives until the machine is rebooted.
            // It is the exact leak the watchdog paragraph below exists to prevent, reached by
            // the one path that never installs the watchdog, and it is silent twice over:
            // nothing is on screen, and the log line above reads like a handled case. Settings
            // creates and destroys preview parents constantly while its dropdown scrolls, so
            // this path is common rather than exotic. `Exit()` posts WM_QUIT to THIS thread,
            // which is the loop's own thread because `Start` runs synchronously inside it.
            Exit();
            return;
        }

        // ⚠️ The parent is passed to CreateWindowExW rather than set afterwards with
        // SetParent. For a WS_CHILD window the two are the same operation, and doing it at
        // creation means there is no instant at which this window exists as a TOP-LEVEL
        // window — which, in Settings' preview area, would flash a stray window on screen.
        _hwnd = Win32.CreateWindowExW(0, PreviewClass, null, Win32.WS_CHILD | Win32.WS_VISIBLE,
            0, 0, client.Width, client.Height, parent, IntPtr.Zero, Win32.GetModuleHandleW(null), IntPtr.Zero);
        if (_hwnd == IntPtr.Zero) throw new InvalidOperationException("CreateWindowExW failed for the preview window");
        Program.Log($"[preview] child of {parent.ToInt64()} at {client.Width}x{client.Height}");

        // ⚠️ SETTINGS DESTROYS THE PARENT WITHOUT TELLING YOU. A leaked preview process
        // holding a GDI bitmap is the classic screensaver bug, and it survives every
        // functional test because nothing on screen shows it — it is found only in Task
        // Manager. Hence the poll; there is no message for "your parent is gone".
        //
        // ⚠️ A THREAD TIMER, NOT A WINDOW TIMER, AND THE DIFFERENCE IS THE SECOND OF TWO
        // ROUTES TO AN IMMORTAL PROCESS. Measured 2026-09-15 with `probe/preview-orphan.ps1`,
        // which kills the parent PROCESS rather than closing the parent WINDOW:
        //
        //     AFTER THE KILL: parent hwnd isWindow=False, child hwnd isWindow=False
        //     LEAKED: still running 12 s after the parent process was killed
        //
        // Both halves of that first line matter. The parent HWND really is gone, so the
        // watchdog's CONDITION was correct all along — but OUR OWN window is destroyed too, as
        // part of the kernel's cleanup of the dead process's window tree, and a window timer
        // dies with its window. So the condition was never evaluated again: no WM_TIMER, no
        // WM_DESTROY delivered to our procedure either, and `RunLoop` left blocking in
        // `GetMessageW` on a thread with no windows and no timers and therefore nothing that
        // could ever post a quit. That is the SAME SHAPE as the `GetClientRect` bare-`return`
        // above, reached by a completely different route — which is why the remedy is a
        // lifeline that does not depend on this window existing, rather than another condition.
        //
        // ⚠️ IT WAS FOUND BY ACCIDENT AND THE ACCIDENT IS THE ONLY REASON IT IS NOT SHIPPED:
        // two of these processes were still running when `build.bat` failed to overwrite
        // `psss.scr`, and MSBuild's error names a file lock, not a leak. Nothing on screen, no
        // log line, and every clean run exiting in under a second — the negative evidence
        // ("neither ever logged `[loop] ended`") is what identified them.
        //
        // ⚠️ AND THE CONDITION IS NOW BOTH WINDOWS, because either one going away is fatal to
        // a preview: no parent means nothing to draw into, and no window of our own means
        // nothing left to draw. Checking only the parent would still have leaked in any future
        // case where our window dies first.
        _watchdogKeepAlive ??= WatchdogTick;
        _watchdogTimer = Win32.SetThreadTimer(IntPtr.Zero, IntPtr.Zero, WatchdogIntervalMs, _watchdogKeepAlive);
        if (_watchdogTimer == IntPtr.Zero)
        {
            // Not recoverable and not survivable: without the watchdog this process is exactly
            // the leak described above, so refuse to become one.
            Program.Log($"[preview] the watchdog timer could not be created ({Marshal.GetLastWin32Error()}) — exiting rather than leaking");
            Exit();
        }
    }

    private static void WatchdogTick(IntPtr hwnd, uint msg, IntPtr id, uint tickCount)
    {
        PreviewHost? self = _instance;
        if (self is null) return;
        bool parentGone = !Win32.IsWindow(self._parent);
        // ⚠️ `_hwnd` IS ZEROED BY `Exit()`, so read it once and treat zero as "already
        // exiting" rather than as "destroyed" — otherwise the tick between `Exit()` and the
        // loop ending logs a second, misleading reason for the same shutdown.
        IntPtr own = self._hwnd;
        if (own == IntPtr.Zero) return;
        bool ownGone = !Win32.IsWindow(own);
        if (!parentGone && !ownGone) return;
        Program.Log(parentGone && ownGone
            ? "[preview] the parent window and this window are both gone — exiting"
            : parentGone
                ? "[preview] the parent window is gone — exiting"
                : "[preview] this preview window was destroyed underneath us — exiting");
        self.Exit();
    }

    // ⚠️ THE PREVIEW THREAD MUST RUN IN THE PARENT'S DPI CONTEXT, AND NOT DOING SO WAS A
    // FULLY-BLANK THUMBNAIL WITH `IsWindowVisible` TRUE. Measured 2026-09-15 with a stand-in
    // parent (`probe/preview-host.ps1`, both `-Awareness` values, which exists to put exactly
    // this variable on a switch):
    //
    //   parent DPI-unaware, host PerMonitorV2 : client area 99.88 % MAGENTA (the parent's own
    //       backcolour), while the log said `child of <hwnd> at 304x224` and the child window
    //       reported visible=True, style 0x50000000 (WS_CHILD|WS_VISIBLE), rect 416,462
    //       304x224 — PHYSICAL numbers sitting in a window tree whose coordinates are the
    //       unaware parent's 1440-wide space, where that client area is 208,231 152x112. The
    //       child was therefore created at twice the size and twice the offset it was told,
    //       which puts it entirely outside the parent's client rect and clipped away.
    //   both PerMonitorV2 : magenta 0.14 %, lit 36.53 %, max channel 255. Same binary, same
    //       PNG, same `Paint()`.
    //
    // ⚠️ IT IS THE WORST SHAPE OF SILENT: nothing fails, nothing logs, `CreateWindowExW`
    // succeeds, the bitmap decodes, `Paint()` runs, and every figure the host prints about
    // itself is correct. The only visible consequence is a blank rectangle in Settings, which
    // is indistinguishable from the "plain black thumbnail" that D5 explicitly permits as a
    // fallback — so this defect had a designed-in excuse waiting for it, and would have
    // shipped as a cosmetic non-goal.
    //
    // ⚠️ AND IT IS NOT A PROBE ARTEFACT, WHICH IS THE TEMPTING READING once a matched-context
    // run passes. The host does not choose its parent: `/p <hwnd>` hands it a window belonging
    // to another process whose awareness it cannot control or predict (the Screen Saver dialog
    // reaches users through several shells, and a system-aware parent is mismatched with this
    // PerMonitorV2 process just as an unaware one is). The remedy documented for the HOSTING
    // side — `SetThreadDpiHostingBehavior(DPI_HOSTING_BEHAVIOR_MIXED)` — is unavailable here
    // by construction, because it must be called by the thread that owns the PARENT. Adopting
    // the parent's context is the only half of the pair this process can perform.
    //
    // ⚠️ THE CALL MUST PRECEDE `GetClientRect(parent)`, NOT MERELY `CreateWindowExW`. The rect
    // and the window size are ONE quantity read in one context and written in another; setting
    // the context after the read would produce a correctly-placed window of the wrong size,
    // which is a HALF fix that looks much more like a scaling preference than a bug. This is
    // invariant 24's rule with the two subsystems being two DPI contexts: measure the
    // direction, convert exactly once, and say where.
    //
    // No restore, deliberately: this thread's whole remaining life is the preview window, its
    // message loop and `Paint()`'s own `GetClientRect`, all of which want the parent's context.
    private static void AdoptParentDpiContext(IntPtr parent)
    {
        try
        {
            IntPtr wanted = Win32.GetWindowDpiAwarenessContext(parent);
            if (wanted == IntPtr.Zero)
            {
                // A dead parent, which the GetClientRect check below reports and exits on.
                Program.Log("[preview] the parent has no DPI context — leaving this thread's context alone");
                return;
            }
            IntPtr previous = Win32.SetThreadDpiAwarenessContext(wanted);
            if (previous == IntPtr.Zero)
            {
                Program.Log("[preview] SetThreadDpiAwarenessContext was rejected — the thumbnail may be blank");
                return;
            }
            // Logged as awareness NUMBERS rather than handles: the handles are opaque
            // pseudo-values that mean nothing in a log, while 0/1/2 (unaware / system /
            // per-monitor) name the actual disagreement. Equal numbers here are the normal
            // case and the line is still worth writing — it is the only record of which
            // context a given run's coordinates were in.
            Program.Log("[preview] DPI context: parent awareness "
                + Win32.GetAwarenessFromDpiAwarenessContext(wanted)
                + ", this thread was " + Win32.GetAwarenessFromDpiAwarenessContext(previous)
                + (Win32.AreDpiAwarenessContextsEqual(wanted, previous) ? " (already matched)" : " (adopted the parent's)"));
        }
        catch (EntryPointNotFoundException)
        {
            // Pre-1607 Windows has neither the problem nor the API: without per-monitor
            // awareness every process is in one context and the mismatch cannot arise.
            Program.Log("[preview] per-monitor DPI APIs are absent on this Windows — nothing to adopt");
        }
    }

    private void LoadPreviewBitmap()
    {
        using Stream? png = PayloadFiles.OpenEmbedded(PayloadFiles.PreviewImage);
        if (png is null)
        {
            // Not fatal: a black thumbnail is a cosmetic loss, and killing the preview
            // process makes Settings look broken instead.
            Program.Log($"[preview] {PayloadFiles.PreviewImage} is not embedded — painting black");
            return;
        }
        try
        {
            using var bmp = new Bitmap(png);
            _bitmapWidth = bmp.Width;
            _bitmapHeight = bmp.Height;
            _bitmap = bmp.GetHbitmap();
            Program.Log($"[preview] {PayloadFiles.PreviewImage} decoded at {_bitmapWidth}x{_bitmapHeight}");
        }
        catch (Exception ex)
        {
            Program.Log($"[preview] decode failed ({ex.GetType().Name}: {ex.Message}) — painting black");
            _bitmap = IntPtr.Zero;
        }
    }

    private static IntPtr StaticWndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        PreviewHost? self = _instance;
        if (self is null) return Win32.DefWindowProcW(hwnd, msg, wParam, lParam);
        return self.HandleMessage(hwnd, msg, wParam, lParam);
    }

    private IntPtr HandleMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        switch (msg)
        {
            case Win32.WM_PAINT:
                Paint(hwnd);
                return IntPtr.Zero;

            // ⚠️ NO WM_TIMER CASE, DELIBERATELY. The watchdog is a THREAD timer now (see
            // `Start`), so its WM_TIMER never reaches a window procedure at all — it arrives
            // with a NULL hwnd and is delivered to `WatchdogTick` by `DispatchMessageW`.
            // Re-adding a window timer here would work in the one case that already worked and
            // silently not cover the case the thread timer exists for.
            case Win32.WM_DESTROY:
                Exit();
                return IntPtr.Zero;
        }
        return Win32.DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    private void Paint(IntPtr hwnd)
    {
        IntPtr hdc = Win32.BeginPaint(hwnd, out PAINTSTRUCT ps);
        try
        {
            Win32.GetClientRect(hwnd, out RECT client);
            if (_bitmap == IntPtr.Zero)
            {
                Win32.FillRect(hdc, ref client, _blackBrush);
                return;
            }
            IntPtr memDc = Win32.CreateCompatibleDC(hdc);
            IntPtr previous = Win32.SelectObject(memDc, _bitmap);
            // HALFTONE is the whole difference between a legible thumbnail and an aliased
            // one at 152 px: the default COLORONCOLOR drops pixels rather than averaging.
            Win32.SetStretchBltMode(hdc, Win32.HALFTONE);
            Win32.StretchBlt(hdc, 0, 0, client.Width, client.Height,
                memDc, 0, 0, _bitmapWidth, _bitmapHeight, Win32.SRCCOPY);
            Win32.SelectObject(memDc, previous);
            Win32.DeleteDC(memDc);
        }
        finally
        {
            Win32.EndPaint(hwnd, ref ps);
        }
    }

    private void Exit()
    {
        if (_exited) return;
        _exited = true;
        if (_watchdogTimer != IntPtr.Zero)
        {
            // ⚠️ `KillTimer(IntPtr.Zero, id)` — the hwnd must match the one `SetTimer` was
            // given, and for a thread timer that is NULL. Passing `_hwnd` here would fail
            // silently (KillTimer's `false` return is the only signal) and leave a timer
            // firing into `WatchdogTick` after this object is disposed.
            Win32.KillTimer(IntPtr.Zero, _watchdogTimer);
            _watchdogTimer = IntPtr.Zero;
        }
        if (_hwnd != IntPtr.Zero)
        {
            IntPtr h = _hwnd;
            _hwnd = IntPtr.Zero;
            if (Win32.IsWindow(h)) Win32.DestroyWindow(h);
        }
        Win32.PostQuitMessage(0);
    }

    public void Dispose()
    {
        if (_bitmap != IntPtr.Zero)
        {
            Win32.DeleteObject(_bitmap);
            _bitmap = IntPtr.Zero;
        }
        if (_blackBrush != IntPtr.Zero)
        {
            Win32.DeleteObject(_blackBrush);
            _blackBrush = IntPtr.Zero;
        }
        _instance = null;
    }
}
