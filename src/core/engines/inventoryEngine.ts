
import { Product, InventoryLog } from '@/types';
import { generateId } from '../../../utils/id';

export class InventoryEngine {

  /**
   * إضافة مخزون (شراء)
   * يحسب التكلفة المتوسطة المرجحة (Weighted Average Cost)
   */
  static addStock(product: Product, qty: number, cost: number): { product: Product, log: InventoryLog } {
    const currentStock = product.StockQuantity || 0;
    const currentAvgCost = product.avgCost || product.CostPrice || 0;

    const totalCost = currentAvgCost * currentStock;
    const newTotal = totalCost + (qty * cost);
    const newQty = currentStock + qty;

    product.StockQuantity = newQty;
    product.avgCost = newQty > 0 ? newTotal / newQty : cost;
    product.totalValue = product.StockQuantity * product.avgCost;
    product.lastUpdated = Date.now();
    product.updatedAt = new Date().toISOString();

    const log: InventoryLog = {
      id: generateId('ILOG'),
      productId: product.id,
      type: 'add',
      qty: qty,
      date: Date.now(),
      lastModified: new Date().toISOString()
    };

    return { product, log };
  }

  /**
   * خصم مخزون (بيع)
   */
  static removeStock(product: Product, qty: number): { product: Product, log: InventoryLog } {
    const currentStock = product.StockQuantity || 0;

    if (currentStock < qty) {
      throw new Error("لا يوجد مخزون كافي (Stock not enough)");
    }

    product.StockQuantity = currentStock - qty;
    product.totalValue = product.StockQuantity * (product.avgCost || product.CostPrice || 0);
    product.lastUpdated = Date.now();
    product.updatedAt = new Date().toISOString();

    // Low stock alert
    if (product.StockQuantity <= (product.minStock || product.MinLevel || 0)) {
      console.warn(`⚠️ تنبيه: المخزون منخفض للمنتج: ${product.Name}`);
    }

    const log: InventoryLog = {
      id: generateId('ILOG'),
      productId: product.id,
      type: 'remove',
      qty: qty,
      date: Date.now(),
      lastModified: new Date().toISOString()
    };

    return { product, log };
  }

  /**
   * إرجاع (مرتجع)
   */
  static returnStock(product: Product, qty: number): { product: Product, log: InventoryLog } {
    const currentStock = product.StockQuantity || 0;
    
    product.StockQuantity = currentStock + qty;
    product.totalValue = product.StockQuantity * (product.avgCost || product.CostPrice || 0);
    product.lastUpdated = Date.now();
    product.updatedAt = new Date().toISOString();

    const log: InventoryLog = {
      id: generateId('ILOG'),
      productId: product.id,
      type: 'return',
      qty: qty,
      date: Date.now(),
      lastModified: new Date().toISOString()
    };

    return { product, log };
  }
}

/**
 * محرك قيمة المخزون
 */
export const getInventoryValue = async (products: Product[]) => {
  return products.reduce((sum, p) => {
    const stock = p.StockQuantity || 0;
    const cost = p.avgCost || p.CostPrice || 0;
    return sum + (stock * cost);
  }, 0);
};
