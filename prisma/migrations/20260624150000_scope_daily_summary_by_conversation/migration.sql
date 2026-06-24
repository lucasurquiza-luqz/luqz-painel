-- Cada grupo/conversa pode ter seu próprio resumo no mesmo dia.
DROP INDEX IF EXISTS "GroupDailySummary_clientId_date_key";
CREATE UNIQUE INDEX "GroupDailySummary_conversationId_date_key"
ON "GroupDailySummary"("conversationId", "date");
