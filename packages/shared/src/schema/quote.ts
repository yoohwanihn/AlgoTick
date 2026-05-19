import { z } from 'zod';

export const QuoteSchema = z.object({
  symbol: z.string(),
  ts: z.string().datetime(),
  price: z.number(),
  volume: z.number().int().nonnegative(),
  changePct: z.number(),
  source: z.enum(['yahoo', 'naver', 'sec', 'dart', 'finnhub']),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const CandleSchema = z.object({
  symbol: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  adjClose: z.number().optional(),
  volume: z.number().int().nonnegative(),
});
export type Candle = z.infer<typeof CandleSchema>;
