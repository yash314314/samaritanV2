import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { activateCalendarFocusSession, finalizeCalendarFocusSession, reconcileCalendarFocusSessions, stopCalendarFocusForEvent } from "../services/calendarFocusService";
import { materializeCalendarEventSession } from "../services/calendarTrackingService";

async function createFocusEvent(userId: string, title: string, startAt: Date, endAt: Date) {
  return prisma.calendarEvent.create({
    data: {
      userId,
      title,
      startAt,
      endAt,
      eventType: "focus",
      focusAutoStart: true,
      focusEnforcement: "block",
      focusAllowedApps: ["Cursor", "Terminal"],
      focusAllowedDomains: ["github.com"],
      focusBlockedApps: ["Discord", "Steam"],
      focusBlockedDomains: ["youtube.com", "reddit.com"],
    },
  });
}

async function main() {
  const userId = `calendar-focus-check-${Date.now()}`;
  const now = new Date();
  const firstEvent = await createFocusEvent(userId, "Protected coding", new Date(now.getTime() - 60_000), new Date(now.getTime() + 30 * 60_000));
  const secondEvent = await createFocusEvent(userId, "Protected writing", new Date(now.getTime() - 30_000), new Date(now.getTime() + 45 * 60_000));
  const deepWorkIds: string[] = [];

  try {
    const firstCalendarSession = await materializeCalendarEventSession(firstEvent.id, now);
    assert.ok(firstCalendarSession);
    const firstDeepWork = await activateCalendarFocusSession(firstCalendarSession.id, now);
    assert.ok(firstDeepWork && "enforcement" in firstDeepWork);
    deepWorkIds.push(firstDeepWork.id);
    assert.equal(firstDeepWork.enforcement, "block");
    assert.deepEqual(firstDeepWork.allowedApps, ["Cursor", "Terminal"]);
    assert.deepEqual(firstDeepWork.blockedDomains, ["youtube.com", "reddit.com"]);

    const linkedEvent = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: firstEvent.id } });
    const activeCalendarSession = await prisma.calendarSession.findUniqueOrThrow({ where: { id: firstCalendarSession.id } });
    assert.equal(linkedEvent.deepWorkId, firstDeepWork.id);
    assert.equal(activeCalendarSession.status, "active");
    assert.ok(activeCalendarSession.actualStart);

    const duplicate = await activateCalendarFocusSession(firstCalendarSession.id, new Date(now.getTime() + 1_000));
    assert.equal(duplicate?.id, firstDeepWork.id);
    assert.equal(await prisma.deepWorkSession.count({ where: { userId, status: "active" } }), 1);

    const secondCalendarSession = await materializeCalendarEventSession(secondEvent.id, now);
    assert.ok(secondCalendarSession);
    const blockedByOwnership = await activateCalendarFocusSession(secondCalendarSession.id, now);
    assert.equal(blockedByOwnership, null);
    const skipped = await prisma.calendarSession.findUniqueOrThrow({ where: { id: secondCalendarSession.id } });
    assert.match(skipped.reviewReason ?? "", /Auto-start skipped/);
    assert.equal((await prisma.calendarEvent.findUniqueOrThrow({ where: { id: secondEvent.id } })).deepWorkId, null);

    await finalizeCalendarFocusSession(firstCalendarSession.id);
    assert.equal((await prisma.deepWorkSession.findUniqueOrThrow({ where: { id: firstDeepWork.id } })).status, "completed");
    assert.equal((await prisma.calendarSession.findUniqueOrThrow({ where: { id: firstCalendarSession.id } })).status, "confirmed");

    const secondDeepWork = await activateCalendarFocusSession(secondCalendarSession.id, new Date());
    assert.ok(secondDeepWork && "id" in secondDeepWork);
    deepWorkIds.push(secondDeepWork.id);
    await reconcileCalendarFocusSessions(new Date(secondEvent.endAt.getTime() + 1_000));
    assert.equal((await prisma.deepWorkSession.findUniqueOrThrow({ where: { id: secondDeepWork.id } })).status, "completed");
    assert.equal((await prisma.calendarSession.findUniqueOrThrow({ where: { id: secondCalendarSession.id } })).status, "confirmed");

    const cancelledEvent = await createFocusEvent(userId, "Cancelled focus", new Date(now.getTime() - 30_000), new Date(now.getTime() + 20 * 60_000));
    const cancelledCalendarSession = await materializeCalendarEventSession(cancelledEvent.id, new Date());
    assert.ok(cancelledCalendarSession);
    const cancelledDeepWork = await activateCalendarFocusSession(cancelledCalendarSession.id, new Date());
    assert.ok(cancelledDeepWork && "id" in cancelledDeepWork);
    deepWorkIds.push(cancelledDeepWork.id);
    assert.equal(await stopCalendarFocusForEvent(cancelledEvent.id), 1);
    assert.equal((await prisma.deepWorkSession.findUniqueOrThrow({ where: { id: cancelledDeepWork.id } })).status, "completed");

    console.log("Calendar focus lifecycle verification passed", {
      enforcement: firstDeepWork.enforcement,
      duplicateStarts: 0,
      ownershipConflictSkipped: true,
      scheduledCompletion: true,
      cancellationCleanup: true,
    });
  } finally {
    await prisma.calendarSession.deleteMany({ where: { userId } });
    await prisma.calendarEvent.deleteMany({ where: { userId } });
    await prisma.deepWorkSession.deleteMany({ where: { id: { in: deepWorkIds } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
