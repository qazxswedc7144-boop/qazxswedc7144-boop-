
import { AccountingEntry, JournalLine } from '../types';
import { db } from '../services/database';
import { JournalRulesProvider } from './JournalRules';
import { ChartOfAccounts } from './ChartOfAccounts';

export const AutoJournalMapper = {
  
  createLine(entryId: string, accId: string, amount: number, type: 'DEBIT' | 'CREDIT'): JournalLine {
    const account = ChartOfAccounts.getAccountById(accId);
    const accName = account ? account.name : "حساب غير معرف";
    
    const id = db.generateId('DET');
    return {
      id,
      lineId: id,
      entryId,
      accountId: accId,
      accountName: accName,
      debit: type === 'DEBIT' ? amount : 0,
      credit: type === 'CREDIT' ? amount : 0,
      type,
      amount
    };
  },

  generateEntryFromRule(
    ruleKey: string, 
    amount: number, 
    sourceId: string, 
    sourceType: any, 
    date: string,
    customDescription?: string
  ): AccountingEntry {
    const rule = JournalRulesProvider.getRule(ruleKey);
    const entryId = db.generateId('ENT');
    
    return {
      id: entryId,
      sourceId: sourceId,
      sourceType: sourceType,
      TotalAmount: amount,
      status: 'Posted',
      date,
      description: customDescription || `${rule.description} #${sourceId}`,
      branchId: db.getCurrentBranchId(),
      lines: [
        this.createLine(entryId, rule.debit, amount, 'DEBIT'),
        this.createLine(entryId, rule.credit, amount, 'CREDIT')
      ]
    };
  },

  mapSaleToEntries(saleData: any): AccountingEntry[] {
    const entries: AccountingEntry[] = [];
    const date = new Date().toISOString();
    const isReturn = saleData.isReturn === true;
    
    // قاعدة المبيعات: البيع (Cr Sales, Dr Cash/Customer) المرتجع يعكس (Dr Sales, Cr Cash/Customer)
    const ruleKey = saleData.paymentStatus === 'Cash' ? 'SALE_CASH' : 'SALE_CREDIT';
    const rule = JournalRulesProvider.getRule(ruleKey);
    
    const entryId = db.generateId('ENT');
    entries.push({
      id: entryId,
      sourceId: saleData.id,
      sourceType: 'SALE',
      TotalAmount: saleData.total,
      status: 'Posted',
      date,
      description: `${isReturn ? 'مرتجع' : 'إيراد'} مبيعات ${saleData.paymentStatus === 'Cash' ? 'نقدية' : 'آجلة'} #${saleData.id}`,
      branchId: db.getCurrentBranchId(),
      lines: [
        // في المرتجع نعكس الحسابات: المدين يصبح دائن والدائن يصبح مدين
        this.createLine(entryId, isReturn ? rule.credit : rule.debit, saleData.total, 'DEBIT'),
        this.createLine(entryId, isReturn ? rule.debit : rule.credit, saleData.total, 'CREDIT')
      ]
    });

    if (saleData.cost > 0) {
      const cogsRule = JournalRulesProvider.getRule('COGS');
      const cogsId = db.generateId('ENT');
      
      entries.push({
        id: cogsId, sourceId: saleData.id,
        sourceType: "COGS", TotalAmount: saleData.cost,
        status: 'Posted', date, 
        branchId: db.getCurrentBranchId(),
        description: `إثبات تكلفة ${isReturn ? 'مرتجع' : ''} #${saleData.id}`,
        lines: [
          // المرتجع يعيد البضاعة للمخزن (Dr Inventory, Cr COGS)
          this.createLine(cogsId, isReturn ? cogsRule.credit : cogsRule.debit, saleData.cost, 'DEBIT'),
          this.createLine(cogsId, isReturn ? cogsRule.debit : cogsRule.credit, saleData.cost, 'CREDIT')
        ]
      });
    }
    return entries;
  },

  mapPurchaseToEntries(purData: any): AccountingEntry[] {
    const date = new Date().toISOString();
    const entryId = db.generateId('ENT');
    const isReturn = purData.isReturn === true;
    
    const subtotal = purData.subtotal || purData.total;
    const tax = purData.tax || 0;
    const total = purData.total;
    
    const lines: JournalLine[] = [];
    const creditAcc = purData.isCash ? 'ACC-101' : 'ACC-201'; // الصندوق أو المورد
    
    if (isReturn) {
      // قيد مرتجع مشتريات (يعكس المشتريات): Dr Cash/Supplier, Cr Inventory
      lines.push(this.createLine(entryId, creditAcc, total, 'DEBIT'));
      lines.push(this.createLine(entryId, 'ACC-102', subtotal, 'CREDIT'));
      if (tax > 0) lines.push(this.createLine(entryId, 'ACC-210', tax, 'CREDIT'));
    } else {
      // قيد مشتريات عادي: Dr Inventory, Dr Tax, Cr Cash/Supplier
      lines.push(this.createLine(entryId, 'ACC-102', subtotal, 'DEBIT'));
      if (tax > 0) lines.push(this.createLine(entryId, 'ACC-210', tax, 'DEBIT'));
      lines.push(this.createLine(entryId, creditAcc, total, 'CREDIT'));
    }

    return [{
      id: entryId,
      sourceId: purData.id,
      sourceType: 'PURCHASE',
      TotalAmount: total,
      status: 'Posted',
      date,
      description: `فاتورة ${isReturn ? 'مرتجع' : 'مشتريات'} ${purData.isCash ? 'نقدية' : 'آجلة'} #${purData.id}`,
      branchId: db.getCurrentBranchId(),
      lines
    }];
  },

  mapVoucherToEntries(vData: any): AccountingEntry {
    const isIncome = vData.type === 'دخل';
    const debitAcc = isIncome ? 'ACC-101' : 'ACC-502'; 
    const creditAcc = isIncome ? 'ACC-401' : 'ACC-101'; 
    
    const entryId = db.generateId('ENT');
    return {
      id: entryId, sourceId: vData.id,
      sourceType: "VOUCHER", TotalAmount: vData.amount,
      status: 'Posted', date: new Date().toISOString(),
      description: `سند ${vData.type} #${vData.id} - ${vData.name}`,
      branchId: db.getCurrentBranchId(),
      lines: [
        this.createLine(entryId, debitAcc, vData.amount, 'DEBIT'),
        this.createLine(entryId, creditAcc, vData.amount, 'CREDIT')
      ]
    };
  }
};

export const createSaleJournal = (d: any) => AutoJournalMapper.mapSaleToEntries(d);
export const createPurchaseJournal = (d: any) => AutoJournalMapper.mapPurchaseToEntries(d);
export const createVoucherJournal = (d: any) => AutoJournalMapper.mapVoucherToEntries(d);
