-- CreateEnum
CREATE TYPE "ClientStatusSource" AS ENUM ('MANUAL', 'ROSTER_IMPORT');

-- AlterTable
ALTER TABLE "Client"
ADD COLUMN "clickupFolderId" TEXT,
ADD COLUMN "statusReason" TEXT,
ADD COLUMN "statusChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClientStatusHistory" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "reason" TEXT,
    "source" "ClientStatusSource" NOT NULL DEFAULT 'MANUAL',
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_clickupFolderId_key" ON "Client"("clickupFolderId");

-- CreateIndex
CREATE INDEX "ClientStatusHistory_clientId_changedAt_idx" ON "ClientStatusHistory"("clientId", "changedAt");

-- AddForeignKey
ALTER TABLE "ClientStatusHistory" ADD CONSTRAINT "ClientStatusHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientStatusHistory" ADD CONSTRAINT "ClientStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
