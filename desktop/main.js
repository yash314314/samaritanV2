const { app, BrowserWindow, ipcMain, Notification, Menu, Tray, screen } = require("electron");
const path = require("path");
const {
  startTracking,
  setActiveDeepWorkRef,
  clearActiveDeepWorkRef,
  setDistractionRulesRef,
} = require("./tracker");
const { startSyncLoop } = require("./syncEngine");
const {
  connect: connectWs,
  on: onWs,
  subscribeToDeepWork,
  unsubscribeFromDeepWork,
  send: sendWs,
} = require("./wsClient");
const { flushCurrentSession, handleFocusIntervention } = require("./sessionEngine");

const isDev = !app.isPackaged;
const API_BASE = "http://localhost:4000";
const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

let mainWindow;
let widgetWindow;
let tray;
let widgetExpanded = false;
let widgetPinned = true;
let quitting = false;
let activeDeepWork = null;
let activeIntervention = null;

function setActiveDeepWork(session) {
  if (activeDeepWork?.id && activeDeepWork.id !== session.id) {
    unsubscribeFromDeepWork(activeDeepWork.id);
  }

  activeDeepWork = {
    id: session.id,
    goal: session.goal || null,
    plannedMinutes: session.plannedMinutes,
    enforcement: session.enforcement || "warn",
    startedAt: session.startedAt,
    allowedApps: session.allowedApps || [],
    allowedDomains: session.allowedDomains || [],
    blockedApps: session.blockedApps || [],
    blockedDomains: session.blockedDomains || [],
    currentPhase: session.currentPhase || "focus",
    paused: Boolean(session.paused ?? session.pausedAt)
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

async function hydrateActiveDeepWork() {
  try {
    const response = await fetch(`${API_BASE}/focus/active?userId=${USER_ID}`);
    if (!response.ok) return;

    const session = await response.json();
    if (session?.id) {
      setActiveDeepWork(session);
    } else if (activeDeepWork) {
      await clearActiveDeepWork(activeDeepWork.id);
    }
  } catch (err) {
    console.warn("[DeepWork] Active session hydration failed:", err.message);
  }
}

async function hydrateDistractionBlocks() {
  try {
    const response = await fetch(`${API_BASE}/api/distraction-blocks/active?userId=${USER_ID}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state = await response.json();
    setDistractionRulesRef(state.rules || []);
  } catch (err) {
    console.warn("[DistractionBlocker] Rule hydration failed:", err.message);
  }
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
        userId: USER_ID,
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

function positionWidget() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const [width, height] = widgetWindow.getSize();
  widgetWindow.setPosition(
    display.workArea.x + display.workArea.width - width - 18,
    display.workArea.y + display.workArea.height - height - 18,
    false
  );
}

function createWidgetWindow() {
  widgetWindow = new BrowserWindow({
    width: 360,
    height: 90,
    minWidth: 360,
    maxWidth: 360,
    minHeight: 90,
    maxHeight: 320,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "widgetPreload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widgetWindow.loadFile(path.join(__dirname, "renderer", "widget.html"));
  widgetWindow.once("ready-to-show", () => {
    positionWidget();
    widgetWindow.showInactive();
  });
  widgetWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    widgetWindow.hide();
  });
  widgetWindow.on("closed", () => { widgetWindow = null; });
}

async function createTray() {
  const icon = await app.getFileIcon(process.execPath, { size: "small" });
  tray = new Tray(icon);
  tray.setToolTip("Samaritan Tracker");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Widget", click: () => { widgetWindow?.show(); positionWidget(); } },
    { label: "Open Dashboard", click: () => openDashboard("/") },
    { label: "Start 25 Minute Focus", click: () => sendWs("widget.startFocus", { targetMinutes: 25, goal: "Tray focus session" }) },
    { type: "separator" },
    { label: "Quit Samaritan", click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on("click", () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) createWidgetWindow();
    else if (widgetWindow.isVisible()) widgetWindow.hide();
    else { widgetWindow.show(); positionWidget(); }
  });
}

function openDashboard(route = "/") {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (isDev && route.startsWith("/")) mainWindow.loadURL(`http://localhost:3000${route}`);
  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(async () => {
  createWindow();
  createWidgetWindow();
  await createTray();

  // Connect WebSocket
  connectWs();
  hydrateActiveDeepWork();
  hydrateDistractionBlocks();

  onWs("connection:established", () => {
    hydrateActiveDeepWork();
    hydrateDistractionBlocks();
    sendWs("widget.subscribe", {});
  });

  onWs("widget.state.update", (state) => {
    if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.webContents.send("widget:state", state);
  });

  onWs("widget.action.result", (result) => {
    if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.webContents.send("widget:actionResult", result);
  });

  onWs("distraction-blocks:changed", (state) => {
    console.log("[WS] Distraction blocker rules changed:", state.action);
    setDistractionRulesRef(state.rules || []);
  });

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

  onWs("deepwork:state", (state = {}) => {
    if (!activeDeepWork || state.sessionId !== activeDeepWork.id) return;
    activeDeepWork = {
      ...activeDeepWork,
      currentPhase: state.currentPhase || activeDeepWork.currentPhase,
      paused: Boolean(state.paused),
    };
    setActiveDeepWorkRef(activeDeepWork);
    if (activeDeepWork.currentPhase !== "focus" || activeDeepWork.paused) clearInterventionOverlay();
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

  onWs("calendar:reminder.due", (reminder) => {
    const event = reminder?.calendarEvent;
    if (!event || !Notification.isSupported()) return;
    const startsAt = new Date(event.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const notification = new Notification({
      title: event.title || "Calendar reminder",
      body: `${event.allDay ? "All day" : `Starts at ${startsAt}`}${event.location ? ` · ${event.location}` : ""}`,
      silent: false,
    });
    notification.on("click", () => {
      if (!mainWindow || mainWindow.isDestroyed()) createWindow();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("calendar-reminder-opened", reminder);
    });
    notification.show();
  });

  ipcMain.on("override-requested", (_event, data = {}) => {
    const reason = typeof data.reason === "string" ? data.reason.trim() : "";
    if (!reason) return;
    resolveActiveIntervention(reason);
  });

  ipcMain.on("widget:ready", () => sendWs("widget.subscribe", {}));
  ipcMain.on("widget:setExpanded", (_event, expanded) => {
    widgetExpanded = Boolean(expanded);
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    widgetWindow.setSize(360, widgetExpanded ? 320 : 90, true);
    positionWidget();
  });
  ipcMain.on("widget:setPinned", (_event, pinned) => {
    widgetPinned = Boolean(pinned);
    widgetWindow?.setAlwaysOnTop(widgetPinned);
    widgetWindow?.webContents.send("widget:windowState", { pinned: widgetPinned, expanded: widgetExpanded });
  });
  ipcMain.on("widget:hide", () => widgetWindow?.hide());
  ipcMain.on("widget:openDashboard", (_event, route) => openDashboard(typeof route === "string" ? route : "/"));
  ipcMain.on("widget:startFocus", (_event, payload) => sendWs("widget.startFocus", payload));
  ipcMain.on("widget:endFocus", (_event, payload) => sendWs("widget.endFocus", payload));
  ipcMain.on("widget:quickTag", (_event, payload) => sendWs("widget.quickTag", payload));
  ipcMain.on("widget:snoozeBreak", (_event, payload) => sendWs("widget.snoozeBreak", payload));
  ipcMain.on("widget:startBreak", (_event, payload) => sendWs("widget.startBreak", payload));

  startTracking();
  //startSyncLoop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && quitting) {
    app.quit();
  }
});

app.on("before-quit", () => { quitting = true; });

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
