-- Templates de projeto
CREATE TABLE IF NOT EXISTS "ProjectTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "ProjectKind" NOT NULL DEFAULT 'OUTRO',
  "description" TEXT,
  "objectives" TEXT,
  "notes" TEXT,
  "links" JSONB,
  "tasks" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);
