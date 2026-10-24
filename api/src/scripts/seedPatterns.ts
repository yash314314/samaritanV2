// Shared client: follows DATABASE_TARGET like the API does.
import { prisma } from "../prisma";


type PatternSeed = {
  appNames: string[];
  titleRegex: string;
  category: string;
  intent: string;
  focusImpact: number;
  energyImpact?: number;
  confidence: number;
};

function pattern(seed: PatternSeed) {
  return seed.appNames.map((appName) => ({
    appName,
    titleRegex: seed.titleRegex,
    category: seed.category,
    intent: seed.intent,
    focusImpact: seed.focusImpact,
    energyImpact: seed.energyImpact ?? 0,
    confidence: seed.confidence,
  }));
}

const browserApps = [
  "Google Chrome",
  "Chrome",
  "chrome",
  "Microsoft Edge",
  "Edge",
  "msedge",
  "Brave",
  "Brave Browser",
  "Avast Secure Browser",
  // Linux window classes (Hyprland class / X11 WM_CLASS)
  "brave-browser",
  "chromium",
  "google-chrome",
  "firefox",
  "Firefox",
  "Mozilla Firefox",
  "librewolf",
  "vivaldi-stable",
  "opera",
];

const patterns = [
  ...pattern({
    appNames: ["Cursor", "Cursor.exe", "cursor"],
    titleRegex: ".*",
    category: "deep_work",
    intent: "coding",
    focusImpact: 0.95,
    energyImpact: -0.1,
    confidence: 0.95,
  }),
  ...pattern({
    appNames: ["Microsoft Visual Studio Code", "Visual Studio Code", "VS Code", "Code", "Code.exe", "code-oss", "codium", "VSCodium", "com.visualstudio.code", "zed", "dev.zed.Zed", "jetbrains-idea", "jetbrains-pycharm", "jetbrains-webstorm"],
    titleRegex: ".*",
    category: "deep_work",
    intent: "coding",
    focusImpact: 0.95,
    energyImpact: -0.1,
    confidence: 0.95,
  }),
  ...pattern({
    appNames: ["Postman", "Postman.exe"],
    titleRegex: ".*",
    category: "deep_work",
    intent: "api_testing",
    focusImpact: 0.8,
    energyImpact: -0.05,
    confidence: 0.9,
  }),
  ...pattern({
    appNames: ["MATLAB", "Res2DInv", "GeoRose"],
    titleRegex: ".*",
    category: "deep_work",
    intent: "analysis",
    focusImpact: 0.9,
    energyImpact: -0.05,
    confidence: 0.9,
  }),
  ...pattern({
    appNames: ["Obsidian", "Obsidian.exe", "Codex", "md.obsidian.Obsidian", "obsidian"],
    titleRegex: ".*",
    category: "deep_work",
    intent: "thinking",
    focusImpact: 0.85,
    energyImpact: -0.05,
    confidence: 0.9,
  }),

  ...pattern({
    appNames: ["Docker Desktop", "Docker", "Git", "Node.js", "Node", "XAMPP", "Miniconda", "Terminal", "Windows Terminal", "PowerShell", "kitty", "Alacritty", "foot", "wezterm", "org.wezfurlong.wezterm", "gnome-terminal-server", "org.gnome.Terminal", "konsole", "org.kde.konsole", "xterm", "ghostty", "com.mitchellh.ghostty", "tilix", "terminator"],
    titleRegex: ".*",
    category: "development_tools",
    intent: "runtime",
    focusImpact: 0.65,
    confidence: 0.88,
  }),

  ...pattern({
    appNames: ["Notion", "Notion.exe", "Notion Calendar", "Microsoft OneNote", "OneNote", "todoist", "Todoist", "ticktick", "logseq", "Logseq"],
    titleRegex: ".*",
    category: "productivity",
    intent: "planning",
    focusImpact: 0.7,
    confidence: 0.9,
  }),

  ...pattern({
    appNames: ["Discord", "Discord.exe", "Slack", "Slack.exe", "WhatsApp", "WhatsApp.exe", "Telegram", "Telegram.exe", "Microsoft Teams", "Teams", "Outlook", "discord", "vesktop", "dev.vencord.Vesktop", "com.discordapp.Discord", "slack", "com.slack.Slack", "org.telegram.desktop", "TelegramDesktop", "thunderbird", "org.mozilla.Thunderbird"],
    titleRegex: ".*",
    category: "communication",
    intent: "chat",
    focusImpact: 0.4,
    energyImpact: -0.05,
    confidence: 0.9,
  }),
  ...pattern({
    appNames: ["Remote Desktop Connection", "mstsc", "AnyDesk", "TeamViewer"],
    titleRegex: ".*",
    category: "communication",
    intent: "remote_work",
    focusImpact: 0.6,
    confidence: 0.8,
  }),

  ...pattern({
    appNames: ["VLC media player", "VLC", "vlc", "org.videolan.VLC", "mpv", "io.mpv.Mpv", "celluloid"],
    titleRegex: ".*",
    category: "media",
    intent: "video",
    focusImpact: 0.2,
    confidence: 0.9,
  }),
  ...pattern({
    appNames: ["Spotify", "Spotify.exe", "spotify", "com.spotify.Client"],
    titleRegex: ".*",
    category: "media",
    intent: "music",
    focusImpact: 0.3,
    confidence: 0.9,
  }),

  ...pattern({
    appNames: ["VALORANT", "Riot Client", "Battle.net", "Steam", "Epic Games Launcher", "Zenless Zone Zero", "steam", "com.valvesoftware.Steam", "heroic", "lutris"],
    titleRegex: ".*",
    category: "entertainment",
    intent: "gaming",
    focusImpact: 0.05,
    energyImpact: 0.25,
    confidence: 1,
  }),

  // Streaming services installed as their own window (web app or wrapper),
  // which the browser title rule below never sees.
  ...pattern({
    appNames: ["netflix", "Netflix", "youtube", "YouTube", "FreeTube", "freetube", "io.freetubeapp.FreeTube", "primevideo", "prime-video", "hotstar", "jiohotstar", "disneyplus", "twitch"],
    titleRegex: ".*",
    category: "entertainment",
    intent: "streaming_video",
    focusImpact: 0.1,
    energyImpact: 0.05,
    confidence: 1,
  }),

  ...pattern({
    appNames: browserApps,
    titleRegex: ".*(github|gitlab|bitbucket).*",
    category: "deep_work",
    intent: "coding",
    focusImpact: 0.9,
    confidence: 0.95,
  }),
  ...pattern({
    appNames: browserApps,
    titleRegex: ".*(stackoverflow|stack overflow|mdn|developer\\.mozilla|docs|documentation|openai|api reference).*",
    category: "research",
    intent: "documentation",
    focusImpact: 0.72,
    confidence: 0.9,
  }),
  ...pattern({
    appNames: browserApps,
    titleRegex: ".*(gmail|mail\\.google|outlook|calendar\\.google).*",
    category: "communication",
    intent: "email",
    focusImpact: 0.42,
    confidence: 0.85,
  }),
  ...pattern({
    appNames: browserApps,
    titleRegex: ".*(youtube|netflix|twitch|prime video|hotstar|episode|series|movie|stream).*",
    category: "entertainment",
    intent: "streaming_video",
    focusImpact: 0.1,
    energyImpact: 0.05,
    confidence: 0.95,
  }),
  ...pattern({
    appNames: browserApps,
    titleRegex: ".*(reddit|instagram|twitter|x\\.com|facebook|linkedin|pinterest|tiktok|threads|bluesky).*",
    category: "communication",
    intent: "social_media",
    focusImpact: 0.25,
    energyImpact: -0.08,
    confidence: 0.9,
  }),
  ...pattern({
    appNames: browserApps,
    titleRegex: ".*",
    category: "research",
    intent: "reading",
    focusImpact: 0.6,
    confidence: 0.7,
  }),

  ...pattern({
    appNames: ["File Explorer", "Windows Explorer", "Explorer", "explorer", "thunar", "Thunar", "org.gnome.Nautilus", "nautilus", "org.kde.dolphin", "dolphin", "nemo", "pcmanfm"],
    titleRegex: ".*",
    category: "system",
    intent: "file_management",
    focusImpact: 0.25,
    confidence: 0.8,
  }),
  ...pattern({
    appNames: ["WinRAR", "7-Zip", "MKVToolNix", "blueman-manager", "pavucontrol", "nm-connection-editor", "nwg-look", "qt5ct", "qt6ct", "dev.noctalia.Noctalia", "systemsettings", "org.gnome.Settings", "gnome-control-center", "file-roller", "org.gnome.FileRoller"],
    titleRegex: ".*",
    category: "system",
    intent: "utility",
    focusImpact: 0.3,
    confidence: 0.8,
  }),
  // Samaritan's own windows: reviewing tracked time is planning, not a distraction.
  // "desktop" is the Electron window class of the tracker on Linux.
  ...pattern({
    appNames: ["Samaritan", "desktop"],
    titleRegex: ".*",
    category: "productivity",
    intent: "planning",
    focusImpact: 0.55,
    confidence: 0.85,
  }),
  ...pattern({
    appNames: ["System Idle", "Idle"],
    titleRegex: ".*",
    category: "idle",
    intent: "idle",
    focusImpact: 0,
    energyImpact: 0.1,
    confidence: 1,
  }),
];

async function main() {
  // --if-empty: container start-up seeds a fresh database once and never
  // replaces patterns that already exist.
  if (process.argv.includes("--if-empty") && (await prisma.appPattern.count({ where: { userId: null } })) > 0) {
    console.log("Classifier patterns already present; skipping seed.");
    return;
  }
  console.log("Seeding Samaritan classifier patterns...");
  // Only the shared set is replaced; patterns users taught through reviews survive.
  await prisma.appPattern.deleteMany({ where: { userId: null } });
  await prisma.appPattern.createMany({ data: patterns });
  console.log(`Classifier patterns seeded: ${patterns.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
