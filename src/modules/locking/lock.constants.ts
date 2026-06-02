// src/modules/locking/lock.constants.ts

export const LOCK_DEFAULTS = {
  DEFAULT_TTL_MS: 30000, // 30 seconds
  MAX_TTL_MS: 300000,    // 5 minutes
  RETRY_ATTEMPTS: 5,
  RETRY_BACKOFF_MS: 50,  // Base retry delay
};

export const LOCK_KEYS = {
  inventory: (productId: string, branchId: string) => `inventory:${productId}:${branchId}`,
  transfer: (transferId: string) => `transfer:${transferId}`,
  reservation: (productId: string, branchId: string) => `reservation:${productId}:${branchId}`,
  purchase: (purchaseId: string, branchId: string) => `purchase:${purchaseId}:${branchId}`,
  sales: (salesId: string, branchId: string) => `sales:${salesId}:${branchId}`,
  generic: (key: string, branchId: string) => `generic:${branchId}:${key}`,
};

export const LOCK_AUDIT_ACTIONS = {
  LOCK_CREATED: 'LOCK_CREATED',
  LOCK_ACQUIRED: 'LOCK_ACQUIRED',
  LOCK_EXTENDED: 'LOCK_EXTENDED',
  LOCK_RELEASED: 'LOCK_RELEASED',
  LOCK_EXPIRED: 'LOCK_EXPIRED',
  LOCK_RECOVERY: 'LOCK_RECOVERY',
} as const;
