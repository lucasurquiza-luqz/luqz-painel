-- Saúde de Resultado — contas de Ads por cliente (Meta token por cliente; Google central). Idempotente.

DO $$ BEGIN
  CREATE TYPE "AdProvider" AS ENUM ('META', 'GOOGLE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ClientAdAccount" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "provider" "AdProvider" NOT NULL,
  "accountId" TEXT NOT NULL,
  "tokenEnc" TEXT,
  "lastFour" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientAdAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClientAdAccount_clientId_provider_key" ON "ClientAdAccount"("clientId", "provider");

DO $$ BEGIN
  ALTER TABLE "ClientAdAccount" ADD CONSTRAINT "ClientAdAccount_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
