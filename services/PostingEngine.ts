
import { db } from './database';
import { AccountingEntry, Sale, Purchase, InvoiceItem, InvoiceStatus, InventoryTransaction } from '../types';
import { AccountingEngine } from './AccountingEngine';
import { InventoryService } from './InventoryService';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { AccountRepository } from '../repositories/account.repository';
import { integrityVerifier } from './integrityVerifier';
import { PeriodLockEngine } from './PeriodLockEngine';

export class PostingEngine {
  private static isMaintenanceMode = false;

  static setMaintenanceMode(status: boolean) {
    this.isMaintenanceMode = status;
  }
  
  static async postSale(saleId: string): Promise<void> {
    if (this.isMaintenanceMode) throw new Error("PostingEngine is in maintenance mode");
    
    const sale = await InvoiceRepository.getSaleById(saleId);
    if (!sale) throw new Error("Sale not found");
    if (sale.InvoiceStatus === 'POSTED') return;

    // 4. Accounting Period Lock Check
    await PeriodLockEngine.validateOperation(sale.date, 'ترحيل');

    // Ensure accounts are seeded
    await AccountingEngine.seedAccounts();

    const userId = sale.Created_By || 'SYSTEM';
    const warehouseId = 'WH-MAIN'; // Default for now

    // 1. Record Inventory Movements (FIFO)
    for (const item of sale.items) {
      await InventoryService.recordMovement({
        type: 'SALE',
        productId: item.product_id,
        warehouseId,
        quantity: -item.qty,
        sourceDocId: saleId,
        sourceDocType: 'SALE',
        userId
      });
    }

    // 2. Generate Accounting Entry
    const entry = await AccountingEngine.generateSalesEntry(sale, sale.items);
    const signedEntry = await integrityVerifier.signEntry(entry);
    await db.saveAccountingEntry(signedEntry);

    // 3. Update Account Balances
    for (const line of signedEntry.lines) {
      await db.updateAccountBalance(line.accountId, line.debit - line.credit);
    }

    // 4. Update Customer Balance
    await db.updateCustomerBalance(sale.customerId, sale.finalTotal);

    // 5. Update Sale Status
    await db.db.sales.update(saleId, { 
      InvoiceStatus: 'POSTED',
      isArchived: true,
      lastPostedAt: new Date().toISOString()
    });

    // 6. Validate Trial Balance
    await this.validateTrialBalance();
  }

  static async unpostSale(saleId: string): Promise<void> {
    const sale = await InvoiceRepository.getSaleById(saleId);
    if (!sale || sale.InvoiceStatus !== 'POSTED') return;

    // 4. Accounting Period Lock Check
    await PeriodLockEngine.validateOperation(sale.date, 'إلغاء ترحيل');

    const userId = 'SYSTEM';
    const warehouseId = 'WH-MAIN';

    // 1. Reverse Inventory Movements
    for (const item of sale.items) {
      await InventoryService.recordMovement({
        type: 'ADJUSTMENT',
        productId: item.product_id,
        warehouseId,
        quantity: item.qty,
        sourceDocId: saleId,
        sourceDocType: 'SALE',
        userId,
        notes: `REVERSAL of Sale #${saleId}`
      });
    }

    // 2. Reverse Accounting Entry
    const entries = await db.getJournalEntries();
    const originalEntry = entries.find(e => e.sourceId === saleId && e.sourceType === 'SALE');
    if (originalEntry) {
      const reversal = this.createReversalEntry(originalEntry, saleId, 'SALE');
      await db.saveAccountingEntry(await integrityVerifier.signEntry(reversal));
      
      for (const line of reversal.lines) {
        await db.updateAccountBalance(line.accountId, line.debit - line.credit);
      }
    }

    // 3. Reverse Customer Balance
    await db.updateCustomerBalance(sale.customerId, -sale.finalTotal);

    // 4. Update Sale Status
    await db.db.sales.update(saleId, { InvoiceStatus: 'DRAFT_EDIT' });
  }

  static async postPurchase(purchaseId: string): Promise<void> {
    if (this.isMaintenanceMode) throw new Error("PostingEngine is in maintenance mode");
    
    // Ensure accounts are seeded
    await AccountingEngine.seedAccounts();

    const purchase = await InvoiceRepository.getPurchaseById(purchaseId);
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.invoiceStatus === 'POSTED') return;

    // 4. Accounting Period Lock Check
    await PeriodLockEngine.validateOperation(purchase.date, 'ترحيل');

    const userId = purchase.Created_By || 'SYSTEM';
    const warehouseId = 'WH-MAIN';

    // 1. Record Inventory Movements
    for (const item of purchase.items) {
      await InventoryService.recordMovement({
        type: 'PURCHASE',
        productId: item.product_id,
        warehouseId,
        quantity: item.qty,
        sourceDocId: purchaseId,
        sourceDocType: 'PURCHASE',
        userId
      });
    }

    // 2. Generate Accounting Entry
    const entry = await AccountingEngine.generatePurchaseEntry(purchase);
    await db.saveAccountingEntry(await integrityVerifier.signEntry(entry));

    // 3. Update Account Balances
    for (const line of entry.lines) {
      await db.updateAccountBalance(line.accountId, line.debit - line.credit);
    }

