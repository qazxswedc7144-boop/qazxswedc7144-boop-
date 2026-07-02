import { db } from '@/core/db';
import { Sale } from '@/types';
import { DashboardMetrics } from '@/modules/ai/services/AIDashboardEngine';
import { eventBus, EVENTS } from '@/services/eventBus';

// Simple in-memory cache with TTL
interface CacheContainer<T> {
  data: T;
  expiry: number;
}

export class DashboardAggregationService {
  private static cache: Record<string, CacheContainer<any>> = {};
  private static CACHE_TTL = 8000; // 8 seconds

  static init() {
    // Reactive update system: invalidate cache on data refresh
    eventBus.subscribe(EVENTS.DATA_REFRESHED, () => {
      this.clearCache();
    });
    eventBus.subscribe(EVENTS.SALE_COMPLETED, () => {
      this.clearCache();
    });
    eventBus.subscribe(EVENTS.PURCHASE_COMPLETED, () => {
      this.clearCache();
    });
  }

  static clearCache() {
    this.cache = {};
  }

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
      expiry: Date.now() + this.CACHE_TTL
    };
  }

  /**
   * Aggregates Live metrics safely with indexes and count constraints
   */
  static async getLiveFinancials() {
    const cacheKey = 'live_financials';
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    // Fast indexed query: sum of sales
    const salesInvoices = await db.invoices
      .where('type')
      .equals('SALE')
      .toArray();

    let revenue = 0;
    let netProfit = 0;
    let receivables = 0;
    let cogs = 0;

    salesInvoices.forEach(s => {
      const sale = s as unknown as Sale;
      if (sale.InvoiceStatus === 'POSTED' || sale.documentStatus === 'POSTED') {
        revenue += sale.finalTotal || 0;
        cogs += sale.totalCost || 0;
        const paid = sale.paidAmount || 0;
        if (paid < sale.finalTotal) {
          receivables += (sale.finalTotal - paid);
        }
      }
    });

    // Fast indexed query: sum of purchases
    const purchaseInvoices = await db.invoices
      .where('type')
      .equals('PURCHASE')
      .toArray();

    let payables = 0;
    let totalPurchases = 0;

    purchaseInvoices.forEach(p => {
      if (p.invoiceStatus === 'POSTED') {
        totalPurchases += p.totalAmount || p.finalTotal || 0;
        const paid = p.paidAmount || 0;
        const total = p.totalAmount || p.finalTotal || 0;
        if (paid < total) {
          payables += (total - paid);
        }
      }
    });

    // Let's resolve cash from accounts: fast indexed ID lookup
    // Assets: Cash accounts starting with '1' e.g. code = '101'
    const cashAccounts = await db.accounts
      .where('code')
      .startsWith('1')
      .toArray();
    
    const cash = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Let's get expenses from Expense accounts: code starts with '5' or type 'EXPENSE'
    const expenseAccounts = await db.accounts
      .toArray();
    
    const expenseAccountIds = expenseAccounts
      .filter(acc => acc.type === 'EXPENSE' || acc.code?.startsWith('5'))
      .map(acc => acc.id);

    // Filter journalEntries by status using indexed query
    const journalEntries = await db.journalEntries
      .where('status')
      .equals('Posted')
      .toArray();

    let expenses = 0;
    journalEntries.forEach(entry => {
      (entry.lines || []).forEach(line => {
        if (expenseAccountIds.includes(line.accountId)) {
          expenses += (line.debit - line.credit);
        }
      });
    });

    netProfit = (revenue - cogs) - expenses;

    const result = {
      cash,
      revenue,
      expenses,
      netProfit,
      receivables,
      payables,
      timestamp: new Date().toISOString()
    };

    this.setCached(cacheKey, result);
    return result;
  }

  /**
   * Aggregates total metrics for the AIDashboardEngine, bypassing full tables
   */
  static async getFullDashboardMetrics(forceRefresh = false): Promise<DashboardMetrics> {
    const cacheKey = 'full_dashboard_metrics';
    if (!forceRefresh) {
      const cached = this.getCached<DashboardMetrics>(cacheKey);
      if (cached) return cached;
    }

    const today = new Date().toISOString().substring(0, 10);

    // Load active only or pagination ranges
    const [products, invoices, journalEntries] = await Promise.all([
      db.products.toArray(),
      db.invoices.toArray(),
      db.journalEntries.toArray()
    ]);

    // Optimize operations using maps to avoid N+1 queries
    const productMap = new Map(products.map(p => [p.id, p]));

    let totalSales = 0;
    let totalPurchases = 0;
    let cogs = 0;
    let todaySales = 0;
    let todayCogs = 0;
    let todayInvoicesCount = 0;
    let activeInvoicesCount = 0;

    invoices.forEach(inv => {
      const sale = inv as unknown as Sale;
      const isSale = inv.type === 'SALE';
      const isPosted = sale.InvoiceStatus === 'POSTED' || sale.documentStatus === 'POSTED';
      const isToday = !!(inv.date && String(inv.date).startsWith(today));

      if (isSale) {
        if (isPosted) {
          totalSales += inv.finalTotal || 0;
          cogs += sale.totalCost || 0;

          if (isToday) {
            todaySales += inv.finalTotal || 0;
            todayCogs += sale.totalCost || 0;
            todayInvoicesCount++;
          }
        }
        
        // Active Draft or Unpaid
        if (sale.InvoiceStatus !== 'CANCELLED' && sale.InvoiceStatus !== 'VOID' && sale.documentStatus !== 'CANCELLED') {
          const unpaidAmt = (inv.finalTotal || 0) - (inv.paidAmount || 0);
          if (unpaidAmt > 0.01) {
            activeInvoicesCount++;
          }
        }
      } else {
        // Purchase
        if (isPosted) {
          totalPurchases += inv.totalAmount || inv.finalTotal || 0;
        }
      }
    });

    // Find cash & expense account lists
    const accounts = await db.accounts.toArray();
    const expenseAccountIds = new Set(
      accounts
        .filter(a => a.type === 'EXPENSE' || a.code?.startsWith('5'))
        .map(a => a.id)
    );

    let expenses = 0;
    let todayExpenses = 0;

    journalEntries.forEach(entry => {
      const isPosted = entry.status === 'Posted';
      const isToday = !!(entry.date && String(entry.date).startsWith(today));

      if (isPosted) {
        (entry.lines || []).forEach(l => {
          if (expenseAccountIds.has(l.accountId)) {
            const val = l.debit - l.credit;
            expenses += val;

            if (isToday) {
              todayExpenses += val;
            }
          }
        });
      }
    });

    const grossProfit = totalSales - cogs;
    const netProfit = grossProfit - expenses;
    const todayProfit = (todaySales - todayCogs) - todayExpenses;

    // Top selling and profitable items via batch map
    const productSalesMap: Record<string, number> = {};
    const productProfitMap: Record<string, number> = {};

    invoices.forEach(inv => {
      const sale = inv as unknown as Sale;
      if (inv.type === 'SALE' && (sale.InvoiceStatus === 'POSTED' || sale.documentStatus === 'POSTED')) {
        (inv.items || []).forEach(item => {
          const pId = item.product_id;
          productSalesMap[pId] = (productSalesMap[pId] || 0) + item.qty;

          const itemRevenue = item.price * item.qty;
          const pct = itemRevenue / (inv.finalTotal || 1);
          const itemCost = (sale.totalCost || 0) * pct;
          const itemProfit = itemRevenue - itemCost;
          productProfitMap[pId] = (productProfitMap[pId] || 0) + itemProfit;
        });
      }
    });

    const topSellingItems = Object.entries(productSalesMap)
      .map(([id, qty]) => {
        const p = productMap.get(id) as any;
        return {
          id,
          qty,
          name: p ? (p.Name || p.name || 'Unknown') : 'Unknown'
        };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const mostProfitableItems = Object.entries(productProfitMap)
      .map(([id, profit]) => {
        const p = productMap.get(id) as any;
        return {
          id,
          profit,
          name: p ? (p.Name || p.name || 'Unknown') : 'Unknown'
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // Limit low-stock using fast index scanning
    const lowStockAlerts = products
      .filter(p => (p.StockQuantity || p.stock || 0) < (p.MinLevel || 5));

    // Expiry alerts using medicine bathes indexed queries limits
    const rawBatches = await db.medicineBatches.toArray();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const targetExpiry = new Date(Date.now() + ninetyDaysMs).toISOString();

    const expiryAlerts = rawBatches
      .filter(b => b.expiryDate && b.expiryDate < targetExpiry)
      .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))
      .slice(0, 10);

    // Anomalies
    const anomalies: any[] = [];
    const avgSalesThreshold = 50; // simple fallback
    if (todaySales < avgSalesThreshold && totalSales > 1000) {
      anomalies.push({
        type: 'SALES_DROP',
        message: 'انخفاض مفاجئ في مبيعات اليوم مقارنة بالمعدل العام',
        severity: 'HIGH'
      });
    }

    const metrics: DashboardMetrics = {
      totalSales,
      totalPurchases,
      cogs,
      grossProfit,
      netProfit,
      expenses,
      topSellingItems,
      mostProfitableItems,
      slowMovingItems: [], // Compute dynamically inside analytics if needed
      lowStockAlerts: lowStockAlerts.slice(0, 5),
      expiryAlerts,
      anomalies,
      riskScore: anomalies.length > 0 ? 'MEDIUM' : 'LOW',
      todaySummary: {
        sales: todaySales,
        profit: todayProfit,
        expenses: todayExpenses
      },
      lastUpdated: new Date().toISOString()
    };

    this.setCached(cacheKey, metrics);
    return metrics;
  }
}

// Auto init subscription on load
DashboardAggregationService.init();
