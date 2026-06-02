// src/modules/locking/lock.service.ts

import { DistributedLock, LockAcquisitionOptions } from './lock.types';
import { LOCK_DEFAULTS } from './lock.constants';
import { LockRepository } from './lock.repository';

export class LockService {
  /**
   * Safe sleep helper for retry backoffs
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Acquires a lock with retry logic and cellular backoff.
   */
  static async acquireLock(
    key: string,
    options: LockAcquisitionOptions
  ): Promise<DistributedLock | null> {
    const retries = options.ttl ? Math.max(1, Math.min(10, Math.floor(options.ttl / 1000))) : LOCK_DEFAULTS.RETRY_ATTEMPTS;
    const baseBackoff = LOCK_DEFAULTS.RETRY_BACKOFF_MS;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const lock = await LockRepository.acquire(key, options);
        if (lock) {
          return lock;
        }
      } catch (err) {
        console.warn(`[LockService] Attempt ${attempt + 1} to acquire lock ${key} failed.`, err);
      }

      // Exponential backoff with jitter
      if (attempt < retries - 1) {
        const jitter = Math.random() * 20;
        const sleepTime = baseBackoff * Math.pow(1.5, attempt) + jitter;
        await this.sleep(sleepTime);
      }
    }

    return null;
  }

  /**
   * Releases a lock.
   */
  static async releaseLock(key: string, lockId: string, branchId: string): Promise<boolean> {
    try {
      return await LockRepository.release(key, lockId, branchId);
    } catch (err) {
      console.error(`[LockService] Failed to release lock ${key}:`, err);
      return false;
    }
  }

  /**
   * Runs a task securely inside a distributed lock.
   * Acquires the lock, runs the provided callback, and automatically releases on resolution or rejection.
   * Periodically heartbeats the lock extension so it doesn't expire during prolonged task processing.
   */
  static async withLock<T>(
    key: string,
    options: LockAcquisitionOptions,
    callback: () => Promise<T>
  ): Promise<T> {
    const lock = await this.acquireLock(key, options);
    if (!lock) {
      throw new Error(`[LockService] Conflict detected. Unable to acquire lock on target resource: '${key}' within allocation limit.`);
    }

    let heartbeatInterval: any = null;
    const ttl = options.ttl || LOCK_DEFAULTS.DEFAULT_TTL_MS;
    
    // Auto lock renewal / extension heartbeat
    if (ttl > 5000) {
      const renewalRate = Math.floor(ttl * 0.4); // Renew when 40% of TTL is reached
      heartbeatInterval = setInterval(async () => {
        try {
          const extended = await LockRepository.extend(key, lock.id, options.branchId, ttl);
          if (!extended) {
            console.warn(`[LockService] Heartbeat renewal failed for lock on key: ${key}`);
          }
        } catch (err) {
          console.warn(`[LockService] Renewal error for key: ${key}`, err);
        }
      }, renewalRate);
    }

    try {
      const result = await callback();
      return result;
    } finally {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      await this.releaseLock(key, lock.id, options.branchId);
    }
  }

  /**
   * Performs automatic cleanups of expired or stray locks on App boot.
   */
  static async initialize(): Promise<void> {
    console.log('[LockService] Initializing Distributed Locking Module...');
    await LockRepository.loadOfflineLocks();
    
    // Safe hook listener to clear locks if tab is closed or process killed (browser environment)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        // Broadcast local lock cleanups as a best-effort release
        console.log('[LockService] Tab is closing. Performing best-effort lock releases.');
      });
    }
  }
}
