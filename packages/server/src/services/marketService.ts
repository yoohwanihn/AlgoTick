import { request } from 'undici';
import { getPrisma } from '../db.js';
import { loadConfig } from '../config.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AlgoTick/0.1';

interface YahooChartMeta {
  regularMarketPrice?: number;
  regularMarketTime?: number;
  chartPreviousClose?: number;
}
interface YahooChartResponse {
  chart: { result: Array<{ meta: YahooChartMeta }> | null };
}

async function fetchIndexQuote(code: string): Promise<{ value: number; changePct: number; ts: Date } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}?range=5d&interval=1d&includePrePost=false`;
    const res = await request(url, { headers: { 'User-Agent': UA } });
    if (res.statusCode >= 400) return null;
    const body = await res.body.json() as YahooChartResponse;
    const meta = body.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;
    const prev = meta.chartPreviousClose ?? meta.regularMarketPrice;
    const changePct = prev > 0 ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;
    return {
      value: meta.regularMarketPrice,
      changePct,
      ts: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000) : new Date(),
    };
  } catch {
    return null;
  }
}

/** Refresh all index quotes. */
export async function refreshIndices(): Promise<{ updated: number }> {
  const prisma = getPrisma();
  const indices = await prisma.marketIndex.findMany({ orderBy: { position: 'asc' } });
  let updated = 0;
  for (const idx of indices) {
    const q = await fetchIndexQuote(idx.code);
    if (!q) continue;
    await prisma.indexQuoteIntraday.upsert({
      where: { code_ts: { code: idx.code, ts: q.ts } },
      update: { value: q.value, changePct: q.changePct, source: 'yahoo' },
      create: { code: idx.code, ts: q.ts, value: q.value, changePct: q.changePct, source: 'yahoo' },
    });
    updated++;
  }
  return { updated };
}

export interface IndexSnapshot {
  code: string;
  name: string;
  market: string;
  kind: string;
  value: number | null;
  changePct: number | null;
  ts: string | null;
}

export async function listIndices(market?: string): Promise<IndexSnapshot[]> {
  const prisma = getPrisma();
  const where = market ? { market } : {};
  const indices = await prisma.marketIndex.findMany({ where, orderBy: { position: 'asc' } });
  const codes = indices.map((i) => i.code);
  const latest = await prisma.indexQuoteIntraday.findMany({
    where: { code: { in: codes } },
    orderBy: { ts: 'desc' },
  });
  const byCode = new Map<string, typeof latest[number]>();
  for (const q of latest) if (!byCode.has(q.code)) byCode.set(q.code, q);
  return indices.map((i) => {
    const q = byCode.get(i.code);
    return {
      code: i.code, name: i.name, market: i.market, kind: i.kind,
      value: q ? Number(q.value) : null,
      changePct: q ? Number(q.changePct) : null,
      ts: q ? q.ts.toISOString() : null,
    };
  });
}

export interface SectorRow {
  sector: string;
  avgChangePct: number;
  count: number;
  totalVolume: number;
}

export async function sectorHeatmap(market?: string): Promise<SectorRow[]> {
  const prisma = getPrisma();
  const tickers = await prisma.ticker.findMany({
    where: market ? { market: market as 'US' | 'KR' } : {},
  });
  const symbols = tickers.map((t) => t.symbol);
  const quotes = await prisma.quoteIntraday.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { ts: 'desc' },
  });
  const latestBySymbol = new Map<string, typeof quotes[number]>();
  for (const q of quotes) if (!latestBySymbol.has(q.symbol)) latestBySymbol.set(q.symbol, q);

  const bySector = new Map<string, { totalChange: number; count: number; volume: number }>();
  for (const t of tickers) {
    const sector = t.sector ?? 'Unknown';
    const q = latestBySymbol.get(t.symbol);
    if (!q) continue;
    const acc = bySector.get(sector) ?? { totalChange: 0, count: 0, volume: 0 };
    acc.totalChange += Number(q.changePct);
    acc.count++;
    acc.volume += Number(q.volume);
    bySector.set(sector, acc);
  }
  return Array.from(bySector.entries())
    .map(([sector, v]) => ({ sector, avgChangePct: v.count > 0 ? v.totalChange / v.count : 0, count: v.count, totalVolume: v.volume }))
    .sort((a, b) => b.avgChangePct - a.avgChangePct);
}

export interface MoverRow {
  symbol: string;
  name: string;
  market: string;
  exchange: string;
  currency: string;
  price: number;
  changePct: number;
  volume: number;
}

export async function topMovers(direction: 'up' | 'down' | 'volume', market?: string, limit = 10): Promise<MoverRow[]> {
  const prisma = getPrisma();
  const tickers = await prisma.ticker.findMany({
    where: market ? { market: market as 'US' | 'KR' } : {},
  });
  const symbols = tickers.map((t) => t.symbol);
  if (symbols.length === 0) return [];
  const quotes = await prisma.quoteIntraday.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { ts: 'desc' },
  });
  const latest = new Map<string, typeof quotes[number]>();
  for (const q of quotes) if (!latest.has(q.symbol)) latest.set(q.symbol, q);

  const rows: MoverRow[] = tickers
    .filter((t) => latest.has(t.symbol))
    .map((t) => {
      const q = latest.get(t.symbol)!;
      return {
        symbol: t.symbol,
        name: t.nameEn ?? t.nameKo ?? t.symbol,
        market: t.market,
        exchange: t.exchange,
        currency: t.currency,
        price: Number(q.price),
        changePct: Number(q.changePct),
        volume: Number(q.volume),
      };
    });

  rows.sort((a, b) => {
    if (direction === 'up') return b.changePct - a.changePct;
    if (direction === 'down') return a.changePct - b.changePct;
    return b.volume - a.volume;
  });
  return rows.slice(0, limit);
}

/** Fetch market news (Finnhub general) + economic calendar — best-effort. */
export async function refreshMarketContent(): Promise<{ newsAdded: number; eventsAdded: number }> {
  const cfg = loadConfig();
  if (!cfg.finnhubApiKey) return { newsAdded: 0, eventsAdded: 0 };
  const prisma = getPrisma();
  let newsAdded = 0; let eventsAdded = 0;

  // News
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${cfg.finnhubApiKey}`;
    const res = await request(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
    if (res.statusCode < 400) {
      const body = await res.body.json() as Array<{ id?: number; datetime?: number; headline?: string; source?: string; url?: string; summary?: string }>;
      for (const n of body.slice(0, 30)) {
        if (!n.headline || !n.url) continue;
        const externalId = `finnhub-market-${n.id ?? n.url}`;
        try {
          await prisma.news.create({
            data: {
              symbol: null, scope: 'market', market: 'GLOBAL',
              externalId,
              title: n.headline,
              source: n.source,
              url: n.url,
              summary: n.summary,
              publishedAt: n.datetime ? new Date(n.datetime * 1000) : new Date(),
            },
          });
          newsAdded++;
        } catch (_e) {
          // unique constraint violation — already exists
        }
      }
    }
  } catch (_e) { /* ignore */ }

  // Earnings calendar — next 7 days
  try {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${cfg.finnhubApiKey}`;
    const res = await request(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
    if (res.statusCode < 400) {
      const body = await res.body.json() as { earningsCalendar?: Array<{ date?: string; symbol?: string; hour?: string; epsEstimate?: number; revenueEstimate?: number }> };
      for (const e of (body.earningsCalendar ?? []).slice(0, 200)) {
        if (!e.date || !e.symbol) continue;
        const title = `${e.symbol} Earnings (${e.hour ?? ''})`.trim();
        try {
          await prisma.marketEvent.create({
            data: {
              eventDate: new Date(e.date),
              market: 'US',
              kind: 'earnings',
              symbol: e.symbol,
              title,
              meta: { epsEstimate: e.epsEstimate, revenueEstimate: e.revenueEstimate, hour: e.hour } as object,
            },
          });
          eventsAdded++;
        } catch (_e) { /* duplicate */ }
      }
    }
  } catch (_e) { /* ignore */ }

  // Economic calendar — next 7 days
  try {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${cfg.finnhubApiKey}`;
    const res = await request(url, { headers: { 'User-Agent': UA, accept: 'application/json' } });
    if (res.statusCode < 400) {
      const body = await res.body.json() as { economicCalendar?: Array<{ time?: string; country?: string; event?: string; impact?: string }> };
      for (const e of (body.economicCalendar ?? []).slice(0, 200)) {
        if (!e.time || !e.event) continue;
        try {
          await prisma.marketEvent.create({
            data: {
              eventDate: new Date(e.time),
              market: e.country === 'KR' ? 'KR' : (e.country === 'US' ? 'US' : 'GLOBAL'),
              kind: 'economic',
              symbol: null,
              title: `${e.country ?? ''} ${e.event}`.trim(),
              meta: { impact: e.impact, country: e.country } as object,
            },
          });
          eventsAdded++;
        } catch (_e) { /* duplicate */ }
      }
    }
  } catch (_e) { /* ignore */ }

  return { newsAdded, eventsAdded };
}

