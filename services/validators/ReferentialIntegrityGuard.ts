
import { db } from '../database';
import { ValidationError } from '../../types';

/**
 * ReferentialIntegrityGuard - حارس الارتباطات السيادي
 * يمنع حذف البيانات المرتبطة بسجلات مالية أو مخزنية أخرى
 */
export const ReferentialIntegrityGuard = {
  
  /**
   * التحقق من وجود ارتباطات للصنف
   */
  async checkProductReferences(productId: string): Promise<boolean> {
    // 1. فحص المبيعات
    const hasSales = await db.db.sales.filter(s => s.items.some(it => it.product_id === productId)).count() > 0;
    if (hasSales) return true;

    // 2. فحص المشتريات
    const hasPurchases = await db.db.purchases.filter(p => p.items.some(it => it.product_id === productId)).count() > 0;
    if (hasPurchases) return true;

    // 3. فحص سجلات الاستخدام (Usage Logs)
    const hasUsage = await db.db.itemUsageLog.where('productId').equals(productId).count() > 0;
    if (hasUsage) return true;

    // 4. فحص الحركات المخزنية المركزية
    const hasInventoryTx = await db.db.inventoryTransactions.where('ItemID').equals(productId).count() > 0;
    if (hasInventoryTx) return true;

    return false;
  },

  /**
   * التحقق من وجود ارتباطات للشريك (مورد أو عميل)
   */
  async checkPartnerReferences(partnerId: string): Promise<boolean> {
    const partnerName = partnerId; // قد يستخدم النظام المعرف أو الاسم في بعض الحقول

    // 1. فحص الفواتير (مبيعات أو مشتريات)
    const hasSales = await db.db.sales.where('customerId').equals(partnerId).count() > 0;
    const hasPurchases = await db.db.purchases.where('partnerId').equals(partnerId).count() > 0;
    if (hasSales || hasPurchases) return true;

    // 2. فحص الحركات المالية المركزية
    const hasFinancials = await db.db.financialTransactions.where('Entity_Name').equals(partnerId).count() > 0;
    if (hasFinancials) return true;

    // 3. فحص السندات (عبر سجلات الكاش فلو)
    const hasVouchers = await db.db.cashFlow.filter(cf => cf.notes?.includes(partnerId) || false).count() > 0;
    if (hasVouchers) return true;

    return false;
  }
};
