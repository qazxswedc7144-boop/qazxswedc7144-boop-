
import { ProductRepository } from '../repositories/ProductRepository';
import { Product, InventoryError } from '../types';

/**
 * Inventory Service - نظام إدارة المخزون الصارم
 */
export const inventoryService = {
  getProducts: async (): Promise<Product[]> => {
    return await ProductRepository.getAll();
  },

  /**
   * فحص إلزامي لتوفر المخزون عبر المستودع
   */
  assertStockAvailability: async (items: { product_id: string, qty: number }[]) => {
    const products = await ProductRepository.getAll();
    
    for (const item of items) {
      const product = products.find(p => p.ProductID === item.product_id);
      
      if (!product) {
        throw new InventoryError(`الصنف [${item.product_id}] غير موجود في سجلات المخزن.`);
      }

      if (product.StockQuantity < item.qty) {
        throw new InventoryError(
          `عجز مخزني في [${product.Name}]: المطلوب ${item.qty}، المتاح ${product.StockQuantity}.`
        );
      }
    }
    return true;
  }
};
