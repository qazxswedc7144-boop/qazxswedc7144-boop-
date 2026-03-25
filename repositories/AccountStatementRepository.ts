
import { db } from '../services/database';
import { FinancialTransaction } from '../types';
import { FinancialTransactionRepository } from './FinancialTransactionRepository';

/**
 * Account Statement Repository - الجدول الافتراضي لكشوف الحسابات (Phase 11)
 * يقوم بدمج الحركات المالية وحساب الرصيد التراكمي (Running Balance)
 */
export const AccountStatementRepository = {
  
  /**
   * توليد كشف حساب كامل لجهة معينة (عميل أو مورد)
   */
  getStatement: async (entityName: string, partnerType: 'Customer' | 'Supplier'): Promise<any[]> => {
    // 1. جلب كافة الحركات المالية المرتبطة بهذا الاسم من الجدول المركزي (Phase 11 Columns)
    const allTransactions = await FinancialTransactionRepository.getAll();
    const entityTransactions = allTransactions.filter(tx => 
      tx.Entity_Name === entityName && !tx.isDeleted
    );

    // 2. الفرز حسب تاريخ الحركة (صعوداً) لبناء الرصيد التراكمي بشكل صحيح
    const sorted = entityTransactions.sort((a, b) => 
      new Date(a.Transaction_Date).getTime() - new Date(b.Transaction_Date).getTime()
    );

    // 3. حساب الرصيد التراكمي (Running Balance Calculation) باستخدام Direction الجديد
    let runningBalance = 0;
    
    return sorted.map(tx => {
      const debit = tx.Direction === 'Debit' ? tx.Amount : 0;
      const credit = tx.Direction === 'Credit' ? tx.Amount : 0;

      if (partnerType === 'Customer') {
        // العميل: المدين يرفع المديونية، الدائن يقللها
        runningBalance += (debit - credit);
      } else {
        // المورد: الدائن يرفع المستحقات، المدين يقللها
        runningBalance += (credit - debit);
      }

      return {
        id: tx.Transaction_ID,
        date: tx.Transaction_Date,
        type: tx.Transaction_Type, 
        referenceId: tx.Reference_ID,
        description: tx.Notes,
        debit,
        credit,
        runningBalance: parseFloat(runningBalance.toFixed(2))
      };
    });
  }
};
