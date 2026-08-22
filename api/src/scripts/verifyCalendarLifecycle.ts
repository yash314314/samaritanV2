import { strict as assert } from "node:assert";
import { prisma } from "../prisma";
import {
  materializeCalendarEventSession,
  reconcileCalendarActivity,
} from "../services/calendarTrackingService";

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("Create a local user before running calendar lifecycle verification");

  const now = new Date();
  const start = new Date(now.getTime() - 90_000);
  const end = new Date(now.getTime() + 90_000);
  let eventId: string | null = null;
  let trackingSessionId: string | null = null;
  let rawSessionId: string | null = null;

  try {
    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title: "Calendar lifecycle verification",
        startAt: start,
        endAt: end,
        eventType: "meeting",
        attendeeCount: 2,
        source: "verification",
      },
    });
    eventId = event.id;

    const calendarSession = await materializeCalendarEventSession(event.id, now);
    assert.ok(calendarSession);
    assert.equal(calendarSession.status, "detecting");
    trackingSessionId = calendarSession.id;

    const rawSession = await prisma.session.create({ data: { userId: user.id, startTime: start } });
    rawSessionId = rawSession.id;
    const activity = await prisma.activity.create({
      data: {
        sessionId: rawSession.id,
        appName: "Zoom",
        windowTitle: "Calendar lifecycle verification",
        startTime: start,
        endTime: now,
        duration: now.getTime() - start.getTime(),
        type: "active",
        category: "communication",
        intent: "video_conferencing",
      },
    });

    await reconcileCalendarActivity(user.id, activity);
    const confirmed = await prisma.calendarSession.findUnique({
      where: { id: calendarSession.id },
      include: { evidence: true },
    });
    assert.equal(confirmed?.status, "confirmed");
    assert.ok((confirmed?.actualDurationMs ?? 0) >= 60_000);
    assert.equal(confirmed?.evidence.length, 1);

    const presentingEnd = new Date(now.getTime() + 30_000);
    const presentingActivity = await prisma.activity.create({
      data: {
        sessionId: rawSession.id,
        appName: "Microsoft PowerPoint",
        windowTitle: "Presenting calendar architecture",
        startTime: now,
        endTime: presentingEnd,
        duration: 30_000,
        type: "active",
        category: "productivity",
        intent: "presenting",
      },
    });
    await reconcileCalendarActivity(user.id, presentingActivity);
    const bridged = await prisma.calendarSession.findUnique({ where: { id: calendarSession.id } });
    assert.equal(bridged?.actualEnd?.getTime(), presentingEnd.getTime());
    assert.equal(bridged?.actualDurationMs, presentingEnd.getTime() - start.getTime());

    console.log("Calendar lifecycle verification passed");
  } finally {
    if (trackingSessionId) await prisma.meetingEvidence.deleteMany({ where: { calendarSessionId: trackingSessionId } });
    if (trackingSessionId) await prisma.calendarSession.deleteMany({ where: { id: trackingSessionId } });
    if (rawSessionId) await prisma.activity.deleteMany({ where: { sessionId: rawSessionId } });
    if (rawSessionId) await prisma.session.deleteMany({ where: { id: rawSessionId } });
    if (eventId) await prisma.calendarEvent.deleteMany({ where: { id: eventId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
