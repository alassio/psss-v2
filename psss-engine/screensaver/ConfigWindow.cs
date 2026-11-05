// 20.8 — config mode, `/c` and `/c:<hwnd>`.
//
// D3: the config dialog IS the Lab's Reel tab, in a windowed WebView2, in the same binary.
// ⚠️ PERSISTENCE: NONE IS WRITTEN BY THIS HOST, AND THAT IS THE WHOLE DESIGN. `Main reel`
// goes `store.setMainReel()` → the store's local layer → `localStorage` → the shared
// user-data folder (see HostPaths) → the next `/s` run resolves the stored layer FIRST. A
// native dialog would have needed its own store and its own reader for the reels file; a
// second settings store outside `localStorage` is on the never-re-propose list, because a
// second source is invariant 17's shape.
//
// ⚠️ SCOPE LINE: WHICH REEL IS MAIN IS THE ONLY SETTING. No monitor picker (D2), no
// grace-period slider, no label toggle (D6 removed the label entirely).
using System;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace Psss.Screensaver;

internal sealed class ConfigWindow : IDisposable
{
    private const string ConfigClass = "PsssScreensaverConfig";

    /// <summary>
    /// The plan's "~1400x900", ⚠️ IN DIPs AND NOT IN PIXELS. This host is per-monitor DPI
    /// aware, so every Win32 coordinate it passes is PHYSICAL: taking these two numbers as
    /// pixels gives a 700x450 window on a 200 % display, which reads as a deliberate layout
    /// choice rather than as a unit error. Scaled by the monitor's effective DPI below and
    /// then clamped to the work area, because 1400x900 DIPs does not fit every screen.
    /// </summary>
    private const int DefaultWidthDip = 1400;
    private const int DefaultHeightDip = 900;
    private const int WorkAreaMarginDip = 40;
    private static readonly IntPtr IDC_ARROW = new(32512);

    private static WndProc? _procKeepAlive;
    private static ConfigWindow? _instance;

    private IntPtr _hwnd;
    private WebHost? _web;

    /// <summary>
    /// ⚠️ `?reel=0` FIRST, THEN `?tab=reel`, and both halves matter. `reel=0` turns
    /// autostart OFF so the user lands in the normal UI instead of a playing presentation
    /// (`?reel=0` beats every other autostart source, deliberately). `tab=reel` is step
    /// 20.8a's parameter, and the reason it exists rather than a host-side click through
    /// ExecuteScriptAsync is that `TabRegistry` builds a tab's container on FIRST SHOW — so
    /// `[data-tab="reel"]` matches nothing until the tab has been opened, and clicking by
    /// position is exactly the brittleness "select on the aria-label, never on position"
    /// exists to prevent.
    /// </summary>
    private const string ConfigQuery = "?reel=0&tab=reel";

