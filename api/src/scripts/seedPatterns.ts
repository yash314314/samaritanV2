import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  console.log("Seeding Samaritan classifier patterns...");

  await prisma.appPattern.deleteMany();

  await prisma.appPattern.createMany({
    data: [

      /* ------------------------------
      DEVELOPMENT / DEEP WORK
      ------------------------------ */

      {
        appName: "Cursor",
        titleRegex: ".*",
        category: "deep_work",
        intent: "coding",
        focusImpact: 0.95,
        energyImpact: -0.1,
        confidence: 0.95
      },

      {
        appName: "Microsoft Visual Studio Code",
        titleRegex: ".*",
        category: "deep_work",
        intent: "coding",
        focusImpact: 0.95,
        energyImpact: -0.1,
        confidence: 0.95
      },

      {
        appName: "Postman",
        titleRegex: ".*",
        category: "deep_work",
        intent: "api_testing",
        focusImpact: 0.8,
        energyImpact: -0.05,
        confidence: 0.9
      },

      {
        appName: "MATLAB",
        titleRegex: ".*",
        category: "deep_work",
        intent: "analysis",
        focusImpact: 0.9,
        energyImpact: -0.05,
        confidence: 0.9
      },

      {
        appName: "Res2DInv",
        titleRegex: ".*",
        category: "deep_work",
        intent: "geophysics",
        focusImpact: 0.9,

        confidence: 0.9
      },

      {
        appName: "GeoRose",
        titleRegex: ".*",
        category: "deep_work",
        intent: "analysis",
        focusImpact: 0.85,
        confidence: 0.9
      },

      {
        appName: "Obsidian",
        titleRegex: ".*",
        category: "deep_work",
        intent: "thinking",
        focusImpact: 0.85,
        energyImpact: -0.05,
        confidence: 0.9
      },
      {
        appName: "Codex",
        titleRegex: ".*",
        category: "deep_work",
        intent: "thinking",
        focusImpact: 0.95,
        energyImpact: -0.1,
        confidence: 0.95
      },

      /* ------------------------------
      DEVELOPMENT INFRASTRUCTURE
      ------------------------------ */

      {
        appName: "Docker Desktop",
        titleRegex: ".*",
        category: "development_tools",
        intent: "containers",
        focusImpact: 0.7,
        confidence: 0.9
      },

      {
        appName: "Git",
        titleRegex: ".*",
        category: "development_tools",
        intent: "version_control",
        focusImpact: 0.6,
        confidence: 0.9
      },

      {
        appName: "Node.js",
        titleRegex: ".*",
        category: "development_tools",
        intent: "runtime",
        focusImpact: 0.6,
        confidence: 0.9
      },

      {
        appName: "XAMPP",
        titleRegex: ".*",
        category: "development_tools",
        intent: "local_server",
        focusImpact: 0.6,
        confidence: 0.9
      },

      {
        appName: "Miniconda",
        titleRegex: ".*",
        category: "development_tools",
        intent: "python_environment",
        focusImpact: 0.6,
        confidence: 0.9
      },

      /* ------------------------------
      PRODUCTIVITY
      ------------------------------ */

      {
        appName: "Notion",
        titleRegex: ".*",
        category: "productivity",
        intent: "planning",
        focusImpact: 0.7,
        confidence: 0.9
      },

      {
        appName: "Notion Calendar",
        titleRegex: ".*",
        category: "productivity",
        intent: "planning",
        focusImpact: 0.6,
        confidence: 0.9
      },

      {
        appName: "Microsoft OneNote",
        titleRegex: ".*",
        category: "productivity",
        intent: "notes",
        focusImpact: 0.7,
        confidence: 0.9
      },

      /* ------------------------------
      COMMUNICATION
      ------------------------------ */

      {
        appName: "Brave Browser",
        titleRegex: ".*(Instagram|instagram\\.com).*",
        category: "communication",
        intent: "social_media",
        focusImpact: 0.3,
        energyImpact: -0.08,
        confidence: 0.92
      },
      {
        appName: "Avast Secure Browser",
        titleRegex: ".*(Instagram|instagram\\.com).*",
        category: "communication",
        intent: "social_media",
        focusImpact: 0.3,
        energyImpact: -0.08,
        confidence: 0.92
      },
      {
        appName: "Discord",
        titleRegex: ".*",
        category: "communication",
        intent: "chat",
        focusImpact: 0.4,
        energyImpact: -0.05,
        confidence: 0.9
      },
      {
        appName: "WhatsApp",
        titleRegex: ".*",
        category: "communication",
        intent: "chat",
        focusImpact: 0.4,
        energyImpact: -0.05,
        confidence: 0.9
      },
      {
        appName: "Telegram",
        titleRegex: ".*",
        category: "communication",
        intent: "chat",
        focusImpact: 0.4,
        energyImpact: -0.05,
        confidence: 0.9
      },
      {
        appName: "Remote Desktop Connection",
        titleRegex: ".*",
        category: "communication",
        intent: "remote_work",
        focusImpact: 0.6,
        confidence: 0.8
      },

      /* ------------------------------
      MEDIA
      ------------------------------ */

      {
        appName: "VLC media player",
        titleRegex: ".*",
        category: "media",
        intent: "video",
        focusImpact: 0.2,
        confidence: 0.9
      },
      
      {
        appName: "Spotify",
        titleRegex: ".*",
        category: "entertainment",
        intent: "music",
        focusImpact: 0.3,
        confidence: 0.9
      },
      
      {
        appName: "Microsoft Edge",
        titleRegex: ".*(Netflix|netflix\\.com).*",
        category: "entertainment",
        intent: "streaming_video",
        focusImpact: 0.15,
        energyImpact: 0.05,
        confidence: 0.95
      },
      
      {
        appName: "Brave Browser",
        titleRegex: ".*(Netflix|netflix\\.com).*",
        category: "entertainment",
        intent: "streaming_video",
        focusImpact: 0.15,
        energyImpact: 0.05,
        confidence: 0.95
      },
      
      {
        appName: "Microsoft Edge",
        titleRegex: ".*(movie|movies|watch|stream|episode|series).*",
        category: "entertainment",
        intent: "video_streaming",
        focusImpact: 0.15,
        energyImpact: 0.05,
        confidence: 0.7
      },
      
      {
        appName: "Brave Browser",
        titleRegex: ".*(movie|movies|watch|stream|episode|series).*",
        category: "entertainment",
        intent: "video_streaming",
        focusImpact: 0.15,
        energyImpact: 0.05,
        confidence: 0.7
      },
      /* ------------------------------
      ENTERTAINMENT / GAMING
      ------------------------------ */

      {
        appName: "VALORANT",
        titleRegex: ".*",
        category: "entertainment",
        intent: "gaming",
        focusImpact: 0.05,
        energyImpact: 0.3,
        confidence: 1
      },

      {
        appName: "Zenless Zone Zero",
        titleRegex: ".*",
        category: "entertainment",
        intent: "gaming",
        focusImpact: 0.05,
        confidence: 1
      },

      {
        appName: "Battle.net",
        titleRegex: ".*",
        category: "entertainment",
        intent: "gaming",
        focusImpact: 0.1,
        confidence: 1
      },

      {
        appName: "Riot Client",
        titleRegex: ".*",
        category: "entertainment",
        intent: "gaming",
        focusImpact: 0.1,
        confidence: 1
      },

      /* ------------------------------
      BROWSER INTELLIGENCE
      ------------------------------ */

      {
        appName: "Google Chrome",
        titleRegex: ".*github.*",
        category: "deep_work",
        intent: "coding",
        focusImpact: 0.9,
        confidence: 0.95
      },

      {
        appName: "Google Chrome",
        titleRegex: ".*stackoverflow.*",
        category: "research",
        intent: "debugging",
        focusImpact: 0.7,
        confidence: 0.9
      },

      {
        appName: "Google Chrome",
        titleRegex: ".*docs.*",
        category: "research",
        intent: "documentation",
        focusImpact: 0.7,
        confidence: 0.9
      },

      {
        appName: "Google Chrome",
        titleRegex: ".*youtube.*",
        category: "entertainment",
        intent: "video",
        focusImpact: 0.1,
        confidence: 0.9
      },

      {
        appName: "Google Chrome",
        titleRegex: ".*",
        category: "research",
        intent: "reading",
        focusImpact: 0.6,
        confidence: 0.7
      },

      {
        appName: "Brave",
        titleRegex: ".*",
        category: "research",
        intent: "reading",
        focusImpact: 0.6,
        confidence: 0.7
      },

      {
        appName: "Microsoft Edge",
        titleRegex: ".*",
        category: "research",
        intent: "reading",
        focusImpact: 0.6,
        confidence: 0.7
      },

      /* ------------------------------
      SYSTEM / IGNORE
      ------------------------------ */

      {
        appName: "WinRAR",
        titleRegex: ".*",
        category: "system",
        intent: "file_management",
        focusImpact: 0.3,
        confidence: 0.8
      },

      {
        appName: "MKVToolNix",
        titleRegex: ".*",
        category: "system",
        intent: "media_processing",
        focusImpact: 0.3,
        confidence: 0.8
      },
      {
        appName: "System Idle",
        titleRegex: ".*",
        category: "system",
        intent: "idle",
        focusImpact: 0,
        energyImpact: 0.1,
        confidence: 1
      },

    ]
  });

  console.log("Classifier patterns seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });