
/* eslint-disable @typescript-eslint/no-unused-vars */
import { db } from '@/core/db';

export const InvoiceRepository = {
  getUnifiedInvoice: async (id: string): Promise<any> => {
    // Try to find in sales then purchases
    const sale = await db.db.sales.get(id);
    if (sale) return { ...sale, finalTotal: sale.finalTotal || 0, paidAmount: sale.paidAmount || 0 };
    
    const purchase = await db.db.purchases.get(id);
    if (purchase) return { ...purchase, finalTotal: purchase.totalAmount || 0, paidAmount: purchase.paidAmount || 0 };
    
    return null;
  },

  getSaleById: async (id: string): Promise<any> => {
    return await db.db.sales.get(id);
  },

  getPurchaseById: async (id: string): Promise<any> => {
    return await db.db.purchases.get(id);
  },

  saveSale: async (...args: any[]): Promise<any> => {
    const sale = await (db.db as any).processSale(...args);
    return sale;
  },

  savePurchase: async (...args: any[]): Promise<any> => {
    const purchase = await (db.db as any).processPurchase(...args);
    return purchase;
  },

  generateInvoiceNumber: async (type: 'SALE' | 'PURCHASE' = 'SALE'): Promise<string> => {
    const prefix = type === 'SALE' ? 'INV' : 'PUR';
    const last = await db.db[type === 'SALE' ? 'sales' : 'purchases']
      .orderBy('createdAt')
      .last();
    
    if (!last) return `${prefix}-1001`;
    
    const lastNumMatch = last.SaleID || last.invoiceId || last.invoice_number;
    const match = String(lastNumMatch).match(/\d+$/);
    const nextNum = match ? parseInt(match[0]) + 1 : 1001;
    return `${prefix}-${nextNum}`;
  },

  isNumberDuplicate: async (num: string, type: 'SALE' | 'PURCHASE', excludeId?: string | null): Promise<boolean> => {
    const table = type === 'SALE' ? db.db.sales : db.db.purchases;
    const field = type === 'SALE' ? 'SaleID' : 'invoiceId';
    
    const matches = await table.where(field).equals(num).toArray();
    if (excludeId) {
      return matches.some(m => m.id !== excludeId);
    }
    return matches.length > 0;
  },

  getArchiveSales: async (): Promise<any[]> => {
    return await db.db.sales.where('InvoiceStatus').equals('POSTED').toArray();
  },

  getArchivePurchases: async (): Promise<any[]> => {
    return await db.db.purchases.where('invoiceStatus').equals('POSTED').toArray();
  },

  getSavedInvoices: async (): Promise<any[]> => {
    return await db.db.sales.where('InvoiceStatus').equals('DRAFT').toArray();
  },

  getRecentInvoices: async (): Promise<any[]> => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const sales = await db.db.sales
      .where('Date')
      .above(ninetyDaysAgo.toISOString())
      .toArray();
      
    const purchases = await db.db.purchases
      .where('date')
      .above(ninetyDaysAgo.toISOString())
      .toArray();
      
    return [
      ...sales.map(s => ({ ...s, entityType: 'SALE' })),
      ...purchases.map(p => ({ ...p, entityType: 'PURCHASE' }))
    ].sort((a,b) => new Date(b.Date || b.date).getTime() - new Date(a.Date || a.date).getTime());
  },

  getInvoicesArchive: async (): Promise<any[]> => {
    const sales = await db.db.sales.toArray();
    const purchases = await db.db.purchases.toArray();
    return [
      ...sales.map(s => ({ ...s, entityType: 'SALE' })),
      ...purchases.map(p => ({ ...p, entityType: 'PURCHASE' }))
    ];
  },

  checkHasDependencies: async (_invoiceId: string, _type: 'SALE' | 'PURCHASE'): Promise<boolean> => {
    // Check if this invoice has linked vouchers or financial transactions
    // Simplified local implementation
    return false; 
  }
};
