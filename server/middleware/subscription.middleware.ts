// server/middleware/subscription.middleware.ts
import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { SaasService } from "../modules/saas/saas.service";
import jwt from "jsonwebtoken";

const getJwtSecret = () => process.env.JWT_SECRET || 'pharmaflow-local-development-jwt-secure-secret-2026';

/**
 * Route-level interceptor that filters all mutations (POST, PUT, DELETE).
 * If a tenant has made >= 200 operations under trial/enforced limit,
 * abort mutations with a status code 402 Payment Required.
 */
export async function subscriptionGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Only intercept mutating methods
  const isMutation = ["POST", "PUT", "DELETE"].includes(req.method);
  if (!isMutation) {
    return next();
  }

  // Exempt billing, payment, plans, and oauth/auth paths so we can upgrade or login
  const path = req.path || "";
  if (
    path.includes("/saas/seed-plans") || 
    path.includes("/auth/") || 
    path.includes("/saas/register-tenant") ||
    path.includes("/saas/subscription-status")
  ) {
    return next();
  }

  let tenantId = req.user?.tenantId;
  if (!tenantId) {
    // Decode authorization header as fallback
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        tenantId = decoded?.tenantId || null;
      } catch (e) {
        // Safe to ignore, auth middleware will catch
      }
    }
  }

  if (!tenantId) {
    // If there is no tenant (e.g., non-SaaS fallback), bypass
    return next();
  }

  try {
    const limitCheck = await SaasService.checkSubscriptionLimit(tenantId);
    if (!limitCheck.allowed) {
      return res.status(402).json({
        error: "PAYMENT_REQUIRED",
        message: limitCheck.reason || "انتهت فترة التجربة المجانية: تم بلوغ حد 200 معاملة. يرجى ترقية الاشتراك للمتابعة.",
        current: limitCheck.current,
        limit: limitCheck.limit,
        isBlocked: true
      });
    }
  } catch (err: any) {
    console.error(`[Subscription Guard] Verification failure for tenant ${tenantId}:`, err);
  }

  next();
}

