import assert from "node:assert/strict";

import { prisma } from "../prisma";
import { getGoalHistory, goalPeriodRange, hydrateGoalProgress } from "../services/goalProgressService";
import { assignActivitiesToProject, getProjectDashboard, getUnassignedProjectActivities } from "../services/projectTrackingService";

async function main() {
  const now = new Date("2026-08-14T12:00:00.000Z");
  const user = await prisma.user.create({ data: { name: "Project and goal verifier" } });
  const projectA = await prisma.project.create({ data: { userId: user.id, name: "Alpha", color: "#a855f7", weeklyHourGoal: 5 } });
  const projectB = await prisma.project.create({ data: { userId: user.id, name: "Beta", color: "#06b6d4", weeklyHourGoal: 5 } });
  const session = await prisma.session.create({ data: { userId: user.id, startTime: new Date("2026-08-14T09:00:00.000Z") } });

  try {
    const assigned = await prisma.activity.create({
      data: {
        sessionId: session.id,
        projectId: projectA.id,
        appName: "Code",
        windowTitle: "Alpha implementation",
        startTime: new Date("2026-08-14T09:00:00.000Z"),
        endTime: new Date("2026-08-14T09:30:00.000Z"),
        duration: 30 * 60_000,
        type: "active",
        category: "development_tools",
        focusImpact: 0.9,
      },
    });
    const unassigned = await prisma.activity.create({
      data: {
        sessionId: session.id,
        appName: "Figma",
        windowTitle: "Alpha design",
        domain: "figma.com",
        startTime: new Date("2026-08-14T10:00:00.000Z"),
        endTime: new Date("2026-08-14T10:20:00.000Z"),
        duration: 20 * 60_000,
        type: "active",
        category: "productivity",
        focusImpact: 0.8,
      },
    });
    await prisma.deepWorkSession.createMany({
      data: [
        { userId: user.id, projectId: projectA.id, goal: "Alpha focus", plannedMinutes: 45, startedAt: new Date("2026-08-14T10:30:00.000Z"), endedAt: new Date("2026-08-14T11:10:00.000Z"), status: "completed", enforcement: "warn", allowedApps: [], allowedDomains: [], blockedApps: [], blockedDomains: [] },
        { userId: user.id, projectId: projectB.id, goal: "Beta focus", plannedMinutes: 30, startedAt: new Date("2026-08-14T11:15:00.000Z"), endedAt: new Date("2026-08-14T11:35:00.000Z"), status: "completed", enforcement: "warn", allowedApps: [], allowedDomains: [], blockedApps: [], blockedDomains: [] },
      ],
    });

    const goal = await prisma.goal.create({
      data: { userId: user.id, projectId: projectA.id, title: "Alpha daily focus", type: "focus_minutes", target: 30, period: "daily" },
    });
    const range = goalPeriodRange(goal, "Asia/Kolkata", now);
    assert.equal(range.start.toISOString(), "2026-08-13T18:30:00.000Z", "daily goals must follow the configured timezone");

    const hydrated = await hydrateGoalProgress(goal, now);
    assert.equal(Math.round(hydrated.progress), 40, "project goals must exclude focus from other projects");
    assert.equal(hydrated.status, "completed");
    assert.equal(await prisma.goalProgress.count({ where: { goalId: goal.id } }), 1);

    const beforeAssignment = await getUnassignedProjectActivities(user.id, 7, now);
    assert(beforeAssignment.some((activity) => activity.id === unassigned.id));
    await assignActivitiesToProject(user.id, [unassigned.id], projectA.id, true);
    assert.equal((await prisma.activity.findUnique({ where: { id: unassigned.id } }))?.projectId, projectA.id);
    assert.equal(await prisma.projectRule.count({ where: { projectId: projectA.id, domain: "figma.com" } }), 1);

    const dashboard = await getProjectDashboard(user.id, projectA.id, 7, now);
    assert.equal(Math.round(dashboard.summary.rangeMinutes), 50, "project totals should include assigned activity once");
    assert.equal(dashboard.topApps[0]?.name, "Code");
    assert(dashboard.goals.some((item) => item.id === goal.id));
    assert(dashboard.daily.some((day) => Math.round(day.minutes) === 50));

    const history = await getGoalHistory(user.id, goal.id, 3, now);
    assert.equal(history.history.length, 3);
    assert.equal(history.history[history.history.length - 1]?.completed, true);
    assert.equal((await prisma.activity.findUnique({ where: { id: assigned.id } }))?.projectId, projectA.id);
  } finally {
    await prisma.goalProgress.deleteMany({ where: { goal: { userId: user.id } } });
    await prisma.goal.deleteMany({ where: { userId: user.id } });
    await prisma.deepWorkSession.deleteMany({ where: { userId: user.id } });
    await prisma.projectRule.deleteMany({ where: { project: { userId: user.id } } });
    await prisma.activity.deleteMany({ where: { session: { userId: user.id } } });
    await prisma.projectTime.deleteMany({ where: { userId: user.id } });
    await prisma.project.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("Project/goal verification passed: isolation, attribution, rules, periods, snapshots, history, and dashboard totals.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
