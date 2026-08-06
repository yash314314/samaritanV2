/**
 * Kill processes matching a given app name.
 * On Windows this uses taskkill; on macOS/Linux it falls back to pkill.
 *
 * ⚠️ SAFETY GUARDS:
 * - Only kills from an explicit safelist of known app executables
 * - Rejects names containing shell metacharacters (injection prevention)
 * - Never kills system-critical processes
 * - Detailed logging of every attempt
 * - NO window-title fallback (prevents accidental kills)
 */

const { execSync } = require("child_process");
const os = require("os");

const isWindows = os.platform() === "win32";

// ─── SAFELIST ──────────────────────────────────────────────────────────
// Only these executables are allowed to be killed. This prevents accidental
// termination of system or critical processes. Add new entries as needed.
const ALLOWED_EXECUTABLES = new Set([
  // Browsers
  "chrome.exe",
  "msedge.exe",
  "firefox.exe",
  "brave.exe",
  "opera.exe",
  "vivaldi.exe",

  // Communication / Social
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

  // Entertainment / Media
  "spotify.exe",
  "spotifree.exe",
  "itunes.exe",
  "wmplayer.exe",
  "vlc.exe",
  "obs64.exe",
  "obs32.exe",

  // Gaming
  "steam.exe",
  "epicgameslauncher.exe",
  "battlenet.exe",
  "valorant.exe",
  "valorant-win64-shipping.exe",
  "leagueclient.exe",
  "leagueclientux.exe",

  // Social Media Desktop Apps
  "twitter.exe",
  "x.exe",
  "instagram.exe",
  "facebook.exe",
  "messenger.exe",

  // Tools / Utilities (non-critical)
  "notepad++.exe",
  "sublime_text.exe",
  "atom.exe",
  "code.exe", // VS Code — included so it can be blocked during deep work
]);

