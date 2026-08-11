const activeWin = require("active-win");
const { handleEvent, closeSession } = require("./sessionEngine");
const { killProcess } = require("./taskkill");
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

// Reference to the active deep work session (set from main.js)
let activeDeepWorkRef = null;

/**
 * Set the active deep work session reference so the tracker can
 * enforce blocking directly without waiting for backend round-trip.
 */
function setActiveDeepWorkRef(session) {
  activeDeepWorkRef = session;
}

function clearActiveDeepWorkRef() {
  activeDeepWorkRef = null;
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function includesRule(rules, value) {
  const normalized = normalize(value);
  if (!normalized) return false;
  return (rules || []).some((rule) => {
    const normalizedRule = normalize(rule);
    return normalizedRule && normalized.includes(normalizedRule);
  });
}

function shouldPreemptivelyBlock(context) {
  if (!activeDeepWorkRef || activeDeepWorkRef.enforcement !== "block") return false;

  const blockedApps = activeDeepWorkRef.blockedApps || [];
  const blockedDomains = activeDeepWorkRef.blockedDomains || [];
  const allowedApps = activeDeepWorkRef.allowedApps || [];
  const allowedDomains = activeDeepWorkRef.allowedDomains || [];

  if (includesRule(blockedApps, context.app)) return true;
  if (includesRule(blockedDomains, context.domain || context.url)) return true;

  const hasAllowList = allowedApps.length > 0 || allowedDomains.length > 0;
  if (!hasAllowList) return false;

  const appAllowed = includesRule(allowedApps, context.app);
  const domainAllowed = includesRule(allowedDomains, context.domain || context.url);
  return !appAllowed && !domainAllowed;
}

function enforceBlockIfNeeded(context) {
  if (!shouldPreemptivelyBlock(context)) return;

  const result = killProcess({
    appName: context.app,
    pid: context.processId,
    path: context.path,
  });

  if (result.killed) {
    console.log(`[Samaritan] Block enforcement terminated ${context.app}: ${result.reason}`);
  } else {
    console.log(`[Samaritan] Block enforcement could not terminate ${context.app}: ${result.reason}`);
  }
}
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

    /* ---------- ENFORCE BLOCKING (pre-emptive kill) ---------- */

    enforceBlockIfNeeded(currentContext);

    /* ---------- NO CHANGE ---------- */

    if (lastContext && lastContext.key === newKey) {
      trackingRunning = false;
      return;
    }

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

module.exports = { startTracking, setActiveDeepWorkRef, clearActiveDeepWorkRef };
