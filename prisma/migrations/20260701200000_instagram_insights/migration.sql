-- Instagram: cache de insights da conta (snapshot) + serie temporal diaria.

CREATE TABLE "InstagramSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstagramDailyStat" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followers" INTEGER,
    "newFollowers" INTEGER,
    "reach" INTEGER,
    "profileViews" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramDailyStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstagramSnapshot_accountId_key" ON "InstagramSnapshot"("accountId");
CREATE UNIQUE INDEX "InstagramDailyStat_accountId_date_key" ON "InstagramDailyStat"("accountId", "date");
CREATE INDEX "InstagramDailyStat_accountId_date_idx" ON "InstagramDailyStat"("accountId", "date");

ALTER TABLE "InstagramSnapshot" ADD CONSTRAINT "InstagramSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstagramDailyStat" ADD CONSTRAINT "InstagramDailyStat_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
