const activeWin = require("active-win");
const { handleEvent, closeSession } = require("./sessionEngine");
const { powerMonitor, app } = require("electron");
const { resolveBrowserContext } = require("./browserUrlResolver");
const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

const idleThreshold = 120; // seconds
const SAMPLE_INTERVAL = 2000; // 2 seconds

/* ---------------- ICON CACHE ---------------- */

const iconCache = new Map();

async function getCachedIcon(path) {

  if (!path) return null;

  if (iconCache.has(path)) {
    return iconCache.get(path);
  }

  try {

    const iconImage = await app.getFileIcon(path);

    if (!iconImage || iconImage.isEmpty()) {
      return null;
    }

    const resized = iconImage.resize({ width: 32, height: 32 });

    const base64 = resized.toDataURL();

    iconCache.set(path, base64);

    return base64;

  } catch (err) {

    console.log("[Samaritan] Icon extraction failed:", path);

    return null;

  }

}

/* ---------------- STATE ---------------- */

let lastContext = null;
let isIdle = false;
let idleStart = null;
let trackingRunning = false;
async function enterIdle(reason, startedAt) {
  if (isIdle) return;

  await closeSession(`${reason}-start`, startedAt);

  await handleEvent({
    app: "System Idle",
    title:
      reason === "suspend"
        ? "System suspended"
        : reason === "lock"
        ? "System locked"
        : "User inactive",
    icon: null,
    type: "idle",
    startTime: startedAt
  });

  isIdle = true;
  idleStart = startedAt;
  lastContext = null;
}

async function exitIdle(reason, endedAt = Date.now()) {
  if (!isIdle) return;

  await closeSession(`${reason}-end`, endedAt);

  isIdle = false;
  idleStart = null;
  lastContext = null;
}
/* ---------------- CONTEXT HASH ---------------- */

function contextKey(win) {

  return `${win.owner?.name}|${win.title}|${win.owner?.processId}`;

}

/* ---------------- TRACK LOOP ---------------- */

async function track() {

  if (trackingRunning) return;
  trackingRunning = true;

  try {

    const idleTime = powerMonitor.getSystemIdleTime();

    /* ---------- IDLE DETECTION ---------- */

    if (idleTime >= idleThreshold) {
      const detectedIdleStart = Date.now() - idleTime * 1000;
    
      if (!isIdle) {
        console.log("[Samaritan] Idle detected.");
        await enterIdle("idle", detectedIdleStart);
      }
    
      trackingRunning = false;
      return;
    }
    
    if (isIdle && idleTime < idleThreshold) {
      console.log("[Samaritan] User returned.");
      await exitIdle("return");
    }

    /* ---------- GET ACTIVE WINDOW ---------- */

    const win = await activeWin();

    if (!win) {
      trackingRunning = false;
      return;
    }

    const newKey = contextKey(win);

    /* ---------- NO CHANGE ---------- */

    if (lastContext && lastContext.key === newKey) {
      trackingRunning = false;
      return;
    }

    /* ---------- CONTEXT CHANGE ---------- */

    const path = win.owner?.path || null;

    const icon = path
      ? await getCachedIcon(path)
      : null;
      const browserContext = await resolveBrowserContext({
        appName: win.owner?.name || "Unknown",
        title: win.title || "Untitled"
      });
      const currentContext = {
        key: newKey,
        app: win.owner?.name || "Unknown",
        title: win.title || "Untitled",
        icon,
        url: browserContext.url,
        domain: browserContext.domain,
        processId: win.owner?.processId || null,
        path,
        type: "active"
      };

    console.log(
      "[Samaritan] Context shift detected.",
      "\n  Previous:", lastContext?.app || "None",
      "\n  Current:", currentContext.app
    );

    await handleEvent(currentContext);

    lastContext = currentContext;

  } catch (err) {

    console.error("[Samaritan] Tracker error:", err.message);

  }

  trackingRunning = false;

}

/* ---------------- START TRACKING ---------------- */

function startTracking() {

  console.log("[Samaritan] Surveillance initialized.");
  console.log("[Samaritan] Sampling interval:", SAMPLE_INTERVAL, "ms");

  powerMonitor.on("lock-screen", async () => {
    console.log("[Samaritan] System locked.");
    await enterIdle("lock", Date.now());
  });
  
  powerMonitor.on("unlock-screen", async () => {
    console.log("[Samaritan] System unlocked.");
    await exitIdle("unlock", Date.now());
  });
  
  powerMonitor.on("suspend", async () => {
    console.log("[Samaritan] System suspended.");
    await enterIdle("suspend", Date.now());
  });
  
  powerMonitor.on("resume", async () => {
    console.log("[Samaritan] System resumed.");
    await exitIdle("resume", Date.now());
  });
  setInterval(track, SAMPLE_INTERVAL);

}

module.exports = { startTracking };