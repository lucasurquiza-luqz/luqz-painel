-- Plano de mídia híbrido: funil projetado + objetivo + narrativa
ALTER TABLE "MediaPlan" ADD COLUMN IF NOT EXISTS "targetCpl" DECIMAL(12,2);
ALTER TABLE "MediaPlan" ADD COLUMN IF NOT EXISTS "objective" TEXT;
ALTER TABLE "MediaPlan" ADD COLUMN IF NOT EXISTS "funnel" JSONB;
ALTER TABLE "MediaPlan" ADD COLUMN IF NOT EXISTS "narrative" TEXT;
