
import { db } from '../lib/database';
import { Sale, InvoiceStatus, ValidationError, PaymentStatus } from '../types';
import { priceIntelligenceService } from '../services/priceIntelligence.service';
import { InvoiceCounterRepository } from './InvoiceCounterRepository';
import { PriceHistoryRepository } from './PriceHistoryRepository';
import { InvoiceWorkflowEngine } from '../services/InvoiceWorkflowEngine';

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
    return await db.getSales();
  },

  getById: async (id: string): Promise<Sale | undefined> => {
    const sales = await db.getSales();
    return sales.find(s => s.SaleID === id || s.id === id);
  },

  getUnpaidByCustomer: async (customerId: string): Promise<Sale[]> => {
    const all = await SalesRepository.getAll();
    return all.filter(s => 
      s.customerId === customerId && 
      s.paymentStatus === 'Credit' &&
      (s.paidAmount || 0) < s.finalTotal &&
      s.InvoiceStatus !== 'DRAFT' &&
      s.InvoiceStatus !== 'CANCELLED'
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  updatePaidAmount: async (id: string, amountToAdd: number): Promise<void> => {
    const sales = await db.getSales();
    const idx = sales.findIndex(s => s.id === id || s.SaleID === id);
    if (idx > -1) {
      const s = sales[idx];
      const currentPaid = s.paidAmount || 0;
      const total = s.finalTotal || 0;
      const remaining = total - currentPaid;
      
      if (amountToAdd > parseFloat(remaining.toFixed(2)) + 0.01) {
        throw new Error(`الفاتورة #${s.SaleID}: المبلغ المضاف يتجاوز المتبقي`);
      }

      const newPaid = parseFloat((currentPaid + amountToAdd).toFixed(2));
      s.paidAmount = newPaid;
      s.payment_status = calculatePaymentStatus(newPaid, total);
      
      // تحديث حالة الفاتورة بناءً على سير العمل (Workflow Update)
      const nextStatus = InvoiceWorkflowEngine.determineNextStatus(total, newPaid, s.InvoiceStatus || 'PENDING');
      s.InvoiceStatus = nextStatus;

      await db.persist('sales', sales);
    }
  },

  /**
   * جلب سعر البيع المقترح باستخدام محرك تحليل سجل الأسعار (Phase 13)
   */
  getLastSellingPriceForItem: async (productId: string, customerId?: string): Promise<PriceInsight> => {
    if (!productId) return { price: 0, type: 'standard' };

    const suggestion = await priceIntelligenceService.getSuggestedPrice(productId, 'SALE', customerId === 'عميل نقدي' ? undefined : customerId);

    if (suggestion.suggestedPrice !== null) {
      return {
        price: suggestion.suggestedPrice,
        type: suggestion.basis === 'partner' ? 'customer' : 'global',
        isSuggested: true
      };
    }

    if (customerId && customerId !== 'عميل نقدي') {
      const lastEntry = await PriceHistoryRepository.getDetailedLastPrice(productId, customerId);
      if (lastEntry) return { price: lastEntry.Price, type: 'customer', lastDate: lastEntry.Invoice_Date, lastCustomer: lastEntry.Customer };
    }

    const recentInsights = await PriceHistoryRepository.getRecentInsights(productId, 1);
    if (recentInsights.length > 0) return { price: recentInsights[0].Price, type: 'global', lastDate: recentInsights[0].Invoice_Date, lastCustomer: recentInsights[0].Customer };

    const product = (await db.getProducts()).find(p => p.id === productId);
    if (product) return { price: product.UnitPrice || 0, type: 'standard' };

    return { price: 0, type: 'standard' };
  },

  isInvoiceNumberDuplicate: async (invNum: string, excludeId?: string | null): Promise<boolean> => {
    if (!invNum) return false;
    const sales = await db.getSales();
    const normalizedNum = invNum.trim().toUpperCase();
    return sales.some(s => (s.SaleID?.trim().toUpperCase() === normalizedNum || s.id?.trim().toUpperCase() === normalizedNum) && s.id !== excludeId && s.SaleID !== excludeId);
  },

  getNextInvoiceNumber: async (isReturn: boolean = false): Promise<string> => {
    const nextSeq = await InvoiceCounterRepository.getNextNumber('Sales', 1000);
    return `A${nextSeq}`;
  },

  getSafeUniqueNumber: async (isReturn: boolean = false, excludeId?: string | null): Promise<string> => {
    let candidate = await SalesRepository.getNextInvoiceNumber(isReturn);
    if (navigator.onLine) {
      let isDup = await SalesRepository.isInvoiceNumberDuplicate(candidate, excludeId);
      while (isDup) {
        candidate = await SalesRepository.getNextInvoiceNumber(isReturn);
        isDup = await SalesRepository.isInvoiceNumberDuplicate(candidate, excludeId);
      }
    }
    return candidate;
  },

  promoteToFinalNumber: async (id: string, newSaleId: string): Promise<void> => {
    const sales = await db.getSales();
    const saleIdx = sales.findIndex(s => s.id === id || s.SaleID === id);
    if (saleIdx > -1) {
      const sale = sales[saleIdx];
      sale.originalProvisionalId = sale.SaleID;
      sale.SaleID = newSaleId;
      sale.isProvisional = false;
      sale.payment_status = calculatePaymentStatus(sale.paidAmount || 0, sale.finalTotal);
      await db.persist('sales', [sale]);
      const entries = await db.getJournalEntries();
      entries.forEach(e => { if (e.sourceId === sale.originalProvisionalId) e.sourceId = newSaleId; });
      await db.persist('journalEntries', entries);
    }
  },

  process: async (customerId: string, items: any[], subtotal: number, isReturn: boolean, inv: string, curr: string, status: string, pid?: string, invoiceStatus: InvoiceStatus = 'DRAFT') => {
    const result = await db.processSale(customerId, items, subtotal, isReturn, inv, curr, status, pid, invoiceStatus);
    const sales = await db.getSales();
    const sale = sales.find(s => s.SaleID === result.sale_id);
    if (sale) {
      sale.payment_status = calculatePaymentStatus(sale.paidAmount || 0, sale.finalTotal);
      await db.persist('sales', [sale]);
    }
    return result;
  }
};
