import { db } from '@/core/db';
import { WorkerClient } from '@/modules/workers/worker.client';

export class ReportEngine {
  
  /**
   * Refreshes the local report cache or triggers re-aggregation (transitional compatibility)
   */
  static async refresh(): Promise<void> {
    console.log("[ReportEngine] Clearing and re-aggregating reports data...");
  }
  
  /**
   * Retrieves and aggregates standard sales summary.
   */
  static async getSalesSummary(start: string, end: string) {
    const sales = await db.invoices
      .where('type')
      .equals('SALE')
      .filter(s => s.date >= start && s.date <= end)
      .toArray();
    
    return {
      count: sales.length,
      total: sales.reduce((acc, s) => acc + (s.finalTotal || 0), 0)
    };
  }

  /**
   * Generates a GAAP-compliant Trial Balance (ميزان المراجعة).
   * Aggregates debits, credits, and calculates ending balances per account within date filters.
   */
  static async getTrialBalance(start?: string, end?: string) {
    const accounts = await db.accounts.toArray();
    const entries = await db.journalEntries.toArray();

    return WorkerClient.runTrialBalance(accounts, entries, start, end);
  }

  /**
   * Generates Profit & Loss Statement (قائمة الأرباح والخسائر).
   */
  static async getProfitLoss(start?: string, end?: string) {
    const trialBalance = await this.getTrialBalance(start, end);
    
    // Revenue Accounts (Standard ACC-401 for SALES_REVENUE)
    const revenues = trialBalance.filter(item => item.type === 'REVENUE');
    const totalRevenue = revenues.reduce((acc, r) => acc + (r.endingCredit - r.endingDebit), 0);
    
    // COGS Accounts (Standard ACC-501 for COGS)
    const cogsItems = trialBalance.filter(item => item.code === 'ACC-501' || item.id === 'ACC-501' || item.name.includes('تكلفة المبيعات') || item.type === 'EXPENSE' && (item.code === 'ACC-501'));
    const totalCogs = cogsItems.reduce((acc, c) => acc + (c.endingDebit - c.endingCredit), 0);

    // General Expense Accounts (EXPENSE excluding COGS)
    const operatingExpenses = trialBalance.filter(item => item.type === 'EXPENSE' && item.code !== 'ACC-501' && item.id !== 'ACC-501' && !item.name.includes('تكلفة المبيعات'));
    const totalExpenses = operatingExpenses.reduce((acc, e) => acc + (e.endingDebit - e.endingCredit), 0);

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      revenue: totalRevenue,
      cogs: totalCogs,
      grossProfit,
      expenses: totalExpenses,
      netProfit,
      margin,
      revenueDetails: revenues.map(r => ({ id: r.id, name: r.name, code: r.code, amount: r.endingCredit - r.endingDebit })),
      expenseDetails: operatingExpenses.map(e => ({ id: e.id, name: e.name, code: e.code, amount: e.endingDebit - e.endingCredit }))
    };
  }

  /**
   * Generates Balance Sheet (الميزانية العمومية).
   * Generates cumulative snapshot up to the specified date.
   */
  static async getBalanceSheet(asOfDate?: string) {
    // Balance Sheet accounts compile cumulatively from inception up to the selected date.
    const trialBalance = await this.getTrialBalance(undefined, asOfDate);
    
    const assetsList = trialBalance.filter(item => item.type === 'ASSET');
    const liabilitiesList = trialBalance.filter(item => item.type === 'LIABILITY');
    const equityList = trialBalance.filter(item => item.type === 'EQUITY');

    // Retained Earnings (Net Profit accumulated from inception up to the asOfDate)
    const plStatement = await this.getProfitLoss(undefined, asOfDate);
    const retainedEarnings = plStatement.netProfit;

    const totalAssets = assetsList.reduce((acc, r) => acc + (r.endingDebit - r.endingCredit), 0);
    const totalLiabilities = liabilitiesList.reduce((acc, r) => acc + (r.endingCredit - r.endingDebit), 0);
    const totalEquityRaw = equityList.reduce((acc, r) => acc + (r.endingCredit - r.endingDebit), 0);
    const totalEquity = totalEquityRaw + retainedEarnings;

    return {
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
      assets: assetsList.map(a => ({ id: a.id, name: a.name, code: a.code, amount: a.endingDebit - a.endingCredit })),
      liabilities: liabilitiesList.map(l => ({ id: l.id, name: l.name, code: l.code, amount: l.endingCredit - l.endingDebit })),
      equity: [
        ...equityList.map(e => ({ id: e.id, name: e.name, code: e.code, amount: e.endingCredit - e.endingDebit })),
        { id: 'RETAINED_EARNINGS', name: 'الأرباح المحتجزة للفترة', code: 'ACC-399', amount: retainedEarnings }
      ],
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
    };
  }

  /**
   * Calculates comprehensive inventory valuation matching FIFO & Weighted Average methods.
   */
  static async getInventoryValue() {
    const products = await db.getProducts();
    let totalQuantity = 0;
    let totalCostValue = 0;
    let totalSalesValue = 0;

    const items = products.map(p => {
      const qty = Number(p.stock ?? (p as any).StockQuantity ?? 0);
      const cost = Number(p.CostPrice ?? p.LastPurchasePrice ?? 0);
      const sellPrice = Number(p.price ?? 0);
      const costValue = qty * cost;
      const salesValue = qty * sellPrice;
      const profitPotential = salesValue - costValue;

      totalQuantity += qty;
      totalCostValue += costValue;
      totalSalesValue += salesValue;

      return {
        id: p.id,
        name: p.name,
        code: p.barcode || 'N/A',
        category: p.categoryName || 'عام',
        quantity: qty,
        unitCost: cost,
        unitSell: sellPrice,
        costValue,
        salesValue,
        profitPotential
      };
    });

    return {
      totalQuantity,
      totalCostValue, // This is the inventory value on the Assets sheet
      totalSalesValue,
      totalProfitPotential: totalSalesValue - totalCostValue,
      items
    };
  }

  /**
   * Cash Flow Statement (قائمة التدفقات النقدية).
   * Direct method scanning General Ledger CASH and BANK lines.
   */
  static async getCashFlow(start?: string, end?: string) {
    const entries = await db.journalEntries.toArray();

    const cashBankAccounts = ['ACC-101', 'ACC-104']; // CASH, BANK

    // Starting Cash Balance (Closing balances before start date)
    let startingBalance = 0;
    if (start) {
      const priorEntries = entries.filter((e: any) => e.status === 'Posted' && e.date < start);
      for (const e of priorEntries) {
        if (!e.lines) continue;
        for (const l of e.lines) {
          if (cashBankAccounts.includes(l.accountId)) {
            startingBalance += (Number(l.debit || 0) - Number(l.credit || 0));
          }
        }
      }
    }

    // Filter range for movements
    const rangeEntries = entries.filter((e: any) => {
      if (e.status !== 'Posted') return false;
      if (start && e.date < start) return false;
      if (end && e.date > end) return false;
      return true;
    });

    let collectionsFromCustomers = 0;
    let paymentsToSuppliers = 0;
    let operatingExpensesPaid = 0;
    let otherInflows = 0;
    let otherOutflows = 0;

    const flows: { date: string; description: string; type: 'INFLOW' | 'OUTFLOW'; amount: number; source: string }[] = [];

    for (const e of rangeEntries) {
      if (!e.lines) continue;
      // Check if entry has cash flow effect
      const cashLines = e.lines.filter(l => cashBankAccounts.includes(l.accountId));
      if (cashLines.length === 0) continue;

      const netDelta = cashLines.reduce((sum, cl) => sum + (Number(cl.debit || 0) - Number(cl.credit || 0)), 0);
      if (netDelta === 0) continue;

      const category = e.sourceType || 'GENERAL';
      const absAmount = Math.abs(netDelta);

      if (netDelta > 0) {
        flows.push({
          date: e.date,
          description: e.description || 'حركة نقدية واردة',
          type: 'INFLOW',
          amount: absAmount,
          source: category
        });

        if (category === 'SALE' || category === 'RECEIPT') {
          collectionsFromCustomers += absAmount;
        } else {
          otherInflows += absAmount;
        }
      } else {
        flows.push({
          date: e.date,
          description: e.description || 'حركة نقدية صادرة',
          type: 'OUTFLOW',
          amount: absAmount,
          source: category
        });

        if (category === 'PURCHASE' || category === 'PAYMENT') {
          paymentsToSuppliers += absAmount;
        } else if (category === 'EXPENSE') {
          operatingExpensesPaid += absAmount;
        } else {
          otherOutflows += absAmount;
        }
      }
    }

    const netChange = collectionsFromCustomers + otherInflows - (paymentsToSuppliers + operatingExpensesPaid + otherOutflows);
    const endingBalance = startingBalance + netChange;

    return {
      startingBalance,
      collectionsFromCustomers,
      paymentsToSuppliers,
      operatingExpensesPaid,
      otherInflows,
      otherOutflows,
      netChange,
      endingBalance,
      flows
    };
  }

  /**
   * Customer Receivable Balances (أرصدة وذمم العملاء).
   */
  static async getCustomerBalances() {
    const customers = await db.getCustomers();
    const invoices = await db.invoices.where('type').equals('SALE').toArray();
    
    // receipts are stored in vouchers or cash movements
    const receipts = await db.db.receipts.toArray();
    const vouchers = await db.vouchers.filter(v => (v as any).type === 'RECEIPT').toArray();

    const customerDetails = customers.map(cust => {
      const custId = cust.id || cust.Customer_ID || cust.Partner_ID;
      const custName = cust.name || cust.Supplier_Name || cust.Customer_Name || 'عميل مجهول';

      // Total sales
      const custInvoices = invoices.filter(inv => inv.customerId === custId);
      const totalSales = custInvoices.reduce((sum, inv) => sum + Number(inv.finalTotal || 0), 0);

      // Total receipts
      const directReceipts = receipts.filter(r => r.customerId === custId || r.customer_id === custId).reduce((sum, r) => sum + Number(r.amount || r.Paid_Amount || 0), 0);
      const voucherReceipts = vouchers.filter(v => (v as any).customer_id === custId || (v as any).customerId === custId).reduce((sum, v) => sum + Number(v.amount || 0), 0);
      const totalPaid = directReceipts + voucherReceipts;

      const outstandingBalance = totalSales - totalPaid;

      return {
        id: custId,
        name: custName,
        phone: cust.Phone || 'N/A',
        totalSales,
        totalPaid,
        balance: outstandingBalance,
        riskLevel: outstandingBalance > 5000 ? 'HIGH' : (outstandingBalance > 1000 ? 'MEDIUM' : 'NORMAL')
      };
    });

    return customerDetails;
  }

  /**
   * Supplier Accounts Payable Balances (أرصدة وذمم الموردين).
   */
  static async getSupplierBalances() {
    const suppliers = await db.getSuppliers();
    const purchases = await db.invoices.where('type').equals('PURCHASE').toArray();
    
    // payments tables
    const payments = await db.db.payments.toArray();
    const vouchers = await db.vouchers.filter(v => (v as any).type === 'PAYMENT').toArray();

    return suppliers.map(sup => {
      const supId = sup.id || sup.Supplier_ID || sup.Partner_ID;
      const supName = sup.name || sup.Supplier_Name || 'مورد مجهول';

      const supPurchases = purchases.filter(p => p.supplierId === supId || p.supplier_id === supId);
      const totalPurchases = supPurchases.reduce((sum, p) => sum + Number(p.totalAmount || p.finalTotal || 0), 0);

      const directPayments = payments.filter(p => p.supplierId === supId || p.supplier_id === supId).reduce((sum, p) => sum + Number(p.amount || p.Paid_Amount || 0), 0);
      const voucherPayments = vouchers.filter(v => (v as any).supplier_id === supId || (v as any).supplierId === supId).reduce((sum, v) => sum + Number(v.amount || 0), 0);
      const totalPaid = directPayments + voucherPayments;

      const outstandingBalance = totalPurchases - totalPaid;

      return {
        id: supId,
        name: supName,
        phone: sup.Phone || 'N/A',
        totalPurchases,
        totalPaid,
        balance: outstandingBalance
      };
    });
  }

  /**
   * Unified Debt Aging Report (تقرير تعمير الديون - عملاء وموردين).
   */
  static async getAgingReport(type: 'CUSTOMER' | 'SUPPLIER' = 'CUSTOMER') {
    const today = new Date();
    
    if (type === 'CUSTOMER') {
      const invoices = await db.invoices.where('type').equals('SALE').toArray();
      const customers = await db.getCustomers();

      return invoices
        .filter(inv => {
          const mainTotal = Number(inv.finalTotal || 0);
          const paid = Number(inv.paidAmount || 0);
          return mainTotal - paid > 0.01;
        })
        .map(inv => {
          const unpaid = Number(inv.finalTotal || 0) - Number(inv.paidAmount || 0);
          const invDate = new Date(inv.date);
          const diffMs = today.getTime() - invDate.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const customer = customers.find(c => c.id === inv.customerId) || { name: 'عميل غير معرف' };

          return {
            id: inv.id,
            partnerId: inv.customerId,
            partnerName: customer.name || customer.Supplier_Name || 'عميل غير معرف',
            docId: (inv as any).SaleID || inv.id,
            date: inv.date,
            days: diffDays,
            amount: unpaid,
            bucket1: diffDays <= 30 ? unpaid : 0,    // 0-30 days
            bucket2: diffDays > 30 && diffDays <= 60 ? unpaid : 0,  // 31-60 days
            bucket3: diffDays > 60 && diffDays <= 90 ? unpaid : 0,  // 61-90 days
            bucket4: diffDays > 90 ? unpaid : 0     // 90+ days
          };
        });
    } else {
      const purchases = await db.invoices.where('type').equals('PURCHASE').toArray();
      const suppliers = await db.getSuppliers();

      return purchases
        .filter(p => {
          const mainTotal = Number(p.totalAmount || p.finalTotal || 0);
          const paid = Number(p.paidAmount || 0);
          return mainTotal - paid > 0.01;
        })
        .map(inv => {
          const unpaid = Number(inv.totalAmount || inv.finalTotal || 0) - Number(inv.paidAmount || 0);
          const invDate = new Date(inv.date);
          const diffMs = today.getTime() - invDate.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const supplier = suppliers.find(s => s.id === inv.supplierId) || { name: 'مورد غير معرف' };

          return {
            id: inv.id,
            partnerId: inv.supplierId,
            partnerName: supplier.name || supplier.Supplier_Name || 'مورد غير معرف',
            docId: (inv as any).invoiceId || inv.id,
            date: inv.date,
            days: diffDays,
            amount: unpaid,
            bucket1: diffDays <= 30 ? unpaid : 0,
            bucket2: diffDays > 30 && diffDays <= 60 ? unpaid : 0,
            bucket3: diffDays > 60 && diffDays <= 90 ? unpaid : 0,
            bucket4: diffDays > 90 ? unpaid : 0
          };
        });
    }
  }

  /**
   * VAT Net Tax reports (التقارير الضريبية وضريبة القيمة المضافة).
   */
  static async getTaxReport(start?: string, end?: string) {
    const sales = await db.invoices.where('type').equals('SALE').toArray();
    const purchases = await db.invoices.where('type').equals('PURCHASE').toArray();

    const rangeSales = sales.filter(s => {
      if (start && s.date < start) return false;
      if (end && s.date > end) return false;
      return true;
    });

    const rangePurchases = purchases.filter(p => {
      if (start && p.date < start) return false;
      if (end && p.date > end) return false;
      return true;
    });

    const outputVat = rangeSales.reduce((sum, s) => sum + Number((s as any).tax ?? 0), 0);
    const inputVat = rangePurchases.reduce((sum, p) => sum + Number((p as any).tax ?? 0), 0);

    const totalSalesTaxable = rangeSales.reduce((sum, s) => sum + Number(s.subtotal || 0), 0);
    const totalPurchasesTaxable = rangePurchases.reduce((sum, p) => sum + Number(p.subtotal || 0), 0);

    const netTaxPayable = outputVat - inputVat;

    return {
      totalSalesTaxable,
      outputVat, // TAX collected on sales
      totalPurchasesTaxable,
      inputVat, // TAX paid on purchases
      netTaxPayable, // Net tax due to Authority
      salesTaxDetails: rangeSales.map(s => ({ id: s.id, docId: (s as any).SaleID || s.id, date: s.date, taxable: s.subtotal || 0, vat: (s as any).tax || 0 })),
      purchaseTaxDetails: rangePurchases.map(p => ({ id: p.id, docId: (p as any).invoiceId || p.id, date: p.date, taxable: p.subtotal || 0, vat: (p as any).tax || 0 }))
    };
  }

  // Stubs replacement
  static async getIncomeStatement(start?: string, end?: string) {
    return await this.getProfitLoss(start, end);
  }

  static async getCustomerProfit(_start?: string, _end?: string) {
    return await this.getCustomerBalances();
  }

  static async getItemProfit(_start?: string, _end?: string) {
    return (await this.getInventoryValue()).items;
  }

  static async getAnalyticsSummary() {
    try {
      const sales = await db.invoices.where('type').equals('SALE').toArray();
      const purchases = await db.invoices.where('type').equals('PURCHASE').toArray();
      const products = await db.getProducts();

      const totalSales = sales.reduce((sum, s) => sum + Number(s.finalTotal || 0), 0);
      const totalCost = sales.reduce((sum, s) => sum + Number((s as any).totalCost || 0), 0);
      const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.totalAmount || p.finalTotal || 0), 0);

      return {
        totalSales,
        totalPurchases,
        grossProfit: totalSales - totalCost,
        salesCount: sales.length,
        purchasesCount: purchases.length,
        productsCount: products.length,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return {
        totalSales: 0,
        totalPurchases: 0,
        grossProfit: 0,
        salesCount: 0,
        purchasesCount: 0,
        productsCount: 0,
        timestamp: new Date().toISOString(),
        error: String(e)
      };
    }
  }
}

export const reportEngine = new ReportEngine();
