// apps/api/src/modules/auth/auth.schema.ts
import { z } from "zod";

export const PasswordPolicySchema = z
  .string()
  .min(12, "كلمة المرور يجب أن تكون 12 خانة على الأقل")
  .refine((v) => /[A-Z]/.test(v), { message: "يجب تحتوي كلمة المرور على حرف كبير واحد على الأقل" })
  .refine((v) => /[a-z]/.test(v), { message: "يجب تحتوي كلمة المرور على حرف صغير واحد على الأقل" })
  .refine((v) => /[0-9]/.test(v), { message: "يجب تحتوي كلمة المرور على رقم واحد على الأقل" })
  .refine((v) => /[^A-Za-z0-9]/.test(v), { message: "يجب تحتوي كلمة المرور على حرف رمزي خاص واحد على الأقل" });

export const RegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "اسم المستخدم يجب ألا يقل عن 3 أحرف")
    .max(50, "اسم المستخدم يجب ألا يزيد عن 50 حرفاً")
    .regex(/^[a-zA-Z0-9_]+$/, "اسم المستخدم يجب أن يحتوي على أحرف وأرقام مع شرطة سفلية فقط"),
  password: PasswordPolicySchema,
  role: z.enum(["ADMIN", "ACCOUNTANT", "PHARMACIST", "CASHIER", "AUDITOR", "INVENTORY_MANAGER"]).optional().default("CASHIER")
}).strict();

export const LoginSchema = z.object({
  username: z.string().trim().min(1, "اسم المستخدم مطلوب للمتابعة"),
  password: z.string().min(1, "كلمة المرور مطلوبة للمتابعة")
}).strict();

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "رمز التحديث مطلوب للمتابعة")
}).strict();

export const PermissionValidationSchema = z.object({
  role: z.string(),
  permission: z.string()
}).strict();

export type RegisterDTO = z.infer<typeof RegisterSchema>;
export type LoginDTO = z.infer<typeof LoginSchema>;
export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>;
