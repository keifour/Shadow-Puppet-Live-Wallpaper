param([Parameter(Mandatory=$true)][long]$WindowHandle, [ValidateSet('0','1')][string]$Attach = '1')
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DesktopHost {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lparam);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindow(string cls, string title);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr arg);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetParent(IntPtr child, IntPtr parent);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, IntPtr wp, IntPtr lp, uint flags, uint timeout, out IntPtr result);
  [DllImport("kernel32.dll")] public static extern void SetLastError(uint error);
  [DllImport("user32.dll", SetLastError=true)] public static extern int GetWindowLong(IntPtr hwnd, int index);
  [DllImport("user32.dll", SetLastError=true)] public static extern int SetWindowLong(IntPtr hwnd, int index, int value);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool SetProp(IntPtr hwnd, string name, IntPtr data);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr GetProp(IntPtr hwnd, string name);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr RemoveProp(IntPtr hwnd, string name);
  public static void Apply(IntPtr child, bool attach) {
    IntPtr host = IntPtr.Zero;
    if (attach) {
      IntPtr progman = FindWindow("Progman", null), result;
      if (progman == IntPtr.Zero) throw new Exception("Windows Explorer desktop was not found.");
      SendMessageTimeout(progman, 0x052C, IntPtr.Zero, IntPtr.Zero, 2, 1000, out result);
      EnumWindows((top, unused) => {
        if (FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero) {
          host = FindWindowEx(IntPtr.Zero, top, "WorkerW", null);
          return host == IntPtr.Zero;
        }
        return true;
      }, IntPtr.Zero);
      if (host == IntPtr.Zero) throw new Exception("Compatible WorkerW desktop host unavailable; use window preview.");
    }
    int original = GetWindowLong(child, -16);
    if (attach) {
      if (!SetProp(child, "ShadowPuppetOriginalStyle", new IntPtr(original))) throw new Exception("Cannot retain window style.");
      SetWindowLong(child, -16, (original | 0x40000000) & unchecked((int)~0x80000000) & ~0x00CF0000);
    }
    SetLastError(0);
    SetParent(child, host);
    int error = Marshal.GetLastWin32Error();
    if (error != 0) {
      if (attach) { SetWindowLong(child, -16, original); RemoveProp(child, "ShadowPuppetOriginalStyle"); }
      throw new System.ComponentModel.Win32Exception(error);
    }
    if (!attach) {
      IntPtr saved = GetProp(child, "ShadowPuppetOriginalStyle");
      if (saved != IntPtr.Zero) SetWindowLong(child, -16, saved.ToInt32());
      RemoveProp(child, "ShadowPuppetOriginalStyle");
    }
  }
}
'@
[DesktopHost]::Apply([IntPtr]$WindowHandle, $Attach -eq '1')
