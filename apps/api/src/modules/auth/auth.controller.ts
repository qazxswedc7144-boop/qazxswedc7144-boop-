// apps/api/src/modules/auth/auth.controller.ts
import { Response } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { AuthService } from "./auth.service";
import { AuditService } from "../audit/audit.service";
import { prisma } from "../../../../../server/database/prisma";

export class AuthController {
  /**
   * Safe login execution and register log audits.
   */
  static async login(req: AuthenticatedRequest, res: Response) {
    try {
      const { username, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { username }
      });

      if (!user || user.passwordHash === "") {
        await AuditService.logLoginAttempt(undefined, username, "FAILED", req.ip);
        return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "خطأ في اسم المستخدم أو كلمة المرور." });
      }

      const isValid = await AuthService.verifyPassword(password, user.passwordHash);
      if (!isValid) {
        await AuditService.logLoginAttempt(user.id, username, "FAILED", req.ip);
        return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "خطأ في اسم المستخدم أو كلمة المرور." });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "ACCOUNT_SUSPENDED", message: "حساب المستخدم معطل حالياً." });
      }

      const accessToken = AuthService.generateAccessToken(user);
      const refreshToken = AuthService.generateRefreshToken(user);

      // Persist active sessions in database
      await AuthService.createSession(user.id, accessToken, req.ip, req.headers["user-agent"]);
      await AuthService.createRefreshTokenRecord(user.id, refreshToken);

      // Log audit
      await AuditService.logLoginAttempt(user.id, username, "SUCCESS", req.ip);

      return res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  }

  /**
   * Refreshes access token with valid rotation.
   */
  static async refresh(req: AuthenticatedRequest, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: "REFRESH_TOKEN_REQUIRED", message: "رمز التحديث مطلوب." });
      }

      const decoded = AuthService.verifyRefreshToken(refreshToken);
      const record = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      });

      if (!record || record.revoked || record.expiresAt < new Date()) {
        return res.status(401).json({ error: "INVALID_REFRESH_TOKEN", message: "رمز التحديث تالف أو ملغى أو منتهي الصلاحية." });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: "USER_INACTIVE", message: "لم يعد حساب المستخدم المرتبط نشطاً." });
      }

      const newAccessToken = AuthService.generateAccessToken(user);
      await AuthService.createSession(user.id, newAccessToken, req.ip, req.headers["user-agent"]);

      return res.json({
        success: true,
        accessToken: newAccessToken
      });
    } catch (err: any) {
      return res.status(401).json({ error: "INVALID_REFRESH_TOKEN", message: "فشل التحقق من توقيع الرمز." });
    }
  }

  /**
   * Logs out and terminates running sessions.
   */
  static async logout(req: AuthenticatedRequest, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        if (token) {
          await AuthService.revokeSession(token);
        }
      }

      const { refreshToken } = req.body;
      if (refreshToken) {
        await AuthService.revokeRefreshToken(refreshToken);
      }

      if (req.user) {
        await AuditService.log({
          userId: req.user.userId,
          action: "USER_LOGOUT",
          entity: "User",
          entityId: req.user.userId,
          after: "Sessions invalidated cleanly"
        });
      }

      return res.json({ success: true, message: "تم تسجيل الخروج بنجاح وتدمير الرموز المفتوحة." });
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
    }
  }

  /**
   * Retrieves active identity context.
   */
  static me(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "جلسة العمل مفقودة." });
    }
    return res.json({
      success: true,
      user: {
        id: req.user.userId,
        username: req.user.username,
        role: req.user.role
      }
    });
  }
}
