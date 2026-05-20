import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';
import { getStats as getSseStats } from '../sse/hub.js';

export async function registerOpsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/__stats__', async () => {
    const prisma = getPrisma();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      tickerCount, quoteIntradayCount, quoteDailyCount,
      financialCount, newsCount, insiderCount, indexCount,
      watchlistCount, portfolioLotCount, screenerRuleCount,
      marketEventCount,
      warningsCount, errorsCount,
      ingestionLog,
    ] = await Promise.all([
      prisma.ticker.count(),
      prisma.quoteIntraday.count(),
      prisma.quoteDaily.count(),
      prisma.financial.count(),
      prisma.news.count(),
      prisma.insiderTrade.count(),
      prisma.marketIndex.count(),
      prisma.watchlist.count(),
      prisma.portfolioLot.count(),
      prisma.screenerRule.count(),
      prisma.marketEvent.count(),
      prisma.validationResult.count({ where: { severity: 'warning', ts: { gte: since } } }),
      prisma.validationResult.count({ where: { severity: 'error', ts: { gte: since } } }),
      prisma.ingestionLog.findMany({ orderBy: { lastFetchedAt: 'desc' }, take: 10 }),
    ]);

    return {
      ts: new Date().toISOString(),
      counts: {
        tickers: tickerCount,
        quotesIntraday: quoteIntradayCount,
        quotesDaily: quoteDailyCount,
        financials: financialCount,
        news: newsCount,
        insiderTrades: insiderCount,
        indices: indexCount,
        watchlist: watchlistCount,
        portfolioLots: portfolioLotCount,
        screenerRules: screenerRuleCount,
        marketEvents: marketEventCount,
      },
      validationsLast24h: {
        warnings: warningsCount,
        errors: errorsCount,
      },
      sse: getSseStats(),
      recentIngestion: ingestionLog.map((l) => ({
        symbol: l.symbol,
        kind: l.kind,
        lastFetchedAt: l.lastFetchedAt.toISOString(),
      })),
    };
  });

  app.get('/api/__validations__', async (req) => {
    const url = new URL(req.url, 'http://localhost');
    const sinceParam = url.searchParams.get('since');
    const severity = url.searchParams.get('severity');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

    const where: { ts?: { gte: Date }; severity?: string } = {};
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    where.ts = { gte: since };
    if (severity && ['error', 'warning', 'info'].includes(severity)) where.severity = severity;

    const rows = await getPrisma().validationResult.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: limit,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        kind: r.kind,
        ts: r.ts.toISOString(),
        severity: r.severity,
        code: r.code,
        message: r.message,
        details: r.details ?? null,
      })),
    };
  });
}
