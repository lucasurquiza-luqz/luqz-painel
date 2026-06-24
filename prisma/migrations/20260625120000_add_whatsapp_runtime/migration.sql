-- Estado de runtime da integracao WhatsApp (singleton) para diagnostico.
CREATE TABLE IF NOT EXISTS "WhatsAppRuntime" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "connectionState" TEXT,
    "lastWebhookAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppRuntime_pkey" PRIMARY KEY ("id")
);
