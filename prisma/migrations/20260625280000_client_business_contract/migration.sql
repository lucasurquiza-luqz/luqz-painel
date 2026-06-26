-- Reorganização do cadastro: Negócio do cliente + Contrato (MRR/ticket). Idempotente.

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "ticket" DECIMAL(12,2);
