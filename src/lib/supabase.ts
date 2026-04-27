import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const TABLE_NAMES = {
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  INVOICES: 'invoices',
  SALES: 'sales',
  PURCHASES: 'purchases',
  JOURNAL_ENTRIES: 'journal_entries',
  AUDIT_LOG: 'audit_log',
  AI_LOGS: 'ai_logs',
  VOUCHERS: 'vouchers', 
};
