
import { db } from '../../lib/database';
import { 
  AIInsight, 
  FinancialHealthSnapshot, 
  Product, 
  Sale, 
  Purchase,
  Account,
  StockMovement,
  JournalLine
} from '../../types';
import { ReportEngine } from './reportEngine';
import { SupplierRepository } from '../../repositories/SupplierRepository';
import { InvoiceRepository } from '../../repositories/invoice.repository';

export class AIInsightsEngine {
  private static isRunning = false;

  /**
   * Main entry point for the engine
   */
  static async runAnalysis() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. KPI Calculations
      const kpis = await this.calculateKPIs();
      
      // 2. Anomaly Detection
      const anomalies = await this.detectAnomalies(kpis);
      
      // 3. Inventory Analysis
      const inventoryAlerts = await this.analyzeInventory();
      
      // 4. Partner Analysis
      const partnerInsights = await this.analyzePartners();
      
      // 5. Cash Flow Monitor
      const cashFlow = await this.monitorCashFlow();
      
      // 6. Scoring System
      const healthScore = await this.calculateHealthScore(kpis, inventoryAlerts, cashFlow);
      
      // 7. Generate & Store Insights
      await this.generateAndStoreInsights(kpis, anomalies, inventoryAlerts, partnerInsights, cashFlow, healthScore);
      
      // NEW: Save analysis to local table if it exists (for simulation/logging)
      try {
        if ((db as any).aiPerformanceLog) {
          await (db as any).aiPerformanceLog.add({
            id: `LOG-${Date.now()}`,
            event_type: 'SYSTEM_ANALYSIS',
            payload: { kpis, anomalies, healthScore },
            result: { alerts: inventoryAlerts.alerts, risk: cashFlow.cashRisk },
            created_at: new Date().toISOString()
          });
        }
      } catch (e) {
        // ignore log error
      }
      
