
import { ValidationError, AccountingError, InventoryError, AccountingEntry, Product, ValidationRule } from '../../types';
import { db } from '../database';
import { periodService } from '../period.service';
import { PurchaseRepository } from '../../repositories/PurchaseRepository';
import { SalesRepository } from '../../repositories/SalesRepository';
import { PriceHistoryRepository } from '../../repositories/PriceHistoryRepository';
import { InvoiceRepository } from '../../repositories/invoice.repository';
import { useAppStore } from '../../store/useAppStore';

/**
 * Data Validator - محرك التحقق السيادي (Smart Validation Engine)
 */
export const dataValidator = {
  
  /**
   * تنفيذ قواعد التحقق الديناميكية (Dynamic Validation Core)
   */
  runDynamicRules: async (entityType: ValidationRule['entityType'], data: any) => {
    const isAuditIntensive = await db.getSetting('AUDIT_INTENSIVE_MODE', 'FALSE') === 'TRUE';
    if (isAuditIntensive) {
      console.warn(`[AI_Audit] Running Intensive Validation for ${entityType}`);
      // Deep check for duplicates in last 5 minutes
      const recentSales = await db.getSales();
      const duplicate = recentSales.find(s => 
        s.customerId === data.customerId && 
        s.finalTotal === data.total && 
        new Date().getTime() - new Date(s.date).getTime() < 300000
      );
      if (duplicate) throw new ValidationError("تنبيه أمني: محاولة تكرار فاتورة مطابقة في وقت قصير جداً (Intensive Mode) 🛡️");
    }

    const rules = (await db.getValidationRules()).filter(r => r.entityType === entityType && r.isActive);
    
    for (const rule of rules) {
      const fieldValue = data[rule.fieldName];
      const comparisonValue = rule.comparisonValue;
      let isValid = true;

      switch (rule.operator) {
        case 'GREATER_THAN': isValid = Number(fieldValue) > Number(comparisonValue); break;
        case 'LESS_THAN': isValid = Number(fieldValue) < Number(comparisonValue); break;
        case 'EQUALS': isValid = String(fieldValue) === String(comparisonValue); break;
        case 'NOT_EQUALS': isValid = String(fieldValue) !== String(comparisonValue); break;
        case 'NOT_EMPTY': isValid = fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== ''; break;
        case 'MIN_LENGTH': isValid = String(fieldValue || '').length >= Number(comparisonValue); break;
      }

      if (!isValid) {
        throw new ValidationError(rule.errorMessage || `فشل التحقق في حقل ${rule.fieldName}`);
      }
    }
    return true;
  },

  /**
   * التحقق من المرتجعات (Return Logic Guard)
   */
  validateReturn: async (type: 'SALE' | 'PURCHASE', items: any[], originalId: string, paymentMethod: string) => {
    if (!originalId) return; // قد يكون مرتجع حر (اختياري حسب سياسة الصيدلية)

    if (type === 'SALE') {
      const original = await SalesRepository.getById(originalId);
      if (!original) throw new ValidationError("المستند الأصلي غير موجود.");
      
      // مطابقة وسيلة الدفع (Rule: Matching Payment Types)
      if (original.paymentStatus !== paymentMethod) {
        throw new ValidationError(`خطأ في التسوية: يجب أن يكون المرتجع (${paymentMethod}) مطابقاً للفاتورة الأصلية (${original.paymentStatus}).`);
      }

      for (const item of items) {
        const originalItem = original.items.find(i => i.product_id === item.product_id);
        if (!originalItem) throw new ValidationError(`الصنف [${item.name}] غير موجود في الفاتورة الأصلية.`);
        if (item.qty > originalItem.qty) {
          throw new ValidationError(`تجاوز الكمية: لا يمكن إرجاع ${item.qty} وحدة من [${item.name}]، الكمية الأصلية كانت ${originalItem.qty}.`);
        }
      }
    } else {
      const original = await PurchaseRepository.getAll().then(all => all.find(p => p.invoiceId === originalId || p.purchase_id === originalId));
      if (!original) throw new ValidationError("مستند المشتريات الأصلي غير موجود.");

      const originalMethod = original.status === 'PAID' ? 'Cash' : 'Credit';
      if (originalMethod !== paymentMethod) {
        throw new ValidationError(`خطأ في التسوية: يجب أن يكون المرتجع (${paymentMethod}) مطابقاً للمشتريات الأصلية (${originalMethod}).`);
      }

      for (const item of items) {
        const originalItem = original.items.find(i => i.product_id === item.product_id);
        if (!originalItem) throw new ValidationError(`الصنف [${item.name}] غير موجود في فاتورة المشتريات الأصلية.`);
        if (item.qty > originalItem.qty) {
          throw new ValidationError(`تجاوز الكمية: لا يمكن إرجاع ${item.qty} من [${item.name}] للمورد، الكمية الأصلية ${originalItem.qty}.`);
        }
      }
    }
  },

  /**
   * التحقق من سلامة تسوية الفواتير (Settlement Integrity Check)
   */
  validateSettlement: async (allocations: Record<string, number>, type: 'SALE' | 'PURCHASE', voucherAmount: number) => {
    let sumAllocations = 0;

    for (const id in allocations) {
      const amount = allocations[id];
      if (amount <= 0) continue;
      
      sumAllocations += amount;

      if (type === 'SALE') {
        const sale = await SalesRepository.getById(id);
        if (!sale) throw new ValidationError(`الفاتورة #${id} غير موجودة.`);
        
        const remaining = (sale.finalTotal || 0) - (sale.paidAmount || 0);
        
        if (remaining <= 0) {
          throw new ValidationError(`خطأ مالي: الفاتورة #${sale.SaleID} مغلقة ومسددة بالكامل بالفعل.`);
        }
        
        if (amount > parseFloat(remaining.toFixed(2)) + 0.01) {
          throw new ValidationError(`تجاوز حد الفاتورة: لا يمكن تخصيص ${amount.toLocaleString()} لفاتورة مبيعات متبقي منها ${remaining.toLocaleString()}.`);
        }
      } else {
        const purchase = await db.getPurchases().then(all => all.find(p => p.id === id || p.purchase_id === id));
        if (!purchase) throw new ValidationError(`فاتورة المشتريات #${id} غير موجودة.`);
        
        const remaining = (purchase.totalAmount || 0) - (purchase.paidAmount || 0);

        if (remaining <= 0 || purchase.status === 'PAID') {
          throw new ValidationError(`خطأ مالي: الفاتورة #${purchase.invoiceId} مغلقة ومسددة بالكامل بالفعل.`);
        }

        if (amount > parseFloat(remaining.toFixed(2)) + 0.01) {
          throw new ValidationError(`تجاوز حد الفاتورة: لا يمكن تخصيص ${amount.toLocaleString()} لفاتورة مشتريات متبقي منها ${remaining.toLocaleString()}.`);
        }
      }
    }

    if (sumAllocations > voucherAmount + 0.01) {
      throw new ValidationError(`خطأ في التوزيع: إجمالي المبالغ الموزعة (${sumAllocations.toLocaleString()}) يتجاوز قيمة السند (${voucherAmount.toLocaleString()}).`);
    }

    return true;
  },

  /**
   * محرك فحص انحراف الأسعار (Price Deviation Guard)
   */
  checkPriceDeviation: async (productId: string, currentPrice: number, type: 'SALE' | 'PURCHASE') => {
    let historicalPrice: number | null = null;
    
    if (type === 'SALE') {
      historicalPrice = await PriceHistoryRepository.getAveragePriceForProduct(productId);
    } else {
      historicalPrice = await PurchaseRepository.getLastPurchasePriceForItem(productId);
    }

    if (historicalPrice && historicalPrice > 0) {
      const deviation = Math.abs(currentPrice - historicalPrice) / historicalPrice;
      if (deviation > 0.3) {
        const percentage = (deviation * 100).toFixed(0);
        useAppStore.getState().addToast(
          `تنبيه ذكي: السعر المدخل (${currentPrice}) ينحرف بنسبة ${percentage}% عن السعر التاريخي (${historicalPrice}). يرجى التأكد.`,
          'warning'
        );
      }
    }
  },

  /**
   * التحقق من المبيعات مع تطبيق قواعد المنع الصارم (Smart Validation Core)
   */
  validateSale: async (customerId: string, items: any[], total: number, invoiceId?: string, invoiceDate?: string, isReturn: boolean = false, originalId?: string) => {
    await periodService.validatePeriod(invoiceDate || new Date().toISOString());
    
    if (total <= 0) throw new ValidationError("خطأ في القيمة: لا يمكن حفظ فاتورة بإجمالي صفر أو قيمة سالبة.");
    if (!items || items.length === 0) throw new ValidationError("قائمة فارغة: يجب إضافة صنف واحد على الأقل للفاتورة.");

    if (isReturn && originalId) {
      await dataValidator.validateReturn('SALE', items, originalId, 'Cash'); // تبسيط للفحص
    }

    await dataValidator.runDynamicRules('SALE', { customerId, total, itemCount: items.length });

    if (invoiceId) {
      const existing = await SalesRepository.getById(invoiceId);
      const hasDeps = await InvoiceRepository.checkHasDependencies(invoiceId, 'SALE');
      if (existing && (existing.payment_status && existing.payment_status !== 'Unpaid' || hasDeps)) {
        throw new ValidationError(`خطأ حماية: لا يمكن تعديل الفاتورة #${existing.SaleID} لأنها تملك سدادات أو ارتباطات مالية مسجلة.`);
      }
    }

    if (!customerId) throw new ValidationError("يجب تحديد عميل صالح.");
    
    const products = await db.getProducts();
    for (const item of items) {
      if (item.qty <= 0) throw new ValidationError(`خطأ في البند [${item.name}]: الكمية يجب أن تكون أكبر من صفر.`);
      if (item.price <= 0) throw new ValidationError(`خطأ في البند [${item.name}]: السعر يجب أن يكون أكبر من صفر.`);

      if (item.product_id && (item.product_id.startsWith('NEW_ITM') || item.product_id.startsWith('ITM-NEW'))) continue;
      
      const product = products.find(p => p.ProductID === item.product_id);
      if (!product) throw new InventoryError(`الصنف [${item.name}] غير موجود في المستودع.`);
      
      // في حالة البيع العادي فقط نفحص العجز المخزني
      if (!isReturn && product.StockQuantity < item.qty) {
        throw new ValidationError(`عجز مخزني في [${item.name}]: المتاح الكلي ${product.StockQuantity}، المطلوب ${item.qty}`);
      }

      await dataValidator.checkPriceDeviation(item.product_id, item.price, 'SALE');
    }

    return true;
  },

  /**
   * التحقق من المشتريات مع تطبيق قواعد المنع الصارم (Smart Validation Core)
   */
  validatePurchase: async (supplierId: string, items: any[], total: number, invoiceId?: string, excludeId?: string, invoiceDate?: string, isReturn: boolean = false, originalId?: string) => {
    await periodService.validatePeriod(invoiceDate || new Date().toISOString());

    if (total <= 0) throw new ValidationError("خطأ في القيمة: لا يمكن تسجيل فاتورة مشتريات بقيمة صفر أو قيمة سالبة.");
    if (!items || items.length === 0) throw new ValidationError("قائمة فارغة: لا يمكن ترحيل فاتورة بدون أصناف.");

    if (isReturn && originalId) {
      await dataValidator.validateReturn('PURCHASE', items, originalId, 'Cash');
    }

    await dataValidator.runDynamicRules('PURCHASE', { supplierId, total, invoiceId });
    
    if (invoiceId) {
      const existing = await PurchaseRepository.getAll().then(all => all.find(p => p.invoiceId === invoiceId || p.purchase_id === invoiceId || p.id === invoiceId));
      const hasDeps = await InvoiceRepository.checkHasDependencies(invoiceId, 'PURCHASE');
      if (existing && (existing.payment_status && existing.payment_status !== 'Unpaid' || hasDeps)) {
        throw new ValidationError(`خطأ حماية: الفاتورة #${invoiceId} مقفلة مالياً لوجود سدادات أو ارتباطات مالية مسجلة للمورد.`);
      }
    }

    if (!supplierId) throw new ValidationError("يرجى تحديد المورد.");
    
    if (invoiceId && await PurchaseRepository.isInvoiceNumberDuplicate(invoiceId, excludeId)) {
        throw new ValidationError(`رقم الفاتورة [${invoiceId}] مستخدم مسبقاً في النظام.`);
    }

    for (const item of items) {
      if (!item.product_id) throw new ValidationError(`معرف الصنف مفقود.`);
      if (item.qty <= 0) throw new ValidationError(`خطأ في البند [${item.name}]: الكمية الموردة يجب أن تكون أكبر من صفر.`);
      if (item.price <= 0) throw new ValidationError(`خطأ في البند [${item.name}]: سعر الشراء يجب أن يكون أكبر من صفر.`);
      
      // في حالة مرتجع المشتريات، يجب التأكد من توفر الكمية المراد إعادتها للمورد
      if (isReturn) {
        const product = (await db.getProducts()).find(p => p.ProductID === item.product_id);
        if (product && product.StockQuantity < item.qty) {
          throw new ValidationError(`عجز مخزني للمرتجع: لا يمكنك إعادة ${item.qty} من [${item.name}]، الرصيد الحالي بالمخزن هو ${product.StockQuantity} فقط.`);
        }
      }

      await dataValidator.checkPriceDeviation(item.product_id, item.price, 'PURCHASE');
    }

    return true;
  },

  validateAccountingEntry: async (entry: Partial<AccountingEntry>) => {
    if (!entry.date || !entry.lines || entry.lines.length < 2) {
      throw new AccountingError("قيد ناقص البيانات.");
    }
    const totalDebit = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new AccountingError(`قيد غير متزن.`);
    }
    return true;
  },

  validateProduct: async (p: Partial<Product>) => {
    await dataValidator.runDynamicRules('PRODUCT', p);
    if (!p.Name || p.Name.length < 2) throw new ValidationError("اسم الصنف قصير جداً.");
    return true;
  }
};