    // 4. Update Supplier Balance
    await db.updateSupplierBalance(purchase.partnerId, purchase.totalAmount);

    // 5. Update Purchase Status
    await db.db.purchases.update(purchaseId, { 
      invoiceStatus: 'POSTED',
      isArchived: true,
      lastPostedAt: new Date().toISOString()
    });

    await this.validateTrialBalance();
  }

  static async unpostPurchase(purchaseId: string): Promise<void> {
    const purchase = await InvoiceRepository.getPurchaseById(purchaseId);
    if (!purchase || purchase.invoiceStatus !== 'POSTED') return;

    // 4. Accounting Period Lock Check
    await PeriodLockEngine.validateOperation(purchase.date, 'إلغاء ترحيل');

    const userId = 'SYSTEM';
    const warehouseId = 'WH-MAIN';

    // 1. Reverse Inventory
    for (const item of purchase.items) {
      await InventoryService.recordMovement({
        type: 'ADJUSTMENT',
        productId: item.product_id,
        warehouseId,
        quantity: -item.qty,
        sourceDocId: purchaseId,
        sourceDocType: 'PURCHASE',
        userId,
        notes: `REVERSAL of Purchase #${purchaseId}`
      });
    }

    // 2. Reverse Accounting
    const entries = await db.getJournalEntries();
    const originalEntry = entries.find(e => e.sourceId === purchaseId && e.sourceType === 'PURCHASE');
    if (originalEntry) {
      const reversal = this.createReversalEntry(originalEntry, purchaseId, 'PURCHASE');
      await db.saveAccountingEntry(await integrityVerifier.signEntry(reversal));
      
      for (const line of reversal.lines) {
        await db.updateAccountBalance(line.accountId, line.debit - line.credit);
      }
    }

    // 3. Reverse Supplier Balance
    await db.updateSupplierBalance(purchase.partnerId, -purchase.totalAmount);

    // 4. Update Status
    await db.db.purchases.update(purchaseId, { invoiceStatus: 'DRAFT_EDIT' });
  }

  static async postVoucher(voucherId: string): Promise<void> {
    if (this.isMaintenanceMode) throw new Error("PostingEngine is in maintenance mode");
    
    // Ensure accounts are seeded
    await AccountingEngine.seedAccounts();

    const voucher = await db.db.cashFlow.get(voucherId);
    if (!voucher) throw new Error("Voucher not found");
    
    // 4. Accounting Period Lock Check
    await PeriodLockEngine.validateOperation(voucher.date, 'ترحيل');
    
    // Logic to generate accounting entry for voucher
    const entry = await AccountingEngine.generateVoucherEntry({
      type: voucher.type === 'دخل' ? 'RECEIPT' : 'PAYMENT',
      amount: voucher.amount,
      partnerId: voucher.name, // Assuming name is the partner name/id for now
      date: voucher.date,
      refId: voucherId,
      notes: voucher.notes
    });

    await db.saveAccountingEntry(await integrityVerifier.signEntry(entry));

    for (const line of entry.lines) {
      await db.updateAccountBalance(line.accountId, line.debit - line.credit);
    }

    await this.validateTrialBalance();
  }

  static async unpostVoucher(voucherId: string): Promise<void> {
    const entries = await db.getJournalEntries();
    const originalEntry = entries.find(e => e.sourceId === voucherId && e.sourceType === 'VOUCHER');
    if (originalEntry) {
      const reversal = this.createReversalEntry(originalEntry, voucherId, 'VOUCHER');
      await db.saveAccountingEntry(await integrityVerifier.signEntry(reversal));
      
      for (const line of reversal.lines) {
        await db.updateAccountBalance(line.accountId, line.debit - line.credit);
      }
    }
  }

  static async repostSale(saleId: string): Promise<void> {
    await this.unpostSale(saleId);
    await this.postSale(saleId);
  }

  static async repostPurchase(purchaseId: string): Promise<void> {
    await this.unpostPurchase(purchaseId);
    await this.postPurchase(purchaseId);
  }

  private static createReversalEntry(entry: AccountingEntry, sourceId: string, sourceType: string): AccountingEntry {
    return {
      id: db.generateId('REV'),
      date: new Date().toISOString(),
      description: `عكس قيد ${entry.id} للمستند #${sourceId}`,
      TotalAmount: entry.TotalAmount,
      status: 'Posted',
      sourceId,
      sourceType: 'AUTO_REVERSAL',
      lines: entry.lines.map(l => ({
        ...l,
        lineId: db.generateId('JL'),
        debit: l.credit,
        credit: l.debit,
        type: l.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
      })),
      lastModified: new Date().toISOString()
    };
  }

  private static async validateTrialBalance(): Promise<void> {
    const accounts = await db.db.accounts.toArray();
    let totalBalance = 0;
    for (const acc of accounts) {
      totalBalance += (acc.balance || 0);
    }
    if (Math.abs(totalBalance) > 0.01) {
      console.error("ACCOUNTING IMBALANCE DETECTED: Trial Balance is not zero!", totalBalance);
      // In a strict system, we might throw here, but for now we log.
    }
  }
}
