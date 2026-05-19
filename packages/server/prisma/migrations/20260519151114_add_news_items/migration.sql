-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "symbol" TEXT,
    "scope" TEXT NOT NULL,
    "market" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "news_items_symbol_publishedAt_idx" ON "news_items"("symbol", "publishedAt" DESC);
CREATE INDEX "news_items_scope_market_publishedAt_idx" ON "news_items"("scope", "market", "publishedAt" DESC);
-- CreateIndex (unique)
CREATE UNIQUE INDEX "news_items_symbol_externalId_key" ON "news_items"("symbol", "externalId");
-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
