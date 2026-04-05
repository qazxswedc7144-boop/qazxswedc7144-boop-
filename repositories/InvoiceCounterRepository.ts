
import { db } from '../services/database';
import { InvoiceCounter } from '../types';

/**
 * Invoice Counter Repository - حارس الترقيم التسلسلي السيادي (Phase 11)
 */
export const InvoiceCounterRepository = {
  
  /**
   * استخراج الرقم التالي لنوع معين من المستندات (Sales, Purchase)
   * يتم ذلك ضمن Transaction لضمان عدم تكرار الرقم أبداً تحت أي ظرف
   */
  getNextNumber: async (type: 'Sales' | 'Purchase', initialValue: number = 1000): Promise<number> => {
    return await db.runTransaction(async () => {
      // استخدام الجدول السيادي المحدث
      let counter = await db.db.Invoice_Counters.get(type);
      
      if (!counter) {
        // إنشاء عداد جديد إذا لم يكن موجوداً
        counter = {
          id: type,
          Counter_Type: type,
          Last_Number: initialValue,
          lastModified: new Date().toISOString(),
          syncStatus: 'NEW'
        };
      }

      // زيادة العداد بشكل ذري
      const nextNum = counter.Last_Number + 1;
      counter.Last_Number = nextNum;
      counter.lastModified = new Date().toISOString();
      
      await db.db.Invoice_Counters.put(counter);
      return nextNum;
    });
  },

  /**
   * جلب القيمة الحالية للعداد دون زيادتها
   */
  getCurrentNumber: async (type: 'Sales' | 'Purchase'): Promise<number> => {
    const counter = await db.db.Invoice_Counters.get(type);
    return counter ? counter.Last_Number : 0;
  },

  /**
   * إعادة ضبط العداد أو تحديثه يدوياً
   */
  setCounter: async (type: 'Sales' | 'Purchase', value: number): Promise<void> => {
    const counter: InvoiceCounter = {
      id: type,
      Counter_Type: type,
      Last_Number: value,
      lastModified: new Date().toISOString(),
      syncStatus: 'UPDATED'
    };
    await db.db.Invoice_Counters.put(counter);
  }
};
