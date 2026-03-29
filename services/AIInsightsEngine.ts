
import { db } from './database';
import { AIInsight, Sale, Purchase, Product, Supplier } from '../types';

export class AIInsightsEngine {
  /**
   * تشغيل محرك التحليلات لتوليد رؤى جديدة
   */
  static async runAnalysis(): Promise<void> {
    const now = new Date().toISOString();
    const insights: AIInsight[] = [];

    // 1. تحليل المبيعات (أكثر الأصناف مبيعاً)
    const sales = await db.db.sales.toArray();
    const itemSales: Record<string, { name: string, qty: number, total: number }> = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!itemSales[item.product_id]) {
          itemSales[item.product_id] = { name: item.name, qty: 0, total: 0 };
        }
        itemSales[item.product_id].qty += item.qty;
        itemSales[item.product_id].total += item.sum;
      });
    });

    const topSelling = Object.entries(itemSales)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);

    if (topSelling.length > 0) {
      insights.push({
        id: db.generateId('INS'),
        type: 'TREND',
        title: 'الأصناف الأكثر مبيعاً 📈',
        message: `أعلى 5 أصناف مبيعاً هي: ${topSelling.map(i => i[1].name).join(', ')}`,
        severity: 'INFO',
        data: topSelling,
        timestamp: now,
        lastModified: now
      });
    }

    // 2. تحليل الأداء (أصناف منخفضة الأداء)
    const products = await db.db.products.toArray();
    const lowPerforming = products.filter(p => !itemSales[p.id] || itemSales[p.id].qty < 5);
    
    if (lowPerforming.length > 0) {
      insights.push({
        id: db.generateId('INS'),
        type: 'PERFORMANCE',
        title: 'أصناف منخفضة الأداء 📉',
        message: `يوجد ${lowPerforming.length} صنف لم يحقق مبيعات جيدة مؤخراً.`,
        severity: 'WARNING',
        data: lowPerforming.slice(0, 5),
        timestamp: now,
        lastModified: now
      });
    }

    // 3. تحليل الربحية (أصناف عالية الربح)
    const highProfit = products
      .filter(p => p.ProfitMargin && p.ProfitMargin > 30)
      .sort((a, b) => (b.ProfitMargin || 0) - (a.ProfitMargin || 0))
      .slice(0, 5);

    if (highProfit.length > 0) {
      insights.push({
        id: db.generateId('INS'),
        type: 'PERFORMANCE',
        title: 'أصناف عالية الربحية 💰',
        message: `الأصناف ذات هامش الربح الأعلى هي: ${highProfit.map(i => i.Name).join(', ')}`,
        severity: 'INFO',
        data: highProfit,
        timestamp: now,
        lastModified: now
      });
    }

    // 4. تنبيهات المخاطر (نقص المخزون)
    const stockRisks = products.filter(p => p.StockQuantity <= p.MinLevel);
    if (stockRisks.length > 0) {
      insights.push({
        id: db.generateId('INS'),
        type: 'RISK',
        title: 'تنبيه نقص المخزون 🚨',
        message: `يوجد ${stockRisks.length} صنف وصل إلى الحد الأدنى للمخزون.`,
        severity: 'CRITICAL',
        data: stockRisks.map(p => ({ id: p.id, name: p.Name, qty: p.StockQuantity })),
        timestamp: now,
        lastModified: now
      });
    }

    // 5. تحليل سلوك العملاء (عملاء مدينون بمبالغ كبيرة)
    const customers = await db.db.customers.toArray();
    const highDebt = customers.filter(c => c.Balance > 1000).sort((a, b) => b.Balance - a.Balance);
    
    if (highDebt.length > 0) {
      insights.push({
        id: db.generateId('INS'),
        type: 'BEHAVIOR',
        title: 'عملاء مدينون بمبالغ كبيرة 💳',
        message: `يوجد ${highDebt.length} عميل تجاوزت مديونيتهم 1000 ريال.`,
        severity: 'WARNING',
        data: highDebt.slice(0, 5),
        timestamp: now,
        lastModified: now
      });
    }

    // حفظ الرؤى الجديدة في قاعدة البيانات
    if (insights.length > 0) {
      await db.db.aiInsights.bulkPut(insights);
    }
  }

  /**
   * جلب آخر الرؤى المولدة
   */
  static async getLatestInsights(): Promise<AIInsight[]> {
    return await db.db.aiInsights.orderBy('timestamp').reverse().limit(10).toArray();
  }
}
