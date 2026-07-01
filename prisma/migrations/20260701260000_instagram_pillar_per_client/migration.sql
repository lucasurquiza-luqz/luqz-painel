-- Instagram: pilares de conteúdo POR CLIENTE (antes eram fixos no código).

CREATE TABLE "InstagramPillar" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramPillar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstagramPillar_accountId_order_idx" ON "InstagramPillar"("accountId", "order");

ALTER TABLE "InstagramPillar" ADD CONSTRAINT "InstagramPillar_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
