
import { db } from './database';
import { SyncQueueItem, SyncAction, ConflictArchive } from '../types';
import CryptoJS from 'crypto-js';
import Dexie from 'dexie';
import { SyncEngine } from './SyncEngine';

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
      await Dexie.ignoreTransaction(async () => {
        await db.db.syncQueue.add(syncItem);
      });
      
      // Trigger immediate sync if online
      if (navigator.onLine) {
        this.processQueue();
      }
      
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

    // Run every 30 seconds
    this.syncInterval = setInterval(() => {
      this.processQueue();
    }, 30000);

    // Initial run
    this.processQueue();

    // Listen for network changes
    SyncEngine.initNetworkDetection((online) => {
      if (online) {
        console.log('[SyncService] Back online, processing queue...');
        this.processQueue();
      }
    });
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
    if (!navigator.onLine) return;

    try {
      const pendingItems = await db.db.syncQueue
        .where('syncStatus')
        .equals('PENDING')
        .toArray();

      if (pendingItems.length === 0) return;

      console.log(`[SyncService] Syncing ${pendingItems.length} items to Firebase...`);

      for (const item of pendingItems) {
        await this.syncItem(item);
      }
    } catch (error) {
      console.error('[SyncService] Error processing sync queue:', error);
    }
  }

  /**
   * Sync a single item to Firestore
   */
  private static async syncItem(item: SyncQueueItem) {
    try {
      const bytes = CryptoJS.AES.decrypt(item.payload, ENCRYPTION_KEY);
      const data = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

      // Map entityType to Firestore collection name
      const collectionMap: Record<string, string> = {
        'SALE': 'sales',
        'PURCHASE': 'purchases',
        'PRODUCT': 'products',
        'JOURNAL_ENTRY': 'journal_entries',
        'STOCK_MOVEMENT': 'stock_movements',
        'INVENTORY_LAYER': 'inventory_layers',
        'ACCOUNT': 'accounts',
        'SUPPLIER': 'suppliers',
        'CUSTOMER': 'customers',
        'Invoices_Sales': 'sales',
        'Invoices_Purchases': 'purchases',
        'Items_Inventory': 'products',
        'Financial_Transactions': 'financial_transactions',
        'Voucher_Invoice_Link': 'voucher_invoice_links',
        'Suppliers': 'suppliers',
        'Customers': 'customers'
      };

      const collectionName = collectionMap[item.entityType] || item.entityType.toLowerCase();

      if (item.action === 'DELETE') {
        // Handle delete (soft delete or hard delete based on requirement)
        // For now, we'll just mark as deleted in Firestore
        await SyncEngine.saveDoc(collectionName, item.entityId, { ...data, isDeleted: true });
      } else {
        await SyncEngine.saveDoc(collectionName, item.entityId, data);
      }

      // Also log to Firestore sync_queue for audit
      await SyncEngine.saveDoc('sync_queue', item.id, {
        ...item,
        syncStatus: 'SYNCED',
        syncedAt: new Date().toISOString()
      });

      await db.db.syncQueue.update(item.id, { syncStatus: 'SYNCED' });
    } catch (error) {
      console.error(`[SyncService] Failed to sync item ${item.id}:`, error);
      await db.db.syncQueue.update(item.id, { 
        retryCount: (item.retryCount || 0) + 1,
        error: String(error)
      });
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
