-- Gestão de Projetos — Fase A: config do projeto + documentos atrelados. Idempotente.

DO $$ BEGIN CREATE TYPE "ProjectKind" AS ENUM ('CONTEUDO','TRAFEGO','ONBOARDING','WEB','COMERCIAL','INTERNO','OUTRO'); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "kind" "ProjectKind" NOT NULL DEFAULT 'OUTRO';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

ALTER TABLE "ClientDocument" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "ClientDocument_projectId_idx" ON "ClientDocument"("projectId");
DO $$ BEGIN
  ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
