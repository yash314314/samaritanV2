const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile, execFileSync } = require("child_process");

/*
 * Linux application icons, resolved the way desktop shells do it
 * (freedesktop Desktop Entry + Icon Theme specs):
 *
 *   window class -> .desktop entry -> Icon= name -> current icon theme
 *   (and its Inherits chain, then hicolor, then pixmaps) -> PNG data URL
 *
 * Electron's app.getFileIcon() cannot do this on Linux; it fails for
 * almost every executable.
 */

const ICON_SIZE = 48; // 32 CSS px on a 1.25x display needs 40 device px
const MAX_SVG_BYTES = 256 * 1024;

const home = os.homedir();
const dataHome = process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
const dataDirs = [
  dataHome,
  ...(process.env.XDG_DATA_DIRS || "/usr/local/share:/usr/share").split(":").filter(Boolean),
  path.join(dataHome, "flatpak", "exports", "share"),
  "/var/lib/flatpak/exports/share",
];
const iconBaseDirs = [path.join(home, ".icons"), ...dataDirs.map((dir) => path.join(dir, "icons"))];
const pixmapDirs = dataDirs.map((dir) => path.join(dir, "pixmaps"));

let nativeImage = null;
try {
  ({ nativeImage } = require("electron"));
} catch {
  // Plain Node (tests, scripts): PNGs are embedded without resizing.
}

/* ---------------- INI PARSING ---------------- */

