
import { db } from '../lib/database';
import { authService } from './auth.service';

export interface ErrorLogPayload {
  type: string;
  module: string;
  message: string;
  payload?: any;
  stack?: string;
}

export class ErrorService {
  /**
   * Logs an error to the database and console.
   */
  static async log(error: ErrorLogPayload) {
    const user = authService.getCurrentUser();
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      id: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: error.type,
      timestamp,
      module: error.module,
      message: error.message,
      payload: error.payload ? JSON.stringify(error.payload) : null,
      user: user?.User_Email || 'SYSTEM',
      stack: error.stack || new Error().stack
    };

    console.error(`[ErrorService] [${error.module}] [${error.type}]: ${error.message}`, error.payload);

    try {
      // Use a separate transaction or direct add to avoid interfering with current transaction
      await db.db.System_Error_Log.add(logEntry as any);
      
      // Also add to audit log for high-level visibility
      await db.addAuditLog('SYSTEM', 'OTHER', logEntry.id, `[${error.module}] ${error.message}`);
    } catch (e) {
      console.error("CRITICAL: ErrorService failed to log error to DB", e);
    }
  }

  /**
   * Specifically for transaction failures
   */
  static async logTransactionError(module: string, message: string, payload: any, error: any) {
    await this.log({
      type: 'TRANSACTION_FAILURE',
      module,
      message: `${message}: ${error.message || String(error)}`,
      payload,
      stack: error.stack
    });
  }
}
