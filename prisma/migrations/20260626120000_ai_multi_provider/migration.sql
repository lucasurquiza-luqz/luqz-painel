-- IA multi-provider + modelo por função. Idempotente e aditivo.

-- Anthropic no enum de provider (ADD VALUE não pode rodar dentro de DO/função).
ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'ANTHROPIC';

DO $$ BEGIN
  CREATE TYPE "AiFunction" AS ENUM ('ASSISTANT', 'GROUP_SUMMARY', 'MEETING_SUMMARY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AiModelConfig" (
  "id" TEXT NOT NULL,
  "function" "AiFunction" NOT NULL,
  "provider" "AiProvider" NOT NULL,
  "model" TEXT NOT NULL,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiModelConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiModelConfig_function_key" ON "AiModelConfig"("function");

DO $$ BEGIN
  ALTER TABLE "AiModelConfig" ADD CONSTRAINT "AiModelConfig_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
