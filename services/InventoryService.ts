
import { db } from './database';
import { authService } from './auth.service';
import { Warehouse, WarehouseStock, InventoryTransaction, Product, InventoryTransactionType, StockReservation } from '../types';
import { ValidationError } from '../types';
import { FIFOEngine } from './FIFOEngine';

export class InventoryService {
  
  static async getWarehouseStock(warehouseId: string, productId: string): Promise<number> {
    const stock = await db.db.warehouseStock.get(`${warehouseId}:${productId}`);
    const reserved = await this.getReservedQuantity(warehouseId, productId);
    return (stock?.quantity || 0) - reserved;
  }

  static async getReservedQuantity(warehouseId: string, productId: string): Promise<number> {
    const reservations = await db.db.stockReservations
      .where('[warehouseId+productId]')
      .equals([warehouseId, productId])
      .toArray();
    
    const now = new Date().toISOString();
    return reservations
      .filter(r => r.expiresAt > now)
      .reduce((sum, r) => sum + r.quantity, 0);
  }

  static async reserveStock(params: {
    productId: string;
    warehouseId: string;
    quantity: number;
    sourceDocId: string;
    ttlMinutes?: number;
  }) {
    const { productId, warehouseId, quantity, sourceDocId, ttlMinutes = 30 } = params;
    
    const available = await this.getWarehouseStock(warehouseId, productId);
    if (available < quantity) {
      throw new ValidationError("الكمية المطلوبة غير متوفرة حالياً (محجوزة أو غير موجودة).");
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    await db.db.stockReservations.put({
      id: db.generateId('RES'),
      productId,
      warehouseId,
      quantity,
      sourceDocId,
      expiresAt,
      lastModified: new Date().toISOString()
    });
  }

  static async releaseReservation(sourceDocId: string) {
    const reservations = await db.db.stockReservations.where('sourceDocId').equals(sourceDocId).toArray();
    for (const r of reservations) {
      await db.db.stockReservations.delete(r.id);
    }
  }

  static async recordMovement(params: {
    type: InventoryTransactionType;
    productId: string;
    warehouseId: string;
    quantity: number; // Positive for add, negative for deduct
    sourceDocId: string;
    sourceDocType: 'SALE' | 'PURCHASE' | 'ADJUSTMENT';
    userId: string;
    notes?: string;
  }) {
    const { type, productId, warehouseId, quantity, sourceDocId, sourceDocType, userId, notes } = params;

    // 1. Update Warehouse Stock
    const stockId = `${warehouseId}:${productId}`;
    const existingStock = await db.db.warehouseStock.get(stockId);
    
    if (existingStock) {
      const newQty = existingStock.quantity + quantity;
      if (newQty < 0) throw new ValidationError("لا يمكن إتمام العملية: ستؤدي إلى رصيد مخزني سالب.");
      await db.db.warehouseStock.update(stockId, { 
        quantity: newQty, 
        lastUpdated: new Date().toISOString() 
      });
    } else {
      if (quantity < 0) throw new ValidationError("لا يمكن الخصم من مستودع لا يحتوي على الصنف.");
      await db.db.warehouseStock.put({
        id: stockId,
        warehouseId,
        productId,
        quantity,
        lastUpdated: new Date().toISOString()
      });
    }

    // 2. FIFO Costing Logic (ENTERPRISE UPGRADE)
    if (quantity > 0 && sourceDocType === 'PURCHASE') {
      // Add new cost layer via FIFOEngine
      const unitCost = await this.calculateUnitCost(productId, sourceDocId);
      await FIFOEngine.addPurchaseLayer(productId, quantity, unitCost, new Date().toISOString(), sourceDocId);
    } else if (quantity < 0 && (sourceDocType === 'ADJUSTMENT' || sourceDocType === 'PURCHASE')) {
      // For manual adjustments (deductions) or purchase returns (deductions), we consume layers
      // Note: Sales are handled by transactionOrchestrator to capture the cost for the Sale object
      await FIFOEngine.consumeLayers(productId, Math.abs(quantity));
    }

    // 3. FEFO (First Expired First Out) - Deduct from batches
    if (quantity < 0) {
      let remainingToDeduct = Math.abs(quantity);
      const batches = await db.db.medicineBatches
        .where('[ProductID+warehouseId]')
        .equals([productId, warehouseId])
        .filter(b => b.Quantity > 0)
        .sortBy('ExpiryDate');

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;
        const deductFromBatch = Math.min(batch.Quantity, remainingToDeduct);
        await db.db.medicineBatches.update(batch.BatchID, {
          Quantity: batch.Quantity - deductFromBatch,
          lastUpdated: new Date().toISOString()
        });
        remainingToDeduct -= deductFromBatch;
      }
    }

    // 4. Record Transaction
    const before_qty = existingStock?.quantity || 0;
    const after_qty = before_qty + quantity;

    const tx: InventoryTransaction = {
      TransactionID: db.generateId('INV_TX'),
      ItemID: productId,
      SourceDocumentType: sourceDocType,
      SourceDocumentID: sourceDocId,
      QuantityChange: quantity,
      before_qty,
      after_qty,
      TransactionType: type,
      TransactionDate: new Date().toISOString(),
      UserID: userId,
      branchId: authService.getCurrentBranchId() || 'MAIN',
      notes,
      lastModified: new Date().toISOString()
    };
    await db.db.inventoryTransactions.put(tx);

    // 4. Update Global Product Stock
    const product = await db.db.products.where('ProductID').equals(productId).first();
    if (product) {
      const newStock = (product.StockQuantity || 0) + quantity;
      const newCost = await this.getAverageCost(productId);
      await db.db.products.where('ProductID').equals(productId).modify({
        StockQuantity: newStock,
        CostPrice: newCost
      });

      // 5. Update Denormalized Inventory Collection (User Request)
      const updatedProduct = await db.db.products.where('ProductID').equals(productId).first();
      if (updatedProduct) {
        const status = updatedProduct.StockQuantity <= 0 ? 'expired' : 
                       updatedProduct.StockQuantity <= (updatedProduct.MinLevel || 0) ? 'low_stock' : 'active';
        
        await db.db.inventory.put({
          itemId: updatedProduct.ProductID,
          itemName: updatedProduct.Name,
          category: updatedProduct.categoryName || 'عام',
          currentQuantity: updatedProduct.StockQuantity,
          minQuantity: updatedProduct.MinLevel || 0,
          unitPrice: updatedProduct.UnitPrice,
          totalValue: updatedProduct.StockQuantity * updatedProduct.CostPrice,
          lastUpdated: new Date().toISOString(),
          expiryDate: updatedProduct.ExpiryDate,
          status: status,
          lastModified: new Date().toISOString()
        });
      }
    }
  }

