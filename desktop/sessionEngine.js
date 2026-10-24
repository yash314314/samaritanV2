const { app, Notification, BrowserWindow } = require("electron");
const { streamActivity } = require("./wsClient");
const { killProcess } = require("./taskkill");
const crypto = require("crypto");
const auth = require("./authClient");
const outbox = require("./outbox");

let currentSession = null;

const MIN_SESSION_DURATION = 2000;
const BACKEND_URL = `${auth.API_BASE}/activity/session`;

function now() {
  return Date.now();
}

/* ---------------- START SESSION ---------------- */

function startNewSession(event) {
  const startTime = event.startTime
    ? new Date(event.startTime).getTime()
    : now();
  currentSession = {
    id: crypto.randomUUID(),
    startTime,
    endTime: startTime,
    lastSentTime: startTime,
    app: event.app,
    title: event.title,
    icon: event.icon || null,
    url: event.url || null,
    domain: event.domain || null,
    processId: event.processId || null,
    path: event.path || null,
    type: event.type || "active"
  };
  console.log(
    "[Samaritan] New observation initiated.",
    "\n App:", event.app,
    "\n Title:", event.title,
    "\n Timestamp:", new Date(currentSession.startTime).toISOString()
  );
}

/* ---------------- SEND TO BACKEND ---------------- */

async function sendSessionToBackend(session) {
  const payload = {
    id: session.id,
    app: session.app,
    title: session.title,
    iconUrl: session.icon,
    url: session.url || null,
    domain: session.domain || null,
    processId: session.processId || null,
    processPath: session.path || null,
    startTime: new Date(session.startTime).toISOString(),
    endTime: new Date(session.endTime).toISOString(),
    duration: session.duration,
    type: session.type
  };

  console.log("[Samaritan] Preparing transmission to backend.");

  // Primary: Stream via WebSocket. Only use HTTP if WS is unavailable,
  // otherwise the same activity is processed twice on the backend.
  console.log("[Samaritan] Streaming activity via WS");
  const streamed = streamActivity(payload);
  if (streamed) {
    return;
  }

  // Fallback: HTTP POST for reliability when WS is down. Anything the API
  // cannot take right now waits in the outbox instead of being lost.
  console.log("[Samaritan] WS unavailable; using HTTP fallback");
  const outcome = await postSession(payload, session.app);
  if (outcome === "retry") {
    outbox.enqueue(payload, auth.activityOwnerId());
    console.warn("[Samaritan] Activity queued for later delivery. Outbox size:", outbox.size());
  }
}

/** POSTs one activity. Resolves "sent", "rejected" (4xx, never retried) or "retry". */
async function postSession(payload, appName) {
  let response;
  try {
    response = await auth.authFetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("[Samaritan] HTTP fallback failed.", "\n Error:", err.message);
    return "retry";
  }

  const text = await response.text();
  if (!response.ok) {
    console.error(
      "[Samaritan] HTTP fallback rejected.",
      "\n Status:", response.status,
      "\n Response:", text
    );
    return response.status >= 500 || response.status === 401 || response.status === 429 ? "retry" : "rejected";
  }

  console.log("[Samaritan] HTTP fallback acknowledged.");

  try {
    const data = JSON.parse(text);
    const focusIntervention = data?.focusIntervention;

    if (focusIntervention && appName) {
      const interventionApp =
        focusIntervention.intervention?.appName || appName;

      console.log(
        "[Samaritan] Strict focus intervention.",
        "\n Action:", focusIntervention.intervention?.action,
        "\n App:", interventionApp,
        "\n Message:", focusIntervention.message
      );

      handleFocusIntervention(focusIntervention, interventionApp);
    }
  } catch {
    // Backend returned a valid acknowledgement without JSON intervention data.
  }
  return "sent";
}

/** Replays queued activity over HTTP, oldest first. Interventions are not replayed. */
function flushOutbox() {
  return outbox.flush((payload) => postSession(payload, null), auth.status().userId);
}

/* ---------------- INTERVENTION HANDLER ---------- */

