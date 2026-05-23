-- CreateTable
CREATE TABLE "DeepWorkMinuteLog" (
    "id" TEXT NOT NULL,
    "deepWorkId" TEXT NOT NULL,
    "minuteIndex" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "focusScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productivityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distractionFlag" BOOLEAN NOT NULL DEFAULT false,
    "idleFlag" BOOLEAN NOT NULL DEFAULT false,
    "appName" TEXT,
    "windowTitle" TEXT,
    "category" TEXT,
    "intent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeepWorkMinuteLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeepWorkMinuteLog_deepWorkId_idx" ON "DeepWorkMinuteLog"("deepWorkId");

-- CreateIndex
CREATE INDEX "DeepWorkMinuteLog_minuteIndex_idx" ON "DeepWorkMinuteLog"("minuteIndex");

-- CreateIndex
CREATE INDEX "DeepWorkMinuteLog_timestamp_idx" ON "DeepWorkMinuteLog"("timestamp");

-- AddForeignKey
ALTER TABLE "DeepWorkMinuteLog" ADD CONSTRAINT "DeepWorkMinuteLog_deepWorkId_fkey" FOREIGN KEY ("deepWorkId") REFERENCES "DeepWorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
