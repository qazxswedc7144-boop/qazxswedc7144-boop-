// src/shared/validation/accounting.schema.ts
import { z } from "zod";
import { MoneySchema, OptionalStringSchema } from "./common.schema";

export const JournalLineSchema = z.object({
  accountId: z.string().uuid("معرّف الحساب المالي يجب أن يكون UUID صالح"),
  debit: MoneySchema.default(0),
  credit: MoneySchema.default(0),
  description: OptionalStringSchema
}).strict();

export const AccountingEntrySchema = z.object({
  description: OptionalStringSchema,
  date: z.coerce.date().optional(),
  sourceId: z.string().uuid().optional().nullable(),
  sourceType: z.string().optional().nullable(),
  referenceId: z.string().optional().nullable(),
  lines: z.array(JournalLineSchema).min(2, "القيد المحاسبي يجب أن يحتوي على سطرين على الأقل (دائن ومدين)")
})
.strict()
.refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    // Use epsilon decimal tolerance for financial values
    return Math.abs(totalDebit - totalCredit) < 0.0001;
  },
  {
    message: "القيد المالي غير متوازن محاسبياً: يجب أن يتساوى إجمالي الجانب المدين مع إجمالي الجانب الدائن بالكامل (Double-Entry Balanced Entry).",
    path: ["lines"]
  }
);

export type JournalLineDTO = z.infer<typeof JournalLineSchema>;
export type AccountingEntryDTO = z.infer<typeof AccountingEntrySchema>;
