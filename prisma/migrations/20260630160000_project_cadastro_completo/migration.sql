-- Cadastro de projeto completo: objetivos, links/acessos, pessoas. Idempotente.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "objectives" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "links" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
