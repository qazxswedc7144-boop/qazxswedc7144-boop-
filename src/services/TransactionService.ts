
import { db } from '../lib/database';
import { ErrorService } from './ErrorService';

export class TransactionService {
  private static activeTransactions: Set<string> = new Set();

  /**
   * Begins a transaction.
   * In IndexedDB, this is mostly about locking the resource.
   */
  static async begin(resourceId: string): Promise<boolean> {
    if (this.activeTransactions.has(resourceId)) {
      return false;
    }
    this.activeTransactions.add(resourceId);
    return true;
  }

  /**
   * Commits a transaction.
   * In IndexedDB, this is handled by the successful completion of the runTransaction callback.
   */
  static async commit(resourceId: string) {
    this.activeTransactions.delete(resourceId);
  }

  /**
   * Rolls back a transaction.
   * In IndexedDB, this is handled by throwing an error inside the runTransaction callback.
   */
  static async rollback(resourceId: string, error: any) {
    this.activeTransactions.delete(resourceId);
    await ErrorService.logTransactionError('TRANSACTION_MANAGER', `Rollback triggered for ${resourceId}`, { resourceId }, error);
  }

  /**
   * Safe execution wrapper for critical operations.
   */
  static async runSafe<T>(resourceId: string, operation: () => Promise<T>): Promise<T> {
    const started = await this.begin(resourceId);
    if (!started) {
      throw new Error("العملية قيد المعالجة حالياً، يرجى الانتظار... ⏳");
    }

    try {
      const result = await db.runTransaction(async () => {
        return await operation();
      });
      await this.commit(resourceId);
      return result;
    } catch (error) {
      await this.rollback(resourceId, error);
      throw error;
    }
  }
}
