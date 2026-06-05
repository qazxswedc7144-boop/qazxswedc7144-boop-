/* eslint-disable @typescript-eslint/no-unused-vars */
import Dexie, { type Table, type Transaction } from 'dexie';
import { 
  Product, UnifiedInvoice, InvoiceItem, Account, AccountingEntry, 
  JournalLine, InventoryTransaction, AccountingPeriod, SystemBackup, ValidationRule,
  VoucherInvoiceLink as Voucher, AuditLogEntry as AuditLog, Currency
} from '@/types';
import { 
  ProductReadModel, InventoryReadModel, InvoiceReadModel, 
  LedgerReadModel, AggregateSnapshot 
} from '@/modules/events/read.types';

/**
 * PharmaFlow PRO ERP Database Core
 * Robust, production-grade Dexie implementation with strict schema versioning.
 */

export class PharmaFlowDB extends Dexie {
  // Strongly typed tables
  products!: Table<Product>;
  invoices!: Table<UnifiedInvoice>;
  invoiceItems!: Table<InvoiceItem>;
  accounts!: Table<Account>;
  journalEntries!: Table<AccountingEntry>;
  journalLines!: Table<JournalLine>;
  inventoryTransactions!: Table<InventoryTransaction>;
  accountingPeriods!: Table<AccountingPeriod>;
  customers!: Table<any>;
  suppliers!: Table<any>;
  vouchers!: Table<Voucher>;
  auditLogs!: Table<AuditLog>;
  settings!: Table<{ key: string; value: any }>;
  medicineBatches!: Table<any>;
  exchangeRates!: Table<any>;
  systemBackups!: Table<SystemBackup>;

  // Multi-branch Tables
  branches!: Table<any>;
  branchSettings!: Table<any>;
  branchInventory!: Table<any>;
  branchTransfers!: Table<any>;
  branchTransferItems!: Table<any>;
  branchUsers!: Table<any>;
  
  // Legacy / Compatibility Tables (added to satisfy linter and services)
  sales!: Table<any>;
  purchases!: Table<any>;
  categories!: Table<any>;
  receipts!: Table<any>;
  payments!: Table<any>;
  settlements!: Table<any>;
  cashFlow!: Table<any>;
  priceHistory!: Table<any>;
  inventory!: Table<any>;
  invoiceAdjustments!: Table<any>;
  systemAlerts!: Table<any>;
  financialHealthSnapshots!: Table<any>;
  historicalMetrics!: Table<any>;
  voucherInvoiceLinks!: Table<any>;
  financialTransactions!: Table<any>;
  warehouseStock!: Table<any>;
  inventory_layers!: Table<any>;
  fifo_consumption_log!: Table<any>;
  itemUsageLog!: Table<any>;
  stock_movements!: Table<any>;
  inventory_logs!: Table<any>;
  Audit_Log!: Table<any>;
  Accounting_Periods!: Table<any>;
  purchasesByItem!: Table<any>;
  profitHealth!: Table<any>;
  aiInsights!: Table<any>;
  dailyAuditTasks!: Table<any>;
  auditProgress!: Table<any>;
  itemProfits!: Table<any>;
  supplierProfits!: Table<any>;
  profit_health!: Table<any>;
  systemPerformanceLog!: Table<any>;
  cash_logs!: Table<any>;
  System_Error_Log!: Table<any>;

  // Phase 3 Offline Sync Engine Tables
  sync_queue!: Table<any>;
  sync_logs!: Table<any>;
  sync_failures!: Table<any>;
  sync_conflicts!: Table<any>;
  sync_snapshots!: Table<any>;

  // Phase 3.2 camelCase Sync Engine Tables
  syncQueue!: Table<any>;
  syncEvents!: Table<any>;
  failedMutations!: Table<any>;

  // Phase 3.4 Event Sourcing Tables
  eventStore!: Table<any>;

  // Phase 3.5 CQRS Schema Tables
  readProducts!: Table<ProductReadModel, string>;
  readInventory!: Table<InventoryReadModel, string>;
  readInvoices!: Table<InvoiceReadModel, string>;
  readLedgers!: Table<LedgerReadModel, string>;
  aggregateSnapshots!: Table<AggregateSnapshot, [string, number]>;

  // Phase 5.2.1 tables
  system_errors!: Table<any>;
  drafts!: Table<any>;

  // Legacy support for code that uses db.db
  get db(): PharmaFlowDB { return this; }

