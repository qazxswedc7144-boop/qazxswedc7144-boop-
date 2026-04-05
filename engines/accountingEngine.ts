
import { Sale, Purchase, CashFlow, AccountingEntry, Product, Supplier, InvoiceAdjustment, JournalLine } from '../types';

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
    const { db } = await import('../services/database');
    const { AccountRepository } = await import('../repositories/account.repository');
    
    const type = invoice.type || (invoice.customerId ? 'SALE' : 'PURCHASE');
    const total = invoice.total || invoice.TotalAmount;
    const cost = costResult.totalCost;

    if (type === 'SALE') {
      const entries = this.generateSaleEntries(invoice, total);
      // Add COGS entry
      const cogsEntryId = `ENT-COGS-${invoice.id || invoice.invoiceId}`;
      const cogsEntry: AccountingEntry = {
        id: cogsEntryId,
        date: new Date().toISOString(),
        TotalAmount: cost,
        status: 'Posted',
        sourceId: invoice.id || invoice.invoiceId,
        sourceType: 'COGS',
        lines: [
          {
            id: `${cogsEntryId}-DR`,
            lineId: `${cogsEntryId}-DR`,
            entryId: cogsEntryId,
            accountId: 'AC-COGS',
            accountName: 'Cost of Goods Sold',
            debit: cost,
            credit: 0,
            type: 'DEBIT',
            amount: cost
          },
          {
            id: `${cogsEntryId}-CR`,
            lineId: `${cogsEntryId}-CR`,
            entryId: cogsEntryId,
            accountId: 'AC-INV',
            accountName: 'Inventory',
            debit: 0,
            credit: cost,
            type: 'CREDIT',
            amount: cost
          }
        ]
      };
      
      for (const entry of entries) {
        await AccountRepository.addEntry(entry);
      }
      await AccountRepository.addEntry(cogsEntry);
    } else if (type === 'PURCHASE') {
      const entries = this.generatePurchaseEntries(invoice, total);
      for (const entry of entries) {
        await AccountRepository.addEntry(entry);
      }
    }
  }
}
