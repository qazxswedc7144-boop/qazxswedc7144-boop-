

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

export type UserRole = 'Admin' | 'Accountant' | 'DataEntry';
export type SyncStatus = 'NEW' | 'UPDATED' | 'SYNCED' | 'CONFLICT';
export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid';
export type SystemStatus = 'ACTIVE' | 'RECOVERY_MODE' | 'MAINTENANCE';
export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncQueueStatus = 'PENDING' | 'SYNCED' | 'CONFLICT';

export interface SyncQueueItem {
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

export interface ConflictArchive {
  id: string;
  entityType: string;
  entityId: string;
  data: string; // JSON of the older version
  resolvedAt: string;
  resolution: string;
}

export interface FinancialHealthSnapshot {
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

export interface SystemAlert {
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

export interface UserBehavior {
  userId: string;
  date: string; // YYYY-MM-DD
  numberOfEdits: number;
  unlockAttempts: number;
  repostFrequency: number;
  deleteAttempts: number;
  afterHoursActions: number;
  lastActionAt: string;
}

export interface HistoricalMetric {
  id: string;
  month: string; // YYYY-MM
  type: 'AVG_SALE' | 'AVG_PURCHASE' | 'AVG_MARGIN' | 'AVG_EDITS';
  value: number;
  entityId?: string;
}

export interface ProfitHealth {
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

export interface PerformanceMetric {
  id: string;
  operation: string;
  durationMs: number;
  timestamp: string;
  metadata?: any;
}

export interface User {
  User_Email: string; 
  User_Name: string;
  Role: UserRole;
  Is_Active: boolean;
  lastLogin?: string;
}

export interface UserRoleEntry {
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
  | 'FULL_ACCESS';

export interface SyncableEntity {
  id?: string;
  lastModified?: string;
  syncStatus?: SyncStatus;
  syncVersion?: number;
  isDeleted?: boolean;
  Created_By?: string;
  Created_At?: string;
}

// --- محرك حركات المخزون المركزي (Central Inventory Engine) ---

export type InventoryTransactionType = 'SALE' | 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'INITIAL';

export interface SystemBackup extends SyncableEntity {
  id: string;
  backupName: string;
  backupType: 'MANUAL' | 'AUTO' | 'PRE_UNPOST' | 'PRE_DELETE' | 'PRE_VOUCHER_DELETE' | 'PRE_PERIOD_CLOSE' | 'SCHEDULED_DAILY' | 'SCHEDULED_WEEKLY';
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
  ItemID: string;
  SourceDocumentType: 'SALE' | 'PURCHASE' | 'ADJUSTMENT';
  SourceDocumentID: string;
  QuantityChange: number; // + للمدخلات، - للمخرجات
  TransactionType: InventoryTransactionType;
  TransactionDate: string;
  UserID: string;
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

export interface FIFOCostLayer extends SyncableEntity {
  id: string;
  productId: string;
  warehouseId: string;
  purchaseDocId: string;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  date: string;
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

export interface FinancialAuditEntry {
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
  itemId: string;
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
  itemId: string;
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
  grossProfit: number;
}

export interface AccountMovement extends SyncableEntity {
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
  itemId: string;
  supplierId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  invoiceNumber: string;
}

export interface ExpiringItemEntry extends SyncableEntity {
  id: string;
  itemId: string;
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
  ProductID: string; 
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
}

export interface InvoiceItem {
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
  date: string;
  description?: string;
  TotalAmount: number;
  status: 'Posted' | 'Saved';
  sourceId: string;
  sourceType: string;
  branchId?: string;
  lines: JournalLine[];
  hash?: string;
}

export interface JournalLine {
  lineId: string;
  entryId: string;
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

export interface MedicineAlert {
  AlertID: string;
  Type: 'LOW_STOCK' | 'EXPIRY' | 'SEASONAL';
  ReferenceID: string;
  Title: string;
  Message: string;
  Severity: 'Critical' | 'Warning' | 'Info';
  Date: string;
  IsRead: boolean;
}

export interface SystemErrorLog {
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

export interface AccountingPeriod {
  id: string;
  Start_Date: string;
  End_Date: string;
  Is_Closed: boolean;
  closedBy?: string;
  closedAt?: string;
}

export interface InvoiceAdjustment {
  AdjustmentID: string;
  InvoiceID: string;
  Type: 'Discount' | 'Additional Fee' | 'Tax Adjustment';
  Value: number;
  IsPercentage: boolean;
  Note: string;
  lastModified?: string;
}

export interface AuditItem {
  itemId: string;
  name: string;
  bookQty: number;
  actualQty?: number;
  status: 'pending' | 'matched' | 'mismatch';
  reason?: string;
}

export interface DailyAuditTask {
  date: string;
  completed: boolean;
  items: AuditItem[];
}

export interface ItemUnit {
  Unit_ID: string;
  Item_ID: string;
  Unit_Name: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  data: any;
  type: 'AUTO' | 'MANUAL';
}

export interface PriceHistory extends SyncableEntity {
  id: string;
  productId: string;
  Item_Name: string;   
  Customer: string;    
  Price: number;       
  Invoice_Date: string; 
}

export interface InvoiceCounter extends SyncableEntity {
  Counter_Type: string; 
  Last_Number: number;  
}

export interface InvoiceHistory {
  id?: number;
  invoiceId: string;
  userId: string;
  userName: string;
  timestamp: string;
  action: 'CREATED' | 'POSTED' | 'UPDATED' | 'CANCELLED';
  details: string;
}

export interface IntegrityReport {
  isHealthy: boolean;
  totalDiff: number;
  timestamp: string;
  points: any[];
}

export interface ReconciliationPoint {
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

export interface PendingOperation {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'syncing' | 'failed';
  retries: number;
  createdAt: string;
}

export interface ValidationRule {
  id: string;
  entityType: 'SALE' | 'PURCHASE' | 'PRODUCT';
  fieldName: string;
  operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'NOT_EQUALS' | 'NOT_EMPTY' | 'MIN_LENGTH';
  comparisonValue: string;
  errorMessage: string;
  isActive: boolean;
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  status: 'pending' | 'completed';
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  status: 'connected' | 'error';
  lastSync?: string;
}

export interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  config: any;
}

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
}

export interface MedicineAlternative {
  id: string;
  MedicineID: string;
  AlternativeID: string;
  PriorityLevel: 'First' | 'Second' | 'Third';
}

export interface MedicineBatch {
  BatchID: string;
  ProductID: string;
  ExpiryDate: string;
  Quantity: number;
}

export interface PurchaseRecord {
  id: string;
  date: string;
  amount: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: 'sale' | 'purchase';
  customer?: string;
}

export interface InvoiceSettlement {
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

export interface PartnerLedgerEntry {
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

export interface SupplierLedgerEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  referenceId?: string;
  linkedInvoices?: string;
}
