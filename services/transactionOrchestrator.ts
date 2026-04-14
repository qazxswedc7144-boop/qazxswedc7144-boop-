
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
import { pushData, pushChanges } from './syncService';
import { LockService } from './LockService';
import { AIAuditEngine } from './AIAuditEngine';
import { InventoryService } from './InventoryService';
import { AccountingEngine } from './AccountingEngine';
import { PeriodLockEngine } from './PeriodLockEngine';
import { FIFOEngine } from './FIFOEngine';
import { AIInsightsEngine } from '@/core/engines/aiInsightsEngine';

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
    const result = await SystemOrchestrator.processInvoice(invoice as any);
    if (result.success) {
      try {
        await pushChanges();
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    }
    return result;
  },

  async unpostInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    const result = await SystemOrchestrator.unpostInvoice(invoiceId, type);
    if (result.success) {
      try {
        await pushChanges();
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    }
    return result;
  },

  async deleteInvoice(invoiceId: string, type: 'SALE' | 'PURCHASE'): Promise<{ success: boolean }> {
    const result = await SystemOrchestrator.deleteInvoice(invoiceId, type);
    if (result.success) {
      try {
        await pushChanges();
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    }
    return result;
  },

  /**
   * Central execution layer for ERP transactions.
   */
  async processTransaction(type: 'purchase' | 'purchase_return' | 'sale' | 'sale_return' | 'supplier_payment' | 'customer_payment', data: any): Promise<{ success: boolean; refId?: string }> {
    let result: { success: boolean; refId?: string };
    switch(type) {
      case 'purchase':
        result = await this.handlePurchase(data);
        break;
      case 'purchase_return':
        result = await this.handlePurchaseReturn(data);
        break;
      case 'sale':
        result = await this.handleSale(data);
        break;
      case 'sale_return':
        result = await this.handleSalesReturn(data);
        break;
      case 'supplier_payment':
        result = await this.settleSupplier(data);
        break;
      case 'customer_payment':
        result = await this.settleCustomer(data);
        break;
      default:
        throw new Error(`Unknown transaction type: ${type}`);
    }

    // 3. AUTO PUSH AFTER ANY CHANGE
    if (result.success) {
      try {
        await pushChanges();
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    }

    return result;
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
