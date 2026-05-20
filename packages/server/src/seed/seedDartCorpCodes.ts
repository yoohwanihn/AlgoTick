import { getPrisma, disconnectPrisma } from '../db.js';
import { fetchCorpCodes } from '../adapters/kr-dart.js';

async function main() {
  const prisma = getPrisma();
  console.log('Fetching DART corpCode.xml (~5MB ZIP)...');
  const codes = await fetchCorpCodes();
  console.log(`Parsed ${codes.length} corp codes. Linking to listed tickers...`);

  // Get all KR tickers with stock_code (last 6 chars before .KS/.KQ)
  const krTickers = await prisma.ticker.findMany({ where: { market: 'KR' } });
  let linked = 0;
  for (const t of krTickers) {
    const stockCode = t.symbol.replace(/\.(KS|KQ)$/i, '');
    const match = codes.find((c) => c.stockCode === stockCode);
    if (!match) continue;
    await prisma.ticker.update({
      where: { symbol: t.symbol },
      data: { dartCorpCode: match.corpCode },
    });
    linked++;
  }
  console.log(`Linked ${linked}/${krTickers.length} KR tickers with DART corp_code.`);
  await disconnectPrisma();
}

void main().catch((e) => { console.error(e); process.exit(1); });
