import { db } from '@/core/db';
import { Product } from '@/types';

export class AnalyticsEngine {
  private static cache: Record<string, { data: any; expiry: number }> = {};
  private static CACHE_DURATION = 15000; // 15 seconds cache

  private static getCached<T>(key: string): T | null {
    const entry = this.cache[key];
    if (entry && entry.expiry > Date.now()) {
      return entry.data as T;
    }
    return null;
  }

  private static setCached<T>(key: string, data: T) {
    this.cache[key] = {
      data,
      expiry: Date.now() + this.CACHE_DURATION
    };
  }

  /**
   * Safe paginated query on any IndexedDB table.
   * Completely eliminates full table scans inside UI views.
   */
  static async queryPaginated<T>(
    tableName: keyof typeof db & string,
    page: number = 1,
    pageSize: number = 15,
    options?: {
      filterField?: string;
      filterValue?: any;
      sortBy?: string;
      sortAsc?: boolean;
    }
  ): Promise<{ items: T[]; total: number; pages: number }> {
    const table = (db as any)[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found in database schema`);
    }

    const offset = (page - 1) * pageSize;
    let queryCollection = table;

    // Apply indexed bounds if possible
    if (options?.filterField && options?.filterValue !== undefined) {
      queryCollection = table.where(options.filterField).equals(options.filterValue);
    }

    const total = await queryCollection.count();

    // Sorting and paging
    let items: T[] = [];
    if (options?.sortBy) {
      const sortedQuery = queryCollection.orderBy(options.sortBy);
      if (options.sortAsc === false) {
        items = await sortedQuery.reverse().offset(offset).limit(pageSize).toArray();
      } else {
        items = await sortedQuery.offset(offset).limit(pageSize).toArray();
      }
    } else {
      items = await queryCollection.offset(offset).limit(pageSize).toArray();
    }

    return {
      items,
      total,
      pages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Compute profit margin on products without a full scan, leveraging caches or paginated calculation
   */
  static async getProductProfitMargins(page: number = 1, pageSize: number = 20) {
    const cacheKey = `profit_margins_${page}_${pageSize}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    // Fetch only the page of products we are analyzing!
    const { items: products } = await this.queryPaginated<Product>('products', page, pageSize);

    const marginData = products.map(p => {
      const price = p.price || p.Price || 0;
      const cost = p.CostPrice || p.cost || 0;
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      return {
        id: p.id,
        name: p.Name || p.name || 'Unknown',
        price,
        cost,
        margin: Math.round(margin * 100) / 100
      };
    });

    this.setCached(cacheKey, marginData);
    return marginData;
  }

  /**
   * Calculates sales growth trends for the last N months, completely optimized
   */
  static async getSalesGrowthTrends(months: number = 6) {
    const cacheKey = `sales_growth_trends_${months}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    // Get time thresholds
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - months);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Query invoices bounded by starting date
    const salesInvoices = await db.invoices
      .where('date')
      .aboveOrEqual(dateStr)
      .toArray();

    const monthlyMap: Record<string, number> = {};

    salesInvoices.forEach(inv => {
      if (inv.type === 'SALE' && (inv.InvoiceStatus === 'POSTED' || inv.invoiceStatus === 'POSTED') && inv.date) {
        const monthKey = inv.date.substring(0, 7); // 'YYYY-MM'
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + (inv.finalTotal || 0);
      }
    });

    const data = Object.entries(monthlyMap)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    this.setCached(cacheKey, data);
    return data;
  }
}
