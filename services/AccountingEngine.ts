
import { db } from './database';
import { AccountingEntry, JournalLine, Sale, Purchase, InvoiceItem, VoucherInvoiceLink } from '../types';
import { CurrencyService } from './CurrencyService';

export class AccountingEngine {
  
  static async getCoreAccount(type: 'CASH' | 'RECEIVABLE' | 'PAYABLE' | 'INVENTORY' | 'SALES_REVENUE' | 'COGS' | 'EXPENSE'): Promise<string> {
    const setting = await db.getSetting(`ACCOUNT_${type}`, '');
    if (!setting) {
      // Fallback to defaults if not configured
      const defaults: Record<string, string> = {
        CASH: 'ACC-CASH-001',
        RECEIVABLE: 'ACC-AR-001',
        PAYABLE: 'ACC-AP-001',
        INVENTORY: 'ACC-INV-001',
        SALES_REVENUE: 'ACC-REV-001',
        COGS: 'ACC-COGS-001',
        EXPENSE: 'ACC-EXP-001'
      };
      return defaults[type];
    }
    return setting;
  }

  static async seedAccounts() {
    const count = await db.db.accounts.count();
    if (count > 0) return;

    const initialAccounts: any[] = [
      { id: 'ACC-CASH-001', code: '1101', name: 'الصندوق (نقدي)', type: 'ASSET', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-AR-001', code: '1102', name: 'ذمم مدينة (عملاء)', type: 'ASSET', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-INV-001', code: '1103', name: 'المخزون السلعي', type: 'ASSET', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-AP-001', code: '2101', name: 'ذمم دائنة (موردين)', type: 'LIABILITY', balance_type: 'CREDIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-REV-001', code: '4101', name: 'إيرادات المبيعات', type: 'REVENUE', balance_type: 'CREDIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-COGS-001', code: '5101', name: 'تكلفة البضاعة المباعة', type: 'EXPENSE', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-EXP-001', code: '5102', name: 'مصاريف عامة', type: 'EXPENSE', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
    ];

    await db.db.accounts.bulkAdd(initialAccounts);
  }

  static async generateSalesEntry(sale: Sale, items: InvoiceItem[]): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const arAcc = await this.getCoreAccount('RECEIVABLE');
    const revenueAcc = await this.getCoreAccount('SALES_REVENUE');
    const cogsAcc = await this.getCoreAccount('COGS');
    const invAcc = await this.getCoreAccount('INVENTORY');

    const lines: JournalLine[] = [];
    const entryId = db.generateId('JE');

    // Multi-currency conversion
    const currencyCode = (sale as any).currencyCode || 'USD';
    const { baseAmount, rate } = await CurrencyService.convertToBase(sale.finalTotal, currencyCode, sale.date);

    // 1. Revenue Impact
    if (sale.paymentStatus === 'Cash') {
      lines.push(this.createLine(entryId, cashAcc, baseAmount, 0));
    } else {
      lines.push(this.createLine(entryId, arAcc, baseAmount, 0));
    }
    lines.push(this.createLine(entryId, revenueAcc, 0, baseAmount));

    // 2. COGS Impact
    const totalCost = sale.totalCost || 0;
    const { baseAmount: baseCost } = await CurrencyService.convertToBase(totalCost, currencyCode, sale.date);
    
    if (baseCost > 0) {
      lines.push(this.createLine(entryId, cogsAcc, baseCost, 0));
      lines.push(this.createLine(entryId, invAcc, 0, baseCost));
    }

    this.validateEntryBalance(lines);

    return {
      id: entryId,
      entry_id: entryId,
      date: sale.date,
      reference_id: sale.SaleID,
      description: `فاتورة مبيعات رقم ${sale.SaleID}`,
      TotalAmount: baseAmount,
      status: 'Posted',
      sourceId: sale.id,
      sourceType: 'SALE',
      lines,
      created_at: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      timestamp: new Date().toISOString() // Precise timestamp for auditing
    };
  }

  static async generatePurchaseEntry(purchase: Purchase): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const apAcc = await this.getCoreAccount('PAYABLE');
    const invAcc = await this.getCoreAccount('INVENTORY');

    const lines: JournalLine[] = [];
    const entryId = db.generateId('JE');

    // Multi-currency conversion
    const currencyCode = (purchase as any).currencyCode || 'USD';
    const { baseAmount, rate } = await CurrencyService.convertToBase(purchase.totalAmount, currencyCode, purchase.date);

    // Debit Inventory
    lines.push(this.createLine(entryId, invAcc, baseAmount, 0));

