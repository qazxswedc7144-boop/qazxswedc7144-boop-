
import { db } from '../services/database';
import { InvoiceAdjustment } from '../types';
import { periodService } from '../services/period.service';

const ADJ_TOTAL_CACHE = new Map<string, { val: number, timestamp: number }>();

export const AdjustmentRepository = {
  getAll: async (): Promise<InvoiceAdjustment[]> => {
    return await db.getInvoiceAdjustments();
  },

  getByInvoice: async (invoiceId: string): Promise<InvoiceAdjustment[]> => {
    return await db.getInvoiceAdjustments(invoiceId);
  },

  /**
   * Virtual Column: TotalAdjustments
   * Performance Rule: Cache calculated results
   */
  calculateTotalAdjustments: async (invoiceId: string): Promise<number> => {
    const cached = ADJ_TOTAL_CACHE.get(invoiceId);
    if (cached && Date.now() - cached.timestamp < 10000) return cached.val;

    const adjustments = await db.getInvoiceAdjustments(invoiceId);
    const total = adjustments.reduce((acc, adj) => acc + (adj.Value || 0), 0);
    
    ADJ_TOTAL_CACHE.set(invoiceId, { val: total, timestamp: Date.now() });
    return total;
  },

  /**
   * Virtual Column: FinalTotal
   * Rule: Use stored/cached totals where possible
   */
  calculateFinalTotal: async (invoiceId: string, subtotal: number, tax: number): Promise<number> => {
    const totalAdjustments = await AdjustmentRepository.calculateTotalAdjustments(invoiceId);
    return (subtotal || 0) + (tax || 0) + totalAdjustments;
  },

  getSummary: async () => {
    const all = await db.getInvoiceAdjustments();
    const summary = {
      totalDiscounts: 0,
      totalFees: 0,
      totalTaxes: 0,
      netImpact: 0,
      count: all.length
    };

    all.forEach(a => {
      if (a.Type === 'Discount') summary.totalDiscounts += a.Value;
      else if (a.Type === 'Additional Fee') summary.totalFees += a.Value;
      else if (a.Type === 'Tax Adjustment') summary.totalTaxes += a.Value;
    });

    summary.netImpact = (summary.totalFees + summary.totalTaxes) + summary.totalDiscounts;
    return summary;
  },

  save: async (adj: InvoiceAdjustment) => {
    const inv = await db.db.sales.get(adj.InvoiceID) || await db.db.purchases.get(adj.InvoiceID);
    if (inv) await periodService.validatePeriod(inv.date || (inv as any).Date);
    
    await db.saveInvoiceAdjustment(adj);
    // تفريغ الكاش لإجبار النظام على إعادة الحساب
    ADJ_TOTAL_CACHE.delete(adj.InvoiceID);
  },

  delete: async (id: string) => {
    const adj = await db.db.Invoice_Adjustments.get(id);
    if (adj) {
      const inv = await db.db.sales.get(adj.InvoiceID) || await db.db.purchases.get(adj.InvoiceID);
      if (inv) await periodService.validatePeriod(inv.date || (inv as any).Date);
      
      await db.deleteInvoiceAdjustment(id);
      ADJ_TOTAL_CACHE.delete(adj.InvoiceID);
    }
  }
};
