const { app, BrowserWindow, ipcMain, session, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('node:path');
const { execFile } = require('node:child_process');
let win, tray, wallpaper = false, busy = false, quitting = false, priorBounds;
const page = path.join(__dirname, 'index.html');
function nativeAttach(attach) {
  return new Promise((resolve, reject) => {
    const handle = win.getNativeWindowHandle();
    const hwnd = handle.length === 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString();
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', (app.isPackaged ? path.join(process.resourcesPath, 'wallpaper.ps1') : path.join(__dirname, '../scripts/wallpaper.ps1')), '-WindowHandle', hwnd, '-Attach', attach ? '1' : '0'], { windowsHide: true, timeout: 15000 }, (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve(stdout));
  });
}
async function toggleWallpaper() {
  if (process.platform !== 'win32') return { error: '桌面嵌入仅支持 Windows；当前可使用窗口预览。' };
  if (busy) return { error: '正在切换桌面模式，请稍候。' };
  busy = true;
  try {
    if (!wallpaper) {
      priorBounds = win.getBounds();
      await nativeAttach(true);
      wallpaper = true;
      win.setBounds(screen.getPrimaryDisplay().bounds);
      win.setSkipTaskbar(true);
      win.webContents.send('wallpaper-state', true);
    } else {
      await nativeAttach(false);
      wallpaper = false;
      win.setSkipTaskbar(false);
      win.setBounds(priorBounds);
      win.show();
      win.webContents.send('wallpaper-state', false);
    }
    return { wallpaper };
  } catch (err) { return { error: `桌面模式切换失败：${err.message}` }; }
  finally { busy = false; }
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(contents === win?.webContents && permission === 'media' && details.mediaTypes?.every(t => t === 'video'));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => contents === win?.webContents && permission === 'media' && details.mediaType === 'video');
  win = new BrowserWindow({ width: 1280, height: 820, minWidth: 850, minHeight: 620, backgroundColor: '#080d13', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.loadFile(page);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('close', e => { if (!quitting && tray) { e.preventDefault(); win.hide(); } });
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==').resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Shadow Puppet · 皮影');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开控制台', click: async () => { if (wallpaper) { const result = await toggleWallpaper(); if (result.error) require('electron').dialog.showErrorBox('桌面模式', result.error); } win.show(); } },
    { label: '切换桌面壁纸模式', click: async () => { const result = await toggleWallpaper(); if (result.error) require('electron').dialog.showErrorBox('桌面模式', result.error); } },
    { type: 'separator' }, { label: '退出（关闭摄像头）', click: () => app.quit() }
  ]));
  tray.on('double-click', async () => { if (wallpaper) { const result = await toggleWallpaper(); if (result.error) require('electron').dialog.showErrorBox('桌面模式', result.error); } win.show(); });
  ipcMain.handle('wallpaper:toggle', toggleWallpaper);
  ipcMain.on('window:minimize', () => win.minimize());
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
