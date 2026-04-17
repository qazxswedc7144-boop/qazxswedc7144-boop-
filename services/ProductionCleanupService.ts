
import { db } from './database';
import { PostingEngine } from './PostingEngine';
import { useAppStore } from '../store/useAppStore';

export class ProductionCleanupService {
  
  static async clearDemoData() {
    try {
      // ⚠️ WARNING: This is a destructive operation. 
      // It does not handle dependencies, journal entries, or stock movements.
      // Use ProductionCleanupService.runCleanup() for a safe, dependency-aware cleanup.
      await db.db.products.clear();
      await db.db.purchases.clear();
      await db.db.sales.clear();
      
      console.log("✅ تم حذف البيانات التجريبية بنجاح!");
      // alert("تم تصفير النظام من البيانات التجريبية"); // Removed alert as it's not recommended in iframe
    } catch (error) {
      console.error("❌ فشل الحذف:", error);
    }
  }

  static isDemo(record: any): boolean {
    if (!record) return false;
    
    // Identification Rules
    if (record.isDemo === true) return true;
    if (record.Created_By === 'demo') return true;
    
    // Invoice Number starts with TEST-
    if (record.SaleID?.startsWith('TEST-') || record.purchase_id?.startsWith('TEST-') || record.invoiceId?.startsWith('TEST-')) return true;
    
    // Customer/Supplier Name contains "عميل تجريبي" or "مورد تجريبي"
    const name = record.Customer_Name || record.Supplier_Name || record.partnerName || record.Entity_Name || '';
    if (name.includes('عميل تجريبي') || name.includes('مورد تجريبي')) return true;
    
    return false;
  }

