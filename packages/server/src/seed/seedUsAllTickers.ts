import { request } from 'undici';
import { getPrisma, disconnectPrisma } from '../db.js';

const SEC_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
// SEC EDGAR는 user-agent에 연락처 포함 요구
// SEC는 UA에 실제 연락처(이메일) 포함 요구. 형식: "회사명 contact@example.com"
const UA = 'AlgoTick ghksdls333@gmail.com';

type SecResponse = { fields: string[]; data: Array<[number, string, string, string | null]> };

function mapExchange(raw: string | null): 'NASDAQ' | 'NYSE' | 'AMEX' | 'OTC' {
  if (!raw) return 'OTC';
  const u = raw.toUpperCase();
  if (u === 'NASDAQ') return 'NASDAQ';
  if (u === 'NYSE') return 'NYSE';
  if (u === 'AMEX' || u === 'NYSE AMERICAN') return 'AMEX';
  return 'OTC'; // OTC, CBOE, Unknown 등
}

async function main() {
  const prisma = getPrisma();
  console.log('=== US 전체 마스터 등록 (SEC) ===');
  const res = await request(SEC_URL, { headers: { 'User-Agent': UA, accept: 'application/json' } });
  if (res.statusCode >= 400) throw new Error(`SEC HTTP ${res.statusCode}`);
  const body = (await res.body.json()) as SecResponse;
  console.log(`SEC response: ${body.data.length} rows`);

  let upserted = 0;
  let newEntries = 0;
  const counts: Record<string, number> = {};
  for (const [_cik, name, ticker, rawExchange] of body.data) {
    if (!ticker || !name) continue;
    // BRK-B 같은 dot ticker를 그대로 사용 (Yahoo는 .B 사용하지만 우리는 SEC 원본 보존)
    const symbol = ticker.trim().toUpperCase();
    const exchange = mapExchange(rawExchange);
    counts[exchange] = (counts[exchange] || 0) + 1;
    const existing = await prisma.ticker.findUnique({ where: { symbol } });
    if (!existing) newEntries++;
    await prisma.ticker.upsert({
      where: { symbol },
      update: {},  // 기존 시드 보존 — nameEn/sector 등 유지
      create: {
        symbol,
        market: 'US',
        exchange,
        nameEn: name,
        currency: 'USD',
      },
    });
    upserted++;
  }
  console.log(`upsert ${upserted} (신규 ${newEntries})`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  await disconnectPrisma();
}

void main().catch((e) => { console.error(e); process.exit(1); });
