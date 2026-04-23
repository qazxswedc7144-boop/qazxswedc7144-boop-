
import { db } from '../lib/database';
import { ValidationError } from '../types';
import { safeWhereEqual } from '../utils/dexieSafe';

/**
 * ReferentialIntegrityGuard - حارس الارتباطات السيادي
 * يمنع حذف البيانات المرتبطة بسجلات مالية أو مخزنية أخرى
 */
export const ReferentialIntegrityGuard = {
  
  /**
   * التحقق من وجود ارتباطات للصنف
   */
  async checkProductReferences(productId: string): Promise<boolean> {
    if (!productId) return false;
    // 1. فحص المبيعات
    const hasSales = await db.db.sales.filter(s => s.items.some(it => it.product_id === productId)).count() > 0;
    if (hasSales) return true;

    // 2. فحص المشتريات
    const hasPurchases = await db.db.purchases.filter(p => p.items.some(it => it.product_id === productId)).count() > 0;
    if (hasPurchases) return true;

    // 3. فحص سجلات الاستخدام (Usage Logs)
    const hasUsage = (await safeWhereEqual(db.db.itemUsageLog, 'productId', productId)).length > 0;
    if (hasUsage) return true;

    // 4. فحص الحركات المخزنية المركزية
    const hasInventoryTx = (await safeWhereEqual(db.db.inventoryTransactions, 'productId', productId)).length > 0;
    if (hasInventoryTx) return true;

    return false;
  },

  /**
   * التحقق من وجود ارتباطات للشريك (مورد أو عميل)
   */
  async checkPartnerReferences(partnerId: string): Promise<boolean> {
    if (!partnerId) return false;

    // 1. فحص الفواتير (مبيعات أو مشتريات)
    const hasSales = (await safeWhereEqual(db.db.sales, 'customerId', partnerId)).length > 0;
    const hasPurchases = (await safeWhereEqual(db.db.purchases, 'partnerId', partnerId)).length > 0;
    if (hasSales || hasPurchases) return true;

    // 2. فحص الحركات المالية المركزية
    const hasFinancials = (await safeWhereEqual(db.db.financialTransactions, 'Entity_Name', partnerId)).length > 0;
    if (hasFinancials) return true;

    // 3. فحص السندات (عبر سجلات الكاش فلو)
    const hasVouchers = await db.db.cashFlow.filter(cf => cf.notes?.includes(partnerId) || false).count() > 0;
    if (hasVouchers) return true;

    return false;
  },

  /**
   * التحقق من وجود ارتباطات للحساب
   */
  async checkAccountReferences(accountId: string): Promise<boolean> {
    if (!accountId) return false;
    // 1. فحص قيود اليومية
    const hasEntries = await db.db.journalEntries.filter(e => e.lines.some(l => l.accountId === accountId)).count() > 0;
    if (hasEntries) return true;

    // 2. فحص الحسابات الأبناء (Hierarchy)
    const hasChildren = (await safeWhereEqual(db.db.accounts, 'parentId', accountId)).length > 0;
    if (hasChildren) return true;

    return false;
  }
};
