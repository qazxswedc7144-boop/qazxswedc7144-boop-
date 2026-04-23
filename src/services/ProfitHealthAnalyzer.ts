
import { db } from '../lib/database';
import { ProfitHealth } from '../types';
import { AlertCenter } from './AlertCenter';

export class ProfitHealthAnalyzer {
  static async computeDailyHealth() {
    console.log("[ProfitHealthAnalyzer] Computing Daily Health Metrics...");
    
    const today = new Date().toISOString().split('T')[0];
    const sales = await db.getSales();
    const purchases = await db.getPurchases();
    const products = await db.getProducts();
    
    // 1. Gross Profit %
    const totalSales = sales.reduce((sum, s) => sum + s.finalTotal, 0);
    const totalCost = sales.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const gpPercent = totalSales > 0 ? ((totalSales - totalCost) / totalSales) * 100 : 0;
    
    // 2. Net Movement
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const netMovement = totalSales - totalPurchases;
    
    // 3. Inventory Turnover (Simplified)
    const inventoryValue = products.reduce((sum, p) => sum + (p.StockQuantity * p.CostPrice), 0);
    const turnover = inventoryValue > 0 ? totalCost / inventoryValue : 0;
    
    // 4. Top 5 Products
    const topProducts = products
      .map(p => ({ id: p.id, name: p.Name, value: p.StockQuantity * p.UnitPrice }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
      
    // 5. Slow Moving Items (No sales in 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentSales = sales.filter(s => s.date > thirtyDaysAgo);
    const soldProductIds = new Set(recentSales.flatMap(s => s.items.map(it => it.product_id)));
    const slowMovingItems = products
      .filter(p => p.StockQuantity > 0 && !soldProductIds.has(p.id))
      .map(p => ({ id: p.id, name: p.Name, daysSinceLastSale: 30 }))
      .slice(0, 5);
      
    // 6. High Risk Entities
    const highRiskEntities = sales
      .filter(s => s.riskLevel === 'HIGH')
      .map(s => ({ id: s.customerId, name: s.customerId, riskScore: s.auditScore || 0 }))
      .slice(0, 5);
      
    // 7. Health Status
    let healthStatus: 'Healthy' | 'Needs Attention' | 'Critical' = 'Healthy';
    if (gpPercent < 15 || turnover < 0.5) healthStatus = 'Needs Attention';
    if (gpPercent < 5 || netMovement < -10000) healthStatus = 'Critical';
    
    const health: ProfitHealth = {
      id: `PH-${today}`,
      date: today,
      grossProfitPercent: gpPercent,
      netMovement,
      inventoryTurnover: turnover,
      healthStatus,
      topProducts,
      slowMovingItems,
      highRiskEntities
    };
    
    await db.db.profitHealth.put(health);
    
    if (healthStatus === 'Critical') {
      await AlertCenter.addAlert({
        type: 'FINANCIAL',
        severity: 'CRITICAL',
        message: `تنبيه: حالة الربحية حرجة (${gpPercent.toFixed(2)}%) 🚨`,
        metadata: { gpPercent, netMovement }
      });
    }
    
    return health;
  }

  static async getLatestHealth() {
    return await db.db.profitHealth.orderBy('date').last();
  }
}
