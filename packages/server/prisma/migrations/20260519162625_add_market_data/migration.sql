CREATE TABLE "indices" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "indices_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "index_quotes_intraday" (
    "code" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "changePct" DECIMAL(10,4) NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "index_quotes_intraday_pkey" PRIMARY KEY ("code","ts")
);
CREATE INDEX "index_quotes_intraday_ts_idx" ON "index_quotes_intraday"("ts");
ALTER TABLE "index_quotes_intraday" ADD CONSTRAINT "index_quotes_intraday_code_fkey" FOREIGN KEY ("code") REFERENCES "indices"("code") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "index_quotes_daily" (
    "code" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(20,6),
    "high" DECIMAL(20,6),
    "low" DECIMAL(20,6),
    "close" DECIMAL(20,6) NOT NULL,
    CONSTRAINT "index_quotes_daily_pkey" PRIMARY KEY ("code","date")
);
CREATE INDEX "index_quotes_daily_code_date_idx" ON "index_quotes_daily"("code", "date" DESC);
ALTER TABLE "index_quotes_daily" ADD CONSTRAINT "index_quotes_daily_code_fkey" FOREIGN KEY ("code") REFERENCES "indices"("code") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "market_events" (
    "id" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "market" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "symbol" TEXT,
    "title" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "market_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "market_events_eventDate_market_kind_symbol_title_key" ON "market_events"("eventDate", "market", "kind", "symbol", "title");
CREATE INDEX "market_events_eventDate_idx" ON "market_events"("eventDate");
