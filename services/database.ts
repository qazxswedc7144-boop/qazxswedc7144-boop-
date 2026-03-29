
import Dexie, { Table } from 'dexie';
import { 
  Product, Sale, Purchase, CashFlow, AccountingEntry, AuditLogEntry, 
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
  UserBehavior, HistoricalMetric, ProfitHealth,
  Warehouse, WarehouseStock, Currency, ExchangeRate, Category,
  InventoryItem, ItemProfitEntry, CustomerProfitEntry, SupplierProfitEntry,
  AccountMovement, PurchaseByItemEntry, ExpiringItemEntry,
  PeriodLockLog, AIInsight
} from '../types';
import { authService } from './auth.service';
import { ErrorManager } from './errorManager';
import { SyncService } from './SyncService';

import { IS_PREVIEW } from '../constants';

class PharmaFlowDB extends Dexie {
  private dataVersion = 0;
  users!: Table<User, string>;
  userRoles!: Table<UserRoleEntry, string>; 
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;
  purchases!: Table<Purchase, string>;
  cashFlow!: Table<CashFlow, string>;
  journalEntries!: Table<AccountingEntry, string>;
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
  userBehavior!: Table<UserBehavior, [string, string]>;
  historicalMetrics!: Table<HistoricalMetric, string>;
  profitHealth!: Table<ProfitHealth, string>;
  warehouses!: Table<Warehouse, string>;
  warehouseStock!: Table<WarehouseStock, string>;
  currencies!: Table<Currency, string>;
  exchangeRates!: Table<ExchangeRate, string>;
  stockReservations!: Table<any, string>;
  fifoCostLayers!: Table<any, string>;
  categories!: Table<Category, string>;
  inventory!: Table<InventoryItem, string>;
  itemProfits!: Table<ItemProfitEntry, string>;
  customerProfits!: Table<CustomerProfitEntry, string>;
  supplierProfits!: Table<SupplierProfitEntry, string>;
  accountMovements!: Table<AccountMovement, string>;
  purchasesByItem!: Table<PurchaseByItemEntry, string>;
  expiringItems!: Table<ExpiringItemEntry, string>;

