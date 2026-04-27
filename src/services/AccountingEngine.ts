
import { db } from '../lib/database';
import { AccountingEntry, JournalLine, Sale, Purchase, InvoiceItem, VoucherInvoiceLink } from '../types';
import { CurrencyService } from './CurrencyService';

export class AccountingEngine {
  
  static async getCoreAccount(type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INVENTORY' | 'SALES_REVENUE' | 'COGS' | 'EXPENSE'): Promise<string> {
    try {
      const setting = await db.settings.get(`ACCOUNT_${type}`);
      if (setting) return setting.value;
    } catch (e) {
      console.warn(`Error fetching ACCOUNT_${type} from Dexie:`, e);
    }

    // Fallback to defaults if not configured
    const defaults: Record<string, string> = {
      CASH: 'ACC-101',
      BANK: 'ACC-104',
      RECEIVABLE: 'ACC-103',
      PAYABLE: 'ACC-201',
      INVENTORY: 'ACC-102',
      SALES_REVENUE: 'ACC-401',
      COGS: 'ACC-501',
      EXPENSE: 'ACC-502'
    };
    return defaults[type];
  }

  static async seedAccounts() {
    console.log('AccountingEngine.seedAccounts called - now managed via Dexie settings');
  }

  static async generateSalesEntry(sale: Sale, items: InvoiceItem[]): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const arAcc = await this.getCoreAccount('RECEIVABLE');
    const revenueAcc = await this.getCoreAccount('SALES_REVENUE');
    const cogsAcc = await this.getCoreAccount('COGS');
    const invAcc = await this.getCoreAccount('INVENTORY');

    const lines: JournalLine[] = [];
    const entryId = `JE-${Date.now()}`;

    // Multi-currency conversion
    const currencyCode = (sale as any).currencyCode || 'USD';
    const { baseAmount } = await CurrencyService.convertToBase(sale.finalTotal, currencyCode, sale.date);

    // 1. Revenue Impact
    if (sale.paymentStatus === 'Cash') {
      lines.push(await this.createLine(entryId, cashAcc, baseAmount, 0));
    } else {
      lines.push(await this.createLine(entryId, arAcc, baseAmount, 0));
    }
    lines.push(await this.createLine(entryId, revenueAcc, 0, baseAmount));

    // 2. COGS Impact
    const totalCalculatedCost = await this.calculateTotalCOGS(items);
    const { baseAmount: baseCost } = await CurrencyService.convertToBase(totalCalculatedCost, currencyCode, sale.date);
    
