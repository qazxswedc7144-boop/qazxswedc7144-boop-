

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AccountingError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingError';
  }
}

export class InventoryError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryError';
  }
}

export class SecurityError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export type UserRole = 'Admin' | 'Accountant' | 'Clerk';
export type SubscriptionPlan = 'Free' | 'Basic' | 'Pro';
export type TenantStatus = 'Active' | 'Suspended' | 'Expired';

export interface Tenant extends SyncableEntity {
  tenant_id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  subscription_plan: SubscriptionPlan;
  status: TenantStatus;
  activation_date?: string;
  activation_code?: string;
  expiry_date?: string;
  entry_count?: number; // عداد العمليات (فواتير/سندات)
  is_trial?: boolean;   // هل الحساب في فترة تجريبية
  settings?: {
    max_users: number;
    max_invoices: number;
    storage_limit_gb: number;
  };
}

export interface LicenseKey extends SyncableEntity {
  key: string;
  plan: SubscriptionPlan;
  duration_days: number;
  is_used: boolean;
  used_by_tenant_id?: string;
  used_at?: string;
}
export type SyncStatus = 'NEW' | 'UPDATED' | 'SYNCED' | 'CONFLICT' | 'PENDING';
export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid';
export type SystemStatus = 'ACTIVE' | 'RECOVERY_MODE' | 'MAINTENANCE';
export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncQueueStatus = 'PENDING' | 'SYNCED' | 'CONFLICT';

export interface SyncQueueItem extends SyncableEntity {
  id: string;
  entityType: string;
  entityId: string;
  action: SyncAction;
  payload: string; // Encrypted JSON
  localTimestamp: string;
  syncStatus: SyncQueueStatus;
  retryCount: number;
  error?: string;
}

export interface ConflictArchive extends SyncableEntity {
  id: string;
  entityType: string;
  entityId: string;
  data: string; // JSON of the older version
  resolvedAt: string;
  resolution: string;
}

export interface SecuritySettings extends SyncableEntity {
  id: string;
  is_enabled: boolean;
  username: string;
  password_hash: string;
  salt: string;
  lock_mode: 'instant' | '5m' | '10m' | '20m' | '30m';
  last_active_at: number;
}

export interface FinancialHealthSnapshot extends SyncableEntity {
  id: string;
  date: string;
  score: number;
  metrics: {
    cashBalance: number;
    accountsReceivable: number;
    accountsPayable: number;
    inventoryValue: number;
    grossProfit: number;
    netProfit: number;
    collectionRate: number;
    supplierPaymentRatio: number;
    stockTurnoverRatio: number;
  };
  breakdown: {
    liquidity: number;
    profitability: number;
    stockEfficiency: number;
    debtManagement: number;
  };
  insights: string[];
}

export interface SystemAlert extends SyncableEntity {
  id: string;
  type: 'FINANCIAL' | 'STOCK' | 'SECURITY' | 'SYSTEM' | 'BEHAVIORAL' | 'LEDGER';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  timestamp: string;
  isRead: boolean;
  linkedInvoiceId?: string;
  resolvedStatus?: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  metadata?: any;
}

export interface UserBehavior extends SyncableEntity {
  userId: string;
  date: string; // YYYY-MM-DD
  numberOfEdits: number;
  unlockAttempts: number;
  repostFrequency: number;
  deleteAttempts: number;
  afterHoursActions: number;
  lastActionAt: string;
}

export interface HistoricalMetric extends SyncableEntity {
  id: string;
  month: string; // YYYY-MM
  type: 'AVG_SALE' | 'AVG_PURCHASE' | 'AVG_MARGIN' | 'AVG_EDITS';
  value: number;
  entityId?: string;
}

export interface ProfitHealth extends SyncableEntity {
  id: string;
  date: string;
  grossProfitPercent: number;
  netMovement: number;
  inventoryTurnover: number;
  healthStatus: 'Healthy' | 'Needs Attention' | 'Critical';
  topProducts: { id: string; name: string; value: number }[];
  slowMovingItems: { id: string; name: string; daysSinceLastSale: number }[];
  highRiskEntities: { id: string; name: string; riskScore: number }[];
}