  constructor() {
    super('PharmaFlowDB');
    
    // التحديث لإصدار 56 لدعم محرك FIFO وAI Insights
    this.version(56).stores({
      users: 'User_Email, User_Name, Role, Is_Active',
      userRoles: 'User_Email, Role_Type', 
      products: 'id, ProductID, Name, barcode, Is_Active, categoryId, supplierId',
      sales: 'id, SaleID, date, customerId, InvoiceStatus, hash, deleted_at, [customerId+date], [InvoiceStatus+date], riskLevel',
      purchases: 'id, purchase_id, invoiceId, date, partnerId, invoiceStatus, hash, deleted_at, [partnerId+date], [invoiceStatus+date], riskLevel',
      cashFlow: 'transaction_id, date, type, category, [type+date]',
      journalEntries: 'id, EntryID, date, sourceId, status, hash, [sourceId+status]',
      suppliers: 'id, Supplier_ID, Supplier_Name, phone, Is_Active',
      customers: 'id, Supplier_ID, Supplier_Name, phone, Is_Active',
      audit_log: 'id, user_id, action, target_type, target_id, timestamp, [user_id+timestamp]',
      accounts: 'id, code, name, type, parentId',
      settings: 'key',
      validationRules: 'id, entityType',
      invoiceHistory: '++id, invoiceId, timestamp',
      Invoice_Adjustments: 'AdjustmentID, InvoiceID, Type',
      partnerLedger: 'id, partnerId, date, referenceId, [partnerId+date]',
      pendingOperations: 'id, type, status',
      Accounting_Periods: 'id, Start_Date, End_Date, Is_Locked',
      periodLockLogs: 'id, periodId, user, timestamp',
      aiInsights: 'id, type, severity, timestamp',
      journalRules: 'id',
      dailyAuditTask: 'date',
      bankTransactions: 'id, date',
      bankAccounts: 'id',
      paymentGateways: 'id',
      medicineAlternatives: 'id, MedicineID',
      medicineAlerts: 'AlertID, ReferenceID',
      medicineBatches: 'BatchID, ProductID, ExpiryDate, warehouseId, [ProductID+warehouseId]',
      snapshots: 'id, timestamp, type', 
      itemUnits: 'Unit_ID, Item_ID, Unit_Name',
      itemUsageLog: 'id, productId, timestamp, type, partnerId, userId, [productId+timestamp]',
      settlements: 'id, voucherId, invoiceId, partnerId, date, [voucherId+invoiceId]',
      financialTransactions: 'Transaction_ID, Transaction_Type, Reference_ID, Entity_Name, Transaction_Date, [Reference_ID+Transaction_Type]',
      voucherInvoiceLinks: 'linkId, voucherId, invoiceId, Created_At',
      Invoice_Counters: 'Counter_Type',
      aiInsights_History: 'id, productId, Item_Name, Customer, Invoice_Date', // Replaced priceHistory
      Audit_Log: 'Log_ID, Table_Name, Record_ID, Column_Name, Modified_At',
      System_Error_Log: 'Error_ID, Module_Name, Record_ID, User_Email, Timestamp',
      printTemplates: 'TemplateID, TemplateName, TemplateType, IsDefaultTemplate',
      templateAssignments: 'AssignmentID, TemplateID, DocumentType, BranchID, IsActive',
      inventoryTransactions: 'TransactionID, ItemID, SourceDocumentID, TransactionType, TransactionDate, [ItemID+TransactionDate]',
      systemBackups: 'id, backupName, backupType, createdAt, status',
      syncQueue: 'id, entityType, entityId, action, syncStatus, localTimestamp',
      conflictArchive: 'id, entityType, entityId, resolvedAt',
      financialHealthSnapshots: 'id, date, score',
      systemAlerts: 'id, type, severity, timestamp, isRead, resolvedStatus, linkedInvoiceId',
      systemPerformanceLog: 'id, operation, timestamp',
      userBehavior: '[userId+date], userId, date',
      historicalMetrics: 'id, month, type',
      profitHealth: 'id, date',
      warehouses: 'id, name, isDefault',
      warehouseStock: 'id, warehouseId, productId, [warehouseId+productId]',
      currencies: 'id, code, isBase',
      exchangeRates: 'id, fromCurrency, toCurrency, date',
      stockReservations: 'id, productId, warehouseId, sourceDocId, [warehouseId+productId]',
      fifoCostLayers: 'id, productId, quantityRemaining, purchaseDate, referenceId, isClosed',
      categories: 'id, categoryId, categoryName, isSystem',
      inventory: 'itemId, itemName, category, status, currentQuantity',
      itemProfits: 'id, itemId, itemName, totalSales, grossProfit',
      customerProfits: 'id, customerId, customerName, totalProfit',
      supplierProfits: 'id, supplierId, supplierName, totalProfit',
      accountMovements: 'movementId, type, date, amount',
      purchasesByItem: 'id, itemId, supplierId, purchaseDate',
      expiringItems: 'id, itemId, expiryDate, status'
    });

    this.setupOptimizedAuditHooks();
    this.enforceAuditImmutability();
  }

  public setupSyncHooks() {
    const syncableTables = [
      { name: 'PRODUCT', table: this.products, pk: 'id' },
      { name: 'SALE', table: this.sales, pk: 'id' },
      { name: 'PURCHASE', table: this.purchases, pk: 'id' },
      { name: 'CASH_FLOW', table: this.cashFlow, pk: 'transaction_id' },
      { name: 'JOURNAL_ENTRY', table: this.journalEntries, pk: 'id' },
      { name: 'SUPPLIER', table: this.suppliers, pk: 'id' },
      { name: 'CUSTOMER', table: this.customers, pk: 'id' },
      { name: 'ACCOUNT', table: this.accounts, pk: 'id' },
      { name: 'SETTLEMENT', table: this.settlements, pk: 'id' }
    ];

    syncableTables.forEach(({ name, table, pk }) => {
      table.hook('creating', (primaryKey, obj) => {
        import('./SyncService').then(({ SyncService }) => {
          SyncService.queueSync(name, String(primaryKey || (obj as any)[pk]), 'CREATE', obj);
        });
      });
      table.hook('updating', (mods, obj) => {
        const updatedObj = { ...(obj as any), ...(mods as any) };
        import('./SyncService').then(({ SyncService }) => {
          SyncService.queueSync(name, String((obj as any)[pk]), 'UPDATE', updatedObj);
        });
      });
      table.hook('deleting', (primaryKey, obj) => {
        this.incrementDataVersion();
        import('./SyncService').then(({ SyncService }) => {
          SyncService.queueSync(name, String(primaryKey || (obj as any)[pk]), 'DELETE', { id: primaryKey });
        });
      });
    });
  }

