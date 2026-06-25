-- Generaliza WaConversation: por remoteJid, suporta grupo OU individual,
-- cliente opcional. Backfill das conversas de grupo existentes a partir de Group.
ALTER TABLE "WaConversation" ADD COLUMN IF NOT EXISTS "remoteJid" TEXT;
ALTER TABLE "WaConversation" ADD COLUMN IF NOT EXISTS "isGroup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WaConversation" ADD COLUMN IF NOT EXISTS "name" TEXT;

-- Backfill a partir do grupo vinculado.
UPDATE "WaConversation" wc
SET "remoteJid" = g."remoteJid",
    "name" = COALESCE(wc."name", g."name"),
    "isGroup" = true
FROM "Group" g
WHERE wc."groupId" = g."id" AND (wc."remoteJid" IS NULL OR wc."name" IS NULL);

-- Fallbacks defensivos (orfaos sem grupo).
UPDATE "WaConversation" SET "remoteJid" = 'orphan:' || "id" WHERE "remoteJid" IS NULL;
UPDATE "WaConversation" SET "name" = COALESCE("name", 'Conversa') WHERE "name" IS NULL;

-- clientId e groupId passam a ser opcionais.
ALTER TABLE "WaConversation" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "WaConversation" ALTER COLUMN "groupId" DROP NOT NULL;

-- Restricoes finais.
ALTER TABLE "WaConversation" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "WaConversation" ALTER COLUMN "remoteJid" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "WaConversation_remoteJid_key" ON "WaConversation"("remoteJid");
CREATE INDEX IF NOT EXISTS "WaConversation_clientId_idx" ON "WaConversation"("clientId");