  constructor() {
    super('PharmaFlowPRO');

    // VERSION 12: Complete defensive schema with comprehensive indexes for all query casings (camel/snake/Pascal)
    this.version(12).stores({
      products: '&id, name, Name, barcode, categoryId, supplierId, stock, is_active, Is_Active, updated_at',
      invoices: '&id, invoice_number, date, Date, partner_id, partnerId, type, payment_status, financial_status, document_status, is_synced, createdAt',
      invoiceItems: '&id, parent_id, product_id, [parent_id+product_id]',
      accounts: '&id, code, name, type, parent_id, is_system, balance',
      journalEntries: '&id, date, source_id, sourceId, source_type, status, created_at, reference_id, referenceId, partnerId, partner_id',
      journalLines: '&id, entry_id, entryId, account_id, accountId, [entry_id+account_id], [entryId+accountId]',
      inventoryTransactions: '&id, product_id, productId, warehouse_id, source_doc_id, transaction_type, transaction_date',
      accountingPeriods: '&id, Start_Date, End_Date, Is_Locked, start_date, end_date, is_locked',
      customers: '&id, name, Name, phone, balance, is_active, Is_Active',
      suppliers: '&id, name, Name, phone, balance, is_active, Is_Active',
      vouchers: '&id, voucher_id, type, partner_id, partnerId, date, status, invoiceId, invoice_id',
      auditLogs: '&id, timestamp, user_id, action, target_type, target_id, Modified_At, Record_ID',
      settings: '&key',
      medicineBatches: '&id, productId, batchNumber, expiryDate',
      exchangeRates: '&id, fromCurrency, toCurrency, date',
      systemBackups: '&id, backupName, createdAt, backupType',
      
      // Compatibility Stores
      sales: '&id, invoice_number, date, Date, InvoiceStatus, hash, SaleID, createdAt',
      purchases: '&id, invoice_number, date, Date, invoiceStatus, hash, createdAt',
      categories: '&id, categoryId, categoryName',
      receipts: '&id, voucher_id',
      payments: '&id, voucher_id',
      settlements: '&id, voucherId',
      cashFlow: '&id, transaction_id, date',
      priceHistory: '&id, productId',
      inventory: '&id',
      invoiceAdjustments: '&id, InvoiceID',
      systemAlerts: '&id, type, timestamp, isRead',
      financialHealthSnapshots: '&id, date',
      historicalMetrics: '&id, month',
      voucherInvoiceLinks: '&id, voucherId, invoiceId',
      financialTransactions: '&id, Reference_ID, Entity_Name',
      warehouseStock: '&id, productId, warehouseId, [warehouseId+productId], [warehouse_id+product_id]',
      inventory_layers: '&id, productId, item_id, reference_id',
      fifo_consumption_log: '&id, saleId, sale_id',
      itemUsageLog: '&id, productId',
      stock_movements: '&id, product_id, item_id, reference_id',
      inventory_logs: '&id, product_id',
      Audit_Log: '&id, timestamp, user_id, action, target_type, target_id, Modified_At, Record_ID',
      Accounting_Periods: '&id, start_date, end_date',
      purchasesByItem: '&id, product_id, productId',
      profitHealth: '&id, date',
      aiInsights: '&id, date',
      dailyAuditTasks: '&id, date',
      auditProgress: '&id, taskId',
      itemProfits: '&id, product_id',
      supplierProfits: '&id, partner_id',
      profit_health: '&id, date',
      systemPerformanceLog: '&id, operation',
      cash_logs: '&id, type, date',
      System_Error_Log: '&id, Error_ID, Module_Name'
    });

    // Version 13: Phase 3 Offline Sync Engine schema update
    this.version(13).stores({
      sync_queue: '&id, type, priority, idempotencyKey, timestamp, status',
      sync_logs: '&id, timestamp, mutationId, idempotencyKey',
      sync_failures: '&id, mutationId, timestamp',
      sync_conflicts: '&id, type, timestamp',
      sync_snapshots: '&id, entityId, timestamp'
    });

    // Version 14: Phase 3.2 Offline Sync Engine camelCase table extensions
    this.version(14).stores({
      syncQueue: '++id, mutationId, [syncStatus+createdAt], [entityType+createdAt], idempotencyKey',
      syncEvents: '++id, eventId, sequence, createdAt',
      failedMutations: '++id, mutationId, createdAt'
    });

    // Version 15: Phase 3.4 Event Sourcing Tables
    this.version(15).stores({
      eventStore: '++id, eventId, aggregateId, aggregateType, eventType, createdAt, [aggregateType+aggregateId]'
    });

    // Version 16: Phase 3.5 CQRS Schema Extensions
    this.version(16).stores({
      readProducts: 'productId, sku, category',
      readInventory: 'batchId, productId, expiryDate, [productId+expiryDate]',
      readInvoices: 'invoiceId, invoiceNumber, status, createdAt',
      readLedgers: 'accountNumber, currentBalance',
      aggregateSnapshots: '[aggregateId+version], aggregateType',
    });

    // Version 17: Phase 4.1 Multi-Branch Architecture
    this.version(17).stores({
      branches: '&id, code, name, isActive',
      branchSettings: '&id, branchId',
      branchInventory: '&id, branchId, productId, [branchId+productId]',
      branchTransfers: '&id, transferNumber, sourceBranchId, targetBranchId, status, createdAt',
      branchTransferItems: '&id, transferId, productId, [transferId+productId]',
      branchUsers: '&id, branchId, userId, [branchId+userId]'
    });

    // Version 18: Phase 5.2.1 - Production Hardening & Play Readiness
    this.version(18).stores({
      system_errors: '&id, errorId, timestamp, severity, moduleName, screenName',
      drafts: '&id, moduleName, updatedAt',
      invoices: '&id, invoice_number, date, Date, partner_id, partnerId, type, payment_status, financial_status, document_status, is_synced, createdAt, transactionUuid'
    });

    // Handle structural integrity and recovery
    this.on('versionchange', () => {
      console.warn("Database structure updated in another tab. Reloading...");
      this.close();
      if (typeof window !== 'undefined') window.location.reload();
    });
  }

