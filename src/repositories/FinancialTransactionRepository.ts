
import { db } from '../lib/database';
import { FinancialTransaction } from '../types';
import { authService } from '../services/auth.service';

/**
 * FinancialTransaction Repository - مركز التحكم في الحركات المالية (Phase 11 Update)
 */
export const FinancialTransactionRepository = {
  
  getAll: async (): Promise<FinancialTransaction[]> => {
    return await db.db.financialTransactions.orderBy('Transaction_Date').reverse().toArray();
  },

  getById: async (id: string): Promise<FinancialTransaction | undefined> => {
    return await db.db.financialTransactions.get(id);
  },

  getByReference: async (refId: string): Promise<FinancialTransaction[]> => {
    if (!refId) return [];
    return await db.db.financialTransactions.where('Reference_ID').equals(refId).toArray();
  },

  /**
   * تسجيل حركة مالية مركزية جديدة (Unique Transaction Registry)
   */
  // Fix: Added Paid_Amount to Omit and made it optional in the input type to allow defaulting to Amount in implementation
  record: async (data: Omit<FinancialTransaction, 'Transaction_ID' | 'Created_At' | 'Created_By' | 'lastModified' | 'Transaction_Date' | 'Paid_Amount'> & { Transaction_Date?: string; Paid_Amount?: number }): Promise<string> => {
    const user = authService.getCurrentUser();
    const id = db.generateId('TRX');
    const now = new Date().toISOString();
    
    const transaction: FinancialTransaction = {
      ...data,
      id: id,
      Transaction_ID: id,
      Paid_Amount: data.Paid_Amount || data.Amount || 0, 
      Transaction_Date: data.Transaction_Date || now,
      // Created_At: NOW()
      Created_At: now,
      // Created_By: USEREMAIL()
      Created_By: user?.User_Email || 'SYSTEM',
      lastModified: now
    } as FinancialTransaction;

    await db.db.financialTransactions.put(transaction);
    
    await db.addAuditLog(
      'CREATE', 
      'VOUCHER',
      transaction.Reference_ID, 
      `تم تسجيل مبلغ مسدد بقيمة ${transaction.Paid_Amount.toLocaleString()} د.إ (${transaction.Transaction_Type}) لجهة: ${transaction.Entity_Name}`
    );

    return id;
  },

  /**
   * حذف أو إلغاء حركة (Logical Delete)
   */
  cancelTransaction: async (refId: string): Promise<void> => {
    const transactions = await FinancialTransactionRepository.getByReference(refId);
    const now = new Date().toISOString();
    for (const trx of transactions) {
      trx.isDeleted = true;
      trx.lastModified = now;
      await db.db.financialTransactions.put(trx);
    }
  }
};