-- Verificação do segredo do webhook (pra ligar o modo estrito sem risco). Idempotente.
ALTER TABLE "WhatsAppRuntime" ADD COLUMN IF NOT EXISTS "lastWebhookSecretOk" BOOLEAN;
