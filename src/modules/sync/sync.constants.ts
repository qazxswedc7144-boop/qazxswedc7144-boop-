// ==========================================
// FILE: src/modules/sync/sync.constants.ts
// ==========================================

export const SYNC_CONFIG = {
  POLLING_INTERVAL_MS: 15000, // فحص الشبكة والمزامنة كل 15 ثانية
  BACKOFF_INITIAL_DELAY_MS: 2000,
  BACKOFF_MAX_DELAY_MS: 30000,
  MAX_RETRY_ATTEMPTS: 5,
  BATCH_CHUNK_SIZE: 25, // حجم الدفعة لتخفيف العبء على معالجات الأندرويد
} as const;
