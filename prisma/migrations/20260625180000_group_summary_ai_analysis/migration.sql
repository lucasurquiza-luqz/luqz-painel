-- Análise interpretativa da IA no resumo diário do grupo + geração automática.
-- Tudo idempotente e aditivo: resumos antigos continuam válidos.

DO $$ BEGIN
  CREATE TYPE "GroupSummarySentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'CONCERN', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "GroupDailySummary" ADD COLUMN IF NOT EXISTS "sentiment" "GroupSummarySentiment";
ALTER TABLE "GroupDailySummary" ADD COLUMN IF NOT EXISTS "analysis" TEXT;
ALTER TABLE "GroupDailySummary" ADD COLUMN IF NOT EXISTS "attentionPoints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GroupDailySummary" ADD COLUMN IF NOT EXISTS "confidence" TEXT;
ALTER TABLE "GroupDailySummary" ADD COLUMN IF NOT EXISTS "generatedByAi" BOOLEAN NOT NULL DEFAULT false;

-- generatedById passa a aceitar NULL (resumos gerados pela IA automática não têm autor humano).
ALTER TABLE "GroupDailySummary" ALTER COLUMN "generatedById" DROP NOT NULL;

-- A FK passa de Restrict para SetNull para acompanhar o nullable.
DO $$ BEGIN
  ALTER TABLE "GroupDailySummary" DROP CONSTRAINT "GroupDailySummary_generatedById_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;

ALTER TABLE "GroupDailySummary"
  ADD CONSTRAINT "GroupDailySummary_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
