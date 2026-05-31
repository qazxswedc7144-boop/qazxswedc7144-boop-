
import { db } from '@/core/db';
import { Account, AccountingEntry, CashFlow, Transaction } from '@/types';

const MAX_ACCOUNTING_SLICE = 200;

export const AccountingRepository = {
  // --- دليل الحسابات ---
  getAccounts: async (): Promise<Account[]> => {
    return await db.accounts.toArray();
  },

  getAccountById: async (id: string): Promise<Account | undefined> => {
    return await db.accounts.get(id);
  },

  saveAccount: async (account: Account) => {
    await db.accounts.put(account);
  },

  deleteAccount: async (id: string) => {
    await db.accounts.delete(id);
  },

  // --- القيود اليومية ---
  getAllJournalEntries: async (): Promise<AccountingEntry[]> => {
    return await db.journalEntries.toArray();
  },

  getEntries: async (): Promise<AccountingEntry[]> => {
    return await db.journalEntries.toArray();
  },

  getRecentJournalEntries: async (): Promise<AccountingEntry[]> => {
    return await db.journalEntries.orderBy('date').reverse().limit(MAX_ACCOUNTING_SLICE).toArray();
  },

  addEntry: async (entry: AccountingEntry) => {
    // Audit log integration
    const totalDebit = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`قيد غير متزن: إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit}) للفاتورة #${entry.sourceId}`);
    }

    await db.safeTransaction('rw', ['journalEntries', 'accounts', 'journalLines'], async () => {
      const entryId = entry.id || db.generateId('ENT');
      
      await db.journalEntries.add({
        ...entry,
        id: entryId,
        created_at: new Date().toISOString()
      });
      
      // Update account balances
      for (const line of entry.lines) {
        const amount = (line.debit || 0) - (line.credit || 0);
        const account = await db.accounts.get(line.accountId);
        if (account) {
          await db.accounts.update(line.accountId, {
            balance: (account.balance || 0) + amount,
            updatedAt: new Date().toISOString()
          });
        }

        // Also save journal lines separately if needed for indexing
        await db.journalLines.add({
          ...line,
          entryId
        } as any);
      }
    });
  },

  // Alias for addEntry to support legacy code
  addJournalEntry: async (entry: AccountingEntry) => {
    return await AccountingRepository.addEntry(entry);
  },

  deleteEntry: async (entryId: string) => {
    await db.safeTransaction('rw', ['journalEntries', 'accounts', 'journalLines'], async () => {
      const entry = await db.journalEntries.get(entryId);
      if (entry) {
        // Reverse balances before deleting
        for (const line of (entry.lines || [])) {
          const amount = (line.credit || 0) - (line.debit || 0);
          const account = await db.accounts.get(line.accountId);
          if (account) {
            await db.accounts.update(line.accountId, {
              balance: (account.balance || 0) + amount,
              updatedAt: new Date().toISOString()
            });
          }
        }
        await db.journalEntries.delete(entryId);
        // Also delete lines
        await db.journalLines.where('entryId').equals(entryId).delete();
      }
    });
  },

  deleteEntriesBySource: async (sourceId: string) => {
    const entries = await db.journalEntries.where('sourceId').equals(sourceId).toArray();
    if (entries) {
      for (const entry of entries) {
        await AccountingRepository.deleteEntry(entry.id);
      }
    }
  },

  getAccountBalance: async (accountName: string): Promise<number> => {
    const account = await db.accounts.where('name').equals(accountName).first();
    return account ? account.balance || 0 : 0;
  },

  isDateLocked: async (date: string): Promise<boolean> => {
    const period = await db.accountingPeriods
      .where('Start_Date').belowOrEqual(date)
      .and(p => p.End_Date >= date && p.Is_Locked)
      .first();
    return !!period;
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const invoices = await db.getTransactions();
    return invoices.map(inv => ({
      id: inv.id,
      date: inv.date,
      amount: inv.finalTotal,
      type: inv.type === 'SALE' ? 'sale' : 'purchase',
      customer: inv.partnerName,
      lastModified: inv.lastModified
    }));
  },

  getCashFlow: async (): Promise<CashFlow[]> => {
    return await db.getCashFlow();
  }
};
