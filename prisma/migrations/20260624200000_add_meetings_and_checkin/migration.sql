-- Idempotente: esta migration ficou em estado falho (P3009) em producao e e
-- reaplicada via `migrate resolve --rolled-back` no entrypoint. Os guards abaixo
-- garantem que a reaplicacao funcione em qualquer estado intermediario.

-- CreateEnum
DO $$ BEGIN CREATE TYPE "MeetingKind" AS ENUM ('CALL', 'IN_PERSON', 'ASYNC'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MeetingSummaryStatus" AS ENUM ('DRAFT', 'REVIEWED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MeetingItemKind" AS ENUM ('DECISION', 'COMMITMENT', 'OBJECTION', 'RISK', 'NEXT_STEP'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MeetingItemStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'DISCARDED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TeamPerception" AS ENUM ('GREAT', 'GOOD', 'NEUTRAL', 'CONCERN', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Meeting" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "MeetingKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "participants" TEXT[],
    "rawContent" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingSummary" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "MeetingSummaryStatus" NOT NULL DEFAULT 'DRAFT',
    "rawSummary" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingSummaryItem" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "kind" "MeetingItemKind" NOT NULL,
    "text" TEXT NOT NULL,
    "responsible" TEXT,
    "deadline" TEXT,
    "status" "MeetingItemStatus" NOT NULL DEFAULT 'PROPOSED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "contextItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingSummaryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamCheckin" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "perception" "TeamPerception" NOT NULL,
    "justification" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Meeting_clientId_date_idx" ON "Meeting"("clientId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingSummary_meetingId_key" ON "MeetingSummary"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetingSummary_clientId_idx" ON "MeetingSummary"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingSummaryItem_contextItemId_key" ON "MeetingSummaryItem"("contextItemId");
CREATE INDEX IF NOT EXISTS "MeetingSummaryItem_summaryId_status_idx" ON "MeetingSummaryItem"("summaryId", "status");
CREATE INDEX IF NOT EXISTS "TeamCheckin_clientId_createdAt_idx" ON "TeamCheckin"("clientId", "createdAt");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MeetingSummary" ADD CONSTRAINT "MeetingSummary_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MeetingSummary" ADD CONSTRAINT "MeetingSummary_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MeetingSummary" ADD CONSTRAINT "MeetingSummary_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MeetingSummaryItem" ADD CONSTRAINT "MeetingSummaryItem_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "MeetingSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MeetingSummaryItem" ADD CONSTRAINT "MeetingSummaryItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MeetingSummaryItem" ADD CONSTRAINT "MeetingSummaryItem_contextItemId_fkey" FOREIGN KEY ("contextItemId") REFERENCES "ContextItem"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "TeamCheckin" ADD CONSTRAINT "TeamCheckin_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "TeamCheckin" ADD CONSTRAINT "TeamCheckin_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
