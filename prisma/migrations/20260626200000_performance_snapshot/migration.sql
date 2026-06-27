-- Cache de performance por cliente/mês. Idempotente.

CREATE TABLE IF NOT EXISTS "PerformanceSnapshot" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerformanceSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PerformanceSnapshot_clientId_month_key" ON "PerformanceSnapshot"("clientId", "month");
CREATE INDEX IF NOT EXISTS "PerformanceSnapshot_clientId_idx" ON "PerformanceSnapshot"("clientId");

DO $$ BEGIN
  ALTER TABLE "PerformanceSnapshot" ADD CONSTRAINT "PerformanceSnapshot_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
