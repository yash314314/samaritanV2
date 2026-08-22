const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("widgetAPI", {
  ready: () => ipcRenderer.send("widget:ready"),
  setExpanded: (expanded) => ipcRenderer.send("widget:setExpanded", Boolean(expanded)),
  setPinned: (pinned) => ipcRenderer.send("widget:setPinned", Boolean(pinned)),
  hide: () => ipcRenderer.send("widget:hide"),
  openDashboard: (route) => ipcRenderer.send("widget:openDashboard", route),
  startFocus: (targetMinutes, goal) => ipcRenderer.send("widget:startFocus", { targetMinutes, goal }),
  endFocus: (sessionId) => ipcRenderer.send("widget:endFocus", { sessionId }),
  quickTag: (projectId, activityId) => ipcRenderer.send("widget:quickTag", { projectId, activityId }),
  snoozeBreak: (breakId, minutes) => ipcRenderer.send("widget:snoozeBreak", { breakId, minutes }),
  startBreak: (breakId) => ipcRenderer.send("widget:startBreak", { breakId }),
  onState: (callback) => ipcRenderer.on("widget:state", (_event, payload) => callback(payload)),
  onActionResult: (callback) => ipcRenderer.on("widget:actionResult", (_event, payload) => callback(payload)),
  onWindowState: (callback) => ipcRenderer.on("widget:windowState", (_event, payload) => callback(payload)),
});
