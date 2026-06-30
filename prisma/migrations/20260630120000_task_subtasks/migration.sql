-- Subtarefas: Tarefa pode ter tarefa-mãe (mesmo projeto). Idempotente.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "parentTaskId" TEXT;
CREATE INDEX IF NOT EXISTS "Task_parentTaskId_idx" ON "Task"("parentTaskId");

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey"
    FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
