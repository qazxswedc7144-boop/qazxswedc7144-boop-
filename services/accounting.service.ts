
import { db } from './database';
import { CashFlow, AccountingEntry, IntegrityReport, Sale, ReconciliationPoint, InvoiceSettlement, AccountingError, Purchase, VoucherInvoiceLink } from '../types';
import { AccountingEngine } from './AccountingEngine';
import { dataValidator } from './validators/dataValidator';
import { AccountRepository } from '../repositories/account.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { CashFlowRepository } from '../repositories/CashFlowRepository';
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { FinancialTransactionRepository } from '../repositories/FinancialTransactionRepository';
import { VoucherInvoiceLinkRepository } from '../repositories/VoucherInvoiceLinkRepository';
import { reportCache } from './reportCache.service';
import { periodService } from './period.service';
import { authService } from './auth.service';
import { FinancialIntegrityValidator } from './validators/FinancialIntegrityValidator';
import { ReconciliationEngine } from './logic/ReconciliationEngine';
import { BusinessRulesEngine } from './logic/BusinessRulesEngine';
import { BackupService } from './backupService';

export interface AgingBucket {
  current: number;    
  overdue30: number;  
  overdue60: number;  
  overdue90: number;  
  total: number;
}

export interface PartnerAging {
  partnerId: string;
  partnerName: string;
  buckets: AgingBucket;
  oldestInvoiceDate?: string;
}

