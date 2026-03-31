
import { db } from './database';
import { 
  AccountingEntry, JournalLine, Account, AccountType, 
  InventoryItem, Product, Sale, Purchase, ItemProfitEntry,
  CustomerProfitEntry, SupplierProfitEntry, ExpiringItemEntry
} from '../types';
import { reportCache } from './reportCache.service';

export class ReportEngine {
  
  /**
   * 1. Trial Balance - ميزان المراجعة
   * Source of truth: journal_entries
   */
  static async getTrialBalance(startDate?: string, endDate?: string) {
    const cacheKey = `trial_balance_${startDate}_${endDate}`;
    const cached = reportCache.get<any>(cacheKey);
    if (cached) return cached;

    const entries = await db.getJournalEntries();
    const filteredEntries = this.filterByDate(entries, startDate, endDate);
    
    const accountBalances: Record<string, { name: string, debit: number, credit: number, balance: number }> = {};
    const accounts = await db.db.accounts.toArray();
    
    // Initialize accounts
    accounts.forEach(acc => {
      accountBalances[acc.id] = { name: acc.name, debit: 0, credit: 0, balance: 0 };
    });

    for (const entry of filteredEntries) {
      for (const line of entry.lines) {
        if (!accountBalances[line.accountId]) {
          accountBalances[line.accountId] = { name: line.accountName || line.accountId, debit: 0, credit: 0, balance: 0 };
        }
        accountBalances[line.accountId].debit += line.debit;
        accountBalances[line.accountId].credit += line.credit;
      }
    }

    // Calculate final balances
    const result = Object.entries(accountBalances).map(([id, data]) => {
      const acc = accounts.find(a => a.id === id);
      const balance = data.debit - data.credit;
      return {
        accountId: id,
        accountCode: acc?.code || '',
        ...data,
        balance: acc?.balance_type === 'CREDIT' ? -balance : balance
      };
    });

    const totals = result.reduce((acc, curr) => {
      acc.debit += curr.debit;
      acc.credit += curr.credit;
      return acc;
    }, { debit: 0, credit: 0 });

    const finalResult = { accounts: result, totals };
    reportCache.set(cacheKey, finalResult);
    return finalResult;
  }

  /**
   * 2. Income Statement - قائمة الدخل
   * Compute: Revenue - COGS = Gross Profit - Expenses = Net Profit
   */
  static async getIncomeStatement(startDate?: string, endDate?: string) {
    const cacheKey = `income_statement_${startDate}_${endDate}`;
    const cached = reportCache.get<any>(cacheKey);
    if (cached) return cached;

    const trialBalance = await this.getTrialBalance(startDate, endDate) as any;
    const accounts = await db.db.accounts.toArray();
    
    let revenue = 0;
    let cogs = 0;
    let expenses = 0;

    for (const accBalance of trialBalance.accounts) {
      const account = accounts.find(a => a.id === accBalance.accountId);
      if (!account) continue;

      if (account.type === 'REVENUE') {
        revenue += (accBalance.credit - accBalance.debit);
      } else if (account.type === 'EXPENSE') {
        // Check if it's COGS (Cost of Goods Sold)
        if (account.code === 'ACC-COGS-001' || account.name.includes('تكلفة')) {
          cogs += (accBalance.debit - accBalance.credit);
        } else {
          expenses += (accBalance.debit - accBalance.credit);
        }
      }
    }

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    const result = {
      revenue,
      cogs,
      grossProfit,
      expenses,
      netProfit,
      margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0
    };

    reportCache.set(cacheKey, result);
    return result;
  }

  /**
   * 3. Inventory Valuation - تقييم المخزون
   * Compute: total_quantity × average_cost
   */
  static async getInventoryValuation() {
    const cacheKey = 'inventory_valuation';
    const cached = reportCache.get<any>(cacheKey);
    if (cached) return cached;

    const products = await db.getProducts();
    let totalValue = 0;
    const items = [];

    for (const p of products) {
      const value = (p.StockQuantity || 0) * (p.CostPrice || 0);
      totalValue += value;
      items.push({
        id: p.id,
        name: p.Name,
        qty: p.StockQuantity,
        avgCost: p.CostPrice,
        totalValue: value
      });
    }

    const result = { items, totalValue };
    reportCache.set(cacheKey, result);
    return result;
  }

  /**
   * 4. Account Statement - كشف حساب
   */
  static async getAccountStatement(accountId: string, startDate?: string, endDate?: string) {
    const entries = await db.getJournalEntries();
    const filteredEntries = this.filterByDate(entries, startDate, endDate);
    
    let runningBalance = 0;
    const movements = [];

    // Sort by date ascending for statement
    filteredEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const entry of filteredEntries) {
      const lines = entry.lines.filter(l => l.accountId === accountId);
      for (const line of lines) {
        runningBalance += (line.debit - line.credit);
        movements.push({
          date: entry.date,
          description: entry.description,
          debit: line.debit,
          credit: line.credit,
          balance: runningBalance,
          refId: entry.sourceId
        });
      }
    }

    return { accountId, movements, finalBalance: runningBalance };
  }

  /**
   * 5. Analytics Summary - ملخص التحليلات
   */
  static async getAnalyticsSummary() {
    const cacheKey = 'analytics_summary';
    const cached = reportCache.get<any>(cacheKey);
    if (cached) return cached;

    const products = await db.getProducts();
    
    // Top selling items
    const topSelling = [...products]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 10)
      .map(p => ({ id: p.id, name: p.Name, count: p.usageCount || 0 }));

    // Top profit items
    const itemProfits = await db.db.itemProfits.toArray();
    const topProfit = itemProfits
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, 10);

    // Average prices
    const avgSellingPrice = products.reduce((sum, p) => sum + (p.UnitPrice || 0), 0) / (products.length || 1);
    const avgPurchasePrice = products.reduce((sum, p) => sum + (p.LastPurchasePrice || 0), 0) / (products.length || 1);

    const result = {
      topSelling,
      topProfit,
      avgSellingPrice,
      avgPurchasePrice
    };

    reportCache.set(cacheKey, result);
    return result;
  }

  /**
   * 6. Expiry Management - إدارة الصلاحية
   */
  static async getExpiryReport() {
    const batches = await db.db.medicineBatches.toArray();
    const today = new Date();
    
    const report = batches
      .filter(b => b.Quantity > 0)
      .map(b => {
        const expiry = new Date(b.ExpiryDate);
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          productId: b.productId,
          batchId: b.BatchID,
          expiryDate: b.ExpiryDate,
          quantity: b.Quantity,
          daysRemaining: diffDays,
          status: diffDays < 0 ? 'EXPIRED' : diffDays < 90 ? 'ALERT' : 'OK'
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    return report;
  }

  /**
   * 7. Customer Profitability - ربحية العملاء
   */
  static async getCustomerProfitability() {
    return await db.db.customerProfits
      .orderBy('totalProfit')
      .reverse()
      .toArray();
  }

  /**
   * 8. Supplier Profitability - ربحية الموردين
   */
  static async getSupplierProfitability() {
    return await db.db.supplierProfits
      .orderBy('grossProfit')
      .reverse()
      .toArray();
  }

  private static filterByDate(entries: AccountingEntry[], start?: string, end?: string) {
    if (!start && !end) return entries;
    const startDate = start ? new Date(start) : new Date(0);
    const endDate = end ? new Date(end) : new Date();
    endDate.setHours(23, 59, 59, 999);

    return entries.filter(e => {
      const d = new Date(e.date);
      return d >= startDate && d <= endDate;
    });
  }
}
