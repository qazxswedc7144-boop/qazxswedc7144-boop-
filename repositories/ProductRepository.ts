
import { db } from '../services/database';
import { InventoryService } from '../services/InventoryService';
import { Product, InventoryError, InventoryTransaction, PriceHistory, Purchase } from '../types';
import { ReferentialIntegrityGuard } from '../services/validators/ReferentialIntegrityGuard';
import { authService } from '../services/auth.service';
import { useAppStore } from '../store/useAppStore';
import { PriceHistoryRepository } from './PriceHistoryRepository';
import { PurchaseRepository } from './PurchaseRepository';

export const ProductRepository = {
  getAll: async (options: { limit?: number, offset?: number, branchId?: string } = {}): Promise<Product[]> => {
    const { limit = 20, offset = 0, branchId } = options;
    const all = await db.getProducts();
    let filtered = all.filter(p => p.Is_Active !== false);
    
    if (branchId) {
      filtered = filtered.filter(p => p.branchId === branchId || !p.branchId);
    }

    return filtered.slice(offset, offset + limit);
  },

  getById: async (id: string): Promise<Product | undefined> => {
    if (!id) return undefined;
    const all = await db.getProducts();
    return all.find(p => p.id === id);
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
          p.id.toLowerCase().includes(lowerTerm) ||
          (p.barcode && p.barcode.includes(term))
        )
      )
      .slice(0, limit);
  },

  updateStock: async (productId: string, quantityChange: number, sourceDocType: any = 'ADJUSTMENT', sourceDocId: string = 'SYS-ADJ', txType: any = 'ADJUSTMENT') => {
    if (!productId) return;
    const user = authService.getCurrentUser();
    
    // Use InventoryService to record the movement and update stock
    await InventoryService.recordMovement({
      type: txType as any,
      productId: productId,
      warehouseId: 'WH-MAIN', // Default warehouse
      quantity: quantityChange,
      sourceId: sourceDocId,
      sourceType: sourceDocType,
      userId: user?.User_Email || 'SYSTEM'
    });
  },

  save: async (product: Product) => {
    if (product.Is_Active === undefined) product.Is_Active = true;
    
    // التحقق من وجود فرق بين الرصيد المدخل والرصيد الحالي لإنشاء حركة تسوية آليا
    const existing = await ProductRepository.getById(product.id);
    if (existing) {
      const diff = (product.StockQuantity || 0) - (existing.StockQuantity || 0);
      if (Math.abs(diff) > 0.001) {
        await ProductRepository.updateStock(product.id, diff, 'ADJUSTMENT', 'MANUAL-EDIT', 'INITIAL');
      }
    } else {
      // صنف جديد برصيد افتتاحي
      if (product.StockQuantity > 0) {
        await ProductRepository.updateStock(product.id, product.StockQuantity, 'ADJUSTMENT', 'INITIAL-SETUP', 'INITIAL');
      }
    }

    await db.saveProduct(product);
  },

  delete: async (id: string) => {
    if (!id) return;
    const product = await ProductRepository.getById(id);
    if (!product) return;

    const hasRefs = await ReferentialIntegrityGuard.checkProductReferences(product.id);
    
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
    if (!productId) return 0;
    const txs = await db.db.inventoryTransactions.where('productId').equals(productId).toArray();
    return txs.reduce((sum, tx) => sum + (tx.QuantityChange || 0), 0);
  },

  getPriceHistory: async (productId: string, limit: number = 5): Promise<PriceHistory[]> => {
    return await PriceHistoryRepository.getRecentInsights(productId, limit);
  },

  getPurchaseHistory: async (productId: string, limit: number = 5): Promise<Purchase[]> => {
    return await PurchaseRepository.getItemPurchaseHistory(productId, limit);
  },

  getItemAutoFillDetails: async (productId: string) => {
    if (!productId) return null;
    const product = await ProductRepository.getById(productId);
    if (!product) return null;

    const lastPurchase = await db.db.purchasesByItem
      .where('productId')
      .equals(productId)
      .reverse()
      .first();

    return {
      lastPrice: lastPurchase?.unitCost || product.UnitPrice || 0,
      category: product.categoryName || 'General',
      supplierId: lastPurchase?.supplierId || product.supplierId || '',
      supplierName: lastPurchase?.supplierId || '' 
    };
  },

  getExpiringSoon: async (days: number = 30): Promise<Product[]> => {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + days);
    
    const all = await db.getProducts();
    return all
      .filter(p => {
        if (!p.ExpiryDate) return false;
        const expiry = new Date(p.ExpiryDate);
        return expiry > today && expiry <= limitDate;
      })
      .sort((a, b) => new Date(a.ExpiryDate!).getTime() - new Date(b.ExpiryDate!).getTime());
  }
};
