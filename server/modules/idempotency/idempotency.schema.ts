// server/modules/idempotency/idempotency.schema.ts
import { z } from "zod";

export const IdempotencyHeaderSchema = z.string()
  .min(1, "Idempotency-Key cannot be empty")
  .max(128, "Idempotency-Key is too long")
  .trim();

export const RequestHashSchema = z.object({
  body: z.any(),
  endpoint: z.string(),
  method: z.string(),
  userId: z.string().nullable().optional()
});
