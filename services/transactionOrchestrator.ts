
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
  }
};
