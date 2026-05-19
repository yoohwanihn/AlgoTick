import type { MarketAdapter } from '../adapters/base.js';
import { getPrisma } from '../db.js';
import type { CachedResponse, ValidationResult, Market } from '@algotick/shared';
import { validateQuote, validateCandle, hasErrors, pickWarnings } from '../validators/index.js';
import { sma, rsi, macd, bollinger, detectSignals, type Signal, type CandleForSignals } from '../indicators/index.js';

export interface NewsItemResponse {
  id: string;
  title: string;
  source?: string;
  url: string;
  summary?: string;
  publishedAt: string;
}

export interface InsiderTradeResponse {
  id: string;
  tradeDate: string;
  filingDate?: string;
  personName: string;
  role?: string;
  side: 'BUY' | 'SELL';
  shares: number;
  price?: number;
  transactionCode?: string;
  isDerivative?: boolean;
  source: string;
}

export interface FinancialPeriodResponse {
  period: string;
  periodType: 'A' | 'Q';
  asOf: string;
  source: string;
  data: Record<string, number | null>;
}

export interface IndicatorSeries {
  ma5: Array<number | null>;
  ma20: Array<number | null>;
  ma60: Array<number | null>;
  ma120: Array<number | null>;
  rsi14: Array<number | null>;
  macdLine: Array<number | null>;
  macdSignal: Array<number | null>;
  macdHistogram: Array<number | null>;
  bollingerMiddle: Array<number | null>;
  bollingerUpper: Array<number | null>;
  bollingerLower: Array<number | null>;
}

export interface TickerDetail {
  symbol: string;
  market: string;
  exchange: string;
  name?: string;
  currency: string;
  quote: {
    price: number;
    volume: number;
    changePct: number;
    ts: string;
  } | null;
  candles: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  indicators: IndicatorSeries;
  signals: Signal[];
  financials: FinancialPeriodResponse[];
  news: NewsItemResponse[];
  insiderTrades: InsiderTradeResponse[];
}

const STALE_QUOTE_MS = 60 * 1000;
const STALE_FINANCIALS_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

export async function getTickerDetail(
  symbol: string,
  adapter: MarketAdapter,
): Promise<CachedResponse<TickerDetail>> {
  const prisma = getPrisma();
  const master = await prisma.ticker.findUnique({ where: { symbol } });
  if (!master) throw new Error(`Ticker not found in master: ${symbol}`);

  const log = await prisma.ingestionLog.findUnique({
    where: { symbol_kind: { symbol, kind: 'quote' } },
  });

  const now = Date.now();
  const stale = !log || now - log.lastFetchedAt.getTime() > STALE_QUOTE_MS;
  const miss = !log;
  let warnings: ValidationResult[] = [];

  if (miss) {
    warnings = await refreshTicker(symbol, adapter, master.market as Market);
  }

  const detail = await readDetailFromDb(symbol);
  const freshness: 'fresh' | 'stale' = miss ? 'fresh' : stale ? 'stale' : 'fresh';
  const lastFetchedAt = (await prisma.ingestionLog.findUnique({
    where: { symbol_kind: { symbol, kind: 'quote' } },
  }))?.lastFetchedAt.toISOString() ?? new Date().toISOString();

  if (stale && !miss) {
    void refreshTicker(symbol, adapter, master.market as Market).catch(() => undefined);
  }

  const dbWarnings = await prisma.validationResult.findMany({
    where: {
      symbol,
      ts: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      severity: { in: ['warning', 'info'] },
    },
    orderBy: { ts: 'desc' },
    take: 20,
  });
  const persistedWarnings: ValidationResult[] = dbWarnings.map((w) => ({
    severity: w.severity as ValidationResult['severity'],
    code: w.code,
    message: w.message,
    details: (w.details as Record<string, unknown> | null) ?? undefined,
  }));

  return {
    data: {
      ...detail,
      market: master.market,
      exchange: master.exchange,
      name: master.nameEn ?? master.nameKo ?? undefined,
      currency: master.currency,
    },
    freshness,
    lastFetchedAt,
    warnings: [...warnings, ...persistedWarnings],
  };
}

