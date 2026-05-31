
import { db } from '@/core/db';
import { Purchase } from '@/types';

export const PurchaseRepository = {
  getAll: async (): Promise<Purchase[]> => {
    return await db.invoices.where('type').equals('PURCHASE').toArray() as unknown as Purchase[];
  },

  getById: async (id: string): Promise<Purchase | undefined> => {
    return await db.invoices.get(id) as unknown as Purchase;
  },

  save: async (purchase: Purchase): Promise<string> => {
    const key = await db.invoices.put({
      ...purchase,
      type: 'PURCHASE',
      updatedAt: new Date().toISOString()
    } as any);
    return String(key);
  },

  delete: async (id: string): Promise<void> => {
    await db.invoices.delete(id);
  },

  getLastPurchasePriceForItem: async (productId: string): Promise<number> => {
    const all = await PurchaseRepository.getAll();
    const prices = all
      .flatMap(p => p.items)
      .filter(i => i.product_id === productId)
      .map(i => i.price);
    return prices.length > 0 ? (prices[prices.length - 1] ?? 0) : 0;
  },

  isInvoiceNumberDuplicate: async (invoiceNumber: string, excludeId?: string): Promise<boolean> => {
    const found = await db.invoices
      .where('invoice_number').equals(invoiceNumber)
      .and(i => i.type === 'PURCHASE' && i.id !== excludeId)
      .first();
    return !!found;
  },

  getNextInvoiceNumber: async (): Promise<string> => {
    const count = await db.invoices.where('type').equals('PURCHASE').count();
    return `PUR-${String(count + 1).padStart(5, '0')}`;
  },

  getItemPurchaseHistory: async (productId: string, limit: number = 5): Promise<Purchase[]> => {
    const all = await PurchaseRepository.getAll();
    return all
      .filter(p => p.items.some(i => i.product_id === productId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  },

  getUnpaidBySupplier: async (supplierId: string): Promise<Purchase[]> => {
    const all = await db.invoices
      .where('partner_id').equals(supplierId)
      .and(i => i.type === 'PURCHASE')
      .toArray();
    return all.filter(p => (p.paidAmount || 0) < p.finalTotal) as unknown as Purchase[];
  },

  updatePaidAmount: async (id: string, amount: number): Promise<void> => {
    await db.safeTransaction('rw', ['invoices'], async () => {
      const purchase = await db.invoices.get(id);
      if (!purchase) return;
      await db.invoices.update(id, {
        paidAmount: (purchase.paidAmount || 0) + amount,
        updatedAt: new Date().toISOString()
      });
    });
  },

  settleSupplierFIFO: async (supplierId: string, amount: number): Promise<void> => {
    const unpaid = await PurchaseRepository.getUnpaidBySupplier(supplierId);
    let remaining = amount;
    for (const p of unpaid) {
      if (remaining <= 0) break;
      const owed = (p.totalAmount || 0) - (p.paidAmount || 0);
      const toPay = Math.min(remaining, owed);
      await PurchaseRepository.updatePaidAmount(p.id, toPay);
      remaining -= toPay;
    }
  }
};
