// server/modules/locking/locking.router.ts

import { Router, Response } from "express";
import { authenticateToken, requireRoles, AuthenticatedRequest } from "../../middleware/auth.middleware";
import { Role } from "@prisma/client";
import { LockingService } from "./locking.service";

export const lockingRouter = Router();

// Secure all lock routes using token authentication
lockingRouter.use(authenticateToken);

/**
 * POST /api/locks/acquire
 * Only ADMIN, INVENTORY_MANAGER, and ACCOUNTANT roles can acquire operational locks.
 */
lockingRouter.post(
  "/acquire",
  requireRoles([Role.ADMIN, Role.INVENTORY_MANAGER, Role.ACCOUNTANT]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { key, branchId, ttl, lockType, idempotencyKey } = req.body;
      const userId = req.user?.userId || "SYSTEM";

      if (!key || !branchId || !lockType) {
        return res.status(400).json({ error: "MISSING_PARAMETERS", message: "Key, branchId, and lockType are required." });
      }

      console.log(`[LOCK-API] Acquisition request for key: '${key}', branch: ${branchId}, role: ${req.user?.role}`);

      const lock = await LockingService.acquireLock({
        key,
        branchId,
        ttl: ttl ? parseInt(ttl, 10) : undefined,
        lockType,
        idempotencyKey,
        ownerId: userId
      });

      if (!lock) {
        return res.status(200).json({
          acquired: false,
          message: `Lock conflict detected on key: '${key}'. Unable to secure resource.`
        });
      }

      return res.status(200).json({
        acquired: true,
        lock
      });
    } catch (err: any) {
      console.error("[LOCK-API] Acquire crash:", err);
      return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
    }
  }
);

/**
 * POST /api/locks/release
 */
lockingRouter.post("/release", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key, lockId, branchId } = req.body;
    const userId = req.user?.userId || "SYSTEM";

    if (!key || !lockId || !branchId) {
      return res.status(400).json({ error: "MISSING_PARAMETERS", message: "Key, lockId, and branchId are required." });
    }

    const released = await LockingService.releaseLock(key, lockId, branchId, userId);
    return res.status(200).json({ released });
  } catch (err: any) {
    console.error("[LOCK-API] Release error:", err);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
});

/**
 * POST /api/locks/extend
 */
lockingRouter.post("/extend", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key, lockId, branchId, ttl } = req.body;
    const userId = req.user?.userId || "SYSTEM";

    if (!key || !lockId || !branchId || !ttl) {
      return res.status(400).json({ error: "MISSING_PARAMETERS", message: "Key, lockId, branchId, and ttl are required." });
    }

    const extended = await LockingService.extendLock(key, lockId, branchId, parseInt(ttl, 10), userId);
    return res.status(200).json({ extended });
  } catch (err: any) {
    console.error("[LOCK-API] Extension error:", err);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
});

/**
 * GET /api/locks/check/:key
 */
lockingRouter.get("/check/:key", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { branchId } = req.query;

    if (!key || !branchId) {
      return res.status(400).json({ error: "MISSING_PARAMETERS", message: "key and branchId query parameter are required." });
    }

    const locked = await LockingService.isLocked(key, branchId as string);
    return res.status(200).json({ locked });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
});

/**
 * GET /api/locks/active
 */
lockingRouter.get("/active", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { branchId } = req.query;
    const locks = await LockingService.getActiveLocks(branchId ? String(branchId) : undefined);
    return res.status(200).json({ locks });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
});

/**
 * POST /api/locks/recover
 * Only ADMINS can triggers bulk lock recovery.
 */
lockingRouter.post(
  "/recover",
  requireRoles([Role.ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { branchId, key } = req.body;

      if (!branchId) {
        return res.status(400).json({ error: "MISSING_PARAMETERS", message: "branchId is required." });
      }

      const recoveredCount = await LockingService.recoverLocks(branchId, key);
      return res.status(205).json({
        success: true,
        recoveredCount,
        message: `Sweep finished. Recovered ${recoveredCount} locked scopes.`
      });
    } catch (err: any) {
      return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
    }
  }
);
