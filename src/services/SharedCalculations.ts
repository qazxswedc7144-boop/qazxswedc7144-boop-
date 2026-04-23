
import { InvoiceItem, PaymentStatus } from '../types';

/**
 * SharedCalculations - المحرك الرياضي الموحد للنظام
 */
export const SharedCalculations = {
  /**
   * حساب إجمالي البنود قبل الخصومات والضرائب
   */
  calculateSubtotal: (items: InvoiceItem[]): number => {
    return items.reduce((acc, item) => acc + (item.sum || 0), 0);
  },

  /**
   * حساب الإجمالي النهائي (معادلة الفاتورة السيادية)
   * Formula: [Subtotal] - ([Subtotal] * ([Discount]/100)) + [Fees] + [Tax]
   */
  calculateGrandTotal: (subtotal: number, discountPercent: number, otherFees: number, tax: number): number => {
    const discountAmount = subtotal * (Math.abs(discountPercent) / 100);
    const result = subtotal - discountAmount + Number(otherFees) + Number(tax);
    return parseFloat(result.toFixed(2));
  },

  /**
   * تحديد حالة السداد بناءً على المبالغ المدفوعة
   * Logic: IF([Paid] >= [Total], "Paid", IF([Paid] > 0, "Partially Paid", "Unpaid"))
   */
  derivePaymentStatus: (paid: number, total: number): PaymentStatus => {
    const p = parseFloat(paid.toFixed(2));
    const t = parseFloat(total.toFixed(2));
    if (p <= 0) return 'Unpaid';
    if (p < t - 0.01) return 'Partially Paid';
    return 'Paid';
  },

  /**
   * حساب صافي الأثر المالي للتعديلات
   */
  calculateAdjustmentImpact: (adjustments: any[]): number => {
    return adjustments.reduce((acc, adj) => acc + (adj.Value || 0), 0);
  },

  /**
   * حساب أعمار الفواتير (Aging Analysis)
   * يضيف خاصية aging لكل فاتورة بناءً على تاريخها
   */
  calculateAging: (invoices: any[]): any[] => {
    const now = Date.now();
    return invoices.map(inv => {
      const date = inv.date || inv.Date || new Date().toISOString();
      const days = (now - new Date(date).getTime()) / (1000 * 60 * 60 * 24);

      if (days <= 30) return { ...inv, aging: '0-30' };
      if (days <= 60) return { ...inv, aging: '30-60' };

      return { ...inv, aging: '60+' };
    });
  }
};
