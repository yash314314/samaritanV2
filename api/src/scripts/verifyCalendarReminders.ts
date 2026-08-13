import { prisma } from "../prisma";
import {
  dismissCalendarReminder,
  processDueCalendarReminders,
  snoozeCalendarReminder,
  syncCalendarEventReminder,
} from "../services/calendarReminderService";

async function main() {
  const now = new Date();
  const userId = `calendar-reminder-check-${Date.now()}`;
  const event = await prisma.calendarEvent.create({
    data: {
      userId,
      title: "Calendar reminder verification",
      startAt: new Date(now.getTime() + 5 * 60_000),
      endAt: new Date(now.getTime() + 35 * 60_000),
      reminderMinutes: 5,
    },
  });

  try {
    const reminder = await syncCalendarEventReminder(event.id);
    if (!reminder) throw new Error("Reminder was not created");

    const firstDelivery = await processDueCalendarReminders(new Date(now.getTime() + 1_000));
    const duplicateDelivery = await processDueCalendarReminders(new Date(now.getTime() + 2_000));
    if (firstDelivery !== 1 || duplicateDelivery !== 0) {
      throw new Error(`Delivery claim failed: first=${firstDelivery}, duplicate=${duplicateDelivery}`);
    }

    const snoozed = await snoozeCalendarReminder(reminder.id, userId, 10);
    if (snoozed.status !== "snoozed" || !snoozed.snoozedUntil) throw new Error("Snooze was not persisted");
    const snoozeDelivery = await processDueCalendarReminders(new Date(snoozed.snoozedUntil.getTime() + 1_000));
    if (snoozeDelivery !== 1) throw new Error(`Snoozed reminder was delivered ${snoozeDelivery} times`);

    await dismissCalendarReminder(reminder.id, userId);
    const dismissed = await prisma.calendarReminder.findUnique({ where: { id: reminder.id } });
    if (dismissed?.status !== "dismissed") throw new Error("Dismissal was not persisted");

    console.log("Calendar reminder verification passed", {
      initialDelivery: firstDelivery,
      duplicateDelivery,
      snoozeDelivery,
      finalStatus: dismissed.status,
    });
  } finally {
    await prisma.calendarEvent.deleteMany({ where: { id: event.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
