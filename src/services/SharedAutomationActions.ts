
import { InventoryService } from './InventoryService';
import { authService } from './auth.service';
import { ErrorManager } from './errorManager';
import { BusinessRulesEngine } from './BusinessRulesEngine';
import { db } from '../lib/database';

/**
 * SharedAutomationActions - محرك تنفيذ الإجراءات الآلية الموحد
 */
export const SharedAutomationActions = {
  /**
   * معالجة حركة المخزون الموحدة (Central Inventory Movement Engine)
   */
  applyInventoryMovement: async (items: any[], type: 'SALE' | 'PURCHASE', isReturn: boolean, docId: string) => {
    const user = authService.getCurrentUser();
    const userId = user?.User_Email || 'SYSTEM';
    const warehouseId = 'WH-MAIN'; // المستودع الافتراضي

    for (const item of items) {
      // استخدام BRE لحساب الكمية النهائية (مع مراعاة المرتجع والنوع)
      const changeQty = BusinessRulesEngine.inventory.calculateStockChange(item.qty, type, isReturn);
      
      // تحديد نوع الحركة لغرض التقارير
      let txType: any = isReturn ? 'RETURN' : (type === 'SALE' ? 'SALE' : 'PURCHASE');

      // توجيه الإجراء للمستودع المركزي عبر InventoryService لضمان تحديث أرصدة المستودعات
      await InventoryService.recordMovement({
        type: txType,
        productId: item.product_id,
        warehouseId,
        quantity: changeQty,
        sourceDocId: docId,
        sourceDocType: type,
        userId,
        notes: `Auto-generated from ${type} #${docId}`
      });
    }
  },

  /**
   * توثيق تاريخ المستند الموحد
   */
  syncDocumentHistory: async (invoiceId: string, action: 'CREATED' | 'POSTED' | 'CANCELLED', details: string) => {
    const user = authService.getCurrentUser();
    await db.addInvoiceHistory({
      invoiceId,
      userId: user?.User_Email || 'SYSTEM',
      userName: user?.User_Name || 'النظام',
      timestamp: new Date().toISOString(),
      action,
      details
    });
  },

  /**
   * تسجيل حركة مالية مركزية
   */
  recordCentralTransaction: async (data: any) => {
    try {
      const user = authService.getCurrentUser();
      const now = new Date().toISOString();
      const id = db.generateId('TRX');
      await db.db.financialTransactions.put({
        ...data,
        id: id,
        Transaction_ID: id,
        Created_At: now,
        Created_By: user?.User_Email || 'SYSTEM',
        lastModified: now
      });
    } catch (e: any) {
      ErrorManager.logAutomationError('Financial Sync Bot', e.message);
    }
  }
};
