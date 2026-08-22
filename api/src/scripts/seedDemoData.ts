import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

async function seedDemoData() {
  console.log("🌱 Starting Samaritan Synthetic Demo Data Generation...");

  // 1. Ensure user exists
  await prisma.user.upsert({
    where: { id: USER_ID },
    update: { name: "Alex Rivera (Lead Architect)" },
    create: { id: USER_ID, name: "Alex Rivera (Lead Architect)" },
  });

  // Clean existing demo relational data to make seed reproducible
  console.log("Cleaning old sessions, activities, projects, goals, and calendar events...");
  await prisma.focusIntervention.deleteMany({ where: { deepWork: { userId: USER_ID } } });
  await prisma.deepWorkMinuteLog.deleteMany({ where: { deepWork: { userId: USER_ID } } });
  await prisma.deepWorkPhase.deleteMany({ where: { deepWork: { userId: USER_ID } } });
  await prisma.deepWorkSession.deleteMany({ where: { userId: USER_ID } });
  await prisma.activity.deleteMany({ where: { session: { userId: USER_ID } } });
  await prisma.session.deleteMany({ where: { userId: USER_ID } });
  await prisma.calendarReminder.deleteMany({ where: { userId: USER_ID } });
  await prisma.calendarEvent.deleteMany({ where: { userId: USER_ID } });
  await prisma.goal.deleteMany({ where: { userId: USER_ID } });
  await prisma.projectRule.deleteMany({ where: { project: { userId: USER_ID } } });
  await prisma.projectTime.deleteMany({ where: { project: { userId: USER_ID } } });
  await prisma.project.deleteMany({ where: { userId: USER_ID } });
  await prisma.smartBreak.deleteMany({ where: { userId: USER_ID } });

  // 2. Create Projects
  console.log("Creating Projects and Project Matching Rules...");
  const projPlatform = await prisma.project.create({
    data: {
      userId: USER_ID,
      name: "Samaritan V2 Engine",
      description: "Realtime window tracking, classification pipeline, & session stream engine",
      color: "#8b5cf6",
      icon: "Code2",
      weeklyHourGoal: 20,
      rules: {
        create: [
          { appName: "Cursor", matchType: "exact" },
          { appName: "VS Code", matchType: "exact" },
          { appName: "Warp", matchType: "exact" },
          { domain: "github.com", matchType: "domain" },
          { titleKeyword: "samaritan", matchType: "keyword" }
        ]
      }
    }
  });

  const projUI = await prisma.project.create({
    data: {
      userId: USER_ID,
      name: "Aether UI System",
      description: "Next.js 14 dashboard UI, dark glass theme, focus metrics & Web Audio ambient noise",
      color: "#ec4899",
      icon: "LayoutGrid",
      weeklyHourGoal: 12,
      rules: {
        create: [
          { appName: "Figma", matchType: "exact" },
          { domain: "figma.com", matchType: "domain" },
          { titleKeyword: "dashboard", matchType: "keyword" },
          { titleKeyword: "Tailwind", matchType: "keyword" }
        ]
      }
    }
  });

  const projResearch = await prisma.project.create({
    data: {
      userId: USER_ID,
      name: "Cognitive Load RFC",
      description: "Burnout risk, interrupter frequency, and session entropy algorithms",
      color: "#3b82f6",
      icon: "Cpu",
      weeklyHourGoal: 8,
      rules: {
        create: [
          { appName: "Obsidian", matchType: "exact" },
          { domain: "arxiv.org", matchType: "domain" },
          { titleKeyword: "RFC", matchType: "keyword" }
        ]
      }
    }
  });

  // 3. Create Goals
  console.log("Creating Focus & Productivity Goals...");
  await prisma.goal.createMany({
    data: [
      {
        userId: USER_ID,
        title: "Deep Work Dominance",
        description: "Achieve at least 20 hours of focused deep work per week",
        type: "focus_minutes",
        target: 1200,
        period: "weekly",
        progress: 1040,
        active: true
      },
      {
        userId: USER_ID,
        title: "Samaritan V2 Core Build",
        description: "Log 20 hours dedicated to Samaritan V2 engine development",
        type: "project_time",
        projectId: projPlatform.id,
        target: 1200,
        period: "weekly",
        progress: 1110,
        active: true
      },
      {
        userId: USER_ID,
        title: "Context Switch Control",
        description: "Maintain low fragmentation across productive sessions",
        type: "productive_minutes",
        target: 1800,
        period: "weekly",
        progress: 1620,
        active: true
      },
      {
        userId: USER_ID,
        title: "Daily 4-Block Streak",
        description: "Complete 4 deep work focus blocks every day",
        type: "focus_sessions",
        target: 4,
        period: "daily",
        progress: 3,
        active: true
      }
    ]
  });

  // 4. Create Calendar Events
  console.log("Creating Calendar Schedule & Overlays...");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const calendarItems = [
    {
      offsetDays: 0,
      startHour: 9,
      durationHours: 1,
      title: "Architecture Sync & API Spec Review",
      description: "Reviewing WebSocket payloads, session engine lifecycle, and Prisma schemas",
      eventType: "meeting",
      projectId: projPlatform.id,
      color: "#8b5cf6"
    },
    {
      offsetDays: 0,
      startHour: 10.5,
      durationHours: 2,
      title: "Deep Work: Realtime WebSocket Metrics Stream",
      description: "Implementing duration-weighted focus score computation and broadcast",
      eventType: "focus_block",
      projectId: projPlatform.id,
      color: "#8b5cf6",
      focusAutoStart: true,
      focusEnforcement: "block",
      focusAllowedApps: ["Cursor", "Warp", "Google Chrome"],
      focusBlockedApps: ["Discord", "Twitter"],
      focusBlockedDomains: ["twitter.com", "youtube.com"]
    },
    {
      offsetDays: 0,
      startHour: 13.5,
      durationHours: 1,
      title: "Smart Break & Recovery Walk",
      description: "Cognitive downtime after deep work session",
      eventType: "break",
      color: "#10b981"
    },
    {
      offsetDays: 0,
      startHour: 15,
      durationHours: 2,
      title: "Deep Work: Aether UI Component & Heatmap Polish",
      description: "Refactoring HeatmapGrid and BurnoutRiskCard components",
      eventType: "focus_block",
      projectId: projUI.id,
      color: "#ec4899",
      focusAutoStart: true,
      focusEnforcement: "warn"
    },
    // Yesterday
    {
      offsetDays: -1,
      startHour: 9,
      durationHours: 1.5,
      title: "Sprint Planning & Backlog Refinement",
      description: "Aligning product roadmap and deep work goals",
      eventType: "meeting",
      color: "#6b7280"
    },
    {
      offsetDays: -1,
      startHour: 11,
      durationHours: 2.5,
      title: "Deep Work: Classification Engine & Pattern Matcher",
      description: "Adding regex-based window title classifier",
      eventType: "focus_block",
      projectId: projPlatform.id,
      color: "#8b5cf6"
    },
    {
      offsetDays: -1,
      startHour: 14.5,
      durationHours: 2,
      title: "Deep Work: Obsidian Research Notes on Cognitive Entropy",
      description: "Drafting RFC for context-switching metrics",
      eventType: "focus_block",
      projectId: projResearch.id,
      color: "#3b82f6"
    },
    // 2 Days ago
    {
      offsetDays: -2,
      startHour: 10,
      durationHours: 3,
      title: "Deep Work: Electron Foreground Observer",
      description: "Integrating active-win and 500ms sampling window",
      eventType: "focus_block",
      projectId: projPlatform.id,
      color: "#8b5cf6"
    }
  ];

  for (const item of calendarItems) {
    const startAt = new Date(todayStart.getTime() + item.offsetDays * 86400000 + item.startHour * 3600000);
    const endAt = new Date(startAt.getTime() + item.durationHours * 3600000);

    await prisma.calendarEvent.create({
      data: {
        userId: USER_ID,
        title: item.title,
        description: item.description,
        startAt,
        endAt,
        eventType: item.eventType,
        projectId: item.projectId || null,
        color: item.color,
        focusAutoStart: item.focusAutoStart || false,
        focusEnforcement: item.focusEnforcement || "warn",
        focusAllowedApps: item.focusAllowedApps || [],
        focusBlockedApps: item.focusBlockedApps || [],
        focusBlockedDomains: item.focusBlockedDomains || []
      }
    });
  }

  // 5. Generate Past 7 Days of Rich Sessions and Activities
  console.log("Generating 7 days of realistic session & activity history...");

  const activitiesCatalog = [
    // Productive Deep Work (Samaritan Platform)
    { app: "Cursor", title: "samaritanV2/api/src/services/metricsEngine.ts", category: "productive", intent: "coding", focusImpact: 0.95, energyImpact: 0.8, confidence: 1.0, project: projPlatform.id },
    { app: "Cursor", title: "samaritanV2/dashboard/components/RizeHomeDashboard.tsx", category: "productive", intent: "coding", focusImpact: 0.92, energyImpact: 0.75, confidence: 1.0, project: projPlatform.id },
    { app: "Warp", title: "docker compose up -d postgres && npx prisma migrate deploy", category: "productive", intent: "coding", focusImpact: 0.88, energyImpact: 0.7, confidence: 0.98, project: projPlatform.id },
    { app: "Google Chrome", title: "PR #142: Realtime WebSocket Metrics Stream · GitHub", domain: "github.com", url: "https://github.com/samaritan/v2/pull/142", category: "productive", intent: "coding", focusImpact: 0.90, energyImpact: 0.7, confidence: 0.95, project: projPlatform.id },
    { app: "Google Chrome", title: "Prisma Client Transactions & Middleware · Prisma Docs", domain: "prisma.io", url: "https://www.prisma.io/docs", category: "productive", intent: "research", focusImpact: 0.85, energyImpact: 0.6, confidence: 0.92, project: projPlatform.id },

    // Productive UI Design (Aether UI System)
    { app: "Figma", title: "Samaritan V2 — Design System & Component Library v2.4", domain: "figma.com", category: "productive", intent: "design", focusImpact: 0.94, energyImpact: 0.8, confidence: 1.0, project: projUI.id },
    { app: "Google Chrome", title: "Tailwind CSS v3.4 Documentation — Arbitrary Variants", domain: "tailwindcss.com", category: "productive", intent: "research", focusImpact: 0.86, energyImpact: 0.5, confidence: 0.94, project: projUI.id },

    // Productive Research (Cognitive Load RFC)
    { app: "Obsidian", title: "RFC-004: Quantifying Interrupter Frequency and Focus Entropy.md", category: "productive", intent: "research", focusImpact: 0.91, energyImpact: 0.85, confidence: 1.0, project: projResearch.id },
    { app: "Google Chrome", title: "Measuring Attentional Fragmentation in Knowledge Work — arXiv", domain: "arxiv.org", category: "productive", intent: "research", focusImpact: 0.89, energyImpact: 0.7, confidence: 0.95, project: projResearch.id },

    // Neutral / Communication
    { app: "Slack", title: "#engineering-architecture | Samaritan Internal", category: "neutral", intent: "communication", focusImpact: 0.55, energyImpact: 0.4, confidence: 0.90 },
    { app: "Google Meet", title: "Architecture Sync & API Spec Review (8 attendees)", category: "neutral", intent: "communication", focusImpact: 0.60, energyImpact: 0.5, confidence: 0.95, project: projPlatform.id },
    { app: "Notion", title: "Q3 Samaritan Product Requirements & Roadmap", category: "neutral", intent: "planning", focusImpact: 0.75, energyImpact: 0.6, confidence: 0.92 },

    // Interrupters / Distractions (for analytics & interrupter charts)
    { app: "Google Chrome", title: "Home / X (Twitter) - Latest updates in AI & Web Development", domain: "x.com", url: "https://x.com/home", category: "distracting", intent: "social_media", focusImpact: 0.15, energyImpact: 0.2, confidence: 0.98 },
    { app: "Google Chrome", title: "Lofi Beats 24/7 - Deep Work Focus Music · YouTube", domain: "youtube.com", url: "https://youtube.com/watch?v=5qap5aO4i9A", category: "distracting", intent: "entertainment", focusImpact: 0.40, energyImpact: 0.3, confidence: 0.95 },
    { app: "Google Chrome", title: "r/rust - Performance optimizations for async streams", domain: "reddit.com", url: "https://reddit.com/r/rust", category: "distracting", intent: "social_media", focusImpact: 0.35, energyImpact: 0.3, confidence: 0.90 },

    // Low confidence entries for Pending Time Entries review section
    { app: "Terminal", title: "htop --sort-key=PERCENT_CPU", category: "unknown", intent: "system", focusImpact: 0.50, energyImpact: 0.3, confidence: 0.35 },
    { app: "Electron", title: "DevTools - localhost:3000/focus", category: "unknown", intent: "debugging", focusImpact: 0.65, energyImpact: 0.4, confidence: 0.42 }
  ];

  for (let d = -6; d <= 0; d++) {
    const date = new Date(todayStart.getTime() + d * 86400000);
    console.log(` Generating sessions for Day offset ${d} (${date.toISOString().split("T")[0]})...`);

    // Create 4-5 sessions per day
    const sessionTimes = [
      { startHour: 8.5, endHour: 10.2 },
      { startHour: 10.5, endHour: 12.8 },
      { startHour: 13.5, endHour: 15.5 },
      { startHour: 16.0, endHour: 18.2 },
      { startHour: 19.5, endHour: 20.8 }
    ];

    for (let sIdx = 0; sIdx < sessionTimes.length; sIdx++) {
      const st = sessionTimes[sIdx];
      const startTime = new Date(date.getTime() + st.startHour * 3600000);
      let endTime = new Date(date.getTime() + st.endHour * 3600000);
      if (d === 0 && endTime.getTime() > Date.now()) {
        endTime = new Date(Date.now() - 300000);
      }
      if (startTime.getTime() >= endTime.getTime()) continue;

      const durationSec = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      const isDeepSession = sIdx === 1 || sIdx === 3;
      const focusScore = isDeepSession ? 0.88 + Math.random() * 0.1 : 0.65 + Math.random() * 0.2;
      const productivityScore = isDeepSession ? 0.90 + Math.random() * 0.08 : 0.70 + Math.random() * 0.15;
      const burnoutScore = 0.20 + Math.random() * 0.25;
      const deepWorkScore = isDeepSession ? 0.85 + Math.random() * 0.12 : 0.30 + Math.random() * 0.20;
      const entropyScore = isDeepSession ? 0.12 + Math.random() * 0.08 : 0.35 + Math.random() * 0.15;
      const switchCount = isDeepSession ? 3 + Math.floor(Math.random() * 4) : 12 + Math.floor(Math.random() * 10);
      const idleTime = Math.floor(durationSec * 0.05);

      const session = await prisma.session.create({
        data: {
          userId: USER_ID,
          startTime,
          endTime,
          totalDuration: durationSec,
          focusScore,
          productivityScore,
          burnoutScore,
          deepWorkScore,
          entropyScore,
          switchCount,
          idleTime,
          isDeepWork: isDeepSession
        }
      });

      let actTime = new Date(startTime.getTime());
      while (actTime.getTime() < endTime.getTime()) {
        const remainingMs = endTime.getTime() - actTime.getTime();
        const actDurationSec = Math.min(
          Math.floor((300 + Math.random() * 1200)),
          Math.floor(remainingMs / 1000)
        );
        if (actDurationSec < 5) break;

        const actEnd = new Date(actTime.getTime() + actDurationSec * 1000);

        let catalogItem;
        if (isDeepSession) {
          const deepPool = activitiesCatalog.filter(a => a.category === "productive");
          catalogItem = deepPool[Math.floor(Math.random() * deepPool.length)];
        } else {
          catalogItem = activitiesCatalog[Math.floor(Math.random() * activitiesCatalog.length)];
        }

        await prisma.activity.create({
          data: {
            sessionId: session.id,
            appName: catalogItem.app,
            windowTitle: catalogItem.title,
            domain: catalogItem.domain || null,
            url: catalogItem.url || null,
            startTime: actTime,
            endTime: actEnd,
            duration: actDurationSec,
            category: catalogItem.category,
            intent: catalogItem.intent,
            focusImpact: catalogItem.focusImpact,
            energyImpact: catalogItem.energyImpact,
            confidence: catalogItem.confidence,
            projectId: catalogItem.project || null
          }
        });

        actTime = actEnd;
      }
    }
  }

  // 6. Deep Work Session records (active & past completed)
  console.log("Creating Deep Work Focus Sessions & Minute Logs...");
  const dwCompleted = await prisma.deepWorkSession.create({
    data: {
      userId: USER_ID,
      projectId: projPlatform.id,
      goal: "Implement Realtime WebSocket Metrics Broadcaster",
      plannedMinutes: 50,
      startedAt: new Date(Date.now() - 3600000),
      endedAt: new Date(Date.now() - 600000),
      status: "completed",
      enforcement: "block",
      timerMode: "pomodoro",
      focusMinutes: 25,
      shortBreakMinutes: 5,
      totalRounds: 2,
      currentRound: 2,
      currentPhase: "completed",
      ambientSound: "rain",
      ambientVolume: 0.40,
      allowedApps: ["Cursor", "Warp", "Google Chrome"],
      allowedDomains: ["github.com", "stackoverflow.com"],
      blockedApps: ["Discord", "Twitter"],
      blockedDomains: ["twitter.com", "youtube.com"],
      focusScore: 0.94,
      productivityScore: 0.96,
      violationCount: 1,
      productiveMs: 2700000,
      distractionMs: 60000,
      interruptionMs: 60000,
      idleMs: 0,
      interventions: {
        create: [
          {
            appName: "Google Chrome",
            domain: "twitter.com",
            windowTitle: "Home / X (Twitter)",
            action: "blocked",
            reason: "Blocked social media domain during deep work session",
            resolution: "App window closed automatically",
            durationMs: 2500
          }
        ]
      },
      phases: {
        create: [
          {
            type: "focus",
            round: 1,
            plannedSeconds: 1500,
            actualSeconds: 1500,
            status: "completed",
            startedAt: new Date(Date.now() - 3600000),
            endedAt: new Date(Date.now() - 2100000)
          },
          {
            type: "short_break",
            round: 1,
            plannedSeconds: 300,
            actualSeconds: 300,
            status: "completed",
            startedAt: new Date(Date.now() - 2100000),
            endedAt: new Date(Date.now() - 1800000)
          },
          {
            type: "focus",
            round: 2,
            plannedSeconds: 1500,
            actualSeconds: 1200,
            status: "completed",
            startedAt: new Date(Date.now() - 1800000),
            endedAt: new Date(Date.now() - 600000)
          }
        ]
      }
    }
  });

  for (let m = 0; m < 10; m++) {
    await prisma.deepWorkMinuteLog.create({
      data: {
        deepWorkId: dwCompleted.id,
        minuteIndex: m,
        timestamp: new Date(Date.now() - 3600000 + m * 60000),
        focusScore: 0.90 + Math.random() * 0.08,
        productivityScore: 0.92 + Math.random() * 0.06,
        distractionFlag: m === 4,
        idleFlag: false,
        appName: m === 4 ? "Google Chrome" : "Cursor",
        windowTitle: m === 4 ? "Home / X" : "samaritanV2/api/src/server.ts",
        category: m === 4 ? "distracting" : "productive",
        intent: m === 4 ? "social_media" : "coding"
      }
    });
  }

  await prisma.deepWorkSession.create({
    data: {
      userId: USER_ID,
      projectId: projUI.id,
      goal: "Aether UI System Heatmap Grid & Dark Mode Refactor",
      plannedMinutes: 45,
      startedAt: new Date(Date.now() - 900000),
      status: "active",
      enforcement: "warn",
      timerMode: "countdown",
      focusMinutes: 45,
      phaseStartedAt: new Date(Date.now() - 900000),
      phaseEndsAt: new Date(Date.now() + 1800000),
      ambientSound: "pink",
      ambientVolume: 0.35,
      allowedApps: ["Figma", "Google Chrome", "Cursor"],
      blockedApps: ["Discord"],
      blockedDomains: ["reddit.com"],
      focusScore: 0.92,
      productivityScore: 0.95,
      violationCount: 0,
      productiveMs: 900000,
      distractionMs: 0,
      idleMs: 0
    }
  });

  // 7. Smart Breaks
  console.log("Creating Smart Break Notifications...");
  await prisma.smartBreak.createMany({
    data: [
      {
        userId: USER_ID,
        status: "suggested",
        dueAt: new Date(Date.now() + 1800000),
        recommendedMinutes: 10,
        continuousWorkMs: 5400000,
        reason: "You have completed 90 minutes of high-intensity coding. Take a 10-min smart break to sustain focus stability."
      },
      {
        userId: USER_ID,
        status: "completed",
        dueAt: new Date(Date.now() - 14400000),
        startedAt: new Date(Date.now() - 14400000),
        endedAt: new Date(Date.now() - 13800000),
        recommendedMinutes: 10,
        continuousWorkMs: 6000000,
        reason: "10-minute eye rest and hydration break completed."
      }
    ]
  });

  console.log("✅ Synthetic Demo Data generation complete! All Samaritan modules populated.");
}

seedDemoData()
  .catch((e) => {
    console.error("❌ Error generating demo data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
