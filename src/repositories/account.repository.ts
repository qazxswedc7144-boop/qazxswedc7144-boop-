
import { supabase, TABLE_NAMES } from '../lib/supabase';
import { Account, AccountingEntry } from '../types';

const MAX_ACCOUNTING_SLICE = 200;

export const AccountRepository = {
  // --- دليل الحسابات ---
  getAccounts: async (): Promise<Account[]> => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
    return data as any[];
  },

  getAccountById: async (id: string): Promise<Account | undefined> => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return data as any;
  },

  saveAccount: async (account: Account) => {
    const { error } = await supabase
      .from('accounts')
      .upsert(account);
    
    if (error) throw new Error(`Failed to save account: ${error.message}`);
  },

  deleteAccount: async (id: string) => {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(`Failed to delete account: ${error.message}`);
  },

  // --- القيود اليومية ---
  getAllJournalEntries: async (): Promise<AccountingEntry[]> => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) return [];
    return data as any[];
  },

  getRecentJournalEntries: async (): Promise<AccountingEntry[]> => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('date', { ascending: false })
      .limit(MAX_ACCOUNTING_SLICE);
    
    if (error) return [];
    return data as any[];
  },

  addEntry: async (entry: AccountingEntry) => {
    // Accounting Protection: Ensure total debit == total credit
    const totalDebit = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`قيد غير متزن: إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit}) للفاتورة #${entry.sourceId}`);
    }

    try {
      const { error: entryError } = await supabase
        .from('journal_entries')
        .insert(entry);
      
      if (entryError) {
        console.error('Supabase error detailed:', entryError);
        throw new Error(`Failed to add journal entry: [${entryError.code}] ${entryError.message}`);
      }
    } catch (err: any) {
      console.error('CRITICAL: Supabase connection/fetch error:', err);
      if (err.message?.includes('Failed to fetch')) {
        throw new Error(`خطأ في الاتصال بالسيرفر السحابي (Supabase): ${err.message}. يرجى التأكد من أن رابط Supabase صحيح ومتاح.`);
      }
      throw err;
    }
    
    // Update account balances
    for (const line of entry.lines) {
      const amount = (line.debit || 0) - (line.credit || 0);
      
      const { data: account } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', line.accountId)
        .single();
        
      if (account) {
        await supabase
          .from('accounts')
          .update({ balance: (account.balance || 0) + amount })
          .eq('id', line.accountId);
      }
    }
  },

  deleteEntry: async (entryId: string) => {
    const { data: entry } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (entry) {
      // Reverse balances before deleting
      for (const line of (entry.lines || [])) {
        const amount = (line.credit || 0) - (line.debit || 0);
        
        const { data: account } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', line.accountId)
          .single();
          
        if (account) {
          await supabase
            .from('accounts')
            .update({ balance: (account.balance || 0) + amount })
            .eq('id', line.accountId);
        }
      }
      
      await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entryId);
    }
  },

  deleteEntriesBySource: async (sourceId: string) => {
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('sourceId', sourceId);
      
    if (entries) {
      for (const entry of entries) {
        await AccountRepository.deleteEntry(entry.id);
      }
    }
  },

  getAccountBalance: async (accountName: string): Promise<number> => {
    const { data, error } = await supabase
      .from('accounts')
      .select('balance')
      .eq('name', accountName)
      .single();
    
    if (error || !data) return 0;
    return data.balance || 0;
  },

  isDateLocked: async (date: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('accounting_periods')
      .select('*')
      .eq('status', 'LOCKED');
      
    if (error || !data) return false;
    
    const targetDate = new Date(date);
    return data.some((p: any) => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return targetDate >= start && targetDate <= end;
    });
  },

  getTransactions: async (): Promise<any[]> => {
    const { data } = await supabase.from('transactions').select('*');
    return data || [];
  }
};
