-- Bloco 0.3 — links/recursos por cliente. Idempotente e aditivo.

DO $$ BEGIN
  CREATE TYPE "ResourceCategory" AS ENUM ('DRIVE', 'ANALYTICS', 'ADS', 'SITE', 'SOCIAL', 'CREDENTIALS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ClientResource" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "category" "ResourceCategory" NOT NULL DEFAULT 'OTHER',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientResource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClientResource_clientId_category_idx" ON "ClientResource"("clientId", "category");

DO $$ BEGIN
  ALTER TABLE "ClientResource" ADD CONSTRAINT "ClientResource_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
