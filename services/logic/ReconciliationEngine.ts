
import { db } from '../database';
import { AccountStatementRepository } from '../../repositories/AccountStatementRepository';
import { SupplierRepository } from '../../repositories/SupplierRepository';
import { ProductRepository } from '../../repositories/ProductRepository';
import { VoucherInvoiceLinkRepository } from '../../repositories/VoucherInvoiceLinkRepository';
import { InvoiceRepository } from '../../repositories/invoice.repository';
import { InvoiceWorkflowEngine } from './InvoiceWorkflowEngine';
import { logger } from '../logger.service';

/**
 * Balance Reconciliation Engine - المحرك السيادي لمطابقة الأرصدة
 * يقوم بتصحيح أي انحراف بين الأرصدة التجميعية والحركات التفصيلية
 */
export const ReconciliationEngine = {

  /**
   * 1. مطابقة رصيد الشريك (عميل أو مورد)
   */
  async reconcilePartnerBalance(partnerId: string): Promise<number> {
    if (!partnerId) return 0;
    const type = partnerId.startsWith('S') ? 'S' : 'C';
    const partner = SupplierRepository.getById(partnerId, type);
    if (!partner) return 0;

    const statement = await AccountStatementRepository.getStatement(
      partner.Supplier_Name, 
      type === 'S' ? 'Supplier' : 'Customer'
    );
    
    const actualBalance = statement.length > 0 
      ? statement[statement.length - 1].runningBalance 
      : (partner.openingBalance || 0);

    if (Math.abs(partner.Balance - actualBalance) > 0.001) {
      logger.warn("Reconciliation", "Partner", `تم اكتشاف انحراف في رصيد [${partner.Supplier_Name}]. القديم: ${partner.Balance}، الفعلي: ${actualBalance}. جاري التصحيح...`);
      partner.Balance = actualBalance;
      await SupplierRepository.save(partner, type);
    }

    return actualBalance;
  },

  /**
   * 2. مطابقة مدفوعات فاتورة محددة
   */
  async reconcileInvoicePayments(invoiceId: string): Promise<void> {
    const unified = await InvoiceRepository.getUnifiedInvoice(invoiceId);
    if (!unified) return;

    // جلب المبالغ المسددة من سجل الروابط (Source of Truth for Payments)
    const actualPaid = await VoucherInvoiceLinkRepository.getTotalPaidForInvoice(invoiceId);
    
    // الفحص الإضافي للفواتير النقدية (التي لا تمر عبر السندات أحياناً)
    const finalPaid = unified.paymentStatus === 'Cash' ? Math.max(actualPaid, unified.finalTotal) : actualPaid;

    if (Math.abs(unified.paidAmount - finalPaid) > 0.001) {
      logger.info("Reconciliation", "Invoice", `تحديث مبالغ السداد للفاتورة #${invoiceId}. القيمة الجديدة: ${finalPaid}`);
      
      const nextStatus = InvoiceWorkflowEngine.determineNextStatus(unified.finalTotal, finalPaid, unified.documentStatus);

      if (unified.type === 'SALE') {
        const sales = await db.getSales();
        const sale = sales.find(s => s.SaleID === invoiceId || s.id === invoiceId);
        if (sale) {
          sale.paidAmount = finalPaid;
          sale.InvoiceStatus = nextStatus;
          await db.persist('sales', [sale]);
        }
      } else {
        const purchases = await db.getPurchases();
        const purchase = purchases.find(p => p.invoiceId === invoiceId || p.purchase_id === invoiceId || p.id === invoiceId);
        if (purchase) {
          purchase.paidAmount = finalPaid;
          purchase.invoiceStatus = nextStatus;
          purchase.status = finalPaid >= purchase.totalAmount ? 'PAID' : 'UNPAID';
          await db.persist('purchases', [purchase]);
        }
      }
    }
  },

  /**
   * 3. مطابقة أرصدة المخزون
   */
  async reconcileProductStock(productId: string): Promise<number> {
    const product = await ProductRepository.getById(productId);
    if (!product) return 0;

    const actualStock = await ProductRepository.calculateCurrentBalance(productId);

    if (Math.abs(product.StockQuantity - actualStock) > 0.001) {
      logger.warn("Reconciliation", "Inventory", `تصحيح رصيد الصنف [${product.Name}]. دفتري: ${product.StockQuantity}، جرد سجلات: ${actualStock}`);
      product.StockQuantity = actualStock;
      await ProductRepository.save(product);
    }

    return actualStock;
  },

  /**
   * 4. مطابقة شاملة لمستند (تجمع كافة الوظائف أعلاه)
   */
  async reconcileDocument(invoiceId: string, partnerId?: string, itemIds?: string[]): Promise<void> {
    await this.reconcileInvoicePayments(invoiceId);
    if (partnerId) await this.reconcilePartnerBalance(partnerId);
    if (itemIds) {
      for (const id of itemIds) {
        await this.reconcileProductStock(id);
      }
    }
  }
};
