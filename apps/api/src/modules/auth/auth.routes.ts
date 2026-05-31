// apps/api/src/modules/auth/auth.routes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "./auth.controller";
import { authMiddleware } from "./auth.middleware";
import { LoginSchema, RefreshTokenSchema } from "./auth.schema";
import { validateRequestBody } from "../../../../../server/middleware/validate";

export const authV1Router = Router();

// Brute-force credentials limit protection layer
const loginFallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes duration
  max: 10, // Max 10 attempts
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "تم تقييد محاولات تسجيل الدخول حماية للحسابات من هجمات القوة الغاشمة. يرجى الانتظار 15 دقيقة."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false }
});

authV1Router.post("/login", loginFallbackLimiter, validateRequestBody(LoginSchema), AuthController.login);
authV1Router.post("/refresh", validateRequestBody(RefreshTokenSchema), AuthController.refresh);
authV1Router.post("/logout", AuthController.logout);
authV1Router.get("/me", authMiddleware, AuthController.me);
