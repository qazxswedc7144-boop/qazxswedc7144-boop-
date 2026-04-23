
import { db } from '../lib/database';
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
   * جلب الفترة النشطة حالياً (غير المقفلة)
   */
  getActivePeriod: async (): Promise<AccountingPeriod | undefined> => {
    const all = await db.getAccountingPeriods();
    return all.find(p => !p.Is_Locked);
  },

  /**
   * الفحص الأساسي: هل يقع التاريخ ضمن نطاق فترة مقفلة؟
   */
  isDateClosed: async (dateStr: string): Promise<boolean> => {
    return await db.isDateLocked(dateStr);
  },

  /**
   * قفل فترة محددة وتوثيق المسؤول عن القفل
   */
  closePeriod: async (periodId: string, userId: string) => {
    const periods = await db.getAccountingPeriods();
    const period = periods.find(p => p.id === periodId);
    if (period) {
      period.Is_Locked = true;
      period.Locked_By = userId;
      period.Locked_At = new Date().toISOString();
      period.lastModified = new Date().toISOString();
      await db.saveAccountingPeriod(period);
    }
  },

  /**
   * فتح فترة مقفلة (للمسؤولين)
   */
  openPeriod: async (periodId: string) => {
    const periods = await db.getAccountingPeriods();
    const period = periods.find(p => p.id === periodId);
    if (period) {
      period.Is_Locked = false;
      period.lastModified = new Date().toISOString();
      await db.saveAccountingPeriod(period);
    }
  },

  /**
   * إنشاء فترة محاسبية جديدة
   */
  createPeriod: async (startDate: string, endDate: string) => {
    const period: AccountingPeriod = {
      id: db.generateId('PER'),
      Start_Date: startDate,
      End_Date: endDate,
      Is_Locked: false,
      lastModified: new Date().toISOString()
    };
    await db.saveAccountingPeriod(period);
    return period.id;
  }
};
