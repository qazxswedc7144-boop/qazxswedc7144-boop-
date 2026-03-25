
import { db } from '../services/database';
import { AccountingEntry, CashFlow, Transaction } from '../types';

export const AccountingRepository = {
  // Fix: Methods now return Promise to match database async implementation
  getEntries: async (): Promise<AccountingEntry[]> => {
    return await db.getJournalEntries();
  },

  getCashFlow: async (): Promise<CashFlow[]> => {
    return await db.getCashFlow();
  },

  getTransactions: async (): Promise<Transaction[]> => {
    return await db.getTransactions();
  },

  getAccountBalance: async (accountName: string): Promise<number> => {
    return await db.getAccountBalance(accountName);
  },

  // Fix: Changed signature to async and return Promise<boolean> as db.isDateLocked is async
  isDateLocked: async (date: string): Promise<boolean> => {
    return await db.isDateLocked(date);
  },

  addJournalEntry: async (entry: AccountingEntry) => {
    await db.addJournalEntry(entry);
  },

  getSales: async () => {
    return await db.getSales();
  }
};