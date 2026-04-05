
import { db } from './database';
import { integrityVerifier } from './integrityVerifier';
import { InvoiceItem, SecurityError, InvoiceStatus, ValidationError, AccountingEntry, Sale, Purchase } from '../types';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { AccountRepository } from '../repositories/account.repository';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { FinancialTransactionRepository } from '../repositories/FinancialTransactionRepository';
import { authService } from './auth.service';
import { priceIntelligenceService } from './priceIntelligence.service';
import { dataValidator } from './validators/dataValidator';
import { SharedAutomationActions } from './logic/SharedAutomationActions';
import { FinancialIntegrityValidator } from './validators/FinancialIntegrityValidator';
import { ReconciliationEngine } from './logic/ReconciliationEngine';
import { BusinessRulesEngine } from './logic/BusinessRulesEngine';
import { BackupService } from './backupService';
import { LockService } from './LockService';
import { AIAuditEngine } from './AIAuditEngine';
import { InventoryService } from './InventoryService';
import { AccountingEngine } from './AccountingEngine';
import { PeriodLockEngine } from './PeriodLockEngine';
import { FIFOEngine } from './FIFOEngine';
import { AIInsightsEngine } from '../engines/aiInsightsEngine';

export interface SaleOptions {
  isCash: boolean;
  paymentStatus: 'Cash' | 'Credit';
  currency: string;
  isReturn?: boolean;
  invoiceStatus?: InvoiceStatus; 
  date?: string;
  originalInvoiceId?: string;
}

export interface InvoiceRequest {
  type: 'SALE' | 'PURCHASE';
  payload: {
    customerId?: string;
    supplierId?: string;
    items: InvoiceItem[];
    total: number;
    invoiceId?: string; 
    id?: string; 
    date?: string;
    notes?: string;
    attachment?: string;
  };
  options?: SaleOptions | { isCash: boolean; isReturn: boolean; invoiceStatus?: InvoiceStatus; date?: string; originalInvoiceId?: string };
}

import { SystemOrchestrator } from './SystemOrchestrator';

// We'll modify the existing transactionOrchestrator to use SystemOrchestrator
export const transactionOrchestrator = {
  async processInvoiceTransaction(invoice: InvoiceRequest): Promise<{ success: boolean; refId?: string }> {
    return await SystemOrchestrator.processInvoice(invoice as any);
  },

  async unpostInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    return await SystemOrchestrator.unpostInvoice(invoiceId, type);
  },

  async deleteInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    return await SystemOrchestrator.deleteInvoice(invoiceId, type);
  },

  /**
   * Central execution layer for ERP transactions.
   */
  async processTransaction(type: 'purchase' | 'purchase_return' | 'sale' | 'sale_return' | 'supplier_payment' | 'customer_payment', data: any): Promise<{ success: boolean; refId?: string }> {
    switch(type) {
      case 'purchase':
        return await this.handlePurchase(data);
      case 'purchase_return':
        return await this.handlePurchaseReturn(data);
      case 'sale':
        return await this.handleSale(data);
      case 'sale_return':
        return await this.handleSalesReturn(data);
      case 'supplier_payment':
        return await this.settleSupplier(data);
      case 'customer_payment':
        return await this.settleCustomer(data);
      default:
        throw new Error(`Unknown transaction type: ${type}`);
    }
  },

  async handlePurchase(data: any) {
    return await SystemOrchestrator.processInvoice({
      type: 'PURCHASE',
      payload: {
        supplierId: data.supplierId,
        items: data.items,
        total: data.total,
        date: data.date,
        notes: data.notes,
        id: data.invoiceId
      },
      options: {
        isCash: data.type === 'cash',
        paymentStatus: data.type === 'cash' ? 'Cash' : 'Credit'
      }
    });
  },

  async handlePurchaseReturn(data: any) {
    return await SystemOrchestrator.processInvoice({
      type: 'PURCHASE',
      payload: {
        supplierId: data.supplierId,
        items: data.items,
        total: data.total,
        date: data.date,
        notes: data.notes,
        id: data.invoiceId
      },
      options: {
        isReturn: true,
        isCash: data.type === 'cash',
        paymentStatus: data.type === 'cash' ? 'Cash' : 'Credit'
      }
    });
  },

  async handleSale(data: any) {
    return await SystemOrchestrator.processInvoice({
      type: 'SALE',
      payload: {
        customerId: data.customerId,
        items: data.items,
        total: data.total,
        date: data.date,
        notes: data.notes,
        id: data.invoiceId
      },
      options: {
        isCash: data.type === 'cash',
        paymentStatus: data.type === 'cash' ? 'Cash' : 'Credit'
      }
    });
  },

  async handleSalesReturn(data: any) {
    return await SystemOrchestrator.processInvoice({
      type: 'SALE',
      payload: {
        customerId: data.customerId,
        items: data.items,
        total: data.total,
        date: data.date,
        notes: data.notes,
        id: data.invoiceId
      },
      options: {
        isReturn: true,
        isCash: data.type === 'cash',
        paymentStatus: data.type === 'cash' ? 'Cash' : 'Credit'
      }
    });
  },

  async settleSupplier(data: any) {
    const { voucherService } = await import('./voucherService');
    const result = await voucherService.createPayment({
      supplier_id: data.supplierId,
      amount: data.amount,
      notes: data.notes,
      date: data.date || new Date().toISOString()
    });
    return { success: true, refId: result.id };
  },

  async settleCustomer(data: any) {
    const { voucherService } = await import('./voucherService');
    const result = await voucherService.createReceipt({
      customer_id: data.customerId,
      amount: data.amount,
      notes: data.notes,
      date: data.date || new Date().toISOString()
    });
    return { success: true, refId: result.id };
  }
};
