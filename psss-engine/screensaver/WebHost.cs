// 20.5 — the CoreWebView2 environment, the virtual origin, and the hybrid payload resolver.
//
// Shared verbatim by `/s` (ScreensaverWindow) and `/c` (ConfigWindow); the only difference
// between the two is the query string passed to AttachAsync and whether the input policy
// is armed. Everything about the environment — above all the user-data folder — is
// identical BY CONSTRUCTION, because D3's whole mechanism is that config mode writes the
// `localStorage` show mode reads.
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;

namespace Psss.Screensaver;

internal sealed class WebHost : IDisposable
{
    /// <summary>
    /// The virtual origin. A real host name is never contacted; every request on it is
    /// answered by <see cref="OnWebResourceRequested"/>.
    ///
    /// ⚠️ WHY NOT `SetVirtualHostNameToFolderMapping`: it maps a REAL FOLDER only, and by
    /// D4 half the payload is embedded in the binary. This is recorded as decided, not
    /// overlooked — and it is also why there is no local HTTP server here: the built page
    /// performs no runtime `fetch`, so nothing needs an origin except the scripts.
    /// </summary>
    public const string Origin = "https://psss.invalid/";

    private CoreWebView2Environment? _env;
    private CoreWebView2Controller? _controller;
    private CoreWebView2DevToolsProtocolEventReceiver? _console;
    private EventHandler<CoreWebView2DevToolsProtocolEventReceivedEventArgs>? _consoleHandler;
    private bool _disposed;

    /// <summary>20.6's page layer: `psss-exit` arrived, with its reason.</summary>
    public event Action<string>? ExitRequested;

    /// <summary>
    /// 20.1 item 7's channel: the engine's fatal throw on a missing preset library.
    /// ⚠️ Without this the host would present a black screen with no diagnosis, forever —
    /// which is indistinguishable, on screen, from a GPU failure.
    /// </summary>
    public event Action<string>? FatalReported;

    public CoreWebView2Controller? Controller => _controller;

