
import { db } from './database';
import { FinancialHealthSnapshot, SystemAlert, Sale, Purchase, Product, CashFlow } from '../types';
import { IS_PREVIEW } from '../constants';

export class FinancialHealthService {
  
  /**
   * Main entry point to refresh financial health data
   */
  static async refreshHealthMonitor(): Promise<FinancialHealthSnapshot> {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Fetch raw data
    const sales = await db.getSales();
    const purchases = await db.getPurchases();
    const products = await db.getProducts();
    const cashFlow = await db.getCashFlow();

    // 2. Calculate KPIs
    const kpis = await this.calculateKPIs(sales, purchases, products, cashFlow);

    // 3. Detect Risks & Generate Alerts
    await this.detectRisks(kpis, sales, purchases, products);

    // 4. Calculate Health Score
    const breakdown = this.calculateBreakdown(kpis);
    const score = Math.round(
      (breakdown.liquidity * 0.3) + 
      (breakdown.profitability * 0.3) + 
      (breakdown.stockEfficiency * 0.2) + 
      (breakdown.debtManagement * 0.2)
    );

    // 5. Generate Insights
    const insights = this.generateInsights(kpis, breakdown);

    // 6. Create Snapshot
    const snapshot: FinancialHealthSnapshot = {
      id: `HEALTH-${Date.now()}`,
      date: today,
      score,
      metrics: kpis,
      breakdown,
      insights
    };

    // Save snapshot (one per day usually, but we'll save this one)
    await db.db.financialHealthSnapshots.put(snapshot);

    return snapshot;
  }

  private static async calculateKPIs(sales: Sale[], purchases: Purchase[], products: Product[], cashFlow: CashFlow[]) {
    // Cash Balance
    const cashBalance = cashFlow.reduce((acc, curr) => {
      return curr.type === 'دخل' ? acc + curr.amount : acc - curr.amount;
    }, 0);

    // Accounts Receivable (Unpaid Sales)
    const accountsReceivable = sales
      .filter(s => s.paymentStatus === 'Credit' && s.InvoiceStatus !== 'CANCELLED')
      .reduce((acc, s) => acc + (s.finalTotal - (s.paidAmount || 0)), 0);

    // Accounts Payable (Unpaid Purchases)
    const accountsPayable = purchases
      .filter(p => p.status === 'UNPAID' && p.invoiceStatus !== 'CANCELLED')
      .reduce((acc, p) => acc + (p.totalAmount - (p.paidAmount || 0)), 0);

    // Inventory Value (Cost Price * Stock)
    const inventoryValue = products.reduce((acc, p) => acc + ((p.CostPrice || 0) * (p.StockQuantity || 0)), 0);

    // Gross Profit & Net Profit (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSales = sales.filter(s => new Date(s.date) >= thirtyDaysAgo && s.InvoiceStatus !== 'CANCELLED');
    
    const totalRevenue = recentSales.reduce((acc, s) => acc + s.finalTotal, 0);
    const totalCOGS = recentSales.reduce((acc, s) => acc + (s.totalCost || 0), 0);
    const grossProfit = totalRevenue - totalCOGS;
    
    const recentExpenses = cashFlow.filter(c => c.type === 'خرج' && new Date(c.date) >= thirtyDaysAgo && !c.notes?.includes('مشتريات'));
    const totalExpenses = recentExpenses.reduce((acc, c) => acc + c.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    // Collection Rate % (Paid / Total Credit Sales)
    const creditSales = sales.filter(s => s.paymentStatus === 'Credit');
    const totalCreditAmount = creditSales.reduce((acc, s) => acc + s.finalTotal, 0);
    const totalCollectedAmount = creditSales.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const collectionRate = totalCreditAmount > 0 ? (totalCollectedAmount / totalCreditAmount) * 100 : 100;

    // Supplier Payment Ratio (Paid / Total Purchases)
    const totalPurchases = purchases.reduce((acc, p) => acc + p.totalAmount, 0);
    const totalPaidPurchases = purchases.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const supplierPaymentRatio = totalPurchases > 0 ? (totalPaidPurchases / totalPurchases) * 100 : 100;

    // Stock Turnover Ratio (COGS / Average Inventory)
    // Simplified: COGS (30d) / Current Inventory Value
    const stockTurnoverRatio = inventoryValue > 0 ? (totalCOGS / inventoryValue) : 0;

    return {
      cashBalance,
      accountsReceivable,
      accountsPayable,
      inventoryValue,
      grossProfit,
      netProfit,
      collectionRate,
      supplierPaymentRatio,
      stockTurnoverRatio
    };
  }

  private static async detectRisks(kpis: any, sales: Sale[], purchases: Purchase[], products: Product[]) {
    const alerts: SystemAlert[] = [];
    const now = new Date().toISOString();

    // 1. AR > 40% of total sales (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const totalSales30d = sales
      .filter(s => new Date(s.date) >= thirtyDaysAgo && s.InvoiceStatus !== 'CANCELLED')
      .reduce((acc, s) => acc + s.finalTotal, 0);
    
    if (totalSales30d > 0 && (kpis.accountsReceivable / totalSales30d) > 0.4) {
      alerts.push({
        id: `ALRT-AR-${Date.now()}`,
        type: 'FINANCIAL',
        severity: 'HIGH',
        message: 'تحذير: ذمم العملاء تجاوزت 40% من إجمالي المبيعات. خطر في السيولة.',
        timestamp: now,
        isRead: false
      });
    }

    // 2. AP overdue > 30 days
    const overdueAP = purchases.some(p => {
      if (p.status === 'UNPAID' && p.invoiceStatus !== 'CANCELLED') {
        const diff = (Date.now() - new Date(p.date).getTime()) / (1000 * 3600 * 24);
        return diff > 30;
      }
      return false;
    });
    if (overdueAP) {
      alerts.push({
        id: `ALRT-AP-${Date.now()}`,
        type: 'FINANCIAL',
        severity: 'MEDIUM',
        message: 'تنبيه: توجد فواتير مشتريات متأخرة السداد لأكثر من 30 يوماً.',
        timestamp: now,
        isRead: false
      });
    }

    // 3. Negative cash
    if (kpis.cashBalance < 0) {
      alerts.push({
        id: `ALRT-CASH-${Date.now()}`,
        type: 'FINANCIAL',
        severity: 'CRITICAL',
        message: 'حرج: رصيد الصندوق سالب! يرجى مراجعة العمليات المالية فوراً.',
        timestamp: now,
        isRead: false
      });
    }

    // 4. Stock stagnant > 90 days
    // Simplified: Check products with stock but no sales in 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const stagnantProducts = products.filter(p => {
      if (p.StockQuantity > 0) {
        const hasRecentSale = sales.some(s => 
          s.items.some(i => i.product_id === p.ProductID) && 
          new Date(s.date) >= ninetyDaysAgo
        );
        return !hasRecentSale;
      }
      return false;
    });
    if (stagnantProducts.length > 5) {
      alerts.push({
        id: `ALRT-STOCK-${Date.now()}`,
        type: 'STOCK',
        severity: 'MEDIUM',
        message: `تنبيه: يوجد ${stagnantProducts.length} أصناف راكدة لم يتم بيعها منذ 90 يوماً.`,
        timestamp: now,
        isRead: false
      });
    }

