-- Multi-objetivo por conta de Ads (vários funis). Idempotente; backfill do objective legado.

ALTER TABLE "ClientAdAccount" ADD COLUMN IF NOT EXISTS "objectives" "AdObjective"[] NOT NULL DEFAULT ARRAY[]::"AdObjective"[];

UPDATE "ClientAdAccount"
SET "objectives" = ARRAY["objective"]::"AdObjective"[]
WHERE array_length("objectives", 1) IS NULL;
