
import { db } from '../lib/database';
import { AccountingEngine } from './AccountingEngine';
import { Receipt, Payment } from '../types';

export const voucherService = {
  createReceipt: async (data: { customer_id: string; amount: number; notes?: string; date?: string; paymentMethod?: 'CASH' | 'TRANSFER' }) => {
    if (data.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
    if (!data.customer_id) throw new Error('يرجى اختيار العميل');
    
    const id = db.generateId('RCPT');
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
    
    await db.db.receipts.add(receipt);
    
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
    
    await db.saveAccountingEntry(entry);
    
    // Update Customer Balance
    await db.updateCustomerBalance(data.customer_id, -data.amount); // Receipt reduces receivable
    
    return receipt;
  },

  createPayment: async (data: { supplier_id: string; amount: number; notes?: string; date?: string; paymentMethod?: 'CASH' | 'TRANSFER' }) => {
    if (data.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
    if (!data.supplier_id) throw new Error('يرجى اختيار المورد');
    
    const id = db.generateId('PAY');
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
    
    await db.db.payments.add(payment);
    
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
    
    await db.saveAccountingEntry(entry);
    
    // Update Supplier Balance
    await db.updateSupplierBalance(data.supplier_id, -data.amount); // Payment reduces payable
    
    return payment;
  }
};