    /// <summary>
    /// Creates the environment and the controller, wires the resolver, and navigates.
    /// ⚠️ EVERY WebView2 CALL MUST HAPPEN ON THE UI THREAD, so this method is only ever
    /// awaited under the message-loop SynchronizationContext Program installs. Awaiting it
    /// from the thread pool compiles, runs, and then fails in an unrelated place later.
    /// </summary>
    public async Task AttachAsync(IntPtr hwnd, RECT bounds, string query, bool hideOnCreate = false)
    {
        // ⚠️ THIS STRING IS WHY THIS HOST CANNOT BE PROFILED FROM OUTSIDE, and that is a constraint on
        // every future investigation, not a detail of this call. Setting `AdditionalBrowserArguments`
        // makes WebView2 IGNORE `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, so a `--remote-debugging-port`
        // cannot be injected into a shipped build; `AreDevToolsEnabled` is false besides. Every
        // in-host measurement is therefore EXTERNAL to the page (per-process CPU time, the log, the
        // screen). ⚠️ **Do not "fix" that by opening DevTools in a shipped screensaver.**
        //
        // ⚠️ `--disable-features=CalculateNativeWinOcclusion` WAS TRIED HERE ON 2026-09-16 AND
        // MEASURED NOT TO HELP — it is recorded rather than left in place, because a flag whose
        // comment claims a fix it does not deliver is worse than no flag. The defect: the owner's
        // "sometimes it does a pause after a few seconds". Measured in show mode with an external
        // per-process CPU sampler — one `msedgewebview2` PID burns NO measurable CPU for 1.3–1.8 s,
        // ~3–6 s after `presenting`, once per session, so `requestAnimationFrame` was never called and
        // no explanation the PAGE could own (a long task, a lazy compile, an upload, a GC — all of
        // which consume CPU) survives. ⚠️ **BOTH NUMBERS AND THE SCOPE ARE NARROWER THAN THE DEFECT:**
        // as of 2026-09-17 the owner's installed host shows TWO magnitude classes and this one is the
        // SHALLOW one (the deep class is ~3 s), and the sampler's idle-run reduction covers ONE PID —
        // the renderer and the GPU process share that process name, so the sentence above does not
        // say which. GPU-process work is NOT excluded. Read `probe/RUN-RECORD.md` §5.M before citing
        // any of it. Occlusion was the one component that takes that decision per-HWND on
        // a background thread a few seconds after a window appears, which is why it was the first
        // candidate; with the flag in, two of three surviving runs still stalled (1333 ms and 1732 ms).
        // ⚠️ **Whatever comes next, the before/after here rests on one or two surviving runs per side,
        // because eight of nine `/S` launches that day ended inside 1.5 s on the page's own input
        // funnel (README section 3) — so read a quiet run as "not reproduced", NEVER as "fixed".**
        var options = new CoreWebView2EnvironmentOptions(
            // Chromium throttles timers in a window it believes is backgrounded. A
            // screensaver is never in the foreground by Chromium's reckoning on some
            // systems, and the symptom is an animation that runs at 1 fps.
            additionalBrowserArguments: "--disable-background-timer-throttling --autoplay-policy=no-user-gesture-required");

        Directory.CreateDirectory(HostPaths.WebView2UserData);
        _env = await CoreWebView2Environment.CreateAsync(null, HostPaths.WebView2UserData, options);
        Program.Log($"[webview] runtime {CoreWebView2Environment.GetAvailableBrowserVersionString()}");

        _controller = await _env.CreateCoreWebView2ControllerAsync(hwnd);
        // No white flash before the first frame: the compositor's own clear colour.
        _controller.DefaultBackgroundColor = System.Drawing.Color.Black;
        if (hideOnCreate) _controller.IsVisible = false;
        _controller.Bounds = new System.Drawing.Rectangle(0, 0, bounds.Width, bounds.Height);

        CoreWebView2 core = _controller.CoreWebView2;
        CoreWebView2Settings s = core.Settings;
        s.AreDevToolsEnabled = false;
        s.AreDefaultContextMenusEnabled = false;
        s.IsStatusBarEnabled = false;
        // ⚠️ F12 and Ctrl+P must not reach Chromium from a screensaver.
        s.AreBrowserAcceleratorKeysEnabled = false;
        s.IsZoomControlEnabled = false;
        s.IsPinchZoomEnabled = false;
        s.IsSwipeNavigationEnabled = false;
        s.IsPasswordAutosaveEnabled = false;
        s.IsGeneralAutofillEnabled = false;

        core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += OnWebResourceRequested;
        core.WebMessageReceived += OnWebMessageReceived;
        core.ProcessFailed += (_, e) => Program.Log($"[webview] PROCESS FAILED {e.ProcessFailedKind}");
        core.NavigationCompleted += (_, e) =>
            Program.Log($"[webview] navigation completed success={e.IsSuccess} status={e.WebErrorStatus}");
        await AttachConsoleAsync(core);
        core.Navigate(Origin + PayloadFiles.IndexHtml + query);
        Program.Log($"[webview] navigating to {Origin}{PayloadFiles.IndexHtml}{query}");
    }

    /// <summary>
    /// The page's console, forwarded into the host log.
    ///
    /// ⚠️ THIS IS THE HOST'S ONLY WINDOW INTO THE PAGE, and it exists because the host
    /// cannot see a page-side failure at all otherwise: a GL failure, an engine warning,
    /// a rejected URL parameter and a perfectly playing reel are the same black-box from
    /// out here. It cost one open question to notice it was described but not built — the
    /// `?tab=` diagnosis below had to be run in a browser instead of in the host.
    ///
    /// ⚠️ It is a DIAGNOSIS ROUTE AND NOT AN ERROR DETECTOR: nothing here changes the exit
    /// code, and it must not — a `console.warn` is not a reason to end the user's session.
    /// The two channels that DO decide anything are `psss-exit` and `psss-fatal`, which the
    /// page posts explicitly.
    ///
    /// ⚠️ CDP, NOT AN INJECTED SHIM. Wrapping `console.*` from `AddScriptToExecuteOn…` would
    /// mean the host modifies the page, and then a host-only defect would be reachable from
    /// engine code — `Runtime.consoleAPICalled` observes without participating. It works
    /// with `AreDevToolsEnabled = false`, which gates the F12 WINDOW and not the protocol;
    /// if that ever changes the symptom is silence here, never a broken page, so the call
    /// is wrapped rather than allowed to take the host down with it.
    /// </summary>
    private async Task AttachConsoleAsync(CoreWebView2 core)
    {
        try
        {
            await core.CallDevToolsProtocolMethodAsync("Runtime.enable", "{}");
            _console = core.GetDevToolsProtocolEventReceiver("Runtime.consoleAPICalled");
            _consoleHandler = (_, e) => Program.Log("[page] " + DescribeConsoleEvent(e.ParameterObjectAsJson));
            _console.DevToolsProtocolEventReceived += _consoleHandler;
        }
        catch (Exception ex)
        {
            Program.Log($"[webview] console forwarding unavailable: {ex.Message}");
            _console = null;
            _consoleHandler = null;
        }
    }

