-- CreateEnum
CREATE TYPE "GroupSummaryStatus" AS ENUM ('DRAFT', 'REVIEWED');

-- CreateEnum
CREATE TYPE "GroupSummaryItemKind" AS ENUM ('DECISION', 'COMMITMENT', 'RISK', 'PRAISE', 'PENDING');

-- CreateEnum
CREATE TYPE "GroupSummaryItemStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'DISCARDED');

-- CreateTable
CREATE TABLE "GroupDailySummary" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "GroupSummaryStatus" NOT NULL DEFAULT 'DRAFT',
    "messageCount" INTEGER NOT NULL,
    "rawSummary" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupDailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupDailySummaryItem" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "kind" "GroupSummaryItemKind" NOT NULL,
    "text" TEXT NOT NULL,
    "responsible" TEXT,
    "sourceMessageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "GroupSummaryItemStatus" NOT NULL DEFAULT 'PROPOSED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "contextItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupDailySummaryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupDailySummary_clientId_date_key" ON "GroupDailySummary"("clientId", "date");

-- CreateIndex
CREATE INDEX "GroupDailySummary_clientId_date_idx" ON "GroupDailySummary"("clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GroupDailySummaryItem_contextItemId_key" ON "GroupDailySummaryItem"("contextItemId");

-- CreateIndex
CREATE INDEX "GroupDailySummaryItem_summaryId_status_idx" ON "GroupDailySummaryItem"("summaryId", "status");

-- AddForeignKey
ALTER TABLE "GroupDailySummary" ADD CONSTRAINT "GroupDailySummary_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDailySummary" ADD CONSTRAINT "GroupDailySummary_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDailySummary" ADD CONSTRAINT "GroupDailySummary_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDailySummaryItem" ADD CONSTRAINT "GroupDailySummaryItem_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "GroupDailySummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDailySummaryItem" ADD CONSTRAINT "GroupDailySummaryItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDailySummaryItem" ADD CONSTRAINT "GroupDailySummaryItem_contextItemId_fkey" FOREIGN KEY ("contextItemId") REFERENCES "ContextItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
