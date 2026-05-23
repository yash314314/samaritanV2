-- CreateTable
CREATE TABLE "AppCategory" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppCategory_appName_key" ON "AppCategory"("appName");
