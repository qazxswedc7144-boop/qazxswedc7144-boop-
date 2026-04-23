import { db } from '../lib/database';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SALE' | 'PURCHASE' | 'INVENTORY_ADJUSTMENT' | 'STOCK_IN' | 'STOCK_OUT';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  Modified_At: string;
  Table_Name: string;
  Change_Type: AuditAction;
  Entity_ID: string;
  Old_Data: any;
  New_Data: any;
  user_id?: string;
  details?: string;
  isSynced: number;
}

export const auditLogService = {
  /**
   * Records an audit entry in the local database
   */
  async log(params: {
    table: string;
    action: AuditAction;
    entityId: string;
    oldData?: any;
    newData?: any;
    details?: string;
    userId?: string;
  }) {
    try {
      const entry: AuditLogEntry = {
        id: db.generateId('AUD'),
        timestamp: new Date().toISOString(),
        Modified_At: new Date().toISOString(),
        Table_Name: params.table,
        Change_Type: params.action,
        Entity_ID: params.entityId,
        Old_Data: params.oldData || null,
        New_Data: params.newData || null,
        user_id: params.userId,
        details: params.details,
        isSynced: 0
      };

      await db.audit_log.add(entry);
      console.log(`[AuditLog] Recorded ${params.action} on ${params.table} (${params.entityId})`);
    } catch (error) {
      console.error("[AuditLog] Failed to record log:", error);
    }
  },

  /**
   * Helper for quick sales logging
   */
  async logSale(invoiceId: string, details: string, data: any) {
    return this.log({
      table: 'invoices',
      action: 'SALE',
      entityId: invoiceId,
      newData: data,
      details
    });
  },

  /**
   * Helper for quick inventory logging
   */
  async logInventory(productId: string, action: AuditAction, oldQty: number, newQty: number, details: string) {
    return this.log({
      table: 'products',
      action,
      entityId: productId,
      oldData: { quantity: oldQty },
      newData: { quantity: newQty },
      details
    });
  }
};
