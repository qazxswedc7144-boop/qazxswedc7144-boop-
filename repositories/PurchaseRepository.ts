
import { db } from '../services/database';
import { Purchase, PaymentStatus } from '../types';
import { InvoiceCounterRepository } from './InvoiceCounterRepository';
import { priceIntelligenceService } from '../services/priceIntelligence.service';
import { InvoiceWorkflowEngine } from '../services/logic/InvoiceWorkflowEngine';

const calculatePaymentStatus = (paid: number, total: number): PaymentStatus => {
  const p = parseFloat(paid.toFixed(2));
  const t = parseFloat(total.toFixed(2));
  if (p === 0) return 'Unpaid';
  if (p < t) return 'Partially Paid';
  return 'Paid';
};

export const PurchaseRepository = {
  getAll: async (): Promise<Purchase[]> => {
    const data = await db.getPurchases();
    return Array.isArray(data) ? data : [];
  },

  getUnpaidBySupplier: async (supplierId: string): Promise<Purchase[]> => {
    const all = await PurchaseRepository.getAll();
    return all.filter(p => 
      (p.partnerId === supplierId || p.partnerName === supplierId) && 
      (p.payment_status !== 'Paid') && 
      p.invoiceStatus !== 'DRAFT' &&
      p.invoiceStatus !== 'CANCELLED'
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  updatePaidAmount: async (id: string, amountToAdd: number): Promise<void> => {
    const purchases = await db.getPurchases();
    const idx = purchases.findIndex(p => p.id === id || p.purchase_id === id);
    if (idx > -1) {
      const p = purchases[idx];
      const currentPaid = p.paidAmount || 0;
      const total = p.totalAmount || 0;
      const remainingToPay = total - currentPaid;
      
      if (amountToAdd > parseFloat(remainingToPay.toFixed(2)) + 0.01) {
        throw new Error(`المبلغ المسدد يتجاوز المتبقي`);
      }

      const newPaid = parseFloat((currentPaid + amountToAdd).toFixed(2));
      p.paidAmount = newPaid;
      p.payment_status = calculatePaymentStatus(newPaid, total);
      p.status = p.payment_status === 'Paid' ? 'PAID' : 'UNPAID';

      // تحديث حالة الفاتورة بناءً على سير العمل (Workflow Update)
      const nextStatus = InvoiceWorkflowEngine.determineNextStatus(total, newPaid, p.invoiceStatus || 'PENDING');
      p.invoiceStatus = nextStatus;

      await db.persist('purchases', purchases);
    }
  },

  settleSupplierFIFO: async (supplierId: string, totalAmount: number): Promise<void> => {
    const unpaidInvoices = await PurchaseRepository.getUnpaidBySupplier(supplierId);
    let remaining = totalAmount;
    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const unpaidBalance = inv.totalAmount - (inv.paidAmount || 0);
      const toPay = Math.min(remaining, unpaidBalance);
      if (toPay > 0) {
        await PurchaseRepository.updatePaidAmount(inv.id, toPay);
        remaining -= toPay;
      }
    }
  },

  /**
   * جلب سعر الشراء المقترح (Phase 13)
   */
  getLastPurchasePriceForItem: async (productId: string, supplierId?: string): Promise<number> => {
    if (!productId) return 0;

    const suggestion = await priceIntelligenceService.getSuggestedPrice(productId, 'PURCHASE', supplierId);
    if (suggestion.suggestedPrice !== null) {
      return suggestion.suggestedPrice;
    }

    const products = await db.getProducts();
    const product = products.find(p => p.id === productId);
    if (product && typeof product.LastPurchasePrice === 'number' && product.LastPurchasePrice > 0) {
      return product.LastPurchasePrice;
    }

    const allPurchases = await db.getPurchases() || [];
    const itemHistory = allPurchases.filter(p => (p.invoiceStatus !== 'DRAFT' && p.invoiceStatus !== 'CANCELLED') && Array.isArray(p.items) && p.items.some(it => it && it.product_id === productId)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (itemHistory.length === 0) return 0;
    const detailRow = itemHistory[0].items.find(it => it.product_id === productId);
    return detailRow ? (detailRow.price || 0) : 0;
  },

  getNextInvoiceNumber: async (): Promise<string> => {
    const nextSeq = await InvoiceCounterRepository.getNextNumber('Purchase', 5000);
    return nextSeq.toString();
  },

  isInvoiceNumberDuplicate: async (invNum: string, excludeId?: string | null): Promise<boolean> => {
    if (!invNum) return false;
    const purchases = await db.getPurchases() || [];
    const normalizedNum = invNum.trim().toLowerCase();
    return purchases.some(p => p.invoiceId?.trim().toLowerCase() === normalizedNum && p.id !== excludeId && p.purchase_id !== excludeId && p.isDeleted !== true);
  },

  isDuplicate: async (invNum: string, supplierId: string, excludeId?: string | null): Promise<boolean> => {
    if (!invNum || !supplierId) return false;
    const purchases = await db.getPurchases() || [];
    const normalizedNum = invNum.trim().toLowerCase();
    const normalizedSupplier = supplierId.trim().toLowerCase();
    return purchases.some(p => p.invoiceId?.trim().toLowerCase() === normalizedNum && (p.partnerId?.trim().toLowerCase() === normalizedSupplier || p.partnerName?.trim().toLowerCase() === normalizedSupplier) && p.id !== excludeId && p.purchase_id !== excludeId && p.isDeleted !== true);
  },

  getItemPurchaseHistory: async (productId: string, limit: number = 5): Promise<Purchase[]> => {
    const all = await PurchaseRepository.getAll();
    return all
      .filter(p => 
        p.invoiceStatus !== 'CANCELLED' && 
        Array.isArray(p.items) && 
        p.items.some(it => it.product_id === productId)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }
};
