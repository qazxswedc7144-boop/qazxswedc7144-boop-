import { db } from '../lib/database';
import { GeminiAnalyticsService } from './GeminiAnalyticsService';

export async function generateAIInsights() {
  const invoices = await db.invoices.toArray();
  const items = await db.invoice_items.toArray();

  // 🧠 حساب الربح
  let totalSales = 0;
  let totalCost = 0;

  items.forEach((item: any) => {
    totalSales += (item.sell_price || 0) * (item.quantity || 0);
    totalCost += (item.buy_price || 0) * (item.quantity || 0);
  });

  const profit = totalSales - totalCost;

  // 📊 أفضل الأصناف
  const productMap: Record<string, number> = {};

  items.forEach((item: any) => {
    if (!productMap[item.product_id]) {
      productMap[item.product_id] = 0;
    }
    productMap[item.product_id] += item.quantity || 0;
  });

  const topProducts = Object.entries(productMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 🚨 كشف الشذوذ (بسيط)
  const anomalies = items.filter((i: any) => (i.sell_price || 0) < (i.buy_price || 0));

  // 🔥 إرسال ملخص فقط لـ Gemini
  const summary = {
    profit,
    topProducts,
    anomaliesCount: anomalies.length
  };

  let aiResponse = null;

  try {
    aiResponse = await GeminiAnalyticsService.analyze(summary);
  } catch (e) {
    console.warn("Gemini failed, using local insights", e);
  }

  return {
    profit,
    topProducts,
    anomalies,
    aiResponse
  };
}
