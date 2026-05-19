CREATE TABLE "portfolio_lots" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "qty" DECIMAL(20,6) NOT NULL,
    "price" DECIMAL(20,6) NOT NULL,
    "tradedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_lots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "portfolio_lots_symbol_tradedAt_idx" ON "portfolio_lots"("symbol", "tradedAt" DESC);
ALTER TABLE "portfolio_lots" ADD CONSTRAINT "portfolio_lots_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
