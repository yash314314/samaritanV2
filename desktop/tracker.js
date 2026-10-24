const activeWin = require("active-win");
const hyprland = require("./hyprland");
const { handleEvent, closeSession } = require("./sessionEngine");
const { killProcess } = require("./taskkill");
const { streamCurrentActivity } = require("./wsClient");
const { reportDistractionBlock } = require("./wsClient");
const { powerMonitor, app, Notification, nativeImage } = require("electron");
const pathModule = require("path");
const { resolveAppIcon, ICON_SIZE } = require("./linuxIcons");
const { resolveBrowserContext } = require("./browserUrlResolver");
const { findMatchingDistractionRule } = require("./distractionMatcher");

const idleThreshold = 120; // seconds
const SAMPLE_INTERVAL = 500;

/* ---------------- ICON CACHE ---------------- */

const iconCache = new Map();

function iconKey(appName, path) {

  return `${appName}|${path || ""}`;

}

// Samaritan's own windows: the bundled logo instead of the generic Electron icon.
function ownIcon() {

  const image = nativeImage.createFromPath(pathModule.join(__dirname, "assets", "tray@2x.png"));

  return image.isEmpty() ? null : image.resize({ width: ICON_SIZE, height: ICON_SIZE, quality: "best" }).toDataURL();

}

async function getCachedIcon({ appName, path, processId }) {

  const key = iconKey(appName, path);

  if (iconCache.has(key)) {
    return iconCache.get(key);
  }

  let icon = null;

  try {

    if (processId === process.pid) {
      icon = ownIcon();
    } else if (process.platform === "linux") {
      // app.getFileIcon() fails for nearly every Linux executable; resolve
      // through desktop entries and the icon theme instead.
      icon = await resolveAppIcon({ appClass: appName, exePath: path });
    } else if (path) {
      const iconImage = await app.getFileIcon(path);
      if (iconImage && !iconImage.isEmpty()) {
        icon = iconImage.resize({ width: 32, height: 32 }).toDataURL();
      }
    }

  } catch (err) {

    console.log("[Samaritan] Icon extraction failed:", appName, err.message);

  }

  // Misses are cached too, so unresolvable apps cost nothing after the first switch.
  iconCache.set(key, icon);

  return icon;

}

/* ---------------- STATE ---------------- */

let lastContext = null;
let isIdle = false;
let idleStart = null;
let trackingRunning = false;
let lastTrackerError = null;

/* ---------------- PLATFORM SOURCES ---------------- */

// Hyprland needs its own window and idle sources; see hyprland.js.
const getActiveWindow = hyprland.isHyprland ? hyprland.getActiveWindow : activeWin;

function getSystemIdleTime() {
  return hyprland.isIdleMonitorRunning()
    ? hyprland.getIdleSeconds()
    : powerMonitor.getSystemIdleTime();
}

// Reference to the active deep work session (set from main.js)
let activeDeepWorkRef = null;
let distractionRulesRef = [];
const enforcementCooldowns = new Map();
const ENFORCEMENT_COOLDOWN_MS = 10_000;

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

