
import { Sale, Purchase, CashFlow, AccountingEntry, Product, Supplier, InvoiceAdjustment } from '../types';

export class AccountingEngine {
  /**
   * Calculates the total amount for a sale, including taxes and discounts.
   */
  static calculateSaleTotal(sale: Sale, adjustments: InvoiceAdjustment[] = []): number {
    let total = sale.items.reduce((acc, item) => acc + (item.Quantity * item.UnitPrice), 0);
    
    // Apply adjustments
    adjustments.forEach(adj => {
      if (adj.Type === 'DISCOUNT') {
        total -= adj.Amount;
      } else if (adj.Type === 'TAX') {
        total += adj.Amount;
      }
    });

    return total;
  }

  /**
   * Calculates the total amount for a purchase.
   */
  static calculatePurchaseTotal(purchase: Purchase): number {
    return purchase.items.reduce((acc, item) => acc + (item.Quantity * item.CostPrice), 0);
  }

  /**
   * Generates accounting entries for a sale.
   */
  static generateSaleEntries(sale: Sale, total: number): AccountingEntry[] {
    const entries: AccountingEntry[] = [];
    const date = new Date().toISOString();

    // Debit: Accounts Receivable or Cash
    entries.push({
      id: `ENT-SALE-DR-${sale.id}`,
      EntryID: `ENT-SALE-DR-${sale.id}`,
      date,
      description: `Sale ${sale.SaleID}`,
      accountId: sale.customerId ? 'AC-AR' : 'AC-CASH',
      debit: total,
      credit: 0,
      sourceId: sale.id,
      status: 'POSTED',
      hash: ''
    });

    // Credit: Sales Revenue
    entries.push({
      id: `ENT-SALE-CR-${sale.id}`,
      EntryID: `ENT-SALE-CR-${sale.id}`,
      date,
      description: `Sale ${sale.SaleID}`,
      accountId: 'AC-SALES',
      debit: 0,
      credit: total,
      sourceId: sale.id,
      status: 'POSTED',
      hash: ''
    });

    return entries;
  }

  /**
   * Generates accounting entries for a purchase.
   */
  static generatePurchaseEntries(purchase: Purchase, total: number): AccountingEntry[] {
    const entries: AccountingEntry[] = [];
    const date = new Date().toISOString();

    // Debit: Inventory
    entries.push({
      id: `ENT-PUR-DR-${purchase.id}`,
      EntryID: `ENT-PUR-DR-${purchase.id}`,
      date,
      description: `Purchase ${purchase.purchase_id}`,
      accountId: 'AC-INV',
      debit: total,
      credit: 0,
      sourceId: purchase.id,
      status: 'POSTED',
      hash: ''
    });

    // Credit: Accounts Payable or Cash
    entries.push({
      id: `ENT-PUR-CR-${purchase.id}`,
      EntryID: `ENT-PUR-CR-${purchase.id}`,
      date,
      description: `Purchase ${purchase.purchase_id}`,
      accountId: purchase.partnerId ? 'AC-AP' : 'AC-CASH',
      debit: 0,
      credit: total,
      sourceId: purchase.id,
      status: 'POSTED',
      hash: ''
    });

    return entries;
  }
}