    /// <summary>
    /// Flattens one `Runtime.consoleAPICalled` payload to a line.
    /// ⚠️ A remote object has no `value` — only a `description` (`Error: …`) or a
    /// `className`. Reading `value` alone turns every thrown error, the one kind of console
    /// line that matters most here, into an empty string.
    /// </summary>
    private static string DescribeConsoleEvent(string json)
    {
        try
        {
            using JsonDocument doc = JsonDocument.Parse(json);
            JsonElement root = doc.RootElement;
            string kind = root.TryGetProperty("type", out JsonElement t) ? t.GetString() ?? "log" : "log";
            var parts = new List<string>();
            if (root.TryGetProperty("args", out JsonElement args) && args.ValueKind == JsonValueKind.Array)
            {
                foreach (JsonElement arg in args.EnumerateArray())
                {
                    if (arg.TryGetProperty("value", out JsonElement v))
                    {
                        parts.Add(v.ValueKind == JsonValueKind.String ? v.GetString() ?? string.Empty : v.ToString());
                    }
                    else if (arg.TryGetProperty("description", out JsonElement d))
                    {
                        parts.Add(d.GetString() ?? string.Empty);
                    }
                    else if (arg.TryGetProperty("className", out JsonElement c))
                    {
                        parts.Add("<" + (c.GetString() ?? "object") + ">");
                    }
                    else if (arg.TryGetProperty("type", out JsonElement at))
                    {
                        parts.Add("<" + (at.GetString() ?? "?") + ">");
                    }
                }
            }
            return $"{kind}: {string.Join(' ', parts)}";
        }
        catch (JsonException ex)
        {
            return $"unreadable console event ({ex.Message})";
        }
    }

    public void SetBounds(RECT bounds)
    {
        if (_controller is null) return;
        _controller.Bounds = new System.Drawing.Rectangle(0, 0, bounds.Width, bounds.Height);
    }

    public void Show()
    {
        if (_controller is not null) _controller.IsVisible = true;
    }

    /// <summary>
    /// D4's two load paths, and ⚠️ THE ASYMMETRY BETWEEN THEM IS THE POINT OF THIS METHOD.
    ///
    /// | request                | source   | missing ⇒                                     |
    /// | index.html, the bundle | embedded | impossible — the .csproj pre-build step guards it |
    /// | psss_presets.json      | disk     | FATAL: 404, the page throws, `psss-fatal`, exit 1 |
    /// | psss_reels.json        | disk     | WARN ONLY: 404, the page plays BUILT_IN_REELS      |
    ///
    /// ⚠️ NEVER MAKE THE TWO DATA FILES SYMMETRIC. That asymmetry is an existing engine
    /// rule (the deployment loader's, and `main.ts`'s throw) and the host is its third
    /// enforcement site. Equalising them either makes a missing reel file kill the
    /// screensaver, or makes a missing preset library a silent black screen.
    /// </summary>
    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        string uri = e.Request.Uri;
        if (!uri.StartsWith(Origin, StringComparison.OrdinalIgnoreCase)) return;

