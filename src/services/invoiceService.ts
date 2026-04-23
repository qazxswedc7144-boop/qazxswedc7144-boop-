import { db } from '../lib/database';

/**
 * Invoice Service
 * Offline mode: Uses IndexedDB
 */
export const invoiceService = {
  
  async getInvoices() {
    return await db.invoices.toArray();
  },

  async createInvoice(invoiceData: any, profile: any) {
    const payload = {
      ...invoiceData,
    };
    
    await db.invoices.put(payload);
    return payload;
  }
};
