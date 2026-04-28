
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
   * Updates the stock quantity of a product safely.
   */
  static async updateStock(productId: string, quantityChange: number): Promise<Product | undefined> {
    try {
      // 1. Validation
      if (!productId || typeof productId !== 'string') {
        console.warn('InventoryService.updateStock: Missing or invalid productId');
        return undefined;
      }

      if (typeof quantityChange !== 'number' || !Number.isFinite(quantityChange) || !Number.isInteger(quantityChange)) {
        console.warn('InventoryService.updateStock: Invalid or non-integer quantityChange for product', productId);
        return undefined;
      }

      const product = await db.products.get(productId);
      if (!product) {
        console.warn('InventoryService.updateStock: Product not found:', productId);
        return undefined;
      }

      // 2. Calculation with negative protection
      const currentStock = Number(product.StockQuantity || product.stock || 0);
      let newStock = currentStock + quantityChange;
      
      if (newStock < 0) {
        console.warn(`InventoryService.updateStock: Stock for ${productId} would be negative (${newStock}). Adjusting to 0.`);
        newStock = 0;
      }

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
      console.error('InventoryService.updateStock: Unexpected error:', updateError);
      return undefined;
    }
  }

  /**
   * Resets the stock of a specific product to 0.
   */
  static async resetStock(productId: string): Promise<void> {
    if (!productId || typeof productId !== 'string') {
      console.warn("InventoryService.resetStock: Invalid productId");
      return;
    }
    
    try {
      const now = new Date().toISOString();
      await db.products.update(productId, {
        StockQuantity: 0,
        stock: 0,
        updatedAt: now,
        updated_at: now,
        lastModified: now
      });
      console.log(`InventoryService: Stock reset to 0 for product ${productId}`);
    } catch (error) {
      console.error("InventoryService.resetStock: Failed to reset stock", error);
    }
  }

  /**
   * Batch processes a list of inventory items safely.
   */
  static async processItems(items: any[], type: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN', userId: string): Promise<void> {
    if (!Array.isArray(items)) {
      console.warn("InventoryService.processItems: Input 'items' is not an array. Ignoring.");
      return;
    }

    for (const item of items) {
      try {
        const productId = item.productId || item.product_id;
        const quantity = item.quantity !== undefined ? item.quantity : (item.qty !== undefined ? item.qty : 0);

        if (!productId) {
          console.warn("InventoryService.processItems: Skipping item with missing productId", item);
          continue;
        }

        await this.recordMovement({
          type,
          productId,
          warehouseId: item.warehouseId || 'WH-MAIN',
          quantity: Number(quantity),
          userId,
          notes: item.notes || `Batch ${type} processing`
        });
      } catch (err) {
        console.warn("InventoryService.processItems: Error processing individual item, continuing...", err);
      }
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
   * Records a stock movement with validation and negative stock protection.
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
      // 1. Basic Validation
      if (!movement || typeof movement !== 'object') {
        console.warn("InventoryService.recordMovement: Invalid movement object");
        return;
      }

      if (!movement.productId) {
        console.warn("InventoryService.recordMovement: productId is required");
        return;
      }

      if (typeof movement.quantity !== 'number' || !Number.isFinite(movement.quantity) || !Number.isInteger(movement.quantity)) {
        console.warn(`InventoryService.recordMovement: Invalid or non-integer quantity (${movement.quantity}) for product ${movement.productId}`);
        return;
      }

      const product = await safeGetById(db.products, movement.productId);
      if (!product) {
        console.warn(`InventoryService.recordMovement: Product [${movement.productId}] not found.`);
        return;
      }

      const now = new Date().toISOString();
      const currentQty = Number(product.StockQuantity || product.stock || 0);
      
      // 2. Prevent Negative Stock
      let actualChange = movement.quantity;
      let newQty = currentQty + actualChange;
      
      if (newQty < 0) {
        console.warn(`InventoryService: Prevented negative stock for ${movement.productId}. Clamping to 0.`);
        newQty = 0;
        actualChange = -currentQty;
      }

      const finalSourceId = movement.sourceId || movement.sourceDocId || 'N/A';
      const finalSourceType = movement.sourceType || movement.sourceDocType || 'MANUAL';

      const transaction: InventoryTransaction = {
        TransactionID: db.generateId('ITX'),
        productId: movement.productId,
        warehouseId: movement.warehouseId || 'WH-MAIN',
        SourceDocumentType: finalSourceType as any,
        SourceDocumentID: finalSourceId,
        QuantityChange: actualChange,
        before_qty: currentQty,
        after_qty: newQty,
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
      
      // Central audit log
      await auditLogService.log({
        table: 'products',
        action: movement.type === 'ADJUSTMENT' ? 'INVENTORY_ADJUSTMENT' : 
                movement.type === 'SALE' ? 'STOCK_OUT' : 
                movement.type === 'PURCHASE' ? 'STOCK_IN' : 'UPDATE' as any,
        entityId: movement.productId,
        oldData: { qty: currentQty },
        newData: { qty: newQty },
        details: movement.notes || `Inventory ${movement.type}: ${actualChange}`,
        userId: movement.userId
      });
      
      // Update product record
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

      if (!warehouseId || !productId) return;

      try {
        const warehouseStock = await db.warehouseStock
          .where('[warehouseId+productId]')
          .equals([warehouseId, productId])
          .first();

        if (warehouseStock) {
          const wNewQty = Math.max(0, warehouseStock.quantity + actualChange);
          await db.warehouseStock.update(warehouseStock.id, { 
            quantity: wNewQty,
            lastUpdated: now
          });
        } else {
          await db.warehouseStock.add({
            id: db.generateId('WHS'),
            warehouseId: warehouseId,
            productId: productId,
            quantity: Math.max(0, actualChange),
            lastUpdated: now
          });
        }
      } catch (err) {
        console.warn("InventoryService: Warehouse update swallowed error:", err);
      }
    } catch (error) {
      console.error("InventoryService.recordMovement: Critical error:", error);
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
