
import { db } from '../services/database';
import { Account, AccountingEntry } from '../types';

const MAX_ACCOUNTING_SLICE = 200;
let ACCOUNTS_CACHE: Account[] | null = null;
let ACCOUNTS_CACHE_TIMESTAMP = 0;
const CACHE_TTL = 30000; // 30 ثانية لدليل الحسابات

export const AccountRepository = {
  // --- دليل الحسابات مع التخزين المؤقت (Performance Rule: Cache frequently accessed lists) ---
  getAccounts: (): Account[] => {
    const now = Date.now();
    if (ACCOUNTS_CACHE && (now - ACCOUNTS_CACHE_TIMESTAMP < CACHE_TTL)) return ACCOUNTS_CACHE;
    
    ACCOUNTS_CACHE = db.getAccounts();
    ACCOUNTS_CACHE_TIMESTAMP = now;
    return ACCOUNTS_CACHE;
  },

  getAccountById: (id: string): Account | undefined =>
    AccountRepository.getAccounts().find(a => a.id === id),

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
    await db.addJournalEntry(entry);
  },

  deleteEntriesBySource: async (sourceId: string) => {
    const all = await db.getJournalEntries();
    const filtered = all.filter(e => e.sourceId !== sourceId && (e as any).SourceID !== sourceId);
    if (all.length !== filtered.length) {
      await db.persist('journalEntries', filtered);
    }
  },

  getAccountBalance: async (accountName: string): Promise<number> => {
    return await db.getAccountBalance(accountName);
  },

  isDateLocked: async (date: string): Promise<boolean> => {
    return await db.isDateLocked(date);
  }
};