async function refreshTicker(
  symbol: string,
  adapter: MarketAdapter,
  market: Market,
): Promise<ValidationResult[]> {
  const prisma = getPrisma();
  const ctx = { symbol, market };
  const collectedWarnings: ValidationResult[] = [];

  const quote = await adapter.getQuote(symbol);
  const quoteResults = validateQuote(quote, ctx);
  if (hasErrors(quoteResults)) {
    await persistValidationResults(symbol, 'quote', quoteResults);
    return pickWarnings(quoteResults);
  }
  collectedWarnings.push(...pickWarnings(quoteResults));

  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const candles = await adapter.getDailyOHLCV(symbol, from, new Date());

  const validCandles: typeof candles = [];
  let prev: { symbol: string; date: string; open: number; high: number; low: number; close: number; volume: number } | undefined;
  for (const c of candles) {
    const res = validateCandle(c, prev, ctx);
    if (hasErrors(res)) {
      await persistValidationResults(symbol, 'daily', res);
      continue;
    }
    if (res.length > 0) {
      collectedWarnings.push(...pickWarnings(res));
      await persistValidationResults(symbol, 'daily', pickWarnings(res));
    }
    validCandles.push(c);
    prev = c;
  }

  await prisma.$transaction([
    prisma.quoteIntraday.upsert({
      where: { symbol_ts: { symbol, ts: quote.ts } },
      update: { price: quote.price, volume: BigInt(quote.volume), changePct: quote.changePct, source: quote.source },
      create: { symbol, ts: quote.ts, price: quote.price, volume: BigInt(quote.volume), changePct: quote.changePct, source: quote.source },
    }),
    ...validCandles.map((c) => prisma.quoteDaily.upsert({
      where: { symbol_date: { symbol, date: new Date(c.date) } },
      update: { open: c.open, high: c.high, low: c.low, close: c.close, adjClose: c.adjClose, volume: BigInt(c.volume) },
      create: { symbol, date: new Date(c.date), open: c.open, high: c.high, low: c.low, close: c.close, adjClose: c.adjClose, volume: BigInt(c.volume) },
    })),
    prisma.ingestionLog.upsert({
      where: { symbol_kind: { symbol, kind: 'quote' } },
      update: { lastFetchedAt: new Date() },
      create: { symbol, kind: 'quote', lastFetchedAt: new Date() },
    }),
  ]);

  // Financials — best-effort, non-fatal
  const finLog = await prisma.ingestionLog.findUnique({
    where: { symbol_kind: { symbol, kind: 'financials' } },
  });
  const finStale = !finLog || Date.now() - finLog.lastFetchedAt.getTime() > STALE_FINANCIALS_MS;
  if (finStale) {
    try {
      const fins = await adapter.getFinancials(symbol);
      for (const f of fins) {
        await prisma.financial.upsert({
          where: { symbol_period: { symbol, period: f.period } },
          update: { periodType: f.periodType, asOf: f.asOf, source: f.source, data: f.data as object },
          create: { symbol, period: f.period, periodType: f.periodType, asOf: f.asOf, source: f.source, data: f.data as object },
        });
      }
      await prisma.ingestionLog.upsert({
        where: { symbol_kind: { symbol, kind: 'financials' } },
        update: { lastFetchedAt: new Date() },
        create: { symbol, kind: 'financials', lastFetchedAt: new Date() },
      });
    } catch (_e) { /* non-fatal */ }
  }

  // News — best-effort, non-fatal
  try {
    const news = await adapter.getNews(symbol, 20);
    for (const n of news) {
      await prisma.news.upsert({
        where: { symbol_externalId: { symbol, externalId: n.externalId } },
        update: { title: n.title, source: n.source, url: n.url, summary: n.summary, publishedAt: n.publishedAt },
        create: {
          symbol, scope: 'ticker', externalId: n.externalId,
          title: n.title, source: n.source, url: n.url, summary: n.summary, publishedAt: n.publishedAt,
          market: market,
        },
      });
    }
    await prisma.ingestionLog.upsert({
      where: { symbol_kind: { symbol, kind: 'news' } },
      update: { lastFetchedAt: new Date() },
      create: { symbol, kind: 'news', lastFetchedAt: new Date() },
    });
  } catch (_e) { /* non-fatal */ }

  // Insider Trades — best-effort, non-fatal
  try {
    const trades = await adapter.getInsiderTrades(symbol, 50);
    for (const t of trades) {
      await prisma.insiderTrade.upsert({
        where: { symbol_externalId: { symbol, externalId: t.externalId } },
        update: {
          tradeDate: t.tradeDate, filingDate: t.filingDate, personName: t.personName,
          role: t.role, side: t.side, shares: BigInt(t.shares),
          price: t.price, transactionCode: t.transactionCode,
          isDerivative: t.isDerivative ?? false, source: t.source,
        },
        create: {
          symbol, externalId: t.externalId,
          tradeDate: t.tradeDate, filingDate: t.filingDate, personName: t.personName,
          role: t.role, side: t.side, shares: BigInt(t.shares),
          price: t.price, transactionCode: t.transactionCode,
          isDerivative: t.isDerivative ?? false, source: t.source,
        },
      });
    }
    await prisma.ingestionLog.upsert({
      where: { symbol_kind: { symbol, kind: 'insider' } },
      update: { lastFetchedAt: new Date() },
      create: { symbol, kind: 'insider', lastFetchedAt: new Date() },
    });
  } catch (_e) { /* non-fatal */ }

  return collectedWarnings;
}