  private enforceAuditImmutability() {
    this.Audit_Log.hook('updating', () => { throw new Error("SECURITY_VIOLATION: سجلات التدقيق غير قابلة للتعديل 🛡️"); });
    this.Audit_Log.hook('deleting', () => { throw new Error("SECURITY_VIOLATION: يمنع حذف سجلات الرقابة النهائية 🔒"); });
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
      { name: 'Items_Inventory', table: this.products, pk: 'ProductID' },
      { name: 'Financial_Transactions', table: this.financialTransactions, pk: 'Transaction_ID' },
      { name: 'Voucher_Invoice_Link', table: this.voucherInvoiceLinks, pk: 'linkId' },
      { name: 'Suppliers', table: this.suppliers, pk: 'Supplier_ID' },
      { name: 'Customers', table: this.customers, pk: 'Supplier_ID' }
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
        const recordId = String(primaryKey || (obj as any)[pk] || 'NEW');
        this.logAuditEntryAsync(name, recordId, 'ALL', 'NULL', 'Record Created', 'ADD');
        SyncService.queueSync(name, recordId, 'CREATE', obj);
      });
      table.hook('updating', (mods, obj) => {
        this.incrementDataVersion();
        const recordId = String((obj as any)[pk] || (obj as any).id || 'UNKNOWN');
        Object.keys(mods).forEach(key => {
          if (SENSITIVE_MAP[key]) {
            const oldValue = String((obj as any)[key]);
            const newValue = String((mods as any)[key]);
            if (oldValue !== newValue) {
              this.logAuditEntryAsync(name, recordId, SENSITIVE_MAP[key], oldValue, newValue, 'UPDATE');
            }
          }
        });
        SyncService.queueSync(name, recordId, 'UPDATE', { ...(obj as any), ...(mods as any) });
      });
      table.hook('deleting', (primaryKey, obj) => {
        this.incrementDataVersion();
        const recordId = String(primaryKey || (obj as any)[pk] || 'DELETED');
        this.logAuditEntryAsync(name, recordId, 'RECORD', 'Record Deleted', 'DELETED', 'DELETE');
        SyncService.queueSync(name, recordId, 'DELETE', { id: recordId });
      });
    });
  }

  private logAuditEntryAsync(tableName: string, recordId: string, columnName: string, oldVal: string, newVal: string, changeType: 'ADD' | 'UPDATE' | 'DELETE') {
    setTimeout(async () => {
      try {
        const user = authService.getCurrentUser();
        const now = new Date().toISOString();
        const auditEntry: FinancialAuditEntry = {
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

  generateId(prefix: string) { return `${prefix}-${Date.now()}-${Math.floor(Math.random()*10000)}`; }
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
              itemId: item.product_id,
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
              itemId: item.product_id,
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

  constructor() {
    this.db = new PharmaFlowDB();
    this.init();
  }

  async init() {
    try {
      if (!this.db.isOpen()) {
        await this.db.open();
      }
      const metaTableNames = ['users', 'suppliers', 'customers', 'accounts', 'journalRules', 'itemUnits', 'paymentGateways', 'categories'];
      for (const name of metaTableNames) {
        const data = await (this.db as any)[name].toArray() || [];
        this.cache[name] = data;
      }
      await this.seedCategories();
      await this.seedMockData();
      this.version++;
    } catch (e) {
      console.error("Database initialization failed:", e);
    }
  }

  async seedMockData() {
    const productsCount = await this.db.products.count();
    if (productsCount > 0) return;

    const mockProducts: Product[] = [
      { 
        id: 'P1', ProductID: 'P1', Name: 'بندول إكسترا', 
        categoryId: 'CAT1', UnitPrice: 15, CostPrice: 10, StockQuantity: 100, barcode: '1001',
        DefaultUnit: 'علبة', LastPurchasePrice: 10, TaxDefault: 0, MinLevel: 10, ExpiryDate: '2027-12-31',
        Is_Active: true
      },
      { 
        id: 'P2', ProductID: 'P2', Name: 'أوميبرازول 20 ملغ', 
        categoryId: 'CAT1', UnitPrice: 45, CostPrice: 30, StockQuantity: 50, barcode: '1002',
        DefaultUnit: 'علبة', LastPurchasePrice: 30, TaxDefault: 0, MinLevel: 5, ExpiryDate: '2026-06-30',
        Is_Active: true
      },
      { 
        id: 'P3', ProductID: 'P3', Name: 'فيتامين سي 1000 ملغ', 
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
    await this.init(); 
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

  async ensureOpen() {
    if (!this.db.isOpen()) {
      try {
        await this.db.open();
      } catch (err: any) {
        if (err.name === 'DatabaseClosedError') {
          // Force re-open if closed
          this.db = new PharmaFlowDB();
          await this.db.open();
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

  async runTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureOpen();
    const status = await this.getSetting('SYSTEM_STATUS', 'ACTIVE');
    if (status === 'RECOVERY_MODE') {
      if (IS_PREVIEW) {
        console.warn("PREVIEW GUARD: System is in RECOVERY_MODE, but bypassing for transaction execution.");
      } else {
        throw new Error("النظام في وضع الاستعادة (Recovery Mode). يرجى مراجعة الأخطاء الفادحة أولاً 🛡️");
      }
    }

    // Level 2 Protection: Disable Journal Editing
    const isJournalLocked = await this.getSetting('JOURNAL_EDIT_LOCKED', 'FALSE');
    if (isJournalLocked === 'TRUE') {
      // We need to be careful not to block ALL transactions, only those that might "edit" journals.
      // However, since we don't easily know what 'fn' does inside runTransaction without executing it,
      // we might need a different approach or just block all transactions if they are not "safe".
      // For now, let's assume if it's locked, we block transactions that are likely to be edits.
      // A better way is to check inside the specific methods.
    }

    try {
      return await (this.db as any).transaction('rw', (this.db as any).tables, async () => { 
        return await fn(); 
      });
    } catch (error: any) {
      if (error.name === 'DatabaseClosedError') {
        await this.ensureOpen();
        return this.runTransaction(fn);
      }
      console.error("TRANSACTION_FAILURE: Rolling back operations.", error);
      await this.db.systemPerformanceLog.add({
        id: this.generateId('ERR'),
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
  async addInvoiceHistory(h: any) { await this.ensureOpen(); await this.db.invoiceHistory.add(h); }
  getJournalRules() { return this.cache.journalRules || []; }
  async getAccountingPeriods() { await this.ensureOpen(); return await this.db.Accounting_Periods.toArray(); }
  async recordCashFlow(entry: CashFlow) { await this.ensureOpen(); await this.db.cashFlow.put(entry); }
  async getMedicineAlternatives() { await this.ensureOpen(); return await this.db.medicineAlternatives.toArray(); }
  async clearOldAlerts() { await this.ensureOpen(); await this.db.medicineAlerts.clear(); }
  async getMedicineBatches() { await this.ensureOpen(); return await this.db.medicineBatches.toArray(); }
  getAccounts() { return this.cache.accounts || []; }
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    await this.ensureOpen();
    const s = await this.db.settings.get(key);
    return s ? s.value : defaultValue;
  }
  async saveSetting(key: string, value: any) { await this.ensureOpen(); await this.db.settings.put({ key, value }); }
  async saveProduct(p: Product) { 
    await this.ensureOpen();
    if (!p.id) p.id = p.ProductID || this.generateId('PRD');
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
  
  async addAuditLog(action: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'CANCEL' | 'SYSTEM', target_type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'PRODUCT' | 'SYSTEM' | 'OTHER', target_id: string, details?: string) {
    const user = authService.getCurrentUser();
    const entry: AuditLogEntry = {
      id: this.generateId('AUD'),
      user_id: user?.User_Email || 'SYSTEM',
      action,
      target_type,
      target_id,
      timestamp: new Date().toISOString(),
      details
    };
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
  async updatePurchaseNotes(id: string, notes: string) {
    const purchase = await this.db.purchases.get(id);
    if (purchase) {
      (purchase as any).notes = notes;
      purchase.lastModified = new Date().toISOString();
      await this.db.purchases.put(purchase);
    }
  }
  async processSale(customerId: string, items: any[], total: number, isReturn: boolean, inv: string, curr: string, status: string, pid?: string, invStatus: InvoiceStatus = 'PENDING', hash?: string, auditScore?: number, riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH', totalSaleCost?: number) {
    const products = await this.getProducts();
    const user = authService.getCurrentUser();
    const now = new Date().toISOString();
    
    // إذا لم يتم توفير التكلفة (مثلاً من محرك FIFO)، نحسبها بالطريقة التقليدية
    let finalSaleCost = totalSaleCost;
    if (finalSaleCost === undefined || finalSaleCost === null) {
      finalSaleCost = 0;
      items.forEach(item => {
        const p = products.find(prod => prod.ProductID === item.product_id);
        if (p) finalSaleCost! += (p.CostPrice || 0) * item.qty;
      });
    }

    const sale: Sale = {
      id: inv || this.generateId('SALE'), SaleID: inv || this.generateId('INV'), date: now,
      customerId, finalTotal: total, subtotal: total, paymentStatus: status as any,
      paidAmount: status === 'Cash' ? total : 0, branchId: 'MAIN', items, 
      totalCost: finalSaleCost, isReturn, currency: curr, InvoiceStatus: invStatus, tax: 0,
      Created_By: user?.User_Email || 'SYSTEM', Created_At: now, lastModified: now,
      hash, auditScore, riskLevel
    };
    await this.db.sales.put(sale); 
    await this.addAuditLog(inv ? 'UPDATE' : 'CREATE', 'SALE', sale.id, `Sale ${sale.SaleID} processed with risk ${riskLevel || 'LOW'}`);
    return { sale_id: sale.SaleID, totalSaleCost: finalSaleCost };
  }
  async processPurchase(supplierId: string, items: any[], total: number, inv: string, isCash: boolean, curr: string = 'USD', invStatus: InvoiceStatus = 'PENDING', type: string = 'شراء', hash?: string, auditScore?: number, riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH') {
    const user = authService.getCurrentUser();
    const now = new Date().toISOString();
    const purchase: Purchase = {
      id: inv || this.generateId('PUR'), purchase_id: inv || this.generateId('PUR_ID'), invoiceId: inv, date: now,
      partnerId: supplierId, totalAmount: total, finalAmount: total, 
      status: isCash ? 'PAID' : 'UNPAID', paidAmount: isCash ? total : 0, invoiceStatus: invStatus, 
      invoiceType: type as any, currency: curr, branchId: 'MAIN', items, subtotal: total, tax: 0, partnerName: 'Supplier',
      Created_By: user?.User_Email || 'SYSTEM', Created_At: now, lastModified: now,
      hash, auditScore, riskLevel
    };
    await this.db.purchases.put(purchase); 
    await this.addAuditLog(inv ? 'UPDATE' : 'CREATE', 'PURCHASE', purchase.id, `Purchase ${purchase.invoiceId} processed with risk ${riskLevel || 'LOW'}`);
    return { purchase_id: purchase.id };
  }
  async persist(table: string, data: any[]) { if ((this.db as any)[table]) await (this.db as any)[table].bulkPut(data); }
  async saveSettlement(s: InvoiceSettlement) { await this.db.settlements.put(s); }
  async getPendingOperations() { return await this.db.pendingOperations.toArray(); }
  async getInvoiceHistory(invoiceId: string) { 
    if (!invoiceId) return [];
    return await this.db.invoiceHistory.where('invoiceId').equals(invoiceId).toArray(); 
  }
  async getDailyAuditTask(date?: string) { 
    const targetDate = date || new Date().toISOString().split('T')[0];
    return await this.db.dailyAuditTask.get(targetDate) || { date: targetDate, completed: false, items: [] }; 
  }
  async saveAuditProgress(items: any[]) {
    const date = new Date().toISOString().split('T')[0];
    await this.db.dailyAuditTask.put({ date, completed: false, items });
  }

  // --- New Integrated Accounting & Inventory Methods ---

  async getCurrencies() { return await this.db.currencies.toArray(); }
  async saveCurrency(c: Currency) { await this.db.currencies.put(c); }
  async deleteCurrency(id: string) { await this.db.currencies.delete(id); }
  
  async getExchangeRates(date?: string) { 
    const targetDate = date || new Date().toISOString().split('T')[0];
    return await this.db.exchangeRates.where('date').equals(targetDate).toArray(); 
  }
  async saveExchangeRate(rate: ExchangeRate) { await this.db.exchangeRates.put(rate); }

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
    await this.db.dailyAuditTask.put({ date, completed: true, items });
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
  getItemUnits(itemId: string) { return (this.cache.itemUnits || []).filter((u: any) => u.Item_ID === itemId); }
  async getMedicineAlerts() { return await this.db.medicineAlerts.toArray(); }
  async saveMedicineAlert(alert: any) { 
    if (!alert.AlertID) alert.AlertID = this.generateId('MAL');
    await this.db.medicineAlerts.put(alert); 
  }
  async getInvoiceAdjustments(invoiceId?: string) {
    if (invoiceId) return await this.db.Invoice_Adjustments.where('InvoiceID').equals(invoiceId).toArray();
    return await this.db.Invoice_Adjustments.toArray();
  }
  async saveInvoiceAdjustment(adj: any) { 
    if (!adj.AdjustmentID) adj.AdjustmentID = this.generateId('IAD');
    await this.db.Invoice_Adjustments.put(adj); 
  }
  async deleteInvoiceAdjustment(id: string) { await this.db.Invoice_Adjustments.delete(id); }
}

const dbInstance = new LocalDatabase();
export { dbInstance as db };

// Initialize hooks after export to ensure db is available to imported services
dbInstance.db.setupSyncHooks();
