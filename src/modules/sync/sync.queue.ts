// ==========================================
// FILE: src/modules/sync/sync.queue.ts
// ==========================================

import Dexie, { Table } from 'dexie';
import { LocalSyncQueueItem, LocalSyncEvent, FailedMutationLog } from './sync.types';

export interface PharmaFlowDexieExtension {
  syncQueue: Table<LocalSyncQueueItem, number>;
  syncEvents: Table<LocalSyncEvent, number>;
  failedMutations: Table<FailedMutationLog, number>;
}

export const syncSchemaExtensions = {
  syncQueue: '++id, mutationId, [syncStatus+createdAt], [entityType+createdAt], idempotencyKey',
  syncEvents: '++id, eventId, sequence, createdAt',
  failedMutations: '++id, mutationId, createdAt',
};

export class SyncQueueRepository {
  private db: Dexie & PharmaFlowDexieExtension;

  constructor(dexieInstance: unknown) {
    this.db = dexieInstance as Dexie & PharmaFlowDexieExtension;
  }

  async enqueue(item: Omit<LocalSyncQueueItem, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'retryCount'>): Promise<number> {
    const now = new Date();
    const queueItem: LocalSyncQueueItem = {
      ...item,
      syncStatus: 'PENDING',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    return await this.db.transaction('rw', this.db.syncQueue, async () => {
      // التحقق الصارم من مفتاح عدم التكرار محلياً (Local Idempotency Guard)
      const exists = await this.db.syncQueue.where('idempotencyKey').equals(item.idempotencyKey).first();
      if (exists) {
        throw new Error(`Idempotency validation failed. Mutation already enqueued: ${item.idempotencyKey}`);
      }
      return await this.db.syncQueue.add(queueItem);
    });
  }

  async getNextPendingBatch(limit: number): Promise<LocalSyncQueueItem[]> {
    // استخدام الفهرس المركب لمنع التصفح الكامل للجدول ومقاومة البطء
    return await this.db.syncQueue
      .where('[syncStatus+createdAt]')
      .between(['PENDING', Dexie.minKey], ['PENDING', Dexie.maxKey])
      .limit(limit)
      .toArray();
  }
}
