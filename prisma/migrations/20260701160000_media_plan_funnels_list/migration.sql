-- Plano de mídia com vários funis dentro (lista)
ALTER TABLE "MediaPlan" ADD COLUMN IF NOT EXISTS "funnels" JSONB;
