import { db } from '@/core/db';
import { authService } from '@/modules/auth/services/authService';

export type AuditActionType = 'CREATE' | 'EDIT' | 'DELETE' | 'REVERSE' | 'PRINT' | 'EXPORT' | 'LOGIN' | 'LOGOUT';

export interface AdvancedAuditLogEntry {
  id: string; // db primary key
  timestamp: string;
  action: AuditActionType;
  module: string;
  transactionUuid: string;
  userId: string;
  userEmail: string;
  branchId: string;
  branchName: string;
  device: string;
  beforeValues: string;
  afterValues: string;
  // Backward compatibility keys
  Table_Name?: string;
  Record_ID?: string;
  Old_Value?: string;
  New_Value?: string;
  Modified_By?: string;
  Modified_At?: string;
}

export const AuditService = {
  log: async (params: {
    action: AuditActionType;
    module: string;
    transactionUuid: string;
    before?: any;
    after?: any;
    recordId?: string;
  }): Promise<void> => {
    try {
      const user = (authService?.getCurrentUser() || { id: 'unknown', User_Email: 'SYSTEM', branchId: 'unknown', Branch_Name: 'Main' }) as any;
      const now = new Date().toISOString();
      const userEmail = user.email || user.User_Email || 'SYSTEM';

      const entry: AdvancedAuditLogEntry = {
        id: db.generateId('AUD'),
        timestamp: now,
        action: params.action,
        module: params.module,
        transactionUuid: params.transactionUuid,
        userId: user.id || user.UserId || 'unknown',
        userEmail: userEmail,
        branchId: user.branchId || user.BranchId || 'unknown',
        branchName: user.branchName || user.Branch_Name || 'Main',
        device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
        beforeValues: params.before ? (typeof params.before === 'string' ? params.before : JSON.stringify(params.before)) : '',
        afterValues: params.after ? (typeof params.after === 'string' ? params.after : JSON.stringify(params.after)) : '',
        
        // Backward compatibility mappings
        Table_Name: params.module,
        Record_ID: params.recordId || params.transactionUuid,
        Old_Value: params.before ? (typeof params.before === 'string' ? params.before : JSON.stringify(params.before)) : '',
        New_Value: params.after ? (typeof params.after === 'string' ? params.after : JSON.stringify(params.after)) : '',
        Modified_By: userEmail,
        Modified_At: now
      };

      await db.Audit_Log.add(entry);
      console.log(`[AuditService] Action Logger Saved: ${params.action} - ${params.module}`);
    } catch (e) {
      console.error('Failed to write into Audit_Log table inside AuditService:', e);
    }
  },

  getAll: async (): Promise<AdvancedAuditLogEntry[]> => {
    try {
      const raw = await db.Audit_Log.orderBy('timestamp').reverse().toArray();
      // Map legacy items to ensure we don't crash on null properties
      return raw.map((item: any) => ({
        id: item.id || item.Log_ID || String(Math.random()),
        timestamp: item.timestamp || item.Modified_At || new Date().toISOString(),
        action: (item.action || item.Change_Type || 'EDIT') as AuditActionType,
        module: item.module || item.Table_Name || 'GENERAL',
        transactionUuid: item.transactionUuid || item.Record_ID || '',
        userId: item.userId || 'unknown',
        userEmail: item.userEmail || item.Modified_By || 'SYSTEM',
        branchId: item.branchId || 'unknown',
        branchName: item.branchName || 'Main',
        device: item.device || item.Device_Info || 'Web browser',
        beforeValues: item.beforeValues || item.Old_Value || '',
        afterValues: item.afterValues || item.New_Value || ''
      }));
    } catch (e) {
      console.error('Failed to get Audit Logs:', e);
      return [];
    }
  }
};
