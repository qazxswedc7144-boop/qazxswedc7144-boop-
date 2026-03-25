
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { Purchase } from '../types';
import { transactionOrchestrator } from './transactionOrchestrator';

export const purchasesService = {
  // Fix: Returns Promise<Purchase[]>
  getPurchases: async (): Promise<Purchase[]> => {
    return await PurchaseRepository.getAll();
  },

  // Fix: Returns Promise<string>
  getNextAutoNumber: async (): Promise<string> => {
    return await PurchaseRepository.getNextInvoiceNumber();
  },

  processNewPurchase: async (supplierId: string, items: any[], total: number, invoiceId?: string, isCash: boolean = false, isReturn: boolean = false) => {
    return transactionOrchestrator.processInvoiceTransaction({
      type: 'PURCHASE',
      payload: { supplierId, items, total, invoiceId },
      options: { isCash, isReturn } as any
    });
  }
};
