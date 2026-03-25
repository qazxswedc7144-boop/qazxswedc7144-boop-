
import { InvoiceStatus, InvoiceItem, PaymentStatus } from '../../types';
import { SharedCalculations } from './SharedCalculations';
import { InvoiceWorkflowEngine } from './InvoiceWorkflowEngine';
import { AutoJournalMapper } from '../../accounting/AutoJournalMapper';

/**
 * Business Rules Engine (BRE) - المحرك السيادي لقواعد العمل
 * المركز الرئيسي لكافة القرارات المنطقية في النظام
 */
export const BusinessRulesEngine = {
  
  // --- 1. قواعد المحاسبة (Accounting Rules) ---
  accounting: {
    /**
     * توليد القيود المحاسبية بناءً على نوع العملية
     */
    generateEntries: (type: 'SALE' | 'PURCHASE', payload: any) => {
      if (type === 'SALE') return AutoJournalMapper.mapSaleToEntries(payload);
      return AutoJournalMapper.mapPurchaseToEntries(payload);
    },
    
    /**
     * حساب التأثير المالي للسندات
     */
    mapVoucherToJournal: (vData: any) => AutoJournalMapper.mapVoucherToEntries(vData)
  },

  // --- 2. قواعد المرتجعات (Return Logic) ---
  returns: {
    /**
     * تحديد معامل الكمية للمخزن بناءً على نوع المرتجع
     */
    getQuantityMultiplier: (docType: 'SALE' | 'PURCHASE', isReturn: boolean): number => {
      // البيع ينقص المخزن (-1)، المشتريات تزيد (+1)
      const base = (docType === 'SALE') ? -1 : 1;
      // المرتجع يعكس العملية الأصلية
      return isReturn ? (base * -1) : base;
    },

    /**
     * التحقق من مطابقة طريقة سداد المرتجع مع الأصل
     */
    validateReturnPaymentMatch: (originalMethod: string, returnMethod: string): boolean => {
      return originalMethod === returnMethod;
    }
  },

  // --- 3. قواعد تخصيص المدفوعات (Payment Allocation) ---
  payments: {
    /**
     * تحديد الحالة المالية للفاتورة بناءً على المبالغ
     */
    deriveFinancialStatus: (paid: number, total: number): PaymentStatus => {
      return SharedCalculations.derivePaymentStatus(paid, total);
    },

    /**
     * التحقق من صحة مبلغ التخصيص
     */
    isAllocationValid: (amount: number, remaining: number): boolean => {
      return amount > 0 && amount <= (parseFloat(remaining.toFixed(2)) + 0.01);
    }
  },

  // --- 4. قواعد المخزون (Inventory Rules) ---
  inventory: {
    /**
     * حساب التغيير الفعلي في المخزن
     */
    calculateStockChange: (qty: number, docType: 'SALE' | 'PURCHASE', isReturn: boolean): number => {
      return qty * BusinessRulesEngine.returns.getQuantityMultiplier(docType, isReturn);
    }
  },

  // --- 5. قواعد سير العمل (Workflow Rules) ---
  workflow: {
    /**
     * فحص صلاحية الانتقال بين الحالات
     */
    canTransitionTo: (current: InvoiceStatus, next: InvoiceStatus): boolean => {
      return InvoiceWorkflowEngine.isValidTransition(current, next);
    },

    /**
     * تحديد الحالة التلقائية التالية للفاتورة
     */
    getNextAutomaticStatus: (total: number, paid: number, currentStatus: InvoiceStatus): InvoiceStatus => {
      return InvoiceWorkflowEngine.determineNextStatus(total, paid, currentStatus);
    },

    /**
     * هل المستند مقفل للتعديل؟
     */
    isDocumentLocked: (status: InvoiceStatus): boolean => {
      return InvoiceWorkflowEngine.isLocked(status);
    }
  }
};
