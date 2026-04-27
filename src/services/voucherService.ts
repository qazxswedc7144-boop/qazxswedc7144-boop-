
import { supabase, TABLE_NAMES } from '../lib/supabase';
import { AccountingEngine } from './AccountingEngine';
import { Receipt, Payment } from '../types';

export const voucherService = {
  createReceipt: async (data: { customer_id: string; amount: number; notes?: string; date?: string; paymentMethod?: 'CASH' | 'TRANSFER' }) => {
    if (data.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
    if (!data.customer_id) throw new Error('يرجى اختيار العميل');
    
    const id = `RCPT-${Date.now()}`;
    const date = data.date || new Date().toISOString();
    
    const receipt: Receipt = {
      id,
      date,
      customer_id: data.customer_id,
      amount: data.amount,
      notes: data.notes,
      paymentMethod: data.paymentMethod || 'CASH',
      created_at: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    // Save to Supabase Vouchers table
    const { error: vError } = await supabase.from(TABLE_NAMES.VOUCHERS).insert({
       id,
       type: 'RECEIPT',
       amount: data.amount,
       partner_id: data.customer_id,
       notes: data.notes,
       date,
       created_at: new Date().toISOString()
    });

    if (vError) throw new Error(`Failed to save voucher to Supabase: ${vError.message}`);
    
    // Journal Entry
    const entry = await AccountingEngine.generateVoucherEntry({
      type: 'RECEIPT',
      amount: data.amount,
      partnerId: data.customer_id,
      date,
      refId: id,
      notes: data.notes,
      paymentMethod: data.paymentMethod
    });
    
    await supabase.from(TABLE_NAMES.JOURNAL_ENTRIES).insert(entry);
    
    return receipt;
  },

  createPayment: async (data: { supplier_id: string; amount: number; notes?: string; date?: string; paymentMethod?: 'CASH' | 'TRANSFER' }) => {
    if (data.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
    if (!data.supplier_id) throw new Error('يرجى اختيار المورد');
    
    const id = `PAY-${Date.now()}`;
    const date = data.date || new Date().toISOString();
    
    const payment: Payment = {
      id,
      date,
      supplier_id: data.supplier_id,
      amount: data.amount,
      notes: data.notes,
      paymentMethod: data.paymentMethod || 'CASH',
      created_at: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    // Save to Supabase Vouchers table
    const { error: vError } = await supabase.from(TABLE_NAMES.VOUCHERS).insert({
       id,
       type: 'PAYMENT',
       amount: data.amount,
       partner_id: data.supplier_id,
       notes: data.notes,
       date,
       created_at: new Date().toISOString()
    });

    if (vError) throw new Error(`Failed to save voucher to Supabase: ${vError.message}`);
    
    // Journal Entry
    const entry = await AccountingEngine.generateVoucherEntry({
      type: 'PAYMENT',
      amount: data.amount,
      partnerId: data.supplier_id,
      date,
      refId: id,
      notes: data.notes,
      paymentMethod: data.paymentMethod
    });
    
    await supabase.from(TABLE_NAMES.JOURNAL_ENTRIES).insert(entry);
    
    return payment;
  }
};
