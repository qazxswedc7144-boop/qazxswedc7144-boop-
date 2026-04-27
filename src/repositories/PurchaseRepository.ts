
import { supabase, TABLE_NAMES } from '../lib/supabase';
import { Purchase, PaymentStatus } from '../types';
import { InvoiceCounterRepository } from './InvoiceCounterRepository';
import { priceIntelligenceService } from '../services/priceIntelligence.service';
import { InvoiceWorkflowEngine } from '../services/InvoiceWorkflowEngine';

const calculatePaymentStatus = (paid: number, total: number): PaymentStatus => {
  const p = parseFloat(paid.toFixed(2));
  const t = parseFloat(total.toFixed(2));
  if (p === 0) return 'Unpaid';
  if (p < t) return 'Partially Paid';
  return 'Paid';
};

export const PurchaseRepository = {
  getAll: async (): Promise<Purchase[]> => {
    const { data, error } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*')
      .eq('type', 'purchase');
    
    if (error) {
       console.error('Error fetching purchases from Supabase:', error);
       return [];
    }
    return data as any[];
  },

  updatePaidAmount: async (id: string, amountToAdd: number): Promise<void> => {
    const { data: purchase, error: fetchError } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !purchase) throw new Error('Purchase not found');

    const currentPaid = purchase.paidAmount || 0;
    const total = purchase.total_amount || 0;
    const newPaid = parseFloat((currentPaid + amountToAdd).toFixed(2));
    
    const nextStatus = InvoiceWorkflowEngine.determineNextStatus(total, newPaid, purchase.status || 'PENDING');

    const { error: updateError } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .update({ 
        paidAmount: newPaid, 
        status: nextStatus,
        payment_status: calculatePaymentStatus(newPaid, total)
      })
      .eq('id', id);

    if (updateError) throw new Error(`Failed to update purchase payment in Supabase: ${updateError.message}`);
  },

  getNextInvoiceNumber: async (): Promise<string> => {
    const { data, error } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('id', { count: 'exact', head: true })
      .eq('type', 'purchase');
    
    const count = data?.length || 0;
    return (5000 + count + 1).toString();
  },

  getItemPurchaseHistory: async (productId: string, limit: number = 5): Promise<Purchase[]> => {
    const { data } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*')
      .eq('type', 'purchase')
      .contains('items', [{ product_id: productId }])
      .order('date', { ascending: false })
      .limit(limit);
    return data as any[] || [];
  },

  getUnpaidBySupplier: async (supplierId: string): Promise<Purchase[]> => {
    const { data } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*')
      .eq('type', 'purchase')
      .eq('partnerId', supplierId)
      .neq('status', 'PAID');
    return data as any[] || [];
  },

  settleSupplierFIFO: async (supplierId: string, amount: number) => {
    console.log(`Settling FIFO for ${supplierId} with ${amount}`);
  },

  isInvoiceNumberDuplicate: async (num: string, excludeId?: string): Promise<boolean> => {
    const { count } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*', { count: 'exact', head: true })
      .eq('invoiceId', num)
      .neq('id', excludeId || 'none');
    return (count || 0) > 0;
  },

  getLastPurchasePriceForItem: async (productId: string): Promise<number> => {
    const { data } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('items')
      .eq('type', 'purchase')
      .contains('items', [{ product_id: productId }])
      .order('date', { ascending: false })
      .limit(1);
    
    if (data && data[0] && data[0].items) {
      const item = data[0].items.find((i: any) => i.product_id === productId);
      return item?.price || 0;
    }
    return 0;
  }
};
