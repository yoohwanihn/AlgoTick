-- CreateTable
CREATE TABLE "insider_trades" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "tradeDate" TIMESTAMP(3) NOT NULL,
    "filingDate" TIMESTAMP(3),
    "personName" TEXT NOT NULL,
    "role" TEXT,
    "side" TEXT NOT NULL,
    "shares" BIGINT NOT NULL,
    "price" DECIMAL(20,6),
    "transactionCode" TEXT,
    "source" TEXT NOT NULL,
    "isDerivative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "insider_trades_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "insider_trades_symbol_externalId_key" ON "insider_trades"("symbol", "externalId");
CREATE INDEX "insider_trades_symbol_tradeDate_idx" ON "insider_trades"("symbol", "tradeDate" DESC);
ALTER TABLE "insider_trades" ADD CONSTRAINT "insider_trades_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
