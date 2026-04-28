
import { supabase, TABLE_NAMES } from '../../lib/supabase';
import { Supplier, SupplierLedgerEntry, PurchaseRecord, PartnerLedgerEntry } from '../../types';

export const SupplierRepository = {
  getSuppliers: async (): Promise<Supplier[]> => {
    const { data, error } = await supabase
      .from(TABLE_NAMES.SUPPLIERS)
      .select('*');
    
    if (error) {
      console.error('Error fetching suppliers from Supabase:', error);
      return [];
    }
    return data as any[];
  },

  getCustomers: async (): Promise<Supplier[]> => {
    const { data, error } = await supabase
      .from(TABLE_NAMES.CUSTOMERS)
      .select('*');
    
    if (error) {
      console.error('Error fetching customers from Supabase:', error);
      return [];
    }
    return data as any[];
  },

  save: async (partner: Supplier, type: 'S' | 'C') => {
    const table = type === 'S' ? TABLE_NAMES.SUPPLIERS : TABLE_NAMES.CUSTOMERS;
    const { error } = await supabase
      .from(table)
      .upsert({
        ...partner,
        Created_At: partner.Created_At || new Date().toISOString()
      });

    if (error) throw new Error(`Failed to save partner to Supabase: ${error.message}`);
  },

  delete: async (id: string, type: 'S' | 'C') => {
    const table = type === 'S' ? TABLE_NAMES.SUPPLIERS : TABLE_NAMES.CUSTOMERS;
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete partner from Supabase: ${error.message}`);
  },

  getById: async (id: string, type: 'S' | 'C' = 'S'): Promise<Supplier | undefined> => {
    const table = type === 'S' ? TABLE_NAMES.SUPPLIERS : TABLE_NAMES.CUSTOMERS;
    const { data } = await supabase.from(table).select('*').eq('id', id).single();
    return data as any;
  },

  getPartnerBalance: async (id: string, type: 'S' | 'C'): Promise<number> => {
    const table = type === 'S' ? TABLE_NAMES.SUPPLIERS : TABLE_NAMES.CUSTOMERS;
    const { data } = await supabase.from(table).select('Balance').eq('id', id).single();
    return data?.Balance || 0;
  },

  getLedger: async (partnerId: string, start?: string, end?: string): Promise<PartnerLedgerEntry[]> => {
    let query = supabase.from('partner_ledger').select('*').eq('partnerId', partnerId);
    if (start) query = query.gte('date', start);
    if (end) query = query.lte('date', end);
    const { data } = await query.order('date', { ascending: false });
    return data as any[] || [];
  },

  postToLedger: async (entry: PartnerLedgerEntry) => {
    const { error } = await supabase.from('partner_ledger').insert(entry);
    if (error) console.error('Failed to post to ledger:', error.message);
  },

  getInvoicePaymentHistory: async (invoiceId: string) => {
    const { data } = await supabase.from('invoice_settlements').select('*').eq('invoiceId', invoiceId);
    return data || [];
  }
};
