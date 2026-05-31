// ==========================================
// FILE: src/workers/inventory.worker.ts
// ==========================================

import { WorkerTask, WorkerResponse } from '../modules/workers/worker.types';

self.onmessage = (e: MessageEvent<WorkerTask>) => {
  const { id, type, payload } = e.data;
  const startTime = performance.now();

  try {
    let result: any;

    switch (type) {
      case 'FIFO': {
        const { invoice, layers } = payload;
        result = processFIFO(invoice, layers);
        break;
      }
      case 'FEFO': {
        const { invoice, batches } = payload;
        result = processFEFO(invoice, batches);
        break;
      }
      case 'INVENTORY_RECONCILIATION': {
        const { productId, movements, currentStock } = payload;
        result = processInventoryReconciliation(productId, movements, currentStock);
        break;
      }
      default:
        throw new Error(`Execution mismatch: Task type '${type}' is not supported by inventory.worker.`);
    }

    sendSuccess(id, result, startTime);
  } catch (error: any) {
    sendError(id, error.message || String(error), startTime);
  }
};

function sendSuccess(id: string, result: any, startTime: number) {
  const durationMs = performance.now() - startTime;
  self.postMessage({
    id,
    success: true,
    result,
    durationMs,
  } as WorkerResponse);
}

function sendError(id: string, error: string, startTime: number) {
  const durationMs = performance.now() - startTime;
  self.postMessage({
    id,
    success: false,
    error,
    durationMs,
  } as WorkerResponse);
}

/**
 * processFIFO: Allocates stock using First-In-First-Out algorithm on layers
 */
