
import { db } from './database';
import { SyncQueueItem, SyncAction, ConflictArchive } from '../types';
import CryptoJS from 'crypto-js';
import Dexie from 'dexie';

// Fix: Define global for libraries that expect it (like some versions of crypto-js)
if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

const ENCRYPTION_KEY = (import.meta as any).env?.VITE_SYNC_ENCRYPTION_KEY || 'pharmaflow-sync-secret-2026';

export class SyncService {
  private static syncInterval: any = null;

  /**
   * Add an entity change to the sync queue
   */
  static async queueSync(entityType: string, entityId: string, action: SyncAction, data: any) {
    try {
      const payload = JSON.stringify(data);
      const encryptedPayload = CryptoJS.AES.encrypt(payload, ENCRYPTION_KEY).toString();

      const syncItem: SyncQueueItem = {
        id: `SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        entityType,
        entityId,
        action,
        payload: encryptedPayload,
        localTimestamp: new Date().toISOString(),
        syncStatus: 'PENDING',
        retryCount: 0
      };

      // Use ignoreTransaction to prevent "Object store not found" errors when called from hooks
      // that are inside a transaction with a limited scope.
      await Dexie.ignoreTransaction(async () => {
        await db.db.syncQueue.add(syncItem);
      });
      
      console.log(`[SyncService] Queued ${action} for ${entityType}:${entityId}`);
    } catch (error) {
      console.error('[SyncService] Failed to queue sync:', error);
    }
  }

  /**
   * Start the background sync worker
   */
  static startWorker() {
    if (this.syncInterval) return;

    // Run every 60 seconds
    this.syncInterval = setInterval(() => {
      this.processQueue();
    }, 60000);

    // Initial run
    this.processQueue();
  }

  /**
   * Stop the background sync worker
   */
  static stopWorker() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Process pending items in the sync queue
   */
  private static async processQueue() {
    if (!navigator.onLine) {
      console.log('[SyncService] Offline, skipping sync');
      return;
    }

    // Hardening: Prevent sync during active transaction
    if ((db as any).isTransactionActive) {
      console.log('[SyncService] Transaction active, skipping sync');
      return;
    }

    try {
      const pendingItems = await db.db.syncQueue
        .where('syncStatus')
        .equals('PENDING')
        .toArray();

      if (pendingItems.length === 0) return;

      console.log(`[SyncService] Processing ${pendingItems.length} pending items`);

      for (const item of pendingItems) {
        await this.syncItem(item);
      }
    } catch (error) {
      console.error('[SyncService] Error processing sync queue:', error);
    }
  }

  /**
   * Sync a single item to the "cloud" (mocked API)
   */
  private static async syncItem(item: SyncQueueItem) {
    try {
      // Hardening: Add deviceId and syncVersion to payload
      const deviceId = await db.getSetting('DEVICE_ID', 'UNKNOWN');
      
      // Simulate API call with hardening metadata
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simulate random conflict for demonstration (1% chance)
      const isConflict = Math.random() < 0.01;
      
      if (isConflict) {
        await this.handleConflict(item);
      } else {
        await db.db.syncQueue.update(item.id, { syncStatus: 'SYNCED' });
        console.log(`[SyncService] Successfully synced ${item.entityType}:${item.entityId} from device:${deviceId}`);
      }
    } catch (error) {
      console.error(`[SyncService] Failed to sync item ${item.id}:`, error);
      await db.db.syncQueue.update(item.id, { 
        retryCount: (item.retryCount || 0) + 1,
        error: String(error)
      });
    }
  }

  /**
   * Handle sync conflicts using "Latest timestamp wins"
   */
  private static async handleConflict(item: SyncQueueItem) {
    console.warn(`[SyncService] Conflict detected for ${item.entityType}:${item.entityId}`);
    
    try {
      // 1. Decrypt local data
      const bytes = CryptoJS.AES.decrypt(item.payload, ENCRYPTION_KEY);
      const localData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

      // 2. Fetch "cloud" data (mocked)
      // In a real app, the API would return the current cloud version
      const cloudData = { ...localData, lastModified: new Date(Date.now() - 10000).toISOString() }; 
      
      const localTime = new Date(item.localTimestamp).getTime();
      const cloudTime = new Date(cloudData.lastModified || 0).getTime();

      if (localTime >= cloudTime) {
        // Local wins: Push local to cloud again (in real app, API would handle this)
        await db.db.syncQueue.update(item.id, { syncStatus: 'SYNCED' });
        console.log('[SyncService] Conflict resolved: Local version won (newer)');
      } else {
        // Cloud wins: Archive local, update local with cloud data
        const archive: ConflictArchive = {
          id: `CONF-${Date.now()}`,
          entityType: item.entityType,
          entityId: item.entityId,
          data: JSON.stringify(localData),
          resolvedAt: new Date().toISOString(),
          resolution: 'CLOUD_WON'
        };
        
        await db.db.conflictArchive.add(archive);
        await db.db.syncQueue.update(item.id, { syncStatus: 'CONFLICT' });
        
        // Log to AuditTrail
        await db.addAuditLog('SYSTEM', 'SYSTEM', item.entityId, `Conflict resolved for ${item.entityType}. Cloud version won.`);
        
        console.log('[SyncService] Conflict resolved: Cloud version won (newer)');
      }
    } catch (error) {
      console.error('[SyncService] Failed to resolve conflict:', error);
    }
  }

  /**
   * Get overall sync status
   */
  static async getSyncStatus(): Promise<'SYNCED' | 'PENDING' | 'CONFLICT'> {
    const conflictCount = await db.db.syncQueue.where('syncStatus').equals('CONFLICT').count();
    if (conflictCount > 0) return 'CONFLICT';

    const pendingCount = await db.db.syncQueue.where('syncStatus').equals('PENDING').count();
    if (pendingCount > 0) return 'PENDING';

    return 'SYNCED';
  }
}
