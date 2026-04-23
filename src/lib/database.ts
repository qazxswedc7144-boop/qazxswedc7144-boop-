import Dexie from 'dexie'

/* --------------------------------------------------
   DATABASE INIT
-------------------------------------------------- */

class Database extends Dexie {
  async getSetting(key: string, defaultValue: any = null) {
    try {
      const item = await (this as any).settings.get(key);
      return item ? item.value : defaultValue;
    } catch (e) {
      console.warn(`Failed to get setting ${key}:`, e);
      return defaultValue;
    }
  }

  async saveSetting(key: string, value: any) {
    try {
      await (this as any).settings.put({ key, value });
      return true;
    } catch (e) {
      console.error(`Failed to save setting ${key}:`, e);
      return false;
    }
  }

  async getTransactions() {
    const [sales, purchases, cashFlow] = await Promise.all([
      this.getSales(),
      this.getPurchases(),
      this.getCashFlow()
    ]);

    const mappedSales = sales.map((s: any) => ({
      ...s,
      type: 'sale',
      date: s.date || s.timestamp || s.createdAt,
      amount: s.finalTotal || s.totalAmount || 0
    }));

    const mappedPurchases = purchases.map((p: any) => ({
      ...p,
      type: 'purchase',
      date: p.date || p.timestamp || p.createdAt,
      amount: p.finalAmount || p.totalAmount || 0
    }));

    const mappedCash = cashFlow.map((c: any) => ({
      ...c,
      date: c.date || c.timestamp,
      amount: c.amount || 0
    }));

    return [...mappedSales, ...mappedPurchases, ...mappedCash].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  setBypassSecurity(bypass: boolean) {
    (this as any)._bypassSecurity = bypass;
    console.log(`[Database] Security bypass set to: ${bypass}`);
  }

  async init() {
    try {
      if (!this.isOpen()) {
        await this.open().catch(async (err) => {
          // If the browser fails to upgrade or finds missing stores, wipe and reload
          if (err.name === 'NotFoundError' || err.name === 'SchemaError' || err.message?.includes('objectStore')) {
            console.error("🚨 CRITICAL DATABASE CORRUPTION DETECTED. FORCING RESET...");
            await Dexie.delete("pharmaflow");
            window.location.reload();
          }
          throw err;
        });
      }

      // Final integrity check: ensure minimal tables are present
      const criticalTables = ['products', 'customers', 'suppliers', 'invoices', 'settings'];
      const currentTables = this.tables.map(t => t.name);
      const isMissing = criticalTables.some(t => !currentTables.includes(t));

      if (isMissing) {
        console.error("🚨 MISSING TABLES DETECTED AFTER OPEN. FORCING RESET...");
        await Dexie.delete("pharmaflow");
        window.location.reload();
      }

      return true;
    } catch (e) {
      console.error("Database initialization failed:", e);
      return false;
    }
  }

  async ensureOpen() {
    return await this.init();
  }

  async getProducts() { 
    const table = (this as any).products || (this as any).inventory;
    if (!table) return [];
    return await table.filter((p: any) => !p.deletedAt).toArray(); 
  }
  async getSuppliers() { return (await (this as any).suppliers?.toArray()) || []; }
  async getCustomers() { return (await (this as any).customers?.toArray()) || []; }
  async getInvoices() { 
    const table = (this as any).invoices;
    if (!table) return [];
    try {
      return await table.orderBy('created_at').reverse().toArray();
    } catch(e) {
      return await table.toArray();
    }
  }
  async getSales() { return (await (this as any).sales?.toArray()) || []; }
  async getPurchases() { return (await (this as any).purchases?.toArray()) || []; }
  async getJournalEntries() { return (await (this as any).journalEntries?.toArray()) || []; }
  async getAccounts() { return (await (this as any).accounts?.toArray()) || []; }
  async getCategories() { return (await (this as any).categories?.toArray()) || []; }
  async getCashFlow() { return (await (this as any).cashFlow?.toArray()) || []; }
  async getReceipts() { return (await (this as any).receipts?.toArray()) || []; }
  async getPayments() { return (await (this as any).payments?.toArray()) || []; }
  async getBankAccounts() { return (await (this as any).bankAccounts?.toArray()) || []; }
  async getBankTransactions() { return (await (this as any).bankTransactions?.toArray()) || []; }
  async getPaymentGateways() { return (await (this as any).paymentGateways?.toArray()) || []; }
  async getJournalRules() { return (await (this as any).journalRules?.toArray()) || []; }
  async getAccountingPeriods() { return (await (this as any).accountingPeriods?.toArray()) || []; }
  async getInvoiceAdjustments(invoiceId?: string) { 
    const table = (this as any).invoiceAdjustments;
    if (!table || typeof table.where !== 'function') return [];
    if (invoiceId) return (await table.where('invoiceId').equals(invoiceId).toArray()) || [];
    return (await table.toArray()) || []; 
  }
  async getMedicineAlerts() { 
    const table = (this as any).medicineAlerts;
    return (await table?.toArray()) || []; 
  }
  async getMedicineBatches() { 
    const table = (this as any).medicineBatches;
    return (await table?.toArray()) || []; 
  }
  async getAuditLogs() { 
    const table = (this as any).audit_log || (this as any).Audit_Log;
    return (await table?.toArray()) || []; 
  }
  async getSettings() { return (await (this as any).settings?.toArray()) || []; }
  async getValidationRules() { return (await (this as any).validationRules?.toArray()) || []; }
  async getCurrencies() { return (await (this as any).currencies?.toArray()) || []; }
  async getExchangeRates(date?: string) { return (await (this as any).exchangeRates?.toArray()) || []; }
  async getDailyAuditTask() { 
    const table = (this as any).dailyAuditTasks;
    return table ? await table.get('current') : null; 
  }
  async getInvoiceHistory(id: string) { 
    const table = (this as any).invoiceHistory;
    if (!table || typeof table.where !== 'function') return [];
    return await table.where('invoiceId').equals(id).toArray(); 
  }
  async getAccountBalance(id: string) { 
    const table = (this as any).accounts;
    if (!table) return 0;
    const acc = await table.get(id);
    return acc ? acc.Balance : 0;
  }
  async getLatestPartnerLedgerEntry(partnerId: string) {
    const table = (this as any).journalEntries || (this as any).journal_entries;
    if (!table || typeof table.where !== 'function') return null;
    return await table.where('partnerId').equals(partnerId).reverse().sortBy('date').then((res: any) => res[0]);
  }
  async getBankTransactionsByAccount(bankAccountId: string) {
    const table = (this as any).bankTransactions;
    if (!table || typeof table.where !== 'function') return [];
    return await table.where('bankAccountId').equals(bankAccountId).toArray();
  }

  getCurrentBranchId() { return 'BRANCH-DEFAULT'; }
  getDataVersion() { return 1; }
  getVersion() { return 1; }

  generateId(prefix: string = 'ID'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  async runTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.isOpen()) await this.open();
    
    // Get all defined tables from the schema to ensure they are available in the transaction
    const tableNames = this.tables.map(t => t.name);
    
    if (tableNames.length === 0) {
      console.warn("⚠️ No tables found in database schema during transaction start.");
    }

    return await this.transaction('rw', tableNames, async () => {
      try {
        return await fn();
      } catch (error) {
        console.error("🔥 Transaction failed:", error);
        throw error;
      }
    });
  }

