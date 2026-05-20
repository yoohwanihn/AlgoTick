import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPrisma, disconnectPrisma } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SeedTicker {
  symbol: string;
  market: 'US' | 'KR' | 'JP';
  exchange: 'NASDAQ' | 'NYSE' | 'KOSPI' | 'KOSDAQ' | 'TSE';
  nameEn?: string;
  nameKo?: string;
  sector?: string;
  currency: string;
}

function loadSeedFile(name: string): SeedTicker[] {
  const fp = path.join(__dirname, 'data', name);
  return JSON.parse(readFileSync(fp, 'utf-8'));
}

async function main() {
  const prisma = getPrisma();
  const all = [...loadSeedFile('us-top.json'), ...loadSeedFile('kr-top.json'), ...loadSeedFile('jp-top.json')];

  for (const t of all) {
    await prisma.ticker.upsert({
      where: { symbol: t.symbol },
      update: {
        market: t.market,
        exchange: t.exchange,
        nameEn: t.nameEn,
        nameKo: t.nameKo,
        sector: t.sector,
        currency: t.currency,
      },
      create: {
        symbol: t.symbol,
        market: t.market,
        exchange: t.exchange,
        nameEn: t.nameEn,
        nameKo: t.nameKo,
        sector: t.sector,
        currency: t.currency,
      },
    });
  }
  console.log(`Seeded ${all.length} tickers.`);
  await disconnectPrisma();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
