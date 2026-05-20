import { request } from 'undici';
import AdmZip from 'adm-zip';
import type { InsiderTradeItem, CompanyProfile } from './base.js';
import { AdapterError } from './base.js';
import { loadConfig } from '../config.js';

const BASE = 'https://opendart.fss.or.kr/api';
const UA = 'AlgoTick/0.1';

interface DartResponse<T> { status: string; message: string; list?: T[]; [k: string]: unknown; }

async function dartGet<T>(path: string, params: Record<string, string>): Promise<DartResponse<T>> {
  const cfg = loadConfig();
  if (!cfg.dartApiKey) throw new AdapterError('dart', 'DART_API_KEY not configured');
  const qs = new URLSearchParams({ crtfc_key: cfg.dartApiKey, ...params }).toString();
  const url = `${BASE}/${path}?${qs}`;
  const res = await request(url, { headers: { 'User-Agent': UA } });
  if (res.statusCode >= 400) throw new AdapterError('dart', `HTTP ${res.statusCode}`);
  return (await res.body.json()) as DartResponse<T>;
}

interface DartCompanyInfo {
  corp_name?: string;
  corp_name_eng?: string;
  stock_name?: string;
  stock_code?: string;
  ceo_nm?: string;
  est_dt?: string;       // "YYYYMMDD"
  induty_code?: string;
  phn_no?: string;
  hm_url?: string;
  adres?: string;
}

interface DartMajorstockItem {
  rcept_no?: string;
  rcept_dt?: string;     // "YYYY-MM-DD"
  repror?: string;
  stkqy?: string;        // numeric string with commas
  stkrt?: string;        // %
  bsis_pstn_stkqy?: string;
  bsis_pstn_stkrt?: string;
}

interface DartElestockItem {
  rcept_no?: string;
  rcept_dt?: string;
  repror?: string;
  isu_dcrs_qy?: string;        // increase/decrease quantity (string, may be negative or null)
  isu_dcrs_unit_amt?: string;  // unit price
  isu_dcrs_trsr_qy?: string;   // current total holding
  sp_stock_lmp_cnt?: string;
}

export interface CorpCodeRow {
  corpCode: string;
  corpName: string;
  corpEngName?: string;
  stockCode?: string;
}

/** Download corpCode.xml, parse all rows. ~5MB ZIP. */
export async function fetchCorpCodes(): Promise<CorpCodeRow[]> {
  const cfg = loadConfig();
  if (!cfg.dartApiKey) throw new AdapterError('dart', 'DART_API_KEY not configured');
  const url = `${BASE}/corpCode.xml?crtfc_key=${cfg.dartApiKey}`;
  const res = await request(url, { headers: { 'User-Agent': UA } });
  if (res.statusCode >= 400) throw new AdapterError('dart', `HTTP ${res.statusCode} for corpCode`);
  const buf = Buffer.from(await res.body.arrayBuffer());
  const zip = new AdmZip(buf);
  const entry = zip.getEntry('CORPCODE.xml');
  if (!entry) throw new AdapterError('dart', 'CORPCODE.xml not in zip');
  const xml = entry.getData().toString('utf-8');
  return parseCorpCodes(xml);
}

