// src/modules/locking/lock.repository.ts

import { DistributedLock, LockAcquisitionOptions, LockAuditRecord } from './lock.types';
import { LOCK_DEFAULTS } from './lock.constants';
import { financialApiClient } from '@/shared/network/idempotency';
import { db } from '@/core/db';
import { auditLogService } from '@/services/audit/auditLog';

export class LockRepository {
  private static localLocks: Map<string, DistributedLock> = new Map();

  /**
   * Helper to check offline/online status safely
   */
  private static isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Contacts backend to acquire a distributed lock in Redis.
   * Falls back to a local in-memory/settings cache when offline.
   */
  static async acquire(key: string, options: LockAcquisitionOptions): Promise<DistributedLock | null> {
    const ttl = options.ttl || LOCK_DEFAULTS.DEFAULT_TTL_MS;
    const branchId = options.branchId;
    const ownerId = options.ownerId || 'SYSTEM-UI';
    const lockType = options.lockType;
    const idempotencyKey = options.idempotencyKey;

    if (!this.isOnline()) {
      // Offline fallback: use local in-memory lock
      const existing = this.localLocks.get(key);
      const now = new Date();
      if (existing && new Date(existing.expiresAt) > now) {
        // Lock collision locally
        return null;
      }

      const acquiredAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + ttl).toISOString();
      const localLock: DistributedLock = {
        id: `local-${Math.random().toString(36).substr(2, 9)}`,
        lockKey: key,
        branchId,
        ownerId,
        ttl,
        acquiredAt,
        expiresAt,
        status: 'ACQUIRED',
        lockType,
        idempotencyKey
      };

      this.localLocks.set(key, localLock);
      await this.saveLocalLocksToSettings();
      
      // Log local audit record
      await this.logAuditRecord({
        id: `audit-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: acquiredAt,
        userId: ownerId,
        action: 'LOCK_ACQUIRED',
        lockId: localLock.id,
        lockKey: key,
        branchId,
        details: `Offline mode lock acquired locally. Type: ${lockType}`
      });

      return localLock;
    }

    // Online mode: call backend API
    try {
      const response = await financialApiClient.post('/api/locks/acquire', {
        key,
        branchId,
        ttl,
        lockType,
        idempotencyKey
      });

      if (response.status === 200 && response.data.acquired) {
        const lock = response.data.lock as DistributedLock;
        return lock;
      }
      return null;
    } catch (error) {
      console.warn('[LockRepository] Connection failed during acquire. Falling back to offline lock mechanism.', error);
      // Failover to local lock
      return this.acquireOfflineFallback(key, branchId, ownerId, ttl, lockType, idempotencyKey);
    }
  }

  private static async acquireOfflineFallback(
    key: string,
    branchId: string,
    ownerId: string,
    ttl: number,
    lockType: string,
    idempotencyKey?: string
  ): Promise<DistributedLock | null> {
    const now = new Date();
    const acquiredAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttl).toISOString();
    const localLock: DistributedLock = {
      id: `local-failover-${Math.random().toString(36).substr(2, 9)}`,
      lockKey: key,
      branchId,
      ownerId,
      ttl,
      acquiredAt,
      expiresAt,
      status: 'ACQUIRED',
      lockType: lockType as any,
      idempotencyKey
    };

    this.localLocks.set(key, localLock);
    await this.saveLocalLocksToSettings();

    await this.logAuditRecord({
      id: `audit-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: acquiredAt,
      userId: ownerId,
      action: 'LOCK_ACQUIRED',
      lockId: localLock.id,
      lockKey: key,
      branchId,
      details: `Network failover lock acquired. Type: ${lockType}`
    });

    return localLock;
  }

