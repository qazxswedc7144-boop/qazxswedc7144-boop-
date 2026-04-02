
import { db } from '../services/database';
import { 
  AccountingEntry, 
  JournalLine, 
  Account, 
  AccountType, 
  Product, 
  InventoryTransaction, 
  FinancialTransaction, 
  ItemUsageLog,
  ItemProfitEntry,
  CustomerProfitEntry,
  SupplierProfitEntry,
  AccountMovement
} from '../types';
import { reportCache } from '../services/reportCache.service';

export class ReportEngine {
  
  /**
   * 1. TRIAL BALANCE
   * Group journal_lines by account_id
   * Calculate: debit = SUM(debit), credit = SUM(credit), balance = debit - credit
   */
  static async getTrialBalance(startDate?: string, endDate?: string) {
    const cacheKey = `trial_balance_${startDate}_${endDate}`;
    const cached = reportCache.get<any>(cacheKey);
    if (cached) return cached;

    // Use Dexie for optimized fetching if possible, but for TB we need totals
    const entries = await db.getJournalEntries();
    const filteredEntries = this.filterByDate(entries, startDate, endDate);
    
    const accounts = await db.getAccounts();
    const accountBalances: Record<string, { name: string, code: string, debit: number, credit: number, balance: number }> = {};

    accounts.forEach(acc => {
      accountBalances[acc.id] = { 
        name: acc.name, 
        code: acc.code,
        debit: 0, 
        credit: 0,
        balance: 0
      };
    });

    filteredEntries.forEach(entry => {
      entry.lines.forEach(line => {
        const acc = accountBalances[line.accountId];
        if (acc) {
          acc.debit += (line.debit || 0);
          acc.credit += (line.credit || 0);
        }
      });
    });

    const result = Object.entries(accountBalances).map(([id, data]) => {
      const balance = data.debit - data.credit;
      return {
        accountId: id,
        account_name: data.name,
        accountCode: data.code,
        debit: data.debit,
        credit: data.credit,
        balance: balance
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
   * 2. INCOME STATEMENT
   * Calculate: 
   * Revenue = SUM(credit where account.type = revenue)
   * COGS = SUM(debit where account.type = expense AND name = COGS)
   * Expenses = SUM(debit where account.type = expense AND name != COGS)
   * Net Profit = Revenue - COGS - Expenses
   */
  static async getIncomeStatement(startDate?: string, endDate?: string) {
    const cacheKey = `income_statement_${startDate}_${endDate}`;
    const cached = reportCache.get<any>(cacheKey);
    if (cached) return cached;

    const entries = await db.getJournalEntries();
    const filteredEntries = this.filterByDate(entries, startDate, endDate);
    
    const accounts = await db.getAccounts();
    const revenueAccounts = accounts.filter(a => a.type === 'REVENUE').map(a => a.id);
    const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE').map(a => a.id);
    
    let revenue = 0;
    let cogs = 0;
    let expenses = 0;

    filteredEntries.forEach(entry => {
      entry.lines.forEach(line => {
        if (revenueAccounts.includes(line.accountId)) {
          revenue += (line.credit - line.debit);
        } else if (expenseAccounts.includes(line.accountId)) {
          // Check if it's COGS
          const acc = accounts.find(a => a.id === line.accountId);
          if (acc && (acc.name.includes('COGS') || acc.name.includes('تكلفة'))) {
            cogs += (line.debit - line.credit);
          } else {
            expenses += (line.debit - line.credit);
          }
        }
      });
    });

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
   * 3. ITEM PROFIT
   * From journal + stock: profit = (sales - cost)
   * Group by item_id
   */
  static async getItemProfit(startDate?: string, endDate?: string): Promise<ItemProfitEntry[]> {
    const usageLogs = await db.db.itemUsageLog.toArray();
    const filteredLogs = usageLogs.filter(log => {
      if (startDate && log.timestamp < startDate) return false;
      if (endDate && log.timestamp > endDate) return false;
      return log.type === 'SALE';
    });

    const products = await db.getProducts();
    const productMap = new Map<string, Product>();
    products.forEach(p => productMap.set(p.id, p));

    const profits: Record<string, ItemProfitEntry> = {};

    filteredLogs.forEach(log => {
      const product = productMap.get(log.productId);
      if (!product) return;

      if (!profits[log.productId]) {
        profits[log.productId] = {
          id: `PROF-${log.productId}`,
          productId: log.productId,
          itemName: product.Name,
          period: { start: startDate || '', end: endDate || '' },
          totalSales: 0,
          totalCost: 0,
          grossProfit: 0,
          profitMargin: 0,
          unitsSold: 0
        };
      }

      const p = profits[log.productId];
      const cost = product.CostPrice || 0;
      p.unitsSold += log.qty;
      p.totalSales += log.qty * log.price;
      p.totalCost += log.qty * cost;
      p.grossProfit = p.totalSales - p.totalCost;
      p.profitMargin = p.totalSales > 0 ? (p.grossProfit / p.totalSales) * 100 : 0;
    });

    return Object.values(profits);
  }

  /**
   * 4. CUSTOMER PROFIT
   * Group journal by customer_id: total_sales, total_profit
   */
  static async getCustomerProfit(startDate?: string, endDate?: string): Promise<CustomerProfitEntry[]> {
    const entries = await db.getJournalEntries();
    const filteredEntries = this.filterByDate(entries, startDate, endDate).filter(e => e.sourceType === 'SALE');
    
    const financialTransactions = await db.db.financialTransactions.toArray();
    const ftMap = new Map<string, FinancialTransaction>();
    financialTransactions.forEach(ft => ftMap.set(ft.Reference_ID, ft));

    const profits: Record<string, CustomerProfitEntry> = {};

    for (const entry of filteredEntries) {
      const ft = ftMap.get(entry.sourceId);
      if (!ft || ft.Entity_Type !== 'Customer') continue;

      const customerName = ft.Entity_Name;

      if (!profits[customerName]) {
        profits[customerName] = {
          id: `CUST-PROF-${customerName}`,
          customerId: ft.Reference_ID,
          customerName: customerName,
          period: { start: startDate || '', end: endDate || '' },
          totalPurchases: 0,
          totalProfit: 0,
          transactionsCount: 0
        };
      }

      const p = profits[customerName];
      p.transactionsCount++;
      
      let revenue = 0;
      let cogs = 0;

      entry.lines.forEach(line => {
        if (line.accountId.includes('REV') || line.accountId.includes('SALES')) revenue += (line.credit - line.debit);
        if (line.accountId.includes('COGS')) cogs += (line.debit - line.credit);
      });

      p.totalPurchases += revenue;
      p.totalProfit += (revenue - cogs);
    }

    return Object.values(profits);
  }

  /**
   * 5. SUPPLIER PROFIT
   * Group purchase vs sale: cost vs resale
   */
  static async getSupplierProfit(startDate?: string, endDate?: string): Promise<SupplierProfitEntry[]> {
    const usageLogs = await db.db.itemUsageLog.toArray();
    const filteredLogs = usageLogs.filter(log => {
      if (startDate && log.timestamp < startDate) return false;
      if (endDate && log.timestamp > endDate) return false;
      return true;
    });

    const profits: Record<string, SupplierProfitEntry> = {};

    filteredLogs.forEach(log => {
      if (!log.sourceSupplierId) return;

      if (!profits[log.sourceSupplierId]) {
        profits[log.sourceSupplierId] = {
          id: `SUPP-PROF-${log.sourceSupplierId}`,
          supplierId: log.sourceSupplierId,
          supplierName: `مورد ${log.sourceSupplierId}`,
          period: { start: startDate || '', end: endDate || '' },
          totalPurchases: 0,
          totalSales: 0,
          grossProfit: 0,
          transactionsCount: 0
        };
      }

      const p = profits[log.sourceSupplierId];
      if (log.type === 'PURCHASE') {
        p.totalPurchases += log.qty * log.price;
      } else {
        p.totalSales += log.qty * log.price;
        // Estimate cost from product cost if available
        const cost = log.price * 0.7; // Placeholder
        p.grossProfit += (log.qty * log.price) - (log.qty * cost);
      }
      p.transactionsCount++;
    });

    return Object.values(profits);
  }

  /**
   * 6. ACCOUNT STATEMENT
   * For each account: opening balance + debit - credit = closing balance
   */
  static async getAccountStatement(accountId: string, startDate?: string, endDate?: string): Promise<AccountMovement[]> {
    const entries = await db.getJournalEntries();
    const allLines = entries.flatMap(e => e.lines.map(l => ({ 
      ...l, 
      date: e.date, 
      description: e.description || '', 
      sourceType: e.sourceType, 
      sourceId: e.sourceId 
    })));
    
    const accountLines = allLines.filter(l => l.accountId === accountId);
    
    let openingBalance = 0;
    if (startDate) {
      openingBalance = accountLines
        .filter(l => l.date < startDate)
        .reduce((acc, l) => acc + (l.debit - l.credit), 0);
    }

    const filteredLines = accountLines.filter(l => {
      if (startDate && l.date < startDate) return false;
      if (endDate && l.date > endDate) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));

    let currentBalance = openingBalance;
    const movements: AccountMovement[] = filteredLines.map(l => {
      currentBalance += (l.debit - l.credit);
      return {
        movementId: l.lineId,
        type: l.debit > 0 ? 'income' : 'expense',
        amount: l.debit > 0 ? l.debit : l.credit,
        description: l.description,
        date: l.date,
        balance: currentBalance,
        reference: { type: l.sourceType, id: l.sourceId }
      };
    });

    return movements;
  }

  /**
   * 7. INVENTORY VALUE
   * quantity × cost
   */
  static async getInventoryValue(): Promise<number> {
    const products = await db.getProducts();
    return products.reduce((acc, p) => acc + (p.StockQuantity * (p.CostPrice || 0)), 0);
  }

  /**
   * 8. ITEM MOVEMENTS
   * Use stock_movements: before, change, after
   */
  static async getItemMovements(productId: string, startDate?: string, endDate?: string): Promise<InventoryTransaction[]> {
    const movements = await db.db.inventoryTransactions.where('productId').equals(productId).toArray();
    return movements.filter(m => {
      if (startDate && m.TransactionDate < startDate) return false;
      if (endDate && m.TransactionDate > endDate) return false;
      return true;
    }).sort((a, b) => a.TransactionDate.localeCompare(b.TransactionDate));
  }

  /**
   * Helper: Filter entries by date
   */
  private static filterByDate(entries: AccountingEntry[], startDate?: string, endDate?: string): AccountingEntry[] {
    return entries.filter(e => {
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    });
  }

  /**
   * PERFORMANCE: Pagination helper
   */
  static paginate<T>(items: T[], page: number, pageSize: number): T[] {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }

  /**
   * ANALYTICS SUMMARY
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
    const itemProfits = await this.getItemProfit();
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
}
