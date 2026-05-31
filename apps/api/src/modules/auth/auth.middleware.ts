// apps/api/src/modules/auth/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { hasPermission, Permission } from "../../../../../packages/auth/src/rbac";
import { AuditService } from "../audit/audit.service";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

/**
 * Standard secure JWT authenticator middleware.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "رمز الدخول مفقود أو غير صالح." });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "رمز الدخول مفقود أو غير صالح." });
    }
    const decoded = AuthService.verifyAccessToken(token);

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };

    next();
  } catch (err: any) {
    AuditService.logFailedAuth(req.ip || "unknown", `Verification error: ${err.message}`);
    return res.status(401).json({ error: "UNAUTHORIZED", message: "جلسة العمل متهالكة أو منتهية. يرجى تسجيل الدخول مجدداً." });
  }
}

/**
 * Reusable RBAC Permission checker middleware.
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "يرجى إرسال الترويسة الصحيحة وتوفير رمز هوية نشط." });
    }

    const authorized = hasPermission(req.user.role, permission);
    if (!authorized) {
      AuditService.log({
        userId: req.user.userId,
        action: "FORBIDDEN_ATTEMPT",
        entity: "PermissionGuard",
        entityId: permission,
        after: `User role [${req.user.role}] failed validating permission [${permission}]`,
        ipAddress: req.ip
      });
      return res.status(403).json({
        error: "FORBIDDEN",
        message: `عفواً، لا يملك حسابك الحالي الصلاحيات التقنية لتنفيذ العملية: [${permission}]`
      });
    }

    next();
  };
}
