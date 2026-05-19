-- CreateTable
CREATE TABLE "financials" (
    "symbol" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financials_pkey" PRIMARY KEY ("symbol","period")
);

-- CreateIndex
CREATE INDEX "financials_symbol_asOf_idx" ON "financials"("symbol", "asOf" DESC);

-- AddForeignKey
ALTER TABLE "financials" ADD CONSTRAINT "financials_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
