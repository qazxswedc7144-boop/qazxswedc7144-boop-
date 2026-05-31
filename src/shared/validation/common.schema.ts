// src/shared/validation/common.schema.ts
import { z } from "zod";

export const UUIDSchema = z.string().uuid();

export const MoneySchema = z
  .number()
  .finite()
  .nonnegative();

export const QuantitySchema = z
  .number()
  .int()
  .positive();

export const DateSchema = z.coerce.date();

export const OptionalStringSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable();

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0)
});

export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^[\d\+\-\s\(\)]+$/, "صيغة رقم الهاتف الحالية غير صالحة")
  .min(7)
  .max(20);

export const CurrencySchema = z.string().trim().length(3);

export const BarcodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(128);

export const ExpiryDateSchema = z.coerce
  .date()
  .refine((date) => date > new Date("2000-01-01"), "تاريخ الصلاحية يجب أن يكون منطقياً بعد عام 2000");

export const TaxNumberSchema = z
  .string()
  .trim()
  .min(5)
  .max(30);