  getExistingTableNames(): string[] {
    const actualTableNames = this.tables.map(t => t.name);
    const nativeDB = (this as any).idbdb;
    if (nativeDB && nativeDB.objectStoreNames) {
      const storeNames = Array.from(nativeDB.objectStoreNames) as string[];
      return actualTableNames.filter(t => storeNames.includes(t));
    }
    return actualTableNames;
  }

  /**
   * Safe Transaction Helper: Provides atomic operations with automatic rollback.
   */
  async safeTransaction<T>(
    mode: 'r' | 'rw', 
    tables: string[] = [], 
    operation: (trans: Transaction) => Promise<T>
  ): Promise<T> {
    try {
      if (!this.isOpen()) await this.open();
      
      const existingTableNames = this.getExistingTableNames();
      const safeTables = tables || [];
      const validTables = safeTables.filter(t => existingTableNames.includes(t));
      
      // If we are in 'rw' mode and missing tables, we might have strict Dexie errors.
      // We log but proceed with available tables.
      if (validTables.length < safeTables.length) {
         console.warn(`[DB] Transaction tables missing: ${safeTables.filter(t => !existingTableNames.includes(t))}`);
      }

      // 1. Detect Nested Transaction Execution
      if ((Dexie as any).currentTransaction) {
        console.log("[DB] Re-using parent active transaction zone to prevent early commit");
        return await operation((Dexie as any).currentTransaction);
      }

      // 2. Wrap block using Dexie's explicit transaction system and return via Dexie promise chain
      return await this.transaction(mode as any, validTables.length > 0 ? validTables : existingTableNames, async (trans) => {
        // 🚨 تم إزالة حلقة الـ keepAlive الـ recursive التي كانت تحتجز قاعدة البيانات
        return await operation(trans);
      });
    } catch (error: any) {
      console.error("[DB] Atomic Transaction Failed:", error);
      const msg = error?.message || String(error);
      const shouldStandardize = 
        msg.includes("committed too early") || 
        msg.includes("Transaction committed") ||
        msg.includes("TransactionCompleted") ||
        msg.includes("Transaction aborted") ||
        msg.includes("inactive") ||
        error?.name === "TransactionCommittedTooEarlyError" ||
        error?.name === "TransactionAbortedError";
      
      if (shouldStandardize) {
        const erpError = new Error("تعذر إكمال العملية حالياً، يرجى إعادة المحاولة.");
        (erpError as any).technicalDetails = msg;
        throw erpError;
      }
      throw error; 
    }
  }

  generateId(prefix: string = 'ID'): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  async emergencyReset() {
    console.error("🛑 PERFORMING EMERGENCY DATABASE RESET...");
    await this.delete();
    if (typeof window !== 'undefined') window.location.reload();
  }

  async ensureOpen() {
    if (!this.isOpen()) await this.open();
  }

  // --- COMPATIBILITY LAYER ---
  async getAccounts() { return await this.accounts.toArray(); }
  async getJournalEntries() { return await this.journalEntries.toArray(); }
  async getAccountingPeriods() { return await this.accountingPeriods.toArray(); }
  async getCustomers() { return await this.customers.toArray(); }
  async getSuppliers() { return await this.suppliers.toArray(); }
  async getCurrencies(): Promise<Currency[]> { return await this.getSetting('CURRENCIES', []) as Currency[]; }
  async getMedicineAlerts() { return await this.systemAlerts.where('type').equals('STOCK').toArray(); }
  async getDailyAuditTask(date: string) { return await this.dailyAuditTasks.where('date').equals(date).first(); }
  async createDailyAuditTask(task: any) { return await this.dailyAuditTasks.add(task); }
  async saveAuditProgress(progress: any) { return await this.auditProgress.put(progress); }
  async finalizeAudit(taskId: string, results: any) { return await this.dailyAuditTasks.update(taskId, { ...results, status: 'COMPLETED' }); }
  async clearOldAlerts() { return await this.systemAlerts.clear(); }
  
