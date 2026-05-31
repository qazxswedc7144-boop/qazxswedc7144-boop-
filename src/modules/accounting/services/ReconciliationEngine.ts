
import { db } from '@/core/db';
import { AccountStatementRepository } from '@/database/repositories/AccountStatementRepository';
import { SupplierRepository } from '@/database/repositories/SupplierRepository';
import { ProductRepository } from '@/modules/inventory/services/ProductRepository';
import { VoucherInvoiceLinkRepository } from '@/database/repositories/VoucherInvoiceLinkRepository';
import { InvoiceRepository } from '@/database/repositories/invoice.repository';
import { InvoiceWorkflowEngine } from '@/modules/sales/services/InvoiceWorkflowEngine';
import { logger } from '@/services/loggerService';

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
    const partner = await SupplierRepository.getById(partnerId, type);
    if (!partner) return 0;

    const statement = await AccountStatementRepository.getStatement(
      partner.Supplier_Name, 
      type === 'S' ? 'Supplier' : 'Customer'
    );
    
    const actualBalance = statement.length > 0 
      ? statement[statement.length - 1].runningBalance 
      : (partner.openingBalance || 0);

    if (Math.abs(partner.balance - actualBalance) > 0.001) {
      logger.warn("Reconciliation", "Partner", `تم اكتشاف انحراف في رصيد [${partner.Supplier_Name}]. القديم: ${partner.balance}، الفعلي: ${actualBalance}. جاري التصحيح...`);
      partner.balance = actualBalance;
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

      unified.paidAmount = finalPaid;
      unified.documentStatus = nextStatus;
      unified.financialStatus = finalPaid >= unified.finalTotal ? 'Paid' : 'Unpaid';
      
      await db.invoices.put(unified);
    }
  },

  /**
   * 3. مطابقة أرصدة المخزون
   */
  async reconcileProductStock(productId: string): Promise<number> {
    const product = await ProductRepository.getById(productId);
    if (!product) return 0;

    const actualStock = await ProductRepository.calculateCurrentBalance(productId);

    if (Math.abs((product.StockQuantity ?? 0) - actualStock) > 0.001) {
      logger.warn("Reconciliation", "Inventory", `تصحيح رصيد الصنف [${product.Name}]. دفتري: ${product.StockQuantity}، جرد سجلات: ${actualStock}`);
      product.StockQuantity = actualStock;
      await ProductRepository.save(product);
    }

    return actualStock;
  },

  /**
   * 4. مطابقة شاملة لمستند (تجمع كافة الوظائف أعلاه)
   */
  async reconcileDocument(invoiceId: string, partnerId?: string, productIds?: string[]): Promise<void> {
    await this.reconcileInvoicePayments(invoiceId);
    if (partnerId) await this.reconcilePartnerBalance(partnerId);
    if (productIds) {
      for (const id of productIds) {
        await this.reconcileProductStock(id);
      }
    }
  }
};
