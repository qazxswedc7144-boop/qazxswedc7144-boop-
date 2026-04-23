
import { db } from '../lib/database';

export const ghostValueService = {
  async getPurchaseHints(productId: string) {
    if (!productId) return { lastPurchasePrice: 0, currentStock: 0 };

    try {
      // Get last purchase movement
      const lastMovement = await db.stock_movements
        .where('item_id')
        .equals(productId)
        .filter(m => m.type === 'purchase')
        .reverse()
        .sortBy('created_at')
        .then(movements => movements[0]);

      // Calculate current stock
      const movements = await db.stock_movements
        .where('item_id')
        .equals(productId)
        .toArray();
      
      const currentStock = movements.reduce((sum, m) => sum + (m.quantity_change || 0), 0);

      return {
        lastPurchasePrice: lastMovement?.unit_cost || 0,
        currentStock
      };
    } catch (error) {
      console.error('Error getting purchase hints:', error);
      return { lastPurchasePrice: 0, currentStock: 0 };
    }
  },

  async getSalesHints(productId: string) {
    if (!productId) return { lastSalePrice: 0, availableStock: 0 };

    try {
      // For sales, we might want the last price from invoice_items if stock_movements unit_cost is cost price
      // But let's check stock_movements first as it's more direct for "last movement"
      const lastMovement = await db.stock_movements
        .where('item_id')
        .equals(productId)
        .filter(m => m.type === 'sale')
        .reverse()
        .sortBy('created_at')
        .then(movements => movements[0]);

      // Calculate available stock
      const movements = await db.stock_movements
        .where('item_id')
        .equals(productId)
        .toArray();
      
      const availableStock = movements.reduce((sum, m) => sum + (m.quantity_change || 0), 0);

      return {
        lastSalePrice: lastMovement?.unit_cost || 0,
        availableStock
      };
    } catch (error) {
      console.error('Error getting sales hints:', error);
      return { lastSalePrice: 0, availableStock: 0 };
    }
  }
};