function parseCorpCodes(xml: string): CorpCodeRow[] {
  // Simple regex-based parsing (avoids xml2js dependency)
  const out: CorpCodeRow[] = [];
  const listRegex = /<list>([\s\S]*?)<\/list>/g;
  let m: RegExpExecArray | null;
  while ((m = listRegex.exec(xml)) !== null) {
    const body = m[1]!;
    const get = (tag: string): string | undefined => {
      const r = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`).exec(body);
      return r ? r[1]!.trim() : undefined;
    };
    const corpCode = get('corp_code');
    const corpName = get('corp_name');
    const corpEngName = get('corp_eng_name');
    const stockCode = get('stock_code');
    if (!corpCode || !corpName) continue;
    out.push({
      corpCode,
      corpName,
      corpEngName: corpEngName && corpEngName.length > 0 ? corpEngName : undefined,
      stockCode: stockCode && stockCode.trim().length === 6 ? stockCode.trim() : undefined,
    });
  }
  return out;
}

function parseDartNumber(s: string | undefined | null): number {
  if (!s) return 0;
  const cleaned = String(s).replace(/[,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDartPercent(s: string | undefined | null): number | undefined {
  if (!s) return undefined;
  const n = Number(String(s).replace(/[%,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function parseDartDate(s: string | undefined): Date {
  if (!s) return new Date();
  // Accepts "YYYY-MM-DD" or "YYYYMMDD"
  const clean = s.replace(/-/g, '');
  if (clean.length !== 8) return new Date();
  return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00Z`);
}

/** Get company profile by corp_code */
export async function dartGetProfile(corpCode: string): Promise<CompanyProfile | null> {
  const body = await dartGet<never>('company.json', { corp_code: corpCode });
  if (body.status !== '000') return null;
  const r = body as unknown as DartCompanyInfo & { status: string };
  return {
    name: r.corp_name_eng && r.corp_name_eng.length > 0 ? r.corp_name_eng : r.corp_name,
    description: r.corp_name,
    weburl: r.hm_url && r.hm_url.length > 0
      ? (r.hm_url.startsWith('http') ? r.hm_url : `https://${r.hm_url}`)
      : undefined,
    phone: r.phn_no,
    ipo: r.est_dt ? parseDartDate(r.est_dt) : undefined,
    country: 'KR',
    industry: r.induty_code,
  };
}

/** Get DART CEO name + founded date for ticker enrichment */
export async function dartGetCompanyMeta(corpCode: string): Promise<{ ceoName?: string; foundedDate?: Date } | null> {
  const body = await dartGet<never>('company.json', { corp_code: corpCode });
  if (body.status !== '000') return null;
  const r = body as unknown as DartCompanyInfo & { status: string };
  return {
    ceoName: r.ceo_nm,
    foundedDate: r.est_dt ? parseDartDate(r.est_dt) : undefined,
  };
}

/** Get insider trades from 임원·주요주주 (elestock). Returns SIDE based on isu_dcrs_qy sign. */
export async function dartGetInsiderTrades(symbol: string, corpCode: string, limit = 50): Promise<InsiderTradeItem[]> {
  const body = await dartGet<DartElestockItem>('elestock.json', { corp_code: corpCode });
  if (body.status !== '000') return [];
  const items = body.list ?? [];
  const out: InsiderTradeItem[] = [];
  for (const it of items.slice(0, limit)) {
    if (!it.rcept_no || !it.repror || !it.rcept_dt) continue;
    const qtyRaw = it.isu_dcrs_qy;
    if (!qtyRaw || qtyRaw === '-' || qtyRaw.trim() === '') continue;
    // sign-aware parse
    const qtyNum = parseDartNumber(qtyRaw);
    if (qtyNum === 0) continue;
    out.push({
      externalId: `dart-elestock-${it.rcept_no}`,
      tradeDate: parseDartDate(it.rcept_dt),
      filingDate: parseDartDate(it.rcept_dt),
      personName: it.repror,
      side: qtyNum > 0 ? 'BUY' : 'SELL',
      shares: Math.abs(qtyNum),
      price: it.isu_dcrs_unit_amt ? parseDartNumber(it.isu_dcrs_unit_amt) : undefined,
      transactionCode: undefined,
      isDerivative: false,
      source: 'dart',
    });
  }
  return out;
}

export interface InstitutionalHoldingItem {
  externalId: string;
  holderName: string;
  reportDate: Date;
  shares: number;
  pctOfFloat?: number;
  prevShares?: number;
  prevPctOfFloat?: number;
  source: string;
}

/** Get 5% major stock holdings from majorstock */
export async function dartGetInstitutionalHoldings(symbol: string, corpCode: string, limit = 100): Promise<InstitutionalHoldingItem[]> {
  const body = await dartGet<DartMajorstockItem>('majorstock.json', { corp_code: corpCode });
  if (body.status !== '000') return [];
  const items = body.list ?? [];
  const out: InstitutionalHoldingItem[] = [];
  for (const it of items.slice(0, limit)) {
    if (!it.rcept_no || !it.repror || !it.rcept_dt) continue;
    out.push({
      externalId: `dart-major-${it.rcept_no}`,
      holderName: it.repror,
      reportDate: parseDartDate(it.rcept_dt),
      shares: parseDartNumber(it.stkqy),
      pctOfFloat: parseDartPercent(it.stkrt),
      prevShares: it.bsis_pstn_stkqy ? parseDartNumber(it.bsis_pstn_stkqy) : undefined,
      prevPctOfFloat: it.bsis_pstn_stkrt ? parseDartPercent(it.bsis_pstn_stkrt) : undefined,
      source: 'dart',
    });
  }
  return out;
}
