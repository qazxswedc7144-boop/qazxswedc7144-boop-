
import { AccountingPeriodRepository } from '../repositories/AccountingPeriodRepository';
import { AccountingError } from '../types';
import { authService } from './auth.service';
import { BackupService } from './backupService';

/**
 * Period Service - نظام حماية الفترات المحاسبية (Accounting Period Locking)
 * مسؤول عن منع العمليات المالية في التواريخ المقفلة
 */
export const periodService = {
  /**
   * التحقق من صلاحية التاريخ للعمليات (الحارس المركزي)
   * يطبق القاعدة: يمنع التعديل/الحذف إلا للمسؤول (Admin Override)
   * @throws AccountingError إذا كان التاريخ مغلقاً والمستخدم ليس مسؤولاً
   */
  validatePeriod: async (date: string): Promise<void> => {
    if (!date) return;
    
    // 1. التحقق من صلاحية المستخدم (Admin Override Only)
    const currentUser = authService.getCurrentUser();
    if (currentUser?.Role === 'Admin') {
      console.log(`[PeriodGuard] Admin override access granted for date: ${date}`);
      return; 
    }
    
    // 2. التحقق من حالة الفترة عبر المستودع (Async)
    const isClosed = await AccountingPeriodRepository.isDateClosed(date);
    if (isClosed) {
      const formattedDate = new Date(date).toLocaleDateString('ar-SA');
      throw new AccountingError(
        `خطأ حماية سيادي (Period Lock): التاريخ [${formattedDate}] يقع ضمن فترة مالية مغلقة ومعتمدة. لا يمكن الإضافة أو التعديل أو الحذف إلا للمسؤولين.`
      );
    }
  },

  /**
   * جلب كافة الفترات المحاسبية
   */
  getPeriods: async () => await AccountingPeriodRepository.getAll(),

  /**
   * إغلاق فترة مالية بشكل نهائي
   */
  closePeriod: async (periodId: string, userId: string) => {
    // PHASE 3 — AUTO BACKUP RULES
    await BackupService.createBackup(`Auto Backup before Closing Period #${periodId}`, 'PRE_PERIOD_CLOSE', false);
    await AccountingPeriodRepository.closePeriod(periodId, userId);
  }
};
