
import { Sale, Purchase, CashFlow, AccountingEntry, Product, Supplier, InvoiceAdjustment, JournalLine } from '../../types';

export class AccountingEngine {
  /**
   * Calculates the total amount for a sale, including taxes and discounts.
   */
  static calculateSaleTotal(sale: Sale, adjustments: InvoiceAdjustment[] = []): number {
    let total = sale.items.reduce((acc, item) => acc + (item.qty * item.price), 0);
    
    // Apply adjustments
    adjustments.forEach(adj => {
      if (adj.Type === 'Discount') {
        total -= adj.Value;
      } else if (adj.Type === 'Tax Adjustment') {
        total += adj.Value;
      }
    });

    return total;
  }

  /**
   * Calculates the total amount for a purchase.
   */
  static calculatePurchaseTotal(purchase: Purchase): number {
    return purchase.items.reduce((acc, item) => acc + (item.qty * item.price), 0);
  }

  /**
   * Generates accounting entries for a sale.
   */
  static generateSaleEntries(sale: Sale, total: number): AccountingEntry[] {
    const entryId = `ENT-SALE-${sale.id}`;
    const date = new Date().toISOString();

    const entry: AccountingEntry = {
      id: entryId,
      date,
      TotalAmount: total,
      status: 'Posted',
      sourceId: sale.id,
      sourceType: 'SALE',
      lines: [
        {
          id: `${entryId}-DR`,
          lineId: `${entryId}-DR`,
          entryId,
          accountId: sale.customerId ? 'AC-AR' : 'AC-CASH',
          accountName: sale.customerId ? 'Accounts Receivable' : 'Cash',
          debit: total,
          credit: 0,
          type: 'DEBIT',
          amount: total
        },
        {
          id: `${entryId}-CR`,
          lineId: `${entryId}-CR`,
          entryId,
          accountId: 'AC-SALES',
          accountName: 'Sales Revenue',
          debit: 0,
          credit: total,
          type: 'CREDIT',
          amount: total
        }
      ]
    };

    return [entry];
  }

  /**
   * Generates accounting entries for a purchase.
   */
  static generatePurchaseEntries(purchase: Purchase, total: number): AccountingEntry[] {
    const entryId = `ENT-PUR-${purchase.id}`;
    const date = new Date().toISOString();

    const entry: AccountingEntry = {
      id: entryId,
      date,
      TotalAmount: total,
      status: 'Posted',
      sourceId: purchase.id,
      sourceType: 'PURCHASE',
      lines: [
        {
          id: `${entryId}-DR`,
          lineId: `${entryId}-DR`,
          entryId,
          accountId: 'AC-INV',
          accountName: 'Inventory',
          debit: total,
          credit: 0,
          type: 'DEBIT',
          amount: total
        },
        {
          id: `${entryId}-CR`,
          lineId: `${entryId}-CR`,
          entryId,
          accountId: purchase.partnerId ? 'AC-AP' : 'AC-CASH',
          accountName: purchase.partnerId ? 'Accounts Payable' : 'Cash',
          debit: 0,
          credit: total,
          type: 'CREDIT',
          amount: total
        }
      ]
    };

    return [entry];
  }

  /**
   * POST INVOICE TO ACCOUNTING
   */
  static async postInvoice(invoice: any, costResult: { totalCost: number }): Promise<void> {
    const { AccountingEngine: robustEngine } = await import('../../services/AccountingEngine');
    const { AccountRepository } = await import('../../repositories/account.repository');
    
    const type = invoice.type || (invoice.customerId ? 'SALE' : 'PURCHASE');
    const isReturn = invoice.isReturn || invoice.invoiceType === 'مرتجع';

    let entry: AccountingEntry | AccountingEntry[];

    if (type === 'SALE') {
      if (isReturn) {
        entry = await robustEngine.generateReturnEntry(invoice, invoice.items);
      } else {
        entry = await robustEngine.generateSalesEntry(invoice, invoice.items);
      }
    } else {
      if (isReturn) {
        entry = await robustEngine.generatePurchaseReturnEntry(invoice);
      } else {
        entry = await robustEngine.generatePurchaseEntry(invoice);
      }
    }

    if (Array.isArray(entry)) {
      for (const e of entry) {
        await AccountRepository.addEntry(e);
      }
    } else {
      await AccountRepository.addEntry(entry);
    }
  }
}
