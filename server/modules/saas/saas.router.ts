// server/modules/saas/saas.router.ts
import { Router, Request, Response } from "express";
import { SaasService } from "./saas.service";
import { authenticateToken, AuthenticatedRequest } from "../../middleware/auth.middleware";
import bcrypt from "bcrypt";

export const saasRouter = Router();

/**
 * POST /api/saas/register-tenant
 * Public endpoint to register a new tenant, create owner user and main branch
 */
saasRouter.post("/register-tenant", async (req: Request, res: Response) => {
  try {
    const { username, password, tenantName, branchName, planCode } = req.body;

    if (!username || !password || !tenantName) {
      return res.status(400).json({
        success: false,
        message: "يرجى توفير اسم المستخدم وكلمة المرور واسم المؤسسة.",
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await SaasService.registerTenantWorkflow({
      username,
      passwordHash,
      tenantName,
      branchName: branchName || "الفرع الرئيسي",
      planCode: planCode || "TRIAL",
    });

    return res.status(201).json({
      success: true,
      message: "تم إنشاء حساب المؤسسة بنجاح!",
      data: {
        tenantId: result.tenant.id,
        tenantName: result.tenant.name,
        branchId: result.branch.id,
        branchCode: result.branch.code,
        user: {
          id: result.user.id,
          username: result.user.username,
          role: result.user.role,
        },
        licenseKey: result.licenseKey,
        plan: result.plan.name,
      },
    });
  } catch (err: any) {
    console.error("[SaaS Router] Registration failed:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ غير متوقع أثناء تسجيل المؤسسة السحابية الجديدة.",
    });
  }
});

/**
 * GET /api/saas/metrics
 * Returns Platform Owner Dashboard statistics. Scoped to PLATFORM_OWNER.
 * But we also allow a fallback so standard admins can inspect during Phase 5 validation.
 */
saasRouter.get("/metrics", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if the user is authorized as Platform Owner
    const isPlatformOwner = req.user?.role === "PLATFORM_OWNER" || req.user?.role === "ADMIN";
    if (!isPlatformOwner) {
      return res.status(403).json({
        success: false,
        message: "هذا الإجراء مخصص لمالك المنصة السحابية الرئيسي فقط.",
      });
    }

    const metrics = await SaasService.getPlatformOwnerMetrics();
    return res.json({
      success: true,
      metrics,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * GET /api/saas/subscription-status/:tenantId
 * Checks trial limits or subscription health of a tenant
 */
saasRouter.get("/subscription-status/:tenantId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const limitCheck = await SaasService.checkSubscriptionLimit(tenantId || "");
    return res.json({
      success: true,
      ...limitCheck,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * POST /api/saas/seed-plans
 * Admin utility to trigger plan synchronization
 */
saasRouter.post("/seed-plans", async (_req: Request, res: Response) => {
  try {
    await SaasService.seedSubscriptionPlans();
    return res.json({
      success: true,
      message: "تم تحديث خطط الاشتراكات السحابية الأربعة بنجاح.",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});
