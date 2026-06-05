
import { db } from '@/core/db';
import { FaultService } from '@/services/integrity/FaultService';

export class TransactionService {
  private static activeTransactions: Set<string> = new Set();
  private static processedUuids: Set<string> = new Set();
  private static isLockedGlobal = false;

  /**
   * Begins a transaction.
   * Enforces global lock so only one operation is processed at a time.
   */
  static async begin(resourceId: string): Promise<boolean> {
    if (this.isLockedGlobal) {
      console.warn(`[TransactionLock] Refusing begin for ${resourceId}: Global write lock is active.`);
      return false;
    }
    if (this.activeTransactions.has(resourceId)) {
      console.warn(`[TransactionLock] Refusing begin for ${resourceId}: Resource active.`);
      return false;
    }
    
    this.isLockedGlobal = true;
    this.activeTransactions.add(resourceId);
    return true;
  }

  /**
   * Commits a transaction.
   */
  static async commit(resourceId: string) {
    this.activeTransactions.delete(resourceId);
    this.isLockedGlobal = false;
  }

  /**
   * Rolls back a transaction.
   */
  static async rollback(resourceId: string, error: any) {
    this.activeTransactions.delete(resourceId);
    this.isLockedGlobal = false;
    FaultService.logTransactionFault('TRANSACTION_MANAGER', `Rollback triggered for ${resourceId}`, { resourceId }, error);
  }

  /**
   * Verifies if a transaction UUID is already processed to ensure idempotency.
   */
  static async ensureIdempotency(transactionUuid?: string): Promise<void> {
    if (!transactionUuid) return;

    // 1. Memory Check
    if (this.processedUuids.has(transactionUuid)) {
      throw new Error("⚠️ تم التقاط نقرة متكررة! هذه العملية قيد الحفظ أو تم حفظها بنجاح بالفعل.");
    }

    // 2. Persistent Database Lookups
    try {
      const existingInvoicesCount = await db.invoices.where('transactionUuid').equals(transactionUuid).count();
      if (existingInvoicesCount > 0) {
        throw new Error("⚠️ عملية مكررة! هذا المستند تم تسجيله وترحيله إلى الدفاتر بنجاح بالرمز التعريفي الفريد.");
      }
    } catch (e: any) {
      if (e?.message?.includes("عملية مكررة")) {
        throw e;
      }
      // Fail-safe: if tables not fully bound, memory check is enough
    }
  }

  /**
   * Registers a transaction UUID as successfully completed.
   */
  static registerCompletedUuid(transactionUuid?: string): void {
    if (transactionUuid) {
      this.processedUuids.add(transactionUuid);
    }
  }

  /**
   * Safe execution wrapper for critical operations.
   */
  static async runSafe<T>(resourceId: string, operation: () => Promise<T>): Promise<T> {
    const started = await this.begin(resourceId);
    if (!started) {
      throw new Error("العملية قيد المعالجة حالياً من قِبل نظام الأمان، يرجى الانتظار... ⏳");
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
