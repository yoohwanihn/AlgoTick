import { z } from 'zod';

export const MarketSchema = z.enum(['US', 'KR', 'JP']);
export type Market = z.infer<typeof MarketSchema>;

export const ExchangeSchema = z.enum(['NASDAQ', 'NYSE', 'KOSPI', 'KOSDAQ', 'TSE']);
export type Exchange = z.infer<typeof ExchangeSchema>;

export const TickerSchema = z.object({
  symbol: z.string().min(1),
  market: MarketSchema,
  exchange: ExchangeSchema,
  nameEn: z.string().optional(),
  nameKo: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  currency: z.enum(['USD', 'KRW', 'JPY']),
  listedAt: z.string().datetime().optional(),
  delistedAt: z.string().datetime().optional(),
});
export type Ticker = z.infer<typeof TickerSchema>;
