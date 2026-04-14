
import { db } from './database';
import { Product, InventoryItem, InventoryTransaction, MedicineBatch, MedicineAlert } from '../types';
import { safeGetById, safeWhereEqual } from '../utils/dexieSafe';

export class InventoryService {
  /**
   * Retrieves all products from the database.
   */
  static async getProducts(): Promise<Product[]> {
    return await db.products.toArray();
  }

  /**
   * Saves a product to the database.
   */
  static async saveProduct(product: Product): Promise<string> {
    if (!product.id) {
      product.id = db.generateId('PRD');
    }
    await db.products.put(product);
    return product.id;
  }

  /**
   * Updates the stock quantity of a product.
   */
  static async updateStock(productId: string, quantityChange: number): Promise<Product | undefined> {
    const product = await safeGetById(db.products, productId);
    if (product) {
      product.StockQuantity += quantityChange;
      await db.products.put(product);
      return product;
    }
    return undefined;
  }

  /**
   * Retrieves all inventory items.
   */
  static async getInventory(): Promise<InventoryItem[]> {
    return await db.inventory.toArray();
  }

  /**
   * Retrieves all medicine batches.
   */
  static async getMedicineBatches(): Promise<MedicineBatch[]> {
    return await db.medicineBatches.toArray();
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
      const transaction: InventoryTransaction = {
        TransactionID: db.generateId('ITX'),
        productId: movement.productId,
        warehouseId: movement.warehouseId || 'WH-MAIN',
        SourceDocumentType: finalSourceType as any,
        SourceDocumentID: finalSourceId,
        QuantityChange: movement.quantity,
        before_qty: product.StockQuantity,
        after_qty: product.StockQuantity + movement.quantity,
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
      
      // Update the product stock
      product.StockQuantity += movement.quantity;
      await db.products.put(product);

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
