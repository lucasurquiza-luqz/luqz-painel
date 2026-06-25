-- Bloco 0.2 — documentos por cliente. Idempotente e aditivo.

DO $$ BEGIN
  CREATE TYPE "DocumentCategory" AS ENUM ('PROPOSTA', 'CONTRATO', 'BRIEFING', 'RELATORIO', 'CRIATIVO', 'ESTRATEGIA', 'APRESENTACAO', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'APPROVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocVisibility" AS ENUM ('INTERNAL', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ClientDocument" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "DocumentCategory" NOT NULL DEFAULT 'OUTRO',
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "DocVisibility" NOT NULL DEFAULT 'INTERNAL',
  "fileUrl" TEXT,
  "fileName" TEXT,
  "fileType" TEXT,
  "externalUrl" TEXT,
  "notes" TEXT,
  "uploadedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClientDocument_clientId_category_idx" ON "ClientDocument"("clientId", "category");

DO $$ BEGIN
  ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