function setDistractionRulesRef(rules) {
  distractionRulesRef = Array.isArray(rules) ? rules : [];
  console.log(`[Samaritan] Persistent blocker armed with ${distractionRulesRef.length} enabled rule(s)`);
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
  if (activeDeepWorkRef.currentPhase && activeDeepWorkRef.currentPhase !== "focus") return false;
  if (activeDeepWorkRef.paused) return false;

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
  const persistentRule = findMatchingDistractionRule(
    distractionRulesRef,
    context,
    Boolean(activeDeepWorkRef)
  );
  const deepWorkBlocked = shouldPreemptivelyBlock(context);
  if (!persistentRule && !deepWorkBlocked) return;

  const cooldownKey = `${persistentRule?.id || "deepwork"}:${context.processId || context.app}:${context.domain || ""}`;
  const lastAttempt = enforcementCooldowns.get(cooldownKey) || 0;
  if (Date.now() - lastAttempt < ENFORCEMENT_COOLDOWN_MS) return;
  enforcementCooldowns.set(cooldownKey, Date.now());

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

  if (persistentRule || deepWorkBlocked) {
    reportDistractionBlock({
      ruleId: persistentRule?.id || null,
      deepWorkId: deepWorkBlocked ? activeDeepWorkRef?.id || null : null,
      targetType: persistentRule?.targetType || "app",
      target: persistentRule?.target || context.app,
      appName: context.app,
      domain: context.domain || null,
      windowTitle: context.title || null,
      processId: context.processId || null,
      outcome: result.killed ? "killed" : "failed",
      reason: result.reason,
      occurredAt: new Date().toISOString(),
    });
    if (Notification.isSupported()) {
      new Notification({
        title: result.killed ? "Distraction blocked" : "Block attempt failed",
        body: result.killed
          ? `${context.app} matched ${persistentRule?.target || "the active focus protocol"}.`
          : `${context.app}: ${result.reason}`,
        urgency: result.killed ? "normal" : "critical",
      }).show();
    }
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

// Terminals and editors prefix titles with animated or status glyphs (CLI
// spinners, "●" unsaved markers). Each frame would otherwise open a new
// session shorter than MIN_SESSION_DURATION, so the time is never recorded.
function normalizeTitle(title) {

  return String(title || "").replace(/^[\p{So}\p{Sk}\s]+/u, "").trim();

}

function contextKey(win) {

  return `${win.owner?.name}|${normalizeTitle(win.title)}|${win.owner?.processId}`;

}

/* ---------------- TRACK LOOP ---------------- */

async function track() {

  if (trackingRunning) return;
  trackingRunning = true;

  try {

    const idleTime = getSystemIdleTime();

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

    const win = await getActiveWindow();

    if (!win) {
      trackingRunning = false;
      return;
    }

    const observedAt = new Date().toISOString();
    const newKey = contextKey(win);

    /* ---------- CONTEXT CHANGE ---------- */

    const path = win.owner?.path || null;
    const cachedIcon = iconCache.get(iconKey(win.owner?.name || "Unknown", path)) || null;
    const title = normalizeTitle(win.title) || "Untitled";
    const browserContext = await resolveBrowserContext({
      appName: win.owner?.name || "Unknown",
      title
    });
    const currentContext = {
      key: newKey,
      app: win.owner?.name || "Unknown",
      title,
      icon: cachedIcon,
      url: browserContext.url,
      domain: browserContext.domain,
      processId: win.owner?.processId || null,
      path,
      type: "active",
      observedAt
    };

    streamCurrentActivity({
      app: currentContext.app,
      title: currentContext.title,
      iconUrl: currentContext.icon,
      url: currentContext.url,
      domain: currentContext.domain,
      processId: currentContext.processId,
      processPath: currentContext.path,
      type: currentContext.type,
      observedAt: currentContext.observedAt
    });

    /* ---------- ENFORCE BLOCKING (pre-emptive kill) ---------- */

    enforceBlockIfNeeded(currentContext);

    /* ---------- NO CHANGE ---------- */

    if (lastContext && lastContext.key === newKey) {
      // Extend the open session. sessionEngine sends a heartbeat every 10s, so
      // long sessions reach the dashboard live and survive a crash.
      await handleEvent(currentContext);
      trackingRunning = false;
      return;
    }

    // Icon extraction can be relatively slow on the first encounter. The live
    // state has already been streamed, so enrich only the persisted session.
    if (!currentContext.icon) {
      currentContext.icon = await getCachedIcon({
        appName: currentContext.app,
        path,
        processId: currentContext.processId,
      });
    }

    console.log(
      "[Samaritan] Context shift detected.",
      "\n  Previous:", lastContext?.app || "None",
      "\n  Current:", currentContext.app
    );

    await handleEvent(currentContext);

    lastContext = currentContext;
    lastTrackerError = null;

  } catch (err) {

    // The loop runs twice a second; only report when the failure changes.
    if (err.message !== lastTrackerError) {
      console.error("[Samaritan] Tracker error:", err.message);
      lastTrackerError = err.message;
    }

  }

  trackingRunning = false;

}

/* ---------------- START TRACKING ---------------- */

function startTracking() {

  console.log("[Samaritan] Surveillance initialized.");
  console.log("[Samaritan] Sampling interval:", SAMPLE_INTERVAL, "ms");

  if (hyprland.isHyprland) {
    console.log("[Samaritan] Hyprland detected; using compositor IPC for window tracking.");
    hyprland.startIdleMonitor({
      configDir: app.getPath("userData"),
      thresholdSeconds: idleThreshold,
    });
    app.on("will-quit", hyprland.stopIdleMonitor);
  }

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

module.exports = {
  startTracking,
  setActiveDeepWorkRef,
  clearActiveDeepWorkRef,
  setDistractionRulesRef,
};
