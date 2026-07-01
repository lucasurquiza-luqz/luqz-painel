-- Leitura de IA da performance, salva por cliente/mês
CREATE TABLE IF NOT EXISTS "PerformanceInsight" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "model" TEXT,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerformanceInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PerformanceInsight_clientId_month_createdAt_idx" ON "PerformanceInsight"("clientId", "month", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PerformanceInsight" ADD CONSTRAINT "PerformanceInsight_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