export interface PerformanceMetric extends SyncableEntity {
  id: string;
  operation: string;
  durationMs: number;
  timestamp: string;
  metadata?: any;
}

export interface User extends SyncableEntity {
  user_id: string;
  User_Email: string; 
  User_Name: string;
  Role: UserRole;
  Is_Active: boolean;
  tenant_id: string;
  lastLogin?: string;
  password_hash?: string;
  salt?: string;
  created_at?: string;
}

export interface UserRoleEntry extends SyncableEntity {
  User_Email: string;
  Role_Type: UserRole;
}

export type Permission = 
  | 'CREATE_INVOICE' 
  | 'EDIT_INVOICE' 
  | 'DELETE_INVOICE'
  | 'CREATE_VOUCHER'
  | 'EDIT_VOUCHER'
  | 'DELETE_VOUCHER'
  | 'VIEW_REPORTS'
  | 'FINANCIAL_ACCESS'
  | 'MANAGE_SYSTEM'
  | 'FULL_ACCESS'
  | 'POS_ACCESS'
  | 'PURCHASE_ACCESS'
  | 'INVENTORY_VIEW'
  | 'MANAGE_PARTNERS'
  | 'AUDIT_VIEW'
  | 'ARCHIVE_VIEW';

export interface SyncableEntity {
  id: string;
  lastModified?: string;
  updated_at?: string; // Alias for lastModified
  version?: number;    // Alias for syncVersion
  syncStatus?: SyncStatus;
  syncVersion?: number;
  isDeleted?: boolean;
  Created_By?: string;
  Created_At?: string;
  tenant_id?: string;
}

// --- محرك حركات المخزون المركزي (Central Inventory Engine) ---

export type InventoryTransactionType = 'SALE' | 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'INITIAL' | 'TRANSFER';

export interface SystemBackup extends SyncableEntity {
  id: string;
  backupName: string;
  backupType: 'MANUAL' | 'AUTO' | 'PRE_UNPOST' | 'PRE_EDIT' | 'PRE_DELETE' | 'PRE_VOUCHER_DELETE' | 'PRE_PERIOD_CLOSE' | 'SCHEDULED_DAILY' | 'SCHEDULED_WEEKLY';
  createdAt: string;
  createdBy: string;
  systemVersion: string;
  dataSnapshot: string; // Encrypted JSON string
  checksumHash: string;
  sizeInKB: number;
  status: 'SUCCESS' | 'FAILED';
  restoreTested: boolean;
  isIncremental?: boolean;
  parentBackupId?: string; // For incremental backups
}

export interface InventoryTransaction extends SyncableEntity {
  TransactionID: string;
  productId: string;
  warehouseId: string;
  SourceDocumentType: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'INITIAL' | 'MANUAL';
  SourceDocumentID: string;
  QuantityChange: number; // + للمدخلات، - للمخرجات
  before_qty: number;
  after_qty: number;
  TransactionType: InventoryTransactionType;
  TransactionDate: string;
  UserID: string;
  branchId?: string;
  notes?: string;
}

export interface StockReservation extends SyncableEntity {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  sourceDocId: string;
  expiresAt: string;
}

export interface StockMovement extends SyncableEntity {
  id: string;
  item_id: string;
  type: 'purchase' | 'sale' | 'return' | 'adjustment';
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  unit_cost: number;
  total_cost: number;
  reference_id: string;
  created_at: string;
}

export interface InventoryLayer extends SyncableEntity {
  id: string;
  item_id: string;
  quantity_remaining: number;
  unit_cost: number;
  created_at: string;
  reference_id: string; // Purchase Invoice ID
}

export interface FIFOConsumptionLog extends SyncableEntity {
  id: string;
  sale_id: string;
  item_id: string;
  layer_id: string;
  quantity_consumed: number;
  unit_cost: number;
  consumed_at: string;
}

