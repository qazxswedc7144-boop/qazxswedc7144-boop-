// server/modules/locking/locking.types.ts

export type LockBackendStatus = "ACQUIRED" | "RELEASED" | "EXPIRED" | "RECOVERED";

export interface RedisLockRecord {
  id: string;
  lockKey: string;
  branchId: string;
  ownerId: string;
  ttl: number; // milliseconds
  acquiredAt: string;
  expiresAt: string;
  status: LockBackendStatus;
  idempotencyKey?: string;
  lockType: string;
}

export interface BackendLockAcquisitionOptions {
  key: string;
  branchId: string;
  ttl?: number;
  lockType: string;
  idempotencyKey?: string;
  ownerId?: string;
}
