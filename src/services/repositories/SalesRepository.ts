
import { supabase, TABLE_NAMES } from '../../lib/supabase';
import { Sale, InvoiceStatus, ValidationError, PaymentStatus } from '../../types';
import { priceIntelligenceService } from '../../services/priceIntelligence.service';
import { InvoiceCounterRepository } from './InvoiceCounterRepository';
import { PriceHistoryRepository } from './PriceHistoryRepository';
import { InvoiceWorkflowEngine } from '../../services/InvoiceWorkflowEngine';

export interface PriceInsight {
  price: number;
  type: 'customer' | 'global' | 'standard' | 'suggested';
  lastDate?: string;
  lastCustomer?: string;
  isSuggested?: boolean;
}

const calculatePaymentStatus = (paid: number, total: number): PaymentStatus => {
  const p = parseFloat(paid.toFixed(2));
  const t = parseFloat(total.toFixed(2));
  if (p === 0) return 'Unpaid';
  if (p < t) return 'Partially Paid';
  return 'Paid';
};

export const SalesRepository = {
  getAll: async (): Promise<Sale[]> => {
    const { data, error } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*')
      .eq('type', 'sale');
    
    if (error) {
      console.error('Error fetching sales from Supabase:', error);
      return [];
    }
    return data as any[];
  },

  getById: async (id: string): Promise<Sale | undefined> => {
    const { data, error } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*')
      .or(`id.eq.${id},SaleID.eq.${id}`)
      .single();
    
    if (error) return undefined;
    return data as any;
  },

  updatePaidAmount: async (id: string, amountToAdd: number): Promise<void> => {
    const { data: sale, error: fetchError } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*')
      .or(`id.eq.${id},SaleID.eq.${id}`)
      .single();

    if (fetchError || !sale) throw new Error('Sale not found');

    const currentPaid = sale.paidAmount || 0;
    const total = sale.total_amount || 0;
    const newPaid = parseFloat((currentPaid + amountToAdd).toFixed(2));
    
    const nextStatus = InvoiceWorkflowEngine.determineNextStatus(total, newPaid, sale.status || 'PENDING');

    const { error: updateError } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .update({ 
        paidAmount: newPaid, 
        status: nextStatus,
        payment_status: calculatePaymentStatus(newPaid, total)
      })
      .eq('id', sale.id);

    if (updateError) throw new Error(`Failed to update payment in Supabase: ${updateError.message}`);
  },

  getNextInvoiceNumber: async (isReturn: boolean = false): Promise<string> => {
    // In a real system we'd use a DB function or a counter table in Supabase
    const { data, error } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('id', { count: 'exact', head: true })
      .eq('type', 'sale');
    
    const count = data?.length || 0;
    return `A${1000 + count + 1}`;
  },

  process: async (customerId: string, items: any[], subtotal: number, isReturn: boolean, inv: string, curr: string, status: string, pid?: string, invoiceStatus: InvoiceStatus = 'DRAFT') => {
    const id = pid || `INV-${Date.now()}`;
    const now = new Date().toISOString();
    
    const invoicePayload = {
      id,
      type: isReturn ? 'return' : 'sale',
      status: invoiceStatus,
      total_amount: subtotal,
      date: now,
      partner_id: customerId,
      created_at: now
    };

    const { data, error } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .insert(invoicePayload)
      .select()
      .single();

    if (error) throw new Error(`Failed to process sale in Supabase: ${error.message}`);
    
    return { success: true, sale_id: data.id };
  },

  getUnpaidByCustomer: async (customerId: string): Promise<Sale[]> => {
    const { data } = await supabase
      .from(TABLE_NAMES.INVOICES)
      .select('*')
      .eq('type', 'sale')
      .eq('partner_id', customerId)
      .neq('status', 'PAID');
    return data as any[] || [];
  },

  getSafeUniqueNumber: async (isReturn: boolean = false): Promise<string> => {
    return `INV-TEMP-${Date.now()}`;
  },

  promoteToFinalNumber: async (tempId: string, finalNumber: string) => {
    await supabase.from(TABLE_NAMES.INVOICES).update({ SaleID: finalNumber }).eq('id', tempId);
  }
};
