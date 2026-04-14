
import { db } from '../services/database';
import { FinancialAuditEntry } from '../types';
import { authService } from '../services/auth.service';

/**
 * Audit Repository - حارس سجلات الرقابة السيادية
 * كافة السجلات هنا Immutable (للقراءة والإضافة فقط)
 */
export const AuditRepository = {

  /**
   * جلب كافة السجلات مع ترتيب زمني تنازلي
   */
  getAll: async (limit: number = 500): Promise<FinancialAuditEntry[]> => {
    return await db.db.Audit_Log
      .orderBy('Modified_At')
      .reverse()
      .limit(limit)
      .toArray();
  },

  /**
   * فلترة السجلات حسب المستند (Contextual Audit Trail)
   */
  getByRecord: async (recordId: string): Promise<FinancialAuditEntry[]> => {
    if (!recordId) return [];
    return await db.db.Audit_Log
      .where('Record_ID')
      .equals(recordId)
      .reverse()
      .sortBy('Modified_At');
  },

  /**
   * تسجيل حركة يدوية من الوحدات البرمجية (Explicit Module Logging)
   */
  logAction: async (module: string, recordId: string, action: string, before: any, after: any): Promise<void> => {
    const user = authService.getCurrentUser();
    const now = new Date().toISOString();
    
    const entry: FinancialAuditEntry = {
      id: db.generateId('AUD'),
      Log_ID: db.generateId('AUD-MAN'),
      Table_Name: module,
      Record_ID: recordId,
      Column_Name: action,
      Old_Value: typeof before === 'object' ? JSON.stringify(before) : String(before),
      New_Value: typeof after === 'object' ? JSON.stringify(after) : String(after),
      Change_Type: 'UPDATE',
      Modified_By: user?.User_Email || 'SYSTEM',
      Modified_At: now,
      Created_At: now,
      Last_Updated: now,
      Device_Info: navigator.userAgent,
      System_Flags: 'MANUAL_MODULE_LOG'
    };

    // الإضافة مباشرة عبر Dexie لتجنب الحواجز البرمجية العادية
    await db.db.Audit_Log.add(entry);
  }
};
