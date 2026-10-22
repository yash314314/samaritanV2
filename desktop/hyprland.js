const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

/*
 * Hyprland (Wayland) integration.
 *
 * active-win only speaks X11 on Linux, so under Hyprland it can only see
 * XWayland windows and usually fails on a stale _NET_ACTIVE_WINDOW id.
 * Chromium's idle timer on Wayland only understands KDE's org_kde_kwin_idle,
 * so powerMonitor.getSystemIdleTime() is stuck at 0. This module replaces
 * both with Hyprland IPC and a private hypridle instance.
 */

const signature = process.env.HYPRLAND_INSTANCE_SIGNATURE;
const isHyprland = process.platform === "linux" && Boolean(signature);

const IPC_TIMEOUT_MS = 1000;
const IDLE_MARKER = "SAMARITAN_IDLE";
const ACTIVE_MARKER = "SAMARITAN_ACTIVE";
const IDLE_RESTART_DELAY_MS = 5000;

function resolveSocketPath() {
  const candidates = [
    process.env.XDG_RUNTIME_DIR && path.join(process.env.XDG_RUNTIME_DIR, "hypr", signature, ".socket.sock"),
    path.join("/tmp", "hypr", signature || "", ".socket.sock"),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

const socketPath = isHyprland ? resolveSocketPath() : null;

function request(command) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let response = "";
    socket.setTimeout(IPC_TIMEOUT_MS, () => {
      socket.destroy();
      reject(new Error(`Hyprland IPC timed out for "${command}"`));
    });
    socket.on("connect", () => socket.write(command));
    socket.on("data", (chunk) => { response += chunk; });
    socket.on("end", () => resolve(response));
    socket.on("error", reject);
  });
}

async function requestJson(command) {
  const raw = await request(`j/${command}`);
  return JSON.parse(raw);
}

/* ---------------- ACTIVE WINDOW ---------------- */

const exePathCache = new Map();

function readExePath(pid) {
  if (!pid || pid <= 0) return null;
  if (exePathCache.has(pid)) return exePathCache.get(pid);
  let exePath = null;
  try {
    exePath = fs.readlinkSync(`/proc/${pid}/exe`);
  } catch {
    // Process exited or belongs to another user; the path is optional.
  }
  if (exePathCache.size > 256) exePathCache.clear();
  exePathCache.set(pid, exePath);
  return exePath;
}

/**
 * Returns the focused window in the same shape as active-win so the tracker
 * can stay backend-agnostic. owner.name is the window class, which matches
 * the WM_CLASS value active-win reports on X11.
 */
async function getActiveWindow() {
  const win = await requestJson("activewindow");
  if (!win || !win.address) return null;

  const pid = Number.isInteger(win.pid) && win.pid > 0 ? win.pid : null;
  return {
    id: win.address,
    title: win.title || win.initialTitle || "",
    owner: {
      name: win.class || win.initialClass || "Unknown",
      processId: pid,
      path: readExePath(pid),
    },
    bounds: {
      x: win.at?.[0] ?? 0,
      y: win.at?.[1] ?? 0,
      width: win.size?.[0] ?? 0,
      height: win.size?.[1] ?? 0,
    },
  };
}

/* ---------------- IDLE MONITOR ---------------- */

let idleProcess = null;
let idleSince = null;
let idleStopping = false;
let idleRestartTimer = null;

function hasHypridle() {
  try {
    execFileSync("hypridle", ["--version"], { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function writeIdleConfig(configDir, thresholdSeconds) {
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, "samaritan-hypridle.conf");
  // D-Bus/systemd inhibitors are ignored so background audio does not mask
  // AFK time; Wayland inhibitors (visible video playback) still count as
  // presence. Sleep inhibition is off so suspend is never delayed by us.
  fs.writeFileSync(configPath, [
    "general {",
    "    ignore_dbus_inhibit = true",
    "    ignore_systemd_inhibit = true",
    "    inhibit_sleep = 0",
    "}",
    "",
    "listener {",
    `    timeout = ${Math.max(1, Math.round(thresholdSeconds))}`,
    `    on-timeout = echo ${IDLE_MARKER}`,
    `    on-resume = echo ${ACTIVE_MARKER}`,
    "}",
    "",
  ].join("\n"));
  return configPath;
}

function killStaleIdleMonitors(configPath) {
  // A crashed Electron leaves its hypridle child behind; match only ours.
  const escapedPath = configPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    execFileSync("pkill", ["-f", "-x", `hypridle -q -c ${escapedPath}`], { stdio: "ignore", timeout: 3000 });
  } catch {
    // pkill exits 1 when nothing matched.
  }
}

function spawnIdleMonitor(configPath, thresholdSeconds) {
  idleProcess = spawn("hypridle", ["-q", "-c", configPath], { stdio: ["ignore", "pipe", "pipe"] });

  let buffer = "";
  idleProcess.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const marker = line.trim();
      if (marker === IDLE_MARKER) {
        idleSince = Date.now() - thresholdSeconds * 1000;
      } else if (marker === ACTIVE_MARKER) {
        idleSince = null;
      }
    }
  });

  idleProcess.stderr.on("data", (chunk) => {
    console.warn("[Hyprland] hypridle:", String(chunk).trim());
  });

  idleProcess.on("exit", (code, signal) => {
    idleProcess = null;
    idleSince = null;
    if (idleStopping) return;
    console.warn(`[Hyprland] hypridle exited (code=${code} signal=${signal}); restarting in ${IDLE_RESTART_DELAY_MS}ms`);
    idleRestartTimer = setTimeout(() => {
      idleRestartTimer = null;
      spawnIdleMonitor(configPath, thresholdSeconds);
    }, IDLE_RESTART_DELAY_MS);
  });
}

