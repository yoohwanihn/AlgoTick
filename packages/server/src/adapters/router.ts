import type { MarketAdapter } from './base.js';
import { UsYahooAdapter } from './us-yahoo.js';
import { KrNaverAdapter } from './kr-naver.js';

const usYahoo = new UsYahooAdapter();
const krNaver = new KrNaverAdapter();

export function getAdapter(market: 'US' | 'KR'): MarketAdapter {
  if (market === 'KR') return krNaver;
  return usYahoo;
}
