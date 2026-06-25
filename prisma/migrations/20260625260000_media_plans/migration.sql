-- Bloco 2 (etapa 1) — metas / plano de mídia por cliente e período. Idempotente.

DO $$ BEGIN
  CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE', 'TOTAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "MediaPlan" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "platform" "AdPlatform" NOT NULL DEFAULT 'TOTAL',
  "budget" DECIMAL(12,2),
  "targetLeads" INTEGER,
  "targetCpa" DECIMAL(12,2),
  "targetRoas" DECIMAL(6,2),
  "targetTicket" DECIMAL(12,2),
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MediaPlan_clientId_month_platform_key" ON "MediaPlan"("clientId", "month", "platform");
CREATE INDEX IF NOT EXISTS "MediaPlan_clientId_month_idx" ON "MediaPlan"("clientId", "month");

DO $$ BEGIN
  ALTER TABLE "MediaPlan" ADD CONSTRAINT "MediaPlan_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MediaPlan" ADD CONSTRAINT "MediaPlan_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
