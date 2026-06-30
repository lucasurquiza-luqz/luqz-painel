-- Notificações in-app
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "taskId" TEXT,
  "actorName" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
