
import { InvoiceItem, ValidationError } from '../types';
import { InventoryService } from './InventoryService';

export class ValidationService {
  /**
   * Validates an invoice before processing.
   */
  static async validateInvoice(invoice: any, type: 'SALE' | 'PURCHASE') {
    // 1. Required Fields
    if (!invoice.items || invoice.items.length === 0) {
      throw new ValidationError("يجب إضافة صنف واحد على الأقل للفاتورة.");
    }
    if (type === 'SALE' && !invoice.customerId) {
      throw new ValidationError("يجب اختيار عميل للفاتورة.");
    }
    if (type === 'PURCHASE' && !invoice.supplierId) {
      throw new ValidationError("يجب اختيار مورد للفاتورة.");
    }
    if (!invoice.total || invoice.total < 0) {
      throw new ValidationError("إجمالي الفاتورة غير صالح.");
    }

    // 2. Item Validation
    for (const item of invoice.items) {
      if (item.qty <= 0) {
        throw new ValidationError(`الكمية للصنف [${item.name}] يجب أن تكون أكبر من صفر.`);
      }
      if (item.price <= 0) {
        throw new ValidationError(`السعر للصنف [${item.name}] يجب أن يكون أكبر من صفر.`);
      }
      this.validateItem(item);
    }

    // 3. Date Validation
    if (!invoice.date || isNaN(Date.parse(invoice.date))) {
      throw new ValidationError("تاريخ الفاتورة غير صالح.");
    }
    const invoiceDate = new Date(invoice.date);
    const now = new Date();
    if (invoiceDate > now) {
      // throw new ValidationError("تاريخ الفاتورة لا يمكن أن يكون في المستقبل.");
      // Some systems allow future dates, but let's warn or restrict if needed.
    }

    // 4. Stock Protection (For Sales)
    if (type === 'SALE') {
      const warehouseId = invoice.warehouseId || 'WH-MAIN';
      for (const item of invoice.items) {
        await this.validateStock(warehouseId, item.product_id, item.qty);
      }
    }
  }

  /**
   * Validates a single item.
   */
  static validateItem(item: InvoiceItem) {
    if (!item.product_id) {
      throw new ValidationError("صنف غير صالح: معرف المنتج مفقود.");
    }
    if (item.qty <= 0) {
      throw new ValidationError(`الكمية للصنف [${item.name}] يجب أن تكون أكبر من صفر.`);
    }
    if (item.price < 0) {
      throw new ValidationError(`السعر للصنف [${item.name}] لا يمكن أن يكون سالباً.`);
    }
  }

  /**
   * Validates stock availability.
   */
  static async validateStock(warehouseId: string, productId: string, quantity: number) {
    try {
      await InventoryService.validateStockAvailability(warehouseId, productId, quantity);
    } catch (error: any) {
      throw new ValidationError(`نقص في المخزون: ${error.message || "الكمية المطلوبة غير متوفرة."}`);
    }
  }

  /**
   * Validates that an invoice ID is unique.
   */
  static async validateInvoiceIdUniqueness(invoiceId: string, table: 'sales' | 'purchases', db: any) {
    if (!invoiceId) return;
    const exists = await db[table].get(invoiceId);
    if (exists) {
      throw new ValidationError(`رقم الفاتورة [${invoiceId}] موجود مسبقاً في النظام.`);
    }
  }
}