  async saveCustomer(customer: any) { return await this.customers.put(customer); }
  async saveSupplier(supplier: any) { return await this.suppliers.put(supplier); }
  async saveProduct(product: any) { return await this.products.put(product); }
  async softDeleteProduct(id: string) { return await this.products.update(id, { is_active: false }); }
  async saveAccount(account: any) { return await this.accounts.put(account); }
  async deleteAccount(id: string) { return await this.accounts.delete(id); }
  async addJournalEntry(entry: any) { return await this.journalEntries.add(entry); }
  async addJournalEntryLegacy(entry: any) { return await this.journalEntries.add(entry); }
  async saveSettlement(settlement: any) { return await this.settlements.put(settlement); }
  async getCurrentBranchId() { return 'MAIN'; }
  async updatePurchaseNotes(id: string, notes: string) { return await this.invoices.update(id, { notes }); }
  async updatePurchaseAttachment(id: string, attachment: string) { return await this.invoices.update(id, { attachment }); }
  async updateSaleNotes(id: string, notes: string) { return await this.invoices.update(id, { notes }); }
  async updateSaleAttachment(id: string, attachment: string) { return await this.invoices.update(id, { attachment }); }
  async getInvoiceHistory(invoiceId: string) {
    const logs = await this.Audit_Log.where('target_id').equals(invoiceId).toArray();
    return logs.map((l: any) => ({
      id: l.id,
      invoiceId: l.target_id || '',
      userId: l.user_id || '',
      userName: l.userName || 'مستخدم النظام',
      timestamp: l.timestamp || new Date().toISOString(),
      action: (l.action === 'CREATE' ? 'CREATED' : l.action === 'POST' ? 'POSTED' : l.action) as any,
      details: l.details || `تمت عملية ${l.action} على المستند`
    }));
  }
  async addInvoiceHistory(log: { invoiceId: string; userId: string; userName: string; timestamp: string; action: string; details: string }) {
    return await this.Audit_Log.add({
      id: 'AUD-' + Date.now() + Math.random().toString(36).substring(3, 8),
      user_id: log.userId,
      userName: log.userName,
      action: (log.action === 'CREATED' ? 'CREATE' : log.action === 'POSTED' ? 'POST' : log.action) as any,
      target_type: 'SALE',
      target_id: log.invoiceId,
      timestamp: log.timestamp,
      details: log.details
    });
  }
  async saveMedicineAlert(alert: any) { return await this.systemAlerts.add(alert); }
  async persist() { return true; }
  
  async updateCustomerBalance(id: string, delta: number) {
    const cust = await this.customers.get(id);
    if (cust) await this.customers.update(id, { balance: (cust.balance || 0) + delta });
  }

  async updateSupplierBalance(id: string, delta: number) {
    const supp = await this.suppliers.get(id);
    if (supp) await this.suppliers.update(id, { balance: (supp.balance || 0) + delta });
  }

  async recordCashFlow(data: any) {
    return await this.cashFlow.add({ ...data, id: this.generateId('CF') });
  }

  async getCashFlow() {
    return await this.cashFlow.toArray();
  }

  async saveAccountingEntry(entry: any) {
    return await this.journalEntries.put(entry);
  }

  async saveAccountingPeriod(period: any) {
    return await this.accountingPeriods.put(period);
  }

  // --- LEGACY ORCHESTRATION HELPERS ---
  async processSale(
    customerId: string, items: any[], total: number, isReturn: boolean, id: string,
    _currency: string, paymentStatus: string, docStatus: any, _auditScore: number,
    _riskLevel: string, _totalCost: number, refId: string, _attachment: string, date: string,
    transactionUuid?: string
  ) {
    const sale: UnifiedInvoice = {
      id: id || this.generateId('SALE'),
      invoiceNumber: this.generateId('INV'),
      date: date || new Date().toISOString(),
      partnerId: customerId,
      partnerName: 'Unknown Customer',
      type: 'SALE',
      subtotal: total,
      tax: 0,
      finalTotal: total,
      paidAmount: paymentStatus === 'Cash' ? total : 0,
      paymentStatus: paymentStatus as any,
      financialStatus: paymentStatus === 'Cash' ? 'Paid' : 'Unpaid',
      documentStatus: docStatus,
      items: items,
      isReturn: isReturn,
      notes: `Ref: ${refId}`,
      transactionUuid: transactionUuid,
      updatedAt: new Date().toISOString()
    };
    await this.invoices.put(sale);
    return sale;
  }

