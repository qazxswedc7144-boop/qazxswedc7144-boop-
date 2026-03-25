
import { db } from '../services/database';

export interface JournalRule {
  id: string;
  debit: string;
  credit: string;
  description: string;
}

/**
 * JournalRulesProvider - محرك استرجاع القواعد الديناميكي
 * يستمد بياناته من قاعدة البيانات (Dexie) التي تم استنباتها من config/journalRules.ts
 */
export const JournalRulesProvider = {
  
  /**
   * جلب قاعدة محددة مع نظام Fallback أمني للحالات الحرجة
   */
  getRule(key: string): JournalRule {
    const dbRules = db.getJournalRules();
    const rule = dbRules.find(r => r.id === key);
    
    if (rule) return rule;
    
    // Fallback أمني صارم لمنع تعليق النظام في حال فقدان سجل قاعدة
    console.warn(`[RulesEngine] Security Alert: Routing rule "${key}" missing in DB. Using Failsafe suspense account.`);
    
    return {
      id: key,
      debit: 'ACC-SUSPENSE', 
      credit: 'ACC-SUSPENSE',
      description: 'حساب معلق - قاعدة غير معرفة (فشل التوجيه)'
    };
  },

  /**
   * جلب كافة القواعد الحالية المسجلة في النظام
   */
  getAllRules(): JournalRule[] {
    return db.getJournalRules();
  }
};
