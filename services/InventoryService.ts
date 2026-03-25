
import { db } from './database';
import { Warehouse, WarehouseStock, InventoryTransaction, Product, InventoryTransactionType, StockReservation, FIFOCostLayer } from '../types';
import { ValidationError } from '../types';

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

    // 2. FIFO Costing Logic
    if (quantity > 0 && sourceDocType === 'PURCHASE') {
      // Add new cost layer
      const unitCost = await this.calculateUnitCost(productId, sourceDocId);
      await db.db.fifoCostLayers.put({
        id: db.generateId('FIFO'),
        productId,
        warehouseId,
        purchaseDocId: sourceDocId,
        initialQuantity: quantity,
        remainingQuantity: quantity,
        unitCost,
        date: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });
    } else if (quantity < 0) {
      // Consume cost layers
      await this.consumeFIFOLayers(productId, warehouseId, Math.abs(quantity));
    }

    // 3. Record Transaction
    const tx: InventoryTransaction = {
      TransactionID: db.generateId('INV_TX'),
      ItemID: productId,
      SourceDocumentType: sourceDocType,
      SourceDocumentID: sourceDocId,
      QuantityChange: quantity,
      TransactionType: type,
      TransactionDate: new Date().toISOString(),
      UserID: userId,
      notes,
      lastModified: new Date().toISOString()
    };
    await db.db.inventoryTransactions.put(tx);

    // 4. Update Global Product Stock
    const product = await db.db.products.get(productId);
    if (product) {
      const newStock = (product.StockQuantity || 0) + quantity;
      const newCost = await this.getAverageCost(productId);
      await db.db.products.update(productId, {
        StockQuantity: newStock,
        CostPrice: newCost
      });

      // 5. Update Denormalized Inventory Collection (User Request)
      const updatedProduct = await db.db.products.get(productId);
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
    const purchase = await db.db.purchases.get(purchaseId);
    const item = purchase?.items.find(i => i.product_id === productId);
    return item?.price || 0;
  }

  private static async consumeFIFOLayers(productId: string, warehouseId: string, qtyToConsume: number) {
    const layers = await db.db.fifoCostLayers
      .where('[productId+warehouseId]')
      .equals([productId, warehouseId])
      .filter(l => l.remainingQuantity > 0)
      .sortBy('date');

    let remainingToConsume = qtyToConsume;
    for (const layer of layers) {
      if (remainingToConsume <= 0) break;

      const consumed = Math.min(layer.remainingQuantity, remainingToConsume);
      await db.db.fifoCostLayers.update(layer.id, {
        remainingQuantity: layer.remainingQuantity - consumed,
        lastModified: new Date().toISOString()
      });
      remainingToConsume -= consumed;
    }
  }

  static async getAverageCost(productId: string): Promise<number> {
    const layers = await db.db.fifoCostLayers.where('productId').equals(productId).toArray();
    const activeLayers = layers.filter(l => l.remainingQuantity > 0);
    if (activeLayers.length === 0) return 0;

    const totalValue = activeLayers.reduce((sum, l) => sum + (l.remainingQuantity * l.unitCost), 0);
    const totalQty = activeLayers.reduce((sum, l) => sum + l.remainingQuantity, 0);
    return totalValue / totalQty;
  }

  static async getProductCost(productId: string): Promise<number> {
    return await this.getAverageCost(productId);
  }

  static async validateStockAvailability(warehouseId: string, productId: string, requiredQty: number) {
    const available = await this.getWarehouseStock(warehouseId, productId);
    if (available < requiredQty) {
      const product = await db.db.products.get(productId);
      throw new ValidationError(`عجز مخزني: الصنف [${product?.Name}] غير متوفر بالكمية المطلوبة. المتاح: ${available}`);
    }
  }

  static async syncInventory() {
    const products = await db.db.products.toArray();
    for (const p of products) {
      const status = p.StockQuantity <= 0 ? 'expired' : 
                     p.StockQuantity <= (p.MinLevel || 0) ? 'low_stock' : 'active';
      
      await db.db.inventory.put({
        itemId: p.ProductID,
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
}