        // Strip the origin and any query/fragment; `index.html?screensaver=1` is a request
        // for index.html.
        string path = uri.Substring(Origin.Length);
        int cut = path.IndexOfAny(new[] { '?', '#' });
        if (cut >= 0) path = path.Substring(0, cut);
        if (path.Length == 0) path = PayloadFiles.IndexHtml;

        Stream? content = null;
        if (path == PayloadFiles.IndexHtml || path == PayloadFiles.EngineJs)
        {
            content = PayloadFiles.OpenEmbedded(path);
            if (content is null)
            {
                // Unreachable by construction. Logged rather than thrown because a throw
                // inside this event handler is swallowed by the WebView2 event dispatch.
                Program.Log($"[payload] EMBEDDED RESOURCE MISSING: {path} — the build's pre-build copy did not run");
            }
        }
        else if (path == PayloadFiles.PresetsData || path == PayloadFiles.ReelsData)
        {
            string? onDisk = PayloadFiles.FindOnDisk(path);
            if (onDisk is null)
            {
                bool fatal = path == PayloadFiles.PresetsData;
                string where = string.Join(" then ", PayloadFiles.DataDirectories());
                Program.Log(fatal
                    ? $"[payload] FATAL: {path} not found in {where} — the page will report psss-fatal"
                    : $"[payload] warning: {path} not found in {where} — the built-in reels will play");
            }
            else
            {
                content = File.OpenRead(onDisk);
                Program.Log($"[payload] {path} from disk: {onDisk}");
            }
        }
        else
        {
            // favicon and anything else the page happens to ask for.
            Program.Log($"[payload] 404 {path}");
        }

        if (content is null)
        {
            e.Response = _env!.CreateWebResourceResponse(null, 404, "Not Found", string.Empty);
            return;
        }

        string headers = $"Content-Type: {PayloadFiles.MimeFor(path)}\r\nCache-Control: no-store";
        e.Response = _env!.CreateWebResourceResponse(content, 200, "OK", headers);
    }

    /// <summary>
    /// 20.6's page layer. ⚠️ `psss-exit` and `psss-fatal` are NOT symmetric and must not
    /// be collapsed into one handler that "exits either way": the first is the user waking
    /// the machine and exits 0, the second is a broken installation and exits 1 with a log
    /// line naming the file. A screensaver that exits 0 on a missing preset library reads
    /// as "it flickers and goes away", which diagnoses nothing.
    /// </summary>
    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string json;
        try { json = e.WebMessageAsJson; }
        catch (Exception ex) { Program.Log($"[page] unreadable web message: {ex.Message}"); return; }

        string? type = null, reason = null, message = null;
        try
        {
            using JsonDocument doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return;
            foreach (JsonProperty prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.String) continue;
                switch (prop.Name)
                {
                    case "type": type = prop.Value.GetString(); break;
                    case "reason": reason = prop.Value.GetString(); break;
                    case "message": message = prop.Value.GetString(); break;
                }
            }
        }
        catch (JsonException ex) { Program.Log($"[page] non-JSON web message ({ex.Message}): {json}"); return; }

        switch (type)
        {
            case "psss-exit":
                ExitRequested?.Invoke("the page reported " + (reason ?? "an input"));
                break;
            case "psss-fatal":
                FatalReported?.Invoke(message ?? "the page reported a fatal error with no message");
                break;
            default:
                Program.Log($"[page] web message ignored: {json}");
                break;
        }
    }

    /// <summary>
    /// ⚠️ Idempotent, and the null-out is invariant 1's shape from the engine side of this
    /// project: a disposed controller whose handle is still held is a call that fails in a
    /// process with no console.
    /// </summary>
    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        // Unsubscribed before the controller closes, invariant 15's shape: the receiver
        // outlives nothing, but a handler firing during teardown logs into a Program.Log
        // whose file the exit path may already have finished with.
        if (_console is not null && _consoleHandler is not null)
        {
            _console.DevToolsProtocolEventReceived -= _consoleHandler;
        }
        _console = null;
        _consoleHandler = null;
        try { _controller?.Close(); }
        catch (Exception ex) { Program.Log($"[webview] controller close threw: {ex.Message}"); }
        _controller = null;
        _env = null;
    }
}