  /**
   * Releases a lock on the backend or locally.
   */
  static async release(key: string, lockId: string, branchId: string): Promise<boolean> {
    if (!this.isOnline()) {
      const existing = this.localLocks.get(key);
      if (existing && existing.id === lockId) {
        existing.status = 'RELEASED';
        this.localLocks.delete(key);
        await this.saveLocalLocksToSettings();
        
        await this.logAuditRecord({
          id: `audit-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          userId: existing.ownerId,
          action: 'LOCK_RELEASED',
          lockId,
          lockKey: key,
          branchId,
          details: 'Offline lock released locally'
        });
        return true;
      }
      return false;
    }

    try {
      const response = await financialApiClient.post('/api/locks/release', {
        key,
        lockId,
        branchId
      });
      return !!response.data.released;
    } catch (error) {
      console.warn('[LockRepository] Connection failed during lock release. Cleaning local failover cache.', error);
      this.localLocks.delete(key);
      await this.saveLocalLocksToSettings();
      return true;
    }
  }

  /**
   * Renews/Extends the TTL of an active lock.
   */
  static async extend(key: string, lockId: string, branchId: string, ttl: number): Promise<boolean> {
    if (!this.isOnline()) {
      const existing = this.localLocks.get(key);
      if (existing && existing.id === lockId) {
        const now = new Date();
        existing.expiresAt = new Date(now.getTime() + ttl).toISOString();
        existing.ttl = ttl;
        await this.saveLocalLocksToSettings();

        await this.logAuditRecord({
          id: `audit-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: now.toISOString(),
          userId: existing.ownerId,
          action: 'LOCK_EXTENDED',
          lockId,
          lockKey: key,
          branchId,
          details: `Local lock extended by ${ttl}ms`
        });
        return true;
      }
      return false;
    }

    try {
      const response = await financialApiClient.post('/api/locks/extend', {
        key,
        lockId,
        branchId,
        ttl
      });
      return !!response.data.extended;
    } catch (error) {
      console.warn('[LockRepository] Connection error during lock extension.', error);
      return false;
    }
  }

  /**
   * Checks if a key is locked.
   */
  static async check(key: string, branchId: string): Promise<boolean> {
    if (!this.isOnline()) {
      const existing = this.localLocks.get(key);
      if (existing) {
        const isStale = new Date(existing.expiresAt) <= new Date();
        if (isStale) {
          this.localLocks.delete(key);
          await this.saveLocalLocksToSettings();
          return false;
        }
        return true;
      }
      return false;
    }

    try {
      const response = await financialApiClient.get(`/api/locks/check/${key}?branchId=${branchId}`);
      return !!response.data.locked;
    } catch (error) {
      console.warn('[LockRepository] Connection error checks. Defaulting to local check.', error);
      return this.localLocks.has(key);
    }
  }

  /**
   * Logs an immutable audit event to both Dexie database and system console logs.
   */
  static async logAuditRecord(record: LockAuditRecord): Promise<void> {
    console.log(`[LOCK-AUDIT] [${record.action}] Key: ${record.lockKey}, Branch: ${record.branchId}, User: ${record.userId}`);
    try {
      await auditLogService.log({
        user_id: record.userId,
        action: record.action,
        target_type: 'DISTRIBUTED_LOCK',
        target_id: record.lockId,
        details: record.details || `Key: ${record.lockKey}`
      });
    } catch (err) {
      console.warn('[LockRepository] Failed to write lock audit to indexedDB:', err);
    }
  }

  /**
   * Persists local in-memory lock copies into Dexie settings table.
   */
  private static async saveLocalLocksToSettings(): Promise<void> {
    try {
      const serialized = JSON.stringify(Array.from(this.localLocks.entries()));
      await db.settings.put({
        key: 'offline_distributed_locks',
        value: serialized
      });
    } catch (err) {
      console.error('[LockRepository] Failed to serialize local locks to Dexie:', err);
    }
  }

  /**
   * Restores offline distributed locks upon app boots
   */
  static async loadOfflineLocks(): Promise<void> {
    try {
      const record = await db.settings.get('offline_distributed_locks');
      if (record && record.value) {
        const parsed = JSON.parse(record.value) as [string, DistributedLock][];
        this.localLocks = new Map(parsed);
        
        // Sweep any expired locks
        const now = new Date();
        for (const [key, lock] of this.localLocks.entries()) {
          if (new Date(lock.expiresAt) <= now) {
            this.localLocks.delete(key);
            console.log(`[LOCK-RECOVERY] Swept expired local lock on startup: ${key}`);
          }
        }
        await this.saveLocalLocksToSettings();
      }
    } catch (err) {
      console.warn('[LockRepository] Failed to restore local locks:', err);
    }
  }
}
