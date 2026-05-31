
import { InvoiceStatus, InvoiceItem } from '@/types';
import { SystemOrchestrator } from '@/services/system/SystemOrchestrator';
import { voucherService } from '@/modules/accounting/services/voucherService';

export interface SaleOptions {
  isCash: boolean;
  paymentStatus: 'Cash' | 'Credit';
  currency: string;
  isReturn?: boolean;
  invoiceStatus?: InvoiceStatus; 
  date?: string;
  originalInvoiceId?: string;
}

export interface InvoiceRequest {
  type: 'SALE' | 'PURCHASE';
  payload: {
    customerId?: string;
    supplierId?: string;
    items: InvoiceItem[];
    total: number;
    invoiceId?: string; 
    id?: string; 
    date?: string;
    notes?: string;
    attachment?: string;
  };
  options?: SaleOptions | { isCash: boolean; isReturn: boolean; invoiceStatus?: InvoiceStatus; date?: string; originalInvoiceId?: string };
}

// We'll modify the existing transactionOrchestrator to use SystemOrchestrator
export const transactionOrchestrator = {
  async processInvoiceTransaction(invoice: InvoiceRequest): Promise<{ success: boolean; refId?: string }> {
    const result = await SystemOrchestrator.processInvoice(invoice as any);
    return result;
  },

  async unpostInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    const result = await SystemOrchestrator.unpostInvoice(invoiceId, type);
    return result;
  },

  async deleteInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    const result = await SystemOrchestrator.deleteInvoice(invoiceId, type);
    return result;
  },

  /**
   * Central execution layer for ERP transactions.
   */
  async processTransaction(type: 'purchase' | 'purchase_return' | 'sale' | 'sale_return' | 'supplier_payment' | 'customer_payment', data: any): Promise<{ success: boolean; refId?: string }> {
    let result: { success: boolean; refId?: string };
    switch(type) {
      case 'purchase':
        result = await this.handlePurchase(data);
        break;
      case 'purchase_return':
        result = await this.handlePurchaseReturn(data);
        break;
      case 'sale':
        result = await this.handleSale(data);
        break;
      case 'sale_return':
        result = await this.handleSalesReturn(data);
        break;
      case 'supplier_payment':
        result = await this.settleSupplier(data);
        break;
      case 'customer_payment':
        result = await this.settleCustomer(data);
        break;
      default:
        throw new Error(`Unknown transaction type: ${type}`);
    }

    // 3. NO AUTO PUSH - OFFLINE ONLY
    return result;
  },

  async handlePurchase(data: any) {
    return await SystemOrchestrator.processInvoice({
      type: 'PURCHASE',
      payload: {
        supplierId: data.supplierId,
        items: data.items,
        total: data.total,
        date: data.date,
        notes: data.notes,
        id: data.invoiceId
      },
      options: {
        isCash: data.type === 'cash',
        paymentStatus: data.type === 'cash' ? 'Cash' : 'Credit'
      }
    });
  },

  async handlePurchaseReturn(data: any) {
    return await SystemOrchestrator.processInvoice({
      type: 'PURCHASE',
      payload: {
        supplierId: data.supplierId,
        items: data.items,
        total: data.total,
        date: data.date,
        notes: data.notes,
        id: data.invoiceId
      },
      options: {
        isReturn: true,
        isCash: data.type === 'cash',
        paymentStatus: data.type === 'cash' ? 'Cash' : 'Credit'
      }
    });
  },

  async handleSale(data: any) {
    return await SystemOrchestrator.processInvoice({
      type: 'SALE',
      payload: {
        customerId: data.customerId,
        items: data.items,
        total: data.total,
        date: data.date,
        notes: data.notes,
        id: data.invoiceId
      },
      options: {
        isCash: data.type === 'cash',
        paymentStatus: data.type === 'cash' ? 'Cash' : 'Credit'
      }
    });
  },

  async handleSalesReturn(data: any) {
    return await SystemOrchestrator.processInvoice({
      type: 'SALE',
      payload: {
        customerId: data.customerId,
        items: data.items,
        total: data.total,
        date: data.date,
        notes: data.notes,
        id: data.invoiceId
      },
      options: {
        isReturn: true,
        isCash: data.type === 'cash',
        paymentStatus: data.type === 'cash' ? 'Cash' : 'Credit'
      }
    });
  },

  async settleSupplier(data: any) {
    const result = await voucherService.createPayment({
      supplier_id: data.supplierId,
      amount: data.amount,
      notes: data.notes,
      date: data.date || new Date().toISOString()
    });
    return { success: true, refId: result.id };
  },

  async settleCustomer(data: any) {
    const result = await voucherService.createReceipt({
      customer_id: data.customerId,
      amount: data.amount,
      notes: data.notes,
      date: data.date || new Date().toISOString()
    });
    return { success: true, refId: result.id };
  }
};
