// src/types/common.types.ts

export type SyncStatus = 'NEW' | 'UPDATED' | 'SYNCED' | 'CONFLICT' | 'PENDING';
export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid';
export type SystemStatus = 'ACTIVE' | 'RECOVERY_MODE' | 'MAINTENANCE';

export interface SyncableEntity {
  id: string;
  lastModified?: string;
  updated_at?: string;
  updatedAt?: string;
  isSynced?: boolean;
  version?: number;
  syncStatus?: SyncStatus;
  syncVersion?: number;
  isDeleted?: boolean;
  Created_By?: string;
  Created_At?: string;
  lastSync?: string;
  tenant_id?: string;
}

export type SubscriptionPlan = 'Free' | 'Basic' | 'Pro';
export type TenantStatus = 'Active' | 'Suspended' | 'Expired';

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AccountingError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingError';
  }
}

export class InventoryError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryError';
  }
}

export class SecurityError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}
