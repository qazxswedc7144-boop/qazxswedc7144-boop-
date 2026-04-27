
import { db } from '../lib/database';
import { ValidationService as validationService } from './ValidationService';
import { TransactionService } from './TransactionService';
import { ErrorService } from './ErrorService';
import { FIFOEngine as fifoEngine } from '@/core/engines/fifoEngine';
import { StockMovementEngine as stockEngine } from '@/core/engines/stockMovementEngine';
import { AccountingEngine as accountingEngine } from '@/core/engines/accountingEngine';
import { ReportEngine as reportEngine } from '@/core/engines/reportEngine';
import { InvoiceItem, InvoiceStatus, Sale, Purchase } from '../types';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { AccountRepository } from '../repositories/account.repository';
import { authService } from './auth.service';
import { GlobalGuard } from './GlobalGuard';
import { SharedAutomationActions } from './SharedAutomationActions';
import { BackupService } from './backupService';
import { LockService } from './LockService';
import { PeriodLockEngine } from './PeriodLockEngine';
import { FinancialTransactionRepository } from '../repositories/FinancialTransactionRepository';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { ProductRepository } from '@/core/engines/ProductRepository';

export interface InvoiceProcessingRequest {
  type: 'SALE' | 'PURCHASE';
  payload: {
    customerId?: string;
    supplierId?: string;
    items: InvoiceItem[];
    total: number;
    id?: string;
    date?: string;
    notes?: string;
    attachment?: string;
  };
  options?: {
    isCash?: boolean;
    isReturn?: boolean;
    invoiceStatus?: InvoiceStatus;
    warehouseId?: string;
    currency?: string;
    paymentStatus?: 'Cash' | 'Credit';
    date?: string;
  };
}

export class SystemOrchestrator {
  /**
   * Processes an invoice through the system.
   */
  static async processInvoice(request: InvoiceProcessingRequest): Promise<{ success: boolean; refId: string }> {
    const { type, payload, options } = request;
    const isEdit = !!payload.id;
    const finalStatus: InvoiceStatus = options?.invoiceStatus || 'POSTED';
    const isPosting = finalStatus === 'POSTED' || finalStatus === 'LOCKED';
    
    // Ensure payload.date is populated only if required for GlobalGuard
    const effectiveDate = payload.date || options?.date || new Date().toISOString();
    const resourceId = payload.id || `NEW_${type}_${Date.now()}`;

    // 1. Global Guard & Lock
    await GlobalGuard.checkSystemState(isEdit ? 'تعديل فاتورة' : 'إنشاء فاتورة', effectiveDate);

    return await TransactionService.runSafe(resourceId, async () => {
      try {
        //--------------------------------
        // 1. VALIDATION
        //--------------------------------
        await validationService.validateInvoice(payload, type);
        
        if (!isEdit && payload.id) {
          const table = type === 'SALE' ? 'sales' : 'purchases';
          await validationService.validateInvoiceIdUniqueness(payload.id, table, db.db);
        }

        //--------------------------------
        // 2. FIFO COSTING
        //--------------------------------
        let costResult = { totalCost: 0, itemCosts: {} };
        if (isPosting) {
          costResult = await fifoEngine.apply({ ...payload, type });
        }

        //--------------------------------
        // 3. STOCK MOVEMENT
        //--------------------------------
        if (isPosting) {
          await stockEngine.apply({ ...payload, type });
        }

        // 6. Save Document (Repository Layer) - Needed before accounting
        let result;
        if (type === 'SALE') {
          result = await InvoiceRepository.saveSale(
            payload.customerId!,
            payload.items,
            payload.total,
            !!options?.isReturn,
            payload.id || '',
            options?.currency || 'USD',
            options?.paymentStatus || 'Cash',
            finalStatus,
            0,
            'LOW',
            costResult.totalCost,
            payload.id,
            payload.attachment,
            payload.date
          );
        } else {
          result = await InvoiceRepository.savePurchase(
            payload.supplierId!,
            payload.items,
            payload.total,
            payload.id || '',
            options?.isCash || false,
            options?.currency || 'USD',
            finalStatus,
            0,
            'LOW',
            payload.id,
            payload.attachment,
            !!options?.isReturn,
            payload.date
          );
        }

        const refId = result.id;

        //--------------------------------
        // 4. ACCOUNTING ENTRIES
        //--------------------------------
        if (isPosting) {
          await accountingEngine.postInvoice({ ...payload, type, id: refId }, costResult);
        }

        //--------------------------------
        // 5. REPORT UPDATE
        //--------------------------------
        await reportEngine.refresh();
        
        // 9. Audit Log
        await db.addAuditLog(isEdit ? 'UPDATE' : 'CREATE', type, refId, 
          `SystemOrchestrator: Invoice ${refId} processed as ${finalStatus} by ${authService.getCurrentUser().User_Email}`);

        console.log('Invoice processed successfully');
        return { success: true, refId };
      } catch (error: any) {
        console.error('PROCESS FAILED:', error);
        await ErrorService.log({
          type: 'ORCHESTRATOR_ERROR',
          module: 'SYSTEM_ORCHESTRATOR',
          message: `Failed to process ${type} invoice: ${error.message || String(error)}`,
          payload: { request, resourceId },
          stack: error.stack
        });
        throw error;
      }
    });
  }

  /**
   * Unposts an invoice.
   */
  static async unpostInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    const table = type === 'SALE' ? 'sales' : 'purchases';
    const user = authService.getCurrentUser();
    if (user?.Role !== 'Admin') {
      throw new Error("Only administrators can unpost invoices.");
    }

