
import { db } from '@/core/db';
import { InvoiceAdjustment } from '@/types';

/**
 * AdjustmentRepository - إدارة الخصومات والرسوم الإضافية والضرائب
 */
export const AdjustmentRepository = {
  
  async getAll(): Promise<InvoiceAdjustment[]> {
    return await db.db.invoiceAdjustments.toArray();
  },

  async getByInvoice(invoiceId: string): Promise<InvoiceAdjustment[]> {
    return await db.db.invoiceAdjustments.where('InvoiceID').equals(invoiceId).toArray();
  },

  async save(adjustment: InvoiceAdjustment): Promise<void> {
    const data = {
      ...adjustment,
      lastModified: new Date().toISOString()
    };
    await db.db.invoiceAdjustments.put(data);
  },

  async delete(id: string): Promise<void> {
    await db.db.invoiceAdjustments.delete(id);
  },

  /**
   * حساب الإجمالي النهائي للفاتورة مع تطبيق التعديلات
   */
  async calculateFinalTotal(invoiceId: string, baseTotal: number, taxRate: number = 0): Promise<number> {
    const adjustments = await this.getByInvoice(invoiceId);
    
    let total = baseTotal;
    
    // Apply Discounts first
    const discounts = adjustments.filter(a => a.Type === 'Discount');
    for (const d of discounts) {
      if (d.IsPercentage) {
        total -= (baseTotal * (d.Value / 100));
      } else {
        total -= d.Value;
      }
    }

    // Apply Additional Fees
    const fees = adjustments.filter(a => a.Type === 'Additional Fee');
    for (const f of fees) {
      if (f.IsPercentage) {
        total += (baseTotal * (f.Value / 100));
      } else {
        total += f.Value;
      }
    }

    // Apply Tax
    const taxes = adjustments.filter(a => a.Type === 'Tax Adjustment');
    let taxAmount = baseTotal * (taxRate / 100);
    for (const t of taxes) {
      if (t.IsPercentage) {
        taxAmount += (baseTotal * (t.Value / 100));
      } else {
        taxAmount += t.Value;
      }
    }
    
    return parseFloat((total + taxAmount).toFixed(2));
  },

  async getSummary() {
    const all = await this.getAll();
    
    let totalDiscounts = 0;
    let totalFees = 0;
    let totalTaxes = 0;

    all.forEach(a => {
      // Note: This summary is simplified as it doesn't know the base totals for percentages
      // Usually summaries use the absolute values stored if calculated
      if (a.Type === 'Discount') totalDiscounts += a.Value;
      else if (a.Type === 'Additional Fee') totalFees += a.Value;
      else if (a.Type === 'Tax Adjustment') totalTaxes += a.Value;
    });

    return {
      totalDiscounts,
      totalFees,
      totalTaxes,
      netImpact: totalFees + totalTaxes - totalDiscounts,
      count: all.length
    };
  }
};
