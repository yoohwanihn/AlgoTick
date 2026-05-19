-- CreateEnum
CREATE TYPE "Market" AS ENUM ('US', 'KR');

-- CreateEnum
CREATE TYPE "Exchange" AS ENUM ('NASDAQ', 'NYSE', 'KOSPI', 'KOSDAQ');

-- CreateTable
CREATE TABLE "tickers" (
    "symbol" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "exchange" "Exchange" NOT NULL,
    "nameEn" TEXT,
    "nameKo" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "currency" TEXT NOT NULL,
    "listedAt" TIMESTAMP(3),
    "delistedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickers_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "quotes_intraday" (
    "symbol" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(20,6) NOT NULL,
    "volume" BIGINT NOT NULL,
    "changePct" DECIMAL(10,4) NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "quotes_intraday_pkey" PRIMARY KEY ("symbol","ts")
);

-- CreateTable
CREATE TABLE "quotes_daily" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(20,6) NOT NULL,
    "high" DECIMAL(20,6) NOT NULL,
    "low" DECIMAL(20,6) NOT NULL,
    "close" DECIMAL(20,6) NOT NULL,
    "adjClose" DECIMAL(20,6),
    "volume" BIGINT NOT NULL,

    CONSTRAINT "quotes_daily_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateTable
CREATE TABLE "ingestion_log" (
    "symbol" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_log_pkey" PRIMARY KEY ("symbol","kind")
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickers_market_idx" ON "tickers"("market");

-- CreateIndex
CREATE INDEX "tickers_exchange_idx" ON "tickers"("exchange");

-- CreateIndex
CREATE INDEX "quotes_intraday_ts_idx" ON "quotes_intraday"("ts");

-- CreateIndex
CREATE INDEX "quotes_daily_symbol_date_idx" ON "quotes_daily"("symbol", "date" DESC);

-- CreateIndex
CREATE INDEX "validation_results_symbol_ts_idx" ON "validation_results"("symbol", "ts" DESC);

-- CreateIndex
CREATE INDEX "validation_results_severity_ts_idx" ON "validation_results"("severity", "ts" DESC);

-- AddForeignKey
ALTER TABLE "quotes_intraday" ADD CONSTRAINT "quotes_intraday_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes_daily" ADD CONSTRAINT "quotes_daily_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "tickers"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;
