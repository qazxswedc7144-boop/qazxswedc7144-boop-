import { db } from '@/core/db';
import { SalesRepository } from '@/database/repositories/SalesRepository';

export class TrendsEngine {
  static async getSalesGrowth(months: number = 6) {
    const sales = await SalesRepository.getAll();
    // Logic to calculate growth over time
    return { data: sales.length, period: months };
  }

  static async getProfitMargins() {
    const products = await db.products.toArray();
    return products.map(p => {
      const price = p.price || 0;
      const cost = p.CostPrice || 0;
      return {
        name: p.name,
        margin: price > 0 ? ((price - cost) / price) * 100 : 0
      };
    });
  }

  static async detectAnomalies() {
    const logs = await db.Audit_Log.toArray();
    // AI or heuristic logic to finding suspicious edits
    return logs.filter((l: any) => l.Change_Type === 'DELETE').slice(-10);
  }
}
