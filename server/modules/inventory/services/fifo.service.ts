// server/modules/inventory/services/fifo.service.ts
import { Prisma } from "@prisma/client";

export interface DepletionResult {
  allocations: {
    batchId: string;
    batchNumber: string;
    qtyAllocated: number;
    cost: number;
  }[];
  totalCost: number;
}

export class FifoService {
  /**
   * Deplete product stock using FIFO/FEFO priority rules with Row-Level Locking (SELECT FOR UPDATE)
   * to guarantee multi-user concurrency protection and prevent overselling or negative stock.
   */
  static async depleteStock(
    tx: Prisma.TransactionClient,
    productId: string,
    quantityToDeplete: number,
    referenceId: string,
    referenceType: string,
    reason?: string
  ): Promise<DepletionResult> {
    if (quantityToDeplete <= 0) {
      return { allocations: [], totalCost: 0 };
    }

    // 1. Lock the Product row to prevent simultaneous writes to the global stock quantity
    const lockedProducts = await tx.$queryRaw<any[]>(
      Prisma.sql`SELECT id, "stockQuantity", version FROM products WHERE id = ${productId} FOR UPDATE`
    );

    if (!lockedProducts || lockedProducts.length === 0) {
      throw new Error(`PRODUCT_NOT_FOUND: Product with ID ${productId} does not exist.`);
    }

    const mainProduct = lockedProducts[0];
    if (mainProduct.stockQuantity < quantityToDeplete) {
      throw new Error(
        `INSUFFICIENT_STOCK: Required ${quantityToDeplete} units of product "${productId}", but only ${mainProduct.stockQuantity} is available.`
      );
    }

    // 2. Fetch and lock candidate inventory batches that are in stock
    // Sorted by expiryDate ascending (FEFO first) and createdAt ascending (FIFO backup)
    const activeBatches = await tx.$queryRaw<any[]>(
      Prisma.sql`
        SELECT id, "batchNumber", "stockQuantity", cost, "expiryDate", version 
        FROM inventory_batches 
        WHERE "productId" = ${productId} AND "stockQuantity" > 0 
        ORDER BY "expiryDate" ASC, "createdAt" ASC 
        FOR UPDATE
      `
    );

    let remainingNeeded = quantityToDeplete;
    const allocations: DepletionResult["allocations"] = [];
    let accumulatedCost = 0;

    for (const batch of activeBatches) {
      if (remainingNeeded <= 0) break;

      const availableInBatch = Number(batch.stockQuantity);
      const toTake = Math.min(availableInBatch, remainingNeeded);

      const updatedBatchStock = availableInBatch - toTake;
      const batchCost = Number(batch.cost);

      // Decrement batch stock via prisma update (and checking the version for optimistic locking)
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          stockQuantity: updatedBatchStock,
          version: { increment: 1 }
        }
      });

      // Record inventory movement for each depleted batch layer
      await tx.inventoryMovement.create({
        data: {
          productId,
          batchId: batch.id,
          qty: -toTake,
          type: "STOCK_OUT",
          referenceId,
          referenceType,
          reason: reason || "FIFO/FEFO Depletion",
          previousStock: availableInBatch,
          currentStock: updatedBatchStock
        }
      });

      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        qtyAllocated: toTake,
        cost: batchCost
      });

      accumulatedCost += toTake * batchCost;
      remainingNeeded -= toTake;
    }

    if (remainingNeeded > 0) {
      throw new Error(
        `FIFO_DEPLETION_MISMATCH: The actual sum of batches' stock for product ${productId} was insufficient to deplete ${quantityToDeplete}.`
      );
    }

    // 3. Update the global aggregate product stock
    const newGlobalStock = mainProduct.stockQuantity - quantityToDeplete;
    await tx.product.update({
      where: { id: productId },
      data: {
        stockQuantity: newGlobalStock,
        version: { increment: 1 }
      }
    });

    return {
      allocations,
      totalCost: accumulatedCost
    };
  }

  /**
   * Safe Stock Inward (Stock Additions) with Batch Creation & Movement Logging
   */
  static async addStock(
    tx: Prisma.TransactionClient,
    productId: string,
    batchNumber: string,
    qty: number,
    cost: number,
    expiryDate: Date | null,
    referenceId: string,
    referenceType: string,
    reason?: string
  ): Promise<void> {
    if (qty <= 0) return;

    // 1. Pessimistic lock on product main row
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`
    );

    // 2. Add or upsert inventory batch layer
    const existingBatch = await tx.inventoryBatch.findUnique({
      where: { productId_batchNumber: { productId, batchNumber } }
    });

    let targetBatchId: string;

    if (existingBatch) {
      const updatedBatch = await tx.inventoryBatch.update({
        where: { id: existingBatch.id },
        data: {
          stockQuantity: existingBatch.stockQuantity + qty,
          cost: cost, // update to latest cost
          expiryDate: expiryDate || existingBatch.expiryDate,
          version: { increment: 1 }
        }
      });
      targetBatchId = updatedBatch.id;
    } else {
      const newBatch = await tx.inventoryBatch.create({
        data: {
          productId,
          batchNumber,
          initialQty: qty,
          stockQuantity: qty,
          cost: cost,
          expiryDate: expiryDate
        }
      });
      targetBatchId = newBatch.id;
    }

    // 3. Create stock in movement log
    const prevProductStockObj = await tx.product.findUnique({
      where: { id: productId },
      select: { stockQuantity: true }
    });
    const prevProductStock = prevProductStockObj?.stockQuantity || 0;

    await tx.inventoryMovement.create({
      data: {
        productId,
        batchId: targetBatchId,
        qty,
        type: "STOCK_IN",
        referenceId,
        referenceType,
        reason: reason || "Batch Procurement Addition",
        previousStock: prevProductStock,
        currentStock: prevProductStock + qty
      }
    });

    // 4. Increment global aggregate product stock
    await tx.product.update({
      where: { id: productId },
      data: {
        stockQuantity: { increment: qty },
        cost: cost, // update current purchase cost
        version: { increment: 1 }
      }
    });
  }
}