export interface FIFOCostLayer extends SyncableEntity {
  id: string;
  productId: string;
  quantityRemaining: number;
  unitCost: number;
  purchaseDate: string;
  referenceId: string;
  isClosed: boolean;
}

// --- محرك قوالب الطباعة (Smart Template Engine Interfaces) ---

export interface PrintTemplate extends SyncableEntity {
  TemplateID: string;
  TemplateName: string;
  TemplateType: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'REPORT';
  TemplateFormat: 'PDF' | 'PRINT' | 'EXCEL';
  TemplateLayoutJSON: string; 
  IsDefaultTemplate: boolean;
  CompanyLogo?: string;
  PaperSize: 'A4' | 'A5' | 'Thermal80mm';
  RTL_Support: boolean;
}

export interface TemplateAssignment extends SyncableEntity {
  AssignmentID: string;
  TemplateID: string;
  DocumentType: string;
  BranchID: string;
  IsActive: boolean;
}

/**
 * Unified Invoice Bridge - واجهة موحدة لدمج المبيعات والمشتريات برمجياً
 */
export interface UnifiedInvoice extends SyncableEntity {
  id: string;
  invoiceNumber: string;
  date: string;
  partnerId: string;
  partnerName: string;
  type: 'SALE' | 'PURCHASE';
  subtotal: number;
  tax: number;
  finalTotal: number;
  paidAmount: number;
  paymentStatus: 'Cash' | 'Credit';
  financialStatus: PaymentStatus;
  documentStatus: InvoiceStatus;
  items: InvoiceItem[];
  isReturn: boolean;
  notes?: string;
}

export interface FinancialAuditEntry extends SyncableEntity {
  Log_ID: string;         
  Table_Name: string;     
  Record_ID: string;      
  Column_Name: string;    
  Old_Value: string;      
  New_Value: string;      
  Change_Type: 'ADD' | 'UPDATE' | 'DELETE';
  Modified_By: string;    
  Modified_At: string;    
  Created_At: string;     
  Last_Updated: string;   
  System_Flags?: string;  
  Temporary_Values?: string; 
  Device_Info?: string;   
}

export interface Category extends SyncableEntity {
  id: string;
  categoryId: string;
  categoryName: string;
  createdAt: string;
  isSystem: boolean;
}

export interface InventoryItem extends SyncableEntity {
  id: string;
  itemName: string;
  category: string;
  currentQuantity: number;
  minQuantity: number;
  unitPrice: number;
  totalValue: number;
  lastUpdated: string;
  expiryDate?: string;
  status: 'active' | 'low_stock' | 'expired';
}

export interface ItemProfitEntry extends SyncableEntity {
  id: string;
  productId: string;
  itemName: string;
  period: { start: string; end: string };
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  unitsSold: number;
}

export interface CustomerProfitEntry extends SyncableEntity {
  id: string;
  customerId: string;
  customerName: string;
  period: { start: string; end: string };
  totalPurchases: number;
  totalProfit: number;
  transactionsCount: number;
}

export interface SupplierProfitEntry extends SyncableEntity {
  id: string;
  supplierId: string;
  supplierName: string;
  period: { start: string; end: string };
  totalPurchases: number;
  totalSales: number;
  totalSalesFromSupplier?: number;
  grossProfit: number;
  margin?: number;
  transactionsCount: number;
}

export interface AccountMovement extends SyncableEntity {
  id: string;
  movementId: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  balance: number;
  reference: { type: string; id: string };
}

export interface PurchaseByItemEntry extends SyncableEntity {
  id: string;
  purchaseId: string;
  productId: string;
  supplierId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  invoiceNumber: string;
}

export interface ExpiringItemEntry extends SyncableEntity {
  id: string;
  productId: string;
  itemName: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  status: 'valid' | 'expiring_soon' | 'expired';
  location: string;
}

