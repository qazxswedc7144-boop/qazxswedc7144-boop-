
import { db } from '@/core/db';

export class AuditLogService {
  async log(actionOrPayload: string | any, targetType?: string, targetId?: string, details?: string): Promise<void> {
    try {
      if (typeof actionOrPayload === 'object' && actionOrPayload !== null) {
        await db.auditLogs.add({
          id: db.generateId('LOG'),
          timestamp: new Date().toISOString(),
          user_id: actionOrPayload.user_id || 'SYSTEM',
          action: actionOrPayload.action || 'INFO',
          target_type: actionOrPayload.target_type || 'SYSTEM',
          target_id: actionOrPayload.target_id || '',
          details: actionOrPayload.details || ''
        });
      } else {
        await db.auditLogs.add({
          id: db.generateId('LOG'),
          user_id: 'SYSTEM',
          action: actionOrPayload as any,
          target_type: targetType as any,
          target_id: targetId || '',
          timestamp: new Date().toISOString(),
          details: details || ''
        });
      }
    } catch (error) {
      console.error('[AuditLog] Failed to log action:', error);
    }
  }

  async logSale(sale: any, msg?: string, extra?: any) {
    const id = typeof sale === 'object' ? sale.id : sale;
    const total = typeof sale === 'object' ? sale.finalTotal : (extra?.total || 0);
    await this.log('POST', 'SALE', id, msg || `Sale posted: ${total}`);
  }

  async getRecentLogs(limit = 50) {
    try {
      return await db.auditLogs.orderBy('timestamp').reverse().limit(limit).toArray();
    } catch (error) {
      console.error('[AuditLog] Failed to fetch logs:', error);
      return [];
    }
  }
}

export const auditLogService = new AuditLogService();
