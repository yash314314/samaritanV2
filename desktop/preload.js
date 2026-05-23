const { contextBridge, ipcRenderer } = require('electron');

// Safe API exposure for renderer
contextBridge.exposeInMainWorld('samaritanAPI', {
  onFocusBlocked: (callback) => ipcRenderer.on('focus-blocked', callback),
  onSessionTick: (callback) => ipcRenderer.on('session-tick', callback),
  requestOverride: (reason) => ipcRenderer.send('override-requested', { reason })
});