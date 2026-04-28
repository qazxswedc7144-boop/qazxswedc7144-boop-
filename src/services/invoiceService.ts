import { supabase } from "@/lib/supabase";
import { db } from "@/lib/database";

export interface InvoiceItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

/**
 * محرك الفواتير المطور لربط PharmaFlow بـ Supabase و Dexie
 */
export const invoiceService = {
  /**
   * جلب الفواتير (من النسخة المحلية Dexie)
   */
  async getInvoices() {
    return await db.getInvoices();
  },

  /**
   * إنشاء فاتورة جديدة
   */
  async createInvoice(customerId: string, items: InvoiceItem[], total: number) {
    try {
      // 1. إدخال الفاتورة في النسخة المحلية (Dexie) لضمان العمل بدون إنترنت
      const salePayload = await db.processSale(
        customerId,
        items,
        total,
        false,
        db.generateId('INV'),
        'YER',
        'completed'
      );

      // 2. محاولة المزامنة مع سوبابيز (Supabase)
      try {
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert([{ 
            customer_id: customerId, 
            total_amount: total,
            status: 'completed' 
          }])
          .select()
          .single();

        if (saleError) throw saleError;

        const saleItems = items.map(item => ({
          sale_id: sale.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }));

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (itemsError) throw itemsError;

        // تحديث حالة المزامنة في النسخة المحلية
        await db.sales.update(salePayload.id, { isSynced: 1 });

        return { success: true, saleId: sale.id, localId: salePayload.id };
      } catch (syncError) {
        console.warn("Cloud Sync Failed, data saved locally:", syncError);
        return { success: true, localId: salePayload.id, synced: false };
      }
    } catch (error: any) {
      console.error("Database Error:", error.message);
      return { success: false, error: error.message };
    }
  }
};
