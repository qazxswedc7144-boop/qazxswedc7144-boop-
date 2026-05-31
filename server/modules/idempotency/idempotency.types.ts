// server/modules/idempotency/idempotency.types.ts

export interface IdempotencyRecord {
  id: string;
  key: string;
  requestHash: string;
  endpoint: string;
  requestMethod: string;
  userId: string | null;
  responseBody: any | null;
  responseStatus: number | null;
  processing: boolean;
  lockedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface IdempotencyMetrics {
  preventedDuplicates: number;
  replayedRequests: number;
  hashMismatches: number;
  concurrentLockPrevention: number;
}