    // Credit Cash or Payable
    if (purchase.status === 'PAID') {
      lines.push(this.createLine(entryId, cashAcc, 0, baseAmount));
    } else {
      lines.push(this.createLine(entryId, apAcc, 0, baseAmount));
    }

    this.validateEntryBalance(lines);

    return {
      id: entryId,
      entry_id: entryId,
      date: purchase.date,
      reference_id: purchase.invoiceId,
      description: `فاتورة مشتريات رقم ${purchase.invoiceId}`,
      TotalAmount: baseAmount,
      status: 'Posted',
      sourceId: purchase.id,
      sourceType: 'PURCHASE',
      lines,
      created_at: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      timestamp: new Date().toISOString() // Precise timestamp for auditing
    };
  }

  static async generateReturnEntry(sale: Sale, items: InvoiceItem[]): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const arAcc = await this.getCoreAccount('RECEIVABLE');
    const revenueAcc = await this.getCoreAccount('SALES_REVENUE');
    const cogsAcc = await this.getCoreAccount('COGS');
    const invAcc = await this.getCoreAccount('INVENTORY');

    const lines: JournalLine[] = [];
    const entryId = db.generateId('JE');

    const currencyCode = (sale as any).currencyCode || 'USD';
    const { baseAmount, rate } = await CurrencyService.convertToBase(sale.finalTotal, currencyCode, sale.date);

    // Reverse Revenue: Debit Revenue, Credit Cash/AR
    lines.push(this.createLine(entryId, revenueAcc, baseAmount, 0));
    if (sale.paymentStatus === 'Cash') {
      lines.push(this.createLine(entryId, cashAcc, 0, baseAmount));
    } else {
      lines.push(this.createLine(entryId, arAcc, 0, baseAmount));
    }

    // Reverse COGS: Debit Inventory, Credit COGS
    const totalCost = sale.totalCost || 0;
    const { baseAmount: baseCost } = await CurrencyService.convertToBase(totalCost, currencyCode, sale.date);
    
    if (baseCost > 0) {
      lines.push(this.createLine(entryId, invAcc, baseCost, 0));
      lines.push(this.createLine(entryId, cogsAcc, 0, baseCost));
    }

    this.validateEntryBalance(lines);

    return {
      id: entryId,
      entry_id: entryId,
      date: sale.date,
      reference_id: sale.SaleID,
      description: `مرتجع مبيعات فاتورة رقم ${sale.SaleID} (Rate: ${rate})`,
      TotalAmount: baseAmount,
      status: 'Posted',
      sourceId: sale.id,
      sourceType: 'RETURN',
      lines,
      created_at: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
  }

  static async generateVoucherEntry(params: {
    type: 'RECEIPT' | 'PAYMENT';
    amount: number;
    partnerId: string;
    date: string;
    refId: string;
    notes?: string;
  }): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const arAcc = await this.getCoreAccount('RECEIVABLE');
    const apAcc = await this.getCoreAccount('PAYABLE');

    const lines: JournalLine[] = [];
    const entryId = db.generateId('JE');

    if (params.type === 'RECEIPT') {
      // Receipt: Debit Cash, Credit Customer (AR)
      lines.push(this.createLine(entryId, cashAcc, params.amount, 0));
      lines.push(this.createLine(entryId, arAcc, 0, params.amount));
    } else {
      // Payment: Debit Supplier (AP), Credit Cash
      lines.push(this.createLine(entryId, apAcc, params.amount, 0));
      lines.push(this.createLine(entryId, cashAcc, 0, params.amount));
    }

    this.validateEntryBalance(lines);

    return {
      id: entryId,
      entry_id: entryId,
      date: params.date,
      reference_id: params.refId,
      description: params.notes || `${params.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} - ${params.partnerId}`,
      TotalAmount: params.amount,
      status: 'Posted',
      sourceId: params.refId,
      sourceType: 'VOUCHER',
      lines,
      created_at: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
  }

  private static validateEntryBalance(lines: JournalLine[]) {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`قيد غير متزن: إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit})`);
    }
  }

  private static createLine(entryId: string, accountId: string, debit: number, credit: number): JournalLine {
    const id = db.generateId('JL');
    return {
      id,
      lineId: id,
      entryId,
      entry_id: entryId,
      accountId,
      account_id: accountId,
      accountName: '', // Will be populated by repository if needed
      debit,
      credit,
      type: debit > 0 ? 'DEBIT' : 'CREDIT',
      amount: debit > 0 ? debit : credit
    };
  }
}
