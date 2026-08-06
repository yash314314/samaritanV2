const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { startTracking, setActiveDeepWorkRef, clearActiveDeepWorkRef } = require("./tracker");
const { startSyncLoop } = require("./syncEngine");
const {
  connect: connectWs,
  on: onWs,
  subscribeToDeepWork,
  unsubscribeFromDeepWork
} = require("./wsClient");
const { flushCurrentSession, handleFocusIntervention } = require("./sessionEngine");

const isDev = !app.isPackaged;
const API_BASE = "http://localhost:4000";

let mainWindow;
let activeDeepWork = null;
let activeIntervention = null;

function setActiveDeepWork(session) {
  activeDeepWork = {
    id: session.id,
    goal: session.goal || null,
    plannedMinutes: session.plannedMinutes,
    enforcement: session.enforcement || "warn",
    startedAt: session.startedAt,
    allowedApps: session.allowedApps || [],
    allowedDomains: session.allowedDomains || [],
    blockedApps: session.blockedApps || [],
    blockedDomains: session.blockedDomains || []
  };

  // Sync the deep work session to the tracker for pre-emptive process killing
  setActiveDeepWorkRef(activeDeepWork);

  subscribeToDeepWork(activeDeepWork.id);
  console.log("[DeepWork] Desktop runtime armed:", {
    id: activeDeepWork.id,
    enforcement: activeDeepWork.enforcement,
    blockedApps: activeDeepWork.blockedApps,
    blockedDomains: activeDeepWork.blockedDomains
  });
}

async function clearActiveDeepWork(sessionId, endedAt = null) {
  const id = sessionId || activeDeepWork?.id;
  if (id) {
    await flushCurrentSession("deepwork-ended", endedAt);
  }
  if (id) unsubscribeFromDeepWork(id);
  clearActiveDeepWorkRef();
  activeDeepWork = null;
  activeIntervention = null;
  console.log("[DeepWork] Desktop runtime cleared");
}

function showIntervention(intervention) {
  const appName = intervention.appName || "This app";
  const action = intervention.action || activeDeepWork?.enforcement || "observe";
  const message =
    intervention.reason ||
    `${appName} is outside your active deep work protocol.`;

  activeIntervention = {
    id: intervention.id || null,
    appName,
    action,
    deepWorkId: intervention.deepWorkId || activeDeepWork?.id || null
  };

  handleFocusIntervention(
    {
      id: intervention.id,
      intervention,
      enforcement: action,
      message
    },
    appName
  );

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("show-intervention", {
      ...intervention,
      enforcement: action,
      message,
      activeDeepWork
    });
  }
}

function clearInterventionOverlay(payload = {}) {
  activeIntervention = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("focus-cleared", {
      ...payload,
      activeDeepWork
    });
  }
}

async function resolveActiveIntervention(reason) {
  if (!activeIntervention?.id) {
    console.warn("[DeepWork] Override requested, but no active intervention is tracked");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/focus/interventions/${activeIntervention.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        action: "allowed_once"
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[DeepWork] Override resolution failed:", response.status, text);
      return;
    }

    console.log("[DeepWork] Override reason recorded for intervention:", activeIntervention.id);
    activeIntervention = null;
  } catch (err) {
    console.error("[DeepWork] Override resolution error:", err.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../renderer/out/index.html")}`
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Connect WebSocket
  connectWs();

  // Listen for deep work events from server via WS
  onWs("deepwork:started", (session) => {
    console.log("[WS] Deep work started:", session.id);
    setActiveDeepWork(session);
  });

  onWs("deepwork:ended", ({ sessionId, result } = {}) => {
    console.log("[WS] Deep work ended");
    clearActiveDeepWork(sessionId, result?.endedAt).catch((err) => {
      console.error("[DeepWork] Failed to flush session on end:", err.message);
    });
  });

  onWs("deepwork:expired", ({ sessionId, endedAt } = {}) => {
    console.log("[WS] Deep work expired");
    clearActiveDeepWork(sessionId, endedAt).catch((err) => {
      console.error("[DeepWork] Failed to flush session on expiry:", err.message);
    });
  });

  onWs("intervention:triggered", (intervention) => {
    console.log("[WS] Intervention:", intervention.action, intervention.appName);
    showIntervention(intervention);
  });

  onWs("intervention:cleared", (payload) => {
    console.log("[WS] Intervention cleared:", payload?.appName || "allowed activity");
    clearInterventionOverlay(payload);
  });

  ipcMain.on("override-requested", (_event, data = {}) => {
    const reason = typeof data.reason === "string" ? data.reason.trim() : "";
    if (!reason) return;
    resolveActiveIntervention(reason);
  });

  startTracking();
  //startSyncLoop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
