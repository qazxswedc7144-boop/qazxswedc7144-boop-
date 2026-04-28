
import { db } from '../lib/database';
import { InvoiceItem, ItemUsageLog } from '../types';
import { PriceHistoryRepository } from './repositories/PriceHistoryRepository';

const PRICE_CACHE = new Map<string, { result: any, timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Price Intelligence Service - محرك تحليل سجل الأسعار (Phase 13)
 * يستخرج الأسعار المقترحة بناءً على (المتوسط، المورد المفضل، آخر حركة)
 */
export const priceIntelligenceService = {
  
  async recordInvoiceUsage(items: InvoiceItem[], type: 'SALE' | 'PURCHASE', partnerId: string, userId: string) {
    const timestamp = new Date().toISOString();
    
    // تسجيل الحركات في سجل الاستخدام العام وفي سجل تاريخ الأسعار التفصيلي
    for (const item of items) {
      // 1. تسجيل تاريخ السعر (Price History Memory)
      await PriceHistoryRepository.record(
        item.product_id,
        item.name,
        partnerId,
        item.price,
        timestamp
      );

      // 2. تسجيل الاستخدام اللوجستي
      const logEntry: ItemUsageLog = {
        id: db.generateId('USG'),
        productId: item.product_id,
        timestamp,
        type,
        partnerId,
        userId,
        qty: item.qty,
        price: item.price
      };
      await db.db.itemUsageLog.add(logEntry);
      
      // تحديث إحصائيات المنتج في الخلفية
      const product = await db.db.products.get(item.product_id);
      if (product) {
        product.usageCount = (product.usageCount || 0) + 1;
        product.lastModified = timestamp;
        await db.db.products.put(product);
      }
    }
    
    // تنظيف كاش الأسعار المرتبط بهذه المنتجات
    items.forEach(it => {
      PRICE_CACHE.delete(`${it.product_id}_${type}`);
      PRICE_CACHE.delete(`${it.product_id}_${type}_${partnerId}`);
    });
  },

  /**
   * استخراج السعر المقترح (Suggested Price Engine)
   */
  async getSuggestedPrice(productId: string, type: 'SALE' | 'PURCHASE', partnerId?: string): Promise<{ 
    suggestedPrice: number | null, 
    basis: 'partner' | 'preferred' | 'average' | 'none',
    insight?: string 
  }> {
    if (!productId) return { suggestedPrice: null, basis: 'none' };
    
    // 1. محاولة جلب آخر سعر لنفس الشريك (أعلى دقة)
    if (partnerId) {
      const partnerLast = await PriceHistoryRepository.getDetailedLastPrice(productId, partnerId);
      if (partnerLast) {
        return { 
          suggestedPrice: partnerLast.Price, 
          basis: 'partner',
          insight: `آخر سعر تم التعامل به مع ${partnerId}`
        };
      }
    }

    // 2. محاولة جلب سعر الشريك المفضل (أعلى تكرار)
    const preferred = await PriceHistoryRepository.getPreferredPartnerPrice(productId);
    if (preferred) {
      return { 
        suggestedPrice: preferred.price, 
        basis: 'preferred',
        insight: `السعر المقترح من المورد الأكثر تعاملاً (${preferred.partner})`
      };
    }

    // 3. العودة للمتوسط العام (Fallback)
    const avg = await PriceHistoryRepository.getAveragePriceForProduct(productId);
    if (avg) {
      return { 
        suggestedPrice: avg, 
        basis: 'average',
        insight: `متوسط السعر التاريخي في النظام`
      };
    }

    return { suggestedPrice: null, basis: 'none' };
  }
};
