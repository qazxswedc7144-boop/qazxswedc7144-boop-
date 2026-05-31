export type AggregateType = 'INVOICE' | 'INVENTORY' | 'LEDGER' | 'RESERVATION' | 'SYNC';

export type EnterpriseEventType =
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'PURCHASE_POSTED'
  | 'SALE_POSTED'
  | 'PURCHASE_RETURNED'
  | 'SALE_RETURNED'
  | 'STOCK_RESERVED'
  | 'STOCK_RELEASED'
  | 'STOCK_ADJUSTED'
  | 'JOURNAL_CREATED'
  | 'JOURNAL_POSTED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CANCELLED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED';

export interface BaseEventStoreItem {
  id?: number; // للمحلي (Dexie) أو المعرف التلقائي السحابي
  eventId: string; // UUID فريد لكل حدث
  aggregateId: string; // المعرف الفريد للكيان (مثل رقم الفاتورة أو معرف المادة)
  aggregateType: AggregateType;
  eventType: EnterpriseEventType;
  version: number; // للتحكم المتفائل بالتوازي (Optimistic Concurrency)
  payload: Record<string, unknown>; // JSONB سحابياً ومخزن كـ Object محلياً
  metadata: {
    actorId: string;
    deviceId: string;
    sessionId: string;
    correlationId: string;
    timestamp: number;
    ipAddress?: string;
  };
  createdAt: Date;
}

export interface ProductReadModel {
  productId: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  updatedAt: Date;
}

export interface InventoryReadModel {
  batchId: string;
  productId: string;
  quantityOnHand: number;
  expiryDate: Date;
  warehouseLocation: string;
  version: number; // لمطابقة تسلسل الـ Event Store
  updatedAt: Date;
}

export interface CustomerReadModel {
  customerId: string;
  name: string;
  taxNumber?: string;
  currentBalance: number;
  updatedAt: Date;
}

export interface SupplierReadModel {
  supplierId: string;
  companyName: string;
  currentBalance: number;
  updatedAt: Date;
}

export interface InvoiceReadModel {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  taxAmount: number;
  status: 'DRAFT' | 'PAID' | 'CANCELLED';
  createdAt: Date;
}

export interface LedgerReadModel {
  accountNumber: string;
  accountName: string;
  currentBalance: number;
  debitTotal: number;
  creditTotal: number;
  lastSequenceProcessed: string;
  updatedAt: Date;
}

export interface AuditReadModel {
  auditId: string;
  userId: string;
  action: string;
  ipAddress: string;
  createdAt: Date;
}

export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  stateSnapshot: Record<string, unknown>;
  createdAt: Date;
}
