-- Recorrência personalizada: vários dias da semana
ALTER TABLE "TaskRecurrence" ADD COLUMN IF NOT EXISTS "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
