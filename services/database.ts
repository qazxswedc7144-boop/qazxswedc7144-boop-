
import Dexie, { Table } from 'dexie';
import { generateId, ensureId } from '../utils/id';
import { safeGetById } from '../utils/dexieSafe';
import { 
  Product, Sale, Purchase, Receipt, Payment, CashFlow, AccountingEntry, AuditLogEntry, 
  PendingOperation, Supplier, ValidationRule, AccountingPeriod, 
  InvoiceHistory, InvoiceStatus, InvoiceAdjustment, DailyAuditTask,
  BankTransaction, BankAccount, PaymentGateway, MedicineAlternative,
  MedicineAlert, MedicineBatch, AuditItem, PurchaseRecord,
  Transaction, ItemUnit, User, ItemUsageLog, InvoiceSettlement,
  FinancialTransaction, VoucherInvoiceLink, InvoiceCounter, PriceHistory,
  FinancialAuditEntry, UserRoleEntry, SystemErrorLog,
  PrintTemplate, TemplateAssignment, InventoryTransaction,
  SystemBackup, SyncQueueItem, ConflictArchive,
  FinancialHealthSnapshot, SystemAlert, PerformanceMetric,
  UserBehavior, HistoricalMetric, ProfitHealth, CashLog,
  Warehouse, WarehouseStock, Currency, ExchangeRate, Category,
  InventoryItem, ItemProfitEntry, CustomerProfitEntry, SupplierProfitEntry,
  AccountMovement, PurchaseByItemEntry, ExpiringItemEntry,
  InventoryLayer, FIFOConsumptionLog, StockMovement,
  PeriodLockLog, AIInsight, SecuritySettings, InventoryLog
} from '../types';
import { authService } from './auth.service';
import { ErrorManager } from './errorManager';
import { IS_PREVIEW } from '../constants';
import { InventoryEngine } from '@/core/engines/inventoryEngine';

class PharmaFlowDB extends Dexie {
  private dataVersion = 0;
  private _bypassSecurity = false;
  users!: Table<User, string>;
  userRoles!: Table<UserRoleEntry, string>; 
  products!: Table<Product, string>;
  inventory_logs!: Table<InventoryLog, string>;
  sales!: Table<Sale, string>;
  purchases!: Table<Purchase, string>;
  receipts!: Table<Receipt, string>;
  payments!: Table<Payment, string>;
  invoices!: Table<any, string>;
  invoice_items!: Table<any, string>;
  cashFlow!: Table<CashFlow, string>;
  cash_logs!: Table<CashLog, string>;
  journalEntries!: Table<AccountingEntry, string>;
  journal_entries!: Table<any, string>;
  suppliers!: Table<Supplier, string>;
  customers!: Table<Supplier, string>;
  audit_log!: Table<AuditLogEntry, string>;
  accounts!: Table<any, string>;
  settings!: Table<any, string>;
  validationRules!: Table<ValidationRule, string>;
  invoiceHistory!: Table<InvoiceHistory, number>;
  Invoice_Adjustments!: Table<InvoiceAdjustment, string>;
  partnerLedger!: Table<any, string>;
  pendingOperations!: Table<PendingOperation, string>;
  Accounting_Periods!: Table<AccountingPeriod, string>;
  periodLockLogs!: Table<PeriodLockLog, string>;
  aiInsights!: Table<AIInsight, string>;
  journalRules!: Table<any, string>;
  dailyAuditTask!: Table<DailyAuditTask, string>;
  bankTransactions!: Table<BankTransaction, string>;
  bankAccounts!: Table<BankAccount, string>;
  paymentGateways!: Table<PaymentGateway, string>;
  medicineAlternatives!: Table<MedicineAlternative, string>;
  medicineAlerts!: Table<MedicineAlert, string>;
  medicineBatches!: Table<MedicineBatch, string>;
  snapshots!: Table<any, string>;
  itemUnits!: Table<ItemUnit, string>;
  itemUsageLog!: Table<ItemUsageLog, string>; 
  settlements!: Table<InvoiceSettlement, string>;
  financialTransactions!: Table<FinancialTransaction, string>;
  voucherInvoiceLinks!: Table<VoucherInvoiceLink, string>;
  Invoice_Counters!: Table<InvoiceCounter, string>;
  aiInsights_History!: Table<PriceHistory, string>;
  Audit_Log!: Table<FinancialAuditEntry, string>;
  System_Error_Log!: Table<SystemErrorLog, string>;
  printTemplates!: Table<PrintTemplate, string>;
  templateAssignments!: Table<TemplateAssignment, string>;
  inventoryTransactions!: Table<InventoryTransaction, string>;
  systemBackups!: Table<SystemBackup, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  conflictArchive!: Table<ConflictArchive, string>;
  financialHealthSnapshots!: Table<FinancialHealthSnapshot, string>;
  systemAlerts!: Table<SystemAlert, string>;
  systemPerformanceLog!: Table<PerformanceMetric, string>;
  userBehavior!: Table<UserBehavior, string>;
  historicalMetrics!: Table<HistoricalMetric, string>;
  profitHealth!: Table<ProfitHealth, string>;
  security_settings!: Table<SecuritySettings, string>;
  warehouses!: Table<Warehouse, string>;
  warehouseStock!: Table<WarehouseStock, string>;
  currencies!: Table<Currency, string>;
  exchangeRates!: Table<ExchangeRate, string>;
  stockReservations!: Table<any, string>;
  fifoCostLayers!: Table<any, string>;
  inventory_layers!: Table<InventoryLayer, string>;
  fifo_consumption_log!: Table<FIFOConsumptionLog, string>;
  stock_movements!: Table<StockMovement, string>;
  categories!: Table<Category, string>;
  inventory!: Table<InventoryItem, string>;
  itemProfits!: Table<ItemProfitEntry, string>;
  customerProfits!: Table<CustomerProfitEntry, string>;
  supplierProfits!: Table<SupplierProfitEntry, string>;
  accountMovements!: Table<AccountMovement, string>;
  purchasesByItem!: Table<PurchaseByItemEntry, string>;
  expiringItems!: Table<ExpiringItemEntry, string>;
  journal_lines!: Table<any, string>;