export interface Product extends SyncableEntity {
  id: string;
  Name: string;      
  DefaultUnit: string; 
  LastPurchasePrice: number; 
  TaxDefault: number; 
  UnitPrice: number; 
  CostPrice: number; 
  StockQuantity: number; 
  MinLevel: number;
  ExpiryDate: string;
  supplierId?: string;
  supplierName?: string;
  categoryId?: string;
  categoryName?: string;
  barcode?: string;
  usageCount?: number; 
  ProfitMargin?: number;
  Is_Active?: boolean;
  branchId?: string;
}

export interface InvoiceItem extends SyncableEntity {
  id: string;
  parent_id: string; 
  product_id: string;
  row_order: number; 
  name: string;
  qty: number;
  price: number;
  sum: number;
  discount_val?: number;
  tax_val?: number;
  unit?: string;
  expiryDate?: string;
  notes?: string;
}

// --- نظام سير عمل الفواتير (Invoice Workflow Engine Statuses) ---
export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'POSTED' | 'LOCKED' | 'CANCELLED' | 'DRAFT_EDIT' | 'VOID';

export interface Sale extends SyncableEntity {
  id: string;
  SaleID: string;
  date: string;
  Date?: string;
  customerId: string;
  finalTotal: number;
  FinalTotal?: number;
  subtotal?: number; 
  tax?: number; 
  paymentStatus: 'Cash' | 'Credit';
  payment_status?: PaymentStatus; 
  paidAmount?: number; 
  branchId: string;
  items: InvoiceItem[];
  totalCost: number;
  isReturn?: boolean;
  currency?: string;
  InvoiceStatus?: InvoiceStatus;
  versionNumber?: number;
  hash?: string;
  deleted_at?: string;
  originalProvisionalId?: string;
  isProvisional?: boolean;
  notes?: string;
  attachment?: string;
  lockedBy?: string;
  lockedAt?: string;
  auditScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  isApproved?: boolean;
  isArchived?: boolean;
  lastPostedAt?: string;
}

export interface Purchase extends SyncableEntity {
  id: string;
  purchase_id: string;
  invoiceId: string;
  date: string;
  Date?: string;
  partnerId: string;
  partnerName?: string; 
  totalAmount: number; 
  finalAmount?: number; 
  subtotal?: number; 
  tax?: number; 
  status: 'PAID' | 'UNPAID';
  payment_status?: PaymentStatus; 
  invoiceStatus: InvoiceStatus;
  versionNumber?: number;
  hash?: string;
  deleted_at?: string;
  invoiceType?: 'شراء' | 'مرتجع'; 
  currency?: string;
  branchId: string;
  items: InvoiceItem[];
  paidAmount?: number; 
  notes?: string;
  attachment?: string;
  lockedBy?: string;
  lockedAt?: string;
  auditScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  isApproved?: boolean;
  isArchived?: boolean;
  lastPostedAt?: string;
}

export interface FinancialTransaction extends SyncableEntity {
  Transaction_ID: string; 
  Transaction_Type: 'Invoice' | 'Receipt' | 'Payment' | 'Adjustment' | 'Refund';
  Reference_ID: string; 
  Reference_Table: 'Sales_Invoices' | 'Purchase_Invoices' | 'Vouchers' | 'Adjustments';
  Entity_Type?: 'Supplier' | 'Customer';
  Entity_Name: string; 
  Amount: number; 
  Paid_Amount: number; 
  Direction: 'Debit' | 'Credit'; 
  Transaction_Date: string; 
  Notes: string; 
}

export interface VoucherInvoiceLink extends SyncableEntity {
  linkId: string; 
  voucherId: string; 
  invoiceId: string; 
  Paid_Amount: number; 
  note?: string;
}

export interface AccountingEntry extends SyncableEntity {
  id: string;
  entry_id?: string; // For enterprise alignment
  date: string;
  reference_id?: string; // For enterprise alignment
  description?: string;
  TotalAmount: number;
  status: 'Posted' | 'Saved';
  sourceId: string;
  sourceType: string;
  branchId?: string;
  lines: JournalLine[];
  hash?: string;
  created_at?: string;
  timestamp?: string;
}

