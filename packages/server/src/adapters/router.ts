import type { MarketAdapter } from './base.js';
import { UsYahooAdapter } from './us-yahoo.js';
import { KrNaverAdapter } from './kr-naver.js';
import { JpYahooAdapter } from './jp-yahoo.js';

const usYahoo = new UsYahooAdapter();
const krNaver = new KrNaverAdapter();
const jpYahoo = new JpYahooAdapter();

export function getAdapter(market: 'US' | 'KR' | 'JP'): MarketAdapter {
  if (market === 'KR') return krNaver;
  if (market === 'JP') return jpYahoo;
  return usYahoo;
}
