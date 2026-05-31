// src/shared/validation/inventory.schema.ts
import { z } from "zod";
import { QuantitySchema, MoneySchema, OptionalStringSchema } from "./common.schema";

export const StockMoveSchema = z.object({
  productId: z.string().uuid("معرّف المنتج يجب أن يكون UUID صالح"),
  qty: z.number().int().refine(val => val !== 0, {
    message: "قيمة كمية الحركة المخزنية لا يمكن أن تكون صفراً"
  }),
  batchNumber: z.string().trim().min(1, "رقم التشغيلة/الدفعة مطلوب"),
  cost: MoneySchema,
  expiryDate: z.coerce.date().nullable().optional(),
  reason: OptionalStringSchema
}).strict();

export const InventoryBatchSchema = z.object({
  productId: z.string().uuid("معرّف المنتج يجب أن يكون UUID صالح"),
  batchNumber: z.string().trim().min(1, "رقم التشغيلة مطلوب"),
  initialQty: QuantitySchema,
  stockQuantity: z.number().int().nonnegative(),
  cost: MoneySchema,
  expiryDate: z.coerce.date().nullable().optional()
}).strict();

export type StockMoveDTO = z.infer<typeof StockMoveSchema>;
export type InventoryBatchDTO = z.infer<typeof InventoryBatchSchema>;
