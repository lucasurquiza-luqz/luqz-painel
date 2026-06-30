-- Tarefas recorrentes: molde + instâncias. Idempotente.
DO $$ BEGIN CREATE TYPE "RecurFreq" AS ENUM ('DIARIA','SEMANAL','MENSAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "recurrenceId" TEXT;

CREATE TABLE IF NOT EXISTS "TaskRecurrence" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "clientId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assigneeId" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIA',
  "freq" "RecurFreq" NOT NULL DEFAULT 'SEMANAL',
  "interval" INTEGER NOT NULL DEFAULT 1,
  "weekday" INTEGER,
  "dayOfMonth" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskRecurrence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TaskRecurrence_active_nextRunAt_idx" ON "TaskRecurrence"("active","nextRunAt");
CREATE INDEX IF NOT EXISTS "TaskRecurrence_projectId_idx" ON "TaskRecurrence"("projectId");

DO $$ BEGIN
  ALTER TABLE "TaskRecurrence" ADD CONSTRAINT "TaskRecurrence_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