async function persistValidationResults(
  symbol: string,
  kind: string,
  results: ValidationResult[],
): Promise<void> {
  if (results.length === 0) return;
  const prisma = getPrisma();
  await prisma.validationResult.createMany({
    data: results.map((r) => ({
      symbol,
      kind,
      severity: r.severity,
      code: r.code,
      message: r.message,
      details: (r.details as object) ?? undefined,
    })),
  });
}

function computeIndicators(candles: Array<{ date: string; close: number; volume: number }>): { indicators: IndicatorSeries; signals: Signal[] } {
  const closes = candles.map((c) => c.close);
  const macdR = macd(closes);
  const bollR = bollinger(closes, 20, 2);
  const indicators: IndicatorSeries = {
    ma5: sma(closes, 5),
    ma20: sma(closes, 20),
    ma60: sma(closes, 60),
    ma120: sma(closes, 120),
    rsi14: rsi(closes, 14),
    macdLine: macdR.macd,
    macdSignal: macdR.signal,
    macdHistogram: macdR.histogram,
    bollingerMiddle: bollR.middle,
    bollingerUpper: bollR.upper,
    bollingerLower: bollR.lower,
  };
  const candlesForSignals: CandleForSignals[] = candles.map((c) => ({ date: c.date, close: c.close, volume: c.volume }));
  const signals = detectSignals(candlesForSignals);
  return { indicators, signals };
}

async function readDetailFromDb(symbol: string): Promise<Omit<TickerDetail, 'market' | 'exchange' | 'name' | 'currency'>> {
  const prisma = getPrisma();
  const latest = await prisma.quoteIntraday.findFirst({ where: { symbol }, orderBy: { ts: 'desc' } });
  const rows = await prisma.quoteDaily.findMany({
    where: { symbol },
    orderBy: { date: 'desc' },
    take: 365,
  });
  const ascRows = rows.reverse();
  const ascCandles = ascRows.map((c) => ({
    date: c.date.toISOString().slice(0, 10),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume),
  }));
  const { indicators, signals } = computeIndicators(ascCandles);

  const finRows = await prisma.financial.findMany({
    where: { symbol },
    orderBy: { asOf: 'desc' },
    take: 10,
  });
  const financials: FinancialPeriodResponse[] = finRows.reverse().map((f) => ({
    period: f.period,
    periodType: f.periodType as 'A' | 'Q',
    asOf: f.asOf.toISOString(),
    source: f.source,
    data: f.data as Record<string, number | null>,
  }));

  const newsRows = await prisma.news.findMany({
    where: { symbol, scope: 'ticker' },
    orderBy: { publishedAt: 'desc' },
    take: 30,
  });
  const news: NewsItemResponse[] = newsRows.map((n) => ({
    id: n.id,
    title: n.title,
    source: n.source ?? undefined,
    url: n.url,
    summary: n.summary ?? undefined,
    publishedAt: n.publishedAt.toISOString(),
  }));

  const tradeRows = await prisma.insiderTrade.findMany({
    where: { symbol },
    orderBy: { tradeDate: 'desc' },
    take: 50,
  });
  const insiderTrades: InsiderTradeResponse[] = tradeRows.map((t) => ({
    id: t.id,
    tradeDate: t.tradeDate.toISOString(),
    filingDate: t.filingDate?.toISOString(),
    personName: t.personName,
    role: t.role ?? undefined,
    side: t.side as 'BUY' | 'SELL',
    shares: Number(t.shares),
    price: t.price ? Number(t.price) : undefined,
    transactionCode: t.transactionCode ?? undefined,
    isDerivative: t.isDerivative,
    source: t.source,
  }));

  return {
    symbol,
    quote: latest
      ? {
          price: Number(latest.price),
          volume: Number(latest.volume),
          changePct: Number(latest.changePct),
          ts: latest.ts.toISOString(),
        }
      : null,
    candles: ascCandles,
    indicators,
    signals,
    financials,
    news,
    insiderTrades,
  };
}
