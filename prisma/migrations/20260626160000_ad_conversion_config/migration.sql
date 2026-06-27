-- Config de conversão por cliente (funil flexível) na conta de Ads. Idempotente.

DO $$ BEGIN
  CREATE TYPE "AdObjective" AS ENUM ('LEAD', 'WHATSAPP', 'ECOMMERCE', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ClientAdAccount" ADD COLUMN IF NOT EXISTS "objective" "AdObjective" NOT NULL DEFAULT 'LEAD';
ALTER TABLE "ClientAdAccount" ADD COLUMN IF NOT EXISTS "resultActions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ClientAdAccount" ADD COLUMN IF NOT EXISTS "trackRevenue" BOOLEAN NOT NULL DEFAULT false;