// ─── SHELL METACHARACTER CHECK ─────────────────────────────────────────
// Reject names that could be used for command injection.
const REJECT_PATTERN = /[;&|`$(){}[\]#~!<>\n\r]/;

/**
 * Attempt to kill processes whose executable name matches `appName`.
 *
 * @param {string} appName  - The friendly app name (e.g. "Spotify", "Discord")
 * @returns {{ killed: boolean, exeName: string|null, reason: string }}
 */
function killProcessByName(appName) {
  // ── Input validation ─────────────────────────────────────────────
  if (!appName || typeof appName !== "string") {
    console.log(`[TaskKill] REJECTED: appName is ${typeof appName}`);
    return { killed: false, exeName: null, reason: "Invalid input: appName is not a non-empty string" };
  }

  const trimmed = appName.trim();
  if (trimmed.length === 0) {
    console.log(`[TaskKill] REJECTED: empty appName`);
    return { killed: false, exeName: null, reason: "Invalid input: empty appName" };
  }

  // ── Shell injection guard ────────────────────────────────────────
  if (REJECT_PATTERN.test(trimmed)) {
    console.log(`[TaskKill] REJECTED: appName "${trimmed}" contains shell metacharacters — possible injection attempt`);
    return { killed: false, exeName: null, reason: `Security: appName contains shell metacharacters` };
  }

  // ── Resolve to executable name ───────────────────────────────────
  const exeName = deriveExeName(trimmed);
  if (!exeName) {
    console.log(`[TaskKill] SKIPPED: "${trimmed}" resolves to null (web-based / no native app)`);
    return { killed: false, exeName: null, reason: `No native executable for "${trimmed}" (web-based service)` };
  }

  // ── Safelist check ───────────────────────────────────────────────
  if (!ALLOWED_EXECUTABLES.has(exeName)) {
    console.log(`[TaskKill] BLOCKED: "${exeName}" is not in the safe-kill list.`);
    console.log(`[TaskKill]   To allow killing ${exeName}, add it to ALLOWED_EXECUTABLES in taskkill.js`);
    return { killed: false, exeName, reason: `"${exeName}" is not in the safe-kill allowlist` };
  }

  // ── Execute kill ─────────────────────────────────────────────────
  const exeDisplay = isWindows ? exeName : exeName.replace(/\.exe$/i, "");

  console.log(`[TaskKill] ATTEMPTING: kill ${exeDisplay} (requested as "${trimmed}")`);

  try {
    if (isWindows) {
      // taskkill /F forces termination; /IM matches image name exactly
      // This is safe because exeName is validated against the safelist
      const cmd = `taskkill /F /IM "${exeName}"`;
      const result = execSync(cmd, { timeout: 8000, encoding: "utf-8", shell: true });
      const lines = result.trim().split(/\r?\n/).filter(Boolean);
      const summary = lines.join(" | ");
      console.log(`[TaskKill] SUCCESS: taskkill /F /IM "${exeName}"`);
      if (summary) console.log(`[TaskKill]   Output: ${summary}`);
      return { killed: true, exeName, reason: `Successfully terminated ${exeDisplay}` };
    } else {
      const cmd = `pkill -f -i "${exeDisplay}"`;
      const result = execSync(cmd, { timeout: 8000, encoding: "utf-8" });
      console.log(`[TaskKill] SUCCESS: pkill -f -i "${exeDisplay}"`);
      if (result.trim()) console.log(`[TaskKill]   Output: ${result.trim()}`);
      return { killed: true, exeName, reason: `Successfully terminated ${exeDisplay}` };
    }
  } catch (err) {
    const stderr = err.stderr ? err.stderr.trim() : "";
    const stdout = err.stdout ? err.stdout.trim() : "";
    const exitCode = err.status !== undefined ? err.status : -1;

    const isNotFoundError =
      stderr.toLowerCase().includes("not found") ||
      stdout.toLowerCase().includes("not found");

    if (isNotFoundError) {
      console.log(`[TaskKill] NO-PROCESS: ${exeDisplay} is not currently running`);
    } else {
      console.log(`[TaskKill] ERROR: Failed to kill ${exeDisplay} (exit=${exitCode})`);
      if (stdout) console.log(`[TaskKill]   stdout: ${stdout}`);
      if (stderr) console.log(`[TaskKill]   stderr: ${stderr}`);
    }

    return {
      killed: false,
      exeName,
      reason: isNotFoundError
        ? `${exeDisplay} is not currently running`
        : `Failed to kill ${exeDisplay} (exit=${exitCode}): ${stderr || stdout || "unknown error"}`
    };
  }
}

// ─── EXECUTABLE NAME RESOLVER ──────────────────────────────────────────

const EXE_MAP = {
  // Browsers
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

  // Communication
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

  // Media / Entertainment
  "spotify": "spotify.exe",
  "itunes": "itunes.exe",
  "apple music": "itunes.exe",
  "windows media player": "wmplayer.exe",
  "vlc": "vlc.exe",
  "vlc media player": "vlc.exe",
  "obs studio": "obs64.exe",
  "obs": "obs64.exe",

  // Gaming
  "steam": "steam.exe",
  "epic games": "epicgameslauncher.exe",
  "epic games launcher": "epicgameslauncher.exe",
  "battle.net": "battlenet.exe",
  "valorant": "valorant.exe",
  "league of legends": "leagueclientux.exe",
  "league client": "leagueclientux.exe",

  // Social
  "twitter": "twitter.exe",
  "x": "x.exe",
  "instagram": "instagram.exe",

  // Tools
  "notepad++": "notepad++.exe",
  "sublime text": "sublime_text.exe",
  "atom": "atom.exe",
  "code": "code.exe",
  "visual studio code": "code.exe",
  "vs code": "code.exe",
  "cursor": "cursor.exe",
  "windsurf": "windsurf.exe",

  // Web-based (no native app to kill)
  "netflix": null,
  "youtube": null,
  "instagram.com": null,
  "twitter.com": null,
  "x.com": null,
  "reddit": null,
  "reddit.com": null,
  "facebook": null,
  "facebook.com": null,
};

/**
 * Derive the executable name from a user-facing app name.
 *
 * @param {string} name - The raw app name (e.g. "Discord", "Visual Studio Code")
 * @returns {string|null} - The executable name (e.g. "Discord.exe") or null if it's web-based
 */
function deriveExeName(name) {
  const key = name.toLowerCase().trim();

  // Direct map match
  if (EXE_MAP[key] !== undefined) return EXE_MAP[key];

  // Partial match — check if any map key is contained in the input
  for (const [knownAlias, exe] of Object.entries(EXE_MAP)) {
    if (key.includes(knownAlias) || knownAlias.includes(key)) {
      return exe;
    }
  }

  // No match found — refuse to guess
  console.log(`[TaskKill] UNKNOWN: "${name}" does not match any known app — refusing to derive a generic executable name`);
  return null;
}

module.exports = { killProcessByName }; 