
import { db } from '../lib/database';
import { FIFOEngine } from './FIFOEngine';
import { Sale, Purchase, Product, InventoryTransaction, AccountingEntry } from '../types';
import { GeminiAnalyticsService } from './GeminiAnalyticsService';

export interface DashboardMetrics {
  totalSales: number;
  totalPurchases: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  expenses: number;
  topSellingItems: any[];
  mostProfitableItems: any[];
  slowMovingItems: any[];
  lowStockAlerts: any[];
  expiryAlerts: any[];
  anomalies: any[];
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  todaySummary: {
    sales: number;
    profit: number;
    expenses: number;
  };
  recommendations?: string;
  lastUpdated: string;
}

export class AIDashboardEngine {
  private static AI_CACHE_KEY = 'pharmaflow_dashboard_ai_cache';
  private static AI_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for dashboard AI

  static async getMetrics(forceRefresh = false): Promise<DashboardMetrics> {
    // Always calculate fresh DB metrics
    const metrics = await this.calculateMetrics(forceRefresh);
    return metrics;
  }

  private static async calculateMetrics(forceRefreshAI = false): Promise<DashboardMetrics> {
    const sales = await db.db.sales.toArray();
    const purchases = await db.db.purchases.toArray();
    const products = await db.db.products.toArray();
    const journalEntries = await db.db.journalEntries.toArray();
    const accounts = await db.db.accounts.toArray();
    const stockMovements = await db.db.inventoryTransactions.toArray();

    const today = new Date().toISOString().split('T')[0];

    // A) Total Sales
    const totalSales = sales
      .filter(s => s.InvoiceStatus === 'POSTED')
      .reduce((sum, s) => sum + (s.finalTotal || 0), 0);

    // B) Total Purchases
    const totalPurchases = purchases
      .filter(p => p.invoiceStatus === 'POSTED')
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // C) COGS (Cost of Goods Sold)
    const cogs = sales
      .filter(s => s.InvoiceStatus === 'POSTED')
      .reduce((sum, s) => sum + (s.totalCost || 0), 0);

    // D) Gross Profit
    const grossProfit = totalSales - cogs;

    // F) Expenses
    // Assuming expense accounts have a specific type or code range
    const expenseAccountIds = accounts
      .filter(a => a.type === 'EXPENSE' || a.code?.startsWith('5'))
      .map(a => a.id);
    
    const expenses = journalEntries
      .filter(e => e.status === 'Posted')
      .reduce((sum, e) => {
        const entryExpenses = e.lines
          .filter(l => expenseAccountIds.includes(l.accountId))
          .reduce((s, l) => s + (l.debit - l.credit), 0);
        return sum + entryExpenses;
      }, 0);

    // E) Net Profit
    const netProfit = grossProfit - expenses;

    // Today's Summary
    const todaySales = sales
      .filter(s => s.InvoiceStatus === 'POSTED' && s.date.startsWith(today))
      .reduce((sum, s) => sum + (s.finalTotal || 0), 0);
    
    const todayCogs = sales
      .filter(s => s.InvoiceStatus === 'POSTED' && s.date.startsWith(today))
      .reduce((sum, s) => sum + (s.totalCost || 0), 0);

    const todayExpenses = journalEntries
      .filter(e => e.status === 'Posted' && e.date.startsWith(today))
      .reduce((sum, e) => {
        const entryExpenses = e.lines
          .filter(l => expenseAccountIds.includes(l.accountId))
          .reduce((s, l) => s + (l.debit - l.credit), 0);
        return sum + entryExpenses;
      }, 0);

    const todayProfit = (todaySales - todayCogs) - todayExpenses;

    const todaySummary = {
      sales: todaySales,
      profit: todayProfit,
      expenses: todayExpenses
    };

    // 3) Smart Analytics
    
    // A) Top Selling Items
    const productSalesMap: Record<string, number> = {};
    sales.filter(s => s.InvoiceStatus === 'POSTED').forEach(s => {
      s.items.forEach(item => {
        productSalesMap[item.product_id] = (productSalesMap[item.product_id] || 0) + item.qty;
      });
    });

    const topSellingItems = Object.entries(productSalesMap)
      .map(([id, qty]) => ({
        id,
        qty,
        name: products.find(p => p.id === id)?.Name || 'Unknown'
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // B) Most Profitable Items
    const productProfitMap: Record<string, number> = {};
    sales.filter(s => s.InvoiceStatus === 'POSTED').forEach(s => {
      s.items.forEach(item => {
        // Profit = (Sale Price - Avg Cost) * Qty
        // For simplicity, we use the stored totalCost if available or estimate
        const itemRevenue = item.price * item.qty;
        const itemCost = (s.totalCost || 0) * (itemRevenue / (s.finalTotal || 1));
        const itemProfit = itemRevenue - itemCost;
        productProfitMap[item.product_id] = (productProfitMap[item.product_id] || 0) + itemProfit;
      });
    });

    const mostProfitableItems = Object.entries(productProfitMap)
      .map(([id, profit]) => ({
        id,
        profit,
        name: products.find(p => p.id === id)?.Name || 'Unknown'
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // C) Slow Moving Items (not sold in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const slowMovingItems = products.filter(p => {
      const lastSale = sales
        .filter(s => s.items.some(i => i.product_id === p.id))
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return !lastSale || new Date(lastSale.date) < thirtyDaysAgo;
    }).slice(0, 5);

    // D) Low Stock Alert
    const lowStockAlerts = products.filter(p => p.StockQuantity < (p.MinLevel || 5));

    // E) Expiry Alert
    const medicineBatches = await db.db.medicineBatches.toArray();
    const expiryAlerts = medicineBatches
      .filter(b => b.ExpiryDate && new Date(b.ExpiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) // 90 days
      .sort((a, b) => a.ExpiryDate.localeCompare(b.ExpiryDate))
      .slice(0, 10);

    // 4) Anomaly Detection
    const anomalies = [];
    
    // Sudden drop in sales (compare today with avg of last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (i + 1));
      return d.toISOString().split('T')[0];
    });
    const avgSalesLast7Days = last7Days.reduce((sum, date) => {
      return sum + sales.filter(s => s.date.startsWith(date)).reduce((s, inv) => s + (inv.finalTotal || 0), 0);
    }, 0) / 7;

    if (todaySales < avgSalesLast7Days * 0.5 && avgSalesLast7Days > 100) {
      anomalies.push({ type: 'SALES_DROP', message: 'انخفاض مفاجئ في المبيعات اليوم مقارنة بالمتوسط الأسبوعي', severity: 'HIGH' });
    }

    // Unusual expense spikes
    const avgExpensesLast7Days = last7Days.reduce((sum, date) => {
      return sum + journalEntries.filter(e => e.date.startsWith(date)).reduce((s, entry) => {
        return s + entry.lines.filter(l => expenseAccountIds.includes(l.accountId)).reduce((sl, l) => sl + (l.debit - l.credit), 0);
      }, 0);
    }, 0) / 7;

    if (todayExpenses > avgExpensesLast7Days * 2 && todayExpenses > 500) {
      anomalies.push({ type: 'EXPENSE_SPIKE', message: 'ارتفاع غير عادي في المصروفات اليوم', severity: 'MEDIUM' });
    }

    // Negative profit items
    const negativeProfitItems = mostProfitableItems.filter(item => item.profit < 0);
    if (negativeProfitItems.length > 0) {
      anomalies.push({ type: 'NEGATIVE_PROFIT', message: `يوجد ${negativeProfitItems.length} أصناف تحقق خسائر`, severity: 'HIGH' });
    }

    // 5) Risk Score
    let riskPoints = 0;
    if (netProfit < totalSales * 0.05) riskPoints += 2;
    if (expenses > grossProfit * 0.7) riskPoints += 2;
    if (expiryAlerts.length > 5) riskPoints += 1;
    if (lowStockAlerts.length > 10) riskPoints += 1;
    if (anomalies.some(a => a.severity === 'HIGH')) riskPoints += 2;

    let riskScore: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskPoints >= 5) riskScore = 'HIGH';
    else if (riskPoints >= 3) riskScore = 'MEDIUM';

    // 9) Optional Gemini Summary
    let recommendations = '';
    const now = Date.now();
    const cachedAIStr = localStorage.getItem(this.AI_CACHE_KEY);
    let cachedAI = null;
    
    if (cachedAIStr) {
      try {
        cachedAI = JSON.parse(cachedAIStr);
      } catch (e) {}
    }
    
    if (!forceRefreshAI && cachedAI && (now - cachedAI.timestamp < this.AI_CACHE_DURATION)) {
      recommendations = cachedAI.recommendations;
    } else {
      try {
        const summaryData = {
          totalSales,
          totalPurchases,
          netProfit,
          expenses,
          alertsCount: lowStockAlerts.length + expiryAlerts.length + anomalies.length,
          riskScore,
          todaySummary
        };
        recommendations = await GeminiAnalyticsService.analyzeData("قدم ملخصاً ذكياً وتوصيات بناءً على هذه المؤشرات المالية والتشغيلية للمؤسسة اليوم.", summaryData);
        localStorage.setItem(this.AI_CACHE_KEY, JSON.stringify({ recommendations, timestamp: now }));
      } catch (e) {
        console.error("Gemini summary failed:", e);
        recommendations = cachedAI?.recommendations || "تعذر الحصول على ملخص ذكي حالياً.";
      }
    }

    return {
      totalSales,
      totalPurchases,
      cogs,
      grossProfit,
      netProfit,
      expenses,
      topSellingItems,
      mostProfitableItems,
      slowMovingItems,
      lowStockAlerts,
      expiryAlerts,
      anomalies,
      riskScore,
      todaySummary,
      recommendations,
      lastUpdated: new Date().toISOString()
    };
  }
}
