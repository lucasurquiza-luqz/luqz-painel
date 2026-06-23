-- CreateEnum
CREATE TYPE "ContextDomain" AS ENUM ('DIRETRIZES', 'OFERTA', 'PERSONA', 'TOM_DE_VOZ', 'CLIENTE', 'MEMORIA', 'OPERACIONAL');

-- CreateEnum
CREATE TYPE "ContextKind" AS ENUM ('RULE', 'FACT', 'DECISION', 'GOAL', 'HYPOTHESIS', 'PERCEPTION');

-- CreateEnum
CREATE TYPE "ContextStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'SUPERSEDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContextVisibility" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "ContextSourceType" AS ENUM ('FILE', 'MANUAL', 'GROUP', 'MEETING', 'INTEGRATION');

-- CreateTable
CREATE TABLE "ContextSource" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ContextSourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "checksum" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "domain" "ContextDomain" NOT NULL,
    "kind" "ContextKind" NOT NULL,
    "status" "ContextStatus" NOT NULL DEFAULT 'PROPOSED',
    "visibility" "ContextVisibility" NOT NULL DEFAULT 'INTERNAL',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "supersedesId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "compiledById" TEXT NOT NULL,
    "compiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextSnapshotItem" (
    "snapshotId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ContextSnapshotItem_pkey" PRIMARY KEY ("snapshotId", "itemId")
);

-- CreateIndex
CREATE INDEX "ContextSource_clientId_type_idx" ON "ContextSource"("clientId", "type");

-- CreateIndex
CREATE INDEX "ContextItem_clientId_status_domain_idx" ON "ContextItem"("clientId", "status", "domain");

-- CreateIndex
CREATE INDEX "ContextItem_sourceId_idx" ON "ContextItem"("sourceId");

-- CreateIndex
CREATE INDEX "ContextItem_supersedesId_idx" ON "ContextItem"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextSnapshot_clientId_version_key" ON "ContextSnapshot"("clientId", "version");

-- CreateIndex
CREATE INDEX "ContextSnapshot_clientId_compiledAt_idx" ON "ContextSnapshot"("clientId", "compiledAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContextSnapshotItem_snapshotId_position_key" ON "ContextSnapshotItem"("snapshotId", "position");

-- CreateIndex
CREATE INDEX "ContextSnapshotItem_itemId_idx" ON "ContextSnapshotItem"("itemId");

-- AddForeignKey
ALTER TABLE "ContextSource" ADD CONSTRAINT "ContextSource_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem" ADD CONSTRAINT "ContextItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem" ADD CONSTRAINT "ContextItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContextSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem" ADD CONSTRAINT "ContextItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem" ADD CONSTRAINT "ContextItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem" ADD CONSTRAINT "ContextItem_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ContextItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextSnapshot" ADD CONSTRAINT "ContextSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextSnapshot" ADD CONSTRAINT "ContextSnapshot_compiledById_fkey" FOREIGN KEY ("compiledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextSnapshotItem" ADD CONSTRAINT "ContextSnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ContextSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextSnapshotItem" ADD CONSTRAINT "ContextSnapshotItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ContextItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
