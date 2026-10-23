$ErrorActionPreference = 'Stop'
$assembly = Join-Path ([System.IO.Path]::GetTempPath()) ('ShadowPuppetNative-' + [Guid]::NewGuid().ToString('N') + '.dll')
Add-Type -Path (Join-Path $PSScriptRoot '../scripts/DesktopHost.cs') -OutputAssembly $assembly
Add-Type -Path $assembly
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DesktopNativeTests {
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowEx(uint ex, string cls, string name, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr data);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out DesktopHost.Rect rect);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window, uint command);
    static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
    public static void Run() {
        var classic = new DesktopLayout { Progman = new IntPtr(10) };
        classic.ClassicWorkers.Add(new IntPtr(20));
        Check(DesktopHost.SelectTarget(classic).Parent == new IntPtr(20), "Classic sibling selection failed");
        var modern = new DesktopLayout { Progman = new IntPtr(10), DefView = new IntPtr(11), ChildWorker = new IntPtr(12), Raised = true };
        modern.ClassicWorkers.Add(new IntPtr(99));
        Check(DesktopHost.SelectTarget(modern).Parent == new IntPtr(10), "Raised desktop must use Progman");
        Check(DesktopHost.SelectTarget(modern).InsertAfter == new IntPtr(11), "Must render below icons");
        modern.ChildWorker = IntPtr.Zero;
        try { DesktopHost.SelectTarget(modern); throw new Exception("Unsupported raised layout accepted"); }
        catch (DesktopHostException error) { Check(error.Code == "DESKTOP_HOST_UNAVAILABLE", "Wrong failure code"); }
        var host = CreateWindowEx(0, "STATIC", "test host", 0x00CF0000, 100, 150, 800, 600, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
        var icon = CreateWindowEx(0, "STATIC", "test icons", 0x40000000, 0, 0, 100, 100, host, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
        var app = CreateWindowEx(0, "STATIC", "test app", 0x90000000, 30, 40, 200, 180, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
        Check(host != IntPtr.Zero && icon != IntPtr.Zero && app != IntPtr.Zero, "Synthetic HWND creation failed");
        try {
            int style = GetWindowLong(app, -16), ex = GetWindowLong(app, -20);
            for (int iteration = 0; iteration < 2; iteration++) {
                string mode = iteration == 0 ? "classic" : "raised";
                var target = new DesktopTarget { Parent = host, InsertAfter = iteration == 0 ? new IntPtr(1) : icon, Mode = mode };
                Check(DesktopHost.AttachToTarget(app, target, 120, 180, 500, 350) == mode, "Attach failed");
                DesktopHost.Rect bounds;
                Check(GetWindowRect(app, out bounds) && bounds.Left == 120 && bounds.Top == 180 && bounds.Right - bounds.Left == 500 && bounds.Bottom - bounds.Top == 350, "Host coordinates must map to screen bounds");
                Check(GetParent(app) == host, "Parent not updated");
                Check((GetWindowLong(app, -16) & 0x40000000) != 0, "WS_CHILD not applied");
                if (iteration == 1) {
                    Check((GetWindowLong(app, -20) & 0x80000) != 0, "Layered style missing");
                    Check(GetWindow(app, 3) == icon, "App must be below icons");
                }
                DesktopHost.Apply(app, false, 0, 0, 0, 0);
                Check(GetParent(app) == IntPtr.Zero, "Original parent not restored");
                Check(GetWindowLong(app, -16) == style, "Original style not restored");
                Check(GetWindowLong(app, -20) == ex, "Original extended style not restored");
            }
            try {
                DesktopHost.AttachToTarget(app, new DesktopTarget { Parent = host, InsertAfter = new IntPtr(123456789), Mode = "classic" }, 120, 180, 500, 350);
                throw new Exception("Invalid insertion HWND should fail");
            } catch (DesktopHostException) {
                Check(GetParent(app) == IntPtr.Zero && GetWindowLong(app, -16) == style, "Failed attach was not rolled back");
            }
        } finally { DestroyWindow(app); DestroyWindow(icon); DestroyWindow(host); }
    }
}
'@ -ReferencedAssemblies $assembly
[DesktopNativeTests]::Run()
# Test the actual helper process protocol, including a failing request.
$helper = Join-Path $PSScriptRoot '../scripts/wallpaper.ps1'
$output = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $helper -WindowHandle 0 -Attach 1 -Width 800 -Height 600
if ($LASTEXITCODE -ne 1) { throw 'Invalid handle must return failure exit code' }
$result = $output | ConvertFrom-Json
if ($result.ok -ne $false -or $result.code -ne 'WINDOW_UNAVAILABLE') { throw 'Helper JSON error protocol failed' }
Write-Output 'Native tests passed: classic/raised discovery, HWND attach/detach, z-order, styles, rollback and helper JSON.'
