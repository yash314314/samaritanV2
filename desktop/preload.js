const { contextBridge, ipcRenderer } = require('electron');

// Safe API exposure for renderer
contextBridge.exposeInMainWorld('samaritanAPI', {
  onFocusBlocked: (callback) => ipcRenderer.on('focus-blocked', callback),
  onIntervention: (callback) => ipcRenderer.on('show-intervention', callback),
  onFocusCleared: (callback) => ipcRenderer.on('focus-cleared', callback),
  onSessionTick: (callback) => ipcRenderer.on('session-tick', callback),
  requestOverride: (reason) => ipcRenderer.send('override-requested', { reason })
});

// Device link: the signed-in dashboard hands the tracker its own credential.
contextBridge.exposeInMainWorld('samaritanDesktop', {
  status: () => ipcRenderer.invoke('auth:status'),
  link: (refreshToken) => ipcRenderer.invoke('auth:link', refreshToken),
  unlink: () => ipcRenderer.invoke('auth:unlink')
});
