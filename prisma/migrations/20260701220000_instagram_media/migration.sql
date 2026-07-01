-- Instagram: cache de métricas por post publicado (aba Análise + Top posts).

CREATE TABLE "InstagramMedia" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mediaType" TEXT,
    "permalink" TEXT,
    "thumb" TEXT,
    "caption" TEXT,
    "timestamp" TIMESTAMP(3),
    "likes" INTEGER,
    "comments" INTEGER,
    "reach" INTEGER,
    "views" INTEGER,
    "saved" INTEGER,
    "shares" INTEGER,
    "interactions" INTEGER,
    "pillar" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstagramMedia_accountId_timestamp_idx" ON "InstagramMedia"("accountId", "timestamp");

ALTER TABLE "InstagramMedia" ADD CONSTRAINT "InstagramMedia_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
