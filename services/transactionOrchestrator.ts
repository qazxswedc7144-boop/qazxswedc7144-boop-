
import { db } from './database';
import { integrityVerifier } from './integrityVerifier';
import { InvoiceItem, SecurityError, InvoiceStatus, ValidationError, AccountingEntry, Sale, Purchase } from '../types';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { AccountRepository } from '../repositories/account.repository';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { FinancialTransactionRepository } from '../repositories/FinancialTransactionRepository';
import { authService } from './auth.service';
import { priceIntelligenceService } from './priceIntelligence.service';
import { dataValidator } from './validators/dataValidator';
import { SharedAutomationActions } from './logic/SharedAutomationActions';
import { FinancialIntegrityValidator } from './validators/FinancialIntegrityValidator';
import { ReconciliationEngine } from './logic/ReconciliationEngine';
import { BusinessRulesEngine } from './logic/BusinessRulesEngine';
import { BackupService } from './backupService';
import { LockService } from './LockService';
import { AIAuditEngine } from './AIAuditEngine';
import { InventoryService } from './InventoryService';
import { AccountingEngine } from './AccountingEngine';
import { PeriodLockEngine } from './PeriodLockEngine';
import { FIFOEngine } from './FIFOEngine';
import { AIInsightsEngine } from './AIInsightsEngine';

export interface SaleOptions {
  isCash: boolean;
  paymentStatus: 'Cash' | 'Credit';
  currency: string;
  isReturn?: boolean;
  invoiceStatus?: InvoiceStatus; 
  date?: string;
  originalInvoiceId?: string;
}

export interface InvoiceRequest {
  type: 'SALE' | 'PURCHASE';
  payload: {
    customerId?: string;
    supplierId?: string;
    items: InvoiceItem[];
    total: number;
    invoiceId?: string; 
    id?: string; 
    date?: string;
    notes?: string;
  };
  options?: SaleOptions | { isCash: boolean; isReturn: boolean; invoiceStatus?: InvoiceStatus; date?: string; originalInvoiceId?: string };
}

