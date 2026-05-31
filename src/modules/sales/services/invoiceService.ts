import { db } from "@/core/db";

export interface InvoiceItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

/**
 * محرك الفواتير المطور لربط PharmaFlow بـ Dexie (Local-only version)
 */
export const invoiceService = {
  /**
   * جلب الفواتير (من النسخة المحلية Dexie)
   */
  async getInvoices() {
    return await db.getSales();
  },

  /**
   * إنشاء فاتورة جديدة (نسخة محلية 100%)
   */
  async createInvoice(customerId: string, items: InvoiceItem[], total: number) {
    try {
      // إدخال الفاتورة في النسخة المحلية (Dexie) لضمان العمل بدون إنترنت
      const salePayload = await db.processSale(
        customerId,
        items.map(it => ({
          product_id: it.product_id,
          qty: it.quantity,
          price: it.unit_price,
          name: 'Item from service' // Fallback
        })),
        total,
        false,
        db.generateId('INV'),
        'YER',
        'completed',
        'completed', // docStatus
        100, // auditScore
        'low', // riskLevel
        total, // totalCost
        '', // refId
        '', // attachment
        new Date().toISOString() // date
      );

      return { success: true, localId: (salePayload as any).id, synced: false };
    } catch (error: any) {
      console.error("Database Error:", error.message);
      return { success: false, error: error.message };
    }
  }
};
