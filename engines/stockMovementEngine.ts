
import { db } from '../services/database';
import { StockMovement } from '../types';
import { SyncEngine } from '../services/SyncEngine';
import { PeriodLockEngine } from '../services/PeriodLockEngine';

export class StockMovementEngine {

  /**
   * CREATE STOCK MOVEMENT
   */
  static async createStockMovement(data: Omit<StockMovement, 'id' | 'created_at' | 'lastModified'>, batch?: any): Promise<void> {
    // 8. PROTECT DATA: Block stock changes if period is locked
    const date = (data as any).date || new Date().toISOString();
    await PeriodLockEngine.validateOperation(date, 'تعديل المخزون');

    // Check if item exists
    const product = await db.db.products.get(data.item_id);
    if (!product) {
      throw new Error(`Item ${data.item_id} not found.`);
    }

    const movement: StockMovement = {
      ...data,
      id: db.generateId('MOV'),
      created_at: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      tenant_id: SyncEngine.getTenantId()
    };

    // VALIDATION: Reject if quantity_after < 0
    if (movement.quantity_after < 0) {
      throw new Error(`Insufficient stock for item ${movement.item_id}. Resulting stock would be ${movement.quantity_after}.`);
    }

    await db.db.stock_movements.add(movement);

    // Update Product StockQuantity (Sync)
    await db.db.products.update(movement.item_id, {
      StockQuantity: movement.quantity_after
    });

    if (batch) {
      SyncEngine.addToBatch(batch, 'stock_movements', movement.id, movement);
      SyncEngine.addToBatch(batch, 'products', movement.item_id, { StockQuantity: movement.quantity_after });
    }
  }

  /**
   * GET CURRENT STOCK (Calculated from movements)
   */
  static async getCurrentStock(item_id: string): Promise<number> {
    const movements = await db.db.stock_movements
      .where('item_id')
      .equals(item_id)
      .toArray();
    
    return movements.reduce((sum, m) => sum + m.quantity_change, 0);
  }

  /**
   * ON PURCHASE MOVEMENT
   */
  static async recordPurchaseMovement(item_id: string, qty: number, unit_cost: number, reference_id: string, batch?: any): Promise<void> {
    const currentStock = await this.getCurrentStock(item_id);
    
    await this.createStockMovement({
      item_id,
      type: 'purchase',
      quantity_before: currentStock,
      quantity_change: qty,
      quantity_after: currentStock + qty,
      unit_cost,
      total_cost: qty * unit_cost,
      reference_id
    }, batch);
  }

  /**
   * ON SALE MOVEMENT
   */
  static async recordSaleMovement(item_id: string, qty: number, total_cost: number, reference_id: string, batch?: any): Promise<void> {
    const currentStock = await this.getCurrentStock(item_id);
    const unit_cost = qty > 0 ? total_cost / qty : 0;

    await this.createStockMovement({
      item_id,
      type: 'sale',
      quantity_before: currentStock,
      quantity_change: -qty,
      quantity_after: currentStock - qty,
      unit_cost,
      total_cost,
      reference_id
    }, batch);
  }

  /**
   * ON UNPOST: Reverse movements
   */
  static async reverseMovements(reference_id: string): Promise<void> {
    const movements = await db.db.stock_movements
      .where('reference_id')
      .equals(reference_id)
      .toArray();

    if (movements.length > 0) {
      // 8. PROTECT DATA: Block stock changes if period is locked
      const date = (movements[0] as any).date || movements[0].created_at || new Date().toISOString();
      await PeriodLockEngine.validateOperation(date, 'إلغاء حركات المخزون');
    }

    for (const movement of movements) {
      // To reverse, we add a counter-movement or just delete and update product?
      // The requirement says "reverse quantity_change" and "restore stock".
      // Deleting the movement and updating the product stock is the cleanest way for an unpost.
      
      const currentProduct = await db.db.products.get(movement.item_id);
      if (currentProduct) {
        await db.db.products.update(movement.item_id, {
          StockQuantity: (currentProduct.StockQuantity || 0) - movement.quantity_change
        });
      }
      
      await db.db.stock_movements.delete(movement.id);
    }
  }
}
