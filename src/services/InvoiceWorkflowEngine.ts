
import { InvoiceStatus } from '../types';

/**
 * InvoiceWorkflowEngine - محرك قواعد سير عمل الفواتير المتقدم
 * مسؤول عن التحقق من صحة الانتقال بين حالات المستند (Status Transitions)
 */
export const InvoiceWorkflowEngine = {
  /**
   * القواعد المحددة:
   * DRAFT -> PENDING (عند الحفظ الأول)
   * PENDING -> POSTED (عند الترحيل للدفاتر)
   * POSTED -> LOCKED (عند إغلاق الفترة أو التدقيق النهائي)
   * ANY -> CANCELLED (إلغاء منطقي)
   */
  isValidTransition: (current: InvoiceStatus, next: InvoiceStatus): boolean => {
    const c = current as string;
    const n = next as string;
    if (c === n) return true;
    if (n === 'CANCELLED' || n === 'VOID') return c !== 'LOCKED';
    if (c === 'LOCKED' || c === 'CANCELLED' || c === 'VOID') return false;

    switch (c) {
      case 'DRAFT':
      case 'DRAFT_EDIT':
        return n === 'PENDING' || n === 'POSTED';
      case 'PENDING':
        return n === 'POSTED';
      case 'POSTED':
        return n === 'DRAFT_EDIT' || n === 'VOID' || n === 'LOCKED';
      default:
        return false;
    }
  },

  isLocked: (status: InvoiceStatus): boolean => {
    return status === 'POSTED' || status === 'LOCKED' || status === 'CANCELLED' || status === 'VOID';
  },

  determineNextStatus: (total: number, paid: number, current: InvoiceStatus): InvoiceStatus => {
    if (current === 'CANCELLED' || current === 'LOCKED') return current;
    if (paid >= total) return 'POSTED';
    return 'PENDING';
  }
};
