
import { db } from './database';
import { Sale, Purchase, InventoryTransaction, CashFlow, PerformanceMetric, Product, InventoryTransactionType } from '../types';

import { IntegritySweepService } from './IntegritySweepService';

export class LoadTestService {
  
  /**
   * Logs a performance metric to the database
   */
  static async logMetric(operation: string, durationMs: number, metadata?: any) {
    const metric: PerformanceMetric = {
      id: db.generateId('METRIC'),
      operation,
      durationMs,
      timestamp: new Date().toISOString(),
      metadata
    };
    await db.db.systemPerformanceLog.add(metric);
    console.log(`[PERF] ${operation}: ${durationMs}ms`);
  }

  /**
   * Measures execution time of an async function
   */
  static async measure<T>(operation: string, fn: () => Promise<T>, metadata?: any): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      await this.logMetric(operation, Math.round(end - start), metadata);
      return result;
    } catch (error) {
      const end = performance.now();
      await this.logMetric(`${operation}_FAILED`, Math.round(end - start), { error: String(error), ...metadata });
      throw error;
    }
  }

  /**
   * Generates bulk data for load testing
   */
  static async runBulkSimulation() {
    console.log("Starting Bulk Data Simulation...");
    const startTime = performance.now();

    // 1. Generate Products if none exist
    const products = await db.getProducts();
    if (products.length === 0) {
      console.log("Generating base products...");
      const baseProducts: Product[] = Array.from({ length: 100 }, (_, i) => ({
        id: db.generateId('PROD'),
        Name: `Test Product ${i}`,
        barcode: `BAR-${i}`,
        CostPrice: 10 + Math.random() * 90,
        SalePrice: 15 + Math.random() * 100,
        StockQuantity: 1000,
        Is_Active: true,
        category: 'Test',
        DefaultUnit: 'Unit',
        LastPurchasePrice: 10,
        TaxDefault: 0,
        UnitPrice: 15,
        MinLevel: 5,
        ExpiryDate: new Date(Date.now() + 31536000000).toISOString(), // 1 year from now
        Created_By: 'LOAD_TEST',
        Created_At: new Date().toISOString()
      }));
      await db.db.products.bulkAdd(baseProducts);
    }

    const partners = await db.getSuppliers();
    const supplierId = partners[0]?.id || 'SUPP-001';
    const customerId = 'CUST-001';

    // 2. Generate 10,000 Sales Invoices
    console.log("Generating 10,000 Sales Invoices...");
    await this.measure("BULK_SALES_GENERATION", async () => {
      const sales: Sale[] = Array.from({ length: 10000 }, (_, i) => {
        const date = this.getRandomDateWithin12Months();
        const saleId = db.generateId('SALE');
        return {
          id: saleId,
          SaleID: `S${i}`,
          date: date.toISOString(),
          customerId: customerId,
          partnerId: customerId,
          partnerName: 'Test Customer',
          items: [{ 
            id: `ITEM-${saleId}-1`, 
            parent_id: saleId, 
            product_id: 'P1', 
            name: 'Test', 
            qty: 1, 
            price: 100, 
            sum: 100,
            row_order: 1
          }],
          totalAmount: 100,
          tax: 0,
          finalTotal: 100,
          paymentStatus: 'Paid' as any,
          paidAmount: 100,
          InvoiceStatus: 'POSTED',
          branchId: 'MAIN',
          totalCost: 50,
          Created_By: 'LOAD_TEST',
          Created_At: date.toISOString(),
          lastModified: date.toISOString()
        };
      });
      await db.db.sales.bulkAdd(sales);
    });

    // 3. Generate 8,000 Purchase Invoices
    console.log("Generating 8,000 Purchase Invoices...");
    await this.measure("BULK_PURCHASES_GENERATION", async () => {
      const purchases: Purchase[] = Array.from({ length: 8000 }, (_, i) => {
        const date = this.getRandomDateWithin12Months();
        const purId = db.generateId('PUR');
        return {
          id: purId,
          purchase_id: `P${i}`,
          invoiceId: `INV-${i}`,
          date: date.toISOString(),
          partnerId: supplierId,
          partnerName: 'Test Supplier',
          items: [{ 
            id: `ITEM-${purId}-1`, 
            parent_id: purId, 
            product_id: 'P1', 
            name: 'Test', 
            qty: 10, 
            price: 50, 
            sum: 500,
            row_order: 1
          }],
          totalAmount: 500,
          tax: 0,
          finalAmount: 500,
          status: 'PAID',
          paidAmount: 500,
          invoiceStatus: 'POSTED',
          invoiceType: 'شراء',
          branchId: 'MAIN',
          Created_By: 'LOAD_TEST',
          Created_At: date.toISOString(),
          lastModified: date.toISOString()
        };
      });
      await db.db.purchases.bulkAdd(purchases);
    });

    // 4. Generate 50,000 Stock Movements
    console.log("Generating 50,000 Stock Movements...");
    await this.measure("BULK_STOCK_MOVEMENTS_GENERATION", async () => {
      const movements: InventoryTransaction[] = Array.from({ length: 50000 }, (_, i) => {
        const date = this.getRandomDateWithin12Months();
        const mId = db.generateId('STK');
        return {
          id: mId,
          TransactionID: mId,
          productId: 'P1',
          warehouseId: 'WH-MAIN',
          SourceDocumentType: i % 2 === 0 ? 'PURCHASE' : 'SALE',
          SourceDocumentID: `DOC-${i}`,
          TransactionType: i % 2 === 0 ? 'PURCHASE' : 'SALE',
          QuantityChange: i % 2 === 0 ? 10 : -1,
          before_qty: 100,
          after_qty: i % 2 === 0 ? 110 : 99,
          TransactionDate: date.toISOString(),
          UserID: 'LOAD_TEST',
          Created_By: 'LOAD_TEST',
          Created_At: date.toISOString()
        };
      });
      await db.db.inventoryTransactions.bulkAdd(movements);
    });

    // 5. Generate 6,000 Receipts
    console.log("Generating 6,000 Receipts...");
    await this.measure("BULK_RECEIPTS_GENERATION", async () => {
      const receipts: CashFlow[] = Array.from({ length: 6000 }, (_, i) => {
        const date = this.getRandomDateWithin12Months();
        return {
          id: db.generateId('REC'),
          transaction_id: `REC-LOAD-${i}`,
          date: date.toISOString(),
          type: 'دخل',
          category: 'تحصيل مبيعات',
          name: 'عميل تجربة',
          amount: 100,
          notes: 'سند قبض - Load Test',
          branchId: 'MAIN'
        };
      });
      await db.db.cashFlow.bulkAdd(receipts);
    });

    // 6. Generate 5,000 Payments
    console.log("Generating 5,000 Payments...");
    await this.measure("BULK_PAYMENTS_GENERATION", async () => {
      const payments: CashFlow[] = Array.from({ length: 5000 }, (_, i) => {
        const date = this.getRandomDateWithin12Months();
        return {
          id: db.generateId('PAY'),
          transaction_id: `PAY-LOAD-${i}`,
          date: date.toISOString(),
          type: 'خرج',
          category: 'سداد موردين',
          name: 'مورد تجربة',
          amount: 500,
          notes: 'سند صرف - Load Test',
          branchId: 'MAIN'
        };
      });
      await db.db.cashFlow.bulkAdd(payments);
    });

    const endTime = performance.now();
    await this.logMetric("TOTAL_LOAD_TEST_SIMULATION", Math.round(endTime - startTime));
    console.log("Bulk Data Simulation Completed!");

    // Run Integrity Sweep after bulk operations
    await IntegritySweepService.runSweep();
  }

  private static getRandomDateWithin12Months(): Date {
    const now = new Date();
    const start = new Date();
    start.setFullYear(now.getFullYear() - 1);
    return new Date(start.getTime() + Math.random() * (now.getTime() - start.getTime()));
  }

  /**
   * Runs performance benchmarks on common operations
   */
  static async runPerformanceBenchmarks() {
    console.log("Running Performance Benchmarks...");

    // 1. Archive load time
    await this.measure("ARCHIVE_LOAD_TIME", async () => {
      await db.getSales();
      await db.getPurchases();
    });

    // 2. Invoice open time (simulated by fetching one specific record)
    await this.measure("INVOICE_OPEN_TIME", async () => {
      await db.db.sales.limit(1).toArray();
    });

    // 3. Search response time
    await this.measure("SEARCH_RESPONSE_TIME", async () => {
      await db.db.sales.where('SaleID').startsWith('S100').toArray();
    });

    // 4. Stock recalculation time
    await this.measure("STOCK_RECALCULATION_TIME", async () => {
      const products = await db.getProducts();
      for (const p of products.slice(0, 10)) {
        await db.db.inventoryTransactions.where('productId').equals(p.id).toArray();
      }
    });

    console.log("Performance Benchmarks Completed!");
  }
}
