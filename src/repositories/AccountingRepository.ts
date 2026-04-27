
import { supabase, TABLE_NAMES } from '../lib/supabase';
import { AccountingEntry, CashFlow, Transaction } from '../types';

export const AccountingRepository = {
  getEntries: async (): Promise<AccountingEntry[]> => {
    const { data, error } = await supabase
      .from(TABLE_NAMES.JOURNAL_ENTRIES)
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching journal entries from Supabase:', error);
      return [];
    }
    return data as any[];
  },

  getCashFlow: async (): Promise<CashFlow[]> => {
    const { data, error } = await supabase
      .from('cash_flow') // Assuming table name
      .select('*');
    
    if (error) return [];
    return data as any[];
  },

  getAccountBalance: async (accountName: string): Promise<number> => {
    // This would ideally be a complex query or a view in Supabase
    const { data, error } = await supabase
      .from(TABLE_NAMES.JOURNAL_ENTRIES)
      .select('total_debit, total_credit');
    
    if (error) return 0;
    return (data as any[]).reduce((sum, e) => sum + (e.total_debit || 0) - (e.total_credit || 0), 0);
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions') // Assuming table name
      .select('*');
    
    if (error) {
      console.error('Error fetching transactions from Supabase:', error);
      return [];
    }
    return data as any[];
  },

  addJournalEntry: async (entry: AccountingEntry) => {
    const { error } = await supabase
      .from(TABLE_NAMES.JOURNAL_ENTRIES)
      .insert(entry);
    
    if (error) throw new Error(`Failed to add journal entry to Supabase: ${error.message}`);
  }
};
