CREATE TABLE "CalendarWorkHour" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startMinute" INTEGER NOT NULL DEFAULT 540,
    "endMinute" INTEGER NOT NULL DEFAULT 1080,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarWorkHour_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CalendarWorkHour_day_check" CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
    CONSTRAINT "CalendarWorkHour_start_check" CHECK ("startMinute" >= 0 AND "startMinute" < 1440),
    CONSTRAINT "CalendarWorkHour_end_check" CHECK ("endMinute" > 0 AND "endMinute" <= 1440),
    CONSTRAINT "CalendarWorkHour_range_check" CHECK (NOT "enabled" OR "endMinute" > "startMinute")
);

CREATE UNIQUE INDEX "CalendarWorkHour_userId_dayOfWeek_key" ON "CalendarWorkHour"("userId", "dayOfWeek");
CREATE INDEX "CalendarWorkHour_userId_idx" ON "CalendarWorkHour"("userId");
