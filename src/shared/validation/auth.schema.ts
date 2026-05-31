// src/shared/validation/auth.schema.ts
import { z } from "zod";

export const RegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "اسم المستخدم يجب ألا يقل عن 3 أحرف")
    .max(50, "اسم المستخدم يجب ألا يزيد عن 50 حرفاً")
    .regex(/^[a-zA-Z0-9_]+$/, "اسم المستخدم يجب أن يحتوي على أحرف وأرقام أو شرطة سفلية فقط ولا يحتوي على رموز ومساحات فارغة"),
  password: z
    .string()
    .min(6, "كلمة المرور يجب ألا تقل عن 6 خانات")
    .max(100),
  role: z.enum(["ADMIN", "ACCOUNTANT", "PHARMACIST", "CASHIER", "AUDITOR"]).optional().default("CASHIER")
}).strict();

export const LoginSchema = z.object({
  username: z.string().trim().min(1, "اسم المستخدم مطلوب للمتابعة"),
  password: z.string().min(1, "كلمة المرور مطلوبة للمتابعة")
}).strict();

export type RegisterDTO = z.infer<typeof RegisterSchema>;
export type LoginDTO = z.infer<typeof LoginSchema>;
