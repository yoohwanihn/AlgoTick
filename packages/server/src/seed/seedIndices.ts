import { getPrisma, disconnectPrisma } from '../db.js';

const INDICES = [
  { code: '^GSPC', name: 'S&P 500',   market: 'US', kind: 'index',      position: 1 },
  { code: '^IXIC', name: 'NASDAQ',    market: 'US', kind: 'index',      position: 2 },
  { code: '^DJI',  name: 'Dow Jones', market: 'US', kind: 'index',      position: 3 },
  { code: '^VIX',  name: 'VIX',       market: 'US', kind: 'volatility', position: 4 },
  { code: '^KS11', name: 'KOSPI',     market: 'KR', kind: 'index',      position: 5 },
  { code: '^KQ11', name: 'KOSDAQ',    market: 'KR', kind: 'index',      position: 6 },
  { code: 'KRW=X', name: 'USD/KRW',   market: 'GLOBAL', kind: 'fx',    position: 7 },
];

async function main() {
  const prisma = getPrisma();
  for (const i of INDICES) {
    await prisma.marketIndex.upsert({
      where: { code: i.code },
      update: i,
      create: i,
    });
  }
  console.log(`Seeded ${INDICES.length} indices.`);
  await disconnectPrisma();
}

void main().catch((e) => { console.error(e); process.exit(1); });