function processFIFO(invoice: any, allLayers: any[]) {
  const items = invoice.items || [];
  const invoiceId = invoice.invoiceId || invoice.id;
  const type = invoice.type || (invoice.customerId ? 'SALE' : 'PURCHASE');
  const isReturn = invoice.isReturn || invoice.invoiceType === 'مرتجع';
  
  let totalCost = 0;
  const itemCosts: Record<string, number> = {};
  
  const updatedLayers: any[] = [];
  const consumptionLogs: any[] = [];

  // Index layers by item_id
  const layersByItem: Record<string, any[]> = {};
  for (const layer of allLayers) {
    if (!layer || !layer.item_id) continue;
    const itemId = layer.item_id;
    if (!layersByItem[itemId]) {
      layersByItem[itemId] = [];
    }
    layersByItem[itemId].push({ ...layer });
  }

  // Sort each item's layers by created_at ascending
  for (const itemId in layersByItem) {
    const itemL = layersByItem[itemId];
    if (itemL) {
      itemL.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
  }

  // If sale (or purchase return) we consume layers
  const isConsumption = (type === 'SALE' && !isReturn) || (type === 'PURCHASE' && isReturn);

  if (isConsumption) {
    for (const item of items) {
      let remainingToConsume = item.qty;
      const itemId = item.product_id;
      let itemTotalCost = 0;

      const layers = layersByItem[itemId] || [];
      const activeLayers = layers.filter(l => l.quantity_remaining > 0);

      for (const layer of activeLayers) {
        if (remainingToConsume <= 0) break;

        let consumedFromThisLayer = 0;

        if (layer.quantity_remaining >= remainingToConsume) {
          consumedFromThisLayer = remainingToConsume;
          itemTotalCost += consumedFromThisLayer * layer.unit_cost;
          layer.quantity_remaining -= remainingToConsume;
          remainingToConsume = 0;
        } else {
          consumedFromThisLayer = layer.quantity_remaining;
          itemTotalCost += consumedFromThisLayer * layer.unit_cost;
          remainingToConsume -= layer.quantity_remaining;
          layer.quantity_remaining = 0;
        }

        updatedLayers.push(layer);
        consumptionLogs.push({
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          sale_id: invoiceId,
          item_id: itemId,
          layer_id: layer.id,
          quantity_consumed: consumedFromThisLayer,
          unit_cost: layer.unit_cost,
          consumed_at: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          tenant_id: 'TEN-DEV-001'
        });
      }

      if (remainingToConsume > 0) {
        throw new Error(`Insufficient stock for item ${itemId}. Missing ${remainingToConsume} units in FIFO Layers.`);
      }

      itemCosts[itemId] = itemTotalCost;
      totalCost += itemTotalCost;
    }
  } else {
    // Normal purchase or sale return: create layers
    for (const item of items) {
      const returnCost = item.cost || item.price;
      const itemId = item.product_id;
      const qty = item.qty;

      const newLayer = {
        id: `LAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        item_id: itemId,
        quantity_remaining: qty,
        unit_cost: returnCost,
        created_at: new Date().toISOString(),
        reference_id: invoiceId,
        lastModified: new Date().toISOString(),
        tenant_id: 'TEN-DEV-001'
      };

      updatedLayers.push(newLayer);
      itemCosts[itemId] = qty * returnCost;
      totalCost += itemCosts[itemId];
    }
  }

  return {
    totalCost,
    itemCosts,
    updatedLayers,
    consumptionLogs
  };
}

/**
 * processFEFO: First Expired First Out batch depletion (essential for pharmaceuticals)
 */
function processFEFO(invoice: any, allBatches: any[]) {
  const items = invoice.items || [];
  const invoiceId = invoice.invoiceId || invoice.id;
  const type = invoice.type || (invoice.customerId ? 'SALE' : 'PURCHASE');
  const isReturn = invoice.isReturn || invoice.invoiceType === 'مرتجع';
  
  let totalCost = 0;
  const itemCosts: Record<string, number> = {};
  
  const updatedBatches: any[] = [];
  const consumptionLogs: any[] = [];

  // Group batches by product ID
  const batchesByProduct: Record<string, any[]> = {};
  for (const batch of allBatches) {
    if (!batch || !batch.productId) continue;
    const prodId = batch.productId;
    if (!batchesByProduct[prodId]) {
      batchesByProduct[prodId] = [];
    }
    batchesByProduct[prodId].push({ ...batch });
  }

  // Sort batches by expiry date ASC, then creation/reception date ASC (FEFO strategy)
  for (const prodId in batchesByProduct) {
    const prodB = batchesByProduct[prodId];
    if (prodB) {
      prodB.sort((a, b) => {
        const expA = new Date(a.expiryDate).getTime();
        const expB = new Date(b.expiryDate).getTime();
        if (expA !== expB) return expA - expB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
  }

  const isConsumption = (type === 'SALE' && !isReturn) || (type === 'PURCHASE' && isReturn);

  if (isConsumption) {
    for (const item of items) {
      let remainingToConsume = item.qty;
      const prodId = item.product_id;
      let itemTotalCost = 0;

      const batches = batchesByProduct[prodId] || [];
      const activeBatches = batches.filter(b => b.quantity > 0);

      // Validate expiry dates first
      const today = new Date().getTime();
      for (const batch of activeBatches) {
        if (remainingToConsume <= 0) break;
        if (new Date(batch.expiryDate).getTime() < today) {
          // Warning logic or skip expired batch
          console.warn(`[FEFO Worker] Batch ${batch.batchNumber} has expired! Skipping or flagging for disposal.`);
        }

        let consumed = 0;
        if (batch.quantity >= remainingToConsume) {
          consumed = remainingToConsume;
          batch.quantity -= remainingToConsume;
          remainingToConsume = 0;
        } else {
          consumed = batch.quantity;
          remainingToConsume -= batch.quantity;
          batch.quantity = 0;
        }

        updatedBatches.push(batch);
        consumptionLogs.push({
          id: `FEFO-LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          invoiceId,
          productId: prodId,
          batchId: batch.id,
          quantity: consumed,
          createdAt: new Date().toISOString()
        });

        // Use batch unit cost if available, otherwise fallback to item price
        const cost = batch.unitCost || item.price || 0;
        itemTotalCost += consumed * cost;
      }

      if (remainingToConsume > 0) {
        throw new Error(`Insufficient stock for product ${prodId} under FEFO priority. Missing ${remainingToConsume} units.`);
      }

      itemCosts[prodId] = itemTotalCost;
      totalCost += itemTotalCost;
    }
  }

  return {
    totalCost,
    itemCosts,
    updatedBatches,
    consumptionLogs
  };
}

/**
 * processInventoryReconciliation: Compares stock movements ledger against physical stock calculations
 */
function processInventoryReconciliation(productId: string, movements: any[], currentStock: number) {
  // Sum movements
  const movementSum = (movements || []).reduce((acc, m) => acc + (m.quantity_change || 0), 0);
  const discrepancy = Math.abs(currentStock - movementSum);
  const reconciled = discrepancy < 0.001;

  return {
    productId,
    calculatedStock: movementSum,
    discrepancy,
    reconciled
  };
}
