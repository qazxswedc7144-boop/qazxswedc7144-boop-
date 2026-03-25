
import { db } from '../services/database';
import { PriceHistory } from '../types';

// محرك التخزين المؤقت عالي السرعة لتقليل الضغط على قاعدة البيانات
const PRICE_CACHE = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

/**
 * Price History Repository - محرك التوقع الذكي للأسعار
 */
export const PriceHistoryRepository = {
  
  record: async (productId: string, itemName: string, partnerName: string, price: number, date: string): Promise<void> => {
    const id = db.generateId('PH');
    const entry: PriceHistory = {
      id,
      productId,
      Item_Name: itemName,
      Customer: partnerName, // يستخدم الحقل كشريك عام (مورد أو عميل)
      Price: price,
      Invoice_Date: date,
      lastModified: new Date().toISOString()
    };
    await db.db.priceHistory.put(entry);
    
    // إخلاء الكاش عند تسجيل حركة جديدة لضمان دقة التوقعات اللاحقة
    PRICE_CACHE.delete(`avg_${productId}`);
    PRICE_CACHE.delete(`recent_${productId}`);
    PRICE_CACHE.delete(`last_${productId}_${partnerName}`);
    PRICE_CACHE.delete(`preferred_${productId}`);
  },

  /**
   * جلب السعر بناءً على المورد/العميل المفضل (الأكثر تكراراً)
   */
  getPreferredPartnerPrice: async (productId: string): Promise<{ price: number, partner: string } | null> => {
    const cacheKey = `preferred_${productId}`;
    const cached = PRICE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const history = await db.db.priceHistory.where('productId').equals(productId).toArray();
    if (history.length === 0) return null;

    // حساب التكرارات لكل شريك
    const partnerCounts: Record<string, number> = {};
    history.forEach(h => {
      partnerCounts[h.Customer] = (partnerCounts[h.Customer] || 0) + 1;
    });

    // تحديد الشريك الأكثر تعاملاً
    const preferredPartner = Object.entries(partnerCounts)
      .sort((a, b) => b[1] - a[1])[0][0];

    // جلب آخر سعر لهذا الشريك
    const lastPriceEntry = history
      .filter(h => h.Customer === preferredPartner)
      .sort((a, b) => new Date(b.Invoice_Date).getTime() - new Date(a.Invoice_Date).getTime())[0];

    const result = { price: lastPriceEntry.Price, partner: preferredPartner };
    PRICE_CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  },

  getDetailedLastPrice: async (productId: string, partnerName: string): Promise<PriceHistory | null> => {
    if (!productId || !partnerName) return null;
    const cacheKey = `last_${productId}_${partnerName}`;
    const cached = PRICE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const result = await db.db.priceHistory
      .where('productId').equals(productId)
      .filter(h => h.Customer === partnerName)
      .reverse()
      .sortBy('Invoice_Date')
      .then(res => res[0] || null);

    PRICE_CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  },

  /**
   * جلب آخر حركات الأسعار المسجلة للمنتج (Phase 13)
   * Fix: Added missing getRecentInsights method required by SalesRepository.
   */
  getRecentInsights: async (productId: string, limit: number = 5): Promise<PriceHistory[]> => {
    const cacheKey = `recent_${productId}_${limit}`;
    const cached = PRICE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const result = await db.db.priceHistory
      .where('productId').equals(productId)
      .reverse()
      .sortBy('Invoice_Date')
      .then(res => res.slice(0, limit));

    PRICE_CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  },

  getAveragePriceForProduct: async (productId: string): Promise<number | null> => {
    const cacheKey = `avg_${productId}`;
    const cached = PRICE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

    const history = await db.db.priceHistory.where('productId').equals(productId).toArray();
    if (history.length === 0) return null;
    
    // حساب المتوسط الحسابي البسيط
    const sum = history.reduce((acc, h) => acc + h.Price, 0);
    const avg = parseFloat((sum / history.length).toFixed(2));

    PRICE_CACHE.set(cacheKey, { data: avg, timestamp: Date.now() });
    return avg;
  }
};