    return await TransactionService.runSafe(invoiceId, async () => {
      try {
        await GlobalGuard.checkSystemState('إلغاء ترحيل');
        
        const invoice = type === 'SALE' 
          ? await InvoiceRepository.getSaleById(invoiceId)
          : await InvoiceRepository.getPurchaseById(invoiceId);
        
        if (!invoice) throw new Error("Invoice not found.");
        
        const status = (invoice as any).InvoiceStatus || (invoice as any).invoiceStatus;
        if (status !== 'POSTED') {
          throw new Error("Only POSTED invoices can be unposted.");
        }

        // 1. Backup Before Critical Actions
        await BackupService.createBackup(`Auto Backup before Unpost #${invoiceId}`, 'PRE_UNPOST', true);

        // 2. Reverse Journal Entries
        await AccountRepository.deleteEntriesBySource(invoiceId);

        // 3. Reverse Stock Movements & FIFO
        await stockEngine.reverseMovements(invoiceId);
        await fifoEngine.reverseFIFO(invoiceId);

        // 4. Reverse Financial Impact
        const total = (invoice as any).finalTotal || (invoice as any).totalAmount;
        const partnerId = type === 'SALE' ? (invoice as any).customerId : (invoice as any).partnerId;
        
        const ftId = db.generateId('FT');
        await FinancialTransactionRepository.record({
          id: ftId,
          Transaction_Type: 'Refund',
          Reference_ID: invoiceId,
          Reference_Table: type === 'SALE' ? 'Sales_Invoices' : 'Purchase_Invoices',
          Entity_Name: partnerId || 'عميل نقدي',
          Amount: total,
          Direction: type === 'SALE' ? 'Debit' : 'Credit',
          Transaction_Date: new Date().toISOString(),
          Notes: `[UNPOST REVERSAL] Invoice #${invoiceId}`
        });

        if (partnerId && partnerId !== 'عميل نقدي') {
          await SupplierRepository.postToLedger({
            id: db.generateId('PL'),
            partnerId,
            date: new Date().toISOString(),
            description: `عكس قيد فاتورة #${invoiceId}`,
            debit: type === 'SALE' ? 0 : total,
            credit: type === 'SALE' ? total : 0,
            referenceId: invoiceId
          });
        }

        // 5. Update Document Status
        if (type === 'SALE') {
          await db.db.sales.update(invoiceId, { InvoiceStatus: 'DRAFT_EDIT', lastModified: new Date().toISOString() });
        } else {
          await db.db.purchases.update(invoiceId, { invoiceStatus: 'DRAFT_EDIT', lastModified: new Date().toISOString() });
        }

        await db.addAuditLog('SYSTEM', type, invoiceId, `UNPOST: Status changed from POSTED to DRAFT_EDIT by ${user?.User_Email}`);
        await reportEngine.refresh();

        return { success: true };
      } catch (error: any) {
        await ErrorService.log({
          type: 'UNPOST_ERROR',
          module: 'SYSTEM_ORCHESTRATOR',
          message: `Failed to unpost invoice ${invoiceId}: ${error.message || String(error)}`,
          payload: { invoiceId, type },
          stack: error.stack
        });
        throw error;
      }
    });
  }

  /**
   * Deletes an invoice (Soft Delete).
   */
  static async deleteInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    return await TransactionService.runSafe(invoiceId, async () => {
      try {
        const invoice = type === 'SALE' 
          ? await InvoiceRepository.getSaleById(invoiceId)
          : await InvoiceRepository.getPurchaseById(invoiceId);
        
        if (!invoice) throw new Error("Invoice not found.");

        const invoiceDate = (invoice as any).date || new Date().toISOString();
        await GlobalGuard.checkSystemState('حذف فاتورة', invoiceDate);

        // 1. Check dependencies
        const hasDeps = await InvoiceRepository.checkHasDependencies(invoiceId, type);
        if (hasDeps) {
          throw new Error("لا يمكن حذف الفاتورة لوجود مستندات مرتبطة بها (سندات قبض/صرف). يرجى حذف الارتباطات أولاً.");
        }

        // 2. Backup Before Critical Actions
        await BackupService.createBackup(`Auto Backup before Delete #${invoiceId}`, 'PRE_DELETE', true);

        const status = (invoice as any).InvoiceStatus || (invoice as any).invoiceStatus;
        
        // 3. Unpost if needed
        if (status === 'POSTED') {
          await this.unpostInvoice(invoiceId, type);
        }

        // 4. Soft Delete
        if (type === 'SALE') {
          await db.db.sales.update(invoiceId, { InvoiceStatus: 'VOID', isDeleted: true, lastModified: new Date().toISOString() });
        } else {
          await db.db.purchases.update(invoiceId, { invoiceStatus: 'VOID', isDeleted: true, lastModified: new Date().toISOString() });
        }
        
        await db.addAuditLog('DELETE', type, invoiceId, `Invoice marked as VOID (Soft Delete) by ${authService.getCurrentUser().User_Email}`);
        await reportEngine.refresh();

        return { success: true };
      } catch (error: any) {
        await ErrorService.log({
          type: 'DELETE_ERROR',
          module: 'SYSTEM_ORCHESTRATOR',
          message: `Failed to delete invoice ${invoiceId}: ${error.message || String(error)}`,
          payload: { invoiceId, type },
          stack: error.stack
        });
        throw error;
      }
    });
  }
}
