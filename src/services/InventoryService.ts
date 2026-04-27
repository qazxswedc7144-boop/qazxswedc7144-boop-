
import { Product, InventoryItem, InventoryTransaction, MedicineBatch, MedicineAlert } from '../types';
import { auditLogService } from './auditLog';
import { db } from '../lib/database';
import { safeGetById } from '../utils/dexieSafe';

export class InventoryService {
  /**
   * Retrieves all products from Dexie.
   */
  static async getProducts(): Promise<Product[]> {
    try {
      const products = await db.products.filter((p: any) => !p.deletedAt).toArray();
      return (products || []) as any[];
    } catch (error) {
      console.error('Error fetching products from Dexie:', error);
      return [];
    }
  }

  /**
   * Saves a product to Dexie.
   */
  static async saveProduct(product: Product): Promise<string> {
    const isNew = !product.id;
    const now = new Date().toISOString();
    const productPayload = {
      ...product,
      updated_at: now,
      updatedAt: now,
      lastModified: now
    };

    if (isNew) {
      productPayload.id = `PRD-${Date.now()}`;
      (productPayload as any).Created_At = now;
      (productPayload as any).createdAt = Date.now();
    }

    try {
      await db.products.put(productPayload);
      return productPayload.id;
    } catch (error: any) {
      throw new Error(`Failed to save product to Dexie: ${error.message}`);
    }
  }

  /**
   * Updates the stock quantity of a product in Dexie.
   */
  static async updateStock(productId: string, quantityChange: number): Promise<Product | undefined> {
    try {
      const product = await db.products.get(productId);

      if (!product) {
        console.error('Product not found for stock update:', productId);
        return undefined;
      }

      const newStock = (product.StockQuantity || product.stock || 0) + quantityChange;
      const now = new Date().toISOString();

      await db.products.update(productId, { 
        StockQuantity: newStock, 
        stock: newStock,
        updated_at: now,
        updatedAt: now,
        lastModified: now
      });

      return await db.products.get(productId);
    } catch (updateError) {
      console.error('Error updating stock in Dexie:', updateError);
      return undefined;
    }
  }

  /**
   * Retrieves all medicine batches from Dexie.
   */
  static async getMedicineBatches(): Promise<MedicineBatch[]> {
    try {
      const batches = await db.medicineBatches.toArray();
      return (batches || []) as any[];
    } catch (error) {
       console.warn('Error fetching medicine batches from Dexie:', error);
       return [];
    }
  }

  /**
   * Retrieves all medicine alerts.
   */
  static async getMedicineAlerts(): Promise<MedicineAlert[]> {
    return await db.medicineAlerts.toArray();
  }

  /**
   * Records a stock movement.
   */
  static async recordMovement(movement: {
    type: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN',
    productId: string,
    warehouseId: string,
    quantity: number,
    sourceId?: string,
    sourceType?: string,
    sourceDocId?: string,
    sourceDocType?: string,
    userId: string,
    notes?: string
  }): Promise<void> {
    try {
      if (!movement.productId) {
        throw new Error("Movement productId is required");
      }

      const product = await safeGetById(db.products, movement.productId);
      if (!product) {
        throw new Error(`Product [${movement.productId}] not found.`);
      }

      const finalSourceId = movement.sourceId || movement.sourceDocId || 'N/A';
      const finalSourceType = movement.sourceType || movement.sourceDocType || 'MANUAL';

      const now = new Date().toISOString();
      const currentQty = product.StockQuantity || product.stock || 0;
      const transaction: InventoryTransaction = {
        TransactionID: db.generateId('ITX'),
        productId: movement.productId,
        warehouseId: movement.warehouseId || 'WH-MAIN',
        SourceDocumentType: finalSourceType as any,
        SourceDocumentID: finalSourceId,
        QuantityChange: movement.quantity,
        before_qty: currentQty,
        after_qty: currentQty + movement.quantity,
        TransactionType: movement.type,
        TransactionDate: now,
        UserID: movement.userId || 'system',
        notes: movement.notes,
        id: db.generateId('ITX'), // SyncableEntity id
        Created_At: now,
        Created_By: movement.userId || 'system',
        lastModified: now
      };

      await db.inventoryTransactions.add(transaction);
      
      // NEW: Log to central audit system
      await auditLogService.log({
        table: 'products',
        action: movement.type === 'ADJUSTMENT' ? 'INVENTORY_ADJUSTMENT' : 
                movement.type === 'SALE' ? 'STOCK_OUT' : 
                movement.type === 'PURCHASE' ? 'STOCK_IN' : 'UPDATE' as any,
        entityId: movement.productId,
        oldData: { qty: currentQty },
        newData: { qty: currentQty + movement.quantity },
        details: movement.notes || `Inventory ${movement.type}: ${movement.quantity}`,
        userId: movement.userId
      });
      
      // Update the product stock
      const newQty = currentQty + movement.quantity;
      await db.products.update(movement.productId, {
        StockQuantity: newQty,
        stock: newQty,
        updated_at: now,
        updatedAt: now,
        lastModified: now
      });

      // Update warehouse stock
      const warehouseId = movement.warehouseId || 'WH-MAIN';
      const productId = movement.productId;

      if (!warehouseId || !productId || typeof warehouseId !== 'string' || typeof productId !== 'string') {
        console.warn("Skipping warehouse stock update: invalid IDs", { warehouseId, productId });
        return;
      }

      try {
        const warehouseStock = await db.warehouseStock
          .where('[warehouseId+productId]')
          .equals([warehouseId, productId])
          .first();

        if (warehouseStock) {
          warehouseStock.quantity += movement.quantity;
          await db.warehouseStock.put(warehouseStock);
        } else {
          await db.warehouseStock.add({
            id: db.generateId('WHS'),
            warehouseId: warehouseId,
            productId: productId,
            quantity: movement.quantity,
            lastUpdated: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error("❌ Warehouse stock update failed:", err);
      }
    } catch (error) {
      console.error("Error recording movement:", error);
      throw error;
    }
  }

  /**
   * Gets the stock level for a specific warehouse and product.
   */
  static async getWarehouseStock(warehouseId: string, productId: string): Promise<number> {
    if (!warehouseId || !productId || typeof warehouseId !== 'string' || typeof productId !== 'string') {
      return 0;
    }
    
    try {
      const stock = await db.warehouseStock
        .where('[warehouseId+productId]')
        .equals([warehouseId, productId])
        .first();
      return stock ? stock.quantity : 0;
    } catch (error) {
      console.error('Error fetching warehouse stock:', error);
      return 0;
    }
  }

  /**
   * Validates if there is enough stock available.
   */
  static async validateStockAvailability(warehouseId: string, productId: string, requestedQty: number): Promise<boolean> {
    const available = await this.getWarehouseStock(warehouseId, productId);
    return available >= requestedQty;
  }
}
