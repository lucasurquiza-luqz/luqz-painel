-- Bloco 0.1 — cadastro de cliente completo. Tudo idempotente e aditivo.

-- Perfil do negócio + plano/contrato no Client.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "segment" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "instagram" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "product" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contractValue" DECIMAL(12,2);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "billingCycle" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contractStart" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "renewalDate" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "projectPhase" TEXT;

-- Papéis da equipe LUQZ.
DO $$ BEGIN
  CREATE TYPE "LuqzTeamRole" AS ENUM ('GESTOR_PROJETO', 'TRAFEGO', 'CONTEUDO', 'COMERCIAL', 'DESIGN', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Contatos do cliente.
CREATE TABLE IF NOT EXISTS "ClientContact" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClientContact_clientId_idx" ON "ClientContact"("clientId");

DO $$ BEGIN
  ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Responsáveis LUQZ.
CREATE TABLE IF NOT EXISTS "ClientTeamMember" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "role" "LuqzTeamRole" NOT NULL DEFAULT 'OUTRO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientTeamMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClientTeamMember_clientId_idx" ON "ClientTeamMember"("clientId");

DO $$ BEGIN
  ALTER TABLE "ClientTeamMember" ADD CONSTRAINT "ClientTeamMember_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClientTeamMember" ADD CONSTRAINT "ClientTeamMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
