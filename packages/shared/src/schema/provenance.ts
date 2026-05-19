import { z } from 'zod';

export const ConfidenceSchema = z.enum(['actual', 'estimated', 'assumed']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const SourceSchema = z.enum([
  'yahoo', 'sec', 'naver', 'dart', 'finnhub',
  'calc', 'user', 'assumption',
]);
export type Source = z.infer<typeof SourceSchema>;

export const ProvenanceSchema = z.object({
  source: SourceSchema,
  confidence: ConfidenceSchema,
  fetchedAt: z.string().datetime().optional(),
  asOf: z.string().optional(),
  formula: z.string().optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;
