
import { db } from './database';
import { Product } from '../types';

interface MovementData {
  product: Product;
  soldQty: number; 
  revenue: number;
  velocity: 'Fast' | 'Medium' | 'Slow' | 'Dead';
  turnoverRate: number;
}

/**
 * محرك التحليل التقليدي (Legacy Analytics Engine)
 */
export const analyticsEngine = {
  
  /**
   * 1. التنبؤ بنقص المخزون (Inventory Forecasting)
   */
  calculateReorderPoint: (dailySalesAvg: number, leadTimeDays: number = 3): number => {
    const safetyStock = (dailySalesAvg * leadTimeDays) * 0.2;
    const reorderPoint = (dailySalesAvg * leadTimeDays) + safetyStock;
    return Math.ceil(reorderPoint);
  },

  /**
   * 2. تحليل صلاحية الأدوية (Expiry Surveillance)
   */
  getExpiringSoon: (inventory: any[], thresholdMonths: number = 6) => {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setMonth(today.getMonth() + thresholdMonths);
    
    return inventory.filter(item => {
      const expiry = new Date(item.ExpiryDate || item.expiryDate);
      return expiry <= limitDate && expiry > today;
    });
  },

  /**
   * 3. تصنيف العملاء (ABC Revenue Analysis)
   */
  classifyCustomer: (totalSpent: number): 'VIP' | 'Loyal' | 'Standard' => {
    if (totalSpent >= 10000) return 'VIP';
    if (totalSpent >= 5000) return 'Loyal';
    return 'Standard';
  },

  /**
   * 4. تحليل سرعة دوران المخزون (Inventory Turnover)
   */
  // Fix: Made async and awaited async database calls
  getProductMovementAnalysis: async (days: number = 30): Promise<MovementData[]> => {
    const sales = await db.getSales();
    const products = await db.getProducts();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentSales = sales.filter(s => new Date(s.Date || s.date || "").getTime() >= cutoffDate.getTime());
    
    const salesMap = new Map<string, { qty: number, rev: number }>();
    
    recentSales.forEach(sale => {
      sale.items.forEach(item => {
        const current = salesMap.get(item.product_id) || { qty: 0, rev: 0 };
        salesMap.set(item.product_id, {
          qty: current.qty + item.qty,
          rev: current.rev + item.sum
        });
      });
    });

    return products.map(p => {
      const stats = salesMap.get(p.id) || { qty: 0, rev: 0 };
      
      let velocity: MovementData['velocity'] = 'Dead';
      if (stats.qty >= 50) velocity = 'Fast';       
      else if (stats.qty >= 10) velocity = 'Medium'; 
      else if (stats.qty > 0) velocity = 'Slow';     
      else velocity = 'Dead';                        

      const avgInventory = p.StockQuantity > 0 ? p.StockQuantity : 1; 
      const turnover = stats.qty / avgInventory;

      return {
        product: p,
        soldQty: stats.qty,
        revenue: stats.rev,
        velocity,
        turnoverRate: turnover
      };
    }).sort((a, b) => b.soldQty - a.soldQty); 
  }
};
