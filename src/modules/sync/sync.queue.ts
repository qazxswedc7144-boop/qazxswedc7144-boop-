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
  syncQueue: '++id,&idempotencyKey,mutationId,[syncStatus+createdAt],[entityType+createdAt]',
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
    
    try {
      return await this.db.transaction('rw', this.db.syncQueue, async () => {
        return await this.db.syncQueue.add(queueItem);
      });
    } catch (error: any) {
      if (error && (error.name === 'ConstraintError' || error instanceof Dexie.ConstraintError)) {
        // Return deterministic result on uniqueness conflict by returning the existing item's ID
        const existing = await this.db.syncQueue.where('idempotencyKey').equals(item.idempotencyKey).first();
        if (existing && existing.id !== undefined) {
          return existing.id;
        }
      }
      throw error;
    }
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
