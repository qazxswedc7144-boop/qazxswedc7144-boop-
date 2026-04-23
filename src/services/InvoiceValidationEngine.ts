
import { Sale, Purchase, InvoiceItem } from '../types';
import { db } from '../lib/database';

export const InvoiceValidationEngine = {
  /**
   * توليد بصمة فريدة للفاتورة لمنع التكرار
   */
  generateHash: (invoice: any): string => {
    const data = `${invoice.date}|${invoice.customerId || invoice.partnerId}|${invoice.finalTotal || invoice.totalAmount}|${invoice.items.length}`;
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  },

  /**
   * التحقق من صحة الفاتورة قبل الحفظ
   */
  validate: async (invoice: any, type: 'SALE' | 'PURCHASE') => {
    // 1. منع الفاتورة الفارغة
    if (!invoice.items || invoice.items.length === 0) {
      throw new Error("يجب أن تحتوي الفاتورة على صنف واحد على الأقل");
    }

    // 2. منع الكميات الصفرية أو السالبة
    // 3. منع الأسعار السالبة
    invoice.items.forEach((item: InvoiceItem) => {
      if (item.qty <= 0) {
        throw new Error(`كمية غير صالحة للصنف: ${item.name}`);
      }
      if (item.price < 0) {
        throw new Error(`سعر غير صالح للصنف: ${item.name}`);
      }
    });

    // 4. منع الإجمالي السالب
    const total = type === 'SALE' ? invoice.finalTotal : invoice.totalAmount;
    if (total < 0) {
      throw new Error("إجمالي الفاتورة لا يمكن أن يكون سالباً");
    }

    // 5. منع تجاوز المخزون (للمبيعات فقط)
    if (type === 'SALE') {
      const products = await db.getProducts();
      for (const item of invoice.items) {
        const product = products.find(p => p.id === item.product_id);
        if (product && item.qty > product.StockQuantity) {
          throw new Error(`مخزون غير كافٍ للصنف: ${item.name} (المتاح: ${product.StockQuantity})`);
        }
      }
    }

    // التحقق من تكرار الفاتورة عبر البصمة
    const hash = InvoiceValidationEngine.generateHash(invoice);
    const existingSales = await db.getSales();
    const existingPurchases = await db.getPurchases();
    
    const isDuplicate = [...existingSales, ...existingPurchases].some(inv => inv.hash === hash && inv.id !== invoice.id);
    if (isDuplicate) {
      throw new Error("تم اكتشاف فاتورة مكررة (نفس التاريخ، الشريك، والإجمالي)");
    }

    return hash;
  }
};
