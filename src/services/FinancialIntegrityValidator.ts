
import { db } from '../lib/database';
import { ValidationError, AccountingError, InvoiceItem } from '../types';
import { AccountStatementRepository } from '../repositories/AccountStatementRepository';
import { SupplierRepository } from './repositories/SupplierRepository';
import { InvoiceRepository } from './repositories/invoice.repository';

/**
 * FinancialIntegrityValidator - حارس النزاهة المالية السيادي
 * يقوم بتنفيذ فحوصات المطابقة الصارمة قبل ترحيل أي بيانات
 */
export const FinancialIntegrityValidator = {
  
  /**
   * 1. التحقق من مطابقة رصيد الشريك مع دفتر الأستاذ (Subledger Verification)
   */
  async validatePartnerBalanceIntegrity(partnerId: string): Promise<void> {
    if (!partnerId || partnerId === 'عميل نقدي') return;

    const type = partnerId.startsWith('S') ? 'S' : 'C';
    const partner = await SupplierRepository.getById(partnerId, type);
    if (!partner) return;

    const statement = await AccountStatementRepository.getStatement(
      partner.Supplier_Name, 
      type === 'S' ? 'Supplier' : 'Customer'
    );
    
    const computedBalance = statement.length > 0 
      ? statement[statement.length - 1].runningBalance 
      : (partner.openingBalance || 0);
    
    // السماح بهامش خطأ محاسبي بسيط (Rounding Margin)
    if (Math.abs(computedBalance - partner.Balance) > 0.05) {
      throw new AccountingError(
        `فشل نزاهة الحساب: رصيد [${partner.Supplier_Name}] غير متطابق. (دفتر الأستاذ: ${computedBalance}، السجل الحالي: ${partner.Balance}) ⚠️`
      );
    }
  },

  /**
   * 2. التحقق من مطابقة إجمالي المستند مع مجموع البنود (Document Math Integrity)
   */
  validateInvoiceMath(items: InvoiceItem[], claimedTotal: number): void {
    if (!items || items.length === 0) return;

    const calculatedSum = items.reduce((acc, it) => acc + (it.sum || 0), 0);
    
    // التحقق من أن المجموع الرياضي الفعلي للأسطر يطابق الإجمالي المعلن
    // السماح بفرق بسيط للضرائب أو الخصومات التي قد تكون خارج الأسطر
    if (Math.abs(calculatedSum - claimedTotal) > 0.5) {
      throw new ValidationError(
        `خطأ في نزاهة البيانات: مجموع بنود الفاتورة (${calculatedSum.toLocaleString()}) لا يطابق الإجمالي الكلي الممرر (${claimedTotal.toLocaleString()}).`
      );
    }
  },

  /**
   * 3. التحقق من أن تخصيصات السند لا تتجاوز أرصدة الفواتير (Allocation Integrity)
   */
  async validateVoucherAllocations(allocations: Record<string, number>): Promise<void> {
    if (!allocations || Object.keys(allocations).length === 0) return;

    for (const invId in allocations) {
      const amount = allocations[invId];
      if (amount <= 0) continue;

      const inv = await InvoiceRepository.getUnifiedInvoice(invId);
      if (!inv) throw new ValidationError(`فشل الربط: المستند #${invId} غير موجود في النظام.`);

      // حساب المتبقي الفعلي (Total - Paid)
      const remaining = inv.finalTotal - inv.paidAmount;
      
      if (amount > parseFloat(remaining.toFixed(2)) + 0.01) {
        throw new ValidationError(
          `تجاوز حدود السداد: المبلغ المخصص للفاتورة #${invId} هو (${amount.toLocaleString()}) بينما المتبقي منها فعلياً هو (${remaining.toLocaleString()}).`
        );
      }
    }
  }
};