    public async Task Start(IntPtr owner)
    {
        _instance = this;
        _procKeepAlive ??= StaticWndProc;

        var cls = new WNDCLASSEXW
        {
            CbSize = (uint)Marshal.SizeOf<WNDCLASSEXW>(),
            LpfnWndProc = Marshal.GetFunctionPointerForDelegate(_procKeepAlive!),
            HInstance = Win32.GetModuleHandleW(null),
            // Unlike show mode, config mode wants an ordinary cursor.
            HCursor = Win32.LoadCursorW(IntPtr.Zero, IDC_ARROW),
            HbrBackground = Win32.CreateSolidBrush(0x00000000),
            LpszClassName = ConfigClass,
        };
        if (Win32.RegisterClassExW(ref cls) == 0)
        {
            int err = Marshal.GetLastWin32Error();
            if (err != 1410) throw new InvalidOperationException($"RegisterClassExW(config) failed: {err}");
        }

        (RECT work, uint dpi) = WorkAreaAndDpi();
        double scale = dpi / (double)Win32.USER_DEFAULT_SCREEN_DPI;
        int margin = (int)Math.Round(WorkAreaMarginDip * scale);
        int width = Math.Min((int)Math.Round(DefaultWidthDip * scale), work.Width - margin);
        int height = Math.Min((int)Math.Round(DefaultHeightDip * scale), work.Height - margin);
        int x = work.Left + (work.Width - width) / 2;
        int y = work.Top + (work.Height - height) / 2;
        Program.Log($"[config] work area {work.Left},{work.Top} {work.Width}x{work.Height} at {dpi} dpi " +
                    $"-> window {x},{y} {width}x{height}");

        // A non-child window's hWndParent is its OWNER, which is what `/c:<hwnd>` supplies:
        // the Screen Saver dialog wants the config window on top of it and closed with it.
        _hwnd = Win32.CreateWindowExW(0, ConfigClass, $"psss screensaver {ProductVersion()} — choose the main reel",
            Win32.WS_OVERLAPPEDWINDOW | Win32.WS_VISIBLE | Win32.WS_CLIPCHILDREN,
            x, y, width, height, owner, IntPtr.Zero, Win32.GetModuleHandleW(null), IntPtr.Zero);
        if (_hwnd == IntPtr.Zero) throw new InvalidOperationException("CreateWindowExW failed for the config window");
        Win32.ShowWindow(_hwnd, Win32.SW_SHOW);
        Win32.SetForegroundWindow(_hwnd);
        // Logged because the requested rect and the resulting one are two different
        // quantities: Windows may reposition a window it considers off-screen, and the
        // difference is invisible without printing both.
        if (Win32.GetWindowRect(_hwnd, out RECT actual))
        {
            Program.Log($"[config] actual window rect {actual.Left},{actual.Top} {actual.Width}x{actual.Height}");
        }

        _web = new WebHost();
        // ⚠️ The page's exit channel is NOT armed here: 20.1's input policy only installs
        // under `?screensaver=1`, so no `psss-exit` can arrive in config mode. A fatal from
        // the page still matters — a missing preset library breaks config exactly as it
        // breaks show — and it closes the window rather than exiting silently.
        _web.FatalReported += message =>
        {
            Program.Log($"[config] FATAL from the page: {message}");
            Win32.PostMessageW(_hwnd, Win32.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
        };
        Win32.GetClientRect(_hwnd, out RECT client);
        await _web.AttachAsync(_hwnd, client, ConfigQuery);
    }

    /// <summary>
    /// The version the build stamped, for the window title.
    ///
    /// ⚠️ READ FROM THE ASSEMBLY, NEVER WRITTEN HERE: the number comes from `psss-engine/package.json`
    /// through `scripts/build-screensaver.mjs` (`-p:Version=`), so this title cannot drift from the
    /// release it belongs to. A bare local `build.bat` run prints `0.0.0-local`, which is the honest
    /// answer for a binary that is not a release. `+` metadata is stripped in case a future SDK
    /// setting appends a source revision again.
    /// </summary>
    internal static string ProductVersion()
    {
        string? v = typeof(ConfigWindow).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (string.IsNullOrWhiteSpace(v)) return "(version unknown)";
        int plus = v.IndexOf('+');
        return plus > 0 ? v[..plus] : v;
    }

    private static (RECT Work, uint Dpi) WorkAreaAndDpi()
    {
        IntPtr monitor = Win32.MonitorFromPoint(new POINT { X = 0, Y = 0 }, Win32.MONITOR_DEFAULTTOPRIMARY);
        var info = new MONITORINFO { CbSize = (uint)Marshal.SizeOf<MONITORINFO>() };
        RECT work = Win32.GetMonitorInfoW(monitor, ref info)
            ? info.RcWork
            : new RECT { Left = 0, Top = 0, Right = DefaultWidthDip, Bottom = DefaultHeightDip };
        uint dpi = Win32.USER_DEFAULT_SCREEN_DPI;
        if (Win32.GetDpiForMonitor(monitor, Win32.MDT_EFFECTIVE_DPI, out uint dpiX, out uint _) == 0 && dpiX > 0)
        {
            dpi = dpiX;
        }
        return (work, dpi);
    }

    private static IntPtr StaticWndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        ConfigWindow? self = _instance;
        if (self is null) return Win32.DefWindowProcW(hwnd, msg, wParam, lParam);
        return self.HandleMessage(hwnd, msg, wParam, lParam);
    }

    private IntPtr HandleMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        switch (msg)
        {
            case Win32.WM_SIZE:
                if (Win32.GetClientRect(hwnd, out RECT client)) _web?.SetBounds(client);
                return IntPtr.Zero;

            case Win32.WM_DESTROY:
                _web?.Dispose();
                _web = null;
                Win32.PostQuitMessage(0);
                return IntPtr.Zero;
        }
        return Win32.DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    public void Dispose()
    {
        _web?.Dispose();
        _web = null;
        _instance = null;
    }
}
