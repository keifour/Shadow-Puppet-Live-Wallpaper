using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;

public sealed class DesktopHostException : Exception {
    public string Code { get; private set; }
    public DesktopHostException(string code, string message) : base(message) { Code = code; }
}

public sealed class DesktopLayout {
    public IntPtr Progman, DefView, ChildWorker;
    public bool Raised;
    public readonly List<IntPtr> ClassicWorkers = new List<IntPtr>();
}

public sealed class DesktopTarget {
    public IntPtr Parent, InsertAfter;
    public string Mode;
}

public static class DesktopHost {
    const string Prefix = "ShadowPuppet.";
    const int StyleIndex = -16, ExStyleIndex = -20;
    const int ChildStyle = 0x40000000, Layered = 0x80000, NoRedirectionBitmap = 0x200000;
    static readonly string[] Properties = { "Style", "ExStyle", "Parent", "Left", "Top", "Width", "Height", "Saved" };
    public delegate bool EnumProc(IntPtr hwnd, IntPtr arg);
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr arg);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hwnd);
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetParent(IntPtr child, IntPtr parent);
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, IntPtr wp, IntPtr lp, uint flags, uint timeout, out IntPtr result);
    [DllImport("user32.dll", SetLastError=true)] static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll", SetLastError=true)] static extern int SetWindowLong(IntPtr hwnd, int index, int value);
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool SetProp(IntPtr hwnd, string name, IntPtr data);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetProp(IntPtr hwnd, string name);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr RemoveProp(IntPtr hwnd, string name);
    [DllImport("user32.dll", SetLastError=true)] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll", SetLastError=true)] static extern int MapWindowPoints(IntPtr from, IntPtr to, ref Point point, uint count);
    [DllImport("user32.dll", SetLastError=true)] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll", SetLastError=true)] static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint key, byte alpha, uint flags);
    [DllImport("kernel32.dll")] static extern void SetLastError(uint error);

    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    static void ConfigureDpi() {
        try { SetThreadDpiAwarenessContext(new IntPtr(-4)); }
        catch (EntryPointNotFoundException) { SetProcessDPIAware(); }
    }

    // Pure selection logic also tested against synthetic Explorer layouts.
    public static DesktopTarget SelectTarget(DesktopLayout layout) {
        if (layout.Progman == IntPtr.Zero) throw new DesktopHostException("EXPLORER_UNAVAILABLE", "Explorer desktop is unavailable.");
        if (layout.DefView != IntPtr.Zero && layout.ChildWorker != IntPtr.Zero) {
            return new DesktopTarget { Parent = layout.Progman, InsertAfter = layout.DefView, Mode = "raised" };
        }
        // A raised desktop must not use an unrelated or stale top-level WorkerW.
        if (!layout.Raised && layout.ClassicWorkers.Count > 0) {
            return new DesktopTarget { Parent = layout.ClassicWorkers[0], InsertAfter = new IntPtr(1), Mode = "classic" };
        }
        throw new DesktopHostException("DESKTOP_HOST_UNAVAILABLE", "No compatible Explorer wallpaper layer was found.");
    }

    static DesktopLayout ReadLayout(IntPtr progman) {
        var layout = new DesktopLayout {
            Progman = progman,
            Raised = (GetWindowLong(progman, ExStyleIndex) & NoRedirectionBitmap) != 0,
            DefView = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null),
            ChildWorker = FindWindowEx(progman, IntPtr.Zero, "WorkerW", null)
        };
        EnumWindows((top, unused) => {
            if (FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero) {
                var worker = FindWindowEx(IntPtr.Zero, top, "WorkerW", null);
                if (worker != IntPtr.Zero && FindWindowEx(worker, IntPtr.Zero, "SHELLDLL_DefView", null) == IntPtr.Zero)
                    layout.ClassicWorkers.Add(worker);
            }
            return true;
        }, IntPtr.Zero);
        return layout;
    }

    static DesktopTarget Discover() {
        var progman = FindWindow("Progman", null);
        if (progman == IntPtr.Zero) throw new DesktopHostException("EXPLORER_UNAVAILABLE", "Explorer desktop is unavailable.");
        IntPtr ignored;
        // Current Explorer uses 0xD/1; retain the older request only for classic desktops.
        SendMessageTimeout(progman, 0x052C, new IntPtr(0xD), new IntPtr(1), 2, 1000, out ignored);
        for (int attempt = 0; attempt < 10; attempt++) {
            var layout = ReadLayout(progman);
            try { return SelectTarget(layout); }
            catch (DesktopHostException error) {
                if (error.Code != "DESKTOP_HOST_UNAVAILABLE") throw;
                if (attempt == 2 && !layout.Raised)
                    SendMessageTimeout(progman, 0x052C, IntPtr.Zero, IntPtr.Zero, 2, 1000, out ignored);
                if (attempt == 9) throw;
            }
            System.Threading.Thread.Sleep(100);
        }
        throw new DesktopHostException("DESKTOP_HOST_UNAVAILABLE", "Explorer did not create a wallpaper layer.");
    }

    static void NativeError(string operation) {
        int error = Marshal.GetLastWin32Error();
        throw new DesktopHostException(error == 5 ? "ACCESS_DENIED" : "NATIVE_OPERATION_FAILED", operation + ": " + new Win32Exception(error).Message);
    }
    static void ChangeStyle(IntPtr hwnd, int index, int value) {
        SetLastError(0);
        int previous = SetWindowLong(hwnd, index, value);
        if (previous == 0 && Marshal.GetLastWin32Error() != 0) NativeError("SetWindowLong");
    }
    static void ChangeParent(IntPtr child, IntPtr parent) {
        SetLastError(0);
        IntPtr previous = SetParent(child, parent);
        if (previous == IntPtr.Zero && Marshal.GetLastWin32Error() != 0) NativeError("SetParent");
    }
    static void Save(IntPtr hwnd, string name, IntPtr value) {
        if (!SetProp(hwnd, Prefix + name, value)) NativeError("SetProp");
    }
    static IntPtr Load(IntPtr hwnd, string name) { return GetProp(hwnd, Prefix + name); }
    static void Clear(IntPtr hwnd) { foreach (string name in Properties) RemoveProp(hwnd, Prefix + name); }
    static void Place(IntPtr hwnd, IntPtr parent, IntPtr after, int left, int top, int width, int height) {
        var origin = new Point { X = left, Y = top };
        SetLastError(0);
        int mapped = MapWindowPoints(IntPtr.Zero, parent, ref origin, 1);
        if (mapped == 0 && Marshal.GetLastWin32Error() != 0) NativeError("MapWindowPoints");
        if (!SetWindowPos(hwnd, after, origin.X, origin.Y, width, height, 0x10 | 0x20 | 0x40)) NativeError("SetWindowPos");
    }
    static void Restore(IntPtr child) {
        var parent = Load(child, "Parent");
        if (parent != IntPtr.Zero && !IsWindow(parent)) parent = IntPtr.Zero;
        ChangeParent(child, parent);
        ChangeStyle(child, StyleIndex, Load(child, "Style").ToInt32());
        ChangeStyle(child, ExStyleIndex, Load(child, "ExStyle").ToInt32());
        Place(child, parent, IntPtr.Zero, Load(child, "Left").ToInt32(), Load(child, "Top").ToInt32(), Load(child, "Width").ToInt32(), Load(child, "Height").ToInt32());
        Clear(child);
    }
    public static string Apply(IntPtr child, bool attach, int left, int top, int width, int height) {
        ConfigureDpi();
        if (!IsWindow(child)) throw new DesktopHostException("WINDOW_UNAVAILABLE", "Application window is unavailable.");
        if (!attach) {
            if (Load(child, "Saved") != IntPtr.Zero) Restore(child);
            return "window";
        }
        if (width <= 0 || height <= 0) throw new DesktopHostException("INVALID_BOUNDS", "Invalid screen bounds.");
        if (Load(child, "Saved") != IntPtr.Zero) throw new DesktopHostException("ALREADY_ATTACHED", "Restore the application window before attaching again.");
        var target = Discover();
        return AttachToTarget(child, target, left, top, width, height);
    }
    // Kept public for native integration tests using isolated synthetic windows.
    public static string AttachToTarget(IntPtr child, DesktopTarget target, int left, int top, int width, int height) {
        if (!IsWindow(child) || !IsWindow(target.Parent)) throw new DesktopHostException("WINDOW_UNAVAILABLE", "Desktop or application window has disappeared.");
        if (Load(child, "Saved") != IntPtr.Zero) throw new DesktopHostException("ALREADY_ATTACHED", "Application window is already attached.");
        int style = GetWindowLong(child, StyleIndex), exStyle = GetWindowLong(child, ExStyleIndex);
        Rect rect;
        if (!GetWindowRect(child, out rect)) NativeError("GetWindowRect");
        try {
            Save(child, "Style", new IntPtr(style)); Save(child, "ExStyle", new IntPtr(exStyle));
            Save(child, "Parent", GetParent(child));
            Save(child, "Left", new IntPtr(rect.Left)); Save(child, "Top", new IntPtr(rect.Top));
            Save(child, "Width", new IntPtr(rect.Right - rect.Left)); Save(child, "Height", new IntPtr(rect.Bottom - rect.Top));
            Save(child, "Saved", new IntPtr(1));
        } catch { Clear(child); throw; }
        try {
            ChangeStyle(child, StyleIndex, (style | ChildStyle) & unchecked((int)~0x80000000) & ~0x00CF0000 & ~0x21000000);
            if (target.Mode == "raised") {
                ChangeStyle(child, ExStyleIndex, (exStyle | Layered) & ~0x40000);
                if (!SetLayeredWindowAttributes(child, 0, 255, 2)) NativeError("SetLayeredWindowAttributes");
            }
            ChangeParent(child, target.Parent);
            Place(child, target.Parent, target.InsertAfter, left, top, width, height);
            return target.Mode;
        } catch (Exception error) {
            try { Restore(child); }
            catch (Exception rollback) { throw new DesktopHostException("RESTORE_FAILED", error.Message + "; restore: " + rollback.Message); }
            throw;
        }
    }
}
