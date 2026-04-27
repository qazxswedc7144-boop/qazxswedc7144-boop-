
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

    // 3. Date Validation (Only if provided)
    if (invoice.date) {
      let parsedDate: number = NaN;
      if (typeof invoice.date === 'string') {
        const cleanDate = invoice.date.trim();
        // Ignore "undefined", "null", or empty strings
        if (cleanDate && cleanDate !== 'undefined' && cleanDate !== 'null') {
          parsedDate = Date.parse(cleanDate);
        } else {
          // If it was "undefined" or "null", we treat it as if date was not provided
          return;
        }
      } else if (invoice.date instanceof Date) {
        parsedDate = invoice.date.getTime();
      }
      
      if (isNaN(parsedDate)) {
        console.error("[ValidationService] Invalid date received:", invoice.date, typeof invoice.date);
        throw new ValidationError("تاريخ الفاتورة غير صالح.");
      }
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
      const isAvailable = await InventoryService.validateStockAvailability(warehouseId, productId, quantity);
      if (!isAvailable) {
        const currentStock = await InventoryService.getWarehouseStock(warehouseId, productId);
        throw new ValidationError(`نقص في المخزون: الكمية المتاحة هي ${currentStock} فقط.`);
      }
    } catch (error: any) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(`خطأ في التحقق من المخزون: ${error.message || "الكمية المطلوبة غير متوفرة."}`);
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