  constructor() {
    super('PharmaFlowDB');
    
    // التحديث لإصدار 67 لإضافة سجلات المخزون (Inventory Logs)
    this.version(67).stores({
      users: 'id, username, User_Email, User_Name, Role, Is_Active',
      userRoles: 'id, User_Email, Role_Type', 
      products: 'id, name, Name, barcode, Is_Active, categoryId, supplierId, isSynced, updatedAt',
      inventory_logs: 'id, productId, type, date',
      sales: 'id, SaleID, date, customerId, InvoiceStatus, hash, deleted_at, [customerId+date], [InvoiceStatus+date], riskLevel, isSynced, updatedAt',
      purchases: 'id, purchase_id, invoiceId, date, partnerId, invoiceStatus, hash, deleted_at, [partnerId+date], [invoiceStatus+date], riskLevel, isSynced, updatedAt',
      receipts: 'id, date, customer_id, tenant_id, isSynced, updatedAt',
      payments: 'id, date, supplier_id, tenant_id, isSynced, updatedAt',
      invoices: 'id, date, customerId, type, invoice_number, created_at, isSynced, updatedAt',
      invoice_items: 'id, invoiceId, productId',
      cashFlow: 'id, transaction_id, date, type, category, [type+date], isSynced, updatedAt',
      journalEntries: 'id, EntryID, date, sourceId, status, hash, [sourceId+status], isSynced, updatedAt',
      journal_entries: 'id, date, sourceId',
      suppliers: 'id, Supplier_ID, Supplier_Name, phone, Is_Active, isSynced, updatedAt',
      customers: 'id, Supplier_ID, Supplier_Name, phone, Is_Active, isSynced, updatedAt',
      journal_lines: 'id, entryId, accountId',
      audit_log: 'id, user_id, action, target_type, target_id, timestamp, [user_id+timestamp]',
      accounts: 'id, name, code, type, parentId',
      settings: 'id, key',
      validationRules: 'id, entityType',
      invoiceHistory: 'id, invoiceId, timestamp',
      Invoice_Adjustments: 'id, AdjustmentID, InvoiceID, Type',
      partnerLedger: 'id, partnerId, date, referenceId, [partnerId+date]',
      pendingOperations: 'id, type, status',
      Accounting_Periods: 'id, Start_Date, End_Date, Is_Locked',
      periodLockLogs: 'id, periodId, user, timestamp',
      aiInsights: 'id, type, severity, timestamp',
      journalRules: 'id',
      dailyAuditTask: 'id, date',
      bankTransactions: 'id, date',
      bankAccounts: 'id',
      paymentGateways: 'id',
      medicineAlternatives: 'id, MedicineID',
      medicineAlerts: 'id, AlertID, ReferenceID',
      medicineBatches: 'id, BatchID, productId, ExpiryDate, warehouseId, [productId+warehouseId]',
      snapshots: 'id, timestamp, type', 
      itemUnits: 'id, Unit_ID, Item_ID, Unit_Name',
      itemUsageLog: 'id, productId, timestamp, type, partnerId, userId, [productId+timestamp]',
      settlements: 'id, voucherId, invoiceId, partnerId, date, [voucherId+invoiceId]',
      financialTransactions: 'id, Transaction_ID, Transaction_Type, Reference_ID, Entity_Name, Transaction_Date, [Reference_ID+Transaction_Type]',
      voucherInvoiceLinks: 'id, linkId, voucherId, invoiceId, Created_At',
      Invoice_Counters: 'id, Counter_Type',
      aiInsights_History: 'id, productId, Item_Name, Customer, Invoice_Date', // Replaced priceHistory
      Audit_Log: 'id, Log_ID, Table_Name, Record_ID, Column_Name, Modified_At, Change_Type',
      System_Error_Log: 'id, Error_ID, Module_Name, Record_ID, User_Email, Timestamp',
      printTemplates: 'id, TemplateID, TemplateName, TemplateType, IsDefaultTemplate',
      templateAssignments: 'id, AssignmentID, TemplateID, DocumentType, BranchID, IsActive',
      inventoryTransactions: 'id, TransactionID, productId, warehouseId, SourceDocumentID, TransactionType, TransactionDate, [productId+TransactionDate]',
      systemBackups: 'id, backupName, backupType, createdAt, status',
      syncQueue: 'id, entityType, entityId, action, syncStatus, localTimestamp',
      conflictArchive: 'id, entityType, entityId, resolvedAt',
      financialHealthSnapshots: 'id, date, score',
      systemAlerts: 'id, type, severity, timestamp, isRead, resolvedStatus, linkedInvoiceId',
      systemPerformanceLog: 'id, operation, timestamp',
      userBehavior: 'id, userId, date',
      historicalMetrics: 'id, month, type',
      profitHealth: 'id, date',
      security_settings: 'id, is_enabled',
      warehouses: 'id, name, isDefault',
      warehouseStock: 'id, warehouseId, productId, [warehouseId+productId]',
      currencies: 'id, code, isBase',
      exchangeRates: 'id, fromCurrency, toCurrency, date',
      stockReservations: 'id, productId, warehouseId, sourceDocId, [warehouseId+productId]',
      fifoCostLayers: 'id, productId, quantityRemaining, purchaseDate, referenceId, isClosed',
      inventory_layers: 'id, productId, remainingQty, item_id, created_at',
      fifo_consumption_log: 'id, sale_id, item_id, layer_id',
      stock_movements: 'id, productId, type, date, item_id, reference_id, created_at',
      categories: 'id, categoryId, categoryName, isSystem',
      inventory: 'id, itemName, category, status, currentQuantity',
      itemProfits: 'id, productId, itemName, totalSales, grossProfit',
      customerProfits: 'id, customerId, customerName, totalProfit',
      supplierProfits: 'id, supplierId, supplierName, totalProfit',
      accountMovements: 'id, movementId, type, date, amount',
      purchasesByItem: 'id, productId, supplierId, purchaseDate',
      expiringItems: 'id, productId, expiryDate, status'
    });

    this.setupOptimizedAuditHooks();
    this.enforceAuditImmutability();
  }

  async init() {
    await this.open();
  }

  private enforceAuditImmutability() {
    this.Audit_Log.hook('updating', () => { 
      if (this._bypassSecurity) return;
      throw new Error("SECURITY_VIOLATION: سجلات التدقيق غير قابلة للتعديل 🛡️"); 
    });
    this.Audit_Log.hook('deleting', () => { 
      if (this._bypassSecurity) return;
      throw new Error("SECURITY_VIOLATION: يمنع حذف سجلات الرقابة النهائية 🔒"); 
    });
  }

  public setBypassSecurity(bypass: boolean) {
    this._bypassSecurity = bypass;
  }

