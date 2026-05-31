// ==========================================
// FILE: src/modules/sync/sync.engine.ts
// ==========================================

import Dexie from 'dexie';
import { LocalSyncQueueItem } from './sync.types';
import { SYNC_CONFIG } from './sync.constants';
import { PharmaFlowDexieExtension } from './sync.queue';
import { getSyncActions } from './sync.events';

export class DistributedSyncEngine {
  private db: Dexie & PharmaFlowDexieExtension;
  private isProcessing = false;
  private timerId: any = null;

  constructor(dexieInstance: unknown) {
    this.db = dexieInstance as Dexie & PharmaFlowDexieExtension;
  }

  public start(): void {
    if (this.timerId) return;
    
    window.addEventListener('online', this.handleNetworkChange);
    window.addEventListener('offline', this.handleNetworkChange);
    
    this.timerId = setInterval(() => this.drainQueue(), SYNC_CONFIG.POLLING_INTERVAL_MS);
    this.drainQueue();
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    window.removeEventListener('online', this.handleNetworkChange);
    window.removeEventListener('offline', this.handleNetworkChange);
  }

  private handleNetworkChange = (): void => {
    const actions = getSyncActions();
    if (navigator.onLine) {
      actions.setNetworkStatus('ONLINE');
      this.drainQueue();
    } else {
      actions.setNetworkStatus('OFFLINE');
    }
  };

  public async drainQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;
    this.isProcessing = true;
    const actions = getSyncActions();
    actions.setQueueDraining(true);

    try {
      let hasMore = true;
      while (hasMore) {
        const batch = await this.db.syncQueue
          .where('[syncStatus+createdAt]')
          .between(['PENDING', Dexie.minKey], ['PENDING', Dexie.maxKey])
          .limit(SYNC_CONFIG.BATCH_CHUNK_SIZE)
          .toArray();

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const mutation of batch) {
          await this.processMutationWithRetry(mutation);
        }
      }
    } finally {
      this.isProcessing = false;
      actions.setQueueDraining(false);
    }
  }

  private async processMutationWithRetry(mutation: LocalSyncQueueItem): Promise<void> {
    await this.db.syncQueue.update(mutation.id!, { syncStatus: 'PROCESSING', updatedAt: new Date() });

    let delay: number = SYNC_CONFIG.BACKOFF_INITIAL_DELAY_MS;
    
    while (mutation.retryCount <= SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
      try {
        const response = await fetch('/api/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-ID': mutation.deviceId,
            'X-Session-ID': mutation.sessionId,
            'X-Correlation-ID': mutation.correlationId,
          },
          body: JSON.stringify({
            mutationId: mutation.mutationId,
            entityType: mutation.entityType,
            operationType: mutation.operationType,
            payload: mutation.payload,
            idempotencyKey: mutation.idempotencyKey,
            logicalTimestamp: mutation.logicalTimestamp,
            actorId: mutation.actorId,
          }),
        });

        if (response.ok) {
          await this.db.syncQueue.delete(mutation.id!);
          return;
        }

        const errPayload = await response.json().catch(() => ({}));
        
        if (response.status === 409 || errPayload.errorType === 'CONFLICT') {
          await this.handleConflict(mutation, errPayload.reason || 'Sovereign cloud ledger conflict detected');
          return;
        }

        throw new Error(`Server returned status: ${response.status}`);

      } catch (error) {
        mutation.retryCount++;
        await this.db.syncQueue.update(mutation.id!, { retryCount: mutation.retryCount, updatedAt: new Date() });

        if (mutation.retryCount > SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
          await this.db.syncQueue.update(mutation.id!, { syncStatus: 'FAILED', updatedAt: new Date() });
          return;
        }

        // تراجع أسي لحماية الشبكة (Exponential Backoff)
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, SYNC_CONFIG.BACKOFF_MAX_DELAY_MS);
      }
    }
  }

  private async handleConflict(mutation: LocalSyncQueueItem, reason: string): Promise<void> {
    await this.db.transaction('rw', [this.db.syncQueue, this.db.failedMutations], async () => {
      await this.db.failedMutations.add({
        mutationId: mutation.mutationId,
        reason: reason,
        payload: mutation.payload,
        createdAt: new Date(),
      });
      await this.db.syncQueue.update(mutation.id!, {
        syncStatus: 'CONFLICT',
        updatedAt: new Date(),
      });
    });
  }
}