export interface MarketEventRow {
  id: string;
  eventDate: string;
  market: string;
  kind: string;
  symbol: string | null;
  title: string;
  meta: Record<string, unknown> | null;
}

export async function listMarketEvents(daysAhead = 7, market?: string): Promise<MarketEventRow[]> {
  const prisma = getPrisma();
  const now = new Date();
  const to = new Date(now.getTime() + daysAhead * 86400_000);
  const events = await prisma.marketEvent.findMany({
    where: {
      eventDate: { gte: now, lte: to },
      ...(market ? { market } : {}),
    },
    orderBy: { eventDate: 'asc' },
    take: 100,
  });
  return events.map((e) => ({
    id: e.id,
    eventDate: e.eventDate.toISOString(),
    market: e.market,
    kind: e.kind,
    symbol: e.symbol,
    title: e.title,
    meta: (e.meta as Record<string, unknown> | null) ?? null,
  }));
}

export interface MarketNewsRow {
  id: string;
  title: string;
  source: string | null;
  url: string;
  summary: string | null;
  publishedAt: string;
}

export async function listMarketNews(limit = 30): Promise<MarketNewsRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.news.findMany({
    where: { scope: 'market' },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id, title: r.title, source: r.source, url: r.url, summary: r.summary,
    publishedAt: r.publishedAt.toISOString(),
  }));
}