/**
 * Starts a private hypridle instance that reports input idle on stdout.
 * Returns false when hypridle is unavailable so callers can fall back.
 */
function startIdleMonitor({ configDir, thresholdSeconds }) {
  if (!isHyprland || idleProcess) return Boolean(idleProcess);
  if (!hasHypridle()) {
    console.warn("[Hyprland] hypridle not found; idle detection is unavailable (install hypridle)");
    return false;
  }

  const configPath = writeIdleConfig(configDir, thresholdSeconds);
  killStaleIdleMonitors(configPath);
  idleStopping = false;
  spawnIdleMonitor(configPath, thresholdSeconds);
  console.log(`[Hyprland] Idle monitor armed via hypridle (${thresholdSeconds}s threshold)`);
  return true;
}

function stopIdleMonitor() {
  idleStopping = true;
  if (idleRestartTimer) {
    clearTimeout(idleRestartTimer);
    idleRestartTimer = null;
  }
  if (idleProcess) {
    idleProcess.kill("SIGTERM");
    idleProcess = null;
  }
  idleSince = null;
}

function isIdleMonitorRunning() {
  return Boolean(idleProcess);
}

function getIdleSeconds() {
  return idleSince ? Math.floor((Date.now() - idleSince) / 1000) : 0;
}

/* ---------------- WINDOW PLACEMENT ---------------- */

function luaWindowDispatch(action, args) {
  const fields = Object.entries(args)
    .map(([key, value]) => `${key} = ${typeof value === "string" ? JSON.stringify(value) : value}`)
    .join(", ");
  return `dispatch hl.dsp.window.${action}({ ${fields} })`;
}

async function dispatchBatch(luaCommands, legacyCommands) {
  const reply = await request(`[[BATCH]]${luaCommands.join(";")}`);
  if (!/error|invalid/i.test(reply)) return;
  // Pre-Lua Hyprland releases only accept the hyprlang dispatcher syntax.
  await request(`[[BATCH]]${legacyCommands.join(";")}`);
}

async function findOwnWindow(title) {
  const clients = await requestJson("clients");
  return clients.find((client) => client.pid === process.pid && client.title === title) || null;
}

/**
 * Floats, pins and moves one of this process's windows to the bottom-right
 * corner of the focused monitor. Wayland ignores client-side positioning and
 * always-on-top hints, so the compositor has to be asked directly.
 */
async function placeFloatingWindow({ title, width, height, margin = 18, attempts = 10 }) {
  if (!isHyprland) return false;

  let client = null;
  for (let attempt = 0; attempt < attempts && !client; attempt++) {
    client = await findOwnWindow(title);
    if (!client) await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!client) return false;

  const monitors = await requestJson("monitors");
  const monitor = monitors.find((entry) => entry.focused) || monitors[0];
  if (!monitor) return false;

  const [reservedLeft, reservedTop, reservedRight, reservedBottom] = monitor.reserved || [0, 0, 0, 0];
  const scale = monitor.scale || 1;
  const rotated = monitor.transform % 2 === 1;
  const logicalWidth = (rotated ? monitor.height : monitor.width) / scale;
  const logicalHeight = (rotated ? monitor.width : monitor.height) / scale;
  const x = Math.round(monitor.x + logicalWidth - reservedRight - width - margin);
  const y = Math.round(monitor.y + logicalHeight - reservedBottom - height - margin);
  const target = `address:${client.address}`;

  const lua = [];
  const legacy = [];
  if (!client.floating) {
    lua.push(luaWindowDispatch("float", { action: "on", window: target }));
    legacy.push(`dispatch setfloating ${target}`);
  }
  if (!client.pinned) {
    lua.push(luaWindowDispatch("pin", { action: "on", window: target }));
    legacy.push(`dispatch pin ${target}`);
  }
  lua.push(luaWindowDispatch("resize", { x: width, y: height, relative: false, window: target }));
  legacy.push(`dispatch resizewindowpixel exact ${width} ${height},${target}`);
  lua.push(luaWindowDispatch("move", { x: Math.max(monitor.x + reservedLeft, x), y: Math.max(monitor.y + reservedTop, y), relative: false, window: target }));
  legacy.push(`dispatch movewindowpixel exact ${Math.max(monitor.x + reservedLeft, x)} ${Math.max(monitor.y + reservedTop, y)},${target}`);

  await dispatchBatch(lua, legacy);
  return true;
}

module.exports = {
  isHyprland,
  getActiveWindow,
  startIdleMonitor,
  stopIdleMonitor,
  isIdleMonitorRunning,
  getIdleSeconds,
  placeFloatingWindow,
};
