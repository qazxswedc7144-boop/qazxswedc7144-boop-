import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// التحقق من صحة الإعدادات لمنع TypeError: Failed to fetch
if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL_HERE') {
  console.error('❌ CRITICAL: Supabase URL is missing or placeholder. Transactions will fail.');
}
if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_ANON_KEY_HERE') {
  console.error('❌ CRITICAL: Supabase Anon Key is missing or placeholder. Transactions will fail.');
}

// Ensure URL is absolute for fetch to succeed
const finalUrl = supabaseUrl?.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;

export const supabase = createClient(finalUrl, supabaseAnonKey || '');

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