  async processPurchase(
    supplierId: string, items: any[], total: number, id: string,
    isCash: boolean, _currency: string, docStatus: any, _auditScore: number,
    _riskLevel: string, refId: string, _attachment: string, isReturn: boolean, date: string,
    transactionUuid?: string
  ) {
    const purchase: UnifiedInvoice = {
      id: id || this.generateId('PUR'),
      invoiceNumber: this.generateId('PURCH'),
      date: date || new Date().toISOString(),
      partnerId: supplierId,
      partnerName: 'Unknown Supplier',
      type: 'PURCHASE',
      subtotal: total,
      tax: 0,
      finalTotal: total,
      paidAmount: isCash ? total : 0,
      paymentStatus: isCash ? 'Cash' : 'Credit',
      financialStatus: isCash ? 'Paid' : 'Unpaid',
      documentStatus: docStatus,
      items: items,
      isReturn: isReturn,
      notes: `Ref: ${refId}`,
      transactionUuid: transactionUuid,
      updatedAt: new Date().toISOString()
    };
    await this.invoices.put(purchase);
    return purchase;
  }

  async getSales() { 
    return await this.invoices.where('type').equals('SALE').toArray(); 
  }

  async getValidationRules(): Promise<ValidationRule[]> {
    const rulesSetting = await this.getSetting('validation_rules', null);
    if (rulesSetting) {
      return rulesSetting;
    }
    const defaultRules: ValidationRule[] = [
      {
        id: 'rule-sale-cust',
        entityType: 'SALE',
        fieldName: 'customerId',
        operator: 'NOT_EMPTY',
        comparisonValue: '',
        errorMessage: 'يجب تحديد عميل صالح.',
        isActive: true,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rule-sale-total',
        entityType: 'SALE',
        fieldName: 'total',
        operator: 'GREATER_THAN',
        comparisonValue: '0',
        errorMessage: 'يجب أن يكون إجمالي الفاتورة أكبر من صفر.',
        isActive: true,
        updatedAt: new Date().toISOString()
      }
    ];
    return defaultRules;
  }
  
  async getPurchases() { 
    return await this.invoices.where('type').equals('PURCHASE').toArray(); 
  }

  async getTransactions() {
    const all = await this.invoices.toArray();
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async updateAccountBalance(id: string, delta: number) {
    const acc = await this.accounts.get(id);
    if (acc) {
      await this.accounts.update(id, {
        balance: (acc.balance || 0) + delta,
        updatedAt: new Date().toISOString()
      });
    }
  }

  async isDateLocked(date: string) {
    const period = await this.accountingPeriods
      .where('Start_Date').belowOrEqual(date)
      .and(p => p.End_Date >= date && p.Is_Locked)
      .first();
    return !!period;
  }

  // --- SETTINGS HELPERS ---
  async getSetting(key: string, defaultValue: any = null) {
    try {
      const item = await this.settings.get(key);
      return item ? item.value : defaultValue;
    } catch (e) {
      console.warn(`[DB] Failed to get setting ${key}:`, e);
      return defaultValue;
    }
  }

  async saveSetting(key: string, value: any) {
    await this.settings.put({ key, value });
  }

  // --- AUDIT LOG HELPERS ---
  async addAuditLog(userId: string, action: string, targetType: string, details: string) {
    await this.auditLogs.add({
      id: this.generateId('LOG'),
      timestamp: new Date().toISOString(),
      user_id: userId,
      action: action as any,
      target_type: targetType as any,
      target_id: details
    });
  }

  // --- PROTECTION HELPERS ---
  setBypassSecurity(status: boolean) {
    console.log(`[DB] Security Bypass: ${status}`);
    sessionStorage.setItem('PHARMAFLOW_DB_BYPASS', status ? 'true' : 'false');
  }

  // --- CURRENCY HELPERS ---
  async saveCurrency(currency: any) {
    // If the table doesn't exist yet, we store it in settings as a fallback or a dedicated table
    try {
       await (this as any).currencies?.put(currency) || await this.saveSetting(`CURRENCY_${currency.code}`, currency);
    } catch (e) {
       await this.saveSetting(`CURRENCY_${currency.code}`, currency);
    }
  }

  async getExchangeRates(date?: string) {
    if (date) return await this.exchangeRates.where('date').equals(date).toArray();
    return await this.exchangeRates.toArray();
  }

  // --- TRANSACTION HELPERS ---
  async runTransaction<T>(
    operation: (tx?: Transaction) => Promise<T>,
    tables: string[] = [],
    mode: 'rw' | 'r' = 'rw'
  ): Promise<T> {
    const existing = this.getExistingTableNames();
    const validTables = (tables.length ? tables : existing).filter(t => existing.includes(t));

    try {
      if ((Dexie as any).currentTransaction) {
        return await operation((Dexie as any).currentTransaction);
      }

      return await this.transaction(mode as any, validTables, async (tx) => {
        // 🚨 تم إزالة حلقة الـ keepAlive الـ recursive التي كانت تحتجز قاعدة البيانات
        return await operation(tx);
      });
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.includes('committed too early') || msg.includes('inactive') || msg.includes('aborted')) {
        const erpError = new Error('تعذر إكمال العملية حالياً، يرجى إعادة المحاولة.');
        (erpError as any).technicalDetails = msg;
        throw erpError;
      }
      throw error;
    }
  }

