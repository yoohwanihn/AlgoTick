CREATE TABLE "watchlist" (
    "symbol" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "watchlist_pkey" PRIMARY KEY ("symbol")
);
CREATE INDEX "watchlist_position_idx" ON "watchlist"("position");
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
