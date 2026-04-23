
import { db } from '../../lib/database';
import { InventoryLayer, FIFOConsumptionLog } from '../../types';

export class FIFOEngine {

  /**
   * ON PURCHASE: Create new layer
   */
  static async addPurchaseLayer(item_id: string, quantity: number, unit_cost: number, reference_id: string): Promise<void> {
    const layer: InventoryLayer = {
      id: db.generateId('LAY'),
      item_id,
      quantity_remaining: quantity,
      unit_cost,
      created_at: new Date().toISOString(),
      reference_id,
      lastModified: new Date().toISOString(),
      tenant_id: 'TEN-DEV-001'
    };
    await db.db.inventory_layers.add(layer);
  }

  /**
   * FIFO CONSUMPTION
   */
  static async consumeFIFO(sale_id: string, item_id: string, quantity: number): Promise<{ totalCost: number, unitCost: number }> {
    if (!item_id) {
      console.warn("Skipping FIFO consumption: missing item ID");
      return { totalCost: 0, unitCost: 0 };
    }
    
    let remainingToConsume = quantity;
    let totalCost = 0;

    // 1. Get layers sorted by created_at ASC
    const layers = await db.db.inventory_layers
      .where('item_id')
      .equals(item_id)
      .filter(l => l.quantity_remaining > 0)
      .sortBy('created_at');

    const updatedLayers: InventoryLayer[] = [];
    const consumptionLogs: FIFOConsumptionLog[] = [];

    // 2. Loop layers
    for (const layer of layers) {
      if (remainingToConsume <= 0) break;

      let consumedFromThisLayer = 0;

      if (layer.quantity_remaining >= remainingToConsume) {
        // This layer can satisfy the rest of the demand
        consumedFromThisLayer = remainingToConsume;
        totalCost += consumedFromThisLayer * layer.unit_cost;
        layer.quantity_remaining -= remainingToConsume;
        remainingToConsume = 0;
      } else {
        // This layer is partially consumed
        consumedFromThisLayer = layer.quantity_remaining;
        totalCost += consumedFromThisLayer * layer.unit_cost;
        remainingToConsume -= layer.quantity_remaining;
        layer.quantity_remaining = 0;
      }

      updatedLayers.push(layer);
      consumptionLogs.push({
        id: db.generateId('LOG'),
        sale_id,
        item_id,
        layer_id: layer.id,
        quantity_consumed: consumedFromThisLayer,
        unit_cost: layer.unit_cost,
        consumed_at: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        tenant_id: 'TEN-DEV-001'
      });
    }

    // 3. VALIDATION
    if (remainingToConsume > 0) {
      throw new Error(`Insufficient stock for item ${item_id}. Missing ${remainingToConsume} units.`);
    }

    // 4. UPDATE INVENTORY & LOGS
    for (const layer of updatedLayers) {
      await db.db.inventory_layers.put(layer);
    }
    for (const log of consumptionLogs) {
      await db.db.fifo_consumption_log.add(log);
    }

    return {
      totalCost,
      unitCost: quantity > 0 ? totalCost / quantity : 0
    };
  }

  /**
   * ON UNPOST: Restore consumed quantities
   */
  static async reverseFIFO(sale_id: string): Promise<void> {
    if (!sale_id) return;
    // 1. Find consumption logs for this sale
    const logs = await db.db.fifo_consumption_log
      .where('sale_id')
      .equals(sale_id)
      .toArray();

    for (const log of logs) {
      // 2. Restore quantity to original layer
      const layer = await db.db.inventory_layers.get(log.layer_id);
      if (layer) {
        layer.quantity_remaining += log.quantity_consumed;
        layer.lastModified = new Date().toISOString();
        await db.db.inventory_layers.put(layer);
      }
      // 3. Delete log
      await db.db.fifo_consumption_log.delete(log.id);
    }
  }

  /**
   * ON PURCHASE UNPOST: Remove the layer
   */
  static async removePurchaseLayer(reference_id: string): Promise<void> {
    if (!reference_id) return;
    const layers = await db.db.inventory_layers
      .where('reference_id')
      .equals(reference_id)
      .toArray();

    for (const layer of layers) {
      await db.db.inventory_layers.delete(layer.id);
    }
  }

  /**
   * APPLY FIFO COSTING
   */
  static async apply(invoice: any): Promise<{ totalCost: number, itemCosts: Record<string, number> }> {
    let totalCost = 0;
    const itemCosts: Record<string, number> = {};
    const type = invoice.type || (invoice.customerId ? 'SALE' : 'PURCHASE');
    const items = invoice.items || [];
    const invoiceId = invoice.invoiceId || invoice.id;
    const isReturn = invoice.isReturn || invoice.invoiceType === 'مرتجع';

    if (type === 'SALE') {
      if (isReturn) {
        // Sale Return: Restore stock (Add as a new layer with original cost if possible)
        for (const item of items) {
          // We use the item.price as fallback cost, but ideally we should track original cost
          const returnCost = item.cost || item.price; 
          await this.addPurchaseLayer(item.product_id, item.qty, returnCost, invoiceId);
          itemCosts[item.product_id] = item.qty * returnCost;
          totalCost += itemCosts[item.product_id];
        }
      } else {
        for (const item of items) {
          const result = await this.consumeFIFO(invoiceId, item.product_id, item.qty);
          totalCost += result.totalCost;
          itemCosts[item.product_id] = result.totalCost;
        }
      }
    } else if (type === 'PURCHASE') {
      if (isReturn) {
        // Purchase Return: Reduce stock (Consume FIFO layers)
        for (const item of items) {
          const result = await this.consumeFIFO(invoiceId, item.product_id, item.qty);
          totalCost += result.totalCost;
          itemCosts[item.product_id] = result.totalCost;
        }
      } else {
        for (const item of items) {
          await this.addPurchaseLayer(item.product_id, item.qty, item.price, invoiceId);
          itemCosts[item.product_id] = item.qty * item.price;
        }
      }
    }

    return { totalCost, itemCosts };
  }
}
