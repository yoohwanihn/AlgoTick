import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPrisma, disconnectPrisma } from '../db.js';

/**
 * JP 전체 상장사 마스터 등록.
 *
 * 데이터 소스: JPX `data_j.xls` (https://www.jpx.co.jp/markets/statistics-equities/misc/01.html)
 * → BIFF 바이너리 형식이라 사전 변환 필요. data/jp-all.json은 python으로 1회 변환된 결과.
 * 영문 회사명 매핑은 JPX 원본에 없어서 nameEn 슬롯에 일본어 회사명을 그대로 저장.
 *
 * exchange: TSE Prime → TSE / Standard → TSE_STANDARD / Growth → TSE_GROWTH.
 * ETF/REIT/PRO Market 등은 사전 필터로 제외 (기업 검색이 목적).
 */
interface JpRow {
  symbol: string;
  market: 'JP';
  exchange: 'TSE' | 'TSE_STANDARD' | 'TSE_GROWTH';
  nameEn: string;
  sector?: string | null;
  currency: 'JPY';
}

async function main() {
  const prisma = getPrisma();
  console.log('=== JP 전체 마스터 등록 ===');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dataPath = join(__dirname, 'data', 'jp-all.json');
  const rows = JSON.parse(await readFile(dataPath, 'utf-8')) as JpRow[];
  console.log(`로드: ${rows.length}건`);

  let upserted = 0;
  let newEntries = 0;
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.exchange] = (counts[r.exchange] || 0) + 1;
    const existing = await prisma.ticker.findUnique({ where: { symbol: r.symbol } });
    if (!existing) newEntries++;
    await prisma.ticker.upsert({
      where: { symbol: r.symbol },
      update: {}, // 기존 25개 시드(영문명 포함)는 보존
      create: {
        symbol: r.symbol,
        market: r.market,
        exchange: r.exchange,
        nameEn: r.nameEn,
        sector: r.sector ?? undefined,
        currency: r.currency,
      },
    });
    upserted++;
  }
  console.log(`upsert ${upserted} (신규 ${newEntries})`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  await disconnectPrisma();
}

void main().catch((e) => { console.error(e); process.exit(1); });
