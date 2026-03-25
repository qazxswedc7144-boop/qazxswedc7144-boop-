
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

    return {
      id: entryId,
      date: sale.date,
      description: `فاتورة مبيعات رقم ${sale.SaleID} (Rate: ${rate})`,
      TotalAmount: baseAmount,
      status: 'Posted',
      sourceId: sale.id,
      sourceType: 'SALE',
      lines,
      lastModified: new Date().toISOString()
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

    return {
      id: entryId,
      date: purchase.date,
      description: `فاتورة مشتريات رقم ${purchase.invoiceId} (Rate: ${rate})`,
      TotalAmount: baseAmount,
      status: 'Posted',
      sourceId: purchase.id,
      sourceType: 'PURCHASE',
      lines,
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

    return {
      id: entryId,
      date: params.date,
      description: params.notes || `${params.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} - ${params.partnerId}`,
      TotalAmount: params.amount,
      status: 'Posted',
      sourceId: params.refId,
      sourceType: 'VOUCHER',
      lines,
      lastModified: new Date().toISOString()
    };
  }

  private static createLine(entryId: string, accountId: string, debit: number, credit: number): JournalLine {
    return {
      lineId: db.generateId('JL'),
      entryId,
      accountId,
      accountName: '', // Will be populated by repository if needed
      debit,
      credit,
      type: debit > 0 ? 'DEBIT' : 'CREDIT',
      amount: debit > 0 ? debit : credit
    };
  }
}
