
import { SalesRepository } from './repositories/SalesRepository';
import { Sale } from '../types';
import { transactionOrchestrator } from './transactionOrchestrator';

/**
 * Sales Service - واجهة إدارة المبيعات
 */
export const salesService = {
  // Fix: Returns Promise<Sale[]> instead of Sale[]
  getSales: async (): Promise<Sale[]> => {
    return await SalesRepository.getAll();
  },

  /**
   * معالجة مبيعة جديدة: التوجيه الإلزامي للمنسق الذري
   */
  processNewSale: async (customerId: string, cart: any[], total: number, options: any) => {
    return transactionOrchestrator.processInvoiceTransaction({
      type: 'SALE',
      payload: { customerId, items: cart, total },
      options
    });
  }
};