  private setupOptimizedAuditHooks() {
    const SENSITIVE_MAP: Record<string, string> = {
      'UnitPrice': 'Price', 'CostPrice': 'Price', 'price': 'Price',
      'StockQuantity': 'Quantity', 'qty': 'Quantity', 'finalTotal': 'Total_Amount',
      'totalAmount': 'Total_Amount', 'Amount': 'Amount', 'Paid_Amount': 'Paid_Amount',
      'customerId': 'Partner', 'partnerId': 'Partner', 'InvoiceStatus': 'Status',
      'Balance': 'Account_Balance'
    };

    const financialTables = [
      { name: 'Invoices_Sales', table: this.sales, pk: 'SaleID' },
      { name: 'Invoices_Purchases', table: this.purchases, pk: 'invoiceId' },
      { name: 'Items_Inventory', table: this.products, pk: 'id' },
      { name: 'Financial_Transactions', table: this.financialTransactions, pk: 'Transaction_ID' },
      { name: 'Voucher_Invoice_Link', table: this.voucherInvoiceLinks, pk: 'linkId' },
      { name: 'Suppliers', table: this.suppliers, pk: 'Supplier_ID' },
      { name: 'Customers', table: this.customers, pk: 'Supplier_ID' },
      { name: 'Invoices', table: this.invoices, pk: 'id' },
      { name: 'Journal_Entries', table: this.journalEntries, pk: 'EntryID' },
      { name: 'Cash_Flow', table: this.cashFlow, pk: 'transaction_id' },
      { name: 'Accounts', table: this.accounts, pk: 'id' },
      { name: 'Inventory_Transactions', table: this.inventoryTransactions, pk: 'TransactionID' }
    ];

    this.sales.hook('creating', (pk, obj) => {
      this.updatePreCalculatedData('SALE', obj);
    });
    this.purchases.hook('creating', (pk, obj) => {
      this.updatePreCalculatedData('PURCHASE', obj);
    });

    financialTables.forEach(({ name, table, pk }) => {
      table.hook('creating', (primaryKey, obj) => {
        this.incrementDataVersion();
        (obj as any).isSynced = false; // Mark for sync
        (obj as any).updatedAt = Date.now(); // 6. ADD UPDATED TIMESTAMP
        const recordId = String(primaryKey || (obj as any).id || (obj as any)[pk] || 'NEW');
        this.logAuditEntryAsync(name, recordId, 'ALL', 'NULL', 'Record Created', 'ADD');
      });
      table.hook('updating', (mods, obj) => {
        this.incrementDataVersion();
        (mods as any).isSynced = false; // Mark for re-sync
        (mods as any).updatedAt = Date.now(); // 6. ADD UPDATED TIMESTAMP
        const recordId = String((obj as any).id || (obj as any)[pk] || 'UNKNOWN');
        Object.keys(mods).forEach(key => {
          // Audit all changes, but prioritize sensitive fields mapping
          const auditKey = SENSITIVE_MAP[key] || key;
          const oldValue = String((obj as any)[key]);
          const newValue = String((mods as any)[key]);
          
          if (oldValue !== newValue && key !== 'updatedAt' && key !== 'isSynced' && key !== 'lastModified') {
            this.logAuditEntryAsync(name, recordId, auditKey, oldValue, newValue, 'UPDATE');
          }
        });
      });
      table.hook('deleting', (primaryKey, obj) => {
        this.incrementDataVersion();
        const recordId = String(primaryKey || (obj as any).id || (obj as any)[pk] || 'DELETED');
        this.logAuditEntryAsync(name, recordId, 'RECORD', 'Record Deleted', 'DELETED', 'DELETE');
      });
    });
  }

  private logAuditEntryAsync(tableName: string, recordId: string, columnName: string, oldVal: string, newVal: string, changeType: 'ADD' | 'UPDATE' | 'DELETE') {
    setTimeout(async () => {
      try {
        const user = authService.getCurrentUser();
        const now = new Date().toISOString();
        const auditEntry: FinancialAuditEntry = {
          id: generateId('AUD'),
          Log_ID: `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          Table_Name: tableName, Record_ID: recordId, Column_Name: columnName,
          Old_Value: oldVal ? oldVal.substring(0, 1000) : 'NULL', 
          New_Value: newVal ? newVal.substring(0, 1000) : 'NULL',
          Change_Type: changeType, Modified_By: user?.User_Email || 'SYSTEM',
          Modified_At: now, Created_At: now, Last_Updated: now, Device_Info: navigator.userAgent
        };
        await this.Audit_Log.add(auditEntry);
      } catch (e) {}
    }, 0);
  }

  generateId(prefix: string) { return generateId(prefix); }
  getDataVersion() { return this.dataVersion; }
  incrementDataVersion() { this.dataVersion++; }

  private async updatePreCalculatedData(type: 'SALE' | 'PURCHASE', doc: any) {
    setTimeout(async () => {
      try {
        if (type === 'SALE') {
          const sale = doc as Sale;
          // 1. Update Item Profits
          for (const item of sale.items) {
            const profitEntry = await this.itemProfits.get(item.product_id) || {
              id: item.product_id,
              productId: item.product_id,
              itemName: item.name,
              totalSales: 0,
              totalCost: 0,
              grossProfit: 0,
              profitMargin: 0,
              unitsSold: 0,
              period: { start: new Date().toISOString(), end: new Date().toISOString() }
            };
            
            const cost = (sale.totalCost / sale.finalTotal) * item.sum || 0;
            profitEntry.totalSales += item.sum;
            profitEntry.totalCost += cost;
            profitEntry.grossProfit = profitEntry.totalSales - profitEntry.totalCost;
            profitEntry.profitMargin = (profitEntry.grossProfit / profitEntry.totalSales) * 100;
            profitEntry.unitsSold += item.qty;
            profitEntry.lastModified = new Date().toISOString();
            await this.itemProfits.put(profitEntry);
          }

          // 2. Update Customer Profits
          if (sale.customerId) {
            const custProfit = await this.customerProfits.get(sale.customerId) || {
              id: sale.customerId,
              customerId: sale.customerId,
              customerName: sale.customerId, // Should be fetched from customers table
              totalPurchases: 0,
              totalProfit: 0,
              transactionsCount: 0,
              period: { start: new Date().toISOString(), end: new Date().toISOString() }
            };
            custProfit.totalPurchases += sale.finalTotal;
            custProfit.totalProfit += (sale.finalTotal - (sale.totalCost || 0));
            custProfit.transactionsCount += 1;
            custProfit.lastModified = new Date().toISOString();
            await this.customerProfits.put(custProfit);
          }

          // 3. Update Account Movements
          await this.accountMovements.add({
            id: generateId('MOV'),
            movementId: this.generateId('MOV'),
            type: 'income',
            amount: sale.finalTotal,
            description: `بيع فاتورة #${sale.SaleID}`,
            date: sale.date,
            balance: 0, // Should be calculated
            reference: { type: 'SALE', id: sale.id },
            lastModified: new Date().toISOString()
          });
        } else {
          const purchase = doc as Purchase;
          // 1. Update Purchases By Item
          for (const item of purchase.items) {
            await this.purchasesByItem.add({
              id: this.generateId('PBI'),
              purchaseId: purchase.id,
              productId: item.product_id,
              supplierId: purchase.partnerId,
              quantity: item.qty,
              unitCost: item.price,
              totalCost: item.sum,
              purchaseDate: purchase.date,
              invoiceNumber: purchase.invoiceId,
              lastModified: new Date().toISOString()
            });
          }

          // 2. Update Account Movements
          await this.accountMovements.add({
            id: generateId('MOV'),
            movementId: this.generateId('MOV'),
            type: 'expense',
            amount: purchase.totalAmount,
            description: `شراء فاتورة #${purchase.invoiceId}`,
            date: purchase.date,
            balance: 0,
            reference: { type: 'PURCHASE', id: purchase.id },
            lastModified: new Date().toISOString()
          });

          // 3. Update Supplier Profits
          if (purchase.partnerId) {
            const supplierProfit = await this.supplierProfits.get(purchase.partnerId) || {
              id: purchase.partnerId,
              supplierId: purchase.partnerId,
              supplierName: purchase.partnerId,
              period: { start: purchase.date, end: purchase.date },
              totalPurchases: 0,
              totalSales: 0,
              totalSalesFromSupplier: 0,
              grossProfit: 0,
              margin: 0,
              transactionsCount: 0,
              lastModified: new Date().toISOString()
            } as SupplierProfitEntry;
            supplierProfit.totalPurchases += purchase.totalAmount;
            supplierProfit.transactionsCount += 1;
            supplierProfit.lastModified = new Date().toISOString();
            await this.supplierProfits.put(supplierProfit);
          }
        }
      } catch (e) {
        console.error("Pre-calculation error:", e);
      }
    }, 0);
  }

  async isDateLocked(dateStr: string): Promise<boolean> {
    if (!dateStr) return false;
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    const periods = await this.Accounting_Periods.toArray();
    return periods.some((p: AccountingPeriod) => {
      if (!p.Is_Locked) return false;
      const start = new Date(p.Start_Date);
      const end = new Date(p.End_Date);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return checkDate >= start && checkDate <= end;
    });
  }
}