export interface JournalLine extends SyncableEntity {
  lineId: string;
  entry_id?: string; // For enterprise alignment
  entryId: string;
  account_id?: string; // For enterprise alignment
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
}

export interface Supplier extends SyncableEntity {
  Supplier_ID: string;      
  Supplier_Name: string;    
  Phone?: string;
  Address?: string;
  Balance: number;          
  openingBalance: number; 
  purchaseHistory?: any[];
  // Fix: Added missing Is_Active property to support logical deletion/deactivation in repositories
  Is_Active?: boolean;
}

export interface MedicineAlert extends SyncableEntity {
  AlertID: string;
  Type: 'LOW_STOCK' | 'EXPIRY' | 'SEASONAL';
  ReferenceID: string;
  Title: string;
  Message: string;
  Severity: 'Critical' | 'Warning' | 'Info';
  Date: string;
  IsRead: boolean;
}

export interface SystemErrorLog extends SyncableEntity {
  Error_ID: string;
  Module_Name: string;
  Error_Message: string;
  Record_ID: string;
  User_Email: string;
  Timestamp: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface CashFlow extends SyncableEntity {
  transaction_id: string;
  date: string;
  type: 'دخل' | 'خرج';
  category: string;
  name: string;
  amount: number;
  notes?: string;
  branchId: string;
}

export interface ItemUsageLog extends SyncableEntity {
  id: string;
  productId: string;
  timestamp: string;
  type: 'SALE' | 'PURCHASE';
  partnerId: string; 
  userId: string;
  qty: number;
  price: number; 
  sourceSupplierId?: string; 
}

export interface AccountingPeriod extends SyncableEntity {
  id: string;
  Start_Date: string;
  End_Date: string;
  Is_Locked: boolean;
  Locked_By?: string;
  Locked_At?: string;
  lastModified?: string;
}

export interface PriceHistory extends SyncableEntity {
  id: string;
  productId: string;
  Item_Name: string;
  Customer: string;
  Price: number;
  Invoice_Date: string;
  lastModified?: string;
}

export interface TestResult {
  testName: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  message: string;
  details?: any;
}

export interface SystemTestReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  results: TestResult[];
  performanceMetrics?: {
    avgResponseTimeMs: number;
    errorRate: number;
    peakMemoryMb?: number;
  };
}

export interface PeriodLockLog extends SyncableEntity {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  periodId: string;
  details?: string;
}

export interface InvoiceAdjustment extends SyncableEntity {
  AdjustmentID: string;
  InvoiceID: string;
  Type: 'Discount' | 'Additional Fee' | 'Tax Adjustment';
  Value: number;
  IsPercentage: boolean;
  Note: string;
  lastModified?: string;
}

export interface AuditItem {
  id: string;
  name: string;
  bookQty: number;
  actualQty?: number;
  status: 'pending' | 'matched' | 'mismatch';
  reason?: string;
}

export interface DailyAuditTask extends SyncableEntity {
  date: string;
  completed: boolean;
  items: AuditItem[];
}

export interface ItemUnit extends SyncableEntity {
  Unit_ID: string;
  Item_ID: string;
  Unit_Name: string;
}

export interface Account extends SyncableEntity {
  id: string;
  account_id?: string; // For enterprise alignment
  code: string;
  name: string;
  account_name?: string; // For enterprise alignment
  type: AccountType;
  account_type?: AccountType; // For enterprise alignment
  parent_id?: string; // For hierarchy
  parentId?: string;
  balance_type: 'DEBIT' | 'CREDIT';
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  balance?: number;
}

export interface BackupSnapshot extends SyncableEntity {
  id: string;
  timestamp: string;
  data: any;
  type: 'AUTO' | 'MANUAL';
}

export interface AIInsight extends SyncableEntity {
  id: string;
  type: 'TREND' | 'PERFORMANCE' | 'BEHAVIOR' | 'COST' | 'RISK';
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  data?: any;
  timestamp: string;
}

