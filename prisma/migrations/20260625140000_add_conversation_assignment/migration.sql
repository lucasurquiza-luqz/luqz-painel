-- Atribuicao/transferencia de conversa entre membros do time.
ALTER TABLE "WaConversation" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
CREATE INDEX IF NOT EXISTS "WaConversation_assignedToId_idx" ON "WaConversation"("assignedToId");
DO $$ BEGIN ALTER TABLE "WaConversation" ADD CONSTRAINT "WaConversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "WaConversationTransfer" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "byUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaConversationTransfer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WaConversationTransfer_conversationId_createdAt_idx" ON "WaConversationTransfer"("conversationId", "createdAt");

DO $$ BEGIN ALTER TABLE "WaConversationTransfer" ADD CONSTRAINT "WaConversationTransfer_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "WaConversationTransfer" ADD CONSTRAINT "WaConversationTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "WaConversationTransfer" ADD CONSTRAINT "WaConversationTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "WaConversationTransfer" ADD CONSTRAINT "WaConversationTransfer_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
