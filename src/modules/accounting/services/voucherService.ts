
import { db } from '@/core/db';
import { AccountingEngine } from './AccountingEngine';
import { Receipt, Payment } from '@/types';
import { useAppStore } from '@/hooks/useAppStore';
import { SubscriptionService } from '@/services/saas/subscriptionService';

export const voucherService = {
  createReceipt: async (data: { customer_id: string; amount: number; notes?: string; date?: string; paymentMethod?: 'CASH' | 'TRANSFER' }) => {
    // Trial limit check
    const plan = localStorage.getItem('saas_active_plan') || 'TRIAL';
    if (plan === 'TRIAL') {
      const usage = await SubscriptionService.getLocalUsageCount();
      if (usage >= 200) {
        useAppStore.getState().setTrialBlockedModalOpen(true);
        throw new Error("تم الوصول للحد التجريبي 200 عملية. يرجى الاشتراك للمتابعة.");
      }
    }

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
    
    // Save to Dexie Vouchers table
    await db.db.vouchers.put({
       id,
       idVoucher: id,
       type: 'RCPT',
       amount: data.amount,
       partnerId: data.customer_id,
       notes: data.notes,
       date,
       userId: 'local-user',
       created_at: new Date().toISOString(),
       lastModified: new Date().toISOString(),
       syncStatus: 'NEW'
    } as any);

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
    
    await db.addJournalEntry(entry);
    
    return receipt;
  },

  createPayment: async (data: { supplier_id: string; amount: number; notes?: string; date?: string; paymentMethod?: 'CASH' | 'TRANSFER' }) => {
    // Trial limit check
    const plan = localStorage.getItem('saas_active_plan') || 'TRIAL';
    if (plan === 'TRIAL') {
      const usage = await SubscriptionService.getLocalUsageCount();
      if (usage >= 200) {
        useAppStore.getState().setTrialBlockedModalOpen(true);
        throw new Error("تم الوصول للحد التجريبي 200 عملية. يرجى الاشتراك للمتابعة.");
      }
    }

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
    
    // Save to Dexie Vouchers table
    await db.db.vouchers.put({
       id,
       idVoucher: id,
       type: 'PAY',
       amount: data.amount,
       partnerId: data.supplier_id,
       notes: data.notes,
       date,
       userId: 'local-user',
       created_at: new Date().toISOString(),
       lastModified: new Date().toISOString(),
       syncStatus: 'NEW'
    } as any);

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
    
    await db.addJournalEntry(entry);
    
    return payment;
  }
};