export interface InvoiceCounter extends SyncableEntity {
  Counter_Type: string; 
  Last_Number: number;  
}

export interface InvoiceHistory extends SyncableEntity {
  id: string;
  invoiceId: string;
  userId: string;
  userName: string;
  timestamp: string;
  action: 'CREATED' | 'POSTED' | 'UPDATED' | 'CANCELLED';
  details: string;
}

export interface IntegrityReport extends SyncableEntity {
  id: string;
  isHealthy: boolean;
  totalDiff: number;
  timestamp: string;
  points: any[];
}

export interface ReconciliationPoint extends SyncableEntity {
  id: string;
  label: string;
  status: 'balanced' | 'discrepancy' | 'critical';
  details: string;
  ledgerBalance: number;
  subledgerBalance: number;
  diff: number;
}

export interface AuditLogEntry extends SyncableEntity {
  id: string;
  user_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'CANCEL' | 'SYSTEM';
  target_type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'PRODUCT' | 'SYSTEM' | 'OTHER';
  target_id: string;
  timestamp: string;
  details?: string;
}

export interface PendingOperation extends SyncableEntity {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'syncing' | 'failed';
  retries: number;
  createdAt: string;
}

export interface ValidationRule extends SyncableEntity {
  id: string;
  entityType: 'SALE' | 'PURCHASE' | 'PRODUCT';
  fieldName: string;
  operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'NOT_EQUALS' | 'NOT_EMPTY' | 'MIN_LENGTH';
  comparisonValue: string;
  errorMessage: string;
  isActive: boolean;
}

export interface BankTransaction extends SyncableEntity {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  status: 'pending' | 'completed';
}

export interface BankAccount extends SyncableEntity {
  id: string;
  bankName: string;
  accountNumber: string;
  status: 'connected' | 'error';
  lastSync?: string;
}

export interface PaymentGateway extends SyncableEntity {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  config: any;
}

export interface WebhookConfig extends SyncableEntity {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
}

export interface MedicineAlternative extends SyncableEntity {
  id: string;
  MedicineID: string;
  AlternativeID: string;
  PriorityLevel: 'First' | 'Second' | 'Third';
}

export interface MedicineBatch extends SyncableEntity {
  id: string;
  BatchID: string;
  productId: string;
  warehouseId: string;
  ExpiryDate: string;
  Quantity: number;
  lastUpdated?: string;
}

export interface PurchaseRecord extends SyncableEntity {
  id: string;
  date: string;
  amount: number;
}

export interface Transaction extends SyncableEntity {
  id: string;
  date: string;
  amount: number;
  type: 'sale' | 'purchase';
  customer?: string;
}

export interface Receipt extends SyncableEntity {
  id: string;
  date: string;
  customer_id: string;
  amount: number;
  notes?: string;
  created_at: string;
}

export interface Payment extends SyncableEntity {
  id: string;
  date: string;
  supplier_id: string;
  amount: number;
  notes?: string;
  created_at: string;
}

export interface InvoiceSettlement extends SyncableEntity {
  id: string;
  voucherId: string;
  invoiceId: string;
  partnerId: string;
  amount: number;
  date: string;
  type: 'RECEIPT' | 'PAYMENT';
  note?: string;
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface PartnerLedgerEntry extends SyncableEntity {
  id: string;
  partnerId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  referenceId: string;
  runningBalance: number;
}

export interface Warehouse extends SyncableEntity {
  id: string;
  name: string;
  location?: string;
  isDefault: boolean;
}

export interface WarehouseStock extends SyncableEntity {
  id: string; // warehouseId + productId
  warehouseId: string;
  productId: string;
  quantity: number;
  lastUpdated: string;
}

export interface Currency extends SyncableEntity {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
}

export interface ExchangeRate extends SyncableEntity {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: string;
}

export interface SupplierLedgerEntry extends SyncableEntity {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  referenceId?: string;
  linkedInvoices?: string;
}