    if (baseCost > 0) {
      lines.push(await this.createLine(entryId, cogsAcc, baseCost, 0));
      lines.push(await this.createLine(entryId, invAcc, 0, baseCost));
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
      timestamp: new Date().toISOString()
    } as any;
  }

  static async generatePurchaseEntry(purchase: Purchase): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const apAcc = await this.getCoreAccount('PAYABLE');
    const invAcc = await this.getCoreAccount('INVENTORY');

    const lines: JournalLine[] = [];
    const entryId = `JE-${Date.now()}`;

    // Multi-currency conversion
    const currencyCode = (purchase as any).currencyCode || 'USD';
    const { baseAmount, rate } = await CurrencyService.convertToBase(purchase.totalAmount, currencyCode, purchase.date);

    // Debit Inventory
    lines.push(await this.createLine(entryId, invAcc, baseAmount, 0));

    // Credit Cash or Payable
    if (purchase.status === 'PAID') {
      lines.push(await this.createLine(entryId, cashAcc, 0, baseAmount));
    } else {
      lines.push(await this.createLine(entryId, apAcc, 0, baseAmount));
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
      timestamp: new Date().toISOString()
    };
  }

  static async generateReturnEntry(sale: Sale, items: InvoiceItem[]): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const arAcc = await this.getCoreAccount('RECEIVABLE');
    const revenueAcc = await this.getCoreAccount('SALES_REVENUE');
    const cogsAcc = await this.getCoreAccount('COGS');
    const invAcc = await this.getCoreAccount('INVENTORY');

    const lines: JournalLine[] = [];
    const entryId = `JE-${Date.now()}`;

    const currencyCode = (sale as any).currencyCode || 'USD';
    const { baseAmount, rate } = await CurrencyService.convertToBase(sale.finalTotal, currencyCode, sale.date);

    // Reverse Revenue: Debit Revenue, Credit Cash/AR
    lines.push(await this.createLine(entryId, revenueAcc, baseAmount, 0));
    if (sale.paymentStatus === 'Cash') {
      lines.push(await this.createLine(entryId, cashAcc, 0, baseAmount));
    } else {
      lines.push(await this.createLine(entryId, arAcc, 0, baseAmount));
    }

    // Reverse COGS: Debit Inventory, Credit COGS
    const totalCalculatedCost = await this.calculateTotalCOGS(items);
    const { baseAmount: baseCost } = await CurrencyService.convertToBase(totalCalculatedCost, currencyCode, sale.date);
    
    if (baseCost > 0) {
      lines.push(await this.createLine(entryId, invAcc, baseCost, 0));
      lines.push(await this.createLine(entryId, cogsAcc, 0, baseCost));
    }

    this.validateEntryBalance(lines);

    return {
      id: entryId,
      entry_id: entryId,
      date: sale.date,
      reference_id: sale.SaleID,
      description: `مرتجع مبيعات فاتورة رقم ${sale.SaleID}`,
      TotalAmount: baseAmount,
      status: 'Posted',
      sourceId: sale.id,
      sourceType: 'RETURN',
      lines,
      created_at: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
  }

  static async generatePurchaseReturnEntry(purchase: Purchase): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const apAcc = await this.getCoreAccount('PAYABLE');
    const invAcc = await this.getCoreAccount('INVENTORY');

    const lines: JournalLine[] = [];
    const entryId = `JE-${Date.now()}`;

    const currencyCode = (purchase as any).currencyCode || 'USD';
    const { baseAmount } = await CurrencyService.convertToBase(purchase.totalAmount, currencyCode, purchase.date);

    // Debit Cash or Payable, Credit Inventory
    if (purchase.status === 'PAID') {
      lines.push(await this.createLine(entryId, cashAcc, baseAmount, 0));
    } else {
      lines.push(await this.createLine(entryId, apAcc, baseAmount, 0));
    }
    lines.push(await this.createLine(entryId, invAcc, 0, baseAmount));

    this.validateEntryBalance(lines);

    return {
      id: entryId,
      entry_id: entryId,
      date: purchase.date,
      reference_id: purchase.invoiceId,
      description: `مرتجع مشتريات فاتورة رقم ${purchase.invoiceId}`,
      TotalAmount: baseAmount,
      status: 'Posted',
      sourceId: purchase.id,
      sourceType: 'PURCHASE_RETURN',
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
    paymentMethod?: 'CASH' | 'TRANSFER';
  }): Promise<AccountingEntry> {
    const cashAcc = await this.getCoreAccount('CASH');
    const bankAcc = await this.getCoreAccount('BANK');
    const arAcc = await this.getCoreAccount('RECEIVABLE');
    const apAcc = await this.getCoreAccount('PAYABLE');

    const lines: JournalLine[] = [];
    const entryId = `JE-${Date.now()}`;

    const fundAcc = params.paymentMethod === 'TRANSFER' ? bankAcc : cashAcc;

    if (params.type === 'RECEIPT') {
      lines.push(await this.createLine(entryId, fundAcc, params.amount, 0));
      lines.push(await this.createLine(entryId, arAcc, 0, params.amount));
    } else {
      lines.push(await this.createLine(entryId, apAcc, params.amount, 0));
      lines.push(await this.createLine(entryId, fundAcc, 0, params.amount));
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

  private static async calculateTotalCOGS(items: InvoiceItem[]): Promise<number> {
    let totalCOGS = 0;
    for (const item of items) {
      let unitCost = 0;
      
      // Try to get cost from batch from Dexie
      if (item.batchId) {
        try {
          const batch = await db.medicineBatches.get(item.batchId);
          if (batch && batch.unitCost !== undefined) {
            unitCost = batch.unitCost;
          }
        } catch (e) {
          console.warn("Error fetching batch from Dexie:", e);
        }
      }
      
      // Fallback to product default cost price if batch cost is missing
      if (unitCost === 0) {
        try {
          const product = await db.products.get(item.product_id);
          if (product) {
            unitCost = product.CostPrice || product.cost || 0;
          }
        } catch (e) {
          console.warn("Error fetching product from Dexie:", e);
        }
      }
      
      totalCOGS += (item.qty || 0) * unitCost;
    }
    return totalCOGS;
  }

  private static validateEntryBalance(lines: JournalLine[]) {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`قيد غير متزن: إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit})`);
    }
  }

  private static async createLine(entryId: string, accountId: string, debit: number, credit: number): Promise<JournalLine> {
    const id = `JL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    return {
      id,
      lineId: id,
      entryId,
      entry_id: entryId,
      accountId,
      account_id: accountId,
      accountName: 'حساب محلي',
      debit,
      credit,
      type: debit > 0 ? 'DEBIT' : 'CREDIT',
      amount: debit > 0 ? debit : credit
    } as any;
  }
}
