
/* eslint-disable @typescript-eslint/no-unused-vars */
import { db } from '@/core/db';

export const PriceHistoryRepository = {
  record: async (productId: string, name: string, partnerId: string, price: number, date: string): Promise<void> => {
    await db.db.priceHistory.add({
      id: db.generateId('PH'),
      productId,
      name,
      partnerId,
      Price: price,
      date,
      lastModified: new Date().toISOString()
    });
  },

  getDetailedLastPrice: async (productId: string, partnerId: string): Promise<any | null> => {
    const records = await db.db.priceHistory
      .where('productId')
      .equals(productId)
      .and(r => r.partnerId === partnerId)
      .reverse()
      .sortBy('date');
    return records.length > 0 ? records[0] : null;
  },

  getPreferredPartnerPrice: async (productId: string): Promise<{ price: number, partner: string } | null> => {
    const records = await db.db.priceHistory.where('productId').equals(productId).toArray();
    if (records.length === 0) return null;

    // Count by partner
    const counts: Record<string, { count: number, lastPrice: number }> = {};
    records.forEach(r => {
      const existing = counts[r.partnerId];
      if (!existing) {
        counts[r.partnerId] = { count: 1, lastPrice: r.Price };
      } else {
        existing.count++;
        existing.lastPrice = r.Price;
      }
    });

    let bestPartnerId = '';
    let maxCount = 0;
    for (const [pid, data] of Object.entries(counts)) {
      if (data.count > maxCount) {
        maxCount = data.count;
        bestPartnerId = pid;
      }
    }

    if (!bestPartnerId) return null;

    const bestPartnerData = counts[bestPartnerId];
    if (!bestPartnerData) return null;

    return {
      price: bestPartnerData.lastPrice,
      partner: bestPartnerId
    };
  },

  getAveragePriceForProduct: async (productId: string): Promise<number> => {
    // Basic implementation: get average of last few sales
    const sales = await db.db.sales.toArray();
    const itemPrices = sales
      .flatMap(s => s.items)
      .filter(i => i.product_id === productId)
      .map(i => i.price);
    
    if (itemPrices.length === 0) return 0;
    const sum = itemPrices.reduce((a, b) => a + b, 0);
    return sum / itemPrices.length;
  },

  getRecentInsights: async (_productId: string, _limit: number = 5): Promise<any[]> => {
     // Return dummy price history for now to satisfy types
     return [];
  }
};