function parseIni(text) {
  const groups = {};
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      current = groups[header[1]] = groups[header[1]] || {};
      continue;
    }
    const eq = line.indexOf("=");
    // Localised keys (Name[de]=...) are irrelevant here.
    if (current && eq > 0 && !line.slice(0, eq).includes("[")) {
      current[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  return groups;
}

function readIni(file) {
  try {
    return parseIni(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/* ---------------- DESKTOP ENTRIES ---------------- */

let desktopIndex = null;

function execBasename(exec) {
  const tokens = (exec || "").split(/\s+/).filter((token) => !/^\w+=/.test(token));
  const first = (tokens[0] || "").replace(/^"|"$/g, "");
  const name = path.basename(first).toLowerCase();
  // Launchers that wrap the real program say nothing about the window.
  return ["env", "flatpak", "sh", "bash", "snap"].includes(name) ? null : name || null;
}

function buildDesktopIndex() {
  const index = { byWmClass: new Map(), byId: new Map(), byExec: new Map() };
  // Earlier data dirs win: user entries override system ones.
  for (const dir of dataDirs) {
    const appsDir = path.join(dir, "applications");
    let files;
    try {
      files = fs.readdirSync(appsDir).filter((file) => file.endsWith(".desktop"));
    } catch {
      continue;
    }
    for (const file of files) {
      const entry = readIni(path.join(appsDir, file))?.["Desktop Entry"];
      if (!entry?.Icon) continue;
      const id = file.slice(0, -".desktop".length).toLowerCase();
      const wmClass = entry.StartupWMClass?.toLowerCase();
      const exec = execBasename(entry.Exec);
      if (!index.byId.has(id)) index.byId.set(id, entry.Icon);
      if (wmClass && !index.byWmClass.has(wmClass)) index.byWmClass.set(wmClass, entry.Icon);
      if (exec && !index.byExec.has(exec)) index.byExec.set(exec, entry.Icon);
    }
  }
  return index;
}

function desktopIconName(appClass, exePath) {
  desktopIndex = desktopIndex || buildDesktopIndex();
  const cls = (appClass || "").toLowerCase();
  const exe = exePath ? path.basename(exePath).toLowerCase() : null;
  if (cls && desktopIndex.byWmClass.has(cls)) return desktopIndex.byWmClass.get(cls);
  if (cls && desktopIndex.byId.has(cls)) return desktopIndex.byId.get(cls);
  if (cls) {
    // Reverse-DNS ids: class "nautilus" -> org.gnome.Nautilus.desktop
    for (const [id, icon] of desktopIndex.byId) {
      if (id.endsWith(`.${cls}`)) return icon;
    }
  }
  if (exe && desktopIndex.byExec.has(exe)) return desktopIndex.byExec.get(exe);
  if (cls && desktopIndex.byExec.has(cls)) return desktopIndex.byExec.get(cls);
  return null;
}

/* ---------------- ICON THEMES ---------------- */

const themeCache = new Map();

function currentThemeName() {
  for (const file of [
    path.join(home, ".config", "gtk-4.0", "settings.ini"),
    path.join(home, ".config", "gtk-3.0", "settings.ini"),
  ]) {
    const name = readIni(file)?.Settings?.["gtk-icon-theme-name"];
    if (name) return name.replace(/^"|"$/g, "");
  }
  try {
    const name = execFileSync("gsettings", ["get", "org.gnome.desktop.interface", "icon-theme"], {
      encoding: "utf8",
      timeout: 2000,
    }).trim().replace(/^'|'$/g, "");
    if (name) return name;
  } catch {
    // No GNOME settings daemon.
  }
  return readIni(path.join(home, ".config", "kdeglobals"))?.Icons?.Theme || "hicolor";
}

function loadTheme(name) {
  if (themeCache.has(name)) return themeCache.get(name);
  let theme = null;
  for (const base of iconBaseDirs) {
    const ini = readIni(path.join(base, name, "index.theme"));
    const info = ini?.["Icon Theme"];
    if (!info) continue;
    const dirNames = [info.Directories, info.ScaledDirectories]
      .filter(Boolean)
      .join(",")
      .split(",")
      .map((dir) => dir.trim())
      .filter(Boolean);
    const directories = dirNames.map((dir) => {
      const props = ini[dir] || {};
      const size = Number(props.Size) || 48;
      return {
        dir,
        size,
        scale: Number(props.Scale) || 1,
        type: props.Type || "Threshold",
        min: Number(props.MinSize) || size,
        max: Number(props.MaxSize) || size,
        threshold: Number(props.Threshold) || 2,
      };
    });
    theme = {
      name,
      directories,
      inherits: (info.Inherits || "").split(",").map((parent) => parent.trim()).filter(Boolean),
    };
    break;
  }
  themeCache.set(name, theme);
  return theme;
}

// Smallest icon at least ICON_SIZE wins; upscaling small bitmaps is penalised.
function sizeScore(directory, extension) {
  const scale = directory.scale;
  let lo = directory.size * scale;
  let hi = lo;
  if (directory.type === "Scalable") {
    lo = directory.min * scale;
    hi = extension === ".svg" ? Infinity : directory.max * scale;
  } else if (directory.type === "Threshold") {
    lo = (directory.size - directory.threshold) * scale;
    hi = (directory.size + directory.threshold) * scale;
  }
  if (ICON_SIZE >= lo && ICON_SIZE <= hi) return 0;
  return lo > ICON_SIZE ? lo - ICON_SIZE : (ICON_SIZE - hi) * 10;
}

function findInTheme(theme, iconName) {
  let best = null;
  for (const directory of theme.directories) {
    for (const base of iconBaseDirs) {
      for (const extension of [".svg", ".png"]) {
        const file = path.join(base, theme.name, directory.dir, iconName + extension);
        if (!fs.existsSync(file)) continue;
        const score = sizeScore(directory, extension);
        if (!best || score < best.score) best = { file, score };
        if (score === 0) return file;
      }
    }
  }
  return best?.file || null;
}

function lookupIcon(iconName) {
  const visited = new Set();
  const queue = [currentThemeName()];
  while (queue.length) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);
    const theme = loadTheme(name);
    if (!theme) continue;
    const file = findInTheme(theme, iconName);
    if (file) return file;
    queue.push(...theme.inherits);
  }
  if (!visited.has("hicolor")) {
    const hicolor = loadTheme("hicolor");
    const file = hicolor && findInTheme(hicolor, iconName);
    if (file) return file;
  }
  for (const dir of pixmapDirs) {
    for (const extension of [".svg", ".png"]) {
      const file = path.join(dir, iconName + extension);
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

/* ---------------- RASTERISATION ---------------- */

function rasterizeSvg(file) {
  return new Promise((resolve) => {
    execFile(
      "rsvg-convert",
      ["-w", String(ICON_SIZE), "-h", String(ICON_SIZE), "-a", file],
      { encoding: "buffer", maxBuffer: 4 * 1024 * 1024, timeout: 5000 },
      (err, stdout) => resolve(err ? null : stdout)
    );
  });
}

async function toDataUrl(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".svg") {
    const png = await rasterizeSvg(file);
    if (png?.length) return `data:image/png;base64,${png.toString("base64")}`;
    // Without librsvg, small SVGs still render in the dashboard as-is.
    const svg = fs.readFileSync(file);
    return svg.length <= MAX_SVG_BYTES ? `data:image/svg+xml;base64,${svg.toString("base64")}` : null;
  }
  if (extension === ".png") {
    if (nativeImage) {
      const image = nativeImage.createFromPath(file);
      if (image.isEmpty()) return null;
      return image.resize({ width: ICON_SIZE, height: ICON_SIZE, quality: "best" }).toDataURL();
    }
    return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  }
  return null;
}

/* ---------------- PUBLIC API ---------------- */

/**
 * Returns a PNG data URL for the application owning a window, or null.
 * appClass is the window class (Hyprland "class", X11 WM_CLASS).
 */
async function resolveAppIcon({ appClass, exePath }) {
  const names = [];
  const fromEntry = desktopIconName(appClass, exePath);
  if (fromEntry) {
    if (path.isAbsolute(fromEntry) && fs.existsSync(fromEntry)) return toDataUrl(fromEntry);
    names.push(fromEntry.replace(/\.(png|svg|xpm)$/i, ""));
  }
  if (appClass) names.push(appClass, appClass.toLowerCase());
  if (exePath) names.push(path.basename(exePath));

  for (const name of [...new Set(names)]) {
    const file = lookupIcon(name);
    if (!file) continue;
    const dataUrl = await toDataUrl(file);
    if (dataUrl) return dataUrl;
  }
  return null;
}

module.exports = { resolveAppIcon, ICON_SIZE };
