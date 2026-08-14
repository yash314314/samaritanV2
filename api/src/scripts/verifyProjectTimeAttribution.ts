import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { aggregateProjectTime, calculateProjectTime } from "../services/projectTimeService";
import { listGoalsWithProgress } from "../services/goalProgressService";

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 7, 10, hour, minute));
const totals = calculateProjectTime([
  { projectId: "alpha", start: at(9), end: at(11), source: "activity" },
  { projectId: "alpha", start: at(9, 30), end: at(10, 30), source: "activity" },
  { projectId: "beta", start: at(10), end: at(12), source: "calendar" },
  { projectId: "gamma", start: at(11), end: at(12), source: "calendar" },
]);

assert.equal(totals.get("alpha")?.minutes, 60);
assert.equal(totals.get("alpha")?.activityMinutes, 60);
assert.equal(totals.get("beta")?.minutes, 90);
assert.equal(totals.get("beta")?.calendarMinutes, 90);
assert.equal(totals.get("gamma")?.minutes, 30);
assert.equal([...totals.values()].reduce((sum, value) => sum + value.minutes, 0), 180);

console.log("Project time attribution verification passed");

async function verifyStoredAggregation() {
  const suffix = Date.now();
  const userId = `project-time-check-${suffix}`;
  const sessionId = `project-time-session-${suffix}`;
  const activityProjectId = `project-time-activity-${suffix}`;
  const meetingProjectId = `project-time-meeting-${suffix}`;
  await prisma.user.create({ data: { id: userId, name: "Project time verification" } });
  await prisma.project.createMany({ data: [
    { id: activityProjectId, userId, name: "Activity project" },
    { id: meetingProjectId, userId, name: "Meeting project" },
  ] });
  await prisma.session.create({ data: { id: sessionId, userId, startTime: new Date("2026-08-10T03:30:00.000Z") } });

  try {
    await prisma.calendarTrackingSettings.create({ data: { userId, timezone: "Asia/Kolkata" } });
    await prisma.activity.createMany({ data: [
      {
        sessionId,
        appName: "Editor",
        windowTitle: "Project time test",
        startTime: new Date("2026-08-10T03:30:00.000Z"),
        endTime: new Date("2026-08-10T05:30:00.000Z"),
        duration: 2 * 60 * 60_000,
        category: "productive",
        projectId: activityProjectId,
      },
      {
        sessionId,
        appName: "Editor",
        windowTitle: "Overlapping duplicate",
        startTime: new Date("2026-08-10T04:00:00.000Z"),
        endTime: new Date("2026-08-10T05:00:00.000Z"),
        duration: 60 * 60_000,
        category: "productive",
        projectId: activityProjectId,
      },
    ] });
    await prisma.calendarSession.create({ data: {
      userId,
      type: "meeting",
      source: "calendar",
      status: "confirmed",
      title: "Attributed meeting",
      actualStart: new Date("2026-08-10T04:30:00.000Z"),
      actualEnd: new Date("2026-08-10T06:30:00.000Z"),
      actualDurationMs: 2 * 60 * 60_000,
      projectId: meetingProjectId,
    } });
    await prisma.goal.create({ data: {
      userId,
      title: "Meeting project hours",
      type: "hours",
      target: 5,
      period: "custom",
      startDate: new Date("2026-08-10T00:00:00.000Z"),
      endDate: new Date("2026-08-10T23:59:59.999Z"),
      projectId: meetingProjectId,
    } });

    const result = await aggregateProjectTime(userId, "2026-08-10");
    const stored = await prisma.projectTime.findMany({ where: { userId, date: "2026-08-10" } });
    const [goal] = await listGoalsWithProgress(userId);
    assert.equal(stored.find((item) => item.projectId === activityProjectId)?.minutes, 60);
    assert.equal(stored.find((item) => item.projectId === meetingProjectId)?.minutes, 120);
    assert.equal(result.totalMinutes, 180);
    assert.equal(goal.progress, 2);
    console.log("Project time stored aggregation verification passed");
  } finally {
    await prisma.calendarSession.deleteMany({ where: { userId } });
    await prisma.projectTime.deleteMany({ where: { userId } });
    await prisma.activity.deleteMany({ where: { sessionId } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.calendarTrackingSettings.deleteMany({ where: { userId } });
    await prisma.goal.deleteMany({ where: { userId } });
    await prisma.project.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

verifyStoredAggregation().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
