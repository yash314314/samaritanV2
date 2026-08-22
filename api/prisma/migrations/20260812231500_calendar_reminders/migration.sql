CREATE TABLE "CalendarReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "deliveredAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarReminder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CalendarReminder_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CalendarReminder_calendarEventId_key" ON "CalendarReminder"("calendarEventId");
CREATE INDEX "CalendarReminder_userId_status_idx" ON "CalendarReminder"("userId", "status");
CREATE INDEX "CalendarReminder_status_remindAt_idx" ON "CalendarReminder"("status", "remindAt");
CREATE INDEX "CalendarReminder_status_snoozedUntil_idx" ON "CalendarReminder"("status", "snoozedUntil");
