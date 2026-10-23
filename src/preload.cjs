const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  toggleWallpaper: () => ipcRenderer.invoke('wallpaper:toggle'),
  onWallpaper: callback => ipcRenderer.on('wallpaper-state', (_event, active) => callback(active)),
  minimize: () => ipcRenderer.send('window:minimize')
});
