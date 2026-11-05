// 20.3 — the argument contract, the message loop, and the log.
//
// ⚠️ THREE HAND-WRITTEN AGREEMENTS LIVE IN THIS PHASE AND NO COMPILER OR TEST IN THIS
// PROJECT CAN SEE ANY OF THEM: the argument strings (here), the exit contract
// (ScreensaverWindow), and the preview-HWND parenting (PreviewHost). D8 declined a
// checker, so plan 20.10's hand-run probe with a written run record is the whole
// instrument. That is recorded as accepted, not overlooked.
using System;
using System.Collections.Concurrent;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;

namespace Psss.Screensaver;

internal enum HostMode
{
    Show,
    Preview,
    Config,
}

internal static class Program
{
    private static Mutex? _showMutex;

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            (HostMode mode, IntPtr hwnd, string how) = ParseArguments(args);
            Log($"--- psss {ConfigWindow.ProductVersion()} pid {Environment.ProcessId} args [{string.Join(' ', args)}] -> {mode} ({how})");
            return mode switch
            {
                HostMode.Show => RunShow(),
                HostMode.Preview => RunPreview(hwnd),
                _ => RunConfig(hwnd),
            };
        }
        catch (Exception ex)
        {
            Log($"UNHANDLED {ex}");
            return 1;
        }
        finally
        {
            _showMutex?.Dispose();
            _showMutex = null;
        }
    }

    // ------------------------------------------------------------------------------------
    // 20.3 — the argument contract
    // ------------------------------------------------------------------------------------

    /// <summary>
    /// Parses the screensaver argument contract case-insensitively.
    ///
    /// ⚠️ `/c` BARE, `-s`, `/S`, `/p:&lt;hwnd&gt;` AND NO ARGUMENT AT ALL ALL OCCUR IN THE WILD,
    /// and the convention for no argument is CONFIG. Anything unrecognised is also config —
    /// ⚠️ never a crash and never a silent exit, because the Screen Saver dialog gives no
    /// feedback either way, so an unparsed argument would present to the user as "the
    /// screensaver does nothing".
    ///
    /// HWNDs arrive DECIMAL; `0x`-prefixed hex is accepted too.
    /// </summary>
    internal static (HostMode Mode, IntPtr Hwnd, string How) ParseArguments(string[] args)
    {
        if (args.Length == 0) return (HostMode.Config, IntPtr.Zero, "no argument, so config by convention");

        string first = args[0].Trim();
        if (first.Length == 0) return (HostMode.Config, IntPtr.Zero, "an empty argument");

        // Strip one leading switch character: both `/` and `-` are used in the wild.
        int start = (first[0] == '/' || first[0] == '-') ? 1 : 0;
        if (first.Length <= start) return (HostMode.Config, IntPtr.Zero, "a bare switch character");

        char letter = char.ToLowerInvariant(first[start]);

        // `/p:1234` and `/p=1234` both appear; the separator may also be a space, in which
        // case the handle is the NEXT argument.
        string inline = string.Empty;
        int sep = first.IndexOfAny(new[] { ':', '=' }, start);
        if (sep >= 0) inline = first.Substring(sep + 1).Trim();
        string handleText = inline.Length > 0 ? inline : (args.Length > 1 ? args[1].Trim() : string.Empty);

        switch (letter)
        {
            case 's':
                return (HostMode.Show, IntPtr.Zero, "show mode");

            case 'p':
                if (TryParseHandle(handleText, out IntPtr preview) && preview != IntPtr.Zero)
                {
                    return (HostMode.Preview, preview, $"preview into HWND {preview.ToInt64()}");
                }
                // A `/p` with no usable handle has nothing to render into. Config is the
                // contract's answer for anything unusable — an exit here would look like a
                // broken screensaver in the Settings list.
                return (HostMode.Config, IntPtr.Zero, $"preview with an unusable handle '{handleText}', so config");

            case 'c':
                TryParseHandle(handleText, out IntPtr owner);
                return (HostMode.Config, owner, owner == IntPtr.Zero
                    ? "config with no owner window"
                    : $"config owned by HWND {owner.ToInt64()}");

            default:
                return (HostMode.Config, IntPtr.Zero, $"unrecognised argument '{first}', so config");
        }
    }

    private static bool TryParseHandle(string text, out IntPtr handle)
    {
        handle = IntPtr.Zero;
        if (string.IsNullOrEmpty(text)) return false;
        bool hex = text.StartsWith("0x", StringComparison.OrdinalIgnoreCase);
        string digits = hex ? text.Substring(2) : text;
        bool ok = hex
            ? long.TryParse(digits, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out long value)
            : long.TryParse(digits, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        if (!ok) return false;
        handle = new IntPtr(value);
        return true;
    }

    // ------------------------------------------------------------------------------------
    // the three modes
    // ------------------------------------------------------------------------------------

    private static int RunShow()
    {
        // ⚠️ A NAMED MUTEX GUARDS `/s` ALONE, so two savers cannot stack. `/p` must NOT
        // take it: Settings runs a preview while a show may legitimately be starting, and a
        // preview that lost the race would render nothing with no way to say why.
        // Session-local, because two logged-in users each get their own screensaver.
        _showMutex = new Mutex(true, @"Local\Psss.Screensaver.Show", out bool created);
        if (!created)
        {
            Log("[show] another show instance already holds the mutex — exiting 0");
            return 0;
        }

        if (!WebView2RuntimePresent()) return 1;

        using var window = new ScreensaverWindow();
        try
        {
            return RunLoop(window.Start, ex =>
            {
                Log($"[show] startup failed: {ex}");
                window.RequestExit("a host startup failure", 1);
            });
        }
        finally
        {
            // ⚠️ IN A `finally` AS WELL AS IN THE EXIT OWNER: a throw between hiding the
            // cursor and exiting would otherwise leave the machine with NO CURSOR. The
            // engine's invariant 22 is the same shape — the recovery-critical call belongs
            // in a finally, never as the last statement of the happy path.
            window.RestoreCursor();
        }
    }

    private static int RunPreview(IntPtr parent)
    {
        // D5: no WebView and no GL here, so the runtime check is deliberately skipped — a
        // machine with no WebView2 still gets a correct thumbnail.
        using var preview = new PreviewHost();
        return RunLoop(() => { preview.Start(parent); return Task.CompletedTask; },
            ex => Log($"[preview] startup failed: {ex}"));
    }

    private static int RunConfig(IntPtr owner)
    {
        if (!WebView2RuntimePresent()) return 1;
        using var config = new ConfigWindow();
        return RunLoop(() => config.Start(owner), ex => Log($"[config] startup failed: {ex}"));
    }

    /// <summary>
    /// ⚠️ WebView2 Evergreen is absent on pre-21H2 Windows, and the symptom is "nothing
    /// appears; Settings looks broken". Detect, log, exit 1 — and ⚠️ DO NOT BUNDLE THE
    /// BOOTSTRAPPER AND DO NOT SILENTLY INSTALL ANYTHING (plan 20's risk table).
    /// </summary>
    private static bool WebView2RuntimePresent()
    {
        try
        {
            string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (!string.IsNullOrEmpty(version)) return true;
            Log("[webview] no WebView2 runtime version reported — exiting 1");
            return false;
        }
        catch (Exception ex)
        {
            Log($"[webview] WebView2 runtime not found ({ex.GetType().Name}: {ex.Message}) — install the " +
                "Evergreen runtime from https://developer.microsoft.com/microsoft-edge/webview2/ — exiting 1");
            return false;
        }
    }

    // ------------------------------------------------------------------------------------
    // the message loop
    // ------------------------------------------------------------------------------------

    /// <summary>
    /// ⚠️ WEBVIEW2 REQUIRES EVERY CALL ON THE UI THREAD, so the loop installs a
    /// SynchronizationContext that marshals continuations back into it. Without this, every
    /// `await` after the first resumes on the thread pool and the failure surfaces later, in
    /// an unrelated call, as an opaque COM error. Measured while retiring 20.2's first risk.
    /// </summary>
    private sealed class LoopContext : SynchronizationContext
    {
        public const uint WM_RUN = Win32.WM_APP + 1;

        private readonly ConcurrentQueue<(SendOrPostCallback Callback, object? State)> _queue = new();
        private readonly uint _threadId = Win32.GetCurrentThreadId();

        public override void Post(SendOrPostCallback d, object? state)
        {
            _queue.Enqueue((d, state));
            // A THREAD message, not a window message: the loop must survive the destruction
            // of every window it owns, which is exactly what happens during exit.
            Win32.PostThreadMessageW(_threadId, WM_RUN, IntPtr.Zero, IntPtr.Zero);
        }

        public override void Send(SendOrPostCallback d, object? state) => d(state);

        public void Drain()
        {
            while (_queue.TryDequeue(out var item)) item.Callback(item.State);
        }
    }

    private static int RunLoop(Func<Task> start, Action<Exception>? onFault)
    {
        var loop = new LoopContext();
        SynchronizationContext.SetSynchronizationContext(loop);

        Task task;
        try
        {
            task = start();
        }
        catch (Exception ex)
        {
            // A synchronous throw means no window exists yet, so there is no loop to quit.
            onFault?.Invoke(ex);
            return 1;
        }

        _ = task.ContinueWith(t =>
        {
            if (t.IsFaulted && t.Exception is not null) onFault?.Invoke(t.Exception.GetBaseException());
        }, TaskScheduler.FromCurrentSynchronizationContext());

        int exitCode = 0;
        while (true)
        {
            int result = Win32.GetMessageW(out MSG msg, IntPtr.Zero, 0, 0);
            if (result == 0)
            {
                exitCode = (int)msg.WParam;
                break;
            }
            if (result == -1)
            {
                Log("[loop] GetMessageW failed — leaving the loop with 1");
                exitCode = 1;
                break;
            }
            if (msg.Hwnd == IntPtr.Zero && msg.Message == LoopContext.WM_RUN)
            {
                loop.Drain();
                continue;
            }
            Win32.TranslateMessage(ref msg);
            Win32.DispatchMessageW(ref msg);
        }
        Log($"[loop] ended, exit {exitCode}");
        return exitCode;
    }

    // ------------------------------------------------------------------------------------
    // the log
    // ------------------------------------------------------------------------------------

    private static readonly object LogLock = new();
    private const long LogSizeCapBytes = 256 * 1024;

    /// <summary>
    /// ⚠️ UTF-8 WITH A BOM, AND WITHOUT ONE THE LOG WAS BEING MIS-DECODED BY THE THING MOST
    /// LIKELY TO READ IT. `File.AppendAllText`'s default is UTF-8 with NO preamble, so the
    /// file's encoding was undeclared; every ANSI-defaulting reader on a German Windows —
    /// `Get-Content` in Windows PowerShell 5.1, `type`, older Notepad — then renders an em
    /// dash as `â€"`. Measured 2026-09-15: `the parent window and this window are both gone —
    /// exiting` came back mangled from the very run that was proving the watchdog fix worked.
    ///
    /// ⚠️ IT IS NOT FIXABLE BY WRITING ASCII-ONLY MESSAGES, which is the tempting cheap answer.
    /// The log's dynamic content includes preset and reel NAMES out of the user's own library,
    /// and those are arbitrary Unicode; a rule about this file's literals could not cover them.
    /// Declaring the encoding is the fix that covers both.
    ///
    /// ⚠️ AND A BOM MAY ONLY BE WRITTEN AT POSITION 0. `AppendAllText` with an explicit
    /// encoding emits the preamble only when the stream starts empty, which is exactly the
    /// wanted behaviour — a BOM inserted mid-file would be garbage in the middle of a line.
    /// The size-cap `File.Delete` above leaves the next call writing a fresh file, so the
    /// rotated log gets its BOM too.
    /// </summary>
    private static readonly Encoding LogEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);

    /// <summary>
    /// A screensaver has no console and no window to report into, so the log file is the
    /// only diagnosis channel the host owns — and it is where plan 20.10's "clean exit 1
    /// with a log line" is observed.
    ///
    /// ⚠️ EVERY FAILURE HERE IS SWALLOWED ON PURPOSE. A screensaver that dies because it
    /// could not write its own log is strictly worse than one that plays silently, and the
    /// per-user directory can legitimately be unwritable (a roaming-profile failure, an
    /// AV quarantine). The cap keeps a machine that idles all day from growing it forever.
    /// </summary>
    internal static void Log(string line)
    {
        try
        {
            lock (LogLock)
            {
                string path = HostPaths.LogFile;
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                var info = new FileInfo(path);
                if (info.Exists && info.Length > LogSizeCapBytes) File.Delete(path);
                File.AppendAllText(path,
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture)
                    + "  " + line + Environment.NewLine, LogEncoding);
            }
        }
        catch
        {
            // Deliberately empty — see the note above.
        }
    }
}
