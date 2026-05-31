// src/shared/validation/invoice.schema.ts
import { z } from "zod";
import { MoneySchema, QuantitySchema, OptionalStringSchema } from "./common.schema";

export const InvoiceItemSchema = z.object({
  productId: z.string().uuid("معرّف المنتج يجب أن يكون UUID صالح"),
  qty: QuantitySchema,
  price: MoneySchema,
  expiryDate: z.coerce.date().nullable().optional(),
  note: OptionalStringSchema
}).strict();

export const InvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(3, "رقم الفاتورة يجب أن يحتوي على 3 أرقام أو حروف على الأقل").max(50),
  type: z.enum(["SALE", "PURCHASE", "RETURN_SALE", "RETURN_PURCHASE"]),
  partnerId: z.string().uuid("معرّف الشريك يجب أن يكون UUID صالح").nullable().optional(),
  partnerType: z.enum(["CUSTOMER", "SUPPLIER"]).nullable().optional(),
  totalAmount: MoneySchema,
  status: z.enum(["DRAFT", "PENDING", "CONFIRMED", "CANCELLED"]).default("DRAFT"),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIALLY_PAID"]).default("UNPAID"),
  documentStatus: z.enum(["ACTIVE", "POSTED", "ARCHIVED", "LOCKED"]).default("ACTIVE"),
  items: z.array(InvoiceItemSchema).min(1, "يجب أن تحتوي الفاتورة على صنف واحد على الأقل")
}).strict();

export type InvoiceDTO = z.infer<typeof InvoiceSchema>;
export type InvoiceItemDTO = z.infer<typeof InvoiceItemSchema>;
