import { describe, expect, it } from 'vitest';
import {
  TickerSchema, QuoteSchema, CandleSchema, ProvenanceSchema,
  ValidationResultSchema, ConfidenceSchema, SourceSchema,
} from '../src';

describe('TickerSchema', () => {
  it('parses a US ticker', () => {
    const parsed = TickerSchema.parse({
      symbol: 'AAPL',
      market: 'US',
      exchange: 'NASDAQ',
      nameEn: 'Apple Inc.',
      currency: 'USD',
    });
    expect(parsed.symbol).toBe('AAPL');
  });

  it('parses a KR ticker', () => {
    const parsed = TickerSchema.parse({
      symbol: '005930.KS',
      market: 'KR',
      exchange: 'KOSPI',
      nameKo: '삼성전자',
      currency: 'KRW',
    });
    expect(parsed.market).toBe('KR');
  });

  it('rejects invalid market', () => {
    expect(() => TickerSchema.parse({
      symbol: 'X', market: 'CN', exchange: 'NASDAQ', currency: 'CNY',
    })).toThrow();
  });
});

describe('QuoteSchema', () => {
  it('parses an intraday quote', () => {
    const parsed = QuoteSchema.parse({
      symbol: 'AAPL',
      ts: '2026-05-19T15:00:00Z',
      price: 234.52,
      volume: 1000000,
      changePct: 1.24,
      source: 'yahoo',
    });
    expect(parsed.price).toBe(234.52);
  });
});

describe('QuoteSchema (safety extensions)', () => {
  it('rejects negative price', () => {
    expect(() => QuoteSchema.parse({
      symbol: 'AAPL', ts: '2026-05-19T15:00:00Z',
      price: -1, volume: 100, changePct: 0, source: 'yahoo',
    })).toThrow();
  });

  it('rejects empty symbol', () => {
    expect(() => QuoteSchema.parse({
      symbol: '', ts: '2026-05-19T15:00:00Z',
      price: 100, volume: 100, changePct: 0, source: 'yahoo',
    })).toThrow();
  });

  it('accepts zero price (halted market)', () => {
    expect(() => QuoteSchema.parse({
      symbol: 'AAPL', ts: '2026-05-19T15:00:00Z',
      price: 0, volume: 0, changePct: 0, source: 'yahoo',
    })).not.toThrow();
  });
});

describe('CandleSchema (safety extensions)', () => {
  it('rejects negative OHLC', () => {
    expect(() => CandleSchema.parse({
      symbol: 'AAPL', date: '2026-05-19',
      open: -1, high: 1, low: 0, close: 0, volume: 0,
    })).toThrow();
  });
});

describe('ProvenanceSchema', () => {
  it('parses a calc provenance', () => {
    const parsed = ProvenanceSchema.parse({
      source: 'calc',
      confidence: 'estimated',
      formula: 'op_income + d_and_a',
      fetchedAt: '2026-05-19T15:00:00Z',
    });
    expect(parsed.confidence).toBe('estimated');
  });

  it('rejects unknown source', () => {
    expect(() => ProvenanceSchema.parse({
      source: 'magic', confidence: 'actual',
    })).toThrow();
  });
});

describe('ValidationResultSchema', () => {
  it('parses a warning result', () => {
    const parsed = ValidationResultSchema.parse({
      severity: 'warning',
      code: 'MARKET_CAP_MISMATCH',
      message: 'market_cap differs from price × shares by 7%',
      details: { calc: 100, observed: 107 },
    });
    expect(parsed.severity).toBe('warning');
  });

  it('rejects unknown severity', () => {
    expect(() => ValidationResultSchema.parse({
      severity: 'critical', code: 'X', message: 'y',
    })).toThrow();
  });
});

describe('ConfidenceSchema', () => {
  it('accepts actual/estimated/assumed', () => {
    expect(ConfidenceSchema.parse('actual')).toBe('actual');
    expect(ConfidenceSchema.parse('estimated')).toBe('estimated');
    expect(ConfidenceSchema.parse('assumed')).toBe('assumed');
  });
});

describe('SourceSchema', () => {
  it('accepts known sources', () => {
    for (const s of ['yahoo', 'sec', 'naver', 'dart', 'finnhub', 'calc', 'user', 'assumption']) {
      expect(SourceSchema.parse(s)).toBe(s);
    }
  });
});
