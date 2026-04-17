
import { db } from './database';
import { FIFOCostLayer, InvoiceItem } from '../types';
import { safeWhereEqual, safeGetById } from '../utils/dexieSafe';

export class FIFOEngine {
  /**
   * إضافة طبقة تكلفة جديدة عند الشراء
   */
  static async addPurchaseLayer(productId: string, quantity: number, unitCost: number, purchaseDate: string, referenceId: string): Promise<void> {
    const layer: FIFOCostLayer = {
      id: db.generateId('FIFO'),
      productId,
      quantityRemaining: quantity,
      unitCost,
      purchaseDate,
      referenceId,
      isClosed: false,
      lastModified: new Date().toISOString()
    };
    await db.db.fifoCostLayers.add(layer);
  }

  /**
   * استهلاك الطبقات الأقدم عند البيع وحساب تكلفة البضاعة المباعة (COGS)
   */
  static async consumeLayers(productId: string, quantityToConsume: number): Promise<number> {
    let totalCOGS = 0;
    let remainingToConsume = quantityToConsume;

    // جلب الطبقات المفتوحة للأصناف مرتبة حسب تاريخ الشراء (الأقدم أولاً)
    const openLayers = (await safeWhereEqual(db.db.fifoCostLayers, 'productId', productId))
      .filter(l => !l.isClosed)
      .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());

    for (const layer of openLayers) {
      if (remainingToConsume <= 0) break;

      const consumption = Math.min(layer.quantityRemaining, remainingToConsume);
      totalCOGS += consumption * layer.unitCost;
      
      const newRemaining = layer.quantityRemaining - consumption;
      remainingToConsume -= consumption;

      await db.db.fifoCostLayers.update(layer.id, {
        quantityRemaining: newRemaining,
        isClosed: newRemaining <= 0,
        lastModified: new Date().toISOString()
      });
    }

    // في حال عدم وجود طبقات كافية، نستخدم آخر سعر تكلفة معروف (أو سعر التكلفة الحالي للمنتج)
    if (remainingToConsume > 0) {
      const product = await safeGetById(db.db.products, productId);
      const fallbackCost = product?.CostPrice || 0;
      totalCOGS += remainingToConsume * fallbackCost;
    }

    return totalCOGS;
  }

  /**
   * حساب تكلفة فاتورة كاملة
   */
  static async calculateInvoiceCOGS(items: InvoiceItem[]): Promise<number> {
    let totalInvoiceCOGS = 0;
    for (const item of items) {
      const itemCOGS = await this.consumeLayers(item.product_id, item.qty);
      totalInvoiceCOGS += itemCOGS;
    }
    return totalInvoiceCOGS;
  }

  /**
   * عكس استهلاك الطبقات (في حال إلغاء فاتورة بيع)
   * ملاحظة: هذا يتطلب تتبع أي طبقات تم استهلاكها بالضبط، 
   * للتبسيط سنقوم بإضافة الكمية المرتجعة كطبقة جديدة بسعر التكلفة الحالي أو آخر طبقة مستهلكة.
   */
  static async reverseConsumption(productId: string, quantity: number, unitCost: number): Promise<void> {
    // إضافة الكمية المرتجعة كطبقة جديدة (أو يمكن محاولة إعادة فتح الطبقات المغلقة مؤخراً)
    await this.addPurchaseLayer(productId, quantity, unitCost, new Date().toISOString(), 'RETURN_REVERSE');
  }
}
