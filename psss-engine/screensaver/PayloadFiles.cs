// D8's mitigation, and the whole reason this file exists.
//
// ⚠️ THE FOUR PAYLOAD FILENAMES ARE SPELLED HERE AND NOWHERE ELSE IN THE HOST.
// Plan 20.10 item 4 records the accepted gap: with no `scrcheck`, these names now live
// in a FOURTH place with no compiler between the copies (`vite.config.ts`,
// `presets/reel-store.ts`, `scripts/export-library.mjs`, and this host). A rename on the
// engine side does not break this build — it produces a screensaver that 404s and, for
// the reel file, does so SILENTLY BY DESIGN. The mitigation is that a reader auditing
// the gap has exactly one place to look on this side. Do not spell any of these four
// strings anywhere else, the .csproj included (see its EmbeddedResource comment).
using System;
using System.IO;
using System.Reflection;

namespace Psss.Screensaver;

internal static class PayloadFiles
{
    /// <summary>The built page. D4: embedded in the binary, never read from disk.</summary>
    public const string IndexHtml = "index.html";

    /// <summary>The engine bundle. D4: embedded.</summary>
    public const string EngineJs = "psss-engine.js";

    /// <summary>
    /// The preset library. D4: read from disk so it stays editable.
    /// ⚠️ FATAL if missing — see WebHost's resolver and the asymmetry note there.
    /// </summary>
    public const string PresetsData = "psss_presets.json";

    /// <summary>
    /// The reels. D4: read from disk. ⚠️ OPTIONAL — missing means warn and play
    /// BUILT_IN_REELS. Never made symmetric with the presets file.
    /// </summary>
    public const string ReelsData = "psss_reels.json";

    /// <summary>20.7's thumbnail. Embedded; there is no disk fallback and none is wanted.</summary>
    public const string PreviewImage = "preview.png";

    /// <summary>
    /// ⚠️ BOTH DATA FILES ARE JAVASCRIPT BY CONTENT DESPITE THE `.json` NAME — each is a
    /// single `var g_psss_* = {...}` assignment loaded by `&lt;script defer&gt;`. Serving them
    /// as `application/json` yields a page that loads NOTHING and logs nothing useful,
    /// because the browser refuses to execute a script with a JSON MIME type. This is the
    /// same trap the four-file web deployment documents; the host is now its third site.
    /// </summary>
    public static string MimeFor(string fileName) => fileName switch
    {
        IndexHtml => "text/html",
        EngineJs => "text/javascript",
        PresetsData => "text/javascript",
        ReelsData => "text/javascript",
        _ => "application/octet-stream",
    };

    /// <summary>
    /// D4's embedded half. Matched by SUFFIX against the single spelling above rather than
    /// by a `LogicalName` in the .csproj, which would be a second spelling of the same
    /// name in a file nothing compares against this one.
    /// </summary>
    public static Stream? OpenEmbedded(string fileName)
    {
        Assembly asm = typeof(PayloadFiles).Assembly;
        string[] names = asm.GetManifestResourceNames();
        foreach (string name in names)
        {
            if (name.EndsWith(fileName, StringComparison.OrdinalIgnoreCase))
            {
                return asm.GetManifestResourceStream(name);
            }
        }
        return null;
    }

    /// <summary>
    /// D4's disk half, in the order 20.9's two install layouts need: beside the
    /// executable first (the no-elevation layout), then the per-user data directory (the
    /// `System32` layout, where writing beside the `.scr` would need elevation).
    /// ⚠️ Returns null rather than throwing — the CALLER owns the fatal/warn asymmetry,
    /// because a resolver that throws makes the two files symmetric by construction.
    /// </summary>
    public static string? FindOnDisk(string fileName)
    {
        foreach (string dir in DataDirectories())
        {
            string candidate = Path.Combine(dir, fileName);
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    public static string[] DataDirectories()
    {
        // ⚠️ `Assembly.Location` is EMPTY in a single-file publish. ProcessPath is the
        // only reading of "the executable's directory" that survives it.
        string? exe = Environment.ProcessPath;
        string exeDir = exe is null ? AppContext.BaseDirectory : (Path.GetDirectoryName(exe) ?? AppContext.BaseDirectory);
        return new[] { exeDir, HostPaths.DataDirectory };
    }
}

/// <summary>
/// ⚠️ THE USER-DATA FOLDER IS THE SINGLE LINE THAT MAKES D3 WORK, so it is a constant
/// shared by `/s` and `/c` rather than a string at two call sites. The Reel tab's
/// `Main reel` checkbox persists through `localStorage` under key `psss.reels.v1`, which
/// lives inside the WebView2 user-data folder. If show mode and config mode ever get
/// DIFFERENT folders, config silently does nothing and nothing in either codebase says so.
/// </summary>
internal static class HostPaths
{
    private static string Root => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "psss", "screensaver");

    public static string WebView2UserData => Path.Combine(Root, "WebView2");

    public static string DataDirectory => Path.Combine(Root, "data");

    public static string LogFile => Path.Combine(Root, "screensaver.log");
}
