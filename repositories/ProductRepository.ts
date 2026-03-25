
import { db } from '../services/database';
import { Product, InventoryError, InventoryTransaction, PriceHistory, Purchase } from '../types';
import { ReferentialIntegrityGuard } from '../services/validators/ReferentialIntegrityGuard';
import { authService } from '../services/auth.service';
import { useAppStore } from '../store/useAppStore';
import { PriceHistoryRepository } from './PriceHistoryRepository';
import { PurchaseRepository } from './PurchaseRepository';

export const ProductRepository = {
  getAll: async (options: { limit?: number, offset?: number } = {}): Promise<Product[]> => {
    const { limit, offset } = options;
    const all = await db.getProducts();
    let filtered = all.filter(p => p.Is_Active !== false);
    
    if (offset !== undefined) filtered = filtered.slice(offset);
    if (limit !== undefined) filtered = filtered.slice(0, limit);
    
    return filtered;
  },

  getById: async (id: string): Promise<Product | undefined> => {
    if (!id) return undefined;
    const all = await db.getProducts();
    return all.find(p => p.ProductID === id || p.id === id);
  },

  getByBarcode: async (barcode: string): Promise<Product | undefined> => {
    if (!barcode) return undefined;
    const all = await db.getProducts();
    return all.find(p => p.barcode === barcode);
  },

  search: async (term: string, limit: number = 50): Promise<Product[]> => {
    if (!term) return [];
    const lowerTerm = term.toLowerCase();
    const all = await db.getProducts();
    return all
      .filter(p => 
        p.Is_Active !== false && (
          p.Name.toLowerCase().includes(lowerTerm) || 
          p.ProductID.toLowerCase().includes(lowerTerm) ||
          (p.barcode && p.barcode.includes(term))
        )
      )
      .slice(0, limit);
  },

  updateStock: async (productId: string, quantityChange: number, sourceDocType: any = 'ADJUSTMENT', sourceDocId: string = 'SYS-ADJ', txType: any = 'ADJUSTMENT') => {
    if (!productId) return;
    const user = authService.getCurrentUser();
    const now = new Date().toISOString();
    
    const product = await ProductRepository.getById(productId);
    if (!product) {
      throw new InventoryError(`الصنف [${productId}] غير موجود في قاعدة بيانات المخزون.`);
    }

    // التحقق من العجز المخزني (إلا في حالة المرتجع أو التسوية الإيجابية)
    if (product.StockQuantity + quantityChange < 0 && txType !== 'RETURN' && txType !== 'INITIAL') {
      throw new InventoryError(`عجز مخزني في [${product.Name}]: المتاح ${product.StockQuantity}، المطلوب ${Math.abs(quantityChange)}.`);
    }

    const transaction: InventoryTransaction = {
      TransactionID: db.generateId('IVT'),
      ItemID: product.ProductID,
      SourceDocumentType: sourceDocType,
      SourceDocumentID: sourceDocId,
      QuantityChange: quantityChange,
      TransactionType: txType,
      TransactionDate: now,
      UserID: user?.User_Email || 'SYSTEM',
      Created_At: now,
      Created_By: user?.User_Email || 'SYSTEM',
      lastModified: now
    };

    await db.db.inventoryTransactions.add(transaction);

    product.StockQuantity += quantityChange;
    product.lastModified = now;
    await db.db.products.put(product);
  },

  save: async (product: Product) => {
    if (product.Is_Active === undefined) product.Is_Active = true;
    
    // التحقق من وجود فرق بين الرصيد المدخل والرصيد الحالي لإنشاء حركة تسوية آليا
    const existing = await ProductRepository.getById(product.ProductID);
    if (existing) {
      const diff = (product.StockQuantity || 0) - (existing.StockQuantity || 0);
      if (Math.abs(diff) > 0.001) {
        await ProductRepository.updateStock(product.ProductID, diff, 'ADJUSTMENT', 'MANUAL-EDIT', 'INITIAL');
      }
    } else {
      // صنف جديد برصيد افتتاحي
      if (product.StockQuantity > 0) {
        await ProductRepository.updateStock(product.ProductID, product.StockQuantity, 'ADJUSTMENT', 'INITIAL-SETUP', 'INITIAL');
      }
    }

    await db.saveProduct(product);
  },

  delete: async (id: string) => {
    if (!id) return;
    const product = await ProductRepository.getById(id);
    if (!product) return;

    const hasRefs = await ReferentialIntegrityGuard.checkProductReferences(product.ProductID);
    
    if (hasRefs) {
      product.Is_Active = false as any; // logical delete
      product.lastModified = new Date().toISOString();
      await db.db.products.put(product);
      useAppStore.getState().addToast(`تم تعطيل الصنف [${product.Name}] بدلاً من حذفه لوجود ارتباطات سجلية 🛡️`, 'info');
    } else {
      await db.db.products.delete(id);
      useAppStore.getState().addToast(`تم حذف الصنف بنجاح`, 'success');
    }
  },

  calculateCurrentBalance: async (productId: string): Promise<number> => {
    const txs = await db.db.inventoryTransactions.where('ItemID').equals(productId).toArray();
    return txs.reduce((sum, tx) => sum + (tx.QuantityChange || 0), 0);
  },

  getPriceHistory: async (productId: string, limit: number = 5): Promise<PriceHistory[]> => {
    return await PriceHistoryRepository.getRecentInsights(productId, limit);
  },

  getPurchaseHistory: async (productId: string, limit: number = 5): Promise<Purchase[]> => {
    return await PurchaseRepository.getItemPurchaseHistory(productId, limit);
  }
};