  private static async calculateUnitCost(productId: string, purchaseId: string): Promise<number> {
    const purchase = await db.db.purchases.where('purchase_id').equals(purchaseId).first();
    const item = purchase?.items.find(i => i.product_id === productId);
    return item?.price || 0;
  }

  static async getAverageCost(productId: string): Promise<number> {
    const layers = await db.db.fifoCostLayers.where('productId').equals(productId).toArray();
    const activeLayers = layers.filter(l => !l.isClosed);
    if (activeLayers.length === 0) return 0;

    const totalValue = activeLayers.reduce((sum, l) => sum + (l.quantityRemaining * l.unitCost), 0);
    const totalQty = activeLayers.reduce((sum, l) => sum + l.quantityRemaining, 0);
    return totalValue / totalQty;
  }

  static async getProductCost(productId: string): Promise<number> {
    return await this.getAverageCost(productId);
  }

  static async validateStockAvailability(warehouseId: string, productId: string, requiredQty: number) {
    const available = await this.getWarehouseStock(warehouseId, productId);
    if (available < requiredQty) {
      const product = await db.db.products.where('ProductID').equals(productId).first();
      throw new ValidationError(`عجز مخزني: الصنف [${product?.Name}] غير متوفر بالكمية المطلوبة. المتاح: ${available}`);
    }
  }

  static async syncInventory() {
    const products = await db.db.products.toArray();
    for (const p of products) {
      const status = p.StockQuantity <= 0 ? 'expired' : 
                     p.StockQuantity <= (p.MinLevel || 0) ? 'low_stock' : 'active';
      
      const itemId = p.ProductID || db.generateId('ITM');
      await db.db.inventory.put({
        itemId: itemId,
        itemName: p.Name,
        category: p.categoryName || 'عام',
        currentQuantity: p.StockQuantity,
        minQuantity: p.MinLevel || 0,
        unitPrice: p.UnitPrice,
        totalValue: p.StockQuantity * p.CostPrice,
        lastUpdated: new Date().toISOString(),
        expiryDate: p.ExpiryDate,
        status: status,
        lastModified: new Date().toISOString()
      });
    }
  }

  static async getBestBatchForSale(productId: string, warehouseId: string) {
    const batches = await db.db.medicineBatches
      .where('[ProductID+warehouseId]')
      .equals([productId, warehouseId])
      .filter(b => b.Quantity > 0 && new Date(b.ExpiryDate) > new Date())
      .sortBy('ExpiryDate');
    
    return batches[0] || null;
  }

  static async checkNearExpiryAlerts(days: number = 30) {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + days);
    
    const nearExpiry = await db.db.medicineBatches
      .filter(b => {
        const expiry = new Date(b.ExpiryDate);
        return expiry > today && expiry <= limitDate && b.Quantity > 0;
      })
      .toArray();

    for (const batch of nearExpiry) {
      await db.db.medicineAlerts.put({
        AlertID: `EXP-${batch.BatchID}`,
        ReferenceID: batch.ProductID,
        type: 'EXPIRY',
        message: `الصنف [${batch.ProductID}] تنتهي صلاحيته في ${batch.ExpiryDate}`,
        severity: 'HIGH',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      } as any);
    }
    
    return nearExpiry.length;
  }
}
