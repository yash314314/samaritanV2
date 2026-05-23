-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "windowTitle" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_timestamp_idx" ON "Activity"("timestamp");