function handleFocusIntervention(focusIntervention, appName) {
  const { intervention, enforcement, message } = focusIntervention;
  const action = intervention?.action || enforcement || "observe";
  const interventionId = intervention?.id || focusIntervention.id || null;
  const sameCurrentApp =
    currentSession?.app &&
    appName &&
    currentSession.app.toLowerCase().trim() === appName.toLowerCase().trim();
  const target = {
    appName,
    pid: sameCurrentApp ? currentSession?.processId : null,
    path: sameCurrentApp ? currentSession?.path : null
  };

  if (action === "blocked" || action === "block") {
    if (Notification.isSupported()) {
      new Notification({
        title: "🚫 Focus Blocked",
        body: `${appName} is blocked during deep work.\n${message}`,
        urgency: "critical"
      }).show();
    }
    blockDistractingWindow(appName, {
      action,
      interventionId,
      message
    });
    const killResult = killProcess(target);
    if (killResult.killed) {
      console.log(`[Samaritan] Successfully terminated ${appName}: ${killResult.reason}`);
    } else {
      console.log(`[Samaritan] Could not terminate ${appName}: ${killResult.reason}`);
    }

  } else if (action === "warned" || action === "warn") {
    if (Notification.isSupported()) {
      new Notification({
        title: "⚠️ Focus Warning",
        body: `${appName} is outside your focus protocol.\n${message}`,
        urgency: "normal"
      }).show();
    }

  } else if (action === "observed" || action === "observe") {
    console.log("[Samaritan] Observation logged (no enforcement):", message);

  } else if (action === "reason_required") {
    if (Notification.isSupported()) {
      new Notification({
        title: "📝 Justification Required",
        body: `${appName} requires a reason to continue.\n${message}`,
        urgency: "normal"
      }).show();
    }
    blockDistractingWindow(appName, {
      action,
      interventionId,
      message,
      showReason: true
    });
  }
}

const { shell } = require("electron");

function blockDistractingWindow(appName, options = {}) {
  console.log(`[Samaritan] Attempting to block ${appName}...`);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send("focus-blocked", {
      appName,
      action: options.action || "blocked",
      interventionId: options.interventionId || null,
      showReason: Boolean(options.showReason),
      message: options.message || "This app is blocked during your deep work session."
    });
  }
}

/* ---------------- CLOSE SESSION ---------------- */

async function closeSession(reason = "active", endTimeOverride = null) {
  if (!currentSession) {
    console.log("[Samaritan] No active observation to close.");
    return;
  }

  const endTime = endTimeOverride
    ? new Date(endTimeOverride).getTime()
    : now();

  currentSession.endTime = Math.max(endTime, currentSession.startTime);

  const duration =
    currentSession.endTime - currentSession.startTime;

  if (duration < MIN_SESSION_DURATION) {
    currentSession = null;
    return;
  }

  currentSession.duration = duration;

  console.log(
    "[Samaritan] Observation concluded.",
    "\n App:", currentSession.app,
    "\n Type:", currentSession.type,
    "\n Duration(ms):", duration,
    "\n Reason:", reason
  );

  await sendSessionToBackend(currentSession);

  currentSession = null;
}

async function flushCurrentSession(reason = "flush", endTimeOverride = null) {
  await closeSession(reason, endTimeOverride);
}

/* ---------------- EVENT HANDLER ---------------- */

async function handleEvent(event) {
  const eventStartTime = event.startTime
    ? new Date(event.startTime).getTime()
    : now();

  if (!currentSession) {
    startNewSession(event);
    return;
  }

  const isSameContext =
    currentSession.app === event.app &&
    currentSession.title === event.title &&
    currentSession.type === (event.type || "active") &&
    currentSession.processId === (event.processId || null);

  if (!isSameContext) {
    await closeSession("switch", eventStartTime);
    startNewSession(event);
  } else {
    currentSession.endTime = now();
    // 10-second periodic heartbeat/update transmission for in-progress session
    if (now() - currentSession.lastSentTime >= 10000) {
      currentSession.duration = currentSession.endTime - currentSession.startTime;
      console.log(`[Samaritan] Sending periodic heartbeat update for session: ${currentSession.id}`);
      sendSessionToBackend(currentSession).catch(err => {
        console.error("[Samaritan] Failed to send periodic session update:", err.message);
      });
      currentSession.lastSentTime = now();
    }
  }
}

/* ---------------- SHUTDOWN HANDLER ---------------- */

let shutdownFlushed = false;

app.on("before-quit", (event) => {
  if (shutdownFlushed) return;
  // Electron does not wait for async listeners, so the open session was lost
  // on every quit. Hold the quit until it is sent, capped so an unreachable
  // backend cannot block exit.
  event.preventDefault();
  shutdownFlushed = true;
  console.log("[Samaritan] Shutdown sequence initiated.");
  Promise.race([
    closeSession("shutdown"),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
    .catch((err) => console.error("[Samaritan] Shutdown flush failed:", err.message))
    .finally(() => {
      console.log("[Samaritan] All observations archived.");
      app.quit();
    });
});

/* ---------------- CRASH PROTECTION ---------------- */

process.on("uncaughtException", (err) => {
  console.error("[Samaritan] Uncaught exception detected.");
  console.error("Details:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[Samaritan] Unhandled rejection detected.");
  console.error("Details:", err);
});

module.exports = { handleEvent, closeSession, flushCurrentSession, handleFocusIntervention, flushOutbox };