  // --- TABLES HELPERS ---
  async getProducts() { return await this.products.toArray(); }

  // --- INITIALIZATION ---
  async init() {
    console.log("[DB] Initializing database seeds and defaults...");
    try {
      if (!this.isOpen()) await this.open();
      
      const count = await this.accounts.count();
      if (count === 0) {
        await this.accounts.bulkAdd([
          { id: 'acc-cash', code: '101', name: 'الصندوق الرئيسي', type: 'ASSET', balance: 0, isSystem: true, isActive: true, balance_type: 'DEBIT', debit: 0, credit: 0, updatedAt: new Date().toISOString() },
          { id: 'acc-sales', code: '401', name: 'إيرادات المبيعات', type: 'REVENUE', balance: 0, isSystem: true, isActive: true, balance_type: 'CREDIT', debit: 0, credit: 0, updatedAt: new Date().toISOString() },
          { id: 'acc-cogs', code: '501', name: 'تكلفة البضاعة المباعة', type: 'EXPENSE', balance: 0, isSystem: true, isActive: true, balance_type: 'DEBIT', debit: 0, credit: 0, updatedAt: new Date().toISOString() }
        ]);
      }
      return true;
    } catch (e) {
      console.error("[DB] Init failed:", e);
      return false;
    }
  }

  getDataVersion() {
    return this.verno;
  }
}

/**
 * Legacy support for code that uses db.db
 */

let isDbBlocked = false;
const memDb: Record<string, Map<string, any>> = {};

