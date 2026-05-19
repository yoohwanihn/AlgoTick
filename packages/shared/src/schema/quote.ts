import { z } from 'zod';

export const QuoteSchema = z.object({
  symbol: z.string().min(1),
  ts: z.string().datetime(),
  price: z.number().nonnegative(),
  volume: z.number().int().nonnegative(),
  changePct: z.number(),
  source: z.enum(['yahoo', 'naver', 'sec', 'dart', 'finnhub']),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const CandleSchema = z.object({
  symbol: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  open: z.number().nonnegative(),
  high: z.number().nonnegative(),
  low: z.number().nonnegative(),
  close: z.number().nonnegative(),
  adjClose: z.number().nonnegative().optional(),
  volume: z.number().int().nonnegative(),
});
export type Candle = z.infer<typeof CandleSchema>;
