// server/routes/inventory.routes.ts
import { Router, Response } from "express";
import { prisma } from "../database/prisma";
import { FifoService } from "../modules/inventory/services/fifo.service";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.middleware";
import { StockMoveSchema } from "../../src/shared/validation/inventory.schema";
import { validateRequestBody } from "../middleware/validate";

export const inventoryRouter = Router();

/**
 * POST /api/inventory/move
 * Post custom inward stock additions or adjustments securely.
 */
inventoryRouter.post("/move", authenticateToken, validateRequestBody(StockMoveSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body; // sanitized and verified by validateRequestBody

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

    return res.json({
      success: true,
      message: "Warehouse movement posted and calculated dynamically."
    });
  } catch (err: any) {
    return res.status(400).json({
      error: "MOVEMENT_FAILED",
      message: err.message || err
    });
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
