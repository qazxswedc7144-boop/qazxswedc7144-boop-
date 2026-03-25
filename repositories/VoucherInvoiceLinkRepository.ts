
import { db } from '../services/database';
import { VoucherInvoiceLink } from '../types';
import { authService } from '../services/auth.service';

/**
 * Voucher Invoice Link Repository - محرك ربط السدادات بالفواتير (Phase 11 Update)
 */
export const VoucherInvoiceLinkRepository = {
  
  /**
   * إنشاء رابط جديد بين سند وفاتورة مع بيانات الرقابة النظامية
   */
  createLink: async (voucherId: string, invoiceId: string, amount: number, note?: string): Promise<string> => {
    if (!voucherId || !invoiceId) throw new Error("Voucher and Invoice IDs are required for linking.");
    
    const user = authService.getCurrentUser();
    const id = db.generateId('LNK');
    const now = new Date().toISOString();
    
    const link: VoucherInvoiceLink = {
      linkId: id,
      voucherId,
      invoiceId,
      Paid_Amount: amount,
      note,
      Created_At: now,
      Created_By: user?.User_Email || 'SYSTEM',
      lastModified: now,
      syncStatus: 'NEW'
    } as VoucherInvoiceLink;

    await db.db.voucherInvoiceLinks.put(link);
    return id;
  },

  /**
   * جلب كافة الروابط لسند معين
   */
  getByVoucher: async (voucherId: string): Promise<VoucherInvoiceLink[]> => {
    if (!voucherId) return [];
    return await db.db.voucherInvoiceLinks.where('voucherId').equals(voucherId).toArray();
  },

  /**
   * جلب كافة الروابط لفاتورة معينة
   */
  getByInvoice: async (invoiceId: string): Promise<VoucherInvoiceLink[]> => {
    if (!invoiceId) return [];
    return await db.db.voucherInvoiceLinks.where('invoiceId').equals(invoiceId).toArray();
  },

  /**
   * حساب إجمالي المبالغ المسددة لفاتورة من واقع الروابط
   */
  getTotalPaidForInvoice: async (invoiceId: string): Promise<number> => {
    if (!invoiceId) return 0;
    const links = await VoucherInvoiceLinkRepository.getByInvoice(invoiceId);
    return links.reduce((sum, link) => sum + link.Paid_Amount, 0);
  }
};
