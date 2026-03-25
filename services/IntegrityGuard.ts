
import { InvoiceItem, AccountingEntry, Sale, Purchase, Product } from '../types';
import { db } from './database';

export class IntegrityGuard {
  
  /**
   * Validates a journal entry before saving
   */
  static validateJournalEntry(entry: AccountingEntry): void {
    const debits = entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const credits = entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    
    if (Math.abs(debits - credits) > 0.01) {
      throw new Error(`خطأ في توازن القيد المحاسبي: المدين (${debits}) لا يساوي الدائن (${credits}) ⚖️`);
    }
  }

  /**
   * Validates an invoice before saving
   */
  static async validateInvoice(type: 'SALE' | 'PURCHASE', payload: Sale | Purchase, items: InvoiceItem[]): Promise<void> {
    // 1. Total validation
    const sumItems = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const total = type === 'SALE' ? (payload as Sale).finalTotal : (payload as Purchase).totalAmount;
    
    if (Math.abs(sumItems - total) > 0.01) {
      throw new Error(`خطأ في إجمالي الفاتورة: مجموع الأصناف (${sumItems}) لا يطابق الإجمالي (${total}) 🧮`);
    }

    // 2. Stock validation (if not return)
    const isReturn = type === 'SALE' ? (payload as Sale).isReturn : (payload as Purchase).invoiceType === 'مرتجع';
    const allowNegative = await db.getSetting('ALLOW_NEGATIVE_STOCK', false);

    if (!isReturn && !allowNegative) {
      for (const item of items) {
        const product = await db.db.products.get(item.product_id);
        if (product && product.StockQuantity < item.qty) {
          throw new Error(`رصيد غير كافٍ للصنف [${product.Name}]: المتاح (${product.StockQuantity}) والمطلوب (${item.qty}) 📦`);
        }
      }
    }
  }

  /**
   * Validates posted document consistency
   */
  static async validatePostedDocument(id: string, type: 'SALE' | 'PURCHASE'): Promise<void> {
    const journalEntries = await db.getJournalEntries();
    const entry = journalEntries.find(e => e.sourceId === id);
    
    if (!entry) {
      throw new Error(`خطأ في الترحيل: القيد المحاسبي مفقود للفاتورة المرحلة #${id} 📄`);
    }

    // Validate entry balance
    this.validateJournalEntry(entry);

    const archives = await db.db.systemPerformanceLog.where('operation').equals('ARCHIVE_SNAPSHOT').toArray();
    const snapshot = archives.find(a => a.metadata?.invoiceId === id);
    
    if (!snapshot) {
      throw new Error(`خطأ في الأرشفة: نسخة الأرشيف مفقودة للفاتورة المرحلة #${id} 📦`);
    }
  }
}
