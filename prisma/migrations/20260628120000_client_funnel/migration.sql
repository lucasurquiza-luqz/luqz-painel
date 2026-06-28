-- Funil: agrupamento de campanhas por regra de nome. Idempotente.

CREATE TABLE IF NOT EXISTS "ClientFunnel" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientFunnel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClientFunnel_clientId_idx" ON "ClientFunnel"("clientId");

DO $$ BEGIN
  ALTER TABLE "ClientFunnel" ADD CONSTRAINT "ClientFunnel_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