  static async runCleanup(): Promise<{ success: boolean; message: string; deletedCount: number }> {
    try {
      console.log("Starting Production Cleanup...");
      
      // Step 1: Maintenance Mode
      PostingEngine.setMaintenanceMode(true);
      
      let deletedCount = 0;

      // Fetch all data
      const sales = await db.db.sales.toArray();
      const purchases = await db.db.purchases.toArray();
      const vouchers = await db.db.cashFlow.toArray();
      const journalEntries = await db.db.journalEntries.toArray();
      const stockMovements = await db.db.inventoryTransactions.toArray();
      const customers = await db.db.customers.toArray();
      const suppliers = await db.db.suppliers.toArray();
      const products = await db.db.products.toArray();

      // Step 2: Unpost all demo invoices
      const demoSales = sales.filter(s => this.isDemo(s));
      const demoPurchases = purchases.filter(p => this.isDemo(p));
      const demoVouchers = vouchers.filter(v => this.isDemo(v));

      console.log(`Unposting ${demoSales.length} sales, ${demoPurchases.length} purchases, ${demoVouchers.length} vouchers...`);

      for (const sale of demoSales) {
        if (sale.InvoiceStatus === 'POSTED') {
          await PostingEngine.unpostSale(sale.id);
        }
      }
      for (const purchase of demoPurchases) {
        if (purchase.invoiceStatus === 'POSTED') {
          await PostingEngine.unpostPurchase(purchase.id);
        }
      }
      for (const voucher of demoVouchers) {
        // Vouchers don't have a status in this schema yet, but unpostVoucher handles reversal if entry exists
        await PostingEngine.unpostVoucher(voucher.transaction_id);
      }

      // Step 3: Delete demo records in order
      
      // 1. Vouchers
      const demoVoucherIds = demoVouchers.map(v => v.transaction_id);
      await db.db.cashFlow.bulkDelete(demoVoucherIds);
      deletedCount += demoVoucherIds.length;

      // 2. Journal Entries (demo only)
      // We also delete reversals created during unposting if they are marked as demo or linked to demo
      const demoJournalIds = journalEntries.filter(e => {
        if (this.isDemo(e)) return true;
        // Also delete if linked to a demo source
        if (demoSales.some(s => s.id === e.sourceId)) return true;
        if (demoPurchases.some(p => p.id === e.sourceId)) return true;
        if (demoVoucherIds.includes(e.sourceId)) return true;
        return false;
      }).map(e => e.id);
      await db.db.journalEntries.bulkDelete(demoJournalIds);
      deletedCount += demoJournalIds.length;

      // 3. Stock Movements (demo only)
      const demoStockIds = stockMovements.filter(m => {
        if (this.isDemo(m)) return true;
        if (demoSales.some(s => s.id === m.SourceDocumentID)) return true;
        if (demoPurchases.some(p => p.id === m.SourceDocumentID)) return true;
        return false;
      }).map(m => m.TransactionID);
      await db.db.inventoryTransactions.bulkDelete(demoStockIds);
      deletedCount += demoStockIds.length;

      // 4. Invoices
      await db.db.sales.bulkDelete(demoSales.map(s => s.id).filter(Boolean) as string[]);
      await db.db.purchases.bulkDelete(demoPurchases.map(p => p.id).filter(Boolean) as string[]);
      deletedCount += demoSales.length + demoPurchases.length;

      // 5. Customers
      const demoCustomerIds = customers.filter(c => this.isDemo(c)).map(c => c.id).filter(Boolean) as string[];
      await db.db.customers.bulkDelete(demoCustomerIds);
      deletedCount += demoCustomerIds.length;

      // 6. Suppliers
      const demoSupplierIds = suppliers.filter(s => this.isDemo(s)).map(s => s.id).filter(Boolean) as string[];
      await db.db.suppliers.bulkDelete(demoSupplierIds);
      deletedCount += demoSupplierIds.length;

      // 7. Products (demo only – only if not linked to real invoices)
      const demoProducts = products.filter(p => this.isDemo(p));
      const realSales = (await db.db.sales.toArray()).filter(s => !this.isDemo(s));
      const realPurchases = (await db.db.purchases.toArray()).filter(p => !this.isDemo(p));
      
      const productsToDelete = demoProducts.filter(p => {
        const linkedToSale = realSales.some(s => s.items.some(it => it.product_id === p.id));
        const linkedToPurchase = realPurchases.some(pur => pur.items.some(it => it.product_id === p.id));
        return !linkedToSale && !linkedToPurchase;
      }).map(p => p.id).filter(Boolean) as string[];
      
      await db.db.products.bulkDelete(productsToDelete);
      deletedCount += productsToDelete.length;

      // Step 4: Integrity Check
      console.log("Running Integrity Checks...");
      
      // 1. Trial Balance
      const accounts = await db.db.accounts.toArray();
      const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
      
      if (Math.abs(totalBalance) > 0.01) {
        throw new Error(`IMBALANCE DETECTED: Trial Balance is ${totalBalance.toFixed(2)}.`);
      }

      // 2. Orphan Check (Journal Entries)
      const remainingEntries = await db.db.journalEntries.toArray();
      const remainingSales = await db.db.sales.toArray();
      const remainingPurchases = await db.db.purchases.toArray();
      const remainingVouchers = await db.db.cashFlow.toArray();

      const orphans = remainingEntries.filter(e => {
        if (e.sourceType === 'SALE' && !remainingSales.some(s => s.id === e.sourceId)) return true;
        if (e.sourceType === 'PURCHASE' && !remainingPurchases.some(p => p.id === e.sourceId)) return true;
        if (e.sourceType === 'VOUCHER' && !remainingVouchers.some(v => v.transaction_id === e.sourceId)) return true;
        return false;
      });

      if (orphans.length > 0) {
        console.warn(`Detected ${orphans.length} orphan journal entries. Cleaning up...`);
        await db.db.journalEntries.bulkDelete(orphans.map(o => o.id));
      }

      // 3. Stock vs Ledger Check
      const remainingProducts = await db.db.products.toArray();
      for (const p of remainingProducts) {
        if (!p.id) continue;
        const movements = await db.db.inventoryTransactions.where('productId').equals(p.id).toArray();
        const calculatedStock = movements.reduce((sum, m) => sum + (m.QuantityChange || 0), 0);
        if (Math.abs(calculatedStock - (p.StockQuantity || 0)) > 0.001) {
          console.warn(`Stock mismatch for ${p.Name}: Ledger=${p.StockQuantity}, Calculated=${calculatedStock}. Fixing...`);
          await db.db.products.update(p.id, { StockQuantity: calculatedStock });
        }
      }

      // Re-enable PostingEngine
      PostingEngine.setMaintenanceMode(false);
      
      // Clear local cache
      await db.init();
      
      // Log cleanup event
      await db.addAuditLog('SYSTEM', 'SYSTEM', 'CLEANUP', `Production cleanup completed. Deleted ${deletedCount} records.`);
      
      return { success: true, message: `تم تنظيف ${deletedCount} سجل بنجاح`, deletedCount };

    } catch (error: any) {
      console.error("Cleanup failed:", error);
      PostingEngine.setMaintenanceMode(false);
      return { success: false, message: error.message || "فشلت عملية التنظيف", deletedCount: 0 };
    }
  }
}
