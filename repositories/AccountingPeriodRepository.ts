
import { db } from '../services/database';
import { AccountingPeriod } from '../types';

/**
 * AccountingPeriod Repository - حارس الفترات الزمنية
 */
export const AccountingPeriodRepository = {
  /**
   * جلب كافة سجلات الفترات من قاعدة البيانات
   */
  getAll: async (): Promise<AccountingPeriod[]> => {
    return await db.getAccountingPeriods();
  },

  /**
   * جلب الفترة النشطة حالياً (غير المغلقة)
   */
  getActivePeriod: async (): Promise<AccountingPeriod | undefined> => {
    const all = await db.getAccountingPeriods();
    return all.find(p => !p.Is_Closed);
  },

  /**
   * الفحص الأساسي: هل يقع التاريخ ضمن نطاق فترة مغلقة؟
   */
  isDateClosed: async (dateStr: string): Promise<boolean> => {
    return await db.isDateLocked(dateStr);
  },

  /**
   * إغلاق فترة محددة وتوثيق المسؤول عن الإغلاق
   */
  closePeriod: async (periodId: string, userId: string) => {
    const periods = await db.getAccountingPeriods();
    const idx = periods.findIndex(p => p.id === periodId);
    if (idx > -1) {
      const period = { ...periods[idx] };
      period.Is_Closed = true;
      period.closedBy = userId;
      period.closedAt = new Date().toISOString();
      await db.saveAccountingPeriod(period);
    }
  },

  /**
   * فتح فترة مقفلة (للمسؤولين)
   */
  openPeriod: async (periodId: string) => {
    const periods = await db.getAccountingPeriods();
    const idx = periods.findIndex(p => p.id === periodId);
    if (idx > -1) {
      const period = { ...periods[idx] };
      period.Is_Closed = false;
      await db.saveAccountingPeriod(period);
    }
  },

  /**
   * إنشاء فترة محاسبية جديدة
   */
  createPeriod: async (startDate: string, endDate: string) => {
    const period: AccountingPeriod = {
      id: `PER-${Date.now()}`,
      Start_Date: startDate,
      End_Date: endDate,
      Is_Closed: false
    };
    await db.saveAccountingPeriod(period);
    return period.id;
  }
};
