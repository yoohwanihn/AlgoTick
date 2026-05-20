import { getPrisma, disconnectPrisma } from '../db.js';
import { fetchCorpCodes } from '../adapters/kr-dart.js';
import { fetchKrxListedCodes, type KrxExchange } from '../adapters/kr-krx.js';

/**
 * KR 전체 상장사 마스터 등록.
 * - DART corp_code.xml에서 stock_code 있는 종목 전부 추출 (회사명/영문명/corp_code 매핑)
 * - KRX corpgeneral에서 KOSPI/KOSDAQ/KONEX 거래소 분류 받기
 * - ticker 테이블에 upsert (기존 top-50 시드는 그대로 유지, 신규는 등록)
 *
 * exchange 결정 우선순위:
 *   1) KOSPI/KOSDAQ/KONEX KRX 응답에 코드가 있으면 그 거래소
 *   2) 어느 KRX 응답에도 없으면 'KOSPI' (drop-list/우선주 등 케이스 보정)
 */
async function main() {
  const prisma = getPrisma();
  console.log('=== KR 전체 마스터 등록 ===');

  console.log('1) KRX 거래소 분류 다운로드');
  const [kospi, kosdaq, konex] = await Promise.all([
    fetchKrxListedCodes('KOSPI'),
    fetchKrxListedCodes('KOSDAQ'),
    fetchKrxListedCodes('KONEX'),
  ]);
  console.log(`   KOSPI: ${kospi.size} | KOSDAQ: ${kosdaq.size} | KONEX: ${konex.size}`);

  console.log('2) DART corp_code.xml 다운로드 + 파싱');
  const corpCodes = await fetchCorpCodes();
  const listed = corpCodes.filter((c) => c.stockCode);
  console.log(`   전체 ${corpCodes.length} 중 상장사 ${listed.length}건`);

  console.log('3) ticker 테이블 upsert');
  let upserted = 0;
  let newEntries = 0;
  for (const c of listed) {
    const stockCode = c.stockCode!;
    let exchange: KrxExchange;
    let suffix: string;
    if (kosdaq.has(stockCode)) {
      exchange = 'KOSDAQ';
      suffix = '.KQ';
    } else if (konex.has(stockCode)) {
      exchange = 'KONEX';
      suffix = '.KN';
    } else {
      // KOSPI 응답에 있거나, 어디에도 없으면 KOSPI fallback
      exchange = 'KOSPI';
      suffix = '.KS';
    }
    const symbol = `${stockCode}${suffix}`;
    const existing = await prisma.ticker.findUnique({ where: { symbol } });
    if (!existing) newEntries++;
    await prisma.ticker.upsert({
      where: { symbol },
      update: {
        // 기존 ticker는 nameKo/nameEn/sector 보존 — KRX 마스터엔 corp_code 매핑만 보강
        dartCorpCode: c.corpCode,
      },
      create: {
        symbol,
        market: 'KR',
        exchange,
        nameKo: c.corpName,
        nameEn: c.corpEngName,
        currency: 'KRW',
        dartCorpCode: c.corpCode,
      },
    });
    upserted++;
  }
  console.log(`   upsert ${upserted} (신규 ${newEntries})`);
  await disconnectPrisma();
}

void main().catch((e) => { console.error(e); process.exit(1); });