  // Helper methods to satisfy repository expectations
  async saveCustomer(customer: any) { await (this as any).customers.put(customer); }
  async saveSupplier(supplier: any) { await (this as any).suppliers.put(supplier); }
  async saveProduct(product: any) { 
    product.updatedAt = Date.now();
    if (!product.createdAt) product.createdAt = Date.now();
    await (this as any).products.put(product); 
  }

  async softDeleteProduct(id: string) {
    const product = await (this as any).products.get(id);
    if (product) {
      product.deletedAt = Date.now();
      product.updatedAt = Date.now();
      await (this as any).products.put(product);
    }
  }
  async saveCategory(category: any) { await (this as any).categories.put(category); }
  async saveSettlement(settlement: any) { await (this as any).settlements.put(settlement); }
  async saveBankAccount(account: any) { await (this as any).bankAccounts.put(account); }
  async saveBankTransactions(transactions: any[]) { await (this as any).bankTransactions.bulkPut(transactions); }
  async savePaymentGateway(gateway: any) { await (this as any).paymentGateways.put(gateway); }
  async deleteAccount(id: string) { await (this as any).accounts.delete(id); }
  async addJournalEntry(entry: any) { await (this as any).journalEntries.add(entry); }
  async saveAccountingEntry(entry: any) { await (this as any).journalEntries.put(entry); }
  async isDateLocked(date: string) { 
    const periods = await this.getAccountingPeriods();
    return periods.some(p => p.Is_Locked && date >= p.StartDate && date <= p.EndDate);
  }

  async persist(tableName: string, items: any[]) {
    const table = (this as any)[tableName === 'journalEntries' ? 'journalEntries' : tableName];
    if (table) {
      await table.bulkPut(items);
    } else {
      console.warn(`⚠️ Table ${tableName} not found in database for persist.`);
    }
  }

