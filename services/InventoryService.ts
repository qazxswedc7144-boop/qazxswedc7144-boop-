
import { db } from './database';
import { Product, InventoryItem, InventoryTransaction, MedicineBatch, MedicineAlert } from '../types';

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
  static async updateStock(productId: string, quantityChange: number): Promise<void> {
    const product = await db.products.get(productId);
    if (product) {
      product.StockQuantity += quantityChange;
      await db.products.put(product);
    }
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
}
