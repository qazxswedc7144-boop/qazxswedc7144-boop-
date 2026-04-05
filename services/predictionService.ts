
import { db } from './database';
import { Product, Supplier } from '../types';

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

class PredictionService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RESULTS = 10;

  private async getRecentUsageBoosts() {
    // In a real app, we might query itemUsageLog or a dedicated analytics table
    // For now, let's get the most used products from itemUsageLog
    const usage = await db.db.itemUsageLog.toArray();
    const productCounts: Record<string, number> = {};
    const partnerCounts: Record<string, number> = {};

    usage.forEach(log => {
      if (log.productId) {
        productCounts[log.productId] = (productCounts[log.productId] || 0) + 1;
      }
      if (log.partnerId) {
        partnerCounts[log.partnerId] = (partnerCounts[log.partnerId] || 0) + 1;
      }
    });

    return { productCounts, partnerCounts };
  }

  private getCache<T>(key: string): T[] | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.CACHE_TTL) {
      return entry.data;
    }
    return null;
  }

  private setCache<T>(key: string, data: T[]) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async searchProducts(query: string): Promise<Product[]> {
    if (!query) return [];
    const cacheKey = `prod_${query.toLowerCase()}`;
    const cached = this.getCache<Product>(cacheKey);
    if (cached) return cached;

    const q = query.toLowerCase();
    const allProducts = await db.db.products.where('Is_Active').equals(1).toArray();
    const { productCounts } = await this.getRecentUsageBoosts();

    const scored = allProducts.map(p => {
      let score = 0;
      const name = (p.Name || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();

      if (name.startsWith(q) || barcode.startsWith(q)) {
        score += 100;
      } else if (name.includes(q) || barcode.includes(q)) {
        score += 50;
      }

      if (score > 0) {
        // Boost by usage
        score += (productCounts[p.id] || 0) * 2;
      }

      return { item: p, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, this.MAX_RESULTS)
    .map(s => s.item);

    this.setCache(cacheKey, scored);
    return scored;
  }

  async searchSuppliers(query: string): Promise<Supplier[]> {
    if (!query) return [];
    const cacheKey = `supp_${query.toLowerCase()}`;
    const cached = this.getCache<Supplier>(cacheKey);
    if (cached) return cached;

    const q = query.toLowerCase();
    const allSuppliers = await db.db.suppliers.where('Is_Active').equals(1).toArray();
    const { partnerCounts } = await this.getRecentUsageBoosts();

    const scored = allSuppliers.map(s => {
      let score = 0;
      const name = (s.Supplier_Name || '').toLowerCase();
      const phone = (s.Phone || '').toLowerCase();

      if (name.startsWith(q)) {
        score += 100;
      } else if (name.includes(q) || phone.includes(q)) {
        score += 50;
      }

      if (score > 0) {
        score += (partnerCounts[s.id] || 0) * 5;
      }

      return { item: s, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, this.MAX_RESULTS)
    .map(s => s.item);

    this.setCache(cacheKey, scored);
    return scored;
  }

  async searchCustomers(query: string): Promise<Supplier[]> {
    if (!query) return [];
    const cacheKey = `cust_${query.toLowerCase()}`;
    const cached = this.getCache<Supplier>(cacheKey);
    if (cached) return cached;

    const q = query.toLowerCase();
    const allCustomers = await db.db.customers.where('Is_Active').equals(1).toArray();
    const { partnerCounts } = await this.getRecentUsageBoosts();

    const scored = allCustomers.map(c => {
      let score = 0;
      const name = (c.Supplier_Name || '').toLowerCase();
      const phone = (c.Phone || '').toLowerCase();

      if (name.startsWith(q) || phone.startsWith(q)) {
        score += 100;
      } else if (name.includes(q) || phone.includes(q)) {
        score += 50;
      }

      if (score > 0) {
        score += (partnerCounts[c.id] || 0) * 5;
      }

      return { item: c, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, this.MAX_RESULTS)
    .map(s => s.item);

    this.setCache(cacheKey, scored);
    return scored;
  }
}

export const predictionService = new PredictionService();
