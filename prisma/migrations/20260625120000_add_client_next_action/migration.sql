-- Proxima acao por cliente (quem age, o que, ate quando).
DO $$ BEGIN CREATE TYPE "NextActionStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ClientNextAction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleId" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "NextActionStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ClientNextAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientNextAction_clientId_status_idx" ON "ClientNextAction"("clientId", "status");

DO $$ BEGIN ALTER TABLE "ClientNextAction" ADD CONSTRAINT "ClientNextAction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ClientNextAction" ADD CONSTRAINT "ClientNextAction_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ClientNextAction" ADD CONSTRAINT "ClientNextAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