    // 5. Profit margin < 5%
    const totalRevenue = kpis.grossProfit + (kpis.grossProfit / 0.2); // Rough estimate if not calculated
    const margin = totalRevenue > 0 ? (kpis.netProfit / totalRevenue) * 100 : 0;
    if (margin < 5 && totalRevenue > 0) {
      alerts.push({
        id: `ALRT-PROFIT-${Date.now()}`,
        type: 'FINANCIAL',
        severity: 'HIGH',
        message: 'تحذير: هامش الربح الصافي أقل من 5%. كفاءة التشغيل منخفضة.',
        timestamp: now,
        isRead: false
      });
    }

    // Save alerts (only if not already present and unread to avoid flooding)
    const existingAlerts = await db.db.systemAlerts.where('isRead').equals(0).toArray();
    
    for (const alert of alerts) {
      const isDuplicate = existingAlerts.some(a => a.message === alert.message && a.severity === alert.severity);
      if (!isDuplicate) {
        await db.db.systemAlerts.put(alert);
        
        // If critical, check threshold via AlertCenter logic
        if (alert.severity === 'CRITICAL') {
          const { AlertCenter } = await import('./AlertCenter');
          // We don't call addAlert here to avoid recursion, but we trigger the threshold check
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const criticalCount = await db.db.systemAlerts
            .where('timestamp').above(oneDayAgo)
            .filter(a => a.severity === 'CRITICAL')
            .count();
            
          if (criticalCount >= 10) {
            console.error("CRITICAL THRESHOLD REACHED via Financial Health Monitor 🛡️");
            if (!IS_PREVIEW) {
              const { AnomalyScoringEngine } = await import('./AnomalyScoringEngine');
              await AnomalyScoringEngine.calculateCurrentRiskScore();
            } else {
              console.warn("PREVIEW GUARD: Critical threshold reached in Health Monitor, but bypassing RECOVERY_MODE.");
            }
          }
        }
      }
    }
  }

  private static calculateBreakdown(kpis: any) {
    // Liquidity (Cash vs AP)
    let liquidity = 100;
    if (kpis.cashBalance < 0) liquidity = 0;
    else if (kpis.accountsPayable > 0) {
      const ratio = kpis.cashBalance / kpis.accountsPayable;
      liquidity = Math.min(100, ratio * 50); // 2.0 ratio = 100 score
    }

    // Profitability
    let profitability = Math.min(100, (kpis.netProfit / 5000) * 100); // Target 5k profit
    if (kpis.netProfit < 0) profitability = 0;

    // Stock Efficiency
    let stockEfficiency = Math.min(100, kpis.stockTurnoverRatio * 20); // Target 5.0 turnover

    // Debt Management
    let debtManagement = kpis.collectionRate; // Direct mapping

    return {
      liquidity: Math.max(0, liquidity),
      profitability: Math.max(0, profitability),
      stockEfficiency: Math.max(0, stockEfficiency),
      debtManagement: Math.max(0, debtManagement)
    };
  }

  private static generateInsights(kpis: any, breakdown: any): string[] {
    const insights: string[] = [];

    if (breakdown.debtManagement < 70) {
      insights.push("كفاءة التحصيل من العملاء في تراجع، يرجى متابعة المديونيات.");
    }
    if (breakdown.stockEfficiency < 50) {
      insights.push("مخاطر تراكم المخزون الراكد مرتفعة، يرجى مراجعة سياسة الشراء.");
    }
    if (kpis.accountsPayable > kpis.cashBalance * 1.5) {
      insights.push("نسبة التركيز لدى الموردين مرتفعة، خطر في سداد الالتزامات.");
    }
    if (breakdown.profitability > 80) {
      insights.push("أداء ربحي ممتاز خلال الفترة الحالية.");
    }

    return insights;
  }

  static async getLatestSnapshot(): Promise<FinancialHealthSnapshot | undefined> {
    return await db.db.financialHealthSnapshots.orderBy('date').reverse().first();
  }

  static async getActiveAlerts(): Promise<SystemAlert[]> {
    return await db.db.systemAlerts.where('isRead').equals(0).toArray();
  }
}
