import { z } from 'zod';

export const SeveritySchema = z.enum(['error', 'warning', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ValidationResultSchema = z.object({
  severity: SeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
