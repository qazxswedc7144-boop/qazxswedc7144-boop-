
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

import { ReportEngine } from '../src/core/engines/reportEngine';

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
      const incomeStatement = await ReportEngine.getIncomeStatement();
      const metrics = { 
        income: incomeStatement.revenue, 
        outcome: incomeStatement.cogs + incomeStatement.expenses, 
        net: incomeStatement.netProfit, 
        margin: incomeStatement.margin, 
        grossProfit: incomeStatement.grossProfit, 
        cogs: incomeStatement.cogs 
      };
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

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - days + 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    const entries = await db.getJournalEntries();
    const filteredEntries = entries.filter(e => e.date >= startDateStr);
    
    const labels: string[] = [];
    const revenue: number[] = [];
    const expense: number[] = [];

    const accounts = await db.getAccounts();
    const revenueAccounts = accounts.filter(a => a.type === 'REVENUE').map(a => a.id);
    const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE').map(a => a.id);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      labels.push(dateStr);

      const dayEntries = filteredEntries.filter(e => e.date.startsWith(dateStr));
      let dayRev = 0;
      let dayExp = 0;

      dayEntries.forEach(e => {
        e.lines.forEach(l => {
          if (revenueAccounts.includes(l.accountId)) dayRev += (l.credit - l.debit);
          if (expenseAccounts.includes(l.accountId)) dayExp += (l.debit - l.credit);
        });
      });

      revenue.push(dayRev);
      expense.push(dayExp);
    }

    const result = { labels, revenue, expense };
    reportCache.set(cacheKey, result, 15 * 60 * 1000);
    return result;
  },

  getTopProfitableItems: async (limit: number = 100) => {
    const profits = await ReportEngine.getItemProfit();
    return profits
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, limit);
  },

  getAgingReport: async (type: 'CUSTOMER' | 'SUPPLIER'): Promise<PartnerAging[]> => {
    // Keep existing aging logic as it's quite specific to unpaid invoices, 
    // but we could potentially use journal entries if we track sub-ledgers.
    // For now, let's keep it as is but ensure it's accurate.
    const cacheKey = `aging_report_${type}`;
    const cached = reportCache.get<PartnerAging[]>(cacheKey);
    if (cached) return cached;

    const today = new Date();
    const result: PartnerAging[] = [];

    if (type === 'CUSTOMER') {
      const customers = await db.getCustomers();
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
      const suppliers = await db.getSuppliers();
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
    return await ReportEngine.getIncomeStatement();
  },

  getTrialBalance: async () => {
    const tb = await ReportEngine.getTrialBalance();
    return tb.accounts.map(acc => ({
      accountId: acc.accountId,
      name: acc.account_name,
      debit: acc.debit,
      credit: acc.credit
    }));
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
      const journalEntry = await BusinessRulesEngine.accounting.mapVoucherToJournal({ id: voucherId, type, amount, name, category, notes });
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

      // Record Cash Flow with transaction_id for easier reversal
      const cfId = db.generateId('CSH');
      await db.db.cashFlow.put({
        id: cfId,
        transaction_id: voucherId,
        date: today.split('T')[0],
        type: type,
        category: category,
        amount: amount,
        notes: `سند #${voucherId} لـ: ${name} | ${notes}`,
        isSynced: false,
        updatedAt: today
      } as any);
      
      const ftId = db.generateId('FT');
      await FinancialTransactionRepository.record({
        id: ftId,
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
          { id: db.generateId('DET'), lineId: db.generateId('DET'), entryId, accountId: pointId, accountName: `حساب تسوية ${pointId}`, debit: diff > 0 ? diff : 0, credit: diff < 0 ? Math.abs(diff) : 0, type: diff > 0 ? 'DEBIT' : 'CREDIT', amount: Math.abs(diff) },
          { id: db.generateId('DET'), lineId: db.generateId('DET'), entryId, accountId: 'ACC-SUSPENSE', accountName: 'حساب التسويات المعلق', debit: diff < 0 ? Math.abs(diff) : 0, credit: diff > 0 ? diff : 0, type: diff < 0 ? 'DEBIT' : 'CREDIT', amount: Math.abs(diff) }
        ]
      };
      await dataValidator.validateAccountingEntry(entry);
      await AccountRepository.addEntry(entry);
      
      const ftId = db.generateId('FT');
      await FinancialTransactionRepository.record({
        id: ftId,
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
      id: db.generateId('REP'),
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
      // 1. Find the Journal Entry to reverse balances
      const entry = await db.db.journalEntries.where('sourceId').equals(voucherId).first();
      let partnerId: string | null = null;

      if (entry) {
        // Reverse Account Balances
        for (const line of entry.lines) {
          await db.updateAccountBalance(line.accountId, line.credit - line.debit);
        }

        // 2. Reverse Partner Balances
        // Find partnerId from settlements
        const settlements = await db.db.settlements.where('voucherId').equals(voucherId).toArray();
        if (settlements.length > 0) {
          partnerId = settlements[0].partnerId;
          const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
          
          if (settlements[0].type === 'RECEIPT') {
            await db.updateCustomerBalance(partnerId, totalSettled);
          } else {
            await db.updateSupplierBalance(partnerId, totalSettled);
          }
        } else {
          // If no settlements, try to find from Financial Transactions
          const ftxs = await FinancialTransactionRepository.getByReference(voucherId);
          if (ftxs.length > 0) {
            // We need the partner ID, but Entity_Name might be the name.
            // In this system, sometimes Entity_Name is used as ID or we can find by name.
            // For now, let's assume if no settlements, we might not have a partner balance to reverse 
            // unless it was a general payment.
          }
        }

        // 3. Delete Journal Entry
        await db.db.journalEntries.delete(entry.id);
      }

      // 4. Delete CashFlow record
      const cashflows = await db.db.cashFlow.filter(cf => cf.transaction_id === voucherId || (cf.notes && cf.notes.includes(`#${voucherId}`))).toArray();
      for (const cf of cashflows) {
        await db.db.cashFlow.delete(cf.id);
      }

      // 5. Delete Financial Transaction
      await FinancialTransactionRepository.cancelTransaction(voucherId);

      // 6. Delete Links and Settlements
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

      // 7. Final Reconcile
      if (partnerId) {
        await ReconciliationEngine.reconcilePartnerBalance(partnerId);
      }

      await db.addAuditLog('DELETE', 'VOUCHER', voucherId, `Voucher #${voucherId} deleted by ${authService.getCurrentUser()?.User_Email}`);
    });
  }
};
