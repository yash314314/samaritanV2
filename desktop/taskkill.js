const { execFileSync } = require("child_process");
const os = require("os");
const path = require("path");

const isWindows = os.platform() === "win32";

const PROTECTED_EXECUTABLES = new Set([
  "system", "system idle process", "registry", "smss.exe", "csrss.exe",
  "wininit.exe", "services.exe", "lsass.exe", "svchost.exe", "winlogon.exe",
  "dwm.exe", "explorer.exe", "taskhostw.exe", "node.exe", "electron.exe",
]);

const ALLOWED_EXECUTABLES = new Set([
  "chrome.exe",
  "msedge.exe",
  "firefox.exe",
  "brave.exe",
  "opera.exe",
  "vivaldi.exe",

  "discord.exe",
  "slack.exe",
  "telegram.exe",
  "whatsapp.exe",
  "signal.exe",
  "zoom.exe",
  "ms-teams.exe",
  "teams.exe",
  "microsoftteams.exe",
  "outlook.exe",

  "spotify.exe",
  "spotifree.exe",
  "itunes.exe",
  "wmplayer.exe",
  "vlc.exe",
  "obs64.exe",
  "obs32.exe",

  "steam.exe",
  "epicgameslauncher.exe",
  "battlenet.exe",
  "battle.net.exe",
  "valorant.exe",
  "valorant-win64-shipping.exe",
  "leagueclient.exe",
  "leagueclientux.exe",

  "twitter.exe",
  "x.exe",
  "instagram.exe",
  "facebook.exe",
  "messenger.exe",

  "notepad++.exe",
  "sublime_text.exe",
  "atom.exe",
  "code.exe",
  "cursor.exe",
  "windsurf.exe",
  "notion.exe",
  "figma.exe",
  "postman.exe",
]);

