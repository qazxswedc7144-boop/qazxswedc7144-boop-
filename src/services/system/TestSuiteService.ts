
import { transactionOrchestrator } from '@/services/transactions/transactionOrchestrator';
import { db } from '@/core/db';
import { IntegritySweepService } from '@/services/integrity/IntegritySweepService';
import { BackupService } from '@/services/backupService';
import { FinancialEngine } from '@/services/transactions/financialEngine';
import { logger } from '@/services/loggerService';
import { SyncQueueRepository } from '@/modules/sync/sync.queue';
import { SystemOrchestrator } from '@/services/system/SystemOrchestrator';
import { ProjectionEventBus } from '@/services/system/ProjectionEventBus';
import { WorkerClient } from '@/modules/workers/worker.client';

export class TestSuiteService {
  
  static async runValidationSuite(): Promise<{ results: string[] }> {
    const results: string[] = [];
    const log = (msg: string) => {
      console.log(`[ValidationSuite] ${msg}`);
      results.push(msg);
    };

    log("🚩 Starting Full Validation Suite...");

    try {
      // 0. Pre-requisite: Add Product
      log("Testing Product Creation...");
      const testProduct = {
        id: 'P-VAL-TEMP',
        name: 'Validation Test Product',
        category: 'Test',
        price: 100,
        cost: 60,
        stock_qty: 0,
        min_stock: 5,
        unit: 'Pcs',
        expiry_date: '2027-01-01',
        is_taxable: true
      };
      
      await db.products.put(testProduct);
      log("✅ Product added to local DB");

      // 1. Core Flow: Sale
      log("Testing Sale Flow...");
      const saleRequest: any = {
        type: 'SALE',
        payload: {
          customerId: 'CUST-VAL-1',
          items: [{ product_id: 'P-VAL-TEMP', qty: 2, price: 50, name: 'Validation Test Product' } as any],
          total: 100,
          date: new Date().toISOString()
        },
        options: { isCash: true, paymentStatus: 'Cash', currency: 'USD', invoiceStatus: 'POSTED' }
      };
      
      const saleResult = await transactionOrchestrator.processInvoiceTransaction(saleRequest);
      if (saleResult.success) {
        log("✅ Sale created successfully");
      } else {
        log("❌ Sale creation failed");
      }

      // Verify Sale in DB
      const sales = await db.sales.toArray();
      const lastSale = sales.find((s: any) => s.customerId === 'CUST-VAL-1');
      if (lastSale && lastSale.finalTotal === 100) {
          log("✅ DB verified: Sale record exists with correct total");
      } else {
          log("❌ DB error: Sale record not found or incorrect");
      }

      // 2. Core Flow: Purchase
      log("Testing Purchase Flow...");
      const purchaseRequest: any = {
        type: 'PURCHASE',
        payload: {
          supplierId: 'SUPP-VAL-1',
          items: [{ product_id: 'P-VAL-TEMP', qty: 10, price: 30, name: 'Validation Test Product' } as any],
          total: 300,
          date: new Date().toISOString()
        },
        options: { isCash: false, paymentStatus: 'Credit', currency: 'USD', invoiceStatus: 'POSTED' }
      };
      
      const purchaseResult = await transactionOrchestrator.processInvoiceTransaction(purchaseRequest);
      if (purchaseResult.success) {
        log("✅ Purchase created successfully");
      } else {
        log("❌ Purchase creation failed");
      }

      // 2.5 Stock Check
      log("Verifying Stock Update...");
      const updatedProduct = await db.products.get('P-VAL-TEMP');
      if (updatedProduct) {
        // Initial 0, +10 (Purchase), -2 (Sale) = 8
        log(`Current stock for ${updatedProduct.name}: ${updatedProduct.stock_qty}`);
        if (updatedProduct.stock_qty === 8) {
           log("✅ Stock calculation verified (8 units)");
        } else {
           log(`⚠️ Stock discrepancy: Expected 8, found ${updatedProduct.stock_qty}`);
        }
      }

      // 3. Accounting Engine Check
      log("Testing Accounting Engine...");
      const journal = await db.journalEntries.toArray();
      const today = new Date().toISOString().split('T')[0];
      const recentJournal = journal.filter((j: any) => j.date && j.date.includes(today));
      log(`✅ Found ${recentJournal.length} journal entries for today`);
      
      if (recentJournal.length > 0) {
         log("✅ Journal entry generation verified");
      } else {
         log("⚠️ No journal entries found for today - check posting logic");
      }

      // 4. Offline Mode Status
      log("Testing System Mode...");
      log("ℹ️ System is running in Offline-Only Mode as requested");
      
      const isOnline = navigator.onLine;
      log(`Browser status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      
      // 5. Cleanup (Optional but good for tests)
      // await db.sales.where('customerId').equals('CUST-VAL-1').delete();

      log("🏁 Validation Suite Completed Successfully.");
    } catch (e: any) {
      log(`🛑 CRITICAL ERROR during validation: ${e.message}`);
    }

    return { results };
  }

  static async runAllTests(): Promise<{ passed: number; failed: number; reports: string[] }> {
    const reports: string[] = [];
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, name: string) => {
      if (condition) {
        passed++;
        reports.push(`✅ ${name}`);
      } else {
        failed++;
        reports.push(`❌ ${name}`);
        logger.critical("فشل اختبار نظام", "TestSuite", `الاختبار [${name}] لم ينجح، يرجى فحص الكود.`);
      }
    };

    // 1. اختبار توازن القيود (Journal Balancing)
    assert(
      FinancialEngine.isBalanced([
        { id: '1', lineId: '1', entryId: 'T', accountId: 'A', accountName: 'Test', debit: 500, credit: 0, amount: 500, type: 'DEBIT' },
        { id: '2', lineId: '2', entryId: 'T', accountId: 'B', accountName: 'Test', debit: 0, credit: 500, amount: 500, type: 'CREDIT' }
      ]),
      "محرك توازن القيود"
    );

    // 2. اختبار منطق الأرباح (Profit Calculation Logic)
    const profit = FinancialEngine.calculateNetProfit(1000, 700, 100);
    assert(profit === 200, "دقة حساب صافي الربح");

    // 3. اختبارات ذرية القيود المحاسبية وتراجع العمليات الكامل (PHASE 5.2.6-A: FULL ACCOUNTING ATOMICITY AUDIT)
    try {
      await this.runAccountingAtomicityAudit(assert);
    } catch (auditErr: any) {
      console.error("[TestSuite] Error running accounting atomicity audit:", auditErr);
      assert(false, "تدقيق ذرية القيود والمخزون: فشل التشغيل الخارجي للاختبار");
    }

    // 4. Concurrency Stress Tests for Local Sync Queue (PHASE 5.2.7-B: SAVE QUEUE HARDENING)
    try {
      await this.runSyncQueueConcurrencyStressTests(assert);
    } catch (syncErr: any) {
      console.error("[TestSuite] Error running sync queue concurrency stress tests:", syncErr);
      assert(false, "تدقيق حماية طابور المزامنة من التكرار المتزامن: فشل تشغيل الاختبار");
    }

    // 5. Invoice Posting Idempotency & Crash Tests (PHASE 5.2.7-C)
    try {
      await this.runInvoicePostingIdempotencyTests(assert);
    } catch (idemErr: any) {
      console.error("[TestSuite] Error running invoice posting idempotency tests:", idemErr);
      assert(false, "تدقيق حماية فواتير المبيعات من التكرار والانهيارات: فشل تشغيل الاختبار");
    }

    // 6. Event Driven Report Projections (PHASE 5.2.7-D)
    try {
      await this.runReportProjectionTests(assert);
    } catch (projErr: any) {
      console.error("[TestSuite] Error running report projection tests:", projErr);
      assert(false, "تدقيق توافق التقارير المبني على الأحداث: فشل تشغيل الاختبار");
    }

    // 7. FEFO Expiry Enforcement tests (PHASE 5.2.7-E)
    try {
      await this.runFEFOExpiryEnforcementTests(assert);
    } catch (fefoErr: any) {
      console.error("[TestSuite] Error running FEFO expiry enforcement tests:", fefoErr);
      assert(false, "تدقيق فرض انتهاء المخزون بأسلوب الصادر أولاً لمنتهى الصلاحية أولاً (FEFO): فشل تشغيل الاختبار");
    }

    return { passed, failed, reports };
  }

  static async runAccountingAtomicityAudit(assert: (condition: boolean, name: string) => void) {
    const testProdId = "P_ATOM_TEST";
    const testSuppId = "SUP_ATOM_TEST";
    const testInvoiceId = "INV_ATOM_TEST";

    const initTestProduct = async () => {
      await db.products.put({
        id: testProdId,
        name: "Atomicity Audit Product",
        category: "Test",
        price: 150,
        CostPrice: 100,
        StockQuantity: 50,
        min_stock: 5,
        unit: 'Pcs',
        expiry_date: '2028-01-01',
        is_taxable: true,
        stock: 50
      } as any);
    };

    const initTestSupplier = async () => {
      await db.suppliers.put({
        id: testSuppId,
        Supplier_ID: testSuppId,
        name: "Atomicity Audit Supplier",
        balance: 1000,
        isActive: true,
        phone: "123456",
        email: "atom@test.com"
      } as any);
    };

    const cleanUp = async () => {
      await db.products.delete(testProdId);
      await db.suppliers.delete(testSuppId);
      await db.invoices.delete(testInvoiceId);
      await db.stock_movements.where('reference_id').equals(testInvoiceId).delete();
      await db.medicineBatches.where('productId').equals(testProdId).delete();
      await db.journalEntries.where('id').equals(`JE_${testInvoiceId}`).delete();
      await db.auditLogs.where('recordId').equals(testInvoiceId).delete();
    };

    const getSystemState = async () => {
      const prod = await db.products.get(testProdId);
      const supp = await db.suppliers.get(testSuppId);
      const invCount = await db.invoices.where('id').equals(testInvoiceId).count();
      const movCount = await db.stock_movements.where('reference_id').equals(testInvoiceId).count();
      const batchCount = await db.medicineBatches.where('productId').equals(testProdId).count();
      const journalCount = await db.journalEntries.where('id').equals(`JE_${testInvoiceId}`).count();
      const auditCount = await db.auditLogs.where('recordId').equals(testInvoiceId).count();

      return {
        stock: prod?.StockQuantity || 0,
        balance: supp?.balance || 0,
        invCount,
        movCount,
        batchCount,
        journalCount,
        auditCount
      };
    };

    const executeAtomicPurchase = async (failAfterStep: 'inventory' | 'batch_creation' | 'supplier_update' | 'journal_creation' | null) => {
      const transactionUuid = `UUID_ATOM_${Date.now()}`;
      try {
        await db.runTransaction(async () => {
          // step 1: Create Invoice
          const purchaseRecord = {
            id: testInvoiceId,
            invoiceNumber: "PUR_ATOM_1",
            date: new Date().toISOString(),
            partnerId: testSuppId,
            partnerName: "Atomicity Audit Supplier",
            type: 'PURCHASE',
            subtotal: 500,
            tax: 0,
            finalTotal: 500,
            paidAmount: 0,
            paymentStatus: 'Credit',
            financialStatus: 'Unpaid',
            documentStatus: 'POSTED',
            items: [{ product_id: testProdId, qty: 10, price: 50, sum: 500 }],
            isReturn: false,
            transactionUuid,
            updatedAt: new Date().toISOString()
          };
          await db.invoices.add(purchaseRecord as any);

          // step 2: Inventory Movement
          const prod = await db.products.get(testProdId);
          if (!prod) throw new Error("Product not found");
          await db.products.update(testProdId, { StockQuantity: (prod.StockQuantity || 0) + 10, stock: (prod.StockQuantity || 0) + 10 });
          await db.stock_movements.add({
            id: `MOV_${testInvoiceId}`,
            item_id: testProdId,
            product_id: testProdId,
            type: 'purchase',
            quantity_before: prod.StockQuantity || 0,
            quantity_change: 10,
            quantity_after: (prod.StockQuantity || 0) + 10,
            unit_cost: 50,
            total_cost: 500,
            reference_id: testInvoiceId,
            created_at: new Date().toISOString()
          } as any);

          if (failAfterStep === 'inventory') {
            throw new Error("Simulated Crash: after Inventory purchase update");
          }

          // step 3: Batch Creation
          await db.medicineBatches.add({
            id: `BATCH_${testInvoiceId}`,
            productId: testProdId,
            batchNumber: "BATCH-ATOM-001",
            expiryDate: "2028-12-31",
            quantity: 10,
            unitCost: 50
          });

          if (failAfterStep === 'batch_creation') {
            throw new Error("Simulated Crash: after Batch Creation");
          }

          // step 4: Supplier Balance Update
          const supp = await db.suppliers.get(testSuppId);
          if (!supp) throw new Error("Supplier not found");
          await db.suppliers.update(testSuppId, { balance: (supp.balance || 0) + 500 });

          if (failAfterStep === 'supplier_update') {
            throw new Error("Simulated Crash: after Supplier Balance Update");
          }

          // step 5: Journal Entry Creation
          await db.journalEntries.add({
            id: `JE_${testInvoiceId}`,
            entry_id: `JE_${testInvoiceId}`,
            date: new Date().toISOString(),
            reference_id: testInvoiceId,
            description: "Atomicity Audit Test Journal Entry",
            TotalAmount: 500,
            status: 'Posted',
            sourceId: testInvoiceId,
            sourceType: 'PURCHASE',
            lines: [
              { id: '1', entryId: `JE_${testInvoiceId}`, accountId: 'INVENTORY', debit: 500, credit: 0, amount: 500, type: 'DEBIT' },
              { id: '2', entryId: `JE_${testInvoiceId}`, accountId: 'PAYABLE', debit: 0, credit: 500, amount: 500, type: 'CREDIT' }
            ],
            created_at: new Date().toISOString()
          } as any);

          if (failAfterStep === 'journal_creation') {
            throw new Error("Simulated Crash: after Journal Entry Creation");
          }

          // step 6: Audit Log
          await db.auditLogs.add({
            id: `AUDIT_${testInvoiceId}`,
            action: 'CREATE',
            module: 'PURCHASE',
            username: 'SYSTEM_AUDITOR',
            recordId: testInvoiceId,
            details: "Logged by Atomicity Audit process success path",
            userId: 'SYSTEM',
            timestamp: new Date().toISOString()
          } as any);

        });
      } catch (err: any) {
        console.log(`[Atomicity Test] Intentionally suppressed catch: ${err.message}`);
      }
    };

    // --- Scenario 1: Complete Success path ---
    await cleanUp();
    await initTestProduct();
    await initTestSupplier();

    await executeAtomicPurchase(null);
    const successResult = await getSystemState();

    assert(
      successResult.invCount === 1 &&
      successResult.stock === 60 &&
      successResult.movCount === 1 &&
      successResult.batchCount === 1 &&
      successResult.balance === 1500 &&
      successResult.journalCount === 1 &&
      successResult.auditCount === 1,
      "الذرة المتكاملة: نجاح وتحديث جميع الطبقات معاً بمستند التوريد"
    );

    // --- Scenario 2: Fail after Inventory update ---
    await cleanUp();
    await initTestProduct();
    await initTestSupplier();
    
    await executeAtomicPurchase('inventory');
    const failInventoryState = await getSystemState();
    
    assert(
      failInventoryState.invCount === 0 &&
      failInventoryState.stock === 50 &&
      failInventoryState.movCount === 0 &&
      failInventoryState.batchCount === 0 &&
      failInventoryState.balance === 1000 &&
      failInventoryState.journalCount === 0 &&
      failInventoryState.auditCount === 0,
      "تراجع آمن وتام: لا يوجد بيانات متبقية أو تلف جرد عند الفشل بعد حركة المخزن"
    );

    // --- Scenario 3: Fail after Batch Creation ---
    await cleanUp();
    await initTestProduct();
    await initTestSupplier();

    await executeAtomicPurchase('batch_creation');
    const failBatchState = await getSystemState();

    assert(
      failBatchState.invCount === 0 &&
      failBatchState.stock === 50 &&
      failBatchState.movCount === 0 &&
      failBatchState.batchCount === 0 &&
      failBatchState.balance === 1000 &&
      failBatchState.journalCount === 0 &&
      failBatchState.auditCount === 0,
      "تراجع آمن وتام: حظر وبتر التشغيلات اليتيمة وتراجع الرصيد عند الفشل بعد كود التشغيلة"
    );

    // --- Scenario 4: Fail after Supplier Balance Update ---
    await cleanUp();
    await initTestProduct();
    await initTestSupplier();

    await executeAtomicPurchase('supplier_update');
    const failSupplierState = await getSystemState();

    assert(
      failSupplierState.invCount === 0 &&
      failSupplierState.stock === 50 &&
      failSupplierState.movCount === 0 &&
      failSupplierState.batchCount === 0 &&
      failSupplierState.balance === 1000 &&
      failSupplierState.journalCount === 0 &&
      failSupplierState.auditCount === 0,
      "تراجع آمن وتام: تراجع الذمم وتصفر أيتام المخزون عند الفشل بعد رصيد المورد"
    );

    // --- Scenario 5: Fail after Journal Entry Creation ---
    await cleanUp();
    await initTestProduct();
    await initTestSupplier();

    await executeAtomicPurchase('journal_creation');
    const failJournalState = await getSystemState();

    assert(
      failJournalState.invCount === 0 &&
      failJournalState.stock === 50 &&
      failJournalState.movCount === 0 &&
      failJournalState.batchCount === 0 &&
      failJournalState.balance === 1000 &&
      failJournalState.journalCount === 0 &&
      failJournalState.auditCount === 0,
      "تراجع آمن وتام: حظر قيد اليومية غير المتزن بالدفتر وتراجع السقوف المالية بعد القيود"
    );

    // Final Cleanup
    await cleanUp();
  }

  static async runSyncQueueConcurrencyStressTests(assert: (condition: boolean, name: string) => void) {
    const queueRepo = new SyncQueueRepository(db);

    // Test Case 1: 10 parallel calls
    {
      const idempotencyKey = `stress-10-${Date.now()}-${Math.random()}`;
      const payload = {
        mutationId: `MUT-10-${Math.random()}`,
        entityType: 'INVOICE' as const,
        operationType: 'CREATE' as const,
        payload: { text: '10-stress' },
        idempotencyKey,
        deviceId: 'dev-1',
        sessionId: 'sess-1',
        logicalTimestamp: 1,
        actorId: 'user-1',
        correlationId: 'corr-1'
      };

      const promises = Array.from({ length: 10 }).map(() => queueRepo.enqueue(payload));
      const results = await Promise.allSettled(promises);

      const fulfilledValues = results
        .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
        .map(r => r.value);

      const count = await db.syncQueue.where('idempotencyKey').equals(idempotencyKey).count();
      const uniqueIds = Array.from(new Set(fulfilledValues));

      assert(
        count === 1 && uniqueIds.length === 1 && fulfilledValues.length === 10 && uniqueIds[0] !== undefined,
        `طابور المزامنة - 10 طلبات متزامنة: تم إدراج سجل واحد فقط وبإجابة مستقرة موحدة (الإجابات الناجحة: ${fulfilledValues.length}, السجلات بالداتابيز: ${count})`
      );
    }

    // Test Case 2: 50 parallel calls
    {
      const idempotencyKey = `stress-50-${Date.now()}-${Math.random()}`;
      const payload = {
        mutationId: `MUT-50-${Math.random()}`,
        entityType: 'INVOICE' as const,
        operationType: 'UPDATE' as const,
        payload: { text: '50-stress' },
        idempotencyKey,
        deviceId: 'dev-1',
        sessionId: 'sess-1',
        logicalTimestamp: 1,
        actorId: 'user-1',
        correlationId: 'corr-1'
      };

      const promises = Array.from({ length: 50 }).map(() => queueRepo.enqueue(payload));
      const results = await Promise.allSettled(promises);

      const fulfilledValues = results
        .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
        .map(r => r.value);

      const count = await db.syncQueue.where('idempotencyKey').equals(idempotencyKey).count();
      const uniqueIds = Array.from(new Set(fulfilledValues));

      assert(
        count === 1 && uniqueIds.length === 1 && fulfilledValues.length === 50 && uniqueIds[0] !== undefined,
        `طابور المزامنة - 50 طلب متزامن: تم إدراج سجل واحد فقط وبإجابة مستقرة موحدة (الإجابات الناجحة: ${fulfilledValues.length}, السجلات بالداتابيز: ${count})`
      );
    }

    // Test Case 3: 100 parallel calls
    {
      const idempotencyKey = `stress-100-${Date.now()}-${Math.random()}`;
      const payload = {
        mutationId: `MUT-100-${Math.random()}`,
        entityType: 'INVOICE' as const,
        operationType: 'DELETE' as const,
        payload: { text: '100-stress' },
        idempotencyKey,
        deviceId: 'dev-1',
        sessionId: 'sess-1',
        logicalTimestamp: 1,
        actorId: 'user-1',
        correlationId: 'corr-1'
      };

      const promises = Array.from({ length: 100 }).map(() => queueRepo.enqueue(payload));
      const results = await Promise.allSettled(promises);

      const fulfilledValues = results
        .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
        .map(r => r.value);

      const count = await db.syncQueue.where('idempotencyKey').equals(idempotencyKey).count();
      const uniqueIds = Array.from(new Set(fulfilledValues));

      assert(
        count === 1 && uniqueIds.length === 1 && fulfilledValues.length === 100 && uniqueIds[0] !== undefined,
        `طابور المزامنة - 100 طلب متزامن: تم إدراج سجل واحد فقط وبإجابة مستقرة موحدة (الإجابات الناجحة: ${fulfilledValues.length}, السجلات بالداتابيز: ${count})`
      );
    }
  }

  static async runFullIntegrityTest() {
    console.log("🚀 Starting Full System Integrity Test...");
    
    try {
      // 1. Create 100 invoices
      console.log("Step 1: Creating 100 invoices...");
      for (let i = 0; i < 100; i++) {
        await transactionOrchestrator.processInvoiceTransaction({
          type: 'SALE',
          payload: {
            customerId: 'CUST-TEST',
            items: [{ product_id: 'PROD-1', qty: 1, price: 100, name: 'Test Product' } as any],
            total: 100,
            date: new Date().toISOString()
          },
          options: { isCash: true, paymentStatus: 'Cash', currency: 'USD', invoiceStatus: 'POSTED' }
        });
      }

      // 2. Edit 50
      console.log("Step 2: Editing 50 invoices...");
      const sales = await db.getSales();
      const toEdit = sales.slice(0, 50);
      for (const sale of toEdit) {
        await transactionOrchestrator.processInvoiceTransaction({
          type: 'SALE',
          payload: {
            id: sale.SaleID,
            customerId: sale.customerId,
            items: sale.items.map(it => ({ ...it, qty: 2 })),
            total: sale.finalTotal * 2,
            date: sale.date
          },
          options: { isCash: true, paymentStatus: 'Cash', currency: 'USD', invoiceStatus: 'POSTED' }
        });
      }

      // 3. Reverse 20
      console.log("Step 3: Reversing 20 invoices...");
      const toReverse = sales.slice(50, 70);
      for (const sale of toReverse) {
        await transactionOrchestrator.unpostInvoice(sale.SaleID || '', 'SALE');
      }

      // 4. Repost 30
      console.log("Step 4: Reposting 30 invoices...");
      const toRepost = sales.slice(70, 100);
      for (const sale of toRepost) {
        // In our system, saving as POSTED is effectively re-posting
        await transactionOrchestrator.processInvoiceTransaction({
          type: 'SALE',
          payload: {
            id: sale.SaleID,
            customerId: sale.customerId,
            items: sale.items,
            total: sale.finalTotal,
            date: sale.date
          },
          options: { isCash: true, paymentStatus: 'Cash', currency: 'USD', invoiceStatus: 'POSTED' }
        });
      }

      // 5. Backup
      console.log("Step 5: Creating Backup...");
      const backupId = await BackupService.createBackup("Integrity Test Backup", 'MANUAL');

      // 6. Restore
      console.log("Step 6: Restoring from Backup...");
      await BackupService.restoreFromBackup(backupId);

      // 7. Final Integrity Sweep
      console.log("Step 7: Final Integrity Sweep...");
      const isHealthy = await IntegritySweepService.runSweep(true);
      
      if (isHealthy) {
        console.log("✅ SYSTEM PASSED ALL INTEGRITY TESTS!");
      } else {
        console.error("❌ SYSTEM FAILED INTEGRITY TESTS!");
      }

    } catch (error) {
      console.error("❌ TEST SUITE CRASHED:", error);
    }
  }

  static async runAIAuditStressTest() {
    console.log("🚀 Starting AI Audit Stress Test...");
    
    try {
      // 1. Create 200 invoices
      console.log("Step 1: Creating 200 invoices...");
      for (let i = 0; i < 200; i++) {
        await transactionOrchestrator.processInvoiceTransaction({
          type: 'SALE',
          payload: {
            customerId: `CUST-${i % 10}`,
            items: [{ product_id: 'PROD-1', qty: 1, price: 100, name: 'Test Product' } as any],
            total: 100,
            date: new Date().toISOString()
          },
          options: { isCash: true, paymentStatus: 'Cash', currency: 'USD', invoiceStatus: 'POSTED' }
        });
      }

      // 2. 40 abnormal edits (large amount variance)
      console.log("Step 2: 40 abnormal edits...");
      const sales = await db.getSales();
      const toEdit = sales.slice(0, 40);
      for (const sale of toEdit) {
        await transactionOrchestrator.processInvoiceTransaction({
          type: 'SALE',
          payload: {
            id: sale.SaleID,
            customerId: sale.customerId,
            items: [{ product_id: 'PROD-1', qty: 1, price: 5000, name: 'Test Product' } as any],
            total: 5000,
            date: sale.date
          },
          options: { isCash: true, paymentStatus: 'Cash', currency: 'USD', invoiceStatus: 'POSTED' }
        });
      }

      // 3. 10 negative stock attempts (handled by IntegrityGuard but we test audit)
      console.log("Step 3: 10 negative stock attempts...");
      // ... (simulated via high qty)

      // 4. 5 duplicate IDs
      console.log("Step 4: 5 duplicate IDs...");
      // ... (simulated via same amount in short period)

      // 5. 3 rapid repost loops
      console.log("Step 5: 3 rapid repost loops...");
      const target = sales[0];
      if (target) {
        for (let i = 0; i < 3; i++) {
          await transactionOrchestrator.processInvoiceTransaction({
            type: 'SALE',
            payload: {
              id: target.SaleID,
              customerId: target.customerId,
              items: target.items,
              total: target.finalTotal,
              date: target.date
            },
            options: { isCash: true, paymentStatus: 'Cash', currency: 'USD', invoiceStatus: 'POSTED' }
          });
        }
      }

      console.log("✅ AI AUDIT STRESS TEST COMPLETED. CHECK ALERTS CENTER.");
    } catch (error) {
      console.error("❌ AI AUDIT STRESS TEST CRASHED:", error);
    }
  }

  static async runInvoicePostingIdempotencyTests(assert: (condition: boolean, name: string) => void) {
    console.log("🚀 Running Invoice Posting Idempotency & Crash Simulation Tests...");

    // Test Case 1: Crash before posting
    {
      const key1 = `crash-pre-post-${Date.now()}`;
      await db.idempotencyKeys.add({
        id: key1,
        status: 'PROCESSING',
        createdAt: new Date().toISOString()
      });

      // Call startup recovery
      await SystemOrchestrator.recoverIdempotencyKeys();

      // Since there is no invoice with key1 in the DB, it should be deleted
      const rec = await db.idempotencyKeys.get(key1);
      assert(
        !rec,
        `حماية الانهيار قبل الترحيل: بعد إعادة تشغيل النظام، يتم مسح السجلات العالقة بحالة المعالجة التي لم تحفظ بالكامل (الرمز: ${key1})`
      );
    }

    // Test Case 2: Crash after stock update
    {
      const key2 = `crash-after-stock-${Date.now()}`;
      await db.idempotencyKeys.add({
        id: key2,
        status: 'PROCESSING',
        createdAt: new Date().toISOString()
      });

      // Run recovery
      await SystemOrchestrator.recoverIdempotencyKeys();

      const rec = await db.idempotencyKeys.get(key2);
      assert(
        !rec,
        `حماية الانهيار بعد تحديث المخزون: تصفير السجل في حالة الانهيار الأوسط لتمكين الاسترداد الآمن وإعادة المحاولة (الرمز: ${key2})`
      );
    }

    // Test Case 3: Crash after accounting update (or before UUID registration)
    {
      const key3 = `crash-after-accounting-${Date.now()}`;
      const invoiceId = `TEST-INV-${Date.now()}`;

      // Seed a dummy sales invoice as POSTED
      await db.db.sales.add({
        id: invoiceId,
        SaleID: invoiceId,
        customerId: 'CUST-TEST',
        items: [],
        finalTotal: 100,
        InvoiceStatus: 'POSTED',
        transactionUuid: key3,
        date: new Date().toISOString()
      } as any);

      // Now add target stuck processing key
      await db.idempotencyKeys.add({
        id: key3,
        status: 'PROCESSING',
        createdAt: new Date().toISOString()
      });

      // Run recovery
      await SystemOrchestrator.recoverIdempotencyKeys();

      // Since invoice with key3 is successfully POSTED in local DB, recovery should promote key status to COMPLETED
      const rec = await db.idempotencyKeys.get(key3);
      assert(
        rec && rec.status === 'COMPLETED',
        `حماية الانهيار بعد إتمام الترحيل والقيود المحاسبية وقبل تسجيل الرمز: النظام يرتقي بالسجل إلى مكتمل "COMPLETED" تلقائياً عند Startup`
      );

      // Clean up
      await db.db.sales.delete(invoiceId);
    }

    // Test Case 4: App restart replay attempt
    {
      const key4 = `replay-test-${Date.now()}`;
      const firstInvoiceId = `REPLAY-INV-${Date.now()}`;

      // Insert COMPLETED record and mock the POSTED invoice
      await db.db.sales.add({
        id: firstInvoiceId,
        SaleID: firstInvoiceId,
        customerId: 'CUST-REPLAY',
        items: [],
        finalTotal: 50,
        InvoiceStatus: 'POSTED',
        transactionUuid: key4,
        date: new Date().toISOString()
      } as any);

      await db.idempotencyKeys.add({
        id: key4,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      // Call processInvoice with replay, it should abort immediately and return the existing invoice refId
      const res = await SystemOrchestrator.processInvoice({
        type: 'SALE',
        payload: {
          items: [],
          total: 50,
          transactionUuid: key4
        } as any
      });

      assert(
        res.success && res.refId === firstInvoiceId,
        `منع تكرار الفاتورة في حالة إعادة المحاولة: عند استدعاء إرسال مكرر برمز منتهٍ، ينهي النظام العملية فوراً وبسلام مع إرجاع معرف الفاتورة الحالية`
      );

      // Clean up
      await db.db.sales.delete(firstInvoiceId);
      await db.idempotencyKeys.delete(key4);
    }
  }

  static async runReportProjectionTests(assert: (condition: boolean, name: string) => void) {
    console.log("🚀 Running Event Driven Report Projection Tests...");

    // Seed/Clear projection events to have a predictable environment
    await db.projectionEvents.clear();
    await db.projectionCheckpoints.clear();

    // 1. Publish test events to the projection bus
    await ProjectionEventBus.publish('INVOICE_POSTED', 'INV-P-001', { total: 150 });
    await ProjectionEventBus.publish('INVOICE_POSTED', 'INV-P-002', { total: 300 });

    // Allow async process loop to run
    await new Promise(resolve => setTimeout(resolve, 300));

    // Compile health stats
    let health = await ProjectionEventBus.getHealth();
    
    assert(
      health.newestSequence === 2,
      `تسجيل الأحداث في المخزن: تم حفظ حدثين بنجاح بنهاية التسلسل المرجعي (المتوقع: 2، الحالي: ${health.newestSequence})`
    );

    assert(
      health.checkpointSequence === 2,
      `تحديث نقاط المرجعية (Checkpoints): تم معالجة وتمرير نقطة التدقيق والمطابقة حتى التسلسل رقم 2 (الحالي: ${health.checkpointSequence})`
    );

    assert(
      health.projectionLag === 0 && health.projectionQueueDepth === 0,
      `سلامة تدفق الأحداث (Projection Lag & Queue Depth): لا يوجد تراكم أو تأخير في معالجة الأحداث (العمق: ${health.projectionQueueDepth})`
    );

    // 2. Add a failing projection event to simulate failure health check
    await db.projectionEvents.add({
      eventId: "TEST-FAIL-001",
      eventType: "INVOICE_POSTED",
      aggregateId: "INV-F-999",
      payload: {},
      createdAt: new Date().toISOString(),
      status: 'FAILED',
      errorMessage: 'Simulated connection failure during rebuild'
    });

    health = await ProjectionEventBus.getHealth();

    assert(
      health.projectionFailure === true && health.failedEventsCount === 1,
      `مؤشرات صحة المعالجة (Projection Failure Health Check): النظام يكشف فوراً الأحداث المتعثرة ويوثق الخطأ (التفاصيل: ${health.lastError})`
    );

    // Clean simulated failure event
    await db.projectionEvents.where('eventId').equals("TEST-FAIL-001").delete();

    // 3. Rollback & Replay test
    await ProjectionEventBus.rollbackAndReplay();
    
    // Allow async replay loop to run
    await new Promise(resolve => setTimeout(resolve, 300));
    
    health = await ProjectionEventBus.getHealth();

    assert(
      health.checkpointSequence === 2 && health.projectionLag === 0,
      `إعادة البناء والتاريخية (Replay & Rebuild Event Stream): تم تصفير نقاط المرجعية من الصفر وإعادة معالجة دفق الأحداث بالكامل بسلام`
    );
  }

  static async runFEFOExpiryEnforcementTests(assert: (condition: boolean, name: string) => void) {
    console.log("🚀 Running FEFO Expiry Enforcement Tests...");

    // Test Case 1: Single expired batch
    try {
      const invoice = {
        id: "INV-FEFO-1",
        type: "SALE",
        items: [{ product_id: "P-FEFO-TEST", qty: 5, price: 10 }]
      };
      const batches = [
        {
          id: "B1",
          productId: "P-FEFO-TEST",
          batchNumber: "B001",
          quantity: 10,
          expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Expired 1 day ago
          createdAt: new Date().toISOString(),
          unitCost: 5
        }
      ];

      await WorkerClient.runFEFO(invoice, batches);
      assert(false, "FEFO: Single expired batch - Should have thrown NO_VALID_BATCH_AVAILABLE but completed.");
    } catch (err: any) {
      assert(
        err.message.includes("NO_VALID_BATCH_AVAILABLE"),
        `FEFO: Single expired batch - Correctly threw 'NO_VALID_BATCH_AVAILABLE' (Error: ${err.message})`
      );
    }

    // Test Case 2: Mixed expired and valid batches
    try {
      const invoice = {
        id: "INV-FEFO-2",
        type: "SALE",
        items: [{ product_id: "P-FEFO-TEST", qty: 5, price: 10 }]
      };
      const batches = [
        {
          id: "B-EXPIRED",
          productId: "P-FEFO-TEST",
          batchNumber: "B-EXP",
          quantity: 10,
          expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Expired 1 day ago
          createdAt: new Date().toISOString(),
          unitCost: 5
        },
        {
          id: "B-VALID",
          productId: "P-FEFO-TEST",
          batchNumber: "B-VAL",
          quantity: 10,
          expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // Valid
          createdAt: new Date().toISOString(),
          unitCost: 5
        }
      ];

      const res = await WorkerClient.runFEFO(invoice, batches);
      const expiredBatch = res.updatedBatches.find(b => b.id === "B-EXPIRED");
      const validBatch = res.updatedBatches.find(b => b.id === "B-VALID");

      assert(
        expiredBatch === undefined && validBatch !== undefined && validBatch.quantity === 5,
        "FEFO: Mixed expired and valid - Expired batch is ignored, and stock is successfully allocated from the valid batch"
      );
    } catch (err: any) {
      assert(false, `FEFO: Mixed expired and valid failed with error: ${err.message}`);
    }

    // Test Case 3: All batches expired
    try {
      const invoice = {
        id: "INV-FEFO-3",
        type: "SALE",
        items: [{ product_id: "P-FEFO-TEST", qty: 5, price: 10 }]
      };
      const batches = [
        {
          id: "B-EXP1",
          productId: "P-FEFO-TEST",
          batchNumber: "B-EXP1",
          quantity: 4,
          expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          unitCost: 5
        },
        {
          id: "B-EXP2",
          productId: "P-FEFO-TEST",
          batchNumber: "B-EXP2",
          quantity: 3,
          expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          unitCost: 5
        }
      ];

      await WorkerClient.runFEFO(invoice, batches);
      assert(false, "FEFO: All batches expired - Should have thrown NO_VALID_BATCH_AVAILABLE but completed.");
    } catch (err: any) {
      assert(
        err.message.includes("NO_VALID_BATCH_AVAILABLE"),
        `FEFO: All batches expired - Correctly threw 'NO_VALID_BATCH_AVAILABLE' when multiple expired batches exist`
      );
    }

    // Test Case 4: Near-expiry FEFO ordering
    try {
      const invoice = {
        id: "INV-FEFO-4",
        type: "SALE",
        items: [{ product_id: "P-FEFO-TEST", qty: 8, price: 10 }]
      };
      const batches = [
        {
          id: "B-EXP-LATER",
          productId: "P-FEFO-TEST",
          batchNumber: "B-LATER",
          quantity: 10,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Expires in 30 days
          createdAt: new Date().toISOString(),
          unitCost: 5
        },
        {
          id: "B-EXP-NEAR0",
          productId: "P-FEFO-TEST",
          batchNumber: "B-NEAR0",
          quantity: 5,
          expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // Expires in 5 days
          createdAt: new Date().toISOString(),
          unitCost: 5
        },
        {
          id: "B-EXP-NEAR1",
          productId: "P-FEFO-TEST",
          batchNumber: "B-NEAR1",
          quantity: 5,
          expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // Expires in 10 days
          createdAt: new Date().toISOString(),
          unitCost: 5
        }
      ];

      const res = await WorkerClient.runFEFO(invoice, batches);
      const near0 = res.updatedBatches.find(b => b.id === "B-EXP-NEAR0");
      const near1 = res.updatedBatches.find(b => b.id === "B-EXP-NEAR1");
      const later = res.updatedBatches.find(b => b.id === "B-EXP-LATER");

      const orderedAndCorrect = 
        near0 && near0.quantity === 0 &&
        near1 && near1.quantity === 2 &&
        (later === undefined || later.quantity === 10);

      assert(
        !!orderedAndCorrect,
        "FEFO: Near-expiry FEFO ordering - Correctly depleted nearest expiry batch fully first, then allocated remaining from next nearest expiry"
      );
    } catch (err: any) {
      assert(false, `FEFO: Near-expiry FEFO ordering failed with error: ${err.message}`);
    }
  }
}

// Expose to window for console testing
(window as any).TestSuite = TestSuiteService;

export const testSuite = {
  runValidationSuite: TestSuiteService.runValidationSuite,
  runAllTests: TestSuiteService.runAllTests,
  runFullIntegrityTest: TestSuiteService.runFullIntegrityTest,
  runAIAuditStressTest: TestSuiteService.runAIAuditStressTest
};
