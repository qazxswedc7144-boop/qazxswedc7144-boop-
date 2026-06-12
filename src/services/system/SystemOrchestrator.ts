
import { db } from '@/core/db';
import { ValidationService as validationService } from '@/services/integrity/ValidationService';
import { TransactionService } from '@/services/transactions/TransactionService';
import { FaultService } from '@/services/integrity/FaultService';
import { FIFOEngine as fifoEngine } from '@/modules/inventory/services/fifoEngine';
import { StockMovementEngine as stockEngine } from '@/modules/inventory/services/stockMovementEngine';
import { AccountingEngine as accountingEngine } from '@/modules/accounting/services/AccountingEngine';
import { ReportEngine as reportEngine } from '@/services/reports/reportEngine';
import { InvoiceItem, InvoiceStatus } from '@/types';
import { InvoiceRepository } from '@/database/repositories/invoice.repository';
import { AccountingRepository } from '@/database/repositories/AccountingRepository';
import { authService } from '@/modules/auth/services/authService';
import { GlobalGuard } from '@/services/security/GlobalGuard';
import { BackupService } from '@/services/backupService';
import { FinancialTransactionRepository } from '@/database/repositories/FinancialTransactionRepository';
import { SupplierRepository } from '@/database/repositories/SupplierRepository';
import { useAppStore } from '@/hooks/useAppStore';
import { SubscriptionService } from '@/services/saas/subscriptionService';
import { generateTransactionUuid } from '@/utils/uuid';
import { AuditService } from '@/services/system/AuditService';
import { ErrorTrackingService } from '@/services/system/ErrorTrackingService';

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

    // Generate Global Transaction UUID if not already present
    const transactionUuid = (payload as any).transactionUuid || generateTransactionUuid(type);
    (payload as any).transactionUuid = transactionUuid;

    // 0. Enforce Idempotency before entering locks
    await TransactionService.ensureIdempotency(transactionUuid);

    // Trial limit check
    const plan = localStorage.getItem('saas_active_plan') || 'TRIAL';
    if (plan === 'TRIAL') {
      const usage = await SubscriptionService.getLocalUsageCount();
      if (usage >= 200 && !isEdit) {
        useAppStore.getState().setTrialBlockedModalOpen(true);
        throw new Error("تم الوصول للحد التجريبي 200 عملية. يرجى الاشتراك للمتابعة.");
      }
    }

    const finalStatus: InvoiceStatus = options?.invoiceStatus || 'POSTED';
    const isPosting = finalStatus === 'POSTED' || finalStatus === 'LOCKED';
    
    // Ensure payload.date is populated only if required for GlobalGuard
    const effectiveDate = payload.date || options?.date || new Date().toISOString();
    const resourceId = payload.id || `NEW_${type}_${Date.now()}`;

    // 1. Global Guard & Lock
    await GlobalGuard.checkSystemState(isEdit ? 'تعديل فاتورة' : 'إنشاء فاتورة', effectiveDate);

    // Get snapshot of state before (for audit edit tracking)
    let beforeState: any = null;
    if (isEdit) {
      beforeState = type === 'SALE' 
        ? await InvoiceRepository.getSaleById(resourceId) 
        : await InvoiceRepository.getPurchaseById(resourceId);
    }

    return await TransactionService.runSafe(resourceId, async () => {
      try {
        // 0. Detect and handle unpost-before-edit if already posted
        if (isEdit && beforeState) {
          if (beforeState.InvoiceStatus === 'POSTED' || beforeState.invoiceStatus === 'POSTED') {
            await this.unpostInvoice(resourceId, type);
          }
        }

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
            payload.date,
            transactionUuid // Parameter 15: transactionUuid
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
            payload.date,
            transactionUuid // Parameter 14: transactionUuid
          );
        }

        const refId = result.id;

        //--------------------------------
        // 4. ACCOUNTING ENTRIES
        //--------------------------------
        if (isPosting) {
          await accountingEngine.postInvoice({ ...payload, type, id: refId, transactionUuid }, costResult);
        }

        //--------------------------------
        // 5. REPORT UPDATE
        //--------------------------------
        if (reportEngine && typeof (reportEngine as any).refresh === "function") {
          try {
            await (reportEngine as any).refresh();
          } catch (refreshError) {
            console.error("[SYNC_REFRESH_FAILURE]", refreshError);
          }
        } else {
          console.warn("[SYNC_REFRESH_WARNING] reportEngine or reportEngine.refresh is not defined");
        }
        
        // 9. Centralized Audit Log 2.0
        await AuditService.log({
          action: isEdit ? 'EDIT' : 'CREATE',
          module: type,
          transactionUuid: transactionUuid,
          before: beforeState,
          after: result,
          recordId: refId
        });

        // Register completed UUID as successfully processed in-memory
        TransactionService.registerCompletedUuid(transactionUuid);

        console.log('Invoice processed successfully');
        return { success: true, refId };
      } catch (error: any) {
        console.error('PROCESS FAILED:', error);
        
        // Log in centralized system_errors table
        await ErrorTrackingService.log({
          moduleName: type,
          screenName: type === 'SALE' ? 'كاشير المبيعات' : 'توريد مشتريات',
          errorMessage: error.message || String(error),
          stackTrace: error.stack,
          severity: 'ERROR'
        });

        FaultService.log({
          type: 'ORCHESTRATOR_FATAL',
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
        await AccountingRepository.deleteEntriesBySource(invoiceId);

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
        if (reportEngine && typeof (reportEngine as any).refresh === "function") {
          try {
            await (reportEngine as any).refresh();
          } catch (refreshError) {
            console.error("[SYNC_REFRESH_FAILURE]", refreshError);
          }
        } else {
          console.warn("[SYNC_REFRESH_WARNING] reportEngine or reportEngine.refresh is not defined");
        }

        return { success: true };
      } catch (error: any) {
        FaultService.log({
          type: 'UNPOST_FATAL',
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
        if (reportEngine && typeof (reportEngine as any).refresh === "function") {
          try {
            await (reportEngine as any).refresh();
          } catch (refreshError) {
            console.error("[SYNC_REFRESH_FAILURE]", refreshError);
          }
        } else {
          console.warn("[SYNC_REFRESH_WARNING] reportEngine or reportEngine.refresh is not defined");
        }

        return { success: true };
      } catch (error: any) {
        FaultService.log({
          type: 'DELETE_FATAL',
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
