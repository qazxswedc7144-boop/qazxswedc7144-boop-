// src/types/invoice.types.ts
import { SyncableEntity, PaymentStatus } from "./common.types";

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'POSTED' | 'LOCKED' | 'CANCELLED' | 'DRAFT_EDIT' | 'VOID';

export interface InvoiceItem extends SyncableEntity {
  id: string;
  parent_id: string; 
  product_id: string;
  batchId?: string;
  row_order: number; 
  name: string;
  qty: number;
  price: number;
  sum: number;
  discount_val?: number;
  tax_val?: number;
  unit?: string;
  expiryDate?: string;
  category?: string;
  notes?: string;
}

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
  branchId?: string;

  // Compatibility fields
  SaleID?: string;
  customerId?: string;
  supplierId?: string;
  supplier_id?: string;
  purchase_id?: string;
  invoiceId?: string;
  invoiceStatus?: InvoiceStatus;
  InvoiceStatus?: InvoiceStatus;
  totalAmount?: number;
  status?: string;
  payment_status?: string;
}

export interface Sale extends SyncableEntity {
  id: string;
  SaleID: string;
  date: string;
  customerId: string;
  finalTotal: number;
  subtotal?: number; 
  tax?: number; 
  paymentStatus: 'Cash' | 'Credit';
  branchId: string;
  items: InvoiceItem[];
  totalCost: number;
  isReturn?: boolean;
  currency?: string;
  InvoiceStatus?: InvoiceStatus;
  documentStatus?: InvoiceStatus;
  versionNumber?: number;
  hash?: string;
  notes?: string;
  paidAmount?: number;
  status?: string;
  payment_status?: string;
}

export interface Purchase extends SyncableEntity {
  id: string;
  purchase_id: string;
  invoiceId: string;
  date: string;
  partnerId: string;
  partnerName?: string; 
  totalAmount: number; 
  subtotal?: number; 
  tax?: number; 
  status: 'PAID' | 'UNPAID';
  payment_status?: PaymentStatus; 
  invoiceStatus: InvoiceStatus;
  branchId: string;
  items: InvoiceItem[];
  paidAmount?: number; 
  notes?: string;
}