export const accountingService = {
  
  getFinancialMetricsAsync: async () => {
    const cacheKey = 'financial_metrics_v4_async';
    const cached = reportCache.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const sales = await InvoiceRepository.getAllSales();
      const cashflow = await CashFlowRepository.getAll();
      
      let totalRevenue = 0;
      let totalCOGS = 0;
      let expenses = 0;

      sales.forEach(s => {
        totalRevenue += (s.finalTotal || 0);
        totalCOGS += (s.totalCost || 0);
      });

      cashflow.forEach(t => {
        if (t.type === 'خرج' && !t.notes?.includes('مشتريات')) {
          expenses += t.amount;
        }
      });

      const grossProfit = totalRevenue - totalCOGS;
      const netProfit = grossProfit - expenses;
      const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      
      const metrics = { income: totalRevenue, outcome: totalCOGS + expenses, net: netProfit, margin, grossProfit, cogs: totalCOGS };
      reportCache.set(cacheKey, metrics, 30 * 60 * 1000); 
      return metrics;
    } catch (e) { 
      return { income: 0, outcome: 0, net: 0, margin: 0, grossProfit: 0, cogs: 0 }; 
    }
  },

  getChartAnalyticsAsync: async (days: number = 30) => {
    const cacheKey = `chart_analytics_${days}_v1`;
    const cached = reportCache.get<any>(cacheKey);
    if (cached) return cached;

    const sales = await db.getSales();
    const cashflow = await db.getCashFlow();
    
    const labels: string[] = [];
    const revenue: number[] = [];
    const expense: number[] = [];

    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      labels.push(dateStr);

      const daySales = sales.filter(s => (s.date || "").startsWith(dateStr));
      revenue.push(daySales.reduce((acc, s) => acc + (s.finalTotal || 0), 0));

      const dayExpenses = cashflow.filter(c => c.type === 'خرج' && c.date.startsWith(dateStr));
      expense.push(dayExpenses.reduce((acc, c) => acc + c.amount, 0));
    }

    const result = { labels, revenue, expense };
    reportCache.set(cacheKey, result, 15 * 60 * 1000);
    return result;
  },

  getTopProfitableItems: async (limit: number = 100) => {
    const products = await db.getProducts();
    return products
      .filter(p => p.UnitPrice > 0 && p.CostPrice > 0)
      .sort((a, b) => ((b.UnitPrice - b.CostPrice)) - ((a.UnitPrice - a.CostPrice)))
      .slice(0, limit);
  },

  getAgingReport: async (type: 'CUSTOMER' | 'SUPPLIER'): Promise<PartnerAging[]> => {
    const cacheKey = `aging_report_${type}`;
    const cached = reportCache.get<PartnerAging[]>(cacheKey);
    if (cached) return cached;

    const today = new Date();
    const result: PartnerAging[] = [];

    if (type === 'CUSTOMER') {
      const customers = db.getCustomers();
      const unpaidSales = (await db.getSales()).filter(s => s.paymentStatus === 'Credit' && s.InvoiceStatus !== 'DRAFT' && s.InvoiceStatus !== 'CANCELLED' && (s.paidAmount || 0) < s.finalTotal);

      customers.forEach(c => {
        const buckets: AgingBucket = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0, total: 0 };
        const partnerInvoices = unpaidSales.filter(s => s.customerId === c.Supplier_ID);
        let oldestDate: Date | null = null;
        
        partnerInvoices.forEach(inv => {
          const unpaid = inv.finalTotal - (inv.paidAmount || 0);
          const invDate = new Date(inv.date);
          if (!oldestDate || invDate < oldestDate) oldestDate = invDate;
          const diffDays = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 3600 * 24));
          
          if (diffDays <= 30) buckets.current += unpaid;
          else if (diffDays <= 60) buckets.overdue30 += unpaid;
          else if (diffDays <= 90) buckets.overdue60 += unpaid;
          else buckets.overdue90 += unpaid;
          buckets.total += unpaid;
        });

        if (buckets.total > 0) {
          result.push({ 
            partnerId: c.Supplier_ID, 
            partnerName: c.Supplier_Name, 
            buckets,
            oldestInvoiceDate: oldestDate?.toISOString()
          });
        }
      });
    } else {
      const suppliers = db.getSuppliers();
      const unpaidPurchases = (await db.getPurchases()).filter(p => p.status === 'UNPAID' && p.invoiceStatus !== 'DRAFT' && p.invoiceStatus !== 'CANCELLED');

      suppliers.forEach(s => {
        const buckets: AgingBucket = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0, total: 0 };
        const partnerInvoices = unpaidPurchases.filter(p => p.partnerId === s.Supplier_ID);
        let oldestDate: Date | null = null;
        
        partnerInvoices.forEach(inv => {
          const unpaid = inv.totalAmount - (inv.paidAmount || 0);
          const invDate = new Date(inv.date);
          if (!oldestDate || invDate < oldestDate) oldestDate = invDate;
          const diffDays = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 3600 * 24));
          
          if (diffDays <= 30) buckets.current += unpaid;
          else if (diffDays <= 60) buckets.overdue30 += unpaid;
          else if (diffDays <= 90) buckets.overdue60 += unpaid;
          else buckets.overdue90 += unpaid;
          buckets.total += unpaid;
        });

        if (buckets.total > 0) {
          result.push({ 
            partnerId: s.Supplier_ID, 
            partnerName: s.Supplier_Name, 
            buckets,
            oldestInvoiceDate: oldestDate?.toISOString()
          });
        }
      });
    }

    const sortedResult = result.sort((a, b) => b.buckets.total - a.buckets.total);
    reportCache.set(cacheKey, sortedResult, 10 * 60 * 1000);
    return sortedResult;
  },

  getRealTimeProfitLoss: async () => {
    const entries = await db.getJournalEntries();
    const revenueAcc = await AccountingEngine.getCoreAccount('SALES_REVENUE');
    const cogsAcc = await AccountingEngine.getCoreAccount('COGS');
    const expenseAcc = await AccountingEngine.getCoreAccount('EXPENSE');

    let revenue = 0;
    let cogs = 0;
    let expenses = 0;

    entries.forEach(e => {
      e.lines.forEach(l => {
        if (l.accountId === revenueAcc) revenue += (l.credit - l.debit);
        if (l.accountId === cogsAcc) cogs += (l.debit - l.credit);
        if (l.accountId === expenseAcc) expenses += (l.debit - l.credit);
      });
    });

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    return { revenue, cogs, grossProfit, expenses, netProfit };
  },

  getTrialBalance: async () => {
    const accounts = await db.db.accounts.toArray();
    const result = [];
    for (const acc of accounts) {
      const balance = acc.balance || 0;
      result.push({
        accountId: acc.id,
        name: acc.name,
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? Math.abs(balance) : 0
      });
    }
    return result;
  },

  getEntries: async (): Promise<AccountingEntry[]> => await AccountRepository.getAllJournalEntries(),
  
  recordVoucher: async (type: 'دخل' | 'خرج', name: string, amount: number, category: string, notes: string, partnerId?: string, allocations?: Record<string, number | { amount: number, note?: string }>) => {
    const today = new Date().toISOString();
    authService.assertPermission('CREATE_VOUCHER', 'إنشاء سند مالي (قبض/صرف)');
    periodService.validatePeriod(today);
    
    // Normalize allocations to handle both number and object formats
    const normalizedAllocations: Record<string, { amount: number, note?: string }> = {};
    if (allocations) {
      for (const id in allocations) {
        const val = allocations[id];
        if (typeof val === 'number') {
          normalizedAllocations[id] = { amount: val };
        } else {
          normalizedAllocations[id] = val;
        }
      }
    }

    // التحقق من نزاهة التخصيصات عبر BRE
    if (allocations) {
      const simpleAllocations: Record<string, number> = {};
      for (const id in normalizedAllocations) simpleAllocations[id] = normalizedAllocations[id].amount;
      
      await FinancialIntegrityValidator.validateVoucherAllocations(simpleAllocations);
      await dataValidator.validateSettlement(simpleAllocations, type === 'دخل' ? 'SALE' : 'PURCHASE', amount);
    }

    return await db.runTransaction(async () => {
      if (!name || amount <= 0) throw new Error("بيانات السند غير مكتملة.");
      const voucherId = db.generateId('V');
      
      // استخدام BRE للحصول على قيد السند
      const journalEntry = BusinessRulesEngine.accounting.mapVoucherToJournal({ id: voucherId, type, amount, name, category, notes });
      await dataValidator.validateAccountingEntry(journalEntry);
      
      await AccountRepository.addEntry(journalEntry);
      
      // Integrated Balance Updates
      for (const line of journalEntry.lines) {
        await db.updateAccountBalance(line.accountId, line.debit - line.credit);
      }
      
      if (partnerId) {
        if (type === 'دخل') {
          await db.updateCustomerBalance(partnerId, -amount);
        } else {
          await db.updateSupplierBalance(partnerId, -amount);
        }
      }

      await CashFlowRepository.record(type, category, amount, `سند #${voucherId} لـ: ${name} | ${notes}`);
      
      await FinancialTransactionRepository.record({
        Transaction_Type: type === 'دخل' ? 'Receipt' : 'Payment',
        Reference_ID: voucherId,
        Reference_Table: 'Vouchers',
        Entity_Type: partnerId ? (String(partnerId).startsWith('S') ? 'Supplier' : 'Customer') : 'Supplier',
        Entity_Name: name,
        Amount: amount,
        Direction: type === 'دخل' ? 'Credit' : 'Debit', 
        Transaction_Date: today,
        Notes: `سند ${type} لـ ${name} وذلك عن ${category}`
      });

      if (allocations && partnerId) {
        for (const invoiceId in normalizedAllocations) {
          const { amount: settledAmount, note } = normalizedAllocations[invoiceId];
          if (settledAmount > 0) {
            const settlement: InvoiceSettlement = {
              id: db.generateId('SET'),
              voucherId,
              invoiceId,
              amount: settledAmount,
              date: today,
              partnerId,
              type: type === 'دخل' ? 'RECEIPT' : 'PAYMENT',
              note
            };
            await db.saveSettlement(settlement);
            await VoucherInvoiceLinkRepository.createLink(voucherId, invoiceId, settledAmount, note);
            
            // مطابقة الفاتورة فوراً
            await ReconciliationEngine.reconcileInvoicePayments(invoiceId);
          }
        }
      }

      if (partnerId && type === 'خرج' && (category === 'مدفوعات موردين' || category === 'موردين') && !allocations) {
        await PurchaseRepository.settleSupplierFIFO(partnerId, amount);
      }

      // التحقق والمطابقة النهائية لرصيد الشريك
      if (partnerId) {
        await ReconciliationEngine.reconcilePartnerBalance(partnerId);
      }
      
      return voucherId;
    });
  },

  performAutoAdjustment: async (pointId: string, diff: number) => {
    const today = new Date().toISOString();
    authService.assertPermission('FULL_ACCESS', 'إجراء تسوية آلية للحسابات');
    periodService.validatePeriod(today);

    return await db.runTransaction(async () => {
      const entryId = db.generateId('ADJ');
      const entry: AccountingEntry = {
        id: entryId, date: today,
        description: `تسوية آلية لـ [${pointId}] - معالجة فرق جرد/تدقيق`,
        TotalAmount: Math.abs(diff),
        status: 'Posted', sourceId: pointId,
        sourceType: 'ADJUSTMENT', branchId: db.getCurrentBranchId(),
        lines: [
          { lineId: db.generateId('DET'), entryId, accountId: pointId, accountName: `حساب تسوية ${pointId}`, debit: diff > 0 ? diff : 0, credit: diff < 0 ? Math.abs(diff) : 0, type: diff > 0 ? 'DEBIT' : 'CREDIT', amount: Math.abs(diff) },
          { lineId: db.generateId('DET'), entryId, accountId: 'ACC-SUSPENSE', accountName: 'حساب التسويات المعلق', debit: diff < 0 ? Math.abs(diff) : 0, credit: diff > 0 ? diff : 0, type: diff < 0 ? 'DEBIT' : 'CREDIT', amount: Math.abs(diff) }
        ]
      };
      await dataValidator.validateAccountingEntry(entry);
      await AccountRepository.addEntry(entry);
      
      await FinancialTransactionRepository.record({
        Transaction_Type: 'Adjustment',
        Reference_ID: entryId,
        Reference_Table: 'Adjustments',
        Entity_Type: 'Supplier',
        Entity_Name: 'نظام التدقيق',
        Amount: Math.abs(diff),
        Direction: diff > 0 ? 'Debit' : 'Credit',
        Transaction_Date: today,
        Notes: entry.description || ''
      });

      return entryId;
    });
  },

  getCashFlow: async (): Promise<CashFlow[]> => await CashFlowRepository.getAll(),
  
  runIntegrityCheck: async (): Promise<IntegrityReport> => {
    const points: ReconciliationPoint[] = [];
    const entries = await db.getJournalEntries();
    
    let balancedCount = 0;
    let corruptedCount = 0;
    entries.forEach(e => {
       const d = e.lines.reduce((s,l) => s + l.debit, 0);
       const c = e.lines.reduce((s,l) => s + l.credit, 0);
       if (Math.abs(d - c) < 0.01) balancedCount++; else corruptedCount++;
    });

    points.push({
      id: 'journal-balance',
      label: 'توازن دفتر الأستاذ',
      status: corruptedCount === 0 ? 'balanced' : 'critical',
      details: corruptedCount === 0 ? 'كافة القيود المرحلة متزنة تماماً.' : `تم اكتشاف ${corruptedCount} قيود غير متزنة في السجلات!`,
      ledgerBalance: balancedCount,
      subledgerBalance: entries.length,
      diff: corruptedCount
    });

    return {
      isHealthy: corruptedCount === 0,
      totalDiff: corruptedCount,
      timestamp: new Date().toISOString(),
      points
    };
  },

  deleteVoucher: async (voucherId: string) => {
    authService.assertPermission('DELETE_VOUCHER' as any, 'حذف سند مالي');
    
    // PHASE 3 — AUTO BACKUP RULES
    await BackupService.createBackup(`Auto Backup before Delete Voucher #${voucherId}`, 'PRE_VOUCHER_DELETE', true);

    return await db.runTransaction(async () => {
      // 1. Delete Journal Entry
      await AccountRepository.deleteEntriesBySource(voucherId);
      
      // 2. Delete CashFlow record
      const cashflows = await db.db.cashFlow.toArray();
      for (const h of cashflows) {
        if (h.notes?.includes(`#${voucherId}`)) {
          await db.db.cashFlow.delete(h.transaction_id);
        }
      }

      // 3. Delete Financial Transaction
      await FinancialTransactionRepository.cancelTransaction(voucherId);

      // 4. Delete Links and Settlements
      const links = await VoucherInvoiceLinkRepository.getByVoucher(voucherId);
      for (const link of links) {
        await db.db.voucherInvoiceLinks.delete(link.linkId);
        // Re-reconcile invoices
        await ReconciliationEngine.reconcileInvoicePayments(link.invoiceId);
      }

      const settlements = await db.db.settlements.where('voucherId').equals(voucherId).toArray();
      for (const s of settlements) {
        await db.db.settlements.delete(s.id);
      }

      await db.addAuditLog('DELETE', 'VOUCHER', voucherId, `Voucher #${voucherId} deleted by ${authService.getCurrentUser()?.User_Email}`);
    });
  }
};