      // 8. Store Health Snapshot
      await this.storeHealthSnapshot(healthScore, kpis, cashFlow);

    } catch (error) {
      console.error("AI Insights Engine Error:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 3. KPI CALCULATIONS
   */
  private static async calculateKPIs() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const current = await ReportEngine.getIncomeStatement(startOfMonth);
    const previous = await ReportEngine.getIncomeStatement(lastMonthStart, lastMonthEnd);

    return { current, previous };
  }

  /**
   * 4. ANOMALY DETECTION
   */
  private static async detectAnomalies(kpis: any) {
    const anomalies: string[] = [];
    const { current, previous } = kpis;

    if (previous.revenue > 0) {
      const drop = (previous.revenue - current.revenue) / previous.revenue;
      if (drop > 0.3) {
        anomalies.push(`انخفاض مفاجئ في المبيعات بنسبة ${(drop * 100).toFixed(1)}% مقارنة بالشهر السابق`);
      }
    }

    if (previous.expenses > 0) {
      const increase = (current.expenses - previous.expenses) / previous.expenses;
      if (increase > 0.5) {
        anomalies.push(`ارتفاع غير طبيعي في المصاريف بنسبة ${(increase * 100).toFixed(1)}%`);
      }
    }

    if (current.netProfit < 0) {
      anomalies.push(`صافي ربح سالب لهذا الشهر: ${current.netProfit.toLocaleString()}`);
    }

    const products = await db.products.toArray();
    const negativeStock = (products || []).filter((p: any) => (p.StockQuantity || 0) < 0);
    if (negativeStock.length > 0) {
      anomalies.push(`يوجد ${negativeStock.length} أصناف برصيد سالب في المخزن`);
    }

    return anomalies;
  }

  /**
   * 5. INVENTORY & 6. EXPIRY ALERTS
   */
  private static async analyzeInventory() {
    const products = await db.products.toArray();
    const allProducts = products || [];
    const alerts: string[] = [];
    
    const lowStock = allProducts.filter((p: any) => (p.StockQuantity || 0) > 0 && (p.StockQuantity || 0) <= (p.MinLevel || 5));
    const zeroStock = allProducts.filter((p: any) => (p.StockQuantity || 0) <= 0);
    
    const now = new Date();
    const nearExpiryDate = new Date();
    nearExpiryDate.setMonth(now.getMonth() + 3);
    
    const nearExpiry = allProducts.filter((p: any) => p.ExpiryDate && new Date(p.ExpiryDate) > now && new Date(p.ExpiryDate) <= nearExpiryDate);
    const expired = allProducts.filter((p: any) => p.ExpiryDate && new Date(p.ExpiryDate) <= now);

    if (lowStock.length > 0) alerts.push(`${lowStock.length} أصناف قاربت على النفاد`);
    if (zeroStock.length > 0) alerts.push(`${zeroStock.length} أصناف نفدت تماماً`);
    if (nearExpiry.length > 0) alerts.push(`${nearExpiry.length} أصناف ستنتهي صلاحيتها قريباً`);
    if (expired.length > 0) alerts.push(`${expired.length} أصناف منتهية الصلاحية`);

    return { alerts, lowStock, zeroStock, nearExpiry, expired };
  }

  /**
   * 7. CUSTOMER & 8. SUPPLIER ANALYSIS
   */
  private static async analyzePartners() {
    const customers = await SupplierRepository.getCustomers();
    const suppliers = await SupplierRepository.getSuppliers();
    const purchases = await InvoiceRepository.getSalesArchive();
    
    const topCustomers = [...customers].sort((a, b) => (b.Balance || 0) - (a.Balance || 0)).slice(0, 5);
    const highDebtCustomers = customers.filter(c => (c.Balance || 0) > 10000);
    
    const topSuppliers = [...suppliers].sort((a, b) => (b.Balance || 0) - (a.Balance || 0)).slice(0, 5);
    const delayedPurchases = purchases.filter(p => (p as any).invoiceStatus === 'PENDING' && (Date.now() - new Date(p.date).getTime()) > 7 * 24 * 60 * 60 * 1000);

    return { topCustomers, highDebtCustomers, topSuppliers, delayedPurchases };
  }

  /**
   * 9. CASH FLOW MONITOR
   */
  private static async monitorCashFlow() {
    const cashFlows = await db.cashFlow.toArray();
    const allFlows = cashFlows || [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    
    const currentMonthFlows = allFlows.filter((f: any) => f.date >= startOfMonth);
    
    const inflow = currentMonthFlows.filter((f: any) => f.type === 'دخل').reduce((sum: number, f: any) => sum + (f.amount || 0), 0);
    const outflow = currentMonthFlows.filter((f: any) => f.type === 'خرج').reduce((sum: number, f: any) => sum + (f.amount || 0), 0);
    
    const cashRisk = inflow < outflow * 0.8;

    return { inflow, outflow, cashRisk };
  }

  /**
   * 10. SCORING SYSTEM
   */
  private static async calculateHealthScore(kpis: any, inventory: any, cashFlow: any) {
    let score = 70;

    if (kpis.current.netProfit > 0) score += 10;
    else score -= 20;

    if (kpis.current.margin > 20) score += 5;

    if (inventory.zeroStock.length > 10) score -= 10;
    if (inventory.expired.length > 0) score -= 15;

    if (cashFlow.cashRisk) score -= 10;
    if (cashFlow.inflow > cashFlow.outflow) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 11. SMART ALERTS & 12. STORAGE
   */
  private static async generateAndStoreInsights(kpis: any, anomalies: string[], inventory: any, partners: any, cashFlow: any, score: number) {
    const batch: any[] = [];

    if (score < 40) {
      batch.push(this.createInsight('RISK', 'تحذير: صحة مالية حرجة', `درجة الصحة المالية للمنشأة منخفضة جداً (${score}/100). يرجى مراجعة المصاريف والتدفقات النقدية.`, 'CRITICAL'));
    }

    anomalies.forEach(a => {
      batch.push(this.createInsight('PERFORMANCE', 'تنبيه: نشاط غير طبيعي', a, 'WARNING'));
    });

    if (inventory.expired.length > 0) {
      batch.push(this.createInsight('RISK', 'تنبيه: مخزون منتهي الصلاحية', `يوجد ${inventory.expired.length} أصناف منتهية الصلاحية يجب إتلافها أو إرجاعها.`, 'CRITICAL'));
    }

    if (cashFlow.cashRisk) {
      batch.push(this.createInsight('COST', 'تنبيه: تدفق نقدي سالب', 'المصاريف تتجاوز الدخل بشكل ملحوظ هذا الشهر. قد تواجه مشكلة في السيولة.', 'WARNING'));
    }

    // Save to database (Dexie)
    try {
      for (const insight of batch) {
        await db.aiInsights.put(insight);
      }
    } catch (e) {
      console.warn("Failed to store AI insights in Dexie:", e);
    }
  }

  private static createInsight(type: any, title: string, message: string, severity: any): AIInsight {
    const now = new Date().toISOString();
    return {
      id: `INS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      title,
      message,
      severity,
      timestamp: now,
      tenant_id: 'TEN-DEV-001',
      lastModified: now
    };
  }

  /**
   * جلب آخر الرؤى المولدة
   */
  static async getLatestInsights(): Promise<AIInsight[]> {
    try {
      const insights = await db.aiInsights.orderBy('timestamp').reverse().limit(10).toArray();
      return insights || [];
    } catch (error) {
      console.warn("Failed to fetch insights from Dexie:", error);
      return [];
    }
  }

  private static async storeHealthSnapshot(score: number, kpis: any, cashFlow: any) {
    const snapshot: FinancialHealthSnapshot = {
      id: `FHS-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      score,
      metrics: {
        cashBalance: cashFlow.inflow - cashFlow.outflow,
        accountsReceivable: 0,
        accountsPayable: 0,
        inventoryValue: await ReportEngine.getInventoryValue(),
        grossProfit: kpis.current.grossProfit,
        netProfit: kpis.current.netProfit,
        collectionRate: 0,
        supplierPaymentRatio: 0,
        stockTurnoverRatio: 0
      },
      breakdown: {
        liquidity: cashFlow.inflow > cashFlow.outflow ? 80 : 40,
        profitability: kpis.current.margin,
        stockEfficiency: 70,
        debtManagement: 60
      },
      insights: []
    };

    try {
      await db.financialHealthSnapshots.put(snapshot);
    } catch (e) {
      console.warn("Failed to store health snapshot in Dexie:", e);
    }
  }
}
