const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const path = require("path");
const { startTracking } = require("./tracker");
const { startSyncLoop } = require("./syncEngine");
const { startSessionPoller } = require("./sessionPoller");


const isDev = !app.isPackaged;

// Overlay window reference
let blockOverlay = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true, // Required for renderer IPC
      contextIsolation: false // Simplify for now
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools();
  } else {
    win.loadFile(
      path.join(__dirname, "../dashboard/out/index.html")
    );
  }

  return win;
}

function createBlockOverlay(data) {
  if (blockOverlay) {
    blockOverlay.focus();
    return;
  }

  blockOverlay = new BrowserWindow({
    width: 500,
    height: 400,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  blockOverlay.loadFile(path.join(__dirname, "renderer/block-overlay.html"));

  blockOverlay.webContents.on('did-finish-load', () => {
    blockOverlay.webContents.send('focus-blocked', data);
  });

  blockOverlay.on('closed', () => {
    blockOverlay = null;
  });
}

function closeBlockOverlay() {
  if (blockOverlay) {
    blockOverlay.close();
    blockOverlay = null;
  }
}

// IPC handlers
ipcMain.on('focus-blocked', (event, data) => {
  createBlockOverlay(data);
});

ipcMain.on('override-requested', async (event, data) => {
  console.log("[Samaritan] Override requested with reason:", data.reason);
  
  // TODO: Send to backend to resolve intervention
  // await resolveInterventionAPI(data.reason);
  
  closeBlockOverlay();
});

app.whenReady().then(() => {
  console.log("Samaritan is watching you...");
  createWindow();
  startTracking();
  startSessionPoller();
});

// Clean up overlay on quit
app.on("before-quit", () => {
  closeBlockOverlay();
});