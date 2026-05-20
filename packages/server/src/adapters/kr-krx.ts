import { request } from 'undici';
import iconv from 'iconv-lite';

const BASE = 'https://kind.krx.co.kr/corpgeneral/corpList.do';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AlgoTick/0.1';

export type KrxExchange = 'KOSPI' | 'KOSDAQ' | 'KONEX';

const MARKET_TYPE: Record<KrxExchange, string> = {
  KOSPI: 'stockMkt',
  KOSDAQ: 'kosdaqMkt',
  KONEX: 'konexMkt',
};

/**
 * KRX 상장법인 목록(EXCEL) HTML을 fetch하여 6자리 종목코드만 추출.
 * 응답은 euc-kr HTML 테이블. 종목코드는 `text-align:center;">XXXXXX<` 패턴.
 * 본 함수는 거래소 구분이 목적이므로 코드 set만 반환.
 */
export async function fetchKrxListedCodes(exchange: KrxExchange): Promise<Set<string>> {
  const url = `${BASE}?method=download&searchType=13&marketType=${MARKET_TYPE[exchange]}`;
  const res = await request(url, { headers: { 'User-Agent': UA } });
  if (res.statusCode >= 400) throw new Error(`KRX ${exchange} HTTP ${res.statusCode}`);
  const buf = Buffer.from(await res.body.arrayBuffer());
  const html = iconv.decode(buf, 'euc-kr');
  const matches = html.matchAll(/text-align:center[^>]*>([0-9A-Z]{6})</g);
  const out = new Set<string>();
  for (const m of matches) out.add(m[1]!);
  return out;
}
