// src/modules/locking/lock.types.ts

export type LockStatus = 'ACQUIRED' | 'RELEASED' | 'EXPIRED' | 'RECOVERED';

export type LockType = 'INVENTORY' | 'BRANCH_TRANSFER' | 'RESERVATION' | 'PURCHASE' | 'SALES' | 'GENERIC';

export interface DistributedLock {
  id: string;
  lockKey: string;
  branchId: string;
  ownerId: string;
  ttl: number; // milliseconds
  acquiredAt: string;
  expiresAt: string;
  status: LockStatus;
  idempotencyKey?: string;
  lockType: LockType;
}

export interface LockAcquisitionOptions {
  ttl?: number; // In milliseconds, default: 30000 (30 seconds)
  idempotencyKey?: string;
  branchId: string;
  ownerId?: string;
  lockType: LockType;
}

export interface LockAuditRecord {
  id: string;
  timestamp: string;
  userId: string;
  action: 'LOCK_CREATED' | 'LOCK_ACQUIRED' | 'LOCK_EXTENDED' | 'LOCK_RELEASED' | 'LOCK_EXPIRED' | 'LOCK_RECOVERY';
  lockId: string;
  lockKey: string;
  branchId: string;
  details?: string;
}
