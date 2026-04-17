
import { db } from '../services/database';
import { Account, AccountingEntry } from '../types';
import { safeWhereEqual } from '../utils/dexieSafe';

const MAX_ACCOUNTING_SLICE = 200;
let ACCOUNTS_CACHE: Account[] | null = null;
let ACCOUNTS_CACHE_TIMESTAMP = 0;
const CACHE_TTL = 30000; // 30 ثانية لدليل الحسابات

export const AccountRepository = {
  // --- دليل الحسابات مع التخزين المؤقت (Performance Rule: Cache frequently accessed lists) ---
  getAccounts: async (): Promise<Account[]> => {
    const now = Date.now();
    if (ACCOUNTS_CACHE && (now - ACCOUNTS_CACHE_TIMESTAMP < CACHE_TTL)) return ACCOUNTS_CACHE;
    
    ACCOUNTS_CACHE = await db.getAccounts();
    ACCOUNTS_CACHE_TIMESTAMP = now;
    return ACCOUNTS_CACHE;
  },

  getAccountById: async (id: string): Promise<Account | undefined> =>
    (await AccountRepository.getAccounts()).find(a => a.id === id),

  saveAccount: async (account: Account) => {
    await db.saveAccount(account);
    // تفريغ الكاش لإعادة التحميل
    ACCOUNTS_CACHE = null; 
    ACCOUNTS_CACHE_TIMESTAMP = 0;
  },

  deleteAccount: async (id: string) => {
    await db.deleteAccount(id);
    ACCOUNTS_CACHE = null;
    ACCOUNTS_CACHE_TIMESTAMP = 0;
  },

  // --- القيود اليومية (Rule: Limit SELECT queries) ---
  getAllJournalEntries: async (): Promise<AccountingEntry[]> => {
    return await db.getJournalEntries();
  },

  getRecentJournalEntries: async (): Promise<AccountingEntry[]> => {
    const all = await db.getJournalEntries();
    return all.slice(0, MAX_ACCOUNTING_SLICE);
  },

  addEntry: async (entry: AccountingEntry) => {
    // Accounting Protection: Ensure total debit == total credit
    const totalDebit = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`قيد غير متزن: إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit}) للفاتورة #${entry.sourceId}`);
    }

    await db.addJournalEntry(entry);
    
    // Update account balances
    for (const line of entry.lines) {
      const amount = (line.debit || 0) - (line.credit || 0);
      await db.updateAccountBalance(line.accountId, amount);
    }
  },

  deleteEntry: async (entryId: string) => {
    const entry = await (db as any).journalEntries.get(entryId);
    if (entry) {
      // Reverse balances before deleting
      for (const line of entry.lines) {
        const amount = (line.credit || 0) - (line.debit || 0);
        await db.updateAccountBalance(line.accountId, amount);
      }
      await (db as any).journalEntries.delete(entryId);
    }
  },

  deleteEntriesBySource: async (sourceId: string) => {
    const entries = await safeWhereEqual((db as any).journalEntries, 'sourceId', sourceId);
    for (const entry of entries) {
      await AccountRepository.deleteEntry(entry.id);
    }
  },

  getAccountBalance: async (accountName: string): Promise<number> => {
    return await db.getAccountBalance(accountName);
  },

  isDateLocked: async (date: string): Promise<boolean> => {
    return await db.isDateLocked(date);
  }
};
