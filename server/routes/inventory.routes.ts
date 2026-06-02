// server/routes/inventory.routes.ts
import { Router, Response } from "express";
import { prisma } from "../database/prisma";
import { FifoService } from "../modules/inventory/services/fifo.service";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import { LockingService } from "../modules/locking/locking.service";
import { ReplicationPublisher } from "../modules/replication/replication.publisher";
import { StockMoveSchema } from "../../src/shared/validation/inventory.schema";
import { validateRequestBody } from "../middleware/validate";

export const inventoryRouter = Router();

/**
 * POST /api/inventory/move
 * Post custom inward stock additions or adjustments securely.
 */
inventoryRouter.post("/move", authenticateToken, validateRequestBody(StockMoveSchema), async (req: AuthenticatedRequest, res: Response) => {
  const data = req.body; // sanitized and verified by validateRequestBody
  const key = `inventory:${data.productId}`;
  const branchId = data.branchId || "BRH-MAIN-001";
  const userId = req.user?.userId || "SYSTEM";

  // Acquire Redis lock
  const lock = await LockingService.acquireLock({
    key,
    branchId,
    lockType: "INVENTORY",
    ownerId: userId,
    ttl: 15000 // 15s lock TTL for adjustments
  });

  if (!lock) {
    return res.status(423).json({
      error: "LOCK_CONFLICT",
      message: "The requested medicine is currently locked by another inventory transaction. Please try again soon."
    });
  }

  try {
    const refId = `ADJ-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      if (data.qty > 0) {
        // Stock addition
        await FifoService.addStock(
          tx,
          data.productId,
          data.batchNumber,
          data.qty,
          data.cost,
          data.expiryDate,
          refId,
          "ADJUSTMENT",
          data.reason || "Manual Stock Intake Adjustment"
        );
      } else {
        // Stock depletion / write off
        await FifoService.depleteStock(
          tx,
          data.productId,
          Math.abs(data.qty),
          refId,
          "ADJUSTMENT",
          data.reason || "Manual Stock Depletion Adjustment"
        );
      }

      // Record audit details
      await tx.auditLog.create({
        data: {
          userId: req.user?.userId || null,
          action: "INVENTORY_ADJUST",
          entity: "Product",
          entityId: data.productId,
          before: null,
          after: JSON.stringify(data),
          ipAddress: req.ip
        }
      });
    });

    // Broadcast inventory updated in real-time
    try {
      await ReplicationPublisher.publish({
        type: "InventoryUpdated",
        branchId,
        userId,
        payload: {
          productId: data.productId,
          qty: data.qty,
          batchNumber: data.batchNumber || "ADJUSTMENT-BATCH",
          reason: data.reason || "Manual Stock Movement"
        }
      });
    } catch (repErr: any) {
      console.warn("[REPLICATION] Failed to publish inventory modification event:", repErr.message);
    }

    return res.json({
      success: true,
      message: "Warehouse movement posted and calculated dynamically."
    });
  } catch (err: any) {
    return res.status(400).json({
      error: "MOVEMENT_FAILED",
      message: err.message || err
    });
  } finally {
    await LockingService.releaseLock(key, lock.id, branchId, userId);
  }
});

/**
 * GET /api/inventory/batches
 * Fetches all dynamic medicine physical inventory batches
 */
inventoryRouter.get("/batches", authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const batches = await prisma.inventoryBatch.findMany({
      where: {
        stockQuantity: { gt: 0 }
      },
      orderBy: [
        { expiryDate: "asc" },
        { createdAt: "asc" }
      ],
      include: {
        product: true
      }
    });

    return res.json({
      success: true,
      batches
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

/**
 * GET /api/inventory/products
 * Fetch products and their current aggregate stock quantities
 */
inventoryRouter.get("/products", authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" }
    });

    return res.json({
      success: true,
      products
    });
  } catch (err: any) {
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});
