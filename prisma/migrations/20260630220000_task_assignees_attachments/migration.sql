-- Múltiplos responsáveis na tarefa
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "assigneeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: tarefas com responsável único entram na lista de responsáveis
UPDATE "Task" SET "assigneeIds" = ARRAY["assigneeId"]
WHERE "assigneeId" IS NOT NULL AND cardinality("assigneeIds") = 0;

-- Anexos da tarefa
CREATE TABLE IF NOT EXISTS "TaskAttachment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT,
  "uploadedById" TEXT,
  "uploadedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");

DO $$ BEGIN
  ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
