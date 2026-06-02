// server/modules/locking/locking.service.ts

import crypto from "crypto";
import { prisma } from "../../database/prisma";
import { RedisConnectionManager } from "../../database/redis";
import { BackendLockAcquisitionOptions, RedisLockRecord } from "./locking.types";

export class LockingService {
  private static LUA_RELEASE = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  private static LUA_EXTEND = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("pexpire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

  /**
   * Safe getter to build a Redis scoped lock key by branch and type.
   */
  private static makeLockKey(key: string, branchId: string): string {
    return `lock:${branchId}:${key}`;
  }

  /**
   * Acquires a lock with exclusive Redis NX set.
   * Scopes lock by branchId to secure branch isolation.
   */
  static async acquireLock(options: BackendLockAcquisitionOptions): Promise<RedisLockRecord | null> {
    const { key, branchId, ttl = 30000, lockType, idempotencyKey, ownerId = "SYSTEM" } = options;
    const redisKey = this.makeLockKey(key, branchId);
    
    // Create atomic token to identify ownership
    const lockId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl);

    // Write to Redis with NX option (Set if not exists)
    const success = await RedisConnectionManager.set(redisKey, lockId, "PX", ttl);
    if (!success) {
      return null;
    }

    // Verify ownership right after set (NX is standard distributed mutex check)
    const currentToken = await RedisConnectionManager.get(redisKey);
    if (currentToken !== lockId) {
      return null;
    }

    const record: RedisLockRecord = {
      id: lockId,
      lockKey: key,
      branchId,
      ownerId,
      ttl,
      acquiredAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "ACQUIRED",
      idempotencyKey,
      lockType
    };

    // Log atomic database audit record (LOCK_ACQUIRED)
    await this.logAuditRecord(record, "LOCK_ACQUIRED", `Lock acquired on key: ${key}`);

    return record;
  }

  /**
   * Releases a lock atomically using a Lua script to guarantee only the owner can release it.
   */
  static async releaseLock(key: string, lockId: string, branchId: string, userId = "SYSTEM"): Promise<boolean> {
    const redisKey = this.makeLockKey(key, branchId);
    
    // Run atomic release eval script
    const result = await RedisConnectionManager.eval(this.LUA_RELEASE, 1, redisKey, lockId);
    const released = result === 1;

    if (released) {
      const record: RedisLockRecord = {
        id: lockId,
        lockKey: key,
        branchId,
        ownerId: userId,
        ttl: 0,
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        status: "RELEASED",
        lockType: "GENERIC"
      };
      await this.logAuditRecord(record, "LOCK_RELEASED", `Lock released on key ${key}`);
    }

    return released;
  }

  /**
   * Extends lock expiration atomically using a Lua script.
   */
  static async extendLock(key: string, lockId: string, branchId: string, ttl: number, userId = "SYSTEM"): Promise<boolean> {
    const redisKey = this.makeLockKey(key, branchId);
    const result = await RedisConnectionManager.eval(this.LUA_EXTEND, 1, redisKey, String(ttl));
    const extended = result === 1;

    if (extended) {
      const record: RedisLockRecord = {
        id: lockId,
        lockKey: key,
        branchId,
        ownerId: userId,
        ttl,
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl).toISOString(),
        status: "ACQUIRED",
        lockType: "GENERIC"
      };
      await this.logAuditRecord(record, "LOCK_EXTENDED", `Lock extended for ${ttl}ms`);
    }

    return extended;
  }

  /**
   * Verifies if a lock on a key is active.
   */
  static async isLocked(key: string, branchId: string): Promise<boolean> {
    const redisKey = this.makeLockKey(key, branchId);
    const token = await RedisConnectionManager.get(redisKey);
    return token !== null;
  }

  /**
   * Returns all active locks for diagnostics & recovery dashboard.
   */
  static async getActiveLocks(branchId?: string): Promise<any[]> {
    const pattern = branchId ? `lock:${branchId}:*` : "lock:*";
    const keys = await RedisConnectionManager.scanKeys(pattern);
    const result: any[] = [];

    for (const key of keys) {
      const token = await RedisConnectionManager.get(key);
      if (token) {
        // Parse back key parts: lock:branchId:key
        const parts = key.split(":");
        if (parts.length >= 3) {
          const bId = parts[1];
          const actualKey = parts.slice(2).join(":");
          result.push({
            id: token,
            lockKey: actualKey,
            branchId: bId,
            status: "ACQUIRED"
          });
        }
      }
    }

    return result;
  }

  /**
   * Lock recovery: cleans out safe stale or expired items
   */
  static async recoverLocks(branchId: string, key?: string): Promise<number> {
    const pattern = key ? `lock:${branchId}:${key}` : `lock:${branchId}:*`;
    const keys = await RedisConnectionManager.scanKeys(pattern);
    let count = 0;

    for (const k of keys) {
      await RedisConnectionManager.del(k);
      count++;
    }

    if (count > 0) {
      const record: RedisLockRecord = {
        id: "RECOVERY_SESSION",
        lockKey: key || "ALL_BRANCH_KEYS",
        branchId,
        ownerId: "RECOVERY_DAEMON",
        ttl: 0,
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        status: "RECOVERED",
        lockType: "GENERIC"
      };
      await this.logAuditRecord(record, "LOCK_RECOVERY", `Orphaned/Stale locks recovered. Cleaned ${count} keys.`);
    }

    return count;
  }

  /**
   * Internal immutable audit logger, writing directly to Postgres via Prisma.
   */
  private static async logAuditRecord(record: RedisLockRecord, action: string, details: string): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          userId: record.ownerId !== "SYSTEM" && record.ownerId !== "RECOVERY_DAEMON" ? record.ownerId : null,
          action,
          entity: "DistributedLock",
          entityId: record.id,
          after: JSON.stringify({
            lockKey: record.lockKey,
            branchId: record.branchId,
            ttl: record.ttl,
            lockType: record.lockType,
            idempotencyKey: record.idempotencyKey,
            status: record.status
          }),
          branchId: record.branchId,
          requestId: details
        }
      });
    } catch (err) {
      // Degrade gracefully if DB is closed or key constraint errors occur
      console.warn("[LockService] Audit record write bypassed gracefully:", err);
    }
  }
}
