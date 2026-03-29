
import { AccountingPeriodRepository } from '../repositories/AccountingPeriodRepository';
import { AccountingError } from '../types';
import { authService } from './auth.service';
import { BackupService } from './backupService';
import { PeriodLockEngine } from './PeriodLockEngine';

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
    try {
      await PeriodLockEngine.validateOperation(date, 'عملية محاسبية');
    } catch (error: any) {
      if (error.message.includes('SECURITY_BLOCK')) {
        throw new AccountingError(error.message);
      }
      throw error;
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