class LocalDatabase {
  public db: PharmaFlowDB; 
  private cache: any = {};
  private version: number = 1;

  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  get products() { return this.db.products; }
  get inventory_logs() { return this.db.inventory_logs; }
  get sales() { return this.db.sales; }
  get purchases() { return this.db.purchases; }
  get receipts() { return this.db.receipts; }
  get payments() { return this.db.payments; }
  get invoices() { return this.db.invoices; }
  get invoice_items() { return this.db.invoice_items; }
  get cashFlow() { return this.db.cashFlow; }
  get cash_flow() { return this.db.cashFlow; }
  get journalEntries() { return this.db.journalEntries; }
  get journal_entries() { return this.db.journal_entries; }
  get suppliers() { return this.db.suppliers; }
  get customers() { return this.db.customers; }
  get inventory() { return this.db.inventory; }
  get medicineBatches() { return this.db.medicineBatches; }
  get medicineAlerts() { return this.db.medicineAlerts; }
  get inventoryTransactions() { return this.db.inventoryTransactions; }
  get warehouseStock() { return this.db.warehouseStock; }
  get settlements() { return this.db.settlements; }
  get stock_movements() { return this.db.stock_movements; }
  get accounts() { return this.db.accounts; }
  get users() { return this.db.users; }
  get Accounting_Periods() { return this.db.Accounting_Periods; }
  get periodLockLogs() { return this.db.periodLockLogs; }
  get security_settings() { return this.db.security_settings; }

  constructor() {
    this.db = new PharmaFlowDB();
    this.initPromise = this.init();
  }

