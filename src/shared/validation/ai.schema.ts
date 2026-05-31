// src/shared/validation/ai.schema.ts
import { z } from "zod";

export const ParsedInvoiceItemSchema = z.object({
  name: z.string().min(1, "اسم الصنف مطلوب"),
  quantity: z.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  price: z.number().nonnegative("السعر لا يمكن أن يكون سالباً"),
  expiryDate: z.string().trim().optional()
}).strict();

export const ParsedInvoiceSchema = z.object({
  type: z.enum(["cash", "credit", "return"]),
  supplier: z.string().trim().min(1, "اسم المورد مطلوب"),
  invoice_number: z.string().trim().min(1, "رقم الفاتورة مطلوب"),
  date: z.string().trim().optional(),
  notes: z.string().trim().default(""),
  items: z.array(ParsedInvoiceItemSchema).min(1, "يجب وجود صنف واحد على الأقل للفاتورة")
}).strict();

export type ParsedInvoiceDTO = z.infer<typeof ParsedInvoiceSchema>;
