ALTER TABLE "tickers" ADD COLUMN "dartCorpCode" TEXT;
ALTER TABLE "tickers" ADD COLUMN "ceoName" TEXT;
ALTER TABLE "tickers" ADD COLUMN "foundedDate" TIMESTAMP(3);
CREATE UNIQUE INDEX "tickers_dartCorpCode_key" ON "tickers"("dartCorpCode");

CREATE TABLE "institutional_holdings" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "shares" BIGINT NOT NULL,
    "pctOfFloat" DECIMAL(8,4),
    "prevShares" BIGINT,
    "prevPctOfFloat" DECIMAL(8,4),
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "institutional_holdings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "institutional_holdings_symbol_externalId_key" ON "institutional_holdings"("symbol", "externalId");
CREATE INDEX "institutional_holdings_symbol_reportDate_idx" ON "institutional_holdings"("symbol", "reportDate" DESC);
ALTER TABLE "institutional_holdings" ADD CONSTRAINT "institutional_holdings_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