  async init() {
    if (this.initPromise && this.isInitializing) return this.initPromise;
    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        if (!this.db.isOpen()) {
          await this.db.open().catch(async (err) => {
            console.error("Database open failed, attempting recovery:", err);
            if (err.name === 'UpgradeError' || err.name === 'VersionError' || err.name === 'SchemaError') {
              console.warn("Schema conflict detected. Resetting database to prevent primary key conflicts.");
              await Dexie.delete('PharmaFlowDB');
              this.db = new PharmaFlowDB();
              await this.db.open();
            } else {
              throw err;
            }
          });
        }
        await this.refreshCache();
        await this.seedCategories();
        await this.seedJournalRules();
        await this.seedAccounts();
        await this.seedMockData();
        this.version++;
      } catch (e) {
        console.error("Database initialization failed:", e);
      } finally {
        this.isInitializing = false;
      }
    })();
    return this.initPromise;
  }

  async refreshCache() {
    const metaTableNames = ['users', 'suppliers', 'customers', 'accounts', 'journalRules', 'itemUnits', 'paymentGateways', 'categories'];
    for (const name of metaTableNames) {
      try {
        const data = await (this.db as any)[name].toArray() || [];
        this.cache[name] = data;
      } catch (e) {
        console.warn(`Failed to cache table ${name}:`, e);
      }
    }
  }

  async seedMockData() {
    const productsCount = await this.db.products.count();
    if (productsCount > 0) return;

    const mockProducts: Product[] = [
      { 
        id: 'P1', Name: 'بندول إكسترا', 
        categoryId: 'CAT1', UnitPrice: 15, CostPrice: 10, StockQuantity: 100, barcode: '1001',
        DefaultUnit: 'علبة', LastPurchasePrice: 10, TaxDefault: 0, MinLevel: 10, ExpiryDate: '2027-12-31',
        Is_Active: true
      },
      { 
        id: 'P2', Name: 'أوميبرازول 20 ملغ', 
        categoryId: 'CAT1', UnitPrice: 45, CostPrice: 30, StockQuantity: 50, barcode: '1002',
        DefaultUnit: 'علبة', LastPurchasePrice: 30, TaxDefault: 0, MinLevel: 5, ExpiryDate: '2026-06-30',
        Is_Active: true
      },
      { 
        id: 'P3', Name: 'فيتامين سي 1000 ملغ', 
        categoryId: 'CAT2', UnitPrice: 25, CostPrice: 15, StockQuantity: 200, barcode: '1003',
        DefaultUnit: 'علبة', LastPurchasePrice: 15, TaxDefault: 0, MinLevel: 20, ExpiryDate: '2028-01-01',
        Is_Active: true
      },
    ];

    const mockSuppliers: Supplier[] = [
      { id: 'S1', Supplier_ID: 'S1', Supplier_Name: 'شركة الأدوية العالمية', Phone: '0501234567', Balance: 0, openingBalance: 0, Is_Active: true },
      { id: 'S2', Supplier_ID: 'S2', Supplier_Name: 'مستودع الشفاء الطبي', Phone: '0507654321', Balance: 0, openingBalance: 0, Is_Active: true },
    ];

    const mockCustomers: any[] = [
      { id: 'C1', Supplier_ID: 'C1', Supplier_Name: 'عميل نقدي', Phone: '-', Balance: 0, openingBalance: 0, Is_Active: true },
      { id: 'C2', Supplier_ID: 'C2', Supplier_Name: 'أحمد محمد', Phone: '0551122334', Balance: 0, openingBalance: 0, Is_Active: true },
    ];

    await this.db.products.bulkPut(mockProducts);
    await this.db.suppliers.bulkPut(mockSuppliers);
    await this.db.customers.bulkPut(mockCustomers);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const mockSales: Sale[] = [
      { 
        id: 'S-1001', SaleID: 'S-1001', date: today, finalTotal: 150, customerId: 'C1', 
        items: [{ id: 'P1', parent_id: 'S-1001', product_id: 'P1', row_order: 1, name: 'بندول إكسترا', qty: 10, price: 15, sum: 150 }], 
        InvoiceStatus: 'POSTED', paymentStatus: 'Cash', branchId: 'MAIN', totalCost: 100 
      },
      { 
        id: 'S-1002', SaleID: 'S-1002', date: today, finalTotal: 45, customerId: 'C2', 
        items: [{ id: 'P2', parent_id: 'S-1002', product_id: 'P2', row_order: 1, name: 'أوميبرازول 20 ملغ', qty: 1, price: 45, sum: 45 }], 
        InvoiceStatus: 'POSTED', paymentStatus: 'Cash', branchId: 'MAIN', totalCost: 30 
      },
    ];

    await this.db.sales.bulkPut(mockSales);
    await this.refreshCache(); 
  }

  private async seedCategories() {
    const count = await this.db.categories.count();
    if (count === 0) {
      const defaultCategories = [
        "أدوية عامة", "أدوية ثلاجة", "مستلزمات طبية", "أجهزة قياس", "مكملات وفيتامينات", "عناية شخصية",
        "معلبات", "مواد جافة", "مشروبات وسوائل", "مبردات/مجمدات",
        "قرطاسية ومكتبية", "مواد نظافة"
      ];
      const now = new Date().toISOString();
      const entries = defaultCategories.map(name => ({
        id: this.generateId('CAT'),
        categoryId: this.generateId('CAT-ID'),
        categoryName: name,
        createdAt: now,
        isSystem: true
      }));
      await this.db.categories.bulkAdd(entries);
      this.cache.categories = entries;
    }
  }

  private async seedJournalRules() {
    const count = await this.db.journalRules.count();
    if (count > 0) return;

    const { DEFAULT_JOURNAL_RULES } = await import('../config/journalRules');
    const entries = Object.entries(DEFAULT_JOURNAL_RULES).map(([id, rule]) => ({
      id,
      ...rule
    }));
    await this.db.journalRules.bulkAdd(entries);
    this.cache.journalRules = entries;
  }

  private async seedAccounts() {
    const count = await this.db.accounts.count();
    if (count > 0) return;

    const initialAccounts: any[] = [
      { id: 'ACC-101', code: '1101', name: 'الصندوق (نقدي)', type: 'ASSET', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-104', code: '1104', name: 'البنك (تحويلات)', type: 'ASSET', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-103', code: '1103', name: 'ذمم مدينة (عملاء)', type: 'ASSET', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-102', code: '1102', name: 'المخزون السلعي', type: 'ASSET', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-201', code: '2101', name: 'ذمم دائنة (موردين)', type: 'LIABILITY', balance_type: 'CREDIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-401', code: '4101', name: 'إيرادات المبيعات', type: 'REVENUE', balance_type: 'CREDIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-501', code: '5101', name: 'تكلفة البضاعة المباعة', type: 'EXPENSE', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-502', code: '5102', name: 'مصاريف عامة', type: 'EXPENSE', balance_type: 'DEBIT', isSystem: true, isActive: true, balance: 0 },
      { id: 'ACC-210', code: '2110', name: 'ضريبة القيمة المضافة', type: 'LIABILITY', balance_type: 'CREDIT', isSystem: true, isActive: true, balance: 0 },
    ];

    await this.db.accounts.bulkAdd(initialAccounts);
    this.cache.accounts = initialAccounts;
  }

  async ensureOpen() {
    if (this.initPromise) await this.initPromise;
    if (!this.db.isOpen()) {
      try {
        await this.db.open();
      } catch (err: any) {
        if (err.name === 'DatabaseClosedError' || err.name === 'VersionError' || err.name === 'SchemaError') {
          // Force re-open if closed or schema mismatch
          this.db = new PharmaFlowDB();
          await this.db.open();
          await this.refreshCache();
        } else {
          throw err;
        }
      }
    }
  }

  generateId(prefix: string) { return `${prefix}-${Date.now()}-${Math.floor(Math.random()*10000)}`; }
  getVersion() { return this.version; }
  getDataVersion() { return this.db.getDataVersion(); }
  incrementDataVersion() { this.db.incrementDataVersion(); }
  getCurrentBranchId() { return 'MAIN'; }

  async runTransaction<T>(fn: () => Promise<T>, retryCount = 0): Promise<T> {
    if (retryCount > 3) {
      console.error("TRANSACTION_ABORT: Too many retries due to schema mismatch. Running without transaction.");
      return await fn();
    }

    await this.ensureOpen();
    const status = await this.getSetting('SYSTEM_STATUS', 'ACTIVE');
    if (status === 'RECOVERY_MODE') {
      if (IS_PREVIEW) {
        console.warn("PREVIEW GUARD: System is in RECOVERY_MODE, but bypassing for transaction execution.");
      } else {
        throw new Error("النظام في وضع الاستعادة (Recovery Mode). يرجى مراجعة الأخطاء الفادحة أولاً 🛡️");
      }
    }

    try {
      // Use the actual table names from the database to avoid "Object store not found" errors
      // if the schema is partially loaded or in transition.
      let idbdb = (this.db as any).idbdb;
      if (!idbdb || !this.db.isOpen()) {
        await this.ensureOpen();
        idbdb = (this.db as any).idbdb;
      }
      
      let availableTables = idbdb ? Array.from(idbdb.objectStoreNames) as string[] : [];
      
      // If availableTables is still empty, try to open again to be sure
      if (availableTables.length === 0) {
        await this.db.open();
        idbdb = (this.db as any).idbdb;
        availableTables = idbdb ? Array.from(idbdb.objectStoreNames) as string[] : [];
      }

      const tableNames = this.db.tables
        .map(t => t.name)
        .filter(name => availableTables.includes(name));
      
      if (tableNames.length === 0) {
        // If we still have no tables, we can't start a transaction.
        // This might happen if the database is truly empty.
        // In that case, we just run the function without a transaction or throw.
        console.warn("No available tables for transaction. Running function directly.");
        return await fn();
      }
      
      return await this.db.transaction('rw', tableNames as any, async () => { 
        return await fn(); 
      });
    } catch (error: any) {
      if (error.name === 'NotFoundError' || error.message?.includes('object stores was not found')) {
        console.warn(`Transaction failed with NotFoundError (attempt ${retryCount + 1}). Re-syncing schema...`);
        await this.db.close();
        await this.db.open();
        return this.runTransaction(fn, retryCount + 1);
      }

      if (error.name === 'DatabaseClosedError') {
        await this.ensureOpen();
        return this.runTransaction(fn, retryCount);
      }
      console.error("TRANSACTION_FAILURE: Rolling back operations.", error);
      await this.db.systemPerformanceLog.add({
        id: generateId('PERF'),
        operation: 'TRANSACTION_ROLLBACK',
        durationMs: 0,
        timestamp: new Date().toISOString(),
        metadata: { error: String(error) }
      });
      throw error;
    }
  }

  async importFullState(jsonString: string) {
    const data = JSON.parse(jsonString);
    await this.runTransaction(async () => {
      for (const table in data) {
        if ((this.db as any)[table]) {
          await (this.db as any)[table].clear();
          await (this.db as any)[table].bulkPut(data[table]);
        }
      }
    });
    await this.init();
  }

  async getProducts() { await this.ensureOpen(); return await this.db.products.toArray(); }
  async getInventory() { await this.ensureOpen(); return await this.db.inventory.toArray(); }
  async getSales() { 
    await this.ensureOpen();
    const { LoadTestService } = await import('./LoadTestService');
    return await LoadTestService.measure("GET_SALES", async () => {
      return await this.db.sales.orderBy('date').reverse().toArray();
    });
  }
  async getPurchases() { 
    await this.ensureOpen();
    const { LoadTestService } = await import('./LoadTestService');
    return await LoadTestService.measure("GET_PURCHASES", async () => {
      return await this.db.purchases.orderBy('date').reverse().toArray();
    });
  }
  async getJournalEntries() { await this.ensureOpen(); return await this.db.journalEntries.orderBy('date').reverse().toArray(); }
  async getAccountBalance(accountId: string): Promise<number> {
    await this.ensureOpen();
    const account = await this.db.accounts.get(accountId);
    return account?.balance || 0;
  }
  async getCashFlow() { await this.ensureOpen(); return await this.db.cashFlow.toArray(); }
  getSuppliers() { return this.cache.suppliers || []; }
  getCustomers() { return this.cache.customers || []; }
  async getAuditLogs() { await this.ensureOpen(); return await this.db.audit_log.orderBy('timestamp').reverse().limit(300).toArray(); }
  async addInvoiceHistory(h: any) { 
    await this.ensureOpen(); 
    if (!h.id) h.id = generateId('HST');
    await this.db.invoiceHistory.add(h); 
  }
  getJournalRules() { return this.cache.journalRules || []; }
  async getAccountingPeriods() { await this.ensureOpen(); return await this.db.Accounting_Periods.toArray(); }
  async recordCashFlow(entry: CashFlow) { 
    await this.ensureOpen(); 
    if (!entry.id) entry.id = generateId('CSH');
    await this.db.cashFlow.put(entry); 
  }
  async getMedicineAlternatives() { await this.ensureOpen(); return await this.db.medicineAlternatives.toArray(); }
  async clearOldAlerts() { await this.ensureOpen(); await this.db.medicineAlerts.clear(); }
  async getMedicineBatches() { await this.ensureOpen(); return await this.db.medicineBatches.toArray(); }
  getAccounts() { return this.cache.accounts || []; }
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    await this.ensureOpen();
    const s = await this.db.settings.get(key);
    return s ? s.value : defaultValue;
  }
  async saveSetting(key: string, value: any) { 
    await this.ensureOpen(); 
    await this.db.settings.put({ id: key, key, value }); 
  }
  async saveProduct(p: Product) { 
    await this.ensureOpen();
    if (!p.id) p.id = this.generateId('PRD');
    await this.db.products.put(p); 
  }
  async deleteProduct(id: string) { 
    await this.ensureOpen();
    await this.db.products.delete(id); 
  }
  async saveSupplier(s: Supplier) { 
    await this.ensureOpen();
    if (!s.id) s.id = s.Supplier_ID || this.generateId('SUP');
    await this.db.suppliers.put(s); 
    await this.init(); 
  }
  async saveCustomer(c: Supplier) { 
    await this.ensureOpen();
    if (!c.id) c.id = c.Supplier_ID || this.generateId('CUS');
    await this.db.customers.put(c); 
    await this.init(); 
  }
  async addJournalEntry(entry: AccountingEntry) { 
    await this.ensureOpen();
    if (!entry.id) entry.id = this.generateId('ENT');
    
    // 8. PROTECT DATA: Block journal edits if period is locked
    const { PeriodLockEngine } = await import('./PeriodLockEngine');
    await PeriodLockEngine.validateOperation(entry.date, 'تعديل القيود');

    const isLocked = await this.getSetting('JOURNAL_EDIT_LOCKED', 'FALSE');
    if (isLocked === 'TRUE') {
      throw new Error("تعديل القيود المحاسبية معطل حالياً بسبب ارتفاع مستوى المخاطر 🛡️");
    }
    await this.db.journalEntries.put(entry); 
  }
  async getCategories() { await this.ensureOpen(); return await this.db.categories.toArray(); }
  async saveCategory(cat: Category) { 
    await this.ensureOpen(); 
    if (!cat.id) cat.id = this.generateId('CAT');
    await this.db.categories.put(cat); 
    await this.init(); 
  }
  async deleteCategory(id: string) { 
    await this.ensureOpen();
    // Check if linked to products
    const linkedCount = await this.db.products.where('categoryId').equals(id).count();
    if (linkedCount > 0) throw new Error("لا يمكن حذف التصنيف لأنه مرتبط بأصناف موجودة 🔒");
    await this.db.categories.delete(id); 
    await this.init(); 
  }
  
  async addAuditLog(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'CANCEL' | 'SYSTEM' | 'RESTORE' | 'LOGIN' | 'SECURITY' | 'INFO', 
    target_type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'PRODUCT' | 'SYSTEM' | 'OTHER' | 'USER_ACTIVITY', 
    target_id: string, 
    details?: string,
    metadata?: any
  ) {
    const user = authService.getCurrentUser();
    const entry: AuditLogEntry = {
      id: generateId('AUD'),
      user_id: user?.User_Email || 'SYSTEM',
      action: action as any,
      target_type: target_type as any,
      target_id,
      timestamp: new Date().toISOString(),
      details,
      metadata
    } as any;
    await this.db.audit_log.add(entry);
  }
  async isDateLocked(dateStr: string): Promise<boolean> {
    return await this.db.isDateLocked(dateStr);
  }
  async updateSaleNotes(id: string, notes: string) {
    const sale = await this.db.sales.get(id);
    if (sale) {
      sale.notes = notes;
      sale.lastModified = new Date().toISOString();
      await this.db.sales.put(sale);
    }
  }
  async updateSaleAttachment(id: string, attachment: string) {
    const sale = await this.db.sales.get(id);
    if (sale) {
      sale.attachment = attachment;
      sale.lastModified = new Date().toISOString();
      await this.db.sales.put(sale);
    }
  }
  async updatePurchaseNotes(id: string, notes: string) {
    const purchase = await safeGetById(this.db.purchases, id);
    if (purchase) {
      (purchase as any).notes = notes;
      purchase.lastModified = new Date().toISOString();
      await this.db.purchases.put(purchase);
    }
  }
  async updatePurchaseAttachment(id: string, attachment: string) {
    const purchase = await this.db.purchases.get(id);
    if (purchase) {
      (purchase as any).attachment = attachment;
      purchase.lastModified = new Date().toISOString();
      await this.db.purchases.put(purchase);
    }
  }
  async processSale(customerId: string, items: any[], total: number, isReturn: boolean, inv: string, curr: string, status: string, pid?: string, invStatus: InvoiceStatus = 'PENDING', hash?: string, auditScore?: number, riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH', totalSaleCost?: number, attachment?: string) {
    const products = await this.getProducts();
    const user = authService.getCurrentUser();
    const now = new Date().toISOString();
    
    // إذا لم يتم توفير التكلفة (مثلاً من محرك FIFO)، نحسبها بالطريقة التقليدية
    let finalSaleCost = totalSaleCost;
    if (finalSaleCost === undefined || finalSaleCost === null) {
      finalSaleCost = 0;
      items.forEach(item => {
        const p = products.find(prod => prod.id === item.product_id);
        if (p) finalSaleCost! += (p.CostPrice || 0) * item.qty;
      });
    }

    const sale: Sale = {
      id: pid || this.generateId('SALE'), 
      SaleID: inv || this.generateId('INV'), 
      date: now,
      customerId, finalTotal: total, subtotal: total, paymentStatus: status as any,
      paidAmount: status === 'Cash' ? total : 0, branchId: 'MAIN', items, 
      totalCost: finalSaleCost, isReturn, currency: curr, InvoiceStatus: invStatus, tax: 0,
      Created_By: user?.User_Email || 'SYSTEM', Created_At: now, lastModified: now,
      hash, auditScore, riskLevel, attachment
    };
    await this.db.sales.put(sale); 
    
    // Add to unified invoices table for numbering and tracking
    await this.db.invoices.put({
      id: sale.id,
      date: sale.date,
      customerId: sale.customerId,
      type: 'SALE',
      invoice_number: sale.SaleID,
      created_at: now
    });

    await this.addAuditLog(pid ? 'UPDATE' : 'CREATE', 'SALE', sale.id, `Sale ${sale.SaleID} processed with risk ${riskLevel || 'LOW'}`);
    return { sale_id: sale.SaleID, totalSaleCost: finalSaleCost, id: sale.id };
  }
  async processPurchase(supplierId: string, items: any[], total: number, inv: string, isCash: boolean, curr: string = 'USD', invStatus: InvoiceStatus = 'PENDING', type: string = 'شراء', hash?: string, auditScore?: number, riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH', pid?: string, attachment?: string) {
    const user = authService.getCurrentUser();
    const now = new Date().toISOString();
    const purchase: Purchase = {
      id: pid || this.generateId('PUR'), 
      purchase_id: pid || this.generateId('PUR_ID'), 
      invoiceId: inv, 
      date: now,
      partnerId: supplierId, totalAmount: total, finalAmount: total, 
      status: isCash ? 'PAID' : 'UNPAID', paidAmount: isCash ? total : 0, invoiceStatus: invStatus, 
      invoiceType: type as any, currency: curr, branchId: 'MAIN', items, subtotal: total, tax: 0, partnerName: 'Supplier',
      Created_By: user?.User_Email || 'SYSTEM', Created_At: now, lastModified: now,
      hash, auditScore, riskLevel, attachment
    };
    await this.db.purchases.put(purchase); 
    
    // Add to unified invoices table for numbering and tracking
    await this.db.invoices.put({
      id: purchase.id,
      date: purchase.date,
      customerId: purchase.partnerId,
      type: 'PURCHASE',
      invoice_number: purchase.invoiceId,
      created_at: now
    });

    await this.addAuditLog(pid ? 'UPDATE' : 'CREATE', 'PURCHASE', purchase.id, `Purchase ${purchase.invoiceId} processed with risk ${riskLevel || 'LOW'}`);
    return { purchase_id: purchase.id, id: purchase.id };
  }
  async persist(table: string, data: any[]) { 
    if ((this.db as any)[table]) {
      const dataWithIds = data.map(item => {
        if (!item.id) {
          // Try to find a suitable prefix based on table name
          const prefix = table.substring(0, 3).toUpperCase();
          item.id = generateId(prefix);
        }
        return item;
      });
      await (this.db as any)[table].bulkPut(dataWithIds); 
    }
  }
  async saveSettlement(s: InvoiceSettlement) { 
    if (!s.id) s.id = this.generateId('SET');
    await this.db.settlements.put(s); 
  }
  async getPendingOperations() { return await this.db.pendingOperations.toArray(); }
  async getInvoiceHistory(invoiceId: string) { 
    if (!invoiceId) return [];
    return await this.db.invoiceHistory.where('invoiceId').equals(invoiceId).toArray(); 
  }
  async getDailyAuditTask(date?: string) { 
    const targetDate = date || new Date().toISOString().split('T')[0];
    return await this.db.dailyAuditTask.get(targetDate) || { id: targetDate, date: targetDate, completed: false, items: [] }; 
  }
  async saveAuditProgress(items: any[]) {
    const date = new Date().toISOString().split('T')[0];
    await this.db.dailyAuditTask.put({ id: date, date, completed: false, items });
  }

  // --- New Integrated Accounting & Inventory Methods ---

  async getCurrencies() { return await this.db.currencies.toArray(); }
  
  async getInventoryValue() {
    const products = await this.db.products.toArray();
    return products.reduce((sum, p) => {
      const stock = p.StockQuantity || 0;
      const cost = p.avgCost || p.CostPrice || 0;
      return sum + (stock * cost);
    }, 0);
  }

  async saveCurrency(c: Currency) { 
    if (!c.id) c.id = this.generateId('CUR');
    await this.db.currencies.put(c); 
  }
  async deleteCurrency(id: string) { await this.db.currencies.delete(id); }
  
  async getExchangeRates(date?: string) { 
    const targetDate = date || new Date().toISOString().split('T')[0];
    return await this.db.exchangeRates.where('date').equals(targetDate).toArray(); 
  }
  async saveExchangeRate(rate: ExchangeRate) { 
    if (!rate.id) rate.id = this.generateId('EXR');
    await this.db.exchangeRates.put(rate); 
  }

  async updateCustomerBalance(customerId: string, amount: number) {
    const customer = await this.db.customers.get(customerId);
    if (customer) {
      await this.db.customers.update(customerId, {
        Balance: (customer.Balance || 0) + amount
      });
    }
  }

  async updateSupplierBalance(supplierId: string, amount: number) {
    const supplier = await this.db.suppliers.get(supplierId);
    if (supplier) {
      await this.db.suppliers.update(supplierId, {
        Balance: (supplier.Balance || 0) + amount
      });
    }
  }

  async saveAccountingEntry(entry: AccountingEntry) {
    await this.db.journalEntries.put(entry);
  }

  async updateAccountBalance(accountId: string, amount: number) {
    const account = await this.db.accounts.get(accountId);
    if (account) {
      await this.db.accounts.update(accountId, {
        balance: (account.balance || 0) + amount
      });
    }
  }
  async finalizeAudit(items: any[]) {
    const date = new Date().toISOString().split('T')[0];
    await this.db.dailyAuditTask.put({ id: date, date, completed: true, items });
  }
  async getFullState() {
    const tables = (this.db as any).tables.map((t: any) => t.name);
    const state: any = {};
    for (const tableName of tables) {
      state[tableName] = await (this.db as any)[tableName].toArray();
    }
    return state;
  }
  async getValidationRules() { return await this.db.validationRules.toArray(); }
  async saveAccount(account: any) { 
    if (!account.id) account.id = this.generateId('ACC');
    await this.db.accounts.put(account); 
    await this.init(); 
  }
  async deleteAccount(id: string) { await this.db.accounts.delete(id); await this.init(); }
  async updateSyncDate() { await this.saveSetting('last_sync_date', new Date().toISOString()); }
  async updatePendingOperation(op: any) { 
    if (!op.id) op.id = this.generateId('POP');
    await this.db.pendingOperations.put(op); 
  }
  async removePendingOperation(id: string) { await this.db.pendingOperations.delete(id); }
  async addPendingOperation(op: any) { 
    if (!op.id) op.id = this.generateId('POP');
    await this.db.pendingOperations.add(op); 
  }
  async saveBankTransactions(txs: any[]) { 
    txs.forEach(tx => {
      if (!tx.id) tx.id = this.generateId('BTX');
    });
    await this.db.bankTransactions.bulkPut(txs); 
  }
  async getBankAccounts() { return await this.db.bankAccounts.toArray(); }
  async saveBankAccount(acc: any) { 
    if (!acc.id) acc.id = this.generateId('BAC');
    await this.db.bankAccounts.put(acc); 
  }
  getPaymentGateways() { return this.cache.paymentGateways || []; }
  async getBankTransactions() { return await this.db.bankTransactions.toArray(); }
  async savePaymentGateway(gw: any) { 
    if (!gw.id) gw.id = this.generateId('PGW');
    await this.db.paymentGateways.put(gw); 
    await this.init(); 
  }
  async getLatestPartnerLedgerEntry(partnerId: string) {
    if (!partnerId) return undefined;
    return await this.db.partnerLedger.where('partnerId').equals(partnerId).reverse().sortBy('date').then(res => res[0]);
  }
  async getTransactions() {
    const sales = await this.db.sales.toArray();
    const purchases = await this.db.purchases.toArray();
    const txs: any[] = [];
    sales.forEach(s => txs.push({ id: s.id, date: s.date, amount: s.finalTotal, type: 'sale', customer: s.customerId }));
    purchases.forEach(p => txs.push({ id: p.id, date: p.date, amount: p.totalAmount, type: 'purchase', customer: p.partnerId }));
    return txs;
  }
  async addPartnerLedgerEntry(entry: any) { 
    if (!entry.id) entry.id = this.generateId('PLE');
    await this.db.partnerLedger.add(entry); 
  }
  async saveAccountingPeriod(period: any) { 
    if (!period.id) period.id = this.generateId('PER');
    await this.db.Accounting_Periods.put(period); 
  }
  async getProductByBarcode(barcode: string) { 
    if (!barcode) return undefined;
    return await this.db.products.where('barcode').equals(barcode).first(); 
  }
  getItemUnits(productId: string) { return (this.cache.itemUnits || []).filter((u: any) => u.Item_ID === productId); }
  async getMedicineAlerts() { return await this.db.medicineAlerts.toArray(); }
  async saveMedicineAlert(alert: any) { 
    if (!alert.id) alert.id = alert.AlertID || generateId('MAL');
    if (!alert.AlertID) alert.AlertID = alert.id;
    await this.db.medicineAlerts.put(alert); 
  }
  async getInvoiceAdjustments(invoiceId?: string) {
    if (invoiceId) return await this.db.Invoice_Adjustments.where('InvoiceID').equals(invoiceId).toArray();
    return await this.db.Invoice_Adjustments.toArray();
  }
  async saveInvoiceAdjustment(adj: any) { 
    if (!adj.id) adj.id = adj.AdjustmentID || generateId('IAD');
    if (!adj.AdjustmentID) adj.AdjustmentID = adj.id;
    await this.db.Invoice_Adjustments.put(adj); 
  }
  async deleteInvoiceAdjustment(id: string) { await this.db.Invoice_Adjustments.delete(id); }
}

const dbInstance = new LocalDatabase();
export { dbInstance as db };
