// src/types/index.ts

// Re-export modular Type-safe Enterprise types
export * from "./common.types";
export * from "./invoice.types";
export * from "./accounting.types";
export * from "./inventory.types";
export * from "./api.types";
export * from "./ai.types";
export * from "./auth.types";
export * from "./database.types";
export * from "../modules/events/event.types";

import { SyncableEntity, SubscriptionPlan, TenantStatus } from "./common.types";

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
  entry_count?: number; 
  is_trial?: boolean;   
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

export type SyncQueueStatus = 'PENDING' | 'SYNCED' | 'CONFLICT';
export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem extends SyncableEntity {
  id: string;
  entityType: string;
  entityId: string;
  action: SyncAction;
  payload: string; 
  localTimestamp: string;
  syncStatus: SyncQueueStatus;
  retryCount: number;
  error?: string;
}

export interface ConflictArchive extends SyncableEntity {
  id: string;
  entityType: string;
  entityId: string;
  data: string; 
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
  date: string; 
  numberOfEdits: number;
  unlockAttempts: number;
  repostFrequency: number;
  deleteAttempts: number;
  afterHoursActions: number;
  failedLogins: number;
  lastActionAt: string;
}

export interface HistoricalMetric extends SyncableEntity {
  id: string;
  month: string; 
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

export interface SystemBackup extends SyncableEntity {
  id: string;
  backupName: string;
  backupType: 'MANUAL' | 'AUTO' | 'PRE_UNPOST' | 'PRE_EDIT' | 'PRE_DELETE' | 'PRE_VOUCHER_DELETE' | 'PRE_PERIOD_CLOSE' | 'SCHEDULED_DAILY' | 'SCHEDULED_WEEKLY';
  createdAt: string;
  createdBy: string;
  systemVersion: string;
  dataSnapshot: string; 
  checksumHash: string;
  sizeInKB: number;
  status: 'SUCCESS' | 'FAILED';
  restoreTested: boolean;
  isIncremental?: boolean;
  parentBackupId?: string; 
}

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

export interface InventoryLog extends SyncableEntity {
  id: string;
  productId: string;
  type: 'add' | 'remove' | 'return';
  qty: number;
  date: number;
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

  // Compatibility properties
  amount?: number;
  type?: string;
  partner_id?: string;
  partnerId?: string;
  supplierId?: string;
  supplier_id?: string;
  customer_id?: string;
  customerId?: string;
}

export interface Supplier extends SyncableEntity {
  Supplier_ID: string;      
  Supplier_Name: string;    
  name?: string; 
  Phone?: string;
  Address?: string;
  balance: number;          
  openingBalance: number; 
  purchaseHistory?: any[];
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

export interface CashLog extends SyncableEntity {
  id: string;
  type: string;
  amount: number;
  date: number;
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

export interface BackupSnapshot extends SyncableEntity {
  id: string;
  timestamp: string;
  data: any;
  type: 'AUTO' | 'MANUAL';
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
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'POST' | 'CANCEL' | 'SYSTEM' | 'RESTORE';
  target_type: 'SALE' | 'PURCHASE' | 'VOUCHER' | 'PRODUCT' | 'SYSTEM' | 'OTHER';
  target_id: string;
  timestamp: string;
  Modified_At?: string;
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
  paymentMethod?: 'CASH' | 'TRANSFER';
  created_at: string;
}

export interface Payment extends SyncableEntity {
  id: string;
  date: string;
  supplier_id: string;
  amount: number;
  notes?: string;
  paymentMethod?: 'CASH' | 'TRANSFER';
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

export interface Currency extends SyncableEntity {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
}
