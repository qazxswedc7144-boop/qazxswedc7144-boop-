// ==========================================
// FILE: src/modules/sync/sync.types.ts
// ==========================================

export type SyncStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CONFLICT';
export type MutationOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface LocalSyncQueueItem {
  id?: number; // معرف تلقائي من Dexie
  mutationId: string; // UUID فريد للمعاملة
  entityType: 'PRODUCT' | 'INVENTORY_BATCH' | 'INVOICE' | 'JOURNAL_ENTRY';
  operationType: MutationOperation;
  payload: Record<string, unknown>;
  syncStatus: SyncStatus;
  retryCount: number;
  idempotencyKey: string;
  deviceId: string;
  sessionId: string;
  logicalTimestamp: number;
  actorId: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalSyncEvent {
  id?: number;
  eventId: string;
  sequence: string; // ممثل كـ string محلياً لمنع مشاكل الـ JSON مع BigInt
  entityType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface FailedMutationLog {
  id?: number;
  mutationId: string;
  reason: string;
  conflictType?: 'STOCK_OVER_ALLOCATION' | 'DELETED_BATCH' | 'DUPLICATE_REPLAY' | 'LEDGER_MISMATCH';
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface NetworkState {
  status: 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'SYNCING';
  isQueueDraining: boolean;
}