const REJECT_PATTERN = /[;&|`$(){}[\]#~!<>\n\r]/;

const EXE_MAP = {
  "chrome": "chrome.exe",
  "google chrome": "chrome.exe",
  "chromium": "chrome.exe",
  "edge": "msedge.exe",
  "microsoft edge": "msedge.exe",
  "firefox": "firefox.exe",
  "mozilla firefox": "firefox.exe",
  "brave": "brave.exe",
  "brave browser": "brave.exe",
  "opera": "opera.exe",
  "vivaldi": "vivaldi.exe",

  "discord": "discord.exe",
  "slack": "slack.exe",
  "telegram": "telegram.exe",
  "whatsapp": "whatsapp.exe",
  "signal": "signal.exe",
  "zoom": "zoom.exe",
  "microsoft teams": "teams.exe",
  "teams": "teams.exe",
  "outlook": "outlook.exe",
  "microsoft outlook": "outlook.exe",

  "spotify": "spotify.exe",
  "itunes": "itunes.exe",
  "apple music": "itunes.exe",
  "windows media player": "wmplayer.exe",
  "vlc": "vlc.exe",
  "vlc media player": "vlc.exe",
  "obs studio": "obs64.exe",
  "obs": "obs64.exe",

  "steam": "steam.exe",
  "epic games": "epicgameslauncher.exe",
  "epic games launcher": "epicgameslauncher.exe",
  "battle.net": "battle.net.exe",
  "battlenet": "battlenet.exe",
  "valorant": "valorant.exe",
  "league of legends": "leagueclientux.exe",
  "league client": "leagueclientux.exe",

  "twitter": "twitter.exe",
  "x": "x.exe",
  "instagram": "instagram.exe",
  "facebook": "facebook.exe",
  "messenger": "messenger.exe",

  "notepad++": "notepad++.exe",
  "sublime text": "sublime_text.exe",
  "atom": "atom.exe",
  "code": "code.exe",
  "visual studio code": "code.exe",
  "vs code": "code.exe",
  "cursor": "cursor.exe",
  "windsurf": "windsurf.exe",
  "notion": "notion.exe",
  "figma": "figma.exe",
  "postman": "postman.exe",

  "netflix": null,
  "youtube": null,
  "instagram.com": null,
  "twitter.com": null,
  "x.com": null,
  "reddit": null,
  "reddit.com": null,
  "facebook.com": null,
};

function deriveExeName(name) {
  const key = String(name || "").toLowerCase().trim();
  if (EXE_MAP[key] !== undefined) return EXE_MAP[key];

  for (const [knownAlias, exe] of Object.entries(EXE_MAP)) {
    if (key.includes(knownAlias) || knownAlias.includes(key)) {
      return exe;
    }
  }

  if (/^[a-z0-9_.-]+\.exe$/i.test(key)) return key;
  console.log(`[TaskKill] UNKNOWN: "${name}" does not match any known app; refusing to guess`);
  return null;
}

function validateKillableApp(appName) {
  if (!appName || typeof appName !== "string") {
    return { ok: false, exeName: null, reason: "Invalid input: appName is not a non-empty string" };
  }

  const trimmed = appName.trim();
  if (!trimmed) {
    return { ok: false, exeName: null, reason: "Invalid input: empty appName" };
  }

  if (REJECT_PATTERN.test(trimmed)) {
    return { ok: false, exeName: null, reason: "Security: appName contains shell metacharacters" };
  }

  const exeName = deriveExeName(trimmed);
  if (!exeName) {
    return { ok: false, exeName: null, reason: `No native executable for "${trimmed}"` };
  }

  if (!ALLOWED_EXECUTABLES.has(exeName)) {
    return { ok: false, exeName, reason: `"${exeName}" is not in the safe-kill allowlist` };
  }

  return { ok: true, exeName, trimmed };
}

function resultFromError(prefix, exeName, err) {
  const stderr = err.stderr ? String(err.stderr).trim() : "";
  const stdout = err.stdout ? String(err.stdout).trim() : "";
  const exitCode = err.status !== undefined ? err.status : -1;
  const detail = stderr || stdout || err.message || "unknown error";
  const notFound = detail.toLowerCase().includes("not found");

  return {
    killed: false,
    exeName,
    reason: notFound ? `${prefix} is not currently running` : `${prefix} failed (exit=${exitCode}): ${detail}`,
  };
}

function killProcessByPid(appName, pid, processPath = null) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    return { killed: false, exeName: null, reason: "Invalid process id" };
  }

  if (numericPid === process.pid) {
    return { killed: false, exeName: null, reason: "Refusing to terminate Samaritan itself" };
  }

  const observedExe = path.basename(String(processPath || appName || "")).toLowerCase();
  const observedApp = String(appName || "").toLowerCase().trim();
  const normalizedPath = String(processPath || "").toLowerCase();
  if (!observedApp || REJECT_PATTERN.test(observedApp)) {
    return { killed: false, exeName: observedExe || null, reason: "Invalid observed application" };
  }
  if (PROTECTED_EXECUTABLES.has(observedExe) || PROTECTED_EXECUTABLES.has(observedApp)) {
    return { killed: false, exeName: observedExe || null, reason: `Protected process ${observedExe || observedApp}` };
  }
  if (normalizedPath.includes("\\windows\\system32\\")) {
    return { killed: false, exeName: observedExe || null, reason: "Refusing to terminate a Windows system process" };
  }

  try {
    if (isWindows) {
      const output = execFileSync("taskkill", ["/F", "/PID", String(numericPid), "/T"], {
        timeout: 8000,
        encoding: "utf-8",
      });
      const summary = output.trim().split(/\r?\n/).filter(Boolean).join(" | ");
      console.log(`[TaskKill] SUCCESS: taskkill /F /PID ${numericPid} /T`);
      if (summary) console.log(`[TaskKill]   Output: ${summary}`);
    } else {
      process.kill(numericPid, "SIGTERM");
      console.log(`[TaskKill] SUCCESS: SIGTERM pid ${numericPid}`);
    }

    return {
      killed: true,
      exeName: observedExe || null,
      reason: `Successfully terminated pid ${numericPid}`,
    };
  } catch (err) {
    return resultFromError(`pid ${numericPid}`, observedExe || null, err);
  }
}

function killProcessByName(appName) {
  const validation = validateKillableApp(appName);
  if (!validation.ok) {
    return { killed: false, exeName: validation.exeName, reason: validation.reason };
  }

  const exeDisplay = isWindows ? validation.exeName : validation.exeName.replace(/\.exe$/i, "");
  console.log(`[TaskKill] ATTEMPTING: kill ${exeDisplay} (requested as "${validation.trimmed}")`);

  try {
    if (isWindows) {
      const output = execFileSync("taskkill", ["/F", "/IM", validation.exeName, "/T"], {
        timeout: 8000,
        encoding: "utf-8",
      });
      const summary = output.trim().split(/\r?\n/).filter(Boolean).join(" | ");
      console.log(`[TaskKill] SUCCESS: taskkill /F /IM "${validation.exeName}" /T`);
      if (summary) console.log(`[TaskKill]   Output: ${summary}`);
    } else {
      const output = execFileSync("pkill", ["-f", "-i", exeDisplay], {
        timeout: 8000,
        encoding: "utf-8",
      });
      console.log(`[TaskKill] SUCCESS: pkill -f -i "${exeDisplay}"`);
      if (output.trim()) console.log(`[TaskKill]   Output: ${output.trim()}`);
    }

    return {
      killed: true,
      exeName: validation.exeName,
      reason: `Successfully terminated ${exeDisplay}`,
    };
  } catch (err) {
    return resultFromError(exeDisplay, validation.exeName, err);
  }
}

function killProcess(target) {
  const appName = target?.appName || target?.name;
  if (target?.pid) {
    const pidResult = killProcessByPid(appName, target.pid, target.path);
    if (pidResult.killed) return pidResult;
    console.log(`[TaskKill] PID kill skipped: ${pidResult.reason}. Falling back to image name.`);
  }

  return killProcessByName(appName);
}

module.exports = { killProcess, killProcessByName, killProcessByPid, deriveExeName };
