
import { db } from '../services/database';
import { Sale, Purchase, InvoiceItem, InvoiceStatus, UnifiedInvoice, PaymentStatus } from '../types';
import { InvoiceCounterRepository } from './InvoiceCounterRepository';
import { VoucherInvoiceLinkRepository } from './VoucherInvoiceLinkRepository';
import { SharedCalculations } from '../services/logic/SharedCalculations';
import { InvoiceValidationEngine } from '../services/logic/InvoiceValidationEngine';
import { InvoiceWorkflowEngine } from '../services/logic/InvoiceWorkflowEngine';
import { LockService } from '../services/LockService';
import { PostingEngine } from '../engines/postingEngine';

export const InvoiceRepository = {
  
  getUnifiedInvoice: async (id: string): Promise<UnifiedInvoice | null> => {
    const paidTotal = await VoucherInvoiceLinkRepository.getTotalPaidForInvoice(id);

    const sale = await db.db.sales.where('SaleID').equals(id).first() || await db.db.sales.get(id);
    if (sale) {
      const actualPaid = Math.max(paidTotal, sale.paidAmount || 0);
      const total = sale.finalTotal;
      return {
        id: sale.id,
        invoiceNumber: sale.SaleID,
        date: sale.date,
        partnerId: sale.customerId,
        partnerName: sale.customerId || 'عميل نقدي',
        type: 'SALE',
        subtotal: sale.subtotal || total,
        tax: sale.tax || 0,
        finalTotal: total,
        paidAmount: actualPaid,
        paymentStatus: sale.paymentStatus,
        financialStatus: SharedCalculations.derivePaymentStatus(actualPaid, total),
        documentStatus: sale.InvoiceStatus || 'PENDING',
        items: sale.items,
        isReturn: sale.isReturn || false,
        lastModified: sale.lastModified
      };
    }

    const purchase = await db.db.purchases.where('invoiceId').equals(id).first() || await db.db.purchases.where('purchase_id').equals(id).first() || await db.db.purchases.get(id);
    if (purchase) {
      const actualPaid = Math.max(paidTotal, purchase.paidAmount || 0);
      const total = purchase.totalAmount;
      return {
        id: purchase.id,
        invoiceNumber: purchase.invoiceId,
        date: purchase.date,
        partnerId: purchase.partnerId,
        partnerName: purchase.partnerName || purchase.partnerId,
        type: 'PURCHASE',
        subtotal: purchase.subtotal || total,
        tax: purchase.tax || 0,
        finalTotal: total,
        paidAmount: actualPaid,
        paymentStatus: purchase.status === 'PAID' ? 'Cash' : 'Credit',
        financialStatus: SharedCalculations.derivePaymentStatus(actualPaid, total),
        documentStatus: purchase.invoiceStatus || 'PENDING',
        items: purchase.items,
        isReturn: purchase.invoiceType === 'مرتجع',
        lastModified: purchase.lastModified
      };
    }
    return null;
  },

  /**
   * الفحص السيادي للارتباطات (Dependency Check)
   */
  checkHasDependencies: async (id: string, type: 'SALE' | 'PURCHASE'): Promise<boolean> => {
    const paidViaLinks = await VoucherInvoiceLinkRepository.getTotalPaidForInvoice(id);
    if (paidViaLinks > 0) return true;

    if (type === 'SALE') {
      const hasReturns = await db.db.sales.where('originalProvisionalId').equals(id).count() > 0;
      if (hasReturns) return true;
    } else {
      const hasReturns = await db.db.purchases.filter(p => p.invoiceType === 'مرتجع' && (p as any).originalInvoiceId === id).count() > 0;
      if (hasReturns) return true;
    }
    return false;
  },

  isNumberDuplicate: async (num: string, type: 'SALE' | 'PURCHASE', excludeId?: string | null): Promise<boolean> => {
    if (!num) return false;
    const normalized = num.trim().toUpperCase();
    if (type === 'SALE') {
      return await db.db.sales.where('SaleID').equals(normalized).filter(s => s.id !== excludeId).count() > 0;
    } else {
      return await db.db.purchases.where('invoiceId').equals(normalized).filter(p => p.id !== excludeId).count() > 0;
    }
  },

  getSafeUniqueNumber: async (type: 'SALE' | 'PURCHASE', isReturn: boolean = false): Promise<string> => {
    const counterKey = type === 'SALE' ? 'Sales' : 'Purchase';
    const prefix = type === 'SALE' ? 'INV-' : 'P';
    const nextSeq = await InvoiceCounterRepository.getNextNumber(counterKey as any, 1000);
    return `${prefix}${isReturn ? 'R' : ''}${nextSeq}`;
  },

  /**
   * جلب الأرشيف مع دعم التحميل المؤجل والتقسيم السنوي
   */
  getInvoicesArchive: async (options: { year?: number, limit?: number, offset?: number } = {}) => {
    const { year, limit = 50, offset = 0 } = options;
    
    let salesQuery = db.db.sales.orderBy('date').reverse();
    let purchaseQuery = db.db.purchases.orderBy('date').reverse();

    if (year) {
      const startDate = `${year}-01-01T00:00:00.000Z`;
      const endDate = `${year}-12-31T23:59:59.999Z`;
      salesQuery = db.db.sales.where('date').between(startDate, endDate).reverse();
      purchaseQuery = db.db.purchases.where('date').between(startDate, endDate).reverse();
    }

    const [allSales, allPurchases] = await Promise.all([
      salesQuery.offset(offset).limit(limit).toArray(),
      purchaseQuery.offset(offset).limit(limit).toArray()
    ]);

    const formatted = [
      ...allSales.map(s => ({ ...s, entityType: 'SALE' as const })),
      ...allPurchases.map(p => ({ ...p, entityType: 'PURCHASE' as const }))
    ];

    return formatted
      .filter(i => (i as any).isDeleted !== true)
      .sort((a, b) => new Date((b as any).date || (b as any).Date).getTime() - new Date((a as any).date || (a as any).Date).getTime());
  },

  getAllSales: async (): Promise<Sale[]> => await db.getSales(),
  getSaleById: async (id: string) => await db.db.sales.where('SaleID').equals(id).first() || await db.db.sales.get(id),
  saveSale: async (cId: string, items: any[], total: number, isR: boolean, inv: string, curr: string, st: string, invSt: InvoiceStatus = 'PENDING', auditScore?: number, riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH', totalSaleCost?: number, pid?: string, attachment?: string) => {
    return await db.runTransaction(async () => {
      const invoiceData = { id: pid || inv, customerId: cId, items, finalTotal: total, date: new Date().toISOString(), attachment };
      
      // Phase 7: Day Lock System (تم استبداله بـ PeriodLockEngine في المنسق)
      // if (await db.isDateLocked(invoiceData.date)) {
      //   throw new Error("Accounting period closed (الفترة المحاسبية مغلقة)");
      // }

      // Phase 1: State Engine Validation
      const recordId = pid || inv;
      if (recordId) {
        if (await LockService.isLockedByOther('sales', recordId)) {
          throw new Error("هذا السجل مقفل حالياً بواسطة مستخدم آخر 🔒");
        }
        const existing = await InvoiceRepository.getSaleById(recordId);
        if (existing) {
          if (InvoiceWorkflowEngine.isLocked(existing.InvoiceStatus || 'PENDING')) {
            throw new Error("Invoice is locked (الفاتورة مقفلة ولا يمكن تعديلها)");
          }

          // NEW: Unpost before edit if already posted
          if (existing.InvoiceStatus === 'POSTED') {
            await PostingEngine.unpostInvoice(recordId);
          }

          // Phase 8: Financial Link Protection (User Request)
          const paidViaLinks = await VoucherInvoiceLinkRepository.getTotalPaidForInvoice(recordId);
          if (paidViaLinks > 0) {
            // If total or items changed, block it. 
            // We can compare the incoming total with existing total.
            if (existing.finalTotal !== total) {
              throw new Error("يمنع تعديل إجمالي الفاتورة لارتباطها بسندات مالية. يسمح فقط بتعديل الملاحظات 🔒");
            }
            // Also check if items changed (simplified check: just check if total is same for now, 
            // but usually items change implies total change or at least risk)
            // The user specifically said "يمنع تعديل الإجمالي -> يسمح فقط بالملاحظات"
          }
        }
        await LockService.acquireLock('sales', recordId);
      }

      // Phase 2 & 3: Validation & Hashing
      const hash = await InvoiceValidationEngine.validate(invoiceData, 'SALE');
      
      const result = await db.processSale(cId, items, total, isR, inv, curr, st, pid, invSt, hash, auditScore, riskLevel, totalSaleCost, attachment);
      
      // NEW: Automatic Posting
      const sale = await InvoiceRepository.getSaleById(result.id);
      if (sale) {
        await PostingEngine.postInvoice(sale);
      }

      if (recordId) await LockService.releaseLock('sales', recordId);
      return result;
    });
  },
  savePurchase: async (sId: string, items: any[], total: number, inv: string, isC: boolean, curr: string = 'USD', invSt: InvoiceStatus = 'PENDING', auditScore?: number, riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH', pid?: string, attachment?: string) => {
    return await db.runTransaction(async () => {
      const invoiceData = { id: pid || inv, partnerId: sId, items, totalAmount: total, date: new Date().toISOString(), attachment };
      
      // Phase 7: Day Lock System (تم استبداله بـ PeriodLockEngine في المنسق)
      // if (await db.isDateLocked(invoiceData.date)) {
      //   throw new Error("Accounting period closed (الفترة المحاسبية مغلقة)");
      // }

      // Phase 1: State Engine Validation
      const recordId = pid || inv;
      if (recordId) {
        if (await LockService.isLockedByOther('purchases', recordId)) {
          throw new Error("هذا السجل مقفل حالياً بواسطة مستخدم آخر 🔒");
        }
        const existing = await InvoiceRepository.getPurchaseById(recordId);
        if (existing) {
          if (InvoiceWorkflowEngine.isLocked(existing.invoiceStatus || 'PENDING')) {
            throw new Error("Invoice is locked (الفاتورة مقفلة ولا يمكن تعديلها)");
          }

          // NEW: Unpost before edit if already posted
          if (existing.invoiceStatus === 'POSTED') {
            await PostingEngine.unpostInvoice(recordId);
          }

          // Phase 8: Financial Link Protection (User Request)
          const paidViaLinks = await VoucherInvoiceLinkRepository.getTotalPaidForInvoice(recordId);
          if (paidViaLinks > 0) {
            if (existing.totalAmount !== total) {
              throw new Error("يمنع تعديل إجمالي الفاتورة لارتباطها بسندات مالية. يسمح فقط بتعديل الملاحظات 🔒");
            }
          }
        }
        await LockService.acquireLock('purchases', recordId);
      }

      // Phase 2 & 3: Validation & Hashing
      const hash = await InvoiceValidationEngine.validate(invoiceData, 'PURCHASE');

      const result = await db.processPurchase(sId, items, total, inv, isC, curr, invSt, 'شراء', hash, auditScore, riskLevel, pid, attachment);
      
      // NEW: Automatic Posting
      const purchase = await InvoiceRepository.getPurchaseById(result.id);
      if (purchase) {
        await PostingEngine.postInvoice(purchase);
      }

      if (recordId) await LockService.releaseLock('purchases', recordId);
      return result;
    });
  },

  /**
   * Phase 4: Safe Delete System (Soft Delete)
   */
  cancelInvoice: async (id: string, type: 'SALE' | 'PURCHASE'): Promise<void> => {
    const now = new Date().toISOString();
    if (type === 'SALE') {
      if (await LockService.isLockedByOther('sales', id)) {
        throw new Error("هذا السجل مقفل حالياً بواسطة مستخدم آخر 🔒");
      }
      const sale = await db.db.sales.get(id);
      if (!sale) return;
      if (InvoiceWorkflowEngine.isLocked(sale.InvoiceStatus || 'PENDING')) {
        throw new Error("Invoice is locked (الفاتورة مقفلة ولا يمكن إلغاؤها)");
      }
      
      // NEW: Unpost before cancel
      if (sale.InvoiceStatus === 'POSTED') {
        await PostingEngine.unpostInvoice(id);
      }

      await LockService.acquireLock('sales', id);
      sale.InvoiceStatus = 'CANCELLED';
      sale.deleted_at = now;
      sale.isDeleted = true;
      await db.db.sales.put(sale);
      await db.addAuditLog('CANCEL', 'SALE', id, `Sale ${sale.SaleID} cancelled`);
      await LockService.releaseLock('sales', id);
    } else {
      if (await LockService.isLockedByOther('purchases', id)) {
        throw new Error("هذا السجل مقفل حالياً بواسطة مستخدم آخر 🔒");
      }
      const purchase = await db.db.purchases.get(id);
      if (!purchase) return;
      if (InvoiceWorkflowEngine.isLocked(purchase.invoiceStatus || 'PENDING')) {
        throw new Error("Invoice is locked (الفاتورة مقفلة ولا يمكن إلغاؤها)");
      }

      // NEW: Unpost before cancel
      if (purchase.invoiceStatus === 'POSTED') {
        await PostingEngine.unpostInvoice(id);
      }

      await LockService.acquireLock('purchases', id);
      purchase.invoiceStatus = 'CANCELLED';
      purchase.deleted_at = now;
      purchase.isDeleted = true;
      await db.db.purchases.put(purchase);
      await db.addAuditLog('CANCEL', 'PURCHASE', id, `Purchase ${purchase.invoiceId} cancelled`);
      await LockService.releaseLock('purchases', id);
    }
  },
  getPurchaseById: async (id: string) => await db.db.purchases.where('invoiceId').equals(id).first() || await db.db.purchases.where('purchase_id').equals(id).first() || await db.db.purchases.get(id),
  getArchiveSales: async () => await db.db.sales.where('InvoiceStatus').equals('Posted').toArray(),
  getArchivePurchases: async () => await db.db.purchases.where('invoiceStatus').equals('Posted').toArray(),
  getSavedInvoices: async () => await db.db.sales.where('InvoiceStatus').equals('Saved').toArray(),
  getRecentInvoices: async (limit: number = 20) => {
    return await InvoiceRepository.getInvoicesArchive({ limit });
  },
  getSalesArchive: async () => await db.getSales()
};
