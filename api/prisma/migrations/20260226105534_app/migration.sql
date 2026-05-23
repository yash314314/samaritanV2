-- CreateTable
CREATE TABLE "AppPattern" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "titleRegex" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppPattern_appName_idx" ON "AppPattern"("appName");
