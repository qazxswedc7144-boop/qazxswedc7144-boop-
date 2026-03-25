
import { db } from './database';
import { authService } from './auth.service';

export class LockService {
  private static LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

  /**
   * Checks if a record is locked by another user and if the lock is still valid.
   */
  static async isLockedByOther(table: 'sales' | 'purchases', id: string): Promise<boolean> {
    const record = await (db.db as any)[table].get(id);
    if (!record || !record.lockedBy) return false;

    const currentUser = authService.getCurrentUser();
    if (record.lockedBy === currentUser?.User_Email) return false;

    const lockedAt = new Date(record.lockedAt).getTime();
    const now = Date.now();

    // If lock is older than 2 minutes, it's considered expired
    if (now - lockedAt > this.LOCK_TIMEOUT_MS) {
      return false;
    }

    return true;
  }

  /**
   * Acquires a lock on a record for the current user.
   */
  static async acquireLock(table: 'sales' | 'purchases', id: string): Promise<void> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) throw new Error("Authentication required to lock records.");

    const isLocked = await this.isLockedByOther(table, id);
    if (isLocked) {
      throw new Error("هذا السجل مقفل حالياً بواسطة مستخدم آخر 🔒");
    }

    await (db.db as any)[table].update(id, {
      lockedBy: currentUser.User_Email,
      lockedAt: new Date().toISOString()
    });
  }

  /**
   * Releases a lock on a record.
   */
  static async releaseLock(table: 'sales' | 'purchases', id: string): Promise<void> {
    await (db.db as any)[table].update(id, {
      lockedBy: null,
      lockedAt: null
    });
  }

  static async acquireGlobalTransactionLock(): Promise<boolean> {
    const isLocked = await db.getSetting('GLOBAL_TRANSACTION_LOCK', 'FALSE');
    if (isLocked === 'TRUE') {
      const lockTime = await db.getSetting('GLOBAL_TRANSACTION_LOCK_TIME', '0');
      const now = Date.now();
      // Auto-release after 30 seconds if stuck
      if (now - parseInt(lockTime) > 30000) {
        await this.releaseGlobalTransactionLock();
      } else {
        return false;
      }
    }
    await db.saveSetting('GLOBAL_TRANSACTION_LOCK', 'TRUE');
    await db.saveSetting('GLOBAL_TRANSACTION_LOCK_TIME', Date.now().toString());
    return true;
  }

  static async releaseGlobalTransactionLock(): Promise<void> {
    await db.saveSetting('GLOBAL_TRANSACTION_LOCK', 'FALSE');
    await db.saveSetting('GLOBAL_TRANSACTION_LOCK_TIME', '0');
  }
}