  async addAuditLog(action: string, table: string, id: string, message: string) {
    await (this as any).audit_log.add({
      id: this.generateId('LOG'),
      action,
      table,
      recordId: id,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // Balance updates
  async updateAccountBalance(id: string, delta: number) {
    const acc = await (this as any).accounts.get(id);
    if (acc) {
      acc.Balance = (acc.Balance || 0) + delta;
      acc.lastModified = new Date().toISOString();
      await (this as any).accounts.put(acc);
    }
  }

  async updateCustomerBalance(id: string, delta: number) {
    const cust = await (this as any).customers.get(id);
    if (cust) {
      cust.Balance = (cust.Balance || 0) + delta;
      cust.lastModified = new Date().toISOString();
      await (this as any).customers.put(cust);
    }
  }

  async updateSupplierBalance(id: string, delta: number) {
    const supp = await (this as any).suppliers.get(id);
    if (supp) {
      supp.Balance = (supp.Balance || 0) + delta;
      supp.lastModified = new Date().toISOString();
      await (this as any).suppliers.put(supp);
    }
  }

  async getPendingOperations() {
    try {
      const tables = ["invoices", "products", "customers", "suppliers"];
      let allUnsynced: any[] = [];
      for (const table of tables) {
        const tableInstance = (this as any)[table];
        if (tableInstance) {
          // Fallback to toArray().filter if isSynced is not indexed, 
          // but we will index it in the schema update below.
          const unsynced = await tableInstance.where('isSynced').equals(0).toArray();
          allUnsynced = [...allUnsynced, ...unsynced];
        }
      }
      return allUnsynced;
    } catch (e) {
      console.warn("getPendingOperations failed:", e);
      return [];
    }
  }

  async getActiveInvoicesCount() {
    try {
      const table = (this as any).invoices;
      if (!table || typeof table.where !== 'function') return 0;
      return await table.where('status').equals('active').count();
    } catch (e) {
      return 0;
    }
  }

  constructor() {
    super("pharmaflow");
    
    // Explicitly define tables to avoid NotFoundError
    // Version 16: Add invoiceId to sales and purchases indexing
    this.version(16).stores({
      products: '&id, name, barcode, price, stock, user_id, updated_at, deleted_at, Name, updatedAt, deletedAt, isSynced, category, branchId',
      invoices: 'id, type, createdAt, created_at, isSynced, status, branchId',
      customers: 'id, name, Customer_Name, isSynced, Is_Active',
      suppliers: 'id, name, Supplier_Name, isSynced, Is_Active',
      accounts: 'id, name, type, balance',
      sales: 'id, timestamp, SaleID, customerId, isSynced, date, InvoiceStatus, invoiceId',
      purchases: 'id, timestamp, purchase_id, partnerId, isSynced, date, invoiceStatus, invoiceId',
      receipts: 'id, date, customer_id',
      payments: 'id, date, supplier_id',
      users: 'User_Email, id',
      security_settings: 'id',
      systemBackups: 'id, createdAt',
      journalEntries: 'id, createdAt, sourceId, partnerId, date',
      inventoryTransactions: 'id, timestamp, productId, TransactionDate',
      financialTransactions: 'id, timestamp, Reference_ID',
      voucherInvoiceLinks: 'id, voucherId, invoiceId',
      settlements: 'id, voucherId, invoiceId',
      audit_log: 'id, timestamp, Modified_At, Table_Name, Change_Type',
      settings: 'key',
      medicineBatches: 'id, ExpiryDate',
      categories: 'id, name',
      aiInsights: 'id, timestamp',
      financialHealthSnapshots: 'id, date',
      systemPerformanceLog: 'id, timestamp',
      cashFlow: 'id, date, transaction_id, isSynced',
      bankAccounts: 'id, name',
      bankTransactions: 'id, bankAccountId, date',
      paymentGateways: 'id, isEnabled',
      journalRules: 'id',
      accountingPeriods: 'id, startDate, endDate',
      invoiceAdjustments: 'id, invoiceId',
      medicineAlerts: 'id',
      dailyAuditTasks: 'id',
      invoiceHistory: 'id, invoiceId',
      currencies: 'code',
      exchangeRates: 'id, date',
      validationRules: 'id, entityType',
      warehouseStock: 'id, [warehouseId+productId], warehouseId, productId',
      fifoCostLayers: 'id, productId, purchaseDate',
      itemUsageLog: 'id, productId, timestamp',
      templateAssignments: 'id, EntityType, TemplateID',
      printTemplates: 'id, Name',
      systemAlerts: 'id, timestamp, isRead',
      userBehavior: 'id, userId',
      historicalMetrics: 'id, type, timestamp',
      profitHealth: 'id, date',
      aiInsights_History: 'id, productId',
      Invoice_Counters: 'id',
      System_Error_Log: 'id, timestamp',
      cash_logs: 'id, timestamp',
      inventory_layers: 'id, productId',
      fifo_consumption_log: 'id, productId',
      stock_movements: 'id, item_id',
      inventory_logs: 'id, item_id',
      itemProfits: 'id',
      supplierProfits: 'id',
      purchasesByItem: 'id',
      systemPerformanceMetrics: 'id, timestamp',
      financialAnalysis: 'id, date'
    });
    
    // Handle version changes from other tabs
    this.on('versionchange', () => {
      console.warn("Database version change detected. Closing and reloading.");
      this.close();
      if (typeof window !== 'undefined') window.location.reload();
    });
  }
}

// إنشاء النسخة الأساسية
const dbInstance = new Database();

// Immediate execution script to detect and fix NotFoundError before it propagates
(async () => {
    try {
        await dbInstance.init();
    } catch (e) {
        console.error("🚨 Immediate Database Init Failed. Attempting recovery...");
        await Dexie.delete("pharmaflow");
        window.location.reload();
    }
})();

// إضافة الأسماء المستعارة للجداول لضمان التوافقية مع كافة المحركات
(dbInstance as any).inventory = (dbInstance as any).products;

// البروكسي الآن فقط للتحذير من الحقول المفقودة دون إرجاع قيم null مضللة
export const db = new Proxy(dbInstance, {
  get(target, prop) {
    if (prop in target) {
      const val = (target as any)[prop];
      if (typeof val === 'function' && !target.hasOwnProperty(prop)) {
        return val.bind(target);
      }
      return val;
    }
    
    // Dynamic Table Aliases (Case-insensitive & underscores)
    const tables = target.tables;
    const propStr = String(prop).toLowerCase().replace(/_/g, '');
    
    const foundTable = tables.find(t => {
      const tableName = t.name.toLowerCase().replace(/_/g, '');
      return tableName === propStr;
    });

    if (foundTable) return foundTable;

    console.warn(`⚠️ Property or Method "${String(prop)}" accessed on db but not found.`);
    return undefined;
  }
}) as any;

// Helper to ensure Case-Insensitive access is possible even if table is undefined on instance
(dbInstance as any).journal_entries = db.journalEntries;
(dbInstance as any).inventory_transactions = db.inventoryTransactions;
(dbInstance as any).accounting_periods = db.accountingPeriods;
(dbInstance as any).audit_log = db.audit_log;

// Fix for db.db nested calls failing on exact case matching!
(dbInstance as any).db = db;

/* --------------------------------------------------
   GLOBAL VALIDATOR
-------------------------------------------------- */

export const isValidKey = (val: any) => {
  return val !== undefined && val !== null && val !== ''
}

/* --------------------------------------------------
   SAFE QUERY HELPERS
-------------------------------------------------- */

export const safeFirst = async (table: any, field: string, value: any) => {
  if (!isValidKey(value)) {
    console.warn("⚠️ SKIPPED QUERY:", field, value)
    return null
  }

  return await table.where(field).equals(value).first()
}

/* --------------------------------------------------
   🔥 DEXIE ERROR RADAR (DEBUG)
-------------------------------------------------- */

const patchTable = (table: any, tableName: string) => {
  if (!table || typeof table.where !== 'function') return; 

  const originalWhere = table.where.bind(table)

  table.where = function(field: string) {
    const query = originalWhere(field)
    const originalEquals = query.equals.bind(query)

    query.equals = function(value: any) {
      console.log(`🔍 [${tableName}] WHERE:`, field, value)

      if (!isValidKey(value)) {
        console.error(`❌ INVALID KEY → ${tableName}.${field}`, value)
        throw new Error(`INVALID KEY: ${tableName}.${field}`)
      }

      return originalEquals(value)
    }

    return query
  }
}

/* --------------------------------------------------
   APPLY RADAR TO ALL TABLES
-------------------------------------------------- */

patchTable(db.products, "products")
patchTable(db.customers, "customers")
patchTable(db.suppliers, "suppliers")
patchTable(db.accounts, "accounts")
patchTable(db.invoices, "invoices")
patchTable(db.cashFlow, "cashFlow")
patchTable(db.journalEntries, "journalEntries")
patchTable(db.inventoryTransactions, "inventoryTransactions")
patchTable(db.audit_log, "audit_log")
patchTable(db.warehouseStock, "warehouseStock")

/* --------------------------------------------------
   GLOBAL ERROR TRACKER
-------------------------------------------------- */

window.onerror = function(msg, src, line, col, err) {
  console.error("🔥 ERROR LOCATION:", {
    msg,
    src,
    line,
    col
  })
}

/* --------------------------------------------------
   FINAL
-------------------------------------------------- */

console.log("✅ Database Ready with Protection Layer")
