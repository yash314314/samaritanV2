import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    appNames: ["Microsoft Visual Studio Code", "Visual Studio Code", "VS Code", "Code", "Code.exe"],
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
    appNames: ["Obsidian", "Obsidian.exe", "Codex"],
    titleRegex: ".*",
    category: "deep_work",
    intent: "thinking",
    focusImpact: 0.85,
    energyImpact: -0.05,
    confidence: 0.9,
  }),

  ...pattern({
    appNames: ["Docker Desktop", "Docker", "Git", "Node.js", "Node", "XAMPP", "Miniconda", "Terminal", "Windows Terminal", "PowerShell"],
    titleRegex: ".*",
    category: "development_tools",
    intent: "runtime",
    focusImpact: 0.65,
    confidence: 0.88,
  }),

  ...pattern({
    appNames: ["Notion", "Notion.exe", "Notion Calendar", "Microsoft OneNote", "OneNote"],
    titleRegex: ".*",
    category: "productivity",
    intent: "planning",
    focusImpact: 0.7,
    confidence: 0.9,
  }),

  ...pattern({
    appNames: ["Discord", "Discord.exe", "Slack", "Slack.exe", "WhatsApp", "WhatsApp.exe", "Telegram", "Telegram.exe", "Microsoft Teams", "Teams", "Outlook"],
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
    appNames: ["VLC media player", "VLC", "vlc"],
    titleRegex: ".*",
    category: "media",
    intent: "video",
    focusImpact: 0.2,
    confidence: 0.9,
  }),
  ...pattern({
    appNames: ["Spotify", "Spotify.exe"],
    titleRegex: ".*",
    category: "media",
    intent: "music",
    focusImpact: 0.3,
    confidence: 0.9,
  }),

  ...pattern({
    appNames: ["VALORANT", "Riot Client", "Battle.net", "Steam", "Epic Games Launcher", "Zenless Zone Zero"],
    titleRegex: ".*",
    category: "entertainment",
    intent: "gaming",
    focusImpact: 0.05,
    energyImpact: 0.25,
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
    titleRegex: ".*(reddit|instagram|twitter|x\\.com|facebook|linkedin).*",
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
    appNames: ["File Explorer", "Windows Explorer", "Explorer", "explorer"],
    titleRegex: ".*",
    category: "system",
    intent: "file_management",
    focusImpact: 0.25,
    confidence: 0.8,
  }),
  ...pattern({
    appNames: ["WinRAR", "7-Zip", "MKVToolNix"],
    titleRegex: ".*",
    category: "system",
    intent: "utility",
    focusImpact: 0.3,
    confidence: 0.8,
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
  console.log("Seeding Samaritan classifier patterns...");
  await prisma.appPattern.deleteMany();
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
