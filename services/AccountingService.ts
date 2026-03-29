
import { db } from './database';
import { Sale, Purchase, CashFlow, AccountingEntry, Supplier, InvoiceAdjustment, InvoiceSettlement } from '../types';

export class AccountingService {
  /**
   * Retrieves all sales from the database.
   */
  static async getSales(): Promise<Sale[]> {
    return await db.sales.toArray();
  }

  /**
   * Saves a sale to the database.
   */
  static async saveSale(sale: Sale): Promise<string> {
    if (!sale.id) {
      sale.id = db.generateId('SALE');
    }
    await db.sales.put(sale);
    return sale.id;
  }

  /**
   * Retrieves all purchases from the database.
   */
  static async getPurchases(): Promise<Purchase[]> {
    return await db.purchases.toArray();
  }

  /**
   * Saves a purchase to the database.
   */
  static async savePurchase(purchase: Purchase): Promise<string> {
    if (!purchase.id) {
      purchase.id = db.generateId('PUR');
    }
    await db.purchases.put(purchase);
    return purchase.id;
  }

  /**
   * Retrieves all cash flow transactions.
   */
  static async getCashFlow(): Promise<CashFlow[]> {
    return await db.cashFlow.toArray();
  }

  /**
   * Saves a cash flow transaction.
   */
  static async saveCashFlow(cashFlow: CashFlow): Promise<string> {
    if (!cashFlow.transaction_id) {
      cashFlow.transaction_id = db.generateId('CF');
    }
    await db.cashFlow.put(cashFlow);
    return cashFlow.transaction_id;
  }

  /**
   * Retrieves all journal entries.
   */
  static async getJournalEntries(): Promise<AccountingEntry[]> {
    return await db.journalEntries.toArray();
  }

  /**
   * Saves a journal entry.
   */
  static async saveJournalEntry(entry: AccountingEntry): Promise<string> {
    if (!entry.id) {
      entry.id = db.generateId('ENT');
    }
    await db.journalEntries.put(entry);
    return entry.id;
  }

  /**
   * Retrieves all suppliers.
   */
  static async getSuppliers(): Promise<Supplier[]> {
    return await db.suppliers.toArray();
  }

  /**
   * Retrieves all customers.
   */
  static async getCustomers(): Promise<Supplier[]> {
    return await db.customers.toArray();
  }

  /**
   * Saves a settlement.
   */
  static async saveSettlement(settlement: InvoiceSettlement): Promise<string> {
    if (!settlement.id) {
      settlement.id = db.generateId('SET');
    }
    await db.settlements.put(settlement);
    return settlement.id;
  }
}
