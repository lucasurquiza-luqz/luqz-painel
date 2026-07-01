-- Atrela plano de mídia a funil de campanha + rateio de verba
ALTER TABLE "MediaPlan" ADD COLUMN IF NOT EXISTS "funnelId" TEXT;
ALTER TABLE "MediaPlan" ADD COLUMN IF NOT EXISTS "distribution" JSONB;

-- Relaxa a unicidade antiga (mês/plataforma) para permitir plano geral + N por funil
ALTER TABLE "MediaPlan" DROP CONSTRAINT IF EXISTS "MediaPlan_clientId_month_platform_key";

-- 1 plano geral por mês/plataforma (funnelId NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "MediaPlan_general_unique" ON "MediaPlan"("clientId", "month", "platform") WHERE "funnelId" IS NULL;
-- 1 plano por funil/mês/plataforma
CREATE UNIQUE INDEX IF NOT EXISTS "MediaPlan_funnel_unique" ON "MediaPlan"("clientId", "month", "platform", "funnelId") WHERE "funnelId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "MediaPlan_funnelId_idx" ON "MediaPlan"("funnelId");

DO $$ BEGIN
  ALTER TABLE "MediaPlan" ADD CONSTRAINT "MediaPlan_funnelId_fkey"
    FOREIGN KEY ("funnelId") REFERENCES "ClientFunnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
