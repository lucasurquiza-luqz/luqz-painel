-- Instagram: contas business por cliente + fila de posts agendados (publicação orgânica).

CREATE TYPE "InstagramPostStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');

CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "username" TEXT,
    "tokenEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstagramScheduledPost" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "InstagramPostStatus" NOT NULL DEFAULT 'PENDING',
    "igMediaId" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ref" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "InstagramScheduledPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstagramAccount_clientId_key" ON "InstagramAccount"("clientId");
CREATE INDEX "InstagramScheduledPost_status_scheduledAt_idx" ON "InstagramScheduledPost"("status", "scheduledAt");
CREATE INDEX "InstagramScheduledPost_clientId_scheduledAt_idx" ON "InstagramScheduledPost"("clientId", "scheduledAt");

ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstagramScheduledPost" ADD CONSTRAINT "InstagramScheduledPost_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstagramScheduledPost" ADD CONSTRAINT "InstagramScheduledPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