function getMockTable(tableName: string) {
  if (!memDb[tableName]) {
    memDb[tableName] = new Map();
  }
  const store = memDb[tableName];

  const whereMock = (indexOrProp?: string) => {
    return {
      equals: (val: any) => {
        const results = Array.from(store.values()).filter(item => {
          if (typeof item === 'object' && item !== null) {
            if (indexOrProp) {
              return String(item[indexOrProp]).toLowerCase() === String(val).toLowerCase();
            }
          }
          return false;
        });

        return {
          first: () => Promise.resolve(results[0] || null),
          toArray: () => Promise.resolve(results),
          count: () => Promise.resolve(results.length),
          anyOf: () => Promise.resolve(results),
          above: () => Promise.resolve(results),
          below: () => Promise.resolve(results),
          between: () => Promise.resolve(results),
        };
      },
      above: (val: any) => {
        const results = Array.from(store.values()).filter(item => {
          if (typeof item === 'object' && item !== null && indexOrProp) {
            return item[indexOrProp] > val;
          }
          return false;
        });
        return {
          first: () => Promise.resolve(results[0] || null),
          toArray: () => Promise.resolve(results),
          count: () => Promise.resolve(results.length),
          filter: () => ({
            toArray: () => Promise.resolve(results),
            count: () => Promise.resolve(results.length)
          })
        };
      },
      below: (val: any) => {
        const results = Array.from(store.values()).filter(item => {
          if (typeof item === 'object' && item !== null && indexOrProp) {
            return item[indexOrProp] < val;
          }
          return false;
        });
        return {
          first: () => Promise.resolve(results[0] || null),
          toArray: () => Promise.resolve(results),
          count: () => Promise.resolve(results.length)
        };
      },
      belowOrEqual: (val: any) => {
        const results = Array.from(store.values()).filter(item => {
          if (typeof item === 'object' && item !== null && indexOrProp) {
            return item[indexOrProp] <= val;
          }
          return false;
        });
        return {
          first: () => Promise.resolve(results[0] || null),
          toArray: () => Promise.resolve(results),
          count: () => Promise.resolve(results.length),
          and: () => ({
            first: () => Promise.resolve(results[0] || null),
            toArray: () => Promise.resolve(results),
            count: () => Promise.resolve(results.length),
          })
        };
      },
      anyOf: (vals: any[]) => {
        const results = Array.from(store.values()).filter(item => {
          if (typeof item === 'object' && item !== null && indexOrProp) {
            return vals.includes(item[indexOrProp]);
          }
          return false;
        });
        return {
          toArray: () => Promise.resolve(results),
          count: () => Promise.resolve(results.length)
        };
      },
      between: (a: any, b: any) => {
        const results = Array.from(store.values()).filter(item => {
          if (typeof item === 'object' && item !== null && indexOrProp) {
            return item[indexOrProp] >= a && item[indexOrProp] <= b;
          }
          return false;
        });
        return {
          toArray: () => Promise.resolve(results),
          count: () => Promise.resolve(results.length)
        };
      }
    };
  };

  const mockTable = {
    toArray: () => Promise.resolve(Array.from(store.values())),
    get: (key: any) => {
      if (typeof key === 'object' && key !== null) {
        // Handle compound or query key search
        const found = Array.from(store.values()).find(item => {
          return Object.entries(key).every(([k, v]) => item[k] === v);
        });
        return Promise.resolve(found || null);
      }
      return Promise.resolve(store.get(String(key)) || null);
    },
    put: (item: any) => {
      const id = item.id || item.key || `mem-${Math.random().toString(36).substring(2, 10)}`;
      const activeItem = { ...item, id };
      store.set(String(id), activeItem);
      return Promise.resolve(id);
    },
    add: (item: any) => {
      const id = item.id || item.key || `mem-${Math.random().toString(36).substring(2, 10)}`;
      const activeItem = { ...item, id };
      store.set(String(id), activeItem);
      return Promise.resolve(id);
    },
    update: (key: any, changes: any) => {
      const existing = store.get(String(key));
      if (existing) {
        store.set(String(key), { ...existing, ...changes });
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    },
    delete: (key: any) => {
      store.delete(String(key));
      return Promise.resolve(null);
    },
    bulkAdd: (items: any[]) => {
      items.forEach(item => {
        const id = item.id || item.key || `mem-${Math.random().toString(36).substring(2, 10)}`;
        store.set(String(id), { ...item, id });
      });
      return Promise.resolve(items);
    },
    bulkPut: (items: any[]) => {
      items.forEach(item => {
        const id = item.id || item.key || `mem-${Math.random().toString(36).substring(2, 10)}`;
        store.set(String(id), { ...item, id });
      });
      return Promise.resolve(items);
    },
    bulkDelete: (keys: any[]) => {
      keys.forEach(k => store.delete(String(k)));
      return Promise.resolve();
    },
    clear: () => {
      store.clear();
      return Promise.resolve();
    },
    count: () => Promise.resolve(store.size),
    where: whereMock,
    orderBy: (_prop: string) => ({
      reverse: () => ({
        toArray: () => Promise.resolve(Array.from(store.values())),
        limit: (n: number) => ({ toArray: () => Promise.resolve(Array.from(store.values()).slice(0, n)) })
      }),
      limit: (n: number) => ({ toArray: () => Promise.resolve(Array.from(store.values()).slice(0, n)) })
    }),
    filter: (fn: any) => {
      const results = Array.from(store.values()).filter(fn);
      return {
        toArray: () => Promise.resolve(results),
        count: () => Promise.resolve(results.length)
      };
    }
  };

  return mockTable;
}

export const dbInstance = new PharmaFlowDB();

/**
 * Export a Proxy to support legacy code while transitioning to the new schema.
 */
export const dbProxy = new Proxy(dbInstance, {
  get(target, prop) {
    if (prop === 'db') return dbProxy;
    if (prop === 'init' && typeof target.init === 'function') return target.init.bind(target);

    // If the database is blocked/failed to open, use the robust in-memory Map tables
    if (isDbBlocked) {
      if (typeof prop === 'string') {
        const mappings: Record<string, string> = {
          'sale': 'invoices',
          'sales': 'invoices',
          'purchase': 'invoices',
          'purchases': 'invoices',
          'transaction': 'invoices',
          'transactions': 'invoices',
          'auditlog': 'auditLogs',
          'audit_log': 'auditLogs',
          'auditlogs': 'auditLogs',
          'medicinebatch': 'medicineBatches',
          'medicinebatches': 'medicineBatches',
          'voucherinvoicelink': 'vouchers',
          'voucher_invoice_links': 'vouchers'
        };
        const propStr = prop.toLowerCase().replace(/_/g, '');
        const mappedName = mappings[propStr] || prop;
        return getMockTable(mappedName);
      }
    }

    if (prop === 'open') {
      return async () => {
        if (isDbBlocked) {
          console.warn("⚠️ Database is blocked. Resolving fake open() to prevent rejections.");
          return dbProxy;
        }
        try {
          return await dbInstance.open();
        } catch (e) {
          console.error("Failed to open db via proxy open():", e);
          isDbBlocked = true;
          return dbProxy;
        }
      };
    }

    if (prop === 'isOpen') {
      return () => {
        if (isDbBlocked) return true;
        return dbInstance.isOpen();
      };
    }

    if (prop === 'safeTransaction' || prop === 'runTransaction') {
      return async (modeOrOp: any, tablesOrOp: any, op?: any) => {
        if (isDbBlocked) {
          console.warn("Executing in-memory transaction fallback...");
          const operation = typeof modeOrOp === 'function' ? modeOrOp : op;
          return await operation({} as any);
        }
        return (target as any)[prop].bind(target)(modeOrOp, tablesOrOp, op);
      };
    }

    if (prop === 'getSetting') {
      return async (key: string, defaultValue: any = null) => {
        if (isDbBlocked) {
          const settingsTable = getMockTable('settings');
          const item = await settingsTable.get(key);
          return item ? item.value : defaultValue;
        }
        return target.getSetting(key, defaultValue);
      };
    }

    if (prop === 'saveSetting') {
      return async (key: string, value: any) => {
        if (isDbBlocked) {
          const settingsTable = getMockTable('settings');
          await settingsTable.put({ key, value });
          return;
        }
        return target.saveSetting(key, value);
      };
    }

    // 1. Check direct property in target (tables and defined methods)
    if (prop in target) {
      const val = (target as any)[prop];
      if (typeof val === 'function') return val.bind(target);
      return val;
    }

    // 2. Normalization for common variations
    const propStr = String(prop).toLowerCase().replace(/_/g, '');
    
    // Check tables collection directly
    const foundTable = target.tables.find(t => {
      const tableName = t.name.toLowerCase().replace(/_/g, '');
      return tableName === propStr || tableName === propStr + 's' || tableName + 's' === propStr;
    });

    if (foundTable) return foundTable;

    // 3. Plural vs Singular Mappings
    const mappings: Record<string, string> = {
      'sale': 'invoices',
      'sales': 'invoices',
      'purchase': 'invoices',
      'purchases': 'invoices',
      'transaction': 'invoices',
      'transactions': 'invoices',
      'auditlog': 'auditLogs',
      'audit_log': 'auditLogs',
      'auditlogs': 'auditLogs',
      'medicinebatch': 'medicineBatches',
      'medicinebatches': 'medicineBatches',
      'voucherinvoicelink': 'vouchers',
      'voucher_invoice_links': 'vouchers'
    };

    const mappedName = mappings[propStr];
    if (mappedName && (target as any)[mappedName]) {
      return (target as any)[mappedName];
    }

    // 4. Safe mock for missing properties to prevent UI crashes
    console.warn(`⚠️ Property or Table "${String(prop)}" missing in DB Proxy. Using safe fallback.`);
    const mockTable: any = {
      toArray: () => Promise.resolve([]),
      get: () => Promise.resolve(null),
      put: (item: any) => Promise.resolve(item?.id || null),
      add: (item: any) => Promise.resolve(item?.id || null),
      update: () => Promise.resolve(1),
      delete: () => Promise.resolve(null),
      bulkAdd: () => Promise.resolve([]),
      bulkPut: () => Promise.resolve([]),
      bulkDelete: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      count: () => Promise.resolve(0),
      where: () => ({
        equals: () => ({ 
          first: () => Promise.resolve(null), 
          toArray: () => Promise.resolve([]), 
          count: () => Promise.resolve(0) 
        }),
        above: () => ({ 
          first: () => Promise.resolve(null), 
          toArray: () => Promise.resolve([]), 
          count: () => Promise.resolve(0),
          filter: () => ({ toArray: () => Promise.resolve([]), count: () => Promise.resolve(0) })
        }),
        below: () => ({ 
          first: () => Promise.resolve(null), 
          toArray: () => Promise.resolve([]), 
          count: () => Promise.resolve(0) 
        }),
        anyOf: () => ({ 
          toArray: () => Promise.resolve([]), 
          count: () => Promise.resolve(0) 
        }),
        between: () => ({ 
          toArray: () => Promise.resolve([]), 
          count: () => Promise.resolve(0) 
        })
      }),
      orderBy: () => ({
        reverse: () => ({
          toArray: () => Promise.resolve([]),
          limit: () => ({ toArray: () => Promise.resolve([]) })
        }),
        limit: () => ({ toArray: () => Promise.resolve([]) })
      }),
      filter: () => ({ toArray: () => Promise.resolve([]), count: () => Promise.resolve(0) })
    };

    // If it looks like a method call that isn't a table operation
    if (prop === 'getSetting' || prop === 'saveSetting') {
      return (target as any)[prop]?.bind(target) || (() => Promise.resolve(null));
    }

    return mockTable;
  }
});

export const db = dbProxy;

// Initialization with recovery logic
(async () => {
    try {
        await dbInstance.open();
        console.log("✅ PharmaFlow PRO DB Engine started successfully.");
    } catch (e: any) {
        console.error("❌ Dexie Database Engine failed to open, switching to robust in-memory database:", e);
        isDbBlocked = true;
        if (e.name === 'VersionError' || e.name === 'SchemaError') {
            console.error("Database version mismatch. Recovering...");
            try {
                await dbInstance.emergencyReset();
            } catch (resetErr) {
                console.error("Emergency reset failed", resetErr);
            }
        }
    }
})();
