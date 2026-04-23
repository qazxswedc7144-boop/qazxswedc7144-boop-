
import { db } from '../lib/database';

export class TransactionLockManager {
  private static isSaving = false;
  private static activeLocks: Set<string> = new Set();

  /**
   * Prevents parallel operations on the same resource
   */
  static async acquireLock(resourceId: string): Promise<boolean> {
    if (this.isSaving || this.activeLocks.has(resourceId)) {
      return false;
    }
    this.isSaving = true;
    this.activeLocks.add(resourceId);
    return true;
  }

  static releaseLock(resourceId: string) {
    this.isSaving = false;
    this.activeLocks.delete(resourceId);
  }

  /**
   * Atomic wrapper for transactions with automatic locking and rollback logging
   */
  static async executeAtomic<T>(resourceId: string, operation: () => Promise<T>): Promise<T> {
    const lockAcquired = await this.acquireLock(resourceId);
    if (!lockAcquired) {
      throw new Error("عملية قيد التنفيذ حالياً.. يرجى الانتظار ⏳");
    }

    try {
      return await db.runTransaction(async () => {
        return await operation();
      });
    } catch (error) {
      console.error(`ATOMIC_TRANSACTION_FAILURE [${resourceId}]:`, error);
      throw error;
    } finally {
      this.releaseLock(resourceId);
    }
  }
}