export const transactionOrchestrator = {
  async processInvoiceTransaction(invoice: InvoiceRequest): Promise<{ success: boolean; refId?: string }> {
    // 1. Global Transaction Lock (Prevent parallel operations / double click)
    const lockAcquired = await LockService.acquireGlobalTransactionLock();
    if (!lockAcquired) {
      throw new ValidationError("العملية قيد المعالجة حالياً، يرجى الانتظار... ⏳");
    }

    try {
      let finalStatus: InvoiceStatus = invoice.options?.invoiceStatus || 'PENDING';
      const isEdit = !!(invoice.payload.invoiceId || invoice.payload.id);
      const invoiceDate = invoice.payload.date || (invoice.options as any)?.date || new Date().toISOString();
      const isReturn = !!invoice.options?.isReturn;
      const invoiceId = invoice.payload.invoiceId || invoice.payload.id;

      // 2. Data Validation Layer
      if (!invoice.payload.items || invoice.payload.items.length === 0) {
        throw new ValidationError("يجب إضافة صنف واحد على الأقل للفاتورة.");
      }
      for (const item of invoice.payload.items) {
        if (item.qty <= 0) throw new ValidationError(`الكمية للصنف [${item.name}] يجب أن تكون أكبر من صفر.`);
        if (item.price < 0) throw new ValidationError(`السعر للصنف [${item.name}] لا يمكن أن يكون سالباً.`);
      }
      if (invoice.payload.total < 0) throw new ValidationError("إجمالي الفاتورة لا يمكن أن يكون سالباً.");

      // 3. Duplicate Prevention (Check invoice_id uniqueness for new invoices)
      if (!isEdit && invoiceId) {
        const table = invoice.type === 'SALE' ? 'sales' : 'purchases';
        const exists = await (db.db as any)[table].get(invoiceId);
        if (exists) {
          throw new ValidationError(`رقم الفاتورة [${invoiceId}] موجود مسبقاً في النظام.`);
        }
      }

      // 4. Accounting Period Lock Check
      await PeriodLockEngine.validateOperation(invoiceDate, isEdit ? 'تعديل' : 'إنشاء');

      // 5. Permissions Check
      authService.assertPermission(isEdit ? 'EDIT_INVOICE' : 'CREATE_INVOICE', isEdit ? 'تعديل مستند' : 'إنشاء مستند');

      // 6. Record Locking (For edits)
      if (isEdit) {
        const table = invoice.type === 'SALE' ? 'sales' : 'purchases';
        const id = invoiceId!;
        
        if (await LockService.isLockedByOther(table, id)) {
           throw new ValidationError("هذا السجل مقفل حالياً بواسطة مستخدم آخر 🔒");
        }
        
        const existing = invoice.type === 'SALE' 
           ? await InvoiceRepository.getSaleById(id)
           : await InvoiceRepository.getPurchaseById(id);
        
        // LOGIC: If invoice is linked to a financial voucher -> prevent total change
        const hasVoucher = await InvoiceRepository.checkHasDependencies(id, invoice.type);
        if (hasVoucher && existing) {
           const payloadTotal = invoice.payload.total;
           const existingTotal = (existing as any).finalTotal || (existing as any).totalAmount || 0;
           if (Math.abs(payloadTotal - existingTotal) > 0.01) {
              throw new ValidationError("لا يمكن تعديل إجمالي الفاتورة لأنها مرتبطة بسند مالي. يسمح فقط بتعديل الملاحظات. 🔗");
           }
        }

        const currentStatus = (existing as any)?.InvoiceStatus || (existing as any)?.invoiceStatus || 'DRAFT';
        if (!BusinessRulesEngine.workflow.canTransitionTo(currentStatus, finalStatus)) {
           throw new ValidationError(`BRE Constraint: لا يمكن الانتقال من [${currentStatus}] إلى [${finalStatus}] ⚠️`);
        }

        await LockService.acquireLock(table, id);
        
        // 7. Backup Before Critical Actions (Edit)
        await BackupService.createBackup(`Auto Backup before Edit #${id}`, 'PRE_EDIT', true);
      }

      // 8. Financial Integrity Math Check
      FinancialIntegrityValidator.validateInvoiceMath(invoice.payload.items, invoice.payload.total);

      const isPostingAction = finalStatus === 'POSTED' || finalStatus === 'LOCKED';

      if (isPostingAction) {
        const integrity = await integrityVerifier.verifyChain();
        if (!integrity.isValid) throw new SecurityError("Security Breach: تلاعب بالسجلات مكتشف.");
      }

      // PHASE: AI Audit
      const auditResult = await AIAuditEngine.auditInvoice(
        invoice.type, 
        invoice.payload as any, 
        invoice.payload.items, 
        authService.getCurrentUser().User_Email
      );
      
      if (auditResult.riskLevel === 'HIGH' && !(invoice.payload as any).isApproved && isPostingAction) {
        finalStatus = 'LOCKED';
        console.warn(`[AI_Audit] High Risk Invoice ${invoice.payload.id} Auto-Locked for Admin Approval.`);
      }

      // PHASE: Inventory Validation (Pre-Transaction)
      const warehouseId = (invoice.options as any)?.warehouseId || 'WH-MAIN';
      if (invoice.type === 'SALE' && isPostingAction) {
        for (const item of invoice.payload.items) {
          await InventoryService.validateStockAvailability(warehouseId, item.product_id, item.qty);
        }
      }

      // 9. ATOMIC TRANSACTION EXECUTION
      return await db.runTransaction(async () => {
        let result;
        const userId = authService.getCurrentUser().User_Email;

        if (invoice.type === 'SALE') {
          result = await this.executeSaleBot(
            invoice.payload.customerId!, 
            invoice.payload.items, 
            invoice.payload.total, 
            { ...(invoice.options as SaleOptions), invoiceStatus: finalStatus, date: invoiceDate }, 
            invoiceId,
            auditResult.auditScore,
            auditResult.riskLevel
          );
        } else {
          result = await this.executePurchaseBot(
            invoice.payload.supplierId!, 
            invoice.payload.items, 
            invoice.payload.total, 
            invoiceId, 
            (invoice.options as any)?.isCash || false, 
            finalStatus, 
            invoiceDate, 
            isReturn,
            auditResult.auditScore,
            auditResult.riskLevel
          );
        }

        const refId = invoiceId || (result as any)?.sale_id || (result as any)?.purchase_id;
        
        if (isPostingAction) {
          setTimeout(() => AIInsightsEngine.runAnalysis(), 1000);

          const partnerId = invoice.type === 'SALE' ? invoice.payload.customerId : invoice.payload.supplierId;
          await priceIntelligenceService.recordInvoiceUsage(
            invoice.payload.items, 
            invoice.type, 
            partnerId || 'عميل نقدي', 
            authService.getCurrentUser().User_Email
          );
        }

        if (isEdit) {
          const table = invoice.type === 'SALE' ? 'sales' : 'purchases';
          await LockService.releaseLock(table, invoiceId!);
        }

        await SharedAutomationActions.syncDocumentHistory(
          refId, 
          isPostingAction ? 'POSTED' : 'CREATED',
          `تمت معالجة ${isReturn ? 'مرتجع' : 'فاتورة'} ${invoice.type === 'SALE' ? 'مبيعات' : 'مشتريات'} بحالة [${finalStatus}]`
        );

        if (isPostingAction) {
          await this.applyFinancialImpact(invoice, refId, invoiceDate, isReturn);
          
          const sale = await InvoiceRepository.getSaleById(refId);
          if (sale) {
            const entry = isReturn 
              ? await AccountingEngine.generateReturnEntry(sale, sale.items)
              : await AccountingEngine.generateSalesEntry(sale, sale.items);
            await AccountRepository.addEntry(entry);
          }
        }

        const partnerId = invoice.type === 'SALE' ? invoice.payload.customerId : invoice.payload.supplierId;
        const itemIds = invoice.payload.items.map(it => it.product_id);
        await ReconciliationEngine.reconcileDocument(refId, partnerId, itemIds);

        // 10. Logging System
        await db.addAuditLog(isEdit ? 'UPDATE' : 'CREATE', invoice.type, refId, 
          `Invoice ${refId} ${isEdit ? 'updated' : 'created'} and ${isPostingAction ? 'posted' : 'saved as draft'} by ${userId}`);

        return { success: true, refId };
      });
    } catch (error: any) {
      console.error("Transaction Orchestrator Error:", error);
      // 11. Error Handling & Rollback (Rollback is automatic by db.runTransaction if error thrown inside)
      throw error; 
    } finally {
      // 12. Release Global Lock
      await LockService.releaseGlobalTransactionLock();
    }
  },

  async applyFinancialImpact(invoice: InvoiceRequest, refId: string, invoiceDate: string, isReturn: boolean) {
    const isCash = invoice.options?.isCash || false;
    const partnerId = invoice.type === 'SALE' ? invoice.payload.customerId : invoice.payload.supplierId;
    const direction = invoice.type === 'SALE' ? 'Credit' : 'Debit';
    
    await FinancialTransactionRepository.cancelTransaction(refId);
    await FinancialTransactionRepository.record({
      Transaction_Type: isReturn ? 'Refund' : 'Invoice',
      Reference_ID: refId,
      Reference_Table: invoice.type === 'SALE' ? 'Sales_Invoices' : 'Purchase_Invoices',
      Entity_Name: partnerId || 'عميل نقدي',
      Amount: invoice.payload.total,
      Direction: direction,
      Transaction_Date: invoiceDate,
      Notes: `[POSTED] ${isReturn ? 'مرتجع' : 'فاتورة'} #${refId}`
    });

    if (!isCash && partnerId && partnerId !== 'عميل نقدي') {
      const debitVal = invoice.type === 'SALE' ? (isReturn ? 0 : invoice.payload.total) : (isReturn ? invoice.payload.total : 0);
      const creditVal = invoice.type === 'SALE' ? (isReturn ? invoice.payload.total : 0) : (isReturn ? 0 : invoice.payload.total);

      await SupplierRepository.postToLedger({
        id: db.generateId('PL'),
        partnerId,
        date: invoiceDate,
        description: `فاتورة #${refId}`,
        debit: debitVal,
        credit: creditVal,
        referenceId: refId
      });
    }
  },

  async executeSaleBot(customerId: string, items: InvoiceItem[], total: number, options: SaleOptions, invoiceId?: string, auditScore?: number, riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH') {
    const isReturn = !!options.isReturn;
    const docId = invoiceId || 'NEW_SALE';
    const isPosting = options.invoiceStatus === 'POSTED' || options.invoiceStatus === 'LOCKED';
    
    if (invoiceId) {
      const old = await InvoiceRepository.getSaleById(invoiceId);
      if (old && (old.InvoiceStatus === 'POSTED' || old.InvoiceStatus === 'LOCKED')) {
        await SharedAutomationActions.applyInventoryMovement(old.items, 'SALE', !(old.isReturn), docId);
        await AccountRepository.deleteEntriesBySource(invoiceId);
      }
    }

    if (isPosting) {
      await SharedAutomationActions.applyInventoryMovement(items, 'SALE', isReturn, docId);
    }

    // حساب التكلفة بناءً على محرك FIFO
    let totalSaleCost = 0;
    if (isPosting) {
      if (!isReturn) {
        totalSaleCost = await FIFOEngine.calculateInvoiceCOGS(items);
      } else {
        // في حالة المرتجع، نقوم بعكس التكلفة (إعادة الطبقات)
        for (const item of items) {
          const product = await db.db.products.get(item.product_id);
          await FIFOEngine.reverseConsumption(item.product_id, item.qty, product?.CostPrice || 0);
        }
      }
    }

    const { sale_id } = await InvoiceRepository.saveSale(
      customerId, items, total, isReturn, invoiceId || '', options.currency, options.paymentStatus, options.invoiceStatus, auditScore, riskLevel, totalSaleCost
    );

    if (isPosting) {
      // استخدام BRE لإنشاء القيود المحاسبية
      const journals = BusinessRulesEngine.accounting.generateEntries('SALE', { id: sale_id, total, cost: totalSaleCost, paymentStatus: options.paymentStatus, isReturn });
      for (const entry of journals) {
        await AccountRepository.addEntry(await integrityVerifier.signEntry(entry));
      }
      await db.addAuditLog('POST', 'SALE', sale_id, `Sale ${sale_id} posted to ledger`);
    }
    return { sale_id };
  },

  async executePurchaseBot(supplierId: string, items: InvoiceItem[], total: number, invoiceId?: string, isCash: boolean = false, status: InvoiceStatus = 'PENDING', date?: string, isReturn: boolean = false, auditScore?: number, riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH') {
    const purchaseRef = invoiceId || db.generateId('PUR');
    const isPosting = status === 'POSTED' || status === 'LOCKED';
    
    if (invoiceId) {
      const old = await InvoiceRepository.getPurchaseById(invoiceId);
      if (old && (old.invoiceStatus === 'POSTED' || old.invoiceStatus === 'LOCKED')) {
        await SharedAutomationActions.applyInventoryMovement(old.items, 'PURCHASE', !(old.invoiceType === 'مرتجع'), purchaseRef);
        await AccountRepository.deleteEntriesBySource(purchaseRef);
      }
    }

    if (isPosting) {
      await SharedAutomationActions.applyInventoryMovement(items, 'PURCHASE', isReturn, purchaseRef);
      
      // إضافة طبقات التكلفة لمحرك FIFO عند الشراء
      if (!isReturn) {
        for (const item of items) {
          await FIFOEngine.addPurchaseLayer(item.product_id, item.qty, item.price, date || new Date().toISOString(), purchaseRef);
        }
      }
    }

    const { purchase_id } = await InvoiceRepository.savePurchase(
      supplierId, items, total, purchaseRef, isCash, 
      (window as any).currentSystemCurrency || 'USD', 
      status, auditScore, riskLevel
    );

    if (isPosting) {
      // استخدام BRE لإنشاء القيود المحاسبية
      const journals = BusinessRulesEngine.accounting.generateEntries('PURCHASE', { id: purchase_id, total, isCash, isReturn });
      for (const entry of journals) {
        await AccountRepository.addEntry(await integrityVerifier.signEntry(entry));
      }
      await db.addAuditLog('POST', 'PURCHASE', purchase_id, `Purchase ${purchase_id} posted to ledger`);
    }
    return { purchase_id };
  },

  async unpostInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    const table = type === 'SALE' ? 'sales' : 'purchases';
    if (await LockService.isLockedByOther(table, invoiceId)) {
      throw new ValidationError("هذا السجل مقفل حالياً بواسطة مستخدم آخر 🔒");
    }

    // Phase 5: Safety Rules - Allow only users with role = "ADMIN" to unpost.
    const user = authService.getCurrentUser();
    if (user?.Role !== 'Admin') {
      throw new ValidationError("Only administrators can unpost invoices.");
    }

    await LockService.acquireLock(table, invoiceId);

    try {
      // PHASE 3 — AUTO BACKUP RULES
      await BackupService.createBackup(`Auto Backup before Unpost #${invoiceId}`, 'PRE_UNPOST', true);

      const invoice = type === 'SALE' 
        ? await InvoiceRepository.getSaleById(invoiceId)
        : await InvoiceRepository.getPurchaseById(invoiceId);
      
      if (!invoice) throw new ValidationError("Invoice not found.");
      
      const status = (invoice as any).InvoiceStatus || (invoice as any).invoiceStatus;
      if (status !== 'POSTED') {
        throw new ValidationError("Only POSTED invoices can be unposted.");
      }

      // Phase 1: Validation Before Unpost
      // 1) Block if accounting period is closed.
      const date = (invoice as any).date || (invoice as any).Date;
      await PeriodLockEngine.validateOperation(date, 'إلغاء ترحيل');

      // 2) Block if invoice linked to locked tax report. (Assuming period lock covers this for now)
      // 3) Block if invoice has reconciled payments.
      const hasPayments = await InvoiceRepository.checkHasDependencies(invoiceId, type);
      if (hasPayments) {
        throw new ValidationError("Invoice cannot be unposted due to accounting restrictions (Reconciled Payments).");
      }

      // 4) Block if related journal entry already reversed. (Handled by Phase 6 logic below)
      // 5) Block if stock movements already adjusted manually. (Assuming manual adjustments are separate)

      const result = await db.runTransaction(async () => {
        // Phase 2: Reverse Engine
        
        // 1) Create Reverse Journal Entry
        const entries = await db.getJournalEntries();
        const originalEntries = entries.filter(e => e.sourceId === invoiceId);
        
        for (const entry of originalEntries) {
          // Phase 6: Data Integrity - No double reversal possible.
          if (entry.sourceType === 'AUTO_REVERSAL') continue; 
          
          const reversalEntry: AccountingEntry = {
            id: db.generateId('REV'),
            date: new Date().toISOString(),
            description: `Reversal of ${entry.id} for Invoice #${invoiceId}`,
            TotalAmount: entry.TotalAmount,
            status: 'Posted',
            sourceId: invoiceId,
            sourceType: 'AUTO_REVERSAL',
            branchId: entry.branchId,
            lines: entry.lines.map(l => ({
              ...l,
              lineId: db.generateId('DET'),
              debit: l.credit,
              credit: l.debit,
              type: l.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
            }))
          };
          await AccountRepository.addEntry(await integrityVerifier.signEntry(reversalEntry));
        }

        // 2) Reverse Stock Movements
        const items = (invoice as any).items || [];
        const isReturn = type === 'SALE' ? !!(invoice as any).isReturn : (invoice as any).invoiceType === 'مرتجع';
        
        for (const item of items) {
          const originalChange = BusinessRulesEngine.inventory.calculateStockChange(item.qty, type, isReturn);
          // Phase 6: Data Integrity - No negative stock caused by reversal.
          // ProductRepository.updateStock already checks for negative stock.
          await ProductRepository.updateStock(
            item.product_id,
            originalChange * -1,
            type as any,
            invoiceId,
            'REVERSAL'
          );
        }

        // 3) Reverse Customer/Supplier Balance
        const direction = type === 'SALE' ? 'Debit' : 'Credit'; 
        await FinancialTransactionRepository.record({
          Transaction_Type: 'Refund',
          Reference_ID: invoiceId,
          Reference_Table: type === 'SALE' ? 'Sales_Invoices' : 'Purchase_Invoices',
          Entity_Name: (invoice as any).customerId || (invoice as any).partnerId || 'عميل نقدي',
          Amount: (invoice as any).finalTotal || (invoice as any).totalAmount,
          Direction: direction,
          Transaction_Date: new Date().toISOString(),
          Notes: `[UNPOST REVERSAL] Invoice #${invoiceId}`
        });

        const partnerId = type === 'SALE' ? (invoice as any).customerId : (invoice as any).partnerId;
        if (partnerId && partnerId !== 'عميل نقدي') {
          const total = (invoice as any).finalTotal || (invoice as any).totalAmount;
          const debitVal = type === 'SALE' ? 0 : total;
          const creditVal = type === 'SALE' ? total : 0;

          await SupplierRepository.postToLedger({
            id: db.generateId('PL'),
            partnerId,
            date: new Date().toISOString(),
            description: `عكس قيد فاتورة #${invoiceId}`,
            debit: debitVal,
            credit: creditVal,
            referenceId: invoiceId
          });
        }

        // 4) Insert Audit Trail Record
        await db.addAuditLog('SYSTEM', type, invoiceId, `UNPOST: Status changed from POSTED to DRAFT_EDIT by ${user?.User_Email}`);

        // 5) Update invoice
        if (type === 'SALE') {
          const sale = invoice as Sale;
          sale.InvoiceStatus = 'DRAFT_EDIT';
          sale.lastModified = new Date().toISOString();
          await db.db.sales.put(sale);
        } else {
          const purchase = invoice as Purchase;
          purchase.invoiceStatus = 'DRAFT_EDIT';
          purchase.lastModified = new Date().toISOString();
          await db.db.purchases.put(purchase);
        }

        return { success: true };
      });
      return result;
    } finally {
      await LockService.releaseLock(table, invoiceId);
    }
  },

  async deleteInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    // 1. Global Transaction Lock
    const lockAcquired = await LockService.acquireGlobalTransactionLock();
    if (!lockAcquired) {
      throw new ValidationError("العملية قيد المعالجة حالياً، يرجى الانتظار... ⏳");
    }

    try {
      const table = type === 'SALE' ? 'sales' : 'purchases';
      if (await LockService.isLockedByOther(table, invoiceId)) {
        throw new ValidationError("هذا السجل مقفل حالياً بواسطة مستخدم آخر 🔒");
      }

      const invoice = type === 'SALE' 
        ? await InvoiceRepository.getSaleById(invoiceId)
        : await InvoiceRepository.getPurchaseById(invoiceId);
      
      if (!invoice) throw new ValidationError("Invoice not found.");

      // 2. Safe Delete: Check dependencies before delete
      const hasDeps = await InvoiceRepository.checkHasDependencies(invoiceId, type);
      if (hasDeps) {
        throw new ValidationError("لا يمكن حذف الفاتورة لوجود مستندات مرتبطة بها (سندات قبض/صرف). يرجى حذف الارتباطات أولاً.");
      }
      
      await LockService.acquireLock(table, invoiceId);

      // 3. Backup Before Critical Actions (Delete)
      await BackupService.createBackup(`Auto Backup before Delete #${invoiceId}`, 'PRE_DELETE', true);

      const status = (invoice as any).InvoiceStatus || (invoice as any).invoiceStatus;
      
      const result = await db.runTransaction(async () => {
        // Phase 4: Delete Protection (Soft Delete)
        if (status === 'POSTED') {
          await this.unpostInvoice(invoiceId, type);
        }

        if (type === 'SALE') {
          const sale = invoice as Sale;
          sale.InvoiceStatus = 'VOID';
          sale.isDeleted = true;
          sale.lastModified = new Date().toISOString();
          await db.db.sales.put(sale);
        } else {
          const purchase = invoice as Purchase;
          purchase.invoiceStatus = 'VOID';
          purchase.isDeleted = true;
          purchase.lastModified = new Date().toISOString();
          await db.db.purchases.put(purchase);
        }
        
        await db.addAuditLog('DELETE', type, invoiceId, `Invoice marked as VOID (Soft Delete) by ${authService.getCurrentUser().User_Email}`);
        return { success: true };
      });
      return result;
    } catch (error: any) {
      console.error("Delete Invoice Error:", error);
      throw error;
    } finally {
      const table = type === 'SALE' ? 'sales' : 'purchases';
      await LockService.releaseLock(table, invoiceId);
      await LockService.releaseGlobalTransactionLock();
    }
  }
};
